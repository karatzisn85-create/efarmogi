/**
 * Βοηθητικά για σχέδια χάρτη απολογισμού (GeoJSON + legacy σημεία).
 */

export function emptyMapDrawing() {
  return { type: 'FeatureCollection', features: [] };
}

export const LEADER_DASH_STYLES = Object.freeze([
  { id: 'solid', label: 'Συνεχής', dashArray: null },
  { id: 'dashed', label: 'Διακεκομμένη', dashArray: '8 6' },
  { id: 'dotted', label: 'Με κουκκίδες', dashArray: '2 6' },
  { id: 'dashdot', label: 'Παύλα–κουκκίδα', dashArray: '10 4 2 4' },
]);

export const DEFAULT_LEADER_STYLE = Object.freeze({
  leaderColor: '#ffffff',
  leaderWeight: 1.5,
  leaderDash: 'solid',
});

export function normalizeLeaderStyle(props = {}) {
  const color = String(props.leaderColor || DEFAULT_LEADER_STYLE.leaderColor).trim() || DEFAULT_LEADER_STYLE.leaderColor;
  let weight = Number(props.leaderWeight);
  if (!Number.isFinite(weight) || weight < 0.5) weight = DEFAULT_LEADER_STYLE.leaderWeight;
  if (weight > 8) weight = 8;
  const dashId = LEADER_DASH_STYLES.some((d) => d.id === props.leaderDash)
    ? props.leaderDash
    : DEFAULT_LEADER_STYLE.leaderDash;
  return { leaderColor: color, leaderWeight: weight, leaderDash: dashId };
}

export function leaderDashArray(dashId) {
  return LEADER_DASH_STYLES.find((d) => d.id === dashId)?.dashArray || null;
}

/** Άγκυρα σύνδεσης ετικέτας πάνω στη γεωμετρία (lat/lng). */
export function geometryAnchorLatLng(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return null;
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates || [];
    if (!coords.length) return null;
    const mid = coords[Math.floor((coords.length - 1) / 2)];
    const [lng, lat] = mid || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates?.[0] || [];
    if (!ring.length) return null;
    let sumLat = 0;
    let sumLng = 0;
    let n = 0;
    ring.forEach(([lng, lat]) => {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        sumLat += lat;
        sumLng += lng;
        n += 1;
      }
    });
    if (!n) return null;
    return { lat: sumLat / n, lng: sumLng / n };
  }
  return null;
}

/** Προεπιλεγμένη θέση ετικέτας λίγο ΒΑ της άγκυρας. */
export function defaultLabelLatLng(anchor, { dLat = 0.0012, dLng = 0.0015 } = {}) {
  if (!anchor) return null;
  return { lat: anchor.lat + dLat, lng: anchor.lng + dLng };
}

export function resolveLabelLatLng(properties, geometry) {
  const props = properties || {};
  const lat = Number(props.labelLat);
  const lng = Number(props.labelLng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }
  const anchor = geometryAnchorLatLng(geometry);
  return defaultLabelLatLng(anchor);
}

export function normalizeLabelProperties(props = {}, geometry = null) {
  const name = String(props.name || props.label || '').trim();
  const leader = normalizeLeaderStyle(props);
  const labelPos = name ? resolveLabelLatLng(props, geometry) : null;
  return {
    ...props,
    name,
    ...leader,
    labelLat: labelPos ? labelPos.lat : null,
    labelLng: labelPos ? labelPos.lng : null,
  };
}

export function normalizeMapDrawing(drawing) {
  if (!drawing || drawing.type !== 'FeatureCollection' || !Array.isArray(drawing.features)) {
    return emptyMapDrawing();
  }
  const features = drawing.features
    .filter((f) => f && f.type === 'Feature' && f.geometry && f.geometry.type)
    .map((f, i) => ({
      type: 'Feature',
      id: f.id != null ? f.id : `f-${i}`,
      properties: normalizeLabelProperties(
        f.properties && typeof f.properties === 'object' ? f.properties : {},
        f.geometry
      ),
      geometry: f.geometry,
    }));
  return { type: 'FeatureCollection', features };
}

export function legacyMapPointsToDrawing(points) {
  const features = [];
  (Array.isArray(points) ? points : []).forEach((p, i) => {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
    features.push({
      type: 'Feature',
      id: `legacy-point-${i}`,
      properties: { name: String(p.label || `Σημείο ${i + 1}`).trim() },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  });
  return { type: 'FeatureCollection', features };
}

export function resolveCardMapDrawing(card) {
  const fromStored = normalizeMapDrawing(card?.mapDrawing);
  if (fromStored.features.length > 0) return fromStored;
  return legacyMapPointsToDrawing(card?.mapPoints);
}

export function countMapPointFeatures(drawing) {
  return normalizeMapDrawing(drawing).features
    .filter((f) => f.geometry?.type === 'Point').length;
}

export function countMapDrawableFeatures(drawing) {
  return normalizeMapDrawing(drawing).features
    .filter((f) => (
      f.geometry?.type === 'Point'
      || f.geometry?.type === 'LineString'
      || f.geometry?.type === 'Polygon'
    )).length;
}

export function hasMapSnapshot(card) {
  return Boolean(card?.mapSnapshot && String(card.mapSnapshot).trim());
}

/** Προεπιλεγμένο κέντρο: Δήμος Αρχανών–Αστερουσίων (Κρήτη). */
export const DEFAULT_MAP_CENTER = Object.freeze({ lat: 35.18, lng: 25.16, zoom: 11 });

export function boundsFromDrawing(drawing) {
  const coords = [];
  const walk = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      coords.push([c[1], c[0]]); // lat, lng
      return;
    }
    c.forEach(walk);
  };
  normalizeMapDrawing(drawing).features.forEach((f) => {
    if (f.geometry?.coordinates) walk(f.geometry.coordinates);
  });
  return coords;
}
