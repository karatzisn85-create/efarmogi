const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

const CONFIG_FILENAME = 'app-config.json';
const POINTER_FILENAME = 'data-dir.json';

let appInstance = null;
let activeDataDir = null;
let cachedConfig = null;

function getWorkspaceRoot(appInst) {
  const a = appInst || appInstance;
  return a && a.isPackaged
    ? path.resolve(process.resourcesPath, '..')
    : path.resolve(__dirname, '..');
}

/** Παλιές θέσεις app-config.json (μόνο για migration / καθαρισμό) */
function getLegacyConfigPaths(appInst) {
  const a = appInst || appInstance;
  if (!a) return [];
  const paths = new Set();
  paths.add(path.join(
    a.isPackaged
      ? path.resolve(process.resourcesPath, '..', '..', '..')
      : path.resolve(__dirname, '..'),
    CONFIG_FILENAME
  ));
  if (a.isPackaged) {
    paths.add(path.join(path.resolve(process.resourcesPath, '..'), CONFIG_FILENAME));
  }
  return [...paths];
}

function getBootstrapPointerPath() {
  if (!appInstance) return null;
  return path.join(appInstance.getPath('userData'), POINTER_FILENAME);
}

function readJsonFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Failed to read ${filePath}:`, e.message);
  }
  return null;
}

function getConfigPathForDir(dir) {
  return dir ? path.join(dir, CONFIG_FILENAME) : null;
}

function initConfigPath(appInst) {
  appInstance = appInst;
}

function setActiveDataDir(dir) {
  if (dir && dir !== activeDataDir) {
    activeDataDir = dir;
    cachedConfig = null;
  }
}

function writeDataDirPointer(dir) {
  const pointerPath = getBootstrapPointerPath();
  if (!pointerPath || !dir) return;
  try {
    fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
    safeWriteJSON(pointerPath, { dataDir: dir });
  } catch (e) {
    console.error('Failed to write data-dir pointer:', e.message);
  }
}

function readDataDirPointer() {
  const pointerPath = getBootstrapPointerPath();
  const data = readJsonFileSafe(pointerPath);
  if (data?.dataDir && fs.existsSync(data.dataDir)) return data.dataDir;
  return null;
}

function readLegacyConfig(appInst) {
  for (const p of getLegacyConfigPaths(appInst)) {
    const cfg = readJsonFileSafe(p);
    if (cfg && Object.keys(cfg).length > 0) return { path: p, config: cfg };
  }
  return null;
}

function cleanupLegacyConfigFiles(appInst) {
  for (const p of getLegacyConfigPaths(appInst)) {
    const toDelete = [p];
    for (let i = 1; i <= 3; i++) toDelete.push(`${p}.bak${i}`);
    for (const f of toDelete) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) { /* ignore */ }
    }
  }
}

function migrateLegacyConfig(appInst, dataDir) {
  if (!dataDir || !fs.existsSync(dataDir)) return;

  const newPath = getConfigPathForDir(dataDir);
  const existing = readJsonFileSafe(newPath);
  const legacy = readLegacyConfig(appInst);

  if (legacy) {
    if (!existing || Object.keys(existing).length === 0) {
      try {
        const migrated = { ...legacy.config, dataDir };
        safeWriteJSON(newPath, migrated);
        console.log('Migrated app-config.json to:', newPath);
      } catch (e) {
        console.error('app-config migration failed:', e.message);
        return;
      }
    }
    cleanupLegacyConfigFiles(appInst);
  }

  writeDataDirPointer(dataDir);
}

function getCandidateRoots(appInst) {
  const workspaceRoot = getWorkspaceRoot(appInst);
  const configuredRoot = process.env.EFARMOGI_ROOT && process.env.EFARMOGI_ROOT.trim()
    ? process.env.EFARMOGI_ROOT.trim()
    : null;
  return [configuredRoot, 'Z:\\EFARMOGI', 'K:\\EFARMOGI', workspaceRoot]
    .filter(Boolean)
    .filter((root, idx, arr) => arr.indexOf(root) === idx);
}

function hasAccess(p, mode) {
  try {
    fs.accessSync(p, mode);
    return true;
  } catch (_) {
    return false;
  }
}

function resolveDataDirFromConfigInFolder(folder) {
  const cfgPath = getConfigPathForDir(folder);
  if (!fs.existsSync(cfgPath)) return null;
  const cfg = readJsonFileSafe(cfgPath);
  if (cfg?.dataDir && fs.existsSync(cfg.dataDir)) return cfg.dataDir;
  if (fs.existsSync(folder)) return folder;
  return null;
}

function resolveDataDir(appInst) {
  const a = appInst || appInstance;

  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    const envDir = process.env.DATA_DIR.trim();
    if (fs.existsSync(envDir)) return envDir;
  }

  const pointerDir = readDataDirPointer();
  if (pointerDir) return pointerDir;

  const legacy = readLegacyConfig(a);
  if (legacy?.config?.dataDir && fs.existsSync(legacy.config.dataDir)) {
    return legacy.config.dataDir;
  }

  for (const root of getCandidateRoots(a)) {
    const dedomena = path.join(root, 'dedomena_ergon');
    const fromConfig = resolveDataDirFromConfigInFolder(dedomena);
    if (fromConfig) return fromConfig;
  }

  const candidates = getCandidateRoots(a)
    .map((root) => path.join(root, 'dedomena_ergon'))
    .filter((c) => fs.existsSync(c));

  const writable = candidates.filter((d) => hasAccess(d, fs.constants.W_OK));
  const readable = candidates.filter((d) => hasAccess(d, fs.constants.R_OK));
  if (writable.length > 0) return writable[0];
  if (readable.length > 0) return readable[0];

  const fallback = path.join(getWorkspaceRoot(a), 'dedomena_ergon');
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

function loadConfig(forceReload = false) {
  if (cachedConfig && !forceReload) return cachedConfig;

  const configPath = getConfigPathForDir(activeDataDir);
  if (configPath) {
    const cfg = readJsonFileSafe(configPath);
    if (cfg) {
      cachedConfig = cfg;
      return cachedConfig;
    }
  }

  cachedConfig = {};
  return cachedConfig;
}

function saveConfig(newFields) {
  if (!activeDataDir) {
    console.error('Cannot save app-config: activeDataDir not set');
    return;
  }
  const configPath = getConfigPathForDir(activeDataDir);
  const existing = loadConfig(true);
  cachedConfig = { ...existing, ...newFields, dataDir: activeDataDir };
  safeWriteJSON(configPath, cachedConfig);
  writeDataDirPointer(activeDataDir);
}

/** Εκκίνηση: εντοπίζει dataDir, μεταφέρει παλιό config, φορτώνει ρυθμίσεις */
function bootstrapConfig(appInst) {
  initConfigPath(appInst);
  const dir = resolveDataDir(appInst);
  if (dir) {
    setActiveDataDir(dir);
    migrateLegacyConfig(appInst, dir);
    loadConfig();
  }
  return dir;
}

module.exports = {
  initConfigPath,
  setActiveDataDir,
  loadConfig,
  saveConfig,
  resolveDataDir,
  bootstrapConfig,
  migrateLegacyConfig,
  getConfigPathForDir,
  writeDataDirPointer,
};
