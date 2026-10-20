import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { safeFileDialog } from '../utils/safeDialogs';
import { useToast } from './ToastProvider';
import { showConfirm } from '../utils/confirmModal';
import { showFileConflictDialog } from '../utils/fileConflictDialog';
import FileRenameModal from './FileRenameModal';
import managedFiles from '../../app/core/managedFiles';
import prosklisiFileGroups from '../../app/core/prosklisiFileGroups';
import KhmdhsDocumentRegistryPanel from './KhmdhsDocumentRegistryPanel';
import { collectProsklisiRegistryEntries } from '../utils/prosklisiDiavgeiaRegistry';
import { applyProsklisiGroupingChoice, askProsklisiGrouping } from '../utils/uploadProsklisiFiles';
import subprojectFiles from '../../app/core/subprojectFiles';

const ipcRenderer = window.electronAPI;

const C = {
  white: '#ffffff', indigo: '#6366f1', indigoDark: '#4f46e5', indigoLight: '#eef2ff',
  violet: '#8b5cf6', emerald: '#10b981', emeraldDark: '#059669', red: '#ef4444',
  slate100: '#f1f5f9', slate200: '#e2e8f0', slate300: '#cbd5e1',
  slate500: '#64748b', slate600: '#475569', slate800: '#1e293b'
};

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 10000;
  padding: 2rem;
  overflow-y: auto;
`;

const Modal = styled.div`
  background: ${C.white};
  border-radius: 18px;
  max-width: 860px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 20px 60px rgba(99, 102, 241, 0.13),
    0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 2rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.4rem 1.75rem 0.85rem;
  flex-shrink: 0;
  gap: 0.75rem;
`;

const HeaderDivider = styled.div`
  height: 2px;
  margin: 0 1.75rem;
  background: linear-gradient(90deg, ${C.indigo}, ${C.violet}, transparent);
  border-radius: 2px;
  flex-shrink: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
`;

const PillBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
  border: 1.5px solid ${(p) => (p.$active ? C.slate300 : C.indigo)};
  background: ${(p) => (p.$active ? C.slate100 : C.indigoLight)};
  color: ${(p) => (p.$active ? C.slate600 : C.indigo)};
  &:hover {
    background: ${(p) => (p.$active ? C.slate200 : C.indigo)};
    color: ${(p) => (p.$active ? C.slate800 : C.white)};
  }
`;

const MoveBtn = styled(PillBtn)`
  border-color: #10b981;
  background: #ecfdf5;
  color: #059669;
  &:hover { background: #10b981; color: ${C.white}; border-color: #10b981; }
`;

const BulkDeleteBtn = styled(PillBtn)`
  border-color: ${C.red};
  background: #fef2f2;
  color: ${C.red};
  &:hover { background: ${C.red}; color: ${C.white}; border-color: ${C.red}; }
`;

const Title = styled.h2`
  color: ${C.slate800};
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: ${C.slate100};
  color: ${C.slate500};
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s, color 0.18s;
  &:hover { background: #fee2e2; color: ${C.red}; }
`;

const Content = styled.div`
  padding: 1.25rem 1.75rem 1.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const SectionCard = styled.div`
  margin-bottom: 0.85rem;
  border-radius: 12px;
  background: ${(p) => (p.$accent ? '#eef2ff' : '#f8fafc')};
  border: 1px solid ${(p) => (p.$accent ? '#c7d2fe' : C.slate200)};
  padding: 0.5rem 0.55rem 0.55rem;
  &:last-child { margin-bottom: 0; }
`;

const SectionLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  color: #4338ca;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem 0.4rem;
`;

const GroupCard = styled.div`
  &:last-child { margin-bottom: 0; }
`;

const NodeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-bottom: 0.2rem;
`;

const GroupToggle = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.38rem 0.5rem;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$open ? '#c7d2fe' : 'transparent')};
  background: ${(p) => (p.$open ? C.white : 'transparent')};
  cursor: pointer;
  text-align: left;
  color: ${C.slate800};
  font-size: 0.84rem;
  font-weight: 600;
  font-family: inherit;
  &:hover {
    background: ${C.white};
    border-color: #c7d2fe;
  }
`;

const NodeTitle = styled.span`
  flex: 1;
  min-width: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const GroupIcon = styled.span`
  font-size: 0.95rem;
  line-height: 1;
  flex-shrink: 0;
`;

const GroupChevron = styled.span`
  flex-shrink: 0;
  width: 0.7rem;
  color: ${C.indigo};
  font-size: 0.62rem;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
  transition: transform 0.15s ease;
`;

const GroupCount = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate500};
  background: ${C.slate100};
  padding: 0.14rem 0.5rem;
  border-radius: 999px;
  letter-spacing: 0;
`;

const OriginBadge = styled.span`
  flex-shrink: 0;
  font-size: 0.64rem;
  font-weight: 800;
  color: ${C.indigoDark};
  background: ${C.white};
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 0.08rem 0.42rem;
`;

const OriginNote = styled.p`
  margin: 0.05rem 0.35rem 0.4rem 1.35rem;
  font-size: 0.74rem;
  line-height: 1.4;
  color: ${C.slate600};
`;

const OriginProject = styled.span`
  display: block;
  color: ${C.slate500};
  margin-top: 0.1rem;
`;

const TreeTools = styled.div`
  display: flex;
  gap: 0.35rem;
  margin: 0 0 0.35rem 1.35rem;
`;

const TreeToolBtn = styled.button`
  border: 1px solid #c7d2fe;
  background: ${C.white};
  color: ${C.indigoDark};
  font-size: 0.68rem;
  font-weight: 700;
  font-family: inherit;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  cursor: pointer;
  &:hover { background: ${C.indigoLight}; }
`;

const TreeChildren = styled.div`
  margin: 0.1rem 0 0.35rem 0.7rem;
  padding-left: 0.65rem;
  border-left: 2px solid ${(p) => (p.$accent ? '#c7d2fe' : C.slate200)};
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0.15rem 0 0.25rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.7rem;
  background: ${C.white};
  border: 1px solid ${(p) => (p.$linked ? '#c7d2fe' : C.slate200)};
  border-left: 3px solid ${(p) => (p.$linked ? C.indigo : C.slate200)};
  border-radius: 9px;
  gap: 0.65rem;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  &:hover {
    border-color: ${(p) => (p.$linked ? '#a5b4fc' : C.slate300)};
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
  }
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
`;

