import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider';

const ipcRenderer = window.electronAPI;

const Container = styled.div`
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

const FormContent = styled.div`
  background: white;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 12px;
  padding: 30px;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
`;

const Title = styled.h2`
  color: #2c3e50;
  font-size: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CloseButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    background: #c0392b;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: bold;
  color: #34495e;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
  }

  &[type="date"] {
    cursor: pointer;
  }
`;

const Select = styled.select`
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const TextArea = styled.textarea`
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const FileInputGroup = styled.div`
  padding: 20px;
  border: 2px dashed #3498db;
  border-radius: 8px;
  background: #ecf0f1;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    background: #d5dbdb;
    border-color: #2980b9;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileInputLabel = styled.label`
  cursor: pointer;
  color: #3498db;
  font-weight: bold;
  font-size: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  span {
    font-size: 40px;
  }

  &:hover {
    color: #2980b9;
  }
`;

const SelectedFile = styled.div`
  margin-top: 10px;
  padding: 10px;
  background: #2ecc71;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RemoveFileButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;

  &:hover {
    color: #e74c3c;
  }
`;

const ProjectSubprojectGroup = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
`;

const Button = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  ${props => props.primary && `
    background: #2ecc71;
    color: white;

    &:hover {
      background: #27ae60;
      transform: translateY(-2px);
    }

    &:disabled {
      background: #95a5a6;
      cursor: not-allowed;
      transform: none;
    }
  `}

  ${props => props.secondary && `
    background: #ecf0f1;
    color: #34495e;

    &:hover {
      background: #bdc3c7;
    }
  `}
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  font-size: 14px;
  margin-top: 5px;
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
    <Container onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContent>
        <Header>
          <Title>
            📋 Νέα Έγκριση Διάθεσης Πίστωσης
          </Title>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

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
                <span>📄</span>
                {selectedFile ? (
                  <SelectedFile>
                    {selectedFile.name}
                    <RemoveFileButton type="button" onClick={removeFile}>
                      ✕
                    </RemoveFileButton>
                  </SelectedFile>
                ) : (
                  'Κλικ για επιλογή αρχείου (PDF, Word)'
                )}
              </FileInputLabel>
            </FileInputGroup>
            {errors.file && <ErrorMessage>{errors.file}</ErrorMessage>}
          </FormGroup>

          <ButtonGroup>
            <Button secondary type="button" onClick={onClose}>
              Ακύρωση
            </Button>
            <Button primary type="submit" disabled={submitting}>
              {submitting ? 'Αποθήκευση...' : 'Αποθήκευση Έγκρισης'}
            </Button>
          </ButtonGroup>
        </Form>
      </FormContent>
    </Container>
  );
}

export default EgkrisiForm;
