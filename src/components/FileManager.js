import React, { useEffect, useState } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import KhmdhsDocumentRegistryPanel from './KhmdhsDocumentRegistryPanel';
import { KHMDHS_RELATED_DOCS_SECTION_TITLE } from '../utils/khmdhsRelatedDocuments';
import FileRenameModal from './FileRenameModal';

/* ─── Design tokens (app palette) ──────────────────────────────────────── */
const C = {
  indigo:      '#6366f1',
  indigoDark:  '#4f46e5',
  indigoLight: '#eef2ff',
  violet:      '#8b5cf6',
  emerald:     '#10b981',
  emeraldDark: '#059669',
  red:         '#ef4444',
  redDark:     '#dc2626',
  slate900:    '#0f172a',
  slate800:    '#1e293b',
  slate600:    '#475569',
  slate500:    '#64748b',
  slate300:    '#cbd5e1',
  slate200:    '#e2e8f0',
  slate100:    '#f1f5f9',
  slate50:     '#f8fafc',
  white:       '#ffffff',
};

/* ─── Helper: per-extension icon label & gradient ───────────────────────── */
function getFileTypeStyle(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
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

/* ─── Styled components ─────────────────────────────────────────────────── */

const FileManagerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 2rem;
  overflow-y: auto;
`;

const FileManagerContainer = styled.div`
  background: ${C.white};
  border-radius: 18px;
  padding: 0;
  max-width: 860px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow:
    0 20px 60px rgba(99, 102, 241, 0.13),
    0 4px 16px rgba(0, 0, 0, 0.08);
  animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 2rem;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-18px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

/* Header area — top section with gradient accent line */
const HeaderWrap = styled.div`
  padding: 1.4rem 1.75rem 0;
  flex-shrink: 0;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const TitleIcon = styled.span`
  font-size: 1.25rem;
  line-height: 1;
`;

const Title = styled.h3`
  color: ${C.slate800};
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.01em;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

/* Pill button for select-all / deselect-all */
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
    border-color: ${(p) => (p.$active ? C.slate300 : C.indigo)};
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.18);
  }
`;

/* Move-to-group pill */
const MoveBtn = styled(PillBtn)`
  border-color: ${C.emerald};
  background: #ecfdf5;
  color: ${C.emeraldDark};

  &:hover {
    background: ${C.emerald};
    color: ${C.white};
    border-color: ${C.emerald};
  }
`;

const BulkDeleteBtn = styled(PillBtn)`
  border-color: ${C.red};
  background: #fef2f2;
  color: ${C.red};

  &:hover {
    background: ${C.red};
    color: ${C.white};
    border-color: ${C.red};
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.18);
  }
`;

/* X close button */
const CloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: ${C.slate100};
  color: ${C.slate500};
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;

  &:hover:not(:disabled) {
    background: #fee2e2;
    color: ${C.red};
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
`;

/* Gradient accent line below header */
const HeaderDivider = styled.div`
  height: 2px;
  background: linear-gradient(90deg, ${C.indigo}, ${C.violet}, transparent);
  border-radius: 2px;
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

const UploadBtn = styled.button`
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  font-family: inherit;

  ${(p) => p.$variant === 'ghost' && `
    background: ${C.white};
    color: ${C.slate600};
    border-color: ${C.slate200};
    &:hover:not(:disabled) {
      background: ${C.slate100};
      color: ${C.slate800};
    }
  `}

  ${(p) => p.$variant === 'teal' && `
    background: #ecfdf5;
    color: ${C.emeraldDark};
    border-color: #a7f3d0;
    &:hover:not(:disabled) {
      background: #d1fae5;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/* Scrollable body */
const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 1.25rem 1.75rem 1.75rem;
`;

const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

/* ─── Group separator ───────────────────────────────────────────────────── */
const GroupSection = styled.div`
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.7rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid ${C.slate200};
`;

const GroupIcon = styled.span`
  font-size: 1rem;
`;

const GroupLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${C.slate600};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex: 1;
`;

const GroupCount = styled.span`
  font-size: 0.75rem;
  color: ${C.slate500};
  background: ${C.slate100};
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
`;

/* ─── File row ──────────────────────────────────────────────────────────── */
const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.9rem;
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

const FileIcon = styled.div`
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

/* Circular icon-only action button */
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

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
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
    color: ${C.emeraldDark};
    border-color: #a7f3d0;
  }
