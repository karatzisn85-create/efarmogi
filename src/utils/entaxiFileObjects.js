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
