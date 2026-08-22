/**
 * Υπολογισμός ποσών ένταξης / τροποποιήσεων.
 *
 * Κανόνας: όταν μια τροποποίηση έχει changeAmount + ποσό, το ποσό είναι το
 * ΝΕΟ ΑΠΟΛΥΤΟ σύνολο της ένταξης (όχι μεταβολή προς πρόσθεση).
 * Διαδοχικές τέτοιες τροποποιήσεις αντικαθιστούν η μία την άλλη.
 */

import { parseGreekAmountString } from './khmdhsFields';
import entaxiCatalog from '../../app/core/entaxiCatalog';

export const getEntaxiCurrentTotal = entaxiCatalog.getEntaxiCurrentTotal;
export const formatEntaxiAmount = entaxiCatalog.formatEntaxiAmount;

/**
 * Στοιχεία εμφάνισης ποσού για μία τροποποίηση στη ροή.
 * @returns {{ kind: 'none' } | { kind: 'absolute', newTotal: number, delta: number, previousTotal: number }}
 */
export function getModificationAmountFlowEntry(entaxi, modIndex) {
  const mods = Array.isArray(entaxi?.modifications) ? entaxi.modifications : [];
  const mod = mods[modIndex];
  if (!mod || !mod.changeAmount || mod.amount == null || String(mod.amount).trim() === '') {
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
