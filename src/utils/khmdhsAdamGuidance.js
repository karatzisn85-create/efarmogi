import {
  PROJECT_STATUS_CONTRACT_PROCESS,
  STATUSES_WITH_CONTRACT_FIELDS,
  isKhmdhsStatusProtectedFromAutoUpdate,
  statusShowsAssignmentProcedure,
} from '../data/formOptions';
import { isMultipleContractsForm } from './khmdhsFields';

/** Κατάσταση με υπογεγραμμένη σύμβαση — default μετά από αλυσίδα ΚΗΜΔΗΣ */
export const PROJECT_STATUS_EXECUTED = 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ';

/** Υπάρχει τουλάχιστον μία σύμβαση στην αλυσίδα (χωρίς αναμονή για όλες τις γραμμές). */
export function chainHasAtLeastOneContract(chainRes) {
  if (chainRes?.contract?.adam) return true;
  const linked = chainRes?.chainMeta?.linkedAdams?.contracts || [];
  if (linked.length > 0) return true;
  const count = chainRes?.chainMeta?.stageCounts?.contracts;
  return typeof count === 'number' && count > 0;
}

/**
 * Αν η αλυσίδα βρίσκει σύμβαση αλλά η κατάσταση είναι «Σε διαδικασία σύμβασης»,
 * προτείνεται αναβάθμιση σε «Εκτελούμενο - Συμβασιοποιημένο».
 */
export function suggestProjectStatusAfterKhmdhsChain(currentStatus, chainRes) {
  if (isKhmdhsStatusProtectedFromAutoUpdate(currentStatus)) return null;
  if (!chainHasAtLeastOneContract(chainRes)) return null;
  if (currentStatus !== PROJECT_STATUS_CONTRACT_PROCESS) return null;
  return PROJECT_STATUS_EXECUTED;
}

/** Τύποι ΑΔΑΜ ΚΗΜΔΗΣ — για chips & placeholders */
export const KHMDHS_ADAM_TYPES = {
  REQ: {
    id: 'REQ',
    label: 'Πρωτογενές αίτημα',
    example: '26REQ018492003',
    hint: 'Εγκεκριμένο ή πρωτογενές αίτημα',
  },
  PROC: {
    id: 'PROC',
    label: 'Δημοσίευση',
    example: '26PROC018492003',
    hint: 'Προκήρυξη, πρόσκληση ή άλλο έγγραφο δημοσίευσης',
  },
  AWRD: {
    id: 'AWRD',
    label: 'Ανάθεση',
    example: '26AWRD018492003',
    hint: 'Απόφαση κατακύρωσης ή ανάθεσης',
  },
  SYMV: {
    id: 'SYMV',
    label: 'Σύμβαση',
    example: '26SYMV018523441',
    hint: 'Υπογεγραμμένη σύμβαση',
  },
};

/**
 * Οδηγίες ΑΔΑΜ ανά κατάσταση υποέργου & μορφή υλοποίησης.
 * @returns {object|null} null αν δεν εμφανίζεται panel ΚΗΜΔΗΣ
 */
export function getKhmdhsAdamGuidance({ projectStatus, implementationForm }) {
  if (!projectStatus) return null;

  const isMulti = isMultipleContractsForm(implementationForm);
  const inContractProcess = projectStatus === PROJECT_STATUS_CONTRACT_PROCESS;
  const hasSignedContract = STATUSES_WITH_CONTRACT_FIELDS.includes(projectStatus);
  const showKhmdhs = statusShowsAssignmentProcedure(projectStatus) || hasSignedContract;

  if (!showKhmdhs) return null;

  if (inContractProcess) {
    return {
      tone: 'procedure',
      statusLabel: projectStatus,
      headline: 'Σε διαδικασία σύμβασης',
      summary: isMulti
        ? 'Δώστε ΑΔΑΜ REQ, PROC ή AWRD. Το κοινό στάδιο μία φορά· ανά σύμβαση παρακάτω.'
        : 'Δώστε ΑΔΑΜ REQ, PROC ή AWRD και πατήστε «Ανάκτηση».',
      allowedTypeIds: ['REQ', 'PROC', 'AWRD'],
      discouragedTypeIds: [],
      discouragedNote: null,
      primaryTypeIds: ['PROC'],
      chainPanelTitle: isMulti ? 'ΑΔΑΜ διαδικασίας (κοινή δημοσίευση)' : 'ΑΔΑΜ αλυσίδας',
      chainPanelHint: 'REQ, PROC ή AWRD',
      placeholder: 'π.χ. 26REQ018492003 ή 26PROC018492003',
      contractBlockTitle: 'ΑΔΑΜ σταδίου (REQ / PROC / AWRD)',
      contractBlockHint: 'REQ, PROC ή AWRD',
    };
  }

  if (hasSignedContract) {
    return {
      tone: 'contract',
      statusLabel: projectStatus,
      headline: 'Υπογεγραμμένη σύμβαση',
      summary: isMulti
        ? 'SYMV ανά σύμβαση. Εναλλακτικά REQ, PROC ή AWRD.'
        : 'SYMV ή REQ / PROC / AWRD της ίδιας αλυσίδας.',
      allowedTypeIds: ['REQ', 'PROC', 'AWRD', 'SYMV'],
      discouragedTypeIds: [],
      discouragedNote: null,
      primaryTypeIds: ['SYMV'],
      chainPanelTitle: 'ΑΔΑΜ αλυσίδας (μία σύμβαση)',
      chainPanelHint: 'SYMV ή REQ / PROC / AWRD',
      placeholder: 'π.χ. 26SYMV018523441 ή 26PROC018492003',
      contractBlockTitle: 'ΑΔΑΜ σύμβασης (SYMV)',
      contractBlockHint: 'SYMV της υπογεγραμμένης σύμβασης',
    };
  }

  return null;
}

export function khmdhsAdamTypeById(id) {
  return KHMDHS_ADAM_TYPES[id] || null;
}

/** Επιστρέφει REQ | PROC | AWRD | SYMV | PAY ή κενό */
export function parseKhmdhsAdamType(adamRaw) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adamRaw || '').trim());
  return m ? m[2].toUpperCase() : '';
}
