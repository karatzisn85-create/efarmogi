/**
 * Ισχύουσα προθεσμία υποβολής πρόσκλησης (με τροποποιήσεις).
 * Κοινό helper για main process (ημερολόγιο / υπενθυμίσεις).
 */
const prosklisiCatalogCore = require('../app/core/prosklisiCatalog');

function parseProsklisiDeadline(dateString) {
  return prosklisiCatalogCore.parseProsklisiDeadline(dateString);
}

function getEffectiveProsklisiDeadline(prosklisi, modifications = []) {
  return prosklisiCatalogCore.getEffectiveProsklisiDeadline(prosklisi, modifications);
}

function loadProsklisiModificationsFromDir(prosklisiDir) {
  try {
    const fs = require('fs');
    const path = require('path');
    const modificationsPath = path.join(prosklisiDir, 'modifications.json');
    if (!fs.existsSync(modificationsPath)) return [];
    const data = JSON.parse(fs.readFileSync(modificationsPath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function applyEffectiveDeadlineToProsklisi(prosklisi, prosklisiDir, { persist = false, includeModifications = false } = {}) {
  if (!prosklisi || typeof prosklisi !== 'object') return prosklisi;
  const mods = loadProsklisiModificationsFromDir(prosklisiDir);
  const effective = getEffectiveProsklisiDeadline(prosklisi, mods);
  let viewed = prosklisi;
  if (effective && String(effective) !== String(prosklisi.deadline || '')) {
    viewed = {
      ...prosklisi,
      deadline: effective,
      updatedAt: prosklisi.updatedAt || new Date().toISOString(),
    };
    if (persist && prosklisiDir) {
      try {
        const fs = require('fs');
        const path = require('path');
        const { safeWriteJSON } = require('./safeWrite');
        const dataFilePath = path.join(prosklisiDir, 'data.json');
        if (fs.existsSync(dataFilePath)) {
          safeWriteJSON(dataFilePath, viewed);
        }
      } catch {
        // Η οθόνη εξακολουθεί να βλέπει την ισχύουσα τιμή ακόμα κι αν αποτύχει το γράψιμο
      }
    }
  }
  if (includeModifications) {
    return { ...viewed, modifications: mods };
  }
  return viewed;
}

module.exports = {
  parseProsklisiDeadline,
  getEffectiveProsklisiDeadline,
  applyEffectiveDeadlineToProsklisi,
  loadProsklisiModificationsFromDir,
};
