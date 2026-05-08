import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const { ipcRenderer } = window.require('electron');

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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 25px 25px 0 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 15px;
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
  width: 320px;
  min-width: 320px;
  background: #f8f9fa;
  border-right: 2px solid #e0e0e0;
  padding: 24px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 10px;
  }
`;

const MainContent = styled.div`
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 10px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
  }
`;

const SidebarSection = styled.div`
  margin-bottom: 25px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-bottom: 15px;
`;

const CategoryContainer = styled.div`
  margin-bottom: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: white;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
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
  gap: 12px;
  padding: 16px 20px 0;
  cursor: pointer;
  font-family: 'Cambria', 'Georgia', serif;
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
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
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Cambria', 'Georgia', serif;
`;

const CategoryTools = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px 18px;
  background: transparent;
`;

const CategoryToolButton = styled.button`
  border: none;
  border-radius: 9px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Cambria', 'Georgia', serif;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${props => props.danger ? '#ffffff' : '#1f2d3d'};
  background: ${props => props.danger ? '#ef5350' : 'rgba(15, 23, 42, 0.08)'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.danger ? '#d84343' : 'rgba(15, 23, 42, 0.12)'};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const AddCategoryButton = styled.button`
  width: 100%;
  padding: 10px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0.9;

  &:hover {
    opacity: 1;
    background: #45a049;
  }

  &:active {
    transform: scale(0.98);
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
  padding: 10px 18px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.9;

  &:hover {
    opacity: 1;
    background: #5a6fd8;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const SearchBox = styled.input`
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.08);
  }
`;

const DocumentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DocumentItem = styled.div`
  background: white;
  border-radius: 8px;
  padding: 14px 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  border: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 14px;

  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    border-color: #d0d0d0;
    background: #fafafa;
  }
`;

const DocumentIcon = styled.div`
  width: 36px;
  height: 36px;
  min-width: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  opacity: 0.9;
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
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
  word-wrap: break-word;
  word-break: break-word;
  line-height: 1.5;
  letter-spacing: -0.01em;
`;

const DocumentMeta = styled.div`
  font-size: 11px;
  color: #888;
  margin-top: 2px;
`;

const DocumentActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  background: ${props => props.danger ? '#ff6b6b' : '#667eea'};
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  opacity: 0.85;

  &:hover {
    opacity: 1;
    background: ${props => props.danger ? '#ff5252' : '#5a6fd8'};
  }

  &:active {
    transform: scale(0.98);
  }
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
  padding: 30px;
  border-radius: 15px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
`;

