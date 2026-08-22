/**
 * PortalHubModal.js
 * Ενιαίο modal «Πύλη Διαφάνειας» — αντικαθιστά PortalExport + PortalSettingsModal στο sidebar.
 *
 * Ορατότητα:
 *  - SUPERADMIN : πλήρης πρόσβαση + κουμπί «Ρυθμίσεις Πύλης»
 *  - ADMIN      : πλήρης πρόσβαση (εφόσον η πύλη είναι ενεργή), αλλιώς ενημερωτικό μήνυμα
 *  - ENGINEER   : read-only προβολή κατάστασης
 */

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useToast } from './ToastProvider';
import portalCatalog from '../../app/core/portalCatalog';

const PortalSettingsModal = lazy(() => import('./PortalSettingsModal'));
const ipcRenderer = window.electronAPI;

// ─── Animations ──────────────────────────────────────────────────────────────
const fadeIn = keyframes`from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); }`;
const pulse = keyframes`0%,100% { opacity: 1; } 50% { opacity: 0.55; }`;
const shimmer = keyframes`0% { transform: translateX(-100%); } 100% { transform: translateX(100%); }`;
const glowPulse = keyframes`0%,100% { box-shadow: 0 0 20px rgba(14,165,233,0.4), 0 0 40px rgba(14,165,233,0.15); } 50% { box-shadow: 0 0 30px rgba(14,165,233,0.65), 0 0 60px rgba(14,165,233,0.25); }`;

// ─── Layout ───────────────────────────────────────────────────────────────────
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(8px);
  padding: 24px 16px;
`;

const Modal = styled.div`
  background: linear-gradient(160deg, #0f172a 0%, #111827 60%, #0c1a2e 100%);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 22px;
  width: 1140px;
  max-width: 98vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04);
  animation: ${fadeIn} 0.22s ease;
  overflow: hidden;
`;

// ─── Header ───────────────────────────────────────────────────────────────────
const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 28px 18px;
  background: linear-gradient(90deg, rgba(14,165,233,0.12) 0%, rgba(99,102,241,0.07) 100%);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
`;

const HeaderIcon = styled.div`
  font-size: 28px;
  line-height: 1;
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  color: #f0f9ff;
  letter-spacing: 0.3px;
`;

const HeaderSub = styled.div`
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SettingsBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(99,102,241,0.4);
  background: rgba(99,102,241,0.12);
  color: #a5b4fc;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(99,102,241,0.25); border-color: rgba(99,102,241,0.6); color: #c7d2fe; }
`;

const CloseBtn = styled.button`
  width: 34px; height: 34px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }
`;

// ─── Status Bar ───────────────────────────────────────────────────────────────
const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 11px 28px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
`;

const StatusDot = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: ${p => p.$on ? '#86efac' : '#f87171'};
  &::before {
    content: '';
    width: 8px; height: 8px;
    border-radius: 50%;
    background: ${p => p.$on ? '#22c55e' : '#ef4444'};
    ${p => p.$on && css`animation: ${pulse} 2s infinite;`}
  }
`;

const StatusItem = styled.span`
  font-size: 12px;
  color: #64748b;
  b { color: #94a3b8; }
`;

// ─── Portal Public URL — «αστέρι» του modal ──────────────────────────────────
const PortalUrlSection = styled.div`
  margin: 18px 28px 0;
  flex-shrink: 0;
`;

const PortalUrlCard = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1.5px solid rgba(14,165,233,0.45);
  background: linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.08) 100%);
  padding: 18px 22px;
  ${p => p.$hasUrl && css`animation: ${glowPulse} 3.5s ease-in-out infinite;`}

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.06) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: ${shimmer} 4s ease-in-out infinite;
  }
`;

const PortalUrlLabel = styled.div`
  font-size: 10.5px;
  font-weight: 800;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
`;

const PortalUrlValue = styled.div`
  font-size: 17px;
  font-weight: 800;
  color: #e0f2fe;
  word-break: break-all;
  font-family: 'Segoe UI', system-ui, sans-serif;
  letter-spacing: 0.2px;
  line-height: 1.4;
`;

const PortalUrlEmpty = styled.div`
  font-size: 13px;
  color: #475569;
  font-style: italic;
`;

const PortalUrlActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
`;

const UrlActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  border: 1px solid ${p => p.$primary ? 'rgba(14,165,233,0.5)' : 'rgba(255,255,255,0.12)'};
  background: ${p => p.$primary ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)'};
  color: ${p => p.$primary ? '#7dd3fc' : '#94a3b8'};
  &:hover { opacity: 0.85; transform: translateY(-1px); }
  &:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
`;

// ─── Main content area ────────────────────────────────────────────────────────
const Body = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 18px 28px 0;
  gap: 14px;
  min-height: 0;
`;

// ─── Disabled message ─────────────────────────────────────────────────────────
const DisabledCard = styled.div`
  margin: 0;
  padding: 32px 28px;
  text-align: center;
  background: rgba(239,68,68,0.06);
  border: 1.5px dashed rgba(239,68,68,0.25);
  border-radius: 14px;
`;

// ─── Filters ──────────────────────────────────────────────────────────────────
const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 8px 13px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
  font-size: 13px;
  transition: border-color 0.2s;
  &:focus { outline: none; border-color: rgba(14,165,233,0.5); }
  &::placeholder { color: #475569; }
`;

const FilterSelect = styled.select`
  padding: 7px 10px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #94a3b8;
  font-size: 12.5px;
  cursor: pointer;
  option { background: #1e293b; color: #e2e8f0; }
  &:focus { outline: none; border-color: rgba(14,165,233,0.4); }
`;

const FilterInfo = styled.div`
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
  margin-left: auto;
`;

const QuickLinks = styled.div`
  display: flex;
  gap: 6px;
`;

const QuickBtn = styled.button`
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: #64748b;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: #94a3b8; background: rgba(255,255,255,0.09); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

// ─── Subproject list ──────────────────────────────────────────────────────────
const SubprojectList = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  min-height: 0;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
`;

const SubprojectItem = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: ${p => p.$readOnly ? 'default' : 'pointer'};
  transition: background 0.15s;
  &:last-child { border-bottom: none; }
  &:hover { background: ${p => p.$readOnly ? 'transparent' : 'rgba(255,255,255,0.04)'}; }
`;

const Checkbox = styled.input`
  width: 16px; height: 16px;
  accent-color: #0ea5e9;
  cursor: pointer;
  flex-shrink: 0;
`;

const SubprojectInfo = styled.div`flex: 1; min-width: 0;`;

const SubprojectName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SubprojectMeta = styled.div`
  font-size: 11px;
  color: #475569;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PublishedBadge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.3);
  color: #86efac;
  white-space: nowrap;
`;

const StatusBadge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(100,116,139,0.15);
  border: 1px solid rgba(100,116,139,0.2);
  color: #94a3b8;
  white-space: nowrap;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyState = styled.div`
  padding: 40px 24px;
  text-align: center;
  color: #475569;
  font-size: 13px;
`;

// ─── Preview / Stats bar ──────────────────────────────────────────────────────
const PreviewBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: rgba(14,165,233,0.07);
  border: 1px solid rgba(14,165,233,0.18);
  border-radius: 12px;
`;

const PreviewStat = styled.div`
  text-align: center;
  min-width: 80px;
`;

const PreviewValue = styled.div`
  font-size: 18px;
  font-weight: 900;
  color: ${p => p.$color || '#7dd3fc'};
  letter-spacing: -0.5px;
  line-height: 1;
`;

const PreviewLabel = styled.div`
  font-size: 10px;
  color: #475569;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-top: 3px;
`;

const PreviewDivider = styled.div`
  width: 1px;
  height: 32px;
  background: rgba(255,255,255,0.08);
  flex-shrink: 0;
`;

// ─── Footer / Actions ─────────────────────────────────────────────────────────
const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
`;

const CancelBtn = styled.button`
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid rgba(100,116,139,0.35);
  background: rgba(100,116,139,0.15);
  color: #94a3b8;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(100,116,139,0.28); color: #cbd5e1; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const ExportBtn = styled.button`
  padding: 10px 26px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(37,99,235,0.4);
  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(37,99,235,0.55); }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;

// ─── Progress / Result ────────────────────────────────────────────────────────
const ProgressBox = styled.div`
  flex-shrink: 0;
  padding: 14px 18px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  text-align: center;
`;

const ProgressText = styled.div`
  color: #cbd5e1;
  font-size: 13px;
  margin-bottom: 10px;
`;

const ProgressBar = styled.div`
  height: 5px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #3b82f6, #0ea5e9, #3b82f6);
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s ease-in-out infinite;
  }
`;

const ResultBox = styled.div`
  flex-shrink: 0;
  padding: 14px 18px;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.25);
  border-radius: 12px;
`;

const ResultTitle = styled.div`
  color: #86efac;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
`;

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatEuro(n) {
  return (Number(n) || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

const STATUS_COLORS = {
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': '#22c55e',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ': '#86efac',
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': '#38bdf8',
  'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': '#f59e0b',
  'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': '#a78bfa',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalHubModal({
  isOpen, onClose,
  projects = [],
  currentUser,
  appConfig = {},
  isSuperAdmin = false,
  onConfigSaved,
  onDimosUidSaved,
}) {
  const { showToast } = useToast();
  const username = currentUser?.username || '';
  const userRole = currentUser?.role || '';
  const isEngineer = portalCatalog.isEngineerPortalReadOnly(userRole);
  const portalEnabled = appConfig.portalEnabled === true;
  const canSeeWorkspace = portalCatalog.canSeePortalWorkspace(userRole, portalEnabled);

  // ── State ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastExportInfo, setLastExportInfo] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPublished, setFilterPublished] = useState('all'); // 'all' | 'published' | 'unpublished'
  const [filterStatus, setFilterStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localAppConfig, setLocalAppConfig] = useState(appConfig);

  useEffect(() => { setLocalAppConfig(appConfig); }, [appConfig]);

  // Load saved selections on open
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setProgress('');
      setIsExporting(false);
      setCopied(false);
      setSearch('');
      setFilterPublished('all');
      setFilterStatus('');
      return;
    }
    ipcRenderer.invoke('load-portal-published').then((res) => {
      if (res?.success && res.data) {
        const rec = portalCatalog.normalizePortalPublishedRecord(res.data);
        setSelectedIds(new Set(rec.selectedIds));
        setLastExportInfo({
          lastExportedAt: rec.lastExportedAt,
          lastDropboxLink: rec.lastDropboxLink,
          lastExportedIds: rec.lastExportedIds,
          subprojectIds: rec.selectedIds,
        });
      } else {
        setSelectedIds(new Set());
        setLastExportInfo(null);
      }
    }).catch(() => {});
  }, [isOpen]);

  // ── Filtered list ──
  const allStatuses = useMemo(() => {
    const set = new Set(projects.map(p => p.projectStatus).filter(Boolean));
    return Array.from(set).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => (
    portalCatalog.filterPortalHubProjects(projects, {
      search,
      filterPublished,
      filterStatus,
      publishedIds: lastExportInfo?.lastExportedIds || [],
    })
  ), [projects, search, filterPublished, filterStatus, lastExportInfo]);

  // ── Preview stats ──
  const previewStats = useMemo(() => {
    const sel = projects.filter(p => selectedIds.has(p.subprojectId));
    const totals = portalCatalog.previewPortalSelection(projects, Array.from(selectedIds));
    const byStatus = {};
    for (const p of sel) {
      const st = p.projectStatus || 'Άγνωστη';
      byStatus[st] = (byStatus[st] || 0) + 1;
    }
    const byType = {};
    for (const p of sel) {
      const t = p.projectType || 'Άγνωστο';
      byType[t] = (byType[t] || 0) + 1;
    }
    return { count: totals.count, totalBudget: totals.totalBudget, byStatus, byType, topStatuses: Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).slice(0,4) };
  }, [selectedIds, projects]);

  const handleToggle = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(portalCatalog.applySelectFiltered(filteredProjects)));
  }, [filteredProjects]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExport = async () => {
    const dimosUid = (localAppConfig.portalDimosUid || '').trim();
    const gate = portalCatalog.evaluatePortalExport({
      role: userRole,
      selectedCount: selectedIds.size,
      dimosUid,
      exporting: isExporting,
    });
    if (!gate.ok) {
      if (gate.error) showToast(gate.error, 'error');
      return;
    }
    try {
      setIsExporting(true);
      setResult(null);
      setProgress('Προετοιμασία δεδομένων...');
      const res = await ipcRenderer.invoke('export-portal-data', {
        selectedSubprojectIds: Array.from(selectedIds),
        actingUsername: username,
        dimosUid,
      });
      if (!res?.success) throw new Error(res?.error || 'Άγνωστο σφάλμα');
      setResult({ dropboxLink: res.dropboxLink, count: res.count, exportedAt: new Date().toLocaleString('el-GR') });
      setLastExportInfo(prev => ({
        ...prev,
        lastExportedAt: new Date().toISOString(),
        lastExportedIds: Array.isArray(res.lastExportedIds) ? res.lastExportedIds : Array.from(selectedIds),
        subprojectIds: Array.from(selectedIds),
      }));
      setProgress('');
      if (!localAppConfig.portalDimosUid && onDimosUidSaved) onDimosUidSaved(dimosUid);
    } catch (err) {
      setProgress('');
      showToast(`Σφάλμα εξαγωγής: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenPortal = () => {
    const url = localAppConfig.portalPublicUrl?.trim();
    if (url) window.open(url, '_blank');
  };

  if (!isOpen) return null;

  const dimosUid = (localAppConfig.portalDimosUid || '').trim();
  const publicUrl = (localAppConfig.portalPublicUrl || '').trim();
  const publishedCount = lastExportInfo?.lastExportedIds?.length || 0;
  const canDoExport = portalCatalog.canCommitPortalExport({
    role: userRole,
    selectedCount: selectedIds.size,
    dimosUid,
    exporting: isExporting,
  });

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget && !isExporting) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <Header>
          <HeaderIcon>🌐</HeaderIcon>
          <HeaderInfo>
            <HeaderTitle>ΠΥΛΗ ΔΙΑΦΑΝΕΙΑΣ</HeaderTitle>
            <HeaderSub>Διαχείριση δημοσίευσης υποέργων · {localAppConfig.organizationName || ''}</HeaderSub>
          </HeaderInfo>
          <HeaderActions>
            {portalCatalog.showPortalSettingsButton(userRole) && (
              <SettingsBtn onClick={() => setShowSettings(true)}>
                ⚙️ Ρυθμίσεις Πύλης
              </SettingsBtn>
            )}
            <CloseBtn onClick={onClose} disabled={isExporting}>✕</CloseBtn>
          </HeaderActions>
        </Header>

        {/* ── Status Bar ── */}
        <StatusBar>
          <StatusDot $on={portalEnabled}>
            {portalEnabled ? 'ΕΝΕΡΓΗ' : 'ΑΝΕΝΕΡΓΗ'}
          </StatusDot>
          {lastExportInfo?.lastExportedAt && (
            <StatusItem>
              Τελευταία εξαγωγή: <b>{new Date(lastExportInfo.lastExportedAt).toLocaleString('el-GR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</b>
            </StatusItem>
          )}
          {publishedCount > 0 && (
            <StatusItem>
              Δημοσιευμένα: <b style={{ color: '#86efac' }}>{publishedCount} υποέργα</b>
            </StatusItem>
          )}
          {dimosUid && (
            <StatusItem>
              Δήμος: <b style={{ color: '#7dd3fc' }}>{dimosUid}</b>
            </StatusItem>
          )}
        </StatusBar>

        {/* ── Portal Public URL — το κεντρικό σημείο ── */}
        <PortalUrlSection>
          <PortalUrlCard $hasUrl={!!publicUrl}>
            <PortalUrlLabel>🔗 Σύνδεσμος Πύλης Διαφάνειας (δημόσιο URL)</PortalUrlLabel>
            {publicUrl ? (
              <>
                <PortalUrlValue>{publicUrl}</PortalUrlValue>
                <PortalUrlActions>
                  <UrlActionBtn $primary onClick={() => handleCopy(publicUrl)}>
                    {copied ? '✓ Αντιγράφηκε!' : '📋 Αντιγραφή URL'}
                  </UrlActionBtn>
                  <UrlActionBtn onClick={handleOpenPortal}>
                    🌐 Άνοιγμα Πύλης
                  </UrlActionBtn>
                  {isSuperAdmin && (
                    <UrlActionBtn onClick={() => setShowSettings(true)} style={{ marginLeft: 'auto', fontSize: 11 }}>
                      ✏️ Αλλαγή URL
                    </UrlActionBtn>
                  )}
                </PortalUrlActions>
              </>
            ) : (
              <>
                <PortalUrlEmpty>
                  {isSuperAdmin
                    ? 'Δεν έχει οριστεί ακόμα το δημόσιο URL της πύλης. Ορίστε το από τις Ρυθμίσεις Πύλης.'
                    : 'Το URL της πύλης δεν έχει οριστεί ακόμα από τον διαχειριστή.'}
                </PortalUrlEmpty>
                {isSuperAdmin && (
                  <PortalUrlActions>
                    <UrlActionBtn $primary onClick={() => setShowSettings(true)}>
                      ⚙️ Ορισμός URL στις Ρυθμίσεις
                    </UrlActionBtn>
                  </PortalUrlActions>
                )}
              </>
            )}
          </PortalUrlCard>
        </PortalUrlSection>

        {/* ── ΚΥΡΙΟ ΣΩΜΑ ── */}
        <Body>

          {/* Πύλη απενεργοποιημένη — μήνυμα για ADMIN/ENGINEER */}
          {!canSeeWorkspace ? (
            <DisabledCard>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                Η Πύλη Διαφάνειας δεν είναι ενεργή
              </div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
                Η δυνατότητα εξαγωγής & δημοσίευσης δεν είναι διαθέσιμη αυτήν τη στιγμή.
                Επικοινωνήστε με τον διαχειριστή συστήματος για ενεργοποίηση.
              </div>
            </DisabledCard>
          ) : (
            <>
              {/* Πύλη απενεργοποιημένη για SUPERADMIN — προειδοποίηση χωρίς blocκ */}
              {!portalEnabled && isSuperAdmin && (
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171', flexShrink: 0 }}>
                  ⚠️ Η πύλη είναι απενεργοποιημένη. Ενεργοποιήστε την από τις <strong style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowSettings(true)}>Ρυθμίσεις</strong> για να είναι προσβάσιμη στους ADMIN.
                </div>
              )}

              {/* ENGINEER: read-only status */}
              {isEngineer ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>👁️</div>
                  Μπορείτε να δείτε τα στοιχεία σύνδεσης της πύλης.<br />
                  <span style={{ color: '#475569', fontSize: 11 }}>Η διαχείριση δημοσίευσης γίνεται από ADMIN/SUPERADMIN.</span>
                </div>
              ) : (
                <>
                  {/* ── Φίλτρα ── */}
                  <FiltersRow>
                    <SearchInput
                      placeholder="🔍 Αναζήτηση υποέργου..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      disabled={isExporting}
                    />
                    <FilterSelect value={filterPublished} onChange={e => setFilterPublished(e.target.value)} disabled={isExporting}>
                      <option value="all">Όλα τα υποέργα</option>
                      <option value="published">Μόνο δημοσιευμένα</option>
                      <option value="unpublished">Μόνο αδημοσίευτα</option>
                    </FilterSelect>
                    <FilterSelect value={filterStatus} onChange={e => setFilterStatus(e.target.value)} disabled={isExporting}>
                      <option value="">Όλες οι καταστάσεις</option>
                      {allStatuses.map(st => <option key={st} value={st}>{st}</option>)}
                    </FilterSelect>
                    <QuickLinks>
                      <QuickBtn onClick={handleSelectAll} disabled={isExporting}>Επιλογή φιλτ.</QuickBtn>
                      <QuickBtn onClick={handleDeselectAll} disabled={isExporting}>Αποεπιλογή</QuickBtn>
                    </QuickLinks>
                    <FilterInfo>
                      {filteredProjects.length} / {projects.length} · {selectedIds.size} επιλεγμένα
                    </FilterInfo>
                  </FiltersRow>

                  {/* ── Λίστα υποέργων ── */}
                  <SubprojectList>
                    {filteredProjects.length === 0 ? (
                      <EmptyState>Δεν βρέθηκαν υποέργα με τα επιλεγμένα φίλτρα.</EmptyState>
                    ) : (
                      filteredProjects.map(p => {
                        const isPublished = (lastExportInfo?.lastExportedIds || []).includes(p.subprojectId);
                        const isQueued = selectedIds.has(p.subprojectId) && !isPublished;
                        const statusColor = STATUS_COLORS[p.projectStatus] || '#64748b';
                        return (
                          <SubprojectItem key={p.subprojectId}>
                            <Checkbox
                              type="checkbox"
                              checked={selectedIds.has(p.subprojectId)}
                              onChange={() => handleToggle(p.subprojectId)}
                              disabled={isExporting}
                            />
                            <SubprojectInfo>
                              <SubprojectName title={p.subprojectTitle}>{p.subprojectTitle}</SubprojectName>
                              <SubprojectMeta>
                                {p.projectTitle}{p.fundingSource ? ` · ${p.fundingSource}` : ''}
                              </SubprojectMeta>
                            </SubprojectInfo>
                            {isPublished && <PublishedBadge>🌐 Δημοσιευμένο</PublishedBadge>}
                            {isPublished && !selectedIds.has(p.subprojectId) && <PublishedBadge>Θα φύγει</PublishedBadge>}
                            {isQueued && <PublishedBadge>Στην επόμενη</PublishedBadge>}
                            <StatusBadge style={{ borderColor: `${statusColor}30`, color: statusColor }}>
                              {p.projectStatus || 'Χωρίς κατάσταση'}
                            </StatusBadge>
                          </SubprojectItem>
                        );
                      })
                    )}
                  </SubprojectList>

                  {/* ── Προεπισκόπηση / στατιστικά επιλογής ── */}
                  {selectedIds.size > 0 && (
                    <PreviewBar>
                      <PreviewStat>
                        <PreviewValue>{previewStats.count}</PreviewValue>
                        <PreviewLabel>Επιλεγμένα</PreviewLabel>
                      </PreviewStat>
                      <PreviewDivider />
                      <PreviewStat>
                        <PreviewValue $color="#86efac" style={{ fontSize: 14 }}>
                          {formatEuro(previewStats.totalBudget)}
                        </PreviewValue>
                        <PreviewLabel>Συν. Π/Υ</PreviewLabel>
                      </PreviewStat>
                      <PreviewDivider />
                      {previewStats.topStatuses.map(([st, cnt]) => (
                        <PreviewStat key={st}>
                          <PreviewValue $color={STATUS_COLORS[st] || '#94a3b8'}>{cnt}</PreviewValue>
                          <PreviewLabel style={{ maxWidth: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.replace('ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ', 'ΕΚΤΕΛΟΥΜΕΝΟ').replace('ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ', 'ΑΠΟΠΛΗΡ.')}
                          </PreviewLabel>
                        </PreviewStat>
                      ))}
                      <div style={{ flex: 1 }} />
                      <div style={{ fontSize: 11, color: '#475569', textAlign: 'right' }}>
                        Αυτά τα δεδομένα θα ανέβουν στο Dropbox<br />
                        <code style={{ color: '#7dd3fc', fontSize: 10 }}>
                          /portal/{dimosUid || '<slug>'}/erga.json
                        </code>
                      </div>
                    </PreviewBar>
                  )}

                  {/* Progress */}
                  {isExporting && (
                    <ProgressBox>
                      <ProgressText>{progress || 'Ανέβασμα στο Dropbox...'}</ProgressText>
                      <ProgressBar />
                    </ProgressBox>
                  )}

                  {/* Result */}
                  {result && !isExporting && (
                    <ResultBox>
                      <ResultTitle>✅ Επιτυχής εξαγωγή — {result.count} υποέργα δημοσιεύθηκαν ({result.exportedAt})</ResultTitle>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {publicUrl && (
                          <UrlActionBtn $primary onClick={handleOpenPortal}>
                            🌐 Άνοιγμα Πύλης
                          </UrlActionBtn>
                        )}
                        {result.dropboxLink && (
                          <UrlActionBtn onClick={() => handleCopy(result.dropboxLink)}>
                            {copied ? '✓ Αντιγράφηκε!' : '📋 Αντιγραφή Dropbox link'}
                          </UrlActionBtn>
                        )}
                      </div>
                    </ResultBox>
                  )}
                </>
              )}
            </>
          )}
        </Body>

        {/* ── Footer ── */}
        {!isEngineer && (portalEnabled || isSuperAdmin) && (
          <Footer>
            <CancelBtn onClick={onClose} disabled={isExporting}>
              {result ? 'Κλείσιμο' : 'Ακύρωση'}
            </CancelBtn>
            {!result && !isEngineer && (
              <ExportBtn onClick={handleExport} disabled={!canDoExport}>
                {isExporting ? '⏳ Ανέβασμα...' : `📤 Εξαγωγή & Δημοσίευση (${selectedIds.size})`}
              </ExportBtn>
            )}
          </Footer>
        )}

        {/* ── Nested Settings Modal (SUPERADMIN only) ── */}
        {showSettings && (
          <Suspense fallback={null}>
            <PortalSettingsModal
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              appConfig={localAppConfig}
              onConfigSaved={(cfg) => {
                const merged = { ...localAppConfig, ...cfg };
                setLocalAppConfig(merged);
                setShowSettings(false);
                if (onConfigSaved) onConfigSaved(cfg);
              }}
            />
          </Suspense>
        )}

      </Modal>
    </Overlay>
  );
}
