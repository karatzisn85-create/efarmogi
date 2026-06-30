import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { isValidDiavgeiaAdaFormat, normalizeDiavgeiaAda } from '../utils/diavgeiaApeFetch';
import {
  buildProsklisiDiavgeiaMeta,
  mapDiavgeiaDecisionToProsklisiFields,
  PROSKLISI_MANUAL_FIELDS_MODIFICATION,
  PROSKLISI_MANUAL_FIELDS_NEW,
  subjectLooksLikeModification,
} from '../utils/prosklisiDiavgeiaFetch';
import { openProsklisiDiavgeiaDocument } from '../utils/prosklisiDiavgeiaRegistry';
import { useToast } from './ToastProvider';

const ipcRenderer = window.electronAPI;

const Section = styled.div`
  margin-bottom: 1.75rem;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid #99f6e4;
  background: linear-gradient(180deg, #f0fdfa 0%, #ecfeff 100%);
`;

const SectionTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f766e;
  margin-bottom: 0.75rem;
`;

const Hint = styled.p`
  margin: 0 0 0.85rem;
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.5;
`;

const AdaRow = styled.div`
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const AdaInput = styled.input`
  flex: 1 1 220px;
  min-width: 0;
  padding: 0.85rem 1rem;
  border: 2px solid #5eead4;
  border-radius: 8px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #0d9488;
    box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.2);
  }
`;

const FetchBtn = styled.button`
  padding: 0.85rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: #0d9488;
  color: white;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.div`
  margin-top: 0.6rem;
  color: #b91c1c;
  font-size: 0.88rem;
`;

const PreviewBox = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 10px;
  background: white;
  border: 1px solid #ccfbf1;
`;

const PreviewTitle = styled.div`
  font-weight: 700;
  color: #115e59;
  margin-bottom: 0.5rem;
`;

const PreviewMeta = styled.div`
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.55;

  strong {
    color: #0f172a;
  }
`;

const PreviewActions = styled.div`
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.85rem;
`;

const ApplyBtn = styled.button`
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 8px;
  background: #059669;
  color: white;
  font-weight: 600;
  cursor: pointer;
`;

const CancelBtn = styled.button`
  padding: 0.7rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: white;
  color: #475569;
  cursor: pointer;
`;

const InfoBanner = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  font-size: 0.85rem;
  color: #1e3a8a;
  line-height: 1.5;
`;

const WarnBanner = styled.div`
  margin-top: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fdba74;
  font-size: 0.85rem;
  color: #9a3412;
  line-height: 1.5;
`;

const ConfirmedBanner = styled.div`
  margin-top: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
`;

const ConfirmedTitle = styled.div`
  font-weight: 700;
  color: #047857;
  margin-bottom: 0.35rem;
`;

const ClearLink = styled.button`
  margin-top: 0.6rem;
  padding: 0;
  border: none;
  background: none;
  color: #0f766e;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.85rem;
`;

const ViewBtn = styled.button`
  margin-top: 0.65rem;
  padding: 0.55rem 0.95rem;
  border: none;
  border-radius: 8px;
  background: #0369a1;
  color: white;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;

  &:hover {
    background: #0284c7;
  }
