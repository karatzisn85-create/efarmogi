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

export function collectEntaxiApprovalFileNames(entaxi) {
  const names = toExistingEntaxiFileObjects(entaxi?.approvalPDFs).map((f) => f.fileName);
  const legacy = String(entaxi?.approvalPDF || '').trim();
  if (legacy && !names.some((n) => n.toLowerCase() === legacy.toLowerCase())) {
    names.unshift(legacy);
  }
  return names;
}

function collectEntaxiDecisionFileNames(entaxi) {
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
  if (!unaccounted.length) return { entaxiFiles, approvalFiles };

  const onDisk = new Set(files);
  const missingEntaxi = entaxiPDFs.filter((name) => !onDisk.has(name));
  const missingApproval = approvalPDFs.filter((name) => !onDisk.has(name));

  if (entaxiPDFs.length === 0 && approvalPDFs.length === 0) {
    entaxiFiles = files.slice();
    approvalFiles = [];
  } else if (missingApproval.length > 0 && missingEntaxi.length === 0) {
    approvalFiles = approvalFiles.concat(unaccounted);
  } else if (missingEntaxi.length > 0 && missingApproval.length === 0) {
    entaxiFiles = entaxiFiles.concat(unaccounted);
  } else if (entaxiPDFs.length === 0 && approvalPDFs.length > 0) {
    entaxiFiles = unaccounted.slice();
  } else if (approvalPDFs.length === 0 && entaxiPDFs.length > 0) {
    approvalFiles = unaccounted.slice();
  }
  return { entaxiFiles, approvalFiles };
}
