import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useToast } from './ToastProvider';
import { applyAdamChainResult, applyStitchRefreshResults } from '../utils/khmdhsChainApply';
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
  filterRegistryCandidatesBySymvPlan,
} from '../utils/khmdhsDocumentRegistry';
import { summarizeKhmdhsFetchFailure } from '../utils/khmdhsFetchFailureSummary';
import { evaluateStitchRefreshCompleteness } from '../utils/khmdhsChainStitchPlan';

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

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/* ═══════════════════════════════════════════
   INLINE WIDGET (Dashboard) — teal signature
   ═══════════════════════════════════════════ */
const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Container = styled.div`
  animation: ${fadeIn} 0.35s ease;
  position: relative;
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(20, 184, 166, 0.10) 0%, transparent 45%),
    linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%);
  border: 1px solid #99f6e4;
  border-radius: 16px;
  padding: 1.05rem 1.25rem 1.1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px rgba(13, 148, 136, 0.06);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, #0d9488, #14b8a6 55%, #2dd4bf);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
`;

const IconChip = styled.div`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #14b8a6 60%, #2dd4bf);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.32);
`;

const TitleGroup = styled.div`
  min-width: 0;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #0f766e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Subtitle = styled.div`
  margin-top: 2px;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
`;

const StaleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
`;

const MetaLine = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px dashed #cbfbef;
  font-size: 0.7rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  flex-shrink: 0;
  padding: 0.55rem 1.35rem;
  border-radius: 11px;
  border: none;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13, 148, 136, 0.42); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CancelBtn = styled.button`
  flex-shrink: 0;
  padding: 0.45rem 1rem;
  border-radius: 10px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #dc2626;
  font-size: 0.74rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: #fef2f2; }
  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const RunPanel = styled.div`
  margin-top: 0.9rem;
`;

const ProgressHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
`;

const ProgressPct = styled.span`
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f766e;
  font-variant-numeric: tabular-nums;
`;

const ProgressCount = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  font-variant-numeric: tabular-nums;
`;

const ProgressBar = styled.div`
  background: #ccfbf1;
  border-radius: 999px;
  height: 10px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf, #14b8a6);
  background-size: 200% 100%;
  animation: ${shimmer} 2.2s linear infinite;
  border-radius: 999px;
  transition: width 0.4s ease;
  width: ${(p) => p.$pct}%;
