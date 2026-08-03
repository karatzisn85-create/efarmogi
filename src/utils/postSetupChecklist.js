/**
 * Checklist ολοκλήρωσης μετά την πρώτη εγκατάσταση (SUPERADMIN).
 * Email · Αντίγραφα · Πύλη Διαφάνειας
 */

export const POST_SETUP_DISMISS_KEY = 'ergohub_post_setup_checklist_dismissed_at';
export const POST_SETUP_DISMISS_DAYS = 30;

export const POST_SETUP_ITEM = {
  EMAIL: 'email',
  BACKUP: 'backup',
  PORTAL: 'portal',
};

/**
 * @param {{ emailConfigured?: boolean, hasBackup?: boolean, portalConfigured?: boolean }} status
 */
export function buildPostSetupItems(status = {}) {
  return [
    {
      id: POST_SETUP_ITEM.EMAIL,
      title: 'Email ειδοποιήσεων',
      why: 'Χωρίς αυτό, υπενθυμίσεις και ειδοποιήσεις χώρου εργασίας δεν φτάνουν στο inbox.',
      done: !!status.emailConfigured,
      actionLabel: 'Ρύθμιση Email',
    },
    {
      id: POST_SETUP_ITEM.BACKUP,
      title: 'Αντίγραφο ασφαλείας',
      why: 'Προστατεύει τα δεδομένα του δήμου σε περίπτωση βλάβης ή λάθους.',
      done: !!status.hasBackup,
      actionLabel: 'Αντίγραφα ασφαλείας',
    },
    {
      id: POST_SETUP_ITEM.PORTAL,
      title: 'Πύλη Διαφάνειας',
      why: 'Επιτρέπει δημόσια δημοσίευση επιλεγμένων στοιχείων έργων.',
      done: !!status.portalConfigured,
      actionLabel: 'Άνοιγμα Πύλης',
    },
  ];
}

export function isPortalConfigured(appConfig = {}) {
  const enabled = appConfig.portalEnabled === true;
  const uid = String(appConfig.portalDimosUid || '').trim();
  return enabled && !!uid;
}

export function countIncompletePostSetupItems(items) {
  return (items || []).filter((i) => !i.done).length;
}

export function isPostSetupChecklistComplete(items) {
  return countIncompletePostSetupItems(items) === 0;
}

/** Απόκρυψη μετά από χειροκίνητο dismiss για N ημέρες */
export function isPostSetupChecklistDismissed(now = Date.now(), storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    const raw = store.getItem(POST_SETUP_DISMISS_KEY);
    if (!raw) return false;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return false;
    const ms = POST_SETUP_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return now - ts < ms;
  } catch {
    return false;
  }
}

export function dismissPostSetupChecklist(storage = null, now = Date.now()) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    const ts = typeof now === 'number' ? now : Date.now();
    store.setItem(POST_SETUP_DISMISS_KEY, new Date(ts).toISOString());
  } catch {
    /* ignore */
  }
}

export function clearPostSetupChecklistDismiss(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    store.removeItem(POST_SETUP_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Εμφάνιση μόνο για SUPERADMIN, αν υπάρχουν εκκρεμή και δεν έχει γίνει dismiss.
 */
export function shouldShowPostSetupChecklist({
  userRole,
  items,
  dismissed = null,
  now = Date.now(),
} = {}) {
  if (userRole !== 'SUPERADMIN') return false;
  if (isPostSetupChecklistComplete(items)) return false;
  const isDismissed = dismissed == null
    ? isPostSetupChecklistDismissed(now)
    : !!dismissed;
  if (isDismissed) return false;
  return true;
}
