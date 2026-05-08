import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9000;
`;

const Panel = styled.div`
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0;
  color: #1a2a3a;
  font-size: 20px;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 8px;
  &:hover { background: #f0f0f0; color: #333; }
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  color: #555;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const LocationCard = styled.div`
  background: ${p => p.selected ? '#e8f5e9' : '#f8f9fa'};
  border: 2px solid ${p => p.selected ? '#4caf50' : '#e0e0e0'};
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: ${p => p.selected ? '#4caf50' : '#bbb'}; }
`;

const LocationPath = styled.div`
  font-family: 'Consolas', monospace;
  font-size: 13px;
  color: #333;
  word-break: break-all;
  margin-bottom: 6px;
`;

const LocationStats = styled.div`
  font-size: 12px;
  color: #888;
  display: flex;
  gap: 16px;
`;

const CurrentBadge = styled.span`
  display: inline-block;
  background: #2196f3;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
  vertical-align: middle;
`;

const WarningBox = styled.div`
  background: #fff3e0;
  border: 1px solid #ffe0b2;
  border-radius: 10px;
  padding: 14px 16px;
  color: #e65100;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
`;

const SuccessBox = styled.div`
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 10px;
  padding: 14px 16px;
  color: #2e7d32;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
`;

const ErrorBox = styled.div`
  background: #ffeaea;
  border: 1px solid #ffcdd2;
  border-radius: 10px;
  padding: 14px 16px;
  color: #c62828;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
`;

const PrimaryBtn = styled.button`
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DangerBtn = styled.button`
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: #e53935;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #c62828; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  padding: 10px 24px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  &:hover { background: #f5f5f5; }
`;

const Spinner = styled.div`
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 3px solid #ddd;
  border-top-color: #1a2a3a;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
`;

