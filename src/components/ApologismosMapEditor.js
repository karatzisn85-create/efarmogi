import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import html2canvas from 'html2canvas';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  DEFAULT_MAP_CENTER,
  boundsFromDrawing,
  resolveCardMapDrawing,
  normalizeMapDrawing,
  geometryAnchorLatLng,
  resolveLabelLatLng,
  normalizeLeaderStyle,
  normalizeLabelProperties,
  LEADER_DASH_STYLES,
  leaderDashArray,
  DEFAULT_LEADER_STYLE,
} from '../utils/apologismosMapDrawing';

// Διόρθωση εικονιδίων σημείων στο webpack/CRA
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

const OSM_STREET = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap',
  maxZoom: 19,
};

const LabelStyles = createGlobalStyle`
  .apolog-map-label-icon {
    background: transparent !important;
    border: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .apolog-map-label-wrap {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: max-content;
    max-width: none;
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    transform: translate(0, -50%);
  }
  .apolog-map-label-wrap:active { cursor: grabbing; }
  .apolog-map-label-info {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, #818cf8 0%, #4f46e5 55%, #3730a3 100%);
    border: 2px solid rgba(255, 255, 255, 0.92);
    box-shadow:
      0 0 0 1px rgba(49, 46, 129, 0.35),
      0 4px 12px rgba(15, 23, 42, 0.45);
    color: #fff;
  }
  .apolog-map-label-info svg {
    width: 12px;
    height: 12px;
    display: block;
  }
  .apolog-map-label-text {
    font: 700 13px/1.25 "Segoe UI", system-ui, sans-serif;
    letter-spacing: 0.01em;
    color: #fff;
    white-space: nowrap;
    text-shadow:
      0 1px 2px rgba(15, 23, 42, 0.95),
      0 0 6px rgba(15, 23, 42, 0.85),
      0 0 1px rgba(15, 23, 42, 1);
  }
`;

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Κλασικό εικονίδιο πληροφοριών (κουκκίδα + στέλεχος), όχι σκέτο γράμμα. */
const INFO_ICON_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="7" r="2.15" fill="currentColor"/>
  <rect x="10.7" y="11" width="2.6" height="8.2" rx="1.3" fill="currentColor"/>
</svg>
`.replace(/\s+/g, ' ').trim();

function makeLabelIcon(name) {
  return L.divIcon({
    className: 'apolog-map-label-icon',
    html: `
      <div class="apolog-map-label-wrap" title="Σύρετε για μετακίνηση ετικέτας">
        <span class="apolog-map-label-info">${INFO_ICON_SVG}</span>
        <span class="apolog-map-label-text">${escapeHtml(name)}</span>
      </div>
    `.trim(),
    // 0×0 ώστε το Leaflet να μην κόβει το περιεχόμενο σε μικρό κουτί
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1600;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 1vh 1vw;
`;

const Shell = styled.div`
  width: 96vw; height: 92vh;
  background: #f1f5f9; border-radius: 18px; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 30px 90px rgba(2, 6, 23, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.4);
`;

const TopBar = styled.div`
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.85rem 1.15rem;
  background: linear-gradient(120deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%);
  color: #fff;
`;

const TitleBlock = styled.div`min-width: 0; flex: 1;`;
const Title = styled.div`
  font-size: 1.08rem; font-weight: 800; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
`;
const Sub = styled.div`font-size: 0.74rem; opacity: 0.9; font-weight: 600; margin-top: 3px;`;

