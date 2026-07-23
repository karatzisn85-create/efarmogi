/** ΚΗΜΔΗΣ — ανάθεση (AWRD) */

import { formatKhmdhsDateOnly, formatKhmdhsDateTime, formatKhmdhsDurationLabel, formatKhmdhsEuro } from './khmdhsNoticeFields';
import { formatKhmdhsCostSnapshotGross, applyKhmdhsVat24 } from './khmdhsVatHelper';

export function pickKhmdhsAwardSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (!snapshot.title && !snapshot.referenceNumber) return null;
  return snapshot;
}

export function projectHasKhmdhsAwardData(project) {
  const adam = String(project?.khmdhsAwardAdam || '').trim();
  const snap = pickKhmdhsAwardSnapshot(project?.khmdhsAwardSnapshot);
  return !!(adam || snap);
}

function formatAwardAmount(snap) {
  return formatKhmdhsCostSnapshotGross(snap);
}

function formatContractors(snap) {
  const list = Array.isArray(snap.contractors) ? snap.contractors : [];
  if (list.length) {
    return list
      .map((c) => [c.name, c.vat ? `(ΑΦΜ ${c.vat})` : ''].filter(Boolean).join(' '))
      .join(' · ');
  }
  if (snap.anadoxosName) {
    return [snap.anadoxosName, snap.anadoxosVat ? `(ΑΦΜ ${snap.anadoxosVat})` : ''].filter(Boolean).join(' ');
  }
  return '';
}

function joinRefs(values) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return list.length ? list.join(', ') : '';
}

export function isLegacyKhmdhsAwardSnapshot(snapshot) {
  const snap = pickKhmdhsAwardSnapshot(snapshot);
  if (!snap) return false;
  return !(
    snap.organization
    || snap.anadoxosName
    || (Array.isArray(snap.contractors) && snap.contractors.length)
    || snap.procedureType
    || snap.totalCostWithoutVAT != null
    || snap.auctionAmount != null
  );
}

export function buildKhmdhsAwardCardSummary(snapshot) {
  const snap = pickKhmdhsAwardSnapshot(snapshot);
  if (!snap) return null;
  return {
    adam: snap.referenceNumber || '',
    title: snap.title || '',
    contractor: formatContractors(snap),
    amount: formatAwardAmount(snap),
    awardDate: formatKhmdhsDateOnly(snap.awardDate || snap.signedDate),
    cancelled: !!snap.cancelled,
  };
}

