/** ΚΗΜΔΗΣ — σύμβαση (SYMV) & τροποποιήσεις αλυσίδας */

import { formatDateEl } from './dateFormat';
import { formatKhmdhsDateOnly, formatKhmdhsEuro } from './khmdhsNoticeFields';
import { plainContractAmountSource } from './khmdhsStageLabels';
import { normalizeAmountForCompare } from './projectFormPhases';
import { isAdamSkippedInSymvPlan } from './khmdhsSymvChainPlanner';
import {
  grossFromContractRecord,
  grossFromContractBudget,
} from './khmdhsVatHelper';

function formatStoredContractAmount(storedAmount) {
  const s = String(storedAmount || '').trim();
  if (!s) return '';
  return s.includes('€') ? s : `${s} € (με ΦΠΑ)`;
}

function storedAmountDiffersFromSnapshotGross(storedAmount, snapshotGross) {
  const stored = String(storedAmount || '').trim();
  if (!stored || snapshotGross == null) return !!stored;
  const a = normalizeAmountForCompare(stored);
  const b = normalizeAmountForCompare(String(snapshotGross));
  if (a != null && b != null) return a !== b;
  return stored !== String(snapshotGross);
}

export function pickKhmdhsContractSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const has = snapshot.anadoxosName || snapshot.referenceNumber || snapshot.contractSignedDate
    || snapshot.contractBudget != null || snapshot.resolvedContractAmount != null || snapshot.assigningAuthority;
  if (!has) return null;
  return snapshot;
}

export function buildKhmdhsContractDisplayGroups(snapshot, { storedAmount = '', symvChainPlan = null } = {}) {
  const snap = pickKhmdhsContractSnapshot(snapshot);
  if (!snap) return [];

  const mkRows = (entries) => entries.filter((r) => r && r.value);
  const stored = String(storedAmount || '').trim();

  const identity = mkRows([
    { label: 'Τίτλος σύμβασης', value: snap.title, fullWidth: true },
    { label: 'ΑΔΑΜ', value: snap.referenceNumber, badge: true },
    { label: 'ΑΔΑΜ δημοσίευσης', value: snap.noticeReferenceNumber },
    { label: 'ΑΔΑΜ ανάθεσης', value: snap.auctionRefNo },
  ]);

  const contractor = mkRows([
    { label: 'Ανάδοχος', value: snap.anadoxosName, fullWidth: true },
    { label: 'ΑΦΜ ανάδοχου', value: snap.anadoxosVat, badge: true },
    { label: 'Αναθέτουσα αρχή', value: snap.assigningAuthority, fullWidth: true },
  ]);

  const dates = mkRows([
    { label: 'Ημ. υπογραφής', value: formatKhmdhsDateOnly(snap.contractSignedDate), highlight: true },
    { label: 'Ημ. έναρξης', value: formatKhmdhsDateOnly(snap.startDate) },
    { label: 'Ημ. λήξης', value: snap.noEndDate ? 'Χωρίς ημερομηνία λήξης' : formatKhmdhsDateOnly(snap.endDate) },
    { label: 'Ημ. καταχώρισης ΚΗΜΔΗΣ', value: formatKhmdhsDateOnly(snap.submissionDate) },
    { label: 'Τελευταία ενημέρωση', value: formatKhmdhsDateOnly(snap.lastUpdateDate) },
    ...(snap.cancelled ? [
      { label: 'Κατάσταση', value: 'Ματαιωμένη', highlight: true },
      { label: 'Ημ. ματαίωσης', value: formatKhmdhsDateOnly(snap.cancellationDate) },
      { label: 'Λόγος ματαίωσης', value: snap.cancellationReason, fullWidth: true },
    ] : []),
  ]);

  const financial = mkRows([
    ...(function buildAmountRows() {
      if (snap.contractBudgetSuppressed) {
        if (stored) {
          return [{
            label: 'Ποσό σύμβασης (καταχωρημένο στο υποέργο)',
            value: formatStoredContractAmount(stored),
            highlight: true,
          }];
        }
        return [{ label: 'Ποσό σύμβασης', value: '⚠ Συμπληρώστε χειροκίνητα από το υπογεγραμμένο συμφωνητικό (PDF)', highlight: false, fullWidth: true }];
      }
      const gross = grossFromContractRecord(snap) ?? grossFromContractBudget(snap.contractBudget);
      const formatted = gross != null
        ? `${gross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (με ΦΠΑ)`
        : '';
      const sourceNote = plainContractAmountSource(snap.contractAmountSource);
      const khmdhsLabel = sourceNote
        ? `Ποσό σύμβασης (${sourceNote})`
        : 'Ποσό σύμβασης (με ΦΠΑ)';

      if (stored && storedAmountDiffersFromSnapshotGross(stored, gross)) {
        return [
          {
            label: 'Ποσό σύμβασης (καταχωρημένο στο υποέργο)',
            value: formatStoredContractAmount(stored),
            highlight: true,
          },
          ...(formatted
            ? [{ label: `Ποσό από ΚΗΜΔΗΣ${sourceNote ? ` (${sourceNote})` : ''}`, value: formatted, highlight: false }]
            : []),
        ];
      }
      if (!formatted && stored) {
        return [{
          label: 'Ποσό σύμβασης (καταχωρημένο στο υποέργο)',
          value: formatStoredContractAmount(stored),
          highlight: true,
        }];
      }
      if (!formatted) return [];
      return [{ label: khmdhsLabel, value: formatted, highlight: true }];
    })(),
    ...(!snap.contractBudgetSuppressed && snap.contractBudget != null
      ? [{ label: 'Ποσό καταχώρισης σύμβασης (χωρίς ΦΠΑ)', value: formatKhmdhsEuro(snap.contractBudget) }]
      : []),
    ...(snap.contractDuration != null && snap.contractDuration !== '' ? [{
      label: 'Διάρκεια σύμβασης',
      value: `${snap.contractDuration}${snap.contractDurationUnit ? ` ${snap.contractDurationUnit}` : ''}`,
    }] : []),
  ]);

  const nextRef = String(snap.nextRefNo || '').trim();
  const nextRefSkipped = nextRef && isAdamSkippedInSymvPlan(symvChainPlan, nextRef);

  const links = mkRows([
    { label: 'Προηγ. ΑΔΑΜ', value: snap.prevReferenceNo },
    ...(!nextRefSkipped && nextRef ? [{ label: 'Επόμ. ΑΔΑΜ αλυσίδας', value: snap.nextRefNo }] : []),
    ...(!nextRefSkipped && snap.nextExtended ? [{ label: 'Επόμενη πράξη', value: 'Παράταση', highlight: true }] : []),
    ...(!nextRefSkipped && snap.nextModified ? [{ label: 'Επόμενη πράξη', value: 'Συμπληρωματική σύμβαση', highlight: true }] : []),
  ]);

  return [
    identity.length && { id: 'identity', title: 'Ταυτότητα', icon: '📄', rows: identity },
    contractor.length && { id: 'contractor', title: 'Ανάδοχος & αρχή', icon: '🤝', rows: contractor },
    dates.length && { id: 'dates', title: 'Ημερομηνίες', icon: '📅', rows: dates },
    financial.length && { id: 'financial', title: 'Οικονομικά', icon: '💰', rows: financial },
    links.length && { id: 'links', title: 'Σύνδεση αλυσίδας', icon: '🔗', rows: links },
  ].filter(Boolean);
}

