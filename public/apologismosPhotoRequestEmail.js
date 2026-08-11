/**
 * Αίτημα φωτογραφιών απολογισμού προς επιβλέποντα υποέργου (email).
 * Pure helpers + αποστολή μέσω υπάρχοντος SMTP (taskAssignmentEmailService).
 */

const {
  loadEmailConfig,
  isConfigured,
  createTransporter,
  escapeHtml,
  getAppDisplayName,
} = require('./taskAssignmentEmailService');

const { PHOTO_PHASE_LABELS_EL, requiredPhotoPhasesForVizIds, MAX_PHOTOS_PER_PHASE } = require('./apologismosDomain');

const ERGOHUB_APP_NAME = 'ERGOHUB';

function usernameFromChargeId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^user:/i.test(s)) return s.replace(/^user:/i, '').trim();
  return s;
}

function findUserByLooseUsername(users, username) {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return null;
  const list = Array.isArray(users) ? users : [];
  return list.find((u) => String(u?.username || '').trim().toLowerCase() === key) || null;
}

/**
 * Επιβλέπων από υποέργο: μόνο ο κύριος (πρώτο id χρέωσης), αλλιώς ελεύθερο όνομα (χωρίς email).
 * Δεν πέφτει σε συμμετέχοντα — ίδια λογική με την εμφάνιση κύριας χρέωσης στην κάρτα.
 * @returns {{ displayName: string, email: string, username: string } | null}
 */
function resolveSupervisorContact(subproject, users = []) {
  if (!subproject) return null;
  const ids = Array.isArray(subproject.supervisorEngineerIds)
    ? subproject.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const freePrimary = String(subproject.supervisorChargeFreePrimary || '').trim();
  const primaryId = ids[0] || '';

  if (primaryId) {
    const username = usernameFromChargeId(primaryId);
    const user = findUserByLooseUsername(users, username);
    if (user) {
      const email = String(user.email || '').trim();
      return {
        displayName: String(user.fullName || user.username || username).trim(),
        email: email.includes('@') ? email : '',
        username: String(user.username || username).trim(),
      };
    }
  }

  if (freePrimary) {
    return { displayName: freePrimary, email: '', username: '' };
  }

  const legacy = String(subproject.supervisor || '').trim();
  if (legacy) {
    return { displayName: legacy, email: '', username: '' };
  }

  return null;
}

function photoPhasesForCard(card) {
  return requiredPhotoPhasesForVizIds([
    card?.primaryViz,
    card?.secondaryViz,
  ].filter(Boolean));
}

function formatPhotoPhasesPhrase(phases) {
  const labels = (phases || [])
    .map((p) => PHOTO_PHASE_LABELS_EL[p] || p)
    .filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return `«${labels[0]}»`;
  if (labels.length === 2) return `«${labels[0]}» και «${labels[1]}»`;
  const head = labels.slice(0, -1).map((l) => `«${l}»`).join(', ');
  return `${head} και «${labels[labels.length - 1]}»`;
}

function formatPhotoPhasesRequestLines(phases) {
  const maxPerPhase = MAX_PHOTOS_PER_PHASE;
  const labels = (phases || [])
    .map((p) => PHOTO_PHASE_LABELS_EL[p] || p)
    .filter(Boolean);
  if (!labels.length) {
    return {
      summary: `Παρακαλούμε όπως μας αποστείλετε τις απαιτούμενες φωτογραφίες του έργου (έως ${maxPerPhase} φωτογραφίες ανά φάση).`,
      bullets: [],
      maxPerPhase,
    };
  }
  const phrase = formatPhotoPhasesPhrase(phases);
  return {
    summary: `Παρακαλούμε όπως μας αποστείλετε φωτογραφίες για τις φάσεις ${phrase}.`,
    bullets: labels.map((label) => `Φάση «${label}»: έως ${maxPerPhase} φωτογραφίες`),
    maxPerPhase,
  };
}

function greetingName(displayName) {
  const name = String(displayName || '').trim();
  if (!name) return 'Αγαπητέ/ή συνάδελφε';
  return `Αγαπητέ/ή κ. ${name}`;
}

