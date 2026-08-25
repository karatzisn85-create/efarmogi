/**
 * Email υπενθυμίσεις Ημερολογίου Προθεσμιών (Φάση 3γ).
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const {
  loadCalendarConfig,
  isNotifyEventTypeEnabled,
  getEventTypeSetting,
  userMatchesEventTypeRecipients,
  ALLOWED_NOTIFY_EVENT_TYPES,
} = require('./calendarConfigService');
const {
  loadEmailConfig,
  isConfigured,
  createTransporter,
  escapeHtml,
  getAppDisplayName,
  buildEmailHtml,
  buildLogoAttachment,
} = require('./taskAssignmentEmailService');
const {
  buildEngineerVisibilityContext,
} = require('./chargeFilterUtils');
const {
  daysUntilKhmdhsDate,
  formatKhmdhsDateTimeEl,
} = require('./khmdhsDateUtils');
const calendarEventsBuilder = require('./calendarEventsBuilder');
const { EVENT_TYPES } = calendarEventsBuilder;
const { createContractorRegistryService, CONTRACTOR_REGISTRY_DIR_NAME } = require('./contractorRegistryService');

const REMINDER_LOG_FILE = 'procurement-calendar-reminder-log.json';
const EMAIL_HISTORY_FILE = 'email-send-history.json';

function getReminderLogPath(dataDir) {
  return path.join(dataDir, 'config', REMINDER_LOG_FILE);
}

function loadReminderLog(dataDir) {
  try {
    const p = getReminderLogPath(dataDir);
    if (!fs.existsSync(p)) return { sent: {} };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { sent: {} };
  }
}

function saveReminderLog(dataDir, log) {
  const dir = path.join(dataDir, 'config');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(getReminderLogPath(dataDir), log);
}

function getEmailHistoryPath(dataDir) {
  return path.join(dataDir, 'config', EMAIL_HISTORY_FILE);
}

function loadEmailHistory(dataDir) {
  try {
    const p = getEmailHistoryPath(dataDir);
    if (!fs.existsSync(p)) return { entries: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return { entries: [] }; }
}

function appendEmailHistory(dataDir, entry) {
  const history = loadEmailHistory(dataDir);
  history.entries.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (history.entries.length > 200) history.entries.length = 200;
  const dir = path.join(dataDir, 'config');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(getEmailHistoryPath(dataDir), history);
}

function daysUntilDate(isoDate) {
  return daysUntilKhmdhsDate(isoDate);
}

function formatDateEl(iso) {
  return formatKhmdhsDateTimeEl(iso);
}

/**
 * Ώρες ησυχίας χρήστη (π.χ. 22:00–08:00). Επιστρέφει true αν ΔΕΝ πρέπει να σταλεί τώρα.
 */
function isWithinQuietHours(preferences, now = new Date()) {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  if (prefs.quietHoursEnabled !== true) return false;

  const parseHm = (raw) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
    return h * 60 + min;
  };

  const start = parseHm(prefs.quietHoursStart || '22:00');
  const end = parseHm(prefs.quietHoursEnd || '08:00');
  if (start == null || end == null || start === end) return false;

  const cur = now.getHours() * 60 + now.getMinutes();
  if (start < end) return cur >= start && cur < end;
  // Διανυκτέρευση (π.χ. 22:00 → 08:00)
  return cur >= start || cur < end;
}

