/**
 * Ωρίμανση έργων: ποιος βλέπει / επεξεργάζεται, αναζήτηση, φίλτρα,
 * υποχρεωτικός τίτλος στην αποθήκευση, ΑΕΠΟ στο ημερολόγιο για όποιον
 * ανοίγει την ωρίμανση. Χωρίς αποθήκευση στον δίσκο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubOrimanthiCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HUB_UNCATEGORIZED_FILTER = '__uncategorized__';
  var HUB_NO_MUNICIPAL_FILTER = '__no_municipal_unit__';
  var HUB_NO_SETTLEMENT_FILTER = '__no_settlement__';
  var AEPO_SOON_DAYS = 60;
  var NEW_PROPOSAL_STATUS = 'maturing';

  var DEFAULT_CATEGORIES_WITH_SPECS = {
    'ΥΔΡΑΥΛΙΚΑ': true
  };

  function showOrimanthiButton(_userRole) {
    return true;
  }

  function orimanthiEditEligibleRole(role) {
    return role === 'USER' || role === 'ENGINEER';
  }

  function isActiveApprovedUser(user) {
    if (!user) return false;
    if (user.active === false || user.approved === false) return false;
    return true;
  }

  function resolveOrimanthiCanEditFlag(user) {
    return !!(user && orimanthiEditEligibleRole(user.role) && user.orimanthiCanEdit === true);
  }

  function canManageOrimanthi(user) {
    if (!isActiveApprovedUser(user)) return false;
    if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
    return resolveOrimanthiCanEditFlag(user);
  }

  function isOrimanthiReadOnly(input) {
    var opts = input || {};
    return orimanthiEditEligibleRole(opts.role) && !opts.orimanthiCanEdit;
  }

  function includeAepoInCalendar(input) {
    return showOrimanthiButton(input && input.role);
  }

  function evaluateProposalSave(proposal) {
    var title = String((proposal && proposal.title) || '').trim();
    if (!title) {
      return { ok: false, field: 'title', error: 'Δώστε τίτλο για το έργο' };
    }
    return { ok: true };
  }

  function defaultCategoryHasSpecializations(category) {
    var key = String(category || '').trim();
    return !!DEFAULT_CATEGORIES_WITH_SPECS[key];
  }

  function evaluateNewProposal(draft, options) {
    var opts = options || {};
    var titleGate = evaluateProposalSave(draft);
    if (!titleGate.ok) {
      return { ok: false, field: 'title', error: 'Δώστε τίτλο για το νέο έργο' };
    }
    var category = String((draft && draft.projectCategory) || '').trim();
    if (!category) {
      return { ok: false, field: 'category', error: 'Επιλέξτε κατηγορία έργου' };
    }
    var hasSpecs = typeof opts.categoryHasSpecializations === 'function'
      ? !!opts.categoryHasSpecializations(category, opts.customSpecMap)
      : defaultCategoryHasSpecializations(category);
    if (hasSpecs && !String((draft && draft.infrastructureSpecialization) || '').trim()) {
      return {
        ok: false,
        field: 'specialization',
        error: 'Επιλέξτε εξειδίκευση για την επιλεγμένη κατηγορία'
      };
    }
    return { ok: true, status: NEW_PROPOSAL_STATUS };
  }

  function evaluateProposalDelete(input) {
    if (isOrimanthiReadOnly(input)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας ωρίμανσης έργων' };
    }
    if (!input || !input.proposalId) {
      return { ok: false, error: 'Επιλέξτε έργο για διαγραφή' };
    }
    return { ok: true };
  }

  function parseProjectSearch(project, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var pendingText = ((project && project.pendingItems) || [])
      .map(function (item) { return item && item.text; })
      .filter(Boolean)
      .join(' ');
    var haystack = [
      project && project.title,
      project && project.projectCategory,
      project && project.infrastructureSpecialization,
      project && project.municipalUnit,
      project && project.settlement,
      project && project.description,
      project && project.notes,
      pendingText
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function getProjectPendingOpen(project) {
    return ((project && project.pendingItems) || []).filter(function (item) {
      return item && !item.done;
    }).length;
  }

  function parseAepoDate(value) {
    if (!value) return null;
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function isAepoDueSoon(project, now, days) {
    var d = parseAepoDate(project && project.aepoRenewalDate);
    if (!d) return false;
    var limit = now ? new Date(now.getTime()) : new Date();
    var windowDays = days == null ? AEPO_SOON_DAYS : days;
    limit.setDate(limit.getDate() + windowDays);
    return d.getTime() <= limit.getTime();
  }

  function matchesHubQuickFilter(project, quickFilter) {
    if (!quickFilter) return true;
    switch (quickFilter) {
      case 'maturing':
        return project.status === 'maturing' || project.status === 'draft';
      case 'ready':
        return project.status === 'ready';
      case 'approved':
        return project.status === 'approved';
      case 'aepo_soon':
        return isAepoDueSoon(project);
      case 'pending':
        return getProjectPendingOpen(project) > 0;
      default:
        return true;
    }
  }

  function matchesHubFilters(project, filters) {
    var opts = filters || {};
    if (!parseProjectSearch(project, opts.search)) return false;
    if (opts.categoryFilter === HUB_UNCATEGORIZED_FILTER) {
      if (project.projectCategory) return false;
    } else if (opts.categoryFilter && (project.projectCategory || '') !== opts.categoryFilter) {
      return false;
    }
    if (opts.statusFilter && project.status !== opts.statusFilter) return false;
    if (opts.municipalUnitFilter === HUB_NO_MUNICIPAL_FILTER) {
      if (String(project.municipalUnit || '').trim()) return false;
    } else if (opts.municipalUnitFilter && (project.municipalUnit || '') !== opts.municipalUnitFilter) {
      return false;
    }
    if (opts.settlementFilter === HUB_NO_SETTLEMENT_FILTER) {
      if (String(project.settlement || '').trim()) return false;
    } else if (opts.settlementFilter && (project.settlement || '') !== opts.settlementFilter) {
      return false;
    }
    return true;
  }

  function filterOrimanthiHub(proposals, filters) {
    var opts = filters || {};
    return (proposals || []).filter(function (project) {
      return matchesHubFilters(project, opts) && matchesHubQuickFilter(project, opts.quickFilter);
    });
  }

  return {
    HUB_UNCATEGORIZED_FILTER: HUB_UNCATEGORIZED_FILTER,
    HUB_NO_MUNICIPAL_FILTER: HUB_NO_MUNICIPAL_FILTER,
    HUB_NO_SETTLEMENT_FILTER: HUB_NO_SETTLEMENT_FILTER,
    AEPO_SOON_DAYS: AEPO_SOON_DAYS,
    NEW_PROPOSAL_STATUS: NEW_PROPOSAL_STATUS,
    showOrimanthiButton: showOrimanthiButton,
    orimanthiEditEligibleRole: orimanthiEditEligibleRole,
    resolveOrimanthiCanEditFlag: resolveOrimanthiCanEditFlag,
    canManageOrimanthi: canManageOrimanthi,
    isOrimanthiReadOnly: isOrimanthiReadOnly,
    includeAepoInCalendar: includeAepoInCalendar,
    defaultCategoryHasSpecializations: defaultCategoryHasSpecializations,
    evaluateProposalSave: evaluateProposalSave,
    evaluateNewProposal: evaluateNewProposal,
    evaluateProposalDelete: evaluateProposalDelete,
    parseProjectSearch: parseProjectSearch,
    getProjectPendingOpen: getProjectPendingOpen,
    isAepoDueSoon: isAepoDueSoon,
    matchesHubQuickFilter: matchesHubQuickFilter,
    matchesHubFilters: matchesHubFilters,
    filterOrimanthiHub: filterOrimanthiHub
  };
});
