/**
 * khmdhsPortfolioReportHtml.js — HTML templates για αναφορές χαρτοφυλακίου ΚΗΜΔΗΣ
 */
const APP_NAME = 'ERGOHUB';

const STAGE_LABELS = {
  REQ: 'Αίτημα (REQ)',
  COMMIT: 'Αποφάσεις ανάληψης υποχρέωσης',
  PROC: 'Δημοσίευση (PROC)',
  AWRD: 'Ανάθεση (AWRD)',
  SYMV: 'Σύμβαση (SYMV)',
  PAY: 'Πληρωμές (PAY)',
};

const GAP_SECTION_LABELS = {
  awrd_no_symv: 'Ανάθεση χωρίς Σύμβαση',
  proc_no_awrd: 'Δημοσίευση χωρίς Ανάθεση',
  proc_cancelled: 'Ματαιωμένη Δημοσίευση',
};

const GAP_GUIDANCE = {
  awrd_no_symv: 'Ανακτήστε ή καταχωρήστε τη σύμβαση (SYMV) από ΚΗΜΔΗΣ.',
  proc_no_awrd: 'Ελέγξτε αν η δημοσίευση ολοκληρώθηκε και ανακτήστε την ανάθεση (AWRD).',
  proc_cancelled: 'Επιβεβαιώστε την κατάσταση υποέργου — η δημοσίευση ματαιώθηκε στο ΚΗΜΔΗΣ.',
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuro(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatDateGreek(iso) {
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso || '');
  }
}

const REPORT_CSS = `
:root {
  --indigo: #4f46e5;
  --indigo-light: #eef2ff;
  --indigo-dark: #3730a3;
  --slate900: #0f172a;
  --slate800: #1e293b;
  --slate600: #475569;
  --slate500: #64748b;
  --slate200: #e2e8f0;
  --slate100: #f1f5f9;
  --green: #059669;
  --amber: #d97706;
  --red: #dc2626;
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
  background: linear-gradient(135deg, #3730a3 0%, #4f46e5 45%, #6366f1 100%);
  color: #fff;
  padding: 26px 30px 22px;
  position: relative;
  overflow: hidden;
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
}
.stat-pill {
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
}
.content { padding: 22px 30px 26px; }
.section { margin-bottom: 22px; }
.section:last-child { margin-bottom: 0; }
.section-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--indigo-dark);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--indigo-light);
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 4px;
}
.kpi-card {
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  border: 1px solid var(--slate200);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.kpi-value {
  font-size: 18px;
  font-weight: 900;
  color: var(--indigo-dark);
  line-height: 1.1;
}
.kpi-label {
  font-size: 8.5px;
  font-weight: 700;
  color: var(--slate500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}
.pipeline-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 10px;
}
.pipeline-label { width: 140px; flex-shrink: 0; font-weight: 600; color: var(--slate600); }
.pipeline-bar-wrap {
  flex: 1;
  height: 10px;
  background: var(--slate100);
  border-radius: 99px;
  overflow: hidden;
}
.pipeline-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #4f46e5);
  border-radius: 99px;
}
.pipeline-value { width: 100px; text-align: right; font-weight: 800; color: var(--slate800); }
table.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 10px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--slate200);
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
  border-bottom: 2px solid #c7d2fe;
}
table.data-table tbody td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  line-height: 1.4;
}
table.data-table tbody tr:nth-child(even) td { background: #f8fafc; }
table.data-table tbody tr:last-child td { border-bottom: none; }
.gap-group {
  margin-bottom: 18px;
  border: 1px solid var(--slate200);
  border-radius: 10px;
  overflow: hidden;
}
.gap-group-head {
  background: #fef2f2;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 800;
  color: #991b1b;
  border-bottom: 1px solid #fecaca;
}
.gap-group-head.amber { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.gap-group-head.slate { background: var(--slate100); color: var(--slate600); border-color: var(--slate200); }
.gap-hint {
  font-size: 9px;
  font-weight: 600;
  color: var(--slate500);
  padding: 8px 14px;
  background: #fafafa;
  border-bottom: 1px solid var(--slate200);
}
.score-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  background: var(--indigo-light);
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  margin-bottom: 16px;
}
.score-num {
  font-size: 36px;
  font-weight: 900;
  color: var(--indigo-dark);
  line-height: 1;
}
.score-meta { font-size: 10px; color: var(--slate600); line-height: 1.5; }
.empty-msg {
  text-align: center;
  color: var(--slate500);
  font-style: italic;
  padding: 16px;
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
.pct-good { color: var(--green); font-weight: 800; }
.pct-warn { color: var(--amber); font-weight: 800; }
.pct-bad { color: var(--red); font-weight: 800; }
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
    <span>${escapeHtml(footerLeft || '')}</span>
    <span>${escapeHtml(footerRight || '')}</span>
  </footer>
</div>
</body>
</html>`;
}

