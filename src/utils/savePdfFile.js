import { showSavePdfDialog } from './savePdfDialog';

const ipcRenderer = window.electronAPI;

/**
 * Αποθήκευση PDF με custom modal ERGOHUB (χωρίς native Windows overwrite prompt).
 */
export async function savePdfWithDialog({
  buffer,
  defaultName,
  title = 'Αποθήκευση αναφοράς PDF',
  subtitle = '',
}) {
  const pick = await showSavePdfDialog({ defaultName, title, subtitle });
  if (pick.canceled) return { canceled: true };

  const payload = buffer instanceof Uint8Array
    ? Array.from(buffer)
    : (Array.isArray(buffer) ? buffer : Array.from(new Uint8Array(buffer)));

  const result = await ipcRenderer.invoke('write-pdf-file', {
    buffer: payload,
    filePath: pick.path,
  });

  if (result?.success) return { success: true, path: result.path };
  return { success: false, error: result?.error || 'Αποτυχία αποθήκευσης' };
}
