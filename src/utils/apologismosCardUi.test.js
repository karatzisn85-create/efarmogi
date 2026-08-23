/**
 * @jest-environment node
 */
/* Έλεγχοι για τη λογική της οθόνης απολογισμού: λίστα, προβολή φωτογραφιών,
   απαιτήσεις κύριου/δευτερεύοντα τρόπου προβολής. */
import {
  PHOTO_PHASE_ORDER,
  filterApologismosCards,
  flattenCardPhotos,
  stepPhotoPath,
  cardVizIds,
  needsMapInput,
  needsMetricsInput,
  minMapPoints,
  photoPhasesForVizIds,
  secondaryVizOptions,
  vizRequirementText,
  vizUserGuide,
  needsNarrativeEmphasis,
  needsAmountsEmphasis,
  isMapViewerItem,
  METRICS_MAX_ROWS,
  METRICS_COLUMNS,
  METRICS_EXAMPLE,
  draftMetricsRows,
  cleanMetricsRows,
  updateMetricsRow,
  addMetricsRow,
  removeMetricsRow,
} from './apologismosCardUi';

const VIZ_MODES = [
  { id: 'before_after', label: 'Πριν / Μετά', photoPhases: ['before', 'after'] },
  { id: 'before_during_after', label: 'Πριν / Κατά / Μετά', photoPhases: ['before', 'during', 'after'] },
  { id: 'after_only', label: 'Φωτογραφίες «Μετά»', photoPhases: ['after'] },
  { id: 'map_path', label: 'Χάρτης σημείου / διαδρομής', photoPhases: [] },
  { id: 'map_multi', label: 'Χάρτης πολλαπλών σημείων', photoPhases: [] },
  { id: 'economy_phases', label: 'Έμφαση στα ποσά', photoPhases: [] },
  { id: 'metrics_table', label: 'Πίνακας αποτελεσμάτων', photoPhases: [] },
  { id: 'simple_card', label: 'Μόνο κείμενο', photoPhases: [] },
];

const PHASE_LABELS = { before: 'Πριν', during: 'Κατά τη διάρκεια', after: 'Μετά' };
const phaseLabel = (p) => PHASE_LABELS[p] || p;

const CARDS = [
  { id: '1', title: 'Ασφαλτόστρωση οδού Παπάγου', area: 'Κέντρο', ready: true },
  { id: '2', title: 'Ανάπλαση πλατείας', area: 'Άνω Συνοικία', ready: false },
  { id: '3', title: 'Δίκτυο ύδρευσης', area: '', ready: true },
];

