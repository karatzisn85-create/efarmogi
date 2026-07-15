/**
 * meletaiReportHtml.js — Styled HTML templates για αναφορές Μητρώου Μελετών
 */
const APP_NAME = 'ERGOHUB';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const REPORT_CSS = `
:root {
  --emerald: #059669;
  --emerald-light: #ecfdf5;
  --emerald-dark: #047857;
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
.report {
  min-height: 100%;
}
.header {
  background: linear-gradient(135deg, #065f46 0%, #047857 35%, #059669 70%, #10b981 100%);
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
  max-width: 90%;
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
  background: var(--emerald-light);
  border: 1px solid #a7f3d0;
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
  color: var(--emerald-dark);
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
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.info-card {
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  border: 1px solid var(--slate200);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.04);
}
.info-card.full { grid-column: 1 / -1; }
.info-label {
  font-size: 8.5px;
  font-weight: 800;
  color: var(--slate500);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}
.info-value {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--slate800);
  line-height: 1.45;
  word-break: break-word;
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
  background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);
  color: var(--emerald-dark);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 8.5px;
  letter-spacing: 0.05em;
  padding: 9px 10px;
  text-align: left;
  border-bottom: 2px solid #6ee7b7;
}
table.data-table tbody td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  line-height: 1.4;
}
table.data-table tbody tr:nth-child(even) td { background: #f8fafc; }
table.data-table tbody tr:last-child td { border-bottom: none; }
.num-cell { text-align: center; font-weight: 700; color: var(--emerald-dark); }
.badge {
  display: inline-block;
  background: var(--emerald-light);
  color: var(--emerald-dark);
  font-weight: 700;
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid #a7f3d0;
}
.file-name { font-weight: 600; color: var(--slate800); word-break: break-all; }
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
  .header, table.data-table thead th, .info-card, .stat-pill {
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

function buildInfoGridHtml(rows, { fullWidthLabels = ['Σημειώσεις', 'Συνδεδεμένο υποέργο', 'Τίτλος'] } = {}) {
  const cards = rows.map(([label, value]) => {
    const full = fullWidthLabels.includes(label) ? ' full' : '';
    return `<div class="info-card${full}">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value">${escapeHtml(value).replace(/\n/g, '<br>')}</div>
    </div>`;
  }).join('');
  return `<div class="info-grid">${cards}</div>`;
}

function buildHubReportHtml({ rows, exportedAt, exportedBy, appVersion }) {
  const tableRows = rows.length > 0
    ? rows.map((r) => `
      <tr>
        <td><span class="badge">${escapeHtml(r.studyNumber)}</span></td>
        <td class="file-name">${escapeHtml(r.title)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.assignedTo)}</td>
        <td class="num-cell">${escapeHtml(r.projectBudget || '—')}</td>
        <td>${escapeHtml(r.studyApprovalDate || '—')}</td>
        <td>${escapeHtml(r.subproject)}</td>
        <td class="num-cell">${r.files}</td>
        <td>${escapeHtml(r.updatedAt)}</td>
      </tr>`).join('')
    : `<tr><td colspan="9" class="empty-msg">Δεν υπάρχουν μελέτες προς εμφάνιση</td></tr>`;

  const bodyHtml = `
    <section class="section">
      <div class="section-head">
        <div class="section-icon">📋</div>
        <h2 class="section-title">Κατάλογος Μελετών</h2>
        <span class="section-count">${rows.length} εγγραφές</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Αριθμός</th>
            <th>Τίτλος</th>
            <th>Κατηγορία</th>
            <th>Χρεωμένη σε</th>
            <th>Προυπολογισμός</th>
            <th>Θεώρηση</th>
            <th>Υποέργο</th>
            <th>Αρχεία</th>
            <th>Ενημέρωση</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;

  return wrapReportHtml({
    title: 'Αναφορά Μητρώου Μελετών',
    headerTitle: 'Αναφορά Μητρώου Μελετών',
    headerSub: 'Πλήρης κατάλογος καταχωρημένων μελετών',
    statPills: [
      `Ημερομηνία: ${exportedAt}`,
      `Μελέτες: ${rows.length}`,
      exportedBy ? `Εξαγωγή: ${exportedBy}` : null,
    ].filter(Boolean),
    bodyHtml,
    footerLeft: `${APP_NAME}${appVersion ? ` · v${appVersion}` : ''}`,
    footerRight: `Δημιουργήθηκε ${exportedAt}`,
  });
}

