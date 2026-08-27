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

/**
 * Διαβάζει το χειροκίνητο «πραγματικό ποσό» που πληρώνει το ένταλμα (userActualAmount).
 * Επιστρέφει θετικό αριθμό ή null όταν δεν έχει οριστεί.
 */
export function readPaymentActualAmountFromPayment(payment) {
  const raw = payment?.userActualAmount;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Εντοπίζει το ποσό μέσα στο κείμενο του τίτλου εντάλματος
 * (π.χ. «…ποσού 18.999,00 ευρώ…» ή «ΠΟΣΟΥ 18999,00 ΕΥΡΩ»).
 */
export function parsePaymentAmountFromTitle(title) {
  const s = String(title || '');
  if (!s) return null;
  const m = s.match(
    /ποσο[ύυ]\s*:?\s*(-?\d{1,3}(?:\.\d{3})+,\d{1,2}|-?\d{1,3}(?:\.\d{3})+|-?\d+,\d{1,2}|-?\d+\.\d{1,2}|-?\d+)\s*(?:ευρ[ωώ]?|€|eur)?/i
  );
  if (!m) return null;
  return parseCapturedTitleAmount(m[1]);
}

/** 18.999,00 → 18999 · 18.999 → 18999 · 18999,70 → 18999.7 · 12400.50 → 12400.5 */
function parseCapturedTitleAmount(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let n = null;
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s)) {
    n = Number(s.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    n = Number(s.replace(',', '.'));
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    n = Number(s.replace(/\./g, ''));
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    n = Number(s);
  } else if (/^\d+$/.test(s)) {
    n = Number(s);
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Προτεινόμενο πραγματικό ποσό από τον τίτλο, μόνο όταν είναι λογικό
 * (μικρότερο ή ίσο του καταχωρημένου ποσού στο ΚΗΜΔΗΣ).
 */
export function suggestPaymentActualAmount(title, grossAmount = null) {
  const parsed = parsePaymentAmountFromTitle(title);
  if (parsed == null) return null;
  const gross = Number(grossAmount);
  if (Number.isFinite(gross) && gross > 0 && parsed > gross + 0.5) return null;
  return parsed;
}

const AMOUNT_TOLERANCE = 0.5;

function amountsNear(a, b) {
  return Math.abs(Number(a) - Number(b)) <= AMOUNT_TOLERANCE;
}

function formatEuroEl(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return `${num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Αριθμός εντάλματος (XE …) από τον τίτλο πράξης ΚΗΜΔΗΣ. */
export function extractXeRefFromPaymentTitle(title) {
  const m = String(title || '').match(/\bXE[\s\-]*\d+\b/i);
  return m ? m[0].replace(/[\s\-]+/g, ' ').toUpperCase() : '';
}

/**
 * Η πύλη ΚΗΜΔΗΣ έχει στο πεδίο ποσού του κωδικού PAY κάτι που δεν είναι το ποσό του εντάλματος
 * (π.χ. ολόκληρη τη σύμβαση, ενώ στον τίτλο υπάρχει η δόση).
 */
export function detectKhmdhsPortalPaymentAmountIssue(entry = {}, opts = {}) {
  const snap = entry?.snapshot || {};
  const title = String(opts.title || snap.title || entry?.title || '');
  const gross = Number(entry?.gross ?? snap.totalCostWithVAT);
  if (!Number.isFinite(gross) || gross <= 0) return null;

  const titleAmount = suggestPaymentActualAmount(title, gross);
  const userActual = opts.userActualAmount != null
    ? Number(opts.userActualAmount)
    : readPaymentActualAmountFromPayment(entry);
  const fromTitle = titleAmount != null;
  const documentAmount = fromTitle
    ? titleAmount
    : (Number.isFinite(userActual) && userActual > 0 ? userActual : null);
  if (documentAmount == null) return null;
  // Χωρίς ποσό στον τίτλο, αγνόησε μισογραμμένα ψηφία (πληκτρολόγηση).
  if (!fromTitle && documentAmount < 100) return null;

  const payable = Number(opts.contractAmountGross);
  const hasPayable = Number.isFinite(payable) && payable > 0;
  const drop = gross - documentAmount;
  // ΦΠΑ / κρατήσεις είναι ~10–24%. Κάτω από το διπλάσιο είναι συνηθισμένη διαφορά τίτλου vs πύλης.
  if (drop < 1000 || documentAmount + 0.5 >= gross) return null;
  if (gross < documentAmount * 2) return null;

  return {
    adam: normalizeAdam(entry.adam || snap.referenceNumber),
    khmdhsGross: gross,
    titleAmount: documentAmount,
    xeRef: extractXeRefFromPaymentTitle(title),
    equalsContract: hasPayable && amountsNear(gross, payable),
    amountFromTitle: fromTitle,
  };
}

export function collectKhmdhsPortalPaymentAmountIssues(entries = [], opts = {}) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.active !== false)
    .map((e) => detectKhmdhsPortalPaymentAmountIssue(e, {
      title: typeof opts.getTitle === 'function' ? opts.getTitle(e) : '',
      contractAmountGross: opts.contractAmountGross,
      userActualAmount: typeof opts.getUserActual === 'function'
        ? opts.getUserActual(e)
        : e?.userActualAmount,
    }))
    .filter(Boolean);
}

/** Κείμενο για τον χρήστη: το ποσό είναι της πύλης, όχι της εφαρμογής. */
export function describeKhmdhsPortalPaymentAmountIssue(issue) {
  if (!issue) return '';
  const portal = formatEuroEl(issue.khmdhsGross);
  const seen = issue.titleAmount != null ? formatEuroEl(issue.titleAmount) : '';
  const xe = issue.xeRef ? ` του εντάλματος ${issue.xeRef}` : ' του εντάλματος';
  const contractNote = issue.equalsContract
    ? ' (έβαλε ολόκληρο το ποσό της σύμβασης σε αυτόν τον κωδικό)'
    : '';
  let s = `Στον κωδικό ${issue.adam} το ΚΗΜΔΗΣ έχει καταχωρήσει ${portal}${contractNote}. `;
  if (seen) {
    if (issue.amountFromTitle !== false) {
      s += `Στο κείμενο του εγγράφου${xe} φαίνεται ${seen}. `;
    } else {
      s += `Το ποσό του εντάλματος είναι ${seen}. `;
    }
  }
  s += 'Δεν υπάρχει ένταλμα με το ποσό της πύλης — είναι καταχώριση του ΚΗΜΔΗΣ, όχι υπολογισμός της εφαρμογής.';
  return s;
}

function paymentTitleKind(title) {
  const u = String(title || '').toUpperCase();
  if (/ΕΝΤΟΛ/.test(u)) return 'instruction';
  if (/ΕΝΤΑΛΜ/.test(u) || /ΠΛΗΡΩΜ/.test(u)) return 'payment';
  return 'other';
}

function entryTitle(entry, getTitle) {
  if (typeof getTitle === 'function') return String(getTitle(entry) || '');
  return String(entry?.snapshot?.title || entry?.title || '');
}

/**
 * Εντολή πληρωμής + ένταλμα με το ίδιο ποσό στον τίτλο.
 * Παραλείπει την εντολή μόνο όταν το ΚΗΜΔΗΣ της έχει το συμβατικό σύνολο
 * (όχι το ποσό της δόσης) και, μετά την παράλειψη, το άθροισμα των δόσεων
 * κλειδώνει στο πληρωτέο. Δύο πραγματικές πληρωμές ίδιου ποσού δεν ενώνονται.
 */
export function suggestPaymentDuplicateTitlePlan(entries = [], opts = {}) {
  if (opts.coFinancingPattern) return null;

  const payable = Number(opts.contractAmountGross);
  if (!Number.isFinite(payable) || payable <= 0) return null;

  const active = (entries || []).filter((e) => e?.active !== false && e?.adam);
  if (active.length < 2) return null;

  const enriched = active.map((e) => {
    const title = entryTitle(e, opts.getTitle);
    const gross = Number(e.gross);
    const titleAmount = suggestPaymentActualAmount(title, Number.isFinite(gross) ? gross : null);
    return {
      adam: normalizeAdam(e.adam),
      gross: Number.isFinite(gross) ? gross : 0,
      title,
      titleAmount,
      kind: paymentTitleKind(title),
    };
  });

  const rawSum = enriched.reduce((s, e) => s + e.gross, 0);
  if (rawSum <= payable + AMOUNT_TOLERANCE) return null;

  const informativeAdams = new Set();
  const droppedTitleAmounts = [];
  for (let i = 0; i < enriched.length; i += 1) {
    for (let j = i + 1; j < enriched.length; j += 1) {
      const a = enriched[i];
      const b = enriched[j];
      if (a.titleAmount == null || b.titleAmount == null) continue;
      if (!amountsNear(a.titleAmount, b.titleAmount)) continue;
      const instruction = a.kind === 'instruction' ? a : (b.kind === 'instruction' ? b : null);
      const payment = a.kind === 'payment' ? a : (b.kind === 'payment' ? b : null);
      if (!instruction || !payment || instruction.adam === payment.adam) continue;
      // Η εντολή πρέπει να έχει το φουσκωμένο ποσό σύμβασης — αλλιώς είναι κανονική δόση.
      if (!amountsNear(instruction.gross, payable)) continue;
      informativeAdams.add(instruction.adam);
      droppedTitleAmounts.push(instruction.titleAmount);
    }
  }
  if (informativeAdams.size === 0) return null;

  const roles = {};
  const amounts = {};
  const labels = {};
  enriched.forEach((e) => {
    if (informativeAdams.has(e.adam)) {
      roles[e.adam] = PAYMENT_DOCUMENT_ROLE.INFORMATIVE;
      labels[e.adam] = 'Εντολή — ίδιο ποσό με ένταλμα';
      return;
    }
    const suggested = suggestPaymentDocumentRole({
      snapshot: { title: e.title },
      adam: e.adam,
      active: true,
    });
    roles[e.adam] = suggested;
    if (
      suggested === PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER
      && e.titleAmount != null
      && !amountsNear(e.titleAmount, e.gross)
    ) {
      amounts[e.adam] = e.titleAmount;
    }
  });

  // Για κάθε ποσό εντολής που παραλείψαμε, πρέπει να μείνει ακριβώς ένα ένταλμα.
  const uniqueDropped = [];
  droppedTitleAmounts.forEach((amt) => {
    if (!uniqueDropped.some((x) => amountsNear(x, amt))) uniqueDropped.push(amt);
  });
  const tooManySiblings = uniqueDropped.some((amt) => {
    const countingSame = enriched.filter((e) => (
      roles[e.adam] === PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER
      && e.titleAmount != null
      && amountsNear(e.titleAmount, amt)
    ));
    return countingSame.length !== 1;
  });
  if (tooManySiblings) return null;

  const countable = enriched.reduce((sum, e) => {
    if (roles[e.adam] !== PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER) return sum;
    const amt = amounts[e.adam] != null ? amounts[e.adam] : e.gross;
    return sum + amt;
  }, 0);
  if (!amountsNear(countable, payable)) return null;
  if (enriched.filter((e) => roles[e.adam] === PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER).length < 1) {
    return null;
  }

  return {
    id: 'duplicate_instruction_and_installments',
    roles,
    amounts,
    labels,
    countableTotalGross: Math.round(countable * 100) / 100,
  };
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

export function readPaymentAmountsFromReviewResolution(resolution) {
  const fromMeta = resolution?.meta?.paymentAmounts;
  if (fromMeta && typeof fromMeta === 'object') {
    const out = {};
    Object.entries(fromMeta).forEach(([adam, amt]) => {
      const key = normalizeAdam(adam);
      if (!key) return;
      if (amt === '' || amt == null) {
        out[key] = null;
        return;
      }
      const n = Number(amt);
      if (Number.isFinite(n) && n > 0) out[key] = n;
    });
    return out;
  }
  return {};
}

export function mergePaymentAmountsFromProject(project, review = null, item = null) {
  const amounts = {};
  (project?.khmdhsPayments || []).forEach((p) => {
    const adam = normalizeAdam(p?.adam || p?.snapshot?.referenceNumber);
    if (!adam) return;
    const a = readPaymentActualAmountFromPayment(p);
    if (a != null) amounts[adam] = a;
  });

  if (item) {
    const key = `paymentsReconciliation::${item.contractIndex != null ? item.contractIndex : 'shared'}`;
    const resolution = review?.resolutions?.[key]
      || review?.resolutions?.['paymentsReconciliation::shared'];
    Object.assign(amounts, readPaymentAmountsFromReviewResolution(resolution));
  } else if (review?.resolutions && typeof review.resolutions === 'object') {
    Object.keys(review.resolutions).forEach((k) => {
      if (String(k).startsWith('paymentsReconciliation::')) {
        Object.assign(amounts, readPaymentAmountsFromReviewResolution(review.resolutions[k]));
      }
    });
  }
  return amounts;
}

export function applyPaymentRolesToProject(formData, paymentRoles = {}, paymentLabels = {}, paymentAmounts = {}) {
  if (!formData) return formData;
  const hasRoles = paymentRoles && typeof paymentRoles === 'object' && Object.keys(paymentRoles).length > 0;
  const hasLabels = paymentLabels && typeof paymentLabels === 'object' && Object.keys(paymentLabels).length > 0;
  const hasAmounts = paymentAmounts && typeof paymentAmounts === 'object' && Object.keys(paymentAmounts).length > 0;
  if (!hasRoles && !hasLabels && !hasAmounts) return formData;

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

    // Πραγματικό ποσό: τιμή > 0 => override· κενό/null => καθαρισμός override
    const prevAmount = readPaymentActualAmountFromPayment(p);
    let nextAmount = prevAmount;
    let amountTouched = false;
    if (adam && Object.prototype.hasOwnProperty.call(paymentAmounts, adam)) {
      const raw = paymentAmounts[adam];
      if (raw === '' || raw == null) {
        nextAmount = null;
      } else {
        const n = Number(raw);
        nextAmount = Number.isFinite(n) && n > 0 ? n : null;
      }
      amountTouched = (nextAmount || null) !== (prevAmount || null);
    }

    const roleOrLabelChanged = (p.userDocumentRole || '') !== (nextRole || '') || prevLabel !== label;
    if (!roleOrLabelChanged && !amountTouched) return p;
    changed = true;

    const next = {
      ...p,
      ...(nextRole ? { userDocumentRole: nextRole, userDocumentRoleAt: now } : {}),
      userDocumentLabel: label,
      userDocumentLabelAt: label ? now : (p.userDocumentLabelAt || ''),
    };
    if (amountTouched) {
      if (nextAmount != null) {
        next.userActualAmount = nextAmount;
        next.userActualAmountAt = now;
      } else {
        delete next.userActualAmount;
        delete next.userActualAmountAt;
      }
    }
    return next;
  });

  return changed ? { ...formData, khmdhsPayments: nextPayments } : formData;
}

export function buildDefaultPaymentRoleDraft(reconEntries = [], coFinancingPattern = null, opts = {}) {
  const plan = suggestPaymentDuplicateTitlePlan(reconEntries, {
    contractAmountGross: opts.contractAmountGross,
    getTitle: opts.getTitle,
    coFinancingPattern,
  });
  if (plan?.roles && Object.keys(plan.roles).length) {
    return { ...plan.roles };
  }
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
