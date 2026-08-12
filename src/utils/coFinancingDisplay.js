/**
 * Εμφάνιση χρηματοδότησης υποέργου — απλή ή συγχρηματοδότηση (πολλές πηγές).
 */

export function isCoFinancedProject(project) {
  return project?.coFinanced === true
    && Array.isArray(project.fundingSources)
    && project.fundingSources.length > 0;
}

/** Γραμμές με ουσιαστικό περιεχόμενο για προβολή. */
export function getVisibleFundingSourceRows(project) {
  if (!isCoFinancedProject(project)) return [];
  return project.fundingSources.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    return !!(
      String(row.source || '').trim()
      || String(row.details || '').trim()
      || String(row.amount || '').trim()
    );
  });
}

/**
 * Ερμηνεία ποσού συγχρηματοδότησης (EL/US) — ίδια λογική με τη φόρμα.
 * Π.χ. `10.000,00` → 10000 · `5000.00` → 5000 · `5,5` → 5.5
 */
export function parseCoFinancingAmount(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized;
  if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (hasComma) normalized = cleaned.replace(',', '.');
  else if (hasDot) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const [, frac = ''] = cleaned.split('.');
      normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
    } else normalized = cleaned.replace(/\./g, '');
  } else normalized = cleaned;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Συγχρονίζει τα μοναδικά πεδία (φίλτρα / συμβατότητα) από τις γραμμές συγχρηματοδότησης.
 * Το εγκεκριμένο = άθροισμα εκτός ιδίων πόρων.
 */
export function syncPrimaryFundingFieldsFromSources(project) {
  if (!project || project.coFinanced !== true) return project;
  const rows = Array.isArray(project.fundingSources) ? project.fundingSources : [];
  if (!rows.length) return project;

  const isOwn = (details) => String(details || '').toUpperCase().includes('ΙΔΙΟΙ ΠΟΡΟΙ');
  const countable = rows.filter((r) => r && !isOwn(r.details) && !r.ownResources);
  const sum = countable.reduce((s, r) => s + parseCoFinancingAmount(r.amount), 0);
  const primary = countable.find((r) => r.source) || rows.find((r) => r && r.source) || null;
  const approved = sum > 0
    ? sum.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (project.approvedAmount || '');

  return {
    ...project,
    fundingSource: primary?.source || project.fundingSource || '',
    fundingDetails: primary?.details || project.fundingDetails || '',
    approvedAmount: approved || project.approvedAmount || '',
  };
}
