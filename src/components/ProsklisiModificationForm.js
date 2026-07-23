import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import ProsklisiDiavgeiaSection from './ProsklisiDiavgeiaSection';
import { safeFileDialog } from '../utils/safeDialogs';
import { buildProsklisiDiavgeiaRegistryEntry } from '../utils/prosklisiDiavgeiaRegistry';
import { useToast } from './ToastProvider';
import {
  FormOverlay as ChromeFormOverlay,
  FormContainer as ChromeFormContainer,
  FormHero,
  HeroText,
  HeroEyebrow,
  FormTitle,
  HeroSubtitle,
  CloseButton,
  FormBody,
  FormGrid as ChromeFormGrid,
  FormGroup,
  ChangedLabel as Label,
  ChangedInput as Input,
  ChangedTextArea as TextArea,
  ChangedSelect as Select,
  FileSelectButton,
  ErrorMessage,
  ButtonContainer,
  Button,
} from './modernFormChrome';

const FormOverlay = styled(ChromeFormOverlay)`
  z-index: 10003;
`;

const FormContainer = styled(ChromeFormContainer)`
  max-width: min(1400px, calc(100vw - 2rem));
  overflow: visible;
`;

const FormGrid = styled(ChromeFormGrid)`
  margin-bottom: 0.5rem;
`;

const ModificationDescriptionGroup = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 0.75rem;
`;

const ModificationDescription = styled(TextArea)`
  min-height: 140px;
  background: #fffbeb;
  border-color: #fcd34d;

  &::placeholder {
    color: #b45309;
    font-weight: 500;
  }

  &:focus {
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.22);
  }
`;

const ChangesSummary = styled.div`
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 0.95rem 1.05rem;
  margin-bottom: 1.1rem;
`;

const ChangesTitle = styled.h4`
  color: #b45309;
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 800;
`;

const ChangeItem = styled.div`
  color: #92400e;
  font-size: 0.86rem;
  margin: 0.25rem 0;
  padding: 0.35rem 0.55rem;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 8px;