describe('λίστα καρτών απολογισμού', () => {
  test('χωρίς φίλτρα επιστρέφει όλες τις κάρτες', () => {
    expect(filterApologismosCards(CARDS)).toHaveLength(3);
    expect(filterApologismosCards(CARDS, { search: '   ', status: 'all' })).toHaveLength(3);
  });

  test('φίλτρο κατάστασης χωρίζει έτοιμες από εκκρεμείς', () => {
    expect(filterApologismosCards(CARDS, { status: 'ready' }).map((c) => c.id)).toEqual(['1', '3']);
    expect(filterApologismosCards(CARDS, { status: 'pending' }).map((c) => c.id)).toEqual(['2']);
  });

  test('αναζήτηση σε τίτλο και περιοχή, χωρίς διάκριση κεφαλαίων', () => {
    expect(filterApologismosCards(CARDS, { search: 'πλατεία' }).map((c) => c.id)).toEqual(['2']);
    expect(filterApologismosCards(CARDS, { search: 'Ασφαλτόστρωση' }).map((c) => c.id)).toEqual(['1']);
    expect(filterApologismosCards(CARDS, { search: 'δεν υπάρχει' })).toHaveLength(0);
  });

  test('αναζήτηση βρίσκει και τον τίτλο του έργου', () => {
    const withProject = [
      { id: '1', title: 'Αίθουσα εκδηλώσεων', projectTitle: 'Ολοκληρωμένο έργο σχολείου', area: '', ready: true }
    ];
    expect(filterApologismosCards(withProject, { search: 'σχολείου' }).map((c) => c.id)).toEqual(['1']);
    expect(filterApologismosCards(withProject, { search: 'ΚΑ-400' })).toHaveLength(0);
  });

  test('αναζήτηση με ΚΕΦΑΛΑΙΑ βρίσκει τίτλους με τόνους', () => {
    expect(filterApologismosCards(CARDS, { search: 'ΚΕΝΤΡΟ' }).map((c) => c.id)).toEqual(['1']);
    expect(filterApologismosCards(CARDS, { search: 'ΠΛΑΤΕΙΑΣ' }).map((c) => c.id)).toEqual(['2']);
    expect(filterApologismosCards(CARDS, { search: 'ΑΝΩ ΣΥΝΟΙΚΙΑ' }).map((c) => c.id)).toEqual(['2']);
    expect(filterApologismosCards(CARDS, { search: 'ΥΔΡΕΥΣΗΣ' }).map((c) => c.id)).toEqual(['3']);
  });

  test('αναζήτηση χωρίς τόνους βρίσκει τονισμένα και αντίστροφα', () => {
    expect(filterApologismosCards(CARDS, { search: 'ασφαλτοστρωση' }).map((c) => c.id)).toEqual(['1']);
    expect(filterApologismosCards(CARDS, { search: 'πλατείας' }).map((c) => c.id)).toEqual(['2']);
  });

  test('αναζήτηση και φίλτρο κατάστασης συνδυάζονται', () => {
    expect(filterApologismosCards(CARDS, { search: 'α', status: 'pending' }).map((c) => c.id))
      .toEqual(['2']);
  });

  test('ανθεκτικό σε κενή ή απούσα λίστα', () => {
    expect(filterApologismosCards(null, { search: 'κάτι' })).toEqual([]);
    expect(filterApologismosCards([], {})).toEqual([]);
  });
});

describe('προβολή φωτογραφιών κάρτας', () => {
  const card = {
    photos: {
      before: ['media/c/before/a.jpg', 'media/c/before/b.jpg'],
      during: [],
      after: ['media/c/after/z.jpg'],
    },
  };

  test('ενιαία λίστα με σειρά φάσεων και θέση εντός φάσης', () => {
    const list = flattenCardPhotos(card);
    expect(list.map((p) => p.rel)).toEqual([
      'media/c/before/a.jpg', 'media/c/before/b.jpg', 'media/c/after/z.jpg',
    ]);
    expect(list.map((p) => p.phase)).toEqual(['before', 'before', 'after']);
    expect(list.map((p) => p.idx)).toEqual([0, 1, 0]);
  });

  test('παραλείπει κενές τιμές και κάρτα χωρίς φωτογραφίες', () => {
    expect(flattenCardPhotos({ photos: { before: [null, ''], after: [] } })).toEqual([]);
    expect(flattenCardPhotos(null)).toEqual([]);
  });

  test('η σειρά φάσεων είναι Πριν → Κατά → Μετά', () => {
    expect(PHOTO_PHASE_ORDER).toEqual(['before', 'during', 'after']);
    const list = flattenCardPhotos({
      photos: { after: ['x.jpg'], during: ['y.jpg'], before: ['w.jpg'] },
    });
    expect(list.map((p) => p.rel)).toEqual(['w.jpg', 'y.jpg', 'x.jpg']);
  });

  test('μετάβαση εμπρός/πίσω με κυκλική περιστροφή', () => {
    const list = flattenCardPhotos(card);
    expect(stepPhotoPath(list, 'media/c/before/a.jpg', 1)).toBe('media/c/before/b.jpg');
    expect(stepPhotoPath(list, 'media/c/after/z.jpg', 1)).toBe('media/c/before/a.jpg');
    expect(stepPhotoPath(list, 'media/c/before/a.jpg', -1)).toBe('media/c/after/z.jpg');
  });

  test('άγνωστη ή κενή τρέχουσα φωτογραφία δεν σπάει τη μετάβαση', () => {
    const list = flattenCardPhotos(card);
    expect(stepPhotoPath(list, 'δεν/υπάρχει.jpg', 1)).toBe('media/c/before/b.jpg');
    expect(stepPhotoPath([], 'ό,τι', 1)).toBeNull();
    expect(stepPhotoPath(null, 'ό,τι', -1)).toBeNull();
  });

  test('ο αποθηκευμένος χάρτης μπαίνει στη λίστα προβολής στο τέλος', () => {
    const list = flattenCardPhotos({
      ...card,
      mapSnapshot: 'media/c/map/snapshot.png',
    });
    expect(list).toHaveLength(4);
    const mapItem = list[list.length - 1];
    expect(mapItem.phase).toBe('map');
    expect(mapItem.rel).toBe('media/c/map/snapshot.png');
    expect(isMapViewerItem(mapItem)).toBe(true);
    expect(isMapViewerItem(list[0])).toBe(false);
    expect(stepPhotoPath(list, 'media/c/after/z.jpg', 1)).toBe('media/c/map/snapshot.png');
    expect(stepPhotoPath(list, 'media/c/map/snapshot.png', 1)).toBe('media/c/before/a.jpg');
  });
});

