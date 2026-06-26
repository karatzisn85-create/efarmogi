/** ΚΗΜΔΗΣ — πρωτογενές / εγκεκριμένο αίτημα (REQ) */

import {
  formatKhmdhsDateOnly,
  formatKhmdhsDateTime,
  formatKhmdhsEuro,
} from './khmdhsNoticeFields';
import { formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';

export function pickKhmdhsRequestSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const title = snapshot.title != null ? String(snapshot.title).trim() : '';
  const ref = snapshot.referenceNumber != null ? String(snapshot.referenceNumber).trim() : '';
  if (!title && !ref && snapshot.totalCostWithoutVAT == null && snapshot.totalCostWithVAT == null) {
    return null;
  }
  return snapshot;
}

export function projectHasKhmdhsRequestData(project) {
  const adam = String(project?.khmdhsRequestAdam || '').trim();
  const snap = pickKhmdhsRequestSnapshot(project?.khmdhsRequestSnapshot);
  return !!(adam || snap);
}

export function buildKhmdhsRequestCardSummary(snapshot) {
  const snap = pickKhmdhsRequestSnapshot(snapshot);
  if (!snap) return null;
  const statusParts = [];
  if (snap.isInitial) statusParts.push('Πρωτογενές');
  if (snap.isApproved) statusParts.push('Εγκεκριμένο');
  return {
    adam: snap.referenceNumber || '',
    title: snap.title || '',
    amount: formatKhmdhsCostSnapshotGross(snap) || formatKhmdhsEuro(snap.totalCostWithVAT),
    contractType: snap.contractType || '',
    status: statusParts.join(' · '),
    cancelled: !!snap.cancelled,
  };
}

export function buildKhmdhsRequestDisplayGroups(snapshot) {
  const snap = pickKhmdhsRequestSnapshot(snapshot);
  if (!snap) return [];

  const mkRows = (entries) => entries.filter((r) => r && r.value);

  const statusParts = [];
  if (snap.isInitial) statusParts.push('Πρωτογενές αίτημα');
  if (snap.isApproved) statusParts.push('Εγκεκριμένο αίτημα');
  const statusText = statusParts.join(' · ');

  const identity = mkRows([
    { label: 'Τίτλος αιτήματος', value: snap.title, fullWidth: true },
    { label: 'ΑΔΑΜ', value: snap.referenceNumber, badge: true },
    { label: 'Είδος', value: snap.contractType },
    { label: 'Κατάσταση αιτήματος', value: statusText, highlight: !!statusText },
  ]);

  const authority = mkRows([
    { label: 'Αναθέτουσα αρχή', value: snap.organization, fullWidth: true },
  ]);

  const dates = mkRows([
    { label: 'Ημ. έκδοσης / πρωτοκόλλου', value: formatKhmdhsDateOnly(snap.signedDate) },
    { label: 'Ημ. καταχώρισης ΚΗΜΔΗΣ', value: formatKhmdhsDateTime(snap.submissionDate) },
    { label: 'Τελευταία ενημέρωση', value: formatKhmdhsDateTime(snap.lastUpdateDate) },
    ...(snap.cancelled ? [
      { label: 'Κατάσταση', value: 'Ματαιωμένο', highlight: true },
      { label: 'Ημ. ματαίωσης', value: formatKhmdhsDateTime(snap.cancellationDate) },
    ] : []),
  ]);

  const budget = mkRows([
    { label: 'Προϋπολογισμός (με ΦΠΑ)', value: formatKhmdhsCostSnapshotGross(snap), highlight: true },
    { label: 'Προϋπολογισμός (χωρίς ΦΠΑ)', value: formatKhmdhsEuro(snap.totalCostWithoutVAT) },
    { label: 'Χρηματοδότηση', value: snap.fundingSummary, fullWidth: true },
  ]);

  const classify = mkRows([
    ...(Array.isArray(snap.cpvs) && snap.cpvs.length
      ? [{ label: 'CPV', value: snap.cpvs.join(', '), fullWidth: true }]
      : []),
  ]);

  return [
    identity.length && { id: 'identity', title: 'Ταυτότητα', icon: '📋', rows: identity },
    authority.length && { id: 'authority', title: 'Αναθέτουσα αρχή', icon: '🏛️', rows: authority },
    dates.length && { id: 'dates', title: 'Ημερομηνίες', icon: '📅', rows: dates },
    budget.length && { id: 'budget', title: 'Προϋπολογισμός', icon: '💰', rows: budget },
    classify.length && { id: 'classify', title: 'Κατάταξη', icon: '🏷️', rows: classify },
  ].filter(Boolean);
}
