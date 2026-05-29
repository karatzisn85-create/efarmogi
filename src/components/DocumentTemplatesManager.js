import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { safeAlert } from '../utils/safeDialogs';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';
import { showConfirm } from '../utils/confirmModal';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;

const ManagerContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
`;

const ManagerContent = styled.div`
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 20px;
  width: 98%;
  max-width: 1800px;
  height: 95vh;
  max-height: 95vh;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%);
  color: white;
  padding: 22px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 20px 20px 0 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: -0.01em;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: rotate(90deg);
  }
`;

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Sidebar = styled.div`
  width: 280px;
  min-width: 280px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-right: 1px solid #e2e8f0;
  padding: 20px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c7d2fe;
    border-radius: 10px;
  }
`;

const MainContent = styled.div`
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  background: #f8fafc;
  
  &::-webkit-scrollbar {
    width: 10px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c7d2fe;
    border-radius: 10px;
  }
`;

const SidebarSection = styled.div`
  margin-bottom: 25px;
`;

const SectionTitle = styled.h3`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #94a3b8;
  margin-bottom: 12px;
`;

const CategoryContainer = styled.div`
  margin-bottom: 10px;
  border-radius: 12px;
  border: 1.5px solid ${p => p.$active ? '#818cf8' : '#e2e8f0'};
  background: ${p => p.$active ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' : 'white'};
  box-shadow: ${p => p.$active ? '0 4px 12px rgba(99,102,241,0.15)' : '0 1px 4px rgba(15,23,42,0.06)'};
  transition: all 0.2s ease;
  overflow: hidden;
`;

const CategoryMainButton = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px 0;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  text-align: left;
`;

const CategoryTitle = styled.span`
  flex: 1;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.45;
  letter-spacing: 0.01em;
`;

const CategoryCount = styled.span`
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: #e0e7ff;
  color: #4338ca;
  flex-shrink: 0;
`;

const CategoryTools = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px 14px;
  background: transparent;
`;

const CategoryToolButton = styled.button`
  border: none;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${props => props.danger ? '#fff' : '#4338ca'};
  background: ${props => props.danger ? '#ef4444' : '#e0e7ff'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.danger ? '#dc2626' : '#c7d2fe'};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const AddCategoryButton = styled.button`
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ColorPickerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
`;

const ColorPreview = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 2px solid rgba(15, 23, 42, 0.12);
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.15);
`;

const ColorInput = styled.input`
  border: none;
  background: transparent;
  width: 50px;
  height: 36px;
  cursor: pointer;
`;

const ModalHint = styled.p`
  font-size: 12px;
  color: #777;
  margin-top: -8px;
  margin-bottom: 24px;
`;

const ModalLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #444;
  margin-bottom: 8px;
`;

const SecondaryLinkButton = styled.button`
  border: none;
  background: none;
  color: #667eea;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  padding: 0;

  &:hover {
    color: #5567d6;
  }
`;

const ActionBar = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  align-items: center;
`;

const UploadButton = styled.button`
  padding: 9px 18px;
  background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    box-shadow: 0 4px 12px rgba(22,163,74,0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SearchBox = styled.input`
  flex: 1;
  padding: 9px 16px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.82rem;
  background: white;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DocumentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DocumentItem = styled.div`
  background: white;
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.06);
  transition: all 0.2s ease;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    box-shadow: 0 3px 10px rgba(15,23,42,0.1);
    border-color: #c7d2fe;
    transform: translateY(-1px);
  }
`;

const DocumentIcon = styled.div`
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 800;
  flex-shrink: 0;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DocumentInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DocumentName = styled.h4`
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  word-wrap: break-word;
  word-break: break-word;
  line-height: 1.4;
  letter-spacing: -0.01em;
`;

const DocumentMeta = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 1px;
`;

const DocumentActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`;

const IconActionBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid #e2e8f0;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  transition: all 0.15s;
  color: #64748b;

  &:hover { transform: scale(1.1); }