describe('απαιτήσεις κύριου & δευτερεύοντα τρόπου προβολής', () => {
  test('οι τρόποι της κάρτας μαζεύονται και οι δύο', () => {
    expect(cardVizIds({ primaryViz: 'after_only', secondaryViz: 'map_multi' }))
      .toEqual(['after_only', 'map_multi']);
    expect(cardVizIds({ primaryViz: 'after_only', secondaryViz: null })).toEqual(['after_only']);
    expect(cardVizIds(null)).toEqual([]);
  });

  test('ο χάρτης ζητά σημεία ακόμη κι όταν είναι μόνο δευτερεύων', () => {
    const ids = cardVizIds({ primaryViz: 'after_only', secondaryViz: 'map_path' });
    expect(needsMapInput(ids)).toBe(true);
    expect(minMapPoints(ids)).toBe(1);
  });

  test('ο χάρτης πολλαπλών σημείων ανεβάζει το ελάχιστο στα 2', () => {
    expect(minMapPoints(['simple_card', 'map_multi'])).toBe(2);
    expect(minMapPoints(['map_path'])).toBe(1);
    expect(minMapPoints([])).toBe(1);
  });

  test('ο πίνακας αποτελεσμάτων ζητά γραμμές και ως δευτερεύων', () => {
    expect(needsMetricsInput(cardVizIds({ primaryViz: 'before_after', secondaryViz: 'metrics_table' })))
      .toBe(true);
    expect(needsMetricsInput(['before_after', 'simple_card'])).toBe(false);
  });

  test('οι φάσεις φωτογραφιών ενώνονται από κύριο και δευτερεύοντα', () => {
    expect(photoPhasesForVizIds(VIZ_MODES, ['before_after', 'before_during_after']))
      .toEqual(['before', 'during', 'after']);
    expect(photoPhasesForVizIds(VIZ_MODES, ['after_only', 'map_path'])).toEqual(['after']);
    expect(photoPhasesForVizIds(VIZ_MODES, ['simple_card'])).toEqual([]);
    expect(photoPhasesForVizIds(VIZ_MODES, ['ανύπαρκτο'])).toEqual([]);
  });

  test('ο δευτερεύων δεν προσφέρει τον ίδιο τρόπο με τον κύριο', () => {
    const options = secondaryVizOptions(VIZ_MODES, 'before_after');
    expect(options).toHaveLength(VIZ_MODES.length - 1);
    expect(options.some((v) => v.id === 'before_after')).toBe(false);
    expect(secondaryVizOptions(VIZ_MODES, '')).toHaveLength(VIZ_MODES.length);
  });

  test('μόνο κείμενο και έμφαση ποσών δεν συνδυάζονται ως κύριος+δευτερεύων', () => {
    const fromSimple = secondaryVizOptions(VIZ_MODES, 'simple_card').map((v) => v.id);
    expect(fromSimple).not.toContain('economy_phases');
    expect(fromSimple).not.toContain('simple_card');
    const fromEconomy = secondaryVizOptions(VIZ_MODES, 'economy_phases').map((v) => v.id);
    expect(fromEconomy).not.toContain('simple_card');
    expect(fromEconomy).toContain('before_after');
  });

  test('το μήνυμα απαιτήσεων εξηγεί τι λείπει ανά τρόπο', () => {
    const opts = { vizModes: VIZ_MODES, phaseLabel };
    expect(vizRequirementText('map_path', opts)).toMatch(/επεξεργαστή χάρτη/);
    expect(vizRequirementText('map_multi', opts)).toMatch(/2 σημεία/);
    expect(vizRequirementText('metrics_table', opts)).toMatch(/πίνακα αποτελεσμάτων/i);
    expect(vizRequirementText('before_after', opts)).toMatch(/Πριν, Μετά/);
    expect(vizRequirementText('after_only', opts)).toMatch(/Μετά/);
    expect(vizRequirementText('simple_card', opts)).toMatch(/φωτογραφ/i);
    expect(vizRequirementText('economy_phases', opts)).toMatch(/ποσ/i);
    expect(vizRequirementText('', opts)).toBe('');
  });

  test('κάθε τρόπος προβολής έχει ξεκάθαρο οδηγό (τι φαίνεται + τι χρειάζεται)', () => {
    const opts = { vizModes: VIZ_MODES, phaseLabel };
    for (const mode of VIZ_MODES) {
      const guide = vizUserGuide(mode.id, opts);
      expect(guide).toBeTruthy();
      expect(guide.shows.length).toBeGreaterThan(20);
      expect(guide.needs.length).toBeGreaterThan(10);
      expect(vizRequirementText(mode.id, opts)).toBe(guide.needs);
    }
    expect(vizUserGuide('economy_phases', opts).shows).toMatch(/δεν επαναλαμβάνονται μικρά/i);
    expect(vizUserGuide('simple_card', opts).shows).toMatch(/κυριαρχεί το σύντομο κείμενο/i);
    expect(vizUserGuide('', opts)).toBeNull();
    expect(vizUserGuide('άγνωστο', opts)).toBeNull();
  });

  test('τονισμός σύντομου κειμένου / ποσών ανά τρόπο', () => {
    expect(needsNarrativeEmphasis(['after_only'])).toBe(false);
    expect(needsNarrativeEmphasis(['simple_card'])).toBe(true);
    expect(needsNarrativeEmphasis(['before_after'])).toBe(false);
    expect(needsAmountsEmphasis(['economy_phases', 'map_path'])).toBe(true);
    expect(needsAmountsEmphasis(['after_only'])).toBe(false);
  });
});

