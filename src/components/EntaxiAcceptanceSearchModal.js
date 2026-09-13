import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { formatDateEl } from '../utils/dateFormat';
import { openEntaxiDiavgeiaDocument } from '../utils/entaxiDiavgeiaRegistry';
import { useToast } from './ToastProvider';
import entaxiCatalog from '../../app/core/entaxiCatalog';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 1.15rem;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  background: #ffffff;
  border-radius: 18px;
  width: min(calc(100% - 0.5rem), 720px);
  max-height: min(90%, 780px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.20),
    0 24px 56px -16px rgba(15, 23, 42, 0.32),
    0 8px 24px rgba(79, 70, 229, 0.10);
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: white;
  padding: 0.85rem 1.2rem 0.8rem;
  flex-shrink: 0;
`;

const Eyebrow = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.88;
  margin-bottom: 0.25rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.3;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.2rem 1.1rem;
  background: #fafbff;
`;

const Hint = styled.p`
  margin: 0 0 0.85rem;
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.5;
`;

const ErrorText = styled.div`
  color: #b91c1c;
  font-size: 0.88rem;
  line-height: 1.45;
`;

const EmptyHint = styled.div`
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.5;
`;

const Card = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 0.65rem;
  padding: 0.85rem 0.95rem;
  border-radius: 12px;
  border: 1px solid ${(p) => (p.$selected ? 'rgba(79, 70, 229, 0.55)' : 'rgba(148, 163, 184, 0.28)')};
  background: ${(p) => (p.$selected ? '#eef2ff' : '#fff')};
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  font-family: inherit;

  &:hover {
    border-color: rgba(79, 70, 229, 0.45);
    background: #f5f3ff;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.3rem;
`;

const CardRole = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #4338ca;
`;

const CardCheck = styled.span`
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 6px;
  border: 1.5px solid ${(p) => (p.$on ? '#4f46e5' : 'rgba(148, 163, 184, 0.55)')};
  background: ${(p) => (p.$on ? '#4f46e5' : '#fff')};
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.1rem;
  text-align: center;
`;

const CardSubject = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.4;
`;

const CardMeta = styled.div`
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #475569;
  line-height: 1.45;
`;

const SuccessBox = styled.div`
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.95rem 0.6rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: #f8fafc;
`;

const Btn = styled.button`
  padding: 0.48rem 1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const GhostBtn = styled(Btn)`
  background: #fff;
  color: #334155;
  border: 1px solid rgba(148, 163, 184, 0.35);

  &:hover:not(:disabled) {
    background: #f1f5f9;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: #4f46e5;
  color: #fff;
  border: none;

  &:hover:not(:disabled) {
    background: #4338ca;
  }
`;

function EntaxiAcceptanceSearchModal({
  entaxi,
  modification = null,
  organizationName = '',
  onClose,
  onAttached,
  onCreateProject,
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedAdas, setSelectedAdas] = useState([]);
  const [previewAda, setPreviewAda] = useState('');
  const [done, setDone] = useState(null);
  const entaxiRef = useRef(entaxi);
  entaxiRef.current = entaxi;

  const isModification = Boolean(modification?.modificationId);
  const runSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    setCandidates([]);
    setSelectedAdas([]);
    setPreviewAda('');
    try {
      const res = await ipcRenderer.invoke('diavgeia-search-entaxi-acceptance', {
        entaxi: entaxiRef.current,
        organizationName,
        modification: isModification ? modification : null,
      });
      if (!res?.success) {
        setError(res?.error || 'Η αναζήτηση στη Διαύγεια απέτυχε.');
        return;
      }
      setCandidates(Array.isArray(res.candidates) ? res.candidates : []);
    } catch (e) {
      setError(e?.message || 'Η αναζήτηση στη Διαύγεια απέτυχε.');
    } finally {
      setLoading(false);
    }
  }, [entaxi?.entaxiId, organizationName, isModification, modification?.modificationId]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const selected = candidates.filter((c) => selectedAdas.includes(c.ada));
  const preview = selected.find((c) => c.ada === previewAda) || selected[selected.length - 1] || null;

  const toggleAda = (ada) => {
    setSelectedAdas((prev) => {
      if (prev.includes(ada)) {
        const next = prev.filter((item) => item !== ada);
        setPreviewAda(next[next.length - 1] || '');
        return next;
      }
      setPreviewAda(ada);
      return [...prev, ada];
    });
  };

  const handleConfirm = useCallback(async () => {
    if (!selected.length || !entaxi?.entaxiId) return;
    setAttaching(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('diavgeia-attach-entaxi-acceptance', {
        entaxiId: entaxi.entaxiId,
        candidates: selected,
        modificationId: isModification ? modification.modificationId : undefined,
      });
      if (!res?.success) {
        setError(res?.error || 'Δεν αποθηκεύτηκαν τα αρχεία αποδοχής.');
        return;
      }
      setDone(res);
      const count = Array.isArray(res.pdfFileNames) ? res.pdfFileNames.length : 1;
      if (res.partial && Array.isArray(res.failedAdas) && res.failedAdas.length) {
        showToast(
          `Αποθηκεύτηκαν ${count} πράξεις. Δεν κατέβηκε αρχείο για: ${res.failedAdas.join(', ')}.`,
          'warning'
        );
      } else {
        showToast(
          count > 1
            ? (isModification
              ? `Αποθηκεύτηκαν ${count} πράξεις αποδοχής στην τροποποίηση.`
              : `Αποθηκεύτηκαν ${count} πράξεις αποδοχής στην ένταξη.`)
            : (isModification
              ? 'Η πράξη αποδοχής αποθηκεύτηκε στην τροποποίηση.'
              : 'Η πράξη αποδοχής αποθηκεύτηκε στην ένταξη.'),
          'success'
        );
      }
      onAttached?.(res.entaxi);
    } catch (e) {
      setError(e?.message || 'Δεν αποθηκεύτηκαν τα αρχεία αποδοχής.');
    } finally {
      setAttaching(false);
    }
  }, [entaxi, selected, onAttached, showToast, isModification, modification]);

  return (
    <Overlay
      data-testid={isModification ? 'ent-mod-acceptance-modal' : 'ent-acceptance-modal'}
      onClick={(e) => {
        if (e.target === e.currentTarget && !attaching) onClose?.();
      }}
    >
      <Modal onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Header>
          <Eyebrow>Διαύγεια</Eyebrow>
          <Title>
            {isModification
              ? 'Έλεγχος αποδοχής τροποποίησης'
              : 'Έλεγχος αποδοχής χρηματοδότησης'}
          </Title>
        </Header>
        <Body>
          {done ? (
            <SuccessBox data-testid={isModification ? 'ent-mod-acceptance-saved' : 'ent-acceptance-saved'}>
              {Array.isArray(done.pdfFileNames) && done.pdfFileNames.length > 1
                ? `Αποθηκεύτηκαν ${done.pdfFileNames.length} αρχεία αποδοχής (${done.pdfFileNames.join(', ')}).`
                : `Αποθηκεύτηκε ${done.meta?.roleLabel || 'το αρχείο αποδοχής'} (${done.pdfFileName || 'PDF'}).`}
              {!isModification && entaxiCatalog.isEntaxiUnlinked(done.entaxi || entaxi)
                ? ' Μπορείτε τώρα να δημιουργήσετε το αντίστοιχο έργο / υποέργο με προσυμπληρωμένα τα στοιχεία της ένταξης.'
                : ''}
            </SuccessBox>
          ) : loading ? (
            <Hint>Αναζήτηση αποδοχής στη Διαύγεια…</Hint>
          ) : error ? (
            <ErrorText data-testid="ent-acceptance-error">{error}</ErrorText>
          ) : candidates.length === 0 ? (
            <EmptyHint data-testid={isModification ? 'ent-mod-acceptance-empty' : 'ent-acceptance-empty'}>
              {isModification
                ? 'Δεν βρέθηκε ακόμα αποδοχή τροποποίησης ή απόφαση Δ.Σ. για προϋπολογισμό που να ταιριάζει με αυτή την τροποποίηση. Ελέγξτε αργότερα ή καταχωρήστε το αρχείο χειροκίνητα.'
                : 'Δεν βρέθηκε ακόμα απόφαση αποδοχής ή τροποποίησης προϋπολογισμού που να ταιριάζει με αυτή την ένταξη. Ελέγξτε αργότερα ή καταχωρήστε το αρχείο χειροκίνητα.'}
            </EmptyHint>
          ) : (
            <>
              <Hint>
                {isModification
                  ? 'Επιλέξτε μία ή περισσότερες πράξεις μετά την τροποποίηση — συνήθως την αποδοχή της Επιτροπής και την απόφαση του Δημοτικού Συμβουλίου για τον προϋπολογισμό. Πατήστε ξανά μια κάρτα για να την αφαιρέσετε.'
                  : 'Επιλέξτε μία ή περισσότερες πράξεις — συνήθως την αποδοχή της Επιτροπής και την απόφαση του Δημοτικού Συμβουλίου, από την οποία προκύπτουν συνήθως οι ΑΛΕ. Πατήστε ξανά μια κάρτα για να την αφαιρέσετε.'}
              </Hint>
              {candidates.map((row) => (
                <Card
                  key={row.ada}
                  type="button"
                  $selected={selectedAdas.includes(row.ada)}
                  aria-pressed={selectedAdas.includes(row.ada)}
                  data-testid={`${isModification ? 'ent-mod-acceptance-candidate' : 'ent-acceptance-candidate'}-${row.ada}`}
                  onClick={() => toggleAda(row.ada)}
                >
                  <CardTop>
                    <CardRole>{row.roleLabel || 'Πράξη Διαύγειας'}</CardRole>
                    <CardCheck $on={selectedAdas.includes(row.ada)} aria-hidden>
                      {selectedAdas.includes(row.ada) ? '✓' : ''}
                    </CardCheck>
                  </CardTop>
                  <CardSubject>{row.subject}</CardSubject>
                  <CardMeta>
                    ΑΔΑ {row.ada}
                    {row.issueDate ? ` · ${formatDateEl(row.issueDate, row.issueDate)}` : ''}
                    {row.reasons?.length ? ` · ${row.reasons.join(' · ')}` : ''}
                  </CardMeta>
                </Card>
              ))}
            </>
          )}
        </Body>
        <Footer>
          <GhostBtn
            type="button"
            data-testid={isModification ? 'ent-mod-acceptance-close' : 'ent-acceptance-close'}
            disabled={attaching}
            onClick={onClose}
          >
            {done ? 'Κλείσιμο' : 'Άκυρο'}
          </GhostBtn>
          {done && !isModification && entaxiCatalog.isEntaxiUnlinked(done.entaxi || entaxi) ? (
            <PrimaryBtn
              type="button"
              data-testid="ent-acceptance-create"
              onClick={() => onCreateProject?.(done.entaxi || entaxi)}
            >
              Δημιουργία υποέργου
            </PrimaryBtn>
          ) : selected.length && !done ? (
            <>
              <GhostBtn
                type="button"
                onClick={() => openEntaxiDiavgeiaDocument(preview, { showToast })}
                disabled={!preview}
              >
                Προβολή στη Διαύγεια
              </GhostBtn>
              <PrimaryBtn
                type="button"
                data-testid={isModification ? 'ent-mod-acceptance-confirm' : 'ent-acceptance-confirm'}
                disabled={attaching}
                onClick={handleConfirm}
              >
                {attaching
                  ? 'Αποθήκευση…'
                  : selected.length > 1
                    ? `Αποθήκευση ${selected.length} πράξεων`
                    : (isModification ? 'Αποθήκευση στην τροποποίηση' : 'Αποθήκευση στην ένταξη')}
              </PrimaryBtn>
            </>
          ) : null}
        </Footer>
      </Modal>
    </Overlay>
  );
}

export default EntaxiAcceptanceSearchModal;
