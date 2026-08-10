/**
 * Πρόταση κατηγορίας απολογισμού από ειδικό στόχο Επιχειρησιακού Προγράμματος.
 */

const OBJECTIVE_TO_CATEGORY = Object.freeze({
  '1.1.1': 'environment',
  '1.1.2': 'environment',
  '1.2.1': 'regeneration',
  '1.2.2': 'regeneration',
  '1.3.1': 'roads',
  '1.3.2': 'mobility',
  '1.3.3': 'water',
  '1.3.4': 'other',
  '1.3.5': 'waste',
  '1.3.6': 'sewerage',
  '1.3.7': 'waste',
  '1.4.1': 'other',
  '1.4.2': 'other',
  '1.4.3': 'mobility',
  '1.5.1': 'other',
  '1.5.2': 'other',
  '2.1.1': 'buildings',
  '2.2.1': 'buildings',
  '2.3.1': 'buildings',
  '2.3.2': 'buildings',
  '2.4.1': 'buildings',
  '2.4.2': 'buildings',
});

function extractObjectiveCode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : '';
}

/**
 * @param {string} objectiveCodeOrTitle
 * @returns {string|null} categoryId
 */
function suggestCategoryFromObjective(objectiveCodeOrTitle) {
  const code = extractObjectiveCode(objectiveCodeOrTitle);
  if (!code) return null;
  return OBJECTIVE_TO_CATEGORY[code] || null;
}

/**
 * Από δράσεις ΕΠ συνδεδεμένες με υποέργο.
 * @param {Array<{ objectiveCode?: string, objective?: string }>} epActions
 */
function suggestCategoryFromEpActions(epActions) {
  const list = Array.isArray(epActions) ? epActions : [];
  for (const action of list) {
    const suggested =
      suggestCategoryFromObjective(action?.objectiveCode) ||
      suggestCategoryFromObjective(action?.objective);
    if (suggested) return suggested;
  }
  return null;
}

module.exports = {
  OBJECTIVE_TO_CATEGORY,
  extractObjectiveCode,
  suggestCategoryFromObjective,
  suggestCategoryFromEpActions,
};
