/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  emptyMapDrawing,
  normalizeMapDrawing,
  legacyMapPointsToDrawing,
  resolveCardMapDrawing,
  hasMapSnapshot,
  validateMapVizRequirements,
  countMapPointFeatures,
} = require('../../public/apologismosDomain');
const {
  ensureDirs,
  addFromSubproject,
  loadPeriods,
  saveMapSnapshot,
  resolveCardMediaAbsolute,
} = require('../../public/apologismosService');
const { buildVizContentPages } = require('../../public/apologismosPresentation');
const {
  geometryAnchorLatLng,
  defaultLabelLatLng,
  resolveLabelLatLng,
  normalizeLeaderStyle,
  leaderDashArray,
  normalizeLabelProperties,
} = require('./apologismosMapDrawing');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eh-apolog-map-'));
}

describe('mapDrawing GeoJSON & legacy', () => {
  test('empty / normalize', () => {
    expect(emptyMapDrawing()).toEqual({ type: 'FeatureCollection', features: [] });
    expect(normalizeMapDrawing(null).features).toEqual([]);
    expect(normalizeMapDrawing({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { label: 'Πλατεία' }, geometry: { type: 'Point', coordinates: [25, 35] } },
    ] }).features[0].properties.name).toBe('Πλατεία');
  });

  test('legacy mapPoints → GeoJSON points (αγνοεί 0,0)', () => {
    const d = legacyMapPointsToDrawing([
      { lat: 35.1, lng: 25.1, label: 'Α' },
      { lat: 0, lng: 0, label: 'άκυρο' },
      { lat: 35.2, lng: 25.2 },
    ]);
    expect(d.features).toHaveLength(2);
    expect(d.features[0].geometry.coordinates).toEqual([25.1, 35.1]);
    expect(d.features[1].properties.name).toMatch(/Σημείο/);
  });

  test('resolveCardMapDrawing προτιμά αποθηκευμένο σχέδιο από legacy', () => {
    const drawing = legacyMapPointsToDrawing([{ lat: 35, lng: 25, label: 'Νέο' }]);
    const card = {
      mapDrawing: drawing,
      mapPoints: [{ lat: 1, lng: 2, label: 'Παλιό' }],
    };
    expect(resolveCardMapDrawing(card).features[0].properties.name).toBe('Νέο');
    expect(resolveCardMapDrawing({ mapPoints: [{ lat: 35.5, lng: 25.5, label: 'Μόνο παλιό' }] })
      .features[0].properties.name).toBe('Μόνο παλιό');
  });
});

describe('readiness χάρτη με στιγμιότυπο', () => {
  test('χωρίς mapSnapshot δεν είναι ready', () => {
    const r = validateMapVizRequirements({
      mapPoints: [{ lat: 35.1, lng: 25.1, label: 'Α' }],
    }, { minPoints: 1 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/χάρτη/);
  });

  test('map_path: snapshot + γραμμή (χωρίς σημείο) είναι ok', () => {
    const r = validateMapVizRequirements({
      mapSnapshot: 'media/c/map/s.png',
      mapDrawing: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Διαδρομή' },
          geometry: { type: 'LineString', coordinates: [[25.1, 35.1], [25.2, 35.2]] },
        }],
      },
    }, { minPoints: 1 });
    expect(r.ok).toBe(true);
  });

  test('map_multi: απαιτεί ≥2 σημεία στο σχέδιο', () => {
    const one = validateMapVizRequirements({
      mapSnapshot: 'media/c/map/s.png',
      mapDrawing: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Α' },
          geometry: { type: 'Point', coordinates: [25.1, 35.1] },
        }],
      },
    }, { minPoints: 2 });
    expect(one.ok).toBe(false);

    const two = validateMapVizRequirements({
      mapSnapshot: 'media/c/map/s.png',
      mapDrawing: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { name: 'Α' }, geometry: { type: 'Point', coordinates: [25.1, 35.1] } },
          { type: 'Feature', properties: { name: 'Β' }, geometry: { type: 'Point', coordinates: [25.2, 35.2] } },
        ],
      },
    }, { minPoints: 2 });
    expect(two.ok).toBe(true);
    expect(countMapPointFeatures(two.drawing)).toBe(2);
  });

  test('hasMapSnapshot', () => {
    expect(hasMapSnapshot({ mapSnapshot: 'media/x.png' })).toBe(true);
    expect(hasMapSnapshot({ mapSnapshot: '  ' })).toBe(false);
    expect(hasMapSnapshot({})).toBe(false);
  });
});

describe('παρουσίαση χάρτη προτιμά στιγμιότυπο', () => {
  test('buildVizContentPages map περιλαμβάνει mapSnapshot', () => {
    const pages = buildVizContentPages({
      mapSnapshot: 'media/c/map/snap.png',
      mapPoints: [{ lat: 35.1, lng: 25.1, label: 'Α' }],
      photos: {},
    }, 'map_path', 'primary');
    expect(pages[0].type).toBe('map');
    expect(pages[0].mapSnapshot).toBe('media/c/map/snap.png');
  });
});

