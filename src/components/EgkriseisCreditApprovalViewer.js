import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import SubprojectLinkingModal from './SubprojectLinkingModal';
import SubprojectSearchModal from './SubprojectSearchModal';

const ipcRenderer = window.electronAPI;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 0.65rem 1cm;
  overflow-y: auto;
  box-sizing: border-box;

  @media (min-width: 900px) {
    padding: 0.85rem 1cm;
  }
`;

const ModalContainer = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  width: 100%;
  max-width: 1920px;
  max-height: 94vh;
  height: min(94vh, 100%);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.95);
  overflow: hidden;
  margin-top: 0.35rem;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;

const ModalHeader = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.65rem;
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.02em;
  line-height: 1.2;

  &::before {
    content: '';
    width: 3px;
    height: 1.15rem;
    border-radius: 3px;
    background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
    flex-shrink: 0;
  }
`;

const CloseButton = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
  }
`;

const EditButton = styled.button`
  background: #4f46e5;
  color: #f8fafc;
  border: 1px solid #4338ca;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-right: 0.5rem;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    background: #4338ca;
    border-color: #3730a3;
    box-shadow: 0 2px 10px rgba(79, 70, 229, 0.22);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SearchAndFiltersContainer = styled.div`
  flex-shrink: 0;
  padding: 0.65rem 1.25rem 0.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const SearchBar = styled.div`
  display: flex;
  gap: 0.65rem;
  margin-bottom: 0.65rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 0.55rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #1e293b;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;



const StatsContainer = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const StatCard = styled.div`
  background: #ffffff;
  padding: 0.55rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const StatIcon = styled.span`
  font-size: 1.05rem;
`;

const StatText = styled.div`
  font-size: 0.78rem;
  color: #64748b;
`;

const StatNumber = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #4f46e5;
`;

const ProjectsContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem 1.25rem;
  background: #f1f5f9;
`;

const ProjectSection = styled.div`
  margin-bottom: 1.65rem;
  border: 1px solid #94a3b8;
  border-radius: 14px;
  overflow: visible;
  background: #ffffff;
  box-shadow:
    0 4px 18px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ProjectHeader = styled.div`
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #334155 100%);
  padding: 1rem 1.2rem 1.1rem;
  border-bottom: 3px solid #6366f1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  position: relative;
`;

const ProjectTitle = styled.h3`
  margin: 0;
  flex: 1 1 220px;
  min-width: 0;
  color: #f8fafc;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.45;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  display: block;
  overflow-wrap: anywhere;
  word-break: break-word;
  padding-left: 0.7rem;
  border-left: 4px solid #a5b4fc;
  border-radius: 2px;
`;

const ModificationsBadge = styled.div`
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.1rem;
  margin-left: auto;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #fde68a;
    border-color: #fbbf24;
  }
`;

const ModificationsDropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  z-index: 1000;
  min-width: 300px;
  max-width: 500px;
  padding: 1rem;
  margin-top: 0.5rem;