`;

const DeleteIconBtn = styled(IconActionBtn)`
  &:hover {
    background: #fee2e2;
    color: ${C.red};
    border-color: #fecaca;
  }
`;

const RenameIconBtn = styled(IconActionBtn)`
  &:hover {
    background: ${C.indigoLight};
    color: ${C.indigo};
    border-color: #c7d2fe;
  }
`;

/* ─── Ungrouped files section header ────────────────────────────────────── */
const UngroupedHeader = styled(GroupHeader)`
  margin-top: ${(p) => (p.$hasGroups ? '1.5rem' : '0')};
`;

/* ─── Empty state ───────────────────────────────────────────────────────── */
const EmptyState = styled.div`
  text-align: center;
  padding: 3.5rem 2rem;
  color: ${C.slate500};
`;

const EmptyIcon = styled.div`
  font-size: 2.8rem;
  margin-bottom: 0.75rem;
  opacity: 0.45;
`;

const EmptyText = styled.p`
  font-size: 0.95rem;
  margin: 0;
  font-weight: 500;
`;

/* ─── Delete confirmation modal ─────────────────────────────────────────── */
const ConfirmOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 18px;
  padding: 1.5rem;
`;

const ConfirmCard = styled.div`
  background: ${C.white};
  border-radius: 16px;
  padding: 1.75rem 2rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.93); }
    to   { opacity: 1; transform: scale(1); }
  }
`;

const ConfirmIconRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
`;

const ConfirmIconBadge = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #fee2e2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
`;

const ConfirmTitle = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: ${C.slate800};
`;

const ConfirmBody = styled.div`
  font-size: 0.85rem;
  color: ${C.slate600};
  line-height: 1.55;
  margin-bottom: 1.4rem;
`;

const ConfirmFileList = styled.ul`
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  max-height: 140px;
  overflow-y: auto;
`;

const ConfirmFileListItem = styled.li`
  font-size: 0.82rem;
  font-weight: 600;
  color: ${C.slate800};
  background: ${C.slate100};
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  margin-bottom: 0.35rem;
  word-break: break-all;
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
`;

const CancelBtn = styled.button`
  padding: 0.52rem 1.1rem;
  border-radius: 8px;
  border: 1.5px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate600};
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: ${C.slate100};
    border-color: ${C.slate300};
  }
