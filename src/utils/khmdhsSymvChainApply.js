/**
 * Εφαρμογή σχεδίου ρόλων SYMV στη φόρμα — μοναδική διαδρομή (χωρίς παράλληλα auto-apply).
 */

import { isMultipleContractsForm, emptyKhmdhsOnContract } from './khmdhsFields';
import { migrateKhmdhsSingleToMultiForm } from './khmdhsImplementationFormMigration';
import {
  mergeKhmdhsReviewAfterFetch,
  reconcileReviewState,
  resolveReviewItem,
  chainKindReviewResolutionKey,
  KHMDHS_RESOLUTION_SOURCE,
  getUnresolvedReviewItems,
  reviewItemKey,
  normalizeReviewFieldValue,
} from './khmdhsDataQualityReport';
import { applyUserEditsAfterKhmdhsFetch } from './khmdhsFieldOverrides';
import { inferActRootReqAdam, mergeBranchAnchorFields, resolveBranchAnchorFromChain } from './khmdhsBranchAnchor';
import { suggestProjectStatusAfterKhmdhsChain } from './khmdhsAdamGuidance';
import { CHAIN_KIND } from './khmdhsChainActions';
import { KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS } from './khmdhsSituationActions';
import {
  emptyKhmdhsChainFields,
  mergeSharedKhmdhsFromChain,
  mergeKhmdhsChainMetaForStitch,
  applyChainCharacterizationToForm,
} from './khmdhsChainApply';
import { SYMV_CHAIN_ROLE, expandSymvPlanWithFormContracts } from './khmdhsSymvChainPlanner';
import { detectStagesCoveredByForm } from './khmdhsChainStitchPlan';
import { filterUnrelatedPayments } from './khmdhsPaymentReconciliation';
import { grossFromCostSnapshot } from './khmdhsVatHelper';
import { normalizeProjectAmountForStorage } from './projectAmountUtils';
import { stripPhantomContractApeFromForm } from './khmdhsApeEntry';

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

function createEmptyContractRow() {
  return { date: '', amount: '', apeAmount: '', comments: '', ...emptyKhmdhsOnContract() };
}

function buildContractRow(adam, planItem, chainRes, { roleLabel = '', chainHistory = [] } = {}) {
  const norm = normalizeAdam(adam);
  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const snap = snapshots[norm] || snapshots[adam] || null;
  const fetchedAt = chainRes.chainMeta?.resolvedAt || new Date().toISOString();
  const snapEnd = snap?.noEndDate ? '' : String(snap?.endDate || '').slice(0, 10);
  const sanityRef = grossFromCostSnapshot(chainRes?.auction?.snapshot) || 0;
  const rawAmount = String(planItem?.amount || '').trim();
  const amount = rawAmount ? normalizeProjectAmountForStorage(rawAmount, sanityRef) : '';

  return {
    ...createEmptyContractRow(),
    khmdhsAdam: norm,
    khmdhsContractSnapshot: snap,
    khmdhsContractFetchedAt: snap ? fetchedAt : '',
    khmdhsContractRoleLabel: roleLabel,
    date: String(planItem?.date || '').slice(0, 10) || (snap ? signedDate(snap) : ''),
    amount,
    contractEndDate: snapEnd,
    khmdhsContractChainHistory: chainHistory,
    khmdhsContractAmendments: [],
  };
}

function signedDate(snapshot) {
  return String(snapshot?.contractSignedDate || snapshot?.startDate || '').slice(0, 10);
}

function buildSupplementaryRow(adam, planItem, chainRes, role) {
  const norm = normalizeAdam(adam);
  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const snap = snapshots[norm] || snapshots[adam] || null;
  const label = role === SYMV_CHAIN_ROLE.EXTENSION
    ? 'Παράταση'
    : 'Συμπληρωματική σύμβαση';

  return {
    date: String(planItem?.date || '').slice(0, 10) || (snap ? signedDate(snap) : ''),
    amount: role === SYMV_CHAIN_ROLE.EXTENSION ? '' : String(planItem?.amount || '').trim(),
    apeAmount: '',
    comments: label,
    khmdhsAdam: norm,
    khmdhsContractSnapshot: snap,
    khmdhsContractFetchedAt: snap ? (chainRes.chainMeta?.resolvedAt || new Date().toISOString()) : '',
    khmdhsDerived: false,
  };
}

