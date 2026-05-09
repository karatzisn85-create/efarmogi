import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import ergohubLogo from '../assets/ergohub-logo.png';

const ipcRenderer = window.electronAPI;

const drift = keyframes`
  0% { transform: translate(0, 0); }
  100% { transform: translate(50px, 50px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const fadeInDown = keyframes`
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a2a3a 0%, #2c3e50 50%, #34495e 100%);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: ${drift} 20s linear infinite;
    opacity: 0.3;
  }
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
  z-index: 1;
  animation: ${fadeInDown} 0.8s ease-out;
`;

const LogoImg = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  margin-bottom: 12px;
`;

const AppBrand = styled.h1`
  font-size: 2.8rem;
  font-weight: 900;
  color: #fff;
  margin: 0 0 4px 0;
  letter-spacing: 3px;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
`;

const AppTagline = styled.p`
  font-size: 1rem;
  color: rgba(255,255,255,0.6);
  margin: 0 0 16px 0;
  font-style: italic;
`;

const OrgName = styled.h2`
  font-size: 1.8rem;
  font-weight: 600;
  color: #e3f2fd;
  margin: 0 0 4px 0;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.2);
`;

const DeptName = styled.h3`
  font-size: 1.2rem;
  font-weight: 400;
  color: #bbdefb;
  margin: 0;
  font-style: italic;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  text-align: center;
  width: 420px;
  animation: ${fadeIn} 0.8s ease-out;
  position: relative;
  z-index: 1;
`;

const CardTitle = styled.h2`
  color: #1a2a3a;
  margin: 0 0 2rem 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 1px;
`;

const FormGroup = styled.div`
  margin-bottom: 1.2rem;
  text-align: left;
`;

const Label = styled.label`
  display: block;
  color: #555;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 4px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus { border-color: #2c3e50; outline: none; }
  &::placeholder { color: #bbb; }
`;