function resolveRecipients(config, users) {
  const cfg = config || {};
  const byUsername = new Map();

  for (const user of users || []) {
    // Ίδιος κανόνας με login / get-users: απουσία πεδίων = ενεργός & εγκεκριμένος
    if (!user || user.active === false || user.approved === false) continue;
    const email = String(user.email || '').trim();
    if (!email.includes('@')) continue;
    const username = String(user.username || '').trim().toLowerCase();
    if (!username) continue;

    // Προσωπική προτίμηση: απενεργοποίηση email ημερολογίου
    if (user.notificationPreferences?.calendarEmail === false) continue;

    // Ένταξη αν ο χρήστης ανήκει στους παραλήπτες τουλάχιστον ενός ενεργού τύπου
    const matchesAnyType = ALLOWED_NOTIFY_EVENT_TYPES.some((eventType) => {
      if (!isNotifyEventTypeEnabled(cfg, eventType)) return false;
      const typeSetting = getEventTypeSetting(cfg, eventType);
      return userMatchesEventTypeRecipients(user, typeSetting);
    });
    if (!matchesAnyType) continue;

    byUsername.set(username, {
      username,
      email: email.toLowerCase(),
      role: user.role,
      fullName: user.fullName || user.username,
      assignedSupervisors: Array.isArray(user.assignedSupervisors) ? user.assignedSupervisors : [],
      notificationPreferences: user.notificationPreferences || {},
      engineerContext:
        user.role === 'ENGINEER'
          ? buildEngineerVisibilityContext(username, user.assignedSupervisors)
          : null,
    });
  }

  return [...byUsername.values()];
}

function urgencyColor(daysLeft) {
  if (daysLeft == null) return '#64748b';
  if (daysLeft < 0) return '#64748b';
  if (daysLeft <= 7) return '#dc2626';
  if (daysLeft <= 30) return '#d97706';
  return '#4338ca';
}

function daysLeftLabel(daysLeft, eventType) {
  if (eventType === EVENT_TYPES.COMPLIANCE_12M) return 'Ενεργή παράβαση';
  if (daysLeft == null) return '—';
  if (daysLeft < 0) return `Έληξε πριν ${Math.abs(daysLeft)} ημ.`;
  if (daysLeft === 0) return 'Σήμερα';
  if (daysLeft === 1) return 'Αύριο';
  return `${daysLeft} ημέρες`;
}

function buildProcurementReminderHtml({ items, appName, headline, badgeLabel, badgeColor }) {
  const rowsHtml = items.map((item) => {
    const color = urgencyColor(item.daysLeft);
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.subprojectTitle)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;font-size:0.85rem">${escapeHtml(item.adam || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${escapeHtml(formatDateEl(item.deadlineIso))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:${color};font-weight:700">${escapeHtml(daysLeftLabel(item.daysLeft, item.eventType))}</td>
    </tr>`;
  }).join('');

  const tableBlock = `
    <table style="width:100%;border-collapse:collapse;font-size:0.88rem;margin-top:8px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px 10px;text-align:left">Τύπος</th>
          <th style="padding:8px 10px;text-align:left">Τίτλος / Υποέργο</th>
          <th style="padding:8px 10px;text-align:center">ΑΔΑΜ</th>
          <th style="padding:8px 10px;text-align:center">Ημερομηνία</th>
          <th style="padding:8px 10px;text-align:center">Κατάσταση</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

  return buildEmailHtml({
    appName,
    badgeLabel,
    badgeColor,
    headline,
    workspaceTitle: 'Ημερολόγιο Προθεσμιών',
    rows: [
      { label: 'Προθεσμίες', value: tableBlock },
    ],
    footnote: 'Αναλυτικά στοιχεία και άμεση πρόσβαση στα υποέργα βρίσκονται στο Ημερολόγιο Προθεσμιών.',
    useCidLogo: true,
  });
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (60 * 60 * 1000);
}

/**
 * Επιλέγει ποια κατώφλια «μέρες πριν» πρέπει να σταλούν τώρα (ακριβής μέρα ή catch-up).
 *
 * Κανόνας: για κάθε X που δεν έχει σταλεί, αν daysLeft <= X και δεν υπάρχει
 * μικρότερο Y στη λίστα με daysLeft <= Y, τότε το X είναι υποψήφιο.
 * Επιστρέφει το μικρότερο τέτοιο X (το πιο «κοντινό» ανοιχτό κατώφλι) — 0 ή 1 τιμή.
 *
 * Έτσι: χάθηκε η «7», άνοιγμα στις 6 → [7]· άνοιγμα στις 3 χωρίς «7» → [3] (όχι και 7).
 *
 * @param {number} daysLeft
 * @param {number[]} daysBefore
 * @param {Set<number>|number[]} sentThresholdDays — κατώφλια που έχουν ήδη σταλεί για αυτή την προθεσμία
 * @returns {number[]}
 */
function pickThresholdTriggers(daysLeft, daysBefore = [], sentThresholdDays = []) {
  if (daysLeft == null || daysLeft < 0 || !Number.isFinite(Number(daysLeft))) return [];
  const left = Number(daysLeft);
  const thresholds = [...new Set(
    (Array.isArray(daysBefore) ? daysBefore : [])
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d >= 0)
  )].sort((a, b) => b - a);

  const sent = sentThresholdDays instanceof Set
    ? sentThresholdDays
    : new Set(
      (Array.isArray(sentThresholdDays) ? sentThresholdDays : [])
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d))
    );

  const candidates = [];
  for (const x of thresholds) {
    if (sent.has(x)) continue;
    if (left > x) continue;
    const hasCloserOpen = thresholds.some((y) => y < x && left <= y);
    if (hasCloserOpen) continue;
    candidates.push(x);
  }

  if (!candidates.length) return [];
  // Ένα μόνο κατώφλι ανά προθεσμία ανά έλεγχο — το πιο κοντινό ανοιχτό.
  return [Math.min(...candidates)];
}

