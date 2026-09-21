import React, { useState, useEffect, useRef } from 'react';
import {
  catalogWhenDiskUnreadable,
  finishCatalogCatchUp,
  knownMissingFromFullLoad,
  planCatalogCatchUp,
  readForIndexAbsence,
  readResultForCatchUp,
} from '../utils/subprojectCatalogSync';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';

const ModalOverlay = styled.div`
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

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const ModalBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 2rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2rem 1rem;
  flex-shrink: 0;
  border-bottom: 2px solid #e9ecef;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
  font-size: 1.3rem;
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  
  &:hover {
    background: #c82333;
  }
`;

const SearchContainer = styled.div`
  padding: 1.5rem 0 1rem;
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const ResultsContainer = styled.div`
  max-height: none;
  overflow-y: visible;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 1rem;
`;

const SubprojectItem = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #f8f9fa;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #f8f9fa;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const SubprojectTitle = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 0.3rem;
`;

const ProjectTitle = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.2rem;
`;

const SubprojectId = styled.div`
  font-size: 0.8rem;
  color: #999;
  font-family: monospace;
`;

const NoResults = styled.div`
  padding: 2rem;
  text-align: center;
  color: #666;
  font-style: italic;
`;

const LoadingSpinner = styled.div`
  padding: 2rem;
  text-align: center;
  color: #007bff;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem 1.5rem;
  justify-content: flex-end;
  flex-shrink: 0;
  border-top: 1px solid #e9ecef;
  background: #fafafa;
`;

const Button = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  
  ${props => props.primary ? `
    background: #007bff;
    color: white;
    
    &:hover:not(:disabled) {
      background: #0056b3;
    }

    &:disabled {
      background: #adb5bd;
      cursor: not-allowed;
    }
  ` : `
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #545b62;
    }
  `}
`;

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

function toSearchRows(flatProjects) {
  return (flatProjects || [])
    .filter((project) => project?.subprojectId && project?.subprojectTitle && project?.projectTitle)
    .map((project) => ({
      subprojectId: project.subprojectId,
      subprojectTitle: project.subprojectTitle,
      projectTitle: project.projectTitle,
      projectId: project.projectId,
    }));
}

