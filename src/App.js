import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import UserSelection from './components/UserSelection';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import './App.css';

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

  useEffect(() => {
    // Προσομοίωση φόρτωσης εφαρμογής
    const loadingSteps = [
      { progress: 20, status: "Φόρτωση συστήματος..." },
      { progress: 40, status: "Επικοινωνία με βάση δεδομένων..." },
      { progress: 60, status: "Φόρτωση προφίλ χρήστη..." },
      { progress: 80, status: "Ετοιμασία περιβάλλοντος..." },
      { progress: 100, status: "Εφαρμογή έτοιμη!" }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length) {
        setLoadingProgress(loadingSteps[currentStep].progress);
        setLoadingStatus(loadingSteps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsAppLoading(false);
        }, 500);
      }
    }, 600); // 600ms ανά βήμα = ~3 δευτερόλεπτα συνολικά

    return () => clearInterval(interval);
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
                  <Dashboard userRole={currentUser} onLogout={() => setCurrentUser(null)} /> :
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
