/** Ιεραρχική κατηγοριοποίηση αρχείων Ωρίμανσης: κύρια κατηγορία → εξειδίκευση */

export const FILE_CATEGORY_ROOT_MELETES = 'meletes';
export const FILE_CATEGORY_ROOT_ADEIODOTISEIS = 'adeiodotiseis';

export const FILE_CATEGORY_ROOTS = {
  [FILE_CATEGORY_ROOT_MELETES]: {
    id: FILE_CATEGORY_ROOT_MELETES,
    label: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
    shortLabel: 'Μελέτες έργου',
    icon: '📐',
    accent: '#4f46e5',
    accentLight: '#eef2ff',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
  },
  [FILE_CATEGORY_ROOT_ADEIODOTISEIS]: {
    id: FILE_CATEGORY_ROOT_ADEIODOTISEIS,
    label: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ',
    shortLabel: 'Αδειοδοτήσεις',
    icon: '📋',
    accent: '#0d9488',
    accentLight: '#f0fdfa',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #2dd4bf 100%)',
  },
};

export const DEFAULT_MELETES_SPECS = [
  'ΤΟΠΟΓΡΑΦΙΚΑ',
  'ΚΤΗΜΑΤΟΛΟΓΙΟ',
  'ΓΕΩΤΕΧΝΙΚΑ',
  'ΣΤΑΤΙΚΑ',
  'Η/Μ ΜΕΛΕΤΕΣ',
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΑ',
  'ΟΔΟΠΟΙΙΑ',
  'ΥΔΡΑΥΛΙΚΑ',
  'ΑΡΧΙΤΕΚΤΟΝΙΚΑ',
  'ΦΩΤΟΓΡΑΦΙΕΣ',
  'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ',
  'ΔΙΑΦΟΡΑ',
];

export const DEFAULT_ADEIODOTISEIS_SPECS = [
  'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ',
  'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
  'ΥΠΗΡΕΣΙΑ ΝΕΩΤΕΡΩΝ ΜΝΗΜΕΙΩΝ',
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΑ (ΑΕΠΟ)',
  'ΔΙΕΥΘΥΝΣΗ ΥΔΑΤΩΝ',
  'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ',
  'ΣΥΜΒΟΥΛΙΟ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ',
  'ΟΠΕΚΕΠΕ',
  'ΚΤΗΜΑΤΟΛΟΓΙΟ',
];

export const LS_CUSTOM_MELETES_SPECS = 'orimanthiCustomMeletesFileSpecs';
export const LS_CUSTOM_ADEIODOTISEIS_SPECS = 'orimanthiCustomAdeiodotiseisFileSpecs';
export const LS_HIDDEN_MELETES_SPECS = 'orimanthiHiddenMeletesFileSpecs';
export const LS_HIDDEN_ADEIODOTISEIS_SPECS = 'orimanthiHiddenAdeiodotiseisFileSpecs';

const LABEL_SEP = ' · ';

function mergeSpecLists(defaults, custom) {
  const merged = [...defaults];
  (custom || []).forEach((item) => {
    const label = String(item || '').trim();
    if (!label) return;
    if (!merged.some((x) => x.toLowerCase() === label.toLowerCase())) merged.push(label);
  });
  return merged;
}

