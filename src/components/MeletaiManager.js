import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider';
import ExportSuccessModal from './ExportSuccessModal';
import { showConfirm } from '../utils/confirmModal';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { formatDateEl as formatShortDateEl } from '../utils/dateFormat';
import {
  countMeletiFiles,
  emptyMeleti,
  formatMeletiDisplayTitle,
  meletiPersistFingerprint,
  mergeMeletiServerUpdate,
  filterStudyNumberInput,
  validateStudyNumberFormat,
  compareStudyNumbers,
  formatMeletiBytes,
  filterMeletiBudgetInput,
  formatMeletiBudgetDisplay,
  normalizeMeletiBudgetStored,
  normalizeStudyApprovalDate,
  getMeletiFileTypeStyle,
  MELETI_FOLDER_TYPE_STYLE,
  countMeletiGroupFileEntries,
  isMeletiFolderEntry,
} from '../utils/meletaiHelpers';

function AssignedToField({
  id,
  value,
  onChange,
  engineerFullNames,
  disabled,
  InputComponent,
}) {
  const listId = `${id}-engineers`;
  const InputEl = InputComponent;
  return (
    <>
      <InputEl
        id={id}
        list={listId}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder="Επιλογή μηχανικού ή χειροκίνητη καταχώρηση"
      />
      <datalist id={listId}>
        {(engineerFullNames || []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {!disabled && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: '0.35rem' }}>
          Επιλέξτε από τους εγγεγραμμένους μηχανικούς ή πληκτρολογήστε όνομα εκτός συστήματος.
        </div>
      )}
    </>
  );
}

const ipcRenderer = window.electronAPI;

const C = {
  emerald: '#059669',
  emeraldDark: '#047857',
  emeraldLight: '#d1fae5',
  teal: '#0d9488',
  tealLight: '#ccfbf1',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  white: '#ffffff',
  rose: '#e11d48',
};

const fadeIn = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); }`;
const spin = keyframes`to { transform: rotate(360deg); }`;
const slideIn = keyframes`from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); }`;
const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: stretch;
  z-index: 1200;
  padding: 0.45rem;
  overflow: hidden;
`;

const Modal = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: 100%;
  max-width: none;
  min-height: calc(100vh - 0.9rem);
  height: calc(100vh - 0.9rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(5, 150, 105, 0.18), 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const MainModalHeader = styled.div`
  background: ${(p) => (p.$formal
    ? `linear-gradient(135deg, ${C.slate800} 0%, ${C.emeraldDark} 50%, ${C.teal} 100%)`
    : `linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 55%, #34d399 100%)`)};
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(5, 150, 105, 0.25);
  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${C.teal}, ${C.emerald}, #34d399);
    opacity: 0.85;
  }
  &::after {
    content: '';
    position: absolute;
    top: -40%;
    right: -5%;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }
`;

const HeaderTitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 1;
`;

const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const HeaderText = styled.div``;

const HeaderH = styled.h2`
  color: white;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

const HeaderSub = styled.div`
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.1rem;
`;

const CloseBtn = styled.button`
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;
  &:hover { background: rgba(255, 255, 255, 0.22); color: white; }
`;

const HeaderPrimaryBtn = styled.button`
  color: white;
  background: linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.48rem 1rem;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  transition: all 0.2s;
  z-index: 1;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4);
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(13, 148, 136, 0.5);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const ReadOnlyBadge = styled.span`
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.72rem;
  font-weight: 700;
  z-index: 1;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  position: relative;
  background: linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 40%, #f8fafc 70%, #f0fdf4 100%);
`;

const HubShell = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.5rem 1.35rem;
  min-height: 0;
  transition: opacity 0.22s ease, filter 0.22s ease;
  ${(p) => p.$dimmed && css`
    opacity: 0.52;
    filter: blur(1px);
    pointer-events: none;
    user-select: none;
  `}
`;

const HubControlsPanel = styled.div`
  position: sticky;
  top: 0;
  z-index: 4;
  margin-bottom: 1rem;
  padding: 0.9rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(209, 250, 229, 0.92) 100%);
  border: 1px solid rgba(5, 150, 105, 0.18);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(5, 150, 105, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
`;

const HubToolbarCard = styled.div`
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  padding: 0.75rem 0.85rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
  margin-bottom: 0.75rem;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${C.teal}, ${C.emerald}, #34d399);
  }
`;

const HubSearch = styled.input`
  flex: 1;
  min-width: 220px;
  padding: 0.55rem 0.85rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  background: ${C.white};
  font-size: 0.82rem;
  color: ${C.slate700};
  outline: none;
  box-sizing: border-box;
  transition: all 0.18s;
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04);
  &:focus {
    border-color: ${C.emerald};
    box-shadow: 0 0 0 3px ${C.emeraldLight}, inset 0 1px 3px rgba(15, 23, 42, 0.04);
  }
`;

const HubFiltersToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid ${(p) => (p.$active ? C.emerald : C.slate200)};
  border-radius: 10px;
  background: ${(p) => (p.$active ? `linear-gradient(135deg, ${C.emeraldLight}, ${C.white})` : C.white)};
  color: ${(p) => (p.$active ? C.emeraldDark : C.slate700)};
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  box-shadow: ${(p) => (p.$active ? '0 3px 10px rgba(5,150,105,0.15)' : 'none')};
  &:hover { border-color: ${C.emerald}; color: ${C.emeraldDark}; }
`;

const HubFilterSelect = styled.select`
  padding: 0.5rem 0.65rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  background: ${C.white};
  font-size: 0.75rem;
  font-weight: 700;
  color: ${C.slate700};
  outline: none;
  min-width: 148px;
  box-sizing: border-box;
  font-family: inherit;
  cursor: pointer;
  &:focus { border-color: ${C.emerald}; box-shadow: 0 0 0 3px ${C.emeraldLight}; }
`;

const HubStatsBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDark} 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.45);
  }
  &:disabled { opacity: 0.55; cursor: wait; }
`;

const HubClearFiltersBtn = styled.button`
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.rose}44;
  border-radius: 10px;
  background: #fff1f2;
  color: ${C.rose};
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  &:hover { border-color: ${C.rose}; background: #ffe4e6; }
`;

const HubFiltersPanel = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.85rem;
  border: 1px dashed ${C.emerald}55;
  border-radius: 12px;
  background: linear-gradient(180deg, ${C.emeraldLight}44 0%, ${C.white} 100%);
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  animation: ${fadeIn} 0.2s ease;
`;

const HubSummaryBar = styled.div`
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
  border: 1px solid ${C.emerald}33;
  border-radius: 12px;
  background: linear-gradient(135deg, ${C.white} 0%, ${C.emeraldLight} 100%);
  font-size: 0.72rem;
  font-weight: 600;
  color: ${C.slate600};
  box-shadow: 0 2px 10px rgba(5, 150, 105, 0.08);
  strong { color: ${C.emeraldDark}; font-weight: 800; }
`;

const HubStatHighlight = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.5rem;
  border-radius: 8px;
  background: ${(p) => p.$bg || C.white};
  color: ${(p) => p.$color || C.slate700};
  font-weight: 700;
  border: 1px solid ${(p) => `${p.$color || C.slate300}33`};
`;

const HubSummarySep = styled.span`
  color: ${C.slate300};
  font-weight: 400;
`;

const HubQuickFilters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0;
  padding-top: 0.15rem;
`;

const HubQuickFilterPill = styled.button`
  padding: 0.36rem 0.75rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? 'transparent' : C.slate200)};
  background: ${(p) => (p.$active
    ? `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDark} 100%)`
    : C.white)};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  box-shadow: ${(p) => (p.$active ? '0 3px 12px rgba(5,150,105,0.35)' : '0 1px 3px rgba(15,23,42,0.04)')};
  &:hover {
    border-color: ${C.emerald};
    ${(p) => !p.$active && css`background: ${C.emeraldLight}; color: ${C.emeraldDark};`}
    transform: translateY(-1px);
  }
`;

const HubListWrap = styled.div`
  background: ${C.white};
  border: 1px solid rgba(5, 150, 105, 0.15);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
`;

const HubListHead = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 2fr) 110px 100px minmax(120px, 1.4fr) 48px 88px 130px;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(90deg, ${C.slate800} 0%, ${C.emeraldDark} 100%);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.88);
`;

const HubListRow = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 2fr) 110px 100px minmax(120px, 1.4fr) 48px 88px 130px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid ${C.slate100};
  font-size: 0.76rem;
  transition: all 0.15s;
  &:nth-child(even) { background: ${C.slate50}99; }
  &:last-child { border-bottom: none; }
  &:hover {
    background: linear-gradient(90deg, ${C.emeraldLight}88 0%, ${C.tealLight}66 100%);
    box-shadow: inset 4px 0 0 ${C.emerald};
  }
`;

const HubListCell = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  color: ${C.slate600};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HubListTitleCell = styled.button`
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  min-width: 0;
`;

const HubListTitle = styled.div`
  font-weight: 700;
  color: ${C.slate900};
  line-height: 1.35;
  word-break: break-word;
  white-space: normal;
`;

const HubListSub = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${C.slate500};
  margin-top: 0.15rem;
  line-height: 1.3;
`;

const HubRowActions = styled.div`
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
`;

const HubRowBtn = styled.button`
  padding: 0.32rem 0.62rem;
  border-radius: 8px;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate700};
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s;
  ${(p) => p.$primary && css`
    background: linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 100%);
    color: white;
    border: none;
    box-shadow: 0 3px 10px rgba(5, 150, 105, 0.3);
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 5px 14px rgba(5, 150, 105, 0.4);
      color: white;
    }
  `}
  &:hover:not(:disabled) {
    border-color: ${C.emerald};
    color: ${C.emeraldDark};
    background: ${C.emeraldLight};
  }
  &:disabled { opacity: 0.45; cursor: wait; }
`;

const HubSkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const HubSkeletonRow = styled.div`
  height: 52px;
  border-radius: 8px;
  background: linear-gradient(90deg, ${C.slate100} 25%, ${C.slate200} 50%, ${C.slate100} 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.2s ease-in-out infinite;
`;

const HubEmpty = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: ${C.slate400};
  font-size: 0.82rem;
  font-style: italic;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
`;

const DetailBackBar = styled.div`
  padding: 0.65rem 1rem;
  border-bottom: 1px solid ${C.slate200};
  background: ${C.white};
  flex-shrink: 0;
`;

const BackBtn = styled.button`
  border: none;
  background: transparent;
  color: ${C.emeraldDark};
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  transition: all 0.15s;
  &:hover { background: ${C.emeraldLight}; }
`;

const DetailShell = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${C.slate50};
`;

const StudyDetailOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 1.25rem;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(3px);
  animation: ${fadeIn} 0.2s ease;
`;

const StudyDetailCard = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: min(920px, 94%);
  max-height: min(86vh, 800px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.08);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const StudyDetailModalHeader = styled.div`
  padding: 0.95rem 1.2rem;
  background: linear-gradient(135deg, ${C.slate800} 0%, ${C.emeraldDark} 48%, ${C.teal} 100%);
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const StudyDetailModalTitle = styled.h3`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: ${C.white};
  letter-spacing: -0.01em;
`;

const StudyDetailModalSub = styled.p`
  margin: 0.28rem 0 0;
  font-size: 0.74rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DetailToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1.25rem;
  background: ${C.white};
  border-bottom: 1px solid ${C.slate200};
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const DetailToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const DetailEditBtn = styled.button`
  border: none;
  background: linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 100%);
  color: white;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.48rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);
  transition: all 0.18s;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.38);
  }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const DetailExportBtn = styled.button`
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate700};
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.15s;
  &:hover:not(:disabled) {
    border-color: ${C.emerald};
    color: ${C.emeraldDark};
    background: ${C.emeraldLight};
  }
  &:disabled { opacity: 0.45; cursor: wait; }
`;

const DetailScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 2rem;
  animation: ${fadeIn} 0.22s ease;
`;

const DetailHero = styled.div`
  background: linear-gradient(135deg, ${C.slate800} 0%, ${C.emeraldDark} 42%, ${C.teal} 100%);
  border-radius: 16px;
  padding: 1.45rem 1.65rem;
  color: white;
  margin-bottom: 1.15rem;
  box-shadow: 0 10px 36px rgba(5, 150, 105, 0.22);
  position: relative;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    top: -30%;
    right: -8%;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.07);
    pointer-events: none;
  }
`;

const DetailHeroTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
`;

const DetailHeroNumber = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin-bottom: 0.55rem;
`;

const DetailHeroTitle = styled.h1`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.02em;
  max-width: 720px;
`;

const DetailHeroPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
  position: relative;
  z-index: 1;
`;

const DetailHeroPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.72rem;
  font-weight: 700;
`;

const DetailInfoStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1.1rem;
  padding: 0.55rem 0.8rem;
  background: ${C.slate50};
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  margin-bottom: 0.85rem;
`;

const DetailInfoItem = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
`;

const DetailInfoLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  color: ${C.slate500};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
`;

const DetailInfoValue = styled.span`
  font-size: 0.76rem;
  font-weight: 700;
  color: ${C.slate800};
  line-height: 1.3;
  word-break: break-word;
`;

const DetailSection = styled.section`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 1.1rem 1.2rem;
  margin-bottom: 0.85rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
`;

const DetailSectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid ${C.slate100};
`;

const DetailSectionIcon = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  background: ${C.emeraldLight};
  border: 1px solid ${C.emerald}33;
`;

const DetailSectionTitle = styled.h3`
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
  color: ${C.emeraldDark};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const DetailSectionCount = styled.span`
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${C.slate500};
  background: ${C.slate100};
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
`;

const DetailNotesText = styled.p`
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.65;
  color: ${C.slate700};
  white-space: pre-wrap;
`;

const DetailLinkPanel = styled.div`
  display: grid;
  gap: 0.65rem;
`;

const DetailLinkProject = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.slate500};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const DetailLinkSubproject = styled.div`
  font-size: 0.95rem;
  font-weight: 800;
  color: ${C.emeraldDark};
  line-height: 1.4;
`;

const DetailEmptyHint = styled.div`
  font-size: 0.82rem;
  color: ${C.slate400};
  font-style: italic;
`;

const MeletiGroupsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const MeletiGroupCard = styled.div`
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  overflow: hidden;
  background: ${C.white};
`;

const MeletiGroupCardHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.72rem 0.9rem;
  border: none;
  background: ${(p) => (p.$open ? `${C.emeraldLight}88` : C.slate50)};
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.18s;
  &:hover { background: ${C.emeraldLight}; }
`;

const MeletiGroupName = styled.div`
  font-size: 0.84rem;
  font-weight: 700;
  color: ${C.slate800};
  display: flex;
  align-items: center;
  gap: 0.55rem;
`;

const MeletiGroupCount = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.white};
  background: ${(p) => (p.$hasFiles ? C.emerald : C.slate300)};
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
`;

const MeletiGroupExpandHint = styled.span`
  font-size: 0.7rem;
  color: ${C.slate400};
  font-weight: 700;
`;

const MeletiGroupFilesArea = styled.div`
  padding: 0.75rem 0.85rem;
  background: ${C.white};
  border-top: 1px solid ${C.slate100};
`;

const MeletiFilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const MeletiFileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: ${C.white};
  border-radius: 10px;
  border: 1px solid ${C.slate200};
  gap: 0.75rem;
  transition: box-shadow 0.18s, border-color 0.18s;
  &:hover {
    border-color: ${C.slate300};
    box-shadow: 0 2px 10px rgba(5, 150, 105, 0.08);
  }
`;

const MeletiFolderHeaderItem = styled(MeletiFileItem)`
  cursor: pointer;
  user-select: none;
  background: ${(p) => (p.$open ? `${C.emeraldLight}66` : C.white)};
  border-color: ${(p) => (p.$open ? `${C.emerald}55` : C.slate200)};
`;

const MeletiFileInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.7rem;
`;

const MeletiFileTypeIcon = styled.div`
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  background: ${(p) => p.$bg};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
`;

const MeletiFileListName = styled.span`
  font-size: 0.84rem;
  font-weight: 500;
  color: ${C.slate800};
  word-break: break-word;
  line-height: 1.35;
`;

const MeletiFileListMeta = styled.span`
  display: block;
  font-size: 0.64rem;
  color: ${C.slate400};
  font-weight: 600;
  margin-top: 0.1rem;
`;

