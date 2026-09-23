import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';
import FileRenameModal from './FileRenameModal';
import entaxiCatalog from '../../app/core/entaxiCatalog';
import { partitionEntaxiViewerFiles } from '../utils/entaxiFileObjects';
import { safeFileDialog } from '../utils/safeDialogs';

const ipcRenderer = window.electronAPI;

const C = {
  white: '#ffffff',
  indigo: '#6366f1',
  indigoLight: '#eef2ff',
  violet: '#8b5cf6',
  emerald: '#10b981',
  emeraldDark: '#065f46',
  red: '#ef4444',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate600: '#475569',
  slate800: '#1e293b'
};

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 2rem;
`;

const ModalContainer = styled.div`
  background: ${C.white};
  border-radius: 16px;
  max-width: 860px;
  width: 95%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.75rem;
  border-bottom: 2px solid ${C.slate200};
  background: linear-gradient(135deg, ${C.slate100} 0%, ${C.white} 100%);
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  color: ${C.slate800};
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: '';
    width: 4px;
    height: 1.2rem;
    border-radius: 3px;
    background: linear-gradient(180deg, ${C.indigo} 0%, ${C.violet} 100%);
    flex-shrink: 0;
  }
`;

const CloseBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate500};
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s, color 0.18s;

  &:hover {
    background: #fee2e2;
    color: ${C.red};
    border-color: #fecaca;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 1.75rem 1.75rem;
`;

const InfoBox = styled.div`
  background: ${C.slate100};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: ${C.slate600};
  line-height: 1.5;
`;

const InfoRow = styled.div`
  margin-bottom: 0.4rem;
  &:last-child { margin-bottom: 0; }
  strong { color: ${C.slate800}; font-weight: 600; }
`;

const FileSection = styled.div`
  margin-bottom: 1.75rem;
  &:last-child { margin-bottom: 0; }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid ${C.slate200};
`;

const SectionIcon = styled.span`
  font-size: 1rem;
`;

const SectionLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${C.slate600};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex: 1;
`;

const SectionCount = styled.span`
  font-size: 0.75rem;
  color: ${C.slate500};
  background: ${C.slate100};
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
`;

const AddFilesBtn = styled.button`
  padding: 0.28rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.35);
  background: ${C.indigoLight};
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #e0e7ff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

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

const FileIconBadge = styled.div`
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  background: ${(p) => p.$bg || C.indigo};
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

const NoFilesMessage = styled.div`
  text-align: center;
  color: ${C.slate500};
  font-style: italic;
  padding: 2rem;
  font-size: 0.9rem;
  background: ${C.slate100};
  border-radius: 10px;
  border: 1px dashed ${C.slate300};
