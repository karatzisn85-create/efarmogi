import React, { useEffect, useRef } from 'react';
import { createGlobalStyle } from 'styled-components';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  DEFAULT_MAP_CENTER,
  boundsFromDrawing,
  normalizeMapDrawing,
  normalizeMapView,
  geometryAnchorLatLng,
  resolveLabelLatLng,
  normalizeLeaderStyle,
  leaderDashArray,
} from '../utils/apologismosMapDrawing';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ESRI_SAT = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Πλακίδια © Esri',
  maxZoom: 19,
};

const LabelStyles = createGlobalStyle`
  .apolog-live-map-label-icon {
    background: transparent !important;
    border: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .apolog-live-map-label-wrap {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: max-content;
    pointer-events: none;
    user-select: none;
    transform: translate(0, -50%);
  }
  .apolog-live-map-label-info {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #818cf8 0%, #4f46e5 55%, #3730a3 100%);
    border: 2px solid rgba(255, 255, 255, 0.92);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.45);
    color: #fff;
  }
  .apolog-live-map-label-info svg {
    width: 11px;
    height: 11px;
    display: block;
  }
  .apolog-live-map-label-text {
    font: 700 12px/1.25 "Segoe UI", system-ui, sans-serif;
    color: #fff;
    white-space: nowrap;
    text-shadow:
      0 1px 2px rgba(15, 23, 42, 0.95),
      0 0 6px rgba(15, 23, 42, 0.85);
  }
`;

const INFO_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="7" r="2.15" fill="currentColor"/>
  <rect x="10.7" y="11" width="2.6" height="8.2" rx="1.3" fill="currentColor"/>
</svg>
`.replace(/\s+/g, ' ').trim();

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeLabelIcon(name) {
  return L.divIcon({
    className: 'apolog-live-map-label-icon',
    html: `
      <div class="apolog-live-map-label-wrap">
        <span class="apolog-live-map-label-info">${INFO_ICON_SVG}</span>
        <span class="apolog-live-map-label-text">${escapeHtml(name)}</span>
      </div>
    `.trim(),
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function applyInitialView(map, drawing, mapView) {
  const savedView = normalizeMapView(mapView);
  if (savedView) {
    map.setView([savedView.lat, savedView.lng], savedView.zoom, { animate: false });
    return;
  }
  const b = boundsFromDrawing(drawing);
  if (b.length >= 2) {
    map.fitBounds(L.latLngBounds(b), { padding: [36, 36], maxZoom: 17, animate: false });
    return;
  }
  if (b.length === 1) {
    map.setView(b[0], 16, { animate: false });
    return;
  }
  map.setView(
    [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
    DEFAULT_MAP_CENTER.zoom,
    { animate: false }
  );
}

/**
 * Ζωντανός χάρτης μόνο για παρουσίαση οθόνης (χωρίς επεξεργασία).
 * PDF/PPTX συνεχίζουν να χρησιμοποιούν το αποθηκευμένο στιγμιότυπο.
 */
export default function ApologismosLiveMap({
  mapDrawing,
  mapView,
  style,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;

    const drawing = normalizeMapDrawing(mapDrawing);
    const map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
    });
    mapRef.current = map;

    L.tileLayer(ESRI_SAT.url, {
      attribution: ESRI_SAT.attribution,
      maxZoom: ESRI_SAT.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const drawn = L.featureGroup().addTo(map);
    const labels = L.layerGroup().addTo(map);

    if (drawing.features.length) {
      L.geoJSON(drawing, {
        style: () => ({
          color: '#38bdf8',
          weight: 3,
          fillOpacity: 0.25,
        }),
        pointToLayer: (_feature, latlng) => L.marker(latlng),
        onEachFeature: (feature, layer) => {
          drawn.addLayer(layer);
          const props = feature.properties || {};
          const name = String(props.name || props.label || '').trim();
          if (!name) return;
          const geometry = feature.geometry;
          const anchor = geometryAnchorLatLng(geometry);
          const labelPos = resolveLabelLatLng(props, geometry);
          if (!labelPos) return;
          const leader = normalizeLeaderStyle(props);
          const dash = leaderDashArray(leader.leaderDash);
          if (anchor) {
            const leaderLine = L.polyline(
              [[labelPos.lat, labelPos.lng], [anchor.lat, anchor.lng]],
              {
                color: leader.leaderColor,
                weight: leader.leaderWeight,
                dashArray: dash || undefined,
                opacity: 0.95,
                interactive: false,
              }
            );
            labels.addLayer(leaderLine);
          }
          const marker = L.marker([labelPos.lat, labelPos.lng], {
            icon: makeLabelIcon(name),
            interactive: false,
            keyboard: false,
          });
          labels.addLayer(marker);
        },
      });
    }

    applyInitialView(map, drawing, mapView);

    const resize = () => {
      try {
        map.invalidateSize(false);
        applyInitialView(map, drawing, mapView);
      } catch (_) { /* ignore */ }
    };
    const t1 = setTimeout(resize, 40);
    const t2 = setTimeout(resize, 220);
    window.addEventListener('resize', resize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', resize);
      mapRef.current = null;
      try { map.remove(); } catch (_) { /* ignore */ }
    };
  }, [mapDrawing, mapView]);

  return (
    <>
      <LabelStyles />
      <div
        ref={hostRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#1e293b',
          ...style,
        }}
      />
    </>
  );
}

/** true αν υπάρχει σχέδιο για ζωντανή προβολή και δεν υπάρχει διαθέσιμο αποθηκευμένο στιγμιότυπο. */
export function canShowLiveMap(page, mediaUrls = {}) {
  const drawing = normalizeMapDrawing(page?.mapDrawing);
  if (!drawing.features.length) return false;
  const snap = page?.mapSnapshot;
  if (snap && mediaUrls?.[snap]) return false;
  return true;
}
