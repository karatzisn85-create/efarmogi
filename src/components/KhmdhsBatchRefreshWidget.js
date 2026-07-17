import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useToast } from './ToastProvider';
import { applyAdamChainResult } from '../utils/khmdhsChainApply';
import { symvPlanMatchesChain } from '../utils/khmdhsSymvChainPlanner';
import {
  buildKhmdhsRefreshChangeReport,
  KHMDHS_REFRESH_REPORT_NO_CHANGES,
} from '../utils/khmdhsChainRefresh';
import {
  collectKhmdhsRegistryCandidatesFromChainRes,
  collectKhmdhsRegistryCandidatesFromProject,
  mergeRegistryCandidateLists,
  resyncRegistryEntryTitles,
  registryEntryIsAlreadyRecorded,
  mergeKhmdhsDocumentRegistry,
} from '../utils/khmdhsDocumentRegistry';

const ipcRenderer = window.electronAPI;

/* ═══════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════ */
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
`;

const checkBounce = keyframes`
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
`;

const fabPulseCalm = keyframes`
  0%, 100% { transform: translateY(0); box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4); }
  50% { transform: translateY(-3px); box-shadow: 0 8px 26px rgba(245, 158, 11, 0.5); }
`;

const fabPulseUrgent = keyframes`
  0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 6px 24px rgba(220, 38, 38, 0.5); }
  50% { transform: translateY(-5px) scale(1.05); box-shadow: 0 12px 36px rgba(220, 38, 38, 0.7); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/* ═══════════════════════════════════════════
   INLINE WIDGET (Dashboard)
   ═══════════════════════════════════════════ */
const Container = styled.div`
  animation: ${fadeIn} 0.3s ease;
  background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
  border: 1px solid #99f6e4;
  border-radius: 14px;
  padding: 1rem 1.3rem;
  margin-bottom: 1rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #134e4a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const StaleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
`;

const MetaLine = styled.div`
  margin-top: 0.5rem;
  font-size: 0.62rem;
  color: #64748b;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
  transition: all 0.2s;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CancelBtn = styled.button`
  padding: 0.35rem 0.8rem;
  border-radius: 6px;
  border: 1px solid #fca5a5;
  background: #fff;
  color: #dc2626;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #fef2f2; }
`;

const ProgressBar = styled.div`
  margin-top: 0.7rem;
  background: #ccfbf1;
  border-radius: 8px;
  height: 8px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #14b8a6, #06b6d4, #22d3ee);
  background-size: 200% 100%;
  border-radius: 8px;
  transition: width 0.4s ease;
  width: ${(p) => p.$pct}%;
`;

const StatusText = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.68rem;
  color: #475569;
  font-weight: 500;
`;

const LogBox = styled.div`
  margin-top: 0.5rem;
  max-height: 80px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  padding: 0.4rem 0.6rem;
  font-size: 0.62rem;
  color: #475569;
  line-height: 1.6;
  scroll-behavior: smooth;
`;

const LogEntry = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: ${fadeIn} 0.2s ease;
`;

/* ═══════════════════════════════════════════
   CONFIRMATION DIALOG
   ═══════════════════════════════════════════ */
const ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 11500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: ${fadeIn} 0.15s ease;
`;

const ConfirmBox = styled.div`
  background: #fff;
  border-radius: 16px;
  width: min(480px, 100%);
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  animation: ${scaleIn} 0.2s ease;
  text-align: center;
`;

const ConfirmTitle = styled.h3`
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #134e4a;
`;

const ConfirmDesc = styled.p`
  margin: 0 0 0.9rem;
  font-size: 0.76rem;
  color: #475569;
  line-height: 1.5;
`;

const ScopeOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0 0 1.1rem;
  text-align: left;
`;

const ScopeOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  border: 1.5px solid ${(p) => (p.$active ? '#14b8a6' : '#e2e8f0')};
  background: ${(p) => (p.$active ? '#f0fdfa' : '#fff')};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #99f6e4; background: #f8fffe; }
`;

const ScopeRadio = styled.input`
  margin-top: 0.15rem;
  accent-color: #0d9488;
  flex-shrink: 0;
`;

const ScopeText = styled.div`
  flex: 1;
  min-width: 0;
`;

const ScopeLabel = styled.div`
  font-size: 0.76rem;
  font-weight: 700;
  color: #134e4a;
`;

const ScopeHint = styled.div`
  font-size: 0.66rem;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.4;
`;

const ConfirmActions = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.7rem;
`;

const ConfirmCancel = styled.button`
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const ConfirmProceed = styled.button`
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
  &:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const STALE_BATCH_DAYS = 7;

function isEligibleStale(item, maxAgeDays = STALE_BATCH_DAYS) {
  if (!item) return false;
  if (item.ageDays == null || item.lastRefreshed == null) return true;
  return Number(item.ageDays) >= maxAgeDays;
}

/* ═══════════════════════════════════════════
   FLOATING ACTION BUTTON
   ═══════════════════════════════════════════ */
const ReportFab = styled.button`
  position: fixed;
  bottom: 24px;
  right: 86px;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 60%, #fbbf24 100%);
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  ${(p) => p.$urgent
    ? css`animation: ${fabPulseUrgent} 2s ease-in-out infinite;`
    : css`animation: ${fabPulseCalm} 3s ease-in-out infinite;`
  }

  ${(p) => p.$spinning && css`
    background: linear-gradient(135deg, #0d9488 0%, #14b8a6 60%, #2dd4bf 100%);
    animation: none;
  `}

  &:hover {
    transform: translateY(-3px) scale(1.08);
    box-shadow: 0 10px 36px rgba(217, 119, 6, 0.55);
    animation: none;
  }
  &:active {
    transform: translateY(-1px) scale(0.96);
    animation: none;
  }
`;

const FabBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.58rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
`;

const FabSpinner = styled.span`
  display: inline-block;
  animation: ${spin} 1s linear infinite;
  font-size: 1.2rem;
`;

const FabTooltip = styled.span`
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  background: #1e293b;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.2s, transform 0.2s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);

  ${ReportFab}:hover & {
    opacity: 1;
    transform: translateY(0);
  }
`;

/* ═══════════════════════════════════════════
   REPORT MODAL
   ═══════════════════════════════════════════ */
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: ${fadeIn} 0.2s ease;
`;

const ModalBox = styled.div`
  background: #fff;
  border-radius: 18px;
  width: min(600px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,0.18);
  overflow: hidden;
  animation: ${scaleIn} 0.25s ease;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.5rem;
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
  color: #fff;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const ModalCloseBtn = styled.button`
  background: rgba(255,255,255,0.15);
  border: none;
  font-size: 1rem;
  color: #fff;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  &:hover { background: rgba(255,255,255,0.25); }
`;

const ModalBody = styled.div`
  padding: 1.2rem 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  margin-bottom: 0.5rem;
  background: ${(p) => p.$bg || '#f8fafc'};
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};
`;

const StatIcon = styled.span`
  font-size: 1rem;
  animation: ${checkBounce} 0.4s ease;
