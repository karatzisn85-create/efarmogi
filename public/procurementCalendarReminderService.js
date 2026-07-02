/**
 * Email υπενθυμίσεις Ημερολογίου Προθεσμιών (Φάση 3γ).
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const { loadCalendarConfig, isNotifyEventTypeEnabled } = require('./calendarConfigService');
const {
  loadEmailConfig,
  isConfigured,
  createTransporter,
  escapeHtml,
  getAppDisplayName,
  buildEmailHtml,
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

const REMINDER_LOG_FILE = 'procurement-calendar-reminder-log.json';

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

function daysUntilDate(isoDate) {
  return daysUntilKhmdhsDate(isoDate);
}

function formatDateEl(iso) {
  return formatKhmdhsDateTimeEl(iso);
}

function roleMatchesRecipientRoles(role, recipientRoles) {
  const r = String(role || '').trim().toUpperCase();
  const roles = new Set((recipientRoles || []).map((x) => String(x || '').trim().toUpperCase()));
  if (r === 'SUPERADMIN') return roles.has('ADMIN');
  return roles.has(r);
}

function resolveRecipients(config, users) {
  const cfg = config || {};
  const byUsername = new Map();
  const explicit = new Set(
    (cfg.recipientUsernames || []).map((u) => String(u || '').trim().toLowerCase()).filter(Boolean)
  );

  for (const user of users || []) {
    if (!user?.active || !user.approved) continue;
    const email = String(user.email || '').trim();
    if (!email.includes('@')) continue;
    const username = String(user.username || '').trim().toLowerCase();
    if (!username) continue;

    const explicitPick = explicit.has(username);
    const rolePick = roleMatchesRecipientRoles(user.role, cfg.recipientRoles);
    if (!explicitPick && !rolePick) continue;

    byUsername.set(username, {
      username,
      email: email.toLowerCase(),
      role: user.role,
      fullName: user.fullName || user.username,
      assignedSupervisors: Array.isArray(user.assignedSupervisors) ? user.assignedSupervisors : [],
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
    footnote: 'Άνοιξε το ERGOHUB → Ημερολόγιο Προθεσμιών για λεπτομέρειες και άμεση πρόσβαση στα υποέργα.',
    useCidLogo: true,
  });
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (60 * 60 * 1000);
}

function collectItemsForRecipient(items, recipient, config, log) {
  const thresholdItems = [];
  const urgentItems = [];
  const complianceItems = [];
  const daysBefore = [...(config.daysBefore || [])]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0);

  const visible = calendarEventsBuilder.filterItemsForRecipient(items, recipient);

  for (const item of visible) {
    if (!isNotifyEventTypeEnabled(config, item.eventType)) continue;

    if (item.eventType === EVENT_TYPES.COMPLIANCE_12M) {
      const key = `${item.itemKey}:compliance`;
      if (!log.sent[key]) complianceItems.push({ ...item, trigger: 'compliance' });
      continue;
    }

    const { daysLeft } = item;
    if (daysLeft == null || daysLeft < 0) continue;

    let addedToThresholdThisRun = false;
    for (const db of daysBefore) {
      if (daysLeft === db) {
        const key = `${item.itemKey}:d:${db}`;
        if (!log.sent[key]) {
          thresholdItems.push({ ...item, trigger: 'threshold', daysBefore: db });
          addedToThresholdThisRun = true;
        }
      }
    }

    const urgCfg = config.urgentRepeat || {};
    if (!addedToThresholdThisRun && urgCfg.enabled !== false && daysLeft >= 0 && daysLeft < 7) {
      const urgKey = `${item.itemKey}:urgent`;
      const urg = log.sent[urgKey] && typeof log.sent[urgKey] === 'object'
        ? log.sent[urgKey]
        : { count: 0, lastSent: null };
      const maxCount = Number(urgCfg.maxCount) || 3;
      const intervalHours = Number(urgCfg.intervalHours) || 24;
      if (urg.count < maxCount && hoursSince(urg.lastSent) >= intervalHours) {
        urgentItems.push({ ...item, trigger: 'urgent' });
      }
    }
  }

  return { thresholdItems, urgentItems, complianceItems };
}

function markSentKeys(log, items, trigger) {
  const now = new Date().toISOString();
  for (const item of items) {
    if (trigger === 'threshold') {
      log.sent[`${item.itemKey}:d:${item.daysBefore}`] = now;
    } else if (trigger === 'urgent') {
      const urgKey = `${item.itemKey}:urgent`;
      const prev = log.sent[urgKey] && typeof log.sent[urgKey] === 'object'
        ? log.sent[urgKey]
        : { count: 0, lastSent: null };
      log.sent[urgKey] = { count: prev.count + 1, lastSent: now };
    } else if (trigger === 'compliance') {
      log.sent[`${item.itemKey}:compliance`] = now;
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
  await transporter.sendMail({
    from: `${appName} <${user}>`,
    to: recipient.email,
    subject,
    html,
  });
  return true;
}

async function checkAndSendProcurementCalendarReminders({ dataDir, loadUsers, loadAllProjects }) {
  const config = loadCalendarConfig(dataDir);
  if (config.enabled !== true) return { checked: true, sent: 0, skipped: 'disabled' };

  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) return { checked: true, sent: 0, skipped: 'email_not_configured' };

  const users = loadUsers();
  const recipients = resolveRecipients(config, users);
  if (!recipients.length) return { checked: true, sent: 0, skipped: 'no_recipients' };

  const projects = await loadAllProjects();
  const allItems = calendarEventsBuilder.collectAllCalendarReminderItems({ dataDir, projects });
  if (!allItems.length) return { checked: true, sent: 0, skipped: 'no_deadlines' };

  const log = loadReminderLog(dataDir);
  if (!log.sent || typeof log.sent !== 'object') log.sent = {};

  const transporter = createTransporter(emailConfig);
  const appName = getAppDisplayName(emailConfig);
  let sentCount = 0;

  for (const recipient of recipients) {
    const { thresholdItems, urgentItems, complianceItems } = collectItemsForRecipient(
      allItems,
      recipient,
      config,
      log
    );

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
          markSentKeys(log, thresholdItems, 'threshold');
          sentCount += 1;
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
          markSentKeys(log, urgentItems, 'urgent');
          sentCount += 1;
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
          markSentKeys(log, complianceItems, 'compliance');
          sentCount += 1;
        }
      } catch (err) {
        console.error('[calendar] compliance reminder failed:', err.message);
      }
    }
  }

  if (sentCount > 0) saveReminderLog(dataDir, log);
  return { checked: true, sent: sentCount };
}

async function sendTestProcurementCalendarReminder({ dataDir, loadUsers, loadAllProjects, toEmail }) {
  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) return { success: false, error: 'Το email δεν έχει ρυθμιστεί' };

  const target = String(toEmail || '').trim().toLowerCase();
  if (!target.includes('@')) return { success: false, error: 'Μη έγκυρη διεύθυνση email' };

  const projects = await loadAllProjects();
  const allItems = calendarEventsBuilder.collectAllCalendarReminderItems({ dataDir, projects });
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
  daysUntilDate,
  formatDateEl,
};
