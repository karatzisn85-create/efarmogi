import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';
import {
  computeExtendedHubStats,
  buildDonutGradient,
  summarizeHistoryEntry,
  formatDateTimeEl,
  formatShortDateEl,
  isImageFileName,
  filterGroupFiles,
  countProposalFiles,
  countGroupFileEntries,
  proposalPersistFingerprint,
  PROPOSAL_ACTION_LABELS,
} from '../utils/orimanthiHelpers';
import OrimanthiFileCategoryPicker from './OrimanthiFileCategoryPicker';
import {
  FILE_CATEGORY_ROOTS,
  FILE_CATEGORY_ROOT_MELETES,
  FILE_CATEGORY_ROOT_ADEIODOTISEIS,
  DEFAULT_MELETES_SPECS,
  DEFAULT_ADEIODOTISEIS_SPECS,
  LS_CUSTOM_MELETES_SPECS,
  LS_CUSTOM_ADEIODOTISEIS_SPECS,
  loadCustomFileSpecs,
  saveCustomFileSpecs,
  getMeletesSpecs,
  getAdeiodotiseisSpecs,
  buildFileGroupPayload,
  fileGroupExists,
  getFileGroupIdentity,
  migrateProposalFileGroups,
} from '../utils/orimanthiFileCategories';
import {
  loadCustomCategoriesList,
  saveCustomCategoriesList,
  getMergedProjectCategories,
  getCustomProjectCategoriesOnly,
  isDefaultProjectCategory,
  loadCustomCategorySpecializations,
  saveCustomCategorySpecializations,
  getSpecializationsForCategory,
  categoryHasSpecializations,
  isDefaultCategorySpecialization,
  getCustomSpecsForCategory,
  getCategoriesWithCustomSpecs,
  resolveCategoryLabel,
  categoriesAreEquivalent,
  reconcilePendingTemplateCategory,
  validateProposalCategoryFields,
  shouldShowSpecializationField,
  LS_CUSTOM_CATEGORIES,
  LS_CUSTOM_CATEGORY_SPECS,
} from '../utils/orimanthiProjectCategories';
import orimanthiCatalog from '../../app/core/orimanthiCatalog';

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

const PROJECT_MATURITY_STATUSES = [
  { value: 'draft',      label: 'Αρχική καταγραφή',     color: C.slate400,  bg: C.slate100 },
  { value: 'maturing',   label: 'Υπό ωρίμανση',         color: C.amber,     bg: '#fffbeb' },
  { value: 'ready',      label: 'Πλήρως ώριμο',         color: C.teal,      bg: C.tealLight },
  { value: 'submitted',  label: 'Σε διαδικασία έγκρισης', color: C.indigo,  bg: C.indigoLight },
  { value: 'approved',   label: 'Εγκεκριμένο',          color: C.emerald,   bg: '#f0fdf4' },
  { value: 'rejected',   label: 'Απορρίφθηκε',          color: C.rose,      bg: '#fff1f2' },
];

const ADD_NEW_CATEGORY_OPTION = '__add_new_category__';
const ADD_NEW_SPECIALIZATION_OPTION = '__add_new_specialization__';

const EMPTY_NEW_PROJECT_DRAFT = {
  title: '',
  projectCategory: '',
  infrastructureSpecialization: '',
  municipalUnit: '',
  settlement: '',
  aepoRenewalDate: '',
};

function formatAepoDate(value) {
  if (!value) return '';
  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

function keepSpecializationForCategory(category, currentSpec, customSpecMap) {
  const specs = getSpecializationsForCategory(category, customSpecMap);
  const cur = String(currentSpec || '').trim();
  if (!cur || !specs.length) return '';
  return specs.some((s) => s.toLowerCase() === cur.toLowerCase()) ? cur : '';
}

const PROPOSAL_ACTIVITY_DETAIL_MAX = 500;

function clipProposalActivityDetail(detail) {
  const text = String(detail || '').trim();
  if (text.length <= PROPOSAL_ACTIVITY_DETAIL_MAX) return text;
  return `${text.slice(0, PROPOSAL_ACTIVITY_DETAIL_MAX - 1)}…`;
}

function getProjectFileCount(project) {
  return countProposalFiles(project);
}

function getProjectPendingOpen(project) {
  return (project.pendingItems || []).filter((i) => !i.done).length;
}

const HUB_UNCategorized_FILTER = '__uncategorized__';
const HUB_NO_MUNICIPAL_FILTER = '__no_municipal_unit__';
const HUB_NO_SETTLEMENT_FILTER = '__no_settlement__';

const HUB_SORT_OPTIONS = [
  { value: 'created_desc', label: 'Νεότερα πρώτα' },
  { value: 'created_asc', label: 'Παλαιότερα πρώτα' },
  { value: 'title_asc', label: 'Τίτλος Α → Ω' },
  { value: 'title_desc', label: 'Τίτλος Ω → Α' },
  { value: 'category_asc', label: 'Κατηγορία Α → Ω' },
  { value: 'municipal_unit_asc', label: 'Δημοτική ενότητα Α → Ω' },
  { value: 'settlement_asc', label: 'Οικισμός Α → Ω' },
  { value: 'status', label: 'Κατάσταση ωρίμανσης' },
  { value: 'files_desc', label: 'Περισσότερα αρχεία' },
  { value: 'aepo_asc', label: 'ΑΕΠΟ (επόμενες)' },
  { value: 'pending_desc', label: 'Περισσότερες εκκρεμότητες' },
];

function sortHubProjects(list, sortBy) {
  const statusOrder = Object.fromEntries(
    PROJECT_MATURITY_STATUSES.map((s, index) => [s.value, index])
  );
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'created_asc':
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      case 'title_asc':
        return String(a.title || '').localeCompare(String(b.title || ''), 'el');
      case 'title_desc':
        return String(b.title || '').localeCompare(String(a.title || ''), 'el');
      case 'category_asc':
        return String(a.projectCategory || 'ΩΩΩ').localeCompare(String(b.projectCategory || 'ΩΩΩ'), 'el');
      case 'municipal_unit_asc':
        return String(a.municipalUnit || 'ΩΩΩ').localeCompare(String(b.municipalUnit || 'ΩΩΩ'), 'el');
      case 'settlement_asc':
        return String(a.settlement || 'ΩΩΩ').localeCompare(String(b.settlement || 'ΩΩΩ'), 'el');
      case 'status':
        return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      case 'files_desc':
        return getProjectFileCount(b) - getProjectFileCount(a);
      case 'aepo_asc': {
        const da = a.aepoRenewalDate || '9999-12-31';
        const db = b.aepoRenewalDate || '9999-12-31';
        return da.localeCompare(db);
      }
      case 'pending_desc':
        return getProjectPendingOpen(b) - getProjectPendingOpen(a);
      case 'created_desc':
      default:
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
  });
  return sorted;
}

function getStatusStyle(value) {
  return PROJECT_MATURITY_STATUSES.find((s) => s.value === value) || PROJECT_MATURITY_STATUSES[0];
}

function formatProjectCount(count) {
  return count === 1 ? '1 έργο' : `${count} έργα`;
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

function getFolderExpandKey(groupId, folderId) {
  return `${groupId}:${folderId}`;
}

function emptyProposal() {
  return {
    id: uuidv4(),
    title: '',
    description: '',
    status: 'draft',
    projectCategory: '',
    infrastructureSpecialization: '',
    municipalUnit: '',
    settlement: '',
    aepoRenewalDate: '',
    notes: '',
    pendingItems: [],
    pendingTemplateCategory: '',
    fileGroups: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function hasProposalNotes(notes) {
  return String(notes || '').trim().length > 0;
}

function renderFileGroupTitle(group) {
  const identity = getFileGroupIdentity(group);
  const rootMeta = identity.rootId ? FILE_CATEGORY_ROOTS[identity.rootId] : null;
  if (rootMeta && identity.spec) {
    return (
      <>
        <span>{identity.spec}</span>
        <GroupRootBadge $color={rootMeta.accent}>{rootMeta.shortLabel}</GroupRootBadge>
      </>
    );
  }
  return <span>{group.label || 'Κατηγορία'}</span>;
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
const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
  background: ${(p) => (p.$formal
    ? `linear-gradient(135deg, ${C.slate800} 0%, ${C.indigoDark} 50%, ${C.teal} 100%)`
    : `linear-gradient(135deg, ${C.teal} 0%, ${C.indigo} 55%, ${C.violet} 100%)`)};
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.25);

  &::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${C.teal}, ${C.emerald}, ${C.indigo}, ${C.violet});
    opacity: 0.85;
  }

  &::after {
    content: '';
    position: absolute;
    top: -40%; right: -5%;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    pointer-events: none;
  }
`;

const HeaderTitle = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  z-index: 1;
`;
const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255,255,255,0.2);
  width: 46px; height: 46px;
  border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.28);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

const HeaderPrimaryBtn = styled.button`
  color: white;
  background: linear-gradient(135deg, ${C.teal} 0%, ${C.emerald} 100%);
  border: 1px solid rgba(255,255,255,0.25);
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

const HeaderActionBtn = styled.button`
  color: white;
  background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.12) 100%);
  border: 1px solid rgba(255,255,255,0.35);
  padding: 0.42rem 0.85rem;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  transition: all 0.2s;
  z-index: 1;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
  &:hover:not(:disabled) {
    background: rgba(255,255,255,0.32);
    transform: translateY(-1px);
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, #eef2ff 0%, ${C.slate50} 35%, ${C.slate50} 100%);
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

const HubViewToggle = styled.div`
  display: inline-flex;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  overflow: hidden;
  background: ${C.white};
`;
const HubViewBtn = styled.button`
  padding: 0.48rem 0.72rem;
  border: none;
  background: ${(p) => (p.$active
    ? `linear-gradient(135deg, ${C.indigo} 0%, ${C.indigoDark} 100%)`
    : 'transparent')};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  box-shadow: ${(p) => (p.$active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none')};
  &:hover {
    background: ${(p) => (p.$active
      ? `linear-gradient(135deg, ${C.indigoDark} 0%, ${C.violet} 100%)`
      : C.indigoLight)};
    color: ${(p) => (p.$active ? C.white : C.indigoDark)};
  }
`;
const HubSkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.85rem;
`;
const HubSkeletonCard = styled.div`
  height: 148px;
  border-radius: 12px;
  background: linear-gradient(90deg, ${C.slate100} 25%, ${C.slate200} 50%, ${C.slate100} 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.2s ease-in-out infinite;
`;
const HubKanban = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
  align-items: start;
`;
const KanbanColumn = styled.div`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  min-height: 120px;
  overflow: hidden;
`;
const KanbanColumnHeader = styled.div`
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid ${C.slate200};
  background: ${(p) => p.$bg || C.slate50};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;
const KanbanColumnTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${(p) => p.$color || C.slate700};
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;
const KanbanColumnCount = styled.span`
  font-size: 0.65rem;
  font-weight: 800;
  color: ${C.slate500};
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 999px;
  padding: 0.1rem 0.4rem;
`;
const KanbanColumnBody = styled.div`
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: min(62vh, 520px);
  overflow-y: auto;
`;
const FileSearchPanel = styled.div`
  margin-bottom: 0.85rem;
  border: 1px solid ${C.indigo}33;
  border-radius: 14px;
  background: ${C.white};
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.1);
`;
const FileSearchPanelHead = styled.div`
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid ${C.indigo}22;
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.indigoDark};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, ${C.indigoLight} 0%, ${C.white} 100%);
`;
const FileSearchResults = styled.div`
  max-height: 220px;
  overflow-y: auto;
`;
const FileSearchRow = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px solid ${C.slate100};
  background: ${C.white};
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
  &:hover { background: ${C.indigoLight}; }
  &:last-child { border-bottom: none; }
`;
const FileSearchRowTitle = styled.div`
  font-size: 0.76rem;
  font-weight: 800;
  color: ${C.slate800};
  margin-bottom: 0.15rem;
`;
const FileSearchRowMeta = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.35;
`;
const HubShell = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.5rem 1.35rem;
  min-height: 0;
`;
const HubControlsPanel = styled.div`
  position: sticky;
  top: 0;
  z-index: 4;
  margin-bottom: 1rem;
  padding: 0.9rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(238,242,255,0.92) 100%);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1), inset 0 1px 0 rgba(255,255,255,0.8);
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
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${C.teal}, ${C.indigo}, ${C.violet});
  }
`;
const HubIntro = styled.div`
  margin-bottom: 1rem;
`;
const HubIntroTitle = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: ${C.slate900};
`;
const HubIntroSub = styled.p`
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.45;
  max-width: 720px;
`;
const HubToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin-bottom: 1rem;
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
  &:focus { border-color: ${C.indigo}; box-shadow: 0 0 0 3px ${C.indigoLight}; }
`;
const HubToolbarActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-left: auto;
`;
const HubStatsBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, ${C.indigo} 0%, ${C.violet} 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  }
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
const HubFiltersToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid ${(p) => (p.$active ? C.indigo : C.slate200)};
  border-radius: 10px;
  background: ${(p) => (p.$active
    ? `linear-gradient(135deg, ${C.indigoLight}, ${C.white})`
    : C.white)};
  color: ${(p) => (p.$active ? C.indigoDark : C.slate700)};
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  box-shadow: ${(p) => (p.$active ? '0 3px 10px rgba(99,102,241,0.15)' : 'none')};
  &:hover { border-color: ${C.indigo}; color: ${C.indigoDark}; }
`;
const HubFiltersPanel = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.85rem;
  border: 1px dashed ${C.indigo}55;
  border-radius: 12px;
  background: linear-gradient(180deg, ${C.indigoLight}44 0%, ${C.white} 100%);
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  animation: ${fadeIn} 0.2s ease;
`;
const HubSummaryBar = styled.button`
  width: 100%;
  text-align: left;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
  border: 1px solid ${C.indigo}33;
  border-radius: 12px;
  background: linear-gradient(135deg, ${C.white} 0%, ${C.indigoLight} 100%);
  font-size: 0.72rem;
  font-weight: 600;
  color: ${C.slate600};
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
  &:hover {
    border-color: ${C.indigo};
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
    transform: translateY(-1px);
  }
  strong { color: ${C.indigoDark}; font-weight: 800; }
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
    ? `linear-gradient(135deg, ${C.indigo} 0%, ${C.indigoDark} 100%)`
    : C.white)};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s;
  box-shadow: ${(p) => (p.$active ? '0 3px 12px rgba(99,102,241,0.35)' : '0 1px 3px rgba(15,23,42,0.04)')};
  &:hover {
    border-color: ${C.indigo};
    ${(p) => !p.$active && css`background: ${C.indigoLight}; color: ${C.indigoDark};`}
    transform: translateY(-1px);
  }
`;
const HubListWrap = styled.div`
  background: ${C.white};
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
`;
const HubListHead = styled.div`
  display: grid;
  grid-template-columns: ${(p) => p.$gridColumns};
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  background: linear-gradient(90deg, ${C.slate800} 0%, ${C.indigoDark} 100%);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.88);
`;
const HubListRow = styled.div`
  display: grid;
  grid-template-columns: ${(p) => p.$gridColumns};
  gap: 0.5rem;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid ${C.slate100};
  font-size: 0.76rem;
  transition: all 0.15s;
  &:nth-child(even) { background: ${C.slate50}99; }
  &:last-child { border-bottom: none; }
  &:hover {
    background: linear-gradient(90deg, ${C.indigoLight}88 0%, ${C.tealLight}66 100%);
    box-shadow: inset 4px 0 0 ${C.indigo};
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
const HubRowStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: ${(p) => p.$color || C.slate600};
  white-space: nowrap;
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
    background: linear-gradient(135deg, ${C.teal} 0%, ${C.indigo} 100%);
    color: white;
    border: none;
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3);
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 5px 14px rgba(99, 102, 241, 0.4);
      color: white;
    }
  `}
  &:hover:not(:disabled) {
    border-color: ${C.indigo};
    color: ${C.indigoDark};
    background: ${C.indigoLight};
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
    border-color: ${C.indigo};
    box-shadow: 0 0 0 3px ${C.indigoLight}, inset 0 1px 3px rgba(15, 23, 42, 0.04);
  }
`;
const HubStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
`;
const HubStatChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate600};
`;
const HubGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
`;
const HubCard = styled.div`
  text-align: left;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 0;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
  animation: ${fadeIn} 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  &:hover {
    border-color: ${C.indigo}55;
    box-shadow: 0 10px 28px rgba(99, 102, 241, 0.12);
    transform: translateY(-2px);
  }
`;
const HubCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.85rem 0.9rem 0.55rem;
  border-bottom: 1px solid ${C.slate100};
  background: linear-gradient(180deg, ${C.indigoLight}55 0%, ${C.white} 100%);
`;
const HubCardStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.5rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  color: ${(p) => p.$color || C.slate600};
  background: ${(p) => p.$bg || C.slate100};
  white-space: nowrap;
  flex-shrink: 0;
`;
const HubCardBody = styled.div`
  padding: 0.65rem 0.9rem 0.75rem;
  flex: 1;
  min-width: 0;
`;
const HubCardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  border-top: 1px solid ${C.slate100};
  background: ${C.slate50};
`;
const HubCardMetaLine = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.4;
  margin-top: 0.35rem;
`;
const HubCardStat = styled.span`
  font-size: 0.64rem;
  font-weight: 700;
  color: ${C.slate500};
`;
const HubCardExportLink = styled.button`
  border: none;
  background: transparent;
  color: ${C.indigoDark};
  font-size: 0.66rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  padding: 0.15rem 0.25rem;
  border-radius: 4px;
  &:hover { background: ${C.indigoLight}; }
  &:disabled { opacity: 0.45; cursor: wait; }
`;
const HubCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
`;
const HubCardClickArea = styled.button`
  flex: 1;
  min-width: 0;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
`;
const HubCardExportBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid ${C.slate200};
  background: ${C.slate50};
  color: ${C.slate600};
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${C.indigoLight};
    border-color: ${C.indigo};
    color: ${C.indigoDark};
  }
  &:disabled { opacity: 0.45; cursor: wait; }
`;
const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.65rem;
  margin-bottom: 1rem;
`;
const StatsCard = styled.div`
  background: ${C.slate50};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 0.8rem 0.85rem;
`;
const StatsCardValue = styled.div`
  font-size: 1.4rem;
  font-weight: 900;
  color: ${C.indigoDark};
  line-height: 1.1;
`;
const StatsCardLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate500};
  margin-top: 0.25rem;
  line-height: 1.3;
`;
const StatsSectionTitle = styled.h4`
  margin: 0 0 0.55rem;
  font-size: 0.78rem;
  font-weight: 800;
  color: ${C.slate700};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;
const StatsBreakdown = styled.div`
  margin-bottom: 1rem;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  overflow: hidden;
  background: ${C.white};
`;
const StatsBreakdownRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid ${C.slate100};
  font-size: 0.76rem;
  font-weight: 600;
  color: ${C.slate700};
  &:last-child { border-bottom: none; }
`;
const StatsBreakdownCount = styled.span`
  font-weight: 800;
  color: ${C.indigoDark};
  background: ${C.indigoLight};
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
`;
const StatsDonutRow = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;
const StatsDonutBlock = styled.div`
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  background: ${C.white};
`;
const StatsDonut = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${(p) => p.$gradient || C.slate200};
  position: relative;
  flex-shrink: 0;
  &::after {
    content: '';
    position: absolute;
    inset: 14px;
    border-radius: 50%;
    background: ${C.white};
  }
`;
const StatsDonutLegend = styled.div`
  flex: 1;
  min-width: 0;
`;
const StatsDonutLegendItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.2rem 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  color: ${C.slate700};
  text-align: left;
  &:hover { color: ${C.indigoDark}; }
`;
const StatsDonutDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$color || C.slate400};
  flex-shrink: 0;
  margin-right: 0.35rem;
`;
const StatsInsightList = styled.div`
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1rem;
  background: ${C.white};
`;
const StatsInsightRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border: none;
  border-bottom: 1px solid ${C.slate100};
  background: ${C.white};
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  &:hover { background: ${C.indigoLight}; }
  &:last-child { border-bottom: none; }
`;
const StatsInsightMain = styled.div`
  font-size: 0.74rem;
  font-weight: 700;
  color: ${C.slate800};
  min-width: 0;
  word-break: break-word;
`;
const StatsInsightSub = styled.div`
  font-size: 0.64rem;
  font-weight: 600;
  color: ${C.slate500};
  margin-top: 0.12rem;
`;
const StatsClickableRow = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: none;
  border-bottom: 1px solid ${C.slate100};
  background: ${C.white};
  font-size: 0.76rem;
  font-weight: 600;
  color: ${C.slate700};
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
  &:last-child { border-bottom: none; }
  &:hover { background: ${C.indigoLight}; }
`;
const BreadcrumbBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0;
  font-size: 0.74rem;
  font-weight: 600;
  color: ${C.slate500};
  min-width: 0;
  flex: 1;
`;
const DetailTopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(90deg, ${C.indigoLight} 0%, ${C.tealLight} 100%);
  border-bottom: 2px solid ${C.indigo}33;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1);
  flex-shrink: 0;
`;
const BackToHubBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border: none;
  border-radius: 11px;
  background: linear-gradient(135deg, ${C.indigo} 0%, ${C.indigoDark} 100%);
  color: white;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    background: linear-gradient(135deg, ${C.indigoDark} 0%, ${C.violet} 100%);
  }
`;
const BackToHubIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(255,255,255,0.2);
  font-size: 0.85rem;
  line-height: 1;
`;
const BreadcrumbLink = styled.button`
  border: none;
  background: transparent;
  color: ${C.indigoDark};
  font-size: inherit;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  &:hover { text-decoration: underline; }
`;
const BreadcrumbSep = styled.span`color: ${C.slate300};`;
const BreadcrumbCurrent = styled.span`
  color: ${C.slate800};
  font-weight: 800;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const StickyDetailHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 5;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid ${C.slate200};
  box-shadow: 0 6px 28px rgba(15, 23, 42, 0.08);
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${C.teal}, ${C.indigo}, ${C.violet});
  }
`;
const StickyTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem 0.5rem;
  min-width: 0;
`;
const StickyTitleText = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 1rem;
  font-weight: 800;
  color: ${C.slate900};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.02em;
`;
const DetailStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  color: ${(p) => p.$color || C.slate600};
  background: ${(p) => p.$bg || C.slate100};
  border: 1px solid ${(p) => p.$color || C.slate300}22;
  white-space: nowrap;
  flex-shrink: 0;
`;
const MetaToggleBtn = styled.button`
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate600};
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.18s;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  &:hover {
    border-color: ${C.indigo};
    color: ${C.indigoDark};
    background: ${C.indigoLight};
  }
`;
const DetailScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 50%, #f1f5f9 100%);
  padding: 0.85rem 1.25rem 1rem;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: ${C.indigo}55; border-radius: 99px; }
`;
const MetaCollapsible = styled.div`
  animation: ${fadeIn} 0.22s ease;
`;
const MetaCompactPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;
const MetaCompactRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.55rem;
`;
const MetaSection = styled.section`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 0.85rem 1rem;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
`;
const MetaSectionTitle = styled.h4`
  margin: 0 0 0.55rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${C.slate500};
  letter-spacing: 0.02em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  &::before {
    content: '';
    width: 3px;
    height: 12px;
    border-radius: 99px;
    background: linear-gradient(180deg, ${C.indigo}, ${C.teal});
    flex-shrink: 0;
  }
`;
const MetaFieldBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.5rem 0.6rem;
  background: ${C.slate50};
  border: 1px solid ${C.slate100};
  border-radius: 10px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  &:focus-within {
    border-color: ${C.indigo}55;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
    background: ${C.white};
  }
`;
const MetaFieldBoxWide = styled(MetaFieldBox)`
  grid-column: 1 / -1;
`;
const DetailFileFilter = styled.input`
  flex: 1;
  min-width: 180px;
  max-width: 340px;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.76rem;
  font-weight: 600;
  color: ${C.slate700};
  outline: none;
  box-sizing: border-box;
  background: ${C.white};
  transition: border-color 0.18s, box-shadow 0.18s;
  &:focus {
    border-color: ${C.indigo};
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  }
  &::placeholder { color: ${C.slate400}; font-weight: 500; }
`;
const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;
const HistoryItem = styled.div`
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  background: ${C.slate50};
  transition: background 0.15s;
  &:hover { background: ${C.white}; }
`;
const HistoryItemHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
`;
const HistoryAction = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.indigoDark};
  letter-spacing: 0.01em;
`;
const HistoryTime = styled.span`
  font-size: 0.64rem;
  font-weight: 600;
  color: ${C.slate400};
`;
const HistoryBody = styled.div`
  font-size: 0.74rem;
  font-weight: 600;
  color: ${C.slate700};
  line-height: 1.45;
`;
const HistoryUser = styled.div`
  font-size: 0.64rem;
  font-weight: 600;
  color: ${C.slate500};
  margin-top: 0.25rem;
`;
const NotesPreview = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.82rem;
  font-weight: 500;
  color: ${C.slate700};
  line-height: 1.6;
  padding: 1rem 1.1rem;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  background: linear-gradient(180deg, ${C.slate50} 0%, ${C.white} 100%);
  margin-bottom: 0.75rem;
  min-height: 3rem;
