import { buildSubprojectReportPayload, getLinkedProskliseis } from './subprojectReportData';
import { savePdfWithDialog } from './savePdfFile';
import { getEntityLinkedNotes } from '../components/LinkedNoteSticker';

const ipcRenderer = window.electronAPI;

function sanitizeFilename(name) {
  return String(name || 'υποεργο')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export async function exportSubprojectReport({
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
  variant = 'full',
}) {
  const summary = variant === 'summary';
  const linkedNoteRefs = getEntityLinkedNotes(linkedNotesMap, project.subprojectId);
  const linkedNotes = linkedNoteRefs.map((ref) => {
    const note = (notes || []).find((n) => n.id === ref.noteId);
    return {
      noteId: ref.noteId,
      title: note?.title || ref.noteTitle || 'Σημείωση',
      content: note?.content || '',
      updatedAt: note?.updatedAt || note?.createdAt || ''
    };
  });

  let egkriseisRecords = [];
  try {
    const egRes = await ipcRenderer.invoke('load-project-egkriseis', project.projectId);
    if (egRes?.success && Array.isArray(egRes.egkriseis)) {
      egkriseisRecords = egRes.egkriseis.filter(
        (sub) => sub.subprojectId === project.subprojectId
      );
    }
  } catch {
    egkriseisRecords = [];
  }

  let epActions = null;
  if (!summary) {
    try {
      const epRes = await ipcRenderer.invoke('get-ep-actions-for-subproject', {
        subprojectId: project.subprojectId,
        requestingUsername
      });
      if (epRes?.success) epActions = epRes.actions || [];
    } catch {
      epActions = null;
    }
  }

  let meleti = null;
  try {
    const meletiRes = await ipcRenderer.invoke('get-meleti-by-subproject', {
      subprojectId: project.subprojectId,
      actingUsername: requestingUsername
    });
    if (meletiRes?.success && meletiRes.meleti) meleti = meletiRes.meleti;
  } catch {
    meleti = null;
  }

  const linkedProskliseisRaw = getLinkedProskliseis(proskliseis, project);
  const prosklisiMods = {};
  await Promise.all(
    linkedProskliseisRaw.map(async (p) => {
      try {
        const mods = await ipcRenderer.invoke('load-prosklisi-modifications', p.prosklisiId);
        prosklisiMods[p.prosklisiId] = mods || [];
      } catch {
        prosklisiMods[p.prosklisiId] = [];
      }
    })
  );

  const proskliseisWithMods = linkedProskliseisRaw.map((p) => ({
    ...p,
    _modifications: prosklisiMods[p.prosklisiId] || []
  }));

  const payload = buildSubprojectReportPayload({
    project,
    entaxeis,
    proskliseis: proskliseisWithMods,
    linkedEgkriseis,
    engineerCatalog,
    egkriseisRecords,
    epActions,
    linkedNotes,
    directAssignmentViolations,
    isPublishedToPortal,
    meleti,
    appVersion
  });

  const { createElement } = await import('react');
  const { pdf } = await import('@react-pdf/renderer');
  const Report = summary
    ? (await import('../components/pdf/SubprojectSummaryReport')).default
    : (await import('../components/pdf/SubprojectDetailReport')).default;

  const reportEl = createElement(Report, { data: payload, appConfig, appVersion });
  const blob = await pdf(reportEl).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);
  const nameKind = summary ? 'Συνοπτική' : 'Αναφορά';
  const defaultName = `ERGOHUB_${nameKind}_${sanitizeFilename(project.subprojectTitle)}_${dateStr}.pdf`;

  const result = await savePdfWithDialog({
    buffer: arrayBuffer,
    defaultName,
    title: summary ? 'Αποθήκευση συνοπτικής αναφοράς' : 'Αποθήκευση αναφοράς υποέργου',
    subtitle: project.subprojectTitle || '',
  });

  if (result?.canceled) return { canceled: true };
  if (result?.success) {
    if (showToast) {
      showToast(
        summary ? 'Η συνοπτική αναφορά αποθηκεύτηκε επιτυχώς!' : 'Η αναφορά υποέργου αποθηκεύτηκε επιτυχώς!',
        'success'
      );
    }
    return { success: true, path: result.path };
  }
  if (showToast) showToast(result?.error || 'Σφάλμα κατά την αποθήκευση PDF', 'error');
  return { success: false, error: result?.error };
}
