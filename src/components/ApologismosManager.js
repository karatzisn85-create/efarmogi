import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useToast } from './ToastProvider';
import { exportApologismosPdf, exportApologismosPptx } from '../utils/apologismosExport';
import {
  filterApologismosCards,
  flattenCardPhotos,
  stepPhotoPath,
  cardVizIds,
  needsMapInput,
  needsMetricsInput,
  minMapPoints,
  photoPhasesForVizIds,
  secondaryVizOptions,
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
  getPhotoRequestUiState,
  PHOTO_REQUEST_REMINDER_DAYS,
} from '../utils/apologismosCardUi';
import { hasMapSnapshot } from '../utils/apologismosMapDrawing';
import { formatDateEl } from '../utils/dateFormat';
import { showConfirm } from '../utils/confirmModal';
import ApologismosSlideView from './ApologismosSlideView';
import {
  SLIDE_W,
  SLIDE_H,
  buildFooter,
  resolveSlideDesign,
} from '../utils/apologismosSlideDesign';
import ApologismosMapEditor from './ApologismosMapEditor';
import ApologismosAppearanceEditor from './ApologismosAppearanceEditor';

const ipcRenderer = window.electronAPI;

function collectPresentationMediaPaths(model) {
  const rels = [];
  for (const img of model?.cover?.images || model?.appearance?.coverImages || []) {
    if (img?.relativePath) rels.push(img.relativePath);
  }
  const mayorPhoto = model?.mayorMessage?.photo?.relativePath
    || model?.appearance?.mayorMessage?.photo?.relativePath;
  if (mayorPhoto) rels.push(mayorPhoto);
  for (const section of model?.sections || []) {
    for (const entry of section.cards || []) {
      const photos = entry.card?.photos || {};
      for (const phase of ['before', 'during', 'after']) {
        for (const p of photos[phase] || []) rels.push(p);
      }
      if (entry.card?.mapSnapshot) rels.push(entry.card.mapSnapshot);
      for (const page of entry.contentPages || []) {
        if (page.mapSnapshot) rels.push(page.mapSnapshot);
      }
    }
  }
  return [...new Set(rels.filter(Boolean))];
}

const fadeIn = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`;
const softPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.22), 0 8px 22px rgba(15, 39, 68, 0.14); }
  50% { box-shadow: 0 0 0 4px rgba(30, 58, 95, 0.12), 0 10px 28px rgba(15, 39, 68, 0.18); }
`;
const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
`;
const floatOrb = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(12px, -10px) scale(1.05); }
`;

/* Δημοτικό ναυτικό μπλε — ίδια οικογένεια με mail / διαφάνειες */
const NAVY = '#1e3a5f';
const NAVY_DEEP = '#0f2744';
const NAVY_SOFT = '#e8eef5';

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1200;
  background:
    radial-gradient(1100px 480px at 6% -8%, rgba(30, 58, 95, 0.12), transparent 55%),
    radial-gradient(900px 420px at 96% 0%, rgba(14, 116, 144, 0.08), transparent 50%),
    linear-gradient(165deg, #f8fafc 0%, ${NAVY_SOFT} 48%, #f8fafc 100%);
  display: flex; flex-direction: column; overflow: hidden;
  &::before, &::after {
    content: '';
    position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
    filter: blur(2px); animation: ${floatOrb} 14s ease-in-out infinite;
  }
  &::before {
    width: 280px; height: 280px; top: 18%; left: -60px;
    background: radial-gradient(circle, rgba(30, 58, 95, 0.10), transparent 70%);
  }
  &::after {
    width: 340px; height: 340px; bottom: 8%; right: -80px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.08), transparent 70%);
    animation-delay: -4s;
  }
`;
const Header = styled.div`
  position: relative; z-index: 2;
  flex-shrink: 0; padding: 0.85rem 1.4rem;
  background: linear-gradient(118deg, ${NAVY_DEEP} 0%, ${NAVY} 52%, #254a73 100%);
  color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  box-shadow: 0 8px 28px rgba(15, 39, 68, 0.32);
  &::after {
    content: '';
    position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
    background: linear-gradient(90deg, #38bdf8, #93c5fd, #fbbf24, #38bdf8);
    background-size: 200% 100%;
    animation: ${shimmer} 8s linear infinite;
    opacity: 0.85;
  }
`;
const HeaderTitle = styled.h1`
  margin: 0; font-size: 1.12rem; font-weight: 800; letter-spacing: 0.01em;
  text-shadow: 0 2px 10px rgba(15, 23, 42, 0.25);
`;
const HeaderSub = styled.div`font-size: 0.74rem; opacity: 0.9; margin-top: 3px; font-weight: 600;`;
const HeaderActions = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;`;
const HeaderStats = styled.div`
  display: flex; gap: 0.4rem; align-items: stretch; flex-wrap: wrap;
  @media (max-width: 1240px) { display: none; }
`;
const HeaderStat = styled.div`
  min-width: 74px; padding: 0.32rem 0.7rem; border-radius: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(6px);
  text-align: center;
`;
const HeaderStatLabel = styled.div`
  font-size: 0.56rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; opacity: 0.85;
`;
const HeaderStatValue = styled.div`font-size: 0.95rem; font-weight: 800; line-height: 1.2;`;
const Btn = styled.button`
  border: 1px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.14);
  color: #fff; border-radius: 10px; padding: 0.5rem 1.05rem; font-size: 0.78rem; font-weight: 700;
  cursor: pointer; transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  backdrop-filter: blur(6px);
  &:hover:not(:disabled) {
    background: rgba(255,255,255,0.28); transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const CloseBtn = styled(Btn)`width: 34px; height: 34px; padding: 0;`;
const Body = styled.div`
  position: relative; z-index: 1;
  flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
  padding: 1.15rem 1.5rem 1.25rem; animation: ${fadeIn} 0.28s ease;
  @media (max-width: 1100px) { overflow: auto; }
`;
const Toolbar = styled.div`
  display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;
  flex-shrink: 0; margin-bottom: 0.9rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(232, 238, 245, 0.9) 100%);
  border: 1px solid rgba(30, 58, 95, 0.12);
  border-radius: 16px; padding: 0.8rem 1rem;
  box-shadow: 0 8px 28px rgba(15, 39, 68, 0.06), inset 0 1px 0 rgba(255,255,255,0.8);
  backdrop-filter: blur(8px);
`;
const Select = styled.select`
  border: 1px solid #e2e8f0; border-radius: 11px; padding: 0.5rem 0.8rem;
  font-size: 0.88rem; background: #fff; color: #0f172a; font-family: inherit;
  &:focus { outline: none; border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.14); }
