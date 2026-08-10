/**
 * @jest-environment node
 */
const {
  CATEGORIES,
  VIZ_MODES,
  ELIGIBLE_STATUSES,
  MAX_PHOTOS_PER_PHASE,
  MAX_METRICS_ROWS,
  yearBelongsToPeriod,
  isEligibleSubprojectStatus,
  validatePhotoPhases,
  getPrimaryPhoto,
  getCardReadiness,
  showHeaderAmountsForPrimary,
  showHeaderNarrativeForPrimary,
  areIncompatibleTextOnlyPair,
  migrateDeprecatedVizIds,
  sortCardsByApprovedAmountDesc,
  canAddLinkedSubproject,
  mapSubprojectToCardFields,
  validateLegacyCardInput,
  syncCardAmountsFromSubproject,
  dismissAmountBadge,
  normalizeMetrics,
  resolveMediaPathSafe,
  parseAmountNumber,
  normalizePhotoSlots,
  photoPhaseLabelEl,
  requiredPhotoPhasesForVizIds,
} = require('../../public/apologismosDomain');

const period = { id: '2024-2028', startYear: 2024, endYear: 2028 };

function baseReadyCard(overrides = {}) {
  return {
    id: 'c1',
    source: 'linked',
    title: 'Ασφαλτόστρωση οδού',
    categoryId: 'roads',
    narrative: 'Αναβάθμιση οδικού δικτύου στην περιοχή.',
    approvedAmount: '100.000,00',
    contractAmount: '90.000,00',
    primaryViz: 'simple_card',
    photos: {},
    ...overrides,
  };
}

describe('apologismosDomain — constants', () => {
  test('ακριβώς 9 κατηγορίες με τα συμφωνημένα labels', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Οδοποιία & οδικό δίκτυο',
      'Κυκλοφορία, στάθμευση & κινητικότητα',
      'Αναπλάσεις & δημόσιος χώρος',
      'Ύδρευση & άρδευση',
      'Αποχέτευση & λύματα',
      'Καθαριότητα & απορρίμματα',
      'Περιβάλλον, ρέματα & πράσινο',
      'Κτιριακά, σχολεία & αθλητισμός',
      'Μελέτες, προμήθειες & λοιπά τεχνικά',
    ]);
  });

  test('ακριβώς 8 τρόποι οπτικοποίησης με τα νέα labels', () => {
    expect(VIZ_MODES).toHaveLength(8);
    expect(VIZ_MODES.some((v) => v.id === 'amount_compare')).toBe(false);
    expect(VIZ_MODES.find((v) => v.id === 'economy_phases')?.label).toBe('Έμφαση στα ποσά');
    expect(VIZ_MODES.find((v) => v.id === 'after_only')?.label).toBe('Φωτογραφίες «Μετά»');
    expect(VIZ_MODES.find((v) => v.id === 'simple_card')?.label).toBe('Μόνο κείμενο');
  });

  test('κεφαλίδα: ποσά κρυμμένα μόνο στην έμφαση ποσών· κείμενο κρυμμένο μόνο στο μόνο κείμενο', () => {
    expect(showHeaderAmountsForPrimary('economy_phases')).toBe(false);
    expect(showHeaderAmountsForPrimary('amount_compare')).toBe(false);
    expect(showHeaderAmountsForPrimary('before_after')).toBe(true);
    expect(showHeaderAmountsForPrimary('simple_card')).toBe(true);
    expect(showHeaderNarrativeForPrimary('simple_card')).toBe(false);
    expect(showHeaderNarrativeForPrimary('economy_phases')).toBe(true);
    expect(showHeaderNarrativeForPrimary('after_only')).toBe(true);
  });

  test('μόνο κείμενο + έμφαση ποσών είναι ασύμβατο ζεύγος και καθαρίζεται στη μετανάστευση', () => {
    expect(areIncompatibleTextOnlyPair('simple_card', 'economy_phases')).toBe(true);
    expect(areIncompatibleTextOnlyPair('economy_phases', 'simple_card')).toBe(true);
    expect(areIncompatibleTextOnlyPair('simple_card', 'map_path')).toBe(false);
    const migrated = migrateDeprecatedVizIds({
      primaryViz: 'simple_card',
      secondaryViz: 'economy_phases',
    });
    expect(migrated.changed).toBe(true);
    expect(migrated.card.secondaryViz).toBeNull();
    // Μετά τη μετανάστευση η κάρτα μπορεί να είναι ready
    expect(getCardReadiness(baseReadyCard({
      primaryViz: 'simple_card',
      secondaryViz: 'economy_phases',
    })).ready).toBe(true);
  });

  test('eligible statuses μόνο ολοκληρωμένα / αποπληρωμένα', () => {
    expect(ELIGIBLE_STATUSES).toEqual([
      'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
    ]);
    expect(isEligibleSubprojectStatus('ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ')).toBe(false);
    expect(isEligibleSubprojectStatus('ΟΛΟΚΛΗΡΩΜΕΝΟ')).toBe(true);
  });
});

