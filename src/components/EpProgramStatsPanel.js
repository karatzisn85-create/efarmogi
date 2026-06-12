import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import ExportSuccessModal from './ExportSuccessModal';

const ipcRenderer = window.electronAPI;

// ─── Layout ───────────────────────────────────────────────────────────────────
const Panel = styled.div``;

const SelectorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  padding: 0.85rem 1.2rem;
  background: #eef2ff;
  border: 1.5px solid #c7d2fe;
  border-radius: 12px;
`;

const Select = styled.select`
  flex: 1;
  min-width: 280px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  color: #1e293b;
  &:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
`;

// ─── KPI rows ─────────────────────────────────────────────────────────────────
const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.65rem;
  margin-bottom: 0.65rem;
`;

const KpiCard = styled.div`
  background: ${p => p.$bg || '#f8fafc'};
  border: 1.5px solid ${p => p.$border || '#e2e8f0'};
  border-top: 3px solid ${p => p.$accent || p.$border || '#e2e8f0'};
  border-radius: 10px;
  padding: 0.8rem 0.9rem 0.7rem;
  text-align: center;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  transition: box-shadow 0.15s, transform 0.12s;
  ${p => p.$clickable && `
    &:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.09); transform: translateY(-1px); }
  `}
`;

const KpiValue = styled.div`
  font-size: ${p => p.$sm ? '0.95rem' : '1.4rem'};
  font-weight: 900;
  color: ${p => p.$color || '#4338ca'};
  line-height: 1.15;
  letter-spacing: -0.3px;
`;

const KpiLabel = styled.div`
  font-size: 0.68rem;
  color: #64748b;
  margin-top: 0.22rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.35px;
`;

// ─── Year chips ───────────────────────────────────────────────────────────────
const YearStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1.25rem;
  padding: 0.65rem 0.9rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
