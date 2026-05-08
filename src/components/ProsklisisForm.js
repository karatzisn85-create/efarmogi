import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import ProsklisiModificationForm from './ProsklisiModificationForm';

const { ipcRenderer } = window.require('electron');

// Styled Components
const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 15px;
  max-width: 1400px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
`;

const FormHeader = styled.div`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 2rem;
  border-radius: 15px 15px 0 0;
  text-align: center;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
`;

const FormContent = styled.div`
  padding: 2rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
`;

const Input = styled.input`
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1.1rem;
  min-height: 50px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    outline: none;
    border-color: #28a745;
    box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.25);
  }
`;

const TextArea = styled.textarea`
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const Select = styled.select`
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const FileSelectButton = styled.button`
  padding: 0.8rem 1.2rem;
  border: 2px dashed #dee2e6;
  border-radius: 6px;
  background: #f8f9fa;
  color: #6c757d;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover {
    border-color: #007bff;
    background: #e3f2fd;
    color: #007bff;
  }

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;


const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding-top: 2rem;
  border-top: 1px solid #e9ecef;
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
  }
`;

const ModificationButton = styled.button`
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

// Constants
const STATUS_OPTIONS = [
  'Υπό Ωρίμανση',
  'Υπό Υποβολή', 
  'Υποβληθέν ΤΔΠ'
];



