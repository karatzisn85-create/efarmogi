/**
 * Αντίγραφα ασφαλείας: ποιος ανοίγει / δημιουργεί / διαγράφει / επαναφέρει,
 * υπενθύμιση 10 ημερών. Χωρίς εγγραφή στον δίσκο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubBackupCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BACKUP_REMINDER_DAYS = 10;

  function showBackupButton(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  }

  function canCreateBackup(userRole) {
    return showBackupButton(userRole);
  }

  function canDeleteBackup(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canRestoreBackup(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canSeeBackupLocation(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function getLastRealBackup(backups) {
    var real = (backups || []).filter(function (b) {
      return b && b.status === 'success' && b.type !== 'safety';
    });
    if (!real.length) return null;
    return real.reduce(function (newest, b) {
      return new Date(b.timestamp) > new Date(newest.timestamp) ? b : newest;
    });
  }

  function evaluateBackupReminder(backups, nowMs) {
    var now = nowMs == null ? Date.now() : nowMs;
    var last = getLastRealBackup(backups);
    if (!last || !last.timestamp) {
      return {
        hasBackup: false,
        lastBackupAt: null,
        lastBackupId: null,
        lastBackupBy: null,
        daysSince: null,
        reminderDue: true,
        reminderThresholdDays: BACKUP_REMINDER_DAYS
      };
    }
    var daysSince = (now - new Date(last.timestamp).getTime()) / 86400000;
    var by = last.createdBy && (last.createdBy.fullName || last.createdBy.username);
    return {
      hasBackup: true,
      lastBackupAt: last.timestamp,
      lastBackupId: last.backupId || null,
      lastBackupBy: by || null,
      daysSince: Math.floor(daysSince),
      reminderDue: daysSince >= BACKUP_REMINDER_DAYS,
      reminderThresholdDays: BACKUP_REMINDER_DAYS
    };
  }

  function backupReminderTitle(hasBackup) {
    return hasBackup ? 'Αντίγραφο ασφαλείας εκκρεμεί' : 'Χωρίς αντίγραφο ασφαλείας';
  }

  function backupReminderDetail(hasBackup) {
    return hasBackup
      ? 'Προστατέψτε τα δεδομένα με νέο αντίγραφο.'
      : 'Δημιουργήστε το πρώτο αντίγραφο για προστασία δεδομένων.';
  }

  function evaluateCreateBackup(input) {
    var opts = input || {};
    if (!canCreateBackup(opts.role)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα δημιουργίας αντιγράφου ασφαλείας.' };
    }
    if (opts.inProgress) {
      return { ok: false, error: 'Το backup είναι ήδη σε εξέλιξη...' };
    }
    return { ok: true };
  }

  function evaluateDeleteBackup(input) {
    var opts = input || {};
    if (!canDeleteBackup(opts.role)) {
      return { ok: false, error: 'Μόνο ο Υπερδιαχειριστής μπορεί να διαγράψει αντίγραφα ασφαλείας.' };
    }
    if (!opts.backupId) {
      return { ok: false, error: 'Απαιτείται αντίγραφο' };
    }
    return { ok: true };
  }

  function evaluateRestoreBackup(input) {
    var opts = input || {};
    if (!canRestoreBackup(opts.role)) {
      return { ok: false, error: 'Μόνο ο Υπερδιαχειριστής μπορεί να κάνει επαναφορά δεδομένων.' };
    }
    if (!opts.backupId) {
      return { ok: false, error: 'Απαιτείται αντίγραφο' };
    }
    if (opts.fileExists === false) {
      return { ok: false, error: 'Το αρχείο αντιγράφου δεν βρέθηκε.' };
    }
    if (opts.status && opts.status !== 'success') {
      return { ok: false, error: 'Το αντίγραφο δεν είναι έγκυρο για επαναφορά.' };
    }
    return { ok: true };
  }

  function normalizeRestoreType() {
    return 'full';
  }

  function restoreKindLabel() {
    return 'Επαναφορά όλων των δεδομένων';
  }

  function restoreConfirmTitle() {
    return 'Επαναφορά όλων των δεδομένων';
  }

  function restoreConfirmMessage() {
    return 'Θα αντικατασταθούν όλα όσα έχει σήμερα η εφαρμογή.';
  }

  function restoreConfirmDetail() {
    return 'Θα γυρίσουν και οι χρήστες και οι κωδικοί εκείνης της ημέρας. Πριν την αλλαγή φυλάσσεται αυτόματα η τρέχουσα κατάσταση. Χωρίς επιβεβαίωση δεν γίνεται τίποτα.';
  }

  function evaluateRestoreReadyToApply(input) {
    var opts = input || {};
    if (!opts.safetyOk) {
      return {
        ok: false,
        canApply: false,
        error: 'Δεν ήταν δυνατή η δημιουργία αντιγράφου ασφαλείας πριν την επαναφορά. Η επαναφορά ακυρώθηκε για την προστασία των δεδομένων σας.'
      };
    }
    if (!opts.extractedReady) {
      return {
        ok: false,
        canApply: false,
        error: 'Το αντίγραφο δεν μπόρεσε να ανοίξει σωστά. Τα τρέχοντα δεδομένα δεν άλλαξαν.'
      };
    }
    return { ok: true, canApply: true };
  }

  var PROJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var RESTORE_AREA_LABELS = {
    'users.json': 'Χρήστες',
    'registered-engineers.json': 'Κατάλογος μηχανικών',
    'audit_log.json': 'Ιστορικό ενεργειών',
    'funding_options.json': 'Πηγές χρηματοδότησης',
    'ΠΡΟΣΚΛΗΣΕΙΣ': 'Προσκλήσεις',
    'proskliseis_data': 'Προσκλήσεις (δεδομένα)',
    'entaxeis': 'Εντάξεις',
    'entaxis_data': 'Εντάξεις (δεδομένα)',
    'EGKRISEIS_DIATHESIS_PISTOSIS': 'Εγκρίσεις διάθεσης',
    'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ': 'Εγκρίσεις διάθεσης',
    'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ': 'Εγκρίσεις (δεδομένα)',
    'egkriseis_links': 'Συνδέσεις εγκρίσεων',
    'ARCHIVE_EGKRISEIS': 'Αρχείο εγκρίσεων',
    'ΜΕΛΕΤΕΣ': 'Μητρώο μελετών',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ': 'Ωρίμανση έργων',
    'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ': 'Επιχειρησιακό πρόγραμμα',
    'ΑΠΟΛΟΓΙΣΜΟΣ': 'Απολογισμός',
    'ANATHESEIS_ERGASION': 'Χώρος εργασιών',
    'ΣΗΜΕΙΩΣΕΙΣ': 'Σημειώσεις',
    'DOCUMENT_TEMPLATES': 'Πρότυπα εγγράφων',
    'config': 'Ρυθμίσεις / ημερολόγιο / ειδοποιήσεις',
    'subproject_links': 'Συνδέσεις υποέργων',
    'ektelestea_erga': 'Εκτελεστέα έργα'
  };

  var EXPECTED_RESTORE_AREAS = [
    'Χρήστες',
    'Προσκλήσεις',
    'Εντάξεις',
    'Εγκρίσεις διάθεσης',
    'Μητρώο μελετών',
    'Ωρίμανση έργων',
    'Επιχειρησιακό πρόγραμμα',
    'Απολογισμός',
    'Χώρος εργασιών',
    'Ρυθμίσεις / ημερολόγιο / ειδοποιήσεις'
  ];

  function summarizeRestoredAreas(entryNames) {
    var names = entryNames || [];
    var seen = {};
    var areas = [];
    var projectCount = 0;
    names.forEach(function (name) {
      if (PROJECT_UUID_RE.test(name)) {
        projectCount += 1;
        return;
      }
      var label = RESTORE_AREA_LABELS[name] || name;
      if (!seen[label]) {
        seen[label] = true;
        areas.push(label);
      }
    });
    if (projectCount) {
      areas.unshift('Έργα / υποέργα (' + projectCount + ')');
    }
    return areas;
  }

  function missingExpectedRestoreAreas(areaLabels) {
    var have = {};
    (areaLabels || []).forEach(function (a) { have[a] = true; });
    return EXPECTED_RESTORE_AREAS.filter(function (a) { return !have[a]; });
  }

  var BACKUP_EXCLUDE_ENTRIES = {
    backups: true,
    locks: true,
    'app-config.json': true,
    'data-dir.json': true,
    'backup_settings.json': true,
    'backup_location.json': true
  };

  function isSkippedBackupEntry(name) {
    if (!name) return true;
    if (BACKUP_EXCLUDE_ENTRIES[name]) return true;
    if (name.charAt(0) === '.') return true;
    if (name.indexOf('temp_') === 0) return true;
    if (name.slice(-5) === '.lock' || name.slice(-4) === '.tmp') return true;
    if (/\.tmp-\d+$/.test(name)) return true;
    if (/\.bak\d*$/.test(name)) return true;
    return false;
  }

  function selectBackupEntryNames(dirNames) {
    return (dirNames || []).filter(function (n) { return !isSkippedBackupEntry(n); });
  }

  function summarizeBackupContents(entryNames) {
    var names = selectBackupEntryNames(entryNames);
    var contents = {
      projects: 0,
      proskliseis: 0,
      entaxeis: 0,
      egkriseis: 0,
      meletai: 0,
      tasks: 0,
      users: 0,
      orimanthi: 0,
      epProgram: 0,
      apologismos: 0
    };
    names.forEach(function (name) {
      if (PROJECT_UUID_RE.test(name)) contents.projects += 1;
      else if (name === 'ΠΡΟΣΚΛΗΣΕΙΣ' || name === 'proskliseis_data') contents.proskliseis = 1;
      else if (name === 'entaxeis' || name === 'entaxis_data') contents.entaxeis = 1;
      else if (name === 'EGKRISEIS_DIATHESIS_PISTOSIS' || name === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ') contents.egkriseis = 1;
      else if (name === 'ΜΕΛΕΤΕΣ') contents.meletai = 1;
      else if (name === 'ANATHESEIS_ERGASION') contents.tasks = 1;
      else if (name === 'users.json') contents.users = 1;
      else if (name === 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ') contents.orimanthi = 1;
      else if (name === 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ') contents.epProgram = 1;
      else if (name === 'ΑΠΟΛΟΓΙΣΜΟΣ') contents.apologismos = 1;
    });
    contents.areas = summarizeRestoredAreas(names);
    return contents;
  }

  function evaluateBackupCoverage(input) {
    var opts = input || {};
    var live = selectBackupEntryNames(opts.liveEntries);
    var selected = opts.selectedEntries || live;
    var zipSeen = {};
    (opts.zipTopLevel || []).forEach(function (n) { zipSeen[n] = true; });
    var empty = {};
    (opts.emptySelectedDirs || []).forEach(function (n) { empty[n] = true; });
    var missing = [];
    var seen = {};
    function addMissing(name) {
      if (!name || seen[name]) return;
      seen[name] = true;
      missing.push(name);
    }
    live.forEach(function (n) {
      if (selected.indexOf(n) === -1) addMissing(n);
    });
    if (opts.zipTopLevel) {
      selected.forEach(function (n) {
        if (!zipSeen[n] && !empty[n]) addMissing(n);
      });
    }
    var labels = missing.map(function (n) { return RESTORE_AREA_LABELS[n] || n; });
    return {
      ok: missing.length === 0,
      missing: missing,
      areas: summarizeRestoredAreas(selected),
      message: missing.length
        ? ('Το αντίγραφο δεν περιέχει όλα τα δεδομένα της εφαρμογής: ' + labels.join(', ') + '.')
        : 'Το αντίγραφο περιέχει όλα τα δεδομένα της εφαρμογής εκείνης της στιγμής.'
    };
  }

  function restoreProgressLabel(phase) {
    if (phase === 'restore-safety' || phase === 'scanning' || phase === 'archiving' || phase === 'finalizing') {
      return 'Φύλαξη τρέχουσας κατάστασης…';
    }
    if (phase === 'restore-extract') return 'Άνοιγμα αντιγράφου…';
    if (phase === 'restore-apply') return 'Εφαρμογή δεδομένων…';
    if (phase === 'restore-rollback') return 'Επιστροφή στην προηγούμενη κατάσταση…';
    if (phase === 'restore-done') return 'Η επαναφορά ολοκληρώθηκε.';
    return 'Η επαναφορά είναι σε εξέλιξη…';
  }

  function evaluateRestoreOutcome(input) {
    var opts = input || {};
    if (opts.applyOk) {
      return {
        ok: true,
        rolledBack: false,
        message: 'Η επαναφορά ολοκληρώθηκε. Επανεκκινήστε για να φορτωθούν τα νέα δεδομένα.'
      };
    }
    if (opts.rolledBack) {
      return {
        ok: false,
        rolledBack: true,
        message: 'Η επαναφορά απέτυχε. Τα δεδομένα έμειναν όπως ήταν πριν.'
      };
    }
    return {
      ok: false,
      rolledBack: false,
      rollbackFailed: true,
      message: 'Η επαναφορά απέτυχε και δεν ήταν δυνατή η αυτόματη επαναφορά στην προηγούμενη κατάσταση.'
    };
  }

  function announceCreateBackupFromEvent() {
    return false;
  }

  return {
    BACKUP_REMINDER_DAYS: BACKUP_REMINDER_DAYS,
    showBackupButton: showBackupButton,
    canCreateBackup: canCreateBackup,
    canDeleteBackup: canDeleteBackup,
    canRestoreBackup: canRestoreBackup,
    canSeeBackupLocation: canSeeBackupLocation,
    getLastRealBackup: getLastRealBackup,
    evaluateBackupReminder: evaluateBackupReminder,
    backupReminderTitle: backupReminderTitle,
    backupReminderDetail: backupReminderDetail,
    evaluateCreateBackup: evaluateCreateBackup,
    evaluateDeleteBackup: evaluateDeleteBackup,
    evaluateRestoreBackup: evaluateRestoreBackup,
    normalizeRestoreType: normalizeRestoreType,
    restoreKindLabel: restoreKindLabel,
    restoreConfirmTitle: restoreConfirmTitle,
    restoreConfirmMessage: restoreConfirmMessage,
    restoreConfirmDetail: restoreConfirmDetail,
    evaluateRestoreReadyToApply: evaluateRestoreReadyToApply,
    evaluateRestoreOutcome: evaluateRestoreOutcome,
    announceCreateBackupFromEvent: announceCreateBackupFromEvent,
    RESTORE_AREA_LABELS: RESTORE_AREA_LABELS,
    EXPECTED_RESTORE_AREAS: EXPECTED_RESTORE_AREAS,
    summarizeRestoredAreas: summarizeRestoredAreas,
    missingExpectedRestoreAreas: missingExpectedRestoreAreas,
    restoreProgressLabel: restoreProgressLabel,
    BACKUP_EXCLUDE_ENTRIES: BACKUP_EXCLUDE_ENTRIES,
    isSkippedBackupEntry: isSkippedBackupEntry,
    selectBackupEntryNames: selectBackupEntryNames,
    summarizeBackupContents: summarizeBackupContents,
    evaluateBackupCoverage: evaluateBackupCoverage
  };
});