function buildPipelineHtml(stats) {
  const p = stats.pipeline || {};
  const base = p.approved || 0;
  if (!base && !p.symvTotal) return '<p class="empty-msg">Δεν υπάρχουν οικονομικά δεδομένα ΚΗΜΔΗΣ.</p>';

  const rows = [
    { label: 'Εγκεκριμένο σύνολο', value: p.approved, pct: 100 },
    { label: 'Αιτήματα REQ', value: p.reqTotal, pct: base > 0 ? Math.round((p.reqTotal / base) * 100) : 0 },
    { label: STAGE_LABELS.COMMIT, value: p.commitTotal, pct: base > 0 ? Math.round((p.commitTotal / base) * 100) : 0 },
    { label: 'Εκτίμηση PROC', value: p.procTotal, pct: base > 0 ? Math.round((p.procTotal / base) * 100) : 0 },
    { label: 'Ανάθεση AWRD', value: p.awrdTotal, pct: base > 0 ? Math.round((p.awrdTotal / base) * 100) : 0 },
    { label: 'Σύμβαση SYMV', value: p.symvTotal, pct: base > 0 ? Math.round((p.symvTotal / base) * 100) : 0 },
    { label: 'Πληρωμές PAY', value: p.payTotal, pct: base > 0 ? Math.round((p.payTotal / base) * 100) : 0 },
  ].filter((r) => r.value > 0);

  return rows.map((r) => `
    <div class="pipeline-row">
      <div class="pipeline-label">${escapeHtml(r.label)}</div>
      <div class="pipeline-bar-wrap"><div class="pipeline-bar" style="width:${Math.min(r.pct, 100)}%"></div></div>
      <div class="pipeline-value">${formatEuro(r.value)} ${r.pct !== 100 ? `(${r.pct}%)` : ''}</div>
    </div>
  `).join('');
}

function buildFunnelTableHtml(stats) {
  const total = stats.total || 0;
  const order = ['REQ', 'COMMIT', 'PROC', 'AWRD', 'SYMV', 'PAY'];
  const rows = order.map((id) => {
    const count = (stats.funnel?.[id] || []).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const amt = stats.stageDetails?.[id]?.total;
    return `<tr>
      <td>${escapeHtml(STAGE_LABELS[id] || id)}</td>
      <td style="text-align:center;font-weight:800">${count}</td>
      <td style="text-align:center">${pct}%</td>
      <td style="text-align:right">${amt > 0 ? formatEuro(amt) : '—'}</td>
    </tr>`;
  }).join('');

  return `<table class="data-table">
    <thead><tr><th>Στάδιο</th><th>Υποέργα</th><th>%</th><th>Σύνολο ποσού</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildGapGroupsHtml(stats) {
  const gaps = stats.gaps || {};
  const keys = Object.keys(GAP_SECTION_LABELS);
  let html = '';
  keys.forEach((key) => {
    const items = gaps[key] || [];
    if (!items.length) return;
    const headClass = key === 'proc_cancelled' ? 'slate' : '';
    html += `<div class="gap-group">
      <div class="gap-group-head ${headClass}">${escapeHtml(GAP_SECTION_LABELS[key])} (${items.length})</div>
      <div class="gap-hint">${escapeHtml(GAP_GUIDANCE[key] || '')}</div>
      <table class="data-table">
        <thead><tr><th>Υποέργο</th><th>Έργο</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr>
            <td>${escapeHtml(item.subprojectTitle || '—')}</td>
            <td>${escapeHtml(item.projectTitle || '—')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  });
  return html || '<p class="empty-msg">Δεν εντοπίστηκαν κενά αλυσίδας — όλα τα υποέργα προχωρούν κανονικά.</p>';
}

