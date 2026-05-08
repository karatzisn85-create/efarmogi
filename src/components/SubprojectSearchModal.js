import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

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
  padding: 2rem;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
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
  margin-bottom: 1.5rem;
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
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 8px;
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
  margin-top: 1.5rem;
  justify-content: flex-end;
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
    
    &:hover {
      background: #0056b3;
    }
  ` : `
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #545b62;
    }
  `}
`;

function SubprojectSearchModal({ isOpen, onClose, onSelectSubproject, egkrisiTitle }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subprojects, setSubprojects] = useState([]);
  const [filteredSubprojects, setFilteredSubprojects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubproject, setSelectedSubproject] = useState(null);

  // Φόρτωση όλων των υποέργων
  useEffect(() => {
    if (isOpen) {
      loadAllSubprojects();
    }
  }, [isOpen]);

  // Φιλτράρισμα αποτελεσμάτων
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSubprojects(subprojects);
    } else {
      const filtered = subprojects.filter(subproject => 
        subproject.subprojectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subproject.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
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
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContent>
        <Header>
          <Title>
            🔍 Αναζήτηση Υποέργου για Συσχέτιση
            {egkrisiTitle && (
              <div style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#666', marginTop: '0.3rem' }}>
                Έγκριση: {egkrisiTitle}
              </div>
            )}
          </Title>
          <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
        </Header>

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

        <ButtonContainer>
          <Button onClick={onClose}>Ακύρωση</Button>
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
}

export default SubprojectSearchModal;
