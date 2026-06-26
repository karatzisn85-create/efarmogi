import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { KHMDHS_SITUATION_SEVERITY } from '../utils/khmdhsSituationActions';
import { formatKhmdhsFoundLines, khmdhsStageLabelEl } from '../utils/khmdhsStageLabels';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.97) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const loadingSlide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
`;

const pulseAnim = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100002;
  padding: 1rem;
  animation: ${fadeIn} 0.2s ease;
`;

const Card = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 18px;
  max-width: 640px;
  width: 100%;
  max-height: min(88vh, 860px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
  animation: ${popIn} 0.26s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.25rem 1.4rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  background: ${(p) => {
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.ERROR) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.WARNING) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
  }};
  color: #fff;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
`;

const LoadingBarTrack = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255,255,255,0.2);
  overflow: hidden;
`;

const LoadingBarFill = styled.div`
  height: 100%;
  width: 40%;
  background: rgba(255,255,255,0.85);
  border-radius: 2px;
  animation: ${loadingSlide} 1.4s ease-in-out infinite;
`;

const FetchingBadge = styled.div`
  margin-top: 0.55rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  opacity: 0.92;
  font-weight: 600;
`;

const PulsingDot = styled.span`
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  animation: ${pulseAnim} 1.2s ease-in-out infinite;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
`;

const Sub = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.84rem;
  opacity: 0.94;
  line-height: 1.45;
`;

const Body = styled.div`
  overflow-y: auto;
  padding: 1rem 1.25rem;
  flex: 1;
  min-height: 0;
`;

const SituationCard = styled.div`
  border-radius: 12px;
  border: 1px solid ${(p) => {
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.ERROR) return 'rgba(239, 68, 68, 0.35)';
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.WARNING) return 'rgba(245, 158, 11, 0.4)';
    return 'rgba(99, 102, 241, 0.28)';
  }};
  background: ${(p) => {
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.ERROR) return '#fef2f2';
    if (p.$severity === KHMDHS_SITUATION_SEVERITY.WARNING) return '#fffbeb';
    return '#f8fafc';
  }};
  padding: 0.9rem 1rem;
  & + & {
    margin-top: 0.75rem;
  }
`;

const SituationTitle = styled.div`
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
`;

const SituationIcon = styled.span`
  flex-shrink: 0;
  font-size: 1rem;
`;

const SituationText = styled.p`
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #334155;
`;

const DetailList = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #475569;
`;

const ChainSummary = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #f1f5f9;
  padding: 0.75rem 0.9rem;
  margin-bottom: 0.85rem;
  font-size: 0.78rem;
  color: #475569;
  line-height: 1.5;
`;

const ChainSummaryTitle = styled.div`
  font-weight: 800;
  color: #334155;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
`;

const ChainLine = styled.div`
  & + & {
    margin-top: 0.2rem;
  }
  strong {
    color: #1e293b;
    font-weight: 700;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
`;

const ActionBtn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.72rem;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$primary ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#fff')};
  color: ${(p) => (p.$primary ? '#fff' : '#475569')};
  border: ${(p) => (p.$primary ? 'none' : '1px solid #cbd5e1')};
  box-shadow: ${(p) => (p.$primary ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none')};
  transition: transform 0.12s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

const DataToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(241, 245, 249, 0.7);
  color: #475569;
  border-radius: 6px;
  padding: 0.28rem 0.6rem;
  font-size: 0.73rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #e2e8f0;
  }
`;

const DataPanel = styled.div`
  margin-top: 0.55rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255,255,255,0.85);
  overflow: hidden;

  ${(p) => p.$open ? css`
    animation: ${fadeIn} 0.15s ease;
  ` : ''}
`;

const DataPanelRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 0.3rem 0.6rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.76rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);

  &:last-child {
    border-bottom: none;
  }
`;

const DataKey = styled.span`
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
`;

const DataVal = styled.span`
  color: #0f172a;
  font-weight: 500;
  word-break: break-word;
`;

const FetchingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  color: #6366f1;
  font-weight: 600;
  background: #eef2ff;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  flex-shrink: 0;
`;

const GhostBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  border-radius: 10px;
  padding: 0.55rem 0.95rem;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
