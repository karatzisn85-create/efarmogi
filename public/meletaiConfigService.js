/**
 * Ρυθμίσεις κατηγοριών μελετών.
 * Αποθήκευση: {dataDir}/config/meletai-config.json
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'meletai-config.json';

const DEFAULT_STUDY_CATEGORIES = [
  'Τοπογραφική',
  'Γεωτεχνική',
  'Περιβαλλοντική',
  'Στατική',
  'Η/Μ',
  'Οδοποιία',
  'Αρχιτεκτονική',
  'Διάφορα',
];

function defaultConfig() {
  return {
    studyCategories: [...DEFAULT_STUDY_CATEGORIES],
    removedDefaults: [],
  };
}

function getConfigPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, CONFIG_FILE);
}

function loadMeletaiConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const removedDefaults = Array.isArray(raw.removedDefaults)
      ? raw.removedDefaults.map((c) => String(c || '').trim()).filter(Boolean)
      : [];
    const merged = DEFAULT_STUDY_CATEGORIES.filter((c) => !removedDefaults.includes(c));
    const saved = Array.isArray(raw.studyCategories) ? raw.studyCategories : [];
    saved.forEach((c) => {
      const t = String(c || '').trim();
      if (t && !merged.includes(t) && !removedDefaults.includes(t)) merged.push(t);
    });
    return { studyCategories: merged, removedDefaults };
  } catch {
    return defaultConfig();
  }
}

function saveMeletaiConfig(dataDir, config) {
  const base = defaultConfig();
  const categories = Array.isArray(config?.studyCategories)
    ? config.studyCategories.map((c) => String(c || '').trim()).filter(Boolean)
    : base.studyCategories;
  const unique = [];
  categories.forEach((c) => {
    if (!unique.includes(c)) unique.push(c);
  });
  const removedDefaults = Array.isArray(config?.removedDefaults)
    ? config.removedDefaults.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  const toSave = {
    studyCategories: unique.length ? unique : base.studyCategories,
    removedDefaults,
  };
  safeWriteJSON(getConfigPath(dataDir), toSave);
  return toSave;
}

function addStudyCategory(dataDir, label) {
  const config = loadMeletaiConfig(dataDir);
  const trimmed = String(label || '').trim();
  if (!trimmed) return { success: false, error: 'Κενή κατηγορία' };
  if (config.studyCategories.includes(trimmed)) {
    return { success: false, error: 'Η κατηγορία υπάρχει ήδη' };
  }
  config.studyCategories.push(trimmed);
  if (DEFAULT_STUDY_CATEGORIES.includes(trimmed)) {
    config.removedDefaults = (config.removedDefaults || []).filter((c) => c !== trimmed);
  }
  const saved = saveMeletaiConfig(dataDir, config);
  return { success: true, config: saved };
}

function removeStudyCategory(dataDir, label) {
  const config = loadMeletaiConfig(dataDir);
  const trimmed = String(label || '').trim();
  config.studyCategories = config.studyCategories.filter((c) => c !== trimmed);
  if (DEFAULT_STUDY_CATEGORIES.includes(trimmed)) {
    const removed = new Set([...(config.removedDefaults || []), trimmed]);
    config.removedDefaults = [...removed];
  }
  if (!config.studyCategories.length) {
    config.studyCategories = [...DEFAULT_STUDY_CATEGORIES].filter(
      (c) => !(config.removedDefaults || []).includes(c)
    );
    if (!config.studyCategories.length) {
      config.studyCategories = [...DEFAULT_STUDY_CATEGORIES];
      config.removedDefaults = [];
    }
  }
  const saved = saveMeletaiConfig(dataDir, config);
  return { success: true, config: saved };
}

module.exports = {
  DEFAULT_STUDY_CATEGORIES,
  loadMeletaiConfig,
  saveMeletaiConfig,
  addStudyCategory,
  removeStudyCategory,
};
