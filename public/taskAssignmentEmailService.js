/**
 * Email notification service για Χώρο Εργασίας.
 * Χρησιμοποιεί Gmail SMTP μέσω nodemailer.
 * Config αποθηκεύεται στο {dataDir}/config/email-config.json
 */

const path = require('path');
const fs = require('fs');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'email-config.json';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const BRAND = {
  name: 'ergoHub',
  tagline: 'Χώρος Εργασίας',
  navy: '#1a2a3a',
  navyMid: '#2c3e50',
  accent: '#3b82f6',
  accentSoft: '#eff6ff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  bg: '#f1f5f9'
};

/** Μικρό logo μόνο για email (<80KB) — το πλήρες PNG (~1.7MB) προκαλεί Gmail clipping (>102KB). */
const MAX_LOGO_BYTES = 80 * 1024;
const LOGO_CID = 'ergohub-logo@ergohub';
let cachedLogoPath = undefined;

function getLogoFilePath() {
  if (cachedLogoPath !== undefined) return cachedLogoPath;
  const candidates = [
    path.join(__dirname, 'assets', 'ergohub-logo-email.png'),
    path.join(__dirname, '..', 'src', 'assets', 'ergohub-logo-email.png')
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const size = fs.statSync(p).size;
      if (size > MAX_LOGO_BYTES) {
        console.warn(`[emailService] Logo skipped (too large for email): ${p} (${size} bytes)`);
        continue;
      }
      cachedLogoPath = p;
      return cachedLogoPath;
    } catch {}
  }
  cachedLogoPath = null;
  return null;
}

function getConfigPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, CONFIG_FILE);
}

function loadEmailConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch {
    return defaultConfig();
  }
}

function saveEmailConfig(dataDir, config) {
  const dir = path.join(dataDir, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(dataDir), JSON.stringify(config, null, 2), 'utf8');
}

function defaultConfig() {
  return {
    gmail: {
      user: '',
      appPassword: '',
      fromName: 'ergoHub'
    }
  };
}

function normalizeGmailUser(raw) {
  let u = String(raw || '').trim().toLowerCase();
  if (!u) return '';
  if (!u.includes('@')) u = `${u}@gmail.com`;
  return u;
}

function normalizeAppPassword(raw) {
  return String(raw || '').replace(/\s+/g, '').trim();
}

function isConfigured(config) {
  const user = normalizeGmailUser(config?.gmail?.user);
  const pass = normalizeAppPassword(config?.gmail?.appPassword);
  return !!(user && pass && user.includes('@'));
}

