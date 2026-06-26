/**
 * statisticsReportHtml.js — HTML templates για εξαγωγή στατιστικών (ανά tab / πλήρης)
 */

const APP_NAME = 'ERGOHUB';

const TAB_TITLES = {
  overview: 'Σύνοψη',
  funding: 'Χρηματοδότηση',
  chain: 'Αλυσίδα ΚΗΜΔΗΣ',
  financial: 'Οικονομικά ΚΗΜΔΗΣ',
  quality: 'Ποιότητα Δεδομένων',
  assignment: 'Διαδικασίες Ανάθεσης',
  procurement: 'Δημοσίευση',
  contractors: 'Ανάδοχοι',
  'contractor-chronology': 'Χρονολόγιο Αναδόχων',
};

const GAP_TYPE_LABELS = {
  awrd_no_symv: 'Ανάθεση χωρίς Σύμβαση',
  proc_no_awrd: 'Δημοσίευση χωρίς Ανάθεση',
  proc_cancelled: 'Ματαιωμένη Δημοσίευση',
  symv_no_pay: 'Σύμβαση χωρίς Εντάλματα Πληρωμής',
};

const STAGE_LABELS = {
  REQ: 'Αιτήματα',
  COMMIT: 'Αποφάσεις ανάληψης υποχρέωσης',
  PROC: 'Δημοσίευση',
  AWRD: 'Ανάθεση',
  SYMV: 'Σύμβαση',
  PAY: 'Πληρωμές',
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

function formatPctInt(pct, { signed = false } = {}) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const rounded = Math.round(Number(pct));
  if (signed && rounded > 0) return `+${rounded}%`;
  return `${rounded}%`;
}

function formatDateEl(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR');
  } catch {
    return String(iso);
  }
}

function formatCellValue(value) {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  if (typeof value === 'object') return '—';
  return String(value);
}

function baseStyles() {
  return `
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; font-size: 11px; }
    .page { padding: 28px 32px; }
    .page-break { page-break-before: always; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 13px; margin: 18px 0 8px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    h3 { font-size: 11px; margin: 12px 0 6px; color: #475569; }
    .meta { font-size: 10px; color: #64748b; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; font-size: 10px; }
    td.num { text-align: right; white-space: nowrap; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; }
    .kpi-lbl { font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .empty { color: #94a3b8; font-style: italic; padding: 8px 0; }
    .note { font-size: 10px; color: #64748b; margin: 6px 0 10px; }
    .gap-head { font-weight: 700; color: #334155; margin: 10px 0 4px; font-size: 10px; }
  `;
}

function wrapDocument({ title, bodyHtml, meta }) {
  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="page">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(meta)}</div>
    ${bodyHtml}
    <div class="footer">${APP_NAME} · ${escapeHtml(new Date().toLocaleString('el-GR'))}</div>
  </div>
