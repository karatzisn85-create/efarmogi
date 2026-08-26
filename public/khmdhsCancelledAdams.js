/**
 * Επιβεβαιωμένα ακυρωμένοι κρίκοι ΚΗΜΔΗΣ (όχι αποτυχία κατεβάσματος).
 */

function normalizeCancelledAdam(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
  return /^(\d{2})[A-Z]{3,4}\d{9}$/.test(t) ? t : '';
}

function addCancelledAdam(set, raw) {
  const adam = normalizeCancelledAdam(raw);
  if (adam) set.add(adam);
}

/**
 * @param {{
 *   skippedCancelled?: Array<{ adam?: string, original?: string }>,
 *   extraAdams?: string[],
 * }} [input]
 * @returns {string[]}
 */
function collectConfirmedCancelledAdams(input = {}) {
  const set = new Set();
  (input.skippedCancelled || []).forEach((s) => {
    addCancelledAdam(set, s?.adam);
    addCancelledAdam(set, s?.original);
  });
  (input.extraAdams || []).forEach((a) => addCancelledAdam(set, a));
  return [...set];
}

module.exports = {
  normalizeCancelledAdam,
  collectConfirmedCancelledAdams,
};
