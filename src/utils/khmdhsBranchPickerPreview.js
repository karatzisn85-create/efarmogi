import { buildKhmdhsAwardCardSummary, buildKhmdhsAwardDisplayGroups } from './khmdhsAwardFields';
import {
  buildKhmdhsContractCardSummary,
  buildKhmdhsContractDisplayGroups,
} from './khmdhsContractDisplayFields';
import {
  buildKhmdhsNoticeCardSummary,
  buildKhmdhsNoticeDisplayGroups,
} from './khmdhsNoticeFields';
import { buildKhmdhsRequestCardSummary, buildKhmdhsRequestDisplayGroups } from './khmdhsRequestFields';

function normalizeAdam(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
}

function resolveContractSnapshotForPreview(chainRes, adam) {
  const norm = normalizeAdam(adam);
  if (!norm) return null;
  if (normalizeAdam(chainRes?.contract?.adam) === norm) {
    return chainRes.contract.snapshot;
  }
  const fromMeta = chainRes?.chainMeta?.contractSnapshotsByAdam?.[norm];
  if (fromMeta) return fromMeta;
  return null;
}

/** Για προεπισκόπηση κλάδου: εμφάνιση ποσού ανά σύμβαση, όχι suppression παράλληλης υπόθεσης */
function previewContractSnapshot(snap) {
  if (!snap) return null;
  if (snap.contractBudgetSuppressed && snap.contractBudget != null) {
    return { ...snap, contractBudgetSuppressed: false };
  }
  return snap;
}

export function buildBranchCandidatePreview(candidate, chainRes) {
  if (!chainRes?.success) {
    return { error: chainRes?.error || 'Δεν ήταν δυνατή η προεπισκόπηση.' };
  }

  const adam = normalizeAdam(candidate?.adam);
  const type = String(candidate?.type || '').toUpperCase();

  if (type === 'SYMV') {
    const rawSnap = resolveContractSnapshotForPreview(chainRes, adam);
    if (!rawSnap) return { error: 'Δεν βρέθηκαν στοιχεία σύμβασης.' };
    const snap = previewContractSnapshot(rawSnap);
    return {
      kind: 'contract',
      summary: buildKhmdhsContractCardSummary(snap),
      groups: buildKhmdhsContractDisplayGroups(snap),
      panelTheme: 'contract',
      panelTitle: 'Στοιχεία σύμβασης',
    };
  }

  if (type === 'PROC') {
    const snap = chainRes.notice?.adam === adam ? chainRes.notice.snapshot : null;
    if (!snap) return { error: 'Δεν βρέθηκαν στοιχεία δημοσίευσης.' };
    return {
      kind: 'notice',
      summary: buildKhmdhsNoticeCardSummary(snap),
      groups: buildKhmdhsNoticeDisplayGroups(snap),
      panelTheme: 'request',
      panelTitle: 'Στοιχεία δημοσίευσης',
    };
  }

  if (type === 'AWRD') {
    const snap = chainRes.auction?.adam === adam ? chainRes.auction.snapshot : null;
    if (!snap) return { error: 'Δεν βρέθηκαν στοιχεία ανάθεσης.' };
    return {
      kind: 'award',
      summary: buildKhmdhsAwardCardSummary(snap),
      groups: buildKhmdhsAwardDisplayGroups(snap),
      panelTheme: 'award',
      panelTitle: 'Στοιχεία ανάθεσης',
    };
  }

  if (type === 'REQ' || type === 'APPROVED_REQ') {
    const reqSnap = chainRes.request?.adam === adam ? chainRes.request.snapshot : null;
    const commitSnap = chainRes.commitmentDecision?.adam === adam
      ? chainRes.commitmentDecision.snapshot
      : null;
    const snap = reqSnap || commitSnap;
    if (!snap) return { error: 'Δεν βρέθηκαν στοιχεία αιτήματος.' };
    return {
      kind: 'request',
      summary: buildKhmdhsRequestCardSummary(snap),
      groups: buildKhmdhsRequestDisplayGroups(snap),
      panelTheme: 'request',
      panelTitle: type === 'APPROVED_REQ' ? 'Απόφαση δέσμευσης' : 'Πρωτογενές αίτημα',
    };
  }

  return { error: 'Άγνωστος τύπος κλάδου.' };
}

export function formatBranchPreviewSummaryLine(preview) {
  if (!preview?.summary) return '';
  const s = preview.summary;
  const parts = [];
  if (s.contractor) parts.push(s.contractor);
  if (s.amount) parts.push(s.amount);
  else if (s.budget) parts.push(s.budget);
  if (s.signedDate) parts.push(`υπογραφή ${s.signedDate}`);
  else if (s.awardDate) parts.push(`ανάθεση ${s.awardDate}`);
  else if (s.submissionDate) parts.push(s.submissionDate);
  return parts.join(' · ');
}
