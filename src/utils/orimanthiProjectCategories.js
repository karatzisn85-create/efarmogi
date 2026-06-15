/** Κατηγορίες έργου Ωρίμανσης & εξειδικεύσεις ανά κατηγορία */

export const CATEGORY_HYDRAULICS = 'ΥΔΡΑΥΛΙΚΑ';

export const DEFAULT_PROJECT_CATEGORIES = [
  CATEGORY_HYDRAULICS,
  'ΓΕΩΤΡΗΣΕΙΣ',
  'ΚΤΙΡΙΑΚΑ',
  'ΟΔΟΠΟΙΙΑ',
  'ΑΝΑΠΛΑΣΕΙΣ ΟΙΚΙΣΜΩΝ',
  'Ε.Ε.Λ.',
  'ΑΠΟΡΡΙΜΑΤΑ',
  'ΕΝΕΡΓΕΙΑΚΑ',
  'ΡΕΜΑΤΑ',
  'ΓΕΩΛΟΓΙΚΕΣ - ΓΕΩΤΕΧΝΙΚΕΣ',
  'ΓΕΩΡΓΙΚΑ - ΦΥΤΟΤΕΧΝΙΚΕΣ',
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΕΣ',
  'ΠΟΛΙΤΙΣΤΙΚΑ',
];

export const DEFAULT_CATEGORY_SPECIALIZATIONS = {
  [CATEGORY_HYDRAULICS]: ['ΥΔΡΕΥΣΗ', 'ΑΠΟΧΕΤΕΥΣΗ', 'ΥΠΟΔΟΜΕΣ'],
};

export const LS_CUSTOM_CATEGORIES = 'orimanthiCustomProjectCategories';
export const LS_CUSTOM_CATEGORY_SPECS = 'orimanthiCustomCategorySpecializations';
/** Legacy — μεταφέρεται αυτόματα στο ΥΔΡΑΥΛΙΚΑ */
export const LS_LEGACY_INFRA_SPECS = 'orimanthiCustomInfraSpecializations';

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

function mergeUniqueLists(defaults, custom) {
  const merged = [...(defaults || [])];
  (custom || []).forEach((item) => {
    const label = String(item || '').trim();
    if (!label) return;
    if (!merged.some((x) => normKey(x) === normKey(label))) merged.push(label);
  });
  return merged;
}

export function loadCustomCategoriesList() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_CATEGORIES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveCustomCategoriesList(fullList) {
  const custom = (fullList || []).filter(
    (item) => !DEFAULT_PROJECT_CATEGORIES.some((d) => normKey(d) === normKey(item))
  );
  localStorage.setItem(LS_CUSTOM_CATEGORIES, JSON.stringify(custom));
}

export function getMergedProjectCategories(customList) {
  return mergeUniqueLists(DEFAULT_PROJECT_CATEGORIES, customList);
}

export function getCustomProjectCategoriesOnly(fullList) {
  return (fullList || []).filter(
    (item) => !DEFAULT_PROJECT_CATEGORIES.some((d) => normKey(d) === normKey(item))
  );
}

export function isDefaultProjectCategory(label) {
  return DEFAULT_PROJECT_CATEGORIES.some((d) => normKey(d) === normKey(label));
}

function migrateLegacyInfraSpecs(stored) {
  try {
    const legacyRaw = localStorage.getItem(LS_LEGACY_INFRA_SPECS);
    if (!legacyRaw) return stored;
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy) || !legacy.length) {
      localStorage.removeItem(LS_LEGACY_INFRA_SPECS);
      return stored;
    }
    const next = { ...stored };
    const hydKey = normKey(CATEGORY_HYDRAULICS);
    const existing = next[hydKey] || next[CATEGORY_HYDRAULICS] || [];
    next[CATEGORY_HYDRAULICS] = mergeUniqueLists(existing, legacy);
    localStorage.setItem(LS_CUSTOM_CATEGORY_SPECS, JSON.stringify(next));
    localStorage.removeItem(LS_LEGACY_INFRA_SPECS);
    return next;
  } catch {
    return stored;
  }
}

export function loadCustomCategorySpecializations() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_CATEGORY_SPECS);
    let parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    parsed = migrateLegacyInfraSpecs(parsed);
    const normalized = {};
    Object.entries(parsed).forEach(([cat, specs]) => {
      const label = String(cat || '').trim();
      if (!label) return;
      normalized[label] = Array.isArray(specs)
        ? specs.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
    });
    return normalized;
  } catch {
    return {};
  }
}

export function saveCustomCategorySpecializations(map) {
  const out = {};
  Object.entries(map || {}).forEach(([cat, specs]) => {
    const label = String(cat || '').trim();
    if (!label) return;
    const defaults = DEFAULT_CATEGORY_SPECIALIZATIONS[label] || [];
    const customOnly = (specs || []).filter(
      (item) => !defaults.some((d) => normKey(d) === normKey(item))
    );
    if (customOnly.length) out[label] = customOnly;
  });
  localStorage.setItem(LS_CUSTOM_CATEGORY_SPECS, JSON.stringify(out));
}

export function resolveCategoryLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  const alias = LEGACY_CATEGORY_ALIASES[normKey(text)];
  if (alias === null) return text;
  if (alias) return alias;
  return text;
}

export function getDefaultSpecializationsForCategory(category) {
  const resolved = resolveCategoryLabel(category);
  return DEFAULT_CATEGORY_SPECIALIZATIONS[resolved] || [];
}

export function getSpecializationsForCategory(category, customSpecMap) {
  const resolved = resolveCategoryLabel(category);
  if (!resolved) return [];
  const defaults = getDefaultSpecializationsForCategory(resolved);
  const custom = (customSpecMap && customSpecMap[resolved]) || [];
  return mergeUniqueLists(defaults, custom);
}

export function categoryHasSpecializations(category, customSpecMap) {
  return getSpecializationsForCategory(category, customSpecMap).length > 0;
}

export function isDefaultCategorySpecialization(category, spec) {
  const resolved = resolveCategoryLabel(category);
  const defaults = DEFAULT_CATEGORY_SPECIALIZATIONS[resolved] || [];
  return defaults.some((d) => normKey(d) === normKey(spec));
}

export function getCustomSpecsForCategory(category, customSpecMap) {
  const resolved = resolveCategoryLabel(category);
  if (!resolved) return [];
  const defaults = getDefaultSpecializationsForCategory(resolved);
  const all = getSpecializationsForCategory(resolved, customSpecMap);
  return all.filter((item) => !defaults.some((d) => normKey(d) === normKey(item)));
}

export function getCategoriesWithCustomSpecs(customSpecMap) {
  return Object.keys(customSpecMap || {}).filter(
    (cat) => getCustomSpecsForCategory(cat, customSpecMap).length > 0
  );
}

export function categoriesAreEquivalent(a, b) {
  const ra = resolveCategoryLabel(a);
  const rb = resolveCategoryLabel(b);
  if (!ra || !rb) return normKey(a) === normKey(b);
  return normKey(ra) === normKey(rb);
}

export function reconcilePendingTemplateCategory(oldCategory, newCategory, currentPendingTemplateCategory) {
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

export function validateProposalCategoryFields(proposal, customSpecMap) {
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

export function shouldShowSpecializationField(category, customSpecMap, { currentSpec, forceVisible } = {}) {
  if (forceVisible) return true;
  if (String(currentSpec || '').trim()) return true;
  return categoryHasSpecializations(category, customSpecMap);
}
