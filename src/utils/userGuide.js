/**
 * Οδηγός νέου χρήστη — κείμενα, σειρά ροών και αποθήκευση πρώτης ξενάγησης.
 * Δεν ανοίγει αρχεία· μόνο αποφασίζει τι βλέπει κάθε ρόλος.
 */

export const USER_GUIDE_TOUR_KEY_PREFIX = 'ergohub_user_guide_tour_v1:';

export const TOUR_AUTO_ROLES = ['SUPERADMIN', 'ADMIN', 'ENGINEER'];

const ALL_GUIDE_ROLES = ['SUPERADMIN', 'ADMIN', 'ENGINEER', 'USER'];

export const TOUR_STEP_IDS = ['act-group', 'card-body', 'card-actions', 'detail-tabs'];

const ROLE_LABEL = {
  SUPERADMIN: 'υπεύθυνος συστήματος',
  ADMIN: 'διαχειριστής',
  ENGINEER: 'μηχανικός',
  USER: 'χρήστης ανάγνωσης',
};

export const TOUR_STEPS = [
  {
    id: 'act-group',
    target: '[data-user-guide="act-group"]',
    title: 'Η πράξη είναι η ομπρέλα',
    body: 'Στην κεντρική σελίδα τα υποέργα δεν είναι σκορπισμένα. Κάθε ομάδα είναι μία πράξη. Από κάτω είναι όλα τα υποέργα της, σε κάρτες.',
  },
  {
    id: 'card-body',
    target: '[data-user-guide="card-body"]',
    title: 'Η κάρτα μαζεύει τα βασικά',
    body: 'Ο σκοπός είναι όλη η βασική πληροφορία να είναι στο ίδιο σημείο. Η κάρτα του υποέργου δείχνει με μια ματιά τι είναι, πού βρίσκεται και τα κύρια ποσά.',
  },
  {
    id: 'card-actions',
    target: '[data-user-guide="card-actions"]',
    title: 'Τα κουμπιά ανοίγουν την αντίστοιχη σελίδα',
    body: 'Κάθε κουμπί σας μεταφέρει αυτόματα στην αντίστοιχη σελίδα — ένταξη, πρόσκληση, έγκριση διάθεσης πίστωσης ή μελέτη — και σας δείχνει την κάρτα που αφορά αυτό το υποέργο. Αν δεν υπάρχει τέτοια σύνδεση, το κουμπί απλώς δεν εμφανίζεται.',
  },
  {
    id: 'detail-tabs',
    target: '[data-user-guide="detail-tabs"]',
    title: 'Κλικ στην κάρτα — οι λεπτομέρειες',
    body: 'Όταν πατάτε πάνω στην κάρτα του υποέργου, ανοίγουν οι λεπτομέρειές του — όπως εδώ. Εκεί, σε δύο καρτέλες, έχετε εικόνα για το σύνολο των δεδομένων του υποέργου.',
    openDetail: true,
  },
];

export const GUIDE_SECTIONS = {
  structure: 'Δομή χαρτοφυλακίου',
  home: 'Κεντρική σελίδα',
  corner: 'Κουμπιά κάτω δεξιά',
  procedures: 'Διαδικασίες έργων',
  work: 'Χρέωση και εργασίες',
  more: 'Εξαγωγές και σύστημα',
};