</body>
</html>`;
}

function kvTable(rows) {
  if (!rows.length) return '<p class="empty">Δεν υπάρχουν δεδομένα</p>';
  return `<table><tbody>${rows.map(([k, v]) =>
    `<tr><th style="width:42%">${escapeHtml(k)}</th><td>${escapeHtml(formatCellValue(v))}</td></tr>`
  ).join('')}</tbody></table>`;
}

function countAmountTable(obj, { countOnly = false } = {}) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '<p class="empty">Δεν υπάρχουν δεδομένα</p>';
  const amountCol = countOnly
    ? ''
    : '<th>Ποσό</th>';
  return `<table>
    <thead><tr><th>Κατηγορία</th><th>Πλήθος</th>${amountCol}</tr></thead>
    <tbody>${entries.map(([k, v]) => {
      const count = typeof v === 'object' && v != null ? v.count : v;
      const amount = typeof v === 'object' && v != null ? v.amount : null;
      const amountCell = countOnly
        ? ''
        : `<td class="num">${amount != null ? escapeHtml(formatEuro(amount)) : '—'}</td>`;
      return `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(formatCellValue(count))}</td>${amountCell}</tr>`;
    }).join('')}</tbody></table>`;
}

function distributionTable(obj, { valueLabel = 'Πλήθος', amountLabel = 'Ποσό' } = {}) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '<p class="empty">Δεν υπάρχουν δεδομένα</p>';
  const hasAmount = entries.some(([, v]) => typeof v === 'object' && v != null && v.amount != null);
  return `<table>
    <thead><tr><th>Κατηγορία</th><th>${escapeHtml(valueLabel)}</th>${hasAmount ? `<th>${escapeHtml(amountLabel)}</th>` : ''}</tr></thead>
    <tbody>${entries.map(([k, v]) => {
      const count = typeof v === 'object' && v != null ? v.count : v;
      const amount = typeof v === 'object' && v != null ? v.amount : null;
      return `<tr>
        <td>${escapeHtml(k)}</td>
        <td class="num">${escapeHtml(formatCellValue(count))}</td>
        ${hasAmount ? `<td class="num">${amount != null ? escapeHtml(formatEuro(amount)) : '—'}</td>` : ''}
      </tr>`;
    }).join('')}</tbody></table>`;
}

function buildOverviewHtml(s) {
  const st = s.statistics || {};
  const contractedPct = st.totalFunding > 0
    ? Math.round((st.totalContracted / st.totalFunding) * 100)
    : 0;
  return `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${st.uniqueProjects || 0}</div><div class="kpi-lbl">Έργα</div></div>
      <div class="kpi"><div class="kpi-val">${st.totalProjects || 0}</div><div class="kpi-lbl">Υποέργα</div></div>
      <div class="kpi"><div class="kpi-val">${st.inProgressCount || 0}</div><div class="kpi-lbl">Εκτελούμενα</div></div>
      <div class="kpi"><div class="kpi-val">${formatEuro(st.totalFunding)}</div><div class="kpi-lbl">Εγκεκριμένη χρηματοδότηση</div></div>
    </div>
    ${kvTable([
      ['Ολοκληρωμένα (εκτέλεση)', String(st.completedCount || 0)],
      ['Συμβασιοποιημένο σύνολο', formatEuro(st.totalContracted)],
      ['% Συμβασιοποίησης', `${contractedPct}%`],
      ['Μοναδικοί ανάδοχοι', String(st.uniqueContractors || 0)],
    ])}
    <h2>Είδη υποέργων</h2>
    ${countAmountTable(Object.fromEntries(Object.entries(st.projectTypes || {}).map(([k, v]) => [k, { count: v, amount: null }])), { countOnly: true })}
    <h2>Χρηματοδότηση ανά πηγή</h2>
    ${countAmountTable(st.fundingSources)}
    <h2>Κατάσταση υποέργων</h2>
    ${countAmountTable(Object.fromEntries(Object.entries(st.projectStatuses || {}).map(([k, v]) => [k, { count: v, amount: null }])), { countOnly: true })}
  `;
}

function buildFundingHtml(s) {
  const st = s.statistics || {};
  return `
    ${kvTable([
      ['Συνολική εγκεκριμένη χρηματοδότηση', formatEuro(st.totalFunding)],
      ['Συμβασιοποιημένο σύνολο', formatEuro(st.totalContracted)],
    ])}
    <h2>Ανά πηγή χρηματοδότησης</h2>
    ${countAmountTable(st.fundingSources)}
    <h2>Ανά εξειδίκευση χρηματοδότησης</h2>
    ${countAmountTable(st.fundingDetails)}
  `;
}

function buildChainGapSectionsHtml(gaps) {
  const keys = Object.keys(GAP_TYPE_LABELS);
  let html = '';
  keys.forEach((key) => {
    const items = (gaps || {})[key] || [];
    if (!items.length) return;
    const rows = items.slice(0, 25).map((item) =>
      `<tr>
        <td>${escapeHtml(item.subprojectTitle || '—')}</td>
        <td>${escapeHtml(item.projectTitle || '—')}</td>
      </tr>`
    ).join('');
    const more = items.length > 25 ? `<p class="note">…και ${items.length - 25} ακόμη</p>` : '';
    html += `
      <div class="gap-head">${escapeHtml(GAP_TYPE_LABELS[key])} (${items.length})</div>
      <table>
        <thead><tr><th>Υποέργο</th><th>Έργο</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${more}
    `;
  });
  return html || '<p class="empty">Δεν εντοπίστηκαν κενά αλυσίδας</p>';
}

function buildChainHtml(s) {
  const ps = s.portfolioStats || {};
  const p = ps.pipeline || {};
  const hb = ps.healthBar || {};
  const stages = ['REQ', 'COMMIT', 'PROC', 'AWRD', 'SYMV', 'PAY'];
  const funnelRows = stages.map((id) => {
    const count = (ps.funnel?.[id] || []).length;
    return `<tr><td>${escapeHtml(STAGE_LABELS[id])}</td><td class="num">${count}</td></tr>`;
  }).join('');
  return `
    ${kvTable([
      ['Πλήρης αλυσίδα', String(hb.fullChain ?? 0)],
      ['Σε εξέλιξη', String(hb.inProgress ?? 0)],
      ['Κολλημένα', String(hb.stuck ?? 0)],
      ['Πληρωμές / Σύμβαση', hb.payVsSymvPct != null ? formatPctInt(hb.payVsSymvPct) : '—'],
    ])}
    <h2>Αγωγός σταδίων ΚΗΜΔΗΣ</h2>
    <table><thead><tr><th>Στάδιο</th><th>Υποέργα</th></tr></thead><tbody>${funnelRows}</tbody></table>
    <h2>Χρηματικός αγωγός (ΚΗΜΔΗΣ)</h2>
    ${kvTable([
      ['Εγκεκριμένο σύνολο', formatEuro(p.approved)],
      ['Αιτήματα', formatEuro(p.reqTotal)],
      ['Αποφάσεις ανάληψης (τελευταία ετήσια / υποέργο)', formatEuro(p.commitTotal)],
      ['Εκτίμηση δημοσίευσης', formatEuro(p.procTotal)],
      ['Ανάθεση', formatEuro(p.awrdTotal)],
      ['Σύμβαση (από ΚΗΜΔΗΣ)', formatEuro(p.symvTotal)],
      ['Πληρωμές', formatEuro(p.payTotal)],
    ])}
    <h2>Κενά αλυσίδας</h2>
    ${buildChainGapSectionsHtml(ps.gaps)}
  `;
}

function buildFinancialHtml(s) {
  const ps = s.portfolioStats || {};
  const p = ps.pipeline || {};
  const rows = (ps.varianceRows || []).slice(0, 40).map((r) =>
    `<tr>
      <td>${escapeHtml(r.subprojectTitle || r.projectTitle)}</td>
      <td class="num">${formatEuro(r.procAmount)}</td>
      <td class="num">${formatEuro(r.symvAmount)}</td>
      <td class="num">${formatEuro(r.payAmount)}</td>
      <td class="num">${formatPctInt(r.executionPct)}</td>
    </tr>`
  ).join('');
  return `
    ${kvTable([
      ['Εκτέλεση (πληρωμές / σύμβαση)', ps.payVsSymvPct != null ? formatPctInt(ps.payVsSymvPct) : '—'],
      ['Συμβασιοποίηση (σύμβαση / εγκεκριμένο)', ps.symvVsApprovedPct != null ? formatPctInt(ps.symvVsApprovedPct) : '—'],
    ])}
    <h2>Χρηματικός αγωγός</h2>
    ${kvTable([
      ['Εγκεκριμένο', formatEuro(p.approved)],
      ['Σύμβαση (ΚΗΜΔΗΣ)', formatEuro(p.symvTotal)],
      ['Πληρωμές', formatEuro(p.payTotal)],
    ])}
    <h2>Σύγκριση ποσών ανά υποέργο</h2>
    <p class="note">Σύγκριση εκτίμησης δημοσίευσης, σύμβασης και πληρωμών (έως 40 υποέργα).</p>
    ${rows ? `<table>
      <thead><tr><th>Υποέργο</th><th>Εκτίμ. δημοσίευσης</th><th>Σύμβαση</th><th>Πληρωμές</th><th>% εκτέλεσης</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p class="empty">Δεν υπάρχουν συγκρίσιμα ποσά</p>'}
  `;
}

