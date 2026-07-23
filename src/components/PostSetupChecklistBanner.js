/**
 * Κάρτα ολοκλήρωσης μετά την εγκατάσταση — SUPERADMIN.
 */
import React from 'react';
import styled from 'styled-components';

const Shell = styled.div`
  margin: 0 0 18px;
  padding: 16px 18px 14px;
  border-radius: 14px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0c4a6e;
`;

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`;

const Titles = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-weight: 750;
  font-size: 15px;
  color: #0c4a6e;
  margin-bottom: 3px;
`;

const Sub = styled.div`
  font-size: 13px;
  line-height: 1.45;
  color: #0369a1;
`;

const DismissBtn = styled.button`
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #0284c7;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  &:hover { background: rgba(14, 165, 233, 0.12); }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid ${(p) => (p.$done ? '#bbf7d0' : '#e0f2fe')};
`;

const Status = styled.span`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  background: ${(p) => (p.$done ? '#dcfce7' : '#e0f2fe')};
  color: ${(p) => (p.$done ? '#15803d' : '#0369a1')};
`;

const TextCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemTitle = styled.div`
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
`;

const ItemWhy = styled.div`
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  margin-top: 2px;
`;

const ActionBtn = styled.button`
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: 8px;
  border: none;
  background: ${(p) => (p.$done ? '#f1f5f9' : 'linear-gradient(135deg, #0284c7, #0ea5e9)')};
  color: ${(p) => (p.$done ? '#64748b' : '#fff')};
  font-weight: 700;
  font-size: 12.5px;
  cursor: ${(p) => (p.$done ? 'default' : 'pointer')};
  &:hover { filter: ${(p) => (p.$done ? 'none' : 'brightness(1.03)')}; }
`;

/**
 * @param {{ items: Array, incompleteCount: number, onAction: (id: string) => void, onDismiss: () => void }} props
 */
export default function PostSetupChecklistBanner({
  items = [],
  incompleteCount = 0,
  onAction,
  onDismiss,
}) {
  if (!items.length) return null;

  return (
    <Shell role="region" aria-label="Ολοκλήρωση εγκατάστασης">
      <Top>
        <Titles>
          <Title>
            Ολοκλήρωση εγκατάστασης
            {incompleteCount > 0 ? ` — απομένουν ${incompleteCount}` : ''}
          </Title>
          <Sub>
            Μετά τον βασικό οδηγό, ρυθμίστε αυτά για να δουλεύουν σωστά ειδοποιήσεις,
            προστασία δεδομένων και δημόσια πύλη.
          </Sub>
        </Titles>
        <DismissBtn type="button" onClick={onDismiss}>
          Απόκρυψη για τώρα
        </DismissBtn>
      </Top>
      <List>
        {items.map((item) => (
          <Row key={item.id} $done={item.done}>
            <Status $done={item.done} aria-hidden>
              {item.done ? '✓' : '!'}
            </Status>
            <TextCol>
              <ItemTitle>{item.title}</ItemTitle>
              <ItemWhy>{item.why}</ItemWhy>
            </TextCol>
            <ActionBtn
              type="button"
              $done={item.done}
              disabled={item.done}
              onClick={() => !item.done && onAction?.(item.id)}
            >
              {item.done ? 'Έτοιμο' : item.actionLabel}
            </ActionBtn>
          </Row>
        ))}
      </List>
    </Shell>
  );
}