`;

const StatText = styled.span`
  font-size: 0.76rem;
  color: ${(p) => p.$color || '#334155'};
  font-weight: 600;
`;

const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0;
  margin-top: 0.8rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 700;
  color: ${(p) => p.$color || '#334155'};
  &:hover { opacity: 0.8; }
`;

const SectionChevron = styled.span`
  transition: transform 0.2s;
  ${(p) => p.$open && 'transform: rotate(90deg);'}
`;

const InterventionItem = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.9rem;
  margin-bottom: 5px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  color: #78350f;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-color: #f59e0b;
    transform: translateX(3px);
  }
`;

const InterventionIcon = styled.span`
  flex-shrink: 0;
  font-size: 0.9rem;
  margin-top: 1px;
`;

const InterventionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const InterventionTitle = styled.div`
  font-weight: 700;
  line-height: 1.3;
`;

const InterventionSubtitle = styled.div`
  font-size: 0.64rem;
  font-weight: 500;
  color: #a16207;
  margin-top: 2px;
`;

const SkippedList = styled.div`
  padding: 0.4rem 0;
  font-size: 0.65rem;
  color: #64748b;
  line-height: 1.6;
`;

const AllDoneBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #6ee7b7;
  margin-top: 0.8rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: #065f46;
  animation: ${fadeIn} 0.3s ease;
`;

const DetailCard = styled.div`
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};
  border-radius: 10px;
  background: ${(p) => p.$bg || '#fff'};
  margin-bottom: 0.45rem;
  overflow: hidden;
`;

const DetailCardHead = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.8rem;
  border: none;
  background: transparent;
  cursor: pointer;
  &:hover { background: rgba(15, 23, 42, 0.03); }
`;

const DetailCardTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 0.74rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.35;
`;

const DetailCardMeta = styled.div`
  font-size: 0.62rem;
  font-weight: 500;
  color: #64748b;
  margin-top: 2px;
`;

const DetailCardBody = styled.div`
  padding: 0 0.8rem 0.7rem 2rem;
  border-top: 1px dashed #e2e8f0;
`;

const ChangeLine = styled.div`
  font-size: 0.66rem;
  color: #334155;
  line-height: 1.55;
  padding: 0.15rem 0;
  &::before {
    content: '•';
    color: #0d9488;
    margin-right: 0.35rem;
    font-weight: 700;
  }
`;

