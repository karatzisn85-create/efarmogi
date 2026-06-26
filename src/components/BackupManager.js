import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';
import { formatDateTimeEl } from '../utils/dateFormat';

const ipcRenderer = window.electronAPI;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 20px;
  width: 90vw;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const ActionButtons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ActionButton = styled.button`
  background: ${props => props.primary 
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: white;
  border: none;
  padding: 2rem;
  border-radius: 15px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ActionIcon = styled.div`
  font-size: 2.5rem;
`;

const ActionLabel = styled.div`
  font-size: 1rem;
`;

// Backup History Section
const HistorySection = styled.div`
  display: ${props => props.show ? 'block' : 'none'};
`;

const SectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.3rem;
  font-weight: 600;
`;

const BackupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
`;

const BackupItem = styled.div`
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;

  &:hover {
    border-color: #10b981;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const BackupInfo = styled.div`
  flex: 1;
`;

const BackupFileName = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
`;

const BackupDetails = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const BackupActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SmallButton = styled.button`
  background: ${props => {
    if (props.danger) return '#dc3545';
    if (props.success) return '#28a745';
    return '#667eea';
  }};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${props => {
    if (props.status === 'success') return '#d4edda';
    if (props.status === 'failed') return '#f8d7da';
    return '#fff3cd';
  }};
  color: ${props => {
    if (props.status === 'success') return '#155724';
    if (props.status === 'failed') return '#721c24';
    return '#856404';
  }};
`;

// Create Backup Section
const CreateBackupSection = styled.div`
  display: ${props => props.show ? 'block' : 'none'};
`;

const BackupOptions = styled.div`
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const OptionGroup = styled.div`
  margin-bottom: 1rem;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  color: #333;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin: 1rem 0;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  width: ${props => props.progress || 0}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  text-align: center;
  color: #6c757d;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

// Restore Wizard Section
const RestoreSection = styled.div`
  display: ${props => props.show ? 'block' : 'none'};
`;

const WizardSteps = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 0;
    right: 0;
    height: 2px;
    background: #e9ecef;
    z-index: 0;
  }
`;

const WizardStep = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
`;

const StepCircle = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.active ? '#10b981' : '#e9ecef'};
  color: ${props => props.active ? 'white' : '#6c757d'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
  transition: all 0.3s ease;
`;

const StepLabel = styled.div`
  font-size: 0.8rem;
  color: ${props => props.active ? '#10b981' : '#6c757d'};
  font-weight: ${props => props.active ? '600' : '400'};
  text-align: center;
`;

const RestoreOptions = styled.div`
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  color: #333;
  padding: 0.75rem;
  border-radius: 8px;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(16, 185, 129, 0.1);
  }
`;

const Radio = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const PreviewList = styled.div`
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
`;

const PreviewItem = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.9rem;
  color: #333;

  &:last-child {
    border-bottom: none;
  }
`;

const WarningBox = styled.div`
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 10px;
  padding: 1rem;
  margin: 1rem 0;
  color: #856404;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SecondaryButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
  }
`;