const MeletiNestedFilesTree = styled.div`
  margin: 0.35rem 0 0.15rem 0.5rem;
  padding: 0.35rem 0 0.15rem 1.1rem;
  border-left: 2px solid ${C.emerald}44;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const MeletiNestedFileItem = styled(MeletiFileItem)`
  background: ${C.slate50};
`;

const MeletiIconActionBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate500};
  font-size: 0.95rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s;
  flex-shrink: 0;
  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
`;

const MeletiViewIconBtn = styled(MeletiIconActionBtn)`
  &:hover {
    background: ${C.emeraldLight};
    color: ${C.emeraldDark};
    border-color: #a7f3d0;
  }
`;

const MeletiDownloadIconBtn = styled(MeletiIconActionBtn)`
  &:hover {
    background: #ecfdf5;
    color: ${C.teal};
    border-color: #a7f3d0;
  }
`;

const DetailGoSubprojectBtn = styled.button`
  margin-top: 0.75rem;
  border: none;
  background: linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 100%);
  color: white;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 0.55rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);
  transition: all 0.18s;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.38);
  }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const FolderModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1400;
  padding: 1rem;
`;

const WideModalCard = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: min(920px, 96vw);
  max-height: min(92vh, 900px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const WideModalBody = styled.div`
  padding: 1.15rem 1.35rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const WideModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.35rem;
  border-top: 1px solid ${C.slate200};
  background: ${C.slate50};
  flex-shrink: 0;
`;

const NewMeletiModalHeader = styled.div`
  padding: 1.15rem 1.35rem 1rem;
  background: linear-gradient(135deg, ${C.emeraldDark} 0%, ${C.emerald} 52%, ${C.teal} 100%);
  flex-shrink: 0;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 1.35rem;
    right: 1.35rem;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  }
`;

const NewMeletiModalTitle = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: ${C.white};
  letter-spacing: -0.01em;
`;

const NewMeletiModalSub = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
  line-height: 1.45;
`;

const modalFieldControlStyles = css`
  width: 100%;
  padding: 0.62rem 0.85rem;
  border: 1.5px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.84rem;
  min-width: 0;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  background-color: ${C.white};
  color: ${C.slate800};
  font-weight: 600;
  &:focus {
    border-color: ${C.emerald};
    box-shadow: 0 0 0 3px ${C.emeraldLight}, 0 2px 10px rgba(5, 150, 105, 0.14);
    outline: none;
  }
  &::placeholder { color: ${C.slate400}; font-weight: 500; }
`;

const ModalFormSection = styled.section`
  background: linear-gradient(145deg, ${C.slate50} 0%, ${C.white} 52%, ${C.emeraldLight}33 100%);
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 1rem 1.05rem 1.05rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 18px rgba(15, 23, 42, 0.05);
`;

const ModalFormSectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid ${C.slate200};
`;

const ModalFormSectionIcon = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  background: linear-gradient(135deg, ${C.emeraldLight}, ${C.white});
  border: 1px solid ${C.emerald}33;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.12);
`;

const ModalFormSectionTitle = styled.h4`
  margin: 0;
  font-size: 0.74rem;
  font-weight: 800;
  color: ${C.emeraldDark};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ModalFormLabel = styled.label`
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.slate600};
  letter-spacing: 0.02em;
  line-height: 1.3;
`;

const ModalFormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  padding: 0.62rem 0.72rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  &:focus-within {
    border-color: ${C.emerald}55;
    box-shadow: 0 0 0 3px ${C.emeraldLight}, 0 3px 10px rgba(5, 150, 105, 0.1);
  }
`;

const ModalFormFieldFull = styled(ModalFormField)`
  grid-column: 1 / -1;
`;

const ModalFormInput = styled.input`
  ${modalFieldControlStyles}
  border: 1.5px solid ${(p) => (p.$error ? '#ef4444' : C.slate200)};
  &:focus {
    border-color: ${(p) => (p.$error ? '#ef4444' : C.emerald)};
    box-shadow: 0 0 0 3px ${(p) => (p.$error ? 'rgba(239,68,68,0.12)' : C.emeraldLight)};
  }
`;

const ModalFormSelect = styled.select`
  ${modalFieldControlStyles}
  cursor: pointer;
`;

const ModalFormTextArea = styled.textarea`
  ${modalFieldControlStyles}
  min-height: 88px;
  resize: vertical;
`;

const ModalFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;

const ModalLockedWrap = styled.div`
  position: relative;
  margin-top: 0.85rem;
`;

const ModalLockNotice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.65rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fcd34d;
  color: #92400e;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.45;
`;

const ModalBasicsSaveRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px dashed ${C.slate200};
`;

const ModalBasicsSavedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: ${C.emeraldLight};
  color: ${C.emeraldDark};
  font-size: 0.72rem;
  font-weight: 800;
`;

const ModalSubSection = styled(ModalFormSection)`
  margin-top: 0.85rem;
  ${(p) => p.$locked && css`
    opacity: 0.72;
    pointer-events: none;
    user-select: none;
  `}
