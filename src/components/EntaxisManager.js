import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import EntaxisForm from './EntaxisForm';
import ModificationForm from './ModificationForm';
import EntaxisExportDialog from './EntaxisExportDialog';
import EntaxisFileViewer from './EntaxisFileViewer';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;
const path = require('path-browserify');

const EntaxisOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 2rem;
  overflow-y: auto;
`;

const EntaxisContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 3rem;
  max-width: 1200px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid #dee2e6;
  margin-top: 2rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 3px solid #e9ecef;
`;

const Title = styled.h2`
  color: #333;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &::before {
    content: "🏛️";
    font-size: 1.5rem;
  }
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  &:hover {
    background: #c82333;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const QuickSearchInput = styled.input`
  flex: 1;
  max-width: 300px;
  min-width: 200px;
  padding: 0.8rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.3s ease;
  
  &:focus {
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
  }
  
  &::placeholder {
    color: #6c757d;
    font-style: italic;
  }
`;

const SearchBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 12px;
  border: 1px solid #bbdefb;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 0.8rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #6c757d;
  }
`;


const DateInput = styled.input`
  padding: 0.8rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const SearchButton = styled.button`
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #667eea 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
`;

const ClearButton = styled.button`
  padding: 0.8rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #545b62;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  background: #fff;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;

  &:hover {
    border-color: #4facfe;
    background: #f8f9ff;
  }

  input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
  }

  label {
    margin: 0;
    cursor: pointer;
    font-size: 0.9rem;
    color: #495057;
    font-weight: 500;
  }
`;

const ExportButton = styled.button`
  padding: 0.8rem 1.5rem;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: linear-gradient(135deg, #20c997 0%, #17a2b8 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }
`;

const SearchStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1rem;
  background: linear-gradient(135deg, rgba(52, 144, 220, 0.08) 0%, rgba(116, 185, 255, 0.08) 100%);
  border-radius: 12px;
  font-size: 0.85rem;
  color: #2c3e50;
  border: 1px solid rgba(52, 144, 220, 0.15);
  backdrop-filter: blur(10px);
  
  .stats-section {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 500;
    
    .stat-icon {
      font-size: 0.9rem;
      opacity: 0.7;
    }
    
    .stat-number {
      color: #3490dc;
      font-weight: 600;
    }
    
    .stat-label {
      color: #6c757d;
      font-weight: 400;
    }
  }
  
  .filters-badge {
    background: linear-gradient(135deg, #ff6b6b, #ee5a52);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    
    .filter-icon {
      font-size: 0.8rem;
    }
  }
`;


const ActionButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    &:hover {
      background: linear-gradient(135deg, #5a67d8 0%, #667eea 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
  `}
`;

const EntaxisContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`;

const NoEntaxisMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  font-size: 1.1rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #dee2e6;
`;

const ProjectGroup = styled.div`
  margin-bottom: 2rem;
  border: 2px solid ${props => props.isUnlinked ? '#dc3545' : '#e9ecef'};
  border-radius: 12px;
  background: ${props => props.isUnlinked ? '#fff5f5' : '#f8f9fa'};
  overflow: hidden;
`;

const ProjectHeader = styled.div`
  background: ${props => props.isUnlinked 
    ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: white;
  padding: 1rem 1.5rem;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "📋";
    font-size: 1.2rem;
  }
`;

const EntaxisList = styled.div`
  padding: 1rem;
`;

const EntaxisItem = styled.div`
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
  position: relative;
  opacity: ${props => props.isLocked ? 0.7 : 1};
`;

const LockIndicator = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.isLocked ? '#dc3545' : '#28a745'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
`;

const EntaxisHeader = styled.div`
  background: ${props => props.isMain ? '#e3f2fd' : '#fff3e0'};
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
`;

const EntaxisInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  flex: 1;
`;

const EntaxisTitle = styled.div`
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;

  &::before {
    content: ${props => props.isMain ? '"📄"' : '"⚡"'};
    font-size: 1rem;
  }
`;

const EntaxisSubject = styled.div`
  font-size: 1.15rem;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.4;
  padding: 0.8rem;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border-left: 4px solid #667eea;
  border-radius: 6px;
  margin: 0.3rem 0;
`;

const EntaxisMetadata = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.6rem;
  margin-top: 0.5rem;
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  padding: 0.4rem 0;
  
  .icon {
    font-size: 1rem;
    opacity: 0.8;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }
  
  .label {
    color: #6c757d;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .value {
    color: #2c3e50;
    font-weight: 600;
    word-break: break-word;
    line-height: 1.4;
  }
`;

const EntaxisDetails = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
`;

const EntaxisAmount = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.positive ? '#28a745' : props.negative ? '#dc3545' : '#2196F3'};
`;

const EntaxisActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;


const SmallButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &:active {
    transform: translateY(0);
  }

  ${props => {
    if (props.view) return `
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #3730a3 0%, #312e81 100%);
      }
    `;
    if (props.edit) return `
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #047857 0%, #065f46 100%);
      }
    `;
    if (props.delete) return `
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
      }
    `;
    return `
      background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
      }
    `;
  }}
`;

