import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';

/* ─── Tokens ─────────────────────────────────────────────────────────────── */
const C = {
  indigo:      '#6366f1',
  indigoDark:  '#4f46e5',
  indigoLight: '#eef2ff',
  violet:      '#7c3aed',
  teal:        '#0d9488',
  tealLight:   '#f0fdfa',
  emerald:     '#10b981',
  amber:       '#f59e0b',
  rose:        '#f43f5e',
  slate900:    '#0f172a',
  slate800:    '#1e293b',
  slate700:    '#334155',
  slate600:    '#475569',
  slate500:    '#64748b',
  slate400:    '#94a3b8',
  slate300:    '#cbd5e1',
  slate200:    '#e2e8f0',
  slate100:    '#f1f5f9',
  slate50:     '#f8fafc',
  white:       '#ffffff',
};

const PROPOSAL_STATUSES = [
  { value: 'draft',       label: 'Προσχέδιο',        color: C.slate400,  bg: C.slate100 },
  { value: 'maturing',   label: 'Υπό ωρίμανση',      color: C.amber,     bg: '#fffbeb' },
  { value: 'ready',      label: 'Έτοιμη προς υποβολή', color: C.teal,   bg: C.tealLight },
  { value: 'submitted',  label: 'Υποβλήθηκε',         color: C.indigo,   bg: C.indigoLight },
  { value: 'approved',   label: 'Εγκρίθηκε',          color: C.emerald,  bg: '#f0fdf4' },
  { value: 'rejected',   label: 'Απορρίφθηκε',        color: C.rose,     bg: '#fff1f2' },
];

const PRESET_GROUPS = [
  { label: 'Αδειοδοτήσεις', icon: '📋' },
  { label: 'Μελέτες', icon: '📐' },
  { label: 'Τοπογραφικά', icon: '🗺️' },
  { label: 'Γεωτεχνικά', icon: '🪨' },
  { label: 'Αρχαιολογία', icon: '🏛️' },
  { label: 'Περιβαλλοντικά', icon: '🌿' },
  { label: 'Στατικά', icon: '🏗️' },
  { label: 'Η/Μ Μελέτες', icon: '⚡' },
  { label: 'Κτηματολόγιο', icon: '📌' },
  { label: 'Τεύχη Δημοπράτησης', icon: '📄' },
  { label: 'Φωτογραφίες', icon: '📷' },
  { label: 'Διάφορα', icon: '📁' },
];

function getStatusStyle(value) {
  return PROPOSAL_STATUSES.find((s) => s.value === value) || PROPOSAL_STATUSES[0];
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileTypeStyle(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext))
    return { label: 'PDF', bg: `linear-gradient(135deg, ${C.indigo}, ${C.violet})` };
  if (['doc', 'docx'].includes(ext))
    return { label: 'DOC', bg: 'linear-gradient(135deg, #2563eb, #3b82f6)' };
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return { label: 'XLS', bg: 'linear-gradient(135deg, #059669, #10b981)' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return { label: 'IMG', bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return { label: 'ZIP', bg: 'linear-gradient(135deg, #6b7280, #9ca3af)' };
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', bg: `linear-gradient(135deg, ${C.slate600}, ${C.slate500})` };
}

const FOLDER_TYPE_STYLE = { label: '📁', bg: 'linear-gradient(135deg, #f59e0b, #d97706)' };

function isProposalFolder(entry) {
  return entry?.kind === 'folder';
}

function getProposalEntryKey(entry) {
  return isProposalFolder(entry) ? entry.id : entry.name;
}

function emptyProposal() {
  return {
    id: uuidv4(),
    title: '',
    description: '',
    status: 'draft',
    targetProgram: '',
    estimatedBudget: '',
    notes: '',
    pendingItems: [],
    fileGroups: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function hasProposalNotes(notes) {
  return String(notes || '').trim().length > 0;
}

function groupLabelExists(groups, label) {
  const normalized = String(label || '').trim().toLowerCase();
  if (!normalized) return false;
  return (groups || []).some((g) => String(g.label || '').trim().toLowerCase() === normalized);
}

/* ─── Animations ─────────────────────────────────────────────────────────── */
const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)     scale(1); }
`;
const fadeIn = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
`;
const pulse = keyframes`
  0%, 100% { opacity: 1; } 50% { opacity: 0.5; }
`;

/* ─── Styled components ─────────────────────────────────────────────────── */
const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: stretch;
  z-index: 9998;
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
  box-shadow: 0 24px 80px rgba(99, 102, 241, 0.18), 0 4px 20px rgba(0,0,0,0.1);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, ${C.teal} 0%, ${C.indigo} 60%, ${C.violet} 100%);
  padding: 1.35rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: -40%; right: -5%;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
    pointer-events: none;
  }
`;

const HeaderTitle = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  z-index: 1;
`;
const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255,255,255,0.18);
  width: 46px; height: 46px;
  border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.2);
`;
const HeaderText = styled.div``;
const HeaderH = styled.h2`
  color: white; margin: 0;
  font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em;
`;
const HeaderSub = styled.div`
  color: rgba(255,255,255,0.75); font-size: 0.72rem; font-weight: 600; margin-top: 0.1rem;
`;
const CloseBtn = styled.button`
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  width: 36px; height: 36px; border-radius: 10px;
  font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  z-index: 1;
  &:hover { background: rgba(255,255,255,0.22); color: white; }
`;

const HeaderActionBtn = styled.button`
  color: white;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.28);
  padding: 0.42rem 0.85rem;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  transition: all 0.2s;
  z-index: 1;
  &:hover:not(:disabled) { background: rgba(255,255,255,0.28); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

/* ── Sidebar ── */
const Sidebar = styled.div`
  border-right: 1px solid ${C.slate200};
  display: flex; flex-direction: column;
  background: ${C.slate50};
  overflow: hidden;
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  flex-shrink: 0;
`;
const SidebarHeader = styled.div`
  padding: 1rem 1rem 0.6rem;
  border-bottom: 1px solid ${C.slate200};
  flex-shrink: 0;
  min-width: 0;
  box-sizing: border-box;
`;
const SidebarSearch = styled.input`
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 9px;
  background: white;
  font-size: 0.8rem;
  color: ${C.slate700};
  outline: none;
  margin-bottom: 0.55rem;
  box-sizing: border-box;
  &:focus { border-color: ${C.indigo}; box-shadow: 0 0 0 3px ${C.indigoLight}; }
`;
const AddProposalBtn = styled.button`
  width: 100%;
  padding: 0.6rem 0.7rem;
  background: linear-gradient(135deg, ${C.teal}, ${C.indigo});
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.8rem; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: all 0.2s;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(13, 148, 136, 0.3); }
  &:disabled {
    opacity: 0.65; cursor: default; transform: none;
    box-shadow: none;
  }
`;
const SidebarList = styled.div`
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 0.5rem;
  min-width: 0;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: ${C.slate300}; border-radius: 99px; }
`;
const ProposalItem = styled.button`
  width: 100%; text-align: left;
  padding: 0.7rem 0.75rem;
  border-radius: 12px;
  border: 1px solid ${(p) => p.$active ? C.indigo : 'transparent'};
  background: ${(p) => p.$active ? C.indigoLight : 'transparent'};
  cursor: pointer; margin-bottom: 0.35rem;
  transition: all 0.18s;
  animation: ${fadeIn} 0.3s ease;
  &:hover { background: ${(p) => p.$active ? C.indigoLight : C.slate100}; }
`;
const ProposalItemTitle = styled.div`
  font-size: 0.8rem; font-weight: 700;
  color: ${(p) => p.$active ? C.indigoDark : C.slate800};
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.35;
  margin-bottom: 0.25rem;
`;
const ProposalItemMeta = styled.div`
  display: flex; align-items: center; gap: 0.4rem;
  min-width: 0;
`;
const ProposalItemIcons = styled.div`
  margin-left: auto;
  display: flex; align-items: center; gap: 0.4rem;
  flex-shrink: 0;
`;
const ProposalItemIcon = styled.span`
  font-size: 0.64rem; font-weight: 700; color: ${C.slate500};
  white-space: nowrap;
`;
const StatusDot = styled.span`
  width: 7px; height: 7px; border-radius: 50%;
  background: ${(p) => p.$color || C.slate400};
  flex-shrink: 0;
`;
const ProposalItemSub = styled.div`
  font-size: 0.64rem; color: ${C.slate500}; font-weight: 600;
`;
const EmptyProposals = styled.div`
  text-align: center; color: ${C.slate400};
  font-size: 0.8rem; padding: 2rem 1rem;
  font-style: italic;
`;
const NewProposalForm = styled.div`
  width: min(560px, 100%);
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 16px;
  padding: 1.5rem 1.65rem;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
  box-sizing: border-box;
  animation: ${fadeIn} 0.25s ease;
`;
const CreateProposalPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 2.5rem;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  background: ${C.slate50};
`;
const NewProposalLabel = styled.label`
  display: block;
  font-size: 0.72rem; font-weight: 800; color: ${C.indigoDark};
  margin-bottom: 0.55rem; text-transform: uppercase; letter-spacing: 0.45px;
`;
const NewProposalHeading = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1.15rem; font-weight: 800; color: ${C.slate900};
  letter-spacing: -0.01em;
`;
const NewProposalHint = styled.p`
  margin: 0 0 1.15rem;
  font-size: 0.82rem; color: ${C.slate500}; line-height: 1.45;
`;
const NewProposalInput = styled.input`
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.95rem; font-weight: 700;
  color: ${C.slate800};
  background: white;
  outline: none;
  margin-bottom: 1rem;
  box-sizing: border-box;
  &:focus { border-color: ${C.indigo}; box-shadow: 0 0 0 3px ${C.indigoLight}; }
  &::placeholder { color: ${C.slate300}; font-weight: 500; }
`;
const NewProposalBtns = styled.div`
  display: flex; gap: 0.5rem; justify-content: flex-end;
  width: 100%;
`;

/* ── Main content ── */
const MainContent = styled.div`
  display: flex; flex-direction: column;
  overflow: hidden;
`;
const EmptyState = styled.div`
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: ${C.slate400}; gap: 0.75rem;
`;
const EmptyStateIcon = styled.div`font-size: 3.5rem; opacity: 0.5;`;
const EmptyStateText = styled.div`font-size: 0.88rem; font-weight: 600;`;

/* ── Proposal detail (tabs) ── */
const DetailHeader = styled.div`
  padding: 0.7rem 1.25rem 0;
  background: linear-gradient(180deg, ${C.slate50} 0%, ${C.white} 70%);
  border-bottom: 1px solid ${C.slate200};
  flex-shrink: 0;
`;
const TitleRow = styled.div`
  display: flex; align-items: flex-end; gap: 0.5rem;
  margin-bottom: 0.5rem;
  min-width: 0;
  width: 100%;
`;
const TitleInput = styled.input`
  flex: 1;
  min-width: 0;
  width: 100%;
  font-size: 1rem; font-weight: 800;
  color: ${C.slate900};
  outline: none;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  letter-spacing: -0.01em;
  &:focus {
    border-color: ${C.indigo};
    box-shadow: 0 0 0 3px ${C.indigoLight};
  }
  &::placeholder { color: ${C.slate300}; font-weight: 600; }
  &:read-only {
    background: ${C.slate50};
    border-color: transparent;
    cursor: default;
    color: ${C.slate700};
  }
`;
const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(110px, 0.75fr) minmax(140px, 1.1fr) minmax(110px, 0.75fr) minmax(160px, 1.4fr);
  gap: 0.4rem 0.55rem;
  margin-bottom: 0.5rem;
  align-items: end;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
  }
