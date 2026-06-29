import React from 'react';
import styled from 'styled-components';
import { buildKhmdhsContractExpiryPromptMessage } from '../utils/khmdhsContractExpiryPrompt';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 12750;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 12px;
  width: min(520px, 100%);
  padding: 1.1rem 1.2rem 1rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
`;

const Title = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: #0f172a;
`;

const Badge = styled.span`
  display: inline-block;
  margin-bottom: 0.65rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: #ecfdf5;
  color: #047857;
`;

const Body = styled.p`
  margin: 0 0 0.85rem;
  font-size: 0.8rem;
  line-height: 1.55;
  color: #475569;
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
  background: #059669;
  color: #fff;
`;

export default function KhmdhsContractExpiryPromptDialog({
  isOpen,
  prompt = null,
  onDismiss,
  onAccept,
}) {
  if (!isOpen || !prompt) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onDismiss?.()}>
      <Dialog onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Title>Λήξη σύμβασης — πρόταση κατάστασης</Title>
        <Badge>Ενημέρωση από ΚΗΜΔΗΣ</Badge>
        <Body>{buildKhmdhsContractExpiryPromptMessage(prompt)}</Body>
        <Actions>
          <CancelBtn type="button" onClick={onDismiss}>Όχι, τώρα όχι</CancelBtn>
          <ConfirmBtn type="button" onClick={onAccept}>Ναι, ορισμός ως Ολοκληρωμένο</ConfirmBtn>
        </Actions>
      </Dialog>
    </Overlay>
  );
}
