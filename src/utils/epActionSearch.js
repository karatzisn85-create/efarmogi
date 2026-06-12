/** Κανονικοποίηση ελληνικού κειμένου για αναζήτηση. */
export function normalizeSearchText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Χωρισμός σε λέξεις-κλειδιά (απορρίπτει πολύ μικρές). */
export function tokenizeSearchText(text, minLen = 3) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(w => w.length >= minLen);
}

/**
 * Βαθμολογεί αντιστοιχία δράσης ΕΠ με τίτλο υποέργου και/ή query αναζήτησης.
 * Υψηλότερος βαθμός = καλύτερη αντιστοιχία.
 */
export function scoreEpActionMatch(subprojectTitle, action, searchQuery = '') {
  const actionTitle = normalizeSearchText(action?.title);
  if (!actionTitle) return 0;

  const subNorm = normalizeSearchText(subprojectTitle);
  const queryNorm = normalizeSearchText(searchQuery);
  let score = 0;

  if (queryNorm) {
    if (actionTitle === queryNorm) score += 200;
    else if (actionTitle.includes(queryNorm)) score += 120;
    else if (queryNorm.includes(actionTitle) && actionTitle.length > 8) score += 90;

    for (const token of tokenizeSearchText(searchQuery, 2)) {
      if (actionTitle.includes(token)) score += 18;
    }
  }

  if (subNorm) {
    if (actionTitle === subNorm) score += 150;
    else if (actionTitle.includes(subNorm)) score += 100;
    else if (subNorm.includes(actionTitle) && actionTitle.length > 8) score += 70;

    for (const token of tokenizeSearchText(subprojectTitle)) {
      if (actionTitle.includes(token)) score += 14;
    }
  }

  // Bonus για κωδικούς ιεραρχίας
  const codeQuery = (searchQuery || '').trim();
  if (codeQuery) {
    const codes = [action?.axisCode, action?.measureCode, action?.objectiveCode].filter(Boolean);
    if (codes.some(c => String(c).includes(codeQuery))) score += 25;
  }

  return score;
}

/** Ετικέτα ποιότητας αντιστοιχίας. */
export function getMatchLabel(score) {
  if (score >= 80) return { text: 'Υψηλή αντιστοιχία', variant: 'high' };
  if (score >= 30) return { text: 'Καλή αντιστοιχία', variant: 'good' };
  if (score >= 12) return { text: 'Μερική αντιστοιχία', variant: 'partial' };
  return null;
}

/**
 * Φιλτράρει και ταξινομεί δράσεις ΕΠ για picker σύνδεσης.
 * @returns {{ action, score, matchLabel }[]}
 */
export function filterAndRankEpActions({
  actions = [],
  subprojectTitle = '',
  searchQuery = '',
  linkedActionIds = [],
  showAllWhenEmpty = false,
  limit = 80
}) {
  const linked = new Set(linkedActionIds);
  const available = actions.filter(a => a?.id && !linked.has(a.id));

  const query = (searchQuery || '').trim();
  const hasQuery = query.length > 0;

  const ranked = available
    .map(action => {
      const score = scoreEpActionMatch(subprojectTitle, action, query);
      return { action, score, matchLabel: getMatchLabel(score) };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.action.aa || 0) - (b.action.aa || 0);
    });

  if (hasQuery) {
    return ranked.filter(x => x.score > 0).slice(0, limit);
  }

  const suggestions = ranked.filter(x => x.score >= 12);
  if (suggestions.length > 0) return suggestions.slice(0, limit);

  if (showAllWhenEmpty) {
    return ranked.slice(0, limit).map(x => ({ ...x, score: 0, matchLabel: null }));
  }

  return [];
}

/**
 * Μετατροπή normalized index → raw string range (για highlight).
 *
 * Χτίζει χαρτογράφηση raw index → norm index ακολουθώντας ακριβώς
 * τη λογική του normalizeSearchText χωρίς να το καλεί char-by-char
 * (κλήση char-by-char προκαλεί bug επειδή το .trim() τρώει τα spaces).
 */
function mapNormRangeToRaw(raw, normStart, normEnd) {
  // rawToNorm[i] = η θέση στο normalized string που αντιστοιχεί στο raw[i],
  // ή -1 αν ο χαρακτήρας συγχωνεύεται σε ήδη υπάρχον space.
  const rawToNorm = new Int32Array(raw.length).fill(-1);
  let ni = 0;
  let prevWasSpace = true; // leading spaces → trimmed, δεν αριθμούνται

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    // Κανονικοποίηση μεμονωμένου χαρακτήρα (χωρίς trim):
    // lowercase + NFD + strip accents
    const norm = ch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isLetter = norm.length > 0 && /[\p{L}\p{N}]/u.test(norm);
    const isWS    = /\s/u.test(ch);

    if (isLetter) {
      rawToNorm[i] = ni;
      ni += norm.length; // συνήθως 1
      prevWasSpace = false;
    } else {
      // Κενά & σημεία στίξης → ένα space, αλλά μόνο αν δεν υπάρχει ήδη
      if (!prevWasSpace) {
        rawToNorm[i] = ni;
        ni += 1;
        prevWasSpace = true;
      }
      // αλλιώς rawToNorm[i] = -1 (collapsed)
    }
  }

  // Trailing space: το normalizeSearchText κόβει και το τελευταίο space.
  // Αν ο τελευταίος καταχωρημένος χαρακτήρας ήταν space, μειώνουμε ni κατά 1.
  if (prevWasSpace && ni > 0) ni -= 1;

  let start = -1;
  let end   = raw.length;

  for (let i = 0; i < raw.length; i++) {
    const n = rawToNorm[i];
    if (n === -1) continue;
    if (n >= normStart && start === -1) start = i;
    if (n >= normEnd   && start !== -1) { end = i; break; }
  }

  if (start === -1) return null;
  return { start, end };
}

/** Highlight τμημάτων τίτλου που ταιριάζουν με tokens. */
export function highlightTitleMatches(title, subprojectTitle, searchQuery) {
  const raw = title || '';
  if (!raw) return [{ text: '', match: false }];

  const tokens = [
    ...tokenizeSearchText(searchQuery, 2),
    ...tokenizeSearchText(subprojectTitle)
  ]
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .sort((a, b) => b.length - a.length);

  if (tokens.length === 0) return [{ text: raw, match: false }];

  const normRaw = normalizeSearchText(raw);
  const ranges = [];

  for (const token of tokens) {
    let from = 0;
    while (from < normRaw.length) {
      const idx = normRaw.indexOf(token, from);
      if (idx === -1) break;
      const mapped = mapNormRangeToRaw(raw, idx, idx + token.length);
      if (mapped) ranges.push(mapped);
      from = idx + 1;
    }
  }

  if (ranges.length === 0) return [{ text: raw, match: false }];

  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start >= last.end) merged.push({ ...r });
    else last.end = Math.max(last.end, r.end);
  }

  const parts = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) parts.push({ text: raw.slice(cursor, r.start), match: false });
    parts.push({ text: raw.slice(r.start, r.end), match: true });
    cursor = r.end;
  }
  if (cursor < raw.length) parts.push({ text: raw.slice(cursor), match: false });
  return parts;
}
