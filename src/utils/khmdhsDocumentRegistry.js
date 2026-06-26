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
import { getSymvPlanCustomLabel, overlaySymvPlanLabelsOnChainHistory, SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

export const KHMDHS_REGISTRY_STAGE_ORDER = ['REQ', 'COMMIT', 'PROC', 'AWRD', 'SYMV', 'APE', 'PAY', 'RELATED'];

export const KHMDHS_REGISTRY_STAGE_META = {
  REQ: { label: 'Αίτημα', shortLabel: 'Αίτημα', color: '#4f46e5', bg: '#eef2ff' },
  COMMIT: { label: 'Ανάληψη υποχρέωσης', shortLabel: 'Ανάληψη', color: '#7c3aed', bg: '#f5f3ff' },
  PROC: { label: 'Δημοσίευση', shortLabel: 'Δημοσίευση', color: '#2563eb', bg: '#eff6ff' },
  AWRD: { label: 'Κατακύρωση', shortLabel: 'Κατακύρωση', color: '#d97706', bg: '#fffbeb' },
  SYMV: { label: 'Σύμβαση', shortLabel: 'Σύμβαση', color: '#059669', bg: '#ecfdf5' },
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
}) {
  const normalized = normalizeAdam(adam || snapshot?.referenceNumber);
  if (!normalized) return null;
  if (isCancelled(snapshot)) return null;

  const resolvedType = type || adamTypeCode(normalized);
  const resolvedStage = stage || stageFromType(resolvedType);
  const meta = KHMDHS_REGISTRY_STAGE_META[resolvedStage] || KHMDHS_REGISTRY_STAGE_META.SYMV;

  return {
    id: uuidv4(),
    adam: normalized,
    type: resolvedType,
    stage: resolvedStage,
    stageLabel: meta.label,
    title: String(title || snapshot?.title || '').trim(),
    subtitle: String(subtitle || '').trim(),
    amount: String(amount || '').trim(),
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
  if (!block?.snapshot && !block?.adam) return null;
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
  if (!block?.snapshot && !block?.adam) return null;
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
  if (!block?.snapshot && !block?.adam) return null;
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
  if (!block?.snapshot && !block?.adam) return null;
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

function entryFromPayment(block) {
  if (!block?.adam) return null;
  // Αποτυχημένη ανάκτηση: δημιουργούμε stub ώστε το ένταλμα να εμφανίζεται στο registry
  if (block.error && !block.snapshot) {
    return buildRegistryEntry({
      adam: block.adam,
      snapshot: null,
      stage: 'PAY',
      type: 'PAY',
      isStub: true,
    });
  }
  const snap = block.snapshot;
  return buildRegistryEntry({
    adam: block.adam || snap?.referenceNumber,
    snapshot: snap,
    stage: 'PAY',
    type: 'PAY',
    title: snap?.title || '',
    subtitle: snap?.organization || '',
    amount: snap ? (formatKhmdhsCostSnapshotGross(snap) || '') : '',
    date: snap?.signedDate ? formatKhmdhsDateOnly(snap.signedDate) : '',
    fetchedAt: block.fetchedAt,
  });
}

function addLinkedAdamStubs(chainRes, map) {
  const linked = chainRes?.chainMeta?.linkedAdams || {};
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
export function collectKhmdhsRegistryCandidatesFromChainRes(chainRes) {
  if (!chainRes?.success) return [];
  const map = new Map();
  // Χρησιμοποιούμε το fetchedAt της αλυσίδας αν υπάρχει — πιο ακριβής χρόνος
  const chainFetchedAt = chainRes.fetchedAt || chainRes.contract?.fetchedAt || new Date().toISOString();

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

  (chainRes.contractChainHistory || []).forEach((h) => {
    if (!h?.adam || h.cancelled) return;
    const kind = h.kind;
    if (!h.isRoot && kind === 'uncertain' && !h.suggestedKind) return;
    const rawLabel = h.label || (kind && kind !== 'uncertain' ? (CHAIN_KIND_LABEL[kind] || '') : '');
    const roleLabel = rawLabel.replace(/\s*\(επιλεγμένη\)/i, '').trim();
    if (!roleLabel && !h.isRoot) return;
    pushUnique(map, entryFromContract({
      adam: h.adam,
      snapshot: h.snapshot,
      title: h.title,
      amount: h.contractAmount,
      date: h.contractDate,
      roleLabel,
    }));
  });

  // Τροποποιήσεις/παρατάσεις κ.λπ. — συμπληρώνονται και από project μετά χαρακτηρισμό

  (chainRes.payments || []).forEach((p) => {
    pushUnique(map, entryFromPayment(p));
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
export function shouldIncludeChainHistoryInRegistry(h, review) {
  if (!h?.adam || h.cancelled) return false;
  if (h.isRoot) return true;
  // Ρητός χαρακτηρισμός από τον χρήστη
  if (!!getChainKindChoice(review, h.adam)?.kind) return true;
  // Αυτόματα ανιχνευμένο kind (effectiveKind από εμπλουτισμένη εγγραφή ή h.kind)
  const kind = h.effectiveKind || h.kind;
  return !!kind && kind !== 'uncertain';
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
      if (!shouldIncludeChainHistoryInRegistry(h, review)) return;
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
        title: h.title,
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
      if (!shouldIncludeChainHistoryInRegistry(h, review)) return;
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
        title: h.title,
        amount,
        date,
        roleLabel: effectiveLabel,
        cancelled: h.cancelled,
      }));
    });
  }

  getKhmdhsPaymentEntries(project).forEach((p) => {
    pushUnique(map, entryFromPayment(p));
  });

  return annotateRegistryLinkLabels([...map.values()]);
}

