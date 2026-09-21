/**
 * Ποια υποέργα έχουν παλιά δεδομένα ΚΗΜΔΗΣ — ίδιοι κανόνες με τον έλεγχο
 * που έτρεχε στον φάκελο, αλλά πάνω στη λίστα που είναι ήδη ανοιχτή.
 */
import khmdhsRefresh from '../../app/core/khmdhsRefresh';

export function listKhmdhsStaleProjects(projects, maxAgeDays = khmdhsRefresh.KHMDHS_STALE_DAYS) {
  const staleAfterDays = Number.isFinite(Number(maxAgeDays)) && Number(maxAgeDays) > 0
    ? Number(maxAgeDays)
    : khmdhsRefresh.KHMDHS_STALE_DAYS;
  const stale = [];

  (projects || []).forEach((project) => {
    if (!project) return;
    const id = String(project.subprojectId || '').trim();
    if (!id) return;
    const projectTitle = String(project.projectTitle || '').trim();
    const subprojectTitle = String(project.subprojectTitle || '').trim();
    if (!projectTitle || !subprojectTitle || projectTitle === 'undefined' || subprojectTitle === 'undefined') {
      return;
    }
    if (khmdhsRefresh.isKhmdhsChainClosedSubproject(project)) return;
    const seed = khmdhsRefresh.getKhmdhsRefreshSeedAdam(project);
    if (!seed?.adam) return;
    const { ageDays, lastRefreshed } = khmdhsRefresh.getKhmdhsRefreshAge(project);
    if (ageDays == null || ageDays >= staleAfterDays) {
      stale.push({
        id,
        label: subprojectTitle || id,
        lastRefreshed,
        ageDays,
      });
    }
  });

  return stale;
}
