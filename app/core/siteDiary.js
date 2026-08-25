/**
 * Ημερολόγιο Εργοταξίου: ποιος βλέπει / γράφει, έλεγχος εγγραφής επίσκεψης,
 * καταστάσεις πορείας, φρεσκάδα τελευταίας επίσκεψης, αναζήτηση και φίλτρα.
 * Καθαρή λογική — χωρίς αποθήκευση στον δίσκο και χωρίς React.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSiteDiary = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SITE_DIARY_DIR_NAME = 'ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΟΤΑΞΙΟΥ';

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  var NOTES_MAX = 8000;
  var ORDER_MAX = 4000;

  /** Καταστάσεις υποέργου όπου υπάρχει (ή υπήρξε) εργοτάξιο προς επίβλεψη. */
  var SITE_ACTIVE_STATUSES = [
    'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ'
  ];

  /**
   * Πορεία εργασιών. Τα tones αντιστοιχούν στη γλώσσα χρωμάτων που ήδη
   * χρησιμοποιεί η εφαρμογή (κατάσταση υποέργου, προθεσμίες ημερολογίου).
   */
  var PROGRESS_STATES = [
    { key: 'normal', label: 'Κανονική πορεία', short: 'Κανονική', tone: 'success', icon: '✓' },
    { key: 'delay', label: 'Καθυστέρηση', short: 'Καθυστέρηση', tone: 'warning', icon: '!' },
    { key: 'stopped', label: 'Διακοπή εργασιών', short: 'Διακοπή', tone: 'danger', icon: '■' },
    { key: 'no_crew', label: 'Δεν υπήρχε συνεργείο', short: 'Χωρίς συνεργείο', tone: 'neutral', icon: '–' }
  ];

  var DEFAULT_PROGRESS = 'normal';

  var PROGRESS_TONE_COLORS = {
    success: { bg: '#d1fae5', text: '#064e3b', border: '#6ee7b7', dot: '#059669' },
    warning: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', dot: '#f59e0b' },
    danger: { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5', dot: '#dc2626' },
    neutral: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1', dot: '#64748b' }
  };

  /** Φρεσκάδα τελευταίας επίσκεψης — ίδια λογική «επείγοντος» με το ημερολόγιο προθεσμιών. */
  var RECENCY_FRESH_MAX_DAYS = 7;
  var RECENCY_AGING_MAX_DAYS = 21;

  var RECENCY_TONE_COLORS = {
    fresh: { bg: '#d1fae5', text: '#064e3b', border: '#6ee7b7', dot: '#059669' },
    aging: { bg: '#ffedd5', text: '#7c2d12', border: '#fdba74', dot: '#ea580c' },
    stale: { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5', dot: '#dc2626' },
    none: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#94a3b8' }
  };

  function progressState(key) {
    var k = String(key || '').trim() || DEFAULT_PROGRESS;
    for (var i = 0; i < PROGRESS_STATES.length; i += 1) {
      if (PROGRESS_STATES[i].key === k) return PROGRESS_STATES[i];
    }
    return PROGRESS_STATES[0];
  }

  function progressColors(key) {
    return PROGRESS_TONE_COLORS[progressState(key).tone] || PROGRESS_TONE_COLORS.neutral;
  }

  function recencyColors(tone) {
    return RECENCY_TONE_COLORS[tone] || RECENCY_TONE_COLORS.none;
  }

  function isValidProgress(key) {
    var k = String(key || '').trim();
    for (var i = 0; i < PROGRESS_STATES.length; i += 1) {
      if (PROGRESS_STATES[i].key === k) return true;
    }
    return false;
  }

  // ── Ημερομηνίες (τοπική ώρα — ποτέ toISOString, που μετατοπίζει τη μέρα) ──

  function toLocalDateString(value) {
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function todayIso(now) {
    return toLocalDateString(now || new Date());
  }

  function parseIsoDate(value) {
    var s = String(value || '').trim().slice(0, 10);
    if (!DATE_RE.test(s)) return null;
    var parts = s.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return null;
    return d;
  }

  /** Θετικός αριθμός = πόσες ημέρες πέρασαν από τη `fromIso` μέχρι τη `toIso`. */
  function daysSince(fromIso, toIso) {
    var from = parseIsoDate(fromIso);
    var to = parseIsoDate(toIso || todayIso());
    if (!from || !to) return null;
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  function recencyTone(lastVisitDate, today) {
    var diff = daysSince(lastVisitDate, today);
    if (diff === null) return 'none';
    if (diff < 0) return 'fresh';
    if (diff <= RECENCY_FRESH_MAX_DAYS) return 'fresh';
    if (diff <= RECENCY_AGING_MAX_DAYS) return 'aging';
    return 'stale';
  }

  function recencyLabel(lastVisitDate, today) {
    var diff = daysSince(lastVisitDate, today);
    if (diff === null) return 'Καμία επίσκεψη';
    if (diff <= 0) return 'Σήμερα';
    if (diff === 1) return 'Χθες';
    return 'Πριν ' + diff + ' ημέρες';
  }

  // ── Ρόλοι ──

  function canViewSiteDiary(role) {
    return role === 'SUPERADMIN' || role === 'ADMIN' || role === 'ENGINEER';
  }

  function canWriteSiteDiary(role) {
    return role === 'SUPERADMIN' || role === 'ENGINEER';
  }

  function showSiteDiaryButton(role) {
    return canViewSiteDiary(role);
  }

  function isSiteDiaryReadOnly(role) {
    return canViewSiteDiary(role) && !canWriteSiteDiary(role);
  }

  function subprojectInEngineerScope(visibleSubprojectIds, subprojectId) {
    var sid = String(subprojectId || '').trim();
    if (!sid) return false;
    if (!visibleSubprojectIds) return false;
    if (typeof visibleSubprojectIds.has === 'function') return visibleSubprojectIds.has(sid);
    return (visibleSubprojectIds || []).indexOf(sid) !== -1;
  }

  /**
   * Ο μηχανικός βλέπει τα ημερολόγια των υποέργων που του είναι χρεωμένα —
   * μαζί με τις επισκέψεις συναδέλφων στο ίδιο εργοτάξιο, ώστε η επίβλεψη
   * να έχει ενιαία ιστορία. Διαχειριστές και υπερδιαχειριστής βλέπουν τα πάντα.
   */
  function canViewSubprojectDiary(input) {
    var o = input || {};
    if (!canViewSiteDiary(o.role)) return false;
    if (o.role !== 'ENGINEER') return true;
    return subprojectInEngineerScope(o.visibleSubprojectIds, o.subprojectId);
  }

  /**
   * Νέα καταχώριση επίσκεψης: μόνο ο μηχανικός, και μόνο στα χρεωμένα του.
   * Ο υπερδιαχειριστής δεν «γράφει ημερολόγιο» ως ρόλος — επεμβαίνει σε
   * υπάρχουσες εγγραφές για διόρθωση / διαγραφή.
   */
  function canAddEntry(input) {
    var o = input || {};
    if (o.role !== 'ENGINEER') return false;
    return subprojectInEngineerScope(o.visibleSubprojectIds, o.subprojectId);
  }

  /** Αλλαγή/διαγραφή: μόνο ο συντάκτης της εγγραφής — ή ο υπερδιαχειριστής. */
  function canEditEntry(input) {
    var o = input || {};
    if (o.role === 'SUPERADMIN') return true;
    if (o.role !== 'ENGINEER') return false;
    var me = String(o.username || '').trim().toLowerCase();
    var author = String((o.entry && o.entry.authorUsername) || '').trim().toLowerCase();
    return !!me && me === author;
  }

  function isSiteActiveStatus(projectStatus) {
    return SITE_ACTIVE_STATUSES.indexOf(String(projectStatus || '').trim()) !== -1;
  }

  /**
   * Κουμπί στην κάρτα υποέργου: εμφανίζεται όπου υπάρχει εργοτάξιο (εκτελούμενο
   * και μετά) και πάντα όπου υπάρχει ήδη έστω μία εγγραφή, ώστε να μη χάνεται το
   * ιστορικό αν αλλάξει αργότερα η κατάσταση του υποέργου.
   */
  function showCardDiaryButton(input) {
    var o = input || {};
    if (!canViewSubprojectDiary(o)) return false;
    if ((o.entryCount || 0) > 0) return true;
    return isSiteActiveStatus(o.projectStatus);
  }

  // ── Έλεγχος εγγραφής ──

  function validateEntry(draft, options) {
    var o = options || {};
    var today = String(o.today || todayIso()).slice(0, 10);
    var d = draft || {};

    var visitDate = String(d.visitDate || '').trim().slice(0, 10);
    if (!DATE_RE.test(visitDate)) {
      return { ok: false, field: 'visitDate', error: 'Απαιτείται ημερομηνία επίσκεψης' };
    }
    if (visitDate > today) {
      return {
        ok: false,
        field: 'visitDate',
        error: 'Δεν μπορείτε να καταγράψετε επίσκεψη με μελλοντική ημερομηνία'
      };
    }

    var visitTime = String(d.visitTime || '').trim();
    if (visitTime && !TIME_RE.test(visitTime)) {
      return { ok: false, field: 'visitTime', error: 'Μη έγκυρη ώρα — χρησιμοποιήστε μορφή ΩΩ:ΛΛ' };
    }

    var notes = String(d.notes || '').trim();
    if (!notes) {
      return { ok: false, field: 'notes', error: 'Γράψτε τι διαπιστώσατε στην επίσκεψη' };
    }
    if (notes.length > NOTES_MAX) {
      return { ok: false, field: 'notes', error: 'Το κείμενο της επίσκεψης είναι υπερβολικά μεγάλο' };
    }

    var progress = String(d.progress || '').trim() || DEFAULT_PROGRESS;
    if (!isValidProgress(progress)) {
      return { ok: false, field: 'progress', error: 'Μη έγκυρη κατάσταση πορείας εργασιών' };
    }

    var contractorOrder = String(d.contractorOrder || '').trim();
    if (contractorOrder.length > ORDER_MAX) {
      return { ok: false, field: 'contractorOrder', error: 'Η εντολή προς τον ανάδοχο είναι υπερβολικά μεγάλη' };
    }

    return {
      ok: true,
      visitDate: visitDate,
      visitTime: visitTime,
      notes: notes,
      progress: progress,
      contractorOrder: contractorOrder
    };
  }

  // ── Ταξινόμηση, αναζήτηση, φίλτρα ──

  function entrySortKey(entry) {
    var e = entry || {};
    return String(e.visitDate || '') + 'T' + String(e.visitTime || '00:00') + '|' + String(e.createdAt || '');
  }

  /** Νεότερη επίσκεψη πρώτη. */
  function sortEntriesDesc(entries) {
    return (entries || []).slice().sort(function (a, b) {
      return entrySortKey(b).localeCompare(entrySortKey(a));
    });
  }

  function entryPhotoCount(entry) {
    return ((entry && entry.photos) || []).length;
  }

  function entryHasOrder(entry) {
    return !!String((entry && entry.contractorOrder) || '').trim();
  }

  function matchesEntrySearch(entry, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var e = entry || {};
    var hay = [
      e.notes,
      e.contractorOrder,
      e.authorFullName,
      e.authorUsername,
      e.visitDate,
      e.subprojectTitle,
      e.projectTitle,
      progressState(e.progress).label
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function matchesEntryFilters(entry, filters) {
    var o = filters || {};
    var e = entry || {};

    if (o.progressFilter && String(e.progress || DEFAULT_PROGRESS) !== o.progressFilter) return false;

    if (o.quickFilter === 'mine') {
      var me = String(o.username || '').trim().toLowerCase();
      if (!me || String(e.authorUsername || '').trim().toLowerCase() !== me) return false;
    }
    if (o.quickFilter === 'week') {
      var diff = daysSince(e.visitDate, o.today);
      if (diff === null || diff > 7 || diff < 0) return false;
    }
    if (o.quickFilter === 'attention') {
      var p = String(e.progress || DEFAULT_PROGRESS);
      if (p !== 'delay' && p !== 'stopped') return false;
    }
    if (o.quickFilter === 'orders' && !entryHasOrder(e)) return false;

    if (o.subprojectId && String(e.subprojectId || '') !== String(o.subprojectId)) return false;

    return matchesEntrySearch(e, o.search);
  }

  function filterEntries(entries, filters) {
    return (entries || []).filter(function (row) {
      return matchesEntryFilters(row, filters);
    });
  }

  /** Ο μηχανικός δεν πρέπει ποτέ να παίρνει εγγραφές εκτός των υποέργων του. */
  function filterEntriesForViewer(entries, input) {
    var o = input || {};
    if (o.role !== 'ENGINEER') return (entries || []).slice();
    return (entries || []).filter(function (row) {
      return subprojectInEngineerScope(o.visibleSubprojectIds, row && row.subprojectId);
    });
  }

  // ── Σύνοψη ανά υποέργο ──

  function summarizeEntries(entries, options) {
    var o = options || {};
    var today = o.today || todayIso();
    var sorted = sortEntriesDesc(entries);
    var latest = sorted[0] || null;

    var photoCount = 0;
    var orderCount = 0;
    var byProgress = {};
    PROGRESS_STATES.forEach(function (state) { byProgress[state.key] = 0; });

    sorted.forEach(function (entry) {
      photoCount += entryPhotoCount(entry);
      if (entryHasOrder(entry)) orderCount += 1;
      var key = String(entry.progress || DEFAULT_PROGRESS);
      if (byProgress[key] === undefined) byProgress[key] = 0;
      byProgress[key] += 1;
    });

    var lastVisitDate = latest ? String(latest.visitDate || '') : '';

    return {
      total: sorted.length,
      photoCount: photoCount,
      orderCount: orderCount,
      byProgress: byProgress,
      latest: latest,
      lastVisitDate: lastVisitDate,
      lastProgress: latest ? String(latest.progress || DEFAULT_PROGRESS) : '',
      daysSinceLastVisit: lastVisitDate ? daysSince(lastVisitDate, today) : null,
      recencyTone: recencyTone(lastVisitDate, today),
      recencyLabel: recencyLabel(lastVisitDate, today)
    };
  }

  /** Ομαδοποίηση επισκέψεων ανά ημέρα — για την προβολή «Χρονολόγιο». */
  function groupEntriesByDate(entries) {
    var order = [];
    var map = {};
    sortEntriesDesc(entries).forEach(function (entry) {
      var key = String((entry && entry.visitDate) || '');
      if (!map[key]) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(entry);
    });
    return order.map(function (date) {
      return { date: date, entries: map[date] };
    });
  }

  return {
    SITE_DIARY_DIR_NAME: SITE_DIARY_DIR_NAME,
    SITE_ACTIVE_STATUSES: SITE_ACTIVE_STATUSES,
    PROGRESS_STATES: PROGRESS_STATES,
    DEFAULT_PROGRESS: DEFAULT_PROGRESS,
    PROGRESS_TONE_COLORS: PROGRESS_TONE_COLORS,
    RECENCY_TONE_COLORS: RECENCY_TONE_COLORS,
    RECENCY_FRESH_MAX_DAYS: RECENCY_FRESH_MAX_DAYS,
    RECENCY_AGING_MAX_DAYS: RECENCY_AGING_MAX_DAYS,
    NOTES_MAX: NOTES_MAX,
    ORDER_MAX: ORDER_MAX,

    progressState: progressState,
    progressColors: progressColors,
    recencyColors: recencyColors,
    isValidProgress: isValidProgress,

    toLocalDateString: toLocalDateString,
    todayIso: todayIso,
    parseIsoDate: parseIsoDate,
    daysSince: daysSince,
    recencyTone: recencyTone,
    recencyLabel: recencyLabel,

    canViewSiteDiary: canViewSiteDiary,
    canWriteSiteDiary: canWriteSiteDiary,
    showSiteDiaryButton: showSiteDiaryButton,
    isSiteDiaryReadOnly: isSiteDiaryReadOnly,
    subprojectInEngineerScope: subprojectInEngineerScope,
    canViewSubprojectDiary: canViewSubprojectDiary,
    canAddEntry: canAddEntry,
    canEditEntry: canEditEntry,
    isSiteActiveStatus: isSiteActiveStatus,
    showCardDiaryButton: showCardDiaryButton,

    validateEntry: validateEntry,

    sortEntriesDesc: sortEntriesDesc,
    entryPhotoCount: entryPhotoCount,
    entryHasOrder: entryHasOrder,
    matchesEntrySearch: matchesEntrySearch,
    matchesEntryFilters: matchesEntryFilters,
    filterEntries: filterEntries,
    filterEntriesForViewer: filterEntriesForViewer,
    summarizeEntries: summarizeEntries,
    groupEntriesByDate: groupEntriesByDate
  };
});
