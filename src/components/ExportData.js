import React, { useState } from 'react';
import styled from 'styled-components';
import { getCharacterization } from '../data/formOptions';
import { useToast } from './ToastProvider';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { formatDateEl } from '../utils/dateFormat';
import {
  getProjectAnadoxosNamesExport,
  getProjectAnadoxosVatsExport,
  getProjectKhmdhsAdamExport,
  getProjectAssignmentProcedureExport
} from '../utils/contractorFields';
import {
  KHMDHS_NOTICE_EXPORT_FIELDS,
  getKhmdhsNoticeExportValue,
  isKhmdhsNoticeExportField
} from '../utils/khmdhsExportFields';

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
  max-width: 800px;
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

const WarningBanner = styled.div`
  background: linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%);
  color: white;
  padding: 1.2rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  animation: slideIn 0.4s ease;

  @keyframes slideIn {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const WarningIcon = styled.div`
  font-size: 2rem;
  line-height: 1;
`;

const WarningContent = styled.div`
  flex: 1;
`;

const WarningTitle = styled.div`
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
  letter-spacing: 0.3px;
`;

const WarningText = styled.div`
  font-size: 0.95rem;
  opacity: 0.95;
  line-height: 1.4;
`;

const InfoBanner = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.2rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
`;

const InfoIcon = styled.div`
  font-size: 2rem;
  line-height: 1;
`;

