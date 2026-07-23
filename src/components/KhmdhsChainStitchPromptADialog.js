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
  width: min(520px, 100%);
  padding: 1.15rem 1.25rem 1.05rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
`;

const Title = styled.h3`
  margin: 0 0 0.55rem;
  font-size: 0.98rem;
  color: #0f172a;
`;

const Body = styled.p`
  margin: 0 0 0.65rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: #475569;
`;

const AdamLine = styled.div`
  font-size: 0.72rem;
  font-family: ui-monospace, Consolas, monospace;
  color: #64748b;
  margin-bottom: 0.35rem;
`;

const Warn = styled.p`
  margin: 0.65rem 0 0.85rem;
  font-size: 0.75rem;
  line-height: 1.45;
  color: #9a3412;
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
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

const KeepBtn = styled(Btn)`
  background: #4338ca;
  color: #fff;
`;

const FreshBtn = styled(Btn)`
  background: #e2e8f0;
  color: #334155;
`;

const CancelBtn = styled(Btn)`
  background: transparent;
  color: #64748b;
  font-weight: 600;
  text-align: center;
`;

/**
 * Ερώτηση Α: διατήρηση/ενημέρωση υπάρχουσας αλυσίδας vs από την αρχή.
 */
export default function KhmdhsChainStitchPromptADialog({
  isOpen,
  newSeedAdam = '',
  previousSeedAdam = '',
  onKeepAndUpdate,
  onStartFresh,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <Dialog role="dialog" aria-modal="true" aria-labelledby="khmdhs-stitch-a-title" onClick={(e) => e.stopPropagation()}>
        <Title id="khmdhs-stitch-a-title">Υπάρχουν ήδη δεδομένα ΚΗΜΔΗΣ</Title>
        <Body>
          Θα γίνει ανάκτηση με διαφορετικό ΑΔΑΜ από αυτόν που χρησιμοποιήθηκε πριν.
          Μπορείτε να κρατήσετε όσα ήδη έχετε και να συμπληρωθούν τα κενά στάδια,
          ή να ξεκινήσετε από την αρχή (διαγράφονται τα υπάρχοντα δεδομένα ΚΗΜΔΗΣ του υποέργου).
        </Body>
        {previousSeedAdam ? (
          <AdamLine>Προηγούμενος ΑΔΑΜ: {previousSeedAdam}</AdamLine>
        ) : null}
        {newSeedAdam ? (
          <AdamLine>Νέος ΑΔΑΜ: {newSeedAdam}</AdamLine>
        ) : null}
        <Warn>
          Αν διαλέξετε «από την αρχή», χάνονται αναλήψεις, δημοσιεύσεις, συμβάσεις και εντάλματα
          που έχουν ήδη έρθει από ΚΗΜΔΗΣ σε αυτό το υποέργο (μαζί με τυχόν τεχνητή αλυσίδα).
        </Warn>
        <Actions>
          <KeepBtn type="button" onClick={onKeepAndUpdate}>
            Διατήρηση και ενημέρωση — συμπλήρωση κενών κρίκων
          </KeepBtn>
          <FreshBtn type="button" onClick={onStartFresh}>
            Από την αρχή — καθαρισμός και νέα ανάκτηση
          </FreshBtn>
          <CancelBtn type="button" onClick={onCancel}>Ακύρωση</CancelBtn>
        </Actions>
      </Dialog>
    </Overlay>
  );
}