`;

function severityIcon(severity) {
  if (severity === KHMDHS_SITUATION_SEVERITY.ERROR) return '⛔';
  if (severity === KHMDHS_SITUATION_SEVERITY.WARNING) return '⚠️';
  if (severity === KHMDHS_SITUATION_SEVERITY.SUCCESS) return '✅';
  return 'ℹ️';
}

function formatAmount(val) {
  if (val == null || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
  if (Number.isNaN(n)) return String(val);
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('el-GR');
  } catch {
    return String(val);
  }
}

/** Εξάγει τα πιο σημαντικά πεδία από snapshot (contract/award/notice/request) */
function extractSnapshotRows(snapshot, type) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const rows = [];
  const add = (key, label, fmt) => {
    const v = snapshot[key];
    if (v == null || v === '' || v === false) return;
    const displayed = fmt ? fmt(v) : String(v);
    if (displayed) rows.push({ key: label, val: displayed });
  };

  if (type === 'contract' || type === 'symv') {
    add('title', 'Αντικείμενο');
    add('anadoxosName', 'Ανάδοχος');
    add('contractBudget', 'Ποσό σύμβασης', formatAmount);
    add('contractSignedDate', 'Υπογραφή', formatDate);
    add('startDate', 'Έναρξη', formatDate);
    add('endDate', 'Λήξη', formatDate);
    if (snapshot.cancelled) rows.push({ key: 'Κατάσταση', val: '⛔ ΑΚΥΡΩΜΕΝΗ' });
    add('assigningAuthority', 'Αναθέτουσα');
  } else if (type === 'award' || type === 'awrd') {
    add('title', 'Αντικείμενο');
    if (snapshot.contractors?.length > 0) {
      const names = snapshot.contractors.map((c) => c.name).filter(Boolean).join(', ');
      if (names) rows.push({ key: 'Ανάδοχοι', val: names });
    } else {
      add('anadoxosName', 'Ανάδοχος');
    }
    add('totalCostWithoutVAT', 'Αξία χωρίς ΦΠΑ', formatAmount);
    add('totalCostWithVAT', 'Αξία με ΦΠΑ', formatAmount);
    add('auctionAmount', 'Συνολικό ποσό ανάθεσης', formatAmount);
    add('awardDate', 'Ημ/νία ανάθεσης', formatDate);
    add('procedureType', 'Τύπος διαδικασίας');
    add('organization', 'Αναθέτουσα');
    if (snapshot.numberOfSections > 1) rows.push({ key: 'Τμήματα', val: String(snapshot.numberOfSections) });
    const contracts = snapshot.contractRefNos?.length;
    if (contracts) rows.push({ key: 'Αριθμός συμβάσεων', val: String(contracts) });
    if (snapshot.cancelled) rows.push({ key: 'Κατάσταση', val: '⛔ ΑΚΥΡΩΜΕΝΗ' });
  } else if (type === 'notice' || type === 'proc') {
    add('title', 'Αντικείμενο');
    add('typeOfProcedure', 'Τύπος διαδικασίας');
    add('mappedAssignmentProcedure', 'Ανάθεση');
    add('totalCostWithoutVAT', 'Εκτιμώμενη αξία χωρίς ΦΠΑ', formatAmount);
    add('totalCostWithVAT', 'Εκτιμώμενη αξία με ΦΠΑ', formatAmount);
    add('signedDate', 'Ημ/νία διακήρυξης', formatDate);
    add('organization', 'Αναθέτουσα');
    if (snapshot.cancelled) rows.push({ key: 'Κατάσταση', val: '⛔ ΑΚΥΡΩΜΕΝΗ' });
  } else if (type === 'request' || type === 'req') {
    add('title', 'Αντικείμενο');
    add('budget', 'Προϋπολογισμός', formatAmount);
    add('totalCostWithoutVAT', 'Ποσό χωρίς ΦΠΑ', formatAmount);
    add('submissionDate', 'Ημ/νία', formatDate);
    add('organization', 'Φορέας');
    if (snapshot.cancelled) rows.push({ key: 'Κατάσταση', val: '⛔ ΑΚΥΡΩΜΕΝΗ' });
  } else {
    // Generic: show known useful fields
    const GENERIC_MAP = {
      title: 'Αντικείμενο',
      anadoxosName: 'Ανάδοχος',
      organization: 'Φορέας',
      totalCostWithoutVAT: 'Ποσό χωρίς ΦΠΑ',
      totalCostWithVAT: 'Ποσό με ΦΠΑ',
      contractBudget: 'Ποσό σύμβασης',
      budget: 'Προϋπολογισμός',
    };
    Object.entries(GENERIC_MAP).forEach(([k, label]) => {
      const v = snapshot[k];
      if (!v) return;
      const isAmount = label.includes('Ποσό') || label.includes('Προϋπολ');
      rows.push({ key: label, val: isAmount ? (formatAmount(v) || String(v)) : String(v) });
    });
  }
  return rows;
}

/** Επιλέγει ποιο snapshot να δείξει για κάθε situation */
function pickSnapshotForSituation(situation, chainSnapshots) {
  const id = situation?.id || '';
  const cs = chainSnapshots || {};

  if (id === 'parallel_contracts_same_case') {
    if (cs.award) return { snapshot: cs.award, type: 'award', label: 'Δεδομένα ανάθεσης (ΚΗΜΔΗΣ)' };
    if (cs.notice) return { snapshot: cs.notice, type: 'notice', label: 'Δεδομένα δημοσίευσης (ΚΗΜΔΗΣ)' };
  }
  if (id === 'orphan_symv_seed') {
    if (cs.contract) return { snapshot: cs.contract, type: 'contract', label: 'Δεδομένα σύμβασης (ΚΗΜΔΗΣ)' };
  }
  if (id === 'proc_without_contract' || id === 'contract_amount_fallback') {
    if (cs.award) return { snapshot: cs.award, type: 'award', label: 'Δεδομένα ανάθεσης (ΚΗΜΔΗΣ)' };
    if (cs.notice) return { snapshot: cs.notice, type: 'notice', label: 'Δεδομένα δημοσίευσης (ΚΗΜΔΗΣ)' };
  }
  if (id === 'alt_approved_requests' || id === 'req_only_early_stage') {
    if (cs.request) return { snapshot: cs.request, type: 'request', label: 'Δεδομένα αιτήματος (ΚΗΜΔΗΣ)' };
  }
  if (id === 'followup_commitment_no_supplementary') {
    if (cs.request) return { snapshot: cs.request, type: 'request', label: 'Δεδομένα πρωτογενούς (ΚΗΜΔΗΣ)' };
  }
  // fallback: pick first available
  if (cs.contract) return { snapshot: cs.contract, type: 'contract', label: 'Δεδομένα σύμβασης (ΚΗΜΔΗΣ)' };
  if (cs.award) return { snapshot: cs.award, type: 'award', label: 'Δεδομένα ανάθεσης (ΚΗΜΔΗΣ)' };
  if (cs.notice) return { snapshot: cs.notice, type: 'notice', label: 'Δεδομένα δημοσίευσης (ΚΗΜΔΗΣ)' };
  if (cs.request) return { snapshot: cs.request, type: 'request', label: 'Δεδομένα αιτήματος (ΚΗΜΔΗΣ)' };
  return null;
}

function SituationDataPanel({ situation, chainSnapshots, fetchingTargets }) {
  const [open, setOpen] = useState(false);
  const picked = useMemo(
    () => pickSnapshotForSituation(situation, chainSnapshots),
    [situation, chainSnapshots]
  );

  // Multi-contract rows (for parallel contracts situation)
  const contractRows = useMemo(() => {
    if (situation?.id !== 'parallel_contracts_same_case') return [];
    return (chainSnapshots?.contracts || []).map((c, idx) => ({
      idx,
      adam: c.adam,
      snapshot: c.snapshot,
      amount: c.amount,
      inferredSource: c.inferredSource,
      fetching: fetchingTargets?.includes(idx),
    }));
  }, [situation, chainSnapshots, fetchingTargets]);

  const hasData = picked || contractRows.length > 0;
  const isFetchingAny = contractRows.some((r) => r.fetching);

  if (!hasData) return null;

  const rows = picked ? extractSnapshotRows(picked.snapshot, picked.type) : [];

  return (
    <>
      <DataToggleBtn type="button" onClick={() => setOpen((v) => !v)}>
        <span>{open ? '▲' : '▼'}</span>
        {open ? 'Απόκρυψη δεδομένων' : 'Προβολή δεδομένων ΚΗΜΔΗΣ'}
        {isFetchingAny && <PulsingDot style={{ marginLeft: '0.25rem', background: '#6366f1' }} />}
      </DataToggleBtn>

      {open && (
        <DataPanel $open>
          {/* Κοινό snapshot (AWRD/PROC/SYMV/REQ) */}
          {rows.length > 0 && (
            <>
              {picked.label && (
                <DataPanelRow style={{ background: '#f1f5f9', fontWeight: 700, color: '#334155' }}>
                  <span style={{ gridColumn: '1 / -1', fontSize: '0.73rem' }}>{picked.label}</span>
                </DataPanelRow>
              )}
              {rows.map(({ key, val }) => (
                <DataPanelRow key={key}>
                  <DataKey>{key}</DataKey>
                  <DataVal>{val}</DataVal>
                </DataPanelRow>
              ))}
            </>
          )}

          {/* Ανά-γραμμή κατάσταση για παράλληλες συμβάσεις */}
          {contractRows.length > 0 && (
            <>
              <DataPanelRow style={{ background: '#f1f5f9', fontWeight: 700, color: '#334155' }}>
                <span style={{ gridColumn: '1 / -1', fontSize: '0.73rem' }}>Κατάσταση συμβάσεων</span>
              </DataPanelRow>
              {contractRows.map(({ idx, adam, snapshot: snap, amount, inferredSource, fetching }) => {
                // Για παράλληλες συμβάσεις: εξαιρούμε contractBudget από την εμφάνιση
                // γιατί το ΚΗΜΔΗΣ συχνά έχει λάθος τιμή (συνολικό ποσό αντί ανά σύμβαση)
                const rawRows = snap ? extractSnapshotRows(snap, 'contract') : [];
                const snapRows = rawRows.filter((r) => r.key !== 'Ποσό σύμβασης');
                return (
                  <React.Fragment key={idx}>
                    {fetching ? (
                      <FetchingRow>
                        <PulsingDot />
                        Σύμβαση {idx + 1}{adam ? ` · ${adam}` : ''} — ανακτάται…
                      </FetchingRow>
                    ) : snap ? (
                      <>
                        <DataPanelRow style={{ background: '#f8fafc', fontWeight: 600, color: '#334155', fontSize: '0.73rem' }}>
                          <span style={{ gridColumn: '1 / -1' }}>✅ Σύμβαση {idx + 1}{adam ? ` · ${adam}` : ''}</span>
                        </DataPanelRow>
                        {snapRows.slice(0, 3).map(({ key, val }) => (
                          <DataPanelRow key={`${idx}-${key}`}>
                            <DataKey>{key}</DataKey>
                            <DataVal>{val}</DataVal>
                          </DataPanelRow>
                        ))}
                        {amount ? (
                          <DataPanelRow>
                            <DataKey>Ποσό (με ΦΠΑ)</DataKey>
                            <DataVal>
                              {String(amount).includes('€') ? amount : `${amount} €`}
                              {inferredSource ? ` — ${inferredSource}` : ''}
                            </DataVal>
                          </DataPanelRow>
                        ) : (
                          <DataPanelRow style={{ color: '#92400e', fontStyle: 'italic', fontSize: '0.71rem' }}>
                            <span style={{ gridColumn: '1 / -1' }}>
                              💡 Ποσό: συμπληρώστε χειροκίνητα από το συμφωνητικό (PDF)
                            </span>
                          </DataPanelRow>
                        )}
                      </>
                    ) : (
                      <DataPanelRow style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        <span style={{ gridColumn: '1 / -1', fontSize: '0.73rem' }}>
                          ○ Σύμβαση {idx + 1}{adam ? ` · ${adam}` : ''} — δεν έχει ανακτηθεί ακόμα
                        </span>
                      </DataPanelRow>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </DataPanel>
      )}
    </>
  );
}

export default function KhmdhsSituationModal({
  isOpen,
  report,
  onAction,
  onDismiss,
  chainSnapshots,
  fetchingTargets,
}) {
  const stopWheel = useCallback((e) => e.stopPropagation(), []);
  const isFetching = Array.isArray(fetchingTargets) ? fetchingTargets.length > 0 : !!fetchingTargets;

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll('khmdhs-situation');
      return () => unlockBodyScroll('khmdhs-situation');
    }
    return undefined;
  }, [isOpen]);

  // Αυτόματο κλείσιμο: όταν όλες οι TRY_SYMV ενέργειες σε όλες τις situations
  // έχουν ανακτηθεί (έχουν snapshot) ΚΑΙ δεν τρέχει κάποιο fetch, κλείνουμε αυτόματα.
  useEffect(() => {
    if (!isOpen || isFetching) return;
    const situations = report?.situations || [];
    const allTrySymvActions = situations.flatMap((s) =>
      (s.actions || []).filter((a) => a.id === 'try_symv' && a.suggestedAdam)
    );
    if (allTrySymvActions.length === 0) return;
    const allFetched = allTrySymvActions.every((act) =>
      (chainSnapshots?.contracts || []).some(
        (c) => c.adam === act.suggestedAdam && c.snapshot != null
      )
    );
    if (!allFetched) return;
    // Όλες ανακτήθηκαν — κλείνουμε μετά από μικρή καθυστέρηση
    const timer = window.setTimeout(() => onDismiss?.(), 1200);
    return () => window.clearTimeout(timer);
  }, [isOpen, isFetching, report, chainSnapshots, onDismiss]);

  const chainFound = useMemo(
    () => formatKhmdhsFoundLines(report?.situations?.[0]?.found || {}),
    [report]
  );
  const chainMissing = report?.situations?.[0]?.missing || [];

  const fetchingLabel = useMemo(() => {
    if (!isFetching || !Array.isArray(fetchingTargets)) return null;
    const labels = fetchingTargets.map((t) => {
      if (t === 'single') return 'αλυσίδα';
      if (t === 'supplementary') return 'συμπληρωματική';
      if (typeof t === 'number') return `Σύμβαση ${t + 1}`;
      return String(t);
    });
    return `Ανακτώνται: ${labels.join(', ')}…`;
  }, [isFetching, fetchingTargets]);

  if (!isOpen || !report?.situations?.length) return null;

  const situations = report.situations;

  return (
    <Overlay
      onClick={(e) => e.target === e.currentTarget && onDismiss?.()}
      onWheel={stopWheel}
      data-khmdhs-situation-modal
    >
      <Card role="dialog" aria-modal="true" aria-labelledby="khmdhs-situation-title">
        <Header $severity={report.primarySeverity}>
          <Title id="khmdhs-situation-title">ΚΗΜΔΗΣ — Τι συνέβη και τι μπορείτε να κάνετε</Title>
          <Sub>
            {report.seedAdam
              ? `Κωδικός που δώσατε: ${report.seedAdam}${report.seedType ? ` (${khmdhsStageLabelEl(report.seedType)})` : ''}.`
              : 'Η ανάκτηση από το ΚΗΜΔΗΣ χρειάζεται την προσοχή σας.'}
            {' '}Διαβάστε κάθε ενότητα και επιλέξτε ενέργεια.
          </Sub>
          {isFetching && (
            <FetchingBadge>
              <PulsingDot />
              {fetchingLabel || 'Ανακτώνται δεδομένα στο παρασκήνιο…'}
            </FetchingBadge>
          )}
          {isFetching && (
            <LoadingBarTrack>
              <LoadingBarFill />
            </LoadingBarTrack>
          )}
        </Header>

        <Body onWheel={stopWheel}>
          {(chainFound.length > 0 || chainMissing.length > 0) && (
            <ChainSummary>
              <ChainSummaryTitle>Σχετικοί κωδικοί με τον ΑΔΑΜ που δώσατε</ChainSummaryTitle>
              {chainFound.map((line) => (
                <ChainLine key={line.label}>
                  <strong>{line.label}:</strong> {line.value}
                </ChainLine>
              ))}
              {chainMissing.length > 0 && (
                <ChainLine>
                  <strong>Δεν βρέθηκαν:</strong> {chainMissing.join(', ')}
                </ChainLine>
              )}
            </ChainSummary>
          )}
          {situations.map((situation) => {
            const trySymvActions = (situation.actions || []).filter(
              (a) => a.id === 'try_symv' && a.suggestedAdam
            );
            const allTrySymvFetched = trySymvActions.length > 0 && trySymvActions.every((act) =>
              (chainSnapshots?.contracts || []).some(
                (c) => c.adam === act.suggestedAdam && c.snapshot != null
              )
            );
            // Κρύβουμε την κάρτα αν όλες οι TRY_SYMV ενέργειες έχουν ολοκληρωθεί
            // (η εμφάνιση ✅ έγινε — δεν χρειάζεται να παραμείνει η κάρτα)
            if (allTrySymvFetched && !isFetching) return null;

            return (
            <SituationCard key={situation.id} $severity={situation.severity}>
              <SituationTitle>
                <SituationIcon aria-hidden>{severityIcon(situation.severity)}</SituationIcon>
                {situation.title}
              </SituationTitle>
              {situation.explanation ? (
                <SituationText>{situation.explanation}</SituationText>
              ) : null}
              {(situation.details || []).length > 0 && (
                <DetailList>
                  {situation.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </DetailList>
              )}

              {/* Inline προβολή δεδομένων ΚΗΜΔΗΣ */}
              <SituationDataPanel
                situation={situation}
                chainSnapshots={chainSnapshots}
                fetchingTargets={fetchingTargets}
              />

              {(situation.actions || []).length > 0 && (
                <ActionRow>
                  {situation.actions.map((act, actIdx) => {
                    const isTrySymv = act.id === 'try_symv' && act.suggestedAdam;
                    const fetchedEntry = isTrySymv
                      ? (chainSnapshots?.contracts || []).find(
                          (c) => c.adam && c.adam === act.suggestedAdam
                        )
                      : null;
                    const isAlreadyFetched = !!(fetchedEntry?.snapshot);
                    const contractIdx = isTrySymv
                      ? (chainSnapshots?.contracts || []).findIndex(
                          (c) => c.adam === act.suggestedAdam
                        )
                      : -1;
                    const isCurrentlyFetching = isTrySymv && contractIdx >= 0
                      && (fetchingTargets || []).includes(contractIdx);

                    // ACCEPT_PARTIAL ("Συνέχεια χωρίς σύμβαση") κρύβεται αν
                    // όλες οι παράλληλες συμβάσεις έχουν ήδη ανακτηθεί
                    if (act.id === 'accept_partial' && trySymvActions.length > 0) {
                      const anyFetched = trySymvActions.some((a) =>
                        (chainSnapshots?.contracts || []).some(
                          (c) => c.adam === a.suggestedAdam && c.snapshot != null
                        )
                      );
                      if (anyFetched) return null;
                    }

                    if (isAlreadyFetched) {
                      return (
                        <span
                          key={`${situation.id}-${act.id}-${actIdx}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.38rem 0.65rem',
                            borderRadius: '8px',
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            color: '#166534',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                          }}
                        >
                          ✅ {act.suggestedAdam} — Ανακτήθηκε
                        </span>
                      );
                    }

                    return (
                      <ActionBtn
                        key={`${situation.id}-${act.id}-${actIdx}`}
                        type="button"
                        $primary={false}
                        disabled={isCurrentlyFetching}
                        title={act.description || act.label}
                        onClick={() => onAction?.(act.id, situation.id, act)}
                      >
                        {isCurrentlyFetching ? `⏳ ${act.suggestedAdam || 'Ανακτάται…'}` : act.label}
                      </ActionBtn>
                    );
                  })}
                </ActionRow>
              )}
            </SituationCard>
            );
          })}
        </Body>

        <Footer>
          <GhostBtn type="button" onClick={onDismiss}>
            Κλείσιμο
          </GhostBtn>
        </Footer>
      </Card>
    </Overlay>
  );
}
