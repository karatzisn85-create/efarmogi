import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  padding: 1rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(226, 232, 240, 0.8);
  animation: ${popIn} 0.22s ease;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.1rem 1.25rem 0.85rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #1e293b;
`;

const Subtitle = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const OptionBtn = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  text-align: left;
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$selected ? 'rgba(99,102,241,0.45)' : 'rgba(226,232,240,0.8)')};
  background: ${(p) => (p.$selected ? '#eef2ff' : '#fff')};
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgba(99, 102, 241, 0.35);
    background: #f8fafc;
  }
`;

const OptionTitle = styled.span`
  font-size: 0.82rem;
  font-weight: 700;
  color: #334155;
`;

const OptionDesc = styled.span`
  font-size: 0.68rem;
  color: #94a3b8;
  line-height: 1.4;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem 1.1rem;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
`;

const Btn = styled.button`
  padding: 0.55rem 1rem;
  border-radius: 9px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
`;

const CancelBtn = styled(Btn)`
  background: #f8fafc;
  color: #64748b;
  border-color: rgba(226, 232, 240, 0.9);
`;

const ExportBtn = styled(Btn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  min-width: 120px;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const REPORT_OPTIONS = [
  {
    id: 'portfolio',
    title: 'Αναφορά Χαρτοφυλακίου',
    desc: 'Πλήρης εικόνα: funnel, οικονομικά, κενά, σκορ ποιότητας (~4 σελ.)',
  },
  {
    id: 'gaps',
    title: 'Κενά Αλυσίδας ΚΗΜΔΗΣ',
    desc: 'Μόνο υποέργα που χρειάζονται ενέργεια, ομαδοποιημένα ανά πρόβλημα',
  },
  {
    id: 'financial',
    title: 'Οικονομική Εικόνα',
    desc: 'Αγωγός ποσών, αποκλίσεις PROC/SYMV/PAY, timeline πληρωμών',
  },
];

export default function PortfolioReportExportModal({
  isOpen,
  projectCount = 0,
  exporting = false,
  onClose,
  onExport,
}) {
  const [selected, setSelected] = React.useState('portfolio');

  React.useEffect(() => {
    if (isOpen) setSelected('portfolio');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose} data-portfolio-export-modal>
      <Card onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Εξαγωγή αναφοράς PDF</Title>
          <Subtitle>
            Η αναφορά θα περιλαμβάνει {projectCount} υποέργα σύμφωνα με τα ενεργά φίλτρα της οθόνης.
          </Subtitle>
        </Header>
        <Body>
          {REPORT_OPTIONS.map((opt) => (
            <OptionBtn
              key={opt.id}
              type="button"
              $selected={selected === opt.id}
              disabled={exporting}
              onClick={() => setSelected(opt.id)}
            >
              <OptionTitle>{opt.title}</OptionTitle>
              <OptionDesc>{opt.desc}</OptionDesc>
            </OptionBtn>
          ))}
        </Body>
        <Footer>
          <CancelBtn type="button" onClick={onClose} disabled={exporting}>
            Ακύρωση
          </CancelBtn>
          <ExportBtn
            type="button"
            disabled={exporting || !selected}
            onClick={() => onExport?.(selected)}
          >
            {exporting ? 'Εξαγωγή...' : 'Εξαγωγή PDF'}
          </ExportBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