const ProgressText = styled.div`
  color: #555;
  font-size: 14px;
  margin: 12px 0;
  display: flex;
  align-items: center;
`;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function DataMigration({ onClose }) {
  const [locations, setLocations] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [currentDataDir, setCurrentDataDir] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [lastBackupPath, setLastBackupPath] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);

  const scanLocations = useCallback(async () => {
    setScanning(true);
    setResult(null);
    const dataDir = await ipcRenderer.invoke('get-data-dir');
    setCurrentDataDir(dataDir);
    const found = await ipcRenderer.invoke('scan-data-locations');
    setLocations(found);
    setScanning(false);
  }, []);

  useEffect(() => { scanLocations(); }, [scanLocations]);

  const handleMigrate = async () => {
    if (!selectedSource || !currentDataDir) return;
    if (!window.confirm(
      `Θα αντιγραφούν ${selectedSource.files} αρχεία (${formatSize(selectedSource.totalSize)}) ` +
      `από:\n${selectedSource.path}\n\nπρος:\n${currentDataDir}\n\n` +
      `Θα δημιουργηθεί αυτόματα backup πριν την αντιγραφή. Συνέχεια;`
    )) return;

    setMigrating(true);
    setResult(null);

    const res = await ipcRenderer.invoke('migrate-data', {
      sourcePath: selectedSource.path,
      targetPath: currentDataDir
    });

    setMigrating(false);
    setResult(res);
    if (res.backupPath) setLastBackupPath(res.backupPath);
  };

  const handleRollback = async () => {
    if (!lastBackupPath) return;
    if (!window.confirm('Αναίρεση μετάβασης; Τα δεδομένα θα επιστρέψουν στην προηγούμενη κατάσταση.')) return;

    setRollingBack(true);
    const res = await ipcRenderer.invoke('rollback-migration', {
      backupPath: lastBackupPath,
      targetPath: currentDataDir
    });
    setRollingBack(false);

    if (res.success) {
      setResult({ success: true, rollback: true });
      setLastBackupPath(null);
    } else {
      setResult({ success: false, error: res.error });
    }
  };

  const sourcesExcludingCurrent = locations.filter(l => 
    l.path.toLowerCase() !== currentDataDir?.toLowerCase()
  );

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel>
        <Header>
          <Title>Μετάβαση Δεδομένων</Title>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>

        <WarningBox>
          <strong>Προσοχή:</strong> Αυτή η λειτουργία αντιγράφει δεδομένα από μια παλιά θέση στον 
          τρέχοντα φάκελο δεδομένων. Δημιουργείται αυτόματα αντίγραφο ασφαλείας πριν 
          οποιαδήποτε αλλαγή.
        </WarningBox>

        <Section>
          <SectionTitle>Τρέχων φάκελος δεδομένων</SectionTitle>
          {currentDataDir ? (
            <LocationCard>
              <LocationPath>{currentDataDir} <CurrentBadge>ΕΝΕΡΓΟΣ</CurrentBadge></LocationPath>
            </LocationCard>
          ) : (
            <div style={{ color: '#999' }}>Δεν έχει οριστεί</div>
          )}
        </Section>

        <Section>
          <SectionTitle>
            Εντοπισμένες τοποθεσίες δεδομένων
            {!scanning && (
              <SecondaryBtn onClick={scanLocations} style={{ marginLeft: 12, padding: '4px 12px', fontSize: 12 }}>
                Ανίχνευση
              </SecondaryBtn>
            )}
          </SectionTitle>

          {scanning && (
            <ProgressText><Spinner />Σάρωση δίσκων...</ProgressText>
          )}

          {!scanning && sourcesExcludingCurrent.length === 0 && (
            <div style={{ color: '#999', fontSize: 14, padding: '12px 0' }}>
              Δεν βρέθηκαν άλλες τοποθεσίες με δεδομένα. 
              Αν τα δεδομένα βρίσκονται σε δίσκο δικτύου, βεβαιωθείτε ότι είναι συνδεδεμένος.
            </div>
          )}

          {!scanning && sourcesExcludingCurrent.map(loc => (
            <LocationCard
              key={loc.path}
              selected={selectedSource?.path === loc.path}
              onClick={() => setSelectedSource(loc)}
            >
              <LocationPath>{loc.path}</LocationPath>
              <LocationStats>
                <span>{loc.files} αρχεία</span>
                <span>{loc.folders} φάκελοι</span>
                <span>{formatSize(loc.totalSize)}</span>
              </LocationStats>
            </LocationCard>
          ))}
        </Section>

        {result && result.success && !result.rollback && (
          <SuccessBox>
            <strong>Η μετάβαση ολοκληρώθηκε!</strong><br />
            Πηγή: {result.sourceStats?.files} αρχεία ({formatSize(result.sourceStats?.totalSize || 0)})<br />
            Προορισμός: {result.targetStats?.files} αρχεία ({formatSize(result.targetStats?.totalSize || 0)})<br />
            {result.verified ? '✅ Επαλήθευση: Επιτυχής' : '⚠️ Πιθανή ασυμφωνία αρχείων - ελέγξτε χειροκίνητα'}
            {result.backupPath && <><br />Backup: {result.backupPath}</>}
          </SuccessBox>
        )}

        {result && result.success && result.rollback && (
          <SuccessBox>
            <strong>Η αναίρεση ολοκληρώθηκε.</strong> Τα δεδομένα επέστρεψαν στην προηγούμενη κατάσταση.
          </SuccessBox>
        )}

        {result && !result.success && (
          <ErrorBox>
            <strong>Σφάλμα:</strong> {result.error}
          </ErrorBox>
        )}

        {migrating && (
          <ProgressText><Spinner />Αντιγραφή δεδομένων... Μην κλείσετε την εφαρμογή.</ProgressText>
        )}

        {rollingBack && (
          <ProgressText><Spinner />Αναίρεση...</ProgressText>
        )}

        <BtnRow>
          <PrimaryBtn
            onClick={handleMigrate}
            disabled={!selectedSource || migrating || rollingBack}
          >
            Μετάβαση Δεδομένων
          </PrimaryBtn>

          {lastBackupPath && result?.success && !result?.rollback && (
            <DangerBtn onClick={handleRollback} disabled={rollingBack || migrating}>
              Αναίρεση
            </DangerBtn>
          )}

          <SecondaryBtn onClick={onClose}>Κλείσιμο</SecondaryBtn>
        </BtnRow>
      </Panel>
    </Overlay>
  );
}

export default DataMigration;
