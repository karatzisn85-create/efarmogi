import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import excelImport from '../../app/core/excelImport';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(3px);
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Card = styled.div`
  background: #f8fafc;
  width: min(880px, 100%);
  max-height: 90vh;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s ease;
  &:hover { background: rgba(255, 255, 255, 0.3); }
`;

const Body = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 10px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
`;

const IntroText = styled.p`
  color: #334155;
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0 0 1.2rem;
`;

const StepGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const StepCard = styled.div`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const StepCardTitle = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
`;

const StepBadge = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1;
`;

const StepCardDesc = styled.div`
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.5;
  flex: 1;
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 0.7rem 1.1rem;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease, opacity 0.15s;
  &:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryButton = styled.button`
  background: #fff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  border-radius: 9px;
  padding: 0.7rem 1.1rem;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  &:hover:not(:disabled) { background: #eef2ff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DangerButton = styled(PrimaryButton)`
  background: linear-gradient(135deg, #dc2626, #ef4444);
  &:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35); }
`;

const StatsRow = styled.div`
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 1.1rem;
`;

const StatBox = styled.div`
  flex: 1 1 140px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: 5px solid ${(p) => p.$color || '#6366f1'};
  border-radius: 10px;
  padding: 0.8rem 1rem;
`;

const StatNumber = styled.div`
  font-size: 1.6rem;
  font-weight: 800;
  color: ${(p) => p.$color || '#1e293b'};
  line-height: 1.1;
`;

const StatLabel = styled.div`
  font-size: 0.78rem;
  color: #64748b;
  margin-top: 0.2rem;
`;

const Section = styled.div`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.1rem;
  margin-bottom: 1.1rem;
`;

const SectionTitle = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 0.95rem;
  margin-bottom: 0.7rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Banner = styled.div`
  border-radius: 10px;
  padding: 0.8rem 1rem;
  font-size: 0.88rem;
  line-height: 1.5;
  margin-bottom: 1.1rem;
  background: ${(p) => (p.$kind === 'error' ? '#fef2f2' : p.$kind === 'warn' ? '#fffbeb' : '#eff6ff')};
  color: ${(p) => (p.$kind === 'error' ? '#991b1b' : p.$kind === 'warn' ? '#92400e' : '#1e40af')};
  border: 1px solid ${(p) => (p.$kind === 'error' ? '#fecaca' : p.$kind === 'warn' ? '#fde68a' : '#bfdbfe')};
`;

const IssueList = styled.div`
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff7f7;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: #fca5a5; border-radius: 4px; }
`;

const IssueRow = styled.div`
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid #fee2e2;
  font-size: 0.85rem;
  color: #7f1d1d;
  &:last-child { border-bottom: none; }
`;

const IssueRowLabel = styled.span`
  font-weight: 700;
  color: #b91c1c;
  margin-right: 0.4rem;
`;

const DupRow = styled.div`
  padding: 0.5rem 0.9rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.84rem;
  color: #475569;
  &:last-child { border-bottom: none; }
`;

const RadioOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid ${(p) => (p.$active ? '#6366f1' : '#e2e8f0')};
  background: ${(p) => (p.$active ? '#eef2ff' : '#fff')};
  border-radius: 9px;
  margin-bottom: 0.55rem;
  cursor: pointer;
  transition: all 0.12s ease;
`;

const RadioText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const RadioLabel = styled.span`
  font-weight: 700;
  color: #1e293b;
  font-size: 0.88rem;
`;

const RadioHint = styled.span`
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
`;

const Footer = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
`;

const Spinner = styled.span`
  display: inline-block;
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 0.4rem;
  vertical-align: -2px;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

