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

const TOTAL_STEPS = 3;

const ExistingDataBanner = styled.div`
  background: #e8f5e9;
  border: 2px solid #4caf50;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const BannerIcon = styled.span`
  font-size: 24px;
  flex-shrink: 0;
`;

const BannerText = styled.div`
  font-size: 14px;
  color: #2e7d32;
  line-height: 1.5;
  
  strong { display: block; margin-bottom: 4px; }
`;

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [orgType, setOrgType] = useState('Δήμος');
  const [orgName, setOrgName] = useState('');
  const [department, setDepartment] = useState('Τεχνική Υπηρεσία');
  const [detectedPath, setDetectedPath] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [folderInfo, setFolderInfo] = useState({ hasUsers: false, hasProjects: false, projectCount: 0 });
  const [skipSuperadmin, setSkipSuperadmin] = useState(false);

  useEffect(() => {
    async function detect() {
      const dir = await ipcRenderer.invoke('get-data-dir');
      setDetectedPath(dir || '');
      if (dir) {
        const info = await ipcRenderer.invoke('check-folder-has-config', dir);
        setFolderInfo(info);
        setSkipSuperadmin(info.hasUsers);
      }
    }
    detect();
  }, []);

  const handleBrowse = async () => {
    const selected = await ipcRenderer.invoke('select-data-folder');
    if (selected) {
      setCustomPath(selected);
      setUseCustom(true);
      const info = await ipcRenderer.invoke('check-folder-has-config', selected);
      setFolderInfo(info);
      setSkipSuperadmin(info.hasUsers);
    }
  };

  const activePath = useCustom ? customPath : detectedPath;

  const totalSteps = skipSuperadmin ? TOTAL_STEPS - 1 : TOTAL_STEPS;

  const handleAfterFolder = () => {
    setStep(2);
  };

  const handleAfterOrg = () => {
    if (skipSuperadmin) {
      handleFinish();
    } else {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const finalPath = activePath;
    const fullOrgName = orgName.trim() ? `${orgType} ${orgName.trim()}`.trim() : orgType;
    
    await ipcRenderer.invoke('save-app-config', {
      dataDir: finalPath,
      organizationType: orgType,
      organizationName: orgName.trim(),
      organizationFullName: fullOrgName,
      department: department.trim(),
      setupCompleted: true
    });

    if (!skipSuperadmin) {
      await ipcRenderer.invoke('create-user', {
        username: adminUser.trim(),
        password: adminPass,
        role: 'SUPERADMIN',
        fullName: adminFullName.trim() || adminUser.trim()
      });
    }

    setSaving(false);
    onComplete();
  };

  const canProceedStep1 = !!activePath;
  const canProceedStep2 = orgName.trim().length > 0;
  const passwordsMatch = adminPass === adminPassConfirm;
  const canFinish = adminUser.trim().length > 0 && adminPass.length >= 4 && passwordsMatch;

  return (
    <WizardOverlay role="dialog" aria-label="Οδηγός αρχικής ρύθμισης">
      <WizardCard role="form">
        <LogoSection>
          <AppName>ERGOHUB</AppName>
          <AppTagline>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</AppTagline>
        </LogoSection>

        <StepIndicator>
          {Array.from({ length: totalSteps }, (_, i) => (
            <StepDot key={i} active={step === i + 1} done={step > i + 1} />
          ))}
        </StepIndicator>

        {step === 1 && (
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

            {!detectedPath && !customPath && (
              <PathDisplay selected={false}>
                <StatusIcon>⚠️</StatusIcon>
                <div>
                  Δεν εντοπίστηκε φάκελος δεδομένων. 
                  Επιλέξτε χειροκίνητα τον φάκελο.
                </div>
              </PathDisplay>
            )}

            {folderInfo.hasUsers && (
              <ExistingDataBanner>
                <BannerIcon>✅</BannerIcon>
                <BannerText>
                  <strong>Βρέθηκαν υπάρχουσες ρυθμίσεις!</strong>
                  Ο φάκελος περιέχει λογαριασμούς χρηστών
                  {folderInfo.hasProjects && ` και ${folderInfo.projectCount} έργ${folderInfo.projectCount === 1 ? 'ο' : 'α'}`}.
                  Η δημιουργία superadmin θα παραληφθεί.
                </BannerText>
              </ExistingDataBanner>
            )}

            {activePath && !folderInfo.hasUsers && (
              <ExistingDataBanner style={{ background: '#fff3e0', borderColor: '#ff9800' }}>
                <BannerIcon>📂</BannerIcon>
                <BannerText style={{ color: '#e65100' }}>
                  <strong>Νέος φάκελος χωρίς ρυθμίσεις</strong>
                  Θα χρειαστεί να δημιουργήσετε λογαριασμό Υπερδιαχειριστή.
                </BannerText>
              </ExistingDataBanner>
            )}

            <InfoText>
              Ο φάκελος δεδομένων περιέχει όλα τα έργα, εντάξεις, προσκλήσεις και εγκρίσεις.
              Αν χρησιμοποιείτε κοινόχρηστο δίσκο (π.χ. Z:\), επιλέξτε τον αντίστοιχο φάκελο.
            </InfoText>

            <ButtonRow>
              <SecondaryButton onClick={handleBrowse}>
                {activePath ? 'Αλλαγή φακέλου...' : 'Επιλογή φακέλου...'}
              </SecondaryButton>
              {useCustom && detectedPath && (
                <SecondaryButton onClick={async () => {
                  setUseCustom(false);
                  const info = await ipcRenderer.invoke('check-folder-has-config', detectedPath);
                  setFolderInfo(info);
                  setSkipSuperadmin(info.hasUsers);
                }}>
                  Επαναφορά
                </SecondaryButton>
              )}
              <PrimaryButton onClick={handleAfterFolder} disabled={!canProceedStep1}>
                Επόμενο
              </PrimaryButton>
            </ButtonRow>
          </>
        )}

        {step === 2 && (
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
              <SecondaryButton onClick={() => setStep(1)}>
                Πίσω
              </SecondaryButton>
              <PrimaryButton 
                onClick={handleAfterOrg} 
                disabled={!canProceedStep2 || (skipSuperadmin && saving)}
              >
                {skipSuperadmin ? (saving ? 'Αποθήκευση...' : 'Ολοκλήρωση') : 'Επόμενο'}
              </PrimaryButton>
            </ButtonRow>
          </>
        )}

        {step === 3 && !skipSuperadmin && (
          <>
            <StepTitle>Λογαριασμός Υπερδιαχειριστή</StepTitle>
            
            <FieldGroup>
              <Label>Όνομα χρήστη (username)</Label>
              <Input 
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                placeholder="π.χ. admin"
              />
            </FieldGroup>

            <FieldGroup>
              <Label>Ονοματεπώνυμο</Label>
              <Input 
                value={adminFullName}
                onChange={e => setAdminFullName(e.target.value)}
                placeholder="π.χ. Νίκος Καρατζής"
              />
            </FieldGroup>

            <FieldGroup>
              <Label>Κωδικός πρόσβασης (τουλάχιστον 4 χαρακτήρες)</Label>
              <Input 
                type="password"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                placeholder="Εισάγετε κωδικό"
              />
            </FieldGroup>

            <FieldGroup>
              <Label>Επιβεβαίωση κωδικού</Label>
              <Input 
                type="password"
                value={adminPassConfirm}
                onChange={e => setAdminPassConfirm(e.target.value)}
                placeholder="Επαναλάβετε τον κωδικό"
                style={adminPassConfirm && !passwordsMatch ? { borderColor: '#e53935' } : {}}
              />
              {adminPassConfirm && !passwordsMatch && (
                <InfoText style={{ color: '#e53935' }}>Οι κωδικοί δεν ταιριάζουν</InfoText>
              )}
            </FieldGroup>

            <InfoText>
              Αυτός ο λογαριασμός θα έχει πλήρη πρόσβαση στην εφαρμογή 
              και θα μπορεί να δημιουργεί νέους χρήστες.
            </InfoText>

            <ButtonRow>
              <SecondaryButton onClick={() => setStep(2)}>
                Πίσω
              </SecondaryButton>
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
