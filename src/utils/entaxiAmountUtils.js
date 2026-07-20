/**
 * Υπολογισμός ποσών ένταξης / τροποποιήσεων.
 *
 * Κανόνας: όταν μια τροποποίηση έχει changeAmount + ποσό, το ποσό είναι το
 * ΝΕΟ ΑΠΟΛΥΤΟ σύνολο της ένταξης (όχι μεταβολή προς πρόσθεση).
 * Διαδοχικές τέτοιες τροποποιήσεις αντικαθιστούν η μία την άλλη.
 */

import { parseGreekAmountString } from './khmdhsFields';

export function formatEntaxiAmount(value) {
  const n = typeof value === 'number' ? value : parseGreekAmountString(value);
  if (!Number.isFinite(n)) {
    return '0,00';
  }
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function modificationChangesAmount(mod) {
  if (!mod || !mod.changeAmount) return false;
  const raw = mod.amount;
  if (raw == null || String(raw).trim() === '') return false;
  return true;
}

/**
 * Τρέχον σύνολο ένταξης μετά από όλες (ή μέρος) των τροποποιήσεων.
 *
 * @param {object} entaxi
 * @param {object} [options]
 * @param {string} [options.beforeModificationId] — αγνόησε αυτή και όλες τις επόμενες
 * @param {number} [options.upToIndexInclusive] — μέχρι και αυτό το index (0-based)
 */
export function getEntaxiCurrentTotal(entaxi, options = {}) {
  if (!entaxi) return 0;

  let total = parseGreekAmountString(entaxi.initialAmount);
  const mods = Array.isArray(entaxi.modifications) ? entaxi.modifications : [];
  const { beforeModificationId, upToIndexInclusive } = options;

  let stopAtExclusive = mods.length;
  if (beforeModificationId) {
    const idx = mods.findIndex((m) => m && m.modificationId === beforeModificationId);
    if (idx >= 0) stopAtExclusive = idx;
  } else if (typeof upToIndexInclusive === 'number' && Number.isFinite(upToIndexInclusive)) {
    stopAtExclusive = Math.min(mods.length, upToIndexInclusive + 1);
  }

  for (let i = 0; i < stopAtExclusive; i += 1) {
    const mod = mods[i];
    if (modificationChangesAmount(mod)) {
      total = parseGreekAmountString(mod.amount);
    }
  }

  return total;
}

/**
 * Στοιχεία εμφάνισης ποσού για μία τροποποίηση στη ροή.
 * @returns {{ kind: 'none' } | { kind: 'absolute', newTotal: number, delta: number, previousTotal: number }}
 */
export function getModificationAmountFlowEntry(entaxi, modIndex) {
  const mods = Array.isArray(entaxi?.modifications) ? entaxi.modifications : [];
  const mod = mods[modIndex];
  if (!modificationChangesAmount(mod)) {
    return { kind: 'none' };
  }

  const previousTotal = getEntaxiCurrentTotal(entaxi, { upToIndexInclusive: modIndex - 1 });
  const newTotal = parseGreekAmountString(mod.amount);
  return {
    kind: 'absolute',
    newTotal,
    previousTotal,
    delta: newTotal - previousTotal
  };
}

export function formatEntaxiAmountDelta(delta) {
  const n = Number(delta) || 0;
  const formatted = Math.abs(n).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted}`;
  return formatted;
}
