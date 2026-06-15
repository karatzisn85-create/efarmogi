import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import styled from 'styled-components';
import {
  statusShowsAssignmentProcedure,
  getProjectTypeBadgeColors,
  normalizeProjectType
} from '../data/formOptions';
import { formatViolationSummary } from '../utils/directAssignmentCompliance';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { getKhmdhsDisplayEntries, getTotalContractAmount, isMultipleContractsForm } from '../utils/khmdhsFields';
import {
  filterAndRankEpActions,
  highlightTitleMatches
} from '../utils/epActionSearch';

const ipcRenderer = window.electronAPI;

function formatEpBudget(val) {
  if (!val || val === 0) return null;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(val);
}

function EpPickerResultRow({
  action,
  subprojectTitle,
  searchQuery,
  matchLabel,
  highlight,
  disabled,
  onSelect
}) {
  const titleParts = highlightTitleMatches(action.title, subprojectTitle, searchQuery);
  const hierarchy = [action.axisCode, action.measureCode, action.objectiveCode].filter(Boolean).join(' › ');
  const budget = formatEpBudget(action.total);

  return (
    <EpPickerItem
      $highlight={highlight}
      onClick={() => !disabled && onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <EpPickerItemMain>
        <EpPickerItemTop>
          <EpPickerItemCode>#{action.aa}</EpPickerItemCode>
          {hierarchy && <EpPickerHierarchy>{hierarchy}</EpPickerHierarchy>}
          {matchLabel && (
            <EpPickerMatchBadge $v={matchLabel.variant}>{matchLabel.text}</EpPickerMatchBadge>
          )}
        </EpPickerItemTop>
        <EpPickerItemTitle>
          {titleParts.map((part, i) =>
            part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>
          )}
        </EpPickerItemTitle>
        <EpPickerItemMeta>
          {action.actionType && <span>📋 {action.actionType}</span>}
          {action.location && <span>📍 {action.location}</span>}
          {action.priority && <span>Προτ. {action.priority}</span>}
          {budget && <span>💰 {budget}</span>}
          {action.isNew != null && (
            <span>{action.isNew ? '🟢 Νέα' : '🟡 Συνεχιζόμενη'}</span>
          )}
        </EpPickerItemMeta>
      </EpPickerItemMain>
      <EpPickerSelectBtn
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}
      >
        Επιλογή
      </EpPickerSelectBtn>
    </EpPickerItem>
  );
}

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1.5rem;
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.25s ease-out;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  color: white;
  padding: 1.5rem 2rem;
  border-radius: 16px 16px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const HeaderLeft = styled.div`
  flex: 1;
`;

const ProjectTitleSmall = styled.div`
  font-size: 0.85rem;
  opacity: 0.85;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SubprojectTitleLarge = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.3;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
`;

const EditButton = styled.button`
  background: white;
  color: #5c6bc0;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    background: #f0f4ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const CloseButton = styled.button`
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255,255,255,0.35);
  }
`;

const ViewSubprojectFilesButton = styled.button`
  width: 100%;
  margin-top: 0.25rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  }
`;

const ModalBody = styled.div`
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
`;

const Section = styled.div`
  margin-bottom: 1.8rem;
`;

// EP Program link styled components
const EpActionChip = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
`;
const EpActionChipCode = styled.span`
  flex-shrink: 0;
  background: #6366f1;
  color: white;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  margin-top: 2px;
`;
const EpActionChipTitle = styled.div`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #3730a3;
  line-height: 1.4;
`;
const EpActionChipMeta = styled.div`
  font-size: 11px;
  color: #6366f1;
  margin-top: 3px;
`;
const EpUnlinkBtn = styled.button`
  flex-shrink: 0;
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #dc2626;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  transition: all 0.13s;
  &:hover { background: #fee2e2; }
`;
const EpLinkBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  transition: all 0.15s;
  margin-top: 6px;
  &:hover { opacity: 0.88; }