function buildQualityHtml(s) {
  const ps = s.portfolioStats || {};
  const parts = ps.scoreParts || {};
  const attention = (ps.attentionList || []).slice(0, 35).map((item) =>
    `<tr><td>${escapeHtml(item.subprojectTitle || item.projectTitle)}</td><td>${escapeHtml((item.issues || []).join(' · '))}</td></tr>`
  ).join('');
  return `
    ${kvTable([
      ['Σκορ αξιοπιστίας', ps.reliabilityScore != null ? `${ps.reliabilityScore}/100` : '—'],
      ['Κάλυψη ΚΗΜΔΗΣ', parts.khmdhsCoverage != null ? `${parts.khmdhsCoverage}%` : '—'],
      ['Χωρίς εκκρεμή έλεγχο ποιότητας', parts.dqrClean != null ? `${parts.dqrClean}%` : '—'],
      ['Ανανεωμένα δεδομένα', parts.freshnessGood != null ? `${parts.freshnessGood}%` : '—'],
    ])}
    <h2>Χρειάζονται προσοχή</h2>
    ${attention ? `<table><thead><tr><th>Υποέργο</th><th>Θέματα</th></tr></thead><tbody>${attention}</tbody></table>` : '<p class="empty">Δεν εντοπίστηκαν θέματα</p>'}
  `;
}

