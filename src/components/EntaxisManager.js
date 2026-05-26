import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { safeConfirm } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';
import styled from 'styled-components';
import EntaxisForm from './EntaxisForm';
import ModificationForm from './ModificationForm';
import EntaxisExportDialog from './EntaxisExportDialog';
import EntaxisFileViewer from './EntaxisFileViewer';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;
const path = require('path-browserify');

const truncateText = (text, maxLen = 100) => {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
};

const defaultModsExpanded = () => false;

const MENU_WIDTH = 210;
const MENU_EST_HEIGHT = 168;

function resolveEntaxiFileName(fileRef) {
  if (!fileRef) return '';
  if (typeof fileRef === 'string') return fileRef;
  return fileRef.fileName || fileRef.name || path.basename(fileRef.filePath || '') || '';
}

function computeMenuPosition(buttonEl, preferDropUp = false) {
  const rect = buttonEl.getBoundingClientRect();
  let dropUp = preferDropUp;
  if (!dropUp && rect.bottom + MENU_EST_HEIGHT > window.innerHeight - 12) {
    dropUp = true;
  }
  let top = dropUp ? rect.top - MENU_EST_HEIGHT - 6 : rect.bottom + 6;
  let left = rect.right - MENU_WIDTH;
  if (left < 8) left = 8;
  if (left + MENU_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - MENU_WIDTH - 8;
  }
  if (top < 8) top = 8;
  return { top, left };
}

const EntaxisOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 0.65rem 1cm;
  overflow-y: auto;
  box-sizing: border-box;

  @media (min-width: 900px) {
    padding: 0.85rem 1cm;
  }
`;

const EntaxisContainer = styled.div`
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

const EntaxisTopSection = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.98);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h2`
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

const CloseButton = styled.button`
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

  &:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
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

const QuickSearchInput = styled.input`
  flex: 1;
  max-width: 280px;
  min-width: 140px;
  padding: 0.45rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
  }

  &::placeholder {
    color: #94a3b8;
  }
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

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DateInput = styled.input`
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

const SearchButton = styled.button`
  padding: 0.65rem 1.25rem;
  background: #1e293b;
  color: #f8fafc;
  border: 1px solid #334155;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.45rem;

  &:hover {
    background: #334155;
    border-color: #475569;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ClearButton = styled.button`
  padding: 0.65rem 1.25rem;
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.45rem;

  &:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #0f172a;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  user-select: none;

  &:hover {
    border-color: rgba(99, 102, 241, 0.45);
    background: rgba(99, 102, 241, 0.04);
  }

  input[type='checkbox'] {
    margin: 0;
    cursor: pointer;
    accent-color: #4f46e5;
  }

  label {
    margin: 0;
    cursor: pointer;
    font-size: 0.875rem;
    color: #334155;
    font-weight: 500;
  }
