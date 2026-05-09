import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import SplashScreen from './components/SplashScreen';
import UpdateNotifier from './components/UpdateNotifier';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import WhatsNew from './components/WhatsNew';
import './App.css';

const UserSelection = lazy(() => import('./components/UserSelection'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SetupWizard = lazy(() => import('./components/SetupWizard'));

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

    const dataDirExists = await ipcRenderer.invoke('check-data-dir-exists');
    if (!config.setupCompleted || !dataDirExists) {
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
    return (
      <ErrorBoundary>
        <Suspense fallback={<div />}>
          <SetupWizard onComplete={handleSetupComplete} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ToastProvider>
      <AppContainer>
        <UpdateNotifier />
      <WhatsNew />
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
                    <ErrorBoundary>
                      <Suspense fallback={<div />}>
                        <Dashboard currentUser={currentUser} appVersion={appVersion} appConfig={appConfig} onLogout={() => setCurrentUser(null)} />
                      </Suspense>
                    </ErrorBoundary> :
                    <ErrorBoundary>
                      <Suspense fallback={<div />}>
                        <UserSelection onUserSelect={setCurrentUser} appConfig={{...appConfig, appVersion}} />
                      </Suspense>
                    </ErrorBoundary>
                } 
              />
            </Routes>
          </Router>
        )}
      </AppContainer>
    </ToastProvider>
  );
}

export default App;