describe('πίνακας αποτελεσμάτων (metrics)', () => {
  test('σταθερές στήλες και παράδειγμα βοήθειας', () => {
    expect(METRICS_COLUMNS.map((c) => c.title)).toEqual([
      'Δείκτης / αποτέλεσμα',
      'Τιμή',
    ]);
    expect(METRICS_EXAMPLE.columns).toHaveLength(2);
    expect(METRICS_EXAMPLE.rows.length).toBeGreaterThanOrEqual(3);
    expect(METRICS_EXAMPLE.note).toMatch(/δύο στήλες/i);
  });

  test('draft/clean/add/remove γραμμών', () => {
    expect(draftMetricsRows([])).toEqual([{ label: '', value: '' }]);
    expect(cleanMetricsRows([{ label: ' ', value: '' }, { label: 'Μήκος', value: '1 χλμ' }]))
      .toEqual([{ label: 'Μήκος', value: '1 χλμ' }]);
    const withTwo = addMetricsRow([{ label: 'Α', value: '1' }]);
    expect(withTwo).toHaveLength(2);
    expect(updateMetricsRow(withTwo, 1, { label: 'Β', value: '2' })[1]).toEqual({ label: 'Β', value: '2' });
    expect(removeMetricsRow(withTwo, 0)).toHaveLength(1);
    let full = [{ label: 'x', value: '1' }];
    for (let i = 0; i < METRICS_MAX_ROWS + 2; i += 1) full = addMetricsRow(full);
    expect(full).toHaveLength(METRICS_MAX_ROWS);
  });
});
