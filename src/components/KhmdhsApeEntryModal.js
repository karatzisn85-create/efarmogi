import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  buildDefaultApeFileGroupTitle,
  buildDefaultApeFileName,
  formatApeAmountDisplay,
  getApeKhmdhsReferenceAmountLabel,
} from '../utils/khmdhsApeEntry';
import { buildApeFetchPreview } from '../utils/khmdhsApeFetch';
import {
  buildDiavgeiaApePreview,
  buildDiavgeiaApeCommentSuffix,
} from '../utils/diavgeiaApeFetch';
import { safeFileDialog } from '../utils/safeDialogs';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.94) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13100;
  padding: 1rem;
  overflow-y: auto;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 18px;
  max-width: 520px;
  width: 100%;
  max-height: min(92vh, 720px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
  animation: ${popIn} 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  margin: auto;
`;

const Header = styled.div`
  padding: 1.2rem 1.35rem 1rem;
  background: linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%);
  color: #fff;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const Sub = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  opacity: 0.95;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1.15rem 1.35rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    width: 9px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.12);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.45);
    border-radius: 999px;
  }
`;

const SectionTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-top: 0.15rem;
`;

const RefBox = styled.div`
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  font-size: 0.78rem;
  color: #166534;
  line-height: 1.45;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #334155;
`;

const Input = styled.input`
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const TextArea = styled.textarea`
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.86rem;
  font-family: inherit;
  min-height: 4.5rem;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const FileRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
`;

const FilePickBtn = styled.button`
  border: 1.5px dashed #94a3b8;
  border-radius: 10px;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  background: #f8fafc;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    border-color: #6366f1;
    color: #4338ca;
    background: #eef2ff;
  }
`;

const FileChip = styled.div`
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  font-size: 0.76rem;
  color: #1e40af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SmallBtn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.38rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  background: #fee2e2;
  color: #b91c1c;
`;

const Hint = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
  font-weight: 500;
`;

const Error = styled.div`
  font-size: 0.76rem;
  color: #b91c1c;
  font-weight: 600;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.85rem 1.35rem 1.2rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.52rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
`;

const CancelBtn = styled(Btn)`
  background: #f1f5f9;
  color: #475569;
`;

const RemoveBtn = styled(Btn)`
  background: #fff;
  color: #b91c1c;
  border: 1.5px solid #fecaca;
  margin-right: auto;
`;

const ApplyBtn = styled(Btn)`
  background: linear-gradient(135deg, #059669, #10b981);
  color: #fff;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
`;

const FetchBtn = styled(Btn)`
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  flex-shrink: 0;
  white-space: nowrap;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const AdamRow = styled.div`
  display: flex;
  gap: 0.45rem;
  align-items: stretch;

  ${Input} {
    flex: 1;
    min-width: 0;
  }
`;

const FetchPreview = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const FetchPreviewTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #1e3a8a;
`;

const FetchPreviewMeta = styled.div`
  font-size: 0.76rem;
  color: #1e40af;
  line-height: 1.45;
`;

const FetchPreviewActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
`;

const ConfirmFetchBtn = styled(Btn)`
  background: #1d4ed8;
  color: #fff;
`;

const DiavPreview = styled(FetchPreview)`
  background: #f0fdfa;
  border-color: #5eead4;
`;

const DiavPreviewTitle = styled(FetchPreviewTitle)`
  color: #0f766e;
`;

const DiavPreviewMeta = styled(FetchPreviewMeta)`
  color: #115e59;
`;

const ConfirmDiavBtn = styled(ConfirmFetchBtn)`
  background: #0d9488;
`;

const ManualEditBtn = styled(Btn)`
  background: #fff;
  color: #334155;
  border: 1px solid #cbd5e1;