`;
const MetaField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
`;
const MetaLabel = styled.label`
  font-size: 0.58rem; font-weight: 800; color: ${C.slate400};
  text-transform: uppercase; letter-spacing: 0.55px;
  line-height: 1;
`;
/* Keep MetaRowLabel for backward compat in JSX we haven't replaced yet */
const MetaRowLabel = MetaLabel;
const metaControlStyles = css`
  width: 100%;
  padding: 0.32rem 0.55rem;
  border: 1px solid ${C.slate200};
  border-radius: 7px;
  font-size: 0.74rem;
  min-width: 0;
  box-sizing: border-box;
  transition: border-color 0.18s, box-shadow 0.18s;
  &:focus {
    border-color: ${C.indigo};
    box-shadow: 0 0 0 2px ${C.indigoLight};
    outline: none;
  }
  &::placeholder { color: ${C.slate300}; }
`;
const StatusSelect = styled.select`
  ${metaControlStyles}
  font-weight: 700;
  color: ${(p) => p.$color || C.slate600};
  background: ${(p) => p.$bg || C.white};
  cursor: pointer;
  &:disabled { opacity: 0.7; cursor: default; }
`;
const MetaInput = styled.input`
  ${metaControlStyles}
  color: ${C.slate700};
  background: ${C.white};
  &:read-only { background: ${C.slate50}; cursor: default; }
`;
const DescriptionInput = styled.input`
  ${metaControlStyles}
  color: ${C.slate700};
  background: ${C.white};
  &:read-only { background: ${C.slate50}; cursor: default; }
`;
const TabBar = styled.div`
  display: flex; gap: 0.35rem;
  padding-bottom: 0.55rem;
`;
const Tab = styled.button`
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.34rem 0.72rem;
  border: 1px solid ${(p) => {
    if (p.$active) return C.indigo;
    if (p.$hasContent) return '#fcd34d';
    return C.slate200;
  }};
  border-radius: 999px;
  background: ${(p) => {
    if (p.$active) return C.indigoLight;
    if (p.$hasContent) return '#fffbeb';
    return C.white;
  }};
  color: ${(p) => p.$active ? C.indigoDark : C.slate500};
  font-size: 0.71rem; font-weight: ${(p) => p.$active ? '700' : '600'};
  cursor: pointer; transition: all 0.18s;
  &:hover {
    color: ${C.indigoDark};
    border-color: ${C.indigo};
    background: ${(p) => p.$active ? C.indigoLight : C.slate50};
  }
`;
const TabIndicator = styled.span`
  width: 7px; height: 7px;
  border-radius: 50%;
  background: ${C.amber};
  flex-shrink: 0;
`;

const DetailBody = styled.div`
  flex: 1; overflow-y: auto; padding: 0.85rem 1.25rem 1.1rem;
  display: flex; flex-direction: column; min-height: 0;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: ${C.slate300}; border-radius: 99px; }
`;

/* ── File Groups tab layout ── */
const FilesTabLayout = styled.div`
  display: flex; flex-direction: column; flex: 1; min-height: 0;
`;
const AddGroupToolbar = styled.div`
  flex-shrink: 0;
  position: sticky; top: 0; z-index: 5;
  background: ${C.white};
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid ${C.slate200};
`;
const PresetChipsRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.28rem; align-items: center;
`;
const AddCategoryBtn = styled.button`
  width: 28px; height: 28px;
  border-radius: 999px;
  border: 1.5px dashed ${C.slate300};
  background: ${C.white};
  color: ${C.slate500};
  font-size: 1.05rem; font-weight: 700; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s;
  &:hover {
    border-color: ${C.indigo};
    color: ${C.indigo};
    background: ${C.indigoLight};
    border-style: solid;
  }
`;
const AddCategoryTrigger = styled.button`
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.38rem 0.75rem;
  border: 1.5px dashed ${C.slate300};
  border-radius: 999px;
  background: ${C.white};
  color: ${C.slate600};
  font-size: 0.72rem; font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  &:hover {
    border-color: ${C.indigo};
    color: ${C.indigo};
    background: ${C.indigoLight};
    border-style: solid;
  }
`;
const CategoryPickerHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
`;
const CategoryPickerLabel = styled.span`
  font-size: 0.68rem; font-weight: 800; color: ${C.slate500};
  text-transform: uppercase; letter-spacing: 0.45px;
`;
const CustomGroupRow = styled.div`
  display: flex; gap: 0.35rem; align-items: center;
  margin-top: 0.4rem;
  animation: ${fadeIn} 0.2s ease;
`;
const CustomGroupInput = styled.input`
  width: 160px;
  padding: 0.3rem 0.55rem;
  border: 1px solid ${C.indigo};
  border-radius: 7px;
  font-size: 0.75rem; color: ${C.slate700};
  outline: none; box-sizing: border-box;
  background: ${C.white};
  &:focus { box-shadow: 0 0 0 2px ${C.indigoLight}; }
  &::placeholder { color: ${C.slate300}; }
`;
const GroupsList = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
  flex: 1;
`;
const GroupsToolbar = styled.div`
  display: flex; align-items: center; justify-content: flex-end;
  flex-shrink: 0;
  margin-bottom: 0.45rem;
`;
const ExpandAllBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.32rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 999px;
  background: ${C.slate50};
  color: ${C.slate600};
  font-size: 0.7rem; font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  &:hover {
    border-color: ${C.indigo};
    color: ${C.indigoDark};
    background: ${C.indigoLight};
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

/* ── File Groups tab ── */
const GroupCard = styled.div`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease;
  box-shadow: 0 1px 4px rgba(15,23,42,0.04);
`;
const GroupCardHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 1rem;
  background: ${C.slate50};
  border-bottom: 1px solid ${(p) => p.$open ? C.slate200 : 'transparent'};
  cursor: pointer;
  user-select: none;
  &:hover { background: ${C.slate100}; }
`;
const GroupName = styled.div`
  font-size: 0.83rem; font-weight: 800; color: ${C.slate700};
  display: flex; align-items: center; gap: 0.55rem;
`;
const GroupCount = styled.span`
  font-size: 0.68rem; font-weight: 700;
  color: ${C.white};
  background: ${(p) => p.$hasFiles ? C.indigo : C.slate300};
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
`;
const GroupActions = styled.div`
  display: flex; gap: 0.3rem; align-items: center;
`;
const GroupFilesArea = styled.div`
  padding: ${(p) => (p.$empty ? '0.75rem 1rem' : '0.85rem 1rem 0.75rem')};
  background: ${C.white};
  ${(p) => p.$dragging && `background: ${C.indigoLight};`}
  transition: background 0.2s;
  min-height: ${(p) => (p.$empty ? '52px' : '0')};
`;
/* ── File list (ίδιο στυλ με FileManager υποέργου) ── */
const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;
const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: ${C.white};
  border-radius: 10px;
  border: 1px solid ${C.slate200};
  transition: box-shadow 0.18s, border-color 0.18s;
  gap: 0.75rem;
  &:hover {
    border-color: ${C.slate300};
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
  }
`;
const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.7rem;
`;
const FileTypeIcon = styled.div`
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
const FileListName = styled.span`
  font-size: 0.84rem;
  font-weight: 500;
  color: ${C.slate800};
  word-break: break-word;
  line-height: 1.35;
`;
const FileListMeta = styled.span`
  display: block;
  font-size: 0.64rem;
  color: ${C.slate400};
  font-weight: 600;
  margin-top: 0.1rem;
`;
const FileActions = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
`;
const IconActionBtn = styled.button`
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
const ViewIconBtn = styled(IconActionBtn)`
  &:hover {
    background: ${C.indigoLight};
    color: ${C.indigo};
    border-color: #c7d2fe;
  }
`;
const DownloadIconBtn = styled(IconActionBtn)`
  &:hover {
    background: #ecfdf5;
    color: ${C.teal};
    border-color: #a7f3d0;
  }
`;
const DeleteIconBtn = styled(IconActionBtn)`
  &:hover {
    background: #fee2e2;
    color: ${C.rose};
    border-color: #fecaca;
  }
`;
const MoveIconBtn = styled(IconActionBtn)`
  font-size: 0.82rem;
  &:hover {
    background: ${C.indigoLight};
    color: ${C.indigoDark};
    border-color: #c7d2fe;
  }
