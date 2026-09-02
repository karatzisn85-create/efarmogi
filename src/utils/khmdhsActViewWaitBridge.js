/**
 * Γέφυρα χωρίς React: η προβολή εγγράφου ΚΗΜΔΗΣ δείχνει/κρύβει την κάρτα αναμονής.
 */

let listener = null;
let depth = 0;
let generation = 0;
let current = { active: false, label: '', adam: '', generation: 0 };

export function subscribeKhmdhsActViewWait(fn) {
  listener = typeof fn === 'function' ? fn : null;
  if (listener) listener(current);
  return () => {
    if (listener === fn) listener = null;
  };
}

export function beginKhmdhsActViewWait({ label = '', adam = '' } = {}) {
  if (depth === 0) generation += 1;
  depth += 1;
  current = {
    active: true,
    label: String(label || '').trim(),
    adam: String(adam || '').trim(),
    generation,
  };
  listener?.(current);
  return generation;
}

export function endKhmdhsActViewWait() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) {
    current = { active: false, label: '', adam: '', generation };
    listener?.(current);
  }
}

/** Κλείνει την κάρτα αναμονής αμέσως — η λήψη ακυρώνεται χωριστά. */
export function cancelKhmdhsActViewWait() {
  generation += 1;
  depth = 0;
  current = { active: false, label: '', adam: '', generation };
  listener?.(current);
}

export function isKhmdhsActViewWaitGeneration(gen) {
  return Number(gen) === generation;
}

export function peekKhmdhsActViewWait() {
  return current;
}

export function resetKhmdhsActViewWaitForTests() {
  depth = 0;
  generation = 0;
  current = { active: false, label: '', adam: '', generation: 0 };
  listener?.(current);
}