/** Παλιά κλειδιά χωρίς ημερομηνία στο itemKey — αποφυγή εφάπαξ διπλής αποστολής μετά την αναβάθμιση. */
function legacyReminderItemKeys(item) {
  if (!item?.eventType) return [];
  const keys = [];
  if (item.eventType === EVENT_TYPES.DEADLINE && item.subprojectId) {
    keys.push(`${EVENT_TYPES.DEADLINE}:${item.subprojectId}`);
  }
  if (item.eventType === EVENT_TYPES.OFFERS_EXPIRY && item.subprojectId) {
    keys.push(`${EVENT_TYPES.OFFERS_EXPIRY}:${item.subprojectId}`);
  }
  if (item.eventType === EVENT_TYPES.CUSTOM && item.customEventId) {
    keys.push(`${EVENT_TYPES.CUSTOM}:${item.customEventId}`);
  }
  if (item.eventType === EVENT_TYPES.CONTRACT_END && item.itemKey) {
    const stripped = String(item.itemKey).replace(/:\d{4}-\d{2}-\d{2}$/, '');
    if (stripped && stripped !== item.itemKey) keys.push(stripped);
  }
  return keys;
}

function hasSentLogKey(sentMap, rcpKey, itemKey, suffix) {
  return !!sentMap[`${rcpKey}:${itemKey}:${suffix}`];
}

function wasThresholdSent(sentMap, rcpKey, item, daysBeforeValue) {
  const suffix = `d:${daysBeforeValue}`;
  if (hasSentLogKey(sentMap, rcpKey, item.itemKey, suffix)) return true;
  return legacyReminderItemKeys(item).some((legacyKey) => (
    hasSentLogKey(sentMap, rcpKey, legacyKey, suffix)
  ));
}