const FLOW_DEFS = [
  {
    id: 'home',
    sectionId: 'structure',
    title: 'Να καταλάβω την αρχική οθόνη',
    body: 'Στην κεντρική σελίδα κάθε ομάδα είναι μία πράξη. Από κάτω είναι τα υποέργα της, σε κάρτες. Δεν είναι σκορπισμένη λίστα έργων.',
    points: [
      'Ο τίτλος της ομάδας είναι η πράξη.',
      'Κάθε κάρτα από κάτω είναι ένα υποέργο αυτής της πράξης.',
    ],
    target: '[data-user-guide="act-group"]',
  },
  {
    id: 'card',
    sectionId: 'structure',
    title: 'Να διαβάσω την κάρτα και τις λεπτομέρειες',
    body: 'Η κάρτα μαζεύει τα βασικά του υποέργου. Τα κουμπιά ανοίγουν την αντίστοιχη σελίδα με την κάρτα αυτού του υποέργου. Κλικ πάνω στην κάρτα ανοίγει τις λεπτομέρειες σε δύο καρτέλες.',
    points: [
      'Κουμπιά: ένταξη, πρόσκληση, έγκριση διάθεσης πίστωσης, μελέτη — μόνο αν υπάρχει σύνδεση.',
      'Κλικ στην κάρτα: δύο καρτέλες με το σύνολο των δεδομένων.',
    ],
    target: '[data-user-guide="subproject-card"]',
  },
  {
    id: 'files',
    sectionId: 'structure',
    title: 'Να βρω αρχεία',
    body: 'Τα αρχεία του ίδιου του υποέργου ανοίγουν από το κουμπί «Αρχεία υποέργου» κάτω στην κάρτα.',
    points: [
      'Αρχεία πρόσκλησης, ένταξης ή μελέτης: από το αντίστοιχο κουμπί της κάρτας.',
      'Η εφαρμογή σας δείχνει την κάρτα που αφορά αυτό το υποέργο — δεν ψάχνετε από την αρχή όλη τη λίστα.',
    ],
    target: '[data-user-guide="card-actions"]',
  },
  {
    id: 'role',
    sectionId: 'structure',
    title: 'Να καταλάβω τι επιτρέπεται στον ρόλο μου',
    bodyByRole: {
      SUPERADMIN: 'Ρυθμίζετε χρήστες και την εγκατάσταση, και έχετε ό,τι έχει ο διαχειριστής στο χαρτοφυλάκιο.',
      ADMIN: 'Ανοίγετε και αλλάζετε υποέργα, συνδέετε ένταξη / πρόσκληση / έγκριση / μελέτη και ανανεώνετε στοιχεία από ΚΗΜΔΗΣ.',
      ENGINEER: 'Βλέπετε τα υποέργα που σας έχουν χρεωθεί, τα αρχεία τους και τις εργασίες. Δεν στήνετε το χαρτοφυλάκιο.',
      USER: 'Βλέπετε την κατάσταση των υποέργων. Δεν αλλάζετε δεδομένα.',
    },
  },
  {
    id: 'overview',
    sectionId: 'home',
    title: 'Να διαβάσω τη σύνοψη στην κορυφή',
    body: 'Πάνω από τη λίστα, η ζώνη συνόψεως δείχνει πόσα έργα και υποέργα βλέπετε τώρα στην οθόνη — με τα φίλτρα που έχετε βάλει.',
    points: [
      'Δεν είναι όλο το αρχείο του δήμου αν έχετε φίλτρο ή αναζήτηση.',
      'Αναπτύξτε τη για περισσότερα νούμερα· συμπτύξτε τη για να δείτε αμέσως τις κάρτες.',
    ],
    target: '[data-user-guide="command-deck"]',
  },
  {
    id: 'search',
    sectionId: 'home',
    title: 'Να βρω ένα υποέργο με αναζήτηση',
    body: 'Στο πλευρικό μενού, «Αναζήτηση και φίλτρα». Γράφετε λέξη, κατάσταση ή είδος και η λίστα δείχνει μόνο όσα ταιριάζουν.',
    points: [
      'Ο καθαρισμός επαναφέρει όλη την κεντρική λίστα.',
      'Τα φίλτρα αλλάζουν και τα νούμερα της συνόψεως.',
    ],
    target: '[data-user-guide="search-panel"]',
  },
  {
    id: 'calendar',
    sectionId: 'home',
    title: 'Να ανοίξω το ημερολόγιο προθεσμιών',
    body: 'Στο πλευρικό μενού, «Ημερολόγιο προθεσμιών». Βλέπετε τις λήξεις σε ημερολόγιο — συμβάσεις, προσκλήσεις και ό,τι άλλο έχει καταχωρηθεί.',
    points: [
      'Για γρήγορη ματιά στις κοντινές λήξεις χρησιμοποιήστε και την κλεψύδρα κάτω δεξιά.',
    ],
    target: '[data-user-guide="calendar-nav"]',
    hideForRoles: ['USER'],
  },
  {
    id: 'create',
    sectionId: 'home',
    title: 'Να προσθέσω νέο υποέργο',
    body: 'Στο πλευρικό μενού, το κουμπί δημιουργίας ανοίγει τη φόρμα νέου υποέργου. Το υποέργο μπαίνει στην πράξη που θα ορίσετε.',
    target: '[data-user-guide="create-nav"]',
    requiresAdmin: true,
  },
  {
    id: 'archive',
    sectionId: 'home',
    title: 'Να δω ολοκληρωμένα και αποπληρωμένα',
    body: 'Στο πλευρικό μενού μπορείτε να εμφανίσετε τα υποέργα που έχουν ολοκληρωθεί και αποπληρωθεί. Από προεπιλογή η κεντρική λίστα δείχνει τα ενεργά.',
    target: '[data-user-guide="archive-nav"]',
  },
  {
    id: 'deadlines',
    sectionId: 'corner',
    title: 'Να δω τι λήγει σύντομα',
    body: 'Κάτω δεξιά, το κουμπί με την κλεψύδρα είναι το ραντάρ προθεσμιών όλου του χαρτοφυλακίου — όχι μόνο του υποέργου που κοιτάτε.',
    points: [
      'Το κόκκινο σήμα δείχνει πόσες λήξεις βρίσκονται στο ραντάρ.',
      'Από εκεί μπορείτε να ανοίξετε το σχετικό υποέργο ή το ημερολόγιο.',
    ],
    target: '[data-user-guide="deadline-fab"]',
  },
  {
    id: 'khmdhs',
    sectionId: 'corner',
    title: 'Να ενημερώσω στοιχεία από ΚΗΜΔΗΣ',
    body: 'Κάτω δεξιά, το κυκλικό κουμπί με τα βελάκια τραβά τα ηλεκτρονικά στοιχεία των συμβάσεων για πολλά υποέργα μαζί.',
    points: [
      'Δεν σβήνει κάρτες ούτε αντικαθιστά αρχεία.',
      'Πατήστε το όταν θέλετε μαζική ανανέωση — όχι σε κάθε μικρή αλλαγή.',
    ],
    target: '[data-user-guide="khmdhs-fab"]',
    requiresKhmdhs: true,
  },
  {
    id: 'notes',
    sectionId: 'corner',
    title: 'Να αφήσω μια γρήγορη σημείωση',
    body: 'Κάτω δεξιά, το μωβ κουμπί με το μολύβι ανοίγει τις γρήγορες σημειώσεις. Μπορείτε να τις συνδέσετε με υποέργο, ένταξη ή άλλη εγγραφή.',
    target: '[data-user-guide="notes-fab"]',
    hideForRoles: ['USER'],
  },
  {
    id: 'entaxis',
    sectionId: 'procedures',
    title: 'Να δω τις εντάξεις',
    body: 'Στο πλευρικό μενού, «Διαδικασίες έργων» → «Εντάξεις έργων». Εκεί είναι όλες οι εντάξεις. Από την κάρτα υποέργου, το κουμπί «Ένταξη» σας πάει κατευθείαν στην κάρτα ένταξης αυτού του υποέργου.',
    target: '[data-user-guide="nav-entaxis"]',
    expandCategory: 'management',
    hideForRoles: ['USER'],
  },
  {
    id: 'proskliseis',
    sectionId: 'procedures',
    title: 'Να δω τις προσκλήσεις',
    body: 'Στο πλευρικό μενού, «Προσκλήσεις». Από την κάρτα υποέργου, το κουμπί «Πρόσκληση» ανοίγει την πρόσκληση που συνδέεται με αυτό το υποέργο.',
    target: '[data-user-guide="nav-proskliseis"]',
    expandCategory: 'management',
    hideForRoles: ['USER'],
  },
  {
    id: 'egkriseis',
    sectionId: 'procedures',
    title: 'Να δω τις εγκρίσεις διάθεσης πίστωσης',
    body: 'Στο πλευρικό μενού, «Εγκρίσεις διάθεσης πίστωσης». Από την κάρτα υποέργου, το αντίστοιχο κουμπί σας δείχνει την έγκριση αυτού του υποέργου.',
    target: '[data-user-guide="nav-egkriseis"]',
    expandCategory: 'management',
    hideForRoles: ['USER'],
  },
  {
    id: 'orimanthi',
    sectionId: 'procedures',
    title: 'Να δω την ωρίμανση έργων',
    body: 'Στο πλευρικό μενού, «Ωρίμανση έργων». Είναι η βάση όπου καταγράφεται η ωρίμανση — πριν ή παράλληλα με την πορεία του υποέργου στο χαρτοφυλάκιο.',
    target: '[data-user-guide="nav-orimanthi"]',
    expandCategory: 'management',
    hideForRoles: ['USER'],
  },
  {
    id: 'meletai',
    sectionId: 'procedures',
    title: 'Να δω το μητρώο μελετών',
    body: 'Στο πλευρικό μενού, «Μητρώο μελετών». Από την κάρτα υποέργου, το κουμπί «Μελέτη» ανοίγει τη μελέτη που συνδέεται με αυτό το υποέργο.',
    target: '[data-user-guide="nav-meletai"]',
    expandCategory: 'management',
    hideForRoles: ['USER'],
  },
  {
    id: 'ep-program',
    sectionId: 'procedures',
    title: 'Να δω το επιχειρησιακό πρόγραμμα',
    body: 'Στο πλευρικό μενού, «Επιχειρησιακό πρόγραμμα». Εκεί συνδέονται δράσεις και προϋπολογισμοί του προγράμματος — όχι η καθημερινή κάρτα του υποέργου.',
    target: '[data-user-guide="nav-ep"]',
    expandCategory: 'management',
    requiresAdmin: true,
  },
  {
    id: 'charge',
    sectionId: 'work',
    titleByRole: {
      ENGINEER: 'Να καταλάβω γιατί βλέπω αυτά τα έργα',
      default: 'Να χρεώσω μηχανικό σε υποέργο',
    },
    bodyByRole: {
      ENGINEER: 'Βλέπετε όσα υποέργα σας έχουν χρεωθεί. Στην κάρτα φαίνεται ο επιβλέπων. Αν λείπει κάποιο, μιλήστε με διαχειριστή.',
      default: 'Στην κάρτα ή στις λεπτομέρειες ορίζετε ποιος μηχανικός βλέπει το υποέργο. Αυτός βλέπει μετά μόνο τα χρεωμένα του.',
    },
    target: '[data-user-guide="card-charge"]',
    fallbackTarget: '[data-user-guide="subproject-card"]',
    hideForRoles: ['USER'],
  },
  {
    id: 'tasks',
    sectionId: 'work',
    title: 'Να δώσω ή να δω μια εργασία',
    body: 'Στο πλευρικό μενού, «Χώρος εργασίας». Οι εργασίες είναι αναθέσεις μεταξύ συναδέλφων — οδηγίες, αρχεία και παράδοση. Δεν είναι η κάρτα του υποέργου.',
    points: [
      '«Άνοιγμα χώρου εργασιών»: τρέχουσες αναθέσεις.',
      '«Αποθήκη εργασιών»: όσες έχουν κλείσει.',
    ],
    target: '[data-user-guide="tasks-nav"]',
    expandCategory: 'assignments',
    hideForRoles: ['USER'],
  },
  {
    id: 'exports',
    sectionId: 'more',
    title: 'Να εξάγω στοιχεία ή αναφορά',
    body: 'Στο πλευρικό μενού, «Εξαγωγές»: τεχνικό πρόγραμμα, πύλη διαφάνειας, εξαγωγή δεδομένων και αναφορές σε PDF — ανάλογα με τα δικαιώματά σας.',
    target: '[data-user-guide="exports-nav"]',
    expandCategory: 'exports',
    requiresAdmin: true,
  },
  {
    id: 'backup',
    sectionId: 'more',
    title: 'Να πάρω αντίγραφο ασφαλείας',
    body: 'Στο πλευρικό μενού, «Σύστημα» → «Αντίγραφα ασφαλείας». Κρατήστε αντίγραφο σε τακτά διαστήματα, ώστε τα δεδομένα του δήμου να μην χαθούν από βλάβη ή λάθος.',
    target: '[data-user-guide="nav-backup"]',
    expandCategory: 'system',
    requiresAdmin: true,
  },
  {
    id: 'notifications',
    sectionId: 'more',
    title: 'Να ρυθμίσω ειδοποιήσεις',
    body: 'Στο πλευρικό μενού, «Κέντρο ειδοποιήσεων». Εκεί ορίζονται υπενθυμίσεις (π.χ. προθεσμίες) και το ηλεκτρονικό ταχυδρομείο του συστήματος.',
    target: '[data-user-guide="nav-notifications"]',
    expandCategory: 'system',
    requiresAdmin: true,
  },
];

