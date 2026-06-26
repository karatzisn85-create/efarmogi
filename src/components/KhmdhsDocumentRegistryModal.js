import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import KhmdhsDocumentRegistryChainView from './KhmdhsDocumentRegistryChainView';

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
  width: min(680px, 100%);
  max-height: min(90vh, 720px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  min-height: 0;
`;

const Header = styled.div`
  padding: 0.9rem 1.1rem 0.7rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0 0 0.3rem;
  font-size: 1rem;
  color: #0f172a;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.76rem;
  color: #64748b;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 0.75rem 1.1rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const Footer = styled.div`
  padding: 0.7rem 1.1rem 0.95rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  flex-shrink: 0;
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.8rem;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: #6366f1;
  color: #fff;

  &:hover:not(:disabled) {
    background: #4f46e5;
  }
`;

const GhostBtn = styled(Btn)`
  background: #f1f5f9;
  color: #475569;

  &:hover {
    background: #e2e8f0;
  }
`;

const SelectAllBtn = styled.button`
  border: none;
  background: transparent;
  color: #6366f1;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  font-family: inherit;

  &:hover {
    text-decoration: underline;
  }
`;

const NeverAskLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.32rem;
  font-size: 0.7rem;
  color: #64748b;
  cursor: pointer;
  user-select: none;
`;

function KhmdhsDocumentRegistryModal({
  isOpen,
  candidates = [],
  existing = [],
  onConfirm,
  onDismiss,
}) {
  const [selected, setSelected] = useState(new Set());
  const [neverAsk, setNeverAsk] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set((candidates || []).map((c) => c.adam)));
    setNeverAsk(false);
  }, [isOpen, candidates]);

  if (!isOpen || !candidates.length) return null;

  const toggle = (adam) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(adam)) next.delete(adam);
      else next.add(adam);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(candidates.map((c) => c.adam)));
  const selectNone = () => setSelected(new Set());
  const selectedList = candidates.filter((c) => selected.has(c.adam));

  return (
    <Overlay
      data-khmdhs-document-registry-modal
      onClick={(e) => e.target === e.currentTarget && onDismiss?.()}
    >
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Καταγραφή εγγράφων ΚΗΜΔΗΣ</Title>
          <Sub>
            Επιλέξτε ποιοι κρίκοι της αλυσίδας θα καταγραφούν — μετά τους χαρακτηρισμούς που ορίσατε.
            Το «Προβολή» ανοίγει το PDF μέσα στην εφαρμογή. Αποθηκεύστε το υποέργο μετά την επιβεβαίωση.
          </Sub>
        </Header>

        <Body>
          <KhmdhsDocumentRegistryChainView
            entries={candidates}
            selectable
            selected={selected}
            onToggle={toggle}
            existing={existing}
            showHeader={false}
          />
        </Body>

        <Footer>
          <FooterLeft>
            <SelectAllBtn type="button" onClick={selectAll}>Όλα</SelectAllBtn>
            <SelectAllBtn type="button" onClick={selectNone}>Κανένα</SelectAllBtn>
            <NeverAskLabel>
              <input
                type="checkbox"
                checked={neverAsk}
                onChange={(e) => setNeverAsk(e.target.checked)}
              />
              Μην ξαναρωτήσεις
            </NeverAskLabel>
          </FooterLeft>
          <FooterRight>
            <GhostBtn type="button" onClick={onDismiss}>Όχι τώρα</GhostBtn>
            <PrimaryBtn
              type="button"
              disabled={!selectedList.length}
              onClick={() => onConfirm?.(selectedList, neverAsk)}
            >
              Καταγραφή ({selectedList.length})
            </PrimaryBtn>
          </FooterRight>
        </Footer>
      </Dialog>
    </Overlay>
  );
}

export default KhmdhsDocumentRegistryModal;
