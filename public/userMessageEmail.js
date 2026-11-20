/**
 * Μήνυμα από χρήστη προς άλλους χρήστες, μέσω του email της εφαρμογής.
 * Η απάντηση πηγαίνει στα προσωπικά τους email.
 */

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.js', '.vbs', '.jar', '.dll',
]);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);

const MAX_SUBJECT = 140;
const MAX_BODY = 20000;
const MAX_FILES = 8;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_INLINE_IMAGE = Math.floor(1.2 * 1024 * 1024);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validEmail(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function displayName(user) {
  const name = String((user && (user.fullName || user.username)) || '').trim();
  return name || 'Χρήστης';
}

function personFromUser(user) {
  return {
    username: String(user.username || '').trim(),
    fullName: displayName(user),
    email: validEmail(user.email),
  };
}

function isEligible(user) {
  if (!user || user.active === false || user.approved === false) return false;
  return !!validEmail(user.email);
}

function listRecipients(users, actor) {
  const mine = String(actor && actor.username || '').trim().toLowerCase();
  const recipients = (Array.isArray(users) ? users : [])
    .filter((user) => isEligible(user) && String(user.username || '').trim().toLowerCase() !== mine)
    .map(personFromUser)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'el'));
  return {
    me: actor ? personFromUser(actor) : null,
    recipients,
  };
}

