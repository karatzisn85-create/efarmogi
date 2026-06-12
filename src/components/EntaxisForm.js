import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { safeFileDialog } from '../utils/safeDialogs';
import { useToast } from './ToastProvider';

const ipcRenderer = window.electronAPI;

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  z-index: 10001;
  padding: 1.25rem 1rem 2rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: min(1400px, calc(100vw - 2rem));
  width: 100%;
  margin: auto 0;
  flex-shrink: 0;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
  border: 1px solid #e2e8f0;
  position: relative;
  overflow-x: clip;
  overflow-y: visible;
  box-sizing: border-box;
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
  min-width: 0;
`;

const FormTitle = styled.h2`
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;

  &::before {
    content: "📄";
    font-size: 1.3rem;
    flex-shrink: 0;
  }
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;

  &:hover {
    background: #c82333;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  width: 100%;
  min-width: 0;
`;

const TheForm = styled.form`
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;

  ${props => props.fullWidth && `
    grid-column: 1 / -1;
  `}
`;

const Label = styled.label`
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
`;

const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #2196f3;
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    border-color: #2196f3;
  }
`;

const Select = styled.select`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
  background: white;

  &:focus {
    border-color: #2196f3;
  }
`;


const FileSelectButton = styled.button`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #0056b3;
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.25rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
  min-width: 0;
  max-width: 100%;
`;

const Button = styled.button`
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  ${props => props.primary ? `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    
    &:hover {
      background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }
  ` : `
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #545b62;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
    }
  `}

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const MultiSelect = styled.div`
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.5rem;
  min-height: 100px;
  max-height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
  background: white;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(33, 150, 243, 0.1);
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

const FileList = styled.div`
  margin-top: 0.5rem;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  max-height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 100%;
  box-sizing: border-box;
`;

const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid #f1f3f4;
  
  &:last-child {
    border-bottom: none;
  }
`;

const FileName = styled.span`
  color: #28a745;
  font-size: 0.9rem;
  flex: 1;
`;

const RemoveFileButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #c82333;
  }
`;

const SearchableDropdownContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  z-index: 1;

  &:focus-within {
    z-index: 2;
  }
`;

const SearchInput = styled.input`
  box-sizing: border-box;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;

  &:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
`;

const DropdownList = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 220px;
  overflow-y: auto;
  z-index: 10050;
  margin: 0;
  padding: 0;
  list-style: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
`;