const InfoContent = styled.div`
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.4;
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

// Removed unused styled components

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

// Σειρά στηλών σύμφωνα με τις προδιαγραφές
const EXPORT_FIELDS_ORDER = [
  { id: 'rowNumber', label: 'Α/Α', width: 8 },
  { id: 'kaCode', label: 'Κωδικός ΚΑ', width: 14 },
  { id: 'aleCode', label: 'Κωδ. Α.Λ.Ε.', width: 16 },
  { id: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', width: 40 },
  { id: 'subprojectTitle', label: 'Τίτλος Υποέργου', width: 40 },
  { id: 'projectType', label: 'Είδος Υποέργου', width: 25 },
  { id: 'misPraxhsName', label: 'Όνομα Κωδικού Πράξης', width: 20 },
  { id: 'misPraxhsCode', label: 'Κωδικός Πράξης', width: 20 },
  { id: 'approvedAmount', label: 'Εγκεκριμένο Ποσό', width: 16 },
  { id: 'projectBudget', label: 'Προϋπολογισμός', width: 16 },
  { id: 'remainingAmount', label: 'Υπόλοιπα για το Έτος', width: 18 },
  { id: 'remainingAmountYear', label: 'Έτος Υπολοίπων', width: 12 },
  { id: 'remainingAmountComments', label: 'Σχόλια Υπολοίπων', width: 25 },
  { id: 'fundingSource', label: 'Βασική Πηγή Χρηματοδότησης', width: 25 },
  { id: 'fundingDetails', label: 'Εξειδίκευση Πηγής Χρηματοδότησης', width: 35 },
  { id: 'projectStatus', label: 'Κατάσταση Υποέργου', width: 25 },
  { id: 'assignmentProcedure', label: 'Διαδικασία Ανάθεσης', width: 40 },
  { id: 'anadoxosName', label: 'Επωνυμία Αναδόχου (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'anadoxosVat', label: 'ΑΦΜ Αναδόχου (ΚΗΜΔΗΣ)', width: 18 },
  { id: 'khmdhsAdam', label: 'ΑΔΑΜ Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'contractProcessStartDate', label: 'Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης', width: 30 },
  { id: 'contractDate', label: 'Ημερομηνία Υπογραφής Σύμβασης', width: 18 },
  { id: 'contractAmount', label: 'Ποσό Σύμβασης', width: 16 },
  { id: 'apeAmount', label: 'ΑΠΕ + Συμπληρωματικές Συμβάσεις', width: 22 },
  { id: 'chargeTo', label: 'Χρεωμένο σε', width: 25 },
  { id: 'chargeParticipants', label: 'Συμμετέχουν', width: 30 },
  { id: 'comments', label: 'Σχόλια', width: 40 },
  { id: 'eisigitikiEkthesi', label: 'Αναφορά από πρόγραμμα Οικονομικής', width: 60 },
  { id: 'characterization', label: 'Χαρακτηρισμός (ΝΕΟ/ΣΥΝΕΧΙΖΟΜΕΝΟ)', width: 30 },
  ...KHMDHS_NOTICE_EXPORT_FIELDS
];

// Διαθέσιμα πεδία για εξαγωγή (για το UI)
const EXPORT_FIELDS = {
  basic: {
    title: '📋 Βασικά Στοιχεία',
    fields: [
      { id: 'rowNumber', label: 'Α/Α', width: 8 },
      { id: 'kaCode', label: 'Κωδικός ΚΑ', width: 14 },
      { id: 'aleCode', label: 'Κωδ. Α.Λ.Ε.', width: 16 },
      { id: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', width: 40 },
      { id: 'subprojectTitle', label: 'Τίτλος Υποέργου', width: 40 },
      { id: 'projectType', label: 'Είδος Υποέργου', width: 25 },
      { id: 'misPraxhs', label: 'Όνομα & Κωδικός Πράξης', width: 30, linkedFields: ['misPraxhsName', 'misPraxhsCode'] },
    ]
  },
  financial: {
    title: '💰 Οικονομικά Στοιχεία',
    fields: [
      { id: 'approvedAmount', label: 'Εγκεκριμένο Ποσό', width: 16 },
      { id: 'projectBudget', label: 'Προϋπολογισμός', width: 16 },
      { id: 'remainingAmount', label: 'Υπόλοιπα για το Έτος', width: 18 },
      { id: 'remainingAmountYear', label: 'Έτος Υπολοίπων', width: 12 },
      { id: 'fundingSource', label: 'Βασική Πηγή Χρηματοδότησης', width: 25 },
      { id: 'fundingDetails', label: 'Εξειδίκευση Πηγής Χρηματοδότησης', width: 35 },
    ]
  },
  status: {
    title: '📊 Κατάσταση & Πρόοδος',
    fields: [
      { id: 'projectStatus', label: 'Κατάσταση Υποέργου', width: 25 },
      { id: 'assignmentProcedure', label: 'Διαδικασία Ανάθεσης', width: 40 },
      { id: 'anadoxosName', label: 'Επωνυμία Αναδόχου (ΚΗΜΔΗΣ)', width: 35 },
      { id: 'anadoxosVat', label: 'ΑΦΜ Αναδόχου (ΚΗΜΔΗΣ)', width: 18 },
      { id: 'khmdhsAdam', label: 'ΑΔΑΜ Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
      { id: 'contractProcessStartDate', label: 'Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης', width: 30 },
      { id: 'contractDate', label: 'Ημερομηνία Υπογραφής Σύμβασης', width: 18 },
      { id: 'contractAmount', label: 'Ποσό Σύμβασης', width: 16 },
      { id: 'apeAmount', label: 'ΑΠΕ + Συμπληρωματικές Συμβάσεις', width: 22 },
    ]
  },
  contractor: {
    title: '🏢 Ανάδοχος & Ανάθεση',
    fields: [
      { id: 'assignmentProcedure', label: 'Διαδικασία Ανάθεσης', width: 40 },
      { id: 'anadoxosName', label: 'Επωνυμία Αναδόχου (ΚΗΜΔΗΣ)', width: 35 },
      { id: 'anadoxosVat', label: 'ΑΦΜ Αναδόχου (ΚΗΜΔΗΣ)', width: 18 },
      { id: 'khmdhsAdam', label: 'ΑΔΑΜ Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
    ]
  },
  additional: {
    title: '📝 Επιπλέον Στοιχεία',
    fields: [
      { id: 'chargeTo', label: 'Χρεωμένο σε', width: 25 },
      { id: 'chargeParticipants', label: 'Συμμετέχουν', width: 30 },
      { id: 'remainingAmountComments', label: 'Σχόλια Υπολοίπων', width: 25 },
      { id: 'comments', label: 'Σχόλια', width: 40 },
      { id: 'eisigitikiEkthesi', label: 'Αναφορά από πρόγραμμα Οικονομικής', width: 60 },
      { id: 'characterization', label: 'Χαρακτηρισμός (ΝΕΟ/ΣΥΝΕΧΙΖΟΜΕΝΟ)', width: 30 },
    ]
  },
  procurement: {
    title: '📢 Δημοσίευση (ΚΗΜΔΗΣ)',
    fields: KHMDHS_NOTICE_EXPORT_FIELDS.map((f) => ({ ...f }))
  }
};

const APP_NAME = 'ERGOHUB';

function xmlEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ExportData({ isOpen, onClose, projects, totalProjects, organizationName = '', appVersion = '' }) {
  const { showToast } = useToast();
  const [selectedFields, setSelectedFields] = useState([
    'rowNumber', 'kaCode', 'aleCode', 'projectTitle', 'subprojectTitle', 'projectType', 'fundingSource', 'fundingDetails', 'projectStatus'
  ]);

  const handleFieldChange = (fieldId, checked) => {
    // Βρες το field definition για να δεις αν έχει linkedFields
    let fieldDef = null;
    for (const section of Object.values(EXPORT_FIELDS)) {
      const found = section.fields.find(f => f.id === fieldId);
      if (found) {
        fieldDef = found;
        break;
      }
    }

    if (checked) {
      setSelectedFields(prev => {
        const newFields = [...prev, fieldId];
        // Αν το field έχει linkedFields, προσθέστε και αυτά
        if (fieldDef && fieldDef.linkedFields) {
          fieldDef.linkedFields.forEach(linkedFieldId => {
            if (!newFields.includes(linkedFieldId)) {
              newFields.push(linkedFieldId);
            }
          });
        }
        return newFields;
      });
    } else {
      setSelectedFields(prev => {
        const filtered = prev.filter(id => id !== fieldId);
        // Αν το field έχει linkedFields, αφαίρεσε και αυτά
        if (fieldDef && fieldDef.linkedFields) {
          return filtered.filter(id => !fieldDef.linkedFields.includes(id));
        }
        return filtered;
      });
    }
  };

  const handleSelectAll = () => {
    const allFields = [];
    Object.values(EXPORT_FIELDS).forEach(section => {
      section.fields.forEach(field => {
        allFields.push(field.id);
        // Αν το field έχει linkedFields, προσθέστε και αυτά
        if (field.linkedFields) {
          field.linkedFields.forEach(linkedFieldId => {
            if (!allFields.includes(linkedFieldId)) {
              allFields.push(linkedFieldId);
            }
          });
        }
      });
    });
    setSelectedFields(allFields);
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

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
      const versionSuffix = appVersion ? ` v${appVersion}` : '';
      const brandHeaderText = organizationName
        ? `${APP_NAME}${versionSuffix} — Εξαγωγή Δεδομένων | ${organizationName} | ${exportDateTime}`
        : `${APP_NAME}${versionSuffix} — Εξαγωγή Δεδομένων | ${exportDateTime}`;
      const brandFooterText = organizationName
        ? `${organizationName} | Δημιουργήθηκε με ${APP_NAME}${versionSuffix}`
        : `Δημιουργήθηκε με ${APP_NAME}${versionSuffix}`;
      const mergeAcross = Math.max(0, fieldsInOrder.length - 1);

      // Δημιουργία Excel Spreadsheet XML με πλήρη μορφοποίηση
      let htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${APP_NAME} — Εξαγωγή Δεδομένων</Title>
    <Author>${APP_NAME}</Author>
    <Company>${APP_NAME}</Company>
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
    <Style ss:ID="BrandHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
      </Borders>
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
  <Worksheet ss:Name="Εξαγωγή Έργων">
    <Table>
`;

      // Column definitions
      fieldsInOrder.forEach(field => {
        htmlContent += `      <Column ss:Width="${field.width * 8}"/>\n`;
      });

      htmlContent += `      <Row ss:Height="30">
        <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="BrandHeader">
          <Data ss:Type="String">${xmlEsc(brandHeaderText)}</Data>
        </Cell>
      </Row>\n`;

      htmlContent += `      <Row>\n`;
      
      // Headers
      fieldsInOrder.forEach(field => {
        htmlContent += `        <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${xmlEsc(field.label)}</Data></Cell>\n`;
      });
      
      htmlContent += `      </Row>\n`;
      
      // Δεδομένα με XML formatting
      projects.forEach((project, index) => {
        const styleID = index % 2 === 0 ? 'EvenRow' : 'OddRow';
        htmlContent += `      <Row>\n`;
        
        fieldsInOrder.forEach(field => {
          let value = '';
          
          if (field.id === 'rowNumber') {
            value = index + 1;
          } else if (field.id === 'aleCode') {
            // Ειδική μορφοποίηση για aleCodes - join με bullet
            if (project.aleCodes && Array.isArray(project.aleCodes) && project.aleCodes.length > 0) {
              value = project.aleCodes.filter(c => c && c.trim()).join(' • ');
            } else if (project.aleCode) {
              value = project.aleCode;
            } else {
              value = '';
            }
          } else if (field.id === 'characterization') {
            value = getCharacterization(project) || '';
          } else if (field.id === 'chargeTo') {
            value = getProjectChargeDisplay(project, []).displayChargePrimary;
          } else if (field.id === 'chargeParticipants') {
            value = getProjectChargeDisplay(project, []).displayChargeParticipants;
          } else if (field.id === 'anadoxosName') {
            value = getProjectAnadoxosNamesExport(project);
          } else if (field.id === 'anadoxosVat') {
            value = getProjectAnadoxosVatsExport(project);
          } else if (field.id === 'khmdhsAdam') {
            value = getProjectKhmdhsAdamExport(project);
          } else if (field.id === 'assignmentProcedure') {
            value = getProjectAssignmentProcedureExport(project);
          } else if (isKhmdhsNoticeExportField(field.id)) {
            value = getKhmdhsNoticeExportValue(project, field.id);
          } else {
            value = project[field.id] || '';
            
            // Μορφοποίηση ειδικών πεδίων
            if ((field.id === 'contractDate' || field.id === 'contractProcessStartDate') && value) {
              value = formatDateEl(value, '');
            }
          }
          
          // Escape XML characters
          value = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          
          htmlContent += `        <Cell ss:StyleID="${styleID}"><Data ss:Type="String">${value}</Data></Cell>\n`;
        });
        
        htmlContent += `      </Row>\n`;
      });

      htmlContent += `      <Row>
        <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="BrandFooter">
          <Data ss:Type="String">${xmlEsc(brandFooterText)}</Data>
        </Cell>
      </Row>\n`;

      htmlContent += `    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
        <Header x:Margin="0.3" x:Data="${APP_NAME} | Ημερομηνία Εξαγωγής: ${exportDateTime}"/>
        <Footer x:Margin="0.3" x:Data="${APP_NAME} | Σελίδα &amp;P από &amp;N"/>
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
      
      const fileName = `${APP_NAME}_Εξαγωγή_Έργων_${day}-${month}-${year}.xls`;
      
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
          <Title>Εξαγωγή Δεδομένων</Title>
          <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
        </Header>

        {/* Warning Banner when filters are active */}
        {projects.length < totalProjects && (
          <WarningBanner>
            <WarningIcon>⚠️</WarningIcon>
            <WarningContent>
              <WarningTitle>Ενεργά Φίλτρα</WarningTitle>
              <WarningText>
                Θα εξαχθούν μόνο {projects.length} από τα {totalProjects} συνολικά υποέργα. 
                Εάν θέλετε να εξάγετε όλα τα υποέργα, καθαρίστε τα φίλτρα πρώτα.
              </WarningText>
            </WarningContent>
          </WarningBanner>
        )}

        {/* Info Banner when no filters */}
        {projects.length === totalProjects && (
          <InfoBanner>
            <InfoIcon>ℹ️</InfoIcon>
            <InfoContent>
              Θα εξαχθούν όλα τα {totalProjects} υποέργα. Επιλέξτε τα πεδία που θέλετε να συμπεριληφθούν στο αρχείο Excel.
            </InfoContent>
          </InfoBanner>
        )}

        <StatsBox>
          <StatItem>
            <StatNumber>{totalProjects}</StatNumber>
            <StatLabel>Συνολικά Έργα</StatLabel>
          </StatItem>
          <StatItem>
            <StatNumber>{projects.length}</StatNumber>
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
              {section.fields.map(field => {
                // Για fields με linkedFields, ελέγξε αν είναι επιλεγμένα και τα linkedFields
                let isChecked = false;
                if (field.linkedFields) {
                  isChecked = field.linkedFields.every(linkedFieldId => selectedFields.includes(linkedFieldId));
                } else {
                  isChecked = selectedFields.includes(field.id);
                }
                
                return (
                  <FieldItem key={field.id}>
                    <Checkbox
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                    />
                    <FieldLabel>{field.label}</FieldLabel>
                  </FieldItem>
                );
              })}
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

export default ExportData;