function buildStudyReportHtml({ meleti, fileInventory, exportedAt, exportedBy, appVersion }) {
  const fileCount = (fileInventory || []).filter((r) => r.fileName && r.fileName !== '—').length;
  const infoHtml = buildInfoGridHtml([
    ['Αριθμός μελέτης', meleti.studyNumber || '—'],
    ['Τίτλος', meleti.title || '(Χωρίς τίτλο)'],
    ['Κατηγορία', meleti.category || '—'],
    ['Χρεωμένη σε', meleti.assignedTo || '—'],
    ['Προυπολογισμός δαπάνης έργου', meleti.projectExpenditureBudget
      ? `${String(meleti.projectExpenditureBudget).replace(/€/gi, '').trim()} €`
      : '—'],
    ['Ημερομηνία θεώρησης', meleti.studyApprovalDate
      ? formatDateOnly(meleti.studyApprovalDate)
      : '—'],
    ['Συνδεδεμένο υποέργο', meleti.linkedSubprojectTitle
      ? `${meleti.linkedProjectTitle ? `${meleti.linkedProjectTitle} · ` : ''}${meleti.linkedSubprojectTitle}`
      : '—'],
    ['Σημειώσεις', String(meleti.notes || '').trim() || '—'],
    ['Καταχώρηση', meleti.createdAt ? formatDateOnly(meleti.createdAt) : '—'],
    ['Τελευταία ενημέρωση', meleti.updatedAt ? formatDateOnly(meleti.updatedAt) : '—'],
  ]);

  const fileRows = (fileInventory || []).length > 0
    ? fileInventory.map((row, idx) => `
      <tr>
        <td class="num-cell">${idx + 1}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${escapeHtml(row.entryType)}</td>
        <td>${escapeHtml(row.container)}</td>
        <td class="file-name">${escapeHtml(row.fileName)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty-msg">Δεν υπάρχουν καταχωρημένα αρχεία</td></tr>`;

  const bodyHtml = `
    <section class="section">
      <div class="section-head">
        <div class="section-icon">📐</div>
        <h2 class="section-title">Στοιχεία Μελέτης</h2>
      </div>
      ${infoHtml}
    </section>
    <section class="section">
      <div class="section-head">
        <div class="section-icon">📁</div>
        <h2 class="section-title">Αρχεία Μελέτης</h2>
        <span class="section-count">${fileCount} αρχεία</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Κατηγορία</th>
            <th>Τύπος</th>
            <th>Φάκελος</th>
            <th>Όνομα αρχείου</th>
          </tr>
        </thead>
        <tbody>${fileRows}</tbody>
      </table>
    </section>`;

  return wrapReportHtml({
    title: `Αναφορά Μελέτης ${meleti.studyNumber || ''}`,
    headerTitle: 'Αναφορά Μελέτης',
    headerSub: `${meleti.studyNumber || '—'} · ${meleti.title || '(Χωρίς τίτλο)'}`,
    statPills: [
      `Ημερομηνία: ${exportedAt}`,
      `Αρχεία: ${fileCount}`,
      exportedBy ? `Εξαγωγή: ${exportedBy}` : null,
    ].filter(Boolean),
    bodyHtml,
    footerLeft: `${APP_NAME}${appVersion ? ` · v${appVersion}` : ''}`,
    footerRight: `Δημιουργήθηκε ${exportedAt}`,
  });
}

function formatDateOnly(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

module.exports = {
  buildHubReportHtml,
  buildStudyReportHtml,
  escapeHtml,
};