function collectItemsForRecipient(items, recipient, config, log) {
  const thresholdItems = [];
  const urgentItems = [];
  const complianceItems = [];
  const daysBefore = [...(config.daysBefore || [])]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0);

  const visible = calendarEventsBuilder.filterItemsForRecipient(items, recipient);
  const rcpKey = recipient.username || recipient.email || '';
  const sentMap = (log && log.sent && typeof log.sent === 'object') ? log.sent : {};

  for (const item of visible) {
    if (!isNotifyEventTypeEnabled(config, item.eventType)) continue;
    const typeSetting = getEventTypeSetting(config, item.eventType);
    if (!userMatchesEventTypeRecipients(recipient, typeSetting)) continue;

    if (item.eventType === EVENT_TYPES.COMPLIANCE_12M) {
      const key = `${rcpKey}:${item.itemKey}:compliance`;
      if (!sentMap[key]) complianceItems.push({ ...item, trigger: 'compliance' });
      continue;
    }

    const { daysLeft } = item;
    if (daysLeft == null || daysLeft < 0) continue;

    const sentThresholdDays = new Set(
      daysBefore.filter((db) => wasThresholdSent(sentMap, rcpKey, item, db))
    );
    const toSend = pickThresholdTriggers(daysLeft, daysBefore, sentThresholdDays);

    let addedToThresholdThisRun = false;
    for (const db of toSend) {
      thresholdItems.push({
        ...item,
        trigger: 'threshold',
        daysBefore: db,
        isCatchUp: daysLeft !== db,
      });
      addedToThresholdThisRun = true;
    }

    const urgCfg = config.urgentRepeat || {};
    if (!addedToThresholdThisRun && urgCfg.enabled !== false && daysLeft >= 0 && daysLeft < 7) {
      const urgKeys = [
        `${rcpKey}:${item.itemKey}:urgent`,
        ...legacyReminderItemKeys(item).map((k) => `${rcpKey}:${k}:urgent`),
      ];
      const urg = urgKeys
        .map((k) => sentMap[k])
        .find((v) => v && typeof v === 'object')
        || { count: 0, lastSent: null };
      const maxCount = Number(urgCfg.maxCount) || 3;
      const intervalHours = Number(urgCfg.intervalHours) || 24;
      if (urg.count < maxCount && hoursSince(urg.lastSent) >= intervalHours) {
        urgentItems.push({ ...item, trigger: 'urgent' });
      }
    }
  }

  return { thresholdItems, urgentItems, complianceItems };
}

function markSentKeys(log, items, trigger, recipient) {
  const now = new Date().toISOString();
  const rcpKey = (recipient && (recipient.username || recipient.email)) || '';
  for (const item of items) {
    if (trigger === 'threshold') {
      log.sent[`${rcpKey}:${item.itemKey}:d:${item.daysBefore}`] = now;
      // Μετά από κατώφλι/catch-up μέσα στις τελευταίες 7 μέρες: μην στείλεις επείγον αμέσως μετά.
      if (item.daysLeft != null && item.daysLeft >= 0 && item.daysLeft < 7) {
        const urgKey = `${rcpKey}:${item.itemKey}:urgent`;
        const prev = log.sent[urgKey] && typeof log.sent[urgKey] === 'object'
          ? log.sent[urgKey]
          : { count: 0, lastSent: null };
        log.sent[urgKey] = { count: prev.count || 0, lastSent: now };
      }
    } else if (trigger === 'urgent') {
      const urgKey = `${rcpKey}:${item.itemKey}:urgent`;
      const prev = log.sent[urgKey] && typeof log.sent[urgKey] === 'object'
        ? log.sent[urgKey]
        : { count: 0, lastSent: null };
      log.sent[urgKey] = { count: prev.count + 1, lastSent: now };
    } else if (trigger === 'compliance') {
      log.sent[`${rcpKey}:${item.itemKey}:compliance`] = now;
    }
  }
}

