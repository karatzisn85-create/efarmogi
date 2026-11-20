/**
 * Σχέδιο φακέλου εξαγωγής υποέργου: ονόματα και σχετικά μονοπάτια.
 * Δεν ανοίγει δίσκο και δεν κατεβάζει έγγραφα.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSubprojectFolderPlan = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var reports = null;
  var submissionsApi = null;
  try {
    if (typeof require === 'function') {
      reports = require('./reportsExport');
      submissionsApi = require('./prosklisiSubmissions');
    }
  } catch (e) { /* renderer χωρίς require */ }

  var ORIMANTHI_CATEGORIES = {
    'ΜΕΛΕΤΕΣ ΕΡΓΟΥ': true,
    'ΑΔΕΙΟΔΟΤΗΣΕΙΣ': true
  };

  var KHMDHS_STAGE_LABELS = {
    REQ: 'Αίτημα',
    COMMIT: 'Ανάληψη υποχρέωσης',
    PROC: 'Δημοσίευση',
    AWRD: 'Κατακύρωση',
    SYMV: 'Σύμβαση',
    EXT: 'Παράταση',
    APE: 'ΑΠΕ',
    PAY: 'Ένταλμα πληρωμής',
    RELATED: 'Σχετικό έγγραφο'
  };

  var CHANGE_LABELS = {
    deadline: 'Προθεσμία',
    title: 'Τίτλος',
    status: 'Κατάσταση',
    budgetRange: 'Προϋπολογισμός',
    axis: 'Άξονας',
    code: 'Κωδικός',
    fundingSource: 'Πηγή χρηματοδότησης',
    comments: 'Σχόλια',
    subject: 'Θέμα',
    initialAmount: 'Ποσό',
    endDate: 'Ημερομηνία λήξης'
  };

  function reportsApi() {
    if (reports) return reports;
    if (typeof require === 'function') {
      try { reports = require('./reportsExport'); } catch (e) { reports = null; }
    }
    return reports || {};
  }

  function submissionsOf() {
    if (submissionsApi) return submissionsApi;
    if (typeof require === 'function') {
      try { submissionsApi = require('./prosklisiSubmissions'); } catch (e) { submissionsApi = null; }
    }
    return submissionsApi || {};
  }

  function sanitizeSegment(name, fallback, maxLen) {
    var limit = maxLen || 80;
    var sanitized = String(name == null ? '' : name)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/[. ]+$/g, '')
      .trim();
    if (!sanitized || sanitized === '.' || sanitized === '..') sanitized = fallback || 'Φάκελος';
    if (sanitized.length > limit) sanitized = sanitized.substring(0, limit).replace(/[. ]+$/g, '').trim();
    return sanitized || (fallback || 'Φάκελος');
  }

  function basenameOnly(value) {
    var s = String(value || '').trim();
    if (!s) return '';
    var parts = s.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }

  function joinRel() {
    var parts = [];
    for (var i = 0; i < arguments.length; i += 1) {
      var bit = String(arguments[i] || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (bit) parts.push(bit);
    }
    return parts.join('/');
  }

  function indexedName(base, index) {
    if (!index) return base;
    return base + ' ' + (index + 1);
  }

  function normText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function displayDate(value) {
    var s = String(value || '').trim();
    var match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return s;
    return match[3] + '/' + match[2] + '/' + match[1];
  }

  function fileRef(entry) {
    if (entry == null || entry === '') return null;
    if (typeof entry === 'string') {
      var fromString = basenameOnly(entry);
      if (!fromString) return null;
      return { diskName: fromString, displayName: fromString, kind: 'file' };
    }
    if (typeof entry !== 'object') return null;
    if (entry.kind === 'folder') {
      var folderId = String(entry.id || '').trim();
      var folderName = basenameOnly(entry.name || entry.originalName || 'Φάκελος');
      if (!folderId || !folderName) return null;
      return { kind: 'folder', diskName: folderId, displayName: sanitizeSegment(folderName, 'Φάκελος') };
    }
    var diskName = basenameOnly(entry.name || entry.fileName || entry.originalName || '');
    var displayName = basenameOnly(entry.originalName || entry.fileName || entry.name || diskName);
    if (!diskName) return null;
    return { diskName: diskName, displayName: displayName || diskName, kind: 'file' };
  }

  function pushUnique(list, used, relativePath, source) {
    var rel = String(relativePath || '').replace(/\\/g, '/');
    var parts = rel.split('/');
    if (!rel || parts.some(function (part) { return !part || part === '.' || part === '..'; })) return;
    var finalRel = rel;
    var n = 2;
    while (used[finalRel.toLowerCase()]) {
      var slash = rel.lastIndexOf('/');
      var dir = slash >= 0 ? rel.slice(0, slash + 1) : '';
      var file = slash >= 0 ? rel.slice(slash + 1) : rel;
      var dot = file.lastIndexOf('.');
      var stem = dot > 0 ? file.slice(0, dot) : file;
      var ext = dot > 0 ? file.slice(dot) : '';
      finalRel = dir + stem + ' (' + n + ')' + ext;
      n += 1;
    }
    used[finalRel.toLowerCase()] = true;
    list.push({ relativePath: finalRel, source: source });
  }

  function distinctGroupTitle(raw, base, taken) {
    var full = sanitizeSegment(raw, 'Ομάδα', 200);
    var tail = full.length > base.length
      ? full.slice(base.length).replace(/^[\s\-–—]+/, '').trim()
      : '';
    var title = tail
      ? sanitizeSegment(base.slice(0, 46).replace(/[\s\-]+$/, '') + ' - ' + tail, 'Ομάδα', 80)
      : base;
    var unique = title;
    var n = 2;
    while (taken[unique.toLowerCase()]) {
      unique = sanitizeSegment(title, 'Ομάδα', 74) + ' ' + n;
      n += 1;
    }
    taken[unique.toLowerCase()] = true;
    return unique;
  }

  function walkGroups(groups, parts, emit) {
    var prepared = [];
    (groups || []).forEach(function (group) {
      if (!group) return;
      var raw = String(group.title || group.label || 'Ομάδα');
      prepared.push({ group: group, raw: raw, base: sanitizeSegment(raw, 'Ομάδα') });
    });
    var baseCount = {};
    prepared.forEach(function (item) {
      var key = item.base.toLowerCase();
      baseCount[key] = (baseCount[key] || 0) + 1;
    });
    var taken = {};
    prepared.forEach(function (item) {
      var title = item.base;
      if (baseCount[item.base.toLowerCase()] > 1 || taken[title.toLowerCase()]) {
        title = distinctGroupTitle(item.raw, item.base, taken);
      } else {
        taken[title.toLowerCase()] = true;
      }
      var here = parts.concat([{ safe: title, raw: item.raw }]);
      (item.group.files || []).forEach(function (file) {
        var ref = fileRef(file);
        if (!ref) return;
        emit(here, ref);
      });
      walkGroups(item.group.subgroups, here, emit);
    });
  }

  function safeParts(parts) {
    return (parts || []).map(function (part) {
      return typeof part === 'string' ? part : part.safe;
    });
  }

  function namesFromList(list) {
    var out = [];
    var arr = Array.isArray(list) ? list : (list ? [list] : []);
    arr.forEach(function (item) {
      var ref = fileRef(item);
      if (ref && ref.kind === 'file') out.push(ref.displayName);
    });
    return out;
  }

  function adamsMentioned(project) {
    var found = {};
    var text = '';
    try { text = JSON.stringify(project || {}); } catch (e) { text = ''; }
    var re = /\d{2}[A-Z]{3,4}\d{9}/g;
    var match;
    while ((match = re.exec(text))) found[match[0]] = true;
    return found;
  }

  function stageFromAdam(adam) {
    var code = String(adam || '').slice(2, 6).replace(/\d/g, '');
    if (code.length > 4) code = code.slice(0, 4);
    if (KHMDHS_STAGE_LABELS[code]) return code;
    var three = String(adam || '').slice(2, 5);
    if (KHMDHS_STAGE_LABELS[three]) return three;
    return '';
  }

  function planDiavgeia(entries, copies, used) {
    var seen = {};
    (entries || []).forEach(function (entry) {
      var stage = String((entry && entry.stage) || '').toUpperCase();
      if (stage !== 'APE' && stage !== 'EXT') return;
      var ada = String((entry && entry.ada) || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!ada || ada.indexOf('-') < 0 || /[\\/]/.test(ada) || ada.indexOf('..') >= 0) return;
      var key = stage + ':' + ada;
      if (seen[key]) return;
      seen[key] = true;
      pushUnique(
        copies,
        used,
        joinRel('ΚΗΜΔΗΣ', KHMDHS_STAGE_LABELS[stage], ada + '.pdf'),
        {
          type: 'diavgeia',
          ada: ada,
          stage: stage,
          documentUrl: String((entry && entry.documentUrl) || '')
        }
      );
    });
  }

  function planKhmdhs(project, entries, copies, used) {
    var mentioned = adamsMentioned(project);
    var seen = {};
    (entries || []).forEach(function (entry) {
      var adam = String((entry && entry.adam) || '').trim().toUpperCase().replace(/\*+$/, '');
      if (!/^\d{2}[A-Z]{3,4}\d{9}$/.test(adam)) return;
      if (!mentioned[adam] || seen[adam]) return;
      var stage = String((entry && entry.stage) || '').toUpperCase();
      if (!KHMDHS_STAGE_LABELS[stage]) stage = stageFromAdam(adam);
      if (!KHMDHS_STAGE_LABELS[stage]) return;
      seen[adam] = true;
      pushUnique(
        copies,
        used,
        joinRel('ΚΗΜΔΗΣ', KHMDHS_STAGE_LABELS[stage], adam + '.pdf'),
        { type: 'khmdhs', adam: adam, stage: stage }
      );
    });
  }

  function planSubprojectFiles(project, copies, used) {
    var grouped = {};
    walkGroups(project && project.fileGroups, [], function (parts, ref) {
      grouped[ref.diskName.toLowerCase()] = true;
      pushUnique(
        copies,
        used,
        joinRel.apply(null, ['ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ'].concat(safeParts(parts)).concat([ref.displayName])),
        {
          type: 'subproject-file',
          projectId: project.projectId,
          subprojectId: project.subprojectId,
          fileName: ref.diskName
        }
      );
    });
    (project && project.files || []).forEach(function (file) {
      var ref = fileRef(file);
      if (!ref || ref.kind !== 'file') return;
      if (grouped[ref.diskName.toLowerCase()]) return;
      pushUnique(
        copies,
        used,
        joinRel('ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', ref.displayName),
        {
          type: 'subproject-file',
          projectId: project.projectId,
          subprojectId: project.subprojectId,
          fileName: ref.diskName
        }
      );
    });
  }

  function filledRows(rows) {
    return (rows || []).filter(function (row) {
      return row && String(row.label || '').trim() && String(row.value || '').trim();
    }).map(function (row) {
      return { label: String(row.label).trim(), value: String(row.value).trim() };
    });
  }

  function changeRows(changes) {
    var rows = [];
    var src = changes && typeof changes === 'object' ? changes : {};
    Object.keys(src).forEach(function (key) {
      var item = src[key];
      if (!item || typeof item !== 'object') return;
      var before = displayDate(item.original != null ? item.original : item.from);
      var after = displayDate(item.current != null ? item.current : item.to);
      if (!before && !after) return;
      var label = CHANGE_LABELS[key] || key;
      rows.push({ label: label, value: (before || '—') + ' → ' + (after || '—') });
    });
    return rows;
  }

  function entaxiModRows(mod) {
    var amount = mod && (mod.newAmount || mod.amount);
    return filledRows([
      { label: 'Ημερομηνία', value: displayDate(mod && (mod.date || mod.documentDate || mod.modificationDocumentDate)) },
      { label: 'Ποσό', value: amount ? String(amount) : '' },
      { label: 'Σχόλια', value: mod && (mod.comments || mod.description || mod.subject || '') },
      { label: 'ΑΔΑ', value: mod && (mod.diavgeiaAda || mod.ada || '') }
    ].concat(changeRows(mod && mod.changes)));
  }

  function prosklisiModRows(mod) {
    var data = (mod && mod.modifiedData) || {};
    return filledRows([
      { label: 'Ημερομηνία', value: displayDate(mod && (mod.modificationDocumentDate || mod.date || mod.createdAt)) },
      { label: 'Τίτλος', value: mod && (mod.modificationTitle || data.title || '') },
      { label: 'ΑΔΑ', value: mod && (mod.diavgeiaAda || mod.ada || '') },
      { label: 'Σχόλια', value: mod && (mod.notes || mod.comments || '') }
    ].concat(changeRows(mod && mod.changes)));
  }

  function prosklisiRecordRows(prosklisi) {
    var api = submissionsOf();
    var norm = api.normalizeSubmissions
      ? api.normalizeSubmissions(prosklisi && prosklisi.submissions)
      : { submissions: [] };
    var rows = [
      { label: 'Τίτλος', value: prosklisi && prosklisi.title },
      { label: 'Κωδικός', value: prosklisi && prosklisi.code },
      { label: 'Άξονας', value: prosklisi && prosklisi.axis },
      { label: 'Πηγή χρηματοδότησης', value: prosklisi && prosklisi.fundingSource },
      { label: 'Προϋπολογισμός', value: prosklisi && prosklisi.budgetRange },
      { label: 'Προθεσμία', value: displayDate(prosklisi && prosklisi.deadline) },
      { label: 'Κατάσταση', value: prosklisi && prosklisi.status },
      { label: 'Σχόλια', value: prosklisi && prosklisi.comments }
    ];
    (norm.submissions || []).forEach(function (item, index) {
      var status = api.statusLabel ? api.statusLabel(item) : (item.submitted ? 'Υποβλήθηκε' : 'Εκκρεμεί η υποβολή');
      rows.push({
        label: 'Πράξη ' + (index + 1),
        value: (item.title || 'Υποβολή') + (status ? ' — ' + status : '')
      });
    });
    return filledRows(rows);
  }

  function pickAct(prosklisi, project, shelf) {
    var cards = (shelf && shelf.cards || []).filter(function (card) {
      return card && card.submissionId;
    });
    if (!cards.length) return { mode: 'all', submissionId: '' };
    var keys = {};
    [project && project.projectTitle, project && project.subprojectTitle, project && project.misPraxhsName]
      .forEach(function (value) {
        var key = normText(value);
        if (key) keys[key] = true;
      });
    var hits = cards.filter(function (card) { return keys[normText(card.title)]; });
    if (hits.length === 1) return { mode: 'act', submissionId: hits[0].submissionId };
    if (cards.length === 1 && String((prosklisi && prosklisi.linkedSubprojectId) || '') === String((project && project.subprojectId) || '')) {
      return { mode: 'act', submissionId: cards[0].submissionId };
    }
    return { mode: 'all', submissionId: '' };
  }

  function groupsAndFilesForScope(shelf, scope) {
    var groups = (shelf.invitationGroups || []).concat(shelf.unassignedGroups || []);
    var files = (shelf.invitationFiles || []).concat(shelf.unassignedFiles || []);
    (shelf.cards || []).forEach(function (card) {
      if (scope.mode === 'all' || card.submissionId === scope.submissionId) {
        groups = groups.concat(card.groups || []);
        files = files.concat(card.files || []);
      }
    });
    return { groups: groups, files: files };
  }

  function planOrimanthi(folderName, files, copies, used) {
    var allowed = (files || []).filter(function (file) {
      return file && ORIMANTHI_CATEGORIES[String(file.categoryLabel || '').trim()] && file.sourcePath;
    });
    var titlesByCategory = {};
    allowed.forEach(function (file) {
      var cat = String(file.categoryLabel).trim();
      var title = String(file.sourceProposalTitle || '').trim();
      if (!titlesByCategory[cat]) titlesByCategory[cat] = {};
      if (title) titlesByCategory[cat][title] = true;
    });
    allowed.forEach(function (file) {
      var cat = String(file.categoryLabel).trim();
      var title = String(file.sourceProposalTitle || '').trim();
      var many = Object.keys(titlesByCategory[cat] || {}).length > 1;
      var spec = String(file.subtitle || '').trim();
      var parts = [folderName, cat];
      if (many && title) parts.push(sanitizeSegment(title, 'Έργο ωρίμανσης'));
      if (spec && spec !== '—' && spec !== 'Εξειδίκευση') parts.push(sanitizeSegment(spec, 'Αρχεία'));
      var display = basenameOnly(file.originalName || file.fileName || 'αρχείο');
      parts.push(display || 'αρχείο');
      pushUnique(copies, used, joinRel.apply(null, parts), {
        type: 'path',
        path: file.sourcePath,
        root: 'data'
      });
    });
  }

  function planProsklisiFiles(folderName, prosklisi, project, copies, used) {
    var api = submissionsOf();
    var shelf = api.buildShelf ? api.buildShelf({
      submissions: prosklisi.submissions,
      fileGroups: prosklisi.fileGroups,
      looseFiles: prosklisi.prosklisiFiles,
      linkedProposals: [],
      linkedFiles: []
    }) : { cards: [], invitationGroups: prosklisi.fileGroups || [], invitationFiles: prosklisi.prosklisiFiles || [], unassignedGroups: [], unassignedFiles: [] };
    var declared = api.normalizeSubmissions
      ? api.normalizeSubmissions(prosklisi.submissions).submissions
      : [];
    var scope = declared.length ? pickAct(prosklisi, project, shelf) : { mode: 'all', submissionId: '' };
    var selected = groupsAndFilesForScope(shelf, scope);
    walkGroups(selected.groups, [{ safe: folderName, raw: folderName }], function (parts, ref) {
      if (ref.kind === 'folder') return;
      pushUnique(copies, used, joinRel.apply(null, safeParts(parts).concat([ref.displayName])), {
        type: 'prosklisi-file',
        prosklisiId: prosklisi.prosklisiId,
        titles: parts.slice(1).map(function (part) { return part.raw; }),
        fileName: ref.diskName
      });
    });
    (selected.files || []).forEach(function (file) {
      var ref = fileRef(file);
      if (!ref || ref.kind !== 'file') return;
      pushUnique(copies, used, joinRel(folderName, ref.displayName), {
        type: 'prosklisi-file',
        prosklisiId: prosklisi.prosklisiId,
        titles: [],
        fileName: ref.diskName
      });
    });
    (prosklisi.prosklisiFolders || []).forEach(function (folder) {
      var stored = basenameOnly(folder && folder.folderName);
      if (!stored) return;
      var label = sanitizeSegment((folder && (folder.originalName || folder.folderName)) || 'Φάκελος', 'Φάκελος');
      pushUnique(copies, used, joinRel(folderName, label), {
        type: 'prosklisi-tree',
        prosklisiId: prosklisi.prosklisiId,
        folderName: stored,
        targetFolder: folder.targetFolder || 'main'
      });
    });
    planOrimanthi(folderName, prosklisi.orimanthiFiles, copies, used);
    return scope;
  }

  function planEgkrisi(links, copies, used) {
    var many = (links || []).length > 1;
    (links || []).forEach(function (link) {
      var base = ['ΕΓΚΡΙΣΗ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ'];
      if (many) base.push(sanitizeSegment(link.actTitle || link.subTitle || 'Έγκριση', 'Έγκριση'));
      var seenName = {};
      function add(fileName) {
        var name = basenameOnly(fileName);
        if (!name || seenName[name.toLowerCase()]) return;
        seenName[name.toLowerCase()] = true;
        pushUnique(copies, used, joinRel.apply(null, base.concat([name])), {
          type: 'egkrisi',
          projectFolder: link.projectFolder,
          fileName: name
        });
      }
      (link.pdfs || []).forEach(add);
      (link.modifications || []).forEach(add);
    });
  }

  function planMeleti(meleti, copies, used) {
    if (!meleti || !meleti.id) return;
    (meleti.fileGroups || []).forEach(function (group) {
      var label = sanitizeSegment(group.label || group.title || 'Αρχεία', 'Αρχεία');
      (group.files || []).forEach(function (file) {
        var ref = fileRef(file);
        if (!ref) return;
        if (ref.kind === 'folder') {
          pushUnique(copies, used, joinRel('ΜΕΛΕΤΕΣ', label, ref.displayName), {
            type: 'meleti-folder',
            meletiId: meleti.id,
            groupId: group.id,
            folderId: ref.diskName
          });
          return;
        }
        pushUnique(copies, used, joinRel('ΜΕΛΕΤΕΣ', label, ref.displayName), {
          type: 'meleti-file',
          meletiId: meleti.id,
          groupId: group.id,
          fileName: ref.diskName
        });
      });
    });
  }

  function sortByTitle(list, titleOf) {
    return (list || []).slice().sort(function (a, b) {
      var ta = String(titleOf(a) || '');
      var tb = String(titleOf(b) || '');
      var cmp = ta.localeCompare(tb, 'el', { sensitivity: 'base' });
      if (cmp) return cmp;
      return String(a && (a.entaxiId || a.prosklisiId) || '').localeCompare(String(b && (b.entaxiId || b.prosklisiId) || ''));
    });
  }

  function placeGeneratedPdf(pdfs, used, spec) {
    var rel = String(spec.relativePath || '').replace(/\\/g, '/');
    var slash = rel.lastIndexOf('/');
    var dir = slash >= 0 ? rel.slice(0, slash + 1) : '';
    var file = slash >= 0 ? rel.slice(slash + 1) : rel;
    var dot = file.lastIndexOf('.');
    var stem = dot > 0 ? file.slice(0, dot) : file;
    var ext = dot > 0 ? file.slice(dot) : '';
    var candidate = rel;
    if (used[candidate.toLowerCase()]) candidate = dir + stem + ' - συνοπτικό' + ext;
    var n = 2;
    while (used[candidate.toLowerCase()]) {
      candidate = dir + stem + ' - συνοπτικό ' + n + ext;
      n += 1;
    }
    used[candidate.toLowerCase()] = true;
    spec.relativePath = candidate;
    pdfs.push(spec);
  }

  function buildSubprojectFolderPlan(input) {
    var src = input || {};
    var project = src.project || {};
    var copies = [];
    var pdfs = [];
    var used = {};
    var rootName = sanitizeSegment(project.subprojectTitle || project.projectTitle || 'Υποέργο', 'Υποέργο', 80);

    pdfs.push({
      slot: 'subproject',
      kind: 'subproject',
      relativePath: 'ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ.pdf',
      title: 'Αναφορά υποέργου'
    });
    used['αναφορά υποέργου.pdf'] = true;

    planSubprojectFiles(project, copies, used);
    planKhmdhs(project, src.khmdhsEntries, copies, used);
    planDiavgeia(src.diavgeiaEntries, copies, used);

    var entaxeis = sortByTitle(src.entaxeis, function (item) {
      return (item && (item.subject || item.projectTitle)) || '';
    });
    entaxeis.forEach(function (entaxi, index) {
      var folder = indexedName('ΕΝΤΑΞΗ', index);
      var reportName = folder + '.pdf';
      var decisionList = (entaxi.entaxiPDFs && entaxi.entaxiPDFs.length)
        ? entaxi.entaxiPDFs
        : (entaxi.entaxiPDF ? [entaxi.entaxiPDF] : []);
      var seenEntaxiName = {};
      var indicatedNames = [];
      function addEntaxiName(name) {
        var key = String(name || '').toLowerCase();
        if (!key || seenEntaxiName[key]) return;
        seenEntaxiName[key] = true;
        indicatedNames.push(name);
      }
      namesFromList(decisionList).forEach(addEntaxiName);
      namesFromList(entaxi.approvalPDFs).forEach(addEntaxiName);
      namesFromList(entaxi.approvalPDF).forEach(addEntaxiName);
      var entaxiFileNames = indicatedNames.slice();
      if (!entaxiFileNames.length) {
        namesFromList(entaxi.diskFiles).forEach(function (name) {
          var key = String(name || '').toLowerCase();
          if (!key || seenEntaxiName[key]) return;
          seenEntaxiName[key] = true;
          entaxiFileNames.push(name);
        });
      }
      entaxiFileNames.forEach(function (name) {
        pushUnique(copies, used, joinRel(folder, name), {
          type: 'entaxi-file',
          entaxiId: entaxi.entaxiId,
          fileName: name
        });
      });
      placeGeneratedPdf(pdfs, used, {
        slot: 'entaxi:' + entaxi.entaxiId,
        kind: 'entaxi',
        relativePath: joinRel(folder, reportName),
        title: folder,
        entaxi: entaxi
      });
      (entaxi.modifications || []).forEach(function (mod, modIndex) {
        var modName = 'ΤΡΟΠΟΠΟΙΗΣΗ ' + (modIndex + 1) + ' ΕΝΤΑΞΗΣ.pdf';
        var seenModName = {};
        namesFromList(mod && mod.modificationPDF).concat(
          namesFromList(mod && mod.approvalPDFs),
          namesFromList(mod && mod.approvalPDF)
        ).forEach(function (name) {
          var key = String(name || '').toLowerCase();
          if (!key || seenModName[key]) return;
          seenModName[key] = true;
          pushUnique(copies, used, joinRel(folder, name), {
            type: 'entaxi-file',
            entaxiId: entaxi.entaxiId,
            fileName: name,
            preferModification: true
          });
        });
        placeGeneratedPdf(pdfs, used, {
          slot: 'entaxi-mod:' + entaxi.entaxiId + ':' + (modIndex + 1),
          kind: 'record',
          relativePath: joinRel(folder, modName),
          title: 'ΤΡΟΠΟΠΟΙΗΣΗ ' + (modIndex + 1) + ' ΕΝΤΑΞΗΣ',
          subtitle: entaxi.subject || entaxi.projectTitle || '',
          rows: entaxiModRows(mod)
        });
      });
    });

    var proskliseis = sortByTitle(src.proskliseis, function (item) {
      return (item && item.title) || '';
    });
    proskliseis.forEach(function (prosklisi, index) {
      var folder = indexedName('ΠΡΟΣΚΛΗΣΗ', index);
      var reportName = folder + '.pdf';
      planProsklisiFiles(folder, prosklisi, project, copies, used);
      placeGeneratedPdf(pdfs, used, {
        slot: 'prosklisi:' + prosklisi.prosklisiId,
        kind: 'record',
        relativePath: joinRel(folder, reportName),
        title: folder,
        subtitle: prosklisi.title || '',
        rows: prosklisiRecordRows(prosklisi)
      });
      (prosklisi.modifications || []).forEach(function (mod, modIndex) {
        var modName = 'ΤΡΟΠΟΠΟΙΗΣΗ ' + (modIndex + 1) + ' ΠΡΟΣΚΛΗΣΗΣ.pdf';
        var attachment = mod && mod.modificationPDF;
        var attachmentName = '';
        if (typeof attachment === 'string') attachmentName = basenameOnly(attachment);
        else if (attachment && typeof attachment === 'object') {
          attachmentName = basenameOnly(attachment.fileName || attachment.originalName || attachment.name || '');
        }
        if (attachmentName) {
          pushUnique(copies, used, joinRel(folder, attachmentName), {
            type: 'prosklisi-mod-file',
            prosklisiId: prosklisi.prosklisiId,
            modificationId: mod.modificationId || '',
            fileName: attachmentName
          });
        }
        placeGeneratedPdf(pdfs, used, {
          slot: 'prosklisi-mod:' + prosklisi.prosklisiId + ':' + (modIndex + 1),
          kind: 'record',
          relativePath: joinRel(folder, modName),
          title: 'ΤΡΟΠΟΠΟΙΗΣΗ ' + (modIndex + 1) + ' ΠΡΟΣΚΛΗΣΗΣ',
          subtitle: prosklisi.title || '',
          rows: prosklisiModRows(mod)
        });
      });
    });

    planEgkrisi(src.egkriseis, copies, used);
    planMeleti(src.meleti, copies, used);

    return {
      rootName: rootName,
      pdfs: pdfs,
      copies: copies
    };
  }

  function linkedEntaxeis(entaxeis, subprojectId) {
    var api = reportsApi();
    if (api.getLinkedEntaxeis) return api.getLinkedEntaxeis(entaxeis, subprojectId);
    return [];
  }

  function linkedProskliseis(proskliseis, project) {
    var api = reportsApi();
    if (api.getLinkedProskliseis) return api.getLinkedProskliseis(proskliseis, project);
    return [];
  }

  return {
    sanitizeSegment: sanitizeSegment,
    buildSubprojectFolderPlan: buildSubprojectFolderPlan,
    linkedEntaxeis: linkedEntaxeis,
    linkedProskliseis: linkedProskliseis,
    ORIMANTHI_CATEGORIES: ORIMANTHI_CATEGORIES,
    KHMDHS_STAGE_LABELS: KHMDHS_STAGE_LABELS
  };
});
