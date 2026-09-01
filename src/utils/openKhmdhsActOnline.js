/**
 * Προβολή εγγράφου ΚΗΜΔΗΣ ως PDF στον προεπιλεγμένο αναγνώστη.
 */
export async function openKhmdhsActOnline(adamRaw, { label = '' } = {}) {
  const adam = String(adamRaw || '').trim().toUpperCase();
  if (!adam) return { success: false, error: 'Λείπει ΑΔΑΜ' };

  try {
    if (window.electronAPI?.invoke) {
      const res = await window.electronAPI.invoke('open-khmdhs-act-view', {
        adam,
        label: String(label || '').trim(),
      });
      return res || { success: false, error: 'Άγνωστο σφάλμα' };
    }
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }

  return { success: false, error: 'Η προβολή είναι διαθέσιμη μόνο μέσω της εφαρμογής' };
}