const PrimaryButton = styled.button`
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;

  &:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
  &:active { transform: translateY(0); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const ToggleLink = styled.button`
  display: block;
  margin: 18px auto 0;
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 0.88rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  &:hover { color: #1d4ed8; text-decoration: underline; }
`;

const ErrorBox = styled.div`
  background: #ffeaea;
  color: #c62828;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 12px;
  border- 1px solid #ffcdd2;
  text-align: left;
`;

const SuccessBox = styled.div`
  background: #e8f5e9;
  color: #2e7d32;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 12px;
  border: 1px solid #c8e6c9;
  text-align: left;
  line-height: 1.5;
`;

const NoticeBox = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 0.82rem;
  color: #92400e;
  text-align: left;
  line-height: 1.4;
`;

const RoleSelector = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
`;

const RoleOption = styled.label`
  flex: 1;
  display: block;
  padding: 14px 12px;
  border: 2px solid ${p => p.selected ? '#2c3e50' : '#e0e0e0'};
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.selected ? '#eef2f7' : '#f8f9fa'};
  ${p => p.selected && 'box-shadow: 0 0 0 3px rgba(44,62,80,0.1);'}

  &:hover { border-color: #93a5b8; background: #eef2f7; }
`;

const RoleTitle = styled.span`
  display: block;
  font-weight: 700;
  font-size: 0.92rem;
  color: #1a2a3a;
  margin-bottom: 2px;
`;

const RoleDesc = styled.span`
  display: block;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 400;
`;

const VersionText = styled.div`
  color: rgba(255,255,255,0.3);
  font-size: 11px;
  margin-top: 24px;
  z-index: 1;
`;

function UserSelection({ onUserSelect, appConfig = {} }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState('USER');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Συμπληρώστε όνομα χρήστη και κωδικό');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await ipcRenderer.invoke('authenticate', { username: username.trim(), password });
      if (result.success) {
        onUserSelect(result.user);
      } else {
        setError(result.error || 'Αποτυχία σύνδεσης');
        setPassword('');
      }
    } catch (err) {
      setError('Σφάλμα επικοινωνίας');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setRegError('');
    setRegSuccess('');
    if (!regUsername.trim()) { setRegError('Εισάγετε όνομα χρήστη'); return; }
    if (!regFullName.trim()) { setRegError('Εισάγετε ονοματεπώνυμο'); return; }
    if (!regPassword || regPassword.length < 4) { setRegError('Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες'); return; }
    if (regPassword !== regConfirm) { setRegError('Οι κωδικοί δεν ταιριάζουν'); return; }

    setRegLoading(true);
    try {
      const result = await ipcRenderer.invoke('register-user', {
        username: regUsername.trim(),
        password: regPassword,
        role: regRole,
        fullName: regFullName.trim()
      });
      if (result.success) {
        setRegSuccess('Ο λογαριασμός δημιουργήθηκε! Αναμένει έγκριση από τον Υπερδιαχειριστή πριν μπορέσετε να συνδεθείτε.');
        setRegUsername('');
        setRegFullName('');
        setRegPassword('');
        setRegConfirm('');
      } else {
        setRegError(result.error);
      }
    } catch (err) {
      setRegError('Σφάλμα επικοινωνίας');
    }
    setRegLoading(false);
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action();
  };

  return (
    <Container>
      <HeaderSection>
        <LogoImg src={ergohubLogo} alt="ERGOHUB" />
        <AppBrand>ERGOHUB</AppBrand>
        <AppTagline>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</AppTagline>
        {appConfig.organizationFullName && <OrgName>{appConfig.organizationFullName}</OrgName>}
        {appConfig.department && <DeptName>{appConfig.department}</DeptName>}
      </HeaderSection>

      <Card>
        {mode === 'login' ? (
          <>
            <CardTitle>Σύνδεση</CardTitle>
            {error && <ErrorBox>{error}</ErrorBox>}

            <FormGroup>
              <Label>Όνομα χρήστη</Label>
              <Input type="text" value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => handleKeyDown(e, handleLogin)} placeholder="Εισάγετε το όνομα χρήστη" autoFocus
                aria-label="Όνομα χρήστη" />
            </FormGroup>

            <FormGroup>
              <Label>Κωδικός</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => handleKeyDown(e, handleLogin)} placeholder="Εισάγετε τον κωδικό"
                aria-label="Κωδικός πρόσβασης" />
            </FormGroup>

            <PrimaryButton onClick={handleLogin} disabled={loading}>
              {loading ? 'Σύνδεση...' : 'Είσοδος'}
            </PrimaryButton>

            <ToggleLink onClick={() => { setMode('register'); setError(''); }}>
              Δημιουργία νέου λογαριασμού
            </ToggleLink>
          </>
        ) : (
          <>
            <CardTitle>Νέος Λογαριασμός</CardTitle>
            {regSuccess && <SuccessBox>{regSuccess}</SuccessBox>}
            {regError && <ErrorBox>{regError}</ErrorBox>}

            <FormGroup>
              <Label>Όνομα χρήστη</Label>
              <Input type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)}
                placeholder="π.χ. giannis_k" />
            </FormGroup>

            <FormGroup>
              <Label>Ονοματεπώνυμο</Label>
              <Input type="text" value={regFullName} onChange={e => setRegFullName(e.target.value)}
                placeholder="π.χ. Γιάννης Παπαδόπουλος" />
            </FormGroup>

            <FormGroup>
              <Label>Κωδικός</Label>
              <Input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                placeholder="Τουλάχιστον 4 χαρακτήρες" />
            </FormGroup>

            <FormGroup>
              <Label>Επιβεβαίωση κωδικού</Label>
              <Input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                onKeyDown={e => handleKeyDown(e, handleRegister)} placeholder="Πληκτρολογήστε ξανά τον κωδικό" />
            </FormGroup>

            <Label style={{ marginBottom: 8 }}>Ρόλος</Label>
            <RoleSelector>
              <RoleOption selected={regRole === 'USER'} onClick={() => setRegRole('USER')}>
                <RoleTitle>Χρήστης</RoleTitle>
                <RoleDesc>Μόνο προβολή</RoleDesc>
              </RoleOption>
              <RoleOption selected={regRole === 'ADMIN'} onClick={() => setRegRole('ADMIN')}>
                <RoleTitle>Διαχειριστής</RoleTitle>
                <RoleDesc>Πλήρης διαχείριση</RoleDesc>
              </RoleOption>
            </RoleSelector>

            <NoticeBox>
              Κάθε νέος λογαριασμός απαιτεί έγκριση από τον Υπερδιαχειριστή πριν μπορέσετε να συνδεθείτε.
            </NoticeBox>

            <PrimaryButton onClick={handleRegister} disabled={regLoading}>
              {regLoading ? 'Δημιουργία...' : 'Δημιουργία Λογαριασμού'}
            </PrimaryButton>

            <ToggleLink onClick={() => { setMode('login'); setRegError(''); setRegSuccess(''); }}>
              Έχω ήδη λογαριασμό — Σύνδεση
            </ToggleLink>
          </>
        )}
      </Card>

      <VersionText>ERGOHUB v{appConfig.appVersion || '1.0.0'}</VersionText>
    </Container>
  );
}

export default UserSelection;
