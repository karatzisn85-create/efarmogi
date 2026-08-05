/**
 * Υπενθυμίσεις ΑΕΠΟ για Ωρίμανση Έργων — email + alerts για Dashboard.
 *
 * Dedup: ανά πρόταση + κατώφλι ημερών (όχι ανά ημερομηνία αποστολής).
 * Catch-up: ίδια λογική με το ημερολόγιο προθεσμιών (pickThresholdTriggers).
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const {
  loadEmailConfig,
  isConfigured,
  createTransporter,
  escapeHtml,
  getAppDisplayName,
} = require('./taskAssignmentEmailService');
const { loadOrimanthiConfig } = require('./orimanthiConfigService');
const {
  pickThresholdTriggers,
  isWithinQuietHours,
} = require('./procurementCalendarReminderService');

const REMINDER_LOG_FILE = 'orimanthi-aepo-reminder-log.json';

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
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function formatDateEl(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Κλειδί ιστορικού ανά πρόταση + κατώφλι (όχι ανά ημερομηνία αποστολής). */
function reminderKey(proposalId, daysBefore) {
  return `${proposalId}:${daysBefore}`;
}

/** Κλειδί ανά παραλήπτη ώστε quiet hours / aepoEmail να μην «καίνε» άλλους. */
function recipientReminderKey(recipientEmail, proposalId, daysBefore) {
  const em = String(recipientEmail || '').trim().toLowerCase();
  return `${em}:${reminderKey(proposalId, daysBefore)}`;
}

function computeAepoAlerts(proposals, { maxDays = 90, limit = 0 } = {}) {
  const rows = [];
  for (const p of proposals || []) {
    if (!p.aepoRenewalDate) continue;
    const daysLeft = daysUntilDate(p.aepoRenewalDate);
    if (daysLeft === null || daysLeft < 0 || daysLeft > maxDays) continue;
    rows.push({
      id: p.id,
      title: p.title || '(Χωρίς τίτλο)',
      aepoRenewalDate: p.aepoRenewalDate,
      daysLeft,
      status: p.status || '',
      projectCategory: p.projectCategory || '',
    });
  }
  rows.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title, 'el'));
  const total = rows.length;
  if (limit > 0) {
    return { alerts: rows.slice(0, limit), total };
  }
  return { alerts: rows, total };
}

/**
 * Παραλήπτες ΑΕΠΟ: ADMIN/SUPERADMIN (+ extra emails από config).
 * Τηρεί aepoEmail · δεν εξαιρεί ακόμα quiet hours (γίνεται ανά αποστολή).
 */
function resolveRecipientUsers(config, users) {
  const out = [];
  const seen = new Set();
  const aepoCfg = config?.aepoReminders || {};

  if (aepoCfg.useAdminEmails !== false) {
    for (const u of users || []) {
      if (!u.active || !u.approved) continue;
      if (u.role !== 'ADMIN' && u.role !== 'SUPERADMIN') continue;
      if (u.notificationPreferences?.aepoEmail === false) continue;
      const em = String(u.email || '').trim().toLowerCase();
      if (!em.includes('@') || seen.has(em)) continue;
      seen.add(em);
      out.push({
        email: em,
        fullName: u.fullName || u.username || em,
        username: u.username || '',
        notificationPreferences: u.notificationPreferences || {},
      });
    }
  }

  for (const raw of aepoCfg.recipientEmails || []) {
    const em = String(raw || '').trim().toLowerCase();
    if (!em.includes('@') || seen.has(em)) continue;
    seen.add(em);
    out.push({
      email: em,
      fullName: em,
      username: '',
      notificationPreferences: {},
    });
  }

  return out;
}

/** @deprecated Χρησιμοποιήστε resolveRecipientUsers — κρατείται για συμβατότητα. */
function resolveRecipientEmails(config, users) {
  return resolveRecipientUsers(config, users).map((r) => r.email);
}

function getSentThresholdsForProposal(log, recipientEmail, proposalId) {
  const sent = [];
  const em = String(recipientEmail || '').trim().toLowerCase();
  const prefix = `${em}:${proposalId}:`;
  const legacyPrefix = `${proposalId}:`;
  for (const key of Object.keys(log?.sent || {})) {
    if (key.startsWith(prefix)) {
      const thr = Number(key.slice(prefix.length));
      if (Number.isFinite(thr)) sent.push(thr);
      continue;
    }
    // Παλιά κλειδιά χωρίς email (πριν το per-recipient): μετράνε για όλους.
    if (key.startsWith(legacyPrefix) && !key.includes('@')) {
      const rest = key.slice(legacyPrefix.length);
      if (/^\d+$/.test(rest)) {
        const thr = Number(rest);
        if (Number.isFinite(thr)) sent.push(thr);
      }
    }
  }
  return sent;
}

/**
 * Ποια ζεύγη (πρόταση, κατώφλι) πρέπει να σταλούν σε έναν παραλήπτη τώρα.
 * @returns {Map<number, object[]>} threshold → proposals
 */