function SubprojectSearchModal({
  isOpen,
  onClose,
  onSelectSubproject,
  egkrisiTitle,
  knownSubprojects = null,
  knownIndexEntries = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subprojects, setSubprojects] = useState([]);
  const [filteredSubprojects, setFilteredSubprojects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubproject, setSelectedSubproject] = useState(null);
  const loadGenerationRef = useRef(0);

  // Φόρτωση όλων των υποέργων & reset κατάστασης κατά το άνοιγμα/κλείσιμο
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedSubproject(null);
      loadAllSubprojects();
    }
  }, [isOpen]);

  // Φιλτράρισμα αποτελεσμάτων
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSubprojects(subprojects);
    } else {
      const normalized = normalizeText(searchTerm);
      const filtered = subprojects.filter(subproject =>
        normalizeText(subproject.subprojectTitle).includes(normalized) ||
        normalizeText(subproject.projectTitle).includes(normalized)
      );
      setFilteredSubprojects(filtered);
    }
  }, [searchTerm, subprojects]);

  const publishRows = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    setSubprojects(list);
    setFilteredSubprojects(list);
  };

  const loadAllSubprojectsFromDisk = async (generation, knownList) => {
    const known = Array.isArray(knownList) ? knownList : [];
    const result = await window.electronAPI.invoke('get-all-subprojects');
    if (loadGenerationRef.current !== generation) return;
    if (result?.reachable === false || result?.success === false) {
      const kept = catalogWhenDiskUnreadable(known);
      publishRows(kept.length ? toSearchRows(kept) : []);
      if (result?.success === false) console.error('Error loading subprojects:', result?.error);
      return;
    }
    const rows = Array.isArray(result?.data) ? result.data : [];
    const absent = knownMissingFromFullLoad(known, rows);
    if (!absent.length) {
      publishRows(rows);
      return;
    }
    const checks = await Promise.all(absent.map(async (project) => {
      try {
        const exists = await window.electronAPI.invoke('subproject-direct-data-exists', {
          projectId: project.projectId || '',
          subprojectId: String(project.subprojectId),
        });
        return readForIndexAbsence(exists).missing ? null : project;
      } catch {
        return project;
      }
    }));
    if (loadGenerationRef.current !== generation) return;
    const kept = checks.filter(Boolean);
    publishRows(kept.length ? [...rows, ...toSearchRows(kept)] : rows);
  };

  const loadAllSubprojects = async () => {
    const generation = ++loadGenerationRef.current;
    const stillCurrent = () => loadGenerationRef.current === generation;
    setLoading(true);
    try {
      const known = Array.isArray(knownSubprojects) ? knownSubprojects : [];
      if (!known.length) {
        await loadAllSubprojectsFromDisk(generation, known);
        return;
      }
      const peek = await window.electronAPI.invoke('peek-projects-index');
      if (!stillCurrent()) return;
      const plan = planCatalogCatchUp(
        known,
        peek?.success && Array.isArray(peek.entries) ? peek.entries : null,
        knownIndexEntries
      );
      if (!plan.ok) {
        await loadAllSubprojectsFromDisk(generation, known);
        return;
      }
      const reads = {};
      if (plan.removedIds.length) {
        const existence = await Promise.all(plan.removedIds.map(async (subprojectId) => {
          const knownProject = known.find((project) => String(project?.subprojectId) === subprojectId);
          try {
            const result = await window.electronAPI.invoke('subproject-direct-data-exists', {
              projectId: knownProject?.projectId || '',
              subprojectId,
            });
            return [subprojectId, readForIndexAbsence(result)];
          } catch {
            return [subprojectId, readForIndexAbsence(null)];
          }
        }));
        existence.forEach(([subprojectId, read]) => {
          reads[subprojectId] = read;
        });
      }
      const checks = [...plan.missing, ...(plan.changed || [])];
      if (checks.length) {
        const results = await Promise.all(checks.map((target) => (
          window.electronAPI.invoke('load-one-subproject', target).catch(() => null)
        )));
        checks.forEach((target, index) => {
          reads[target.subprojectId] = readResultForCatchUp(results[index]);
        });
      }
      if (!stillCurrent()) return;
      const caughtUp = finishCatalogCatchUp(known, plan, reads);
      if (!caughtUp.ok) {
        await loadAllSubprojectsFromDisk(generation, known);
        return;
      }
      if (!stillCurrent()) return;
      publishRows(toSearchRows(caughtUp.projects));
    } catch (error) {
      console.error('Error loading subprojects:', error);
      if (!stillCurrent()) return;
      try {
        await loadAllSubprojectsFromDisk(generation, known);
      } catch (fallbackError) {
        console.error('Error loading subprojects from disk:', fallbackError);
        if (stillCurrent()) {
          const kept = catalogWhenDiskUnreadable(known);
          publishRows(kept.length ? toSearchRows(kept) : []);
        }
      }
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  };

  const handleSelectSubproject = (subproject) => {
    setSelectedSubproject(subproject);
  };

  const handleConfirmSelection = () => {
    if (selectedSubproject && onSelectSubproject) {
      onSelectSubproject(selectedSubproject);
      scheduleDocumentInteractionRecovery();
      onClose();
    }
  };

  const handleClose = () => {
    scheduleDocumentInteractionRecovery();
    onClose();
  };

  if (!isOpen) return null;

  const modal = (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>
            🔍 Αναζήτηση Υποέργου για Συσχέτιση
            {egkrisiTitle && (
              <div style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#666', marginTop: '0.3rem' }}>
                Έγκριση: {egkrisiTitle}
              </div>
            )}
          </Title>
          <CloseButton onClick={handleClose}>Κλείσιμο</CloseButton>
        </Header>

        <ModalBody>
          <SearchContainer>
            <SearchInput
              type="text"
              placeholder="Αναζήτηση υποέργου ή έργου..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>

          <ResultsContainer>
            {loading ? (
              <LoadingSpinner>Φόρτωση υποέργων...</LoadingSpinner>
            ) : filteredSubprojects.length === 0 ? (
              <NoResults>
                {searchTerm ? 'Δεν βρέθηκαν υποέργα που να ταιριάζουν με την αναζήτηση' : 'Δεν υπάρχουν υποέργα στο σύστημα'}
              </NoResults>
            ) : (
              filteredSubprojects.map((subproject) => (
                <SubprojectItem
                  key={subproject.subprojectId}
                  onClick={() => handleSelectSubproject(subproject)}
                  style={{
                    backgroundColor: selectedSubproject?.subprojectId === subproject.subprojectId ? '#e3f2fd' : 'transparent'
                  }}
                >
                  <SubprojectTitle>{subproject.subprojectTitle}</SubprojectTitle>
                  <ProjectTitle>Έργο: {subproject.projectTitle}</ProjectTitle>
                  <SubprojectId>ID: {subproject.subprojectId}</SubprojectId>
                </SubprojectItem>
              ))
            )}
          </ResultsContainer>
        </ModalBody>

        <ButtonContainer>
          {selectedSubproject && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', flex: 1, alignSelf: 'center' }}>
              Επιλεγμένο: <strong>{selectedSubproject.subprojectTitle}</strong>
            </p>
          )}
          <Button onClick={handleClose}>Ακύρωση</Button>
          <Button 
            primary 
            onClick={handleConfirmSelection}
            disabled={!selectedSubproject}
          >
            Συσχέτιση με Επιλεγμένο Υποέργο
          </Button>
        </ButtonContainer>
      </ModalContent>
    </ModalOverlay>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

export default SubprojectSearchModal;
