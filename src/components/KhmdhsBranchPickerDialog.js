import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { KHMDHS_BRANCH_ANCHOR_LABELS } from '../utils/khmdhsBranchAnchor';
import {
  buildBranchCandidatePreview,
  formatBranchPreviewSummaryLine,
} from '../utils/khmdhsBranchPickerPreview';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  z-index: 12500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 14px;
  width: min(${(p) => (p.$wide ? '760px' : '560px')}, 100%);
  max-height: min(90vh, 720px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  min-height: 0;
  transition: width 0.2s ease;
`;

const Header = styled.div`
  padding: 1rem 1.2rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
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
  padding: 0.85rem 1.2rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const Option = styled.div`
  border: 2px solid ${(p) => (p.$selected ? '#6366f1' : '#e2e8f0')};
  background: ${(p) => (p.$selected ? '#eef2ff' : '#fff')};
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.5rem;
  transition: border-color 0.15s ease, background 0.15s ease;
`;

const OptionHeader = styled.button`
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
`;

const OptionTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
`;

const Badge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: ${(p) => p.$bg || '#e0e7ff'};
  color: ${(p) => p.$color || '#3730a3'};
`;

const AdamText = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  font-family: ui-monospace, monospace;
`;

const OptionTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.35;
`;

const SummaryLine = styled.div`
  margin-top: 0.35rem;
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
`;

const Suggested = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  color: #059669;
  margin-left: auto;
`;

const PreviewActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.5rem;
`;

const PreviewBtn = styled.button`
  border: 1px solid ${(p) => (p.$open ? '#6366f1' : '#cbd5e1')};
  background: ${(p) => (p.$open ? '#eef2ff' : '#f8fafc')};
  color: ${(p) => (p.$open ? '#4338ca' : '#475569')};
  border-radius: 7px;
  padding: 0.28rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    border-color: #6366f1;
    color: #4338ca;
  }
`;

const PreviewHint = styled.span`
  font-size: 0.65rem;
  color: #94a3b8;
`;

const PreviewBox = styled.div`
  margin-top: 0.55rem;
  border-top: 1px dashed #cbd5e1;
  padding-top: 0.55rem;
`;

const PreviewLoading = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  padding: 0.35rem 0;
`;

const PreviewError = styled.div`
  font-size: 0.72rem;
  color: #b45309;
  padding: 0.35rem 0;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.2rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
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
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const TYPE_BADGE = {
  SYMV: { bg: '#dbeafe', color: '#1d4ed8' },
  PROC: { bg: '#ffedd5', color: '#c2410c' },
  APPROVED_REQ: { bg: '#fef3c7', color: '#b45309' },
  REQ: { bg: '#ede9fe', color: '#6d28d9' },
  AWRD: { bg: '#ecfeff', color: '#0e7490' },
};

function normalizeAdam(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
}

function canReuseSeedChain(seedChainRes, candidate) {
  if (!seedChainRes?.success) return false;
  const seed = normalizeAdam(seedChainRes.chainMeta?.seedAdam);
  const adam = normalizeAdam(candidate?.adam);
  return seed === adam;
}

const AllBranchesOption = styled(Option)`
  border-style: dashed;
  background: ${(p) => (p.$selected ? '#f0fdf4' : '#fff')};
  border-color: ${(p) => (p.$selected ? '#059669' : '#86efac')};
`;

const AllBranchesTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #047857;
  line-height: 1.35;
`;

const AllBranchesSub = styled.div`
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
`;

export default function KhmdhsBranchPickerDialog({
  isOpen,
  candidates = [],
  suggestedAdam = '',
  subprojectTitle = '',
  seedChainRes = null,
  allowsAllBranches = false,
  onConfirm,
  onCancel,
}) {
  const [selectedAdam, setSelectedAdam] = useState(suggestedAdam || candidates[0]?.adam || '');
  const [allBranchesMode, setAllBranchesMode] = useState(false);
  const [expandedAdam, setExpandedAdam] = useState('');
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    if (isOpen) {
      setSelectedAdam(suggestedAdam || candidates[0]?.adam || '');
      setAllBranchesMode(false);
      setExpandedAdam('');
      setPreviews({});
    }
  }, [isOpen, suggestedAdam, candidates]);

  const loadPreview = useCallback(async (candidate) => {
    const adam = candidate?.adam;
    if (!adam) return;
    setPreviews((prev) => ({
      ...prev,
      [adam]: { loading: true, error: null },
    }));
    try {
      let chainRes = null;
      if (canReuseSeedChain(seedChainRes, candidate)) {
        chainRes = seedChainRes;
      } else {
        chainRes = await ipcRenderer.invoke('khmdhs-resolve-adam-chain', { adam });
      }
      const preview = buildBranchCandidatePreview(candidate, chainRes);
      setPreviews((prev) => ({
        ...prev,
        [adam]: { loading: false, ...preview },
      }));
    } catch (e) {
      setPreviews((prev) => ({
        ...prev,
        [adam]: { loading: false, error: e?.message || 'Σφάλμα προεπισκόπησης.' },
      }));
    }
  }, [seedChainRes]);

  useEffect(() => {
    if (!isOpen || !candidates.length) return undefined;
    let cancelled = false;
    (async () => {
      await Promise.all(
        candidates.map(async (candidate) => {
          if (cancelled) return;
          await loadPreview(candidate);
        })
      );
    })();
    return () => { cancelled = true; };
  }, [isOpen, candidates, loadPreview]);

  const togglePreview = (candidate, e) => {
    e?.stopPropagation?.();
    const adam = candidate.adam;
    if (expandedAdam === adam) {
      setExpandedAdam('');
      return;
    }
    setExpandedAdam(adam);
    if (!previews[adam] || previews[adam].error) {
      loadPreview(candidate);
    }
  };

  if (!isOpen || !candidates.length) return null;

  const selected = candidates.find((c) => c.adam === selectedAdam) || candidates[0];
  const hasExpanded = !!expandedAdam;

  return (
    <Overlay
      data-khmdhs-branch-picker-modal
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <Dialog $wide={hasExpanded} onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Ποιο τμήμα αφορά αυτό το υποέργο;</Title>
          <Sub>
            Η ανάκτηση βρήκε περισσότερες από μία δυνατές γραμμές στην ίδια πράξη.
            {subprojectTitle ? ` Επιλέξτε αυτό που αντιστοιχεί στο «${subprojectTitle}».` : ''}
            {' '}Μπορείτε να ανοίξετε την προεπισκόπηση για να δείτε αναδόχο, ποσό και λεπτομέρειες.
          </Sub>
        </Header>
        <Body>
          {allowsAllBranches ? (
            <AllBranchesOption
              $selected={allBranchesMode}
              onClick={() => {
                setAllBranchesMode(true);
                setSelectedAdam('');
              }}
            >
              <AllBranchesTitle>Όλοι οι κλάδοι — πολλές συμβάσεις στο ίδιο υποέργο</AllBranchesTitle>
              <AllBranchesSub>
                Η μορφή υλοποίησης θα οριστεί σε «Πολλές Συμβάσεις» και θα ανακτηθούν όλες οι παράλληλες
                συμβάσεις ({candidates.length}) της ίδιας πράξης.
              </AllBranchesSub>
            </AllBranchesOption>
          ) : null}
          {candidates.map((c) => {
            const badge = TYPE_BADGE[c.type] || TYPE_BADGE.REQ;
            const isSelected = !allBranchesMode && c.adam === selectedAdam;
            const isSuggested = c.adam === suggestedAdam;
            const preview = previews[c.adam];
            const isExpanded = expandedAdam === c.adam;
            const summaryLine = formatBranchPreviewSummaryLine(preview)
              || (c.amount ? `Ποσό: ${c.amount}` : '');

            return (
              <Option key={`${c.type}:${c.adam}`} $selected={isSelected}>
                <OptionHeader type="button" onClick={() => { setAllBranchesMode(false); setSelectedAdam(c.adam); }}>
                  <OptionTop>
                    <Badge $bg={badge.bg} $color={badge.color}>
                      {preview?.summary?.contractType
                        || KHMDHS_BRANCH_ANCHOR_LABELS[c.type]
                        || c.subtitle
                        || c.type}
                    </Badge>
                    <AdamText>{c.adam}</AdamText>
                    {isSuggested ? <Suggested>Πρόταση</Suggested> : null}
                  </OptionTop>
                  {(c.title || preview?.summary?.title) ? (
                    <OptionTitle>{c.title || preview?.summary?.title}</OptionTitle>
                  ) : null}
                  {preview?.loading ? (
                    <SummaryLine>Φόρτωση στοιχείων από ΚΗΜΔΗΣ…</SummaryLine>
                  ) : null}
                  {!preview?.loading && summaryLine ? (
                    <SummaryLine>{summaryLine}</SummaryLine>
                  ) : null}
                  {preview?.summary?.cancelled ? (
                    <SummaryLine style={{ color: '#dc2626', fontWeight: 700 }}>
                      Ματαιωμένη πράξη στο ΚΗΜΔΗΣ
                    </SummaryLine>
                  ) : null}
                </OptionHeader>
                <PreviewActions>
                  <PreviewBtn
                    type="button"
                    $open={isExpanded}
                    onClick={(e) => togglePreview(c, e)}
                  >
                    {isExpanded ? '▲ Απόκρυψη' : '▼ Προβολή λεπτομερειών'}
                  </PreviewBtn>
                  {!isExpanded && !preview?.loading && preview?.groups?.length ? (
                    <PreviewHint>Αναδόχος, ποσό, ημερομηνίες</PreviewHint>
                  ) : null}
                </PreviewActions>
                {isExpanded && (
                  <PreviewBox onClick={(e) => e.stopPropagation()}>
                    {preview?.loading && (
                      <PreviewLoading>Ανακτήθηκαν στοιχεία από ΚΗΜΔΗΣ…</PreviewLoading>
                    )}
                    {preview?.error && !preview?.loading && (
                      <PreviewError>{preview.error}</PreviewError>
                    )}
                    {!preview?.loading && preview?.groups?.length > 0 && (
                      <KhmdhsPanelDisplay
                        themeKey={preview.panelTheme || 'contract'}
                        title={preview.panelTitle || 'Στοιχεία ΚΗΜΔΗΣ'}
                        adam={c.adam}
                        groups={preview.groups}
                        defaultExpanded
                        variant="detail"
                      />
                    )}
                  </PreviewBox>
                )}
              </Option>
            );
          })}
        </Body>
        <Footer>
          <CancelBtn type="button" onClick={onCancel}>Ακύρωση</CancelBtn>
          <ConfirmBtn
            type="button"
            onClick={() => {
              if (allBranchesMode) {
                onConfirm?.(null, { mode: 'all', previews });
                return;
              }
              onConfirm?.(selected, { mode: 'single', previews });
            }}
            disabled={!allBranchesMode && !selected?.adam}
          >
            {allBranchesMode ? 'Όλοι οι κλάδοι' : 'Επιβεβαίωση κλάδου'}
          </ConfirmBtn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