const ModalInput = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const ModalButton = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  }
  
  &.secondary {
    background: #e0e0e0;
    color: #666;
    
    &:hover {
      background: #d0d0d0;
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
      alert('Παρακαλώ εισάγετε όνομα κατηγορίας!');
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
      alert('Σφάλμα κατά την προσθήκη κατηγορίας');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedCategory) {
      alert('Παρακαλώ επιλέξτε μια κατηγορία πρώτα!');
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
            alert(`Επιτυχής ανέβασμα ${result.count} εγγράφου!`);
          } else {
            alert(`Επιτυχής ανέβασμα ${result.count} εγγράφων!`);
          }
        }
      } else if (!result.canceled) {
        alert('Σφάλμα κατά το ανέβασμα εγγράφων');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Σφάλμα κατά το ανέβασμα εγγράφων');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId) => {
    try {
      await ipcRenderer.invoke('download-document-template', docId);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Σφάλμα κατά τη λήψη εγγράφου');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έγγραφο;')) {
      return;
    }

    try {
      await ipcRenderer.invoke('delete-document-template', docId);
      await loadData();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Σφάλμα κατά τη διαγραφή εγγράφου');
    }
  };

  const handleView = async (docId) => {
    try {
      await ipcRenderer.invoke('open-document-template', docId, false);
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Σφάλμα κατά την προβολή εγγράφου');
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (ext === 'pdf') return '📄';
    return '📄';
  };

  const handleCopy = (doc) => {
    setCopiedDocument(doc);
    alert(`Το έγγραφο "${doc.name}" αντιγράφηκε! Επιλέξτε κατηγορία για επικόλληση.`);
  };

  const handlePaste = async (targetCategoryId) => {
    if (!copiedDocument) {
      alert('Δεν υπάρχει αντιγραμμένο έγγραφο');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('copy-document-template', copiedDocument.id, targetCategoryId);
      
      if (result.success) {
        await loadData();
        // Επιλογή της κατηγορίας όπου έγινε το paste
        setSelectedCategory(targetCategoryId);
        alert(`Το έγγραφο "${copiedDocument.name}" επικολλήθηκε επιτυχώς!`);
        // Μπορούμε να αφήσουμε το copiedDocument για να μπορεί να γίνει paste και σε άλλες κατηγορίες
      } else {
        alert('Σφάλμα κατά την επικόλληση: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error pasting document:', error);
      alert('Σφάλμα κατά την επικόλληση: ' + error.message);
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
        alert('Σφάλμα κατά την ενημέρωση κατηγορίας: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error updating category color:', error);
      alert('Σφάλμα κατά την ενημέρωση χρώματος κατηγορίας');
    }
  };

  const handleRequestDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const handleCloseDeleteCategoryModal = () => {
    setShowDeleteCategoryModal(false);
    setCategoryToDelete(null);
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
        alert(`Η κατηγορία "${categoryToDelete.name}" διαγράφηκε. Διαγράφηκαν ${result.removedDocuments || 0} συνημμένα αρχεία.`);
      } else {
        alert('Σφάλμα κατά τη διαγραφή κατηγορίας: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Σφάλμα κατά τη διαγραφή κατηγορίας');
    } finally {
      handleCloseDeleteCategoryModal();
    }
  };

  const handleRenameClick = (doc) => {
    const lastDotIndex = doc.name.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? doc.name.substring(0, lastDotIndex) : doc.name;
    setDocumentToRename(doc);
    setRenameDocumentName(baseName);
    setShowRenameModal(true);
  };

  useEffect(() => {
    if (showRenameModal && renameInputRef.current) {
      // Keep focus stable in Electron modal flow after copy/paste actions.
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [showRenameModal, documentToRename?.id]);

  const handleCloseRenameModal = () => {
    setShowRenameModal(false);
    setDocumentToRename(null);
    setRenameDocumentName('');
  };

  const handleSaveRename = async () => {
    if (!documentToRename) {
      return;
    }

    const trimmedName = renameDocumentName.trim();
    if (!trimmedName) {
      alert('Παρακαλώ εισάγετε νέο όνομα εγγράφου.');
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
        alert('Σφάλμα κατά τη μετονομασία: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Σφάλμα κατά τη μετονομασία εγγράφου');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory && doc.category === selectedCategory;
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (categoryId) => {
    return documents.filter(doc => doc.category === categoryId).length;
  };

  return (
    <ManagerContainer onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ManagerContent>
        <Header>
          <Title>
            <span>📄</span>
            Υποδείγματα Εγγράφων
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
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
                    active={isActive}
                    style={{
                      borderLeft: `8px solid ${accentColor}`,
                      borderColor: getCategoryBorder(accentColor, isActive),
                      background: getCategoryBackground(accentColor, isActive),
                      boxShadow: `0 10px 24px ${getCategoryShadow(accentColor, isActive)}`
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
                      <CategoryToolButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenColorModal(category);
                        }}
                        title="Ορισμός χρώματος"
                      >
                        🎨 Χρώμα
                      </CategoryToolButton>
                      <CategoryToolButton
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestDeleteCategory(category);
                        }}
                        title="Διαγραφή κατηγορίας"
                      >
                        🗑️ Διαγραφή
                      </CategoryToolButton>
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
                {filteredDocuments.map(doc => (
                  <DocumentItem key={doc.id}>
                    <DocumentIcon>{getFileIcon(doc.name)}</DocumentIcon>
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
                      <ActionButton onClick={() => handleView(doc.id)}>
                        👁️ Προβολή
                      </ActionButton>
                      <ActionButton onClick={() => handleDownload(doc.id)}>
                        ⬇️ Λήψη
                      </ActionButton>
                      <ActionButton onClick={() => handleRenameClick(doc)}>
                        ✏️ Μετονομασία
                      </ActionButton>
                      <ActionButton 
                        onClick={() => handleCopy(doc)}
                        style={{ 
                          background: copiedDocument?.id === doc.id ? '#2ecc71' : '#17a2b8',
                          color: 'white'
                        }}
                        title="Αντιγραφή εγγράφου"
                      >
                        📋 Αντιγραφή
                      </ActionButton>
                      <ActionButton danger onClick={() => handleDelete(doc.id)}>
                        🗑️ Διαγραφή
                      </ActionButton>
                    </DocumentActions>
                  </DocumentItem>
                ))}
              </DocumentsList>
            )}
          </MainContent>
        </ContentArea>
      </ManagerContent>

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && setShowCategoryModal(false)}>
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
            <ModalLabel htmlFor="category-color-input">Χρώμα κατηγορίας</ModalLabel>
            <ColorPickerRow>
              <ColorPreview style={{ background: ensureValidHexColor(newCategoryColor) }} />
              <ColorInput
                id="category-color-input"
                type="color"
                value={ensureValidHexColor(newCategoryColor)}
                onChange={(e) => setNewCategoryColor(e.target.value)}
              />
              <SecondaryLinkButton type="button" onClick={() => setNewCategoryColor(DEFAULT_CATEGORY_COLOR)}>
                Επαναφορά
              </SecondaryLinkButton>
            </ColorPickerRow>
            <ModalHint>
              Το χρώμα χρησιμοποιείται για να ξεχωρίζει εύκολα η κατηγορία στη λίστα.
            </ModalHint>
            <ModalButtons>
              <ModalButton className="secondary" onClick={() => setShowCategoryModal(false)}>
                Ακύρωση
              </ModalButton>
              <ModalButton className="primary" onClick={handleSaveCategory}>
                Αποθήκευση
              </ModalButton>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}

      {/* Rename Document Modal */}
      {showRenameModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && handleCloseRenameModal()}>
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
        </Modal>
      )}

      {/* Category Color Modal */}
      {showColorModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && handleCloseColorModal()}>
          <ModalContent>
            <ModalTitle>🎨 Χρώμα Κατηγορίας</ModalTitle>
            {categoryToEditColor && (
              <p style={{ fontSize: '13px', color: '#555', marginTop: '0', marginBottom: '15px' }}>
                Κατηγορία: <strong>{categoryToEditColor.name}</strong>
              </p>
            )}
            <ModalLabel htmlFor="category-color-edit">Επιλέξτε χρώμα</ModalLabel>
            <ColorPickerRow>
              <ColorPreview style={{ background: ensureValidHexColor(categoryColorValue) }} />
              <ColorInput
                id="category-color-edit"
                type="color"
                value={ensureValidHexColor(categoryColorValue)}
                onChange={(e) => setCategoryColorValue(e.target.value)}
              />
              <SecondaryLinkButton type="button" onClick={() => setCategoryColorValue(DEFAULT_CATEGORY_COLOR)}>
                Επαναφορά
              </SecondaryLinkButton>
            </ColorPickerRow>
            <ModalHint>
              Το χρώμα χρησιμοποιείται για την ομαδοποίηση και την ευκολότερη αναγνώριση των κατηγοριών.
            </ModalHint>
            <ModalButtons>
              <ModalButton className="secondary" onClick={handleCloseColorModal}>
                Ακύρωση
              </ModalButton>
              <ModalButton className="primary" onClick={handleSaveCategoryColor}>
                Αποθήκευση
              </ModalButton>
            </ModalButtons>
          </ModalContent>
        </Modal>
      )}

      {/* Delete Category Modal */}
      {showDeleteCategoryModal && (
        <Modal onClick={(e) => e.target === e.currentTarget && handleCloseDeleteCategoryModal()}>
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
        </Modal>
      )}
    </ManagerContainer>
  );
}

export default DocumentTemplatesManager;