export function loadCustomFileSpecs(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveCustomFileSpecs(storageKey, defaults, fullList) {
  const custom = fullList.filter(
    (item) => !defaults.some((d) => d.toLowerCase() === String(item).toLowerCase())
  );
  localStorage.setItem(storageKey, JSON.stringify(custom));
}

export function loadHiddenFileSpecs(storageKey) {
  return loadCustomFileSpecs(storageKey);
}

export function saveHiddenFileSpecs(storageKey, hiddenList) {
  const hidden = (hiddenList || []).map((x) => String(x || '').trim()).filter(Boolean);
  localStorage.setItem(storageKey, JSON.stringify(hidden));
}

export function filterHiddenSpecs(specs, hiddenList) {
  const hidden = new Set(
    (hiddenList || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!hidden.size) return specs || [];
  return (specs || []).filter((spec) => !hidden.has(String(spec).toLowerCase()));
}

export function isDefaultFileSpec(rootId, spec) {
  const trimmed = String(spec || '').trim();
  if (!trimmed) return false;
  return getDefaultSpecsForRoot(rootId).some((d) => d.toLowerCase() === trimmed.toLowerCase());
}

export function getMeletesSpecs(customList, hiddenList) {
  return filterHiddenSpecs(mergeSpecLists(DEFAULT_MELETES_SPECS, customList), hiddenList);
}

export function getAdeiodotiseisSpecs(customList, hiddenList) {
  return filterHiddenSpecs(mergeSpecLists(DEFAULT_ADEIODOTISEIS_SPECS, customList), hiddenList);
}

export function buildFileGroupLabel(rootId, spec) {
  const root = FILE_CATEGORY_ROOTS[rootId]?.label;
  const trimmed = String(spec || '').trim();
  if (!root || !trimmed) return trimmed || root || '';
  return `${root}${LABEL_SEP}${trimmed}`;
}

export function parseFileGroupLabel(label) {
  const text = String(label || '').trim();
  if (!text) return { rootId: null, spec: null };
  for (const root of Object.values(FILE_CATEGORY_ROOTS)) {
    const prefix = `${root.label}${LABEL_SEP}`;
    if (text.startsWith(prefix)) {
      return { rootId: root.id, spec: text.slice(prefix.length).trim() };
    }
  }
  return { rootId: null, spec: text };
}

export function getFileGroupIdentity(group) {
  if (group?.fileCategoryRoot && group?.fileCategorySpec) {
    return {
      rootId: group.fileCategoryRoot,
      spec: String(group.fileCategorySpec).trim(),
    };
  }
  return parseFileGroupLabel(group?.label);
}

export function fileGroupIdentityKey(rootId, spec) {
  return `${rootId || ''}::${String(spec || '').trim()}`.toLowerCase();
}

export function fileGroupExists(groups, rootId, spec) {
  const targetKey = fileGroupIdentityKey(rootId, spec);
  return (groups || []).some((g) => {
    const id = getFileGroupIdentity(g);
    return fileGroupIdentityKey(id.rootId, id.spec) === targetKey;
  });
}

export function buildFileGroupPayload(rootId, spec) {
  const trimmedSpec = String(spec || '').trim();
  return {
    label: buildFileGroupLabel(rootId, trimmedSpec),
    fileCategoryRoot: rootId,
    fileCategorySpec: trimmedSpec,
  };
}

export function getSpecsForRoot(
  rootId,
  customMeletes,
  customAdeiodotiseis,
  hiddenMeletes,
  hiddenAdeiodotiseis
) {
  if (rootId === FILE_CATEGORY_ROOT_MELETES) {
    return getMeletesSpecs(customMeletes, hiddenMeletes);
  }
  if (rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS) {
    return getAdeiodotiseisSpecs(customAdeiodotiseis, hiddenAdeiodotiseis);
  }
  return [];
}

export function getDefaultSpecsForRoot(rootId) {
  if (rootId === FILE_CATEGORY_ROOT_MELETES) return DEFAULT_MELETES_SPECS;
  if (rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS) return DEFAULT_ADEIODOTISEIS_SPECS;
  return [];
}

export function getCustomStorageKeyForRoot(rootId) {
  if (rootId === FILE_CATEGORY_ROOT_MELETES) return LS_CUSTOM_MELETES_SPECS;
  if (rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS) return LS_CUSTOM_ADEIODOTISEIS_SPECS;
  return null;
}

export function getHiddenStorageKeyForRoot(rootId) {
  if (rootId === FILE_CATEGORY_ROOT_MELETES) return LS_HIDDEN_MELETES_SPECS;
  if (rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS) return LS_HIDDEN_ADEIODOTISEIS_SPECS;
  return null;
}

export function isSpecUsed(groups, rootId, spec) {
  return fileGroupExists(groups, rootId, spec);
}

/** Μετατροπή παλιών flat labels σε ιεραρχική δομή (root + spec). */
export function migrateFileGroup(group) {
  if (!group || typeof group !== 'object') return group;
  if (group.fileCategoryRoot && group.fileCategorySpec) {
    const normalized = buildFileGroupPayload(group.fileCategoryRoot, group.fileCategorySpec);
    if (group.label !== normalized.label) {
      return { ...group, label: normalized.label };
    }
    return group;
  }
  const parsed = parseFileGroupLabel(group.label);
  if (parsed.rootId && parsed.spec) {
    return { ...group, ...buildFileGroupPayload(parsed.rootId, parsed.spec) };
  }
  const flat = String(group.label || '').trim();
  if (!flat) return group;
  const meletesMatch = DEFAULT_MELETES_SPECS.find((s) => s.toLowerCase() === flat.toLowerCase());
  if (meletesMatch) {
    return { ...group, ...buildFileGroupPayload(FILE_CATEGORY_ROOT_MELETES, meletesMatch) };
  }
  const adeiodMatch = DEFAULT_ADEIODOTISEIS_SPECS.find((s) => s.toLowerCase() === flat.toLowerCase());
  if (adeiodMatch) {
    return { ...group, ...buildFileGroupPayload(FILE_CATEGORY_ROOT_ADEIODOTISEIS, adeiodMatch) };
  }
  return group;
}

export function summarizeOrimanthiPermits(fileGroups) {
  const permits = (fileGroups || []).filter((group) => {
    const identity = getFileGroupIdentity(group);
    return identity.rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS;
  });
  const issued = permits.filter((group) => !!group.permitIssued).length;
  return {
    total: permits.length,
    issued,
    pending: Math.max(0, permits.length - issued),
  };
}

export function orimanthiHasPendingPermit(fileGroups) {
  const summary = summarizeOrimanthiPermits(fileGroups);
  return summary.total > 0 && summary.pending > 0;
}

export function migrateProposalFileGroups(proposal) {
  if (!proposal?.fileGroups?.length) return proposal;
  const fileGroups = proposal.fileGroups.map(migrateFileGroup);
  const changed = JSON.stringify(fileGroups) !== JSON.stringify(proposal.fileGroups);
  return changed ? { ...proposal, fileGroups } : proposal;
}

export function appendFileCategoryGroups(existingGroups, picks, makeId) {
  const createId = typeof makeId === 'function' ? makeId : () => `fg-${Date.now()}`;
  let groups = [...(existingGroups || [])];
  const added = [];
  (Array.isArray(picks) ? picks : [picks]).forEach((pick) => {
    const rootId = pick?.rootId;
    const spec = String(pick?.spec || '').trim();
    if (!rootId || !spec) return;
    if (fileGroupExists(groups, rootId, spec)) return;
    const payload = buildFileGroupPayload(rootId, spec);
    const group = {
      id: createId(),
      ...payload,
      files: [],
    };
    groups = [...groups, group];
    added.push(group);
  });
  return { groups, added };
}
