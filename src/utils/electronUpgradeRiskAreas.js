/**
 * Κατάλογος περιοχών κινδύνου για αναβάθμιση Electron (E1).
 * Χρησιμοποιείται ως «χάρτης» για checklist / μελλοντικά smoke tests.
 * Δεν εκτελεί upgrade — μόνο τεκμηριώνει τι πρέπει να ελεγχθεί.
 */

export const ELECTRON_UPGRADE_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/** @type {ReadonlyArray<{ id: string, severity: string, title: string, why: string, smokeRequired: boolean }>} */
export const ELECTRON_UPGRADE_RISK_AREAS = Object.freeze([
  {
    id: 'app-boot',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Άνοιγμα εφαρμογής',
    why: 'GPU flags, sandbox, loadFile/asar',
    smokeRequired: true,
  },
  {
    id: 'login',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Είσοδος χρήστη',
    why: 'Πρώτη διαδρομή μετά το boot',
    smokeRequired: true,
  },
  {
    id: 'project-list',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Λίστα υποέργων / κοινός φάκελος',
    why: 'Κρίσιμο για καθημερινή χρήση δήμου',
    smokeRequired: true,
  },
  {
    id: 'save-lock',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Αποθήκευση και κλείδωμα υποέργου',
    why: 'Ακεραιότητα δεδομένων + συνεργασία',
    smokeRequired: true,
  },
  {
    id: 'native-dialogs',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Διάλογοι αρχείων Windows + εστίαση',
    why: 'Γνωστό ευαίσθητο σημείο Electron',
    smokeRequired: true,
  },
  {
    id: 'khmdhs-fetch',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Ανάκτηση ΚΗΜΔΗΣ',
    why: 'Δίκτυο HTTPS / PDF συνημμένων',
    smokeRequired: true,
  },
  {
    id: 'pdf-view',
    severity: ELECTRON_UPGRADE_SEVERITY.CRITICAL,
    title: 'Προβολή PDF',
    why: 'webSecurity / Chromium / pdf.js',
    smokeRequired: true,
  },
  {
    id: 'email-safestorage',
    severity: ELECTRON_UPGRADE_SEVERITY.HIGH,
    title: 'Email / safeStorage',
    why: 'Κρυπτογράφηση κωδικού SMTP',
    smokeRequired: true,
  },
  {
    id: 'portable-build',
    severity: ELECTRON_UPGRADE_SEVERITY.HIGH,
    title: 'Build portable .exe',
    why: 'electron-builder + νέα στοίβα',
    smokeRequired: true,
  },
  {
    id: 'updater',
    severity: ELECTRON_UPGRADE_SEVERITY.HIGH,
    title: 'Αυτόματη ενημέρωση',
    why: 'Επανεκκίνηση / εγκατάσταση',
    smokeRequired: false,
  },
  {
    id: 'notifications',
    severity: ELECTRON_UPGRADE_SEVERITY.MEDIUM,
    title: 'Ειδοποιήσεις συστήματος',
    why: 'Notification API',
    smokeRequired: false,
  },
  {
    id: 'single-instance',
    severity: ELECTRON_UPGRADE_SEVERITY.MEDIUM,
    title: 'Ένα στιγμιότυπο εφαρμογής',
    why: 'requestSingleInstanceLock',
    smokeRequired: false,
  },
  {
    id: 'crash-handler',
    severity: ELECTRON_UPGRADE_SEVERITY.MEDIUM,
    title: 'Χειρισμός crash παραθύρου',
    why: 'crashed → render-process-gone σε νεότερα Electron',
    smokeRequired: false,
  },
  {
    id: 'preload-bridge',
    severity: ELECTRON_UPGRADE_SEVERITY.LOW,
    title: 'Preload allowlist',
    why: 'Ήδη σωστό μοτίβο contextBridge',
    smokeRequired: false,
  },
]);

export function getSmokeRequiredRiskAreas() {
  return ELECTRON_UPGRADE_RISK_AREAS.filter((a) => a.smokeRequired);
}

export function getCriticalRiskAreas() {
  return ELECTRON_UPGRADE_RISK_AREAS.filter(
    (a) => a.severity === ELECTRON_UPGRADE_SEVERITY.CRITICAL
  );
}

/** Προτεινόμενες φάσεις αναβάθμισης (όχι άλμα 25→τελευταίο). */
export const ELECTRON_UPGRADE_PHASES = Object.freeze([
  { id: 'A', from: 25, to: 28, label: 'Πρώτο σκαλοπάτι', status: 'passed' },
  { id: 'B', from: 28, to: 33, label: 'Ορόσημο Node 20 / Chromium 130', status: 'pending' },
  { id: 'C', from: 33, to: 'supported', label: 'Τρέχουσα υποστηριζόμενη γραμμή (π.χ. 40+)', status: 'pending' },
]);

export const CURRENT_ELECTRON_MAJOR = 28;

/** Προηγούμενη σταθερή γραμμή παραγωγής (επιστροφή αν αποτύχει η φάση). */
export const ELECTRON_ROLLBACK_MAJOR = 25;
