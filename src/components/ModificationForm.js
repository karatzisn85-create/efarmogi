import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { safeFileDialog } from '../utils/safeDialogs';
import {
  formatEntaxiAmount,
  formatEntaxiAmountDelta,
  getEntaxiCurrentTotal
} from '../utils/entaxiAmountUtils';
import { parseGreekAmountString } from '../utils/khmdhsFields';

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 10002;
  padding: 1.25rem 1rem 2rem;
  overflow-y: auto;
  box-sizing: border-box;
`;

const FormContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1.75rem 2rem 2rem;
  max-width: 720px;
  width: 100%;
  margin: auto 0;
  flex-shrink: 0;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
  border: 1px solid #e2e8f0;
`;

const FormHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
`;

const FormTitle = styled.h2`
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "⚡";
    font-size: 1.3rem;
  }
`;

const CloseButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s ease;

  &:hover {
    background: #c82333;
  }
`;

const EntaxiInfo = styled.div`
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
`;

const InfoTitle = styled.div`
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: "📋";
    font-size: 1rem;
  }
`;

const InfoDetails = styled.div`
  font-size: 0.9rem;
  color: #333;
  line-height: 1.4;
`;

const CurrentAmount = styled.div`
  background: #e8f5e8;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  padding: 0.8rem;
  margin: 1rem 0;
  text-align: center;
  font-weight: 600;
  color: #2e7d32;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  ${props => props.fullWidth && `
    grid-column: 1 / -1;
  `}
`;

const Label = styled.label`
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #2196F3;
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

  &:focus {
    border-color: #2196F3;
  }
`;


const FileSelectButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #0056b3;
  }
`;





const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.25rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 2rem;
  border-top: 2px solid #e9ecef;
`;

const Button = styled.button`
  padding: 0.8rem 2rem;
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

const PreviewAmount = styled.div`
  background: ${props => props.positive ? '#e8f5e8' : props.negative ? '#ffebee' : '#f5f5f5'};
  border: 1px solid ${props => props.positive ? '#c8e6c9' : props.negative ? '#ffcdd2' : '#ddd'};
  border-radius: 6px;
  padding: 0.8rem;
  margin-top: 1rem;
  text-align: center;
  font-weight: 600;
  color: ${props => props.positive ? '#2e7d32' : props.negative ? '#c62828' : '#666'};
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #2196F3;
`;

const CheckboxLabel = styled.label`
  font-weight: 600;
  color: #333;
  cursor: pointer;
  font-size: 1rem;
