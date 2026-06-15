/**
 * Κατηγορίες έργου Ωρίμανσης (main process) — validation & canonical names.
 */
const CATEGORY_HYDRAULICS = 'ΥΔΡΑΥΛΙΚΑ';

const DEFAULT_PROJECT_CATEGORIES = [
  CATEGORY_HYDRAULICS,
  'ΓΕΩΤΡΗΣΕΙΣ', 'ΚΤΙΡΙΑΚΑ', 'ΟΔΟΠΟΙΙΑ', 'ΑΝΑΠΛΑΣΕΙΣ ΟΙΚΙΣΜΩΝ',
  'Ε.Ε.Λ.', 'ΑΠΟΡΡΙΜΑΤΑ', 'ΕΝΕΡΓΕΙΑΚΑ', 'ΡΕΜΑΤΑ',
  'ΓΕΩΛΟΓΙΚΕΣ - ΓΕΩΤΕΧΝΙΚΕΣ', 'ΓΕΩΡΓΙΚΑ - ΦΥΤΟΤΕΧΝΙΚΕΣ', 'ΠΕΡΙΒΑΛΛΟΝΤΙΚΕΣ', 'ΠΟΛΙΤΙΣΤΙΚΑ',
];

const DEFAULT_CATEGORY_SPECIALIZATIONS = {
  [CATEGORY_HYDRAULICS]: ['ΥΔΡΕΥΣΗ', 'ΑΠΟΧΕΤΕΥΣΗ', 'ΥΠΟΔΟΜΕΣ'],
};

const LEGACY_CATEGORY_ALIASES = {
  'έργα υποδομής': CATEGORY_HYDRAULICS,
  'οδοποιία': 'ΟΔΟΠΟΙΙΑ',
  'αναπλάσεις οικισμών': 'ΑΝΑΠΛΑΣΕΙΣ ΟΙΚΙΣΜΩΝ',
  'κτιριακά': 'ΚΤΙΡΙΑΚΑ',
  'διάφορα': null,
};

function normKey(text) {
  return String(text || '').trim().toLowerCase();
}

function resolveCategoryLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  const alias = LEGACY_CATEGORY_ALIASES[normKey(text)];
  if (alias === null) return text;
  if (alias) return alias;
  return text;
}

function mergeUniqueLists(defaults, custom) {
  const merged = [...(defaults || [])];
  (custom || []).forEach((item) => {
    const label = String(item || '').trim();
    if (!label) return;
    if (!merged.some((x) => normKey(x) === normKey(label))) merged.push(label);
  });
  return merged;
}

function getSpecializationsForCategory(category, customSpecMap) {
  const resolved = resolveCategoryLabel(category);
  if (!resolved) return [];
  const defaults = DEFAULT_CATEGORY_SPECIALIZATIONS[resolved] || [];
  const custom = (customSpecMap && customSpecMap[resolved]) || [];
  return mergeUniqueLists(defaults, custom);
}

function categoryHasSpecializations(category, customSpecMap) {
  return getSpecializationsForCategory(category, customSpecMap).length > 0;
}

function categoriesAreEquivalent(a, b) {
  const ra = resolveCategoryLabel(a);
  const rb = resolveCategoryLabel(b);
  if (!ra || !rb) return normKey(a) === normKey(b);
  return normKey(ra) === normKey(rb);
}

function reconcilePendingTemplateCategory(oldCategory, newCategory, currentPendingTemplateCategory) {
  const pending = String(currentPendingTemplateCategory || '').trim();
  if (!pending) return '';
  if (categoriesAreEquivalent(pending, oldCategory)) {
    return categoriesAreEquivalent(oldCategory, newCategory) ? String(newCategory || '').trim() : '';
  }
  if (categoriesAreEquivalent(pending, newCategory)) {
    return String(newCategory || '').trim();
  }
  return pending;
}

function validateProposalCategoryFields(proposal, customSpecMap) {
  const category = String(proposal?.projectCategory || '').trim();
  if (!category) return { ok: true };
  if (!categoryHasSpecializations(category, customSpecMap)) return { ok: true };
  const spec = String(proposal?.infrastructureSpecialization || '').trim();
  if (spec) return { ok: true };
  return {
    ok: false,
    error: `Απαιτείται εξειδίκευση για την κατηγορία «${resolveCategoryLabel(category)}»`,
  };
}

module.exports = {
  DEFAULT_PROJECT_CATEGORIES,
  resolveCategoryLabel,
  categoriesAreEquivalent,
  categoryHasSpecializations,
  getSpecializationsForCategory,
  reconcilePendingTemplateCategory,
  validateProposalCategoryFields,
};
