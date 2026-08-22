import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { safeFileDialog } from '../utils/safeDialogs';
import { useToast } from './ToastProvider';
import entaxiCatalog from '../../app/core/entaxiCatalog';

const ipcRenderer = window.electronAPI;

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.78) 0%, rgba(49, 46, 129, 0.55) 45%, rgba(15, 23, 42, 0.72) 100%);
  backdrop-filter: blur(4px);
  z-index: 10001;
  padding: 1.5rem 1rem 2rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const FormContainer = styled.div`
  background: #ffffff;
  border-radius: 18px;
  max-width: min(920px, calc(100vw - 2rem));
  width: 100%;
  margin: auto 0;
  flex-shrink: 0;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 24px 48px rgba(30, 27, 75, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  border: 1px solid #e2e8f0;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
`;

const FormHero = styled.div`
  padding: 1.35rem 1.65rem 1.4rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 42%, #4338ca 100%);
  color: #fff;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 70% at 85% 0%, rgba(255, 255, 255, 0.22), transparent 55%);
    pointer-events: none;
  }
`;

const HeroText = styled.div`
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
`;

const HeroEyebrow = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.88;
  margin-bottom: 0.35rem;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.42rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: #fff;
`;

const HeroSubtitle = styled.p`
  margin: 0.45rem 0 0;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.45;
  opacity: 0.92;
  max-width: 40rem;
`;

const CloseButton = styled.button`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  padding: 0.45rem 0.85rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.24);
    border-color: rgba(255, 255, 255, 0.4);
  }
`;

const FormBody = styled.div`
  padding: 1.35rem 1.65rem 1.65rem;
  background: linear-gradient(180deg, #fafbff 0%, #ffffff 28%);
`;

const TheForm = styled.form`
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
`;

const Section = styled.section`
  margin-bottom: 1.35rem;

  &:last-of-type {
    margin-bottom: 0.85rem;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid #eef2ff;
`;

const SectionTitle = styled.span`
  font-size: 0.82rem;
  font-weight: 800;
  color: #312e81;
  letter-spacing: 0.03em;
`;

const SectionHint = styled.span`
  font-size: 0.76rem;
  font-weight: 600;
  color: #94a3b8;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.15rem;
  width: 100%;
  min-width: 0;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  max-width: 100%;

  ${(props) =>
    props.fullWidth &&
    `
    grid-column: 1 / -1;
  `}
`;

const Label = styled.label`
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
`;

const RequiredMark = styled.span`
  color: #dc2626;
  margin-left: 0.15rem;
`;

const FieldHint = styled.div`
  font-size: 0.76rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.4;
  margin-top: 0.15rem;
`;

const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  font-family: inherit;
  min-height: 46px;
  background: #fff;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }

  &:disabled {
    background-color: #f8fafc;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.68rem 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  resize: vertical;
  min-height: 110px;
  font-family: inherit;
  line-height: 1.52;
  background: #fff;
  color: #0f172a;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const Select = styled.select`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  font-family: inherit;
  min-height: 46px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  background: #fff;
  color: #334155;
  cursor: pointer;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const FileZone = styled.div`
  border: 1px dashed #c7d2fe;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.65) 0%, #ffffff 100%);
  min-width: 0;
`;

const FileSelectButton = styled.button`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.7rem 1rem;
  background: #fff;
  color: #3730a3;
  border: 1.5px dashed #a5b4fc;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: #eef2ff;
    border-color: #818cf8;
    color: #312e81;
  }
`;

const ErrorMessage = styled.div`
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 0.15rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 0.65rem;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-top: 1.15rem;
  margin-top: 0.35rem;
  border-top: 1px solid #e2e8f0;
  min-width: 0;
  max-width: 100%;
`;

const Button = styled.button`
  padding: 0.58rem 1.35rem;
  border-radius: 11px;
  font-size: 0.93rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  min-height: 46px;
  border: none;
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

  ${(props) =>
    props.primary
      ? `
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);

    &:hover:not(:disabled) {
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.42);
    }
  `
      : `
    background: #fff;
    color: #475569;
    border: 1px solid #e2e8f0;

    &:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  `}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const MultiSelect = styled.div`
  border: 1px solid #e8eef7;
  border-radius: 12px;
  padding: 0.45rem 0.55rem;
  min-height: 90px;
  max-height: 160px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.35;

  &:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
  }
`;

const Checkbox = styled.input`
  width: 17px;
  height: 17px;
  cursor: pointer;
  accent-color: #4f46e5;
  flex-shrink: 0;
`;

const FileList = styled.div`
  margin-top: 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  max-height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 100%;
  box-sizing: border-box;
  background: #fff;
`;

const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
`;

const FileName = styled.span`
  color: #334155;
  font-size: 0.86rem;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileCountBadge = styled.div`
  margin-top: 0.5rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: #15803d;
