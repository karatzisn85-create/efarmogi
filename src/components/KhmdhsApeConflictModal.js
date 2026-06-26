import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001;
  padding: 1.25rem;
  animation: ${fadeIn} 0.2s ease;
`;

const Card = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 18px;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
  animation: ${popIn} 0.26s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  padding: 1.35rem 1.5rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
`;

const Sub = styled.p`
  margin: 0.45rem 0 0;
  font-size: 0.85rem;
  opacity: 0.92;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1.25rem 1.5rem;
`;

const CompareGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`;

const CompareBox = styled.div`
  border-radius: 12px;
  padding: 0.85rem 1rem;
  border: 1px solid ${(p) => (p.$highlight ? 'rgba(99, 102, 241, 0.45)' : 'rgba(148, 163, 184, 0.35)')};
  background: ${(p) => (p.$highlight ? '#eef2ff' : '#f8fafc')};
`;

const CompareLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-bottom: 0.35rem;
`;

const CompareValue = styled.div`
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  padding: 0 1.5rem 1.35rem;
  justify-content: flex-end;
`;

const Btn = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
`;

const GhostBtn = styled(Btn)`
  background: #fff;
  color: #475569;
  border: 1.5px solid #cbd5e1;
`;

export default function KhmdhsApeConflictModal({
  isOpen,
  currentAmount = '',
  khmdhsAmount = '',
  contractLabel = '',
  onAcceptKhmdhs,
  onKeepCurrent,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <Card role="dialog" aria-modal="true" aria-labelledby="ape-conflict-title">
        <Header>
          <Title id="ape-conflict-title">Ανίχνευση ΑΠΕ από ΚΗΜΔΗΣ</Title>
          <Sub>
            {contractLabel
              ? `Για ${contractLabel}, βρέθηκε ποσό από τροποποιήσεις αλυσίδας που μπορεί να αντιστοιχεί σε ΑΠΕ.`
              : 'Βρέθηκε ποσό από την αλυσίδα ΚΗΜΔΗΣ που μπορεί να αντιστοιχεί σε ΑΠΕ.'}
            {' '}Επιλέξτε τι θα καταχωρηθεί.
          </Sub>
        </Header>
        <Body>
          <CompareGrid>
            <CompareBox>
              <CompareLabel>Τρέχον ΑΠΕ (δικό σας)</CompareLabel>
              <CompareValue>{currentAmount || '—'}</CompareValue>
            </CompareBox>
            <CompareBox $highlight>
              <CompareLabel>Από ΚΗΜΔΗΣ</CompareLabel>
              <CompareValue>{khmdhsAmount || '—'}</CompareValue>
            </CompareBox>
          </CompareGrid>
        </Body>
        <Footer>
          <GhostBtn type="button" onClick={onClose}>Ακύρωση</GhostBtn>
          <GhostBtn type="button" onClick={onKeepCurrent}>Διατήρηση τρέχοντος</GhostBtn>
          <PrimaryBtn type="button" onClick={onAcceptKhmdhs}>Ενημέρωση από ΚΗΜΔΗΣ</PrimaryBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
