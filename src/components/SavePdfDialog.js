import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  _registerSavePdfDialog,
  _savePdfDialogCancel,
  _savePdfDialogComplete,
  _savePdfDialogSetStep,
} from '../utils/savePdfDialog';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 210000;
  padding: 1.25rem;
  animation: ${fadeIn} 0.2s ease;
`;

const Shell = styled.div`
  width: min(540px, 100%);
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 28px 80px rgba(15, 23, 42, 0.28),
    0 0 0 1px rgba(99, 102, 241, 0.08);
  animation: ${slideUp} 0.24s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Header = styled.div`
  padding: 1.15rem 1.35rem 1rem;
  background: linear-gradient(135deg, #312e81 0%, #4338ca 42%, #6366f1 100%);
  color: #fff;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
`;

const HeaderIcon = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
`;

const HeaderText = styled.div`
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0 0 0.2rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.86);
  word-break: break-word;
`;

const Body = styled.div`
  padding: 1.15rem 1.35rem 0.35rem;
`;

const Field = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 0.4rem;
`;

const FolderRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
`;

const FolderPath = styled.div`
  flex: 1;
  min-width: 0;
  padding: 0.62rem 0.75rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.8rem;
  color: #334155;
  line-height: 1.4;
  word-break: break-all;
`;

const BrowseBtn = styled.button`
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  padding: 0 0.9rem;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: #e0e7ff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const FilenameInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  font-size: 0.88rem;
  color: #0f172a;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

const OverwritePanel = styled.div`
  margin-bottom: 1rem;
  padding: 0.85rem 0.95rem;
  border-radius: 12px;
  background: linear-gradient(180deg, #fffbeb 0%, #fff7ed 100%);
  border: 1px solid #fcd34d;
`;

const OverwriteTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 0.45rem;
`;

const OverwriteText = styled.p`
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: #78350f;
  word-break: break-word;
`;

const OverwriteFile = styled.code`
  display: block;
  margin-top: 0.5rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 0.74rem;
  color: #451a03;
  word-break: break-all;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  padding: 0.9rem 1.35rem 1.15rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.58rem 1.1rem;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const CancelBtn = styled(Btn)`
  background: #fff;
  color: #64748b;
  border: 1.5px solid #e2e8f0;

  &:hover:not(:disabled) {
    background: #f8fafc;
    color: #334155;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #4338ca, #6366f1);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.28);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(79, 70, 229, 0.34);
  }
`;

const DangerBtn = styled(Btn)`
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(239, 68, 68, 0.32);
  }
`;

const CLOSED = { open: false };

function ensurePdfExtension(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'ERGOHUB_Report.pdf';
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
}

function joinPath(folder, filename) {
  const base = String(folder || '').replace(/[\\/]+$/, '');
  const sep = base.includes('\\') ? '\\' : '/';
  return `${base}${sep}${filename}`;
}

function basename(pathStr) {
  const parts = String(pathStr || '').split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

export default function SavePdfDialog() {
  const [state, setState] = useState(CLOSED);
  const [folder, setFolder] = useState('');
  const [filename, setFilename] = useState('');
  const [pendingPath, setPendingPath] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    _registerSavePdfDialog(setState);
  }, []);

  const resetForm = useCallback(async (defaultName) => {
    const safeName = ensurePdfExtension(defaultName);
    setFilename(safeName);
    setPendingPath('');
    try {
      const res = await ipcRenderer.invoke('get-user-downloads-path');
      if (res?.success && res.path) {
        setFolder(res.path);
      }
    } catch {
      setFolder('');
    }
  }, []);

  useEffect(() => {
    if (state.open && state.step === 'form') {
      resetForm(state.defaultName);
    }
  }, [state.open, state.step, state.defaultName, resetForm]);

  const handleKey = useCallback((e) => {
    if (!state.open || busy) return;
    if (e.key === 'Escape') _savePdfDialogCancel();
  }, [state.open, busy]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const handleBrowse = async () => {
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('pick-save-folder', { defaultPath: folder });
      if (res?.success && res.path) setFolder(res.path);
    } finally {
      setBusy(false);
    }
  };

  const buildTargetPath = () => joinPath(folder, ensurePdfExtension(filename));

  const handleSave = async () => {
    if (!folder?.trim()) return;
    const targetPath = buildTargetPath();
    setBusy(true);
    try {
      const check = await ipcRenderer.invoke('check-file-exists', { filePath: targetPath });
      if (check?.exists) {
        setPendingPath(targetPath);
        _savePdfDialogSetStep('overwrite', { pendingPath: targetPath });
        return;
      }
      _savePdfDialogComplete(targetPath);
    } finally {
      setBusy(false);
    }
  };

  const handleOverwrite = () => {
    const target = pendingPath || state.pendingPath || displayPath;
    if (target) _savePdfDialogComplete(target);
  };

  const handleBackToForm = () => {
    _savePdfDialogSetStep('form');
  };

  if (!state.open) return null;

  const isOverwrite = state.step === 'overwrite';
  const displayPath = pendingPath || state.pendingPath || buildTargetPath();
  const displayName = basename(displayPath);

  return (
    <Overlay onClick={() => !busy && _savePdfDialogCancel()}>
      <Shell onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="save-pdf-title">
        <Header>
          <HeaderTop>
            <HeaderIcon aria-hidden>📄</HeaderIcon>
            <HeaderText>
              <Title id="save-pdf-title">{state.title || 'Αποθήκευση αναφοράς PDF'}</Title>
              {state.subtitle ? <Subtitle>{state.subtitle}</Subtitle> : null}
            </HeaderText>
          </HeaderTop>
        </Header>

        <Body>
          {isOverwrite ? (
            <OverwritePanel>
              <OverwriteTitle>
                <span aria-hidden>⚠️</span>
                Το αρχείο υπάρχει ήδη
              </OverwriteTitle>
              <OverwriteText>
                Υπάρχει ήδη αρχείο με αυτό το όνομα στον επιλεγμένο φάκελο.
                Θέλετε να αντικατασταθεί με τη νέα αναφορά;
              </OverwriteText>
              <OverwriteFile>{displayName}</OverwriteFile>
            </OverwritePanel>
          ) : (
            <>
              <Field>
                <Label>Φάκελος αποθήκευσης</Label>
                <FolderRow>
                  <FolderPath title={folder}>{folder || '—'}</FolderPath>
                  <BrowseBtn type="button" onClick={handleBrowse} disabled={busy}>
                    Αναζήτηση
                  </BrowseBtn>
                </FolderRow>
              </Field>
              <Field>
                <Label>Όνομα αρχείου</Label>
                <FilenameInput
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  disabled={busy}
                  autoFocus
                />
              </Field>
            </>
          )}
        </Body>

        <Footer>
          {isOverwrite ? (
            <>
              <CancelBtn type="button" onClick={handleBackToForm} disabled={busy}>
                Πίσω
              </CancelBtn>
              <CancelBtn type="button" onClick={_savePdfDialogCancel} disabled={busy}>
                Άκυρο
              </CancelBtn>
              <DangerBtn type="button" onClick={handleOverwrite} disabled={busy}>
                Αντικατάσταση
              </DangerBtn>
            </>
          ) : (
            <>
              <CancelBtn type="button" onClick={_savePdfDialogCancel} disabled={busy}>
                Άκυρο
              </CancelBtn>
              <PrimaryBtn type="button" onClick={handleSave} disabled={busy || !folder?.trim()}>
                {busy ? 'Έλεγχος…' : 'Αποθήκευση'}
              </PrimaryBtn>
            </>
          )}
        </Footer>
      </Shell>
    </Overlay>
  );
}