function BackupManager({ isOpen, onClose }) {
  const { showToast } = useToast();
  const [view, setView] = useState('main'); // 'main', 'create', 'history', 'restore'
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isBackupInProgress, setIsBackupInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);
  
  // Create backup options
  const [backupOptions, setBackupOptions] = useState({
    includeProjects: true,
    includeProskliseis: true,
    includeEntaxeis: true,
    includeEgkriseis: true
  });
  
  // Restore wizard state
  const [restoreStep, setRestoreStep] = useState(1); // 1: Select backup, 2: Choose type, 3: Select items, 4: Preview, 5: Confirm
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreType, setRestoreType] = useState('full'); // 'full', 'selective', 'merge'
  const [selectedItems, setSelectedItems] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_restorePreview, _setRestorePreview] = useState(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  
  // Load backups on mount
  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);
  
  // Listen for backup progress and completion
  useEffect(() => {
    if (!isOpen) return;
    
    const progressListener = (event, progress) => {
      setBackupProgress(progress);
    };
    
    const completionListener = (event, result) => {
      setIsBackupInProgress(false);
      setBackupProgress(null);
      if (result.success) {
        showToast(`Το backup ολοκληρώθηκε επιτυχώς!\n\nΑρχείο: ${result.backupInfo?.fileName || 'N/A'}\nΜέγεθος: ${result.backupInfo?.size ? (result.backupInfo.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`, 'success');
        loadBackups(); // Reload list
        setView('history'); // Show history
      } else {
        showToast(`Σφάλμα κατά το backup: ${result.message || 'Άγνωστο σφάλμα'}`, 'error');
      }
    };
    
    const unsubProgress = ipcRenderer.on('backup-progress', progressListener);
    const unsubCompleted = ipcRenderer.on('backup-completed', completionListener);
    
    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, [isOpen]);
  
  const loadBackups = async () => {
    try {
      const backupList = await ipcRenderer.invoke('get-backup-list');
      setBackups(backupList);
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };
  
  const handleCreateBackup = async () => {
    if (isBackupInProgress) {
      showToast('Το backup είναι ήδη σε εξέλιξη...', 'info');
      return;
    }
    
    try {
      setIsBackupInProgress(true);
      setBackupProgress({ entries: 0, total: 0, bytes: 0 });
      
      const result = await ipcRenderer.invoke('create-backup', {
        type: 'manual',
        ...backupOptions
      });
      
      if (result.success) {
        setIsBackupInProgress(false);
        setBackupProgress(null);
        showToast(`Το backup ολοκληρώθηκε επιτυχώς!\n\nΑρχείο: ${result.backupInfo?.fileName || 'N/A'}\nΜέγεθος: ${result.backupInfo?.size ? (result.backupInfo.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`, 'success');
        loadBackups();
        setView('history');
      } else {
        setIsBackupInProgress(false);
        setBackupProgress(null);
        showToast(`Σφάλμα κατά το backup: ${result.error || 'Άγνωστο σφάλμα'}`, 'error');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setIsBackupInProgress(false);
      setBackupProgress(null);
      showToast(`Σφάλμα κατά το backup: ${error.message}`, 'error');
    }
  };
  
  const handleDeleteBackup = async (backupId) => {
    if (!await showConfirm({ title: 'Διαγραφή Backup', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το backup;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '⚠️' })) {
      return;
    }
    
    try {
      const result = await ipcRenderer.invoke('delete-backup', backupId);
      if (result.success) {
        loadBackups();
        showToast('Το backup διαγράφηκε επιτυχώς', 'success');
      } else {
        showToast(`Σφάλμα: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      showToast(`Σφάλμα: ${error.message}`, 'error');
    }
  };
  
  const handleVerifyBackup = async (backupId) => {
    try {
      setLoading(true);
      const result = await ipcRenderer.invoke('verify-backup', backupId);
      if (result.success) {
        if (result.valid) {
          showToast('Το backup είναι έγκυρο και ακέραιο', 'success');
        } else {
          showToast('Το backup έχει αλλοιωθεί! Ο checksum δεν ταιριάζει.', 'warning');
        }
      } else {
        showToast(`Σφάλμα: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error verifying backup:', error);
      showToast(`Σφάλμα: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartRestore = (backup) => {
    setSelectedBackup(backup);
    setRestoreStep(1);
    setView('restore');
  };
  
  const handleRestoreNext = () => {
    if (restoreStep === 1) {
      // Step 1: Select backup (already done)
      setRestoreStep(2);
    } else if (restoreStep === 2) {
      // Step 2: Choose restore type
      if (restoreType === 'full') {
        // Skip to preview for full restore
        setRestoreStep(4);
      } else {
        setRestoreStep(3);
      }
    } else if (restoreStep === 3) {
      // Step 3: Select items (for selective/merge)
      setRestoreStep(4);
    } else if (restoreStep === 4) {
      // Step 4: Preview
      setRestoreStep(5);
    }
  };
  
  const handleRestoreBack = () => {
    if (restoreStep > 1) {
      setRestoreStep(restoreStep - 1);
    }
  };
  
  const handleConfirmRestore = async () => {
    const confirmed = await showConfirm({
      title: 'Επαναφορά δεδομένων',
      message: 'Είστε σίγουροι ότι θέλετε να κάνετε restore;',
      detail: 'Αυτό θα αντικαταστήσει τα τρέχοντα δεδομένα!',
      confirmLabel: 'Επαναφορά',
      cancelLabel: 'Άκυρο',
      icon: '⚠️',
    });
    if (!confirmed) {
      return;
    }
    
    try {
      setLoading(true);
      setRestoreInProgress(true);
      
      const result = await ipcRenderer.invoke('restore-backup', selectedBackup.backupId, {
        type: restoreType,
        items: selectedItems
      });
      
      if (result.success) {
        showToast('Το restore ολοκληρώθηκε επιτυχώς! Η εφαρμογή θα επανεκκινηθεί.', 'success');
        // Restart the app
        ipcRenderer.send('restart-app');
      } else {
        showToast(`Σφάλμα restore: ${result.error || result.message || 'Άγνωστο σφάλμα'}`, 'error');
      }
      
      setView('main');
      setRestoreStep(1);
    } catch (error) {
      console.error('Error restoring backup:', error);
      showToast(`Σφάλμα: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setRestoreInProgress(false);
    }
  };
  
  const formatDate = (dateString) => formatDateTimeEl(dateString, '—');
  
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };
  
  if (!isOpen) return null;
  
  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && !isBackupInProgress && !restoreInProgress && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>💾 Διαχείριση Backups</ModalTitle>
          <CloseButton onClick={onClose} disabled={isBackupInProgress || restoreInProgress}>
            {isBackupInProgress || restoreInProgress ? '⏳ Εκτελείται...' : '✕ Κλείσιμο'}
          </CloseButton>
        </ModalHeader>
        
        <ModalContent>
          {/* Main View */}
          {view === 'main' && (
            <>
              <ActionButtons>
                <ActionButton
                  primary
                  onClick={() => setView('create')}
                  disabled={isBackupInProgress}
                >
                  <ActionIcon>💾</ActionIcon>
                  <ActionLabel>Δημιουργία<br/>Νέου Backup</ActionLabel>
                </ActionButton>
                
                <ActionButton
                  onClick={() => {
                    setView('history');
                    loadBackups();
                  }}
                >
                  <ActionIcon>📋</ActionIcon>
                  <ActionLabel>Διαχείριση<br/>Backups</ActionLabel>
                </ActionButton>
              </ActionButtons>
            </>
          )}
          
          {/* Create Backup View */}
          {view === 'create' && (
            <CreateBackupSection show={true}>
              <SectionTitle>Δημιουργία Νέου Backup</SectionTitle>
              
              <BackupOptions>
                <OptionGroup>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={backupOptions.includeProjects}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeProjects: e.target.checked })}
                    />
                    Έργα
                  </CheckboxLabel>
                </OptionGroup>
                
                <OptionGroup>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={backupOptions.includeProskliseis}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeProskliseis: e.target.checked })}
                    />
                    Προσκλήσεις
                  </CheckboxLabel>
                </OptionGroup>
                
                <OptionGroup>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={backupOptions.includeEntaxeis}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeEntaxeis: e.target.checked })}
                    />
                    Εντάξεις
                  </CheckboxLabel>
                </OptionGroup>
                
                <OptionGroup>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={backupOptions.includeEgkriseis}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeEgkriseis: e.target.checked })}
                    />
                    Εγκρίσεις
                  </CheckboxLabel>
                </OptionGroup>
              </BackupOptions>
              
              {isBackupInProgress && (
                <>
                  <ProgressBar>
                    <ProgressFill progress={backupProgress ? (backupProgress.entries / backupProgress.total) * 100 : 0} />
                  </ProgressBar>
                  <ProgressText>
                    {backupProgress 
                      ? `Πρόοδος: ${backupProgress.entries} / ${backupProgress.total} αρχεία (${Math.round((backupProgress.entries / backupProgress.total) * 100)}%)`
                      : 'Αρχικοποίηση...'}
                  </ProgressText>
                </>
              )}
              
              <ButtonGroup>
                <SecondaryButton onClick={() => setView('main')}>
                  Ακύρωση
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleCreateBackup}
                  disabled={isBackupInProgress || (!backupOptions.includeProjects && !backupOptions.includeProskliseis && !backupOptions.includeEntaxeis && !backupOptions.includeEgkriseis)}
                >
                  {isBackupInProgress ? 'Σε εξέλιξη...' : 'Δημιουργία Backup'}
                </PrimaryButton>
              </ButtonGroup>
            </CreateBackupSection>
          )}
          
          {/* Backup History View */}
          {view === 'history' && (
            <HistorySection show={true}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <SectionTitle>Ιστορικό Backups</SectionTitle>
                <SecondaryButton onClick={() => setView('main')}>
                  ← Πίσω
                </SecondaryButton>
              </div>
              
              {backups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                  Δεν υπάρχουν backups
                </div>
              ) : (
                <BackupList>
                  {backups.map((backup) => (
                    <BackupItem key={backup.backupId}>
                      <BackupInfo>
                        <BackupFileName>{backup.fileName}</BackupFileName>
                        <BackupDetails>
                          <span>📅 {formatDate(backup.timestamp)}</span>
                          <span>📦 {formatSize(backup.size || 0)}</span>
                          <span>🏷️ {backup.type}</span>
                          <StatusBadge status={backup.status}>
                            {backup.status === 'success' ? '✅ Επιτυχές' : 
                             backup.status === 'failed' ? '❌ Αποτυχημένο' : 
                             '⏳ Σε εξέλιξη'}
                          </StatusBadge>
                        </BackupDetails>
                      </BackupInfo>
                      <BackupActions>
                        {backup.status === 'success' && (
                          <>
                            <SmallButton success onClick={() => handleStartRestore(backup)}>
                              🔄 Restore
                            </SmallButton>
                            <SmallButton onClick={() => handleVerifyBackup(backup.backupId)} disabled={loading}>
                              ✓ Verify
                            </SmallButton>
                          </>
                        )}
                        <SmallButton danger onClick={() => handleDeleteBackup(backup.backupId)}>
                          🗑️ Delete
                        </SmallButton>
                      </BackupActions>
                    </BackupItem>
                  ))}
                </BackupList>
              )}
            </HistorySection>
          )}
          
          {/* Restore Wizard View */}
          {view === 'restore' && selectedBackup && (
            <RestoreSection show={true}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <SectionTitle>Restore από Backup</SectionTitle>
                <SecondaryButton onClick={() => {
                  setView('history');
                  setRestoreStep(1);
                  setSelectedBackup(null);
                }}>
                  ← Πίσω
                </SecondaryButton>
              </div>
              
              <WizardSteps>
                <WizardStep>
                  <StepCircle active={restoreStep >= 1}>1</StepCircle>
                  <StepLabel active={restoreStep >= 1}>Επιλογή Backup</StepLabel>
                </WizardStep>
                <WizardStep>
                  <StepCircle active={restoreStep >= 2}>2</StepCircle>
                  <StepLabel active={restoreStep >= 2}>Τύπος Restore</StepLabel>
                </WizardStep>
                <WizardStep>
                  <StepCircle active={restoreStep >= 3}>3</StepCircle>
                  <StepLabel active={restoreStep >= 3}>Επιλογή Στοιχείων</StepLabel>
                </WizardStep>
                <WizardStep>
                  <StepCircle active={restoreStep >= 4}>4</StepCircle>
                  <StepLabel active={restoreStep >= 4}>Preview</StepLabel>
                </WizardStep>
                <WizardStep>
                  <StepCircle active={restoreStep >= 5}>5</StepCircle>
                  <StepLabel active={restoreStep >= 5}>Επιβεβαίωση</StepLabel>
                </WizardStep>
              </WizardSteps>
              
              {/* Step 1: Select Backup */}
              {restoreStep === 1 && (
                <div>
                  <p>Επιλέχθηκε: <strong>{selectedBackup.fileName}</strong></p>
                  <p>Ημερομηνία: {formatDate(selectedBackup.timestamp)}</p>
                  <p>Μέγεθος: {formatSize(selectedBackup.size || 0)}</p>
                  <ButtonGroup>
                    <SecondaryButton onClick={() => {
                      setView('history');
                      setRestoreStep(1);
                      setSelectedBackup(null);
                    }} disabled={restoreInProgress}>
                      Ακύρωση
                    </SecondaryButton>
                    <PrimaryButton onClick={handleRestoreNext} disabled={restoreInProgress}>
                      Επόμενο →
                    </PrimaryButton>
                  </ButtonGroup>
                </div>
              )}
              
              {/* Step 2: Choose Restore Type */}
              {restoreStep === 2 && (
                <div>
                  <RestoreOptions>
                    <RadioGroup>
                      <RadioLabel>
                        <Radio
                          type="radio"
                          name="restoreType"
                          value="full"
                          checked={restoreType === 'full'}
                          onChange={(e) => setRestoreType(e.target.value)}
                          disabled={restoreInProgress}
                        />
                        <div>
                          <strong>Full Restore</strong>
                          <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.25rem' }}>
                            Αντικατάσταση όλων των δεδομένων
                          </div>
                        </div>
                      </RadioLabel>
                      
                      <RadioLabel>
                        <Radio
                          type="radio"
                          name="restoreType"
                          value="selective"
                          checked={restoreType === 'selective'}
                          onChange={(e) => setRestoreType(e.target.value)}
                          disabled={restoreInProgress}
                        />
                        <div>
                          <strong>Selective Restore</strong>
                          <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.25rem' }}>
                            Επιλογή συγκεκριμένων έργων/προσκλήσεων
                          </div>
                        </div>
                      </RadioLabel>
                      
                      <RadioLabel>
                        <Radio
                          type="radio"
                          name="restoreType"
                          value="merge"
                          checked={restoreType === 'merge'}
                          onChange={(e) => setRestoreType(e.target.value)}
                          disabled={restoreInProgress}
                        />
                        <div>
                          <strong>Merge Restore</strong>
                          <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.25rem' }}>
                            Συγχώνευση με υπάρχοντα δεδομένα
                          </div>
                        </div>
                      </RadioLabel>
                    </RadioGroup>
                  </RestoreOptions>
                  
                  <ButtonGroup>
                    <SecondaryButton onClick={handleRestoreBack} disabled={restoreInProgress}>
                      ← Πίσω
                    </SecondaryButton>
                    <PrimaryButton onClick={handleRestoreNext} disabled={restoreInProgress}>
                      Επόμενο →
                    </PrimaryButton>
                  </ButtonGroup>
                </div>
              )}
              
              {/* Step 3: Select Items (for selective/merge) */}
              {restoreStep === 3 && (
                <div>
                  <p style={{ color: '#6c757d', marginBottom: '1rem' }}>
                    {restoreType === 'selective' 
                      ? 'Επιλέξτε τα στοιχεία που θέλετε να restore:'
                      : 'Επιλέξτε τα στοιχεία που θέλετε να συγχωνεύσετε:'}
                  </p>
                  <BackupOptions>
                    <OptionGroup>
                      <CheckboxLabel>
                        <Checkbox
                          type="checkbox"
                          checked={selectedItems.includes('projects')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, 'projects']);
                            } else {
                              setSelectedItems(selectedItems.filter(item => item !== 'projects'));
                            }
                          }}
                        />
                        <span>📁 Έργα ({selectedBackup.contents?.projects || 0})</span>
                      </CheckboxLabel>
                    </OptionGroup>
                    <OptionGroup>
                      <CheckboxLabel>
                        <Checkbox
                          type="checkbox"
                          checked={selectedItems.includes('proskliseis')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, 'proskliseis']);
                            } else {
                              setSelectedItems(selectedItems.filter(item => item !== 'proskliseis'));
                            }
                          }}
                        />
                        <span>📢 Προσκλήσεις ({selectedBackup.contents?.proskliseis || 0})</span>
                      </CheckboxLabel>
                    </OptionGroup>
                    <OptionGroup>
                      <CheckboxLabel>
                        <Checkbox
                          type="checkbox"
                          checked={selectedItems.includes('entaxeis')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, 'entaxeis']);
                            } else {
                              setSelectedItems(selectedItems.filter(item => item !== 'entaxeis'));
                            }
                          }}
                        />
                        <span>📊 Εντάξεις ({selectedBackup.contents?.entaxeis || 0})</span>
                      </CheckboxLabel>
                    </OptionGroup>
                    <OptionGroup>
                      <CheckboxLabel>
                        <Checkbox
                          type="checkbox"
                          checked={selectedItems.includes('egkriseis')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, 'egkriseis']);
                            } else {
                              setSelectedItems(selectedItems.filter(item => item !== 'egkriseis'));
                            }
                          }}
                        />
                        <span>📋 Εγκρίσεις ({selectedBackup.contents?.egkriseis || 0})</span>
                      </CheckboxLabel>
                    </OptionGroup>
                  </BackupOptions>
                  {selectedItems.length === 0 && (
                    <WarningBox style={{ marginTop: '1rem' }}>
                      ⚠️ Παρακαλώ επιλέξτε τουλάχιστον ένα στοιχείο
                    </WarningBox>
                  )}
                  <ButtonGroup>
                    <SecondaryButton onClick={handleRestoreBack} disabled={restoreInProgress}>
                      ← Πίσω
                    </SecondaryButton>
                    <PrimaryButton onClick={handleRestoreNext} disabled={selectedItems.length === 0 || restoreInProgress}>
                      Επόμενο →
                    </PrimaryButton>
                  </ButtonGroup>
                </div>
              )}
              
              {/* Step 4: Preview */}
              {restoreStep === 4 && (
                <div>
                  <SectionTitle>Preview Αλλαγών</SectionTitle>
                  <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Τύπος Restore: {restoreType === 'full' ? 'Full Restore' : restoreType === 'selective' ? 'Selective Restore' : 'Merge Restore'}</p>
                    {restoreType !== 'full' && (
                      <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        Επιλεγμένα στοιχεία: {selectedItems.length > 0 ? selectedItems.map(item => {
                          const labels = {
                            'projects': '📁 Έργα',
                            'proskliseis': '📢 Προσκλήσεις',
                            'entaxeis': '📊 Εντάξεις',
                            'egkriseis': '📋 Εγκρίσεις'
                          };
                          return labels[item];
                        }).join(', ') : 'Κανένα'}
                      </p>
                    )}
                  </div>
                  <PreviewList>
                    {(restoreType === 'full' || selectedItems.includes('projects')) && (
                      <PreviewItem>📁 Έργα: {selectedBackup.contents?.projects || 0}</PreviewItem>
                    )}
                    {(restoreType === 'full' || selectedItems.includes('proskliseis')) && (
                      <PreviewItem>📢 Προσκλήσεις: {selectedBackup.contents?.proskliseis || 0}</PreviewItem>
                    )}
                    {(restoreType === 'full' || selectedItems.includes('entaxeis')) && (
                      <PreviewItem>📊 Εντάξεις: {selectedBackup.contents?.entaxeis || 0}</PreviewItem>
                    )}
                    {(restoreType === 'full' || selectedItems.includes('egkriseis')) && (
                      <PreviewItem>📋 Εγκρίσεις: {selectedBackup.contents?.egkriseis || 0}</PreviewItem>
                    )}
                  </PreviewList>
                  
                  <WarningBox>
                    ⚠️ <strong>Προσοχή:</strong> {
                      restoreType === 'full' 
                        ? 'Αυτή η λειτουργία θα αντικαταστήσει ΟΛΑ τα τρέχοντα δεδομένα.'
                        : restoreType === 'selective'
                        ? 'Αυτή η λειτουργία θα αντικαταστήσει μόνο τα επιλεγμένα στοιχεία.'
                        : 'Αυτή η λειτουργία θα συγχωνεύσει τα δεδομένα από το backup με τα υπάρχοντα (θα προσθέσει μόνο νέα στοιχεία).'
                    }
                    <br/>Συνιστάται να κάνετε backup πριν το restore.
                  </WarningBox>
                  
                  <ButtonGroup>
                    <SecondaryButton onClick={handleRestoreBack} disabled={restoreInProgress}>
                      ← Πίσω
                    </SecondaryButton>
                    <PrimaryButton onClick={handleRestoreNext} disabled={restoreInProgress}>
                      Επόμενο →
                    </PrimaryButton>
                  </ButtonGroup>
                </div>
              )}
              
              {/* Step 5: Confirm */}
              {restoreStep === 5 && (
                <div>
                  <SectionTitle>Επιβεβαίωση Restore</SectionTitle>
                  <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem' }}>
                    <p><strong>Backup:</strong> {selectedBackup.fileName}</p>
                    <p><strong>Τύπος:</strong> {restoreType === 'full' ? 'Full Restore' : restoreType === 'selective' ? 'Selective Restore' : 'Merge Restore'}</p>
                    <p><strong>Ημερομηνία Backup:</strong> {formatDate(selectedBackup.timestamp)}</p>
                  </div>
                  
                  <WarningBox>
                    ⚠️ <strong>Τελική Επιβεβαίωση:</strong> Είστε σίγουροι ότι θέλετε να προχωρήσετε; 
                    Αυτή η ενέργεια δεν μπορεί να αναιρεθεί!
                  </WarningBox>
                  
                  {restoreInProgress && (
                    <div style={{ background: '#e7f3ff', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', textAlign: 'center' }}>
                      <p>⏳ Το restore είναι σε εξέλιξη... Παρακαλώ περιμένετε.</p>
                    </div>
                  )}
                  
                  <ButtonGroup>
                    <SecondaryButton onClick={handleRestoreBack} disabled={restoreInProgress || loading}>
                      ← Πίσω
                    </SecondaryButton>
                    <PrimaryButton onClick={handleConfirmRestore} disabled={loading || restoreInProgress}>
                      {loading || restoreInProgress ? '⏳ Σε εξέλιξη...' : '✅ Επιβεβαίωση Restore'}
                    </PrimaryButton>
                  </ButtonGroup>
                </div>
              )}
            </RestoreSection>
          )}
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
}

export default BackupManager;

