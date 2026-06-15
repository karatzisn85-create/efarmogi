/**
 * Δημοτικές ενότητες δήμου — ρύθμιση από SUPERADMIN.
 * Αποθήκευση: {dataDir}/config/municipal-units.json
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'municipal-units.json';

function defaultConfig() {
  return {
    units: [],
    updatedAt: null,
  };
}

function getConfigPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, CONFIG_FILE);
}

function normalizeUnits(units) {
  const seen = new Set();
  const result = [];
  for (const item of units || []) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  result.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));
  return result;
}

function loadMunicipalUnitsConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      units: normalizeUnits(raw.units),
      updatedAt: raw.updatedAt || null,
    };
  } catch {
    return defaultConfig();
  }
}

function saveMunicipalUnitsConfig(dataDir, units) {
  const dir = path.join(dataDir, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const config = {
    units: normalizeUnits(units),
    updatedAt: new Date().toISOString(),
  };
  safeWriteJSON(getConfigPath(dataDir), config);
  return config;
}

module.exports = {
  defaultConfig,
  loadMunicipalUnitsConfig,
  saveMunicipalUnitsConfig,
  normalizeUnits,
};
