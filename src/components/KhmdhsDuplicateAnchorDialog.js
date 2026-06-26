import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  z-index: 12600;
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
  border-bottom: 1px solid #fecaca;
  background: #fef2f2;
`;

const Title = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1rem;
  color: #991b1b;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: #7f1d1d;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.2rem;
`;

const List = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  color: #334155;
  font-size: 0.84rem;
  line-height: 1.5;
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
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #fff;
`;

export default function KhmdhsDuplicateAnchorDialog({
  isOpen,
  conflict,
  onConfirm,
  onCancel,
}) {
  if (!isOpen || !conflict) return null;

  const projects = conflict.projects || [];

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Ίδια σύνδεση ΚΗΜΔΗΣ σε άλλο υποέργο</Title>
          <Sub>{conflict.message}</Sub>
        </Header>
        <Body>
          <div style={{ fontSize: '0.82rem', color: '#475569' }}>
            ΑΔΑΜ: <strong>{conflict.adam}</strong>
          </div>
          {projects.length > 0 ? (
            <List>
              {projects.map((p) => (
                <li key={p.subprojectId}>{p.subprojectTitle || p.projectTitle || '—'}</li>
              ))}
            </List>
          ) : null}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Συνήθως κάθε υποέργο πρέπει να έχει δικό του κλάδο. Συνεχίζετε μόνο αν είστε σίγουροι.
          </p>
        </Body>
        <Footer>
          <CancelBtn type="button" onClick={onCancel}>Ακύρωση</CancelBtn>
          <ConfirmBtn type="button" onClick={onConfirm}>Συνέχεια ούτως ή άλλως</ConfirmBtn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