function symvRoleToChainKind(role) {
  switch (role) {
    case SYMV_CHAIN_ROLE.MAIN:
    case SYMV_CHAIN_ROLE.PARALLEL:
      return CHAIN_KIND.CONTRACT;
    case SYMV_CHAIN_ROLE.SUPPLEMENTARY:
      return CHAIN_KIND.MODIFICATION;
    case SYMV_CHAIN_ROLE.EXTENSION:
      return CHAIN_KIND.EXTENSION;
    case SYMV_CHAIN_ROLE.INTERMEDIATE:
      return CHAIN_KIND.OTHER;
    case SYMV_CHAIN_ROLE.SKIP:
    default:
      return CHAIN_KIND.OTHER;
  }
}

function dateSortKey(entry) {
  return String(entry?.contractDate || entry?.startDate || '').slice(0, 10) || '9999';
}

function buildKindNote(role, planItem) {
  if (role === SYMV_CHAIN_ROLE.INTERMEDIATE) {
    const custom = String(planItem?.label || '').trim();
    return custom
      ? `Ενδιάμεσος κρίκος: ${custom}`
      : 'Ενδιάμεσος κρίκος αλυσίδας — χωρίς επίπτωση σε ποσό/σύμβαση.';
  }
  if (role === SYMV_CHAIN_ROLE.EXTENSION) {
    return 'Παράταση — ενημέρωση προθεσμίας εκτέλεσης.';
  }
  if (role === SYMV_CHAIN_ROLE.SUPPLEMENTARY) {
    return 'Συμπληρωματική σύμβαση — επηρεάζει το συνολικό ποσό.';
  }
  return '';
}

function formatPlanAmount(amount) {
  const s = String(amount || '').trim();
  return s;
}

function buildHistoryEntryFromPlan(adam, planItem, chainRes, existingEntry = null) {
  const snapshots = chainRes?.chainMeta?.contractSnapshotsByAdam || {};
  const snap = snapshots[adam] || snapshots[normalizeAdam(adam)] || existingEntry?.snapshot || null;
  const role = planItem.role;
  const kind = symvRoleToChainKind(role);
  const docDate = String(planItem?.date || '').slice(0, 10)
    || existingEntry?.contractDate
    || (snap ? signedDate(snap) : '');
  const isRoot = role === SYMV_CHAIN_ROLE.MAIN;

  let label;
  switch (role) {
    case SYMV_CHAIN_ROLE.MAIN:
      label = existingEntry?.label || chainRes?.contract?.roleLabel || 'Αρχική σύμβαση';
      break;
    case SYMV_CHAIN_ROLE.SUPPLEMENTARY:
      label = 'Συμπληρωματική σύμβαση';
      break;
    case SYMV_CHAIN_ROLE.EXTENSION:
      label = 'Παράταση';
      break;
    case SYMV_CHAIN_ROLE.INTERMEDIATE:
      label = String(planItem?.label || '').trim() || 'Ενδιάμεσος κρίκος';
      break;
    case SYMV_CHAIN_ROLE.PARALLEL:
      label = existingEntry?.label || 'Παράλληλη σύμβαση';
      break;
    default:
      label = existingEntry?.label || '';
  }

  const amount = (role === SYMV_CHAIN_ROLE.EXTENSION || role === SYMV_CHAIN_ROLE.INTERMEDIATE)
    ? ''
    : formatPlanAmount(planItem?.amount) || existingEntry?.contractAmount || '';

  return {
    ...(existingEntry || {}),
    adam,
    kind,
    suggestedKind: kind,
    effectiveKind: kind,
    role: kind,
    label,
    isRoot,
    isSeed: !!existingEntry?.isSeed,
    title: String(snap?.title || existingEntry?.title || '').trim(),
    snapshot: snap || existingEntry?.snapshot || null,
    contractDate: docDate,
    contractAmount: amount,
    endDate: role === SYMV_CHAIN_ROLE.EXTENSION
      ? docDate
      : (existingEntry?.endDate || (snap?.noEndDate ? '' : String(snap?.endDate || '').slice(0, 10))),
    kindNote: buildKindNote(role, planItem) || existingEntry?.kindNote || '',
    needsReview: false,
    userKind: kind,
  };
}

const CHAIN_TIMELINE_ROLES = new Set([
  SYMV_CHAIN_ROLE.MAIN,
  SYMV_CHAIN_ROLE.SUPPLEMENTARY,
  SYMV_CHAIN_ROLE.EXTENSION,
  SYMV_CHAIN_ROLE.INTERMEDIATE,
]);

