import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

const WizardContainer = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 15px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

const Title = styled.h1`
  margin: 0 0 10px 0;
  font-size: 28px;
`;

const Subtitle = styled.p`
  margin: 0;
  opacity: 0.9;
  font-size: 16px;
`;

const StatsBar = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  flex-wrap: wrap;
`;

const StatCard = styled.div`
  flex: 1;
  min-width: 200px;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  
  h3 {
    margin: 0 0 5px 0;
    color: #666;
    font-size: 14px;
    font-weight: 500;
  }
  
  .value {
    font-size: 32px;
    font-weight: bold;
    color: ${props => props.color || '#333'};
  }
`;

const EgkrisiCard = styled.div`
  background: white;
  padding: 25px;
  border-radius: 15px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  margin-bottom: 20px;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 6px 25px rgba(0,0,0,0.15);
    transform: translateY(-2px);
  }
`;

const ProjectTitle = styled.h2`
  margin: 0 0 10px 0;
  color: #333;
  font-size: 20px;
`;

const SubprojectTitle = styled.h3`
  margin: 0 0 15px 0;
  color: #667eea;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Badge = styled.span`
  background: #f0f0f0;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
`;

const SuggestionsContainer = styled.div`
  margin-top: 20px;
`;

const SuggestionTitle = styled.div`
  font-weight: 600;
  margin-bottom: 10px;
  color: #666;
`;

const SuggestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SuggestionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: ${props => props.selected ? '#e8f5e9' : '#f8f9fa'};
  border: 2px solid ${props => props.selected ? '#4caf50' : '#e0e0e0'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.selected ? '#4caf50' : '#667eea'};
    background: ${props => props.selected ? '#e8f5e9' : '#f0f0f7'};
  }
`;

const Radio = styled.input`
  width: 20px;
  height: 20px;
  cursor: pointer;
`;

const SuggestionDetails = styled.div`
  flex: 1;
  
  .title {
    font-weight: 500;
    margin-bottom: 5px;
    color: #333;
  }
  
  .meta {
    font-size: 12px;
    color: #999;
  }
`;

const MatchScore = styled.span`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    if (props.score >= 0.9) return '#4caf50';
    if (props.score >= 0.8) return '#ff9800';
    return '#f44336';
  }};
  color: white;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LinkButton = styled(Button)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;

const SkipButton = styled(Button)`
  background: #f0f0f0;
  color: #666;
  
  &:hover:not(:disabled) {
    background: #e0e0e0;
  }
`;

const SearchBox = styled.input`
  width: 100%;
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 15px;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const NoSuggestions = styled.div`
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
`;

const ProgressIndicator = styled.div`
  text-align: center;
  margin: 20px 0;
  color: #666;
  font-size: 14px;
`;