const ModificationsList = styled.div`
  padding: 1rem 1.5rem;
`;

const ModificationItem = styled.div`
  background: #fff8e1;
  border: 1px solid #ffecb3;
  border-radius: 6px;
  padding: 0.8rem;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// ΧΕΙΡΟΚΙΝΗΤΗ ΔΙΟΡΘΩΣΗ - Καλέστε από Console: fixAllEntaxeis()
window.fixAllEntaxeis = async () => {
  const ipc = window.electronAPI;
  try {
    console.log('🔧 Loading all entaxeis...');
    const allEntaxeis = await ipc.invoke('load-all-entaxeis');
    console.log(`📋 Found ${allEntaxeis.length} entaxeis`);
    
    for (const entaxi of allEntaxeis) {
      console.log(`🔧 Fixing ${entaxi.entaxiId}...`);
      const result = await ipc.invoke('fix-entaxi-file-objects', entaxi.entaxiId);
      console.log(`  ${result.success ? '✅' : '❌'} ${result.message || result.error}`);
    }
    
    alert('✅ Όλες οι εντάξεις διορθώθηκαν! Κάντε F5 για refresh.');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Σφάλμα: ' + error.message);
  }
};

function EntaxisManager({ isOpen, onClose, userRole, projectFilter = null, onDataChange, proskliseis = [], handleOpenProsklisi, onViewFile }) {
  const [entaxeis, setEntaxeis] = useState([]);
  const [filteredEntaxeis, setFilteredEntaxeis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [editingEntaxi, setEditingEntaxi] = useState(null);
  const [selectedEntaxiForMod, setSelectedEntaxiForMod] = useState(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [editingModification, setEditingModification] = useState(null);
  const [selectedModification, setSelectedModification] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [entaxisLocks, setEntaxisLocks] = useState({});
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedEntaxiForViewer, setSelectedEntaxiForViewer] = useState(null);
  
  // Search state
  const [searchFilters, setSearchFilters] = useState({
    subject: '',
    fundingAuthority: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: '',
    projectTitle: '',
    showUnlinkedOnly: false
  });
  
  // Quick search state
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEntaxeis();
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [entaxeis, searchFilters, projectFilter, quickSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (entaxeis.length > 0) {
      loadEntaxisLocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entaxeis]);

  // Realtime lock monitoring για entaxeis - αθόρυβο με βελτιστοποίηση
  useEffect(() => {
    let isActive = true;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      setEntaxeis(currentEntaxeis => {
        if (!currentEntaxeis || currentEntaxeis.length === 0) return currentEntaxeis;
        
        // Batch processing για καλύτερη απόδοση
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < currentEntaxeis.length; i += BATCH_SIZE) {
          batches.push(currentEntaxeis.slice(i, i + BATCH_SIZE));
        }
        
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const batchLocks = {};
            await Promise.all(
              batch.map(async (entaxi) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                  batchLocks[entaxi.entaxiId] = lockStatus.locked;
                } catch (error) {
                  setEntaxisLocks(prevLocks => {
                    batchLocks[entaxi.entaxiId] = prevLocks[entaxi.entaxiId] || false;
                    return prevLocks;
                  });
                }
              })
            );
            return batchLocks;
          })
        ).then(batchResults => {
          if (!isActive) return;
          
          const newLocks = Object.assign({}, ...batchResults);
          setEntaxisLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => 
              newLocks[id] !== prevLocks[id]
            );
            
            if (hasChanges) {
              console.log('Entaxi lock changes detected, updating silently...');
              return newLocks;
            }
            return prevLocks;
          });
        }).catch(error => {
          console.error('Error checking entaxi locks:', error);
        });
        
        return currentEntaxeis;
      });
    };
    
    // Αρχικό delay και μετά periodic check
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      checkLocks();
      
      intervalId = setInterval(() => {
        if (isActive) {
          checkLocks();
        }
      }, 8000); // Κάθε 8 δευτερόλεπτα (από 3) για μείωση φορτίου
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty deps - uses functional updates

  const loadEntaxeis = async () => {
    try {
      setLoading(true);
      const loadedEntaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      console.log('Loaded entaxeis:', loadedEntaxeis); // Debug log
      setEntaxeis(loadedEntaxeis || []);
    } catch (error) {
      console.error('Error loading entaxeis:', error);
      setEntaxeis([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadEntaxisLocks = async () => {
    try {
      const locks = {};
      for (const entaxi of entaxeis) {
        const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
        locks[entaxi.entaxiId] = lockStatus.locked || false;
      }
      setEntaxisLocks(locks);
    } catch (error) {
      console.error('Error loading entaxis locks:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...entaxeis];

    // Project filter (if provided)
    if (projectFilter) {
      filtered = filtered.filter(entaxi => 
        entaxi.projectTitle === projectFilter
      );
    }

    // Quick search filter (searches in title/subject)
    if (quickSearchTerm) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, quickSearchTerm) ||
        containsSearchTerm(entaxi.projectTitle, quickSearchTerm)
      );
    }

    // Search filters
    if (searchFilters.subject) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, searchFilters.subject)
      );
    }

    if (searchFilters.fundingAuthority) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.fundingAuthority, searchFilters.fundingAuthority)
      );
    }

    if (searchFilters.projectTitle) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.projectTitle, searchFilters.projectTitle)
      );
    }

    // Amount filters
    if (searchFilters.minAmount) {
      const minAmount = parseFloat(searchFilters.minAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount >= minAmount;
      });
    }

    if (searchFilters.maxAmount) {
      const maxAmount = parseFloat(searchFilters.maxAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount <= maxAmount;
      });
    }

    // Date filters
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filtered = filtered.filter(entaxi => {
        const entaxiDate = new Date(entaxi.documentDate);
        return entaxiDate >= fromDate;
      });
    }

    // Unlinked entaxeis filter
    if (searchFilters.showUnlinkedOnly) {
      filtered = filtered.filter(entaxi => {
        // Check if entaxi is not linked to any project
        return !entaxi.projectTitle || entaxi.projectTitle === '' || 
               (!entaxi.subprojectIds || entaxi.subprojectIds.length === 0);
      });
    }

    setFilteredEntaxeis(filtered);
  };

  const handleSearchChange = (field, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchFilters({
      subject: '',
      fundingAuthority: '',
      minAmount: '',
      maxAmount: '',
      dateFrom: '',
      projectTitle: '',
      showUnlinkedOnly: false
    });
    setQuickSearchTerm('');
  };

  // Συνάρτηση για κλείσιμο του modal με καθαρισμό φίλτρων
  const handleClose = () => {
    clearFilters(); // Καθαρισμός όλων των φίλτρων
    onClose(); // Κλείσιμο του modal
  };

  const getActiveFiltersCount = () => {
    return Object.entries(searchFilters).filter(([key, value]) => {
      if (key === 'showUnlinkedOnly') {
        return value === true;
      }
      return value !== '';
    }).length;
  };

  const handleSaveEntaxi = async (entaxiData) => {
    try {
      await ipcRenderer.invoke('save-entaxi', entaxiData);
      
      // Ξεκλείδωμα της ένταξης μετά την αποθήκευση
      if (editingEntaxi && editingEntaxi.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [editingEntaxi.entaxiId]: false
        }));
      }
      
      await loadEntaxeis();
      setIsFormOpen(false);
      setEditingEntaxi(null);
      // Ανανέωση των κυρίως έργων στο Dashboard
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error saving entaxi:', error);
    }
  };

  const handleSaveModification = async (modificationData) => {
    try {
      await ipcRenderer.invoke('save-modification', selectedEntaxiForMod.entaxiId, modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την αποθήκευση τροποποίησης
      if (selectedEntaxiForMod && selectedEntaxiForMod.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [selectedEntaxiForMod.entaxiId]: false
        }));
      }
      
      await loadEntaxeis();
      setIsModificationFormOpen(false);
      setSelectedEntaxiForMod(null);
    } catch (error) {
      console.error('Error saving modification:', error);
    }
  };

  const handleDeleteEntaxi = async (entaxiId) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την ένταξη;')) {
      try {
        await ipcRenderer.invoke('delete-entaxi', entaxiId);
        await loadEntaxeis();
        // Ανανέωση των κυρίως έργων στο Dashboard
        if (onDataChange) {
          onDataChange();
        }
      } catch (error) {
        console.error('Error deleting entaxi:', error);
      }
    }
  };

  const handleViewFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      console.log('Viewing file:', { entaxiId, actualFileName, originalFileName: fileName });
      
      // Use the same method as proskliseis - direct file opening
      await ipcRenderer.invoke('view-entaxi-file', entaxiId, actualFileName);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα κατά την προβολή του αρχείου: ' + error.message);
    }
  };

  const handleOpenFileViewer = (entaxi) => {
    setSelectedEntaxiForViewer(entaxi);
    setFileViewerOpen(true);
  };

  const handleCloseFileViewer = () => {
    setFileViewerOpen(false);
    setSelectedEntaxiForViewer(null);
  };

  const handleDownloadFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      const result = await ipcRenderer.invoke('download-entaxi-file', entaxiId, actualFileName);
      
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

  const handleDeleteFile = async (entaxiId, fileName, isModification = false) => {
    // Handle both string and object fileName
    let actualFileName;
    if (typeof fileName === 'string') {
      actualFileName = fileName;
    } else if (fileName && typeof fileName === 'object') {
      console.log('⚠️ fileName is object, fixing entaxi first...');
      // Fix the entaxi JSON first
      const fixResult = await ipcRenderer.invoke('fix-entaxi-file-objects', entaxiId);
      console.log('🔧 Fix result:', fixResult);
      
      // Reload entaxeis to get the fixed data
      await loadEntaxeis();
      
      // Extract filename from object for display
      actualFileName = fileName.fileName || fileName.name || path.basename(fileName.filePath || '');
      alert(`Τα δεδομένα διορθώθηκαν. Παρακαλώ πατήστε Διαγραφή ξανά.`);
      return;
    } else {
      console.error('❌ Invalid fileName:', fileName);
      alert('Σφάλμα: Μη έγκυρο όνομα αρχείου');
      return;
    }
    
    console.log('🗑️ DELETE FILE REQUEST:', {
      entaxiId,
      fileName,
      actualFileName,
      isModification,
      fileNameType: typeof fileName
    });
    
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${actualFileName}";`)) {
      try {
        console.log('📤 Sending delete request to backend...');
        const result = await ipcRenderer.invoke('delete-entaxi-file', entaxiId, actualFileName, isModification);
        console.log('📥 Delete result:', result);
        
        if (result.success) {
          console.log('✅ Delete successful, reloading entaxeis...');
          await loadEntaxeis(); // Reload to update UI
          console.log('✅ Entaxeis reloaded');
          alert('Το αρχείο διαγράφηκε επιτυχώς!');
        } else {
          console.error('❌ Delete failed:', result.error);
          alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + result.error);
        }
      } catch (error) {
        console.error('❌ Error deleting file:', error);
        alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + error.message);
      }
    }
  };

  const handleEditModification = (modification, parentEntaxi) => {
    setEditingModification({
      ...modification,
      entaxiId: parentEntaxi.entaxiId,
      subject: parentEntaxi.subject,
      fundingAuthority: parentEntaxi.fundingAuthority,
      initialAmount: parentEntaxi.initialAmount
    });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (entaxiId, modificationId) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;')) {
      try {
        await ipcRenderer.invoke('delete-entaxi-modification', entaxiId, modificationId);
        await loadEntaxeis(); // Reload to update UI
        alert('Η τροποποίηση διαγράφηκε επιτυχώς');
      } catch (error) {
        console.error('Error deleting modification:', error);
        alert('Σφάλμα διαγραφής τροποποίησης: ' + error.message);
      }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-entaxi-modification', modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την ενημέρωση τροποποίησης
      if (editingModification && editingModification.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingModification.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [editingModification.entaxiId]: false
        }));
      }
      
      await loadEntaxeis(); // Reload to update UI
      setEditingModification(null);
      setIsModificationFormOpen(false);
    } catch (error) {
      console.error('Error updating modification:', error);
      alert('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message);
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00';
    return amount.toString().replace(/\./g, ',');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getProsklisiTitle = (prosklisiId) => {
    const prosklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    return prosklisi ? prosklisi.title : 'Άγνωστη πρόσκληση';
  };

  const calculateCumulativeAmount = (entaxi) => {
    let total = parseFloat((entaxi.initialAmount || '0').replace(/\./g, '').replace(',', '.')) || 0;

    if (entaxi.modifications && Array.isArray(entaxi.modifications)) {
      entaxi.modifications.forEach((mod) => {
        const rawAmount = (mod.amount || '0').replace(/[^\d,.+-]/g, '').replace(/\./g, '').replace(',', '.');
        const modAmount = parseFloat(rawAmount) || 0;

        // Αν η τροποποίηση είναι απόλυτου ποσού (mod.changeAmount true) αντικαθιστούμε το σύνολο
        // Διαφορετικά, θεωρούμε ότι είναι μεταβολή (delta) και το προσθέτουμε στο σύνολο
        if (mod.changeAmount) {
          total = modAmount;
        } else {
          total += modAmount;
        }
      });
    }

    return total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group filtered entaxeis by project
  const groupedEntaxeis = filteredEntaxeis.reduce((groups, entaxi) => {
    const key = entaxi.projectTitle || 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entaxi);
    return groups;
  }, {});

  // Debug log
  console.log('entaxeis array:', entaxeis);
  console.log('filteredEntaxeis:', filteredEntaxeis);
  console.log('groupedEntaxeis:', groupedEntaxeis);
  console.log('projectFilter:', projectFilter);

  if (!isOpen) return null;

  return (
    <EntaxisOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <EntaxisContainer>
        <Header>
          <Title>Εντάξεις Έργων</Title>
          <CloseButton onClick={handleClose}>Κλείσιμο</CloseButton>
        </Header>

        <ActionsBar>
          {userRole !== 'USER' && (
            <ActionButton 
              primary 
              onClick={() => {
                setEditingEntaxi(null);
                setIsFormOpen(true);
              }}
            >
              ➕ Νέα Ένταξη
            </ActionButton>
          )}
          <ExportButton onClick={() => setIsExportDialogOpen(true)}>
            📊 Εξαγωγή σε Excel
          </ExportButton>
          <QuickSearchInput
            type="text"
            placeholder="🔍 Γρήγορη αναζήτηση τίτλου ένταξης..."
            value={quickSearchTerm}
            onChange={(e) => setQuickSearchTerm(e.target.value)}
          />
          <ExportButton 
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            style={{ 
              background: showAdvancedSearch 
                ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)' 
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
            }}
          >
            🔍 {showAdvancedSearch ? 'ΑΠΟΚΡΥΨΗ ΦΙΛΤΡΩΝ' : 'ΣΥΝΘΕΤΗ ΑΝΑΖΗΤΗΣΗ'}
          </ExportButton>
        </ActionsBar>

        {/* Στατιστικά - Εμφανίζονται πάντα */}
        <SearchStats>
          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-icon">📊</span>
              <span className="stat-label">Συνολικά:</span>
              <span className="stat-number">{entaxeis.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🔗</span>
              <span className="stat-label">Συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => e.projectTitle && e.projectTitle.trim() !== '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">❌</span>
              <span className="stat-label">Μη συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => !e.projectTitle || e.projectTitle.trim() === '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">📅</span>
              <span className="stat-label">{new Date().getFullYear()}:</span>
              <span className="stat-number">{entaxeis.filter(e => {
                if (!e.documentDate) return false;
                const entaxiYear = new Date(e.documentDate).getFullYear();
                return entaxiYear === new Date().getFullYear();
              }).length}</span>
            </div>
          </div>
          <div>
            {getActiveFiltersCount() > 0 && (
              <div className="filters-badge">
                <span className="filter-icon">🔧</span>
                <span>Φίλτρα: {getActiveFiltersCount()}</span>
              </div>
            )}
          </div>
        </SearchStats>

        {showAdvancedSearch && (
          <SearchBar>
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά θέμα..."
                value={searchFilters.subject}
                onChange={(e) => handleSearchChange('subject', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά φορέα χρηματοδότησης..."
                value={searchFilters.fundingAuthority}
                onChange={(e) => handleSearchChange('fundingAuthority', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά τίτλο έργου..."
                value={searchFilters.projectTitle}
                onChange={(e) => handleSearchChange('projectTitle', e.target.value)}
              />
            </SearchRow>
            
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Ελάχιστο ποσό (€)..."
                value={searchFilters.minAmount}
                onChange={(e) => handleSearchChange('minAmount', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Μέγιστο ποσό (€)..."
                value={searchFilters.maxAmount}
                onChange={(e) => handleSearchChange('maxAmount', e.target.value)}
              />
              <DateInput
                type="date"
                placeholder="Από ημερομηνία..."
                value={searchFilters.dateFrom}
                onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
              />
              <SearchButton onClick={() => applyFilters()}>
                🔍 Αναζήτηση
              </SearchButton>
              <ClearButton onClick={clearFilters}>
                🗑️ Καθαρισμός
              </ClearButton>
            </SearchRow>

            <SearchRow>
              <CheckboxContainer 
                onClick={() => handleSearchChange('showUnlinkedOnly', !searchFilters.showUnlinkedOnly)}
              >
                <input
                  type="checkbox"
                  checked={searchFilters.showUnlinkedOnly}
                  onChange={(e) => handleSearchChange('showUnlinkedOnly', e.target.checked)}
                />
                <label>Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο</label>
              </CheckboxContainer>
            </SearchRow>
          </SearchBar>
        )}

        <EntaxisContent>
          {loading ? (
            <NoEntaxisMessage>
              Φόρτωση εντάξεων...
            </NoEntaxisMessage>
          ) : filteredEntaxeis.length === 0 || Object.keys(groupedEntaxeis).length === 0 ? (
            <NoEntaxisMessage>
              {projectFilter 
                ? `Δεν βρέθηκαν εντάξεις για το έργο "${projectFilter}".`
                : "Δεν βρέθηκαν εντάξεις έργων."
              }
              {userRole !== 'USER' && !projectFilter && (
                <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  Πατήστε "Νέα Ένταξη" για να προσθέσετε την πρώτη ένταξη.
                </div>
              )}
            </NoEntaxisMessage>
          ) : (
            Object.entries(groupedEntaxeis)
              .sort(([a], [b]) => {
                // Ταξινόμηση: οι μη συσχετισμένες εντάξεις πρώτα
                const aIsUnlinked = a === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                const bIsUnlinked = b === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                if (aIsUnlinked && !bIsUnlinked) return -1;
                if (!aIsUnlinked && bIsUnlinked) return 1;
                return a.localeCompare(b);
              })
              .map(([projectTitle, projectEntaxeis]) => {
                const isUnlinked = projectTitle === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                return (
                  <ProjectGroup key={projectTitle} isUnlinked={isUnlinked}>
                    <ProjectHeader isUnlinked={isUnlinked}>{projectTitle}</ProjectHeader>
                <EntaxisList>
                  {projectEntaxeis.map(entaxi => (
                    <EntaxisItem 
                      key={entaxi.entaxiId}
                      isLocked={entaxisLocks[entaxi.entaxiId]}
                    >
                      <LockIndicator isLocked={entaxisLocks[entaxi.entaxiId]}>
                        {entaxisLocks[entaxi.entaxiId] ? '🔒' : '🔓'}
                      </LockIndicator>
                      <EntaxisHeader isMain>
                        <EntaxisInfo>
                          <EntaxisTitle isMain>
                            Αρχική Ένταξη
                          </EntaxisTitle>
                          
                          {/* ΘΕΜΑ ΕΝΤΑΞΗΣ - ΚΥΡΙΟ ΣΤΟΙΧΕΙΟ */}
                          <EntaxisSubject>
                            {entaxi.subject}
                          </EntaxisSubject>
                          
                          {/* METADATA ΣΕ GRID */}
                          <EntaxisMetadata>
                            <MetadataItem>
                              <span className="icon">📅</span>
                              <span className="label">Ημερομηνία:</span>
                              <span className="value">{formatDate(entaxi.documentDate)}</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">🏛️</span>
                              <span className="label">Φορέας Χρημ/σης:</span>
                              <span className="value">{entaxi.fundingAuthority}</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">💰</span>
                              <span className="label">Ποσό Ένταξης:</span>
                              <span className="value">{formatAmount(entaxi.initialAmount)} €</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">📊</span>
                              <span className="label">Διαμορφωθέν Ποσό:</span>
                              <span className="value" style={{ color: '#4CAF50', fontWeight: '700' }}>
                                {calculateCumulativeAmount(entaxi)} €
                              </span>
                            </MetadataItem>
                          </EntaxisMetadata>
                          
                          {/* ΣΧΟΛΙΑ */}
                          {entaxi.comments && entaxi.comments.trim() !== '' && (
                            <EntaxisDetails style={{ 
                              marginTop: '0.8rem',
                              padding: '0.6rem 0.8rem',
                              background: 'rgba(255, 193, 7, 0.1)',
                              borderLeft: '3px solid #ffc107',
                              borderRadius: '4px',
                              fontSize: '0.9rem',
                              lineHeight: '1.5'
                            }}>
                              <span style={{ fontWeight: '600', color: '#856404' }}>💬 Σχόλια:</span>
                              <span style={{ marginLeft: '0.5rem', color: '#2c3e50' }}>
                                {entaxi.comments}
                              </span>
                            </EntaxisDetails>
                          )}
                          
                          {/* ΣΥΣΧΕΤΙΣΗ ΜΕ ΠΡΟΣΚΛΗΣΗ */}
                          {entaxi.prosklisiId && (
                            <EntaxisDetails style={{ marginTop: '0.5rem' }}>
                              🔗 Συσχετισμένη πρόσκληση: 
                              <span 
                                style={{ 
                                  color: '#007bff', 
                                  cursor: 'pointer', 
                                  textDecoration: 'underline',
                                  marginLeft: '0.5rem',
                                  fontWeight: '600'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (handleOpenProsklisi) {
                                    // Κλείσιμο του modal εντάξεων πρώτα
                                    onClose();
                                    // Μικρή καθυστέρηση για να κλείσει το modal
                                    setTimeout(() => {
                                      handleOpenProsklisi(entaxi.prosklisiId);
                                    }, 300);
                                  }
                                }}
                              >
                                {getProsklisiTitle(entaxi.prosklisiId)}
                              </span>
                            </EntaxisDetails>
                          )}
                        </EntaxisInfo>
                        
                        {/* ACTIONS SIDEBAR */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '0.6rem',
                          minWidth: '200px'
                        }}>
                          {/* ΚΟΥΜΠΙ ΠΡΟΒΟΛΗΣ ΑΡΧΕΙΩΝ */}
                          <SmallButton 
                            view
                            onClick={() => handleOpenFileViewer(entaxi)}
                            style={{ 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              width: '100%'
                            }}
                          >
                            📄 Προβολή Αρχείων
                          </SmallButton>

                          {/* ΕΝΕΡΓΕΙΕΣ ΔΙΑΧΕΙΡΙΣΗΣ */}
                          {userRole !== 'USER' && (
                            <>
                              <SmallButton 
                                onClick={async () => {
                                  // Έλεγχος αν η ένταξη είναι κλειδωμένη
                                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (lockStatus.locked) {
                                    alert('Η ένταξη είναι υπό επεξεργασία από άλλον διαχειριστή!');
                                    return;
                                  }

                                  // Δημιουργία lock για την ένταξη
                                  const lockResult = await ipcRenderer.invoke('create-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (!lockResult.success) {
                                    alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
                                    return;
                                  }

                                  // Άμεση ενημέρωση του UI για να δείξει το lock
                                  setEntaxisLocks(prev => ({
                                    ...prev,
                                    [entaxi.entaxiId]: true
                                  }));

                                  setSelectedEntaxiForMod(entaxi);
                                  setIsModificationFormOpen(true);
                                }}
                                style={{ width: '100%' }}
                              >
                                ⚡ Νέα Τροποποίηση
                              </SmallButton>
                              <SmallButton 
                                edit 
                                onClick={async () => {
                                  // Έλεγχος αν η ένταξη είναι κλειδωμένη
                                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (lockStatus.locked) {
                                    alert('Η ένταξη είναι υπό επεξεργασία από άλλον διαχειριστή!');
                                    return;
                                  }

                                  // Δημιουργία lock για την ένταξη
                                  const lockResult = await ipcRenderer.invoke('create-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (!lockResult.success) {
                                    alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
                                    return;
                                  }

                                  // Άμεση ενημέρωση του UI για να δείξει το lock
                                  setEntaxisLocks(prev => ({
                                    ...prev,
                                    [entaxi.entaxiId]: true
                                  }));

                                  setEditingEntaxi(entaxi);
                                  setIsFormOpen(true);
                                }}
                                style={{ width: '100%' }}
                              >
                                ✏️ Επεξεργασία
                              </SmallButton>
                              <SmallButton 
                                delete 
                                onClick={() => handleDeleteEntaxi(entaxi.entaxiId)}
                                style={{ width: '100%' }}
                              >
                                🗑️ Διαγραφή
                              </SmallButton>
                            </>
                          )}
                        </div>
                      </EntaxisHeader>

                      {entaxi.modifications && entaxi.modifications.length > 0 && (
                        <ModificationsList>
                          {entaxi.modifications.map((mod, index) => (
                            <ModificationItem key={mod.modificationId || index}>
                              <div>
                                <EntaxisTitle>
                                  {index + 1}η Τροποποίηση
                                </EntaxisTitle>
                                <EntaxisDetails>
                                  📅 {formatDate(mod.date)} | 📝 {mod.comments ? (mod.comments.length > 50 ? mod.comments.substring(0, 50) + '...' : mod.comments) : 'Χωρίς σχόλια'}
                                  {mod.comments && mod.comments.length > 50 && (
                                    <button 
                                      onClick={() => setSelectedModification(mod)}
                                      style={{
                                        background: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0.2rem 0.5rem',
                                        fontSize: '0.7rem',
                                        marginLeft: '0.5rem',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Δες περισσότερα
                                    </button>
                                  )}
                                </EntaxisDetails>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <EntaxisAmount 
                                  positive={mod.amount.includes('+')} 
                                  negative={mod.amount.includes('-')}
                                >
                                  {formatAmount(mod.amount)} €
                                </EntaxisAmount>
                                <EntaxisActions style={{ marginTop: '0.3rem' }}>
                                  {mod.modificationPDF && (
                                    <>
                                      <SmallButton 
                                        view 
                                        onClick={() => handleViewFile(entaxi.entaxiId, mod.modificationPDF)}
                                      >
                                        👁️ Τροποποίηση
                                      </SmallButton>
                                      <SmallButton 
                                        onClick={() => handleDownloadFile(entaxi.entaxiId, mod.modificationPDF)}
                                      >
                                        📥 Λήψη
                                      </SmallButton>
                                      {userRole !== 'USER' && (
                                        <>
                                          <SmallButton 
                                            edit 
                                            onClick={() => handleEditModification(mod, entaxi)}
                                          >
                                            ✏️ Επεξεργασία
                                          </SmallButton>
                                          <SmallButton 
                                            delete 
                                            onClick={() => handleDeleteModification(entaxi.entaxiId, mod.modificationId)}
                                          >
                                            🗑️ Διαγραφή
                                          </SmallButton>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {mod.approvalPDF && (
                                    <>
                                      <SmallButton 
                                        view 
                                        onClick={() => handleViewFile(entaxi.entaxiId, mod.approvalPDF)}
                                      >
                                        📋 Αποδοχή
                                      </SmallButton>
                                      <SmallButton 
                                        onClick={() => handleDownloadFile(entaxi.entaxiId, mod.approvalPDF)}
                                      >
                                        📥 Λήψη
                                      </SmallButton>
                                      <SmallButton 
                                        delete 
                                        onClick={() => handleDeleteFile(entaxi.entaxiId, mod.approvalPDF, true)}
                                      >
                                        🗑️ Διαγραφή
                                      </SmallButton>
                                    </>
                                  )}
                                </EntaxisActions>
                              </div>
                            </ModificationItem>
                          ))}
                        </ModificationsList>
                      )}
                    </EntaxisItem>
                  ))}
                </EntaxisList>
              </ProjectGroup>
                );
              })
          )}
        </EntaxisContent>

        {/* Entaxi Form Modal */}
        <EntaxisForm
          isOpen={isFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (editingEntaxi) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [editingEntaxi.entaxiId]: false
              }));
            }
            setIsFormOpen(false);
            setEditingEntaxi(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveEntaxi}
          editingEntaxi={editingEntaxi}
        />

        {/* Modification Form Modal */}
        <ModificationForm
          isOpen={isModificationFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (selectedEntaxiForMod) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [selectedEntaxiForMod.entaxiId]: false
              }));
            }
            setIsModificationFormOpen(false);
            setSelectedEntaxiForMod(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveModification}
          entaxi={selectedEntaxiForMod}
        />

        {/* Modification Edit Modal */}
        {editingModification && (
          <ModificationForm
            isOpen={!!editingModification}
            onClose={async () => {
              // Καθάρισε όλα τα locks όταν κλείνει η φόρμα επεξεργασίας τροποποίησης
              await ipcRenderer.invoke('clear-all-locks');
              setEditingModification(null);
              // Ανανέωση για να ενημερωθεί το lock status
              await loadEntaxeis();
            }}
            onSave={handleSaveModificationEdit}
            entaxi={editingModification}
            isEditMode={true}
          />
        )}

        {/* Export Dialog Modal */}
        <EntaxisExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          entaxeis={filteredEntaxeis}
          totalEntaxeis={entaxeis.length}
        />

        {/* Comments Modal */}
        {selectedModification && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '10px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #e9ecef'
              }}>
                <h3 style={{ margin: 0, color: '#333' }}>Σχόλια Τροποποίησης</h3>
                <button
                  onClick={() => setSelectedModification(null)}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Κλείσιμο
                </button>
              </div>
              <div style={{
                fontSize: '1rem',
                lineHeight: '1.6',
                color: '#333',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedModification.comments || 'Δεν υπάρχουν σχόλια για αυτή την τροποποίηση.'}
              </div>
            </div>
          </div>
        )}
      </EntaxisContainer>

      {/* File Viewer Modal */}
      {fileViewerOpen && (
        <EntaxisFileViewer
          isOpen={fileViewerOpen}
          onClose={handleCloseFileViewer}
          entaxi={selectedEntaxiForViewer}
          userRole={userRole}
        />
      )}
    </EntaxisOverlay>
  );
}

export default EntaxisManager;
