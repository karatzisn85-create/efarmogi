const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

let configPath = null;
let cachedConfig = null;

function initConfigPath(appInstance) {
  const workspaceRoot = appInstance.isPackaged
    ? path.resolve(process.resourcesPath, '..', '..', '..')
    : path.resolve(__dirname, '..');
  configPath = path.join(workspaceRoot, 'app-config.json');
}

function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(configPath)) {
      cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return cachedConfig;
    }
  } catch (e) {
    console.error('Failed to load app-config.json:', e.message);
  }
  return {};
}

function saveConfig(newFields) {
  const existing = loadConfig();
  cachedConfig = { ...existing, ...newFields };
  safeWriteJSON(configPath, cachedConfig);
}

function resolveDataDir(appInstance) {
  const config = loadConfig();

  if (config.dataDir && fs.existsSync(config.dataDir)) {
    return config.dataDir;
  }

  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return process.env.DATA_DIR.trim();
  }

  const workspaceRoot = appInstance.isPackaged
    ? path.resolve(process.resourcesPath, '..', '..', '..')
    : path.resolve(__dirname, '..');

  const configuredRoot = process.env.EFARMOGI_ROOT && process.env.EFARMOGI_ROOT.trim()
    ? process.env.EFARMOGI_ROOT.trim()
    : null;

  const candidateRoots = [configuredRoot, 'Z:\\EFARMOGI', 'K:\\EFARMOGI', workspaceRoot]
    .filter(Boolean)
    .filter((root, idx, arr) => arr.indexOf(root) === idx);

  const hasAccess = (p, mode) => {
    try { fs.accessSync(p, mode); return true; } catch (_) { return false; }
  };

  const candidates = candidateRoots
    .map(root => path.join(root, 'dedomena_ergon'))
    .filter(c => fs.existsSync(c));

  const readable = candidates.filter(d => hasAccess(d, fs.constants.R_OK));
  const writable = readable.filter(d => hasAccess(d, fs.constants.W_OK));

  if (writable.length > 0) return writable[0];
  if (readable.length > 0) return readable[0];

  const fallback = path.join(workspaceRoot, 'dedomena_ergon');
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

module.exports = { initConfigPath, loadConfig, saveConfig, resolveDataDir };
