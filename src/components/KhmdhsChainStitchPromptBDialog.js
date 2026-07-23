import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 100020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 12px;
  width: min(540px, 100%);
  padding: 1.15rem 1.25rem 1.05rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
`;

const Title = styled.h3`
  margin: 0 0 0.55rem;
  font-size: 0.98rem;
  color: #0f172a;
`;

const Body = styled.p`
  margin: 0 0 0.6rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: #475569;
`;

const SeedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.5rem 0 0.85rem;
`;

const SeedRow = styled.div`
  font-size: 0.74rem;
  color: #334155;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
`;

const SeedAdam = styled.span`
  font-family: ui-monospace, Consolas, monospace;
  font-weight: 700;
  color: #1e293b;
`;

const StagesText = styled.span`
  color: #64748b;
`;

const Note = styled.p`
  margin: 0.55rem 0 0.9rem;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #3730a3;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
`;

const YesBtn = styled(Btn)`
  background: #4338ca;
  color: #fff;
`;

const NoBtn = styled(Btn)`
  background: #e2e8f0;
  color: #334155;
  text-align: center;
`;

const STAGE_LABELS = {
  REQ: 'Πρωτογενές αίτημα',
  COMMIT: 'Ανάληψη υποχρέωσης',
  PROC: 'Δημοσίευση',
  AWRD: 'Ανάθεση',
  SYMV: 'Σύμβαση',
  PAY: 'Εντάλματα',
};

function stagesLabel(stages) {
  const list = (stages || []).map((s) => STAGE_LABELS[s] || s);
  return list.length ? list.join(', ') : 'στοιχεία αλυσίδας';
}

/**
 * Ερώτηση Β: μόνιμη καταχώριση τεχνητής αλυσίδας από πολλούς ΑΔΑΜ.
 */
export default function KhmdhsChainStitchPromptBDialog({
  isOpen,
  segments = [],
  onConfirm,
  onDecline,
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onDecline?.()}>
      <Dialog role="dialog" aria-modal="true" aria-labelledby="khmdhs-stitch-b-title" onClick={(e) => e.stopPropagation()}>
        <Title id="khmdhs-stitch-b-title">Τεχνητή αλυσίδα από πολλούς ΑΔΑΜ</Title>
        <Body>
          Η αλυσίδα συμπληρώθηκε από περισσότερους από έναν κωδικούς ΚΗΜΔΗΣ, επειδή τα έγγραφα
          δεν είναι συνδεδεμένα μεταξύ τους στο ΚΗΜΔΗΣ. Θέλετε να το θυμάται η εφαρμογή, ώστε
          στις επόμενες ανανεώσεις (και στη μαζική ανανέωση) να χρησιμοποιεί όλους αυτούς τους κωδικούς;
        </Body>
        <SeedList>
          {segments.map((s, i) => (
            <SeedRow key={`${s.seedAdam}-${i}`}>
              Τμήμα {i + 1}: <SeedAdam>{s.seedAdam}</SeedAdam>{' '}
              <StagesText>— {stagesLabel(s.coversStages)}</StagesText>
            </SeedRow>
          ))}
        </SeedList>
        <Note>
          Αν επιλέξετε «Ναι», η ρύθμιση μπαίνει στη φόρμα — πρέπει να πατήσετε «Αποθήκευση»
          για να οριστικοποιηθεί. Αν επιλέξετε «Όχι», τα δεδομένα παραμένουν, αλλά μια αυτόματη
          ή μαζική ανανέωση αργότερα θα χρησιμοποιήσει έναν μόνο κωδικό και μπορεί να μην
          ξαναφέρει όλα τα κομμάτια.
        </Note>
        <Actions>
          <YesBtn type="button" onClick={onConfirm}>
            Ναι, να καταχωρηθεί ως σωστή ροή αλυσίδας
          </YesBtn>
          <NoBtn type="button" onClick={onDecline}>
            Όχι, μόνο για αυτή τη φορά
          </NoBtn>
        </Actions>
      </Dialog>
    </Overlay>
  );
}
