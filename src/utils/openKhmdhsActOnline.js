/**
 * Προβολή εγγράφου ΚΗΜΔΗΣ ως PDF στον προεπιλεγμένο αναγνώστη.
 */
import {
  beginKhmdhsActViewWait,
  cancelKhmdhsActViewWait,
  endKhmdhsActViewWait,
  isKhmdhsActViewWaitGeneration,
  peekKhmdhsActViewWait,
} from './khmdhsActViewWaitBridge';
import { KHMDHS_ACT_VIEW_WAIT_MIN_MS } from './khmdhsActViewWaitCopy';

function waitAtLeast(startedAt) {
  const left = KHMDHS_ACT_VIEW_WAIT_MIN_MS - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, left));
}

export function cancelOpenKhmdhsActOnline() {
  const adam = peekKhmdhsActViewWait().adam;
  cancelKhmdhsActViewWait();
  if (window.electronAPI?.invoke) {
    window.electronAPI.invoke('cancel-khmdhs-act-view', { adam }).catch(() => {});
  }
}

export async function openKhmdhsActOnline(adamRaw, { label = '' } = {}) {
  const adam = String(adamRaw || '').trim().toUpperCase();
  if (!adam) return { success: false, error: 'Λείπει ΑΔΑΜ' };

  const startedAt = Date.now();
  const gen = beginKhmdhsActViewWait({ adam, label });
  try {
    if (window.electronAPI?.invoke) {
      const res = await window.electronAPI.invoke('open-khmdhs-act-view', {
        adam,
        label: String(label || '').trim(),
      });
      if (!isKhmdhsActViewWaitGeneration(gen)) {
        return { success: false, cancelled: true };
      }
      if (res?.cancelled) return { success: false, cancelled: true };
      return res || { success: false, error: 'Άγνωστο σφάλμα' };
    }
    return { success: false, error: 'Η προβολή είναι διαθέσιμη μόνο μέσω της εφαρμογής' };
  } catch (e) {
    if (!isKhmdhsActViewWaitGeneration(gen)) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: e?.message || String(e) };
  } finally {
    if (isKhmdhsActViewWaitGeneration(gen)) {
      await waitAtLeast(startedAt);
      endKhmdhsActViewWait();
    }
  }
}
