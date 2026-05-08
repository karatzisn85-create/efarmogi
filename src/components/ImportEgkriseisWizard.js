import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;

const WizardContent = styled.div`
  background: white;
  width: 90%;
  max-width: 1000px;
  max-height: 90vh;
  border-radius: 12px;
  padding: 30px;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
`;

const Title = styled.h2`
  color: #2c3e50;
  font-size: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StepIndicator = styled.div`
  display: flex;
  gap: 20px;
  align-items: center;
`;

const Step = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.active ? '#3498db' : props.completed ? '#2ecc71' : '#95a5a6'};
  font-weight: ${props => props.active ? 'bold' : 'normal'};
`;

const StepNumber = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: ${props => props.active ? '#3498db' : props.completed ? '#2ecc71' : '#ecf0f1'};
  color: ${props => props.active || props.completed ? 'white' : '#95a5a6'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const CloseButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    background: #c0392b;
  }
`;

const StepContent = styled.div`
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FileUploadArea = styled.div`
  border: 3px dashed #3498db;
  border-radius: 12px;
  padding: 60px;
  text-align: center;
  background: #ecf0f1;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: #d5dbdb;
    border-color: #2980b9;
  }

  &.active {
    background: #d1ecf1;
    border-color: #2ecc71;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const UploadIcon = styled.div`
  font-size: 64px;
  margin-bottom: 20px;
`;

const UploadText = styled.div`
  font-size: 18px;
  color: #34495e;
  margin-bottom: 10px;
`;

const UploadSubtext = styled.div`
  font-size: 14px;
  color: #7f8c8d;
`;

const PreviewSection = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
`;

const PreviewTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }

  th {
    background: #ecf0f1;
    font-weight: bold;
    color: #2c3e50;
  }

  tr:hover {
    background: #f8f9fa;
  }
`;


const MappingInfo = styled.div`
  background: #e8f4fd;
  border: 1px solid #3498db;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 10px;

  .icon {
    font-size: 24px;
  }

  .text {
    flex: 1;
    color: #2c3e50;
  }
`;


const PDFDropZone = styled.div`
  border: 3px dashed #e74c3c;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  background: #fef5e7;
  transition: all 0.3s ease;

  &.active {
    background: #fadbd8;
    border-color: #2ecc71;
  }
`;

const PDFList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
`;

const PDFCard = styled.div`
  background: white;
  border: 2px solid ${props => props.matched ? '#2ecc71' : '#e74c3c'};
  border-radius: 8px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .filename {
    font-weight: bold;
    color: #2c3e50;
    font-size: 14px;
    word-break: break-all;
  }

  .status {
    font-size: 12px;
    color: ${props => props.matched ? '#27ae60' : '#e74c3c'};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  justify-content: space-between;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  ${props => props.primary && `
    background: #3498db;
    color: white;

    &:hover {
      background: #2980b9;
      transform: translateY(-2px);
    }

    &:disabled {
      background: #95a5a6;
      cursor: not-allowed;
      transform: none;
    }
  `}

  ${props => props.secondary && `
    background: #ecf0f1;
    color: #34495e;

    &:hover {
      background: #bdc3c7;
    }
  `}
`;

const ResultsSection = styled.div`
  background: ${props => props.success ? '#d4edda' : '#f8d7da'};
  border: 1px solid ${props => props.success ? '#c3e6cb' : '#f5c6cb'};
  border-radius: 8px;
  padding: 20px;
  color: ${props => props.success ? '#155724' : '#721c24'};
`;

const ErrorList = styled.ul`
  margin-top: 10px;
  padding-left: 20px;
`;

