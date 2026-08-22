import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import ProsklisisForm from './ProsklisisForm';
import ProsklisisFileManager from './ProsklisisFileManager';
import ProsklisiModificationForm from './ProsklisiModificationForm';
import ProsklisisExportDialog from './ProsklisisExportDialog';
import { formatDateEl } from '../utils/dateFormat';
import { containsSearchTerm } from '../utils/searchUtils';
import LinkedNoteSticker, { getEntityLinkedNotes } from './LinkedNoteSticker';
import { showConfirm } from '../utils/confirmModal';
import {
  getProsklisiDiavgeiaEntry,
  openProsklisiDiavgeiaDocument,
  buildProsklisiDiavgeiaRegistryEntry,
} from '../utils/prosklisiDiavgeiaRegistry';
import {
  compareProskliseisByDeadline,
  getEffectiveProsklisiDeadline,
  getProsklisiDeadlineChipMeta,
  getProsklisiViewTab,
  partitionProskliseisByViewTab,
  PROSKLISI_VIEW_TABS,
  applyProsklisiDailyFilters,
  showNewProsklisiButton,
  evaluateProsklisiDelete,
} from '../utils/prosklisiDeadlineUtils';

const ipcRenderer = window.electronAPI;

const truncateText = (text, maxLen = 100) => {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
};

const defaultModsExpanded = () => false;

function getModificationDiavgeiaEntry(mod) {
  if (mod?.diavgeiaDocument) return mod.diavgeiaDocument;
  if (mod?.diavgeiaMeta?.ada) {
    return buildProsklisiDiavgeiaRegistryEntry(mod.diavgeiaMeta, { roleLabel: 'Τροποποίηση' });
  }
  return null;
}

const MENU_WIDTH = 210;
const MENU_EST_HEIGHT = 168;

function computeMenuPosition(buttonEl) {
  const rect = buttonEl.getBoundingClientRect();
  let dropUp = false;
  if (rect.bottom + MENU_EST_HEIGHT > window.innerHeight - 12) dropUp = true;
  let top = dropUp ? rect.top - MENU_EST_HEIGHT - 6 : rect.bottom + 6;
  let left = rect.right - MENU_WIDTH;
  if (left < 8) left = 8;
  if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
  if (top < 8) top = 8;
  return { top, left };
}

/* ────────── Styled Components ────────── */

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 0.65rem 1cm;
  overflow-y: auto;
  box-sizing: border-box;
  @media (min-width: 900px) { padding: 0.85rem 1cm; }
`;

const ModalContainer = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 0;
  width: 100%;
  max-width: 1920px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.95);
  margin-top: 0.35rem;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;

const ModalTopSection = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.98);
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #e2e8f0;
`;

const PanelTitle = styled.h2`
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.02em;
  line-height: 1.2;
  &::before {
    content: '';
    width: 3px;
    height: 1.15rem;
    border-radius: 3px;
    background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
    flex-shrink: 0;
  }
`;

const PanelCloseButton = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  &:hover { background: #f8fafc; color: #0f172a; border-color: #94a3b8; }
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(148, 163, 184, 0.08) 100%);
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  flex-wrap: wrap;
  align-items: center;