describe('apologismosDomain — period & amounts', () => {
  test('yearBelongsToPeriod', () => {
    expect(yearBelongsToPeriod(2025, period)).toBe(true);
    expect(yearBelongsToPeriod(2024, period)).toBe(true);
    expect(yearBelongsToPeriod(2028, period)).toBe(true);
    expect(yearBelongsToPeriod(2023, period)).toBe(false);
    expect(yearBelongsToPeriod(2029, period)).toBe(false);
  });

  test('parseAmountNumber δέχεται ελληνική μορφή', () => {
    expect(parseAmountNumber('1.234.567,89')).toBeCloseTo(1234567.89);
  });

  test('δεν υπάρχει helper έκπτωσης στο module', () => {
    const mod = require('../../public/apologismosDomain');
    const discountKeys = Object.keys(mod).filter((k) => /discount|έκπτω|exonom|saving/i.test(k));
    expect(discountKeys).toEqual([]);
  });
});

describe('apologismosDomain — photos', () => {
  test('τρόπος πριν/μετά: min 1+1, max 3+3, πρώτη = κύρια', () => {
    const ok = validatePhotoPhases(
      { before: ['a.jpg'], after: ['b.jpg', 'c.jpg'] },
      ['before', 'after']
    );
    expect(ok.ok).toBe(true);
    expect(getPrimaryPhoto({ before: ['a.jpg', 'x.jpg'] }, 'before')).toBe('a.jpg');

    const missing = validatePhotoPhases({ before: [], after: ['b.jpg'] }, ['before', 'after']);
    expect(missing.ok).toBe(false);

    const tooMany = validatePhotoPhases(
      { before: ['1', '2', '3', '4'], after: ['1'] },
      ['before', 'after']
    );
    expect(tooMany.photos.before).toHaveLength(MAX_PHOTOS_PER_PHASE);
  });

  test('τρόπος πριν/κατά/μετά απαιτεί και τις 3 φάσεις', () => {
    const r = validatePhotoPhases(
      { before: ['a'], during: ['b'], after: ['c'] },
      ['before', 'during', 'after']
    );
    expect(r.ok).toBe(true);
    const bad = validatePhotoPhases(
      { before: ['a'], during: [], after: ['c'] },
      ['before', 'during', 'after']
    );
    expect(bad.ok).toBe(false);
  });

  test('διπλότυπες διαδρομές φωτογραφιών αφαιρούνται (μετρητής = πραγματικές)', () => {
    const dup = normalizePhotoSlots(
      { after: ['media/x/after/a.jpg', 'media/x/after/a.jpg', 'media/x/after/a.jpg'], before: [], during: [] },
      ['before', 'during', 'after']
    );
    expect(dup.after).toEqual(['media/x/after/a.jpg']);
    expect(photoPhaseLabelEl('before')).toBe('Πριν');
    expect(photoPhaseLabelEl('during')).toBe('Κατά τη διάρκεια');
    expect(photoPhaseLabelEl('after')).toBe('Μετά');
    expect(requiredPhotoPhasesForVizIds(['before_after'])).toEqual(['before', 'after']);
    expect(requiredPhotoPhasesForVizIds(['after_only', 'map_path'])).toEqual(['after']);
    const missing = validatePhotoPhases({ before: [], after: [] }, ['before', 'after']);
    expect(missing.errors.join(' ')).toContain('Πριν');
    expect(missing.errors.join(' ')).not.toMatch(/\bbefore\b/);
  });
});

describe('apologismosDomain — readiness', () => {
  test('χωρίς κείμενο ή χωρίς viz → όχι ready', () => {
    expect(getCardReadiness(baseReadyCard({ narrative: '' })).ready).toBe(false);
    expect(getCardReadiness(baseReadyCard({ primaryViz: null })).ready).toBe(false);
    expect(getCardReadiness(baseReadyCard()).ready).toBe(true);
  });

  test('before_after χωρίς φωτογραφίες → όχι ready', () => {
    const r = getCardReadiness(
      baseReadyCard({
        primaryViz: 'before_after',
        photos: { before: [], after: [] },
      })
    );
    expect(r.ready).toBe(false);
  });

  test('before_after με φωτογραφίες → ready', () => {
    const r = getCardReadiness(
      baseReadyCard({
        primaryViz: 'before_after',
        photos: { before: ['b1'], after: ['a1'] },
      })
    );
    expect(r.ready).toBe(true);
  });

  test('metrics table: κενές γραμμές αγνοούνται, max 6', () => {
    const normalized = normalizeMetrics([
      { label: '', value: '' },
      { label: 'Μήκος', value: '1,2 χλμ' },
      ...Array.from({ length: 10 }, (_, i) => ({ label: `L${i}`, value: `${i}` })),
    ]);
    expect(normalized[0].label).toBe('Μήκος');
    expect(normalized.length).toBeLessThanOrEqual(MAX_METRICS_ROWS);

    const r = getCardReadiness(
      baseReadyCard({ primaryViz: 'metrics_table', metrics: [] })
    );
    expect(r.ready).toBe(false);
  });

  test('legacy απαιτεί περιοχή και έτος', () => {
    const r = getCardReadiness(
      baseReadyCard({
        source: 'legacy',
        area: '',
        completionYear: 2025,
      })
    );
    expect(r.ready).toBe(false);
  });
});

