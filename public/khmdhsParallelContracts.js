/**
 * Ανίχνευση παράλληλων (ανεξάρτητων) συμβάσεων στην ίδια υπόθεση ΚΗΜΔΗΣ.
 */

const RE_SUPPLEMENTARY_TITLE = /συμπληρωματικ|τροποποι|προσθετικ\s+συμβ|αναθεώρησ\s+τιμ/i;

/** SYMV που στο ΚΗΜΔΗΣ δεν είναι πραγματική σύμβαση (διακήρυξη, απόφαση επιτροπής κ.λπ.) */
const RE_NON_CONTRACT_SYMV_TITLE = /διακήρυξη|διακηρυξη|προκήρυξη|προκηρυξη|απόφαση|αποφαση|δημοτικη\s*επιτροπ|δημοτική\s*επιτροπ|έγκριση\s+πρακτικ|εγκριση\s+πρακτικ|πρακτικ[οα]?\s+διαγωνισμ/i;

function normalizeAdamRef(value) {
  const t = String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
  return /^(\d{2})([A-Z]{3,4})(\d{9})$/i.test(t) ? t : '';
}

function contractSignedDateKey(record) {
  return String(record?.contractSignedDate || record?.startDate || '').slice(0, 10);
}

/** Πραγματική σύμβαση (όχι διακήρυξη / απόφαση που καταχωρήθηκε ως SYMV). */
function isSubstantiveContractSymvRecord(record) {
  if (!record || typeof record !== 'object') return true;
  const title = String(record.title || '').trim();
  if (!title) return true;
  if (RE_NON_CONTRACT_SYMV_TITLE.test(title)) return false;
  return true;
}

function filterSubstantiveParallelSiblings(recordsByAdam, siblings) {
  return (siblings || []).filter((adam) => {
    const norm = normalizeAdamRef(adam);
    const rec = recordsByAdam?.get?.(norm) || recordsByAdam?.get?.(adam);
    if (!rec) return true;
    return isSubstantiveContractSymvRecord(rec);
  });
}

/** Συμπληρωματική/τροποποίηση — όχι ανεξάρτητη παράλληλη σύμβαση */
function looksLikeSupplementaryContractRecord(record, { modifiedMarker = false } = {}) {
  if (!record || typeof record !== 'object') return false;
  const title = String(record.title || '').toUpperCase();
  if (RE_SUPPLEMENTARY_TITLE.test(title)) return true;
  if (modifiedMarker) return true;
  return false;
}

/**
 * Αποκλείει συμπληρωματικές της ίδιας ανάθεσης από τους «παράλληλους» κλάδους.
 * Π.χ. αρχική σύμβαση + 1η συμπληρωματική με κοινό ΑΔΑΜ ανάθεσης → μία ρίζα, όχι δύο κλάδοι.
 */
function filterSupplementaryFromParallelRoots(recordsByAdam, roots) {
  return (roots || []).filter((adam) => {
    const rec = recordsByAdam.get(adam);
    // Χρησιμοποιούμε και τον τίτλο ΚΑΙ το '_khmdhsModified' flag (από '*' marker ΚΗΜΔΗΣ)
    // ώστε να αναγνωρίζουμε συμπληρωματικές ακόμα κι αν ο τίτλος δεν περιέχει τη λέξη.
    if (!looksLikeSupplementaryContractRecord(rec, { modifiedMarker: !!rec?._khmdhsModified })) return true;
    const auction = normalizeAdamRef(rec?.auctionRefNo);
    if (!auction) return true;
    const signed = contractSignedDateKey(rec);
    const hasEarlierRoot = roots.some((other) => {
      if (other === adam) return false;
      const orec = recordsByAdam.get(other);
      if (!orec || looksLikeSupplementaryContractRecord(orec)) return false;
      if (normalizeAdamRef(orec.auctionRefNo) !== auction) return false;
      const otherSigned = contractSignedDateKey(orec);
      if (!signed || !otherSigned) return true;
      return otherSigned < signed;
    });
    return !hasEarlierRoot;
  });
}

/**
 * @param {Map<string, object>} recordsByAdam — snapshots σύμβασης keyed by ADAM
 */