export function tourStorageKey(username) {
  return `${USER_GUIDE_TOUR_KEY_PREFIX}${String(username || '').trim().toLowerCase()}`;
}

export function isTourDone(username, storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !username) return false;
    return store.getItem(tourStorageKey(username)) === '1';
  } catch {
    return false;
  }
}

export function markTourDone(username, storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !username) return;
    store.setItem(tourStorageKey(username), '1');
  } catch {
    /* αγνόησε αποτυχία αποθήκευσης */
  }
}

export function shouldAutoStartTour({ username, role, loading, storage } = {}) {
  if (loading) return false;
  if (!username) return false;
  if (!TOUR_AUTO_ROLES.includes(role)) return false;
  return !isTourDone(username, storage);
}

function pickByRole(map, role) {
  if (!map || typeof map !== 'object') return '';
  if (map[role]) return map[role];
  if (map.default) return map.default;
  return '';
}

export function visibleGuideFlows({ role, canManageKhmdhs = false } = {}) {
  const safeRole = ALL_GUIDE_ROLES.includes(role) ? role : 'USER';
  const isAdmin = safeRole === 'ADMIN' || safeRole === 'SUPERADMIN';
  return FLOW_DEFS
    .filter((flow) => {
      if (flow.requiresKhmdhs && !canManageKhmdhs) return false;
      if (flow.requiresAdmin && !isAdmin) return false;
      if (Array.isArray(flow.hideForRoles) && flow.hideForRoles.includes(safeRole)) return false;
      return true;
    })
    .map((flow) => ({
      id: flow.id,
      sectionId: flow.sectionId,
      sectionTitle: GUIDE_SECTIONS[flow.sectionId] || '',
      title: flow.title || pickByRole(flow.titleByRole, safeRole),
      body: flow.body || pickByRole(flow.bodyByRole, safeRole),
      points: Array.isArray(flow.points) ? flow.points.slice() : [],
      target: flow.target || null,
      fallbackTarget: flow.fallbackTarget || null,
      startTour: !!flow.startTour,
      expandCategory: flow.expandCategory || null,
    }));
}

