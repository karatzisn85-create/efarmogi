import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: drift 20s linear infinite;
    opacity: 0.3;
  }
  
  @keyframes drift {
    0% { transform: translate(0, 0); }
    100% { transform: translate(50px, 50px); }
  }
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 3rem;
  z-index: 1;
  animation: fadeInDown 0.8s ease-out;
  
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const MainTitle = styled.h1`
  font-size: 3.5rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
  background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 4px;
    background: linear-gradient(90deg, transparent, #ffd700, transparent);
    border-radius: 2px;
  }
`;

const SubTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: #e3f2fd;
  margin: 1rem 0 0.5rem 0;
  text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: 1px;
`;

const SubSubTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 400;
  color: #bbdefb;
  margin: 0.5rem 0 0 0;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;
  font-style: italic;
`;

const Card = styled.div`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3.5rem;
  box-shadow: 0 20px 60px rgba(26, 35, 126, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  text-align: center;
  min-width: 420px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  animation: fadeIn 0.8s ease-out;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(26, 35, 126, 0.05) 1px, transparent 1px);
    background-size: 30px 30px;
    animation: drift 15s linear infinite;
    opacity: 0.5;
    z-index: 0;
  }
  
  & > * {
    position: relative;
    z-index: 1;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  @keyframes drift {
    0% { transform: translate(0, 0); }
    100% { transform: translate(30px, 30px); }
  }
`;

const Title = styled.h1`
  color: #1a237e;
  margin-bottom: 2.5rem;
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: 2px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  text-transform: uppercase;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  padding-bottom: 1rem;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 3px;
    background: linear-gradient(90deg, transparent, #ffd700, transparent);
    border-radius: 2px;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const UserButton = styled.button`
  background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
  padding: 1.2rem 2.5rem;
  border-radius: 14px;
  font-size: 1.15rem;
  font-weight: 700;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 6px 20px rgba(26, 35, 126, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(26, 35, 126, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    background: linear-gradient(135deg, #283593 0%, #3949ab 100%);
    
    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(26, 35, 126, 0.4);
  }
`;

const AdminButton = styled.button`
  background: linear-gradient(135deg, #3949ab 0%, #5c6bc0 100%);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.2);
  padding: 1.2rem 2.5rem;
  border-radius: 14px;
  font-size: 1.15rem;
  font-weight: 700;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 6px 20px rgba(57, 73, 171, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(57, 73, 171, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
    
    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(57, 73, 171, 0.4);
  }
`;

const PasswordContainer = styled.div`
  margin-top: 1rem;
  display: ${props => props.show ? 'block' : 'none'};
  animation: ${props => props.show ? 'fadeIn 0.3s ease-out' : 'none'};
`;

const PasswordInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 1rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #2196F3;
  }
`;

const LoginButton = styled.button`
  background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 0.5rem;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
  }
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  margin-top: 0.5rem;
  font-size: 0.9rem;
`;

function UserSelection({ onUserSelect, appConfig = {} }) {
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleUserClick = () => {
    onUserSelect('USER');
  };

  const handleAdminClick = () => {
    setShowPasswordInput(true);
    setError('');
  };

  const handlePasswordSubmit = () => {
    if (password === '123') {
      onUserSelect('ADMIN');
    } else {
      setError('Λάθος κωδικός πρόσβασης');
      setPassword('');
    }
  };

  const handleCancel = () => {
    setShowPasswordInput(false);
    setPassword('');
    setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePasswordSubmit();
    }
  };

  return (
    <Container>
      <HeaderSection>
        <MainTitle>{appConfig.organizationFullName || 'ΟΡΓΑΝΙΣΜΟΣ'}</MainTitle>
        <SubTitle>{appConfig.department || 'ΤΕΧΝΙΚΗ ΥΠΗΡΕΣΙΑ'}</SubTitle>
        <SubSubTitle>ERGOHUB - Διαχείριση Έργων & Προμηθειών</SubSubTitle>
      </HeaderSection>
      <Card>
        <Title>Επιλογή Ρόλου Χρήστη</Title>
        
        <ButtonContainer>
          <UserButton onClick={handleUserClick}>
            ΧΡΗΣΤΗΣ
          </UserButton>
          
          <AdminButton onClick={handleAdminClick}>
            ΔΙΑΧΕΙΡΙΣΤΗΣ
          </AdminButton>
        </ButtonContainer>

        <PasswordContainer show={showPasswordInput}>
          <PasswordInput
            type="password"
            placeholder="Εισάγετε κωδικό διαχειριστή"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
          />
          <div>
            <LoginButton onClick={handlePasswordSubmit}>
              Είσοδος
            </LoginButton>
            <CancelButton onClick={handleCancel}>
              Ακύρωση
            </CancelButton>
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </PasswordContainer>
      </Card>
    </Container>
  );
}

export default UserSelection;
