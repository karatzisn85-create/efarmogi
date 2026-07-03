import React, { useEffect, useRef, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  buildDefaultExtensionFileName,
  isExtensionModalDirty,
  buildExtensionModalSnapshot,
} from '../utils/khmdhsManualContractExtension';
import { buildDefaultApeFileGroupTitle } from '../utils/khmdhsApeEntry';
import { buildDiavgeiaApePreview } from '../utils/diavgeiaApeFetch';
import { safeFileDialog } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';
import { formatDateEl } from '../utils/dateFormat';

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
  background: linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%);
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
    border-color: #d97706;
    box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18);
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
    border-color: #d97706;
    box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18);
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
    border-color: #d97706;
    color: #92400e;
    background: #fffbeb;
  }
`;

const FileChip = styled.div`
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  font-size: 0.76rem;
  color: #92400e;
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
  background: linear-gradient(135deg, #b45309, #d97706);
  color: #fff;
  box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35);
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

const DiavPreview = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: #f0fdfa;
  border: 1px solid #5eead4;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const DiavPreviewTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f766e;
`;

const DiavPreviewMeta = styled.div`
  font-size: 0.76rem;
  color: #115e59;
  line-height: 1.45;
`;

const FetchPreviewActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
`;

const ConfirmDiavBtn = styled(Btn)`
  background: #0d9488;
  color: #fff;
`;

const ManualEditBtn = styled(Btn)`
  background: #fff;
  color: #334155;
  border: 1px solid #cbd5e1;
`;

const ConfirmedBanner = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: #f0fdfa;
  border: 1px solid #5eead4;
`;

const ConfirmedBannerTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: #0f766e;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const ConfirmedBannerMeta = styled.div`
  font-size: 0.76rem;
  line-height: 1.45;
  color: #115e59;
`;

const ClearLinkBtn = styled.button`
  align-self: flex-start;
  margin-top: 0.15rem;
  border: none;
  border-radius: 8px;
  padding: 0.32rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  background: #fff;
  color: #64748b;
  border: 1px solid #cbd5e1;

  &:hover {
    color: #b91c1c;
    border-color: #fecaca;
    background: #fef2f2;
  }