`;

const FIELD_LABELS = {
  title: 'τίτλος',
  axis: 'άξονας',
  fundingSource: 'πηγή χρηματοδότησης',
  modificationDocumentDate: 'ημερομηνία εγγράφου',
  modificationDescription: 'περιγραφή τροποποίησης',
};

/**
 * @param {object} props
 * @param {'new'|'modification'} props.mode
 * @param {string} [props.initialAda]
 * @param {object|null} [props.initialConfirmedMeta]
 * @param {(payload: { fields: object, autoFilledKeys: string[], diavgeiaMeta: object, preview: object }) => void|Promise<void>} props.onApply
 * @param {() => void} [props.onClear]
 */
function ProsklisiDiavgeiaSection({
  mode = 'new',
  initialAda = '',
  initialConfirmedMeta = null,
  onApply,
  onClear,
}) {
  const { showToast } = useToast();
  const [adaInput, setAdaInput] = useState(initialAda || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewDecision, setPreviewDecision] = useState(null);
  const [confirmedMeta, setConfirmedMeta] = useState(initialConfirmedMeta);

  useEffect(() => {
    setAdaInput(initialAda || '');
    setConfirmedMeta(initialConfirmedMeta || null);
  }, [initialAda, initialConfirmedMeta]);

  const manualFields = mode === 'modification'
    ? PROSKLISI_MANUAL_FIELDS_MODIFICATION
    : PROSKLISI_MANUAL_FIELDS_NEW;

  const handleFetch = useCallback(async () => {
    const ada = normalizeDiavgeiaAda(adaInput);
    if (!ada) {
      setError('Συμπληρώστε τον ΑΔΑ της Διαύγειας.');
      return;
    }
    if (!isValidDiavgeiaAdaFormat(ada)) {
      setError('Μη έγκυρη μορφή ΑΔΑ (π.χ. ΡΩΕΚΩΨΜ-Σ0Υ).');
      return;
    }

    setLoading(true);
    setError('');
    setPreviewDecision(null);
    try {
      const res = await ipcRenderer.invoke('diavgeia-fetch-decision-by-ada', { ada });
      if (!res?.success || !res.decision) {
        setError(res?.error || 'Δεν βρέθηκε πράξη με αυτόν τον ΑΔΑ.');
        return;
      }
      setPreviewDecision(res.decision);
      setAdaInput(res.decision.ada || ada);
    } catch (e) {
      setError(e?.message || 'Αποτυχία ανάκτησης από Διαύγεια.');
    } finally {
      setLoading(false);
    }
  }, [adaInput]);

  const handleApply = useCallback(async () => {
    if (!previewDecision) return;
    const mapped = mapDiavgeiaDecisionToProsklisiFields(previewDecision, mode);
    const diavgeiaMeta = buildProsklisiDiavgeiaMeta(mapped.preview);
    setConfirmedMeta(diavgeiaMeta);
    setPreviewDecision(null);
    await onApply?.({
      fields: mapped.fields,
      autoFilledKeys: mapped.autoFilledKeys,
      diavgeiaMeta,
      preview: mapped.preview,
      decision: previewDecision,
    });
  }, [mode, onApply, previewDecision]);

  const handleClear = useCallback(() => {
    setConfirmedMeta(null);
    setPreviewDecision(null);
    setError('');
    onClear?.();
  }, [onClear]);

  const handleViewConfirmed = useCallback(() => {
    if (!confirmedMeta) return;
    openProsklisiDiavgeiaDocument(confirmedMeta, { showToast });
  }, [confirmedMeta, showToast]);

  const previewMapped = previewDecision
    ? mapDiavgeiaDecisionToProsklisiFields(previewDecision, mode)
    : null;

  const looksLikeModification = previewDecision
    ? subjectLooksLikeModification(previewDecision.subject)
    : false;

  return (
    <Section>
      <SectionTitle>Ανάκτηση από Διαύγεια (προαιρετικό)</SectionTitle>
      <Hint>
        Εισάγετε τον ΑΔΑ για αυτόματη συμπλήρωση βασικών στοιχείων και καταχώριση της πράξης
        (χωρίς λήψη PDF — η προβολή γίνεται στον browser, όπως στα έγγραφα υποέργου).
        Η πηγή χρηματοδότησης συμπληρώνεται από τον φορέα έκδοσης του εγγράφου.
        Η προθεσμία υποβολής, ο κωδικός πρόσκλησης και το εύρος προϋπολογισμού συμπληρώνονται χειροκίνητα.
      </Hint>

      <AdaRow>
        <AdaInput
          type="text"
          value={adaInput}
          onChange={(e) => setAdaInput(e.target.value)}
          placeholder="π.χ. 6Θ1Δ465ΧΘ7-Π5Κ"
          disabled={!!confirmedMeta}
        />
        <FetchBtn type="button" onClick={handleFetch} disabled={loading || !!confirmedMeta}>
          {loading ? 'Ανάκτηση…' : 'Ανάκτηση'}
        </FetchBtn>
      </AdaRow>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {previewDecision && previewMapped ? (
        <PreviewBox>
          <PreviewTitle>Βρέθηκε πράξη στη Διαύγεια</PreviewTitle>
          <PreviewMeta>
            {previewMapped.preview.ada ? <div><strong>ΑΔΑ:</strong> {previewMapped.preview.ada}</div> : null}
            {previewMapped.preview.protocolNumber ? (
              <div><strong>Πρωτόκολο:</strong> {previewMapped.preview.protocolNumber}</div>
            ) : null}
            {previewMapped.preview.organization ? (
              <div><strong>Φορέας:</strong> {previewMapped.preview.organization}</div>
            ) : null}
            {previewMapped.preview.subject ? (
              <div><strong>Θέμα:</strong> {previewMapped.preview.subject}</div>
            ) : null}
            {previewMapped.preview.issueDateDisplay ? (
              <div><strong>Ημερομηνία έκδοσης:</strong> {previewMapped.preview.issueDateDisplay}</div>
            ) : null}
          </PreviewMeta>

          {mode === 'new' && looksLikeModification ? (
            <WarnBanner>
              Το θέμα φαίνεται να αφορά <strong>τροποποίηση</strong> πρόσκλησης.
              Επιβεβαιώστε ότι χρησιμοποιείτε τη σωστή φόρμα.
            </WarnBanner>
          ) : null}

          {mode === 'modification' && !looksLikeModification ? (
            <WarnBanner>
              Το θέμα δεν αναφέρει ρητά «ΤΡΟΠΟΠΟΙΗΣΗ». Ελέγξτε ότι ο ΑΔΑ αντιστοιχεί σε τροποποίηση.
            </WarnBanner>
          ) : null}

          <InfoBanner>
            <strong>Θα συμπληρωθούν αυτόματα:</strong>
            {' '}
            {previewMapped.autoFilledKeys.length > 0
              ? previewMapped.autoFilledKeys.map((k) => FIELD_LABELS[k] || k).join(', ')
              : '—'}
            <br />
            <strong>Θα χρειαστεί να συμπληρώσετε:</strong>
            {' '}
            {manualFields.join(' · ')}
          </InfoBanner>

          <PreviewActions>
            <ApplyBtn type="button" onClick={handleApply}>
              Εφαρμογή στη φόρμα
            </ApplyBtn>
            <CancelBtn type="button" onClick={() => setPreviewDecision(null)}>
              Ακύρωση
            </CancelBtn>
          </PreviewActions>
        </PreviewBox>
      ) : null}

      {confirmedMeta ? (
        <ConfirmedBanner>
          <ConfirmedTitle>✓ Συνδέθηκε πράξη Διαύγειας</ConfirmedTitle>
          <PreviewMeta>
            <div><strong>ΑΔΑ:</strong> {confirmedMeta.ada}</div>
            {confirmedMeta.protocolNumber ? (
              <div><strong>Πρωτόκολο:</strong> {confirmedMeta.protocolNumber}</div>
            ) : null}
          </PreviewMeta>
          <ViewBtn type="button" onClick={handleViewConfirmed}>
            Προβολή στη Διαύγεια
          </ViewBtn>
          <ClearLink type="button" onClick={handleClear}>
            Αφαίρεση σύνδεσης Διαύγειας
          </ClearLink>
        </ConfirmedBanner>
      ) : null}
    </Section>
  );
}

export default ProsklisiDiavgeiaSection;