function buildAssignmentHtml(s) {
  const st = s.statistics || {};
  const violations = s.directAssignmentViolations || [];
  const violationRows = violations.slice(0, 30).map((v) =>
    `<tr>
      <td>${escapeHtml(v.subprojectTitle || v.projectTitle || '—')}</td>
      <td>${escapeHtml(v.message || v.summary || '—')}</td>
    </tr>`
  ).join('');
  return `
    ${kvTable([
      ['Με καταχωρημένη διαδικασία', String(st.assignmentWithProcedure || 0)],
      ['Χωρίς διαδικασία (όπου απαιτείται)', String(st.assignmentWithoutProcedure || 0)],
    ])}
    <h2>Κατανομή ανά διαδικασία</h2>
    ${countAmountTable(
      Object.fromEntries(
        Object.entries(st.assignmentProcedures || {}).filter(([, v]) => {
          const count = typeof v === 'object' && v != null ? v.count : v;
          return Number(count) > 0;
        })
      )
    )}
    <h2>Παραβάσεις απευθείας ανάθεσης</h2>
    <p class="note">${violations.length} εντοπισμένες περιπτώσεις${violations.length > 30 ? ' (εμφανίζονται οι πρώτες 30)' : ''}.</p>
    ${violationRows ? `<table><thead><tr><th>Υποέργο</th><th>Περιγραφή</th></tr></thead><tbody>${violationRows}</tbody></table>` : '<p class="empty">Δεν εντοπίστηκαν παραβάσεις</p>'}
  `;
}

function buildProcurementHtml(s) {
  const pr = s.procurementStats || {};

  return `
    <h2>Συνοπτικά στοιχεία</h2>
    ${kvTable([
      ['Ενεργές δημοσίευσεις', String(pr.activeCount || 0)],
      ['Συνολική εκτιμώμενη αξία (ενεργοί)', formatEuro(pr.totalEstimatedValue)],
      ['Υποέργα με δημοσίευση (ΚΗΜΔΗΣ)', String(pr.withNoticeCount || 0)],
      ['Ματαιωμένες δημοσίευσεις', String(pr.cancelledCount || 0)],
      ['Μέσος χρόνος υπογραφής → προθεσμία', pr.avgDaysSignedToDeadline != null ? `${pr.avgDaysSignedToDeadline} ημέρες` : '—'],
    ])}
    <h2>Κατανομή ανά διαδικασία (όλα τα υποέργα με δημοσίευση)</h2>
    ${distributionTable(pr.procedureDistribution, { valueLabel: 'Υποέργα' })}
    <h2>Κατανομή ανά τύπο δημοσίευσης</h2>
    ${distributionTable(pr.noticeTypeDistribution, { valueLabel: 'Υποέργα' })}
    <h2>Εκτιμώμενη αξία ενεργών δημοσιεύσεων ανά διαδικασία</h2>
    ${distributionTable(pr.activeEstimatedByProcedure)}
  `;
}

function getContractorList(s) {
  const list = [...(s.statistics?.contractors || [])];
  list.sort((a, b) => (b.amount || 0) - (a.amount || 0) || (b.count || 0) - (a.count || 0));
  return list;
}

