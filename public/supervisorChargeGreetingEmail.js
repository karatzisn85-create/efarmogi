/**
 * Ενημέρωση χρέωσης επίβλεψης — μόνο όταν ο χρήστης τικάρει αποστολή στη φόρμα.
 * Σε ήδη χρεωμένα υποέργα το κουτάκι είναι ανενεργό (όχι αναδρομικά μηνύματα).
 */

const {
  loadEmailConfig,
  isConfigured,
  createTransporter,
  escapeHtml,
  getAppDisplayName,
} = require('./taskAssignmentEmailService');

const ERGOHUB_APP_NAME = 'ERGOHUB';
const MUNICIPALITY_DEFAULT = 'Δήμος Αρχανών-Αστερούσιων';
const ROLE_PRIMARY = 'primary';
const ROLE_ASSISTANT = 'assistant';
const ROLE_LABELS = {
  [ROLE_PRIMARY]: 'Κύριος επιβλέπων',
  [ROLE_ASSISTANT]: 'Βοηθός μηχανικός',
};

function usernameFromChargeId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^user:/i.test(s)) return s.replace(/^user:/i, '').trim();
  return s;
}

function catalogChargeEntries(project) {
  const ids = Array.isArray(project?.supervisorEngineerIds)
    ? project.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const out = [];
  const seen = new Set();
  ids.forEach((id, index) => {
    // Μόνο λογαριασμοί καταλόγου (`user:…`). Ελεύθερο όνομα δεν παίρνει email.
    if (!/^user:/i.test(id)) return;
    const username = usernameFromChargeId(id);
    const key = username.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      username,
      role: index === 0 ? ROLE_PRIMARY : ROLE_ASSISTANT,
    });
  });
  return out;
}

/**
 * Ενημέρωση μόνο όταν πριν δεν υπήρχε κανένας μηχανικός καταλόγου
 * και μετά υπάρχει τουλάχιστον ένας.
 */
function planFirstCatalogChargeGreeting(previousProject, nextProject) {
  const prev = catalogChargeEntries(previousProject);
  const next = catalogChargeEntries(nextProject);
  if (prev.length > 0 || next.length === 0) {
    return { notify: false, recipients: [] };
  }
  return { notify: true, recipients: next };
}

function shouldSendChargeGreetingEmail(requested, _previousProject, nextProject) {
  if (requested !== true) {
    return { notify: false, recipients: [] };
  }
  const recipients = catalogChargeEntries(nextProject);
  if (recipients.length === 0) {
    return { notify: false, recipients: [] };
  }
  return { notify: true, recipients };
}

function findUserByLooseUsername(users, username) {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return null;
  return (Array.isArray(users) ? users : []).find(
    (u) => String(u?.username || '').trim().toLowerCase() === key
  ) || null;
}

function isValidEmail(raw) {
  const email = String(raw || '').trim();
  return email.includes('@') ? email : '';
}