`;

const YearChip = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #4338ca;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  padding: 0.25rem 0.65rem;
  span { color: #1e293b; }
`;

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.6rem;
`;

const TabBtn = styled.button`
  padding: 0.4rem 0.85rem;
  border: 1.5px solid ${p => p.$active ? '#6366f1' : 'transparent'};
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  background: ${p => p.$active ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9'};
  color: ${p => p.$active ? 'white' : '#475569'};
  transition: all 0.15s;
  &:hover:not([data-active="true"]) { background: #e8edf5; color: #334155; }
`;

// ─── Tables ───────────────────────────────────────────────────────────────────
const TableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 1rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.81rem;
`;

const Th = styled.th`
  background: linear-gradient(180deg, #b4c7e7, #9db8e0);
  color: #1e293b;
  font-weight: 700;
  padding: 0.55rem 0.5rem;
  text-align: ${p => p.$align || 'left'};
  border: 1px solid #94a3b8;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.45rem 0.5rem;
  border: 1px solid #e2e8f0;
  text-align: ${p => p.$align || 'left'};
  vertical-align: middle;
  background: ${p => p.$alt ? '#f8fafc' : 'white'};
  word-break: break-word;
`;

// ─── Progress bar ─────────────────────────────────────────────────────────────
const Bar = styled.div`
  background: #e2e8f0;
  border-radius: 99px;
  height: 7px;
  overflow: hidden;
  margin: 0.5rem 0 0.3rem;
`;

const BarFill = styled.div`
  height: 100%;
  border-radius: 99px;
  background: ${p => p.$color || 'linear-gradient(90deg,#6366f1,#818cf8)'};
  width: ${p => Math.min(p.$pct || 0, 100)}%;
  transition: width 0.6s ease;
`;

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = styled.div`
  background: white;
  border: 1.5px solid ${p => p.$border || '#e2e8f0'};
  border-top: 3px solid ${p => p.$accent || '#e2e8f0'};
  border-radius: 12px;
  padding: 1rem 1.2rem;
  margin-bottom: 1rem;
`;

const SectionTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
`;

// ─── Impl tab layout ──────────────────────────────────────────────────────────
const ImplGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const RateBox = styled.div`
  background: ${p => p.$bg || '#f0fdf4'};
  border: 2px solid ${p => p.$border || '#6ee7b7'};
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
  text-align: center;
`;

const RatePct = styled.div`
  font-size: 3.5rem;
  font-weight: 900;
  color: ${p => p.$color || '#059669'};
  letter-spacing: -2px;
  line-height: 1;
  margin-bottom: 0.4rem;
`;

const RateTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.7rem;
`;

const RateSubtitle = styled.div`
  font-size: 0.78rem;
  color: #334155;
  font-weight: 600;
  margin-top: 0.35rem;
`;

const RateNote = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 0.2rem;
`;

const LinkageRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin-bottom: 1rem;
`;

const LinkageCard = styled.div`
  background: white;
  border: 1.5px solid ${p => p.$border || '#e2e8f0'};
  border-radius: 10px;
  padding: 0.75rem 0.9rem;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: ${p => p.$accent || '#e2e8f0'};
  }
`;

const LinkageValue = styled.div`
  font-size: 1.45rem;
  font-weight: 900;
  color: ${p => p.$color || '#1e293b'};
  line-height: 1.1;
  margin-bottom: 0.2rem;
`;

const LinkageLabel = styled.div`
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const StatusDot = styled.div`
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #${p => p.$color};
  flex-shrink: 0;
`;

const StatusLabel = styled.div`
  flex: 1;
  font-size: 0.83rem;
  color: #334155;
  font-weight: 600;
`;

const StatusBarWrap = styled.div`
  width: 100px;
  background: #f1f5f9;
  border-radius: 4px;
  height: 5px;
  overflow: hidden;
  flex-shrink: 0;
`;

const StatusBarFill = styled.div`
  height: 100%;
  border-radius: 4px;
  background: #${p => p.$color};
  width: ${p => p.$pct}%;
`;

// ─── Bottom actions ───────────────────────────────────────────────────────────
const ActionsRow = styled.div`
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 2px solid #e9ecef;
`;

const Btn = styled.button`
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$primary ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9'};
  color: ${p => p.$primary ? 'white' : '#475569'};
  border: ${p => p.$primary ? '1.5px solid #4f46e5' : '1.5px solid #cbd5e1'};
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
`;

const EmptyBox = styled.div`
  text-align: center;
  padding: 2.5rem;
  color: #64748b;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatEuro(n) {
  return (Number(n) || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function pct(part, total) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// ─── StatDataTable ────────────────────────────────────────────────────────────
function StatDataTable({ rows, budgetYears, totalBudget, labelMaxWidth }) {
  if (!rows || rows.length === 0) {
    return <EmptyBox>Δεν υπάρχουν δεδομένα για αυτή την κατηγορία.</EmptyBox>;
  }
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Κατηγορία</Th>
            <Th $align="center">Πλήθος</Th>
            <Th $align="center">Νέες</Th>
            <Th $align="center">Συνεχ.</Th>
            {budgetYears.map(y => <Th key={y} $align="right">{y}</Th>)}
            <Th $align="right">Σύνολο</Th>
            <Th $align="right">%</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <Td $alt={i % 2 === 1} style={{ maxWidth: labelMaxWidth || 360 }}>{row.label}</Td>
              <Td $alt={i % 2 === 1} $align="center">{row.count}</Td>
              <Td $alt={i % 2 === 1} $align="center">{row.newCount}</Td>
              <Td $alt={i % 2 === 1} $align="center">{row.continuingCount}</Td>
              {budgetYears.map(y => (
                <Td key={y} $alt={i % 2 === 1} $align="right">{formatEuro(row.byYear?.[y] || 0)}</Td>
              ))}
              <Td $alt={i % 2 === 1} $align="right" style={{ fontWeight: 700 }}>{formatEuro(row.total)}</Td>
              <Td $alt={i % 2 === 1} $align="right">{pct(row.total, totalBudget)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

// ─── ImplTab ──────────────────────────────────────────────────────────────────
function ImplTab({ implStats }) {
  if (!implStats) {
    return (
      <EmptyBox>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔗</div>
        <strong>Δεν υπάρχουν δεδομένα υλοποίησης</strong>
        <p style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
          Συνδέστε υποέργα με δράσεις ΕΠ για να εμφανιστούν τα στατιστικά υλοποίησης.
        </p>
      </EmptyBox>
    );
  }

  const {
    totalActions, linkedCount, unlinkedCount, linkageRate,
    implementationRate, completionRate, completedCount, activeCount,
    byImplGroup, totalBudget, linkedBudget, hasLinkedData
  } = implStats;

  const linkedBudgetPct = totalBudget > 0 ? Math.round(linkedBudget / totalBudget * 100) : 0;

  return (
    <>
      {/* ── Κεντρικοί δείκτες υλοποίησης ── */}
      <Section $accent="#059669" $border="#6ee7b7">
        <SectionTitle>📊 Βαθμός Υλοποίησης βάσει Κατάστασης Υποέργων</SectionTitle>
        <ImplGrid>
          <RateBox $bg="#f0fdf4" $border="#6ee7b7">
            <RateTitle>Βαθμός Υλοποίησης</RateTitle>
            <RatePct $color="#059669">{implementationRate}%</RatePct>
            <Bar>
              <BarFill $pct={implementationRate} $color="linear-gradient(90deg,#059669,#34d399)" />
            </Bar>
            <RateSubtitle>{activeCount} από {totalActions} δράσεις</RateSubtitle>
            <RateNote>εκτελούμενα · ολοκληρωμένα · σε σύναψη σύμβασης</RateNote>
          </RateBox>

          <RateBox $bg="#f0fdf4" $border="#22c55e">
            <RateTitle>Βαθμός Ολοκλήρωσης</RateTitle>
            <RatePct $color="#15803d">{completionRate}%</RatePct>
            <Bar>
              <BarFill $pct={completionRate} $color="linear-gradient(90deg,#15803d,#22c55e)" />
            </Bar>
            <RateSubtitle>{completedCount} από {totalActions} δράσεις</RateSubtitle>
            <RateNote>ολοκληρωμένα · ολοκληρωμένα και αποπληρωμένα</RateNote>
          </RateBox>
        </ImplGrid>

        {/* Κατανομή ανά κατάσταση */}
        {hasLinkedData && byImplGroup.length > 0 && (
          <>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>
              Κατανομή {linkedCount} συνδεδεμένων δράσεων ανά κατάσταση υποέργου
            </div>
            <div>
              {byImplGroup.map((g) => (
                <StatusRow key={g.key}>
                  <StatusDot $color={g.color} />
                  <StatusLabel>{g.label}</StatusLabel>
                  <StatusBarWrap>
                    <StatusBarFill $pct={g.pct} $color={g.color} />
                  </StatusBarWrap>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: `#${g.color}`, minWidth: 28, textAlign: 'right' }}>{g.pct}%</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: 42, textAlign: 'right' }}>{g.count} δρ.</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', minWidth: 90, textAlign: 'right' }}>{formatEuro(g.budget)}</div>
                </StatusRow>
              ))}
            </div>
          </>
        )}
        {!hasLinkedData && (
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Δεν υπάρχουν συνδέσεις με υποέργα για υπολογισμό ποσοστών.
          </div>
        )}
      </Section>

      {/* ── Συσχέτιση ── */}
      <Section $accent="#6366f1" $border="#c7d2fe">
        <SectionTitle>🔗 Συσχέτιση Δράσεων ΕΠ με Υποέργα</SectionTitle>
        <LinkageRow>
          <LinkageCard $accent="#6366f1" $border="#c7d2fe">
            <LinkageValue $color="#4338ca">{linkedCount}</LinkageValue>
            <LinkageLabel>Συνδεδεμένες</LinkageLabel>
            <Bar style={{ margin: '0.5rem 0 0.3rem' }}>
              <BarFill $pct={linkageRate} $color="linear-gradient(90deg,#6366f1,#818cf8)" />
            </Bar>
            <div style={{ fontSize: '0.68rem', color: '#6366f1', fontWeight: 700 }}>{linkageRate}% του συνόλου</div>
          </LinkageCard>

          <LinkageCard $accent="#94a3b8" $border="#e2e8f0">
            <LinkageValue $color="#64748b">{unlinkedCount}</LinkageValue>
            <LinkageLabel>Χωρίς σύνδεση</LinkageLabel>
            <Bar style={{ margin: '0.5rem 0 0.3rem' }}>
              <BarFill $pct={100 - linkageRate} $color="#cbd5e1" />
            </Bar>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>{100 - linkageRate}% του συνόλου</div>
          </LinkageCard>

          <LinkageCard $accent="#f59e0b" $border="#fde68a">
            <LinkageValue $color="#92400e" style={{ fontSize: '1rem' }}>{formatEuro(linkedBudget)}</LinkageValue>
            <LinkageLabel>Π/Υ Συνδεδεμένων</LinkageLabel>
            <Bar style={{ margin: '0.5rem 0 0.3rem' }}>
              <BarFill $pct={linkedBudgetPct} $color="linear-gradient(90deg,#f59e0b,#fbbf24)" />
            </Bar>
            <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 700 }}>{linkedBudgetPct}% του Π/Υ</div>
          </LinkageCard>
        </LinkageRow>
      </Section>
    </>
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────────
const STAT_TABS = [
  { id: 'overview',  label: 'Σύνοψη' },
  { id: 'impl',      label: '🔗 Υλοποίηση' },
  { id: 'axis',      label: 'Άξονες' },
  { id: 'measure',   label: 'Μέτρα' },
  { id: 'type',      label: 'Είδος' },
  { id: 'funding',   label: 'Πηγές Χρηματ.' },
  { id: 'location',  label: 'Χωροθέτηση' },
  { id: 'priority',  label: 'Προτεραιότητα' },
  { id: 'top',       label: 'Κορυφαίες' }
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function EpProgramStatsPanel({ currentUser, appConfig }) {
  const { showToast } = useToast();
  const username = currentUser?.username || '';

  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const loadPrograms = useCallback(async () => {
    try {
      const res = await ipcRenderer.invoke('load-ep-programs', { requestingUsername: username });
      if (res.success) {
        const list = res.programs || [];
        setPrograms(list);
        const active = list.find(p => p.isActive);
        if (active) setSelectedProgramId(active.id);
        else if (list.length > 0) setSelectedProgramId(list[0].id);
      }
    } catch (e) {
      showToast('Σφάλμα φόρτωσης προγραμμάτων ΕΠ', 'error');
    }
  }, [username, showToast]);

  const loadStats = useCallback(async (programId) => {
    if (!programId) { setStats(null); return; }
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-ep-program-statistics', {
        programId,
        requestingUsername: username
      });
      if (res.success) setStats(res.stats);
      else {
        setStats(null);
        showToast(res.error || 'Σφάλμα φόρτωσης στατιστικών', 'error');
      }
    } catch (e) {
      setStats(null);
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [username, showToast]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);
  useEffect(() => { if (selectedProgramId) loadStats(selectedProgramId); }, [selectedProgramId, loadStats]);

  const handleExportExcel = async () => {
    if (!selectedProgramId) return;
    setExportingExcel(true);
    try {
      const res = await ipcRenderer.invoke('export-ep-program', {
        programId: selectedProgramId,
        requestingUsername: username
      });
      if (res.canceled) return;
      if (res.success && res.downloadPath) {
        setExportSuccess({ filePath: res.downloadPath, actionCount: res.actionCount, sheetCount: res.sheetCount, exportedAt: res.exportedAt });
      } else if (!res.success) {
        showToast(res.error || 'Σφάλμα εξαγωγής', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!stats) return;
    setExportingPdf(true);
    try {
      const { createElement } = await import('react');
      const { default: EpProgramStatsReport } = await import('./pdf/EpProgramStatsReport');
      const { pdf } = await import('@react-pdf/renderer');
      const reportEl = createElement(EpProgramStatsReport, { stats, appConfig });
      const blob = await pdf(reportEl).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const period = `${stats.program.startYear}-${stats.program.endYear}`;
      const defaultName = `ERGOHUB_Στατιστικά_ΕΠ_${period}.pdf`;
      const result = await ipcRenderer.invoke('save-pdf-file', {
        buffer: Array.from(new Uint8Array(arrayBuffer)),
        defaultName
      });
      if (result?.canceled) return;
      if (result?.success) showToast('Η αναφορά PDF αποθηκεύτηκε επιτυχώς!', 'success');
      else showToast(result?.error || 'Σφάλμα αποθήκευσης PDF', 'error');
    } catch (e) {
      console.error(e);
      showToast('Σφάλμα κατά τη δημιουργία PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  if (programs.length === 0 && !loading) {
    return (
      <EmptyBox>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
        <strong>Δεν υπάρχει Επιχειρησιακό Πρόγραμμα</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Εισάγετε πρώτα πρόγραμμα από τη σελίδα «Επιχειρησιακό Πρόγραμμα».
        </p>
      </EmptyBox>
    );
  }

  const budgetYears = stats?.budgetYears || [];
  const s = stats?.summary;
  const impl = stats?.implStats;

  return (
    <Panel>
      {/* Επιλογή προγράμματος */}
      <SelectorBar>
        <label style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
          🗺️ Επιχειρησιακό Πρόγραμμα:
        </label>
        <Select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)}>
          {programs.map(p => (
            <option key={p.id} value={p.id}>
              {p.title} {p.isActive ? '(ενεργό)' : '(αρχείο)'} — {p.actionCount} δράσεις
            </option>
          ))}
        </Select>
        {loading && <span style={{ color: '#64748b', fontSize: '0.83rem', whiteSpace: 'nowrap' }}>⏳ Φόρτωση…</span>}
      </SelectorBar>

      {stats && s && (
        <>
          {/* ── Σειρά 1: Βασικοί αριθμοί ── */}
          <KpiRow>
            <KpiCard $bg="#eef2ff" $border="#c7d2fe" $accent="#6366f1">
              <KpiValue>{s.actionCount}</KpiValue>
              <KpiLabel>Δράσεις</KpiLabel>
            </KpiCard>
            <KpiCard $bg="#f0fdf4" $border="#bbf7d0" $accent="#16a34a">
              <KpiValue $color="#16a34a" $sm>{formatEuro(s.totalBudget)}</KpiValue>
              <KpiLabel>Συνολικός Π/Υ</KpiLabel>
            </KpiCard>
            <KpiCard $accent="#059669">
              <KpiValue $color="#059669">{s.newCount}</KpiValue>
              <KpiLabel>Νέες</KpiLabel>
            </KpiCard>
            <KpiCard $accent="#d97706">
              <KpiValue $color="#d97706">{s.continuingCount}</KpiValue>
              <KpiLabel>Συνεχιζόμενες</KpiLabel>
            </KpiCard>
            <KpiCard $accent="#6366f1">
              <KpiValue>{s.axesCount}</KpiValue>
              <KpiLabel>Άξονες</KpiLabel>
            </KpiCard>
            <KpiCard $accent="#8b5cf6">
              <KpiValue>{s.measuresCount}</KpiValue>
              <KpiLabel>Μέτρα</KpiLabel>
            </KpiCard>
            <KpiCard $accent="#94a3b8">
              <KpiValue $color="#475569" $sm>{formatEuro(s.avgBudget)}</KpiValue>
              <KpiLabel>Μέσος Π/Υ/Δράση</KpiLabel>
            </KpiCard>
          </KpiRow>

          {/* ── Σειρά 2: Συσχέτιση & Υλοποίηση ── */}
          <KpiRow style={{ marginBottom: '1.1rem' }}>
            <KpiCard
              $bg="#ecfdf5" $border="#6ee7b7" $accent="#059669"
              $clickable onClick={() => setActiveTab('impl')}
              title="Δράσεις ΕΠ συνδεδεμένες με υποέργα"
            >
              <KpiValue $color="#059669">{s.linkedCount}</KpiValue>
              <KpiLabel style={{ color: '#059669' }}>Με σύνδεση ↗</KpiLabel>
            </KpiCard>
            <KpiCard
              $bg="#f8fafc" $border="#e2e8f0" $accent="#94a3b8"
              $clickable onClick={() => setActiveTab('impl')}
            >
              <KpiValue $color="#64748b">{s.unlinkedCount}</KpiValue>
              <KpiLabel>Χωρίς σύνδεση</KpiLabel>
            </KpiCard>
            <KpiCard
              $bg="#f0fdf4" $border="#6ee7b7" $accent="#059669"
              $clickable onClick={() => setActiveTab('impl')}
              title="Βαθμός υλοποίησης — κλικ για ανάλυση"
            >
              <KpiValue $color="#059669">{impl ? `${impl.implementationRate}%` : '—'}</KpiValue>
              <KpiLabel style={{ color: '#059669' }}>Βαθμός Υλοποίησης ↗</KpiLabel>
            </KpiCard>
            <KpiCard
              $bg="#f0fdf4" $border="#22c55e" $accent="#15803d"
              $clickable onClick={() => setActiveTab('impl')}
              title="Βαθμός ολοκλήρωσης — κλικ για ανάλυση"
            >
              <KpiValue $color="#15803d">{impl ? `${impl.completionRate}%` : '—'}</KpiValue>
              <KpiLabel style={{ color: '#15803d' }}>Βαθμός Ολοκλήρωσης ↗</KpiLabel>
            </KpiCard>
          </KpiRow>

          {/* ── Ετήσια κατανομή Π/Υ ── */}
          {budgetYears.length > 0 && (
            <YearStrip>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', alignSelf: 'center', marginRight: '0.25rem' }}>Π/Υ ανά έτος:</span>
              {budgetYears.map(y => (
                <YearChip key={y}>{y}: <span>{formatEuro(s.budgetByYear[y])}</span></YearChip>
              ))}
            </YearStrip>
          )}

          {/* ── Tabs ── */}
          <TabBar>
            {STAT_TABS.map(t => (
              <TabBtn key={t.id} $active={activeTab === t.id} data-active={String(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </TabBtn>
            ))}
          </TabBar>

          {/* ── Tab content ── */}
          {activeTab === 'overview' && (
            <>
              <StatDataTable rows={stats.byAxis}   budgetYears={budgetYears} totalBudget={s.totalBudget} labelMaxWidth={400} />
              <StatDataTable rows={stats.byType}   budgetYears={budgetYears} totalBudget={s.totalBudget} />
            </>
          )}
          {activeTab === 'impl'     && <ImplTab implStats={impl} />}
          {activeTab === 'axis'     && <StatDataTable rows={stats.byAxis}        budgetYears={budgetYears} totalBudget={s.totalBudget} labelMaxWidth={420} />}
          {activeTab === 'measure'  && <StatDataTable rows={stats.byMeasure}     budgetYears={budgetYears} totalBudget={s.totalBudget} labelMaxWidth={420} />}
          {activeTab === 'type'     && <StatDataTable rows={stats.byType}        budgetYears={budgetYears} totalBudget={s.totalBudget} />}
          {activeTab === 'funding'  && <StatDataTable rows={stats.byFunding}     budgetYears={budgetYears} totalBudget={s.totalBudget} labelMaxWidth={380} />}
          {activeTab === 'location' && <StatDataTable rows={stats.byLocation}    budgetYears={budgetYears} totalBudget={s.totalBudget} />}
          {activeTab === 'priority' && <StatDataTable rows={stats.byPriority}    budgetYears={budgetYears} totalBudget={s.totalBudget} />}
          {activeTab === 'top' && (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th $align="center">Α/Α</Th>
                    <Th>Τίτλος Δράσης</Th>
                    <Th>Είδος</Th>
                    <Th $align="center">Κατάσταση</Th>
                    <Th $align="right">Π/Υ</Th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.topByBudget || []).map((a, i) => (
                    <tr key={i}>
                      <Td $alt={i % 2 === 1} $align="center">{a.aa}</Td>
                      <Td $alt={i % 2 === 1}>{a.title}</Td>
                      <Td $alt={i % 2 === 1}>{a.actionType || '—'}</Td>
                      <Td $alt={i % 2 === 1} $align="center">{a.isNew ? 'Νέα' : 'Συνεχ.'}</Td>
                      <Td $alt={i % 2 === 1} $align="right" style={{ fontWeight: 700 }}>{formatEuro(a.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}

          {/* ── Export buttons ── */}
          <ActionsRow>
            <Btn onClick={handleExportExcel} disabled={exportingExcel || exportingPdf}>
              {exportingExcel ? '⏳ Εξαγωγή…' : '📤 Εξαγωγή Excel (πλήρες)'}
            </Btn>
            <Btn $primary onClick={handleExportPdf} disabled={exportingPdf || exportingExcel}>
              {exportingPdf ? '⏳ Δημιουργία PDF…' : '📄 Αναφορά PDF Στατιστικών'}
            </Btn>
          </ActionsRow>
        </>
      )}

      <ExportSuccessModal
        isOpen={!!exportSuccess}
        onClose={() => setExportSuccess(null)}
        filePath={exportSuccess?.filePath}
        actionCount={exportSuccess?.actionCount}
        sheetCount={exportSuccess?.sheetCount}
        exportedAt={exportSuccess?.exportedAt}
      />
    </Panel>
  );
}
