import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  _registerFileConflictModal,
  _fileConflictReplace,
  _fileConflictKeepBoth,
  _fileConflictCancel,
} from '../utils/fileConflictDialog';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.92) translateY(-8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
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
  padding: 2rem 2.1rem 1.7rem;
  max-width: 460px;
  width: 100%;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.18),
    0 4px 16px rgba(0, 0, 0, 0.08);
  animation: ${popIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Title = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.45rem;
`;

const Message = styled.div`
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.55;
`;

const FileList = styled.ul`
  margin: 0.75rem 0 0;
  padding: 0 0 0 1.1rem;
  color: #1e293b;
  font-size: 0.85rem;
  font-weight: 600;
  max-height: 8rem;
  overflow-y: auto;
`;

const Divider = styled.div`
  height: 1px;
  background: #f1f5f9;
  margin: 1.2rem 0 1rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  flex-wrap: wrap;
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

const KeepBtn = styled.button`
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
`;

const ReplaceBtn = styled.button`
  padding: 0.52rem 1.15rem;
  border-radius: 9px;
  border: none;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  &:hover { background: #1e293b; }
`;

const CLOSED = { open: false, fileNames: [] };

export default function FileConflictModal() {
  const [state, setState] = useState(CLOSED);

  useEffect(() => {
    _registerFileConflictModal(setState);
  }, []);

  const handleKey = useCallback((e) => {
    if (!state.open) return;
    if (e.key === 'Escape') _fileConflictCancel();
  }, [state.open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!state.open) return null;

  const names = state.fileNames || [];
  const many = names.length > 1;

  return (
    <Overlay data-testid="file-conflict-modal" onClick={_fileConflictCancel}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Title>Το αρχείο υπάρχει ήδη</Title>
        <Message>
          {many
            ? 'Υπάρχουν ήδη αρχεία με αυτά τα ονόματα. Να αντικατασταθούν ή να κρατηθούν και τα δύο;'
            : `Το αρχείο «${names[0] || ''}» υπάρχει ήδη. Να αντικατασταθεί ή να κρατηθούν και τα δύο;`}
        </Message>
        {many && (
          <FileList>
            {names.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
          </FileList>
        )}
        <Divider />
        <Actions>
          <GhostBtn data-testid="file-conflict-cancel" type="button" onClick={_fileConflictCancel}>Άκυρο</GhostBtn>
          <KeepBtn data-testid="file-conflict-keep-both" type="button" onClick={_fileConflictKeepBoth}>
            Κράτα και τα δύο
          </KeepBtn>
          <ReplaceBtn data-testid="file-conflict-replace" type="button" onClick={_fileConflictReplace}>
            Αντικατάσταση
          </ReplaceBtn>
        </Actions>
      </Card>
    </Overlay>
  );
}