export function buildKhmdhsAmendmentsDisplayGroup(amendments) {
  const list = Array.isArray(amendments) ? amendments.filter((a) => a?.adam) : [];
  if (!list.length) return null;

  const rows = list.map((a, i) => {
    const parts = [a.adam];
    if (a.contractAmount) parts.push(`${a.contractAmount} €`);
    if (a.contractDate) parts.push(formatDateEl(a.contractDate, ''));
    if (a.endDate) parts.push(`λήξη ${formatDateEl(a.endDate, '')}`);
    return {
      label: a.label || a.kind || `Πράξη ${i + 1}`,
      value: parts.filter(Boolean).join(' · '),
      highlight: !!a.isSeed,
      fullWidth: true,
    };
  });

  return {
    id: 'amendments',
    title: 'Τροποποιήσεις / παρατάσεις',
    icon: '🔄',
    rows,
  };
}

/** Πλήρες ιστορικό αλυσίδας σύμβασης — χρονολογική σειρά με σωστή χαρακτήριση */
export function buildKhmdhsContractChainHistoryGroup(chainHistory) {
  const list = Array.isArray(chainHistory) ? chainHistory.filter((h) => h?.adam) : [];
  const hasTimeline = list.length > 1
    || list.some((h) => !h.isRoot)
    || list.some((h) => {
      const k = String(h.effectiveKind || h.kind || '').toLowerCase();
      return k === 'other' || k === 'extension' || k === 'modification';
    });
  if (!hasTimeline) return null;

  const rows = list.map((h) => {
    const parts = [h.adam];
    if (h.contractAmount) parts.push(`${h.contractAmount} €`);
    else if (h.isRoot && h.contractAmountSource) {
      parts.push(`(${plainContractAmountSource(h.contractAmountSource)})`);
    }
    if (h.contractDate) parts.push(formatDateEl(h.contractDate, ''));
    if (h.endDate) parts.push(`λήξη ${formatDateEl(h.endDate, '')}`);
    return {
      label: h.label || h.kind || `Πράξη ${(h.order ?? 0) + 1}`,
      value: [
        parts.filter(Boolean).join(' · '),
        h.kindNote ? `ℹ ${h.kindNote}` : '',
      ].filter(Boolean).join('\n'),
      highlight: !!h.isSeed,
      fullWidth: true,
    };
  });

  const title = list.length > 1
    ? `Ιστορικό αλυσίδας σύμβασης (${list.length} πράξεις)`
    : 'Ιστορικό αλυσίδας σύμβασης';

  return {
    id: 'chainHistory',
    title,
    icon: '📜',
    rows,
  };
}

export function buildKhmdhsContractCardSummary(snapshot, { storedAmount = '' } = {}) {
  const snap = pickKhmdhsContractSnapshot(snapshot);
  if (!snap) return null;
  const stored = String(storedAmount || '').trim();
  const gross = snap.contractBudgetSuppressed
    ? null
    : (grossFromContractRecord(snap) ?? grossFromContractBudget(snap.contractBudget));
  const khmdhsAmount = gross != null
    ? `${gross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '';
  const amount = (stored && storedAmountDiffersFromSnapshotGross(stored, gross))
    ? formatStoredContractAmount(stored).replace(/\s*\(με ΦΠΑ\)\s*$/i, '')
    : (khmdhsAmount || (stored ? formatStoredContractAmount(stored).replace(/\s*\(με ΦΠΑ\)\s*$/i, '') : ''));
  return {
    adam: snap.referenceNumber || '',
    title: snap.title || '',
    contractor: snap.anadoxosName || '',
    amount,
    signedDate: formatKhmdhsDateOnly(snap.contractSignedDate),
    cancelled: !!snap.cancelled,
    amountSuppressed: !!snap.contractBudgetSuppressed,
  };
}