function ImportEgkriseisWizard({ projects, onClose }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [parsedEgkriseis, setParsedEgkriseis] = useState([]);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setCsvFile(file);
      parseCSV(file);
    } else {
      alert('Παρακαλώ επιλέξτε ένα αρχείο CSV');
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const lines = content.split('\n').filter(line => line.trim());
      const egkriseisData = [];

      // Skip header lines (first 2 lines based on the Google Sheets structure)
      for (let i = 2; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length < 6) continue;
        
        const projectTitle = values[1];
        const projectPdfs = values[2];
        const subprojectNumber = values[3];
        const subprojectTitle = values[4];
        const subprojectPdfs = values[5];
        
        // Parse project-level PDFs
        if (projectTitle && projectPdfs) {
          const pdfFiles = projectPdfs.split(/\s+/).filter(pdf => pdf.endsWith('.pdf'));
          pdfFiles.forEach(pdfFile => {
            const dateMatch = pdfFile.match(/(\d{2}-\d{2}-\d{4})\.pdf/);
            if (dateMatch) {
              egkriseisData.push({
                projectTitle,
                fileName: pdfFile,
                date: dateMatch[1],
                type: 'initial',
                level: 'project'
              });
            }
          });
        }
        
        // Parse subproject-level PDFs
        if (subprojectNumber && subprojectTitle && subprojectPdfs) {
          const pdfFiles = subprojectPdfs.split(/\s+/).filter(pdf => pdf.endsWith('.pdf'));
          pdfFiles.forEach(pdfFile => {
            const dateMatch = pdfFile.match(/(\d{2}-\d{2}-\d{4})\.pdf/);
            if (dateMatch) {
              egkriseisData.push({
                projectTitle: projectTitle || 'Άγνωστο Έργο',
                subprojectNumber,
                subprojectTitle,
                fileName: pdfFile,
                date: dateMatch[1],
                type: 'initial',
                level: 'subproject'
              });
            }
          });
        }
      }

      setParsedEgkriseis(egkriseisData);
      setCsvData(egkriseisData);
      
      // Extract all PDF filenames
      const allPDFs = new Set();
      egkriseisData.forEach(item => {
        allPDFs.add(item.fileName);
      });
      
      setPdfFiles(Array.from(allPDFs));

      // Create initial mappings
      const initialMappings = Array.from(allPDFs).map(fileName => ({
        fileName,
        matched: false,
        projectId: null,
        subprojectId: null
      }));

      setMappings(initialMappings);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handlePDFUpload = (files) => {
    const filesList = Array.from(files).filter(f => 
      f.name.endsWith('.pdf') || 
      f.name.endsWith('.doc') || 
      f.name.endsWith('.docx')
    );
    setPdfFiles(prev => [...prev, ...filesList]);

    // Update mappings with matched files
    const updatedMappings = mappings.map(mapping => {
      const matchedFile = filesList.find(f => f.name === mapping.fileName);
      if (matchedFile) {
        return { ...mapping, matched: true };
      }
      return mapping;
    });
    setMappings(updatedMappings);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handlePDFUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const performImport = async () => {
    setProcessing(true);

    try {
      // Prepare import data from parsed CSV
      const importData = parsedEgkriseis.map(item => {
        // Find matching project and subproject
        const matchedProject = projects.find(p => 
          p.some(sub => sub.projectTitle === item.projectTitle)
        );
        
        if (matchedProject) {
          const matchedSubproject = matchedProject.find(sub => 
            sub.subprojectTitle === item.subprojectTitle
          );
          
          if (matchedSubproject) {
            return {
              projectId: matchedSubproject.projectId,
              subprojectId: matchedSubproject.subprojectId,
              fileName: item.fileName,
              date: item.date,
              type: item.type,
              projectTitle: item.projectTitle
            };
          }
        }
        
        return null;
      }).filter(item => item !== null);
      
      // Call bulk import
      const result = await window.electron.invoke('bulk-import-egkriseis', importData);
      
      if (result.success) {
        setImportResults({
          success: true,
          imported: result.results.success,
          total: importData.length,
          failed: result.results.failed,
          errors: result.results.errors
        });
      } else {
        setImportResults({
          success: false,
          error: result.error
        });
      }
      
      setCurrentStep(4);
    } catch (error) {
      console.error('Import error:', error);
      setImportResults({
        success: false,
        error: error.message
      });
      setCurrentStep(4);
    } finally {
      setProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <h3>Βήμα 1: Upload αρχείου CSV</h3>
            <FileUploadArea>
              <FileInput
                type="file"
                id="csvUpload"
                accept=".csv"
                onChange={handleCSVUpload}
              />
              <label htmlFor="csvUpload" style={{ cursor: 'pointer' }}>
                <UploadIcon>📊</UploadIcon>
                <UploadText>
                  {csvFile ? csvFile.name : 'Κάντε κλικ για να επιλέξετε το αρχείο CSV'}
                </UploadText>
                <UploadSubtext>
                  Εξάγετε το Google Sheets ως CSV (File → Download → CSV)
                </UploadSubtext>
              </label>
            </FileUploadArea>

            {csvData.length > 0 && (
              <PreviewSection>
                <h4>Προεπισκόπηση δεδομένων ({csvData.length} εγγραφές)</h4>
                <PreviewTable>
                  <thead>
                    <tr>
                      <th>Α/Α</th>
                      <th>Τίτλος Έργου</th>
                      <th>Υποέργο</th>
                      <th>Εγκρίσεις</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        <td>{row.projectNumber}</td>
                        <td>{row.projectTitle}</td>
                        <td>{row.subprojectTitle}</td>
                        <td>
                          {[...row.projectEgkriseis.split(' '), ...row.subprojectEgkriseis.split(' ')]
                            .filter(f => f.endsWith('.pdf'))
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </PreviewTable>
                {csvData.length > 5 && <p>...και {csvData.length - 5} ακόμη εγγραφές</p>}
              </PreviewSection>
            )}
          </>
        );

      case 2:
        return (
          <>
            <h3>Βήμα 2: Αντιστοίχιση Έργων</h3>
            <MappingInfo>
              <div className="icon">ℹ️</div>
              <div className="text">
                Βρέθηκαν {mappings.length} αρχεία στο CSV.
                Τα έργα θα αντιστοιχιστούν αυτόματα βάσει τίτλου.
              </div>
            </MappingInfo>

            <PreviewSection>
              <h4>Αρχεία προς εισαγωγή:</h4>
              <ul>
                {mappings.map((mapping, index) => (
                  <li key={index}>
                    {mapping.fileName} {mapping.matched && '✅'}
                  </li>
                ))}
              </ul>
            </PreviewSection>
          </>
        );

      case 3:
        return (
          <>
            <h3>Βήμα 3: Upload αρχείων (PDF, Word)</h3>
            <PDFDropZone
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <UploadIcon>📁</UploadIcon>
              <UploadText>
                Σύρετε τα αρχεία εδώ (PDF, Word) ή κάντε κλικ για επιλογή
              </UploadText>
              <UploadSubtext>
                Uploaded: {pdfFiles.length} / {mappings.length} αρχεία
              </UploadSubtext>
              <FileInput
                type="file"
                id="pdfUpload"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={(e) => handlePDFUpload(e.target.files)}
              />
              <label htmlFor="pdfUpload" style={{ cursor: 'pointer' }}>
                <Button secondary style={{ marginTop: '20px' }}>
                  Επιλογή αρχείων
                </Button>
              </label>
            </PDFDropZone>

            {mappings.length > 0 && (
              <PDFList>
                {mappings.map((mapping, index) => (
                  <PDFCard key={index} matched={mapping.matched}>
                    <div className="filename">{mapping.fileName}</div>
                    <div className="status">
                      {mapping.matched ? '✅ Βρέθηκε' : '❌ Λείπει'}
                    </div>
                  </PDFCard>
                ))}
              </PDFList>
            )}
          </>
        );

      case 4:
        return (
          <>
            <h3>Ολοκλήρωση Import</h3>
            {importResults && (
              <ResultsSection success={importResults.success}>
                <h4>
                  {importResults.success ? '✅ Επιτυχής εισαγωγή!' : '❌ Σφάλμα κατά την εισαγωγή'}
                </h4>
                <p>Εισήχθησαν: {importResults.imported} αρχεία</p>
                
                {importResults.errors.length > 0 && (
                  <>
                    <p>Σφάλματα:</p>
                    <ErrorList>
                      {importResults.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ErrorList>
                  </>
                )}
              </ResultsSection>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Container onClick={(e) => e.target === e.currentTarget && onClose()}>
      <WizardContent>
        <Header>
          <Title>
            📥 Import Εγκρίσεων από CSV
          </Title>
          <StepIndicator>
            <Step active={currentStep === 1} completed={currentStep > 1}>
              <StepNumber active={currentStep === 1} completed={currentStep > 1}>1</StepNumber>
              CSV
            </Step>
            <Step active={currentStep === 2} completed={currentStep > 2}>
              <StepNumber active={currentStep === 2} completed={currentStep > 2}>2</StepNumber>
              Αντιστοίχιση
            </Step>
            <Step active={currentStep === 3} completed={currentStep > 3}>
              <StepNumber active={currentStep === 3} completed={currentStep > 3}>3</StepNumber>
              PDFs
            </Step>
            <Step active={currentStep === 4}>
              <StepNumber active={currentStep === 4}>4</StepNumber>
              Ολοκλήρωση
            </Step>
          </StepIndicator>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

        <StepContent>
          {renderStepContent()}
        </StepContent>

        <ButtonGroup>
          <div>
            {currentStep > 1 && currentStep < 4 && (
              <Button secondary onClick={() => setCurrentStep(currentStep - 1)}>
                ← Προηγούμενο
              </Button>
            )}
          </div>
          <div>
            {currentStep === 1 && csvData.length > 0 && (
              <Button primary onClick={() => setCurrentStep(2)}>
                Επόμενο →
              </Button>
            )}
            {currentStep === 2 && (
              <Button primary onClick={() => setCurrentStep(3)}>
                Επόμενο →
              </Button>
            )}
            {currentStep === 3 && (
              <Button 
                primary 
                onClick={performImport}
                disabled={processing || pdfFiles.length === 0}
              >
                {processing ? 'Εισαγωγή...' : 'Εκτέλεση Import'}
              </Button>
            )}
            {currentStep === 4 && (
              <Button primary onClick={onClose}>
                Τέλος
              </Button>
            )}
          </div>
        </ButtonGroup>
      </WizardContent>
    </Container>
  );
}

export default ImportEgkriseisWizard;