`;

const ToolbarActionButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  ${(props) => props.primary ? `
    background: #4f46e5; color: #f8fafc; border: 1px solid #4338ca;
    &:hover { background: #4338ca; border-color: #3730a3; box-shadow: 0 2px 10px rgba(79, 70, 229, 0.25); }
  ` : `
    background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1;
    &:hover { background: #f8fafc; border-color: #94a3b8; }
  `}
`;

const PanelExportButton = styled.button`
  padding: 0.45rem 0.85rem;
  background: #15803d;
  color: #ffffff;
  border: 1px solid #166534;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  &:hover { background: #166534; }
`;

const ToolbarQuickInput = styled.input`
  flex: 1;
  min-width: 160px;
  max-width: 360px;
  padding: 0.45rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12); }
  &::placeholder { color: #94a3b8; }
`;

const ToolbarFilterSelect = styled.select`
  padding: 0.45rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 0.78rem;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  min-width: 150px;
  max-width: 220px;
  &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12); }
`;

const ToolbarToggleButton = styled.button`
  padding: 0.45rem 0.85rem;
  background: ${(p) => (p.$active ? '#fef2f2' : '#ffffff')};
  color: ${(p) => (p.$active ? '#991b1b' : '#1e293b')};
  border: 1px solid ${(p) => (p.$active ? '#fecaca' : '#cbd5e1')};
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  &:hover {
    background: ${(p) => (p.$active ? '#fee2e2' : '#f8fafc')};
    border-color: ${(p) => (p.$active ? '#f87171' : '#94a3b8')};
  }
`;

const SearchStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.55rem;
  margin-bottom: 0.45rem;
  background: rgba(248, 250, 252, 0.95);
  border-radius: 8px;
  font-size: 0.72rem;
  color: #475569;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
  .stats-section { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
  .stat-item { display: flex; align-items: center; gap: 0.2rem; font-weight: 500; }
  .stat-icon { font-size: 0.72rem; opacity: 0.75; }
  .stat-number { color: #4f46e5; font-weight: 700; }
  .stat-label { color: #64748b; font-weight: 500; }
  .filters-badge {
    background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;
    padding: 0.12rem 0.45rem; border-radius: 999px; font-size: 0.65rem;
    font-weight: 600; display: flex; align-items: center; gap: 0.2rem;
  }
  .filter-icon { font-size: 0.68rem; }
`;

const SearchBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0.45rem 0 0;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const AdvSearchInput = styled.input`
  flex: 1;
  min-width: 160px;
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #1e293b;
  &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
  &::placeholder { color: #94a3b8; }
`;

const AdvDateInput = styled.input`
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #1e293b;
  &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
`;

const AdvFilterSelect = styled.select`
  flex: 1;
  min-width: 160px;
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
`;

const ToolbarClearButton = styled.button`
  padding: 0.65rem 1.25rem;
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  &:hover { background: #f1f5f9; border-color: #94a3b8; }
`;

const ModalScrollSection = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.45rem 1.25rem 1rem;
  border-top: 1px solid #e2e8f0;
`;

const ProsklisisList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const ProjectGroup = styled.div`
  background: #f8fafc;
  border-radius: 12px;
  padding: 0.85rem;
  border: 1px solid #e2e8f0;
  overflow: visible;
`;

const ProjectGroupTitle = styled.h3`
  margin: 0 0 0.65rem 0;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${(p) => p.$color || '#334155'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &::before {
    content: '';
    width: 4px;
    height: 1.1rem;
    border-radius: 2px;
    background: ${(p) => p.$barColor || '#6366f1'};
    flex-shrink: 0;
  }
`;

const GroupCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
`;

/* ── Compact Card ── */

const ViewTabBar = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.65rem 0 0.35rem;
  padding: 0.2rem;
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
`;

const ViewTabBtn = styled.button`
  flex: 1;
  min-width: 140px;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  font-weight: ${(p) => (p.$active ? 700 : 560)};
  cursor: pointer;
  color: ${(p) => (p.$active ? p.$activeColor || '#1e293b' : '#64748b')};
  background: ${(p) => (p.$active ? '#ffffff' : 'transparent')};
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(15, 23, 42, 0.1)' : 'none')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: background 0.15s ease, color 0.15s ease;
  &:hover {
    color: ${(p) => p.$activeColor || '#1e293b'};
    background: ${(p) => (p.$active ? '#ffffff' : 'rgba(255,255,255,0.55)')};
  }
`;

const TabCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 750;
  background: ${(p) => (p.$active ? p.$bg || '#e2e8f0' : '#e2e8f0')};
  color: ${(p) => (p.$active ? p.$fg || '#334155' : '#64748b')};
`;

const CrossTabHint = styled.div`
  margin: 0.35rem 0 0.15rem;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  font-size: 0.78rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
`;

const CrossTabLink = styled.button`
  border: 1px solid #93c5fd;
  background: #fff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;
  &:hover { background: #dbeafe; }
`;

const ProsklisisItem = styled.div`
  background: ${(p) => (p.$muted
    ? 'linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.92) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)')};
  border: 2px solid ${(p) => (p.$muted ? 'rgba(148, 163, 184, 0.95)' : 'rgba(148, 163, 184, 0.55)')};
  border-left: 4px solid ${(p) => {
    if (p.$muted) return '#94a3b8';
    switch (p.$status) {
      case 'Υπό Ωρίμανση': return '#f59e0b';
      case 'Υπό Υποβολή': return '#3b82f6';
      case 'Υποβληθέν': return '#22c55e';
      case 'Υποβληθέν ΤΔΠ': return '#10b981';
      default: return '#94a3b8';
    }
  }};
  border-radius: 12px;
  margin-bottom: 0;
  overflow: hidden;
  position: relative;
  opacity: ${(p) => (p.$isLocked ? 0.72 : (p.$muted ? 0.88 : 1))};
  filter: ${(p) => (p.$muted ? 'saturate(0.78)' : 'none')};
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
  &:hover {
    border-color: rgba(100, 116, 139, 0.75);
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06);
    transform: translateY(-1px);
  }
`;

const CardTopRightCluster = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  z-index: 26;
`;

const LockIndicator = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${(p) => (p.$isLocked ? '#dc3545' : '#28a745')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.15);
  border: 2px solid #ffffff;
`;

const CompactCardBody = styled.div`
  padding: 0.75rem 5.25rem 0.75rem 0.85rem;
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
`;

const CompactMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const CompactTitleRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
`;

const CompactLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const SubjectLine = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.45;
  word-break: break-word;
  ${(p) =>
    p.$singleLine
      ? `display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
      : p.$expanded
        ? `display: block; overflow: visible; white-space: pre-wrap;`
        : `display: -webkit-box; -webkit-line-clamp: ${p.$lineClamp || 2}; -webkit-box-orient: vertical; overflow: hidden;`}
`;

const ExpandLinkButton = styled.button`
  align-self: flex-start;
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.15rem 0;
  text-decoration: underline;
  font-family: inherit;
  &:hover { color: #1d4ed8; }
`;

const MetaChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${(p) => p.$clickable && `cursor: pointer; &:hover { filter: brightness(0.97); }`}
  ${(p) => p.$accent && `
    background: linear-gradient(105deg, rgba(238, 242, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 100%);
    border-color: rgba(165, 180, 252, 0.45);
    color: #312e81;
  `}
  ${(p) => p.$green && `background: #f0fdf4; border-color: #86efac; color: #15803d;`}
  ${(p) => p.$urgency === 'expired' && `
    background: #fef2f2; border-color: #fecaca; color: #b91c1c;
  `}
  ${(p) => p.$urgency === 'urgent' && `
    background: #fff7ed; border-color: #fdba74; color: #c2410c;
  `}
  ${(p) => p.$urgency === 'soon' && `
    background: #fffbeb; border-color: #fcd34d; color: #a16207;
  `}
  ${(p) => p.$urgency === 'ok' && `
    background: #f0fdf4; border-color: #86efac; color: #15803d;
  `}
`;

const LinkedRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.15rem;
`;

const LinkedHint = styled.span`
  font-size: 0.68rem;
  font-weight: 600;
  color: #64748b;
`;

const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  background: ${(p) => {
    switch (p.$status) {
      case 'Υπό Ωρίμανση': return '#fff3cd';
      case 'Υπό Υποβολή': return '#cce5ff';
      case 'Υποβληθέν': return '#d4edda';
      case 'Υποβληθέν ΤΔΠ': return '#c8e6c9';
      default: return '#e9ecef';
    }
  }};
  color: ${(p) => {
    switch (p.$status) {
      case 'Υπό Ωρίμανση': return '#856404';
      case 'Υπό Υποβολή': return '#004085';
      case 'Υποβληθέν': return '#155724';
      case 'Υποβληθέν ΤΔΠ': return '#1b5e20';
      default: return '#495057';
    }
  }};
  border: 1px solid ${(p) => {
    switch (p.$status) {
      case 'Υπό Ωρίμανση': return '#ffc107';
      case 'Υπό Υποβολή': return '#80bdff';
      case 'Υποβληθέν': return '#28a745';
      case 'Υποβληθέν ΤΔΠ': return '#66bb6a';
      default: return '#ced4da';
    }
  }};
`;

const MetaChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
`;

const CompactAside = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const CompactActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const IconBtn = styled.button`
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  ${(p) => p.$filesPrimary ? `
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    color: #f8fafc;
    border: 1px solid #3730a3;
    box-shadow: 0 2px 8px rgba(67, 56, 202, 0.25);
    &:hover { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
  ` : `
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    &:hover { background: #f8fafc; border-color: #94a3b8; }
  `}
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const MenuWrap = styled.div`
  position: relative;
`;

const MenuTrigger = styled(IconBtn)`
  min-width: 32px;
  justify-content: center;
  padding: 0.35rem 0.45rem;
`;

const MenuDropdown = styled.div`
  position: fixed;
  min-width: 210px;
  max-width: min(280px, calc(100vw - 16px));
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  z-index: 10050;
  overflow: hidden;
`;

const MenuItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.85rem;
  border: none;
  background: transparent;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  font-family: inherit;
  &:hover { background: #f8fafc; }
  ${(p) => p.$danger && `color: #991b1b; &:hover { background: #fef2f2; }`}
`;

/* ── Modifications panel (collapsible, amber theme) ── */

const ModsToggleRow = styled.div`
  padding: 0.45rem 0.75rem 0.7rem;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
`;

const ModsToggleButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid ${(p) => (p.$open ? '#f59e0b' : '#fcd34d')};
  background: ${(p) => (p.$open ? '#fef3c7' : '#fffbeb')};
  color: #92400e;
  box-shadow: none;
  &:hover {
    border-color: #f59e0b;
    background: #fef3c7;
  }
`;

const ModsToggleLeft = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModsToggleIcon = styled.span`
  font-size: 1rem;
  line-height: 1;
`;

const ModsCountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #d97706;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
`;

const ModsToggleChevron = styled.span`
  font-size: 0.85rem;
  opacity: 0.85;
  flex-shrink: 0;
`;

const ModificationsPanel = styled.div`
  background: #fffbeb;
  border-top: 1px solid #fde68a;
  padding-bottom: 0.55rem;
  overflow: hidden;
`;

const ModsSectionHeader = styled.h4`
  margin: 0;
  padding: 0.65rem 0.85rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #fde68a;
  background: linear-gradient(90deg, rgba(254, 243, 199, 0.9) 0%, rgba(255, 251, 235, 0.4) 70%);
  &::before {
    content: '';
    width: 4px;
    height: 1.1rem;
    border-radius: 2px;
    background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
    flex-shrink: 0;
  }
`;

const ModTableRow = styled.div`
  margin: 0 0.55rem 0.4rem;
  font-size: 0.78rem;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  box-shadow: 0 1px 2px rgba(217, 119, 6, 0.08);
  overflow: hidden;
  &:first-of-type { margin-top: 0.55rem; }
  &:last-child { margin-bottom: 0.55rem; }
  &:hover { border-color: #fcd34d; box-shadow: 0 2px 6px rgba(217, 119, 6, 0.12); }
`;

const ModTableMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
`;

const ModTableHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ModIndex = styled.span`
  font-weight: 700;
  color: #d97706;
`;

const ModComment = styled(SubjectLine)`
  font-size: 0.78rem;
  font-weight: 400;
  color: #64748b;
  min-width: 0;
`;

const ModRowFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
  padding: 0 0.65rem 0.5rem;
`;

const ModActionBtn = styled.button`
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.15s ease;
  ${(p) => p.$variant === 'edit' && `
    background: #ecfdf5; color: #14532d; border: 1px solid #86efac;
    &:hover { background: #dcfce7; }
  `}
  ${(p) => p.$variant === 'modDelete' && `
    background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
    &:hover { background: #fee2e2; }
  `}
`;

/* ── Modification changes block ── */

const ChangesCompactBlock = styled.div`
  margin: 0.35rem 0.65rem 0.25rem;
  padding: 0.45rem 0.55rem;
  background: #ffffff;
  border: 1px solid #fde68a;
  border-radius: 6px;
`;

const ChangeRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.25rem 0;
  font-size: 0.72rem;
  border-bottom: 1px dashed #f3e8c8;
  &:last-child { border-bottom: none; }
`;

const ChangeFieldLabel = styled.span`
  font-weight: 700;
  color: #92400e;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.03em;
  flex-shrink: 0;
  min-width: 100px;
`;

/* ── Modification PDF file section ── */

const ModFilesSection = styled.div`
  border-top: 1px dashed #fcd34d;
  padding: 0.5rem 0.65rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const ModFileBlock = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const ModFileLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #334155;
  flex: 1;
  min-width: 160px;
`;

const ModFileActions = styled.div`
  display: flex;
  gap: 0.3rem;
  align-items: center;
  flex-shrink: 0;
`;

const FileIconBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s;
  flex-shrink: 0;
  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
`;

const ViewFileBtn = styled(FileIconBtn)`
  &:hover { background: #eef2ff; color: #6366f1; border-color: #c7d2fe; }
`;

const ModPdfBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #3730a3;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #f8fafc;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(67, 56, 202, 0.22);
  &:hover {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  }
`;

const DownloadFileBtn = styled(FileIconBtn)`
  &:hover { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
`;

/* ── SeeMoreText modal ── */

const TextDetailOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const TextDetailCard = styled.div`
  background: #ffffff;
  border-radius: 14px;
  max-width: 640px;
  width: 100%;
  max-height: 72vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);
  padding: 1.5rem;
`;

const TextDetailTitle = styled.h3`
  margin: 0 0 0.85rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.55rem;
`;

const TextDetailBody = styled.div`
  font-size: 0.95rem;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
`;

const TextDetailClose = styled.button`
  margin-top: 1rem;
  display: block;
  margin-left: auto;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  &:hover { background: #e2e8f0; }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const NoDataMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

/* ────────── Hooks ────────── */

function useTextOverflow(ref, deps) {
  const [overflows, setOverflows] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) { setOverflows(false); return; }
    const style = window.getComputedStyle(el);
    const isSingleLine = style.whiteSpace === 'nowrap' || (style.textOverflow === 'ellipsis' && style.webkitLineClamp === 'none');
    setOverflows(isSingleLine ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return overflows;
}

function SeeMoreText({ text, modalTitle, lineClamp = 2, singleLine = false, TextComponent = SubjectLine, onOpen }) {
  const ref = useRef(null);
  const overflows = useTextOverflow(ref, [text, lineClamp, singleLine]);
  const value = String(text || '').trim();
  if (!value) return null;
  return (
    <>
      <TextComponent ref={ref} $expanded={false} $lineClamp={lineClamp} $singleLine={singleLine}>
        {value}
      </TextComponent>
      {overflows && (
        <ExpandLinkButton type="button" onClick={(e) => { e.stopPropagation(); onOpen({ title: modalTitle, text: value }); }}>
          Δες περισσότερα
        </ExpandLinkButton>
      )}
    </>
  );
}

/* ────────── Main Component ────────── */

function ProsklisisManager({
  isOpen,
  onClose,
  userRole,
  currentUser,
  projectFilter = null,
  selectedProsklisiId = null,
  linkedNotesMap = {},
  notes = [],
  onOpenNoteFromEntity,
  organizationName = '',
  onOpenRelatedEntaxi = null
}) {
  const { showToast } = useToast();
  const canManageWorkflow = showNewProsklisiButton(userRole);
  const [proskliseis, setProskliseis] = useState([]);
  const [filteredProskliseis, setFilteredProskliseis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProsklisi, setEditingProsklisi] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileManagerOpen, setFileManagerOpen] = useState({ isOpen: false, prosklisiId: null, prosklisiTitle: '' });
  const [prosklisiModifications, setProsklisiModifications] = useState({});
  const [editingModification, setEditingModification] = useState(null);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [prosklisiLocks, setProsklisiLocks] = useState({});
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [relatedEntaxeisByProsklisi, setRelatedEntaxeisByProsklisi] = useState({});

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    axis: '', fundingSource: '', status: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: ''
  });
  const [quickSearchStatus, setQuickSearchStatus] = useState('');
  const [showExpiringSoonOnly, setShowExpiringSoonOnly] = useState(false);
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [viewTab, setViewTab] = useState(PROSKLISI_VIEW_TABS.ACTIVE);
  const focusTabAppliedRef = useRef(null);

  const [modsExpanded, setModsExpanded] = useState({});
  const [menuState, setMenuState] = useState({ open: false, top: 0, left: 0, type: null, prosklisi: null });
  const [textDetailModal, setTextDetailModal] = useState(null);

  const listScrollRef = useRef(null);
  const savedListScroll = useRef(0);
  const shouldRestoreListScroll = useRef(false);
  const [listScrollRestoreTick, setListScrollRestoreTick] = useState(0);

  const captureListScroll = useCallback(() => {
    if (listScrollRef.current) {
      savedListScroll.current = listScrollRef.current.scrollTop;
    }
  }, []);

  const requestListScrollRestore = useCallback(() => {
    shouldRestoreListScroll.current = true;
    setListScrollRestoreTick((t) => t + 1);
  }, []);

  const nestedModalOpen = isFormOpen
    || fileManagerOpen.isOpen
    || isModificationFormOpen
    || Boolean(textDetailModal);

  useEffect(() => {
    if (!shouldRestoreListScroll.current || nestedModalOpen) return undefined;
    const el = listScrollRef.current;
    if (!el) return undefined;
    const y = savedListScroll.current;
    const apply = () => { el.scrollTop = y; };
    apply();
    const t1 = setTimeout(apply, 50);
    const t2 = setTimeout(apply, 200);
    const t3 = setTimeout(() => {
      apply();
      shouldRestoreListScroll.current = false;
    }, 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [nestedModalOpen, listScrollRestoreTick, loading, filteredProskliseis.length]);

  const openTextDetailModal = useCallback((payload) => {
    captureListScroll();
    setTextDetailModal(payload);
  }, [captureListScroll]);

  const closeTextDetailModal = useCallback(() => {
    setTextDetailModal(null);
    requestListScrollRestore();
  }, [requestListScrollRestore]);

  const toggleModsExpanded = useCallback((prosklisiId, count) => {
    setModsExpanded((prev) => {
      const isOpen = prev[prosklisiId] !== undefined ? prev[prosklisiId] : defaultModsExpanded(count);
      return { ...prev, [prosklisiId]: !isOpen };
    });
  }, []);

  const handleOpenDiavgeia = useCallback((entry) => {
    openProsklisiDiavgeiaDocument(entry, { showToast });
  }, [showToast]);

  const openMenuAt = useCallback((e, { type, prosklisi }) => {
    e.stopPropagation();
    const pos = computeMenuPosition(e.currentTarget);
    setMenuState({ open: true, ...pos, type, prosklisi });
  }, []);

  const closeMenu = useCallback(() => setMenuState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    if (!menuState.open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    const handleOutside = (e) => {
      if (e.target.closest('[data-prosklisi-menu]')) return;
      closeMenu();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [menuState.open, closeMenu]);

  /* ── Data loading ── */

  useEffect(() => {
    if (isOpen) {
      ipcRenderer.invoke('clear-all-locks').then(() => {
        loadProskliseis();
        loadProsklisiLocks();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    filterProskliseis();
  }, [proskliseis, prosklisiModifications, searchTerm, projectFilter, quickSearchStatus, advancedFilters, selectedProsklisiId, showExpiringSoonOnly, showUnlinkedOnly, sortByDeadline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (proskliseis.length > 0) loadProsklisiLocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proskliseis]);

  useEffect(() => {
    if (!isOpen) return;
    let isActive = true;
    const checkLocks = async () => {
      if (!isActive) return;
      setProskliseis(currentProskliseis => {
        if (!currentProskliseis || currentProskliseis.length === 0) return currentProskliseis;
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < currentProskliseis.length; i += BATCH_SIZE) batches.push(currentProskliseis.slice(i, i + BATCH_SIZE));
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) await new Promise(resolve => setTimeout(resolve, 100));
            const batchLocks = {};
            await Promise.all(
              batch.map(async (prosklisi) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
                  batchLocks[prosklisi.prosklisiId] = lockStatus.locked;
                } catch (error) {
                  setProsklisiLocks(prevLocks => { batchLocks[prosklisi.prosklisiId] = prevLocks[prosklisi.prosklisiId] || false; return prevLocks; });
                }
              })
            );
            return batchLocks;
          })
        ).then(batchResults => {
          if (!isActive) return;
          const newLocks = Object.assign({}, ...batchResults);
          setProsklisiLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => newLocks[id] !== prevLocks[id]);
            if (hasChanges) return newLocks;
            return prevLocks;
          });
        }).catch(() => {});
        return currentProskliseis;
      });
    };
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      checkLocks();
      intervalId = setInterval(() => { if (isActive) checkLocks(); }, 8000);
    }, 2000);
    return () => { isActive = false; if (timeoutId) clearTimeout(timeoutId); if (intervalId) clearInterval(intervalId); };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRelatedEntaxeis = async () => {
    try {
      const entaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      const map = {};
      (entaxeis || []).forEach((entaxi) => {
        const pid = entaxi?.prosklisiId;
        if (!pid) return;
        if (!map[pid]) map[pid] = [];
        map[pid].push(entaxi);
      });
      setRelatedEntaxeisByProsklisi(map);
    } catch (error) {
      console.error('Error loading related entaxeis for proskliseis:', error);
      setRelatedEntaxeisByProsklisi({});
    }
  };

  const loadProskliseis = async () => {
    setLoading(true);
    try {
      const data = await ipcRenderer.invoke('load-all-proskliseis');
      setProskliseis(data || []);
      loadRelatedEntaxeis();
      const modifications = {};
      for (const prosklisi of data || []) {
        try {
          const mods = await ipcRenderer.invoke('load-prosklisi-modifications', prosklisi.prosklisiId);
          modifications[prosklisi.prosklisiId] = mods || [];
        } catch (error) {
          modifications[prosklisi.prosklisiId] = [];
        }
      }
      setProsklisiModifications(modifications);
    } catch (error) {
      console.error('Error loading proskliseis:', error);
      setProskliseis([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProsklisiLocks = async () => {
    try {
      const locks = {};
      for (const prosklisi of proskliseis) {
        const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
        locks[prosklisi.prosklisiId] = lockStatus.locked || false;
      }
      setProsklisiLocks(locks);
    } catch (error) {
      console.error('Error loading prosklisi locks:', error);
    }
  };

  /* ── Filtering ── */

  const filterProskliseis = () => {
    let filtered = [...proskliseis];
    if (projectFilter) filtered = filtered.filter(p => p.title === projectFilter);
    if (advancedFilters.axis) filtered = filtered.filter(p => containsSearchTerm(p.axis, advancedFilters.axis));
    if (advancedFilters.fundingSource) filtered = filtered.filter(p => containsSearchTerm(p.fundingSource, advancedFilters.fundingSource));
    if (advancedFilters.status) filtered = filtered.filter(p => p.status === advancedFilters.status);

    if (advancedFilters.minBudget) {
      const minBudget = parseFloat(advancedFilters.minBudget.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(p => {
        if (!p.budgetRange) return false;
        const m = p.budgetRange.match(/(\d+(?:[.,]\d+)?)/g);
        if (!m) return false;
        return parseFloat(m[0].replace(',', '.')) >= minBudget;
      });
    }
    if (advancedFilters.maxBudget) {
      const maxBudget = parseFloat(advancedFilters.maxBudget.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(p => {
        if (!p.budgetRange) return false;
        const m = p.budgetRange.match(/(\d+(?:[.,]\d+)?)/g);
        if (!m) return false;
        return parseFloat(m[m.length - 1].replace(',', '.')) <= maxBudget;
      });
    }

    const parseDate = (dateString) => {
      if (!dateString) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString + 'T00:00:00');
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) { const [d, m, y] = dateString.split('-'); return new Date(`${y}-${m}-${d}T00:00:00`); }
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const compareDatesOnly = (d1, d2) => {
      const a = parseDate(d1); const b = parseDate(d2);
      if (!a || !b) return null;
      a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
      return a.getTime() - b.getTime();
    };

    const deadlineOf = (p) => getEffectiveProsklisiDeadline(p, prosklisiModifications[p.prosklisiId] || []);

    if (advancedFilters.dateFrom) filtered = filtered.filter(p => { const dl = deadlineOf(p); if (!dl) return false; const c = compareDatesOnly(dl, advancedFilters.dateFrom); return c !== null && c >= 0; });
    if (advancedFilters.dateTo) filtered = filtered.filter(p => { const dl = deadlineOf(p); if (!dl) return false; const c = compareDatesOnly(dl, advancedFilters.dateTo); return c !== null && c <= 0; });
    if (selectedProsklisiId) filtered = filtered.filter(p => p.prosklisiId === selectedProsklisiId);
    const diavgeiaAdaById = {};
    filtered.forEach((p) => {
      if (p?.prosklisiId) diavgeiaAdaById[p.prosklisiId] = getProsklisiDiavgeiaEntry(p)?.ada || '';
    });
    filtered = applyProsklisiDailyFilters(filtered, {
      searchTerm,
      quickSearchStatus,
      showExpiringSoonOnly,
      showUnlinkedOnly,
      sortByDeadline,
      modificationsById: prosklisiModifications,
      diavgeiaAdaById,
    });
    setFilteredProskliseis(filtered);
  };

  /* ── Handlers ── */

  const handleSaveProsklisi = async (prosklisiData) => {
    try {
      await ipcRenderer.invoke('save-prosklisi', prosklisiData);
      await loadProskliseis();
      setIsFormOpen(false);
      setEditingProsklisi(null);
      requestListScrollRestore();
    } catch (error) {
      console.error('Error saving prosklisi:', error);
      showToast('Σφάλμα αποθήκευσης πρόσκλησης: ' + error.message, 'error');
    } finally {
      if (editingProsklisi && editingProsklisi.prosklisiId) {
        try {
          await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
          setProsklisiLocks(prev => ({ ...prev, [editingProsklisi.prosklisiId]: false }));
        } catch (lockErr) { console.error('Error removing lock:', lockErr); }
      }
    }
  };

  const tryAcquireProsklisiLock = async (prosklisi) => {
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
    if (lockStatus.locked) {
      showToast(`Η πρόσκληση είναι υπό επεξεργασία από ${lockStatus.lockedBy ? `«${lockStatus.lockedBy}»` : 'άλλον διαχειριστή'}.`, 'warning');
      return false;
    }
    const lockOwner = currentUser?.fullName || currentUser?.username || '';
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'proskliseis', prosklisi.prosklisiId, lockOwner);
    if (!lockResult.success) {
      showToast(`Δεν είναι δυνατή η επεξεργασία. Ανοιχτό από ${lockResult.lockedBy ? `«${lockResult.lockedBy}»` : 'άλλον χρήστη'}.`, 'warning');
      return false;
    }
    setProsklisiLocks((prev) => ({ ...prev, [prosklisi.prosklisiId]: true }));
    return true;
  };

  const syncProsklisiFieldsFromModification = async (modificationData) => {
    if (!modificationData?.originalProsklisiId) return;
    if (!modificationData.changes || Object.keys(modificationData.changes).length === 0) return;
    const baseProsklisi = proskliseis.find(
      (p) => p.prosklisiId === modificationData.originalProsklisiId
    ) || {};
    const updatedProsklisiData = {
      ...baseProsklisi,
      prosklisiId: modificationData.originalProsklisiId,
      title: modificationData.modifiedData?.title ?? baseProsklisi.title,
      axis: modificationData.modifiedData?.axis ?? baseProsklisi.axis,
      fundingSource: modificationData.modifiedData?.fundingSource ?? baseProsklisi.fundingSource,
      code: modificationData.modifiedData?.code ?? baseProsklisi.code,
      deadline: modificationData.modifiedData?.deadline ?? baseProsklisi.deadline,
      budgetRange: modificationData.modifiedData?.budgetRange ?? baseProsklisi.budgetRange,
      status: modificationData.modifiedData?.status ?? baseProsklisi.status,
      updatedAt: new Date().toISOString()
    };
    await ipcRenderer.invoke('save-prosklisi', updatedProsklisiData);
  };

  const syncProsklisiDeadlineFromMods = async (prosklisiId, modifications) => {
    const baseProsklisi = proskliseis.find((p) => p.prosklisiId === prosklisiId);
    if (!baseProsklisi) return;
    const effective = getEffectiveProsklisiDeadline(baseProsklisi, modifications || []);
    if (String(effective || '') === String(baseProsklisi.deadline || '')) return;
    await ipcRenderer.invoke('save-prosklisi', {
      ...baseProsklisi,
      deadline: effective,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveModification = async (modificationData) => {
    try {
      await ipcRenderer.invoke('save-prosklisi-modification', modificationData);
      await syncProsklisiFieldsFromModification(modificationData);
      await loadProskliseis();
      setEditingModification(null);
      setIsModificationFormOpen(false);
      requestListScrollRestore();
    } catch (error) {
      console.error('Error saving modification:', error);
      showToast('Σφάλμα αποθήκευσης τροποποίησης: ' + error.message, 'error');
    } finally {
      if (modificationData.originalProsklisiId) {
        try {
          await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', modificationData.originalProsklisiId);
          setProsklisiLocks(prev => ({ ...prev, [modificationData.originalProsklisiId]: false }));
        } catch (lockErr) { console.error('Error removing lock:', lockErr); }
      }
    }
  };

  const handleEditProsklisi = async (prosklisi) => {
    closeMenu();
    if (!(await tryAcquireProsklisiLock(prosklisi))) return;
    captureListScroll();
    setEditingProsklisi(prosklisi);
    setIsFormOpen(true);
  };

  const handleDeleteProsklisi = async (prosklisiId) => {
    closeMenu();
    const decision = evaluateProsklisiDelete(prosklisiId);
    if (!decision.ok) return;
    if (await showConfirm({ title: 'Διαγραφή Πρόσκλησης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την πρόσκληση;', detail: 'Θα διαγραφούν επίσης όλα τα αρχεία της. Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi', prosklisiId);
        if (result.success) await loadProskliseis();
        else showToast('Σφάλμα διαγραφής πρόσκλησης: ' + result.error, 'error');
      } catch (error) { showToast('Σφάλμα διαγραφής πρόσκλησης: ' + error.message, 'error'); }
    }
  };

  const handleViewFiles = (prosklisiId) => {
    const prosklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    if (!prosklisi) { showToast('Δεν βρέθηκε η πρόσκληση', 'error'); return; }
    captureListScroll();
    setFileManagerOpen({ isOpen: true, prosklisiId, prosklisiTitle: prosklisi.title });
  };

  const handleViewModificationPDF = async (prosklisiId, modificationId) => {
    try {
      const result = await ipcRenderer.invoke('view-modification-pdf', prosklisiId, modificationId);
      if (!result.success) showToast('Σφάλμα προβολής PDF: ' + result.error, 'error');
    } catch (error) { showToast('Σφάλμα προβολής PDF: ' + error.message, 'error'); }
  };

  const handleEditModification = async (modification, prosklisiId) => {
    const prosklisi = proskliseis.find((p) => p.prosklisiId === prosklisiId);
    if (!prosklisi) {
      showToast('Δεν βρέθηκε η πρόσκληση', 'error');
      return;
    }
    if (!(await tryAcquireProsklisiLock(prosklisi))) return;
    captureListScroll();
    setEditingModification({ ...modification, prosklisiId, originalProsklisiData: prosklisi });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (prosklisiId, modificationId) => {
    if (await showConfirm({ title: 'Διαγραφή Τροποποίησης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const allMods = prosklisiModifications[prosklisiId] || [];
        const deleted = allMods.find((m) => m.modificationId === modificationId);
        const remaining = allMods.filter((m) => m.modificationId !== modificationId);
        await ipcRenderer.invoke('delete-prosklisi-modification', prosklisiId, modificationId);
        const baseProsklisi = proskliseis.find((p) => p.prosklisiId === prosklisiId);
        if (baseProsklisi) {
          let baseline = baseProsklisi;
          // Αν διαγράφεται η μόνη τροποποίηση που άλλαξε λήξη, επαναφέρουμε το «πριν»
          const remainingDeadlineChanges = remaining.some((m) => {
            const cur = m?.changes?.deadline?.current;
            return cur != null && String(cur).trim() !== '' && String(cur).trim() !== '-';
          });
          if (deleted?.changes?.deadline && !remainingDeadlineChanges) {
            baseline = {
              ...baseProsklisi,
              deadline: deleted.changes.deadline.original ?? baseProsklisi.deadline,
            };
          }
          const effective = getEffectiveProsklisiDeadline(baseline, remaining);
          if (String(effective || '') !== String(baseProsklisi.deadline || '')) {
            await ipcRenderer.invoke('save-prosklisi', {
              ...baseProsklisi,
              deadline: effective,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        await loadProskliseis();
      } catch (error) { showToast('Σφάλμα διαγραφής τροποποίησης: ' + error.message, 'error'); }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-prosklisi-modification', modificationData);
      await syncProsklisiFieldsFromModification(modificationData);
      if (editingModification && editingModification.prosklisiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingModification.prosklisiId);
        setProsklisiLocks(prev => ({ ...prev, [editingModification.prosklisiId]: false }));
      }
      await loadProskliseis();
      setEditingModification(null);
      setIsModificationFormOpen(false);
      requestListScrollRestore();
    } catch (error) { showToast('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message, 'error'); }
  };

  const handleNewModification = async (prosklisi) => {
    closeMenu();
    if (!(await tryAcquireProsklisiLock(prosklisi))) return;
    captureListScroll();
    setEditingModification(prosklisi);
    setIsModificationFormOpen(true);
  };

  /* ── Helpers ── */

  const formatDate = (dateString) => formatDateEl(dateString, '-');

  const getFieldLabel = (field) => {
    const labels = { fundingSource: 'Πηγή Χρηματοδότησης', deadline: 'Ημ. Λήξης', title: 'Τίτλος', axis: 'Άξονας', code: 'Κωδικός', budgetRange: 'Εύρος Π/Υ', status: 'Κατάσταση' };
    return labels[field] || field;
  };

  const getUniqueStatuses = () => [...new Set(proskliseis.map(p => p.status).filter(Boolean))].sort();

  const handleClearFilters = () => {
    setSearchTerm('');
    setQuickSearchStatus('');
    setShowExpiringSoonOnly(false);
    setShowUnlinkedOnly(false);
    setSortByDeadline(false);
    setAdvancedFilters({ axis: '', fundingSource: '', status: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' });
    setShowAdvancedFilters(false);
  };

  const hasLinkedProjects = (prosklisi) =>
    Array.isArray(prosklisi?.linkedProjects) && prosklisi.linkedProjects.length > 0;

  const getLinkedProjectLabels = (prosklisi) => {
    if (!hasLinkedProjects(prosklisi)) return [];
    return prosklisi.linkedProjects
      .map((p) => (typeof p === 'string' ? p : (p?.title || p?.projectTitle || '')))
      .filter(Boolean);
  };

  const handleOpenRelatedEntaxi = (entaxiOrFilter) => {
    if (!entaxiOrFilter) return;
    if (typeof onOpenRelatedEntaxi === 'function') {
      onOpenRelatedEntaxi(entaxiOrFilter);
      return;
    }
    showToast('Δεν είναι δυνατή η μετάβαση στις εντάξεις από εδώ.', 'info');
  };

  const handleClose = () => { handleClearFilters(); onClose(); };

  const tabPartition = useMemo(
    () => partitionProskliseisByViewTab(filteredProskliseis, prosklisiModifications),
    [filteredProskliseis, prosklisiModifications]
  );

  const VIEW_TAB_META = {
    [PROSKLISI_VIEW_TABS.ACTIVE]: {
      label: 'Ενεργές',
      icon: '🟢',
      activeColor: '#166534',
      countBg: '#dcfce7',
      countFg: '#166534',
      empty: 'Δεν υπάρχουν ενεργές προσκλήσεις με τα τρέχοντα φίλτρα.',
    },
    [PROSKLISI_VIEW_TABS.EXPIRED]: {
      label: 'Ληγμένες',
      icon: '⏰',
      activeColor: '#9a3412',
      countBg: '#ffedd5',
      countFg: '#9a3412',
      empty: 'Δεν υπάρχουν ληγμένες ανοιχτές προσκλήσεις με τα τρέχοντα φίλτρα.',
    },
    [PROSKLISI_VIEW_TABS.SUBMITTED]: {
      label: 'Υποβληθείσες',
      icon: '✅',
      activeColor: '#1e40af',
      countBg: '#dbeafe',
      countFg: '#1e40af',
      empty: 'Δεν υπάρχουν υποβληθείσες προσκλήσεις με τα τρέχοντα φίλτρα.',
    },
  };

  const groupListForCurrentTab = () => {
    const list = tabPartition[viewTab] || [];
    if (viewTab === PROSKLISI_VIEW_TABS.SUBMITTED) {
      return list.length ? [['Υποβληθείσες', list]] : [];
    }
    const groups = { 'Υπό Υποβολή': [], 'Υπό Ωρίμανση': [], 'Άλλες': [] };
    list.forEach((p) => {
      if (p.status === 'Υπό Υποβολή') groups['Υπό Υποβολή'].push(p);
      else if (p.status === 'Υπό Ωρίμανση') groups['Υπό Ωρίμανση'].push(p);
      else groups['Άλλες'].push(p);
    });
    if (sortByDeadline || showExpiringSoonOnly) {
      Object.keys(groups).forEach((key) => {
        groups[key] = [...groups[key]].sort((a, b) => compareProskliseisByDeadline(
          { deadline: getEffectiveProsklisiDeadline(a, prosklisiModifications[a.prosklisiId] || []) },
          { deadline: getEffectiveProsklisiDeadline(b, prosklisiModifications[b.prosklisiId] || []) }
        ));
      });
    }
    return Object.entries(groups).filter(([, rows]) => rows.length > 0);
  };

  const getGroupStyle = (name) => {
    switch (name) {
      case 'Υπό Υποβολή': return { color: '#0d47a1', barColor: '#2196f3', icon: '📤' };
      case 'Υπό Ωρίμανση': return { color: '#92400e', barColor: '#f59e0b', icon: '⏳' };
      case 'Υποβληθείσες': return { color: '#283593', barColor: '#7986cb', icon: '✅' };
      default: return { color: '#424242', barColor: '#9e9e9e', icon: '📋' };
    }
  };

  // Άνοιγμα συγκεκριμένης πρόσκλησης (από κάρτα υποέργου κ.λπ.) → σωστό tab, μία φορά ανά εστίαση
  useEffect(() => {
    if (!isOpen) {
      focusTabAppliedRef.current = null;
      return;
    }
    const focusKey = selectedProsklisiId
      ? `id:${selectedProsklisiId}`
      : (projectFilter ? `title:${projectFilter}` : '');
    if (!focusKey || !proskliseis.length) return;
    if (focusTabAppliedRef.current === focusKey) return;

    let target = null;
    if (selectedProsklisiId) {
      target = proskliseis.find((x) => x.prosklisiId === selectedProsklisiId);
    } else if (projectFilter) {
      target = proskliseis.find((x) => x.title === projectFilter);
    }
    if (!target) return;

    const tab = getProsklisiViewTab(target, prosklisiModifications[target.prosklisiId] || []);
    setViewTab(tab);
    focusTabAppliedRef.current = focusKey;
  }, [isOpen, selectedProsklisiId, projectFilter, proskliseis, prosklisiModifications]);

  const handleAdvancedFilterChange = (field, value) => setAdvancedFilters(prev => ({ ...prev, [field]: value }));

  const getActiveFiltersCount = () => {
    let n = 0;
    if (searchTerm.trim()) n++; if (quickSearchStatus) n++;
    if (showExpiringSoonOnly) n++;
    if (showUnlinkedOnly) n++;
    if (sortByDeadline) n++;
    Object.values(advancedFilters).forEach(v => { if (typeof v === 'string' && v.trim()) n++; });
    return n;
  };

  const hasAnyActiveFilters = getActiveFiltersCount() > 0;

  const getStatistics = () => ({
    total: proskliseis.length,
    filtered: filteredProskliseis.length,
    withModifications: proskliseis.filter(p => prosklisiModifications[p.prosklisiId]?.length > 0).length
  });

  if (!isOpen) return null;

  /* ────────── Render ────────── */

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <ModalContainer>
        <ModalTopSection>
          <PanelHeader>
            <PanelTitle>Διαχείριση Προσκλήσεων</PanelTitle>
            <PanelCloseButton type="button" onClick={handleClose}>Κλείσιμο</PanelCloseButton>
          </PanelHeader>

          <ActionsBar>
            {canManageWorkflow && (
              <ToolbarActionButton type="button" primary onClick={() => { captureListScroll(); setEditingProsklisi(null); setIsFormOpen(true); }}>
                Νέα Πρόσκληση
              </ToolbarActionButton>
            )}
            <PanelExportButton type="button" onClick={() => setIsExportDialogOpen(true)}>
              Εξαγωγή σε Excel
            </PanelExportButton>
            <ToolbarQuickInput
              type="text"
              placeholder="Αναζήτηση σε όλα τα tabs (τίτλος, άξονας, πηγή, κωδικός, έργο)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ToolbarFilterSelect value={quickSearchStatus} onChange={(e) => setQuickSearchStatus(e.target.value)}>
              <option value="">Όλες οι καταστάσεις</option>
              {getUniqueStatuses().map(s => <option key={s} value={s}>{s}</option>)}
            </ToolbarFilterSelect>
            <ToolbarToggleButton
              type="button"
              $active={showExpiringSoonOnly}
              onClick={() => setShowExpiringSoonOnly((v) => !v)}
              title="Ληγμένες ή με λήξη εντός 30 ημερών"
            >
              Λήγουν σύντομα
            </ToolbarToggleButton>
            <ToolbarToggleButton
              type="button"
              $active={showUnlinkedOnly}
              onClick={() => setShowUnlinkedOnly((v) => !v)}
              title="Προσκλήσεις χωρίς συσχέτιση με έργο"
            >
              Χωρίς έργο
            </ToolbarToggleButton>
            <ToolbarToggleButton
              type="button"
              $active={sortByDeadline}
              onClick={() => setSortByDeadline((v) => !v)}
              title="Ταξινόμηση ανά ημερομηνία λήξης"
            >
              Κατά λήξη
            </ToolbarToggleButton>
            <ToolbarToggleButton type="button" $active={showAdvancedFilters} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              {showAdvancedFilters ? 'Απόκρυψη φίλτρων' : 'Προηγμένα φίλτρα'}
            </ToolbarToggleButton>
            {hasAnyActiveFilters && (
              <ToolbarClearButton type="button" onClick={handleClearFilters}>
                Καθαρισμός
              </ToolbarClearButton>
            )}
          </ActionsBar>

          <SearchStats>
            <div className="stats-section">
              {(() => {
                const stats = getStatistics();
                return (
                  <>
                    <div className="stat-item"><span className="stat-label">Σύνολο:</span><span className="stat-number">{stats.total}</span></div>
                    <div className="stat-item"><span className="stat-label">Εμφανιζόμενα:</span><span className="stat-number">{stats.filtered}</span></div>
                    <div className="stat-item"><span className="stat-label">Με τροποποιήσεις:</span><span className="stat-number">{stats.withModifications}</span></div>
                  </>
                );
              })()}
            </div>
            <div>
              {hasAnyActiveFilters && (
                <div className="filters-badge"><span>Ενεργά φίλτρα: {getActiveFiltersCount()}</span></div>
              )}
            </div>
          </SearchStats>

          <ViewTabBar role="tablist" aria-label="Κατηγορίες προσκλήσεων">
            {[PROSKLISI_VIEW_TABS.ACTIVE, PROSKLISI_VIEW_TABS.EXPIRED, PROSKLISI_VIEW_TABS.SUBMITTED].map((tabId) => {
              const meta = VIEW_TAB_META[tabId];
              const count = (tabPartition[tabId] || []).length;
              const active = viewTab === tabId;
              return (
                <ViewTabBtn
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  $active={active}
                  $activeColor={meta.activeColor}
                  onClick={() => setViewTab(tabId)}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <TabCount $active={active} $bg={meta.countBg} $fg={meta.countFg}>{count}</TabCount>
                </ViewTabBtn>
              );
            })}
          </ViewTabBar>

          {(tabPartition[viewTab] || []).length === 0 && filteredProskliseis.length > 0 && (
            <CrossTabHint>
              <span>Η πρόσκληση βρίσκεται σε άλλο tab:</span>
              {[PROSKLISI_VIEW_TABS.ACTIVE, PROSKLISI_VIEW_TABS.EXPIRED, PROSKLISI_VIEW_TABS.SUBMITTED]
                .filter((tabId) => tabId !== viewTab && (tabPartition[tabId] || []).length > 0)
                .map((tabId) => (
                  <CrossTabLink key={tabId} type="button" onClick={() => setViewTab(tabId)}>
                    {VIEW_TAB_META[tabId].label} ({tabPartition[tabId].length})
                  </CrossTabLink>
                ))}
            </CrossTabHint>
          )}

          {showAdvancedFilters && (
            <SearchBar>
              <SearchRow>
                <AdvSearchInput type="text" placeholder="Άξονας / Δράση..." value={advancedFilters.axis} onChange={(e) => handleAdvancedFilterChange('axis', e.target.value)} />
                <AdvSearchInput type="text" placeholder="Πηγή χρηματοδότησης..." value={advancedFilters.fundingSource} onChange={(e) => handleAdvancedFilterChange('fundingSource', e.target.value)} />
                <AdvFilterSelect value={advancedFilters.status} onChange={(e) => handleAdvancedFilterChange('status', e.target.value)}>
                  <option value="">Κατάσταση (επιπλέον φίλτρο)</option>
                  {getUniqueStatuses().map(s => <option key={s} value={s}>{s}</option>)}
                </AdvFilterSelect>
              </SearchRow>
              <SearchRow>
                <AdvSearchInput type="text" placeholder="Ελάχιστος προϋπολογισμός (€)..." value={advancedFilters.minBudget} onChange={(e) => handleAdvancedFilterChange('minBudget', e.target.value)} />
                <AdvSearchInput type="text" placeholder="Μέγιστος προϋπολογισμός (€)..." value={advancedFilters.maxBudget} onChange={(e) => handleAdvancedFilterChange('maxBudget', e.target.value)} />
                <AdvDateInput type="date" value={advancedFilters.dateFrom} onChange={(e) => handleAdvancedFilterChange('dateFrom', e.target.value)} title="Από ημερομηνία λήξης υποβολής" />
                <AdvDateInput type="date" value={advancedFilters.dateTo} onChange={(e) => handleAdvancedFilterChange('dateTo', e.target.value)} title="Έως ημερομηνία λήξης υποβολής" />
              </SearchRow>
            </SearchBar>
          )}
        </ModalTopSection>

        <ModalScrollSection ref={listScrollRef}>
          {loading ? (
            <LoadingMessage>Φόρτωση προσκλήσεων...</LoadingMessage>
          ) : filteredProskliseis.length === 0 ? (
            <NoDataMessage>
              {hasAnyActiveFilters
                ? 'Δεν βρέθηκαν προσκλήσεις με τα τρέχοντα φίλτρα.'
                : 'Δεν υπάρχουν ακόμη προσκλήσεις.'}
              {hasAnyActiveFilters ? (
                <div style={{ marginTop: '1rem' }}>
                  <ToolbarClearButton type="button" onClick={handleClearFilters}>Καθαρισμός φίλτρων</ToolbarClearButton>
                </div>
              ) : (
                canManageWorkflow && (
                  <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Πατήστε «Νέα Πρόσκληση» για να προσθέσετε.</div>
                )
              )}
            </NoDataMessage>
          ) : (tabPartition[viewTab] || []).length === 0 ? (
            <NoDataMessage>
              {VIEW_TAB_META[viewTab]?.empty || 'Δεν υπάρχουν προσκλήσεις σε αυτό το tab.'}
              {hasAnyActiveFilters && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Η αναζήτηση ισχύει και για τα τρία tabs — δοκιμάστε τα παραπάνω κουμπιά μετάβασης.
                </div>
              )}
            </NoDataMessage>
          ) : (
            <ProsklisisList>
              {groupListForCurrentTab().map(([groupName, groupProskliseis]) => {
                const gs = getGroupStyle(groupName);
                const isExpiredTab = viewTab === PROSKLISI_VIEW_TABS.EXPIRED;
                return (
                  <ProjectGroup key={`${viewTab}-${groupName}`}>
                    <ProjectGroupTitle $color={isExpiredTab ? '#9a3412' : gs.color} $barColor={isExpiredTab ? '#fb923c' : gs.barColor}>
                      {isExpiredTab ? '⏰' : gs.icon} {groupName} ({groupProskliseis.length})
                      {isExpiredTab ? ' — ληγμένη προθεσμία' : ''}
                    </ProjectGroupTitle>
                    <GroupCards>
                      {groupProskliseis.map((prosklisi) => {
                        const isLocked = prosklisiLocks[prosklisi.prosklisiId];
                        const mods = prosklisiModifications[prosklisi.prosklisiId] || [];
                        const modCount = mods.length;
                        const modsOpen = modsExpanded[prosklisi.prosklisiId] !== undefined
                          ? modsExpanded[prosklisi.prosklisiId]
                          : defaultModsExpanded(modCount);
                        const prosklisiLinkedNotes = getEntityLinkedNotes(linkedNotesMap, prosklisi.prosklisiId);
                        const effectiveDeadline = getEffectiveProsklisiDeadline(prosklisi, mods);
                        const deadlineChip = getProsklisiDeadlineChipMeta(effectiveDeadline, formatDate);
                        const linkedLabels = getLinkedProjectLabels(prosklisi);
                        const relatedEntaxeis = relatedEntaxeisByProsklisi[prosklisi.prosklisiId] || [];

                        return (
                          <ProsklisisItem
                            key={prosklisi.prosklisiId}
                            $isLocked={isLocked}
                            $status={prosklisi.status}
                            $muted={isExpiredTab}
                          >
                            <CardTopRightCluster>
                              {isLocked && (
                                <LockIndicator $isLocked title="Υπό επεξεργασία από άλλον χρήστη">
                                  🔒
                                </LockIndicator>
                              )}
                              {prosklisiLinkedNotes.length > 0 && (
                                <LinkedNoteSticker
                                  links={prosklisiLinkedNotes}
                                  onOpenNote={onOpenNoteFromEntity}
                                  placement="inline"
                                />
                              )}
                            </CardTopRightCluster>

                            <CompactCardBody>
                              <CompactMain>
                                <CompactTitleRow>
                                  <CompactLabel>{prosklisi.title}</CompactLabel>
                                  {deadlineChip && (
                                    <MetaChip $urgency={deadlineChip.urgency} title={deadlineChip.title}>
                                      {deadlineChip.label}
                                    </MetaChip>
                                  )}
                                  {prosklisi.status && (
                                    <StatusChip $status={prosklisi.status}>{prosklisi.status}</StatusChip>
                                  )}
                                </CompactTitleRow>

                                {prosklisi.axis && (
                                  <SeeMoreText
                                    text={prosklisi.axis}
                                    modalTitle="Άξονας / Δράση"
                                    lineClamp={2}
                                    onOpen={openTextDetailModal}
                                  />
                                )}

                                <MetaChipsRow>
                                  {prosklisi.code && <MetaChip title="Κωδικός">{prosklisi.code}</MetaChip>}
                                  {prosklisi.budgetRange && <MetaChip title="Εύρος Π/Υ">{prosklisi.budgetRange}</MetaChip>}
                                  {prosklisi.fundingSource && (
                                    <MetaChip $accent title={prosklisi.fundingSource}>
                                      {truncateText(prosklisi.fundingSource, 42)}
                                    </MetaChip>
                                  )}
                                  {(() => {
                                    const diavgeiaEntry = getProsklisiDiavgeiaEntry(prosklisi);
                                    if (!diavgeiaEntry) return null;
                                    return (
                                      <MetaChip
                                        $clickable
                                        title={diavgeiaEntry.title || `Διαύγεια — ${diavgeiaEntry.ada}`}
                                        onClick={() => handleOpenDiavgeia(diavgeiaEntry)}
                                      >
                                        Διαύγεια · {diavgeiaEntry.ada}
                                      </MetaChip>
                                    );
                                  })()}
                                </MetaChipsRow>

                                <LinkedRow>
                                  <LinkedHint>Έργα:</LinkedHint>
                                  {linkedLabels.length > 0 ? (
                                    linkedLabels.slice(0, 3).map((label) => (
                                      <MetaChip key={label} $green title={label}>
                                        {truncateText(label, 36)}
                                      </MetaChip>
                                    ))
                                  ) : (
                                    <MetaChip title="Δεν έχει συσχετιστεί με έργο">Χωρίς σύνδεση</MetaChip>
                                  )}
                                  {linkedLabels.length > 3 && (
                                    <MetaChip title={linkedLabels.slice(3).join(', ')}>
                                      +{linkedLabels.length - 3}
                                    </MetaChip>
                                  )}
                                </LinkedRow>

                                {relatedEntaxeis.length > 0 && (
                                  <LinkedRow>
                                    <LinkedHint>Εντάξεις:</LinkedHint>
                                    {relatedEntaxeis.slice(0, 3).map((entaxi) => (
                                      <MetaChip
                                        key={entaxi.entaxiId}
                                        $accent
                                        $clickable
                                        title={entaxi.subject || entaxi.projectTitle || 'Ένταξη'}
                                        onClick={() => handleOpenRelatedEntaxi(entaxi)}
                                      >
                                        {truncateText(entaxi.subject || entaxi.projectTitle || 'Ένταξη', 40)}
                                      </MetaChip>
                                    ))}
                                    {relatedEntaxeis.length > 3 && (
                                      <MetaChip
                                        $clickable
                                        $accent
                                        title="Προβολή όλων των σχετικών εντάξεων"
                                        onClick={() => handleOpenRelatedEntaxi({ prosklisiId: prosklisi.prosklisiId })}
                                      >
                                        +{relatedEntaxeis.length - 3} · όλες
                                      </MetaChip>
                                    )}
                                  </LinkedRow>
                                )}
                              </CompactMain>

                              <CompactAside>
                                <CompactActions>
                                  <IconBtn $filesPrimary type="button" onClick={() => handleViewFiles(prosklisi.prosklisiId)}>
                                    Αρχεία
                                  </IconBtn>
                                  {canManageWorkflow && (
                                    <MenuWrap>
                                      <MenuTrigger
                                        type="button"
                                        title="Ενέργειες"
                                        onClick={(e) => openMenuAt(e, { type: 'main', prosklisi })}
                                      >
                                        ⋯
                                      </MenuTrigger>
                                    </MenuWrap>
                                  )}
                                </CompactActions>
                              </CompactAside>
                            </CompactCardBody>

                            {/* Modifications toggle */}
                            {modCount > 0 && (
                              <ModsToggleRow>
                                <ModsToggleButton
                                  type="button"
                                  $open={modsOpen}
                                  aria-expanded={modsOpen}
                                  title={modsOpen ? 'Απόκρυψη τροποποιήσεων' : 'Εμφάνιση τροποποιήσεων'}
                                  onClick={() => toggleModsExpanded(prosklisi.prosklisiId, modCount)}
                                >
                                  <ModsToggleLeft>
                                    <ModsToggleIcon aria-hidden>📋</ModsToggleIcon>
                                    <span>{modsOpen ? 'Απόκρυψη τροποποιήσεων' : 'Προβολή τροποποιήσεων'}</span>
                                    <ModsCountBadge>{modCount}</ModsCountBadge>
                                  </ModsToggleLeft>
                                  <ModsToggleChevron aria-hidden>{modsOpen ? '▲' : '▼'}</ModsToggleChevron>
                                </ModsToggleButton>
                              </ModsToggleRow>
                            )}

                            {/* Modifications panel */}
                            {modsOpen && modCount > 0 && (
                              <ModificationsPanel>
                                <ModsSectionHeader>Τροποποιήσεις Πρόσκλησης</ModsSectionHeader>
                                {mods.map((mod, index) => {
                                  const modDesc = mod.modificationDescription?.trim() || '';
                                  const hasChanges = mod.changes && Object.keys(mod.changes).length > 0;
                                  const hasPDF = !!mod.modificationPDF;
                                  const diavgeiaModEntry = getModificationDiavgeiaEntry(mod);
                                  const modDate = mod.modificationDocumentDate
                                    ? formatDate(mod.modificationDocumentDate)
                                    : formatDate(mod.createdAt);

                                  return (
                                    <ModTableRow key={mod.modificationId || index}>
                                      <ModTableMain>
                                        <ModTableHeader>
                                          <ModIndex>#{index + 1}</ModIndex>
                                          <MetaChip>📅 {modDate}</MetaChip>
                                          {diavgeiaModEntry && (
                                            <ViewFileBtn
                                              title={`Προβολή στη Διαύγεια — ${diavgeiaModEntry.ada}`}
                                              onClick={() => handleOpenDiavgeia(diavgeiaModEntry)}
                                            >
                                              🌐
                                            </ViewFileBtn>
                                          )}
                                        </ModTableHeader>

                                        {modDesc && (
                                          <SeeMoreText
                                            text={modDesc}
                                            modalTitle={`Τροποποίηση #${index + 1} — Περιγραφή`}
                                            singleLine
                                            TextComponent={ModComment}
                                            onOpen={openTextDetailModal}
                                          />
                                        )}
                                      </ModTableMain>

                                      {hasPDF && (
                                        <ModFilesSection>
                                          <ModFileBlock>
                                            <ModFileLabel>PDF τροποποίησης</ModFileLabel>
                                            <ModFileActions>
                                              <ModPdfBtn
                                                type="button"
                                                title="Προβολή PDF τροποποίησης"
                                                onClick={() => handleViewModificationPDF(prosklisi.prosklisiId, mod.modificationId)}
                                              >
                                                Προβολή PDF
                                              </ModPdfBtn>
                                            </ModFileActions>
                                          </ModFileBlock>
                                        </ModFilesSection>
                                      )}

                                      {hasChanges && (
                                        <ChangesCompactBlock>
                                          {Object.entries(mod.changes).map(([field, change]) => (
                                            <ChangeRow key={field}>
                                              <ChangeFieldLabel>{getFieldLabel(field)}</ChangeFieldLabel>
                                              <span style={{ color: '#991b1b', textDecoration: 'line-through', fontSize: '0.72rem' }}>
                                                {(field === 'deadline' ? formatDate(change.original) : change.original) || '(κενό)'}
                                              </span>
                                              <span style={{ color: '#d97706', margin: '0 0.25rem' }}>→</span>
                                              <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.72rem' }}>
                                                {(field === 'deadline' ? formatDate(change.current) : change.current) || '(κενό)'}
                                              </span>
                                            </ChangeRow>
                                          ))}
                                        </ChangesCompactBlock>
                                      )}

                                      {canManageWorkflow && (
                                        <ModRowFooter>
                                          <ModActionBtn type="button" $variant="edit" onClick={() => handleEditModification(mod, prosklisi.prosklisiId)}>
                                            ✏️ Επεξεργασία
                                          </ModActionBtn>
                                          <ModActionBtn type="button" $variant="modDelete" onClick={() => handleDeleteModification(prosklisi.prosklisiId, mod.modificationId)}>
                                            🗑️ Διαγραφή
                                          </ModActionBtn>
                                        </ModRowFooter>
                                      )}
                                    </ModTableRow>
                                  );
                                })}
                              </ModificationsPanel>
                            )}
                          </ProsklisisItem>
                        );
                      })}
                    </GroupCards>
                  </ProjectGroup>
                );
              })}
            </ProsklisisList>
          )}
        </ModalScrollSection>
      </ModalContainer>

      {/* Portal dropdown menu */}
      {menuState.open && menuState.prosklisi && createPortal(
        <MenuDropdown
          data-prosklisi-menu="true"
          style={{ top: menuState.top, left: menuState.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MenuItem type="button" onClick={() => handleEditProsklisi(menuState.prosklisi)}>
            Επεξεργασία στοιχείων
          </MenuItem>
          <MenuItem type="button" onClick={() => handleNewModification(menuState.prosklisi)} title="Επίσημη τροποποίηση με έγγραφο και ιστορικό">
            Επίσημη τροποποίηση
          </MenuItem>
          <MenuItem type="button" $danger onClick={() => handleDeleteProsklisi(menuState.prosklisi.prosklisiId)}>
            Διαγραφή πρόσκλησης
          </MenuItem>
        </MenuDropdown>,
        document.body
      )}

      {/* SeeMoreText detail modal */}
      {textDetailModal && (
        <TextDetailOverlay onClick={closeTextDetailModal}>
          <TextDetailCard onClick={(e) => e.stopPropagation()}>
            <TextDetailTitle>{textDetailModal.title}</TextDetailTitle>
            <TextDetailBody>{textDetailModal.text}</TextDetailBody>
            <TextDetailClose onClick={closeTextDetailModal}>Κλείσιμο</TextDetailClose>
          </TextDetailCard>
        </TextDetailOverlay>
      )}

      {/* Prosklisi Form Modal */}
      {isFormOpen && (
        <ProsklisisForm
          isOpen={isFormOpen}
          onClose={async () => {
            if (editingProsklisi && editingProsklisi.prosklisiId) {
              await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
              setProsklisiLocks(prev => ({ ...prev, [editingProsklisi.prosklisiId]: false }));
            }
            setIsFormOpen(false);
            setEditingProsklisi(null);
            await loadProskliseis();
            requestListScrollRestore();
          }}
          onSave={handleSaveProsklisi}
          editingProsklisi={editingProsklisi}
        />
      )}

      {/* File Manager Modal */}
      <ProsklisisFileManager
        isOpen={fileManagerOpen.isOpen}
        onClose={() => {
          setFileManagerOpen({ isOpen: false, prosklisiId: null, prosklisiTitle: '' });
          requestListScrollRestore();
        }}
        prosklisiId={fileManagerOpen.prosklisiId}
        prosklisiTitle={fileManagerOpen.prosklisiTitle}
        userRole={userRole}
      />

      {/* Modification Form Modal (νέα ή επεξεργασία) */}
      {isModificationFormOpen && editingModification && (
        <ProsklisiModificationForm
          isOpen={isModificationFormOpen}
          onClose={async () => {
            const prosklisiId = editingModification.prosklisiId || editingModification.id;
            if (prosklisiId) {
              await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', prosklisiId);
              setProsklisiLocks((prev) => ({ ...prev, [prosklisiId]: false }));
            }
            setIsModificationFormOpen(false);
            setEditingModification(null);
            await loadProskliseis();
            requestListScrollRestore();
          }}
          onSave={editingModification.modificationId ? handleSaveModificationEdit : handleSaveModification}
          originalProsklisi={editingModification}
          isEditMode={!!editingModification.modificationId}
        />
      )}

      {/* Export Dialog */}
      <ProsklisisExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        proskliseis={filteredProskliseis.map((p) => ({
          ...p,
          modificationsCount: (prosklisiModifications[p.prosklisiId] || []).length,
          diavgeiaAda: getProsklisiDiavgeiaEntry(p)?.ada || '',
          linkedProjectsLabel: getLinkedProjectLabels(p).join(' · '),
          relatedEntaxeisCount: (relatedEntaxeisByProsklisi[p.prosklisiId] || []).length
        }))}
        totalProskliseis={proskliseis.length}
        organizationName={organizationName}
      />
    </ModalOverlay>
  );
}

export default ProsklisisManager;
