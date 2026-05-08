import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import {
  IMPLEMENTATION_FORMS,
  PROJECT_TYPES,
  FUNDING_SOURCES,
  PROJECT_STATUSES,
  FUNDING_DETAILS,
  STATUSES_WITH_CONTRACT_FIELDS
} from '../data/formOptions';

const { ipcRenderer } = window.require('electron');

const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
  overflow: hidden;
`;

const FormContainer = styled.div`
  background: #f4f6f9;
  border-radius: 16px;
  width: calc(100vw - 2rem);
  max-width: 1100px;
  height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  animation: slideIn 0.25s ease-out;
  overflow: hidden;
  box-sizing: border-box;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const FormHeader = styled.div`
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  color: white;
  padding: 1.2rem 1.8rem;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.3px;
`;

const FormScrollArea = styled.div`
  padding: 1.5rem 1.8rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-width: 0;
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.2rem 1.4rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  border: 1px solid #e8eaf0;
  min-width: 0;
`;

const SectionTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #7986cb;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e8eaf6;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(
    ${props => props.cols || 2},
    minmax(0, 1fr)
  );
  gap: 1rem 1.2rem;
  min-width: 0;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: repeat(
      ${props => Math.min(props.cols || 2, 2)},
      minmax(0, 1fr)
    );
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  grid-column: ${props => props.fullWidth ? `1 / -1` : 'span 1'};

  & > input,
  & > select,
  & > textarea {
    width: 100%;
  }
`;

const Label = styled.label`
  font-weight: 500;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.8rem;
  border: 2px solid ${props => {
    if (props.$hasError) return '#f44336';
    if (props.$isValid && props.$touched) return '#4caf50';
    return '#e0e0e0';
  }};
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: ${props => {
      if (props.$hasError) return '#f44336';
      if (props.$isValid && props.$touched) return '#4caf50';
      return '#2196F3';
    }};
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #2196F3;
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #2196F3;
  }
`;


const ContractSection = styled.div`
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 10px;
  margin: 1rem 0;
  border: 2px solid #dee2e6;
`;

const ContractTitle = styled.h4`
  color: #495057;
  margin-bottom: 1rem;
  font-size: 1.1rem;
`;

const ContractGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2fr);
  gap: 1rem;
  align-items: end;
  min-width: 0;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AddContractButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-top: 1rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveContractButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-left: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const FileUploadSection = styled.div`
  border: 2px dashed #ccc;
  border-radius: 10px;
  padding: 2rem;
  text-align: center;
  margin: 1rem 0;
  cursor: pointer;
  transition: border-color 0.3s ease;

  &:hover {
    border-color: #2196F3;
  }
`;

const FileList = styled.div`
  margin-top: 1rem;
`;

const FileItem = styled.div`
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
`;

const Checkbox = styled.input`
  margin-right: 0.5rem;
  transform: scale(1.2);
`;

const CheckboxLabel = styled.label`
  font-weight: 500;
  color: #495057;
  cursor: pointer;
`;

const AleCodesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AleCodeItem = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  width: 100%;
`;

const AleCodeInput = styled(Input)`
  flex: 1;
  min-width: 0;
`;

const AddAleButton = styled.button`
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  
  &:hover {
    background: #218838;
    transform: translateY(-1px);
  }
`;

const RemoveAleButton = styled.button`
  padding: 0.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  min-width: 36px;
  transition: all 0.2s;
  
  &:hover {
    background: #c82333;
    transform: translateY(-1px);
  }
`;

const SupplementarySection = styled.div`
  background: #e8f5e8;
  padding: 1.5rem;
  border-radius: 10px;
  margin-top: 1rem;
  border: 2px solid #28a745;
`;

const SupplementaryTitle = styled.h4`
  color: #155724;
  margin-bottom: 1rem;
  font-size: 1.1rem;
`;

const SupplementaryGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 1rem;
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AddSupplementaryButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveSupplementaryButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-top: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const StickyFooter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.5rem;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 0 0 15px 15px;
  flex-shrink: 0;
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.6rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(76, 175, 80, 0.35);
  }
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
  }