function collectAepoBatchesForRecipient(proposals, thresholds, log, recipientEmail) {
  const byThreshold = new Map();
  for (const p of proposals || []) {
    if (!p?.id || !p.aepoRenewalDate) continue;
    const daysLeft = daysUntilDate(p.aepoRenewalDate);
    if (daysLeft === null || daysLeft < 0) continue;
    const sentThr = getSentThresholdsForProposal(log, recipientEmail, p.id);
    const toSend = pickThresholdTriggers(daysLeft, thresholds, sentThr);
    for (const thr of toSend) {
      if (!byThreshold.has(thr)) byThreshold.set(thr, []);
      byThreshold.get(thr).push(p);
    }
  }
  return byThreshold;
}

function buildAepoEmailHtml({ proposals, thresholdDays, appName }) {
  const rows = proposals.map((p) => {
    const daysLeft = daysUntilDate(p.aepoRenewalDate);
    const urgency = daysLeft <= 30 ? '#dc2626' : daysLeft <= 60 ? '#d97706' : '#4338ca';
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(p.title || '(Χωρίς τίτλο)')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${escapeHtml(formatDateEl(p.aepoRenewalDate))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:${urgency};font-weight:700">${daysLeft} ημέρες</td>
    </tr>`;
  }).join('');
  return `
<div style="font-family:Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#4338ca,#6366f1);padding:16px 20px;border-radius:10px;margin-bottom:16px">
    <h2 style="color:#fff;margin:0;font-size:1.1rem">🔔 Υπενθύμιση ΑΕΠΟ — ${thresholdDays} ημέρες πριν τη λήξη</h2>
  </div>
  <p style="color:#475569;font-size:0.92rem;line-height:1.5;margin:0 0 14px">
    Τα παρακάτω έργα ωρίμανσης έχουν ημερομηνία ανανέωσης ΑΕΠΟ εντός <strong>${thresholdDays} ημερών</strong>.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:8px 10px;text-align:left">Έργο</th>
        <th style="padding:8px 10px;text-align:center">ΑΕΠΟ</th>
        <th style="padding:8px 10px;text-align:center">Απομένουν</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#94a3b8;font-size:0.78rem;margin:16px 0 0">${escapeHtml(appName)} · Ωρίμανση Έργων</p>
</div>`;
}

async function checkAndSendAepoReminders({ dataDir, loadUsers, loadAllProposals }) {
  const config = loadOrimanthiConfig(dataDir);
  const aepoCfg = config.aepoReminders || {};
  if (aepoCfg.enabled === false) return { checked: true, sent: 0 };

  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) return { checked: true, sent: 0, skipped: 'email_not_configured' };

  const proposals = loadAllProposals();
  const users = loadUsers();
  const recipients = resolveRecipientUsers(config, users);
  if (!recipients.length) return { checked: true, sent: 0, skipped: 'no_recipients' };

  const thresholds = [...(aepoCfg.daysBefore || [30, 60, 90])]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => b - a);

  const log = loadReminderLog(dataDir);
  if (!log.sent || typeof log.sent !== 'object') log.sent = {};

  let sentCount = 0;
  const transporter = createTransporter(emailConfig);
  const appName = getAppDisplayName(emailConfig);
  const fromUser = String(emailConfig.gmail.user || '').trim().toLowerCase();

  for (const recipient of recipients) {
    if (isWithinQuietHours(recipient.notificationPreferences)) continue;

    const batches = collectAepoBatchesForRecipient(
      proposals,
      thresholds,
      log,
      recipient.email
    );

    const sortedThresholds = [...batches.keys()].sort((a, b) => b - a);
    for (const threshold of sortedThresholds) {
      const matching = batches.get(threshold) || [];
      const pending = matching.filter(
        (p) => !log.sent[recipientReminderKey(recipient.email, p.id, threshold)]
      );
      if (!pending.length) continue;

      const html = buildAepoEmailHtml({
        proposals: pending,
        thresholdDays: threshold,
        appName,
      });
      try {
        await transporter.sendMail({
          from: `${appName} <${fromUser}>`,
          to: recipient.email,
          subject: `🔔 ΑΕΠΟ — ${pending.length} έργ${pending.length === 1 ? 'ο' : 'α'} λήγουν εντός ${threshold} ημερών`,
          html,
        });
        const now = new Date().toISOString();
        for (const p of pending) {
          log.sent[recipientReminderKey(recipient.email, p.id, threshold)] = now;
        }
        sentCount += 1;
      } catch (err) {
        console.error('[orimanthi] AEPO reminder email failed:', err.message);
      }
    }
  }

  if (sentCount > 0) saveReminderLog(dataDir, log);
  return { checked: true, sent: sentCount };
}

module.exports = {
  computeAepoAlerts,
  checkAndSendAepoReminders,
  daysUntilDate,
  formatDateEl,
  resolveRecipientEmails,
  resolveRecipientUsers,
  reminderKey,
  recipientReminderKey,
  collectAepoBatchesForRecipient,
  getSentThresholdsForProposal,
  loadReminderLog,
};