async function sendBatchEmail({ transporter, emailConfig, appName, recipient, items, subject, headline, badgeLabel, badgeColor }) {
  if (!items.length) return false;
  const html = buildProcurementReminderHtml({
    items,
    appName,
    headline,
    badgeLabel,
    badgeColor,
  });
  const user = String(emailConfig.gmail.user || '').trim().toLowerCase();
  const logoAttachment = buildLogoAttachment();
  await transporter.sendMail({
    from: `${appName} <${user}>`,
    to: recipient.email,
    subject,
    html,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
  return true;
}

function loadContractorRecords(dataDir) {
  if (!dataDir) return [];
  try {
    const root = path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME);
    if (!fs.existsSync(root)) return [];
    return createContractorRegistryService({ dataDir }).listRecords();
  } catch {
    return [];
  }
}

function collectReminderItems({ dataDir, projects, proskliseis }) {
  return calendarEventsBuilder.collectAllCalendarReminderItems({
    dataDir,
    projects,
    proskliseis,
    contractorRecords: loadContractorRecords(dataDir),
  });
}

async function checkAndSendProcurementCalendarReminders({ dataDir, loadUsers, loadAllProjects, loadAllProskliseis }) {
  const config = loadCalendarConfig(dataDir);
  if (config.enabled !== true) return { checked: true, sent: 0, skipped: 'disabled' };

  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) return { checked: true, sent: 0, skipped: 'email_not_configured' };

  const users = loadUsers();
  const recipients = resolveRecipients(config, users);
  if (!recipients.length) return { checked: true, sent: 0, skipped: 'no_recipients' };

  const projects = await loadAllProjects();
  const proskliseis = typeof loadAllProskliseis === 'function' ? (await loadAllProskliseis()) : [];
  const allItems = collectReminderItems({ dataDir, projects, proskliseis });
  if (!allItems.length) return { checked: true, sent: 0, skipped: 'no_deadlines' };

  const log = loadReminderLog(dataDir);
  if (!log.sent || typeof log.sent !== 'object') log.sent = {};

  const transporter = createTransporter(emailConfig);
  const appName = getAppDisplayName(emailConfig);
  let sentCount = 0;

  for (const recipient of recipients) {
    // Ώρες ησυχίας: δεν στέλνουμε τώρα· το catch-up θα καλύψει στην επόμενη εκτέλεση εκτός ωρών.
    if (isWithinQuietHours(recipient.notificationPreferences)) continue;

    const { thresholdItems, urgentItems, complianceItems } = collectItemsForRecipient(
      allItems,
      recipient,
      config,
      log
    );

    let recipientSent = false;

    if (thresholdItems.length) {
      try {
        const ok = await sendBatchEmail({
          transporter,
          emailConfig,
          appName,
          recipient,
          items: thresholdItems,
          subject: `📅 ${appName} · ${thresholdItems.length} προθεσμί${thresholdItems.length === 1 ? 'α' : 'ες'} ημερολογίου`,
          headline: `Υπενθύμιση προθεσμιών (${recipient.fullName || recipient.username})`,
          badgeLabel: 'Προθεσμία',
          badgeColor: '#059669',
        });
        if (ok) {
          markSentKeys(log, thresholdItems, 'threshold', recipient);
          sentCount += 1;
          recipientSent = true;
          appendEmailHistory(dataDir, {
            category: 'calendar',
            type: 'threshold',
            recipientEmail: recipient.email,
            recipientName: recipient.fullName || recipient.username,
            itemCount: thresholdItems.length,
            items: thresholdItems.slice(0, 5).map(i => ({ title: i.subprojectTitle, daysLeft: i.daysLeft })),
          });
        }
      } catch (err) {
        console.error('[calendar] threshold reminder failed:', err.message);
      }
    }

    if (urgentItems.length) {
      try {
        const ok = await sendBatchEmail({
          transporter,
          emailConfig,
          appName,
          recipient,
          items: urgentItems,
          subject: `⚠ ${appName} · ${urgentItems.length} επείγουσ${urgentItems.length === 1 ? 'α' : 'ες'} προθεσμί${urgentItems.length === 1 ? 'α' : 'ες'}`,
          headline: `Επείγουσες προθεσμίες (${recipient.fullName || recipient.username})`,
          badgeLabel: 'Επείγον',
          badgeColor: '#dc2626',
        });
        if (ok) {
          markSentKeys(log, urgentItems, 'urgent', recipient);
          sentCount += 1;
          recipientSent = true;
          appendEmailHistory(dataDir, {
            category: 'calendar',
            type: 'urgent',
            recipientEmail: recipient.email,
            recipientName: recipient.fullName || recipient.username,
            itemCount: urgentItems.length,
            items: urgentItems.slice(0, 5).map(i => ({ title: i.subprojectTitle, daysLeft: i.daysLeft })),
          });
        }
      } catch (err) {
        console.error('[calendar] urgent reminder failed:', err.message);
      }
    }

    if (complianceItems.length) {
      try {
        const ok = await sendBatchEmail({
          transporter,
          emailConfig,
          appName,
          recipient,
          items: complianceItems,
          subject: `⚠ ${appName} · ${complianceItems.length} παράβασ${complianceItems.length === 1 ? 'η' : 'εις'} κανόνα 12 μηνών`,
          headline: `Ειδοποίηση παραβίασης 12μήνου (${recipient.fullName || recipient.username})`,
          badgeLabel: 'Συμμόρφωση',
          badgeColor: '#b45309',
        });
        if (ok) {
          markSentKeys(log, complianceItems, 'compliance', recipient);
          sentCount += 1;
          recipientSent = true;
          appendEmailHistory(dataDir, {
            category: 'calendar',
            type: 'compliance',
            recipientEmail: recipient.email,
            recipientName: recipient.fullName || recipient.username,
            itemCount: complianceItems.length,
            items: complianceItems.slice(0, 5).map(i => ({ title: i.subprojectTitle })),
          });
        }
      } catch (err) {
        console.error('[calendar] compliance reminder failed:', err.message);
      }
    }

    // Άμεση αποθήκευση μετά από επιτυχή αποστολή — λιγότερος κίνδυνος διπλής αποστολής αν κρασάρει στη μέση.
    if (recipientSent) saveReminderLog(dataDir, log);
  }

  return { checked: true, sent: sentCount };
}

