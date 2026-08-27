import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { openKhmdhsActOnline } from '../utils/openKhmdhsActOnline';
import {
  enrichRejectedBranchCandidates,
  KHMDHS_RELATED_DOCS_SECTION_TITLE,
} from '../utils/khmdhsRelatedDocuments';
import { KHMDHS_REGISTRY_STAGE_META } from '../utils/khmdhsDocumentRegistry';
import { useToast } from './ToastProvider';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  z-index: 12650;
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

const Item = styled.div`
  border: 1px solid ${(p) => (p.$selected ? '#c7d2fe' : '#e2e8f0')};
  background: ${(p) => (p.$selected ? '#fafbff' : '#fff')};
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.55rem;
`;

const ItemTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
`;

const Badge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: ${KHMDHS_REGISTRY_STAGE_META.RELATED.bg};
  color: ${KHMDHS_REGISTRY_STAGE_META.RELATED.color};
  flex-shrink: 0;
`;

const AdamText = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  font-family: ui-monospace, monospace;
`;

const DocTitle = styled.div`
  margin-top: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.35;
`;

const MetaLine = styled.div`
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: #64748b;
`;

const LabelField = styled.label`
  display: block;
  margin-top: 0.55rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #475569;
`;

const LabelInput = styled.input`
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 0.38rem 0.55rem;
  font-size: 0.76rem;
  font-family: inherit;
  color: #0f172a;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;

const ViewBtn = styled.button`
  margin-top: 0.45rem;
  border: 1px solid #6366f1;
  background: #eef2ff;
  color: #4338ca;
  border-radius: 7px;
  padding: 0.28rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: #e0e7ff;
  }
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

export default function KhmdhsRelatedDocumentsModal({
  isOpen,
  candidates = [],
  seedChainRes = null,
  previews = {},
  onConfirm,
  onDismiss,
}) {
  const { showToast } = useToast();
  const enriched = useMemo(
    () => enrichRejectedBranchCandidates(candidates, seedChainRes, { previews }),
    [candidates, seedChainRes, previews]
  );

  const [selected, setSelected] = useState(new Set());
  const [labels, setLabels] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    const adams = enriched.map((e) => e.candidate.adam);
    setSelected(new Set(adams));
    const initial = {};
    enriched.forEach((e) => {
      initial[e.candidate.adam] = e.suggestedLabel;
    });
    setLabels(initial);
  }, [isOpen, enriched]);

  if (!isOpen || !enriched.length) return null;

  const toggle = (adam) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(adam)) next.delete(adam);
      else next.add(adam);
      return next;
    });
  };

  const handleView = async (adam) => {
    const res = await openKhmdhsActOnline(adam);
    if (!res?.success && res?.error) showToast(res.error, 'error');
  };

  const handleConfirm = () => {
    const picked = enriched
      .filter((e) => selected.has(e.candidate.adam))
      .map((e) => ({
        candidate: e.candidate,
        preview: e.preview,
        linkLabel: labels[e.candidate.adam] || e.suggestedLabel,
      }));
    onConfirm?.(picked);
  };

  return (
    <Overlay
      data-khmdhs-related-docs-modal
      onClick={(e) => e.target === e.currentTarget && onDismiss?.()}
    >
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{KHMDHS_RELATED_DOCS_SECTION_TITLE}</Title>
          <Sub>
            Τα παρακάτω έγγραφα δεν είναι η κύρια σύμβαση του υποέργου. Μπορείτε να τα
            καταγράψετε ως σχετικά (online αναφορά στα Αρχεία Υποέργου) με όνομα που επιλέγετε εσείς.
            Αποθηκεύστε το υποέργο μετά την επιβεβαίωση.
          </Sub>
        </Header>

        <Body>
          {enriched.map(({ candidate, preview, suggestedLabel }) => {
            const isOn = selected.has(candidate.adam);
            const meta = [
              candidate.amount,
              preview?.summary?.signedDate || preview?.summary?.awardDate,
            ].filter(Boolean).join(' · ');

            return (
              <Item key={candidate.adam} $selected={isOn}>
                <ItemTop>
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(candidate.adam)}
                    aria-label={`Καταγραφή ${candidate.adam}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <Badge>Σχετικό</Badge>
                      <AdamText>{candidate.adam}</AdamText>
                    </div>
                    {(candidate.title || preview?.summary?.title) && (
                      <DocTitle>{candidate.title || preview?.summary?.title}</DocTitle>
                    )}
                    {meta && <MetaLine>{meta}</MetaLine>}
                    <LabelField>
                      Όνομα καταγραφής
                      <LabelInput
                        type="text"
                        value={labels[candidate.adam] ?? suggestedLabel}
                        disabled={!isOn}
                        onChange={(e) => setLabels((prev) => ({
                          ...prev,
                          [candidate.adam]: e.target.value,
                        }))}
                        placeholder={suggestedLabel}
                      />
                    </LabelField>
                    <ViewBtn type="button" onClick={() => handleView(candidate.adam)}>
                      Προβολή
                    </ViewBtn>
                  </div>
                </ItemTop>
              </Item>
            );
          })}
        </Body>

        <Footer>
          <GhostBtn type="button" onClick={onDismiss}>Όχι τώρα</GhostBtn>
          <FooterRight>
            <PrimaryBtn
              type="button"
              disabled={selected.size === 0}
              onClick={handleConfirm}
            >
              Καταγραφή ({selected.size})
            </PrimaryBtn>
          </FooterRight>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
