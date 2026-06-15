/**
 * Βοηθητικές για κατηγοριοποίηση αρχείων Ωρίμανσης (main process).
 * Mirror του src/utils/orimanthiFileCategories.js — μόνο migration.
 */
const FILE_CATEGORY_ROOT_MELETES = 'meletes';
const FILE_CATEGORY_ROOT_ADEIODOTISEIS = 'adeiodotiseis';

const FILE_CATEGORY_ROOTS = {
  [FILE_CATEGORY_ROOT_MELETES]: { label: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ' },
  [FILE_CATEGORY_ROOT_ADEIODOTISEIS]: { label: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ' },
};

const DEFAULT_MELETES_SPECS = [
  'ΤΟΠΟΓΡΑΦΙΚΑ', 'ΚΤΗΜΑΤΟΛΟΓΙΟ', 'ΓΕΩΤΕΧΝΙΚΑ', 'ΣΤΑΤΙΚΑ', 'Η/Μ ΜΕΛΕΤΕΣ',
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΑ', 'ΟΔΟΠΟΙΙΑ', 'ΥΔΡΑΥΛΙΚΑ', 'ΑΡΧΙΤΕΚΤΟΝΙΚΑ', 'ΦΩΤΟΓΡΑΦΙΕΣ',
  'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ', 'ΔΙΑΦΟΡΑ',
];

const DEFAULT_ADEIODOTISEIS_SPECS = [
  'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ', 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', 'ΥΠΗΡΕΣΙΑ ΝΕΩΤΕΡΩΝ ΜΝΗΜΕΙΩΝ',
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΑ (ΑΕΠΟ)', 'ΔΙΕΥΘΥΝΣΗ ΥΔΑΤΩΝ', 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ',
  'ΣΥΜΒΟΥΛΙΟ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ', 'ΟΠΕΚΕΠΕ', 'ΚΤΗΜΑΤΟΛΟΓΙΟ',
];

const LABEL_SEP = ' · ';

function buildFileGroupLabel(rootId, spec) {
  const root = FILE_CATEGORY_ROOTS[rootId]?.label;
  const trimmed = String(spec || '').trim();
  if (!root || !trimmed) return trimmed || root || '';
  return `${root}${LABEL_SEP}${trimmed}`;
}

function buildFileGroupPayload(rootId, spec) {
  const trimmedSpec = String(spec || '').trim();
  return {
    label: buildFileGroupLabel(rootId, trimmedSpec),
    fileCategoryRoot: rootId,
    fileCategorySpec: trimmedSpec,
  };
}

function parseFileGroupLabel(label) {
  const text = String(label || '').trim();
  if (!text) return { rootId: null, spec: null };
  for (const root of Object.values(FILE_CATEGORY_ROOTS)) {
    const prefix = `${root.label}${LABEL_SEP}`;
    if (text.startsWith(prefix)) {
      return { rootId: Object.keys(FILE_CATEGORY_ROOTS).find(
        (k) => FILE_CATEGORY_ROOTS[k].label === root.label
      ), spec: text.slice(prefix.length).trim() };
    }
  }
  return { rootId: null, spec: text };
}

function migrateFileGroup(group) {
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

function migrateProposalFileGroups(proposal) {
  if (!proposal?.fileGroups?.length) return { proposal, changed: false };
  const fileGroups = proposal.fileGroups.map(migrateFileGroup);
  const changed = JSON.stringify(fileGroups) !== JSON.stringify(proposal.fileGroups);
  return {
    proposal: changed ? { ...proposal, fileGroups } : proposal,
    changed,
  };
}

module.exports = {
  migrateProposalFileGroups,
};
