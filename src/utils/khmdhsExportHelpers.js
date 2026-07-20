/**
 * Κεντρικοί helpers εξαγωγής — ποσά, ΑΔΑΜ, DQR για ExportData & TechnicalProgram.
 * Χρησιμοποιεί πάντα την ίδια λογική που βλέπει η κάρτα/φόρμα του υποέργου.
 */

import {
  getTotalContractAmount,
  parseGreekAmountString,
  isMultipleContractsForm,
  resolveEffectivePayableAmountGrossForPayments,
} from './khmdhsFields';
import { getLatestContractApeAmount } from './khmdhsApeEntry';
import { reconcileKhmdhsPaymentsFromProject } from './khmdhsPaymentReconciliation';
import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';

/** Αριθμός → ελληνική μορφή «1.234.567,89» — κενό αν 0 */
export function formatAmountForExport(n) {
  if (!n || !Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Συνολικό ποσό σύμβασης (αρχική + νόμιμες συμπληρωματικές, ΟΧΙ παρατάσεις).
 * Καλύπτει: μονή σύμβαση, πολλές συμβάσεις, συμπληρωματικές χειροκίνητες & από αλυσίδα.
 */
export function getProjectContractTotalForExport(project) {
  const n = getTotalContractAmount(project);
  return formatAmountForExport(n);
}

/**
 * Τελευταίο καταγεγραμμένο ποσό ΑΠΕ (μόνο ΑΠΕ — όχι συμπληρωματικές).
 * — Για πολλές συμβάσεις: άθροισμα τελευταίου ΑΠΕ ανά σύμβαση.
 * — Για μονή σύμβαση: τελευταίο apeEntry (με migration legacy).
 */
export function getProjectApeAmountForExport(project) {
  if (!project) return '';

  if (isMultipleContractsForm(project.implementationForm)) {
    const contracts = Array.isArray(project.contracts) ? project.contracts : [];
    let total = 0;
    contracts.forEach((_, idx) => {
      const raw = getLatestContractApeAmount(project, idx);
      if (raw) total += parseGreekAmountString(raw);
    });
    return total > 0 ? formatAmountForExport(total) : '';
  }

  const raw = getLatestContractApeAmount(project, 0);
  return raw ? formatAmountForExport(parseGreekAmountString(raw)) : '';
}

/**
 * Τελικό πληρωτέο όπως στην εφαρμογή:
 * ΑΠΕ (αν υπάρχει) αλλιώς ποσό σύμβασης, συν συμπληρωματικές (όχι παρατάσεις).
 * Χρησιμοποιείται στην «Εξαγωγή Δεδομένων» για τη στήλη ΑΠΕ + συμπληρωματικές.
 */
export function getProjectPayableAmountForExport(project) {
  if (!project) return '';
  const n = resolveEffectivePayableAmountGrossForPayments(project);
  return formatAmountForExport(n);
}

/**
 * Ημερομηνίες υπογραφής σύμβασης — για πολλές συμβάσεις όλες οι ημερομηνίες γραμμών.
 * Επιστρέφει ακατέργαστες τιμές (ISO/ό,τι είναι αποθηκευμένο), διαχωρισμένες με « • ».
 */
export function getProjectContractDatesRawForExport(project) {
  if (!project) return '';
  if (isMultipleContractsForm(project.implementationForm)) {
    return (project.contracts || [])
      .map((c) => String(c?.date || '').trim())
      .filter(Boolean)
      .join(' • ');
  }
  return String(project.contractDate || '').trim();
}

/**
 * Σύνολο πληρωμών από αλυσίδα ΚΗΜΔΗΣ (ταμεία + αναδόχων, αφαιρείται αταύτιστο).
 * Επιστρέφει κενό αν δεν υπάρχουν πληρωμές.
 */
export function getProjectPaymentTotalForExport(project) {
  const payments = Array.isArray(project?.khmdhsPayments) ? project.khmdhsPayments : [];
  if (!payments.length) return '';
  try {
    const rec = reconcileKhmdhsPaymentsFromProject(project);
    const total = rec?.estimatedContractorPaymentGross ?? rec?.countableTotalGross ?? rec?.rawTotalGross ?? 0;
    return formatAmountForExport(total);
  } catch {
    return '';
  }
}

/**
 * Ανοιχτά θέματα ποιότητας δεδομένων (DQR).
 * Επιστρέφει: πλήθος ανοιχτών / «Επιλύθηκε» / κενό αν δεν εφαρμόζεται.
 */
export function getProjectDqrStatusForExport(project) {
  const dqr = project?.khmdhsDataQualityReview;
  if (!dqr) return '';
  const items = Array.isArray(dqr.items) ? dqr.items : [];
  if (!items.length) return '';
  const unresolved = getUnresolvedReviewItems(dqr, project);
  if (!unresolved.length) return 'Επιλύθηκε';
  return `${unresolved.length} ανοιχτά`;
}

/** ΑΔΑΜ Αιτήματος (REQ) */
export function getProjectRequestAdamForExport(project) {
  return String(project?.khmdhsRequestAdam || '').trim();
}

/** ΑΔΑΜ Κατακύρωσης (AWRD) */
export function getProjectAwardAdamForExport(project) {
  return String(project?.khmdhsAwardAdam || '').trim();
}

/** ΑΔΑΜ Αναλήψεων υποχρέωσης — όλα, διαχωρισμένα με « • » */
export function getProjectCommitmentAdamsForExport(project) {
  const list = Array.isArray(project?.khmdhsCommitmentDecisions)
    ? project.khmdhsCommitmentDecisions
    : [];
  if (list.length) {
    const adams = list.map((d) => String(d?.adam || '').trim()).filter(Boolean);
    if (adams.length) return adams.join(' • ');
  }
  const single = String(project?.khmdhsCommitmentAdam || '').trim();
  return single;
}
