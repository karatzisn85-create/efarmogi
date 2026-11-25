/**
 * Promise-based modal αποθήκευσης PDF — αντικαθιστά το native overwrite prompt των Windows.
 *
 * @returns {Promise<{ canceled: true } | { path: string }>}
 */

import { scheduleDocumentInteractionRecovery } from './documentInteractionReset';

let _setState = null;
let _resolve = null;
let _pausedBy = null;

export function _registerSavePdfDialog(setState) {
  _setState = setState;
}

export function showSavePdfDialog({
  defaultName = 'ERGOHUB_Report.pdf',
  title = 'Αποθήκευση αναφοράς PDF',
  subtitle = '',
  mode = 'pdf',
} = {}) {
  return new Promise((resolve) => {
    if (typeof _resolve === 'function') {
      const prev = _resolve;
      _resolve = null;
      prev({ canceled: true });
    }
    _pausedBy = null;
    _resolve = resolve;
    _setState?.({
      open: true,
      step: 'form',
      defaultName,
      title,
      subtitle,
      mode: mode === 'folder' ? 'folder' : 'pdf',
    });
  });
}

export function _savePdfDialogPause(owner) {
  if (!_resolve) return;
  _pausedBy = owner || 'window';
  _setState?.((prev) => (prev?.open ? { ...prev, paused: true } : prev));
}

export function _savePdfDialogResume(owner) {
  if (_pausedBy !== owner) return;
  _pausedBy = null;
  _setState?.((prev) => (prev?.open ? { ...prev, paused: false } : prev));
}

export function _savePdfDialogDismiss(owner) {
  if (_pausedBy && _pausedBy !== owner) return;
  if (!_resolve) return;
  _savePdfDialogCancel();
}

export function _savePdfDialogCancel() {
  if (!_resolve) return;
  _pausedBy = null;
  _resolve?.({ canceled: true });
  _resolve = null;
  _setState?.({ open: false });
  scheduleDocumentInteractionRecovery();
}

export function _savePdfDialogComplete(path) {
  _resolve?.({ path });
  _resolve = null;
  _setState?.({ open: false });
  scheduleDocumentInteractionRecovery();
}

export function _savePdfDialogSetStep(step, extra = {}) {
  _setState?.((prev) => (prev.open ? { ...prev, step, ...extra } : prev));
}
