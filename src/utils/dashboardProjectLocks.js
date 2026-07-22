/**
 * Βοηθητικά για lock status έργων στο Dashboard — dedupe ανά projectId.
 */

export function getUniqueProjectIds(projects) {
  return [...new Set((projects || []).map((p) => p.projectId).filter(Boolean))];
}

export function enrichProjectsFromLoad(loadedProjects, { egkrisiLinksSet, prosklisiLinksSet, entaxiLinksMap }) {
  return (loadedProjects || []).map((project) => ({
    ...project,
    isLocked: !!project.isLocked,
    lockedBy: project.lockedBy || '',
    hasEgkrisiLink: egkrisiLinksSet.has(project.subprojectId),
    hasProsklisiLink: prosklisiLinksSet.has(project.subprojectId),
    hasEntaxiLink: entaxiLinksMap.has(project.subprojectId)
  }));
}

export async function fetchProjectLockMap(ipcRenderer, projects) {
  const uniqueIds = getUniqueProjectIds(projects);
  if (!uniqueIds.length) return new Map();

  // Ένα bulk IPC αντί για N παράλληλα (Φάση 1 βελτίωσης απόδοσης)
  try {
    const bulkResult = await ipcRenderer.invoke('check-projects-locks-bulk', uniqueIds);
    if (bulkResult && bulkResult.success && bulkResult.locks) {
      return new Map(
        Object.entries(bulkResult.locks).map(([projectId, lockStatus]) => [
          projectId,
          { isLocked: !!lockStatus.locked, lockedBy: lockStatus.lockedBy || '' }
        ])
      );
    }
  } catch {
    // fallback στην παλιά μέθοδο αν το bulk channel δεν είναι διαθέσιμο
  }

  const pairs = await Promise.all(
    uniqueIds.map(async (projectId) => {
      try {
        const lockStatus = await ipcRenderer.invoke('check-project-lock', projectId);
        return [
          projectId,
          { isLocked: !!lockStatus.locked, lockedBy: lockStatus.lockedBy || '' }
        ];
      } catch {
        return null;
      }
    })
  );

  return new Map(pairs.filter(Boolean));
}

export function applyLockMapToProjects(projects, lockMap) {
  if (!lockMap?.size) return projects;
  return projects.map((project) => {
    const lock = lockMap.get(project.projectId);
    if (!lock) return project;
    if (project.isLocked === lock.isLocked && (project.lockedBy || '') === lock.lockedBy) {
      return project;
    }
    return { ...project, isLocked: lock.isLocked, lockedBy: lock.lockedBy };
  });
}

export function sortProjectsForDisplay(projects) {
  return [...projects].sort((a, b) => {
    const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
    if (projectComparison !== 0) return projectComparison;
    return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
  });
}

export async function refreshProjectsLockStatus(ipcRenderer, projects) {
  const lockMap = await fetchProjectLockMap(ipcRenderer, projects);
  return applyLockMapToProjects(projects, lockMap);
}
