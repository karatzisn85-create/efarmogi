/**
 * Συγχώνευση αρχείων / εγκρίσεων κατά την αποθήκευση κάρτας υποέργου.
 * Σκοπός: η παλιά φωτογραφία της φόρμας να μην ξαναφέρει διαγραμμένα.
 * Δεν πειράζει κλειδώματα ούτε updatedAt σε side-channel διαγραφές.
 */

function fileEntryName(file) {
  if (typeof file === 'string') return String(file).trim();
  return String(file?.name || file?.fileName || '').trim();
}

/**
 * Κράτα αρχείο αν είναι ήδη στον φάκελο υποέργου, ή αν η φόρμα φέρνει
 * πλήρη διαδρομή προς αντιγραφή (νέο ανέβασμα πριν γίνει η αντιγραφή).
 * @param {(fileName: string, file: any) => boolean} fileExists
 */
function shouldKeepIncomingFile(file, fileExists) {
  const name = fileEntryName(file);
  if (!name) return false;
  return typeof fileExists === 'function' && !!fileExists(name, file);
}

/**
 * @param {Array} existingGroups ομάδες στον δίσκο
 * @param {Array} incomingGroups ομάδες από τη φόρμα
 * @param {(fileName: string, file?: any) => boolean} fileExists υπάρχει στον φάκελο ή είναι νέο με έγκυρη πηγή;
 */
function mergeFileGroupsForSave(existingGroups, incomingGroups, fileExists) {
  const existing = Array.isArray(existingGroups) ? existingGroups : [];
  const incoming = Array.isArray(incomingGroups) ? incomingGroups : [];
  const exists = typeof fileExists === 'function' ? fileExists : () => false;

  if (incoming.length === 0) return existing;

  const map = new Map(
    existing.map((g) => [g.id, { ...g, files: [...(g.files || [])] }])
  );

  incoming.forEach((newGroup) => {
    if (!newGroup || newGroup.id == null) return;
    const incomingFiles = Array.isArray(newGroup.files) ? newGroup.files : [];

    if (map.has(newGroup.id)) {
      const existingGroup = map.get(newGroup.id);
      const mergedFiles = [...(existingGroup.files || [])];
      incomingFiles.forEach((newFile) => {
        const name = fileEntryName(newFile);
        if (!name) return;
        const already = mergedFiles.some((f) => fileEntryName(f) === name);
        if (already) return;
        if (shouldKeepIncomingFile(newFile, exists)) mergedFiles.push(newFile);
      });
      map.set(newGroup.id, {
        ...existingGroup,
        title: newGroup.title,
        files: mergedFiles,
      });
    } else {
      const kept = incomingFiles.filter((f) => shouldKeepIncomingFile(f, exists));
      if (kept.length === 0) return;
      map.set(newGroup.id, { ...newGroup, files: kept });
    }
  });

  return Array.from(map.values()).filter((g) => (g.files || []).length > 0);
}

/**
 * Οι εγκρίσεις γράφονται από το δικό τους σημείο, όχι από την κάρτα.
 * Αν στον δίσκο υπάρχει πίνακας (ακόμα και κενός), αυτός κερδίζει.
 * Πρώτη αποθήκευση νέου υποέργου: δεν υπάρχει πίνακας → παίρνουμε ό,τι φέρνει η φόρμα.
 */
function mergeEgkriseisForSave(existingEgkriseis, incomingEgkriseis) {
  if (Array.isArray(existingEgkriseis)) return existingEgkriseis;
  return Array.isArray(incomingEgkriseis) ? incomingEgkriseis : [];
}

module.exports = {
  fileEntryName,
  mergeFileGroupsForSave,
  mergeEgkriseisForSave,
};
