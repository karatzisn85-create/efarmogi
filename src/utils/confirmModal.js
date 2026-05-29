/**
 * Promise-based global confirm modal.
 *
 * Usage:
 *   const ok = await showConfirm({ title: 'Διαγραφή', message: '...' });
 *   if (ok) { ... }
 *
 * Options:
 *   title        – heading text          (default: 'Επιβεβαίωση')
 *   message      – main body text        (required)
 *   detail       – secondary/muted text  (optional)
 *   confirmLabel – label for OK button   (default: 'Επιβεβαίωση')
 *   cancelLabel  – label for cancel btn  (default: 'Άκυρο')
 *   danger       – red confirm button    (default: true)
 *   icon         – emoji shown in badge  (default: '⚠️')
 */

import { scheduleDocumentInteractionRecovery } from './documentInteractionReset';

let _setState = null;
let _resolve  = null;

/** Called once by <ConfirmModal> on mount to register its setState. */
export function _registerConfirmModal(setState) {
  _setState = setState;
}

export function showConfirm({
  title        = 'Επιβεβαίωση',
  message,
  detail,
  confirmLabel = 'Επιβεβαίωση',
  cancelLabel  = 'Άκυρο',
  danger       = true,
  icon         = '🗑',
} = {}) {
  return new Promise((resolve) => {
    _resolve = resolve;
    _setState?.({ open: true, title, message, detail, confirmLabel, cancelLabel, danger, icon });
  });
}

export function _confirmYes() {
  _resolve?.(true);
  _resolve = null;
  _setState?.({ open: false });
  scheduleDocumentInteractionRecovery();
}

export function _confirmNo() {
  _resolve?.(false);
  _resolve = null;
  _setState?.({ open: false });
  scheduleDocumentInteractionRecovery();
}
