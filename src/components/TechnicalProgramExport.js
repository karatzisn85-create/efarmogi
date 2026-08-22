import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { getCharacterization } from '../data/formOptions';
import { useToast } from './ToastProvider';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import {
  getProjectAnadoxosNamesExport,
  getProjectAnadoxosVatsExport,
  getProjectKhmdhsAdamExport,
  getProjectAssignmentProcedureExport
} from '../utils/contractorFields';
import {
  KHMDHS_NOTICE_EXPORT_FIELDS,
  getKhmdhsNoticeExportValue
} from '../utils/khmdhsExportFields';
import {
  getProjectContractTotalForExport,
  getProjectApeAmountForExport,
} from '../utils/khmdhsExportHelpers';
import EpProgramStatsPanel from './EpProgramStatsPanel';
import reportsExport from '../../app/core/reportsExport';

const ExportOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 3vh;
  overflow-y: auto;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ExportContainer = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 2.5rem 3rem;
  max-width: ${props => props.$wide ? '1180px' : '960px'};
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  border: 1px solid #e0e0e0;
  margin-bottom: 2rem;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 3px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 2px solid #e9ecef;
`;

const Title = styled.h2`
  color: #1a237e;
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;

  &::before {
    content: "📋";
    font-size: 1.4rem;
  }
`;

const PageTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.35rem;
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
`;

const PageTab = styled.button`
  flex: 1;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$active ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#475569'};
  box-shadow: ${p => p.$active ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'};
  &:hover { opacity: 0.92; }
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.6rem 1.3rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }
`;

const TopRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const SectionCard = styled.div`
  background: ${props => props.bg || '#f8f9fa'};
  border: 1.5px solid ${props => props.borderColor || '#dee2e6'};
  border-radius: 12px;
  padding: 1.2rem 1.4rem;
`;

const SectionTitle = styled.div`
  font-weight: 700;
  color: ${props => props.color || '#495057'};
  font-size: 0.9rem;
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const YearSelect = styled.select`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const ColumnsSection = styled.div`
  background: #f8f9fa;
  border: 1.5px solid #dee2e6;
  border-radius: 12px;
  padding: 1.4rem 1.6rem;
  margin-bottom: 1.5rem;
`;

const ColumnGroupsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.2rem;
  margin-top: 0.8rem;
`;

const ColumnGroup = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1rem 1.2rem;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
`;

const GroupHeader = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: ${props => props.color || '#5c6bc0'};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.7rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid ${props => props.borderColor || '#e8eaf6'};
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  opacity: ${props => props.disabled ? 0.55 : 1};
  user-select: none;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: ${props => props.disabled ? 'transparent' : '#f0f4ff'};
  }
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 16px;
  height: 16px;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  accent-color: #3f51b5;
  flex-shrink: 0;
`;

const CheckboxLabel = styled.span`
  font-size: 0.88rem;
  color: ${props => props.muted ? '#999' : '#333'};
  font-weight: ${props => props.bold ? 600 : 400};
`;

const Tag = styled.span`
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  margin-left: 0.3rem;
  background: ${props => props.bg || '#e8eaf6'};
  color: ${props => props.color || '#3f51b5'};
`;

const ToggleAllButton = styled.button`
  background: none;
  border: 1px solid #bbb;
  border-radius: 6px;
  padding: 0.25rem 0.7rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: #555;
  transition: all 0.15s;
  margin-left: auto;

  &:hover {
    background: #e8eaf6;
    border-color: #5c6bc0;
    color: #3f51b5;
  }