`;

const SelectedFile = styled.div`
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #3730a3;
`;

// Constants
const STATUS_OPTIONS = [
  'Υπό Ωρίμανση',
  'Υπό Υποβολή', 
  'Υποβληθέν ΤΔΠ'
];

function ProsklisiModificationForm({ isOpen, onClose, onSave, originalProsklisi, isEditMode = false }) {
  const { showToast } = useToast();
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
  const [diavgeiaAutoFilled, setDiavgeiaAutoFilled] = useState(() => new Set());
  const [diavgeiaMeta, setDiavgeiaMeta] = useState(null);
  const [diavgeiaDocument, setDiavgeiaDocument] = useState(null);

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
    setDiavgeiaMeta(isEditMode ? (originalProsklisi?.diavgeiaMeta || null) : null);
    setDiavgeiaDocument(isEditMode ? (originalProsklisi?.diavgeiaDocument || null) : null);
    setDiavgeiaAutoFilled(new Set());
    setErrors({});
    setChanges({});
  }, [originalProsklisi, isOpen, isEditMode]);

  // Track changes
  useEffect(() => {
    if (originalProsklisi && formData) {
      const newChanges = {};
      const prosklisiFields = ['title', 'axis', 'fundingSource', 'code', 'deadline', 'budgetRange', 'status'];
      const previousChanges = isEditMode && originalProsklisi.changes && typeof originalProsklisi.changes === 'object'
        ? originalProsklisi.changes
        : {};

      prosklisiFields.forEach((key) => {
        let originalValue;
        if (isEditMode) {
          // Βάση = τιμή ΠΡΙΝ από αυτή την τροποποίηση (όχι η τρέχουσα πρόσκληση,
          // που μπορεί να έχει ήδη την νέα λήξη και να «σβήσει» την αλλαγή).
          if (previousChanges[key] && previousChanges[key].original !== undefined) {
            originalValue = previousChanges[key].original || '';
          } else {
            originalValue = originalProsklisi.originalProsklisiData?.[key] || '';
          }
        } else {
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

    setDiavgeiaAutoFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    
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

  const diavgeiaFieldStyle = useCallback((field) => (
    diavgeiaAutoFilled.has(field)
      ? { borderColor: '#0d9488', background: '#f0fdfa' }
      : undefined
  ), [diavgeiaAutoFilled]);

  const handleDiavgeiaApply = useCallback(({ fields, autoFilledKeys, diavgeiaMeta: meta, preview }) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    setDiavgeiaAutoFilled(new Set(autoFilledKeys));
    setDiavgeiaMeta(meta);
    setDiavgeiaDocument(
      buildProsklisiDiavgeiaRegistryEntry(preview || meta, { roleLabel: 'Τροποποίηση' })
    );
    showToast('Η πράξη Διαύγειας καταχωρήθηκε — θα ανοίγει από τον browser μετά την αποθήκευση.', 'success');
  }, [showToast]);

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
        diavgeiaAda: diavgeiaMeta?.ada || '',
        diavgeiaMeta: diavgeiaMeta || null,
        diavgeiaDocument: diavgeiaMeta?.ada
          ? (diavgeiaDocument || buildProsklisiDiavgeiaRegistryEntry(diavgeiaMeta, { roleLabel: 'Τροποποίηση' }))
          : null,
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

  return createPortal(
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContainer>
        <FormHero>
          <HeroText>
            <HeroEyebrow>Προσκλήσεις</HeroEyebrow>
            <FormTitle>Τροποποίηση πρόσκλησης</FormTitle>
            <HeroSubtitle>
              Τα πεδία που αλλάζουν σημειώνονται με πορτοκαλί ένδειξη.
            </HeroSubtitle>
          </HeroText>
          <CloseButton type="button" onClick={onClose}>Κλείσιμο</CloseButton>
        </FormHero>

        <FormBody>
          {hasChanges && (
            <ChangesSummary>
              <ChangesTitle>Αλλαγές που εντοπίστηκαν</ChangesTitle>
              {Object.entries(changes).map(([field, change]) => (
                <ChangeItem key={field}>
                <strong>{getFieldLabel(field)}:</strong> "{change.original}" → "{change.current}"
                </ChangeItem>
              ))}
            </ChangesSummary>
          )}

          <form onSubmit={handleSubmit}>
            <ProsklisiDiavgeiaSection
              mode="modification"
              initialAda={diavgeiaMeta?.ada || ''}
              initialConfirmedMeta={diavgeiaMeta}
              onApply={handleDiavgeiaApply}
              onClear={() => {
                setDiavgeiaMeta(null);
                setDiavgeiaDocument(null);
                setDiavgeiaAutoFilled(new Set());
              }}
            />
            <FormGrid>
              <FormGroup>
                <Label changed={!!changes.title}>Τίτλος Πρόσκλησης *</Label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  changed={!!changes.title}
                  placeholder="Εισάγετε τον τίτλο της πρόσκλησης"
                  style={diavgeiaFieldStyle('title')}
                />
                {errors.title && <ErrorMessage>{errors.title}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.axis}>Άξονας *</Label>
                <Input
                  type="text"
                  value={formData.axis}
                  onChange={(e) => handleInputChange('axis', e.target.value)}
                  changed={!!changes.axis}
                  placeholder="Εισάγετε τον άξονα"
                  style={diavgeiaFieldStyle('axis')}
                />
                {errors.axis && <ErrorMessage>{errors.axis}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.fundingSource}>Πηγή Χρηματοδότησης *</Label>
                <Input
                  type="text"
                  value={formData.fundingSource}
                  onChange={(e) => handleInputChange('fundingSource', e.target.value)}
                  changed={!!changes.fundingSource}
                  placeholder="Εισάγετε την πηγή χρηματοδότησης"
                  style={diavgeiaFieldStyle('fundingSource')}
                />
                {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.code}>Κωδικός *</Label>
                <Input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  changed={!!changes.code}
                  placeholder="Εισάγετε τον κωδικό"
                  style={diavgeiaFieldStyle('code')}
                />
                {errors.code && <ErrorMessage>{errors.code}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.deadline}>Ημερομηνία Λήξης *</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  changed={!!changes.deadline}
                />
                {errors.deadline && <ErrorMessage>{errors.deadline}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Ημερομηνία Εγγράφου Τροποποίησης *</Label>
                <Input
                  type="date"
                  value={formData.modificationDocumentDate}
                  onChange={(e) => handleInputChange('modificationDocumentDate', e.target.value)}
                  style={diavgeiaFieldStyle('modificationDocumentDate')}
                />
                {errors.modificationDocumentDate && <ErrorMessage>{errors.modificationDocumentDate}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.budgetRange}>Έύρος Προϋπολογισμού *</Label>
                <Input
                  type="text"
                  value={formData.budgetRange}
                  onChange={(e) => handleInputChange('budgetRange', e.target.value)}
                  changed={!!changes.budgetRange}
                  placeholder="π.χ. 50.000 - 100.000 €"
                />
                {errors.budgetRange && <ErrorMessage>{errors.budgetRange}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label changed={!!changes.status}>Κατάσταση *</Label>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  changed={!!changes.status}
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
                  style={diavgeiaFieldStyle('modificationDescription')}
                />
                {errors.modificationDescription && <ErrorMessage>{errors.modificationDescription}</ErrorMessage>}
              </ModificationDescriptionGroup>

              <ModificationDescriptionGroup>
                <Label>Αρχείο Τροποποίησης (PDF, Word) - Προαιρετικό</Label>
                <FileSelectButton
                  type="button"
                  onClick={handleFileSelect}
                >
                  Επιλογή αρχείου
                </FileSelectButton>
                {formData.modificationPDF && (
                  <SelectedFile>
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
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση τροποποίησης'}
              </Button>
            </ButtonContainer>
          </form>
        </FormBody>
      </FormContainer>
    </FormOverlay>,
    document.body
  );
}

export default ProsklisiModificationForm;
