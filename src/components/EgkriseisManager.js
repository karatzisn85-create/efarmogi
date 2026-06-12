import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import EgkrisiForm from './EgkrisiForm';
import EgkriseisStructureViewer from './EgkriseisStructureViewer';
import SubprojectLinkingModal from './SubprojectLinkingModal';
import { containsSearchTerm } from '../utils/searchUtils';
import LinkedNoteSticker, { getEntityLinkedNotes } from './LinkedNoteSticker';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';

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
  padding: 0;
  width: 100%;
  max-width: 1920px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.95);
  margin-top: 0.35rem;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;

const ModalTopSection = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.98);
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #e2e8f0;
`;

const PanelTitle = styled.h2`
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
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

const PanelCloseButton = styled.button`
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

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(148, 163, 184, 0.08) 100%);
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  flex-wrap: wrap;
  align-items: center;
`;

const ToolbarQuickInput = styled.input`
  flex: 1;
  min-width: 200px;
  max-width: 480px;
  padding: 0.45rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ToolbarActionButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;

  ${(props) =>
    props.primary
      ? `
    background: #4f46e5;
    color: #f8fafc;
    border: 1px solid #4338ca;

    &:hover:not(:disabled) {
      background: #4338ca;
      border-color: #3730a3;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.25);
    }
  `
      : `
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;

    &:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #94a3b8;
    }
  `}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ModalScrollSection = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.45rem 1.25rem 1rem;
  border-top: 1px solid #e2e8f0;
`;

const ProjectGroupsContainer = styled.div`
  padding: 0.15rem 0 0.35rem;
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
  overflow: visible;
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
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;

  ${(props) => {
    if (props.danger) {
      return `
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
      &:hover {
        background: #fee2e2;
        border-color: #f87171;
      }
    `;
    }
    if (props.$filesPrimary) {
      return `
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #f8fafc;
      border: 1px solid #3730a3;
      box-shadow: 0 2px 8px rgba(67, 56, 202, 0.3);
      &:hover {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        box-shadow: 0 3px 12px rgba(79, 70, 229, 0.4);
      }
    `;
    }
    return `
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      &:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
    `;
  }}
`;

const NoResults = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

