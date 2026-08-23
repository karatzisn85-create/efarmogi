/**
 * Επιχειρησιακό Πρόγραμμα: ποιος το ανοίγει, αναζήτηση / φίλτρα δράσεων,
 * υποχρεωτικά εισαγωγής και νέας δράσης. Χωρίς ανάγνωση Excel ή αποθήκευση.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEpProgramCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ACTION_TYPES = ['Έργο', 'Μελέτη', 'Υπηρεσία', 'Προμήθεια', 'Αγορά γης'];
  var NEW_OR_CONTINUING = ['Νέα', 'Συνεχιζόμενη'];
  var PRIORITIES = ["Α'", "Β'", "Γ'"];
  var UNGROUPED_AXIS = '__';
  var FALLBACK_EXAMPLE_LOCATION = 'Δ.Ε. Θεσσαλονίκης';
  var TEMPLATE_EMPTY_ROWS = 40;
  var TEMPLATE_EXAMPLE_ROW = 3;
  var TEMPLATE_ACTIONS_SHEET = 'ΕΠ_ΔΡΑΣΕΙΣ';
  var TEMPLATE_INFO_SHEET = 'ΟΔΗΓΙΕΣ';
  var TEMPLATE_LISTS_SHEET = 'ΛΙΣΤΕΣ';

  function quoteEpExcelSheetName(name) {
    return "'" + String(name || '').replace(/'/g, "''") + "'";
  }

  function epTemplateFixedListFormula(col) {
    var last = Math.max(2, ((col && col.values) || []).length + 1 + (col && col.allowCustom ? 20 : 0));
    var letter = (col && col.listCol) || 'A';
    return quoteEpExcelSheetName(TEMPLATE_LISTS_SHEET) + '!$' + letter + '$2:$' + letter + '$' + last;
  }

  function epTemplateGrowingListFormula(colLetter, growFrom, endRow) {
    return 'OFFSET($' + colLetter + '$' + growFrom
      + ',0,0,MAX(1,COUNTA($' + colLetter + '$' + growFrom
      + ':$' + colLetter + '$' + endRow + ')),1)';
  }

  function showEpProgramButton(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  }

  function canManageEpProgram(user) {
    return !!(user && showEpProgramButton(user.role));
  }

  function filterImportYearInput(raw) {
    return String(raw == null ? '' : raw).replace(/\D/g, '').slice(0, 4);
  }

  function defaultImportEndYear(startYear, spanYears) {
    var digits = filterImportYearInput(startYear);
    if (digits.length !== 4) return '';
    var span = spanYears === 4 ? 4 : 5;
    return String(parseInt(digits, 10) + span - 1);
  }

  function describeEpPeriod(startYear, endYear) {
    var sy = parseInt(filterImportYearInput(startYear), 10);
    var ey = parseInt(filterImportYearInput(endYear), 10);
    if (!Number.isFinite(sy) || !Number.isFinite(ey)) {
      return { ok: false, yearCount: 0, kind: '', label: '', shortLabel: '', title: '' };
    }
    if (ey < sy) {
      return { ok: false, yearCount: 0, kind: '', label: '', shortLabel: '', title: '' };
    }
    var yearCount = ey - sy + 1;
    var kind = 'other';
    var kindLabel = 'Περίοδος ' + yearCount + ' ετών';
    if (yearCount === 5) {
      kind = 'penta';
      kindLabel = 'Πενταετία';
    } else if (yearCount === 4) {
      kind = 'tetra';
      kindLabel = 'Τετραετία';
    }
    return {
      ok: yearCount === 4 || yearCount === 5,
      startYear: sy,
      endYear: ey,
      yearCount: yearCount,
      kind: kind,
      label: kindLabel + ' ' + sy + '–' + ey,
      shortLabel: sy + '–' + ey,
      title: 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ ' + sy + '-' + ey
    };
  }

  function evaluateEpPeriod(startYear, endYear) {
    var start = filterImportYearInput(startYear);
    var end = filterImportYearInput(endYear);
    if (!start || !end) {
      return { ok: false, error: 'Συμπληρώστε έτος έναρξης και λήξης' };
    }
    var period = describeEpPeriod(start, end);
    if (!period.yearCount) {
      return { ok: false, error: 'Το έτος λήξης πρέπει να είναι μετά το έτος έναρξης' };
    }
    if (!period.ok) {
      return { ok: false, error: 'Η περίοδος πρέπει να είναι τετραετία ή πενταετία' };
    }
    return { ok: true, period: period, startYear: period.startYear, endYear: period.endYear };
  }

  function evaluateEpImport(input) {
    var opts = input || {};
    var periodGate = evaluateEpPeriod(opts.startYear, opts.endYear);
    if (!periodGate.ok) return periodGate;
    var filePath = String(opts.filePath || '').trim();
    if (!filePath) {
      return { ok: false, error: 'Επιλέξτε αρχείο Excel' };
    }
    return {
      ok: true,
      startYear: periodGate.startYear,
      endYear: periodGate.endYear,
      period: periodGate.period
    };
  }

  function evaluateImportWizardStep(step, draft) {
    var data = draft || {};
    if (step === 'period') return evaluateEpPeriod(data.startYear, data.endYear);
    if (step === 'file') {
      if (!String(data.filePath || '').trim()) {
        return { ok: false, error: 'Επιλέξτε αρχείο Excel' };
      }
      return { ok: true };
    }
    return evaluateEpImport(data);
  }

  function normalizeActionTitle(title) {
    return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function uniqueActionIndex(actions, keyFn) {
    var counts = {};
    var last = {};
    (actions || []).forEach(function (action, idx) {
      var key = keyFn(action);
      if (key === '' || key == null) return;
      counts[key] = (counts[key] || 0) + 1;
      last[key] = idx;
    });
    var unique = {};
    Object.keys(counts).forEach(function (key) {
      if (counts[key] === 1) unique[key] = last[key];
    });
    return unique;
  }

  function mergeLinkedIds(current, incoming) {
    var out = [];
    var seen = {};
    (current || []).concat(incoming || []).forEach(function (id) {
      var sid = String(id || '').trim();
      if (!sid || seen[sid]) return;
      seen[sid] = true;
      out.push(sid);
    });
    return out;
  }

  function transferEpActionLinks(oldActions, newActions) {
    var result = (newActions || []).map(function (action) {
      var copy = {};
      Object.keys(action || {}).forEach(function (key) { copy[key] = action[key]; });
      copy.linkedSubprojectIds = mergeLinkedIds(action && action.linkedSubprojectIds, []);
      return copy;
    });
    var oldByAa = uniqueActionIndex(oldActions, function (a) {
      return a && a.aa != null && a.aa !== '' ? String(a.aa) : '';
    });
    var newByAa = uniqueActionIndex(result, function (a) {
      return a && a.aa != null && a.aa !== '' ? String(a.aa) : '';
    });
    var oldByTitle = uniqueActionIndex(oldActions, function (a) {
      return normalizeActionTitle(a && a.title);
    });
    var newByTitle = uniqueActionIndex(result, function (a) {
      return normalizeActionTitle(a && a.title);
    });
    var used = {};
    var transferred = 0;
    var unmatched = 0;
    (oldActions || []).forEach(function (old) {
      var links = (old && old.linkedSubprojectIds) || [];
      if (!links.length) return;
      var newIdx = null;
      var aaKey = old && old.aa != null && old.aa !== '' ? String(old.aa) : '';
      if (aaKey && oldByAa[aaKey] != null && newByAa[aaKey] != null) {
        newIdx = newByAa[aaKey];
      } else {
        var titleKey = normalizeActionTitle(old && old.title);
        if (titleKey && oldByTitle[titleKey] != null && newByTitle[titleKey] != null) {
          newIdx = newByTitle[titleKey];
        }
      }
      if (newIdx == null || used[newIdx]) {
        unmatched += 1;
        return;
      }
      used[newIdx] = true;
      result[newIdx].linkedSubprojectIds = mergeLinkedIds(result[newIdx].linkedSubprojectIds, links);
      transferred += 1;
    });
    return { actions: result, transferred: transferred, unmatched: unmatched };
  }

  function isSameEpPeriod(program, startYear, endYear) {
    if (!program) return false;
    var sy = parseInt(startYear, 10);
    var ey = parseInt(endYear, 10);
    var ps = parseInt(program.startYear, 10);
    var pe = parseInt(program.endYear, 10);
    return Number.isFinite(sy) && Number.isFinite(ey) && ps === sy && pe === ey;
  }

  function pickLinkSourceProgram(programs, startYear, endYear) {
    var same = (programs || []).filter(function (p) {
      return isSameEpPeriod(p, startYear, endYear);
    });
    if (!same.length) return null;
    var activeSame = same.filter(function (p) { return p.isActive; })[0];
    if (activeSame) return activeSame;
    return same.slice().sort(function (a, b) {
      return String(b.importedAt || '').localeCompare(String(a.importedAt || ''));
    })[0] || null;
  }

  function summarizeImportImpact(programs, startYear, endYear) {
    var period = describeEpPeriod(startYear, endYear);
    var active = findActiveProgram(programs);
    var source = pickLinkSourceProgram(programs, startYear, endYear);
    return {
      period: period,
      willArchiveActive: !!active,
      activeTitle: active ? active.title : '',
      activePeriodLabel: active ? describeEpPeriod(active.startYear, active.endYear).label : '',
      samePeriod: !!source,
      willTransferLinks: !!source,
      sourceTitle: source ? source.title : '',
      keepOldProgram: true
    };
  }

  function describeEpImportReload(programs, startYear, endYear, extras) {
    var extra = extras || {};
    var impact = summarizeImportImpact(programs, startYear, endYear);
    var periodOk = !!(impact.period && impact.period.ok);
    if (impact.samePeriod && periodOk) {
      var label = impact.period.label;
      var currentLabel = impact.activePeriodLabel || impact.sourceTitle || label;
      var counts = '';
      if (extra.transferred != null) {
        counts = extra.transferred === 1
          ? ' Θα μεταφερθεί 1 σύνδεση με υποέργο.'
          : ' Θα μεταφερθούν ' + extra.transferred + ' συνδέσεις με υποέργα.';
        if (extra.unmatched) {
          counts += extra.unmatched === 1
            ? ' 1 δεν ταυτίστηκε και μένει στο αρχειοθετημένο πρόγραμμα.'
            : ' ' + extra.unmatched + ' δεν ταυτίστηκαν και μένουν στο αρχειοθετημένο πρόγραμμα.';
        }
      }
      return {
        show: true,
        kind: 'samePeriod',
        title: 'Υπάρχει ήδη επιχειρησιακό για την ' + label,
        body: 'Αν φορτώσετε ξανά την ίδια περίοδο, το νέο αρχείο γίνεται το ενεργό πρόγραμμα. Το σημερινό ('
          + currentLabel
          + ') δεν διαγράφεται — φυλάσσεται στο αρχείο. Οι συνδέσεις με υποέργα μεταφέρονται στις νέες δράσεις όταν έχουν τον ίδιο Α/Α ή τον ίδιο τίτλο. Όσες δεν ταυτιστούν μένουν στο παλιό αρχείο και δεν εμφανίζονται διπλά στην κάρτα του υποέργου. Τα στατιστικά υπολογίζονται ξανά από τις νέες δράσεις.'
          + counts
      };
    }
    if (impact.willArchiveActive && periodOk) {
      return {
        show: true,
        kind: 'newPeriod',
        title: 'Νέα περίοδος — το παλιό φυλάσσεται',
        body: 'Το ενεργό πρόγραμμα ('
          + (impact.activePeriodLabel || impact.activeTitle)
          + ') θα αρχειοθετηθεί και δεν διαγράφεται. Οι συνδέσεις του μένουν στο αρχείο και φαίνονται στις κάρτες των υποέργων. Το νέο γίνεται ενεργό.'
      };
    }
    if (impact.willArchiveActive) {
      return {
        show: true,
        kind: 'hasExisting',
        title: 'Υπάρχει ήδη ενεργό επιχειρησιακό',
        body: 'Έχετε καταχωρήσει '
          + (impact.activePeriodLabel || 'ένα πρόγραμμα')
          + '. Αν επιλέξετε την ίδια περίοδο και φορτώσετε νέο αρχείο, το παλιό θα αρχειοθετηθεί (δεν διαγράφεται) και οι συνδέσεις θα μεταφερθούν όπου ταιριάζει ο Α/Α ή ο τίτλος.'
      };
    }
    return { show: false, kind: '', title: '', body: '' };
  }

  function actionAaKey(action) {
    return action && action.aa != null && action.aa !== '' ? String(action.aa) : '';
  }

  function collectEpActionsForSubproject(programs, subprojectId) {
    var sid = String(subprojectId || '').trim();
    if (!sid) return [];
    var activeAa = {};
    var activeTitles = {};
    (programs || []).forEach(function (program) {
      if (!program || !program.isActive) return;
      ((program.actions) || []).forEach(function (action) {
        var aa = actionAaKey(action);
        var title = normalizeActionTitle(action && action.title);
        if (aa) activeAa[aa] = true;
        if (title) activeTitles[title] = true;
      });
    });
    var activeHits = [];
    var archivedHits = [];
    (programs || []).forEach(function (program) {
      ((program && program.actions) || []).forEach(function (action) {
        if (((action && action.linkedSubprojectIds) || []).indexOf(sid) === -1) return;
        var row = {
          id: action.id,
          aa: action.aa,
          title: action.title,
          axisCode: action.axisCode,
          measureCode: action.measureCode,
          objectiveCode: action.objectiveCode,
          actionType: action.actionType,
          programId: program.id,
          programTitle: program.title,
          isActive: !!program.isActive,
          periodLabel: describeEpPeriod(program.startYear, program.endYear).label
        };
        if (program.isActive) activeHits.push(row);
        else archivedHits.push(row);
      });
    });
    archivedHits.forEach(function (row) {
      var aa = actionAaKey(row);
      var title = normalizeActionTitle(row.title);
      if ((aa && activeAa[aa]) || (title && activeTitles[title])) return;
      activeHits.push(row);
    });
    return activeHits;
  }

  function buildEpSubprojectLinkMap(programs) {
    var sorted = (programs || []).slice().sort(function (a, b) {
      return (b && b.isActive ? 1 : 0) - (a && a.isActive ? 1 : 0);
    });
    var map = {};
    sorted.forEach(function (program) {
      ((program && program.actions) || []).forEach(function (action) {
        ((action && action.linkedSubprojectIds) || []).forEach(function (sid) {
          if (!sid || map[sid]) return;
          map[sid] = {
            id: action.id,
            aa: action.aa,
            title: action.title,
            axisCode: action.axisCode,
            measureCode: action.measureCode,
            objectiveCode: action.objectiveCode,
            actionType: action.actionType,
            programId: program.id,
            programTitle: program.title,
            isActive: !!program.isActive,
            periodLabel: describeEpPeriod(program.startYear, program.endYear).label
          };
        });
      });
    });
    return map;
  }

  function parseEpActionAa(raw) {
    var digits = String(raw == null ? '' : raw).trim();
    if (!digits) {
      return { ok: false, field: 'aa', error: 'Ο Α/Α είναι υποχρεωτικός' };
    }
    if (!/^\d+$/.test(digits)) {
      return { ok: false, field: 'aa', error: 'Ο Α/Α πρέπει να είναι θετικός αριθμός' };
    }
    var aa = parseInt(digits, 10);
    if (!Number.isFinite(aa) || aa < 1) {
      return { ok: false, field: 'aa', error: 'Ο Α/Α πρέπει να είναι θετικός αριθμός' };
    }
    return { ok: true, aa: aa };
  }

  function suggestNextEpActionAa(actions) {
    var max = 0;
    (actions || []).forEach(function (action) {
      var n = parseInt(action && action.aa, 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
    return max + 1;
  }

  function formatEpCardLinkLabel(link) {
    if (!link) return '';
    var aa = link.aa != null && link.aa !== '' ? '#' + link.aa : '';
    var title = String(link.title || '').trim();
    var period = link.periodLabel || '';
    var actionPart = [aa, title].filter(Boolean).join(' ');
    var parts = [];
    if (period) parts.push(period);
    if (actionPart) parts.push(actionPart);
    return parts.length ? 'ΕΠ · ' + parts.join(' · ') : 'Επιχειρησιακό';
  }

  function evaluateEpActionSave(action) {
    var title = String((action && action.title) || '').trim();
    if (!title) {
      return { ok: false, field: 'title', error: 'Ο τίτλος είναι υποχρεωτικός' };
    }
    var aaGate = parseEpActionAa(action && action.aa);
    if (!aaGate.ok) return aaGate;
    var taken = (action && action.existingAas) || [];
    var clash = taken.some(function (value) {
      return String(value) === String(aaGate.aa);
    });
    if (clash) {
      return { ok: false, field: 'aa', error: 'Ο Α/Α χρησιμοποιείται ήδη σε άλλη δράση' };
    }
    return { ok: true, title: title, aa: aaGate.aa };
  }

  function evaluateEpActionDelete(input) {
    var opts = input || {};
    if (!canManageEpProgram({ role: opts.role })) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα διαγραφής δράσεων' };
    }
    if (!opts.actionId) {
      return { ok: false, error: 'Επιλέξτε δράση για διαγραφή' };
    }
    return { ok: true };
  }

  function canExportEpProgram(input) {
    var opts = input || {};
    return canManageEpProgram({ role: opts.role }) && !!opts.hasActiveProgram;
  }

  function canCreateEpAction(input) {
    return canExportEpProgram(input);
  }

  function showEpImportOnEmpty(input) {
    var opts = input || {};
    return canManageEpProgram({ role: opts.role }) && !opts.hasActiveProgram;
  }

  function canDownloadEpTemplate(user) {
    return canManageEpProgram(user);
  }

  function defaultTemplatePeriod(nowYear) {
    var start = parseInt(nowYear, 10);
    if (!Number.isFinite(start)) start = new Date().getFullYear();
    return {
      startYear: start,
      endYear: start + 4
    };
  }

  function resolveTemplatePeriod(input) {
    var opts = input || {};
    var chosen = evaluateEpPeriod(opts.startYear, opts.endYear);
    if (chosen.ok) return chosen;
    if (opts.fallbackStartYear && opts.fallbackEndYear) {
      var fallback = evaluateEpPeriod(opts.fallbackStartYear, opts.fallbackEndYear);
      if (fallback.ok) return fallback;
    }
    var def = defaultTemplatePeriod(opts.nowYear);
    return evaluateEpPeriod(def.startYear, def.endYear);
  }

  function evaluateTemplateDownload(input) {
    return evaluateEpPeriod((input || {}).startYear, (input || {}).endYear);
  }

  function suggestTemplatePeriodDraft(input) {
    var opts = input || {};
    var chosen = evaluateEpPeriod(opts.startYear, opts.endYear);
    if (chosen.ok) {
      return {
        startYear: String(chosen.startYear),
        endYear: String(chosen.endYear),
        span: chosen.period.yearCount
      };
    }
    var def = defaultTemplatePeriod(opts.nowYear);
    return {
      startYear: String(def.startYear),
      endYear: String(def.endYear),
      span: 5
    };
  }

  function foldGreek(text) {
    return String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function formatEpTemplateLocation(unitName) {
    var name = String(unitName || '').trim();
    if (!name) return FALLBACK_EXAMPLE_LOCATION;
    var folded = foldGreek(name);
    if (/^δ\.?\s*ε\.?/.test(folded) || folded.indexOf('δημοτικ') === 0) {
      return name;
    }
    return 'Δ.Ε. ' + name;
  }

  function pickEpTemplateExampleLocation(units) {
    var list = Array.isArray(units) ? units : (units ? [units] : []);
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (String(list[i] || '').trim()) {
        return formatEpTemplateLocation(list[i]);
      }
    }
    return FALLBACK_EXAMPLE_LOCATION;
  }

  function isEpTemplateExampleTitle(title) {
    var folded = foldGreek(title);
    return folded.indexOf('παραδειγμα') === 0;
  }

  function collectEpTemplateLocations(units, exampleLocation) {
    var seen = {};
    var out = [];
    function add(name) {
      var formatted = formatEpTemplateLocation(name);
      var key = foldGreek(formatted);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(formatted);
    }
    (Array.isArray(units) ? units : (units ? [units] : [])).forEach(add);
    if (exampleLocation) add(exampleLocation);
    if (!out.length) add(FALLBACK_EXAMPLE_LOCATION);
    return out;
  }

  function buildEpTemplateListModel(options) {
    var opts = options || {};
    var locations = collectEpTemplateLocations(opts.municipalUnits, opts.exampleLocation);
    var dataEndRow = TEMPLATE_EXAMPLE_ROW + TEMPLATE_EMPTY_ROWS;
    return {
      listsSheetName: TEMPLATE_LISTS_SHEET,
      exampleRow: TEMPLATE_EXAMPLE_ROW,
      dataStartRow: TEMPLATE_EXAMPLE_ROW,
      dataEndRow: dataEndRow,
      growFromRow: TEMPLATE_EXAMPLE_ROW + 1,
      growing: [
        { key: 'axis', header: 'ΑΞΟΝΑΣ', col: 'B', namedRange: 'EPAXIS' },
        { key: 'measure', header: 'ΜΕΤΡΟ', col: 'C', namedRange: 'EPMEASURE' },
        { key: 'objective', header: 'ΕΙΔΙΚΟΣ ΣΤΟΧΟΣ', col: 'D', namedRange: 'EPOBJECTIVE' }
      ],
      fixed: [
        { key: 'actionType', header: 'ΕΙΔΟΣ ΔΡΑΣΗΣ', col: 'F', listCol: 'A', namedRange: 'EPTYPES', values: ACTION_TYPES.slice(), allowCustom: false },
        { key: 'newCont', header: 'ΝΕΑ / ΣΥΝΕΧΙΖΟΜΕΝΗ', col: 'G', listCol: 'B', namedRange: 'EPNEWCONT', values: NEW_OR_CONTINUING.slice(), allowCustom: false },
        { key: 'priority', header: 'ΠΡΟΤΕΡΑΙΟΤΗΤΑ', col: 'I', listCol: 'C', namedRange: 'EPPRIORITY', values: PRIORITIES.slice(), allowCustom: false },
        { key: 'location', header: 'ΧΩΡΟΘΕΤΗΣΗ', col: 'H', listCol: 'D', namedRange: 'EPLOCATION', values: locations, allowCustom: true }
      ]
    };
  }

  function buildEpImportTemplateModel(startYear, endYear, options) {
    var periodGate = evaluateEpPeriod(startYear, endYear);
    if (!periodGate.ok) return periodGate;
    var years = [];
    var y;
    for (y = periodGate.startYear; y <= periodGate.endYear; y += 1) years.push(y);

    var header1 = ['', '', '', '', '', '', '', '', '', 'ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΑΝΑ ΕΤΟΣ (€)'];
    years.forEach(function () { header1.push('ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΑΝΑ ΕΤΟΣ (€)'); });
    header1.push('ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΑΝΑ ΕΤΟΣ (€)');
    header1.push('ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 1η', 'ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 2η', 'ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 3η');

    var header2 = [
      'Α/Α',
      'ΑΞΟΝΑΣ',
      'ΜΕΤΡΟ',
      'ΕΙΔΙΚΟΣ ΣΤΟΧΟΣ',
      'ΤΙΤΛΟΣ ΔΡΑΣΗΣ',
      'ΕΙΔΟΣ ΔΡΑΣΗΣ',
      'ΝΕΑ / ΣΥΝΕΧΙΖΟΜΕΝΗ',
      'ΧΩΡΟΘΕΤΗΣΗ',
      'ΠΡΟΤΕΡΑΙΟΤΗΤΑ',
      'ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ'
    ].concat(years.map(String)).concat(['ΣΥΝΟΛΟ', '', '', '']);

    var opts = options || {};
    var exampleLocation = opts.exampleLocation
      ? formatEpTemplateLocation(opts.exampleLocation)
      : pickEpTemplateExampleLocation(opts.municipalUnits);
    var exampleBudget = years.map(function (_, idx) { return idx === 0 ? 10000 : 0; });
    var example = [
      1,
      '1. ΠΕΡΙΒΑΛΛΟΝ ΚΑΙ ΠΟΙΟΤΗΤΑ ΖΩΗΣ',
      '1.1 Υποδομές ύδρευσης',
      '1.1.1 Δίκτυα ύδρευσης',
      'ΠΑΡΑΔΕΙΓΜΑ — διαγράψτε ή αντικαταστήστε τη γραμμή',
      'Έργο',
      'Νέα',
      exampleLocation,
      "Α'",
      'Διεύθυνση Τεχνικών Υπηρεσιών'
    ].concat(exampleBudget).concat([10000, 'ΕΣΠΑ 2021-2027', '', '']);

    var emptyRow = header2.map(function () { return ''; });
    var actionsRows = [header1, header2, example];
    for (y = 0; y < TEMPLATE_EMPTY_ROWS; y += 1) actionsRows.push(emptyRow.slice());
    var listModel = buildEpTemplateListModel({
      municipalUnits: opts.municipalUnits,
      exampleLocation: exampleLocation
    });

    var yearList = years.join(', ');
    var instructionRows = [
      ['ΠΡΟΤΥΠΟ ΕΙΣΑΓΩΓΗΣ ΕΠΙΧΕΙΡΗΣΙΑΚΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ'],
      [periodGate.period.label + ' — συμπληρώστε μία γραμμή για κάθε δράση'],
      [],
      ['Σημαντικό για εσάς'],
      ['Από τα στοιχεία που θα δώσετε σε αυτό το Excel, η εφαρμογή φτιάχνει μόνη της τις δράσεις και πλήρη στατιστικά: σύνολα ανά άξονα, μέτρο, είδος, πηγή χρηματοδότησης, χωροθέτηση, προτεραιότητα, νέα ή συνεχιζόμενα, προϋπολογισμό ανά έτος και σύνδεση με υποέργα. Δεν χρειάζεται δεύτερο φύλλο ούτε άλλη καταχώριση για τα στατιστικά.'],
      [],
      ['Πού συμπληρώνετε'],
      ['Γράφετε τις δράσεις μόνο στο φύλλο «ΕΠ_ΔΡΑΣΕΙΣ». Το φύλλο «ΟΔΗΓΙΕΣ» είναι βοήθεια. Το φύλλο «ΛΙΣΤΕΣ» τροφοδοτεί τις έτοιμες επιλογές (είδος, νέα/συνεχιζόμενη, προτεραιότητα, χωροθέτηση).'],
      ['Κάθε γραμμή είναι μία δράση. Οι δύο πρώτες γραμμές είναι επικεφαλίδες. Η κίτρινη τρίτη γραμμή είναι παράδειγμα: διαγράψτε την ή αντικαταστήστε την πριν την εισαγωγή, αλλιώς θα μπει ως κανονική δράση.'],
      ['Μετά την αποθήκευση, ανοίξτε το επιχειρησιακό στην εφαρμογή και επιλέξτε «Εισαγωγή από Excel».'],
      [],
      ['Τι είναι υποχρεωτικό'],
      ['Α/Α', 'Θετικός αριθμός, διαφορετικός σε κάθε γραμμή. Π.χ. 1, 2, 3.'],
      ['Τίτλος δράσης', 'Χωρίς τίτλο η γραμμή αγνοείται και δεν μπαίνει στην εφαρμογή.'],
      [],
      ['Στήλη προς στήλη — φύλλο ΕΠ_ΔΡΑΣΕΙΣ'],
      ['Στήλη Α — Α/Α', 'Αύξων αριθμός της δράσης. Υποχρεωτικός. Θετικός και μοναδικός μέσα στο φύλλο.'],
      ['Στήλη Β — Άξονας', 'Έχει λίστα που ξεκινά κενή. Γράψτε την πρώτη τιμή (π.χ. «1. ΠΕΡΙΒΑΛΛΟΝ ΚΑΙ ΠΟΙΟΤΗΤΑ ΖΩΗΣ»)· στις επόμενες γραμμές θα εμφανίζεται ως επιλογή. Από εδώ ομαδοποιούνται οι δράσεις και τα στατιστικά ανά άξονα.'],
      ['Στήλη Γ — Μέτρο', 'Ίδια λογική με τον άξονα: η λίστα ξεκινά κενή και γεμίζει από ό,τι γράφετε. Π.χ. «1.1 Υποδομές ύδρευσης».'],
      ['Στήλη Δ — Ειδικός στόχος', 'Ίδια λογική. Π.χ. «1.1.1 Δίκτυα ύδρευσης».'],
      ['Στήλη Ε — Τίτλος δράσης', 'Ο πλήρης τίτλος όπως θα φαίνεται στην εφαρμογή. Υποχρεωτικός.'],
      ['Στήλη ΣΤ — Είδος δράσης', 'Επιλέξτε από τη λίστα: ' + ACTION_TYPES.join(', ') + '. Από εδώ βγαίνουν τα στατιστικά ανά είδος.'],
      ['Στήλη Ζ — Νέα / Συνεχιζόμενη', 'Επιλέξτε «Νέα» ή «Συνεχιζόμενη» από τη λίστα.'],
      ['Στήλη Η — Χωροθέτηση', 'Επιλέξτε δημοτική ενότητα από τη λίστα (π.χ. ' + exampleLocation + ') ή γράψτε νέα τιμή. Για να την ξαναβρείτε, προσθέστε την στη στήλη Χωροθέτηση του φύλλου «ΛΙΣΤΕΣ».'],
      ['Στήλη Θ — Προτεραιότητα', "Επιλέξτε Α', Β' ή Γ' από τη λίστα."],
      ['Στήλη Ι — Αρμόδια υπηρεσία', 'Ποια υπηρεσία του Δήμου έχει την ευθύνη. Π.χ. Διεύθυνση Τεχνικών Υπηρεσιών.'],
      ['Στήλες ετών ' + yearList, 'Προϋπολογισμός σε ευρώ για κάθε έτος της περιόδου ' + periodGate.period.label + '. Αφήστε 0 ή κενό αν δεν υπάρχει ποσό εκείνη τη χρονιά. Από εδώ βγαίνει ο προϋπολογισμός ανά έτος στα στατιστικά.'],
      ['Στήλη Σύνολο', 'Προαιρετικό. Αν μείνει κενό, η εφαρμογή αθροίζει τα ποσά των ετών.'],
      ['Στήλες Πηγή 1η / 2η / 3η', 'Έως τρεις πηγές χρηματοδότησης. Π.χ. ΕΣΠΑ 2021-2027, ίδιοι πόροι Δήμου. Από εδώ βγαίνουν τα στατιστικά ανά πηγή.'],
      [],
      ['Τι θα δείτε στην εφαρμογή μετά την εισαγωγή'],
      ['Οι δράσεις εμφανίζονται ομαδοποιημένες ανά άξονα, με φίλτρα και αναζήτηση.'],
      ['Στην καρτέλα «Στατιστικά & Εξαγωγές» δημιουργούνται αυτόματα σύνοψη, υλοποίηση, κατανομές ανά άξονα / μέτρο / είδος / πηγή / τόπο / προτεραιότητα και οι κορυφαίες δράσεις — χωρίς άλλη δουλειά από εσάς.'],
      ['Από την κάρτα κάθε υποέργου μπορείτε να συνδέσετε τη δράση με το έργο που την υλοποιεί.'],
      [],
      ['Λίστες επιλογής'],
      ['Στις στήλες είδος, νέα/συνεχιζόμενη και προτεραιότητα διαλέγετε έτοιμη τιμή.'],
      ['Σε άξονα, μέτρο και ειδικό στόχο η λίστα ξεκινά κενή: γράψτε την πρώτη τιμή στο κελί και από την επόμενη γραμμή θα την βρίσκετε ως επιλογή.'],
      ['Η χωροθέτηση έχει τις δημοτικές ενότητες του Δήμου. Μπορείτε να γράψετε και νέα· για επανάληψη προσθέστε την στο φύλλο «ΛΙΣΤΕΣ».'],
      [],
      ['Τι να μην κάνετε'],
      ['Μην μετονομάσετε το φύλλο «ΕΠ_ΔΡΑΣΕΙΣ» και μην αλλάξετε τη σειρά των στηλών.'],
      ['Μην σβήσετε τις δύο πρώτες γραμμές-επικεφαλίδες.'],
      ['Μην αφήσετε την κίτρινη γραμμή-παράδειγμα αν δεν την αντικαταστήσετε.']
    ];
    var instructionSectionTitles = {
      'Σημαντικό για εσάς': 'highlight',
      'Πού συμπληρώνετε': 'section',
      'Τι είναι υποχρεωτικό': 'section',
      'Στήλη προς στήλη — φύλλο ΕΠ_ΔΡΑΣΕΙΣ': 'section',
      'Τι θα δείτε στην εφαρμογή μετά την εισαγωγή': 'section',
      'Λίστες επιλογής': 'section',
      'Τι να μην κάνετε': 'section'
    };

    return {
      ok: true,
      period: periodGate.period,
      startYear: periodGate.startYear,
      endYear: periodGate.endYear,
      years: years,
      filename: 'ERGOHUB_Προτυπο_ΕΠ_' + periodGate.startYear + '-' + periodGate.endYear + '.xlsx',
      actionsRows: actionsRows,
      instructionRows: instructionRows,
      instructionSectionTitles: instructionSectionTitles,
      exampleTitle: example[4],
      exampleLocation: exampleLocation,
      listModel: listModel
    };
  }

  function epImportScreenCopy() {
    return {
      emptyHelp: 'Κατεβάστε το πρότυπο και συμπληρώστε μία γραμμή για κάθε δράση: Α/Α, τίτλος, άξονας / μέτρο / στόχος, είδος, νέα ή συνεχιζόμενη, τόπος, προτεραιότητα, υπηρεσία, ποσά ανά έτος και πηγές. Με την εισαγωγή η εφαρμογή φτιάχνει μόνη της τις δράσεις και πλήρη στατιστικά — δεν χρειάζεται δεύτερη καταχώριση.',
      periodHelpTitle: 'Τι θα συμπληρώσετε στο πρότυπο',
      periodHelp: 'Μία γραμμή ανά δράση, στο φύλλο δράσεων: Α/Α και τίτλος υποχρεωτικά, μαζί με άξονα, μέτρο, ειδικό στόχο, είδος, νέα ή συνεχιζόμενη, χωροθέτηση, προτεραιότητα, αρμόδια υπηρεσία, ποσά ανά έτος και έως τρεις πηγές. Από αυτά η εφαρμογή φτιάχνει αυτόματα πλήρη στατιστικά (ανά άξονα, είδος, πηγή, τόπο και προϋπολογισμό) — χωρίς άλλη καταχώριση.',
      fileHelpTitle: 'Πριν επιλέξετε αρχείο',
      fileHelp: 'Αν δεν έχετε έτοιμο Excel, κατεβάστε το πρότυπο αυτής της περιόδου. Μέσα έχει φύλλο οδηγιών: τι γράφετε σε κάθε στήλη και ότι τα στατιστικά δημιουργούνται αυτόματα μετά την εισαγωγή.'
    };
  }

  function flattenEpTemplateInstructions(model) {
    return ((model && model.instructionRows) || []).map(function (row) {
      return (row || []).filter(Boolean).join(' — ');
    }).filter(Boolean).join('\n');
  }

  function parseEpActionSearch(action, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var sources = ((action && action.fundingSources) || []).join(' ');
    var hay = [
      action && action.title,
      action && action.location,
      action && action.responsibleService,
      sources
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function matchesEpActionFilters(action, filters) {
    var opts = filters || {};
    if (opts.filterAxis && action.axisCode !== opts.filterAxis) return false;
    if (opts.filterMeasure && action.measureCode !== opts.filterMeasure) return false;
    if (opts.filterObjective && action.objectiveCode !== opts.filterObjective) return false;
    if (opts.filterType && action.actionType !== opts.filterType) return false;
    if (opts.filterNew === 'new' && !action.isNew) return false;
    if (opts.filterNew === 'continuing' && action.isNew) return false;
    return parseEpActionSearch(action, opts.search);
  }

  function filterEpActionsHub(actions, filters) {
    return (actions || []).filter(function (row) {
      return matchesEpActionFilters(row, filters);
    });
  }

  function groupEpActionsByAxis(actions) {
    var grouped = {};
    (actions || []).forEach(function (action) {
      var key = (action && action.axisCode) || UNGROUPED_AXIS;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(action);
    });
    return grouped;
  }

  function sortedAxisKeys(grouped) {
    return Object.keys(grouped || {}).sort(function (a, b) {
      return parseFloat(a) - parseFloat(b);
    });
  }

  function filterAvailableMeasures(measures, axisCode) {
    return (measures || []).filter(function (m) {
      return !axisCode || m.axisCode === axisCode;
    });
  }

  function filterAvailableObjectives(objectives, filters) {
    var opts = filters || {};
    return (objectives || []).filter(function (o) {
      if (opts.filterMeasure) return o.measureCode === opts.filterMeasure;
      if (opts.filterAxis) return o.axisCode === opts.filterAxis;
      return true;
    });
  }

  function countArchivedPrograms(programs) {
    return (programs || []).filter(function (p) { return p && !p.isActive; }).length;
  }

  function findActiveProgram(programs) {
    return (programs || []).find(function (p) { return p && p.isActive; }) || null;
  }

  return {
    ACTION_TYPES: ACTION_TYPES,
    NEW_OR_CONTINUING: NEW_OR_CONTINUING,
    PRIORITIES: PRIORITIES,
    TEMPLATE_ACTIONS_SHEET: TEMPLATE_ACTIONS_SHEET,
    TEMPLATE_INFO_SHEET: TEMPLATE_INFO_SHEET,
    TEMPLATE_LISTS_SHEET: TEMPLATE_LISTS_SHEET,
    quoteEpExcelSheetName: quoteEpExcelSheetName,
    epTemplateFixedListFormula: epTemplateFixedListFormula,
    epTemplateGrowingListFormula: epTemplateGrowingListFormula,
    collectEpTemplateLocations: collectEpTemplateLocations,
    buildEpTemplateListModel: buildEpTemplateListModel,
    UNGROUPED_AXIS: UNGROUPED_AXIS,
    showEpProgramButton: showEpProgramButton,
    canManageEpProgram: canManageEpProgram,
    filterImportYearInput: filterImportYearInput,
    defaultImportEndYear: defaultImportEndYear,
    describeEpPeriod: describeEpPeriod,
    evaluateEpPeriod: evaluateEpPeriod,
    evaluateEpImport: evaluateEpImport,
    evaluateImportWizardStep: evaluateImportWizardStep,
    normalizeActionTitle: normalizeActionTitle,
    transferEpActionLinks: transferEpActionLinks,
    isSameEpPeriod: isSameEpPeriod,
    pickLinkSourceProgram: pickLinkSourceProgram,
    summarizeImportImpact: summarizeImportImpact,
    describeEpImportReload: describeEpImportReload,
    collectEpActionsForSubproject: collectEpActionsForSubproject,
    buildEpSubprojectLinkMap: buildEpSubprojectLinkMap,
    parseEpActionAa: parseEpActionAa,
    suggestNextEpActionAa: suggestNextEpActionAa,
    formatEpCardLinkLabel: formatEpCardLinkLabel,
    evaluateEpActionSave: evaluateEpActionSave,
    evaluateEpActionDelete: evaluateEpActionDelete,
    canExportEpProgram: canExportEpProgram,
    canCreateEpAction: canCreateEpAction,
    showEpImportOnEmpty: showEpImportOnEmpty,
    canDownloadEpTemplate: canDownloadEpTemplate,
    defaultTemplatePeriod: defaultTemplatePeriod,
    resolveTemplatePeriod: resolveTemplatePeriod,
    evaluateTemplateDownload: evaluateTemplateDownload,
    suggestTemplatePeriodDraft: suggestTemplatePeriodDraft,
    FALLBACK_EXAMPLE_LOCATION: FALLBACK_EXAMPLE_LOCATION,
    formatEpTemplateLocation: formatEpTemplateLocation,
    pickEpTemplateExampleLocation: pickEpTemplateExampleLocation,
    isEpTemplateExampleTitle: isEpTemplateExampleTitle,
    buildEpImportTemplateModel: buildEpImportTemplateModel,
    epImportScreenCopy: epImportScreenCopy,
    flattenEpTemplateInstructions: flattenEpTemplateInstructions,
    parseEpActionSearch: parseEpActionSearch,
    matchesEpActionFilters: matchesEpActionFilters,
    filterEpActionsHub: filterEpActionsHub,
    groupEpActionsByAxis: groupEpActionsByAxis,
    sortedAxisKeys: sortedAxisKeys,
    filterAvailableMeasures: filterAvailableMeasures,
    filterAvailableObjectives: filterAvailableObjectives,
    countArchivedPrograms: countArchivedPrograms,
    findActiveProgram: findActiveProgram
  };
});
