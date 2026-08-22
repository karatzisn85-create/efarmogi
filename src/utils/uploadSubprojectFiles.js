import { safeFileDialog } from './safeDialogs';
import { showSubprojectFileGroupingModal } from './subprojectFileGroupingModal';
import subprojectFiles from '../../app/core/subprojectFiles';

const ipcRenderer = window.electronAPI;

function basenameFromPath(filePath) {
  const parts = String(filePath || '').split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

function mapPickedFiles(fileRefs) {
  return (fileRefs || []).map((file) => ({
    path: file.filePath || file.path,
    name: file.fileName || file.name || basenameFromPath(file.filePath || file.path)
  })).filter((f) => f.path);
}

async function applyGroupingChoice(groupingChoice, projectId, subprojectId, fileNames) {
  if (groupingChoice === null || groupingChoice === false) {
    return { success: true };
  }

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

  return { success: true };
}

/**
 * Ανέβασμα μεμονωμένων αρχείων σε υποέργο (ίδια ροή με την επεξεργασία φόρμας).
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

  if (subprojectFiles.isUploadGroupingCancelled(groupingChoice)) {
    return { cancelled: true };
  }

  const saveResult = await ipcRenderer.invoke('save-files', newFiles, projectId, subprojectId);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error || 'Αποτυχία αποθήκευσης αρχείων' };
  }

  const fileNames = saveResult.files || newFiles.map((f) => f.name);
  const groupingResult = await applyGroupingChoice(groupingChoice, projectId, subprojectId, fileNames);
  if (!groupingResult.success) {
    return groupingResult;
  }

  return { success: true, count: fileNames.length };
}

/**
 * Ανέβασμα ολόκληρου φακέλου — όλα τα αρχεία (και υποφάκελοι) αποθηκεύονται
 * και δημιουργείται αυτόματα ομάδα με το όνομα του φακέλου.
 */
export async function uploadSubprojectFolder({ projectId, subprojectId }) {
  const pick = await ipcRenderer.invoke('select-folder-files-flat', {
    title: 'Επιλογή φακέλου για το υποέργο'
  });

  if (pick.canceled) {
    return { cancelled: true };
  }
  if (!pick.success) {
    return { success: false, error: pick.error || 'Αποτυχία επιλογής φακέλου' };
  }

  const newFiles = mapPickedFiles(pick.files);
  if (newFiles.length === 0) {
    return { success: false, error: 'Ο φάκελος δεν περιέχει αρχεία' };
  }

  const saveResult = await ipcRenderer.invoke('save-files', newFiles, projectId, subprojectId);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error || 'Αποτυχία αποθήκευσης αρχείων φακέλου' };
  }

  const fileNames = saveResult.files || newFiles.map((f) => f.name);
  const folderTitle = subprojectFiles.folderGroupTitle(pick.folderName);
  const groupResult = await ipcRenderer.invoke(
    'create-file-group',
    projectId,
    subprojectId,
    folderTitle,
    fileNames
  );

  if (!groupResult.success) {
    return { success: false, error: groupResult.error || 'Αποτυχία δημιουργίας ομάδας φακέλου' };
  }

  return { success: true, count: fileNames.length, groupTitle: folderTitle };
}