`;
const EpPickerOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.5);
  backdrop-filter: blur(3px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const EpPickerBox = styled.div`
  background: white;
  border-radius: 12px;
  width: min(720px, 95vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden;
`;
const EpPickerHeader = styled.div`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  padding: 16px 20px 14px;
`;
const EpPickerHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;
const EpPickerTitle = styled.h3`margin: 0; font-size: 15px; font-weight: 700; color: white;`;
const EpPickerSubtitle = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255,255,255,0.78);
  line-height: 1.4;
`;
const EpPickerClose = styled.button`
  background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
  border-radius: 6px; color: white; cursor: pointer; font-size: 13px;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:hover { background: rgba(255,255,255,0.25); }
`;
const EpPickerContext = styled.div`
  margin: 0 16px 10px;
  padding: 10px 12px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 12px;
  color: #4338ca;
  line-height: 1.5;
  strong { font-weight: 700; }
`;
const EpPickerSearchWrap = styled.div`padding: 0 16px 8px;`;
const EpPickerSearch = styled.input`
  width: 100%;
  box-sizing: border-box;
  background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;
  color: #1e293b; font-size: 13px; padding: 10px 12px; outline: none;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: white; }
`;
const EpPickerSearchHint = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
`;
const EpPickerList = styled.div`
  flex: 1; overflow-y: auto; padding: 0 12px 14px;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #a5b4fc, #6366f1); border-radius: 4px; }
`;
const EpPickerSectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 8px 4px 8px;
`;
const EpPickerItem = styled.div`
  border: 1px solid ${({ $highlight }) => $highlight ? '#a5b4fc' : '#e2e8f0'};
  border-left: 4px solid ${({ $highlight }) => $highlight ? '#6366f1' : '#cbd5e1'};
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  background: ${({ $highlight }) => $highlight ? '#f5f3ff' : 'white'};
  transition: all 0.12s;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  &:hover {
    border-color: #818cf8;
    border-left-color: #4f46e5;
    background: #eef2ff;
    box-shadow: 0 4px 14px rgba(99,102,241,0.12);
  }
`;
const EpPickerItemMain = styled.div`flex: 1; min-width: 0;`;
const EpPickerItemTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
`;
const EpPickerItemCode = styled.span`
  font-size: 11px; font-weight: 700; color: white;
  background: #6366f1; border-radius: 5px; padding: 2px 7px;
`;
const EpPickerHierarchy = styled.span`
  font-size: 10px; color: #64748b; font-family: monospace;
  background: #f1f5f9; border-radius: 4px; padding: 2px 6px;
`;
const EpPickerMatchBadge = styled.span`
  font-size: 10px; font-weight: 700; border-radius: 12px; padding: 2px 8px;
  background: ${({ $v }) => $v === 'high' ? '#dcfce7' : $v === 'good' ? '#dbeafe' : '#fef3c7'};
  color: ${({ $v }) => $v === 'high' ? '#166534' : $v === 'good' ? '#1d4ed8' : '#92400e'};
  border: 1px solid ${({ $v }) => $v === 'high' ? '#bbf7d0' : $v === 'good' ? '#bfdbfe' : '#fde68a'};
`;
const EpPickerItemTitle = styled.div`
  font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.45;
  mark {
    background: #fef08a;
    color: #854d0e;
    border-radius: 3px;
    padding: 0 2px;
  }
`;
const EpPickerItemMeta = styled.div`
  font-size: 11px; color: #64748b; margin-top: 6px;
  display: flex; flex-wrap: wrap; gap: 8px;
`;
const EpPickerSelectBtn = styled.button`
  flex-shrink: 0;
  align-self: center;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 12px;
  white-space: nowrap;
  transition: opacity 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.9; }
`;
const EpPickerEmpty = styled.div`
  text-align: center;
  padding: 28px 16px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  margin: 4px;
`;

const SectionTitle = styled.h3`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #9e9e9e;
  margin: 0 0 0.8rem 0;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid #f0f0f0;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem 2rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

/** Δύο στήλες για «Βασικά Στοιχεία»: αριστερά τίτλοι/είδος/MIS, δεξιά κατάσταση + χρέωση */
const BasicSplitGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem 2rem;
  align-items: start;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const BasicColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-width: 0;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const FieldFull = styled(Field)`
  grid-column: span 2;
  @media (max-width: 600px) {
    grid-column: span 1;
  }
`;

const FieldLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #9e9e9e;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const FieldValue = styled.span`
  font-size: 0.95rem;
  color: #212529;
  font-weight: 400;
  word-break: break-word;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${props => {
    switch (props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return '#ffc107';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return '#fd7e14';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return '#007bff';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return '#28a745';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return '#20c997';
      case 'ΑΠΕΝΤΑΓΜΕΝΟ': return '#64748b';
      default: return '#6c757d';
    }
  }};
  color: white;
`;

const TypeBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.7rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${(props) => getProjectTypeBadgeColors(props.type).bg};
  color: ${(props) => getProjectTypeBadgeColors(props.type).color};
`;

const AmountValue = styled.span`
  font-weight: 700;
  color: #28a745;
  font-size: 1rem;
`;

const ContractBox = styled.div`
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1rem 1.2rem;
  border-left: 4px solid #5c6bc0;
  margin-bottom: 0.8rem;
`;

const ContractBoxTitle = styled.div`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.9rem;
  margin-bottom: 0.6rem;
`;

const SupplementaryBox = styled(ContractBox)`
  border-left-color: #28a745;
  background: #f0faf0;
`;

const TotalBox = styled.div`
  background: #e8f4fd;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
  border: 2px solid #007bff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
`;

const AleRemainingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const AleBadge = styled.span`
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyValue = styled.span`
  color: #bdbdbd;
  font-style: italic;
  font-size: 0.9rem;
