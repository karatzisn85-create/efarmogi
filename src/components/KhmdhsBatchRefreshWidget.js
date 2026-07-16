import React, { useCallback, useEffect, useState, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useToast } from './ToastProvider';
import { applyAdamChainResult } from '../utils/khmdhsChainApply';
import { symvPlanMatchesChain } from '../utils/khmdhsSymvChainPlanner';
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
  width: min(420px, 100%);
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
  margin: 0 0 1.2rem;
  font-size: 0.76rem;
  color: #475569;
  line-height: 1.5;
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
  &:hover { box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4); }
`;

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

/* ═══════════════════════════════════════════
   EXPORTED: Floating Button
   ═══════════════════════════════════════════ */
export function KhmdhsBatchReportFab({ pendingItems, onClick, isRunning }) {
  if (!pendingItems?.length && !isRunning) return null;

  const count = pendingItems?.length || 0;
  const urgent = count > 5;
  const tooltipText = isRunning
    ? 'Μαζική ανανέωση σε εξέλιξη…'
    : `${count} υποέργ${count === 1 ? 'ο χρειάζεται' : 'α χρειάζονται'} χαρακτηρισμό — κλικ για αναφορά`;

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
  const [showSkipped, setShowSkipped] = useState(false);

  if (!isOpen || !results) return null;

  const allResolved = (!pendingItems || pendingItems.length === 0) && (results.needsIntervention > 0);

  return (
    <ModalOverlay onClick={onClose}>
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>📋 Αναφορά μαζικής ανανέωσης ΚΗΜΔΗΣ</ModalTitle>
          <ModalCloseBtn onClick={onClose}>✕</ModalCloseBtn>
        </ModalHeader>
        <ModalBody>
          {results.refreshed > 0 && (
            <StatCard $bg="#ecfdf5" $border="#6ee7b7">
              <StatIcon>✅</StatIcon>
              <StatText $color="#065f46">
                Ανανεώθηκαν επιτυχώς: <strong>{results.refreshed}</strong> υποέργα
              </StatText>
            </StatCard>
          )}

          {results.failed > 0 && (
            <StatCard $bg="#fef2f2" $border="#fca5a5">
              <StatIcon>❌</StatIcon>
              <StatText $color="#991b1b">
                Αποτυχία: <strong>{results.failed}</strong> υποέργα
              </StatText>
            </StatCard>
          )}

          {pendingItems?.length > 0 && (
            <>
              <SectionHeader $color="#92400e">
                ⚠️ Χρειάζονται χαρακτηρισμό: {pendingItems.length}
              </SectionHeader>
              {pendingItems.map((item) => (
                <InterventionItem
                  key={item.id}
                  onClick={() => {
                    onNavigateToSubproject(item.id);
                    onClose();
                  }}
                >
                  <InterventionIcon>📄</InterventionIcon>
                  <InterventionContent>
                    <InterventionTitle>{item.label}</InterventionTitle>
                    <InterventionSubtitle>
                      Εντοπίστηκαν πολλαπλά έγγραφα συμβάσεων — ορίστε ποιο είναι κύρια, παράταση ή συμπληρωματική
                    </InterventionSubtitle>
                  </InterventionContent>
                </InterventionItem>
              ))}
            </>
          )}

          {allResolved && (
            <AllDoneBanner>
              🎉 Όλοι οι χαρακτηρισμοί ολοκληρώθηκαν — η βάση δεδομένων είναι πλήρως ενημερωμένη!
            </AllDoneBanner>
          )}

          {results.skipped > 0 && (
            <>
              <SectionHeader
                $color="#64748b"
                onClick={() => setShowSkipped(!showSkipped)}
              >
                <SectionChevron $open={showSkipped}>▶</SectionChevron>
                ⏭️ Παραλείφθηκαν: {results.skipped} υποέργα
              </SectionHeader>
              {showSkipped && (
                <SkippedList>
                  Αφορά υποέργα που δεν πληρούν τις προϋποθέσεις μαζικής ανανέωσης:
                  <br />• Δεν έχουν ΑΔΑΜ αφετηρίας (δεν έγινε ποτέ αρχική ανάκτηση)
                  <br />• Είναι ολοκληρωμένα & αποπληρωμένα
                  <br />• Ήταν κλειδωμένα από άλλον χρήστη
                </SkippedList>
              )}
            </>
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
  staleCount = 0,
  oldestDays = null,
  lastRunInfo = null,
}) {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [logEntries, setLogEntries] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligibleCount, setEligibleCount] = useState(null);
  const cancelRef = useRef(false);
  const logRef = useRef(null);

  const canUse = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

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
    try {
      const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
        actingUsername: currentUser?.username,
      });
      if (eligRes?.success) {
        setEligibleCount(eligRes.eligible?.length || 0);
      }
    } catch {
      setEligibleCount(null);
    }
  }, [currentUser]);

  const handleBatchRefresh = useCallback(async () => {
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

      const { eligible, skipped } = eligRes;
      const total = eligible.length;
      if (!total) {
        if (typeof onBatchResults === 'function') {
          onBatchResults({ refreshed: 0, needsIntervention: 0, failed: 0, skipped: skipped.length, interventionItems: [] });
        }
        showToast('Δεν βρέθηκαν υποέργα για ανανέωση.', 'info');
        setRunning(false);
        return;
      }

      setProgress({ current: 0, total, label: `0 / ${total}` });
      addLog('🔍', `Βρέθηκαν ${total} υποέργα για ανανέωση`);

      let refreshed = 0;
      let needsIntervention = 0;
      let failed = 0;
      const interventionItems = [];

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
            addLog('✅', `${item.label} — Ενημερώθηκε`);
          } else {
            failed++;
            addLog('❌', `${item.label} — Σφάλμα αποθήκευσης`);
          }
        } catch {
          failed++;
          addLog('❌', `${item.label} — Εξαίρεση`);
        }

        await new Promise((r) => setTimeout(r, 300));
      }

      const batchResults = {
        refreshed,
        needsIntervention,
        failed,
        skipped: skipped.length,
        interventionItems,
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
        onBatchResults({ refreshed: 0, needsIntervention: 0, failed: 1, skipped: 0, interventionItems: [] });
      }
    } finally {
      setRunning(false);
    }
  }, [currentUser, showToast, onRefreshComplete, onBatchResults, addLog]);

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
              {eligibleCount != null
                ? `Θα ελεγχθούν ${eligibleCount} υποέργα στο ΚΗΜΔΗΣ. Η διαδικασία μπορεί να διαρκέσει μερικά λεπτά ανάλογα με τον αριθμό τους.`
                : 'Γίνεται εντοπισμός υποέργων…'}
              <br /><br />
              Τα υποέργα που χρειάζονται χαρακτηρισμό εγγράφων δεν θα πειραχτούν — θα εμφανιστούν σε λίστα.
            </ConfirmDesc>
            <ConfirmActions>
              <ConfirmCancel onClick={() => setConfirmOpen(false)}>Ακύρωση</ConfirmCancel>
              <ConfirmProceed
                onClick={handleBatchRefresh}
                disabled={eligibleCount == null || eligibleCount === 0}
              >
                {eligibleCount != null ? `Εκκίνηση (${eligibleCount} υποέργα)` : 'Εντοπισμός…'}
              </ConfirmProceed>
            </ConfirmActions>
          </ConfirmBox>
        </ConfirmOverlay>
      )}
    </>
  );
}
