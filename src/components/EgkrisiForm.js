import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider';
import {
  FormOverlay,
  FormContainer as ChromeFormContainer,
  FormHero,
  HeroText,
  HeroEyebrow,
  FormTitle,
  CloseButton,
  FormBody,
  FormGroup,
  Label,
  Input,
  Select,
  TextArea,
  ErrorMessage,
  ButtonContainer,
  Button,
} from './modernFormChrome';

const ipcRenderer = window.electronAPI;

const FormShell = styled(ChromeFormContainer)`
  max-width: min(800px, calc(100vw - 2rem));
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ScrollBody = styled(FormBody)`
  overflow-y: auto;
  flex: 1;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FileInputGroup = styled.div`
  padding: 1.1rem;
  border: 1.5px dashed #a5b4fc;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.65) 0%, #ffffff 100%);
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    background: #eef2ff;
    border-color: #818cf8;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileInputLabel = styled.label`
  cursor: pointer;
  color: #3730a3;
  font-weight: 700;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

const SelectedFile = styled.div`
  margin-top: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: #eef2ff;
  color: #312e81;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
`;

const RemoveFileButton = styled.button`
  background: #fff;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;

  &:hover {
    background: #fef2f2;
  }
`;

const ProjectSubprojectGroup = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.15rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

