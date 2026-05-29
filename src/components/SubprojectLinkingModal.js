import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { containsSearchTerm } from '../utils/searchUtils';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';

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
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 20px;
  width: 90vw;
  height: 80vh;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  min-height: 0;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h2`
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

const ModalContent = styled.div`
  flex: 1;
  min-height: 0;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ModalFooter = styled.div`
  flex-shrink: 0;
  padding: 1rem 2rem 1.5rem;
  border-top: 2px solid #e0e0e0;
  background: white;
`;

const SearchContainer = styled.div`
  background: #f8f9fa;
  border-radius: 15px;
  padding: 1.5rem;
  border: 2px solid #e9ecef;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #667eea;
  }
`;

const ProjectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
`;

const ProjectGroup = styled.div`
  background: #f8f9fa;
  border-radius: 15px;
  padding: 1.5rem;
  border: 2px solid #e9ecef;
`;

const ProjectTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
`;

const SubprojectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SubprojectItem = styled.div`
  display: flex;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #667eea;
    background: #f0f4ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
  }

  &.selected {
    border-color: #667eea;
    background: #e3f2fd;
  }
`;

const SubprojectInfo = styled.div`
  flex: 1;
`;

const SubprojectTitle = styled.h4`
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
`;

const SubprojectDetails = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #666;
`;

const KaCode = styled.span`
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
`;

const ProjectType = styled.span`
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
`;

const Status = styled.span`
  background: ${props => {
    switch(props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return '#fff3e0';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return '#e8f5e8';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return '#e3f2fd';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return '#f3e5f5';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return '#e8f5e8';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch(props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return '#f57c00';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return '#388e3c';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return '#1976d2';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return '#7b1fa2';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return '#388e3c';
      default: return '#666';
    }
  }};
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.8rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 1rem 2rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    &:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  &.secondary {
    background: #f8f9fa;
    color: #666;
    border: 2px solid #e0e0e0;

    &:hover {
      background: #e9ecef;
      border-color: #ccc;
    }
  }
`;

const NoResults = styled.div`
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  font-size: 1.1rem;
  color: #666;
`;

function SubprojectLinkingModal({ isOpen, onClose, onLink, currentEgkrisi }) {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubproject, setSelectedSubproject] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadAllProjects = async () => {
    try {
      setLoading(true);
      const result = await ipcRenderer.invoke('load-all-projects');
      
      if (result && result.length > 0) {
        // Group projects by project title
        const groupedProjects = {};
        result.forEach(project => {
          if (!groupedProjects[project.projectTitle]) {
            groupedProjects[project.projectTitle] = {
              projectTitle: project.projectTitle,
              projectId: project.projectId,
              subprojects: []
            };
          }
          groupedProjects[project.projectTitle].subprojects.push(project);
        });
        
        setProjects(Object.values(groupedProjects));
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedSubproject(null);
      setSearchTerm('');
      loadAllProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.map(projectGroup => ({
        ...projectGroup,
        subprojects: projectGroup.subprojects.filter(subproject =>
          containsSearchTerm(subproject.subprojectTitle, searchTerm) ||
          containsSearchTerm(subproject.kaCode, searchTerm) ||
          containsSearchTerm(subproject.projectTitle, searchTerm)
        )
      })).filter(projectGroup => projectGroup.subprojects.length > 0);
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);

  const handleSubprojectSelect = (subproject) => {
    setSelectedSubproject(subproject);
  };

  const handleLink = () => {
    if (selectedSubproject && onLink) {
      onLink(selectedSubproject);
      scheduleDocumentInteractionRecovery();
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedSubproject(null);
    setSearchTerm('');
    scheduleDocumentInteractionRecovery();
    onClose();
  };

  if (!isOpen) return null;

  const modal = (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Συσχέτιση με Υποέργο</ModalTitle>
          <CloseButton onClick={handleClose}>✕</CloseButton>
        </ModalHeader>
        
        <ModalContent>
          {currentEgkrisi && (
            <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-0.5rem' }}>
              Έγκριση: <strong style={{ color: '#334155' }}>{currentEgkrisi.title || currentEgkrisi.subprojectTitle || '—'}</strong>
            </div>
          )}

          <SearchContainer>
            <SearchInput
              type="text"
              placeholder="Αναζήτηση υποέργων..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>

          {loading ? (
            <LoadingSpinner>Φόρτωση υποέργων...</LoadingSpinner>
          ) : filteredProjects.length === 0 ? (
            <NoResults>
              {searchTerm ? 'Δεν βρέθηκαν υποέργα που να ταιριάζουν με την αναζήτηση' : 'Δεν υπάρχουν διαθέσιμα υποέργα'}
            </NoResults>
          ) : (
            <ProjectsList>
              {filteredProjects.map((projectGroup, index) => (
                <ProjectGroup key={index}>
                  <ProjectTitle>{projectGroup.projectTitle}</ProjectTitle>
                  <SubprojectsList>
                    {projectGroup.subprojects.map((subproject) => (
                      <SubprojectItem
                        key={subproject.subprojectId}
                        className={selectedSubproject?.subprojectId === subproject.subprojectId ? 'selected' : ''}
                        onClick={() => handleSubprojectSelect(subproject)}
                      >
                        <SubprojectInfo>
                          <SubprojectTitle>{subproject.subprojectTitle}</SubprojectTitle>
                          <SubprojectDetails>
                            <KaCode>ΚΑ: {subproject.kaCode}</KaCode>
                            <ProjectType>{subproject.projectType}</ProjectType>
                            <Status status={subproject.projectStatus}>{subproject.projectStatus}</Status>
                          </SubprojectDetails>
                        </SubprojectInfo>
                      </SubprojectItem>
                    ))}
                  </SubprojectsList>
                </ProjectGroup>
              ))}
            </ProjectsList>
          )}
        </ModalContent>

        <ModalFooter>
          {selectedSubproject && (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#475569' }}>
              Επιλεγμένο: <strong>{selectedSubproject.subprojectTitle}</strong>
            </p>
          )}
          <ActionButtons>
            <Button className="secondary" onClick={handleClose}>
              Ακύρωση
            </Button>
            <Button 
              className="primary" 
              onClick={handleLink}
              disabled={!selectedSubproject}
            >
              Συσχέτιση με Υποέργο
            </Button>
          </ActionButtons>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

export default SubprojectLinkingModal;