`;
const HubCardTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: ${C.slate900};
  line-height: 1.35;
  word-break: break-word;
  margin-bottom: 0.55rem;
`;
const HubCardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.45rem;
`;
const HubCardBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  color: ${(p) => p.$color || C.slate600};
  background: ${(p) => p.$bg || C.slate100};
`;
const HubCardLine = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.35;
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
const FabButton = styled.button`
  position: absolute;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.85rem 1.35rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, ${C.teal}, ${C.indigo});
  color: white;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(13, 148, 136, 0.35);
  transition: transform 0.18s, box-shadow 0.18s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 32px rgba(99, 102, 241, 0.35);
  }
`;
const DetailBackBar = styled.div`
  padding: 0.65rem 1rem;
  border-bottom: 1px solid ${C.slate200};
  background: ${C.white};
  flex-shrink: 0;
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
const NewProjectModalHeader = styled.div`
  padding: 1.15rem 1.35rem 1rem;
  background: linear-gradient(135deg, ${C.indigoDark} 0%, ${C.indigo} 52%, ${C.violet} 100%);
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
const NewProjectModalTitle = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: ${C.white};
  letter-spacing: -0.01em;
`;
const NewProjectModalSub = styled.p`
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
  background-image: linear-gradient(180deg, ${C.white} 0%, ${C.slate50} 100%);
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: ${C.slate800};
  font-weight: 600;
  &:hover {
    border-color: ${C.slate300};
    background-color: ${C.white};
    background-image: linear-gradient(180deg, ${C.white} 0%, ${C.white} 100%);
  }
  &:focus {
    border-color: ${C.indigo};
    background-color: ${C.white};
    background-image: none;
    box-shadow: 0 0 0 3px ${C.indigoLight}, 0 2px 10px rgba(99, 102, 241, 0.14);
    outline: none;
  }
  &::placeholder { color: ${C.slate400}; font-weight: 500; }
`;
const ModalFormSection = styled.section`
  background: linear-gradient(145deg, ${C.slate50} 0%, ${C.white} 52%, ${C.indigoLight}33 100%);
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 1rem 1.05rem 1.05rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 4px 18px rgba(15, 23, 42, 0.05);
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
  background: linear-gradient(135deg, ${C.indigoLight}, ${C.white});
  border: 1px solid ${C.indigo}33;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.12);
`;
const ModalFormSectionTitle = styled.h4`
  margin: 0;
  font-size: 0.74rem;
  font-weight: 800;
  color: ${C.indigoDark};
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
    border-color: ${C.indigo}55;
    box-shadow: 0 0 0 3px ${C.indigoLight}, 0 3px 10px rgba(99, 102, 241, 0.1);
  }
`;
const ModalFormFieldFull = styled(ModalFormField)`
  grid-column: 1 / -1;
`;
const ModalFormInput = styled.input`
  ${modalFieldControlStyles}
`;
const selectChevronSvg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")";
const ModalFormSelect = styled.select`
  ${modalFieldControlStyles}
  cursor: pointer;
  appearance: none;
  padding-right: 2rem;
  background-image: ${selectChevronSvg}, linear-gradient(180deg, ${C.white} 0%, ${C.slate50} 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: right 0.75rem center, center;
  background-size: 12px 12px, 100% 100%;
  &:hover {
    background-image: ${selectChevronSvg}, linear-gradient(180deg, ${C.white} 0%, ${C.white} 100%);
    background-repeat: no-repeat, no-repeat;
    background-position: right 0.75rem center, center;
    background-size: 12px 12px, 100% 100%;
  }
  &:focus {
    background-image: ${selectChevronSvg};
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 12px 12px;
  }
`;
const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 0.85rem;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`;
const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
`;
const FormFieldFull = styled(FormField)`
  grid-column: 1 / -1;
`;
const InlineAddRow = styled.div`
  display: flex;
  gap: 0.35rem;
  align-items: center;
  margin-top: 0.35rem;
`;
const MetaLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;
const ManageListsLink = styled.button`
  border: none;
  background: transparent;
  color: ${C.indigoDark};
  font-size: 0.64rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  padding: 0.1rem 0.2rem;
  border-radius: 4px;
  white-space: nowrap;
  &:hover { text-decoration: underline; background: ${C.indigoLight}; }
`;
const ManageListSection = styled.div`
  margin-bottom: 1rem;
  &:last-child { margin-bottom: 0; }
`;
const ManageListSectionTitle = styled.h4`
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.slate700};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;
const ManageListEmpty = styled.div`
  font-size: 0.76rem;
  font-weight: 600;
  color: ${C.slate400};
  font-style: italic;
  padding: 0.5rem 0;
`;
const ManageListRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  background: ${C.white};
  margin-bottom: 0.4rem;
  &:last-child { margin-bottom: 0; }
`;
const ManageListRowLabel = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: ${C.slate800};
  word-break: break-word;
`;
const ManageListRowMeta = styled.div`
  font-size: 0.66rem;
  font-weight: 600;
  color: ${C.slate500};
  white-space: nowrap;
`;
const ManageListDeleteBtn = styled.button`
  flex-shrink: 0;
  border: 1px solid ${C.rose}44;
  background: #fff1f2;
  color: ${C.rose};
  border-radius: 8px;
  padding: 0.28rem 0.55rem;
  font-size: 0.66rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  &:hover { background: #ffe4e6; border-color: ${C.rose}; }
  &:disabled { opacity: 0.45; cursor: wait; }
`;
const StagedFilesBox = styled.div`
  margin-top: 0.75rem;
  border: 1px dashed ${C.slate300};
  border-radius: 12px;
  padding: 0.75rem;
  background: ${C.slate50};
`;
const StagedFilesHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
`;
const StagedFilesTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.slate700};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;
const NewProjectFilesSection = styled(StagedFilesBox)`
  margin-top: 0.9rem;
  border: 1px solid ${C.indigo}33;
  border-radius: 14px;
  padding: 1rem 1.05rem;
  background: linear-gradient(180deg, ${C.indigoLight}55 0%, ${C.white} 38%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 4px 16px rgba(99, 102, 241, 0.07);
`;
const NewProjectFilesTitle = styled(StagedFilesTitle)`
  color: ${C.indigoDark};
  font-size: 0.74rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  &::before {
    content: '📁';
    font-size: 0.82rem;
  }
`;
const StagedFileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid ${C.slate200};
  font-size: 0.74rem;
  font-weight: 600;
  color: ${C.slate700};
  &:last-child { border-bottom: none; }
`;

/* ── Main content ── */
const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
`;
const EmptyState = styled.div`
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: ${C.slate400}; gap: 0.75rem;
`;
const EmptyStateIcon = styled.div`font-size: 3.5rem; opacity: 0.5;`;
const EmptyStateText = styled.div`font-size: 0.88rem; font-weight: 600;`;
const EmptyStateSub = styled.div`
  margin-top: 0.45rem;
  max-width: 420px;
  font-size: 0.76rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.45;
`;

/* ── Proposal detail (tabs) ── */
const DetailHeader = styled.div`
  padding: 0.7rem 1.25rem 0;
  background: linear-gradient(180deg, ${C.slate50} 0%, ${C.white} 70%);
  border-bottom: 1px solid ${C.slate200};
  flex-shrink: 0;
`;
const TitleRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
`;
const TitleInput = styled.input`
  flex: 1;
  min-width: 0;
  width: 100%;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${C.slate900};
  outline: none;
  background: transparent;
  border: none;
  padding: 0;
  box-sizing: border-box;
  letter-spacing: -0.02em;
  line-height: 1.35;
  &::placeholder { color: ${C.slate400}; font-weight: 500; }
  &:read-only {
    cursor: default;
    color: ${C.slate800};
  }
`;
const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;
const MetaGridThree = styled(MetaGrid)`
  grid-template-columns: repeat(3, minmax(0, 1fr));
  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;
const MetaField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
`;
const MetaLabel = styled.label`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${C.slate500};
  letter-spacing: 0.01em;
  line-height: 1.3;
`;
/* Keep MetaRowLabel for backward compat in JSX we haven't replaced yet */
const MetaRowLabel = MetaLabel;
const metaControlStyles = css`
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 0.8rem;
  min-width: 0;
  box-sizing: border-box;
  transition: border-color 0.18s, background 0.18s;
  background: transparent;
  &:focus {
    border-color: ${C.indigo}44;
    background: ${C.white};
    outline: none;
  }
  &::placeholder { color: ${C.slate400}; font-weight: 500; }
`;
const StatusSelect = styled.select`
  ${metaControlStyles}
  font-weight: 600;
  color: ${(p) => p.$color || C.slate700};
  background: ${(p) => p.$bg || 'transparent'};
  cursor: pointer;
  &:disabled { opacity: 0.75; cursor: default; }
`;
const MetaInput = styled.input`
  ${metaControlStyles}
  color: ${C.slate800};
  font-weight: 600;
  &:read-only { cursor: default; opacity: 0.9; }
`;
const DescriptionInput = styled.input`
  ${metaControlStyles}
  color: ${C.slate800};
  font-weight: 500;
  &:read-only { cursor: default; }
`;
const FormSelect = styled.select`
  ${metaControlStyles}
  background: ${C.white};
  font-weight: 600;
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
`;
const FormInput = styled.input`
  ${metaControlStyles}
  background: ${C.white};
  font-weight: 600;
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
`;
const TabBar = styled.div`
  display: flex;
  gap: 0.2rem;
  padding: 0.35rem;
  margin: 0 1.25rem 0.6rem;
  background: linear-gradient(180deg, ${C.slate100} 0%, ${C.indigoLight}44 100%);
  border-radius: 14px;
  border: 1px solid ${C.indigo}22;
  overflow-x: auto;
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04);
  &::-webkit-scrollbar { height: 0; }
`;
const Tab = styled.button`
  flex: 1 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: 10px;
  background: ${(p) => (p.$active
    ? `linear-gradient(135deg, ${C.white} 0%, ${C.indigoLight} 100%)`
    : 'transparent')};
  color: ${(p) => (p.$active ? C.indigoDark : C.slate500)};
  font-size: 0.7rem;
  font-weight: ${(p) => (p.$active ? '800' : '600')};
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
  box-shadow: ${(p) => (p.$active ? '0 3px 12px rgba(99,102,241,0.18), inset 0 -2px 0 ' + C.indigo : 'none')};
  white-space: nowrap;
  min-width: 0;
  &:hover {
    color: ${C.indigoDark};
    background: ${(p) => (p.$active
      ? `linear-gradient(135deg, ${C.white} 0%, ${C.indigoLight} 100%)`
      : 'rgba(255,255,255,0.65)')};
  }
  ${(p) => p.$hasContent && !p.$active && css`
    color: ${C.amber};
  `}
`;
const TabIndicator = styled.span`
  width: 7px; height: 7px;
  border-radius: 50%;
  background: ${C.amber};
  flex-shrink: 0;
`;

const DetailBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${C.white};
  border: 1px solid ${C.indigo}22;
  border-top: 3px solid ${C.indigo};
  border-radius: 16px;
  padding: 1rem 1.1rem 1.1rem;
  box-shadow: 0 10px 36px rgba(15, 23, 42, 0.08);
  animation: ${fadeIn} 0.2s ease;
`;

/* ── File Groups tab layout ── */
const FilesTabLayout = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;
const AddGroupToolbar = styled.div`
  flex-shrink: 0;
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.65rem;
  background: linear-gradient(135deg, ${C.tealLight} 0%, ${C.indigoLight} 100%);
  border: 1px solid ${C.indigo}33;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
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
const GroupsList = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
  flex: 1;
`;
const GroupsToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
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
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
    border-color: ${C.indigo}44;
    transform: translateY(-1px);
  }
`;
const GroupCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, ${C.indigoLight}88 0%, ${C.white} 100%);
  border-bottom: 1px solid ${(p) => (p.$open ? C.indigo + '33' : 'transparent')};
  cursor: pointer;
  user-select: none;
  transition: background 0.18s;
  &:hover { background: ${C.slate50}; }
`;
const GroupName = styled.div`
  font-size: 0.84rem;
  font-weight: 700;
  color: ${C.slate800};
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  flex: 1;
  & > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
