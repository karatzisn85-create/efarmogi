import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import SplashScreen from './components/SplashScreen';
import UpdateNotifier from './components/UpdateNotifier';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import WhatsNew from './components/WhatsNew';
import './App.css';
import { resetDocumentInteractionState, isInteractionLockAllowed } from './utils/documentInteractionReset';
import { getHolderCount } from './utils/bodyScrollLock';
import InteractionGuard from './components/InteractionGuard';
import ConfirmModal from './components/ConfirmModal';
import FileConflictModal from './components/FileConflictModal';
import SavePdfDialog from './components/SavePdfDialog';

const UserSelection = lazy(() => import('./components/UserSelection'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SetupWizard = lazy(() => import('./components/SetupWizard'));

const ipcRenderer = window.electronAPI;

const AppContainer = styled.div`
  min-height: 100vh;
  background: #0f172a;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const closeGuardFade = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const closeGuardScaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const CloseGuardOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: ${closeGuardFade} 0.2s ease forwards;
`;

const CloseGuardDialog = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem 2.25rem;
  max-width: 420px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: ${closeGuardScaleIn} 0.25s ease forwards;
`;

const CloseGuardIconWrap = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 1.25rem;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const CloseGuardTitle = styled.h2`
  margin: 0 0 0.5rem;
  font-size: 1.3rem;
  color: #1e293b;
  font-weight: 700;
  line-height: 1.25;
`;

const CloseGuardMessage = styled.p`
  margin: 0 0 1.5rem;
  color: #64748b;
  font-size: 0.95rem;
  line-height: 1.5;

  strong {
    color: #1e293b;
    font-weight: 700;
  }
`;

const CloseGuardActions = styled.div`
  display: flex;
  justify-content: center;
`;

const CloseGuardButton = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 12px 36px;
  border: 2px solid #2563eb;
  background: #2563eb;
  color: #fff;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid #93c5fd;
    outline-offset: 2px;
  }
`;

const LogoutDoorIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Εκκίνηση εφαρμογής...");
  const [appVersion, setAppVersion] = useState('');
  const [appConfig, setAppConfig] = useState({});

  // ── Debug tool — σάρωση τι μπλοκάρει clicks/keyboard ──
  useEffect(() => {
    window.__interactionDebug = () => {
      const b = document.body;
      const root = document.getElementById('root');
      const snapshot = {
        'body.overflow': b.style.overflow || '(unset)',
        'body.pointerEvents': b.style.pointerEvents || '(unset)',
        'body[data-modal-open]': b.hasAttribute('data-modal-open'),
        'body[inert]': b.hasAttribute('inert'),
        'root.overflow': root ? (root.style.overflow || '(unset)') : 'N/A',
        'root.pointerEvents': root ? (root.style.pointerEvents || '(unset)') : 'N/A',
        'html.overflow': document.documentElement.style.overflow || '(unset)',
        'bodyScrollLock holders': getHolderCount(),
        'interactionLockAllowed': isInteractionLockAllowed(),
      };
      console.table(snapshot);

      // Σάρωση: ψάξε position:fixed/absolute overlays πάνω στη σελίδα
      const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
        const cs = window.getComputedStyle(el);
        return (cs.position === 'fixed' || cs.position === 'absolute') &&
          cs.display !== 'none' && cs.visibility !== 'hidden' &&
          el.offsetWidth > 100 && el.offsetHeight > 100 &&
          parseInt(cs.zIndex, 10) > 100;
      });
      if (allFixed.length > 0) {
        console.warn('⚠️ Fixed/Absolute overlays βρέθηκαν:', allFixed.length);
        allFixed.forEach(el => {
          const cs = window.getComputedStyle(el);
          console.log({
            tag: el.tagName,
            className: el.className?.toString?.()?.substring?.(0, 80),
            zIndex: cs.zIndex,
            pointerEvents: cs.pointerEvents,
            size: `${el.offsetWidth}x${el.offsetHeight}`,
            innerHTML: el.innerHTML?.substring?.(0, 120),
          });
        });
      } else {
        console.log('✅ Κανένα visible fixed/absolute overlay');
      }

      return snapshot;
    };
    return () => { delete window.__interactionDebug; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [initError, setInitError] = useState(null);
  const [closeGuardModalOpen, setCloseGuardModalOpen] = useState(false);

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
        if (!cancelled.value) {
          setInitError('Η εφαρμογή δεν μπόρεσε να φορτώσει. Ελέγξτε ότι ο φάκελος δεδομένων είναι προσβάσιμος.');
          setIsAppLoading(false);
        }
      }
    }

    initApp();
    return () => { cancelled.value = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncCurrentUserFromDisk = useCallback(async () => {
    if (!currentUser?.username || !ipcRenderer?.invoke) return;
    try {
      const users = await ipcRenderer.invoke('get-users');
      const me = Array.isArray(users)
        ? users.find((u) => u.username?.toLowerCase() === currentUser.username.toLowerCase())
        : null;
      if (me) {
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const nextRole = me.role || prev.role;
          const nextName = me.fullName || prev.fullName;
          const sameRole = nextRole === prev.role;
          const sameName = nextName === prev.fullName;
          const sameTA =
            JSON.stringify(prev.taskAssignment || null) === JSON.stringify(me.taskAssignment || null);
          const sameOrimanthi = !!prev.orimanthiCanEdit === !!me.orimanthiCanEdit;
          const sameMeletai = !!prev.meletaiCanEdit === !!me.meletaiCanEdit;
          if (sameRole && sameName && sameTA && sameOrimanthi && sameMeletai) return prev;
          return {
            ...prev,
            taskAssignment: me.taskAssignment,
            role: nextRole,
            fullName: nextName,
            orimanthiCanEdit: !!me.orimanthiCanEdit,
            meletaiCanEdit: !!me.meletaiCanEdit,
          };
        });
      }
    } catch {
      /* ignore */
    }
  }, [currentUser?.username]);

  useEffect(() => {
    if (!ipcRenderer?.invoke) return;
    ipcRenderer
      .invoke('set-dashboard-session-active', currentUser ? { active: true, username: currentUser.username } : { active: false })
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (!ipcRenderer?.on) return undefined;
    const unsub = ipcRenderer.on('app-close-blocked', () => {
      setCloseGuardModalOpen(true);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleSetupComplete = async () => {
    try {
      setNeedsSetup(false);
      setIsAppLoading(true);
      setLoadingProgress(50);
      setLoadingStatus("Φόρτωση ρυθμίσεων...");
      await loadAppData();
      setLoadingProgress(100);
      setLoadingStatus("Εφαρμογή έτοιμη!");
      setIsAppLoading(false);
    } catch (err) {
      console.error('Setup complete error:', err);
      setInitError('Η εφαρμογή δεν μπόρεσε να φορτώσει μετά τη ρύθμιση. Δοκιμάστε ξανά.');
      setIsAppLoading(false);
    }
  };

  if (initError) {
    return (
      <AppContainer style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', maxWidth: '500px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>Σφάλμα Εκκίνησης</h2>
          <p style={{ color: '#555', marginBottom: '1.5rem', lineHeight: '1.6' }}>{initError}</p>
          <button
            onClick={() => { setInitError(null); setIsAppLoading(true); setNeedsSetup(false); window.location.reload(); }}
            style={{ background: '#667eea', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}
          >
            Δοκιμάστε Ξανά
          </button>
        </div>
      </AppContainer>
    );
  }

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
          loadingText="Ενεργοποίηση της πλατφόρμας"
          organizationName={appConfig.organizationFullName}
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
                        <Dashboard
                        currentUser={currentUser}
                        appVersion={appVersion}
                        appConfig={appConfig}
                        onSyncCurrentUser={syncCurrentUserFromDisk}
                        onLogout={() => {
                          resetDocumentInteractionState();
                          setCurrentUser(null);
                          queueMicrotask(() => resetDocumentInteractionState());
                          requestAnimationFrame(() => {
                            resetDocumentInteractionState();
                            requestAnimationFrame(() => resetDocumentInteractionState());
                          });
                        }}
                      />
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
        {closeGuardModalOpen && (
          <CloseGuardOverlay
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-guard-title"
            onClick={() => setCloseGuardModalOpen(false)}
          >
            <CloseGuardDialog onClick={(e) => e.stopPropagation()}>
              <CloseGuardIconWrap>
                <LogoutDoorIcon />
              </CloseGuardIconWrap>
              <CloseGuardTitle id="close-guard-title">Είστε ακόμα συνδεδεμένοι!</CloseGuardTitle>
              <CloseGuardMessage>
                Παρακαλώ κάντε πρώτα <strong>Αποσύνδεση</strong> από την εφαρμογή πριν την κλείσετε.
                <br />
                <br />
                Αυτό διασφαλίζει ότι όλα τα δεδομένα σας αποθηκεύονται σωστά.
              </CloseGuardMessage>
              <CloseGuardActions>
                <CloseGuardButton type="button" onClick={() => setCloseGuardModalOpen(false)}>
                  Κατάλαβα — Επιστροφή
                </CloseGuardButton>
              </CloseGuardActions>
            </CloseGuardDialog>
          </CloseGuardOverlay>
        )}
      </AppContainer>
      <InteractionGuard />
      <ConfirmModal />
      <FileConflictModal />
      <SavePdfDialog />
    </ToastProvider>
  );
}

export default App;
