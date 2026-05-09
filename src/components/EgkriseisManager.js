import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ImportEgkriseisWizard from './ImportEgkriseisWizard';
import EgkrisiForm from './EgkrisiForm';
import EgkriseisStructureViewer from './EgkriseisStructureViewer';
import SubprojectLinkingModal from './SubprojectLinkingModal';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 15px;
  width: 95%;
  max-width: 1400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  padding: 2rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 15px 15px 0 0;
`;

const ModalContent = styled.div`
  padding: 2rem;
`;


const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ActionBar = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
`;

const ActionButton = styled.button`
  background: ${props => props.primary ? '#3498db' : '#2ecc71'};
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.primary ? '#2980b9' : '#27ae60'};
    transform: translateY(-2px);
  }

  &:disabled {
    background: #95a5a6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 12px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const ProjectGroupsContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
`;

const ProjectGroup = styled.div`
  margin-bottom: 30px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ProjectGroupHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
`;

const ProjectTitle = styled.h3`
  color: #2c3e50;
  font-size: 20px;
  flex: 1;
`;

const SubprojectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const SubprojectCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const SubprojectHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const SubprojectInfo = styled.div`
  h4 {
    color: #34495e;
    font-size: 18px;
    margin-bottom: 5px;
  }

  p {
    color: #7f8c8d;
    font-size: 14px;
    margin: 0;
  }
`;

const EgkriseisCount = styled.span`
  background: #3498db;
  color: white;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
`;

const EgkriseisList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 15px;
`;

const EgkrisiCard = styled.div`
  background: #ecf0f1;
  border-radius: 6px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s ease;
  position: relative;
  opacity: ${props => props.isLocked ? 0.7 : 1};

  &:hover {
    background: #d5dbdb;
  }
`;

const EgkrisiLockIndicator = styled.div`
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.isLocked ? '#dc3545' : '#28a745'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
`;

const EgkrisiInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  .date {
    font-weight: bold;
    color: #2c3e50;
    font-size: 14px;
  }

  .filename {
    color: #7f8c8d;
    font-size: 12px;
    word-break: break-all;
  }

  .type {
    color: #27ae60;
    font-size: 12px;
    font-style: italic;
  }
`;

const EgkrisiActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const IconButton = styled.button`
  background: ${props => props.danger ? '#e74c3c' : '#3498db'};
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.danger ? '#c0392b' : '#2980b9'};
    transform: scale(1.05);
  }
`;

const NoResults = styled.div`
  text-align: center;
  color: #7f8c8d;
  font-size: 18px;
  padding: 40px;
`;

const LoadingMessage = styled.div`
  text-align: center;
  color: #3498db;
  font-size: 20px;
  padding: 40px;
`;