`;

const Main = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  animation: ${fadeIn} 0.2s ease;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-size: 14px;
  gap: 12px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  max-width: 900px;
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  grid-column: ${(p) => (p.$full ? '1 / -1' : 'auto')};
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Input = styled.input`
  border: 1px solid ${(p) => (p.$error ? '#ef4444' : '#cbd5e1')};
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  outline: none;
  background: ${(p) => (p.disabled ? '#f1f5f9' : 'white')};
  &:focus { border-color: ${(p) => (p.$error ? '#ef4444' : '#10b981')}; box-shadow: 0 0 0 3px ${(p) => (p.$error ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)')}; }
`;

const Select = styled.select`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  background: white;
  outline: none;
  &:focus { border-color: #10b981; }
`;

const TextArea = styled.textarea`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  min-height: 90px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  &:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); }
`;

const FieldError = styled.div`
  font-size: 12px;
  color: #dc2626;
  font-weight: 600;
`;

const SectionTitle = styled.h3`
  margin: 24px 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LinkBox = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  background: #f8fafc;
  max-width: 900px;
`;

const LinkChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  color: #065f46;
  font-weight: 600;
`;

const LinkSearchWrap = styled.div`
  margin-top: 10px;
  position: relative;
`;

const LinkResults = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  max-height: 220px;
  overflow-y: auto;
  z-index: 10;
`;

const LinkResultItem = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  background: white;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f1f5f9;
  &:hover { background: #f0fdf4; }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 20px;
  max-width: 900px;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  background: ${(p) => {
    if (p.$danger) return '#fef2f2';
    if (p.$primary) return 'linear-gradient(135deg, #059669, #10b981)';
    return '#f1f5f9';
  }};
  color: ${(p) => {
    if (p.$danger) return '#dc2626';
    if (p.$primary) return 'white';
    return '#334155';
  }};
  border: 1px solid ${(p) => (p.$danger ? '#fecaca' : p.$primary ? 'transparent' : '#e2e8f0')};
  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const FileSection = styled.div`
  max-width: 900px;
  margin-top: 8px;
`;

const GroupCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
  background: white;
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
`;

const GroupBody = styled.div`
  padding: 10px 14px 14px;
  border-top: 1px solid #f1f5f9;
`;

const FileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f8fafc;
  &:last-child { border-bottom: none; }
`;

const FileActions = styled.div`
  display: flex;
  gap: 4px;
`;

const SmallBtn = styled.button`
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  color: #475569;
  &:hover { background: #f8fafc; }
  &.danger { color: #dc2626; border-color: #fecaca; }
`;

const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

const CategoryManageRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
`;

const CategoryChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 3px 10px;
  font-size: 11px;
  color: #065f46;
`;

const StepBanner = styled.div`
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  border: 1px solid #6ee7b7;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 18px;
  max-width: 900px;
`;

const StepBannerTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #065f46;
  margin-bottom: 8px;
`;

const StepList = styled.ol`
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #047857;
  line-height: 1.6;
  li.done { color: #94a3b8; text-decoration: line-through; }
  li.active { font-weight: 700; color: #065f46; }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  padding: 20px;
`;

const ModalCard = styled.div`
  background: white;
  border-radius: 16px;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(0,0,0,0.18);
  overflow: hidden;
`;

const DialogHeader = styled.div`
  padding: 18px 20px 10px;
  h3 { margin: 0; font-size: 16px; color: #1e293b; }
  p { margin: 6px 0 0; font-size: 13px; color: #64748b; line-height: 1.45; }
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 18px;
  flex-wrap: wrap;
`;

const OrphanWarning = styled.div`
  font-size: 12px;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
`;

const NEW_MODAL_UNLOCK_HINT = 'Αποθηκεύστε πρώτα τα βασικά στοιχεία της μελέτης (κουμπί «Αποθήκευση βασικών» παραπάνω) για να ενεργοποιηθούν η σύνδεση υποέργου και τα αρχεία.';

const HUB_SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Ενημέρωση (νεότερα)' },
  { value: 'updated_asc', label: 'Ενημέρωση (παλαιότερα)' },
  { value: 'number', label: 'Αριθμός μελέτης' },
  { value: 'title', label: 'Τίτλος' },
];

function formatMeletiCount(n) {
  return `${n} ${n === 1 ? 'μελέτη' : 'μελέτες'}`;
}

function MeletaiManager({
  onClose,
  loggedInUsername,
  userRole,
  meletaiCanEdit = false,
  visibleSubprojectIds = null,
  initialMeletiId = null,
  onNavigateToSubproject = null,
  initialDetailScrollTop = 0,
  onDetailScrollRestored = null,
}) {
  const { showToast } = useToast();
  const isReadOnly = (userRole === 'USER' || userRole === 'ENGINEER') && !meletaiCanEdit;

  const [loading, setLoading] = useState(true);
  const [meletai, setMeletai] = useState([]);
  const [selectedId, setSelectedId] = useState(initialMeletiId);
  const [draft, setDraft] = useState(null);
  const [studyCategories, setStudyCategories] = useState([]);
  const [registeredEngineers, setRegisteredEngineers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [linkFilter, setLinkFilter] = useState('all');
  const [hubQuickFilter, setHubQuickFilter] = useState('');
  const [hubSortBy, setHubSortBy] = useState('updated_desc');
  const [showHubFiltersPanel, setShowHubFiltersPanel] = useState(false);
  const [showNewMeletiModal, setShowNewMeletiModal] = useState(false);
  const [newModalDraft, setNewModalDraft] = useState(null);
  const [newModalBasicsSaved, setNewModalBasicsSaved] = useState(false);
  const [newMeletiNumberError, setNewMeletiNumberError] = useState('');
  const [creatingMeleti, setCreatingMeleti] = useState(false);
  const [newModalLinkSearch, setNewModalLinkSearch] = useState('');
  const [newModalShowLinkResults, setNewModalShowLinkResults] = useState(false);
  const [newModalExpandedGroups, setNewModalExpandedGroups] = useState({});
  const [newModalExpandedFolders, setNewModalExpandedFolders] = useState({});
  const [newModalFolderFilesCache, setNewModalFolderFilesCache] = useState({});
  const [newModalDocGroupLabel, setNewModalDocGroupLabel] = useState('');
  const [hubReportExporting, setHubReportExporting] = useState(false);
  const [studyExportingId, setStudyExportingId] = useState(null);
  const [studyNumberError, setStudyNumberError] = useState('');
  const [saving, setSaving] = useState(false);
  const [subprojects, setSubprojects] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [showLinkResults, setShowLinkResults] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [folderFilesCache, setFolderFilesCache] = useState({});
  const [exportSuccess, setExportSuccess] = useState(null);
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newDocGroupLabel, setNewDocGroupLabel] = useState('');
  const [unsavedNavModal, setUnsavedNavModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [subprojectIdSet, setSubprojectIdSet] = useState(new Set());
  const [detailEditMode, setDetailEditMode] = useState(false);

  const savedFingerprintRef = useRef('');
  const newModalSavedFingerprintRef = useRef('');
  const numberCheckTimerRef = useRef(null);
  const lockedMeletiIdRef = useRef(null);
  const editBaselineUpdatedAtRef = useRef(null);
  const meletaiRef = useRef([]);
  const selectedIdRef = useRef(null);
  const detailEditModeRef = useRef(false);
  const expandedFoldersRef = useRef({});
  const newModalExpandedFoldersRef = useRef({});
  const detailScrollRef = useRef(null);
  const scrollRestoredRef = useRef(false);

  const selected = useMemo(
    () => meletai.find((m) => m.id === selectedId) || null,
    [meletai, selectedId]
  );

  const loadSubprojects = useCallback(async () => {
    try {
      const subRes = await ipcRenderer.invoke('get-meletai-subprojects', {
        actingUsername: loggedInUsername,
      });
      if (subRes?.success) {
        const subs = subRes.data || [];
        setSubprojects(subs);
        setSubprojectIdSet(new Set(subs.map((s) => s.subprojectId)));
      }
    } catch {
      /* non-blocking */
    }
  }, [loggedInUsername]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, configRes, engineersRes] = await Promise.all([
        ipcRenderer.invoke('load-all-meletai', {
          actingUsername: loggedInUsername,
          skipMaintenance: true,
        }),
        ipcRenderer.invoke('get-meletai-config', { actingUsername: loggedInUsername }),
        ipcRenderer.invoke('get-registered-engineers'),
      ]);
      if (listRes?.success) {
        setMeletai(listRes.meletai || []);
        meletaiRef.current = listRes.meletai || [];
      }
      if (configRes?.success) setStudyCategories(configRes.config?.studyCategories || []);
      if (engineersRes?.success) setRegisteredEngineers(engineersRes.engineers || []);
    } catch (e) {
      showToast('Σφάλμα φόρτωσης μελετών', 'error');
    } finally {
      setLoading(false);
    }
    void loadSubprojects();
  }, [loggedInUsername, showToast, loadSubprojects]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    detailEditModeRef.current = detailEditMode;
  }, [detailEditMode]);

  useEffect(() => {
    expandedFoldersRef.current = expandedFolders;
  }, [expandedFolders]);

  useEffect(() => {
    newModalExpandedFoldersRef.current = newModalExpandedFolders;
  }, [newModalExpandedFolders]);

  useEffect(() => {
    let cancelled = false;
    const refreshList = async () => {
      try {
        const res = await ipcRenderer.invoke('load-all-meletai', {
          actingUsername: loggedInUsername,
          skipMaintenance: true,
        });
        if (cancelled || !res?.success) return;
        const nextList = res.meletai || [];
        setMeletai(nextList);
        meletaiRef.current = nextList;
        const sid = selectedIdRef.current;
        if (sid && !detailEditModeRef.current) {
          const fresh = nextList.find((m) => m.id === sid);
          if (fresh) {
            setDraft(fresh);
            savedFingerprintRef.current = meletiPersistFingerprint(fresh);
          }
        }
        void loadSubprojects();
      } catch {
        /* silent poll */
      }
    };
    const timer = setInterval(refreshList, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loggedInUsername, loadSubprojects]);

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    meletaiRef.current = meletai;
  }, [meletai]);

  useEffect(() => {
    if (initialMeletiId) setSelectedId(initialMeletiId);
  }, [initialMeletiId]);

  useEffect(() => {
    setDetailEditMode(false);
    setShowCategoryManage(false);
    setExpandedGroups({});
    setExpandedFolders({});
    setFolderFilesCache({});
    scrollRestoredRef.current = false;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || detailEditMode || !initialDetailScrollTop || scrollRestoredRef.current) return undefined;
    const el = detailScrollRef.current;
    if (!el) return undefined;
    const timer = requestAnimationFrame(() => {
      el.scrollTop = initialDetailScrollTop;
      scrollRestoredRef.current = true;
      onDetailScrollRestored?.();
    });
    return () => cancelAnimationFrame(timer);
  }, [selectedId, initialDetailScrollTop, detailEditMode, onDetailScrollRestored]);

  useEffect(() => {
    if (!selectedId || isReadOnly || !detailEditMode) return undefined;
    let cancelled = false;
    const lockTargetId = selectedId;
    (async () => {
      const res = await ipcRenderer.invoke('create-entity-lock', 'meleti', lockTargetId, loggedInUsername || '');
      if (cancelled) return;
      if (!res?.success) {
        showToast(`Δεν ήταν δυνατή η επεξεργασία — ${res?.lockedBy || res?.error || 'ανοιχτό από άλλο χρήστη'}`, 'warning');
        setDetailEditMode(false);
        return;
      }
      lockedMeletiIdRef.current = lockTargetId;
    })();
    return () => {
      cancelled = true;
      if (lockedMeletiIdRef.current === lockTargetId) {
        ipcRenderer.invoke('remove-entity-lock', 'meleti', lockTargetId);
        lockedMeletiIdRef.current = null;
      }
    };
  }, [selectedId, isReadOnly, detailEditMode, loggedInUsername, showToast]);

  useEffect(() => () => {
    const id = lockedMeletiIdRef.current;
    if (id) {
      ipcRenderer.invoke('remove-entity-lock', 'meleti', id);
      lockedMeletiIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (selected) {
      setDraft({ ...selected });
      savedFingerprintRef.current = meletiPersistFingerprint(selected);
      setStudyNumberError('');
      setLinkSearch('');
    } else {
      setDraft(null);
    }
  }, [selected?.id]);

  const canNavigateToSubproject = useCallback((subprojectId) => {
    if (!subprojectId) return false;
    if (userRole !== 'ENGINEER') return true;
    if (!visibleSubprojectIds) return false;
    return visibleSubprojectIds.has(subprojectId);
  }, [userRole, visibleSubprojectIds]);

  const engineerFullNames = useMemo(
    () => (registeredEngineers || [])
      .map((e) => String(e.fullName || '').trim())
      .filter(Boolean),
    [registeredEngineers]
  );

  const visibleMeletai = useMemo(() => {
    if (userRole !== 'ENGINEER' || !visibleSubprojectIds) return meletai;
    return meletai.filter((m) => {
      if (!m.linkedSubprojectId) return true;
      return visibleSubprojectIds.has(m.linkedSubprojectId);
    });
  }, [meletai, userRole, visibleSubprojectIds]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = visibleMeletai.filter((m) => {
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (hubQuickFilter === 'linked' && !m.linkedSubprojectId) return false;
      if (hubQuickFilter === 'unlinked' && m.linkedSubprojectId) return false;
      if (hubQuickFilter === 'with_files' && countMeletiFiles(m) === 0) return false;
      if (hubQuickFilter === 'without_files' && countMeletiFiles(m) > 0) return false;
      if (linkFilter === 'linked' && !m.linkedSubprojectId) return false;
      if (linkFilter === 'unlinked' && m.linkedSubprojectId) return false;
      if (!q) return true;
      const hay = [
        m.studyNumber, m.title, m.assignedTo, m.category,
        m.projectExpenditureBudget, m.studyApprovalDate,
        m.linkedSubprojectTitle, m.linkedProjectTitle, m.notes,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (hubSortBy === 'number') {
        return compareStudyNumbers(a.studyNumber, b.studyNumber, 'desc');
      }
      if (hubSortBy === 'title') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'el');
      }
      const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return hubSortBy === 'updated_asc' ? da - db : db - da;
    });
    return list;
  }, [visibleMeletai, search, categoryFilter, linkFilter, hubQuickFilter, hubSortBy]);

  const hubStats = useMemo(() => ({
    total: visibleMeletai.length,
    linked: visibleMeletai.filter((m) => m.linkedSubprojectId).length,
    unlinked: visibleMeletai.filter((m) => !m.linkedSubprojectId).length,
    withFiles: visibleMeletai.filter((m) => countMeletiFiles(m) > 0).length,
  }), [visibleMeletai]);

  const hubHasSecondaryFilters = Boolean(categoryFilter || linkFilter !== 'all' || hubSortBy !== 'updated_desc');
  const hubHasActiveFilters = Boolean(
    search.trim() || categoryFilter || linkFilter !== 'all' || hubQuickFilter || hubSortBy !== 'updated_desc'
  );

  const clearHubFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setLinkFilter('all');
    setHubQuickFilter('');
    setHubSortBy('updated_desc');
  };

  const applyHubQuickFilter = (value) => {
    setHubQuickFilter((prev) => (prev === value ? '' : value));
  };

  const linkedSubprojectIds = useMemo(
    () => new Set(meletai.filter((m) => m.linkedSubprojectId).map((m) => m.linkedSubprojectId)),
    [meletai]
  );

  const isSubprojectLinkable = useCallback((subprojectId) => {
    if (userRole !== 'ENGINEER' || !visibleSubprojectIds) return true;
    return visibleSubprojectIds.has(subprojectId);
  }, [userRole, visibleSubprojectIds]);

  const newModalLinkSearchResults = useMemo(() => {
    const q = newModalLinkSearch.trim().toLowerCase();
    if (!q || q.length < 2 || !newModalDraft) return [];
    return subprojects
      .filter((sp) => {
        if (!isSubprojectLinkable(sp.subprojectId)) return false;
        if (newModalDraft.linkedSubprojectId === sp.subprojectId) return false;
        if (linkedSubprojectIds.has(sp.subprojectId)) return false;
        const hay = `${sp.projectTitle} ${sp.subprojectTitle}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [newModalLinkSearch, subprojects, linkedSubprojectIds, newModalDraft?.linkedSubprojectId, isSubprojectLinkable]);

  const newModalBasicsDirty = newModalDraft && newModalBasicsSaved
    && meletiPersistFingerprint(newModalDraft) !== newModalSavedFingerprintRef.current;

  const patchMeletiInList = useCallback((meleti) => {
    setMeletai((prev) => {
      const idx = prev.findIndex((m) => m.id === meleti.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = meleti;
        return next;
      }
      return [meleti, ...prev];
    });
  }, []);

  const applyModalMeletiUpdate = useCallback((meleti) => {
    patchMeletiInList(meleti);
    setNewModalDraft((prev) => mergeMeletiServerUpdate(prev, meleti, newModalSavedFingerprintRef.current));
    Object.entries(newModalExpandedFoldersRef.current).forEach(([key, open]) => {
      if (!open) return;
      const [groupId, folderId] = key.split(':');
      if (groupId && folderId && meleti?.id) {
        ipcRenderer.invoke('get-meleti-folder-files', {
          meletiId: meleti.id, groupId, folderId, actingUsername: loggedInUsername,
        }).then((res) => {
          if (res?.success) {
            setNewModalFolderFilesCache((prev) => ({ ...prev, [key]: res.files }));
          }
        });
      }
    });
  }, [patchMeletiInList, loggedInUsername]);

  const applyServerMeletiToDraft = useCallback((serverMeleti) => {
    if (!serverMeleti) return;
    patchMeletiInList(serverMeleti);
    meletaiRef.current = meletaiRef.current.map((m) => (
      m.id === serverMeleti.id ? serverMeleti : m
    ));
    setDraft((prev) => {
      const merged = mergeMeletiServerUpdate(prev, serverMeleti, savedFingerprintRef.current);
      if (selectedIdRef.current === serverMeleti.id) {
        editBaselineUpdatedAtRef.current = merged.updatedAt || serverMeleti.updatedAt || null;
      }
      return merged;
    });
    Object.entries(expandedFoldersRef.current).forEach(([key, open]) => {
      if (!open) return;
      const [groupId, folderId] = key.split(':');
      if (groupId && folderId && serverMeleti?.id) {
        ipcRenderer.invoke('get-meleti-folder-files', {
          meletiId: serverMeleti.id, groupId, folderId, actingUsername: loggedInUsername,
        }).then((res) => {
          if (res?.success) {
            setFolderFilesCache((prev) => ({ ...prev, [key]: res.files }));
          }
        });
      }
    });
  }, [patchMeletiInList, loggedInUsername]);

  const uploadResultToast = useCallback((baseMsg, res) => {
    const skipped = res?.skipped || 0;
    const requested = res?.requested || 0;
    if (skipped > 0 && requested > 0) {
      showToast(`${baseMsg} (${requested - skipped}/${requested} — ${skipped} παραλείφθηκαν)`, 'warning');
    } else {
      showToast(baseMsg, 'success');
    }
  }, [showToast]);

  const linkSearchResults = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return subprojects
      .filter((sp) => {
        if (!isSubprojectLinkable(sp.subprojectId)) return false;
        if (draft?.linkedSubprojectId === sp.subprojectId) return false;
        if (linkedSubprojectIds.has(sp.subprojectId)) return false;
        const hay = `${sp.projectTitle} ${sp.subprojectTitle}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [linkSearch, subprojects, linkedSubprojectIds, draft?.linkedSubprojectId, isSubprojectLinkable]);

  const checkStudyNumber = useCallback(async (number, excludeId) => {
    const trimmed = String(number || '').trim();
    if (!trimmed) {
      setStudyNumberError('');
      return true;
    }
    const fmt = validateStudyNumberFormat(trimmed);
    if (!fmt.ok) {
      setStudyNumberError(fmt.error);
      return false;
    }
    const res = await ipcRenderer.invoke('check-meleti-number', {
      studyNumber: fmt.studyNumber,
      excludeId,
      actingUsername: loggedInUsername,
    });
    if (res?.available === false) {
      setStudyNumberError(res.error || 'Ο αριθμός υπάρχει ήδη');
      return false;
    }
    setStudyNumberError('');
    return true;
  }, [loggedInUsername]);

  const handleStudyNumberChange = (value) => {
    const filtered = filterStudyNumberInput(value);
    setDraft((d) => ({ ...d, studyNumber: filtered }));
    if (numberCheckTimerRef.current) clearTimeout(numberCheckTimerRef.current);
    numberCheckTimerRef.current = setTimeout(() => {
      checkStudyNumber(filtered, draft?.id);
    }, 400);
  };

  const handleStudyNumberBlur = () => {
    if (!draft) return;
    const fmt = validateStudyNumberFormat(draft.studyNumber);
    if (!fmt.ok && String(draft.studyNumber || '').trim()) {
      setStudyNumberError(fmt.error);
      return;
    }
    if (fmt.ok && fmt.studyNumber !== draft.studyNumber) {
      setDraft((d) => ({ ...d, studyNumber: fmt.studyNumber }));
    }
    checkStudyNumber(fmt.ok ? fmt.studyNumber : draft.studyNumber, draft.id);
  };

  const releaseMeletiLock = useCallback(async (meletiId) => {
    if (!meletiId || isReadOnly) return;
    await ipcRenderer.invoke('remove-entity-lock', 'meleti', meletiId);
    if (lockedMeletiIdRef.current === meletiId) lockedMeletiIdRef.current = null;
  }, [isReadOnly]);

  useEffect(() => {
    if (!showNewMeletiModal || !newModalDraft?.id || isReadOnly) return undefined;
    const lockTargetId = newModalDraft.id;
    let cancelled = false;
    (async () => {
      const res = await ipcRenderer.invoke('create-entity-lock', 'meleti', lockTargetId, loggedInUsername || '');
      if (cancelled) return;
      if (res?.success) lockedMeletiIdRef.current = lockTargetId;
    })();
    return () => {
      cancelled = true;
      if (lockedMeletiIdRef.current === lockTargetId) {
        void releaseMeletiLock(lockTargetId);
      }
    };
  }, [showNewMeletiModal, newModalDraft?.id, isReadOnly, loggedInUsername, releaseMeletiLock]);

  const revertDraftToSaved = useCallback((meletiId) => {
    const saved = meletaiRef.current.find((m) => m.id === meletiId);
    if (saved) {
      setDraft({ ...saved });
      savedFingerprintRef.current = meletiPersistFingerprint(saved);
    }
    setStudyNumberError('');
  }, []);

  const persistMeleti = async (meletiData, { silent = false } = {}) => {
    if (isReadOnly) return { success: false };
    setSaving(true);
    try {
      const ok = await checkStudyNumber(meletiData.studyNumber, meletiData.id);
      if (!ok) return { success: false, error: studyNumberError };

      const res = await ipcRenderer.invoke('save-meleti', {
        meleti: meletiData,
        actingUsername: loggedInUsername,
        expectedUpdatedAt: meletiData?.updatedAt || undefined,
      });
      if (res?.success) {
        setMeletai((prev) => {
          const idx = prev.findIndex((m) => m.id === res.meleti.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.meleti;
            meletaiRef.current = next;
            return next;
          }
          const next = [res.meleti, ...prev];
          meletaiRef.current = next;
          return next;
        });
        setDraft(res.meleti);
        savedFingerprintRef.current = meletiPersistFingerprint(res.meleti);
        editBaselineUpdatedAtRef.current = res.meleti.updatedAt || null;
        if (!silent) showToast('Αποθηκεύτηκε', 'success');
        return res;
      }
      if (res?.duplicate) showToast(res.error, 'error');
      else if (res?.conflict) {
        const ok = await showConfirm({
          title: 'Σύγκρουση αποθήκευσης',
          message: res.error || 'Η μελέτη τροποποιήθηκε από άλλη ενέργεια.',
          detail: 'Να φορτωθούν οι τελευταίες τιμές από τον διακομιστή;',
          confirmLabel: 'Φόρτωση ξανά',
          danger: false,
          icon: '⚠',
        });
        if (ok && res.meleti) {
          setMeletai((prev) => prev.map((x) => (x.id === res.meleti.id ? res.meleti : x)));
          meletaiRef.current = meletaiRef.current.map((x) => (
            x.id === res.meleti.id ? res.meleti : x
          ));
          setDraft(res.meleti);
          savedFingerprintRef.current = meletiPersistFingerprint(res.meleti);
          editBaselineUpdatedAtRef.current = res.meleti.updatedAt || null;
        }
      } else showToast(res?.error || 'Αποτυχία αποθήκευσης', 'error');
      return res;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    const existsOnServer = meletai.some((m) => m.id === draft.id);
    const res = await persistMeleti(draft);
    if (res?.success && !existsOnServer) {
      setMeletai((prev) => {
        if (prev.some((m) => m.id === res.meleti.id)) return prev;
        return [res.meleti, ...prev];
      });
    }
    if (res?.success && detailEditMode) {
      setDetailEditMode(false);
      setShowCategoryManage(false);
    }
  };

  const enterDetailEditMode = useCallback(() => {
    if (isReadOnly || !selectedId || !draft) return;
    editBaselineUpdatedAtRef.current = draft.updatedAt || null;
    setDetailEditMode(true);
  }, [isReadOnly, selectedId, draft]);

  const cancelDetailEditMode = useCallback(async () => {
    if (!selectedId) return;
    const dirty = draft && meletiPersistFingerprint(draft) !== savedFingerprintRef.current;
    if (dirty) {
      const ok = await showConfirm({
        title: 'Ακύρωση επεξεργασίας',
        message: 'Θέλετε να απορρίψετε τις μη αποθηκευμένες αλλαγές;',
        confirmLabel: 'Απόρριψη',
        icon: '⚠',
      });
      if (!ok) return;
      revertDraftToSaved(selectedId);
    }
    setDetailEditMode(false);
    setShowCategoryManage(false);
    setLinkSearch('');
    setShowLinkResults(false);
  }, [selectedId, draft, revertDraftToSaved]);

  const resetNewMeletiModal = useCallback(() => {
    setShowNewMeletiModal(false);
    setNewModalDraft(null);
    setNewModalBasicsSaved(false);
    setNewMeletiNumberError('');
    setNewModalLinkSearch('');
    setNewModalShowLinkResults(false);
    setNewModalExpandedGroups({});
    setNewModalExpandedFolders({});
    setNewModalFolderFilesCache({});
    setNewModalDocGroupLabel('');
    newModalSavedFingerprintRef.current = '';
  }, []);

  useEffect(() => {
    if (selectedId && showNewMeletiModal) resetNewMeletiModal();
  }, [selectedId, showNewMeletiModal, resetNewMeletiModal]);

  const openNewMeletiModal = useCallback(() => {
    if (isReadOnly || selectedId) return;
    const id = uuidv4();
    const item = emptyMeleti(id, loggedInUsername);
    setNewModalDraft(item);
    setNewModalBasicsSaved(false);
    newModalSavedFingerprintRef.current = '';
    setNewMeletiNumberError('');
    setNewModalLinkSearch('');
    setNewModalShowLinkResults(false);
    setNewModalExpandedGroups({});
    setNewModalExpandedFolders({});
    setNewModalFolderFilesCache({});
    setNewModalDocGroupLabel('');
    setShowNewMeletiModal(true);
  }, [isReadOnly, selectedId, loggedInUsername]);

  const checkNewMeletiNumber = useCallback(async (number, excludeId) => {
    const trimmed = String(number || '').trim();
    if (!trimmed) {
      setNewMeletiNumberError('');
      return true;
    }
    const fmt = validateStudyNumberFormat(trimmed);
    if (!fmt.ok) {
      setNewMeletiNumberError(fmt.error);
      return false;
    }
    const res = await ipcRenderer.invoke('check-meleti-number', {
      studyNumber: fmt.studyNumber,
      excludeId: excludeId || newModalDraft?.id || null,
      actingUsername: loggedInUsername,
    });
    if (res?.available === false) {
      setNewMeletiNumberError(res.error || 'Ο αριθμός υπάρχει ήδη');
      return false;
    }
    setNewMeletiNumberError('');
    return true;
  }, [loggedInUsername, newModalDraft?.id]);

  const saveNewModalBasics = async () => {
    if (isReadOnly || creatingMeleti || !newModalDraft) return;
    const fmt = validateStudyNumberFormat(newModalDraft.studyNumber);
    if (!fmt.ok) {
      setNewMeletiNumberError(fmt.error);
      showToast(fmt.error, 'warning');
      return;
    }
    if (!String(newModalDraft.title || '').trim()) {
      showToast('Απαιτείται τίτλος μελέτης', 'warning');
      return;
    }
    const okNum = await checkNewMeletiNumber(newModalDraft.studyNumber, newModalDraft.id);
    if (!okNum) return;

    setCreatingMeleti(true);
    try {
      const meletiData = {
        ...newModalDraft,
        studyNumber: fmt.studyNumber,
        title: String(newModalDraft.title || '').trim(),
        assignedTo: String(newModalDraft.assignedTo || '').trim(),
        category: newModalDraft.category || '',
        notes: String(newModalDraft.notes || '').trim(),
        projectExpenditureBudget: normalizeMeletiBudgetStored(newModalDraft.projectExpenditureBudget),
        studyApprovalDate: normalizeStudyApprovalDate(newModalDraft.studyApprovalDate),
      };
      const res = await ipcRenderer.invoke('save-meleti', {
        meleti: meletiData,
        actingUsername: loggedInUsername,
        expectedUpdatedAt: newModalBasicsSaved ? newModalDraft.updatedAt : undefined,
      });
      if (res?.success) {
        applyModalMeletiUpdate(res.meleti);
        const wasAlreadySaved = newModalBasicsSaved;
        setNewModalBasicsSaved(true);
        newModalSavedFingerprintRef.current = meletiPersistFingerprint(res.meleti);
        showToast(
          wasAlreadySaved
            ? 'Ενημερώθηκαν τα βασικά στοιχεία'
            : 'Αποθηκεύτηκαν τα βασικά στοιχεία — μπορείτε να συνδέσετε υποέργο και αρχεία',
          'success'
        );
      } else if (res?.conflict) {
        const ok = await showConfirm({
          title: 'Σύγκρουση αποθήκευσης',
          message: res.error || 'Η μελέτη τροποποιήθηκε από άλλη ενέργεια.',
          detail: 'Να φορτωθούν οι τελευταίες τιμές από τον διακομιστή;',
          confirmLabel: 'Φόρτωση ξανά',
          danger: false,
          icon: '⚠',
        });
        if (ok && res.meleti) {
          applyModalMeletiUpdate(res.meleti);
        }
      } else {
        showToast(res?.error || 'Αποτυχία αποθήκευσης', 'error');
      }
    } finally {
      setCreatingMeleti(false);
    }
  };

  const promptNewModalUnlocked = () => {
    showToast(NEW_MODAL_UNLOCK_HINT, 'warning');
  };

  const cancelNewMeletiModal = async () => {
    if (creatingMeleti) return;
    const hasTypedBasics = newModalDraft && !newModalBasicsSaved && (
      String(newModalDraft.studyNumber || '').trim()
      || String(newModalDraft.title || '').trim()
      || String(newModalDraft.assignedTo || '').trim()
      || String(newModalDraft.projectExpenditureBudget || '').trim()
      || String(newModalDraft.studyApprovalDate || '').trim()
      || String(newModalDraft.notes || '').trim()
    );
    if (hasTypedBasics || newModalBasicsDirty) {
      const ok = await showConfirm({
        title: 'Κλείσιμο φόρμας',
        message: 'Θέλετε να κλείσετε τη φόρμα; Οι μη αποθηκευμένες αλλαγές στα βασικά στοιχεία θα χαθούν.',
        confirmLabel: 'Κλείσιμο',
        icon: '⚠',
      });
      if (!ok) return;
    } else if (newModalBasicsSaved && newModalDraft) {
      const hasFiles = countMeletiFiles(newModalDraft) > 0;
      const hasLink = !!newModalDraft.linkedSubprojectId;
      if (!hasFiles && !hasLink) {
        const keep = await showConfirm({
          title: 'Ημιτελής μελέτη',
          message: 'Η μελέτη αποθηκεύτηκε με βασικά στοιχεία μόνο, χωρίς αρχεία ή σύνδεση με υποέργο.',
          detail: '«Κράτηση» για να μείνει στο μητρώο · «Διαγραφή» για οριστική αφαίρεση.',
          confirmLabel: 'Κράτηση',
          cancelLabel: 'Διαγραφή',
          danger: false,
          icon: '📐',
        });
        if (!keep) {
          const del = await ipcRenderer.invoke('delete-meleti', {
            meletiId: newModalDraft.id,
            actingUsername: loggedInUsername,
          });
          if (del?.success) {
            setMeletai((prev) => prev.filter((m) => m.id !== newModalDraft.id));
            showToast('Η ημιτελής μελέτη διαγράφηκε', 'success');
          } else {
            showToast(del?.error || 'Αποτυχία διαγραφής', 'error');
            return;
          }
        }
      } else if (newModalBasicsDirty) {
        showToast('Αποθηκεύστε τις αλλαγές στα βασικά στοιχεία πριν το κλείσιμο', 'warning');
        return;
      }
    }
    resetNewMeletiModal();
  };

  const finishNewMeletiModal = () => {
    if (!newModalBasicsSaved) {
      promptNewModalUnlocked();
      return;
    }
    if (newModalBasicsDirty) {
      showToast('Αποθηκεύστε τις αλλαγές στα βασικά στοιχεία πριν το κλείσιμο', 'warning');
      return;
    }
    resetNewMeletiModal();
  };

  const openNewModalInDetail = () => {
    if (!newModalBasicsSaved || !newModalDraft) {
      promptNewModalUnlocked();
      return;
    }
    if (newModalBasicsDirty) {
      showToast('Αποθηκεύστε πρώτα τις αλλαγές στα βασικά στοιχεία', 'warning');
      return;
    }
    setSelectedId(newModalDraft.id);
    resetNewMeletiModal();
  };

  const requestBackToHub = useCallback(() => {
    if (!selectedId) return;
    const dirty = detailEditMode && draft && meletiPersistFingerprint(draft) !== savedFingerprintRef.current;
    if (!isReadOnly && dirty) {
      setUnsavedNavModal({ targetId: '__hub__', resolve: () => {} });
      return;
    }
    const finish = () => {
      setDetailEditMode(false);
      setShowCategoryManage(false);
      setSelectedId(null);
      setDraft(null);
    };
    if (lockedMeletiIdRef.current === selectedId) {
      releaseMeletiLock(selectedId).then(finish);
    } else {
      finish();
    }
  }, [selectedId, draft, isReadOnly, detailEditMode, releaseMeletiLock]);

  const completeUnsavedNavigation = useCallback(async (action) => {
    const modal = unsavedNavModal;
    if (!modal) return;
    const currentId = selectedId;
    const { targetId, resolve } = modal;
    setUnsavedNavModal(null);

    if (action === 'cancel') {
      resolve(false);
      return;
    }
    if (action === 'save') {
      const res = await persistMeleti(draft);
      if (!res?.success) {
        resolve(false);
        return;
      }
    } else if (action === 'discard') {
      if (currentId && !meletaiRef.current.some((m) => m.id === currentId)) {
        setDraft(null);
      } else if (currentId) {
        revertDraftToSaved(currentId);
      }
    }
    if (currentId) await releaseMeletiLock(currentId);

    if (targetId === '__close__') {
      resolve(true);
      onClose();
      return;
    }
    if (targetId === '__hub__') {
      setDetailEditMode(false);
      setShowCategoryManage(false);
      setSelectedId(null);
      setDraft(null);
      resolve(true);
      return;
    }
    setSelectedId(targetId);
    resolve(true);
  }, [unsavedNavModal, selectedId, draft, releaseMeletiLock, revertDraftToSaved, onClose, loggedInUsername]);

  const handleCloseRequest = useCallback(() => {
    if (!selectedId) {
      onClose();
      return;
    }
    const dirty = detailEditMode && draft && meletiPersistFingerprint(draft) !== savedFingerprintRef.current;
    if (!isReadOnly && dirty) {
      setUnsavedNavModal({ targetId: '__close__', resolve: () => {} });
      return;
    }
    const close = () => onClose();
    if (lockedMeletiIdRef.current === selectedId) {
      releaseMeletiLock(selectedId).then(close);
    } else {
      close();
    }
  }, [selectedId, draft, isReadOnly, detailEditMode, releaseMeletiLock, onClose]);

  const requestSelectMeletiId = useCallback((targetId) => {
    if (targetId === selectedId) return;
    const dirty = detailEditMode && draft && meletiPersistFingerprint(draft) !== savedFingerprintRef.current;
    if (!isReadOnly && dirty) {
      setUnsavedNavModal({ targetId, resolve: () => {} });
      return;
    }
    const switchTo = () => {
      setDetailEditMode(false);
      setShowCategoryManage(false);
      setSelectedId(targetId);
    };
    if (lockedMeletiIdRef.current === selectedId) {
      releaseMeletiLock(selectedId).then(switchTo);
    } else {
      switchTo();
    }
  }, [selectedId, draft, isReadOnly, detailEditMode, releaseMeletiLock]);

  const handleStudyOverlayDismiss = useCallback(() => {
    if (!selectedId) return;
    if (detailEditMode) {
      void cancelDetailEditMode();
      return;
    }
    requestBackToHub();
  }, [selectedId, detailEditMode, cancelDetailEditMode, requestBackToHub]);

  const handleDownloadFile = async (groupId, fileName, folderId) => {
    const res = await ipcRenderer.invoke('download-meleti-file', {
      meletiId: draft.id,
      groupId,
      fileName,
      folderId: folderId || undefined,
      actingUsername: loggedInUsername,
    });
    if (res?.success) showToast('Το αρχείο αποθηκεύτηκε', 'success');
    else if (!res?.canceled) showToast(res?.error || 'Αποτυχία λήψης', 'error');
  };

  const handleRenameFile = (groupId, oldName, folderId = null) => {
    const displayName = folderId && String(oldName || '').includes('/')
      ? String(oldName).split('/').pop()
      : oldName;
    setRenameModal({ groupId, oldName, newName: displayName, folderId: folderId || null });
  };

  const confirmRenameFile = async () => {
    if (!renameModal) return;
    const targetMeleti = renameModal.modalContext ? newModalDraft : draft;
    if (!targetMeleti) return;
    const { groupId, oldName, newName, folderId } = renameModal;
    const trimmed = String(newName || '').trim();
    if (!trimmed || trimmed === oldName) {
      setRenameModal(null);
      return;
    }
    let finalNewName = trimmed;
    if (folderId) {
      const parts = String(oldName || '').split('/').filter(Boolean);
      const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const newBase = trimmed.split(/[/\\]/).filter(Boolean).pop() || trimmed;
      finalNewName = parent ? `${parent}/${newBase}` : newBase;
    }
    const res = await ipcRenderer.invoke('rename-meleti-file', {
      meletiId: targetMeleti.id,
      groupId,
      oldName,
      newName: finalNewName,
      folderId: folderId || undefined,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      if (renameModal.modalContext) applyModalMeletiUpdate(res.meleti);
      else applyServerMeletiToDraft(res.meleti);
      setRenameModal(null);
      showToast('Μετονομάστηκε', 'success');
    } else {
      showToast(res?.error || 'Αποτυχία μετονομασίας', 'error');
    }
  };

  const handleDeleteMeleti = async () => {
    if (!draft || isReadOnly) return;
    if (!isDraftOnServer) {
      setDraft(null);
      setSelectedId(null);
      return;
    }
    const ok = await showConfirm({
      title: 'Διαγραφή Μελέτης',
      message: `Θέλετε να διαγράψετε οριστικά τη μελέτη «${formatMeletiDisplayTitle(draft)}»;`,
      detail: 'Θα διαγραφούν και όλα τα συνημμένα αρχεία. Η ενέργεια δεν αναιρείται.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti', {
      meletiId: draft.id,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      setMeletai((prev) => prev.filter((m) => m.id !== draft.id));
      setSelectedId(null);
      setDraft(null);
      await releaseMeletiLock(draft.id);
      showToast('Η μελέτη διαγράφηκε', 'success');
    } else {
      showToast(res?.error || 'Αποτυχία διαγραφής', 'error');
    }
  };

  const handleLinkSubproject = async (sp) => {
    if (!draft || isReadOnly || !ensureSavedFirst()) return;
    const res = await ipcRenderer.invoke('link-meleti-subproject', {
      meletiId: draft.id,
      subprojectId: sp.subprojectId,
      projectTitle: sp.projectTitle,
      subprojectTitle: sp.subprojectTitle,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyServerMeletiToDraft(res.meleti);
      setLinkSearch('');
      setShowLinkResults(false);
      showToast('Συνδέθηκε με υποέργο', 'success');
    } else {
      showToast(res?.error || 'Αποτυχία σύνδεσης', 'error');
    }
  };

  const handleUnlinkSubproject = async () => {
    if (!draft || isReadOnly) return;
    const ok = await showConfirm({
      title: 'Αποσύνδεση Υποέργου',
      message: 'Θέλετε να αποσυνδέσετε αυτή τη μελέτη από το υποέργο;',
      confirmLabel: 'Αποσύνδεση',
      icon: '🔗',
      danger: false,
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('unlink-meleti-subproject', {
      meletiId: draft.id,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyServerMeletiToDraft(res.meleti);
      showToast('Αποσυνδέθηκε', 'success');
    }
  };

  const handleAddDocGroup = async () => {
    if (!draft || isReadOnly || !ensureSavedFirst()) return;
    const label = newDocGroupLabel.trim();
    if (!label) return;
    const res = await ipcRenderer.invoke('add-meleti-file-group', {
      meletiId: draft.id,
      label,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyServerMeletiToDraft(res.meleti);
      setNewDocGroupLabel('');
      setExpandedGroups((prev) => ({ ...prev, [res.group.id]: true }));
    } else {
      showToast(res?.error || 'Αποτυχία', 'error');
    }
  };

  const handleUploadFiles = async (groupId = null) => {
    if (!draft || isReadOnly || !ensureSavedFirst()) return;
    const pick = await ipcRenderer.invoke('select-multiple-files', { title: 'Επιλογή Αρχείων Μελέτης', allFileTypes: true });
    if (!pick?.success || !pick.files?.length) return;
    const res = await ipcRenderer.invoke('upload-meleti-files', {
      meletiId: draft.id,
      groupId,
      files: pick.files,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyServerMeletiToDraft(res.meleti);
      if (res.groupId) setExpandedGroups((prev) => ({ ...prev, [res.groupId]: true }));
      uploadResultToast(`Ανέβηκαν ${res.files.length} αρχεία`, res);
    } else if (!res?.canceled) showToast(res?.error || 'Αποτυχία ανεβάσματος', 'error');
  };

  const handleUploadFolder = async (groupId = null) => {
    if (!draft || isReadOnly || !ensureSavedFirst()) return;
    const pick = await ipcRenderer.invoke('select-folder-files-flat');
    if (!pick?.success || !pick.files?.length) return;
    const res = await ipcRenderer.invoke('upload-meleti-folder', {
      meletiId: draft.id,
      groupId,
      folderName: pick.folderName || 'Φάκελος',
      files: pick.files,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyServerMeletiToDraft(res.meleti);
      if (res.groupId) setExpandedGroups((prev) => ({ ...prev, [res.groupId]: true }));
      uploadResultToast('Ο φάκελος ανέβηκε', res);
    } else if (!res?.canceled) showToast(res?.error || 'Αποτυχία ανεβάσματος', 'error');
  };

  const handleDeleteFile = async (groupId, fileName) => {
    if (!draft || isReadOnly) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Διαγραφή «${fileName}»;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-file', {
      meletiId: draft.id, groupId, fileName, actingUsername: loggedInUsername,
    });
    if (res?.success) applyServerMeletiToDraft(res.meleti);
  };

  const handleDeleteFolder = async (groupId, folderId, folderName) => {
    if (!draft || isReadOnly) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Φακέλου',
      message: `Διαγραφή φακέλου «${folderName}» και όλων των αρχείων του;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-folder', {
      meletiId: draft.id, groupId, folderId, actingUsername: loggedInUsername,
    });
    if (res?.success) applyServerMeletiToDraft(res.meleti);
  };

  const handleDeleteGroup = async (groupId, label) => {
    if (!draft || isReadOnly) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Κατηγορίας',
      message: `Διαγραφή κατηγορίας «${label}» και όλων των αρχείων της;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-group', {
      meletiId: draft.id, groupId, actingUsername: loggedInUsername,
    });
    if (res?.success) applyServerMeletiToDraft(res.meleti);
  };

  const newModalLoadFolderFiles = async (groupId, folderId) => {
    if (!newModalDraft) return;
    const key = `${groupId}:${folderId}`;
    const res = await ipcRenderer.invoke('get-meleti-folder-files', {
      meletiId: newModalDraft.id, groupId, folderId, actingUsername: loggedInUsername,
    });
    if (res?.success) {
      setNewModalFolderFilesCache((prev) => ({ ...prev, [key]: res.files }));
    }
  };

  const newModalToggleFolder = (groupId, folderId) => {
    const key = `${groupId}:${folderId}`;
    setNewModalExpandedFolders((prev) => {
      const next = !prev[key];
      if (next) newModalLoadFolderFiles(groupId, folderId);
      return { ...prev, [key]: next };
    });
  };

  const handleNewModalLinkSubproject = async (sp) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) {
      promptNewModalUnlocked();
      return;
    }
    const res = await ipcRenderer.invoke('link-meleti-subproject', {
      meletiId: newModalDraft.id,
      subprojectId: sp.subprojectId,
      projectTitle: sp.projectTitle,
      subprojectTitle: sp.subprojectTitle,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyModalMeletiUpdate(res.meleti);
      setNewModalLinkSearch('');
      setNewModalShowLinkResults(false);
      showToast('Συνδέθηκε με υποέργο', 'success');
    } else {
      showToast(res?.error || 'Αποτυχία σύνδεσης', 'error');
    }
  };

  const handleNewModalUnlinkSubproject = async () => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) return;
    const ok = await showConfirm({
      title: 'Αποσύνδεση Υποέργου',
      message: 'Θέλετε να αποσυνδέσετε αυτή τη μελέτη από το υποέργο;',
      confirmLabel: 'Αποσύνδεση',
      icon: '🔗',
      danger: false,
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('unlink-meleti-subproject', {
      meletiId: newModalDraft.id,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyModalMeletiUpdate(res.meleti);
      showToast('Αποσυνδέθηκε', 'success');
    }
  };

  const handleNewModalAddDocGroup = async () => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) {
      promptNewModalUnlocked();
      return;
    }
    const label = newModalDocGroupLabel.trim();
    if (!label) return;
    const res = await ipcRenderer.invoke('add-meleti-file-group', {
      meletiId: newModalDraft.id,
      label,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyModalMeletiUpdate(res.meleti);
      setNewModalDocGroupLabel('');
      setNewModalExpandedGroups((prev) => ({ ...prev, [res.group.id]: true }));
    } else {
      showToast(res?.error || 'Αποτυχία', 'error');
    }
  };

  const handleNewModalUploadFiles = async (groupId = null) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) {
      promptNewModalUnlocked();
      return;
    }
    const pick = await ipcRenderer.invoke('select-multiple-files', { title: 'Επιλογή Αρχείων Μελέτης', allFileTypes: true });
    if (!pick?.success || !pick.files?.length) return;
    const res = await ipcRenderer.invoke('upload-meleti-files', {
      meletiId: newModalDraft.id,
      groupId,
      files: pick.files,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyModalMeletiUpdate(res.meleti);
      if (res.groupId) setNewModalExpandedGroups((prev) => ({ ...prev, [res.groupId]: true }));
      uploadResultToast(`Ανέβηκαν ${res.files.length} αρχεία`, res);
    } else if (!res?.canceled) showToast(res?.error || 'Αποτυχία ανεβάσματος', 'error');
  };

  const handleNewModalUploadFolder = async (groupId = null) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) {
      promptNewModalUnlocked();
      return;
    }
    const pick = await ipcRenderer.invoke('select-folder-files-flat');
    if (!pick?.success || !pick.files?.length) return;
    const res = await ipcRenderer.invoke('upload-meleti-folder', {
      meletiId: newModalDraft.id,
      groupId,
      folderName: pick.folderName || 'Φάκελος',
      files: pick.files,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      applyModalMeletiUpdate(res.meleti);
      if (res.groupId) setNewModalExpandedGroups((prev) => ({ ...prev, [res.groupId]: true }));
      uploadResultToast('Ο φάκελος ανέβηκε', res);
    } else if (!res?.canceled) showToast(res?.error || 'Αποτυχία ανεβάσματος', 'error');
  };

  const handleNewModalDeleteFile = async (groupId, fileName) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Διαγραφή «${fileName}»;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-file', {
      meletiId: newModalDraft.id, groupId, fileName, actingUsername: loggedInUsername,
    });
    if (res?.success) applyModalMeletiUpdate(res.meleti);
  };

  const handleNewModalDeleteFolder = async (groupId, folderId, folderName) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Φακέλου',
      message: `Διαγραφή φακέλου «${folderName}» και όλων των αρχείων του;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-folder', {
      meletiId: newModalDraft.id, groupId, folderId, actingUsername: loggedInUsername,
    });
    if (res?.success) applyModalMeletiUpdate(res.meleti);
  };

  const handleNewModalDeleteGroup = async (groupId, label) => {
    if (!newModalDraft || isReadOnly || !newModalBasicsSaved) return;
    const ok = await showConfirm({
      title: 'Διαγραφή Κατηγορίας',
      message: `Διαγραφή κατηγορίας «${label}» και όλων των αρχείων της;`,
      confirmLabel: 'Διαγραφή',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('delete-meleti-group', {
      meletiId: newModalDraft.id, groupId, actingUsername: loggedInUsername,
    });
    if (res?.success) applyModalMeletiUpdate(res.meleti);
  };

  const handleNewModalDownloadFile = async (groupId, fileName, folderId) => {
    if (!newModalDraft) return;
    const res = await ipcRenderer.invoke('download-meleti-file', {
      meletiId: newModalDraft.id,
      groupId,
      fileName,
      folderId: folderId || undefined,
      actingUsername: loggedInUsername,
    });
    if (res?.success) showToast('Το αρχείο αποθηκεύτηκε', 'success');
    else if (!res?.canceled) showToast(res?.error || 'Αποτυχία λήψης', 'error');
  };

  const handleNewModalRenameFile = (groupId, oldName, folderId = null) => {
    const displayName = folderId && String(oldName || '').includes('/')
      ? String(oldName).split('/').pop()
      : oldName;
    setRenameModal({ groupId, oldName, newName: displayName, folderId: folderId || null, modalContext: true });
  };

  const loadFolderFiles = async (groupId, folderId) => {
    const key = `${groupId}:${folderId}`;
    const res = await ipcRenderer.invoke('get-meleti-folder-files', {
      meletiId: draft.id, groupId, folderId, actingUsername: loggedInUsername,
    });
    if (res?.success) {
      setFolderFilesCache((prev) => ({ ...prev, [key]: res.files }));
    }
  };

  const toggleFolder = (groupId, folderId) => {
    const key = `${groupId}:${folderId}`;
    setExpandedFolders((prev) => {
      const next = !(prev[key] === true);
      if (next) loadFolderFiles(groupId, folderId);
      return { ...prev, [key]: next };
    });
  };

  const handleExportStudy = async (meletiId, format = 'pdf') => {
    if (!meletiId || isReadOnly) return;
    setStudyExportingId(meletiId);
    try {
      const res = await ipcRenderer.invoke('export-meletai-study-report', {
        meletiId,
        format,
        actingUsername: loggedInUsername,
      });
      if (res?.success) {
        setExportSuccess({
          filePath: res.filePath,
          format: res.format || format,
          rowCount: res.rowCount,
          actionCount: res.actionCount ?? 1,
          sheetCount: res.rowCount ?? 0,
          exportedAt: res.exportedAt,
          pdfFallback: !!res.pdfFallback,
          message: res.message || '',
          isStudyReport: true,
        });
        if (res.pdfFallback) showToast(res.message || 'Δημιουργήθηκε HTML αντί PDF', 'warning');
      } else if (!res?.canceled) {
        showToast(res?.error || 'Αποτυχία εξαγωγής', 'error');
      }
    } finally {
      setStudyExportingId(null);
    }
  };

  const handleExport = async (format) => {
    if (isReadOnly) return;
    if (!filteredList.length) {
      showToast('Δεν υπάρχουν μελέτες προς εξαγωγή με τα τρέχοντα φίλτρα', 'warning');
      return;
    }
    setHubReportExporting(true);
    try {
      const res = await ipcRenderer.invoke('export-meletai-hub-report', {
        format,
        meletiIds: filteredList.map((m) => m.id),
        actingUsername: loggedInUsername,
      });
      if (res?.success) {
        setExportSuccess({
          filePath: res.filePath,
          format: res.format || format,
          rowCount: res.rowCount,
          actionCount: res.actionCount ?? res.rowCount,
          sheetCount: res.sheetCount,
          exportedAt: res.exportedAt,
          pdfFallback: !!res.pdfFallback,
          message: res.message || '',
        });
        if (res.pdfFallback) showToast(res.message || 'Δημιουργήθηκε HTML αντί PDF', 'warning');
      } else if (!res?.canceled) {
        showToast(res?.error || 'Αποτυχία εξαγωγής', 'error');
      }
    } finally {
      setHubReportExporting(false);
    }
  };

  const handleAddStudyCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) return;
    const res = await ipcRenderer.invoke('add-meletai-study-category', {
      label,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      setStudyCategories(res.config.studyCategories);
      setNewCategoryLabel('');
      showToast('Προστέθηκε κατηγορία', 'success');
    } else {
      showToast(res?.error || 'Αποτυχία', 'error');
    }
  };

  const handleRemoveStudyCategory = async (label) => {
    const ok = await showConfirm({
      title: 'Αφαίρεση Κατηγορίας',
      message: `Αφαίρεση κατηγορίας «${label}» από τη λίστα;`,
      confirmLabel: 'Αφαίρεση',
      danger: false,
      icon: '📋',
    });
    if (!ok) return;
    const res = await ipcRenderer.invoke('remove-meletai-study-category', {
      label,
      actingUsername: loggedInUsername,
    });
    if (res?.success) {
      setStudyCategories(res.config.studyCategories);
      if (res.meletaiCategoryCleared > 0) {
        const listRes = await ipcRenderer.invoke('load-all-meletai', { actingUsername: loggedInUsername });
        if (listRes?.success) {
          setMeletai(listRes.meletai || []);
          meletaiRef.current = listRes.meletai || [];
        }
        setDraft((d) => (d?.category === label ? { ...d, category: '' } : d));
        showToast(`Αφαιρέθηκε — καθαρίστηκε από ${res.meletaiCategoryCleared} μελέτες`, 'success');
      }
    }
  };

  const isDraftOnServer = draft && meletai.some((m) => m.id === draft.id);

  const ensureSavedFirst = () => {
    if (!isDraftOnServer) {
      showToast('Αποθηκεύστε πρώτα τη μελέτη (αριθμός και τίτλος) πριν από αυτή την ενέργεια', 'warning');
      return false;
    }
    return true;
  };

  const isDirty = draft && meletiPersistFingerprint(draft) !== savedFingerprintRef.current;

  const step1Done = draft && validateStudyNumberFormat(draft.studyNumber).ok && String(draft.title || '').trim();
  const step2Done = isDraftOnServer;
  const step3Done = draft?.linkedSubprojectId || countMeletiFiles(draft) > 0;

  const isLinkedSubprojectMissing = draft?.linkedSubprojectId
    && !subprojectIdSet.has(draft.linkedSubprojectId);

  const openMeletiFromHub = (id) => {
    requestSelectMeletiId(id);
  };

  const handleGoToLinkedSubproject = () => {
    if (!draft?.linkedSubprojectId || !onNavigateToSubproject) return;
    if (isLinkedSubprojectMissing) {
      showToast('Το συνδεδεμένο υποέργο δεν υπάρχει πλέον', 'warning');
      return;
    }
    if (!canNavigateToSubproject(draft.linkedSubprojectId)) {
      showToast('Δεν έχετε πρόσβαση σε αυτό το υποέργο — δεν είστε επιβλέπων', 'warning');
      return;
    }
    onNavigateToSubproject(draft.linkedSubprojectId, {
      scrollTop: detailScrollRef.current?.scrollTop || 0,
      meletiId: draft.id,
    });
  };

  const isLinkedSubprojectNavBlocked = Boolean(
    draft?.linkedSubprojectId
    && !isLinkedSubprojectMissing
    && !canNavigateToSubproject(draft.linkedSubprojectId)
  );

  const renderPresentationFiles = () => {
    if (!draft) return null;
    const groups = draft.fileGroups || [];
    if (!groups.length) {
      return <DetailEmptyHint>Δεν έχουν ανέβει αρχεία για αυτή τη μελέτη.</DetailEmptyHint>;
    }
    return (
      <MeletiGroupsList>
        {groups.map((group) => {
          const expanded = expandedGroups[group.id] === true;
          const entryCount = countMeletiGroupFileEntries(group);
          return (
            <MeletiGroupCard key={group.id}>
              <MeletiGroupCardHeader
                type="button"
                $open={expanded}
                onClick={() => setExpandedGroups((p) => ({ ...p, [group.id]: !expanded }))}
              >
                <MeletiGroupName>
                  <span>{group.label}</span>
                  <MeletiGroupCount $hasFiles={entryCount > 0}>{entryCount}</MeletiGroupCount>
                </MeletiGroupName>
                <MeletiGroupExpandHint>{expanded ? '▼' : '▶'}</MeletiGroupExpandHint>
              </MeletiGroupCardHeader>
              {expanded && (
                <MeletiGroupFilesArea>
                  {(group.files || []).length === 0 ? (
                    <DetailEmptyHint>Κενή κατηγορία</DetailEmptyHint>
                  ) : (
                    <MeletiFilesList>
                      {(group.files || []).map((entry) => {
                        if (isMeletiFolderEntry(entry)) {
                          const fKey = `${group.id}:${entry.id}`;
                          const folderExpanded = expandedFolders[fKey] === true;
                          const count = entry.fileCount || 0;
                          return (
                            <div key={entry.id}>
                              <MeletiFolderHeaderItem
                                $open={folderExpanded}
                                onClick={() => toggleFolder(group.id, entry.id)}
                              >
                                <MeletiFileInfo>
                                  <MeletiFileTypeIcon $bg={MELETI_FOLDER_TYPE_STYLE.bg}>
                                    {MELETI_FOLDER_TYPE_STYLE.label}
                                  </MeletiFileTypeIcon>
                                  <div style={{ minWidth: 0 }}>
                                    <MeletiFileListName title={entry.name}>{entry.name}</MeletiFileListName>
                                    <MeletiFileListMeta>
                                      {count} {count === 1 ? 'αρχείο' : 'αρχεία'}
                                      {folderExpanded ? ' · κλικ για σύμπτυξη' : ' · κλικ για ανάπτυξη'}
                                    </MeletiFileListMeta>
                                  </div>
                                </MeletiFileInfo>
                              </MeletiFolderHeaderItem>
                              {folderExpanded && (
                                <MeletiNestedFilesTree>
                                  {(folderFilesCache[fKey] || []).length === 0 ? (
                                    <DetailEmptyHint>Φόρτωση ή κενός φάκελος…</DetailEmptyHint>
                                  ) : (folderFilesCache[fKey] || []).map((ff) => {
                                    const typeStyle = getMeletiFileTypeStyle(ff.name);
                                    return (
                                      <MeletiNestedFileItem key={ff.name}>
                                        <MeletiFileInfo>
                                          <MeletiFileTypeIcon $bg={typeStyle.bg}>{typeStyle.label}</MeletiFileTypeIcon>
                                          <div style={{ minWidth: 0 }}>
                                            <MeletiFileListName title={ff.name}>{ff.name}</MeletiFileListName>
                                            {ff.size ? (
                                              <MeletiFileListMeta>{formatMeletiBytes(ff.size)}</MeletiFileListMeta>
                                            ) : null}
                                          </div>
                                        </MeletiFileInfo>
                                        <FileActions onClick={(e) => e.stopPropagation()}>
                                          <MeletiViewIconBtn
                                            type="button"
                                            title="Προβολή"
                                            onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: draft.id, groupId: group.id, fileName: ff.name, folderId: entry.id, actingUsername: loggedInUsername })}
                                          >
                                            👁
                                          </MeletiViewIconBtn>
                                          <MeletiDownloadIconBtn
                                            type="button"
                                            title="Λήψη"
                                            onClick={() => handleDownloadFile(group.id, ff.name, entry.id)}
                                          >
                                            ⬇
                                          </MeletiDownloadIconBtn>
                                        </FileActions>
                                      </MeletiNestedFileItem>
                                    );
                                  })}
                                </MeletiNestedFilesTree>
                              )}
                            </div>
                          );
                        }
                        const typeStyle = getMeletiFileTypeStyle(entry.name);
                        return (
                          <MeletiFileItem key={entry.name}>
                            <MeletiFileInfo>
                              <MeletiFileTypeIcon $bg={typeStyle.bg}>{typeStyle.label}</MeletiFileTypeIcon>
                              <div style={{ minWidth: 0 }}>
                                <MeletiFileListName title={entry.name}>{entry.name}</MeletiFileListName>
                                {entry.size ? (
                                  <MeletiFileListMeta>{formatMeletiBytes(entry.size)}</MeletiFileListMeta>
                                ) : null}
                              </div>
                            </MeletiFileInfo>
                            <FileActions>
                              <MeletiViewIconBtn
                                type="button"
                                title="Προβολή"
                                onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: draft.id, groupId: group.id, fileName: entry.name, actingUsername: loggedInUsername })}
                              >
                                👁
                              </MeletiViewIconBtn>
                              <MeletiDownloadIconBtn
                                type="button"
                                title="Λήψη"
                                onClick={() => handleDownloadFile(group.id, entry.name)}
                              >
                                ⬇
                              </MeletiDownloadIconBtn>
                            </FileActions>
                          </MeletiFileItem>
                        );
                      })}
                    </MeletiFilesList>
                  )}
                </MeletiGroupFilesArea>
              )}
            </MeletiGroupCard>
          );
        })}
      </MeletiGroupsList>
    );
  };

  const renderHubListRow = (m) => {
    const fileCount = countMeletiFiles(m);
    const linkLine = m.linkedSubprojectTitle
      ? `${m.linkedProjectTitle ? `${m.linkedProjectTitle} · ` : ''}${m.linkedSubprojectTitle}`
      : '—';
    return (
      <HubListRow key={m.id}>
        <HubListTitleCell type="button" onClick={() => openMeletiFromHub(m.id)}>
          <HubListTitle>{m.studyNumber ? `${m.studyNumber} · ${m.title || '(Χωρίς τίτλο)'}` : (m.title || '(Χωρίς τίτλο)')}</HubListTitle>
          {m.category ? <HubListSub>{m.category}</HubListSub> : null}
        </HubListTitleCell>
        <HubListCell>{m.category || '—'}</HubListCell>
        <HubListCell title={m.assignedTo || ''}>{m.assignedTo || '—'}</HubListCell>
        <HubListCell title={linkLine}>{linkLine}</HubListCell>
        <HubListCell>{fileCount}</HubListCell>
        <HubListCell>{formatShortDateEl(m.updatedAt || m.createdAt)}</HubListCell>
        <HubRowActions>
          <HubRowBtn
            type="button"
            disabled={isReadOnly || studyExportingId === m.id}
            onClick={(e) => { e.stopPropagation(); void handleExportStudy(m.id); }}
            title={isReadOnly ? 'Δεν έχετε δικαίωμα εξαγωγής' : 'Εξαγωγή αναφοράς μελέτης (PDF)'}
          >
            {studyExportingId === m.id ? '⏳' : '📄'}
          </HubRowBtn>
          <HubRowBtn type="button" $primary onClick={() => openMeletiFromHub(m.id)}>Άνοιγμα</HubRowBtn>
        </HubRowActions>
      </HubListRow>
    );
  };

  return (
    <Overlay onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      if (selectedId) return;
      void handleCloseRequest();
    }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <MainModalHeader $formal>
          <HeaderTitleWrap>
            <HeaderIcon>📋</HeaderIcon>
            <HeaderText>
              <HeaderH>Μητρώο Μελετών</HeaderH>
              <HeaderSub>
                {selectedId
                  ? 'Προβολή μελέτης — επιστρέψτε στη λίστα για κλείσιμο του μητρώου'
                  : (meletai.length > 0
                    ? `${formatMeletiCount(meletai.length)} · Βάση Δεδομένων Μελετών`
                    : 'Καταχώρηση και διαχείριση μελετών έργων')}
              </HeaderSub>
            </HeaderText>
          </HeaderTitleWrap>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', zIndex: 1 }}>
            {isReadOnly && (
              <ReadOnlyBadge>👁 Προβολή μόνο</ReadOnlyBadge>
            )}
            {!selectedId && !isReadOnly && (
              <HeaderPrimaryBtn type="button" onClick={openNewMeletiModal} disabled={creatingMeleti}>
                ＋ Νέα μελέτη
              </HeaderPrimaryBtn>
            )}
            {!selectedId && (
              <CloseBtn onClick={() => void handleCloseRequest()} title="Κλείσιμο">✕</CloseBtn>
            )}
          </div>
        </MainModalHeader>

        <Body>
          <HubShell $dimmed={!!selectedId}>
              <HubControlsPanel>
                <HubToolbarCard>
                  <HubSearch
                    placeholder="Αναζήτηση αριθμού, τίτλου, χρεωμένου, υποέργου…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <HubFiltersToggleBtn
                    type="button"
                    $active={showHubFiltersPanel || hubHasSecondaryFilters}
                    onClick={() => setShowHubFiltersPanel((v) => !v)}
                  >
                    ⚙ Φίλτρα & ταξινόμηση
                    {hubHasSecondaryFilters ? ' ●' : ''}
                  </HubFiltersToggleBtn>
                  {!isReadOnly && (
                    <>
                  <HubStatsBtn
                    type="button"
                    disabled={hubReportExporting || !filteredList.length}
                    onClick={() => handleExport('excel')}
                    title="Εξαγωγή λίστας σε Excel"
                  >
                    {hubReportExporting ? '⏳ …' : '📗 Excel'}
                  </HubStatsBtn>
                  <HubStatsBtn
                    type="button"
                    disabled={hubReportExporting || !filteredList.length}
                    onClick={() => handleExport('pdf')}
                    title="Εξαγωγή λίστας σε PDF"
                  >
                    {hubReportExporting ? '⏳ …' : '📕 PDF'}
                  </HubStatsBtn>
                    </>
                  )}
                  {hubHasActiveFilters && (
                    <HubClearFiltersBtn type="button" onClick={clearHubFilters}>
                      ✕ Καθαρισμός
                    </HubClearFiltersBtn>
                  )}
                </HubToolbarCard>

                {showHubFiltersPanel && (
                  <HubFiltersPanel>
                    <HubFilterSelect
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      title="Φίλτρο κατηγορίας"
                    >
                      <option value="">Όλες οι κατηγορίες</option>
                      {studyCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </HubFilterSelect>
                    <HubFilterSelect
                      value={linkFilter}
                      onChange={(e) => setLinkFilter(e.target.value)}
                      title="Φίλτρο σύνδεσης"
                    >
                      <option value="all">Όλες οι συνδέσεις</option>
                      <option value="linked">Με σύνδεση υποέργου</option>
                      <option value="unlinked">Χωρίς σύνδεση</option>
                    </HubFilterSelect>
                    <HubFilterSelect
                      value={hubSortBy}
                      onChange={(e) => setHubSortBy(e.target.value)}
                      title="Ταξινόμηση"
                    >
                      {HUB_SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </HubFilterSelect>
                  </HubFiltersPanel>
                )}

                {!loading && meletai.length > 0 && (
                  <>
                    <HubSummaryBar>
                      <HubStatHighlight $color={C.emeraldDark} $bg={C.emeraldLight}>
                        <strong>{hubStats.total}</strong> {hubStats.total === 1 ? 'μελέτη' : 'μελέτες'}
                      </HubStatHighlight>
                      <HubStatHighlight $color={C.teal} $bg={C.tealLight}>
                        {hubStats.linked} με σύνδεση
                      </HubStatHighlight>
                      <HubStatHighlight $color="#b45309" $bg="#fffbeb">
                        {hubStats.unlinked} χωρίς σύνδεση
                      </HubStatHighlight>
                      <HubStatHighlight $color={C.emerald} $bg="#f0fdf4">
                        {hubStats.withFiles} με αρχεία
                      </HubStatHighlight>
                      {filteredList.length !== meletai.length && (
                        <>
                          <HubSummarySep>·</HubSummarySep>
                          <span>Εμφάνιση <strong>{filteredList.length}</strong></span>
                        </>
                      )}
                    </HubSummaryBar>
                    <HubQuickFilters>
                      {[
                        { value: '', label: 'Όλα' },
                        { value: 'linked', label: 'Με σύνδεση' },
                        { value: 'unlinked', label: 'Χωρίς σύνδεση' },
                        { value: 'with_files', label: 'Με αρχεία' },
                        { value: 'without_files', label: 'Χωρίς αρχεία' },
                      ].map((pill) => (
                        <HubQuickFilterPill
                          key={pill.value || 'all'}
                          type="button"
                          $active={hubQuickFilter === pill.value}
                          onClick={() => applyHubQuickFilter(pill.value)}
                        >
                          {pill.label}
                        </HubQuickFilterPill>
                      ))}
                    </HubQuickFilters>
                  </>
                )}
              </HubControlsPanel>

              {loading ? (
                <HubSkeletonList>
                  {[1, 2, 3].map((i) => (
                    <HubSkeletonRow key={i} />
                  ))}
                </HubSkeletonList>
              ) : filteredList.length === 0 ? (
                <HubEmpty>
                  <span style={{ fontSize: '2rem' }}>📐</span>
                  {visibleMeletai.length === 0
                    ? (meletai.length > 0 && userRole === 'ENGINEER'
                      ? 'Δεν εμφανίζονται μελέτες για τα υποέργα της χρέωσής σας'
                      : 'Δεν υπάρχουν καταχωρημένες μελέτες')
                    : 'Κανένα αποτέλεσμα με τα τρέχοντα φίλτρα'}
                  {!isReadOnly && visibleMeletai.length === 0 && meletai.length === 0 && (
                    <HeaderPrimaryBtn type="button" onClick={openNewMeletiModal} style={{ marginTop: '0.75rem' }}>
                      ＋ Καταχώρηση πρώτης μελέτης
                    </HeaderPrimaryBtn>
                  )}
                </HubEmpty>
              ) : (
                <HubListWrap>
                  <HubListHead>
                    <span>Αριθμός / Τίτλος</span>
                    <span>Κατηγορία</span>
                    <span>Χρεωμένη σε</span>
                    <span>Σύνδεση</span>
                    <span>Αρχ.</span>
                    <span>Ενημέρωση</span>
                    <span />
                  </HubListHead>
                  {filteredList.map((m) => renderHubListRow(m))}
                </HubListWrap>
              )}
            </HubShell>

          {selectedId && (
            <StudyDetailOverlay onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              void handleStudyOverlayDismiss();
            }}>
              <StudyDetailCard onClick={(e) => e.stopPropagation()}>
                {draft && (
                  <StudyDetailModalHeader>
                    <StudyDetailModalTitle>
                      {draft.studyNumber ? `Μελέτη ${draft.studyNumber}` : 'Μελέτη'}
                    </StudyDetailModalTitle>
                    <StudyDetailModalSub>{draft.title || '(Χωρίς τίτλο)'}</StudyDetailModalSub>
                  </StudyDetailModalHeader>
                )}
                <DetailShell>
              {!draft ? (
                <EmptyState>
                  <Spinner />
                  <div>Φόρτωση μελέτης…</div>
                </EmptyState>
              ) : !detailEditMode ? (
                <>
                  <DetailToolbar>
                    <BackBtn type="button" onClick={requestBackToHub}>← Επιστροφή στη λίστα</BackBtn>
                    <DetailToolbarActions>
                      {!isReadOnly && (
                      <DetailExportBtn
                        type="button"
                        disabled={studyExportingId === draft.id}
                        onClick={() => void handleExportStudy(draft.id)}
                        title="Εξαγωγή αναφοράς μελέτης (PDF)"
                      >
                        {studyExportingId === draft.id ? '⏳ PDF…' : '📄 PDF'}
                      </DetailExportBtn>
                      )}
                      {!isReadOnly && (
                        <DetailEditBtn type="button" onClick={enterDetailEditMode}>✏️ Επεξεργασία</DetailEditBtn>
                      )}
                    </DetailToolbarActions>
                  </DetailToolbar>
                  <DetailScroll ref={detailScrollRef}>
                    <DetailHero>
                      <DetailHeroTop>
                        <div>
                          {draft.studyNumber ? (
                            <DetailHeroNumber>Αρ. {draft.studyNumber}</DetailHeroNumber>
                          ) : null}
                          <DetailHeroTitle>{draft.title || '(Χωρίς τίτλο)'}</DetailHeroTitle>
                        </div>
                      </DetailHeroTop>
                      <DetailHeroPills>
                        {draft.category ? (
                          <DetailHeroPill>🏷 {draft.category}</DetailHeroPill>
                        ) : null}
                        <DetailHeroPill>📁 {countMeletiFiles(draft)} αρχεία</DetailHeroPill>
                        <DetailHeroPill>
                          {draft.linkedSubprojectId ? '🔗 Συνδεδεμένη' : '○ Χωρίς σύνδεση'}
                        </DetailHeroPill>
                      </DetailHeroPills>
                    </DetailHero>

                    <DetailInfoStrip>
                      <DetailInfoItem>
                        <DetailInfoLabel>Χρεωμένη σε</DetailInfoLabel>
                        <DetailInfoValue>{draft.assignedTo || '—'}</DetailInfoValue>
                      </DetailInfoItem>
                      <DetailInfoItem>
                        <DetailInfoLabel>Προυπολογισμός δαπάνης</DetailInfoLabel>
                        <DetailInfoValue>
                          {draft.projectExpenditureBudget
                            ? formatMeletiBudgetDisplay(draft.projectExpenditureBudget)
                            : '—'}
                        </DetailInfoValue>
                      </DetailInfoItem>
                      <DetailInfoItem>
                        <DetailInfoLabel>Ημ/νία θεώρησης</DetailInfoLabel>
                        <DetailInfoValue>
                          {draft.studyApprovalDate
                            ? formatShortDateEl(draft.studyApprovalDate)
                            : '—'}
                        </DetailInfoValue>
                      </DetailInfoItem>
                      <DetailInfoItem>
                        <DetailInfoLabel>Κατηγορία</DetailInfoLabel>
                        <DetailInfoValue>{draft.category || '—'}</DetailInfoValue>
                      </DetailInfoItem>
                      <DetailInfoItem>
                        <DetailInfoLabel>Καταχώρηση</DetailInfoLabel>
                        <DetailInfoValue>{formatShortDateEl(draft.createdAt)}</DetailInfoValue>
                      </DetailInfoItem>
                      <DetailInfoItem>
                        <DetailInfoLabel>Ενημέρωση</DetailInfoLabel>
                        <DetailInfoValue>{formatShortDateEl(draft.updatedAt)}</DetailInfoValue>
                      </DetailInfoItem>
                    </DetailInfoStrip>

                    {String(draft.notes || '').trim() ? (
                      <DetailSection>
                        <DetailSectionHead>
                          <DetailSectionIcon>📝</DetailSectionIcon>
                          <DetailSectionTitle>Σημειώσεις</DetailSectionTitle>
                        </DetailSectionHead>
                        <DetailNotesText>{draft.notes}</DetailNotesText>
                      </DetailSection>
                    ) : null}

                    <DetailSection>
                      <DetailSectionHead>
                        <DetailSectionIcon>🔗</DetailSectionIcon>
                        <DetailSectionTitle>Σύνδεση με υποέργο</DetailSectionTitle>
                      </DetailSectionHead>
                      {isLinkedSubprojectMissing && (
                        <OrphanWarning style={{ marginBottom: 10 }}>
                          ⚠ Το συνδεδεμένο υποέργο δεν υπάρχει πλέον στο σύστημα.
                        </OrphanWarning>
                      )}
                      {draft.linkedSubprojectId ? (
                        <DetailLinkPanel>
                          {draft.linkedProjectTitle ? (
                            <DetailLinkProject>{draft.linkedProjectTitle}</DetailLinkProject>
                          ) : null}
                          <DetailLinkSubproject>{draft.linkedSubprojectTitle || '—'}</DetailLinkSubproject>
                          {onNavigateToSubproject && !isLinkedSubprojectMissing && (
                            <>
                              <DetailGoSubprojectBtn
                                type="button"
                                disabled={isLinkedSubprojectNavBlocked}
                                title={isLinkedSubprojectNavBlocked
                                  ? 'Δεν έχετε πρόσβαση — δεν είστε επιβλέπων του υποέργου'
                                  : 'Μετάβαση στην κάρτα υποέργου'}
                                onClick={handleGoToLinkedSubproject}
                              >
                                {isLinkedSubprojectNavBlocked ? '🔒' : '📦'} Μετάβαση στην κάρτα υποέργου
                              </DetailGoSubprojectBtn>
                              {isLinkedSubprojectNavBlocked && (
                                <DetailEmptyHint style={{ marginTop: 8 }}>
                                  Η μετάβαση δεν είναι διαθέσιμη — δεν είστε επιβλέπων αυτού του υποέργου.
                                </DetailEmptyHint>
                              )}
                            </>
                          )}
                        </DetailLinkPanel>
                      ) : (
                        <DetailEmptyHint>Η μελέτη δεν έχει συνδεθεί με υποέργο.</DetailEmptyHint>
                      )}
                    </DetailSection>

                    <DetailSection>
                      <DetailSectionHead>
                        <DetailSectionIcon>📁</DetailSectionIcon>
                        <DetailSectionTitle>Αρχεία μελέτης</DetailSectionTitle>
                        <DetailSectionCount>{countMeletiFiles(draft)} συνολικά</DetailSectionCount>
                      </DetailSectionHead>
                      {renderPresentationFiles()}
                    </DetailSection>
                  </DetailScroll>
                </>
              ) : (
                <>
                  <DetailToolbar>
                    <BackBtn type="button" onClick={() => void cancelDetailEditMode()}>← Ακύρωση επεξεργασίας</BackBtn>
                    <DetailToolbarActions>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: C.slate500 }}>Λειτουργία επεξεργασίας</span>
                    </DetailToolbarActions>
                  </DetailToolbar>
                  <Main>
                    <>
              {!isReadOnly && (!step2Done || isDirty) && (
                <StepBanner>
                  <StepBannerTitle>Οδηγός καταχώρησης</StepBannerTitle>
                  <StepList>
                    <li className={step1Done ? 'done' : 'active'}>
                      Βήμα 1: Συμπληρώστε αριθμό (μορφή π.χ. 2/2026) και τίτλο
                    </li>
                    <li className={step2Done ? 'done' : (step1Done ? 'active' : '')}>
                      Βήμα 2: Πατήστε «Αποθήκευση» για να καταχωρηθεί η μελέτη
                    </li>
                    <li className={step3Done ? 'done' : (step2Done ? 'active' : '')}>
                      Βήμα 3: Συνδέστε υποέργο και/ή ανεβάστε αρχεία
                    </li>
                  </StepList>
                </StepBanner>
              )}
              <FormGrid>
                <Field>
                  <Label>Αριθμός Μελέτης *</Label>
                  <Input
                    value={draft.studyNumber || ''}
                    onChange={(e) => handleStudyNumberChange(e.target.value)}
                    onBlur={handleStudyNumberBlur}
                    disabled={isReadOnly}
                    $error={!!studyNumberError}
                    placeholder="π.χ. 2/2026"
                    inputMode="numeric"
                    pattern="\d{1,4}/\d{4}"
                    title="Μορφή: αριθμός/έτος (π.χ. 2/2026)"
                  />
                  {!studyNumberError && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>Μόνο ψηφία και μία κάθετος (π.χ. 2/2026)</div>
                  )}
                  {studyNumberError && <FieldError>{studyNumberError}</FieldError>}
                </Field>
                <Field>
                  <Label>Τίτλος Μελέτης *</Label>
                  <Input
                    value={draft.title || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </Field>
                <Field>
                  <Label>Χρεωμένη σε</Label>
                  <AssignedToField
                    id="meleti-detail-assigned"
                    value={draft.assignedTo || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, assignedTo: e.target.value }))}
                    engineerFullNames={engineerFullNames}
                    disabled={isReadOnly}
                    InputComponent={Input}
                  />
                </Field>
                <Field>
                  <Label>Προυπολογισμός δαπάνης έργου</Label>
                  <Input
                    value={draft.projectExpenditureBudget || ''}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      projectExpenditureBudget: filterMeletiBudgetInput(e.target.value),
                    }))}
                    placeholder="π.χ. 25.234,25€"
                    disabled={isReadOnly}
                  />
                </Field>
                <Field>
                  <Label>Ημερομηνία θεώρησης της μελέτης</Label>
                  <Input
                    type="date"
                    value={draft.studyApprovalDate || ''}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      studyApprovalDate: e.target.value,
                    }))}
                    disabled={isReadOnly}
                  />
                </Field>
                <Field>
                  <Label>Κατηγορία</Label>
                  <Select
                    value={draft.category || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    disabled={isReadOnly}
                  >
                    <option value="">— Επιλογή —</option>
                    {studyCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  {!isReadOnly && (
                    <CategoryManageRow>
                      <SmallBtn type="button" onClick={() => setShowCategoryManage((v) => !v)}>
                        {showCategoryManage ? 'Κλείσιμο' : '⚙ Διαχείριση'}
                      </SmallBtn>
                    </CategoryManageRow>
                  )}
                  {showCategoryManage && !isReadOnly && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <Input
                          value={newCategoryLabel}
                          onChange={(e) => setNewCategoryLabel(e.target.value)}
                          placeholder="Νέα κατηγορία…"
                          style={{ flex: 1 }}
                        />
                        <Btn onClick={handleAddStudyCategory}>+</Btn>
                      </div>
                      {studyCategories.map((c) => (
                        <CategoryChip key={c}>
                          {c}
                          <button type="button" onClick={() => handleRemoveStudyCategory(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>✕</button>
                        </CategoryChip>
                      ))}
                    </div>
                  )}
                </Field>
                <Field $full>
                  <Label>Σημειώσεις</Label>
                  <TextArea
                    value={draft.notes || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </Field>
              </FormGrid>

              <SectionTitle>🔗 Σύνδεση με Υποέργο</SectionTitle>
              <LinkBox>
                {isLinkedSubprojectMissing && (
                  <OrphanWarning>
                    ⚠ Το συνδεδεμένο υποέργο δεν υπάρχει πλέον. Η σύνδεση θα καθαριστεί αυτόματα στην επόμενη φόρτωση ή αποσυνδέστε τώρα.
                  </OrphanWarning>
                )}
                {draft.linkedSubprojectId ? (
                  <LinkChip>
                    📦 {draft.linkedProjectTitle ? `${draft.linkedProjectTitle} · ` : ''}{draft.linkedSubprojectTitle}
                    {!isReadOnly && (
                      <button type="button" onClick={handleUnlinkSubproject} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                    )}
                  </LinkChip>
                ) : (
                  <div style={{ fontSize: 13, color: '#64748b' }}>Δεν έχει συνδεθεί με υποέργο</div>
                )}
                {!isReadOnly && !draft.linkedSubprojectId && (
                  <LinkSearchWrap>
                    <Input
                      value={linkSearch}
                      onChange={(e) => { setLinkSearch(e.target.value); setShowLinkResults(true); }}
                      onFocus={() => setShowLinkResults(true)}
                      placeholder="Αναζήτηση υποέργου…"
                    />
                    {showLinkResults && linkSearchResults.length > 0 && (
                      <LinkResults>
                        {linkSearchResults.map((sp) => (
                          <LinkResultItem key={sp.subprojectId} type="button" onClick={() => handleLinkSubproject(sp)}>
                            <strong>{sp.subprojectTitle}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{sp.projectTitle}</div>
                          </LinkResultItem>
                        ))}
                      </LinkResults>
                    )}
                  </LinkSearchWrap>
                )}
              </LinkBox>

              <SectionTitle>
                📁 Αρχεία ({countMeletiFiles(draft)})
                {!isReadOnly && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <SmallBtn type="button" onClick={() => handleUploadFiles(null)}>+ Αρχεία</SmallBtn>
                    <SmallBtn type="button" onClick={() => handleUploadFolder(null)}>+ Φάκελος</SmallBtn>
                  </span>
                )}
              </SectionTitle>
              <FileSection>
                {!isReadOnly && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <Input
                      value={newDocGroupLabel}
                      onChange={(e) => setNewDocGroupLabel(e.target.value)}
                      placeholder="Νέα κατηγορία εγγράφων…"
                      style={{ flex: 1 }}
                    />
                    <Btn onClick={handleAddDocGroup}>Προσθήκη</Btn>
                  </div>
                )}
                {(draft.fileGroups || []).map((group) => (
                  <GroupCard key={group.id}>
                    <GroupHeader onClick={() => setExpandedGroups((p) => ({ ...p, [group.id]: !p[group.id] }))}>
                      <span>📂 {group.label} ({(group.files || []).length})</span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        {!isReadOnly && (
                          <>
                            <SmallBtn type="button" onClick={(e) => { e.stopPropagation(); handleUploadFiles(group.id); }}>Αρχεία</SmallBtn>
                            <SmallBtn type="button" onClick={(e) => { e.stopPropagation(); handleUploadFolder(group.id); }}>Φάκελος</SmallBtn>
                            <SmallBtn type="button" className="danger" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, group.label); }}>✕</SmallBtn>
                          </>
                        )}
                        <span>{expandedGroups[group.id] ? '▼' : '▶'}</span>
                      </span>
                    </GroupHeader>
                    {expandedGroups[group.id] && (
                      <GroupBody>
                        {(group.files || []).length === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>Κενή κατηγορία</div>
                        ) : (group.files || []).map((entry) => {
                          if (entry.kind === 'folder') {
                            const fKey = `${group.id}:${entry.id}`;
                            return (
                              <div key={entry.id}>
                                <FileRow>
                                  <span>📁 {entry.name} ({entry.fileCount || 0})</span>
                                  <FileActions>
                                    <SmallBtn type="button" onClick={() => toggleFolder(group.id, entry.id)}>
                                      {expandedFolders[fKey] ? 'Κλείσιμο' : 'Άνοιγμα'}
                                    </SmallBtn>
                                    {!isReadOnly && (
                                      <SmallBtn type="button" className="danger" onClick={() => handleDeleteFolder(group.id, entry.id, entry.name)}>Διαγραφή</SmallBtn>
                                    )}
                                  </FileActions>
                                </FileRow>
                                {expandedFolders[fKey] && (folderFilesCache[fKey] || []).map((ff) => (
                                  <FileRow key={ff.name} style={{ paddingLeft: 20 }}>
                                    <span>📄 {ff.name}</span>
                                    <FileActions>
                                      <SmallBtn type="button" onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: draft.id, groupId: group.id, fileName: ff.name, folderId: entry.id, actingUsername: loggedInUsername })}>Προβολή</SmallBtn>
                                      <SmallBtn type="button" onClick={() => handleDownloadFile(group.id, ff.name, entry.id)}>Λήψη</SmallBtn>
                                      {!isReadOnly && (
                                        <SmallBtn type="button" onClick={() => handleRenameFile(group.id, ff.name, entry.id)}>Μετονομασία</SmallBtn>
                                      )}
                                      {!isReadOnly && (
                                        <SmallBtn type="button" className="danger" onClick={async () => {
                                          const ok = await showConfirm({ title: 'Διαγραφή', message: `Διαγραφή «${ff.name}»;`, confirmLabel: 'Διαγραφή' });
                                          if (!ok) return;
                                          const res = await ipcRenderer.invoke('delete-meleti-folder-file', { meletiId: draft.id, groupId: group.id, folderId: entry.id, fileName: ff.name, actingUsername: loggedInUsername });
                                          if (res?.success) {
                                            applyServerMeletiToDraft(res.meleti);
                                            loadFolderFiles(group.id, entry.id);
                                          }
                                        }}>✕</SmallBtn>
                                      )}
                                    </FileActions>
                                  </FileRow>
                                ))}
                              </div>
                            );
                          }
                          return (
                            <FileRow key={entry.name}>
                              <span>📄 {entry.name}</span>
                              <FileActions>
                                <SmallBtn type="button" onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: draft.id, groupId: group.id, fileName: entry.name, actingUsername: loggedInUsername })}>Προβολή</SmallBtn>
                                <SmallBtn type="button" onClick={() => handleDownloadFile(group.id, entry.name)}>Λήψη</SmallBtn>
                                {!isReadOnly && (
                                  <>
                                    <SmallBtn type="button" onClick={() => handleRenameFile(group.id, entry.name)}>Μετονομασία</SmallBtn>
                                    <SmallBtn type="button" className="danger" onClick={() => handleDeleteFile(group.id, entry.name)}>✕</SmallBtn>
                                  </>
                                )}
                              </FileActions>
                            </FileRow>
                          );
                        })}
                      </GroupBody>
                    )}
                  </GroupCard>
                ))}
                {!(draft.fileGroups || []).length && (
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    Ανεβάστε αρχεία ή φακέλους — θα τοποθετηθούν αυτόματα στην κατηγορία «ΑΡΧΕΙΑ»
                  </div>
                )}
              </FileSection>

              <ActionRow>
                {!isReadOnly && (
                  <>
                    <Btn $primary onClick={handleSave} disabled={saving || !!studyNumberError}>
                      {saving ? 'Αποθήκευση…' : isDirty ? '💾 Αποθήκευση' : '✓ Αποθηκευμένο'}
                    </Btn>
                    <Btn $danger onClick={handleDeleteMeleti}>🗑 Διαγραφή Μελέτης</Btn>
                  </>
                )}
              </ActionRow>
                    </>
                  </Main>
                </>
              )}
            </DetailShell>
              </StudyDetailCard>
            </StudyDetailOverlay>
          )}
        </Body>
      </Modal>

      {showNewMeletiModal && newModalDraft && (
        <FolderModalOverlay onClick={() => void cancelNewMeletiModal()}>
          <WideModalCard onClick={(e) => e.stopPropagation()}>
            <NewMeletiModalHeader>
              <NewMeletiModalTitle>＋ Νέα Μελέτη</NewMeletiModalTitle>
              <NewMeletiModalSub>
                Συμπληρώστε τα βασικά στοιχεία και πατήστε «Αποθήκευση βασικών» — μετά ξεκλειδώνουν η σύνδεση υποέργου και τα αρχεία.
              </NewMeletiModalSub>
            </NewMeletiModalHeader>
            <WideModalBody>
              <ModalFormSection>
                <ModalFormSectionHead>
                  <ModalFormSectionIcon>📐</ModalFormSectionIcon>
                  <ModalFormSectionTitle>Στοιχεία μελέτης</ModalFormSectionTitle>
                </ModalFormSectionHead>
                <ModalFormGrid>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-meleti-number">Αριθμός μελέτης *</ModalFormLabel>
                    <ModalFormInput
                      id="new-meleti-number"
                      placeholder="π.χ. 2/2026"
                      value={newModalDraft.studyNumber || ''}
                      onChange={(e) => {
                        const filtered = filterStudyNumberInput(e.target.value);
                        setNewModalDraft((d) => ({ ...d, studyNumber: filtered }));
                        if (numberCheckTimerRef.current) clearTimeout(numberCheckTimerRef.current);
                        numberCheckTimerRef.current = setTimeout(() => {
                          checkNewMeletiNumber(filtered, newModalDraft.id);
                        }, 400);
                      }}
                      onBlur={() => checkNewMeletiNumber(newModalDraft.studyNumber, newModalDraft.id)}
                      $error={!!newMeletiNumberError}
                      inputMode="numeric"
                      disabled={isReadOnly}
                    />
                    {newMeletiNumberError && (
                      <FieldError>{newMeletiNumberError}</FieldError>
                    )}
                    {!newMeletiNumberError && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>Μορφή: αριθμός/έτος (π.χ. 2/2026)</div>
                    )}
                  </ModalFormField>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-meleti-category">Κατηγορία</ModalFormLabel>
                    <ModalFormSelect
                      id="new-meleti-category"
                      value={newModalDraft.category || ''}
                      onChange={(e) => setNewModalDraft((d) => ({ ...d, category: e.target.value }))}
                      disabled={isReadOnly}
                    >
                      <option value="">— Επιλογή —</option>
                      {studyCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </ModalFormSelect>
                  </ModalFormField>
                  <ModalFormFieldFull>
                    <ModalFormLabel htmlFor="new-meleti-title">Τίτλος μελέτης *</ModalFormLabel>
                    <ModalFormInput
                      id="new-meleti-title"
                      placeholder="π.χ. Μελέτη βιωσιμότητας…"
                      value={newModalDraft.title || ''}
                      onChange={(e) => setNewModalDraft((d) => ({ ...d, title: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </ModalFormFieldFull>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-meleti-assigned">Χρεωμένη σε</ModalFormLabel>
                    <AssignedToField
                      id="new-meleti-assigned"
                      value={newModalDraft.assignedTo || ''}
                      onChange={(e) => setNewModalDraft((d) => ({ ...d, assignedTo: e.target.value }))}
                      engineerFullNames={engineerFullNames}
                      disabled={isReadOnly}
                      InputComponent={ModalFormInput}
                    />
                  </ModalFormField>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-meleti-budget">Προυπολογισμός δαπάνης έργου</ModalFormLabel>
                    <ModalFormInput
                      id="new-meleti-budget"
                      placeholder="π.χ. 25.234,25€"
                      value={newModalDraft.projectExpenditureBudget || ''}
                      onChange={(e) => setNewModalDraft((d) => ({
                        ...d,
                        projectExpenditureBudget: filterMeletiBudgetInput(e.target.value),
                      }))}
                      disabled={isReadOnly}
                    />
                  </ModalFormField>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-meleti-approval-date">Ημερομηνία θεώρησης της μελέτης</ModalFormLabel>
                    <ModalFormInput
                      id="new-meleti-approval-date"
                      type="date"
                      value={newModalDraft.studyApprovalDate || ''}
                      onChange={(e) => setNewModalDraft((d) => ({
                        ...d,
                        studyApprovalDate: e.target.value,
                      }))}
                      disabled={isReadOnly}
                    />
                  </ModalFormField>
                  <ModalFormFieldFull>
                    <ModalFormLabel htmlFor="new-meleti-notes">Σημειώσεις</ModalFormLabel>
                    <ModalFormTextArea
                      id="new-meleti-notes"
                      placeholder="Προαιρετικές σημειώσεις…"
                      value={newModalDraft.notes || ''}
                      onChange={(e) => setNewModalDraft((d) => ({ ...d, notes: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </ModalFormFieldFull>
                </ModalFormGrid>
                {!isReadOnly && (
                  <ModalBasicsSaveRow>
                    {newModalBasicsSaved && !newModalBasicsDirty ? (
                      <ModalBasicsSavedBadge>✓ Αποθηκεύτηκαν τα βασικά στοιχεία</ModalBasicsSavedBadge>
                    ) : (
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        {newModalBasicsSaved ? 'Έχετε μη αποθηκευμένες αλλαγές στα βασικά στοιχεία' : 'Αποθηκεύστε τα βασικά στοιχεία για να συνεχίσετε'}
                      </span>
                    )}
                    <Btn
                      $primary
                      type="button"
                      onClick={() => void saveNewModalBasics()}
                      disabled={creatingMeleti || !!newMeletiNumberError}
                    >
                      {creatingMeleti ? 'Αποθήκευση…' : newModalBasicsSaved && newModalBasicsDirty ? '💾 Ενημέρωση βασικών' : '💾 Αποθήκευση βασικών'}
                    </Btn>
                  </ModalBasicsSaveRow>
                )}
              </ModalFormSection>

              <ModalLockedWrap>
                {!newModalBasicsSaved && (
                  <ModalLockNotice>
                    🔒 {NEW_MODAL_UNLOCK_HINT}
                  </ModalLockNotice>
                )}

                <ModalSubSection $locked={!newModalBasicsSaved}>
                  <ModalFormSectionHead>
                    <ModalFormSectionIcon>🔗</ModalFormSectionIcon>
                    <ModalFormSectionTitle>Σύνδεση με υποέργο</ModalFormSectionTitle>
                  </ModalFormSectionHead>
                  <LinkBox>
                    {newModalDraft.linkedSubprojectId ? (
                      <LinkChip>
                        📦 {newModalDraft.linkedProjectTitle ? `${newModalDraft.linkedProjectTitle} · ` : ''}{newModalDraft.linkedSubprojectTitle}
                        {!isReadOnly && (
                          <button type="button" onClick={() => void handleNewModalUnlinkSubproject()} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                        )}
                      </LinkChip>
                    ) : (
                      <div style={{ fontSize: 13, color: '#64748b' }}>Δεν έχει συνδεθεί με υποέργο</div>
                    )}
                    {!isReadOnly && !newModalDraft.linkedSubprojectId && (
                      <LinkSearchWrap>
                        <ModalFormInput
                          value={newModalLinkSearch}
                          onChange={(e) => { setNewModalLinkSearch(e.target.value); setNewModalShowLinkResults(true); }}
                          onFocus={() => setNewModalShowLinkResults(true)}
                          placeholder="Αναζήτηση υποέργου…"
                        />
                        {newModalShowLinkResults && newModalLinkSearchResults.length > 0 && (
                          <LinkResults>
                            {newModalLinkSearchResults.map((sp) => (
                              <LinkResultItem key={sp.subprojectId} type="button" onClick={() => void handleNewModalLinkSubproject(sp)}>
                                <strong>{sp.subprojectTitle}</strong>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{sp.projectTitle}</div>
                              </LinkResultItem>
                            ))}
                          </LinkResults>
                        )}
                      </LinkSearchWrap>
                    )}
                  </LinkBox>
                </ModalSubSection>

                <ModalSubSection $locked={!newModalBasicsSaved}>
                  <ModalFormSectionHead>
                    <ModalFormSectionIcon>📁</ModalFormSectionIcon>
                    <ModalFormSectionTitle>
                      Αρχεία ({countMeletiFiles(newModalDraft)})
                    </ModalFormSectionTitle>
                    {!isReadOnly && (
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <SmallBtn type="button" onClick={() => void handleNewModalUploadFiles(null)}>+ Αρχεία</SmallBtn>
                        <SmallBtn type="button" onClick={() => void handleNewModalUploadFolder(null)}>+ Φάκελος</SmallBtn>
                      </span>
                    )}
                  </ModalFormSectionHead>
                  <FileSection>
                    {!isReadOnly && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <ModalFormInput
                          value={newModalDocGroupLabel}
                          onChange={(e) => setNewModalDocGroupLabel(e.target.value)}
                          placeholder="Νέα κατηγορία εγγράφων…"
                          style={{ flex: 1 }}
                        />
                        <Btn type="button" onClick={() => void handleNewModalAddDocGroup()}>Προσθήκη</Btn>
                      </div>
                    )}
                    {(newModalDraft.fileGroups || []).map((group) => (
                      <GroupCard key={group.id}>
                        <GroupHeader onClick={() => setNewModalExpandedGroups((p) => ({ ...p, [group.id]: !p[group.id] }))}>
                          <span>📂 {group.label} ({(group.files || []).length})</span>
                          <span style={{ display: 'flex', gap: 4 }}>
                            {!isReadOnly && (
                              <>
                                <SmallBtn type="button" onClick={(e) => { e.stopPropagation(); void handleNewModalUploadFiles(group.id); }}>Αρχεία</SmallBtn>
                                <SmallBtn type="button" onClick={(e) => { e.stopPropagation(); void handleNewModalUploadFolder(group.id); }}>Φάκελος</SmallBtn>
                                <SmallBtn type="button" className="danger" onClick={(e) => { e.stopPropagation(); void handleNewModalDeleteGroup(group.id, group.label); }}>✕</SmallBtn>
                              </>
                            )}
                            <span>{newModalExpandedGroups[group.id] ? '▼' : '▶'}</span>
                          </span>
                        </GroupHeader>
                        {newModalExpandedGroups[group.id] && (
                          <GroupBody>
                            {(group.files || []).length === 0 ? (
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>Κενή κατηγορία</div>
                            ) : (group.files || []).map((entry) => {
                              if (entry.kind === 'folder') {
                                const fKey = `${group.id}:${entry.id}`;
                                return (
                                  <div key={entry.id}>
                                    <FileRow>
                                      <span>📁 {entry.name} ({entry.fileCount || 0})</span>
                                      <FileActions>
                                        <SmallBtn type="button" onClick={() => newModalToggleFolder(group.id, entry.id)}>
                                          {newModalExpandedFolders[fKey] ? 'Κλείσιμο' : 'Άνοιγμα'}
                                        </SmallBtn>
                                        {!isReadOnly && (
                                          <SmallBtn type="button" className="danger" onClick={() => void handleNewModalDeleteFolder(group.id, entry.id, entry.name)}>✕</SmallBtn>
                                        )}
                                      </FileActions>
                                    </FileRow>
                                    {newModalExpandedFolders[fKey] && (newModalFolderFilesCache[fKey] || []).map((ff) => (
                                      <FileRow key={ff.name} style={{ paddingLeft: 20 }}>
                                        <span>📄 {ff.name}</span>
                                        <FileActions>
                                          <SmallBtn type="button" onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: newModalDraft.id, groupId: group.id, fileName: ff.name, folderId: entry.id, actingUsername: loggedInUsername })}>Προβολή</SmallBtn>
                                          <SmallBtn type="button" onClick={() => void handleNewModalDownloadFile(group.id, ff.name, entry.id)}>Λήψη</SmallBtn>
                                          {!isReadOnly && (
                                            <SmallBtn type="button" onClick={() => handleNewModalRenameFile(group.id, ff.name, entry.id)}>Μετονομασία</SmallBtn>
                                          )}
                                          {!isReadOnly && (
                                            <SmallBtn type="button" className="danger" onClick={async () => {
                                              const ok = await showConfirm({ title: 'Διαγραφή', message: `Διαγραφή «${ff.name}»;`, confirmLabel: 'Διαγραφή' });
                                              if (!ok) return;
                                              const res = await ipcRenderer.invoke('delete-meleti-folder-file', { meletiId: newModalDraft.id, groupId: group.id, folderId: entry.id, fileName: ff.name, actingUsername: loggedInUsername });
                                              if (res?.success) {
                                                applyModalMeletiUpdate(res.meleti);
                                                newModalLoadFolderFiles(group.id, entry.id);
                                              }
                                            }}>✕</SmallBtn>
                                          )}
                                        </FileActions>
                                      </FileRow>
                                    ))}
                                  </div>
                                );
                              }
                              return (
                                <FileRow key={entry.name}>
                                  <span>📄 {entry.name}</span>
                                  <FileActions>
                                    <SmallBtn type="button" onClick={() => ipcRenderer.invoke('open-meleti-file', { meletiId: newModalDraft.id, groupId: group.id, fileName: entry.name, actingUsername: loggedInUsername })}>Προβολή</SmallBtn>
                                    <SmallBtn type="button" onClick={() => void handleNewModalDownloadFile(group.id, entry.name)}>Λήψη</SmallBtn>
                                    {!isReadOnly && (
                                      <>
                                        <SmallBtn type="button" onClick={() => handleNewModalRenameFile(group.id, entry.name)}>Μετονομασία</SmallBtn>
                                        <SmallBtn type="button" className="danger" onClick={() => void handleNewModalDeleteFile(group.id, entry.name)}>✕</SmallBtn>
                                      </>
                                    )}
                                  </FileActions>
                                </FileRow>
                              );
                            })}
                          </GroupBody>
                        )}
                      </GroupCard>
                    ))}
                    {!(newModalDraft.fileGroups || []).length && (
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>
                        Ανεβάστε αρχεία ή φακέλους — θα τοποθετηθούν αυτόματα στην κατηγορία «ΑΡΧΕΙΑ»
                      </div>
                    )}
                  </FileSection>
                </ModalSubSection>
              </ModalLockedWrap>
            </WideModalBody>
            <WideModalFooter>
              <Btn type="button" onClick={() => void cancelNewMeletiModal()} disabled={creatingMeleti}>Ακύρωση</Btn>
              {newModalBasicsSaved && (
                <Btn type="button" onClick={openNewModalInDetail} disabled={creatingMeleti || !!newModalBasicsDirty}>
                  📂 Άνοιγμα μελέτης
                </Btn>
              )}
              <Btn $primary type="button" onClick={finishNewMeletiModal} disabled={creatingMeleti || !newModalBasicsSaved || !!newModalBasicsDirty}>
                Ολοκλήρωση
              </Btn>
            </WideModalFooter>
          </WideModalCard>
        </FolderModalOverlay>
      )}

      {exportSuccess && (
        <ExportSuccessModal
          isOpen
          filePath={exportSuccess.filePath}
          actionCount={exportSuccess.actionCount}
          sheetCount={exportSuccess.sheetCount}
          exportedAt={exportSuccess.exportedAt}
          actionLabel={exportSuccess.isStudyReport ? 'Μελέτη' : 'Μελέτες'}
          sheetLabel={
            exportSuccess.isStudyReport
              ? 'Αρχεία'
              : (exportSuccess.pdfFallback || exportSuccess.format === 'pdf' || exportSuccess.format === 'html'
                ? 'Σελίδες'
                : 'Φύλλα')
          }
          title="Η εξαγωγή ολοκληρώθηκε"
          subtitle={
            exportSuccess.pdfFallback
              ? (exportSuccess.message || 'Δημιουργήθηκε αρχείο HTML — ανοίξτε το και εκτυπώστε σε PDF.')
              : exportSuccess.isStudyReport
                ? `${exportSuccess.rowCount || 0} αρχεία · PDF`
                : `${exportSuccess.rowCount || 0} μελέτες · ${exportSuccess.format === 'pdf' ? 'PDF' : 'Excel'}`
          }
          onClose={() => setExportSuccess(null)}
        />
      )}

      {unsavedNavModal && (
        <ModalOverlay onClick={() => completeUnsavedNavigation('cancel')}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <h3>💾 Μη αποθηκευμένες αλλαγές</h3>
              <p>Έχετε αλλαγές που δεν έχουν αποθηκευτεί. Να τις αποθηκεύσετε πριν συνεχίσετε;</p>
            </DialogHeader>
            <DialogFooter>
              <Btn onClick={() => completeUnsavedNavigation('cancel')}>Ακύρωση</Btn>
              <Btn $danger onClick={() => completeUnsavedNavigation('discard')}>Απόρριψη</Btn>
              <Btn $primary onClick={() => completeUnsavedNavigation('save')}>Αποθήκευση</Btn>
            </DialogFooter>
          </ModalCard>
        </ModalOverlay>
      )}

      {renameModal && (
        <ModalOverlay onClick={() => setRenameModal(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <h3>Μετονομασία αρχείου</h3>
              <p>Νέο όνομα για «{renameModal.oldName}»</p>
            </DialogHeader>
            <div style={{ padding: '0 20px 12px' }}>
              <Input
                value={renameModal.newName}
                onChange={(e) => setRenameModal((m) => ({ ...m, newName: e.target.value }))}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Btn onClick={() => setRenameModal(null)}>Ακύρωση</Btn>
              <Btn $primary onClick={confirmRenameFile}>OK</Btn>
            </DialogFooter>
          </ModalCard>
        </ModalOverlay>
      )}
    </Overlay>
  );
}

export default MeletaiManager;