/** Συντόμευση για θέμα email (εύκολη αναζήτηση χωρίς υπερβολικό μήκος). */
function truncateForSubject(text, max = 100) {
  const s = String(text || '').trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1)).trim()}…`;
}

/**
 * Σύνταξη θέματος + HTML για αίτημα φωτογραφιών.
 */
function buildPhotoRequestEmailContent({
  supervisorDisplayName,
  periodLabel,
  projectTitle,
  subprojectTitle,
  phases,
  optionalDeadline = '',
  optionalNote = '',
  senderDisplayName = '',
  senderOrg = '',
}) {
  const period = String(periodLabel || '').trim() || 'την επιλεγμένη δημοτική περίοδο';
  const praxis = String(projectTitle || '').trim();
  const sub = String(subprojectTitle || '').trim() || '—';
  const phasesPhrase = formatPhotoPhasesPhrase(phases);
  const phaseRequest = formatPhotoPhasesRequestLines(phases);
  const deadline = String(optionalDeadline || '').trim();
  const note = String(optionalNote || '').trim();
  const sender = String(senderDisplayName || '').trim();
  const org = String(senderOrg || '').trim();

  const subForSubject = truncateForSubject(sub === '—' ? '' : sub, 100);
  const subject = String(
    subForSubject
      ? `Αίτημα φωτογραφιών — ${subForSubject}`
      : `Αίτημα φωτογραφιών υποέργου — Απολογισμός Τεχνικού Έργου — ${period}`
  ).replace(/[\r\n]+/g, ' ').trim();

  const phasesLine = phaseRequest.summary;
  const phasesBulletText = phaseRequest.bullets.length
    ? phaseRequest.bullets.map((b) => `• ${b}`).join('\n')
    : null;
  const limitReminder = `Όριο: έως ${phaseRequest.maxPerPhase} φωτογραφίες ανά φάση.`;

  const bodyParagraphs = [
    `${greetingName(supervisorDisplayName)},`,
    '',
    `στο πλαίσιο της σύνταξης του Απολογισμού Τεχνικού Έργου για τη δημοτική περίοδο «${period}», χρειαζόμαστε φωτογραφική τεκμηρίωση για το παρακάτω υποέργο:`,
    '',
    praxis ? `Πράξη: ${praxis}` : null,
    `Υποέργο: ${sub}`,
    '',
    phasesLine,
    phasesBulletText,
    limitReminder,
    'Κατά το δυνατόν προτιμήστε καθαρή λήψη και ίδια γωνία στις φάσεις, ώστε να φαίνεται η εξέλιξη του έργου.',
    deadline ? `Θα σας παρακαλούσαμε για αποστολή έως τις ${deadline}.` : null,
    note || null,
    '',
    'Παρακαλούμε απαντήστε στο παρόν μήνυμα με τις φωτογραφίες ως συνημμένα.',
    '',
    'Με εκτίμηση,',
    sender || null,
    org || null,
  ].filter((line) => line != null);

  const textBody = bodyParagraphs.join('\n');

  const rows = [
    { label: 'Περίοδος', value: escapeHtml(period) },
    praxis ? { label: 'Πράξη', value: escapeHtml(praxis) } : null,
    { label: 'Υποέργο', value: escapeHtml(sub) },
    phasesPhrase
      ? { label: 'Φάσεις', value: escapeHtml(phasesPhrase.replace(/[«»]/g, '')) }
      : null,
    { label: 'Όριο', value: escapeHtml(`έως ${phaseRequest.maxPerPhase} φωτογραφίες ανά φάση`) },
    deadline ? { label: 'Προθεσμία', value: escapeHtml(deadline) } : null,
  ].filter(Boolean);

  const noteBlock = note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0;"><tr>
        <td style="padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:8px;font-size:13px;line-height:1.55;color:#78350f;">
          <strong style="color:#92400e;">Σημείωση:</strong> ${escapeHtml(note)}
        </td>
      </tr></table>`
    : '';

  const bulletsHtml = phaseRequest.bullets.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px 0;"><tr>
        <td style="padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#0369a1;">Απαιτούμενες φάσεις</p>
          <ul style="margin:0;padding:0 0 0 18px;color:#0c4a6e;font-size:14px;line-height:1.6;">
            ${phaseRequest.bullets.map((b) => `<li style="margin:0 0 4px 0;">${escapeHtml(b)}</li>`).join('')}
          </ul>
        </td>
      </tr></table>`
    : '';

  const infoRowsHtml = rows.map((r, idx) => `
              <tr>
                <td style="padding:10px 12px;color:#475569;font-size:11px;width:108px;vertical-align:top;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;">${r.label}</td>
                <td style="padding:10px 14px;color:#0f172a;font-size:14px;line-height:1.45;vertical-align:top;background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;">${r.value}</td>
              </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#e8eef5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8eef5;padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d0dae6;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
        <tr>
          <td style="height:5px;background:#1e3a5f;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:20px 26px 18px;background:#1e3a5f;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${ERGOHUB_APP_NAME}</span>
                  <div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;">Αίτημα φωτογραφιών</div>
                </td>
                <td align="right" valign="middle" style="width:88px;">
                  <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(147,197,253,0.18);border:1px solid rgba(147,197,253,0.35);font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#dbeafe;">Επίσημο</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 26px 10px;">
            <h1 style="margin:0 0 6px 0;font-size:19px;line-height:1.35;color:#0f172a;">Απολογισμός Τεχνικού Έργου</h1>
            <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#64748b;">
              Δημοτική περίοδος <strong style="color:#1e3a5f;">${escapeHtml(period)}</strong>
            </p>
            <p style="margin:0 0 12px 0;font-size:14px;line-height:1.65;color:#334155;">
              ${escapeHtml(greetingName(supervisorDisplayName))},
            </p>
            <p style="margin:0 0 16px 0;font-size:14px;line-height:1.65;color:#334155;">
              στο πλαίσιο της σύνταξης του <strong>Απολογισμού Τεχνικού Έργου</strong>,
              χρειαζόμαστε φωτογραφική τεκμηρίωση για το παρακάτω υποέργο.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-left:4px solid #2563eb;">
              ${infoRowsHtml}
            </table>
            <p style="margin:0 0 8px 0;font-size:14px;line-height:1.65;color:#334155;">
              ${escapeHtml(phasesLine)}
            </p>
            ${bulletsHtml}
            <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#475569;">
              ${escapeHtml(limitReminder)} Κατά το δυνατόν προτιμήστε καθαρή λήψη και ίδια γωνία στις φάσεις, ώστε να φαίνεται η εξέλιξη του έργου.
            </p>
            ${deadline ? `<p style="margin:0 0 10px 0;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:14px;line-height:1.6;color:#065f46;">Προθεσμία αποστολής: <strong>${escapeHtml(deadline)}</strong></p>` : ''}
            ${noteBlock}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;"><tr>
              <td style="padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:14px;line-height:1.6;color:#1e3a8a;font-weight:600;">
                Παρακαλούμε απαντήστε στο παρόν μήνυμα με τις φωτογραφίες ως συνημμένα.
              </td>
            </tr></table>
            <p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#334155;">
              Με εκτίμηση,<br/>
              ${sender ? `<strong style="color:#0f172a;">${escapeHtml(sender)}</strong>` : ''}
              ${org ? `<br/><span style="color:#64748b;">${escapeHtml(org)}</span>` : ''}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 26px 20px;border-top:1px solid #e2e8f0;background:#f1f5f9;">
            <p style="margin:0;font-size:11px;line-height:1.55;color:#94a3b8;">
              Το παρόν αίτημα απεστάλη μέσω της εφαρμογής <strong style="color:#475569;">${ERGOHUB_APP_NAME}</strong>,
              στο πλαίσιο της σύνταξης του Απολογισμού Τεχνικού Έργου.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, textBody };
}

async function sendPhotoRequestEmail({
  dataDir,
  toEmail,
  subject,
  html,
  textBody = '',
}) {
  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) {
    return { success: false, error: 'Δεν έχουν ρυθμιστεί τα στοιχεία αποστολής email.' };
  }
  const to = String(toEmail || '').trim();
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Μη έγκυρη διεύθυνση παραλήπτη.' };
  }

  try {
    const transporter = createTransporter(emailConfig);
    const fromName = getAppDisplayName(emailConfig) || ERGOHUB_APP_NAME;
    const fromUser = String(emailConfig?.gmail?.user || '').trim();
    const mail = {
      from: `"${fromName}" <${fromUser}>`,
      to,
      subject,
      html,
    };
    const plain = String(textBody || '').trim();
    if (plain) mail.text = plain;
    await transporter.sendMail(mail);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || 'Αποτυχία αποστολής email' };
  }
}

module.exports = {
  ERGOHUB_APP_NAME,
  resolveSupervisorContact,
  photoPhasesForCard,
  formatPhotoPhasesPhrase,
  formatPhotoPhasesRequestLines,
  buildPhotoRequestEmailContent,
  sendPhotoRequestEmail,
};
