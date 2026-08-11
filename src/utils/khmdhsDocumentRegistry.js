/** Καταγραφή ηλεκτρονικών παραπομπών ΚΗΜΔΗΣ (όχι λήψη PDF) — ξεχωριστό από fileGroups */

import { v4 as uuidv4 } from 'uuid';
import { buildKhmdhsOpenUrl } from './khmdhsPortalLinks';
import { buildKhmdhsRequestCardSummary } from './khmdhsRequestFields';
import { buildKhmdhsNoticeCardSummary } from './khmdhsNoticeFields';
import { buildKhmdhsAwardCardSummary } from './khmdhsAwardFields';
import { buildKhmdhsContractCardSummary } from './khmdhsContractDisplayFields';
import {
  collectKhmdhsCommitmentDecisions,
  buildKhmdhsCommitmentCardSummary,
  getKhmdhsPaymentEntries,
} from './khmdhsChainExtraFields';
import { formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';
import { formatKhmdhsDateOnly } from './khmdhsNoticeFields';
import { getKhmdhsDisplayEntries, parseGreekAmountString } from './khmdhsFields';
import { getChainKindChoice, enrichChainHistoryWithReview, CHAIN_KIND_LABEL } from './khmdhsChainActions';
import { getKhmdhsSupplementaryStageEntries } from './khmdhsSupplementaryStageEntries';
import { getSymvPlanCustomLabel, overlaySymvPlanLabelsOnChainHistory, SYMV_CHAIN_ROLE, isAdamSkippedInSymvPlan } from './khmdhsSymvChainPlanner';
import { normalizeSearchText } from './searchUtils';
import { compareKhmdhsDocumentsByDateAsc } from './khmdhsDocumentChronology';
import {
  readPaymentActualAmountFromPayment,
  mergePaymentAmountsFromProject,
} from './khmdhsPaymentDocumentRoles';

export const KHMDHS_REGISTRY_STAGE_ORDER = ['REQ', 'COMMIT', 'PROC', 'AWRD', 'SYMV', 'EXT', 'APE', 'PAY', 'RELATED'];

export const KHMDHS_REGISTRY_STAGE_META = {
  REQ: { label: 'Αίτημα', shortLabel: 'Αίτημα', color: '#4f46e5', bg: '#eef2ff' },
  COMMIT: { label: 'Ανάληψη υποχρέωσης', shortLabel: 'Ανάληψη', color: '#7c3aed', bg: '#f5f3ff' },
  PROC: { label: 'Δημοσίευση', shortLabel: 'Δημοσίευση', color: '#2563eb', bg: '#eff6ff' },
  AWRD: { label: 'Κατακύρωση', shortLabel: 'Κατακύρωση', color: '#d97706', bg: '#fffbeb' },
  SYMV: { label: 'Σύμβαση', shortLabel: 'Σύμβαση', color: '#059669', bg: '#ecfdf5' },
  EXT: { label: 'Παράταση', shortLabel: 'Παράταση', color: '#b45309', bg: '#fffbeb' },
  APE: { label: 'ΑΠΕ', shortLabel: 'ΑΠΕ', color: '#0d9488', bg: '#ecfdf5' },
  PAY: { label: 'Ένταλμα πληρωμής', shortLabel: 'Πληρωμή', color: '#0d9488', bg: '#f0fdfa' },
  RELATED: { label: 'Σχετικό έγγραφο', shortLabel: 'Σχετικό', color: '#64748b', bg: '#f1f5f9' },
};

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

function adamTypeCode(adam) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(normalizeAdam(adam));
  return m ? m[2].toUpperCase() : '';
}

function stageFromType(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'REQ' || t === 'APPROVED_REQ') return 'REQ';
  if (t === 'COMMIT' || t === 'BUDGET') return 'COMMIT';
  if (t === 'PROC') return 'PROC';
  if (t === 'AWRD') return 'AWRD';
  if (t === 'SYMV') return 'SYMV';
  if (t === 'PAY') return 'PAY';
  return 'SYMV';
}

function isCancelled(snapshot, extraCancelled = false) {
  return !!(extraCancelled || snapshot?.cancelled);
}

function buildRegistryEntry({
  adam,
  snapshot = null,
  stage,
  type,
  title = '',
  subtitle = '',
  amount = '',
  date = '',
  roleLabel = '',
  fetchedAt = '',
  chainFetchedAt = '',
  isStub = false,
  amountSource = '',
}) {
  const normalized = normalizeAdam(adam || snapshot?.referenceNumber);
  if (!normalized) return null;
  if (isCancelled(snapshot)) return null;

  const resolvedType = type || adamTypeCode(normalized);
  const resolvedStage = stage || stageFromType(resolvedType);
  const meta = KHMDHS_REGISTRY_STAGE_META[resolvedStage] || KHMDHS_REGISTRY_STAGE_META.SYMV;
  const amountStr = String(amount || '').trim();
  const source = amountStr && (amountSource === 'user' || amountSource === 'khmdhs')
    ? amountSource
    : '';

  return {
    id: uuidv4(),
    adam: normalized,
    type: resolvedType,
    stage: resolvedStage,
    stageLabel: meta.label,
    title: String(title || snapshot?.title || '').trim(),
    subtitle: String(subtitle || '').trim(),
    amount: amountStr,
    amountSource: source,
    date: String(date || '').trim(),
    openUrl: buildKhmdhsOpenUrl(normalized),
    roleLabel: String(roleLabel || '').trim(),
    noticeType: snapshot?.noticeType != null ? String(snapshot.noticeType).trim() : '',
    requestIsApproved: !!snapshot?.isApproved,
    requestIsInitial: !!snapshot?.isInitial,
    isStub: !!isStub,
    linkLabel: '',
    recordedAt: '',
    chainFetchedAt: chainFetchedAt || fetchedAt || '',
  };
}

function pushUnique(map, entry) {
  if (!entry?.adam) return;
  const key = normalizeAdam(entry.adam);
  if (!key || map.has(key)) return;
  map.set(key, entry);
}

