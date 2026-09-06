import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import managedFiles from '../../app/core/managedFiles';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.93); }
  to   { opacity: 1; transform: scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200000;
  padding: 1rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 18px;
  padding: 1.75rem 2rem 1.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  animation: ${popIn} 0.2s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Title = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.35rem;
`;

const Hint = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.85rem;
  line-height: 1.45;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.8rem;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  font-family: inherit;
  &:focus { outline: none; border-color: #6366f1; }
`;

const ExtHint = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
  margin-top: 0.4rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  margin-top: 1.1rem;
`;

const GhostBtn = styled.button`
  padding: 0.52rem 1.15rem;
  border-radius: 9px;
  border: 1.5px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  &:hover { background: #f8fafc; color: #1e293b; }
`;

const SaveBtn = styled.button`
  padding: 0.52rem 1.15rem;
  border-radius: 9px;
  border: none;
  background: #6366f1;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  &:hover { background: #4f46e5; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function FileRenameModal({ currentName, onClose, onSave, busy = false }) {
  const parts = managedFiles.splitFileName(currentName);
  const [stem, setStem] = useState(parts.stem);
  const inputRef = useRef(null);

  useEffect(() => {
    setStem(managedFiles.splitFileName(currentName).stem);
  }, [currentName]);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [currentName]);

  const submit = () => {
    if (busy) return;
    onSave(stem);
  };

  return (
    <Overlay data-testid="file-rename-modal" onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Title>Μετονομασία αρχείου</Title>
        <Hint>Τρέχον όνομα: «{currentName}»</Hint>
        <Input
          ref={inputRef}
          data-testid="file-rename-input"
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Νέο όνομα"
        />
        {parts.ext ? (
          <ExtHint>Η κατάληξη {parts.ext} θα διατηρηθεί αυτόματα.</ExtHint>
        ) : null}
        <Actions>
          <GhostBtn type="button" onClick={onClose} disabled={busy}>Άκυρο</GhostBtn>
          <SaveBtn type="button" data-testid="file-rename-save" onClick={submit} disabled={busy || !stem.trim()}>
            Αποθήκευση
          </SaveBtn>
        </Actions>
      </Card>
    </Overlay>
  );
}

export default FileRenameModal;
