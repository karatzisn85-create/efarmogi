/**
 * Safe wrappers γύρω από native dialogs (confirm / alert / file picker).
 *
 * Electron παγώνει τον renderer όσο ένα native dialog είναι ανοιχτό.
 * Μετά το κλείσιμο:
 *  1. Τα keyboard events δεν δρομολογούνται σωστά (γνωστό Electron bug) →
 *     επιλύεται με OS-level BrowserWindow blur/focus μέσω IPC στο main process.
 *     Η DOM window.blur/focus() ΔΕΝ αρκεί — χρειάζεται mainWindow.blur/focus().
 *  2. Inline styles (overflow, pointer-events) μπορεί να μείνουν κολλημένα →
 *     επιλύεται με scheduleDocumentInteractionRecovery().
 */
import { scheduleDocumentInteractionRecovery } from './documentInteractionReset';

const ipcRenderer = window.electronAPI;

/**
 * OS-level BrowserWindow focus cycle μέσω main process.
 * Αυτό είναι το ισοδύναμο του "ανοίγω DevTools" — αναγκάζει το OS
 * να επαναφέρει τη δρομολόγηση keyboard events στον renderer.
 */
function restoreElectronFocus() {
  // Fire-and-forget: δεν χρειαζόμαστε await
  ipcRenderer.invoke('refocus-window').catch(() => {});
}

function cleanupBodyInteraction() {
  scheduleDocumentInteractionRecovery();
}

export function safeConfirm(message) {
  const result = window.confirm(message);
  restoreElectronFocus();
  cleanupBodyInteraction();
  return result;
}

export function safeAlert(message) {
  window.alert(message);
  restoreElectronFocus();
  cleanupBodyInteraction();
}

export async function safeFileDialog(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  restoreElectronFocus();
  cleanupBodyInteraction();
  return result;
}