const ChangeLineMuted = styled(ChangeLine)`
  color: #64748b;
  &::before { color: #94a3b8; }
`;

const ErrorLine = styled.div`
  font-size: 0.66rem;
  color: #991b1b;
  line-height: 1.45;
  padding: 0.35rem 0 0;
`;

const ReportLinkBtn = styled.button`
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  border: 1px solid #99f6e4;
  background: #fff;
  color: #0f766e;
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #f0fdfa; }
`;

const OpenSubBtn = styled.button`
  margin-top: 0.35rem;
  padding: 0;
  border: none;
  background: none;
  color: #0d9488;
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  &:hover { color: #0f766e; }
`;

/* ═══════════════════════════════════════════
   EXPORTED: Floating Button
   ═══════════════════════════════════════════ */
export function KhmdhsBatchReportFab({ pendingItems, onClick, isRunning, hasReport }) {
  if (!pendingItems?.length && !isRunning && !hasReport) return null;

  const count = pendingItems?.length || 0;
  const urgent = count > 5;
  const tooltipText = isRunning
    ? 'Μαζική ανανέωση σε εξέλιξη…'
    : count > 0
      ? `${count} υποέργ${count === 1 ? 'ο χρειάζεται' : 'α χρειάζονται'} χαρακτηρισμό — κλικ για αναφορά`
      : 'Άνοιγμα αναφοράς μαζικής ανανέωσης';

  return (
    <ReportFab
      onClick={onClick}
      $urgent={urgent && !isRunning}
      $spinning={isRunning}
      title=""
    >
      <FabTooltip>{tooltipText}</FabTooltip>
      {isRunning ? <FabSpinner>⟳</FabSpinner> : '📋'}
      {count > 0 && !isRunning && <FabBadge>{count}</FabBadge>}
    </ReportFab>
  );
}

function ReportItemCard({
  item,
  open,
  onToggle,
  border,
  bg,
  icon,
  meta,
  onNavigate,
}) {
  const lines = item.changeLines || [];
  const isUnchanged = item.category === 'unchanged'
    || (lines.length === 1 && lines[0] === KHMDHS_REFRESH_REPORT_NO_CHANGES);

  return (
    <DetailCard $border={border} $bg={bg}>
      <DetailCardHead type="button" onClick={onToggle}>
        <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{icon}</span>
        <DetailCardTitle>
          {item.label}
          {meta && <DetailCardMeta>{meta}</DetailCardMeta>}
        </DetailCardTitle>
        <SectionChevron $open={open}>▶</SectionChevron>
      </DetailCardHead>
      {open && (
        <DetailCardBody>
          {item.error && <ErrorLine>{item.error}</ErrorLine>}
          {item.reason && !item.error && (
            <DetailCardMeta style={{ marginBottom: 4 }}>{item.reason}</DetailCardMeta>
          )}
          {lines.map((line) => (
            isUnchanged
              ? <ChangeLineMuted key={line}>{line}</ChangeLineMuted>
              : <ChangeLine key={line}>{line}</ChangeLine>
          ))}
          {typeof onNavigate === 'function' && item.id && (
            <OpenSubBtn
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(item.id);
              }}
            >
              Άνοιγμα λεπτομερειών υποέργου →
            </OpenSubBtn>
          )}
        </DetailCardBody>
      )}
    </DetailCard>
  );
}

/* ═══════════════════════════════════════════
   EXPORTED: Report Modal
   ═══════════════════════════════════════════ */
