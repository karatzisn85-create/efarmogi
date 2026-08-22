/**
 * Μαζική εισαγωγή από Excel: ποιος βλέπει το κουμπί, πότε επιτρέπεται η εισαγωγή,
 * τι γίνεται με τα διπλότυπα. Χωρίς ανάγνωση αρχείου και χωρίς δίσκο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubExcelImport = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DUPLICATE_POLICIES = ['skip', 'update', 'create'];

  function showExcelImportButton(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function evaluateExcelImportAccess(input) {
    var opts = input || {};
    var actor = opts.actor;
    if (!actor || actor.active === false) {
      return { ok: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να εισάγει έργα από Excel.' };
    }
    if (actor.role !== 'SUPERADMIN') {
      if (opts.action === 'template') {
        return { ok: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να δημιουργήσει το πρότυπο εισαγωγής.' };
      }
      return { ok: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να εισάγει έργα από Excel.' };
    }
    return { ok: true };
  }

  function sanitizeTitleText(value) {
    if (value == null) return '';
    var s = String(value);
    s = s.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '');
    s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    s = s.replace(/\r\n?|\n|\u000B|\u000C|\u0085|\u2028|\u2029|\t/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    try { s = s.normalize('NFC'); } catch (e) { /* noop */ }
    return s;
  }

  function normalizeTitleKey(text) {
    return sanitizeTitleText(text).toLowerCase();
  }

  function buildDupKey(projectTitle, subprojectTitle) {
    return normalizeTitleKey(projectTitle) + '|||' + normalizeTitleKey(subprojectTitle);
  }

  function isValidDuplicatePolicy(policy) {
    return DUPLICATE_POLICIES.indexOf(policy) >= 0;
  }

  function canCommitImport(report) {
    if (!report) return false;
    if (report.parseErrors && report.parseErrors.length) return false;
    if (report.errorRows && report.errorRows.length) return false;
    return (Number(report.validCount) || 0) > 0;
  }

  function evaluateCommitImport(report, duplicatePolicy) {
    if (report && report.parseErrors && report.parseErrors.length) {
      return { ok: false, error: 'Το αρχείο δεν διαβάστηκε σωστά.' };
    }
    if (report && report.errorRows && report.errorRows.length) {
      return { ok: false, error: 'Υπάρχουν γραμμές με λάθη. Διορθώστε το αρχείο και ξαναδοκιμάστε.' };
    }
    if (!report || !(Number(report.validCount) > 0)) {
      return { ok: false, error: 'Δεν βρέθηκαν έγκυρες γραμμές προς εισαγωγή.' };
    }
    if (duplicatePolicy != null && !isValidDuplicatePolicy(duplicatePolicy)) {
      return { ok: false, error: 'Μη έγκυρη πολιτική διπλοτύπων.' };
    }
    return { ok: true };
  }

  function showExistingWorksChoice(report) {
    return !!(report && Number(report.existingCount) > 0);
  }

  function showDuplicatePolicyChoice(report, existingMode) {
    return !!(
      report
      && existingMode === 'keep'
      && report.existingDuplicates
      && report.existingDuplicates.length
    );
  }

  function resolveRowAction(input) {
    var opts = input || {};
    if (opts.wipeExisting || !opts.isDuplicate) return 'create';
    if (opts.duplicatePolicy === 'skip') return 'skip';
    if (opts.duplicatePolicy === 'update') return 'update';
    return 'create';
  }

  function findExistingByDupKey(projects, dupKey) {
    var i;
    for (i = 0; i < (projects || []).length; i += 1) {
      var p = projects[i];
      if (buildDupKey(p.projectTitle, p.subprojectTitle) === dupKey) return p;
    }
    return null;
  }

  function collectExistingDuplicates(validRows, existingProjects) {
    return (validRows || []).filter(function (row) {
      var key = row.dupKey || buildDupKey(row.projectTitle, row.subprojectTitle);
      return !!findExistingByDupKey(existingProjects, key);
    }).map(function (row) {
      return {
        excelRow: row.excelRow,
        projectTitle: row.projectTitle,
        subprojectTitle: row.subprojectTitle
      };
    });
  }

  function applyImportPlan(existingProjects, validRows, options) {
    var opts = options || {};
    var wipe = !!opts.wipeExisting;
    var policy = opts.duplicatePolicy || 'skip';
    var previous = existingProjects || [];
    var next = wipe ? [] : previous.map(function (p) {
      var copy = {};
      Object.keys(p).forEach(function (k) { copy[k] = p[k]; });
      return copy;
    });
    var created = 0;
    var updated = 0;
    var skipped = 0;
    var seq = 1;
    var titleToProjectId = {};
    next.forEach(function (p) {
      var tk = normalizeTitleKey(p.projectTitle);
      if (tk && !titleToProjectId[tk]) titleToProjectId[tk] = p.projectId;
    });

    (validRows || []).forEach(function (row) {
      var key = row.dupKey || buildDupKey(row.projectTitle, row.subprojectTitle);
      var found = wipe ? null : findExistingByDupKey(next, key);
      var action = resolveRowAction({
        isDuplicate: !!found,
        wipeExisting: wipe,
        duplicatePolicy: policy
      });
      if (action === 'skip') {
        skipped += 1;
        return;
      }
      if (action === 'update' && found) {
        found.projectTitle = row.projectTitle;
        found.subprojectTitle = row.subprojectTitle;
        if (row.kaCode != null) found.kaCode = row.kaCode;
        if (row.projectStatus != null) found.projectStatus = row.projectStatus;
        updated += 1;
        return;
      }
      var titleKey = normalizeTitleKey(row.projectTitle);
      var projectId = titleToProjectId[titleKey] || ('imp-proj-' + seq);
      if (!titleToProjectId[titleKey]) titleToProjectId[titleKey] = projectId;
      next.push({
        projectId: projectId,
        subprojectId: 'imp-sub-' + seq,
        projectTitle: row.projectTitle,
        subprojectTitle: row.subprojectTitle,
        kaCode: row.kaCode || '',
        projectStatus: row.projectStatus || 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
        projectType: row.projectType || 'ΕΡΓΟ',
        createdAt: '2026-08-23T00:00:00.000Z',
        updatedAt: '2026-08-23T00:00:00.000Z',
        supervisorEngineerIds: [],
        supervisorChargeOutsideEngineers: false,
        supervisorChargeFreePrimary: '',
        supervisorChargeFreeParticipants: '',
        importedViaExcel: true
      });
      seq += 1;
      created += 1;
    });

    var uniqueOldProjects = {};
    previous.forEach(function (p) {
      if (p.projectId) uniqueOldProjects[p.projectId] = true;
    });

    return {
      created: created,
      updated: updated,
      skipped: skipped,
      failed: [],
      deletedProjects: wipe ? Object.keys(uniqueOldProjects).length : 0,
      wipeExisting: wipe,
      projects: next
    };
  }

  return {
    DUPLICATE_POLICIES: DUPLICATE_POLICIES,
    showExcelImportButton: showExcelImportButton,
    evaluateExcelImportAccess: evaluateExcelImportAccess,
    sanitizeTitleText: sanitizeTitleText,
    normalizeTitleKey: normalizeTitleKey,
    buildDupKey: buildDupKey,
    isValidDuplicatePolicy: isValidDuplicatePolicy,
    canCommitImport: canCommitImport,
    evaluateCommitImport: evaluateCommitImport,
    showExistingWorksChoice: showExistingWorksChoice,
    showDuplicatePolicyChoice: showDuplicatePolicyChoice,
    resolveRowAction: resolveRowAction,
    findExistingByDupKey: findExistingByDupKey,
    collectExistingDuplicates: collectExistingDuplicates,
    applyImportPlan: applyImportPlan
  };
});
