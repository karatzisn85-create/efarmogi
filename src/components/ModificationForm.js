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
import {
  FormOverlay as ChromeFormOverlay,
  FormContainer as ChromeFormContainer,
  FormHero,
  HeroText,
  HeroEyebrow,
  FormTitle,
  CloseButton,
  FormBody,
  FormGrid as ChromeFormGrid,
  FormGroup,
  Label,
  Input,
  TextArea,
  FileSelectButton,
  ErrorMessage,
  ButtonContainer,
  Button,
} from './modernFormChrome';

const FormOverlay = styled(ChromeFormOverlay)`
  z-index: 10002;
`;

const FormContainer = styled(ChromeFormContainer)`
  max-width: min(720px, calc(100vw - 2rem));
`;

const FormGrid = styled(ChromeFormGrid)`
  grid-template-columns: minmax(0, 1fr);
  margin-bottom: 0.5rem;
`;

const EntaxiInfo = styled.div`
  background: linear-gradient(180deg, #eef2ff 0%, #ffffff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 1.25rem;
`;

const InfoTitle = styled.div`
  font-weight: 800;
  color: #312e81;
  margin-bottom: 0.5rem;
  font-size: 0.88rem;
  letter-spacing: 0.02em;
`;

const InfoDetails = styled.div`
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.45;
`;

const CurrentAmount = styled.div`
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 10px;
  padding: 0.75rem;
  margin: 0.85rem 0 0;
  text-align: center;
  font-weight: 700;
  color: #047857;
  font-size: 0.92rem;
`;

const PreviewAmount = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'positive' && prop !== 'negative',
})`
  background: ${(props) => (props.positive ? '#ecfdf5' : props.negative ? '#fef2f2' : '#f8fafc')};
  border: 1px solid ${(props) => (props.positive ? '#a7f3d0' : props.negative ? '#fecaca' : '#e2e8f0')};
  border-radius: 10px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  text-align: center;
  font-weight: 700;
  color: ${(props) => (props.positive ? '#047857' : props.negative ? '#b91c1c' : '#64748b')};
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const Checkbox = styled.input`
  width: 17px;
  height: 17px;
  cursor: pointer;
  accent-color: #4f46e5;
`;

const CheckboxLabel = styled.label`
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  font-size: 0.92rem;
`;

const AmountContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SelectedFileNote = styled.div`
  margin-top: 0.45rem;
  color: #3730a3;
  font-size: 0.86rem;
  font-weight: 600;
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
        <FormHero>
          <HeroText>
            <HeroEyebrow>Εντάξεις</HeroEyebrow>
            <FormTitle>
              {isEditMode ? 'Επεξεργασία τροποποίησης ένταξης' : 'Νέα τροποποίηση ένταξης'}
            </FormTitle>
          </HeroText>
          <CloseButton type="button" onClick={onClose}>Κλείσιμο</CloseButton>
        </FormHero>

        <FormBody>
        <EntaxiInfo>
          <InfoTitle>Στοιχεία ένταξης</InfoTitle>
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
                Επιλογή αρχείου
              </FileSelectButton>
              {formData.modificationPDF && (
                <SelectedFileNote>{formData.modificationPDF.fileName}</SelectedFileNote>
              )}
              {errors.modificationPDF && <ErrorMessage>{errors.modificationPDF}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Αρχείο Αποδοχής Δ.Σ. (PDF, Word) (Προαιρετικό)</Label>
              <FileSelectButton
                type="button"
                onClick={() => handleFileSelect('approvalPDF', 'Επιλογή Αρχείου Αποδοχής (PDF, Word)')}
              >
                Επιλογή αρχείου
              </FileSelectButton>
              {formData.approvalPDF && (
                <SelectedFileNote>{formData.approvalPDF.fileName}</SelectedFileNote>
              )}
            </FormGroup>
          </FormGrid>

          <ButtonContainer>
            <Button type="button" onClick={onClose} disabled={loading}>
              Ακύρωση
            </Button>
            <Button type="submit" primary disabled={loading}>
              {loading ? 'Αποθήκευση...' : 'Αποθήκευση τροποποίησης'}
            </Button>
          </ButtonContainer>
        </form>
        </FormBody>
      </FormContainer>
    </FormOverlay>,
    document.body
  );
}

export default ModificationForm;
