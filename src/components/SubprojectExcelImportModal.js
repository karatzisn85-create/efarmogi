import React, { useState, useCallback } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12000;
  padding: 1rem;
`;

const Panel = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  max-width: 720px;
  width: 100%;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
  color: white;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  opacity: 0.92;
`;

const Body = styled.div`
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const StepList = styled.ol`
  margin: 0 0 1rem;
  padding-left: 1.25rem;
  color: #334155;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1rem;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

const BtnPrimary = styled(Btn)`
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: white;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);
`;

const BtnSecondary = styled(Btn)`
  background: #e2e8f0;
  color: #334155;
`;

const BtnDanger = styled(Btn)`
  background: #dc2626;
  color: white;
`;

const Message = styled.div`
  font-size: 0.88rem;
  color: ${(p) => (p.$variant === 'error' ? '#b91c1c' : p.$variant === 'ok' ? '#047857' : '#475569')};
  margin: 0.5rem 0;
  white-space: pre-wrap;
`;

const ErrorList = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  max-height: 200px;
  overflow-y: auto;
  font-size: 0.82rem;
  color: #b91c1c;
`;

const PreviewTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.75rem;

  th,
  td {
    border: 1px solid #e2e8f0;
    padding: 0.35rem 0.5rem;
    text-align: left;
  }

  th {
    background: #e2e8f0;
    font-weight: 600;
  }
`;

/** Όνομα πεδίου για τον χρήστη (όχι εσωτερικοί κωδικοί πεδίων). */
function labelForValidationField(field) {
  if (!field) return '';
  const map = {
    projectTitle: 'Τίτλος Έργου',
    subprojectTitle: 'Τίτλος Υποέργου',
    implementationForm: 'Μορφή Υλοποίησης',
    kaCode: 'Κωδικός ΚΑ (προαιρετικό)',
    noKaCode: 'Δεν υπάρχει ΚΑ (ΝΑΙ/ΟΧΙ)',
    misPraxhsCode: 'Κωδικός Πράξης',
    misPraxhsName: 'Όνομα Κωδικού Πράξης',
    projectType: 'Είδος',
    fundingSource: 'Βασική Πηγή Χρηματοδότησης',
    fundingDetails: 'Εξειδίκευση Πηγής',
    approvedAmount: 'Εγκεκριμένο Ποσό',
    projectBudget: 'Προϋπολογισμός Έργου',
    projectStatus: 'Κατάσταση Έργου',
    contractProcessStartDate: 'Ημερ. Έναρξης Διαδικασίας Σύμβασης',
    contractDate: 'Ημερομηνία Υπογραφής',
    contractAmount: 'Ποσό Σύμβασης',
    apeAmount: 'ΑΠΕ + Συμπληρωματικές',
    apeComments: 'Σχόλια ΑΠΕ',
    contractsJson: 'Συμβάσεις (κείμενο λίστας)',
    eisigitikiEkthesi: 'Εισηγητική Έκθεση',
    comments: 'Σχόλια',
    remainingAmount: 'Υπόλοιπα για το Έτος',
    remainingAmountYear: 'Έτος υπολοίπου',
    remainingAmountComments: 'Σχόλια Υπολοίπων',
    aleCodes: 'Κωδ. Α.Λ.Ε.',
    aleRemainingAmounts: 'Υπόλοιπα ανά Α.Λ.Ε.',
    hasSupplementaryContracts: 'Υπάρχει Συμπληρωματική Σύμβαση (ΝΑΙ/ΟΧΙ)',
    supplementaryContractsJson: 'Συμπληρωματικές (κείμενο λίστας)'
  };
  if (map[field]) return map[field];
  const mDate = /^contractDate(\d+)$/.exec(field);
  if (mDate) return `Σύμβαση ${Number(mDate[1]) + 1}: ημερομηνία`;
  const mAmt = /^contractAmount(\d+)$/.exec(field);
  if (mAmt) return `Σύμβαση ${Number(mAmt[1]) + 1}: ποσό`;
  const mApe = /^apeAmount(\d+)$/.exec(field);
  if (mApe) return `Σύμβαση ${Number(mApe[1]) + 1}: ποσό ΑΠΕ`;
  return 'Πεδίο';
}

const Footer = styled.div`
  padding: 0.75rem 1.25rem 1.1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
  background: #fff;
`;

