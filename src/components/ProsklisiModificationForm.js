import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { safeFileDialog } from '../utils/safeDialogs';

// Styled Components
const FormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1200;
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 15px;
  max-width: 1400px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
`;

const FormHeader = styled.div`
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  padding: 2rem;
  border-radius: 15px 15px 0 0;
  text-align: center;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &::before {
    content: "⚡";
    font-size: 1.3rem;
  }
`;

const FormContent = styled.div`
  padding: 2rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  ${props => props.changed && `
    color: #ff9800;
    font-weight: 600;
    
    &::after {
      content: "●";
      color: #ff9800;
      font-size: 0.8rem;
    }
  `}
`;

const Input = styled.input`
  padding: 1rem;
  border: 2px solid ${props => props.changed ? '#ff9800' : '#e9ecef'};
  border-radius: 8px;
  font-size: 1.1rem;
  min-height: 50px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    outline: none;
    border-color: ${props => props.changed ? '#ff9800' : '#28a745'};
    box-shadow: 0 0 0 2px ${props => props.changed ? 'rgba(255, 152, 0, 0.25)' : 'rgba(40, 167, 69, 0.25)'};
  }
`;

const TextArea = styled.textarea`
  padding: 0.8rem;
  border: 2px solid ${props => props.changed ? '#ff9800' : '#dee2e6'};
  border-radius: 6px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  word-wrap: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus {
    outline: none;
    border-color: ${props => props.changed ? '#ff9800' : '#28a745'};
    box-shadow: 0 0 0 2px ${props => props.changed ? 'rgba(255, 152, 0, 0.25)' : 'rgba(40, 167, 69, 0.25)'};
  }
`;

const Select = styled.select`
  padding: 1rem;
  border: 2px solid ${props => props.changed ? '#ff9800' : '#e9ecef'};
  border-radius: 8px;
  font-size: 1.1rem;
  min-height: 50px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.changed ? '#ff9800' : '#28a745'};
    box-shadow: 0 0 0 2px ${props => props.changed ? 'rgba(255, 152, 0, 0.25)' : 'rgba(40, 167, 69, 0.25)'};
  }
`;

const ModificationDescriptionGroup = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 2rem;
`;

const ModificationDescription = styled(TextArea)`
  min-height: 150px;
  background: #fff3e0;
  border: 2px solid #ff9800;
  
  &::placeholder {
    color: #ff9800;
    font-weight: 500;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
`;

const Button = styled.button`
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s ease;

  ${props => props.primary ? `
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    color: white;
    
    &:hover {
      background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
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

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

const ChangesSummary = styled.div`
  background: #fff3e0;
  border: 1px solid #ff9800;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const ChangesTitle = styled.h4`
  color: #ff9800;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "📝";
    font-size: 1rem;
  }
`;

const ChangeItem = styled.div`
  color: #e65100;
  font-size: 0.9rem;
  margin: 0.25rem 0;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 152, 0, 0.1);
  border-radius: 4px;
`;

const FileSelectButton = styled.button`
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  }
`;

const SelectedFile = styled.div`
  background: #e8f5e8;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  padding: 0.8rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #2e7d32;