function EgkriseisLinkingWizard({ onClose }) {
  const [unlinkedEgkriseis, setUnlinkedEgkriseis] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allSubprojects, setAllSubprojects] = useState([]);
  const [selectedSubproject, setSelectedSubproject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [linkedCount, setLinkedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load unlinked egkriseis from archive
      const unlinked = await ipcRenderer.invoke('load-unlinked-egkriseis');
      setUnlinkedEgkriseis(unlinked);
      
      // Load all real subprojects
      const subprojects = await ipcRenderer.invoke('load-all-subprojects');
      setAllSubprojects(subprojects);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const currentEgkrisi = unlinkedEgkriseis[currentIndex];
  
  const filteredSuggestions = searchTerm
    ? allSubprojects.filter(sp =>
        sp.subprojectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sp.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : currentEgkrisi?.suggestions || [];

  const handleLink = async () => {
    if (!selectedSubproject || !currentEgkrisi) return;
    
    try {
      await ipcRenderer.invoke('link-egkrisi-manual', {
        egkrisiProjectTitle: currentEgkrisi.projectTitle,
        egkrisiSubprojectTitle: currentEgkrisi.subprojectTitle,
        egkrisiSubprojectNumber: currentEgkrisi.subprojectNumber,
        linkedProjectId: selectedSubproject.projectId,
        linkedSubprojectId: selectedSubproject.subprojectId
      });
      
      setLinkedCount(linkedCount + 1);
      setSelectedSubproject(null);
      setSearchTerm('');
      
      if (currentIndex < unlinkedEgkriseis.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        alert(`Ολοκληρώθηκε! Συσχετίστηκαν: ${linkedCount + 1}, Παραλείφθηκαν: ${skippedCount}`);
        onClose?.();
      }
    } catch (error) {
      console.error('Error linking:', error);
      alert('Σφάλμα κατά τη συσχέτιση');
    }
  };

  const handleSkip = () => {
    setSkippedCount(skippedCount + 1);
    setSelectedSubproject(null);
    setSearchTerm('');
    
    if (currentIndex < unlinkedEgkriseis.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert(`Ολοκληρώθηκε! Συσχετίστηκαν: ${linkedCount}, Παραλείφθηκαν: ${skippedCount + 1}`);
      onClose?.();
    }
  };

  if (loading) {
    return (
      <WizardContainer>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>Φόρτωση δεδομένων...</p>
        </div>
      </WizardContainer>
    );
  }

  if (!currentEgkrisi) {
    return (
      <WizardContainer>
        <Header>
          <Title>✅ Ολοκληρώθηκε!</Title>
          <Subtitle>Όλες οι εγκρίσεις επεξεργάστηκαν</Subtitle>
        </Header>
        <StatsBar>
          <StatCard color="#4caf50">
            <h3>Συσχετίστηκαν</h3>
            <div className="value">{linkedCount}</div>
          </StatCard>
          <StatCard color="#ff9800">
            <h3>Παραλείφθηκαν</h3>
            <div className="value">{skippedCount}</div>
          </StatCard>
        </StatsBar>
        <Button onClick={onClose}>Κλείσιμο</Button>
      </WizardContainer>
    );
  }

  return (
    <WizardContainer>
      <Header>
        <Title>🔗 Συσχέτιση Εγκρίσεων με Υποέργα</Title>
        <Subtitle>Επιλέξτε το αντίστοιχο υποέργο για κάθε έγκριση</Subtitle>
      </Header>

      <StatsBar>
        <StatCard color="#667eea">
          <h3>Πρόοδος</h3>
          <div className="value">{currentIndex + 1} / {unlinkedEgkriseis.length}</div>
        </StatCard>
        <StatCard color="#4caf50">
          <h3>Συσχετίστηκαν</h3>
          <div className="value">{linkedCount}</div>
        </StatCard>
        <StatCard color="#ff9800">
          <h3>Παραλείφθηκαν</h3>
          <div className="value">{skippedCount}</div>
        </StatCard>
        <StatCard color="#f44336">
          <h3>Απομένουν</h3>
          <div className="value">{unlinkedEgkriseis.length - currentIndex - 1}</div>
        </StatCard>
      </StatsBar>

      <EgkrisiCard>
        <ProjectTitle>📁 {currentEgkrisi.projectTitle}</ProjectTitle>
        <SubprojectTitle>
          📄 {currentEgkrisi.subprojectTitle}
          <Badge>Υποέργο #{currentEgkrisi.subprojectNumber}</Badge>
        </SubprojectTitle>

        <SuggestionsContainer>
          <SuggestionTitle>🔍 Αναζήτηση Υποέργου:</SuggestionTitle>
          <SearchBox
            type="text"
            placeholder="Πληκτρολογήστε για αναζήτηση..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <SuggestionsList>
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.slice(0, 10).map((suggestion, idx) => (
                <SuggestionItem
                  key={idx}
                  selected={selectedSubproject?.subprojectId === suggestion.subprojectId}
                  onClick={() => setSelectedSubproject(suggestion)}
                >
                  <Radio
                    type="radio"
                    checked={selectedSubproject?.subprojectId === suggestion.subprojectId}
                    onChange={() => setSelectedSubproject(suggestion)}
                  />
                  <SuggestionDetails>
                    <div className="title">{suggestion.subprojectTitle}</div>
                    <div className="meta">
                      Έργο: {suggestion.projectTitle}
                      {suggestion.kaCode && ` • ΚΑ: ${suggestion.kaCode}`}
                    </div>
                  </SuggestionDetails>
                  {suggestion.similarity && (
                    <MatchScore score={suggestion.similarity}>
                      {Math.round(suggestion.similarity * 100)}% match
                    </MatchScore>
                  )}
                </SuggestionItem>
              ))
            ) : (
              <NoSuggestions>
                {searchTerm 
                  ? 'Δεν βρέθηκαν αποτελέσματα. Δοκιμάστε διαφορετικό όρο αναζήτησης.'
                  : 'Δεν υπάρχουν προτάσεις. Χρησιμοποιήστε την αναζήτηση.'}
              </NoSuggestions>
            )}
          </SuggestionsList>
        </SuggestionsContainer>

        <ButtonGroup>
          <LinkButton
            onClick={handleLink}
            disabled={!selectedSubproject}
          >
            ✅ Συσχέτιση
          </LinkButton>
          <SkipButton onClick={handleSkip}>
            ⏭️ Παράλειψη
          </SkipButton>
        </ButtonGroup>
      </EgkrisiCard>

      <ProgressIndicator>
        Επεξεργασία {currentIndex + 1} από {unlinkedEgkriseis.length} εγκρίσεις
      </ProgressIndicator>
    </WizardContainer>
  );
}

export default EgkriseisLinkingWizard;

