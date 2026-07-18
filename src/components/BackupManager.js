import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';
import { formatDateTimeEl } from '../utils/dateFormat';

const ipcRenderer = window.electronAPI;

const BACKUP_TYPE_LABELS = {
  full: 'Πλήρες',
  manual: 'Χειροκίνητο',
  safety: 'Ασφαλείας',
};

const fmtBytes = (n) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}′ ${r}″` : `${r}″`;
};

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

const indeterminateSlide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
`;

// Κινούμενη μπάρα για όταν δεν ξέρουμε ακόμα το σύνολο (δείχνει ότι «ζει» η διαδικασία)
const IndeterminateFill = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 40%;
    background: linear-gradient(90deg, rgba(16,185,129,0.15) 0%, #10b981 50%, rgba(16,185,129,0.15) 100%);
    animation: ${indeterminateSlide} 1.1s ease-in-out infinite;
  }
`;

const ProgressText = styled.div`
  text-align: center;
  color: #6c757d;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 0.35rem;
`;

const StalledWarning = styled.div`
  text-align: center;
  font-size: 0.85rem;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-top: 0.6rem;
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

function BackupManager({ isOpen, onClose, currentUser }) {
  const { showToast } = useToast();
  const actingUsername = currentUser?.username;
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const [view, setView] = useState('main'); // 'main', 'create', 'history', 'restore'
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isBackupInProgress, setIsBackupInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [stalled, setStalled] = useState(false);
  const startRef = useRef(0);
  const lastProgressRef = useRef(0);
  const cancelledRef = useRef(false);

  const resetBackupUiState = () => {
    setIsBackupInProgress(false);
    setBackupProgress(null);
    setStalled(false);
    setElapsedSec(0);
  };

  // Κατάσταση αντιγράφων (τελευταίο, υπενθύμιση)
  const [status, setStatus] = useState(null);
  // Θέση αποθήκευσης — ορατή μόνο στον SUPERADMIN
  const [location, setLocation] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  
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
      loadStatus();
      if (isSuperAdmin) loadLocation();
    }
  }, [isOpen]);
  
  // Listen for backup progress and completion
  useEffect(() => {
    if (!isOpen) return;
    
    const progressListener = (progress) => {
      if (cancelledRef.current || !progress) return;
      lastProgressRef.current = Date.now();
      setStalled(false);
      setBackupProgress(progress);
    };
    
    const completionListener = (result) => {
      if (cancelledRef.current) {
        resetBackupUiState();
        return;
      }
      resetBackupUiState();
      if (result && result.success) {
        showToast(`Το backup ολοκληρώθηκε επιτυχώς!\n\nΑρχείο: ${result.backupInfo?.fileName || 'N/A'}\nΜέγεθος: ${result.backupInfo?.size ? (result.backupInfo.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`, 'success');
        loadBackups(); // Reload list
        setView('history'); // Show history
      } else if (result && result.aborted) {
        showToast('Η δημιουργία αντιγράφου ακυρώθηκε.', 'info');
      } else {
        showToast(`Σφάλμα κατά το backup: ${(result && result.message) || 'Άγνωστο σφάλμα'}`, 'error');
      }
    };
    
    const unsubProgress = ipcRenderer.on('backup-progress', progressListener);
    const unsubCompleted = ipcRenderer.on('backup-completed', completionListener);
    
    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, [isOpen]);

  // Χρονόμετρο + ανίχνευση «κολλήματος» όσο τρέχει το backup
  useEffect(() => {
    if (!isBackupInProgress) return;
    const tick = setInterval(() => {
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.round((now - startRef.current) / 1000)));
      // Αν δεν έχει έρθει ενημέρωση προόδου για >25s, θεωρούμε πιθανή καθυστέρηση
      if (lastProgressRef.current && now - lastProgressRef.current > 25000) {
        setStalled(true);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [isBackupInProgress]);
  
  const loadBackups = async () => {
    try {
      const backupList = await ipcRenderer.invoke('get-backup-list');
      setBackups(backupList);
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await ipcRenderer.invoke('get-backup-status', { actingUsername });
      if (res && res.success !== false) setStatus(res);
    } catch (error) {
      console.error('Error loading backup status:', error);
    }
  };

  const loadLocation = async () => {
    try {
      const res = await ipcRenderer.invoke('get-backup-location', { actingUsername });
      if (res && res.success) setLocation(res);
    } catch (error) {
      console.error('Error loading backup location:', error);
    }
  };

  const handleChangeLocation = async () => {
    try {
      const selected = await ipcRenderer.invoke('select-backup-folder');
      if (!selected) return;
      setSavingLocation(true);
      const res = await ipcRenderer.invoke('save-backup-location', { actingUsername, location: selected });
      if (res && res.success) {
        showToast('Η θέση αποθήκευσης αντιγράφων ενημερώθηκε.', 'success');
        await loadLocation();
        await loadBackups();
      } else {
        showToast(`Σφάλμα: ${res?.error || 'Άγνωστο σφάλμα'}`, 'error');
      }
    } catch (error) {
      showToast(`Σφάλμα: ${error.message}`, 'error');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleResetLocation = async () => {
    try {
      setSavingLocation(true);
      const res = await ipcRenderer.invoke('save-backup-location', { actingUsername, location: '' });
      if (res && res.success) {
        showToast('Επαναφορά στην προεπιλεγμένη θέση αποθήκευσης.', 'success');
        await loadLocation();
        await loadBackups();
      } else {
        showToast(`Σφάλμα: ${res?.error || 'Άγνωστο σφάλμα'}`, 'error');
      }
    } catch (error) {
      showToast(`Σφάλμα: ${error.message}`, 'error');
    } finally {
      setSavingLocation(false);
    }
  };
  
  const handleCancelBackup = async ({ closeAfter = false } = {}) => {
    cancelledRef.current = true;
    resetBackupUiState();
    try {
      await ipcRenderer.invoke('cancel-backup', { actingUsername });
    } catch (_e) { /* ακόμα κι αν αποτύχει το IPC, το UI ξεκλειδώνει */ }
    showToast('Η δημιουργία αντιγράφου ακυρώθηκε.', 'info');
    if (closeAfter) {
      onClose();
    } else {
      setView('main');
    }
  };

  const handleCloseModal = async () => {
    if (restoreInProgress) return;
    if (isBackupInProgress) {
      await handleCancelBackup({ closeAfter: true });
      return;
    }
    onClose();
  };

  const handleCreateBackup = async () => {
    if (isBackupInProgress) {
      showToast('Το backup είναι ήδη σε εξέλιξη...', 'info');
      return;
    }
    
    try {
      cancelledRef.current = false;
      setIsBackupInProgress(true);
      setBackupProgress({ entries: 0, total: 0, bytes: 0 });
      startRef.current = Date.now();
      lastProgressRef.current = Date.now();
      setElapsedSec(0);
      setStalled(false);
      
      const result = await ipcRenderer.invoke('create-backup', {
        type: 'manual',
        actingUsername
      });

      // Αν ο χρήστης ακύρωσε ενδιάμεσα, μην ξανακλειδώσεις το παράθυρο
      if (cancelledRef.current) {
        resetBackupUiState();
        return;
      }
      
      if (result.success) {
        resetBackupUiState();
        showToast(`Το backup ολοκληρώθηκε επιτυχώς!\n\nΑρχείο: ${result.backupInfo?.fileName || 'N/A'}\nΜέγεθος: ${result.backupInfo?.size ? (result.backupInfo.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`, 'success');
        loadBackups();
        setView('history');
      } else if (result.aborted) {
        resetBackupUiState();
        showToast('Η δημιουργία αντιγράφου ακυρώθηκε.', 'info');
        setView('main');
      } else {
        resetBackupUiState();
        showToast(`Σφάλμα κατά το backup: ${result.error || 'Άγνωστο σφάλμα'}`, 'error');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      if (!cancelledRef.current) {
        resetBackupUiState();
        showToast(`Σφάλμα κατά το backup: ${error.message}`, 'error');
      } else {
        resetBackupUiState();
      }
    }
  };
  
  const handleDeleteBackup = async (backupId) => {
    if (!await showConfirm({ title: 'Διαγραφή Backup', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το backup;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '⚠️' })) {
      return;
    }
    
    try {
      const result = await ipcRenderer.invoke('delete-backup', backupId, { actingUsername });
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
        items: selectedItems,
        actingUsername
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
          <CloseButton onClick={handleCloseModal} disabled={restoreInProgress}>
            {restoreInProgress
              ? '⏳ Εκτελείται...'
              : isBackupInProgress
                ? '⏹ Ακύρωση & Κλείσιμο'
                : '✕ Κλείσιμο'}
          </CloseButton>
        </ModalHeader>
        
        <ModalContent>
          {/* Main View */}
          {view === 'main' && (
            <>
              {status && (
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 12,
                  border: `1.5px solid ${status.reminderDue ? '#fdba74' : '#86efac'}`,
                  background: status.reminderDue ? '#fff7ed' : '#f0fdf4',
                  color: status.reminderDue ? '#9a3412' : '#166534',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                }}>
                  {status.hasBackup ? (
                    <>
                      <strong>Τελευταίο αντίγραφο ασφαλείας:</strong>{' '}
                      {formatDate(status.lastBackupAt)}
                      {status.lastBackupBy ? ` — από ${status.lastBackupBy}` : ''}
                      {typeof status.daysSince === 'number' ? ` (πριν ${status.daysSince} ημέρες)` : ''}
                      {status.reminderDue && (
                        <div style={{ marginTop: 6, fontWeight: 700 }}>
                          ⚠️ Συνιστάται η δημιουργία νέου αντιγράφου ασφαλείας.
                        </div>
                      )}
                    </>
                  ) : (
                    <strong>⚠️ Δεν έχει δημιουργηθεί ποτέ αντίγραφο ασφαλείας.</strong>
                  )}
                </div>
              )}

              <ActionButtons>
                <ActionButton
                  primary
                  onClick={() => setView('create')}
                  disabled={isBackupInProgress}
                >
                  <ActionIcon>💾</ActionIcon>
                  <ActionLabel>Δημιουργία<br/>Νέου Αντιγράφου</ActionLabel>
                </ActionButton>
                
                <ActionButton
                  onClick={() => {
                    setView('history');
                    loadBackups();
                  }}
                >
                  <ActionIcon>📋</ActionIcon>
                  <ActionLabel>Ιστορικό<br/>Αντιγράφων</ActionLabel>
                </ActionButton>
              </ActionButtons>

              {/* Θέση αποθήκευσης — ΟΡΑΤΗ ΜΟΝΟ ΣΤΟΝ ΥΠΕΡΔΙΑΧΕΙΡΙΣΤΗ */}
              {isSuperAdmin && location && (
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: 12,
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    📁 Θέση αποθήκευσης αντιγράφων
                  </div>
                  <div style={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: '0.85rem',
                    color: '#475569',
                    wordBreak: 'break-all',
                    marginBottom: 4,
                  }}>
                    {location.effectiveDir || '—'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 10 }}>
                    {location.isDefault
                      ? 'Προεπιλεγμένη θέση (εντός του φακέλου δεδομένων).'
                      : 'Προσαρμοσμένη θέση αποθήκευσης.'}
                    {' '}Η διαδρομή είναι ορατή μόνο σε εσάς.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SmallButton onClick={handleChangeLocation} disabled={savingLocation}>
                      Αλλαγή θέσης…
                    </SmallButton>
                    {!location.isDefault && (
                      <SmallButton danger onClick={handleResetLocation} disabled={savingLocation}>
                        Επαναφορά προεπιλογής
                      </SmallButton>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Create Backup View */}
          {view === 'create' && (
            <CreateBackupSection show={true}>
              <SectionTitle>Δημιουργία Πλήρους Αντιγράφου Ασφαλείας</SectionTitle>

              <BackupOptions>
                <div style={{ fontSize: '0.95rem', color: '#333', lineHeight: 1.6 }}>
                  Θα δημιουργηθεί ένα <strong>πλήρες αντίγραφο</strong> όλων των δεδομένων της εφαρμογής:
                  έργα, εντάξεις, προσκλήσεις, εγκρίσεις, μελέτες, αναθέσεις εργασιών, σημειώσεις,
                  χρήστες και ρυθμίσεις.
                </div>
              </BackupOptions>

              {isBackupInProgress && (() => {
                const p = backupProgress || {};
                const hasBytes = p.totalBytes > 0;
                const bytePct = hasBytes ? Math.min(100, (p.bytes / p.totalBytes) * 100) : 0;
                const isFinalizing = p.phase === 'finalizing';
                const isScanning = p.phase === 'scanning' || (!hasBytes && !p.bytes);
                // Δείχνουμε πραγματικό ποσοστό όταν ξέρουμε το σύνολο· αλλιώς κινούμενη μπάρα
                const showDeterminate = hasBytes && !isFinalizing;
                let label;
                if (isFinalizing) label = 'Οριστικοποίηση & έλεγχος ακεραιότητας…';
                else if (isScanning) label = 'Ανάλυση δεδομένων…';
                else label = 'Συμπίεση δεδομένων…';
                return (
                  <>
                    <ProgressBar>
                      {showDeterminate
                        ? <ProgressFill progress={bytePct} />
                        : <IndeterminateFill />}
                    </ProgressBar>
                    <ProgressText>
                      {label}
                      {showDeterminate ? ` ${Math.round(bytePct)}%` : ''}
                    </ProgressText>
                    <ProgressMeta>
                      <span>
                        {p.bytes ? fmtBytes(p.bytes) : '0 B'}
                        {hasBytes ? ` / ${fmtBytes(p.totalBytes)}` : ''}
                        {p.total ? ` • ${p.entries || 0}/${p.total} αρχεία` : ''}
                      </span>
                      <span>⏱ {fmtTime(elapsedSec)}</span>
                    </ProgressMeta>
                    {stalled && (
                      <StalledWarning>
                        Η διαδικασία καθυστερεί περισσότερο από το αναμενόμενο. Πιθανόν
                        γίνεται συμπίεση μεγάλων αρχείων — παρακαλώ περιμένετε λίγο ακόμη
                        χωρίς να κλείσετε το παράθυρο.
                      </StalledWarning>
                    )}
                  </>
                );
              })()}
              
              <ButtonGroup>
                <SecondaryButton
                  onClick={() => {
                    if (isBackupInProgress) {
                      handleCancelBackup({ closeAfter: false });
                    } else {
                      setView('main');
                    }
                  }}
                >
                  {isBackupInProgress ? 'Ακύρωση διαδικασίας' : 'Πίσω'}
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleCreateBackup}
                  disabled={isBackupInProgress}
                >
                  {isBackupInProgress ? 'Σε εξέλιξη...' : 'Δημιουργία Αντιγράφου'}
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
                          <span>🏷️ {BACKUP_TYPE_LABELS[backup.type] || backup.type}</span>
                          <span>👤 {backup.createdBy?.fullName || backup.createdBy?.username || 'Άγνωστος'}</span>
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
                            {isSuperAdmin && (
                              <SmallButton success onClick={() => handleStartRestore(backup)}>
                                🔄 Επαναφορά
                              </SmallButton>
                            )}
                            <SmallButton onClick={() => handleVerifyBackup(backup.backupId)} disabled={loading}>
                              ✓ Έλεγχος
                            </SmallButton>
                          </>
                        )}
                        {isSuperAdmin && (
                          <SmallButton danger onClick={() => handleDeleteBackup(backup.backupId)}>
                            🗑️ Διαγραφή
                          </SmallButton>
                        )}
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

