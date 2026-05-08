import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import UserSelection from './components/UserSelection';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Εκκίνηση εφαρμογής...");
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initApp() {
      try {
        setLoadingProgress(30);
        setLoadingStatus("Φόρτωση έκδοσης...");
        const version = await ipcRenderer.invoke('getAppVersion');
        if (cancelled) return;
        setAppVersion(version || '1.0.0');

        setLoadingProgress(70);
        setLoadingStatus("Ετοιμασία περιβάλλοντος...");

        setLoadingProgress(100);
        setLoadingStatus("Εφαρμογή έτοιμη!");
        setIsAppLoading(false);
      } catch (err) {
        console.error('Init error:', err);
        if (!cancelled) {
          setIsAppLoading(false);
        }
      }
    }

    initApp();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppContainer>
      <SplashScreen 
        isLoading={isAppLoading}
        progress={loadingProgress}
        statusText={loadingStatus}
        loadingText="ΕΦΑΡΜΟΓΗ ΔΙΑΧΕΙΡΙΣΗΣ ΕΡΓΩΝ"
      />
      {!isAppLoading && (
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={
                currentUser ? 
                  <Dashboard userRole={currentUser} appVersion={appVersion} onLogout={() => setCurrentUser(null)} /> :
                  <UserSelection onUserSelect={setCurrentUser} />
              } 
            />
          </Routes>
        </Router>
      )}
    </AppContainer>
  );
}

export default App;
