import React, { useState } from 'react';
import styled from 'styled-components';
import { getRemovableChainHistoryEntries } from '../utils/khmdhsUserOverrides';

const Panel = styled.div`
  margin-top: 0.85rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.35);
  overflow: hidden;
`;

const HeaderBtn = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(226, 232, 240, 0.45);
  }

  &:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: -2px;
  }
`;

const Chevron = styled.span`
  flex-shrink: 0;
  font-size: 0.72rem;
  color: #64748b;
  transition: transform 0.2s ease;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
`;

const Title = styled.span`
  font-size: 0.84rem;
  font-weight: 800;
  color: #334155;
  flex: 1;
  min-width: 0;
`;

const InfoBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: #e2e8f0;
  color: #64748b;
  flex-shrink: 0;
`;

const CollapsedSummary = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
`;

const Body = styled.div`
  padding: 0 0.85rem 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
`;

const Hint = styled.p`
  margin: 0.55rem 0 0.65rem 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #64748b;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.2);

  &:first-child {
    border-top: none;
    padding-top: 0;
  }
`;

const EntryText = styled.span`
  flex: 1 1 200px;
  font-size: 0.8rem;
  color: #1e293b;
  line-height: 1.4;
`;

const KindTag = styled.span`
  display: inline-flex;
  padding: 0.1rem 0.35rem;
  border-radius: 5px;
  font-size: 0.65rem;
  font-weight: 800;
  background: #e0e7ff;
  color: #4338ca;
  margin-right: 0.35rem;
`;

const RemoveBtn = styled.button`
  flex-shrink: 0;
  padding: 0.28rem 0.6rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #fff;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: #fef2f2;
    border-color: rgba(239, 68, 68, 0.4);
    color: #b91c1c;
  }
`;

/**
 * Συνδεδεμένες πράξεις αλυσίδας — αναδιπλούμενη λίστα, όχι εκκρεμότητες.
 * Η αφαίρεση προορίζεται μόνο αν κάποιο έγγραφο δεν ανήκει στο υποέργο.
 */
export default function KhmdhsRemovableChainEntries({ formData, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const entries = getRemovableChainHistoryEntries(formData);
  if (!entries.length || typeof onRemove !== 'function') return null;

  const toggleLabel = expanded ? 'Σύμπτυξη λίστας' : 'Προβολή λίστας';

  return (
    <Panel>
      <HeaderBtn
        type="button"
        aria-expanded={expanded}
        aria-label={`Συνδεδεμένες πράξεις αλυσίδας — ${toggleLabel}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <Chevron $open={expanded} aria-hidden>▶</Chevron>
        <Title>🔗 Συνδεδεμένες πράξεις αλυσίδας</Title>
        <InfoBadge>{entries.length}</InfoBadge>
        {!expanded ? (
          <CollapsedSummary>{toggleLabel}</CollapsedSummary>
        ) : null}
      </HeaderBtn>

      {expanded && (
        <Body>
          <Hint>
            Αυτές είναι κανονικά μέρος της αλυσίδας σας (παράταση, συμπληρωματική, τροποποίηση κ.λπ.) —
            <strong> δεν χρειάζεται να κάνετε κάτι</strong> εδώ.
            Χρησιμοποιήστε «Αφαίρεση» μόνο αν κάποιο έγγραφο δεν ανήκει σε αυτό το υποέργο.
          </Hint>
          <List>
            {entries.map((entry) => (
              <Row key={`${entry.contractIndex ?? 's'}-${entry.adam}`}>
                <EntryText>
                  {entry.contractLabel ? (
                    <><strong>{entry.contractLabel}</strong>{' · '}</>
                  ) : null}
                  <KindTag>{entry.label || entry.kind || 'Πράξη'}</KindTag>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{entry.adam}</span>
                  {entry.contractAmount ? ` · ${entry.contractAmount} €` : ''}
                  {entry.contractDate ? ` · ${entry.contractDate}` : ''}
                </EntryText>
                <RemoveBtn
                  type="button"
                  title="Αφαιρεί μόνο από αυτό το υποέργο — δεν αλλάζει τίποτα στο ΚΗΜΔΗΣ"
                  onClick={() => onRemove(entry.adam, entry.contractIndex)}
                >
                  Αφαίρεση
                </RemoveBtn>
              </Row>
            ))}
          </List>
        </Body>
      )}
    </Panel>
  );
}