`;

const ModificationsTitle = styled.div`
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
`;

const SubprojectsList = styled.div`
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
`;

const SubprojectItem = styled.div`
  padding: 1rem 1.15rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: ${props => props.index % 2 === 0 ? '#ffffff' : '#f8fafc'};
  transition: background 0.2s ease;
  margin-bottom: 0;

  &:hover {
    background: #f1f5f9;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const SubprojectInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SubprojectHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const SubprojectNumber = styled.div`
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  min-width: 72px;
  text-align: center;
`;

const SubprojectTitle = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 1.05rem;
  line-height: 1.4;
  flex: 1;
`;

const PdfsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.3rem;
`;

const PdfGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.6rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }
`;

const PdfItem = styled.div`
  background: #f1f5f9;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  font-size: 0.75rem;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border-left: 3px solid #6366f1;
  border: 1px solid #e2e8f0;
`;

const PdfActions = styled.div`
  display: flex;
  gap: 0.25rem;
  margin-top: 0.3rem;
`;

const ViewButton = styled.button`
  background: #4f46e5;
  color: #f8fafc;
  border: 1px solid #4338ca;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  flex: 1;
  min-width: 0;
  box-shadow: 0 1px 4px rgba(67, 56, 202, 0.2);

  &:hover:not(:disabled) {
    background: #4338ca;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.28);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const DownloadButton = styled.button`
  background: #15803d;
  color: #ffffff;
  border: 1px solid #166534;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex: 1;
  min-width: 0;

  &:hover {
    background: #166534;
    border-color: #14532d;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 1.05rem;
  color: #64748b;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
  padding: 1rem;
`;

const PaginationButton = styled.button`
  background: ${props => props.active ? '#4f46e5' : '#ffffff'};
  color: ${props => props.active ? '#f8fafc' : '#475569'};
  border: 1px solid ${props => props.active ? '#4338ca' : '#cbd5e1'};
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover:not(:disabled) {
    background: ${props => props.active ? '#4338ca' : '#f8fafc'};
    border-color: ${props => props.active ? '#3730a3' : '#94a3b8'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PaginationInfo = styled.div`
  font-size: 0.85rem;
  color: #64748b;
  margin: 0 1rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: #64748b;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyStateText = styled.p`
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
`;

const EmptyStateSubtext = styled.p`
  font-size: 1rem;
  opacity: 0.7;
`;

const SubprojectHeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  align-items: center;
`;

const LinkedStatus = styled.div`
  font-size: 0.7rem;
  color: #28a745;
  font-weight: 600;
  margin-top: 0.3rem;
  text-align: center;
  background: rgba(40, 167, 69, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(40, 167, 69, 0.3);
`;

function EgkriseisCreditApprovalViewer({ isOpen, onClose, userRole, onOpenForm, highlightProjectTitle = null, highlightSubprojectTitle = null, onLinkCreated = null }) {
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [egkriseisData, setEgkriseisData] = useState(null);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [subprojectSearchTerm, setSubprojectSearchTerm] = useState('');
  const [debouncedProjectSearchTerm, setDebouncedProjectSearchTerm] = useState('');
  const [debouncedSubprojectSearchTerm, setDebouncedSubprojectSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [openModificationsDropdown, setOpenModificationsDropdown] = useState(null);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [currentLinkingSubproject, setCurrentLinkingSubproject] = useState(null);
  const [linkedSubprojects, setLinkedSubprojects] = useState({});
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [currentSubprojectForLink, setCurrentSubprojectForLink] = useState(null);
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    console.log('🔵 EgkriseisCreditApprovalViewer - isOpen:', isOpen);
    if (isOpen) {
      console.log('🟢 Opening viewer, loading data...');
      loadEgkriseisData();
    }
  }, [isOpen]);

  // Debounced search effects
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProjectSearchTerm(projectSearchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [projectSearchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubprojectSearchTerm(subprojectSearchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [subprojectSearchTerm]);

  useEffect(() => {
    if (egkriseisData) {
      applyFilters();
    }
  }, [egkriseisData, debouncedProjectSearchTerm, debouncedSubprojectSearchTerm]);

  // Auto-apply highlight filters when viewer opens
  useEffect(() => {
    if (isOpen && highlightProjectTitle) {
      setProjectSearchTerm(highlightProjectTitle);
      setDebouncedProjectSearchTerm(highlightProjectTitle);
    }
    if (isOpen && highlightSubprojectTitle) {
      setSubprojectSearchTerm(highlightSubprojectTitle);
      setDebouncedSubprojectSearchTerm(highlightSubprojectTitle);
    }
  }, [isOpen, highlightProjectTitle, highlightSubprojectTitle]);

  // Clear search terms when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProjectSearchTerm('');
      setSubprojectSearchTerm('');
      setDebouncedProjectSearchTerm('');
      setDebouncedSubprojectSearchTerm('');
    }
  }, [isOpen]);

  const loadEgkriseisData = async () => {
    try {
      setLoading(true);
      console.log('🔄 LOADING EGKRISEIS DATA...');
      const result = await ipcRenderer.invoke('load-egkriseis-data');
      console.log('📦 Load result:', result);
      if (result.success) {
        console.log('✅ Data loaded successfully');
        console.log('📊 Projects count:', Object.keys(result.data?.projects || {}).length);
        // Normalize data: εξασφάλιση ότι όλα τα projects έχουν modifications array
        if (result.data && result.data.projects) {
          Object.keys(result.data.projects).forEach(projectKey => {
            const project = result.data.projects[projectKey];
            if (!project.modifications || !Array.isArray(project.modifications)) {
              project.modifications = [];
            }
          });
          // Debug: Find the specific project
          const targetProject = Object.values(result.data.projects).find(p => 
            p.title && p.title.includes('ΜΕΛΙΔΟΧΩΡΙΟΥ')
          );
          if (targetProject) {
            console.log('🎯 FOUND TARGET PROJECT:', {
              title: targetProject.title,
              modifications: targetProject.modifications,
              subprojects: Object.keys(targetProject.subprojects || {}).length
            });
          } else {
            console.log('❌ TARGET PROJECT NOT FOUND!');
          }
        }
        setEgkriseisData(result.data);
      } else {
        console.error('❌ Error loading egkriseis data:', result.error);
      }
      
      // Load existing links
      const linksResult = await ipcRenderer.invoke('load-egkrisi-links');
      if (linksResult.success) {
        setLinkedSubprojects(linksResult.data);
        console.log('Loaded existing links:', linksResult.data);
      }
    } catch (error) {
      console.error('Error loading egkriseis data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function για normalize text (ίδια με Dashboard)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')   // Replace literal \n with space (from JSON)
      .replace(/\n/g, ' ')    // Replace actual newlines with space
      .replace(/\r/g, ' ')    // Replace carriage returns
      .replace(/\t/g, ' ')    // Replace tabs
      .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
      .trim()                 // Remove leading/trailing spaces
      .toLowerCase();         // Case insensitive
  };

  const applyFilters = useCallback(() => {
    if (!egkriseisData) return;

    let filtered = Object.values(egkriseisData.projects);
    
    // Debug: Log projects with modifications
    console.log('🔍 All projects:', filtered.length);
    const projectsWithMods = filtered.filter(p => p.modifications && p.modifications.length > 0);
    console.log('📝 Projects with modifications:', projectsWithMods.map(p => ({ title: p.title, mods: p.modifications })));

    // Project title search filter με normalize
    if (debouncedProjectSearchTerm && debouncedProjectSearchTerm.trim()) {
      const normalizedSearchTerm = normalizeText(debouncedProjectSearchTerm);
      filtered = filtered.filter(project => {
        const normalizedProjectTitle = normalizeText(project.title);
        return normalizedProjectTitle.includes(normalizedSearchTerm);
      });
    }

    // Subproject title search filter με normalize
    if (debouncedSubprojectSearchTerm && debouncedSubprojectSearchTerm.trim()) {
      const normalizedSearchTerm = normalizeText(debouncedSubprojectSearchTerm);
      filtered = filtered.map(project => {
        // Filter subprojects που ταιριάζουν στον όρο αναζήτησης
        const matchingSubprojects = Object.fromEntries(
          Object.entries(project.subprojects || {}).filter(([key, subproject]) => {
            const normalizedSubprojectTitle = normalizeText(subproject.title);
            return normalizedSubprojectTitle.includes(normalizedSearchTerm);
          })
        );
        
        // Return project με μόνο τα matching subprojects
        return {
          ...project,
          subprojects: matchingSubprojects
        };
      }).filter(project => {
        // Κρατάμε έργα που έχουν matching subprojects
        // ΑΛΛΑ επίσης και έργα που έχουν modifications (project-level files) 
        // ακόμα και αν δεν έχουν subprojects που ταιριάζουν
        const hasMatchingSubprojects = Object.keys(project.subprojects || {}).length > 0;
        const hasModifications = (project.modifications && Array.isArray(project.modifications) && project.modifications.length > 0);
        return hasMatchingSubprojects || hasModifications;
      });
    }

    setFilteredProjects(filtered);
  }, [egkriseisData, debouncedProjectSearchTerm, debouncedSubprojectSearchTerm]);

  // Memoized pagination data
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentProjects = filteredProjects.slice(startIndex, endIndex);
    
    return {
      totalPages,
      currentProjects,
      startIndex,
      endIndex,
      totalItems: filteredProjects.length
    };
  }, [filteredProjects, currentPage, ITEMS_PER_PAGE]);

  const handleViewPdf = useCallback(async (projectTitle, pdfName) => {
    try {
      const result = await ipcRenderer.invoke('view-egkriseis-pdf', projectTitle, pdfName);
      // The handler will open the file directly with exec command
      // No need to do anything else
    } catch (error) {
      console.error('Error viewing PDF:', error);
    }
  }, []);

  const handleDownloadPdf = useCallback(async (projectTitle, pdfName) => {
    try {
      const result = await ipcRenderer.invoke('download-egkriseis-pdf', projectTitle, pdfName);
      if (result.success) {
        // Show save dialog and copy file
        const saveResult = await ipcRenderer.invoke('show-save-dialog', {
          title: 'Αποθήκευση PDF',
          defaultPath: pdfName,
          filters: [
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (!saveResult.canceled && saveResult.filePath) {
          await ipcRenderer.invoke('copy-file', result.filePath, saveResult.filePath);
        }
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleLinkSubproject = async (subproject, project) => {
    try {
      // Δημιουργία χειροκίνητης συσχέτισης εγκρίσεων
      // Για χειροκίνητη συσχέτιση, ψάχνουμε το subprojectId σε όλα τα έργα
      const realSubprojectId = await ipcRenderer.invoke('find-subproject-by-title', {
        projectId: null, // Ψάχνουμε σε όλα τα έργα
        subprojectTitle: subproject.title
      });
      
      if (!realSubprojectId) {
        // Δεν βρέθηκε - ανοίγουμε το modal αναζήτησης
        setCurrentSubprojectForLink({ subproject, project });
        setIsSearchModalOpen(true);
        return;
      }
      
      // Βρίσκουμε το σωστό projectId από το subprojectId
      const realProjectId = await ipcRenderer.invoke('find-project-by-subproject-id', realSubprojectId);
      
      if (!realProjectId) {
        alert('❌ Δεν βρέθηκε το έργο για το υποέργο');
        return;
      }
      
      const linkData = {
        egkrisiProjectKey: project.projectId,
        egkrisiSubprojectKey: subproject.number,
        egkrisiTitle: subproject.title,
        egkrisiProjectTitle: project.title,
        subprojectId: realSubprojectId, // Χρησιμοποιούμε το πραγματικό UUID
        projectId: realProjectId, // Χρησιμοποιούμε το σωστό projectId
        subprojectTitle: subproject.title,
        manual: true
      };

      const result = await ipcRenderer.invoke('create-manual-egkrisi-link', linkData);

      if (result.success) {
        // Ενημέρωση του local state με το σωστό κλειδί
        setLinkedSubprojects(prev => ({
          ...prev,
          [result.linkData.egkrisiId]: result.linkData
        }));
        
        alert('✅ Η συσχέτιση εγκρίσεως με το υποέργο δημιουργήθηκε επιτυχώς!');
        
        // Ανανέωση των δεδομένων
        if (onLinkCreated) {
          onLinkCreated();
        }
      } else {
        alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating manual egkrisi link:', error);
      alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + error.message);
    }
  };

  const performLink = async (subprojectId, subproject, project) => {
    try {
      // Βρίσκουμε το σωστό projectId από το subprojectId
      const realProjectId = await ipcRenderer.invoke('find-project-by-subproject-id', subprojectId);
      
      if (!realProjectId) {
        alert('❌ Δεν βρέθηκε το έργο για το υποέργο');
        return;
      }
      
      const linkData = {
        egkrisiProjectKey: project.projectId,
        egkrisiSubprojectKey: subproject.number,
        egkrisiTitle: subproject.title,
        egkrisiProjectTitle: project.title,
        subprojectId: subprojectId,
        projectId: realProjectId,
        subprojectTitle: subproject.title,
        manual: true
      };

      const result = await ipcRenderer.invoke('create-manual-egkrisi-link', linkData);

      if (result.success) {
        // Ενημέρωση του local state με το σωστό κλειδί
        setLinkedSubprojects(prev => ({
          ...prev,
          [result.linkData.egkrisiId]: result.linkData
        }));
        
        alert('✅ Η συσχέτιση εγκρίσεως με το υποέργο δημιουργήθηκε επιτυχώς!');
        
        // Ανανέωση των δεδομένων
        if (onLinkCreated) {
          onLinkCreated();
        }
      } else {
        alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + result.error);
      }
    } catch (error) {
      console.error('Error performing link:', error);
      alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης');
    }
  };

  const handleSearchModalSelect = async (selectedSubproject) => {
    if (currentSubprojectForLink) {
      await performLink(selectedSubproject.subprojectId, currentSubprojectForLink.subproject, currentSubprojectForLink.project);
    }
  };

  const handleUnlinkSubproject = async (subproject, project) => {
    try {
      console.log('🔓 Unlinking subproject:', { subproject, project });
      
      // Βρίσκουμε το link που θέλουμε να ακυρώσουμε
      const linkToRemove = Object.values(linkedSubprojects).find(link => 
        link && link.egkrisiTitle && link.egkrisiTitle === subproject.title
      );
      
      if (!linkToRemove) {
        alert('❌ Δεν βρέθηκε συσχέτιση για ακύρωση');
        return;
      }
      
      // Επιβεβαίωση από τον χρήστη
      const confirmed = window.confirm(
        `Είστε σίγουροι ότι θέλετε να ακυρώσετε τη συσχέτιση με το υποέργο "${subproject.title}";\n\n` +
        `Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`
      );
      
      if (!confirmed) {
        return;
      }
      
      // Καλούμε το IPC handler για ακύρωση συσχέτισης
      const result = await ipcRenderer.invoke('delete-egkrisi-link', linkToRemove.egkrisiId);
      
      if (result.success) {
        // Αφαιρούμε το link από το local state
        setLinkedSubprojects(prev => {
          const newState = { ...prev };
          delete newState[linkToRemove.egkrisiId];
          return newState;
        });
        
        // Ενημέρωση του parent component
        if (onLinkCreated) {
          onLinkCreated();
        }
        
        alert('✅ Η συσχέτιση ακυρώθηκε επιτυχώς!');
        console.log('Removed link:', linkToRemove.egkrisiId);
      } else {
        alert('Σφάλμα κατά την ακύρωση συσχέτισης: ' + result.error);
      }
    } catch (error) {
      console.error('Error unlinking subproject:', error);
      alert('Σφάλμα κατά την ακύρωση συσχέτισης');
    }
  };

  const handleSubprojectLinked = async (linkedSubproject) => {
    if (!currentLinkingSubproject) return;

    try {
      // Save the link between subproject and another subproject
      const result = await ipcRenderer.invoke('link-subproject-to-subproject', {
        sourceSubprojectId: currentLinkingSubproject.number,
        sourceProjectId: currentLinkingSubproject.projectId,
        targetSubprojectId: linkedSubproject.subprojectId,
        targetProjectId: linkedSubproject.projectId
      });

      if (result.success) {
        // Update local state
        setLinkedSubprojects(prev => ({
          ...prev,
          [currentLinkingSubproject.number]: linkedSubproject
        }));
        alert('Η συσχέτιση με το υποέργο δημιουργήθηκε επιτυχώς!');
        console.log('Updated linkedSubprojects:', { [currentLinkingSubproject.number]: linkedSubproject });
      } else {
        alert('Σφάλμα κατά τη συσχέτιση: ' + result.error);
      }
    } catch (error) {
      console.error('Error linking subproject:', error);
      alert('Σφάλμα κατά τη συσχέτιση');
    }
  };


  const toggleModificationsDropdown = useCallback((projectIndex) => {
    setOpenModificationsDropdown(openModificationsDropdown === projectIndex ? null : projectIndex);
  }, [openModificationsDropdown]);



  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>Εγκρίσεις Διάθεσης Πίστωσης</ModalTitle>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {canManageWorkflow && (
              <EditButton type="button" onClick={onOpenForm}>
                <span>✏️</span>
                Επεξεργασία/Δημιουργία
              </EditButton>
            )}
            <CloseButton type="button" onClick={onClose}>Κλείσιμο</CloseButton>
          </div>
        </ModalHeader>

        <ModalContent>
          <SearchAndFiltersContainer>
            <SearchBar>
              <SearchInput
                type="text"
                placeholder="Αναζήτηση βάσει τίτλου έργου..."
                value={projectSearchTerm}
                onChange={(e) => setProjectSearchTerm(e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση βάσει τίτλου υποέργου..."
                value={subprojectSearchTerm}
                onChange={(e) => setSubprojectSearchTerm(e.target.value)}
              />
            </SearchBar>

            {egkriseisData && egkriseisData.metadata && (
              <StatsContainer>
                <StatCard>
                  <StatIcon>📋</StatIcon>
                  <StatText>Σύνολο Έργων</StatText>
                  <StatNumber>{egkriseisData.metadata?.totalProjects ?? 0}</StatNumber>
                </StatCard>
                <StatCard>
                  <StatIcon>📂</StatIcon>
                  <StatText>Υποέργα</StatText>
                  <StatNumber>{egkriseisData.metadata?.totalSubprojects ?? 0}</StatNumber>
                </StatCard>
              </StatsContainer>
            )}
          </SearchAndFiltersContainer>

          <ProjectsContainer>
            {loading ? (
              <LoadingSpinner>Φόρτωση δεδομένων...</LoadingSpinner>
            ) : paginationData.currentProjects.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>📁</EmptyStateIcon>
                <EmptyStateText>Δεν βρέθηκαν έργα</EmptyStateText>
                <EmptyStateSubtext>
                  {(projectSearchTerm || subprojectSearchTerm) ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης' : 'Δεν υπάρχουν δεδομένα εγκρίσεων'}
                </EmptyStateSubtext>
              </EmptyState>
            ) : (
              <>
                {paginationData.currentProjects.map((project, projectIndex) => (
                <ProjectSection key={projectIndex}>
                  <ProjectHeader>
                    <ProjectTitle>{project.title}</ProjectTitle>
                    {project.modifications && project.modifications.length > 0 && (
                      <>
                        <ModificationsBadge onClick={() => toggleModificationsDropdown(projectIndex)}>
                          📝 Τροποποιήσεις ({project.modifications.length})
                        </ModificationsBadge>
                        {openModificationsDropdown === projectIndex && (
                          <ModificationsDropdown>
                            <ModificationsTitle>Τροποποιήσεις Έργου</ModificationsTitle>
                            <PdfsGrid>
                              {project.modifications.map((pdf, pdfIndex) => (
                                <PdfGroup key={pdfIndex}>
                                  <PdfItem>
                                    📄 <span style={{ color: '#1e293b', fontWeight: '800', fontSize: '0.8rem' }}>{pdf}</span>
                                  </PdfItem>
                                  <PdfActions>
                                    <ViewButton
                                      onClick={() => handleViewPdf(project.folderName, pdf)}
                                    >
                                      Προβολή
                                    </ViewButton>
                                    <DownloadButton
                                      onClick={() => handleDownloadPdf(project.folderName, pdf)}
                                    >
                                      Λήψη
                                    </DownloadButton>
                                  </PdfActions>
                                </PdfGroup>
                              ))}
                            </PdfsGrid>
                          </ModificationsDropdown>
                        )}
                      </>
                    )}
                  </ProjectHeader>

                  <SubprojectsList>
                    {/* Show subprojects */}
                    {Object.values(project.subprojects || {}).map((subproject, subIndex) => (
                      <SubprojectItem key={subIndex} index={subIndex}>
                        <SubprojectInfo>
                          <SubprojectHeader>
                            <SubprojectNumber>#{subproject.number}</SubprojectNumber>
                            <SubprojectTitle>{subproject.title}</SubprojectTitle>
                            {canManageWorkflow && (
                              <SubprojectHeaderActions>
                                {linkedSubprojects && Object.values(linkedSubprojects).some(link => 
                                  link && link.egkrisiTitle && link.egkrisiTitle === subproject.title
                                ) ? (
                                  <>
                                    <ViewButton
                                      disabled
                                      style={{ 
                                        background: '#f1f5f9', 
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        marginLeft: '0.5rem', 
                                        fontSize: '0.72rem', 
                                        padding: '0.35rem 0.75rem',
                                        cursor: 'not-allowed',
                                        opacity: 0.85,
                                        flex: '0 0 auto',
                                        boxShadow: 'none'
                                      }}
                                    >
                                      🔗 ΣΥΣΧΕΤΙΣΗ ΜΕ ΥΠΟΕΡΓΟ
                                    </ViewButton>
                                    <ViewButton
                                      onClick={() => handleUnlinkSubproject(subproject, project)}
                                      style={{ 
                                        background: '#ffffff', 
                                        color: '#991b1b',
                                        border: '1px solid #fecaca',
                                        marginLeft: '0.5rem', 
                                        fontSize: '0.72rem', 
                                        padding: '0.35rem 0.75rem',
                                        flex: '0 0 auto',
                                        boxShadow: 'none'
                                      }}
                                    >
                                      ❌ ΑΚΥΡΩΣΗ ΣΥΣΧΕΤΙΣΗΣ
                                    </ViewButton>
                                    <LinkedStatus>
                                      ΣΥΣΧΕΤΙΣΜΕΝΟ ΜΕ ΕΡΓΟ
                                    </LinkedStatus>
                                  </>
                                ) : (
                                  <ViewButton
                                    onClick={() => handleLinkSubproject(subproject, project)}
                                    style={{
                                      background: '#ffffff',
                                      color: '#4338ca',
                                      border: '1px solid #a5b4fc',
                                      marginLeft: '0.5rem',
                                      fontSize: '0.72rem',
                                      padding: '0.35rem 0.75rem',
                                      flex: '0 0 auto',
                                      boxShadow: 'none'
                                    }}
                                  >
                                    🔗 ΣΥΣΧΕΤΙΣΗ ΜΕ ΥΠΟΕΡΓΟ
                                  </ViewButton>
                                )}
                              </SubprojectHeaderActions>
                            )}
                          </SubprojectHeader>
                          
                          {subproject.pdfs.length > 0 && (
                            <PdfsGrid>
                              {subproject.pdfs.map((pdf, pdfIndex) => (
                                <PdfGroup key={pdfIndex}>
                                  <PdfItem>
                                    📄 <span style={{ color: '#1e293b', fontWeight: '800', fontSize: '0.8rem' }}>{pdf}</span>
                                  </PdfItem>
                                  <PdfActions>
                                    <ViewButton
                                      onClick={() => handleViewPdf(project.folderName, pdf)}
                                    >
                                      Προβολή
                                    </ViewButton>
                                    <DownloadButton
                                      onClick={() => handleDownloadPdf(project.folderName, pdf)}
                                    >
                                      Λήψη
                                    </DownloadButton>
                                  </PdfActions>
                                </PdfGroup>
                              ))}
                            </PdfsGrid>
                          )}
                        </SubprojectInfo>
                      </SubprojectItem>
                    ))}
                  </SubprojectsList>
                </ProjectSection>
                ))}
                
                {/* Pagination */}
                {paginationData.totalPages > 1 && (
                  <PaginationContainer>
                    <PaginationButton
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      « Προηγούμενη
                    </PaginationButton>
                    
                    {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        const current = currentPage;
                        const total = paginationData.totalPages;
                        return page === 1 || page === total || (page >= current - 1 && page <= current + 1);
                      })
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && <span>...</span>}
                          <PaginationButton
                            active={page === currentPage}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </PaginationButton>
                        </React.Fragment>
                      ))}
                    
                    <PaginationButton
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === paginationData.totalPages}
                    >
                      Επόμενη »
                    </PaginationButton>
                    
                    <PaginationInfo>
                      {paginationData.startIndex + 1}-{Math.min(paginationData.endIndex, paginationData.totalItems)} από {paginationData.totalItems} έργα
                    </PaginationInfo>
                  </PaginationContainer>
                )}
              </>
            )}
          </ProjectsContainer>
        </ModalContent>
        
        {/* Subproject Linking Modal */}
        {isLinkingModalOpen && (
          <SubprojectLinkingModal
            isOpen={isLinkingModalOpen}
            onClose={() => {
              setIsLinkingModalOpen(false);
              setCurrentLinkingSubproject(null);
            }}
            onLink={handleSubprojectLinked}
            currentEgkrisi={currentLinkingSubproject}
          />
        )}

        {/* Subproject Search Modal */}
        <SubprojectSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => {
            setIsSearchModalOpen(false);
            setCurrentSubprojectForLink(null);
          }}
          onSelectSubproject={handleSearchModalSelect}
          egkrisiTitle={currentSubprojectForLink?.subproject?.title}
        />
      </ModalContainer>
    </ModalOverlay>
  );
}

export default EgkriseisCreditApprovalViewer;
