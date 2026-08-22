/**
 * Πύλη Διαφάνειας: ποιος βλέπει / δημοσιεύει, ποια υποέργα μπαίνουν
 * στο δημόσιο αρχείο, ποια πεδία εμφανίζονται. Χωρίς ανέβασμα στο δίκτυο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubPortalCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STATUS_ABANDONED = 'ΑΠΕΝΤΑΓΜΕΝΟ';

  var PORTAL_EXPORT_FIELDS_DEFAULT = {
    xrimatodotisi: true,
    proupologismos: true,
    approvedAmount: true,
    symvasiPoso: true,
    anadochos: true,
    diadikasia_anathesis: true,
    hmerominia_enarksis: true,
    adam: true,
    mis: true,
    kategoria: true
  };

  var ADAM_VISIBLE_STATUSES = {
    'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': true,
    'ΟΛΟΚΛΗΡΩΜΕΝΟ': true,
    'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': true
  };

  function showPortalButton(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN' || userRole === 'ENGINEER';
  }

  function showPortalSettingsButton(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canManagePortalPublication(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  }

  function canSeePortalWorkspace(userRole, portalEnabled) {
    if (userRole === 'SUPERADMIN') return true;
    if (!portalEnabled) return false;
    return userRole === 'ADMIN' || userRole === 'ENGINEER';
  }

  function isEngineerPortalReadOnly(userRole) {
    return userRole === 'ENGINEER';
  }

  function showPortalCardSection(portalEnabled) {
    return portalEnabled === true;
  }

  function canTogglePortalOnCard(userRole) {
    return canManagePortalPublication(userRole);
  }

  function isPortalConfigured(appConfig) {
    var cfg = appConfig || {};
    var uid = String(cfg.portalDimosUid || '').trim();
    return cfg.portalEnabled === true && !!uid;
  }

  function evaluatePortalSettings(input) {
    var opts = input || {};
    var uid = String(opts.dimosUid || '').trim();
    if (opts.portalEnabled && !uid) {
      return {
        ok: false,
        error: 'Το αναγνωριστικό Δήμου (slug) είναι υποχρεωτικό για την ενεργοποίηση.'
      };
    }
    return { ok: true };
  }

  function evaluatePortalExportAccess(actor) {
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'SUPERADMIN')) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα εξαγωγής για την Πύλη Διαφάνειας.' };
    }
    return { ok: true };
  }

  function evaluatePortalExport(input) {
    var opts = input || {};
    if (opts.exporting) return { ok: false, error: '' };
    if (!canManagePortalPublication(opts.role)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα εξαγωγής για την Πύλη Διαφάνειας.' };
    }
    var uid = String(opts.dimosUid || '').trim();
    if (!uid) {
      return { ok: false, error: 'Ορίστε πρώτα το αναγνωριστικό Δήμου από τις Ρυθμίσεις Πύλης.' };
    }
    if (!(Number(opts.selectedCount) > 0)) {
      return { ok: false, error: 'Επιλέξτε τουλάχιστον ένα υποέργο.' };
    }
    return { ok: true };
  }

  function canCommitPortalExport(input) {
    return evaluatePortalExport(input).ok;
  }

  function parseGreekAmount(str) {
    if (!str && str !== 0) return null;
    var cleaned = String(str).replace(/\./g, '').replace(',', '.');
    var num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function computePortalSingleContractTotal(baseAmountStr, supplementaryContracts) {
    var running = parseGreekAmount(baseAmountStr) || 0;
    (Array.isArray(supplementaryContracts) ? supplementaryContracts : []).forEach(function (row) {
      var amt = parseGreekAmount(row && row.amount);
      if (amt && amt > 0) running += amt;
    });
    return running > 0 ? running : null;
  }

  function buildErgonEntry(sp, fieldMask, mergeCompleted) {
    var mask = {};
    var key;
    for (key in PORTAL_EXPORT_FIELDS_DEFAULT) {
      if (Object.prototype.hasOwnProperty.call(PORTAL_EXPORT_FIELDS_DEFAULT, key)) {
        mask[key] = PORTAL_EXPORT_FIELDS_DEFAULT[key];
      }
    }
    var extra = fieldMask || {};
    for (key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) mask[key] = extra[key];
    }

    var project = sp || {};
    var symvasiPoso = null;
    var anadochos = null;
    var hmEnarksis = null;
    var adam = null;

    if (project.implementationForm === 'Πολλές Συμβάσεις' && Array.isArray(project.contracts) && project.contracts.length > 0) {
      var total = 0;
      project.contracts.forEach(function (c) {
        var extras = (project.supplementaryContracts || []).filter(function (sc) {
          return sc && sc.contractIndex === project.contracts.indexOf(c);
        });
        var v = computePortalSingleContractTotal(c.amount, extras);
        if (v !== null) total += v;
      });
      symvasiPoso = total > 0 ? total : null;

      var i;
      for (i = 0; i < project.contracts.length; i += 1) {
        var name = project.contracts[i].khmdhsContractSnapshot && project.contracts[i].khmdhsContractSnapshot.anadoxosName;
        if (name) {
          anadochos = name;
          break;
        }
      }
      var firstWithDate = project.contracts.filter(function (c) { return c.date; })[0];
      if (firstWithDate) hmEnarksis = firstWithDate.date;

      var adamValues = project.contracts
        .map(function (c) { return String(c.khmdhsAdam || '').trim(); })
        .filter(Boolean);
      adam = adamValues.length > 0 ? adamValues.join(', ') : null;
    } else {
      symvasiPoso = computePortalSingleContractTotal(project.contractAmount, project.supplementaryContracts);
      anadochos = (project.khmdhsContractSnapshot && project.khmdhsContractSnapshot.anadoxosName) || null;
      hmEnarksis = project.contractDate || null;
      adam = String(project.khmdhsAdam || '').trim() || null;
    }

    var mis = project.misPraxhsCode ? String(project.misPraxhsCode).trim() || null : null;
    var rawStatus = project.projectStatus || null;
    var katastasi = (mergeCompleted && rawStatus === 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ')
      ? 'ΟΛΟΚΛΗΡΩΜΕΝΟ'
      : rawStatus;

    var entry = {
      id: project.subprojectId,
      titlos: project.subprojectTitle || null,
      katastasi: katastasi
    };

    if (mask.kategoria) entry.kategoria = project.projectType || null;
    if (mask.xrimatodotisi) entry.xrimatodotisi = project.fundingSource || null;
    if (mask.proupologismos) entry.proupologismos = parseGreekAmount(project.projectBudget);
    if (mask.approvedAmount) entry.approvedAmount = parseGreekAmount(project.approvedAmount);
    if (mask.symvasiPoso) entry.symvasiPoso = symvasiPoso;
    if (mask.anadochos) entry.anadochos = anadochos;
    if (mask.diadikasia_anathesis) {
      var proc = project.assignmentProcedure != null ? String(project.assignmentProcedure).trim() : '';
      entry.diadikasia_anathesis = proc || null;
    }
    if (mask.hmerominia_enarksis) entry.hmerominia_enarksis = hmEnarksis || null;
    if (mask.adam && ADAM_VISIBLE_STATUSES[project.projectStatus]) entry.adam = adam;
    if (mask.mis) entry.mis = mis;

    return entry;
  }

  function selectProjectsForPortalExport(projects, selectedIds) {
    var ids = {};
    (selectedIds || []).forEach(function (id) { ids[id] = true; });
    return (projects || []).filter(function (p) {
      return p && ids[p.subprojectId] && p.projectStatus !== STATUS_ABANDONED;
    });
  }

  function filterPortalHubProjects(projects, input) {
    var opts = input || {};
    var q = String(opts.search || '').trim().toLowerCase();
    var publishedIds = opts.publishedIds || [];
    var publishedSet = {};
    publishedIds.forEach(function (id) { publishedSet[id] = true; });
    return (projects || []).slice().sort(function (a, b) {
      var ta = ((a && a.projectTitle) || '') + ' ' + ((a && a.subprojectTitle) || '');
      var tb = ((b && b.projectTitle) || '') + ' ' + ((b && b.subprojectTitle) || '');
      return ta.toLowerCase().localeCompare(tb.toLowerCase(), 'el');
    }).filter(function (p) {
      if (!p) return false;
      if (q) {
        var hay = [p.projectTitle, p.subprojectTitle, p.fundingSource || ''].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      var pub = !!publishedSet[p.subprojectId];
      if (opts.filterPublished === 'published' && !pub) return false;
      if (opts.filterPublished === 'unpublished' && pub) return false;
      if (opts.filterStatus && p.projectStatus !== opts.filterStatus) return false;
      return true;
    });
  }

  function previewPortalSelection(projects, selectedIds) {
    var ids = {};
    (selectedIds || []).forEach(function (id) { ids[id] = true; });
    var sel = (projects || []).filter(function (p) { return p && ids[p.subprojectId]; });
    var totalBudget = 0;
    sel.forEach(function (p) {
      totalBudget += parseGreekAmount(p.projectBudget) || parseGreekAmount(p.approvedAmount) || 0;
    });
    return { count: sel.length, totalBudget: totalBudget };
  }

  function togglePublishedId(ids, subprojectId) {
    var list = Array.isArray(ids) ? ids.slice() : [];
    var idx = list.indexOf(subprojectId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(subprojectId);
    return list;
  }

  function applySelectFiltered(filteredProjects) {
    return (filteredProjects || []).map(function (p) { return p && p.subprojectId; }).filter(Boolean);
  }

  function idList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function hasId(ids, subprojectId) {
    return idList(ids).indexOf(subprojectId) >= 0;
  }

  function normalizePortalPublishedRecord(data) {
    var raw = data || {};
    var selected = idList(raw.subprojectIds);
    var lastExported;
    if (Array.isArray(raw.lastExportedIds)) {
      lastExported = idList(raw.lastExportedIds);
    } else if (raw.lastExportedAt) {
      lastExported = selected.slice();
    } else {
      lastExported = [];
    }
    return {
      subprojectIds: selected,
      selectedIds: selected,
      lastExportedIds: lastExported,
      lastExportedAt: raw.lastExportedAt || null,
      lastDropboxLink: raw.lastDropboxLink || null,
      inferredLastExported: !Array.isArray(raw.lastExportedIds) && !!raw.lastExportedAt
    };
  }

  function resolvePortalCardStatus(input) {
    var opts = input || {};
    var selectedForNext = !!opts.selectedForNext;
    var lastExported = !!opts.lastExported;
    if (selectedForNext && lastExported) {
      return {
        kind: 'queued-and-live',
        title: 'Στην επόμενη δημοσίευση',
        hint: 'Είναι ήδη στο κοινό. Αν το εξαιρέσετε, θα φύγει μόνο όταν ξαναγίνει εξαγωγή από την Πύλη.',
        button: 'Εξαίρεση',
        selectedForNext: true,
        liveOnPortal: true
      };
    }
    if (selectedForNext && !lastExported) {
      return {
        kind: 'queued-only',
        title: 'Σημειωμένο για την επόμενη δημοσίευση',
        hint: 'Δεν έχει ανέβει ακόμα στο κοινό. Θα εμφανιστεί όταν γίνει εξαγωγή από την Πύλη Διαφάνειας.',
        button: 'Εξαίρεση',
        selectedForNext: true,
        liveOnPortal: false
      };
    }
    if (!selectedForNext && lastExported) {
      return {
        kind: 'live-pending-removal',
        title: 'Ακόμα δημόσιο — θα φύγει στην επόμενη εξαγωγή',
        hint: 'Εξαιρέθηκε από την επόμενη δημοσίευση. Μένει στο κοινό μέχρι να γίνει νέα εξαγωγή από την Πύλη.',
        button: 'Επαναφορά',
        selectedForNext: false,
        liveOnPortal: true
      };
    }
    return {
      kind: 'off',
      title: 'Δεν θα δημοσιευτεί',
      hint: 'Σημειώστε το για να μπει στην επόμενη εξαγωγή της Πύλης. Δεν εμφανίζεται στο κοινό μέχρι τότε.',
      button: 'Συμπερίληψη',
      selectedForNext: false,
      liveOnPortal: false
    };
  }

  return {
    STATUS_ABANDONED: STATUS_ABANDONED,
    PORTAL_EXPORT_FIELDS_DEFAULT: PORTAL_EXPORT_FIELDS_DEFAULT,
    ADAM_VISIBLE_STATUSES: ADAM_VISIBLE_STATUSES,
    showPortalButton: showPortalButton,
    showPortalSettingsButton: showPortalSettingsButton,
    canManagePortalPublication: canManagePortalPublication,
    canSeePortalWorkspace: canSeePortalWorkspace,
    isEngineerPortalReadOnly: isEngineerPortalReadOnly,
    showPortalCardSection: showPortalCardSection,
    canTogglePortalOnCard: canTogglePortalOnCard,
    isPortalConfigured: isPortalConfigured,
    evaluatePortalSettings: evaluatePortalSettings,
    evaluatePortalExportAccess: evaluatePortalExportAccess,
    evaluatePortalExport: evaluatePortalExport,
    canCommitPortalExport: canCommitPortalExport,
    parseGreekAmount: parseGreekAmount,
    computePortalSingleContractTotal: computePortalSingleContractTotal,
    buildErgonEntry: buildErgonEntry,
    selectProjectsForPortalExport: selectProjectsForPortalExport,
    filterPortalHubProjects: filterPortalHubProjects,
    previewPortalSelection: previewPortalSelection,
    togglePublishedId: togglePublishedId,
    applySelectFiltered: applySelectFiltered,
    hasId: hasId,
    normalizePortalPublishedRecord: normalizePortalPublishedRecord,
    resolvePortalCardStatus: resolvePortalCardStatus
  };
});
