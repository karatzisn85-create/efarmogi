/** Επιλέξιμα πεδία εξαγωγής από snapshot προκήρυξης / πρόσκλησης (ΚΗΜΔΗΣ PROC) */

import { getTotalContractAmount } from './khmdhsFields';
import { daysUntilDate, projectProcurementPhaseConcluded } from './procurementDeadlines';
import { grossFromCostSnapshot, formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';
import {
  formatKhmdhsDateOnly,
  formatKhmdhsDateTime,
  formatKhmdhsEuro,
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData,
  resolveKhmdhsNoticeAssignmentProcedure
} from './khmdhsNoticeFields';

/** ΦΠΑ για σύγκριση εκτιμ. ΚΗΜΔΗΣ vs ποσό σύμβασης */
export const KHMDHS_VARIANCE_VAT_RATE = 0.24;

export const KHMDHS_NOTICE_EXPORT_FIELDS = [
  { id: 'khmdhsNoticeAdam', label: 'ΑΔΑΜ Προκήρυξης / Πρόσκλησης (ΚΗΜΔΗΣ)', width: 24 },
  { id: 'khmdhsNoticeTitle', label: 'Τίτλος Δημοσίευσης (ΚΗΜΔΗΣ)', width: 45 },
  { id: 'khmdhsNoticeType', label: 'Τύπος Δημοσίευσης (ΚΗΜΔΗΣ)', width: 28 },
  { id: 'khmdhsNoticeContractType', label: 'Είδος Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'khmdhsNoticeProcedureKhmdhs', label: 'Διαδικασία — ΚΗΜΔΗΣ', width: 35 },
  { id: 'khmdhsNoticeProcedureApp', label: 'Διαδικασία — ΕΦΑΡΜΟΓΗ', width: 35 },
  { id: 'khmdhsNoticeLegalContext', label: 'Νομικό Πλαίσιο (ΚΗΜΔΗΣ)', width: 30 },
  { id: 'khmdhsNoticeConductingProceedings', label: 'Τρόπος Διεξαγωγής (ΚΗΜΔΗΣ)', width: 28 },
  { id: 'khmdhsNoticeDigitalPlatform', label: 'Πλατφόρμα (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'khmdhsNoticeCriteriaCode', label: 'Κριτήριο Ανάθεσης (ΚΗΜΔΗΣ)', width: 28 },
  { id: 'khmdhsNoticeOrganization', label: 'Αναθέτουσα Αρχή (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'khmdhsNoticeUnitsOperator', label: 'Οργανική Μονάδα (ΚΗΜΔΗΣ)', width: 30 },
  { id: 'khmdhsNoticeSigner', label: 'Αποφαινόμενο Όργανο (ΚΗΜΔΗΣ)', width: 30 },
  { id: 'khmdhsNoticeSignedDate', label: 'Ημ. Έκδοσης / Πρωτοκόλλου (ΚΗΜΔΗΣ)', width: 26 },
  { id: 'khmdhsNoticeFinalSubmissionDate', label: 'Καταληκτική Υποβολής Προσφορών (ΚΗΜΔΗΣ)', width: 32 },
  { id: 'khmdhsNoticeSubmissionDate', label: 'Ημ. Καταχώρισης ΚΗΜΔΗΣ', width: 26 },
  { id: 'khmdhsNoticeDeadlineDaysLeft', label: 'Ημέρες έως Καταληκτική (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'khmdhsNoticeCancelled', label: 'Ματαιωμένη Δημοσίευση (ΚΗΜΔΗΣ)', width: 18 },
  { id: 'khmdhsNoticeCancellationDate', label: 'Ημ. Ματαίωσης (ΚΗΜΔΗΣ)', width: 24 },
  { id: 'khmdhsNoticeCancellationReason', label: 'Λόγος Ματαίωσης (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'khmdhsNoticeEstimatedAmountNoVat', label: 'Εκτιμ. Αξία χωρίς ΦΠΑ (ΚΗΜΔΗΣ)', width: 24 },
  { id: 'khmdhsNoticeEstimatedAmountWithVat', label: 'Εκτιμ. Αξία με ΦΠΑ (ΚΗΜΔΗΣ)', width: 24 },
  { id: 'khmdhsNoticeContractDuration', label: 'Διάρκεια Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'khmdhsNoticeOffersValidTime', label: 'Ισχύς Προσφορών (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'khmdhsNoticeBiddingWebsite', label: 'Ιστότοπος Υποβολής (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'khmdhsNoticeSystemicNumber', label: 'Αρ. Ηλεκτρ. Δημοσίευσης (ΚΗΜΔΗΣ)', width: 26 },
  { id: 'khmdhsNoticeApprovedRequestAdam', label: 'Συνδ. Αίτημα ΑΔΑΜ (ΚΗΜΔΗΣ)', width: 24 },
  { id: 'khmdhsNoticeAuctionRefNos', label: 'Συνδ. Αναθέσεις ΑΔΑΜ (ΚΗΜΔΗΣ)', width: 30 },
  { id: 'khmdhsNoticeCpvs', label: 'CPV (ΚΗΜΔΗΣ)', width: 30 },
  { id: 'khmdhsNoticeFundingSummary', label: 'Χρηματοδότηση (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'khmdhsNoticeFetchedAt', label: 'Ημ. Ανάκτησης Δεδομένων (ΚΗΜΔΗΣ)', width: 26 },
  { id: 'khmdhsContractVarianceAmount', label: 'Διαφορά (Σύμβαση − Εκτιμ. με ΦΠΑ)', width: 30 },
  { id: 'khmdhsContractVariancePct', label: 'Απόκλιση % (Σύμβαση vs Εκτιμ. με ΦΠΑ)', width: 30 }
];

export const KHMDHS_NOTICE_FIELD_IDS = new Set(KHMDHS_NOTICE_EXPORT_FIELDS.map((f) => f.id));

export function isKhmdhsNoticeExportField(fieldId) {
  return KHMDHS_NOTICE_FIELD_IDS.has(fieldId);
}

function str(val) {
  if (val == null) return '';
  return String(val).trim();
}

function durationLabel(value, unit) {
  if (value == null || value === '') return '';
  const u = unit ? ` ${unit}` : '';
  return `${value}${u}`;
}

/** Εκτιμώμενη αξία με ΦΠΑ 24% */
export function getKhmdhsEstimatedAmounts(project) {
  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  if (!snap) return null;

  const gross = grossFromCostSnapshot(snap);
  if (gross == null) return null;

  const netRaw = Number(snap.totalCostWithoutVAT);
  const net = Number.isFinite(netRaw) ? netRaw : null;

  return { net, gross };
}

export function computeKhmdhsContractVariance(project) {
  const amounts = getKhmdhsEstimatedAmounts(project);
  if (!amounts) return null;
  const contract = getTotalContractAmount(project);
  if (contract <= 0) return null;
  const diff = contract - amounts.gross;
  const pct = Math.round((diff / amounts.gross) * 100);
  return {
    estimatedNet: amounts.net,
    estimatedGross: amounts.gross,
    contract,
    diff,
    pct
  };
}

function formatVarianceAmount(diff) {
  if (diff == null || Number.isNaN(diff)) return '';
  const sign = diff > 0 ? '+' : '';
  return sign + formatKhmdhsEuro(diff).replace(' €', '') + ' €';
}

function formatVariancePct(pct) {
  if (pct == null || Number.isNaN(pct)) return '';
  const rounded = Math.round(Number(pct));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

/** Τιμή πεδίου εξαγωγής για ένα υποέργο */
export function getKhmdhsNoticeExportValue(project, fieldId) {
  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  const adam = str(project?.khmdhsNoticeAdam) || str(snap?.referenceNumber);

  switch (fieldId) {
    case 'khmdhsNoticeAdam':
      return adam;
    case 'khmdhsNoticeTitle':
      return str(snap?.title);
    case 'khmdhsNoticeType':
      return str(snap?.noticeType);
    case 'khmdhsNoticeContractType':
      return str(snap?.contractType);
    case 'khmdhsNoticeProcedureKhmdhs':
      return str(snap?.typeOfProcedure);
    case 'khmdhsNoticeProcedureApp':
      return str(resolveKhmdhsNoticeAssignmentProcedure(project?.khmdhsNoticeSnapshot));
    case 'khmdhsNoticeLegalContext':
      return str(snap?.legalContext);
    case 'khmdhsNoticeConductingProceedings':
      return str(snap?.conductingProceedings);
    case 'khmdhsNoticeDigitalPlatform':
      return str(snap?.digitalPlatform);
    case 'khmdhsNoticeCriteriaCode':
      return str(snap?.criteriaCode);
    case 'khmdhsNoticeOrganization':
      return str(snap?.organization);
    case 'khmdhsNoticeUnitsOperator':
      return str(snap?.unitsOperator);
    case 'khmdhsNoticeSigner':
      return str(snap?.signer);
    case 'khmdhsNoticeSignedDate':
      return formatKhmdhsDateOnly(snap?.signedDate);
    case 'khmdhsNoticeFinalSubmissionDate':
      return formatKhmdhsDateTime(snap?.finalSubmissionDate);
    case 'khmdhsNoticeSubmissionDate':
      return formatKhmdhsDateTime(snap?.submissionDate);
    case 'khmdhsNoticeDeadlineDaysLeft': {
      if (projectProcurementPhaseConcluded(project)) return '';
      if (!snap?.finalSubmissionDate || snap.cancelled) return '';
      const days = daysUntilDate(snap.finalSubmissionDate);
      return days == null ? '' : String(days);
    }
    case 'khmdhsNoticeCancelled':
      return snap?.cancelled ? 'Ναι' : (projectHasKhmdhsNoticeData(project) ? 'Όχι' : '');
    case 'khmdhsNoticeCancellationDate':
      return formatKhmdhsDateTime(snap?.cancellationDate);
    case 'khmdhsNoticeCancellationReason':
      return str(snap?.cancellationReason);
    case 'khmdhsNoticeEstimatedAmountNoVat':
      return formatKhmdhsEuro(snap?.totalCostWithoutVAT);
    case 'khmdhsNoticeEstimatedAmountWithVat': {
      const amounts = getKhmdhsEstimatedAmounts(project);
      return amounts ? formatKhmdhsEuro(amounts.gross) : formatKhmdhsCostSnapshotGross(snap);
    }
    case 'khmdhsNoticeContractDuration':
      return durationLabel(snap?.contractDuration, snap?.contractDurationUnit);
    case 'khmdhsNoticeOffersValidTime':
      return durationLabel(snap?.offersValidTime, snap?.offersValidTimeUnit);
    case 'khmdhsNoticeBiddingWebsite':
      return str(snap?.biddingWebsite);
    case 'khmdhsNoticeSystemicNumber':
      return str(snap?.systemicNumber);
    case 'khmdhsNoticeApprovedRequestAdam':
      return str(snap?.approvedRequestAdam);
    case 'khmdhsNoticeAuctionRefNos':
      return Array.isArray(snap?.auctionRefNos) && snap.auctionRefNos.length
        ? snap.auctionRefNos.join(', ')
        : '';
    case 'khmdhsNoticeCpvs':
      return Array.isArray(snap?.cpvs) && snap.cpvs.length ? snap.cpvs.join(', ') : '';
    case 'khmdhsNoticeFundingSummary':
      return str(snap?.fundingSummary);
    case 'khmdhsNoticeFetchedAt':
      return formatKhmdhsDateTime(project?.khmdhsNoticeFetchedAt);
    case 'khmdhsContractVarianceAmount': {
      const v = computeKhmdhsContractVariance(project);
      return v ? formatVarianceAmount(v.diff) : '';
    }
    case 'khmdhsContractVariancePct': {
      const v = computeKhmdhsContractVariance(project);
      return v ? formatVariancePct(v.pct) : '';
    }
    default:
      return '';
  }
}
