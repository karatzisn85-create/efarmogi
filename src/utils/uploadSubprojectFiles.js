import { safeFileDialog } from './safeDialogs';
import { showSubprojectFileGroupingModal } from './subprojectFileGroupingModal';

const ipcRenderer = window.electronAPI;

function basenameFromPath(filePath) {
  const parts = String(filePath || '').split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

/**
 * Ανέβασμα αρχείων σε υποέργο (ίδια ροή με την επεξεργασία φόρμας).
 */
export async function uploadSubprojectFiles({ projectId, subprojectId }) {
  const pickResult = await safeFileDialog('open-file-dialog');
  if (pickResult.canceled || !pickResult.filePaths || pickResult.filePaths.length === 0) {
    return { cancelled: true };
  }

  const newFiles = pickResult.filePaths.map((filePath) => ({
    path: filePath,
    name: basenameFromPath(filePath)
  }));

  const filesMeta = await ipcRenderer.invoke('get-subproject-files', projectId, subprojectId);
  const groupingChoice = await showSubprojectFileGroupingModal(
    newFiles.length,
    filesMeta.fileGroups || []
  );

  if (groupingChoice === null) {
    return { cancelled: true };
  }

  const saveResult = await ipcRenderer.invoke('save-files', newFiles, projectId, subprojectId);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error || 'Αποτυχία αποθήκευσης αρχείων' };
  }

  const fileNames = saveResult.files || newFiles.map((f) => f.name);

  if (groupingChoice !== null && groupingChoice !== false) {
    if (groupingChoice.action === 'new') {
      const groupResult = await ipcRenderer.invoke(
        'create-file-group',
        projectId,
        subprojectId,
        groupingChoice.title,
        fileNames
      );
      if (!groupResult.success) {
        return { success: false, error: groupResult.error || 'Αποτυχία δημιουργίας ομάδας' };
      }
    } else if (groupingChoice.action === 'existing') {
      const addResult = await ipcRenderer.invoke(
        'add-files-to-group',
        projectId,
        subprojectId,
        groupingChoice.groupId,
        fileNames
      );
      if (!addResult.success) {
        return { success: false, error: addResult.error || 'Αποτυχία προσθήκης σε ομάδα' };
      }
    }
  }

  return { success: true, count: fileNames.length };
}
