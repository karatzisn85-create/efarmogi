/**
 * Κεντρικοί helpers εξαγωγής — ποσά, ΑΔΑΜ, DQR για ExportData & TechnicalProgram.
 * Χρησιμοποιεί πάντα την ίδια λογική που βλέπει η κάρτα/φόρμα του υποέργου.
 */

import { getTotalContractAmount, parseGreekAmountString, isMultipleContractsForm } from './khmdhsFields';
import { resolveStoredApeAmount } from './khmdhsFields';
import { reconcileKhmdhsPaymentsFromProject } from './khmdhsPaymentReconciliation';

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
 * Τελευταίο καταγεγραμμένο ποσό ΑΠΕ.
 * — Για πολλές συμβάσεις: άθροισμα τελευταίου ΑΠΕ ανά σύμβαση.
 * — Για μονή σύμβαση: τελευταίο apeEntry ή legacy apeAmount.
 */
export function getProjectApeAmountForExport(project) {
  if (!project) return '';

  if (isMultipleContractsForm(project.implementationForm)) {
    const contracts = Array.isArray(project.contracts) ? project.contracts : [];
    let total = 0;
    contracts.forEach((_, idx) => {
      const raw = resolveStoredApeAmount(project, idx);
      if (raw) total += parseGreekAmountString(raw);
    });
    return total > 0 ? formatAmountForExport(total) : '';
  }

  const raw = resolveStoredApeAmount(project, null);
  return raw ? formatAmountForExport(parseGreekAmountString(raw)) : '';
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
 * Επιστρέφει: 'Ναι' αν υπάρχουν ανοιχτά θέματα, 'Όχι' αν τα έχει δει/επιλύσει, '' αν δεν εφαρμόζεται.
 */
export function getProjectDqrStatusForExport(project) {
  const dqr = project?.khmdhsDataQualityReview;
  if (!dqr) return '';
  const items = Array.isArray(dqr.items) ? dqr.items : [];
  if (!items.length) return '';
  const open = items.filter((it) => it?.status === 'open' || it?.actionRequired === true);
  if (!open.length) return 'Επιλύθηκε';
  return `${open.length} ανοιχτά`;
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