function SubprojectExcelImportModal({ isOpen, onClose, onImportSuccess }) {
  const [busy, setBusy] = useState(false);
  const [filePath, setFilePath] = useState(null);
  const [preview, setPreview] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState('');

  const resetState = useCallback(() => {
    setFilePath(null);
    setPreview(null);
    setStatusMessage('');
    setStatusVariant('');
    setBusy(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleExportTemplate = async () => {
    setBusy(true);
    setStatusMessage('');
    try {
      const res = await ipcRenderer.invoke('export-subprojects-import-template');
      if (res.canceled) {
        setStatusVariant('');
        setStatusMessage('Η αποθήκευση προτύπου ακυρώθηκε.');
      } else if (res.success && res.path) {
        setStatusVariant('ok');
        setStatusMessage(`Αποθηκεύτηκε: ${res.path}`);
      } else {
        setStatusVariant('error');
        setStatusMessage(res.error || 'Αποτυχία δημιουργίας προτύπου');
      }
    } catch (e) {
      setStatusVariant('error');
      setStatusMessage(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePickFile = async () => {
    setBusy(true);
    setStatusMessage('');
    try {
      const res = await ipcRenderer.invoke('select-subprojects-import-xlsx');
      if (res.canceled || !res.success) {
        setFilePath(null);
        setPreview(null);
        if (!res.canceled && res.error) {
          setStatusVariant('error');
          setStatusMessage(res.error);
        }
        return;
      }
      setFilePath(res.filePath);
      setPreview(null);
      setStatusVariant('ok');
      setStatusMessage(`Επιλέχθηκε αρχείο. Πατήστε «Προεπισκόπηση» για έλεγχο.`);
    } catch (e) {
      setStatusVariant('error');
      setStatusMessage(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!filePath) {
      setStatusVariant('error');
      setStatusMessage('Επιλέξτε πρώτα αρχείο .xlsx');
      return;
    }
    setBusy(true);
    setStatusMessage('');
    try {
      const res = await ipcRenderer.invoke('preview-subprojects-excel-import', filePath);
      if (!res.success) {
        setPreview(null);
        setStatusVariant('error');
        setStatusMessage(res.error || 'Σφάλμα προεπισκόπησης');
        return;
      }
      setPreview(res);
      const ve = res.validationErrors || [];
      const be = res.blockingErrors || [];
      if (be.length || ve.length) {
        setStatusVariant('error');
        setStatusMessage(
          `Γραμμές δεδομένων: ${res.rowCount}. Έγκυρες: ${res.validCount}. Υπάρχουν σφάλματα — διορθώστε το Excel πριν την εισαγωγή.`
        );
      } else {
        setStatusVariant('ok');
        setStatusMessage(
          `Όλα εντάξει. Γραμμές: ${res.rowCount}. Έτοιμες για εισαγωγή: ${res.validCount}.`
        );
      }
    } catch (e) {
      setStatusVariant('error');
      setStatusMessage(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!filePath) return;
    setBusy(true);
    setStatusMessage('');
    try {
      const res = await ipcRenderer.invoke('commit-subprojects-excel-import', filePath);
      if (!res.success) {
        setStatusVariant('error');
        const parts = [res.error || 'Αποτυχία εισαγωγής'];
        if (res.saved != null) parts.push(`Αποθηκεύτηκαν ${res.saved} πριν το σφάλμα.`);
        setStatusMessage(parts.join('\n'));
        return;
      }
      setStatusVariant('ok');
      setStatusMessage(`Ολοκληρώθηκε η εισαγωγή: ${res.saved} υποέργα.`);
      if (onImportSuccess) {
        await onImportSuccess();
      }
      await new Promise((r) => setTimeout(r, 1200));
      handleClose();
    } catch (e) {
      setStatusVariant('error');
      setStatusMessage(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const blockingErrors = preview?.blockingErrors || [];
  const validationErrors = preview?.validationErrors || [];
  const warnings = preview?.warnings || [];
  const previewRows = preview?.previewRows || [];
  const canCommit =
    filePath &&
    preview &&
    preview.success &&
    blockingErrors.length === 0 &&
    validationErrors.length === 0 &&
    (preview.validCount || 0) > 0;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && !busy && handleClose()}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Εισαγωγή υποέργων από Excel</Title>
          <Subtitle>
            Λήψη προτύπου, συμπλήρωση φύλλου «Υποέργα», προεπισκόπηση και οριστική εισαγωγή
          </Subtitle>
        </Header>
        <Body>
          <StepList>
            <li>
              Λάβετε το αρχείο προτύπου (Excel). Οι στήλες στο «Υποέργα» έχουν τους ίδιους τίτλους με τη φόρμα «Νέο υποέργο»· μην τους αλλάζετε. Στο «Υποέργα» ενδέχεται να εμφανίζονται κελιά με γκρι φόντο και διαγράμμιση όταν δεν χρειάζονται για τη συγκεκριμένη γραμμή — η τελική έγκριση γίνεται στην προεπισκόπηση.
            </li>
            <li>
              Συμπληρώστε το φύλλο «Υποέργα»: κάθε γραμμή είναι ένα υποέργο. Όσες γραμμές έχουν τον ίδιο τίτλο έργου
              (όπως τον γράφετε στη στήλη τίτλου έργου) ενώνονται κάτω από το ίδιο έργο· διαφορετικός τίτλος έργου σημαίνει
              ξεχωριστό έργο.
            </li>
            <li>Προεπισκόπηση· αν δεν υπάρχουν σφάλματα, εκτελέστε την οριστική εισαγωγή.</li>
          </StepList>

          <ButtonRow>
            <BtnPrimary type="button" disabled={busy} onClick={handleExportTemplate}>
              Λήψη προτύπου Excel
            </BtnPrimary>
            <BtnSecondary type="button" disabled={busy} onClick={handlePickFile}>
              Επιλογή αρχείου .xlsx
            </BtnSecondary>
            <BtnSecondary type="button" disabled={busy || !filePath} onClick={handlePreview}>
              Προεπισκόπηση / Έλεγχος
            </BtnSecondary>
            <BtnDanger type="button" disabled={busy || !canCommit} onClick={handleCommit}>
              Οριστική εισαγωγή
            </BtnDanger>
          </ButtonRow>

          {filePath && (
            <Message $variant="">
              <strong>Αρχείο:</strong> {filePath}
            </Message>
          )}
          {statusMessage && <Message $variant={statusVariant}>{statusMessage}</Message>}

          {blockingErrors.length > 0 && (
            <>
              <Message $variant="error">Σφάλματα μορφής / προτύπου</Message>
              <ErrorList>
                {blockingErrors.map((err, i) => (
                  <li key={`b-${i}`}>
                    {err.excelRow ? `Γραμμή ${err.excelRow}: ` : ''}
                    {err.message}
                  </li>
                ))}
              </ErrorList>
            </>
          )}

          {validationErrors.length > 0 && (
            <>
              <Message $variant="error">Σφάλματα επικύρωσης (ανά γραμμή)</Message>
              <ErrorList>
                {validationErrors.slice(0, 80).map((err, i) => (
                  <li key={`v-${i}`}>
                    Γραμμή {err.excelRow}
                    {err.field ? ` — ${labelForValidationField(err.field)}: ` : ': '}
                    {err.message}
                  </li>
                ))}
                {validationErrors.length > 80 && (
                  <li>… και {validationErrors.length - 80} ακόμη</li>
                )}
              </ErrorList>
            </>
          )}

          {warnings.length > 0 && (
            <>
              <Message $variant="">Προειδοποιήσεις</Message>
              <ErrorList style={{ color: '#92400e' }}>
                {warnings.map((w, i) => (
                  <li key={`w-${i}`}>
                    Γραμμή {w.excelRow}: {w.message}
                  </li>
                ))}
              </ErrorList>
            </>
          )}

          {previewRows.length > 0 && (
            <>
              <Message $variant="">Προεπισκόπηση (έως 50 γραμμές)</Message>
              <PreviewTable>
                <thead>
                  <tr>
                    <th>Γραμμή αρχείου</th>
                    <th>Έργο</th>
                    <th>Υποέργο</th>
                    <th>Κατάσταση</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.excelRow}>
                      <td>{r.excelRow}</td>
                      <td>{r.projectTitle}</td>
                      <td>{r.subprojectTitle}</td>
                      <td>{r.projectStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </PreviewTable>
            </>
          )}
        </Body>
        <Footer>
          <BtnSecondary type="button" disabled={busy} onClick={handleClose}>
            Κλείσιμο
          </BtnSecondary>
        </Footer>
      </Panel>
    </Overlay>
  );
}

export default SubprojectExcelImportModal;