export function groupedGuideFlows(opts) {
  const flows = visibleGuideFlows(opts);
  const groups = [];
  flows.forEach((flow) => {
    const last = groups[groups.length - 1];
    if (!last || last.id !== flow.sectionId) {
      groups.push({
        id: flow.sectionId,
        title: flow.sectionTitle,
        flows: [flow],
      });
    } else {
      last.flows.push(flow);
    }
  });
  return groups;
}

export function roleGuideLabel(role) {
  return ROLE_LABEL[role] || ROLE_LABEL.USER;
}

export function getTourSteps() {
  return TOUR_STEPS.map((step) => ({ ...step }));
}

/** Κενό κάτω από το σταθερό καπέλο, ώστε το φωτισμένο σημείο να μην κρύβεται. */
export const GUIDE_HEADER_OFFSET_PX = 100;
/** Κενό πάνω από την κάρτα οδηγού στο κάτω μέρος. */
export const GUIDE_BOTTOM_RESERVE_PX = 280;

/**
 * Νέο scrollTop ώστε το στοχευμένο στοιχείο να χωράει στο ορατό παράθυρο
 * (κάτω από το καπέλο, πάνω από την κάρτα οδηγού).
 */
export function computeGuideTargetScrollTop({
  elementTop,
  elementHeight,
  viewportHeight,
  headerOffset = GUIDE_HEADER_OFFSET_PX,
  bottomReserve = GUIDE_BOTTOM_RESERVE_PX,
  currentScroll = 0,
  maxScroll = Number.POSITIVE_INFINITY,
} = {}) {
  if (!Number.isFinite(Number(elementTop)) || !Number.isFinite(Number(elementHeight))) {
    return currentScroll;
  }
  const vh = Number(viewportHeight) > 0 ? Number(viewportHeight) : 800;
  const visibleTop = Math.max(0, Number(headerOffset) || 0);
  const visibleBottom = Math.max(visibleTop + 80, vh - Math.max(0, Number(bottomReserve) || 0));
  const visibleHeight = visibleBottom - visibleTop;
  const top = Number(elementTop);
  const height = Number(elementHeight);
  const bottom = top + height;
  const isTall = height > visibleHeight * 0.85;

  let desiredTop;
  if (isTall) {
    desiredTop = visibleTop + 12;
  } else {
    const alreadyInView = top >= visibleTop + 8 && bottom <= visibleBottom - 8;
    if (alreadyInView) return currentScroll;
    desiredTop = visibleTop + Math.max(12, (visibleHeight - height) / 2);
  }

  const next = Number(currentScroll) + (top - desiredTop);
  const max = Number.isFinite(Number(maxScroll)) ? Number(maxScroll) : next;
  const clamped = Math.max(0, Math.min(max, next));
  if (Math.abs(clamped - Number(currentScroll)) < 8) return currentScroll;
  return clamped;
}

