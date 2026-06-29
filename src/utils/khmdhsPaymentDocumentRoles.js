/**
 * Χαρακτηρισμός εγγράφων PAY από τον χρήστη — τι μετράει στο άθροισμα πληρωμών.
 */

export const PAYMENT_DOCUMENT_ROLE = {
  PAYMENT_ORDER: 'payment_order',
  INFORMATIVE: 'informative',
  CO_FINANCING: 'co_financing_reimbursement',
  EXCLUDED: 'excluded',
};

export const PAYMENT_DOCUMENT_ROLE_LABELS = {
  [PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER]: 'Ένταλμα πληρωμής (μετράει)',
  [PAYMENT_DOCUMENT_ROLE.INFORMATIVE]: 'Ενημερωτικό — δεν μετράει',
  [PAYMENT_DOCUMENT_ROLE.CO_FINANCING]: 'Αποζημίωση συγχρηματοδότησης — δεν μετράει ως δεύτερη πληρωμή',
  [PAYMENT_DOCUMENT_ROLE.EXCLUDED]: 'Εξαιρείται — δεν μετράει',
};

export const PAYMENT_DOCUMENT_ROLE_SHORT = {
  [PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER]: 'Ένταλμα',
  [PAYMENT_DOCUMENT_ROLE.INFORMATIVE]: 'Ενημερωτικό',
  [PAYMENT_DOCUMENT_ROLE.CO_FINANCING]: 'Συγχρημ.',
  [PAYMENT_DOCUMENT_ROLE.EXCLUDED]: 'Εξαιρείται',
};

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase();
}

export function normalizePaymentDocumentRole(role) {
  const r = String(role || '').trim();
  return Object.values(PAYMENT_DOCUMENT_ROLE).includes(r)
    ? r
    : PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER;
}

export function paymentRoleCountsTowardTotal(role) {
  return normalizePaymentDocumentRole(role) === PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER;
}

/** Πρόταση ρόλου από τίτλο/φορέα — ο χρήστης επιβεβαιώνει πάντα όταν χρειάζεται έλεγχος. */
export function suggestPaymentDocumentRole(entry = {}, { coFinancingPattern = null } = {}) {
  const snap = entry?.snapshot || entry;
  const title = String(snap?.title || '').trim();
  const payerType = entry?.payer?.type || entry?.payerType || '';
  const upper = title.toUpperCase();

  if (snap?.cancelled || snap?.credit) {
    return PAYMENT_DOCUMENT_ROLE.EXCLUDED;
  }

  const looksLikeOrder = /ΕΝΤΟΛ|ΠΛΗΡΩΜ|ΕΝΤΑΛΜ/i.test(upper);
  if (!looksLikeOrder && title.length > 10) {
    return PAYMENT_DOCUMENT_ROLE.INFORMATIVE;
  }

  if (
    coFinancingPattern
    && payerType === 'regional_fund'
    && looksLikeOrder
  ) {
    return PAYMENT_DOCUMENT_ROLE.CO_FINANCING;
  }

  if (
    coFinancingPattern
    && (payerType === 'contracting_authority' || payerType === 'municipality')
  ) {
    return PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER;
  }

  return PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER;
}

export function readPaymentDocumentRoleFromPayment(payment) {
  return normalizePaymentDocumentRole(payment?.userDocumentRole);
}

export function readPaymentDocumentLabelFromPayment(payment) {
  return String(payment?.userDocumentLabel || '').trim();
}

export function readPaymentLabelsFromReviewResolution(resolution) {
  const fromMeta = resolution?.meta?.paymentLabels;
  if (fromMeta && typeof fromMeta === 'object') {
    const out = {};
    Object.entries(fromMeta).forEach(([adam, label]) => {
      const key = normalizeAdam(adam);
      const text = String(label || '').trim();
      if (key && text) out[key] = text;
    });
    return out;
  }
  return {};
}

export function mergePaymentLabelsFromProject(project, review = null, item = null) {
  const labels = {};
  (project?.khmdhsPayments || []).forEach((p) => {
    const adam = normalizeAdam(p?.adam || p?.snapshot?.referenceNumber);
    const label = readPaymentDocumentLabelFromPayment(p);
    if (adam && label) labels[adam] = label;
  });

  const key = item ? `paymentsReconciliation::${item.contractIndex != null ? item.contractIndex : 'shared'}` : '';
  const resolution = key && review?.resolutions?.[key]
    ? review.resolutions[key]
    : review?.resolutions?.['paymentsReconciliation::shared'];
  Object.assign(labels, readPaymentLabelsFromReviewResolution(resolution));
  return labels;
}

