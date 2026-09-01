import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { _registerConfirmModal, _confirmYes, _confirmNo } from '../utils/confirmModal';

/* ─── Animations ────────────────────────────────────────────────────────── */
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.92) translateY(-8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
`;

/* ─── Styled components ─────────────────────────────────────────────────── */
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
  max-width: 420px;
  width: 100%;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.18),
    0 4px 16px rgba(0, 0, 0, 0.08);
  animation: ${popIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1);
`;

const TopRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const IconBadge = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.$danger ? '#fee2e2' : '#fffbeb')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
`;

const TextBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.35rem;
`;

const Message = styled.div`
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.55;
  word-break: break-word;
`;

const Detail = styled.div`
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.5;
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
`;

const CancelBtn = styled.button`
  padding: 0.52rem 1.15rem;
  border-radius: 9px;
  border: 1.5px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
  }
`;

const ConfirmBtn = styled.button`
  padding: 0.52rem 1.15rem;
  border-radius: 9px;
  border: none;
  background: ${(p) => (p.$danger ? '#ef4444' : '#6366f1')};
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: ${(p) => (p.$danger ? '#dc2626' : '#4f46e5')};
    box-shadow: ${(p) =>
      p.$danger
        ? '0 3px 10px rgba(239, 68, 68, 0.35)'
        : '0 3px 10px rgba(99, 102, 241, 0.35)'};
  }
`;

/* ─── Component ─────────────────────────────────────────────────────────── */
const CLOSED = { open: false };

export default function ConfirmModal() {
  const [state, setState] = useState(CLOSED);

  useEffect(() => {
    _registerConfirmModal(setState);
  }, []);

  const handleKey = useCallback((e) => {
    if (!state.open) return;
    if (e.key === 'Enter')  _confirmYes();
    if (e.key === 'Escape') _confirmNo();
  }, [state.open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!state.open) return null;

  const { title, message, detail, confirmLabel, cancelLabel, danger, icon } = state;

  return (
    <Overlay onClick={_confirmNo}>
      <Card onClick={(e) => e.stopPropagation()}>
        <TopRow>
          <IconBadge $danger={danger}>{icon}</IconBadge>
          <TextBlock>
            <Title>{title}</Title>
            <Message>{message}</Message>
            {detail && <Detail>{detail}</Detail>}
          </TextBlock>
        </TopRow>
        <Divider />
        <Actions>
          <CancelBtn data-testid="confirm-no" onClick={_confirmNo}>{cancelLabel}</CancelBtn>
          <ConfirmBtn $danger={danger} data-testid="confirm-yes" onClick={_confirmYes}>
            {confirmLabel}
          </ConfirmBtn>
        </Actions>
      </Card>
    </Overlay>
  );
}
