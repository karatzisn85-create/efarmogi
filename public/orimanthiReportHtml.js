/**
 * orimanthiReportHtml.js — Αναφορά PDF ωρίμανσης ως καρτέλες έργου (όχι πίνακας Excel).
 */
const APP_NAME = 'ERGOHUB';
const APP_TAGLINE = 'Σύστημα Διαχείρισης Έργων Δήμου';

const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  maturing: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
  ready: { bg: '#f0fdfa', text: '#0d9488', border: '#5eead4' },
  submitted: { bg: '#eef2ff', text: '#4338ca', border: '#a5b4fc' },
  approved: { bg: '#f0fdf4', text: '#059669', border: '#6ee7b7' },
  rejected: { bg: '#fff1f2', text: '#e11d48', border: '#fda4af' },
};

const MARK_CAPTION = {
  hasFile: 'Υπάρχει αρχείο',
  noFile: 'Χωρίς αρχείο',
  issued: 'Η άδεια εκδόθηκε',
  applied: 'Έχει γίνει αίτηση',
  pending: 'Εκκρεμεί η άδεια',
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlMultiline(text) {
  const safe = escapeHtml(text);
  if (!safe) return '—';
  return safe.replace(/\r?\n/g, '<br/>');
}

const REPORT_CSS = `
:root {
  --indigo: #4338ca;
  --indigo-light: #eef2ff;
  --indigo-dark: #3730a3;
  --teal: #0d9488;
  --teal-light: #f0fdfa;
  --amber: #b45309;
  --rose: #be123c;
  --slate900: #0f172a;
  --slate800: #1e293b;
  --slate600: #475569;
  --slate500: #64748b;
  --slate200: #e2e8f0;
  --slate100: #f1f5f9;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: var(--slate800);
  background: #fff;
  font-size: 11pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report { min-height: 100%; }
.header {
  background: linear-gradient(135deg, #312e81 0%, #4338ca 35%, #6366f1 70%, #818cf8 100%);
  color: #fff;
  padding: 22px 26px 18px;
  position: relative;
  overflow: hidden;
}
.header::after {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
}
.header-brand {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  opacity: 0.88;
  margin-bottom: 6px;
}
.header-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.header-sub {
  font-size: 12px;
  opacity: 0.92;
  margin: 0;
  line-height: 1.45;
  max-width: 92%;
}
.header-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  position: relative;
  z-index: 1;
}
.stat-pill {
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
}
.content { padding: 16px 22px 22px; }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 16px;
  padding: 10px 12px;
  background: var(--indigo-light);
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  font-size: 9.5px;
  color: var(--slate600);
}
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.project-card {
  border: 1px solid var(--slate200);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(15,23,42,0.05);
  break-inside: avoid;
  page-break-inside: avoid;
}
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 10px;
  background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
  border-bottom: 1px solid #c7d2fe;
}
.serial {
  flex-shrink: 0;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--indigo);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--slate900);
  line-height: 1.35;
  flex: 1;
}
.card-title-wrap {
  flex: 1;
  min-width: 0;
}
.card-subprojects {
  flex: 0 0 34%;
  max-width: 260px;
  border-left: 1px solid #c7d2fe;
  padding: 0 0 0 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sub-item {
  font-size: 8.5px;
  font-weight: 600;
  color: var(--slate600);
  line-height: 1.35;
}
.sub-num {
  color: var(--indigo);
  font-weight: 800;
  margin-right: 4px;
}
.status-badge {
  display: inline-block;
  font-weight: 800;
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-bottom: 1px solid var(--slate200);
}
.info-cell {
  padding: 8px 12px;
  border-right: 1px solid var(--slate200);
  border-bottom: 1px solid #f1f5f9;
  min-width: 0;
}
.info-cell:nth-child(2n) { border-right: none; }
.info-label {
  font-size: 8px;
  font-weight: 800;
  color: var(--slate500);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 3px;
}
.info-value {
  font-size: 10.5px;
  font-weight: 650;
  color: var(--slate800);
  line-height: 1.4;
  word-break: break-word;
}
.note-block {
  padding: 9px 12px;
  border-bottom: 1px solid var(--slate200);
  background: #f8fafc;
}
.note-block.notes { background: #fffbeb; }
.checklist-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 72px;
}
.checklist-col {
  padding: 10px 12px 12px;
  min-width: 0;
}
.checklist-col + .checklist-col {
  border-left: 1px solid var(--slate200);
}
.col-head {
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0 0 8px;
}
.col-head.studies { color: var(--indigo-dark); }
.col-head.permits { color: #0f766e; }
.check-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 6px;
  font-size: 10px;
  line-height: 1.35;
}
.check-item:last-child { margin-bottom: 0; }
.mark {
  flex-shrink: 0;
  min-width: 2.4em;
  text-align: center;
  font-weight: 800;
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 6px;
  border: 1px solid transparent;
}
.mark-hasFile, .mark-issued { background: #d1fae5; color: #047857; border-color: #6ee7b7; }
.mark-applied { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
.mark-pending { background: #ffe4e6; color: #be123c; border-color: #fda4af; }
.mark-noFile { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
.spec-name { color: var(--slate800); font-weight: 650; }
.spec-hint { display: block; font-size: 8.5px; color: var(--slate500); font-weight: 600; margin-top: 1px; }
.empty-col {
  font-size: 9.5px;
  color: var(--slate500);
  font-style: italic;
}
.empty-msg {
  text-align: center;
  color: var(--slate500);
  font-style: italic;
  padding: 22px 14px;
  background: var(--slate100);
  border-radius: 10px;
  border: 1px dashed var(--slate200);
  font-size: 11px;
}
.footer {
  padding: 12px 22px 16px;
  background: var(--slate100);
  border-top: 1px solid var(--slate200);
  font-size: 9px;
  color: var(--slate500);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
@media print {
  body { background: #fff; }
  .header, .stat-pill, .status-badge, .serial, .mark, .legend {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .project-card { box-shadow: none; }
}
`;

function wrapReportHtml({ title, headerTitle, headerSub, statPills = [], bodyHtml, footerLeft, footerRight }) {
  const pills = statPills.map((p) => `<span class="stat-pill">${escapeHtml(p)}</span>`).join('');
  return `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="report">
  <header class="header">
    <div class="header-brand">${APP_NAME}</div>
    <h1 class="header-title">${escapeHtml(headerTitle)}</h1>
    ${headerSub ? `<p class="header-sub">${headerSub}</p>` : ''}
    ${pills ? `<div class="header-stats">${pills}</div>` : ''}
  </header>
  <main class="content">${bodyHtml}</main>
  <footer class="footer">
    <span>${footerLeft || ''}</span>
    <span>${footerRight || ''}</span>
  </footer>
</div>
</body>
</html>`;
}

function statusBadgeHtml(statusKey, statusLabel) {
  const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
  return `<span class="status-badge" style="background:${colors.bg};color:${colors.text};border-color:${colors.border}">${escapeHtml(statusLabel)}</span>`;
}

function infoCell(label, value) {
  return `<div class="info-cell">
    <div class="info-label">${escapeHtml(label)}</div>
    <div class="info-value">${htmlMultiline(value || '—')}</div>
  </div>`;
}

function markChip(item) {
  const kind = item && item.kind ? item.kind : 'noFile';
  const mark = (item && item.mark) || '—';
  return `<span class="mark mark-${escapeHtml(kind)}">${escapeHtml(mark)}</span>`;
}

function checklistItemsHtml(items, emptyText) {
  if (!items || !items.length) {
    return `<div class="empty-col">${escapeHtml(emptyText)}</div>`;
  }
  return items.map((item) => {
    const hint = MARK_CAPTION[item.kind] || '';
    return `<div class="check-item">
      ${markChip(item)}
      <span>
        <span class="spec-name">${escapeHtml(item.spec || '—')}</span>
        ${hint ? `<span class="spec-hint">${escapeHtml(hint)}</span>` : ''}
      </span>
    </div>`;
  }).join('');
}

function subprojectsColumnHtml(card) {
  const titles = Array.isArray(card && card.subprojectTitles) && card.subprojectTitles.length
    ? card.subprojectTitles
    : [''];
  const items = titles.map((title, index) => {
    const text = String(title || '').trim() || '—';
    return `<div class="sub-item"><span class="sub-num">${index + 1}.</span>${escapeHtml(text)}</div>`;
  }).join('');
  return `<div class="card-subprojects">${items}</div>`;
}

function buildProjectCardHtml(card, serial, options = {}) {
  const includeSubprojectTitles = options.includeSubprojectTitles !== false;
  const statusLabel = card.statusLabel || card.status || '—';
  const fileCount = Number(card.files) || 0;
  const filesLabel = fileCount === 1 ? '1 αρχείο' : `${fileCount} αρχεία`;
  const description = String(card.description || '').trim();
  const notes = String(card.notes || '').trim();
  return `<article class="project-card">
    <div class="card-head">
      <div class="serial">${serial}</div>
      <div class="card-title-wrap">
        <h2 class="card-title">${escapeHtml(card.title || '(Χωρίς τίτλο)')}</h2>
      </div>
      ${includeSubprojectTitles ? subprojectsColumnHtml(card) : ''}
      ${statusBadgeHtml(card.statusKey || card.status, statusLabel)}
    </div>
    <div class="info-grid">
      ${infoCell('Υπεύθυνος πράξης', card.actionResponsible)}
      ${infoCell('Κατηγορία / εξειδίκευση', card.category)}
      ${infoCell('Δημοτική ενότητα', card.municipalUnit)}
      ${infoCell('Οικισμός', card.settlement)}
      ${infoCell('Ανανέωση ΑΕΠΟ', card.aepo)}
      ${infoCell('Αρχεία · Ενημέρωση', `${filesLabel} · ${card.updatedAt || '—'}`)}
    </div>
    ${description ? `<div class="note-block"><div class="info-label">Περιγραφή</div><div class="info-value">${htmlMultiline(description)}</div></div>` : ''}
    ${notes ? `<div class="note-block notes"><div class="info-label">Σημειώσεις</div><div class="info-value">${htmlMultiline(notes)}</div></div>` : ''}
    <div class="checklist-row">
      <div class="checklist-col">
        <p class="col-head studies">Μελέτες έργου</p>
        ${checklistItemsHtml(card.meletes, 'Δεν έχουν καταχωρηθεί μελέτες')}
      </div>
      <div class="checklist-col">
        <p class="col-head permits">Αδειοδοτήσεις</p>
        ${checklistItemsHtml(card.adeiodotiseis, 'Δεν έχουν καταχωρηθεί αδειοδοτήσεις')}
      </div>
    </div>
  </article>`;
}

function legendHtml() {
  return `<div class="legend">
    <span class="legend-item"><span class="mark mark-hasFile">✓</span> Αρχείο μελέτης / Η άδεια εκδόθηκε</span>
    <span class="legend-item"><span class="mark mark-applied">Αιτ.</span> Έχει γίνει αίτηση (εκκρεμεί η έκδοση)</span>
    <span class="legend-item"><span class="mark mark-pending">×</span> Εκκρεμεί η άδεια</span>
    <span class="legend-item"><span class="mark mark-noFile">—</span> Δεν έχει καταχωρηθεί αρχείο μελέτης</span>
  </div>`;
}

function buildHubReportHtml({ cards = [], exportedAt, exportedBy, appVersion, includeSubprojectTitles = true }) {
  const list = Array.isArray(cards) ? cards : [];
  const totalFiles = list.reduce((sum, card) => sum + (Number(card.files) || 0), 0);
  const bodyHtml = list.length
    ? `${legendHtml()}${list.map((card, index) => buildProjectCardHtml(card, index + 1, { includeSubprojectTitles })).join('')}`
    : `<p class="empty-msg">Δεν υπάρχουν έργα προς εμφάνιση</p>`;

  return wrapReportHtml({
    title: 'Αναφορά Ωρίμανσης Έργων',
    headerTitle: 'Αναφορά Ωρίμανσης Έργων',
    headerSub: `${APP_TAGLINE} — καρτέλα ανά έργο, με μελέτες, αδειοδοτήσεις και υπεύθυνο πράξης`,
    statPills: [
      `Ημερομηνία: ${exportedAt}`,
      `Έργα: ${list.length}`,
      `Αρχεία: ${totalFiles}`,
      exportedBy ? `Εξαγωγή: ${exportedBy}` : null,
    ].filter(Boolean),
    bodyHtml,
    footerLeft: `${APP_NAME}${appVersion ? ` · v${appVersion}` : ''}`,
    footerRight: `Δημιουργήθηκε ${exportedAt}`,
  });
}

module.exports = {
  APP_NAME,
  APP_TAGLINE,
  MARK_CAPTION,
  buildHubReportHtml,
  buildProjectCardHtml,
  escapeHtml,
};