`;

const ExistingFileNote = styled.div`
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 0.35rem;
  font-weight: 500;
`;

const RemoveFileButton = styled.button`
  background: #fff;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s ease;

  &:hover {
    background: #fef2f2;
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

const SearchInput = styled(Input)``;

const DropdownList = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  max-height: 220px;
  overflow-y: auto;
  z-index: 10050;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
`;

const DropdownItem = styled.li`
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  border-radius: 8px;
  color: #334155;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.12s ease;

  &:hover {
    background-color: #eef2ff;
    color: #312e81;
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
    const newErrors = entaxiCatalog.collectEntaxiRequiredErrors(formData, {
      isNew: !editingEntaxi,
    });
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

  const handleDismiss = async () => {
    if (editingEntaxi && editingEntaxi.entaxiId) {
      await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
    }
    onClose();
  };

  return createPortal(
    <FormOverlay
      onClick={async (e) => {
        if (e.target === e.currentTarget) {
          await handleDismiss();
        }
      }}
    >
      <FormContainer>
        <FormHero>
          <HeroText>
            <HeroEyebrow>Εντάξεις έργων</HeroEyebrow>
            <FormTitle>
              {editingEntaxi ? 'Επεξεργασία ένταξης' : 'Νέα ένταξη έργου'}
            </FormTitle>
            <HeroSubtitle>
              {editingEntaxi
                ? 'Ενημερώστε τα στοιχεία της ένταξης, τις συσχετίσεις και τα συνοδευτικά αρχεία.'
                : 'Καταχωρίστε τα βασικά στοιχεία της ένταξης και συνδέστε την με έργο ή πρόσκληση αν χρειάζεται.'}
            </HeroSubtitle>
          </HeroText>
          <CloseButton type="button" onClick={handleDismiss}>
            Κλείσιμο
          </CloseButton>
        </FormHero>

        <FormBody>
          <TheForm onSubmit={handleSubmit}>
            <Section>
              <SectionHead>
                <SectionTitle>Βασικά στοιχεία</SectionTitle>
                <SectionHint>Υποχρεωτικά πεδία με αστερίσκο</SectionHint>
              </SectionHead>
              <FormGrid>
                <FormGroup>
                  <Label>
                    Ημερομηνία εγγράφου
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    type="date"
                    value={formData.documentDate}
                    onChange={(e) => handleInputChange('documentDate', e.target.value)}
                  />
                  {errors.documentDate && <ErrorMessage>{errors.documentDate}</ErrorMessage>}
                </FormGroup>

                <FormGroup>
                  <Label>
                    Ποσό χρηματοδότησης (€)
                    <RequiredMark>*</RequiredMark>
                  </Label>
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
                  <Label>
                    Φορέας χρηματοδότησης
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    type="text"
                    value={formData.fundingAuthority}
                    onChange={(e) => handleInputChange('fundingAuthority', e.target.value)}
                    placeholder="π.χ. ΕΣΠΑ 2021-2027"
                  />
                  {errors.fundingAuthority && <ErrorMessage>{errors.fundingAuthority}</ErrorMessage>}
                </FormGroup>

                <FormGroup fullWidth>
                  <Label>
                    Θέμα εγγράφου
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <TextArea
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    placeholder="Ένταξη της Πράξης «...» με Κωδικό ΟΠΣ ... στο «...»"
                    rows={4}
                  />
                  {errors.subject && <ErrorMessage>{errors.subject}</ErrorMessage>}
                </FormGroup>
              </FormGrid>
            </Section>

            <Section>
              <SectionHead>
                <SectionTitle>Συσχετίσεις</SectionTitle>
                <SectionHint>Προαιρετικά</SectionHint>
              </SectionHead>
              <FormGrid>
                <FormGroup>
                  <Label>Συσχέτιση με έργο</Label>
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
                        {filteredProjects.map((project) => (
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

                <FormGroup>
                  <Label>Συσχέτιση με πρόσκληση</Label>
                  <Select
                    value={formData.prosklisiId}
                    onChange={(e) => handleInputChange('prosklisiId', e.target.value)}
                  >
                    <option value="">Επιλέξτε πρόσκληση...</option>
                    {proskliseis.map((prosklisi) => (
                      <option key={prosklisi.prosklisiId} value={prosklisi.prosklisiId}>
                        {prosklisi.title}
                      </option>
                    ))}
                  </Select>
                  <FieldHint>
                    Η σύνδεση με πρόσκληση εμφανίζει σχετικό κουμπί στις κάρτες των υποέργων.
                  </FieldHint>
                </FormGroup>

                {subprojects.length > 0 && (
                  <FormGroup fullWidth>
                    <Label>Συσχετισμένα υποέργα</Label>
                    <MultiSelect>
                      {subprojects.map((subproject) => (
                        <CheckboxItem key={subproject.subprojectId}>
                          <Checkbox
                            type="checkbox"
                            checked={formData.subprojectIds.includes(subproject.subprojectId)}
                            onChange={(e) =>
                              handleSubprojectChange(subproject.subprojectId, e.target.checked)
                            }
                          />
                          <span>{subproject.subprojectTitle}</span>
                        </CheckboxItem>
                      ))}
                    </MultiSelect>
                  </FormGroup>
                )}
              </FormGrid>
            </Section>

            <Section>
              <SectionHead>
                <SectionTitle>Αρχεία</SectionTitle>
                <SectionHint>PDF ή Word</SectionHint>
              </SectionHead>
              <FormGrid>
                <FormGroup>
                  <Label>
                    Αρχεία ένταξης
                    {!editingEntaxi && <RequiredMark>*</RequiredMark>}
                  </Label>
                  <FileZone>
                    <FileSelectButton
                      type="button"
                      onClick={() =>
                        handleFileSelect('entaxiPDFs', 'Επιλογή Αρχείων Ένταξης (PDF, Word)')
                      }
                    >
                      Προσθήκη αρχείων
                    </FileSelectButton>
                    {formData.entaxiPDFs.length > 0 && (
                      <FileList>
                        {formData.entaxiPDFs.map((file, index) => {
                          const uniqueKey = file.tempId || file.fileName || `entaxi-${index}`;
                          return (
                            <FileItem key={uniqueKey}>
                              <FileName title={file.fileName}>{file.fileName}</FileName>
                              <RemoveFileButton
                                type="button"
                                onClick={() => handleFileRemove('entaxiPDFs', index)}
                              >
                                Αφαίρεση
                              </RemoveFileButton>
                            </FileItem>
                          );
                        })}
                      </FileList>
                    )}
                    {editingEntaxi &&
                      editingEntaxi.entaxiPDF &&
                      formData.entaxiPDFs.length === 0 && (
                        <ExistingFileNote>
                          Τρέχον αρχείο: {editingEntaxi.entaxiPDF}
                        </ExistingFileNote>
                      )}
                  </FileZone>
                  {errors.entaxiPDFs && <ErrorMessage>{errors.entaxiPDFs}</ErrorMessage>}
                </FormGroup>

                <FormGroup>
                  <Label>Αρχεία αποδοχής Δ.Σ.</Label>
                  <FileZone>
                    <FileSelectButton
                      type="button"
                      onClick={() =>
                        handleFileSelect('approvalPDFs', 'Επιλογή Αρχείων Αποδοχής (PDF, Word)')
                      }
                    >
                      Προσθήκη αρχείων
                    </FileSelectButton>
                    {formData.approvalPDFs.length > 0 && (
                      <FileCountBadge>
                        {formData.approvalPDFs.length} αρχείο(α) επιλεγμένο(α)
                      </FileCountBadge>
                    )}
                    {formData.approvalPDFs.length > 0 && (
                      <FileList>
                        {formData.approvalPDFs.map((file, index) => {
                          const uniqueKey = file.tempId || file.fileName || `approval-${index}`;
                          return (
                            <FileItem key={uniqueKey}>
                              <FileName title={file.fileName}>{file.fileName}</FileName>
                              <RemoveFileButton
                                type="button"
                                onClick={() => handleFileRemove('approvalPDFs', index)}
                              >
                                Αφαίρεση
                              </RemoveFileButton>
                            </FileItem>
                          );
                        })}
                      </FileList>
                    )}
                    {editingEntaxi &&
                      editingEntaxi.approvalPDF &&
                      formData.approvalPDFs.length === 0 && (
                        <ExistingFileNote>
                          Τρέχον αρχείο: {editingEntaxi.approvalPDF}
                        </ExistingFileNote>
                      )}
                  </FileZone>
                </FormGroup>
              </FormGrid>
            </Section>

            <Section>
              <SectionHead>
                <SectionTitle>Σχόλια</SectionTitle>
                <SectionHint>Προαιρετικά</SectionHint>
              </SectionHead>
              <FormGroup fullWidth>
                <Label>Παρατηρήσεις</Label>
                <TextArea
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  placeholder="Επιπλέον πληροφορίες..."
                  rows={3}
                />
              </FormGroup>
            </Section>

            <ButtonContainer>
              <Button type="button" onClick={handleDismiss} disabled={loading}>
                Ακύρωση
              </Button>
              <Button type="submit" primary disabled={loading}>
                {loading ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </Button>
            </ButtonContainer>
          </TheForm>
        </FormBody>
      </FormContainer>
    </FormOverlay>,
    document.body
  );
}

export default EntaxisForm;