const GroupRootBadge = styled.span`
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.38rem;
  border-radius: 999px;
  background: ${(p) => `${p.$color}18`};
  color: ${(p) => p.$color};
  border: 1px solid ${(p) => `${p.$color}33`};
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
const FolderEntryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
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
const FolderHeaderItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: ${(p) => (p.$open ? C.indigoLight + '66' : C.white)};
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$open ? C.indigo + '55' : C.slate200)};
  transition: box-shadow 0.18s, border-color 0.18s, background 0.18s;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
  &:hover {
    border-color: ${C.indigo}44;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
  }
`;
const NestedFilesTree = styled.div`
  margin: 0.35rem 0 0.55rem 0.5rem;
  padding: 0.35rem 0 0.15rem 1.1rem;
  border-left: 2px solid ${C.indigo}44;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;
const NestedFileItem = styled(FileItem)`
  position: relative;
  background: ${C.slate50};
  &::before {
    content: '';
    position: absolute;
    left: -1.1rem;
    top: 50%;
    width: 0.85rem;
    height: 2px;
    background: ${C.indigo}44;
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
const FileTypeIconLarge = styled(FileTypeIcon)`
  width: 42px;
  height: 42px;
  font-size: 0.72rem;
  border-radius: 10px;
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
  display: flex; align-items: center; gap: 0.65rem;
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
const PendingDeleteBtn = styled(DeleteIconBtn)`
  color: ${C.rose};
  border-color: #fecaca;
  background: #fff1f2;
  font-size: 0.82rem;
  font-weight: 800;
  &:hover {
    background: #fee2e2;
    color: #b91c1c;
    border-color: #fca5a5;
    box-shadow: 0 2px 8px rgba(244, 63, 94, 0.25);
  }
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
  font-size: 0.76rem;
  font-weight: 700;
  color: ${C.slate600};
  letter-spacing: 0.01em;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${C.slate100};
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
  padding: 0.85rem 1.25rem;
  border-top: 2px solid ${C.rose}22;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: linear-gradient(180deg, ${C.white} 0%, #fff1f2 100%);
  box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.04);
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

  const isReadOnly = orimanthiCatalog.isOrimanthiReadOnly({ role: userRole, orimanthiCanEdit });

  const [proposals, setProposals] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [search, setSearch] = useState('');
  const [hubCategoryFilter, setHubCategoryFilter] = useState('');
  const [hubStatusFilter, setHubStatusFilter] = useState('');
  const [hubMunicipalUnitFilter, setHubMunicipalUnitFilter] = useState('');
  const [hubSettlementFilter, setHubSettlementFilter] = useState('');
  const [hubSortBy, setHubSortBy] = useState('created_desc');
  const [showHubStatsModal, setShowHubStatsModal] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [hubViewMode, setHubViewMode] = useState('list');
  const [showHubFiltersPanel, setShowHubFiltersPanel] = useState(false);
  const [hubQuickFilter, setHubQuickFilter] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState([]);
  const [fileSearchLoading, setFileSearchLoading] = useState(false);
  const [detailFileFilter, setDetailFileFilter] = useState('');
  const [projectHistory, setProjectHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  // Per-group expand state (default: collapsed)
  const [expandedGroups, setExpandedGroups] = useState({});

  // New project modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectDraft, setNewProjectDraft] = useState(EMPTY_NEW_PROJECT_DRAFT);
  const [newProjectStagedGroups, setNewProjectStagedGroups] = useState([]);
  const [newProjectShowCategoryPicker, setNewProjectShowCategoryPicker] = useState(false);
  const [newProjectExpandedGroups, setNewProjectExpandedGroups] = useState({});
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newSpecializationInput, setNewSpecializationInput] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [showAddSpecializationInput, setShowAddSpecializationInput] = useState(false);
  const [detailShowAddCategoryInput, setDetailShowAddCategoryInput] = useState(false);
  const [detailNewCategoryInput, setDetailNewCategoryInput] = useState('');
  const [detailShowAddSpecializationInput, setDetailShowAddSpecializationInput] = useState(false);
  const [detailNewSpecializationInput, setDetailNewSpecializationInput] = useState('');
  const [detailShowSpecializationField, setDetailShowSpecializationField] = useState(false);
  const [newProjectShowSpecializationField, setNewProjectShowSpecializationField] = useState(false);
  const [showManageListsModal, setShowManageListsModal] = useState(false);
  const [removingListItem, setRemovingListItem] = useState('');
  const [projectCategories, setProjectCategories] = useState(() =>
    getMergedProjectCategories(loadCustomCategoriesList())
  );
  const [customCategorySpecs, setCustomCategorySpecs] = useState(() =>
    loadCustomCategorySpecializations()
  );
  const [manageSpecCategory, setManageSpecCategory] = useState('');
  const [manageSpecInput, setManageSpecInput] = useState('');
  const [customMeletesFileSpecs, setCustomMeletesFileSpecs] = useState(() =>
    loadCustomFileSpecs(LS_CUSTOM_MELETES_SPECS)
  );
  const [customAdeiodotiseisFileSpecs, setCustomAdeiodotiseisFileSpecs] = useState(() =>
    loadCustomFileSpecs(LS_CUSTOM_ADEIODOTISEIS_SPECS)
  );
  const newProjectTitleRef = useRef(null);

  // Add group UI
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Pending item input
  const [pendingInput, setPendingInput] = useState('');

  // Drag state / folder expansion
  const [expandedFolderKeys, setExpandedFolderKeys] = useState({});
  const [folderFilesCache, setFolderFilesCache] = useState({});
  const [nestedFileHighlight, setNestedFileHighlight] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const renameInputRef = useRef(null);
  const [draggingGroupId, setDraggingGroupId] = useState(null);

  // Export
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportIncludeFiles, setExportIncludeFiles] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);
  const [exportMissingExpanded, setExportMissingExpanded] = useState(false);
  const [exportTargetId, setExportTargetId] = useState(null);
  const [uploadingGroupId, setUploadingGroupId] = useState(null);
  const [detailFolderFilterMatches, setDetailFolderFilterMatches] = useState(() => new Set());
  const [unsavedNavModal, setUnsavedNavModal] = useState(null);
  const [proposalLocks, setProposalLocks] = useState({});
  const [showAepoSettingsModal, setShowAepoSettingsModal] = useState(false);
  const [orimanthiConfig, setOrimanthiConfig] = useState(null);
  const [orimanthiListsSynced, setOrimanthiListsSynced] = useState(false);
  const [municipalUnits, setMunicipalUnits] = useState([]);
  const [hubReportExporting, setHubReportExporting] = useState(false);
  const [applyingPendingTemplate, setApplyingPendingTemplate] = useState(false);

  const saveTimerRef = useRef(null);
  const pendingSaveProjectIdRef = useRef(null);
  const pendingSaveAuditedRef = useRef(false);
  const prevSelectedIdRef = useRef(null);
  const saveChainRef = useRef(Promise.resolve());
  const blockedProposalSavesRef = useRef(null);
  const pendingFileSearchNavRef = useRef(null);
  const highlightedFolderFileRef = useRef(null);
  const fileSearchSeqRef = useRef(0);
  const fileSearchTimerRef = useRef(null);
  const persistedSnapshotsRef = useRef({});
  const lockedProposalIdRef = useRef(null);
  // Ref που κρατά πάντα το τελευταίο state proposals χωρίς να δημιουργεί νέα closure
  const proposalsRef = useRef([]);

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingProposals(true);
      try {
        const res = await window.electronAPI.invoke('load-all-proposals');
        if (res.success) {
          const list = (res.proposals || []).map(migrateProposalFileGroups);
          setProposals(list);
          proposalsRef.current = list;
          list.forEach((p) => {
            if (p?.id) {
              persistedSnapshotsRef.current[p.id] = JSON.parse(JSON.stringify(p));
            }
          });
        } else {
          showToast(res.error || 'Σφάλμα φόρτωσης έργων ωρίμανσης', 'error');
        }
      } catch (e) {
        showToast(`Σφάλμα φόρτωσης έργων: ${e.message}`, 'error');
      } finally {
        setLoadingProposals(false);
      }
    })();
  }, [showToast]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI.invoke('get-orimanthi-config');
        if (res.success) setOrimanthiConfig(res.config);
      } catch { /* ignore */ }
    })();
  }, []);

  const persistOrimanthiListsToConfig = useCallback(async (categoriesList, specMap) => {
    const customOnly = getCustomProjectCategoriesOnly(categoriesList);
    const merged = {
      ...(orimanthiConfig || {}),
      customProjectCategories: customOnly,
      customCategorySpecializations: specMap || {},
    };
    const res = await window.electronAPI.invoke('save-orimanthi-config', {
      config: merged,
      actingUsername: loggedInUsername,
    });
    if (!res.success) {
      showToast(res.error || 'Σφάλμα αποθήκευσης λιστών', 'error');
      return false;
    }
    setOrimanthiConfig(res.config);
    return true;
  }, [orimanthiConfig, loggedInUsername, showToast]);

  useEffect(() => {
    if (!orimanthiConfig || orimanthiListsSynced) return;
    let cancelled = false;
    (async () => {
      const cfgCats = orimanthiConfig.customProjectCategories || [];
      const cfgSpecs = orimanthiConfig.customCategorySpecializations || {};
      const lsCats = loadCustomCategoriesList();
      const lsSpecs = loadCustomCategorySpecializations();
      const hasCfg = cfgCats.length > 0 || Object.keys(cfgSpecs).length > 0;
      const hasLs = lsCats.length > 0 || Object.keys(lsSpecs).length > 0;

      if (hasLs && !hasCfg) {
        const mergedCats = getMergedProjectCategories(lsCats);
        if (!cancelled) {
          setProjectCategories(mergedCats);
          setCustomCategorySpecs(lsSpecs);
        }
        const ok = await persistOrimanthiListsToConfig(mergedCats, lsSpecs);
        if (ok) {
          localStorage.removeItem(LS_CUSTOM_CATEGORIES);
          localStorage.removeItem(LS_CUSTOM_CATEGORY_SPECS);
        }
      } else if (!cancelled) {
        setProjectCategories(getMergedProjectCategories(cfgCats));
        setCustomCategorySpecs(cfgSpecs);
      }
      if (!cancelled) setOrimanthiListsSynced(true);
    })();
    return () => { cancelled = true; };
  }, [orimanthiConfig, orimanthiListsSynced, persistOrimanthiListsToConfig]);

  const loadMunicipalUnits = useCallback(async () => {
    try {
      const res = await window.electronAPI.invoke('get-municipal-units-config');
      if (res.success) setMunicipalUnits(res.config?.units || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadMunicipalUnits();
  }, [loadMunicipalUnits]);

  const warnIfMunicipalUnitsEmpty = useCallback(() => {
    if (municipalUnits.length > 0) return false;
    showToast(
      'Τα δεδομένα δημοτικών ενοτήτων δεν έχουν ενημερωθεί. Επικοινωνήστε με τον διαχειριστή συστήματος.',
      'warning'
    );
    return true;
  }, [municipalUnits, showToast]);

  useEffect(() => {
    if (selectedId || !proposals.length) return undefined;
    let cancelled = false;
    const pollLocks = async () => {
      const next = {};
      for (const p of proposals) {
        try {
          const st = await window.electronAPI.invoke('check-entity-lock', 'orimanthi', p.id);
          next[p.id] = st.locked ? (st.lockedBy || true) : false;
        } catch {
          next[p.id] = false;
        }
      }
      if (!cancelled) setProposalLocks(next);
    };
    pollLocks();
    const t = setInterval(pollLocks, 12000);
    return () => { cancelled = true; clearInterval(t); };
  }, [selectedId, proposals]);

  useEffect(() => {
    if (!selectedId || isReadOnly) return undefined;
    let cancelled = false;
    (async () => {
      const status = await window.electronAPI.invoke('check-entity-lock', 'orimanthi', selectedId);
      if (cancelled) return;
      if (status.locked) {
        showToast(`Το έργο είναι ανοιχτό από ${status.lockedBy || 'άλλο χρήστη'}`, 'warning');
        setSelectedId(null);
        return;
      }
      const res = await window.electronAPI.invoke(
        'create-entity-lock',
        'orimanthi',
        selectedId,
        loggedInUsername || ''
      );
      if (cancelled) return;
      if (!res.success) {
        const who = res.lockedBy || res.error || 'άλλο χρήστη';
        showToast(`Δεν ήταν δυνατό το άνοιγμα — ανοιχτό από ${who}`, 'warning');
        setSelectedId(null);
        return;
      }
      lockedProposalIdRef.current = selectedId;
    })();
    return () => { cancelled = true; };
  }, [selectedId, isReadOnly, loggedInUsername, showToast]);

  useEffect(() => () => {
    const id = lockedProposalIdRef.current;
    if (id) {
      window.electronAPI.invoke('remove-entity-lock', 'orimanthi', id);
      lockedProposalIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (fileSearchTimerRef.current) clearTimeout(fileSearchTimerRef.current);
    const q = fileSearch.trim();
    if (q.length < 2) {
      setFileSearchResults([]);
      setFileSearchLoading(false);
      return undefined;
    }
    setFileSearchLoading(true);
    const seq = fileSearchSeqRef.current + 1;
    fileSearchSeqRef.current = seq;
    fileSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await window.electronAPI.invoke('search-proposal-files', { query: q });
        if (seq !== fileSearchSeqRef.current) return;
        if (res.success) {
          setFileSearchResults(res.results || []);
        } else {
          setFileSearchResults([]);
          showToast(res.error || 'Σφάλμα αναζήτησης αρχείων', 'error');
        }
      } catch (e) {
        if (seq === fileSearchSeqRef.current) {
          setFileSearchResults([]);
          showToast(`Σφάλμα αναζήτησης αρχείων: ${e.message}`, 'error');
        }
      } finally {
        if (seq === fileSearchSeqRef.current) setFileSearchLoading(false);
      }
    }, 350);
    return () => {
      if (fileSearchTimerRef.current) clearTimeout(fileSearchTimerRef.current);
    };
  }, [fileSearch, showToast]);

  const loadProjectHistory = useCallback(async (proposalId) => {
    if (!proposalId) {
      setProjectHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await window.electronAPI.invoke('get-audit-log', {
        limit: 200,
        entityType: 'proposal',
        entityId: proposalId,
      });
      if (res.success) {
        const cleaned = (res.logs || []).filter((log) => {
          if (log.action === 'update' && log.changes && Object.keys(log.changes).length === 0 && !log.details) {
            return false;
          }
          return true;
        });
        setProjectHistory(cleaned);
      } else {
        showToast(res.error || 'Σφάλμα φόρτωσης ιστορικού', 'error');
      }
    } catch (e) {
      showToast(`Σφάλμα φόρτωσης ιστορικού: ${e.message}`, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [showToast]);

  const handleClearProjectHistory = useCallback(async () => {
    if (userRole !== 'SUPERADMIN' || !selectedId || clearingHistory) return;
    if (!await showConfirm({
      title: 'Εκκαθάριση ιστορικού',
      message: 'Να διαγραφούν όλες οι καταγραφές ιστορικού για αυτό το έργο;',
      detail: 'Η ενέργεια είναι μη αναστρέψιμη.',
      confirmLabel: 'Εκκάθαριση',
      icon: '🗑',
    })) return;

    setClearingHistory(true);
    try {
      const res = await window.electronAPI.invoke('clear-proposal-audit-log', {
        proposalId: selectedId,
        actingUsername: loggedInUsername,
      });
      if (!res.success) {
        showToast(res.error || 'Σφάλμα εκκαθάρισης ιστορικού', 'error');
        return;
      }
      setProjectHistory([]);
      showToast(
        res.deletedCount > 0
          ? `Διαγράφηκαν ${res.deletedCount} καταγραφές ιστορικού`
          : 'Δεν υπήρχαν καταγραφές προς διαγραφή',
        'success'
      );
    } finally {
      setClearingHistory(false);
    }
  }, [userRole, selectedId, clearingHistory, loggedInUsername, showToast]);

  useEffect(() => {
    if (activeTab === 'history' && selectedId) {
      loadProjectHistory(selectedId);
    }
  }, [activeTab, selectedId, loadProjectHistory]);

  useEffect(() => {
    if (!showNewProjectModal) return undefined;
    const t = setTimeout(() => newProjectTitleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [showNewProjectModal]);

  useEffect(() => {
    setShowCategoryPicker(false);
    setExpandedGroups({});
    setDetailFileFilter('');
    setDetailFolderFilterMatches(new Set());
    setActiveTab('files');
    setDetailShowAddCategoryInput(false);
    setDetailNewCategoryInput('');
    setDetailShowAddSpecializationInput(false);
    setDetailNewSpecializationInput('');
    setMoveModal(null);
    setRenameModal(null);
    setExpandedFolderKeys({});
    setFolderFilesCache({});
    setNestedFileHighlight(null);
  }, [selectedId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  // Sync ref με το τρέχον state — πριν από hooks που χρησιμοποιούν selectedProposal
  proposalsRef.current = proposals;
  const selectedProposal = proposals.find((p) => p.id === selectedId) || null;

  useEffect(() => {
    if (!selectedProposal || !detailFileFilter.trim()) {
      setDetailFolderFilterMatches(new Set());
      return undefined;
    }
    const q = detailFileFilter.trim().toLowerCase();
    let cancelled = false;
    (async () => {
      const matches = new Set();
      for (const group of selectedProposal.fileGroups || []) {
        for (const entry of group.files || []) {
          if (entry.kind !== 'folder') continue;
          const res = await window.electronAPI.invoke('get-proposal-folder-files', {
            proposalId: selectedProposal.id,
            groupId: group.id,
            folderId: entry.id,
          });
          if (cancelled) return;
          if (res.success && (res.files || []).some((f) => String(f.name || '').toLowerCase().includes(q))) {
            matches.add(entry.id);
          }
        }
      }
      if (!cancelled) setDetailFolderFilterMatches(matches);
    })();
    return () => { cancelled = true; };
  }, [selectedProposal, detailFileFilter]);

  useEffect(() => {
    if (nestedFileHighlight?.fileName && highlightedFolderFileRef.current) {
      highlightedFolderFileRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [nestedFileHighlight, folderFilesCache]);

  /* ── Auto-save — skipAudit=true για να μη γεμίζει το audit log με κάθε keystroke ── */
  const mergeSavedProposal = useCallback((saved) => {
    if (!saved?.id) return;
    setProposals((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
    proposalsRef.current = proposalsRef.current.map((p) => (p.id === saved.id ? { ...p, ...saved } : p));
  }, []);

  const markProposalPersisted = useCallback((proposal) => {
    if (!proposal?.id) return;
    persistedSnapshotsRef.current[proposal.id] = JSON.parse(JSON.stringify(proposal));
  }, []);

  const isProposalDirty = useCallback((projectId) => {
    if (!projectId) return false;
    if (pendingSaveProjectIdRef.current === projectId && saveTimerRef.current) return true;
    const current = proposalsRef.current.find((p) => p.id === projectId);
    const persisted = persistedSnapshotsRef.current[projectId];
    if (!current || !persisted) return false;
    return proposalPersistFingerprint(current) !== proposalPersistFingerprint(persisted);
  }, []);

  const revertProposalToPersisted = useCallback((projectId) => {
    const snap = persistedSnapshotsRef.current[projectId];
    if (!snap) return;
    setProposals((prev) => prev.map((p) => (p.id === projectId ? { ...snap } : p)));
    proposalsRef.current = proposalsRef.current.map((p) => (p.id === projectId ? { ...snap } : p));
  }, []);

  const releaseProposalLock = useCallback(async (projectId) => {
    if (!projectId || lockedProposalIdRef.current !== projectId) return;
    await window.electronAPI.invoke('remove-entity-lock', 'orimanthi', projectId);
    lockedProposalIdRef.current = null;
  }, []);

  const refreshHistoryIfVisible = useCallback((proposalId) => {
    if (activeTab === 'history' && selectedId === proposalId) {
      loadProjectHistory(proposalId);
    }
  }, [activeTab, selectedId, loadProjectHistory]);

  const loadFolderFiles = useCallback(async (groupId, folderId, { syncMetadata = false } = {}) => {
    if (!selectedId) return null;
    const key = getFolderExpandKey(groupId, folderId);
    setFolderFilesCache((prev) => ({
      ...prev,
      [key]: { files: prev[key]?.files || [], loading: true },
    }));
    try {
      const res = await window.electronAPI.invoke('get-proposal-folder-files', {
        proposalId: selectedId,
        groupId,
        folderId,
        syncMetadata,
      });
      if (!res.success) {
        showToast(res.error || 'Σφάλμα φόρτωσης φακέλου', 'error');
        setFolderFilesCache((prev) => ({
          ...prev,
          [key]: { files: prev[key]?.files || [], loading: false },
        }));
        return null;
      }
      if (res.proposal) mergeSavedProposal(res.proposal);
      if (res.folderRemoved) {
        setExpandedFolderKeys((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setFolderFilesCache((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        showToast('Ο φάκελος ήταν κενός και αφαιρέθηκε', 'info');
        return { removed: true };
      }
      setFolderFilesCache((prev) => ({
        ...prev,
        [key]: { files: res.files || [], loading: false },
      }));
      return { files: res.files || [] };
    } catch (e) {
      showToast(`Σφάλμα φόρτωσης φακέλου: ${e.message}`, 'error');
      setFolderFilesCache((prev) => ({
        ...prev,
        [key]: { files: prev[key]?.files || [], loading: false },
      }));
      return null;
    }
  }, [selectedId, showToast, mergeSavedProposal]);

  const toggleFolderExpanded = useCallback(async (groupId, folder) => {
    const key = getFolderExpandKey(groupId, folder.id);
    if (expandedFolderKeys[key]) {
      setExpandedFolderKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setExpandedFolderKeys((prev) => ({ ...prev, [key]: true }));
    await loadFolderFiles(groupId, folder.id, { syncMetadata: true });
  }, [expandedFolderKeys, loadFolderFiles]);

  const clearFolderExpandState = useCallback((groupId, folderId) => {
    const key = getFolderExpandKey(groupId, folderId);
    setExpandedFolderKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFolderFilesCache((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!selectedProposal || !detailFileFilter.trim() || detailFolderFilterMatches.size === 0) return undefined;
    let cancelled = false;
    (async () => {
      for (const group of selectedProposal.fileGroups || []) {
        for (const entry of group.files || []) {
          if (entry.kind !== 'folder' || !detailFolderFilterMatches.has(entry.id)) continue;
          if (cancelled) return;
          const key = getFolderExpandKey(group.id, entry.id);
          setExpandedFolderKeys((prev) => ({ ...prev, [key]: true }));
          await loadFolderFiles(group.id, entry.id, { syncMetadata: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProposal, detailFileFilter, detailFolderFilterMatches, loadFolderFiles]);

  const saveProposalImmediate = useCallback(async (updated, { skipAudit = false } = {}) => {
    if (isReadOnly) return { success: false };
    if (blockedProposalSavesRef.current === updated?.id) {
      return { success: false, error: 'Η αποθήκευση ακυρώθηκε — το έργο διαγράφεται' };
    }
    const titleGate = orimanthiCatalog.evaluateProposalSave(updated);
    if (!titleGate.ok) {
      showToast(titleGate.error, 'warning');
      return { success: false, error: titleGate.error };
    }
    const validation = validateProposalCategoryFields(updated, customCategorySpecs);
    if (!validation.ok) {
      showToast(validation.error, 'warning');
      return { success: false, error: validation.error };
    }
    setSaving(true);
    const res = await window.electronAPI.invoke('save-proposal', {
      proposal: updated,
      actingUsername: loggedInUsername,
      skipAudit,
      expectedUpdatedAt: updated?.updatedAt || undefined,
    });
    setSaving(false);
    if (res.conflict) {
      if (res.proposal) mergeSavedProposal(res.proposal);
      showToast(res.error || 'Σύγκρουση αποθήκευσης — φορτώθηκε η τελευταία έκδοση', 'warning');
      return res;
    }
    if (!res.success) showToast(`Σφάλμα αποθήκευσης: ${res.error}`, 'error');
    else if (res.proposal) {
      mergeSavedProposal(res.proposal);
      markProposalPersisted(res.proposal);
    }
    return res;
  }, [isReadOnly, loggedInUsername, showToast, mergeSavedProposal, markProposalPersisted, customCategorySpecs]);

  const saveProposal = useCallback((updated, options = {}) => {
    const run = saveChainRef.current
      .catch(() => {})
      .then(() => saveProposalImmediate(updated, options));
    saveChainRef.current = run.then(
      () => {},
      () => {}
    );
    return run;
  }, [saveProposalImmediate]);

  const saveProposalAudited = useCallback(async (updated) => {
    const res = await saveProposal(updated, { skipAudit: false });
    if (res?.success && activeTab === 'history' && selectedId === updated.id) {
      loadProjectHistory(updated.id);
    }
    return res;
  }, [saveProposal, activeTab, selectedId, loadProjectHistory]);

  const clearPendingSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flushProposalSaveById = useCallback(async (projectId, { forceAudit = false } = {}) => {
    if (!projectId || isReadOnly || blockedProposalSavesRef.current === projectId) return;
    if (pendingSaveProjectIdRef.current !== projectId) return;
    clearPendingSaveTimer();
    const audited = forceAudit || pendingSaveAuditedRef.current;
    pendingSaveProjectIdRef.current = null;
    pendingSaveAuditedRef.current = false;
    const latest = proposalsRef.current.find((p) => p.id === projectId);
    if (!latest) return;
    if (audited) await saveProposalAudited(latest);
    else await saveProposal(latest, { skipAudit: true });
  }, [isReadOnly, clearPendingSaveTimer, saveProposal, saveProposalAudited]);

  const scheduleDebouncedSave = useCallback((projectId, audited) => {
    clearPendingSaveTimer();
    pendingSaveProjectIdRef.current = projectId;
    if (audited) pendingSaveAuditedRef.current = true;
    const delay = pendingSaveAuditedRef.current ? 450 : 1200;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const id = pendingSaveProjectIdRef.current;
      const useAudit = pendingSaveAuditedRef.current;
      pendingSaveProjectIdRef.current = null;
      pendingSaveAuditedRef.current = false;
      if (!id || blockedProposalSavesRef.current === id) return;
      const latest = proposalsRef.current.find((p) => p.id === id);
      if (!latest) return;
      if (useAudit) saveProposalAudited(latest);
      else saveProposal(latest, { skipAudit: true });
    }, delay);
  }, [clearPendingSaveTimer, saveProposal, saveProposalAudited]);

  const requestSelectProposal = useCallback(async (targetId) => {
    if (targetId === selectedId) return true;
    const currentId = selectedId;
    if (currentId && !isReadOnly && isProposalDirty(currentId)) {
      return new Promise((resolve) => {
        setUnsavedNavModal({ targetId, resolve });
      });
    }
    if (currentId && !isReadOnly) {
      await flushProposalSaveById(currentId);
      const latest = proposalsRef.current.find((p) => p.id === currentId);
      if (latest) markProposalPersisted(latest);
    }
    if (currentId && !isReadOnly) await releaseProposalLock(currentId);
    setSelectedId(targetId);
    return true;
  }, [selectedId, isReadOnly, isProposalDirty, flushProposalSaveById, markProposalPersisted, releaseProposalLock]);

  const refreshExpandedFoldersInGroup = useCallback(async (groupId, proposalId = selectedId) => {
    if (!proposalId) return;
    const keys = Object.keys(expandedFolderKeys).filter((k) => k.startsWith(`${groupId}:`));
    for (const key of keys) {
      if (!expandedFolderKeys[key]) continue;
      const folderId = key.split(':')[1];
      const res = await window.electronAPI.invoke('get-proposal-folder-files', {
        proposalId,
        groupId,
        folderId,
        syncMetadata: false,
      });
      if (res.success && !res.folderRemoved) {
        setFolderFilesCache((prev) => ({
          ...prev,
          [key]: { files: res.files || [], loading: false },
        }));
      }
    }
  }, [selectedId, expandedFolderKeys]);

  const updateProposal = useCallback((changes) => {
    const projectId = selectedId;
    if (!projectId) return;
    setProposals((prev) => {
      const next = prev.map((p) => (p.id === projectId ? { ...p, ...changes } : p));
      proposalsRef.current = next;
      return next;
    });
    const pendingId = pendingSaveProjectIdRef.current;
    if (pendingId && pendingId !== projectId && saveTimerRef.current) {
      void (async () => {
        await flushProposalSaveById(pendingId);
        scheduleDebouncedSave(projectId, false);
      })();
      return;
    }
    scheduleDebouncedSave(projectId, false);
  }, [selectedId, flushProposalSaveById, scheduleDebouncedSave]);

  const updateProposalAudited = useCallback((changes) => {
    const projectId = selectedId;
    if (!projectId) return;
    setProposals((prev) => {
      const next = prev.map((p) => (p.id === projectId ? { ...p, ...changes } : p));
      proposalsRef.current = next;
      return next;
    });
    const pendingId = pendingSaveProjectIdRef.current;
    if (pendingId && pendingId !== projectId && saveTimerRef.current) {
      void (async () => {
        await flushProposalSaveById(pendingId);
        scheduleDebouncedSave(projectId, true);
      })();
      return;
    }
    scheduleDebouncedSave(projectId, true);
  }, [selectedId, flushProposalSaveById, scheduleDebouncedSave]);

  const logProposalActivityClient = useCallback(async (details, type = 'update') => {
    if (isReadOnly || !selectedId) return;
    const res = await window.electronAPI.invoke('log-proposal-activity', {
      proposalId: selectedId,
      type,
      details: clipProposalActivityDetail(details),
      actingUsername: loggedInUsername,
    });
    if (!res?.success) {
      showToast(res?.error || 'Η ενέργεια δεν καταγράφηκε στο ιστορικό', 'warning');
      return;
    }
    refreshHistoryIfVisible(selectedId);
  }, [isReadOnly, selectedId, loggedInUsername, refreshHistoryIfVisible, showToast]);

  const handleTitleBlur = useCallback(() => {
    if (isReadOnly || !selectedId) return;
    clearPendingSaveTimer();
    pendingSaveProjectIdRef.current = null;
    pendingSaveAuditedRef.current = false;
    const latest = proposalsRef.current.find((p) => p.id === selectedId);
    if (latest) saveProposalAudited(latest);
  }, [isReadOnly, selectedId, saveProposalAudited, clearPendingSaveTimer]);

  const handleNotesBlur = useCallback(() => {
    handleTitleBlur();
  }, [handleTitleBlur]);

  const handleDescriptionBlur = useCallback(() => {
    handleTitleBlur();
  }, [handleTitleBlur]);

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

  const resetNewProjectModal = useCallback(() => {
    setShowNewProjectModal(false);
    setNewProjectDraft(EMPTY_NEW_PROJECT_DRAFT);
    setNewProjectStagedGroups([]);
    setNewProjectShowCategoryPicker(false);
    setNewProjectExpandedGroups({});
    setNewCategoryInput('');
    setNewSpecializationInput('');
    setShowAddCategoryInput(false);
    setShowAddSpecializationInput(false);
    setNewProjectShowSpecializationField(false);
  }, []);

  const openNewProjectModal = useCallback(() => {
    if (isReadOnly) return;
    void loadMunicipalUnits();
    setNewProjectDraft(EMPTY_NEW_PROJECT_DRAFT);
    setNewProjectStagedGroups([]);
    setNewProjectShowCategoryPicker(false);
    setNewProjectExpandedGroups({});
    setNewCategoryInput('');
    setNewSpecializationInput('');
    setShowAddCategoryInput(false);
    setShowAddSpecializationInput(false);
    setNewProjectShowSpecializationField(false);
    setShowNewProjectModal(true);
  }, [isReadOnly, loadMunicipalUnits]);

  const addCustomProjectCategory = useCallback((label) => {
    const trimmed = String(label || '').trim();
    if (!trimmed) return null;
    let added = trimmed;
    let nextCategories = projectCategories;
    setProjectCategories((prev) => {
      if (prev.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
        added = prev.find((x) => x.toLowerCase() === trimmed.toLowerCase()) || trimmed;
        nextCategories = prev;
        return prev;
      }
      nextCategories = [...prev, trimmed];
      saveCustomCategoriesList(nextCategories);
      return nextCategories;
    });
    void persistOrimanthiListsToConfig(nextCategories, customCategorySpecs);
    return added;
  }, [projectCategories, customCategorySpecs, persistOrimanthiListsToConfig]);

  const addCustomCategorySpecialization = useCallback((category, label, { showSuccessToast = false } = {}) => {
    const cat = resolveCategoryLabel(category);
    const trimmed = String(label || '').trim();
    if (!cat || !trimmed) return null;
    let added = trimmed;
    let nextSpecs = customCategorySpecs;
    setCustomCategorySpecs((prev) => {
      const existingAll = getSpecializationsForCategory(cat, prev);
      if (existingAll.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
        added = existingAll.find((x) => x.toLowerCase() === trimmed.toLowerCase()) || trimmed;
        nextSpecs = prev;
        return prev;
      }
      nextSpecs = {
        ...prev,
        [cat]: [...(prev[cat] || []), trimmed],
      };
      saveCustomCategorySpecializations(nextSpecs);
      return nextSpecs;
    });
    void persistOrimanthiListsToConfig(projectCategories, nextSpecs).then((ok) => {
      if (ok && showSuccessToast) {
        showToast(`Η εξειδίκευση «${added}» προστέθηκε στην κατηγορία «${cat}»`, 'success');
      }
    });
    return added;
  }, [customCategorySpecs, projectCategories, persistOrimanthiListsToConfig, showToast]);

  const customCategories = useMemo(
    () => getCustomProjectCategoriesOnly(projectCategories),
    [projectCategories]
  );

  const categoriesWithCustomSpecs = useMemo(
    () => getCategoriesWithCustomSpecs(customCategorySpecs),
    [customCategorySpecs]
  );

  const countProjectsWithCategory = useCallback((label) => {
    const q = String(label || '').trim().toLowerCase();
    if (!q) return 0;
    return proposals.filter(
      (p) => String(p.projectCategory || '').trim().toLowerCase() === q
    ).length;
  }, [proposals]);

  const countProjectsWithSpecialization = useCallback((category, label) => {
    const catQ = resolveCategoryLabel(category).toLowerCase();
    const specQ = String(label || '').trim().toLowerCase();
    if (!catQ || !specQ) return 0;
    return proposals.filter(
      (p) => resolveCategoryLabel(p.projectCategory).toLowerCase() === catQ
        && String(p.infrastructureSpecialization || '').trim().toLowerCase() === specQ
    ).length;
  }, [proposals]);

  const removeCustomProjectCategory = useCallback(async (label) => {
    const trimmed = String(label || '').trim();
    if (!trimmed || isDefaultProjectCategory(trimmed)) {
      showToast('Δεν μπορείτε να διαγράψετε προεπιλεγμένη κατηγορία', 'error');
      return false;
    }
    const inUse = countProjectsWithCategory(trimmed);
    if (inUse > 0) {
      const ok = await showConfirm({
        title: 'Κατηγορία σε χρήση',
        message: `Η κατηγορία «${trimmed}» χρησιμοποιείται από ${inUse} ${inUse === 1 ? 'έργο' : 'έργα'}. Θα αφαιρεθεί από τη λίστα επιλογών, αλλά τα έργα θα διατηρήσουν την τιμή τους. Συνέχεια;`,
      });
      if (!ok) return false;
    }
    setProjectCategories((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
      saveCustomCategoriesList(next);
      void persistOrimanthiListsToConfig(next, customCategorySpecs);
      return next;
    });
    setCustomCategorySpecs((prev) => {
      if (!prev[trimmed]) return prev;
      const next = { ...prev };
      delete next[trimmed];
      saveCustomCategorySpecializations(next);
      void persistOrimanthiListsToConfig(
        projectCategories.filter((x) => x.toLowerCase() !== trimmed.toLowerCase()),
        next
      );
      return next;
    });
    showToast(`Η κατηγορία «${trimmed}» αφαιρέθηκε από τη λίστα`, 'success');
    return true;
  }, [countProjectsWithCategory, showToast, customCategorySpecs, projectCategories, persistOrimanthiListsToConfig]);

  const removeCustomCategorySpecialization = useCallback(async (category, label) => {
    const cat = resolveCategoryLabel(category);
    const trimmed = String(label || '').trim();
    if (!cat || !trimmed || isDefaultCategorySpecialization(cat, trimmed)) {
      showToast('Δεν μπορείτε να διαγράψετε προεπιλεγμένη εξειδίκευση', 'error');
      return false;
    }
    const inUse = countProjectsWithSpecialization(cat, trimmed);
    if (inUse > 0) {
      const ok = await showConfirm({
        title: 'Εξειδίκευση σε χρήση',
        message: `Η εξειδίκευση «${trimmed}» (${cat}) χρησιμοποιείται από ${inUse} ${inUse === 1 ? 'έργο' : 'έργα'}. Θα αφαιρεθεί από τη λίστα επιλογών, αλλά τα έργα θα διατηρήσουν την τιμή τους. Συνέχεια;`,
      });
      if (!ok) return false;
    }
    setCustomCategorySpecs((prev) => {
      const next = { ...prev };
      next[cat] = (prev[cat] || []).filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
      if (!next[cat].length) delete next[cat];
      saveCustomCategorySpecializations(next);
      void persistOrimanthiListsToConfig(projectCategories, next);
      return next;
    });
    showToast(`Η εξειδίκευση «${trimmed}» αφαιρέθηκε από «${cat}»`, 'success');
    return true;
  }, [countProjectsWithSpecialization, showToast, projectCategories, persistOrimanthiListsToConfig]);

  const handleRemoveCustomCategory = useCallback(async (label) => {
    setRemovingListItem(`cat:${label}`);
    try {
      await removeCustomProjectCategory(label);
    } finally {
      setRemovingListItem('');
    }
  }, [removeCustomProjectCategory]);

  const handleRemoveCustomSpecialization = useCallback(async (category, label) => {
    setRemovingListItem(`spec:${category}:${label}`);
    try {
      await removeCustomCategorySpecialization(category, label);
    } finally {
      setRemovingListItem('');
    }
  }, [removeCustomCategorySpecialization]);

  const handleRemoveCustomMeletesFileSpec = useCallback((label) => {
    const trimmed = String(label || '').trim();
    if (!trimmed) return;
    setCustomMeletesFileSpecs((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
      saveCustomFileSpecs(LS_CUSTOM_MELETES_SPECS, DEFAULT_MELETES_SPECS, getMeletesSpecs(next));
      return next;
    });
    showToast(`Η εξειδίκευση «${trimmed}» αφαιρέθηκε από Μελέτες έργου`, 'success');
  }, [showToast]);

  const handleRemoveCustomAdeiodotiseisFileSpec = useCallback((label) => {
    const trimmed = String(label || '').trim();
    if (!trimmed) return;
    setCustomAdeiodotiseisFileSpecs((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
      saveCustomFileSpecs(
        LS_CUSTOM_ADEIODOTISEIS_SPECS,
        DEFAULT_ADEIODOTISEIS_SPECS,
        getAdeiodotiseisSpecs(next)
      );
      return next;
    });
    showToast(`Η εξειδίκευση «${trimmed}» αφαιρέθηκε από Αδειοδοτήσεις`, 'success');
  }, [showToast]);

  const handleNewProjectPickFiles = async (groupId) => {
    const res = await window.electronAPI.invoke('select-multiple-files', { allFileTypes: true });
    if (!res || res.canceled || !res.success) return;
    const picked = (res.files || []).map((f) => ({
      path: f.filePath || f.path,
      name: f.fileName || f.name || (f.filePath || f.path || '').split(/[\\/]/).pop(),
    })).filter((f) => f.path);
    if (!picked.length) return;
    setNewProjectStagedGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      const existing = new Set((g.stagedFiles || []).map((f) => f.path));
      return {
        ...g,
        stagedFiles: [
          ...(g.stagedFiles || []),
          ...picked.filter((f) => !existing.has(f.path)),
        ],
      };
    }));
    setNewProjectExpandedGroups((prev) => ({ ...prev, [groupId]: true }));
  };

  const handleNewProjectPickFolder = async (groupId) => {
    const res = await window.electronAPI.invoke('select-folder-files-flat', {
      title: 'Επιλογή φακέλου για ανέβασμα',
    });
    if (!res || res.canceled || !res.success || !Array.isArray(res.files) || !res.files.length) {
      if (res?.error) showToast(res.error, 'error');
      return;
    }
    const folderName = res.folderName || 'Φάκελος';
    const files = res.files.map((f) => ({
      path: f.filePath || f.path,
      name: f.fileName || f.name || (f.filePath || f.path || '').split(/[\\/]/).pop(),
    })).filter((f) => f.path);
    if (!files.length) return;
    const folderEntry = { id: uuidv4(), folderName, files };
    setNewProjectStagedGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        stagedFolders: [...(g.stagedFolders || []), folderEntry],
      };
    }));
    setNewProjectExpandedGroups((prev) => ({ ...prev, [groupId]: true }));
  };

  const addNewProjectFileCategoryGroup = useCallback(({ rootId, spec, label }) => {
    if (!rootId || !spec) return;
    if (fileGroupExists(newProjectStagedGroups, rootId, spec)) {
      showToast(`Η κατηγορία «${label}» υπάρχει ήδη`, 'warning');
      setNewProjectShowCategoryPicker(false);
      return;
    }
    const payload = buildFileGroupPayload(rootId, spec);
    const newGroupId = uuidv4();
    setNewProjectStagedGroups((prev) => [...prev, {
      id: newGroupId,
      ...payload,
      stagedFiles: [],
      stagedFolders: [],
    }]);
    setNewProjectExpandedGroups((prev) => ({ ...prev, [newGroupId]: true }));
    setNewProjectShowCategoryPicker(false);
  }, [newProjectStagedGroups, showToast]);

  const handleNewProjectOpenCategoryPicker = () => {
    setNewProjectShowCategoryPicker(true);
  };

  const handleNewProjectCancelAddGroup = () => {
    setNewProjectShowCategoryPicker(false);
  };

  const deleteNewProjectGroup = async (groupId, groupLabel) => {
    const group = newProjectStagedGroups.find((g) => g.id === groupId);
    const hasContent = (group?.stagedFiles?.length || 0) + (group?.stagedFolders?.length || 0) > 0;
    if (hasContent) {
      const ok = await showConfirm({
        title: 'Διαγραφή κατηγορίας',
        message: groupLabel
          ? `Να διαγραφεί η κατηγορία «${groupLabel}» και τα προσωρινά αρχεία της;`
          : 'Να διαγραφεί αυτή η κατηγορία και τα προσωρινά αρχεία της;',
        confirmLabel: 'Διαγραφή',
        icon: '🗑',
      });
      if (!ok) return;
    }
    setNewProjectStagedGroups((prev) => prev.filter((g) => g.id !== groupId));
    setNewProjectExpandedGroups((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const toggleNewProjectGroupExpanded = useCallback((groupId) => {
    setNewProjectExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const uploadStagedProjectGroups = useCallback(async (proposalId, stagedGroups) => {
    const fileGroups = [];
    for (const group of stagedGroups) {
      let files = [];
      const groupId = group.id;

      if (group.stagedFiles?.length) {
        const res = await window.electronAPI.invoke('upload-proposal-files', {
          proposalId,
          groupId,
          files: group.stagedFiles,
          actingUsername: loggedInUsername,
        });
        if (!res.success) throw new Error(res.error || 'Σφάλμα ανεβάσματος αρχείων');
        files = [...files, ...(res.files || [])];
      }

      for (const folder of group.stagedFolders || []) {
        const res = await window.electronAPI.invoke('upload-proposal-folder', {
          proposalId,
          groupId,
          folderName: folder.folderName,
          files: folder.files,
          actingUsername: loggedInUsername,
        });
        if (!res.success) throw new Error(res.error || 'Σφάλμα ανεβάσματος φακέλου');
        const exists = files.some((f) => isProposalFolder(f) && f.id === res.folder.id);
        if (!exists) files = [...files, res.folder];
      }

      fileGroups.push({
        id: groupId,
        label: group.label,
        fileCategoryRoot: group.fileCategoryRoot,
        fileCategorySpec: group.fileCategorySpec,
        files,
      });
    }
    return fileGroups;
  }, [loggedInUsername]);

  const handleConfirmNewProject = async () => {
    if (isReadOnly || creatingProject) return;
    const title = newProjectDraft.title.trim();
    const createGate = orimanthiCatalog.evaluateNewProposal(newProjectDraft, {
      categoryHasSpecializations: (category, specMap) => categoryHasSpecializations(category, specMap),
      customSpecMap: customCategorySpecs,
    });
    if (!createGate.ok) {
      showToast(createGate.error, 'warning');
      if (createGate.field === 'title') newProjectTitleRef.current?.focus();
      return;
    }

    const hasStagedGroups = newProjectStagedGroups.length > 0;
    const hasStagedUploads = newProjectStagedGroups.some(
      (g) => (g.stagedFiles?.length || 0) + (g.stagedFolders?.length || 0) > 0
    );
    const proposal = {
      ...emptyProposal(),
      title,
      projectCategory: newProjectDraft.projectCategory,
      infrastructureSpecialization: categoryHasSpecializations(
        newProjectDraft.projectCategory,
        customCategorySpecs
      )
        ? newProjectDraft.infrastructureSpecialization
        : '',
      municipalUnit: newProjectDraft.municipalUnit || '',
      settlement: newProjectDraft.settlement?.trim() || '',
      aepoRenewalDate: newProjectDraft.aepoRenewalDate || '',
      status: createGate.status || orimanthiCatalog.NEW_PROPOSAL_STATUS,
      fileGroups: hasStagedGroups
        ? newProjectStagedGroups.map((g) => ({
          id: g.id,
          label: g.label,
          fileCategoryRoot: g.fileCategoryRoot,
          fileCategorySpec: g.fileCategorySpec,
          files: [],
        }))
        : [],
    };

    setCreatingProject(true);
    let createdProposalId = null;
    try {
      const res = await window.electronAPI.invoke('save-proposal', {
        proposal,
        actingUsername: loggedInUsername,
      });
      if (!res.success) {
        showToast('Σφάλμα δημιουργίας έργου', 'error');
        return;
      }

      createdProposalId = res.proposal?.id || null;
      let savedProposal = res.proposal;
      if (hasStagedGroups) {
        const fileGroups = hasStagedUploads
          ? await uploadStagedProjectGroups(savedProposal.id, newProjectStagedGroups)
          : proposal.fileGroups;
        const saveFilesRes = await window.electronAPI.invoke('save-proposal', {
          proposal: { ...savedProposal, fileGroups },
          actingUsername: loggedInUsername,
          skipAudit: true,
        });
        if (!saveFilesRes.success) {
          throw new Error(saveFilesRes.error || 'Σφάλμα αποθήκευσης αρχείων έργου');
        }
        savedProposal = saveFilesRes.proposal;
      }

      setProposals((prev) => [savedProposal, ...prev]);
      setSelectedId(savedProposal.id);
      setActiveTab('files');
      resetNewProjectModal();
      showToast('Το έργο δημιουργήθηκε', 'success');
    } catch (err) {
      if (createdProposalId) {
        try {
          await window.electronAPI.invoke('delete-proposal', {
            proposalId: createdProposalId,
            actingUsername: loggedInUsername,
          });
        } catch {
          /* rollback best-effort */
        }
      }
      showToast(err.message || 'Σφάλμα δημιουργίας έργου', 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  /* ── Delete proposal ── */
  const handleDeleteProposal = async () => {
    const deleteGate = orimanthiCatalog.evaluateProposalDelete({
      role: userRole,
      orimanthiCanEdit,
      proposalId: selectedProposal?.id,
    });
    if (!deleteGate.ok) return;
    const title = selectedProposal.title || 'Χωρίς τίτλο';
    if (!await showConfirm({
      title: 'Διαγραφή Έργου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το έργο «${title}»;`,
      detail: 'Θα διαγραφούν και όλα τα αρχεία της. Η ενέργεια είναι μη αναστρέψιμη.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;

    const deletingId = selectedId;
    blockedProposalSavesRef.current = deletingId;
    clearPendingSaveTimer();
    pendingSaveProjectIdRef.current = null;
    pendingSaveAuditedRef.current = false;

    try {
      await saveChainRef.current.catch(() => {});
      const res = await window.electronAPI.invoke('delete-proposal', {
        proposalId: deletingId,
        actingUsername: loggedInUsername,
      });
      if (!res.success) {
        showToast('Σφάλμα διαγραφής', 'error');
        return;
      }
      setProposals((prev) => prev.filter((p) => p.id !== deletingId));
      proposalsRef.current = proposalsRef.current.filter((p) => p.id !== deletingId);
      delete persistedSnapshotsRef.current[deletingId];
      await releaseProposalLock(deletingId);
      setSelectedId(null);
      setExpandedGroups({});
      showToast('Το έργο διαγράφηκε', 'success');
    } finally {
      if (blockedProposalSavesRef.current === deletingId) {
        blockedProposalSavesRef.current = null;
      }
    }
  };

  /* ── File groups ── */
  const addCustomFileSpec = useCallback((rootId, spec) => {
    const trimmed = String(spec || '').trim();
    if (!trimmed) return;
    const defaults = rootId === FILE_CATEGORY_ROOT_MELETES
      ? DEFAULT_MELETES_SPECS
      : DEFAULT_ADEIODOTISEIS_SPECS;
    if (defaults.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return;

    if (rootId === FILE_CATEGORY_ROOT_MELETES) {
      setCustomMeletesFileSpecs((prev) => {
        if (prev.some((x) => x.toLowerCase() === trimmed.toLowerCase())) return prev;
        const nextCustom = [...prev, trimmed];
        saveCustomFileSpecs(
          LS_CUSTOM_MELETES_SPECS,
          DEFAULT_MELETES_SPECS,
          getMeletesSpecs(nextCustom)
        );
        return nextCustom;
      });
      return;
    }
    if (rootId === FILE_CATEGORY_ROOT_ADEIODOTISEIS) {
      setCustomAdeiodotiseisFileSpecs((prev) => {
        if (prev.some((x) => x.toLowerCase() === trimmed.toLowerCase())) return prev;
        const nextCustom = [...prev, trimmed];
        saveCustomFileSpecs(
          LS_CUSTOM_ADEIODOTISEIS_SPECS,
          DEFAULT_ADEIODOTISEIS_SPECS,
          getAdeiodotiseisSpecs(nextCustom)
        );
        return nextCustom;
      });
    }
  }, []);

  const addFileCategoryGroup = useCallback(({ rootId, spec, label }) => {
    if (isReadOnly || !selectedProposal || !rootId || !spec) return;
    if (fileGroupExists(selectedProposal.fileGroups, rootId, spec)) {
      showToast(`Η κατηγορία «${label}» υπάρχει ήδη`, 'warning');
      setShowCategoryPicker(false);
      return;
    }
    const payload = buildFileGroupPayload(rootId, spec);
    const group = { id: uuidv4(), ...payload, files: [] };
    updateProposal({ fileGroups: [...(selectedProposal.fileGroups || []), group] });
    setShowCategoryPicker(false);
  }, [isReadOnly, selectedProposal, showToast, updateProposal]);

  const handleOpenCategoryPicker = () => {
    setShowCategoryPicker(true);
  };

  const handleCancelAddGroup = () => {
    setShowCategoryPicker(false);
  };

  const deleteGroup = async (groupId, groupLabel) => {
    if (isReadOnly || !selectedId) return;
    if (!await showConfirm({
      title: 'Διαγραφή Κατηγορίας',
      message: groupLabel
        ? `Είστε σίγουροι ότι θέλετε να διαγράψετε την κατηγορία «${groupLabel}»;`
        : 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κατηγορία;',
      detail: 'Θα διαγραφούν και όλα τα αρχεία που περιέχει.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;
    const nextFileGroups = selectedProposal.fileGroups.filter((g) => g.id !== groupId);
    const delRes = await window.electronAPI.invoke('delete-proposal-group', {
      proposalId: selectedId,
      groupId,
      groupLabel,
      nextFileGroups,
      actingUsername: loggedInUsername,
    });
    if (!delRes.success) {
      showToast(`Σφάλμα διαγραφής κατηγορίας: ${delRes.error}`, 'error');
      return;
    }
    if (delRes.proposal) mergeSavedProposal(delRes.proposal);
    else {
      setProposals((prev) => {
        const next = prev.map((p) => (p.id === selectedId ? { ...p, fileGroups: nextFileGroups } : p));
        proposalsRef.current = next;
        return next;
      });
    }
    refreshHistoryIfVisible(selectedId);
  };

  /* ── Upload files to group ── */
  const uploadToGroup = useCallback(async (groupId, filePaths) => {
    if (!filePaths?.length || !selectedId) return;
    if (uploadingGroupId) {
      showToast('Περιμένετε να ολοκληρωθεί το τρέχον ανέβασμα', 'warning');
      return;
    }
    setUploadingGroupId(groupId);
    try {
      const files = filePaths.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() }));
      const res = await window.electronAPI.invoke('upload-proposal-files', {
        proposalId: selectedId,
        groupId,
        files,
        actingUsername: loggedInUsername,
      });
      if (!res.success) {
        showToast(`Σφάλμα ανεβάσματος: ${res.error}`, 'error');
        return;
      }
      if (res.proposal) mergeSavedProposal(res.proposal);
      refreshHistoryIfVisible(selectedId);
      await refreshExpandedFoldersInGroup(groupId, selectedId);
      showToast(`Ανέβηκαν ${res.files.length} αρχεία`, 'success');
    } finally {
      setUploadingGroupId(null);
    }
  }, [selectedId, uploadingGroupId, showToast, loggedInUsername, mergeSavedProposal, refreshHistoryIfVisible, refreshExpandedFoldersInGroup]);

  const uploadFolderToGroup = useCallback(async (groupId, picked) => {
    if (!picked?.files?.length || !selectedId) return;
    if (uploadingGroupId) {
      showToast('Περιμένετε να ολοκληρωθεί το τρέχον ανέβασμα', 'warning');
      return;
    }
    setUploadingGroupId(groupId);
    try {
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
      if (!res.success) {
        showToast(`Σφάλμα ανεβάσματος φακέλου: ${res.error}`, 'error');
        return;
      }
      if (res.proposal) mergeSavedProposal(res.proposal);
      refreshHistoryIfVisible(selectedId);
      if (res.folder?.id) {
        const key = getFolderExpandKey(groupId, res.folder.id);
        if (expandedFolderKeys[key]) {
          await loadFolderFiles(groupId, res.folder.id, { syncMetadata: false });
        }
      }
      showToast(`Προστέθηκε φάκελος «${res.folder.name}» (${res.folder.fileCount} αρχεία)`, 'success');
    } finally {
      setUploadingGroupId(null);
    }
  }, [selectedId, uploadingGroupId, showToast, loggedInUsername, mergeSavedProposal, refreshHistoryIfVisible, expandedFolderKeys, loadFolderFiles]);

  const handleSelectFiles = async (groupId) => {
    if (isReadOnly) return;
    const res = await window.electronAPI.invoke('select-multiple-files', { allFileTypes: true });
    if (!res || res.canceled || !res.success) return;
    const paths = (res.files || []).map((f) => f.filePath || f.path).filter(Boolean);
    if (!paths.length) {
      showToast('Δεν επιλέχθηκαν αρχεία', 'warning');
      return;
    }
    await uploadToGroup(groupId, paths);
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

  const handleOpenFolderFile = async (groupId, folderId, fileName) => {
    const res = await window.electronAPI.invoke('open-proposal-file', {
      proposalId: selectedId,
      groupId,
      folderId,
      fileName,
    });
    if (!res.success) showToast(`Σφάλμα ανοίγματος: ${res.error}`, 'error');
  };

  const handleDownloadFolderFile = async (groupId, folderId, fileName) => {
    const res = await window.electronAPI.invoke('download-proposal-file', {
      proposalId: selectedId,
      groupId,
      folderId,
      fileName,
    });
    if (res.success) showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
    else if (!res.canceled) showToast(`Σφάλμα λήψης: ${res.error}`, 'error');
  };

  const handleDeleteFolder = async (groupId, folder) => {
    if (isReadOnly || !selectedProposal) return;
    if (!await showConfirm({
      title: 'Διαγραφή Φακέλου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε τον φάκελο «${folder.name}»;`,
      detail: 'Θα διαγραφούν και όλα τα αρχεία που περιέχει.',
      confirmLabel: 'Διαγραφή',
      icon: '📁',
    })) return;
    const nextFileGroups = selectedProposal.fileGroups.map((g) =>
      g.id === groupId
        ? { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== folder.id) }
        : g
    );
    const res = await window.electronAPI.invoke('delete-proposal-folder', {
      proposalId: selectedId,
      groupId,
      folderId: folder.id,
      nextFileGroups,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast(res.error || 'Σφάλμα διαγραφής φακέλου', 'error');
    if (res.proposal) mergeSavedProposal(res.proposal);
    refreshHistoryIfVisible(selectedId);
    clearFolderExpandState(groupId, folder.id);
  };

  const handleDeleteFolderFile = async (groupId, folderId, fileName) => {
    if (isReadOnly || !selectedProposal) return;
    const cacheKey = getFolderExpandKey(groupId, folderId);
    const cachedFiles = folderFilesCache[cacheKey]?.files || [];
    if (!await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο «${fileName}» από τον φάκελο;`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;

    const remainingFiles = cachedFiles.filter((f) => f.name !== fileName);
    const remainingCount = remainingFiles.length;

    const nextFileGroups = selectedProposal.fileGroups.map((g) => {
      if (g.id !== groupId) return g;
      if (remainingCount === 0) {
        return {
          ...g,
          files: (g.files || []).filter((f) => !(f.kind === 'folder' && f.id === folderId)),
        };
      }
      const deletedSize = cachedFiles.find((x) => x.name === fileName)?.size || 0;
      return {
        ...g,
        files: (g.files || []).map((f) => {
          if (f.kind !== 'folder' || f.id !== folderId) return f;
          return {
            ...f,
            fileCount: remainingCount,
            size: Math.max(0, (f.size || 0) - deletedSize),
          };
        }),
      };
    });

    const res = await window.electronAPI.invoke('delete-proposal-folder-file', {
      proposalId: selectedId,
      groupId,
      folderId,
      fileName,
      nextFileGroups,
      actingUsername: loggedInUsername,
    });
    if (!res.success) {
      showToast(res.error || 'Σφάλμα διαγραφής αρχείου', 'error');
      return;
    }
    if (res.proposal) mergeSavedProposal(res.proposal);
    refreshHistoryIfVisible(selectedId);
    if (res.folderRemoved) {
      clearFolderExpandState(groupId, folderId);
      showToast('Το αρχείο διαγράφηκε — ο κενός φάκελος αφαιρέθηκε', 'success');
      return;
    }
    setFolderFilesCache((prev) => ({
      ...prev,
      [cacheKey]: {
        files: res.files || remainingFiles,
        loading: false,
      },
    }));
    showToast('Το αρχείο διαγράφηκε', 'success');
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

    const movedEntryPreview = isProposalFolder(entry) ? { ...entry } : { ...entry };
    const nextGroupsPreview = fileGroups.map((g) => {
      if (g.id === moveModal.sourceGroupId) {
        return { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== sourceKey) };
      }
      if (g.id === targetGroupId) {
        const withoutDup = g.files.filter((f) => getProposalEntryKey(f) !== getProposalEntryKey(movedEntryPreview));
        return { ...g, files: [...withoutDup, movedEntryPreview] };
      }
      return g;
    });

    const payload = {
      proposalId: selectedId,
      sourceGroupId: moveModal.sourceGroupId,
      targetGroupId,
      nextFileGroups: nextGroupsPreview,
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

    if (res.proposal) mergeSavedProposal(res.proposal);
    refreshHistoryIfVisible(selectedId);

    if (isProposalFolder(entry)) {
      clearFolderExpandState(moveModal.sourceGroupId, entry.id);
    }

    setMoveModal(null);
    const destLabel = nextGroupsPreview.find((g) => g.id === targetGroupId)?.label || 'κατηγορία';
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
    if (isReadOnly || !selectedProposal) return;
    if (!await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο «${fileName}»;`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    })) return;
    const nextFileGroups = selectedProposal.fileGroups.map((g) =>
      g.id === groupId
        ? { ...g, files: g.files.filter((f) => getProposalEntryKey(f) !== fileName) }
        : g
    );
    const res = await window.electronAPI.invoke('delete-proposal-file', {
      proposalId: selectedId,
      groupId,
      fileName,
      nextFileGroups,
      actingUsername: loggedInUsername,
    });
    if (!res.success) return showToast(res.error || 'Σφάλμα διαγραφής αρχείου', 'error');
    if (res.proposal) mergeSavedProposal(res.proposal);
    refreshHistoryIfVisible(selectedId);
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
      const cacheKey = getFolderExpandKey(renameModal.groupId, renameModal.folderId);
      setFolderFilesCache((prev) => {
        const cached = prev[cacheKey];
        if (!cached) return prev;
        return {
          ...prev,
          [cacheKey]: {
            ...cached,
            files: (cached.files || []).map((f) =>
              f.name === renameModal.oldName ? { ...f, name: newFileName } : f
            ),
          },
        };
      });
    }
    if (res.proposal) {
      mergeSavedProposal(res.proposal);
      markProposalPersisted(res.proposal);
    }

    refreshHistoryIfVisible(selectedId);
    if (renameModal.folderId) {
      await refreshExpandedFoldersInGroup(renameModal.groupId, selectedId);
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
    if (uploadingGroupId) {
      showToast('Περιμένετε να ολοκληρωθεί το τρέχον ανέβασμα', 'warning');
      return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;
    const paths = droppedFiles.map((f) => f.path).filter(Boolean);
    if (paths.length) await uploadToGroup(groupId, paths);
  }, [uploadToGroup, isReadOnly, uploadingGroupId, showToast]);

  /* ── Pending items ── */
  const addPendingItem = () => {
    if (isReadOnly || !pendingInput.trim()) return;
    const text = pendingInput.trim();
    const item = { id: uuidv4(), text, done: false, createdAt: new Date().toISOString() };
    const nextItems = [...(selectedProposal.pendingItems || []), item];
    updateProposal({ pendingItems: nextItems });
    setPendingInput('');
    logProposalActivityClient(`Προστέθηκε εκκρεμότητα: «${text}»`);
  };

  const togglePendingItem = (itemId) => {
    if (isReadOnly) return;
    const item = (selectedProposal.pendingItems || []).find((it) => it.id === itemId);
    const nextItems = (selectedProposal.pendingItems || []).map((it) =>
      it.id === itemId ? { ...it, done: !it.done } : it
    );
    updateProposal({ pendingItems: nextItems });
    if (item) {
      logProposalActivityClient(
        item.done
          ? `Επανάνοιγμα εκκρεμότητας: «${item.text}»`
          : `Ολοκλήρωση εκκρεμότητας: «${item.text}»`
      );
    }
  };

  const deletePendingItem = (itemId) => {
    if (isReadOnly) return;
    const item = (selectedProposal.pendingItems || []).find((it) => it.id === itemId);
    updateProposal({
      pendingItems: (selectedProposal.pendingItems || []).filter((it) => it.id !== itemId)
    });
    if (item) logProposalActivityClient(`Διαγραφή εκκρεμότητας: «${item.text}»`);
  };

  const persistProjectSnapshot = useCallback(async (projectId) => {
    if (!projectId || isReadOnly) return;
    clearPendingSaveTimer();
    pendingSaveProjectIdRef.current = null;
    pendingSaveAuditedRef.current = false;
    const latest = proposalsRef.current.find((p) => p.id === projectId);
    if (latest) await saveProposalAudited(latest);
  }, [isReadOnly, clearPendingSaveTimer, saveProposalAudited]);

  const flushProposalSave = useCallback(async () => {
    if (!selectedId || isReadOnly) return;
    clearPendingSaveTimer();
    pendingSaveProjectIdRef.current = null;
    pendingSaveAuditedRef.current = false;
    const latest = proposalsRef.current.find((p) => p.id === selectedId);
    if (latest) await saveProposalAudited(latest);
  }, [selectedId, isReadOnly, clearPendingSaveTimer, saveProposalAudited]);

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
      await persistProjectSnapshot(currentId);
      const latest = proposalsRef.current.find((p) => p.id === currentId);
      if (latest) markProposalPersisted(latest);
    } else if (action === 'discard') {
      clearPendingSaveTimer();
      pendingSaveProjectIdRef.current = null;
      pendingSaveAuditedRef.current = false;
      revertProposalToPersisted(currentId);
    }
    if (currentId && !isReadOnly) await releaseProposalLock(currentId);
    if (targetId === '__close__') {
      resolve(true);
      onClose();
      return;
    }
    setSelectedId(targetId);
    resolve(true);
  }, [
    unsavedNavModal,
    selectedId,
    isReadOnly,
    persistProjectSnapshot,
    markProposalPersisted,
    revertProposalToPersisted,
    clearPendingSaveTimer,
    releaseProposalLock,
    onClose,
  ]);

  const handleClose = useCallback(async () => {
    if (selectedId && !isReadOnly && isProposalDirty(selectedId)) {
      const ok = await new Promise((resolve) => {
        setUnsavedNavModal({ targetId: '__close__', resolve });
      });
      if (!ok) return;
    } else {
      await flushProposalSave();
    }
    await releaseProposalLock(selectedId);
    onClose();
  }, [selectedId, isReadOnly, isProposalDirty, flushProposalSave, releaseProposalLock, onClose]);

  const applyFileSearchNavigation = useCallback(async (nav, proposal) => {
    if (!nav || !proposal) return;
    const group = (proposal.fileGroups || []).find(
      (g) => g.id === nav.groupId || (nav.groupLabel && g.label === nav.groupLabel)
    );
    if (group) {
      setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
    }
    const expandFolderInline = async (groupId, folder, highlightFile = null) => {
      const key = getFolderExpandKey(groupId, folder.id);
      setExpandedFolderKeys((prev) => ({ ...prev, [key]: true }));
      const result = await window.electronAPI.invoke('get-proposal-folder-files', {
        proposalId: proposal.id,
        groupId,
        folderId: folder.id,
        syncMetadata: true,
      });
      if (!result.success) {
        showToast(result.error || 'Δεν ήταν δυνατή η φόρτωση του φακέλου', 'error');
        return;
      }
      if (result.folderRemoved) return;
      setFolderFilesCache((prev) => ({
        ...prev,
        [key]: { files: result.files || [], loading: false },
      }));
      if (highlightFile) {
        setNestedFileHighlight({ key, fileName: highlightFile });
      }
    };
    if (nav.entryKind === 'folder' && group && nav.folderId) {
      const folder = (group.files || []).find((f) => f.kind === 'folder' && f.id === nav.folderId);
      if (folder) {
        setDetailFileFilter('');
        await expandFolderInline(group.id, folder);
        return;
      }
    }
    if (nav.folderId && nav.entryKind === 'file' && group) {
      const folder = (group.files || []).find((f) => f.kind === 'folder' && f.id === nav.folderId);
      if (folder) {
        setDetailFileFilter('');
        await expandFolderInline(group.id, folder, nav.fileName);
        return;
      }
    }
    setDetailFileFilter(nav.fileName || '');
  }, [showToast]);

  useEffect(() => {
    const nav = pendingFileSearchNavRef.current;
    if (!nav || !selectedProposal || selectedProposal.id !== nav.projectId) return;
    pendingFileSearchNavRef.current = null;
    void applyFileSearchNavigation(nav, selectedProposal);
  }, [selectedProposal, applyFileSearchNavigation]);

  const handleExportConfirm = async () => {
    const target = proposals.find((p) => p.id === (exportTargetId || selectedId)) || null;
    if (!target || exporting) return;
    setExporting(true);
    try {
      await persistProjectSnapshot(target.id);
      const res = await window.electronAPI.invoke('export-proposal', {
        proposalId: target.id,
        includeFiles: exportIncludeFiles,
        actingUsername: loggedInUsername,
      });
      if (res.canceled) return;
      if (!res.success) {
        showToast(res.error || 'Σφάλμα εξαγωγής', 'error');
        return;
      }
      setShowExportDialog(false);
      setExportSuccess({
        exportPath: res.exportPath,
        missingItems: res.missingItems || [],
        missingCount: res.stats?.missingCount || res.missingItems?.length || 0,
      });
      const missingCount = res.stats?.missingCount || res.missingItems?.length || 0;
      if (missingCount > 0) {
        showToast(
          `Η εξαγωγή ολοκληρώθηκε — ${missingCount} ${missingCount === 1 ? 'στοιχείο δεν' : 'στοιχεία δεν'} βρέθηκαν στον δίσκο`,
          'warning'
        );
      } else {
        showToast('Η εξαγωγή ολοκληρώθηκε', 'success');
      }
    } catch (e) {
      showToast(`Σφάλμα εξαγωγής: ${e.message}`, 'error');
    } finally {
      setExporting(false);
      setExportTargetId(null);
    }
  };

  const closeExportDialog = () => {
    if (exporting) return;
    setShowExportDialog(false);
    setExportTargetId(null);
  };

  const handleOpenExportFromHub = (e, proposal) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setExportTargetId(proposal.id);
    setExportIncludeFiles(true);
    setShowExportDialog(true);
  };

  const handleOpenExportFromDetail = () => {
    if (isReadOnly) return;
    setExportTargetId(selectedId);
    setShowExportDialog(true);
  };

  const hubCategoryOptions = useMemo(() => {
    const set = new Set();
    proposals.forEach((p) => {
      const cat = String(p.projectCategory || '').trim();
      if (cat) set.add(cat);
    });
    projectCategories.forEach((cat) => set.add(cat));
    return [...set].sort((a, b) => a.localeCompare(b, 'el'));
  }, [proposals, projectCategories]);

  const hubMunicipalUnitOptions = useMemo(() => {
    const set = new Set(municipalUnits);
    proposals.forEach((p) => {
      const mu = String(p.municipalUnit || '').trim();
      if (mu) set.add(mu);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'el'));
  }, [proposals, municipalUnits]);

  const hubSettlementOptions = useMemo(() => {
    const set = new Set();
    proposals.forEach((p) => {
      const st = String(p.settlement || '').trim();
      if (st) set.add(st);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'el'));
  }, [proposals]);

  const showMunicipalUnitFilters = hubMunicipalUnitOptions.length > 0;
  const showSettlementFilters = hubSettlementOptions.length > 0;

  const hubListGridColumns = useMemo(() => {
    const cols = ['minmax(200px, 2.2fr)', '120px'];
    if (showMunicipalUnitFilters) cols.push('minmax(88px, 1fr)');
    if (showSettlementFilters) cols.push('minmax(88px, 1fr)');
    cols.push('88px', '56px', '88px', '130px');
    return cols.join(' ');
  }, [showMunicipalUnitFilters, showSettlementFilters]);

  const detailCategoryOptions = useMemo(() => {
    const set = new Set(projectCategories);
    const current = String(selectedProposal?.projectCategory || '').trim();
    if (current) set.add(current);
    return [...set].sort((a, b) => a.localeCompare(b, 'el'));
  }, [projectCategories, selectedProposal?.projectCategory]);

  const detailSpecializationOptions = useMemo(() => {
    const cat = selectedProposal?.projectCategory;
    const specs = getSpecializationsForCategory(cat, customCategorySpecs);
    const current = String(selectedProposal?.infrastructureSpecialization || '').trim();
    if (current && !specs.some((s) => s.toLowerCase() === current.toLowerCase())) {
      return [...specs, current].sort((a, b) => a.localeCompare(b, 'el'));
    }
    return specs;
  }, [customCategorySpecs, selectedProposal?.projectCategory, selectedProposal?.infrastructureSpecialization]);

  const newProjectSpecializationOptions = useMemo(() => {
    return getSpecializationsForCategory(newProjectDraft.projectCategory, customCategorySpecs);
  }, [newProjectDraft.projectCategory, customCategorySpecs]);

  const hubFilteredProposals = useMemo(() => {
    const filtered = orimanthiCatalog.filterOrimanthiHub(proposals, {
      search,
      categoryFilter: hubCategoryFilter,
      statusFilter: hubStatusFilter,
      municipalUnitFilter: hubMunicipalUnitFilter,
      settlementFilter: hubSettlementFilter,
      quickFilter: hubQuickFilter,
    });
    return sortHubProjects(filtered, hubSortBy);
  }, [
    proposals, search, hubCategoryFilter, hubStatusFilter,
    hubMunicipalUnitFilter, hubSettlementFilter, hubSortBy, hubQuickFilter,
  ]);

  const hubHasSecondaryFilters = Boolean(
    hubCategoryFilter
    || hubStatusFilter
    || hubMunicipalUnitFilter
    || hubSettlementFilter
    || hubSortBy !== 'created_desc'
    || fileSearch.trim()
    || hubQuickFilter
    || hubViewMode !== 'list'
  );

  const hubHasActiveFilters = Boolean(
    search.trim()
    || hubCategoryFilter
    || hubStatusFilter
    || hubMunicipalUnitFilter
    || hubSettlementFilter
    || hubSortBy !== 'created_desc'
    || hubQuickFilter
    || fileSearch.trim()
  );

  const clearHubFilters = useCallback(() => {
    setSearch('');
    setHubCategoryFilter('');
    setHubStatusFilter('');
    setHubMunicipalUnitFilter('');
    setHubSettlementFilter('');
    setHubSortBy('created_desc');
    setHubQuickFilter('');
    setFileSearch('');
    setFileSearchResults([]);
  }, []);

  const applyHubQuickFilter = useCallback((value) => {
    setHubQuickFilter((prev) => (prev === value ? '' : value));
    if (value === 'maturing' || value === 'ready' || value === 'approved') {
      setHubStatusFilter('');
    }
  }, []);

  const richHubStats = useMemo(
    () => computeExtendedHubStats(proposals, PROJECT_MATURITY_STATUSES),
    [proposals]
  );

  const applyStatsFilter = useCallback(({ status, category, municipalUnit, settlement } = {}) => {
    if (status) {
      setHubStatusFilter(status);
      setHubQuickFilter('');
    }
    if (category) {
      setHubCategoryFilter(category === 'Χωρίς κατηγορία' ? HUB_UNCategorized_FILTER : category);
    }
    if (municipalUnit) {
      setHubMunicipalUnitFilter(
        municipalUnit === 'Χωρίς δημοτική ενότητα' ? HUB_NO_MUNICIPAL_FILTER : municipalUnit
      );
    }
    if (settlement) {
      setHubSettlementFilter(
        settlement === 'Χωρίς οικισμό' ? HUB_NO_SETTLEMENT_FILTER : settlement
      );
    }
    setShowHubStatsModal(false);
  }, []);

  const openProjectFromFileSearch = useCallback((result) => {
    pendingFileSearchNavRef.current = result;
    void requestSelectProposal(result.projectId).then((ok) => {
      if (!ok) {
        pendingFileSearchNavRef.current = null;
        return;
      }
      setActiveTab('files');
      setFileSearch('');
      setFileSearchResults([]);
    });
  }, [requestSelectProposal]);

  const applyPendingTemplate = useCallback(async () => {
    if (isReadOnly || !selectedId || !selectedProposal) return;
    if (!selectedProposal.projectCategory) {
      showToast('Ορίστε κατηγορία έργου στα Στοιχεία', 'warning');
      setActiveTab('details');
      return;
    }
    setApplyingPendingTemplate(true);
    try {
      const res = await window.electronAPI.invoke('apply-orimanthi-pending-template', {
        proposalId: selectedId,
        category: selectedProposal.projectCategory,
        actingUsername: loggedInUsername,
        action: 'apply',
      });
      if (!res.success) {
        showToast(res.error || 'Σφάλμα εφαρμογής προτύπου', 'error');
        return;
      }
      if (res.proposal) {
        mergeSavedProposal(res.proposal);
        markProposalPersisted(res.proposal);
      }
      if (res.addedCount > 0) {
        showToast(`Προστέθηκαν ${res.addedCount} εκκρεμότητες από πρότυπο`, 'success');
        setActiveTab('pending');
      } else {
        showToast(res.message || 'Το πρότυπο εφαρμόστηκε', 'success');
      }
    } finally {
      setApplyingPendingTemplate(false);
    }
  }, [
    isReadOnly,
    selectedId,
    selectedProposal,
    loggedInUsername,
    showToast,
    mergeSavedProposal,
    markProposalPersisted,
  ]);

  const removePendingTemplate = useCallback(async () => {
    if (isReadOnly || !selectedId || !selectedProposal?.projectCategory) return;
    if (!await showConfirm({
      title: 'Αφαίρεση προτύπου',
      message: 'Να αφαιρεθούν όλες οι εκκρεμότητες που προστέθηκαν από το πρότυπο;',
      detail: 'Οι χειροκίνητα προστεθείσες εκκρεμότητες δεν επηρεάζονται.',
      confirmLabel: 'Αφαίρεση',
      icon: '↩',
      danger: true,
    })) return;

    setApplyingPendingTemplate(true);
    try {
      const res = await window.electronAPI.invoke('apply-orimanthi-pending-template', {
        proposalId: selectedId,
        category: selectedProposal.projectCategory,
        actingUsername: loggedInUsername,
        action: 'remove',
      });
      if (!res.success) {
        showToast(res.error || 'Σφάλμα αφαίρεσης προτύπου', 'error');
        return;
      }
      if (res.proposal) {
        mergeSavedProposal(res.proposal);
        markProposalPersisted(res.proposal);
      }
      if (res.removedCount > 0) {
        showToast(`Αφαιρέθηκαν ${res.removedCount} εκκρεμότητες του προτύπου`, 'success');
      } else {
        showToast('Το πρότυπο αφαιρέθηκε', 'info');
      }
      logProposalActivityClient(`Αφαίρεση προτύπου εκκρεμοτήτων (${selectedProposal.projectCategory})`);
    } finally {
      setApplyingPendingTemplate(false);
    }
  }, [
    isReadOnly,
    selectedId,
    selectedProposal,
    loggedInUsername,
    showToast,
    mergeSavedProposal,
    markProposalPersisted,
    logProposalActivityClient,
  ]);

  const isPendingTemplateActive = selectedProposal?.pendingTemplateCategory
    && categoriesAreEquivalent(
      selectedProposal.pendingTemplateCategory,
      selectedProposal.projectCategory
    );

  const showDetailSpecialization = selectedProposal?.projectCategory
    && shouldShowSpecializationField(
      selectedProposal.projectCategory,
      customCategorySpecs,
      {
        currentSpec: selectedProposal.infrastructureSpecialization,
        forceVisible: detailShowSpecializationField,
      }
    );

  const showNewProjectSpecialization = newProjectDraft.projectCategory
    && shouldShowSpecializationField(
      newProjectDraft.projectCategory,
      customCategorySpecs,
      {
        currentSpec: newProjectDraft.infrastructureSpecialization,
        forceVisible: newProjectShowSpecializationField,
      }
    );

  const handleHubReportExport = useCallback(async (format) => {
    if (hubReportExporting || isReadOnly) return;
    setHubReportExporting(true);
    try {
      const res = await window.electronAPI.invoke('export-orimanthi-hub-report', {
        format,
        actingUsername: loggedInUsername,
        proposalIds: hubHasActiveFilters
          ? hubFilteredProposals.map((p) => p.id)
          : undefined,
      });
      if (res.canceled) return;
      if (!res.success) showToast(res.error || 'Σφάλμα εξαγωγής αναφοράς', 'error');
      else if (res.pdfFallback) {
        showToast(
          res.message || 'Δεν ήταν δυνατή η δημιουργία PDF. Αποθηκεύτηκε styled HTML — ανοίξτε το και εκτυπώστε σε PDF.',
          'warning'
        );
      } else if (res.format === 'html') {
        showToast(`Η αναφορά αποθηκεύτηκε ως HTML (${res.rowCount || 0} έργα) — εκτύπωση σε PDF από browser`, 'success');
      } else {
        showToast(`Η αναφορά αποθηκεύτηκε (${res.rowCount || 0} έργα)`, 'success');
      }
    } finally {
      setHubReportExporting(false);
    }
  }, [hubReportExporting, isReadOnly, loggedInUsername, showToast, hubHasActiveFilters, hubFilteredProposals]);

  const saveAepoReminderSettings = useCallback(async (nextAepoCfg) => {
    const merged = {
      ...(orimanthiConfig || {}),
      aepoReminders: { ...(orimanthiConfig?.aepoReminders || {}), ...nextAepoCfg },
    };
    const res = await window.electronAPI.invoke('save-orimanthi-config', {
      config: merged,
      actingUsername: loggedInUsername,
    });
    if (!res.success) {
      showToast(res.error || 'Σφάλμα αποθήκευσης ρυθμίσεων', 'error');
      return;
    }
    setOrimanthiConfig(res.config);
    showToast('Οι ρυθμίσεις ΑΕΠΟ αποθηκεύτηκαν', 'success');
    setShowAepoSettingsModal(false);
  }, [orimanthiConfig, loggedInUsername, showToast]);

  const renderFormalHubCard = (p) => {
    const st = getStatusStyle(p.status);
    const fileCount = getProjectFileCount(p);
    const pendingTotal = (p.pendingItems || []).length;
    const pendingOpen = getProjectPendingOpen(p);
    const categoryLine = [
      p.projectCategory,
      p.infrastructureSpecialization || '',
    ].filter(Boolean).join(' · ');
    const openProject = () => {
      void requestSelectProposal(p.id).then((ok) => { if (ok) setActiveTab('files'); });
    };
    const lockInfo = proposalLocks[p.id];
    return (
      <HubCard key={p.id}>
        <HubCardHeader>
          <HubCardClickArea type="button" onClick={openProject}>
            <HubCardTitle>{p.title || '(Χωρίς τίτλο)'}</HubCardTitle>
          </HubCardClickArea>
          <HubCardStatusBadge $color={st.color} $bg={st.bg}>
            <StatusDot $color={st.color} />
            {st.label}
          </HubCardStatusBadge>
          {lockInfo ? (
            <span
              title={`Ανοιχτό από ${typeof lockInfo === 'string' ? lockInfo : 'άλλο χρήστη'}`}
              style={{ fontSize: '0.85rem', marginLeft: '0.25rem' }}
            >
              🔒
            </span>
          ) : null}
        </HubCardHeader>
        <HubCardBody>
          {categoryLine ? (
            <HubCardMetaLine>{categoryLine}</HubCardMetaLine>
          ) : (
            <HubCardMetaLine style={{ color: C.slate400, fontStyle: 'italic' }}>Χωρίς κατηγορία</HubCardMetaLine>
          )}
          {p.aepoRenewalDate ? (
            <HubCardMetaLine>ΑΕΠΟ: {formatAepoDate(p.aepoRenewalDate)}</HubCardMetaLine>
          ) : null}
          {(p.municipalUnit || p.settlement) ? (
            <HubCardMetaLine>
              {[p.municipalUnit, p.settlement].filter(Boolean).join(' · ')}
            </HubCardMetaLine>
          ) : null}
        </HubCardBody>
        <HubCardFooter>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <HubCardStat>{fileCount} αρχεία</HubCardStat>
            {pendingTotal > 0 && (
              <HubCardStat>{pendingOpen} ανοιχτές / {pendingTotal}</HubCardStat>
            )}
            <HubCardStat>Ενημ.: {formatShortDateEl(p.updatedAt || p.createdAt)}</HubCardStat>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <HubRowBtn type="button" $primary onClick={openProject}>Άνοιγμα</HubRowBtn>
            <HubRowBtn
              type="button"
              title="Εξαγωγή έργου"
              disabled={exporting || isReadOnly}
              onClick={(e) => handleOpenExportFromHub(e, p)}
            >
              Εξαγωγή
            </HubRowBtn>
          </div>
        </HubCardFooter>
      </HubCard>
    );
  };

  const renderHubListRow = (p) => {
    const st = getStatusStyle(p.status);
    const fileCount = getProjectFileCount(p);
    const categoryLine = [
      p.projectCategory,
      p.infrastructureSpecialization || '',
    ].filter(Boolean).join(' · ');
    const openProject = () => {
      void requestSelectProposal(p.id).then((ok) => { if (ok) setActiveTab('files'); });
    };
    const lockInfo = proposalLocks[p.id];
    return (
      <HubListRow key={p.id} $gridColumns={hubListGridColumns}>
        <HubListTitleCell type="button" onClick={openProject}>
          <HubListTitle>{p.title || '(Χωρίς τίτλο)'}</HubListTitle>
          {categoryLine ? <HubListSub>{categoryLine}</HubListSub> : null}
        </HubListTitleCell>
        <HubListCell>
          <HubRowStatus $color={st.color}>
            <StatusDot $color={st.color} />
            {st.label}
          </HubRowStatus>
        </HubListCell>
        {showMunicipalUnitFilters ? (
          <HubListCell title={p.municipalUnit || ''}>
            {p.municipalUnit || '—'}
          </HubListCell>
        ) : null}
        {showSettlementFilters ? (
          <HubListCell title={p.settlement || ''}>
            {p.settlement || '—'}
          </HubListCell>
        ) : null}
        <HubListCell>{p.aepoRenewalDate ? formatAepoDate(p.aepoRenewalDate) : '—'}</HubListCell>
        <HubListCell>{fileCount}</HubListCell>
        <HubListCell>{formatShortDateEl(p.updatedAt || p.createdAt)}</HubListCell>
        <HubRowActions>
          <HubRowBtn type="button" $primary onClick={openProject}>Άνοιγμα</HubRowBtn>
          <HubRowBtn
            type="button"
            disabled={exporting || isReadOnly}
            onClick={(e) => handleOpenExportFromHub(e, p)}
          >
            Εξαγωγή
          </HubRowBtn>
        </HubRowActions>
      </HubListRow>
    );
  };

  const exportDialogProposal = useMemo(
    () => proposals.find((p) => p.id === (exportTargetId || selectedId)) || null,
    [proposals, exportTargetId, selectedId]
  );

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

  /* ── Hub list ── */
  const hubStats = richHubStats;

  const statusStyle = selectedProposal ? getStatusStyle(selectedProposal.status) : null;

  const totalFiles = selectedProposal ? countProposalFiles(selectedProposal) : 0;
  const doneItems = selectedProposal
    ? (selectedProposal.pendingItems || []).filter((i) => i.done).length
    : 0;
  const totalItems = selectedProposal ? (selectedProposal.pendingItems || []).length : 0;
  const hasNotes = selectedProposal ? hasProposalNotes(selectedProposal.notes) : false;

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) void handleClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader $formal={!selectedProposal}>
          <HeaderTitle>
            <HeaderIcon>{selectedProposal ? '🌱' : '📋'}</HeaderIcon>
            <HeaderText>
              <HeaderH>Ωρίμανση Έργων</HeaderH>
              <HeaderSub>
                {proposals.length > 0
                  ? `${formatProjectCount(proposals.length)} · Βάση Δεδομένων Ωρίμανσης`
                  : 'Βάση Δεδομένων Ωρίμανσης Έργων'}
              </HeaderSub>
            </HeaderText>
          </HeaderTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', zIndex: 1 }}>
            {isReadOnly && (
              <ReadOnlyBadge>👁 Προβολή μόνο</ReadOnlyBadge>
            )}
            {!selectedProposal && !isReadOnly && (
              <HeaderPrimaryBtn
                type="button"
                onClick={openNewProjectModal}
                disabled={creatingProject}
              >
                ＋ Νέο έργο
              </HeaderPrimaryBtn>
            )}
            {selectedProposal && !isReadOnly && (
              <HeaderActionBtn
                type="button"
                onClick={handleOpenExportFromDetail}
                disabled={exporting}
                title="Εξαγωγή έργου"
              >
                {exporting ? '⏳ Εξαγωγή…' : '📤 Εξαγωγή'}
              </HeaderActionBtn>
            )}
            <CloseBtn onClick={() => void handleClose()} title="Κλείσιμο και επιστροφή στο Dashboard">✕</CloseBtn>
          </div>
        </ModalHeader>

        {/* Body */}
        <Body>
          {!selectedProposal ? (
            <>
              <HubShell>
                <HubControlsPanel>
                  <HubToolbarCard>
                    <HubSearch
                      placeholder="Αναζήτηση έργου, κατηγορίας, δημ. ενότητας, οικισμού…"
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
                    <HubStatsBtn type="button" onClick={() => setShowHubStatsModal(true)}>
                      📊 Στατιστικά
                    </HubStatsBtn>
                    {!isReadOnly && (
                      <>
                        <HubStatsBtn
                          type="button"
                          disabled={hubReportExporting}
                          onClick={() => handleHubReportExport('excel')}
                          title="Εξαγωγή λίστας έργων σε Excel"
                        >
                          {hubReportExporting ? '⏳ …' : '📗 Excel'}
                        </HubStatsBtn>
                        <HubStatsBtn
                          type="button"
                          disabled={hubReportExporting}
                          onClick={() => handleHubReportExport('pdf')}
                          title="Εξαγωγή λίστας έργων σε PDF"
                        >
                          {hubReportExporting ? '⏳ …' : '📕 PDF'}
                        </HubStatsBtn>
                        <HubStatsBtn type="button" onClick={() => setShowAepoSettingsModal(true)} title="Ρυθμίσεις email ΑΕΠΟ">
                          🔔 ΑΕΠΟ
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
                    <HubSearch
                      placeholder="Αναζήτηση αρχείων (min. 2 χαρακτήρες)…"
                      value={fileSearch}
                      onChange={(e) => setFileSearch(e.target.value)}
                      style={{ flex: '1 1 220px', minWidth: 200 }}
                    />
                    <HubFilterSelect
                      value={hubCategoryFilter}
                      onChange={(e) => setHubCategoryFilter(e.target.value)}
                      title="Φίλτρο κατηγορίας"
                    >
                      <option value="">Όλες οι κατηγορίες</option>
                      <option value={HUB_UNCategorized_FILTER}>Χωρίς κατηγορία</option>
                      {hubCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </HubFilterSelect>
                    <HubFilterSelect
                      value={hubStatusFilter}
                      onChange={(e) => {
                        setHubStatusFilter(e.target.value);
                        setHubQuickFilter('');
                      }}
                      title="Φίλτρο κατάστασης"
                    >
                      <option value="">Όλες οι καταστάσεις</option>
                      {PROJECT_MATURITY_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </HubFilterSelect>
                    {showMunicipalUnitFilters ? (
                      <HubFilterSelect
                        value={hubMunicipalUnitFilter}
                        onChange={(e) => setHubMunicipalUnitFilter(e.target.value)}
                        title="Φίλτρο δημοτικής ενότητας"
                      >
                        <option value="">Όλες οι δημ. ενότητες</option>
                        <option value={HUB_NO_MUNICIPAL_FILTER}>Χωρίς δημοτική ενότητα</option>
                        {hubMunicipalUnitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </HubFilterSelect>
                    ) : null}
                    {showSettlementFilters ? (
                      <HubFilterSelect
                        value={hubSettlementFilter}
                        onChange={(e) => setHubSettlementFilter(e.target.value)}
                        title="Φίλτρο οικισμού"
                      >
                        <option value="">Όλοι οι οικισμοί</option>
                        <option value={HUB_NO_SETTLEMENT_FILTER}>Χωρίς οικισμό</option>
                        {hubSettlementOptions.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </HubFilterSelect>
                    ) : null}
                    <HubFilterSelect
                      value={hubSortBy}
                      onChange={(e) => setHubSortBy(e.target.value)}
                      title="Ταξινόμηση"
                    >
                      {HUB_SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </HubFilterSelect>
                    <HubViewToggle>
                      <HubViewBtn
                        type="button"
                        $active={hubViewMode === 'list'}
                        onClick={() => setHubViewMode('list')}
                      >
                        Λίστα
                      </HubViewBtn>
                      <HubViewBtn
                        type="button"
                        $active={hubViewMode === 'grid'}
                        onClick={() => setHubViewMode('grid')}
                      >
                        Πλέγμα
                      </HubViewBtn>
                      <HubViewBtn
                        type="button"
                        $active={hubViewMode === 'kanban'}
                        onClick={() => setHubViewMode('kanban')}
                      >
                        Kanban
                      </HubViewBtn>
                    </HubViewToggle>
                  </HubFiltersPanel>
                  )}
                  {!loadingProposals && proposals.length > 0 && (
                    <>
                      <HubSummaryBar type="button" onClick={() => setShowHubStatsModal(true)} title="Άνοιγμα στατιστικών">
                        <HubStatHighlight $color={C.indigoDark} $bg={C.indigoLight}>
                          <strong>{proposals.length}</strong> έργα
                        </HubStatHighlight>
                        <HubStatHighlight $color={C.amber} $bg="#fffbeb">
                          {hubStats.maturing} υπό ωρίμανση
                        </HubStatHighlight>
                        <HubStatHighlight $color={C.teal} $bg={C.tealLight}>
                          {hubStats.ready} ώριμα
                        </HubStatHighlight>
                        <HubStatHighlight $color={C.emerald} $bg="#f0fdf4">
                          {hubStats.approved} εγκεκριμένα
                        </HubStatHighlight>
                        {hubFilteredProposals.length !== proposals.length && (
                          <>
                            <HubSummarySep>·</HubSummarySep>
                            <span>Εμφάνιση <strong>{hubFilteredProposals.length}</strong></span>
                          </>
                        )}
                      </HubSummaryBar>
                      <HubQuickFilters>
                        {[
                          { value: '', label: 'Όλα' },
                          { value: 'maturing', label: 'Υπό ωρίμανση' },
                          { value: 'ready', label: 'Ώριμα' },
                          { value: 'approved', label: 'Εγκεκριμένα' },
                          { value: 'aepo_soon', label: 'ΑΕΠΟ ≤60 ημέρες' },
                          { value: 'pending', label: 'Με εκκρεμότητες' },
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
                {(fileSearch.trim().length >= 2 || fileSearchLoading) && (
                  <FileSearchPanel>
                    <FileSearchPanelHead>
                      <span>
                        {fileSearchLoading
                          ? 'Αναζήτηση αρχείων…'
                          : `Αποτελέσματα αρχείων (${fileSearchResults.length})`}
                      </span>
                      {!fileSearchLoading && (
                        <HubClearFiltersBtn type="button" onClick={() => setFileSearch('')}>
                          Κλείσιμο
                        </HubClearFiltersBtn>
                      )}
                    </FileSearchPanelHead>
                    {!fileSearchLoading && fileSearchResults.length > 0 && (
                      <FileSearchResults>
                        {fileSearchResults.map((row, idx) => (
                          <FileSearchRow
                            key={`${row.projectId}-${row.fileName}-${idx}`}
                            type="button"
                            onClick={() => openProjectFromFileSearch(row)}
                          >
                            <FileSearchRowTitle>{row.fileName}</FileSearchRowTitle>
                            <FileSearchRowMeta>
                              {row.projectTitle} · {row.groupLabel}
                              {row.projectCategory ? ` · ${row.projectCategory}` : ''}
                            </FileSearchRowMeta>
                          </FileSearchRow>
                        ))}
                      </FileSearchResults>
                    )}
                    {!fileSearchLoading && fileSearchResults.length === 0 && (
                      <HubEmpty style={{ padding: '1rem', fontSize: '0.76rem' }}>
                        Δεν βρέθηκαν αρχεία με αυτό το κριτήριο.
                      </HubEmpty>
                    )}
                  </FileSearchPanel>
                )}
                {loadingProposals ? (
                  hubViewMode === 'list' ? (
                    <HubSkeletonList>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <HubSkeletonRow key={i} />
                      ))}
                    </HubSkeletonList>
                  ) : (
                    <HubSkeletonGrid>
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <HubSkeletonCard key={i} />
                      ))}
                    </HubSkeletonGrid>
                  )
                ) : hubFilteredProposals.length === 0 ? (
                  <HubEmpty>
                    {proposals.length === 0 ? (
                      <>
                        <EmptyStateIcon>📋</EmptyStateIcon>
                        <EmptyStateText>Δεν υπάρχουν καταγεγραμμένα έργα</EmptyStateText>
                        <EmptyStateSub>
                          Ξεκινήστε με «Νέο έργο» για να καταγράψετε έργα υπό ωρίμανση, αδειοδοτήσεις και μελέτες.
                        </EmptyStateSub>
                      </>
                    ) : (
                      'Δεν βρέθηκαν έργα με τα τρέχοντα κριτήρια.\nΔοκιμάστε άλλο φίλτρο ή καθαρισμό.'
                    )}
                  </HubEmpty>
                ) : hubViewMode === 'list' ? (
                  <HubListWrap>
                    <HubListHead $gridColumns={hubListGridColumns}>
                      <span>Τίτλος / κατηγορία</span>
                      <span>Κατάσταση</span>
                      {showMunicipalUnitFilters ? <span>Δημ. ενότητα</span> : null}
                      {showSettlementFilters ? <span>Οικισμός</span> : null}
                      <span>ΑΕΠΟ</span>
                      <span>Αρχ.</span>
                      <span>Ενημέρωση</span>
                      <span />
                    </HubListHead>
                    {hubFilteredProposals.map((p) => renderHubListRow(p))}
                  </HubListWrap>
                ) : hubViewMode === 'kanban' ? (
                  <HubKanban>
                    {PROJECT_MATURITY_STATUSES.map((statusDef) => {
                      const columnItems = hubFilteredProposals.filter((p) => p.status === statusDef.value);
                      if (columnItems.length === 0 && hubStatusFilter && hubStatusFilter !== statusDef.value) {
                        return null;
                      }
                      return (
                        <KanbanColumn key={statusDef.value}>
                          <KanbanColumnHeader $bg={statusDef.bg}>
                            <KanbanColumnTitle $color={statusDef.color}>
                              <StatusDot $color={statusDef.color} />
                              {statusDef.label}
                            </KanbanColumnTitle>
                            <KanbanColumnCount>{columnItems.length}</KanbanColumnCount>
                          </KanbanColumnHeader>
                          <KanbanColumnBody>
                            {columnItems.length === 0 ? (
                              <HubCardMetaLine style={{ padding: '0.35rem', fontStyle: 'italic' }}>
                                Κανένα έργο
                              </HubCardMetaLine>
                            ) : (
                              columnItems.map((p) => renderFormalHubCard(p))
                            )}
                          </KanbanColumnBody>
                        </KanbanColumn>
                      );
                    })}
                  </HubKanban>
                ) : (
                  <HubGrid>
                    {hubFilteredProposals.map((p) => renderFormalHubCard(p))}
                  </HubGrid>
                )}
              </HubShell>
            </>
          ) : (
            <MainContent>
              <DetailTopBar>
                <BackToHubBtn type="button" onClick={() => void requestSelectProposal(null)}>
                  <BackToHubIcon>←</BackToHubIcon>
                  Επιστροφή στη λίστα
                </BackToHubBtn>
                <BreadcrumbBar>
                  <span style={{ color: C.slate400, fontWeight: 700 }}>Τρέχον έργο:</span>
                  {selectedProposal.projectCategory ? (
                    <>
                      <span>{selectedProposal.projectCategory}</span>
                      <BreadcrumbSep>/</BreadcrumbSep>
                    </>
                  ) : null}
                  <BreadcrumbCurrent title={selectedProposal.title || ''}>
                    {selectedProposal.title || '(Χωρίς τίτλο)'}
                  </BreadcrumbCurrent>
                </BreadcrumbBar>
              </DetailTopBar>
              <StickyDetailHeader>
                <StickyTitleRow>
                  <StickyTitleText title={selectedProposal.title || ''}>
                    {selectedProposal.title || '(Χωρίς τίτλο)'}
                  </StickyTitleText>
                  <DetailStatusBadge $color={statusStyle?.color} $bg={statusStyle?.bg}>
                    <StatusDot $color={statusStyle?.color} />
                    {statusStyle?.label}
                  </DetailStatusBadge>
                  {saving && <Saving>Αποθήκευση…</Saving>}
                </StickyTitleRow>
                <TabBar>
                  <Tab $active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                    Στοιχεία
                  </Tab>
                  <Tab $active={activeTab === 'files'} onClick={() => setActiveTab('files')}>
                    Αρχεία ({totalFiles})
                  </Tab>
                  <Tab $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                    Εκκρεμ. ({doneItems}/{totalItems})
                  </Tab>
                  <Tab
                    $active={activeTab === 'notes'}
                    $hasContent={hasNotes && activeTab !== 'notes'}
                    onClick={() => setActiveTab('notes')}
                  >
                    Σημειώσεις
                    {hasNotes && <TabIndicator title="Υπάρχουν σημειώσεις" />}
                  </Tab>
                  <Tab $active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                    Ιστορικό
                  </Tab>
                </TabBar>
              </StickyDetailHeader>
              <DetailScrollArea>
                <DetailBody>
                  {activeTab === 'details' && (
                    <MetaCompactPanel>
                      <MetaFieldBoxWide as="div">
                        <MetaLabel htmlFor="proposal-title-input">Τίτλος έργου</MetaLabel>
                        <TitleInput
                          id="proposal-title-input"
                          placeholder="Τίτλος έργου…"
                          value={selectedProposal.title}
                          readOnly={isReadOnly}
                          onChange={isReadOnly ? undefined : (e) => updateProposal({ title: e.target.value })}
                          onBlur={handleTitleBlur}
                        />
                      </MetaFieldBoxWide>
                      <MetaCompactRow>
                        <MetaFieldBox>
                          <MetaLabel>Κατάσταση</MetaLabel>
                          <StatusSelect
                            value={selectedProposal.status}
                            $color={statusStyle?.color}
                            $bg={statusStyle?.bg}
                            disabled={isReadOnly}
                            onChange={isReadOnly ? undefined : (e) => updateProposalAudited({ status: e.target.value })}
                          >
                            {PROJECT_MATURITY_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </StatusSelect>
                        </MetaFieldBox>
                        <MetaFieldBox>
                          <MetaLabelRow>
                            <MetaLabel>Κατηγορία</MetaLabel>
                            {!isReadOnly && (
                              <ManageListsLink
                                type="button"
                                onClick={() => setShowManageListsModal(true)}
                                title="Διαχείριση προσαρμοσμένων κατηγοριών και εξειδικεύσεων"
                              >
                                Διαχείριση λιστών
                              </ManageListsLink>
                            )}
                          </MetaLabelRow>
                          <StatusSelect
                            value={detailShowAddCategoryInput ? '' : (selectedProposal.projectCategory || '')}
                            disabled={isReadOnly}
                            onChange={isReadOnly ? undefined : (e) => {
                              const val = e.target.value;
                              if (val === ADD_NEW_CATEGORY_OPTION) {
                                setDetailShowAddCategoryInput(true);
                                setDetailNewCategoryInput('');
                                return;
                              }
                              setDetailShowAddCategoryInput(false);
                              setDetailNewCategoryInput('');
                              setDetailShowSpecializationField(
                                categoryHasSpecializations(val, customCategorySpecs)
                              );
                              updateProposalAudited({
                                projectCategory: val,
                                pendingTemplateCategory: reconcilePendingTemplateCategory(
                                  selectedProposal.projectCategory,
                                  val,
                                  selectedProposal.pendingTemplateCategory
                                ),
                                infrastructureSpecialization: keepSpecializationForCategory(
                                  val,
                                  selectedProposal.infrastructureSpecialization,
                                  customCategorySpecs
                                ),
                              });
                            }}
                          >
                            <option value="">— Επιλογή —</option>
                            {detailCategoryOptions.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            {!isReadOnly && (
                              <>
                                <option disabled value="__sep_cat__">──────────────</option>
                                <option value={ADD_NEW_CATEGORY_OPTION}>+ Νέα κατηγορία</option>
                              </>
                            )}
                          </StatusSelect>
                          {!isReadOnly && detailShowAddCategoryInput && (
                            <InlineAddRow style={{ marginTop: '0.35rem' }}>
                              <FormInput
                                placeholder="Όνομα κατηγορίας…"
                                value={detailNewCategoryInput}
                                onChange={(e) => setDetailNewCategoryInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const added = addCustomProjectCategory(detailNewCategoryInput);
                                    if (added) {
                                      updateProposalAudited({
                                        projectCategory: added,
                                        infrastructureSpecialization: keepSpecializationForCategory(
                                          added,
                                          selectedProposal.infrastructureSpecialization,
                                          customCategorySpecs
                                        ),
                                      });
                                      setDetailNewCategoryInput('');
                                      setDetailShowAddCategoryInput(false);
                                    }
                                  }
                                  if (e.key === 'Escape') {
                                    setDetailShowAddCategoryInput(false);
                                    setDetailNewCategoryInput('');
                                  }
                                }}
                                autoFocus
                              />
                              <Btn
                                $sm
                                $variant="primary"
                                type="button"
                                onClick={() => {
                                  const added = addCustomProjectCategory(detailNewCategoryInput);
                                  if (added) {
                                    updateProposalAudited({
                                      projectCategory: added,
                                      infrastructureSpecialization: keepSpecializationForCategory(
                                        added,
                                        selectedProposal.infrastructureSpecialization,
                                        customCategorySpecs
                                      ),
                                    });
                                    setDetailNewCategoryInput('');
                                    setDetailShowAddCategoryInput(false);
                                  }
                                }}
                              >
                                ✓
                              </Btn>
                              <Btn
                                $sm
                                $variant="ghost"
                                type="button"
                                onClick={() => {
                                  setDetailShowAddCategoryInput(false);
                                  setDetailNewCategoryInput('');
                                }}
                              >
                                ✕
                              </Btn>
                            </InlineAddRow>
                          )}
                        </MetaFieldBox>
                        {selectedProposal.projectCategory ? (
                          showDetailSpecialization ? (
                          <MetaFieldBox>
                            <MetaLabel>
                              Εξειδίκευση
                              {categoryHasSpecializations(selectedProposal.projectCategory, customCategorySpecs)
                                ? ' *'
                                : ''}
                            </MetaLabel>
                            <StatusSelect
                              value={detailShowAddSpecializationInput ? '' : (selectedProposal.infrastructureSpecialization || '')}
                              disabled={isReadOnly}
                              onChange={isReadOnly ? undefined : (e) => {
                                const val = e.target.value;
                                if (val === ADD_NEW_SPECIALIZATION_OPTION) {
                                  setDetailShowAddSpecializationInput(true);
                                  setDetailNewSpecializationInput('');
                                  return;
                                }
                                setDetailShowAddSpecializationInput(false);
                                setDetailNewSpecializationInput('');
                                updateProposalAudited({ infrastructureSpecialization: val });
                              }}
                            >
                              <option value="">— Επιλογή —</option>
                              {detailSpecializationOptions.map((spec) => (
                                <option key={spec} value={spec}>{spec}</option>
                              ))}
                              {!isReadOnly && (
                                <>
                                  <option disabled value="__sep_spec__">──────────────</option>
                                  <option value={ADD_NEW_SPECIALIZATION_OPTION}>+ Νέα εξειδίκευση</option>
                                </>
                              )}
                            </StatusSelect>
                            {!isReadOnly && detailShowAddSpecializationInput && (
                              <InlineAddRow style={{ marginTop: '0.35rem' }}>
                                <FormInput
                                  placeholder="Όνομα εξειδίκευσης…"
                                  value={detailNewSpecializationInput}
                                  onChange={(e) => setDetailNewSpecializationInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const added = addCustomCategorySpecialization(
                                        selectedProposal.projectCategory,
                                        detailNewSpecializationInput
                                      );
                                      if (added) {
                                        updateProposalAudited({ infrastructureSpecialization: added });
                                        setDetailNewSpecializationInput('');
                                        setDetailShowAddSpecializationInput(false);
                                      }
                                    }
                                    if (e.key === 'Escape') {
                                      setDetailShowAddSpecializationInput(false);
                                      setDetailNewSpecializationInput('');
                                    }
                                  }}
                                  autoFocus
                                />
                                <Btn
                                  $sm
                                  $variant="primary"
                                  type="button"
                                  onClick={() => {
                                    const added = addCustomCategorySpecialization(
                                      selectedProposal.projectCategory,
                                      detailNewSpecializationInput
                                    );
                                    if (added) {
                                      updateProposalAudited({ infrastructureSpecialization: added });
                                      setDetailNewSpecializationInput('');
                                      setDetailShowAddSpecializationInput(false);
                                    }
                                  }}
                                >
                                  ✓
                                </Btn>
                                <Btn
                                  $sm
                                  $variant="ghost"
                                  type="button"
                                  onClick={() => {
                                    setDetailShowAddSpecializationInput(false);
                                    setDetailNewSpecializationInput('');
                                  }}
                                >
                                  ✕
                                </Btn>
                              </InlineAddRow>
                            )}
                          </MetaFieldBox>
                          ) : !isReadOnly ? (
                            <MetaFieldBox>
                              <ManageListsLink
                                type="button"
                                onClick={() => setDetailShowSpecializationField(true)}
                                title="Εμφάνιση πεδίου εξειδίκευσης"
                              >
                                + Ορισμός εξειδικεύσης
                              </ManageListsLink>
                            </MetaFieldBox>
                          ) : null
                        ) : null}
                        <MetaFieldBox>
                          <MetaLabel>Δημοτική Ενότητα</MetaLabel>
                          <StatusSelect
                            value={selectedProposal.municipalUnit || ''}
                            disabled={isReadOnly}
                            onMouseDown={isReadOnly ? undefined : warnIfMunicipalUnitsEmpty}
                            onFocus={isReadOnly ? undefined : warnIfMunicipalUnitsEmpty}
                            onChange={isReadOnly ? undefined : (e) => updateProposalAudited({ municipalUnit: e.target.value })}
                          >
                            <option value="">— Επιλογή —</option>
                            {municipalUnits.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </StatusSelect>
                        </MetaFieldBox>
                        <MetaFieldBox>
                          <MetaLabel>Οικισμός</MetaLabel>
                          <MetaInput
                            placeholder="Όνομα οικισμού…"
                            value={selectedProposal.settlement || ''}
                            readOnly={isReadOnly}
                            onChange={isReadOnly ? undefined : (e) => updateProposal({ settlement: e.target.value })}
                            onBlur={isReadOnly ? undefined : handleDescriptionBlur}
                          />
                        </MetaFieldBox>
                        <MetaFieldBox>
                          <MetaLabel>Ανανέωση ΑΕΠΟ</MetaLabel>
                          <MetaInput
                            type="date"
                            value={selectedProposal.aepoRenewalDate || ''}
                            readOnly={isReadOnly}
                            onChange={isReadOnly ? undefined : (e) => updateProposalAudited({ aepoRenewalDate: e.target.value })}
                            title={selectedProposal.aepoRenewalDate ? formatAepoDate(selectedProposal.aepoRenewalDate) : ''}
                          />
                        </MetaFieldBox>
                      </MetaCompactRow>
                      <MetaFieldBoxWide>
                        <MetaLabel>Περιγραφή</MetaLabel>
                        <DescriptionInput
                          placeholder="Σύντομη περιγραφή (προαιρετικό)"
                          value={selectedProposal.description}
                          readOnly={isReadOnly}
                          onChange={isReadOnly ? undefined : (e) => updateProposal({ description: e.target.value })}
                          onBlur={handleDescriptionBlur}
                        />
                      </MetaFieldBoxWide>
                    </MetaCompactPanel>
                  )}

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
                            <OrimanthiFileCategoryPicker
                              existingGroups={selectedProposal?.fileGroups || []}
                              customMeletesSpecs={customMeletesFileSpecs}
                              customAdeiodotiseisSpecs={customAdeiodotiseisFileSpecs}
                              onSelect={addFileCategoryGroup}
                              onCancel={handleCancelAddGroup}
                              onAddCustomSpec={(rootId, spec) => addCustomFileSpec(rootId, spec)}
                            />
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
                            ▼ Όλες οι κατηγορίες
                          </ExpandAllBtn>
                          <DetailFileFilter
                            placeholder="Αναζήτηση αρχείου σε αυτό το έργο…"
                            value={detailFileFilter}
                            onChange={(e) => setDetailFileFilter(e.target.value)}
                          />
                        </GroupsToolbar>
                      )}

                      <GroupsList>
                      {(selectedProposal.fileGroups || []).map((group) => {
                        const expanded = expandedGroups[group.id] === true;
                        const isDragging = draggingGroupId === group.id;
                        const isGroupUploading = uploadingGroupId === group.id;
                        const isAnyUploading = uploadingGroupId != null;
                        const visibleFiles = filterGroupFiles(group, detailFileFilter, detailFolderFilterMatches);
                        const isEmpty = visibleFiles.length === 0;
                        if (detailFileFilter.trim() && visibleFiles.length === 0) return null;
                        return (
                          <GroupCard key={group.id}>
                            <GroupCardHeader
                              $open={expanded}
                              onClick={() => toggleGroupExpanded(group.id)}
                            >
                              <GroupName>
                                {renderFileGroupTitle(group)}
                                <GroupCount $hasFiles={countGroupFileEntries(group) > 0}>
                                  {countGroupFileEntries(group)}
                                </GroupCount>
                              </GroupName>
                              <GroupActions onClick={(e) => e.stopPropagation()}>
                                {!isReadOnly && expanded && (
                                  <>
                                    <Btn
                                      $sm
                                      $variant="ghost"
                                      disabled={isAnyUploading}
                                      onClick={() => handleSelectFiles(group.id)}
                                    >
                                      {isGroupUploading ? '⏳ Ανέβασμα…' : '+ Αρχεία'}
                                    </Btn>
                                    <Btn
                                      $sm
                                      $variant="teal"
                                      disabled={isAnyUploading}
                                      onClick={() => handleSelectFolder(group.id)}
                                    >
                                      {isGroupUploading ? '⏳ …' : 'Φάκελος'}
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
                                $dragging={isDragging && !isAnyUploading}
                                onDragOver={!isReadOnly && !isAnyUploading ? (e) => { e.preventDefault(); setDraggingGroupId(group.id); } : undefined}
                                onDragLeave={!isReadOnly && !isAnyUploading ? () => setDraggingGroupId(null) : undefined}
                                onDrop={!isReadOnly && !isAnyUploading ? (e) => handleDrop(e, group.id) : undefined}
                              >
                                {visibleFiles.length > 0 ? (
                                  <FilesList>
                                    {visibleFiles.map((entry) => {
                                      if (isProposalFolder(entry)) {
                                        const count = entry.fileCount || 0;
                                        const expandKey = getFolderExpandKey(group.id, entry.id);
                                        const folderExpanded = !!expandedFolderKeys[expandKey];
                                        const folderCache = folderFilesCache[expandKey];
                                        return (
                                          <FolderEntryBlock key={entry.id}>
                                            <FolderHeaderItem
                                              $open={folderExpanded}
                                              onClick={() => toggleFolderExpanded(group.id, entry)}
                                            >
                                              <FileInfo>
                                                <span style={{ fontSize: '0.65rem', color: C.slate400, flexShrink: 0, width: '0.85rem' }}>
                                                  {folderExpanded ? '▼' : '▶'}
                                                </span>
                                                <FileTypeIcon $bg={FOLDER_TYPE_STYLE.bg} style={{ fontSize: '1.05rem' }}>
                                                  {FOLDER_TYPE_STYLE.label}
                                                </FileTypeIcon>
                                                <div style={{ minWidth: 0 }}>
                                                  <FileListName title={entry.name}>{entry.name}</FileListName>
                                                  <FileListMeta>
                                                    {count} {count === 1 ? 'αρχείο' : 'αρχεία'}
                                                    {folderExpanded ? ' · κλικ για σύμπτυξη' : ' · κλικ για ανάπτυξη'}
                                                  </FileListMeta>
                                                </div>
                                              </FileInfo>
                                              <FileActions onClick={(e) => e.stopPropagation()}>
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
                                            </FolderHeaderItem>
                                            {folderExpanded && (
                                              <NestedFilesTree>
                                                {folderCache?.loading ? (
                                                  <div style={{ color: C.slate400, fontSize: '0.78rem', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                                    Φόρτωση αρχείων…
                                                  </div>
                                                ) : (folderCache?.files || []).length === 0 ? (
                                                  <div style={{ color: C.slate400, fontSize: '0.78rem', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                                    Ο φάκελος είναι κενός.
                                                  </div>
                                                ) : (
                                                  (folderCache.files || []).map((f) => {
                                                    const typeStyle = getFileTypeStyle(f.name);
                                                    const NestedIconWrap = isImageFileName(f.name) ? FileTypeIconLarge : FileTypeIcon;
                                                    const isHighlighted =
                                                      nestedFileHighlight?.key === expandKey
                                                      && nestedFileHighlight?.fileName === f.name;
                                                    return (
                                                      <NestedFileItem
                                                        key={f.name}
                                                        ref={isHighlighted ? highlightedFolderFileRef : undefined}
                                                        style={
                                                          isHighlighted
                                                            ? { background: C.indigoLight, outline: `2px solid ${C.indigo}` }
                                                            : undefined
                                                        }
                                                      >
                                                        <FileInfo>
                                                          <NestedIconWrap $bg={typeStyle.bg}>{typeStyle.label}</NestedIconWrap>
                                                          <div style={{ minWidth: 0 }}>
                                                            <FileListName title={f.name}>{f.name}</FileListName>
                                                            <FileListMeta>{formatBytes(f.size)}</FileListMeta>
                                                          </div>
                                                        </FileInfo>
                                                        <FileActions>
                                                          <ViewIconBtn
                                                            title="Προβολή"
                                                            onClick={() => handleOpenFolderFile(group.id, entry.id, f.name)}
                                                          >
                                                            👁
                                                          </ViewIconBtn>
                                                          <DownloadIconBtn
                                                            title="Λήψη"
                                                            onClick={() => handleDownloadFolderFile(group.id, entry.id, f.name)}
                                                          >
                                                            ⬇
                                                          </DownloadIconBtn>
                                                          {!isReadOnly && (
                                                            <>
                                                              <RenameIconBtn
                                                                title="Μετονομασία"
                                                                onClick={() => handleOpenRename(group.id, f.name, entry.id)}
                                                              >
                                                                ✎
                                                              </RenameIconBtn>
                                                              <DeleteIconBtn
                                                                title="Διαγραφή"
                                                                onClick={() => handleDeleteFolderFile(group.id, entry.id, f.name)}
                                                              >
                                                                ✕
                                                              </DeleteIconBtn>
                                                            </>
                                                          )}
                                                        </FileActions>
                                                      </NestedFileItem>
                                                    );
                                                  })
                                                )}
                                              </NestedFilesTree>
                                            )}
                                          </FolderEntryBlock>
                                        );
                                      }
                                      const typeStyle = getFileTypeStyle(entry.name);
                                      const IconWrap = isImageFileName(entry.name) ? FileTypeIconLarge : FileTypeIcon;
                                      return (
                                        <FileItem key={entry.name}>
                                          <FileInfo>
                                            <IconWrap $bg={typeStyle.bg}>{typeStyle.label}</IconWrap>
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
                                  <EmptyGroupHint $dragging={isDragging && !isAnyUploading}>
                                    {isReadOnly
                                      ? 'Δεν υπάρχουν αρχεία σε αυτή την κατηγορία'
                                      : (isGroupUploading
                                        ? 'Ανέβασμα αρχείων…'
                                        : (isAnyUploading
                                          ? 'Περιμένετε το τρέχον ανέβασμα…'
                                          : (isDragging ? 'Αφήστε τα αρχεία εδώ…' : 'Σύρτε αρχεία εδώ ή χρησιμοποιήστε τα κουμπιά πάνω')))}
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
                      {!isReadOnly && selectedProposal?.projectCategory && (
                        <div style={{ marginBottom: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                          {isPendingTemplateActive ? (
                            <>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: C.amber,
                                background: '#fffbeb',
                                border: `1px solid ${C.amber}44`,
                                borderRadius: 999,
                                padding: '0.2rem 0.55rem',
                              }}>
                                📋 Πρότυπο ενεργό
                              </span>
                              <Btn
                                $sm
                                $variant="ghost"
                                disabled={applyingPendingTemplate}
                                onClick={() => void removePendingTemplate()}
                                title={`Αφαίρεση προτύπου «${selectedProposal.projectCategory}»`}
                              >
                                {applyingPendingTemplate ? '⏳ …' : '↩ Αφαίρεση προτύπου'}
                              </Btn>
                            </>
                          ) : (
                            <Btn
                              $sm
                              $variant="teal"
                              disabled={applyingPendingTemplate}
                              onClick={() => void applyPendingTemplate()}
                              title={`Πρότυπο για «${selectedProposal.projectCategory}»`}
                            >
                              {applyingPendingTemplate ? '⏳ …' : '📋 Εφαρμογή προτύπου εκκρεμοτήτων'}
                            </Btn>
                          )}
                        </div>
                      )}
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
                              <PendingDeleteBtn
                                type="button"
                                onClick={() => deletePendingItem(item.id)}
                                title="Διαγραφή εκκρεμότητας"
                                aria-label={`Διαγραφή: ${item.text}`}
                              >
                                ✕
                              </PendingDeleteBtn>
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
                      {hasNotes && isReadOnly && (
                        <NotesPreview>{selectedProposal.notes}</NotesPreview>
                      )}
                      {!isReadOnly ? (
                        <NotesTextarea
                          placeholder="Ελεύθερες σημειώσεις για το έργο… (κατάσταση αδειοδοτήσεων, επαφές, χρονοδιάγραμμα κ.ά.)"
                          value={selectedProposal.notes}
                          onChange={(e) => updateProposal({ notes: e.target.value })}
                          onBlur={handleNotesBlur}
                        />
                      ) : !hasNotes ? (
                        <div style={{ color: C.slate400, fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Δεν υπάρχουν σημειώσεις.
                        </div>
                      ) : null}
                    </>
                  )}

                  {/* Tab: History */}
                  {activeTab === 'history' && (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        marginBottom: '0.65rem',
                      }}
                      >
                        <SectionLabel style={{ marginBottom: 0, flex: 1 }}>Ιστορικό αλλαγών</SectionLabel>
                        {userRole === 'SUPERADMIN' && (
                          <Btn
                            $sm
                            $variant="ghost"
                            type="button"
                            onClick={handleClearProjectHistory}
                            disabled={clearingHistory || historyLoading || projectHistory.length === 0}
                            title="Διαγραφή όλων των καταγραφών ιστορικού για αυτό το έργο"
                          >
                            {clearingHistory ? '⏳ Εκκαθάριση…' : '🗑 Εκκάθαριση ιστορικού'}
                          </Btn>
                        )}
                      </div>
                      {historyLoading ? (
                        <div style={{ color: C.slate500, fontSize: '0.8rem', fontWeight: 600 }}>
                          Φόρτωση ιστορικού…
                        </div>
                      ) : projectHistory.length === 0 ? (
                        <div style={{ color: C.slate400, fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Δεν υπάρχουν καταγεγραμμένες ενέργειες για αυτό το έργο.
                        </div>
                      ) : (
                        <HistoryList>
                          {projectHistory.map((log) => (
                            <HistoryItem key={log.id || `${log.timestamp}-${log.action}`}>
                              <HistoryItemHead>
                                <HistoryAction>
                                  {PROPOSAL_ACTION_LABELS[log.action] || log.action}
                                </HistoryAction>
                                <HistoryTime>{formatDateTimeEl(log.timestamp)}</HistoryTime>
                              </HistoryItemHead>
                              <HistoryBody>{summarizeHistoryEntry(log)}</HistoryBody>
                              <HistoryUser>{log.userFullName || log.user || 'Άγνωστος'}</HistoryUser>
                            </HistoryItem>
                          ))}
                        </HistoryList>
                      )}
                    </>
                  )}
                </DetailBody>
              </DetailScrollArea>

              <DetailFooter>
                  {!isReadOnly ? (
                    <Btn $sm $variant="danger" onClick={handleDeleteProposal}>
                      🗑 Διαγραφή έργου
                    </Btn>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: C.slate400, fontWeight: 600 }}>
                      👁 Λειτουργία προβολής — δεν επιτρέπονται αλλαγές
                    </span>
                  )}
                  {saving && <Saving>Αποθηκεύεται…</Saving>}
                </DetailFooter>
            </MainContent>
          )}
        </Body>
      </Modal>

      {showNewProjectModal && (
        <FolderModalOverlay onClick={() => !creatingProject && resetNewProjectModal()}>
          <WideModalCard onClick={(e) => e.stopPropagation()}>
            <NewProjectModalHeader>
              <NewProjectModalTitle>＋ Νέο Έργο</NewProjectModalTitle>
              <NewProjectModalSub>
                Καταγραφή νέου έργου στη βάση ωρίμανσης — συμπληρώστε τα στοιχεία και προσθέστε αρχεία/φακέλους.
              </NewProjectModalSub>
            </NewProjectModalHeader>
            <WideModalBody>
              <ModalFormSection>
                <ModalFormSectionHead>
                  <ModalFormSectionIcon>📋</ModalFormSectionIcon>
                  <ModalFormSectionTitle>Στοιχεία έργου</ModalFormSectionTitle>
                </ModalFormSectionHead>
                <FormGrid>
                  <ModalFormFieldFull>
                    <ModalFormLabel htmlFor="new-project-title">Τίτλος έργου *</ModalFormLabel>
                    <ModalFormInput
                      id="new-project-title"
                      ref={newProjectTitleRef}
                      placeholder="π.χ. Ανακατασκευή οδού Κεντρικής…"
                      value={newProjectDraft.title}
                      onChange={(e) => setNewProjectDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  </ModalFormFieldFull>
                  <ModalFormField>
                    <MetaLabelRow>
                      <ModalFormLabel htmlFor="new-project-category">Κατηγορία *</ModalFormLabel>
                      <ManageListsLink
                        type="button"
                        onClick={() => setShowManageListsModal(true)}
                        title="Διαχείριση προσαρμοσμένων κατηγοριών και εξειδικεύσεων"
                      >
                        Διαχείριση λιστών
                      </ManageListsLink>
                    </MetaLabelRow>
                    <ModalFormSelect
                      id="new-project-category"
                      value={showAddCategoryInput ? '' : newProjectDraft.projectCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === ADD_NEW_CATEGORY_OPTION) {
                          setShowAddCategoryInput(true);
                          setNewCategoryInput('');
                          return;
                        }
                        setShowAddCategoryInput(false);
                        setNewCategoryInput('');
                        setNewProjectShowSpecializationField(
                          categoryHasSpecializations(val, customCategorySpecs)
                        );
                        setNewProjectDraft((d) => ({
                          ...d,
                          projectCategory: val,
                          infrastructureSpecialization: keepSpecializationForCategory(
                            val,
                            d.infrastructureSpecialization,
                            customCategorySpecs
                          ),
                        }));
                      }}
                    >
                      <option value="">— Επιλέξτε κατηγορία —</option>
                      {projectCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option disabled value="__sep__">──────────────</option>
                      <option value={ADD_NEW_CATEGORY_OPTION}>+ Νέα κατηγορία</option>
                    </ModalFormSelect>
                    {showAddCategoryInput && (
                      <InlineAddRow>
                        <ModalFormInput
                          placeholder="Όνομα κατηγορίας…"
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const added = addCustomProjectCategory(newCategoryInput);
                              if (added) {
                                setNewProjectDraft((d) => ({ ...d, projectCategory: added }));
                                setNewCategoryInput('');
                                setShowAddCategoryInput(false);
                              }
                            }
                            if (e.key === 'Escape') {
                              setShowAddCategoryInput(false);
                              setNewCategoryInput('');
                            }
                          }}
                          autoFocus
                        />
                        <Btn
                          $sm
                          $variant="primary"
                          type="button"
                          onClick={() => {
                            const added = addCustomProjectCategory(newCategoryInput);
                            if (added) {
                              setNewProjectDraft((d) => ({ ...d, projectCategory: added }));
                              setNewCategoryInput('');
                              setShowAddCategoryInput(false);
                            }
                          }}
                        >
                          ✓
                        </Btn>
                        <Btn $sm $variant="ghost" type="button" onClick={() => {
                          setShowAddCategoryInput(false);
                          setNewCategoryInput('');
                        }}
                        >
                          ✕
                        </Btn>
                      </InlineAddRow>
                    )}
                  </ModalFormField>
                  {showNewProjectSpecialization ? (
                    <ModalFormField>
                      <ModalFormLabel htmlFor="new-project-spec">
                        Εξειδίκευση
                        {categoryHasSpecializations(newProjectDraft.projectCategory, customCategorySpecs)
                          ? ' *'
                          : ''}
                      </ModalFormLabel>
                      <ModalFormSelect
                        id="new-project-spec"
                        value={showAddSpecializationInput ? '' : newProjectDraft.infrastructureSpecialization}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === ADD_NEW_SPECIALIZATION_OPTION) {
                            setShowAddSpecializationInput(true);
                            setNewSpecializationInput('');
                            return;
                          }
                          setShowAddSpecializationInput(false);
                          setNewSpecializationInput('');
                          setNewProjectDraft((d) => ({
                            ...d,
                            infrastructureSpecialization: val,
                          }));
                        }}
                      >
                        <option value="">— Επιλέξτε εξειδίκευση —</option>
                        {newProjectSpecializationOptions.map((spec) => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                        <option disabled value="__sep_spec__">──────────────</option>
                        <option value={ADD_NEW_SPECIALIZATION_OPTION}>+ Νέα εξειδίκευση</option>
                      </ModalFormSelect>
                      {showAddSpecializationInput && (
                        <InlineAddRow>
                          <ModalFormInput
                            placeholder="Όνομα εξειδίκευσης…"
                            value={newSpecializationInput}
                            onChange={(e) => setNewSpecializationInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const added = addCustomCategorySpecialization(
                                  newProjectDraft.projectCategory,
                                  newSpecializationInput
                                );
                                if (added) {
                                  setNewProjectDraft((d) => ({ ...d, infrastructureSpecialization: added }));
                                  setNewSpecializationInput('');
                                  setShowAddSpecializationInput(false);
                                }
                              }
                              if (e.key === 'Escape') {
                                setShowAddSpecializationInput(false);
                                setNewSpecializationInput('');
                              }
                            }}
                            autoFocus
                          />
                          <Btn
                            $sm
                            $variant="primary"
                            type="button"
                            onClick={() => {
                              const added = addCustomCategorySpecialization(
                                newProjectDraft.projectCategory,
                                newSpecializationInput
                              );
                              if (added) {
                                setNewProjectDraft((d) => ({ ...d, infrastructureSpecialization: added }));
                                setNewSpecializationInput('');
                                setShowAddSpecializationInput(false);
                              }
                            }}
                          >
                            ✓
                          </Btn>
                          <Btn $sm $variant="ghost" type="button" onClick={() => {
                            setShowAddSpecializationInput(false);
                            setNewSpecializationInput('');
                          }}
                          >
                            ✕
                          </Btn>
                        </InlineAddRow>
                      )}
                    </ModalFormField>
                  ) : newProjectDraft.projectCategory ? (
                    <ModalFormField>
                      <ManageListsLink
                        type="button"
                        onClick={() => setNewProjectShowSpecializationField(true)}
                        title="Εμφάνιση πεδίου εξειδίκευσης"
                      >
                        + Ορισμός εξειδικεύσης
                      </ManageListsLink>
                    </ModalFormField>
                  ) : null}
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-project-municipal-unit">Δημοτική Ενότητα</ModalFormLabel>
                    <ModalFormSelect
                      id="new-project-municipal-unit"
                      value={newProjectDraft.municipalUnit}
                      onMouseDown={warnIfMunicipalUnitsEmpty}
                      onFocus={warnIfMunicipalUnitsEmpty}
                      onChange={(e) => setNewProjectDraft((d) => ({ ...d, municipalUnit: e.target.value }))}
                    >
                      <option value="">— Επιλέξτε δημοτική ενότητα —</option>
                      {municipalUnits.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </ModalFormSelect>
                  </ModalFormField>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-project-settlement">Οικισμός</ModalFormLabel>
                    <ModalFormInput
                      id="new-project-settlement"
                      placeholder="Όνομα οικισμού…"
                      value={newProjectDraft.settlement}
                      onChange={(e) => setNewProjectDraft((d) => ({ ...d, settlement: e.target.value }))}
                    />
                  </ModalFormField>
                  <ModalFormField>
                    <ModalFormLabel htmlFor="new-project-aepo">Ημερομηνία ανανέωσης ΑΕΠΟ</ModalFormLabel>
                    <ModalFormInput
                      id="new-project-aepo"
                      type="date"
                      value={newProjectDraft.aepoRenewalDate}
                      onChange={(e) => setNewProjectDraft((d) => ({ ...d, aepoRenewalDate: e.target.value }))}
                    />
                  </ModalFormField>
                </FormGrid>
              </ModalFormSection>

              <NewProjectFilesSection>
                <StagedFilesHead>
                  <NewProjectFilesTitle>Αρχεία ανά κατηγορία</NewProjectFilesTitle>
                </StagedFilesHead>
                <AddGroupToolbar style={{ marginBottom: '0.65rem' }}>
                  {!newProjectShowCategoryPicker ? (
                    <AddCategoryTrigger type="button" onClick={handleNewProjectOpenCategoryPicker}>
                      + Προσθήκη κατηγορίας
                    </AddCategoryTrigger>
                  ) : (
                    <OrimanthiFileCategoryPicker
                      existingGroups={newProjectStagedGroups}
                      customMeletesSpecs={customMeletesFileSpecs}
                      customAdeiodotiseisSpecs={customAdeiodotiseisFileSpecs}
                      onSelect={addNewProjectFileCategoryGroup}
                      onCancel={handleNewProjectCancelAddGroup}
                      onAddCustomSpec={(rootId, spec) => addCustomFileSpec(rootId, spec)}
                    />
                  )}
                </AddGroupToolbar>

                {newProjectStagedGroups.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: C.slate400, fontStyle: 'italic' }}>
                    Προαιρετικά — προσθέστε κατηγορίες αρχείων (Μελέτες έργου ή Αδειοδοτήσεις) και ανεβάστε αρχεία ή φακέλους σε κάθε μία.
                  </div>
                ) : (
                  <GroupsList>
                    {newProjectStagedGroups.map((group) => {
                      const expanded = newProjectExpandedGroups[group.id] === true;
                      const itemCount = (group.stagedFiles?.length || 0) + (group.stagedFolders?.length || 0);
                      return (
                        <GroupCard key={group.id}>
                          <GroupCardHeader
                            $open={expanded}
                            onClick={() => toggleNewProjectGroupExpanded(group.id)}
                          >
                            <GroupName>
                              {renderFileGroupTitle(group)}
                              <GroupCount $hasFiles={itemCount > 0}>{itemCount}</GroupCount>
                            </GroupName>
                            <GroupActions onClick={(e) => e.stopPropagation()}>
                              {expanded && (
                                <>
                                  <Btn $sm $variant="ghost" onClick={() => handleNewProjectPickFiles(group.id)}>
                                    + Αρχεία
                                  </Btn>
                                  <Btn $sm $variant="teal" onClick={() => handleNewProjectPickFolder(group.id)}>
                                    Φάκελος
                                  </Btn>
                                </>
                              )}
                              <Btn
                                $sm
                                $variant="danger"
                                onClick={() => deleteNewProjectGroup(group.id, group.label)}
                              >
                                ✕
                              </Btn>
                              <span style={{ fontSize: '0.7rem', color: C.slate400, marginLeft: '0.15rem' }}>
                                {expanded ? '▼' : '▶'}
                              </span>
                            </GroupActions>
                          </GroupCardHeader>
                          {expanded && (
                            <GroupFilesArea $empty={itemCount === 0} $dragging={false}>
                              {itemCount === 0 ? (
                                <div style={{ color: C.slate400, fontSize: '0.76rem', fontStyle: 'italic', padding: '0.35rem 0' }}>
                                  Πατήστε «+ Αρχεία» ή «Φάκελος» για να προσθέσετε περιεχόμενο σε αυτή την κατηγορία.
                                </div>
                              ) : (
                                <>
                                  {(group.stagedFiles || []).map((f) => (
                                    <StagedFileItem key={f.path}>
                                      <span>📄 {f.name}</span>
                                      <DeleteIconBtn
                                        type="button"
                                        title="Αφαίρεση"
                                        onClick={() => setNewProjectStagedGroups((prev) => prev.map((g) => (
                                          g.id === group.id
                                            ? { ...g, stagedFiles: g.stagedFiles.filter((x) => x.path !== f.path) }
                                            : g
                                        )))}
                                      >
                                        ✕
                                      </DeleteIconBtn>
                                    </StagedFileItem>
                                  ))}
                                  {(group.stagedFolders || []).map((folder) => (
                                    <StagedFileItem key={folder.id}>
                                      <span>📁 {folder.folderName} ({folder.files.length} αρχεία)</span>
                                      <DeleteIconBtn
                                        type="button"
                                        title="Αφαίρεση"
                                        onClick={() => setNewProjectStagedGroups((prev) => prev.map((g) => (
                                          g.id === group.id
                                            ? { ...g, stagedFolders: g.stagedFolders.filter((x) => x.id !== folder.id) }
                                            : g
                                        )))}
                                      >
                                        ✕
                                      </DeleteIconBtn>
                                    </StagedFileItem>
                                  ))}
                                </>
                              )}
                            </GroupFilesArea>
                          )}
                        </GroupCard>
                      );
                    })}
                  </GroupsList>
                )}
              </NewProjectFilesSection>
            </WideModalBody>
            <WideModalFooter>
              <Btn $sm $variant="ghost" onClick={resetNewProjectModal} disabled={creatingProject}>Ακύρωση</Btn>
              <Btn $sm $variant="primary" onClick={handleConfirmNewProject} disabled={creatingProject}>
                {creatingProject ? '⏳ Δημιουργία…' : '✓ Δημιουργία έργου'}
              </Btn>
            </WideModalFooter>
          </WideModalCard>
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
                          {countGroupFileEntries(g)} {countGroupFileEntries(g) === 1 ? 'αρχείο' : 'αρχεία'}
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

      {showManageListsModal && (
        <FolderModalOverlay onClick={() => setShowManageListsModal(false)}>
          <FolderModalCard onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <FolderModalHeader>
              <FolderModalTitle>Διαχείριση λιστών</FolderModalTitle>
              <FolderModalSub>
                Διαγραφή προσαρμοσμένων κατηγοριών, εξειδικεύσεων και τύπων αρχείων από τις λίστες επιλογής.
                Οι προεπιλεγμένες τιμές δεν μπορούν να αφαιρεθούν.
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <ManageListSection>
                <ManageListSectionTitle>Προσαρμοσμένες κατηγορίες</ManageListSectionTitle>
                {customCategories.length === 0 ? (
                  <ManageListEmpty>Δεν υπάρχουν προσαρμοσμένες κατηγορίες.</ManageListEmpty>
                ) : (
                  customCategories.map((cat) => {
                    const usage = countProjectsWithCategory(cat);
                    return (
                      <ManageListRow key={cat}>
                        <ManageListRowLabel>{cat}</ManageListRowLabel>
                        <ManageListRowMeta>
                          {usage > 0 ? `${usage} ${usage === 1 ? 'έργο' : 'έργα'}` : 'χωρίς χρήση'}
                        </ManageListRowMeta>
                        <ManageListDeleteBtn
                          type="button"
                          disabled={removingListItem === `cat:${cat}`}
                          onClick={() => handleRemoveCustomCategory(cat)}
                          title="Αφαίρεση από τη λίστα"
                        >
                          {removingListItem === `cat:${cat}` ? '…' : 'Διαγραφή'}
                        </ManageListDeleteBtn>
                      </ManageListRow>
                    );
                  })
                )}
              </ManageListSection>
              <ManageListSection>
                <ManageListSectionTitle>Προσθήκη εξειδίκευσης σε κατηγορία</ManageListSectionTitle>
                <InlineAddRow style={{ marginBottom: '0.5rem' }}>
                  <ModalFormSelect
                    value={manageSpecCategory}
                    onChange={(e) => setManageSpecCategory(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">— Κατηγορία —</option>
                    {projectCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </ModalFormSelect>
                  <ModalFormInput
                    placeholder="Νέα εξειδίκευση…"
                    value={manageSpecInput}
                    onChange={(e) => setManageSpecInput(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manageSpecCategory && manageSpecInput.trim()) {
                        addCustomCategorySpecialization(manageSpecCategory, manageSpecInput, { showSuccessToast: true });
                        setManageSpecInput('');
                      }
                    }}
                  />
                  <Btn
                    $sm
                    $variant="primary"
                    type="button"
                    disabled={!manageSpecCategory || !manageSpecInput.trim()}
                    onClick={() => {
                      if (addCustomCategorySpecialization(manageSpecCategory, manageSpecInput, { showSuccessToast: true })) {
                        setManageSpecInput('');
                      }
                    }}
                  >
                    +
                  </Btn>
                </InlineAddRow>
              </ManageListSection>
              {categoriesWithCustomSpecs.length === 0 ? (
                <ManageListSection>
                  <ManageListEmpty>Δεν υπάρχουν προσαρμοσμένες εξειδικεύσεις κατηγοριών.</ManageListEmpty>
                </ManageListSection>
              ) : (
                categoriesWithCustomSpecs.map((cat) => (
                  <ManageListSection key={cat}>
                    <ManageListSectionTitle>Εξειδικεύσεις — {cat}</ManageListSectionTitle>
                    {getCustomSpecsForCategory(cat, customCategorySpecs).map((spec) => {
                      const usage = countProjectsWithSpecialization(cat, spec);
                      return (
                        <ManageListRow key={`${cat}:${spec}`}>
                          <ManageListRowLabel>{spec}</ManageListRowLabel>
                          <ManageListRowMeta>
                            {usage > 0 ? `${usage} ${usage === 1 ? 'έργο' : 'έργα'}` : 'χωρίς χρήση'}
                          </ManageListRowMeta>
                          <ManageListDeleteBtn
                            type="button"
                            disabled={removingListItem === `spec:${cat}:${spec}`}
                            onClick={() => handleRemoveCustomSpecialization(cat, spec)}
                            title="Αφαίρεση από τη λίστα"
                          >
                            {removingListItem === `spec:${cat}:${spec}` ? '…' : 'Διαγραφή'}
                          </ManageListDeleteBtn>
                        </ManageListRow>
                      );
                    })}
                  </ManageListSection>
                ))
              )}
              <ManageListSection>
                <ManageListSectionTitle>Προσαρμοσμένες εξειδικεύσεις — Μελέτες έργου</ManageListSectionTitle>
                {customMeletesFileSpecs.length === 0 ? (
                  <ManageListEmpty>Δεν υπάρχουν προσαρμοσμένες εξειδικεύσεις.</ManageListEmpty>
                ) : (
                  customMeletesFileSpecs.map((spec) => (
                    <ManageListRow key={`meletes:${spec}`}>
                      <ManageListRowLabel>{spec}</ManageListRowLabel>
                      <ManageListDeleteBtn
                        type="button"
                        onClick={() => handleRemoveCustomMeletesFileSpec(spec)}
                        title="Αφαίρεση από τη λίστα"
                      >
                        Διαγραφή
                      </ManageListDeleteBtn>
                    </ManageListRow>
                  ))
                )}
              </ManageListSection>
              <ManageListSection>
                <ManageListSectionTitle>Προσαρμοσμένες εξειδικεύσεις — Αδειοδοτήσεις</ManageListSectionTitle>
                {customAdeiodotiseisFileSpecs.length === 0 ? (
                  <ManageListEmpty>Δεν υπάρχουν προσαρμοσμένες εξειδικεύσεις.</ManageListEmpty>
                ) : (
                  customAdeiodotiseisFileSpecs.map((spec) => (
                    <ManageListRow key={`adeiod:${spec}`}>
                      <ManageListRowLabel>{spec}</ManageListRowLabel>
                      <ManageListDeleteBtn
                        type="button"
                        onClick={() => handleRemoveCustomAdeiodotiseisFileSpec(spec)}
                        title="Αφαίρεση από τη λίστα"
                      >
                        Διαγραφή
                      </ManageListDeleteBtn>
                    </ManageListRow>
                  ))
                )}
              </ManageListSection>
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="ghost" onClick={() => setShowManageListsModal(false)}>Κλείσιμο</Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {showHubStatsModal && (
        <FolderModalOverlay onClick={() => setShowHubStatsModal(false)}>
          <FolderModalCard onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <FolderModalHeader>
              <FolderModalTitle>Στατιστικά ωρίμανσης έργων</FolderModalTitle>
              <FolderModalSub>
                Πλήρης επισκόπηση {formatProjectCount(richHubStats.total)} · {richHubStats.totalFiles} αρχεία · {richHubStats.totalPendingOpen} ανοιχτές εκκρεμότητες
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <StatsGrid>
                <StatsCard>
                  <StatsCardValue>{richHubStats.total}</StatsCardValue>
                  <StatsCardLabel>Σύνολο έργων</StatsCardLabel>
                </StatsCard>
                <StatsCard>
                  <StatsCardValue>{richHubStats.totalFiles}</StatsCardValue>
                  <StatsCardLabel>Συνολικά αρχεία</StatsCardLabel>
                </StatsCard>
                <StatsCard>
                  <StatsCardValue>{richHubStats.totalPendingOpen}</StatsCardValue>
                  <StatsCardLabel>Ανοιχτές εκκρεμότητες</StatsCardLabel>
                </StatsCard>
                <StatsCard>
                  <StatsCardValue>{richHubStats.withAepo}</StatsCardValue>
                  <StatsCardLabel>Με ημερομηνία ΑΕΠΟ</StatsCardLabel>
                </StatsCard>
                <StatsCard>
                  <StatsCardValue>{richHubStats.aepoDueSoon}</StatsCardValue>
                  <StatsCardLabel>ΑΕΠΟ εντός 60 ημερών</StatsCardLabel>
                </StatsCard>
                <StatsCard>
                  <StatsCardValue>{richHubStats.withNotes}</StatsCardValue>
                  <StatsCardLabel>Με σημειώσεις</StatsCardLabel>
                </StatsCard>
                {showMunicipalUnitFilters ? (
                  <StatsCard>
                    <StatsCardValue>{richHubStats.withMunicipalUnit}</StatsCardValue>
                    <StatsCardLabel>Με δημοτική ενότητα</StatsCardLabel>
                  </StatsCard>
                ) : null}
                {showSettlementFilters ? (
                  <StatsCard>
                    <StatsCardValue>{richHubStats.withSettlement}</StatsCardValue>
                    <StatsCardLabel>Με οικισμό</StatsCardLabel>
                  </StatsCard>
                ) : null}
              </StatsGrid>

              <StatsDonutRow>
                <StatsDonutBlock>
                  <StatsDonut $gradient={buildDonutGradient(richHubStats.statusDonut)} />
                  <StatsDonutLegend>
                    <StatsSectionTitle style={{ marginBottom: '0.35rem' }}>Κατάσταση</StatsSectionTitle>
                    {richHubStats.statusDonut.filter((s) => s.value > 0).map((seg) => (
                      <StatsDonutLegendItem
                        key={seg.key}
                        type="button"
                        onClick={() => applyStatsFilter({ status: seg.key })}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                          <StatsDonutDot $color={seg.color} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {seg.label}
                          </span>
                        </span>
                        <StatsBreakdownCount>{seg.value}</StatsBreakdownCount>
                      </StatsDonutLegendItem>
                    ))}
                  </StatsDonutLegend>
                </StatsDonutBlock>
                {richHubStats.categoryDonut.length > 0 && (
                  <StatsDonutBlock>
                    <StatsDonut $gradient={buildDonutGradient(richHubStats.categoryDonut)} />
                    <StatsDonutLegend>
                      <StatsSectionTitle style={{ marginBottom: '0.35rem' }}>Κατηγορίες (top)</StatsSectionTitle>
                      {richHubStats.categoryDonut.map((seg) => (
                        <StatsDonutLegendItem
                          key={seg.key}
                          type="button"
                          onClick={() => applyStatsFilter({ category: seg.key })}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <StatsDonutDot $color={seg.color} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {seg.label}
                            </span>
                          </span>
                          <StatsBreakdownCount>{seg.value}</StatsBreakdownCount>
                        </StatsDonutLegendItem>
                      ))}
                    </StatsDonutLegend>
                  </StatsDonutBlock>
                )}
                {showMunicipalUnitFilters && richHubStats.municipalUnitDonut.length > 0 && (
                  <StatsDonutBlock>
                    <StatsDonut $gradient={buildDonutGradient(richHubStats.municipalUnitDonut)} />
                    <StatsDonutLegend>
                      <StatsSectionTitle style={{ marginBottom: '0.35rem' }}>Δημοτικές ενότητες</StatsSectionTitle>
                      {richHubStats.municipalUnitDonut.map((seg) => (
                        <StatsDonutLegendItem
                          key={seg.key}
                          type="button"
                          onClick={() => applyStatsFilter({ municipalUnit: seg.key })}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <StatsDonutDot $color={seg.color} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {seg.label}
                            </span>
                          </span>
                          <StatsBreakdownCount>{seg.value}</StatsBreakdownCount>
                        </StatsDonutLegendItem>
                      ))}
                    </StatsDonutLegend>
                  </StatsDonutBlock>
                )}
                {showSettlementFilters && richHubStats.settlementDonut.length > 0 && (
                  <StatsDonutBlock>
                    <StatsDonut $gradient={buildDonutGradient(richHubStats.settlementDonut)} />
                    <StatsDonutLegend>
                      <StatsSectionTitle style={{ marginBottom: '0.35rem' }}>Οικισμοί (top)</StatsSectionTitle>
                      {richHubStats.settlementDonut.map((seg) => (
                        <StatsDonutLegendItem
                          key={seg.key}
                          type="button"
                          onClick={() => applyStatsFilter({ settlement: seg.key })}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <StatsDonutDot $color={seg.color} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {seg.label}
                            </span>
                          </span>
                          <StatsBreakdownCount>{seg.value}</StatsBreakdownCount>
                        </StatsDonutLegendItem>
                      ))}
                    </StatsDonutLegend>
                  </StatsDonutBlock>
                )}
              </StatsDonutRow>

              {richHubStats.aepoSoonList.length > 0 && (
                <>
                  <StatsSectionTitle>ΑΕΠΟ — λήξη εντός 60 ημερών</StatsSectionTitle>
                  <StatsInsightList>
                    {richHubStats.aepoSoonList.map((row) => (
                      <StatsInsightRow
                        key={row.id}
                        type="button"
                        onClick={() => {
                          void requestSelectProposal(row.id).then((ok) => {
                            if (ok) setShowHubStatsModal(false);
                          });
                        }}
                      >
                        <div>
                          <StatsInsightMain>{row.title}</StatsInsightMain>
                          <StatsInsightSub>
                            {formatShortDateEl(row.date)}
                            {row.daysLeft >= 0 ? ` · σε ${row.daysLeft} ημέρες` : ' · έληξε'}
                          </StatsInsightSub>
                        </div>
                      </StatsInsightRow>
                    ))}
                  </StatsInsightList>
                </>
              )}

              {richHubStats.topPending.length > 0 && (
                <>
                  <StatsSectionTitle>Περισσότερες ανοιχτές εκκρεμότητες</StatsSectionTitle>
                  <StatsInsightList>
                    {richHubStats.topPending.map((row) => (
                      <StatsInsightRow
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(row.id);
                          setActiveTab('pending');
                          setShowHubStatsModal(false);
                        }}
                      >
                        <div>
                          <StatsInsightMain>{row.title}</StatsInsightMain>
                          <StatsInsightSub>{row.open} ανοιχτές από {row.total}</StatsInsightSub>
                        </div>
                        <StatsBreakdownCount>{row.open}</StatsBreakdownCount>
                      </StatsInsightRow>
                    ))}
                  </StatsInsightList>
                </>
              )}

              {richHubStats.recentlyUpdated.length > 0 && (
                <>
                  <StatsSectionTitle>Πρόσφατη ενημέρωση</StatsSectionTitle>
                  <StatsInsightList>
                    {richHubStats.recentlyUpdated.map((row) => (
                      <StatsInsightRow
                        key={row.id}
                        type="button"
                        onClick={() => {
                          void requestSelectProposal(row.id).then((ok) => {
                            if (ok) setShowHubStatsModal(false);
                          });
                        }}
                      >
                        <div>
                          <StatsInsightMain>{row.title}</StatsInsightMain>
                          <StatsInsightSub>{formatDateTimeEl(row.updatedAt)}</StatsInsightSub>
                        </div>
                      </StatsInsightRow>
                    ))}
                  </StatsInsightList>
                </>
              )}

              <StatsSectionTitle>Αναλυτική κατανομή κατάστασης</StatsSectionTitle>
              <StatsBreakdown>
                {PROJECT_MATURITY_STATUSES.map((s) => {
                  const count = richHubStats.byStatus[s.value] || 0;
                  return (
                    <StatsClickableRow
                      key={s.value}
                      type="button"
                      onClick={() => count > 0 && applyStatsFilter({ status: s.value })}
                      style={{ cursor: count > 0 ? 'pointer' : 'default', opacity: count > 0 ? 1 : 0.55 }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <StatusDot $color={s.color} />
                        {s.label}
                      </span>
                      <StatsBreakdownCount>{count}</StatsBreakdownCount>
                    </StatsClickableRow>
                  );
                })}
              </StatsBreakdown>

              <StatsSectionTitle>Αναλυτική κατανομή κατηγοριών</StatsSectionTitle>
              <StatsBreakdown>
                {Object.entries(richHubStats.byCategory)
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))
                  .map(([cat, count]) => (
                    <StatsClickableRow
                      key={cat}
                      type="button"
                      onClick={() => applyStatsFilter({ category: cat })}
                    >
                      <span>{cat}</span>
                      <StatsBreakdownCount>{count}</StatsBreakdownCount>
                    </StatsClickableRow>
                  ))}
              </StatsBreakdown>

              {showMunicipalUnitFilters ? (
                <>
                  <StatsSectionTitle>Αναλυτική κατανομή δημοτικών ενοτήτων</StatsSectionTitle>
                  <StatsBreakdown>
                    {Object.entries(richHubStats.byMunicipalUnit)
                      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))
                      .map(([unit, count]) => (
                        <StatsClickableRow
                          key={unit}
                          type="button"
                          onClick={() => applyStatsFilter({ municipalUnit: unit })}
                        >
                          <span>{unit}</span>
                          <StatsBreakdownCount>{count}</StatsBreakdownCount>
                        </StatsClickableRow>
                      ))}
                  </StatsBreakdown>
                </>
              ) : null}

              {showSettlementFilters ? (
                <>
                  <StatsSectionTitle>Αναλυτική κατανομή οικισμών</StatsSectionTitle>
                  <StatsBreakdown>
                    {Object.entries(richHubStats.bySettlement)
                      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'el'))
                      .map(([st, count]) => (
                        <StatsClickableRow
                          key={st}
                          type="button"
                          onClick={() => applyStatsFilter({ settlement: st })}
                        >
                          <span>{st}</span>
                          <StatsBreakdownCount>{count}</StatsBreakdownCount>
                        </StatsClickableRow>
                      ))}
                  </StatsBreakdown>
                </>
              ) : null}
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="primary" onClick={() => setShowHubStatsModal(false)}>
                Κλείσιμο
              </Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {showExportDialog && exportDialogProposal && (
        <FolderModalOverlay onClick={closeExportDialog}>
          <FolderModalCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>📤 Εξαγωγή έργου</FolderModalTitle>
              <FolderModalSub>
                {exportDialogProposal.title || 'Άτιτλο έργου'}
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.8rem', color: C.slate600, lineHeight: 1.5 }}>
                Θα δημιουργηθεί φάκελος με το όνομα του έργου, υποφάκελοι ανά κατηγορία αρχείων
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
                    Αν αποεπιλεγεί, εξάγεται μόνο το αρχείο Word με τα στοιχεία του έργου.
                  </div>
                </span>
              </ExportOptionRow>
            </FolderModalBody>
            <FolderModalFooter>
              <Btn $sm $variant="ghost" onClick={closeExportDialog} disabled={exporting}>
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
        <ExportSuccessOverlay onClick={() => { setExportSuccess(null); setExportMissingExpanded(false); }}>
          <ExportSuccessCard onClick={(e) => e.stopPropagation()}>
            <FolderModalHeader>
              <FolderModalTitle>✓ Η εξαγωγή ολοκληρώθηκε</FolderModalTitle>
              <FolderModalSub>
                Δημιουργήθηκε φάκελος με τα αρχεία και την αναφορά Word.
              </FolderModalSub>
            </FolderModalHeader>
            <ExportSuccessBody>
              Το έργο εξήχθη επιτυχώς στον φάκελο που επιλέξατε.
              {exportSuccess.missingCount > 0 && (
                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: C.amber, marginBottom: '0.5rem' }}>
                    {exportSuccess.missingCount}{' '}
                    {exportSuccess.missingCount === 1 ? 'στοιχείο δεν' : 'στοιχεία δεν'} βρέθηκαν στον δίσκο:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: C.slate600 }}>
                    {(exportMissingExpanded
                      ? (exportSuccess.missingItems || [])
                      : (exportSuccess.missingItems || []).slice(0, 12)
                    ).map((item, idx) => (
                      <li key={`${item.name}-${idx}`}>
                        {item.kind === 'folder' ? '📁' : '📄'}{' '}
                        {item.category ? `«${item.category}» / ` : ''}
                        {item.name}
                      </li>
                    ))}
                  </ul>
                  {(exportSuccess.missingItems || []).length > 12 && (
                    <button
                      type="button"
                      onClick={() => setExportMissingExpanded((v) => !v)}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: C.indigo,
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      {exportMissingExpanded
                        ? 'Σύμπτυξη λίστας'
                        : `Εμφάνιση όλων (${(exportSuccess.missingItems || []).length})`}
                    </button>
                  )}
                </div>
              )}
            </ExportSuccessBody>
            <ExportSuccessActions>
              <OpenFolderBtn type="button" onClick={handleOpenExportFolder}>
                ΑΝΟΙΓΜΑ ΦΑΚΕΛΟΥ
              </OpenFolderBtn>
            </ExportSuccessActions>
          </ExportSuccessCard>
        </ExportSuccessOverlay>
      )}

      {unsavedNavModal && (
        <FolderModalOverlay onClick={() => void completeUnsavedNavigation('cancel')}>
          <FolderModalCard onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <FolderModalHeader>
              <FolderModalTitle>💾 Μη αποθηκευμένες αλλαγές</FolderModalTitle>
              <FolderModalSub>
                Έχετε αλλαγές που δεν έχουν αποθηκευτεί στο δίσκο.
              </FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              <p style={{ margin: 0, fontSize: '0.82rem', color: C.slate600, lineHeight: 1.55 }}>
                Να αποθηκευτούν πριν συνεχίσετε; Αν απορρίψετε, οι τοπικές αλλαγές θα χαθούν.
              </p>
            </FolderModalBody>
            <FolderModalFooter style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
              <Btn $sm $variant="ghost" onClick={() => void completeUnsavedNavigation('cancel')}>
                Ακύρωση
              </Btn>
              <Btn $sm $variant="danger" onClick={() => void completeUnsavedNavigation('discard')}>
                Απόρριψη
              </Btn>
              <Btn $sm $variant="primary" onClick={() => void completeUnsavedNavigation('save')}>
                Αποθήκευση
              </Btn>
            </FolderModalFooter>
          </FolderModalCard>
        </FolderModalOverlay>
      )}

      {showAepoSettingsModal && (
        <FolderModalOverlay onClick={() => setShowAepoSettingsModal(false)}>
          <FolderModalCard onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <FolderModalHeader>
              <FolderModalTitle>🔔 Υπενθυμίσεις ΑΕΠΟ</FolderModalTitle>
              <FolderModalSub>Email μέσω SMTP · ειδοποίηση 30 / 60 / 90 ημέρες πριν τη λήξη</FolderModalSub>
            </FolderModalHeader>
            <FolderModalBody>
              <AepoSettingsForm
                config={orimanthiConfig?.aepoReminders}
                onSave={saveAepoReminderSettings}
                onCancel={() => setShowAepoSettingsModal(false)}
                isReadOnly={isReadOnly}
              />
            </FolderModalBody>
          </FolderModalCard>
        </FolderModalOverlay>
      )}
    </Overlay>
  );
}

function AepoSettingsForm({ config, onSave, onCancel, isReadOnly }) {
  const [enabled, setEnabled] = useState(config?.enabled !== false);
  const [useAdminEmails, setUseAdminEmails] = useState(config?.useAdminEmails !== false);
  const [days30, setDays30] = useState((config?.daysBefore || [30, 60, 90]).includes(30));
  const [days60, setDays60] = useState((config?.daysBefore || [30, 60, 90]).includes(60));
  const [days90, setDays90] = useState((config?.daysBefore || [30, 60, 90]).includes(90));
  const [extraEmails, setExtraEmails] = useState((config?.recipientEmails || []).join(', '));

  const handleSave = () => {
    const daysBefore = [];
    if (days90) daysBefore.push(90);
    if (days60) daysBefore.push(60);
    if (days30) daysBefore.push(30);
    if (!daysBefore.length) daysBefore.push(30, 60, 90);
    onSave({
      enabled,
      useAdminEmails,
      daysBefore,
      recipientEmails: extraEmails
        .split(/[,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@')),
    });
  };

  return (
    <>
      <ExportOptionRow>
        <input type="checkbox" checked={enabled} disabled={isReadOnly} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Ενεργές email υπενθυμίσεις</span>
      </ExportOptionRow>
      <ExportOptionRow>
        <input type="checkbox" checked={useAdminEmails} disabled={isReadOnly} onChange={(e) => setUseAdminEmails(e.target.checked)} />
        <span>Αποστολή σε ADMIN / SUPERADMIN (email από προφίλ)</span>
      </ExportOptionRow>
      <div style={{ margin: '0.75rem 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, color: C.slate600 }}>
        Όρια ημερών πριν τη λήξη ΑΕΠΟ
      </div>
      <ExportOptionRow>
        <input type="checkbox" checked={days90} disabled={isReadOnly} onChange={(e) => setDays90(e.target.checked)} />
        <span>90 ημέρες πριν</span>
      </ExportOptionRow>
      <ExportOptionRow>
        <input type="checkbox" checked={days60} disabled={isReadOnly} onChange={(e) => setDays60(e.target.checked)} />
        <span>60 ημέρες πριν</span>
      </ExportOptionRow>
      <ExportOptionRow>
        <input type="checkbox" checked={days30} disabled={isReadOnly} onChange={(e) => setDays30(e.target.checked)} />
        <span>30 ημέρες πριν</span>
      </ExportOptionRow>
      <FormInput
        style={{ marginTop: '0.65rem' }}
        placeholder="Επιπλέον emails (χωρισμένα με κόμμα)…"
        value={extraEmails}
        disabled={isReadOnly}
        onChange={(e) => setExtraEmails(e.target.value)}
      />
      <FolderModalFooter style={{ padding: '0.85rem 0 0', marginTop: '0.5rem' }}>
        <Btn $sm $variant="ghost" onClick={onCancel}>Κλείσιμο</Btn>
        {!isReadOnly && (
          <Btn $sm $variant="primary" onClick={handleSave}>Αποθήκευση</Btn>
        )}
      </FolderModalFooter>
    </>
  );
}
