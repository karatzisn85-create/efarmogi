import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 12700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 12px;
  width: min(480px, 100%);
  padding: 1.1rem 1.2rem 1rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
`;

const Title = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: #0f172a;
`;

const Body = styled.p`
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: #475569;
`;

const AdamLine = styled.div`
  font-size: 0.72rem;
  font-family: ui-monospace, monospace;
  color: #64748b;
  margin-bottom: 0.85rem;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
`;

const CancelBtn = styled(Btn)`
  background: #e2e8f0;
  color: #475569;
`;

const ConfirmBtn = styled(Btn)`
  background: #4338ca;
  color: #fff;
`;

export default function KhmdhsSupplementaryConfirmDialog({
  isOpen,
  adam = '',
  message = '',
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Title>Επιβεβαίωση συμπληρωματικής</Title>
        <Body>{message}</Body>
        {adam ? <AdamLine>ΑΔΑΜ: {adam}</AdamLine> : null}
        <Actions>
          <CancelBtn type="button" onClick={onCancel}>Όχι, ακύρωση</CancelBtn>
          <ConfirmBtn type="button" onClick={onConfirm}>Ναι, προσθήκη στο υποέργο</ConfirmBtn>
        </Actions>
      </Dialog>
    </Overlay>
  );
}
