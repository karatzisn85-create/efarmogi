import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const Modal = styled.div`
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 1000px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 2rem;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }
`;

const Content = styled.div`
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
`;

const FolderSection = styled.div`
  margin-bottom: 2rem;
`;

const FolderTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 10px;
  border-left: 4px solid #667eea;
`;

const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 1rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #667eea;
  }
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
`;

const FileIcon = styled.span`
  font-size: 1.5rem;
`;

const FileName = styled.span`
  font-weight: 500;
  color: #333;
`;

const FileActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;

  ${props => props.view && `
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    }
  `}

  ${props => props.download && `
    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    color: white;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    }
  `}

  ${props => props.delete && `
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
    }
  `}
`;

const EmptyFolder = styled.div`
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  font-style: italic;
  margin-left: 1rem;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  font-size: 1.1rem;
`;

function ProsklisisFileManager({ isOpen, onClose, prosklisiId, prosklisiTitle, userRole, onGroupFiles }) {
  const [files, setFiles] = useState({
    main: [],
    attachments: []
  });
  const [folders, setFolders] = useState({
    main: [],
    attachments: []
  });
  const [fileGroups, setFileGroups] = useState([]); // Νέα κατάσταση για ομάδες αρχείων
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && prosklisiId) {
      loadFiles();
    }
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
      } else {
        console.error('Error loading files:', result.error);
        setFiles({ main: [], attachments: [] });
        setFolders({ main: [], attachments: [] });
        setFileGroups([]);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles({ main: [], attachments: [] });
      setFolders({ main: [], attachments: [] });
      setFileGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = async (fileName, targetFolder) => {
    try {
      await ipcRenderer.invoke('view-prosklisi-file', prosklisiId, fileName, targetFolder);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα προβολής αρχείου: ' + error.message);
    }
  };

  const handleDownloadFile = async (fileName, targetFolder) => {
    try {
      const result = await ipcRenderer.invoke('download-prosklisi-file', prosklisiId, fileName, targetFolder);
      if (result.success) {
        alert('Το αρχείο αποθηκεύτηκε επιτυχώς!');
      } else {
        alert('Σφάλμα λήψης αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Σφάλμα λήψης αρχείου: ' + error.message);
    }
  };

  const handleDeleteFile = async (fileName, targetFolder) => {
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`)) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-file', prosklisiId, fileName, targetFolder);
        if (result.success) {
          await loadFiles(); // Reload files
        } else {
          alert('Σφάλμα διαγραφής αρχείου: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Σφάλμα διαγραφής αρχείου: ' + error.message);
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
        alert('Σφάλμα φόρτωσης περιεχομένων φακέλου: ' + result.error);
      }
    } catch (error) {
      console.error('Error loading folder contents:', error);
      alert('Σφάλμα φόρτωσης περιεχομένων φακέλου: ' + error.message);
    }
  };

  const handleViewFolderContents = async (folderName, targetFolder) => {
    try {
      const result = await ipcRenderer.invoke('get-folder-contents', prosklisiId, folderName, targetFolder);
      if (result.success) {
        // Show folder contents in a modal
        showFolderContentsModal(folderName, result.contents, targetFolder);
      } else {
        alert('Σφάλμα φόρτωσης περιεχομένων φακέλου: ' + result.error);
      }
    } catch (error) {
      console.error('Error viewing folder contents:', error);
      alert('Σφάλμα προβολής περιεχομένων φακέλου: ' + error.message);
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
              ${userRole === 'ADMIN' ? `<button onclick="window.deleteItemFromFolder('${item.name}', '${folderName}', '${targetFolder}', ${item.isDirectory})" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
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
        alert('Σφάλμα προβολής αρχείου: ' + error.message);
      }
    };

    window.downloadFileFromFolder = async (fileName, folderName, targetFolder) => {
      try {
        const result = await ipcRenderer.invoke('download-file-from-folder', prosklisiId, folderName, fileName, targetFolder);
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

    window.deleteFileFromFolder = async (fileName, folderName, targetFolder) => {
      if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`)) {
        try {
          const result = await ipcRenderer.invoke('delete-file-from-folder', prosklisiId, folderName, fileName, targetFolder);
          if (result.success) {
            // Remove the file from the modal
            const fileElement = document.querySelector(`[onclick*="${fileName}"]`).closest('div');
            if (fileElement) {
              fileElement.remove();
            }
            alert('Το αρχείο διαγράφηκε επιτυχώς!');
          } else {
            alert('Σφάλμα διαγραφής αρχείου: ' + result.error);
          }
        } catch (error) {
          console.error('Error deleting file:', error);
          alert('Σφάλμα διαγραφής αρχείου: ' + error.message);
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
          alert('Σφάλμα φόρτωσης περιεχομένων υποφακέλου: ' + result.error);
        }
      } catch (error) {
        console.error('Error loading subfolder contents:', error);
        alert('Σφάλμα φόρτωσης περιεχομένων υποφακέλου: ' + error.message);
      }
    };

    // Function to delete item (file or folder)
    window.deleteItemFromFolder = async (itemName, folderName, targetFolder, isDirectory) => {
      const itemType = isDirectory ? 'φάκελο' : 'αρχείο';
      if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το ${itemType} "${itemName}";`)) {
        try {
          const result = await ipcRenderer.invoke('delete-item-from-folder', prosklisiId, folderName, itemName, targetFolder, isDirectory);
          if (result.success) {
            // Remove the item from the modal
            const itemElement = document.querySelector(`[onclick*="${itemName}"]`).closest('div');
            if (itemElement) {
              itemElement.remove();
            }
            alert(`Το ${itemType} διαγράφηκε επιτυχώς!`);
          } else {
            alert(`Σφάλμα διαγραφής ${itemType}: ` + result.error);
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          alert(`Σφάλμα διαγραφής ${itemType}: ` + error.message);
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
              ${userRole === 'ADMIN' ? `<button onclick="window.deleteItemFromSubfolder('${item.name}', '${subfolderName}', '${parentFolderName}', '${targetFolder}', ${item.isDirectory})" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem;">
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
        alert('Σφάλμα ανοίγματος αρχείου: ' + error.message);
      }
    };

    window.downloadFileFromSubfolder = async (fileName, subfolderName, parentFolderName, targetFolder) => {
      try {
        const result = await ipcRenderer.invoke('download-file-from-subfolder', prosklisiId, parentFolderName, subfolderName, fileName, targetFolder);
        if (result.success) {
          alert('Το αρχείο λήφθηκε επιτυχώς!');
        } else if (result.error !== 'Download cancelled') {
          alert('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error);
        }
      } catch (error) {
        console.error('Error downloading file from subfolder:', error);
        alert('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message);
      }
    };

    window.deleteItemFromSubfolder = async (itemName, subfolderName, parentFolderName, targetFolder, isDirectory) => {
      const itemType = isDirectory ? 'φάκελο' : 'αρχείο';
      if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το ${itemType} "${itemName}";`)) {
        try {
          const result = await ipcRenderer.invoke('delete-item-from-subfolder', prosklisiId, parentFolderName, subfolderName, itemName, targetFolder, isDirectory);
          if (result.success) {
            // Remove the item from the modal
            const itemElement = document.querySelector(`[onclick*="${itemName}"]`).closest('div');
            if (itemElement) {
              itemElement.remove();
            }
            alert(`Το ${itemType} διαγράφηκε επιτυχώς!`);
          } else {
            alert(`Σφάλμα διαγραφής ${itemType}: ` + result.error);
          }
        } catch (error) {
          console.error('Error deleting item from subfolder:', error);
          alert(`Σφάλμα διαγραφής ${itemType}: ` + error.message);
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
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τον φάκελο "${folderName}" και όλα τα περιεχόμενά του;`)) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-folder', prosklisiId, folderName, targetFolder);
        if (result.success) {
          await loadFiles(); // Reload files and folders
        } else {
          alert('Σφάλμα διαγραφής φακέλου: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
        alert('Σφάλμα διαγραφής φακέλου: ' + error.message);
      }
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const group = fileGroups.find(g => g.id === groupId);
    if (group && window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε την ομάδα "${group.title}";`)) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi-group', prosklisiId, groupId);
        if (result.success) {
          await loadFiles(); // Reload files and groups
        } else {
          alert('Σφάλμα διαγραφής ομάδας: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('Σφάλμα διαγραφής ομάδας: ' + error.message);
      }
    }
  };

  const getFileIcon = (fileName) => {
    const extension = fileName && fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      default:
        return '📎';
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
                    {userRole === 'ADMIN' && (
                      <button
                        onClick={() => onGroupFiles && onGroupFiles(files.attachments.filter(file => !file.isGrouped))}
                        style={{
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.6rem 1.2rem',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontWeight: '500',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        📁 Ομαδοποίηση Αρχείων
                      </button>
                    )}
                  </div>
                  <FilesList>
                    {files.attachments.filter(file => !file.isGrouped).map((file, index) => (
                      <FileItem key={index}>
                        <FileInfo>
                          <FileIcon>{getFileIcon(file.originalName || file.fileName)}</FileIcon>
                          <FileName>{file.originalName || file.fileName}</FileName>
                        </FileInfo>
                        <FileActions>
                          <ActionButton view onClick={() => handleViewFile(file.fileName, 'attachments')}>
                            👁️ Προβολή
                          </ActionButton>
                          <ActionButton download onClick={() => handleDownloadFile(file.fileName, 'attachments')}>
                            📥 Λήψη
                          </ActionButton>
                          {userRole === 'ADMIN' && (
                            <ActionButton delete onClick={() => handleDeleteFile(file.fileName, 'attachments')}>
                              🗑️ Διαγραφή
                            </ActionButton>
                          )}
                        </FileActions>
                      </FileItem>
                    ))}
                  </FilesList>
                
                {/* Attachments Folders - Show directly under files */}
                {folders.attachments && folders.attachments.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    {folders.attachments.map((folder, index) => (
                      <FileItem key={`attachments-folder-${index}`} style={{ background: '#e8f5e8', borderColor: '#c3e6c3' }}>
                        <FileInfo>
                          <FileIcon>📁</FileIcon>
                          <FileName>{folder.originalName || folder.folderName}</FileName>
                        </FileInfo>
                        <FileActions>
                          <ActionButton view onClick={() => handleOpenFolder(folder.folderName, 'attachments')}>
                            📂 Άνοιγμα
                          </ActionButton>
                          {userRole === 'ADMIN' && (
                            <ActionButton delete onClick={() => handleDeleteFolder(folder.folderName, 'attachments')}>
                              🗑️ Διαγραφή
                            </ActionButton>
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
                      marginBottom: '1.5rem',
                      background: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      padding: '1rem'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '0.8rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid #dee2e6'
                      }}>
                        <h4 style={{ 
                          margin: 0, 
                          color: '#333', 
                          fontSize: '1.1rem',
                          fontWeight: '600'
                        }}>
                          📁 {group.title}
                        </h4>
                        {userRole === 'ADMIN' && (
                          <button
                            onClick={() => handleDeleteGroup(group.id || groupIndex)}
                            style={{
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            🗑️ Διαγραφή Ομάδας
                          </button>
                        )}
                      </div>
                      <FilesList>
                        {group.files && group.files.length > 0 ? (
                          group.files.map((file, fileIndex) => (
                            <FileItem key={fileIndex}>
                              <FileInfo>
                                <FileIcon>{getFileIcon(file.originalName || file.fileName)}</FileIcon>
                                <FileName>{file.originalName || file.fileName}</FileName>
                              </FileInfo>
                              <FileActions>
                                <ActionButton view onClick={() => handleViewFile(file.fileName, 'attachments')}>
                                  👁️ Προβολή
                                </ActionButton>
                                <ActionButton download onClick={() => handleDownloadFile(file.fileName, 'attachments')}>
                                  📥 Λήψη
                                </ActionButton>
                                {userRole === 'ADMIN' && (
                                  <ActionButton delete onClick={() => handleDeleteFile(file.fileName, 'attachments')}>
                                    🗑️ Διαγραφή
                                  </ActionButton>
                                )}
                              </FileActions>
                            </FileItem>
                          ))
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
