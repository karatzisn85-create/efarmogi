import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { safeConfirm } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';

const ipcRenderer = window.electronAPI;

const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 20px;
  width: 95vw;
  height: 90vh;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const FormHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const FormContent = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const Section = styled.div`
  background: #f8f9fa;
  border-radius: 15px;
  padding: 1.5rem;
  border: 2px solid #e9ecef;
`;

const SectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  grid-column: ${props => props.fullWidth ? 'span 2' : 'span 1'};

  @media (max-width: 768px) {
    grid-column: span 1;
  }
`;

const Label = styled.label`
  font-weight: 500;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #667eea;
  }
`;

const Select = styled.select`
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
  background: white;

  &:focus {
    border-color: #667eea;
  }
`;

const SearchResults = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const SearchResultItem = styled.div`
  padding: 0.8rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s ease;

  &:hover {
    background: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const NewProjectOption = styled.div`
  padding: 0.8rem;
  cursor: pointer;
  background: #e3f2fd;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
  color: #1976d2;
  transition: background 0.2s ease;

  &:hover {
    background: #bbdefb;
  }
`;

const SubprojectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
`;

const SubprojectItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  transition: all 0.3s ease;

  &:hover {
    border-color: #667eea;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const SubprojectInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SubprojectTitle = styled.div`
  font-weight: 600;
  color: #2c3e50;
`;


const SubprojectNumberInput = styled.input`
  font-size: 0.9rem;
  color: #495057;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  width: 150px;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  }
`;

const DeleteSubprojectButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #c82333;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const NewSubprojectForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 10px;
  border: 2px dashed #2196f3;
`;

const AddSubprojectButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  align-self: flex-start;

  &:hover {
    background: #218838;
    transform: translateY(-2px);
  }
`;

const FileUploadArea = styled.div`
  border: 3px dashed #667eea;
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
  background: #f8f9fa;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: #5a67d8;
    background: #e3f2fd;
  }

  &.drag-over {
    border-color: #28a745;
    background: #d4edda;
  }
`;

const FileUploadText = styled.div`
  font-size: 1.1rem;
  color: #667eea;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const FileUploadSubtext = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
`;

const FileList = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
`;

const FileName = styled.div`
  font-weight: 500;
  color: #2c3e50;
`;

const RemoveFileButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.3s ease;

  &:hover {
    background: #c82333;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
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

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
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

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

const SuccessMessage = styled.div`
  color: #28a745;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

function EgkriseisForm({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    projectType: 'existing', // 'existing' or 'new'
    selectedProject: null,
    newProjectTitle: '',
    selectedSubprojects: [],
    newSubprojects: [],
    projectFiles: [],
    subprojectFiles: [], // Legacy - για συμβατότητα
    subprojectFilesBySubproject: {}, // Νέα δομή: { subprojectKey: [files] }
    existingModifications: [], // Existing modifications for the selected project
    editedSubprojectNumbers: {} // { subprojectKey: newNumber } - για επεξεργασία αριθμών υποέργων
  });

  const [availableProjects, setAvailableProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [availableSubprojects, setAvailableSubprojects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Reset form when modal opens - καθαρισμός όλων των δεδομένων
  useEffect(() => {
    if (isOpen) {
      // Καθαρισμός όλων των δεδομένων όταν ανοίγει το modal
      setFormData({
        projectType: 'existing',
        selectedProject: null,
        newProjectTitle: '',
        selectedSubprojects: [],
        newSubprojects: [],
        projectFiles: [],
        subprojectFiles: [],
        subprojectFilesBySubproject: {},
        existingModifications: [],
        editedSubprojectNumbers: {}
      });
      setSearchTerm('');
      setShowSearchResults(false);
      setFilteredProjects([]);
      setAvailableSubprojects([]);
      setErrors({});
      setSuccessMessage('');
      // Φόρτωση projects με καθαρό state
      loadAvailableProjects();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter projects based on search term
  useEffect(() => {
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const filtered = availableProjects.filter(project =>
        project.title && project.title.toLowerCase().includes(searchLower)
      );
      setFilteredProjects(filtered);
    } else {
      // Show all projects when no search term
      setFilteredProjects(availableProjects);
    }
  }, [searchTerm, availableProjects]);

  // Load subprojects when project is selected
  useEffect(() => {
    if (formData.selectedProject) {
      loadSubprojectsForProject(formData.selectedProject);
    } else {
      setAvailableSubprojects([]);
    }
  }, [formData.selectedProject]);

  const loadAvailableProjects = async () => {
    try {
      setLoading(true);
      const result = await ipcRenderer.invoke('load-egkriseis-data');
      console.log('Loaded egkriseis data:', result);
      
      if (result.success && result.data && result.data.projects) {
        // Convert projects object to array format
        // Use the key (folderName) from the projects object
        const projectsArray = Object.entries(result.data.projects).map(([folderName, project]) => ({
          title: project.title,
          folderName: folderName, // Use the key as folderName
          subprojects: project.subprojects || {},
          modifications: project.modifications || [] // Include modifications
        }));
        // Χρήση requestAnimationFrame για non-blocking state update
        requestAnimationFrame(() => {
        setAvailableProjects(projectsArray);
        });
      } else {
        requestAnimationFrame(() => {
        setAvailableProjects([]);
        });
      }
    } catch (error) {
      console.error('Error loading egkriseis projects:', error);
      requestAnimationFrame(() => {
      setErrors({ general: 'Σφάλμα φόρτωσης έργων με εγκρίσεις' });
      });
    } finally {
      requestAnimationFrame(() => {
      setLoading(false);
      });
    }
  };

  const loadSubprojectsForProject = async (project) => {
    try {
      // Load subprojects from the project data, preserving the key
      const subprojects = Object.entries(project.subprojects || {}).map(([key, subproject]) => ({
        ...subproject,
        subprojectKey: key // Preserve the key for deletion
      }));
      console.log(`📂 Loaded ${subprojects.length} subproject(s) for project "${project.title}"`);
      subprojects.forEach(sub => {
        console.log(`  📁 Subproject: "${sub.title}" (key: ${sub.subprojectKey}) - PDFs: ${(sub.pdfs || []).length}`);
      });
      
      // Χρήση requestAnimationFrame για non-blocking state update
      requestAnimationFrame(() => {
      setAvailableSubprojects(subprojects);
      });
      
      // Modifications are already loaded in handleProjectSelect, no need to reload here
    } catch (error) {
      console.error('Error loading subprojects:', error);
    }
  };

  const handleProjectTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      projectType: type,
      selectedProject: type === 'existing' ? prev.selectedProject : null,
      newProjectTitle: type === 'new' ? prev.newProjectTitle : '',
      selectedSubprojects: [],
      newSubprojects: []
    }));
    setSearchTerm('');
    setShowSearchResults(false);
  };

  const handleProjectSearch = (term) => {
    setSearchTerm(term);
  };

  const handleProjectSelect = async (project) => {
    // Note: Egkriseis projects don't have projectId, so we skip lock checking
    // The lock mechanism is for regular projects, not egkriseis projects
    
    // Convert modifications array (strings) to objects with name property
    const existingModifications = (project.modifications || []).map(fileName => ({
      name: fileName,
      isExisting: true
    }));
    
    setFormData(prev => ({
      ...prev,
      selectedProject: project,
      selectedSubprojects: [],
      newSubprojects: [],
      existingModifications: existingModifications
    }));
    setSearchTerm(project.title);
    setShowSearchResults(false);
  };

  const handleNewProjectSelect = () => {
    setFormData(prev => ({
      ...prev,
      projectType: 'new',
      selectedProject: null,
      selectedSubprojects: [],
      newSubprojects: []
    }));
    setSearchTerm('');
    setShowSearchResults(false);
  };

  const handleSubprojectToggle = (subproject) => {
    setFormData(prev => ({
      ...prev,
      selectedSubprojects: prev.selectedSubprojects.includes(subproject)
        ? prev.selectedSubprojects.filter(s => s !== subproject)
        : [...prev.selectedSubprojects, subproject]
    }));
  };

  const handleSubprojectFileUpload = (files, subproject) => {
    const fileArray = Array.from(files);
    setFormData(prev => ({
      ...prev,
      subprojectFilesBySubproject: {
        ...prev.subprojectFilesBySubproject,
        [subproject.subprojectKey]: [
          ...(prev.subprojectFilesBySubproject[subproject.subprojectKey] || []),
          ...fileArray
        ]
      }
    }));
  };

  const handleRemoveSubprojectFile = (subproject, fileIndex) => {
    setFormData(prev => {
      const currentFiles = prev.subprojectFilesBySubproject[subproject.subprojectKey] || [];
      return {
        ...prev,
        subprojectFilesBySubproject: {
          ...prev.subprojectFilesBySubproject,
          [subproject.subprojectKey]: currentFiles.filter((_, i) => i !== fileIndex)
        }
      };
    });
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pdfToDelete, setPdfToDelete] = useState(null);

  const handleDeleteExistingPdfClick = (subproject, pdfFileName) => {
    setPdfToDelete({ subproject, pdfFileName });
    setDeleteModalOpen(true);
  };

  const handleDeletePdfCompletely = async () => {
    if (!pdfToDelete || !formData.selectedProject) return;

    const { pdfFileName } = pdfToDelete;

    try {
      setLoading(true);
      const result = await ipcRenderer.invoke(
        'delete-egkrisi-pdf-completely',
        formData.selectedProject.folderName,
        pdfFileName
      );

      if (result.success) {
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
          setDeleteModalOpen(false);
          setPdfToDelete(null);
          setSuccessMessage('Το αρχείο διαγράφηκε εντελώς από όλα τα υποέργα!');
          setTimeout(() => setSuccessMessage(''), 3000);
        });
        
        // Reload subprojects με delay για να μην μπλοκάρει το UI
        setTimeout(async () => {
          await loadSubprojectsForProject(formData.selectedProject);
        }, 100);
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting PDF completely:', error);
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
    } finally {
      requestAnimationFrame(() => {
        setLoading(false);
      });
    }
  };

  const handleDeletePdfFromSubproject = async () => {
    if (!pdfToDelete || !formData.selectedProject) return;

    const { subproject, pdfFileName } = pdfToDelete;

    try {
      setLoading(true);
      const result = await ipcRenderer.invoke(
        'delete-egkrisi-pdf-from-subproject',
        formData.selectedProject.folderName,
        subproject.subprojectKey,
        pdfFileName
      );

      if (result.success) {
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
          setDeleteModalOpen(false);
          setPdfToDelete(null);
          setSuccessMessage('Η συσχέτιση διαγράφηκε επιτυχώς!');
          setTimeout(() => setSuccessMessage(''), 3000);
        });
        
        // Reload subprojects με delay για να μην μπλοκάρει το UI
        setTimeout(async () => {
          await loadSubprojectsForProject(formData.selectedProject);
        }, 100);
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting PDF from subproject:', error);
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
    } finally {
      requestAnimationFrame(() => {
        setLoading(false);
      });
    }
  };

  const handleDeleteSubproject = async (subproject) => {
    if (!formData.selectedProject) {
      alert('Παρακαλώ επιλέξτε πρώτα ένα έργο');
      return;
    }

    if (!subproject.subprojectKey) {
      alert('Σφάλμα: Δεν βρέθηκε το κλειδί του υποέργου');
      return;
    }

    const confirmDelete = await showConfirm({
      title: 'Διαγραφή Υποέργου',
      message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το υποέργο "${subproject.title}";`,
      detail: 'Η ενέργεια είναι μη αναστρέψιμη.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑'
    });

    if (!confirmDelete) {
      return;
    }

    try {
      setLoading(true);
      const result = await ipcRenderer.invoke(
        'delete-egkrisi-subproject',
        formData.selectedProject.folderName,
        subproject.subprojectKey
      );

      if (result.success) {
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
        setFormData(prev => ({
          ...prev,
          selectedSubprojects: prev.selectedSubprojects.filter(s => s !== subproject)
        }));
        setSuccessMessage('Το υποέργο διαγράφηκε επιτυχώς!');
        setTimeout(() => setSuccessMessage(''), 3000);
        });

        // Reload subprojects με delay για να μην μπλοκάρει το UI
        setTimeout(async () => {
          await loadSubprojectsForProject(formData.selectedProject);
        }, 100);
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + (result.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting subproject:', error);
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
    } finally {
      requestAnimationFrame(() => {
      setLoading(false);
      });
    }
  };

  const handleNewSubprojectAdd = () => {
    const newSubproject = {
      id: Date.now(),
      title: '',
      number: '',
      isNew: true
    };
    setFormData(prev => ({
      ...prev,
      newSubprojects: [...prev.newSubprojects, newSubproject]
    }));
  };

  const handleNewSubprojectChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      newSubprojects: prev.newSubprojects.map(subproject =>
        subproject.id === id ? { ...subproject, [field]: value } : subproject
      )
    }));
  };

  const handleNewSubprojectRemove = (id) => {
    setFormData(prev => ({
      ...prev,
      newSubprojects: prev.newSubprojects.filter(subproject => subproject.id !== id)
    }));
  };

  const handleFileUpload = (files, type) => {
    const fileArray = Array.from(files);
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], ...fileArray]
    }));
  };

  const handleFileRemove = (index, type) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    handleFileUpload(files, type);
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.projectType === 'existing' && !formData.selectedProject) {
      newErrors.project = 'Παρακαλώ επιλέξτε ένα έργο';
    }

    if (formData.projectType === 'new' && !formData.newProjectTitle.trim()) {
      newErrors.project = 'Παρακαλώ εισάγετε τίτλο νέου έργου';
    }

    // Υποέργα δεν είναι πλέον υποχρεωτικά - μπορεί το έγγραφο να αφορά μόνο το έργο ως σύνολο
    // if (formData.selectedSubprojects.length === 0 && formData.newSubprojects.length === 0) {
    //   newErrors.subprojects = 'Παρακαλώ επιλέξτε ή δημιουργήστε τουλάχιστον ένα υποέργο';
    // }

    // Validate new subprojects
    formData.newSubprojects.forEach((subproject, index) => {
      if (!subproject.title.trim()) {
        newErrors[`newSubproject_${index}_title`] = 'Τίτλος υποέργου απαιτείται';
      }
      if (!subproject.number.trim()) {
        newErrors[`newSubproject_${index}_number`] = 'Αριθμός υποέργου απαιτείται';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      setSuccessMessage('');

      // Prepare data for saving
      // Convert File objects to ArrayBuffer for IPC transmission
      const projectFilesData = await Promise.all(
        formData.projectFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            data: Array.from(new Uint8Array(arrayBuffer))
          };
        })
      );

      // Συλλογή αρχείων από όλα τα επιλεγμένα υποέργα
      const allSubprojectFiles = [];
      console.log('📋 Collecting files for selected subprojects:', formData.selectedSubprojects.map(s => s.title));
      for (const subproject of formData.selectedSubprojects) {
        const files = formData.subprojectFilesBySubproject[subproject.subprojectKey] || [];
        console.log(`  📁 Subproject "${subproject.title}" (key: ${subproject.subprojectKey}): ${files.length} file(s)`);
        for (const file of files) {
          allSubprojectFiles.push({
            file: file,
            subprojectKey: subproject.subprojectKey,
            subprojectTitle: subproject.title
          });
          console.log(`    ✅ File: ${file.name} -> subprojectKey: ${subproject.subprojectKey}`);
        }
      }
      console.log(`📊 Total files to save: ${allSubprojectFiles.length}`);

      const subprojectFilesData = await Promise.all(
        allSubprojectFiles.map(async (item) => {
          const arrayBuffer = await item.file.arrayBuffer();
          return {
            name: item.file.name,
            size: item.file.size,
            type: item.file.type,
            lastModified: item.file.lastModified,
            data: Array.from(new Uint8Array(arrayBuffer)),
            subprojectKey: item.subprojectKey,
            subprojectTitle: item.subprojectTitle
          };
        })
      );

      // Ενημέρωση των επιλεγμένων υποέργων με τους αλλαγμένους αριθμούς
      // Χρησιμοποιούμε πάντα το editedNumber αν υπάρχει, ακόμα και αν είναι ίσο με το αρχικό
      // Αυτό εξασφαλίζει ότι οι αλλαγές αποθηκεύονται σωστά
      const updatedSelectedSubprojects = formData.selectedSubprojects.map(subproject => {
        const editedNumber = formData.editedSubprojectNumbers[subproject.subprojectKey];
        if (editedNumber !== undefined) {
          // Χρησιμοποιούμε πάντα το editedNumber αν υπάρχει, ακόμα και αν είναι ίσο με το αρχικό
          // Αυτό εξασφαλίζει ότι οι αλλαγές αποθηκεύονται σωστά
          if (editedNumber !== subproject.number) {
            console.log(`📝 Updating subproject number: "${subproject.title}" (key: ${subproject.subprojectKey}) from "${subproject.number}" to "${editedNumber}"`);
          }
          return {
            ...subproject,
            number: editedNumber
          };
        }
        return subproject;
      });
      
      console.log('📋 Updated selected subprojects:', updatedSelectedSubprojects.map(s => ({
        title: s.title,
        number: s.number,
        subprojectKey: s.subprojectKey
      })));

      const saveData = {
        projectType: formData.projectType,
        project: formData.selectedProject || { title: formData.newProjectTitle },
        selectedSubprojects: updatedSelectedSubprojects,
        newSubprojects: formData.newSubprojects,
        projectFiles: projectFilesData,
        subprojectFiles: subprojectFilesData, // Τώρα περιέχει και subprojectKey για κάθε αρχείο
        editedSubprojectNumbers: formData.editedSubprojectNumbers // Στέλνουμε όλα τα edited numbers, ακόμα και για υποέργα χωρίς τικ
      };
      
      console.log('📤 Sending editedSubprojectNumbers:', formData.editedSubprojectNumbers);

      // Call IPC to save the data
      const result = await ipcRenderer.invoke('save-egkriseis-data', saveData);
      
      if (result.success) {
        // Η αυτόματη συσχέτιση γίνεται τώρα στο Dashboard.loadProjects()
        // με βάση τον τίτλο του υποέργου, όχι με χειροκίνητη επιλογή
        
        setSuccessMessage('Τα δεδομένα αποθηκεύτηκαν επιτυχώς! Η αυτόματη συσχέτιση θα γίνει με βάση τον τίτλο του υποέργου.');
        
        // Καθαρισμός του form πριν το κλείσιμο
        setFormData({
          projectType: 'existing',
          selectedProject: null,
          newProjectTitle: '',
          selectedSubprojects: [],
          newSubprojects: [],
          projectFiles: [],
          subprojectFiles: [],
          subprojectFilesBySubproject: {},
          existingModifications: []
        });
        setSearchTerm('');
        setShowSearchResults(false);
        setFilteredProjects([]);
        setAvailableSubprojects([]);
        setErrors({});
        
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
          setLoading(false);
          setErrors({});
          
          // Small delay to ensure state is cleared
        setTimeout(() => {
          onSave && onSave();
          onClose();
          }, 100);
        });
      } else {
        setErrors({ general: result.error || 'Σφάλμα αποθήκευσης' });
      }
    } catch (error) {
      console.error('Error saving egkriseis data:', error);
      setErrors({ general: 'Σφάλμα αποθήκευσης δεδομένων' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    // Note: Egkriseis projects don't use the lock mechanism
    // No need to unlock here
    
    // Καθαρισμός όλων των δεδομένων πριν το κλείσιμο
    setFormData({
      projectType: 'existing',
      selectedProject: null,
      newProjectTitle: '',
      selectedSubprojects: [],
      newSubprojects: [],
      projectFiles: [],
      subprojectFiles: [],
      existingModifications: []
    });
    setSearchTerm('');
    setShowSearchResults(false);
    setFilteredProjects([]);
    setAvailableSubprojects([]);
    setErrors({});
    setSuccessMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <FormContainer>
        <FormHeader>
          <FormTitle>ΕΠΕΞΕΡΓΑΣΙΑ/ΔΗΜΙΟΥΡΓΙΑ ΕΓΚΡΙΣΗΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ</FormTitle>
          <CloseButton onClick={handleClose}>✕</CloseButton>
        </FormHeader>

        <FormContent>
          {/* Project Selection Section */}
          <Section>
            <SectionTitle>
              📋 Επιλογή Έργου
            </SectionTitle>
            
            <FormGrid>
              <FormGroup>
                <Label>Τύπος Έργου</Label>
                <Select
                  value={formData.projectType}
                  onChange={(e) => handleProjectTypeChange(e.target.value)}
                >
                  <option value="existing">Επιλογή από υπάρχοντα έργα</option>
                  <option value="new">Δημιουργία νέου έργου</option>
                </Select>
              </FormGroup>

              {formData.projectType === 'existing' && (
                <FormGroup>
                  <Label>Αναζήτηση Έργου</Label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="text"
                      placeholder="Αναζήτηση έργου..."
                      value={searchTerm}
                      onChange={(e) => handleProjectSearch(e.target.value)}
                      onFocus={() => {
                        console.log('Input focused, showing search results');
                        setShowSearchResults(true);
                      }}
                      onClick={() => {
                        console.log('Input clicked');
                        setShowSearchResults(true);
                      }}
                      disabled={false}
                      style={{ pointerEvents: 'auto', cursor: 'text' }}
                    />
                    {showSearchResults && (
                      <SearchResults>
                        <NewProjectOption onClick={handleNewProjectSelect}>
                          ➕ Δημιουργία νέου έργου
                        </NewProjectOption>
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map((project, index) => (
                            <SearchResultItem
                              key={index}
                              onClick={() => handleProjectSelect(project)}
                            >
                              {project.title}
                            </SearchResultItem>
                          ))
                        ) : (
                          <SearchResultItem disabled>
                            Δεν βρέθηκαν έργα
                          </SearchResultItem>
                        )}
                      </SearchResults>
                    )}
                  </div>
                </FormGroup>
              )}

              {formData.projectType === 'new' && (
                <FormGroup>
                  <Label>Τίτλος Νέου Έργου</Label>
                  <Input
                    type="text"
                    placeholder="Εισάγετε τίτλο νέου έργου..."
                    value={formData.newProjectTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, newProjectTitle: e.target.value }))}
                  />
                </FormGroup>
              )}
            </FormGrid>

            {errors.project && <ErrorMessage>{errors.project}</ErrorMessage>}
          </Section>

          {/* Subprojects Section */}
          <Section>
            <SectionTitle>
              📂 Υποέργα
            </SectionTitle>

            {/* Existing Subprojects */}
            {formData.selectedProject && availableSubprojects.length > 0 && (
              <div>
                <Label>Επιλογή Υπάρχοντα Υποέργα</Label>
                <SubprojectsList>
                  {availableSubprojects.map((subproject, index) => {
                    const isSelected = formData.selectedSubprojects.includes(subproject);
                    const existingPdfs = subproject.pdfs || [];
                    const subprojectFiles = formData.subprojectFilesBySubproject?.[subproject.subprojectKey] || [];
                    
                    return (
                    <SubprojectItem key={index}>
                      <Checkbox
                        type="checkbox"
                          checked={isSelected}
                        onChange={() => handleSubprojectToggle(subproject)}
                      />
                        <SubprojectInfo style={{ flex: 1 }}>
                        <SubprojectTitle>{subproject.title}</SubprojectTitle>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#6c757d', fontWeight: '500' }}>Αριθμός:</span>
                            <SubprojectNumberInput
                              type="text"
                              value={formData.editedSubprojectNumbers[subproject.subprojectKey] !== undefined 
                                ? formData.editedSubprojectNumbers[subproject.subprojectKey] 
                                : (subproject.number || '')}
                              onChange={(e) => {
                                setFormData(prev => ({
                                  ...prev,
                                  editedSubprojectNumbers: {
                                    ...prev.editedSubprojectNumbers,
                                    [subproject.subprojectKey]: e.target.value
                                  }
                                }));
                              }}
                              placeholder="Αριθμός υποέργου"
                            />
                          </div>
                          
                          {/* Existing PDFs */}
                          {existingPdfs.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#495057' }}>
                                Υπάρχοντα αρχεία:
                              </div>
                              {existingPdfs.map((pdf, pdfIndex) => (
                                <div key={pdfIndex} style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  padding: '0.5rem',
                                  background: '#f8f9fa',
                                  borderRadius: '6px',
                                  border: '1px solid #dee2e6'
                                }}>
                                  <span style={{ fontSize: '0.8rem', color: '#495057' }}>📄 {pdf}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExistingPdfClick(subproject, pdf)}
                                    style={{
                                      background: '#dc3545',
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.2rem 0.35rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.65rem',
                                      fontWeight: '600',
                                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      minWidth: 'auto'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = '#c82333';
                                      e.target.style.transform = 'scale(1.1)';
                                      e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = '#dc3545';
                                      e.target.style.transform = 'scale(1)';
                                      e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                    }}
                                    title="Διαγραφή αρχείου"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* File upload for this specific subproject */}
                          {isSelected && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <Label style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                Προσθήκη αρχείων για αυτό το υποέργο:
                              </Label>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.doc,.docx"
                                  style={{ display: 'none' }}
                                  id={`subprojectFiles_${subproject.subprojectKey}`}
                                  onChange={(e) => handleSubprojectFileUpload(e.target.files, subproject)}
                                />
                                <label
                                  htmlFor={`subprojectFiles_${subproject.subprojectKey}`}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: '#17a2b8',
                                    color: 'white',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = '#138496';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = '#17a2b8';
                                  }}
                                >
                                  📁 Επιλογή αρχείων
                                </label>
                                {subprojectFiles.length > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: '#28a745', fontWeight: '600' }}>
                                    {subprojectFiles.length} αρχείο(α) επιλεγμένο(α)
                                  </span>
                                )}
                              </div>
                              {subprojectFiles.length > 0 && (
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {subprojectFiles.map((file, fileIndex) => (
                                    <div key={fileIndex} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.4rem 0.6rem',
                                      background: '#e7f3ff',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem'
                                    }}>
                                      <span style={{ color: '#0066cc' }}>📄 {file.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubprojectFile(subproject, fileIndex)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#dc3545',
                                          cursor: 'pointer',
                                          fontSize: '0.8rem',
                                          padding: '0.2rem 0.4rem'
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                      </SubprojectInfo>
                      <DeleteSubprojectButton
                        type="button"
                        onClick={() => handleDeleteSubproject(subproject)}
                        title="Διαγραφή υποέργου"
                      >
                        🗑️
                      </DeleteSubprojectButton>
                    </SubprojectItem>
                    );
                  })}
                </SubprojectsList>
              </div>
            )}

            {/* New Subprojects */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <Label style={{ margin: 0 }}>Νέα Υποέργα</Label>
                <AddSubprojectButton onClick={handleNewSubprojectAdd}>
                  ➕ Προσθήκη Νέου Υποέργου
                </AddSubprojectButton>
              </div>
              
              {formData.newSubprojects.map((subproject) => (
                <NewSubprojectForm key={subproject.id}>
                  <FormGrid>
                    <FormGroup>
                      <Label>Τίτλος Υποέργου</Label>
                      <Input
                        type="text"
                        placeholder="Εισάγετε τίτλο υποέργου..."
                        value={subproject.title}
                        onChange={(e) => handleNewSubprojectChange(subproject.id, 'title', e.target.value)}
                      />
                      {errors[`newSubproject_${formData.newSubprojects.indexOf(subproject)}_title`] && (
                        <ErrorMessage>{errors[`newSubproject_${formData.newSubprojects.indexOf(subproject)}_title`]}</ErrorMessage>
                      )}
                    </FormGroup>
                    <FormGroup>
                      <Label>Αριθμός Υποέργου</Label>
                      <Input
                        type="text"
                        placeholder="Εισάγετε αριθμό υποέργου..."
                        value={subproject.number}
                        onChange={(e) => handleNewSubprojectChange(subproject.id, 'number', e.target.value)}
                      />
                      {errors[`newSubproject_${formData.newSubprojects.indexOf(subproject)}_number`] && (
                        <ErrorMessage>{errors[`newSubproject_${formData.newSubprojects.indexOf(subproject)}_number`]}</ErrorMessage>
                      )}
                    </FormGroup>
                  </FormGrid>
                  <button
                    type="button"
                    onClick={() => handleNewSubprojectRemove(subproject.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      alignSelf: 'flex-start'
                    }}
                  >
                    🗑️ Διαγραφή
                  </button>
                </NewSubprojectForm>
              ))}
            </div>

            {/* Υποέργα δεν είναι πλέον υποχρεωτικά */}
            {/* {errors.subprojects && <ErrorMessage>{errors.subprojects}</ErrorMessage>} */}
          </Section>

          {/* Existing Modifications Section */}
          {formData.existingModifications && formData.existingModifications.length > 0 && (
            <Section>
              <SectionTitle>
                📝 Τροποποιήσεις
              </SectionTitle>
              <div style={{
                background: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '2px solid #e9ecef',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#6c757d',
                  marginBottom: '1rem',
                  fontWeight: '500'
                }}>
                  Υπάρχουσες τροποποιήσεις για αυτό το έργο:
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {formData.existingModifications.map((modification, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.8rem',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>📄</span>
                        <span style={{
                          fontWeight: '500',
                          color: '#495057'
                        }}>{modification.name}</span>
                      </div>
                      <span style={{
                        fontSize: '0.85rem',
                        color: '#28a745',
                        fontWeight: '600'
                      }}>✓ Αποθηκευμένο</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* File Upload Section */}
          <Section>
            <SectionTitle>
              📄 Φόρτωση Αρχείων (PDF, Word)
            </SectionTitle>

            <FormGrid>
              <FormGroup>
                <Label>Για τροποποίηση της Πράξης εδώ:</Label>
                <FileUploadArea
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'projectFiles')}
                  onClick={() => document.getElementById('projectFiles').click()}
                >
                  <FileUploadText>📁 Κάντε κλικ ή σύρετε αρχεία εδώ (PDF, Word)</FileUploadText>
                  <FileUploadSubtext>Για τροποποίηση της πράξης</FileUploadSubtext>
                </FileUploadArea>
                <input
                  id="projectFiles"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e.target.files, 'projectFiles')}
                />
                {formData.projectFiles.length > 0 && (
                  <FileList>
                    {formData.projectFiles.map((file, index) => (
                      <FileItem key={index}>
                        <FileName>{file.name}</FileName>
                        <RemoveFileButton onClick={() => handleFileRemove(index, 'projectFiles')}>
                          ✕
                        </RemoveFileButton>
                      </FileItem>
                    ))}
                  </FileList>
                )}
              </FormGroup>

              <FormGroup>
                <Label>Για τροποποίηση υποέργων:</Label>
                <div style={{ 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '2px dashed #dee2e6',
                  fontSize: '0.85rem',
                  color: '#6c757d',
                  textAlign: 'center'
                }}>
                  ⚠️ Για προσθήκη αρχείων σε συγκεκριμένα υποέργα, επιλέξτε τα υποέργα παραπάνω και χρησιμοποιήστε το κουμπί "📁 Επιλογή αρχείων" που εμφανίζεται κάτω από κάθε επιλεγμένο υποέργο.
                </div>
              </FormGroup>
            </FormGrid>
          </Section>

          {/* Messages */}
          {errors.general && <ErrorMessage>{errors.general}</ErrorMessage>}
          {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}

          {/* Buttons */}
          <ButtonContainer>
            <CancelButton onClick={handleClose}>
              Ακύρωση
            </CancelButton>
            <SaveButton onClick={handleSave} disabled={loading}>
              {loading ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </SaveButton>
          </ButtonContainer>
        </FormContent>
      </FormContainer>

      {/* Delete PDF Modal */}
      {deleteModalOpen && pdfToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20000,
            backdropFilter: 'blur(3px)'
          }}
          onClick={(e) => e.target === e.currentTarget && setDeleteModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.2rem', fontWeight: '600' }}>
              Διαγραφή Αρχείου PDF
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#495057', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Το αρχείο <strong>"{pdfToDelete.pdfFileName}"</strong> είναι συσχετισμένο με το υποέργο <strong>"{pdfToDelete.subproject.title}"</strong>.
              <br /><br />
              Επιλέξτε τη διαγραφή που θέλετε:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleDeletePdfCompletely}
                style={{
                  padding: '0.9rem 1.2rem',
                  borderRadius: '10px',
                  border: '2px solid #dc3545',
                  background: '#dc3545',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#c82333';
                  e.target.style.borderColor = '#c82333';
                  e.target.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#dc3545';
                  e.target.style.borderColor = '#dc3545';
                  e.target.style.transform = 'translateX(0)';
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🗑️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Διαγραφή εντελώς από την εφαρμογή</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Το αρχείο θα διαγραφεί από όλα τα υποέργα στα οποία είναι συσχετισμένο</div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleDeletePdfFromSubproject}
                style={{
                  padding: '0.9rem 1.2rem',
                  borderRadius: '10px',
                  border: '2px solid #6c757d',
                  background: 'white',
                  color: '#6c757d',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f8f9fa';
                  e.target.style.borderColor = '#495057';
                  e.target.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#6c757d';
                  e.target.style.transform = 'translateX(0)';
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🔗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Διαγραφή μόνο η συσχέτιση</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Το αρχείο θα παραμείνει, αλλά θα αφαιρεθεί μόνο από αυτό το υποέργο</div>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(false);
                setPdfToDelete(null);
              }}
              style={{
                marginTop: '1rem',
                padding: '0.7rem 1.2rem',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                background: 'white',
                color: '#6c757d',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f8f9fa';
                e.target.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.borderColor = '#dee2e6';
              }}
            >
              Ακύρωση
            </button>
          </div>
        </div>
      )}
    </FormOverlay>
  );
}

export default EgkriseisForm;