function EgkriseisManager({ isOpen, onClose, projects, userRole, currentUser, onLinkCreated, linkedNotesMap = {}, onOpenNoteFromEntity, initialSearchTerm = '' }) {
  const { showToast } = useToast();
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [egkriseisData, setEgkriseisData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showEgkrisiForm, setShowEgkrisiForm] = useState(false);
  const [showStructureViewer, setShowStructureViewer] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [currentLinkingEgkrisi, setCurrentLinkingEgkrisi] = useState(null);
  const [linkedSubprojects, setLinkedSubprojects] = useState({});
  const [egkriseisLocks, setEgkriseisLocks] = useState({});

  useEffect(() => {
    if (isOpen && initialSearchTerm) {
      let cleaned = initialSearchTerm
        .replace(/^\d+[_\s]+/, '')
        .replace(/_/g, ' ')
        .trim();
      setSearchTerm(cleaned);
    } else if (!isOpen) {
      setSearchTerm('');
      scheduleDocumentInteractionRecovery();
    }
  }, [isOpen, initialSearchTerm]);

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
    if (!isOpen) return;

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
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Also load from standalone egkriseis-data.json
      try {
        const standaloneResult = await ipcRenderer.invoke('load-egkriseis-data');
        if (standaloneResult.success && standaloneResult.data?.projects) {
          for (const [projKey, projVal] of Object.entries(standaloneResult.data.projects)) {
            if (!projVal.subprojects) continue;
            // Find matching projectId from projects array
            const projTitle = projVal.title || projKey;
            let matchedProjectId = null;
            for (const projectGroup of projects) {
              if (!projectGroup || !Array.isArray(projectGroup)) continue;
              const match = projectGroup.find(p => p.projectTitle === projTitle);
              if (match) { matchedProjectId = match.projectId; break; }
            }
            if (!matchedProjectId) continue;

            for (const [subKey, subVal] of Object.entries(projVal.subprojects)) {
              if (!subVal.pdfs || subVal.pdfs.length === 0) continue;
              const subTitle = subVal.title || subKey.replace(/_/g, ' ');
              // Find matching subprojectId
              let matchedSubId = null;
              for (const projectGroup of projects) {
                if (!projectGroup || !Array.isArray(projectGroup)) continue;
                const match = projectGroup.find(p => p.subprojectTitle === subTitle && p.projectId === matchedProjectId);
                if (match) { matchedSubId = match.subprojectId; break; }
              }
              if (!matchedSubId) continue;

              // Check if already loaded
              const existing = allEgkriseis[matchedProjectId];
              const alreadyHas = existing?.some(e => e.subprojectId === matchedSubId);
              if (alreadyHas) continue;

              const egkriseisList = subVal.pdfs.map((pdf, idx) => ({
                id: `standalone_${projKey}_${subKey}_${idx}`,
                fileName: pdf,
                date: null,
                type: idx === 0 ? 'initial' : 'modification',
                projectKey: projKey,
                subprojectKey: subKey
              }));

              if (!allEgkriseis[matchedProjectId]) allEgkriseis[matchedProjectId] = [];
              allEgkriseis[matchedProjectId].push({
                subprojectId: matchedSubId,
                subprojectTitle: subTitle,
                egkriseis: egkriseisList
              });
            }
          }
        }
      } catch (_) { /* ignore standalone load errors */ }
      
      setEgkriseisData(allEgkriseis);
    } catch (error) {
      console.error('Error loading egkriseis:', error);
      showToast('Σφάλμα κατά τη φόρτωση των εγκρίσεων', 'error');
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
        showToast('Σφάλμα κατά το άνοιγμα του αρχείου: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      showToast('Σφάλμα κατά το άνοιγμα του αρχείου', 'error');
    }
  };

  const deleteEgkrisi = async (projectId, subprojectId, egkrisiId) => {
    if (!await showConfirm({ title: 'Διαγραφή Έγκρισης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την έγκριση;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-egkrisi-file', projectId, subprojectId, egkrisiId);
      
      if (result.success) {
        loadAllEgkriseis();
      } else {
        showToast('Σφάλμα κατά τη διαγραφή: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting egkrisi:', error);
      showToast('Σφάλμα κατά τη διαγραφή', 'error');
    }
  };

  const handleLinkSubproject = async (egkrisi) => {
    const egkrisiId = `egkrisi_${egkrisi.projectKey}_${egkrisi.subprojectKey}`;
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'egkriseis', egkrisiId);

    if (lockStatus.locked) {
      const who = lockStatus.lockedBy ? `«${lockStatus.lockedBy}»` : 'άλλον διαχειριστή';
      showToast(`Η έγκριση είναι υπό επεξεργασία από ${who}.`, 'warning');
      return;
    }

    const lockOwner = currentUser?.fullName || currentUser?.username || '';
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'egkriseis', egkrisiId, lockOwner);
    if (!lockResult.success) {
      const who = lockResult.lockedBy ? `«${lockResult.lockedBy}»` : 'άλλον χρήστη';
      showToast(`Δεν είναι δυνατή η επεξεργασία. Ανοιχτό από ${who}.`, 'warning');
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
        
        // Reload only the links — the egkriseis themselves haven't changed
        await loadEgkrisiLinks();
        
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
        
        // Close the linking modal and restore DOM state
        setIsLinkingModalOpen(false);
        setCurrentLinkingEgkrisi(null);
        scheduleDocumentInteractionRecovery();
        
        showToast('Η συσχέτιση με το υποέργο δημιουργήθηκε επιτυχώς!', 'success');
      } else {
        // Ξεκλείδωμα ακόμα και σε περίπτωση σφάλματος
        const egkrisiId = `egkrisi_${currentLinkingEgkrisi.projectKey}_${currentLinkingEgkrisi.subprojectKey}`;
        await ipcRenderer.invoke('remove-entity-lock', 'egkriseis', egkrisiId);
        setEgkriseisLocks(prev => ({
          ...prev,
          [egkrisiId]: false
        }));
        
        showToast('Σφάλμα κατά τη συσχέτιση: ' + result.error, 'error');
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
      
      showToast('Σφάλμα κατά τη συσχέτιση', 'error');
    }
  };

  const handleCreateApproval = async (egkrisi) => {
    if (!linkedSubprojects[egkrisi.id]) {
      showToast('Παρακαλώ συσχετίστε πρώτα την έγκριση με ένα υποέργο', 'warning');
      return;
    }

    try {
      const result = await ipcRenderer.invoke('create-credit-approval', {
        egkrisiId: egkrisi.id,
        subprojectId: linkedSubprojects[egkrisi.id].subprojectId,
        projectId: linkedSubprojects[egkrisi.id].projectId
      });

      if (result.success) {
        showToast('Η έγκριση διαθέσεως πίστωσης δημιουργήθηκε επιτυχώς!', 'success');
        // Refresh data
        loadAllEgkriseis();
      } else {
        showToast('Σφάλμα κατά τη δημιουργία έγκρισης: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error creating approval:', error);
      showToast('Σφάλμα κατά τη δημιουργία έγκρισης', 'error');
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
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalTopSection>
          <PanelHeader>
            <PanelTitle>Εγκρίσεις Διάθεσης Πίστωσης</PanelTitle>
            <PanelCloseButton type="button" onClick={onClose}>
              Κλείσιμο
            </PanelCloseButton>
          </PanelHeader>

          <ActionsBar>
            <ToolbarQuickInput
              type="text"
              placeholder="Αναζήτηση έργου, υποέργου ή ΚΑ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ToolbarActionButton type="button" primary onClick={() => setShowEgkrisiForm(true)}>
              ➕ Νέα Έγκριση
            </ToolbarActionButton>
            
          </ActionsBar>
        </ModalTopSection>

        <ModalScrollSection>
        <ProjectGroupsContainer>
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
                                {subprojectEgkriseis.egkriseis.map((egkrisi) => {
                                  const egkrisiLinkedNotes = getEntityLinkedNotes(linkedNotesMap, egkrisi.id);
                                  return (
                                  <EgkrisiCard 
                                    key={egkrisi.id}
                                    isLocked={egkriseisLocks[egkrisi.id]}
                                  >
                                    {egkrisiLinkedNotes.length > 0 && (
                                      <LinkedNoteSticker
                                        links={egkrisiLinkedNotes}
                                        onOpenNote={onOpenNoteFromEntity}
                                        placement="top-right"
                                      />
                                    )}
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
                                        type="button"
                                        $filesPrimary
                                        onClick={() => viewFile(projectId, subproject.subprojectId, egkrisi.fileName)}
                                      >
                                        👁️ Προβολή
                                      </IconButton>
                                      {canManageWorkflow && (
                                        <IconButton 
                                          onClick={() => handleLinkSubproject(egkrisi)}
                                          style={{ background: '#17a2b8', color: 'white' }}
                                        >
                                          🔗 ΣΥΣΧΕΤΙΣΗ ΜΕ ΥΠΟΕΡΓΟ
                                        </IconButton>
                                      )}
                                      {canManageWorkflow && linkedSubprojects[egkrisi.id] && (
                                        <IconButton 
                                          onClick={() => handleCreateApproval(egkrisi)}
                                          style={{ background: '#28a745', color: 'white' }}
                                        >
                                          ✅ ΕΓΚΡΙΣΗ ΔΙΑΘ. ΠΙΣΤΩΣΗΣ ΣΤΟ ΑΝΤΊΣΤΟΙΧΟ ΥΠΟΈΡΓΟ
                                        </IconButton>
                                      )}
                                      {canManageWorkflow && (
                                        <IconButton 
                                          danger
                                          onClick={() => deleteEgkrisi(projectId, subproject.subprojectId, egkrisi.id)}
                                        >
                                          🗑️ Διαγραφή
                                        </IconButton>
                                      )}
                                    </EgkrisiActions>
                                  </EgkrisiCard>
                                  );
                                })}
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
        </ModalScrollSection>

        {/* Modals */}
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
              scheduleDocumentInteractionRecovery();
            }}
            onLink={handleSubprojectLinked}
            currentEgkrisi={currentLinkingEgkrisi}
          />
        )}
      </ModalContainer>
    </ModalOverlay>
  );
}

export default EgkriseisManager;
