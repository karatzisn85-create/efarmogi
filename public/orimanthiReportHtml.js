/**
 * orimanthiReportHtml.js — Styled HTML templates για αναφορές Ωρίμανσης Έργων
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

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const REPORT_CSS = `
:root {
  --indigo: #4338ca;
  --indigo-light: #eef2ff;
  --indigo-dark: #3730a3;
  --teal: #0d9488;
  --teal-light: #f0fdfa;
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
  padding: 26px 30px 22px;
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
  font-size: 21px;
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
  margin-top: 14px;
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
  backdrop-filter: blur(4px);
}
.content { padding: 22px 30px 26px; }
.section { margin-bottom: 22px; }
.section:last-child { margin-bottom: 0; }
.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.section-icon {
  width: 30px;
  height: 30px;
  background: var(--indigo-light);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.section-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--indigo-dark);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0;
  flex: 1;
}
.section-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--slate500);
  background: var(--slate100);
  padding: 3px 10px;
  border-radius: 999px;
}
table.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 10px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--slate200);
  box-shadow: 0 2px 8px rgba(15,23,42,0.04);
}
table.data-table thead th {
  background: linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%);
  color: var(--indigo-dark);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 8.5px;
  letter-spacing: 0.05em;
  padding: 9px 10px;
  text-align: left;
  border-bottom: 2px solid #a5b4fc;
}
table.data-table tbody td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  line-height: 1.4;
}
table.data-table tbody tr:nth-child(even) td { background: #f8fafc; }
table.data-table tbody tr:last-child td { border-bottom: none; }
.num-cell { text-align: center; font-weight: 700; color: var(--indigo-dark); }
.title-cell { font-weight: 700; color: var(--slate800); word-break: break-word; }
.status-badge {
  display: inline-block;
  font-weight: 800;
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.pending-cell { font-size: 9.5px; color: var(--slate600); max-width: 220px; }
.empty-msg {
  text-align: center;
  color: var(--slate500);
  font-style: italic;
  padding: 18px;
  background: var(--slate100);
  border-radius: 10px;
  border: 1px dashed var(--slate200);
  font-size: 11px;
}
.footer {
  padding: 12px 30px 16px;
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
  .header, table.data-table thead th, .stat-pill, .status-badge {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
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

function buildHubReportHtml({ rows, exportedAt, exportedBy, appVersion }) {
  const tableRows = rows.length > 0
    ? rows.map((r) => `
      <tr>
        <td class="title-cell">${escapeHtml(r.title)}</td>
        <td>${statusBadgeHtml(r.statusKey, r.status)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.municipalUnit)}</td>
        <td>${escapeHtml(r.settlement)}</td>
        <td>${escapeHtml(r.aepo)}</td>
        <td class="pending-cell">${escapeHtml(String(r.pending))}</td>
        <td class="num-cell">${r.files}</td>
        <td>${escapeHtml(r.updatedAt)}</td>
      </tr>`).join('')
    : `<tr><td colspan="9" class="empty-msg">Δεν υπάρχουν έργα προς εμφάνιση</td></tr>`;

  const totalFiles = rows.reduce((sum, r) => sum + (Number(r.files) || 0), 0);

  const bodyHtml = `
    <section class="section">
      <div class="section-head">
        <div class="section-icon">🏗</div>
        <h2 class="section-title">Κατάλογος Έργων Ωρίμανσης</h2>
        <span class="section-count">${rows.length} έργα · ${totalFiles} αρχεία</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Τίτλος</th>
            <th>Κατάσταση</th>
            <th>Κατηγορία</th>
            <th>Δημ. Ενότητα</th>
            <th>Οικισμός</th>
            <th>ΑΕΠΟ</th>
            <th>Εκκρεμότητες</th>
            <th>Αρχεία</th>
            <th>Ενημέρωση</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;

  return wrapReportHtml({
    title: 'Αναφορά Hub Ωρίμανσης Έργων',
    headerTitle: 'Αναφορά Hub Ωρίμανσης Έργων',
    headerSub: `${APP_TAGLINE} — πλήρης επισκόπηση έργων υπό ωρίμανση`,
    statPills: [
      `Ημερομηνία: ${exportedAt}`,
      `Έργα: ${rows.length}`,
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
  buildHubReportHtml,
  escapeHtml,
};