`;

const StatusText = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.74rem;
  color: #334155;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LogToggle = styled.button`
  margin-top: 0.55rem;
  padding: 0;
  border: none;
  background: none;
  color: #0f766e;
  font-size: 0.68rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  &:hover { color: #0d9488; }
`;

const LogChevron = styled.span`
  display: inline-block;
  transition: transform 0.2s;
  font-size: 0.6rem;
  ${(p) => p.$open && 'transform: rotate(90deg);'}
`;

const LogBox = styled.div`
  margin-top: 0.4rem;
  max-height: 96px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 0.5rem 0.7rem;
  font-size: 0.66rem;
  color: #475569;
  line-height: 1.65;
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
  flex-wrap: wrap;
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

const ConfirmRefresh = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #99f6e4;
  background: #f0fdfa;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  &:hover:not(:disabled) { background: #ccfbf1; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const STALE_BATCH_DAYS = 7;
/** Αν ο διάλογος μείνει ανοιχτός περισσότερο, ξανασαρώνουμε πριν την εκτέλεση (#4). */
const ELIGIBLE_PREVIEW_MAX_AGE_MS = 2 * 60 * 1000;

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
  background: ${(p) => p.$pending
    ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 60%, #fbbf24 100%)'
    : 'linear-gradient(135deg, #0f766e 0%, #14b8a6 60%, #2dd4bf 100%)'};
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 6px 20px ${(p) => p.$pending ? 'rgba(245, 158, 11, 0.4)' : 'rgba(13, 148, 136, 0.4)'};
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  ${(p) => p.$pending && css`animation: ${fabPulseCalm} 3.2s ease-in-out infinite;`}

  ${(p) => p.$spinning && css`
    background: linear-gradient(135deg, #0d9488 0%, #14b8a6 60%, #2dd4bf 100%);
    animation: none;
  `}

  &:hover {
    transform: translateY(-3px) scale(1.08);
    box-shadow: 0 10px 36px ${(p) => p.$pending ? 'rgba(217, 119, 6, 0.5)' : 'rgba(13, 148, 136, 0.5)'};
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
  font-size: 0.72rem;
  color: #334155;
  line-height: 1.55;
  padding: 0.22rem 0;
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

const ChangeLineWarn = styled(ChangeLine)`
  color: #92400e;
  font-weight: 600;
  &::before { content: '⚠'; color: #d97706; }
`;

const ChangeGroupLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  color: #0f766e;
  margin: 0.45rem 0 0.2rem;
  letter-spacing: 0.01em;
`;

const RegistryBlock = styled.div`
  margin-top: 0.35rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
`;

const RegistryToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  text-align: left;
`;

const RegistryList = styled.ul`
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.68rem;
  color: #475569;
  line-height: 1.5;
`;

const ErrorLine = styled.div`
  font-size: 0.66rem;
  color: #991b1b;
  line-height: 1.45;
  padding: 0.35rem 0 0;
`;

const BATCH_REGISTRY_PREFIX = 'Νέο έγγραφο στα Αρχεία Υποέργου:';

function splitBatchChangeLines(changeLines) {
  const other = [];
  const registry = [];
  (changeLines || []).forEach((line) => {
    if (String(line || '').startsWith(BATCH_REGISTRY_PREFIX)) {
      registry.push(String(line).slice(BATCH_REGISTRY_PREFIX.length).trim());
    } else {
      other.push(line);
    }
  });
  return { other, registry };
}

function summarizeAppliedChanges(appliedLines = []) {
  const n = appliedLines.length;
  if (!n) return 'Χωρίς καταγεγραμμένες προσθήκες';
  const preview = appliedLines.slice(0, 2).join(' · ');
  const more = n > 2 ? ` · (+${n - 2} ακόμη)` : '';
  return `${n} προσθήκ${n === 1 ? 'η/αλλαγή' : 'ες/αλλαγές'}: ${preview}${more}`;
}

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

/* ── Summary-first hero ── */
const ReportHero = styled.div`
  position: relative;
  border-radius: 16px;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1rem;
  overflow: hidden;
  color: #fff;
  background: ${(p) => p.$tone === 'attention'
    ? 'linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)'
    : p.$tone === 'error'
      ? 'linear-gradient(135deg, #9f1239 0%, #be123c 55%, #e11d48 100%)'
      : 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)'};
  box-shadow: 0 10px 30px ${(p) => p.$tone === 'attention'
    ? 'rgba(217, 119, 6, 0.28)'
    : p.$tone === 'error'
      ? 'rgba(190, 18, 60, 0.28)'
      : 'rgba(13, 148, 136, 0.28)'};
`;

const HeroGlow = styled.div`
  position: absolute;
  top: -40%;
  right: -10%;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%);
  pointer-events: none;
`;

const HeroTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  position: relative;
`;

const HeroEmoji = styled.span`
  font-size: 1.5rem;
  animation: ${checkBounce} 0.5s ease;
`;

const HeroVerdict = styled.div`
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
`;

const HeroSub = styled.div`
  position: relative;
  margin-top: 0.35rem;
  font-size: 0.74rem;
  font-weight: 500;
  opacity: 0.92;
  line-height: 1.5;
`;

const StatChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const StatChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: ${(p) => p.$bg || '#f8fafc'};
  color: ${(p) => p.$color || '#334155'};
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};

  strong { font-weight: 800; font-variant-numeric: tabular-nums; }
`;

const RetryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 0.2rem 0 0.9rem;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
`;

const RetryText = styled.div`
  font-size: 0.72rem;
  color: #0f766e;
  font-weight: 600;
  line-height: 1.4;
`;

const RetryButton = styled.button`
  flex-shrink: 0;
  padding: 0.5rem 1.1rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(13, 148, 136, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(13, 148, 136, 0.4); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ═══════════════════════════════════════════
   EXPORTED: Floating Button
   ═══════════════════════════════════════════ */
export function KhmdhsBatchReportFab({ pendingItems, onClick, isRunning, hasReport }) {
  if (!pendingItems?.length && !isRunning && !hasReport) return null;

  const count = pendingItems?.length || 0;
  const tooltipText = isRunning
    ? 'Μαζική ανανέωση σε εξέλιξη…'
    : count > 0
      ? `${count} υποέργ${count === 1 ? 'ο χρειάζεται' : 'α χρειάζονται'} χαρακτηρισμό — κλικ για αναφορά`
      : 'Άνοιγμα αναφοράς μαζικής ανανέωσης';

  return (
    <ReportFab
      onClick={onClick}
      $pending={count > 0 && !isRunning}
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
  defaultShowAllRegistry = false,
}) {
  const [showAllRegistry, setShowAllRegistry] = useState(defaultShowAllRegistry);
  const appliedLines = item.appliedLines
    || (item.category === 'applied' ? (item.changeLines || []) : []);
  const attentionLines = item.attentionLines
    || (item.category === 'attention' ? (item.changeLines || []) : []);
  const allLines = item.changeLines || [...appliedLines, ...attentionLines];
  const isUnchanged = item.category === 'unchanged'
    || (allLines.length === 1 && allLines[0] === KHMDHS_REFRESH_REPORT_NO_CHANGES);

  const appliedSplit = splitBatchChangeLines(
    item.appliedLines?.length
      ? item.appliedLines
      : (item.category === 'applied' ? allLines.filter((l) => !String(l).startsWith('⚠️') && !String(l).startsWith('ℹ️')) : [])
  );
  const attentionOnly = item.attentionLines?.length
    ? item.attentionLines
    : (item.category === 'attention'
      ? allLines
      : allLines.filter((l) => String(l).startsWith('⚠️') || String(l).startsWith('ℹ️')));

  const registryPreviewLimit = 8;
  const registryVisible = showAllRegistry
    ? appliedSplit.registry
    : appliedSplit.registry.slice(0, registryPreviewLimit);
  const hasMoreRegistry = appliedSplit.registry.length > registryPreviewLimit;

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

          {isUnchanged && allLines.map((line, idx) => (
            <ChangeLineMuted key={`u-${idx}`}>{line}</ChangeLineMuted>
          ))}

          {!isUnchanged && (appliedSplit.other.length > 0 || appliedSplit.registry.length > 0) && (
            <>
              <ChangeGroupLabel>Τι προστέθηκε ή άλλαξε</ChangeGroupLabel>
              {appliedSplit.other.map((line, idx) => (
                <ChangeLine key={`a-${idx}`}>{line}</ChangeLine>
              ))}
              {appliedSplit.registry.length > 0 && (
                <RegistryBlock>
                  <RegistryToggle
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMoreRegistry) setShowAllRegistry((v) => !v);
                    }}
                    style={{ cursor: hasMoreRegistry ? 'pointer' : 'default' }}
                  >
                    <span>
                      📁 {appliedSplit.registry.length} νέ
                      {appliedSplit.registry.length === 1 ? 'ο έγγραφο' : 'α έγγραφα'} στα Αρχεία Υποέργου
                    </span>
                    {hasMoreRegistry && <span>{showAllRegistry ? '▲' : '▼'}</span>}
                  </RegistryToggle>
                  <RegistryList>
                    {registryVisible.map((line, i) => (
                      <li key={`r-${i}`}>{line}</li>
                    ))}
                    {!showAllRegistry && hasMoreRegistry && (
                      <li style={{ listStyle: 'none', marginLeft: '-1rem', color: '#64748b', fontWeight: 600 }}>
                        …και άλλα {appliedSplit.registry.length - registryPreviewLimit}. Κλικ για πλήρη λίστα.
                      </li>
                    )}
                  </RegistryList>
                </RegistryBlock>
              )}
            </>
          )}

          {!isUnchanged && attentionOnly.length > 0 && (
            <>
              <ChangeGroupLabel style={{ color: '#92400e' }}>Σημεία προς προσοχή</ChangeGroupLabel>
              {attentionOnly.map((line, idx) => (
                <ChangeLineWarn key={`w-${idx}`}>{line}</ChangeLineWarn>
              ))}
            </>
          )}

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
  onRetry,
}) {
  const [openSections, setOpenSections] = useState({
    refreshed: true,
    attention: true,
    unchanged: false,
    failed: true,
    later: true,
    intervened: true,
    skipped: false,
  });
  const [openItems, setOpenItems] = useState({});

  if (!isOpen || !results) return null;

  const items = Array.isArray(results.items) ? results.items : [];
  const refreshedItems = items.filter((i) => i.status === 'refreshed' && i.category === 'applied');
  const attentionItems = items.filter((i) => i.status === 'refreshed' && i.category === 'attention');
  const unchangedItems = items.filter((i) => i.status === 'refreshed' && (i.category === 'unchanged' || (!i.category && !i.hasSubstantiveChanges)));
  // Τα κλειδωμένα δεν είναι «αποτυχία» — απλώς τα δούλευε κάποιος τη στιγμή εκείνη.
  const failedItems = items.filter((i) => i.status === 'failed' && i.phase !== 'lock');
  const laterItems = items.filter((i) => i.status === 'failed' && i.phase === 'lock');
  const skippedItems = items.filter((i) => i.status === 'skipped');
  const intervenedFromItems = items.filter((i) => i.status === 'intervened');
  const interventionList = pendingItems?.length
    ? pendingItems
    : intervenedFromItems;

  const allResolved = (!pendingItems || pendingItems.length === 0)
    && (results.needsIntervention > 0 || intervenedFromItems.length > 0);

  // Υποψήφια για «Επανάληψη»: πραγματικές αποτυχίες + κλειδωμένα (ό,τι δεν ολοκληρώθηκε).
  const retryCandidates = [...failedItems, ...laterItems]
    .filter((i) => i.id)
    .map((i) => ({ id: i.id, label: i.label }));

  // Ιεραρχία ευρημάτων: πρώτο ό,τι θέλει ενέργεια, μετά ό,τι πήγε καλά.
  const okCount = refreshedItems.length + unchangedItems.length;
  const needsActionCount = interventionList.length + failedItems.length;
  const heroTone = failedItems.length > 0
    ? 'error'
    : needsActionCount > 0
      ? 'attention'
      : 'ok';
  const heroEmoji = heroTone === 'error' ? '⚠️' : heroTone === 'attention' ? '📝' : '🎉';
  const heroVerdict = heroTone === 'error'
    ? 'Ολοκληρώθηκε — χρειάζεται μια ματιά'
    : heroTone === 'attention'
      ? 'Σχεδόν έτοιμο — μένουν λίγες ενέργειες'
      : 'Όλα ενημερωμένα!';
  const heroParts = [];
  if (refreshedItems.length) heroParts.push(`${refreshedItems.length} ενημερώθηκαν`);
  if (attentionItems.length) heroParts.push(`${attentionItems.length} θέλουν προσοχή`);
  if (unchangedItems.length) heroParts.push(`${unchangedItems.length} χωρίς αλλαγές`);
  if (interventionList.length) heroParts.push(`${interventionList.length} για χαρακτηρισμό`);
  if (failedItems.length) heroParts.push(`${failedItems.length} απέτυχαν`);
  if (laterItems.length) heroParts.push(`${laterItems.length} για αργότερα`);
  if (skippedItems.length) heroParts.push(`${skippedItems.length} εκτός`);
  const heroSub = heroParts.length ? heroParts.join(' · ') : 'Δεν καταγράφηκαν ευρήματα.';

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isItemOpen = (id, defaultOpen = false) => (
    openItems[id] !== undefined ? !!openItems[id] : defaultOpen
  );

  const toggleItem = (id, defaultOpen = false) => {
    setOpenItems((prev) => {
      const currentlyOpen = prev[id] !== undefined ? !!prev[id] : defaultOpen;
      return { ...prev, [id]: !currentlyOpen };
    });
  };

  const goTo = (id) => {
    if (typeof onNavigateToSubproject === 'function') {
      onNavigateToSubproject(id);
      onClose();
    }
  };

  const handleRetry = () => {
    if (typeof onRetry === 'function' && retryCandidates.length) {
      onRetry(retryCandidates);
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
          <ReportHero $tone={heroTone}>
            <HeroGlow />
            <HeroTop>
              <HeroEmoji>{heroEmoji}</HeroEmoji>
              <HeroVerdict>{heroVerdict}</HeroVerdict>
            </HeroTop>
            <HeroSub>{heroSub}</HeroSub>
          </ReportHero>

          <StatChipRow>
            {okCount > 0 && (
              <StatChip $bg="#ecfdf5" $color="#065f46" $border="#6ee7b7">
                ✅ Ενημερωμένα <strong>{okCount}</strong>
              </StatChip>
            )}
            {attentionItems.length > 0 && (
              <StatChip $bg="#fffbeb" $color="#92400e" $border="#fde68a">
                ℹ️ Προσοχή <strong>{attentionItems.length}</strong>
              </StatChip>
            )}
            {interventionList.length > 0 && (
              <StatChip $bg="#fffbeb" $color="#b45309" $border="#fde68a">
                ⚠️ Χαρακτηρισμός <strong>{interventionList.length}</strong>
              </StatChip>
            )}
            {failedItems.length > 0 && (
              <StatChip $bg="#fef2f2" $color="#991b1b" $border="#fecaca">
                ❌ Απέτυχαν <strong>{failedItems.length}</strong>
              </StatChip>
            )}
            {laterItems.length > 0 && (
              <StatChip $bg="#f1f5f9" $color="#475569" $border="#cbd5e1">
                🔒 Αργότερα <strong>{laterItems.length}</strong>
              </StatChip>
            )}
            {skippedItems.length > 0 && (
              <StatChip $bg="#f8fafc" $color="#64748b" $border="#e2e8f0">
                ⏭️ Εκτός <strong>{skippedItems.length}</strong>
              </StatChip>
            )}
          </StatChipRow>

          {typeof onRetry === 'function' && retryCandidates.length > 0 && (
            <RetryBar>
              <RetryText>
                {failedItems.length > 0 && laterItems.length > 0
                  ? `${failedItems.length} απέτυχαν και ${laterItems.length} έμειναν κλειδωμένα.`
                  : failedItems.length > 0
                    ? `${failedItems.length} υποέργα δεν ολοκληρώθηκαν.`
                    : `${laterItems.length} υποέργα ήταν κλειδωμένα τη στιγμή εκείνη.`}
                {' '}Θέλετε να ξαναπροσπαθήσουμε μόνο αυτά;
              </RetryText>
              <RetryButton type="button" onClick={handleRetry}>
                🔁 Επανάληψη ({retryCandidates.length})
              </RetryButton>
            </RetryBar>
          )}

          {refreshedItems.length > 0 && (
            <>
              <SectionHeader $color="#065f46" onClick={() => toggleSection('refreshed')}>
                <SectionChevron $open={openSections.refreshed}>▶</SectionChevron>
                ✅ Ενημερώθηκαν με αλλαγές ({refreshedItems.length}) — πλήρης λίστα προσθηκών
              </SectionHeader>
              {openSections.refreshed && refreshedItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={isItemOpen(item.id, true)}
                  onToggle={() => toggleItem(item.id, true)}
                  border="#6ee7b7"
                  bg="#f0fdf4"
                  icon="✅"
                  meta={summarizeAppliedChanges(item.appliedLines?.length ? item.appliedLines : item.changeLines)}
                  onNavigate={goTo}
                  defaultShowAllRegistry
                />
              ))}
            </>
          )}

          {attentionItems.length > 0 && (
            <>
              <SectionHeader $color="#92400e" onClick={() => toggleSection('attention')}>
                <SectionChevron $open={openSections.attention}>▶</SectionChevron>
                ℹ️ Ελέγχθηκαν — χρειάζονται προσοχή ({attentionItems.length})
              </SectionHeader>
              {openSections.attention && attentionItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={isItemOpen(item.id, true)}
                  onToggle={() => toggleItem(item.id, true)}
                  border="#fde68a"
                  bg="#fffbeb"
                  icon="ℹ️"
                  meta="Ελέγχθηκε — υπάρχουν σημεία προς προσοχή (π.χ. διατηρήθηκαν υπάρχοντα δεδομένα ή χειροκίνητες τιμές)."
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
                  meta={summarizeKhmdhsFetchFailure(item.error || item.reason)}
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {laterItems.length > 0 && (
            <>
              <SectionHeader $color="#475569" onClick={() => toggleSection('later')}>
                <SectionChevron $open={openSections.later}>▶</SectionChevron>
                🔒 Για αργότερα — ήταν σε χρήση ({laterItems.length})
              </SectionHeader>
              {openSections.later && (
                <>
                  <SkippedList style={{ marginBottom: '0.4rem' }}>
                    Τα υποέργα αυτά τα επεξεργαζόταν κάποιος τη στιγμή της ανανέωσης, γι' αυτό τα αφήσαμε ανέγγιχτα. Ξαναδοκιμάστε τα αργότερα.
                  </SkippedList>
                  {laterItems.map((item) => (
                    <ReportItemCard
                      key={`later-${item.id}`}
                      item={item}
                      open={!!openItems[`later-${item.id}`]}
                      onToggle={() => toggleItem(`later-${item.id}`)}
                      border="#cbd5e1"
                      bg="#f1f5f9"
                      icon="🔒"
                      meta={item.error || 'Ήταν κλειδωμένο από άλλον χρήστη'}
                      onNavigate={goTo}
                    />
                  ))}
                </>
              )}
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
            && !failedItems.length && !laterItems.length && !interventionList.length && !skippedItems.length && (
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
  retrySignal = null,
}) {
  const { showToast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [logEntries, setLogEntries] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligiblePreview, setEligiblePreview] = useState(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const eligibleSkippedRef = useRef([]);
  const eligiblePreviewAtRef = useRef(0);
  const [batchScope, setBatchScope] = useState('stale'); // 'stale' | 'all'
  const cancelRef = useRef(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [showLog, setShowLog] = useState(false);
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

  const fetchEligiblePreview = useCallback(async ({ resetScope = false } = {}) => {
    setEligibleLoading(true);
    try {
      const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
        actingUsername: currentUser?.username,
      });
      if (eligRes?.success) {
        const list = eligRes.eligible || [];
        eligibleSkippedRef.current = eligRes.skipped || [];
        eligiblePreviewAtRef.current = Date.now();
        setEligiblePreview(list);
        if (resetScope) {
          const staleN = list.filter((item) => isEligibleStale(item)).length;
          setBatchScope(staleN > 0 ? 'stale' : 'all');
        }
        return { success: true, eligible: list, skipped: eligRes.skipped || [] };
      }
      setEligiblePreview(null);
      eligibleSkippedRef.current = [];
      eligiblePreviewAtRef.current = 0;
      return { success: false, error: eligRes?.error || 'Σφάλμα εντοπισμού' };
    } catch (err) {
      setEligiblePreview(null);
      eligibleSkippedRef.current = [];
      eligiblePreviewAtRef.current = 0;
      return { success: false, error: err?.message || 'Σφάλμα εντοπισμού' };
    } finally {
      setEligibleLoading(false);
    }
  }, [currentUser]);

  const handleConfirmStart = useCallback(async () => {
    setConfirmOpen(true);
    setEligiblePreview(null);
    eligibleSkippedRef.current = [];
    eligiblePreviewAtRef.current = 0;
    setBatchScope('stale');
    await fetchEligiblePreview({ resetScope: true });
  }, [fetchEligiblePreview]);

  const handleRefreshEligiblePreview = useCallback(async () => {
    await fetchEligiblePreview({ resetScope: false });
  }, [fetchEligiblePreview]);

  const handleBatchRefresh = useCallback(async (opts = {}) => {
    // Λίστα συγκεκριμένων υποέργων για «Επανάληψη» (failed/κλειδωμένα) — παρακάμπτει
    // τον εντοπισμό επιλεξιμότητας και το φιλτράρισμα εμβέλειας.
    const retryItems = Array.isArray(opts.retryItems) ? opts.retryItems : null;
    const scope = batchScope;
    setConfirmOpen(false);
    setRunning(true);
    setLogEntries([]);
    setShowLog(false);
    cancelRef.current = false;
    setCancelRequested(false);
    setProgress({ current: 0, total: 0, label: 'Εντοπισμός υποέργων…' });

    try {
      let eligible;
      const skippedItems = [];

      if (retryItems) {
        eligible = retryItems
          .filter((it) => it && it.id)
          .map((it) => ({ id: it.id, label: it.label || it.id }));
      } else {
        // Επαναχρησιμοποίηση preview αν είναι φρέσκο (< 2 λεπτά)· αλλιώς ξανασάρωση (#4)
        const previewAgeMs = eligiblePreviewAtRef.current
          ? Date.now() - eligiblePreviewAtRef.current
          : Infinity;
        const previewIsFresh = Array.isArray(eligiblePreview)
          && eligiblePreviewAtRef.current > 0
          && previewAgeMs <= ELIGIBLE_PREVIEW_MAX_AGE_MS;

        let allEligible = previewIsFresh ? eligiblePreview : null;
        let skipped = previewIsFresh ? eligibleSkippedRef.current : null;
        if (!allEligible) {
          const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
            actingUsername: currentUser?.username,
          });
          if (!eligRes?.success) {
            showToast(eligRes?.error || 'Σφάλμα', 'error');
            setRunning(false);
            return;
          }
          allEligible = eligRes.eligible || [];
          skipped = eligRes.skipped || [];
          eligibleSkippedRef.current = skipped;
          eligiblePreviewAtRef.current = Date.now();
        }

        skippedItems.push(...(skipped || []).map((s) => ({
          status: 'skipped',
          id: s.id,
          label: s.label,
          reason: s.reason || 'Παραλείφθηκε',
        })));

        eligible = allEligible || [];
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

        // Κλείδωμα του υποέργου για ΟΛΗ τη διάρκεια ανάγνωσης→αποθήκευσης, ώστε να μην
        // «πατηθούν» αλλαγές που κάνει ταυτόχρονα άλλος χρήστης σε άλλον υπολογιστή.
        let lockAcquired = false;
        try {
          let lockRes = null;
          try {
            lockRes = await ipcRenderer.invoke('create-entity-lock', 'projects', item.id, currentUser?.username || '');
          } catch {
            lockRes = { success: false };
          }
          if (!lockRes?.success) {
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: lockRes?.lockedBy
                ? `Το υποέργο επεξεργάζεται από ${lockRes.lockedBy}`
                : 'Το υποέργο είναι κλειδωμένο',
              phase: 'lock',
            });
            addLog('🔒', `${item.label} — Κλειδωμένο`);
            continue;
          }
          lockAcquired = true;

          const res = await ipcRenderer.invoke('preview-subproject-khmdhs-refresh', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
            batchMode: true,
          });
          if (res?.aborted || cancelRef.current) {
            addLog('⛔', 'Η διαδικασία ακυρώθηκε');
            break;
          }
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

          if (res.stitchPlanFormMismatch) {
            addLog(
              '⚠️',
              `${item.label} — Η τεχνητή αλυσίδα αγνοήθηκε (άλλαξε μορφή υλοποίησης)· ανανέωση με έναν κωδικό`
            );
          }

          const stitchCompleteness = evaluateStitchRefreshCompleteness(res);
          if (!stitchCompleteness.ok) {
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: stitchCompleteness.message,
              phase: 'preview',
              failedAdams: stitchCompleteness.failedAdams,
            });
            addLog('❌', `${item.label} — Μερική αποτυχία τεχνητής αλυσίδας`);
            continue;
          }

          const project = res.projectSnapshot;
          const existingPlan = project?.khmdhsSymvChainPlan;
          const reusablePlan = existingPlan?.items?.length
            && symvPlanMatchesChain(existingPlan, res.chainRes)
            ? existingPlan : null;

          // Τεχνητή αλυσίδα / ανανέωση σε επίπεδο υποέργου: πάντα stitch (όχι replace στη γραμμή 0).
          const registryChainResList = [];
          let applyResult;
          if (res.usesStitchPlan && Array.isArray(res.stitchResults) && res.stitchResults.length) {
            applyResult = applyStitchRefreshResults(project, res.stitchResults, {
              fallbackChainRes: res.chainRes,
              fallbackSeedAdam: res.seedAdam,
              symvChainPlan: reusablePlan,
            });
            res.stitchResults.forEach((seg) => {
              if (seg?.success && seg.chainRes) registryChainResList.push(seg.chainRes);
            });
          } else {
            applyResult = applyAdamChainResult(project, res.chainRes, {
              seedAdam: res.seedAdam,
              symvChainPlan: reusablePlan,
              applyMode: 'stitch',
            });
            registryChainResList.push(res.chainRes);
          }

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
            ...(res.stitchPlanFormMismatch ? { khmdhsChainStitchPlan: null } : {}),
          };

          let chainRegistryCandidates = [];
          (registryChainResList.length ? registryChainResList : [res.chainRes]).forEach((cr) => {
            chainRegistryCandidates = mergeRegistryCandidateLists(
              chainRegistryCandidates,
              collectKhmdhsRegistryCandidatesFromChainRes(cr, mergedProject.khmdhsDataQualityReview, mergedProject)
            );
          });
          const freshCandidates = filterRegistryCandidatesBySymvPlan(
            mergeRegistryCandidateLists(
              chainRegistryCandidates,
              collectKhmdhsRegistryCandidatesFromProject(mergedProject)
            ),
            mergedProject
          );
          if (freshCandidates.length) {
            const resyncedRegistry = resyncRegistryEntryTitles(
              mergedProject.khmdhsDocumentRegistry || [],
              freshCandidates
            );
            const newCandidates = freshCandidates.filter(
              (c) => !c.isStub && !registryEntryIsAlreadyRecorded(c, resyncedRegistry)
            );
            mergedProject.khmdhsDocumentRegistry = newCandidates.length
              ? mergeKhmdhsDocumentRegistry(resyncedRegistry, newCandidates, new Date().toISOString())
              : resyncedRegistry;
          }

          await ipcRenderer.invoke('create-khmdhs-refresh-snapshot', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          const saveRes = await ipcRenderer.invoke('save-project-data', mergedProject);
          if (saveRes?.success) {
            refreshed++;
            const report = buildKhmdhsRefreshChangeReport(project, mergedProject, applyResult, {
              chainWarnings: (registryChainResList.length ? registryChainResList : [res.chainRes])
                .flatMap((cr) => cr?.warnings || []),
            });
            detailItems.push({
              status: 'refreshed',
              id: item.id,
              label: item.label,
              seedAdam: res.seedAdam,
              changeLines: report.lines,
              appliedLines: report.appliedLines,
              attentionLines: report.attentionLines,
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
              ? `${item.label} — ${summarizeAppliedChanges(report.appliedLines)}`
              : report.category === 'attention'
                ? `${item.label} — Ελέγχθηκε — χρειάζεται προσοχή`
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
        } finally {
          if (lockAcquired) {
            try {
              await ipcRenderer.invoke('remove-entity-lock', 'projects', item.id);
            } catch { /* ignore */ }
          }
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

      const lockedCount = detailItems.filter((d) => d.status === 'failed' && d.phase === 'lock').length;
      const realFailed = Math.max(0, failed - lockedCount);

      if (cancelRef.current) {
        showToast(
          `Η μαζική ανανέωση ακυρώθηκε. Ολοκληρώθηκαν ${refreshed} από ${total}` +
          (needsIntervention ? `, ${needsIntervention} χρειάζονται χαρακτηρισμό` : '') +
          (realFailed ? `, ${realFailed} απέτυχαν` : '') +
          (lockedCount ? `, ${lockedCount} για αργότερα` : ''),
          'info'
        );
      } else {
        showToast(
          `Μαζική ανανέωση ολοκληρώθηκε: ${refreshed} ενημερώθηκαν` +
          (needsIntervention ? `, ${needsIntervention} χρειάζονται χαρακτηρισμό` : '') +
          (realFailed ? `, ${realFailed} απέτυχαν` : '') +
          (lockedCount ? `, ${lockedCount} για αργότερα (ήταν σε χρήση)` : ''),
          (needsIntervention || realFailed) ? 'warning' : 'success'
        );
      }
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
      setCancelRequested(false);
      setRunning(false);
    }
  }, [batchScope, currentUser, showToast, onRefreshComplete, onBatchResults, addLog, eligiblePreview]);

  const handleCancelBatch = useCallback(() => {
    if (cancelRequested) return;
    cancelRef.current = true;
    setCancelRequested(true);
    addLog('⛔', 'Ακύρωση σε εξέλιξη… διακοπή σύνδεσης με ΚΗΜΔΗΣ');
    if (ipcRenderer?.invoke) {
      ipcRenderer.invoke('cancel-khmdhs-batch-refresh', {
        actingUsername: currentUser?.username,
      }).catch(() => {});
    }
  }, [cancelRequested, currentUser, addLog]);

  const lastRetryTokenRef = useRef(null);
  useEffect(() => {
    if (!retrySignal || !retrySignal.token) return;
    if (lastRetryTokenRef.current === retrySignal.token) return;
    lastRetryTokenRef.current = retrySignal.token;
    const items = Array.isArray(retrySignal.items) ? retrySignal.items : [];
    if (!items.length || running) return;
    void handleBatchRefresh({ retryItems: items });
  }, [retrySignal, running, handleBatchRefresh]);

  if (!canUse) return null;

  return (
    <>
      <Container>
        <Header>
          <HeaderLeft>
            <IconChip>{running ? <FabSpinner>⟳</FabSpinner> : '🔄'}</IconChip>
            <TitleGroup>
              <Title>
                Μαζική ανανέωση ΚΗΜΔΗΣ
                {!running && staleCount > 0 && (
                  <StaleBadge>
                    🟡 {staleCount} για ανανέωση
                    {oldestDays ? ` · έως ${oldestDays} ημ.` : ''}
                  </StaleBadge>
                )}
              </Title>
              <Subtitle>
                {running
                  ? 'Ανανέωση σε εξέλιξη — ενημερώνουμε τα υποέργα από το ΚΗΜΔΗΣ…'
                  : staleCount > 0
                    ? 'Ελέγχει το ΚΗΜΔΗΣ και ενημερώνει αυτόματα τα υποέργα σας.'
                    : 'Όλα ενημερωμένα — τρέξτε έλεγχο όποτε θέλετε.'}
              </Subtitle>
            </TitleGroup>
          </HeaderLeft>
          {!running && (
            <Btn onClick={handleConfirmStart}>Εκτέλεση</Btn>
          )}
          {running && (
            <CancelBtn
              type="button"
              onClick={handleCancelBatch}
              disabled={cancelRequested}
            >
              {cancelRequested ? 'Ακύρωση…' : 'Ακύρωση'}
            </CancelBtn>
          )}
        </Header>

        {lastRunInfo && !running && (
          <MetaLine>
            <span>🕓 Τελευταία εκτέλεση: {lastRunInfo.date} — {lastRunInfo.refreshed} ενημερώθηκαν</span>
            {hasReport && typeof onOpenReport === 'function' && (
              <ReportLinkBtn type="button" onClick={onOpenReport}>
                📋 Δείτε αναφορά
              </ReportLinkBtn>
            )}
          </MetaLine>
        )}

        {running && (
          <RunPanel>
            <ProgressHead>
              <ProgressPct>
                {progress.total ? Math.round((progress.current / progress.total) * 100) : 0}%
              </ProgressPct>
              {progress.total > 0 && (
                <ProgressCount>{progress.current} / {progress.total} υποέργα</ProgressCount>
              )}
            </ProgressHead>
            <ProgressBar>
              <ProgressFill $pct={progress.total ? Math.round((progress.current / progress.total) * 100) : 0} />
            </ProgressBar>
            <StatusText>{progress.label}</StatusText>
            {logEntries.length > 0 && (
              <>
                <LogToggle type="button" onClick={() => setShowLog((v) => !v)}>
                  <LogChevron $open={showLog}>▶</LogChevron>
                  {showLog ? 'Απόκρυψη λεπτομερειών' : 'Προβολή λεπτομερειών ροής'}
                </LogToggle>
                {showLog && (
                  <LogBox ref={logRef}>
                    {logEntries.slice(-8).map((entry) => (
                      <LogEntry key={entry.ts}>{entry.icon} {entry.text}</LogEntry>
                    ))}
                  </LogBox>
                )}
              </>
            )}
          </RunPanel>
        )}
      </Container>

      {confirmOpen && (
        <ConfirmOverlay onClick={() => setConfirmOpen(false)}>
          <ConfirmBox onClick={(e) => e.stopPropagation()}>
            <ConfirmTitle>🔄 Εκκίνηση μαζικής ανανέωσης ΚΗΜΔΗΣ</ConfirmTitle>
            <ConfirmDesc>
              {eligibleLoading && eligiblePreview == null
                ? 'Γίνεται εντοπισμός υποέργων…'
                : eligiblePreview != null
                  ? `Βρέθηκαν ${allPreviewCount} επιλέξιμα υποέργα. Επιλέξτε ποια θα ανανεωθούν.`
                  : 'Δεν ήταν δυνατός ο εντοπισμός. Δοκιμάστε «Ανανέωση λίστας».'}
            </ConfirmDesc>

            {eligiblePreview != null && (
              <ScopeOptions>
                <ScopeOption $active={batchScope === 'stale'}>
                  <ScopeRadio
                    type="radio"
                    name="khmdhs-batch-scope"
                    checked={batchScope === 'stale'}
                    onChange={() => setBatchScope('stale')}
                    disabled={eligibleLoading}
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
                    disabled={eligibleLoading}
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
              Αν μείνει ανοιχτό το παράθυρο πάνω από 2 λεπτά, η λίστα ανανεώνεται αυτόματα πριν την εκκίνηση.
            </ConfirmDesc>

            <ConfirmActions>
              <ConfirmCancel type="button" onClick={() => setConfirmOpen(false)}>Ακύρωση</ConfirmCancel>
              <ConfirmRefresh
                type="button"
                onClick={handleRefreshEligiblePreview}
                disabled={eligibleLoading}
              >
                {eligibleLoading ? 'Ανανέωση…' : 'Ανανέωση λίστας'}
              </ConfirmRefresh>
              <ConfirmProceed
                onClick={handleBatchRefresh}
                disabled={eligibleLoading || eligiblePreview == null || !selectedCount}
              >
                {eligibleLoading && eligiblePreview == null
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
