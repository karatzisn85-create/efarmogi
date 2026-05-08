import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const WizardOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, #1a2a3a 0%, #2c3e50 50%, #34495e 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
`;

const WizardCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 48px;
  max-width: 620px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${fadeIn} 0.5s ease-out;
`;

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const AppName = styled.h1`
  color: #1a2a3a;
  font-size: 32px;
  font-weight: 900;
  margin: 0 0 4px 0;
  letter-spacing: 2px;
`;

const AppTagline = styled.p`
  color: #666;
  font-size: 14px;
  margin: 0 0 8px 0;
  font-style: italic;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
`;

const StepDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.active ? '#2c3e50' : props.done ? '#4caf50' : '#e0e0e0'};
  transition: all 0.3s;
`;

const StepTitle = styled.h2`
  color: #333;
  font-size: 18px;
  margin: 0 0 16px 0;
`;

const Input = styled.input`
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
  
  &:focus { border-color: #2c3e50; outline: none; }
  &::placeholder { color: #bbb; }
`;

const Select = styled.select`
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: white;
  cursor: pointer;
  box-sizing: border-box;
  
  &:focus { border-color: #2c3e50; outline: none; }
`;

const PathDisplay = styled.div`
  background: #f5f5f5;
  border: 2px solid ${props => props.selected ? '#4caf50' : '#e0e0e0'};
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  color: #333;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatusIcon = styled.span`
  font-size: 20px;
  flex-shrink: 0;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 28px;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const PrimaryButton = styled(Button)`
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
`;

const SecondaryButton = styled(Button)`
  background: #f5f5f5;
  color: #333;
`;

const InfoText = styled.p`
  color: #888;
  font-size: 13px;
  margin: 8px 0 0;
  line-height: 1.5;
`;

const FieldGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  color: #555;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
`;

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [orgType, setOrgType] = useState('Δήμος');
  const [orgName, setOrgName] = useState('');
  const [department, setDepartment] = useState('Τεχνική Υπηρεσία');
  const [detectedPath, setDetectedPath] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function detect() {
      const dir = await ipcRenderer.invoke('get-data-dir');
      setDetectedPath(dir || '');
    }
    detect();
  }, []);

  const handleBrowse = async () => {
    const selected = await ipcRenderer.invoke('select-data-folder');
    if (selected) {
      setCustomPath(selected);
      setUseCustom(true);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const finalPath = useCustom ? customPath : detectedPath;
    const fullOrgName = orgName.trim() ? `${orgType} ${orgName.trim()}`.trim() : orgType;
    
    await ipcRenderer.invoke('save-app-config', {
      dataDir: finalPath,
      organizationType: orgType,
      organizationName: orgName.trim(),
      organizationFullName: fullOrgName,
      department: department.trim(),
      setupCompleted: true
    });
    setSaving(false);
    onComplete();
  };

  const activePath = useCustom ? customPath : detectedPath;
  const canProceedStep1 = orgName.trim().length > 0;
  const canFinish = !!activePath;

  return (
    <WizardOverlay>
      <WizardCard>
        <LogoSection>
          <AppName>ERGOHUB</AppName>
          <AppTagline>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</AppTagline>
        </LogoSection>

        <StepIndicator>
          <StepDot active={step === 1} done={step > 1} />
          <StepDot active={step === 2} done={step > 2} />
        </StepIndicator>

        {step === 1 && (
          <>
            <StepTitle>Στοιχεία Οργανισμού</StepTitle>
            
            <FieldGroup>
              <Label>Τύπος Φορέα</Label>
              <Select value={orgType} onChange={e => setOrgType(e.target.value)}>
                <option value="Δήμος">Δήμος</option>
                <option value="Περιφέρεια">Περιφέρεια</option>
                <option value="Περιφερειακή Ενότητα">Περιφερειακή Ενότητα</option>
                <option value="Οργανισμός">Οργανισμός</option>
                <option value="ΔΕΥΑ">ΔΕΥΑ</option>
                <option value="">Άλλο (μόνο όνομα)</option>
              </Select>
            </FieldGroup>

            <FieldGroup>
              <Label>Ονομασία {orgType || 'Φορέα'}</Label>
              <Input 
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder={orgType === 'Δήμος' ? 'π.χ. Αρχανών Αστερουσίων' : 'π.χ. Κρήτης'}
                autoFocus
              />
            </FieldGroup>

            <FieldGroup>
              <Label>Τμήμα / Διεύθυνση</Label>
              <Input 
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="π.χ. Τεχνική Υπηρεσία"
              />
            </FieldGroup>

            <InfoText>
              Αυτά τα στοιχεία θα εμφανίζονται στις οθόνες και τις εξαγωγές της εφαρμογής.
            </InfoText>

            <ButtonRow>
              <PrimaryButton onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Επόμενο
              </PrimaryButton>
            </ButtonRow>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle>Φάκελος Δεδομένων</StepTitle>
            
            {detectedPath && !useCustom && (
              <PathDisplay selected={true}>
                <StatusIcon>✅</StatusIcon>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Εντοπίστηκε αυτόματα:</div>
                  {detectedPath}
                </div>
              </PathDisplay>
            )}

            {useCustom && customPath && (
              <PathDisplay selected={true}>
                <StatusIcon>📁</StatusIcon>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Επιλέχθηκε:</div>
                  {customPath}
                </div>
              </PathDisplay>
            )}

            <InfoText>
              Ο φάκελος δεδομένων περιέχει όλα τα έργα, εντάξεις, προσκλήσεις και εγκρίσεις.
              Αν χρησιμοποιείτε κοινόχρηστο δίσκο (π.χ. Z:\), επιλέξτε τον αντίστοιχο φάκελο.
            </InfoText>

            <ButtonRow>
              <SecondaryButton onClick={() => setStep(1)}>
                Πίσω
              </SecondaryButton>
              <SecondaryButton onClick={handleBrowse}>
                Αλλαγή φακέλου...
              </SecondaryButton>
              {useCustom && detectedPath && (
                <SecondaryButton onClick={() => setUseCustom(false)}>
                  Επαναφορά
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleFinish} disabled={!canFinish || saving}>
                {saving ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
              </PrimaryButton>
            </ButtonRow>
          </>
        )}
      </WizardCard>
    </WizardOverlay>
  );
};

export default SetupWizard;
