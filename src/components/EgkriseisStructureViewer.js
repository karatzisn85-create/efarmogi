import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
const { ipcRenderer } = window.require('electron');

const Container = styled.div`
  padding: 2rem;
  background: #f8f9fa;
  min-height: 100vh;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 15px;
  margin-bottom: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 2.5rem;
  font-weight: 600;
  text-align: center;
`;

const Subtitle = styled.p`
  margin: 1rem 0 0 0;
  text-align: center;
  opacity: 0.9;
  font-size: 1.1rem;
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  text-align: center;
  border-left: 4px solid ${props => props.color || '#667eea'};
`;

const StatNumber = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: ${props => props.color || '#667eea'};
  margin-bottom: 0.5rem;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SearchContainer = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  margin-bottom: 2rem;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const ProjectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
`;

const ProjectCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
`;

const ProjectHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  position: relative;
`;

const ProjectTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.4;
`;

const ProjectId = styled.div`
  font-size: 0.8rem;
  opacity: 0.8;
  margin-top: 0.5rem;
`;

const ProjectStats = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
  font-size: 0.9rem;
`;

const Stat = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SubprojectsContainer = styled.div`
  padding: 1.5rem;
`;

const SubprojectItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: #e9ecef;
  }
`;

const SubprojectInfo = styled.div`
  flex: 1;
`;

const SubprojectTitle = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
`;

const SubprojectNumber = styled.div`
  font-size: 0.8rem;
  color: #666;
`;

const PdfCount = styled.div`
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 1.2rem;
  color: #666;
`;

const ErrorContainer = styled.div`
  background: #f8d7da;
  color: #721c24;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  margin: 2rem 0;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #666;
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #333;
`;

const EmptyText = styled.p`
  margin: 0;
  line-height: 1.6;
`;

function EgkriseisStructureViewer() {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSubprojects: 0,
    totalPdfs: 0,
    totalSize: 0
  });

  useEffect(() => {
    loadStructure();
  }, []);

  const loadStructure = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load the organized structure
      const result = await ipcRenderer.invoke('load-organized-egkriseis-structure');
      
      if (result && result.success) {
        setStructure(result.structure);
        calculateStats(result.structure);
      } else {
        setError(result?.error || 'Failed to load structure');
      }
    } catch (err) {
      setError('Error loading structure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (structure) => {
    if (!structure) return;
    
    let totalProjects = 0;
    let totalSubprojects = 0;
    let totalPdfs = 0;
    
    Object.values(structure).forEach(project => {
      totalProjects++;
      totalSubprojects += Object.keys(project.subprojects).length;
      totalPdfs += project.projectPdfs.length;
      
      Object.values(project.subprojects).forEach(subproject => {
        totalPdfs += subproject.pdfs.length;
      });
    });
    
    setStats({
      totalProjects,
      totalSubprojects,
      totalPdfs,
      totalSize: 0 // We could calculate this if needed
    });
  };

  const filteredStructure = () => {
    if (!structure || !searchTerm) return structure;
    
    const filtered = {};
    Object.keys(structure).forEach(projectTitle => {
      const project = structure[projectTitle];
      
      // Check if project title matches
      if (projectTitle && searchTerm && projectTitle.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[projectTitle] = project;
        return;
      }
      
      // Check if any subproject matches
      const matchingSubprojects = {};
      Object.keys(project.subprojects).forEach(subprojectTitle => {
        if (subprojectTitle && searchTerm && subprojectTitle.toLowerCase().includes(searchTerm.toLowerCase())) {
          matchingSubprojects[subprojectTitle] = project.subprojects[subprojectTitle];
        }
      });
      
      if (Object.keys(matchingSubprojects).length > 0) {
        filtered[projectTitle] = {
          ...project,
          subprojects: matchingSubprojects
        };
      }
    });
    
    return filtered;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          🔄 Φόρτωση δομής εγκρίσεων...
        </LoadingContainer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorContainer>
          ❌ Σφάλμα: {error}
        </ErrorContainer>
      </Container>
    );
  }

  const filteredData = filteredStructure();

  return (
    <Container>
      <Header>
        <Title>📋 Δομή Εγκρίσεων Διάθεσης Πίστωσης</Title>
        <Subtitle>Οργανωμένη προβολή όλων των έργων, υποέργων και εγγράφων</Subtitle>
      </Header>

      <StatsContainer>
        <StatCard color="#667eea">
          <StatNumber color="#667eea">{stats.totalProjects}</StatNumber>
          <StatLabel>Έργα</StatLabel>
        </StatCard>
        <StatCard color="#28a745">
          <StatNumber color="#28a745">{stats.totalSubprojects}</StatNumber>
          <StatLabel>Υποέργα</StatLabel>
        </StatCard>
        <StatCard color="#ffc107">
          <StatNumber color="#ffc107">{stats.totalPdfs}</StatNumber>
          <StatLabel>PDF Αρχεία</StatLabel>
        </StatCard>
        <StatCard color="#dc3545">
          <StatNumber color="#dc3545">{formatFileSize(stats.totalSize)}</StatNumber>
          <StatLabel>Συνολικό Μέγεθος</StatLabel>
        </StatCard>
      </StatsContainer>

      <SearchContainer>
        <SearchInput
          type="text"
          placeholder="🔍 Αναζήτηση έργου ή υποέργου..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchContainer>

      {!filteredData || Object.keys(filteredData).length === 0 ? (
        <EmptyState>
          <EmptyIcon>📁</EmptyIcon>
          <EmptyTitle>Δεν βρέθηκαν αποτελέσματα</EmptyTitle>
          <EmptyText>
            {searchTerm ? 'Δοκιμάστε διαφορετικό όρο αναζήτησης' : 'Δεν υπάρχουν δεδομένα εγκρίσεων'}
          </EmptyText>
        </EmptyState>
      ) : (
        <ProjectsGrid>
          {Object.entries(filteredData).map(([projectTitle, project]) => (
            <ProjectCard key={project.projectId}>
              <ProjectHeader>
                <ProjectTitle>{projectTitle}</ProjectTitle>
                <ProjectId>ID: {project.projectId}</ProjectId>
                <ProjectStats>
                  <Stat>
                    <span>📁</span>
                    <span>{Object.keys(project.subprojects).length} υποέργα</span>
                  </Stat>
                  <Stat>
                    <span>📄</span>
                    <span>{project.projectPdfs.length} PDFs</span>
                  </Stat>
                </ProjectStats>
              </ProjectHeader>
              
              <SubprojectsContainer>
                {Object.entries(project.subprojects).map(([subprojectTitle, subproject]) => (
                  <SubprojectItem key={subprojectTitle}>
                    <SubprojectInfo>
                      <SubprojectTitle>{subprojectTitle}</SubprojectTitle>
                      <SubprojectNumber>Υποέργο #{subproject.number}</SubprojectNumber>
                    </SubprojectInfo>
                    <PdfCount>{subproject.pdfs.length} PDFs</PdfCount>
                  </SubprojectItem>
                ))}
              </SubprojectsContainer>
            </ProjectCard>
          ))}
        </ProjectsGrid>
      )}
    </Container>
  );
}

export default EgkriseisStructureViewer;
