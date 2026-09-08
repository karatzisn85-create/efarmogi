import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { isValidDiavgeiaAdaFormat, normalizeDiavgeiaAda } from '../utils/diavgeiaApeFetch';
import {
  buildEntaxiDiavgeiaMeta,
  mapDiavgeiaDecisionToEntaxiFields,
  ENTAXI_MANUAL_FIELDS_MODIFICATION,
  ENTAXI_MANUAL_FIELDS_NEW,
} from '../utils/entaxiDiavgeiaFetch';
import { openEntaxiDiavgeiaDocument } from '../utils/entaxiDiavgeiaRegistry';
import entaxiDiavgeiaParse from '../../app/core/entaxiDiavgeiaParse';
import { formatDateEl } from '../utils/dateFormat';
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
  subject: 'θέμα',
  documentDate: 'ημερομηνία εγγράφου',
  fundingAuthority: 'φορέας χρηματοδότησης',
  initialAmount: 'ποσό',
  opsCode: 'κωδικός ΟΠΣ',
  legalCommitmentDeadline: 'προθεσμία ΝοΔε',
  startDate: 'έναρξη πράξης',
  endDate: 'λήξη πράξης',
  beneficiary: 'δικαιούχος',
  date: 'ημερομηνία τροποποίησης',
  comments: 'περιγραφή τροποποίησης',
  amount: 'νέο ποσό',
  changeAmount: 'αλλαγή ποσού',
};