function entryFromRequest(block, fetchedAt) {
  // Χωρίς λεπτομέρειες δεν καταχωρούμε stub — ίδια λογική με COMMIT/PAY.
  if (!block?.snapshot || !block?.adam) return null;
  const summary = buildKhmdhsRequestCardSummary(block.snapshot);
  return buildRegistryEntry({
    adam: block.adam || summary?.adam,
    snapshot: block.snapshot,
    stage: 'REQ',
    type: 'REQ',
    title: summary?.title,
    subtitle: summary?.status || summary?.contractType || '',
    amount: summary?.amount || '',
    date: block.snapshot?.signedDate ? formatKhmdhsDateOnly(block.snapshot.signedDate) : '',
    fetchedAt: block.fetchedAt || fetchedAt,
  });
}

function entryFromCommitment(block) {
  // Χωρίς λεπτομέρειες δεν καταχωρούμε stub στα Αρχεία — ίδια λογική με τα εντάλματα.
  if (!block?.snapshot || !block?.adam) return null;
  const summary = buildKhmdhsCommitmentCardSummary(block.snapshot);
  return buildRegistryEntry({
    adam: block.adam || summary?.adam,
    snapshot: block.snapshot,
    stage: 'COMMIT',
    type: 'COMMIT',
    title: summary?.title || block.snapshot?.title,
    subtitle: block.snapshot?.organization || '',
    amount: summary?.amount || '',
    date: block.snapshot?.signedDate ? formatKhmdhsDateOnly(block.snapshot.signedDate) : '',
    fetchedAt: block.fetchedAt,
  });
}

function entryFromNotice(block) {
  // Χωρίς λεπτομέρειες δεν καταχωρούμε stub — ίδια λογική με COMMIT/PAY.
  // (Τα isStub από linkedAdams περνούν από άλλο μονοπάτι και φιλτράρονται στο auto-merge.)
  if (!block?.snapshot || !block?.adam) return null;
  const summary = buildKhmdhsNoticeCardSummary(block.snapshot);
  return buildRegistryEntry({
    adam: block.adam || summary?.adam,
    snapshot: block.snapshot,
    stage: 'PROC',
    type: 'PROC',
    title: summary?.title,
    subtitle: summary?.procedure || block.snapshot?.contractType || '',
    amount: summary?.amount || '',
    date: summary?.deadline || '',
    fetchedAt: block.fetchedAt,
  });
}

function entryFromAward(block) {
  // Χωρίς λεπτομέρειες δεν καταχωρούμε stub — ίδια λογική με COMMIT/PAY.
  if (!block?.snapshot || !block?.adam) return null;
  const summary = buildKhmdhsAwardCardSummary(block.snapshot);
  const contractors = Array.isArray(block.snapshot?.contractors) && block.snapshot.contractors.length
    ? block.snapshot.contractors.map((c) => c.name).filter(Boolean).join(' · ')
    : summary?.contractor || block.snapshot?.anadoxosName || '';
  return buildRegistryEntry({
    adam: block.adam || summary?.adam,
    snapshot: block.snapshot,
    stage: 'AWRD',
    type: 'AWRD',
    title: summary?.title,
    subtitle: contractors,
    amount: summary?.amount || '',
    date: summary?.awardDate || '',
    fetchedAt: block.fetchedAt,
  });
}

function entryFromContract({ adam, snapshot, fetchedAt, roleLabel, title, amount, date, cancelled }) {
  if (isCancelled(snapshot, cancelled)) return null;
  // Χωρίς στοιχεία (ούτε snapshot ούτε τίτλο) δεν καταχωρούμε γυμνό ΑΔΑΜ.
  if (!snapshot && !String(title || '').trim()) return null;
  const summary = buildKhmdhsContractCardSummary(snapshot, {
    storedAmount: amount != null && String(amount).trim() ? String(amount).trim() : '',
  });
  const resolvedAmount = amount || summary?.amount || '';
  const resolvedDate = date || summary?.signedDate || '';
  return buildRegistryEntry({
    adam: adam || summary?.adam,
    snapshot,
    stage: 'SYMV',
    type: 'SYMV',
    title: title || summary?.title,
    subtitle: summary?.contractor || '',
    amount: resolvedAmount,
    date: resolvedDate,
    roleLabel,
    fetchedAt,
  });
}

