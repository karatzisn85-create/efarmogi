import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { showConfirm } from '../utils/confirmModal';
import { useToast } from './ToastProvider';
import { formatDateTimeEl } from '../utils/dateFormat';
import backupCatalog from '../../app/core/backupCatalog';

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
  const userRole = currentUser?.role;
  const canSeeLocation = backupCatalog.canSeeBackupLocation(userRole);
  const canDelete = backupCatalog.canDeleteBackup(userRole);
  const canRestore = backupCatalog.canRestoreBackup(userRole);
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
  const [selectedBackup, setSelectedBackup] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [_restorePreview, _setRestorePreview] = useState(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreReport, setRestoreReport] = useState(null);
  
  // Load backups on mount
  useEffect(() => {
    if (isOpen) {
      loadBackups();
      loadStatus();
      if (canSeeLocation) loadLocation();
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
        loadBackups();
        setView('history');
        if (backupCatalog.announceCreateBackupFromEvent()) {
          showToast(`Το backup ολοκληρώθηκε επιτυχώς!\n\nΑρχείο: ${result.backupInfo?.fileName || 'N/A'}\nΜέγεθος: ${result.backupInfo?.size ? (result.backupInfo.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`, 'success');
        }
      }
    };
    
    const unsubProgress = ipcRenderer.on('backup-progress', progressListener);
    const unsubCompleted = ipcRenderer.on('backup-completed', completionListener);
    
    return () => {
      unsubProgress();
      unsubCompleted();
    };
  }, [isOpen]);

  // Χρονόμετρο + ανίχνευση «κολλήματος» όσο τρέχει αντίγραφο ή επαναφορά
  useEffect(() => {
    if (!isBackupInProgress && !restoreInProgress) return;
    const tick = setInterval(() => {
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.round((now - startRef.current) / 1000)));
      // Αν δεν έχει έρθει ενημέρωση προόδου για >25s, θεωρούμε πιθανή καθυστέρηση
      if (lastProgressRef.current && now - lastProgressRef.current > 25000) {
        setStalled(true);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [isBackupInProgress, restoreInProgress]);
  
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
    const createCheck = backupCatalog.evaluateCreateBackup({
      role: userRole,
      inProgress: isBackupInProgress
    });
    if (!createCheck.ok) {
      showToast(createCheck.error, isBackupInProgress ? 'info' : 'error');
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
    const deleteCheck = backupCatalog.evaluateDeleteBackup({ role: userRole, backupId });
    if (!deleteCheck.ok) {
      showToast(deleteCheck.error, 'error');
      return;
    }
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
    const restoreCheck = backupCatalog.evaluateRestoreBackup({
      role: userRole,
      backupId: backup && backup.backupId
    });
    if (!restoreCheck.ok) {
      showToast(restoreCheck.error, 'error');
      return;
    }
    setSelectedBackup(backup);
    setRestoreReport(null);
    setView('restore');
  };
  
  const handleConfirmRestore = async () => {
    const confirmed = await showConfirm({
      title: backupCatalog.restoreConfirmTitle(),
      message: backupCatalog.restoreConfirmMessage(),
      detail: backupCatalog.restoreConfirmDetail(),
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
      setRestoreReport(null);
      setBackupProgress({ phase: 'restore-safety', entries: 0, total: 0 });
      startRef.current = Date.now();
      lastProgressRef.current = Date.now();
      setElapsedSec(0);
      setStalled(false);
      
      const result = await ipcRenderer.invoke('restore-backup', selectedBackup.backupId, {
        type: backupCatalog.normalizeRestoreType(),
        actingUsername
      });
      
      if (result.success) {
        const outcome = backupCatalog.evaluateRestoreOutcome({ applyOk: true });
        setRestoreReport({
          ok: true,
          message: outcome.message,
          areas: result.coverage || [],
        });
        showToast(outcome.message, 'success');
      } else if (result.rolledBack) {
        const outcome = backupCatalog.evaluateRestoreOutcome({ applyOk: false, rolledBack: true });
        setRestoreReport({ ok: false, rolledBack: true, message: outcome.message, areas: [] });
        showToast(outcome.message, 'error');
      } else {
        const outcome = backupCatalog.evaluateRestoreOutcome({ applyOk: false });
        setRestoreReport({
          ok: false,
          message: result.error || result.message || outcome.message,
          areas: [],
        });
        showToast(result.error || result.message || outcome.message, 'error');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      showToast(`Σφάλμα: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setRestoreInProgress(false);
      setBackupProgress(null);
      setStalled(false);
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
              {canSeeLocation && location && (
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
                            {canRestore && (
                              <SmallButton success onClick={() => handleStartRestore(backup)}>
                                🔄 Επαναφορά
                              </SmallButton>
                            )}
                            <SmallButton onClick={() => handleVerifyBackup(backup.backupId)} disabled={loading}>
                              ✓ Έλεγχος
                            </SmallButton>
                          </>
                        )}
                        {canDelete && (
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
          
          {/* Επαναφορά: μία επιλογή, επιβεβαίωση στα ελληνικά */}
          {view === 'restore' && selectedBackup && (
            <RestoreSection show={true}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <SectionTitle>Επαναφορά δεδομένων</SectionTitle>
                <SecondaryButton
                  onClick={() => {
                    setView('history');
                    setSelectedBackup(null);
                    setRestoreReport(null);
                  }}
                  disabled={restoreInProgress}
                >
                  ← Πίσω
                </SecondaryButton>
              </div>
              <p><strong>{backupCatalog.restoreKindLabel()}</strong></p>
              <p>Αντίγραφο: <strong>{selectedBackup.fileName}</strong></p>
              <p>Ημερομηνία: {formatDate(selectedBackup.timestamp)}</p>
              <p>Μέγεθος: {formatSize(selectedBackup.size || 0)}</p>
              {!restoreReport && (
                <WarningBox>
                  {backupCatalog.restoreConfirmMessage()}{' '}
                  {backupCatalog.restoreConfirmDetail()}
                </WarningBox>
              )}
              {restoreInProgress && (() => {
                const p = backupProgress || { phase: 'restore-safety' };
                const label = backupCatalog.restoreProgressLabel(p.phase);
                const hasTotal = p.total > 0;
                const pct = hasTotal ? Math.min(100, (p.entries / p.total) * 100) : 0;
                return (
                  <div style={{ background: '#e7f3ff', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>{label}</p>
                    <ProgressBar>
                      {hasTotal ? <ProgressFill progress={pct} /> : <IndeterminateFill />}
                    </ProgressBar>
                    <ProgressText>
                      {hasTotal ? `${p.entries || 0} / ${p.total}` : 'Σε εξέλιξη'}
                      {p.current ? ` · ${p.current}` : ''}
                    </ProgressText>
                    <ProgressMeta>
                      <span>Μην κλείσετε το παράθυρο. Σε μεγάλο αντίγραφο αυτό κρατά αρκετά λεπτά.</span>
                      <span>⏱ {fmtTime(elapsedSec)}</span>
                    </ProgressMeta>
                    {stalled && (
                      <StalledWarning>
                        Καθυστερεί περισσότερο από το αναμενόμενο — η εφαρμογή δουλεύει ακόμα.
                        Μην την κλείσετε.
                      </StalledWarning>
                    )}
                  </div>
                );
              })()}
              {restoreReport && (
                <div style={{
                  padding: '1rem',
                  borderRadius: 10,
                  marginBottom: '1rem',
                  background: restoreReport.ok ? '#f0fdf4' : '#fff7ed',
                  border: `1.5px solid ${restoreReport.ok ? '#86efac' : '#fdba74'}`,
                }}>
                  <p style={{ fontWeight: 700, marginBottom: 8 }}>{restoreReport.message}</p>
                  {restoreReport.ok && restoreReport.areas && restoreReport.areas.length > 0 && (
                    <>
                      <p style={{ marginBottom: 6 }}>Επαναφέρθηκαν:</p>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                        {restoreReport.areas.map((area) => (
                          <li key={area}>{area}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              <ButtonGroup>
                <SecondaryButton onClick={() => {
                  setView('history');
                  setSelectedBackup(null);
                  setRestoreReport(null);
                }} disabled={restoreInProgress}>
                  Άκυρο
                </SecondaryButton>
                {restoreReport && restoreReport.ok ? (
                  <PrimaryButton onClick={() => ipcRenderer.send('restart-app')}>
                    Επανεκκίνηση τώρα
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={handleConfirmRestore} disabled={loading || restoreInProgress || !!restoreReport}>
                    {loading || restoreInProgress ? 'Σε εξέλιξη...' : 'Επαναφορά όλων των δεδομένων'}
                  </PrimaryButton>
                )}
              </ButtonGroup>
            </RestoreSection>
          )}

        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
}

export default BackupManager;