/** Ιστορικό αλυσίδας από σχέδιο: όλα τα ενεργά έγγραφα, ταξινόμηση κατά ημερομηνία. */
export function buildContractChainHistoryFromSymvPlan(chainRes, plan) {
  const active = (plan?.items || []).filter((i) => i?.adam && i.role !== SYMV_CHAIN_ROLE.SKIP);
  const timelineItems = active.filter((i) => CHAIN_TIMELINE_ROLES.has(i.role));

  const existingByAdam = new Map();
  (chainRes?.contractChainHistory || []).forEach((h) => {
    const n = normalizeAdam(h?.adam);
    if (n) existingByAdam.set(n, h);
  });

  const history = timelineItems.map((planItem) => {
    const adam = normalizeAdam(planItem.adam);
    return buildHistoryEntryFromPlan(
      adam,
      planItem,
      chainRes,
      existingByAdam.get(adam) || null
    );
  });

  return [...history]
    .sort((a, b) => {
      const da = dateSortKey(a);
      const db = dateSortKey(b);
      if (da !== db) return da.localeCompare(db);
      if (a.isRoot && !b.isRoot) return -1;
      if (!a.isRoot && b.isRoot) return 1;
      // Ίδια (ή καμία) ημερομηνία — διατηρούμε τη σειρά εμφάνισης στο σχέδιο κατανομής SYMV
      // αντί για αλφαβητική σύγκριση ΑΔΑΜ, που δεν έχει καμία σχέση με τη χρονολογική σειρά.
      return 0;
    })
    .map((h, order) => ({ ...h, order }));
}

function collectSymvContractPlanEntries(plan) {
  return (plan?.items || []).filter(
    (i) => i?.adam && (i.role === SYMV_CHAIN_ROLE.MAIN || i.role === SYMV_CHAIN_ROLE.PARALLEL)
  );
}

/** Επιβεβαιώνει ποσά/ημ/νίες σύμβασης στο DQR μετά την κατανομή SYMV (κύρια + παράλληλες). */
function resolveSymvPlanContractReviewItems(review, plan, form) {
  if (!review || !plan?.items?.length) return review;

  const contractLike = collectSymvContractPlanEntries(plan);
  const planByAdam = new Map(contractLike.map((i) => [normalizeAdam(i.adam), i]));
  const adamByContractIndex = new Map();
  contractLike.forEach((item, idx) => {
    adamByContractIndex.set(idx, normalizeAdam(item.adam));
  });
  (form?.contracts || []).forEach((row, idx) => {
    const adam = normalizeAdam(row?.khmdhsAdam);
    if (adam) adamByContractIndex.set(idx, adam);
  });

  let next = review;

  (next.items || []).forEach((item) => {
    if (item.fieldId !== 'contractAmount' && item.fieldId !== 'contractDate') return;

    let planItem = null;
    const itemAdam = normalizeAdam(item.chainAdam);
    if (itemAdam) {
      planItem = planByAdam.get(itemAdam);
    } else if (item.contractIndex != null) {
      const mappedAdam = adamByContractIndex.get(item.contractIndex);
      if (mappedAdam) planItem = planByAdam.get(mappedAdam);
    }

    const idx = item.contractIndex;
    const formAmount = idx != null
      ? String(form?.contracts?.[idx]?.amount || '').trim()
      : String(form?.contractAmount || '').trim();
    const formDate = idx != null
      ? String(form?.contracts?.[idx]?.date || '').slice(0, 10)
      : String(form?.contractDate || '').slice(0, 10);

    if (item.fieldId === 'contractAmount') {
      const amount = String(planItem?.amount || formAmount || '').trim();
      if (!amount) return;
      const key = reviewItemKey(item);
      const existing = next.resolutions?.[key];
      if (
        existing
        && normalizeReviewFieldValue(item, existing.value) === normalizeReviewFieldValue(item, amount)
      ) {
        return;
      }
      next = resolveReviewItem(next, item, {
        value: amount,
        source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
        note: 'Ορίστηκε στη κατανομή SYMV',
      });
      return;
    }

    const date = String(planItem?.date || formDate || '').slice(0, 10);
    if (!date) return;
    next = resolveReviewItem(next, item, {
      value: date,
      source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
      note: 'Ορίστηκε στη κατανομή SYMV',
    });
  });

  return next;
}