export function resolvePaymentDisplayLabel(payment, role = '') {
  const custom = readPaymentDocumentLabelFromPayment(payment);
  if (custom) return custom;
  const normalizedRole = normalizePaymentDocumentRole(role || payment?.userDocumentRole);
  if (normalizedRole && normalizedRole !== PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER) {
    return PAYMENT_DOCUMENT_ROLE_SHORT[normalizedRole] || PAYMENT_DOCUMENT_ROLE_LABELS[normalizedRole] || '';
  }
  return '';
}

export function readPaymentRolesFromReviewResolution(resolution) {
  const fromMeta = resolution?.meta?.paymentRoles;
  if (fromMeta && typeof fromMeta === 'object') {
    const out = {};
    Object.entries(fromMeta).forEach(([adam, role]) => {
      const key = normalizeAdam(adam);
      if (key) out[key] = normalizePaymentDocumentRole(role);
    });
    return out;
  }
  return {};
}

export function mergePaymentRolesFromProject(project, review = null, item = null) {
  const roles = {};
  (project?.khmdhsPayments || []).forEach((p) => {
    const adam = normalizeAdam(p?.adam || p?.snapshot?.referenceNumber);
    if (!adam) return;
    if (p?.userDocumentRole) roles[adam] = normalizePaymentDocumentRole(p.userDocumentRole);
  });

  const key = item ? `paymentsReconciliation::${item.contractIndex != null ? item.contractIndex : 'shared'}` : '';
  const resolution = key && review?.resolutions?.[key]
    ? review.resolutions[key]
    : review?.resolutions?.['paymentsReconciliation::shared'];
  Object.assign(roles, readPaymentRolesFromReviewResolution(resolution));
  return roles;
}

export function applyPaymentRolesToProject(formData, paymentRoles = {}, paymentLabels = {}) {
  if (!formData) return formData;
  const hasRoles = paymentRoles && typeof paymentRoles === 'object' && Object.keys(paymentRoles).length > 0;
  const hasLabels = paymentLabels && typeof paymentLabels === 'object' && Object.keys(paymentLabels).length > 0;
  if (!hasRoles && !hasLabels) return formData;

  const now = new Date().toISOString();
  const list = Array.isArray(formData.khmdhsPayments) ? formData.khmdhsPayments : [];
  if (!list.length) return formData;

  let changed = false;
  const nextPayments = list.map((p) => {
    const adam = normalizeAdam(p?.adam || p?.snapshot?.referenceNumber);
    const role = adam && Object.prototype.hasOwnProperty.call(paymentRoles, adam)
      ? paymentRoles[adam]
      : null;
    const label = adam && Object.prototype.hasOwnProperty.call(paymentLabels, adam)
      ? String(paymentLabels[adam] || '').trim()
      : String(p.userDocumentLabel || '').trim();
    const nextRole = role != null ? normalizePaymentDocumentRole(role) : p.userDocumentRole;
    const prevLabel = String(p.userDocumentLabel || '').trim();
    if ((p.userDocumentRole || '') === (nextRole || '') && prevLabel === label) return p;
    changed = true;
    return {
      ...p,
      ...(nextRole ? { userDocumentRole: nextRole, userDocumentRoleAt: now } : {}),
      userDocumentLabel: label,
      userDocumentLabelAt: label ? now : (p.userDocumentLabelAt || ''),
    };
  });

  return changed ? { ...formData, khmdhsPayments: nextPayments } : formData;
}

export function buildDefaultPaymentRoleDraft(reconEntries = [], coFinancingPattern = null) {
  const draft = {};
  (reconEntries || []).forEach((entry) => {
    const adam = normalizeAdam(entry?.adam);
    if (!adam || !entry?.active) return;
    draft[adam] = suggestPaymentDocumentRole(entry, { coFinancingPattern });
  });
  return draft;
}

export function validatePaymentRoleDraft(reconEntries = [], roleDraft = {}) {
  const active = (reconEntries || []).filter((e) => e?.active && e?.adam);
  const missing = active.filter((e) => !roleDraft[normalizeAdam(e.adam)]);
  if (missing.length) {
    return { ok: false, error: 'Χαρακτηρίστε όλα τα ενεργά έγγραφα πληρωμής.' };
  }
  return { ok: true };
}

export function paymentDisplayTitle(role, index, total, customLabel = '') {
  const suffix = total > 1 ? ` ${index + 1}` : '';
  const custom = String(customLabel || '').trim();
  if (custom) return `📄 ${custom}${suffix}`;
  const short = PAYMENT_DOCUMENT_ROLE_SHORT[normalizePaymentDocumentRole(role)] || 'Έγγραφο PAY';
  if (role === PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER) {
    return `💶 Ένταλμα πληρωμής${suffix}`;
  }
  return `📄 ${short}${suffix}`;
}