function SubprojectExcelImportModal({ onClose, onImported }) {
  const { showToast } = useToast();
  const [step, setStep] = useState('intro'); // 'intro' | 'preview' | 'result'
  const [busy, setBusy] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [report, setReport] = useState(null);
  const [existingMode, setExistingMode] = useState('keep'); // 'keep' | 'wipe'
  const [duplicatePolicy, setDuplicatePolicy] = useState('skip'); // 'skip' | 'update' | 'create'
  const [result, setResult] = useState(null);

  const handleDownloadTemplate = useCallback(async () => {
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('export-subprojects-import-template');
      if (res && res.success) {
        showToast('Το πρότυπο αποθηκεύτηκε. Στείλτε το προς συμπλήρωση.', 'success');
      } else if (res && res.canceled) {
        // silent
      } else {
        showToast((res && res.error) || 'Δεν ήταν δυνατή η δημιουργία του προτύπου.', 'error');
      }
    } catch (e) {
      showToast('Σφάλμα κατά τη δημιουργία του προτύπου.', 'error');
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const runPreview = useCallback(async (filePath) => {
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('preview-subprojects-excel-import', { filePath });
      if (res && res.success) {
        setReport(res);
        setStep('preview');
      } else {
        showToast((res && res.error) || 'Δεν ήταν δυνατός ο έλεγχος του αρχείου.', 'error');
      }
    } catch (e) {
      showToast('Σφάλμα κατά τον έλεγχο του αρχείου.', 'error');
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const handleSelectFile = useCallback(async () => {
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('select-subprojects-import-xlsx');
      if (res && res.success) {
        setFileInfo({ filePath: res.filePath, fileName: res.fileName });
        await runPreview(res.filePath);
      } else if (!(res && res.canceled)) {
        showToast((res && res.error) || 'Δεν επιλέχθηκε αρχείο.', 'error');
      }
    } catch (e) {
      showToast('Σφάλμα κατά την επιλογή αρχείου.', 'error');
    } finally {
      setBusy(false);
    }
  }, [runPreview, showToast]);

  const handleCommit = useCallback(async () => {
    if (!fileInfo) return;
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('commit-subprojects-excel-import', {
        filePath: fileInfo.filePath,
        wipeExisting: existingMode === 'wipe',
        duplicatePolicy,
      });
      if (res && res.success) {
        setResult(res);
        setStep('result');
        if (typeof onImported === 'function') onImported(res);
      } else {
        showToast((res && res.error) || 'Η εισαγωγή απέτυχε.', 'error');
      }
    } catch (e) {
      showToast('Σφάλμα κατά την εισαγωγή.', 'error');
    } finally {
      setBusy(false);
    }
  }, [fileInfo, existingMode, duplicatePolicy, onImported, showToast]);

  const hasParseErrors = report && report.parseErrors && report.parseErrors.length > 0;
  const hasRowErrors = report && report.errorRows && report.errorRows.length > 0;
  const canCommit = excelImport.canCommitImport(report);
  const showExistingChoice = excelImport.showExistingWorksChoice(report);
  const showDuplicateChoice = excelImport.showDuplicatePolicyChoice(report, existingMode);

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <Card>
        <Header>
          <HeaderTitle>📥 Μαζική Εισαγωγή Έργων από Excel</HeaderTitle>
          <CloseButton onClick={() => { if (!busy) onClose(); }} title="Κλείσιμο">✕</CloseButton>
        </Header>

        <Body>
          {step === 'intro' && (
            <>
              <IntroText>
                Η διαδικασία αυτή προορίζεται για την <strong>αρχική εισαγωγή</strong> όλων των ενεργών
                έργων και υποέργων ενός Δήμου. Κατεβάστε το πρότυπο, δώστε το στους υπαλλήλους προς
                συμπλήρωση και, όταν είναι έτοιμο, επιλέξτε το εδώ. Θα δείτε αναλυτική αναφορά ελέγχου
                <strong> πριν</strong> αποθηκευτεί οτιδήποτε.
              </IntroText>
              <StepGrid>
                <StepCard>
                  <StepCardTitle><StepBadge>1</StepBadge> Κατέβασμα προτύπου</StepCardTitle>
                  <StepCardDesc>
                    Δημιουργεί ένα πλήρως μορφοποιημένο αρχείο Excel με έτοιμες λίστες επιλογής και
                    οδηγίες συμπλήρωσης.
                  </StepCardDesc>
                  <PrimaryButton onClick={handleDownloadTemplate} disabled={busy}>
                    {busy ? <Spinner /> : '⬇ '}Κατέβασμα προτύπου
                  </PrimaryButton>
                </StepCard>
                <StepCard>
                  <StepCardTitle><StepBadge>2</StepBadge> Εισαγωγή συμπληρωμένου</StepCardTitle>
                  <StepCardDesc>
                    Επιλέξτε το συμπληρωμένο αρχείο Excel. Θα ελεγχθεί γραμμή-γραμμή και θα δείτε τι θα
                    εισαχθεί πριν το επιβεβαιώσετε.
                  </StepCardDesc>
                  <SecondaryButton onClick={handleSelectFile} disabled={busy}>
                    {busy ? <Spinner /> : '📂 '}Επιλογή αρχείου Excel
                  </SecondaryButton>
                </StepCard>
              </StepGrid>
            </>
          )}

          {step === 'preview' && report && (
            <>
              <Banner $kind="info">
                Αρχείο: <strong>{fileInfo && fileInfo.fileName}</strong>
              </Banner>

              {hasParseErrors && (
                <Banner $kind="error">
                  Το αρχείο δεν διαβάστηκε σωστά:
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                    {report.parseErrors.map((pe, i) => (
                      <li key={i}>{pe.message}</li>
                    ))}
                  </ul>
                </Banner>
              )}

              {!hasParseErrors && !report.versionOk && (
                <Banner $kind="warn">
                  Το αρχείο δεν φαίνεται να προέρχεται από το επίσημο πρότυπο. Ο έλεγχος γίνεται με βάση
                  τις κεφαλίδες των στηλών. Για ασφάλεια, προτιμήστε το επίσημο πρότυπο.
                </Banner>
              )}

              {!hasParseErrors && (
                <StatsRow>
                  <StatBox $color="#6366f1">
                    <StatNumber $color="#4f46e5">{report.totalRows}</StatNumber>
                    <StatLabel>Γραμμές με δεδομένα</StatLabel>
                  </StatBox>
                  <StatBox $color="#16a34a">
                    <StatNumber $color="#16a34a">{report.validCount}</StatNumber>
                    <StatLabel>Έτοιμα προς εισαγωγή</StatLabel>
                  </StatBox>
                  <StatBox $color={hasRowErrors ? '#dc2626' : '#94a3b8'}>
                    <StatNumber $color={hasRowErrors ? '#dc2626' : '#94a3b8'}>
                      {report.errorRows.length}
                    </StatNumber>
                    <StatLabel>Γραμμές με λάθη</StatLabel>
                  </StatBox>
                </StatsRow>
              )}

              {hasRowErrors && (
                <Section>
                  <SectionTitle>⚠️ Γραμμές που χρειάζονται διόρθωση</SectionTitle>
                  <Banner $kind="error" style={{ marginBottom: '0.8rem' }}>
                    Η εισαγωγή δεν μπορεί να προχωρήσει όσο υπάρχουν λάθη. Διορθώστε το αρχείο και
                    επιλέξτε το ξανά.
                  </Banner>
                  <IssueList>
                    {report.errorRows.map((er) => (
                      <IssueRow key={er.excelRow}>
                        <IssueRowLabel>Γραμμή {er.excelRow}:</IssueRowLabel>
                        {er.messages.join(' · ')}
                      </IssueRow>
                    ))}
                  </IssueList>
                </Section>
              )}

              {!hasParseErrors && showExistingChoice && (
                <Section>
                  <SectionTitle>🗂️ Υπάρχουν ήδη {report.existingCount} έργα στην εφαρμογή</SectionTitle>
                  <RadioOption $active={existingMode === 'keep'}>
                    <input
                      type="radio"
                      checked={existingMode === 'keep'}
                      onChange={() => setExistingMode('keep')}
                    />
                    <RadioText>
                      <RadioLabel>Διατήρηση υπαρχόντων</RadioLabel>
                      <RadioHint>Τα ήδη καταχωρημένα παραμένουν και προστίθενται τα νέα από το Excel.</RadioHint>
                    </RadioText>
                  </RadioOption>
                  <RadioOption $active={existingMode === 'wipe'}>
                    <input
                      type="radio"
                      checked={existingMode === 'wipe'}
                      onChange={() => setExistingMode('wipe')}
                    />
                    <RadioText>
                      <RadioLabel>Πλήρης διαγραφή & αντικατάσταση</RadioLabel>
                      <RadioHint>
                        Διαγράφονται ΟΛΑ τα υπάρχοντα έργα και παραμένουν μόνο όσα εισάγονται τώρα. Μη
                        αναστρέψιμο.
                      </RadioHint>
                    </RadioText>
                  </RadioOption>
                </Section>
              )}

              {showDuplicateChoice && (
                <Section>
                  <SectionTitle>
                    🔁 {report.existingDuplicates.length} υποέργα υπάρχουν ήδη (ίδιος τίτλος έργου & υποέργου)
                  </SectionTitle>
                  <RadioOption $active={duplicatePolicy === 'skip'}>
                    <input type="radio" checked={duplicatePolicy === 'skip'} onChange={() => setDuplicatePolicy('skip')} />
                    <RadioText>
                      <RadioLabel>Παράλειψη</RadioLabel>
                      <RadioHint>Τα διπλότυπα αγνοούνται· το υπάρχον παραμένει ως έχει.</RadioHint>
                    </RadioText>
                  </RadioOption>
                  <RadioOption $active={duplicatePolicy === 'update'}>
                    <input type="radio" checked={duplicatePolicy === 'update'} onChange={() => setDuplicatePolicy('update')} />
                    <RadioText>
                      <RadioLabel>Ενημέρωση</RadioLabel>
                      <RadioHint>Τα στοιχεία του υπάρχοντος υποέργου ενημερώνονται από το Excel.</RadioHint>
                    </RadioText>
                  </RadioOption>
                  <RadioOption $active={duplicatePolicy === 'create'}>
                    <input type="radio" checked={duplicatePolicy === 'create'} onChange={() => setDuplicatePolicy('create')} />
                    <RadioText>
                      <RadioLabel>Δημιουργία νέου</RadioLabel>
                      <RadioHint>Δημιουργείται δεύτερο υποέργο, ανεξάρτητα από το υπάρχον.</RadioHint>
                    </RadioText>
                  </RadioOption>
                  <div style={{ marginTop: '0.7rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                    {report.existingDuplicates.map((d) => (
                      <DupRow key={d.excelRow}>
                        <strong>Γραμμή {d.excelRow}:</strong> {d.projectTitle} — {d.subprojectTitle}
                      </DupRow>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {step === 'result' && result && (
            <>
              <Banner $kind="info">Η εισαγωγή ολοκληρώθηκε.</Banner>
              <StatsRow>
                <StatBox $color="#16a34a">
                  <StatNumber $color="#16a34a">{result.created}</StatNumber>
                  <StatLabel>Νέα υποέργα</StatLabel>
                </StatBox>
                <StatBox $color="#2563eb">
                  <StatNumber $color="#2563eb">{result.updated}</StatNumber>
                  <StatLabel>Ενημερώσεις</StatLabel>
                </StatBox>
                <StatBox $color="#94a3b8">
                  <StatNumber $color="#94a3b8">{result.skipped}</StatNumber>
                  <StatLabel>Παραλείψεις</StatLabel>
                </StatBox>
                {result.wipeExisting && (
                  <StatBox $color="#dc2626">
                    <StatNumber $color="#dc2626">{result.deletedProjects}</StatNumber>
                    <StatLabel>Διαγράφηκαν έργα</StatLabel>
                  </StatBox>
                )}
              </StatsRow>
              {result.failed && result.failed.length > 0 && (
                <Section>
                  <SectionTitle>⚠️ Γραμμές που δεν εισήχθησαν ({result.failed.length})</SectionTitle>
                  <IssueList>
                    {result.failed.map((f) => (
                      <IssueRow key={f.excelRow}>
                        <IssueRowLabel>Γραμμή {f.excelRow}:</IssueRowLabel>
                        {f.error}
                      </IssueRow>
                    ))}
                  </IssueList>
                </Section>
              )}
            </>
          )}
        </Body>

        <Footer>
          {step === 'intro' && (
            <>
              <span />
              <SecondaryButton onClick={onClose} disabled={busy}>Κλείσιμο</SecondaryButton>
            </>
          )}

          {step === 'preview' && (
            <>
              <SecondaryButton onClick={() => { setStep('intro'); setReport(null); }} disabled={busy}>
                ← Πίσω
              </SecondaryButton>
              {existingMode === 'wipe' ? (
                <DangerButton onClick={handleCommit} disabled={!canCommit || busy}>
                  {busy ? <Spinner /> : '🗑️ '}Διαγραφή όλων & Εισαγωγή {report ? report.validCount : ''}
                </DangerButton>
              ) : (
                <PrimaryButton onClick={handleCommit} disabled={!canCommit || busy}>
                  {busy ? <Spinner /> : '✔ '}Επιβεβαίωση εισαγωγής {report ? report.validCount : ''}
                </PrimaryButton>
              )}
            </>
          )}

          {step === 'result' && (
            <>
              <span />
              <PrimaryButton onClick={onClose} disabled={busy}>Ολοκλήρωση</PrimaryButton>
            </>
          )}
        </Footer>
      </Card>
    </Overlay>
  );
}

export default SubprojectExcelImportModal;
