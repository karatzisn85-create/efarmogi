import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

/** Μπάρα λήψης — παραμένει στην κορυφή όπως πριν */
const ProgressBar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  z-index: 100000;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  transition: width 0.25s ease-out;
  width: ${(props) => props.percent || 0}%;
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
`;

const toastIn = keyframes`
  from {
    opacity: 0;
    transform: translate(12px, 16px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
`;

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const pulseRing = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.45), 0 8px 28px rgba(15, 23, 42, 0.18); }
  50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0), 0 12px 32px rgba(15, 23, 42, 0.22); }
`;

const UpdateCard = styled.div`
  position: fixed;
  bottom: 22px;
  right: 22px;
  z-index: 99999;
  width: min(380px, calc(100vw - 36px));
  padding: 1.1rem 1.2rem 1.15rem;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.97) 0%,
    rgba(248, 250, 252, 0.94) 45%,
    rgba(241, 245, 249, 0.96) 100%
  );
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow:
    0 4px 6px -1px rgba(15, 23, 42, 0.06),
    0 20px 40px -12px rgba(15, 23, 42, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset,
    0 -1px 0 rgba(99, 102, 241, 0.12) inset;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  font-family: inherit;
  animation: ${toastIn} 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;

  &::before {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    top: 0;
    height: 3px;
    border-radius: 0 0 4px 4px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1);
    background-size: 200% 100%;
    animation: ${shimmer} 2.5s ease-in-out infinite;
  }

  @media (max-width: 480px) {
    right: 14px;
    left: 14px;
    width: auto;
    bottom: 16px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
  margin-top: 0.15rem;
`;

const CardTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
  line-height: 1.35;

  strong {
    font-weight: 800;
    background: linear-gradient(135deg, #4338ca, #6366f1, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

const VersionPill = styled.span`
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  color: #4338ca;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.28);
`;

const CardBody = styled.p`
  margin: 0 0 1rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #475569;
`;

const CardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const Btn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

const BtnGhost = styled(Btn)`
  background: rgba(15, 23, 42, 0.06);
  color: #334155;
  border: 1px solid rgba(148, 163, 184, 0.45);

  &:hover:not(:disabled) {
    background: rgba(15, 23, 42, 0.09);
  }
`;

const BtnPrimary = styled(Btn)`
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
  }
`;

const BtnInstall = styled(BtnPrimary)`
  animation: ${pulseRing} 2.2s ease-in-out infinite;
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
      setUpdateInfo((prev) => (prev ? { ...prev, ...info } : info));
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

  const version = updateInfo.version || '';

  if (downloaded) {
    return (
      <UpdateCard role="dialog" aria-label="Ενημέρωση ERGOHUB">
        <CardHeader>
          <CardTitle>
            <strong>ERGOHUB</strong> — έτοιμη ενημέρωση
          </CardTitle>
          {version ? <VersionPill>v{version}</VersionPill> : null}
        </CardHeader>
        <CardBody>
          Η λήψη ολοκληρώθηκε. Πατήστε «Εγκατάσταση» για να κλείσει η εφαρμογή και να ξεκινήσει ο εγκαταστάτης.
        </CardBody>
        <CardActions>
          <BtnGhost type="button" onClick={() => setDismissed(true)}>
            Αργότερα
          </BtnGhost>
          <BtnInstall type="button" onClick={handleInstall} disabled={installing}>
            {installing ? 'Εγκατάσταση...' : 'Εγκατάσταση τώρα'}
          </BtnInstall>
        </CardActions>
      </UpdateCard>
    );
  }

  return (
    <UpdateCard role="dialog" aria-label="Διαθέσιμη ενημέρωση ERGOHUB">
      <CardHeader>
        <CardTitle>
          <strong>Νέα έκδοση</strong> διαθέσιμη
        </CardTitle>
        {version ? <VersionPill>v{version}</VersionPill> : null}
      </CardHeader>
      <CardBody>
        Υπάρχει ενημέρωση για το ERGOHUB. Πατήστε «Λήψη» για να ξεκινήσει η λήψη (η πρόοδος εμφανίζεται στην κορυφή της οθόνης).
      </CardBody>
      <CardActions>
        <BtnGhost type="button" onClick={() => setDismissed(true)}>
          Αργότερα
        </BtnGhost>
        <BtnPrimary type="button" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Λήψη...' : 'Λήψη ενημέρωσης'}
        </BtnPrimary>
      </CardActions>
    </UpdateCard>
  );
};

export { UpdateNotifier };
export default UpdateNotifier;