`;

const AmountContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

function ModificationForm({ isOpen, onClose, onSave, entaxi, isEditMode = false }) {
  const [formData, setFormData] = useState({
    date: '',
    changeAmount: false, // Checkbox για αλλαγή ποσού
    amount: '',
    comments: '', // Σχόλια τροποποίησης
    modificationPDF: null,
    approvalPDF: null
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && entaxi) {
        // Edit mode: load modification data
        setFormData({
          date: entaxi.date || '',
          changeAmount: entaxi.amount ? true : false,
          amount: entaxi.amount || '',
          comments: entaxi.comments || '',
          modificationPDF: entaxi.modificationPDF || null,
          approvalPDF: entaxi.approvalPDF || null
        });
      } else {
        // Create mode: load default values
        setFormData({
          date: '',
          changeAmount: false,
          amount: '',
          comments: '',
          modificationPDF: null,
          approvalPDF: null
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditMode, entaxi]);

  const formatAmountOnBlur = (value) => {
    if (!value) return '';

    // Handle +/- prefix for delta amounts
    const sign = value.startsWith('+') || value.startsWith('-') ? value.charAt(0) : '';
    const cleanValue = value.replace(/^[+-]/, '');

    let cleaned = cleanValue.replace(/[^\d,.]/g, '');
    if (!/\d/.test(cleaned)) return sign;

    let integerPart = '';
    let decimalPart = '';

    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
        let parts = cleaned.split('.');
        integerPart = parts[0].replace(/,/g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      } else {
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
    return sign + result;
  };

  /** Βάση για υπολογισμό: τρέχον σύνολο ΠΡΙΝ από τη νέα/τρέχουσα τροποποίηση. */
  const getBaselineTotal = () => {
    if (!entaxi) return 0;
    if (isEditMode) {
      return getEntaxiCurrentTotal(
        {
          initialAmount: entaxi.initialAmount,
          modifications: entaxi.modifications || []
        },
        { beforeModificationId: entaxi.modificationId }
      );
    }
    return getEntaxiCurrentTotal(entaxi);
  };

  const calculateCurrentAmount = () => formatEntaxiAmount(getBaselineTotal());

  const calculateNewAmount = () => {
    if (!formData.amount || !entaxi) return null;

    const currentWithMods = getBaselineTotal();
    const absoluteAmount = parseGreekAmountString(formData.amount);
    const delta = absoluteAmount - currentWithMods;
    return {
      newTotal: formatEntaxiAmount(absoluteAmount),
      delta
    };
  };

  const handleInputChange = useCallback((field, value) => {
    // ΑΠΑΓΟΡΕΥΟΥΜΕ ΟΠΟΙΑΔΗΠΟΤΕ ΝORMALIZATION/TRIM ΚΑΤΑ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ
    // Το value περνάει ως έχει, χωρίς μετατροπές (εκτός από amount που έχει special handling)
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[field]) {
        return {
          ...prev,
          [field]: null
        };
      }
      return prev;
    });
  }, []);

  const handleAmountChange = useCallback((value) => {
    // Για amount fields, κάνουμε μόνο minimum formatting για +/- prefix
    // ΔΕΝ κάνουμε άλλες μετατροπές κατά την πληκτρολόγηση
    
    setFormData(prev => {
      let processedValue = value;
      
      if (prev.amountType === 'delta') {
        // For delta, ensure +/- prefix
        if (processedValue && !processedValue.startsWith('+') && !processedValue.startsWith('-')) {
          // Μόνο αν το value δεν είναι κενό, προσθέτουμε +
          if (processedValue.trim()) {
            processedValue = '+' + processedValue;
          }
        }
      } else {
        // For absolute, remove +/- prefix μόνο αν υπάρχει στην αρχή
        // ΔΕΝ κάνουμε replace που μπορεί να αφαιρέσει + ή - από μέσα στο κείμενο
        if (processedValue.startsWith('+') || processedValue.startsWith('-')) {
          processedValue = processedValue.substring(1);
        }
      }
      
      return {
        ...prev,
        amount: processedValue
      };
    });
  }, []);

  const handleAmountBlur = (value) => {
    const formatted = formatAmountOnBlur(value);
    setFormData(prev => ({
      ...prev,
      amount: formatted
    }));
  };


  const handleFileSelect = async (field, title) => {
    try {
      const result = await safeFileDialog('select-file', title);
      if (result.success && !result.canceled) {
        setFormData(prev => ({
          ...prev,
          [field]: {
            fileName: result.fileName,
            filePath: result.filePath
          }
        }));
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = 'Η ημερομηνία είναι υποχρεωτική';
    }

    if (formData.changeAmount && !formData.amount) {
      newErrors.amount = 'Το ποσό είναι υποχρεωτικό όταν επιλέγετε αλλαγή ποσού';
    }

    if (!formData.comments) {
      newErrors.comments = 'Τα σχόλια τροποποίησης είναι υποχρεωτικά';
    }

    if (!formData.modificationPDF) {
      newErrors.modificationPDF = 'Το αρχείο τροποποίησης είναι υποχρεωτικό';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const baselineTotal = getBaselineTotal();
      const absoluteNewTotal = formData.changeAmount && formData.amount
        ? parseGreekAmountString(formData.amount)
        : baselineTotal;
      const storedAmount = formData.changeAmount && formData.amount
        ? formatEntaxiAmount(absoluteNewTotal)
        : '';

      let modificationData = {
        modificationId: isEditMode ? entaxi.modificationId : uuidv4(),
        entaxiId: isEditMode ? entaxi.entaxiId : entaxi.entaxiId,
        date: formData.date,
        changeAmount: formData.changeAmount,
        // Απόλυτο νέο σύνολο ένταξης (όχι delta προς πρόσθεση)
        amount: storedAmount,
        comments: formData.comments,
        // File data is already in the correct format from handleFileSelect
        modificationPDF: formData.modificationPDF || null,
        approvalPDF: formData.approvalPDF || null,
        createdAt: isEditMode ? entaxi.createdAt : new Date().toISOString(),
        updatedAt: isEditMode ? new Date().toISOString() : undefined,
        cumulativeAmount: formatEntaxiAmount(absoluteNewTotal)
      };

      await onSave(modificationData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !entaxi) return null;

  const newAmountCalc = calculateNewAmount();

  return createPortal(
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContainer>
        <FormHeader>
          <FormTitle>{isEditMode ? 'Επεξεργασία Τροποποίησης Ένταξης' : 'Νέα Τροποποίηση Ένταξης'}</FormTitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </FormHeader>

        <EntaxiInfo>
          <InfoTitle>Στοιχεία Ένταξης</InfoTitle>
          <InfoDetails>
            <div><strong>Θέμα:</strong> {entaxi.subject}</div>
            <div><strong>Φορέας:</strong> {entaxi.fundingAuthority}</div>
            <div><strong>Αρχικό Ποσό:</strong> {entaxi.initialAmount} €</div>
          </InfoDetails>
          <CurrentAmount>
            {isEditMode ? 'Σύνολο πριν από αυτή την τροποποίηση' : 'Τρέχον σύνολο ένταξης'}: {calculateCurrentAmount()} €
          </CurrentAmount>
        </EntaxiInfo>

        <form onSubmit={handleSubmit}>
          <FormGrid>
            <FormGroup>
              <Label>Ημερομηνία Τροποποίησης *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
              {errors.date && <ErrorMessage>{errors.date}</ErrorMessage>}
            </FormGroup>

            <FormGroup fullWidth>
              <CheckboxContainer>
                <Checkbox
                  type="checkbox"
                  id="changeAmount"
                  checked={formData.changeAmount}
                  onChange={(e) => handleInputChange('changeAmount', e.target.checked)}
                />
                <CheckboxLabel htmlFor="changeAmount">
                  Αλλαγή ποσού ένταξης
                </CheckboxLabel>
              </CheckboxContainer>
              
              {formData.changeAmount && (
                <AmountContainer>
                  <Label>Νέο Ποσό Ένταξης (€)</Label>
                  <Input
                    type="text"
                    value={formData.amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={(e) => handleAmountBlur(e.target.value)}
                    placeholder="π.χ. 180.000,00"
                  />
                  {formData.amount && newAmountCalc && (
                    <PreviewAmount 
                      positive={newAmountCalc.delta > 0} 
                      negative={newAmountCalc.delta < 0}
                    >
                      Νέο Σύνολο: {newAmountCalc.newTotal} €
                      <br />
                      <small>
                        Μεταβολή: {formatEntaxiAmountDelta(newAmountCalc.delta)} €
                      </small>
                    </PreviewAmount>
                  )}
                  {errors.amount && <ErrorMessage>{errors.amount}</ErrorMessage>}
                </AmountContainer>
              )}
            </FormGroup>

            <FormGroup fullWidth>
              <Label>Σχόλια Τροποποίησης *</Label>
              <TextArea
                value={formData.comments}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder="Περιγράψτε τις τροποποιήσεις που έχουν γίνει πέραν του αρχικού ποσού της ένταξης..."
                rows={3}
              />
              {errors.comments && <ErrorMessage>{errors.comments}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Αρχείο Τροποποίησης (PDF, Word) *</Label>
              <FileSelectButton
                type="button"
                onClick={() => handleFileSelect('modificationPDF', 'Επιλογή Αρχείου Τροποποίησης (PDF, Word)')}
              >
                📁 Επιλογή Αρχείου
              </FileSelectButton>
              {formData.modificationPDF && (
                <div style={{ marginTop: '0.5rem', color: '#28a745', fontSize: '0.9rem' }}>
                  📄 {formData.modificationPDF.fileName}
                </div>
              )}
              {errors.modificationPDF && <ErrorMessage>{errors.modificationPDF}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Αρχείο Αποδοχής Δ.Σ. (PDF, Word) (Προαιρετικό)</Label>
              <FileSelectButton
                type="button"
                onClick={() => handleFileSelect('approvalPDF', 'Επιλογή Αρχείου Αποδοχής (PDF, Word)')}
              >
                📁 Επιλογή Αρχείου
              </FileSelectButton>
              {formData.approvalPDF && (
                <div style={{ marginTop: '0.5rem', color: '#28a745', fontSize: '0.9rem' }}>
                  📄 {formData.approvalPDF.fileName}
                </div>
              )}
            </FormGroup>
          </FormGrid>

          <ButtonContainer>
            <Button type="button" onClick={onClose} disabled={loading}>
              Ακύρωση
            </Button>
            <Button type="submit" primary disabled={loading}>
              {loading ? 'Αποθήκευση...' : 'Αποθήκευση Τροποποίησης'}
            </Button>
          </ButtonContainer>
        </form>
      </FormContainer>
    </FormOverlay>,
    document.body
  );
}

export default ModificationForm;