export function KhmdhsBatchReportModal({
  isOpen,
  onClose,
  results,
  pendingItems,
  onNavigateToSubproject,
}) {
  const [openSections, setOpenSections] = useState({
    refreshed: true,
    attention: true,
    unchanged: false,
    failed: true,
    intervened: true,
    skipped: false,
  });
  const [openItems, setOpenItems] = useState({});

  if (!isOpen || !results) return null;

  const items = Array.isArray(results.items) ? results.items : [];
  const refreshedItems = items.filter((i) => i.status === 'refreshed' && i.category === 'applied');
  const attentionItems = items.filter((i) => i.status === 'refreshed' && i.category === 'attention');
  const unchangedItems = items.filter((i) => i.status === 'refreshed' && (i.category === 'unchanged' || (!i.category && !i.hasSubstantiveChanges)));
  const failedItems = items.filter((i) => i.status === 'failed');
  const skippedItems = items.filter((i) => i.status === 'skipped');
  const intervenedFromItems = items.filter((i) => i.status === 'intervened');
  const interventionList = pendingItems?.length
    ? pendingItems
    : intervenedFromItems;

  const allResolved = (!pendingItems || pendingItems.length === 0)
    && (results.needsIntervention > 0 || intervenedFromItems.length > 0);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleItem = (id) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const goTo = (id) => {
    if (typeof onNavigateToSubproject === 'function') {
      onNavigateToSubproject(id);
      onClose();
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>📋 Αναφορά μαζικής ανανέωσης ΚΗΜΔΗΣ</ModalTitle>
          <ModalCloseBtn onClick={onClose}>✕</ModalCloseBtn>
        </ModalHeader>
        <ModalBody>
          <StatCard $bg="#ecfdf5" $border="#6ee7b7">
            <StatIcon>✅</StatIcon>
            <StatText $color="#065f46">
              Ενημερώθηκαν με αλλαγές: <strong>{refreshedItems.length}</strong>
              {unchangedItems.length > 0 && (
                <> · χωρίς ουσιώδεις διαφορές: <strong>{unchangedItems.length}</strong></>
              )}
              {attentionItems.length > 0 && (
                <> · ενημέρωση χωρίς νέες αλλαγές (χειροκίνητες τιμές): <strong>{attentionItems.length}</strong></>
              )}
            </StatText>
          </StatCard>

          {(results.failed > 0 || failedItems.length > 0) && (
            <StatCard $bg="#fef2f2" $border="#fca5a5">
              <StatIcon>❌</StatIcon>
              <StatText $color="#991b1b">
                Αποτυχία: <strong>{results.failed || failedItems.length}</strong> υποέργα
              </StatText>
            </StatCard>
          )}

          {interventionList.length > 0 && (
            <StatCard $bg="#fffbeb" $border="#fde68a">
              <StatIcon>⚠️</StatIcon>
              <StatText $color="#92400e">
                Χρειάζονται χαρακτηρισμό: <strong>{interventionList.length}</strong>
              </StatText>
            </StatCard>
          )}

          {(results.skipped > 0 || skippedItems.length > 0) && (
            <StatCard $bg="#f8fafc" $border="#e2e8f0">
              <StatIcon>⏭️</StatIcon>
              <StatText $color="#475569">
                Παραλείφθηκαν: <strong>{results.skipped || skippedItems.length}</strong>
              </StatText>
            </StatCard>
          )}

          {refreshedItems.length > 0 && (
            <>
              <SectionHeader $color="#065f46" onClick={() => toggleSection('refreshed')}>
                <SectionChevron $open={openSections.refreshed}>▶</SectionChevron>
                ✅ Ενημερώθηκαν με αλλαγές ({refreshedItems.length})
              </SectionHeader>
              {openSections.refreshed && refreshedItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={!!openItems[item.id]}
                  onToggle={() => toggleItem(item.id)}
                  border="#6ee7b7"
                  bg="#f0fdf4"
                  icon="✅"
                  meta={`${item.changeLines?.length || 0} ενέργει${(item.changeLines?.length || 0) === 1 ? 'α' : 'ες'} — κλικ για λεπτομέρειες`}
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {attentionItems.length > 0 && (
            <>
              <SectionHeader $color="#92400e" onClick={() => toggleSection('attention')}>
                <SectionChevron $open={openSections.attention}>▶</SectionChevron>
                ℹ️ Ελέγχθηκαν — διατηρήθηκαν χειροκίνητες τιμές ({attentionItems.length})
              </SectionHeader>
              {openSections.attention && attentionItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={openItems[item.id] !== false}
                  onToggle={() => toggleItem(item.id)}
                  border="#fde68a"
                  bg="#fffbeb"
                  icon="ℹ️"
                  meta="Δεν προστέθηκαν νέα δεδομένα από το ΚΗΜΔΗΣ — σεβάστηκαν χειροκίνητες τιμές που είχατε ορίσει. Δεν απαιτείται ενέργεια."
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {unchangedItems.length > 0 && (
            <>
              <SectionHeader $color="#64748b" onClick={() => toggleSection('unchanged')}>
                <SectionChevron $open={openSections.unchanged}>▶</SectionChevron>
                ➖ Χωρίς ουσιώδεις διαφορές ({unchangedItems.length})
              </SectionHeader>
              {openSections.unchanged && unchangedItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={!!openItems[item.id]}
                  onToggle={() => toggleItem(item.id)}
                  border="#e2e8f0"
                  bg="#f8fafc"
                  icon="➖"
                  meta="Ελέγχθηκε στο ΚΗΜΔΗΣ — τα δεδομένα ήταν ήδη ενημερωμένα"
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {interventionList.length > 0 && (
            <>
              <SectionHeader $color="#92400e" onClick={() => toggleSection('intervened')}>
                <SectionChevron $open={openSections.intervened}>▶</SectionChevron>
                ⚠️ Χρειάζονται χαρακτηρισμό ({interventionList.length})
              </SectionHeader>
              {openSections.intervened && interventionList.map((item) => (
                <InterventionItem
                  key={item.id}
                  onClick={() => goTo(item.id)}
                >
                  <InterventionIcon>📄</InterventionIcon>
                  <InterventionContent>
                    <InterventionTitle>{item.label}</InterventionTitle>
                    <InterventionSubtitle>
                      Εντοπίστηκαν πολλαπλά έγγραφα συμβάσεων — ορίστε ποιο είναι κύρια, παράταση ή συμπληρωματική. Δεν αποθηκεύτηκε αυτόματη αλλαγή.
                    </InterventionSubtitle>
                  </InterventionContent>
                </InterventionItem>
              ))}
            </>
          )}

          {failedItems.length > 0 && (
            <>
              <SectionHeader $color="#991b1b" onClick={() => toggleSection('failed')}>
                <SectionChevron $open={openSections.failed}>▶</SectionChevron>
                ❌ Αποτυχίες ({failedItems.length})
              </SectionHeader>
              {openSections.failed && failedItems.map((item) => (
                <ReportItemCard
                  key={`fail-${item.id}`}
                  item={item}
                  open={openItems[`fail-${item.id}`] !== false}
                  onToggle={() => toggleItem(`fail-${item.id}`)}
                  border="#fca5a5"
                  bg="#fef2f2"
                  icon="❌"
                  meta={item.phase === 'lock' ? 'Κλειδωμένο από άλλον χρήστη' : 'Δεν ολοκληρώθηκε η ανανέωση'}
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {skippedItems.length > 0 && (
            <>
              <SectionHeader $color="#64748b" onClick={() => toggleSection('skipped')}>
                <SectionChevron $open={openSections.skipped}>▶</SectionChevron>
                ⏭️ Παραλείφθηκαν ({skippedItems.length})
              </SectionHeader>
              {openSections.skipped && (
                <>
                  <SkippedList style={{ marginBottom: '0.4rem' }}>
                    Δεν πληρούσαν τις προϋποθέσεις μαζικής ανανέωσης (χωρίς ΑΔΑΜ, ολοκληρωμένα ή κλειδωμένα).
                  </SkippedList>
                  {skippedItems.map((item) => (
                    <ReportItemCard
                      key={`skip-${item.id}`}
                      item={item}
                      open={!!openItems[`skip-${item.id}`]}
                      onToggle={() => toggleItem(`skip-${item.id}`)}
                      border="#e2e8f0"
                      bg="#f8fafc"
                      icon="⏭️"
                      meta={item.reason || 'Παραλείφθηκε'}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {allResolved && (
            <AllDoneBanner>
              🎉 Όλοι οι χαρακτηρισμοί ολοκληρώθηκαν — η βάση δεδομένων είναι πλήρως ενημερωμένη!
            </AllDoneBanner>
          )}

          {!refreshedItems.length && !attentionItems.length && !unchangedItems.length
            && !failedItems.length && !interventionList.length && !skippedItems.length && (
            <SkippedList>
              Δεν καταγράφηκαν λεπτομέρειες για αυτή την εκτέλεση.
            </SkippedList>
          )}
        </ModalBody>
      </ModalBox>
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════
   EXPORTED: Main Widget (Dashboard inline)
   ═══════════════════════════════════════════ */
export default function KhmdhsBatchRefreshWidget({
  userRole,
  currentUser,
  onRefreshComplete,
  onBatchResults,
  onRunningChange,
  onOpenReport,
  staleCount = 0,
  oldestDays = null,
  lastRunInfo = null,
  hasReport = false,
}) {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [logEntries, setLogEntries] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligiblePreview, setEligiblePreview] = useState(null);
  const [batchScope, setBatchScope] = useState('stale'); // 'stale' | 'all'
  const cancelRef = useRef(false);
  const logRef = useRef(null);

  const canUse = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  const stalePreviewCount = useMemo(
    () => (eligiblePreview || []).filter((item) => isEligibleStale(item)).length,
    [eligiblePreview]
  );
  const allPreviewCount = eligiblePreview?.length ?? null;
  const selectedCount = batchScope === 'stale' ? stalePreviewCount : allPreviewCount;

  useEffect(() => {
    if (typeof onRunningChange === 'function') onRunningChange(running);
  }, [running, onRunningChange]);

  const addLog = useCallback((icon, text) => {
    setLogEntries((prev) => [...prev.slice(-30), { icon, text, ts: Date.now() }]);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  }, []);

  const handleConfirmStart = useCallback(async () => {
    setConfirmOpen(true);
    setEligiblePreview(null);
    setBatchScope('stale');
    try {
      const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
        actingUsername: currentUser?.username,
      });
      if (eligRes?.success) {
        const list = eligRes.eligible || [];
        setEligiblePreview(list);
        const staleN = list.filter((item) => isEligibleStale(item)).length;
        setBatchScope(staleN > 0 ? 'stale' : 'all');
      }
    } catch {
      setEligiblePreview(null);
    }
  }, [currentUser]);

  const handleBatchRefresh = useCallback(async () => {
    const scope = batchScope;
    setConfirmOpen(false);
    setRunning(true);
    setLogEntries([]);
    cancelRef.current = false;
    setProgress({ current: 0, total: 0, label: 'Εντοπισμός υποέργων…' });

    try {
      const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
        actingUsername: currentUser?.username,
      });
      if (!eligRes?.success) {
        showToast(eligRes?.error || 'Σφάλμα', 'error');
        setRunning(false);
        return;
      }

      const { eligible: allEligible, skipped } = eligRes;
      const skippedItems = (skipped || []).map((s) => ({
        status: 'skipped',
        id: s.id,
        label: s.label,
        reason: s.reason || 'Παραλείφθηκε',
      }));

      let eligible = allEligible || [];
      if (scope === 'stale') {
        const freshSkipped = eligible
          .filter((item) => !isEligibleStale(item))
          .map((item) => ({
            status: 'skipped',
            id: item.id,
            label: item.label,
            reason: item.ageDays != null
              ? `Πρόσφατα ανανεωμένο (${item.ageDays} ημ.) — εκτός επιλογής`
              : 'Πρόσφατα ανανεωμένο — εκτός επιλογής',
          }));
        skippedItems.push(...freshSkipped);
        eligible = eligible.filter((item) => isEligibleStale(item));
      }

      const total = eligible.length;

      if (!total) {
        if (typeof onBatchResults === 'function') {
          onBatchResults({
            refreshed: 0,
            needsIntervention: 0,
            failed: 0,
            skipped: skippedItems.length,
            interventionItems: [],
            items: skippedItems,
          });
        }
        showToast(
          scope === 'stale'
            ? 'Δεν βρέθηκαν παλαιά υποέργα προς ανανέωση. Δοκιμάστε «Όλα τα υποέργα».'
            : 'Δεν βρέθηκαν υποέργα για ανανέωση.',
          'info'
        );
        setRunning(false);
        return;
      }

      setProgress({ current: 0, total, label: `0 / ${total}` });
      addLog(
        '🔍',
        scope === 'stale'
          ? `Θα ανανεωθούν ${total} παλαιά υποέργα (>${STALE_BATCH_DAYS} ημ. ή χωρίς ανανέωση)`
          : `Θα ανανεωθούν όλα τα ${total} επιλέξιμα υποέργα`
      );

      let refreshed = 0;
      let needsIntervention = 0;
      let failed = 0;
      const interventionItems = [];
      const detailItems = [...skippedItems];

      for (let i = 0; i < total; i++) {
        if (cancelRef.current) {
          addLog('⛔', 'Η διαδικασία ακυρώθηκε');
          break;
        }
        const item = eligible[i];
        setProgress({ current: i + 1, total, label: `${i + 1} / ${total} — ${item.label}` });

        try {
          const res = await ipcRenderer.invoke('preview-subproject-khmdhs-refresh', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          if (!res?.success) {
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: res?.error || 'Αποτυχία ανάκτησης από ΚΗΜΔΗΣ',
              phase: 'preview',
            });
            addLog('❌', `${item.label} — ${res?.error || 'Αποτυχία'}`);
            continue;
          }

          const project = res.projectSnapshot;
          const existingPlan = project?.khmdhsSymvChainPlan;
          const reusablePlan = existingPlan?.items?.length
            && symvPlanMatchesChain(existingPlan, res.chainRes)
            ? existingPlan : null;

          const applyResult = applyAdamChainResult(project, res.chainRes, {
            seedAdam: res.seedAdam,
            symvChainPlan: reusablePlan,
          });

          if (applyResult.warnings?.includes('symvPlannerRequired')) {
            needsIntervention++;
            interventionItems.push({ id: item.id, label: item.label });
            detailItems.push({
              status: 'intervened',
              id: item.id,
              label: item.label,
              seedAdam: res.seedAdam,
              reason: 'Χρειάζεται χαρακτηρισμός πολλαπλών εγγράφων συμβάσεων',
            });
            addLog('⚠️', `${item.label} — Χρειάζεται χαρακτηρισμό`);
            continue;
          }

          const mergedProject = {
            ...applyResult.form,
            projectId: project.projectId,
            subprojectId: project.subprojectId,
            updatedAt: new Date().toISOString(),
          };

          const freshCandidates = mergeRegistryCandidateLists(
            collectKhmdhsRegistryCandidatesFromChainRes(res.chainRes, mergedProject.khmdhsDataQualityReview),
            collectKhmdhsRegistryCandidatesFromProject(mergedProject)
          );
          if (freshCandidates.length) {
            const resyncedRegistry = resyncRegistryEntryTitles(
              mergedProject.khmdhsDocumentRegistry || [],
              freshCandidates
            );
            const newCandidates = freshCandidates.filter(
              (c) => !registryEntryIsAlreadyRecorded(c, resyncedRegistry)
            );
            mergedProject.khmdhsDocumentRegistry = newCandidates.length
              ? mergeKhmdhsDocumentRegistry(resyncedRegistry, newCandidates, new Date().toISOString())
              : resyncedRegistry;
          }

          const lockCheck = await ipcRenderer.invoke('check-entity-lock', 'projects', item.id);
          if (lockCheck?.locked) {
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: `Το υποέργο επεξεργάζεται από ${lockCheck.lockedBy || 'άλλον χρήστη'}`,
              phase: 'lock',
            });
            addLog('🔒', `${item.label} — Κλειδωμένο`);
            continue;
          }
          await ipcRenderer.invoke('create-khmdhs-refresh-snapshot', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          const saveRes = await ipcRenderer.invoke('save-project-data', mergedProject);
          if (saveRes?.success) {
            refreshed++;
            const report = buildKhmdhsRefreshChangeReport(project, mergedProject, applyResult);
            detailItems.push({
              status: 'refreshed',
              id: item.id,
              label: item.label,
              seedAdam: res.seedAdam,
              changeLines: report.lines,
              category: report.category,
              hasSubstantiveChanges: report.category === 'applied',
              meta: {
                statusAutoUpdated: applyResult.statusAutoUpdated || null,
                protectedCount: applyResult.protectedCount || 0,
                apeConflict: applyResult.apeConflict || null,
              },
            });
            const logIcon = report.category === 'applied' ? '✅' : report.category === 'attention' ? 'ℹ️' : '➖';
            const logText = report.category === 'applied'
              ? `${item.label} — Ενημερώθηκε (${report.appliedLines.length} αλλαγές)`
              : report.category === 'attention'
                ? `${item.label} — Διατηρήθηκαν χειροκίνητες τιμές`
                : `${item.label} — Χωρίς ουσιώδεις διαφορές`;
            addLog(logIcon, logText);
          } else {
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: saveRes?.error || 'Σφάλμα αποθήκευσης',
              phase: 'save',
            });
            addLog('❌', `${item.label} — Σφάλμα αποθήκευσης`);
          }
        } catch (err) {
          failed++;
          detailItems.push({
            status: 'failed',
            id: item.id,
            label: item.label,
            error: err?.message || 'Απρόσμενο σφάλμα',
            phase: 'exception',
          });
          addLog('❌', `${item.label} — Εξαίρεση`);
        }

        await new Promise((r) => setTimeout(r, 300));
      }

      const batchResults = {
        refreshed,
        needsIntervention,
        failed,
        skipped: skippedItems.length,
        interventionItems,
        items: detailItems,
      };

      if (typeof onBatchResults === 'function') {
        onBatchResults(batchResults);
      }

      if (refreshed > 0 && typeof onRefreshComplete === 'function') {
        onRefreshComplete();
      }

      showToast(
        `Μαζική ανανέωση ολοκληρώθηκε: ${refreshed} ενημερώθηκαν` +
        (needsIntervention ? `, ${needsIntervention} χρειάζονται χαρακτηρισμό` : '') +
        (failed ? `, ${failed} απέτυχαν` : ''),
        needsIntervention ? 'warning' : 'success'
      );
    } catch (e) {
      showToast(e?.message || 'Σφάλμα μαζικής ανανέωσης', 'error');
      if (typeof onBatchResults === 'function') {
        onBatchResults({
          refreshed: 0,
          needsIntervention: 0,
          failed: 1,
          skipped: 0,
          interventionItems: [],
          items: [{
            status: 'failed',
            id: 'batch-error',
            label: 'Μαζική ανανέωση',
            error: e?.message || 'Σφάλμα μαζικής ανανέωσης',
            phase: 'exception',
          }],
        });
      }
    } finally {
      setRunning(false);
    }
  }, [batchScope, currentUser, showToast, onRefreshComplete, onBatchResults, addLog]);

  if (!canUse) return null;

  return (
    <>
      <Container>
        <Header>
          <Title>
            🔄 Μαζική ανανέωση ΚΗΜΔΗΣ
            {staleCount > 0 && (
              <StaleBadge>
                🟡 {staleCount} χρειάζονται ανανέωση
                {oldestDays ? ` · παλαιότερο ${oldestDays} ημ.` : ''}
              </StaleBadge>
            )}
          </Title>
          {!running && (
            <Btn onClick={handleConfirmStart}>Εκτέλεση</Btn>
          )}
          {running && (
            <CancelBtn onClick={() => { cancelRef.current = true; }}>Ακύρωση</CancelBtn>
          )}
        </Header>

        {lastRunInfo && !running && (
          <MetaLine>
            <span>Τελευταία: {lastRunInfo.date} — {lastRunInfo.refreshed} ενημερώθηκαν</span>
            {hasReport && typeof onOpenReport === 'function' && (
              <ReportLinkBtn type="button" onClick={onOpenReport}>
                📋 Δείτε αναφορά
              </ReportLinkBtn>
            )}
          </MetaLine>
        )}

        {running && (
          <>
            <ProgressBar>
              <ProgressFill $pct={progress.total ? Math.round((progress.current / progress.total) * 100) : 0} />
            </ProgressBar>
            <StatusText>{progress.label}</StatusText>
            {logEntries.length > 0 && (
              <LogBox ref={logRef}>
                {logEntries.slice(-6).map((entry) => (
                  <LogEntry key={entry.ts}>{entry.icon} {entry.text}</LogEntry>
                ))}
              </LogBox>
            )}
          </>
        )}
      </Container>

      {confirmOpen && (
        <ConfirmOverlay onClick={() => setConfirmOpen(false)}>
          <ConfirmBox onClick={(e) => e.stopPropagation()}>
            <ConfirmTitle>🔄 Εκκίνηση μαζικής ανανέωσης ΚΗΜΔΗΣ</ConfirmTitle>
            <ConfirmDesc>
              {eligiblePreview != null
                ? `Βρέθηκαν ${allPreviewCount} επιλέξιμα υποέργα. Επιλέξτε ποια θα ανανεωθούν.`
                : 'Γίνεται εντοπισμός υποέργων…'}
            </ConfirmDesc>

            {eligiblePreview != null && (
              <ScopeOptions>
                <ScopeOption $active={batchScope === 'stale'}>
                  <ScopeRadio
                    type="radio"
                    name="khmdhs-batch-scope"
                    checked={batchScope === 'stale'}
                    onChange={() => setBatchScope('stale')}
                  />
                  <ScopeText>
                    <ScopeLabel>Μόνο τα παλαιά ({stalePreviewCount})</ScopeLabel>
                    <ScopeHint>
                      Υποέργα χωρίς ανανέωση πάνω από {STALE_BATCH_DAYS} ημέρες, ή που δεν έχουν ανανεωθεί ποτέ.
                      Συνιστάται για καθημερινή χρήση.
                    </ScopeHint>
                  </ScopeText>
                </ScopeOption>
                <ScopeOption $active={batchScope === 'all'}>
                  <ScopeRadio
                    type="radio"
                    name="khmdhs-batch-scope"
                    checked={batchScope === 'all'}
                    onChange={() => setBatchScope('all')}
                  />
                  <ScopeText>
                    <ScopeLabel>Όλα τα επιλέξιμα ({allPreviewCount})</ScopeLabel>
                    <ScopeHint>
                      Πλήρης έλεγχος όλων των υποέργων που μπορούν να ανανεωθούν — μπορεί να διαρκέσει περισσότερο.
                    </ScopeHint>
                  </ScopeText>
                </ScopeOption>
              </ScopeOptions>
            )}

            <ConfirmDesc style={{ marginBottom: '1.1rem', fontSize: '0.68rem' }}>
              Τα υποέργα που χρειάζονται χαρακτηρισμό εγγράφων δεν θα πειραχτούν — θα εμφανιστούν σε λίστα.
            </ConfirmDesc>

            <ConfirmActions>
              <ConfirmCancel onClick={() => setConfirmOpen(false)}>Ακύρωση</ConfirmCancel>
              <ConfirmProceed
                onClick={handleBatchRefresh}
                disabled={eligiblePreview == null || !selectedCount}
              >
                {eligiblePreview == null
                  ? 'Εντοπισμός…'
                  : `Εκκίνηση (${selectedCount || 0} υποέργα)`}
              </ConfirmProceed>
            </ConfirmActions>
          </ConfirmBox>
        </ConfirmOverlay>
      )}
    </>
  );
}