`;
const RenameIconBtn = styled(IconActionBtn)`
  font-size: 0.78rem;
  &:hover {
    background: #fef9c3;
    color: #854d0e;
    border-color: #fde047;
  }
`;
const MoveTargetList = styled.div`
  display: flex; flex-direction: column; gap: 0.35rem;
  max-height: 220px; overflow-y: auto;
  margin: 0.75rem 0;
`;
const MoveTargetOption = styled.button`
  display: flex; align-items: center; gap: 0.5rem;
  width: 100%; text-align: left;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  border: 1.5px solid ${(p) => (p.$active ? C.indigo : C.slate200)};
  background: ${(p) => (p.$active ? C.indigoLight : C.white)};
  color: ${C.slate700};
  font-size: 0.78rem; font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${C.indigo}; background: ${C.indigoLight}; }
`;

/* ── Folder contents modal ── */
const FolderModalOverlay = styled.div`
  position: fixed; inset: 0; z-index: 10050;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
`;
const FolderModalCard = styled.div`
  background: ${C.white};
  border-radius: 14px;
  width: min(520px, 96vw);
  max-height: min(70vh, 640px);
  display: flex; flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
  overflow: hidden;
`;
const FolderModalHeader = styled.div`
  padding: 1rem 1.15rem 0.75rem;
  border-bottom: 1px solid ${C.slate200};
`;
const FolderModalTitle = styled.h3`
  margin: 0; font-size: 0.95rem; font-weight: 800; color: ${C.slate800};
`;
const FolderModalSub = styled.div`
  margin-top: 0.2rem; font-size: 0.72rem; color: ${C.slate500}; font-weight: 600;
`;
const FolderModalBody = styled.div`
  flex: 1; overflow-y: auto; padding: 0.75rem 1rem;
`;
const FolderModalFooter = styled.div`
  padding: 0.75rem 1rem;
  border-top: 1px solid ${C.slate200};
  display: flex; justify-content: flex-end; gap: 0.45rem;
`;
const IconBtn = styled.button`
  background: none; border: none; cursor: pointer;
  color: ${(p) => p.$color || C.slate400};
  padding: 0.15rem; border-radius: 5px; font-size: 0.75rem;
  transition: all 0.15s;
  &:hover { color: ${(p) => p.$hoverColor || C.indigoDark}; background: ${C.indigoLight}; }
`;
const EmptyGroupHint = styled.div`
  font-size: 0.72rem; color: ${(p) => (p.$dragging ? C.indigo : C.slate400)};
  font-weight: 600; font-style: italic; text-align: center;
  padding: 0.35rem 0;
  transition: color 0.2s;
`;

/* ── Add group chips ── */
const PresetChip = styled.button`
  padding: 0.22rem 0.5rem;
  border: 1px solid ${C.slate200};
  border-radius: 999px;
  background: white;
  font-size: 0.66rem; font-weight: 700; color: ${C.slate600};
  cursor: pointer; transition: all 0.15s;
  &:hover { border-color: ${C.teal}; color: ${C.teal}; background: ${C.tealLight}; }
`;

/* ── Notes tab ── */
const NotesTextarea = styled.textarea`
  width: 100%; min-height: 260px;
  padding: 0.85rem;
  border: 1px solid ${C.slate200}; border-radius: 12px;
  font-size: 0.85rem; color: ${C.slate800};
  line-height: 1.6; resize: vertical;
  outline: none; font-family: inherit;
  background: ${C.slate50};
  box-sizing: border-box;
  &:focus { border-color: ${C.indigo}; background: white; box-shadow: 0 0 0 3px ${C.indigoLight}; }
  &::placeholder { color: ${C.slate300}; }
`;

/* ── Pending items tab ── */
const PendingList = styled.div`
  display: flex; flex-direction: column; gap: 0.55rem; margin-bottom: 1rem;
`;
const PendingItem = styled.div`
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.7rem 0.85rem;
  background: ${(p) => p.$done ? C.slate50 : C.white};
  border: 1px solid ${(p) => p.$done ? C.slate200 : C.slate200};
  border-left: 3px solid ${(p) => p.$done ? C.emerald : C.amber};
  border-radius: 10px;
  transition: all 0.2s;
  animation: ${fadeIn} 0.3s ease;
`;
const PendingCheckbox = styled.input`
  width: 16px; height: 16px; margin-top: 0.1rem; cursor: pointer; flex-shrink: 0;
  accent-color: ${C.emerald};
`;
const PendingText = styled.div`
  flex: 1;
  font-size: 0.82rem; font-weight: 600;
  color: ${(p) => p.$done ? C.slate400 : C.slate700};
  text-decoration: ${(p) => p.$done ? 'line-through' : 'none'};
  word-break: break-word;
`;
const AddPendingRow = styled.div`
  display: flex; gap: 0.5rem; min-width: 0;
`;
const AddPendingInput = styled.input`
  flex: 1; min-width: 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid ${C.slate200}; border-radius: 10px;
  font-size: 0.82rem; color: ${C.slate700};
  outline: none; box-sizing: border-box;
  &:focus { border-color: ${C.indigo}; box-shadow: 0 0 0 3px ${C.indigoLight}; }
  &::placeholder { color: ${C.slate300}; }
`;

/* ── Shared buttons ── */
const Btn = styled.button`
  padding: ${(p) => p.$sm ? '0.35rem 0.7rem' : '0.55rem 1rem'};
  border-radius: ${(p) => p.$sm ? '8px' : '10px'};
  font-size: ${(p) => p.$sm ? '0.72rem' : '0.8rem'};
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.18s;
  display: inline-flex; align-items: center; gap: 0.35rem;
  white-space: nowrap;

  ${(p) => p.$variant === 'primary' && css`
    background: linear-gradient(135deg, ${C.teal}, ${C.indigo});
    color: white;
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.28); }
  `}
  ${(p) => p.$variant === 'ghost' && css`
    background: transparent; color: ${C.slate500}; border-color: ${C.slate200};
    &:hover { background: ${C.slate100}; color: ${C.slate700}; }
  `}
  ${(p) => p.$variant === 'danger' && css`
    background: transparent; color: #ef4444; border-color: #fecaca;
    &:hover { background: #fff1f2; }
  `}
  ${(p) => p.$variant === 'teal' && css`
    background: ${C.tealLight}; color: ${C.teal}; border-color: #99f6e4;
    &:hover { background: #ccfbf1; }
  `}
  ${(p) => !p.$variant && css`
    background: ${C.indigoLight}; color: ${C.indigoDark}; border-color: #c7d2fe;
    &:hover { background: #dde0ff; }
  `}
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
`;

const SectionLabel = styled.div`
  font-size: 0.72rem; font-weight: 800; color: ${C.slate500};
  text-transform: uppercase; letter-spacing: 0.55px;
  margin-bottom: 0.6rem;
`;

const Saving = styled.span`
  font-size: 0.68rem; color: ${C.slate400}; font-weight: 600;
  animation: ${pulse} 1.2s ease-in-out infinite;
`;

const ReadOnlyBadge = styled.span`
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.85);
  z-index: 1;
`;

const DetailFooter = styled.div`
  padding: 0.85rem 1.5rem;
  border-top: 1px solid ${C.slate200};
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
  background: ${C.slate50};
`;

const ExportOptionRow = styled.label`
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  background: ${C.slate50};
  cursor: pointer;
  font-size: 0.82rem; color: ${C.slate700}; font-weight: 600;
  line-height: 1.45;
  input { margin-top: 0.15rem; accent-color: ${C.indigo}; flex-shrink: 0; }
`;

const ExportSuccessOverlay = styled(FolderModalOverlay)`
  z-index: 10060;
`;
const ExportSuccessCard = styled(FolderModalCard)`
  width: min(420px, 92vw);
`;
const ExportSuccessBody = styled.div`
  padding: 1.25rem 1.15rem 0.35rem;
  text-align: center;
  color: ${C.slate600};
  font-size: 0.84rem;
  line-height: 1.55;
  font-weight: 600;
`;
const ExportSuccessActions = styled(FolderModalFooter)`
  justify-content: center;
  padding: 1rem 1.15rem 1.15rem;
`;
const OpenFolderBtn = styled.button`
  width: 100%;
  padding: 0.72rem 1rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, ${C.indigo}, ${C.indigoDark});
  color: white;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.18s;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
  &:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
