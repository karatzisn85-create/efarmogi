/**
 * Promise-based modal αποθήκευσης PDF — αντικαθιστά το native overwrite prompt των Windows.
 *
 * @returns {Promise<{ canceled: true } | { path: string }>}
 */

import { scheduleDocumentInteractionRecovery } from './documentInteractionReset';

let _setState = null;
let _resolve = null;

export function _registerSavePdfDialog(setState) {
  _setState = setState;
}

export function showSavePdfDialog({
  defaultName = 'ERGOHUB_Report.pdf',
  title = 'Αποθήκευση αναφοράς PDF',
  subtitle = '',
} = {}) {
  return new Promise((resolve) => {
    _resolve = resolve;
    _setState?.({
      open: true,
      step: 'form',
      defaultName,
      title,
      subtitle,
    });
  });
}

export function _savePdfDialogCancel() {
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
