/**
 * Ρυθμίσεις & πρότυπα εκκρεμοτήτων για Ωρίμανση Έργων.
 * Αποθήκευση: {dataDir}/config/orimanthi-config.json
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const catHelper = require('./orimanthiProjectCategoriesHelper');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'orimanthi-config.json';

const GENERIC_PENDING = [
  'Συλλογή απαιτούμενων μελετών',
  'Αδειοδοτήσεις',
  'ΑΕΠΟ',
  'Τεύχος δημοπράτησης',
];

const DEFAULT_PENDING_TEMPLATES = {
  'ΟΔΟΠΟΙΙΑ': [
    'Αρχαιολογική έγκριση',
    'Περιβαλλοντική έγκριση',
    'Τοπογραφικό διάγραμμα',
    'Γεωτεχνική μελέτη',
    'Στατική μελέτη',
    'Η/Μ μελέτη',
    'Ανανέωση / έκδοση ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΑΝΑΠΛΑΣΕΙΣ ΟΙΚΙΣΜΩΝ': [
    'Αρχαιολογική έγκριση',
    'Περιβαλλοντική έγκριση',
    'Μελέτη αναπλάσεως',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΚΤΙΡΙΑΚΑ': [
    'Στατική μελέτη',
    'Η/Μ μελέτη',
    'Πυρασφάλεια',
    'Προσβασιμότητα ΑμΕΑ',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΥΔΡΑΥΛΙΚΑ': [
    'Μελέτη υδραυλικών',
    'Τοπογραφικό',
    'Γεωτεχνική μελέτη',
    'Περιβαλλοντική έγκριση',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΠΕΡΙΒΑΛΛΟΝΤΙΚΕΣ': [...GENERIC_PENDING],
  'ΓΕΩΤΡΗΣΕΙΣ': [
    'Άδεια γεώτρησης',
    'Γεωλογική αναφορά',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'Ε.Ε.Λ.': [
    'Μελέτη Ε.Ε.Λ.',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΑΠΟΡΡΙΜΑΤΑ': [
    'Μελέτη διαχείρισης απορριμμάτων',
    'Περιβαλλοντική έγκριση',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΕΝΕΡΓΕΙΑΚΑ': [
    'Ενεργειακή μελέτη',
    'Η/Μ μελέτη',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΡΕΜΑΤΑ': [
    'Υδρολογική μελέτη',
    'Τοπογραφικό',
    'Περιβαλλοντική έγκριση',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΓΕΩΛΟΓΙΚΕΣ - ΓΕΩΤΕΧΝΙΚΕΣ': [
    'Γεωλογική αναφορά',
    'Γεωτεχνική μελέτη',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΓΕΩΡΓΙΚΑ - ΦΥΤΟΤΕΧΝΙΚΕΣ': [
    'Φυτοτεχνική μελέτη',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'ΠΟΛΙΤΙΣΤΙΚΑ': [
    'Αρχαιολογική έγκριση',
    'Μελέτη αποκατάστασης',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  // Legacy aliases (παλιά ονόματα κατηγοριών)
  'Οδοποιία': [
    'Αρχαιολογική έγκριση',
    'Περιβαλλοντική έγκριση',
    'Τοπογραφικό διάγραμμα',
    'Γεωτεχνική μελέτη',
    'Στατική μελέτη',
    'Η/Μ μελέτη',
    'Ανανέωση / έκδοση ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'Αναπλάσεις οικισμών': [
    'Αρχαιολογική έγκριση',
    'Περιβαλλοντική έγκριση',
    'Μελέτη αναπλάσεως',
    'Τοπογραφικό',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'Κτιριακά': [
    'Στατική μελέτη',
    'Η/Μ μελέτη',
    'Πυρασφάλεια',
    'Προσβασιμότητα ΑμΕΑ',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'Έργα υποδομής': [
    'Μελέτη υδραυλικών',
    'Τοπογραφικό',
    'Γεωτεχνική μελέτη',
    'Περιβαλλοντική έγκριση',
    'ΑΕΠΟ',
    'Τεύχος δημοπράτησης',
  ],
  'Διάφορα': [...GENERIC_PENDING],
};

function defaultConfig() {
  return {
    pendingTemplates: { ...DEFAULT_PENDING_TEMPLATES },
    customProjectCategories: [],
    customCategorySpecializations: {},
    aepoReminders: {
      enabled: true,
      daysBefore: [30, 60, 90],
      recipientEmails: [],
      useAdminEmails: true,
    },
  };
}

function normalizeCustomCategorySpecializations(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([cat, specs]) => {
    const label = String(cat || '').trim();
    if (!label) return;
    out[label] = Array.isArray(specs)
      ? specs.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
  });
  return out;
}

function getConfigPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, CONFIG_FILE);
}

function loadOrimanthiConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const base = defaultConfig();
    return {
      pendingTemplates: { ...base.pendingTemplates, ...(raw.pendingTemplates || {}) },
      customProjectCategories: Array.isArray(raw.customProjectCategories)
        ? raw.customProjectCategories.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
      customCategorySpecializations: normalizeCustomCategorySpecializations(raw.customCategorySpecializations),
      aepoReminders: { ...base.aepoReminders, ...(raw.aepoReminders || {}) },
    };
  } catch {
    return defaultConfig();
  }
}

function saveOrimanthiConfig(dataDir, config) {
  const dir = path.join(dataDir, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(getConfigPath(dataDir), config);
}

function findTemplateKeyForCategory(templates, category) {
  const cat = String(category || '').trim();
  if (!cat) return null;
  if (Array.isArray(templates[cat])) return cat;
  const resolved = catHelper.resolveCategoryLabel(cat);
  if (resolved !== cat && Array.isArray(templates[resolved])) return resolved;
  for (const key of Object.keys(templates)) {
    if (catHelper.categoriesAreEquivalent(key, cat)) return key;
  }
  return null;
}

function getPendingTemplateForCategory(config, category) {
  const templates = config?.pendingTemplates || DEFAULT_PENDING_TEMPLATES;
  const key = findTemplateKeyForCategory(templates, category);
  return key ? templates[key] : [];
}

function mergePendingTemplateItems(existingItems, templateTexts, category) {
  const existingTexts = new Set(
    (existingItems || []).map((i) => String(i.text || '').trim().toLowerCase()).filter(Boolean)
  );
  const now = new Date().toISOString();
  const { v4: uuidv4 } = require('uuid');
  const cat = String(category || '').trim();
  const added = [];
  for (const text of templateTexts || []) {
    const t = String(text || '').trim();
    if (!t || existingTexts.has(t.toLowerCase())) continue;
    existingTexts.add(t.toLowerCase());
    added.push({
      id: uuidv4(),
      text: t,
      done: false,
      createdAt: now,
      fromTemplate: true,
      templateCategory: cat,
    });
  }
  return [...(existingItems || []), ...added];
}

function buildTemplateTextSet(templateTexts) {
  return new Set(
    (templateTexts || []).map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
  );
}

function reTagExistingTemplateItems(existingItems, category, templateTexts) {
  const cat = String(category || '').trim();
  const templateTextsSet = buildTemplateTextSet(templateTexts);
  return (existingItems || []).map((item) => {
    const text = String(item.text || '').trim().toLowerCase();
    if (item.fromTemplate === true) return item;
    if (templateTextsSet.has(text)) {
      return { ...item, fromTemplate: true, templateCategory: cat };
    }
    return item;
  });
}

function removePendingTemplateItems(existingItems, category) {
  const cat = String(category || '').trim();
  return (existingItems || []).filter(
    (item) => !(item.fromTemplate === true && catHelper.categoriesAreEquivalent(item.templateCategory, cat))
  );
}

function countTemplateItemsPresent(items, category, templateTexts) {
  const cat = String(category || '').trim();
  const templateTextsSet = buildTemplateTextSet(templateTexts);
  if (!templateTextsSet.size) return 0;
  let count = 0;
  for (const item of items || []) {
    const text = String(item.text || '').trim().toLowerCase();
    if (!templateTextsSet.has(text)) continue;
    if (item.fromTemplate === true && catHelper.categoriesAreEquivalent(item.templateCategory, cat)) {
      count += 1;
      continue;
    }
    if (!item.fromTemplate) count += 1;
  }
  return count;
}

function isPendingTemplateApplied(proposal, category, templateTexts) {
  if (!proposal || !category) return false;
  if (catHelper.categoriesAreEquivalent(proposal.pendingTemplateCategory, category)) return true;
  const templateTextsSet = buildTemplateTextSet(templateTexts);
  if (!templateTextsSet.size) return false;
  const present = countTemplateItemsPresent(proposal.pendingItems, category, templateTexts);
  return present >= templateTextsSet.size;
}

module.exports = {
  DEFAULT_PENDING_TEMPLATES,
  defaultConfig,
  loadOrimanthiConfig,
  saveOrimanthiConfig,
  getPendingTemplateForCategory,
  mergePendingTemplateItems,
  removePendingTemplateItems,
  reTagExistingTemplateItems,
  isPendingTemplateApplied,
  countTemplateItemsPresent,
};
