import React, { useState } from 'react';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import { formatDateEl } from '../utils/dateFormat';
import { formatEntaxiAmount, getEntaxiCurrentTotal } from '../utils/entaxiAmountUtils';

const ExportOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 5vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      backdrop-filter: blur(0px);
    }
    to {
      opacity: 1;
      backdrop-filter: blur(5px);
    }
  }
`;

const ExportContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 3rem;
  max-width: 900px;
  width: 95%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid #dee2e6;
  margin-bottom: 2rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 3px solid #e9ecef;
`;

const Title = styled.h2`
  color: #333;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &::before {
    content: "📊";
    font-size: 1.5rem;
  }
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  &:hover {
    background: #c82333;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
`;

const FieldsSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  color: #495057;
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #dee2e6;
`;

const FieldItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  cursor: pointer;
  padding: 0.8rem;
  border-radius: 8px;
  transition: background 0.2s ease;
  font-size: 0.9rem;

  &:hover {
    background: rgba(102, 126, 234, 0.1);
  }
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #667eea;
`;

const FieldLabel = styled.span`
  color: #495057;
  font-weight: 500;
  cursor: pointer;
`;

const InfoBox = styled.div`
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border: 1px solid #bbdefb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const InfoTitle = styled.h4`
  color: #1565c0;
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.8rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "ℹ️";
    font-size: 1rem;
  }
`;

const InfoText = styled.p`
  color: #1976d2;
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.5;
`;

const StatsBox = styled.div`
  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
  border: 1px solid #c8e6c9;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2e7d32;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: #388e3c;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ActionsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
  margin-top: 1rem;
`;

const ActionButton = styled.button`
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  ${props => props.primary ? `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    
    &:hover {
      background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }

    &:disabled {
      background: #cccccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  ` : `
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #545b62;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);
    }
  `}
`;

const SelectAllButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #667eea 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }
`;