function extensionOf(name) {
  const base = String(name || '').trim().toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

function fileKind(name) {
  const ext = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'file';
}

function kindLabel(kind) {
  if (kind === 'image') return 'Εικόνα';
  if (kind === 'video') return 'Βίντεο';
  return 'Αρχείο';
}

function headerName(name) {
  return String(name || 'Χρήστης').replace(/["<>]/g, '').trim() || 'Χρήστης';
}

function replyAddress(person) {
  return `"${headerName(person.fullName)}" <${person.email}>`;
}

function uniquePeople(people) {
  const seen = new Set();
  const out = [];
  (people || []).forEach((person) => {
    const email = validEmail(person && person.email);
    if (!email) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...person, email });
  });
  return out;
}

function textToHtml(body) {
  return escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

function buildUserMessageHtml({
  appName,
  sender,
  participants,
  subject,
  body,
  files,
}) {
  const safeApp = escapeHtml(appName || 'ERGOHUB');
  const who = (participants || []).map((person) => escapeHtml(person.fullName)).join(', ');
  const fileRows = (files || []).map((file) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">
        <span style="display:inline-block;min-width:64px;margin-right:8px;color:#4338ca;font-weight:700;font-size:12px;letter-spacing:0.04em;">${kindLabel(file.kind)}</span>
        ${escapeHtml(file.name)}
      </td>
    </tr>`).join('');
  const images = (files || []).filter((file) => file.inline && file.cid).map((file) => `
    <img src="cid:${escapeHtml(file.cid)}" alt="${escapeHtml(file.name)}" style="display:block;width:100%;max-width:632px;height:auto;border:0;border-radius:14px;margin:0 0 14px 0;" />
  `).join('');

  return `<!DOCTYPE html>
<html lang="el">
<body style="margin:0;padding:0;background:#eef2ff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e0e7ff;">
        <tr>
          <td style="padding:28px 32px 22px;background:#4338ca;">
            <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;font-weight:700;">${safeApp}</div>
            <div style="margin-top:8px;font-size:28px;line-height:1.25;color:#ffffff;font-weight:700;">${escapeHtml(subject)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px 8px;">
            <div style="font-size:13px;color:#64748b;letter-spacing:0.04em;text-transform:uppercase;font-weight:700;">Από</div>
            <div style="margin-top:4px;font-size:22px;line-height:1.3;color:#1e1b4b;font-weight:700;">${escapeHtml(sender.fullName)}</div>
            <div style="margin-top:2px;font-size:14px;color:#4338ca;">${escapeHtml(sender.email)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 8px;">
            <div style="font-size:17px;line-height:1.75;color:#1e293b;">${textToHtml(body)}</div>
          </td>
        </tr>
        ${images ? `<tr><td style="padding:8px 32px 8px;">${images}</td></tr>` : ''}
        ${fileRows ? `<tr><td style="padding:8px 32px 18px;">
          <div style="font-size:13px;color:#64748b;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 8px;">Συνημμένα</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${fileRows}</table>
        </td></tr>` : ''}
        <tr>
          <td style="padding:8px 32px 28px;">
            <div style="padding:16px 18px;background:#f5f3ff;border-radius:14px;border:1px solid #ddd6fe;">
              <div style="font-size:14px;line-height:1.6;color:#312e81;">
                Η απάντηση σε αυτό το μήνυμα πηγαίνει στα email των συμμετεχόντων: <strong>${who}</strong>.
              </div>
              <div style="margin-top:6px;font-size:13px;line-height:1.55;color:#6d28d9;">
                Αντίγραφο έφτασε και στον αποστολέα, ώστε να μπορεί να το ξαναδεί από το email του.
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText({ sender, participants, subject, body, files }) {
  const lines = [
    subject,
    '',
    `Από: ${sender.fullName} <${sender.email}>`,
    '',
    body,
  ];
  const named = (files || []).map((file) => file.name).filter(Boolean);
  if (named.length) {
    lines.push('', 'Συνημμένα:', ...named.map((name) => `- ${name}`));
  }
  lines.push(
    '',
    `Η απάντηση πηγαίνει στα email των συμμετεχόντων: ${(participants || []).map((person) => person.fullName).join(', ')}.`,
  );
  return lines.join('\n');
}

function classifyAttachment(file) {
  const name = String((file && file.name) || '').trim();
  const ext = extensionOf(name);
  if (!name || name === '.' || name === '..') {
    return { ok: false, error: 'Ένα συνημμένο δεν έχει όνομα.' };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Το αρχείο «${name}» δεν μπορεί να σταλεί.` };
  }
  const bytes = Number(file && file.bytes) || 0;
  if (bytes <= 0) {
    return { ok: false, error: `Το αρχείο «${name}» είναι κενό.` };
  }
  const kind = fileKind(name);
  const inline = kind === 'image' && bytes <= MAX_INLINE_IMAGE;
  return { ok: true, file: { name, kind, bytes, inline } };
}

function prepareUserMessage({ actor, users, recipientUsernames, subject, body, files }) {
  if (!actor || !isEligible(actor)) {
    return { ok: false, error: 'Για να στείλεις μήνυμα χρειάζεται email στον λογαριασμό σου.' };
  }
  const sender = personFromUser(actor);
  const wanted = new Set(
    (Array.isArray(recipientUsernames) ? recipientUsernames : [])
      .map((name) => String(name || '').trim().toLowerCase())
      .filter(Boolean),
  );
  wanted.delete(sender.username.toLowerCase());
  if (!wanted.size) {
    return { ok: false, error: 'Επίλεξε τουλάχιστον έναν παραλήπτη.' };
  }
  const chosen = (Array.isArray(users) ? users : []).filter((user) => (
    wanted.has(String(user.username || '').trim().toLowerCase())
  ));
  if (chosen.length !== wanted.size || chosen.some((user) => !isEligible(user))) {
    return { ok: false, error: 'Κάποιος από τους παραλήπτες δεν μπορεί να λάβει email.' };
  }
  const cleanSubject = String(subject || '').trim().replace(/\s+/g, ' ');
  if (!cleanSubject) return { ok: false, error: 'Γράψε θέμα.' };
  if (cleanSubject.length > MAX_SUBJECT) {
    return { ok: false, error: 'Το θέμα είναι πολύ μεγάλο.' };
  }
  const cleanBody = String(body || '').replace(/\r\n/g, '\n').trim();
  if (!cleanBody) return { ok: false, error: 'Γράψε το μήνυμα.' };
  if (cleanBody.length > MAX_BODY) return { ok: false, error: 'Το μήνυμα είναι πολύ μεγάλο.' };

  const incoming = Array.isArray(files) ? files : [];
  if (incoming.length > MAX_FILES) {
    return { ok: false, error: 'Μπορείς να επισυνάψεις έως 8 αρχεία.' };
  }
  const prepared = [];
  let total = 0;
  for (const file of incoming) {
    const checked = classifyAttachment(file);
    if (!checked.ok) return checked;
    total += checked.file.bytes;
    if (total > MAX_TOTAL_BYTES) {
      return { ok: false, error: 'Τα συνημμένα ξεπερνούν το όριο των 20 MB.' };
    }
    if (checked.file.inline) checked.file.cid = `user-message-${prepared.length}@ergohub`;
    prepared.push(checked.file);
  }

  const recipients = chosen.map(personFromUser);
  const participants = [sender, ...recipients];
  const delivery = uniquePeople(participants);
  const replyTo = delivery.map(replyAddress).join(', ');
  const to = delivery.map((person) => person.email);
  const html = buildUserMessageHtml({
    appName: 'ERGOHUB',
    sender,
    participants,
    subject: cleanSubject,
    body: cleanBody,
    files: prepared,
  });
  return {
    ok: true,
    sender,
    recipients,
    participants,
    subject: cleanSubject,
    body: cleanBody,
    files: prepared,
    to,
    replyTo,
    html,
    text: buildText({
      sender,
      participants,
      subject: cleanSubject,
      body: cleanBody,
      files: prepared,
    }),
  };
}

module.exports = {
  listRecipients,
  prepareUserMessage,
  fileKind,
  escapeHtml,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  MAX_INLINE_IMAGE,
};
