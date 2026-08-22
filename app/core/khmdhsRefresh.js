/**
 * Ανανέωση ΚΗΜΔΗΣ: ποιος μπορεί, ποιο υποέργο μπαίνει, παλαιότητα.
 * Ίδιες αποφάσεις με την κάρτα και τη μαζική ανανέωση — χωρίς κλήση δικτύου.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubKhmdhsRefresh = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CLOSED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';
  var KHMDHS_STALE_DAYS = 30;

  function isKhmdhsChainClosedSubproject(projectOrStatus) {
    var status = typeof projectOrStatus === 'string'
      ? projectOrStatus
      : projectOrStatus && projectOrStatus.projectStatus;
    return status === CLOSED_STATUS;
  }

  function showBatchRefreshButton(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  }

  function canUserRefreshKhmdhs(user, project, options) {
    if (!user || !project) return false;
    if (isKhmdhsChainClosedSubproject(project)) return false;
    var role = user.role;
    if (role === 'USER') return false;
    if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
    if (role === 'ENGINEER') {
      return !!(options && options.visibleToEngineer);
    }
    return false;
  }

  function showCardRefreshButton(canRefresh, hasSeedOrResults) {
    return !!canRefresh && !!hasSeedOrResults;
  }

  function parseAdamType(adamRaw) {
    var m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adamRaw || '').trim());
    return m ? m[2].toUpperCase() : '';
  }

  function sanitizeAdam(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .replace(/\*+$/, '');
  }

  function pickFirstAdam() {
    var i;
    for (i = 0; i < arguments.length; i += 1) {
      var adam = sanitizeAdam(arguments[i]);
      if (adam) return adam;
    }
    return '';
  }

  function getKhmdhsRefreshSeedAdam(project) {
    if (!project) {
      return { adam: '', source: 'none', label: '' };
    }

    var branchAdam = pickFirstAdam(project.khmdhsBranchAnchorAdam);
    if (branchAdam) {
      var branchType = parseAdamType(branchAdam);
      var branchLabels = {
        SYMV: 'άγκυρα — σύμβαση',
        PROC: 'άγκυρα — δημοσίευση',
        REQ: 'άγκυρα — αίτημα'
      };
      return {
        adam: branchAdam,
        source: 'branch',
        label: branchLabels[branchType] || 'άγκυρα υποέργου'
      };
    }

    var reqAdam = pickFirstAdam(
      project.khmdhsRequestAdam,
      project.khmdhsRequestSnapshot && project.khmdhsRequestSnapshot.referenceNumber
    );
    if (reqAdam && parseAdamType(reqAdam) === 'REQ') {
      return { adam: reqAdam, source: 'req', label: 'πρωτογενές αίτημα (REQ)' };
    }

    var procAdam = pickFirstAdam(
      project.khmdhsNoticeAdam,
      project.khmdhsNoticeSnapshot && project.khmdhsNoticeSnapshot.referenceNumber
    );
    if (procAdam) {
      return { adam: procAdam, source: 'proc', label: 'δημοσίευση / πρόσκληση (PROC)' };
    }

    var awrdAdam = pickFirstAdam(
      project.khmdhsAwardAdam,
      project.khmdhsAwardSnapshot && project.khmdhsAwardSnapshot.referenceNumber
    );
    if (awrdAdam) {
      return { adam: awrdAdam, source: 'awrd', label: 'ανάθεση (AWRD)' };
    }

    var contractAdams = (project.contracts || []).map(function (c) {
      return c && c.khmdhsAdam;
    });
    var symvAdam = pickFirstAdam.apply(null, [
      project.khmdhsAdam,
      project.khmdhsContractSnapshot && project.khmdhsContractSnapshot.referenceNumber
    ].concat(contractAdams).concat([project.khmdhsChainSeedAdam]));
    if (symvAdam) {
      return { adam: symvAdam, source: 'symv', label: 'σύμβαση (SYMV)' };
    }

    var legacy = pickFirstAdam(project.khmdhsChainSeedAdam);
    if (legacy) {
      return { adam: legacy, source: 'legacy', label: 'αποθηκευμένος ΑΔΑΜ αλυσίδας' };
    }

    return { adam: '', source: 'none', label: '' };
  }

  function collectKhmdhsFetchedAtTimestamps(project) {
    if (!project) return [];
    var stamps = [];
    function push(iso) {
      if (!iso) return;
      var t = Date.parse(String(iso));
      if (!Number.isNaN(t)) stamps.push(t);
    }
    push(project.khmdhsRequestFetchedAt);
    push(project.khmdhsNoticeFetchedAt);
    push(project.khmdhsAwardFetchedAt);
    push(project.khmdhsContractFetchedAt);
    push(project.khmdhsCommitmentFetchedAt);
    push(project.khmdhsChainLastRefreshedAt);
    (project.khmdhsCommitmentDecisions || []).forEach(function (d) {
      push(d && d.fetchedAt);
    });
    (project.khmdhsPayments || []).forEach(function (p) {
      push(p && p.fetchedAt);
    });
    (project.contracts || []).forEach(function (c) {
      push(c && c.khmdhsContractFetchedAt);
    });
    return stamps;
  }

  function getKhmdhsRefreshAge(project, nowMs) {
    var now = nowMs == null ? Date.now() : nowMs;
    // Μετά από επιτυχημένη ανανέωση (ακόμα και χωρίς διαφορές) μετράει
    // πότε κοιτάξαμε το ΚΗΜΔΗΣ — όχι την παλιά ημερομηνία ενός εγγράφου.
    var lastCheck = project ? Date.parse(String(project.khmdhsChainLastRefreshedAt || '')) : NaN;
    if (!Number.isNaN(lastCheck)) {
      return {
        ageDays: Math.floor((now - lastCheck) / (24 * 60 * 60 * 1000)),
        lastRefreshed: new Date(lastCheck).toISOString()
      };
    }
    var stamps = collectKhmdhsFetchedAtTimestamps(project);
    if (!stamps.length) return { ageDays: null, lastRefreshed: null };
    var oldest = Math.min.apply(null, stamps);
    var newest = Math.max.apply(null, stamps);
    return {
      ageDays: Math.floor((now - oldest) / (24 * 60 * 60 * 1000)),
      lastRefreshed: new Date(newest).toISOString()
    };
  }

  function isKhmdhsRefreshStale(project, maxAgeDays, nowMs) {
    var days = maxAgeDays == null ? KHMDHS_STALE_DAYS : maxAgeDays;
    var age = getKhmdhsRefreshAge(project, nowMs);
    if (age.ageDays == null) return true;
    return age.ageDays >= days;
  }

  function isBatchItemStale(item, maxAgeDays) {
    if (!item) return false;
    var days = maxAgeDays == null ? KHMDHS_STALE_DAYS : maxAgeDays;
    if (item.ageDays == null || item.lastRefreshed == null) return true;
    return Number(item.ageDays) >= days;
  }

  function classifyForBatchRefresh(project, options) {
    var opts = options || {};
    if (!project) return { kind: 'ignore' };
    var pTitle = String(project.projectTitle || '').trim();
    var sTitle = String(project.subprojectTitle || '').trim();
    if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') {
      return { kind: 'ignore' };
    }
    var sid = project.subprojectId;
    if (!sid) return { kind: 'ignore' };
    var label = sTitle;
    if (isKhmdhsChainClosedSubproject(project)) {
      return { kind: 'skipped', id: sid, label: label, reason: 'Ολοκληρωμένο' };
    }
    var seedAdam = opts.seedAdam;
    if (seedAdam == null) {
      seedAdam = getKhmdhsRefreshSeedAdam(project).adam;
    }
    if (!seedAdam) {
      return { kind: 'skipped', id: sid, label: label, reason: 'Χωρίς ΑΔΑΜ' };
    }
    if (opts.locked) {
      return { kind: 'skipped', id: sid, label: label, reason: 'Κλειδωμένο' };
    }
    var age = getKhmdhsRefreshAge(project, opts.now);
    return {
      kind: 'eligible',
      id: sid,
      label: label,
      seedAdam: seedAdam,
      lastRefreshed: age.lastRefreshed,
      ageDays: age.ageDays
    };
  }

  function classifyProjectsForBatch(projects, options) {
    var opts = options || {};
    var locks = opts.locks || {};
    var eligible = [];
    var skipped = [];
    (projects || []).forEach(function (project) {
      var row = classifyForBatchRefresh(project, {
        locked: !!(project && locks[project.subprojectId]),
        now: opts.now
      });
      if (row.kind === 'ignore') return;
      if (row.kind === 'skipped') skipped.push(row);
      else eligible.push(row);
    });
    if (opts.onlyStale) {
      eligible = eligible.filter(function (item) {
        return isBatchItemStale(item, opts.maxAgeDays);
      });
    }
    return { eligible: eligible, skipped: skipped };
  }

  function evaluateBatchRefreshAccess(input) {
    var opts = input || {};
    var username = String(opts.username || '').trim();
    if (!username) return { ok: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    var actor = opts.actor;
    if (!actor || actor.active === false || actor.approved === false) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (actor.role !== 'ADMIN' && actor.role !== 'SUPERADMIN') {
      return { ok: false, error: 'Η μαζική ανανέωση επιτρέπεται μόνο σε διαχειριστές.' };
    }
    return { ok: true };
  }

  function evaluateSingleRefreshStart(input) {
    var opts = input || {};
    var username = String(opts.username || '').trim();
    if (!username) return { ok: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    var actor = opts.actor;
    if (!actor || actor.active === false || actor.approved === false) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα' };
    }
    var sid = String(opts.subprojectId || '').trim();
    if (!sid) return { ok: false, error: 'Λείπει αναγνωριστικό υποέργου' };
    if (opts.locked) {
      return {
        ok: false,
        error: 'Το υποέργο επεξεργάζεται από ' + (opts.lockedBy || 'άλλον χρήστη') + '. Δοκιμάστε ξανά σε λίγο.'
      };
    }
    if (!opts.project) return { ok: false, error: 'Δεν βρέθηκε το υποέργο' };
    if (isKhmdhsChainClosedSubproject(opts.project)) {
      return {
        ok: false,
        error: 'Το υποέργο είναι ολοκληρωμένο και αποπληρωμένο — ο κύκλος ΚΗΜΔΗΣ έχει κλείσει.'
      };
    }
    if (!canUserRefreshKhmdhs(actor, opts.project, { visibleToEngineer: opts.visibleToEngineer })) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα ανανέωσης ΚΗΜΔΗΣ για αυτό το υποέργο' };
    }
    if (!opts.seedAdam) {
      return {
        ok: false,
        error: 'Δεν βρέθηκε ΑΔΑΜ αφετηρίας για ανανέωση. Ανοίξτε την επεξεργασία του υποέργου, εισάγετε τον ΑΔΑΜ στη Φάση Β (π.χ. αίτημα ή σύμβαση) και εκτελέστε αρχική ανάκτηση.'
      };
    }
    return { ok: true };
  }

  return {
    CLOSED_STATUS: CLOSED_STATUS,
    KHMDHS_STALE_DAYS: KHMDHS_STALE_DAYS,
    isKhmdhsChainClosedSubproject: isKhmdhsChainClosedSubproject,
    showBatchRefreshButton: showBatchRefreshButton,
    canUserRefreshKhmdhs: canUserRefreshKhmdhs,
    showCardRefreshButton: showCardRefreshButton,
    parseAdamType: parseAdamType,
    sanitizeAdam: sanitizeAdam,
    getKhmdhsRefreshSeedAdam: getKhmdhsRefreshSeedAdam,
    collectKhmdhsFetchedAtTimestamps: collectKhmdhsFetchedAtTimestamps,
    getKhmdhsRefreshAge: getKhmdhsRefreshAge,
    isKhmdhsRefreshStale: isKhmdhsRefreshStale,
    isBatchItemStale: isBatchItemStale,
    classifyForBatchRefresh: classifyForBatchRefresh,
    classifyProjectsForBatch: classifyProjectsForBatch,
    evaluateBatchRefreshAccess: evaluateBatchRefreshAccess,
    evaluateSingleRefreshStart: evaluateSingleRefreshStart
  };
});
