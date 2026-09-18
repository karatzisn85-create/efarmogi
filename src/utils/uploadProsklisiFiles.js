import { showSubprojectFileGroupingModal } from './subprojectFileGroupingModal';
import subprojectFiles from '../../app/core/subprojectFiles';

const ipcRenderer = window.electronAPI;

export async function applyProsklisiGroupingChoice(prosklisiId, groupingChoice, fileNames) {
  if (groupingChoice === null || groupingChoice === false) {
    return { success: true };
  }

  const names = Array.isArray(fileNames) ? fileNames : [];

  if (groupingChoice.action === 'new') {
    const groupResult = await ipcRenderer.invoke(
      'create-prosklisi-group',
      prosklisiId,
      groupingChoice.title,
      names,
      groupingChoice.parentId || null
    );
    if (!groupResult?.success) {
      return { success: false, error: groupResult?.error || 'Αποτυχία δημιουργίας ομάδας' };
    }
    return groupResult;
  }

  if (groupingChoice.action === 'existing') {
    const addResult = await ipcRenderer.invoke(
      'add-files-to-prosklisi-group',
      prosklisiId,
      groupingChoice.groupId,
      names
    );
    if (!addResult?.success) {
      return { success: false, error: addResult?.error || 'Αποτυχία προσθήκης σε ομάδα' };
    }
    return addResult;
  }

  if (groupingChoice.action === 'subgroup') {
    const groupResult = await ipcRenderer.invoke(
      'create-prosklisi-group',
      prosklisiId,
      groupingChoice.title,
      names,
      groupingChoice.parentId
    );
    if (!groupResult?.success) {
      return { success: false, error: groupResult?.error || 'Αποτυχία δημιουργίας υποομάδας' };
    }
    return groupResult;
  }

  return { success: true };
}

export async function askProsklisiGrouping(fileCount, existingGroups, extra = {}) {
  return showSubprojectFileGroupingModal(fileCount, existingGroups, {
    allowSubgroups: true,
    ...extra,
  });
}

export { subprojectFiles };
