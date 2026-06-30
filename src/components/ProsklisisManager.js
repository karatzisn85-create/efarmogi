import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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
  gap: 0.75rem;
`;

/* ── Compact Card ── */

const ProsklisisItem = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
  border: 1.5px solid rgba(203, 213, 225, 0.7);
  border-left: 4px solid ${(p) => {
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
  overflow: visible;
  position: relative;
  opacity: ${(p) => (p.$isLocked ? 0.72 : 1)};
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
  &:hover {
    border-color: rgba(165, 180, 252, 0.65);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.1), 0 2px 6px rgba(15, 23, 42, 0.06);
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
  ${(p) => p.$accent && `
    background: linear-gradient(105deg, rgba(238, 242, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 100%);
    border-color: rgba(165, 180, 252, 0.45);
    color: #312e81;
  `}
  ${(p) => p.$green && `background: #f0fdf4; border-color: #86efac; color: #15803d;`}
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
  padding: 0.5rem 0.85rem 0.65rem;
  border-top: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
`;

const ModsToggleButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  border: 2px solid ${(p) => (p.$open ? '#d97706' : '#f59e0b')};
  background: ${(p) => p.$open
    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
    : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'};
  color: ${(p) => (p.$open ? '#92400e' : '#9a3412')};
  box-shadow: ${(p) => p.$open ? '0 3px 12px rgba(217, 119, 6, 0.22)' : '0 2px 8px rgba(245, 158, 11, 0.18)'};
  &:hover {
    border-color: #d97706;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    box-shadow: 0 4px 14px rgba(217, 119, 6, 0.28);
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
  border-top: 2px solid #fde68a;
  padding-bottom: 0.35rem;
  overflow: visible;
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

function ProsklisisManager({ isOpen, onClose, userRole, currentUser, projectFilter = null, selectedProsklisiId = null, linkedNotesMap = {}, notes = [], onOpenNoteFromEntity, organizationName = '' }) {
  const { showToast } = useToast();
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
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

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    axis: '', fundingSource: '', status: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: ''
  });
  const [quickSearchStatus, setQuickSearchStatus] = useState('');

  const [modsExpanded, setModsExpanded] = useState({});
  const [menuState, setMenuState] = useState({ open: false, top: 0, left: 0, type: null, prosklisi: null });
  const [textDetailModal, setTextDetailModal] = useState(null);

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
  }, [proskliseis, searchTerm, projectFilter, quickSearchStatus, advancedFilters, selectedProsklisiId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const loadProskliseis = async () => {
    setLoading(true);
    try {
      const data = await ipcRenderer.invoke('load-all-proskliseis');
      setProskliseis(data || []);
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
    if (searchTerm.trim()) {
      filtered = filtered.filter(p =>
        containsSearchTerm(p.title, searchTerm) || containsSearchTerm(p.axis, searchTerm) ||
        containsSearchTerm(p.fundingSource, searchTerm) || containsSearchTerm(p.code, searchTerm) ||
        containsSearchTerm(p.status, searchTerm)
      );
    }
    if (quickSearchStatus) filtered = filtered.filter(p => p.status === quickSearchStatus);
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

    if (advancedFilters.dateFrom) filtered = filtered.filter(p => { if (!p.deadline) return false; const c = compareDatesOnly(p.deadline, advancedFilters.dateFrom); return c !== null && c >= 0; });
    if (advancedFilters.dateTo) filtered = filtered.filter(p => { if (!p.deadline) return false; const c = compareDatesOnly(p.deadline, advancedFilters.dateTo); return c !== null && c <= 0; });
    if (selectedProsklisiId) filtered = filtered.filter(p => p.prosklisiId === selectedProsklisiId);
    setFilteredProskliseis(filtered);
  };

  /* ── Handlers ── */

  const handleSaveProsklisi = async (prosklisiData) => {
    try {
      await ipcRenderer.invoke('save-prosklisi', prosklisiData);
      await loadProskliseis();
      setIsFormOpen(false);
      setEditingProsklisi(null);
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

  const handleSaveModification = async (modificationData) => {
    try {
      await ipcRenderer.invoke('save-prosklisi-modification', modificationData);
      if (modificationData.changes && Object.keys(modificationData.changes).length > 0) {
        const updatedProsklisiData = {
          prosklisiId: modificationData.originalProsklisiId,
          title: modificationData.modifiedData.title,
          axis: modificationData.modifiedData.axis,
          fundingSource: modificationData.modifiedData.fundingSource,
          code: modificationData.modifiedData.code,
          deadline: modificationData.modifiedData.deadline,
          budgetRange: modificationData.modifiedData.budgetRange,
          status: modificationData.modifiedData.status,
          updatedAt: new Date().toISOString()
        };
        await ipcRenderer.invoke('save-prosklisi', updatedProsklisiData);
      }
      await loadProskliseis();
      setEditingModification(null);
      setIsModificationFormOpen(false);
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
    setEditingProsklisi(prosklisi);
    setIsFormOpen(true);
  };

  const handleDeleteProsklisi = async (prosklisiId) => {
    closeMenu();
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
    setEditingModification({ ...modification, prosklisiId, originalProsklisiData: prosklisi });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (prosklisiId, modificationId) => {
    if (await showConfirm({ title: 'Διαγραφή Τροποποίησης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        await ipcRenderer.invoke('delete-prosklisi-modification', prosklisiId, modificationId);
        await loadProskliseis();
      } catch (error) { showToast('Σφάλμα διαγραφής τροποποίησης: ' + error.message, 'error'); }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-prosklisi-modification', modificationData);
      if (editingModification && editingModification.prosklisiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingModification.prosklisiId);
        setProsklisiLocks(prev => ({ ...prev, [editingModification.prosklisiId]: false }));
      }
      await loadProskliseis();
      setEditingModification(null);
      setIsModificationFormOpen(false);
    } catch (error) { showToast('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message, 'error'); }
  };

  const handleNewModification = async (prosklisi) => {
    closeMenu();
    if (!(await tryAcquireProsklisiLock(prosklisi))) return;
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
    setAdvancedFilters({ axis: '', fundingSource: '', status: '', minBudget: '', maxBudget: '', dateFrom: '', dateTo: '' });
    setShowAdvancedFilters(false);
  };

  const handleClose = () => { handleClearFilters(); onClose(); };

  const groupProskliseisByStatus = () => {
    const groups = { 'Υπό Υποβολή': [], 'Υπό Ωρίμανση': [], 'Ολοκληρωμένες Προσκλήσεις': [], 'Άλλες': [] };
    filteredProskliseis.forEach(p => {
      if (p.status === 'Υπό Υποβολή') groups['Υπό Υποβολή'].push(p);
      else if (p.status === 'Υπό Ωρίμανση') groups['Υπό Ωρίμανση'].push(p);
      else if (p.status === 'Υποβληθέν ΤΔΠ') groups['Ολοκληρωμένες Προσκλήσεις'].push(p);
      else groups['Άλλες'].push(p);
    });
    return Object.entries(groups).filter(([, list]) => list.length > 0);
  };

  const getGroupStyle = (name) => {
    switch (name) {
      case 'Υπό Υποβολή': return { color: '#0d47a1', barColor: '#2196f3', icon: '📤' };
      case 'Υπό Ωρίμανση': return { color: '#424242', barColor: '#9e9e9e', icon: '⏳' };
      case 'Ολοκληρωμένες Προσκλήσεις': return { color: '#283593', barColor: '#7986cb', icon: '✅' };
      default: return { color: '#424242', barColor: '#9e9e9e', icon: '📋' };
    }
  };

  const handleAdvancedFilterChange = (field, value) => setAdvancedFilters(prev => ({ ...prev, [field]: value }));

  const getActiveFiltersCount = () => {
    let n = 0;
    if (searchTerm.trim()) n++; if (quickSearchStatus) n++;
    Object.values(advancedFilters).forEach(v => { if (typeof v === 'string' && v.trim()) n++; });
    return n;
  };

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
              <ToolbarActionButton type="button" primary onClick={() => { setEditingProsklisi(null); setIsFormOpen(true); }}>
                ➕ Νέα Πρόσκληση
              </ToolbarActionButton>
            )}
            <PanelExportButton type="button" onClick={() => setIsExportDialogOpen(true)}>
              📊 Εξαγωγή σε Excel
            </PanelExportButton>
            <ToolbarQuickInput
              type="text"
              placeholder="Αναζήτηση (τίτλος, άξονας, πηγή, κωδικός)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ToolbarFilterSelect value={quickSearchStatus} onChange={(e) => setQuickSearchStatus(e.target.value)}>
              <option value="">Όλες οι Καταστάσεις</option>
              {getUniqueStatuses().map(s => <option key={s} value={s}>{s}</option>)}
            </ToolbarFilterSelect>
            <ToolbarToggleButton type="button" $active={showAdvancedFilters} onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              🔍 {showAdvancedFilters ? 'Απόκρυψη φίλτρων' : 'Προηγμένα φίλτρα'}
            </ToolbarToggleButton>
          </ActionsBar>

          <SearchStats>
            <div className="stats-section">
              {(() => {
                const stats = getStatistics();
                return (
                  <>
                    <div className="stat-item"><span className="stat-icon">📋</span><span className="stat-label">Σύνολο:</span><span className="stat-number">{stats.total}</span></div>
                    <div className="stat-item"><span className="stat-icon">👁</span><span className="stat-label">Εμφανιζόμενα:</span><span className="stat-number">{stats.filtered}</span></div>
                    <div className="stat-item"><span className="stat-icon">⚡</span><span className="stat-label">Με τροποποιήσεις:</span><span className="stat-number">{stats.withModifications}</span></div>
                  </>
                );
              })()}
            </div>
            <div>
              {getActiveFiltersCount() > 0 && (
                <div className="filters-badge"><span className="filter-icon">🔧</span><span>Φίλτρα: {getActiveFiltersCount()}</span></div>
              )}
            </div>
          </SearchStats>

          {showAdvancedFilters && (
            <SearchBar>
              <SearchRow>
                <AdvSearchInput type="text" placeholder="Άξονας / Δράση..." value={advancedFilters.axis} onChange={(e) => handleAdvancedFilterChange('axis', e.target.value)} />
                <AdvSearchInput type="text" placeholder="Πηγή χρηματοδότησης..." value={advancedFilters.fundingSource} onChange={(e) => handleAdvancedFilterChange('fundingSource', e.target.value)} />
                <AdvFilterSelect value={advancedFilters.status} onChange={(e) => handleAdvancedFilterChange('status', e.target.value)}>
                  <option value="">Όλες (προηγμένο φίλτρο κατάστασης)</option>
                  {getUniqueStatuses().map(s => <option key={s} value={s}>{s}</option>)}
                </AdvFilterSelect>
              </SearchRow>
              <SearchRow>
                <AdvSearchInput type="text" placeholder="Ελάχιστος προϋπολογισμός (€)..." value={advancedFilters.minBudget} onChange={(e) => handleAdvancedFilterChange('minBudget', e.target.value)} />
                <AdvSearchInput type="text" placeholder="Μέγιστος προϋπολογισμός (€)..." value={advancedFilters.maxBudget} onChange={(e) => handleAdvancedFilterChange('maxBudget', e.target.value)} />
                <AdvDateInput type="date" value={advancedFilters.dateFrom} onChange={(e) => handleAdvancedFilterChange('dateFrom', e.target.value)} title="Από ημερομηνία λήξης υποβολής" />
                <AdvDateInput type="date" value={advancedFilters.dateTo} onChange={(e) => handleAdvancedFilterChange('dateTo', e.target.value)} title="Έως ημερομηνία λήξης υποβολής" />
              </SearchRow>
              <SearchRow>
                <ToolbarClearButton type="button" onClick={handleClearFilters}>🗑️ Καθαρισμός φίλτρων</ToolbarClearButton>
              </SearchRow>
            </SearchBar>
          )}
        </ModalTopSection>

        <ModalScrollSection>
          {loading ? (
            <LoadingMessage>Φόρτωση προσκλήσεων...</LoadingMessage>
          ) : filteredProskliseis.length === 0 ? (
            <NoDataMessage>
              {searchTerm ? 'Δεν βρέθηκαν προσκλήσεις που να ταιριάζουν στην αναζήτηση.' : 'Δεν υπάρχουν προσκλήσεις.'}
              {canManageWorkflow && !searchTerm && (
                <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Πατήστε «Νέα Πρόσκληση» για να προσθέσετε.</div>
              )}
            </NoDataMessage>
          ) : (
            <ProsklisisList>
              {groupProskliseisByStatus().map(([groupName, groupProskliseis]) => {
                const gs = getGroupStyle(groupName);
                return (
                  <ProjectGroup key={groupName}>
                    <ProjectGroupTitle $color={gs.color} $barColor={gs.barColor}>
                      {gs.icon} {groupName} ({groupProskliseis.length})
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

                        return (
                          <ProsklisisItem key={prosklisi.prosklisiId} $isLocked={isLocked} $status={prosklisi.status}>
                            <CardTopRightCluster>
                              <LockIndicator $isLocked={isLocked}>
                                {isLocked ? '🔒' : '🔓'}
                              </LockIndicator>
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
                                  {prosklisi.deadline && prosklisi.deadline !== '-' && (
                                    <MetaChip title="Λήξη Υποβολής">📅 {formatDate(prosklisi.deadline)}</MetaChip>
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
                                    onOpen={setTextDetailModal}
                                  />
                                )}

                                <MetaChipsRow>
                                  {prosklisi.code && <MetaChip title="Κωδικός">🔢 {prosklisi.code}</MetaChip>}
                                  {prosklisi.budgetRange && <MetaChip title="Εύρος Π/Υ">💵 {prosklisi.budgetRange}</MetaChip>}
                                  {prosklisi.fundingSource && (
                                    <MetaChip $accent title={prosklisi.fundingSource}>
                                      💰 {truncateText(prosklisi.fundingSource, 42)}
                                    </MetaChip>
                                  )}
                                  {(() => {
                                    const diavgeiaEntry = getProsklisiDiavgeiaEntry(prosklisi);
                                    if (!diavgeiaEntry) return null;
                                    return (
                                      <MetaChip
                                        title={diavgeiaEntry.title || `Διαύγεια — ${diavgeiaEntry.ada}`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleOpenDiavgeia(diavgeiaEntry)}
                                      >
                                        🌐 Διαύγεια · {diavgeiaEntry.ada}
                                      </MetaChip>
                                    );
                                  })()}
                                </MetaChipsRow>
                              </CompactMain>

                              <CompactAside>
                                <CompactActions>
                                  <IconBtn $filesPrimary type="button" onClick={() => handleViewFiles(prosklisi.prosklisiId)}>
                                    📁 Αρχεία
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
                                          {hasPDF && (
                                            <ViewFileBtn
                                              title="Προβολή PDF τροποποίησης"
                                              onClick={() => handleViewModificationPDF(prosklisi.prosklisiId, mod.modificationId)}
                                            >
                                              📄
                                            </ViewFileBtn>
                                          )}
                                        </ModTableHeader>

                                        {modDesc && (
                                          <SeeMoreText
                                            text={modDesc}
                                            modalTitle={`Τροποποίηση #${index + 1} — Περιγραφή`}
                                            singleLine
                                            TextComponent={ModComment}
                                            onOpen={setTextDetailModal}
                                          />
                                        )}
                                      </ModTableMain>

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
          <MenuItem type="button" onClick={() => handleNewModification(menuState.prosklisi)}>📝 Νέα Τροποποίηση</MenuItem>
          <MenuItem type="button" onClick={() => handleEditProsklisi(menuState.prosklisi)}>✏️ Επεξεργασία Πρόσκλησης</MenuItem>
          <MenuItem type="button" $danger onClick={() => handleDeleteProsklisi(menuState.prosklisi.prosklisiId)}>🗑️ Διαγραφή Πρόσκλησης</MenuItem>
        </MenuDropdown>,
        document.body
      )}

      {/* SeeMoreText detail modal */}
      {textDetailModal && (
        <TextDetailOverlay onClick={() => setTextDetailModal(null)}>
          <TextDetailCard onClick={(e) => e.stopPropagation()}>
            <TextDetailTitle>{textDetailModal.title}</TextDetailTitle>
            <TextDetailBody>{textDetailModal.text}</TextDetailBody>
            <TextDetailClose onClick={() => setTextDetailModal(null)}>Κλείσιμο</TextDetailClose>
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
          }}
          onSave={handleSaveProsklisi}
          onSaveModification={handleSaveModification}
          editingProsklisi={editingProsklisi}
        />
      )}

      {/* File Manager Modal */}
      <ProsklisisFileManager
        isOpen={fileManagerOpen.isOpen}
        onClose={() => setFileManagerOpen({ isOpen: false, prosklisiId: null, prosklisiTitle: '' })}
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
        proskliseis={filteredProskliseis}
        totalProskliseis={proskliseis.length}
        organizationName={organizationName}
      />
    </ModalOverlay>
  );
}

export default ProsklisisManager;