`;

function SubprojectDetailModal({
  project,
  onClose,
  onEdit,
  onOpenFileManager,
  userRole,
  currentUser,
  isLocked,
  lockedBy,
  engineerCatalog = [],
  portalEnabled = false,
  isPublishedToPortal = false,
  onTogglePortal,
  onRefreshProject,
  onEpLinksChanged,
  directAssignmentViolations = []
}) {
  const requestingUsername = currentUser?.username || '';

  // EP Program link state
  const [epLinkedActions, setEpLinkedActions] = useState([]);
  const [epLoading, setEpLoading] = useState(false);
  const [showEpPicker, setShowEpPicker] = useState(false);
  const [epPickerSearch, setEpPickerSearch] = useState('');
  const [epPickerProgram, setEpPickerProgram] = useState(null);
  const [epPickerLoading, setEpPickerLoading] = useState(false);
  const [epPickerError, setEpPickerError] = useState('');
  const [epLinkLoading, setEpLinkLoading] = useState(false);
  const canManageEp = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  const subprojectTitle = project?.subprojectTitle || project?.projectTitle || '';

  const loadEpLinks = useCallback(async () => {
    if (!project?.subprojectId) return;
    setEpLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-ep-actions-for-subproject', {
        subprojectId: project.subprojectId,
        requestingUsername
      });
      if (res.success) setEpLinkedActions(res.actions || []);
    } catch (e) {}
    finally { setEpLoading(false); }
  }, [project?.subprojectId, requestingUsername]);

  useEffect(() => { loadEpLinks(); }, [loadEpLinks]);

  const openEpPicker = async () => {
    setEpPickerSearch(subprojectTitle);
    setEpPickerError('');
    setEpPickerProgram(null);
    setShowEpPicker(true);
    setEpPickerLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-ep-program', { requestingUsername });
      if (!res.success) {
        setEpPickerError(res.error || 'Σφάλμα φόρτωσης Επιχειρησιακού Προγράμματος');
        setEpPickerProgram(null);
      } else if (!res.program) {
        setEpPickerError('Δεν υπάρχει ενεργό Επιχειρησιακό Πρόγραμμα.');
        setEpPickerProgram(null);
      } else {
        setEpPickerProgram(res.program);
      }
    } catch (e) {
      setEpPickerError(e.message || 'Σφάλμα φόρτωσης');
      setEpPickerProgram(null);
    } finally {
      setEpPickerLoading(false);
    }
  };

  const handleEpLink = async (action) => {
    setEpLinkLoading(true);
    try {
      const res = await ipcRenderer.invoke('link-ep-subproject', {
        programId: action.programId || epPickerProgram?.id,
        actionId: action.id,
        subprojectId: project.subprojectId,
        link: true,
        requestingUsername
      });
      if (res?.success === false) {
        alert(res.error || 'Σφάλμα σύνδεσης');
        return;
      }
      setShowEpPicker(false);
      await loadEpLinks();
      if (typeof onEpLinksChanged === 'function') onEpLinksChanged();
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      alert(e.message || 'Σφάλμα σύνδεσης');
    } finally {
      setEpLinkLoading(false);
    }
  };

  const handleEpUnlink = async (action) => {
    setEpLinkLoading(true);
    try {
      const res = await ipcRenderer.invoke('link-ep-subproject', {
        programId: action.programId,
        actionId: action.id,
        subprojectId: project.subprojectId,
        link: false,
        requestingUsername
      });
      if (res?.success === false) {
        alert(res.error || 'Σφάλμα αποσύνδεσης');
        return;
      }
      await loadEpLinks();
      if (typeof onEpLinksChanged === 'function') onEpLinksChanged();
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      alert(e.message || 'Σφάλμα αποσύνδεσης');
    } finally {
      setEpLinkLoading(false);
    }
  };

  const epPickerRanked = useMemo(() => {
    if (!epPickerProgram) return { suggestions: [], searchResults: [], showAll: false };
    const linkedIds = epLinkedActions.map(a => a.id);
    const query = epPickerSearch.trim();
    const hasQuery = query.length > 0;

    const suggestions = filterAndRankEpActions({
      actions: epPickerProgram.actions || [],
      subprojectTitle,
      searchQuery: '',
      linkedActionIds: linkedIds,
      showAllWhenEmpty: false,
      limit: 15
    });

    const searchResults = hasQuery
      ? filterAndRankEpActions({
          actions: epPickerProgram.actions || [],
          subprojectTitle,
          searchQuery: query,
          linkedActionIds: linkedIds,
          showAllWhenEmpty: false,
          limit: 80
        })
      : [];

    const showAll = hasQuery && searchResults.length === 0;

    return { suggestions, searchResults, showAll, hasQuery };
  }, [epPickerProgram, epPickerSearch, epLinkedActions, subprojectTitle]);

  const epPickerShowAll = useMemo(() => {
    if (!epPickerProgram || !epPickerRanked.showAll) return [];
    const linkedIds = epLinkedActions.map(a => a.id);
    return filterAndRankEpActions({
      actions: epPickerProgram.actions || [],
      subprojectTitle: '',
      searchQuery: '',
      linkedActionIds: linkedIds,
      showAllWhenEmpty: true,
      limit: 40
    });
  }, [epPickerProgram, epPickerRanked.showAll, epLinkedActions]);

  useEffect(() => {
    lockBodyScroll('subdetail');
    return () => {
      unlockBodyScroll('subdetail');
    };
  }, []);

  const { displayChargePrimary, displayChargeParticipants } = useMemo(
    () => getProjectChargeDisplay(project, engineerCatalog),
    [project, engineerCatalog]
  );

  const khmdhsEntries = useMemo(() => getKhmdhsDisplayEntries(project), [project]);

  if (!project) return null;

  const formatAmount = (amount) => {
    if (!amount) return null;
    return `${amount} €`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const val = (v) => v && v.toString().trim() ? v : null;

  const hasContractInfo = isMultipleContractsForm(project.implementationForm)
    ? (project.contracts && project.contracts.length > 0)
    : (project.contractDate || project.contractAmount);

  const showAssignmentProcedure = statusShowsAssignmentProcedure(project.projectStatus);
  const showContractProcessDate = showAssignmentProcedure;

  const totalContractAmount = getTotalContractAmount(project);

  const multipleAle = project.aleCodes && project.aleCodes.length > 1;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        {/* Header */}
        <ModalHeader>
          <HeaderLeft>
            <ProjectTitleSmall>📁 {project.projectTitle}</ProjectTitleSmall>
            <SubprojectTitleLarge>{project.subprojectTitle}</SubprojectTitleLarge>
          </HeaderLeft>
          <HeaderRight>
            {userRole !== 'USER' && (
              <EditButton
                onClick={() => { onClose(); onEdit(project); }}
                disabled={isLocked}
                title={isLocked ? (lockedBy ? `Κλειδωμένο από: ${lockedBy}` : 'Κλειδωμένο από άλλον χρήστη') : 'Επεξεργασία υποέργου'}
              >
                🔒 {isLocked ? (lockedBy ? `Κλειδωμένο (${lockedBy})` : 'Κλειδωμένο') : '✏️ Επεξεργασία'}
              </EditButton>
            )}
            <CloseButton onClick={onClose} title="Κλείσιμο">✕</CloseButton>
          </HeaderRight>
        </ModalHeader>

        {/* Body */}
        <ModalBody>

          {directAssignmentViolations.length > 0 && (
            <Section style={{ marginBottom: '1rem' }}>
              <SectionTitle style={{ color: '#b45309' }}>⚠️ Προειδοποίηση — Κανόνας 12 μηνών (απευθείας ανάθεση)</SectionTitle>
              {directAssignmentViolations.map((v, idx) => (
                <FieldValue
                  key={idx}
                  style={{
                    display: 'block',
                    padding: '0.75rem 0.9rem',
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderRadius: 10,
                    color: '#92400e',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    marginBottom: idx < directAssignmentViolations.length - 1 ? '0.5rem' : 0
                  }}
                >
                  {formatViolationSummary(v)}
                </FieldValue>
              ))}
            </Section>
          )}

          {/* Βασικά Στοιχεία */}
          <Section>
            <SectionTitle>Βασικά Στοιχεία</SectionTitle>
            <BasicSplitGrid>
              <BasicColumn>
                <Field>
                  <FieldLabel>Μορφή Υλοποίησης</FieldLabel>
                  <FieldValue>{val(project.implementationForm) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Είδος</FieldLabel>
                  <FieldValue>
                    {project.projectType
                      ? <TypeBadge type={project.projectType}>{normalizeProjectType(project.projectType)}</TypeBadge>
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
                {project.misPraxhsName && project.misPraxhsCode && (
                  <Field>
                    <FieldLabel>{project.misPraxhsName}</FieldLabel>
                    <FieldValue>{project.misPraxhsCode}</FieldValue>
                  </Field>
                )}
              </BasicColumn>
              <BasicColumn>
                <Field>
                  <FieldLabel>Κατάσταση</FieldLabel>
                  <FieldValue>
                    {project.projectStatus
                      ? <StatusBadge status={project.projectStatus}>{project.projectStatus}</StatusBadge>
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
                {displayChargePrimary && (
                  <Field>
                    <FieldLabel>Χρεωμένο σε</FieldLabel>
                    <FieldValue style={{ fontWeight: 700, color: '#312e81', whiteSpace: 'pre-wrap' }}>
                      {displayChargePrimary}
                    </FieldValue>
                  </Field>
                )}
                {displayChargeParticipants && (
                  <Field>
                    <FieldLabel>Συμμετέχουν</FieldLabel>
                    <FieldValue style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>
                      {displayChargeParticipants}
                    </FieldValue>
                  </Field>
                )}
              </BasicColumn>
            </BasicSplitGrid>
          </Section>

          {/* Κωδικοί */}
          <Section>
            <SectionTitle>Κωδικοί</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Κωδικός ΚΑ</FieldLabel>
                <FieldValue>{val(project.kaCode) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Κωδικοί Α.Λ.Ε.</FieldLabel>
                <FieldValue>
                  {project.aleCodes && project.aleCodes.filter(c => c && c.trim()).length > 0
                    ? project.aleCodes.filter(c => c && c.trim()).map((code, i) => (
                        <span key={i} style={{
                          display: 'inline-block',
                          background: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          marginRight: '0.4rem',
                          marginBottom: '0.3rem'
                        }}>{code}</span>
                      ))
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
            </FieldGrid>
          </Section>

          {khmdhsEntries.length > 0 && (
            <Section>
              <SectionTitle>ΚΗΜΔΗΣ (ανοικτά δεδομένα)</SectionTitle>
              {khmdhsEntries.map((entry, idx) => (
                <FieldGrid key={entry.contractIndex ?? `k-${idx}`} style={{ marginBottom: idx < khmdhsEntries.length - 1 ? '1rem' : 0 }}>
                  {entry.contractIndex != null && (
                    <FieldFull>
                      <FieldLabel>Σύμβαση</FieldLabel>
                      <FieldValue style={{ fontWeight: 700 }}>Σύμβαση {entry.contractIndex}</FieldValue>
                    </FieldFull>
                  )}
                  {entry.adam && (
                    <Field>
                      <FieldLabel>ΑΔΑΜ σύμβασης</FieldLabel>
                      <FieldValue style={{ fontWeight: 700, letterSpacing: '0.02em' }}>{entry.adam}</FieldValue>
                    </Field>
                  )}
                  {entry.fetchedAt && (
                    <Field>
                      <FieldLabel>Τελευταία λήψη</FieldLabel>
                      <FieldValue>
                        {(() => {
                          try {
                            const d = new Date(entry.fetchedAt);
                            return Number.isNaN(d.getTime()) ? entry.fetchedAt : d.toLocaleString('el-GR');
                          } catch {
                            return entry.fetchedAt;
                          }
                        })()}
                      </FieldValue>
                    </Field>
                  )}
                  {entry.snapshot?.anadoxosName && (
                    <Field>
                      <FieldLabel>Ανάδοχος</FieldLabel>
                      <FieldValue>{entry.snapshot.anadoxosName}</FieldValue>
                    </Field>
                  )}
                  {entry.snapshot?.anadoxosVat && (
                    <Field>
                      <FieldLabel>ΑΦΜ ανάδοχου</FieldLabel>
                      <FieldValue>{entry.snapshot.anadoxosVat}</FieldValue>
                    </Field>
                  )}
                  {entry.snapshot?.assigningAuthority && (
                    <Field>
                      <FieldLabel>Αναθέτουσα αρχή</FieldLabel>
                      <FieldValue>{entry.snapshot.assigningAuthority}</FieldValue>
                    </Field>
                  )}
                </FieldGrid>
              ))}
            </Section>
          )}

          {/* Χρηματοδότηση */}
          <Section>
            <SectionTitle>Χρηματοδότηση</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Βασική Πηγή</FieldLabel>
                <FieldValue>{val(project.fundingSource) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Εξειδίκευση</FieldLabel>
                <FieldValue>{val(project.fundingDetails) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Εγκεκριμένο Ποσό</FieldLabel>
                <FieldValue>
                  {formatAmount(project.approvedAmount)
                    ? <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Προϋπολογισμός Έργου</FieldLabel>
                <FieldValue>
                  {formatAmount(project.projectBudget)
                    ? <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
            </FieldGrid>
          </Section>

          {/* Υπόλοιπα */}
          {(project.remainingAmount || (project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a))) && (
            <Section>
              <SectionTitle>Υπόλοιπα Έτους {project.remainingAmountYear || '—'}</SectionTitle>
              {multipleAle && project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a) ? (
                <div>
                  {project.aleCodes.map((code, i) => (
                    <AleRemainingRow key={i}>
                      <AleBadge>{code || `Α.Λ.Ε. ${i + 1}`}</AleBadge>
                      <FieldValue>
                        {project.aleRemainingAmounts[i]
                          ? <AmountValue>{project.aleRemainingAmounts[i]} €</AmountValue>
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </AleRemainingRow>
                  ))}
                  {project.remainingAmount && (
                    <TotalBox style={{ marginTop: '0.8rem' }}>
                      <span style={{ fontWeight: 700, color: '#007bff', fontSize: '0.9rem' }}>ΣΥΝΟΛΟ:</span>
                      <AmountValue style={{ color: '#007bff', fontSize: '1.05rem' }}>
                        {project.remainingAmount} €
                      </AmountValue>
                    </TotalBox>
                  )}
                </div>
              ) : (
                <FieldGrid>
                  <Field>
                    <FieldLabel>Ποσό Υπολοίπων</FieldLabel>
                    <FieldValue>
                      {formatAmount(project.remainingAmount)
                        ? <AmountValue>{formatAmount(project.remainingAmount)}</AmountValue>
                        : <EmptyValue>—</EmptyValue>}
                    </FieldValue>
                  </Field>
                </FieldGrid>
              )}
              {project.remainingAmountComments && (
                <FieldGrid style={{ marginTop: '0.6rem' }}>
                  <FieldFull>
                    <FieldLabel>Σχόλια Υπολοίπων</FieldLabel>
                    <FieldValue>{project.remainingAmountComments}</FieldValue>
                  </FieldFull>
                </FieldGrid>
              )}
            </Section>
          )}

          {/* Σύμβαση */}
          {hasContractInfo && (
            <Section>
              <SectionTitle>Στοιχεία Σύμβασης</SectionTitle>

              {(showAssignmentProcedure && project.assignmentProcedure) || (showContractProcessDate && project.contractProcessStartDate) ? (
                <FieldGrid style={{ marginBottom: '1rem' }}>
                  {showAssignmentProcedure && project.assignmentProcedure && (
                    <Field>
                      <FieldLabel>Διαδικασία Ανάθεσης</FieldLabel>
                      <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                        {project.assignmentProcedure}
                      </FieldValue>
                    </Field>
                  )}
                  {showContractProcessDate && project.contractProcessStartDate && (
                    <Field>
                      <FieldLabel>Ημερ. Έναρξης Διαδικασίας</FieldLabel>
                      <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                        {formatDate(project.contractProcessStartDate)}
                      </FieldValue>
                    </Field>
                  )}
                </FieldGrid>
              ) : null}

              {project.implementationForm === 'Μια Σύμβαση' ? (
                <ContractBox>
                  <ContractBoxTitle>Σύμβαση</ContractBoxTitle>
                  <FieldGrid>
                    <Field>
                      <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                      <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                        {formatDate(project.contractDate) || <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </Field>
                    <Field>
                      <FieldLabel>Ποσό Σύμβασης</FieldLabel>
                      <FieldValue>
                        {formatAmount(project.contractAmount)
                          ? <AmountValue style={{ color: '#5c6bc0' }}>{formatAmount(project.contractAmount)}</AmountValue>
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </Field>
                    {project.apeAmount && (
                      <Field>
                        <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                        <FieldValue><AmountValue>{formatAmount(project.apeAmount)}</AmountValue></FieldValue>
                      </Field>
                    )}
                    {project.apeComments && (
                      <Field>
                        <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                        <FieldValue>{project.apeComments}</FieldValue>
                      </Field>
                    )}
                  </FieldGrid>
                </ContractBox>
              ) : (
                (project.contracts || []).map((contract, index) => (
                  <ContractBox key={index}>
                    <ContractBoxTitle>Σύμβαση {index + 1}</ContractBoxTitle>
                    <FieldGrid>
                      <Field>
                        <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                        <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                          {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                        </FieldValue>
                      </Field>
                      <Field>
                        <FieldLabel>Ποσό</FieldLabel>
                        <FieldValue>
                          {formatAmount(contract.amount)
                            ? <AmountValue style={{ color: '#5c6bc0' }}>{formatAmount(contract.amount)}</AmountValue>
                            : <EmptyValue>—</EmptyValue>}
                        </FieldValue>
                      </Field>
                      {contract.apeAmount && (
                        <Field>
                          <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                          <FieldValue><AmountValue>{formatAmount(contract.apeAmount)}</AmountValue></FieldValue>
                        </Field>
                      )}
                      {contract.comments && (
                        <FieldFull>
                          <FieldLabel>Σχόλια</FieldLabel>
                          <FieldValue>{contract.comments}</FieldValue>
                        </FieldFull>
                      )}
                    </FieldGrid>
                  </ContractBox>
                ))
              )}

              {/* Συμπληρωματικές */}
              {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && (
                <>
                  {project.supplementaryContracts.map((contract, index) => (
                    <SupplementaryBox key={index}>
                      <ContractBoxTitle style={{ color: '#28a745' }}>Συμπληρωματική Σύμβαση {index + 1}</ContractBoxTitle>
                      <FieldGrid>
                        <Field>
                          <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                          <FieldValue style={{ color: '#28a745', fontWeight: 600 }}>
                            {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                          </FieldValue>
                        </Field>
                        <Field>
                          <FieldLabel>Ποσό</FieldLabel>
                          <FieldValue>
                            {formatAmount(contract.amount)
                              ? <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                              : <EmptyValue>—</EmptyValue>}
                          </FieldValue>
                        </Field>
                        {contract.comments && (
                          <FieldFull>
                            <FieldLabel>Σχόλια</FieldLabel>
                            <FieldValue>{contract.comments}</FieldValue>
                          </FieldFull>
                        )}
                      </FieldGrid>
                    </SupplementaryBox>
                  ))}
                </>
              )}

              {/* Σύνολο */}
              {totalContractAmount > 0 && (
                <TotalBox>
                  <span style={{ fontWeight: 700, color: '#007bff' }}>ΣΥΝΟΛΟ ΣΥΜΒΑΣΕΩΝ:</span>
                  <AmountValue style={{ color: '#007bff', fontSize: '1.05rem' }}>
                    {totalContractAmount.toLocaleString('el-GR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} €
                  </AmountValue>
                </TotalBox>
              )}
            </Section>
          )}

          {/* Σχόλια */}
          {project.comments && (
            <Section>
              <SectionTitle>Σχόλια</SectionTitle>
              <FieldValue style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {project.comments}
              </FieldValue>
            </Section>
          )}

          {/* Εισηγητική Έκθεση */}
          {project.eisigitikiEkthesi && (
            <Section>
              <SectionTitle>Εισηγητική Έκθεση</SectionTitle>
              <FieldValue style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {project.eisigitikiEkthesi}
              </FieldValue>
            </Section>
          )}

          {/* Επιχειρησιακό Πρόγραμμα */}
          <Section>
            <SectionTitle>🗺️ Επιχειρησιακό Πρόγραμμα</SectionTitle>
            {epLoading ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Φόρτωση...</div>
            ) : epLinkedActions.length === 0 ? (
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: '#94a3b8'
              }}>
                Δεν έχει συνδεθεί με δράση Επιχειρησιακού Προγράμματος.
              </div>
            ) : (
              epLinkedActions.map(action => (
                <EpActionChip key={action.id}>
                  <EpActionChipCode>#{action.aa}</EpActionChipCode>
                  <div style={{ flex: 1 }}>
                    <EpActionChipTitle>{action.title}</EpActionChipTitle>
                    <EpActionChipMeta>
                      {[action.axisCode, action.measureCode, action.objectiveCode].filter(Boolean).join(' › ')}
                      {action.actionType && ` · ${action.actionType}`}
                    </EpActionChipMeta>
                    <div style={{ fontSize: 11, color: '#6b7fa3', marginTop: 2 }}>{action.programTitle}</div>
                  </div>
                  {canManageEp && (
                    <EpUnlinkBtn onClick={() => handleEpUnlink(action)} disabled={epLinkLoading}>
                      Αποσύνδεση
                    </EpUnlinkBtn>
                  )}
                </EpActionChip>
              ))
            )}
            {canManageEp && (
              <EpLinkBtn onClick={openEpPicker} disabled={epLinkLoading}>
                🔗 Σύνδεση με Δράση ΕΠ
              </EpLinkBtn>
            )}
          </Section>

          {/* EP Picker Modal */}
          {showEpPicker && (
            <EpPickerOverlay onClick={e => e.target === e.currentTarget && !epLinkLoading && setShowEpPicker(false)}>
              <EpPickerBox onClick={e => e.stopPropagation()}>
                <EpPickerHeader>
                  <EpPickerHeaderRow>
                    <EpPickerTitle>🗺️ Επιλογή Δράσης Επιχειρησιακού Προγράμματος</EpPickerTitle>
                    <EpPickerClose onClick={() => !epLinkLoading && setShowEpPicker(false)}>✕</EpPickerClose>
                  </EpPickerHeaderRow>
                  {epPickerProgram && (
                    <EpPickerSubtitle>
                      {epPickerProgram.title} · {(epPickerProgram.actions || []).length} δράσεις
                    </EpPickerSubtitle>
                  )}
                </EpPickerHeader>

                <EpPickerContext>
                  Σύνδεση υποέργου: <strong>{subprojectTitle || '—'}</strong>
                  <br />
                  Η αναζήτηση συγκρίνει τον τίτλο του υποέργου με τους τίτλους δράσεων του ενεργού ΕΠ.
                </EpPickerContext>

                <EpPickerSearchWrap>
                  <EpPickerSearch
                    autoFocus
                    placeholder="Αναζήτηση σε τίτλο δράσης, κωδικό, χωροθέτηση..."
                    value={epPickerSearch}
                    onChange={e => setEpPickerSearch(e.target.value)}
                  />
                  <EpPickerSearchHint>
                    {epPickerSearch.trim()
                      ? 'Εμφανίζονται δράσεις που ταιριάζουν με την αναζήτηση και/ή τον τίτλο υποέργου.'
                      : 'Προ-συμπληρώθηκε ο τίτλος υποέργου — επεξεργαστεί τον για πιο στοχευμένα αποτελέσματα.'}
                  </EpPickerSearchHint>
                </EpPickerSearchWrap>

                <EpPickerList>
                  {epPickerLoading && (
                    <EpPickerEmpty>⏳ Φόρτωση δράσεων Επιχειρησιακού Προγράμματος...</EpPickerEmpty>
                  )}

                  {!epPickerLoading && epPickerError && (
                    <EpPickerEmpty>⚠️ {epPickerError}</EpPickerEmpty>
                  )}

                  {!epPickerLoading && !epPickerError && epPickerProgram && (
                    <>
                      {!epPickerRanked.hasQuery && epPickerRanked.suggestions.length > 0 && (
                        <>
                          <EpPickerSectionLabel>Προτεινόμενες βάσει τίτλου υποέργου</EpPickerSectionLabel>
                          {epPickerRanked.suggestions.map(({ action, matchLabel }) => (
                            <EpPickerResultRow
                              key={`sug-${action.id}`}
                              action={action}
                              subprojectTitle={subprojectTitle}
                              searchQuery={epPickerSearch}
                              matchLabel={matchLabel}
                              highlight
                              disabled={epLinkLoading}
                              onSelect={() => handleEpLink(action)}
                            />
                          ))}
                        </>
                      )}

                      {epPickerRanked.hasQuery && epPickerRanked.searchResults.length > 0 && (
                        <>
                          <EpPickerSectionLabel>
                            Αποτελέσματα αναζήτησης ({epPickerRanked.searchResults.length})
                          </EpPickerSectionLabel>
                          {epPickerRanked.searchResults.map(({ action, matchLabel }) => (
                            <EpPickerResultRow
                              key={`res-${action.id}`}
                              action={action}
                              subprojectTitle={subprojectTitle}
                              searchQuery={epPickerSearch}
                              matchLabel={matchLabel}
                              highlight={!!matchLabel}
                              disabled={epLinkLoading}
                              onSelect={() => handleEpLink(action)}
                            />
                          ))}
                        </>
                      )}

                      {epPickerRanked.hasQuery && epPickerRanked.searchResults.length === 0 && (
                        <>
                          <EpPickerEmpty>
                            Δεν βρέθηκαν δράσεις που να ταιριάζουν με «{epPickerSearch.trim()}».
                            <br />
                            Δοκιμάστε λιγότερες ή διαφορετικές λέξεις από τον τίτλο του υποέργου.
                          </EpPickerEmpty>
                          {epPickerShowAll.length > 0 && (
                            <>
                              <EpPickerSectionLabel>Όλες οι διαθέσιμες δράσεις</EpPickerSectionLabel>
                              {epPickerShowAll.map(({ action }) => (
                                <EpPickerResultRow
                                  key={`all-${action.id}`}
                                  action={action}
                                  subprojectTitle={subprojectTitle}
                                  searchQuery=""
                                  matchLabel={null}
                                  highlight={false}
                                  disabled={epLinkLoading}
                                  onSelect={() => handleEpLink(action)}
                                />
                              ))}
                            </>
                          )}
                        </>
                      )}

                      {!epPickerRanked.hasQuery && epPickerRanked.suggestions.length === 0 && (
                        <EpPickerEmpty>
                          Δεν βρέθηκαν προτεινόμενες δράσεις για αυτόν τον τίτλο υποέργου.
                          <br />
                          Πληκτρολογήστε λέξεις-κλειδιά για χειροκίνητη αναζήτηση.
                        </EpPickerEmpty>
                      )}
                    </>
                  )}
                </EpPickerList>
              </EpPickerBox>
            </EpPickerOverlay>
          )}

          {portalEnabled && (
            <Section>
              <SectionTitle>Πύλη Διαφάνειας</SectionTitle>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isPublishedToPortal ? '#f0fdf4' : '#f8fafc',
                border: `1.5px solid ${isPublishedToPortal ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 10,
                padding: '12px 16px',
                gap: 16
              }}>
                <div>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: isPublishedToPortal ? '#166534' : '#475569',
                    marginBottom: 3
                  }}>
                    {isPublishedToPortal
                      ? '🌐 Δημοσιευμένο στην Πύλη Διαφάνειας'
                      : '🔒 Δεν δημοσιεύεται στην Πύλη Διαφάνειας'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    {isPublishedToPortal
                      ? 'Το υποέργο εμφανίζεται δημόσια στο portal. Αποεπιλέξτε για να το αποκρύψετε.'
                      : 'Ενεργοποιήστε για να συμπεριληφθεί στην επόμενη εξαγωγή στο portal.'}
                  </div>
                </div>
                {typeof onTogglePortal === 'function' && (userRole === 'ADMIN' || userRole === 'SUPERADMIN') && (
                  <button
                    onClick={() => onTogglePortal(project.subprojectId)}
                    style={{
                      flexShrink: 0,
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      transition: 'all 0.2s',
                      background: isPublishedToPortal
                        ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                        : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                      color: 'white',
                      boxShadow: isPublishedToPortal
                        ? '0 2px 8px rgba(220,38,38,0.35)'
                        : '0 2px 8px rgba(37,99,235,0.35)'
                    }}
                  >
                    {isPublishedToPortal ? 'Απόσυρση' : 'Δημοσίευση'}
                  </button>
                )}
              </div>
            </Section>
          )}

          <Section>
            <SectionTitle>Αρχεία Υποέργου</SectionTitle>
            {typeof onOpenFileManager === 'function' && (
              <ViewSubprojectFilesButton type="button" onClick={() => onOpenFileManager()}>
                📁 Προβολή Αρχείων Υποέργου
              </ViewSubprojectFilesButton>
            )}
          </Section>

        </ModalBody>
      </Modal>
    </Overlay>
  );
}

export default SubprojectDetailModal;