/** Ήδη ενσωματωμένο σχέδιο SYMV στο DQR — μην ξανατρέχει merge στο άνοιγμα φόρμας. */
export function shouldMergeSymvPlanIntoDataQualityReview(review, plan, form) {
  if (!review || !plan?.items?.length) return false;
  if (String(form?.khmdhsSymvPlanAppliedAt || '').trim()) return false;
  const activeItems = plan.items.filter((item) => item?.adam && item.role !== SYMV_CHAIN_ROLE.SKIP);
  if (!activeItems.length) return false;
  const resolutions = review.resolutions || {};
  const allResolved = activeItems.every((item) => {
    const adam = normalizeAdam(item.adam);
    if (!adam) return true;
    return !!resolutions[chainKindReviewResolutionKey(adam)];
  });
  return !allResolved;
}

/** Μεταφέρει τις επιλογές κατανομής SYMV στο DQR — χωρίς δεύτερο παράθυρο χαρακτηρισμού. */
export function mergeSymvChainPlanIntoDataQualityReview(review, plan, form) {
  if (!review || !plan?.items?.length) return review;

  const planByAdam = new Map(
    plan.items.map((item) => [normalizeAdam(item.adam), item])
  );
  let next = review;

  const resolveKindForAdam = (adam, planItem) => {
    const kind = symvRoleToChainKind(planItem.role);
    const kindItem = (next.items || []).find(
      (i) => i.fieldId === 'chainKindReview' && normalizeAdam(i.chainAdam) === adam
    );
    const meta = {};
    if (kind === CHAIN_KIND.MODIFICATION) {
      meta.modAmount = String(planItem.amount || '').trim();
      meta.modDate = String(planItem.date || '').slice(0, 10);
      meta.modAmountType = 'delta';
    }
    if (kind === CHAIN_KIND.EXTENSION) {
      meta.modDate = String(planItem.date || '').slice(0, 10);
      meta.endDate = String(planItem.date || '').slice(0, 10);
    }
    if (planItem.role === SYMV_CHAIN_ROLE.INTERMEDIATE) {
      meta.modDate = String(planItem.date || '').slice(0, 10);
    }
    const note = planItem.role === SYMV_CHAIN_ROLE.SKIP
      ? 'Αποκλείστηκε στη κατανομή SYMV'
      : planItem.role === SYMV_CHAIN_ROLE.INTERMEDIATE
        ? (String(planItem.label || '').trim()
          ? `Ενδιάμεσος κρίκος: ${planItem.label}`
          : 'Ενδιάμεσος κρίκος αλυσίδας')
        : 'Ορίστηκε στη κατανομή SYMV';

    if (kindItem) {
      next = resolveReviewItem(next, kindItem, {
        value: kind,
        source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
        note,
        meta: Object.keys(meta).length ? meta : null,
      });
    } else {
      const key = chainKindReviewResolutionKey(adam);
      next = {
        ...next,
        resolutions: {
          ...(next.resolutions || {}),
          [key]: {
            value: kind,
            source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
            resolvedAt: new Date().toISOString(),
            note,
            meta: Object.keys(meta).length ? meta : null,
          },
        },
        acknowledgedFieldIds: [
          ...new Set([...(next.acknowledgedFieldIds || []), key]),
        ],
      };
    }
  };

  plan.items.forEach((planItem) => {
    const adam = normalizeAdam(planItem.adam);
    if (!adam) return;
    if (planItem.role === SYMV_CHAIN_ROLE.SKIP) {
      const key = chainKindReviewResolutionKey(adam);
      next = {
        ...next,
        resolutions: {
          ...(next.resolutions || {}),
          [key]: {
            // Όχι κενό: το isSupplementaryFieldDeferred αγνοεί άδεια value και
            // ξαναζητά ποσό συμπληρωματικής για ήδη αποκλεισμένα ΑΔΑΜ.
            value: 'other',
            source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
            resolvedAt: new Date().toISOString(),
            note: 'Αποκλείστηκε στη κατανομή SYMV',
          },
        },
        acknowledgedFieldIds: [
          ...new Set([...(next.acknowledgedFieldIds || []), key]),
        ],
      };
      return;
    }
    resolveKindForAdam(adam, planItem);
  });

  (next.items || []).forEach((item) => {
    const adam = normalizeAdam(item.chainAdam || item.adam);
    if (!adam) return;
    const planItem = planByAdam.get(adam);
    if (!planItem) return;

    if (planItem.role === SYMV_CHAIN_ROLE.SKIP) {
      if (
        item.fieldId !== 'chainKindReview'
        && (item.status === 'needs_review' || item.status === 'missing')
      ) {
        next = resolveReviewItem(next, item, {
          value: '—',
          source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
          note: 'Αποκλείστηκε στη κατανομή SYMV',
        });
      }
      return;
    }

    if (planItem.role === SYMV_CHAIN_ROLE.EXTENSION) {
      if (item.fieldId === 'supplementaryAmount') {
        next = resolveReviewItem(next, item, {
          value: '—',
          source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
          note: 'Παράταση — χωρίς ποσό',
        });
      }
      if (item.fieldId === 'supplementaryDate' && planItem.date) {
        next = resolveReviewItem(next, item, {
          value: String(planItem.date).slice(0, 10),
          source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
          note: 'Κατανομή SYMV',
        });
      }
      return;
    }

    if (item.fieldId === 'supplementaryAmount' && planItem.amount) {
      next = resolveReviewItem(next, item, {
        value: planItem.amount,
        source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
        note: 'Κατανομή SYMV',
      });
    }
    if (item.fieldId === 'supplementaryDate' && planItem.date) {
      next = resolveReviewItem(next, item, {
        value: String(planItem.date).slice(0, 10),
        source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
        note: 'Κατανομή SYMV',
      });
    }
    if (planItem.role === SYMV_CHAIN_ROLE.MAIN || planItem.role === SYMV_CHAIN_ROLE.PARALLEL) {
      if (item.fieldId === 'contractAmount') {
        const amount = String(planItem.amount || form.contractAmount || '').trim();
        if (amount) {
          next = resolveReviewItem(next, item, {
            value: amount,
            source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
            note: 'Ορίστηκε στη κατανομή SYMV',
          });
        }
      }
      if (item.fieldId === 'contractDate') {
        const date = String(planItem.date || form.contractDate || '').slice(0, 10);
        if (date) {
          next = resolveReviewItem(next, item, {
            value: date,
            source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
            note: 'Ορίστηκε στη κατανομή SYMV',
          });
        }
      }
    }
  });

  const mainPlan = plan.items.find((i) => i.role === SYMV_CHAIN_ROLE.MAIN);
  if (mainPlan) {
    const mainAdam = normalizeAdam(mainPlan.adam);
    const mainAmount = String(mainPlan.amount || form.contractAmount || '').trim();
    const mainDate = String(mainPlan.date || form.contractDate || '').slice(0, 10);

    (next.items || []).forEach((item) => {
      if (item.fieldId !== 'contractAmount' && item.fieldId !== 'contractDate') return;
      const itemAdam = normalizeAdam(item.chainAdam || item.adam);
      if (itemAdam && itemAdam !== mainAdam) return;
      if (item.contractIndex != null && item.contractIndex > 0) return;

      if (item.fieldId === 'contractAmount' && mainAmount) {
        const resolveVal = String(form.contractAmount || '').trim() || mainAmount;
        const key = reviewItemKey(item);
        const existing = next.resolutions?.[key];
        if (
          !existing
          || String(existing.value || '').trim() !== resolveVal
        ) {
          next = resolveReviewItem(next, item, {
            value: resolveVal,
            source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
            note: 'Ορίστηκε στη κατανομή SYMV',
          });
        }
      }
      if (item.fieldId === 'contractDate' && mainDate) {
        const resolveVal = String(form.contractDate || '').slice(0, 10) || mainDate;
        next = resolveReviewItem(next, item, {
          value: resolveVal,
          source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
          note: 'Ορίστηκε στη κατανομή SYMV',
        });
      }
    });
  }

  next = resolveSymvPlanContractReviewItems(next, plan, form);

  const reconciled = reconcileReviewState(next, form);
  return {
    ...reconciled,
    hasActionRequired: getUnresolvedReviewItems(reconciled, form).length > 0,
  };
}