`;

const ConfirmDeleteBtn = styled.button`
  padding: 0.52rem 1.1rem;
  border-radius: 8px;
  border: none;
  background: ${C.red};
  color: ${C.white};
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover:not(:disabled) {
    background: ${C.redDark};
    box-shadow: 0 3px 10px rgba(239, 68, 68, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const ProcessingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(4px);
  border-radius: 18px;
  pointer-events: all;
`;

const ProcessingCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  background: ${C.white};
  border: 1.5px solid ${C.slate200};
  border-radius: 16px;
  padding: 1.5rem 2rem;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 360px;
  text-align: center;
`;

const ProcessingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid ${C.slate200};
  border-top-color: ${C.indigo};
  border-radius: 50%;
  animation: fileMgrSpin 0.75s linear infinite;

  @keyframes fileMgrSpin {
    to { transform: rotate(360deg); }
  }
`;

const ProcessingTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${C.slate800};
`;

const ProcessingHint = styled.div`
  font-size: 0.8rem;
  color: ${C.slate500};
  font-weight: 500;
  line-height: 1.45;
`;

/* ─── Checkbox style helper ─────────────────────────────────────────────── */
const checkboxStyle = {
  flexShrink: 0,
  width: '16px',
  height: '16px',
  cursor: 'pointer',
  accentColor: C.indigo,
};

/* ─── Component ─────────────────────────────────────────────────────────── */
function FileManager({
  files,
  fileGroups = [],
  khmdhsDocumentRegistry = [],
  khmdhsRelatedDocuments = [],
  userRole: _userRole,
  canUpload = false,
  isUploading = false,
  onUploadFiles,
  onUploadFolder,
  onViewFile,
  onDownloadFile,
  onDeleteFile,
  onDeleteFiles,
  onRenameFile,
  onClose,
  onRefresh,
  onGroupFiles
}) {
  const { showToast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, fileNames: [] });
  const [renameTarget, setRenameTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingCount, setDeletingCount] = useState(0);

  useEffect(() => {
    lockBodyScroll('filemanager');
    return () => unlockBodyScroll('filemanager');
  }, []);

  useEffect(() => {
    if (!canUpload || !onRenameFile) return undefined;
    const onKey = (e) => {
      if (e.key !== 'F2' || renameTarget) return;
      if (selectedFiles.size !== 1) return;
      e.preventDefault();
      setRenameTarget(Array.from(selectedFiles)[0]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUpload, onRenameFile, selectedFiles, renameTarget]);

  const handleToggleFileSelection = (fileName) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(fileName) ? next.delete(fileName) : next.add(fileName);
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set();
    files.forEach(f => all.add(f));
    fileGroups.forEach(g =>
      g.files.forEach(f => {
        const name = typeof f === 'string' ? f : (f.name || f.fileName || '');
        all.add(name);
      })
    );
    setSelectedFiles(all);
  };

  const handleDeselectAll = () => setSelectedFiles(new Set());

  const requestDeleteFile = (fileName) => {
    setDeleteConfirm({ open: true, fileNames: [fileName] });
  };

  const requestBulkDelete = () => {
    if (selectedFiles.size === 0) {
      showToast('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο', 'warning');
      return;
    }
    setDeleteConfirm({ open: true, fileNames: Array.from(selectedFiles) });
  };

  const confirmDelete = async () => {
    const { fileNames } = deleteConfirm;
    if (!fileNames?.length || isDeleting) return;

    setDeleteConfirm({ open: false, fileNames: [] });
    setDeletingCount(fileNames.length);
    setIsDeleting(true);
    try {
      if (fileNames.length === 1) {
        await onDeleteFile(fileNames[0]);
      } else if (onDeleteFiles) {
        await onDeleteFiles(fileNames);
      } else {
        for (const name of fileNames) {
          // eslint-disable-next-line no-await-in-loop
          await onDeleteFile(name);
        }
      }
      setSelectedFiles(new Set());
      onRefresh();
    } finally {
      setIsDeleting(false);
      setDeletingCount(0);
    }
  };

  const cancelDelete = () => setDeleteConfirm({ open: false, fileNames: [] });

  const handleMoveToGroup = () => {
    if (selectedFiles.size === 0) {
      showToast('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο', 'warning');
      return;
    }
    if (onGroupFiles) onGroupFiles(Array.from(selectedFiles), fileGroups);
  };

  const hasKhmdhsRegistry = (khmdhsDocumentRegistry || []).length > 0;
  const hasKhmdhsRelated = (khmdhsRelatedDocuments || []).length > 0;
  const hasPhysicalFiles = files.length > 0 || fileGroups.some((g) => g.files.length > 0);
  const hasFiles = hasKhmdhsRegistry || hasKhmdhsRelated || hasPhysicalFiles;
  const canMutate = canUpload;

  /* Render a single file row — shared between groups and ungrouped */
  const renderFileItem = (fileName, key, extraTestId) => {
    const { label, bg } = getFileTypeStyle(fileName);
    return (
      <FileItem key={key} data-testid={extraTestId || `file-row-${fileName}`}>
        <FileInfo>
          {canMutate && (
            <input
              type="checkbox"
              checked={selectedFiles.has(fileName)}
              onChange={() => handleToggleFileSelection(fileName)}
              style={checkboxStyle}
            />
          )}
          <FileIcon $bg={bg}>{label}</FileIcon>
          <FileName>{fileName}</FileName>
        </FileInfo>

        <FileActions>
          <ViewIconBtn
            title="Προβολή"
            onClick={() => onViewFile(fileName)}
          >
            👁
          </ViewIconBtn>
          <DownloadIconBtn
            title="Λήψη"
            onClick={() => onDownloadFile(fileName)}
          >
            ⬇
          </DownloadIconBtn>
          {canMutate && onRenameFile && (
            <RenameIconBtn
              title="Μετονομασία (F2)"
              data-testid={`file-rename-${fileName}`}
              onClick={() => setRenameTarget(fileName)}
            >
              ✎
            </RenameIconBtn>
          )}
          {canMutate && (
            <DeleteIconBtn
              title="Διαγραφή"
              data-testid={`file-remove-${key}`}
              onClick={() => requestDeleteFile(fileName)}
            >
              ✕
            </DeleteIconBtn>
          )}
        </FileActions>
      </FileItem>
    );
  };

  return (
    <FileManagerOverlay
      data-file-manager-modal
      data-testid="file-manager"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ paddingTop: `${Math.max(50, window.innerHeight * 0.08)}px` }}
    >
      <FileManagerContainer style={{ position: 'relative' }}>

        {isDeleting && (
          <ProcessingOverlay>
            <ProcessingCard>
              <ProcessingSpinner />
              <ProcessingTitle>
                {deletingCount > 1
                  ? `Διαγραφή ${deletingCount} αρχείων…`
                  : 'Διαγραφή αρχείου…'}
              </ProcessingTitle>
              <ProcessingHint>
                Παρακαλώ περιμένετε — η διαδικασία μπορεί να διαρκέσει λίγα δευτερόλεπτα
              </ProcessingHint>
            </ProcessingCard>
          </ProcessingOverlay>
        )}

        {/* ── Delete confirmation overlay ─────────────────────────────── */}
        {deleteConfirm.open && (
          <ConfirmOverlay>
            <ConfirmCard>
              <ConfirmIconRow>
                <ConfirmIconBadge>🗑</ConfirmIconBadge>
                <ConfirmTitle>
                  {deleteConfirm.fileNames.length > 1
                    ? `Μαζική διαγραφή (${deleteConfirm.fileNames.length})`
                    : 'Διαγραφή αρχείου'}
                </ConfirmTitle>
              </ConfirmIconRow>
              <ConfirmBody>
                {deleteConfirm.fileNames.length > 1 ? (
                  <>
                    Είστε σίγουροι ότι θέλετε να διαγράψετε τα επιλεγμένα αρχεία;
                    <ConfirmFileList>
                      {deleteConfirm.fileNames.slice(0, 8).map((name) => (
                        <ConfirmFileListItem key={name}>{name}</ConfirmFileListItem>
                      ))}
                      {deleteConfirm.fileNames.length > 8 ? (
                        <ConfirmFileListItem>
                          …και άλλα {deleteConfirm.fileNames.length - 8}
                        </ConfirmFileListItem>
                      ) : null}
                    </ConfirmFileList>
                  </>
                ) : (
                  <>
                    Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο:
                    <ConfirmFileList>
                      <ConfirmFileListItem>{deleteConfirm.fileNames[0]}</ConfirmFileListItem>
                    </ConfirmFileList>
                  </>
                )}
              </ConfirmBody>
              <ConfirmActions>
                <CancelBtn onClick={cancelDelete} disabled={isDeleting}>Άκυρο</CancelBtn>
                <ConfirmDeleteBtn onClick={confirmDelete} disabled={isDeleting}>
                  {isDeleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </ConfirmDeleteBtn>
              </ConfirmActions>
            </ConfirmCard>
          </ConfirmOverlay>
        )}

        {/* ── Header ─────────────────────────────────────────────────── */}
        <HeaderWrap>
          <HeaderRow>
            <TitleGroup>
              <TitleIcon>📁</TitleIcon>
              <Title>Αρχεία Υποέργου</Title>
            </TitleGroup>

            <HeaderActions>
              {canMutate && hasPhysicalFiles && (
                <>
                  {selectedFiles.size > 0 && (
                    <>
                      <MoveBtn onClick={handleMoveToGroup}>
                        📂 Μεταφορά ({selectedFiles.size})
                      </MoveBtn>
                      <BulkDeleteBtn onClick={requestBulkDelete} disabled={isDeleting}>
                        🗑 Διαγραφή ({selectedFiles.size})
                      </BulkDeleteBtn>
                    </>
                  )}
                  <PillBtn
                    $active={selectedFiles.size > 0}
                    onClick={selectedFiles.size > 0 ? handleDeselectAll : handleSelectAll}
                  >
                    {selectedFiles.size > 0 ? '✕ Αποεπιλογή' : '✓ Επιλογή Όλων'}
                  </PillBtn>
                </>
              )}
              <CloseBtn onClick={onClose} disabled={isDeleting || isUploading} title="Κλείσιμο">✕</CloseBtn>
            </HeaderActions>
          </HeaderRow>
          <HeaderDivider />
        </HeaderWrap>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <Body>
          {canUpload && (
            <UploadBar>
              <UploadBarLabel>Προσθήκη</UploadBarLabel>
              <UploadBtn
                type="button"
                $variant="ghost"
                data-testid="btn-add-files"
                onClick={onUploadFiles}
                disabled={isUploading}
              >
                {isUploading ? '⏳ Ανέβασμα…' : '+ Αρχεία'}
              </UploadBtn>
              <UploadBtn
                type="button"
                $variant="teal"
                data-testid="btn-add-folder"
                onClick={onUploadFolder}
                disabled={isUploading}
              >
                Φάκελος
              </UploadBtn>
            </UploadBar>
          )}
          {hasKhmdhsRegistry && (
            <KhmdhsDocumentRegistryPanel entries={khmdhsDocumentRegistry} />
          )}
          {hasKhmdhsRelated && (
            <KhmdhsDocumentRegistryPanel
              entries={khmdhsRelatedDocuments}
              headerTitle={KHMDHS_RELATED_DOCS_SECTION_TITLE}
            />
          )}
          {!hasFiles ? (
            <EmptyState>
              <EmptyIcon>📄</EmptyIcon>
              <EmptyText>
                {canUpload
                  ? 'Δεν υπάρχουν αρχεία. Χρησιμοποιήστε «+ Αρχεία» ή «Φάκελος».'
                  : 'Δεν υπάρχουν αρχεία για αυτό το υποέργο'}
              </EmptyText>
            </EmptyState>
          ) : hasPhysicalFiles ? (
            <FilesList data-testid="file-list">

              {/* File Groups */}
              {fileGroups.map((group) => (
                <GroupSection key={group.id} data-testid={`file-group-${group.id}`}>
                  <GroupHeader>
                    <GroupIcon>📁</GroupIcon>
                    <GroupLabel>{group.title}</GroupLabel>
                    <GroupCount>{group.files.length} αρχείο{group.files.length !== 1 ? '(α)' : ''}</GroupCount>
                  </GroupHeader>
                  {group.files.map((file, i) => {
                    const name = typeof file === 'string' ? file : (file.name || file.fileName || '');
                    return renderFileItem(name, `${group.id}-${i}`);
                  })}
                </GroupSection>
              ))}

              {/* Ungrouped files */}
              {files.length > 0 && (
                <GroupSection>
                  <UngroupedHeader $hasGroups={fileGroups.length > 0}>
                    <GroupIcon>📄</GroupIcon>
                    <GroupLabel>Αρχεία Χωρίς Ομαδοποίηση</GroupLabel>
                    <GroupCount>{files.length} αρχείο{files.length !== 1 ? '(α)' : ''}</GroupCount>
                  </UngroupedHeader>
                  {files.map((fileName, i) => renderFileItem(fileName, `ungrouped-${i}`, `file-ungrouped-${fileName}`))}
                </GroupSection>
              )}

            </FilesList>
          ) : null}
        </Body>

      </FileManagerContainer>
      {renameTarget && onRenameFile && (
        <FileRenameModal
          currentName={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSave={async (typed) => {
            try {
              const res = await onRenameFile(renameTarget, typed);
              if (res?.success) setRenameTarget(null);
            } catch {
              /* το μήνυμα εμφανίζεται από τον γονέα */
            }
          }}
        />
      )}
    </FileManagerOverlay>
  );
}

export default FileManager;
