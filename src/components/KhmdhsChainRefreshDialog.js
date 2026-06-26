import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 14px;
  width: min(480px, 100%);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1rem 1.2rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1rem;
  color: #0f172a;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.2rem;
`;

const List = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  color: #334155;
  font-size: 0.84rem;
  line-height: 1.55;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.2rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
`;

const CancelBtn = styled(Btn)`
  background: #e2e8f0;
  color: #475569;
`;

const ConfirmBtn = styled(Btn)`
  background: linear-gradient(135deg, #4338ca, #6366f1);
  color: #fff;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default function KhmdhsChainRefreshDialog({
  isOpen,
  onClose,
  onConfirm,
  saving = false,
  seedLabel,
  seedAdam,
  changeLines = [],
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Dialog onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Header>
          <Title>Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ</Title>
          <Sub>
            Ανάκτηση από {seedLabel || 'αλυσίδα'} · ΑΔΑΜ <strong>{seedAdam}</strong>
          </Sub>
        </Header>
        <Body>
          <Sub style={{ marginBottom: '0.65rem', color: '#475569' }}>Αλλαγές που θα εφαρμοστούν:</Sub>
          <List>
            {changeLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </List>
        </Body>
        <Footer>
          <CancelBtn type="button" onClick={onClose} disabled={saving}>Άκυρο</CancelBtn>
          <ConfirmBtn type="button" onClick={onConfirm} disabled={saving}>
            {saving ? 'Αποθήκευση…' : 'Εφαρμογή & αποθήκευση'}
          </ConfirmBtn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
