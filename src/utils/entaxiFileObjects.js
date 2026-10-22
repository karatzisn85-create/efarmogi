export function toExistingEntaxiFileObjects(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (item == null || item === '') return null;
    if (typeof item === 'string') {
      const name = item.trim();
      return name ? { fileName: name, originalName: name, isExisting: true } : null;
    }
    if (typeof item !== 'object') return null;
    const name = String(item.fileName || item.name || item.originalName || '').trim();
    if (!name) return null;
    return { fileName: name, originalName: name, isExisting: true };
  }).filter(Boolean);
}

function pushUniqueFileName(names, seen, value) {
  const name = String(value || '').trim();
  if (!name) return;
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  names.push(name);
}

export function collectEntaxiApprovalFileNames(entaxi) {
  const names = [];
  const seen = new Set();
  const legacy = entaxi?.approvalPDF;
  const legacyName = typeof legacy === 'string'
    ? legacy
    : (legacy && (legacy.fileName || legacy.name));
  pushUniqueFileName(names, seen, legacyName);
  toExistingEntaxiFileObjects(entaxi?.approvalPDFs).forEach((file) => {
    pushUniqueFileName(names, seen, file.fileName);
  });
  return names;
}

function inclusionDocumentNames(entaxi) {
  const names = new Set(collectEntaxiDecisionFileNames(entaxi).map((name) => name.toLowerCase()));
  const ada = String(entaxi?.diavgeiaAda || entaxi?.diavgeiaMeta?.ada || '').trim();
  if (ada) {
    names.add(`${ada}.pdf`.toLowerCase());
    names.add(`ένταξη — διαύγεια ${ada}.pdf`.toLowerCase());
    names.add(`τροποποίηση ένταξης — διαύγεια ${ada}.pdf`.toLowerCase());
  }
  return names;
}

function isInclusionDocumentFile(fileName, entaxi) {
  return inclusionDocumentNames(entaxi).has(String(fileName || '').trim().toLowerCase());
}

export function collectEntaxiDecisionFileNames(entaxi) {
  const list = Array.isArray(entaxi?.entaxiPDFs) && entaxi.entaxiPDFs.length > 0
    ? entaxi.entaxiPDFs
    : (entaxi?.entaxiPDF ? [entaxi.entaxiPDF] : []);
  return toExistingEntaxiFileObjects(list).map((f) => f.fileName);
}

export function partitionEntaxiViewerFiles(diskFiles, entaxi) {
  const files = Array.isArray(diskFiles) ? diskFiles.filter(Boolean) : [];
  const entaxiPDFs = collectEntaxiDecisionFileNames(entaxi);
  const approvalPDFs = collectEntaxiApprovalFileNames(entaxi);
  const recorded = new Set([...entaxiPDFs, ...approvalPDFs]);
  let entaxiFiles = entaxiPDFs.length ? files.filter((file) => entaxiPDFs.includes(file)) : [];
  let approvalFiles = approvalPDFs.length ? files.filter((file) => approvalPDFs.includes(file)) : [];
  const unaccounted = files.filter((file) => !recorded.has(file));

  const onDisk = new Set(files);
  const missingEntaxi = entaxiPDFs.filter((name) => !onDisk.has(name));
  const missingApproval = approvalPDFs.filter((name) => !onDisk.has(name));

  const placeUnaccounted = (intoApproval) => {
    unaccounted.forEach((file) => {
      if (intoApproval && !isInclusionDocumentFile(file, entaxi)) {
        approvalFiles.push(file);
      } else if (!entaxiFiles.includes(file)) {
        entaxiFiles.push(file);
      }
    });
  };

  if (unaccounted.length) {
    if (entaxiPDFs.length === 0 && approvalPDFs.length === 0) {
      entaxiFiles = files.slice();
      approvalFiles = [];
    } else if (missingApproval.length > 0 && missingEntaxi.length === 0) {
      placeUnaccounted(true);
    } else if (missingEntaxi.length > 0 && missingApproval.length === 0) {
      placeUnaccounted(false);
    } else if (entaxiPDFs.length === 0 && approvalPDFs.length > 0) {
      placeUnaccounted(false);
    } else if (approvalPDFs.length === 0 && entaxiPDFs.length > 0) {
      placeUnaccounted(false);
    } else {
      placeUnaccounted(false);
    }
  }

  const inclusionNames = inclusionDocumentNames(entaxi);
  const keptApproval = [];
  approvalFiles.forEach((file) => {
    if (inclusionNames.has(String(file).toLowerCase())) {
      if (!entaxiFiles.includes(file)) entaxiFiles.push(file);
      return;
    }
    keptApproval.push(file);
  });
  return { entaxiFiles, approvalFiles: keptApproval };
}
