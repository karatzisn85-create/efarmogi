import React, { useMemo, useState, useRef, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  getUnresolvedReviewItems,
  KHMDHS_REVIEW_STATUS,
  getReviewItemUserGuide,
  sortReviewItemsByUserPriority,
  reviewItemKey,
} from '../utils/khmdhsDataQualityReport';

// ── Animations ────────────────────────────────────────────────────────────────

const pulseOrange = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.55), 0 4px 16px rgba(234, 88, 12, 0.35); }
  50%       { box-shadow: 0 0 0 10px rgba(234, 88, 12, 0), 0 4px 16px rgba(234, 88, 12, 0.5); }
`;

const pulseRed = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6), 0 4px 18px rgba(220, 38, 38, 0.45); }
  50%       { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0), 0 4px 18px rgba(220, 38, 38, 0.55); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(12px) scale(0.96); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
`;

// ── Styled ────────────────────────────────────────────────────────────────────

const FabWrap = styled.div`
  position: absolute;
  right: -22px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none;
`;

const FabBtn = styled.button`
  pointer-events: all;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  width: 44px;
  border: none;
  border-radius: 14px;
  padding: 0.5rem 0.35rem;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.18s ease, opacity 0.18s ease;
  outline: none;

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.96); }
  &:focus-visible { outline: 2px solid rgba(255,255,255,0.8); outline-offset: 2px; }

  ${(p) => p.$count >= 4 && css`
    background: linear-gradient(160deg, #ef4444 0%, #dc2626 100%);
    color: #fff;
    animation: ${pulseRed} 1.8s ease-in-out infinite;
  `}
  ${(p) => p.$count >= 1 && p.$count < 4 && css`
    background: linear-gradient(160deg, #f97316 0%, #ea580c 100%);
    color: #fff;
    animation: ${pulseOrange} 2s ease-in-out infinite;
  `}
`;

const FabIcon = styled.span`
  font-size: 1.15rem;
  line-height: 1;
`;

const FabBadge = styled.span`
  font-size: 0.72rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
`;

const FabLabel = styled.span`
  font-size: 0.52rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
  opacity: 0.9;
`;

const Panel = styled.div`
  pointer-events: all;
  position: absolute;
  right: 52px;
  top: 50%;
  transform: translateY(-50%);
  width: 360px;
  max-height: 520px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(234, 88, 12, 0.2);
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(234, 88, 12, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${slideIn} 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 10;
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem 0.55rem;
  background: linear-gradient(135deg, #fff7ed 0%, #fff 100%);
  flex-shrink: 0;
`;

const PanelTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #9a3412;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const PanelSub = styled.div`
  padding: 0 0.85rem 0.5rem;
  font-size: 0.67rem;
  line-height: 1.4;
  color: #64748b;
  background: linear-gradient(135deg, #fff7ed 0%, #fff 100%);
  flex-shrink: 0;
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: rgba(15, 23, 42, 0.07);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.7rem;
  color: #64748b;
  transition: background 0.15s;
  padding: 0;
  flex-shrink: 0;

  &:hover { background: rgba(15, 23, 42, 0.12); color: #1e293b; }
`;

const ItemList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.35rem 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
`;

const NotifItem = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  width: 100%;
  padding: 0.55rem 0.85rem;
  border: none;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;

  &:last-child { border-bottom: none; }
  &:hover { background: #f0f9ff; }
`;

const ItemIconWrap = styled.span`
  flex-shrink: 0;
  font-size: 1rem;
  line-height: 1.2;
  margin-top: 0.05rem;
`;

const ItemText = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemLabel = styled.div`
  font-size: 0.74rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.35;
`;

const ItemDesc = styled.div`
  font-size: 0.68rem;
  font-weight: 500;
  color: #64748b;
  margin-top: 0.1rem;
  line-height: 1.3;
`;

const ItemCta = styled.span`
  display: inline-flex;
  margin-top: 0.25rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #0369a1;
`;

const PanelFooter = styled.div`
  padding: 0.55rem 0.7rem;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  background: #f8fafc;
  flex-shrink: 0;
`;

const OpenModalBtn = styled.button`
  width: 100%;
  padding: 0.5rem 0.85rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.35);

  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(234, 88, 12, 0.45); }
  &:active { transform: translateY(0); }
`;

const FIELD_KIND_LABELS = {
  contractDate: 'Ημερ. σύμβασης',
  contractAmount: 'Ποσό σύμβασης',
  projectBudget: 'Προϋπολογισμός',
  assignmentProcedure: 'Διαδικασία',
  contractEndDate: 'Λήξη σύμβασης',
  supplementaryDate: 'Ημερ. συμπλ.',
  supplementaryAmount: 'Ποσό συμπλ.',
  paymentsReconciliation: 'Εντάλματα',
  chainKindReview: 'Τύπος σύμβασης',
};

function shortFieldLabel(item) {
  if (FIELD_KIND_LABELS[item.fieldId]) return FIELD_KIND_LABELS[item.fieldId];
  return item.fieldId || 'Πεδίο';
}

/**
 * Κουμπί ειδοποιήσεων μόνο για πραγματικές εκκρεμότητες ελέγχου ΚΗΜΔΗΣ.
 * Οι συνδεδεμένες πράξεις αλυσίδας δεν μετάνε εδώ — βλ. KhmdhsRemovableChainEntries στη φόρμα.
 */
export default function KhmdhsPendingFab({ review, formData, onOpenReview, onClick }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const pendingItems = useMemo(() => {
    if (!review?.hasActionRequired) return [];
    return sortReviewItemsByUserPriority(getUnresolvedReviewItems(review, formData));
  }, [review, formData]);

  const pendingCount = pendingItems.length;

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [open]);

  if (pendingCount === 0) return null;

  const handleFabClick = () => setOpen((v) => !v);

  const handleOpenModal = (itemKey = null) => {
    setOpen(false);
    const safeKey = typeof itemKey === 'string' && itemKey.trim() ? itemKey.trim() : null;
    if (onOpenReview) onOpenReview(safeKey);
    else if (onClick) onClick();
  };

  return (
    <FabWrap ref={panelRef}>
      {open && (
        <Panel>
          <PanelHead>
            <PanelTitle>⚠️ Εκκρεμεί έλεγχος</PanelTitle>
            <CloseBtn
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Κλείσιμο"
            >
              ✕
            </CloseBtn>
          </PanelHead>
          <PanelSub>
            Στοιχεία που χρειάζονται χαρακτηρισμό, συμπλήρωση ή επιβεβαίωση.
            Οι πράξεις της αλυσίδας (παράταση, συμπληρωματική κ.λπ.) δεν είναι εκκρεμότητες.
          </PanelSub>

          <ItemList>
            {pendingItems.map((item) => {
              const guide = getReviewItemUserGuide(item);
              const missing = item.status === KHMDHS_REVIEW_STATUS.MISSING;
              const itemKey = reviewItemKey(item);
              return (
                <NotifItem
                  key={itemKey}
                  type="button"
                  onClick={() => handleOpenModal(itemKey)}
                >
                  <ItemIconWrap>{guide.icon || (missing ? '❌' : '⚠️')}</ItemIconWrap>
                  <ItemText>
                    <ItemLabel>
                      {guide.title || item.label || shortFieldLabel(item)}
                    </ItemLabel>
                    <ItemDesc>
                      {guide.hint || item.message || (missing ? 'Λείπει από ΚΗΜΔΗΣ' : 'Χρειάζεται έλεγχος')}
                    </ItemDesc>
                    <ItemCta>→ {guide.cta || 'Άνοιγμα'}</ItemCta>
                  </ItemText>
                </NotifItem>
              );
            })}
          </ItemList>

          <PanelFooter>
            <OpenModalBtn type="button" onClick={() => handleOpenModal(null)}>
              Άνοιγμα πλήρους ελέγχου ({pendingCount}) →
            </OpenModalBtn>
          </PanelFooter>
        </Panel>
      )}

      <FabBtn
        type="button"
        $count={pendingCount}
        title={open ? 'Κλείσιμο' : `${pendingCount} εκκρεμή — κλικ για λεπτομέρειες`}
        onClick={handleFabClick}
        aria-expanded={open}
        aria-label={`Εκκρεμεί έλεγχος ΚΗΜΔΗΣ — ${pendingCount}`}
      >
        <FabIcon>{open ? '✕' : '⚠️'}</FabIcon>
        {!open && <FabBadge>{pendingCount}</FabBadge>}
        {!open && <FabLabel>έλεγχος</FabLabel>}
      </FabBtn>
    </FabWrap>
  );
}
