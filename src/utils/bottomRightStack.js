/**
 * Κοινές σταθερές για τη γωνία κάτω-δεξιά (FAB + toast + ειδοποιήσεις εργασιών).
 * Στόχος: να μην επικαλύπτονται μεταξύ τους ούτε με τα αιωρούμενα κουμπιά.
 */

export const CORNER_CLEARANCE_VAR = '--ergohub-corner-clearance';
export const TASK_TOAST_LIFT_VAR = '--ergohub-task-toast-lift';

export const DEFAULT_CORNER_BOTTOM_PX = 24;
export const NOTES_FAB_BOTTOM_PX = 24;
export const NOTES_FAB_SIZE_PX = 50;
export const FAB_GAP_PX = 12;
/** Κάτω άκρο στοίβας ops (= NotesFab bottom + size + gap). */
export const OPS_STACK_BOTTOM_PX = NOTES_FAB_BOTTOM_PX + NOTES_FAB_SIZE_PX + FAB_GAP_PX;
export const OPS_FAB_SIZE_PX = 50;
export const KHMDHS_FAB_SIZE_PX = 58;
export const HELP_FAB_SIZE_PX = 50;
export const TOAST_STACK_GAP_PX = 10;

/**
 * Υπολογίζει το bottom offset (px) από όπου ξεκινούν οι ειδοποιήσεις,
 * ώστε να μένουν πάνω από NotesFab + OpsFabStack.
 */
export function computeFabClearancePx({
  notesVisible = false,
  opsVisible = false,
  khmdhsVisible = false,
  helpVisible = false,
} = {}) {
  if (!notesVisible && !opsVisible) {
    return DEFAULT_CORNER_BOTTOM_PX;
  }
  if (opsVisible) {
    let top = OPS_STACK_BOTTOM_PX + OPS_FAB_SIZE_PX;
    if (khmdhsVisible) {
      top += FAB_GAP_PX + KHMDHS_FAB_SIZE_PX;
    }
    if (helpVisible) {
      top += FAB_GAP_PX + HELP_FAB_SIZE_PX;
    }
    return top + FAB_GAP_PX;
  }
  return NOTES_FAB_BOTTOM_PX + NOTES_FAB_SIZE_PX + FAB_GAP_PX;
}

export function setCornerClearancePx(px) {
  if (typeof document === 'undefined') return;
  const value = Number.isFinite(Number(px)) ? Math.max(0, Math.round(Number(px))) : DEFAULT_CORNER_BOTTOM_PX;
  document.documentElement.style.setProperty(CORNER_CLEARANCE_VAR, `${value}px`);
}

export function clearCornerClearance() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty(CORNER_CLEARANCE_VAR);
}

export function setTaskToastLiftPx(px) {
  if (typeof document === 'undefined') return;
  const value = Number.isFinite(Number(px)) ? Math.max(0, Math.round(Number(px))) : 0;
  document.documentElement.style.setProperty(TASK_TOAST_LIFT_VAR, `${value}px`);
}

export function clearTaskToastLift() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty(TASK_TOAST_LIFT_VAR);
}
