/**
 * Πράξεις υποβολής μιας πρόσκλησης: κάρτες, δήλωση «υποβλήθηκε», αταξινόμητα.
 * Δεν αλλάζει την κατάσταση της πρόσκλησης ούτε της ωρίμανσης.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubProsklisiSubmissions = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isoDate(value) {
    var s = String(value || '').trim();
    var match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return s;
  }

  function formatGreekDate(iso) {
    var s = isoDate(iso);
    if (!s) return '';
    var parts = s.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function todayIso(today) {
    return isoDate(today) || isoDate(new Date().toISOString().slice(0, 10));
  }

  function normalizeOne(raw) {
    var s = raw || {};
    var submitted = s.submitted === true || s.submitted === 'true';
    var submittedOn = submitted ? isoDate(s.submittedOn) : '';
    return {
      id: String(s.id || '').trim(),
      title: String(s.title || '').trim(),
      orimanthiProposalId: String(s.orimanthiProposalId || '').trim(),
      submitted: submitted,
      submittedOn: submittedOn
    };
  }

  function normalizeSubmissions(list) {
    var out = [];
    var idRemap = {};
    function indexOfOri(ori) {
      for (var i = 0; i < out.length; i += 1) {
        if (out[i].orimanthiProposalId === ori) return i;
      }
      return -1;
    }
    (list || []).forEach(function (raw) {
      var s = normalizeOne(raw);
      if (!s.id) return;
      if (idRemap[s.id] || out.some(function (item) { return item.id === s.id; })) return;
      if (s.orimanthiProposalId) {
        var idx = indexOfOri(s.orimanthiProposalId);
        if (idx >= 0) {
          idRemap[s.id] = out[idx].id;
          if (s.submitted && !out[idx].submitted) {
            out[idx].submitted = true;
            out[idx].submittedOn = s.submittedOn;
          } else if (s.submitted && out[idx].submitted && !out[idx].submittedOn && s.submittedOn) {
            out[idx].submittedOn = s.submittedOn;
          }
          if (!out[idx].title && s.title) out[idx].title = s.title;
          return;
        }
      }
      out.push(s);
    });
    return { submissions: out, idRemap: idRemap };
  }

  function remapOwner(id, idRemap) {
    var current = String(id || '');
    var seen = {};
    while (current && idRemap[current] && !seen[current]) {
      seen[current] = true;
      current = idRemap[current];
    }
    return current;
  }

  function fileShelf(file) {
    var shelf = file && file.shelf != null ? String(file.shelf) : '';
    if (!shelf || shelf === 'invitation') return 'invitation';
    if (shelf === 'unassigned') return 'unassigned';
    return shelf;
  }

  function copyFile(file) {
    if (!file || typeof file !== 'object') return file;
    var next = {};
    Object.keys(file).forEach(function (key) { next[key] = file[key]; });
    return next;
  }

  function retargetFiles(files, idRemap) {
    return (files || []).map(function (file) {
      var next = copyFile(file);
      if (!next || typeof next !== 'object' || !next.shelf || next.shelf === 'invitation' || next.shelf === 'unassigned') {
        return next;
      }
      var mapped = remapOwner(next.shelf, idRemap);
      if (mapped && mapped !== next.shelf) next.shelf = mapped;
      return next;
    });
  }

  function retargetGroups(groups, idRemap) {
    return (groups || []).map(function (group) {
      if (!group) return group;
      var next = {
        id: group.id,
        title: group.title,
        files: (group.files || []).slice(),
        subgroups: retargetGroups(group.subgroups, idRemap)
      };
      var owner = remapOwner(group.submissionId, idRemap);
      if (owner) next.submissionId = owner;
      return next;
    });
  }

  function buildShelf(input) {
    var src = input || {};
    var norm = normalizeSubmissions(src.submissions);
    var groups = retargetGroups(src.fileGroups, norm.idRemap);
    var loose = retargetFiles(src.looseFiles, norm.idRemap);
    var linked = src.linkedProposals || [];
    var linkedFiles = src.linkedFiles || [];
    var cards = [];
    var byOri = {};
    var byId = {};

    function addCard(card) {
      cards.push(card);
      if (card.orimanthiProposalId) byOri[card.orimanthiProposalId] = card;
      if (card.submissionId) byId[card.submissionId] = card;
    }

    linked.forEach(function (proposal) {
      var pid = String((proposal && proposal.id) || '').trim();
      if (!pid) return;
      var saved = null;
      norm.submissions.forEach(function (item) {
        if (item.orimanthiProposalId === pid) saved = item;
      });
      var liveTitle = String((proposal && proposal.title) || '').trim();
      addCard({
        key: saved ? saved.id : ('orimanthi:' + pid),
        submissionId: saved ? saved.id : '',
        orimanthiProposalId: pid,
        title: liveTitle || (saved && saved.title) || 'Υποβολή',
        submitted: saved ? saved.submitted : false,
        submittedOn: saved ? saved.submittedOn : '',
        persisted: !!saved,
        orimanthiFiles: [],
        groups: [],
        files: []
      });
    });

    norm.submissions.forEach(function (item) {
      if (item.orimanthiProposalId && byOri[item.orimanthiProposalId]) return;
      if (byId[item.id]) return;
      addCard({
        key: item.id,
        submissionId: item.id,
        orimanthiProposalId: item.orimanthiProposalId,
        title: item.title || 'Υποβολή',
        submitted: item.submitted,
        submittedOn: item.submittedOn,
        persisted: true,
        orimanthiFiles: [],
        groups: [],
        files: []
      });
    });

    var orphanBuckets = {};
    var orphanOrder = [];
    linkedFiles.forEach(function (file) {
      var pid = String((file && file.sourceProposalId) || '').trim();
      if (pid && byOri[pid]) return;
      var title = String((file && file.sourceProposalTitle) || '').trim();
      var bucketKey = pid ? ('id:' + pid) : ('title:' + title);
      if (!orphanBuckets[bucketKey]) {
        orphanBuckets[bucketKey] = { pid: pid, title: title, items: [] };
        orphanOrder.push(bucketKey);
      }
      orphanBuckets[bucketKey].items.push(file);
    });
    orphanOrder.forEach(function (bucketKey) {
      var bucket = orphanBuckets[bucketKey];
      if (bucket.pid && byOri[bucket.pid]) return;
      addCard({
        key: bucket.pid ? ('orimanthi:' + bucket.pid) : ('linked:' + bucketKey),
        submissionId: '',
        orimanthiProposalId: bucket.pid,
        title: bucket.title || 'Έργο ωρίμανσης',
        submitted: false,
        submittedOn: '',
        persisted: false,
        orimanthiFiles: bucket.items.slice(),
        groups: [],
        files: []
      });
    });

    cards.forEach(function (card) {
      if (card.orimanthiFiles.length) return;
      card.orimanthiFiles = linkedFiles.filter(function (file) {
        var pid = String((file && file.sourceProposalId) || '').trim();
        return !!(card.orimanthiProposalId && pid === card.orimanthiProposalId);
      });
    });

    var knownIds = {};
    cards.forEach(function (card) {
      if (card.submissionId) knownIds[card.submissionId] = card;
    });

    var invitationGroups = [];
    var unassignedGroups = [];
    groups.forEach(function (group) {
      var owner = group && group.submissionId ? String(group.submissionId) : '';
      if (owner && knownIds[owner]) knownIds[owner].groups.push(group);
      else if (!owner) invitationGroups.push(group);
      else unassignedGroups.push(group);
    });

    var invitationFiles = [];
    var unassignedFiles = [];
    loose.forEach(function (file) {
      var shelf = fileShelf(file);
      if (shelf === 'invitation' || shelf === 'unassigned') invitationFiles.push(file);
      else if (knownIds[shelf]) knownIds[shelf].files.push(file);
      else unassignedFiles.push(file);
    });

    var submittedCount = cards.filter(function (card) { return card.submitted; }).length;
    return {
      cards: cards,
      invitationFiles: invitationFiles,
      invitationGroups: invitationGroups,
      unassignedGroups: unassignedGroups,
      unassignedFiles: unassignedFiles,
      submittedCount: submittedCount,
      totalCount: cards.length,
      submissions: norm.submissions,
      idRemap: norm.idRemap,
      singleCardStartsOpen: cards.length === 1
    };
  }

  function summaryLabel(submittedCount, totalCount) {
    var total = Number(totalCount) || 0;
    if (!total) return '';
    return 'Υποβλήθηκαν ' + (Number(submittedCount) || 0) + ' από ' + total;
  }

  function statusLabel(card) {
    if (card && card.submitted) {
      var when = formatGreekDate(card.submittedOn);
      return when ? ('Υποβλήθηκε ' + when) : 'Υποβλήθηκε';
    }
    return 'Εκκρεμεί η υποβολή';
  }

  function ensureSubmission(submissions, spec, newId) {
    var norm = normalizeSubmissions(submissions);
    var wantedId = String((spec && spec.submissionId) || '').trim();
    var ori = String((spec && spec.orimanthiProposalId) || '').trim();
    var found = null;
    norm.submissions.forEach(function (item) {
      if (wantedId && item.id === wantedId) found = item;
      if (!found && ori && item.orimanthiProposalId === ori) found = item;
    });
    if (found) return { ok: true, created: false, submission: found, submissions: norm.submissions, idRemap: norm.idRemap };
    var id = String(newId || '').trim();
    if (!id) return { ok: false, error: 'Λείπει αναγνωριστικό υποβολής' };
    var created = {
      id: id,
      title: String((spec && spec.title) || '').trim() || 'Υποβολή',
      orimanthiProposalId: ori,
      submitted: false,
      submittedOn: ''
    };
    return {
      ok: true,
      created: true,
      submission: created,
      submissions: norm.submissions.concat([created]),
      idRemap: norm.idRemap
    };
  }

  function setSubmitted(submissions, submissionId, options) {
    var opts = options || {};
    var norm = normalizeSubmissions(submissions);
    var id = remapOwner(submissionId, norm.idRemap);
    var idx = -1;
    norm.submissions.forEach(function (item, index) {
      if (item.id === id) idx = index;
    });
    if (idx < 0) return { ok: false, error: 'Η υποβολή δεν βρέθηκε', idRemap: norm.idRemap };
    var next = norm.submissions.slice();
    var current = next[idx];
    if (!opts.submitted) {
      next[idx] = {
        id: current.id,
        title: current.title,
        orimanthiProposalId: current.orimanthiProposalId,
        submitted: false,
        submittedOn: ''
      };
      return { ok: true, submissions: next, submission: next[idx], idRemap: norm.idRemap };
    }
    var rawDate = String(opts.submittedOn || '').trim();
    if (rawDate && !isoDate(rawDate)) {
      return { ok: false, error: 'Η ημερομηνία υποβολής δεν είναι έγκυρη.' };
    }
    var date = isoDate(rawDate) || todayIso(opts.today);
    if (!date) return { ok: false, error: 'Η ημερομηνία υποβολής δεν είναι έγκυρη.' };
    next[idx] = {
      id: current.id,
      title: current.title,
      orimanthiProposalId: current.orimanthiProposalId,
      submitted: true,
      submittedOn: date
    };
    return { ok: true, submissions: next, submission: next[idx], idRemap: norm.idRemap };
  }

  function assignGroup(groups, groupId, submissionId) {
    var list = groups || [];
    var found = false;
    var nested = false;
    function look(items, top) {
      (items || []).forEach(function (group) {
        if (!group) return;
        if (group.id === groupId) {
          if (top) found = true;
          else nested = true;
          return;
        }
        look(group.subgroups, false);
      });
    }
    look(list, true);
    if (!found) {
      return {
        ok: false,
        error: nested
          ? 'Μεταφέρεται ολόκληρος ο φάκελος, όχι ένας εσωτερικός.'
          : 'Ο φάκελος δεν βρέθηκε'
      };
    }
    var owner = submissionId ? String(submissionId) : '';
    var fileGroups = list.map(function (group) {
      if (!group || group.id !== groupId) return group;
      var next = {
        id: group.id,
        title: group.title,
        files: group.files || [],
        subgroups: group.subgroups || []
      };
      if (owner) next.submissionId = owner;
      return next;
    });
    return { ok: true, fileGroups: fileGroups };
  }

  function placeLooseFile(files, fileName, shelf) {
    var name = String(fileName || '');
    var found = false;
    var next = (files || []).map(function (file) {
      var currentName = file && (file.fileName || file.originalName || file.name);
      if (String(currentName || '') !== name) return file;
      found = true;
      var copy = copyFile(file);
      if (!shelf || shelf === 'invitation') delete copy.shelf;
      else copy.shelf = String(shelf);
      return copy;
    });
    if (!found) return { ok: false, error: 'Το αρχείο δεν βρέθηκε' };
    return { ok: true, looseFiles: next };
  }

  function groupOwner(group) {
    return group && group.submissionId ? String(group.submissionId) : '';
  }

  function groupsOwnedBy(groups, ownerId) {
    var wanted = ownerId ? String(ownerId) : '';
    return (groups || []).filter(function (group) {
      return groupOwner(group) === wanted;
    });
  }

  function ownerOfNamedFile(looseFiles, groups, fileName) {
    var name = String(fileName || '');
    var loose = null;
    (looseFiles || []).forEach(function (file) {
      if (loose || !file) return;
      var current = file.fileName || file.originalName || file.name;
      if (String(current || '') === name) loose = file;
    });
    if (loose) {
      var shelf = loose.shelf ? String(loose.shelf) : '';
      if (!shelf || shelf === 'invitation' || shelf === 'unassigned') return '';
      return shelf;
    }
    function contains(group) {
      if (!group) return false;
      var files = group.files || [];
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        var current = typeof file === 'string' ? file : (file && (file.fileName || file.originalName || file.name));
        if (String(current || '') === name) return true;
      }
      var subs = group.subgroups || [];
      for (var j = 0; j < subs.length; j += 1) {
        if (contains(subs[j])) return true;
      }
      return false;
    }
    var list = groups || [];
    for (var k = 0; k < list.length; k += 1) {
      if (contains(list[k])) return groupOwner(list[k]);
    }
    return '';
  }

  function sharedOwner(looseFiles, groups, names) {
    var list = names || [];
    if (!list.length) return { ok: false, error: 'Δεν επιλέχθηκαν αρχεία.' };
    var ownerId = null;
    for (var i = 0; i < list.length; i += 1) {
      var owner = ownerOfNamedFile(looseFiles, groups, list[i]);
      if (ownerId === null) ownerId = owner;
      else if (ownerId !== owner) {
        return {
          ok: false,
          error: 'Τα αρχεία δεν είναι όλα στο ίδιο σημείο. Διάλεξε μόνο από μία πράξη ή μόνο από τα αρχεία της πρόσκλησης.'
        };
      }
    }
    return { ok: true, ownerId: ownerId || '' };
  }

  function rewriteOwners(fileGroups, looseFiles, idRemap) {
    var map = idRemap || {};
    return {
      fileGroups: retargetGroups(fileGroups, map),
      looseFiles: retargetFiles(looseFiles, map)
    };
  }

  return {
    isoDate: isoDate,
    formatGreekDate: formatGreekDate,
    normalizeSubmissions: normalizeSubmissions,
    buildShelf: buildShelf,
    summaryLabel: summaryLabel,
    statusLabel: statusLabel,
    ensureSubmission: ensureSubmission,
    setSubmitted: setSubmitted,
    assignGroup: assignGroup,
    placeLooseFile: placeLooseFile,
    groupsOwnedBy: groupsOwnedBy,
    ownerOfNamedFile: ownerOfNamedFile,
    sharedOwner: sharedOwner,
    fileShelf: fileShelf,
    rewriteOwners: rewriteOwners
  };
});
