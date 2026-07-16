import React, { useCallback, useEffect, useState, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
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

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  animation: ${fadeIn} 0.3s ease;
  background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
  border: 1px solid #99f6e4;
  border-radius: 12px;
  padding: 1rem 1.2rem;
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
  gap: 0.4rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: ${(p) => p.$bg || '#d1fae5'};
  color: ${(p) => p.$color || '#065f46'};
`;

const Btn = styled.button`
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #14b8a6;
  background: #14b8a6;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: #0d9488; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DismissBtn = styled.button`
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const ProgressBar = styled.div`
  margin-top: 0.7rem;
  background: #ccfbf1;
  border-radius: 6px;
  height: 6px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #14b8a6, #06b6d4);
  border-radius: 6px;
  transition: width 0.4s ease;
  width: ${(p) => p.$pct}%;
`;

const StatusText = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.68rem;
  color: #475569;
`;

const ResultSection = styled.div`
  margin-top: 0.7rem;
  font-size: 0.68rem;
  color: #334155;
  line-height: 1.5;
`;

const ResultLine = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 2px 0;
`;

const StaleNotice = styled.div`
  animation: ${fadeIn} 0.3s ease;
  background: linear-gradient(135deg, #fefce8 0%, #fffbeb 100%);
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.8rem 1rem;
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const StaleText = styled.span`
  font-size: 0.72rem;
  color: #92400e;
  font-weight: 600;
`;

export function KhmdhsStalenessNotice({ userRole, currentUser }) {
  const [staleCount, setStaleCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return;
    checkedRef.current = true;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('check-khmdhs-staleness', {
          maxAgeDays: 7,
          actingUsername: currentUser?.username,
        });
        if (res?.success && res.stale?.length) {
          setStaleCount(res.stale.length);
        }
      } catch {}
    })();
  }, [userRole]);

  if (!staleCount || dismissed) return null;

  return (
    <StaleNotice>
      <StaleText>
        🔄 {staleCount} υποέργ{staleCount === 1 ? 'ο δεν έχει' : 'α δεν έχουν'} ανανεωθεί
        τις τελευταίες 7 ημέρες.
      </StaleText>
      <DismissBtn onClick={() => setDismissed(true)}>Απόκρυψη</DismissBtn>
    </StaleNotice>
  );
}

export default function KhmdhsBatchRefreshWidget({ userRole, currentUser, onRefreshComplete }) {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [results, setResults] = useState(null);
  const cancelRef = useRef(false);

  const canUse = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  const handleBatchRefresh = useCallback(async () => {
    setRunning(true);
    setResults(null);
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
        setResults({ refreshed: 0, needsIntervention: 0, failed: 0, skipped: skipped.length });
        setRunning(false);
        return;
      }

      setProgress({ current: 0, total, label: `0 / ${total}` });

      let refreshed = 0;
      let needsIntervention = 0;
      let failed = 0;
      const interventionList = [];

      for (let i = 0; i < total; i++) {
        if (cancelRef.current) break;
        const item = eligible[i];
        setProgress({ current: i + 1, total, label: `${i + 1} / ${total} — ${item.label}` });

        try {
          const res = await ipcRenderer.invoke('preview-subproject-khmdhs-refresh', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          if (!res?.success) {
            failed++;
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
            interventionList.push(item.label);
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
            continue;
          }
          await ipcRenderer.invoke('create-khmdhs-refresh-snapshot', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          const saveRes = await ipcRenderer.invoke('save-project-data', mergedProject);
          if (saveRes?.success) {
            refreshed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        await new Promise((r) => setTimeout(r, 300));
      }

      setResults({
        refreshed,
        needsIntervention,
        failed,
        skipped: skipped.length,
        interventionList,
      });

      if (refreshed > 0 && typeof onRefreshComplete === 'function') {
        onRefreshComplete();
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα μαζικής ανανέωσης', 'error');
    } finally {
      setRunning(false);
    }
  }, [currentUser, showToast, onRefreshComplete]);

  if (!canUse) return null;

  return (
    <Container>
      <Header>
        <Title>
          🔄 Μαζική ανανέωση ΚΗΜΔΗΣ
        </Title>
        {!running && !results && (
          <Btn onClick={handleBatchRefresh}>Εκτέλεση</Btn>
        )}
        {running && (
          <DismissBtn onClick={() => { cancelRef.current = true; }}>Ακύρωση</DismissBtn>
        )}
        {results && !running && (
          <DismissBtn onClick={() => setResults(null)}>Κλείσιμο</DismissBtn>
        )}
      </Header>

      {running && (
        <>
          <ProgressBar>
            <ProgressFill $pct={progress.total ? Math.round((progress.current / progress.total) * 100) : 0} />
          </ProgressBar>
          <StatusText>{progress.label}</StatusText>
        </>
      )}

      {results && !running && (
        <ResultSection>
          <ResultLine>✅ Ανανεώθηκαν αυτόματα: <strong>{results.refreshed}</strong></ResultLine>
          {results.needsIntervention > 0 && (
            <ResultLine>
              ⚠️ Χρειάζονται χαρακτηρισμό: <strong>{results.needsIntervention}</strong>
              {results.interventionList?.length ? (
                <Badge $bg="#fef3c7" $color="#92400e" style={{ marginLeft: 4 }}>
                  {results.interventionList.slice(0, 3).join(', ')}
                  {results.interventionList.length > 3 ? ` (+${results.interventionList.length - 3})` : ''}
                </Badge>
              ) : null}
            </ResultLine>
          )}
          {results.failed > 0 && (
            <ResultLine>❌ Αποτυχία: <strong>{results.failed}</strong></ResultLine>
          )}
          {results.skipped > 0 && (
            <ResultLine>⏭️ Παραλείφθηκαν: <strong>{results.skipped}</strong></ResultLine>
          )}
        </ResultSection>
      )}
    </Container>
  );
}
