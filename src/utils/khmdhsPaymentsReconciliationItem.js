/**
 * Επαναϋπολογισμός στοιχείου ελέγχου ενταλμάτων (renderer — χωρίς εξάρτηση από public/).
 */

import {
  parseGreekAmountString,
  describeEffectivePayableAmountParts,
  resolveEffectivePayableAmountGrossForPayments,
} from './khmdhsFields';
import { reconcileKhmdhsPayments } from './khmdhsPaymentReconciliation';
import {
  PAYMENT_DOCUMENT_ROLE_LABELS,
  suggestPaymentDocumentRole,
} from './khmdhsPaymentDocumentRoles';

const STATUS = {
  COMPLETE: 'complete',
  NEEDS_REVIEW: 'needs_review',
};

const SECTION = {
  PAYMENTS: 'payments',
};

const SECTION_LABELS = {
  [SECTION.PAYMENTS]: 'Εντάλματα πληρωμής',
};

function formatDisplayAmount(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function ref(label, value) {
  const v = value != null ? String(value).trim() : '';
  if (!v) return null;
  return { label, value: v };
}

function refs(...entries) {
  return entries.filter(Boolean);
}

function buildItem(base) {
  return {
    searchSteps: [],
    references: [],
    relatedInfo: [],
    formLocation: '',
    section: SECTION.PAYMENTS,
    sectionLabel: SECTION_LABELS[SECTION.PAYMENTS],
    ...base,
  };
}

function resolveContractAmountGrossForPayments(ctx) {
  if (ctx.formContractAmountGross != null && Number.isFinite(Number(ctx.formContractAmountGross))) {
    const formAmt = Number(ctx.formContractAmountGross);
    if (formAmt > 0) return formAmt;
  }
  if (ctx.formData) {
    const fromForm = resolveEffectivePayableAmountGrossForPayments(
      ctx.formData,
      ctx.contractIndex ?? null
    );
    if (fromForm != null && fromForm > 0) return fromForm;
  }
  return null;
}

function buildPayableReferenceLabel(parts) {
  const segments = [];
  if (parts.usesApeAsMain) {
    segments.push('ΑΠΕ (τελικό διαμορφωθέν)');
  } else {
    segments.push('σύμβαση');
  }
  if ((parts.suppToAdd || 0) > 0) {
    segments.push('συμπληρωματικές');
  }
  if (segments.length === 1) return 'Συμβατικό ποσό (με ΦΠΑ)';
  return `Τελικό πληρωτέο (${segments.join(' + ')}, με ΦΠΑ)`;
}

function buildPayableReferenceDesc(parts, formattedAmount) {
  const label = buildPayableReferenceLabel(parts).replace(' (με ΦΠΑ)', '');
  return `${label} (${formattedAmount})`;
}

function paymentsFromStoredRecon(recon) {
  return (recon?.entries || []).map((e) => ({
    adam: e.adam,
    userDocumentRole: e.userDocumentRole || '',
    ...(e.userActualAmount != null ? { userActualAmount: e.userActualAmount } : {}),
    snapshot: {
      referenceNumber: e.adam,
      organization: e.org || '',
      totalCostWithVAT: e.gross,
      cancelled: !!e.cancelled,
      credit: !!e.credit,
    },
  }));
}

function refValueFromItem(item, labelPattern) {
  const hit = (item?.references || []).find((r) => labelPattern.test(String(r.label || '')));
  return hit?.value ? String(hit.value).trim() : '';
}

function buildPaymentsReconciliationItem(payments, ctx) {
  const list = Array.isArray(payments) ? payments.filter((p) => p?.adam || p?.snapshot) : [];
  if (list.length === 0) return null;

  const contractingOrg = ctx.auction?.snapshot?.organization
    || ctx.contract?.snapshot?.organization
    || ctx.primaryRecord?.organization
    || '';
  const contractAmountGross = resolveContractAmountGrossForPayments(ctx);
  const recon = reconcileKhmdhsPayments(list, { contractAmountGross, contractingOrg });

  const payableParts = ctx.formData
    ? describeEffectivePayableAmountParts(ctx.formData, ctx.contractIndex ?? null)
    : {
      hasApe: ctx.apeAmount != null && ctx.apeAmount !== '',
      hasManualSupp: false,
      hasDerivedSupp: false,
    };
  const refAmountLabel = buildPayableReferenceLabel(payableParts);
  const contractAdam = ctx.contract?.primaryAdam || ctx.contract?.adam || ctx.primaryRecord?.referenceNumber;
  const commonRefs = refs(
    ref('Κωδικός σύμβασης (ΚΗΜΔΗΣ)', contractAdam),
    contractAmountGross != null ? ref(refAmountLabel, formatDisplayAmount(contractAmountGross)) : null,
    contractingOrg ? ref('Αναθέτουσα αρχή (ανάθεση)', contractingOrg) : null,
  );

  const skippedUnrelated = Array.isArray(ctx.skippedUnrelatedPayments) ? ctx.skippedUnrelatedPayments : [];
  const paymentRefs = recon.entries.map((e, idx) => {
    const amt = e.gross != null ? formatDisplayAmount(e.gross) : '—';
    const statusNote = !e.active ? (e.cancelled ? ' (ακυρωμένο)' : e.credit ? ' (πιστωτικό)' : '') : '';
    const roleLabel = e.userDocumentRole
      ? PAYMENT_DOCUMENT_ROLE_LABELS[e.userDocumentRole] || e.userDocumentRole
      : PAYMENT_DOCUMENT_ROLE_LABELS[suggestPaymentDocumentRole(e, { coFinancingPattern: recon.coFinancingPattern })];
    return ref(
      `Έγγραφο ${idx + 1} — ${e.payer.label}`,
      `${e.adam || '—'} · ${amt}${statusNote}${e.org ? ` · ${e.org}` : ''} · ${roleLabel}`,
    );
  });
  const skippedUnrelatedRefs = skippedUnrelated.map((e) =>
    ref('⚠️ Εξαιρέθηκε (άσχετη σύμβαση)', `${e.adam} — αναφέρει: ${e.unrelatedContractRef || '?'}`)
  );

  const classifyHint = ' Χαρακτηρίστε κάθε έγγραφο: πραγματικό ένταλμα πληρωμής, ενημερωτικό, αποζημίωση συγχρηματοδότησης ή εξαίρεση.';
  const apeHint = ' Αν το τελικό πληρωτέο ποσό δεν είναι σωστό, ελέγξτε ποσό σύμβασης, ΑΠΕ (τελικό διαμορφωθέν) και συμπληρωματικές στη φόρμα του υποέργου.';
  const refAmountDesc = buildPayableReferenceDesc(payableParts, formatDisplayAmount(contractAmountGross));

  let message;
  let status = STATUS.COMPLETE;
  let displayValue = formatDisplayAmount(
    recon.hasUserClassification
      ? recon.countableTotalGross
      : (recon.hasActualAmounts ? recon.effectiveTotalGross : recon.estimatedContractorPaymentGross)
  );

  if (recon.needsClassification) {
    status = STATUS.NEEDS_REVIEW;
    message = `Το άθροισμα των εγγράφων πληρωμής (${formatDisplayAmount(recon.rawTotalGross)}) υπερβαίνει ${refAmountDesc}.`
      + classifyHint;
    if (recon.coFinancingPattern) {
      message += ' Εντοπίστηκε πιθανό μοτίβο συγχρηματοδότησης (Δήμος + Περιφερειακό Ταμείο) — επιβεβαιώστε ποιο έγγραφο είναι πραγματική πληρωμή και ποιο αποζημίωση ή ενημερωτικό.';
    } else {
      message += ' Ελέγξτε αν κάποιο έγγραφο δεν είναι πραγματικό ένταλμα πληρωμής (π.χ. ενημερωτικό).';
    }
    message += apeHint;
    displayValue = formatDisplayAmount(recon.rawTotalGross);
  } else if (recon.coFinancingPattern && !recon.hasUserClassification) {
    message = `Βρέθηκαν ${recon.activeCount} έγγραφα με ακατέργαστο άθροισμα ${formatDisplayAmount(recon.rawTotalGross)} — υπερβαίνει ${refAmountDesc}. `
      + 'Εντοπίστηκε τυπικό μοτίβο συγχρηματοδότησης: ένταλμα από Περιφερειακό Ταμείο/ΠΕΠΑΚ και ένταλμα από Δήμο/αναθέτουσα αρχή για το ίδιο ποσό. '
      + 'Συνήθως το Ταμείο αποζημιώνει τον Δήμο — η εκτιμώμενη πληρωμή προς εργολάβο είναι μία φορά το ποσό της σύμβασης, όχι το άθροισμα των δύο ενταλμάτων.';
    if (recon.estimatedExceedsContract) {
      status = STATUS.NEEDS_REVIEW;
      message += ` Ωστόσο, ακόμη και μετά τον έλεγχο, το εκτιμώμενο ποσό υπερβαίνει ${refAmountDesc} — απαιτείται χειροκίνητος έλεγχος.${apeHint}`;
    }
  } else if (recon.hasUserClassification) {
    message = `Χαρακτηρίστηκαν ${recon.activeCount} έγγραφα πληρωμής. Μετρούν στο άθροισμα: ${formatDisplayAmount(recon.countableTotalGross)} (ακατέργαστο: ${formatDisplayAmount(recon.rawTotalGross)}).`;
    if (recon.countableExceedsContract) {
      status = STATUS.NEEDS_REVIEW;
      message += ` Το ποσό που μετράει ακόμη υπερβαίνει ${refAmountDesc} — ελέγξτε ξανά τους χαρακτηρισμούς.${apeHint}`;
    }
  } else if (recon.hasActualAmounts) {
    message = `Ορίστηκαν πραγματικά ποσά για ${recon.activeCount} εντάλματα — πραγματικό σύνολο: ${formatDisplayAmount(recon.effectiveTotalGross)} (δηλωμένο ΚΗΜΔΗΣ: ${formatDisplayAmount(recon.rawTotalGross)}).`;
    if (recon.countableExceedsContract) {
      status = STATUS.NEEDS_REVIEW;
      message += ` Ακόμη και μετά τη διόρθωση, το σύνολο υπερβαίνει ${refAmountDesc} — ελέγξτε τα ποσά.${apeHint}`;
    }
  } else if (recon.hasMultiplePayers) {
    message = `Βρέθηκαν ${recon.activeCount} εντάλματα από διαφορετικούς φορείς. Το άθροισμα (${formatDisplayAmount(recon.rawTotalGross)}) δεν υπερβαίνει ${refAmountDesc}.`;
  } else if (recon.activeCount === 1) {
    message = 'Βρέθηκε ένα εντάλμα πληρωμής — συμφωνεί με τα στοιχεία της αλυσίδας.';
  } else {
    message = `Βρέθηκαν ${recon.activeCount} εντάλματα πληρωμής — το άθροισμα δεν υπερβαίνει ${refAmountDesc}.`;
  }

  if (skippedUnrelated.length > 0) {
    const skippedAdams = skippedUnrelated.map((e) => e.adam).join(', ');
    message += ` Εξαιρέθηκ${skippedUnrelated.length === 1 ? 'ε' : 'αν'} αυτόματα `
      + `${skippedUnrelated.length} ένταλμα/τα (${skippedAdams}) που αναφέρ${skippedUnrelated.length === 1 ? 'ει' : 'ουν'} `
      + 'σύμβαση εκτός της τρέχουσας αλυσίδας. '
      + 'Αν αφορούν συμπληρωματική σύμβαση του υποέργου, ελέγξτε τα χειροκίνητα.';
    if (status === STATUS.COMPLETE) status = STATUS.NEEDS_REVIEW;
  }

  const relatedInfo = refs(
    ref('Ακατέργαστο άθροισμα (με ΦΠΑ)', formatDisplayAmount(recon.rawTotalGross)),
    recon.coFinancingPattern
      ? ref('Εκτιμώμενη πληρωμή εργολάβου (με ΦΠΑ)', formatDisplayAmount(recon.estimatedContractorPaymentGross))
      : null,
    ...paymentRefs,
    ...skippedUnrelatedRefs,
  );

  return buildItem({
    fieldId: 'paymentsReconciliation',
    label: 'Εντάλματα πληρωμής — έλεγχος ποσών & φορέων',
    status,
    displayValue,
    message,
    manualFieldKey: null,
    contractIndex: null,
    section: SECTION.PAYMENTS,
    sectionLabel: SECTION_LABELS[SECTION.PAYMENTS],
    references: commonRefs,
    relatedInfo,
    searchSteps: recon.needsClassification || recon.needsReview || skippedUnrelated.length > 0
      ? [
          'Ανοίξτε κάθε έγγραφο στο ΚΗΜΔΗΣ (κουμπί Προβολή) και διαβάστε τον τίτλο.',
          'Χαρακτηρίστε: ένταλμα πληρωμής, ενημερωτικό, αποζημίωση συγχρηματοδότησης ή εξαίρεση.',
          'Μετρούν μόνο τα «Ένταλμα πληρωμής». Τα ενημερωτικά δεν προστίθενται στο άθροισμα.',
          'Αν δύο εντάλματα αφορούν το ίδιο ποσό (π.χ. ένα για το καθαρό ποσό και ένα για τις κρατήσεις), συμπληρώστε το «Πραγματικό ποσό» για κάθε ένταλμα — η εφαρμογή θα αθροίσει τα πραγματικά αντί για το δηλωμένο ΚΗΜΔΗΣ.',
          'Σε έργα ΕΣΠΑ/ΠΕΠ, το ένταλμα του Περιφερειακού Ταμείου συχνά είναι αποζημίωση Δήμου — όχι δεύτερη πληρωμή εργολάβου.',
          ...(skippedUnrelated.length > 0
            ? ['Για τα εξαιρεθέντα εντάλματα: ελέγξτε αν ανήκουν σε συμπληρωματική σύμβαση αυτού του υποέργου.']
            : []),
        ]
      : [
          'Δείτε την ενότητα «Εντάλματα πληρωμής» στα αποτελέσματα ΚΗΜΔΗΣ.',
          'Κάθε ένταλμα εμφανίζεται με τον φορέα που το εξέδωσε (Δήμος, Περιφ. Ταμείο κ.λπ.).',
        ],
    formLocation: 'Αναφορά ελέγχου → «Εντάλματα πληρωμής» · εμφανίζεται και στα αποτελέσματα ανάκτησης ΑΔΑΜ.',
    paymentsReconciliation: recon,
    skippedUnrelatedPayments: skippedUnrelated,
  });
}

function paymentsForReconciliationRefresh(existingItem, overrides = {}) {
  const formData = overrides.formData;
  if (formData && Array.isArray(formData.khmdhsPayments) && formData.khmdhsPayments.length) {
    return formData.khmdhsPayments.filter((p) => p?.adam || p?.snapshot);
  }
  return paymentsFromStoredRecon(existingItem?.paymentsReconciliation);
}

/** Επαναϋπολογισμός ειδοποίησης ενταλμάτων με ενημερωμένο συμβατικό ποσό. */
export function rebuildPaymentsReconciliationItem(existingItem, overrides = {}) {
  if (!existingItem || existingItem.fieldId !== 'paymentsReconciliation') return existingItem;
  const recon = existingItem.paymentsReconciliation;
  if (!recon?.entries?.length && !(overrides.formData?.khmdhsPayments || []).length) return existingItem;

  const payments = paymentsForReconciliationRefresh(existingItem, overrides);
  const contractingOrg = refValueFromItem(existingItem, /αναθέτουσα/i)
    || recon.entries.find((e) => e.org)?.org
    || '';
  const contractAdam = refValueFromItem(existingItem, /σύμβασης/i);

  const ctx = {
    formData: overrides.formData ?? null,
    contractIndex: overrides.contractIndex ?? existingItem.contractIndex ?? null,
    apeAmount: overrides.apeAmount ?? null,
    formContractAmountGross: overrides.formContractAmountGross ?? null,
    auction: { snapshot: { organization: contractingOrg } },
    contract: { primaryAdam: contractAdam, adam: contractAdam },
    primaryRecord: contractAdam ? { referenceNumber: contractAdam } : null,
    skippedUnrelatedPayments: existingItem.skippedUnrelatedPayments
      || overrides.skippedUnrelatedPayments
      || [],
    amountContext: overrides.amountContext || {},
  };

  const fresh = buildPaymentsReconciliationItem(payments, ctx);
  if (!fresh) return existingItem;
  const liveStatus = fresh.paymentsReconciliation?.needsClassification || fresh.paymentsReconciliation?.needsReview
    ? STATUS.NEEDS_REVIEW
    : STATUS.COMPLETE;
  return {
    ...fresh,
    status: liveStatus,
    contractIndex: existingItem.contractIndex ?? null,
    skippedUnrelatedPayments: ctx.skippedUnrelatedPayments,
  };
}