describe('saveMapSnapshot path guard & persistence', () => {
  test('αποθηκεύει PNG εντός φακέλου απολογισμού και ενημερώνει κάρτα', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const added = addFromSubproject(dataDir, {
        periodId: periods[0].id,
        subproject: {
          subprojectId: '33333333-3333-3333-3333-333333333333',
          projectId: '44444444-4444-4444-4444-444444444444',
          subprojectTitle: 'Χάρτης',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      const drawing = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Πλατεία' },
          geometry: { type: 'Point', coordinates: [25.16, 35.18] },
        }],
      };
      const saved = saveMapSnapshot(dataDir, {
        periodId: periods[0].id,
        cardId: added.card.id,
        dataUrl: `data:image/png;base64,${tinyPng.toString('base64')}`,
        mapDrawing: drawing,
      });
      expect(saved.success).toBe(true);
      expect(saved.relativePath).toMatch(/^media\/.+\/map\/snapshot_/);
      expect(saved.card.mapSnapshot).toBe(saved.relativePath);
      expect(saved.card.mapDrawing.features).toHaveLength(1);
      expect(saved.card.mapPoints[0].label).toBe('Πλατεία');
      const abs = resolveCardMediaAbsolute(dataDir, saved.relativePath);
      expect(abs).toBeTruthy();
      expect(fs.existsSync(abs)).toBe(true);
      expect(resolveCardMediaAbsolute(dataDir, '../secret.png')).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe('ετικέτες χάρτη: άγκυρα, θέση, γραμμή σύνδεσης', () => {
  test('geometryAnchorLatLng για σημείο / γραμμή / πολύγωνο', () => {
    expect(geometryAnchorLatLng({ type: 'Point', coordinates: [25.1, 35.2] }))
      .toEqual({ lat: 35.2, lng: 25.1 });
    expect(geometryAnchorLatLng({
      type: 'LineString',
      coordinates: [[25.0, 35.0], [25.2, 35.2], [25.4, 35.4]],
    })).toEqual({ lat: 35.2, lng: 25.2 });
    const poly = geometryAnchorLatLng({
      type: 'Polygon',
      coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    });
    expect(poly.lat).toBeCloseTo(0.8, 5);
    expect(poly.lng).toBeCloseTo(0.8, 5);
  });

  test('προεπιλεγμένη θέση ετικέτας είναι ΒΑ της άγκυρας· αποθηκευμένη θέση υπερισχύει', () => {
    const anchor = { lat: 35.0, lng: 25.0 };
    const def = defaultLabelLatLng(anchor);
    expect(def.lat).toBeGreaterThan(anchor.lat);
    expect(def.lng).toBeGreaterThan(anchor.lng);
    expect(resolveLabelLatLng({ labelLat: 35.5, labelLng: 25.5 }, { type: 'Point', coordinates: [25, 35] }))
      .toEqual({ lat: 35.5, lng: 25.5 });
  });

  test('normalizeLeaderStyle: χρώμα, πάχος, μορφή γραμμής', () => {
    expect(normalizeLeaderStyle({})).toEqual({
      leaderColor: '#ffffff',
      leaderWeight: 1.5,
      leaderDash: 'solid',
    });
    expect(normalizeLeaderStyle({
      leaderColor: '#ff0000',
      leaderWeight: 3,
      leaderDash: 'dashed',
    })).toEqual({
      leaderColor: '#ff0000',
      leaderWeight: 3,
      leaderDash: 'dashed',
    });
    expect(leaderDashArray('dashed')).toBe('8 6');
    expect(leaderDashArray('solid')).toBeNull();
    expect(leaderDashArray('dotted')).toBe('2 6');
  });

  test('normalizeLabelProperties κρατά θέση και στυλ γραμμής μαζί με το όνομα', () => {
    const props = normalizeLabelProperties({
      name: 'Πηγάδι',
      labelLat: 35.11,
      labelLng: 25.22,
      leaderColor: '#00ffaa',
      leaderWeight: 2,
      leaderDash: 'dashdot',
    }, { type: 'Point', coordinates: [25.22, 35.11] });
    expect(props.name).toBe('Πηγάδι');
    expect(props.labelLat).toBe(35.11);
    expect(props.labelLng).toBe(25.22);
    expect(props.leaderDash).toBe('dashdot');
    expect(props.leaderColor).toBe('#00ffaa');
  });

  test('domain normalizeMapDrawing διατηρεί ιδιότητες ετικέτας', () => {
    const d = normalizeMapDrawing({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'Διαδρομή',
          labelLat: 35.3,
          labelLng: 25.4,
          leaderColor: '#abcdef',
          leaderWeight: 2,
          leaderDash: 'dotted',
        },
        geometry: { type: 'LineString', coordinates: [[25.3, 35.2], [25.5, 35.4]] },
      }],
    });
    expect(d.features[0].properties.labelLat).toBe(35.3);
    expect(d.features[0].properties.leaderDash).toBe('dotted');
    expect(d.features[0].properties.leaderColor).toBe('#abcdef');
  });
});