function buildContractorsHtml(s) {
  const list = getContractorList(s).slice(0, 60);
  if (!list.length) return '<p class="empty">Δεν υπάρχουν καταγεγραμμένοι ανάδοχοι</p>';

  const totalAmount = list.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalContracts = list.reduce((sum, c) => sum + (Number(c.count) || 0), 0);
  const showVat = list.some((c) => String(c.vat || '').trim());
  const showMultiContracts = list.some((c) => (Number(c.count) || 0) > 1);

  const rows = list.map((c) => {
    const count = Number(c.count) || 0;
    const contractsCell = showMultiContracts
      ? `<td class="num">${count}</td>`
      : '';
    const vatCell = showVat
      ? `<td>${escapeHtml(c.vat || '—')}</td>`
      : '';
    const share = totalAmount > 0 ? Math.round(((Number(c.amount) || 0) / totalAmount) * 100) : 0;
    return `<tr>
      <td>${escapeHtml(c.name || '—')}</td>
      ${vatCell}
      ${contractsCell}
      <td class="num">${formatEuro(c.amount)}</td>
      <td class="num">${share}%</td>
    </tr>`;
  }).join('');

  return `
    ${kvTable([
      ['Μοναδικοί ανάδοχοι', String(list.length)],
      ['Συνολικές συμβάσεις', String(totalContracts)],
      ['Συνολικό ποσό συμβάσεων', formatEuro(totalAmount)],
    ])}
    <p class="note">Κάθε γραμμή είναι ένας μοναδικός ανάδοχος (συγχωνευμένος κατά επωνυμία/ΑΦΜ). Τα ποσά προέρχονται από δεδομένα σύμβασης ΚΗΜΔΗΣ.</p>
    <table>
      <thead><tr>
        <th>Ανάδοχος</th>
        ${showVat ? '<th>ΑΦΜ</th>' : ''}
        ${showMultiContracts ? '<th>Συμβάσεις</th>' : ''}
        <th>Συνολικό ποσό</th>
        <th>Μερίδιο</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildChronologyHtml(s) {
  const events = (s.contractorChronology || [])
    .filter((e) => e.contractDate)
    .sort((a, b) => (a.contractDate || '').localeCompare(b.contractDate || ''));

  if (!events.length) {
    return '<p class="empty">Δεν υπάρχουν συμβάσεις με καταγεγραμμένη ημερομηνία</p>';
  }

  const byYear = {};
  events.forEach((e) => {
    const year = new Date(e.contractDate).getFullYear();
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(e);
  });

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  let html = '<p class="note">Χρονολογική καταγραφή συμβάσεων ανά έτος — κάθε γραμμή είναι μία σύμβαση/ανάθεση.</p>';

  years.forEach((year) => {
    const yearEvents = byYear[year];
    const yearTotal = yearEvents.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    html += `<h3>${year} — ${yearEvents.length} συμβάσεις · ${formatEuro(yearTotal)}</h3>`;
    html += `<table>
      <thead><tr><th>Ημερομηνία</th><th>Ανάδοχος</th><th>Υποέργο</th><th>Ποσό</th></tr></thead>
      <tbody>${yearEvents.slice(0, 40).map((e) => `<tr>
        <td>${escapeHtml(formatDateEl(e.contractDate))}</td>
        <td>${escapeHtml(e.contractorName || '—')}</td>
        <td>${escapeHtml(e.subprojectTitle || e.projectTitle || '—')}</td>
        <td class="num">${formatEuro(e.amount)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
    if (yearEvents.length > 40) {
      html += `<p class="note">…και ${yearEvents.length - 40} ακόμη συμβάσεις το ${year}</p>`;
    }
  });

  return html;
}

const BUILDERS = {
  overview: buildOverviewHtml,
  funding: buildFundingHtml,
  chain: buildChainHtml,
  financial: buildFinancialHtml,
  quality: buildQualityHtml,
  assignment: buildAssignmentHtml,
  procurement: buildProcurementHtml,
  contractors: buildContractorsHtml,
  'contractor-chronology': buildChronologyHtml,
};

function buildTabSection(tabPayload) {
  const id = tabPayload.tabId;
  const builder = BUILDERS[id];
  const title = tabPayload.tabLabel || TAB_TITLES[id] || id;
  const inner = builder ? builder(tabPayload) : '<p class="empty">Μη διαθέσιμη ενότητα</p>';
  return `<section class="${tabPayload.pageBreak ? 'page-break' : ''}">
    <h2>${escapeHtml(title)}</h2>
    ${inner}
  </section>`;
}

function buildStatisticsReportHtml({
  tabs = [],
  organizationName = '',
  exportedBy = '',
  filterNote = '',
  projectCount = 0,
  reportTitle = 'Στατιστική Αναφορά',
}) {
  const meta = [
    organizationName,
    exportedBy ? `Εξαγωγή: ${exportedBy}` : '',
    filterNote || `${projectCount} υποέργα`,
  ].filter(Boolean).join(' · ');

  const body = tabs.map((tab, i) => buildTabSection({
    ...tab,
    pageBreak: i > 0,
  })).join('');

  return wrapDocument({ title: reportTitle, bodyHtml: body, meta });
}

module.exports = {
  buildStatisticsReportHtml,
  TAB_TITLES,
  GAP_TYPE_LABELS,
};