function getFileTypeStyle(fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext))
    return { label: 'PDF', bg: `linear-gradient(135deg, ${C.indigo}, ${C.violet})` };
  if (['doc', 'docx'].includes(ext))
    return { label: 'DOC', bg: 'linear-gradient(135deg, #2563eb, #3b82f6)' };
  if (['xls', 'xlsx'].includes(ext))
    return { label: 'XLS', bg: 'linear-gradient(135deg, #059669, #10b981)' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return { label: 'IMG', bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return { label: 'ZIP', bg: 'linear-gradient(135deg, #6b7280, #9ca3af)' };
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', bg: `linear-gradient(135deg, ${C.slate600}, ${C.slate500})` };
}

const FileIconBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  padding: 0 0.2rem;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: ${C.white};
  background: ${(p) => p.$bg || C.slate500};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
`;

const FileName = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${C.slate800};
  word-break: break-word;
  line-height: 1.4;
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
  &:hover { background: ${C.indigoLight}; color: ${C.indigo}; border-color: #c7d2fe; }
`;
const DownloadIconBtn = styled(IconActionBtn)`
  &:hover { background: #ecfdf5; color: ${C.emeraldDark}; border-color: #a7f3d0; }
`;
const DeleteIconBtn = styled(IconActionBtn)`
  &:hover { background: #fee2e2; color: ${C.red}; border-color: #fecaca; }
`;
const RenameIconBtn = styled(IconActionBtn)`
  &:hover { background: ${C.indigoLight}; color: ${C.indigo}; border-color: #c7d2fe; }
`;
const FolderOpenBtn = styled(IconActionBtn)`
  &:hover { background: #fef3c7; color: #92400e; border-color: #fde68a; }
`;

const EmptyFolder = styled.div`
  text-align: center;
  padding: 1.1rem;
  color: ${C.slate500};
  font-style: italic;
  font-size: 0.88rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1.5rem;
  color: ${C.slate500};
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: ${C.slate500};
  font-size: 1rem;
`;

const UploadBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid ${C.slate100};
`;

const UploadBarLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: ${C.slate500};
  letter-spacing: 0.02em;
  margin-right: 0.1rem;
`;

const UploadButton = styled.button`
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate600};
  font-family: inherit;
  &:hover:not(:disabled) {
    background: ${C.slate100};
    color: ${C.slate800};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const UploadFolderButton = styled(UploadButton)`
  background: #ecfdf5;
  color: ${C.emeraldDark};
  border-color: #a7f3d0;
  &:hover:not(:disabled) { background: #d1fae5; }
`;

const NewGroupButton = styled(UploadButton)`
  background: ${C.indigoLight};
  color: ${C.indigo};
  border-color: #c7d2fe;
  &:hover:not(:disabled) { background: #e0e7ff; }
`;

const checkboxStyle = {
  flexShrink: 0,
  width: '16px',
  height: '16px',
  cursor: 'pointer',
  accentColor: C.indigo,
};

function ProsklisisFileManager({ isOpen, onClose, prosklisiId, prosklisiTitle, userRole, loggedInUsername }) {
  const { showToast } = useToast();
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [files, setFiles] = useState({
    main: [],
    attachments: []
  });
  const [folders, setFolders] = useState({
    main: [],
    attachments: []
  });
  const [fileGroups, setFileGroups] = useState([]); // Νέα κατάσταση για ομάδες αρχείων
  const [linkedOrimanthiFiles, setLinkedOrimanthiFiles] = useState([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState({});
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [registrySource, setRegistrySource] = useState({
    documentRegistry: [],
    diavgeiaMeta: null,
    diavgeiaAda: '',
    modifications: [],
  });
  const [loading, setLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [uploading, setUploading] = useState(false);

  const registryEntries = useMemo(
    () => collectProsklisiRegistryEntries(registrySource),
    [registrySource]
  );

  useEffect(() => {
    if (isOpen && prosklisiId) {
      setExpandedGroupIds({});
      setSelectedFiles(new Set());
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prosklisiId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (renameTarget) return;
      if (document.querySelector('[data-testid="confirm-yes"]')) return;
      if (typeof window.cleanupFolderModal === 'function' || typeof window.cleanupSubfolderModal === 'function') {
        return;
      }
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, renameTarget]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('get-prosklisi-files', prosklisiId);
      if (result.success) {
        const fileGroups = result.fileGroups || [];
        
        // Το backend τώρα επιστρέφει τα σωστά δεδομένα, δεν χρειάζεται filtering
        setFiles({
          main: result.files.main || [],
          attachments: result.files.attachments || []
        });
        setFolders(result.folders || { main: [], attachments: [] });
        setFileGroups(fileGroups); // Φόρτωση ομάδων αρχείων
        setLinkedOrimanthiFiles(result.linkedOrimanthiFiles || []);
        setRegistrySource({
          documentRegistry: result.documentRegistry || [],
          diavgeiaMeta: result.diavgeiaMeta || null,
          diavgeiaAda: result.diavgeiaAda || '',
          modifications: result.modifications || [],
        });
      } else {
        console.error('Error loading files:', result.error);
        setFiles({ main: [], attachments: [] });
        setFolders({ main: [], attachments: [] });
        setFileGroups([]);
        setLinkedOrimanthiFiles([]);
        setRegistrySource({ documentRegistry: [], diavgeiaMeta: null, diavgeiaAda: '', modifications: [] });
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles({ main: [], attachments: [] });
      setFolders({ main: [], attachments: [] });
      setFileGroups([]);
      setLinkedOrimanthiFiles([]);
      setRegistrySource({ documentRegistry: [], diavgeiaMeta: null, diavgeiaAda: '', modifications: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggleFileGroup = (groupKey, defaultOpen = false) => {
    setExpandedGroupIds((prev) => {
      const currently = Object.prototype.hasOwnProperty.call(prev, groupKey)
        ? !!prev[groupKey]
        : !!defaultOpen;
      return { ...prev, [groupKey]: !currently };
    });
  };

  const orimanthiOriginLine = useMemo(() => {
    const titles = [];
    const seen = new Set();
    (linkedOrimanthiFiles || []).forEach((file) => {
      const title = String(file?.sourceProposalTitle || '').trim();
      if (!title || seen.has(title)) return;
      seen.add(title);
      titles.push(title);
    });
    if (titles.length === 1) return `Έργο: ${titles[0]}`;
    if (titles.length > 1) return `${titles.length} έργα ωρίμανσης`;
    return '';
  }, [linkedOrimanthiFiles]);

  const groupedNameSet = useMemo(
    () => new Set(prosklisiFileGroups.collectGroupFileNames(fileGroups)),
    [fileGroups]
  );

  const ungroupedFiles = useMemo(() => {
    const list = [];
    const seen = new Set();
    [...(files.main || []), ...(files.attachments || [])].forEach((file) => {
      if (!file || file.isGrouped || groupedNameSet.has(file.fileName)) return;
      if (seen.has(file.fileName)) return;
      seen.add(file.fileName);
      list.push({
        ...file,
        targetFolder: file.targetFolder || (files.main?.some((f) => f.fileName === file.fileName) ? 'main' : 'attachments'),
      });
    });
    return list;
  }, [files, groupedNameSet]);

  const collectSelectableNames = () => {
    const names = [];
    ungroupedFiles.forEach((f) => names.push(f.fileName));
    prosklisiFileGroups.collectGroupFileNames(fileGroups).forEach((n) => names.push(n));
    return names;
  };

  const handleToggleFileSelection = (fileName) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedFiles(new Set(collectSelectableNames()));
  const handleDeselectAll = () => setSelectedFiles(new Set());

  const handleUploadFiles = async () => {
    if (!canManageWorkflow || !prosklisiId) return;
    try {
      const result = await safeFileDialog('select-file', 'Προσθήκη Αρχείων Πρόσκλησης (PDF, Word)');
      const pickedFiles = result.files?.length
        ? result.files
        : (result.filePath ? [{ filePath: result.filePath, fileName: result.fileName }] : []);
      if (!result.success || pickedFiles.length === 0) {
        if (result.error) showToast('Σφάλμα επιλογής αρχείου: ' + result.error, 'error');
        return;
      }
      const existing = managedFiles.collectExistingFileNames(
        [...(files.attachments || []), ...(files.main || [])],
        fileGroups
      );
      const incoming = pickedFiles.map((f) => f.fileName || f.filePath);
      const { conflicts } = managedFiles.findNameConflicts(incoming, existing);
      let policy = 'keep-both';
      if (conflicts.length) {
        policy = await showFileConflictDialog({ fileNames: conflicts });
        if (!policy) return;
      }

      const groupingChoice = await askProsklisiGrouping(pickedFiles.length, fileGroups);
      if (subprojectFiles.isUploadGroupingCancelled(groupingChoice)) return;
      if (groupingChoice && (groupingChoice.action === 'new' || groupingChoice.action === 'subgroup')) {
        const titleCheck = prosklisiFileGroups.canUseGroupTitle(
          fileGroups,
          groupingChoice.title,
          groupingChoice.parentId || null
        );
        if (!titleCheck.ok) {
          showToast(titleCheck.error, 'warning');
          return;
        }
      }

      setUploading(true);
      const uploadResult = await ipcRenderer.invoke('upload-prosklisi-files', {
        prosklisiId,
        files: pickedFiles,
        targetFolder: 'attachments',
        conflictPolicy: policy,
      });
      if (!uploadResult?.success) {
        showToast('Σφάλμα προσθήκης αρχείων: ' + (uploadResult?.error || 'Άγνωστο'), 'error');
        return;
      }
      const addedNames = uploadResult.added || pickedFiles.map((f) => f.fileName);
      const groupingResult = await applyProsklisiGroupingChoice(prosklisiId, groupingChoice, addedNames);
      if (!groupingResult.success) {
        showToast(`Προστέθηκαν τα αρχεία, αλλά η ομαδοποίηση απέτυχε: ${groupingResult.error}`, 'warning');
      } else {
        showToast(
          uploadResult.addedCount === 1
            ? 'Το αρχείο προστέθηκε επιτυχώς'
            : `Προστέθηκαν ${uploadResult.addedCount} αρχεία`,
          'success'
        );
      }
      setSelectedFiles(new Set());
      await loadFiles();
    } catch (error) {
      console.error('Error uploading prosklisi files:', error);
      showToast('Σφάλμα προσθήκης αρχείων: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMoveSelected = async () => {
    if (!canManageWorkflow || selectedFiles.size === 0) {
      showToast('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο', 'warning');
      return;
    }
    const names = Array.from(selectedFiles);
    const groupingChoice = await askProsklisiGrouping(names.length, fileGroups, {
      allowSkip: false,
      cancelLabel: '✕ Ακύρωση',
      intro: `Επιλέξατε ${names.length} αρχείο(α). Πού θέλετε να τα μεταφέρετε;`,
    });
    if (groupingChoice === null || groupingChoice === false) return;
    if (groupingChoice.action === 'new' || groupingChoice.action === 'subgroup') {
      const titleCheck = prosklisiFileGroups.canUseGroupTitle(
        fileGroups,
        groupingChoice.title,
        groupingChoice.parentId || null
      );
      if (!titleCheck.ok) {
        showToast(titleCheck.error, 'warning');
        return;
      }
    }
    const groupingResult = await applyProsklisiGroupingChoice(prosklisiId, groupingChoice, names);
    if (!groupingResult.success) {
      showToast(groupingResult.error || 'Αποτυχία ομαδοποίησης', 'error');
      return;
    }
    showToast('Η ομαδοποίηση ολοκληρώθηκε', 'success');
    setSelectedFiles(new Set());
    await loadFiles();
  };

  const handleCreateEmptyGroup = async () => {
    if (!canManageWorkflow || !prosklisiId) return;
    const groupingChoice = await askProsklisiGrouping(0, fileGroups, {
      allowSkip: false,
      cancelLabel: '✕ Ακύρωση',
      heading: '📁 Νέα ομάδα αρχείων',
      intro: 'Δώστε όνομα στην ομάδα ή δημιουργήστε υποομάδα μέσα σε υπάρχουσα.',
    });
    if (groupingChoice === null || groupingChoice === false) return;
    if (groupingChoice.action === 'new' || groupingChoice.action === 'subgroup') {
      const titleCheck = prosklisiFileGroups.canUseGroupTitle(
        fileGroups,
        groupingChoice.title,
        groupingChoice.parentId || null
      );
      if (!titleCheck.ok) {
        showToast(titleCheck.error, 'warning');
        return;
      }
    }
    const groupingResult = await applyProsklisiGroupingChoice(prosklisiId, groupingChoice, []);
    if (!groupingResult.success) {
      showToast(groupingResult.error || 'Αποτυχία δημιουργίας ομάδας', 'error');
      return;
    }
    showToast('Η ομάδα δημιουργήθηκε', 'success');
    await loadFiles();
  };

  const handleCreateSubgroup = async (parentGroup) => {
    if (!canManageWorkflow || !parentGroup?.id) return;
    const groupingChoice = await askProsklisiGrouping(0, [parentGroup], {
      allowSkip: false,
      cancelLabel: '✕ Ακύρωση',
      heading: '📁 Νέα υποομάδα',
      intro: `Νέα υποομάδα μέσα στην ομάδα «${parentGroup.title}».`,
    });
    if (!groupingChoice || groupingChoice === false) return;
    const resolvedTitle = groupingChoice.title || '';
    const parentId = groupingChoice.parentId || parentGroup.id;
    if (!resolvedTitle) {
      showToast('Δώστε τίτλο υποομάδας', 'warning');
      return;
    }
    const titleCheck = prosklisiFileGroups.canUseGroupTitle(fileGroups, resolvedTitle, parentId);
    if (!titleCheck.ok) {
      showToast(titleCheck.error, 'warning');
      return;
    }
    const groupingResult = await applyProsklisiGroupingChoice(prosklisiId, {
      action: 'subgroup',
      parentId,
      title: resolvedTitle,
    }, []);
    if (!groupingResult.success) {
      showToast(groupingResult.error || 'Αποτυχία δημιουργίας υποομάδας', 'error');
      return;
    }
    showToast('Η υποομάδα δημιουργήθηκε', 'success');
    setExpandedGroupIds((prev) => ({ ...prev, [String(parentGroup.id)]: true }));
    await loadFiles();
  };

  const handleBulkDelete = async () => {
    if (!canManageWorkflow || selectedFiles.size === 0) {
      showToast('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο', 'warning');
      return;
    }
    const names = Array.from(selectedFiles);
    const ok = await showConfirm({
      title: names.length > 1 ? `Μαζική διαγραφή (${names.length})` : 'Διαγραφή αρχείου',
      message: names.length > 1
        ? `Να διαγραφούν τα ${names.length} επιλεγμένα αρχεία;`
        : `Να διαγραφεί το αρχείο «${names[0]}»;`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!ok) return;
    const result = await ipcRenderer.invoke('delete-prosklisi-files', prosklisiId, names);
    if (!result?.success) {
      showToast(result?.error || 'Αποτυχία διαγραφής', 'error');
      return;
    }
    showToast(names.length === 1 ? 'Το αρχείο διαγράφηκε' : `Διαγράφηκαν ${names.length} αρχεία`, 'success');
    setSelectedFiles(new Set());
    await loadFiles();
  };

  const handleUploadFolder = async () => {
    if (!canManageWorkflow || !prosklisiId) return;
    try {
      const pick = await ipcRenderer.invoke('select-folder-files-flat', {
        title: 'Επιλογή φακέλου για την πρόσκληση',
      });
      if (pick?.canceled) return;
      if (!pick?.success) {
        if (pick?.error) showToast('Σφάλμα επιλογής φακέλου: ' + pick.error, 'error');
        return;
      }
      const pickedFiles = (pick.files || []).map((f) => ({ filePath: f.filePath, fileName: f.fileName }));
      if (pickedFiles.length === 0) {
        showToast('Ο φάκελος δεν περιέχει αρχεία', 'warning');
        return;
      }

      const existing = managedFiles.collectExistingFileNames(
        [...(files.attachments || []), ...(files.main || [])],
        fileGroups
      );
      const { conflicts } = managedFiles.findNameConflicts(
        pickedFiles.map((f) => f.fileName),
        existing
      );
      let policy = 'keep-both';
      if (conflicts.length) {
        policy = await showFileConflictDialog({ fileNames: conflicts });
        if (!policy) return;
      }

      setUploading(true);
      const uploadResult = await ipcRenderer.invoke('upload-prosklisi-files', {
        prosklisiId,
        files: pickedFiles,
        targetFolder: 'attachments',
        conflictPolicy: policy,
      });
      if (!uploadResult?.success) {
        showToast('Σφάλμα προσθήκης αρχείων φακέλου: ' + (uploadResult?.error || 'Άγνωστο'), 'error');
        return;
      }

      const folderTitle = String(pick.folderName || 'Φάκελος').trim() || 'Φάκελος';
      const addedNames = uploadResult.added || pickedFiles.map((f) => f.fileName);
      const groupResult = await ipcRenderer.invoke('create-prosklisi-group', prosklisiId, folderTitle, addedNames);
      if (!groupResult?.success) {
        // Τα αρχεία ανέβηκαν κανονικά· η ομαδοποίηση απέτυχε — ενημερώνουμε αλλά δεν μπλοκάρουμε.
        showToast(`Προστέθηκαν ${addedNames.length} αρχεία, αλλά η ομαδοποίηση απέτυχε: ${groupResult?.error || 'Άγνωστο'}`, 'warning');
      } else {
        showToast(`Προστέθηκε ο φάκελος «${folderTitle}» με ${addedNames.length} αρχεία`, 'success');
      }
      await loadFiles();
    } catch (error) {
      console.error('Error uploading prosklisi folder:', error);
      showToast('Σφάλμα προσθήκης φακέλου: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleViewFile = async (fileName, targetFolder) => {
    try {
      await ipcRenderer.invoke('view-prosklisi-file', prosklisiId, fileName, targetFolder);
    } catch (error) {
      console.error('Error viewing file:', error);
      showToast('Σφάλμα προβολής αρχείου: ' + error.message, 'error');
    }
  };

  const handleDownloadFile = async (fileName, targetFolder) => {
    try {
      const result = await ipcRenderer.invoke('download-prosklisi-file', prosklisiId, fileName, targetFolder);
      if (result.success) {
        showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
      } else {
        showToast('Σφάλμα λήψης αρχείου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Σφάλμα λήψης αρχείου: ' + error.message, 'error');
    }
  };

  const handleViewLinkedFile = async (linked) => {
    try {
      await ipcRenderer.invoke('open-proposal-file', {
        proposalId: linked.sourceProposalId,
        groupId: linked.sourceGroupId,
        fileName: linked.fileName,
      });
    } catch (error) {
      showToast('Σφάλμα προβολής αρχείου: ' + error.message, 'error');
    }
  };

  const handleDownloadLinkedFile = async (linked) => {
    try {
      const result = await ipcRenderer.invoke('download-proposal-file', {
        proposalId: linked.sourceProposalId,
        groupId: linked.sourceGroupId,
        fileName: linked.fileName,
      });
      if (result && result.success) {
        showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
      } else if (result && result.error) {
        showToast('Σφάλμα λήψης αρχείου: ' + result.error, 'error');
      }
    } catch (error) {
      showToast('Σφάλμα λήψης αρχείου: ' + error.message, 'error');
    }
  };

  const handleRemoveLinkedFile = async (linked) => {
    if (!canManageWorkflow) return;
    const ok = await showConfirm({
      title: 'Αφαίρεση από την πρόσκληση',
      message: `Να αφαιρεθεί το «${linked.fileName}» από τα αρχεία της πρόσκλησης; Το αρχείο παραμένει στην ωρίμανση.`,
      confirmLabel: 'Αφαίρεση',
      icon: '🔗',
    });
    if (!ok) return;
    try {
      const result = await ipcRenderer.invoke('set-proposal-file-prosklisi-link', {
        proposalId: linked.sourceProposalId,
        groupId: linked.sourceGroupId,
        fileName: linked.fileName,
        removeProsklisiIds: [prosklisiId],
        actingUsername: loggedInUsername,
      });
      if (result && result.success) {
        showToast('Το αρχείο αφαιρέθηκε από την πρόσκληση', 'success');
        await loadFiles();
      } else {
        showToast((result && result.error) || 'Αποτυχία αφαίρεσης', 'error');
      }
    } catch (error) {
      showToast('Σφάλμα αφαίρεσης: ' + error.message, 'error');
    }
  };

  const linkedOrimanthiGroup = useMemo(
    () => prosklisiFileGroups.buildOrimanthiLinkedGroup(linkedOrimanthiFiles),
    [linkedOrimanthiFiles]
  );

  const setLinkedTreeOpen = (openChildren) => {
    if (!linkedOrimanthiGroup) return;
    const ids = [];
    const walk = (group) => {
      if (!group?.id) return;
      ids.push(String(group.id));
      (group.subgroups || []).forEach(walk);
    };
    walk(linkedOrimanthiGroup);
    setExpandedGroupIds((prev) => {
      const next = { ...prev };
      ids.forEach((id, index) => {
        next[id] = index === 0 ? true : openChildren;
      });
      return next;
    });
  };

  const handleRenameFile = async (fileName, targetFolder, typedName) => {
    const result = await ipcRenderer.invoke('rename-prosklisi-file', {
      prosklisiId,
      oldName: fileName,
      newName: typedName,
      targetFolder,
    });
    if (!result?.success) {
      showToast(result?.error || 'Αποτυχία μετονομασίας', 'error');
      return result;
    }
    showToast('Το αρχείο μετονομάστηκε', 'success');
    await loadFiles();
    return result;
  };

  const handleDeleteFile = async (fileName, targetFolder) => {
    if (await showConfirm({ title: 'Διαγραφή Αρχείου', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-file', prosklisiId, fileName, targetFolder);
        if (result.success) {
          await loadFiles(); // Reload files
        } else {
          showToast('Σφάλμα διαγραφής αρχείου: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        showToast('Σφάλμα διαγραφής αρχείου: ' + error.message, 'error');
      }
    }
  };

  const handleOpenFolder = async (folderName, targetFolder) => {
    // Instead of opening in Windows Explorer, show contents in modal
    try {
      const result = await ipcRenderer.invoke('get-folder-contents', prosklisiId, folderName, targetFolder);
      if (result.success) {
        showFolderContentsModal(folderName, result.contents, targetFolder);
      } else {
        showToast('Σφάλμα φόρτωσης περιεχομένων φακέλου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error loading folder contents:', error);
      showToast('Σφάλμα φόρτωσης περιεχομένων φακέλου: ' + error.message, 'error');
    }
  };

  const showFolderContentsModal = (folderName, contents, targetFolder = 'main') => {
    // Find the highest z-index among existing modals
    const existingModals = document.querySelectorAll('.folder-modal, .subfolder-modal');
    let maxZIndex = 10000;
    existingModals.forEach(modal => {
      const zIndex = parseInt(window.getComputedStyle(modal).zIndex) || 0;
      if (zIndex > maxZIndex) {
        maxZIndex = zIndex;
      }
    });
    
    const modal = document.createElement('div');
    modal.className = 'folder-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${maxZIndex + 1};
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 15px;
      padding: 2rem;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #333;">📁 ${folderName}</h3>
        <button id="close-folder-modal" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">×</button>
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        ${contents.map(item => `
          <div style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; background: #f8f9fa;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">${item.isDirectory ? '📁' : (item.name.endsWith('.pdf') ? '📄' : '📝')}</span>
              <span style="font-weight: 500; color: #333;">${item.name}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${item.isDirectory ? `
                <button onclick="window.openSubfolder('${item.name}', '${folderName}', '${targetFolder}')" style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  📂 Άνοιγμα
                </button>
              ` : `
                <button onclick="window.openFileFromFolder('${item.name}', '${folderName}', '${targetFolder}')" style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  👁️ Προβολή
                </button>
                <button onclick="window.downloadFileFromFolder('${item.name}', '${folderName}', '${targetFolder}')" style="background: #007bff; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  ⬇️ Λήψη
                </button>
              `}
              ${canManageWorkflow ? `<button onclick="window.deleteItemFromFolder('${item.name}', '${folderName}', '${targetFolder}', ${item.isDirectory})" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                🗑️ Διαγραφή
              </button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add global functions for the buttons
    window.openFileFromFolder = async (fileName, folderName, targetFolder) => {
      try {
        await ipcRenderer.invoke('view-file-from-folder', prosklisiId, folderName, fileName, targetFolder);
        // The handler will open the file directly, no need to check result
      } catch (error) {
        console.error('Error viewing file:', error);
        showToast('Σφάλμα προβολής αρχείου: ' + error.message, 'error');
      }
    };

    window.downloadFileFromFolder = async (fileName, folderName, targetFolder) => {
      try {
        const result = await ipcRenderer.invoke('download-file-from-folder', prosklisiId, folderName, fileName, targetFolder);
        if (result.success) {
          showToast('Το αρχείο λήφθηκε επιτυχώς!', 'success');
        } else if (result.error !== 'Download cancelled') {
          showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message, 'error');
      }
    };

    window.deleteFileFromFolder = async (fileName, folderName, targetFolder) => {
      if (await showConfirm({ title: 'Διαγραφή Αρχείου', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
        try {
          const result = await ipcRenderer.invoke('delete-file-from-folder', prosklisiId, folderName, fileName, targetFolder);
          if (result.success) {
            // Remove the file from the modal
            const fileElement = document.querySelector(`[onclick*="${fileName}"]`).closest('div');
            if (fileElement) {
              fileElement.remove();
            }
            showToast('Το αρχείο διαγράφηκε επιτυχώς!', 'success');
          } else {
            showToast('Σφάλμα διαγραφής αρχείου: ' + result.error, 'error');
          }
        } catch (error) {
          console.error('Error deleting file:', error);
          showToast('Σφάλμα διαγραφής αρχείου: ' + error.message, 'error');
        }
      }
    };

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Function to open subfolder
    window.openSubfolder = async (subfolderName, parentFolderName, targetFolder) => {
      try {
        const result = await ipcRenderer.invoke('get-subfolder-contents', prosklisiId, parentFolderName, subfolderName, targetFolder);
        if (result.success) {
          showSubfolderContentsModal(subfolderName, result.contents, parentFolderName, targetFolder);
      } else {
        showToast('Σφάλμα φόρτωσης περιεχομένων υποφακέλου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error loading subfolder contents:', error);
      showToast('Σφάλμα φόρτωσης περιεχομένων υποφακέλου: ' + error.message, 'error');
      }
    };

    // Function to delete item (file or folder)
    window.deleteItemFromFolder = async (itemName, folderName, targetFolder, isDirectory) => {
      const itemType = isDirectory ? 'φάκελο' : 'αρχείο';
      if (await showConfirm({ title: `Διαγραφή ${isDirectory ? 'Φακέλου' : 'Αρχείου'}`, message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το ${itemType} "${itemName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
        try {
          const result = await ipcRenderer.invoke('delete-item-from-folder', prosklisiId, folderName, itemName, targetFolder, isDirectory);
          if (result.success) {
            // Remove the item from the modal
            const itemElement = document.querySelector(`[onclick*="${itemName}"]`).closest('div');
            if (itemElement) {
              itemElement.remove();
            }
            showToast(`Το ${itemType} διαγράφηκε επιτυχώς!`, 'success');
          } else {
            showToast(`Σφάλμα διαγραφής ${itemType}: ` + result.error, 'error');
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          showToast(`Σφάλμα διαγραφής ${itemType}: ` + error.message, 'error');
        }
      }
    };

    let handleEscKey;

    // Cleanup function to remove global functions when modal closes
    window.cleanupFolderModal = () => {
      if (handleEscKey) {
        document.removeEventListener('keydown', handleEscKey);
        handleEscKey = null;
      }
      delete window.openFileFromFolder;
      delete window.downloadFileFromFolder;
      delete window.deleteFileFromFolder;
      delete window.openSubfolder;
      delete window.deleteItemFromFolder;
      delete window.cleanupFolderModal;
    };

    // Add event listener for close button
    const closeButton = content.querySelector('#close-folder-modal');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        modal.remove();
        window.cleanupFolderModal();
      });
    }

    // Add event listeners for closing modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        window.cleanupFolderModal();
      }
    });

    // Add ESC key listener
    handleEscKey = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        window.cleanupFolderModal();
      }
    };
    document.addEventListener('keydown', handleEscKey);
  };

  const showSubfolderContentsModal = (subfolderName, contents, parentFolderName, targetFolder) => {
    // Find the highest z-index among existing modals
    const existingModals = document.querySelectorAll('.folder-modal, .subfolder-modal');
    let maxZIndex = 10000;
    existingModals.forEach(modal => {
      const zIndex = parseInt(window.getComputedStyle(modal).zIndex) || 0;
      if (zIndex > maxZIndex) {
        maxZIndex = zIndex;
      }
    });
    
    const modal = document.createElement('div');
    modal.className = 'subfolder-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: ${maxZIndex + 1};
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 2rem;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #333;">📁 ${subfolderName}</h3>
        <button id="close-subfolder-modal" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">×</button>
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        ${contents.map(item => `
          <div style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; background: #f8f9fa;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">${item.isDirectory ? '📁' : (item.name.endsWith('.pdf') ? '📄' : '📝')}</span>
              <span style="font-weight: 500; color: #333;">${item.name}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${item.isDirectory ? `
                <button onclick="window.openSubfolder('${item.name}', '${parentFolderName}', '${targetFolder}')" style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  📂 Άνοιγμα
                </button>
              ` : `
                <button onclick="window.openFileFromSubfolder('${item.name}', '${subfolderName}', '${parentFolderName}', '${targetFolder}')" style="background: #28a745; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  👁️ Προβολή
                </button>
                <button onclick="window.downloadFileFromSubfolder('${item.name}', '${subfolderName}', '${parentFolderName}', '${targetFolder}')" style="background: #007bff; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                  ⬇️ Λήψη
                </button>
              `}
              ${canManageWorkflow ? `<button onclick="window.deleteItemFromSubfolder('${item.name}', '${subfolderName}', '${parentFolderName}', '${targetFolder}', ${item.isDirectory})" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
                🗑️ Διαγραφή
              </button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add global functions for subfolder buttons
    window.openFileFromSubfolder = async (fileName, subfolderName, parentFolderName, targetFolder) => {
      try {
        await ipcRenderer.invoke('view-file-from-subfolder', prosklisiId, parentFolderName, subfolderName, fileName, targetFolder);
        // The handler will open the file directly, no need to check result
      } catch (error) {
        console.error('Error opening file from subfolder:', error);
        showToast('Σφάλμα ανοίγματος αρχείου: ' + error.message, 'error');
      }
    };

    window.downloadFileFromSubfolder = async (fileName, subfolderName, parentFolderName, targetFolder) => {
      try {
        const result = await ipcRenderer.invoke('download-file-from-subfolder', prosklisiId, parentFolderName, subfolderName, fileName, targetFolder);
        if (result.success) {
          showToast('Το αρχείο λήφθηκε επιτυχώς!', 'success');
        } else if (result.error !== 'Download cancelled') {
          showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error downloading file from subfolder:', error);
        showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message, 'error');
      }
    };

    window.deleteItemFromSubfolder = async (itemName, subfolderName, parentFolderName, targetFolder, isDirectory) => {
      const itemType = isDirectory ? 'φάκελο' : 'αρχείο';
      if (await showConfirm({ title: `Διαγραφή ${isDirectory ? 'Φακέλου' : 'Αρχείου'}`, message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το ${itemType} "${itemName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
        try {
          const result = await ipcRenderer.invoke('delete-item-from-subfolder', prosklisiId, parentFolderName, subfolderName, itemName, targetFolder, isDirectory);
          if (result.success) {
            // Remove the item from the modal
            const itemElement = document.querySelector(`[onclick*="${itemName}"]`).closest('div');
            if (itemElement) {
              itemElement.remove();
            }
            showToast(`Το ${itemType} διαγράφηκε επιτυχώς!`, 'success');
          } else {
            showToast(`Σφάλμα διαγραφής ${itemType}: ` + result.error, 'error');
          }
        } catch (error) {
          console.error('Error deleting item from subfolder:', error);
          showToast(`Σφάλμα διαγραφής ${itemType}: ` + error.message, 'error');
        }
      }
    };

    // Function to close subfolder modal
    window.closeSubfolderModal = () => {
      const modal = document.querySelector('.subfolder-modal');
      if (modal) {
        modal.remove();
      }
      window.cleanupSubfolderModal();
    };

    // Cleanup function for subfolder modal
    let handleEscKey = null;
    window.cleanupSubfolderModal = () => {
      if (handleEscKey) {
        document.removeEventListener('keydown', handleEscKey);
        handleEscKey = null;
      }
      delete window.openFileFromSubfolder;
      delete window.downloadFileFromSubfolder;
      delete window.deleteItemFromSubfolder;
      delete window.closeSubfolderModal;
      delete window.cleanupSubfolderModal;
    };

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listener for close button
    const closeButton = content.querySelector('#close-subfolder-modal');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        modal.remove();
        window.cleanupSubfolderModal();
      });
    }

    // Add event listeners for closing modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        window.cleanupSubfolderModal();
      }
    });

    // Add ESC key listener
    handleEscKey = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        window.cleanupSubfolderModal();
      }
    };
    document.addEventListener('keydown', handleEscKey);
  };

  const handleDeleteFolder = async (folderName, targetFolder) => {
    if (await showConfirm({ title: 'Διαγραφή Φακέλου', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε τον φάκελο "${folderName}";`, detail: 'Θα διαγραφούν επίσης όλα τα περιεχόμενά του.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-folder', prosklisiId, folderName, targetFolder);
        if (result.success) {
          await loadFiles(); // Reload files and folders
        } else {
          showToast('Σφάλμα διαγραφής φακέλου: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
        showToast('Σφάλμα διαγραφής φακέλου: ' + error.message, 'error');
      }
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const group = prosklisiFileGroups.findGroupById(fileGroups, groupId);
    if (group && await showConfirm({ title: 'Διαγραφή Ομάδας', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την ομάδα "${group.title}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-group', prosklisiId, groupId);
        if (result.success) {
          await loadFiles(); // Reload files and groups
        } else {
          showToast('Σφάλμα διαγραφής ομάδας: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error deleting group:', error);
        showToast('Σφάλμα διαγραφής ομάδας: ' + error.message, 'error');
      }
    }
  };


  const renderManagedFile = (file, extraTestId) => {
    const name = file.originalName || file.fileName;
    const { label, bg } = getFileTypeStyle(name);
    const targetFolder = file.targetFolder || 'attachments';
    return (
      <FileItem key={file.fileName} data-testid={extraTestId || `psk-file-row-${file.fileName}`}>
        <FileInfo>
          {canManageWorkflow && (
            <input
              type="checkbox"
              data-testid={`psk-file-check-${file.fileName}`}
              checked={selectedFiles.has(file.fileName)}
              onChange={() => handleToggleFileSelection(file.fileName)}
              style={checkboxStyle}
            />
          )}
          <FileIconBadge $bg={bg}>{label}</FileIconBadge>
          <FileName>{name}</FileName>
        </FileInfo>
        <FileActions>
          <ViewIconBtn title="Προβολή" onClick={() => handleViewFile(file.fileName, targetFolder)}>👁</ViewIconBtn>
          <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadFile(file.fileName, targetFolder)}>⬇</DownloadIconBtn>
          {canManageWorkflow && (
            <RenameIconBtn
              title="Μετονομασία"
              data-testid={`file-rename-${file.fileName}`}
              onClick={() => setRenameTarget({ fileName: file.fileName, targetFolder })}
            >
              ✎
            </RenameIconBtn>
          )}
          {canManageWorkflow && (
            <DeleteIconBtn title="Διαγραφή" onClick={() => handleDeleteFile(file.fileName, targetFolder)}>✕</DeleteIconBtn>
          )}
        </FileActions>
      </FileItem>
    );
  };

  const renderFolderRow = (folder, targetFolder, key) => (
    <FileItem key={key}>
      <FileInfo>
        <FileIconBadge $bg={`linear-gradient(135deg, ${C.indigo}, ${C.violet})`}>ΦΑΚ</FileIconBadge>
        <FileName>{folder.originalName || folder.folderName}</FileName>
      </FileInfo>
      <FileActions>
        <FolderOpenBtn title="Άνοιγμα" onClick={() => handleOpenFolder(folder.folderName, targetFolder)}>📂</FolderOpenBtn>
        {canManageWorkflow && (
          <DeleteIconBtn title="Διαγραφή" onClick={() => handleDeleteFolder(folder.folderName, targetFolder)}>✕</DeleteIconBtn>
        )}
      </FileActions>
    </FileItem>
  );

  const renderLinkedFile = (lf, idx) => {
    const name = lf.originalName || lf.fileName;
    const { label, bg } = getFileTypeStyle(name);
    return (
      <FileItem $linked key={`${lf.sourceProposalId}-${lf.sourceGroupId}-${lf.fileName}-${idx}`}>
        <FileInfo>
          <FileIconBadge $bg={bg}>{label}</FileIconBadge>
          <FileName title={name}>{name}</FileName>
        </FileInfo>
        <FileActions>
          <ViewIconBtn title="Προβολή" onClick={() => handleViewLinkedFile(lf)}>👁</ViewIconBtn>
          <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadLinkedFile(lf)}>⬇</DownloadIconBtn>
          {canManageWorkflow && (
            <DeleteIconBtn
              title="Αφαίρεση από την πρόσκληση"
              data-testid={`psk-linked-remove-${lf.fileName}`}
              onClick={() => handleRemoveLinkedFile(lf)}
            >
              ✕
            </DeleteIconBtn>
          )}
        </FileActions>
      </FileItem>
    );
  };

  const renderGroupCard = (group, groupIndex, options = {}) => {
    const groupKey = String(group.id || groupIndex);
    const isLinked = !!(group.linked || options.linked);
    const nested = !!options.nested;
    const isRootLinked = isLinked && !nested;
    const defaultOpen = isRootLinked;
    const isOpenGroup = Object.prototype.hasOwnProperty.call(expandedGroupIds, groupKey)
      ? !!expandedGroupIds[groupKey]
      : defaultOpen;
    const fileCount = prosklisiFileGroups.countGroupFiles(group);
    const folderCount = (group.subgroups || []).length;
    const fileWord = fileCount === 1 ? 'αρχείο' : 'αρχεία';
    const folderWord = folderCount === 1 ? 'φάκελος' : 'φάκελοι';
    let countLabel = `${fileCount} ${fileWord}`;
    if (folderCount > 0) {
      countLabel = fileCount > 0
        ? `${folderCount} ${folderWord} · ${fileCount} ${fileWord}`
        : `${folderCount} ${folderWord}`;
    }
    const directFiles = group.files || [];
    const subgroups = group.subgroups || [];
    return (
      <GroupCard
        key={group.id || groupIndex}
        data-testid={
          isRootLinked && !options.embedded
            ? 'psk-linked-orimanthi-files'
            : (!isLinked ? `psk-group-${group.id || groupIndex}` : undefined)
        }
      >
        <NodeRow>
          <GroupToggle
            type="button"
            $open={isOpenGroup}
            aria-expanded={isOpenGroup}
            title={isOpenGroup ? 'Σύμπτυξη' : 'Άνοιγμα φακέλου'}
            onClick={() => toggleFileGroup(groupKey, defaultOpen)}
          >
            <GroupChevron $open={isOpenGroup} aria-hidden>▶</GroupChevron>
            <GroupIcon aria-hidden>{isOpenGroup ? '📂' : '📁'}</GroupIcon>
            <NodeTitle title={group.title}>{group.title}</NodeTitle>
            {isRootLinked && <OriginBadge>Αυτόματα</OriginBadge>}
            <GroupCount>{countLabel}</GroupCount>
          </GroupToggle>
          {canManageWorkflow && !isLinked && (
            <>
              <IconActionBtn
                type="button"
                title="Νέα υποομάδα"
                data-testid={`psk-group-add-sub-${group.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateSubgroup(group);
                }}
              >
                ＋
              </IconActionBtn>
              <DeleteIconBtn
                title="Διαγραφή Ομάδας"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteGroup(group.id || groupIndex);
                }}
              >✕</DeleteIconBtn>
            </>
          )}
        </NodeRow>
        {isOpenGroup && (
          <TreeChildren $accent={isLinked}>
            {isRootLinked && (
              <>
                <OriginNote>
                  Καταγράφηκαν αυτόματα από την ωρίμανση, με τους ίδιους φακέλους.
                  {orimanthiOriginLine ? <OriginProject>{orimanthiOriginLine}</OriginProject> : null}
                </OriginNote>
                {subgroups.length > 0 && (
                  <TreeTools>
                    <TreeToolBtn type="button" onClick={() => setLinkedTreeOpen(true)}>Άνοιγμα όλων</TreeToolBtn>
                    <TreeToolBtn type="button" onClick={() => setLinkedTreeOpen(false)}>Μόνο οι φάκελοι</TreeToolBtn>
                  </TreeTools>
                )}
              </>
            )}
            {subgroups.map((sub, subIndex) => (
              renderGroupCard(sub, `${groupKey}-${subIndex}`, { linked: isLinked, nested: true })
            ))}
            {directFiles.length > 0 && (
              <FilesList>
                {directFiles.map((file, idx) => (
                  isLinked || file.sourceProposalId
                    ? renderLinkedFile(file, idx)
                    : renderManagedFile(file, `psk-file-row-${file.fileName}`)
                ))}
              </FilesList>
            )}
            {!directFiles.length && !subgroups.length ? (
              <EmptyFolder>Δεν υπάρχουν αρχεία σε αυτόν τον φάκελο</EmptyFolder>
            ) : null}
          </TreeChildren>
        )}
      </GroupCard>
    );
  };

  const looseCount = ungroupedFiles.length + (folders.main || []).length + (folders.attachments || []).length;
  const looseOpen = Object.prototype.hasOwnProperty.call(expandedGroupIds, 'psk-ungrouped')
    ? !!expandedGroupIds['psk-ungrouped']
    : true;

  if (!isOpen) return null;

  return (
    <>
    <Overlay data-testid="psk-files-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        <Header>
          <Title>📁 Αρχεία Πρόσκλησης: {prosklisiTitle}</Title>
          <HeaderActions>
            {canManageWorkflow && (ungroupedFiles.length > 0 || fileGroups.length > 0) && (
              <>
                {selectedFiles.size > 0 && (
                  <>
                    <MoveBtn type="button" data-testid="psk-files-move" onClick={handleMoveSelected}>
                      📂 Μεταφορά ({selectedFiles.size})
                    </MoveBtn>
                    <BulkDeleteBtn type="button" data-testid="psk-files-bulk-delete" onClick={handleBulkDelete}>
                      🗑 Διαγραφή ({selectedFiles.size})
                    </BulkDeleteBtn>
                  </>
                )}
                <PillBtn
                  type="button"
                  data-testid="psk-files-select-all"
                  $active={selectedFiles.size > 0}
                  onClick={selectedFiles.size > 0 ? handleDeselectAll : handleSelectAll}
                >
                  {selectedFiles.size > 0 ? '✕ Αποεπιλογή' : '✓ Επιλογή Όλων'}
                </PillBtn>
              </>
            )}
            <CloseButton onClick={onClose}>✖</CloseButton>
          </HeaderActions>
        </Header>
        <HeaderDivider />
        
        <Content>
          {loading ? (
            <LoadingMessage>Φόρτωση αρχείων...</LoadingMessage>
          ) : (
            <>
              {canManageWorkflow && (
                <UploadBar>
                  <UploadBarLabel>Προσθήκη</UploadBarLabel>
                  <UploadButton type="button" data-testid="psk-files-upload" onClick={handleUploadFiles} disabled={uploading}>
                    {uploading ? '⏳ Προσθήκη…' : '📎 Προσθήκη Αρχείων'}
                  </UploadButton>
                  <UploadFolderButton type="button" onClick={handleUploadFolder} disabled={uploading}>
                    {uploading ? '⏳ Προσθήκη…' : '📁 Προσθήκη Φακέλου'}
                  </UploadFolderButton>
                  <NewGroupButton type="button" data-testid="psk-files-new-group" onClick={handleCreateEmptyGroup} disabled={uploading}>
                    🆕 Νέα Ομάδα
                  </NewGroupButton>
                </UploadBar>
              )}
              <KhmdhsDocumentRegistryPanel
                entries={registryEntries}
                headerTitle="Καταχωρήσεις Διαύγειας"
              />

              {linkedOrimanthiGroup && (
                <SectionCard $accent data-testid="psk-linked-orimanthi-files">
                  {renderGroupCard(linkedOrimanthiGroup, 'orimanthi', { embedded: true })}
                </SectionCard>
              )}

              {fileGroups && fileGroups.length > 0 && (
                <SectionCard>
                  <SectionLabel>Φάκελοι της πρόσκλησης</SectionLabel>
                  {fileGroups.map((group, groupIndex) => renderGroupCard(group, groupIndex))}
                </SectionCard>
              )}

              {(looseCount > 0) && (
                <SectionCard>
                  <NodeRow>
                    <GroupToggle
                      type="button"
                      $open={looseOpen}
                      aria-expanded={looseOpen}
                      title="Αρχεία που δεν μπήκαν σε φάκελο"
                      onClick={() => toggleFileGroup('psk-ungrouped', true)}
                    >
                      <GroupChevron $open={looseOpen} aria-hidden>▶</GroupChevron>
                      <GroupIcon aria-hidden>📄</GroupIcon>
                      <NodeTitle>Αρχεία χωρίς φάκελο</NodeTitle>
                      <GroupCount>
                        {looseCount} {looseCount === 1 ? 'αρχείο' : 'αρχεία'}
                      </GroupCount>
                    </GroupToggle>
                  </NodeRow>
                  {looseOpen && (
                    <TreeChildren>
                      <FilesList>
                        {ungroupedFiles.map((file) => renderManagedFile(file, `psk-file-ungrouped-${file.fileName}`))}
                        {(folders.main || []).map((folder, index) => renderFolderRow(folder, 'main', `main-folder-${index}`))}
                        {(folders.attachments || []).map((folder, index) => renderFolderRow(folder, 'attachments', `attachments-folder-${index}`))}
                      </FilesList>
                    </TreeChildren>
                  )}
                </SectionCard>
              )}

              {!linkedOrimanthiGroup && !(fileGroups || []).length && !ungroupedFiles.length
                && !(folders.main || []).length && !(folders.attachments || []).length && (
                <EmptyState>
                  {canManageWorkflow
                    ? 'Δεν υπάρχουν αρχεία. Χρησιμοποιήστε «Προσθήκη Αρχείων» ή «Προσθήκη Φακέλου».'
                    : 'Δεν υπάρχουν αρχεία για αυτή την πρόσκληση'}
                </EmptyState>
              )}
            </>
          )}
        </Content>
      </Modal>
    </Overlay>
    {renameTarget && (
      <FileRenameModal
        currentName={renameTarget.fileName}
        onClose={() => setRenameTarget(null)}
        onSave={async (typed) => {
          try {
            const res = await handleRenameFile(renameTarget.fileName, renameTarget.targetFolder, typed);
            if (res?.success) setRenameTarget(null);
          } catch {
            /* το μήνυμα εμφανίζεται από handleRenameFile */
          }
        }}
      />
    )}
    </>
  );
}

export default ProsklisisFileManager;