function collectFormContractAdams(form) {
  const out = new Set();
  const add = (value) => {
    const n = normalizeAdam(value);
    if (n) out.add(n);
  };
  add(form?.khmdhsAdam);
  (form?.contracts || []).forEach((c) => add(c?.khmdhsAdam));
  return out;
}

function collectSupplementaryAdams(form) {
  const out = new Set();
  (form?.supplementaryContracts || []).forEach((s) => {
    const n = normalizeAdam(s?.khmdhsAdam);
    if (n) out.add(n);
  });
  return out;
}

function mergePaymentsAndCommitmentsForStitch(form, chainRes) {
  const payOnly = {
    payments: chainRes?.payments,
    skippedUnrelatedPayments: chainRes?.skippedUnrelatedPayments,
    commitmentDecisions: chainRes?.commitmentDecisions,
    commitmentDecision: chainRes?.commitmentDecision,
    skipCommitmentMerge: false,
    skipPaymentMerge: false,
  };
  const { next } = mergeSharedKhmdhsFromChain(form, payOnly, { protect: false });
  const mergedPayments = Array.isArray(next.khmdhsPayments) ? next.khmdhsPayments : [];
  if (!mergedPayments.length) return next;
  return {
    ...next,
    khmdhsPayments: filterUnrelatedPayments(mergedPayments, next),
  };
}

