import { exportSubprojectReport } from './subprojectReportExport';
import { exportEntaxiDetailReport } from './entaxiDetailReportExport';
import { showSavePdfDialog } from './savePdfDialog';
import {
  collectKhmdhsRegistryCandidatesFromProject,
  sortRegistryEntries,
} from './khmdhsDocumentRegistry';
import folderPlan from '../../app/core/subprojectFolderPlan';

const ipcRenderer = window.electronAPI;

async function renderRecord(slot) {
  const { createElement } = await import('react');
  const { pdf } = await import('@react-pdf/renderer');
  const Report = (await import('../components/pdf/FolderRecordPdf')).default;
  const blob = await pdf(createElement(Report, {
    title: slot.title,
    subtitle: slot.subtitle,
    rows: slot.rows || [],
  })).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportSubprojectFolder({
  project,
  entaxeis = [],
  proskliseis = [],
  linkedEgkriseis = {},
  engineerCatalog = [],
  linkedNotesMap = {},
  notes = [],
  directAssignmentViolations = [],
  isPublishedToPortal = false,
  appConfig = {},
  appVersion = '',
  requestingUsername = '',
  showToast,
}) {
  const defaultName = folderPlan.sanitizeSegment(
    project?.subprojectTitle || project?.projectTitle || 'Υποέργο',
    'Υποέργο'
  );
  const pick = await showSavePdfDialog({
    defaultName,
    title: 'Αποθήκευση φακέλου υποέργου',
    subtitle: project?.subprojectTitle || '',
    mode: 'folder',
  });
  if (pick.canceled) return { canceled: true };

  const prepared = await ipcRenderer.invoke('prepare-subproject-folder', {
    projectId: project.projectId,
    subprojectId: project.subprojectId,
  });
  if (!prepared?.success) {
    if (showToast) showToast(prepared?.error || 'Ο φάκελος δεν μπόρεσε να ετοιμαστεί', 'error');
    return { success: false, error: prepared?.error };
  }

  const reportArgs = {
    project,
    entaxeis,
    proskliseis,
    linkedEgkriseis,
    engineerCatalog,
    linkedNotesMap,
    notes,
    directAssignmentViolations,
    isPublishedToPortal,
    appConfig,
    appVersion,
    requestingUsername,
    variant: 'full',
    returnBytes: true,
  };

  const pdfs = [];
  for (const slot of prepared.slots || []) {
    let buffer = null;
    if (slot.kind === 'subproject') {
      const rendered = await exportSubprojectReport(reportArgs);
      buffer = rendered?.buffer || null;
    } else if (slot.kind === 'entaxi') {
      const rendered = await exportEntaxiDetailReport({
        entaxi: slot.entaxi,
        proskliseis,
        linkedNotesMap,
        notes,
        appConfig,
        appVersion,
        organizationName: appConfig?.organizationFullName || appConfig?.organizationName || '',
        returnBytes: true,
      });
      buffer = rendered?.buffer || null;
    } else if (slot.kind === 'record') {
      buffer = await renderRecord(slot);
    }
    if (slot.kind === 'subproject' && !buffer) {
      if (showToast) showToast('Η αναφορά του υποέργου δεν δημιουργήθηκε', 'error');
      return { success: false };
    }
    if (buffer) pdfs.push({ relativePath: slot.relativePath, buffer });
  }

  let khmdhsEntries = [];
  try {
    khmdhsEntries = sortRegistryEntries(collectKhmdhsRegistryCandidatesFromProject(project))
      .map((entry) => ({ adam: entry.adam, stage: entry.stage, title: entry.title || '' }));
  } catch {
    khmdhsEntries = [];
  }

  const result = await ipcRenderer.invoke('export-subproject-folder', {
    projectId: project.projectId,
    subprojectId: project.subprojectId,
    destPath: pick.path,
    pdfs,
    khmdhsEntries,
  });

  if (result?.success) {
    if (showToast) {
      const missing = Number(result.khmdhsMissing) || 0;
      const skipped = Number(result.skipped) || 0;
      const notes = [];
      if (missing > 0) notes.push(`${missing} έγγραφα της αλυσίδας ΚΗΜΔΗΣ δεν ήρθαν`);
      if (skipped > 0) notes.push(`${skipped} αρχεία δεν βρέθηκαν για αντιγραφή`);
      showToast(
        notes.length
          ? `Ο φάκελος αποθηκεύτηκε. ${notes.join('. ')}.`
          : 'Ο φάκελος του υποέργου αποθηκεύτηκε.',
        notes.length ? 'warning' : 'success'
      );
    }
    return { success: true, path: result.path };
  }
  if (showToast) showToast(result?.error || 'Ο φάκελος δεν αποθηκεύτηκε', 'error');
  return { success: false, error: result?.error };
}
