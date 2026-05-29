import React, { useState, useEffect } from 'react';
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

function SubprojectSearchModal({ isOpen, onClose, onSelectSubproject, egkrisiTitle }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subprojects, setSubprojects] = useState([]);
  const [filteredSubprojects, setFilteredSubprojects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubproject, setSelectedSubproject] = useState(null);

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

  const loadAllSubprojects = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('get-all-subprojects');
      
      if (result.success) {
        setSubprojects(result.data);
        setFilteredSubprojects(result.data);
      } else {
        console.error('Error loading subprojects:', result.error);
        setSubprojects([]);
        setFilteredSubprojects([]);
      }
    } catch (error) {
      console.error('Error loading subprojects:', error);
      setSubprojects([]);
      setFilteredSubprojects([]);
    } finally {
      setLoading(false);
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
