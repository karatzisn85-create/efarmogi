/**
 * Προεπιλεγμένη καρτέλα (Α / Β) όταν ανοίγει επεξεργασία ή λεπτομέρειες υποέργου.
 *
 * - Υπό βραχυπρόθεσμη ωρίμανση → πάντα Α (στοιχεία)
 * - Αλλιώς, αν έχει γίνει αρχική ανάκτηση ΚΗΜΔΗΣ → Β
 * - Διαφορετικά → Α
 */

import { projectHasKhmdhsFormResults } from '../components/KhmdhsFormStageResults';

export const MATURATION_PROJECT_STATUS = 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ';

/**
 * @param {object|null|undefined} project
 * @returns {'A'|'B'}
 */
export function getDefaultSubprojectPhaseTab(project) {
  if (!project) return 'A';
  if (project.projectStatus === MATURATION_PROJECT_STATUS) return 'A';
  if (projectHasKhmdhsFormResults(project)) return 'B';
  return 'A';
}
