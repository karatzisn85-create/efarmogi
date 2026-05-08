import React, { useState } from 'react';
import styled from 'styled-components';

// Styled Components
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
  z-index: 2000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 15px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  padding: 2rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border-radius: 15px 15px 0 0;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ModalContent = styled.div`
  padding: 2rem;
`;

const ExportInfo = styled.div`
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #1565c0;
  font-size: 0.9rem;
`;

const SectionTitle = styled.h3`
  color: #333;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FieldsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const FieldGroup = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e9ecef;
`;

const FieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.3rem 0;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

const FieldLabel = styled.label`
  font-size: 0.9rem;
  color: #495057;
  cursor: pointer;
  flex: 1;
  line-height: 1.4;
`;

const ActionsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
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

const DeselectAllButton = styled.button`
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
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
    background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
  }
`;

const ExportButton = styled.button`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #545b62;
    transform: translateY(-1px);
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

// Σειρά στηλών σύμφωνα με τις προδιαγραφές
const EXPORT_FIELDS_ORDER = [
  { id: 'rowNumber', label: 'Α/Α', width: 8 },
  { id: 'title', label: 'Τίτλος Πρόσκλησης', width: 40 },
  { id: 'axis', label: 'Άξονας/Δράση', width: 30 },
  { id: 'fundingSource', label: 'Πηγή Χρηματοδότησης', width: 40 },
  { id: 'code', label: 'Κωδικός & Α/Α ΟΠΣ', width: 20 },
  { id: 'deadline', label: 'Ημερομηνία Λήξης', width: 16 },
  { id: 'budgetRange', label: 'Εύρος Προϋπολογισμού', width: 20 },
  { id: 'status', label: 'Κατάσταση', width: 18 },
  { id: 'createdAt', label: 'Ημερομηνία Δημιουργίας', width: 18 },
  { id: 'updatedAt', label: 'Τελευταία Ενημέρωση', width: 18 },
  { id: 'modificationsCount', label: 'Αριθμός Τροποποιήσεων', width: 20 }
];

// Διαθέσιμα πεδία για εξαγωγή (για το UI)
const EXPORT_FIELDS = {
  basic: {
    title: '📋 Βασικά Στοιχεία',
    fields: [
      { id: 'rowNumber', label: 'Α/Α', width: 8 },
      { id: 'title', label: 'Τίτλος Πρόσκλησης', width: 40 },
      { id: 'axis', label: 'Άξονας/Δράση', width: 30 },
      { id: 'code', label: 'Κωδικός & Α/Α ΟΠΣ', width: 20 },
      { id: 'status', label: 'Κατάσταση', width: 18 }
    ]
  },
  funding: {
    title: '💰 Χρηματοδότηση',
    fields: [
      { id: 'fundingSource', label: 'Πηγή Χρηματοδότησης', width: 40 },
      { id: 'budgetRange', label: 'Εύρος Προϋπολογισμού', width: 20 }
    ]
  },
  dates: {
    title: '📅 Ημερομηνίες',
    fields: [
      { id: 'deadline', label: 'Ημερομηνία Λήξης', width: 16 },
      { id: 'createdAt', label: 'Ημερομηνία Δημιουργίας', width: 18 },
      { id: 'updatedAt', label: 'Τελευταία Ενημέρωση', width: 18 }
    ]
  },
  modifications: {
    title: '⚡ Τροποποιήσεις',
    fields: [
      { id: 'modificationsCount', label: 'Αριθμός Τροποποιήσεων', width: 20 }
    ]
  }
};

function ProsklisisExportDialog({ isOpen, onClose, proskliseis, totalProskliseis }) {
  const [selectedFields, setSelectedFields] = useState([
    'rowNumber', 'title', 'axis', 'fundingSource', 'code', 'deadline', 'budgetRange', 'status'
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const exportToExcel = () => {
    if (selectedFields.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον ένα πεδίο για εξαγωγή.');
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
    <Title>Εξαγωγή Προσκλήσεων</Title>
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
  </Styles>
  <Worksheet ss:Name="Εξαγωγή Προσκλήσεων">
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
      proskliseis.forEach((prosklisi, index) => {
        const styleID = index % 2 === 0 ? 'EvenRow' : 'OddRow';
        htmlContent += `      <Row>\n`;
        
        fieldsInOrder.forEach(field => {
          let value = '';
          
          if (field.id === 'rowNumber') {
            value = index + 1;
          } else if (field.id === 'deadline' || field.id === 'createdAt' || field.id === 'updatedAt') {
            value = formatDate(prosklisi[field.id]);
          } else if (field.id === 'modificationsCount') {
            // Υπολογισμός αριθμού τροποποιήσεων (αν υπάρχει)
            value = prosklisi.modifications ? prosklisi.modifications.length : 0;
          } else {
            value = prosklisi[field.id] || '';
          }
          
          // Escape XML characters
          value = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          
          htmlContent += `        <Cell ss:StyleID="${styleID}"><Data ss:Type="String">${value}</Data></Cell>\n`;
        });
        
        htmlContent += `      </Row>\n`;
      });

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
      
      const fileName = `Εξαγωγή_Προσκλήσεων_${day}-${month}-${year}.xls`;
      
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
      console.error('Error exporting proskliseis:', error);
      alert('Σφάλμα κατά την εξαγωγή: ' + error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>📊 Εξαγωγή Προσκλήσεων σε Excel</ModalTitle>
          <CloseButton onClick={onClose}>✖</CloseButton>
        </ModalHeader>

        <ModalContent>
          <ExportInfo>
            <strong>ℹ️ Πληροφορίες:</strong> Θα εξαχθούν {proskliseis.length} από {totalProskliseis} προσκλήσεις. 
            Επιλέξτε τα πεδία που θέλετε να περιλαμβάνονται στο αρχείο Excel.
          </ExportInfo>

          <SectionTitle>📋 Επιλογή Πεδίων Εξαγωγής</SectionTitle>
          
          <FieldsContainer>
            {Object.entries(EXPORT_FIELDS).map(([sectionKey, section]) => (
              <FieldGroup key={sectionKey}>
                <SectionTitle style={{ fontSize: '1rem', marginBottom: '0.8rem' }}>
                  {section.title}
                </SectionTitle>
                {section.fields.map(field => (
                  <FieldItem key={field.id}>
                    <Checkbox
                      type="checkbox"
                      id={field.id}
                      checked={selectedFields.includes(field.id)}
                      onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                    />
                    <FieldLabel htmlFor={field.id}>
                      {field.label}
                    </FieldLabel>
                  </FieldItem>
                ))}
              </FieldGroup>
            ))}
          </FieldsContainer>

          <ActionsContainer>
            <div>
              <SelectAllButton onClick={handleSelectAll}>
                ✅ Επιλογή Όλων
              </SelectAllButton>
              <DeselectAllButton onClick={handleDeselectAll} style={{ marginLeft: '0.5rem' }}>
                ❌ Απαλοιφή Όλων
              </DeselectAllButton>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
              Επιλεγμένα: {selectedFields.length} πεδία
            </div>
          </ActionsContainer>

          <ButtonContainer>
            <CancelButton onClick={onClose}>
              Ακύρωση
            </CancelButton>
            <ExportButton 
              onClick={exportToExcel}
              disabled={selectedFields.length === 0}
            >
              📊 Εξαγωγή σε Excel
            </ExportButton>
          </ButtonContainer>
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
}

export default ProsklisisExportDialog;