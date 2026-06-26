import React, { useMemo } from 'react';
import styled from 'styled-components';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsPaymentDisplayGroups,
  buildKhmdhsPaymentsTotals,
  getKhmdhsPaymentEntries,
  projectHasKhmdhsPaymentData,
} from '../utils/khmdhsChainExtraFields';
import { formatKhmdhsEuro } from '../utils/khmdhsNoticeFields';
import { resolveEffectivePayableAmountGrossForPayments } from '../utils/khmdhsFields';

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const TotalsBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem 0.85rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #f0fdfa 0%, #fff 100%);
  border: 1px solid rgba(13, 148, 136, 0.3);
  font-size: 0.8rem;
  color: #0f766e;
  font-weight: 600;
`;

const TotalChip = styled.span`
  display: inline-flex;
  flex-direction: column;
  line-height: 1.25;
`;

const TotalLabel = styled.span`
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  font-weight: 700;
`;

const TotalValue = styled.span`
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f766e;
`;

const CompareNote = styled.span`
  font-size: 0.74rem;
  font-weight: 600;
  color: ${(p) => (p.$warn ? '#b45309' : '#0f766e')};
  flex: 1 1 100%;
  line-height: 1.45;
`;

const InfoNote = styled(CompareNote)`
  color: #0369a1;
`;

const ErrorRow = styled.div`
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.75rem;
  font-weight: 600;
`;

/**
 * @param {{ project: object, variant?: 'detail'|'card' }} props
 */
export default function KhmdhsPaymentsDisplay({ project, variant = 'detail' }) {
  const entries = useMemo(() => getKhmdhsPaymentEntries(project), [project]);
  const totals = useMemo(() => buildKhmdhsPaymentsTotals(project), [project]);

  if (!projectHasKhmdhsPaymentData(project) || entries.length === 0) return null;

  const refAmount = resolveEffectivePayableAmountGrossForPayments(project);
  const hasPayableRef = refAmount != null && refAmount > 0;
  const refLabel = 'τελικό πληρωτέο ποσό';

  const compareAmount = totals.coFinancingPattern
    ? totals.estimatedContractorPaymentGross
    : totals.rawTotalGross;

  let compare = null;
  if (refAmount != null && compareAmount > 0) {
    const pct = Math.round((compareAmount / refAmount) * 100);
    const over = compareAmount > refAmount + 0.5;
    compare = { pct, over };
  }

  return (
    <Stack>
      <TotalsBar>
        <TotalChip>
          <TotalLabel>Πλήθος ενταλμάτων</TotalLabel>
          <TotalValue>{totals.count}</TotalValue>
        </TotalChip>
        {totals.coFinancingPattern ? (
          <>
            <TotalChip>
              <TotalLabel>Άθροισμα ενταλμάτων (με ΦΠΑ)</TotalLabel>
              <TotalValue>{formatKhmdhsEuro(totals.rawTotalGross)}</TotalValue>
            </TotalChip>
            <TotalChip>
              <TotalLabel>Εκτιμ. πληρωμή εργολάβου</TotalLabel>
              <TotalValue>{formatKhmdhsEuro(totals.estimatedContractorPaymentGross)}</TotalValue>
            </TotalChip>
          </>
        ) : (
          <TotalChip>
            <TotalLabel>Σύνολο πληρωμών (με ΦΠΑ)</TotalLabel>
            <TotalValue>{formatKhmdhsEuro(totals.rawTotalGross)}</TotalValue>
          </TotalChip>
        )}
        {totals.coFinancingPattern && (
          <InfoNote>
            Εντοπίστηκε μοτίβο συγχρηματοδότησης (Δήμος + Περιφερειακό Ταμείο): το άθροισμα των ενταλμάτων
            δεν αντιστοιχεί απαραίτητα σε διπλή πληρωμή εργολάβου — συνήθως το Ταμείο αποζημιώνει τον Δήμο.
          </InfoNote>
        )}
        {compare && (
          <CompareNote $warn={compare.over || totals.needsReview}>
            {compare.over || totals.needsReview
              ? `Υπερβαίνει το ${refLabel} (${compare.pct}%) — απαιτείται έλεγχος`
              : `${compare.pct}% του ${refLabel}`}
          </CompareNote>
        )}
        {totals.needsReview && !totals.coFinancingPattern && (
          <CompareNote $warn>
            Το άθροισμα των ενταλμάτων υπερβαίνει το {refLabel} χωρίς αναγνωρισμένο μοτίβο συγχρηματοδότησης.
            {' '}Ελέγξτε ποσό σύμβασης, ΑΠΕ (τελικό διαμορφωθέν) και συμπληρωματικές στη φόρμα του υποέργου.
          </CompareNote>
        )}
      </TotalsBar>

      {entries.map((entry, idx) => {
        if (!entry.snapshot) {
          return (
            <ErrorRow key={entry.adam || `pay-err-${idx}`}>
              Ένταλμα {entry.adam}: δεν ανακτήθηκαν λεπτομέρειες
              {entry.error ? ` (${entry.error})` : ''}.
            </ErrorRow>
          );
        }
        const groups = buildKhmdhsPaymentDisplayGroups(entry.snapshot, entry.payer);
        const amount = formatKhmdhsEuro(entry.snapshot.totalCostWithVAT);
        const summaryChips = [];
        if (entry.payer?.shortLabel) {
          summaryChips.push({ label: 'Φορέας', value: entry.payer.shortLabel, strong: true });
        }
        if (amount) summaryChips.push({ label: 'Ποσό (με ΦΠΑ)', value: amount, strong: true, highlight: true });
        if (entry.snapshot.cancelled) summaryChips.push({ label: 'Κατάσταση', value: 'Ακυρωμένο', warn: true });
        return (
          <KhmdhsPanelDisplay
            key={entry.adam || `pay-${idx}`}
            themeKey="payment"
            title={`💶 Ένταλμα πληρωμής${entries.length > 1 ? ` ${idx + 1}` : ''}`}
            adam={entry.adam || entry.snapshot.referenceNumber}
            cardSubtitle={entry.snapshot.title || ''}
            groups={groups}
            summaryChips={summaryChips}
            variant={variant}
            defaultExpanded={entries.length === 1}
          />
        );
      })}
    </Stack>
  );
}