/**
 * Κατανομή SYMV με «Διατήρηση»: δεν αδειάζει την υπάρχουσα αλυσίδα.
 * Προσθέτει MAIN/PARALLEL που λείπουν και ενώνει εντάλματα/δεσμεύσεις.
 */
function applySymvChainPlanToFormStitch(prev, chainRes, plan, {
  seedAdam = '',
  branchAnchor = null,
} = {}) {
  const active = (plan?.items || []).filter((i) => i?.adam && i.role !== SYMV_CHAIN_ROLE.SKIP);
  const mains = active.filter((i) => i.role === SYMV_CHAIN_ROLE.MAIN);
  const parallels = active.filter((i) => i.role === SYMV_CHAIN_ROLE.PARALLEL);
  const supplements = active.filter((i) => i.role === SYMV_CHAIN_ROLE.SUPPLEMENTARY || i.role === SYMV_CHAIN_ROLE.EXTENSION);
  const contractLike = [...mains, ...parallels];
  const existingAdams = collectFormContractAdams(prev);
  const newContractLike = contractLike.filter((item) => !existingAdams.has(normalizeAdam(item.adam)));
  const filledStages = [];
  const fullHistory = buildContractChainHistoryFromSymvPlan(chainRes, plan);

  let next = {
    ...prev,
    khmdhsSymvChainPlan: plan,
    khmdhsSymvPlanAppliedAt: new Date().toISOString(),
  };

  const totalAfter = existingAdams.size + newContractLike.length;
  if (totalAfter > 1 && !isMultipleContractsForm(next.implementationForm)) {
    next = migrateKhmdhsSingleToMultiForm(next);
    next.implementationForm = 'Πολλές Συμβάσεις';
  }

  if (isMultipleContractsForm(next.implementationForm) || totalAfter > 1) {
    next.implementationForm = 'Πολλές Συμβάσεις';
    const rows = [...(next.contracts || [])];
    newContractLike.forEach((item) => {
      const isMain = item.role === SYMV_CHAIN_ROLE.MAIN;
      const roleLabel = isMain
        ? (chainRes.contract?.roleLabel || 'Κύρια σύμβαση')
        : `Παράλληλη σύμβαση ${Math.max(0, parallels.indexOf(item)) + 1}`;
      rows.push(buildContractRow(item.adam, item, chainRes, {
        roleLabel,
        chainHistory: isMain ? fullHistory : [],
      }));
    });
    next.contracts = rows;
    if (newContractLike.length) filledStages.push('SYMV');
  } else if (newContractLike.length === 1 && existingAdams.size === 0) {
    const mainItem = newContractLike[0];
    const row = buildContractRow(
      mainItem.adam,
      mainItem,
      chainRes,
      {
        roleLabel: chainRes.contract?.roleLabel || 'Κύρια σύμβαση',
        chainHistory: fullHistory,
      }
    );
    next.khmdhsAdam = row.khmdhsAdam;
    next.khmdhsContractSnapshot = row.khmdhsContractSnapshot;
    next.khmdhsContractFetchedAt = row.khmdhsContractFetchedAt;
    next.khmdhsContractRoleLabel = row.khmdhsContractRoleLabel;
    next.contractDate = row.date;
    next.contractAmount = row.amount;
    next.contractEndDate = row.contractEndDate;
    next.khmdhsContractChainHistory = fullHistory;
    filledStages.push('SYMV');
  }

  const alreadyOnCard = new Set([
    ...collectFormContractAdams(next),
    ...collectSupplementaryAdams(next),
  ]);
  const extraSupp = supplements.filter((item) => !alreadyOnCard.has(normalizeAdam(item.adam)));
  if (extraSupp.length) {
    next.supplementaryContracts = [
      ...(Array.isArray(next.supplementaryContracts) ? next.supplementaryContracts : []),
      ...extraSupp.map((item) => buildSupplementaryRow(item.adam, item, chainRes, item.role)),
    ];
    next.hasSupplementaryContracts = next.supplementaryContracts.length > 0;
  }

  next.khmdhsSymvChainPlan = expandSymvPlanWithFormContracts(plan, next);

  const { next: shared, warnings: sharedWarnings } = mergeSharedKhmdhsFromChain(next, chainRes, { protect: true });
  next = mergePaymentsAndCommitmentsForStitch({ ...next, ...shared }, chainRes);

  const prevStages = detectStagesCoveredByForm(prev);
  detectStagesCoveredByForm(next).forEach((stage) => {
    if (!prevStages.includes(stage)) filledStages.push(stage);
  });
  if ((Array.isArray(next.khmdhsPayments) ? next.khmdhsPayments.length : 0)
    > (Array.isArray(prev.khmdhsPayments) ? prev.khmdhsPayments.length : 0)) {
    filledStages.push('PAY');
  }
  if ((Array.isArray(next.khmdhsCommitmentDecisions) ? next.khmdhsCommitmentDecisions.length : 0)
    > (Array.isArray(prev.khmdhsCommitmentDecisions) ? prev.khmdhsCommitmentDecisions.length : 0)) {
    filledStages.push('COMMIT');
  }

  next.khmdhsChainSeedAdam = prev.khmdhsChainSeedAdam || seedAdam || next.khmdhsChainSeedAdam || '';
  next.khmdhsAdamChainMeta = mergeKhmdhsChainMetaForStitch(
    prev.khmdhsAdamChainMeta,
    chainRes.chainMeta,
    next
  );
  if (prev.khmdhsChainStitchPlan) {
    next.khmdhsChainStitchPlan = prev.khmdhsChainStitchPlan;
  }

  const statusAutoUpdated = suggestProjectStatusAfterKhmdhsChain(prev.projectStatus, chainRes);
  if (statusAutoUpdated) next.projectStatus = statusAutoUpdated;

  const multi = isMultipleContractsForm(next.implementationForm);
  next.khmdhsDataQualityReview = reconcileReviewState(
    mergeSymvChainPlanIntoDataQualityReview(
      mergeKhmdhsReviewAfterFetch(
        prev.khmdhsDataQualityReview,
        chainRes.dataQualityReport,
        next,
        multi ? { contractIndex: 0 } : { singleContractRefresh: true }
      ),
      plan,
      next
    ),
    next
  );

  next.khmdhsAcknowledgedSituationIds = [
    ...new Set([
      ...(prev.khmdhsAcknowledgedSituationIds || []),
      KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
    ]),
  ];

  next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
  next.khmdhsDataQualityReview = reconcileReviewState(next.khmdhsDataQualityReview, next);
  next.khmdhsChainLastRefreshedAt = new Date().toISOString();

  const resolvedAnchor = resolveBranchAnchorFromChain(chainRes, seedAdam, branchAnchor);
  next = mergeBranchAnchorFields(next, {
    anchorAdam: prev.khmdhsBranchAnchorAdam || prev.khmdhsRequestAdam || resolvedAnchor.adam,
    anchorType: prev.khmdhsBranchAnchorType || resolvedAnchor.type,
    actRootReqAdam: prev.khmdhsActRootReqAdam
      || prev.khmdhsRequestAdam
      || inferActRootReqAdam(chainRes, seedAdam),
  });

  const {
    form: protectedForm,
    protectedCount,
    protectedFields = [],
  } = applyUserEditsAfterKhmdhsFetch(prev, next);

  const cleanedForm = stripPhantomContractApeFromForm(protectedForm, prev);
  const implementationFormAutoUpdated = prev.implementationForm !== cleanedForm.implementationForm
    ? cleanedForm.implementationForm
    : null;

  return {
    form: cleanedForm,
    warnings: sharedWarnings,
    apeConflict: null,
    statusAutoUpdated,
    protectedCount,
    protectedFields,
    implementationFormAutoUpdated,
    stitchFilledStages: [...new Set(filledStages)],
  };
}

