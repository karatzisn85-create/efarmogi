/**
 * Μετά την ανάκτηση ΚΗΜΔΗΣ: ποιο παράθυρο ανοίγει και τι ζητά ο χαρακτηρισμός.
 * Ίδιες αποφάσεις με τη φόρμα — χωρίς κλήση δικτύου.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubKhmdhsPostFetch = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FETCH_START = {
    INVALID_ADAM: 'invalid_adam',
    DUPLICATE_SYMV: 'duplicate_symv',
    SUPPLEMENTARY: 'supplementary',
    FETCH: 'fetch'
  };

  var PRE_APPLY = {
    BRANCH_PICKER: 'branch_picker',
    SYMV_PLANNER: 'symv_planner',
    DUPLICATE_ANCHOR: 'duplicate_anchor',
    STITCH_A: 'stitch_a',
    DEFER_SITUATION: 'defer_situation',
    APPLY: 'apply'
  };

  var POST_APPLY_TASK = {
    DATA_REVIEW: 'data_review',
    SITUATION: 'situation',
    STITCH_B: 'stitch_b',
    REGISTRY: 'registry',
    APE: 'ape',
    EXPIRY: 'expiry'
  };

  var TASK_ORDER = [
    POST_APPLY_TASK.DATA_REVIEW,
    POST_APPLY_TASK.SITUATION,
    POST_APPLY_TASK.STITCH_B,
    POST_APPLY_TASK.REGISTRY,
    POST_APPLY_TASK.APE,
    POST_APPLY_TASK.EXPIRY
  ];

  var CHAIN_KIND = {
    CONTRACT: 'contract',
    MODIFICATION: 'modification',
    EXTENSION: 'extension',
    REPUBLICATION: 'republication',
    OTHER: 'other',
    UNCERTAIN: 'uncertain'
  };

  var CHAIN_KIND_LABEL = {
    contract: 'Αρχική σύμβαση',
    modification: 'Συμπληρωματική σύμβαση',
    extension: 'Παράταση',
    republication: 'Ορθή επανάληψη',
    other: 'Άλλο',
    uncertain: 'Χρειάζεται έλεγχος'
  };

  var USER_CHAIN_KIND_SELECT_VALUES = [
    'modification',
    'extension',
    'republication',
    'other'
  ];

  var CORRECTS_PART = {
    TITLE: 'title',
    AMOUNT: 'amount',
    DATE: 'date'
  };

  var CORRECTS_PART_LABEL = {
    title: 'Τίτλος',
    amount: 'Ποσό',
    date: 'Ημερομηνία'
  };

  function buildChainKindSelectOptions() {
    return USER_CHAIN_KIND_SELECT_VALUES.map(function (value) {
      var label = CHAIN_KIND_LABEL[value] || value;
      return { value: value, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }

  function parseAmount(raw) {
    if (raw == null || raw === '') return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    var cleaned = String(raw).trim().replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var hasComma = cleaned.indexOf(',') >= 0;
    var hasDot = cleaned.indexOf('.') >= 0;
    var normalized;
    if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = cleaned.replace(',', '.');
    } else if (hasDot) {
      var dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount === 1) {
        var frac = cleaned.split('.')[1] || '';
        normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
      } else {
        normalized = cleaned.replace(/\./g, '');
      }
    } else {
      normalized = cleaned;
    }
    var n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function shouldShowCharacterizationCard(input) {
    var opts = input || {};
    return !opts.isRoot;
  }

  function canSaveKindCard(kind, validation) {
    if (kind === CHAIN_KIND.MODIFICATION) return !!kind;
    return !!(validation && validation.ok);
  }

  function getChainKindFieldProfile(kind, options) {
    var opts = options || {};
    if (kind === CHAIN_KIND.EXTENSION) {
      return {
        title: 'Στοιχεία παράτασης',
        hint: 'Για παράταση χρόνου δεν χρειάζεται ποσό — μόνο η νέα προθεσμία εκτέλεσης.',
        needsEndDate: true,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: false
      };
    }
    if (kind === CHAIN_KIND.MODIFICATION) {
      return {
        title: 'Στοιχεία συμπληρωματικής σύμβασης',
        hint: opts.hasKhmdhsAmount
          ? 'Ελέγξτε το ποσό από το έγγραφο — διορθώστε αν διαφέρει από ΚΗΜΔΗΣ. Δηλώστε αν είναι διαφορά ή νέα συνολική αξία.'
          : 'Το ποσό λείπει από την ηλεκτρονική καταχώριση — συμπληρώστε το από το PDF και δηλώστε αν είναι διαφορά ή νέα συνολική αξία.',
        needsEndDate: false,
        needsModAmount: true,
        needsModAmountType: true,
        needsModDate: !opts.hasKhmdhsDate,
        needsRepublicationTarget: false
      };
    }
    if (kind === CHAIN_KIND.REPUBLICATION) {
      return {
        title: 'Στοιχεία ορθής επανάληψης',
        hint: 'Δηλώστε ποιο έγγραφο διορθώνει και τι αλλάζει — δεν προστίθεται ως νέα γραμμή.',
        needsEndDate: false,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: true
      };
    }
    if (kind === CHAIN_KIND.OTHER) {
      return {
        title: 'Σημείωση',
        hint: 'Καταγράφεται ως σχετική πράξη — χωρίς αυτόματη επίπτωση σε ποσά ή ημερομηνίες.',
        needsEndDate: false,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: false
      };
    }
    return null;
  }

  function validateChainKindDraft(input) {
    var opts = input || {};
    if (!opts.kind) return { ok: false, message: 'Επιλέξτε το είδος του εγγράφου.' };
    var profile = getChainKindFieldProfile(opts.kind, {
      hasKhmdhsAmount: !!opts.hasKhmdhsAmount,
      hasKhmdhsDate: !!opts.hasKhmdhsDate
    });
    if (!profile) return { ok: false, message: 'Μη έγκυρος χαρακτηρισμός.' };
    if (profile.needsEndDate && String(opts.endDate || '').trim().length < 8) {
      return { ok: false, message: 'Συμπληρώστε τη νέα ημερομηνία λήξης.' };
    }
    if (profile.needsModDate && String(opts.modDate || '').trim().length < 8) {
      return { ok: false, message: 'Συμπληρώστε την ημερομηνία της συμπληρωματικής σύμβασης.' };
    }
    if (profile.needsModAmount && !parseAmount(opts.modAmount)) {
      return { ok: false, message: 'Συμπληρώστε το ποσό της συμπληρωματικής από το έγγραφο.' };
    }
    if (profile.needsModAmountType && !opts.modAmountType) {
      return { ok: false, message: 'Δηλώστε αν το ποσό είναι διαφορά ή νέα συνολική αξία.' };
    }
    if (profile.needsRepublicationTarget) {
      if (!opts.correctsAdam) {
        return { ok: false, message: 'Επιλέξτε ποιο έγγραφο διορθώνει.' };
      }
      if (!opts.correctsParts || !opts.correctsParts.length) {
        return { ok: false, message: 'Επιλέξτε τι διορθώνει (τίτλος, ποσό ή ημερομηνία).' };
      }
    }
    return { ok: true };
  }

  function resolveFetchStartGate(input) {
    var opts = input || {};
    if (opts.invalidAdam) return { next: FETCH_START.INVALID_ADAM };
    if (opts.duplicateSymv) return { next: FETCH_START.DUPLICATE_SYMV };
    if (opts.routeSupplementary) return { next: FETCH_START.SUPPLEMENTARY };
    return { next: FETCH_START.FETCH };
  }

  /**
   * Σειρά όπως στη φόρμα μετά επιτυχή ανάκτηση, πριν την εφαρμογή.
   * Αν υπάρχει ήδη αλυσίδα και μπαίνει άλλος ΑΔΑΜ, η συρραφή Α προηγείται
   * (κρατάμε ή καθαρίζουμε) — μετά κατανομή συμβάσεων / κλάδος.
   */
  function resolvePreApplyGate(input) {
    var opts = input || {};
    var scoped = opts.contractIndex != null;
    if (
      opts.offerStitchA
      && !opts.skipStitchPromptA
      && !opts.afterLegacyUpgrade
      && !scoped
    ) {
      return { next: PRE_APPLY.STITCH_A };
    }
    if (
      opts.needsBranchPicker
      && !opts.suppressBranchPicker
      && !opts.followAllBranches
      && !opts.isMultipleContracts
      && !opts.offerSymvPlanner
      && !scoped
    ) {
      return { next: PRE_APPLY.BRANCH_PICKER };
    }
    if (
      opts.offerSymvPlanner
      && !opts.hasIncomingSymvPlan
      && !opts.reusableSymvPlan
      && !scoped
    ) {
      return { next: PRE_APPLY.SYMV_PLANNER };
    }
    if (opts.hasDuplicateConflict && !opts.skipDuplicateCheck && !scoped) {
      return { next: PRE_APPLY.DUPLICATE_ANCHOR };
    }
    if (opts.deferCancelledSeed && !opts.suppressSituationModal) {
      return { next: PRE_APPLY.DEFER_SITUATION };
    }
    return { next: PRE_APPLY.APPLY };
  }

  function assemblePostApplyTasks(input) {
    var opts = input || {};
    var tasks = [];
    var unresolvedCount = Number(opts.unresolvedReviewCount) || 0;

    if (unresolvedCount > 0) {
      tasks.push({
        id: POST_APPLY_TASK.DATA_REVIEW,
        type: POST_APPLY_TASK.DATA_REVIEW,
        question: 'Ολοκληρώστε τον έλεγχο στοιχείων ΚΗΜΔΗΣ (ποσά, χαρακτηρισμοί, ελλείψεις).',
        detail: unresolvedCount === 1
          ? 'Υπάρχει 1 εκκρεμότητα.'
          : 'Υπάρχουν ' + unresolvedCount + ' εκκρεμότητες.',
        priority: 'required',
        unresolvedCount: unresolvedCount
      });
    }

    if (opts.showSituation && opts.situation) {
      var sit = opts.situation;
      tasks.push({
        id: POST_APPLY_TASK.SITUATION,
        type: POST_APPLY_TASK.SITUATION,
        question: sit.title || 'Ελέγξτε τις προειδοποιήσεις της ανάκτησης.',
        detail: sit.message || sit.summary || '',
        priority: sit.requiresDecision ? 'required' : 'important'
      });
    }

    if (opts.stitchBSegments && opts.stitchBSegments.length >= 2) {
      tasks.push({
        id: POST_APPLY_TASK.STITCH_B,
        type: POST_APPLY_TASK.STITCH_B,
        question: 'Να θυμάται η εφαρμογή αυτή την τεχνητή αλυσίδα στις επόμενες ανανεώσεις;',
        detail: 'Θα χρησιμοποιεί ' + opts.stitchBSegments.length + ' ΑΔΑΜ-σπόρους.',
        priority: 'optional'
      });
    }

    if (opts.offerRegistry) {
      tasks.push({
        id: POST_APPLY_TASK.REGISTRY,
        type: POST_APPLY_TASK.REGISTRY,
        question: 'Θέλετε να καταγράψετε έγγραφα ΚΗΜΔΗΣ στα Αρχεία Υποέργου;',
        detail: 'Προαιρετικό — επιλέγετε ποια έγγραφα θα κρατηθούν.',
        priority: 'optional'
      });
    }

    if (opts.apeConflict) {
      tasks.push({
        id: POST_APPLY_TASK.APE,
        type: POST_APPLY_TASK.APE,
        question: 'Το ποσό ΑΠΕ διαφέρει από αυτό που πρότεινε το ΚΗΜΔΗΣ. Τι κρατάτε;',
        detail: opts.apeConflict.contractLabel
          ? 'Γραμμή: ' + opts.apeConflict.contractLabel
          : 'Μπορείτε να κρατήσετε το τρέχον ή να δεχτείτε την πρόταση ΚΗΜΔΗΣ.',
        priority: 'optional'
      });
    }

    if (opts.expiry) {
      tasks.push({
        id: POST_APPLY_TASK.EXPIRY,
        type: POST_APPLY_TASK.EXPIRY,
        question: 'Η σύμβαση φαίνεται ληγμένη ή κοντά στη λήξη. Να οριστεί η κατάσταση «Ολοκληρωμένο»;',
        detail: opts.expiry.summary || opts.expiry.message || '',
        priority: 'optional'
      });
    }

    tasks.sort(function (a, b) {
      return TASK_ORDER.indexOf(a.type) - TASK_ORDER.indexOf(b.type);
    });

    return {
      tasks: tasks,
      needsDataReviewFirst: unresolvedCount > 0,
      hasFollowUpTasks: tasks.some(function (t) { return t.type !== POST_APPLY_TASK.DATA_REVIEW; })
    };
  }

  function queueHasPendingWork(queue) {
    if (!queue) return false;
    if (queue.needsDataReviewFirst || queue.hasFollowUpTasks) return true;
    return Array.isArray(queue.tasks) && queue.tasks.length > 0;
  }

  function resolvePostFetchUi(queue, options) {
    var opts = options || {};
    if (opts.suppress || opts.skip) {
      return { openPendingTasks: false, openDataReview: false };
    }
    if (queueHasPendingWork(queue)) {
      return { openPendingTasks: true, openDataReview: false };
    }
    return { openPendingTasks: false, openDataReview: false };
  }

  function removeTaskFromQueue(queue, taskId) {
    var tasks = ((queue && queue.tasks) || []).filter(function (t) { return t.id !== taskId; });
    return {
      tasks: tasks,
      needsDataReviewFirst: tasks.some(function (t) { return t.type === POST_APPLY_TASK.DATA_REVIEW; }),
      hasFollowUpTasks: tasks.some(function (t) { return t.type !== POST_APPLY_TASK.DATA_REVIEW; })
    };
  }

  function resolveReturnToPendingList(queueAfterRemoval) {
    var hasWork = queueHasPendingWork(queueAfterRemoval);
    return { openPendingTasks: hasWork, allClear: !hasWork };
  }

  function resolveReopenPendingList(queue) {
    return {
      openPendingTasks: queueHasPendingWork(queue),
      preserveQueue: true
    };
  }

  function resolveReopenAfterFailedFetch(queue, options) {
    var opts = options || {};
    if (opts.listAlreadyOpen || opts.situationModalOpen) {
      return { openPendingTasks: false, preserveQueue: true };
    }
    return resolveReopenPendingList(queue);
  }

  function mergePostApplyQueues(prev, incoming) {
    if (!incoming) {
      return prev || { tasks: [], needsDataReviewFirst: false, hasFollowUpTasks: false };
    }
    if (!prev || !prev.tasks || !prev.tasks.length) return incoming;
    var incomingTasks = Array.isArray(incoming.tasks) ? incoming.tasks : [];
    var incomingTypes = {};
    incomingTasks.forEach(function (t) { incomingTypes[t.type] = true; });
    var keptPrev = (prev.tasks || []).filter(function (t) { return !incomingTypes[t.type]; });
    var tasks = incomingTasks.concat(keptPrev).sort(function (a, b) {
      return TASK_ORDER.indexOf(a.type) - TASK_ORDER.indexOf(b.type);
    });
    return {
      tasks: tasks,
      needsDataReviewFirst: tasks.some(function (t) { return t.type === POST_APPLY_TASK.DATA_REVIEW; }),
      hasFollowUpTasks: tasks.some(function (t) { return t.type !== POST_APPLY_TASK.DATA_REVIEW; })
    };
  }

  function fetchStartTitle(next) {
    var titles = {};
    titles[FETCH_START.INVALID_ADAM] = 'Ο κωδικός δεν έχει σωστή μορφή.';
    titles[FETCH_START.DUPLICATE_SYMV] = 'Ο ΑΔΑΜ χρησιμοποιείται ήδη σε άλλη σύμβαση του ίδιου υποέργου.';
    titles[FETCH_START.SUPPLEMENTARY] = 'Η ανάκτηση γίνεται ως συμπληρωματική — όχι ως νέα κύρια αλυσίδα.';
    titles[FETCH_START.FETCH] = '';
    return titles[next] || '';
  }

  function preApplyTitle(next) {
    var titles = {};
    titles[PRE_APPLY.BRANCH_PICKER] = 'Ποιος κλάδος αφορά αυτό το υποέργο;';
    titles[PRE_APPLY.SYMV_PLANNER] = 'Ποιες συμβάσεις ανήκουν σε αυτό το υποέργο;';
    titles[PRE_APPLY.DUPLICATE_ANCHOR] = 'Ο κωδικός υπάρχει ήδη σε άλλο υποέργο.';
    titles[PRE_APPLY.STITCH_A] = 'Να ενωθεί με τα ήδη ανακτημένα στοιχεία;';
    titles[PRE_APPLY.DEFER_SITUATION] = 'Το αίτημα φαίνεται ακυρωμένο. Πώς συνεχίζουμε;';
    titles[PRE_APPLY.APPLY] = '';
    return titles[next] || '';
  }

  return {
    FETCH_START: FETCH_START,
    PRE_APPLY: PRE_APPLY,
    POST_APPLY_TASK: POST_APPLY_TASK,
    TASK_ORDER: TASK_ORDER,
    CHAIN_KIND: CHAIN_KIND,
    CHAIN_KIND_LABEL: CHAIN_KIND_LABEL,
    USER_CHAIN_KIND_SELECT_VALUES: USER_CHAIN_KIND_SELECT_VALUES,
    CORRECTS_PART: CORRECTS_PART,
    CORRECTS_PART_LABEL: CORRECTS_PART_LABEL,
    buildChainKindSelectOptions: buildChainKindSelectOptions,
    getChainKindFieldProfile: getChainKindFieldProfile,
    validateChainKindDraft: validateChainKindDraft,
    shouldShowCharacterizationCard: shouldShowCharacterizationCard,
    canSaveKindCard: canSaveKindCard,
    resolveFetchStartGate: resolveFetchStartGate,
    resolvePreApplyGate: resolvePreApplyGate,
    assemblePostApplyTasks: assemblePostApplyTasks,
    queueHasPendingWork: queueHasPendingWork,
    resolvePostFetchUi: resolvePostFetchUi,
    removeTaskFromQueue: removeTaskFromQueue,
    resolveReturnToPendingList: resolveReturnToPendingList,
    resolveReopenPendingList: resolveReopenPendingList,
    resolveReopenAfterFailedFetch: resolveReopenAfterFailedFetch,
    mergePostApplyQueues: mergePostApplyQueues,
    fetchStartTitle: fetchStartTitle,
    preApplyTitle: preApplyTitle
  };
});