const TopActions = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;`;

const Btn = styled.button`
  font-family: inherit; cursor: pointer; border-radius: 11px;
  padding: 0.55rem 1.05rem; font-size: 0.84rem; font-weight: 700;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.12); color: #fff;
  &:hover:not(:disabled) { background: rgba(255,255,255,0.24); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #22d3ee, #38bdf8); color: #0f172a; border-color: transparent;
  box-shadow: 0 6px 18px rgba(34, 211, 238, 0.35);
  &:hover:not(:disabled) { background: linear-gradient(135deg, #67e8f9, #7dd3fc); }
`;

const SideBtn = styled.button`
  font-family: inherit; cursor: pointer; border-radius: 11px;
  padding: 0.55rem 0.9rem; font-size: 0.82rem; font-weight: 700;
  border: 1px solid #e2e8f0; background: #fff; color: #334155; width: 100%;
  &:hover:not(:disabled) { border-color: #a5b4fc; background: #f8fafc; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const SidePrimaryBtn = styled(SideBtn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-color: transparent;
  &:hover:not(:disabled) { background: linear-gradient(135deg, #818cf8, #6366f1); }
`;

const Body = styled.div`
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
`;

const MapPane = styled.div`
  position: relative; min-width: 0; min-height: 0;
  .leaflet-container { width: 100%; height: 100%; background: #1e293b; }
  .leaflet-pm-toolbar { display: none !important; }
`;

const ToolDock = styled.div`
  position: absolute; z-index: 900; left: 12px; top: 12px; right: 12px;
  display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
  pointer-events: none;
`;

const ToolGroup = styled.div`
  pointer-events: auto;
  display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 14px;
  padding: 0.4rem;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
`;

const ToolLabel = styled.span`
  font-size: 0.66rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.05em; color: #64748b; padding: 0 0.35rem;
`;

const ToolBtn = styled.button`
  font-family: inherit; cursor: pointer;
  border-radius: 10px; padding: 0.42rem 0.7rem;
  font-size: 0.78rem; font-weight: 700;
  border: 1px solid ${p => (p.$on ? 'transparent' : '#e2e8f0')};
  background: ${p => (p.$on
    ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
    : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#334155')};
  box-shadow: ${p => (p.$on ? '0 4px 12px rgba(79,70,229,0.35)' : 'none')};
  &:hover { border-color: ${p => (p.$on ? 'transparent' : '#a5b4fc')}; }
`;

const StatusChip = styled.div`
  pointer-events: auto;
  margin-left: auto;
  font-size: 0.74rem; font-weight: 700;
  padding: 0.42rem 0.75rem; border-radius: 999px;
  background: ${p => (p.$ok ? 'rgba(16,185,129,0.92)' : 'rgba(245,158,11,0.92)')};
  color: #fff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
`;

const Side = styled.aside`
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  border-left: 1px solid #e2e8f0;
  display: flex; flex-direction: column; min-height: 0;
`;

const SideScroll = styled.div`
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 0.85rem; display: flex; flex-direction: column; gap: 0.7rem;
`;

const SideFooter = styled.div`
  flex-shrink: 0; padding: 0.75rem 0.85rem;
  border-top: 1px solid #e2e8f0;
  background: rgba(255,255,255,0.9);
  display: flex; flex-direction: column; gap: 0.45rem;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  padding: 0.75rem 0.8rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
`;

const CardTitle = styled.div`
  font-size: 0.78rem; font-weight: 800; color: #312e81;
  letter-spacing: 0.02em; margin-bottom: 0.45rem;
  display: flex; align-items: center; gap: 0.4rem;
`;

const StepNum = styled.span`
  width: 20px; height: 20px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff; font-size: 0.7rem; font-weight: 800;
  display: inline-flex; align-items: center; justify-content: center;
`;

const Hint = styled.div`font-size: 0.76rem; color: #64748b; line-height: 1.45;`;
const Err = styled.div`
  font-size: 0.8rem; color: #b91c1c; font-weight: 700;
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 0.55rem 0.7rem;
`;
const Ok = styled.div`
  font-size: 0.78rem; color: #047857; font-weight: 700;
  background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 0.45rem 0.65rem;
`;

const Field = styled.label`
  display: block; font-size: 0.76rem; font-weight: 700; color: #475569; margin: 0.45rem 0 0.28rem;
`;

const Input = styled.input`
  width: 100%; box-sizing: border-box; font-family: inherit;
  border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.55rem 0.75rem;
  font-size: 0.9rem; background: #fff;
  &:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
  &:disabled { background: #f8fafc; color: #94a3b8; }
`;

const Select = styled.select`
  width: 100%; box-sizing: border-box; font-family: inherit;
  border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.55rem 0.75rem;
  font-size: 0.88rem; background: #fff;
  &:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
  &:disabled { background: #f8fafc; color: #94a3b8; }
`;

const ColorRow = styled.div`display: flex; gap: 0.45rem; align-items: center;`;

const SegRow = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem;
`;

const SegBtn = styled.button`
  font-family: inherit; cursor: pointer;
  border-radius: 10px; padding: 0.5rem 0.55rem;
  font-size: 0.78rem; font-weight: 700;
  border: 1px solid ${p => (p.$on ? 'transparent' : '#e2e8f0')};
  background: ${p => (p.$on ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#475569')};
`;

const FeatureList = styled.div`display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.35rem;`;

const FeatureItem = styled.button`
  font-family: inherit; cursor: pointer; text-align: left;
  border: 1px solid ${p => (p.$on ? '#6366f1' : '#e2e8f0')};
  background: ${p => (p.$on ? '#eef2ff' : '#fff')};
  border-radius: 11px; padding: 0.55rem 0.65rem;
  font-size: 0.8rem;
  display: flex; flex-direction: column; gap: 2px;
`;

const FeatureType = styled.span`
  font-size: 0.66rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.04em; color: ${p => (p.$on ? '#4338ca' : '#94a3b8')};
`;

const EmptyBox = styled.div`
  text-align: center; padding: 0.85rem 0.5rem;
  border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; font-size: 0.8rem; line-height: 1.4;
`;

const HelpList = styled.ol`
  margin: 0; padding-left: 1.15rem; color: #475569; font-size: 0.78rem; line-height: 1.5;
  li { margin-bottom: 0.25rem; }
`;

function featureTypeLabel(type) {
  if (type === 'Point') return 'Σημείο';
  if (type === 'LineString') return 'Γραμμή / διαδρομή';
  if (type === 'Polygon') return 'Περιοχή';
  return type || 'Στοιχείο';
}

function ensureFeatureProps(layer) {
  if (!layer.feature) {
    layer.feature = { type: 'Feature', properties: { ...DEFAULT_LEADER_STYLE, name: '' }, geometry: null };
  }
  if (!layer.feature.properties) layer.feature.properties = { ...DEFAULT_LEADER_STYLE, name: '' };
  return layer.feature.properties;
}

function getLayerGeometry(layer) {
  try {
    const gj = layer.toGeoJSON?.();
    if (gj?.type === 'Feature') return gj.geometry;
    if (gj?.type === 'FeatureCollection' && gj.features?.[0]) return gj.features[0].geometry;
  } catch (_) { /* ignore */ }
  return layer.feature?.geometry || null;
}

function waitForTiles(map, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      map.off('load', onLoad);
      resolve();
    };
    const onLoad = () => { setTimeout(finish, 350); };
    map.whenReady(() => {
      setTimeout(() => { if (!settled) onLoad(); }, 600);
    });
    map.on('load', onLoad);
    setTimeout(finish, timeoutMs);
  });
}

/**
 * @param {{ open: boolean, card: object, onClose: function, onSaved: function }} props
 */
export default function ApologismosMapEditor({
  open,
  card,
  username,
  periodId,
  onClose,
  onSaved,
  showToast,
}) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const drawnRef = useRef(null);
  const labelsRef = useRef(null);
  const labelMapRef = useRef(new Map());
  const selectedLayerRef = useRef(null);
  const [baseLayer, setBaseLayer] = useState('sat');
  const [tilesReady, setTilesReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [leaderColor, setLeaderColor] = useState(DEFAULT_LEADER_STYLE.leaderColor);
  const [leaderWeight, setLeaderWeight] = useState(DEFAULT_LEADER_STYLE.leaderWeight);
  const [leaderDash, setLeaderDash] = useState(DEFAULT_LEADER_STYLE.leaderDash);
  const [featureTick, setFeatureTick] = useState(0);
  const [activeTool, setActiveTool] = useState('pan');

  const refreshFeatureList = useCallback(() => {
    setFeatureTick((n) => n + 1);
  }, []);

  const removeLabelDecoration = useCallback((layer) => {
    const entry = labelMapRef.current.get(layer);
    const labels = labelsRef.current;
    if (!entry || !labels) {
      labelMapRef.current.delete(layer);
      return;
    }
    try {
      if (entry.marker) labels.removeLayer(entry.marker);
      if (entry.leader) labels.removeLayer(entry.leader);
    } catch (_) { /* ignore */ }
    labelMapRef.current.delete(layer);
  }, []);

  const upsertLabelDecoration = useCallback((layer) => {
    const map = mapRef.current;
    const labels = labelsRef.current;
    if (!map || !labels || !layer) return;

    const props = ensureFeatureProps(layer);
    const name = String(props.name || '').trim();
    const geometry = getLayerGeometry(layer);
    if (!name || !geometry) {
      removeLabelDecoration(layer);
      return;
    }

    const leader = normalizeLeaderStyle(props);
    const anchor = geometryAnchorLatLng(geometry);
    if (!anchor) {
      removeLabelDecoration(layer);
      return;
    }
    const labelPos = resolveLabelLatLng(props, geometry);
    props.labelLat = labelPos.lat;
    props.labelLng = labelPos.lng;
    Object.assign(props, leader);

    let entry = labelMapRef.current.get(layer);
    const dash = leaderDashArray(leader.leaderDash);
    const pathOpts = {
      color: leader.leaderColor,
      weight: leader.leaderWeight,
      opacity: 0.95,
      dashArray: dash || undefined,
      interactive: false,
      className: 'apolog-map-leader',
    };

    if (!entry) {
      const leaderLine = L.polyline([[labelPos.lat, labelPos.lng], [anchor.lat, anchor.lng]], pathOpts);
      const marker = L.marker([labelPos.lat, labelPos.lng], {
        icon: makeLabelIcon(name),
        draggable: true,
        zIndexOffset: 800,
        keyboard: false,
      });
      marker.on('drag', () => {
        const ll = marker.getLatLng();
        leaderLine.setLatLngs([[ll.lat, ll.lng], [anchor.lat, anchor.lng]]);
      });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        const p = ensureFeatureProps(layer);
        p.labelLat = ll.lat;
        p.labelLng = ll.lng;
        const a = geometryAnchorLatLng(getLayerGeometry(layer));
        if (a) leaderLine.setLatLngs([[ll.lat, ll.lng], [a.lat, a.lng]]);
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectedLayerRef.current = layer;
        const p = ensureFeatureProps(layer);
        setSelectedName(p.name || '');
        const st = normalizeLeaderStyle(p);
        setLeaderColor(st.leaderColor);
        setLeaderWeight(st.leaderWeight);
        setLeaderDash(st.leaderDash);
        refreshFeatureList();
      });
      labels.addLayer(leaderLine);
      labels.addLayer(marker);
      entry = { marker, leader: leaderLine };
      labelMapRef.current.set(layer, entry);
    } else {
      entry.marker.setLatLng([labelPos.lat, labelPos.lng]);
      entry.marker.setIcon(makeLabelIcon(name));
      entry.leader.setLatLngs([[labelPos.lat, labelPos.lng], [anchor.lat, anchor.lng]]);
      entry.leader.setStyle(pathOpts);
      // Ανανέωση drag handler με νέα άγκυρα
      entry.marker.off('drag');
      entry.marker.on('drag', () => {
        const ll = entry.marker.getLatLng();
        const a = geometryAnchorLatLng(getLayerGeometry(layer)) || anchor;
        entry.leader.setLatLngs([[ll.lat, ll.lng], [a.lat, a.lng]]);
      });
    }
  }, [refreshFeatureList, removeLabelDecoration]);

  const syncLabelToGeometry = useCallback((layer) => {
    const entry = labelMapRef.current.get(layer);
    if (!entry) {
      upsertLabelDecoration(layer);
      return;
    }
    const props = ensureFeatureProps(layer);
    const geometry = getLayerGeometry(layer);
    const anchor = geometryAnchorLatLng(geometry);
    if (!anchor || !props.name) {
      removeLabelDecoration(layer);
      return;
    }
    const ll = entry.marker.getLatLng();
    props.labelLat = ll.lat;
    props.labelLng = ll.lng;
    entry.leader.setLatLngs([[ll.lat, ll.lng], [anchor.lat, anchor.lng]]);
  }, [removeLabelDecoration, upsertLabelDecoration]);

  const listFeatures = () => {
    const group = drawnRef.current;
    if (!group) return [];
    const out = [];
    group.eachLayer((layer) => {
      const gj = layer.toGeoJSON?.();
      const type = gj?.geometry?.type || layer.feature?.geometry?.type || '?';
      const name = layer.feature?.properties?.name || gj?.properties?.name || '';
      out.push({ layer, type, name });
    });
    return out;
  };

  useEffect(() => {
    if (!open || !mapElRef.current) return undefined;

    const map = L.map(mapElRef.current, {
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    const sat = L.tileLayer(ESRI_SAT.url, {
      attribution: ESRI_SAT.attribution,
      maxZoom: ESRI_SAT.maxZoom,
      crossOrigin: true,
    });
    const street = L.tileLayer(OSM_STREET.url, {
      attribution: OSM_STREET.attribution,
      maxZoom: OSM_STREET.maxZoom,
      crossOrigin: true,
    });
    sat.addTo(map);
    map._apologLayers = { sat, street };

    const drawn = L.featureGroup().addTo(map);
    const labels = L.layerGroup().addTo(map);
    drawnRef.current = drawn;
    labelsRef.current = labels;
    labelMapRef.current = new Map();

    // Χωρίς την προεπιλεγμένη μπάρα Geoman — χρησιμοποιούμε ελληνικά κουμπιά
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawPolyline: false,
      drawPolygon: false,
      drawRectangle: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    });
    map.pm.setGlobalOptions({
      layerGroup: drawn,
      snappable: true,
      snapDistance: 15,
      pathOptions: { color: '#38bdf8', weight: 3, fillOpacity: 0.25 },
      continueDrawing: false,
    });
    setActiveTool('pan');

    const selectLayer = (layer) => {
      selectedLayerRef.current = layer;
      const p = ensureFeatureProps(layer);
      setSelectedName(p.name || '');
      const st = normalizeLeaderStyle(p);
      setLeaderColor(st.leaderColor);
      setLeaderWeight(st.leaderWeight);
      setLeaderDash(st.leaderDash);
      refreshFeatureList();
    };

    map.on('pm:create', (e) => {
      const layer = e.layer;
      ensureFeatureProps(layer);
      selectLayer(layer);
      refreshFeatureList();
      // Μετά το σχέδιο επιστρέφουμε σε «επιλογή» για να ονοματίσει αμέσως
      try {
        map.pm.disableDraw();
        map.pm.disableGlobalEditMode();
        map.pm.disableGlobalDragMode();
        map.pm.disableGlobalRemovalMode();
      } catch (_) { /* ignore */ }
      setActiveTool('pan');
    });
    map.on('pm:remove', (e) => {
      if (e?.layer) removeLabelDecoration(e.layer);
      if (selectedLayerRef.current === e?.layer) {
        selectedLayerRef.current = null;
        setSelectedName('');
        setLeaderColor(DEFAULT_LEADER_STYLE.leaderColor);
        setLeaderWeight(DEFAULT_LEADER_STYLE.leaderWeight);
        setLeaderDash(DEFAULT_LEADER_STYLE.leaderDash);
      }
      refreshFeatureList();
    });
    map.on('pm:edit', (e) => {
      if (e?.layer) syncLabelToGeometry(e.layer);
    });
    map.on('pm:dragend', (e) => {
      if (e?.layer) syncLabelToGeometry(e.layer);
    });
    drawn.on('click', (e) => {
      if (e.layer) selectLayer(e.layer);
    });

    const initial = resolveCardMapDrawing(card);
    if (initial.features.length) {
      L.geoJSON(initial, {
        onEachFeature: (feature, layer) => {
          layer.feature = {
            type: 'Feature',
            properties: normalizeLabelProperties(feature.properties || {}, feature.geometry),
            geometry: feature.geometry,
          };
          layer.on('click', () => selectLayer(layer));
          drawn.addLayer(layer);
          upsertLabelDecoration(layer);
        },
      });
      const b = boundsFromDrawing(initial);
      if (b.length >= 2) {
        map.fitBounds(L.latLngBounds(b), { padding: [40, 40], maxZoom: 16 });
      } else if (b.length === 1) {
        map.setView(b[0], 15);
      } else {
        map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);
      }
    } else {
      map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);
    }

    setTilesReady(false);
    waitForTiles(map).then(() => setTilesReady(true));
    setTimeout(() => map.invalidateSize(), 80);
    refreshFeatureList();

    return () => {
      labelMapRef.current.clear();
      map.remove();
      mapRef.current = null;
      drawnRef.current = null;
      labelsRef.current = null;
      selectedLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map._apologLayers) return;
    const { sat, street } = map._apologLayers;
    if (baseLayer === 'sat') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (!map.hasLayer(street)) street.addTo(map);
    }
    setTilesReady(false);
    waitForTiles(map).then(() => setTilesReady(true));
  }, [baseLayer]);

  const applySelectedName = () => {
    const layer = selectedLayerRef.current;
    if (!layer) return;
    const p = ensureFeatureProps(layer);
    p.name = String(selectedName || '').trim();
    upsertLabelDecoration(layer);
    refreshFeatureList();
  };

  const applyLeaderStyle = (patch) => {
    const layer = selectedLayerRef.current;
    if (!layer) return;
    const p = ensureFeatureProps(layer);
    Object.assign(p, normalizeLeaderStyle({ ...p, ...patch }));
    if (patch.leaderColor != null) setLeaderColor(p.leaderColor);
    if (patch.leaderWeight != null) setLeaderWeight(p.leaderWeight);
    if (patch.leaderDash != null) setLeaderDash(p.leaderDash);
    upsertLabelDecoration(layer);
  };

  const activateTool = (tool) => {
    const map = mapRef.current;
    if (!map?.pm) return;
    try {
      map.pm.disableDraw();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalRemovalMode();
    } catch (_) { /* ignore */ }

    if (tool === 'marker') map.pm.enableDraw('Marker');
    else if (tool === 'line') map.pm.enableDraw('Line');
    else if (tool === 'polygon') map.pm.enableDraw('Polygon');
    else if (tool === 'edit') map.pm.enableGlobalEditMode();
    else if (tool === 'drag') map.pm.enableGlobalDragMode();
    else if (tool === 'remove') map.pm.enableGlobalRemovalMode();

    setActiveTool(tool);
  };

  const selectFeatureFromList = (layer) => {
    selectedLayerRef.current = layer;
    const p = ensureFeatureProps(layer);
    setSelectedName(p.name || '');
    const st = normalizeLeaderStyle(p);
    setLeaderColor(st.leaderColor);
    setLeaderWeight(st.leaderWeight);
    setLeaderDash(st.leaderDash);
    refreshFeatureList();
    activateTool('pan');
    try {
      if (layer.getBounds) {
        mapRef.current?.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 17 });
      } else if (layer.getLatLng) {
        mapRef.current?.setView(layer.getLatLng(), 16);
      }
    } catch (_) { /* ignore */ }
  };

  const collectDrawing = () => {
    const group = drawnRef.current;
    if (!group) return normalizeMapDrawing(null);
    const features = [];
    group.eachLayer((layer) => {
      const gj = layer.toGeoJSON();
      if (!gj) return;
      const props = ensureFeatureProps(layer);
      const pushFeature = (f) => {
        features.push({
          ...f,
          properties: normalizeLabelProperties(
            { ...(f.properties || {}), ...props },
            f.geometry
          ),
        });
      };
      if (gj.type === 'FeatureCollection') {
        (gj.features || []).forEach(pushFeature);
      } else if (gj.type === 'Feature') {
        pushFeature(gj);
      }
    });
    return normalizeMapDrawing({ type: 'FeatureCollection', features });
  };

  const handleSave = async () => {
    if (!mapRef.current || !mapElRef.current) return;
    setError('');
    const drawing = collectDrawing();
    if (drawing.features.length === 0) {
      setError('Τοποθετήστε τουλάχιστον ένα σημείο, γραμμή ή περιοχή πριν την αποθήκευση.');
      return;
    }
    if (!tilesReady) {
      setError('Περιμένετε να φορτώσει πλήρως ο χάρτης…');
      await waitForTiles(mapRef.current);
      setTilesReady(true);
    }
    setSaving(true);
    try {
      const controls = mapElRef.current.querySelectorAll('.leaflet-pm-toolbar, .leaflet-control-zoom, .leaflet-control-attribution');
      controls.forEach((el) => { el.style.visibility = 'hidden'; });
      await waitForTiles(mapRef.current, 5000);
      const canvas = await html2canvas(mapElRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0f172a',
        logging: false,
        scale: 1,
      });
      controls.forEach((el) => { el.style.visibility = ''; });
      const dataUrl = canvas.toDataURL('image/png');
      const ipc = window.electronAPI;
      const res = await ipc.invoke('apologismos-save-map-snapshot', {
        actingUsername: username,
        periodId,
        cardId: card.id,
        dataUrl,
        mapDrawing: drawing,
      });
      if (!res?.success) {
        setError(res?.error || 'Αποτυχία αποθήκευσης χάρτη');
        return;
      }
      if (showToast) showToast('Ο χάρτης αποθηκεύτηκε', 'success');
      if (onSaved) onSaved(res);
      if (onClose) onClose();
    } catch (e) {
      setError(e?.message || 'Αποτυχία αποθήκευσης χάρτη');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const features = listFeatures();
  void featureTick;
  const hasSelection = Boolean(selectedLayerRef.current);
  const hasNamedSelection = hasSelection && String(selectedName || '').trim();
  const unnamedCount = features.filter((f) => !String(f.name || '').trim()).length;

  const toolHint = (() => {
    if (activeTool === 'marker') return 'Κάντε κλικ στον χάρτη για σημείο';
    if (activeTool === 'line') return 'Κλικ για κορυφές · διπλό κλικ για τέλος γραμμής';
    if (activeTool === 'polygon') return 'Κλικ για κορυφές · διπλό κλικ για κλείσιμο περιοχής';
    if (activeTool === 'edit') return 'Τραβήξτε τις λαβές για αλλαγή σχήματος';
    if (activeTool === 'drag') return 'Σύρετε ολόκληρο το στοιχείο σε νέα θέση';
    if (activeTool === 'remove') return 'Κάντε κλικ σε στοιχείο για διαγραφή';
    return 'Επιλέξτε εργαλείο σχεδίασης ή ένα στοιχείο από τη λίστα';
  })();

  return (
    <Overlay onClick={onClose}>
      <LabelStyles />
      <Shell onClick={(e) => e.stopPropagation()}>
        <TopBar>
          <TitleBlock>
            <Title>Χάρτης έργου</Title>
            <Sub>
              {card?.title || 'Έργο απολογισμού'}
              {' · '}
              σχεδιάστε → ονομάστε → σύρετε ετικέτα → αποθηκεύστε
            </Sub>
          </TitleBlock>
          <TopActions>
            <Btn type="button" onClick={onClose} disabled={saving}>Κλείσιμο</Btn>
            <PrimaryBtn type="button" onClick={handleSave} disabled={saving || features.length === 0}>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </PrimaryBtn>
          </TopActions>
        </TopBar>
        <Body>
          <MapPane>
            <ToolDock>
              <ToolGroup>
                <ToolLabel>Σχεδίαση</ToolLabel>
                <ToolBtn type="button" $on={activeTool === 'pan'} onClick={() => activateTool('pan')}>Μετακίνηση</ToolBtn>
                <ToolBtn type="button" $on={activeTool === 'marker'} onClick={() => activateTool('marker')}>Σημείο</ToolBtn>
                <ToolBtn type="button" $on={activeTool === 'line'} onClick={() => activateTool('line')}>Γραμμή</ToolBtn>
                <ToolBtn type="button" $on={activeTool === 'polygon'} onClick={() => activateTool('polygon')}>Περιοχή</ToolBtn>
              </ToolGroup>
              <ToolGroup>
                <ToolLabel>Επεξεργασία</ToolLabel>
                <ToolBtn type="button" $on={activeTool === 'edit'} onClick={() => activateTool('edit')}>Σχήμα</ToolBtn>
                <ToolBtn type="button" $on={activeTool === 'drag'} onClick={() => activateTool('drag')}>Μετατόπιση</ToolBtn>
                <ToolBtn type="button" $on={activeTool === 'remove'} onClick={() => activateTool('remove')}>Διαγραφή</ToolBtn>
              </ToolGroup>
              <StatusChip $ok={tilesReady && features.length > 0}>
                {tilesReady
                  ? (features.length
                    ? `${features.length} στοιχεί${features.length === 1 ? 'ο' : 'α'}${unnamedCount ? ` · ${unnamedCount} χωρίς όνομα` : ''}`
                    : 'Κενός χάρτης — σχεδιάστε κάτι')
                  : 'Φόρτωση χάρτη…'}
              </StatusChip>
            </ToolDock>
            <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
          </MapPane>

          <Side>
            <SideScroll>
              <Card>
                <CardTitle><StepNum>1</StepNum> Πώς δουλεύει</CardTitle>
                <HelpList>
                  <li>Επιλέξτε <strong>Σημείο</strong>, <strong>Γραμμή</strong> ή <strong>Περιοχή</strong> και σχεδιάστε στον χάρτη.</li>
                  <li>Γράψτε όνομα δεξιά — εμφανίζεται ετικέτα με γραμμή σύνδεσης.</li>
                  <li>Σύρετε την ετικέτα όπου φαίνεται καθαρά (χωρίς να καλύπτει το έργο).</li>
                  <li>Πατήστε <strong>Αποθήκευση</strong> — ο χάρτης μπαίνει στην παρουσίαση ως φωτογραφία.</li>
                </HelpList>
                <Hint style={{ marginTop: 8 }}>{toolHint}</Hint>
              </Card>

              <Card>
                <CardTitle><StepNum>2</StepNum> Υπόβαθρο χάρτη</CardTitle>
                <SegRow>
                  <SegBtn type="button" $on={baseLayer === 'sat'} onClick={() => setBaseLayer('sat')}>
                    Δορυφορικός
                  </SegBtn>
                  <SegBtn type="button" $on={baseLayer === 'street'} onClick={() => setBaseLayer('street')}>
                    Οδικός
                  </SegBtn>
                </SegRow>
                <Hint style={{ marginTop: 6 }}>
                  Ο δορυφορικός είναι ιδανικός για παρουσίαση. Ο οδικός βοηθά στον προσανατολισμό.
                </Hint>
              </Card>

              <Card>
                <CardTitle><StepNum>3</StepNum> Όνομα επιλεγμένου</CardTitle>
                {!hasSelection ? (
                  <EmptyBox>
                    Κάντε κλικ σε σημείο/γραμμή/περιοχή στον χάρτη<br />ή επιλέξτε από τη λίστα παρακάτω.
                  </EmptyBox>
                ) : (
                  <>
                    <Field>Όνομα στον χάρτη</Field>
                    <Input
                      value={selectedName}
                      onChange={(e) => setSelectedName(e.target.value)}
                      onBlur={applySelectedName}
                      onKeyDown={(e) => { if (e.key === 'Enter') applySelectedName(); }}
                      placeholder="π.χ. Πλατεία, Διαδρομή Α…"
                      autoFocus
                    />
                    <SideBtn
                      type="button"
                      style={{ marginTop: 8 }}
                      onClick={applySelectedName}
                    >
                      Εφαρμογή ονόματος
                    </SideBtn>
                    {hasNamedSelection && (
                      <Ok style={{ marginTop: 8 }}>
                        Σύρετε την ετικέτα στον χάρτη για καλύτερη θέση.
                      </Ok>
                    )}
                  </>
                )}
              </Card>

              <Card>
                <CardTitle><StepNum>4</StepNum> Γραμμή σύνδεσης ετικέτας</CardTitle>
                {!hasNamedSelection ? (
                  <Hint>Διαθέσιμο αφού το επιλεγμένο στοιχείο έχει όνομα.</Hint>
                ) : (
                  <>
                    <Field>Χρώμα</Field>
                    <ColorRow>
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(leaderColor) ? leaderColor : '#ffffff'}
                        onChange={(e) => applyLeaderStyle({ leaderColor: e.target.value })}
                        style={{ width: 42, height: 34, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <Input
                        value={leaderColor}
                        onChange={(e) => setLeaderColor(e.target.value)}
                        onBlur={() => applyLeaderStyle({ leaderColor })}
                        placeholder="#ffffff"
                      />
                    </ColorRow>
                    <Field>Πάχος</Field>
                    <Select
                      value={String(leaderWeight)}
                      onChange={(e) => applyLeaderStyle({ leaderWeight: Number(e.target.value) })}
                    >
                      <option value="1">Λεπτή</option>
                      <option value="1.5">Κανονική</option>
                      <option value="2">Μεσαία</option>
                      <option value="3">Χοντρή</option>
                      <option value="4">Πολύ χοντρή</option>
                    </Select>
                    <Field>Μορφή</Field>
                    <Select
                      value={leaderDash}
                      onChange={(e) => applyLeaderStyle({ leaderDash: e.target.value })}
                    >
                      {LEADER_DASH_STYLES.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </Select>
                  </>
                )}
              </Card>

              <Card>
                <CardTitle>
                  <StepNum>5</StepNum> Στοιχεία στον χάρτη
                  <span style={{ marginLeft: 'auto', color: '#64748b', fontWeight: 700 }}>
                    {features.length}
                  </span>
                </CardTitle>
                {features.length === 0 ? (
                  <EmptyBox>
                    Δεν υπάρχει ακόμα σχέδιο.<br />
                    Πατήστε «Σημείο», «Γραμμή» ή «Περιοχή» πάνω αριστερά.
                  </EmptyBox>
                ) : (
                  <FeatureList>
                    {features.map((f, i) => {
                      const on = selectedLayerRef.current === f.layer;
                      const named = String(f.name || '').trim();
                      return (
                        <FeatureItem
                          key={i}
                          type="button"
                          $on={on}
                          onClick={() => selectFeatureFromList(f.layer)}
                        >
                          <FeatureType $on={on}>{featureTypeLabel(f.type)}</FeatureType>
                          <strong style={{ color: named ? '#0f172a' : '#b45309' }}>
                            {named || 'Χωρίς όνομα — πατήστε για συμπλήρωση'}
                          </strong>
                        </FeatureItem>
                      );
                    })}
                  </FeatureList>
                )}
              </Card>

              {error && <Err>{error}</Err>}
              {!tilesReady && !error && (
                <Hint>Φόρτωση πλακιδίων χάρτη — περιμένετε λίγο πριν την αποθήκευση.</Hint>
              )}
            </SideScroll>

            <SideFooter>
              <SidePrimaryBtn type="button" onClick={handleSave} disabled={saving || features.length === 0}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση χάρτη'}
              </SidePrimaryBtn>
              <SideBtn type="button" onClick={onClose} disabled={saving}>
                Άκυρο / Κλείσιμο
              </SideBtn>
              {features.length === 0 && (
                <Hint style={{ textAlign: 'center' }}>Χρειάζεται τουλάχιστον ένα σχέδιο για αποθήκευση.</Hint>
              )}
            </SideFooter>
          </Side>
        </Body>
      </Shell>
    </Overlay>
  );
}
