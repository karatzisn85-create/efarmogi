import { buildEntaxiDetailReportPayload } from './entaxiDetailReportData';
import { savePdfWithDialog } from './savePdfFile';
import { getEntityLinkedNotes } from '../components/LinkedNoteSticker';

function sanitizeFilename(name) {
  return String(name || 'ενταξη')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export async function exportEntaxiDetailReport({
  entaxi,
  proskliseis = [],
  linkedNotesMap = {},
  notes = [],
  appConfig = {},
  appVersion = '',
  organizationName = '',
  showToast,
}) {
  if (!entaxi) {
    if (showToast) showToast('Δεν βρέθηκε η ένταξη για την αναφορά.', 'error');
    return { success: false };
  }

  try {
    const linkedNoteRefs = getEntityLinkedNotes(linkedNotesMap, entaxi.entaxiId);
    const linkedNotes = linkedNoteRefs.map((ref) => {
      const note = (notes || []).find((n) => n.id === ref.noteId);
      return {
        noteId: ref.noteId,
        title: note?.title || ref.noteTitle || 'Σημείωση',
        content: note?.content || '',
        updatedAt: note?.updatedAt || note?.createdAt || '',
      };
    });

    const prosklisi = (proskliseis || []).find((p) => p.prosklisiId === entaxi.prosklisiId);
    const payload = buildEntaxiDetailReportPayload({
      entaxi,
      prosklisiTitle: prosklisi?.title || '',
      linkedNotes,
      appVersion,
      organizationName: organizationName
        || appConfig?.organizationFullName
        || appConfig?.organizationName
        || '',
    });

    const { createElement } = await import('react');
    const { default: EntaxiDetailReport } = await import('../components/pdf/EntaxiDetailReport');
    const { pdf } = await import('@react-pdf/renderer');

    const reportEl = createElement(EntaxiDetailReport, { data: payload, appConfig, appVersion });
    const blob = await pdf(reportEl).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultName = `ERGOHUB_Αναφορά_Ένταξης_${sanitizeFilename(payload.subject || 'ενταξη')}_${dateStr}.pdf`;

    const result = await savePdfWithDialog({
      buffer: arrayBuffer,
      defaultName,
      title: 'Αποθήκευση αναφοράς ένταξης',
      subtitle: payload.subject || '',
    });

    if (result?.canceled) return { canceled: true };
    if (result?.success) {
      if (showToast) showToast('Η αναφορά ένταξης αποθηκεύτηκε επιτυχώς!', 'success');
      return { success: true, path: result.path };
    }
    if (showToast) showToast(result?.error || 'Σφάλμα κατά την αποθήκευση PDF', 'error');
    return { success: false, error: result?.error };
  } catch (error) {
    if (showToast) showToast(error?.message || 'Σφάλμα κατά τη δημιουργία της αναφοράς', 'error');
    return { success: false, error: error?.message };
  }
}