export function applySymvChainPlanToForm(prev, chainRes, plan, {
  seedAdam = '',
  branchAnchor = null,
  suppressSituationModal = false,
  applyMode = 'replace',
} = {}) {
  if (applyMode === 'stitch') {
    return applySymvChainPlanToFormStitch(prev, chainRes, plan, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
    });
  }
  const active = (plan?.items || []).filter((i) => i?.adam && i.role !== SYMV_CHAIN_ROLE.SKIP);
  const mains = active.filter((i) => i.role === SYMV_CHAIN_ROLE.MAIN);
  const parallels = active.filter((i) => i.role === SYMV_CHAIN_ROLE.PARALLEL);
  const supplements = active.filter((i) => i.role === SYMV_CHAIN_ROLE.SUPPLEMENTARY || i.role === SYMV_CHAIN_ROLE.EXTENSION);
  const contractLike = [...mains, ...parallels];
  const multi = contractLike.length > 1;

  const fullHistory = buildContractChainHistoryFromSymvPlan(chainRes, plan);

  let next = {
    ...prev,
    ...emptyKhmdhsChainFields(),
    contracts: [],
    supplementaryContracts: [],
    hasSupplementaryContracts: false,
    implementationForm: multi ? 'Πολλές Συμβάσεις' : 'Μια Σύμβαση',
    khmdhsSymvChainPlan: plan,
    khmdhsSymvPlanAppliedAt: new Date().toISOString(),
  };

  if (multi) {
    next = migrateKhmdhsSingleToMultiForm(next);
    next.implementationForm = 'Πολλές Συμβάσεις';
    next.contracts = contractLike.map((item, idx) => {
      const isMain = item.role === SYMV_CHAIN_ROLE.MAIN;
      const roleLabel = isMain
        ? (chainRes.contract?.roleLabel || 'Κύρια σύμβαση')
        : `Παράλληλη σύμβαση ${parallels.indexOf(item) + 1}`;
      const history = isMain ? fullHistory : [];
      return buildContractRow(item.adam, item, chainRes, { roleLabel, chainHistory: history });
    });
  } else {
    const mainItem = contractLike[0];
    const row = buildContractRow(
      mainItem.adam,
      mainItem,
      chainRes,
      {
        roleLabel: chainRes.contract?.roleLabel || 'Κύρια σύμβαση',
        chainHistory: fullHistory,
      }
    );
    next.khmdhsAdam = row.khmdhsAdam;
    next.khmdhsContractSnapshot = row.khmdhsContractSnapshot;
    next.khmdhsContractFetchedAt = row.khmdhsContractFetchedAt;
    next.khmdhsContractRoleLabel = row.khmdhsContractRoleLabel;
    next.contractDate = row.date;
    next.contractAmount = row.amount;
    next.contractEndDate = row.contractEndDate;
    next.khmdhsContractChainHistory = fullHistory;
    next.contracts = [];
  }

  next.supplementaryContracts = supplements.map((item) => (
    buildSupplementaryRow(item.adam, item, chainRes, item.role)
  ));
  next.hasSupplementaryContracts = next.supplementaryContracts.length > 0;

  const { next: shared, warnings: sharedWarnings } = mergeSharedKhmdhsFromChain(next, chainRes, { protect: false });
  // shared πρέπει να «κερδίζει» τα κενά πεδία από emptyKhmdhsChainFields — αλλιώς χάνονται REQ/PROC/AWRD/PAY
  next = { ...next, ...shared, khmdhsChainSeedAdam: seedAdam || shared.khmdhsChainSeedAdam || '' };

  const statusAutoUpdated = suggestProjectStatusAfterKhmdhsChain(prev.projectStatus, chainRes);
  if (statusAutoUpdated) next.projectStatus = statusAutoUpdated;

  next.khmdhsDataQualityReview = reconcileReviewState(
    mergeSymvChainPlanIntoDataQualityReview(
      mergeKhmdhsReviewAfterFetch(
        prev.khmdhsDataQualityReview,
        chainRes.dataQualityReport,
        next,
        multi ? { contractIndex: 0 } : { singleContractRefresh: true }
      ),
      plan,
      next
    ),
    next
  );

  next.khmdhsAcknowledgedSituationIds = [
    ...new Set([
      ...(prev.khmdhsAcknowledgedSituationIds || []),
      KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
    ]),
  ];

  next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
  next.khmdhsDataQualityReview = reconcileReviewState(next.khmdhsDataQualityReview, next);
  next.khmdhsChainLastRefreshedAt = new Date().toISOString();

  const resolvedAnchor = resolveBranchAnchorFromChain(chainRes, seedAdam, branchAnchor);
  next = mergeBranchAnchorFields(next, {
    anchorAdam: resolvedAnchor.adam,
    anchorType: resolvedAnchor.type,
    actRootReqAdam: inferActRootReqAdam(chainRes, seedAdam),
  });

  const {
    form: protectedForm,
    protectedCount,
    protectedFields = [],
  } = applyUserEditsAfterKhmdhsFetch(prev, next);

  const cleanedForm = stripPhantomContractApeFromForm(protectedForm, prev);

  const implementationFormAutoUpdated = prev.implementationForm !== cleanedForm.implementationForm
    ? cleanedForm.implementationForm
    : null;

  return {
    form: cleanedForm,
    warnings: sharedWarnings,
    apeConflict: null,
    statusAutoUpdated,
    protectedCount,
    protectedFields,
    implementationFormAutoUpdated,
  };
}
