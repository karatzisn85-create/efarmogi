/**
 * Δημιουργία / διαγραφή υποέργου: υποχρεωτικά Φάσης Α, ΚΑ, ένωση σε υπάρχον έργο, διαγραφή.
 * Ίδιες αποφάσεις με τη φόρμα και την αποθήκευση.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSubprojectLifecycle = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validateKACode(code) {
    return /^\d{2}-\d{4}\.\d{3}$/.test(String(code || ''));
  }

  function parseCoFinancingAmount(value) {
    var n = parseFloat(String(value || '').replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  /**
   * Υποχρεωτικά Φάσης Α όπως στο validateForm της φόρμας (όχι τα μηνύματα του live validateField).
   */
  function collectPhaseARequiredErrors(formData) {
    var fd = formData || {};
    var errors = {};

    if (!String(fd.projectTitle || '').trim()) {
      errors.projectTitle = 'Απαιτείται τίτλος έργου';
    }
    if (!String(fd.subprojectTitle || '').trim()) {
      errors.subprojectTitle = 'Απαιτείται τίτλος υποέργου';
    }
    if (!fd.noKaCode && fd.kaCode && String(fd.kaCode).trim().length > 0 && !validateKACode(fd.kaCode)) {
      errors.kaCode = 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx';
    }

    var hasMisPraxhsName = fd.misPraxhsName && String(fd.misPraxhsName).trim();
    var hasMisPraxhsCode = fd.misPraxhsCode && String(fd.misPraxhsCode).trim();
    if (hasMisPraxhsName && !hasMisPraxhsCode) {
      errors.misPraxhsCode = 'Παρακαλώ συμπληρώστε και τον κωδικό';
    }
    if (hasMisPraxhsCode && !hasMisPraxhsName) {
      errors.misPraxhsName = 'Παρακαλώ συμπληρώστε και το όνομα του κωδικού';
    }

    if (!fd.projectType) {
      errors.projectType = 'Επιλέξτε είδος';
    }

    if (fd.coFinanced) {
      var rows = Array.isArray(fd.fundingSources) ? fd.fundingSources : [];
      var validRows = rows.filter(function (r) {
        return r && r.source && r.details && parseCoFinancingAmount(r.amount) > 0;
      });
      if (validRows.length === 0) {
        errors.fundingSources = 'Προσθέστε τουλάχιστον μία πηγή χρηματοδότησης με πηγή, εξειδίκευση και ποσό';
      } else if (!validRows.some(function (r) { return !r.ownResources; })) {
        errors.fundingSources = 'Απαιτείται τουλάχιστον μία πηγή χρηματοδότησης εκτός ιδίων πόρων';
      }
    } else {
      if (!fd.fundingSource) {
        errors.fundingSource = 'Επιλέξτε πηγή χρηματοδότησης';
      }
      if (!fd.fundingDetails) {
        errors.fundingDetails = 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης';
      }
      if (!fd.approvedAmount) {
        errors.approvedAmount = 'Απαιτείται εγκεκριμένο ποσό';
      }
    }

    if (!fd.projectStatus) {
      errors.projectStatus = 'Επιλέξτε κατάσταση έργου';
    }

    return errors;
  }

  function normalizeProjectTitleForMatching(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2000-\u200B]/g, ' ')
      .replace(/\u2028/g, ' ')
      .replace(/\u2029/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findExistingProjectByTitle(projects, title) {
    var needle = normalizeProjectTitleForMatching(title);
    if (!needle) return null;
    var list = Array.isArray(projects) ? projects : [];
    for (var i = 0; i < list.length; i += 1) {
      if (normalizeProjectTitleForMatching(list[i] && list[i].projectTitle) === needle) {
        return list[i];
      }
    }
    return null;
  }

  /**
   * Αποθήκευση χωρίς projectId: αν υπάρχει έργο με ίδιο τίτλο, μπαίνει εκεί.
   */
  function resolveProjectIdWhenMissing(projectId, projectTitle, existingProjects) {
    if (projectId) return { projectId: projectId, reusedExisting: false };
    var match = findExistingProjectByTitle(existingProjects, projectTitle);
    if (match && match.projectId) {
      return { projectId: match.projectId, reusedExisting: true };
    }
    return { projectId: '', reusedExisting: false };
  }

  /**
   * Απάντηση στο «προσθήκη στο υπάρχον έργο;»
   * ΝΑΙ → βάζουμε το id. ΟΧΙ → αφήνουμε κενό (η αποθήκευση μπορεί να το ενώσει ξανά).
   */
  function applyAddToExistingChoice(existingProject, addToExisting) {
    if (existingProject && existingProject.projectId && addToExisting) {
      return { projectId: existingProject.projectId };
    }
    return { projectId: '' };
  }

  function evaluateSubprojectDelete(input) {
    var projectId = String((input && input.projectId) || '').trim();
    var subprojectId = String((input && input.subprojectId) || '').trim();
    if (!projectId || !subprojectId) {
      return { ok: false, reason: 'invalid-ids' };
    }
    if (input && input.locked) {
      return { ok: false, reason: 'locked' };
    }
    return { ok: true };
  }

  function showDeleteOnForm(formData) {
    return !!(formData && formData.projectId && formData.subprojectId);
  }

  function removeSubprojectFromList(projects, subprojectId) {
    var sid = String(subprojectId || '').trim();
    var list = Array.isArray(projects) ? projects : [];
    if (!sid) return { projects: list, changed: false };
    var next = list.filter(function (p) {
      return String((p && p.subprojectId) || '') !== sid;
    });
    return { projects: next, changed: next.length !== list.length };
  }

  return {
    validateKACode: validateKACode,
    collectPhaseARequiredErrors: collectPhaseARequiredErrors,
    normalizeProjectTitleForMatching: normalizeProjectTitleForMatching,
    findExistingProjectByTitle: findExistingProjectByTitle,
    resolveProjectIdWhenMissing: resolveProjectIdWhenMissing,
    applyAddToExistingChoice: applyAddToExistingChoice,
    evaluateSubprojectDelete: evaluateSubprojectDelete,
    showDeleteOnForm: showDeleteOnForm,
    removeSubprojectFromList: removeSubprojectFromList
  };
});