function noticeLinkLabel(noticeType, index, total) {
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

/** Ετικέτα εγγράφου δημοσίευσης για UI (προκήρυξη, πρόσκληση κ.λπ.) */
export function publicationDocumentLabel(noticeType, index = 1, total = 1) {
  return noticeLinkLabel(noticeType, index, total);
}

function resolveChainHistoryRoleLabel(h, review, project) {
  const adam = normalizeAdam(h?.adam);
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
  const counters = {};
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
      case 'PROC':
        linkLabel = entry.isStub ? `Δημοσίευση${suffix}` : noticeLinkLabel(entry.noticeType, idx, total);
        break;
      case 'AWRD':
        linkLabel = total > 1 ? `Απόφαση ανάθεσης${suffix}` : 'Απόφαση ανάθεσης';
        break;
      case 'SYMV':
        linkLabel = contractLinkLabel(entry.roleLabel, idx, total);
        break;
      case 'PAY':
        linkLabel = `Ένταλμα πληρωμής${suffix}`;
        break;
      case 'RELATED':
        linkLabel = entry.linkLabel || entry.title || `Σχετικό έγγραφο${suffix}`;
        break;
      default:
        linkLabel = entry.stageLabel || 'Έγγραφο';
    }
    return { ...entry, linkLabel: enrichRegistryLinkLabel(linkLabel, entry) };
  });
}

export function sortRegistryEntries(entries) {
  return [...(entries || [])].sort((a, b) => {
    const sa = KHMDHS_REGISTRY_STAGE_ORDER.indexOf(a.stage);
    const sb = KHMDHS_REGISTRY_STAGE_ORDER.indexOf(b.stage);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return String(a.adam).localeCompare(String(b.adam), 'el');
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
      byAdam.set(key, prev ? { ...prev, ...e, title: e.title || prev.title } : e);
    });
  });
  return annotateRegistryLinkLabels([...byAdam.values()]);
}

export function buildRegistryModalPayloadAfterReview(project, chainFetchedAt = '', chainRes = null) {
  const fromChain = chainRes?.success
    ? collectKhmdhsRegistryCandidatesFromChainRes(chainRes)
    : [];
  const fromProject = collectKhmdhsRegistryCandidatesFromProject(project);
  const candidates = fromChain.length
    ? mergeRegistryCandidateLists(fromChain, fromProject)
    : fromProject;
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
