/**
 * Στατιστικά, τεχνικό πρόγραμμα και εξαγωγή δεδομένων:
 * ποιος βλέπει το κουμπί, ποια υποέργα μετράνε, πότε επιτρέπεται η εξαγωγή.
 * Χωρίς δημιουργία αρχείου.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubReportsExport = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STATUS_ABANDONED = 'ΑΠΕΝΤΑΓΜΕΝΟ';
  var STATUS_IN_PROGRESS = 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ';
  var STATUS_COMPLETED = 'ΟΛΟΚΛΗΡΩΜΕΝΟ';

  function showStatisticsButton() {
    return true;
  }

  function showTechnicalProgramButton(userRole) {
    return userRole !== 'ENGINEER';
  }

  function showDataExportButton() {
    return true;
  }

  function showPdfReportsButton() {
    return true;
  }

  function isAbandoned(project) {
    return !!(project && project.projectStatus === STATUS_ABANDONED);
  }

  function excludeAbandoned(projects) {
    return (projects || []).filter(function (p) { return !isAbandoned(p); });
  }

  function resolveExportProjects(input) {
    var opts = input || {};
    var filtered = opts.filteredProjects || [];
    if (opts.explicitAbandoned) return filtered.slice();
    return excludeAbandoned(filtered);
  }

  function isExportFilterActive(exportCount, totalCount) {
    return Number(exportCount) < Number(totalCount);
  }

  function canCommitDataExport(selectedFieldCount) {
    return (Number(selectedFieldCount) || 0) > 0;
  }

  function evaluateDataExport(selectedFieldCount) {
    if (!canCommitDataExport(selectedFieldCount)) {
      return { ok: false, error: 'Παρακαλώ επιλέξτε τουλάχιστον ένα πεδίο για εξαγωγή.' };
    }
    return { ok: true };
  }

  function parseRemainingAmount(value) {
    if (!value) return 0;
    var cleaned = value.toString().trim().replace(/\./g, '').replace(',', '.');
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function projectMatchesTechnicalYear(project, selectedYear) {
    var yearStr = String(selectedYear == null ? '' : selectedYear).trim();
    var projectYear = String((project && project.remainingAmountYear) || '').trim();
    if (projectYear !== '' && projectYear !== yearStr) return false;
    return true;
  }

  function buildTechnicalProgramRows(projects, selectedYear) {
    var rows = [];
    (projects || []).forEach(function (project) {
      if (!projectMatchesTechnicalYear(project, selectedYear)) return;
      var aleCodes = (project.aleCodes && Array.isArray(project.aleCodes))
        ? project.aleCodes.filter(function (c) { return c && String(c).trim(); })
        : (project.aleCode ? [project.aleCode] : []);
      var aleAmounts = project.aleRemainingAmounts && Array.isArray(project.aleRemainingAmounts)
        ? project.aleRemainingAmounts
        : [];
      if (aleCodes.length > 1 && aleAmounts.length > 0) {
        aleCodes.forEach(function (aleCode, idx) {
          var amount = aleAmounts[idx] || '';
          if (parseRemainingAmount(amount) > 0) {
            rows.push({ project: project, aleCode: aleCode, amount: amount });
          }
        });
      } else {
        var totalAmount = project.remainingAmount || '';
        if (parseRemainingAmount(totalAmount) > 0) {
          rows.push({
            project: project,
            aleCode: aleCodes.length > 0 ? aleCodes[0] : '',
            amount: totalAmount
          });
        }
      }
    });
    return rows;
  }

  function canCommitTechnicalExport(rows) {
    return !!(rows && rows.length);
  }

  function evaluateTechnicalExport(rows, selectedYear) {
    if (!canCommitTechnicalExport(rows)) {
      return {
        ok: false,
        error: 'Δεν βρέθηκαν υποέργα με υπόλοιπα για το έτος ' + selectedYear + '.'
      };
    }
    return { ok: true };
  }

  function applyPortfolioDrill(projects, subprojectIds) {
    var list = projects || [];
    if (!subprojectIds || !subprojectIds.length) return list.slice();
    var set = {};
    subprojectIds.forEach(function (id) { set[id] = true; });
    return list.filter(function (p) { return p && set[p.subprojectId]; });
  }

  function engineerStatisticsScopeNote(role, visibleCount) {
    if (role !== 'ENGINEER') return '';
    return 'Μόνο υποέργα της χρέωσής σας (' + visibleCount + ')';
  }

  function buildStatisticsFilterNote(input) {
    var opts = input || {};
    var parts = [];
    if (opts.scopeNote) parts.push(opts.scopeNote);
    if (opts.drillLabel) parts.push('λίστα: ' + opts.drillLabel);
    if (Number(opts.activeFilterCount) > 0) {
      parts.push(opts.activeFilterCount + ' φίλτρα');
    }
    var search = opts.searchText != null ? String(opts.searchText).trim() : '';
    if (search) parts.push('αναζήτηση «' + search.slice(0, 40) + '»');
    if (opts.status) parts.push('κατάσταση: ' + opts.status);
    if (opts.type) parts.push('είδος: ' + opts.type);
    var scope = Number(opts.scopeCount) || 0;
    return parts.length ? scope + ' υποέργα · ' + parts.join(' · ') : scope + ' υποέργα';
  }

  var PDF_TABS = [
    { id: 'subprojects', label: 'Υποέργα' },
    { id: 'entaxeis', label: 'Εντάξεις' },
    { id: 'proskliseis', label: 'Προσκλήσεις' },
    { id: 'egkriseis', label: 'Εγκρίσεις' }
  ];

  var PDF_TAB_NAMES = {
    subprojects: 'Αναφορά Υποέργων',
    entaxeis: 'Αναφορά Εντάξεων',
    proskliseis: 'Αναφορά Προσκλήσεων',
    egkriseis: 'Αναφορά Εγκρίσεων Διάθεσης Πίστωσης'
  };

  function showCardReportButton() {
    return true;
  }

  function canSavePdfReport(input) {
    var opts = input || {};
    return !opts.saving && !opts.generating;
  }

  function countPdfSubprojectsSummary(projects) {
    var list = projects || [];
    var executing = 0;
    var completed = 0;
    list.forEach(function (p) {
      var s = String((p && p.projectStatus) || '').toLowerCase();
      if (s.indexOf('εκτελ') >= 0) executing += 1;
      if (s.indexOf('ολοκλ') >= 0 || s.indexOf('αποπλ') >= 0) completed += 1;
    });
    return {
      total: list.length,
      executing: executing,
      completed: completed
    };
  }

  function normalizeReportText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getLinkedEntaxeis(entaxeis, subprojectId) {
    return (entaxeis || []).filter(function (e) {
      return Array.isArray(e.subprojectIds) && e.subprojectIds.indexOf(subprojectId) >= 0;
    });
  }

  function getLinkedProskliseis(proskliseis, project) {
    var normTitle = normalizeReportText(project && project.projectTitle);
    var seen = {};
    var matches = [];
    (proskliseis || []).forEach(function (p) {
      var linked = false;
      if (p.linkedSubprojectId === project.subprojectId) linked = true;
      if (normalizeReportText(p.title) === normTitle) linked = true;
      if (Array.isArray(p.linkedProjects)) {
        linked = linked || p.linkedProjects.some(function (lp) {
          return lp.id === project.projectId || normalizeReportText(lp.title) === normTitle;
        });
      }
      if (linked && p.prosklisiId && !seen[p.prosklisiId]) {
        seen[p.prosklisiId] = true;
        matches.push(p);
      }
    });
    return matches;
  }

  function countOverviewStatistics(projects) {
    var list = projects || [];
    var titles = {};
    var types = {};
    var inProgressCount = 0;
    var completedCount = 0;
    list.forEach(function (p) {
      var title = p && p.projectTitle;
      if (title) titles[title] = true;
      var type = (p && p.projectType) || 'Άγνωστο';
      types[type] = (types[type] || 0) + 1;
      if (p && p.projectStatus === STATUS_IN_PROGRESS) inProgressCount += 1;
      if (p && p.projectStatus === STATUS_COMPLETED) completedCount += 1;
    });
    return {
      totalProjects: list.length,
      uniqueProjects: Object.keys(titles).length,
      inProgressCount: inProgressCount,
      completedCount: completedCount,
      projectTypes: types
    };
  }

  return {
    STATUS_ABANDONED: STATUS_ABANDONED,
    STATUS_IN_PROGRESS: STATUS_IN_PROGRESS,
    STATUS_COMPLETED: STATUS_COMPLETED,
    showStatisticsButton: showStatisticsButton,
    showTechnicalProgramButton: showTechnicalProgramButton,
    showDataExportButton: showDataExportButton,
    showPdfReportsButton: showPdfReportsButton,
    excludeAbandoned: excludeAbandoned,
    resolveExportProjects: resolveExportProjects,
    isExportFilterActive: isExportFilterActive,
    canCommitDataExport: canCommitDataExport,
    evaluateDataExport: evaluateDataExport,
    parseRemainingAmount: parseRemainingAmount,
    projectMatchesTechnicalYear: projectMatchesTechnicalYear,
    buildTechnicalProgramRows: buildTechnicalProgramRows,
    canCommitTechnicalExport: canCommitTechnicalExport,
    evaluateTechnicalExport: evaluateTechnicalExport,
    applyPortfolioDrill: applyPortfolioDrill,
    engineerStatisticsScopeNote: engineerStatisticsScopeNote,
    buildStatisticsFilterNote: buildStatisticsFilterNote,
    countOverviewStatistics: countOverviewStatistics,
    PDF_TABS: PDF_TABS,
    PDF_TAB_NAMES: PDF_TAB_NAMES,
    showCardReportButton: showCardReportButton,
    canSavePdfReport: canSavePdfReport,
    countPdfSubprojectsSummary: countPdfSubprojectsSummary,
    normalizeReportText: normalizeReportText,
    getLinkedEntaxeis: getLinkedEntaxeis,
    getLinkedProskliseis: getLinkedProskliseis
  };
});
