import React, { Suspense, lazy } from 'react';
import styled, { keyframes } from 'styled-components';

const Statistics = lazy(() => import('./Statistics'));

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  z-index: 100000;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 1.25rem;
  animation: ${fadeIn} 0.2s ease;
`;

const WideCard = styled.div`
  background: #f8fafc;
  border-radius: 18px;
  width: min(1400px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(226, 232, 240, 0.9);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #f8fafc;
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const ModalSubtitle = styled.p`
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: rgba(248, 250, 252, 0.75);
`;

const CloseBtn = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 10px;
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1rem 1.25rem 1.25rem;
`;

const Fallback = styled.div`
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
`;

function StatisticsModal({
  isOpen,
  onClose,
  projects,
  directAssignmentViolations,
  loggedInUsername,
  onPortfolioDrillDown,
  statisticsFilterNote,
  statisticsScopeNote = '',
}) {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <WideCard onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <div>
            <ModalTitle>Στατιστικά & Αναλυτικές Αναφορές</ModalTitle>
            <ModalSubtitle>
              {projects?.length || 0} υποέργα
              {statisticsScopeNote ? ` · ${statisticsScopeNote}` : ' · πλήρης ανάλυση ανά καρτέλα · εξαγωγή PDF'}
            </ModalSubtitle>
          </div>
          <CloseBtn type="button" onClick={onClose}>✕ Κλείσιμο</CloseBtn>
        </ModalHeader>
        <Body>
          <Suspense fallback={<Fallback>Φόρτωση στατιστικών…</Fallback>}>
            <Statistics
              variant="full"
              embedded
              projects={projects}
              directAssignmentViolations={directAssignmentViolations}
              loggedInUsername={loggedInUsername}
              onPortfolioDrillDown={onPortfolioDrillDown}
              statisticsFilterNote={statisticsFilterNote}
              statisticsScopeNote={statisticsScopeNote}
            />
          </Suspense>
        </Body>
      </WideCard>
    </Overlay>
  );
}

export default StatisticsModal;