function buildVarianceTableHtml(stats, limit = 40) {
  const rows = (stats.varianceRows || []).filter((r) => r.symvAmount > 0).slice(0, limit);
  if (!rows.length) return '<p class="empty-msg">Δεν υπάρχουν συγκρίσεις PROC / SYMV / PAY.</p>';
  const body = rows.map((r) => {
    const pct = r.executionPct;
    const pctClass = pct == null ? '' : pct >= 80 ? 'pct-good' : pct >= 40 ? 'pct-warn' : 'pct-bad';
    return `<tr>
      <td>${escapeHtml(r.subprojectTitle || r.projectTitle || '—')}</td>
      <td style="text-align:right">${r.procAmount != null ? formatEuro(r.procAmount) : '—'}</td>
      <td style="text-align:right">${formatEuro(r.symvAmount)}</td>
      <td style="text-align:right">${r.payAmount != null ? formatEuro(r.payAmount) : '—'}</td>
      <td style="text-align:center" class="${pctClass}">${pct != null ? `${pct}%` : '—'}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table">
    <thead><tr><th>Υποέργο</th><th>Εκτίμ. PROC</th><th>Σύμβαση</th><th>Πληρωμές</th><th>% εκτ.</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function buildPayTimelineHtml(stats) {
  const amounts = stats.payByMonthAmounts || {};
  const months = Object.keys(amounts).sort().slice(-18);
  if (!months.length) return '<p class="empty-msg">Δεν υπάρχουν πληρωμές ανά μήνα.</p>';
  const rows = months.map((ym) => `<tr>
    <td>${escapeHtml(ym)}</td>
    <td style="text-align:right;font-weight:800">${formatEuro(amounts[ym])}</td>
    <td style="text-align:center">${stats.payByMonth?.[ym] || '—'}</td>
  </tr>`).join('');
  return `<table class="data-table">
    <thead><tr><th>Μήνας</th><th>Ποσό</th><th>Αρ. ενταλμάτων</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function commonMeta({ organizationName, exportedBy, appVersion, filterNote, projectCount }) {
  const now = formatDateGreek(new Date().toISOString());
  return {
    org: organizationName || 'Δήμος',
    exportedBy: exportedBy || '',
    appVersion: appVersion || '',
    filterNote: filterNote || `${projectCount || 0} υποέργα (ενεργά φίλτρα οθόνης)`,
    now,
  };
}

function buildPortfolioReportHtml(opts = {}) {
  const stats = opts.stats || {};
  const meta = commonMeta(opts);
  const hb = stats.healthBar || {};
  const body = `
    <div class="section">
      <h2 class="section-title">Σύνοψη χαρτοφυλακίου</h2>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-value">${stats.total || 0}</div><div class="kpi-label">Υποέργα</div></div>
        <div class="kpi-card"><div class="kpi-value">${hb.fullChain || 0}</div><div class="kpi-label">Πλήρης αλυσίδα</div></div>
        <div class="kpi-card"><div class="kpi-value">${hb.stuck || 0}</div><div class="kpi-label">Χρειάζονται προσοχή</div></div>
        <div class="kpi-card"><div class="kpi-value">${hb.awaitingFirstPayment || 0}</div><div class="kpi-label">Χωρίς εντάλματα ακόμα</div></div>
        <div class="kpi-card"><div class="kpi-value">${stats.reliabilityScore ?? '—'}</div><div class="kpi-label">Σκορ ποιότητας</div></div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Funnel σταδίων ΚΗΜΔΗΣ</h2>
      ${buildFunnelTableHtml(stats)}
    </div>
    <div class="section">
      <h2 class="section-title">Χρηματικός αγωγός</h2>
      ${buildPipelineHtml(stats)}
      <p style="font-size:10px;color:#64748b;margin-top:10px">
        Εκτέλεση: ${stats.payVsSymvPct != null ? `${stats.payVsSymvPct}%` : '—'} πληρωμένο/συμβατό
        · Συμβασιοποίηση: ${stats.symvVsApprovedPct != null ? `${stats.symvVsApprovedPct}%` : '—'} συμβατό/εγκεκριμένο
      </p>
    </div>
    <div class="section">
      <h2 class="section-title">Κενά αλυσίδας (σύνοψη)</h2>
      ${buildGapGroupsHtml(stats)}
    </div>
  `;

  return wrapReportHtml({
    title: 'Αναφορά Χαρτοφυλακίου',
    headerTitle: 'Αναφορά Χαρτοφυλακίου Υποέργων',
    headerSub: `${escapeHtml(meta.org)} · ${escapeHtml(meta.filterNote)}`,
    statPills: [
      `Πλήρης αλυσίδα: ${hb.fullChain || 0}`,
      `Σε εξέλιξη: ${hb.inProgress || 0}`,
      `Σκορ: ${stats.reliabilityScore ?? '—'}/100`,
    ],
    bodyHtml: body,
    footerLeft: `Εξαγωγή: ${meta.now} · ${meta.exportedBy}`,
    footerRight: `${APP_NAME} v${meta.appVersion}`,
  });
}

function buildGapReportHtml(opts = {}) {
  const stats = opts.stats || {};
  const meta = commonMeta(opts);
  const stuckTotal = Object.values(stats.gaps || {}).reduce((s, a) => s + a.length, 0);

  const body = `
    <div class="section">
      <h2 class="section-title">Υποέργα που χρειάζονται ενέργεια</h2>
      <p style="font-size:10px;color:#64748b;margin-bottom:14px">
        Συνολικά ${stuckTotal} υποέργα με κενά στην αλυσίδα ΚΗΜΔΗΣ. Κάθε ενότητα περιλαμβάνει οδηγίες για την απαιτούμενη ενέργεια.
      </p>
      ${buildGapGroupsHtml(stats)}
    </div>
    ${(stats.attentionList || []).length ? `
    <div class="section">
      <h2 class="section-title">Λοιπά θέματα ποιότητας δεδομένων</h2>
      <table class="data-table">
        <thead><tr><th>Υποέργο</th><th>Κατάσταση</th><th>Θέματα</th></tr></thead>
        <tbody>
          ${(stats.attentionList || []).slice(0, 30).map((item) => `<tr>
            <td>${escapeHtml(item.subprojectTitle || item.projectTitle)}</td>
            <td>${escapeHtml(item.projectStatus || '—')}</td>
            <td>${escapeHtml((item.issues || []).join(' · '))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  `;

  return wrapReportHtml({
    title: 'Κενά Αλυσίδας ΚΗΜΔΗΣ',
    headerTitle: 'Αναφορά Κενών Αλυσίδας ΚΗΜΔΗΣ',
    headerSub: `${escapeHtml(meta.org)} · ${escapeHtml(meta.filterNote)}`,
    statPills: [`Χρειάζονται προσοχή: ${stuckTotal}`, `Λίστα προσοχής: ${(stats.attentionList || []).length}`],
    bodyHtml: body,
    footerLeft: `Εξαγωγή: ${meta.now} · ${meta.exportedBy}`,
    footerRight: `${APP_NAME} v${meta.appVersion}`,
  });
}

function buildFinancialReportHtml(opts = {}) {
  const stats = opts.stats || {};
  const meta = commonMeta(opts);
  const p = stats.pipeline || {};

  const body = `
    <div class="section">
      <h2 class="section-title">Οικονομική εικόνα</h2>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-value">${formatEuro(p.approved)}</div><div class="kpi-label">Εγκεκριμένο</div></div>
        <div class="kpi-card"><div class="kpi-value">${formatEuro(p.symvTotal)}</div><div class="kpi-label">Συμβατό</div></div>
        <div class="kpi-card"><div class="kpi-value">${formatEuro(p.payTotal)}</div><div class="kpi-label">Πληρωμένο</div></div>
        <div class="kpi-card"><div class="kpi-value">${stats.payVsSymvPct != null ? `${stats.payVsSymvPct}%` : '—'}</div><div class="kpi-label">% Εκτέλεσης</div></div>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Χρηματικός αγωγός</h2>
      ${buildPipelineHtml(stats)}
    </div>
    <div class="section">
      <h2 class="section-title">Αποκλίσεις ανά υποέργο</h2>
      ${buildVarianceTableHtml(stats)}
    </div>
    <div class="section">
      <h2 class="section-title">Timeline πληρωμών (ανά μήνα)</h2>
      ${buildPayTimelineHtml(stats)}
    </div>
  `;

  return wrapReportHtml({
    title: 'Οικονομική Αναφορά',
    headerTitle: 'Οικονομική Αναφορά Υποέργων',
    headerSub: `${escapeHtml(meta.org)} · ${escapeHtml(meta.filterNote)}`,
    statPills: [
      `Συμβασιοποίηση: ${stats.symvVsApprovedPct != null ? `${stats.symvVsApprovedPct}%` : '—'}`,
      `Εκτέλεση: ${stats.payVsSymvPct != null ? `${stats.payVsSymvPct}%` : '—'}`,
    ],
    bodyHtml: body,
    footerLeft: `Εξαγωγή: ${meta.now} · ${meta.exportedBy}`,
    footerRight: `${APP_NAME} v${meta.appVersion}`,
  });
}

module.exports = {
  buildPortfolioReportHtml,
  buildGapReportHtml,
  buildFinancialReportHtml,
};
