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
  max-width: 640px;
  width: 100%;
  max-height: min(85vh, 720px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
  animation: ${popIn} 0.26s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  padding: 1.25rem 1.5rem;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
`;

const Sub = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.84rem;
  opacity: 0.92;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const Row = styled.div`
  padding: 0.65rem 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.35);

  &:last-child {
    border-bottom: none;
  }
`;

const RowTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.35rem;
`;

const CompareGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
`;

const CompareBox = styled.div`
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  border: 1px solid ${(p) => (p.$highlight ? 'rgba(59, 130, 246, 0.45)' : 'rgba(148, 163, 184, 0.35)')};
  background: ${(p) => (p.$highlight ? '#eff6ff' : '#f8fafc')};
`;

const CompareLabel = styled.div`
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-bottom: 0.2rem;
`;

const CompareValue = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
  word-break: break-word;
`;

const CommentLine = styled.div`
  margin-top: 0.35rem;
  font-size: 0.76rem;
  color: #475569;
  font-style: italic;
`;

const Footer = styled.div`
  display: flex;
  gap: 0.65rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  flex-shrink: 0;
`;

const Btn = styled.button`
  flex: 1;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
`;

const SecondaryBtn = styled(Btn)`
  background: #f1f5f9;
  color: #334155;
  border: 1px solid rgba(148, 163, 184, 0.45);
`;

function displayVal(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

/**
 * Επιβεβαίωση πριν την αποθήκευση όταν υπάρχουν χειροκίνητες αλλαγές σε πεδία ΚΗΜΔΗΣ.
 */
export default function KhmdhsPreSaveOverridesModal({
  isOpen,
  overrides = [],
  onConfirm,
  onCancel,
}) {
  if (!isOpen || !overrides.length) return null;

  return (
    <Overlay onClick={onCancel}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Επιβεβαίωση αποθήκευσης</Title>
          <Sub>
            Έχετε τροποποιήσει {overrides.length} πεδί{overrides.length === 1 ? 'ο' : 'α'} που διαφέρουν από την τελευταία ανάκτηση ΚΗΜΔΗΣ.
            Η αποθήκευση θα κρατήσει τις δικές σας τιμές.
          </Sub>
        </Header>
        <Body>
          {overrides.map((item) => (
            <Row key={item.fieldKey}>
              <RowTitle>{item.label || item.fieldKey}</RowTitle>
              <CompareGrid>
                <CompareBox>
                  <CompareLabel>Από ΚΗΜΔΗΣ</CompareLabel>
                  <CompareValue>{displayVal(item.khmdhsValue)}</CompareValue>
                </CompareBox>
                <CompareBox $highlight>
                  <CompareLabel>Δική σας τιμή</CompareLabel>
                  <CompareValue>{displayVal(item.value)}</CompareValue>
                </CompareBox>
              </CompareGrid>
              {item.comment ? (
                <CommentLine>Σχόλιο: {item.comment}</CommentLine>
              ) : null}
            </Row>
          ))}
        </Body>
        <Footer>
          <SecondaryBtn type="button" onClick={onCancel}>
            Επιστροφή στη φόρμα
          </SecondaryBtn>
          <PrimaryBtn type="button" onClick={onConfirm}>
            Αποθήκευση με τις αλλαγές μου
          </PrimaryBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