const DropdownItem = styled.li`
  padding: 0.8rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f3f4;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

function EntaxisForm({ isOpen, onClose, onSave, editingEntaxi }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    documentDate: '',
    fundingAuthority: '',
    initialAmount: '',
    subject: '',
    projectId: '',
    projectTitle: '',
    subprojectIds: [],
    prosklisiId: '', // New field for linking to prosklisi
    comments: '',
    entaxiPDFs: [], // Changed to array for multiple files
    approvalPDFs: [] // Changed to array for multiple files
  });

  const [projects, setProjects] = useState([]);
  const [subprojects, setSubprojects] = useState([]);
  const [proskliseis, setProskliseis] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_fileUpdateTrigger, setFileUpdateTrigger] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      loadProskliseis();
      if (editingEntaxi) {
        setFormData({
          documentDate: editingEntaxi.documentDate || '',
          fundingAuthority: editingEntaxi.fundingAuthority || '',
          initialAmount: editingEntaxi.initialAmount || '',
          subject: editingEntaxi.subject || '',
          projectId: editingEntaxi.projectId || '',
          projectTitle: editingEntaxi.projectTitle || '',
          subprojectIds: editingEntaxi.subprojectIds || [],
          prosklisiId: editingEntaxi.prosklisiId || '',
          comments: editingEntaxi.comments || '',
          entaxiPDFs: [], // Will be loaded from existing files
          approvalPDFs: [] // Will be loaded from existing files
        });
        setProjectSearchTerm(editingEntaxi.projectTitle || '');
        
        // Load existing files from the entaxi
        loadExistingFiles(editingEntaxi.entaxiId);
      } else {
        setFormData({
          documentDate: '',
          fundingAuthority: '',
          initialAmount: '',
          subject: '',
          projectId: '',
          projectTitle: '',
          subprojectIds: [],
          prosklisiId: '',
          comments: '',
          entaxiPDFs: [],
          approvalPDFs: []
        });
        setProjectSearchTerm('');
      }
      setErrors({});
    }
  }, [isOpen, editingEntaxi]);

  useEffect(() => {
    if (!formData.projectId) {
      setSubprojects([]);
      return;
    }
    const selectedProject = projects.find((p) => p.projectId === formData.projectId);
    if (selectedProject && Array.isArray(selectedProject.subprojects)) {
      setSubprojects(selectedProject.subprojects);
    } else {
      setSubprojects([]);
    }
  }, [formData.projectId, projects]);

  useEffect(() => {
    if (projectSearchTerm) {
      const term = projectSearchTerm.toLowerCase();
      const filtered = projects.filter((project) =>
        (project.projectTitle || '').toLowerCase().includes(term)
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(projects);
    }
  }, [projectSearchTerm, projects]);

  const loadProjects = async () => {
    try {
      const loadedProjects = await ipcRenderer.invoke('load-all-projects');
      // Group by project title
      const projectGroups = loadedProjects.reduce((groups, project) => {
        if (!groups[project.projectTitle]) {
          groups[project.projectTitle] = {
            projectTitle: project.projectTitle,
            projectId: project.projectId,
            subprojects: []
          };
        }
        groups[project.projectTitle].subprojects.push(project);
        return groups;
      }, {});
      
      setProjects(Object.values(projectGroups));
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadProskliseis = async () => {
    try {
      const loadedProskliseis = await ipcRenderer.invoke('load-all-proskliseis');
      setProskliseis(loadedProskliseis || []);
    } catch (error) {
      console.error('Error loading proskliseis:', error);
    }
  };

  const loadExistingFiles = async (entaxiId) => {
    try {
      console.log('🔄 Loading existing files for entaxi:', entaxiId);
      
      // Load the entaxi data from JSON to get file arrays
      const entaxiData = await ipcRenderer.invoke('load-entaxi-data', entaxiId);
      if (entaxiData) {
        console.log('📂 Loaded entaxi data:', entaxiData);
        
        // Convert file names to file objects for the form
        const entaxiFileObjects = (entaxiData.entaxiPDFs || []).map(fileName => ({
          fileName: fileName,
          originalName: fileName,
          isExisting: true // Mark as existing file
        }));
        
        const approvalFileObjects = (entaxiData.approvalPDFs || []).map(fileName => ({
          fileName: fileName,
          originalName: fileName,
          isExisting: true // Mark as existing file
        }));
        
        console.log('✅ Converted to file objects:', { entaxiFileObjects, approvalFileObjects });
        
        // Update the form data with existing files
        setFormData(prevData => ({
          ...prevData,
          entaxiPDFs: entaxiFileObjects,
          approvalPDFs: approvalFileObjects
        }));
      }
    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  };

  const formatAmountOnBlur = (value) => {
    if (!value) return '';

    let cleaned = value.replace(/[^\d,.]/g, '');
    if (!/\d/.test(cleaned)) return '';

    let integerPart = '';
    let decimalPart = '';

    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
        let parts = cleaned.split('.');
        integerPart = parts[0].replace(/,/g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      } else {
        let parts = cleaned.split(',');
        integerPart = parts[0].replace(/\./g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      }
    } else if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    } else if (cleaned.includes('.')) {
      let parts = cleaned.split('.');
      if (parts[0].length <= 3 && parts[1]) {
        integerPart = parts[0];
        decimalPart = parts[1].slice(0, 2);
      } else {
        integerPart = cleaned.replace(/\./g, '');
      }
    } else {
      integerPart = cleaned;
    }

    let formattedInteger = '';
    if (integerPart.length > 3) {
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          formattedInteger = '.' + formattedInteger;
        }
        formattedInteger = integerPart[i] + formattedInteger;
      }
    } else {
      formattedInteger = integerPart;
    }

    let result = formattedInteger;
    if (decimalPart) {
      result += ',' + decimalPart;
    }
    return result;
  };

  const handleInputChange = useCallback((field, value) => {
    // ΑΠΑΓΟΡΕΥΟΥΜΕ ΟΠΟΙΑΔΗΠΟΤΕ ΝORMALIZATION/TRIM ΚΑΤΑ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ
    // Το value περνάει ως έχει, χωρίς μετατροπές
    
    if (field === 'projectId' && value) {
      const selectedProject = projects.find(p => p.projectId === value);
      setFormData(prev => ({
        ...prev,
        [field]: value,
        projectTitle: selectedProject ? selectedProject.projectTitle : '',
        subprojectIds: [] // Reset subproject selection
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[field]) {
        return {
          ...prev,
          [field]: null
        };
      }
      return prev;
    });
  }, [projects]);

  const handleAmountBlur = (field, value) => {
    const formatted = formatAmountOnBlur(value);
    setFormData(prev => ({
      ...prev,
      [field]: formatted
    }));
  };

  const handleSubprojectChange = (subprojectId, checked) => {
    setFormData(prev => {
      const currentIds = prev.subprojectIds || [];
      if (checked) {
        return {
          ...prev,
          subprojectIds: [...currentIds, subprojectId]
        };
      } else {
        return {
          ...prev,
          subprojectIds: currentIds.filter(id => id !== subprojectId)
        };
      }
    });
  };


  const handleFileSelect = async (field, title) => {
    try {
      const result = await safeFileDialog('select-multiple-files', title);
      if (result.success && !result.canceled && result.files && result.files.length > 0) {
        console.log(`📁 Selected ${result.files.length} file(s) for ${field}`);
        
        // Create unique IDs for each file using timestamp, index, and random string
        const timestamp = Date.now();
        const newFiles = result.files.map((file, index) => ({
          fileName: file.fileName,
          filePath: file.filePath,
          tempId: `${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}_${field}` // More unique ID with field name
        }));
        
        console.log(`✅ Adding files to ${field}:`, newFiles.map(f => f.fileName));
        
        // Update state immediately using functional update to ensure we get the latest state
        setFormData(prev => {
          const currentFiles = prev[field] || [];
          const updated = {
            ...prev,
            [field]: [...currentFiles, ...newFiles]
          };
          console.log(`📊 Updated ${field} array: ${currentFiles.length} -> ${updated[field].length} files`);
          
          // Force a re-render by updating the trigger
          setTimeout(() => {
            setFileUpdateTrigger(prev => prev + 1);
          }, 0);
          
          return updated;
        });
      }
    } catch (error) {
      console.error('Error selecting files:', error);
      showToast('Σφάλμα κατά την επιλογή αρχείων: ' + error.message, 'error');
    }
  };

  const handleFileRemove = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleProjectSearch = (value) => {
    setProjectSearchTerm(value);
    setShowProjectDropdown(true);
    
    // If exact match, auto-select
    const exactMatch = projects.find((project) =>
      (project.projectTitle || '').toLowerCase() === value.toLowerCase()
    );
    if (exactMatch) {
      handleInputChange('projectId', exactMatch.projectId);
      handleInputChange('projectTitle', exactMatch.projectTitle);
    } else {
      // Clear selection if no exact match
      handleInputChange('projectId', '');
      handleInputChange('projectTitle', value);
    }
  };

  const handleProjectSelect = (project) => {
    setProjectSearchTerm(project.projectTitle);
    setShowProjectDropdown(false);
    handleInputChange('projectId', project.projectId);
    handleInputChange('projectTitle', project.projectTitle);
  };

  const handleInputFocus = () => {
    setShowProjectDropdown(true);
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow for clicks
    setTimeout(() => {
      setShowProjectDropdown(false);
    }, 200);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.documentDate) {
      newErrors.documentDate = 'Η ημερομηνία είναι υποχρεωτική';
    }

    if (!formData.fundingAuthority) {
      newErrors.fundingAuthority = 'Ο φορέας χρηματοδότησης είναι υποχρεωτικός';
    }

    if (!formData.initialAmount) {
      newErrors.initialAmount = 'Το ποσό είναι υποχρεωτικό';
    }

    if (!formData.subject) {
      newErrors.subject = 'Το θέμα είναι υποχρεωτικό';
    }

    if (!editingEntaxi && formData.entaxiPDFs.length === 0) {
      newErrors.entaxiPDFs = 'Τουλάχιστον ένα αρχείο ένταξης είναι υποχρεωτικό';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare entaxi data with file paths
      // Separate new files (with filePath) from existing files (without filePath)
      const newEntaxiFiles = (formData.entaxiPDFs || []).filter(file => file.filePath);
      const existingEntaxiFiles = (formData.entaxiPDFs || []).filter(file => file.isExisting);
      
      const newApprovalFiles = (formData.approvalPDFs || []).filter(file => file.filePath);
      const existingApprovalFiles = (formData.approvalPDFs || []).filter(file => file.isExisting);
      
      console.log('📂 File categorization for save:', {
        newEntaxiFiles: newEntaxiFiles.length,
        existingEntaxiFiles: existingEntaxiFiles.length,
        newApprovalFiles: newApprovalFiles.length,
        existingApprovalFiles: existingApprovalFiles.length
      });
      
      const entaxiData = {
        ...formData,
        entaxiId: editingEntaxi ? editingEntaxi.entaxiId : uuidv4(),
        createdAt: editingEntaxi ? editingEntaxi.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modifications: editingEntaxi ? editingEntaxi.modifications || [] : [],
        // Send only NEW files to be uploaded (with filePath)
        entaxiPDFs: newEntaxiFiles,
        approvalPDFs: newApprovalFiles,
        // Send existing files as file names list for preservation
        existingEntaxiFiles: existingEntaxiFiles.map(f => f.fileName),
        existingApprovalFiles: existingApprovalFiles.map(f => f.fileName),
        // Ensure prosklisiId is included
        prosklisiId: formData.prosklisiId || null
      };

      await onSave(entaxiData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <FormOverlay onClick={async (e) => {
      if (e.target === e.currentTarget) {
        // Ξεκλείδωμα της ένταξης πριν το κλείσιμο
        if (editingEntaxi && editingEntaxi.entaxiId) {
          await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
        }
        onClose();
      }
    }}>
      <FormContainer>
        <FormHeader>
          <FormTitle>
            {editingEntaxi ? 'Επεξεργασία Ένταξης' : 'Νέα Ένταξη Έργου'}
          </FormTitle>
          <CloseButton onClick={async () => {
            // Ξεκλείδωμα της ένταξης πριν το κλείσιμο
            if (editingEntaxi && editingEntaxi.entaxiId) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
            }
            onClose();
          }}>✕</CloseButton>
        </FormHeader>

        <TheForm onSubmit={handleSubmit}>
          <FormGrid>
            <FormGroup>
              <Label>Ημερομηνία Εγγράφου *</Label>
              <Input
                type="date"
                value={formData.documentDate}
                onChange={(e) => handleInputChange('documentDate', e.target.value)}
              />
              {errors.documentDate && <ErrorMessage>{errors.documentDate}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Φορέας Χρηματοδότησης *</Label>
              <Input
                type="text"
                value={formData.fundingAuthority}
                onChange={(e) => handleInputChange('fundingAuthority', e.target.value)}
                placeholder="π.χ. ΕΣΠΑ 2021-2027"
              />
              {errors.fundingAuthority && <ErrorMessage>{errors.fundingAuthority}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Ποσό Χρηματοδότησης * (€)</Label>
              <Input
                type="text"
                value={formData.initialAmount}
                onChange={(e) => handleInputChange('initialAmount', e.target.value)}
                onBlur={(e) => handleAmountBlur('initialAmount', e.target.value)}
                placeholder="π.χ. 150.000,00"
              />
              {errors.initialAmount && <ErrorMessage>{errors.initialAmount}</ErrorMessage>}
            </FormGroup>

            <FormGroup fullWidth>
              <Label>Θέμα Εγγράφου *</Label>
              <TextArea
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Ένταξη της Πράξης «...» με Κωδικό ΟΠΣ ... στο «...»"
                rows={4}
              />
              {errors.subject && <ErrorMessage>{errors.subject}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Συσχέτιση με Έργο (Προαιρετικό)</Label>
              <SearchableDropdownContainer>
                <SearchInput
                  type="text"
                  value={projectSearchTerm}
                  onChange={(e) => handleProjectSearch(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Αναζητήστε ή επιλέξτε έργο..."
                />
                {showProjectDropdown && filteredProjects.length > 0 && (
                  <DropdownList>
                    {filteredProjects.map(project => (
                      <DropdownItem 
                        key={project.projectId}
                        onClick={() => handleProjectSelect(project)}
                      >
                        {project.projectTitle}
                      </DropdownItem>
                    ))}
                  </DropdownList>
                )}
              </SearchableDropdownContainer>
            </FormGroup>

            {subprojects.length > 0 && (
              <FormGroup fullWidth>
                <Label>Συσχετισμένα Υποέργα (Προαιρετικό)</Label>
                <MultiSelect>
                  {subprojects.map(subproject => (
                    <CheckboxItem key={subproject.subprojectId}>
                      <Checkbox
                        type="checkbox"
                        checked={formData.subprojectIds.includes(subproject.subprojectId)}
                        onChange={(e) => handleSubprojectChange(subproject.subprojectId, e.target.checked)}
                      />
                      <span style={{ fontSize: '0.9rem' }}>
                        {subproject.subprojectTitle}
                      </span>
                    </CheckboxItem>
                  ))}
                </MultiSelect>
              </FormGroup>
            )}

            <FormGroup>
              <Label>Συσχέτιση με Πρόσκληση (Προαιρετικό)</Label>
              <Select
                value={formData.prosklisiId}
                onChange={(e) => handleInputChange('prosklisiId', e.target.value)}
              >
                <option value="">Επιλέξτε πρόσκληση...</option>
                {proskliseis.map(prosklisi => (
                  <option key={prosklisi.prosklisiId} value={prosklisi.prosklisiId}>
                    {prosklisi.title}
                  </option>
                ))}
              </Select>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                📢 Η συσχέτιση με πρόσκληση θα εμφανίσει κουμπί στις κάρτες των υποέργων
              </div>
            </FormGroup>

            <FormGroup>
              <Label>Αρχεία Ένταξης (PDF, Word) {!editingEntaxi && '*'}</Label>
              <FileSelectButton
                type="button"
                onClick={() => handleFileSelect('entaxiPDFs', 'Επιλογή Αρχείων Ένταξης (PDF, Word)')}
              >
                📁 Προσθήκη Αρχείων
              </FileSelectButton>
              {formData.entaxiPDFs.length > 0 && (
                <FileList>
                  {formData.entaxiPDFs.map((file, index) => {
                    const uniqueKey = file.tempId || file.fileName || `entaxi-${index}`;
                    return (
                      <FileItem key={uniqueKey}>
                        <FileName>📄 {file.fileName}</FileName>
                        <RemoveFileButton onClick={() => handleFileRemove('entaxiPDFs', index)}>
                          ✕
                        </RemoveFileButton>
                      </FileItem>
                    );
                  })}
                </FileList>
              )}
              {editingEntaxi && editingEntaxi.entaxiPDF && formData.entaxiPDFs.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.3rem' }}>
                  Τρέχον αρχείο: {editingEntaxi.entaxiPDF}
                </div>
              )}
              {errors.entaxiPDFs && <ErrorMessage>{errors.entaxiPDFs}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Αρχεία Αποδοχής Δ.Σ. (PDF, Word) (Προαιρετικό)</Label>
              <FileSelectButton
                type="button"
                onClick={() => handleFileSelect('approvalPDFs', 'Επιλογή Αρχείων Αποδοχής (PDF, Word)')}
              >
                📁 Προσθήκη Αρχείων
              </FileSelectButton>
              {/* Debug: Show file count immediately */}
              {formData.approvalPDFs.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#28a745', marginTop: '0.5rem', fontWeight: '600' }}>
                  ✅ {formData.approvalPDFs.length} αρχείο(α) επιλεγμένο(α)
                </div>
              )}
              {formData.approvalPDFs.length > 0 && (
                <FileList>
                  {formData.approvalPDFs.map((file, index) => {
                    const uniqueKey = file.tempId || file.fileName || `approval-${index}`;
                    return (
                      <FileItem key={uniqueKey}>
                        <FileName>📄 {file.fileName}</FileName>
                        <RemoveFileButton onClick={() => handleFileRemove('approvalPDFs', index)}>
                          ✕
                        </RemoveFileButton>
                      </FileItem>
                    );
                  })}
                </FileList>
              )}
              {editingEntaxi && editingEntaxi.approvalPDF && formData.approvalPDFs.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.3rem' }}>
                  Τρέχον αρχείο: {editingEntaxi.approvalPDF}
                </div>
              )}
            </FormGroup>

            <FormGroup fullWidth>
              <Label>Σχόλια/Παρατηρήσεις</Label>
              <TextArea
                value={formData.comments}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder="Επιπλέον πληροφορίες..."
                rows={3}
              />
            </FormGroup>
          </FormGrid>

          <ButtonContainer>
            <Button type="button" onClick={async () => {
              // Ξεκλείδωμα της ένταξης πριν το κλείσιμο
              if (editingEntaxi && editingEntaxi.entaxiId) {
                await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
              }
              onClose();
            }} disabled={loading}>
              Ακύρωση
            </Button>
            <Button type="submit" primary disabled={loading}>
              {loading ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </Button>
          </ButtonContainer>
        </TheForm>
      </FormContainer>
    </FormOverlay>,
    document.body
  );
}

export default EntaxisForm;
