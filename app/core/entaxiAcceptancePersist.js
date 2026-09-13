/**
 * Διατήρηση στοιχείων αποδοχής Διαύγειας όταν αποθηκεύεται η ένταξη
 * από φόρμα που δεν τα στέλνει.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEntaxiAcceptancePersist = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var KEYS = [
    'diavgeiaAcceptanceAda',
    'diavgeiaAcceptanceMeta',
    'diavgeiaAcceptanceMetas'
  ];

  function isMissing(value) {
    return value === undefined || value === null || value === '';
  }

  function preserveAcceptanceFields(existing, incoming) {
    var out = incoming && typeof incoming === 'object' ? incoming : {};
    var src = existing && typeof existing === 'object' ? existing : null;
    if (!src) return out;
    KEYS.forEach(function (key) {
      if (isMissing(out[key]) && !isMissing(src[key])) {
        out[key] = src[key];
      }
    });
    return out;
  }

  function fileRefName(item) {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    return String(item.fileName || item.name || '').trim();
  }

  function collectApprovalFileNames(data) {
    var names = [];
    var seen = Object.create(null);
    var add = function (item) {
      var name = fileRefName(item);
      if (!name || seen[name]) return;
      seen[name] = true;
      names.push(name);
    };
    var list = data && data.approvalPDFs;
    if (Array.isArray(list)) list.forEach(add);
    else if (list) add(list);
    else add(data && data.approvalPDF);
    return names;
  }

  function metaMatchesApprovalFile(meta, fileName) {
    var base = String(fileName || '').replace(/^.*[/\\]/, '').trim();
    if (!base) return false;
    var stored = fileRefName(meta && (meta.pdfFileName || meta.fileName));
    if (stored && (stored === base || stored.replace(/^.*[/\\]/, '') === base)) return true;
    var ada = String(meta && meta.ada || '').trim();
    return !!(ada && base.indexOf(ada) !== -1);
  }

  function pickPreferredAcceptanceMeta(metas) {
    var list = Array.isArray(metas) ? metas.filter(Boolean) : [];
    if (!list.length) return null;
    return list.find(function (row) { return row.role === 'council_budget'; }) || list[0];
  }

  function syncAcceptanceAfterApprovalFiles(data) {
    var out = data && typeof data === 'object' ? data : {};
    var files = collectApprovalFileNames(out);
    var metas = [];
    if (Array.isArray(out.diavgeiaAcceptanceMetas)) {
      metas = out.diavgeiaAcceptanceMetas.filter(Boolean);
    }
    if (out.diavgeiaAcceptanceMeta && out.diavgeiaAcceptanceMeta.ada) {
      var primaryAda = String(out.diavgeiaAcceptanceMeta.ada).trim();
      if (primaryAda && !metas.some(function (row) { return String(row.ada || '').trim() === primaryAda; })) {
        metas = [out.diavgeiaAcceptanceMeta].concat(metas);
      }
    }
    var kept = files.length
      ? metas.filter(function (meta) {
        return files.some(function (name) { return metaMatchesApprovalFile(meta, name); });
      })
      : [];
    out.diavgeiaAcceptanceMetas = kept;
    var preferred = pickPreferredAcceptanceMeta(kept);
    if (!files.length) {
      out.diavgeiaAcceptanceAda = '';
      out.diavgeiaAcceptanceMeta = null;
      out.approvalPDF = '';
      return out;
    }
    if (preferred) {
      out.diavgeiaAcceptanceAda = preferred.ada || '';
      out.diavgeiaAcceptanceMeta = preferred;
    } else {
      out.diavgeiaAcceptanceAda = '';
      out.diavgeiaAcceptanceMeta = null;
    }
    var approvalName = fileRefName(out.approvalPDF);
    if (!approvalName || files.indexOf(approvalName) === -1) {
      out.approvalPDF = files[0] || '';
    }
    return out;
  }

  function recordHasStoredAcceptance(data) {
    if (String(data && data.diavgeiaAcceptanceAda || data && data.diavgeiaAcceptanceMeta && data.diavgeiaAcceptanceMeta.ada || '').trim()) return true;
    return collectApprovalFileNames(data).length > 0;
  }

  function recordHasFileName(data, fileName) {
    var base = String(fileName || '').replace(/^.*[/\\]/, '').trim();
    if (!base) return false;
    var names = collectApprovalFileNames(data);
    return names.some(function (name) {
      var itemBase = String(name || '').replace(/^.*[/\\]/, '');
      return name === fileName || itemBase === base;
    });
  }

  function removeApprovalFileFromRecord(data, fileName) {
    var out = data && typeof data === 'object' ? data : {};
    if (!recordHasFileName(out, fileName)) return { changed: false, record: out };
    out.approvalPDFs = dropFileNameFromList(out.approvalPDFs, fileName);
    if (fileRefName(out.approvalPDF) === String(fileName || '').trim()
      || fileRefName(out.approvalPDF).replace(/^.*[/\\]/, '') === String(fileName || '').replace(/^.*[/\\]/, '').trim()) {
      out.approvalPDF = '';
    }
    syncAcceptanceAfterApprovalFiles(out);
    return { changed: true, record: out };
  }

  function mergeAttachedAcceptance(existing, attachedRows) {
    var out = existing && typeof existing === 'object' ? Object.assign({}, existing) : {};
    var nextApproval = collectApprovalFileNames(out);
    var nextMetas = Array.isArray(out.diavgeiaAcceptanceMetas) ? out.diavgeiaAcceptanceMetas.slice() : [];
    var rows = Array.isArray(attachedRows) ? attachedRows : [];
    rows.forEach(function (row) {
      var name = String(row && row.pdfFileName || '').trim();
      if (name && nextApproval.indexOf(name) === -1) nextApproval.push(name);
      var meta = row && row.meta ? Object.assign({}, row.meta, { pdfFileName: name || row.meta.pdfFileName }) : null;
      if (meta && meta.ada && !nextMetas.some(function (m) { return m && m.ada === meta.ada; })) {
        nextMetas.push(meta);
      }
    });
    var preferredRow = rows.find(function (row) {
      return row && row.meta && row.meta.role === 'council_budget';
    }) || rows[0] || null;
    var preferredMeta = preferredRow && preferredRow.meta
      ? Object.assign({}, preferredRow.meta, { pdfFileName: preferredRow.pdfFileName })
      : pickPreferredAcceptanceMeta(nextMetas);
    out.approvalPDFs = nextApproval;
    out.approvalPDF = fileRefName(out.approvalPDF) || (preferredRow && preferredRow.pdfFileName) || nextApproval[0] || '';
    if (preferredMeta && preferredMeta.ada) {
      out.diavgeiaAcceptanceAda = preferredMeta.ada;
      out.diavgeiaAcceptanceMeta = preferredMeta;
    }
    out.diavgeiaAcceptanceMetas = nextMetas;
    return out;
  }

  function dropFileNameFromList(list, fileName) {
    var base = String(fileName || '').replace(/^.*[/\\]/, '').trim();
    if (!base) return Array.isArray(list) ? list.slice() : [];
    var arr = Array.isArray(list) ? list : (list ? [list] : []);
    return arr.filter(function (item) {
      var name = fileRefName(item);
      if (!name) return false;
      var itemBase = name.replace(/^.*[/\\]/, '');
      return name !== fileName && itemBase !== base;
    });
  }

  return {
    preserveAcceptanceFields: preserveAcceptanceFields,
    dropFileNameFromList: dropFileNameFromList,
    fileRefName: fileRefName,
    collectApprovalFileNames: collectApprovalFileNames,
    syncAcceptanceAfterApprovalFiles: syncAcceptanceAfterApprovalFiles,
    recordHasStoredAcceptance: recordHasStoredAcceptance,
    recordHasFileName: recordHasFileName,
    removeApprovalFileFromRecord: removeApprovalFileFromRecord,
    mergeAttachedAcceptance: mergeAttachedAcceptance
  };
});
