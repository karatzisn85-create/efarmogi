/**
 * Μητρώο Μελετών: ποιος βλέπει / επεξεργάζεται, αναζήτηση, φίλτρα,
 * αριθμός μελέτης και υποχρεωτικά νέας εγγραφής. Χωρίς αποθήκευση στον δίσκο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubMeletaiCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STUDY_NUMBER_REGEX = /^(\d{1,4})\/(\d{4})$/;

  function showMeletaiButton(_userRole) {
    return true;
  }

  function meletaiEditEligibleRole(role) {
    return role === 'USER' || role === 'ENGINEER';
  }

  function resolveMeletaiCanEditFlag(user) {
    return !!(user && meletaiEditEligibleRole(user.role) && user.meletaiCanEdit === true);
  }

  function canManageMeletai(user) {
    if (!user) return false;
    if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
    return resolveMeletaiCanEditFlag(user);
  }

  function isMeletaiReadOnly(input) {
    var opts = input || {};
    return meletaiEditEligibleRole(opts.role) && !opts.meletaiCanEdit;
  }

  function filterStudyNumberInput(raw) {
    var s = String(raw == null ? '' : raw).replace(/[^\d/]/g, '');
    var slash = s.indexOf('/');
    if (slash >= 0) {
      var num = s.slice(0, slash).slice(0, 4);
      var year = s.slice(slash + 1).replace(/\//g, '').slice(0, 4);
      return num + '/' + year;
    }
    return s.slice(0, 4);
  }

  function validateStudyNumberFormat(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) {
      return { ok: false, field: 'studyNumber', error: 'Απαιτείται αριθμός μελέτης' };
    }
    var match = trimmed.match(STUDY_NUMBER_REGEX);
    if (!match) {
      return {
        ok: false,
        field: 'studyNumber',
        error: 'Μορφή: αριθμός/έτος (π.χ. 2/2026). Μόνο ψηφία, χωρίς κενά ή σύμβολα.'
      };
    }
    var year = parseInt(match[2], 10);
    if (year < 1990 || year > 2100) {
      return { ok: false, field: 'studyNumber', error: 'Το έτος πρέπει να είναι μεταξύ 1990 και 2100' };
    }
    var num = parseInt(match[1], 10);
    if (!Number.isFinite(num) || num < 1) {
      return { ok: false, field: 'studyNumber', error: 'Ο αριθμός μελέτης πρέπει να είναι θετικός' };
    }
    return { ok: true, studyNumber: num + '/' + match[2] };
  }

  function normalizeStudyNumberKey(value) {
    var v = validateStudyNumberFormat(value);
    if (v.ok) return v.studyNumber;
    return String(value || '').trim().toLowerCase();
  }

  function evaluateNewMeleti(draft) {
    var fmt = validateStudyNumberFormat(draft && draft.studyNumber);
    if (!fmt.ok) return fmt;
    var title = String((draft && draft.title) || '').trim();
    if (!title) {
      return { ok: false, field: 'title', error: 'Απαιτείται τίτλος μελέτης' };
    }
    return { ok: true, studyNumber: fmt.studyNumber, title: title };
  }

  function evaluateMeletiDelete(input) {
    if (isMeletaiReadOnly(input)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας μητρώου μελετών' };
    }
    if (!input || !input.meletiId) {
      return { ok: false, error: 'Επιλέξτε μελέτη για διαγραφή' };
    }
    return { ok: true };
  }

  function countMeletiFiles(meleti) {
    return ((meleti && meleti.fileGroups) || []).reduce(function (sum, group) {
      return sum + ((group && group.files) || []).reduce(function (inner, entry) {
        if (entry && entry.kind === 'folder') return inner + (entry.fileCount || 0);
        return inner + 1;
      }, 0);
    }, 0);
  }

  function parseMeletiSearch(meleti, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var hay = [
      meleti && meleti.studyNumber,
      meleti && meleti.title,
      meleti && meleti.assignedTo,
      meleti && meleti.category,
      meleti && meleti.projectExpenditureBudget,
      meleti && meleti.studyApprovalDate,
      meleti && meleti.linkedSubprojectTitle,
      meleti && meleti.linkedProjectTitle,
      meleti && meleti.notes
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function matchesMeletiFilters(meleti, filters) {
    var opts = filters || {};
    if (opts.categoryFilter && meleti.category !== opts.categoryFilter) return false;
    if (opts.quickFilter === 'linked' && !meleti.linkedSubprojectId) return false;
    if (opts.quickFilter === 'unlinked' && meleti.linkedSubprojectId) return false;
    if (opts.quickFilter === 'with_files' && countMeletiFiles(meleti) === 0) return false;
    if (opts.quickFilter === 'without_files' && countMeletiFiles(meleti) > 0) return false;
    if (opts.linkFilter === 'linked' && !meleti.linkedSubprojectId) return false;
    if (opts.linkFilter === 'unlinked' && meleti.linkedSubprojectId) return false;
    return parseMeletiSearch(meleti, opts.search);
  }

  function filterMeletaiHub(meletai, filters) {
    return (meletai || []).filter(function (row) {
      return matchesMeletiFilters(row, filters);
    });
  }

  function canLinkSubprojectForRole(input) {
    var opts = input || {};
    if (opts.role !== 'ENGINEER' || !opts.visibleSubprojectIds) return true;
    var sid = String(opts.subprojectId || '').trim();
    if (!sid) return true;
    if (typeof opts.visibleSubprojectIds.has === 'function') {
      return opts.visibleSubprojectIds.has(sid);
    }
    return (opts.visibleSubprojectIds || []).indexOf(sid) !== -1;
  }

  return {
    STUDY_NUMBER_REGEX: STUDY_NUMBER_REGEX,
    showMeletaiButton: showMeletaiButton,
    meletaiEditEligibleRole: meletaiEditEligibleRole,
    resolveMeletaiCanEditFlag: resolveMeletaiCanEditFlag,
    canManageMeletai: canManageMeletai,
    isMeletaiReadOnly: isMeletaiReadOnly,
    filterStudyNumberInput: filterStudyNumberInput,
    validateStudyNumberFormat: validateStudyNumberFormat,
    normalizeStudyNumberKey: normalizeStudyNumberKey,
    evaluateNewMeleti: evaluateNewMeleti,
    evaluateMeletiDelete: evaluateMeletiDelete,
    countMeletiFiles: countMeletiFiles,
    parseMeletiSearch: parseMeletiSearch,
    matchesMeletiFilters: matchesMeletiFilters,
    filterMeletaiHub: filterMeletaiHub,
    canLinkSubprojectForRole: canLinkSubprojectForRole
  };
});