`;

// Constants
const STATUS_OPTIONS = [
  'Υπό Ωρίμανση',
  'Υπό Υποβολή', 
  'Υποβληθέν ΤΔΠ'
];

function ProsklisiModificationForm({ isOpen, onClose, onSave, originalProsklisi, isEditMode = false }) {
  const [formData, setFormData] = useState({
    title: '',
    axis: '',
    fundingSource: '',
    code: '',
    deadline: '',
    budgetRange: '',
    status: 'Υπό Ωρίμανση',
    modificationDescription: '',
    modificationPDF: null,
    modificationDocumentDate: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState({});

  useEffect(() => {
    if (originalProsklisi) {
      if (isEditMode) {
        // Edit mode: load modification data
        setFormData({
          title: originalProsklisi.modifiedData?.title || originalProsklisi.title || '',
          axis: originalProsklisi.modifiedData?.axis || originalProsklisi.axis || '',
          fundingSource: originalProsklisi.modifiedData?.fundingSource || originalProsklisi.fundingSource || '',
          code: originalProsklisi.modifiedData?.code || originalProsklisi.code || '',
          deadline: originalProsklisi.modifiedData?.deadline || originalProsklisi.deadline || '',
          budgetRange: originalProsklisi.modifiedData?.budgetRange || originalProsklisi.budgetRange || '',
          status: originalProsklisi.modifiedData?.status || originalProsklisi.status || 'Υπό Ωρίμανση',
          modificationDescription: originalProsklisi.modificationDescription || '',
          modificationPDF: originalProsklisi.modificationPDF || null,
          modificationDocumentDate: (originalProsklisi.modificationDocumentDate
            ? originalProsklisi.modificationDocumentDate
            : (originalProsklisi.createdAt ? new Date(originalProsklisi.createdAt).toISOString().slice(0,10) : ''))
        });
      } else {
        // Create mode: load original prosklisi data
        setFormData({
          title: originalProsklisi.title || '',
          axis: originalProsklisi.axis || '',
          fundingSource: originalProsklisi.fundingSource || '',
          code: originalProsklisi.code || '',
          deadline: originalProsklisi.deadline || '',
          budgetRange: originalProsklisi.budgetRange || '',
          status: originalProsklisi.status || 'Υπό Ωρίμανση',
          modificationDescription: '',
          modificationPDF: null,
          modificationDocumentDate: ''
        });
      }
    }
    setErrors({});
    setChanges({});
  }, [originalProsklisi, isOpen, isEditMode]);

  // Track changes
  useEffect(() => {
    if (originalProsklisi && formData) {
      const newChanges = {};
      
      // Μόνο τα πεδία της πρόσκλησης, όχι τα modification fields
      const prosklisiFields = ['title', 'axis', 'fundingSource', 'code', 'deadline', 'budgetRange', 'status'];
      
      prosklisiFields.forEach(key => {
        // Για νέα τροποποίηση: συγκρίνουμε με τα αρχικά δεδομένα της πρόσκλησης
        // Για επεξεργασία τροποποίησης: συγκρίνουμε με τα αρχικά δεδομένα της πρόσκλησης (όχι της τροποποίησης)
        let originalValue;
        
        if (isEditMode) {
          // Σε edit mode, το originalProsklisi περιέχει τα δεδομένα της τροποποίησης
          // Πρέπει να πάρουμε τα αρχικά δεδομένα της πρόσκλησης
          // Αυτό θα πρέπει να περαστεί ως ξεχωριστό prop
          originalValue = originalProsklisi.originalProsklisiData?.[key] || '';
        } else {
          // Σε create mode, το originalProsklisi περιέχει τα αρχικά δεδομένα της πρόσκλησης
          originalValue = originalProsklisi[key] || '';
        }
        
        if (originalValue !== formData[key]) {
          newChanges[key] = {
            original: originalValue,
            current: formData[key] || ''
          };
        }
      });
      
      setChanges(newChanges);
    }
  }, [formData, originalProsklisi, isEditMode]);

  const handleInputChange = useCallback((field, value) => {
    // ΑΠΑΓΟΡΕΥΟΥΜΕ ΟΠΟΙΑΔΗΠΟΤΕ ΝORMALIZATION/TRIM ΚΑΤΑ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ
    // Το value περνάει ως έχει, χωρίς μετατροπές
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[field]) {
        return {
          ...prev,
          [field]: ''
        };
      }
      return prev;
    });
  }, []);

  const handleFileSelect = async () => {
    try {
      const result = await safeFileDialog('select-file', 'Επιλογή Αρχείου Τροποποίησης (PDF, Word)');
      if (result.success && !result.canceled) {
        setFormData(prev => ({
          ...prev,
          modificationPDF: {
            fileName: result.fileName,
            filePath: result.filePath
          }
        }));
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const getFieldLabel = (field) => {
    const fieldLabels = {
      'fundingSource': 'Πηγή Χρηματοδότησης',
      'deadline': 'Ημερομηνία Λήξης Υποβολής',
      'title': 'Τίτλος',
      'axis': 'Άξονας',
      'code': 'Κωδικός',
      'budgetRange': 'Εύρος Προϋπολογισμού',
      'status': 'Κατάσταση'
    };
    return fieldLabels[field] || field;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Ο τίτλος είναι υποχρεωτικός';
    }

    if (!formData.axis.trim()) {
      newErrors.axis = 'Ο άξονας είναι υποχρεωτικός';
    }

    if (!formData.fundingSource.trim()) {
      newErrors.fundingSource = 'Η πηγή χρηματοδότησης είναι υποχρεωτική';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Ο κωδικός είναι υποχρεωτικός';
    }

    if (!formData.deadline) {
      newErrors.deadline = 'Η ημερομηνία λήξης είναι υποχρεωτική';
    }

    if (!formData.budgetRange.trim()) {
      newErrors.budgetRange = 'Το εύρος προϋπολογισμού είναι υποχρεωτικό';
    }

    if (!formData.modificationDescription.trim()) {
      newErrors.modificationDescription = 'Η περιγραφή τροποποίησης είναι υποχρεωτική';
    }

    if (!formData.modificationDocumentDate) {
      newErrors.modificationDocumentDate = 'Η ημερομηνία εγγράφου τροποποίησης είναι υποχρεωτική';
    }

    // Το PDF είναι προαιρετικό, αλλά αν επιλεγεί πρέπει να είναι έγκυρο
    if (formData.modificationPDF && !formData.modificationPDF.fileName) {
      newErrors.modificationPDF = 'Το επιλεγμένο αρχείο δεν είναι έγκυρο';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const modificationData = {
        modificationId: isEditMode ? originalProsklisi.modificationId : uuidv4(),
        originalProsklisiId: originalProsklisi.prosklisiId || originalProsklisi.id,
        modifiedData: { ...formData },
        changes: changes,
        modificationDescription: formData.modificationDescription,
        modificationPDF: formData.modificationPDF,
        modificationDocumentDate: formData.modificationDocumentDate,
        createdAt: isEditMode ? originalProsklisi.createdAt : new Date().toISOString(),
        updatedAt: isEditMode ? new Date().toISOString() : undefined
      };

      await onSave(modificationData);
    } catch (error) {
      console.error('Error saving modification:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !originalProsklisi) return null;

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContainer>
        <FormHeader>
          <FormTitle>Τροποποίηση Πρόσκλησης</FormTitle>
        </FormHeader>

        <FormContent>
          {hasChanges && (
            <ChangesSummary>
              <ChangesTitle>Αλλαγές που εντοπίστηκαν:</ChangesTitle>
              {Object.entries(changes).map(([field, change]) => (
                <ChangeItem key={field}>
                <strong>{getFieldLabel(field)}:</strong> "{change.original}" → "{change.current}"
                </ChangeItem>
              ))}
            </ChangesSummary>
          )}

          <form onSubmit={handleSubmit}>
            <FormGrid>
              <FormGroup>
                <Label changed={changes.title}>Τίτλος Πρόσκλησης *</Label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  changed={changes.title}
                  placeholder="Εισάγετε τον τίτλο της πρόσκλησης"
                />
                {errors.title && <ErrorMessage>{errors.title}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.axis}>Άξονας *</Label>
                <Input
                  type="text"
                  value={formData.axis}
                  onChange={(e) => handleInputChange('axis', e.target.value)}
                  changed={changes.axis}
                  placeholder="Εισάγετε τον άξονα"
                />
                {errors.axis && <ErrorMessage>{errors.axis}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.fundingSource}>Πηγή Χρηματοδότησης *</Label>
                <Input
                  type="text"
                  value={formData.fundingSource}
                  onChange={(e) => handleInputChange('fundingSource', e.target.value)}
                  changed={changes.fundingSource}
                  placeholder="Εισάγετε την πηγή χρηματοδότησης"
                />
                {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.code}>Κωδικός *</Label>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  changed={changes.code}
                  placeholder="Εισάγετε τον κωδικό"
                />
                {errors.code && <ErrorMessage>{errors.code}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.deadline}>Ημερομηνία Λήξης *</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  changed={changes.deadline}
                />
                {errors.deadline && <ErrorMessage>{errors.deadline}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Ημερομηνία Εγγράφου Τροποποίησης *</Label>
                <Input
                  type="date"
                  value={formData.modificationDocumentDate}
                  onChange={(e) => handleInputChange('modificationDocumentDate', e.target.value)}
                />
                {errors.modificationDocumentDate && <ErrorMessage>{errors.modificationDocumentDate}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.budgetRange}>Έύρος Προϋπολογισμού *</Label>
                <Input
                  type="text"
                  value={formData.budgetRange}
                  onChange={(e) => handleInputChange('budgetRange', e.target.value)}
                  changed={changes.budgetRange}
                  placeholder="π.χ. 50.000 - 100.000 €"
                />
                {errors.budgetRange && <ErrorMessage>{errors.budgetRange}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={changes.status}>Κατάσταση *</Label>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  changed={changes.status}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
                {errors.status && <ErrorMessage>{errors.status}</ErrorMessage>}
              </FormGroup>

              <ModificationDescriptionGroup>
                <Label>Περιγραφή Τροποποίησης *</Label>
                <ModificationDescription
                  value={formData.modificationDescription}
                  onChange={(e) => handleInputChange('modificationDescription', e.target.value)}
                  placeholder="Περιγράψτε αναλυτικά τι τροποποιήθηκε στην πρόσκληση..."
                />
                {errors.modificationDescription && <ErrorMessage>{errors.modificationDescription}</ErrorMessage>}
              </ModificationDescriptionGroup>

              <ModificationDescriptionGroup>
                <Label>Αρχείο Τροποποίησης (PDF, Word) - Προαιρετικό</Label>
                <FileSelectButton
                  type="button"
                  onClick={handleFileSelect}
                >
                  📁 Επιλογή Αρχείου
                </FileSelectButton>
                {formData.modificationPDF && (
                  <SelectedFile>
                    <span>📄</span>
                    <span>{formData.modificationPDF.fileName}</span>
                  </SelectedFile>
                )}
                {errors.modificationPDF && <ErrorMessage>{errors.modificationPDF}</ErrorMessage>}
              </ModificationDescriptionGroup>
            </FormGrid>

            <ButtonContainer>
              <Button type="button" onClick={onClose}>
                Ακύρωση
              </Button>
              <Button 
                type="submit" 
                primary 
                disabled={saving}
              >
                {saving ? 'Αποθήκευση...' : '💾 Αποθήκευση Τροποποίησης'}
              </Button>
            </ButtonContainer>
          </form>
        </FormContent>
      </FormContainer>
    </FormOverlay>
  );
}

export default ProsklisiModificationForm;
