import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 110000;
  padding: 1rem;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(226, 232, 240, 0.8);
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
  gap: 0.45rem;
  max-height: 70vh;
  overflow-y: auto;
`;

const SectionLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0.35rem 0 0.15rem;
`;

const OptionBtn = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  text-align: left;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(226, 232, 240, 0.85);
  background: #fff;
  cursor: ${(p) => (p.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.disabled ? 0.55 : 1)};

  &:hover:not(:disabled) {
    border-color: rgba(99, 102, 241, 0.35);
    background: #f8fafc;
  }
`;

const OptionTitle = styled.span`
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
`;

const OptionDesc = styled.span`
  font-size: 0.68rem;
  color: #64748b;
  line-height: 1.4;
`;

const Footer = styled.div`
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  justify-content: flex-end;
`;

const CancelBtn = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #f8fafc;
  }
`;

function StatisticsExportModal({
  isOpen,
  onClose,
  exporting,
  activeTabLabel,
  projectCount,
  onExportTab,
  onExportAllTabs,
  onExportKhmdhs,
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && !exporting && onClose()}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Εξαγωγή αναφοράς PDF</Title>
          <Subtitle>
            {projectCount} υποέργα · επιλέξτε τι θέλετε να εξάγετε
          </Subtitle>
        </Header>
        <Body>
          <SectionLabel>Καρτέλα στατιστικών</SectionLabel>
          <OptionBtn
            type="button"
            disabled={exporting}
            onClick={() => onExportTab()}
          >
            <OptionTitle>Τρέχουσα καρτέλα — {activeTabLabel}</OptionTitle>
            <OptionDesc>PDF μόνο για την καρτέλα που βλέπετε τώρα</OptionDesc>
          </OptionBtn>
          <OptionBtn
            type="button"
            disabled={exporting}
            onClick={onExportAllTabs}
          >
            <OptionTitle>Όλες οι καρτέλες (πλήρης αναφορά)</OptionTitle>
            <OptionDesc>Μία αναφορά PDF με όλες τις ενότητες — όσες σελίδες χρειαστεί</OptionDesc>
          </OptionBtn>

          <SectionLabel>Εξειδικευμένες αναφορές ΚΗΜΔΗΣ</SectionLabel>
          <OptionBtn type="button" disabled={exporting} onClick={() => onExportKhmdhs('portfolio')}>
            <OptionTitle>Χαρτοφυλάκιο ΚΗΜΔΗΣ</OptionTitle>
            <OptionDesc>Funnel, κενά αλυσίδας, σκορ ποιότητας</OptionDesc>
          </OptionBtn>
          <OptionBtn type="button" disabled={exporting} onClick={() => onExportKhmdhs('gaps')}>
            <OptionTitle>Κενά αλυσίδας</OptionTitle>
            <OptionDesc>Υποέργα που χρειάζονται ενέργεια ανά τύπο κενού</OptionDesc>
          </OptionBtn>
          <OptionBtn type="button" disabled={exporting} onClick={() => onExportKhmdhs('financial')}>
            <OptionTitle>Οικονομική αναφορά ΚΗΜΔΗΣ</OptionTitle>
            <OptionDesc>Χρηματικός αγωγός, αποκλίσεις, πληρωμές</OptionDesc>
          </OptionBtn>
        </Body>
        <Footer>
          <CancelBtn type="button" disabled={exporting} onClick={onClose}>
            {exporting ? 'Εξαγωγή…' : 'Ακύρωση'}
          </CancelBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}

export default StatisticsExportModal;