function EgkriseisManager({ isOpen, onClose, projects, userRole, onLinkCreated }) {
  const [egkriseisData, setEgkriseisData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showEgkrisiForm, setShowEgkrisiForm] = useState(false);
  const [showStructureViewer, setShowStructureViewer] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [currentLinkingEgkrisi, setCurrentLinkingEgkrisi] = useState(null);
  const [linkedSubprojects, setLinkedSubprojects] = useState({});
  const [egkriseisLocks, setEgkriseisLocks] = useState({});

  // Load egkriseis for all projects
  useEffect(() => {
    if (isOpen) {
      loadAllEgkriseis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load egkrisi links after projects are loaded
  useEffect(() => {
    if (isOpen && projects && projects.length > 0) {
      loadEgkrisiLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projects]);

  // Load egkriseis locks after egkriseis data is loaded
  useEffect(() => {
    if (Object.keys(egkriseisData).length > 0) {
      loadEgkriseisLocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egkriseisData]);

  // Realtime lock monitoring για egkriseis - αθόρυβο με βελτιστοποίηση
  useEffect(() => {
    let isActive = true;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      setEgkriseisData(currentData => {
        if (!currentData || !currentData.projects || Object.keys(currentData.projects).length === 0) {
          return currentData;
        }
        
        // Batch processing για καλύτερη απόδοση
        const allEgkrisiIds = [];
        for (const projectKey in currentData.projects) {
          const project = currentData.projects[projectKey];
          if (project.subprojects) {
            for (const subprojectKey in project.subprojects) {
              allEgkrisiIds.push(`egkrisi_${projectKey}_${subprojectKey}`);
            }
          }
        }
        
        if (allEgkrisiIds.length === 0) return currentData;
        
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < allEgkrisiIds.length; i += BATCH_SIZE) {
          batches.push(allEgkrisiIds.slice(i, i + BATCH_SIZE));
        }
        
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const batchLocks = {};
            await Promise.all(
              batch.map(async (egkrisiId) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'egkriseis', egkrisiId);
                  batchLocks[egkrisiId] = lockStatus.locked;
                } catch (error) {
                  setEgkriseisLocks(prevLocks => {
                    batchLocks[egkrisiId] = prevLocks[egkrisiId] || false;
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
          setEgkriseisLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => 
              newLocks[id] !== prevLocks[id]
            );
            
            if (hasChanges) {
              console.log('Egkriseis lock changes detected, updating silently...');
              return newLocks;
            }
            return prevLocks;
          });
        }).catch(error => {
          console.error('Error checking egkriseis locks:', error);
        });
        
        return currentData;
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
      }, 10000); // Κάθε 10 δευτερόλεπτα (από 4) για μείωση φορτίου
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty deps - uses functional updates

  const loadEgkrisiLinks = async () => {
    try {
      console.log('Loading egkrisi links...');
      const result = await ipcRenderer.invoke('load-egkrisi-links');
      console.log('Egkrisi links result:', result);
      
      if (result.success && result.data) {
        // Αντί να αποθηκεύουμε απευθείας τα links, πρέπει να φορτώσουμε τις πληροφορίες των υποέργων
        const enrichedLinks = {};
        
        console.log('Raw links data:', result.data);
        console.log('Available projects:', projects);
        
        for (const [egkrisiId, linkData] of Object.entries(result.data)) {
          // Βρίσκουμε το υποέργο από τα projects
          let subprojectInfo = null;
          
          for (const projectGroup of projects || []) {
            if (Array.isArray(projectGroup)) {
              const found = projectGroup.find(p => 
                p.subprojectId === linkData.subprojectId
              );
              if (found) {
                subprojectInfo = found;
                break;
              }
            }
          }
          
          if (subprojectInfo) {
            enrichedLinks[egkrisiId] = subprojectInfo;
          } else {
            // Αν δεν βρούμε το υποέργο, κρατάμε τα βασικά δεδομένα
            enrichedLinks[egkrisiId] = linkData;
          }
        }
        
        console.log('Enriched links:', enrichedLinks);
        setLinkedSubprojects(enrichedLinks);
      }
    } catch (error) {
      console.error('Error loading egkrisi links:', error);
    }
  };

  const loadAllEgkriseis = async () => {
    setLoading(true);
    const allEgkriseis = {};

    try {
      if (!projects || !Array.isArray(projects)) {
        console.log('No projects data available');
        setEgkriseisData(allEgkriseis);
        return;
      }

      for (const project of projects) {
        if (!project || !Array.isArray(project)) continue;
        
        const uniqueProjects = [...new Set(project.map(p => p.projectId))];
        
        for (const projectId of uniqueProjects) {
          const result = await ipcRenderer.invoke('load-project-egkriseis', projectId);
          
          if (result.success && result.egkriseis.length > 0) {
            allEgkriseis[projectId] = result.egkriseis;
          }
        }
      }
      
      setEgkriseisData(allEgkriseis);
    } catch (error) {
      console.error('Error loading egkriseis:', error);
      alert('Σφάλμα κατά τη φόρτωση των εγκρίσεων');
    } finally {
      setLoading(false);
    }
  };

  const loadEgkriseisLocks = async () => {
    try {
      const locks = {};
      // Φόρτωση locks για όλες τις εγκρίσεις
      for (const projectId in egkriseisData) {
        const projectEgkriseis = egkriseisData[projectId];
        if (projectEgkriseis && projectEgkriseis.subprojects) {
          for (const subprojectId in projectEgkriseis.subprojects) {
            const subprojectEgkriseis = projectEgkriseis.subprojects[subprojectId];
            if (subprojectEgkriseis && subprojectEgkriseis.egkriseis) {
              for (const egkrisi of subprojectEgkriseis.egkriseis) {
                const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'egkriseis', egkrisi.id);
                locks[egkrisi.id] = lockStatus.locked || false;
              }
            }
          }
        }
      }
      setEgkriseisLocks(locks);
    } catch (error) {
      console.error('Error loading egkriseis locks:', error);
    }
  };

  const viewFile = async (projectId, subprojectId, fileName) => {
    try {
      const result = await ipcRenderer.invoke('view-egkrisi-file', projectId, subprojectId, fileName);
      if (!result.success) {
        alert('Σφάλμα κατά το άνοιγμα του αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα κατά το άνοιγμα του αρχείου');
    }
  };

  const deleteEgkrisi = async (projectId, subprojectId, egkrisiId) => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την έγκριση;')) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-egkrisi-file', projectId, subprojectId, egkrisiId);
      
      if (result.success) {
        loadAllEgkriseis();
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting egkrisi:', error);
      alert('Σφάλμα κατά τη διαγραφή');
    }
  };

  const handleLinkSubproject = async (egkrisi) => {
    // Έλεγχος αν η έγκριση είναι κλειδωμένη
    const egkrisiId = `egkrisi_${egkrisi.projectKey}_${egkrisi.subprojectKey}`;
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'egkriseis', egkrisiId);
    
    if (lockStatus.locked) {
      alert('Η έγκριση είναι υπό επεξεργασία από άλλον διαχειριστή!');
      return;
    }

    // Δημιουργία lock για την έγκριση
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'egkriseis', egkrisiId);
    if (!lockResult.success) {
      alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
      return;
    }

    // Άμεση ενημέρωση του UI
    setEgkriseisLocks(prev => ({
      ...prev,
      [egkrisiId]: true
    }));

    setCurrentLinkingEgkrisi(egkrisi);
    setIsLinkingModalOpen(true);
  };

  const handleSubprojectLinked = async (subproject) => {
    if (!currentLinkingEgkrisi) return;

    try {
      // Save the link between egkrisi and subproject
      const result = await ipcRenderer.invoke('link-egkrisi-to-subproject', {
        egkrisiId: currentLinkingEgkrisi.id,
        subprojectId: subproject.subprojectId,
        projectId: subproject.projectId
      });

      if (result.success) {
        // Update local state immediately
        setLinkedSubprojects(prev => ({
          ...prev,
          [currentLinkingEgkrisi.id]: subproject
        }));
        
        // Also reload the links to ensure persistence
        await loadEgkrisiLinks();
        
        // Force reload all egkriseis to refresh the UI
        await loadAllEgkriseis();
        
        // Notify parent component about the new link
        if (onLinkCreated) {
          onLinkCreated();
        }
        
        // Ξεκλείδωμα της έγκρισης μετά την επιτυχή συσχέτιση
        const egkrisiId = `egkrisi_${currentLinkingEgkrisi.projectKey}_${currentLinkingEgkrisi.subprojectKey}`;
        await ipcRenderer.invoke('remove-entity-lock', 'egkriseis', egkrisiId);
        // Άμεση ενημέρωση του UI
        setEgkriseisLocks(prev => ({
          ...prev,
          [egkrisiId]: false
        }));
        
        // Close the linking modal
        setIsLinkingModalOpen(false);
        setCurrentLinkingEgkrisi(null);
        
        alert('Η συσχέτιση με το υποέργο δημιουργήθηκε επιτυχώς!');
      } else {
        // Ξεκλείδωμα ακόμα και σε περίπτωση σφάλματος
        const egkrisiId = `egkrisi_${currentLinkingEgkrisi.projectKey}_${currentLinkingEgkrisi.subprojectKey}`;
        await ipcRenderer.invoke('remove-entity-lock', 'egkriseis', egkrisiId);
        setEgkriseisLocks(prev => ({
          ...prev,
          [egkrisiId]: false
        }));
        
        alert('Σφάλμα κατά τη συσχέτιση: ' + result.error);
      }
    } catch (error) {
      console.error('Error linking subproject:', error);
      
      // Ξεκλείδωμα σε περίπτωση exception
      const egkrisiId = `egkrisi_${currentLinkingEgkrisi.projectKey}_${currentLinkingEgkrisi.subprojectKey}`;
      await ipcRenderer.invoke('remove-entity-lock', 'egkriseis', egkrisiId);
      setEgkriseisLocks(prev => ({
        ...prev,
        [egkrisiId]: false
      }));
      
      alert('Σφάλμα κατά τη συσχέτιση');
    }
  };

  const handleCreateApproval = async (egkrisi) => {
    if (!linkedSubprojects[egkrisi.id]) {
      alert('Παρακαλώ συσχετίστε πρώτα την έγκριση με ένα υποέργο');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('create-credit-approval', {
        egkrisiId: egkrisi.id,
        subprojectId: linkedSubprojects[egkrisi.id].subprojectId,
        projectId: linkedSubprojects[egkrisi.id].projectId
      });

      if (result.success) {
        alert('Η έγκριση διαθέσεως πίστωσης δημιουργήθηκε επιτυχώς!');
        // Refresh data
        loadAllEgkriseis();
      } else {
        alert('Σφάλμα κατά τη δημιουργία έγκρισης: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating approval:', error);
      alert('Σφάλμα κατά τη δημιουργία έγκρισης');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Χωρίς ημερομηνία';
    const date = new Date(dateString);
    return date.toLocaleDateString('el-GR');
  };

  const filterProjects = () => {
    if (!projects || !Array.isArray(projects)) return [];
    
    // Φιλτράρουμε πρώτα τα projectGroups
    let filtered = !searchTerm 
      ? projects.filter(projectGroup => 
          projectGroup && Array.isArray(projectGroup) && projectGroup.length > 0
        )
      : projects.filter(projectGroup => 
          projectGroup && Array.isArray(projectGroup) && projectGroup.length > 0 && projectGroup.some(p => {
            if (!p) return false;
            const aleCodesMatch = (p.aleCodes && Array.isArray(p.aleCodes) && 
              p.aleCodes.some(code => containsSearchTerm(code, searchTerm))) ||
              containsSearchTerm(p.aleCode, searchTerm);
            
            return containsSearchTerm(p.projectTitle, searchTerm) ||
              containsSearchTerm(p.subprojectTitle, searchTerm) ||
              containsSearchTerm(p.kaCode, searchTerm) ||
              aleCodesMatch;
          })
        );
    
    // Φιλτράρουμε duplicates υποέργων μεταξύ όλων των groups
    const seenSubprojectIds = new Set();
    filtered = filtered.map(projectGroup => {
      if (!projectGroup || !Array.isArray(projectGroup)) return projectGroup;
      
      return projectGroup.filter(subproject => {
        if (!subproject || !subproject.subprojectId) return false;
        
        if (seenSubprojectIds.has(subproject.subprojectId)) {
          return false; // Ήδη το έχουμε δείξει - skip
        }
        
        seenSubprojectIds.add(subproject.subprojectId);
        return true;
      }).filter(subproject => subproject); // Αφαίρεση null/undefined
    }).filter(projectGroup => projectGroup && projectGroup.length > 0); // Αφαίρεση κενών groups
    
    return filtered;
  };

  const getProjectEgkriseis = (projectId) => {
    return egkriseisData[projectId] || [];
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            📋 Εγκρίσεις Διάθεσης Πίστωσης
          </ModalTitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </ModalHeader>
        
        <ModalContent>
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#f0f8ff', 
            borderRadius: '8px', 
            margin: '20px 0',
            border: '2px solid #3498db',
            textAlign: 'center',
            fontSize: '18px',
            color: '#2c3e50'
          }}>
            🎯 Εγκρίσεις Διάθεσης Πίστωσης - Test Mode
            <br />
            <small style={{ fontSize: '14px', color: '#7f8c8d' }}>
              Αυτό είναι ένα test message για να δούμε αν φαίνεται το modal
            </small>
          </div>

        <ActionBar>
          <SearchInput
            type="text"
            placeholder="Αναζήτηση έργου, υποέργου ή ΚΑ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <>
            <ActionButton primary onClick={() => setShowImportWizard(true)}>
              📥 Import από CSV
            </ActionButton>
            <ActionButton onClick={() => setShowEgkrisiForm(true)}>
              ➕ Νέα Έγκριση
            </ActionButton>
            <ActionButton onClick={() => setShowStructureViewer(true)}>
              📋 Δομή Εγκρίσεων
            </ActionButton>
          </>
        </ActionBar>

        <ProjectGroupsContainer>
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '18px', color: '#2c3e50' }}>
            🎯 Εγκρίσεις Διάθεσης Πίστωσης - Test Mode
          </div>
          {loading ? (
            <LoadingMessage>Φόρτωση εγκρίσεων...</LoadingMessage>
          ) : (
            <>
              {filterProjects() && Array.isArray(filterProjects()) && filterProjects().map((projectGroup, index) => {
                if (!projectGroup || !Array.isArray(projectGroup) || projectGroup.length === 0) {
                  return null;
                }
                
                const projectId = projectGroup[0].projectId;
                const projectTitle = projectGroup[0].projectTitle;
                const projectEgkriseis = getProjectEgkriseis(projectId);
                
                if (projectEgkriseis.length === 0 && searchTerm) {
                  return null;
                }

                return (
                  <ProjectGroup key={index}>
                    <ProjectGroupHeader>
                      <ProjectTitle>{projectTitle}</ProjectTitle>
                      {projectEgkriseis.length > 0 && (
                        <EgkriseisCount>
                          {projectEgkriseis.reduce((sum, sub) => sum + sub.egkriseis.length, 0)} εγκρίσεις
                        </EgkriseisCount>
                      )}
                    </ProjectGroupHeader>

                    <SubprojectsList>
                      {projectGroup.map((subproject) => {
                        const subprojectEgkriseis = projectEgkriseis.find(
                          e => e.subprojectId === subproject.subprojectId
                        );

                        if (!subprojectEgkriseis && searchTerm) {
                          return null;
                        }

                        return (
                          <SubprojectCard key={subproject.subprojectId}>
                            <SubprojectHeader>
                              <SubprojectInfo>
                                <h4>{subproject.subprojectTitle}</h4>
                                <p>ΚΑ: {subproject.kaCode}</p>
                                {subprojectEgkriseis && subprojectEgkriseis.egkriseis.some(egkrisi => linkedSubprojects[egkrisi.id]) && (
                                  <div style={{ 
                                    background: '#e3f2fd', 
                                    color: '#1976d2', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '12px',
                                    marginTop: '4px',
                                    fontWeight: 'bold',
                                    display: 'inline-block'
                                  }}>
                                    🔗 Έχει συσχετισμένες εγκρίσεις
                                  </div>
                                )}
                              </SubprojectInfo>
                              {subprojectEgkriseis && (
                                <EgkriseisCount>
                                  {subprojectEgkriseis.egkriseis.length}
                                </EgkriseisCount>
                              )}
                            </SubprojectHeader>

                            {subprojectEgkriseis && subprojectEgkriseis.egkriseis.length > 0 && (
                              <EgkriseisList>
                                {subprojectEgkriseis.egkriseis.map((egkrisi) => (
                                  <EgkrisiCard 
                                    key={egkrisi.id}
                                    isLocked={egkriseisLocks[egkrisi.id]}
                                  >
                                    <EgkrisiLockIndicator isLocked={egkriseisLocks[egkrisi.id]}>
                                      {egkriseisLocks[egkrisi.id] ? '🔒' : '🔓'}
                                    </EgkrisiLockIndicator>
                                    <EgkrisiInfo>
                                      <div className="date">
                                        {formatDate(egkrisi.date)}
                                      </div>
                                      <div className="filename">
                                        {egkrisi.fileName}
                                      </div>
                                      {egkrisi.type && (
                                        <div className="type">
                                          {egkrisi.type === 'initial' ? 'Αρχική' : 'Τροποποίηση'}
                                        </div>
                                      )}
                                      {linkedSubprojects[egkrisi.id] && (
                                        <div style={{ 
                                          background: '#e8f5e8', 
                                          color: '#2e7d32', 
                                          padding: '4px 8px', 
                                          borderRadius: '4px', 
                                          fontSize: '12px',
                                          marginTop: '4px',
                                          fontWeight: 'bold'
                                        }}>
                                          🔗 ΣΥΣΧΕΤΙΣΜΕΝΟ ΜΕ: {linkedSubprojects[egkrisi.id].subprojectTitle}
                                        </div>
                                      )}
                                    </EgkrisiInfo>
                                    <EgkrisiActions>
                                      <IconButton 
                                        onClick={() => viewFile(projectId, subproject.subprojectId, egkrisi.fileName)}
                                      >
                                        👁️ Προβολή
                                      </IconButton>
                                      {userRole !== 'USER' && (
                                        <IconButton 
                                          onClick={() => handleLinkSubproject(egkrisi)}
                                          style={{ background: '#17a2b8', color: 'white' }}
                                        >
                                          🔗 ΣΥΣΧΕΤΙΣΗ ΜΕ ΥΠΟΕΡΓΟ
                                        </IconButton>
                                      )}
                                      {userRole !== 'USER' && linkedSubprojects[egkrisi.id] && (
                                        <IconButton 
                                          onClick={() => handleCreateApproval(egkrisi)}
                                          style={{ background: '#28a745', color: 'white' }}
                                        >
                                          ✅ ΕΓΚΡΙΣΗ ΔΙΑΘ. ΠΙΣΤΩΣΗΣ ΣΤΟ ΑΝΤΊΣΤΟΙΧΟ ΥΠΟΈΡΓΟ
                                        </IconButton>
                                      )}
                                      {userRole !== 'USER' && (
                                        <IconButton 
                                          danger
                                          onClick={() => deleteEgkrisi(projectId, subproject.subprojectId, egkrisi.id)}
                                        >
                                          🗑️ Διαγραφή
                                        </IconButton>
                                      )}
                                    </EgkrisiActions>
                                  </EgkrisiCard>
                                ))}
                              </EgkriseisList>
                            )}
                          </SubprojectCard>
                        );
                      })}
                    </SubprojectsList>
                  </ProjectGroup>
                );
              })}
              
              {filterProjects().length === 0 && (
                <NoResults>
                  {searchTerm 
                    ? 'Δεν βρέθηκαν εγκρίσεις με βάση την αναζήτηση'
                    : 'Δεν υπάρχουν καταχωρημένες εγκρίσεις'
                  }
                </NoResults>
              )}
            </>
          )}
        </ProjectGroupsContainer>

        {/* Modals */}
        {showImportWizard && (
          <ImportEgkriseisWizard
            projects={projects}
            onClose={() => {
              setShowImportWizard(false);
              loadAllEgkriseis();
            }}
          />
        )}

        {showEgkrisiForm && (
          <EgkrisiForm
            projects={projects}
            selectedProject={selectedProject}
            onClose={async () => {
              // Καθάρισε όλα τα locks όταν κλείνει η φόρμα έγκρισης
              await ipcRenderer.invoke('clear-all-locks');
              setShowEgkrisiForm(false);
              setSelectedProject(null);
              await loadAllEgkriseis();
            }}
          />
        )}

        {showStructureViewer && (
          <EgkriseisStructureViewer 
            onClose={() => setShowStructureViewer(false)}
          />
        )}

        {isLinkingModalOpen && (
          <SubprojectLinkingModal
            isOpen={isLinkingModalOpen}
            onClose={async () => {
              // Ξεκλείδωμα της συγκεκριμένης έγκρισης
              if (currentLinkingEgkrisi) {
                const egkrisiId = `egkrisi_${currentLinkingEgkrisi.projectKey}_${currentLinkingEgkrisi.subprojectKey}`;
                await ipcRenderer.invoke('remove-entity-lock', 'egkriseis', egkrisiId);
                // Άμεση ενημέρωση του UI
                setEgkriseisLocks(prev => ({
                  ...prev,
                  [egkrisiId]: false
                }));
              }
              setIsLinkingModalOpen(false);
              setCurrentLinkingEgkrisi(null);
            }}
            onLink={handleSubprojectLinked}
            currentEgkrisi={currentLinkingEgkrisi}
          />
        )}
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
}

export default EgkriseisManager;
