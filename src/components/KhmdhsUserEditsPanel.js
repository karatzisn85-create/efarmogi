import React from 'react';
import styled from 'styled-components';
import {
  formHasKhmdhsUserEdits,
  getActiveKhmdhsOverrides,
  formatJournalActionLabel,
  ensureKhmdhsUserEdits,
} from '../utils/khmdhsFieldOverrides';

const Panel = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid rgba(59, 130, 246, 0.35);
`;

const Title = styled.div`
  font-size: 0.84rem;
  font-weight: 800;
  color: #1e40af;
  margin-bottom: 0.35rem;
`;

const Hint = styled.p`
  margin: 0 0 0.65rem 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #1e3a8a;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-top: 1px dashed rgba(59, 130, 246, 0.25);

  &:first-of-type {
    border-top: none;
    padding-top: 0;
  }
`;

const EntryText = styled.div`
  flex: 1 1 200px;
  font-size: 0.8rem;
  color: #1e293b;
  line-height: 1.45;
`;

const RevertBtn = styled.button`
  flex-shrink: 0;
  padding: 0.3rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: #bfdbfe;
  }
`;

const CommentInput = styled.textarea`
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  font-size: 0.76rem;
  font-family: inherit;
  resize: vertical;
  min-height: 2.2rem;
  background: #fff;
  color: #334155;

  &:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.55);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
`;

const JournalBlock = styled.div`
  margin-top: 0.65rem;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(59, 130, 246, 0.2);
`;

const JournalTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.35rem;
`;

const JournalLine = styled.div`
  font-size: 0.76rem;
  color: #475569;
  line-height: 1.4;
  padding: 0.15rem 0;
`;

function formatDisplayValue(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

/**
 * Εμφάνιση ενεργών χειροκίνητων αλλαγών σε πεδία ΚΗΜΔΗΣ και πρόσφατου ιστορικού.
 */
export default function KhmdhsUserEditsPanel({ formData, onRevert, onCommentChange }) {
  if (!formHasKhmdhsUserEdits(formData)) return null;

  const overrides = getActiveKhmdhsOverrides(formData);
  const edits = ensureKhmdhsUserEdits(formData);
  const excluded = edits.excludedChainAdams || [];
  const journal = (edits.journal || []).slice(0, 8);

  return (
    <Panel>
      <Title>Οι δικές σας αλλαγές σε στοιχεία ΚΗΜΔΗΣ</Title>
      <Hint>
        Οι τιμές που τροποποιήσατε χειροκίνητα δεν αντικαθίστανται όταν ξανακάνετε ανάκτηση από ΚΗΜΔΗΣ.
        Μπορείτε να προσθέσετε σχόλιο (προαιρετικά) και να επαναφέρετε κάθε πεδίο στην τιμή από το σύστημα.
      </Hint>

      {overrides.map((item) => (
        <Row key={item.fieldKey}>
          <EntryText>
            <strong>{item.label || item.fieldKey}</strong>
            <br />
            Δική σας τιμή: {formatDisplayValue(item.value)}
            <br />
            Από ΚΗΜΔΗΣ: {formatDisplayValue(item.khmdhsValue)}
            {typeof onCommentChange === 'function' && (
              <CommentInput
                rows={2}
                placeholder="Προαιρετικό σχόλιο (π.χ. γιατί διορθώσατε την τιμή)"
                value={item.comment || ''}
                onChange={(e) => onCommentChange(item.fieldKey, e.target.value)}
              />
            )}
          </EntryText>
          {typeof onRevert === 'function' && (
            <RevertBtn type="button" onClick={() => onRevert(item.fieldKey)}>
              Επαναφορά
            </RevertBtn>
          )}
        </Row>
      ))}

      {excluded.length > 0 && (
        <Row>
          <EntryText>
            <strong>Αφαιρεμένες πράξεις αλυσίδας</strong>
            <br />
            {excluded.join(', ')}
            <br />
            <span style={{ color: '#64748b' }}>
              Δεν θα ξαναπροστεθούν αυτόματα σε νέα ανάκτηση.
            </span>
          </EntryText>
        </Row>
      )}

      {journal.length > 0 && (
        <JournalBlock>
          <JournalTitle>Πρόσφατο ιστορικό</JournalTitle>
          {journal.map((entry) => (
            <JournalLine key={entry.id}>
              {formatJournalActionLabel(entry)} — {entry.label || entry.fieldKey}
              {entry.from || entry.to
                ? `: ${formatDisplayValue(entry.from)} → ${formatDisplayValue(entry.to)}`
                : ''}
            </JournalLine>
          ))}
        </JournalBlock>
      )}
    </Panel>
  );
}