function formatPaymentRegistryAmountNumber(n) {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Ποσό εντάλματος για καταγραφή: προτεραιότητα στο χειροκίνητο πραγματικό ποσό,
 * μετά lookup από χαρακτηρισμό πληρωμών, αλλιώς το μεικτό από ΚΗΜΔΗΣ.
 * @returns {{ amount: string, amountSource: 'user'|'khmdhs'|'' }}
 */
function resolvePaymentRegistryAmount(block, amountLookup = null) {
  const fromBlock = readPaymentActualAmountFromPayment(block);
  if (fromBlock != null) {
    return {
      amount: formatPaymentRegistryAmountNumber(fromBlock),
      amountSource: 'user',
    };
  }

  const adam = normalizeAdam(block?.adam || block?.snapshot?.referenceNumber);
  if (adam && amountLookup && amountLookup[adam] != null) {
    return {
      amount: formatPaymentRegistryAmountNumber(amountLookup[adam]),
      amountSource: 'user',
    };
  }

  const snap = block?.snapshot;
  const fromKhmdhs = snap ? (formatKhmdhsCostSnapshotGross(snap) || '') : '';
  return {
    amount: fromKhmdhs,
    amountSource: fromKhmdhs ? 'khmdhs' : '',
  };
}

function entryFromPayment(block, amountLookup = null) {
  if (!block?.adam) return null;
  const customLabel = String(block.userDocumentLabel || block.roleLabel || '').trim();
  // Χωρίς λεπτομέρειες δεν καταχωρούμε stub στα Αρχεία — αλλιώς άσχετα PAY
  // εμφανίζονται ως «νέα έγγραφα» πριν ελεγχθεί η σχετικότητα με τη σύμβαση.
  if (!block.snapshot) return null;
  const snap = block.snapshot;
  const { amount, amountSource } = resolvePaymentRegistryAmount(block, amountLookup);
  return buildRegistryEntry({
    adam: block.adam || snap?.referenceNumber,
    snapshot: snap,
    stage: 'PAY',
    type: 'PAY',
    title: snap?.title || '',
    subtitle: snap?.organization || '',
    amount,
    amountSource,
    date: snap?.signedDate ? formatKhmdhsDateOnly(snap.signedDate) : '',
    roleLabel: customLabel,
    fetchedAt: block.fetchedAt,
  });
}

function addLinkedAdamStubs(chainRes, map) {
  const linked = chainRes?.chainMeta?.linkedAdams || {};
  // Δημοσιεύσεις (PROC) της αλυσίδας πέρα από την «κύρια» — π.χ. Τεύχη Δημοπράτησης
  // καταχωρημένα στο ΚΗΜΔΗΣ ως ξεχωριστή πράξη από τη Διακήρυξη/Πρόσκληση. Όταν έχουν
  // ανακτηθεί πλήρη στοιχεία τους, τα χρησιμοποιούμε για πραγματικό τίτλο αντί για γυμνό ΑΔΑΜ.
  const noticeSnapshotsByAdam = chainRes?.chainMeta?.noticeSnapshotsByAdam || {};
  const hasContractChainHistory = (chainRes.contractChainHistory || []).length > 0;
  const groups = [
    { key: 'approvedRequests', stage: 'COMMIT', type: 'COMMIT' },
    { key: 'budgetCommitments', stage: 'COMMIT', type: 'COMMIT' },
    { key: 'notices', stage: 'PROC', type: 'PROC' },
    { key: 'auctions', stage: 'AWRD', type: 'AWRD' },
    { key: 'contracts', stage: 'SYMV', type: 'SYMV' },
  ];
  groups.forEach(({ key, stage, type }) => {
    if (key === 'contracts' && hasContractChainHistory) return;
    (linked[key] || []).forEach((adamRaw) => {
      const adam = normalizeAdam(adamRaw);
      if (!adam || map.has(adam)) return;
      if (key === 'notices' && noticeSnapshotsByAdam[adam]) {
        const entry = entryFromNotice({
          adam,
          snapshot: noticeSnapshotsByAdam[adam],
          fetchedAt: chainRes.chainMeta?.resolvedAt || '',
        });
        if (entry) { pushUnique(map, entry); return; }
      }
      pushUnique(map, buildRegistryEntry({
        adam,
        stage,
        type,
        isStub: true,
      }));
    });
  });
}

/** Εξαγωγή υποψηφίων από αποτέλεσμα ανάκτησης αλυσίδας */
export function collectKhmdhsRegistryCandidatesFromChainRes(chainRes, review = null, project = null) {
  if (!chainRes?.success) return [];
  const map = new Map();
  // Χρησιμοποιούμε το fetchedAt της αλυσίδας αν υπάρχει — πιο ακριβής χρόνος
  const chainFetchedAt = chainRes.fetchedAt || chainRes.contract?.fetchedAt || new Date().toISOString();
  const paymentAmountLookup = mergePaymentAmountsFromProject(
    project,
    review || project?.khmdhsDataQualityReview
  );

  pushUnique(map, entryFromRequest(chainRes.request, chainFetchedAt));

  (chainRes.commitmentDecisions || []).forEach((d) => {
    pushUnique(map, entryFromCommitment(d));
  });
  if (chainRes.commitmentDecision) {
    pushUnique(map, entryFromCommitment(chainRes.commitmentDecision));
  }

  pushUnique(map, entryFromNotice(chainRes.notice));
  pushUnique(map, entryFromAward(chainRes.auction));

  if (chainRes.contract) {
    pushUnique(map, entryFromContract({
      adam: chainRes.contract.adam,
      snapshot: chainRes.contract.snapshot,
      fetchedAt: chainRes.contract.fetchedAt,
      roleLabel: (chainRes.contract.roleLabel || '').replace(/\s*\(επιλεγμένη\)/i, '').trim(),
    }));
  }

  // Ίδιο κριτήριο συμπερίληψης με το collectKhmdhsRegistryCandidatesFromProject — μια
  // τροποποίηση/παράταση καταγράφεται μόνο αν είναι η κύρια σύμβαση, έχει ρητό χαρακτηρισμό
  // χρήστη, ή έχει αυτόματα ανιχνευμένο (όχι «uncertain») kind. Έτσι δεν προτείνεται πρόωρα
  // για καταγραφή μια πράξη που δεν έχει ακόμα χαρακτηριστεί.
  (chainRes.contractChainHistory || []).forEach((h) => {
    if (!shouldIncludeChainHistoryInRegistry(h, review, project)) return;
    const kind = h.effectiveKind || h.kind;
    const rawLabel = h.label || (kind && kind !== 'uncertain' ? (CHAIN_KIND_LABEL[kind] || '') : '');
    const roleLabel = rawLabel.replace(/\s*\(επιλεγμένη\)/i, '').trim();
    if (!roleLabel && !h.isRoot) return;
    pushUnique(map, entryFromContract({
      adam: h.adam,
      snapshot: h.snapshot,
      // Τίτλος από snapshot ή από χαρακτηρισμό (label) — χωρίς κανένα από τα δύο
      // το entryFromContract απορρίπτει γυμνό ΑΔΑΜ.
      title: h.title || roleLabel,
      amount: h.contractAmount,
      date: h.contractDate,
      roleLabel,
    }));
  });

  (chainRes.payments || []).forEach((p) => {
    const adam = normalizeAdam(p?.adam || p?.snapshot?.referenceNumber);
    const fromProject = (project?.khmdhsPayments || []).find(
      (row) => normalizeAdam(row?.adam || row?.snapshot?.referenceNumber) === adam
    );
    pushUnique(map, entryFromPayment({
      ...p,
      ...(fromProject || {}),
      adam: p.adam || fromProject?.adam,
      snapshot: p.snapshot || fromProject?.snapshot,
      userDocumentLabel: fromProject?.userDocumentLabel || p.userDocumentLabel || '',
      userActualAmount: fromProject?.userActualAmount ?? p.userActualAmount,
    }, paymentAmountLookup));
  });

  addLinkedAdamStubs(chainRes, map);

  return annotateRegistryLinkLabels([...map.values()]);
}

/**
 * Συμπεριλαμβάνεται στον κατάλογο καταγραφής αν:
 *  - είναι κύρια σύμβαση (isRoot)
 *  - ή έχει ρητό χαρακτηρισμό χρήστη
 *  - ή έχει αυτόματα ανιχνευμένο kind (εκτός "uncertain") — π.χ. modification/extension
 *    Αυτό εξασφαλίζει ότι εγγραφές δεν εξαφανίζονται μετά τον χαρακτηρισμό μίας από αυτές.
 */
export function shouldIncludeChainHistoryInRegistry(h, review, project = null) {
  if (!h?.adam || h.cancelled) return false;
  if (isAdamSkippedInSymvPlan(project, h.adam)) return false;
  if (h.isRoot) return true;
  const choice = getChainKindChoice(review, h.adam);
  if (choice?.note === 'Αποκλείστηκε στη κατανομή SYMV') return false;
  if (!!choice?.kind) return true;
  const kind = h.effectiveKind || h.kind;
  return !!kind && kind !== 'uncertain';
}

export function filterRegistryCandidatesBySymvPlan(candidates, project) {
  if (!project?.khmdhsSymvChainPlan?.items?.length) return candidates || [];
  return (candidates || []).filter((c) => !isAdamSkippedInSymvPlan(project, c.adam));
}

function buildRegistrySuppAmountDateLookup(project) {
  const map = new Map();
  getKhmdhsSupplementaryStageEntries(project).forEach((row) => {
    const adam = normalizeAdam(row?.adam);
    if (!adam) return;
    map.set(adam, {
      amount: String(row.amount || row.rawAmount || '').trim(),
      date: String(row.signedDateDisplay || row.date || '').trim(),
    });
  });
  (project?.khmdhsSymvChainPlan?.items || []).forEach((item) => {
    const adam = normalizeAdam(item?.adam);
    if (!adam) return;
    const prev = map.get(adam) || {};
    map.set(adam, {
      amount: String(item.amount || prev.amount || '').trim(),
      date: String(item.date || prev.date || '').slice(0, 10),
    });
  });
  const review = project?.khmdhsDataQualityReview;
  (review?.items || []).forEach((item) => {
    if (item.fieldId !== 'chainKindReview') return;
    const adam = normalizeAdam(item.chainAdam || item.adam);
    if (!adam) return;
    const res = review?.resolutions?.[`chainKindReview::${adam}`];
    const meta = res?.meta || {};
    const prev = map.get(adam) || {};
    map.set(adam, {
      amount: String(meta.modAmount || prev.amount || '').trim(),
      date: String(meta.modDate || meta.endDate || prev.date || '').slice(0, 10),
    });
  });
  return map;
}

function resolveRegistryContractAmountDate(lookup, adam, fallbackAmount = '', fallbackDate = '') {
  const hit = lookup.get(normalizeAdam(adam));
  return {
    amount: String(fallbackAmount || hit?.amount || '').trim(),
    date: String(fallbackDate || hit?.date || '').trim(),
  };
}

/** Εξαγωγή από αποθηκευμένο υποέργο (για εμφάνιση / συγχρονισμό) */
export function collectKhmdhsRegistryCandidatesFromProject(project) {
  if (!project) return [];
  const map = new Map();
  const review = project.khmdhsDataQualityReview || null;
  const suppLookup = buildRegistrySuppAmountDateLookup(project);
  const paymentAmountLookup = mergePaymentAmountsFromProject(project, review);

  if (project.khmdhsRequestSnapshot || project.khmdhsRequestAdam) {
    pushUnique(map, entryFromRequest({
      adam: project.khmdhsRequestAdam,
      snapshot: project.khmdhsRequestSnapshot,
      fetchedAt: project.khmdhsRequestFetchedAt,
    }));
  }

  collectKhmdhsCommitmentDecisions(project).forEach((d) => {
    pushUnique(map, entryFromCommitment(d));
  });

  if (project.khmdhsNoticeSnapshot || project.khmdhsNoticeAdam) {
    pushUnique(map, entryFromNotice({
      adam: project.khmdhsNoticeAdam,
      snapshot: project.khmdhsNoticeSnapshot,
      fetchedAt: project.khmdhsNoticeFetchedAt,
    }));
  }

  if (project.khmdhsAwardSnapshot || project.khmdhsAwardAdam) {
    pushUnique(map, entryFromAward({
      adam: project.khmdhsAwardAdam,
      snapshot: project.khmdhsAwardSnapshot,
      fetchedAt: project.khmdhsAwardFetchedAt,
    }));
  }

  const allDisplayEntries = getKhmdhsDisplayEntries(project);

  /**
   * Αν το khmdhsContractRoleLabel ενός slot είναι κενό (π.χ. parallel fetch δεν έχει ολοκληρωθεί),
   * ψάχνουμε στα chain history όλων των άλλων slots για να βρούμε το label αυτού του ADAM.
   * Αυτό αποτρέπει την εμφάνιση «Σύμβαση 1» / «Σύμβαση 2» αντί ουσιαστικής ετικέτας.
   */
  function findRoleLabelFromChainHistories(adamKey) {
    for (const e of allDisplayEntries) {
      const hit = (e.chainHistory || []).find(
        (h) => normalizeAdam(h.adam) === adamKey
      );
      if (hit) {
        return resolveChainHistoryRoleLabel(hit, review, project);
      }
    }
    return '';
  }

  allDisplayEntries.forEach((entry) => {
    const entryKey = normalizeAdam(entry.adam);
    const resolvedRoleLabel = entry.roleLabel
      || findRoleLabelFromChainHistories(entryKey);
    pushUnique(map, entryFromContract({
      adam: entry.adam,
      snapshot: entry.snapshot,
      fetchedAt: entry.fetchedAt,
      roleLabel: resolvedRoleLabel,
      amount: entry.storedAmount,
    }));
    (entry.chainHistory || []).forEach((h) => {
      if (!shouldIncludeChainHistoryInRegistry(h, review, project)) return;
      const effectiveLabel = resolveChainHistoryRoleLabel(h, review, project);
      const { amount, date } = resolveRegistryContractAmountDate(
        suppLookup,
        h.adam,
        h.contractAmount,
        h.contractDate || h.endDate || h.modDate
      );
      pushUnique(map, entryFromContract({
        adam: h.adam,
        snapshot: h.snapshot,
        title: h.title || effectiveLabel,
        amount,
        date,
        roleLabel: effectiveLabel,
        cancelled: h.cancelled,
      }));
    });
  });

  if (!getKhmdhsDisplayEntries(project).length && project.khmdhsContractSnapshot) {
    pushUnique(map, entryFromContract({
      adam: project.khmdhsAdam,
      snapshot: project.khmdhsContractSnapshot,
      fetchedAt: project.khmdhsContractFetchedAt,
      roleLabel: project.khmdhsContractRoleLabel || '',
      amount: project.contractAmount,
    }));
    // Εμπλουτισμός με review πριν την εμφάνιση ώστε οι ετικέτες να αντικατοπτρίζουν
    // τον χαρακτηρισμό του χρήστη (π.χ. «Παράταση» αντί «Συμπληρωματική σύμβαση»)
    const enrichedFallbackHistory = overlaySymvPlanLabelsOnChainHistory(
      enrichChainHistoryWithReview(
        project.khmdhsContractChainHistory || [],
        review
      ),
      project.khmdhsSymvChainPlan
    );
    enrichedFallbackHistory.forEach((h) => {
      if (!shouldIncludeChainHistoryInRegistry(h, review, project)) return;
      const effectiveLabel = resolveChainHistoryRoleLabel(h, review, project);
      const { amount, date } = resolveRegistryContractAmountDate(
        suppLookup,
        h.adam,
        h.contractAmount,
        h.contractDate || h.endDate || h.modDate
      );
      pushUnique(map, entryFromContract({
        adam: h.adam,
        snapshot: h.snapshot,
        title: h.title || effectiveLabel,
        amount,
        date,
        roleLabel: effectiveLabel,
        cancelled: h.cancelled,
      }));
    });
  }

  getKhmdhsPaymentEntries(project).forEach((p) => {
    const paymentBlock = (project?.khmdhsPayments || []).find(
      (row) => normalizeAdam(row?.adam || row?.snapshot?.referenceNumber) === normalizeAdam(p.adam)
    ) || p;
    pushUnique(map, entryFromPayment({
      ...paymentBlock,
      adam: p.adam,
      snapshot: p.snapshot,
      userDocumentLabel: paymentBlock?.userDocumentLabel || '',
      userActualAmount: paymentBlock?.userActualAmount,
    }, paymentAmountLookup));
  });

  return annotateRegistryLinkLabels([...map.values()]);
}

/**
 * Ανιχνεύει αν ο τίτλος μιας δημοσίευσης (όπως καταγράφεται στο ΚΗΜΔΗΣ) αντιστοιχεί
 * στα «Τεύχη Δημοπράτησης» — έγγραφο που συχνά καταχωρείται στο ΚΗΜΔΗΣ με τον δικό του
 * τίτλο (π.χ. «ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ») αντί για τον τίτλο του έργου, ανεξάρτητα από
 * τον τύπο δημοσίευσης (Διακήρυξη/Πρόσκληση/Προκήρυξη) που έχει καταγραφεί.
 * Ανεκτικό σε κεφαλαία/πεζά και τόνους.
 */
export function isTenderDocumentTitle(title) {
  const norm = normalizeSearchText(title);
  if (!norm) return false;
  return /τευχ(η|ος)\s+δημοπρατησ/.test(norm) || /τευχ(η|ος)\s+διαγωνισμ/.test(norm);
}

function isInvitationNoticeType(noticeType) {
  const nt = String(noticeType || '');
  return /προκήρυξ/i.test(nt) || /πρόσκληση/i.test(nt);
}

function isDiakiryxiNoticeType(noticeType) {
  const nt = String(noticeType || '');
  return /διακήρυξ/i.test(nt) && !isInvitationNoticeType(nt);
}

/**
 * Τεύχη Δημοπράτησης: είτε από τίτλο ΚΗΜΔΗΣ, είτε (συχνό σε δήμους) δεύτερο PROC
 * με τύπο «Διακήρυξη» ενώ υπάρχει ήδη Πρόσκληση/Προκήρυξη — ο API τίτλος είναι
 * συχνά ο τίτλος του έργου, όχι η λέξη «Τεύχη».
 */
export function isLikelyTenderDossierEntry(entry, allProcEntries = []) {
  if (!entry || entry.stage !== 'PROC') return false;
  if (isTenderDocumentTitle(entry.title)) return true;
  if (!isDiakiryxiNoticeType(entry.noticeType)) return false;
  const self = normalizeAdam(entry.adam);
  return (allProcEntries || []).some((sibling) => {
    if (!sibling || sibling.stage !== 'PROC') return false;
    if (normalizeAdam(sibling.adam) === self) return false;
    return isInvitationNoticeType(sibling.noticeType);
  });
}

function noticeLinkLabel(noticeType, index, total, title = '', { treatAsTender = false } = {}) {
  if (treatAsTender || isTenderDocumentTitle(title)) {
    return total > 1 ? `Τεύχη Δημοπράτησης ${index}` : 'Τεύχη Δημοπράτησης';
  }
  const nt = String(noticeType || '').trim();
  let base = '';
  if (/προκήρυξ/i.test(nt)) base = 'Προκήρυξη';
  else if (/πρόσκληση.*υποβολ/i.test(nt)) base = 'Πρόσκληση υποβολής προσφορών';
  else if (/εκδήλωση.*ενδιαφέροντος/i.test(nt)) base = 'Πρόσκληση εκδήλωσης ενδιαφέροντος';
  else if (/διακήρυξ/i.test(nt)) base = 'Διακήρυξη';
  else if (/πρόσκληση/i.test(nt)) base = 'Πρόσκληση';
  else if (nt) base = nt;
  else base = 'Δημοσίευση';
  return total > 1 ? `${base} ${index}` : base;
}

/** Ετικέτα εγγράφου δημοσίευσης για UI (προκήρυξη, πρόσκληση, τεύχη δημοπράτησης κ.λπ.) */
export function publicationDocumentLabel(noticeType, index = 1, total = 1, title = '') {
  return noticeLinkLabel(noticeType, index, total, title);
}

function resolveChainHistoryRoleLabel(h, review, project) {
  const adam = normalizeAdam(h?.adam);
  if (isAdamSkippedInSymvPlan(project, adam)) return '';
  const custom = getSymvPlanCustomLabel(project?.khmdhsSymvChainPlan, adam);
  if (custom) return custom;

  const planItem = (project?.khmdhsSymvChainPlan?.items || []).find(
    (i) => normalizeAdam(i.adam) === adam
  );
  if (planItem?.role === SYMV_CHAIN_ROLE.INTERMEDIATE) {
    return 'Ενδιάμεσος κρίκος';
  }

  const stored = String(h?.label || '').trim().replace(/\s*\(επιλεγμένη\)/i, '').trim();
  if (stored && stored !== CHAIN_KIND_LABEL.other) return stored;

  const choice = getChainKindChoice(review, adam);
  if (choice?.note) {
    const fromNote = choice.note.match(/Ενδιάμεσος κρίκος:\s*(.+)/i);
    if (fromNote?.[1]?.trim()) return fromNote[1].trim();
  }

  const kind = h?.effectiveKind || h?.kind;
  return (kind && kind !== 'uncertain' ? (CHAIN_KIND_LABEL[kind] || '') : '');
}
function contractLinkLabel(roleLabel, index, total) {
  const rl = String(roleLabel || '').trim();
  if (rl && rl !== CHAIN_KIND_LABEL.other) return rl;
  return total > 1 ? `Σύμβαση ${index}` : 'Σύμβαση';
}

function formatRegistryLinkDate(value) {
  const formatted = formatKhmdhsDateOnly(value);
  if (!formatted) return '';
  return formatted.replace(/\//g, '-');
}

function formatRegistryLinkAmount(amount) {
  const raw = String(amount || '').trim();
  if (!raw) return '';
  if (/€/.test(raw)) {
    return raw.replace(/\s*€\s*$/i, '').trim() + '€';
  }
  const parsed = parseGreekAmountString(raw);
  if (parsed > 0) {
    return parsed.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
  }
  const asNum = Number(String(raw).replace(/\./g, '').replace(',', '.'));
  if (!Number.isNaN(asNum) && asNum > 0) {
    return asNum.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
  }
  return raw.includes(',') ? `${raw}€` : raw;
}

function isExtensionRegistryLabel(label) {
  return /παράταση/i.test(String(label || ''));
}

function isSupplementaryRegistryLabel(label) {
  return /συμπληρωματικ/i.test(String(label || ''));
}

function isMainContractRegistryLabel(label) {
  const l = String(label || '').trim();
  return /αρχική\s+σύμβαση/i.test(l) || l === 'Κύρια σύμβαση';
}

/** Προσθήκη ημερομηνίας/ποσού στον τίτλο καταγραφής — από ήδη διαθέσιμα πεδία entry */
export function enrichRegistryLinkLabel(baseLabel, entry) {
  const label = String(baseLabel || '').trim();
  if (!label || !entry) return label;

  const roleLabel = String(entry.roleLabel || '').trim();
  const date = formatRegistryLinkDate(entry.date);
  const amount = formatRegistryLinkAmount(entry.amount);

  if (entry.stage === 'PAY' && amount) {
    return `${label} : ${amount}`;
  }

  if (entry.stage === 'SYMV') {
    if (isExtensionRegistryLabel(roleLabel) || isExtensionRegistryLabel(label)) {
      return date ? `${label} ${date}` : label;
    }
    if (
      amount
      && (
        isMainContractRegistryLabel(roleLabel)
        || isMainContractRegistryLabel(label)
        || isSupplementaryRegistryLabel(roleLabel)
        || isSupplementaryRegistryLabel(label)
      )
    ) {
      return `${label} ${amount}`;
    }
  }

  return label;
}

/** Ανθρώπινο όνομα κρίκου αλυσίδας — μόνο αυτό εμφανίζεται στο UI */
export function annotateRegistryLinkLabels(entries) {
  const sorted = sortRegistryEntries(entries);
  const totals = {};
  sorted.forEach((e) => {
    totals[e.stage] = (totals[e.stage] || 0) + 1;
  });
  const procEntries = sorted.filter((e) => e.stage === 'PROC');
  const counters = {};
  const tenderCounters = { n: 0 };
  const tenderTotal = procEntries.filter((e) => isLikelyTenderDossierEntry(e, procEntries)).length;
  return sorted.map((entry) => {
    counters[entry.stage] = (counters[entry.stage] || 0) + 1;
    const idx = counters[entry.stage];
    const total = totals[entry.stage] || 1;
    const suffix = total > 1 ? ` ${idx}` : '';
    let linkLabel = '';
    switch (entry.stage) {
      case 'REQ':
        if (entry.isStub) linkLabel = `Αίτημα${suffix}`;
        else if (entry.requestIsApproved && !entry.requestIsInitial) linkLabel = `Εγκεκριμένο αίτημα${suffix}`;
        else linkLabel = `Πρωτογενές αίτημα${suffix}`;
        break;
      case 'COMMIT':
        linkLabel = `Απόφαση ανάληψης υποχρέωσης${suffix}`;
        break;
      case 'PROC': {
        const asTender = !entry.isStub && isLikelyTenderDossierEntry(entry, procEntries);
        if (asTender) {
          tenderCounters.n += 1;
          linkLabel = noticeLinkLabel(entry.noticeType, tenderCounters.n, tenderTotal, entry.title, {
            treatAsTender: true,
          });
        } else {
          linkLabel = entry.isStub
            ? `Δημοσίευση${suffix}`
            : noticeLinkLabel(entry.noticeType, idx, total, entry.title);
        }
        break;
      }
      case 'AWRD':
        linkLabel = total > 1 ? `Απόφαση ανάθεσης${suffix}` : 'Απόφαση ανάθεσης';
        break;
      case 'SYMV':
        linkLabel = contractLinkLabel(entry.roleLabel, idx, total);
        break;
      case 'PAY':
        linkLabel = entry.roleLabel
          ? entry.roleLabel
          : `Ένταλμα πληρωμής${suffix}`;
        break;
      case 'RELATED':
        linkLabel = entry.linkLabel || entry.title || `Σχετικό έγγραφο${suffix}`;
        break;
      default:
        linkLabel = entry.stageLabel || 'Έγγραφο';
    }
    const enrichedLabel = enrichRegistryLinkLabel(linkLabel, entry);
    // Σημείωση: δεν εμφανίζουμε πλέον τον «πραγματικό τίτλο» του εγγράφου σαν υπότιτλο κάτω
    // από την ετικέτα — ο τίτλος που καταχωρεί ο κάθε φορέας στο ΚΗΜΔΗΣ ανά πράξη (π.χ. σε
    // αποφάσεις ανάληψης υποχρέωσης ή αιτήματα) συχνά διαφέρει σε διατύπωση/περικοπή από
    // πράξη σε πράξη χωρίς να σημαίνει κάτι διαφορετικό, οπότε προκαλούσε σύγχυση αντί να
    // βοηθάει. Η ετικέτα του κρίκου (π.χ. «Τεύχη Δημοπράτησης») παραμένει ως έχει.
    return { ...entry, linkLabel: enrichedLabel };
  });
}

export function sortRegistryEntries(entries) {
  return [...(entries || [])].sort((a, b) => {
    const sa = KHMDHS_REGISTRY_STAGE_ORDER.indexOf(a.stage);
    const sb = KHMDHS_REGISTRY_STAGE_ORDER.indexOf(b.stage);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return compareKhmdhsDocumentsByDateAsc(a, b);
  });
}

export function groupRegistryByStage(entries) {
  const groups = [];
  KHMDHS_REGISTRY_STAGE_ORDER.forEach((stage) => {
    const items = (entries || []).filter((e) => e.stage === stage);
    if (!items.length) return;
    groups.push({
      stage,
      ...KHMDHS_REGISTRY_STAGE_META[stage],
      entries: items,
    });
  });
  return groups;
}

/** Συγχώνευση κατά ΑΔΑΜ — ενημέρωση σε επανάληψη ανάκτησης */
export function mergeKhmdhsDocumentRegistry(existing, selected, chainFetchedAt = '') {
  const byAdam = new Map();
  (existing || []).forEach((e) => {
    const key = normalizeAdam(e.adam);
    if (key) byAdam.set(key, e);
  });

  const now = new Date().toISOString();
  (selected || []).forEach((c) => {
    const key = normalizeAdam(c.adam);
    if (!key) return;
    const prev = byAdam.get(key);
    byAdam.set(key, {
      ...c,
      id: prev?.id || c.id || uuidv4(),
      recordedAt: prev?.recordedAt || now,
      chainFetchedAt: chainFetchedAt || c.chainFetchedAt || prev?.chainFetchedAt || '',
    });
  });

  return annotateRegistryLinkLabels([...byAdam.values()]);
}

/**
 * Ενημερώνει τα ήδη καταγεγραμμένα στοιχεία του μητρώου (χωρίς να προσθέτει νέα) με τον πιο
 * πρόσφατο πραγματικό τίτλο/τύπο δημοσίευσης από τους τρέχοντες υποψήφιους κρίκους — ώστε
 * παλαιότερες καταγραφές (π.χ. πριν την αναγνώριση «Τεύχη Δημοπράτησης») να αποκτούν τη σωστή
 * ονομασία μετά από ανανέωση ΚΗΜΔΗΣ, χωρίς να απαιτείται νέα χειροκίνητη καταγραφή.
 */
export function resyncRegistryEntryTitles(existing, candidates) {
  if (!existing?.length || !candidates?.length) return existing || [];
  const byAdam = new Map();
  candidates.forEach((c) => {
    const key = normalizeAdam(c?.adam);
    if (key && !byAdam.has(key)) byAdam.set(key, c);
  });
  let changed = false;
  const next = existing.map((entry) => {
    const fresh = byAdam.get(normalizeAdam(entry.adam));
    if (!fresh) return entry;
    const patch = {};
    const freshTitle = String(fresh.title || '').trim();
    const freshNoticeType = String(fresh.noticeType || '').trim();
    const freshSubtitle = String(fresh.subtitle || '').trim();
    if (freshTitle && freshTitle !== entry.title) patch.title = freshTitle;
    if (freshNoticeType && freshNoticeType !== entry.noticeType) patch.noticeType = freshNoticeType;
    if (freshSubtitle && freshSubtitle !== entry.subtitle) patch.subtitle = freshSubtitle;
    const freshAmount = String(fresh.amount || '').trim();
    if (freshAmount && freshAmount !== String(entry.amount || '').trim()) {
      const isPay = entry.stage === 'PAY' || fresh.stage === 'PAY';
      if (!isPay) {
        patch.amount = freshAmount;
        if (fresh.amountSource) patch.amountSource = fresh.amountSource;
      } else if (fresh.amountSource === 'user') {
        // Νέο χειροκίνητο ποσό πάντα υπερισχύει
        patch.amount = freshAmount;
        patch.amountSource = 'user';
      } else if (!String(entry.amount || '').trim() || entry.amountSource === 'khmdhs') {
        // Γέμισμα κενού ή ενημέρωση προηγούμενου ποσού ΚΗΜΔΗΣ
        patch.amount = freshAmount;
        if (fresh.amountSource) patch.amountSource = fresh.amountSource;
      }
      // Αλλιώς: υπάρχον ποσό εντάλματος (χειροκίνητο ή παλιό χωρίς πηγή) διατηρείται
    }
    // Ένα «γυμνό» ΑΔΑΜ (χωρίς ποτέ ανακτημένα στοιχεία) παύει να είναι stub μόλις βρεθεί
    // πραγματικός τίτλος του — αλλιώς η ετικέτα του παραμένει γενική («Δημοσίευση Ν»).
    if (entry.isStub && freshTitle) patch.isStub = false;
    if (!Object.keys(patch).length) return entry;
    changed = true;
    return { ...entry, ...patch };
  });
  return changed ? annotateRegistryLinkLabels(next) : existing;
}

export function formatRegistryPreviewLine(entry) {
  if (!entry) return '';
  const parts = [entry.adam];
  if (entry.amount) parts.push(entry.amount);
  if (entry.date) parts.push(entry.date);
  if (entry.subtitle) parts.push(entry.subtitle);
  return parts.filter(Boolean).join(' · ');
}

/** Συμπαγής γραμμή meta (χωρίς επανάληψη ΑΔΑΜ) */
export function formatRegistryCompactMeta(entry) {
  if (!entry) return '';
  const parts = [];
  if (entry.amount) parts.push(entry.amount);
  if (entry.date) parts.push(entry.date);
  const sub = String(entry.subtitle || '').trim();
  if (sub && sub.length <= 56) parts.push(sub);
  return parts.filter(Boolean).join(' · ');
}

/** Κυρίαρχος τίτλος αλυσίδας — για απόκρυψη επαναλήψεων */
export function pickRegistryDominantTitle(entries) {
  const counts = new Map();
  (entries || []).forEach((e) => {
    const t = String(e?.title || '').trim();
    if (!t || t.length < 12) return;
    counts.set(t, (counts.get(t) || 0) + 1);
  });
  let best = '';
  let bestCount = 0;
  counts.forEach((count, title) => {
    if (count > bestCount) {
      best = title;
      bestCount = count;
    }
  });
  return best;
}

export function shouldShowRegistryEntryTitle(entry, dominantTitle) {
  const title = String(entry?.title || '').trim();
  if (!title) return false;
  if (!dominantTitle) return title.length <= 72;
  if (title === dominantTitle) return false;
  if (dominantTitle.length > 24 && title.includes(dominantTitle.slice(0, Math.min(40, dominantTitle.length)))) {
    return false;
  }
  return true;
}

export const KHMDHS_REGISTRY_STAGE_SHORT = {
  REQ: 'Αίτ.',
  COMMIT: 'Ανάλ.',
  PROC: 'Διαγ.',
  AWRD: 'Κατ.',
  SYMV: 'Συμβ.',
  PAY: 'Πληρ.',
};

export function registryEntryIsAlreadyRecorded(entry, existing) {
  const key = normalizeAdam(entry?.adam);
  if (!key) return false;
  return (existing || []).some((e) => normalizeAdam(e.adam) === key);
}

/** Φόρτωμα modal καταγραφής μετά τον χαρακτηρισμό εγγράφων. */
export function mergeRegistryCandidateLists(...lists) {
  const byAdam = new Map();
  lists.forEach((entries) => {
    (entries || []).forEach((e) => {
      const key = normalizeAdam(e?.adam);
      if (!key) return;
      const prev = byAdam.get(key);
      if (!prev) {
        byAdam.set(key, e);
        return;
      }
      const nextAmount = String(e.amount || '').trim();
      const prevAmount = String(prev.amount || '').trim();
      let amount = nextAmount || prevAmount;
      let amountSource = (nextAmount ? e.amountSource : prev.amountSource) || '';
      // Εντάλματα: το χειροκίνητο ποσό δεν χάνεται από μεταγενέστερο ποσό ΚΗΜΔΗΣ
      if ((e.stage === 'PAY' || prev.stage === 'PAY') && prevAmount && nextAmount) {
        if (prev.amountSource === 'user' && e.amountSource !== 'user') {
          amount = prevAmount;
          amountSource = 'user';
        } else if (e.amountSource === 'user') {
          amount = nextAmount;
          amountSource = 'user';
        } else if (prev.amountSource === 'user') {
          amount = prevAmount;
          amountSource = 'user';
        }
      } else if ((e.stage === 'PAY' || prev.stage === 'PAY') && prevAmount && !nextAmount) {
        amount = prevAmount;
        amountSource = prev.amountSource || amountSource;
      }
      byAdam.set(key, {
        ...prev,
        ...e,
        title: e.title || prev.title,
        amount,
        amountSource,
        roleLabel: e.roleLabel || prev.roleLabel,
      });
    });
  });
  return annotateRegistryLinkLabels([...byAdam.values()]);
}

/**
 * Αυτόματη ενημέρωση μητρώου εγγράφων από αποτέλεσμα(τα) αλυσίδας:
 * - ανανέωση τίτλων υπαρχόντων
 * - προσθήκη νέων πλήρων εγγραφών (όχι γυμνά stubs)
 * Χρησιμοποιείται στην ανανέωση κάρτας και στη χειροκίνητη ανάκτηση (διατήρηση).
 */
export function applyAutoDocumentRegistryFromChain(project, chainResList, { nowIso } = {}) {
  let chainRegistryCandidates = [];
  (Array.isArray(chainResList) ? chainResList : []).forEach((cr) => {
    if (!cr) return;
    chainRegistryCandidates = mergeRegistryCandidateLists(
      chainRegistryCandidates,
      collectKhmdhsRegistryCandidatesFromChainRes(
        cr,
        project?.khmdhsDataQualityReview,
        project
      )
    );
  });
  const freshRegistryCandidates = filterRegistryCandidatesBySymvPlan(
    mergeRegistryCandidateLists(
      chainRegistryCandidates,
      collectKhmdhsRegistryCandidatesFromProject(project)
    ),
    project
  );
  const existing = project?.khmdhsDocumentRegistry || [];
  if (!freshRegistryCandidates.length) return existing;

  const resyncedRegistry = resyncRegistryEntryTitles(existing, freshRegistryCandidates);
  const newRegistryCandidates = freshRegistryCandidates.filter(
    (c) => !c.isStub && !registryEntryIsAlreadyRecorded(c, resyncedRegistry)
  );
  return newRegistryCandidates.length
    ? mergeKhmdhsDocumentRegistry(
      resyncedRegistry,
      newRegistryCandidates,
      nowIso || new Date().toISOString()
    )
    : resyncedRegistry;
}

export function buildRegistryModalPayloadAfterReview(project, chainFetchedAt = '', chainRes = null) {
  const fromChain = chainRes?.success
    ? collectKhmdhsRegistryCandidatesFromChainRes(chainRes, project?.khmdhsDataQualityReview, project)
    : [];
  const fromProject = collectKhmdhsRegistryCandidatesFromProject(project);
  const candidates = filterRegistryCandidatesBySymvPlan(
    fromChain.length
      ? mergeRegistryCandidateLists(fromChain, fromProject)
      : fromProject,
    project
  );
  const existing = project?.khmdhsDocumentRegistry || [];
  return {
    candidates,
    existing,
    chainFetchedAt: chainFetchedAt || new Date().toISOString(),
  };
}

export function shouldOfferRegistryAfterReview(project, { dismissed, chainFetchedAt = '', chainRes = null } = {}) {
  const { candidates, existing } = buildRegistryModalPayloadAfterReview(project, chainFetchedAt, chainRes);
  if (!candidates.length) return false;
  const hasNew = candidates.some((c) => !registryEntryIsAlreadyRecorded(c, existing));
  const isDismissed = dismissed ?? !!project?.khmdhsDocumentRegistryDismissed;
  return !isDismissed || hasNew;
}
