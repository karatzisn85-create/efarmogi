import React from 'react';
import styled, { keyframes } from 'styled-components';
import ergohubLogo from '../assets/ergohub-logo.svg';

// Animation για το spinner
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

// Styled Components
const SplashContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: ${fadeIn} 0.5s ease-in;
`;

const LogoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
`;

const AppIcon = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 25px;
  margin-bottom: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  animation: ${pulse} 2s ease-in-out infinite;
  object-fit: cover;
`;

const AppTitle = styled.h1`
  color: white;
  font-size: 32px;
  font-weight: 300;
  margin: 0;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const AppSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  margin: 10px 0 0 0;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin-bottom: 20px;
`;

const LoadingText = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  margin: 0;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ProgressBar = styled.div`
  width: 300px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin-top: 20px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
  border-radius: 2px;
  width: ${props => props.progress || 0}%;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
`;

const StatusText = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 15px 0 0 0;
  text-align: center;
  min-height: 20px;
`;

const SplashScreen = ({ 
  isLoading = true, 
  progress = 0, 
  statusText = "Φόρτωση εφαρμογής...",
  loadingText = "Παρακαλώ περιμένετε..."
}) => {
  if (!isLoading) return null;

  return (
    <SplashContainer>
      <LogoContainer>
        <AppIcon src={ergohubLogo} alt="ERGOHUB" />
        <AppTitle>ERGOHUB</AppTitle>
        <AppSubtitle>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</AppSubtitle>
      </LogoContainer>
      
      <LoadingContainer>
        <Spinner />
        <LoadingText>{loadingText}</LoadingText>
        <ProgressBar>
          <ProgressFill progress={progress} />
        </ProgressBar>
        <StatusText>{statusText}</StatusText>
      </LoadingContainer>
    </SplashContainer>
  );
};

export default SplashScreen;
