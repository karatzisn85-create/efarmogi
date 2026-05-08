import React, { useEffect } from 'react';
import styled from 'styled-components';
const { ipcRenderer } = window.require('electron');

const ViewerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
`;

const ViewerContainer = styled.div`
  background: white;
  border-radius: 10px;
  width: 90%;
  height: 90%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
`;

const ViewerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
`;

const FileName = styled.h3`
  margin: 0;
  color: #333;
  font-size: 1.2rem;
  font-weight: 500;
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.3s ease;

  &:hover {
    background: #c82333;
  }
`;

const ViewerContent = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
`;



const LoadingMessage = styled.div`
  text-align: center;
  color: #6c757d;
  font-size: 1.1rem;
`;

function PDFViewer({ isOpen, filePath, fileName, onClose }) {
  useEffect(() => {
    if (isOpen && filePath) {
      // Open PDF file using exec command instead of file:// protocol
      // This handles Windows long paths and Greek characters properly
      const openFile = async () => {
        try {
          await ipcRenderer.invoke('open-pdf-file', filePath);
          // Close the viewer after opening the file externally
          onClose();
        } catch (error) {
          console.error('Error opening PDF file:', error);
          // Keep the viewer open to show error message
        }
      };
      
      openFile();
    }
  }, [isOpen, filePath, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <ViewerOverlay onClick={handleOverlayClick}>
      <ViewerContainer>
        <ViewerHeader>
          <FileName>{fileName || 'Προβολή PDF'}</FileName>
          <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
        </ViewerHeader>
        
        <ViewerContent>
          <LoadingMessage>
            Ανοίγει το αρχείο PDF...
          </LoadingMessage>
        </ViewerContent>
      </ViewerContainer>
    </ViewerOverlay>
  );
}

export default PDFViewer;