`;

const DeleteFormButton = styled.button`
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(220, 53, 69, 0.35);
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.3rem;
`;

function ProjectForm({ isOpen, onClose, onSave, onDelete, editingProject = null }) {
  const [touched, setTouched] = useState({}); // Track which fields have been touched
  const [formData, setFormData] = useState({
    projectTitle: '',
    subprojectTitle: '',
    implementationForm: '',
    kaCode: '',
    noKaCode: false,
    eisigitikiEkthesi: '',
    aleCodes: [], // Array κωδικών Α.Λ.Ε.
    misPraxhsName: '',
    misPraxhsCode: '',
    projectType: '',
    fundingSource: '',
    fundingDetails: '',
    approvedAmount: '',
    projectBudget: '',
    projectStatus: '',
    contractProcessStartDate: '', // Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης
    contractDate: '',
    contractAmount: '',
    apeAmount: '',
    apeComments: '',
    supervisor: '',
    comments: '',
    remainingAmount: '',
    remainingAmountYear: '2026',
    remainingAmountComments: '',
    aleRemainingAmounts: [],
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
    files: [],
    fileGroups: [] // Νέα δομή για ομαδοποίηση αρχείων
  });

  const [errors, setErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (editingProject) {
      // Backward compatibility: μετατροπή aleCode string σε aleCodes array
      let aleCodes = [];
      if (editingProject.aleCodes && Array.isArray(editingProject.aleCodes)) {
        aleCodes = editingProject.aleCodes;
      } else if (editingProject.aleCode && typeof editingProject.aleCode === 'string') {
        aleCodes = [editingProject.aleCode];
      }
      
      // Backward compat για aleRemainingAmounts
      let aleRemainingAmounts = [];
      if (editingProject.aleRemainingAmounts && Array.isArray(editingProject.aleRemainingAmounts)) {
        aleRemainingAmounts = editingProject.aleRemainingAmounts;
        // Εξασφαλίζουμε ότι το μέγεθος ταιριάζει με τους κωδικούς
        while (aleRemainingAmounts.length < aleCodes.length) {
          aleRemainingAmounts = [...aleRemainingAmounts, ''];
        }
        aleRemainingAmounts = aleRemainingAmounts.slice(0, aleCodes.length);
      } else {
        // Δεν υπάρχουν δεδομένα - αρχικοποιούμε κενά
        aleRemainingAmounts = aleCodes.map(() => '');
      }

      setFormData({
        ...editingProject,
        aleCodes: aleCodes,
        aleRemainingAmounts: aleRemainingAmounts,
        contracts: editingProject.contracts || [],
        fileGroups: editingProject.fileGroups || []
      });
    } else {
      // Reset form for new project
      setFormData({
        projectTitle: '',
        subprojectTitle: '',
        implementationForm: '',
        kaCode: '',
        noKaCode: false,
        eisigitikiEkthesi: '',
        aleCodes: [],
        misPraxhsName: '',
        misPraxhsCode: '',
        projectType: '',
        fundingSource: '',
        fundingDetails: '',
        approvedAmount: '',
        projectBudget: '',
        projectStatus: '',
        contractProcessStartDate: '',
        contractDate: '',
        contractAmount: '',
        apeAmount: '',
        apeComments: '',
        supervisor: '',
        comments: '',
        remainingAmount: '',
        remainingAmountYear: '2026',
        remainingAmountComments: '',
        aleRemainingAmounts: [],
        contracts: [],
        hasSupplementaryContracts: false,
        supplementaryContracts: [],
        files: [],
        fileGroups: []
      });
    }
    setErrors({});
    setTouched({}); // Reset touched fields when form opens/closes
    setSelectedFiles([]);
  }, [editingProject, isOpen]);

  const validateKACode = (code) => {
    const pattern = /^\d{2}-\d{4}\.\d{3}$/;
    return pattern.test(code);
  };

  // Real-time validation functions
  const validateField = (field, value) => {
    switch (field) {
      case 'projectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος έργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος έργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος έργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'subprojectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος υποέργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος υποέργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος υποέργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'kaCode':
        if (formData.noKaCode) {
          return null; // No validation if noKaCode is checked
        }
        // Πλέον ο κωδικός ΚΑ δεν είναι υποχρεωτικός
        if (!value || value.trim().length === 0) {
          return null; // Επιτρέπεται κενό
        }
        if (!validateKACode(value)) {
          return 'Ο κωδικός ΚΑ πρέπει να έχει μορφή: 12-3456.789';
        }
        return null; // Valid
        
      case 'approvedAmount':
      case 'projectBudget':
      case 'contractAmount':
      case 'apeAmount':
        if (!value || value.trim().length === 0) {
          return null; // Allow empty for now, will be validated on submit
        }
        // Remove formatting (spaces, dots, commas) but keep minus
        let cleanValue = value.replace(/[\s.,]/g, '');
        // Handle comma as decimal separator
        if (value.includes(',')) {
          const parts = value.split(',');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s.]/g, '') + '.' + parts[1];
          }
        }
        // Handle dot as decimal separator if no comma
        else if (value.includes('.') && !value.includes(',')) {
          const parts = value.split('.');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s,]/g, '') + '.' + parts[1];
          }
        }
        // Keep minus if present
        const hasMinus = cleanValue.startsWith('-');
        cleanValue = cleanValue.replace(/[^\d.]/g, '');
        if (hasMinus) {
          cleanValue = '-' + cleanValue;
        }
        
        const numValue = parseFloat(cleanValue);
        if (isNaN(numValue)) {
          return 'Πρέπει να είναι αριθμός';
        }
        // Allow negative numbers (removed the < 0 check)
        if (Math.abs(numValue) > 999999999.99) {
          return 'Το ποσό είναι πολύ μεγάλο (μέγιστο 999.999.999,99)';
        }
        return null; // Valid
        
      default:
        return null;
    }
  };

  const formatAmount = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα, τελείες και πλην στην αρχή
    let cleaned = value;
    
    // Κρατάω πλην μόνο στην αρχή
    const hasMinusAtStart = cleaned.startsWith('-');
    cleaned = cleaned.replace(/[^\d,.]/g, '');
    if (hasMinusAtStart && cleaned.length > 0) {
      cleaned = '-' + cleaned;
    }
    
    // Αν δεν υπάρχουν ψηφία, επιστρέφω κενό
    if (!/\d/.test(cleaned)) return '';
    
    // Απλή καθαρισμό για typing - επιτρέπω ελεύθερη πληκτρολόγηση
    return cleaned;
  };

  const formatAmountOnBlur = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    const hasMinusAtStart = value.trim().startsWith('-');
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα και τελείες
    let cleaned = value.replace(/[^\d,.]/g, '');
    
    if (!/\d/.test(cleaned)) return '';
    
    let integerPart = '';
    let decimalPart = '';
    
    // Αφαίρεση πλην προσωρινά για processing
    const isNegative = cleaned.startsWith('-');
    if (isNegative) {
      cleaned = cleaned.substring(1);
    }
    
    // Αναγνώριση του τρόπου εισαγωγής και μετατροπή σε ευρωπαϊκή μορφή
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
        // Αμερικανική μορφή (25,254.25)
        let parts = cleaned.split('.');
        integerPart = parts[0].replace(/,/g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      } else {
        // Ευρωπαϊκή μορφή (25.254,25)
        let parts = cleaned.split(',');
        integerPart = parts[0].replace(/\./g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      }
    } else if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    } else if (cleaned.includes('.')) {
      let parts = cleaned.split('.');
      if (parts[0].length <= 3 && parts[1]) {
        integerPart = parts[0];
        decimalPart = parts[1].slice(0, 2);
      } else {
        integerPart = cleaned.replace(/\./g, '');
      }
    } else {
      integerPart = cleaned;
    }
    
    // Μορφοποίηση του ακέραιου μέρους με τελείες για χιλιάδες
    let formattedInteger = '';
    if (integerPart.length > 3) {
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          formattedInteger = '.' + formattedInteger;
        }
        formattedInteger = integerPart[i] + formattedInteger;
      }
    } else {
      formattedInteger = integerPart;
    }
    
    let result = formattedInteger;
    if (decimalPart) {
      result += ',' + decimalPart;
    }
    
    // Προσθήκη πλην αν υπήρχε στην αρχή
    if (hasMinusAtStart) {
      result = '-' + result;
    }
    
    return result;
  };

  // ALE Codes management
  const handleAddAleCode = () => {
    setFormData(prev => ({
      ...prev,
      aleCodes: [...prev.aleCodes, ''],
      aleRemainingAmounts: [...(prev.aleRemainingAmounts || []), '']
    }));
  };

  const handleAleCodeChange = (index, value) => {
    setFormData(prev => {
      const newAleCodes = [...prev.aleCodes];
      newAleCodes[index] = value;
      return { ...prev, aleCodes: newAleCodes };
    });
  };

  const handleRemoveAleCode = (index) => {
    setFormData(prev => {
      const newAleCodes = prev.aleCodes.filter((_, i) => i !== index);
      const newAleRemainingAmounts = (prev.aleRemainingAmounts || []).filter((_, i) => i !== index);
      // Υπολογισμός νέου συνόλου
      const newTotal = newAleRemainingAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleCodes: newAleCodes,
        aleRemainingAmounts: newAleRemainingAmounts,
        remainingAmount: newAleCodes.length >= 1 && newTotal > 0
          ? formatNumberToEuropean(newTotal)
          : ''
      };
    });
  };

  // Helper: μετατροπή μορφοποιημένου ποσού σε αριθμό
  const parseFormattedAmount = (value) => {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
  };

  // Helper: μετατροπή αριθμού σε ευρωπαϊκή μορφή (25.587,56)
  const formatNumberToEuropean = (num) => {
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('el-GR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    });
  };

  const handleAleRemainingAmountChange = (index, value) => {
    value = formatAmount(value);
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = value;
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const handleAleRemainingAmountBlur = (index) => {
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = formatAmountOnBlur(newAmounts[index] || '');
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.projectTitle.trim()) {
      newErrors.projectTitle = 'Απαιτείται τίτλος έργου';
    }

    if (!formData.subprojectTitle.trim()) {
      newErrors.subprojectTitle = 'Απαιτείται τίτλος υποέργου';
    }

    if (!formData.implementationForm) {
      newErrors.implementationForm = 'Επιλέξτε μορφή υλοποίησης';
    }

    if (
      !formData.noKaCode &&
      formData.kaCode &&
      formData.kaCode.trim().length > 0 &&
      !validateKACode(formData.kaCode)
    ) {
      newErrors.kaCode = 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx';
    }

    // Validation για MIS ΠΡΑΞΗΣ: αν έχει ένα από τα δύο, πρέπει να έχει και το άλλο
    const hasMisPraxhsName = formData.misPraxhsName && formData.misPraxhsName.trim();
    const hasMisPraxhsCode = formData.misPraxhsCode && formData.misPraxhsCode.trim();
    
    if (hasMisPraxhsName && !hasMisPraxhsCode) {
      newErrors.misPraxhsCode = 'Παρακαλώ συμπληρώστε και τον κωδικό';
    }
    
    if (hasMisPraxhsCode && !hasMisPraxhsName) {
      newErrors.misPraxhsName = 'Παρακαλώ συμπληρώστε και το όνομα του κωδικού';
    }

    if (!formData.projectType) {
      newErrors.projectType = 'Επιλέξτε είδος';
    }

    if (!formData.fundingSource) {
      newErrors.fundingSource = 'Επιλέξτε πηγή χρηματοδότησης';
    }

    if (!formData.fundingDetails) {
      newErrors.fundingDetails = 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης';
    }

    if (!formData.approvedAmount) {
      newErrors.approvedAmount = 'Απαιτείται εγκεκριμένο ποσό';
    }

    if (!formData.projectBudget) {
      newErrors.projectBudget = 'Απαιτείται προϋπολογισμός έργου';
    }

    if (!formData.projectStatus) {
      newErrors.projectStatus = 'Επιλέξτε κατάσταση έργου';
    }

    // Validate contract process start date if status is "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ"
    // Check if contractProcessStartDate is before contractDate (if contractDate exists)
    // This validation applies to all statuses from "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ" onwards
    if (formData.projectStatus && PROJECT_STATUSES.indexOf(formData.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ')) {
      if (formData.contractProcessStartDate) {
        const processStartDate = new Date(formData.contractProcessStartDate);
        
        // For single contract
        if (formData.implementationForm === 'Μια Σύμβαση' && formData.contractDate) {
          const contractDate = new Date(formData.contractDate);
          if (processStartDate >= contractDate) {
            newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη της ημερομηνίας σύμβασης';
          }
        }
        
        // For multiple contracts - check against all contract dates
        if (formData.implementationForm === 'Πολλές Συμβάσεις' && formData.contracts && formData.contracts.length > 0) {
          const invalidContracts = formData.contracts.filter((contract, index) => {
            if (contract.date) {
              const contractDate = new Date(contract.date);
              return processStartDate >= contractDate;
            }
            return false;
          });
          
          if (invalidContracts.length > 0) {
            newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη όλων των ημερομηνιών σύμβασης';
          }
        }
      }
    }

    // Validate contract fields if needed
    if (STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus)) {
      if (formData.implementationForm === 'Μια Σύμβαση') {
        if (!formData.contractDate) {
          newErrors.contractDate = 'Απαιτείται ημερομηνία υπογραφής σύμβασης';
        }
        if (!formData.contractAmount) {
          newErrors.contractAmount = 'Απαιτείται ποσό σύμβασης';
        }
        if (!formData.apeAmount) {
          newErrors.apeAmount = 'Απαιτείται ποσό ΑΠΕ + Συμπληρωματικές συμβάσεις';
        }
      } else {
        // Validate multiple contracts
        formData.contracts.forEach((contract, index) => {
          if (!contract.date) {
            newErrors[`contractDate${index}`] = 'Απαιτείται ημερομηνία';
          }
          if (!contract.amount) {
            newErrors[`contractAmount${index}`] = 'Απαιτείται ποσό';
          }
          if (!contract.apeAmount) {
            newErrors[`apeAmount${index}`] = 'Απαιτείται ποσό ΑΠΕ';
          }
        });
      }
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleInputChange = (field, value) => {
    if (field === 'kaCode' && !formData.noKaCode) {
      // Auto-format KA code - επιτρέπω ψηφία, παύλα και τελεία
      value = value.replace(/[^\d\-.]/g, '');
      
      // Αυτόματη μορφοποίηση
      let digitsOnly = value.replace(/[^\d]/g, '');
      
      if (digitsOnly.length <= 2) {
        value = digitsOnly;
      } else if (digitsOnly.length <= 6) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2);
      } else if (digitsOnly.length <= 9) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6);
      } else {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6, 9);
      }
    }

    if (field === 'approvedAmount' || field === 'projectBudget' || field === 'contractAmount' || field === 'apeAmount') {
      value = formatAmount(value);
    }

    // ΔΕΝ κάνουμε normalization κατά την πληκτρολόγηση για κανένα πεδίο
    // Το normalization γίνεται μόνο κατά την αποθήκευση (στο handleSave)
    // Αυτό επιτρέπει κανονική πληκτρολόγηση με spaces σε όλα τα πεδία

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation - show errors immediately for better UX
    const error = validateField(field, value);
    if (touched[field] || error) {
      // If there's an error, mark as touched to show it immediately
      if (error && !touched[field]) {
        setTouched(prev => ({ ...prev, [field]: true }));
      }
      setErrors(prev => ({
        ...prev,
        [field]: error || ''
      }));
    }
  };

  const handleFieldBlur = (field) => {
    // Mark field as touched when user leaves it
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate field on blur
    const value = formData[field];
    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));
  };

  const handleAmountBlur = (field) => {
    const currentValue = formData[field];
    const formattedValue = formatAmountOnBlur(currentValue);
    
    if (formattedValue !== currentValue) {
      setFormData(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    }
  };

  const handleNoKACodeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      noKaCode: checked,
      kaCode: checked ? 'ΔΕΝ ΥΠΑΡΧΕΙ' : ''
    }));
  };

  const handleFundingSourceChange = (source) => {
    setFormData(prev => ({
      ...prev,
      fundingSource: source,
      fundingDetails: '' // Reset funding details when source changes
    }));
  };

  const addContract = () => {
    setFormData(prev => ({
      ...prev,
      contracts: [...prev.contracts, { date: '', amount: '', apeAmount: '', comments: '' }]
    }));
  };

  const updateContract = (index, field, value) => {
    if (field === 'amount' || field === 'apeAmount') {
      value = formatAmount(value);
    }

    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.map((contract, i) => 
        i === index ? { ...contract, [field]: value } : contract
      )
    }));
  };


  const removeContract = (index) => {
    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.filter((_, i) => i !== index)
    }));
  };

  // Functions for supplementary contracts
  const addSupplementaryContract = () => {
    setFormData(prev => ({
      ...prev,
      supplementaryContracts: [...prev.supplementaryContracts, { 
        date: '', 
        amount: '', 
        comments: '' 
      }]
    }));
  };

  const updateSupplementaryContract = (index, field, value) => {
    if (field === 'amount') {
      value = formatAmount(value);
    }

    setFormData(prev => ({
      ...prev,
      supplementaryContracts: prev.supplementaryContracts.map((contract, i) => 
        i === index ? { ...contract, [field]: value } : contract
      )
    }));
  };

  const removeSupplementaryContract = (index) => {
    setFormData(prev => ({
      ...prev,
      supplementaryContracts: prev.supplementaryContracts.filter((_, i) => i !== index)
    }));
  };

  const handleFileSelect = async () => {
    try {
      const result = await ipcRenderer.invoke('open-file-dialog');
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles = result.filePaths.map(path => ({
          path,
          name: path.split('\\').pop().split('/').pop()
        }));
        
        // Απλό modal για επιλογή ομαδοποίησης
        const groupingChoice = await showSimpleGroupingModal(newFiles.length, formData.fileGroups || []);
        
        if (groupingChoice !== null && groupingChoice !== false) {
          if (groupingChoice.action === 'new') {
            // Δημιουργία νέας ομάδας
            setFormData(prev => ({
              ...prev,
              fileGroups: [...(prev.fileGroups || []), {
                id: uuidv4(),
                title: groupingChoice.title,
                files: newFiles
              }]
            }));
          } else if (groupingChoice.action === 'existing') {
            // Προσθήκη σε υπάρχουσα ομάδα
            setFormData(prev => ({
              ...prev,
              fileGroups: (prev.fileGroups || []).map(group => 
                group.id === groupingChoice.groupId
                  ? { ...group, files: [...group.files, ...newFiles] }
                  : group
              )
            }));
          }
        } else {
          // Κανονική προσθήκη αρχείων χωρίς ομαδοποίηση
          setSelectedFiles(prev => [...prev, ...newFiles]);
        }
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };


  const removeFileGroup = (groupId) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.filter(group => group.id !== groupId)
    }));
  };

  const removeFileFromGroup = (groupId, fileIndex) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.map(group => 
        group.id === groupId 
          ? { ...group, files: group.files.filter((_, i) => i !== fileIndex) }
          : group
      ).filter(group => group.files.length > 0) // Αφαιρούμε ομάδες χωρίς αρχεία
    }));
  };

  // Απλό modal για ομαδοποίηση αρχείων
  const showSimpleGroupingModal = (fileCount, existingGroups = []) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      `;

      // Δημιουργία επιλογών για υπάρχουσες ομάδες
      const existingGroupsOptions = existingGroups.length > 0 
        ? existingGroups.map(group => `<option value="${group.id}">${group.title}</option>`).join('')
        : '';

      modalContent.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
          📁 Ομαδοποίηση Αρχείων
        </h3>
        <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
          Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;
        </p>
        <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
          <button id="newGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">🆕 Νέα Ομάδα</button>
          ${existingGroups.length > 0 ? `
          <button id="existingGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📂 Προσθήκη σε Υπάρχουσα Ομάδα</button>
          ` : ''}
          <button id="noGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📄 Χωρίς Ομαδοποίηση</button>
        </div>
        <div id="newGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος νέας ομάδας:
          </label>
          <input 
            type="text" 
            id="newGroupTitle" 
            placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="confirmNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
        <div id="existingGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε υπάρχουσα ομάδα:
          </label>
          <select 
            id="existingGroupSelect" 
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          >
            <option value="">-- Επιλέξτε ομάδα --</option>
            ${existingGroupsOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="confirmExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Event listeners για τα κουμπιά
      const newGroupBtn = modalContent.querySelector('#newGroupBtn');
      const existingGroupBtn = modalContent.querySelector('#existingGroupBtn');
      const noGroupBtn = modalContent.querySelector('#noGroupBtn');
      
      const newGroupSection = modalContent.querySelector('#newGroupSection');
      const existingGroupSection = modalContent.querySelector('#existingGroupSection');
      
      const newGroupTitle = modalContent.querySelector('#newGroupTitle');
      const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
      
      const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
      const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
      const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
      const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');

      // Νέα ομάδα
      newGroupBtn.addEventListener('click', () => {
        newGroupBtn.style.display = 'none';
        if (existingGroupBtn) existingGroupBtn.style.display = 'none';
        noGroupBtn.style.display = 'none';
        newGroupSection.style.display = 'block';
        newGroupTitle.focus();
      });

      // Υπάρχουσα ομάδα
      if (existingGroupBtn) {
        existingGroupBtn.addEventListener('click', () => {
          newGroupBtn.style.display = 'none';
          existingGroupBtn.style.display = 'none';
          noGroupBtn.style.display = 'none';
          existingGroupSection.style.display = 'block';
        });
      }

      // Χωρίς ομαδοποίηση
      noGroupBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      // Επιβεβαίωση νέας ομάδας
      confirmNewBtn.addEventListener('click', () => {
        const title = newGroupTitle.value.trim();
        if (title) {
          document.body.removeChild(modal);
          resolve({ action: 'new', title });
        } else {
          alert('Παρακαλώ εισάγετε τίτλο ομάδας');
        }
      });

      // Ακύρωση νέας ομάδας
      cancelNewBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      let handleKeyDown;
      const cleanup = (result) => {
        if (modal.parentNode === document.body) {
          document.body.removeChild(modal);
        }
        if (handleKeyDown) {
          document.removeEventListener('keydown', handleKeyDown);
        }
        resolve(result);
      };

      // Επιβεβαίωση υπάρχουσας ομάδας
      confirmExistingBtn.addEventListener('click', () => {
        const selectedGroupId = existingGroupSelect.value;
        if (selectedGroupId) {
          cleanup({ action: 'existing', groupId: selectedGroupId });
        } else {
          alert('Παρακαλώ επιλέξτε ομάδα');
        }
      });

      // Ακύρωση υπάρχουσας ομάδας
      cancelExistingBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Κλείσιμο με ESC
      handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
    });
  };

  // Συνάρτηση για normalization κειμένου
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')           // Αντιγράφει \n literals
      .replace(/\n/g, ' ')            // Αντιγράφει πραγματικά newlines
      .replace(/\r/g, ' ')            // Αντιγράφει carriage returns
      .replace(/\t/g, ' ')            // Αντιγράφει tabs
      .replace(/\s+/g, ' ')           // Αντικαθιστά όλα τα whitespace (συμπεριλαμβανομένων διπλών κενών) με ένα κενό
      .replace(/\u00A0/g, ' ')        // Αντιγράφει non-breaking spaces
      .replace(/\u2000-\u200B/g, ' ') // Αντιγράφει διάφορα είδη spaces
      .replace(/\u2028/g, ' ')        // Αντιγράφει line separator
      .replace(/\u2029/g, ' ')        // Αντιγράφει paragraph separator
      .trim();
  };

  const handleSave = async () => {
    console.log('=== SAVE ATTEMPT ===');
    console.log('Form data:', formData);
    console.log('Selected files:', selectedFiles);
    console.log('Editing project:', editingProject);
    
    const validation = validateForm();
    if (!validation.isValid) {
      console.log('Validation failed, errors:', validation.errors);
      return;
    }

    console.log('Validation passed, proceeding with save...');

    try {
      // Normalize τα κείμενα πριν την αποθήκευση
      const normalizedFormData = {
        ...formData,
        projectTitle: normalizeText(formData.projectTitle),
        subprojectTitle: normalizeText(formData.subprojectTitle),
        comments: normalizeText(formData.comments),
        apeComments: normalizeText(formData.apeComments),
        remainingAmountComments: normalizeText(formData.remainingAmountComments),
        aleRemainingAmounts: formData.aleRemainingAmounts || []
      };

      const projectData = {
        ...normalizedFormData,
        files: selectedFiles,
        fileGroups: formData.fileGroups || []
      };

      if (editingProject) {
        // Έλεγχος αν ο τίτλος του έργου άλλαξε κατά την επεξεργασία
        const originalProjectTitle = editingProject.projectTitle;
        const newProjectTitle = formData.projectTitle;
        
        if (originalProjectTitle !== newProjectTitle) {
          console.log('⚠️ Project title changed during editing:', {
            original: originalProjectTitle,
            new: newProjectTitle
          });
          
          // Έλεγχος αν υπάρχει ήδη έργο με τον νέο τίτλο
          const existingProject = await ipcRenderer.invoke('find-project-by-title', newProjectTitle);
          
          if (existingProject && existingProject.projectId !== editingProject.projectId) {
            // Υπάρχει άλλο έργο με τον νέο τίτλο - δημιουργούμε νέο έργο
            console.log('🆕 Title conflict detected - creating new project');
            projectData.projectId = null; // Θα δημιουργηθεί νέο ID
          } else {
            // Δεν υπάρχει σύγκρουση - απλά ενημερώνουμε το υπάρχον έργο
            console.log('📝 Updating existing project with new title');
            projectData.projectId = editingProject.projectId;
          }
        } else {
          // Ο τίτλος δεν άλλαξε - κανονική επεξεργασία
          projectData.projectId = editingProject.projectId;
        }
        
        projectData.subprojectId = editingProject.subprojectId;
      } else {
        // Έλεγχος αν υπάρχει έργο με τον ίδιο τίτλο (μόνο για νέα έργα)
        if (formData.projectTitle) {
          const existingProject = await ipcRenderer.invoke('find-project-by-title', formData.projectTitle);
          if (existingProject) {
                  // Custom modal για επιλογή
                  const shouldAddToExisting = await new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: rgba(0, 0, 0, 0.7);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      z-index: 10000;
                    `;

                    const modalContent = document.createElement('div');
                    modalContent.style.cssText = `
                      background: white;
                      border-radius: 12px;
                      padding: 2rem;
                      max-width: 500px;
                      width: 90%;
                      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    `;

                    modalContent.innerHTML = `
                      <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
                        🔍 Υπάρχον Έργο Βρέθηκε
                      </h3>
                      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
                        Βρέθηκε υπάρχον έργο με τίτλο:<br>
                        <strong>"${formData.projectTitle}"</strong>
                      </p>
                      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem; font-weight: 500;">
                        Θέλετε να προσθέσετε το νέο υποέργο στο υπάρχον έργο;
                      </p>
                      <div style="display: flex; gap: 1rem;">
                        <button id="yesBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #28a745;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΝΑΙ - Προσθήκη στο Υπάρχον</button>
                        <button id="noBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #007bff;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΟΧΙ - Νέο Έργο</button>
                      </div>
                    `;

                    modal.appendChild(modalContent);
                    document.body.appendChild(modal);

                    const yesBtn = modalContent.querySelector('#yesBtn');
                    const noBtn = modalContent.querySelector('#noBtn');

                    let handleKeyDown;
                    const cleanup = (result) => {
                      if (modal.parentNode === document.body) {
                        document.body.removeChild(modal);
                      }
                      if (handleKeyDown) {
                        document.removeEventListener('keydown', handleKeyDown);
                      }
                      resolve(result);
                    };

                    yesBtn.addEventListener('click', () => cleanup(true));
                    noBtn.addEventListener('click', () => cleanup(false));

                    // Κλείσιμο με ESC
                    handleKeyDown = (e) => {
                      if (e.key === 'Escape') {
                        cleanup(false);
                      }
                    };
                    document.addEventListener('keydown', handleKeyDown);
                  });
            
            if (shouldAddToExisting) {
              // Χρησιμοποιούμε το υπάρχον projectId
              projectData.projectId = existingProject.projectId;
              console.log('🔗 Adding subproject to existing project:', existingProject.projectId);
            } else {
              console.log('🆕 Creating new project with same title');
            }
          }
        }
      }

      console.log('Sending project data:', projectData);
      await onSave(projectData);
      console.log('Project saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  if (!isOpen) return null;

  const showContractFields = STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus);
  const availableFundingDetails = FUNDING_DETAILS[formData.fundingSource] || [];

  return (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContainer>
        {/* Header */}
        <FormHeader>
          <FormTitle>
            {editingProject ? '✏️ Επεξεργασία Υποέργου' : '➕ Εισαγωγή Νέου Υποέργου'}
          </FormTitle>
        </FormHeader>

        <FormScrollArea>

          {/* ── SECTION 1: Τίτλοι ── */}
          <Section>
            <SectionTitle>📋 Στοιχεία Έργου & Υποέργου</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Έργου *</Label>
                <Input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο έργου"
                />
                {errors.projectTitle && <ErrorMessage>{errors.projectTitle}</ErrorMessage>}
              </FormGroup>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Υποέργου *</Label>
                <Input
                  type="text"
                  value={formData.subprojectTitle}
                  onChange={(e) => handleInputChange('subprojectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο υποέργου"
                />
                {errors.subprojectTitle && <ErrorMessage>{errors.subprojectTitle}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 2: Κωδικοί ── */}
          <Section>
            <SectionTitle>🔢 Κωδικοί</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Μορφή Υλοποίησης *</Label>
                <Select
                  value={formData.implementationForm}
                  onChange={(e) => handleInputChange('implementationForm', e.target.value)}
                >
                  <option value="">Επιλέξτε μορφή</option>
                  {IMPLEMENTATION_FORMS.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </Select>
                {errors.implementationForm && <ErrorMessage>{errors.implementationForm}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός ΚΑ (προαιρετικό)</Label>
                <Input
                  type="text"
                  value={formData.kaCode}
                  onChange={(e) => handleInputChange('kaCode', e.target.value)}
                  onBlur={() => handleFieldBlur('kaCode')}
                  disabled={formData.noKaCode}
                  placeholder="xx-xxxx.xxx"
                  maxLength="11"
                  $hasError={!!errors.kaCode}
                  $isValid={!errors.kaCode && formData.kaCode && validateKACode(formData.kaCode)}
                  $touched={touched.kaCode}
                />
                <CheckboxContainer style={{ marginTop: '0.4rem', padding: '0.5rem 0.7rem' }}>
                  <Checkbox
                    type="checkbox"
                    checked={formData.noKaCode}
                    onChange={(e) => handleNoKACodeChange(e.target.checked)}
                  />
                  <CheckboxLabel>Δεν υπάρχει ΚΑ</CheckboxLabel>
                </CheckboxContainer>
                {errors.kaCode && <ErrorMessage>{errors.kaCode}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδ. Α.Λ.Ε.</Label>
                <AleCodesContainer>
                  {formData.aleCodes && formData.aleCodes.length > 0 ? (
                    formData.aleCodes.map((code, index) => (
                      <AleCodeItem key={index}>
                        <AleCodeInput
                          type="text"
                          value={code}
                          onChange={(e) => handleAleCodeChange(index, e.target.value)}
                          placeholder={`Α.Λ.Ε. ${index + 1}`}
                          maxLength="50"
                        />
                        <RemoveAleButton type="button" onClick={() => handleRemoveAleCode(index)} title="Αφαίρεση">✕</RemoveAleButton>
                      </AleCodeItem>
                    ))
                  ) : (
                    <p style={{ color: '#9e9e9e', fontSize: '0.82rem', margin: '0.3rem 0' }}>Δεν έχουν προστεθεί</p>
                  )}
                  <AddAleButton type="button" onClick={handleAddAleCode}>+ Προσθήκη Α.Λ.Ε.</AddAleButton>
                </AleCodesContainer>
              </FormGroup>

              <FormGroup>
                <Label>Όνομα Κωδικού Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsName}
                  onChange={(e) => handleInputChange('misPraxhsName', e.target.value)}
                  placeholder="π.χ. MIS (προαιρετικό)"
                />
                {errors.misPraxhsName && <ErrorMessage>{errors.misPraxhsName}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsCode}
                  onChange={(e) => handleInputChange('misPraxhsCode', e.target.value)}
                  placeholder="Τιμή κωδικού (προαιρετικό)"
                />
                {errors.misPraxhsCode && <ErrorMessage>{errors.misPraxhsCode}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 3: Χρηματοδότηση & Ποσά ── */}
          <Section>
            <SectionTitle>💰 Χρηματοδότηση & Ποσά</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Είδος *</Label>
                <Select
                  value={formData.projectType}
                  onChange={(e) => handleInputChange('projectType', e.target.value)}
                >
                  <option value="">Επιλέξτε είδος</option>
                  {PROJECT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
                {errors.projectType && <ErrorMessage>{errors.projectType}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Βασική Πηγή Χρηματοδότησης *</Label>
                <Select
                  value={formData.fundingSource}
                  onChange={(e) => handleFundingSourceChange(e.target.value)}
                >
                  <option value="">Επιλέξτε πηγή</option>
                  {FUNDING_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </Select>
                {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Εξειδίκευση Πηγής *</Label>
                <Select
                  value={formData.fundingDetails}
                  onChange={(e) => handleInputChange('fundingDetails', e.target.value)}
                  disabled={!formData.fundingSource}
                >
                  <option value="">Επιλέξτε εξειδίκευση</option>
                  {availableFundingDetails.map(detail => (
                    <option key={detail} value={detail}>{detail}</option>
                  ))}
                </Select>
                {errors.fundingDetails && <ErrorMessage>{errors.fundingDetails}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Εγκεκριμένο Ποσό *</Label>
                <Input
                  type="text"
                  value={formData.approvedAmount}
                  onChange={(e) => handleInputChange('approvedAmount', e.target.value)}
                  onBlur={() => { handleAmountBlur('approvedAmount'); handleFieldBlur('approvedAmount'); }}
                  placeholder="π.χ. 25.254,25"
                  $hasError={!!errors.approvedAmount}
                  $isValid={!errors.approvedAmount && formData.approvedAmount && validateField('approvedAmount', formData.approvedAmount) === null}
                  $touched={touched.approvedAmount}
                />
                {errors.approvedAmount && <ErrorMessage>{errors.approvedAmount}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Προϋπολογισμός Έργου *</Label>
                <Input
                  type="text"
                  value={formData.projectBudget}
                  onChange={(e) => handleInputChange('projectBudget', e.target.value)}
                  onBlur={() => { handleAmountBlur('projectBudget'); handleFieldBlur('projectBudget'); }}
                  placeholder="π.χ. 30.000,00"
                  $hasError={!!errors.projectBudget}
                  $isValid={!errors.projectBudget && formData.projectBudget && validateField('projectBudget', formData.projectBudget) === null}
                  $touched={touched.projectBudget}
                />
                {errors.projectBudget && <ErrorMessage>{errors.projectBudget}</ErrorMessage>}
              </FormGroup>

              {/* Υπόλοιπα */}
              {formData.aleCodes && formData.aleCodes.length >= 1 ? (
                <FormGroup fullWidth cols={3}>
                  <Label>Υπόλοιπα για το Έτος ανά Α.Λ.Ε.</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#666' }}>Έτος:</span>
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '90px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {formData.aleCodes.map((aleCode, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ minWidth: '110px', fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', background: '#e3f2fd', padding: '0.35rem 0.5rem', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {aleCode || `Α.Λ.Ε. ${index + 1}`}
                        </span>
                        <Input type="text" value={(formData.aleRemainingAmounts || [])[index] || ''} onChange={(e) => handleAleRemainingAmountChange(index, e.target.value)} onBlur={() => handleAleRemainingAmountBlur(index)} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '2px solid #28a745' }}>
                    <span style={{ minWidth: '110px', fontSize: '0.85rem', fontWeight: 700, color: '#155724' }}>Σύνολο:</span>
                    <Input type="text" value={formData.remainingAmount} disabled placeholder="Αυτόματος υπολογισμός" style={{ flex: 1, background: '#d4edda', fontWeight: 700, color: '#155724', cursor: 'not-allowed' }} />
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              ) : (
                <FormGroup>
                  <Label>Υπόλοιπα για το Έτος</Label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Input type="text" value={formData.remainingAmount} onChange={(e) => handleInputChange('remainingAmount', e.target.value)} onBlur={() => handleAmountBlur('remainingAmount')} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '80px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              )}

              <FormGroup>
                <Label>Σχόλια Υπολοίπων</Label>
                <TextArea value={formData.remainingAmountComments} onChange={(e) => handleInputChange('remainingAmountComments', e.target.value)} placeholder="Σχόλια για τα υπόλοιπα..." rows={2} style={{ minHeight: '56px' }} />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 4: Κατάσταση & Γενικά ── */}
          <Section>
            <SectionTitle>📌 Κατάσταση & Γενικά</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Κατάσταση Έργου *</Label>
                <Select
                  value={formData.projectStatus}
                  onChange={(e) => handleInputChange('projectStatus', e.target.value)}
                >
                  <option value="">Επιλέξτε κατάσταση</option>
                  {PROJECT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
                {errors.projectStatus && <ErrorMessage>{errors.projectStatus}</ErrorMessage>}
              </FormGroup>

              {formData.projectStatus && PROJECT_STATUSES.indexOf(formData.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ') && (
                <FormGroup>
                  <Label>Ημερ. Έναρξης Διαδικασίας Σύμβασης</Label>
                  <Input
                    type="date"
                    value={formData.contractProcessStartDate || ''}
                    onChange={(e) => handleInputChange('contractProcessStartDate', e.target.value)}
                  />
                  {errors.contractProcessStartDate && <ErrorMessage>{errors.contractProcessStartDate}</ErrorMessage>}
                </FormGroup>
              )}

              <FormGroup>
                <Label>Επιβλέπων Μηχανικός</Label>
                <Input
                  type="text"
                  value={formData.supervisor}
                  onChange={(e) => handleInputChange('supervisor', e.target.value)}
                  placeholder="π.χ. Ιωάννης Παπαδόπουλος"
                />
              </FormGroup>

              <FormGroup fullWidth cols={3}>
                <Label>Σχόλια</Label>
                <TextArea
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  placeholder="Γενικά σχόλια για το υποέργο..."
                  rows={3}
                />
              </FormGroup>

              <FormGroup fullWidth cols={3}>
                <Label>Εισηγητική Έκθεση</Label>
                <TextArea
                  value={formData.eisigitikiEkthesi || ''}
                  onChange={(e) => handleInputChange('eisigitikiEkthesi', e.target.value)}
                  placeholder="Ελεύθερο κείμενο εισηγητικής έκθεσης..."
                  rows={5}
                  style={{ minHeight: '100px' }}
                />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 5: Στοιχεία Σύμβασης ── */}
          {showContractFields && (
            <Section>
              <SectionTitle>📝 Στοιχεία Σύμβασης</SectionTitle>

              {formData.implementationForm === 'Μια Σύμβαση' ? (
                <FormGrid cols={3}>
                  <FormGroup>
                    <Label>Ημερομηνία Υπογραφής *</Label>
                    <Input type="date" value={formData.contractDate} onChange={(e) => handleInputChange('contractDate', e.target.value)} />
                    {errors.contractDate && <ErrorMessage>{errors.contractDate}</ErrorMessage>}
                  </FormGroup>
                  <FormGroup>
                    <Label>Ποσό Σύμβασης *</Label>
                    <Input type="text" value={formData.contractAmount} onChange={(e) => handleInputChange('contractAmount', e.target.value)} onBlur={() => handleAmountBlur('contractAmount')} placeholder="π.χ. 25.254,25" />
                    {errors.contractAmount && <ErrorMessage>{errors.contractAmount}</ErrorMessage>}
                  </FormGroup>
                  <FormGroup>
                    <Label>ΑΠΕ + Συμπληρωματικές *</Label>
                    <Input type="text" value={formData.apeAmount} onChange={(e) => handleInputChange('apeAmount', e.target.value)} onBlur={() => handleAmountBlur('apeAmount')} placeholder="π.χ. 2.500,00" />
                    <Input type="text" value={formData.apeComments} onChange={(e) => handleInputChange('apeComments', e.target.value)} placeholder="Σχόλια ΑΠΕ" style={{ marginTop: '0.4rem' }} />
                    {errors.apeAmount && <ErrorMessage>{errors.apeAmount}</ErrorMessage>}
                  </FormGroup>
                </FormGrid>
              ) : (
                <div>
                  {formData.contracts.map((contract, index) => (
                    <div key={index} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '0.9rem 1rem', marginBottom: '0.8rem', border: '1px solid #e0e0e0' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5c6bc0', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Σύμβαση {index + 1}</div>
                      <FormGrid cols={3}>
                        <FormGroup>
                          <Label>Ημερομηνία Υπογραφής</Label>
                          <Input type="date" value={contract.date} onChange={(e) => updateContract(index, 'date', e.target.value)} />
                          {errors[`contractDate${index}`] && <ErrorMessage>{errors[`contractDate${index}`]}</ErrorMessage>}
                        </FormGroup>
                        <FormGroup>
                          <Label>Ποσό Σύμβασης</Label>
                          <Input type="text" value={contract.amount} onChange={(e) => updateContract(index, 'amount', e.target.value)} placeholder="π.χ. 25.254,25" />
                          {errors[`contractAmount${index}`] && <ErrorMessage>{errors[`contractAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                        <FormGroup>
                          <Label>ΑΠΕ + Συμπληρωματικές</Label>
                          <Input type="text" value={contract.apeAmount} onChange={(e) => updateContract(index, 'apeAmount', e.target.value)} placeholder="π.χ. 2.500,00" />
                          <Input type="text" value={contract.comments} onChange={(e) => updateContract(index, 'comments', e.target.value)} placeholder="Σχόλια" style={{ marginTop: '0.4rem' }} />
                          {errors[`apeAmount${index}`] && <ErrorMessage>{errors[`apeAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                      </FormGrid>
                      <RemoveContractButton onClick={() => removeContract(index)} style={{ marginTop: '0.5rem' }}>Αφαίρεση Σύμβασης</RemoveContractButton>
                    </div>
                  ))}
                  <AddContractButton onClick={addContract}>+ Προσθήκη Σύμβασης</AddContractButton>
                </div>
              )}

              {/* Συμπληρωματικές */}
              <CheckboxContainer style={{ marginTop: '1rem' }}>
                <Checkbox type="checkbox" id="hasSupplementaryContracts" checked={formData.hasSupplementaryContracts} onChange={(e) => handleInputChange('hasSupplementaryContracts', e.target.checked)} />
                <CheckboxLabel htmlFor="hasSupplementaryContracts">Υπάρχει Συμπληρωματική Σύμβαση</CheckboxLabel>
              </CheckboxContainer>

              {formData.hasSupplementaryContracts && (
                <div style={{ background: '#f0faf0', borderRadius: '8px', padding: '1rem', border: '1px solid #c3e6c3', marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#28a745', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Συμπληρωματικές Συμβάσεις</div>
                  {formData.supplementaryContracts.map((contract, index) => (
                    <div key={index} style={{ background: 'white', borderRadius: '6px', padding: '0.8rem', marginBottom: '0.6rem', border: '1px solid #d4edda' }}>
                      <FormGrid cols={3}>
                        <FormGroup>
                          <Label>Ημερομηνία {index + 1}</Label>
                          <Input type="date" value={contract.date} onChange={(e) => updateSupplementaryContract(index, 'date', e.target.value)} />
                        </FormGroup>
                        <FormGroup>
                          <Label>Ποσό {index + 1}</Label>
                          <Input type="text" value={contract.amount} onChange={(e) => updateSupplementaryContract(index, 'amount', e.target.value)} placeholder="π.χ. 5.000,00" />
                        </FormGroup>
                        <FormGroup>
                          <Label>Σχόλια {index + 1}</Label>
                          <Input type="text" value={contract.comments} onChange={(e) => updateSupplementaryContract(index, 'comments', e.target.value)} placeholder="Σχόλια" />
                        </FormGroup>
                      </FormGrid>
                      <RemoveSupplementaryButton onClick={() => removeSupplementaryContract(index)} style={{ marginTop: '0.5rem' }}>Αφαίρεση</RemoveSupplementaryButton>
                    </div>
                  ))}
                  <AddSupplementaryButton onClick={addSupplementaryContract}>+ Προσθήκη Συμπληρωματικής</AddSupplementaryButton>
                </div>
              )}
            </Section>
          )}

          {/* ── SECTION 6: Αρχεία ── */}
          <Section>
            <SectionTitle>📁 Αρχεία Υποέργου</SectionTitle>
            <FileUploadSection onClick={handleFileSelect}>
              <div>
                <strong>Ανέβασμα Αρχείων</strong>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>Κλικ για επιλογή αρχείων (PDF, Word)</p>
              </div>
            </FileUploadSection>

            {formData.fileGroups && formData.fileGroups.length > 0 && (
              <FileList>
                <strong style={{ fontSize: '0.85rem', color: '#495057' }}>Ομάδες Αρχείων:</strong>
                {formData.fileGroups.map((group) => (
                  <div key={group.id} style={{ padding: '0.8rem', background: '#e8f5e8', border: '1px solid #c3e6c3', borderRadius: '8px', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📁</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{group.title}</span>
                        <span style={{ fontSize: '0.75rem', color: '#666', background: '#d4edda', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{group.files.length} αρχείο(α)</span>
                      </div>
                      <button type="button" onClick={() => removeFileGroup(group.id)} style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}>🗑️ Αφαίρεση</button>
                    </div>
                    {group.files.map((file, fileIndex) => (
                      <div key={fileIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.5rem', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem' }}>📄 {file.name}</span>
                        <button type="button" onClick={() => removeFileFromGroup(group.id, fileIndex)} style={{ background: '#ffc107', color: '#212529', border: 'none', borderRadius: '3px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', cursor: 'pointer' }}>Αφαίρεση</button>
                      </div>
                    ))}
                  </div>
                ))}
              </FileList>
            )}

            {selectedFiles.length > 0 && (
              <FileList>
                <strong style={{ fontSize: '0.85rem', color: '#495057' }}>Αρχεία Χωρίς Ομαδοποίηση:</strong>
                {selectedFiles.map((file, index) => (
                  <FileItem key={index}>
                    <span>{file.name}</span>
                    <RemoveContractButton onClick={() => removeFile(index)}>Αφαίρεση</RemoveContractButton>
                  </FileItem>
                ))}
              </FileList>
            )}
          </Section>

        </FormScrollArea>

        <StickyFooter>
          <CancelButton onClick={onClose}>
            ✕ ΑΚΥΡΩΣΗ
          </CancelButton>
          <SaveButton onClick={handleSave}>
            ✓ ΑΠΟΘΗΚΕΥΣΗ
          </SaveButton>
          {editingProject && onDelete && (
            <DeleteFormButton
              onClick={() => onDelete(editingProject.projectId, editingProject.subprojectId)}
            >
              🗑 ΔΙΑΓΡΑΦΗ
            </DeleteFormButton>
          )}
        </StickyFooter>
      </FormContainer>
    </FormOverlay>
  );
}

export default ProjectForm;
