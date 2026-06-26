import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.94) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100010;
  padding: 1.25rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 20px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.26);
  animation: ${popIn} 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  padding: 1.3rem 1.5rem 1.1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
`;

const IconWrap = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
  margin-top: 1px;
`;

const HeaderText = styled.div`
  flex: 1;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
`;

const Sub = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.81rem;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.5;
`;

const Body = styled.div`
  padding: 1.25rem 1.5rem 0.75rem;
`;

const InfoBox = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  margin-bottom: 0.85rem;
`;

const InfoLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #dc2626;
  margin-bottom: 0.5rem;
`;

const InfoList = styled.ul`
  margin: 0;
  padding: 0 0 0 1.1rem;
  list-style: disc;
`;

const InfoItem = styled.li`
  font-size: 0.82rem;
  color: #1e293b;
  font-weight: 600;
  line-height: 1.55;
`;

const KeepBox = styled.div`
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  padding: 0.75rem 1rem;
`;

const KeepLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 0.35rem;
`;

const KeepNote = styled.div`
  font-size: 0.8rem;
  color: #475569;
  line-height: 1.5;
`;

const Footer = styled.div`
  display: flex;
  gap: 0.65rem;
  padding: 1rem 1.5rem 1.3rem;
`;

const Btn = styled.button`
  flex: 1;
  padding: 0.72rem 1rem;
  border-radius: 11px;
  font-size: 0.87rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, transform 0.12s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const DangerBtn = styled(Btn)`
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.28);
`;

const SecondaryBtn = styled(Btn)`
  background: #f1f5f9;
  color: #334155;
  border: 1px solid rgba(148, 163, 184, 0.45);
`;

const DELETE_LABELS = {
  full: [
    'Ημ/νία & ποσό σύμβασης (Φάση Α)',
    'ΑΠΕ & συμπληρωματικές συμβάσεις',
    'Εντάλματα πληρωμής',
    'Σύμβαση & τροποποιήσεις ΚΗΜΔΗΣ',
    'Χαρακτηρισμοί & έλεγχος αναφορών',
    'Χειροκίνητες διορθώσεις & ιστορικό',
    'Κατάλογος συνδεδεμένων εγγράφων',
    'Ανάθεση εργολάβου',
    'Προκήρυξη / δημοσίευση',
    'Αποφάσεις ανάληψης υποχρέωσης',
  ],
  partial: [
    'Ημ/νία & ποσό σύμβασης (Φάση Α)',
    'ΑΠΕ & συμπληρωματικές συμβάσεις',
    'Εντάλματα πληρωμής',
    'Σύμβαση & τροποποιήσεις ΚΗΜΔΗΣ',
    'Χαρακτηρισμοί & χειροκίνητες διορθώσεις',
    'Κατάλογος συνδεδεμένων εγγράφων',
    'Δεδομένα ανάθεσης',
  ],
};

/**
 * Modal επιβεβαίωσης διαγραφής ασύμβατων δεδομένων ΚΗΜΔΗΣ
 * όταν αλλάζει η κατάσταση υποέργου.
 *
 * Props:
 *   isOpen      {boolean}
 *   statusLabel {string}   — νέα κατάσταση
 *   scope       {'full'|'partial'}
 *   onConfirm   {fn}       — ναι, διέγραψε και αποθήκευσε
 *   onSkip      {fn}       — όχι, αποθήκευσε χωρίς διαγραφή
 *   onClose     {fn}       — κλείσε χωρίς αποθήκευση
 */
export default function KhmdhsStatusCleanupModal({
  isOpen,
  statusLabel = '',
  scope = 'full',
  onConfirm,
  onSkip,
  onClose,
}) {
  if (!isOpen) return null;

  const deleteLabels = DELETE_LABELS[scope] || DELETE_LABELS.full;

  return (
    <Overlay onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Header>
          <IconWrap>⚠️</IconWrap>
          <HeaderText>
            <Title>Ασύμβατα δεδομένα ΚΗΜΔΗΣ</Title>
            <Sub>
              Η κατάσταση «{statusLabel}» δεν συμβαδίζει
              με ήδη αποθηκευμένα δεδομένα αλυσίδας ΚΗΜΔΗΣ.
            </Sub>
          </HeaderText>
        </Header>

        <Body>
          <InfoBox>
            <InfoLabel>🗑 Θα διαγραφούν</InfoLabel>
            <InfoList>
              {deleteLabels.map((l) => (
                <InfoItem key={l}>{l}</InfoItem>
              ))}
            </InfoList>
          </InfoBox>

          <KeepBox>
            <KeepLabel>ℹ️ Εναλλακτικά</KeepLabel>
            <KeepNote>
              Αν δεν θέλεις να διαγράψεις τα δεδομένα, επίλεξε «Κράτηση δεδομένων» —
              τα δεδομένα παραμένουν αλλά ενδέχεται να μην αντιστοιχούν στην κατάσταση.
            </KeepNote>
          </KeepBox>
        </Body>

        <Footer>
          <SecondaryBtn type="button" onClick={onSkip}>
            Κράτηση δεδομένων
          </SecondaryBtn>
          <DangerBtn type="button" onClick={onConfirm}>
            Ναι, Διαγραφή & Αποθήκευση
          </DangerBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
