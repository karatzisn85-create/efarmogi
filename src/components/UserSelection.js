import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

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
  width: 380px;
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

const LoginButton = styled.button`
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

const ErrorBox = styled.div`
  background: #ffeaea;
  color: #c62828;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-top: 12px;
  border: 1px solid #ffcdd2;
`;

const VersionText = styled.div`
  color: rgba(255,255,255,0.3);
  font-size: 11px;
  margin-top: 24px;
  z-index: 1;
`;

function UserSelection({ onUserSelect, appConfig = {} }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Συμπληρώστε όνομα χρήστη και κωδικό');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await ipcRenderer.invoke('authenticate', {
        username: username.trim(),
        password
      });

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <Container>
      <HeaderSection>
        <AppBrand>ERGOHUB</AppBrand>
        <AppTagline>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</AppTagline>
        {appConfig.organizationFullName && (
          <OrgName>{appConfig.organizationFullName}</OrgName>
        )}
        {appConfig.department && (
          <DeptName>{appConfig.department}</DeptName>
        )}
      </HeaderSection>

      <Card>
        <CardTitle>Σύνδεση</CardTitle>

        <FormGroup>
          <Label>Όνομα χρήστη</Label>
          <Input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="π.χ. admin"
            autoFocus
          />
        </FormGroup>

        <FormGroup>
          <Label>Κωδικός</Label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Εισάγετε κωδικό"
          />
        </FormGroup>

        <LoginButton onClick={handleLogin} disabled={loading}>
          {loading ? 'Σύνδεση...' : 'Είσοδος'}
        </LoginButton>

        {error && <ErrorBox>{error}</ErrorBox>}
      </Card>

      <VersionText>ERGOHUB v{appConfig.appVersion || '1.0.0'}</VersionText>
    </Container>
  );
}

export default UserSelection;
