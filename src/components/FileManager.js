import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const FileManagerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 2rem;
  overflow-y: auto;
`;

const FileManagerContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 3rem;
  max-width: 900px;
  width: 90%;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.3s ease-out;
  border: 2px solid #dee2e6;
  margin-bottom: 2rem; /* Άφησε χώρο στο κάτω μέρος */

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 3px solid #e9ecef;
`;

const Title = styled.h3`
  color: #333;
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &::before {
    content: "📁";
    font-size: 1.5rem;
  }
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s ease;
  text-transform: uppercase;

  &:hover {
    background: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
`;

const FilesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const FileItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px solid #dee2e6;
  transition: all 0.3s ease;

  &:hover {
    background: #e9ecef;
    border-color: #adb5bd;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const FileInfo = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.8rem;
`;

const FileIcon = styled.div`
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
`;

const FileName = styled.span`
  font-weight: 600;
  color: #333;
  word-break: break-word;
  font-size: 1.1rem;
`;

const FileActions = styled.div`
  display: flex;
  gap: 0.8rem;
`;

const ActionButton = styled.button`
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const ViewButton = styled(ActionButton)`
  background: #007bff;
  color: white;

  &:hover {
    background: #0056b3;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
  }
`;

const DownloadButton = styled(ActionButton)`
  background: #28a745;
  color: white;

  &:hover {
    background: #218838;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
  }
`;

const DeleteButton = styled(ActionButton)`
  background: #dc3545;
  color: white;

  &:hover {
    background: #c82333;
    box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6c757d;
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: 1.1rem;
  margin: 0;
`;

function FileManager({ 
  files, 
  fileGroups = [], 
  userRole, 
  onViewFile, 
  onDownloadFile, 
  onDeleteFile, 
  onClose,
  onRefresh,
  onGroupFiles
}) {
  const [selectedFiles, setSelectedFiles] = useState(new Set());

  useEffect(() => {
    // Αποτρέπει το scroll του background
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Επαναφέρει το scroll όταν κλείνει το modal
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleToggleFileSelection = (fileName) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allFiles = new Set();
    // Προσθήκη όλων των individual files
    files.forEach(file => allFiles.add(file));
    // Προσθήκη όλων των files από groups
    fileGroups.forEach(group => {
      group.files.forEach(file => {
        const fileName = typeof file === 'string' ? file : (file.name || file.fileName || '');
        allFiles.add(fileName);
      });
    });
    setSelectedFiles(allFiles);
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  const handleViewFile = (fileName) => {
    onViewFile(fileName);
  };

  const handleDownloadFile = (fileName) => {
    onDownloadFile(fileName);
  };

  const handleDeleteFile = async (fileName) => {
    await onDeleteFile(fileName);
    onRefresh(); // Refresh the file list after deletion
  };

  const handleMoveToGroup = () => {
    if (selectedFiles.size === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο');
      return;
    }
    if (onGroupFiles) {
      onGroupFiles(Array.from(selectedFiles), fileGroups);
    }
  };

  return (
    <FileManagerOverlay 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ paddingTop: `${Math.max(50, window.innerHeight * 0.08)}px` }}
    >
      <FileManagerContainer>
        <Header>
          <Title>Αρχεία Υποέργου</Title>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {userRole === 'ADMIN' && (files.length > 0 || fileGroups.some(g => g.files.length > 0)) && (
              <>
                {selectedFiles.size > 0 && (
                  <button
                    onClick={handleMoveToGroup}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.6rem 1.2rem',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    📁 Μεταφορά σε Ομάδα ({selectedFiles.size})
                  </button>
                )}
                <button
                  onClick={selectedFiles.size > 0 ? handleDeselectAll : handleSelectAll}
                  style={{
                    background: selectedFiles.size > 0 ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {selectedFiles.size > 0 ? '✖ Αποεπιλογή Όλων' : '✓ Επιλογή Όλων'}
                </button>
              </>
            )}
            <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
          </div>
        </Header>

        {files.length === 0 && fileGroups.length === 0 ? (
          <EmptyState>
            <EmptyIcon>📄</EmptyIcon>
            <EmptyText>Δεν υπάρχουν αρχεία για αυτό το υποέργο</EmptyText>
          </EmptyState>
        ) : (
          <FilesList>
            {/* File Groups */}
            {fileGroups.map((group) => (
              <div key={group.id} style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: '#f8f9fa',
                border: '2px solid #e9ecef',
                borderRadius: '12px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '1rem',
                  paddingBottom: '0.8rem',
                  borderBottom: '2px solid #dee2e6'
                }}>
                  <span style={{ fontSize: '1.5rem', marginRight: '0.8rem' }}>📁</span>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.2rem', 
                    fontWeight: '600', 
                    color: '#495057' 
                  }}>
                    {group.title}
                  </h3>
                  <span style={{ 
                    marginLeft: 'auto',
                    fontSize: '0.9rem', 
                    color: '#6c757d',
                    background: '#e9ecef',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px'
                  }}>
                    {group.files.length} αρχείο(α)
                  </span>
                </div>
                
                {group.files.map((file, fileIndex) => {
                  // Χειρισμός και string και object αρχείων
                  const fileName = typeof file === 'string' ? file : (file.name || file.fileName || '');
                  
                  return (
                    <FileItem key={`${group.id}-${fileIndex}`} style={{ marginBottom: '0.8rem' }}>
                      <FileInfo>
                        {userRole === 'ADMIN' && (
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(fileName)}
                            onChange={() => handleToggleFileSelection(fileName)}
                            style={{
                              marginRight: '0.8rem',
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer'
                            }}
                          />
                        )}
                        <FileIcon>PDF</FileIcon>
                        <FileName>{fileName}</FileName>
                      </FileInfo>
                      
                      <FileActions>
                        <ViewButton onClick={() => handleViewFile(fileName)}>
                          Προβολή
                        </ViewButton>
                        
                        <DownloadButton onClick={() => handleDownloadFile(fileName)}>
                          Λήψη
                        </DownloadButton>
                        
                        {userRole === 'ADMIN' && (
                          <DeleteButton onClick={() => handleDeleteFile(fileName)}>
                            Διαγραφή
                          </DeleteButton>
                        )}
                      </FileActions>
                    </FileItem>
                  );
                })}
              </div>
            ))}
            
            {/* Individual Files */}
            {files.length > 0 && (
              <div style={{ marginTop: fileGroups.length > 0 ? '2rem' : '0' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.1rem', 
                    fontWeight: '600', 
                    color: '#495057'
                  }}>
                    Αρχεία Χωρίς Ομαδοποίηση
                  </h3>
                </div>
                {/* Εμφάνιση αρχείων χωρίς ομαδοποίηση */}
                {files.map((fileName, index) => (
                  <FileItem key={index}>
                    <FileInfo>
                      {userRole === 'ADMIN' && (
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(fileName)}
                          onChange={() => handleToggleFileSelection(fileName)}
                          style={{
                            marginRight: '0.8rem',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />
                      )}
                      <FileIcon>PDF</FileIcon>
                      <FileName>{fileName}</FileName>
                    </FileInfo>
                    
                    <FileActions>
                      <ViewButton onClick={() => handleViewFile(fileName)}>
                        Προβολή
                      </ViewButton>
                      
                      <DownloadButton onClick={() => handleDownloadFile(fileName)}>
                        Λήψη
                      </DownloadButton>
                      
                      {userRole === 'ADMIN' && (
                        <DeleteButton onClick={() => handleDeleteFile(fileName)}>
                          Διαγραφή
                        </DeleteButton>
                      )}
                    </FileActions>
                  </FileItem>
                ))}
              </div>
            )}
          </FilesList>
        )}
      </FileManagerContainer>
    </FileManagerOverlay>
  );
}

export default FileManager;