`;

const PreviewBar = styled.div`
  margin-top: 1rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(135deg, #e3f2fd 0%, #ede7f6 100%);
  border-radius: 8px;
  font-size: 0.78rem;
  color: #283593;
  line-height: 1.6;
`;

const StatsBox = styled.div`
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border: 1.5px solid #c8e6c9;
  border-radius: 12px;
  padding: 1.2rem 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const StatItem = styled.div`
  text-align: center;
  min-width: 80px;
`;

const StatNumber = styled.div`
  font-size: 1.6rem;
  font-weight: 800;
  color: #2e7d32;
`;

const StatLabel = styled.div`
  font-size: 0.72rem;
  color: #388e3c;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const ActionsBar = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 1.5rem;
  border-top: 2px solid #e9ecef;
  gap: 1rem;
`;

const ActionButton = styled.button`
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => props.primary ? `
    background: linear-gradient(135deg, #2e7d32 0%, #388e3c 100%);
    color: white;
    
    &:hover {
      background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(46, 125, 50, 0.35);
    }

    &:disabled {
      background: #bdbdbd;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  ` : `
    background: #78909c;
    color: white;
    
    &:hover {
      background: #546e7a;
    }
  `}
`;

const COLUMN_DEFINITIONS = [
  { key: 'aa', label: 'Α/Α', mandatory: true, group: 'basic', width: 50, type: 'number' },
  { key: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', mandatory: false, group: 'basic', width: 280, type: 'string', defaultOn: true },
  { key: 'subprojectTitle', label: 'Τίτλος Υποέργου', mandatory: true, group: 'basic', width: 300, type: 'string' },
  { key: 'implementationForm', label: 'Μορφή Υλοποίησης', mandatory: false, group: 'basic', width: 150, type: 'string' },
  { key: 'projectType', label: 'Είδος Έργου', mandatory: false, group: 'basic', width: 130, type: 'string' },
  { key: 'projectStatus', label: 'Κατάσταση', mandatory: false, group: 'basic', width: 130, type: 'string' },

  { key: 'kaCode', label: 'Κωδ. Κ.Α.', mandatory: false, group: 'codes', width: 120, type: 'string' },
  { key: 'aleCode', label: 'Κωδ. Α.Λ.Ε.', mandatory: false, group: 'codes', width: 130, type: 'string', defaultOn: true },
  { key: 'misPraxhsCode', label: 'Κωδ. MIS Πράξης', mandatory: false, group: 'codes', width: 140, type: 'string' },
  { key: 'misPraxhsName', label: 'Ονομασία MIS Πράξης', mandatory: false, group: 'codes', width: 250, type: 'string' },

  { key: 'fundingSource', label: 'Πηγή Χρηματοδότησης', mandatory: false, group: 'financial', width: 180, type: 'string' },
  { key: 'fundingDetails', label: 'Λεπτομέρειες Χρηματοδότησης', mandatory: false, group: 'financial', width: 220, type: 'string' },
  { key: 'approvedAmount', label: 'Εγκεκριμένο Ποσό', mandatory: false, group: 'financial', width: 140, type: 'amount' },
  { key: 'projectBudget', label: 'Προϋπολογισμός', mandatory: false, group: 'financial', width: 140, type: 'amount' },
  { key: 'amount', label: 'YEAR_PLACEHOLDER', mandatory: true, group: 'financial', width: 140, type: 'amount' },

  { key: 'contractDate', label: 'Ημ. Σύμβασης', mandatory: false, group: 'contract', width: 120, type: 'string' },
  { key: 'contractAmount', label: 'Ποσό Σύμβασης', mandatory: false, group: 'contract', width: 140, type: 'amount' },
  { key: 'contractProcessStartDate', label: 'Ημ. Έναρξης Διαδ. Σύμβασης', mandatory: false, group: 'contract', width: 180, type: 'string' },
  { key: 'assignmentProcedure', label: 'Διαδικασία Ανάθεσης', mandatory: false, group: 'contract', width: 220, type: 'string' },
  { key: 'anadoxosName', label: 'Επωνυμία Αναδόχου', mandatory: false, group: 'contract', width: 240, type: 'string' },
  { key: 'anadoxosVat', label: 'ΑΦΜ Αναδόχου', mandatory: false, group: 'contract', width: 140, type: 'string' },
  { key: 'khmdhsAdam', label: 'ΑΔΑΜ (ΚΗΜΔΗΣ)', mandatory: false, group: 'contract', width: 160, type: 'string' },
  { key: 'apeAmount', label: 'Ποσό ΑΠΕ', mandatory: false, group: 'contract', width: 130, type: 'amount' },
  { key: 'apeComments', label: 'Σχόλια ΑΠΕ', mandatory: false, group: 'contract', width: 200, type: 'string' },

  { key: 'chargeTo', label: 'Χρεωμένο σε', mandatory: false, group: 'other', width: 160, type: 'string' },
  { key: 'chargeParticipants', label: 'Συμμετέχουν', mandatory: false, group: 'other', width: 200, type: 'string' },
  { key: 'comments', label: 'Σχόλια', mandatory: false, group: 'other', width: 250, type: 'string' },
  { key: 'remainingAmountComments', label: 'Σχόλια Υπολοίπου', mandatory: false, group: 'other', width: 220, type: 'string' },
  { key: 'eisigitikiEkthesi', label: 'Αναφορά από πρόγραμμα Οικονομικής', mandatory: false, group: 'other', width: 350, type: 'string' },
  { key: 'characterization', label: 'Χαρακτηρισμός (ΝΕΟ/ΣΥΝΕΧΙΖΟΜΕΝΟ)', mandatory: false, group: 'other', width: 200, type: 'string' },

  ...KHMDHS_NOTICE_EXPORT_FIELDS.map((f) => ({
    key: f.id,
    label: f.label,
    mandatory: false,
    group: 'procurement',
    width: Math.min(350, Math.max(120, (f.width || 20) * 8)),
    type: 'string'
  })),
];

const GROUPS = [
  { id: 'basic', label: 'Βασικά Στοιχεία', icon: '📄', color: '#1565c0', borderColor: '#bbdefb' },
  { id: 'codes', label: 'Κωδικοί', icon: '🔢', color: '#6a1b9a', borderColor: '#e1bee7' },
  { id: 'financial', label: 'Οικονομικά', icon: '💰', color: '#2e7d32', borderColor: '#c8e6c9' },
  { id: 'contract', label: 'Σύμβαση / ΑΠΕ', icon: '📝', color: '#e65100', borderColor: '#ffe0b2' },
  { id: 'procurement', label: 'Δημοσίευση (ΚΗΜΔΗΣ)', icon: '📢', color: '#c62828', borderColor: '#ffcdd2' },
  { id: 'other', label: 'Λοιπά', icon: '📌', color: '#455a64', borderColor: '#cfd8dc' },
];

function TechnicalProgramExport({ isOpen, onClose, projects, organizationName = '', currentUser, appConfig = {} }) {
  const { showToast } = useToast();
  const [pageView, setPageView] = useState('technical'); // 'technical' | 'epStats'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const defaultSelected = COLUMN_DEFINITIONS
    .filter(c => c.mandatory || c.defaultOn)
    .reduce((acc, c) => ({ ...acc, [c.key]: true }), {});

  const [selectedColumns, setSelectedColumns] = useState(defaultSelected);

  const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

  const exportRows = useMemo(
    () => reportsExport.buildTechnicalProgramRows(projects, selectedYear),
    [projects, selectedYear]
  );

  const toggleColumn = (key) => {
    const col = COLUMN_DEFINITIONS.find(c => c.key === key);
    if (col.mandatory) return;
    setSelectedColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroup = (groupId) => {
    const groupCols = COLUMN_DEFINITIONS.filter(c => c.group === groupId && !c.mandatory);
    const allOn = groupCols.every(c => selectedColumns[c.key]);
    const newState = { ...selectedColumns };
    groupCols.forEach(c => { newState[c.key] = !allOn; });
    setSelectedColumns(newState);
  };

  const selectAll = () => {
    const newState = { ...selectedColumns };
    COLUMN_DEFINITIONS.forEach(c => { newState[c.key] = true; });
    setSelectedColumns(newState);
  };

  const selectMandatoryOnly = () => {
    const newState = {};
    COLUMN_DEFINITIONS.forEach(c => { newState[c.key] = c.mandatory || false; });
    setSelectedColumns(newState);
  };

  const activeColumns = COLUMN_DEFINITIONS.filter(c => selectedColumns[c.key]).map(c => ({
    ...c,
    label: c.key === 'amount' ? `ΠΡΟΤΑΘΕΝΤΑ ${selectedYear}` : c.label
  }));

  const optionalSelectedCount = COLUMN_DEFINITIONS.filter(c => !c.mandatory && selectedColumns[c.key]).length;
  const optionalTotalCount = COLUMN_DEFINITIONS.filter(c => !c.mandatory).length;

  const xmlEsc = (str) => (str || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const getCellValue = (row, colKey) => {
    switch (colKey) {
      case 'aa': return null;
      case 'projectTitle': return row.project.projectTitle || '';
      case 'subprojectTitle': return row.project.subprojectTitle || '';
      case 'implementationForm': return row.project.implementationForm || '';
      case 'projectType': return row.project.projectType || '';
      case 'projectStatus': return row.project.projectStatus || '';
      case 'kaCode': return row.project.kaCode || '';
      case 'aleCode': return row.aleCode || '';
      case 'misPraxhsCode': return row.project.misPraxhsCode || '';
      case 'misPraxhsName': return row.project.misPraxhsName || '';
      case 'fundingSource': return row.project.fundingSource || '';
      case 'fundingDetails': return row.project.fundingDetails || '';
      case 'approvedAmount': return row.project.approvedAmount || '';
      case 'projectBudget': return row.project.projectBudget || '';
      case 'amount': return row.amount || '';
      case 'contractDate': return row.project.contractDate || '';
      case 'contractAmount': return getProjectContractTotalForExport(row.project);
      case 'contractProcessStartDate': return row.project.contractProcessStartDate || '';
      case 'assignmentProcedure': return getProjectAssignmentProcedureExport(row.project);
      case 'anadoxosName': return getProjectAnadoxosNamesExport(row.project);
      case 'anadoxosVat': return getProjectAnadoxosVatsExport(row.project);
      case 'khmdhsAdam': return getProjectKhmdhsAdamExport(row.project);
      case 'apeAmount': return getProjectApeAmountForExport(row.project);
      case 'apeComments': return row.project.apeComments || '';
      case 'chargeTo':
        return getProjectChargeDisplay(row.project, []).displayChargePrimary;
      case 'chargeParticipants':
        return getProjectChargeDisplay(row.project, []).displayChargeParticipants;
      case 'comments': return row.project.comments || '';
      case 'remainingAmountComments': return row.project.remainingAmountComments || '';
      case 'eisigitikiEkthesi': return row.project.eisigitikiEkthesi || '';
      case 'characterization': return getCharacterization(row.project) || '';
      default: {
        const khmdhsVal = getKhmdhsNoticeExportValue(row.project, colKey);
        return khmdhsVal != null && khmdhsVal !== '' ? khmdhsVal : '';
      }
    }
  };

  const exportToExcel = () => {
    const gate = reportsExport.evaluateTechnicalExport(exportRows, selectedYear);
    if (!gate.ok) {
      showToast(gate.error, 'info');
      return;
    }

    try {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const exportDateTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

      let htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Τεχνικό Πρόγραμμα ${selectedYear}</Title>
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
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1a237e" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="EvenRow">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="OddRow">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="AmountEven">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B5E20"/>
      <Interior ss:Color="#F1F8E9" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="AmountOdd">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B5E20"/>
      <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
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
  <Worksheet ss:Name="Τεχνικό Πρόγραμμα ${selectedYear}">
    <Table>
`;

      activeColumns.forEach(col => {
        htmlContent += `      <Column ss:Width="${col.width}"/>\n`;
      });

      htmlContent += `      <Row ss:Height="35">\n`;
      activeColumns.forEach(col => {
        htmlContent += `        <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${xmlEsc(col.label)}</Data></Cell>\n`;
      });
      htmlContent += `      </Row>\n`;

      exportRows.forEach((row, index) => {
        const rowStyle = index % 2 === 0 ? 'EvenRow' : 'OddRow';
        const amtStyle = index % 2 === 0 ? 'AmountEven' : 'AmountOdd';
        htmlContent += `      <Row>\n`;

        activeColumns.forEach(col => {
          if (col.key === 'aa') {
            htmlContent += `        <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${index + 1}</Data></Cell>\n`;
          } else if (col.type === 'amount') {
            const val = getCellValue(row, col.key);
            htmlContent += `        <Cell ss:StyleID="${amtStyle}"><Data ss:Type="String">${xmlEsc(val)}${val ? ' €' : ''}</Data></Cell>\n`;
          } else {
            htmlContent += `        <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${xmlEsc(getCellValue(row, col.key))}</Data></Cell>\n`;
          }
        });

        htmlContent += `      </Row>\n`;
      });

      const brandText = organizationName
        ? `${organizationName}  |  Δημιουργήθηκε με ERGOHUB`
        : 'Δημιουργήθηκε με ERGOHUB';
      htmlContent += `      <Row>
        <Cell ss:MergeAcross="${activeColumns.length - 1}" ss:StyleID="BrandFooter">
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
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
      const fileName = `Τεχνικό_Πρόγραμμα_${selectedYear}_${day}-${month}-${year}.xls`;
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error('Error exporting technical program:', error);
      showToast('Προέκυψε σφάλμα κατά την εξαγωγή. Παρακαλώ δοκιμάστε ξανά.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <ExportOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ExportContainer $wide={pageView === 'epStats'}>
        <Header>
          <Title>
            {pageView === 'technical' ? 'Τεχνικό Πρόγραμμα' : 'Στατιστικά Επιχειρησιακού'}
          </Title>
          <CloseButton onClick={onClose}>ΚΛΕΙΣΙΜΟ</CloseButton>
        </Header>

        <PageTabs>
          <PageTab $active={pageView === 'technical'} onClick={() => setPageView('technical')}>
            📋 Εξαγωγή Τεχνικού Προγράμματος
          </PageTab>
          <PageTab $active={pageView === 'epStats'} onClick={() => setPageView('epStats')}>
            🗺️ Στατιστικά Επιχειρησιακού Προγράμματος
          </PageTab>
        </PageTabs>

        {pageView === 'epStats' ? (
          <EpProgramStatsPanel currentUser={currentUser} appConfig={appConfig} />
        ) : (
        <>
        <TopRow>
          <SectionCard bg="#f0f4ff" borderColor="#bbdefb">
            <SectionTitle color="#1565c0">📅 Έτος Εξαγωγής</SectionTitle>
            <YearSelect
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </YearSelect>
          </SectionCard>

          <StatsBox style={{ margin: 0 }}>
            <StatItem>
              <StatNumber>{projects.length}</StatNumber>
              <StatLabel>Συνολικά Υποέργα</StatLabel>
            </StatItem>
            <StatItem>
              <StatNumber>{exportRows.length}</StatNumber>
              <StatLabel>Γραμμές {selectedYear}</StatLabel>
            </StatItem>
            <StatItem>
              <StatNumber>{new Set(exportRows.map(r => r.project.subprojectId)).size}</StatNumber>
              <StatLabel>Υποέργα</StatLabel>
            </StatItem>
          </StatsBox>
        </TopRow>

        <ColumnsSection>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
            <SectionTitle color="#333" style={{ margin: 0 }}>📊 Επιλογή Στηλών Excel</SectionTitle>
            <Tag bg="#e8eaf6" color="#3f51b5">{optionalSelectedCount}/{optionalTotalCount} προαιρετικές</Tag>
            <ToggleAllButton onClick={selectAll}>Όλα</ToggleAllButton>
            <ToggleAllButton onClick={selectMandatoryOnly}>Μόνο βασικά</ToggleAllButton>
          </div>

          <ColumnGroupsGrid>
            {GROUPS.map(group => {
              const groupCols = COLUMN_DEFINITIONS.filter(c => c.group === group.id);
              const optionalInGroup = groupCols.filter(c => !c.mandatory);
              const allOptionalOn = optionalInGroup.length > 0 && optionalInGroup.every(c => selectedColumns[c.key]);
              return (
                <ColumnGroup key={group.id}>
                  <GroupHeader color={group.color} borderColor={group.borderColor}>
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                    {optionalInGroup.length > 0 && (
                      <ToggleAllButton
                        onClick={() => toggleGroup(group.id)}
                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
                      >
                        {allOptionalOn ? 'Καμία' : 'Όλα'}
                      </ToggleAllButton>
                    )}
                  </GroupHeader>
                  {groupCols.map(col => (
                    <CheckboxRow key={col.key} disabled={col.mandatory}>
                      <Checkbox
                        checked={col.mandatory || !!selectedColumns[col.key]}
                        disabled={col.mandatory}
                        onChange={() => toggleColumn(col.key)}
                      />
                      <CheckboxLabel muted={col.mandatory} bold={col.mandatory}>
                        {col.key === 'amount' ? `ΠΡΟΤΑΘΕΝΤΑ ${selectedYear}` : col.label}
                      </CheckboxLabel>
                      {col.mandatory && <Tag bg="#fff3e0" color="#e65100">πάντα</Tag>}
                    </CheckboxRow>
                  ))}
                </ColumnGroup>
              );
            })}
          </ColumnGroupsGrid>

          <PreviewBar>
            <strong>Σειρά στηλών ({activeColumns.length}):</strong>{' '}
            {activeColumns.map(c => c.label).join('  →  ')}
          </PreviewBar>
        </ColumnsSection>

        <ActionsBar>
          <ActionButton onClick={onClose}>Ακύρωση</ActionButton>
          <ActionButton
            primary
            onClick={exportToExcel}
            disabled={!reportsExport.canCommitTechnicalExport(exportRows)}
          >
            📊 Εξαγωγή σε Excel ({exportRows.length} γραμμές)
          </ActionButton>
        </ActionsBar>
        </>
        )}
      </ExportContainer>
    </ExportOverlay>
  );
}

export default TechnicalProgramExport;