`;
const GhostBtn = styled.button`
  border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 11px;
  padding: 0.5rem 1.1rem; font-size: 0.84rem; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: background 0.2s, border-color 0.2s, transform 0.2s;
  &:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const PrimaryBtn = styled(GhostBtn)`
  background: linear-gradient(135deg, #1e3a5f, #0f2744);
  border-color: transparent; color: #fff;
  box-shadow: 0 4px 14px rgba(15, 39, 68, 0.28);
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e3a5f, #0f2744);
    box-shadow: 0 6px 18px rgba(15, 39, 68, 0.34);
  }
`;
const DangerBtn = styled(GhostBtn)`
  background: #fef2f2; border-color: #fecaca; color: #dc2626;
  &:hover:not(:disabled) { background: #fee2e2; border-color: #fca5a5; }
`;
const Grid = styled.div`
  display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px;
  flex: 1; min-height: 0;
  @media (max-width: 1400px) { grid-template-columns: 290px minmax(0, 1fr); }
  @media (max-width: 1100px) { grid-template-columns: 1fr; min-height: auto; }
`;
const Panel = styled.div`
  position: relative;
  background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%);
  border: 1px solid rgba(30, 58, 95, 0.10);
  border-radius: 18px;
  min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 10px 32px rgba(15, 39, 68, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04);
  &::before {
    content: '';
    position: absolute; top: 0; left: 18px; right: 18px; height: 3px;
    border-radius: 0 0 8px 8px;
    background: linear-gradient(90deg, #1e3a5f, #38bdf8, #93c5fd);
    opacity: 0.85;
    z-index: 3;
  }
`;
const ListHead = styled.div`
  flex-shrink: 0; padding: 0.9rem 0.85rem 0.7rem;
  border-bottom: 1px solid rgba(30, 58, 95, 0.10);
  background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(232,238,245,0.55) 100%);
`;
const ListScroll = styled.div`
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  padding: 0.7rem 0.75rem 0.9rem;
  @media (max-width: 1100px) { max-height: 60vh; }
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 999px; }
  &::-webkit-scrollbar-track { background: transparent; }
`;
const SearchInput = styled.input`
  width: 100%; box-sizing: border-box; font-family: inherit;
  border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 0.42rem 0.7rem; font-size: 0.8rem; color: #0f172a; background: #fff;
  &::placeholder { color: #94a3b8; }
  &:focus { outline: none; border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.14); }
`;
const FilterRow = styled.div`display: flex; gap: 0.3rem; margin-top: 0.5rem; flex-wrap: wrap;`;
const FilterChip = styled.button`
  font-family: inherit; cursor: pointer;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.02em;
  padding: 0.26rem 0.6rem; border-radius: 999px;
  background: ${p => (p.$on ? 'linear-gradient(135deg, #1e3a5f, #0f2744)' : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#64748b')};
  border: 1px solid ${p => (p.$on ? 'transparent' : '#e2e8f0')};
  box-shadow: ${p => (p.$on ? '0 3px 10px rgba(15, 39, 68, 0.28)' : 'none')};
  transition: background 0.2s, color 0.2s;
  &:hover { border-color: ${p => (p.$on ? 'transparent' : '#94a3b8')}; }
`;
const ListCount = styled.div`
  font-size: 0.66rem; font-weight: 700; color: #64748b; margin-top: 0.5rem;
`;
const EditPanel = styled(Panel)`
  box-shadow: 0 14px 40px rgba(15, 39, 68, 0.10), 0 2px 10px rgba(15, 23, 42, 0.05);
  &::before { display: none; }
`;
const EditPanelHead = styled.div`
  position: relative; flex-shrink: 0;
  padding: 0.85rem 1.15rem 0.75rem;
  background: linear-gradient(120deg, #0f2744 0%, #1e3a5f 55%, #254a73 100%);
  color: #fff;
  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.12);
  &::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%);
    pointer-events: none;
  }
`;
const EditPanelBody = styled.div`
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  padding: 0.95rem 1rem 1.1rem;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%);
  @media (max-width: 1100px) { overflow: visible; }
  &::-webkit-scrollbar { width: 9px; }
  &::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 999px; }
  &::-webkit-scrollbar-track { background: transparent; }
`;
const EditSection = styled.div`
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 14px;
  padding: 0.85rem;
  margin-bottom: 0.7rem;
  overflow: hidden;
  box-shadow: 0 2px 14px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s, transform 0.2s;
  &:hover { box-shadow: 0 6px 20px rgba(15, 39, 68, 0.06); }
`;
const EditSectionTitle = styled.h3`
  margin: -0.85rem -0.85rem 0.8rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(135deg, rgba(30, 58, 95, 0.10) 0%, rgba(255, 255, 255, 0.7) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  border-left: 4px solid #1e3a5f;
  font-size: 0.86rem; font-weight: 800; letter-spacing: 0.03em; color: #1e3a5f;
`;
const StatusStrip = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem 0.7rem;
  margin: 0 0 0.75rem; padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: linear-gradient(115deg, ${NAVY_DEEP} 0%, ${NAVY} 70%, #254a73 100%);
  color: #fff;
  box-shadow: 0 6px 18px rgba(15, 39, 68, 0.18);
`;
const StatusStripMain = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; flex: 1; min-width: 0;
`;
const StatusPill = styled.span`
  display: inline-flex; align-items: center; gap: 0.28rem;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 0.22rem 0.55rem; border-radius: 999px;
  background: ${p => (p.$ok ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)')};
  border: 1px solid ${p => (p.$ok ? 'rgba(167,243,208,0.45)' : 'rgba(253,230,138,0.45)')};
  color: ${p => (p.$ok ? '#d1fae5' : '#fde68a')};
`;
const StatusMeta = styled.span`
  font-size: 0.72rem; font-weight: 600; color: rgba(226,232,240,0.92);
`;
const StatusGap = styled.div`
  width: 100%; font-size: 0.74rem; font-weight: 600; line-height: 1.4;
  color: rgba(226,232,240,0.88); margin-top: 0.15rem;
`;
const ZoneCard = styled(EditSection)`
  border-left: 3px solid ${NAVY};
`;
const ZoneEyebrow = styled.div`
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  color: #64748b; margin-bottom: 0.2rem;
`;
const LockedBox = styled.div`
  background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 11px;
  padding: 0.7rem 0.85rem; color: #334155; font-size: 0.9rem; font-weight: 700; line-height: 1.45;
`;
const LockedTag = styled.span`
  display: inline-block; margin-left: 0.4rem;
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  color: #64748b; background: #e2e8f0; border-radius: 999px; padding: 0.12rem 0.45rem;
  vertical-align: middle;
`;
const SupervisorStrip = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem 0.85rem;
  padding: 0.7rem 0.85rem; margin-bottom: 0.75rem;
  border-radius: 12px; background: #fff;
  border: 1px solid rgba(30, 58, 95, 0.12);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
`;
const SupervisorWho = styled.div`
  flex: 1; min-width: 160px;
`;
const SupervisorName = styled.div`
  font-size: 0.88rem; font-weight: 800; color: ${NAVY};
`;
const SupervisorEmail = styled.div`
  font-size: 0.74rem; font-weight: 600; color: #64748b; margin-top: 2px;
`;
const MaterialTabs = styled.div`
  display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.75rem;
`;
const MaterialTab = styled.button`
  font-family: inherit; cursor: pointer;
  border: 1px solid ${p => (p.$on ? NAVY : '#e2e8f0')};
  background: ${p => (p.$on ? NAVY : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#475569')};
  border-radius: 999px; padding: 0.35rem 0.85rem;
  font-size: 0.74rem; font-weight: 800;
  box-shadow: ${p => (p.$on ? '0 3px 10px rgba(15,39,68,0.22)' : 'none')};
`;
const StickyEditBar = styled.div`
  flex-shrink: 0;
  z-index: 5;
  padding: 0.7rem 0.9rem 0.85rem;
  border-top: 1px solid rgba(30, 58, 95, 0.10);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 -6px 20px rgba(15, 39, 68, 0.06);
`;
const StickyEditInner = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.55rem 0.65rem; border-radius: 12px;
  background: #fff; border: 1px solid rgba(30, 58, 95, 0.12);
  box-shadow: 0 2px 10px rgba(15, 39, 68, 0.05);
`;
const DangerTextBtn = styled.button`
  font-family: inherit; background: none; border: none; cursor: pointer;
  margin-left: auto; color: #b91c1c; font-size: 0.76rem; font-weight: 700;
  padding: 0.35rem 0.2rem; text-decoration: underline; text-underline-offset: 3px;
  &:hover:not(:disabled) { color: #991b1b; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const CheckRow = styled.label`
  display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
  padding: 0.65rem 0.75rem; border-radius: 10px; background: #f8fafc;
  border: 1px solid #e2e8f0; margin-top: 0.35rem;
`;
const CompactTip = styled.div`
  margin: 0.45rem 0 0.15rem; padding: 0.55rem 0.7rem;
  border-radius: 10px; background: #f0f9ff; border: 1px solid #bae6fd;
  font-size: 0.74rem; color: #0c4a6e; line-height: 1.45; font-weight: 600;
`;
const PanelTitle = styled.h2`
  margin: 0.15rem 0 0.85rem; font-size: 0.86rem; font-weight: 800;
  letter-spacing: 0.03em; color: #1e3a5f;
  display: flex; align-items: center; gap: 0.45rem;
  &::before {
    content: '';
    width: 8px; height: 8px; border-radius: 50%;
    background: linear-gradient(135deg, #1e3a5f, #38bdf8);
    box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.16);
  }
`;
const Card = styled.div`
  position: relative;
  background: ${p => (p.$active
    ? 'linear-gradient(145deg, #e8eef5 0%, #dbe7f3 60%, #fafbff 100%)'
    : 'linear-gradient(165deg, #ffffff 0%, #f8fafc 100%)')};
  border: 1px solid ${p => (p.$active ? '#1e3a5f' : 'rgba(203, 213, 225, 0.85)')};
  border-left: 4px solid ${p => (p.$active ? '#0f2744' : (p.$ready ? '#10b981' : '#f59e0b'))};
  border-radius: 12px; padding: 0.55rem 1.3rem 0.6rem 0.65rem;
  margin-bottom: 0.45rem; cursor: pointer; overflow: hidden;
  transition: box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease;
  box-shadow: ${p => (p.$active
    ? '0 0 0 2px rgba(30, 58, 95, 0.28), 0 8px 22px rgba(15, 39, 68, 0.16)'
    : '0 1px 2px rgba(15, 23, 42, 0.04)')};
  animation: ${p => (p.$active ? softPulse : 'none')} 2.8s ease-in-out infinite;
  &::after {
    content: '▸';
    position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%);
    font-size: 1rem; font-weight: 800; color: #1e3a5f;
    opacity: ${p => (p.$active ? 1 : 0)};
    transition: opacity 0.24s ease;
  }
  &:hover {
    border-color: ${p => (p.$active ? '#0f2744' : '#94a3b8')};
    box-shadow: ${p => (p.$active
      ? '0 0 0 3px rgba(30, 58, 95, 0.32), 0 10px 26px rgba(15, 39, 68, 0.20)'
      : '0 6px 18px rgba(15, 23, 42, 0.09)')};
  }
`;
const CardTitle = styled.div`
  font-size: 0.82rem; font-weight: 800; line-height: 1.32; margin: 0.25rem 0 0.3rem;
  color: ${p => (p.$active ? '#0f2744' : '#1e293b')};
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
`;
const CardTopRow = styled.div`display: flex; align-items: center; gap: 0.35rem; min-width: 0;`;
const StatusDot = styled.span`
  flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%;
  background: ${p => (p.$ready ? '#10b981' : '#f59e0b')};
  box-shadow: 0 0 0 3px ${p => (p.$ready ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)')};
`;
const CardStatusText = styled.span`
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  color: ${p => (p.$ready ? '#059669' : '#b45309')};
`;
const MicroPill = styled.span`
  flex-shrink: 0; font-size: 0.56rem; font-weight: 800; letter-spacing: 0.03em;
  padding: 0.14rem 0.4rem; border-radius: 999px; white-space: nowrap;
  background: ${p => (p.$tone === 'warn' ? '#fffbeb' : '#f1f5f9')};
  color: ${p => (p.$tone === 'warn' ? '#b45309' : '#475569')};
  border: 1px solid ${p => (p.$tone === 'warn' ? '#fde68a' : '#e2e8f0')};
`;
const CardAmount = styled.div`
  font-size: 0.78rem; font-weight: 800; color: #1e3a5f;
`;
const CardMetaText = styled.div`
  font-size: 0.66rem; font-weight: 600; color: #64748b; margin-top: 0.15rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
const Badge = styled.span`
  display: inline-block; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.02em;
  padding: 0.28rem 0.7rem; border-radius: 999px; margin-right: 0.35rem;
  background: ${p => (
    p.$tone === 'active' ? 'linear-gradient(135deg, #1e3a5f, #0f2744)'
      : p.$tone === 'warn' ? '#fffbeb'
      : p.$tone === 'ok' ? '#f0fdf4'
      : '#f1f5f9'
  )};
  color: ${p => (
    p.$tone === 'active' ? '#fff'
      : p.$tone === 'warn' ? '#b45309'
      : p.$tone === 'ok' ? '#166534'
      : '#334155'
  )};
  border: 1px solid ${p => (
    p.$tone === 'active' ? 'transparent'
      : p.$tone === 'warn' ? '#fde68a'
      : p.$tone === 'ok' ? '#bbf7d0'
      : '#e2e8f0'
  )};
  box-shadow: ${p => (p.$tone === 'active' ? '0 3px 10px rgba(15, 39, 68, 0.28)' : 'none')};
`;
const Field = styled.label`
  display: block; font-size: 0.82rem; font-weight: 700; color: #475569; margin: 0 0 0.35rem;
`;
const fieldControl = `
  width: 100%; box-sizing: border-box; font-family: inherit;
  border: 1px solid #e2e8f0; border-radius: 11px; padding: 0.62rem 0.88rem;
  font-size: 0.92rem; color: #0f172a; background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:focus { outline: none; border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.14); }
  &:disabled { background-color: #f8fafc; color: #64748b; }
`;
const Input = styled.input`
  ${fieldControl}
  min-height: 44px;
`;
const TextArea = styled.textarea`
  ${fieldControl}
  min-height: 78px; resize: vertical; line-height: 1.5;
`;
const SelectInput = styled.select`
  ${fieldControl}
  min-height: 44px;
`;
const FieldGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;
const FieldBlock = styled.div`margin-bottom: 0.65rem;`;
const Hint = styled.div`font-size: 0.72rem; color: #64748b; margin-top: 0.35rem; line-height: 1.45;`;
const Err = styled.div`
  color: #b91c1c; font-size: 0.78rem; margin-top: 0.5rem; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 10px; padding: 0.55rem 0.7rem; line-height: 1.45;
`;
const VizGuide = styled.div`
  margin-top: 0.7rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: linear-gradient(145deg, #e8eef5 0%, #f8fafc 100%);
  border: 1px solid #bfdbfe;
  font-size: 0.78rem;
  color: #1e3a5f;
  line-height: 1.5;
`;
const VizGuideRole = styled.div`
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  color: #1e3a5f; margin-bottom: 0.25rem;
`;
const VizGuideTitle = styled.div`font-weight: 800; margin-bottom: 0.35rem; color: #0f2744;`;
const VizGuideLine = styled.div`
  margin-top: 0.2rem;
  strong { color: #1e3a5f; }
`;
const EmphasisBlock = styled.div`
  margin-bottom: 0.65rem;
  border-radius: 12px;
  padding: ${p => (p.$on ? '0.55rem 0.6rem' : '0')};
  border: ${p => (p.$on ? '1px solid #93c5fd' : '1px solid transparent')};
  background: ${p => (p.$on ? 'linear-gradient(145deg, #e8eef5 0%, #ffffff 85%)' : 'transparent')};
  box-shadow: ${p => (p.$on ? '0 0 0 2px rgba(30, 58, 95, 0.12)' : 'none')};
  animation: ${p => (p.$on ? softPulse : 'none')} 2.4s ease-in-out infinite;
`;
const EmphasisTag = styled.div`
  font-size: 0.68rem; font-weight: 800; color: #1e3a5f; margin-bottom: 0.35rem;
`;
const SectionHeadRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  margin: -0.85rem -0.85rem 0.8rem;
  padding: 0.55rem 0.75rem 0.55rem 0;
  background: linear-gradient(135deg, rgba(30, 58, 95, 0.10) 0%, rgba(255, 255, 255, 0.7) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
`;
const SectionHeadTitle = styled.h3`
  margin: 0; padding: 0.15rem 1rem;
  border-left: 4px solid #1e3a5f;
  font-size: 0.86rem; font-weight: 800; letter-spacing: 0.03em; color: #1e3a5f;
`;
const InfoIconBtn = styled.button`
  font-family: inherit; cursor: pointer; flex-shrink: 0;
  width: 28px; height: 28px; margin-right: 0.75rem; border-radius: 50%;
  border: 1px solid #93c5fd; background: #e8eef5; color: #1e3a5f;
  font-size: 0.85rem; font-weight: 800; font-style: italic;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(15, 39, 68, 0.12);
  &:hover { background: #dbe7f3; border-color: #1e3a5f; }
`;
const MetricsTable = styled.div`
  border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff;
`;
const MetricsHead = styled.div`
  display: grid; grid-template-columns: 1.4fr 1fr 44px;
  gap: 0.45rem; padding: 0.55rem 0.65rem;
  background: #e8eef5; border-bottom: 1px solid #bfdbfe;
  font-size: 0.72rem; font-weight: 800; color: #1e3a5f; letter-spacing: 0.02em;
`;
const MetricsRow = styled.div`
  display: grid; grid-template-columns: 1.4fr 1fr 44px;
  gap: 0.45rem; padding: 0.45rem 0.65rem; align-items: center;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;
const MetricsCellInput = styled.input`
  ${fieldControl}
  min-height: 40px; padding: 0.45rem 0.65rem; font-size: 0.86rem;
`;
const MetricsDelBtn = styled.button`
  font-family: inherit; cursor: pointer;
  width: 36px; height: 36px; border-radius: 10px;
  border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c;
  font-size: 1rem; font-weight: 700;
  &:hover:not(:disabled) { background: #fee2e2; }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;
const ExampleTable = styled.div`
  border: 1px solid #bfdbfe; border-radius: 12px; overflow: hidden; margin-top: 0.7rem;
`;
const ExampleHead = styled.div`
  display: grid; grid-template-columns: 1.4fr 1fr;
  gap: 0.4rem; padding: 0.55rem 0.7rem;
  background: #0f2744; color: #fff;
  font-size: 0.78rem; font-weight: 800;
`;
const ExampleRow = styled.div`
  display: grid; grid-template-columns: 1.4fr 1fr;
  gap: 0.4rem; padding: 0.5rem 0.7rem;
  font-size: 0.82rem; color: #1e293b;
  background: ${p => (p.$alt ? '#f8fafc' : '#fff')};
  border-top: 1px solid #e2e8f0;
`;
const PhotoPhaseCard = styled.div`
  border: 1px solid rgba(148, 163, 184, 0.2); background: #f8fafc;
  border-radius: 12px; padding: 0.7rem; margin-top: 0.6rem;
`;
const PhotoPhaseHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.55rem;
`;
const PhotoPhaseTitle = styled.div`
  font-size: 0.78rem; font-weight: 800; color: #1e3a5f;
  text-transform: uppercase; letter-spacing: 0.05em;
`;
const PhotoCount = styled.span`
  font-size: 0.66rem; font-weight: 800; color: #1e3a5f; background: #e8eef5;
  border: 1px solid #bfdbfe; border-radius: 999px; padding: 0.2rem 0.6rem;
`;
const PhotoItem = styled.div`
  display: flex; gap: 0.5rem; align-items: center; margin-top: 0.4rem;
  background: #fff; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px;
  padding: 0.45rem 0.6rem;
`;
const PhotoName = styled.span`
  flex: 1; font-size: 0.78rem; color: #0f172a; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const PhotoMini = styled.div`
  flex: 0 0 auto; width: 46px; height: 32px; border-radius: 6px; cursor: pointer;
  background: #e2e8f0 center/cover no-repeat; border: 1px solid rgba(148, 163, 184, 0.35);
  transition: transform 0.2s ease, border-color 0.2s ease;
  &:hover { transform: scale(1.08); border-color: #1e3a5f; }
`;
const MiniBtn = styled.button`
  border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 8px;
  padding: 0.3rem 0.55rem; font-size: 0.72rem; font-weight: 700; cursor: pointer;
  white-space: nowrap; font-family: inherit;
  &:hover { background: #f8fafc; border-color: #cbd5e1; }
`;
const DangerMiniBtn = styled(MiniBtn)`
  border-color: #fecaca; color: #dc2626; background: #fef2f2;
  &:hover { background: #fee2e2; border-color: #fca5a5; }
`;
const ActionRow = styled.div`display: flex; gap: 0.5rem; margin-top: 0.9rem; flex-wrap: wrap;`;
const ViewGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.55rem;
`;
const ViewRow = styled.div`
  display: flex; flex-direction: column; gap: 0.28rem;
  padding: 0.65rem 0.8rem; border-radius: 10px;
  background: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.18);
  transition: background 0.2s, border-color 0.2s;
  ${p => (p.$wide ? 'grid-column: 1 / -1;' : '')}
  &:hover { background: #f1f5f9; border-color: rgba(99, 102, 241, 0.22); }
`;
const ViewLabel = styled.span`
  font-size: 0.66rem; font-weight: 700; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.06em;
`;
const ViewValue = styled.span`
  font-size: 0.9rem; color: #0f172a; font-weight: 500; line-height: 1.45; white-space: pre-wrap;
`;
const Empty = styled.span`color: #94a3b8; font-weight: 500; font-style: italic;`;
const Chip = styled.span`
  display: inline-block; font-size: 0.74rem; font-weight: 700; padding: 0.24rem 0.7rem;
  border-radius: 999px; background: #e8eef5; color: #1e3a5f; border: 1px solid #bfdbfe;
`;
const ThumbRow = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;`;
const Thumb = styled.div`
  width: 104px; border-radius: 10px; overflow: hidden; cursor: pointer;
  border: 1px solid ${p => (p.$primary ? '#1e3a5f' : 'rgba(148, 163, 184, 0.3)')};
  box-shadow: ${p => (p.$primary ? '0 0 0 2px rgba(30, 58, 95, 0.22)' : 'none')};
  background: #fff;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  &:hover {
    transform: translateY(-2px); border-color: #1e3a5f;
    box-shadow: 0 8px 20px rgba(15, 39, 68, 0.18);
  }
`;
const ThumbImg = styled.div`
  height: 72px; background: #e2e8f0 center/cover no-repeat;
`;
const ThumbCap = styled.div`
  font-size: 0.62rem; font-weight: 800; text-align: center; padding: 0.2rem;
  text-transform: uppercase; letter-spacing: 0.04em;
  color: ${p => (p.$primary ? '#1e3a5f' : '#94a3b8')};
  background: ${p => (p.$primary ? '#e8eef5' : '#f8fafc')};
`;
const ViewerBack = styled.div`
  position: fixed; inset: 0; z-index: 1450;
  background: radial-gradient(1200px 700px at 50% 40%, rgba(30, 41, 59, 0.88), rgba(2, 6, 23, 0.94));
  backdrop-filter: blur(6px);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 1.4rem; animation: ${fadeIn} 0.2s ease;
`;
const ViewerHead = styled.div`
  width: min(1100px, 100%); color: #fff;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem;
  margin-bottom: 0.7rem;
`;
const ViewerPhase = styled.div`
  font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: #a5b4fc;
`;
const ViewerTitle = styled.div`
  font-size: 1rem; font-weight: 800; margin-top: 2px;
  text-shadow: 0 2px 12px rgba(2, 6, 23, 0.5);
`;
const ViewerPos = styled.div`
  font-size: 0.74rem; font-weight: 700; color: #cbd5e1; white-space: nowrap;
`;
const ViewerStage = styled.div`
  position: relative; width: min(1100px, 100%); flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px; overflow: hidden;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.6);
`;
const ViewerImg = styled.img`
  max-width: 100%; max-height: 100%; object-fit: contain; display: block;
`;
const ViewerArrow = styled.button`
  position: absolute; top: 50%; transform: translateY(-50%);
  ${p => (p.$side === 'left' ? 'left: 0.6rem;' : 'right: 0.6rem;')}
  width: 42px; height: 42px; border-radius: 50%; cursor: pointer; font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(15, 23, 42, 0.55); color: #fff; font-size: 1.2rem; font-weight: 800;
  backdrop-filter: blur(6px);
  transition: background 0.2s, transform 0.2s;
  &:hover { background: rgba(99, 102, 241, 0.8); transform: translateY(-50%) scale(1.06); }
`;
const ViewerBar = styled.div`
  width: min(1100px, 100%); margin-top: 0.8rem;
  display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; justify-content: center;
`;
const ViewerBtn = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.35); background: rgba(255, 255, 255, 0.14);
  color: #fff; border-radius: 11px; padding: 0.5rem 1.1rem;
  font-size: 0.84rem; font-weight: 700; cursor: pointer; font-family: inherit;
  backdrop-filter: blur(6px);
  transition: background 0.2s, transform 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.26); transform: translateY(-1px); }
`;
const ViewerPrimaryBtn = styled(ViewerBtn)`
  background: linear-gradient(135deg, #1e3a5f, #0f2744); border-color: transparent;
  &:hover { background: linear-gradient(135deg, #254a73, #1e3a5f); }
`;
const ViewerDangerBtn = styled(ViewerBtn)`
  background: rgba(220, 38, 38, 0.85); border-color: rgba(254, 202, 202, 0.5);
  &:hover { background: rgba(185, 28, 28, 0.95); }
`;
const ViewerStrip = styled.div`
  width: min(1100px, 100%); margin-top: 0.7rem;
  display: flex; gap: 0.45rem; flex-wrap: wrap; justify-content: center;
`;
const ViewerStripItem = styled.div`
  width: 64px; height: 44px; border-radius: 8px; cursor: pointer;
  background: rgba(148, 163, 184, 0.25) center/cover no-repeat;
  border: 2px solid ${p => (p.$on ? '#38bdf8' : 'transparent')};
  opacity: ${p => (p.$on ? 1 : 0.6)};
  transition: opacity 0.2s, border-color 0.2s;
  &:hover { opacity: 1; }
`;
const ModalBack = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.42); z-index: 1300;
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 1.5rem;
`;
const ModalBox = styled.div`
  background: #fff; border-radius: 18px; width: min(920px, 100%); max-height: 85vh;
  overflow: auto; padding: 1.1rem 1.25rem 1.25rem;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.20),
    0 24px 56px -16px rgba(15, 23, 42, 0.32),
    0 8px 24px rgba(79, 70, 229, 0.10);
`;
const PresentOverlay = styled.div`
  position: fixed; inset: 0; z-index: 1400;
  background: ${(p) => p.$bg || '#0f172a'}; color: #fff;
  display: flex; flex-direction: column;
`;
const PresentTop = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 20px; background: rgba(0,0,0,0.38); border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 0.85rem; letter-spacing: 0.04em;
`;
const PresentBody = styled.div`
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px 24px 28px;
  min-height: 0;
`;
const PresentFade = styled.div`
  opacity: ${(p) => (p.$opacity == null ? 1 : p.$opacity)};
  transform: ${(p) => (
    p.$motion && p.$opacity != null && Number(p.$opacity) < 0.98
      ? 'translateY(6px)'
      : 'translateY(0)'
  )};
  transition: ${(p) => (p.$motion
    ? 'opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
    : 'none')};
`;
/** Πλαίσιο που κρατά την αναλογία 16:9 της διαφάνειας. */
const PresentStage = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.45);
`;
const PresentStageInner = styled.div`
  position: absolute; left: 0; top: 0;
  transform-origin: top left;
`;

function formatAmount(v) {
  if (v == null || v === '') return '—';
  // Ήδη αριθμός (π.χ. σύνολα παρουσίασης) — ΜΗΝ αφαιρείς την υποδιαστολή.
  let n;
  if (typeof v === 'number') {
    n = v;
  } else {
    const raw = String(v).trim();
    if (!raw) return '—';
    n = Number(
      raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.')
    );
  }
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default function ApologismosManager({
  isOpen,
  onClose,
  currentUser,
  appConfig,
}) {
  const { showToast } = useToast();
  const username = currentUser?.username || '';
  const [meta, setMeta] = useState({ categories: [], vizModes: [] });
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [cardMedia, setCardMedia] = useState({});
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const [viewerPath, setViewerPath] = useState(null);
  const [mapEditorOpen, setMapEditorOpen] = useState(false);
  const draftCardIdRef = useRef(null);
  const editBaselineRef = useRef(null);
  const editSessionTouchedDiskRef = useRef(false);
  const [eligibleOpen, setEligibleOpen] = useState(false);
  const [eligible, setEligible] = useState([]);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [metricsHelpOpen, setMetricsHelpOpen] = useState(false);
  const [legacyForm, setLegacyForm] = useState({
    title: '', area: '', completionYear: '', approvedAmount: '', contractAmount: '',
    finalContractAmountAfterApe: '', showFinalContractAmountInPresentation: false,
  });
  const [presentation, setPresentation] = useState(null);
  const [presentationMeta, setPresentationMeta] = useState({ theme: null, cover: null, motion: null });
  const [slideIndex, setSlideIndex] = useState(0);
  const [presentFade, setPresentFade] = useState(1);
  const presentFadeTimerRef = useRef(null);
  const presentTargetRef = useRef(null);
  const PRESENT_FADE_MS = 420;
  const [mediaUrls, setMediaUrls] = useState({});
  const stageWrapRef = useRef(null);
  const [stageScale, setStageScale] = useState(1);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [photoRequestOpen, setPhotoRequestOpen] = useState(false);
  const [photoRequestDeadline, setPhotoRequestDeadline] = useState('');
  const [photoRequestNote, setPhotoRequestNote] = useState('');
  const [photoRequestBusy, setPhotoRequestBusy] = useState(false);
  const [materialTab, setMaterialTab] = useState('photos');

  const selected = useMemo(
    () => (report?.cards || []).find((c) => c.id === selectedId) || null,
    [report, selectedId]
  );

  const loadReport = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('apologismos-get-report', {
        actingUsername: username,
        periodId: pid,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία φόρτωσης απολογισμού', 'error');
        return;
      }
      setReport(res.report);
      setPeriod(res.period);
      if (res.amountsSynced) {
        showToast('Ενημερώθηκαν ποσά από συνδεδεμένα υποέργα', 'info');
      }
    } finally {
      setLoading(false);
    }
  }, [username, showToast]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, periodsRes] = await Promise.all([
        ipcRenderer.invoke('apologismos-get-meta', { actingUsername: username }),
        ipcRenderer.invoke('apologismos-get-periods', { actingUsername: username }),
      ]);
      if (!metaRes?.success) {
        showToast(metaRes?.error || 'Δεν έχετε δικαίωμα', 'error');
        onClose?.();
        return;
      }
      setMeta(metaRes.meta || { categories: [], vizModes: [] });
      const list = periodsRes?.periods || [];
      setPeriods(list);
      const current = list.find((p) => p.isCurrent) || list[0];
      if (current) {
        setPeriodId(current.id);
        await loadReport(current.id);
      }
    } finally {
      setLoading(false);
    }
  }, [username, showToast, onClose, loadReport]);

  useEffect(() => {
    if (isOpen) bootstrap();
  }, [isOpen, bootstrap]);

  const clearPresentationMotion = useCallback(() => {
    if (presentFadeTimerRef.current) {
      clearTimeout(presentFadeTimerRef.current);
      presentFadeTimerRef.current = null;
    }
    presentTargetRef.current = null;
    setPresentFade(1);
  }, []);

  // Η διαφάνεια σχεδιάζεται πάντα σε καμβά 960×540 και προσαρμόζεται στο παράθυρο.
  useEffect(() => {
    if (!presentation) return undefined;
    const el = stageWrapRef.current;
    if (!el) return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const availableW = Math.max(320, rect.width - 48);
      const availableH = Math.max(180, rect.height - 48);
      setStageScale(Math.min(availableW / SLIDE_W, availableH / SLIDE_H));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [presentation]);

  const goToPresentationSlide = useCallback((nextIndex) => {
    if (!presentation) return;
    const len = presentation.length;
    if (nextIndex < 0 || nextIndex >= len) {
      if (presentFadeTimerRef.current == null) setPresentFade(1);
      return;
    }
    const motionOn = presentationMeta.motion?.enabled === true;
    if (!motionOn) {
      clearPresentationMotion();
      setSlideIndex(nextIndex);
      return;
    }
    const currentTarget = presentTargetRef.current != null ? presentTargetRef.current : slideIndex;
    if (nextIndex === currentTarget && presentTargetRef.current == null) return;

    presentTargetRef.current = nextIndex;
    if (presentFadeTimerRef.current) {
      clearTimeout(presentFadeTimerRef.current);
      presentFadeTimerRef.current = null;
    }
    setPresentFade(0);
    presentFadeTimerRef.current = setTimeout(() => {
      const target = presentTargetRef.current;
      presentTargetRef.current = null;
      presentFadeTimerRef.current = null;
      if (target == null || target < 0 || target >= len) {
        setPresentFade(1);
        return;
      }
      setSlideIndex(target);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresentFade(1));
      });
    }, PRESENT_FADE_MS);
  }, [presentation, presentationMeta.motion, slideIndex, clearPresentationMotion]);

  useEffect(() => {
    if (!presentation) return undefined;
    const isTypingTarget = (el) => {
      if (!el || el === window || el === document) return false;
      const node = el.nodeType === 3 ? el.parentElement : el;
      if (!node || !node.closest) return false;
      if (node.isContentEditable) return true;
      return !!node.closest('input, textarea, select, [contenteditable="true"]');
    };
    const onKey = (e) => {
      // Μην «κλέβεις» Space/βέλη όσο γράφει ο χρήστης σε πεδίο.
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        const base = presentTargetRef.current != null ? presentTargetRef.current : slideIndex;
        goToPresentationSlide(base + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        const base = presentTargetRef.current != null ? presentTargetRef.current : slideIndex;
        goToPresentationSlide(base - 1);
      } else if (e.key === 'Escape') {
        clearPresentationMotion();
        setPresentation(null);
        setPresentationMeta({ theme: null, cover: null, motion: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentation, slideIndex, goToPresentationSlide, clearPresentationMotion]);

  const buildDraft = useCallback((card) => ({
    categoryId: card.categoryId || card.suggestedCategoryId || '',
    narrative: card.narrative || '',
    impactLine: card.impactLine || '',
    primaryViz: card.primaryViz || '',
    secondaryViz: card.secondaryViz || '',
    area: card.area || '',
    completionYear: card.completionYear || '',
    approvedAmount: card.approvedAmount || '',
    contractAmount: card.contractAmount || '',
    finalContractAmountAfterApe: card.finalContractAmountAfterApe || '',
    finalContractApeDate: card.finalContractApeDate || '',
    showFinalContractAmountInPresentation: !!card.showFinalContractAmountInPresentation,
    title: card.title || '',
    metrics: draftMetricsRows(card.metrics || []),
  }), []);

  // Το πρόχειρο ανανεώνεται ΜΟΝΟ όταν αλλάζει η επιλεγμένη κάρτα.
  // Διαφορετικά κάθε ανανέωση δεδομένων (π.χ. μετά από ανέβασμα φωτογραφίας)
  // θα έσβηνε τις επιλογές που δεν έχουν αποθηκευτεί ακόμα.
  useEffect(() => {
    if (!selected) {
      draftCardIdRef.current = null;
      setDraft(null);
      setEditing(false);
      return;
    }
    if (draftCardIdRef.current !== selected.id) {
      draftCardIdRef.current = selected.id;
      setDraft(buildDraft(selected));
      setEditing(false);
    }
  }, [selected, buildDraft]);

  const selectedPhotoPaths = useMemo(() => {
    const photos = selected?.photos || {};
    const list = ['before', 'during', 'after'].flatMap((p) => photos[p] || []);
    if (selected?.mapSnapshot) list.push(selected.mapSnapshot);
    return list;
  }, [selected]);

  const selectedPhotoKey = selectedPhotoPaths.join('|');

  const viewerPhotos = useMemo(() => flattenCardPhotos(selected), [selected]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPhotoKey) {
      setCardMedia({});
      return undefined;
    }
    (async () => {
      const res = await ipcRenderer.invoke('apologismos-resolve-media-map', {
        actingUsername: username,
        relativePaths: selectedPhotoKey.split('|'),
        asDataUrl: true,
        variant: 'preview',
      });
      if (!cancelled) setCardMedia(res?.mediaMap || {});
    })();
    return () => { cancelled = true; };
  }, [selectedPhotoKey, username]);

  const applyReport = (res) => {
    if (res?.success && res.report) {
      setReport(res.report);
      if (res.period) setPeriod(res.period);
      if (res.card?.id) setSelectedId(res.card.id);
    }
  };

  const openEligible = async () => {
    const res = await ipcRenderer.invoke('apologismos-list-eligible-subprojects', {
      actingUsername: username,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία φόρτωσης υποέργων', 'error');
      return;
    }
    const existing = new Set(
      (report?.cards || []).filter((c) => c.source === 'linked').map((c) => c.subprojectId)
    );
    setEligible((res.subprojects || []).filter((s) => !existing.has(s.subprojectId)));
    setEligibleOpen(true);
  };

  const addLinked = async (subprojectId) => {
    const res = await ipcRenderer.invoke('apologismos-add-from-subproject', {
      actingUsername: username,
      periodId,
      subprojectId,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία ένταξης', 'error');
      return;
    }
    applyReport(res);
    setEligibleOpen(false);
    showToast('Το έργο προστέθηκε στον απολογισμό', 'success');
  };

  const addLegacy = async () => {
    const res = await ipcRenderer.invoke('apologismos-add-legacy-card', {
      actingUsername: username,
      periodId,
      input: {
        ...legacyForm,
        completionYear: Number(legacyForm.completionYear),
      },
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία καταχώρησης', 'error');
      return;
    }
    applyReport(res);
    setLegacyOpen(false);
    setLegacyForm({
      title: '', area: '', completionYear: '', approvedAmount: '', contractAmount: '',
      finalContractAmountAfterApe: '', showFinalContractAmountInPresentation: false,
    });
    showToast('Καταχωρήθηκε παλαιότερο έργο', 'success');
  };

  const saveDraft = async ({ silent = false } = {}) => {
    if (!selected || !draft) return false;
    const metrics = cleanMetricsRows(draft.metrics);
    const patch = {
      categoryId: draft.categoryId,
      narrative: draft.narrative,
      impactLine: draft.impactLine,
      primaryViz: draft.primaryViz,
      secondaryViz: draft.secondaryViz || null,
      metrics,
      title: draft.title,
      approvedAmount: draft.approvedAmount,
      contractAmount: draft.contractAmount,
      finalContractAmountAfterApe: draft.finalContractAmountAfterApe,
      finalContractApeDate: draft.finalContractApeDate,
      showFinalContractAmountInPresentation: !!draft.showFinalContractAmountInPresentation,
      area: draft.area || '',
    };
    if (selected.source === 'legacy') {
      patch.completionYear = Number(draft.completionYear);
    }

    const res = await ipcRenderer.invoke('apologismos-update-card', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
      patch,
      // Σιωπηρή αποθήκευση: δεν σβήνει φωτο/χάρτη — αλλιώς το «Άκυρο» δεν μπορεί να επαναφέρει.
      pruneUnusedVisuals: !silent,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία αποθήκευσης', 'error');
      return false;
    }
    applyReport(res);
    if (silent) {
      editSessionTouchedDiskRef.current = true;
      // Ευθυγράμμιση πρόχειρου με το αποθηκευμένο — χωρίς ψεύτικες «μη αποθηκευμένες αλλαγές».
      if (res.card) setDraft(buildDraft(res.card));
    } else {
      editSessionTouchedDiskRef.current = false;
      editBaselineRef.current = null;
      setEditing(false);
      showToast('Η κάρτα αποθηκεύτηκε', 'success');
    }
    return res.card || true;
  };

  const isDirty = useMemo(() => {
    if (!selected || !draft) return false;
    return JSON.stringify(buildDraft(selected)) !== JSON.stringify(draft);
  }, [selected, draft, buildDraft]);

  const hasUnsavedCardWork = editing && (isDirty || editSessionTouchedDiskRef.current);

  const restoreEditBaseline = async () => {
    const baseline = editBaselineRef.current;
    if (!selected || !baseline || !editSessionTouchedDiskRef.current) {
      editSessionTouchedDiskRef.current = false;
      return { ok: true, card: selected };
    }
    const patch = {
      categoryId: baseline.categoryId,
      narrative: baseline.narrative,
      impactLine: baseline.impactLine,
      primaryViz: baseline.primaryViz,
      secondaryViz: baseline.secondaryViz || null,
      metrics: cleanMetricsRows(baseline.metrics),
      title: baseline.title,
      approvedAmount: baseline.approvedAmount,
      contractAmount: baseline.contractAmount,
      finalContractAmountAfterApe: baseline.finalContractAmountAfterApe,
      finalContractApeDate: baseline.finalContractApeDate,
      showFinalContractAmountInPresentation: !!baseline.showFinalContractAmountInPresentation,
      area: baseline.area || '',
    };
    if (selected.source === 'legacy') {
      patch.completionYear = Number(baseline.completionYear);
    }
    const res = await ipcRenderer.invoke('apologismos-update-card', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
      patch,
      pruneUnusedVisuals: true,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία αναίρεσης αλλαγών', 'error');
      return { ok: false, card: null };
    }
    applyReport(res);
    editSessionTouchedDiskRef.current = false;
    return { ok: true, card: res.card || selected };
  };

  const selectCard = async (id) => {
    if (id === selectedId) return;
    if (hasUnsavedCardWork) {
      const ok = await showConfirm({
        title: 'Μη αποθηκευμένες αλλαγές',
        message: 'Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί. Να συνεχίσετε χωρίς αποθήκευση;',
        detail: 'Οι μη αποθηκευμένες αλλαγές στην κάρτα θα χαθούν.',
        confirmLabel: 'Συνέχεια χωρίς αποθήκευση',
        cancelLabel: 'Άκυρο',
        danger: true,
        icon: '⚠️',
      });
      if (!ok) return;
    }
    if (editing && editSessionTouchedDiskRef.current) {
      const restored = await restoreEditBaseline();
      if (!restored.ok) return;
    }
    editBaselineRef.current = null;
    setEditing(false);
    setMaterialTab('photos');
    setSelectedId(id);
  };

  const startEdit = () => {
    if (!selected) return;
    const nextDraft = buildDraft(selected);
    editBaselineRef.current = JSON.parse(JSON.stringify(nextDraft));
    editSessionTouchedDiskRef.current = false;
    setDraft(nextDraft);
    setMaterialTab('photos');
    setEditing(true);
  };

  const cancelEdit = async () => {
    let card = selected;
    if (editSessionTouchedDiskRef.current) {
      const restored = await restoreEditBaseline();
      if (!restored.ok) return;
      card = restored.card || selected;
    }
    if (card) setDraft(buildDraft(card));
    editBaselineRef.current = null;
    setEditing(false);
  };

  const removeCard = async () => {
    if (!selected) return;
    const ok = await showConfirm({
      title: 'Αφαίρεση κάρτας',
      message: 'Να αφαιρεθεί η κάρτα από τον απολογισμό;',
      detail: 'Η κάρτα θα φύγει από την παρουσίαση αυτής της περιόδου.',
      confirmLabel: 'Αφαίρεση',
      cancelLabel: 'Άκυρο',
      danger: true,
      icon: '🗑',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('apologismos-remove-card', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία διαγραφής', 'error');
      return;
    }
    setSelectedId(null);
    applyReport(res);
    showToast('Η κάρτα αφαιρέθηκε', 'success');
  };

  const dismissBadge = async () => {
    if (!selected) return;
    const res = await ipcRenderer.invoke('apologismos-dismiss-amount-badge', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
    });
    if (res?.success) applyReport(res);
  };

  const uploadPhotos = async (phase) => {
    if (!selected) return;
    // Πρώτα επιλογή αρχείων — αν ακυρωθεί, δεν αποθηκεύουμε τίποτα σιωπηλά.
    const pick = await ipcRenderer.invoke('apologismos-select-photos', {
      actingUsername: username,
    });
    if (!pick?.success) {
      showToast(pick?.error || 'Αποτυχία επιλογής φωτογραφιών', 'error');
      return;
    }
    if (pick.canceled) return;

    // Κατοχύρωση επιλογών κάρτας (χωρίς διαγραφή media) πριν το ανέβασμα.
    let cardForUpload = selected;
    if (isDirty) {
      const savedCard = await saveDraft({ silent: true });
      if (!savedCard) return;
      if (savedCard && typeof savedCard === 'object') cardForUpload = savedCard;
    }
    const currentCount = (cardForUpload.photos?.[phase] || []).length;
    const room = 3 - currentCount;
    if (room <= 0) {
      showToast('Μέγιστο 3 φωτογραφίες ανά φάση', 'error');
      return;
    }
    const paths = (pick.filePaths || []).slice(0, room);
    let last = null;
    for (const sourcePath of paths) {
      const res = await ipcRenderer.invoke('apologismos-save-photo', {
        actingUsername: username,
        periodId,
        cardId: cardForUpload.id,
        phase,
        sourcePath,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία αποθήκευσης φωτογραφίας', 'error');
        return;
      }
      last = res;
    }
    if (last) {
      applyReport(last);
      if (editing && last.card) setDraft(buildDraft(last.card));
      showToast('Οι φωτογραφίες προστέθηκαν. Η πρώτη κάθε φάσης είναι η κύρια.', 'success');
    }
  };

  const removePhoto = async (phase, relativePath) => {
    if (!selected) return;
    const res = await ipcRenderer.invoke('apologismos-remove-photo', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
      phase,
      relativePath,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία διαγραφής φωτογραφίας', 'error');
      return;
    }
    applyReport(res);
    if (editing && res.card) setDraft(buildDraft(res.card));
    showToast('Η φωτογραφία αφαιρέθηκε', 'success');
  };

  const viewerIndex = viewerPath ? viewerPhotos.findIndex((p) => p.rel === viewerPath) : -1;
  const viewerItem = viewerIndex >= 0 ? viewerPhotos[viewerIndex] : null;

  const stepViewer = (delta) => {
    const next = stepPhotoPath(viewerPhotos, viewerPath, delta);
    if (next) setViewerPath(next);
  };

  const downloadPhoto = async (relativePath) => {
    const res = await ipcRenderer.invoke('apologismos-export-photo', {
      actingUsername: username,
      relativePath,
    });
    if (res?.canceled) return;
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία λήψης φωτογραφίας', 'error');
      return;
    }
    showToast('Η φωτογραφία αποθηκεύτηκε', 'success');
  };

  const makePhotoPrimary = async (phase, relativePath) => {
    if (!selected) return;
    const res = await ipcRenderer.invoke('apologismos-reorder-photo-primary', {
      actingUsername: username,
      periodId,
      cardId: selected.id,
      phase,
      relativePath,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία αλλαγής σειράς', 'error');
      return;
    }
    applyReport(res);
    showToast('Ορίστηκε ως κύρια φωτογραφία της φάσης', 'success');
  };

  useEffect(() => {
    if (viewerPath && !viewerPhotos.some((p) => p.rel === viewerPath)) setViewerPath(null);
  }, [viewerPath, viewerPhotos]);

  useEffect(() => {
    if (!viewerPath) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setViewerPath(null);
        return;
      }
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = stepPhotoPath(viewerPhotos, viewerPath, e.key === 'ArrowRight' ? 1 : -1);
      if (next) setViewerPath(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerPath, viewerPhotos]);

  const buildSlides = (model) => {
    const slides = [];
    const cover = model.cover || {};
    const showDividers = model.design?.sectionDividers !== false;
    slides.push({
      type: 'cover',
      cover,
      totals: model.totals,
      title: cover.reportTitle || 'Απολογισμός τεχνικού έργου',
      organizationTitle: cover.organizationTitle || '',
      subtitle: cover.subtitle || '',
      periodLabel: cover.periodLabel || model.period?.label || '',
      stats: [
        { label: 'Έργα', value: String(model.totals?.projectCount ?? 0) },
        { label: 'Εγκεκριμένα', value: formatAmount(model.totals?.totalApproved) },
        { label: 'Συμβάσεις', value: formatAmount(model.totals?.totalContract) },
      ],
    });
    if (model.toc?.items?.length) {
      slides.push({
        type: 'toc',
        toc: {
          ...model.toc,
          totalApprovedText: formatAmount(model.toc.totalApproved),
          totalContractText: formatAmount(model.toc.totalContract),
          items: (model.toc.items || []).map((it) => ({
            ...it,
            totalApprovedText: formatAmount(it.totalApproved),
          })),
        },
      });
    }
    if (model.mayorMessage?.enabled) {
      slides.push({
        type: 'mayor',
        mayorMessage: model.mayorMessage,
      });
    }
    let sectionOrdinal = 0;
    for (const section of model.sections || []) {
      if (showDividers) {
        sectionOrdinal += 1;
        slides.push({
          type: 'category',
          title: section.label,
          totalApproved: section.totalApproved,
          totalContract: section.totalContract,
          totalApprovedText: formatAmount(section.totalApproved),
          totalContractText: formatAmount(section.totalContract),
          count: section.count,
          sectionIndex: sectionOrdinal,
          sectionTotal: (model.sections || []).length,
          heroPhoto: section.heroPhoto || null,
        });
      }
      for (const entry of section.cards || []) {
        const pages = entry.contentPages?.length
          ? entry.contentPages
          : [{ type: 'simple', role: 'primary' }];
        pages.forEach((page, idx) => {
          slides.push({
            type: 'project',
            entry,
            page,
            pageIndex: idx,
            sectionLabel: section.label,
            approvedText: formatAmount(
              page.type === 'amounts' ? page.approvedAmount : entry.display?.approvedAmount
            ),
            contractText: formatAmount(
              page.type === 'amounts' ? page.contractAmount : entry.display?.contractAmount
            ),
            finalContractText: formatAmount(
              (page.type === 'amounts'
                ? page.finalContractAmountAfterApe
                : entry.display?.finalContractAmountAfterApe)
            ),
          });
        });
      }
    }
    return slides;
  };

  const openPresentation = async () => {
    const res = await ipcRenderer.invoke('apologismos-get-presentation', {
      actingUsername: username,
      periodId,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία παρουσίασης', 'error');
      return;
    }
    if (!res.model?.totals?.projectCount) {
      showToast('Δεν υπάρχουν έτοιμες κάρτες για παρουσίαση', 'info');
      return;
    }
    const rels = collectPresentationMediaPaths(res.model);
    const mediaRes = await ipcRenderer.invoke('apologismos-resolve-media-map', {
      actingUsername: username,
      relativePaths: rels,
      asDataUrl: true,
      variant: 'preview',
    });
    setMediaUrls(mediaRes?.mediaMap || {});
    setPresentationMeta({
      theme: res.model.theme || null,
      cover: res.model.cover || null,
      motion: res.model.motion || null,
      design: res.model.design || null,
      branding: res.model.branding || null,
      organizationTitle: res.model.cover?.organizationTitle || '',
      periodLabel: res.model.cover?.periodLabel || res.model.period?.label || '',
    });
    setPresentFade(1);
    setPresentation(buildSlides(res.model));
    setSlideIndex(0);
  };

  const exportPdf = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
    const res = await ipcRenderer.invoke('apologismos-get-presentation', {
      actingUsername: username,
      periodId,
    });
    if (!res?.success) {
      showToast(res?.error || 'Αποτυχία εξαγωγής', 'error');
      return;
    }
    const rels = collectPresentationMediaPaths(res.model);
    const mediaRes = await ipcRenderer.invoke('apologismos-resolve-media-map', {
      actingUsername: username,
      relativePaths: rels,
      asDataUrl: true,
      variant: 'full',
    });
    const framedRes = await ipcRenderer.invoke('apologismos-frame-cover-images', {
      actingUsername: username,
      periodId,
      channel: 'pdf',
    });
    const model = { ...res.model };
    if (framedRes?.success && Array.isArray(framedRes.frames) && model.cover) {
      model.cover = {
        ...model.cover,
        images: (model.cover.images || []).map((img, i) => (
          img ? { ...img, framedDataUrl: framedRes.frames[i] || null } : null
        )),
      };
    }
    if (framedRes?.success && framedRes.mayorFrame && model.mayorMessage?.photo) {
      model.mayorMessage = {
        ...model.mayorMessage,
        photo: {
          ...model.mayorMessage.photo,
          framedDataUrl: framedRes.mayorFrame,
        },
      };
    }
    try {
      const out = await exportApologismosPdf({
        model,
        appConfig,
        mediaMap: mediaRes?.mediaMap || {},
      });
      if (out?.canceled) return;
      if (out?.success) showToast('Το έγγραφο αποθηκεύτηκε', 'success');
      else showToast(out?.error || 'Αποτυχία εξαγωγής εγγράφου', 'error');
    } catch (e) {
      showToast(e.message || 'Αποτυχία εξαγωγής εγγράφου', 'error');
    }
    } finally {
      setExportBusy(false);
    }
  };

  const exportPptx = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const res = await exportApologismosPptx({ periodId, actingUsername: username });
      if (res?.canceled) return;
      if (res?.success) showToast('Η παρουσίαση διαφανειών αποθηκεύτηκε', 'success');
      else showToast(res?.error || 'Αποτυχία εξαγωγής διαφανειών', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const photoPhaseLabel = (phase) => {
    if (phase === 'map') return 'Χάρτης έργου';
    return (meta.photoPhaseLabels && meta.photoPhaseLabels[phase]) || ({
      before: 'Πριν',
      during: 'Κατά τη διάρκεια',
      after: 'Μετά',
    }[phase] || phase);
  };

  const vizLabel = useCallback((id) => (
    (meta.vizModes || []).find((v) => v.id === id)?.label || ''
  ), [meta.vizModes]);

  const categoryLabel = useCallback((id) => (
    (meta.categories || []).find((c) => c.id === id)?.label || ''
  ), [meta.categories]);

  const phasesForViz = useCallback((primaryId, secondaryId) => (
    photoPhasesForVizIds(meta.vizModes, [primaryId, secondaryId].filter(Boolean))
  ), [meta.vizModes]);

  const visiblePhotoPhases = useMemo(
    () => phasesForViz(draft?.primaryViz, draft?.secondaryViz),
    [phasesForViz, draft?.primaryViz, draft?.secondaryViz]
  );

  const savedPhotoPhases = useMemo(
    () => phasesForViz(selected?.primaryViz, selected?.secondaryViz),
    [phasesForViz, selected?.primaryViz, selected?.secondaryViz]
  );

  const draftVizIds = cardVizIds(draft);
  const draftNeedsMap = needsMapInput(draftVizIds);
  const draftNeedsMetrics = needsMetricsInput(draftVizIds);
  const draftNeedsNarrative = needsNarrativeEmphasis(draftVizIds);
  const draftNeedsAmounts = needsAmountsEmphasis(draftVizIds);
  const draftMinMapPoints = minMapPoints(draftVizIds);
  const draftMapVizLabels = draftVizIds
    .filter((id) => needsMapInput([id])).map((id) => vizLabel(id)).join(' + ');
  const draftMetricsVizLabels = draftVizIds
    .filter((id) => needsMetricsInput([id])).map((id) => vizLabel(id)).join(' + ');

  const materialTabs = useMemo(() => {
    const tabs = [];
    if (visiblePhotoPhases.length > 0) tabs.push({ id: 'photos', label: 'Φωτογραφίες' });
    if (draftNeedsMap) tabs.push({ id: 'map', label: 'Χάρτης' });
    if (draftNeedsMetrics) tabs.push({ id: 'metrics', label: 'Αποτελέσματα' });
    return tabs;
  }, [visiblePhotoPhases.length, draftNeedsMap, draftNeedsMetrics]);

  useEffect(() => {
    if (!materialTabs.length) return;
    if (!materialTabs.some((t) => t.id === materialTab)) {
      setMaterialTab(materialTabs[0].id);
    }
  }, [materialTabs, materialTab]);

  const editGapLine = useMemo(() => {
    if (!draft) return '';
    const phaseName = (phase) => ({
      before: 'Πριν', during: 'Κατά', after: 'Μετά',
    }[phase] || phase);
    const gaps = [];
    if (!draft.categoryId) gaps.push('κατηγορία');
    if (!draft.primaryViz) gaps.push('τρόπος προβολής');
    if (draftNeedsNarrative && !String(draft.narrative || '').trim()) gaps.push('σύντομο κείμενο');
    if (visiblePhotoPhases.length) {
      const missing = visiblePhotoPhases.filter((ph) => !((selected?.photos?.[ph] || []).length));
      if (missing.length) gaps.push(`φωτογραφίες ${missing.map(phaseName).join('/')}`);
    }
    if (draftNeedsMap && !hasMapSnapshot(selected)) gaps.push('χάρτης');
    if (draftNeedsMetrics && cleanMetricsRows(draft.metrics).length === 0) gaps.push('αποτελέσματα');
    if (!gaps.length) {
      return selected?.ready
        ? 'Όλα τα απαιτούμενα για την παρουσίαση είναι συμπληρωμένα.'
        : 'Συμπληρώστε και πατήστε Αποθήκευση για να ελεγχθεί η ετοιμότητα.';
    }
    return `Λείπει ακόμη: ${gaps.join(' · ')}`;
  }, [draft, selected, draftNeedsNarrative, draftNeedsMap, draftNeedsMetrics, visiblePhotoPhases]);

  const selectedVizIds = cardVizIds(selected);
  const selectedNeedsMap = needsMapInput(selectedVizIds);
  const selectedNeedsMetrics = needsMetricsInput(selectedVizIds);
  const selectedCanRequestPhotos = !!(
    selected
    && selected.source === 'linked'
    && selected.supervisor?.displayName
    && savedPhotoPhases.length > 0
  );

  const formatPhotoRequestSentAt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openPhotoRequest = () => {
    if (!selected || selected.source !== 'linked') return;
    if (!selected.supervisor?.displayName) {
      showToast('Δεν έχει καταγραφεί επιβλέπων στο συνδεδεμένο υποέργο.', 'error');
      return;
    }
    if (!selected.supervisor?.hasEmail) {
      showToast('Ο επιβλέπων δεν έχει καταχωρημένο email στον λογαριασμό χρήστη του.', 'error');
      return;
    }
    if (!savedPhotoPhases.length) {
      showToast(
        visiblePhotoPhases.length
          ? 'Αποθηκεύστε πρώτα την κάρτα με τον τρόπο προβολής, ώστε να σταλεί σωστό αίτημα φωτογραφιών.'
          : 'Επιλέξτε τρόπο προβολής με φωτογραφίες και αποθηκεύστε την κάρτα.',
        'error'
      );
      return;
    }
    setPhotoRequestDeadline('');
    setPhotoRequestNote('');
    setPhotoRequestOpen(true);
  };

  const sendPhotoRequest = async () => {
    if (!selected || photoRequestBusy) return;
    if (selected.photoRequestLast?.sentAt) {
      const when = formatPhotoRequestSentAt(selected.photoRequestLast.sentAt);
      const ok = await showConfirm({
        title: 'Επαναποστολή αιτήματος',
        message: when
          ? `Έχει ήδη σταλεί αίτημα στις ${when}. Να ξανασταλεί;`
          : 'Έχει ήδη σταλεί αίτημα φωτογραφιών. Να ξανασταλεί;',
        confirmLabel: 'Ξαναστείλε',
        cancelLabel: 'Άκυρο',
        danger: false,
        icon: '✉️',
      });
      if (!ok) return;
    }
    setPhotoRequestBusy(true);
    try {
      const res = await ipcRenderer.invoke('apologismos-request-card-photos', {
        actingUsername: username,
        periodId,
        cardId: selected.id,
        optionalDeadline: photoRequestDeadline.trim(),
        optionalNote: photoRequestNote.trim(),
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία αποστολής αιτήματος', 'error');
        return;
      }
      if (res.report) setReport(res.report);
      else if (res.photoRequestLast && selectedId) {
        setReport((prev) => {
          if (!prev?.cards) return prev;
          return {
            ...prev,
            cards: prev.cards.map((c) => (
              c.id === selectedId ? { ...c, photoRequestLast: res.photoRequestLast } : c
            )),
          };
        });
      }
      setPhotoRequestOpen(false);
      showToast(
        res.warning
          || `Το αίτημα στάλθηκε στον επιβλέποντα${selected.supervisor?.displayName ? ` (${selected.supervisor.displayName})` : ''}.`,
        res.warning ? 'info' : 'success'
      );
    } finally {
      setPhotoRequestBusy(false);
    }
  };

  const vizGuideOpts = {
    vizModes: meta.vizModes,
    phaseLabel: photoPhaseLabel,
  };
  const guideFor = (id) => vizUserGuide(id, vizGuideOpts);

  const narrativeFieldLabel = (() => {
    if (draftVizIds.includes('simple_card')) {
      return 'Σύντομο κείμενο (υποχρεωτικό, έως 3 γραμμές) — κύριο περιεχόμενο στην παρουσίαση';
    }
    return 'Σύντομο κείμενο (υποχρεωτικό, έως 3 γραμμές)';
  })();

  const renderVizGuide = (id, roleLabel) => {
    const guide = guideFor(id);
    if (!guide) return null;
    return (
      <CompactTip>
        <strong>{roleLabel}:</strong>
        {' '}
        {vizLabel(id) || 'Τρόπος'}
        {' — '}
        {guide.needs}
      </CompactTip>
    );
  };

  const renderThumbs = (phase) => {
    const list = selected?.photos?.[phase] || [];
    if (list.length === 0) return <Empty>Καμία φωτογραφία</Empty>;
    return (
      <ThumbRow>
        {list.map((rel, idx) => (
          <Thumb
            key={`${phase}-${idx}-${rel}`}
            $primary={idx === 0}
            onClick={() => setViewerPath(rel)}
            title="Κλικ για προβολή σε μεγάλο μέγεθος"
          >
            <ThumbImg
              style={{ backgroundImage: cardMedia[rel] ? `url("${cardMedia[rel]}")` : undefined }}
            />
            <ThumbCap $primary={idx === 0}>{idx === 0 ? '★ Κύρια' : `${idx + 1}η`}</ThumbCap>
          </Thumb>
        ))}
      </ThumbRow>
    );
  };

  if (!isOpen) return null;

  const cards = report?.cards || [];
  const readyCount = cards.filter((c) => c.ready).length;
  const slide = presentation?.[slideIndex] || null;
  const visibleCards = filterApologismosCards(cards, { search: listSearch, status: listFilter });

  return (
    <Overlay>
      <Header>
        <div>
          <HeaderTitle>Απολογισμός τεχνικού έργου</HeaderTitle>
          <HeaderSub>
            {period?.label || 'Δημοτική περίοδος'} · {cards.length} κάρτες · {readyCount} έτοιμες
          </HeaderSub>
        </div>
        <HeaderStats>
          <HeaderStat>
            <HeaderStatLabel>Κάρτες</HeaderStatLabel>
            <HeaderStatValue>{cards.length}</HeaderStatValue>
          </HeaderStat>
          <HeaderStat>
            <HeaderStatLabel>Έτοιμες</HeaderStatLabel>
            <HeaderStatValue>{readyCount}</HeaderStatValue>
          </HeaderStat>
          <HeaderStat>
            <HeaderStatLabel>Εκκρεμείς</HeaderStatLabel>
            <HeaderStatValue>{Math.max(0, cards.length - readyCount)}</HeaderStatValue>
          </HeaderStat>
        </HeaderStats>
        <HeaderActions>
          <Btn type="button" disabled={!periodId || !report} onClick={() => setAppearanceOpen(true)}>Ρυθμίσεις εξωφύλλου - διαφανειών</Btn>
          <Btn type="button" onClick={openPresentation}>Παρουσίαση</Btn>
          <Btn type="button" disabled={exportBusy} onClick={exportPdf}>Εξαγωγή εγγράφου</Btn>
          <Btn type="button" disabled={exportBusy} onClick={exportPptx}>Εξαγωγή διαφανειών</Btn>
          <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">✕</CloseBtn>
        </HeaderActions>
      </Header>

      <Body>
        <Toolbar>
          <Select
            value={periodId}
            onChange={async (e) => {
              const id = e.target.value;
              if (id === periodId) return;
              if (hasUnsavedCardWork) {
                const ok = await showConfirm({
                  title: 'Μη αποθηκευμένες αλλαγές',
                  message: 'Υπάρχουν μη αποθηκευμένες αλλαγές στην κάρτα. Να συνεχίσετε χωρίς αποθήκευση;',
                  detail: 'Οι αλλαγές στην τρέχουσα κάρτα θα χαθούν.',
                  confirmLabel: 'Συνέχεια χωρίς αποθήκευση',
                  cancelLabel: 'Άκυρο',
                  danger: true,
                  icon: '⚠️',
                });
                if (!ok) {
                  e.target.value = periodId;
                  return;
                }
                if (editSessionTouchedDiskRef.current) {
                  const restored = await restoreEditBaseline();
                  if (!restored.ok) {
                    e.target.value = periodId;
                    return;
                  }
                }
              }
              editBaselineRef.current = null;
              setPeriodId(id);
              setSelectedId(null);
              setEditing(false);
              setDraft(null);
              await loadReport(id);
            }}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label || `${p.startYear}–${p.endYear}`}</option>
            ))}
          </Select>
          <PrimaryBtn type="button" onClick={openEligible}>+ Από ολοκληρωμένα</PrimaryBtn>
          <GhostBtn type="button" onClick={() => setLegacyOpen(true)}>+ Παλαιότερο έργο</GhostBtn>
          <GhostBtn
            type="button"
            disabled={loading}
            onClick={async () => {
              if (hasUnsavedCardWork) {
                const ok = await showConfirm({
                  title: 'Μη αποθηκευμένες αλλαγές',
                  message: 'Υπάρχουν μη αποθηκευμένες αλλαγές στην κάρτα. Η ανανέωση θα τις απορρίψει. Να συνεχίσετε;',
                  confirmLabel: 'Συνέχεια χωρίς αποθήκευση',
                  cancelLabel: 'Άκυρο',
                  danger: true,
                  icon: '⚠️',
                });
                if (!ok) return;
                if (editSessionTouchedDiskRef.current) {
                  const restored = await restoreEditBaseline();
                  if (!restored.ok) return;
                }
                editBaselineRef.current = null;
                setEditing(false);
              }
              await loadReport(periodId);
            }}
          >Ανανέωση</GhostBtn>
        </Toolbar>

        <Grid>
          <Panel>
            <ListHead>
              <PanelTitle style={{ margin: '0 0 0.5rem' }}>Κάρτες απολογισμού</PanelTitle>
              <SearchInput
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Αναζήτηση σε τίτλο ή περιοχή…"
              />
              <FilterRow>
                <FilterChip type="button" $on={listFilter === 'all'} onClick={() => setListFilter('all')}>
                  Όλα ({cards.length})
                </FilterChip>
                <FilterChip type="button" $on={listFilter === 'ready'} onClick={() => setListFilter('ready')}>
                  Έτοιμα ({readyCount})
                </FilterChip>
                <FilterChip type="button" $on={listFilter === 'pending'} onClick={() => setListFilter('pending')}>
                  Εκκρεμή ({Math.max(0, cards.length - readyCount)})
                </FilterChip>
              </FilterRow>
              {(listSearch.trim() !== '' || listFilter !== 'all') && (
                <ListCount>Εμφανίζονται {visibleCards.length} από {cards.length}</ListCount>
              )}
            </ListHead>
            <ListScroll>
              {loading && <Hint>Φόρτωση…</Hint>}
              {!loading && cards.length === 0 && (
                <Hint>Δεν υπάρχουν ακόμα έργα. Προσθέστε από ολοκληρωμένα ή καταχωρήστε παλαιότερο.</Hint>
              )}
              {!loading && cards.length > 0 && visibleCards.length === 0 && (
                <Hint>Κανένα έργο δεν ταιριάζει με την αναζήτηση ή το φίλτρο.</Hint>
              )}
              {visibleCards.map((card) => {
                const isActive = card.id === selectedId;
                return (
                  <Card
                    key={card.id}
                    $ready={!!card.ready}
                    $active={isActive}
                    onClick={() => selectCard(card.id)}
                    aria-current={isActive ? 'true' : undefined}
                    title={card.title}
                  >
                    <CardTopRow>
                      <StatusDot $ready={!!card.ready} />
                      <CardStatusText $ready={!!card.ready}>
                        {card.ready ? 'Έτοιμο' : 'Εκκρεμές'}
                      </CardStatusText>
                      {card.amountChangedBadge && <MicroPill $tone="warn">Νέο ποσό</MicroPill>}
                      {card.source === 'legacy' && <MicroPill>Παλαιότερο</MicroPill>}
                      {(() => {
                        const photoState = getPhotoRequestUiState(card, meta.vizModes);
                        if (photoState.status === 'awaiting' || photoState.status === 'reminder') {
                          return (
                            <MicroPill $tone="warn">{photoState.label || 'Αναμονή φωτο'}</MicroPill>
                          );
                        }
                        return null;
                      })()}
                    </CardTopRow>
                    <CardTitle $active={isActive}>{card.title}</CardTitle>
                    <CardAmount>{formatAmount(card.approvedAmount)}</CardAmount>
                    <CardMetaText>
                      {categoryLabel(card.categoryId) || 'Χωρίς κατηγορία'}
                    </CardMetaText>
                    <CardMetaText>
                      {card.area ? `${card.area} · ` : ''}
                      {vizLabel(card.primaryViz) || 'Χωρίς τρόπο προβολής'}
                    </CardMetaText>
                  </Card>
                );
              })}
            </ListScroll>
          </Panel>

          <EditPanel>
            <EditPanelHead>
              <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {editing ? 'Επεξεργασία κάρτας' : 'Στοιχεία επιλεγμένου έργου'}
              </div>
              <div style={{
                fontSize: '1.02rem', fontWeight: 800, marginTop: 4, letterSpacing: '0.01em',
                textShadow: '0 2px 10px rgba(15,23,42,0.2)', lineHeight: 1.3,
              }}>
                {selected?.title || 'Επιλέξτε κάρτα από τη λίστα αριστερά'}
              </div>
              {selected?.area && (
                <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 600, marginTop: 2 }}>
                  {selected.area}
                </div>
              )}
            </EditPanelHead>
            <EditPanelBody>
              {!selected || !draft ? (
                <Hint>Επιλέξτε κάρτα από τη λίστα για να δείτε και να συμπληρώσετε τα στοιχεία της.</Hint>
              ) : (
                <>
                  <StatusStrip>
                    <StatusStripMain>
                      <StatusPill $ok={!!selected.ready}>
                        {selected.ready ? 'Έτοιμη' : 'Εκκρεμεί'}
                      </StatusPill>
                      <StatusMeta>
                        {selected.source === 'legacy' ? 'Παλαιότερο έργο' : 'Συνδεδεμένο υποέργο'}
                      </StatusMeta>
                      {editing ? <StatusMeta>· Επεξεργασία</StatusMeta> : null}
                      {isDirty ? <StatusMeta>· Μη αποθηκευμένες αλλαγές</StatusMeta> : null}
                    </StatusStripMain>
                    <StatusGap>{editGapLine}</StatusGap>
                  </StatusStrip>

                  {selected.amountChangedBadge && (
                    <EditSection>
                      <Badge $tone="warn">Άλλαξαν τα ποσά από το συνδεδεμένο υποέργο</Badge>
                      <GhostBtn type="button" onClick={dismissBadge} style={{ marginLeft: 8 }}>Εντάξει</GhostBtn>
                    </EditSection>
                  )}

                  {!editing ? (
                    <>
                      <ZoneCard>
                        <EditSectionTitle>Ταυτότητα & παρουσίαση</EditSectionTitle>
                        <ViewGrid>
                          <ViewRow>
                            <ViewLabel>Κατηγορία</ViewLabel>
                            <ViewValue>
                              {categoryLabel(selected.categoryId) || <Empty>Δεν έχει οριστεί</Empty>}
                            </ViewValue>
                          </ViewRow>
                          <ViewRow>
                            <ViewLabel>Κύριος τρόπος</ViewLabel>
                            <ViewValue>
                              {selected.primaryViz
                                ? <Chip>{vizLabel(selected.primaryViz)}</Chip>
                                : <Empty>Δεν έχει επιλεγεί</Empty>}
                            </ViewValue>
                          </ViewRow>
                          <ViewRow>
                            <ViewLabel>Δευτερεύων</ViewLabel>
                            <ViewValue>
                              {selected.secondaryViz
                                ? <Chip>{vizLabel(selected.secondaryViz)}</Chip>
                                : <Empty>Κανένας</Empty>}
                            </ViewValue>
                          </ViewRow>
                          <ViewRow $wide>
                            <ViewLabel>Σύντομο κείμενο</ViewLabel>
                            <ViewValue>
                              {selected.narrative || <Empty>Δεν έχει συμπληρωθεί</Empty>}
                            </ViewValue>
                          </ViewRow>
                        </ViewGrid>
                      </ZoneCard>

                      <ZoneCard>
                        <EditSectionTitle>Ποσά παρουσίασης</EditSectionTitle>
                        <ViewGrid>
                          <ViewRow>
                            <ViewLabel>Εγκεκριμένο</ViewLabel>
                            <ViewValue>{formatAmount(selected.approvedAmount)}</ViewValue>
                          </ViewRow>
                          <ViewRow>
                            <ViewLabel>Συμβατικό</ViewLabel>
                            <ViewValue>{formatAmount(selected.contractAmount)}</ViewValue>
                          </ViewRow>
                          {(selected.hasFinalContractAmountAfterApe || selected.finalContractAmountAfterApe) ? (
                            <ViewRow $wide>
                              <ViewLabel>Τελικό μετά ΑΠΕ</ViewLabel>
                              <ViewValue>
                                {formatAmount(selected.finalContractAmountAfterApe)}
                                {selected.finalContractApeDate
                                  ? ` · ΑΠΕ ${formatDateEl(selected.finalContractApeDate, '')}`
                                  : ''}
                                <div style={{ marginTop: 4, fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                                  {selected.showFinalContractAmountInPresentation
                                    ? 'Εμφανίζεται στην παρουσίαση'
                                    : 'Δεν εμφανίζεται στην παρουσίαση'}
                                </div>
                              </ViewValue>
                            </ViewRow>
                          ) : (
                            <ViewRow $wide>
                              <ViewLabel>Τελικό μετά ΑΠΕ</ViewLabel>
                              <ViewValue><Empty>Δεν υπάρχει καταχωρημένο ΑΠΕ</Empty></ViewValue>
                            </ViewRow>
                          )}
                          <ViewRow>
                            <ViewLabel>Περιοχή</ViewLabel>
                            <ViewValue>{selected.area || <Empty>Δεν έχει οριστεί</Empty>}</ViewValue>
                          </ViewRow>
                          {selected.source === 'legacy' && (
                            <ViewRow>
                              <ViewLabel>Έτος ολοκλήρωσης</ViewLabel>
                              <ViewValue>{selected.completionYear || <Empty>Δεν έχει οριστεί</Empty>}</ViewValue>
                            </ViewRow>
                          )}
                        </ViewGrid>
                      </ZoneCard>

                      {(savedPhotoPhases.length > 0 || selectedNeedsMap || selectedNeedsMetrics) && (
                        <ZoneCard>
                          <EditSectionTitle>Υλικό παρουσίασης</EditSectionTitle>
                          {selected.source === 'linked' && savedPhotoPhases.length > 0 && (
                            <SupervisorStrip style={{ marginBottom: 10 }}>
                              <SupervisorWho>
                                <ZoneEyebrow>Επιβλέπων</ZoneEyebrow>
                                <SupervisorName>
                                  {selected.supervisor?.displayName || 'Δεν έχει καταγραφεί'}
                                </SupervisorName>
                                <SupervisorEmail>
                                  {selected.supervisor?.hasEmail
                                    ? selected.supervisor.email
                                    : (selected.supervisor?.displayName
                                      ? 'Χωρίς email — δεν μπορεί να σταλεί αίτημα'
                                      : 'Καταχωρήστε κύρια χρέωση στην κάρτα του υποέργου')}
                                </SupervisorEmail>
                              </SupervisorWho>
                              {selectedCanRequestPhotos ? (
                                <PrimaryBtn
                                  type="button"
                                  disabled={!selected.supervisor?.hasEmail}
                                  onClick={openPhotoRequest}
                                >
                                  {selected.photoRequestLast?.sentAt
                                    ? 'Ξαναστείλε αίτημα'
                                    : 'Ζήτησε φωτογραφίες'}
                                </PrimaryBtn>
                              ) : null}
                            </SupervisorStrip>
                          )}
                          {savedPhotoPhases.length > 0 && (
                            <>
                              <ZoneEyebrow>Φωτογραφίες</ZoneEyebrow>
                              {(() => {
                                const photoState = getPhotoRequestUiState(selected, meta.vizModes);
                                if (photoState.status === 'awaiting' || photoState.status === 'reminder') {
                                  return (
                                    <Hint style={{ marginBottom: 8 }}>
                                      {photoState.status === 'reminder'
                                        ? `Έχει περάσει πάνω από ${PHOTO_REQUEST_REMINDER_DAYS} ημέρες από το αίτημα και λείπουν ακόμα φωτογραφίες.`
                                        : 'Έχει σταλεί αίτημα φωτογραφιών — αναμονή υλικού.'}
                                      {selected.photoRequestLast?.sentAt
                                        ? ` (τελευταίο: ${formatPhotoRequestSentAt(selected.photoRequestLast.sentAt)})`
                                        : ''}
                                    </Hint>
                                  );
                                }
                                if (photoState.status === 'ready' && selected.photoRequestLast?.sentAt) {
                                  return (
                                    <Hint style={{ marginBottom: 8 }}>
                                      Οι απαιτούμενες φωτογραφίες είναι συμπληρωμένες
                                      {' · '}
                                      αίτημα στις {formatPhotoRequestSentAt(selected.photoRequestLast.sentAt)}.
                                    </Hint>
                                  );
                                }
                                return null;
                              })()}
                              {savedPhotoPhases.map((phase) => (
                                <PhotoPhaseCard key={phase}>
                                  <PhotoPhaseHead>
                                    <PhotoPhaseTitle>{photoPhaseLabel(phase)}</PhotoPhaseTitle>
                                    <PhotoCount>{(selected.photos?.[phase] || []).length}/3</PhotoCount>
                                  </PhotoPhaseHead>
                                  {renderThumbs(phase)}
                                </PhotoPhaseCard>
                              ))}
                            </>
                          )}
                          {selectedNeedsMap && (
                            <div style={{ marginTop: 10 }}>
                              <ZoneEyebrow>Χάρτης</ZoneEyebrow>
                              {hasMapSnapshot(selected) ? (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  title="Κλικ για προβολή"
                                  onClick={() => setViewerPath(selected.mapSnapshot)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setViewerPath(selected.mapSnapshot);
                                    }
                                  }}
                                  style={{
                                    height: 160, borderRadius: 12, border: '1px solid rgba(148,163,184,0.35)',
                                    background: cardMedia[selected.mapSnapshot]
                                      ? `center/cover no-repeat url("${cardMedia[selected.mapSnapshot]}")`
                                      : '#e2e8f0',
                                    cursor: 'pointer',
                                  }}
                                />
                              ) : (
                                <Empty>Δεν έχει αποθηκευτεί ακόμα χάρτης.</Empty>
                              )}
                            </div>
                          )}
                          {selectedNeedsMetrics && (
                            <div style={{ marginTop: 10 }}>
                              <ZoneEyebrow>Αποτελέσματα</ZoneEyebrow>
                              {(selected.metrics || []).length ? (
                                (selected.metrics || []).slice(0, 4).map((m, i) => (
                                  <div key={i} style={{ fontSize: '0.8rem', marginTop: 4, color: '#334155' }}>
                                    <strong>{m.label}</strong>
                                    {' · '}
                                    {m.value}
                                  </div>
                                ))
                              ) : (
                                <Empty>Δεν έχουν συμπληρωθεί αποτελέσματα</Empty>
                              )}
                            </div>
                          )}
                        </ZoneCard>
                      )}

                      <ActionRow>
                        <PrimaryBtn type="button" onClick={startEdit}>Επεξεργασία στοιχείων</PrimaryBtn>
                        <DangerTextBtn type="button" onClick={removeCard} style={{ marginLeft: 8 }}>
                          Αφαίρεση από απολογισμό
                        </DangerTextBtn>
                      </ActionRow>
                    </>
                  ) : (
                    <>
                      <ZoneCard>
                        <EditSectionTitle>1 · Ταυτότητα</EditSectionTitle>
                        <FieldBlock>
                          <Field>
                            Τίτλος
                            {selected.source === 'linked' ? <LockedTag>από υποέργο</LockedTag> : null}
                          </Field>
                          {selected.source === 'linked' ? (
                            <LockedBox>{draft.title || '—'}</LockedBox>
                          ) : (
                            <Input
                              value={draft.title}
                              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            />
                          )}
                        </FieldBlock>
                        <FieldBlock>
                          <Field>Κατηγορία απολογισμού</Field>
                          <SelectInput
                            value={draft.categoryId}
                            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                          >
                            <option value="">— Επιλογή —</option>
                            {(meta.categories || []).map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </SelectInput>
                          {selected.suggestedCategoryId && !selected.categoryId && (
                            <Hint>
                              Πρόταση:
                              {' '}
                              {(meta.categories || []).find((c) => c.id === selected.suggestedCategoryId)?.label}
                            </Hint>
                          )}
                        </FieldBlock>
                        <FieldBlock>
                          <Field>
                            Περιοχή
                            {selected.source === 'legacy' ? ' (υποχρεωτική)' : ''}
                          </Field>
                          <Input
                            value={draft.area}
                            onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                            placeholder="π.χ. Αρχάνες, Αστερούσια…"
                          />
                        </FieldBlock>
                        {selected.source === 'legacy' && (
                          <FieldBlock>
                            <Field>Έτος ολοκλήρωσης</Field>
                            <Input
                              value={draft.completionYear}
                              onChange={(e) => setDraft({ ...draft, completionYear: e.target.value })}
                            />
                          </FieldBlock>
                        )}
                          <Field>Γραμμή αντίκτυπου (προαιρετικό)</Field>
                          <Input
                            value={draft.impactLine || ''}
                            onChange={(e) => {
                              const raw = String(e.target.value || '').replace(/\r?\n+/g, ' ');
                              const trailing = /\s$/.test(raw);
                              const words = raw.trim().split(/\s+/).filter(Boolean);
                              const limited = words.slice(0, 14).join(' ');
                              const next = (trailing && words.length < 14 ? `${limited} ` : limited)
                                .slice(0, 140);
                              setDraft({ ...draft, impactLine: next });
                            }}
                            placeholder="π.χ. Νερό άρδευσης για 120 αγρότες της περιοχής"
                            maxLength={140}
                          />
                          <CompactTip style={{ marginTop: 6 }}>
                            Μία σύντομη πρόταση κάτω από τον τίτλο (έως 14 λέξεις / 140 χαρακτήρες).
                            {' '}
                            {(() => {
                              const n = String(draft.impactLine || '').trim().split(/\s+/).filter(Boolean).length;
                              return n ? `(${n}/14 λέξεις)` : '';
                            })()}
                          </CompactTip>
                          <EmphasisBlock $on={draftNeedsNarrative} style={{ marginTop: 12 }}>
                            {draftNeedsNarrative && (
                              <EmphasisTag>Κύριο περιεχόμενο για «Μόνο κείμενο»</EmphasisTag>
                            )}
                            <Field>{narrativeFieldLabel}</Field>
                            <TextArea
                              value={draft.narrative}
                              onChange={(e) => setDraft({ ...draft, narrative: e.target.value })}
                              placeholder="π.χ. Ολοκληρώθηκε η ανάπλαση της πλατείας…"
                            />
                          </EmphasisBlock>
                      </ZoneCard>

                      <ZoneCard>
                        <EditSectionTitle>2 · Ποσά παρουσίασης</EditSectionTitle>
                        {draftNeedsAmounts && (
                          <CompactTip>Τα ποσά θα εμφανιστούν μεγάλα ως κύριο περιεχόμενο της σελίδας.</CompactTip>
                        )}
                        <FieldGrid>
                          <FieldBlock>
                            <Field>Εγκεκριμένο</Field>
                            <EmphasisBlock $on={draftNeedsAmounts} style={{ marginBottom: 0 }}>
                              <Input
                                value={draft.approvedAmount}
                                onChange={(e) => setDraft({ ...draft, approvedAmount: e.target.value })}
                              />
                            </EmphasisBlock>
                          </FieldBlock>
                          <FieldBlock>
                            <Field>Συμβατικό</Field>
                            <EmphasisBlock $on={draftNeedsAmounts} style={{ marginBottom: 0 }}>
                              <Input
                                value={draft.contractAmount}
                                onChange={(e) => setDraft({ ...draft, contractAmount: e.target.value })}
                              />
                            </EmphasisBlock>
                          </FieldBlock>
                        </FieldGrid>
                        <FieldBlock>
                          <Field>
                            Τελικό μετά ΑΠΕ
                            {selected.source === 'linked' ? <LockedTag>από υποέργο</LockedTag> : null}
                          </Field>
                          {selected.source === 'linked' ? (
                            <LockedBox>
                              {draft.finalContractAmountAfterApe
                                ? (
                                  <>
                                    {formatAmount(draft.finalContractAmountAfterApe)}
                                    {draft.finalContractApeDate
                                      ? ` · ΑΠΕ ${formatDateEl(draft.finalContractApeDate, '')}`
                                      : ''}
                                  </>
                                )
                                : 'Δεν υπάρχει ΑΠΕ στο συνδεδεμένο υποέργο'}
                            </LockedBox>
                          ) : (
                            <Input
                              value={draft.finalContractAmountAfterApe}
                              onChange={(e) => setDraft({
                                ...draft,
                                finalContractAmountAfterApe: e.target.value,
                                showFinalContractAmountInPresentation:
                                  e.target.value.trim()
                                    ? draft.showFinalContractAmountInPresentation
                                    : false,
                              })}
                              placeholder="π.χ. 125.000,00"
                            />
                          )}
                          <CheckRow>
                            <input
                              type="checkbox"
                              checked={!!draft.showFinalContractAmountInPresentation}
                              disabled={!String(draft.finalContractAmountAfterApe || '').trim()}
                              onChange={(e) => setDraft({
                                ...draft,
                                showFinalContractAmountInPresentation: e.target.checked,
                              })}
                              style={{ marginTop: 3 }}
                            />
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155', lineHeight: 1.4 }}>
                              Εμφάνιση στην παρουσίαση
                              <span style={{ display: 'block', fontWeight: 500, color: '#64748b', marginTop: 2, fontSize: '0.76rem' }}>
                                Οθόνη / PDF / PowerPoint ως τελικό διαμορφωθέν ποσό
                              </span>
                            </span>
                          </CheckRow>
                        </FieldBlock>
                        {selected.source === 'linked' && (
                          <Hint>Αν λείπει ποσό από το υποέργο, συμπληρώστε το μόνο για τον απολογισμό.</Hint>
                        )}
                      </ZoneCard>

                      <ZoneCard>
                        <EditSectionTitle>3 · Πώς θα φανεί</EditSectionTitle>
                        <FieldGrid>
                          <FieldBlock>
                            <Field>Κύριος τρόπος</Field>
                            <SelectInput
                              value={draft.primaryViz}
                              onChange={(e) => {
                                const next = e.target.value;
                                const allowed = secondaryVizOptions(meta.vizModes, next).map((v) => v.id);
                                const sec = draft.secondaryViz;
                                setDraft({
                                  ...draft,
                                  primaryViz: next,
                                  secondaryViz: (!sec || sec === next || !allowed.includes(sec)) ? '' : sec,
                                });
                              }}
                            >
                              <option value="">— Επιλογή —</option>
                              {(meta.vizModes || []).map((v) => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                              ))}
                            </SelectInput>
                          </FieldBlock>
                          <FieldBlock>
                            <Field>Δευτερεύων (προαιρετικά)</Field>
                            <SelectInput
                              value={draft.secondaryViz || ''}
                              onChange={(e) => setDraft({ ...draft, secondaryViz: e.target.value })}
                            >
                              <option value="">— Καμία —</option>
                              {secondaryVizOptions(meta.vizModes, draft.primaryViz).map((v) => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                              ))}
                            </SelectInput>
                          </FieldBlock>
                        </FieldGrid>
                        {draft.primaryViz && renderVizGuide(draft.primaryViz, 'Κύριος')}
                        {draft.secondaryViz && renderVizGuide(draft.secondaryViz, 'Δευτερεύων')}

                        {materialTabs.length > 0 && (
                          <>
                            <div style={{ marginTop: 14, marginBottom: 6 }}>
                              <ZoneEyebrow>Υλικό παρουσίασης</ZoneEyebrow>
                            </div>
                            <MaterialTabs>
                              {materialTabs.map((t) => (
                                <MaterialTab
                                  key={t.id}
                                  type="button"
                                  $on={materialTab === t.id}
                                  onClick={() => setMaterialTab(t.id)}
                                >
                                  {t.label}
                                </MaterialTab>
                              ))}
                            </MaterialTabs>

                            {materialTab === 'photos' && visiblePhotoPhases.length > 0 && (
                              <>
                                {selected.source === 'linked' && (
                                  <SupervisorStrip>
                                    <SupervisorWho>
                                      <ZoneEyebrow>Επιβλέπων</ZoneEyebrow>
                                      <SupervisorName>
                                        {selected.supervisor?.displayName || 'Δεν έχει καταγραφεί'}
                                      </SupervisorName>
                                      <SupervisorEmail>
                                        {selected.supervisor?.hasEmail
                                          ? selected.supervisor.email
                                          : 'Χωρίς email στον λογαριασμό'}
                                      </SupervisorEmail>
                                    </SupervisorWho>
                                    {selectedCanRequestPhotos ? (
                                      <PrimaryBtn
                                        type="button"
                                        disabled={!selected.supervisor?.hasEmail}
                                        onClick={openPhotoRequest}
                                      >
                                        {selected.photoRequestLast?.sentAt
                                          ? 'Ξαναστείλε αίτημα'
                                          : 'Ζήτησε φωτογραφίες'}
                                      </PrimaryBtn>
                                    ) : (selected.supervisor?.displayName && visiblePhotoPhases.length > 0) ? (
                                      <Hint style={{ margin: 0, maxWidth: 220 }}>
                                        Αποθηκεύστε την κάρτα για να ενεργοποιηθεί το αίτημα φωτογραφιών.
                                      </Hint>
                                    ) : null}
                                  </SupervisorStrip>
                                )}
                                <Hint style={{ marginTop: 0, marginBottom: 8 }}>
                                  Έως 3 φωτογραφίες ανά φάση · η πρώτη είναι η κύρια στην παρουσίαση.
                                </Hint>
                                {visiblePhotoPhases.map((phase) => {
                                  const list = selected.photos?.[phase] || [];
                                  return (
                                    <PhotoPhaseCard key={phase}>
                                      <PhotoPhaseHead>
                                        <PhotoPhaseTitle>{photoPhaseLabel(phase)}</PhotoPhaseTitle>
                                        <PhotoCount>{list.length}/3</PhotoCount>
                                      </PhotoPhaseHead>
                                      <GhostBtn type="button" onClick={() => uploadPhotos(phase)} disabled={list.length >= 3}>
                                        {list.length >= 3 ? 'Η φάση είναι πλήρης' : 'Προσθήκη φωτογραφιών'}
                                      </GhostBtn>
                                      {list.map((rel, idx) => (
                                        <PhotoItem key={`${phase}-${idx}-${rel}`}>
                                          <PhotoMini
                                            onClick={() => setViewerPath(rel)}
                                            title="Προβολή"
                                            style={{ backgroundImage: cardMedia[rel] ? `url("${cardMedia[rel]}")` : undefined }}
                                          />
                                          <PhotoName title={rel}>
                                            {idx === 0 ? '★ Κύρια · ' : `${idx + 1}. `}
                                            {String(rel).split('/').pop()}
                                          </PhotoName>
                                          <MiniBtn type="button" onClick={() => setViewerPath(rel)}>Προβολή</MiniBtn>
                                          <MiniBtn type="button" onClick={() => downloadPhoto(rel)}>Λήψη</MiniBtn>
                                          {idx > 0 && (
                                            <MiniBtn type="button" onClick={() => makePhotoPrimary(phase, rel)}>
                                              Ορισμός ως κύρια
                                            </MiniBtn>
                                          )}
                                          <DangerMiniBtn type="button" onClick={() => removePhoto(phase, rel)}>
                                            Διαγραφή
                                          </DangerMiniBtn>
                                        </PhotoItem>
                                      ))}
                                    </PhotoPhaseCard>
                                  );
                                })}
                              </>
                            )}

                            {materialTab === 'map' && draftNeedsMap && (
                              <>
                                {hasMapSnapshot(selected) ? (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    title="Προβολή"
                                    onClick={() => setViewerPath(selected.mapSnapshot)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setViewerPath(selected.mapSnapshot);
                                      }
                                    }}
                                    style={{
                                      height: 160, borderRadius: 12, border: '1px solid rgba(148,163,184,0.35)',
                                      background: cardMedia[selected.mapSnapshot]
                                        ? `center/cover no-repeat url("${cardMedia[selected.mapSnapshot]}")`
                                        : '#e2e8f0',
                                      marginBottom: 8, cursor: 'pointer',
                                    }}
                                  />
                                ) : (
                                  <Empty>Δεν έχει αποθηκευτεί ακόμα χάρτης.</Empty>
                                )}
                                <Hint>
                                  {draftMinMapPoints >= 2
                                    ? 'Απαιτούνται τουλάχιστον 2 σημεία.'
                                    : 'Απαιτείται τουλάχιστον ένα στοιχείο σχεδίασης.'}
                                  {' '}
                                  Χρειάζεται για: {draftMapVizLabels}.
                                </Hint>
                                <ActionRow>
                                  {hasMapSnapshot(selected) && (
                                    <GhostBtn type="button" onClick={() => setViewerPath(selected.mapSnapshot)}>
                                      Προβολή χάρτη
                                    </GhostBtn>
                                  )}
                                  <PrimaryBtn
                                    type="button"
                                    onClick={async () => {
                                      if (isDirty) {
                                        const ok = await saveDraft({ silent: true });
                                        if (!ok) return;
                                      }
                                      setMapEditorOpen(true);
                                    }}
                                  >
                                    Άνοιγμα επεξεργαστή χάρτη
                                  </PrimaryBtn>
                                </ActionRow>
                              </>
                            )}

                            {materialTab === 'metrics' && draftNeedsMetrics && (
                              <>
                                <SectionHeadRow style={{ margin: '0 0 8px', padding: '0.4rem 0' }}>
                                  <SectionHeadTitle style={{ borderLeft: 'none', paddingLeft: 0 }}>
                                    Αποτελέσματα
                                  </SectionHeadTitle>
                                  <InfoIconBtn
                                    type="button"
                                    title="Παράδειγμα"
                                    aria-label="Παράδειγμα"
                                    onClick={() => setMetricsHelpOpen(true)}
                                  >
                                    i
                                  </InfoIconBtn>
                                </SectionHeadRow>
                                <Hint style={{ marginTop: 0, marginBottom: 8 }}>
                                  Στήλες «{METRICS_COLUMNS[0].title}» και «{METRICS_COLUMNS[1].title}» · έως {METRICS_MAX_ROWS} γραμμές.
                                  Χρειάζεται για: {draftMetricsVizLabels}.
                                </Hint>
                                <MetricsTable>
                                  <MetricsHead>
                                    <div>{METRICS_COLUMNS[0].title}</div>
                                    <div>{METRICS_COLUMNS[1].title}</div>
                                    <div />
                                  </MetricsHead>
                                  {(draft.metrics || []).map((row, idx) => (
                                    <MetricsRow key={idx}>
                                      <MetricsCellInput
                                        value={row.label}
                                        placeholder={METRICS_COLUMNS[0].hint}
                                        onChange={(e) => setDraft({
                                          ...draft,
                                          metrics: updateMetricsRow(draft.metrics, idx, { label: e.target.value }),
                                        })}
                                      />
                                      <MetricsCellInput
                                        value={row.value}
                                        placeholder={METRICS_COLUMNS[1].hint}
                                        onChange={(e) => setDraft({
                                          ...draft,
                                          metrics: updateMetricsRow(draft.metrics, idx, { value: e.target.value }),
                                        })}
                                      />
                                      <MetricsDelBtn
                                        type="button"
                                        title="Διαγραφή γραμμής"
                                        disabled={(draft.metrics || []).length <= 1}
                                        onClick={() => setDraft({
                                          ...draft,
                                          metrics: removeMetricsRow(draft.metrics, idx),
                                        })}
                                      >
                                        ×
                                      </MetricsDelBtn>
                                    </MetricsRow>
                                  ))}
                                </MetricsTable>
                                <ActionRow style={{ marginTop: 10 }}>
                                  <GhostBtn
                                    type="button"
                                    disabled={(draft.metrics || []).length >= METRICS_MAX_ROWS}
                                    onClick={() => setDraft({
                                      ...draft,
                                      metrics: addMetricsRow(draft.metrics),
                                    })}
                                  >
                                    {(draft.metrics || []).length >= METRICS_MAX_ROWS
                                      ? `Μέγιστο ${METRICS_MAX_ROWS} γραμμές`
                                      : 'Προσθήκη γραμμής'}
                                  </GhostBtn>
                                </ActionRow>
                              </>
                            )}
                          </>
                        )}
                      </ZoneCard>

                      {!selected.ready && selected.readinessErrors?.length > 0 && (
                        <Err>{selected.readinessErrors.join(' · ')}</Err>
                      )}
                    </>
                  )}
                </>
              )}
            </EditPanelBody>
            {editing && selected && draft ? (
              <StickyEditBar>
                <StickyEditInner>
                  <PrimaryBtn type="button" onClick={() => saveDraft()}>Αποθήκευση κάρτας</PrimaryBtn>
                  <GhostBtn type="button" onClick={cancelEdit}>Άκυρο</GhostBtn>
                  <DangerTextBtn type="button" onClick={removeCard}>
                    Αφαίρεση από απολογισμό
                  </DangerTextBtn>
                </StickyEditInner>
              </StickyEditBar>
            ) : null}
          </EditPanel>
        </Grid>
      </Body>

      {metricsHelpOpen && (
        <ModalBack onClick={() => setMetricsHelpOpen(false)}>
          <ModalBox onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <PanelTitle>{METRICS_EXAMPLE.title}</PanelTitle>
            <Hint style={{ marginTop: 4 }}>
              {METRICS_EXAMPLE.note}
            </Hint>
            <div style={{ marginTop: 14 }}>
              <Field style={{ marginBottom: 6 }}>Ονόματα στηλών (σταθερά)</Field>
              <ViewGrid>
                {METRICS_EXAMPLE.columns.map((col) => (
                  <ViewRow key={col.id}>
                    <ViewLabel>Στήλη</ViewLabel>
                    <ViewValue><Chip>{col.title}</Chip></ViewValue>
                  </ViewRow>
                ))}
              </ViewGrid>
            </div>
            <Field style={{ marginTop: 12, marginBottom: 4 }}>Παράδειγμα στησίματος</Field>
            <ExampleTable>
              <ExampleHead>
                <div>{METRICS_EXAMPLE.columns[0].title}</div>
                <div>{METRICS_EXAMPLE.columns[1].title}</div>
              </ExampleHead>
              {METRICS_EXAMPLE.rows.map((row, i) => (
                <ExampleRow key={i} $alt={i % 2 === 1}>
                  <div>{row.label}</div>
                  <div style={{ fontWeight: 700 }}>{row.value}</div>
                </ExampleRow>
              ))}
            </ExampleTable>
            <Hint style={{ marginTop: 10 }}>
              Έτσι θα φαίνεται περίπου στην παρουσίαση: λίγες καθαρές γραμμές με μετρήσεις του έργου — όχι ελεύθερος πίνακας με πολλές στήλες.
            </Hint>
            <ActionRow>
              <PrimaryBtn type="button" onClick={() => setMetricsHelpOpen(false)}>Κατάλαβα</PrimaryBtn>
            </ActionRow>
          </ModalBox>
        </ModalBack>
      )}

      {eligibleOpen && (
        <ModalBack onClick={() => setEligibleOpen(false)}>
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <PanelTitle>Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου</PanelTitle>
            {eligible.length === 0 && <Hint>Δεν υπάρχουν διαθέσιμα υποέργα προς ένταξη.</Hint>}
            {eligible.map((s) => (
              <Card key={s.subprojectId} $ready onClick={() => addLinked(s.subprojectId)}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.38 }}>
                  {s.title}
                </div>
                <Hint>{s.projectStatus} · Εγκρ. {formatAmount(s.approvedAmount)}</Hint>
              </Card>
            ))}
            <ActionRow>
              <GhostBtn type="button" onClick={() => setEligibleOpen(false)}>Κλείσιμο</GhostBtn>
            </ActionRow>
          </ModalBox>
        </ModalBack>
      )}

      {legacyOpen && (
        <ModalBack onClick={() => setLegacyOpen(false)}>
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <PanelTitle>Καταχώρηση παλαιότερου έργου</PanelTitle>
            <Hint>Δεν εισάγεται στην κεντρική σελίδα ούτε στα ολοκληρωμένα.</Hint>
            <FieldBlock style={{ marginTop: '0.7rem' }}>
              <Field>Τίτλος</Field>
              <Input value={legacyForm.title} onChange={(e) => setLegacyForm({ ...legacyForm, title: e.target.value })} />
            </FieldBlock>
            <FieldGrid>
              <FieldBlock>
                <Field>Περιοχή</Field>
                <Input value={legacyForm.area} onChange={(e) => setLegacyForm({ ...legacyForm, area: e.target.value })} />
              </FieldBlock>
              <FieldBlock>
                <Field>Έτος ολοκλήρωσης</Field>
                <Input value={legacyForm.completionYear} onChange={(e) => setLegacyForm({ ...legacyForm, completionYear: e.target.value })} />
              </FieldBlock>
              <FieldBlock>
                <Field>Εγκεκριμένο ποσό</Field>
                <Input value={legacyForm.approvedAmount} onChange={(e) => setLegacyForm({ ...legacyForm, approvedAmount: e.target.value })} />
              </FieldBlock>
              <FieldBlock>
                <Field>Συμβατικό ποσό</Field>
                <Input value={legacyForm.contractAmount} onChange={(e) => setLegacyForm({ ...legacyForm, contractAmount: e.target.value })} />
              </FieldBlock>
            </FieldGrid>
            <FieldBlock style={{ marginTop: '0.55rem' }}>
              <Field>Τελικό διαμορφωθέν ποσό (μετά ΑΠΕ) — προαιρετικό</Field>
              <Input
                value={legacyForm.finalContractAmountAfterApe}
                onChange={(e) => setLegacyForm({
                  ...legacyForm,
                  finalContractAmountAfterApe: e.target.value,
                  showFinalContractAmountInPresentation: e.target.value.trim()
                    ? legacyForm.showFinalContractAmountInPresentation
                    : false,
                })}
                placeholder="Αν υπήρξαν αναθεωρήσεις ΑΠΕ"
              />
              <Hint style={{ marginTop: 6 }}>
                Το τελικό ποσό σύμβασης μετά από αναθεωρήσεις. Ισχύει το πιο πρόσφατο ΑΠΕ.
              </Hint>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!legacyForm.showFinalContractAmountInPresentation}
                  disabled={!String(legacyForm.finalContractAmountAfterApe || '').trim()}
                  onChange={(e) => setLegacyForm({
                    ...legacyForm,
                    showFinalContractAmountInPresentation: e.target.checked,
                  })}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                  Εμφάνιση στην παρουσίαση ως τελικό διαμορφωθέν ποσό μετά ΑΠΕ
                </span>
              </label>
            </FieldBlock>
            <ActionRow>
              <PrimaryBtn type="button" onClick={addLegacy}>Καταχώρηση</PrimaryBtn>
              <GhostBtn type="button" onClick={() => setLegacyOpen(false)}>Άκυρο</GhostBtn>
            </ActionRow>
          </ModalBox>
        </ModalBack>
      )}

      {photoRequestOpen && selected && (
        <ModalBack onClick={() => !photoRequestBusy && setPhotoRequestOpen(false)}>
          <ModalBox onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <EditSectionTitle style={{ marginBottom: 8 }}>Αίτημα φωτογραφιών προς επιβλέποντα</EditSectionTitle>
            <Hint style={{ marginBottom: 12 }}>
              Θα σταλεί email στον επιβλέποντα
              {' '}
              <strong>{selected.supervisor?.displayName || '—'}</strong>
              {selected.supervisor?.email ? ` (${selected.supervisor.email})` : ''}
              , στο πλαίσιο του Απολογισμού Τεχνικού Έργου
              {period?.label || period?.name
                ? ` για την περίοδο «${period.label || period.name}»`
                : ''}
              .
            </Hint>
            <div
              style={{
                marginBottom: 14,
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                fontSize: '0.84rem',
                color: '#334155',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>Τι θα ζητηθεί</div>
              <div>
                Φωτογραφίες
                {' '}
                <strong>
                  {savedPhotoPhases.map((p) => photoPhaseLabel(p)).join(' / ') || '—'}
                </strong>
                {' '}
                (έως 3 φωτογραφίες ανά φάση)
              </div>
              {selected.projectTitle ? (
                <div style={{ marginTop: 4 }}>
                  Πράξη:
                  {' '}
                  {selected.projectTitle}
                </div>
              ) : null}
              <div style={{ marginTop: 4 }}>
                Υποέργο:
                {' '}
                {selected.title || '—'}
              </div>
            </div>
            <Field style={{ display: 'block', marginBottom: 6 }}>Προθεσμία αποστολής (προαιρετικά)</Field>
            <Input
              value={photoRequestDeadline}
              onChange={(e) => setPhotoRequestDeadline(e.target.value)}
              placeholder="π.χ. 20/08/2026"
              disabled={photoRequestBusy}
            />
            <Field style={{ display: 'block', margin: '12px 0 6px' }}>Σημείωση προς τον επιβλέποντα (προαιρετικά)</Field>
            <TextArea
              rows={3}
              value={photoRequestNote}
              onChange={(e) => setPhotoRequestNote(e.target.value)}
              placeholder="Σύντομη σημείωση…"
              disabled={photoRequestBusy}
            />
            <Hint style={{ marginTop: 10 }}>
              Το μήνυμα αναφέρει διακριτικά ότι απεστάλη μέσω ERGOHUB για τον Απολογισμό Τεχνικού Έργου.
            </Hint>
            <ActionRow style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <GhostBtn
                type="button"
                disabled={photoRequestBusy}
                onClick={() => setPhotoRequestOpen(false)}
              >
                Άκυρο
              </GhostBtn>
              <PrimaryBtn type="button" disabled={photoRequestBusy} onClick={sendPhotoRequest}>
                {photoRequestBusy ? 'Αποστολή…' : 'Αποστολή email'}
              </PrimaryBtn>
            </ActionRow>
          </ModalBox>
        </ModalBack>
      )}

      {presentation && slide && (() => {
        const theme = presentationMeta.theme || {
          bg: '#0f172a', surface: '#fff', text: '#0f172a', muted: '#64748b',
          accent: '#2563eb', accentText: '#fff', darkBand: '#1e293b', darkText: '#fff',
        };
        const design = presentationMeta.design || resolveSlideDesign({}, theme);
        const footer = buildFooter({
          design,
          organizationTitle: presentationMeta.organizationTitle,
          periodLabel: presentationMeta.periodLabel,
          index: slideIndex,
          total: presentation.length,
        });
        const closePresentation = () => {
          clearPresentationMotion();
          setPresentation(null);
          setPresentationMeta({ theme: null, cover: null, motion: null });
        };
        const motionOn = presentationMeta.motion?.enabled === true;
        return (
        <PresentOverlay $bg={design.colors.darkBand}>
          <PresentTop>
            <div>{slideIndex + 1} / {presentation.length}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                type="button"
                disabled={slideIndex <= 0 && presentTargetRef.current == null}
                onClick={() => {
                  const base = presentTargetRef.current != null ? presentTargetRef.current : slideIndex;
                  goToPresentationSlide(base - 1);
                }}
              >←</Btn>
              <Btn
                type="button"
                disabled={slideIndex >= presentation.length - 1 && (presentTargetRef.current == null || presentTargetRef.current >= presentation.length - 1)}
                onClick={() => {
                  const base = presentTargetRef.current != null ? presentTargetRef.current : slideIndex;
                  goToPresentationSlide(base + 1);
                }}
              >→</Btn>
              <Btn type="button" onClick={closePresentation}>Κλείσιμο</Btn>
            </div>
          </PresentTop>
          <PresentBody ref={stageWrapRef}>
            <PresentFade $opacity={presentFade} $motion={motionOn}>
              <PresentStage
                style={{ width: SLIDE_W * stageScale, height: SLIDE_H * stageScale }}
              >
                <PresentStageInner
                  style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${stageScale})` }}
                >
                  <ApologismosSlideView
                    slide={slide}
                    design={design}
                    footer={footer}
                    mediaUrls={mediaUrls}
                    coverImages={slide.cover?.images || presentationMeta.cover?.images || []}
                    branding={presentationMeta.branding}
                  />
                </PresentStageInner>
              </PresentStage>
            </PresentFade>
          </PresentBody>
        </PresentOverlay>
        );
      })()}

      {appearanceOpen && (
        <ApologismosAppearanceEditor
          open={appearanceOpen}
          onClose={() => setAppearanceOpen(false)}
          username={username}
          periodId={periodId}
          period={period}
          report={report}
          appConfig={appConfig}
          showToast={showToast}
          onSaved={(res) => applyReport(res)}
        />
      )}

      {mapEditorOpen && selected && (
        <ApologismosMapEditor
          open={mapEditorOpen}
          card={selected}
          username={username}
          periodId={periodId}
          showToast={showToast}
          onClose={() => setMapEditorOpen(false)}
          onSaved={(res) => {
            applyReport(res);
            if (editing && res?.card) setDraft(buildDraft(res.card));
          }}
        />
      )}

      {viewerItem && (
        <ViewerBack onClick={() => setViewerPath(null)}>
          <ViewerHead onClick={(e) => e.stopPropagation()}>
            <div>
              <ViewerPhase>{photoPhaseLabel(viewerItem.phase)}</ViewerPhase>
              <ViewerTitle>
                {isMapViewerItem(viewerItem)
                  ? 'Στιγμιότυπο χάρτη παρουσίασης'
                  : (viewerItem.idx === 0 ? '★ Κύρια φωτογραφία' : `${viewerItem.idx + 1}η φωτογραφία`)}
                {' · '}
                {String(viewerItem.rel).split('/').pop()}
              </ViewerTitle>
            </div>
            <ViewerPos>
              {viewerIndex + 1} από {viewerPhotos.length} · {selected?.title || ''}
            </ViewerPos>
          </ViewerHead>

          <ViewerStage onClick={(e) => e.stopPropagation()}>
            {cardMedia[viewerItem.rel] ? (
              <ViewerImg
                src={cardMedia[viewerItem.rel]}
                alt={photoPhaseLabel(viewerItem.phase)}
                style={isMapViewerItem(viewerItem) ? { objectFit: 'contain', background: '#0f172a' } : undefined}
              />
            ) : (
              <div style={{ color: '#cbd5e1', fontWeight: 700 }}>
                {isMapViewerItem(viewerItem) ? 'Φόρτωση χάρτη…' : 'Φόρτωση φωτογραφίας…'}
              </div>
            )}
            {viewerPhotos.length > 1 && (
              <>
                <ViewerArrow
                  type="button"
                  $side="left"
                  onClick={() => stepViewer(-1)}
                  aria-label="Προηγούμενη"
                >
                  ‹
                </ViewerArrow>
                <ViewerArrow
                  type="button"
                  $side="right"
                  onClick={() => stepViewer(1)}
                  aria-label="Επόμενη"
                >
                  ›
                </ViewerArrow>
              </>
            )}
          </ViewerStage>

          <ViewerBar onClick={(e) => e.stopPropagation()}>
            <ViewerPrimaryBtn type="button" onClick={() => downloadPhoto(viewerItem.rel)}>
              {isMapViewerItem(viewerItem) ? 'Λήψη χάρτη' : 'Λήψη φωτογραφίας'}
            </ViewerPrimaryBtn>
            {isMapViewerItem(viewerItem) ? (
              <ViewerBtn
                type="button"
                onClick={() => {
                  setViewerPath(null);
                  setMapEditorOpen(true);
                }}
              >
                Επεξεργασία χάρτη
              </ViewerBtn>
            ) : (
              <>
                {viewerItem.idx > 0 && (
                  <ViewerBtn type="button" onClick={() => makePhotoPrimary(viewerItem.phase, viewerItem.rel)}>
                    Ορισμός ως κύρια
                  </ViewerBtn>
                )}
                <ViewerDangerBtn
                  type="button"
                  onClick={async () => {
                    const ok = await showConfirm({
                      title: 'Διαγραφή φωτογραφίας',
                      message: 'Να διαγραφεί οριστικά αυτή η φωτογραφία;',
                      confirmLabel: 'Διαγραφή',
                      cancelLabel: 'Άκυρο',
                      danger: true,
                      icon: '🗑',
                    });
                    if (!ok) return;
                    removePhoto(viewerItem.phase, viewerItem.rel);
                  }}
                >
                  Διαγραφή
                </ViewerDangerBtn>
              </>
            )}
            <ViewerBtn type="button" onClick={() => setViewerPath(null)}>Κλείσιμο</ViewerBtn>
          </ViewerBar>

          {viewerPhotos.length > 1 && (
            <ViewerStrip onClick={(e) => e.stopPropagation()}>
              {viewerPhotos.map((p) => (
                <ViewerStripItem
                  key={p.rel}
                  $on={p.rel === viewerItem.rel}
                  onClick={() => setViewerPath(p.rel)}
                  title={isMapViewerItem(p)
                    ? 'Χάρτης έργου'
                    : `${photoPhaseLabel(p.phase)} · ${p.idx === 0 ? 'Κύρια' : `${p.idx + 1}η`}`}
                  style={{ backgroundImage: cardMedia[p.rel] ? `url("${cardMedia[p.rel]}")` : undefined }}
                />
              ))}
            </ViewerStrip>
          )}
        </ViewerBack>
      )}
    </Overlay>
  );
}
