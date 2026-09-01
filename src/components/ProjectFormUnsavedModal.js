import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.94) translateY(-10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13050;
  padding: 1rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 18px;
  padding: 1.65rem 1.75rem 1.35rem;
  max-width: 440px;
  width: 100%;
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.22),
    0 0 0 1px rgba(148, 163, 184, 0.18);
  animation: ${popIn} 0.24s cubic-bezier(0.16, 1, 0.3, 1);
`;

const TopRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.95rem;
  margin-bottom: 1.1rem;
`;

const IconBadge = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
`;

const TextBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
`;

const Message = styled.p`
  margin: 0;
  font-size: 0.84rem;
  color: #475569;
  line-height: 1.55;
`;

const Detail = styled.p`
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
`;

const Btn = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.52rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CancelBtn = styled(Btn)`
  background: #f1f5f9;
  color: #475569;

  &:hover {
    background: #e2e8f0;
  }
`;

const DiscardBtn = styled(Btn)`
  background: #fff;
  color: #b91c1c;
  border: 1.5px solid #fecaca;

  &:hover {
    background: #fef2f2;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12);
  }
`;

const SaveBtn = styled(Btn)`
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);

  &:hover {
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.42);
  }
`;

export default function ProjectFormUnsavedModal({
  isOpen,
  isNewProject = false,
  onCancel,
  onDiscard,
  onSave,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <Overlay
      data-project-form-unsaved-modal
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <Card onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="project-form-unsaved-title">
        <TopRow>
          <IconBadge aria-hidden>💾</IconBadge>
          <TextBlock>
            <Title id="project-form-unsaved-title">Μη αποθηκευμένες αλλαγές</Title>
            <Message>
              {isNewProject
                ? 'Έχετε συμπληρώσει στοιχεία στο νέο υποέργο που δεν έχουν αποθηκευτεί ακόμα.'
                : 'Έχετε αλλαγές στο υποέργο που δεν έχουν αποθηκευτεί ακόμα.'}
            </Message>
          </TextBlock>
        </TopRow>
        <Detail>
          {isNewProject
            ? 'Αποθηκεύστε για να κρατήσετε τα δεδομένα, ή απορρίψτε για να κλείσετε τη φόρμα χωρίς να δημιουργηθεί υποέργο.'
            : 'Αποθηκεύστε για να εφαρμοστούν οι αλλαγές, ή απορρίψτε για να κλείσετε τη φόρμα χωρίς να τροποποιηθεί το υποέργο.'}
        </Detail>
        <Footer>
          <CancelBtn type="button" data-testid="unsaved-stay" onClick={onCancel}>
            Συνέχεια επεξεργασίας
          </CancelBtn>
          <DiscardBtn type="button" data-testid="unsaved-discard" onClick={onDiscard}>
            Απόρριψη αλλαγών
          </DiscardBtn>
          <SaveBtn type="button" onClick={onSave}>
            Αποθήκευση
          </SaveBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