`;

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function OrimanthiManager({ onClose, loggedInUsername, userRole, orimanthiCanEdit = false }) {
  const { showToast } = useToast();

  const isReadOnly = userRole === 'USER' && !orimanthiCanEdit;

  const [proposals, setProposals] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Per-group expand state (default: collapsed)
  const [expandedGroups, setExpandedGroups] = useState({});

  // Inline "create new" form in sidebar
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProposalTitle, setNewProposalTitle] = useState('');
  const newTitleRef = useRef(null);

  // Add group UI
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const addGroupInputRef = useRef(null);

  // Pending item input
  const [pendingInput, setPendingInput] = useState('');

  // Drag state
  const [folderModal, setFolderModal] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const renameInputRef = useRef(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);

  // Export
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportIncludeFiles, setExportIncludeFiles] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const saveTimerRef = useRef(null);
  // Ref που κρατά πάντα το τελευταίο state proposals χωρίς να δημιουργεί νέα closure
  const proposalsRef = useRef([]);

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await window.electronAPI.invoke('load-all-proposals');
      if (res.success) setProposals(res.proposals || []);
    })();
  }, []);

  useEffect(() => {
    if (!isCreatingNew) return;
    const t = setTimeout(() => newTitleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isCreatingNew]);

  useEffect(() => {
    setShowCategoryPicker(false);
    setAddingGroup(false);
    setNewGroupName('');
    setExpandedGroups({});
  }, [selectedId]);

  // Sync ref με το τρέχον state
  proposalsRef.current = proposals;

  const selectedProposal = proposals.find((p) => p.id === selectedId) || null;

  /* ── Auto-save — skipAudit=true για να μη γεμίζει το audit log με κάθε keystroke ── */
  const saveProposal = useCallback(async (updated, { skipAudit = false } = {}) => {
    if (isReadOnly) return;
    setSaving(true);
    const res = await window.electronAPI.invoke('save-proposal', {
      proposal: updated,
      actingUsername: loggedInUsername,
      skipAudit,
    });
    setSaving(false);
    if (!res.success) showToast(`Σφάλμα αποθήκευσης: ${res.error}`, 'error');
  }, [isReadOnly, loggedInUsername, showToast]);

  const updateProposal = useCallback((changes) => {
    setProposals((prev) =>
      prev.map((p) => p.id === selectedId ? { ...p, ...changes } : p)
    );
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const latest = proposalsRef.current.find((p) => p.id === selectedId);
      if (latest) saveProposal({ ...latest, ...changes }, { skipAudit: true });
    }, 1200);
  }, [selectedId, saveProposal]);

  const handleTitleBlur = useCallback(() => {
    if (isReadOnly || !selectedId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const latest = proposalsRef.current.find((p) => p.id === selectedId);
    if (latest) saveProposal(latest, { skipAudit: true });
  }, [isReadOnly, selectedId, saveProposal]);

  const handleExpandAllGroups = useCallback(() => {
    const groups = selectedProposal?.fileGroups || [];
    if (!groups.length) return;
    const next = {};
    groups.forEach((g) => { next[g.id] = true; });
    setExpandedGroups(next);
  }, [selectedProposal?.fileGroups]);

  const toggleGroupExpanded = useCallback((groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  /* ── Create proposal — shows inline title form first ── */
  const handleStartCreate = () => {
    if (isReadOnly) return;
    setSelectedId(null);
    setIsCreatingNew(true);
    setNewProposalTitle('');
  };

  const handleConfirmCreate = async () => {
    if (isReadOnly) return;
    const title = newProposalTitle.trim();
    if (!title) {
      showToast('Δώστε τίτλο για τη νέα πρόταση', 'warning');
      newTitleRef.current?.focus();
      return;
    }
    const proposal = { ...emptyProposal(), title };
    const res = await window.electronAPI.invoke('save-proposal', {
      proposal,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast('Σφάλμα δημιουργίας πρότασης', 'error');
    setProposals((prev) => [res.proposal, ...prev]);
    setSelectedId(res.proposal.id);
    setActiveTab('files');
    setIsCreatingNew(false);
    setNewProposalTitle('');
  };

  const handleCancelCreate = () => {
    setIsCreatingNew(false);
    setNewProposalTitle('');
  };

  /* ── Delete proposal ── */
  const handleDeleteProposal = async () => {
    if (isReadOnly || !selectedProposal) return;
    const title = selectedProposal.title || 'Χωρίς τίτλο';
    if (!await showConfirm({
      title: 'Διαγραφή Πρότασης',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την πρόταση «${title}»;`,
      detail: 'Θα διαγραφούν και όλα τα αρχεία της. Η ενέργεια είναι μη αναστρέψιμη.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;
    const res = await window.electronAPI.invoke('delete-proposal', {
      proposalId: selectedId,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast('Σφάλμα διαγραφής', 'error');
    setProposals((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
    setCollapsedGroups({});
    setIsCreatingNew(true);
    setNewProposalTitle('');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    showToast('Η πρόταση διαγράφηκε', 'success');
  };

  /* ── File groups ── */
  const addGroup = (label) => {
    if (isReadOnly || !label.trim()) return;
    const already = selectedProposal.fileGroups.find(
      (g) => g.label.toLowerCase() === label.trim().toLowerCase()
    );
    if (already) {
      setNewGroupName('');
      setAddingGroup(false);
      setShowCategoryPicker(false);
      return;
    }
    const group = { id: uuidv4(), label: label.trim(), files: [] };
    updateProposal({ fileGroups: [...(selectedProposal.fileGroups || []), group] });
    setNewGroupName('');
    setAddingGroup(false);
    setShowCategoryPicker(false);
  };

  const handleStartAddGroup = () => {
    setAddingGroup(true);
    setTimeout(() => addGroupInputRef.current?.focus(), 50);
  };

  const handleOpenCategoryPicker = () => {
    setShowCategoryPicker(true);
    setAddingGroup(false);
    setNewGroupName('');
  };

  const handleCancelAddGroup = () => {
    setAddingGroup(false);
    setNewGroupName('');
    setShowCategoryPicker(false);
  };

  const deleteGroup = async (groupId, groupLabel) => {
    if (isReadOnly) return;
    if (!await showConfirm({
      title: 'Διαγραφή Κατηγορίας',
      message: groupLabel
        ? `Είστε σίγουροι ότι θέλετε να διαγράψετε την κατηγορία «${groupLabel}»;`
        : 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κατηγορία;',
      detail: 'Θα διαγραφούν και όλα τα αρχεία που περιέχει.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;
    updateProposal({
      fileGroups: selectedProposal.fileGroups.filter((g) => g.id !== groupId)
    });
  };

  /* ── Upload files to group ── */
  const uploadToGroup = useCallback(async (groupId, filePaths) => {
    if (!filePaths?.length || !selectedId) return;
    const files = filePaths.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() }));
    const res = await window.electronAPI.invoke('upload-proposal-files', {
      proposalId: selectedId,
      groupId,
      files,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast(`Σφάλμα ανεβάσματος: ${res.error}`, 'error');

    setProposals((prev) => {
      const next = prev.map((p) => {
        if (p.id !== selectedId) return p;
        return {
          ...p,
          fileGroups: p.fileGroups.map((g) => {
            if (g.id !== groupId) return g;
            const existingKeys = new Set(g.files.map((f) => getProposalEntryKey(f)));
            const newFiles = res.files.filter((f) => !existingKeys.has(f.name));
            return { ...g, files: [...g.files, ...newFiles] };
          }),
        };
      });
      // Persist metadata αμέσως — skipAudit γιατί είναι τεχνική αποθήκευση metadata
      const updated = next.find((p) => p.id === selectedId);
      if (updated) saveProposal(updated, { skipAudit: true });
      return next;
    });
    showToast(`Ανέβηκαν ${res.files.length} αρχεία`, 'success');
  }, [selectedId, showToast, saveProposal, loggedInUsername]);

  const uploadFolderToGroup = useCallback(async (groupId, picked) => {
    if (!picked?.files?.length || !selectedId) return;
    const res = await window.electronAPI.invoke('upload-proposal-folder', {
      proposalId: selectedId,
      groupId,
      folderName: picked.folderName || 'Φάκελος',
      files: picked.files.map((f) => ({
        path: f.filePath || f.path,
        name: f.fileName || f.name,
      })),
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast(`Σφάλμα ανεβάσματος φακέλου: ${res.error}`, 'error');

    setProposals((prev) => {
      const next = prev.map((p) => {
        if (p.id !== selectedId) return p;
        return {
          ...p,
          fileGroups: p.fileGroups.map((g) => {
            if (g.id !== groupId) return g;
            const exists = g.files.some((f) => isProposalFolder(f) && f.id === res.folder.id);
            if (exists) return g;
            return { ...g, files: [...g.files, res.folder] };
          }),
        };
      });
      const updated = next.find((p) => p.id === selectedId);
      if (updated) saveProposal(updated, { skipAudit: true });
      return next;
    });
    showToast(`Προστέθηκε φάκελος «${res.folder.name}» (${res.folder.fileCount} αρχεία)`, 'success');
  }, [selectedId, showToast, saveProposal, loggedInUsername]);

  const handleSelectFiles = async (groupId) => {
    if (isReadOnly) return;
    // allFileTypes: true → αποδέχεται οποιοδήποτε τύπο αρχείου
    const res = await window.electronAPI.invoke('select-multiple-files', { allFileTypes: true });
    if (!res || res.canceled || !res.success) return;
    // select-multiple-files επιστρέφει { files: [{ filePath, fileName }] }
    const paths = (res.files || []).map((f) => f.filePath || f.path).filter(Boolean);
    if (paths.length) await uploadToGroup(groupId, paths);
  };

  const handleSelectFolder = async (groupId) => {
    if (isReadOnly) return;
    const res = await window.electronAPI.invoke('select-folder-files-flat', {
      title: 'Επιλογή φακέλου για ανέβασμα'
    });
    if (!res || res.canceled) return;
    if (!res.success) return showToast(res.error || 'Σφάλμα επιλογής φακέλου', 'error');
    await uploadFolderToGroup(groupId, res);
  };

  const handleOpenFolder = async (groupId, folder) => {
    const res = await window.electronAPI.invoke('get-proposal-folder-files', {
      proposalId: selectedId,
      groupId,
      folderId: folder.id,
    });
    if (!res.success) return showToast(res.error || 'Σφάλμα φόρτωσης φακέλου', 'error');
    setFolderModal({
      groupId,
      folderId: folder.id,
      label: folder.name,
      files: res.files || [],
    });
  };

  const handleOpenFolderFile = async (fileName) => {
    if (!folderModal) return;
    const res = await window.electronAPI.invoke('open-proposal-file', {
      proposalId: selectedId,
      groupId: folderModal.groupId,
      folderId: folderModal.folderId,
      fileName,
    });
    if (!res.success) showToast(`Σφάλμα ανοίγματος: ${res.error}`, 'error');
  };

  const handleDownloadFolderFile = async (fileName) => {
    if (!folderModal) return;
    const res = await window.electronAPI.invoke('download-proposal-file', {
      proposalId: selectedId,
      groupId: folderModal.groupId,
      folderId: folderModal.folderId,
      fileName,
    });
    if (res.success) showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
    else if (!res.canceled) showToast(`Σφάλμα λήψης: ${res.error}`, 'error');
  };

  const handleDeleteFolder = async (groupId, folder) => {
    if (isReadOnly) return;
    if (!await showConfirm({
      title: 'Διαγραφή Φακέλου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε τον φάκελο «${folder.name}»;`,
      detail: 'Θα διαγραφούν και όλα τα αρχεία που περιέχει.',
      confirmLabel: 'Διαγραφή',
      icon: '📁',
    })) return;
    const res = await window.electronAPI.invoke('delete-proposal-folder', {
      proposalId: selectedId,
      groupId,
      folderId: folder.id,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast('Σφάλμα διαγραφής φακέλου', 'error');
    setProposals((prev) => {
      const next = prev.map((p) => {
        if (p.id !== selectedId) return p;
        return {
          ...p,
          fileGroups: p.fileGroups.map((g) =>
            g.id === groupId
              ? { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== folder.id) }
              : g
          ),
        };
      });
      const updated = next.find((pp) => pp.id === selectedId);
      if (updated) saveProposal(updated, { skipAudit: true });
      return next;
    });
    if (folderModal?.folderId === folder.id) setFolderModal(null);
  };

  const handleOpenMove = (sourceGroupId, entry) => {
    if (isReadOnly) return;
    const otherGroups = (selectedProposal?.fileGroups || []).filter((g) => g.id !== sourceGroupId);
    setMoveModal({
      sourceGroupId,
      entry,
      targetGroupId: otherGroups[0]?.id || '',
      targetMode: otherGroups.length ? 'existing' : 'new',
      newCategoryName: '',
    });
  };

  const handleConfirmMove = async () => {
    if (!moveModal || !selectedProposal || !selectedId) return;

    let targetGroupId = moveModal.targetGroupId;
    let targetLabel = '';
    let fileGroups = [...(selectedProposal.fileGroups || [])];

    if (moveModal.targetMode === 'new') {
      targetLabel = moveModal.newCategoryName.trim();
      if (!targetLabel) {
        showToast('Δώστε όνομα για τη νέα κατηγορία', 'error');
        return;
      }
      const existing = fileGroups.find(
        (g) => g.label.trim().toLowerCase() === targetLabel.toLowerCase()
      );
      if (existing) {
        targetGroupId = existing.id;
      } else {
        targetGroupId = uuidv4();
        fileGroups = [...fileGroups, { id: targetGroupId, label: targetLabel, files: [] }];
      }
    } else if (!targetGroupId) {
      showToast('Επιλέξτε κατηγορία προορισμού', 'error');
      return;
    }

    if (targetGroupId === moveModal.sourceGroupId) {
      showToast('Η κατηγορία προορισμού είναι ίδια με την πηγή', 'error');
      return;
    }

    const entry = moveModal.entry;
    const sourceKey = getProposalEntryKey(entry);
    const payload = {
      proposalId: selectedId,
      sourceGroupId: moveModal.sourceGroupId,
      targetGroupId,
      actingUsername: loggedInUsername,
    };

    if (isProposalFolder(entry)) {
      payload.entryKind = 'folder';
      payload.folderId = entry.id;
    } else {
      payload.entryKind = 'file';
      payload.fileName = entry.name;
    }

    const res = await window.electronAPI.invoke('move-proposal-entry', payload);
    if (!res.success) {
      showToast(res.error || 'Σφάλμα μεταφοράς', 'error');
      return;
    }

    const movedEntry = isProposalFolder(entry)
      ? { ...entry }
      : res.entry;

    const nextGroups = fileGroups.map((g) => {
      if (g.id === moveModal.sourceGroupId) {
        return { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== sourceKey) };
      }
      if (g.id === targetGroupId) {
        const withoutDup = g.files.filter((f) => getProposalEntryKey(f) !== getProposalEntryKey(movedEntry));
        return { ...g, files: [...withoutDup, movedEntry] };
      }
      return g;
    });

    const updatedProposal = { ...selectedProposal, fileGroups: nextGroups };
    setProposals((prev) => prev.map((p) => (p.id === selectedId ? updatedProposal : p)));
    await saveProposal(updatedProposal, { skipAudit: true });

    if (folderModal?.groupId === moveModal.sourceGroupId && isProposalFolder(entry)) {
      setFolderModal(null);
    }

    setMoveModal(null);
    const destLabel = nextGroups.find((g) => g.id === targetGroupId)?.label || 'κατηγορία';
    showToast(`Μεταφέρθηκε στο «${destLabel}»`, 'success');
  };

  const handleOpenFile = async (groupId, fileName) => {
    const res = await window.electronAPI.invoke('open-proposal-file', {
      proposalId: selectedId, groupId, fileName
    });
    if (!res.success) showToast(`Σφάλμα ανοίγματος: ${res.error}`, 'error');
  };

  const handleDownloadFile = async (groupId, fileName) => {
    const res = await window.electronAPI.invoke('download-proposal-file', {
      proposalId: selectedId, groupId, fileName
    });
    if (res.success) showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
    else if (!res.canceled) showToast(`Σφάλμα λήψης: ${res.error}`, 'error');
  };

  const handleDeleteFile = async (groupId, fileName) => {
    if (isReadOnly) return;
    if (!await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο «${fileName}»;`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;
    const res = await window.electronAPI.invoke('delete-proposal-file', {
      proposalId: selectedId, groupId, fileName,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast('Σφάλμα διαγραφής αρχείου', 'error');
    setProposals((prev) => {
      const next = prev.map((p) => {
        if (p.id !== selectedId) return p;
        return {
          ...p,
          fileGroups: p.fileGroups.map((g) =>
            g.id === groupId
              ? { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== fileName) }
              : g
          ),
        };
      });
      const updated = next.find((pp) => pp.id === selectedId);
      if (updated) saveProposal(updated, { skipAudit: true });
      return next;
    });
  };

  const getRenameBaseName = (fileName) => {
    const lastDot = String(fileName || '').lastIndexOf('.');
    if (lastDot > 0) return fileName.slice(0, lastDot);
    return fileName || '';
  };

  const getRenameExtension = (fileName) => {
    const lastDot = String(fileName || '').lastIndexOf('.');
    if (lastDot > 0) return fileName.slice(lastDot);
    return '';
  };

  const handleOpenRename = (groupId, fileName, folderId = null) => {
    if (isReadOnly) return;
    setRenameModal({
      groupId,
      folderId,
      oldName: fileName,
      newName: getRenameBaseName(fileName),
      extension: getRenameExtension(fileName),
    });
  };

  const handleCloseRename = () => setRenameModal(null);

  const handleConfirmRename = async () => {
    if (!renameModal || !selectedId) return;
    const trimmed = renameModal.newName.trim();
    if (!trimmed) {
      showToast('Δώστε νέο όνομα αρχείου', 'error');
      return;
    }
    const finalName = `${trimmed}${renameModal.extension || ''}`;

    const res = await window.electronAPI.invoke('rename-proposal-file', {
      proposalId: selectedId,
      groupId: renameModal.groupId,
      folderId: renameModal.folderId || undefined,
      oldFileName: renameModal.oldName,
      newFileName: finalName,
      actingUsername: loggedInUsername,
    });
    if (!res.success) {
      showToast(res.error || 'Σφάλμα μετονομασίας', 'error');
      return;
    }

    const newFileName = res.newFileName;

    if (renameModal.folderId) {
      setFolderModal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: (prev.files || []).map((f) =>
            f.name === renameModal.oldName ? { ...f, name: newFileName } : f
          ),
        };
      });
    } else {
      setProposals((prev) => {
        const next = prev.map((p) => {
          if (p.id !== selectedId) return p;
          return {
            ...p,
            fileGroups: p.fileGroups.map((g) => {
              if (g.id !== renameModal.groupId) return g;
              return {
                ...g,
                files: g.files.map((f) => {
                  if (isProposalFolder(f)) return f;
                  if (f.name !== renameModal.oldName) return f;
                  return { ...f, name: newFileName };
                }),
              };
            }),
          };
        });
        const updated = next.find((pp) => pp.id === selectedId);
        if (updated) saveProposal(updated, { skipAudit: true });
        return next;
      });
    }

    setRenameModal(null);
    showToast(`Μετονομάστηκε σε «${newFileName}»`, 'success');
  };

  useEffect(() => {
    if (!renameModal) return undefined;
    const t = setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [renameModal]);

  /* ── Drag & drop ── */
  const handleDrop = useCallback(async (e, groupId) => {
    e.preventDefault();
    setDraggingGroupId(null);
    if (isReadOnly) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;
    const paths = droppedFiles.map((f) => f.path).filter(Boolean);
    if (paths.length) await uploadToGroup(groupId, paths);
  }, [uploadToGroup]);

  /* ── Pending items ── */
  const addPendingItem = () => {
    if (isReadOnly || !pendingInput.trim()) return;
    const item = { id: uuidv4(), text: pendingInput.trim(), done: false, createdAt: new Date().toISOString() };
    updateProposal({ pendingItems: [...(selectedProposal.pendingItems || []), item] });
    setPendingInput('');
  };

  const togglePendingItem = (itemId) => {
    if (isReadOnly) return;
    updateProposal({
      pendingItems: (selectedProposal.pendingItems || []).map((it) =>
        it.id === itemId ? { ...it, done: !it.done } : it
      )
    });
  };

  const deletePendingItem = (itemId) => {
    if (isReadOnly) return;
    updateProposal({
      pendingItems: (selectedProposal.pendingItems || []).filter((it) => it.id !== itemId)
    });
  };

  const flushProposalSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const latest = proposalsRef.current.find((p) => p.id === selectedId);
    if (latest && !isReadOnly) {
      await saveProposal(latest, { skipAudit: true });
    }
  }, [selectedId, isReadOnly, saveProposal]);

  const handleExportConfirm = async () => {
    if (!selectedProposal || exporting) return;
    setShowExportDialog(false);
    setExporting(true);
    try {
      await flushProposalSave();
      const res = await window.electronAPI.invoke('export-proposal', {
        proposalId: selectedProposal.id,
        includeFiles: exportIncludeFiles,
        actingUsername: loggedInUsername,
      });
      if (res.canceled) return;
      if (!res.success) {
        showToast(res.error || 'Σφάλμα εξαγωγής', 'error');
        return;
      }
      setExportSuccess({
        exportPath: res.exportPath,
      });
      showToast('Η εξαγωγή ολοκληρώθηκε', 'success');
    } catch (e) {
      showToast(`Σφάλμα εξαγωγής: ${e.message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenExportFolder = async () => {
    if (!exportSuccess?.exportPath) return;
    try {
      const res = await window.electronAPI.invoke('open-exported-file', {
        filePath: exportSuccess.exportPath,
      });
      if (!res?.success) showToast(res?.error || 'Δεν ήταν δυνατό το άνοιγμα του φακέλου', 'error');
    } catch (e) {
      showToast(`Σφάλμα: ${e.message}`, 'error');
    }
  };

  /* ── Filtered proposals ── */
  const filteredProposals = proposals.filter((p) =>
    !search || (p.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusStyle = selectedProposal ? getStatusStyle(selectedProposal.status) : null;

  const totalFiles = selectedProposal
    ? (selectedProposal.fileGroups || []).reduce((s, g) => s + g.files.length, 0)
    : 0;
  const doneItems = selectedProposal
    ? (selectedProposal.pendingItems || []).filter((i) => i.done).length
    : 0;
  const totalItems = selectedProposal ? (selectedProposal.pendingItems || []).length : 0;
  const hasNotes = selectedProposal ? hasProposalNotes(selectedProposal.notes) : false;
  const availablePresetGroups = useMemo(() => {
    if (!selectedProposal) return PRESET_GROUPS;
    return PRESET_GROUPS.filter((p) => !groupLabelExists(selectedProposal.fileGroups, p.label));
  }, [selectedProposal]);

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderTitle>
            <HeaderIcon>🌱</HeaderIcon>
            <HeaderText>
              <HeaderH>Ωρίμανση Έργων</HeaderH>
              <HeaderSub>
                {proposals.length > 0
                  ? `${proposals.length} πρόταση/εις · Pipeline προ-χρηματοδοτικής ωρίμανσης`
                  : 'Pipeline προ-χρηματοδοτικής ωρίμανσης'}
              </HeaderSub>
            </HeaderText>
          </HeaderTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', zIndex: 1 }}>
            {isReadOnly && (
              <ReadOnlyBadge>👁 Προβολή μόνο</ReadOnlyBadge>
            )}
            {selectedProposal && !isCreatingNew && (
              <HeaderActionBtn
                type="button"
                onClick={() => setShowExportDialog(true)}
                disabled={exporting}
                title="Εξαγωγή πρότασης"
              >
                {exporting ? '⏳ Εξαγωγή…' : '📤 Εξαγωγή'}
              </HeaderActionBtn>
            )}
            <CloseBtn onClick={onClose} title="Κλείσιμο">✕</CloseBtn>
          </div>
        </ModalHeader>

        {/* Body */}
        <Body>
          {/* Sidebar */}
          <Sidebar>
            <SidebarHeader>
              <SidebarSearch
                placeholder="Αναζήτηση πρότασης…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!isReadOnly && (
                <AddProposalBtn onClick={handleStartCreate} disabled={isCreatingNew}>
                  {isCreatingNew ? '… Δημιουργία πρότασης' : '＋ Νέα Πρόταση'}
                </AddProposalBtn>
              )}
            </SidebarHeader>
            <SidebarList>
              {filteredProposals.length === 0 && !isCreatingNew && (
                <EmptyProposals>
                  {search ? 'Δεν βρέθηκαν αποτελέσματα' : 'Δεν υπάρχουν προτάσεις.\nΠροσθέστε μια νέα.'}
                </EmptyProposals>
              )}
              {filteredProposals.map((p) => {
                const st = getStatusStyle(p.status);
                const fileCount = (p.fileGroups || []).reduce((s, g) => s + g.files.length, 0);
                const notesExist = hasProposalNotes(p.notes);
                return (
                  <ProposalItem
                    key={p.id}
                    type="button"
                    $active={p.id === selectedId}
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewProposalTitle('');
                      setSelectedId(p.id);
                      setActiveTab('files');
                    }}
                  >
                    <ProposalItemTitle $active={p.id === selectedId}>
                      {p.title || '(Χωρίς τίτλο)'}
                    </ProposalItemTitle>
                    <ProposalItemMeta>
                      <StatusDot $color={st.color} />
                      <ProposalItemSub>{st.label}</ProposalItemSub>
                      <ProposalItemIcons>
                        {notesExist && (
                          <ProposalItemIcon title="Υπάρχουν σημειώσεις">📝</ProposalItemIcon>
                        )}
                        {fileCount > 0 && (
                          <ProposalItemIcon title="Αρχεία">📎 {fileCount}</ProposalItemIcon>
                        )}
                      </ProposalItemIcons>
                    </ProposalItemMeta>
                    {p.targetProgram && (
                      <ProposalItemSub style={{ marginTop: '0.15rem', opacity: 0.8 }}>
                        🎯 {p.targetProgram}
                      </ProposalItemSub>
                    )}
                  </ProposalItem>
                );
              })}
            </SidebarList>
          </Sidebar>

          {/* Main */}
          <MainContent>
            {isCreatingNew ? (
              <CreateProposalPanel>
                <NewProposalForm>
                  <NewProposalHeading>Νέα πρόταση</NewProposalHeading>
                  <NewProposalHint>
                    Δώστε έναν σαφή τίτλο για την πρόταση που θα ωριμάσετε πριν την υποβολή σε πρόγραμμα χρηματοδότησης.
                  </NewProposalHint>
                  <NewProposalLabel htmlFor="new-proposal-title">Τίτλος πρότασης</NewProposalLabel>
                  <NewProposalInput
                    id="new-proposal-title"
                    ref={newTitleRef}
                    placeholder="π.χ. Ανακατασκευή οδού Κεντρικής…"
                    value={newProposalTitle}
                    onChange={(e) => setNewProposalTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmCreate();
                      if (e.key === 'Escape') handleCancelCreate();
                    }}
                    autoComplete="off"
                  />
                  <NewProposalBtns>
                    <Btn $variant="ghost" onClick={handleCancelCreate}>Ακύρωση</Btn>
                    <Btn $variant="primary" onClick={handleConfirmCreate}>✓ Δημιουργία πρότασης</Btn>
                  </NewProposalBtns>
                </NewProposalForm>
              </CreateProposalPanel>
            ) : !selectedProposal ? (
              <EmptyState>
                <EmptyStateIcon>🌱</EmptyStateIcon>
                <EmptyStateText>Επιλέξτε ή δημιουργήστε μια πρόταση</EmptyStateText>
              </EmptyState>
            ) : (
              <>
                <DetailHeader>
                  <TitleRow>
                    <MetaField style={{ flex: 1, minWidth: 0 }}>
                      <MetaLabel htmlFor="proposal-title-input">Τίτλος πρότασης</MetaLabel>
                      <TitleInput
                        id="proposal-title-input"
                        placeholder="Τίτλος πρότασης…"
                        value={selectedProposal.title}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ title: e.target.value })}
                        onBlur={handleTitleBlur}
                      />
                    </MetaField>
                    {saving && <Saving style={{ alignSelf: 'flex-end' }}>Αποθήκευση…</Saving>}
                  </TitleRow>
                  <MetaGrid>
                    <MetaField>
                      <MetaLabel>Κατάσταση</MetaLabel>
                      <StatusSelect
                        value={selectedProposal.status}
                        $color={statusStyle?.color}
                        $bg={statusStyle?.bg}
                        disabled={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ status: e.target.value })}
                      >
                        {PROPOSAL_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </StatusSelect>
                    </MetaField>
                    <MetaField>
                      <MetaLabel>Στοχευόμενο πρόγραμμα</MetaLabel>
                      <MetaInput
                        placeholder="π.χ. ΕΣΠΑ 2021–2027…"
                        value={selectedProposal.targetProgram}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ targetProgram: e.target.value })}
                      />
                    </MetaField>
                    <MetaField>
                      <MetaLabel>Εκτιμώμενος προϋπολογισμός</MetaLabel>
                      <MetaInput
                        placeholder="π.χ. 850.000 €"
                        value={selectedProposal.estimatedBudget}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ estimatedBudget: e.target.value })}
                      />
                    </MetaField>
                    <MetaField>
                      <MetaLabel>Περιγραφή</MetaLabel>
                      <DescriptionInput
                        placeholder="Σύντομη περιγραφή (προαιρετικό)…"
                        value={selectedProposal.description}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ description: e.target.value })}
                      />
                    </MetaField>
                  </MetaGrid>
                  <TabBar>
                    <Tab $active={activeTab === 'files'} onClick={() => setActiveTab('files')}>
                      📁 Αρχεία ({totalFiles})
                    </Tab>
                    <Tab $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                      ✅ Εκκρεμότητες ({doneItems}/{totalItems})
                    </Tab>
                    <Tab
                      $active={activeTab === 'notes'}
                      $hasContent={hasNotes && activeTab !== 'notes'}
                      onClick={() => setActiveTab('notes')}
                    >
                      📝 Σημειώσεις
                      {hasNotes && <TabIndicator title="Υπάρχουν σημειώσεις" />}
                    </Tab>
                  </TabBar>
                </DetailHeader>

                <DetailBody>
                  {/* Tab: Files */}
                  {activeTab === 'files' && (
                    <FilesTabLayout>
                      {!isReadOnly && (
                        <AddGroupToolbar>
                          {!showCategoryPicker ? (
                            <AddCategoryTrigger type="button" onClick={handleOpenCategoryPicker}>
                              + Προσθήκη κατηγορίας
                            </AddCategoryTrigger>
                          ) : (
                            <>
                              <CategoryPickerHeader>
                                <CategoryPickerLabel>Επιλέξτε κατηγορία</CategoryPickerLabel>
                                <Btn $sm $variant="ghost" onClick={handleCancelAddGroup}>✕</Btn>
                              </CategoryPickerHeader>
                              <PresetChipsRow>
                                {availablePresetGroups.map((p) => (
                                  <PresetChip key={p.label} onClick={() => addGroup(p.label)}>
                                    {p.icon} {p.label}
                                  </PresetChip>
                                ))}
                                <AddCategoryBtn
                                  type="button"
                                  title="Νέα κατηγορία με δικό σας όνομα"
                                  onClick={handleStartAddGroup}
                                >
                                  +
                                </AddCategoryBtn>
                              </PresetChipsRow>
                              {addingGroup && (
                                <CustomGroupRow>
                                  <CustomGroupInput
                                    ref={addGroupInputRef}
                                    placeholder="Όνομα…"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addGroup(newGroupName);
                                      if (e.key === 'Escape') handleCancelAddGroup();
                                    }}
                                  />
                                  <Btn $sm $variant="primary" onClick={() => addGroup(newGroupName)}>✓</Btn>
                                  <Btn $sm $variant="ghost" onClick={handleCancelAddGroup}>✕</Btn>
                                </CustomGroupRow>
                              )}
                            </>
                          )}
                        </AddGroupToolbar>
                      )}

                      {(selectedProposal.fileGroups || []).length === 0 && (
                        <div style={{ color: C.slate400, fontSize: '0.82rem', fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center' }}>
                          {isReadOnly
                            ? 'Δεν υπάρχουν κατηγορίες αρχείων.'
                            : 'Πατήστε «Προσθήκη κατηγορίας» για να ξεκινήσετε.'}
                        </div>
                      )}

                      {(selectedProposal.fileGroups || []).length > 0 && (
                        <GroupsToolbar>
                          <ExpandAllBtn
                            type="button"
                            onClick={handleExpandAllGroups}
                            title="Άνοιγμα όλων των κατηγοριών ταυτόχρονα"
                          >
                            ▼ Προβολή όλων των κατηγοριών
                          </ExpandAllBtn>
                        </GroupsToolbar>
                      )}

                      <GroupsList>
                      {(selectedProposal.fileGroups || []).map((group) => {
                        const expanded = expandedGroups[group.id] === true;
                        const isDragging = draggingGroupId === group.id;
                        const isEmpty = group.files.length === 0;
                        return (
                          <GroupCard key={group.id}>
                            <GroupCardHeader
                              $open={expanded}
                              onClick={() => toggleGroupExpanded(group.id)}
                            >
                              <GroupName>
                                <span>{group.label}</span>
                                <GroupCount $hasFiles={group.files.length > 0}>
                                  {group.files.length}
                                </GroupCount>
                              </GroupName>
                              <GroupActions onClick={(e) => e.stopPropagation()}>
                                {!isReadOnly && expanded && (
                                  <>
                                    <Btn $sm $variant="ghost" onClick={() => handleSelectFiles(group.id)}>
                                      + Αρχεία
                                    </Btn>
                                    <Btn $sm $variant="teal" onClick={() => handleSelectFolder(group.id)}>
                                      Φάκελος
                                    </Btn>
                                    <Btn $sm $variant="danger" onClick={() => deleteGroup(group.id, group.label)}>
                                      ✕
                                    </Btn>
                                  </>
                                )}
                                {!isReadOnly && !expanded && (
                                  <Btn $sm $variant="danger" onClick={() => deleteGroup(group.id, group.label)}>
                                    ✕
                                  </Btn>
                                )}
                                <span style={{ fontSize: '0.7rem', color: C.slate400, marginLeft: '0.15rem' }}>
                                  {expanded ? '▼' : '▶'}
                                </span>
                              </GroupActions>
                            </GroupCardHeader>

                            {expanded && (
                              <GroupFilesArea
                                $empty={isEmpty}
                                $dragging={isDragging}
                                onDragOver={!isReadOnly ? (e) => { e.preventDefault(); setDraggingGroupId(group.id); } : undefined}
                                onDragLeave={!isReadOnly ? () => setDraggingGroupId(null) : undefined}
                                onDrop={!isReadOnly ? (e) => handleDrop(e, group.id) : undefined}
                              >
                                {group.files.length > 0 ? (
                                  <FilesList>
                                    {group.files.map((entry) => {
                                      if (isProposalFolder(entry)) {
                                        const count = entry.fileCount || 0;
                                        return (
                                          <FileItem key={entry.id}>
                                            <FileInfo>
                                              <FileTypeIcon $bg={FOLDER_TYPE_STYLE.bg} style={{ fontSize: '1.05rem' }}>
                                                {FOLDER_TYPE_STYLE.label}
                                              </FileTypeIcon>
                                              <div style={{ minWidth: 0 }}>
                                                <FileListName title={entry.name}>{entry.name}</FileListName>
                                                <FileListMeta>
                                                  {count} {count === 1 ? 'αρχείο' : 'αρχεία'} · κλικ για προβολή
                                                </FileListMeta>
                                              </div>
                                            </FileInfo>
                                            <FileActions>
                                              <ViewIconBtn
                                                title="Προβολή περιεχομένων"
                                                onClick={() => handleOpenFolder(group.id, entry)}
                                              >
                                                👁
                                              </ViewIconBtn>
                                              {!isReadOnly && (
                                                <>
                                                  <MoveIconBtn
                                                    title="Μεταφορά σε άλλη κατηγορία"
                                                    onClick={() => handleOpenMove(group.id, entry)}
                                                  >
                                                    ⇄
                                                  </MoveIconBtn>
                                                  <DeleteIconBtn
                                                    title="Διαγραφή φακέλου"
                                                    onClick={() => handleDeleteFolder(group.id, entry)}
                                                  >
                                                    ✕
                                                  </DeleteIconBtn>
                                                </>
                                              )}
                                            </FileActions>
                                          </FileItem>
                                        );
                                      }
                                      const typeStyle = getFileTypeStyle(entry.name);
                                      return (
                                        <FileItem key={entry.name}>
                                          <FileInfo>
                                            <FileTypeIcon $bg={typeStyle.bg}>{typeStyle.label}</FileTypeIcon>
                                            <div style={{ minWidth: 0 }}>
                                              <FileListName title={entry.name}>{entry.name}</FileListName>
                                              <FileListMeta>{formatBytes(entry.size)}</FileListMeta>
                                            </div>
                                          </FileInfo>
                                          <FileActions>
                                            <ViewIconBtn
                                              title="Προβολή"
                                              onClick={() => handleOpenFile(group.id, entry.name)}
                                            >
                                              👁
                                            </ViewIconBtn>
                                            <DownloadIconBtn
                                              title="Λήψη"
                                              onClick={() => handleDownloadFile(group.id, entry.name)}
                                            >
                                              ⬇
                                            </DownloadIconBtn>
                                            {!isReadOnly && (
                                              <>
                                                <RenameIconBtn
                                                  title="Μετονομασία"
                                                  onClick={() => handleOpenRename(group.id, entry.name)}
                                                >
                                                  ✎
                                                </RenameIconBtn>
                                                <MoveIconBtn
                                                  title="Μεταφορά σε άλλη κατηγορία"
                                                  onClick={() => handleOpenMove(group.id, entry)}
                                                >
                                                  ⇄
                                                </MoveIconBtn>
                                                <DeleteIconBtn
                                                  title="Διαγραφή"
                                                  onClick={() => handleDeleteFile(group.id, entry.name)}
                                                >
                                                  ✕
                                                </DeleteIconBtn>
                                              </>
                                            )}
                                          </FileActions>
                                        </FileItem>
                                      );
                                    })}
                                  </FilesList>
                                ) : (
                                  <EmptyGroupHint $dragging={isDragging}>
                                    {isReadOnly
                                      ? 'Δεν υπάρχουν αρχεία σε αυτή την κατηγορία'
                                      : (isDragging ? 'Αφήστε τα αρχεία εδώ…' : 'Σύρτε αρχεία εδώ ή χρησιμοποιήστε τα κουμπιά πάνω')}
                                  </EmptyGroupHint>
                                )}
                              </GroupFilesArea>
                            )}
                          </GroupCard>
                        );
                      })}
                      </GroupsList>
                    </FilesTabLayout>
                  )}

                  {/* Tab: Pending */}
                  {activeTab === 'pending' && (
                    <>
                      <SectionLabel>Εκκρεμότητες &amp; Ενέργειες</SectionLabel>
                      <PendingList>
                        {(selectedProposal.pendingItems || []).length === 0 && (
                          <div style={{ color: C.slate400, fontSize: '0.8rem', fontStyle: 'italic' }}>
                            Δεν υπάρχουν εκκρεμότητες. Προσθέστε παρακάτω.
                          </div>
                        )}
                        {(selectedProposal.pendingItems || []).map((item) => (
                          <PendingItem key={item.id} $done={item.done}>
                            <PendingCheckbox
                              type="checkbox"
                              checked={item.done}
                              disabled={isReadOnly}
                              onChange={() => togglePendingItem(item.id)}
                            />
                            <PendingText $done={item.done}>{item.text}</PendingText>
                            {!isReadOnly && (
                              <IconBtn
                                $color="#fca5a5"
                                $hoverColor="#dc2626"
                                onClick={() => deletePendingItem(item.id)}
                                title="Διαγραφή"
                              >
                                🗑
                              </IconBtn>
                            )}
                          </PendingItem>
                        ))}
                      </PendingList>
                      {!isReadOnly && (
                        <AddPendingRow>
                          <AddPendingInput
                            placeholder="Νέα εκκρεμότητα ή ενέργεια… (π.χ. Αναμονή αρχαιολογικής έκθεσης)"
                            value={pendingInput}
                            onChange={(e) => setPendingInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addPendingItem()}
                          />
                          <Btn $variant="primary" onClick={addPendingItem}>+ Προσθήκη</Btn>
                        </AddPendingRow>
                      )}
                    </>
                  )}

                  {/* Tab: Notes */}
                  {activeTab === 'notes' && (
                    <>
                      <SectionLabel>Σημειώσεις</SectionLabel>
                      <NotesTextarea
                        placeholder="Ελεύθερες σημειώσεις για την πρόταση… (κατάσταση αδειοδοτήσεων, επαφές, χρονοδιάγραμμα κ.ά.)"
                        value={selectedProposal.notes}
                        readOnly={isReadOnly}
                        onChange={isReadOnly ? undefined : (e) => updateProposal({ notes: e.target.value })}
                        style={isReadOnly ? { cursor: 'default', background: C.slate50 } : undefined}
                      />
                    </>
                  )}
                </DetailBody>

                <DetailFooter>
                  {!isReadOnly ? (
                    <Btn $sm $variant="danger" onClick={handleDeleteProposal}>
                      🗑 Διαγραφή πρότασης
                    </Btn>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: C.slate400, fontWeight: 600 }}>
                      👁 Λειτουργία προβολής — δεν επιτρέπονται αλλαγές
                    </span>
                  )}
                  {saving && <Saving>Αποθηκεύεται…</Saving>}
                </DetailFooter>
              </>
            )}
          </MainContent>
        </Body>
      </Modal>

      {folderModal && (
        <FolderModalOverlay onClick={() => setFolderModal(null)}>
          <FolderModalCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>{folderModal.label}</FolderModalTitle>
              <FolderModalSub>
                {(folderModal.files || []).length}{' '}
                {(folderModal.files || []).length === 1 ? 'αρχείο' : 'αρχεία'}
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              {(folderModal.files || []).length === 0 ? (
                <div style={{ color: C.slate400, fontSize: '0.8rem', fontStyle: 'italic' }}>
                  Ο φάκελος είναι κενός.
                </div>
              ) : (
                <FilesList>
                  {(folderModal.files || []).map((f) => (
                    <FileItem key={f.name}>
                      <FileInfo>
                        <FileTypeIcon $bg={getFileTypeStyle(f.name).bg}>
                          {getFileTypeStyle(f.name).label}
                        </FileTypeIcon>
                        <div style={{ minWidth: 0 }}>
                          <FileListName title={f.name}>{f.name}</FileListName>
                          <FileListMeta>{formatBytes(f.size)}</FileListMeta>
                        </div>
                      </FileInfo>
                      <FileActions>
                        <ViewIconBtn title="Προβολή" onClick={() => handleOpenFolderFile(f.name)}>👁</ViewIconBtn>
                        <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadFolderFile(f.name)}>⬇</DownloadIconBtn>
                        {!isReadOnly && (
                          <RenameIconBtn
                            title="Μετονομασία"
                            onClick={() => handleOpenRename(folderModal.groupId, f.name, folderModal.folderId)}
                          >
                            ✎
                          </RenameIconBtn>
                        )}
                      </FileActions>
                    </FileItem>
                  ))}
                </FilesList>
              )}
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="ghost" onClick={() => setFolderModal(null)}>Κλείσιμο</Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {renameModal && (
        <FolderModalOverlay onClick={handleCloseRename}>
          <FolderModalCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>✎ Μετονομασία αρχείου</FolderModalTitle>
              <FolderModalSub>
                Τρέχον όνομα: «{renameModal.oldName}»
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              <MetaField>
                <MetaLabel htmlFor="rename-proposal-file">Νέο όνομα{renameModal.extension ? ' (χωρίς κατάληξη)' : ''}</MetaLabel>
                <AddPendingInput
                  id="rename-proposal-file"
                  ref={renameInputRef}
                  placeholder="Νέο όνομα αρχείου"
                  value={renameModal.newName}
                  onChange={(e) => setRenameModal((m) => ({ ...m, newName: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                />
                {renameModal.extension ? (
                  <div style={{ fontSize: '0.72rem', color: C.slate500, fontWeight: 600, marginTop: '0.35rem' }}>
                    Η κατάληξη <strong>{renameModal.extension}</strong> θα διατηρηθεί αυτόματα.
                  </div>
                ) : null}
              </MetaField>
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="ghost" onClick={handleCloseRename}>Ακύρωση</Btn>
              <Btn $sm $variant="primary" onClick={handleConfirmRename}>Αποθήκευση</Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {moveModal && selectedProposal && (() => {
        const sourceGroup = (selectedProposal.fileGroups || []).find((g) => g.id === moveModal.sourceGroupId);
        const otherGroups = (selectedProposal.fileGroups || []).filter((g) => g.id !== moveModal.sourceGroupId);
        const entryLabel = moveModal.entry.name;
        const entryKindLabel = isProposalFolder(moveModal.entry) ? 'φάκελος' : 'αρχείο';
        return (
          <FolderModalOverlay onClick={() => setMoveModal(null)}>
            <FolderModalCard onClick={(e) => e.stopPropagation()}>
              <FolderModalHeader>
                <FolderModalTitle>⇄ Μεταφορά {entryKindLabel}</FolderModalTitle>
                <FolderModalSub>
                  «{entryLabel}» από «{sourceGroup?.label || '—'}»
                </FolderModalSub>
              </FolderModalHeader>
              <FolderModalBody>
                {otherGroups.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem' }}>
                    <Btn
                      $sm
                      $variant={moveModal.targetMode === 'existing' ? 'primary' : 'ghost'}
                      onClick={() => setMoveModal((m) => ({
                        ...m,
                        targetMode: 'existing',
                        targetGroupId: m.targetGroupId || otherGroups[0]?.id || '',
                      }))}
                    >
                      Υπάρχουσα κατηγορία
                    </Btn>
                    <Btn
                      $sm
                      $variant={moveModal.targetMode === 'new' ? 'primary' : 'ghost'}
                      onClick={() => setMoveModal((m) => ({ ...m, targetMode: 'new' }))}
                    >
                      Νέα κατηγορία
                    </Btn>
                  </div>
                )}

                {moveModal.targetMode === 'existing' && otherGroups.length > 0 ? (
                  <MoveTargetList>
                    {otherGroups.map((g) => (
                      <MoveTargetOption
                        key={g.id}
                        type="button"
                        $active={moveModal.targetGroupId === g.id}
                        onClick={() => setMoveModal((m) => ({ ...m, targetGroupId: g.id }))}
                      >
                        <span>{g.label}</span>
                        <span style={{ marginLeft: 'auto', color: C.slate400, fontWeight: 600 }}>
                          {g.files?.length || 0} {(g.files?.length || 0) === 1 ? 'στοιχείο' : 'στοιχεία'}
                        </span>
                      </MoveTargetOption>
                    ))}
                  </MoveTargetList>
                ) : (
                  <MetaField>
                    <MetaLabel htmlFor="move-new-category">Όνομα νέας κατηγορίας</MetaLabel>
                    <AddPendingInput
                      id="move-new-category"
                      placeholder="π.χ. Περιβαλλοντικά"
                      value={moveModal.newCategoryName}
                      onChange={(e) => setMoveModal((m) => ({ ...m, newCategoryName: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmMove()}
                      autoFocus
                    />
                  </MetaField>
                )}
              </FolderModalBody>
              <FolderModalFooter>
                <Btn $sm $variant="ghost" onClick={() => setMoveModal(null)}>Ακύρωση</Btn>
                <Btn $sm $variant="primary" onClick={handleConfirmMove}>Μεταφορά</Btn>
              </FolderModalFooter>
            </FolderModalCard>
          </FolderModalOverlay>
        );
      })()}

      {showExportDialog && selectedProposal && (
        <FolderModalOverlay onClick={() => !exporting && setShowExportDialog(false)}>
          <FolderModalCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>📤 Εξαγωγή πρότασης</FolderModalTitle>
              <FolderModalSub>
                {selectedProposal.title || 'Άτιτλος πρότασης'}
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.8rem', color: C.slate600, lineHeight: 1.5 }}>
                Θα δημιουργηθεί φάκελος με το όνομα της πρότασης, υποφάκελοι ανά κατηγορία αρχείων
                και Word με σημειώσεις και εκκρεμότητες (με επωνυμία ERGOHUB).
              </p>
              <ExportOptionRow>
                <input
                  type="checkbox"
                  checked={exportIncludeFiles}
                  onChange={(e) => setExportIncludeFiles(e.target.checked)}
                />
                <span>
                  Συμπερίληψη αρχείων και αδειοδοτήσεων
                  <div style={{ fontSize: '0.72rem', color: C.slate500, fontWeight: 600, marginTop: '0.25rem' }}>
                    Αν αποεπιλεγεί, εξάγεται μόνο το αρχείο Word με τα στοιχεία της πρότασης.
                  </div>
                </span>
              </ExportOptionRow>
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="ghost" onClick={() => setShowExportDialog(false)} disabled={exporting}>
                Ακύρωση
              </Btn>
              <Btn $sm $variant="primary" onClick={handleExportConfirm} disabled={exporting}>
                {exporting ? '⏳ Εξαγωγή…' : 'Συνέχεια…'}
              </Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {exportSuccess && (
        <ExportSuccessOverlay onClick={() => setExportSuccess(null)}>
          <ExportSuccessCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>✓ Η εξαγωγή ολοκληρώθηκε</FolderModalTitle>
              <FolderModalSub>
                Δημιουργήθηκε φάκελος με τα αρχεία και την αναφορά Word.
              </FolderModalSub>
            </FolderModalHeader>
            <ExportSuccessBody>
              Η πρόταση εξήχθη επιτυχώς στον φάκελο που επιλέξατε.
            </ExportSuccessBody>
            <ExportSuccessActions>
              <OpenFolderBtn type="button" onClick={handleOpenExportFolder}>
                ΑΝΟΙΓΜΑ ΦΑΚΕΛΟΥ
              </OpenFolderBtn>
            </ExportSuccessActions>
          </ExportSuccessCard>
        </ExportSuccessOverlay>
      )}
    </Overlay>
  );
}
