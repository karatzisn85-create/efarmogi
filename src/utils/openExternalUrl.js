/**
 * Ανοίγει URL στον προεπιλεγμένο browser του συστήματος (όχι μέσα στο Electron).
 */
export async function openExternalUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return;

  try {
    if (window.electronAPI?.invoke) {
      const res = await window.electronAPI.invoke('open-external-url', { url: u });
      if (res?.success) return;
    }
  } catch {
    // fallback παρακάτω
  }

  window.open(u, '_blank', 'noopener,noreferrer');
}
