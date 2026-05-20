/**
 * Safe wrappers γύρω από native dialogs (confirm / alert / file picker).
 *
 * Electron παγώνει τον renderer όσο ένα native dialog είναι ανοιχτό.
 * Μετά το κλείσιμο, inline styles (overflow, pointer-events) μπορεί
 * να μείνουν κολλημένα. Οι wrappers τρέχουν cleanup μετά κάθε dialog.
 */

const ipcRenderer = window.electronAPI;

function cleanupBodyInteraction() {
  if (typeof document === 'undefined') return;
  const targets = [document.body, document.documentElement, document.getElementById('root')].filter(Boolean);

  const unlock = () => {
    targets.forEach((el) => {
      el.style.removeProperty('pointer-events');
    });
    document.body.removeAttribute('inert');
  };

  unlock();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      unlock();
      requestAnimationFrame(unlock);
    });
  }
}

export function safeConfirm(message) {
  const result = window.confirm(message);
  cleanupBodyInteraction();
  return result;
}

export function safeAlert(message) {
  window.alert(message);
  cleanupBodyInteraction();
}

export async function safeFileDialog(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  cleanupBodyInteraction();
  return result;
}