function ProsklisisForm({ isOpen, onClose, onSave, onSaveModification, editingProsklisi = null }) {
  const [formData, setFormData] = useState({
    title: '',
    axis: '',
    fundingSource: '',
    code: '',
    deadline: '',
    budgetRange: '',
    status: 'Υπό Ωρίμανση',
    prosklisiFiles: [],
    fileGroups: [], // Νέα δομή για ομαδοποίηση αρχείων
    linkedProjects: [] // Συσχέτιση με έργα (array)
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    if (editingProsklisi) {
      setFormData({
        ...editingProsklisi,
        prosklisiFiles: [] // Don't show existing files in form
      });
    } else {
      setFormData({
        title: '',
        axis: '',
        fundingSource: '',
        code: '',
        deadline: '',
        budgetRange: '',
        status: 'Υπό Ωρίμανση',
        prosklisiFiles: [],
        fileGroups: [],
        linkedProjects: []
      });
    }
    setErrors({});
  }, [editingProsklisi, isOpen]);

  // Φόρτωση έργων
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Κλείσιμο dropdown όταν κάνει κλικ έξω
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProjectDropdown && !event.target.closest('[data-project-dropdown]')) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProjectDropdown]);

  const loadProjects = async () => {
    try {
      const result = await ipcRenderer.invoke('get-projects');
      if (result.success) {
        setProjects(result.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Φιλτράρισμα έργων βάσει αναζήτησης
  const filteredProjects = projects.filter(project => 
    project.title && project.title.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  // Επιλογή έργου
  const handleProjectSelect = (project) => {
    // Έλεγχος αν το έργο είναι ήδη επιλεγμένο
    const isAlreadySelected = formData.linkedProjects && formData.linkedProjects.some(p => p.id === project.id);
    
    if (!isAlreadySelected) {
      setFormData(prev => ({
        ...prev,
        linkedProjects: [...(prev.linkedProjects || []), project]
      }));
    }
    setProjectSearchTerm('');
    setShowProjectDropdown(false);
  };

  // Αφαίρεση έργου από τη συσχέτιση
  const handleRemoveProject = (projectId) => {
    setFormData(prev => ({
      ...prev,
      linkedProjects: (prev.linkedProjects || []).filter(p => p.id !== projectId)
    }));
  };

  // Καθαρισμός όλων των συσχετίσεων
  const handleClearAllProjectLinks = () => {
    setFormData(prev => ({
      ...prev,
      linkedProjects: []
    }));
    setProjectSearchTerm('');
  };


  const handleInputChange = useCallback((field, value) => {
    // ΑΠΑΓΟΡΕΥΟΥΜΕ ΟΠΟΙΑΔΗΠΟΤΕ ΝORMALIZATION/TRIM ΚΑΤΑ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ
    // Το value περνάει ως έχει, χωρίς μετατροπές
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[field]) {
        return {
          ...prev,
          [field]: ''
        };
      }
      return prev;
    });
  }, []);

  const handleFileSelect = async () => {
    try {
      const result = await ipcRenderer.invoke('select-file', 'Επιλογή Αρχείων Πρόσκλησης (PDF, Word)');
      
      if (result.success && result.files) {
        // Όλα τα αρχεία πηγαίνουν στο "Επισυναπτόμενα"
        const newFiles = result.files.map(file => ({
          filePath: file.filePath,
          fileName: file.fileName,
          targetFolder: 'attachments' // Πάντα στο Επισυναπτόμενα
        }));
        
        // Απλό modal για επιλογή ομαδοποίησης
        const groupingChoice = await showSimpleGroupingModal(newFiles.length, formData.fileGroups || []);
        
        if (groupingChoice !== null && groupingChoice !== false) {
          if (groupingChoice.action === 'new') {
            // Δημιουργία νέας ομάδας
            setFormData(prev => ({
              ...prev,
              fileGroups: [...(prev.fileGroups || []), {
                id: uuidv4(),
                title: groupingChoice.title,
                files: newFiles
              }]
            }));
          } else if (groupingChoice.action === 'existing') {
            // Προσθήκη σε υπάρχουσα ομάδα
            setFormData(prev => ({
              ...prev,
              fileGroups: (prev.fileGroups || []).map(group => 
                group.id === groupingChoice.groupId
                  ? { ...group, files: [...group.files, ...newFiles] }
                  : group
              )
            }));
          }
        } else {
          // Κανονική προσθήκη αρχείων χωρίς ομαδοποίηση
          setFormData(prev => ({
            ...prev,
            prosklisiFiles: [...(prev.prosklisiFiles || []), ...newFiles]
          }));
        }
      } else if (result.error) {
        alert('Σφάλμα επιλογής αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
      alert('Σφάλμα επιλογής αρχείων: ' + error.message);
    }
  };

  // Απλό modal για ομαδοποίηση αρχείων
  const showSimpleGroupingModal = (fileCount, existingGroups = []) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      `;

      // Δημιουργία επιλογών για υπάρχουσες ομάδες
      const existingGroupsOptions = existingGroups.length > 0 
        ? existingGroups.map(group => `<option value="${group.id}">${group.title}</option>`).join('')
        : '';

      modalContent.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
          📁 Ομαδοποίηση Αρχείων
        </h3>
        <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
          Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;
        </p>
        <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
          <button id="newGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">🆕 Νέα Ομάδα</button>
          ${existingGroups.length > 0 ? `
          <button id="existingGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📂 Προσθήκη σε Υπάρχουσα Ομάδα</button>
          ` : ''}
          <button id="noGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📄 Χωρίς Ομαδοποίηση</button>
        </div>
        <div id="newGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος νέας ομάδας:
          </label>
          <input 
            type="text" 
            id="newGroupTitle" 
            placeholder="π.χ. Οικονομικά, Τεχνικά, κλπ"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="confirmNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
        <div id="existingGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε υπάρχουσα ομάδα:
          </label>
          <select 
            id="existingGroupSelect" 
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          >
            <option value="">-- Επιλέξτε ομάδα --</option>
            ${existingGroupsOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="confirmExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Event listeners για τα κουμπιά
      const newGroupBtn = modalContent.querySelector('#newGroupBtn');
      const existingGroupBtn = modalContent.querySelector('#existingGroupBtn');
      const noGroupBtn = modalContent.querySelector('#noGroupBtn');
      
      const newGroupSection = modalContent.querySelector('#newGroupSection');
      const existingGroupSection = modalContent.querySelector('#existingGroupSection');
      
      const newGroupTitle = modalContent.querySelector('#newGroupTitle');
      const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
      
      const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
      const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
      const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
      const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');

      // Νέα ομάδα
      newGroupBtn.addEventListener('click', () => {
        newGroupBtn.style.display = 'none';
        if (existingGroupBtn) existingGroupBtn.style.display = 'none';
        noGroupBtn.style.display = 'none';
        newGroupSection.style.display = 'block';
        newGroupTitle.focus();
      });

      // Υπάρχουσα ομάδα
      if (existingGroupBtn) {
        existingGroupBtn.addEventListener('click', () => {
          newGroupBtn.style.display = 'none';
          existingGroupBtn.style.display = 'none';
          noGroupBtn.style.display = 'none';
          existingGroupSection.style.display = 'block';
        });
      }

      let handleKeyDown;
      const cleanup = (result) => {
        if (modal.parentNode === document.body) {
          document.body.removeChild(modal);
        }
        if (handleKeyDown) {
          document.removeEventListener('keydown', handleKeyDown);
        }
        resolve(result);
      };

      // Χωρίς ομαδοποίηση
      noGroupBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Επιβεβαίωση νέας ομάδας
      confirmNewBtn.addEventListener('click', () => {
        const title = newGroupTitle.value.trim();
        if (title) {
          cleanup({ action: 'new', title });
        } else {
          alert('Παρακαλώ εισάγετε τίτλο ομάδας');
        }
      });

      // Ακύρωση νέας ομάδας
      cancelNewBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Επιβεβαίωση υπάρχουσας ομάδας
      confirmExistingBtn.addEventListener('click', () => {
        const selectedGroupId = existingGroupSelect.value;
        if (selectedGroupId) {
          const selectedGroup = existingGroups.find(g => g.id === selectedGroupId);
          cleanup({ action: 'existing', groupId: selectedGroupId, groupTitle: selectedGroup.title });
        } else {
          alert('Παρακαλώ επιλέξτε ομάδα');
        }
      });

      // Ακύρωση υπάρχουσας ομάδας
      cancelExistingBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Κλείσιμο με ESC
      handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
    });
  };

  // Αφαίρεση της δυνατότητας ανεβάσματος φακέλων

  // Unused function removed - showFolderChoiceModal

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      prosklisiFiles: prev.prosklisiFiles.filter((_, i) => i !== index)
    }));
  };


  const removeFolder = (index) => {
    setFormData(prev => ({
      ...prev,
      prosklisiFolders: prev.prosklisiFolders.filter((_, i) => i !== index)
    }));
  };

  const renderFolderContents = (contents, level = 0) => {
    if (!contents || contents.length === 0) return null;
    
    return contents.map((item, index) => {
      const indent = '&nbsp;'.repeat(level * 2);
      const icon = item.type === 'folder' ? '📁' : '📄';
      const size = item.type === 'file' ? ` (${formatFileSize(item.size)})` : '';
      
      return (
        <div key={index} style={{ margin: '0.1rem 0', fontSize: '0.75rem' }}>
          <div dangerouslySetInnerHTML={{ __html: `${indent}${icon} ${item.name}${size}` }} />
          {item.type === 'folder' && item.contents && (
            <div style={{ marginLeft: '1rem' }}>
              {renderFolderContents(item.contents, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Ο τίτλος είναι υποχρεωτικός';
    }

    if (!formData.axis?.trim()) {
      newErrors.axis = 'Ο άξονας προτεραιότητας είναι υποχρεωτικός';
    }

    // All other fields are now optional - no validation required

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    
    try {
      const prosklisiData = {
        ...formData,
        prosklisiId: editingProsklisi ? editingProsklisi.prosklisiId : uuidv4(),
        createdAt: editingProsklisi ? editingProsklisi.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prosklisiFolders: formData.prosklisiFolders || []
      };

      await onSave(prosklisiData);
    } catch (error) {
      console.error('Error saving prosklisi:', error);
      alert('Σφάλμα αποθήκευσης: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleModificationSave = async (modificationData) => {
    try {
      if (onSaveModification) {
        await onSaveModification(modificationData);
      }
      setIsModificationFormOpen(false);
    } catch (error) {
      console.error('Error saving modification:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <FormOverlay onClick={async (e) => {
      if (e.target === e.currentTarget) {
        // Ξεκλείδωμα της πρόσκλησης πριν το κλείσιμο
        if (editingProsklisi && editingProsklisi.prosklisiId) {
          await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
        }
        onClose();
      }
    }}>
      <FormContainer>
        <FormHeader>
          <FormTitle>
            {editingProsklisi ? '✏️ Επεξεργασία Πρόσκλησης' : '✨ Νέα Πρόσκληση'}
          </FormTitle>
        </FormHeader>

        <FormContent>
          <form onSubmit={handleSubmit}>
            <FormGrid>
              <FormGroup>
                <Label>Τίτλος Πρόσκλησης *</Label>
                <TextArea
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Εισάγετε τον τίτλο της πρόσκλησης..."
                />
                {errors.title && <ErrorMessage>{errors.title}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Άξονας Προτεραιότητας / Δράση *</Label>
                <TextArea
                  value={formData.axis}
                  onChange={(e) => handleInputChange('axis', e.target.value)}
                  placeholder="Εισάγετε τον άξονα προτεραιότητας και δράση..."
                />
                {errors.axis && <ErrorMessage>{errors.axis}</ErrorMessage>}
              </FormGroup>

              <FormGroup fullWidth>
                <Label>Πηγή Χρηματοδότησης</Label>
                <TextArea
                  value={formData.fundingSource}
                  onChange={(e) => handleInputChange('fundingSource', e.target.value)}
                  placeholder="π.χ. ΕΣΠΑ, REACT EU, Πράσινο Ταμείο..."
                  rows={3}
                />
                {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός Πρόσκλησης & Α/Α ΟΠΣ</Label>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  placeholder="π.χ. ΠΔΕ-2025-001"
                />
                {errors.code && <ErrorMessage>{errors.code}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Ημερομηνία Λήξης Υποβολής</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                />
                {errors.deadline && <ErrorMessage>{errors.deadline}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Εύρος Προϋπολογισμού</Label>
                <Input
                  type="text"
                  value={formData.budgetRange}
                  onChange={(e) => handleInputChange('budgetRange', e.target.value)}
                  placeholder="π.χ. 50.000€ - 500.000€"
                />
                {errors.budgetRange && <ErrorMessage>{errors.budgetRange}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κατάσταση</Label>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
                {errors.status && <ErrorMessage>{errors.status}</ErrorMessage>}
              </FormGroup>

              <FormGroup fullWidth>
                <Label>Συσχέτιση με Έργα (Προαιρετικά)</Label>
                <div style={{ position: 'relative' }} data-project-dropdown>
                  <Input
                    type="text"
                    value={projectSearchTerm}
                    onChange={(e) => {
                      setProjectSearchTerm(e.target.value);
                      setShowProjectDropdown(true);
                    }}
                    onFocus={() => setShowProjectDropdown(true)}
                    placeholder="Πληκτρολογήστε μέρος του τίτλου έργου για αναζήτηση..."
                  />
                  {formData.linkedProjects && formData.linkedProjects.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllProjectLinks}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#dc3545'
                      }}
                      title="Καθαρισμός όλων των συσχετίσεων"
                    >
                      ×
                    </button>
                  )}
                  {showProjectDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {filteredProjects.length > 0 ? (
                        filteredProjects
                          .filter(project => !(formData.linkedProjects && formData.linkedProjects.some(p => p.id === project.id)))
                          .map(project => (
                            <div
                              key={project.id}
                              onClick={() => handleProjectSelect(project)}
                              style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f8f9fa'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                              {project.title}
                            </div>
                          ))
                      ) : (
                        <div style={{ padding: '10px 15px', color: '#6c757d' }}>
                          Δεν βρέθηκαν έργα
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formData.linkedProjects && formData.linkedProjects.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#e8f5e8',
                      border: '1px solid #c3e6c3',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      color: '#155724',
                      marginBottom: '8px'
                    }}>
                      ✓ Συσχετισμένα έργα ({formData.linkedProjects ? formData.linkedProjects.length : 0}):
                    </div>
                    {formData.linkedProjects && formData.linkedProjects.map(project => (
                      <div
                        key={project.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 12px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          fontSize: '0.9rem'
                        }}
                      >
                        <span>{project.title}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProject(project.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '0 4px'
                          }}
                          title="Αφαίρεση έργου"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormGroup>


              <FormGroup>
                <Label>Αρχεία Πρόσκλησης (PDF, Word)</Label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <FileSelectButton
                    type="button"
                    onClick={handleFileSelect}
                    style={{ flex: '1', minWidth: '200px' }}
                  >
                    📎 Επιλογή Αρχείων (PDF, DOC, DOCX)
                  </FileSelectButton>
                </div>
                
                {(formData.prosklisiFiles && formData.prosklisiFiles.length > 0) || (formData.prosklisiFolders && formData.prosklisiFolders.length > 0) ? (
                  <div style={{ marginTop: '1rem' }}>
                    {formData.prosklisiFiles && formData.prosklisiFiles.length > 0 && (
                      <>
                        <Label style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Επιλεγμένα Αρχεία:</Label>
                        {formData.prosklisiFiles.map((file, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem',
                        background: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{file.fileName.endsWith('.pdf') ? '📄' : '📝'}</span>
                          <span style={{ fontSize: '0.9rem' }}>{file.fileName}</span>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#666',
                            background: file.targetFolder === 'main' ? '#e3f2fd' : '#fce4ec',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px'
                          }}>
                            {file.targetFolder === 'main' ? 'Αρχεία Πρόσκλησης' : 'Επισυναπτόμενα'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
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
                          🗑️ Αφαίρεση
                        </button>
                      </div>
                    ))}
                      </>
                    )}
                    
                    {formData.prosklisiFolders && formData.prosklisiFolders.length > 0 && (
                      <>
                        <Label style={{ fontSize: '0.9rem', marginBottom: '0.5rem', marginTop: '1rem' }}>Επιλεγμένοι Φάκελοι:</Label>
                        {formData.prosklisiFolders.map((folder, index) => (
                          <div key={index} style={{
                            padding: '0.8rem',
                            background: '#e8f5e8',
                            border: '1px solid #c3e6c3',
                            borderRadius: '8px',
                            marginBottom: '0.8rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📁</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{folder.folderName}</span>
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  color: '#666',
                                  background: folder.targetFolder === 'main' ? '#e3f2fd' : '#fce4ec',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px'
                                }}>
                                  {folder.targetFolder === 'main' ? 'Αρχεία Πρόσκλησης' : 'Επισυναπτόμενα'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFolder(index)}
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
                                🗑️ Αφαίρεση
                              </button>
                            </div>
                            
                            {/* Folder contents preview */}
                            {folder.contents && folder.contents.length > 0 && (
                              <div style={{
                                background: '#f8f9fa',
                                border: '1px solid #e9ecef',
                                borderRadius: '6px',
                                padding: '0.5rem',
                                fontSize: '0.8rem',
                                color: '#495057',
                                maxHeight: '120px',
                                overflowY: 'auto'
                              }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', color: '#6c757d' }}>
                                  Περιεχόμενα ({folder.contents.length} αντικείμενα):
                                </div>
                                {renderFolderContents(folder.contents)}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : null}
              </FormGroup>
            </FormGrid>

            <ButtonGroup>
              {editingProsklisi && (
                <ModificationButton 
                  type="button" 
                  onClick={() => setIsModificationFormOpen(true)}
                >
                  ⚡ Τροποποίηση
                </ModificationButton>
              )}
              <SaveButton type="submit" disabled={saving}>
                {saving ? '⏳ Αποθήκευση...' : '💾 Αποθήκευση'}
              </SaveButton>
              <CancelButton type="button" onClick={async () => {
                // Ξεκλείδωμα της πρόσκλησης πριν το κλείσιμο
                if (editingProsklisi && editingProsklisi.prosklisiId) {
                  await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
                }
                onClose();
              }}>
                ✖ Ακύρωση
              </CancelButton>
            </ButtonGroup>
          </form>
        </FormContent>
      </FormContainer>
      
      <ProsklisiModificationForm
        isOpen={isModificationFormOpen}
        onClose={() => setIsModificationFormOpen(false)}
        onSave={handleModificationSave}
        originalProsklisi={editingProsklisi}
      />
    </FormOverlay>
  );
}

export default ProsklisisForm;