async function sendTestProcurementCalendarReminder({ dataDir, loadUsers, loadAllProjects, loadAllProskliseis, toEmail }) {
  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) return { success: false, error: 'Το email δεν έχει ρυθμιστεί' };

  const target = String(toEmail || '').trim().toLowerCase();
  if (!target.includes('@')) return { success: false, error: 'Μη έγκυρη διεύθυνση email' };

  const projects = await loadAllProjects();
  const proskliseis = typeof loadAllProskliseis === 'function' ? (await loadAllProskliseis()) : [];
  const allItems = collectReminderItems({ dataDir, projects, proskliseis });
  const upcoming = allItems
    .filter((d) => d.daysLeft != null && d.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const sample = upcoming.length
    ? upcoming.slice(0, 5)
    : [{
      subprojectTitle: '(Δοκιμαστική εγγραφή — δεν βρέθηκαν επερχόμενες προθεσμίες)',
      adam: '26PROC018492003',
      label: 'Καταληκτική υποβολής προσφορών',
      eventType: EVENT_TYPES.DEADLINE,
      deadlineIso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      daysLeft: 3,
    }];

  const appName = getAppDisplayName(emailConfig);
  const transporter = createTransporter(emailConfig);
  const user = String(emailConfig.gmail.user || '').trim().toLowerCase();
  const headline = upcoming.length
    ? 'Δοκιμαστική υπενθύμιση — επερχόμενες προθεσμίες ημερολογίου'
    : 'Δοκιμαστική υπενθύμιση — δείγμα (χωρίς επερχόμενες προθεσμίες)';

  const html = buildProcurementReminderHtml({
    items: sample,
    appName,
    headline,
    badgeLabel: 'Δοκιμή',
    badgeColor: '#6366f1',
  });

  await transporter.sendMail({
    from: `${appName} <${user}>`,
    to: target,
    subject: `📅 ${appName} · Δοκιμαστική υπενθύμιση ημερολογίου`,
    html,
    attachments: (() => {
      const logoAttachment = buildLogoAttachment();
      return logoAttachment ? [logoAttachment] : [];
    })(),
  });

  return { success: true };
}

/** @deprecated Χρήση calendarEventsBuilder.collectProcurementItems */
function collectActiveDeadlines(projects) {
  return calendarEventsBuilder.collectProcurementItems(projects).map((item) => ({
    project: item.project,
    subprojectId: item.subprojectId,
    subprojectTitle: item.subprojectTitle,
    projectTitle: item.projectTitle,
    adam: item.adam,
    deadlineIso: item.deadlineIso,
    daysLeft: item.daysLeft,
    urgency: item.daysLeft < 0 ? 'past' : item.daysLeft <= 7 ? 'urgent' : item.daysLeft <= 30 ? 'soon' : 'normal',
  }));
}

module.exports = {
  collectActiveDeadlines,
  checkAndSendProcurementCalendarReminders,
  sendTestProcurementCalendarReminder,
  resolveRecipients,
  loadReminderLog,
  loadEmailHistory,
  appendEmailHistory,
  daysUntilDate,
  formatDateEl,
  pickThresholdTriggers,
  collectItemsForRecipient,
  markSentKeys,
  isWithinQuietHours,
};