function EgkrisiForm({ projects, selectedProject, onClose }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'initial',
    notes: '',
    projectId: selectedProject?.projectId || '',
    subprojectId: selectedProject?.subprojectId || ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [availableSubprojects, setAvailableSubprojects] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Get unique projects for dropdown
  const uniqueProjects = projects && Array.isArray(projects) ? projects.reduce((acc, projectGroup) => {
    if (!projectGroup || !Array.isArray(projectGroup) || projectGroup.length === 0) return acc;
    
    const projectId = projectGroup[0].projectId;
    const projectTitle = projectGroup[0].projectTitle;
    
    if (!acc.find(p => p.projectId === projectId)) {
      acc.push({ projectId, projectTitle });
    }
    
    return acc;
  }, []) : [];

  // Update available subprojects when project changes
  useEffect(() => {
    if (formData.projectId && projects && Array.isArray(projects)) {
      const projectGroup = projects.find(group => 
        group && Array.isArray(group) && group.some(p => p.projectId === formData.projectId)
      );
      
      if (projectGroup) {
        setAvailableSubprojects(projectGroup);
        
        // Reset subproject if not in new list
        if (!projectGroup.find(p => p.subprojectId === formData.subprojectId)) {
          setFormData(prev => ({ ...prev, subprojectId: '' }));
        }
      }
    } else {
      setAvailableSubprojects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.projectId, projects]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    // ΑΠΑΓΟΡΕΥΟΥΜΕ ΟΠΟΙΑΔΗΠΟΤΕ ΝORMALIZATION/TRIM ΚΑΤΑ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ
    // Το value περνάει ως έχει, χωρίς μετατροπές
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    setErrors(prev => {
      if (prev[name]) {
        return { ...prev, [name]: '' };
      }
      return prev;
    });
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file && validTypes.includes(file.type)) {
      setSelectedFile(file);
      setErrors(prev => ({ ...prev, file: '' }));
    } else {
      showToast('Παρακαλώ επιλέξτε ένα αρχείο PDF ή Word (.doc, .docx)', 'warning');
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.projectId) {
      newErrors.projectId = 'Παρακαλώ επιλέξτε έργο';
    }

    if (!formData.subprojectId) {
      newErrors.subprojectId = 'Παρακαλώ επιλέξτε υποέργο';
    }

    if (!formData.date) {
      newErrors.date = 'Παρακαλώ εισάγετε ημερομηνία';
    }

    if (!selectedFile) {
      newErrors.file = 'Παρακαλώ επιλέξτε αρχείο (PDF, Word)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Generate filename based on date
      const dateObj = new Date(formData.date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      // Get file extension from original file
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${day}-${month}-${year}.${fileExtension}`;

      // Read file as buffer
      const fileBuffer = await selectedFile.arrayBuffer();
      
      // Prepare egkrisi data
      const egkrisiData = {
        id: uuidv4(),
        fileName,
        date: formData.date,
        type: formData.type,
        notes: formData.notes,
        uploadDate: new Date().toISOString()
      };

      // Save egkrisi data
      const saveResult = await ipcRenderer.invoke(
        'save-egkrisi',
        formData.projectId,
        formData.subprojectId,
        egkrisiData
      );

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save egkrisi data');
      }

      // Upload PDF file
      const uploadResult = await ipcRenderer.invoke(
        'upload-egkriseis-pdfs',
        [{
          name: fileName,
          data: Buffer.from(fileBuffer)
        }],
        [{
          fileName,
          projectId: formData.projectId,
          subprojectId: formData.subprojectId
        }]
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload PDF');
      }

      showToast('Η έγκριση αποθηκεύτηκε επιτυχώς!', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving egkrisi:', error);
      showToast('Σφάλμα κατά την αποθήκευση: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormShell>
        <FormHero>
          <HeroText>
            <HeroEyebrow>Εγκρίσεις</HeroEyebrow>
            <FormTitle>Νέα έγκριση διάθεσης πίστωσης</FormTitle>
          </HeroText>
          <CloseButton type="button" onClick={onClose}>Κλείσιμο</CloseButton>
        </FormHero>

        <ScrollBody>
        <Form onSubmit={handleSubmit}>
          <ProjectSubprojectGroup>
            <FormGroup>
              <Label>Έργο *</Label>
              <Select
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
              >
                <option value="">-- Επιλέξτε Έργο --</option>
                {uniqueProjects.map(project => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.projectTitle}
                  </option>
                ))}
              </Select>
              {errors.projectId && <ErrorMessage>{errors.projectId}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label>Υποέργο *</Label>
              <Select
                name="subprojectId"
                value={formData.subprojectId}
                onChange={handleInputChange}
                disabled={!formData.projectId}
              >
                <option value="">-- Επιλέξτε Υποέργο --</option>
                {availableSubprojects.map(subproject => {
                  const aleCodesText = subproject.aleCodes && subproject.aleCodes.length > 0 
                    ? ` | ΑΛΕ: ${subproject.aleCodes.filter(c => c && c.trim()).join(', ')}` 
                    : '';
                  return (
                    <option key={subproject.subprojectId} value={subproject.subprojectId}>
                      {subproject.subprojectTitle} (ΚΑ: {subproject.kaCode}{aleCodesText})
                    </option>
                  );
                })}
              </Select>
              {errors.subprojectId && <ErrorMessage>{errors.subprojectId}</ErrorMessage>}
            </FormGroup>
          </ProjectSubprojectGroup>

          <FormGroup>
            <Label>Ημερομηνία Έγκρισης *</Label>
            <Input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
            />
            {errors.date && <ErrorMessage>{errors.date}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label>Τύπος Έγκρισης</Label>
            <Select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
            >
              <option value="initial">Αρχική Έγκριση</option>
              <option value="modification">Τροποποίηση</option>
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Σημειώσεις</Label>
            <TextArea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Προαιρετικές σημειώσεις..."
            />
          </FormGroup>

          <FormGroup>
            <Label>Αρχείο Έγκρισης (PDF, Word) *</Label>
            <FileInputGroup>
              <FileInput
                type="file"
                id="egkrisiFile"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
              />
              <FileInputLabel htmlFor="egkrisiFile">
                {selectedFile ? (
                  <SelectedFile>
                    {selectedFile.name}
                    <RemoveFileButton type="button" onClick={removeFile}>
                      Αφαίρεση
                    </RemoveFileButton>
                  </SelectedFile>
                ) : (
                  'Κλικ για επιλογή αρχείου (PDF, Word)'
                )}
              </FileInputLabel>
            </FileInputGroup>
            {errors.file && <ErrorMessage>{errors.file}</ErrorMessage>}
          </FormGroup>

          <ButtonContainer>
            <Button type="button" onClick={onClose}>
              Ακύρωση
            </Button>
            <Button primary type="submit" disabled={submitting}>
              {submitting ? 'Αποθήκευση...' : 'Αποθήκευση έγκρισης'}
            </Button>
          </ButtonContainer>
        </Form>
        </ScrollBody>
      </FormShell>
    </FormOverlay>
  );
}

export default EgkrisiForm;