function createTransporter(config) {
  const nodemailer = require('nodemailer');
  const user = normalizeGmailUser(config.gmail.user);
  const pass = normalizeAppPassword(config.gmail.appPassword);
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAppDisplayName(emailConfig) {
  const n = String(emailConfig?.gmail?.fromName || '').trim();
  return n || BRAND.name;
}

function getRecipientEmails(task, allUsers, options = {}) {
  const exclude = new Set(
    (options.excludeUsernames || []).map((x) => String(x || '').toLowerCase())
  );
  const participants = new Set([task.createdBy, ...(task.assignees || [])]);
  const emails = [];
  for (const username of participants) {
    if (exclude.has(String(username || '').toLowerCase())) continue;
    const user = allUsers.find((u) => u.username?.toLowerCase() === username?.toLowerCase());
    if (user?.email && user.email.includes('@')) {
      emails.push(user.email.trim());
    }
  }
  return [...new Set(emails)];
}

function formatUserLabel(allUsers, username) {
  const u = allUsers.find((x) => x.username?.toLowerCase() === String(username || '').toLowerCase());
  if (u?.fullName) return escapeHtml(`${u.fullName}`);
  return escapeHtml(username || '—');
}

/**
 * Λιτό, ευανάγνωστο HTML template για όλες τις ειδοποιήσεις.
 */
function buildEmailHtml({
  appName,
  badgeLabel,
  badgeColor,
  headline,
  workspaceTitle,
  rows = [],
  footnote,
  useCidLogo = false
}) {
  const name = escapeHtml(appName || BRAND.name);
  const logoSrc = useCidLogo ? `cid:${LOGO_CID}` : null;
  const logoBlock = logoSrc
    ? `<img src="${logoSrc}" alt="${name}" style="display:block;max-height:48px;max-width:180px;width:auto;height:auto;border:0;" />`
    : `<span style="font-size:20px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.3px;">${name}</span>`;

  const badgeBg = badgeColor || BRAND.accent;
  const rowsHtml = rows
    .filter((r) => r && (r.value || r.value === 0))
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0 10px 0;color:${BRAND.textMuted};font-size:13px;width:120px;vertical-align:top;font-weight:600;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0 10px 0;color:${BRAND.text};font-size:14px;line-height:1.5;vertical-align:top;">${r.value}</td>
      </tr>`
    )
    .join('');

  const footnoteBlock = footnote
    ? `<p style="margin:16px 0 0 0;color:${BRAND.textMuted};font-size:12px;line-height:1.55;">${footnote}</p>`
    : '';

  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 4px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:24px 28px 20px 28px;border-bottom:1px solid ${BRAND.border};background:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">${logoBlock}</td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 12px;border-radius:20px;background:${badgeBg};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(badgeLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(BRAND.tagline)}</p>
              <h1 style="margin:0 0 20px 0;font-size:20px;font-weight:700;color:${BRAND.text};line-height:1.35;">${escapeHtml(headline)}</h1>
              <div style="background:${BRAND.accentSoft};border-left:4px solid ${BRAND.accent};border-radius:8px;padding:16px 18px;margin-bottom:20px;">
                <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:${BRAND.accent};text-transform:uppercase;letter-spacing:0.05em;">Χώρος εργασίας</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:${BRAND.text};line-height:1.4;">${escapeHtml(workspaceTitle)}</p>
              </div>
              ${rowsHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">${rowsHtml}</table>` : ''}
              ${footnoteBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px 28px;background:${BRAND.bg};border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:11px;color:${BRAND.textMuted};line-height:1.5;text-align:center;">
                Αυτόματη ειδοποίηση · <strong style="color:${BRAND.navyMid};">${name}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSubject(appName, kind, workspaceTitle) {
  const prefix = appName || BRAND.name;
  const title = String(workspaceTitle || '').trim();
  const short = title.length > 50 ? `${title.slice(0, 47)}…` : title;
  if (kind === 'created') return `${prefix} · Νέος χώρος εργασίας · ${short}`;
  if (kind === 'activity') return `${prefix} · Νέα δραστηριότητα · ${short}`;
  return `${prefix} · Δοκιμαστική ειδοποίηση`;
}

/**
 * Αποστολή email κατά τη δημιουργία νέου χώρου εργασίας.
 */
async function sendWorkspaceCreatedEmail(task, allUsers, emailConfig) {
  if (!isConfigured(emailConfig)) return { skipped: true, reason: 'Email δεν έχει ρυθμιστεί' };
  if (!task.emailNotifications) return { skipped: true, reason: 'Ειδοποιήσεις email ανενεργές για αυτόν τον χώρο' };

  const recipients = getRecipientEmails(task, allUsers, {
    excludeUsernames: [task.createdBy]
  });
  if (!recipients.length) return { skipped: true, reason: 'Δεν βρέθηκαν email παραληπτών' };

  const appName = getAppDisplayName(emailConfig);
  const rows = [
    { label: 'Δημιουργός', value: formatUserLabel(allUsers, task.createdBy) }
  ];
  if (task.description?.trim()) {
    const desc = task.description.trim();
    const excerpt = desc.length > 280 ? `${desc.slice(0, 277)}…` : desc;
    rows.push({ label: 'Περιγραφή', value: `<span style="color:${BRAND.text};">${escapeHtml(excerpt)}</span>` });
  }
  if (task.dueDate) {
    const due = task.dueTime ? `${task.dueDate} · ${task.dueTime}` : task.dueDate;
    rows.push({ label: 'Προθεσμία', value: escapeHtml(due) });
  }

  const html = buildEmailHtml({
    appName,
    badgeLabel: 'Νέος χώρος',
    badgeColor: '#059669',
    headline: 'Προσκλήθηκες σε νέο χώρο εργασίας',
    workspaceTitle: task.title,
    rows,
    footnote: 'Άνοιξε την εφαρμογή ergoHub για να δεις λεπτομέρειες και να συνεργαστείς με την ομάδα.',
    useCidLogo: true
  });

  return sendToAll(
    recipients,
    buildSubject(appName, 'created', task.title),
    html,
    emailConfig
  );
}

/**
 * Αποστολή email για νέο σχόλιο ή αρχείο (rate limit 2 ωρών).
 */
async function sendWorkspaceActivityEmail(task, actor, messageText, allUsers, emailConfig) {
  if (!isConfigured(emailConfig)) return { skipped: true, reason: 'Email δεν έχει ρυθμιστεί' };
  if (!task.emailNotifications) return { skipped: true, reason: 'Ειδοποιήσεις email ανενεργές για αυτόν τον χώρο' };

  if (task.lastEmailSentAt) {
    const elapsed = Date.now() - new Date(task.lastEmailSentAt).getTime();
    if (elapsed < TWO_HOURS_MS) {
      const remaining = Math.ceil((TWO_HOURS_MS - elapsed) / 60000);
      return { skipped: true, reason: `Rate limit: επόμενο email σε ${remaining} λεπτά` };
    }
  }

  const recipients = getRecipientEmails(task, allUsers, { excludeUsernames: [actor] });
  console.log(`[emailService] activity check — task="${task.title}" emailNotifications=${task.emailNotifications} actor=${actor} recipients=[${recipients.join(', ')}]`);
  if (!recipients.length) return { skipped: true, reason: 'Δεν βρέθηκαν email παραληπτών' };

  const appName = getAppDisplayName(emailConfig);
  const excerpt = String(messageText || '').trim();
  const displayExcerpt = excerpt.length > 300 ? `${excerpt.slice(0, 297)}…` : excerpt;

  const html = buildEmailHtml({
    appName,
    badgeLabel: 'Ενημέρωση',
    badgeColor: BRAND.accent,
    headline: 'Υπάρχει νέα δραστηριότητα στον χώρο σου',
    workspaceTitle: task.title,
    rows: [
      { label: 'Από', value: formatUserLabel(allUsers, actor) },
      ...(displayExcerpt
        ? [{
            label: 'Μήνυμα',
            value: `<span style="color:${BRAND.text};font-style:italic;">«${escapeHtml(displayExcerpt)}»</span>`
          }]
        : [])
    ],
    footnote:
      'Συγκεντρωμένη ειδοποίηση (το πολύ ένα email κάθε 2 ώρες ανά χώρο). Άνοιξε τον χώρο στην εφαρμογή για όλη τη ροή.',
    useCidLogo: true
  });

  const result = await sendToAll(
    recipients,
    buildSubject(appName, 'activity', task.title),
    html,
    emailConfig
  );

  return { ...result, updatedLastEmailSentAt: new Date().toISOString() };
}

function buildLogoAttachment() {
  const logoPath = getLogoFilePath();
  if (!logoPath) return null;
  return {
    filename: 'ergohub-logo.png',
    path: logoPath,
    cid: LOGO_CID
  };
}

async function sendToAll(recipients, subject, html, emailConfig) {
  try {
    const transporter = createTransporter(emailConfig);
    const fromName = getAppDisplayName(emailConfig);
    const fromAddress = `"${fromName}" <${normalizeGmailUser(emailConfig.gmail.user)}>`;
    const logoAttachment = buildLogoAttachment();
    const attachments = logoAttachment ? [logoAttachment] : [];

    const errors = [];
    for (const to of recipients) {
      try {
        await transporter.sendMail({ from: fromAddress, to, subject, html, attachments });
        console.log(`[emailService] Sent "${subject}" to ${to}`);
      } catch (err) {
        console.error(`[emailService] Failed to send to ${to}:`, err.message);
        errors.push({ to, error: err.message });
      }
    }

    if (errors.length === recipients.length) {
      return { success: false, error: errors[0]?.error || 'Αποτυχία αποστολής' };
    }
    return { success: true, sentTo: recipients.filter((r) => !errors.some((e) => e.to === r)), errors };
  } catch (err) {
    console.error('[emailService] Transport error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Δοκιμαστικό email για admin.
 */
async function sendTestEmail(toAddress, emailConfig) {
  if (!isConfigured(emailConfig)) {
    return { success: false, error: 'Συμπληρώστε Gmail χρήστη και App Password πρώτα' };
  }

  const appName = getAppDisplayName(emailConfig);
  const html = buildEmailHtml({
    appName,
    badgeLabel: 'Έλεγχος',
    badgeColor: '#6366f1',
    headline: 'Η αποστολή email λειτουργεί σωστά',
    workspaceTitle: 'Δοκιμαστική ειδοποίηση',
    rows: [
      {
        label: 'Κατάσταση',
        value: `<span style="color:#059669;font-weight:600;">Έτοιμο για χρήση</span>`
      },
      {
        label: 'Επόμενο βήμα',
        value: `Ενεργοποίησε <strong>✉ Email ON</strong> στον κάθε χώρο εργασίας (από τον δημιουργό).`
      }
    ],
    footnote: 'Οι συμμετέχοντες λαμβάνουν email μόνο αν έχουν καταχωρημένη διεύθυνση στη Διαχείριση Χρηστών.',
    useCidLogo: true
  });

  return sendToAll(
    [toAddress],
    buildSubject(appName, 'test', ''),
    html,
    emailConfig
  );
}

module.exports = {
  loadEmailConfig,
  saveEmailConfig,
  isConfigured,
  createTransporter,
  getAppDisplayName,
  sendWorkspaceCreatedEmail,
  sendWorkspaceActivityEmail,
  sendTestEmail
};