function EntaxiDiavgeiaSection({
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
  const [previewPayload, setPreviewPayload] = useState(null);
  const [confirmedMeta, setConfirmedMeta] = useState(initialConfirmedMeta);

  useEffect(() => {
    setAdaInput(initialAda || '');
    setConfirmedMeta(initialConfirmedMeta || null);
  }, [initialAda, initialConfirmedMeta]);

  const manualFields = mode === 'modification'
    ? ENTAXI_MANUAL_FIELDS_MODIFICATION
    : ENTAXI_MANUAL_FIELDS_NEW;

  const handleFetch = useCallback(async () => {
    const ada = normalizeDiavgeiaAda(adaInput);
    if (!ada) {
      setError('Συμπληρώστε τον ΑΔΑ της Διαύγειας.');
      return;
    }
    if (!isValidDiavgeiaAdaFormat(ada)) {
      setError('Μη έγκυρη μορφή ΑΔΑ (π.χ. ΨΩΚΖ7ΛΚ-8ΦΤ).');
      return;
    }

    setLoading(true);
    setError('');
    setPreviewPayload(null);
    try {
      const res = await ipcRenderer.invoke('diavgeia-fetch-entaxi-by-ada', { ada, mode });
      if (!res?.success || !res.decision) {
        setError(res?.error || 'Δεν βρέθηκε πράξη με αυτόν τον ΑΔΑ.');
        return;
      }
      setPreviewPayload(res);
      setAdaInput(res.decision.ada || ada);
    } catch (e) {
      setError(e?.message || 'Αποτυχία ανάκτησης από Διαύγεια.');
    } finally {
      setLoading(false);
    }
  }, [adaInput, mode]);

  const handleAdaKeyDown = useCallback((e) => {
    if (e.isComposing || (e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    handleFetch();
  }, [handleFetch, loading]);

  const handleApply = useCallback(async () => {
    if (!previewPayload?.decision) return;
    const mapped = mapDiavgeiaDecisionToEntaxiFields(
      previewPayload.decision,
      previewPayload.extracted,
      mode
    );
    const diavgeiaMeta = buildEntaxiDiavgeiaMeta(mapped.preview, mapped.parsed);
    setConfirmedMeta(diavgeiaMeta);
    setPreviewPayload(null);
    await onApply?.({
      fields: mapped.fields,
      autoFilledKeys: mapped.autoFilledKeys,
      diavgeiaMeta,
      preview: mapped.preview,
      decision: previewPayload.decision,
      extracted: mapped.parsed,
      pdf: previewPayload.pdf || null,
      pdfError: previewPayload.pdfError || null,
    });
  }, [mode, onApply, previewPayload]);

  const handleClear = useCallback(() => {
    setConfirmedMeta(null);
    setPreviewPayload(null);
    setError('');
    onClear?.();
  }, [onClear]);

  const handleViewConfirmed = useCallback(() => {
    if (!confirmedMeta) return;
    openEntaxiDiavgeiaDocument(confirmedMeta, { showToast });
  }, [confirmedMeta, showToast]);

  const previewMapped = previewPayload?.decision
    ? mapDiavgeiaDecisionToEntaxiFields(previewPayload.decision, previewPayload.extracted, mode)
    : null;

  const extracted = previewMapped?.parsed || previewPayload?.extracted || {};

  const looksLikeModification = entaxiDiavgeiaParse.subjectLooksLikeEntaxiModification(
    extracted.subject || previewPayload?.decision?.subject
  );

  return (
    <Section data-testid="ent-diavgeia-section">
      <SectionTitle>Ανάκτηση από Διαύγεια (προαιρετικό)</SectionTitle>
      <Hint>
        Εισάγετε τον ΑΔΑ της απόφασης ένταξης. Η εφαρμογή φέρνει τα στοιχεία από τη Διαύγεια
        και διαβάζει το έγγραφο για ποσό, κωδικό ΟΠΣ, προθεσμία νομικής δέσμευσης (NoΔε)
        και λήξη της πράξης.
        Ελέγξτε την προεπισκόπηση πριν την εφαρμογή στη φόρμα. Μπορείτε να ξανακάνετε
        ανάκτηση οποιαδήποτε στιγμή.
      </Hint>

      <AdaRow>
        <AdaInput
          type="text"
          value={adaInput}
          onChange={(e) => setAdaInput(e.target.value)}
          onKeyDown={handleAdaKeyDown}
          placeholder="π.χ. ΨΩΚΖ7ΛΚ-8ΦΤ"
          data-testid="ent-diavgeia-ada"
        />
        <FetchBtn
          type="button"
          onClick={handleFetch}
          disabled={loading}
          data-testid="ent-diavgeia-fetch"
        >
          {loading ? 'Ανάκτηση…' : (confirmedMeta ? 'Νέα ανάκτηση' : 'Ανάκτηση')}
        </FetchBtn>
      </AdaRow>

      {error ? <ErrorText data-testid="ent-diavgeia-error">{error}</ErrorText> : null}

      {previewPayload && previewMapped ? (
        <PreviewBox data-testid="ent-diavgeia-preview">
          <PreviewTitle>Βρέθηκε πράξη στη Διαύγεια</PreviewTitle>
          <PreviewMeta>
            {previewMapped.preview.ada ? <div><strong>ΑΔΑ:</strong> {previewMapped.preview.ada}</div> : null}
            {previewMapped.preview.protocolNumber ? (
              <div><strong>Πρωτόκολλο:</strong> {previewMapped.preview.protocolNumber}</div>
            ) : null}
            {previewMapped.preview.organization ? (
              <div><strong>Φορέας:</strong> {previewMapped.preview.organization}</div>
            ) : null}
            {extracted.subject ? (
              <div><strong>Θέμα εγγράφου:</strong> {extracted.subject}</div>
            ) : previewMapped.preview.subject ? (
              <div><strong>Θέμα ανάρτησης:</strong> {previewMapped.preview.subject}</div>
            ) : null}
            {previewMapped.preview.issueDateDisplay ? (
              <div><strong>Ημερομηνία έκδοσης:</strong> {previewMapped.preview.issueDateDisplay}</div>
            ) : null}
            {extracted.opsCode ? <div><strong>ΟΠΣ εγγράφου:</strong> {extracted.opsCode}</div> : null}
            {extracted.initialAmount ? <div><strong>Ποσό:</strong> {extracted.initialAmount} €</div> : null}
            {extracted.legalCommitmentDeadline ? (
              <div>
                <strong>Προθεσμία ΝοΔε:</strong>
                {' '}
                {formatDateEl(extracted.legalCommitmentDeadline, extracted.legalCommitmentDeadline)}
              </div>
            ) : (
              <div>
                <strong>Προθεσμία ΝοΔε:</strong>
                {' '}
                {extracted.noObligationDeadline
                  ? 'το έγγραφο γράφει ότι δεν υπάρχει τέτοια προθεσμία'
                  : 'δεν βρέθηκε ημερομηνία στο κείμενο του αρχείου'}
              </div>
            )}
            {extracted.endDate ? (
              <div>
                <strong>Λήξη πράξης:</strong>
                {' '}
                {formatDateEl(extracted.endDate, extracted.endDate)}
              </div>
            ) : null}
            {extracted.beneficiary ? <div><strong>Δικαιούχος:</strong> {extracted.beneficiary}</div> : null}
          </PreviewMeta>

          {mode === 'new' && looksLikeModification ? (
            <WarnBanner>
              Το θέμα φαίνεται να αφορά <strong>τροποποίηση</strong> ένταξης.
              Επιβεβαιώστε ότι χρησιμοποιείτε τη σωστή φόρμα.
            </WarnBanner>
          ) : null}

          {mode === 'modification' && !looksLikeModification ? (
            <WarnBanner>
              Το θέμα δεν αναφέρει ρητά «τροποποίηση». Ελέγξτε ότι ο ΑΔΑ αντιστοιχεί σε τροποποίηση.
            </WarnBanner>
          ) : null}

          {extracted.opsMismatch || extracted.subjectMismatch ? (
            <WarnBanner data-testid="ent-diavgeia-ops-mismatch">
              Η ανάρτηση στη Διαύγεια έχει άλλο θέμα/ΟΠΣ από το συνημμένο αρχείο
              {extracted.subjectOpsCode && extracted.pdfOpsCode
                ? ` (ανάρτηση ${extracted.subjectOpsCode} · έγγραφο ${extracted.pdfOpsCode})`
                : ''}
              . Στη φόρμα θα μπει το όνομα όπως είναι γραμμένο στο αρχείο. Ελέγξτε ότι είναι το σωστό έγγραφο.
            </WarnBanner>
          ) : null}

          {previewPayload.pdfError ? (
            <WarnBanner>{previewPayload.pdfError}</WarnBanner>
          ) : null}

          {previewMapped.missingFromPdf.length > 0 ? (
            <WarnBanner>
              Δεν βρέθηκαν στο έγγραφο: {previewMapped.missingFromPdf.join(' · ')}.
              Συμπληρώστε τα χειροκίνητα μετά την εφαρμογή.
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
            <ApplyBtn type="button" onClick={handleApply} data-testid="ent-diavgeia-apply">
              Εφαρμογή στη φόρμα
            </ApplyBtn>
            <CancelBtn type="button" onClick={() => setPreviewPayload(null)}>
              Ακύρωση
            </CancelBtn>
          </PreviewActions>
        </PreviewBox>
      ) : null}

      {confirmedMeta && !previewPayload ? (
        <ConfirmedBanner data-testid="ent-diavgeia-confirmed">
          <ConfirmedTitle>✓ Συνδέθηκε πράξη Διαύγειας</ConfirmedTitle>
          <PreviewMeta>
            <div><strong>ΑΔΑ:</strong> {confirmedMeta.ada}</div>
            {confirmedMeta.protocolNumber ? (
              <div><strong>Πρωτόκολλο:</strong> {confirmedMeta.protocolNumber}</div>
            ) : null}
          </PreviewMeta>
          <ViewBtn type="button" onClick={handleViewConfirmed} data-testid="ent-diavgeia-view">
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

export default EntaxiDiavgeiaSection;