export function buildKhmdhsAwardDisplayGroups(snapshot) {
  const snap = pickKhmdhsAwardSnapshot(snapshot);
  if (!snap) return [];

  const mkRows = (entries) => entries.filter((r) => r && r.value);

  const identity = mkRows([
    { label: 'Τίτλος ανάθεσης', value: snap.title, fullWidth: true },
    { label: 'ΑΔΑΜ', value: snap.referenceNumber, badge: true },
    { label: 'Αριθμός πρωτοκόλλου', value: snap.protocolNumber },
    ...(snap.numberOfSections != null ? [{
      label: 'Αριθμός τμημάτων',
      value: String(snap.numberOfSections),
    }] : []),
    ...(snap.amendPreviousAuction || snap.amendedAuctionADAM ? [{
      label: 'Τροποποίηση προηγ. ανάθεσης',
      value: snap.amendedAuctionADAM || 'Ναι',
      highlight: true,
    }] : []),
  ]);

  const authority = mkRows([
    { label: 'Αναθέτουσα αρχή / Φορέας', value: snap.organization, fullWidth: true },
    { label: 'ΑΦΜ φορέα', value: snap.organizationVatNumber, badge: true },
    { label: 'Οργανική μονάδα', value: snap.unitsOperator, fullWidth: true },
    { label: 'Αποφαινόμενο όργανο', value: snap.signer, fullWidth: true },
  ]);

  const contractorRows = [];
  const contractors = Array.isArray(snap.contractors) ? snap.contractors : [];
  if (contractors.length) {
    contractors.forEach((c, i) => {
      contractorRows.push({
        label: contractors.length > 1 ? `Ανάδοχος ${i + 1}` : 'Ανάδοχος',
        value: [c.name, c.vat ? `ΑΦΜ ${c.vat}` : '', c.country].filter(Boolean).join(' · '),
        fullWidth: true,
        highlight: i === 0,
      });
    });
  } else {
    const single = mkRows([
      { label: 'Ανάδοχος', value: snap.anadoxosName, fullWidth: true, highlight: true },
      { label: 'ΑΦΜ ανάδοχου', value: snap.anadoxosVat, badge: true },
    ]);
    contractorRows.push(...single);
  }

  const dates = mkRows([
    { label: 'Ημ. ανάθεσης / πρωτοκόλλου', value: formatKhmdhsDateOnly(snap.awardDate || snap.signedDate), highlight: true },
    { label: 'Ημ. καταχώρισης ΚΗΜΔΗΣ', value: formatKhmdhsDateTime(snap.submissionDate) },
    { label: 'Τελευταία ενημέρωση', value: formatKhmdhsDateTime(snap.lastUpdateDate) },
    ...(snap.cancelled ? [
      { label: 'Κατάσταση', value: 'Ματαιωμένη', highlight: true },
      { label: 'Τύπος ματαίωσης', value: snap.cancellationType },
      { label: 'Ημ. ματαίωσης', value: formatKhmdhsDateTime(snap.cancellationDate) },
      { label: 'Λόγος ματαίωσης', value: snap.cancellationReason, fullWidth: true },
      { label: 'ΑΔΑ ματαίωσης', value: snap.cancellationADA },
    ] : []),
  ]);

  const financial = mkRows([
    { label: 'Αξία (με ΦΠΑ)', value: formatKhmdhsCostSnapshotGross(snap), highlight: true },
    { label: 'Αξία (χωρίς ΦΠΑ)', value: formatKhmdhsEuro(snap.totalCostWithoutVAT) },
    { label: 'Εκτιμ. αξία (auctionAmount, με ΦΠΑ)', value: formatKhmdhsEuro(applyKhmdhsVat24(snap.auctionAmount)) },
    { label: 'Προϋπολογισμός (budget, με ΦΠΑ)', value: formatKhmdhsEuro(applyKhmdhsVat24(snap.budget)) },
    { label: 'ΑΔΑ ανάληψης υποχρέωσης', value: snap.commitmentNo, badge: true },
    ...(snap.contractDuration ? [{
      label: 'Διάρκεια σύμβασης',
      value: formatKhmdhsDurationLabel(snap.contractDuration, snap.contractDurationUnit),
    }] : []),
  ]);

  const classify = mkRows([
    { label: 'Διαδικασία ανάθεσης', value: snap.procedureType, highlight: true },
    { label: 'Χαρακτήρας σύμβασης', value: snap.contractType },
    { label: 'Κριτήριο ανάθεσης', value: snap.criteriaCode },
    { label: 'Νομικό πλαίσιο', value: snap.legalContext },
    { label: 'Αιτιολόγηση διαδικασίας', value: snap.awardProcedure, fullWidth: true },
    ...(Array.isArray(snap.cpvs) && snap.cpvs.length
      ? [{ label: 'CPV', value: snap.cpvs.join(', '), fullWidth: true }]
      : []),
  ]);

  const noticeRefs = joinRefs(snap.noticeRefNos) || snap.noticeReferenceNumber;
  const links = mkRows([
    { label: 'ΑΔΑΜ δημοσίευσης', value: noticeRefs },
    { label: 'ΑΔΑΜ εγκεκριμένου αιτήματος', value: joinRefs(snap.approvedRequestAdams) },
    { label: 'Συνδεδεμένες συμβάσεις (ΑΔΑΜ)', value: joinRefs(snap.contractRefNos), fullWidth: true },
    { label: 'Τροποποιούμενες αναθέσεις', value: joinRefs(snap.amendsAuctionRefNos), fullWidth: true },
  ]);

  return [
    identity.length && { id: 'identity', title: 'Ταυτότητα', icon: '🏆', rows: identity },
    authority.length && { id: 'authority', title: 'Αναθέτουσα αρχή', icon: '🏛️', rows: authority },
    contractorRows.length && { id: 'contractor', title: 'Ανάδοχος', icon: '🤝', rows: contractorRows },
    dates.length && { id: 'dates', title: 'Ημερομηνίες', icon: '📅', rows: dates },
    financial.length && { id: 'financial', title: 'Οικονομικά', icon: '💰', rows: financial },
    classify.length && { id: 'classify', title: 'Διαδικασία & κατάταξη', icon: '🏷️', rows: classify },
    links.length && { id: 'links', title: 'Σύνδεση αλυσίδας', icon: '🔗', rows: links },
  ].filter(Boolean);
}