`;

/**
 * @param {{
 *   isOpen: boolean,
 *   targetTitle?: string,
 *   khmdhsAmount?: string,
 *   initialApeAmount?: string,
 *   initialComments?: string,
 *   initialFileName?: string,
 *   initialGroupTitle?: string,
 *   initialSourcePath?: string,
 *   initialSourceAdam?: string,
 *   initialDiavgeiaAda?: string,
 *   initialDocumentDate?: string,
 *   isNewEntry?: boolean,
 *   onFetchByAdam?: (adam: string) => Promise<{ success?: boolean, snapshot?: object, error?: string }>,
 *   onFetchByDiavgeiaAda?: (ada: string) => Promise<{ success?: boolean, decision?: object, error?: string }>,
 *   onCancel: Function,
 *   onApply: Function,
 *   onRemove?: Function,
 * }} props
 */
export default function KhmdhsApeEntryModal({
  isOpen,
  targetTitle = '',
  targetKind = 'contract',
  khmdhsAmount = '',
  initialApeAmount = '',
  initialComments = '',
  initialFileName = '',
  initialGroupTitle = '',
  initialSourcePath = '',
  initialSourceAdam = '',
  initialDiavgeiaAda = '',
  initialDocumentDate = '',
  isNewEntry = false,
  onFetchByAdam,
  onFetchByDiavgeiaAda,
  onCancel,
  onApply,
  onRemove,
}) {
  const [apeAmount, setApeAmount] = useState('');
  const [comments, setComments] = useState('');
  const [fileName, setFileName] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [fileCleared, setFileCleared] = useState(false);
  const [apeAdam, setApeAdam] = useState('');
  const [khmdhsFetchPreview, setKhmdhsFetchPreview] = useState(null);
  const [khmdhsFetchLoading, setKhmdhsFetchLoading] = useState(false);
  const [khmdhsFetchError, setKhmdhsFetchError] = useState('');
  const [confirmedSourceAdam, setConfirmedSourceAdam] = useState('');
  const [confirmedKhmdhsMeta, setConfirmedKhmdhsMeta] = useState(null);
  const [diavgeiaAda, setDiavgeiaAda] = useState('');
  const [diavgeiaFetchPreview, setDiavgeiaFetchPreview] = useState(null);
  const [diavgeiaFetchLoading, setDiavgeiaFetchLoading] = useState(false);
  const [diavgeiaFetchError, setDiavgeiaFetchError] = useState('');
  const [confirmedDiavgeiaAda, setConfirmedDiavgeiaAda] = useState('');
  const [confirmedDiavgeiaPreview, setConfirmedDiavgeiaPreview] = useState(null);
  const [documentDate, setDocumentDate] = useState('');
  const [error, setError] = useState('');
  const bodyScrollRef = useRef(null);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || !isOpen) return undefined;

    const onWheel = (e) => {
      if (!el.contains(e.target)) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const next = Math.min(maxScroll, Math.max(0, el.scrollTop + e.deltaY));
      if (next === el.scrollTop) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = next;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setApeAmount(initialApeAmount || '');
    setComments(initialComments || '');
    setDocumentDate(String(initialDocumentDate || '').slice(0, 10));
    setFileName(initialFileName || '');
    setGroupTitle(
      initialGroupTitle || buildDefaultApeFileGroupTitle(targetTitle)
    );
    setSourcePath(initialSourcePath || '');
    setApeAdam(initialSourceAdam || '');
    setKhmdhsFetchPreview(null);
    setKhmdhsFetchLoading(false);
    setKhmdhsFetchError('');
    setConfirmedSourceAdam(initialSourceAdam || '');
    setConfirmedKhmdhsMeta(null);
    setDiavgeiaAda(initialDiavgeiaAda || '');
    setDiavgeiaFetchPreview(null);
    setDiavgeiaFetchLoading(false);
    setDiavgeiaFetchError('');
    setConfirmedDiavgeiaAda(initialDiavgeiaAda || '');
    setConfirmedDiavgeiaPreview(null);
    setFileCleared(false);
    setError('');
  }, [
    isOpen,
    initialApeAmount,
    initialComments,
    initialFileName,
    initialGroupTitle,
    initialSourcePath,
    initialSourceAdam,
    initialDiavgeiaAda,
    initialDocumentDate,
    targetTitle,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const khmdhsFmt = formatApeAmountDisplay(khmdhsAmount);
  const hasExisting = !!String(initialApeAmount || '').trim();
  const hasFileNow = !fileCleared && !!(sourcePath || fileName);

  const handlePickFile = async () => {
    try {
      const result = await safeFileDialog('open-file-dialog');
      if (result.canceled || !result.filePaths?.length) return;
      const path = result.filePaths[0];
      setSourcePath(path);
      setFileName(buildDefaultApeFileName(targetTitle, path));
      if (!groupTitle.trim()) {
        setGroupTitle(buildDefaultApeFileGroupTitle(targetTitle));
      }
      setFileCleared(false);
    } catch {
      setError('Δεν ήταν δυνατή η επιλογή αρχείου.');
    }
  };

  const handleClearFile = () => {
    setSourcePath('');
    setFileName('');
    setFileCleared(true);
  };

  const handleFetchByAdam = async () => {
    if (!onFetchByAdam) return;
    const seed = String(apeAdam || '').trim();
    if (!seed) {
      setKhmdhsFetchError('Συμπληρώστε ΑΔΑΜ σύμβασης (SYMV) για ανάκτηση.');
      return;
    }
    setKhmdhsFetchError('');
    setKhmdhsFetchLoading(true);
    setKhmdhsFetchPreview(null);
    try {
      const res = await onFetchByAdam(seed);
      if (!res?.success) {
        setKhmdhsFetchError(res?.error || 'Αποτυχία ανάκτησης από ΚΗΜΔΗΣ.');
        return;
      }
      const preview = buildApeFetchPreview(res.snapshot, seed);
      if (!preview.amount && !preview.title) {
        setKhmdhsFetchError('Δεν βρέθηκαν επαρκή στοιχεία — συμπληρώστε χειροκίνητα.');
        return;
      }
      setKhmdhsFetchPreview(preview);
    } catch (e) {
      setKhmdhsFetchError(e?.message || 'Σφάλμα ανάκτησης.');
    } finally {
      setKhmdhsFetchLoading(false);
    }
  };

  const handleFetchByDiavgeiaAda = async () => {
    if (!onFetchByDiavgeiaAda) return;
    const seed = String(diavgeiaAda || '').trim();
    if (!seed) {
      setDiavgeiaFetchError('Συμπληρώστε τον ΑΔΑ της Διαύγειας.');
      return;
    }
    setDiavgeiaFetchError('');
    setDiavgeiaFetchLoading(true);
    setDiavgeiaFetchPreview(null);
    try {
      const res = await onFetchByDiavgeiaAda(seed);
      if (!res?.success) {
        setDiavgeiaFetchError(res?.error || 'Αποτυχία ανάκτησης από Διαύγεια.');
        return;
      }
      const preview = buildDiavgeiaApePreview(res.decision);
      if (!preview.ada && !preview.subject) {
        setDiavgeiaFetchError('Δεν βρέθηκαν επαρκή στοιχεία στη Διαύγεια.');
        return;
      }
      setDiavgeiaFetchPreview(preview);
    } catch (e) {
      setDiavgeiaFetchError(e?.message || 'Σφάλμα ανάκτησης.');
    } finally {
      setDiavgeiaFetchLoading(false);
    }
  };

  const handleConfirmKhmdhsFetch = () => {
    if (!khmdhsFetchPreview) return;
    if (khmdhsFetchPreview.amount) {
      setApeAmount(khmdhsFetchPreview.amount);
    }
    setConfirmedSourceAdam(khmdhsFetchPreview.adam || apeAdam);
    setConfirmedKhmdhsMeta({
      title: khmdhsFetchPreview.title || '',
      signedDate: khmdhsFetchPreview.signedDate || '',
      signedDateDisplay: khmdhsFetchPreview.signedDateDisplay || '',
      adam: khmdhsFetchPreview.adam || apeAdam,
    });
    setKhmdhsFetchPreview(null);
    setKhmdhsFetchError('');
  };

  const handleConfirmDiavgeiaFetch = () => {
    if (!diavgeiaFetchPreview?.ada) return;
    setConfirmedDiavgeiaAda(diavgeiaFetchPreview.ada);
    setConfirmedDiavgeiaPreview(diavgeiaFetchPreview);
    setDiavgeiaFetchPreview(null);
    setDiavgeiaFetchError('');
    const suffix = buildDiavgeiaApeCommentSuffix(diavgeiaFetchPreview);
    if (suffix) {
      setComments((prev) => {
        const p = String(prev || '').trim();
        if (p.includes(diavgeiaFetchPreview.ada)) return p;
        return p ? `${p}\n${suffix}` : suffix;
      });
    }
  };

  const handleApply = () => {
    const trimmed = String(apeAmount || '').trim();
    if (!trimmed) {
      setError('Συμπληρώστε το ποσό ΑΠΕ (τελικό διαμορφωθέν, με ΦΠΑ).');
      return;
    }
    const docDate = String(documentDate || '').slice(0, 10);
    if (targetKind === 'contract' && !docDate) {
      setError('Συμπληρώστε την ημερομηνία του εγγράφου ΑΠΕ.');
      return;
    }
    setError('');

    let filePayload;
    if (fileCleared && (initialFileName || initialSourcePath)) {
      filePayload = null;
    } else if (hasFileNow) {
      filePayload = {
        sourcePath: sourcePath || undefined,
        fileName: String(fileName || '').trim() || buildDefaultApeFileName(targetTitle, sourcePath),
        groupTitle: String(groupTitle || '').trim() || buildDefaultApeFileGroupTitle(targetTitle),
      };
    }

    onApply?.({
      apeAmount: trimmed,
      documentDate: docDate,
      comments: String(comments || '').trim(),
      file: filePayload,
      sourceAdam: confirmedSourceAdam || undefined,
      sourceDiavgeiaAda: confirmedDiavgeiaAda || undefined,
      diavgeiaPreview: confirmedDiavgeiaPreview || undefined,
      khmdhsMeta: confirmedKhmdhsMeta || undefined,
    });
  };

  return (
    <Overlay
      data-khmdhs-ape-entry-modal
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
    >
      <Card onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Header>
          <Title>{isNewEntry ? 'Νέος ΑΠΕ' : 'ΑΠΕ'} — {targetTitle || 'Σύμβαση'}</Title>
          <Sub>
            {isNewEntry
              ? 'Προσθέστε νέα καταχώριση ΑΠΕ. Η ημερομηνία εγγράφου καθορίζει τη σειρά και ποιο ποσό ισχύει.'
              : 'Καταχωρήστε το τελικό διαμορφωθέν ποσό (με ΦΠΑ) και προαιρετικά το έγγραφο ΑΠΕ.'}
          </Sub>
        </Header>
        <Body ref={bodyScrollRef} data-khmdhs-ape-entry-scroll>
          {khmdhsFmt ? (
            <RefBox>
              <strong>{getApeKhmdhsReferenceAmountLabel({ kind: targetKind, parentTitle: targetTitle })}:</strong> {khmdhsFmt} €
            </RefBox>
          ) : null}
          {targetKind === 'contract' ? (
            <Field>
              Ημερομηνία εγγράφου *
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </Field>
          ) : null}
          <Field>
            Ποσό ΑΠΕ (με ΦΠΑ) *
            <Input
              type="text"
              value={apeAmount}
              onChange={(e) => setApeAmount(e.target.value)}
              placeholder="π.χ. 256.680,00"
              autoFocus
            />
          </Field>
          <Field>
            Σχόλια
            <TextArea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Προαιρετικά σχόλια για τον ΑΠΕ"
            />
          </Field>

          {onFetchByAdam ? (
            <>
              <SectionTitle>Ανάκτηση από ΚΗΜΔΗΣ (προαιρετικό)</SectionTitle>
              <Field>
                ΑΔΑΜ σύμβασης / τροποποίησης
                <AdamRow>
                  <Input
                    type="text"
                    value={apeAdam}
                    onChange={(e) => setApeAdam(e.target.value)}
                    placeholder="π.χ. 24SYMV015526678"
                  />
                  <FetchBtn
                    type="button"
                    onClick={handleFetchByAdam}
                    disabled={khmdhsFetchLoading}
                  >
                    {khmdhsFetchLoading ? 'Ανάκτηση…' : 'Ανάκτηση'}
                  </FetchBtn>
                </AdamRow>
              </Field>
              {khmdhsFetchError ? <Error>{khmdhsFetchError}</Error> : null}
              {khmdhsFetchPreview ? (
                <FetchPreview>
                  <FetchPreviewTitle>Βρέθηκαν στοιχεία από ΚΗΜΔΗΣ</FetchPreviewTitle>
                  <FetchPreviewMeta>
                    {khmdhsFetchPreview.adam ? <div><strong>ΑΔΑΜ:</strong> {khmdhsFetchPreview.adam}</div> : null}
                    {khmdhsFetchPreview.title ? <div><strong>Τίτλος:</strong> {khmdhsFetchPreview.title}</div> : null}
                    {khmdhsFetchPreview.amountDisplay ? (
                      <div><strong>Ποσό (με ΦΠΑ):</strong> {khmdhsFetchPreview.amountDisplay} €</div>
                    ) : null}
                    {khmdhsFetchPreview.signedDateDisplay ? (
                      <div><strong>Ημερομηνία:</strong> {khmdhsFetchPreview.signedDateDisplay}</div>
                    ) : null}
                  </FetchPreviewMeta>
                  <FetchPreviewActions>
                    <ConfirmFetchBtn type="button" onClick={handleConfirmKhmdhsFetch}>
                      Επιβεβαίωση στοιχείων
                    </ConfirmFetchBtn>
                    <ManualEditBtn type="button" onClick={() => setKhmdhsFetchPreview(null)}>
                      Ακύρωση
                    </ManualEditBtn>
                  </FetchPreviewActions>
                  <Hint>
                    Το ποσό ΑΠΕ συμπληρώνετε εσείς — η ανάκτηση ΚΗΜΔΗΣ μπορεί να προτείνει ποσό αναφοράς.
                  </Hint>
                </FetchPreview>
              ) : null}
              {confirmedSourceAdam ? (
                <Hint>Πηγή ΚΗΜΔΗΣ: {confirmedSourceAdam}</Hint>
              ) : null}
            </>
          ) : null}

          {onFetchByDiavgeiaAda ? (
            <>
              <SectionTitle>Ανάκτηση από Διαύγεια (προαιρετικό)</SectionTitle>
              <Field>
                ΑΔΑ Διαύγειας
                <AdamRow>
                  <Input
                    type="text"
                    value={diavgeiaAda}
                    onChange={(e) => setDiavgeiaAda(e.target.value)}
                    placeholder="π.χ. ΡΩΕΚΩΨΜ-Σ0Υ"
                  />
                  <FetchBtn
                    type="button"
                    onClick={handleFetchByDiavgeiaAda}
                    disabled={diavgeiaFetchLoading}
                  >
                    {diavgeiaFetchLoading ? 'Ανάκτηση…' : 'Ανάκτηση'}
                  </FetchBtn>
                </AdamRow>
              </Field>
              {diavgeiaFetchError ? <Error>{diavgeiaFetchError}</Error> : null}
              {diavgeiaFetchPreview ? (
                <DiavPreview>
                  <DiavPreviewTitle>Βρέθηκε πράξη στη Διαύγεια</DiavPreviewTitle>
                  <DiavPreviewMeta>
                    {diavgeiaFetchPreview.ada ? <div><strong>ΑΔΑ:</strong> {diavgeiaFetchPreview.ada}</div> : null}
                    {diavgeiaFetchPreview.protocolNumber ? (
                      <div><strong>Πρωτόκολλο:</strong> {diavgeiaFetchPreview.protocolNumber}</div>
                    ) : null}
                    {diavgeiaFetchPreview.organization ? (
                      <div><strong>Φορέας:</strong> {diavgeiaFetchPreview.organization}</div>
                    ) : null}
                    {diavgeiaFetchPreview.subject ? (
                      <div><strong>Θέμα:</strong> {diavgeiaFetchPreview.subject}</div>
                    ) : null}
                    {diavgeiaFetchPreview.issueDateDisplay ? (
                      <div><strong>Ημερομηνία:</strong> {diavgeiaFetchPreview.issueDateDisplay}</div>
                    ) : null}
                  </DiavPreviewMeta>
                  <FetchPreviewActions>
                    <ConfirmDiavBtn type="button" onClick={handleConfirmDiavgeiaFetch}>
                      Επιβεβαίωση στοιχείων
                    </ConfirmDiavBtn>
                    <ManualEditBtn type="button" onClick={() => setDiavgeiaFetchPreview(null)}>
                      Ακύρωση
                    </ManualEditBtn>
                  </FetchPreviewActions>
                  <Hint>
                    Το ποσό ΑΠΕ καταχωρείτε χειροκίνητα — η Διαύγεια δίνει διοικητικά στοιχεία και σύνδεσμο PDF.
                  </Hint>
                </DiavPreview>
              ) : null}
              {confirmedDiavgeiaAda ? (
                <Hint>
                  Πηγή Διαύγειας: {confirmedDiavgeiaAda}
                  {' — '}
                  κατά την εφαρμογή, το PDF θα προστεθεί αυτόματα στα αρχεία υποέργου (εκτός αν ανεβάσετε δικό σας αρχείο).
                </Hint>
              ) : null}
            </>
          ) : null}

          <SectionTitle>Έγγραφο ΑΠΕ (προαιρετικό)</SectionTitle>
          <FileRow>
            <FilePickBtn type="button" onClick={handlePickFile}>
              📎 Επιλογή αρχείου
            </FilePickBtn>
            {hasFileNow ? (
              <>
                <FileChip title={fileName || sourcePath}>
                  {fileName || sourcePath.split(/[/\\]/).pop()}
                </FileChip>
                <SmallBtn type="button" onClick={handleClearFile}>
                  Αφαίρεση
                </SmallBtn>
              </>
            ) : null}
          </FileRow>
          {hasFileNow ? (
            <>
              <Field>
                Όνομα αρχείου
                <Input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder={buildDefaultApeFileName(targetTitle, sourcePath)}
                />
              </Field>
              <Field>
                Θέση στα αρχεία υποέργου (ομάδα)
                <Input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder={buildDefaultApeFileGroupTitle(targetTitle)}
                />
              </Field>
              <Hint>
                Το αρχείο θα τοποθετηθεί στην ομάδα «{groupTitle || buildDefaultApeFileGroupTitle(targetTitle)}»
                στα αρχεία του υποέργου μετά την αποθήκευση.
              </Hint>
            </>
          ) : (
            <Hint>
              Μπορείτε να ανεβάσετε PDF ή άλλο έγγραφο ΑΠΕ. Θα μπει κάτω από τη σχετική σύμβαση στα αρχεία του υποέργου.
            </Hint>
          )}

          <Hint>
            Το ποσό ΑΠΕ είναι το ολικό τελικό ποσό — όχι μόνο η διαφορά/αναθεώρηση.
          </Hint>
          {error ? <Error>{error}</Error> : null}
        </Body>
        <Footer>
          {hasExisting && onRemove ? (
            <RemoveBtn type="button" onClick={onRemove}>
              Αφαίρεση ΑΠΕ
            </RemoveBtn>
          ) : null}
          <CancelBtn type="button" onClick={onCancel}>
            Ακύρωση
          </CancelBtn>
          <ApplyBtn type="button" onClick={handleApply}>
            Εφαρμογή
          </ApplyBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
