import React, { useEffect, useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { safeAlert } from '../utils/safeDialogs';
import { CHAIN_KIND, MOD_AMOUNT_TYPE, computeRunningTotalBeforeChainAdam } from '../utils/khmdhsChainActions';
import { getChainKindFieldProfile, validateChainKindDraft } from '../utils/khmdhsChainKindFields';
import { prefillSupplementaryModAmount } from '../utils/khmdhsSupplementaryAmountLogic';
import { openKhmdhsActOnline } from '../utils/openKhmdhsActOnline';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.98) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100010;
  padding: 1rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  width: min(560px, 96vw);
  max-height: min(calc(100vh - 2rem), 720px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
  animation: ${popIn} 0.22s ease;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.1rem 1.25rem 0.85rem;
  border-bottom: 1px solid rgba(124, 58, 237, 0.15);
  background: linear-gradient(135deg, #f5f3ff 0%, #fff 70%);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  color: #4c1d95;
`;

const Sub = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  color: #5b21b6;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
`;

const Field = styled.div`
  margin-bottom: 0.9rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.3rem;
`;

const Hint = styled.p`
  margin: 0.25rem 0 0.35rem;
  font-size: 0.72rem;
  color: #6b7280;
  line-height: 1.4;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-size: 0.88rem;
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
  }
`;

const Readonly = styled.div`
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  color: #1f2937;
  padding: 0.45rem 0.6rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
`;

const RadioRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: #374151;
  margin-bottom: 0.4rem;
  line-height: 1.4;
  cursor: pointer;
`;

const Validation = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: #b45309;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
`;

const Btn = styled.button`
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-size: 0.84rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$primary ? '#7c3aed' : '#d1d5db')};
  background: ${(p) => (p.$primary ? '#7c3aed' : '#fff')};
  color: ${(p) => (p.$primary ? '#fff' : '#374151')};
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

function chainModAmountPrefill(existingModAmount, enrichedItem, runningTotal = 0) {
  return prefillSupplementaryModAmount(existingModAmount, enrichedItem, runningTotal);
}

/**
 * Φόρμα λεπτομερειών συμπληρωματικής σύμβασης — ανοίγει μετά τον χαρακτηρισμό ως τροποποίηση.
 */
export default function KhmdhsSupplementaryDetailsModal({
  isOpen,
  enrichedItem,
  existingChoice,
  formData = null,
  review = null,
  onClose,
  onSubmit,
}) {
  const adam = enrichedItem?.chainAdam || enrichedItem?.adam || '';
  const runningTotal = computeRunningTotalBeforeChainAdam(formData, review, enrichedItem);
  const profile = getChainKindFieldProfile(CHAIN_KIND.MODIFICATION, {
    hasKhmdhsAmount: enrichedItem?.hasAmount,
    hasKhmdhsDate: enrichedItem?.hasKhmdhsDate,
  });

  const [modAmountType, setModAmountType] = useState(
    () => existingChoice?.modAmountType || MOD_AMOUNT_TYPE.DELTA
  );
  const [modAmount, setModAmount] = useState(
    () => chainModAmountPrefill(existingChoice?.modAmount, enrichedItem, runningTotal)
  );
  const [modDate, setModDate] = useState(
    () => existingChoice?.modDate || enrichedItem?.contractDateIso || ''
  );
  const [note, setNote] = useState(() => existingChoice?.note || '');

  useEffect(() => {
    if (!isOpen) return undefined;
    setModAmountType(existingChoice?.modAmountType || MOD_AMOUNT_TYPE.DELTA);
    setModAmount(chainModAmountPrefill(existingChoice?.modAmount, enrichedItem, runningTotal));
    setModDate(existingChoice?.modDate || enrichedItem?.contractDateIso || '');
    setNote(existingChoice?.note || '');
  }, [isOpen, existingChoice, enrichedItem, runningTotal]);

  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll('khmdhs-supp-details');
    return () => unlockBodyScroll('khmdhs-supp-details');
  }, [isOpen]);

  const validation = useMemo(
    () => validateChainKindDraft({
      kind: CHAIN_KIND.MODIFICATION,
      modAmount,
      modAmountType,
      modDate,
      hasKhmdhsAmount: enrichedItem?.hasAmount,
      hasKhmdhsDate: enrichedItem?.hasKhmdhsDate,
    }),
    [modAmount, modAmountType, modDate, enrichedItem]
  );

  if (!isOpen || !enrichedItem) return null;

  const handleSubmit = () => {
    if (!validation.ok || !onSubmit) return;
    onSubmit({
      kind: CHAIN_KIND.MODIFICATION,
      correctsAdam: null,
      correctsParts: [],
      modAmountType: modAmountType || MOD_AMOUNT_TYPE.DELTA,
      modAmount,
      modDate: enrichedItem.hasKhmdhsDate
        ? (modDate || enrichedItem.contractDateIso || '')
        : modDate,
      endDate: '',
      note,
    });
  };

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <Card role="dialog" aria-modal="true" aria-labelledby="supp-details-title">
        <Header>
          <Title id="supp-details-title">Στοιχεία συμπληρωματικής σύμβασης</Title>
          <Sub>
            {profile?.hint || 'Συμπληρώστε τα στοιχεία από το έγγραφο της συμπληρωματικής σύμβασης.'}
          </Sub>
        </Header>

        <Body>
          <Field>
            <Label>ΑΔΑΜ</Label>
            <Readonly>{adam || '—'}</Readonly>
            {adam ? (
              <Hint>
                <Btn
                  type="button"
                  style={{ marginTop: '0.35rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={async () => {
                    const res = await openKhmdhsActOnline(adam);
                    if (res?.success === false && res?.error) safeAlert(res.error);
                  }}
                >
                  Προβολή στο ΚΗΜΔΗΣ
                </Btn>
              </Hint>
            ) : null}
          </Field>

          {enrichedItem.title ? (
            <Field>
              <Label>Τίτλος (από ΚΗΜΔΗΣ)</Label>
              <Readonly>{enrichedItem.title}</Readonly>
            </Field>
          ) : null}

          <Field>
            <Label>
              Ημερομηνία συμπληρωματικής
              {enrichedItem.hasKhmdhsDate ? ' (επιβεβαιώστε ή διορθώστε)' : ' *'}
            </Label>
            <Input
              type="date"
              value={(modDate || '').slice(0, 10)}
              onChange={(e) => setModDate(e.target.value)}
            />
            {enrichedItem.hasKhmdhsDate && enrichedItem.contractDateIso ? (
              <Hint>Από ΚΗΜΔΗΣ: {enrichedItem.contractDateIso.slice(0, 10)}</Hint>
            ) : null}
          </Field>

          <Field>
            <Label>
              Ποσό (με ΦΠΑ) *
              {enrichedItem.hasAmount && enrichedItem.contractAmountDisplay
                ? ` — από ΚΗΜΔΗΣ: ${enrichedItem.contractAmountDisplay} €`
                : ''}
            </Label>
            <Input
              type="text"
              value={modAmount}
              onChange={(e) => setModAmount(e.target.value)}
              placeholder="π.χ. 74.155,85"
            />
          </Field>

          <Field>
            <Label>Το ποσό που συμπληρώσατε είναι: *</Label>
            <Hint>
              «Διαφορά» = μόνο το ποσό της συμπληρωματικής (προστίθεται στο υπάρχον σύνολο).
              «Νέο σύνολο» = η εφαρμογή υπολογίζει τη διαφορά από το τρέχον σύνολο.
            </Hint>
            <RadioRow>
              <input
                type="radio"
                name="supp-modamt"
                checked={modAmountType === MOD_AMOUNT_TYPE.DELTA}
                onChange={() => setModAmountType(MOD_AMOUNT_TYPE.DELTA)}
              />
              <span>Αύξηση / μείωση (διαφορά που προστίθεται στο σύνολο)</span>
            </RadioRow>
            <RadioRow>
              <input
                type="radio"
                name="supp-modamt"
                checked={modAmountType === MOD_AMOUNT_TYPE.TOTAL}
                onChange={() => setModAmountType(MOD_AMOUNT_TYPE.TOTAL)}
              />
              <span>Νέα συνολική αξία της σύμβασης</span>
            </RadioRow>
          </Field>

          <Field>
            <Label>Σχόλιο (προαιρετικό)</Label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="π.χ. αιτιολογία / παρατήρηση"
            />
          </Field>

          {!validation.ok && validation.message ? (
            <Validation>{validation.message}</Validation>
          ) : null}
        </Body>

        <Footer>
          <Btn type="button" onClick={onClose}>Ακύρωση</Btn>
          <Btn type="button" $primary onClick={handleSubmit} disabled={!validation.ok}>
            Αποθήκευση συμπληρωματικής
          </Btn>
        </Footer>
      </Card>
    </Overlay>
  );
}
