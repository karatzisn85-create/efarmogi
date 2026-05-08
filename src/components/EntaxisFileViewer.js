import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

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
  padding: 2rem;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 800px;
  width: 95%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
`;

const ModalTitle = styled.h2`
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #c82333;
    transform: translateY(-2px);
  }
`;

const FileSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  color: #495057;
  font-size: 1.2rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    background: #e9ecef;
    border-color: #dee2e6;
  }
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
`;

const FileName = styled.span`
  color: #333;
  font-weight: 500;
  font-size: 0.9rem;
`;

const FileActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => {
    switch (props.variant) {
      case 'view':
        return `
          background: #007bff;
          color: white;
          &:hover {
            background: #0056b3;
          }
        `;
      case 'download':
        return `
          background: #28a745;
          color: white;
          &:hover {
            background: #1e7e34;
          }
        `;
      case 'delete':
        return `
          background: #dc3545;
          color: white;
          &:hover {
            background: #c82333;
          }
        `;
      default:
        return `
          background: #6c757d;
          color: white;
          &:hover {
            background: #545b62;
          }
        `;
    }
  }}
`;

const NoFilesMessage = styled.div`
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #dee2e6;
`;

function EntaxisFileViewer({ isOpen, onClose, entaxi, userRole }) {
  const [entaxiFiles, setEntaxiFiles] = useState([]);
  const [approvalFiles, setApprovalFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && entaxi) {
      loadFiles();
    }
  }, [isOpen, entaxi]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const files = await ipcRenderer.invoke('get-entaxi-files', entaxi.entaxiId);
      
      console.log('📁 All files found in directory:', files);
      console.log('💾 entaxi.entaxiPDFs from JSON:', entaxi.entaxiPDFs);
      console.log('💾 entaxi.approvalPDFs from JSON:', entaxi.approvalPDFs);
      
      // Separate files by type based on saved arrays or fallback to legacy single files
      const entaxiPDFs = entaxi.entaxiPDFs && entaxi.entaxiPDFs.length > 0 
        ? entaxi.entaxiPDFs 
        : (entaxi.entaxiPDF ? [entaxi.entaxiPDF] : []);
      
      const approvalPDFs = entaxi.approvalPDFs && entaxi.approvalPDFs.length > 0 
        ? entaxi.approvalPDFs 
        : (entaxi.approvalPDF ? [entaxi.approvalPDF] : []);
      
      // ROBUST FILE DISPLAY LOGIC: Handles both new structure and legacy data
      console.log('🔄 SMART FILE DETECTION: Αυτόματος εντοπισμός αρχείων');
      console.log('📁 Files found in directory:', files);
      console.log('📊 entaxiPDFs array:', entaxiPDFs);
      console.log('📊 approvalPDFs array:', approvalPDFs);
      
      let availableEntaxiFiles = [];
      let availableApprovalFiles = [];
      
      // ΠΡΩΤΟΣ ΕΛΕΓΧΟΣ: Υπάρχουν καταγεγραμμένα approval files;
      if (approvalPDFs.length > 0) {
        availableApprovalFiles = files.filter(file => approvalPDFs.includes(file));
        console.log('✅ Βρέθηκαν καταγεγραμμένα approval files:', availableApprovalFiles);
      }
      
      // ΔΕΥΤΕΡΟΣ ΕΛΕΓΧΟΣ: Υπάρχουν καταγεγραμμένα entaxi files;
      if (entaxiPDFs.length > 0) {
        availableEntaxiFiles = files.filter(file => entaxiPDFs.includes(file));
        console.log('✅ Βρέθηκαν καταγεγραμμένα entaxi files:', availableEntaxiFiles);
      }
      
      // ΤΡΙΤΟΣ ΕΛΕΓΧΟΣ: Βρες αρχεία που ΔΕΝ είναι καταγεγραμμένα πουθενά
      const allRecordedFiles = [...entaxiPDFs, ...approvalPDFs];
      const unaccountedFiles = files.filter(file => !allRecordedFiles.includes(file));
      console.log('📂 Μη καταγεγραμμένα αρχεία:', unaccountedFiles);
      
      // ΤΕΤΑΡΤΟΣ ΕΛΕΓΧΟΣ: Τι κάνουμε με τα μη καταγεγραμμένα αρχεία;
      if (unaccountedFiles.length > 0) {
        
        // Αν ΚΑΙ ΤΑ ΔΥΟ arrays είναι κενά -> όλα τα αρχεία ως entaxi (legacy mode)
        if (entaxiPDFs.length === 0 && approvalPDFs.length === 0) {
          console.log('📂 LEGACY MODE: Όλα τα αρχεία ως entaxi files');
          availableEntaxiFiles = files;
          availableApprovalFiles = [];
        } 
        // Αν ΜΟΝΟ το entaxiPDFs είναι κενό -> μη καταγεγραμμένα ως entaxi
        else if (entaxiPDFs.length === 0 && approvalPDFs.length > 0) {
          console.log('🔗 HYBRID MODE: Μη καταγεγραμμένα αρχεία ως entaxi files');
          availableEntaxiFiles = unaccountedFiles; // ΜΟΝΟ τα unaccounted
          console.log('🔗 Entaxi files (unaccounted):', availableEntaxiFiles);
          console.log('✅ Approval files (recorded):', availableApprovalFiles);
        }
        // Αν ΜΟΝΟ το approvalPDFs είναι κενό -> μη καταγεγραμμένα ως approval
        else if (approvalPDFs.length === 0 && entaxiPDFs.length > 0) {
          console.log('🔗 REVERSE MODE: Μη καταγεγραμμένα αρχεία ως approval files');
          availableApprovalFiles = unaccountedFiles; // ΜΟΝΟ τα unaccounted
          console.log('✅ Entaxi files (recorded):', availableEntaxiFiles);
          console.log('🔗 Approval files (unaccounted):', availableApprovalFiles);
        }
        // Αν και τα δύο arrays έχουν δεδομένα -> απόκρυψη μη καταγεγραμμένων
        else {
          console.log('⚠️ STRICT MODE: Τα μη καταγεγραμμένα αρχεία δεν εμφανίζονται:', unaccountedFiles);
        }
      }
      
      console.log('✅ Final entaxi files to display:', availableEntaxiFiles);
      console.log('✅ Final approval files to display:', availableApprovalFiles);
      
      setEntaxiFiles(availableEntaxiFiles);
      setApprovalFiles(availableApprovalFiles);
    } catch (error) {
      console.error('Error loading entaxi files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = async (fileName) => {
    try {
      await ipcRenderer.invoke('view-entaxi-file', entaxi.entaxiId, fileName);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα κατά το άνοιγμα του αρχείου: ' + error.message);
    }
  };

  const handleDownloadFile = async (fileName) => {
    try {
      const result = await ipcRenderer.invoke('download-entaxi-file', entaxi.entaxiId, fileName);
      if (result.success) {
        alert('Το αρχείο αποθηκεύτηκε επιτυχώς!');
      } else {
        alert('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message);
    }
  };

  const handleDeleteFile = async (fileName) => {
    if (!window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`)) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-entaxi-file', entaxi.entaxiId, fileName);
      if (result.success) {
        alert('Το αρχείο διαγράφηκε επιτυχώς!');
        loadFiles(); // Reload files
      } else {
        alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + error.message);
    }
  };

  const renderFileList = (files, title) => (
    <FileSection>
      <SectionTitle>{title}</SectionTitle>
      {files.length === 0 ? (
        <NoFilesMessage>
          Δεν υπάρχουν αρχεία για αυτή την κατηγορία
        </NoFilesMessage>
      ) : (
        <FileList>
          {files.map((fileName, index) => (
            <FileItem key={index}>
              <FileInfo>
                <span>📄</span>
                <FileName>{fileName}</FileName>
              </FileInfo>
              <FileActions>
                <ActionButton 
                  variant="view" 
                  onClick={() => handleViewFile(fileName)}
                  title="Προβολή αρχείου"
                >
                  👁️ Προβολή
                </ActionButton>
                <ActionButton 
                  variant="download" 
                  onClick={() => handleDownloadFile(fileName)}
                  title="Λήψη αρχείου"
                >
                  💾 Λήψη
                </ActionButton>
                {userRole === 'ADMIN' && (
                  <ActionButton 
                    variant="delete" 
                    onClick={() => handleDeleteFile(fileName)}
                    title="Διαγραφή αρχείου"
                  >
                    🗑️ Διαγραφή
                  </ActionButton>
                )}
              </FileActions>
            </FileItem>
          ))}
        </FileList>
      )}
    </FileSection>
  );

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>Αρχεία Ένταξης</ModalTitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </ModalHeader>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Φόρτωση αρχείων...
          </div>
        ) : (
          <>
            {/* Εμφάνιση βασικών δεδομένων εντάξης */}
            {entaxi && (
              <div style={{ 
                background: '#f8f9fa', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ 
                  color: '#495057', 
                  margin: '0 0 1rem 0', 
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}>
                  📋 Στοιχεία Ένταξης
                </h3>
                
                {entaxi.subject && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Θέμα:</strong> {entaxi.subject}
                  </div>
                )}
                
                {entaxi.projectTitle && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Έργο:</strong> {entaxi.projectTitle}
                  </div>
                )}
                
                {entaxi.date && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Ημερομηνία:</strong> {new Date(entaxi.date).toLocaleDateString('el-GR')}
                  </div>
                )}
                
                {entaxi.amount && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Ποσό:</strong> {entaxi.amount.toLocaleString('el-GR')} €
                  </div>
                )}
                
                {entaxi.comments && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: '#fff', 
                    borderRadius: '6px',
                    border: '1px solid #e9ecef'
                  }}>
                    <strong style={{ color: '#495057' }}>💬 Σχόλια/Παρατηρήσεις:</strong>
                    <div style={{ 
                      marginTop: '0.5rem', 
                      color: '#6c757d', 
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5'
                    }}>
                      {entaxi.comments}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {renderFileList(entaxiFiles, '📋 Αρχεία Ένταξης')}
            {renderFileList(approvalFiles, '✅ Αρχεία Αποδοχής Δ.Σ.')}
          </>
        )}
      </ModalContainer>
    </ModalOverlay>
  );
}

export default EntaxisFileViewer;