function formatReplyToHeader({ email, displayName } = {}) {
  const addr = isValidEmail(email);
  if (!addr) return '';
  const name = String(displayName || '').trim().replace(/["\r\n]+/g, '');
  return name ? `"${name}" <${addr}>` : addr;
}

/**
 * Reply-To: το email του ενεργούντος, αλλιώς πρώτος ενεργός SUPERADMIN με email.
 */
function resolveChargeGreetingReplyTo(users = [], actor = null) {
  const list = Array.isArray(users) ? users : [];
  const pick = (u) => {
    if (!u || u.active === false) return null;
    const email = isValidEmail(u.email);
    if (!email) return null;
    return {
      email,
      displayName: String(u.fullName || u.username || '').trim(),
    };
  };
  const fromActor = pick(actor);
  if (fromActor) return fromActor;
  for (const u of list) {
    if (u?.role !== 'SUPERADMIN') continue;
    const hit = pick(u);
    if (hit) return hit;
  }
  return null;
}

function greetingName(displayName) {
  const name = String(displayName || '').trim();
  if (!name) return 'Αγαπητέ/ή συνάδελφε';
  return `Αγαπητέ/ή κ. ${name}`;
}

function truncateForSubject(text, max = 100) {
  const s = String(text || '').trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1)).trim()}…`;
}

function formatDateEl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function pickContractorName(project) {
  const snap = project?.khmdhsContractSnapshot
    || (Array.isArray(project?.contracts) ? project.contracts[0]?.khmdhsContractSnapshot : null)
    || {};
  return String(snap.anadoxosName || snap.contractorName || snap.contractor || '').trim();
}

function pickContractAdam(project) {
  const snap = project?.khmdhsContractSnapshot
    || (Array.isArray(project?.contracts) ? project.contracts[0]?.khmdhsContractSnapshot : null)
    || {};
  const fromSnap = String(snap.referenceNumber || '').trim();
  if (fromSnap) return fromSnap;
  const top = String(project?.khmdhsAdam || '').trim();
  if (/SYMV/i.test(top)) return top;
  return '';
}

function pickContractAmount(project) {
  const top = String(project?.contractAmount || '').trim();
  if (top) return top;
  const row = Array.isArray(project?.contracts) ? project.contracts[0] : null;
  return String(row?.amount || '').trim();
}

function pickContractDate(project) {
  const top = String(project?.contractDate || '').trim();
  if (top) return formatDateEl(top);
  const row = Array.isArray(project?.contracts) ? project.contracts[0] : null;
  return formatDateEl(row?.date || row?.contractDate || '');
}

function displayNameForUser(user, fallbackUsername) {
  return String(user?.fullName || user?.username || fallbackUsername || '').trim();
}

function buildTeamLines(recipients, users) {
  const named = recipients.map((r) => {
    const user = findUserByLooseUsername(users, r.username);
    return {
      role: r.role,
      name: displayNameForUser(user, r.username),
    };
  });
  const primary = named.find((n) => n.role === ROLE_PRIMARY);
  const assistants = named.filter((n) => n.role === ROLE_ASSISTANT);
  return {
    primaryName: primary?.name || '',
    assistantNames: assistants.map((a) => a.name).filter(Boolean),
  };
}

function buildRoleCopy(recipientRole) {
  if (recipientRole === ROLE_ASSISTANT) {
    return {
      headerKicker: 'Συμμετοχή σε υποέργο',
      subjectPrefix: 'Συμμετοχή σε υποέργο',
      intro:
        'Καταχωρήθηκε η συμμετοχή σας στο παρακάτω υποέργο, με χαρακτηρισμό «Βοηθός μηχανικός».',
      introHtml:
        'Καταχωρήθηκε η συμμετοχή σας στο παρακάτω υποέργο, με χαρακτηρισμό <strong>Βοηθός μηχανικός</strong>.',
      clarification:
        'Δεν είστε ο επιβλέπων ή η επιβλέπουσα του υποέργου. Ο χαρακτηρισμός αυτός δόθηκε λόγω της συμμετοχής σας σε διαδικασία που το αφορά.',
      visibility:
        'Με την καταχώριση αυτή, το υποέργο εμφανίζεται πλέον στον λογαριασμό σας στην εφαρμογή ERGOHUB.',
    };
  }
  return {
    headerKicker: 'Χρέωση επίβλεψης',
    subjectPrefix: 'Χρέωση επίβλεψης',
    intro: 'Σας χρεώθηκε η επίβλεψη του παρακάτω υποέργου, με ρόλο Κύριος επιβλέπων.',
    introHtml:
      'Σας χρεώθηκε η επίβλεψη του παρακάτω υποέργου, με ρόλο <strong>Κύριος επιβλέπων</strong>.',
    clarification: '',
    visibility:
      'Με την καταχώριση αυτή, το υποέργο εμφανίζεται πλέον στον λογαριασμό σας στην εφαρμογή ERGOHUB.',
  };
}

function collectSubprojectInfoRows(project, team, actorDisplayName) {
  const praxis = String(project?.projectTitle || '').trim();
  const sub = String(project?.subprojectTitle || '').trim();
  const ka = String(project?.kaCode || '').trim();
  const status = String(project?.projectStatus || '').trim();
  const form = String(project?.implementationForm || '').trim();
  const amount = pickContractAmount(project);
  const date = pickContractDate(project);
  const contractor = pickContractorName(project);
  const adam = pickContractAdam(project);
  const names = team && typeof team === 'object' ? team : {};

  const rows = [];
  if (praxis) rows.push({ label: 'Πράξη', value: praxis });
  if (sub) rows.push({ label: 'Υποέργο', value: sub });
  if (ka) rows.push({ label: 'Κ.Α.', value: ka });
  if (status) rows.push({ label: 'Κατάσταση', value: status });
  if (form) rows.push({ label: 'Μορφή υλοποίησης', value: form });
  if (amount) rows.push({ label: 'Ποσό σύμβασης', value: /€/.test(amount) ? amount : `${amount} €` });
  if (date) rows.push({ label: 'Ημ. σύμβασης', value: date });
  if (contractor) rows.push({ label: 'Ανάδοχος', value: contractor });
  if (adam) rows.push({ label: 'ΑΔΑΜ σύμβασης', value: adam });
  if (names.primaryName) rows.push({ label: 'Κύριος επιβλέπων', value: names.primaryName });
  if (Array.isArray(names.assistantNames) && names.assistantNames.length) {
    rows.push({
      label: names.assistantNames.length === 1 ? 'Βοηθός μηχανικός' : 'Βοηθοί μηχανικοί',
      value: names.assistantNames.join(', '),
    });
  }
  if (actorDisplayName) rows.push({ label: 'Καταχώριση από', value: actorDisplayName });
  return rows;
}

function buildChargeGreetingEmailContent({
  recipientDisplayName,
  recipientRole,
  project,
  team,
  actorDisplayName = '',
  municipalityName = MUNICIPALITY_DEFAULT,
}) {
  const copy = buildRoleCopy(recipientRole);
  const sub = String(project?.subprojectTitle || '').trim();
  const praxis = String(project?.projectTitle || '').trim();
  const subForSubject = truncateForSubject(sub, 100);
  const subject = String(
    subForSubject
      ? `${copy.subjectPrefix} — ${subForSubject}`
      : copy.subjectPrefix
  ).replace(/[\r\n]+/g, ' ').trim();

  const infoRows = collectSubprojectInfoRows(project, team, actorDisplayName);
  const greeting = greetingName(recipientDisplayName);
  const municipality = String(municipalityName || MUNICIPALITY_DEFAULT).trim();
  const clarificationHtml = copy.clarification
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr>
              <td style="padding:14px 16px;background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #1e3a5f;border-radius:10px;font-size:14px;line-height:1.65;color:#0f172a;">
                <strong style="display:block;margin:0 0 6px 0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#1e3a5f;">Σαφής επισήμανση</strong>
                ${escapeHtml(copy.clarification)}
              </td>
            </tr></table>`
    : '';

  const textLines = [
    `${greeting},`,
    '',
    copy.intro,
    copy.clarification || null,
    '',
    ...infoRows.map((r) => `${r.label}: ${r.value}`),
    '',
    copy.visibility,
    '',
    'Με εκτίμηση,',
    actorDisplayName || null,
    municipality || null,
  ].filter((line) => line != null);

  const infoRowsHtml = infoRows.map((r, idx) => `
              <tr>
                <td style="padding:10px 12px;color:#475569;font-size:11px;width:132px;vertical-align:top;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;">${escapeHtml(r.label)}</td>
                <td style="padding:10px 14px;color:#0f172a;font-size:14px;line-height:1.45;vertical-align:top;background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};border-bottom:1px solid #e2e8f0;">${escapeHtml(r.value)}</td>
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
                  <div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd;">${escapeHtml(copy.headerKicker)}</div>
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
            <h1 style="margin:0 0 6px 0;font-size:19px;line-height:1.35;color:#0f172a;">${escapeHtml(sub || 'Υποέργο')}</h1>
            ${praxis ? `<p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(praxis)}</p>` : ''}
            <p style="margin:0 0 12px 0;font-size:14px;line-height:1.65;color:#334155;">
              ${escapeHtml(greeting)},
            </p>
            <p style="margin:0 0 16px 0;font-size:14px;line-height:1.65;color:#334155;">
              ${copy.introHtml}
            </p>
            ${clarificationHtml}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-left:4px solid #2563eb;">
              ${infoRowsHtml}
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 0 0;"><tr>
              <td style="padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:14px;line-height:1.6;color:#1e3a8a;font-weight:600;">
                ${escapeHtml(copy.visibility)}
              </td>
            </tr></table>
            <p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#334155;">
              Με εκτίμηση,<br/>
              ${actorDisplayName ? `<strong style="color:#0f172a;">${escapeHtml(actorDisplayName)}</strong><br/>` : ''}
              <span style="color:#64748b;">${escapeHtml(municipality)}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 26px 20px;border-top:1px solid #e2e8f0;background:#f1f5f9;">
            <p style="margin:0;font-size:11px;line-height:1.55;color:#94a3b8;">
              Αυτόματη ενημέρωση χρέωσης μέσω της εφαρμογής <strong style="color:#475569;">${ERGOHUB_APP_NAME}</strong>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, textBody: textLines.join('\n') };
}

async function sendChargeGreetingEmail({
  dataDir,
  toEmail,
  subject,
  html,
  textBody = '',
  replyTo = null,
}) {
  const emailConfig = loadEmailConfig(dataDir);
  if (!isConfigured(emailConfig)) {
    return { success: false, error: 'not_configured' };
  }
  const to = String(toEmail || '').trim();
  if (!to || !to.includes('@')) {
    return { success: false, error: 'invalid_to' };
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
    const replyHeader = typeof replyTo === 'string'
      ? String(replyTo || '').trim()
      : formatReplyToHeader(replyTo || {});
    if (replyHeader) mail.replyTo = replyHeader;
    const plain = String(textBody || '').trim();
    if (plain) mail.text = plain;
    await transporter.sendMail(mail);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || 'send_failed' };
  }
}

/**
 * @returns {Promise<{
 *   attempted: boolean,
 *   reason?: string,
 *   sentNames: string[],
 *   skippedNoEmailNames: string[],
 *   failedNames: string[],
 * }>}
 */
async function notifyFirstSupervisorCharge({
  previousProject,
  nextProject,
  users = [],
  actor = null,
  dataDir,
  municipalityName = MUNICIPALITY_DEFAULT,
  sendFn = sendChargeGreetingEmail,
}) {
  const empty = {
    attempted: false,
    sentNames: [],
    skippedNoEmailNames: [],
    failedNames: [],
  };
  const plan = shouldSendChargeGreetingEmail(true, previousProject, nextProject);
  if (!plan.notify) return empty;

  if (sendFn === sendChargeGreetingEmail) {
    const emailConfig = loadEmailConfig(dataDir);
    if (!isConfigured(emailConfig)) {
      return { ...empty, attempted: true, reason: 'not_configured' };
    }
  }

  const team = buildTeamLines(plan.recipients, users);
  const actorDisplayName = displayNameForUser(actor, '');
  const replyTo = resolveChargeGreetingReplyTo(users, actor);
  const sentNames = [];
  const skippedNoEmailNames = [];
  const failedNames = [];

  for (const recipient of plan.recipients) {
    const user = findUserByLooseUsername(users, recipient.username);
    const displayName = displayNameForUser(user, recipient.username);
    if (!user || user.active === false) {
      skippedNoEmailNames.push(displayName);
      continue;
    }
    const email = isValidEmail(user.email);
    if (!email) {
      skippedNoEmailNames.push(displayName);
      continue;
    }
    const content = buildChargeGreetingEmailContent({
      recipientDisplayName: displayName,
      recipientRole: recipient.role,
      project: nextProject,
      team,
      actorDisplayName,
      municipalityName,
    });
    const sent = await sendFn({
      dataDir,
      toEmail: email,
      subject: content.subject,
      html: content.html,
      textBody: content.textBody,
      replyTo,
    });
    if (sent?.success) sentNames.push(displayName);
    else if (sent?.error === 'not_configured') {
      return {
        attempted: true,
        reason: 'not_configured',
        sentNames,
        skippedNoEmailNames,
        failedNames,
      };
    } else {
      failedNames.push(displayName);
    }
  }

  return {
    attempted: true,
    sentNames,
    skippedNoEmailNames,
    failedNames,
  };
}

module.exports = {
  ROLE_PRIMARY,
  ROLE_ASSISTANT,
  ROLE_LABELS,
  catalogChargeEntries,
  planFirstCatalogChargeGreeting,
  shouldSendChargeGreetingEmail,
  buildRoleCopy,
  buildChargeGreetingEmailContent,
  resolveChargeGreetingReplyTo,
  notifyFirstSupervisorCharge,
  sendChargeGreetingEmail,
};