`;

const ExportButton = styled.button`
  padding: 0.45rem 0.85rem;
  background: #15803d;
  color: #ffffff;
  border: 1px solid #166534;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;

  &:hover {
    background: #166534;
    border-color: #14532d;
    box-shadow: 0 2px 8px rgba(21, 128, 61, 0.2);
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
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

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const SearchStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.55rem;
  margin-bottom: 0;
  background: rgba(248, 250, 252, 0.95);
  border-radius: 8px;
  font-size: 0.72rem;
  color: #475569;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;

  .stats-section {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-weight: 500;
  }

  .stat-icon {
    font-size: 0.72rem;
    opacity: 0.75;
  }

  .stat-number {
    color: #4f46e5;
    font-weight: 700;
  }

  .stat-label {
    color: #64748b;
    font-weight: 500;
  }

  .filters-badge {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .filter-icon {
    font-size: 0.68rem;
  }
`;

const ActionButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  ${(props) =>
    props.primary
      ? `
    background: #4f46e5;
    color: #f8fafc;
    border: 1px solid #4338ca;

    &:hover {
      background: #4338ca;
      border-color: #3730a3;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.25);
    }
  `
      : `
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;

    &:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
  `}

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const EntaxisContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.45rem 1.25rem 1rem;
  border-top: 1px solid #e2e8f0;
`;

const NoEntaxisMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const ProjectGroup = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid ${(props) => (props.isUnlinked ? '#fecaca' : '#e2e8f0')};
  border-radius: 12px;
  background: ${(props) => (props.isUnlinked ? '#fef2f2' : '#f8fafc')};
  overflow: visible;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const ProjectHeader = styled.div`
  background: ${(props) =>
    props.isUnlinked
      ? 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)'
      : 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)'};
  color: #f8fafc;
  padding: 0.9rem 1.25rem;
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.02em;
`;

const EntaxisList = styled.div`
  padding: 0.65rem 0.75rem 0.75rem;
`;

const EntaxisItem = styled.div`
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 12px;
  margin-bottom: 0.65rem;
  overflow: visible;
  position: relative;
  opacity: ${(props) => (props.isLocked ? 0.72 : 1)};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: rgba(165, 180, 252, 0.55);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
  }
`;

const LockIndicator = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${(props) => (props.isLocked ? '#dc3545' : '#28a745')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.15);
  z-index: 10;
  border: 2px solid #ffffff;
`;

const CompactCardBody = styled.div`
  padding: 0.75rem 2.5rem 0.75rem 0.85rem;
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

const TypeDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(p) => (p.$main ? '#6366f1' : '#d97706')};
  flex-shrink: 0;
`;

const CompactLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

  ${(p) =>
    p.$accent &&
    `
    background: linear-gradient(105deg, rgba(238, 242, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 100%);
    border-color: rgba(165, 180, 252, 0.45);
    color: #312e81;
  `}

  ${(p) =>
    p.$green &&
    `
    background: #f0fdf4;
    border-color: #86efac;
    color: #15803d;
  `}

  ${(p) =>
    p.$clickable &&
    `
    cursor: pointer;
    &:hover {
      background: #e0e7ff;
      border-color: #a5b4fc;
      color: #4338ca;
    }
  `}
`;

const SubjectLine = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.45;
  word-break: break-word;

  ${(p) =>
    p.$singleLine
      ? `
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `
      : p.$expanded
        ? `
    display: block;
    overflow: visible;
    white-space: pre-wrap;
  `
        : `
    display: -webkit-box;
    -webkit-line-clamp: ${p.$lineClamp || 2};
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
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

  &:hover {
    color: #1d4ed8;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    border-radius: 2px;
  }
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

const CumulativeAmount = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #15803d;
  white-space: nowrap;
  letter-spacing: 0.01em;
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

  ${(p) =>
    p.$filesPrimary
      ? `
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    color: #f8fafc;
    border: 1px solid #3730a3;
    box-shadow: 0 2px 8px rgba(67, 56, 202, 0.25);
    &:hover {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    }
  `
      : `
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    &:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
  `}

  ${(p) =>
    p.$danger &&
    `
    background: #fef2f2;
    color: #991b1b;
    border-color: #fecaca;
    &:hover { background: #fee2e2; }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

  &:hover {
    background: #f8fafc;
  }

  ${(p) =>
    p.$danger &&
    `
    color: #991b1b;
    &:hover { background: #fef2f2; }
  `}
`;

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
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  border: 2px solid ${(p) => (p.$open ? '#d97706' : '#f59e0b')};
  background: ${(p) =>
    p.$open
      ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
      : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'};
  color: ${(p) => (p.$open ? '#92400e' : '#9a3412')};
  box-shadow: ${(p) =>
    p.$open ? '0 3px 12px rgba(217, 119, 6, 0.22)' : '0 2px 8px rgba(245, 158, 11, 0.18)'};

  &:hover {
    border-color: #d97706;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    box-shadow: 0 4px 14px rgba(217, 119, 6, 0.28);
  }

  &:focus-visible {
    outline: 2px solid #d97706;
    outline-offset: 2px;
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

const ModTableHead = styled.div`
  display: grid;
  grid-template-columns: 32px 88px minmax(90px, 110px) 1fr;
  gap: 0.35rem 0.5rem;
  padding: 0.35rem 0.85rem;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  border-bottom: 1px solid #e2e8f0;
`;

const ModTableRow = styled.div`
  margin: 0 0.55rem 0.4rem;
  font-size: 0.78rem;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  box-shadow: 0 1px 2px rgba(217, 119, 6, 0.08);
  overflow: hidden;

  &:last-child {
    margin-bottom: 0.55rem;
  }

  &:hover {
    border-color: #fcd34d;
    box-shadow: 0 2px 6px rgba(217, 119, 6, 0.12);
  }
`;

const ModTableMain = styled.div`
  display: grid;
  grid-template-columns: 32px 88px minmax(90px, 110px) 1fr;
  gap: 0.35rem 0.5rem;
  padding: 0.55rem 0.65rem;
  align-items: start;
`;

const ModRowFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
  padding: 0 0.65rem 0.5rem;
`;

const ModFilesSection = styled.div`
  border-top: 1px dashed #fcd34d;
  padding: 0.5rem 0.65rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.65);
`;

const ModFilesSectionTitle = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #92400e;
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
const DeleteFileBtn = styled(FileIconBtn)`
  &:hover { background: #fee2e2; color: #ef4444; border-color: #fecaca; }
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

  ${(p) =>
    p.$variant === 'edit' &&
    `
    background: #ecfdf5;
    color: #14532d;
    border: 1px solid #86efac;
    &:hover { background: #dcfce7; }
  `}

  ${(p) =>
    p.$variant === 'modDelete' &&
    `
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    &:hover { background: #fee2e2; }
  `}
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

const EntaxisDetails = styled.div`
  font-size: 0.875rem;
  color: #64748b;
`;

const EntaxisAmount = styled.div`
  font-size: 1.05rem;
  font-weight: 600;
  color: ${(props) =>
    props.positive ? '#15803d' : props.negative ? '#b91c1c' : '#1d4ed8'};
`;

const CommentsModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 1rem;
`;

const CommentsModalPanel = styled.div`
  background: rgba(255, 255, 255, 0.98);
  border-radius: 14px;
  padding: 1.75rem;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28);
  border: 1px solid #e2e8f0;
`;

const CommentsModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const CommentsModalTitle = styled.h3`
  margin: 0;
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 700;
`;

const CommentsModalBody = styled.div`
  font-size: 0.95rem;
  line-height: 1.65;
  color: #334155;
  white-space: pre-wrap;
`;

const CommentsModalClose = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;

  &:hover {
    background: #f8fafc;
    color: #0f172a;
  }
`;

const CommentsCallout = styled(EntaxisDetails)`
  margin-top: 0.8rem;
  padding: 0.65rem 0.85rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 3px solid #f59e0b;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const CommentsCalloutLabel = styled.span`
  font-weight: 600;
  color: #92400e;
`;

const CommentsCalloutInner = styled.div`
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const CommentsCalloutText = styled(SubjectLine)`
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.5;
`;

const ProsklisiLinkText = styled.span`
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 0.5rem;
  font-weight: 600;

  &:hover {
    color: #1d4ed8;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

const InlineTextButton = styled.button`
  background: #ffffff;
  color: #1e40af;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
  }
`;

const EmptyStateHint = styled.div`
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #64748b;
`;

function useTextOverflow(ref, deps) {
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setOverflows(false);
      return;
    }
    const style = window.getComputedStyle(el);
    const singleLine =
      style.whiteSpace === 'nowrap' ||
      (style.textOverflow === 'ellipsis' && style.webkitLineClamp === 'none');
    setOverflows(
      singleLine
        ? el.scrollWidth > el.clientWidth + 1
        : el.scrollHeight > el.clientHeight + 1
    );
  }, deps);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

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
      <TextComponent
        ref={ref}
        $expanded={false}
        $lineClamp={lineClamp}
        $singleLine={singleLine}
      >
        {value}
      </TextComponent>
      {overflows && (
        <ExpandLinkButton
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen({ title: modalTitle, text: value });
          }}
        >
          Δες περισσότερα
        </ExpandLinkButton>
      )}
    </>
  );
}

// ΧΕΙΡΟΚΙΝΗΤΗ ΔΙΟΡΘΩΣΗ - Καλέστε από Console: fixAllEntaxeis()
window.fixAllEntaxeis = async () => {
  const ipc = window.electronAPI;
  try {
    console.log('🔧 Loading all entaxeis...');
    const allEntaxeis = await ipc.invoke('load-all-entaxeis');
    console.log(`📋 Found ${allEntaxeis.length} entaxeis`);
    
    for (const entaxi of allEntaxeis) {
      console.log(`🔧 Fixing ${entaxi.entaxiId}...`);
      const result = await ipc.invoke('fix-entaxi-file-objects', entaxi.entaxiId);
      console.log(`  ${result.success ? '✅' : '❌'} ${result.message || result.error}`);
    }
    
    alert('✅ Όλες οι εντάξεις διορθώθηκαν! Κάντε F5 για refresh.');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Σφάλμα: ' + error.message);
  }
};

function EntaxisManager({ isOpen, onClose, userRole, currentUser, projectFilter = null, onDataChange, proskliseis = [], handleOpenProsklisi, onViewFile }) {
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [entaxeis, setEntaxeis] = useState([]);
  const [filteredEntaxeis, setFilteredEntaxeis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [editingEntaxi, setEditingEntaxi] = useState(null);
  const [selectedEntaxiForMod, setSelectedEntaxiForMod] = useState(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [editingModification, setEditingModification] = useState(null);
  const [selectedModification, setSelectedModification] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [entaxisLocks, setEntaxisLocks] = useState({});
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedEntaxiForViewer, setSelectedEntaxiForViewer] = useState(null);
  
  // Search state
  const [searchFilters, setSearchFilters] = useState({
    subject: '',
    fundingAuthority: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: '',
    projectTitle: '',
    showUnlinkedOnly: false
  });
  
  // Quick search state
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  const [expandedMods, setExpandedMods] = useState({});
  const [menuContext, setMenuContext] = useState(null);
  const [textDetailModal, setTextDetailModal] = useState(null);

  useEffect(() => {
    if (!menuContext) return undefined;
    const close = (e) => {
      if (e.target.closest('[data-entaxis-menu]')) return;
      setMenuContext(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuContext]);

  const openMenuAt = (event, context, preferDropUp = false) => {
    event.stopPropagation();
    const btn = event.currentTarget;
    const pos = computeMenuPosition(btn, preferDropUp);
    const same =
      menuContext &&
      menuContext.type === context.type &&
      menuContext.entaxi?.entaxiId === context.entaxi?.entaxiId;
    if (same) {
      setMenuContext(null);
      return;
    }
    setMenuContext({ ...pos, ...context });
  };

  const isModsExpanded = useCallback(
    (entaxiId, modCount) => {
      if (expandedMods[entaxiId] !== undefined) return expandedMods[entaxiId];
      return defaultModsExpanded(modCount);
    },
    [expandedMods]
  );

  const toggleModsExpanded = (entaxiId, modCount) => {
    setExpandedMods((prev) => ({
      ...prev,
      [entaxiId]: !isModsExpanded(entaxiId, modCount)
    }));
  };

  const tryAcquireEntaxiLock = async (entaxi) => {
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
    if (lockStatus.locked) {
      const who = lockStatus.lockedBy ? `«${lockStatus.lockedBy}»` : 'άλλον διαχειριστή';
      alert(`Η ένταξη είναι υπό επεξεργασία από ${who}.`);
      return false;
    }
    const lockOwner = currentUser?.fullName || currentUser?.username || '';
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'entaxeis', entaxi.entaxiId, lockOwner);
    if (!lockResult.success) {
      const who = lockResult.lockedBy ? `«${lockResult.lockedBy}»` : 'άλλον χρήστη';
      alert(`Δεν είναι δυνατή η επεξεργασία. Ανοιχτό από ${who}.`);
      return false;
    }
    setEntaxisLocks((prev) => ({ ...prev, [entaxi.entaxiId]: true }));
    return true;
  };

  const handleNewModification = async (entaxi) => {
    setMenuContext(null);
    if (!(await tryAcquireEntaxiLock(entaxi))) return;
    setSelectedEntaxiForMod(entaxi);
    setIsModificationFormOpen(true);
  };

  const handleEditEntaxi = async (entaxi) => {
    setMenuContext(null);
    if (!(await tryAcquireEntaxiLock(entaxi))) return;
    setEditingEntaxi(entaxi);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      loadEntaxeis();
      lockBodyScroll('entaxis');
    }
    return () => {
      unlockBodyScroll('entaxis');
    };
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [entaxeis, searchFilters, projectFilter, quickSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (entaxeis.length > 0) {
      loadEntaxisLocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entaxeis]);

  // Realtime lock monitoring για entaxeis - αθόρυβο με βελτιστοποίηση
  useEffect(() => {
    if (!isOpen) return;

    let isActive = true;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      setEntaxeis(currentEntaxeis => {
        if (!currentEntaxeis || currentEntaxeis.length === 0) return currentEntaxeis;
        
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < currentEntaxeis.length; i += BATCH_SIZE) {
          batches.push(currentEntaxeis.slice(i, i + BATCH_SIZE));
        }
        
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const batchLocks = {};
            await Promise.all(
              batch.map(async (entaxi) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                  batchLocks[entaxi.entaxiId] = lockStatus.locked;
                } catch (error) {
                  setEntaxisLocks(prevLocks => {
                    batchLocks[entaxi.entaxiId] = prevLocks[entaxi.entaxiId] || false;
                    return prevLocks;
                  });
                }
              })
            );
            return batchLocks;
          })
        ).then(batchResults => {
          if (!isActive) return;
          
          const newLocks = Object.assign({}, ...batchResults);
          setEntaxisLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => 
              newLocks[id] !== prevLocks[id]
            );
            
            if (hasChanges) {
              console.log('Entaxi lock changes detected, updating silently...');
              return newLocks;
            }
            return prevLocks;
          });
        }).catch(error => {
          console.error('Error checking entaxi locks:', error);
        });
        
        return currentEntaxeis;
      });
    };
    
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      checkLocks();
      
      intervalId = setInterval(() => {
        if (isActive) {
          checkLocks();
        }
      }, 8000);
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEntaxeis = async () => {
    try {
      setLoading(true);
      const loadedEntaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      console.log('Loaded entaxeis:', loadedEntaxeis); // Debug log
      setEntaxeis(loadedEntaxeis || []);
    } catch (error) {
      console.error('Error loading entaxeis:', error);
      setEntaxeis([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadEntaxisLocks = async () => {
    try {
      const locks = {};
      for (const entaxi of entaxeis) {
        const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
        locks[entaxi.entaxiId] = lockStatus.locked || false;
      }
      setEntaxisLocks(locks);
    } catch (error) {
      console.error('Error loading entaxis locks:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...entaxeis];

    // Project filter (if provided)
    if (projectFilter) {
      filtered = filtered.filter(entaxi => 
        entaxi.projectTitle === projectFilter
      );
    }

    // Quick search filter (searches in title/subject)
    if (quickSearchTerm) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, quickSearchTerm) ||
        containsSearchTerm(entaxi.projectTitle, quickSearchTerm)
      );
    }

    // Search filters
    if (searchFilters.subject) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, searchFilters.subject)
      );
    }

    if (searchFilters.fundingAuthority) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.fundingAuthority, searchFilters.fundingAuthority)
      );
    }

    if (searchFilters.projectTitle) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.projectTitle, searchFilters.projectTitle)
      );
    }

    // Amount filters
    if (searchFilters.minAmount) {
      const minAmount = parseFloat(searchFilters.minAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount >= minAmount;
      });
    }

    if (searchFilters.maxAmount) {
      const maxAmount = parseFloat(searchFilters.maxAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount <= maxAmount;
      });
    }

    // Date filters
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filtered = filtered.filter(entaxi => {
        const entaxiDate = new Date(entaxi.documentDate);
        return entaxiDate >= fromDate;
      });
    }

    // Unlinked entaxeis filter
    if (searchFilters.showUnlinkedOnly) {
      filtered = filtered.filter(entaxi => {
        // Check if entaxi is not linked to any project
        return !entaxi.projectTitle || entaxi.projectTitle === '' || 
               (!entaxi.subprojectIds || entaxi.subprojectIds.length === 0);
      });
    }

    setFilteredEntaxeis(filtered);
  };

  const handleSearchChange = (field, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchFilters({
      subject: '',
      fundingAuthority: '',
      minAmount: '',
      maxAmount: '',
      dateFrom: '',
      projectTitle: '',
      showUnlinkedOnly: false
    });
    setQuickSearchTerm('');
  };

  // Συνάρτηση για κλείσιμο του modal με καθαρισμό φίλτρων
  const handleClose = () => {
    clearFilters(); // Καθαρισμός όλων των φίλτρων
    onClose(); // Κλείσιμο του modal
  };

  const getActiveFiltersCount = () => {
    return Object.entries(searchFilters).filter(([key, value]) => {
      if (key === 'showUnlinkedOnly') {
        return value === true;
      }
      return value !== '';
    }).length;
  };

  const handleSaveEntaxi = async (entaxiData) => {
    try {
      await ipcRenderer.invoke('save-entaxi', entaxiData);
      
      await loadEntaxeis();
      setIsFormOpen(false);
      setEditingEntaxi(null);
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error saving entaxi:', error);
      alert('Σφάλμα αποθήκευσης ένταξης: ' + error.message);
    } finally {
      if (editingEntaxi && editingEntaxi.entaxiId) {
        try {
          await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
          setEntaxisLocks(prev => ({
            ...prev,
            [editingEntaxi.entaxiId]: false
          }));
        } catch (lockErr) {
          console.error('Error removing lock:', lockErr);
        }
      }
    }
  };

  const handleSaveModification = async (modificationData) => {
    try {
      await ipcRenderer.invoke('save-modification', selectedEntaxiForMod.entaxiId, modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την αποθήκευση τροποποίησης
      if (selectedEntaxiForMod && selectedEntaxiForMod.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [selectedEntaxiForMod.entaxiId]: false
        }));
      }
      
      await loadEntaxeis();
      setIsModificationFormOpen(false);
      setSelectedEntaxiForMod(null);
    } catch (error) {
      console.error('Error saving modification:', error);
    }
  };

  const handleDeleteEntaxi = async (entaxiId) => {
    if (await showConfirm({ title: 'Διαγραφή Ένταξης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την ένταξη;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        await ipcRenderer.invoke('delete-entaxi', entaxiId);
        await loadEntaxeis();
        // Ανανέωση των κυρίως έργων στο Dashboard
        if (onDataChange) {
          onDataChange();
        }
      } catch (error) {
        console.error('Error deleting entaxi:', error);
      }
    }
  };

  const handleViewFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      console.log('Viewing file:', { entaxiId, actualFileName, originalFileName: fileName });
      
      // Use the same method as proskliseis - direct file opening
      await ipcRenderer.invoke('view-entaxi-file', entaxiId, actualFileName);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα κατά την προβολή του αρχείου: ' + error.message);
    }
  };

  const handleOpenFileViewer = (entaxi) => {
    setSelectedEntaxiForViewer(entaxi);
    setFileViewerOpen(true);
  };

  const handleCloseFileViewer = () => {
    setFileViewerOpen(false);
    setSelectedEntaxiForViewer(null);
  };

  const handleDownloadFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      const result = await ipcRenderer.invoke('download-entaxi-file', entaxiId, actualFileName);
      
      if (result.success) {
        alert('Το αρχείο λήφθηκε επιτυχώς!');
      } else if (result.error !== 'Download cancelled') {
        alert('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message);
    }
  };

  const handleDeleteFile = async (entaxiId, fileName, isModification = false) => {
    // Handle both string and object fileName
    let actualFileName;
    if (typeof fileName === 'string') {
      actualFileName = fileName;
    } else if (fileName && typeof fileName === 'object') {
      console.log('⚠️ fileName is object, fixing entaxi first...');
      // Fix the entaxi JSON first
      const fixResult = await ipcRenderer.invoke('fix-entaxi-file-objects', entaxiId);
      console.log('🔧 Fix result:', fixResult);
      
      // Reload entaxeis to get the fixed data
      await loadEntaxeis();
      
      // Extract filename from object for display
      actualFileName = fileName.fileName || fileName.name || path.basename(fileName.filePath || '');
      alert(`Τα δεδομένα διορθώθηκαν. Παρακαλώ πατήστε Διαγραφή ξανά.`);
      return;
    } else {
      console.error('❌ Invalid fileName:', fileName);
      alert('Σφάλμα: Μη έγκυρο όνομα αρχείου');
      return;
    }
    
    console.log('🗑️ DELETE FILE REQUEST:', {
      entaxiId,
      fileName,
      actualFileName,
      isModification,
      fileNameType: typeof fileName
    });
    
    if (await showConfirm({ title: 'Διαγραφή Αρχείου', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${actualFileName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        console.log('📤 Sending delete request to backend...');
        const result = await ipcRenderer.invoke('delete-entaxi-file', entaxiId, actualFileName, isModification);
        console.log('📥 Delete result:', result);
        
        if (result.success) {
          console.log('✅ Delete successful, reloading entaxeis...');
          await loadEntaxeis(); // Reload to update UI
          console.log('✅ Entaxeis reloaded');
          alert('Το αρχείο διαγράφηκε επιτυχώς!');
        } else {
          console.error('❌ Delete failed:', result.error);
          alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + result.error);
        }
      } catch (error) {
        console.error('❌ Error deleting file:', error);
        alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + error.message);
      }
    }
  };

  const handleEditModification = (modification, parentEntaxi) => {
    setEditingModification({
      ...modification,
      entaxiId: parentEntaxi.entaxiId,
      subject: parentEntaxi.subject,
      fundingAuthority: parentEntaxi.fundingAuthority,
      initialAmount: parentEntaxi.initialAmount
    });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (entaxiId, modificationId) => {
    if (await showConfirm({ title: 'Διαγραφή Τροποποίησης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        await ipcRenderer.invoke('delete-entaxi-modification', entaxiId, modificationId);
        await loadEntaxeis(); // Reload to update UI
        alert('Η τροποποίηση διαγράφηκε επιτυχώς');
      } catch (error) {
        console.error('Error deleting modification:', error);
        alert('Σφάλμα διαγραφής τροποποίησης: ' + error.message);
      }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-entaxi-modification', modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την ενημέρωση τροποποίησης
      if (editingModification && editingModification.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingModification.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [editingModification.entaxiId]: false
        }));
      }
      
      await loadEntaxeis(); // Reload to update UI
      setEditingModification(null);
      setIsModificationFormOpen(false);
    } catch (error) {
      console.error('Error updating modification:', error);
      alert('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message);
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00';
    return amount.toString().replace(/\./g, ',');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getProsklisiTitle = (prosklisiId) => {
    const prosklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    return prosklisi ? prosklisi.title : 'Άγνωστη πρόσκληση';
  };

  const calculateCumulativeAmount = (entaxi) => {
    let total = parseFloat((entaxi.initialAmount || '0').replace(/\./g, '').replace(',', '.')) || 0;

    if (entaxi.modifications && Array.isArray(entaxi.modifications)) {
      entaxi.modifications.forEach((mod) => {
        const rawAmount = (mod.amount || '0').replace(/[^\d,.+-]/g, '').replace(/\./g, '').replace(',', '.');
        const modAmount = parseFloat(rawAmount) || 0;

        // Αν η τροποποίηση είναι απόλυτου ποσού (mod.changeAmount true) αντικαθιστούμε το σύνολο
        // Διαφορετικά, θεωρούμε ότι είναι μεταβολή (delta) και το προσθέτουμε στο σύνολο
        if (mod.changeAmount) {
          total = modAmount;
        } else {
          total += modAmount;
        }
      });
    }

    return total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group filtered entaxeis by project
  const groupedEntaxeis = filteredEntaxeis.reduce((groups, entaxi) => {
    const key = entaxi.projectTitle || 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entaxi);
    return groups;
  }, {});

  if (!isOpen) return null;

  return (
    <EntaxisOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <EntaxisContainer>
        <EntaxisTopSection>
        <Header>
          <Title>Εντάξεις Έργων</Title>
          <CloseButton type="button" onClick={handleClose}>Κλείσιμο</CloseButton>
        </Header>

        <ActionsBar>
          {canManageWorkflow && (
            <ActionButton
              type="button"
              primary
              onClick={() => {
                setEditingEntaxi(null);
                setIsFormOpen(true);
              }}
            >
              ➕ Νέα Ένταξη
            </ActionButton>
          )}
          <ExportButton type="button" onClick={() => setIsExportDialogOpen(true)}>
            📊 Εξαγωγή σε Excel
          </ExportButton>
          <QuickSearchInput
            type="text"
            placeholder="🔍 Γρήγορη αναζήτηση τίτλου ένταξης..."
            value={quickSearchTerm}
            onChange={(e) => setQuickSearchTerm(e.target.value)}
          />
          <ToolbarToggleButton
            type="button"
            $active={showAdvancedSearch}
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            🔍 {showAdvancedSearch ? 'ΑΠΟΚΡΥΨΗ ΦΙΛΤΡΩΝ' : 'ΣΥΝΘΕΤΗ ΑΝΑΖΗΤΗΣΗ'}
          </ToolbarToggleButton>
        </ActionsBar>

        {/* Στατιστικά - Εμφανίζονται πάντα */}
        <SearchStats>
          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-icon">📊</span>
              <span className="stat-label">Συνολικά:</span>
              <span className="stat-number">{entaxeis.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🔗</span>
              <span className="stat-label">Συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => e.projectTitle && e.projectTitle.trim() !== '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">❌</span>
              <span className="stat-label">Μη συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => !e.projectTitle || e.projectTitle.trim() === '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">📅</span>
              <span className="stat-label">{new Date().getFullYear()}:</span>
              <span className="stat-number">{entaxeis.filter(e => {
                if (!e.documentDate) return false;
                const entaxiYear = new Date(e.documentDate).getFullYear();
                return entaxiYear === new Date().getFullYear();
              }).length}</span>
            </div>
          </div>
          <div>
            {getActiveFiltersCount() > 0 && (
              <div className="filters-badge">
                <span className="filter-icon">🔧</span>
                <span>Φίλτρα: {getActiveFiltersCount()}</span>
              </div>
            )}
          </div>
        </SearchStats>

        {showAdvancedSearch && (
          <SearchBar>
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά θέμα..."
                value={searchFilters.subject}
                onChange={(e) => handleSearchChange('subject', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά φορέα χρηματοδότησης..."
                value={searchFilters.fundingAuthority}
                onChange={(e) => handleSearchChange('fundingAuthority', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά τίτλο έργου..."
                value={searchFilters.projectTitle}
                onChange={(e) => handleSearchChange('projectTitle', e.target.value)}
              />
            </SearchRow>
            
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Ελάχιστο ποσό (€)..."
                value={searchFilters.minAmount}
                onChange={(e) => handleSearchChange('minAmount', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Μέγιστο ποσό (€)..."
                value={searchFilters.maxAmount}
                onChange={(e) => handleSearchChange('maxAmount', e.target.value)}
              />
              <DateInput
                type="date"
                placeholder="Από ημερομηνία..."
                value={searchFilters.dateFrom}
                onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
              />
              <SearchButton type="button" onClick={() => applyFilters()}>
                🔍 Αναζήτηση
              </SearchButton>
              <ClearButton type="button" onClick={clearFilters}>
                🗑️ Καθαρισμός
              </ClearButton>
            </SearchRow>

            <SearchRow>
              <CheckboxContainer 
                onClick={() => handleSearchChange('showUnlinkedOnly', !searchFilters.showUnlinkedOnly)}
              >
                <input
                  type="checkbox"
                  checked={searchFilters.showUnlinkedOnly}
                  onChange={(e) => handleSearchChange('showUnlinkedOnly', e.target.checked)}
                />
                <label>Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο</label>
              </CheckboxContainer>
            </SearchRow>
          </SearchBar>
        )}
        </EntaxisTopSection>

        <EntaxisContent>
          {loading ? (
            <NoEntaxisMessage>
              Φόρτωση εντάξεων...
            </NoEntaxisMessage>
          ) : filteredEntaxeis.length === 0 || Object.keys(groupedEntaxeis).length === 0 ? (
            <NoEntaxisMessage>
              {projectFilter 
                ? `Δεν βρέθηκαν εντάξεις για το έργο "${projectFilter}".`
                : "Δεν βρέθηκαν εντάξεις έργων."
              }
              {canManageWorkflow && !projectFilter && (
                <EmptyStateHint>
                  Πατήστε "Νέα Ένταξη" για να προσθέσετε την πρώτη ένταξη.
                </EmptyStateHint>
              )}
            </NoEntaxisMessage>
          ) : (
            Object.entries(groupedEntaxeis)
              .sort(([a], [b]) => {
                // Ταξινόμηση: οι μη συσχετισμένες εντάξεις πρώτα
                const aIsUnlinked = a === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                const bIsUnlinked = b === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                if (aIsUnlinked && !bIsUnlinked) return -1;
                if (!aIsUnlinked && bIsUnlinked) return 1;
                return a.localeCompare(b);
              })
              .map(([projectTitle, projectEntaxeis]) => {
                const isUnlinked = projectTitle === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                return (
                  <ProjectGroup key={projectTitle} isUnlinked={isUnlinked}>
                    <ProjectHeader isUnlinked={isUnlinked}>{projectTitle}</ProjectHeader>
                <EntaxisList>
                  {projectEntaxeis.map((entaxi) => {
                    const modCount = entaxi.modifications?.length || 0;
                    const modsOpen = modCount > 0 && isModsExpanded(entaxi.entaxiId, modCount);
                    return (
                    <EntaxisItem
                      key={entaxi.entaxiId}
                      isLocked={entaxisLocks[entaxi.entaxiId]}
                    >
                      <LockIndicator isLocked={entaxisLocks[entaxi.entaxiId]}>
                        {entaxisLocks[entaxi.entaxiId] ? '🔒' : '🔓'}
                      </LockIndicator>

                      <CompactCardBody>
                        <CompactMain>
                          <CompactTitleRow>
                            <TypeDot $main />
                            <CompactLabel>Αρχική Ένταξη</CompactLabel>
                            <MetaChip title="Ημερομηνία έγγραφου">📅 {formatDate(entaxi.documentDate)}</MetaChip>
                          </CompactTitleRow>

                          <SeeMoreText
                            text={entaxi.subject}
                            modalTitle="Θέμα Ένταξης"
                            lineClamp={2}
                            onOpen={setTextDetailModal}
                          />

                          <MetaChipsRow>
                            {entaxi.fundingAuthority && (
                              <MetaChip $accent title={entaxi.fundingAuthority}>
                                🏛️ {truncateText(entaxi.fundingAuthority, 42)}
                              </MetaChip>
                            )}
                            <MetaChip title="Ποσό ένταξης">
                              💰 {formatAmount(entaxi.initialAmount)} €
                            </MetaChip>
                          </MetaChipsRow>

                          {entaxi.comments && entaxi.comments.trim() !== '' && (
                            <CommentsCallout style={{ marginTop: '0.25rem', padding: '0.45rem 0.6rem' }}>
                              <CommentsCalloutLabel>Σχόλια:</CommentsCalloutLabel>
                              <CommentsCalloutInner>
                                <SeeMoreText
                                  text={entaxi.comments}
                                  modalTitle="Σχόλια Ένταξης"
                                  lineClamp={3}
                                  TextComponent={CommentsCalloutText}
                                  onOpen={setTextDetailModal}
                                />
                              </CommentsCalloutInner>
                            </CommentsCallout>
                          )}

                          {entaxi.prosklisiId && (
                            <EntaxisDetails style={{ marginTop: '0.15rem', fontSize: '0.75rem' }}>
                              Πρόσκληση:
                              <ProsklisiLinkText
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (handleOpenProsklisi) {
                                    onClose();
                                    setTimeout(() => handleOpenProsklisi(entaxi.prosklisiId), 300);
                                  }
                                }}
                              >
                                {truncateText(getProsklisiTitle(entaxi.prosklisiId), 48)}
                              </ProsklisiLinkText>
                            </EntaxisDetails>
                          )}
                        </CompactMain>

                        <CompactAside>
                          <CumulativeAmount title="Διαμορφωθέν ποσό">
                            {calculateCumulativeAmount(entaxi)} €
                          </CumulativeAmount>
                          <CompactActions onClick={(e) => e.stopPropagation()}>
                            <IconBtn type="button" $filesPrimary onClick={() => handleOpenFileViewer(entaxi)} title="Προβολή αρχείων">
                              📁 Αρχεία
                            </IconBtn>
                            {canManageWorkflow && (
                              <MenuWrap>
                                <MenuTrigger
                                  type="button"
                                  title="Ενέργειες"
                                  onClick={(e) => openMenuAt(e, { type: 'main', entaxi })}
                                >
                                  ⋯
                                </MenuTrigger>
                              </MenuWrap>
                            )}
                          </CompactActions>
                        </CompactAside>
                      </CompactCardBody>

                      {modCount > 0 && (
                        <ModsToggleRow>
                          <ModsToggleButton
                            type="button"
                            $open={modsOpen}
                            aria-expanded={modsOpen}
                            title={modsOpen ? 'Απόκρυψη τροποποιήσεων' : 'Εμφάνιση τροποποιήσεων'}
                            onClick={() => toggleModsExpanded(entaxi.entaxiId, modCount)}
                          >
                            <ModsToggleLeft>
                              <ModsToggleIcon aria-hidden>📋</ModsToggleIcon>
                              <span>
                                {modsOpen ? 'Απόκρυψη τροποποιήσεων' : 'Προβολή τροποποιήσεων'}
                              </span>
                              <ModsCountBadge>{modCount}</ModsCountBadge>
                            </ModsToggleLeft>
                            <ModsToggleChevron aria-hidden>{modsOpen ? '▲' : '▼'}</ModsToggleChevron>
                          </ModsToggleButton>
                        </ModsToggleRow>
                      )}

                      {modsOpen && modCount > 0 && (
                        <ModificationsPanel>
                          <ModsSectionHeader>Τροποποιήσεις Ένταξης</ModsSectionHeader>
                          <ModTableHead>
                            <span>#</span>
                            <span>Ημ/νία</span>
                            <span>Ποσό</span>
                            <span>Σχόλιο</span>
                          </ModTableHead>
                          {entaxi.modifications.map((mod, index) => {
                            const modComment = mod.comments?.trim() || '';
                            const amountStr = mod.amount || '0';
                            const hasModPdf = !!resolveEntaxiFileName(mod.modificationPDF);
                            const hasApprovalPdf = !!resolveEntaxiFileName(mod.approvalPDF);
                            const hasAnyFile = hasModPdf || hasApprovalPdf;

                            const renderFileBlock = (label, fileRef) => {
                              if (!resolveEntaxiFileName(fileRef)) return null;
                              return (
                                <ModFileBlock key={label}>
                                  <ModFileLabel>{label}</ModFileLabel>
                                  <ModFileActions>
                                    <ViewFileBtn
                                      title="Προβολή"
                                      onClick={() => handleViewFile(entaxi.entaxiId, fileRef)}
                                    >
                                      👁
                                    </ViewFileBtn>
                                    <DownloadFileBtn
                                      title="Λήψη"
                                      onClick={() => handleDownloadFile(entaxi.entaxiId, fileRef)}
                                    >
                                      ⬇
                                    </DownloadFileBtn>
                                    {canManageWorkflow && (
                                      <DeleteFileBtn
                                        title="Διαγραφή"
                                        onClick={() => handleDeleteFile(entaxi.entaxiId, fileRef, true)}
                                      >
                                        ✕
                                      </DeleteFileBtn>
                                    )}
                                  </ModFileActions>
                                </ModFileBlock>
                              );
                            };

                            return (
                              <ModTableRow key={mod.modificationId || index}>
                                <ModTableMain>
                                  <ModIndex>{index + 1}</ModIndex>
                                  <span>{formatDate(mod.date)}</span>
                                  <EntaxisAmount
                                    positive={String(amountStr).includes('+')}
                                    negative={String(amountStr).includes('-')}
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    {formatAmount(amountStr)} €
                                  </EntaxisAmount>
                                  {modComment ? (
                                    <SeeMoreText
                                      text={modComment}
                                      modalTitle={`${index + 1}η Τροποποίηση — Σχόλια`}
                                      singleLine
                                      TextComponent={ModComment}
                                      onOpen={setTextDetailModal}
                                    />
                                  ) : (
                                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>—</span>
                                  )}
                                </ModTableMain>

                                {hasAnyFile && (
                                  <ModFilesSection>
                                    <ModFilesSectionTitle>Αρχεία τροποποίησης</ModFilesSectionTitle>
                                    {renderFileBlock('📄 Αρχείο Τροποποίησης', mod.modificationPDF)}
                                    {renderFileBlock('📋 Αρχείο Αποδοχής Χρηματοδότησης', mod.approvalPDF)}
                                  </ModFilesSection>
                                )}

                                {canManageWorkflow && (
                                  <ModRowFooter>
                                    <ModActionBtn
                                      type="button"
                                      $variant="edit"
                                      onClick={() => handleEditModification(mod, entaxi)}
                                    >
                                      ✏️ Επεξεργασία τροποποίησης
                                    </ModActionBtn>
                                    <ModActionBtn
                                      type="button"
                                      $variant="modDelete"
                                      onClick={() => handleDeleteModification(entaxi.entaxiId, mod.modificationId)}
                                    >
                                      🗑️ Διαγραφή τροποποίησης
                                    </ModActionBtn>
                                  </ModRowFooter>
                                )}
                              </ModTableRow>
                            );
                          })}
                        </ModificationsPanel>
                      )}
                    </EntaxisItem>
                    );
                  })}
                </EntaxisList>
              </ProjectGroup>
                );
              })
          )}
        </EntaxisContent>

        {/* Entaxi Form Modal */}
        <EntaxisForm
          isOpen={isFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (editingEntaxi) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [editingEntaxi.entaxiId]: false
              }));
            }
            setIsFormOpen(false);
            setEditingEntaxi(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveEntaxi}
          editingEntaxi={editingEntaxi}
        />

        {/* Modification Form Modal */}
        <ModificationForm
          isOpen={isModificationFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (selectedEntaxiForMod) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [selectedEntaxiForMod.entaxiId]: false
              }));
            }
            setIsModificationFormOpen(false);
            setSelectedEntaxiForMod(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveModification}
          entaxi={selectedEntaxiForMod}
        />

        {/* Modification Edit Modal */}
        {editingModification && (
          <ModificationForm
            isOpen={!!editingModification}
            onClose={async () => {
              // Καθάρισε όλα τα locks όταν κλείνει η φόρμα επεξεργασίας τροποποίησης
              await ipcRenderer.invoke('clear-all-locks');
              setEditingModification(null);
              // Ανανέωση για να ενημερωθεί το lock status
              await loadEntaxeis();
            }}
            onSave={handleSaveModificationEdit}
            entaxi={editingModification}
            isEditMode={true}
          />
        )}

        {/* Export Dialog Modal */}
        <EntaxisExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          entaxeis={filteredEntaxeis}
          totalEntaxeis={entaxeis.length}
        />

        {/* Comments Modal (τροποποίηση) */}
        {selectedModification && (
          <CommentsModalOverlay onClick={() => setSelectedModification(null)}>
            <CommentsModalPanel onClick={(e) => e.stopPropagation()}>
              <CommentsModalHeader>
                <CommentsModalTitle>Σχόλια Τροποποίησης</CommentsModalTitle>
                <CommentsModalClose type="button" onClick={() => setSelectedModification(null)}>
                  Κλείσιμο
                </CommentsModalClose>
              </CommentsModalHeader>
              <CommentsModalBody>
                {selectedModification.comments || 'Δεν υπάρχουν σχόλια για αυτή την τροποποίηση.'}
              </CommentsModalBody>
            </CommentsModalPanel>
          </CommentsModalOverlay>
        )}

        {/* Πλήρες κείμενο (θέμα / σχόλια ένταξης) */}
        {textDetailModal && (
          <CommentsModalOverlay onClick={() => setTextDetailModal(null)}>
            <CommentsModalPanel onClick={(e) => e.stopPropagation()}>
              <CommentsModalHeader>
                <CommentsModalTitle>{textDetailModal.title}</CommentsModalTitle>
                <CommentsModalClose type="button" onClick={() => setTextDetailModal(null)}>
                  Κλείσιμο
                </CommentsModalClose>
              </CommentsModalHeader>
              <CommentsModalBody>{textDetailModal.text}</CommentsModalBody>
            </CommentsModalPanel>
          </CommentsModalOverlay>
        )}
      </EntaxisContainer>

      {menuContext &&
        createPortal(
          <MenuDropdown
            data-entaxis-menu="true"
            style={{ top: menuContext.top, left: menuContext.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuContext.type === 'main' && menuContext.entaxi && (
              <>
                <MenuItem type="button" onClick={() => handleNewModification(menuContext.entaxi)}>
                  ⚡ Νέα τροποποίηση
                </MenuItem>
                <MenuItem type="button" onClick={() => handleEditEntaxi(menuContext.entaxi)}>
                  ✏️ Επεξεργασία ένταξης
                </MenuItem>
                <MenuItem
                  type="button"
                  $danger
                  onClick={() => {
                    setMenuContext(null);
                    handleDeleteEntaxi(menuContext.entaxi.entaxiId);
                  }}
                >
                  🗑️ Διαγραφή ένταξης
                </MenuItem>
              </>
            )}
          </MenuDropdown>,
          document.body
        )}

      {/* File Viewer Modal */}
      {fileViewerOpen && (
        <EntaxisFileViewer
          isOpen={fileViewerOpen}
          onClose={handleCloseFileViewer}
          entaxi={selectedEntaxiForViewer}
          userRole={userRole}
        />
      )}
    </EntaxisOverlay>
  );
}

export default EntaxisManager;