`;

/**
 * @param {{
 *   isOpen: boolean,
 *   targetTitle?: string,
 *   initialNewEndDate?: string,
 *   initialDocumentDate?: string,
 *   initialComments?: string,
 *   initialFileName?: string,
 *   initialGroupTitle?: string,
 *   initialSourcePath?: string,
 *   initialDiavgeiaAda?: string,
 *   isNewEntry?: boolean,
 *   onFetchByDiavgeiaAda?: (ada: string) => Promise<{ success?: boolean, decision?: object, error?: string }>,
 *   onCancel: Function,
 *   onApply: Function,
 *   onRemove?: Function,
 * }} props
 */
export default function KhmdhsManualExtensionModal({
  isOpen,
  targetTitle = '',
  initialNewEndDate = '',
  initialDocumentDate = '',
  initialComments = '',
  initialFileName = '',
  initialGroupTitle = '',
  initialSourcePath = '',
  initialDiavgeiaAda = '',
  isNewEntry = false,
  onFetchByDiavgeiaAda,
  onCancel,
  onApply,
  onRemove,
}) {
  const [newEndDate, setNewEndDate] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [comments, setComments] = useState('');
  const [fileName, setFileName] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [fileCleared, setFileCleared] = useState(false);
  const [diavgeiaAda, setDiavgeiaAda] = useState('');
  const [diavgeiaFetchPreview, setDiavgeiaFetchPreview] = useState(null);
  const [diavgeiaFetchLoading, setDiavgeiaFetchLoading] = useState(false);
  const [diavgeiaFetchError, setDiavgeiaFetchError] = useState('');
  const [confirmedDiavgeiaAda, setConfirmedDiavgeiaAda] = useState('');
  const [confirmedDiavgeiaPreview, setConfirmedDiavgeiaPreview] = useState(null);
  const [error, setError] = useState('');
  const bodyScrollRef = useRef(null);
  const baselineSnapshotRef = useRef('');

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
    setNewEndDate(String(initialNewEndDate || '').slice(0, 10));
    setDocumentDate(String(initialDocumentDate || '').slice(0, 10));
    setComments(initialComments || '');
    setFileName(initialFileName || '');
    setGroupTitle(initialGroupTitle || buildDefaultApeFileGroupTitle(targetTitle));
    setSourcePath(initialSourcePath || '');
    setDiavgeiaAda(initialDiavgeiaAda || '');
    setDiavgeiaFetchPreview(null);
    setDiavgeiaFetchLoading(false);
    setDiavgeiaFetchError('');
    setConfirmedDiavgeiaAda(initialDiavgeiaAda || '');
    setConfirmedDiavgeiaPreview(null);
    setFileCleared(false);
    setError('');
    baselineSnapshotRef.current = buildExtensionModalSnapshot({
      newEndDate: String(initialNewEndDate || '').slice(0, 10),
      documentDate: String(initialDocumentDate || '').slice(0, 10),
      comments: initialComments || '',
      fileName: initialFileName || '',
      groupTitle: initialGroupTitle || buildDefaultApeFileGroupTitle(targetTitle),
      sourcePath: initialSourcePath || '',
      fileCleared: false,
      diavgeiaAda: initialDiavgeiaAda || '',
      confirmedDiavgeiaAda: initialDiavgeiaAda || '',
      diavgeiaFetchPreview: null,
    });
  }, [
    isOpen,
    initialNewEndDate,
    initialDocumentDate,
    initialComments,
    initialFileName,
    initialGroupTitle,
    initialSourcePath,
    initialDiavgeiaAda,
    targetTitle,
  ]);

  const handleRequestClose = useCallback(async () => {
    const dirty = isExtensionModalDirty(
      {
        newEndDate,
        documentDate,
        comments,
        fileName,
        groupTitle,
        sourcePath,
        fileCleared,
        diavgeiaAda,
        confirmedDiavgeiaAda,
        diavgeiaFetchPreview,
      },
      baselineSnapshotRef.current
    );
    if (dirty) {
      const ok = await showConfirm({
        title: 'Κλείσιμο χωρίς εφαρμογή',
        message: 'Υπάρχουν μη αποθηκευμένα στοιχεία στο παράθυρο παράτασης.',
        detail: 'Θέλετε να κλείσετε χωρίς να εφαρμοστούν οι αλλαγές;',
        confirmLabel: 'Κλείσιμο',
        cancelLabel: 'Συνέχεια επεξεργασίας',
        danger: false,
        icon: '⚠️',
      });
      if (!ok) return;
    }
    onCancel?.();
  }, [
    newEndDate,
    documentDate,
    comments,
    fileName,
    groupTitle,
    sourcePath,
    fileCleared,
    diavgeiaAda,
    confirmedDiavgeiaAda,
    diavgeiaFetchPreview,
    onCancel,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      handleRequestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, handleRequestClose]);

  if (!isOpen) return null;

  const hasExisting = !!String(initialNewEndDate || '').trim();
  const hasFileNow = !fileCleared && !!(sourcePath || fileName);

  const handlePickFile = async () => {
    try {
      const result = await safeFileDialog('open-file-dialog');
      if (result.canceled || !result.filePaths?.length) return;
      const path = result.filePaths[0];
      setSourcePath(path);
      setFileName(buildDefaultExtensionFileName(targetTitle, path));
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

  const handleConfirmDiavgeiaFetch = () => {
    if (!diavgeiaFetchPreview?.ada) return;
    if (diavgeiaFetchPreview.issueDate) {
      setDocumentDate(diavgeiaFetchPreview.issueDate);
    }
    setConfirmedDiavgeiaAda(diavgeiaFetchPreview.ada);
    setConfirmedDiavgeiaPreview({
      ...diavgeiaFetchPreview,
      appliedDocumentDate: diavgeiaFetchPreview.issueDate
        ? (diavgeiaFetchPreview.issueDateDisplay || formatDateEl(diavgeiaFetchPreview.issueDate, ''))
        : '',
    });
    setDiavgeiaFetchPreview(null);
    setDiavgeiaFetchError('');
    const suffix = `ΑΔΑ Διαύγειας: ${diavgeiaFetchPreview.ada}`;
    setComments((prev) => {
      const p = String(prev || '').trim();
      if (p.includes(diavgeiaFetchPreview.ada)) return p;
      return p ? `${p}\n${suffix}` : suffix;
    });
  };

  const handleClearDiavgeiaLink = () => {
    setConfirmedDiavgeiaAda('');
    setConfirmedDiavgeiaPreview(null);
  };

  const handleApply = () => {
    const endDate = String(newEndDate || '').slice(0, 10);
    if (!endDate) {
      setError('Συμπληρώστε τη νέα ημερομηνία λήξης της σύμβασης.');
      return;
    }
    setError('');

    const docDate = String(documentDate || '').slice(0, 10);
    let filePayload;
    if (fileCleared && (initialFileName || initialSourcePath)) {
      filePayload = null;
    } else if (hasFileNow) {
      filePayload = {
        sourcePath: sourcePath || undefined,
        fileName: String(fileName || '').trim() || buildDefaultExtensionFileName(targetTitle, sourcePath),
        groupTitle: String(groupTitle || '').trim() || buildDefaultApeFileGroupTitle(targetTitle),
      };
    }

    onApply?.({
      newEndDate: endDate,
      documentDate: docDate,
      comments: String(comments || '').trim(),
      file: filePayload,
      diavgeiaAda: confirmedDiavgeiaAda || undefined,
      diavgeiaPreview: confirmedDiavgeiaPreview || undefined,
    });
  };

  return (
    <Overlay
      data-khmdhs-extension-modal
      onClick={(e) => e.target === e.currentTarget && handleRequestClose()}
    >
      <Card onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Header>
          <Title>{isNewEntry ? 'Νέα παράταση' : 'Παράταση'} — {targetTitle || 'Σύμβαση'}</Title>
          <Sub>
            Καταχωρήστε νέα ημερομηνία λήξης της σύμβασης που δεν προκύπτει από το ΚΗΜΔΗΣ
            (π.χ. απόφαση δημάρχου), με προαιρετικό σχόλιο και έγγραφο τεκμηρίωσης.
          </Sub>
        </Header>
        <Body ref={bodyScrollRef} data-khmdhs-extension-scroll>
          <Field>
            Νέα ημερομηνία λήξης σύμβασης *
            <Input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              autoFocus
            />
          </Field>
          <Field>
            Ημερομηνία εγγράφου απόφασης
            <Input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </Field>
          <Field>
            Σχόλια
            <TextArea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="π.χ. Απόφαση Δημάρχου αρ. .../2026"
            />
          </Field>

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
                    Η ημερομηνία εγγράφου συμπληρώνεται αυτόματα — τη νέα ημερομηνία λήξης την ορίζετε εσείς.
                  </Hint>
                </DiavPreview>
              ) : null}
              {confirmedDiavgeiaAda && confirmedDiavgeiaPreview ? (
                <ConfirmedBanner>
                  <ConfirmedBannerTitle>✓ Συνδέθηκε πράξη Διαύγειας</ConfirmedBannerTitle>
                  <ConfirmedBannerMeta>
                    <div><strong>ΑΔΑ:</strong> {confirmedDiavgeiaPreview.ada}</div>
                    {confirmedDiavgeiaPreview.protocolNumber ? (
                      <div><strong>Πρωτόκολλο:</strong> {confirmedDiavgeiaPreview.protocolNumber}</div>
                    ) : null}
                    {confirmedDiavgeiaPreview.subject ? (
                      <div><strong>Θέμα:</strong> {confirmedDiavgeiaPreview.subject}</div>
                    ) : null}
                  </ConfirmedBannerMeta>
                  <Hint style={{ margin: 0, color: '#0f766e' }}>
                    Κατά την εφαρμογή, το PDF της Διαύγειας θα προστεθεί στα αρχεία (εκτός αν ανεβάσετε δικό σας).
                  </Hint>
                  <ClearLinkBtn type="button" onClick={handleClearDiavgeiaLink}>
                    Αφαίρεση σύνδεσης Διαύγειας
                  </ClearLinkBtn>
                </ConfirmedBanner>
              ) : null}
            </>
          ) : null}

          <SectionTitle>Έγγραφο παράτασης (προαιρετικό)</SectionTitle>
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
                  placeholder={buildDefaultExtensionFileName(targetTitle, sourcePath)}
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
              Μπορείτε να ανεβάσετε PDF ή άλλο έγγραφο (π.χ. απόφαση δημάρχου). Θα μπει κάτω από τη σχετική
              σύμβαση στα αρχεία του υποέργου.
            </Hint>
          )}

          {error ? <Error>{error}</Error> : null}
        </Body>
        <Footer>
          {hasExisting && onRemove ? (
            <RemoveBtn type="button" onClick={onRemove}>
              Αφαίρεση παράτασης
            </RemoveBtn>
          ) : null}
          <CancelBtn type="button" onClick={handleRequestClose}>
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