export function getGuideScrollParent(el) {
  if (!el || typeof window === 'undefined') return null;
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && node.scrollHeight > node.clientHeight + 4;
    if (canScroll) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * Κυλάει το σωστό δοχείο ώστε ο στόχος του οδηγού να φαίνεται στο παράθυρο.
 * Το elementTop μετράται ως προς την οθόνη (getBoundingClientRect),
 * ώστε να λογαριάζονται το σταθερό καπέλο και η κάρτα οδηγού.
 * @returns {{ ok: boolean, scrolled: boolean }}
 */
export function scrollGuideTargetIntoView(selector, options = {}) {
  if (!selector || typeof document === 'undefined') return { ok: false, scrolled: false };
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return { ok: false, scrolled: false };
  const parent = getGuideScrollParent(el);
  if (!parent) return { ok: false, scrolled: false };
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return { ok: false, scrolled: false };

  const maxScroll = Math.max(0, parent.scrollHeight - parent.clientHeight);
  const next = computeGuideTargetScrollTop({
    elementTop: rect.top,
    elementHeight: rect.height,
    viewportHeight: window.innerHeight || 800,
    headerOffset: options.headerOffset ?? GUIDE_HEADER_OFFSET_PX,
    bottomReserve: options.bottomReserve ?? GUIDE_BOTTOM_RESERVE_PX,
    currentScroll: parent.scrollTop || 0,
    maxScroll,
  });

  if (next === (parent.scrollTop || 0)) return { ok: true, scrolled: false };
  if (typeof parent.scrollTo === 'function') {
    parent.scrollTo({ top: next, behavior: options.behavior || 'smooth' });
  } else {
    parent.scrollTop = next;
  }
  return { ok: true, scrolled: true };
}