// Σειρά στηλών για τις εντάξεις
const EXPORT_FIELDS_ORDER = [
  { id: 'rowNumber', label: 'Α/Α', width: 8 },
  { id: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', width: 40 },
  { id: 'subject', label: 'Θέμα Ένταξης', width: 40 },
  { id: 'documentDate', label: 'Ημερομηνία Έγγραφου', width: 18 },
  { id: 'fundingAuthority', label: 'Φορέας Χρηματοδότησης', width: 30 },
  { id: 'initialAmount', label: 'Αρχικό Ποσό', width: 16 },
  { id: 'cumulativeAmount', label: 'ΤΕΛΙΚΟ ΠΟΣΟ ΜΕ ΤΡΟΠΟΠΟΙΗΣΕΙΣ', width: 20 },
  { id: 'modificationsCount', label: 'Αριθμός Τροποποιήσεων', width: 20 },
  { id: 'modificationDate1', label: 'Ημερομηνία Τροποποίησης 1', width: 18 },
  { id: 'modificationAmount1', label: 'Ποσό Τροποποίησης 1', width: 18 },
  { id: 'modificationComments1', label: 'Σχόλια Τροποποίησης 1', width: 30 },
  { id: 'modificationDate2', label: 'Ημερομηνία Τροποποίησης 2', width: 18 },
  { id: 'modificationAmount2', label: 'Ποσό Τροποποίησης 2', width: 18 },
  { id: 'modificationComments2', label: 'Σχόλια Τροποποίησης 2', width: 30 },
  { id: 'modificationDate3', label: 'Ημερομηνία Τροποποίησης 3', width: 18 },
  { id: 'modificationAmount3', label: 'Ποσό Τροποποίησης 3', width: 18 },
  { id: 'modificationComments3', label: 'Σχόλια Τροποποίησης 3', width: 30 },
  { id: 'createdAt', label: 'Ημερομηνία Δημιουργίας', width: 18 },
  { id: 'updatedAt', label: 'Τελευταία Ενημέρωση', width: 18 }
];

// Διαθέσιμα πεδία για εξαγωγή (για το UI)
const EXPORT_FIELDS = {
  basic: {
    title: '📋 Βασικά Στοιχεία',
    fields: [
      { id: 'rowNumber', label: 'Α/Α', width: 8 },
      { id: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', width: 40 },
      { id: 'subject', label: 'Θέμα Ένταξης', width: 40 },
    ]
  },
  financial: {
    title: '💰 Οικονομικά Στοιχεία',
    fields: [
      { id: 'initialAmount', label: 'Αρχικό Ποσό', width: 16 },
      { id: 'cumulativeAmount', label: 'ΤΕΛΙΚΟ ΠΟΣΟ ΜΕ ΤΡΟΠΟΠΟΙΗΣΕΙΣ', width: 20 },
      { id: 'modificationsCount', label: 'Αριθμός Τροποποιήσεων', width: 20 },
    ]
  },
  modifications: {
    title: '⚡ Τροποποιήσεις',
    fields: [
      { id: 'modificationDate1', label: 'Ημερομηνία Τροποποίησης 1', width: 18 },
      { id: 'modificationAmount1', label: 'Ποσό Τροποποίησης 1', width: 18 },
      { id: 'modificationComments1', label: 'Σχόλια Τροποποίησης 1', width: 30 },
      { id: 'modificationDate2', label: 'Ημερομηνία Τροποποίησης 2', width: 18 },
      { id: 'modificationAmount2', label: 'Ποσό Τροποποίησης 2', width: 18 },
      { id: 'modificationComments2', label: 'Σχόλια Τροποποίησης 2', width: 30 },
      { id: 'modificationDate3', label: 'Ημερομηνία Τροποποίησης 3', width: 18 },
      { id: 'modificationAmount3', label: 'Ποσό Τροποποίησης 3', width: 18 },
      { id: 'modificationComments3', label: 'Σχόλια Τροποποίησης 3', width: 30 },
    ]
  },
  details: {
    title: '📅 Ημερομηνίες & Στοιχεία',
    fields: [
      { id: 'documentDate', label: 'Ημερομηνία Έγγραφου', width: 18 },
      { id: 'fundingAuthority', label: 'Φορέας Χρηματοδότησης', width: 30 },
    ]
  },
  system: {
    title: '⚙️ Συστήματος',
    fields: [
      { id: 'createdAt', label: 'Ημερομηνία Δημιουργίας', width: 18 },
      { id: 'updatedAt', label: 'Τελευταία Ενημέρωση', width: 18 },
    ]
  }
};

function EntaxisExportDialog({ isOpen, onClose, entaxeis, totalEntaxeis, organizationName = '' }) {
  const { showToast } = useToast();
  const [selectedFields, setSelectedFields] = useState([
    'rowNumber', 'projectTitle', 'subject', 'documentDate', 'fundingAuthority', 'initialAmount', 'cumulativeAmount'
  ]);

  const handleFieldChange = (fieldId, checked) => {
    if (checked) {
      setSelectedFields(prev => [...prev, fieldId]);
    } else {
      setSelectedFields(prev => prev.filter(id => id !== fieldId));
    }
  };

  const handleSelectAll = () => {
    const allFields = Object.values(EXPORT_FIELDS).flatMap(section => 
      section.fields.map(field => field.id)
    );
    setSelectedFields(allFields);
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  // Βοηθητική συνάρτηση για parsing ελληνικών ποσών (5.000.873,01 -> 5000873.01)
  const parseGreekAmount = (amountString) => {
    if (!amountString) return 0;
    
    // Αφαιρούμε όλα τα μη-αριθμητικά εκτός από κόμμα και τελεία
    let cleaned = amountString.toString().replace(/[^\d.,]/g, '');
    
    // Αν έχει κόμμα, είναι ελληνική μορφή: τελείες = χιλιάδες, κόμμα = δεκαδικά
    if (cleaned.includes(',')) {
      // Αφαιρούμε τις τελείες (χιλιάδες) και αντικαθιστούμε κόμμα με τελεία
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
      // Αν έχει μόνο τελείες, ελέγχουμε αν είναι ελληνική μορφή ή αμερικάνικη
      // Αν η τελευταία τελεία έχει μόνο 2 ψηφία μετά = ελληνική (δεκαδικά)
      const parts = cleaned.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 2) {
        // Ελληνική: τελείες = χιλιάδες
        cleaned = cleaned.replace(/\./g, '');
      }
      // Αλλιώς αμερικάνικη: τελεία = δεκαδικά (αφήνουμε ως έχει)
    }
    
    return parseFloat(cleaned) || 0;
  };

  // Βοηθητική συνάρτηση για μορφοποίηση ποσού σε ελληνική μορφή
  const formatGreekAmount = (amount) => {
    if (!amount && amount !== 0) return '';
    
    const numAmount = typeof amount === 'number' ? amount : parseGreekAmount(amount);
    
    // Χωρίζουμε σε ακέραιο και δεκαδικό μέρος
    const integerPart = Math.floor(Math.abs(numAmount));
    const decimalPart = Math.round((Math.abs(numAmount) - integerPart) * 100);
    
    // Format ακέραιου με τελείες για χιλιάδες
    const formattedInteger = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formattedDecimal = decimalPart.toString().padStart(2, '0');
    
    return `${formattedInteger},${formattedDecimal} €`;
  };

  const calculateCumulativeAmount = (entaxi) => formatEntaxiAmount(getEntaxiCurrentTotal(entaxi));


  const exportToExcel = () => {
    if (selectedFields.length === 0) {
      showToast('Παρακαλώ επιλέξτε τουλάχιστον ένα πεδίο για εξαγωγή.', 'warning');
      return;
    }

    try {
      // Φιλτράρισμα και διάταξη πεδίων σύμφωνα με τη σειρά
      const fieldsInOrder = EXPORT_FIELDS_ORDER.filter(field => 
        selectedFields.includes(field.id)
      );
      
      // Λήψη ημερομηνίας και ώρας εξαγωγής
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const exportDateTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

      // Δημιουργία Excel Spreadsheet XML με πλήρη μορφοποίηση
      let htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Εξαγωγή Εντάξεων</Title>
    <Created>${now.toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10"/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#366092" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="EvenRow">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#F8F9FA" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="OddRow">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="BrandFooter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#4338CA"/>
      <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Εξαγωγή Εντάξεων">
    <Table>
`;

      // Column definitions
      fieldsInOrder.forEach(field => {
        htmlContent += `      <Column ss:Width="${field.width * 8}"/>\n`;
      });
      
      htmlContent += `      <Row>\n`;
      
      // Headers
      fieldsInOrder.forEach(field => {
        const escapedLabel = String(field.label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        htmlContent += `        <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapedLabel}</Data></Cell>\n`;
      });
      
      htmlContent += `      </Row>\n`;
      
      // Δεδομένα με XML formatting
      entaxeis.forEach((entaxi, index) => {
        const styleID = index % 2 === 0 ? 'EvenRow' : 'OddRow';
        htmlContent += `      <Row>\n`;
        
        fieldsInOrder.forEach(field => {
          let value = '';
          
          if (field.id === 'rowNumber') {
            value = index + 1;
          } else if (field.id === 'cumulativeAmount') {
            value = calculateCumulativeAmount(entaxi);
          } else if (field.id === 'modificationsCount') {
            value = entaxi.modifications ? entaxi.modifications.length : 0;
          } else if (field.id.startsWith('modificationDate')) {
            const modIndex = parseInt(field.id.replace('modificationDate', '')) - 1;
            const modification = entaxi.modifications && entaxi.modifications[modIndex];
            value = modification ? formatDateEl(modification.date, '') : '';
          } else if (field.id.startsWith('modificationAmount')) {
            const modIndex = parseInt(field.id.replace('modificationAmount', '')) - 1;
            const modification = entaxi.modifications && entaxi.modifications[modIndex];
            if (modification && modification.changeAmount && modification.amount) {
              // Μορφοποίηση ποσού τροποποίησης με την ίδια συνάρτηση
              value = formatGreekAmount(modification.amount);
            } else {
              value = '';
            }
          } else if (field.id.startsWith('modificationComments')) {
            const modIndex = parseInt(field.id.replace('modificationComments', '')) - 1;
            const modification = entaxi.modifications && entaxi.modifications[modIndex];
            value = modification ? (modification.comments || '') : '';
          } else {
            value = entaxi[field.id] || '';
            
            // Μορφοποίηση ειδικών πεδίων
            if ((field.id === 'documentDate' || field.id === 'createdAt' || field.id === 'updatedAt') && value) {
              value = formatDateEl(value, '');
            } else if (field.id === 'initialAmount' && value) {
              // Μορφοποίηση αρχικού ποσού με την ίδια συνάρτηση
              value = formatGreekAmount(value);
            }
          }
          
          // Escape XML characters
          value = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          
          htmlContent += `        <Cell ss:StyleID="${styleID}"><Data ss:Type="String">${value}</Data></Cell>\n`;
        });
        
        htmlContent += `      </Row>\n`;
      });

      const brandText = organizationName
        ? `${organizationName}  |  Δημιουργήθηκε με ERGOHUB`
        : 'Δημιουργήθηκε με ERGOHUB';
      htmlContent += `      <Row>
        <Cell ss:MergeAcross="${fieldsInOrder.length - 1}" ss:StyleID="BrandFooter">
          <Data ss:Type="String">${brandText}</Data>
        </Cell>
      </Row>\n`;

      htmlContent += `    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
        <Header x:Margin="0.3" x:Data="Ημερομηνία Εξαγωγής: ${exportDateTime}"/>
        <Footer x:Margin="0.3" x:Data="Σελίδα &amp;P από &amp;N"/>
      </PageSetup>
      <Print>
        <ValidPrinterInfo/>
      </Print>
    </WorksheetOptions>
  </Worksheet>
</Workbook>
      `;

      // Δημιουργία αρχείου Excel από XML
      const blob = new Blob([htmlContent], { 
        type: 'application/vnd.ms-excel' 
      });
      
      const fileName = `Εξαγωγή_Εντάξεων_${day}-${month}-${year}.xls`;
      
      // Δημιουργία download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Κλείσιμο modal μετά την επιτυχή εξαγωγή
      onClose();
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Προέκυψε σφάλμα κατά την εξαγωγή. Παρακαλώ δοκιμάστε ξανά.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <ExportOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ExportContainer>
        <Header>
          <Title>Εξαγωγή Εντάξεων</Title>
          <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
        </Header>

        <InfoBox>
          <InfoTitle>Πληροφορίες Εξαγωγής</InfoTitle>
          <InfoText>
            Θα εξαχθούν οι εντάξεις που προβάλλονται αυτή τη στιγμή στην εφαρμογή 
            (συμπεριλαμβανομένων των ενεργών φίλτρων). Επιλέξτε τα πεδία που θέλετε 
            να συμπεριληφθούν στο αρχείο Excel.
          </InfoText>
        </InfoBox>

        <StatsBox>
          <StatItem>
            <StatNumber>{totalEntaxeis}</StatNumber>
            <StatLabel>Συνολικά Εντάξεις</StatLabel>
          </StatItem>
          <StatItem>
            <StatNumber>{entaxeis.length}</StatNumber>
            <StatLabel>Προς Εξαγωγή</StatLabel>
          </StatItem>
          <StatItem>
            <StatNumber>{selectedFields.length}</StatNumber>
            <StatLabel>Επιλεγμένα Πεδία</StatLabel>
          </StatItem>
        </StatsBox>

        {Object.values(EXPORT_FIELDS).map(section => (
          <FieldsSection key={section.title}>
            <SectionTitle>
              {section.title}
              <SelectAllButton 
                onClick={() => {
                  const sectionFields = section.fields.map(f => f.id);
                  const allSelected = sectionFields.every(id => selectedFields.includes(id));
                  if (allSelected) {
                    setSelectedFields(prev => prev.filter(id => !sectionFields.includes(id)));
                  } else {
                    setSelectedFields(prev => [...new Set([...prev, ...sectionFields])]);
                  }
                }}
              >
                {section.fields.every(f => selectedFields.includes(f.id)) ? 'Αποεπιλογή' : 'Επιλογή Όλων'}
              </SelectAllButton>
            </SectionTitle>
            <FieldsGrid>
              {section.fields.map(field => (
                <FieldItem key={field.id}>
                  <Checkbox
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                  />
                  <FieldLabel>{field.label}</FieldLabel>
                </FieldItem>
              ))}
            </FieldsGrid>
          </FieldsSection>
        ))}

        <ActionsBar>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <ActionButton onClick={handleSelectAll}>
              Επιλογή Όλων
            </ActionButton>
            <ActionButton onClick={handleDeselectAll}>
              Αποεπιλογή Όλων
            </ActionButton>
          </div>
          <ActionButton 
            primary 
            onClick={exportToExcel}
            disabled={selectedFields.length === 0}
          >
            📊 Εξαγωγή σε Excel
          </ActionButton>
        </ActionsBar>
      </ExportContainer>
    </ExportOverlay>
  );
}

export default EntaxisExportDialog;