`;

const ViewBtn = styled(IconActionBtn)`
  &:hover { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
`;

const DownloadBtn = styled(IconActionBtn)`
  &:hover { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
`;

const RenameBtn = styled(IconActionBtn)`
  &:hover { background: #fffbeb; color: #d97706; border-color: #fde68a; }
`;

const CopyBtn = styled(IconActionBtn)`
  &:hover { background: #f0f9ff; color: #0284c7; border-color: #bae6fd; }
`;

const DeleteBtn = styled(IconActionBtn)`
  &:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 20px;
  color: #999;
`;

const EmptyIcon = styled.div`
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 10px;
`;

const EmptySubtext = styled.p`
  font-size: 14px;
  opacity: 0.7;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 28px;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalTitle = styled.h3`
  margin: 0 0 18px 0;
  font-size: 1.1rem;
  color: #1e293b;
  font-weight: 700;
`;

const ModalInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  margin-bottom: 18px;
  
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const ModalButton = styled.button`
  padding: 9px 20px;
  border: none;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.primary {
    background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
    color: white;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99,102,241,0.35);
    }
  }
  
  &.secondary {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover {
      background: #e2e8f0;
    }
  }
`;

const DEFAULT_CATEGORY_COLOR = '#5a6fd8';

const normalizeHexColor = (hex) => {
  if (!hex || typeof hex !== 'string') {
    return null;
  }
  let value = hex.trim();
  if (!value.startsWith('#')) {
    return null;
  }
  value = value.slice(1);
  if (value.length === 3) {
    value = value.split('').map(char => char + char).join('');
  }
  if (value.length !== 6) {
    return null;
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
};

const hexToRGBA = (hex, alpha = 1) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return `rgba(90, 111, 216, ${alpha})`;
  }
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ensureValidHexColor = (hex) => {
  const normalized = normalizeHexColor(hex);
  return normalized ? `#${normalized}` : DEFAULT_CATEGORY_COLOR;
};

const getCategoryBackground = (color, isActive) => hexToRGBA(color, isActive ? 0.22 : 0.12);
const getCategoryBorder = (color, isActive) => hexToRGBA(color, isActive ? 0.55 : 0.3);
const getCategoryShadow = (color, isActive) => hexToRGBA(color, isActive ? 0.35 : 0.18);
const getCountBackground = (color, isActive) => hexToRGBA(color, isActive ? 0.35 : 0.22);

function DocumentTemplatesManager({ onClose }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [copiedDocument, setCopiedDocument] = useState(null); // Για copy-paste
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [documentToRename, setDocumentToRename] = useState(null);
  const [renameDocumentName, setRenameDocumentName] = useState('');
  const renameInputRef = useRef(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [categoryToEditColor, setCategoryToEditColor] = useState(null);
  const [categoryColorValue, setCategoryColorValue] = useState(DEFAULT_CATEGORY_COLOR);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await ipcRenderer.invoke('load-document-templates');
      const loadedCategories = (data.categories || []).map(category => ({
        ...category,
        color: ensureValidHexColor(category.color)
      }));
      setCategories(loadedCategories);
      setDocuments(data.documents || []);
      // Set first category as selected if available and no category is selected
      setSelectedCategory(prev => {
        if (loadedCategories.length === 0) {
          return null;
        }

        if (prev && loadedCategories.some(cat => cat.id === prev)) {
          return prev;
        }

        return loadedCategories[0].id;
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading templates:', error);
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setNewCategoryName('');
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      safeAlert('Παρακαλώ εισάγετε όνομα κατηγορίας!');
      return;
    }

    try {
      const colorToUse = ensureValidHexColor(newCategoryColor);
      const result = await ipcRenderer.invoke('add-document-category', {
        name: newCategoryName.trim(),
        color: colorToUse
      });
      if (result.success && result.category) {
        setShowCategoryModal(false);
        setNewCategoryName('');
        setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
        await loadData();
        // Select the newly created category
        setSelectedCategory(result.category.id);
      }
    } catch (error) {
      console.error('Error adding category:', error);
      safeAlert('Σφάλμα κατά την προσθήκη κατηγορίας');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedCategory) {
      safeAlert('Παρακαλώ επιλέξτε μια κατηγορία πρώτα!');
      return;
    }

    try {
      setLoading(true);
      const result = await ipcRenderer.invoke('upload-document-template', selectedCategory);
      if (result.success) {
        if (result.count > 0) {
          await loadData();
          // Show success message with count
          if (result.count === 1) {
            safeAlert(`Επιτυχής ανέβασμα ${result.count} εγγράφου!`);
          } else {
            safeAlert(`Επιτυχής ανέβασμα ${result.count} εγγράφων!`);
          }
        }
      } else if (!result.canceled) {
        safeAlert('Σφάλμα κατά το ανέβασμα εγγράφων');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      safeAlert('Σφάλμα κατά το ανέβασμα εγγράφων');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId) => {
    try {
      await ipcRenderer.invoke('download-document-template', docId);
    } catch (error) {
      console.error('Error downloading document:', error);
      safeAlert('Σφάλμα κατά τη λήψη εγγράφου');
    }
  };

  const handleDelete = async (docId) => {
    if (!await showConfirm({ title: 'Διαγραφή Εγγράφου', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έγγραφο;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-document-template', docId);
      await loadData();
    } catch (error) {
      console.error('Error deleting document:', error);
      safeAlert('Σφάλμα κατά τη διαγραφή εγγράφου');
    }
  };

  const handleView = async (docId) => {
    try {
      await ipcRenderer.invoke('open-document-template', docId, false);
    } catch (error) {
      console.error('Error viewing document:', error);
      safeAlert('Σφάλμα κατά την προβολή εγγράφου');
    }
  };

  const getFileTypeBadge = (fileName) => {
    const ext = (fileName || '').toLowerCase().split('.').pop();
    if (['doc', 'docx'].includes(ext)) return { label: 'DOC', bg: '#2563eb' };
    if (['xls', 'xlsx'].includes(ext)) return { label: 'XLS', bg: '#16a34a' };
    if (ext === 'pdf') return { label: 'PDF', bg: '#dc2626' };
    if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', bg: '#ea580c' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { label: 'IMG', bg: '#7c3aed' };
    return { label: ext?.toUpperCase()?.slice(0,3) || 'FILE', bg: '#64748b' };
  };

  const handleCopy = (doc) => {
    setCopiedDocument(doc);
    safeAlert(`Το έγγραφο "${doc.name}" αντιγράφηκε! Επιλέξτε κατηγορία για επικόλληση.`);
  };

  const handlePaste = async (targetCategoryId) => {
    if (!copiedDocument) {
      safeAlert('Δεν υπάρχει αντιγραμμένο έγγραφο');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('copy-document-template', copiedDocument.id, targetCategoryId);
      
      if (result.success) {
        await loadData();
        // Επιλογή της κατηγορίας όπου έγινε το paste
        setSelectedCategory(targetCategoryId);
        safeAlert(`Το έγγραφο "${copiedDocument.name}" επικολλήθηκε επιτυχώς!`);
        // Μπορούμε να αφήσουμε το copiedDocument για να μπορεί να γίνει paste και σε άλλες κατηγορίες
      } else {
        safeAlert('Σφάλμα κατά την επικόλληση: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error pasting document:', error);
      safeAlert('Σφάλμα κατά την επικόλληση: ' + error.message);
    }
  };

  const handleOpenColorModal = (category) => {
    setCategoryToEditColor(category);
    setCategoryColorValue(ensureValidHexColor(category.color));
    setShowColorModal(true);
  };

  const handleCloseColorModal = () => {
    setShowColorModal(false);
    setCategoryToEditColor(null);
    setCategoryColorValue(DEFAULT_CATEGORY_COLOR);
  };

  const handleSaveCategoryColor = async () => {
    if (!categoryToEditColor) {
      return;
    }

    try {
      const colorToSave = ensureValidHexColor(categoryColorValue);
      const result = await ipcRenderer.invoke('update-document-category', categoryToEditColor.id, {
        color: colorToSave
      });

      if (result.success) {
        await loadData();
        handleCloseColorModal();
      } else {
        safeAlert('Σφάλμα κατά την ενημέρωση κατηγορίας: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error updating category color:', error);
      safeAlert('Σφάλμα κατά την ενημέρωση χρώματος κατηγορίας');
    }
  };

  const handleRequestDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const handleCloseDeleteCategoryModal = () => {
    setShowDeleteCategoryModal(false);
    setCategoryToDelete(null);
    scheduleDocumentInteractionRecovery();
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) {
      return;
    }

    try {
      setSelectedCategory(prev => (prev === categoryToDelete.id ? null : prev));
      const result = await ipcRenderer.invoke('delete-document-category', categoryToDelete.id);
      if (result.success) {
        await loadData();
        safeAlert(`Η κατηγορία "${categoryToDelete.name}" διαγράφηκε. Διαγράφηκαν ${result.removedDocuments || 0} συνημμένα αρχεία.`);
      } else {
        safeAlert('Σφάλμα κατά τη διαγραφή κατηγορίας: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      safeAlert('Σφάλμα κατά τη διαγραφή κατηγορίας');
    } finally {
      handleCloseDeleteCategoryModal();
    }
  };

  const handleRenameClick = (doc) => {
    scheduleDocumentInteractionRecovery();
    const lastDotIndex = doc.name.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? doc.name.substring(0, lastDotIndex) : doc.name;
    setDocumentToRename(doc);
    setRenameDocumentName(baseName);
    setShowRenameModal(true);
  };

  useEffect(() => {
    if (showRenameModal && renameInputRef.current) {
      const timer = setTimeout(() => {
        scheduleDocumentInteractionRecovery();
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showRenameModal, documentToRename?.id]);

  const handleCloseRenameModal = () => {
    setShowRenameModal(false);
    setDocumentToRename(null);
    setRenameDocumentName('');
    scheduleDocumentInteractionRecovery();
  };

  const handleSaveRename = async () => {
    if (!documentToRename) {
      return;
    }

    const trimmedName = renameDocumentName.trim();
    if (!trimmedName) {
      safeAlert('Παρακαλώ εισάγετε νέο όνομα εγγράφου.');
      return;
    }

    const lastDotIndex = documentToRename.name.lastIndexOf('.');
    const extension = lastDotIndex > -1 ? documentToRename.name.substring(lastDotIndex) : '';
    const finalName = `${trimmedName}${extension}`;

    try {
      const result = await ipcRenderer.invoke('rename-document-template', documentToRename.id, finalName);
      if (result.success) {
        await loadData();
        handleCloseRenameModal();
      } else {
        safeAlert('Σφάλμα κατά τη μετονομασία: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error renaming document:', error);
      safeAlert('Σφάλμα κατά τη μετονομασία εγγράφου');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory && doc.category === selectedCategory;
    const matchesSearch = !searchTerm.trim() || containsSearchTerm(doc.name, searchTerm);
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (categoryId) => {
    return documents.filter(doc => doc.category === categoryId).length;
  };

  const handleCloseManager = () => {
    scheduleDocumentInteractionRecovery();
    onClose();
  };

  useEffect(() => () => scheduleDocumentInteractionRecovery(), []);

  const renderOverlayModal = (open, onBackdropClose, content) => {
    if (!open || typeof document === 'undefined') return null;
    return createPortal(
      <Modal onClick={(e) => e.target === e.currentTarget && onBackdropClose()}>
        {content}
      </Modal>,
      document.body
    );
  };

  return (
    <ManagerContainer onClick={(e) => e.target === e.currentTarget && handleCloseManager()}>
      <ManagerContent>
        <Header>
          <Title>
            <span>📄</span>
            Υποδείγματα Εγγράφων
          </Title>
          <CloseButton onClick={handleCloseManager}>×</CloseButton>
        </Header>

        <ContentArea>
          <Sidebar>
            <SidebarSection>
              <SectionTitle>Κατηγορίες</SectionTitle>
              
              {categories.map(category => {
                const isActive = selectedCategory === category.id;
                const accentColor = ensureValidHexColor(category.color);
                return (
                  <CategoryContainer
                    key={category.id}
                    $active={isActive}
                    style={{
                      borderLeft: `5px solid ${accentColor}`,
                      borderColor: isActive ? accentColor : undefined,
                      background: isActive ? `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}08 100%)` : undefined,
                    }}
                  >
                    <CategoryMainButton onClick={() => setSelectedCategory(category.id)}>
                      <CategoryTitle>{category.name}</CategoryTitle>
                      <CategoryCount
                        style={{
                          background: getCountBackground(accentColor, isActive),
                          color: '#1f2d3d'
                        }}
                      >
                        {getCategoryCount(category.id)}
                      </CategoryCount>
                    </CategoryMainButton>
                    <CategoryTools>
                      {copiedDocument && (
                        <CategoryToolButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePaste(category.id);
                          }}
                          title="Επικόλληση εγγράφου"
                          style={{
                            background: getCategoryBackground(accentColor, true),
                            color: '#1f2d3d'
                          }}
                        >
                          📋 Επικόλληση
                        </CategoryToolButton>
                      )}
                      <DeleteBtn
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestDeleteCategory(category);
                        }}
                        title="Διαγραφή κατηγορίας"
                        style={{ width: 26, height: 26, fontSize: '0.72rem' }}
                      >✕</DeleteBtn>
                    </CategoryTools>
                  </CategoryContainer>
                );
              })}

              <AddCategoryButton onClick={handleAddCategory}>
                <span>➕</span>
                Νέα Κατηγορία
              </AddCategoryButton>
            </SidebarSection>
          </Sidebar>

          <MainContent>
            <ActionBar>
              <UploadButton onClick={handleUploadDocument}>
                <span>⬆️</span>
                Ανέβασμα Εγγράφου
              </UploadButton>
              <SearchBox
                type="text"
                placeholder="🔍 Αναζήτηση εγγράφων..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </ActionBar>

            {loading ? (
              <EmptyState>
                <EmptyIcon>⏳</EmptyIcon>
                <EmptyText>Φόρτωση...</EmptyText>
              </EmptyState>
            ) : filteredDocuments.length === 0 ? (
              <EmptyState>
                <EmptyIcon>📭</EmptyIcon>
                <EmptyText>Δεν βρέθηκαν έγγραφα</EmptyText>
                <EmptySubtext>
                  {selectedCategory 
                    ? 'Ανεβάστε έγγραφα σε αυτή την κατηγορία.'
                    : 'Επιλέξτε μια κατηγορία και ανεβάστε έγγραφα.'}
                </EmptySubtext>
              </EmptyState>
            ) : (
              <DocumentsList>
                {filteredDocuments.map(doc => {
                  const badge = getFileTypeBadge(doc.name);
                  return (
                    <DocumentItem key={doc.id}>
                      <DocumentIcon style={{ background: badge.bg }}>{badge.label}</DocumentIcon>
                      <DocumentInfo>
                        <DocumentName>{doc.name}</DocumentName>
                        <DocumentMeta>
                          {new Date(doc.uploadedAt).toLocaleDateString('el-GR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })}
                        </DocumentMeta>
                      </DocumentInfo>
                      <DocumentActions>
                        <ViewBtn title="Προβολή" onClick={() => handleView(doc.id)}>👁</ViewBtn>
                        <DownloadBtn title="Λήψη" onClick={() => handleDownload(doc.id)}>⬇</DownloadBtn>
                        <RenameBtn title="Μετονομασία" onClick={() => handleRenameClick(doc)}>✏</RenameBtn>
                        <CopyBtn
                          title="Αντιγραφή εγγράφου"
                          onClick={() => handleCopy(doc)}
                          style={copiedDocument?.id === doc.id ? { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' } : {}}
                        >📋</CopyBtn>
                        <DeleteBtn title="Διαγραφή" onClick={() => handleDelete(doc.id)}>✕</DeleteBtn>
                      </DocumentActions>
                    </DocumentItem>
                  );
                })}
              </DocumentsList>
            )}
          </MainContent>
        </ContentArea>
      </ManagerContent>

      {renderOverlayModal(showCategoryModal, () => {
        setShowCategoryModal(false);
        scheduleDocumentInteractionRecovery();
      }, (
          <ModalContent>
            <ModalTitle>➕ Νέα Κατηγορία</ModalTitle>
            <ModalInput
              type="text"
              placeholder="Όνομα κατηγορίας..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
              autoFocus
            />
            <ModalButtons>
              <ModalButton className="secondary" onClick={() => {
                setShowCategoryModal(false);
                scheduleDocumentInteractionRecovery();
              }}>
                Ακύρωση
              </ModalButton>
              <ModalButton className="primary" onClick={handleSaveCategory}>
                Αποθήκευση
              </ModalButton>
            </ModalButtons>
          </ModalContent>
      ))}

      {renderOverlayModal(showRenameModal, handleCloseRenameModal, (
          <ModalContent>
            <ModalTitle>✏️ Μετονομασία Εγγράφου</ModalTitle>
            {documentToRename && (
              <p style={{ fontSize: '13px', color: '#555', marginTop: '0', marginBottom: '10px' }}>
                Τρέχον όνομα: <strong>{documentToRename.name}</strong>
              </p>
            )}
            <ModalInput
              ref={renameInputRef}
              type="text"
              placeholder="Νέο όνομα εγγράφου (χωρίς κατάληξη)"
              value={renameDocumentName}
              onChange={(e) => setRenameDocumentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              autoFocus
            />
            {documentToRename && documentToRename.name.includes('.') && (
              <p style={{ fontSize: '12px', color: '#777', marginTop: '-10px', marginBottom: '20px' }}>
                Η κατάληξη <strong>{documentToRename.name.substring(documentToRename.name.lastIndexOf('.'))}</strong> θα διατηρηθεί αυτόματα.
              </p>
            )}
            <ModalButtons>
              <ModalButton className="secondary" onClick={handleCloseRenameModal}>
                Ακύρωση
              </ModalButton>
              <ModalButton className="primary" onClick={handleSaveRename}>
                Αποθήκευση
              </ModalButton>
            </ModalButtons>
          </ModalContent>
      ))}

      {renderOverlayModal(showDeleteCategoryModal, handleCloseDeleteCategoryModal, (
          <ModalContent>
            <ModalTitle>🗑️ Διαγραφή Κατηγορίας</ModalTitle>
            {categoryToDelete && (
              <>
                <p style={{ fontSize: '14px', color: '#444', marginTop: 0 }}>
                  Είστε σίγουροι ότι θέλετε να διαγράψετε την κατηγορία <strong>{categoryToDelete.name}</strong>;
                </p>
                <p style={{ fontSize: '13px', color: '#666' }}>
                  Η ενέργεια θα αφαιρέσει οριστικά {getCategoryCount(categoryToDelete.id)} έγγραφα που ανήκουν σε αυτήν την κατηγορία.
                </p>
              </>
            )}
            <ModalHint>Η διαγραφή δεν μπορεί να αναιρεθεί. Συνιστάται η λήψη αντιγράφου ασφαλείας πριν την ολοκλήρωση.</ModalHint>
            <ModalButtons>
              <ModalButton className="secondary" onClick={handleCloseDeleteCategoryModal}>
                Ακύρωση
              </ModalButton>
              <ModalButton
                onClick={handleConfirmDeleteCategory}
                style={{
                  background: '#ef5350',
                  color: '#fff'
                }}
              >
                Διαγραφή
              </ModalButton>
            </ModalButtons>
          </ModalContent>
      ))}
    </ManagerContainer>
  );
}

export default DocumentTemplatesManager;

