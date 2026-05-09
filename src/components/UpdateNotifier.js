import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

const slideIn = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const Banner = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0;
  background: linear-gradient(135deg, #1565c0, #0d47a1);
  color: white;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 99999;
  animation: ${slideIn} 0.4s ease-out;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  font-family: inherit;
`;

const BannerText = styled.div`
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
  strong { font-weight: 700; }
`;

const BannerActions = styled.div`
  display: flex;
  gap: 10px;
  margin-left: 16px;
  flex-shrink: 0;
`;

const BannerBtn = styled.button`
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;

  &:hover { transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
`;

const InstallBtn = styled(BannerBtn)`
  background: #4caf50;
  color: white;
  &:hover { background: #43a047; }
`;

const DismissBtn = styled(BannerBtn)`
  background: rgba(255,255,255,0.15);
  color: white;
  &:hover { background: rgba(255,255,255,0.25); }
`;

const ProgressBar = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: rgba(255,255,255,0.2);
  z-index: 100000;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: #4caf50;
  transition: width 0.3s;
  width: ${props => props.percent || 0}%;
`;

const UpdateNotifier = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const unsubAvailable = ipcRenderer.on('update-available', (info) => {
      setUpdateInfo(info);
      setDismissed(false);
    });

    const unsubDownloaded = ipcRenderer.on('update-downloaded', (info) => {
      setDownloaded(true);
      setDownloading(false);
      setUpdateInfo(prev => prev ? { ...prev, ...info } : info);
    });

    const unsubProgress = ipcRenderer.on('update-download-progress', (progress) => {
      setDownloading(true);
      setDownloadProgress(progress.percent || 0);
    });

    const unsubInstalled = ipcRenderer.on('update-installed', (info) => {
      console.log(`Updated from ${info.from} to ${info.to}`);
    });

    return () => {
      if (unsubAvailable) unsubAvailable();
      if (unsubDownloaded) unsubDownloaded();
      if (unsubProgress) unsubProgress();
      if (unsubInstalled) unsubInstalled();
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    try {
      await ipcRenderer.invoke('install-update');
    } catch (err) {
      alert('Σφάλμα εγκατάστασης: ' + err.message);
      setInstalling(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!updateInfo || !updateInfo.downloadUrl) return;
    setDownloading(true);
    try {
      await ipcRenderer.invoke('download-update', updateInfo.downloadUrl);
    } catch (err) {
      alert('Σφάλμα λήψης: ' + err.message);
      setDownloading(false);
    }
  }, [updateInfo]);

  if (dismissed || !updateInfo) return null;

  if (downloading && !downloaded) {
    return (
      <ProgressBar>
        <ProgressFill percent={downloadProgress} />
      </ProgressBar>
    );
  }

  if (downloaded) {
    return (
      <Banner>
        <BannerText>
          <strong>ERGOHUB {updateInfo.version}</strong> — Η ενημέρωση είναι έτοιμη για εγκατάσταση.
          Η εφαρμογή θα κλείσει και θα ξεκινήσει ο εγκαταστάτης.
        </BannerText>
        <BannerActions>
          <DismissBtn onClick={() => setDismissed(true)}>Αργότερα</DismissBtn>
          <InstallBtn onClick={handleInstall} disabled={installing}>
            {installing ? 'Εγκατάσταση...' : 'Εγκατάσταση τώρα'}
          </InstallBtn>
        </BannerActions>
      </Banner>
    );
  }

  return (
    <Banner>
      <BannerText>
        <strong>Νέα έκδοση {updateInfo.version}</strong> — Υπάρχει διαθέσιμη ενημέρωση.
      </BannerText>
      <BannerActions>
        <DismissBtn onClick={() => setDismissed(true)}>Αργότερα</DismissBtn>
        <InstallBtn onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Λήψη...' : 'Λήψη ενημέρωσης'}
        </InstallBtn>
      </BannerActions>
    </Banner>
  );
};

export { UpdateNotifier };
export default UpdateNotifier;