describe('apologismosDomain — sort & include', () => {
  test('ταξινόμηση φθίνουσα κατά approvedAmount', () => {
    const sorted = sortCardsByApprovedAmountDesc([
      { title: 'A', approvedAmount: '10.000,00' },
      { title: 'B', approvedAmount: '50.000,00' },
      { title: 'C', approvedAmount: '20.000,00' },
    ]);
    expect(sorted.map((c) => c.title)).toEqual(['B', 'C', 'A']);
  });

  test('canAddLinkedSubproject: reject μη eligible και διπλότυπο', () => {
    const sub = {
      subprojectId: 's1',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      subprojectTitle: 'Τεστ',
      approvedAmount: '1',
      contractAmount: '1',
    };
    expect(canAddLinkedSubproject(sub, []).ok).toBe(true);
    expect(
      canAddLinkedSubproject(
        { ...sub, projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' },
        []
      ).ok
    ).toBe(false);
    expect(
      canAddLinkedSubproject(sub, [{ source: 'linked', subprojectId: 's1' }]).ok
    ).toBe(false);
    expect(canAddLinkedSubproject(sub, [{ source: 'linked', subprojectId: 's1' }]).error).toMatch(
      /ήδη/
    );
  });

  test('mapSubprojectToCardFields', () => {
    const mapped = mapSubprojectToCardFields({
      subprojectId: 'x',
      projectId: 'p',
      subprojectTitle: 'Τίτλος',
      approvedAmount: '10',
      contractAmount: '8',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
    });
    expect(mapped.source).toBe('linked');
    expect(mapped.title).toBe('Τίτλος');
  });
});

describe('apologismosDomain — legacy & sync badges', () => {
  test('legacy χωρίς περιοχή/έτος ή εκτός περιόδου → invalid', () => {
    expect(
      validateLegacyCardInput(
        { title: 'X', area: '', completionYear: 2025, approvedAmount: 1, contractAmount: 1 },
        period
      ).ok
    ).toBe(false);
    expect(
      validateLegacyCardInput(
        {
          title: 'X',
          area: 'Αρχάνες',
          completionYear: 2019,
          approvedAmount: 1,
          contractAmount: 1,
        },
        period
      ).ok
    ).toBe(false);
    expect(
      validateLegacyCardInput(
        {
          title: 'X',
          area: 'Αρχάνες',
          completionYear: 2025,
          approvedAmount: 1,
          contractAmount: 1,
        },
        period
      ).ok
    ).toBe(true);
  });

  test('sync amounts θέτει badge· χωρίς αλλαγή το αφήνει· dismiss καθαρίζει', () => {
    const card = {
      source: 'linked',
      subprojectId: 's1',
      approvedAmount: '100',
      contractAmount: '90',
      amountChangedBadge: false,
    };
    const synced = syncCardAmountsFromSubproject(card, {
      approvedAmount: '120',
      contractAmount: '90',
    });
    expect(synced.changed).toBe(true);
    expect(synced.card.amountChangedBadge).toBe(true);
    expect(synced.card.approvedAmount).toBe('120');

    const same = syncCardAmountsFromSubproject(synced.card, {
      approvedAmount: '120',
      contractAmount: '90',
    });
    expect(same.changed).toBe(false);
    expect(same.card.amountChangedBadge).toBe(true);

    const dismissed = dismissAmountBadge(synced.card);
    expect(dismissed.amountChangedBadge).toBe(false);
    expect(dismissed.approvedAmount).toBe('120');
  });

  test('sync αγνοεί legacy κάρτες', () => {
    const card = { source: 'legacy', approvedAmount: '1', contractAmount: '1' };
    const r = syncCardAmountsFromSubproject(card, { approvedAmount: '9', contractAmount: '9' });
    expect(r.changed).toBe(false);
  });

  test('sync δεν σβήνει χειροκίνητα ποσά όταν το υποέργο έχει κενά', () => {
    const card = {
      source: 'linked',
      approvedAmount: 'manual-ok',
      contractAmount: '11',
    };
    // 'manual-ok' δεν είναι usable στο υποέργο· στο card το contract είναι usable
    // Αν υποέργο στείλει κενά, δεν αλλάζει
    const r = syncCardAmountsFromSubproject(
      { source: 'linked', approvedAmount: '11', contractAmount: '10' },
      { approvedAmount: '', contractAmount: null }
    );
    expect(r.changed).toBe(false);
  });
});

describe('apologismosDomain — path guard', () => {
  test('απορρίπτει path traversal', () => {
    const dataDir = 'C:\\data';
    const root = 'C:\\data\\ΑΠΟΛΟΓΙΣΜΟΣ';
    expect(resolveMediaPathSafe(dataDir, root, '..\\secret.txt').ok).toBe(false);
    expect(resolveMediaPathSafe(dataDir, root, 'media/card1/a.jpg').ok).toBe(true);
  });
});