function detectParallelContractSiblings(recordsByAdam) {
  const adams = [...(recordsByAdam?.keys() || [])].filter(Boolean);
  if (adams.length < 2) {
    return { parallel: false, siblingRoots: adams, allAdams: adams, actSupplementaryAdams: [] };
  }

  const inSet = new Set(adams);
  const roots = adams.filter((adam) => {
    const prev = normalizeAdamRef(recordsByAdam.get(adam)?.prevReferenceNo);
    return !(prev && inSet.has(prev));
  });

  // Guard: κυκλικές αναφορές (A→prev B και B→prev A) οδηγούν σε roots=[].
  // Σε αυτή την περίπτωση θεωρούμε όλες τις συμβάσεις ρίζες (ανεξάρτητες).
  const effectiveRoots = roots.length === 0 ? adams : roots;
  const siblingRoots = filterSupplementaryFromParallelRoots(recordsByAdam, effectiveRoots);
  const actSupplementaryAdams = effectiveRoots.filter((a) => !siblingRoots.includes(a));

  const parallel = siblingRoots.length > 1;
  return { parallel, siblingRoots, allAdams: adams, actSupplementaryAdams };
}

/**
 * Επιλογή σύμβασης εισόδου όταν υπάρχουν παράλληλες — μόνο αν ο σπόρος είναι SYMV ή υπάρχει μοναδική αντιστοίχιση.
 */
function pickContractAdamAmongSiblings(recordsByAdam, seedType, seedNorm) {
  const { parallel, siblingRoots } = detectParallelContractSiblings(recordsByAdam);
  if (!parallel) return null;

  const seed = normalizeAdamRef(seedNorm);
  if (seedType === 'SYMV' && seed && recordsByAdam.has(seed)) return seed;

  if (seedType === 'AWRD' && seed) {
    const matches = siblingRoots.filter((adam) => {
      const ref = normalizeAdamRef(recordsByAdam.get(adam)?.auctionRefNo);
      return ref === seed;
    });
    if (matches.length === 1) return matches[0];
  }

  return null;
}

/**
 * Έλεγχος πριν προσθήκη «ορφανής» συμπληρωματικής.
 */
function validateOrphanSupplementaryCandidate(record, adam, options = {}) {
  const normalizedAdam = normalizeAdamRef(adam);
  const primary = normalizeAdamRef(options.primaryContractAdam);
  const existing = new Set(
    (options.existingChainAdams || []).map((a) => normalizeAdamRef(a)).filter(Boolean)
  );
  if (primary) existing.add(primary);

  if (!normalizedAdam) {
    return { ok: false, error: 'Μη έγκυρος ΑΔΑΜ σύμβασης.' };
  }
  if (existing.has(normalizedAdam)) {
    return { ok: false, error: 'Αυτός ο ΑΔΑΜ υπάρχει ήδη στην αλυσίδα του υποέργου.' };
  }
  if (primary && normalizedAdam === primary) {
    return { ok: false, error: 'Ο κωδικός συμπληρωματικής δεν μπορεί να είναι ο ίδιος με την αρχική σύμβαση.' };
  }

  const prev = normalizeAdamRef(record?.prevReferenceNo);
  const next = normalizeAdamRef(record?.nextRefNo);

  if (prev && existing.has(prev)) {
    return {
      ok: false,
      error: 'Η σύμβαση συνδέεται ηλεκτρονικά με την κύρια αλυσίδα — κάντε επαναφόρτωση της αλυσίδας αντί χειροκίνητης προσθήκης.',
    };
  }
  if (next && existing.has(next)) {
    return {
      ok: false,
      error: 'Η σύμβαση συνδέεται ηλεκτρονικά με την κύρια αλυσίδα — κάντε επαναφόρτωση της αλυσίδας αντί χειροκίνητης προσθήκης.',
    };
  }

  const primaryRecord = primary ? options.primaryContractRecord : null;
  const auctionRef = normalizeAdamRef(record?.auctionRefNo);
  const primaryAuctionRef = normalizeAdamRef(primaryRecord?.auctionRefNo);
  if (
    primary
    && auctionRef
    && primaryAuctionRef
    && auctionRef === primaryAuctionRef
    && !prev
    && !next
  ) {
    if (looksLikeSupplementaryContractRecord(record)) {
      return { ok: true };
    }
    return {
      ok: false,
      error: 'Αυτός είναι ξεχωριστή παράλληλη σύμβαση στην ίδια ανάθεση — όχι συμπληρωματική της κύριας. Χρησιμοποιήστε «Πολλές Συμβάσεις» ή δώστε τον ΑΔΑΜ της σωστής σύμβασης.',
    };
  }

  return { ok: true };
}

module.exports = {
  normalizeAdamRef,
  contractSignedDateKey,
  isSubstantiveContractSymvRecord,
  filterSubstantiveParallelSiblings,
  looksLikeSupplementaryContractRecord,
  filterSupplementaryFromParallelRoots,
  detectParallelContractSiblings,
  pickContractAdamAmongSiblings,
  validateOrphanSupplementaryCandidate,
};
