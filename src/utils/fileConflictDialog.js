/**
 * Διάλογος όταν το νέο αρχείο έχει το ίδιο όνομα με υπάρχον.
 * Επιστρέφει 'replace' | 'keep-both' | null (άκυρο).
 */
import { scheduleDocumentInteractionRecovery } from './documentInteractionReset';

let _setState = null;
let _resolve = null;

export function _registerFileConflictModal(setState) {
  _setState = setState;
}

export function showFileConflictDialog({ fileNames = [] } = {}) {
  return new Promise((resolve) => {
    if (typeof _setState !== 'function') {
      resolve(null);
      return;
    }
    if (typeof _resolve === 'function') {
      const prev = _resolve;
      _resolve = null;
      prev(null);
    }
    const seen = new Set();
    const uniqueNames = [];
    (fileNames || []).forEach((raw) => {
      const name = String(raw || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      uniqueNames.push(name);
    });
    _resolve = resolve;
    _setState({ open: true, fileNames: uniqueNames });
  });
}

function finish(value) {
  _resolve?.(value);
  _resolve = null;
  _setState?.({ open: false, fileNames: [] });
  scheduleDocumentInteractionRecovery();
}

export function _fileConflictReplace() { finish('replace'); }
export function _fileConflictKeepBoth() { finish('keep-both'); }
export function _fileConflictCancel() { finish(null); }
