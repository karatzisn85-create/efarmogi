import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import UserSelection from './components/UserSelection';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import SetupWizard from './components/SetupWizard';
import './App.css';

const ipcRenderer = window.electronAPI;

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Εκκίνηση εφαρμογής...");
  const [appVersion, setAppVersion] = useState('');
  const [appConfig, setAppConfig] = useState({});

  const loadAppData = async (cancelled = { value: false }) => {
    const config = await ipcRenderer.invoke('get-app-config');
    if (cancelled.value) return false;
    setAppConfig(config);

    if (!config.setupCompleted) {
      setNeedsSetup(true);
      setIsAppLoading(false);
      return false;
    }

    const version = await ipcRenderer.invoke('getAppVersion');
    if (cancelled.value) return false;
    setAppVersion(version || '1.0.0');
    return true;
  };

  useEffect(() => {
    const cancelled = { value: false };

    async function initApp() {
      try {
        setLoadingProgress(20);
        setLoadingStatus("Έλεγχος ρυθμίσεων...");
        const ok = await loadAppData(cancelled);
        if (!ok || cancelled.value) return;

        setLoadingProgress(100);
        setLoadingStatus("Εφαρμογή έτοιμη!");
        setIsAppLoading(false);
      } catch (err) {
        console.error('Init error:', err);
        if (!cancelled.value) setIsAppLoading(false);
      }
    }

    initApp();
    return () => { cancelled.value = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetupComplete = async () => {
    setNeedsSetup(false);
    setIsAppLoading(true);
    setLoadingProgress(50);
    setLoadingStatus("Φόρτωση ρυθμίσεων...");
    await loadAppData();
    setLoadingProgress(100);
    setLoadingStatus("Εφαρμογή έτοιμη!");
    setIsAppLoading(false);
  };

  if (needsSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <AppContainer>
      <SplashScreen 
        isLoading={isAppLoading}
        progress={loadingProgress}
        statusText={loadingStatus}
        loadingText="ERGOHUB"
      />
      {!isAppLoading && (
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={
                currentUser ? 
                  <Dashboard userRole={currentUser} appVersion={appVersion} appConfig={appConfig} onLogout={() => setCurrentUser(null)} /> :
                  <UserSelection onUserSelect={setCurrentUser} appConfig={appConfig} />
              } 
            />
          </Routes>
        </Router>
      )}
    </AppContainer>
  );
}

export default App;