`;

function getFileTypeStyle(fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return { label: 'PDF', bg: '#ef4444' };
    case 'doc': case 'docx': return { label: 'DOC', bg: '#2563eb' };
    case 'xls': case 'xlsx': return { label: 'XLS', bg: '#16a34a' };
    case 'png': case 'jpg': case 'jpeg': return { label: 'IMG', bg: '#8b5cf6' };
    default: return { label: ext.toUpperCase().slice(0, 3) || 'FILE', bg: '#64748b' };
  }
}

function EntaxisFileViewer({ isOpen, onClose, entaxi, userRole, onEntaxiUpdated, canManageFiles = false }) {
  const { showToast } = useToast();
  const canManageWorkflow = (userRole !== 'USER' && userRole !== 'ENGINEER') && canManageFiles;
  const [entaxiFiles, setEntaxiFiles] = useState([]);
  const [approvalFiles, setApprovalFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState(null);

  useEffect(() => {
    if (isOpen && entaxi) {
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entaxi]);

  const loadFiles = async (record) => {
    const source = record?.entaxiId ? record : entaxi;
    try {
      setLoading(true);
      const files = await ipcRenderer.invoke('get-entaxi-files', source.entaxiId);
      const partitioned = partitionEntaxiViewerFiles(files, source);
      setEntaxiFiles(partitioned.entaxiFiles);
      setApprovalFiles(partitioned.approvalFiles);
    } catch (error) {
      console.error('Error loading entaxi files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFile = async (fileName, typedName) => {
    if (!canManageWorkflow) return { success: false };
    const result = await ipcRenderer.invoke('rename-entaxi-file', {
      entaxiId: entaxi.entaxiId,
      oldName: fileName,
      newName: typedName,
    });
    if (!result?.success) {
      showToast(result?.error || 'Αποτυχία μετονομασίας', 'error');
      return result;
    }
    showToast('Το αρχείο μετονομάστηκε', 'success');
    if (result.entaxi) onEntaxiUpdated?.(result.entaxi);
    await loadFiles(result.entaxi);
    return result;
  };

  const handleViewFile = async (fileName) => {
    try {
      await ipcRenderer.invoke('view-entaxi-file', entaxi.entaxiId, fileName);
    } catch (error) {
      console.error('Error viewing file:', error);
      showToast('Σφάλμα κατά το άνοιγμα του αρχείου: ' + error.message, 'error');
    }
  };

  const handleDownloadFile = async (fileName) => {
    try {
      const result = await ipcRenderer.invoke('download-entaxi-file', entaxi.entaxiId, fileName);
      if (result.success) {
        showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
      } else {
        showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message, 'error');
    }
  };

  const handleAddApprovalFiles = async () => {
    if (!canManageWorkflow || !entaxi?.entaxiId) return;
    try {
      const result = await safeFileDialog('select-multiple-files', {
        title: 'Επιλογή αρχείων αποδοχής χρηματοδότησης',
        allFileTypes: true,
      });
      if (!result?.success || result.canceled || !result.files?.length) return;
      const upload = await ipcRenderer.invoke('add-entaxi-approval-files', {
        entaxiId: entaxi.entaxiId,
        files: result.files,
      });
      if (!upload?.success) {
        showToast(upload?.error || 'Δεν προστέθηκαν τα αρχεία.', 'error');
        return;
      }
      if (upload.entaxi) onEntaxiUpdated?.(upload.entaxi);
      showToast(
        upload.added?.length === 1
          ? 'Το αρχείο προστέθηκε στην αποδοχή χρηματοδότησης.'
          : `Προστέθηκαν ${upload.added.length} αρχεία στην αποδοχή χρηματοδότησης.`,
        'success'
      );
    } catch (error) {
      showToast('Σφάλμα κατά την προσθήκη αρχείων: ' + error.message, 'error');
    }
  };

  const handleDeleteFile = async (fileName) => {
    if (!canManageWorkflow) return;
    if (!await showConfirm({
      title: 'Διαγραφή Αρχείου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑'
    })) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-entaxi-file', entaxi.entaxiId, fileName);
      if (result.success) {
        showToast('Το αρχείο διαγράφηκε επιτυχώς!', 'success');
        if (result.entaxi) onEntaxiUpdated?.(result.entaxi);
        loadFiles();
      } else {
        showToast('Σφάλμα κατά τη διαγραφή του αρχείου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Σφάλμα κατά τη διαγραφή του αρχείου: ' + error.message, 'error');
    }
  };

  const renderFileRow = (fileName, index) => {
    const { label, bg } = getFileTypeStyle(fileName);
    return (
      <FileItem key={index}>
        <FileInfo>
          <FileIconBadge $bg={bg}>{label}</FileIconBadge>
          <FileName>{fileName}</FileName>
        </FileInfo>
        <FileActions>
          <ViewIconBtn title="Προβολή" onClick={() => handleViewFile(fileName)}>
            👁
          </ViewIconBtn>
          <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadFile(fileName)}>
            ⬇
          </DownloadIconBtn>
          {canManageWorkflow && (
            <RenameIconBtn
              title="Μετονομασία"
              data-testid={`file-rename-${fileName}`}
              onClick={() => setRenameTarget(fileName)}
            >
              ✎
            </RenameIconBtn>
          )}
          {canManageWorkflow && (
            <DeleteIconBtn
              title="Διαγραφή"
              data-testid={`file-delete-${fileName}`}
              onClick={() => handleDeleteFile(fileName)}
            >
              ✕
            </DeleteIconBtn>
          )}
        </FileActions>
      </FileItem>
    );
  };

  const renderSection = (files, title, icon, { onAdd, addTestId, sectionTestId } = {}) => (
    <FileSection data-testid={sectionTestId}>
      <SectionHeader>
        <SectionIcon>{icon}</SectionIcon>
        <SectionLabel>{title}</SectionLabel>
        <SectionCount>{files.length}</SectionCount>
        {onAdd ? (
          <AddFilesBtn type="button" data-testid={addTestId} onClick={onAdd}>
            Προσθήκη αρχείων
          </AddFilesBtn>
        ) : null}
      </SectionHeader>
      {files.length === 0 ? (
        <NoFilesMessage>Δεν υπάρχουν αρχεία για αυτή την κατηγορία</NoFilesMessage>
      ) : (
        <FileList>{files.map((f, i) => renderFileRow(f, i))}</FileList>
      )}
    </FileSection>
  );

  if (!isOpen) return null;

  return (
    <>
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer data-testid="ent-files-modal">
        <ModalHeader>
          <ModalTitle>Αρχεία Ένταξης</ModalTitle>
          <CloseBtn type="button" data-testid="ent-files-close" onClick={onClose}>✕</CloseBtn>
        </ModalHeader>

        <ModalBody>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: C.slate500 }}>
              Φόρτωση αρχείων...
            </div>
          ) : (
            <>
              {entaxi && (
                <InfoBox>
                  {entaxi.subject && (
                    <InfoRow><strong>Θέμα:</strong> {entaxi.subject}</InfoRow>
                  )}
                  {entaxiCatalog.formatEntaxiProjectTitles(entaxi) && (
                    <InfoRow><strong>Έργο:</strong> {entaxiCatalog.formatEntaxiProjectTitles(entaxi)}</InfoRow>
                  )}
                </InfoBox>
              )}

              {renderSection(entaxiFiles, 'Αρχεία Ένταξης', '📋', { sectionTestId: 'ent-files-decisions' })}
              {renderSection(approvalFiles, 'Αποδοχή χρηματοδότησης', '✅', canManageWorkflow
                ? { onAdd: handleAddApprovalFiles, addTestId: 'ent-files-approval-add', sectionTestId: 'ent-files-approval' }
                : { sectionTestId: 'ent-files-approval' })}
            </>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalOverlay>
    {renameTarget && (
      <FileRenameModal
        currentName={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={async (typed) => {
          try {
            const res = await handleRenameFile(renameTarget, typed);
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

export default EntaxisFileViewer;
