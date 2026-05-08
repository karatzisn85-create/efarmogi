import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const { ipcRenderer } = window.require('electron');

const Overlay = styled.div`
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

const Modal = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
`;

const Title = styled.h2`
  color: white;
  margin: 0 0 30px 0;
  font-size: 28px;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const FormGroup = styled.div`
  margin-bottom: 25px;
`;

const Label = styled.label`
  display: block;
  color: white;
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 16px;
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #ffd93d;
    box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.3);
  }

  &:hover {
    background: white;
  }
`;

const InfoBox = styled.div`
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 25px;
  color: white;
`;

const InfoTitle = styled.div`
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 12px;
  color: #ffd93d;
`;

const InfoItem = styled.div`
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.6;
  
  strong {
    color: #ffd93d;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 30px;
`;

const Button = styled.button`
  flex: 1;
  padding: 15px 30px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ExportButton = styled(Button)`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(108, 117, 125, 0.4);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(108, 117, 125, 0.6);
  }
`;

const ProgressContainer = styled.div`
  margin-top: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: white;
`;

const ProgressText = styled.div`
  text-align: center;
  font-size: 16px;
  margin-bottom: 10px;
  font-weight: 600;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, #ffd93d, #28a745, #ffd93d);
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
  }

  @keyframes loading {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
`;

const MONTHS = [
  { value: '01', label: '01. ΙΑΝΟΥΑΡΙΟΣ' },
  { value: '02', label: '02. ΦΕΒΡΟΥΑΡΙΟΣ' },
  { value: '03', label: '03. ΜΑΡΤΙΟΣ' },
  { value: '04', label: '04. ΑΠΡΙΛΙΟΣ' },
  { value: '05', label: '05. ΜΑΙΟΣ' },
  { value: '06', label: '06. ΙΟΥΝΙΟΣ' },
  { value: '07', label: '07. ΙΟΥΛΙΟΣ' },
  { value: '08', label: '08. ΑΥΓΟΥΣΤΟΣ' },
  { value: '09', label: '09. ΣΕΠΤΕΜΒΡΙΟΣ' },
  { value: '10', label: '10. ΟΚΤΩΒΡΙΟΣ' },
  { value: '11', label: '11. ΝΟΕΜΒΡΙΟΣ' },
  { value: '12', label: '12. ΔΕΚΕΜΒΡΙΟΣ' }
];

function InvestExport({ isOpen, onClose }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState('');

  // Δημιουργία λίστας ετών (τρέχον έτος ± 2)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (!isOpen) {
      setIsExporting(false);
      setProgress('');
    }
  }, [isOpen]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setProgress('Φόρτωση δεδομένων...');

      const result = await ipcRenderer.invoke('export-invest-projects', {
        year: parseInt(year),
        month: month
      });

      if (result.success) {
        setProgress('');
        
        let message = `✅ Επιτυχής εξαγωγή!\n\n`;
        message += `📁 Αρχείο: ${result.filename}\n`;
        message += `📊 Συνολικά Έργα: ${result.projectsCount}\n`;
        
        if (result.newProjectsCount > 0) {
          message += `🆕 Νέα Έργα: ${result.newProjectsCount}\n`;
        }
        
        if (result.deletedProjectsCount > 0) {
          message += `🗑️ Διαγραμμένα: ${result.deletedProjectsCount}\n`;
        }
        
        if (result.downloadPath) {
          message += `\n💾 Το αρχείο αποθηκεύτηκε επιτυχώς!`;
        }
        
        alert(message);
        onClose();
      } else {
        throw new Error(result.error || 'Άγνωστο σφάλμα');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert(`❌ Σφάλμα κατά την εξαγωγή:\n\n${error.message}`);
    } finally {
      setIsExporting(false);
      setProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => {
      if (e.target === e.currentTarget && !isExporting) {
        onClose();
      }
    }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Title>📊 Εξαγωγή Εκτελεστέων Έργων</Title>

        <InfoBox>
          <InfoTitle>ℹ️ Πληροφορίες Εξαγωγής</InfoTitle>
          <InfoItem>
            <strong>✓</strong> Εξάγονται έργα με προϋπολογισμό <strong>≥ 20.000€</strong>
          </InfoItem>
          <InfoItem>
            <strong>✓</strong> Εξαιρούνται έργα με <strong>"ΙΔΙΟΙ ΠΟΡΟΙ"</strong>
          </InfoItem>
          <InfoItem>
            <strong>✓</strong> Περιλαμβάνονται: <strong>ΕΡΓΑ, ΠΡΟΜΗΘΕΙΕΣ, ΥΠΗΡΕΣΙΕΣ, ΜΕΛΕΤΕΣ</strong>
          </InfoItem>
          <InfoItem>
            <strong>✓</strong> Τα οικονομικά δεδομένα διατηρούνται από το προηγούμενο αρχείο
          </InfoItem>
          <InfoItem>
            <strong>✓</strong> Χρησιμοποιείται το <strong>ιστορικό αλλαγών</strong> για ακρίβεια
          </InfoItem>
        </InfoBox>

        <FormGroup>
          <Label>Έτος Αναφοράς</Label>
          <Select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            disabled={isExporting}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Μήνας Αναφοράς</Label>
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={isExporting}
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        </FormGroup>

        {isExporting && (
          <ProgressContainer>
            <ProgressText>{progress}</ProgressText>
            <ProgressBar />
          </ProgressContainer>
        )}

        <ButtonGroup>
          <CancelButton onClick={onClose} disabled={isExporting}>
            Ακύρωση
          </CancelButton>
          <ExportButton onClick={handleExport} disabled={isExporting}>
            {isExporting ? '⏳ Εξαγωγή...' : '📥 Εξαγωγή'}
          </ExportButton>
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
}

export default InvestExport;

