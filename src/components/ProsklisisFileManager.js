import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { safeConfirm, safeFileDialog } from '../utils/safeDialogs';
import { useToast } from './ToastProvider';
import { showConfirm } from '../utils/confirmModal';
import KhmdhsDocumentRegistryPanel from './KhmdhsDocumentRegistryPanel';
import { collectProsklisiRegistryEntries } from '../utils/prosklisiDiavgeiaRegistry';

const ipcRenderer = window.electronAPI;

const C = {
  white: '#ffffff', indigo: '#6366f1', indigoLight: '#eef2ff',
  emeraldDark: '#065f46', red: '#ef4444',
  slate100: '#f1f5f9', slate200: '#e2e8f0', slate300: '#cbd5e1',
  slate500: '#64748b', slate600: '#475569', slate800: '#1e293b'
};

const Overlay = styled.div`
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

const Modal = styled.div`
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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.75rem;
  border-bottom: 2px solid ${C.slate200};
  background: linear-gradient(135deg, ${C.slate100} 0%, ${C.white} 100%);
  flex-shrink: 0;
`;

const Title = styled.h2`
  color: ${C.slate800};
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid ${C.slate300};
  background: ${C.white};
  color: ${C.slate500};
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s, color 0.18s;
  &:hover { background: #fee2e2; color: ${C.red}; border-color: #fecaca; }
`;

const Content = styled.div`
  padding: 1.25rem 1.75rem;
  overflow-y: auto;
  flex: 1;
`;

const FolderSection = styled.div`
  margin-bottom: 1.5rem;
`;

const FolderTitle = styled.h3`
  margin: 0 0 0.75rem 0;
  color: ${C.slate800};
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: ${C.slate100};
  border-radius: 10px;
  border-left: 4px solid ${C.indigo};
`;

const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  &:hover {
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    border-color: #c7d2fe;
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
  switch (ext) {
    case 'pdf': return { label: 'PDF', bg: '#ef4444' };
    case 'doc': case 'docx': return { label: 'DOC', bg: '#2563eb' };
    case 'xls': case 'xlsx': return { label: 'XLS', bg: '#16a34a' };
    case 'png': case 'jpg': case 'jpeg': return { label: 'IMG', bg: '#8b5cf6' };
    default: return { label: ext.toUpperCase().slice(0, 3) || 'FILE', bg: '#64748b' };
  }
}

const FileIconBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 28px;
  padding: 0 0.35rem;
  border-radius: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${C.white};
  background: ${(p) => p.$bg || C.slate500};
  flex-shrink: 0;
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
const FolderOpenBtn = styled(IconActionBtn)`
  &:hover { background: #fef3c7; color: #92400e; border-color: #fde68a; }
`;

const EmptyFolder = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: ${C.slate500};
  font-style: italic;
  font-size: 0.9rem;
  background: ${C.slate100};
  border-radius: 10px;
  border: 1px dashed ${C.slate300};
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: ${C.slate500};
  font-size: 1rem;
`;

const UploadBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-bottom: 1rem;
`;

const UploadButton = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.55rem 1rem;
  background: linear-gradient(135deg, ${C.indigo} 0%, #4f46e5 100%);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
  &:hover { filter: brightness(1.05); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const UploadFolderButton = styled(UploadButton)`
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 14px rgba(21, 128, 61, 0.35);
`;

function ProsklisisFileManager({ isOpen, onClose, prosklisiId, prosklisiTitle, userRole, onGroupFiles }) {
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
  const [registrySource, setRegistrySource] = useState({
    documentRegistry: [],
    diavgeiaMeta: null,
    diavgeiaAda: '',
    modifications: [],
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const registryEntries = useMemo(
    () => collectProsklisiRegistryEntries(registrySource),
    [registrySource]
  );

  useEffect(() => {
    if (isOpen && prosklisiId) {
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prosklisiId]);

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
        setRegistrySource({ documentRegistry: [], diavgeiaMeta: null, diavgeiaAda: '', modifications: [] });
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles({ main: [], attachments: [] });
      setFolders({ main: [], attachments: [] });
      setFileGroups([]);
      setRegistrySource({ documentRegistry: [], diavgeiaMeta: null, diavgeiaAda: '', modifications: [] });
    } finally {
      setLoading(false);
    }
  };

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
      setUploading(true);
      const uploadResult = await ipcRenderer.invoke('upload-prosklisi-files', {
        prosklisiId,
        files: pickedFiles,
        targetFolder: 'attachments',
      });
      if (uploadResult?.success) {
        showToast(
          uploadResult.addedCount === 1
            ? 'Το αρχείο προστέθηκε επιτυχώς'
            : `Προστέθηκαν ${uploadResult.addedCount} αρχεία`,
          'success'
        );
        await loadFiles();
      } else {
        showToast('Σφάλμα προσθήκης αρχείων: ' + (uploadResult?.error || 'Άγνωστο'), 'error');
      }
    } catch (error) {
      console.error('Error uploading prosklisi files:', error);
      showToast('Σφάλμα προσθήκης αρχείων: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
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

      setUploading(true);
      const uploadResult = await ipcRenderer.invoke('upload-prosklisi-files', {
        prosklisiId,
        files: pickedFiles,
        targetFolder: 'attachments',
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
    const group = fileGroups.find(g => g.id === groupId);
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


  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        <Header>
          <Title>📁 Αρχεία Πρόσκλησης: {prosklisiTitle}</Title>
          <CloseButton onClick={onClose}>✖</CloseButton>
        </Header>
        
        <Content>
          {loading ? (
            <LoadingMessage>Φόρτωση αρχείων...</LoadingMessage>
          ) : (
            <>
              {canManageWorkflow && (
                <UploadBar>
                  <UploadButton type="button" onClick={handleUploadFiles} disabled={uploading}>
                    {uploading ? '⏳ Προσθήκη…' : '📎 Προσθήκη Αρχείων'}
                  </UploadButton>
                  <UploadFolderButton type="button" onClick={handleUploadFolder} disabled={uploading}>
                    {uploading ? '⏳ Προσθήκη…' : '📁 Προσθήκη Φακέλου'}
                  </UploadFolderButton>
                </UploadBar>
              )}
              <KhmdhsDocumentRegistryPanel
                entries={registryEntries}
                headerTitle="Καταχωρήσεις Διαύγειας"
              />

              {/* Αφαίρεση του "Αρχεία Πρόσκλησης" section */}

              {/* Attachments Folder - Εμφανίζεται μόνο αν υπάρχουν μη ομαδοποιημένα αρχεία */}
              {files.attachments && files.attachments.filter(file => !file.isGrouped).length > 0 && (
                <FolderSection>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '1rem'
                  }}>
                    <FolderTitle>
                      📎 ΑΡΧΕΙΑ
                    </FolderTitle>
                    {canManageWorkflow && onGroupFiles && (
                      <button
                        onClick={() => onGroupFiles(files.attachments.filter(file => !file.isGrouped))}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                          color: '#f8fafc',
                          border: '1px solid #3730a3',
                          borderRadius: '8px',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em'
                        }}
                      >
                        📁 Ομαδοποίηση
                      </button>
                    )}
                  </div>
                  <FilesList>
                    {files.attachments.filter(file => !file.isGrouped).map((file, index) => {
                      const name = file.originalName || file.fileName;
                      const { label, bg } = getFileTypeStyle(name);
                      return (
                        <FileItem key={index}>
                          <FileInfo>
                            <FileIconBadge $bg={bg}>{label}</FileIconBadge>
                            <FileName>{name}</FileName>
                          </FileInfo>
                          <FileActions>
                            <ViewIconBtn title="Προβολή" onClick={() => handleViewFile(file.fileName, 'attachments')}>👁</ViewIconBtn>
                            <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadFile(file.fileName, 'attachments')}>⬇</DownloadIconBtn>
                            {canManageWorkflow && (
                              <DeleteIconBtn title="Διαγραφή" onClick={() => handleDeleteFile(file.fileName, 'attachments')}>✕</DeleteIconBtn>
                            )}
                          </FileActions>
                        </FileItem>
                      );
                    })}
                  </FilesList>
                
                {/* Attachments Folders - Show directly under files */}
                {folders.attachments && folders.attachments.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {folders.attachments.map((folder, index) => (
                      <FileItem key={`attachments-folder-${index}`} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <FileInfo>
                          <FileIconBadge $bg="#16a34a">DIR</FileIconBadge>
                          <FileName>{folder.originalName || folder.folderName}</FileName>
                        </FileInfo>
                        <FileActions>
                          <FolderOpenBtn title="Άνοιγμα" onClick={() => handleOpenFolder(folder.folderName, 'attachments')}>📂</FolderOpenBtn>
                          {canManageWorkflow && (
                            <DeleteIconBtn title="Διαγραφή" onClick={() => handleDeleteFolder(folder.folderName, 'attachments')}>✕</DeleteIconBtn>
                          )}
                        </FileActions>
                      </FileItem>
                    ))}
                  </div>
                )}
                </FolderSection>
              )}

              {/* File Groups */}
              {fileGroups && fileGroups.length > 0 && (
                <FolderSection>
                  <FolderTitle>
                    📁 Ομαδοποιημένα Αρχεία
                  </FolderTitle>
                  {fileGroups.map((group, groupIndex) => (
                    <div key={group.id || groupIndex} style={{ 
                      marginBottom: '1rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.75rem'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '0.55rem',
                        paddingBottom: '0.45rem',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{ 
                          margin: 0, 
                          color: '#1e293b', 
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          📁 {group.title}
                        </h4>
                        {canManageWorkflow && (
                          <DeleteIconBtn
                            title="Διαγραφή Ομάδας"
                            onClick={() => handleDeleteGroup(group.id || groupIndex)}
                          >✕</DeleteIconBtn>
                        )}
                      </div>
                      <FilesList>
                        {group.files && group.files.length > 0 ? (
                          group.files.map((file, fileIndex) => {
                            const name = file.originalName || file.fileName;
                            const { label, bg } = getFileTypeStyle(name);
                            return (
                              <FileItem key={fileIndex}>
                                <FileInfo>
                                  <FileIconBadge $bg={bg}>{label}</FileIconBadge>
                                  <FileName>{name}</FileName>
                                </FileInfo>
                                <FileActions>
                                  <ViewIconBtn title="Προβολή" onClick={() => handleViewFile(file.fileName, 'attachments')}>👁</ViewIconBtn>
                                  <DownloadIconBtn title="Λήψη" onClick={() => handleDownloadFile(file.fileName, 'attachments')}>⬇</DownloadIconBtn>
                                  {canManageWorkflow && (
                                    <DeleteIconBtn title="Διαγραφή" onClick={() => handleDeleteFile(file.fileName, 'attachments')}>✕</DeleteIconBtn>
                                  )}
                                </FileActions>
                              </FileItem>
                            );
                          })
                        ) : (
                          <EmptyFolder>Δεν υπάρχουν αρχεία σε αυτή την ομάδα</EmptyFolder>
                        )}
                      </FilesList>
                    </div>
                  ))}
                </FolderSection>
              )}
            </>
          )}
        </Content>
      </Modal>
    </Overlay>
  );
}

export default ProsklisisFileManager;
