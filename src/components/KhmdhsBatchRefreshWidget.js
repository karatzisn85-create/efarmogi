import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { useToast } from './ToastProvider';
import { applyAdamChainResult, applyStitchRefreshResults } from '../utils/khmdhsChainApply';
import {
  resolveReusablePlanForKhmdhsRefresh,
  resolvePlanChainResForKhmdhsRefresh,
} from '../utils/khmdhsSymvChainPlanner';
import {
  buildKhmdhsRefreshChangeReport,
  KHMDHS_REFRESH_REPORT_NO_CHANGES,
} from '../utils/khmdhsChainRefresh';
import khmdhsRefresh from '../../app/core/khmdhsRefresh';
import {
  applyAutoDocumentRegistryFromChain,
} from '../utils/khmdhsDocumentRegistry';
import { summarizeKhmdhsFetchFailure } from '../utils/khmdhsFetchFailureSummary';
import { evaluateStitchRefreshCompleteness } from '../utils/khmdhsChainStitchPlan';
import { getUnresolvedReviewItems } from '../utils/khmdhsDataQualityReport';
import {
  buildKhmdhsRefreshFindings,
  buildKhmdhsFindingAction,
  KHMDHS_FINDING_ACTION,
  KHMDHS_FINDING_OUTCOME,
} from '../utils/khmdhsRefreshFindings';
import {
  KHMDHS_RETRY_ITEM_GAP_MS,
  KHMDHS_RETRY_MAX_ROUNDS,
  nextKhmdhsRetryDelayMs,
  pickKhmdhsBatchRetryCandidates,
} from '../utils/khmdhsBatchReportState';

async function waitKhmdhsRetryPause(ms, cancelRef, onTick) {
  const deadline = Date.now() + Math.max(0, Number(ms) || 0);
  while (Date.now() < deadline) {
    if (cancelRef?.current) return false;
    const remainingSec = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
    if (typeof onTick === 'function') onTick(remainingSec);
    const slice = Math.min(250, deadline - Date.now());
    if (slice <= 0) break;
    await new Promise((r) => setTimeout(r, slice));
  }
  return !cancelRef?.current;
}

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
  background: ${(p) => (p.$embedded
    ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
    : `radial-gradient(120% 140% at 0% 0%, rgba(20, 184, 166, 0.10) 0%, transparent 45%),
       linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)`)};
  border: ${(p) => (p.$embedded ? 'none' : '1px solid #99f6e4')};
  border-radius: ${(p) => (p.$embedded ? '0' : (p.$compact ? '14px' : '16px'))};
  padding: ${(p) => (p.$compact ? '0.7rem 0.95rem 0.75rem' : '1.05rem 1.25rem 1.1rem')};
  margin-bottom: ${(p) => (p.$compact || p.$embedded ? '0' : '1rem')};
  height: auto;
  min-height: ${(p) => (p.$compact || p.$embedded ? '100%' : '0')};
  box-shadow: ${(p) => (p.$embedded
    ? 'none'
    : '0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px rgba(13, 148, 136, 0.06)')};
  overflow: hidden;
  color: inherit;

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
  width: ${(p) => (p.$compact ? '32px' : '38px')};
  height: ${(p) => (p.$compact ? '32px' : '38px')};
  border-radius: ${(p) => (p.$compact ? '9px' : '11px')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => (p.$compact ? '0.95rem' : '1.1rem')};
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #14b8a6 60%, #2dd4bf);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.32);
  border: none;
`;

const TitleGroup = styled.div`
  min-width: 0;
`;

const Title = styled.h4`
  margin: 0;
  font-size: ${(p) => (p.$compact ? '0.88rem' : '0.98rem')};
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
  font-size: ${(p) => (p.$compact ? '0.68rem' : '0.72rem')};
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
  margin-top: ${(p) => (p.$compact ? '0.45rem' : '0.75rem')};
  padding-top: ${(p) => (p.$compact ? '0.4rem' : '0.65rem')};
  border-top: 1px dashed #cbfbef;
  font-size: ${(p) => (p.$compact ? '0.66rem' : '0.7rem')};
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  flex-shrink: 0;
  padding: ${(p) => (p.$compact ? '0.42rem 1rem' : '0.55rem 1.35rem')};
  border-radius: ${(p) => (p.$compact ? '10px' : '11px')};
  border: none;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.32);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13, 148, 136, 0.4); }
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
  margin-top: 0.65rem;
  padding: 0.55rem 0.65rem 0.6rem;
  border-radius: 12px;
  background: linear-gradient(180deg, #f0fdfa 0%, #f8fafc 100%);
  border: 1px solid rgba(13, 148, 136, 0.18);
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
  /* Χωρίς backdrop-filter: στο Electron το blur + κινούμενα στοιχεία πίσω
     προκαλεί συνεχές τρεμόσβημα στα πλαίσια της οθόνης. */
  background: rgba(15, 23, 42, 0.52);
  z-index: 11500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
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

/**
 * «Παλαιό» = ό,τι δείχνει και το κίτρινο badge φρεσκάδας στην κάρτα, ώστε ο αριθμός
 * «Ν για ανανέωση» να αντιστοιχεί σε αυτό που βλέπει ο χρήστης στη λίστα υποέργων.
 */
const STALE_BATCH_DAYS = khmdhsRefresh.KHMDHS_STALE_DAYS;
/** Αν ο διάλογος μείνει ανοιχτός περισσότερο, ξανασαρώνουμε πριν την εκτέλεση (#4). */
const ELIGIBLE_PREVIEW_MAX_AGE_MS = 2 * 60 * 1000;

function isEligibleStale(item, maxAgeDays = STALE_BATCH_DAYS) {
  return khmdhsRefresh.isBatchItemStale(item, maxAgeDays);
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
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
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

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  flex-wrap: wrap;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const FooterHint = styled.div`
  flex: 1;
  min-width: 180px;
  font-size: 0.66rem;
  line-height: 1.45;
  color: #64748b;
`;

const DismissBtn = styled.button`
  flex-shrink: 0;
  padding: 0.45rem 1rem;
  border-radius: 9px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f1f5f9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0;
  margin-top: 0.85rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 750;
  letter-spacing: -0.01em;
  color: ${(p) => p.$color || '#334155'};
  &:hover { opacity: 0.8; }
`;

const SectionChevron = styled.span`
  transition: transform 0.2s;
  font-size: 0.7rem;
  color: #94a3b8;
  ${(p) => p.$open && 'transform: rotate(90deg);'}
`;

const InterventionItem = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.75rem 0.95rem;
  margin-bottom: 5px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  color: #78350f;
  font-size: 0.84rem;
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
  width: 0.45rem;
  height: 0.45rem;
  margin-top: 0.45rem;
  border-radius: 50%;
  background: #d97706;
`;

const InterventionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const InterventionTitle = styled.div`
  font-weight: 750;
  font-size: 0.88rem;
  line-height: 1.35;
`;

const InterventionSubtitle = styled.div`
  font-size: 0.76rem;
  font-weight: 500;
  color: #a16207;
  margin-top: 3px;
  line-height: 1.45;
`;

const SkippedList = styled.div`
  padding: 0.4rem 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.55;
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
  font-size: 0.82rem;
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
  padding: 0.75rem 0.9rem;
  border: none;
  background: transparent;
  cursor: pointer;
  &:hover { background: rgba(15, 23, 42, 0.03); }
`;

const DetailCardTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 750;
  color: #1e293b;
  line-height: 1.4;
`;

const DetailCardMeta = styled.div`
  font-size: 0.76rem;
  font-weight: 500;
  color: #64748b;
  margin-top: 3px;
  line-height: 1.45;
`;

const DetailCardBody = styled.div`
  padding: 0 0.9rem 0.8rem 1.15rem;
  border-top: 1px dashed #e2e8f0;
`;

const ChangeLine = styled.div`
  font-size: 0.84rem;
  color: #334155;
  line-height: 1.55;
  padding: 0.28rem 0;
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
  &::before { content: '·'; color: #d97706; }
`;

const ActionLine = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin-top: 0.3rem;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #7c2d12;

  strong { display: block; font-weight: 800; }
  span:last-child { font-weight: 500; color: #9a3412; }
`;

const ChangeGroupLabel = styled.div`
  font-size: 0.74rem;
  font-weight: 800;
  color: #0f766e;
  margin: 0.5rem 0 0.25rem;
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
  margin-top: 0.45rem;
  padding: 0;
  border: none;
  background: none;
  color: #0d9488;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  &:hover { color: #0f766e; }
`;

/* ── Summary-first hero: αφήγηση με μεγάλα νούμερα ── */
const ReportHero = styled.div`
  position: relative;
  border-radius: 16px;
  padding: 1.15rem 1.25rem 1.05rem;
  margin-bottom: 0.85rem;
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

const HeroVerdict = styled.div`
  position: relative;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
`;

const HeroSub = styled.div`
  position: relative;
  margin-top: 0.3rem;
  font-size: 0.8rem;
  font-weight: 500;
  opacity: 0.92;
  line-height: 1.5;
`;

const HeroStatGrid = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.95rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const HeroStatCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  padding: 0.7rem 0.75rem 0.65rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(6px);
`;

const HeroStatNumber = styled.div`
  font-size: 1.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
`;

const HeroStatLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 650;
  opacity: 0.92;
  line-height: 1.3;
`;

const HeroStatHint = styled.div`
  font-size: 0.66rem;
  font-weight: 500;
  opacity: 0.78;
  line-height: 1.3;
  margin-top: 0.1rem;
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
  font-size: 0.78rem;
  color: #0f766e;
  font-weight: 600;
  line-height: 1.45;
`;

const RetryButton = styled.button`
  flex-shrink: 0;
  padding: 0.5rem 1.1rem;
  border-radius: 10px;
  border: none;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  background: ${(p) => (p.$tone === 'stop'
    ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
    : 'linear-gradient(135deg, #0d9488, #14b8a6)')};
  box-shadow: ${(p) => (p.$tone === 'stop'
    ? '0 3px 10px rgba(185, 28, 28, 0.28)'
    : '0 3px 10px rgba(13, 148, 136, 0.3)')};
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: ${(p) => (p.$tone === 'stop'
      ? '0 5px 16px rgba(185, 28, 28, 0.38)'
      : '0 5px 16px rgba(13, 148, 136, 0.4)')};
  }
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
                      {appliedSplit.registry.length} νέ
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

          {item.actions?.length > 0 && (
            <>
              <ChangeGroupLabel style={{ color: '#9a3412' }}>
                Σας περιμένουν μέσα στο υποέργο
              </ChangeGroupLabel>
              {item.actions.map((action) => (
                <ActionLine key={action.id}>
                  <div>
                    <strong>{action.title}</strong>
                    {action.detail && <span>{action.detail}</span>}
                  </div>
                </ActionLine>
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
  onCancelRetry,
  retryLive = null,
  onDismiss,
}) {
  const [openSections, setOpenSections] = useState({
    intervened: true,
    failed: true,
    later: true,
    attention: true,
    refreshed: false,
    unchanged: false,
    skipped: false,
  });
  const [openItems, setOpenItems] = useState({});

  if (!isOpen || !results) return null;

  const items = Array.isArray(results.items) ? results.items : [];
  const refreshedItems = items.filter((i) => i.status === 'refreshed' && i.category === 'applied');
  const unchangedItems = items.filter((i) => i.status === 'refreshed' && (i.category === 'unchanged' || (!i.category && !i.hasSubstantiveChanges)));
  // Τα πιασμένα δεν είναι «αποτυχία» — απλώς τα δούλευε κάποιος τη στιγμή εκείνη.
  // Ούτε όσα δεν προλάβαμε λόγω ακύρωσης· και τα δύο ξαναδοκιμάζονται με την «Επανάληψη».
  const failedItems = items.filter((i) => i.status === 'failed');
  const laterItems = items.filter((i) => i.busy || i.notProcessed);
  const skippedItems = items.filter((i) => i.status === 'skipped' && !i.busy && !i.notProcessed);
  const intervenedFromItems = items.filter((i) => i.status === 'intervened');
  // Άδειο pendingItems σημαίνει «μηδέν εκκρεμή» — όχι «αγνόησε και δείξε όλα τα intervened».
  const interventionList = Array.isArray(pendingItems)
    ? pendingItems
    : intervenedFromItems;

  const resolvedInterventionCount = items.filter((i) => i.status === 'resolved').length;
  const allResolved = Array.isArray(pendingItems)
    && pendingItems.length === 0
    && resolvedInterventionCount > 0
    && intervenedFromItems.length === 0;

  // Υποψήφια για «Επανάληψη»: πραγματικές αποτυχίες + κλειδωμένα (ό,τι δεν ολοκληρώθηκε).
  const retryCandidates = [...failedItems, ...laterItems]
    .filter((i) => i.id)
    .map((i) => ({ id: i.id, label: i.label }));

  // Προσοχή ή ενέργεια μέσα στο υποέργο — ανοιχτή ενότητα στην αφήγηση.
  // Όσα επιλύθηκαν μετά την αποθήκευση (followUpClearedAt) δεν εμφανίζονται ξανά.
  const followUpItems = items.filter((i) => (
    i.status === 'refreshed'
    && !i.followUpClearedAt
    && (i.category === 'attention' || (i.actions?.length || 0) > 0)
  ));
  const followUpIds = new Set(followUpItems.map((i) => i.id));
  const refreshedOnly = refreshedItems.filter((i) => !followUpIds.has(i.id));
  const unchangedOnly = unchangedItems.filter((i) => !followUpIds.has(i.id));

  // «Έγιναν καλά» = μόνο όσα δεν έχουν εκκρεμή ενέργεια (χωρίς διπλομέτρηση με follow-up).
  const okCount = refreshedOnly.length + unchangedOnly.length;
  const needsActionCount = interventionList.length + followUpItems.length;
  const heroTone = failedItems.length > 0
    ? 'error'
    : needsActionCount > 0
      ? 'attention'
      : 'ok';
  const heroVerdict = heroTone === 'error'
    ? 'Ολοκληρώθηκε — χρειάζεται μια ματιά'
    : heroTone === 'attention'
      ? 'Σχεδόν έτοιμο — μένουν λίγες ενέργειες'
      : 'Όλα ενημερωμένα';
  const heroParts = [];
  if (needsActionCount) heroParts.push(`${needsActionCount} ζητούν ενέργεια`);
  if (failedItems.length) heroParts.push(`${failedItems.length} απέτυχαν`);
  if (laterItems.length) heroParts.push(`${laterItems.length} για αργότερα`);
  if (okCount) heroParts.push(`${okCount} ολοκληρώθηκαν χωρίς εκκρεμότητα`);
  if (skippedItems.length) heroParts.push(`${skippedItems.length} εκτός ελέγχου`);
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
    if (retryLive?.active) return;
    if (typeof onRetry === 'function' && retryCandidates.length) {
      onRetry(retryCandidates);
    }
  };

  const retrying = !!retryLive?.active;

  return createPortal(
    <ModalOverlay onClick={retrying ? undefined : onClose}>
      <ModalBox onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Αναφορά μαζικής ανανέωσης ΚΗΜΔΗΣ</ModalTitle>
          <ModalCloseBtn onClick={onClose}>✕</ModalCloseBtn>
        </ModalHeader>
        <ModalBody>
          <ReportHero $tone={heroTone}>
            <HeroGlow />
            <HeroVerdict>{heroVerdict}</HeroVerdict>
            <HeroSub>{heroSub}</HeroSub>
            <HeroStatGrid>
              <HeroStatCard>
                <HeroStatNumber>{needsActionCount}</HeroStatNumber>
                <HeroStatLabel>Χρειάζονται ενέργεια</HeroStatLabel>
              </HeroStatCard>
              <HeroStatCard>
                <HeroStatNumber>{failedItems.length}</HeroStatNumber>
                <HeroStatLabel>Απέτυχαν</HeroStatLabel>
                {laterItems.length > 0 && (
                  <HeroStatHint>+ {laterItems.length} για αργότερα</HeroStatHint>
                )}
              </HeroStatCard>
              <HeroStatCard>
                <HeroStatNumber>{okCount}</HeroStatNumber>
                <HeroStatLabel>Έγιναν καλά</HeroStatLabel>
              </HeroStatCard>
            </HeroStatGrid>
          </ReportHero>

          {retrying && (
            <RetryBar>
              <RetryText>
                {retryLive.phase === 'wait'
                  ? `Το ΚΗΜΔΗΣ είναι φορτωμένο. Νέα προσπάθεια σε ${retryLive.countdownSec}″ — απομένουν ${retryLive.remaining}.`
                  : `Ξανατρέχουμε μόνο όσα δεν ολοκληρώθηκαν`
                    + (retryLive.total
                      ? ` (${retryLive.current || 0} από ${retryLive.total})`
                      : '')
                    + (retryLive.label ? ` — ${retryLive.label}` : '')
                    + '.'}
                {retryLive.maxRounds > 1
                  ? ` Προσπάθεια ${retryLive.round || 1} από ${retryLive.maxRounds}.`
                  : ''}
                {' '}Η αναφορά ενημερώνεται μετά από κάθε πέρασμα.
              </RetryText>
              {typeof onCancelRetry === 'function' && (
                <RetryButton type="button" onClick={onCancelRetry} $tone="stop">
                  Διακοπή
                </RetryButton>
              )}
            </RetryBar>
          )}

          {!retrying && typeof onRetry === 'function' && retryCandidates.length > 0 && (
            <RetryBar>
              <RetryText>
                {failedItems.length > 0 && laterItems.length > 0
                  ? `${failedItems.length} απέτυχαν και ${laterItems.length} έμειναν για αργότερα.`
                  : failedItems.length > 0
                    ? `${failedItems.length} υποέργα δεν ολοκληρώθηκαν.`
                    : `${laterItems.length} υποέργα δεν προλάβαμε να τα δούμε.`}
                {' '}Θα ξανατρέξουμε μόνο αυτά και η αναφορά θα ενημερώνεται μέχρι να μην μείνουν αποτυχίες
                (με μικρές παύσεις, γιατί το ΚΗΜΔΗΣ συχνά είναι φορτωμένο).
              </RetryText>
              <RetryButton type="button" onClick={handleRetry}>
                Επανάληψη ({retryCandidates.length})
              </RetryButton>
            </RetryBar>
          )}

          {interventionList.length > 0 && (
            <>
              <SectionHeader $color="#92400e" onClick={() => toggleSection('intervened')}>
                <SectionChevron $open={openSections.intervened}>▶</SectionChevron>
                Χρειάζονται χαρακτηρισμό ({interventionList.length})
              </SectionHeader>
              {openSections.intervened && interventionList.map((item) => (
                <InterventionItem
                  key={item.id}
                  onClick={() => goTo(item.id)}
                >
                  <InterventionIcon aria-hidden />
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
                Απέτυχαν ({failedItems.length})
              </SectionHeader>
              {openSections.failed && failedItems.map((item) => (
                <ReportItemCard
                  key={`fail-${item.id}`}
                  item={item}
                  open={isItemOpen(`fail-${item.id}`, true)}
                  onToggle={() => toggleItem(`fail-${item.id}`, true)}
                  border="#fca5a5"
                  bg="#fef2f2"
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
                Για αργότερα ({laterItems.length})
              </SectionHeader>
              {openSections.later && (
                <>
                  <SkippedList style={{ marginBottom: '0.4rem' }}>
                    Τα υποέργα αυτά έμειναν ανέγγιχτα — είτε τα δούλευε κάποιος εκείνη τη στιγμή,
                    είτε δεν προλάβαμε να φτάσουμε σε αυτά. Ξαναδοκιμάστε τα με την «Επανάληψη».
                  </SkippedList>
                  {laterItems.map((item) => (
                    <ReportItemCard
                      key={`later-${item.id}`}
                      item={item}
                      open={!!openItems[`later-${item.id}`]}
                      onToggle={() => toggleItem(`later-${item.id}`)}
                      border="#cbd5e1"
                      bg="#f1f5f9"
                      meta={item.reason || item.error || 'Έμεινε για αργότερα'}
                      onNavigate={goTo}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {followUpItems.length > 0 && (
            <>
              <SectionHeader $color="#9a3412" onClick={() => toggleSection('attention')}>
                <SectionChevron $open={openSections.attention}>▶</SectionChevron>
                Χρειάζονται προσοχή ή ενέργεια στο υποέργο ({followUpItems.length})
              </SectionHeader>
              {openSections.attention && followUpItems.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={isItemOpen(item.id, true)}
                  onToggle={() => toggleItem(item.id, true)}
                  border="#fed7aa"
                  bg="#fff7ed"
                  meta={item.category === 'attention'
                    ? 'Ελέγχθηκε — υπάρχουν σημεία προς προσοχή ή χειροκίνητες τιμές που διατηρήθηκαν.'
                    : 'Ενημερώθηκε — μένουν ενέργειες μέσα στην επεξεργασία του υποέργου.'}
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {refreshedOnly.length > 0 && (
            <>
              <SectionHeader $color="#065f46" onClick={() => toggleSection('refreshed')}>
                <SectionChevron $open={openSections.refreshed}>▶</SectionChevron>
                Ενημερώθηκαν με αλλαγές ({refreshedOnly.length})
              </SectionHeader>
              {openSections.refreshed && refreshedOnly.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={isItemOpen(item.id, false)}
                  onToggle={() => toggleItem(item.id, false)}
                  border="#6ee7b7"
                  bg="#f0fdf4"
                  meta={summarizeAppliedChanges(item.appliedLines?.length ? item.appliedLines : item.changeLines)}
                  onNavigate={goTo}
                  defaultShowAllRegistry
                />
              ))}
            </>
          )}

          {unchangedOnly.length > 0 && (
            <>
              <SectionHeader $color="#64748b" onClick={() => toggleSection('unchanged')}>
                <SectionChevron $open={openSections.unchanged}>▶</SectionChevron>
                Χωρίς ουσιώδεις διαφορές ({unchangedOnly.length})
              </SectionHeader>
              {openSections.unchanged && unchangedOnly.map((item) => (
                <ReportItemCard
                  key={item.id}
                  item={item}
                  open={!!openItems[item.id]}
                  onToggle={() => toggleItem(item.id)}
                  border="#e2e8f0"
                  bg="#f8fafc"
                  meta="Ελέγχθηκε στο ΚΗΜΔΗΣ — τα δεδομένα ήταν ήδη ενημερωμένα"
                  onNavigate={goTo}
                />
              ))}
            </>
          )}

          {skippedItems.length > 0 && (
            <>
              <SectionHeader $color="#64748b" onClick={() => toggleSection('skipped')}>
                <SectionChevron $open={openSections.skipped}>▶</SectionChevron>
                Εκτός ελέγχου ({skippedItems.length})
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
                      meta={item.reason || 'Παραλείφθηκε'}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {allResolved && (
            <AllDoneBanner>
              Όλοι οι χαρακτηρισμοί ολοκληρώθηκαν — η βάση δεδομένων είναι πλήρως ενημερωμένη.
            </AllDoneBanner>
          )}

          {!refreshedOnly.length && !followUpItems.length && !unchangedOnly.length
            && !failedItems.length && !laterItems.length && !interventionList.length && !skippedItems.length && (
            <SkippedList>
              Δεν καταγράφηκαν λεπτομέρειες για αυτή την εκτέλεση.
            </SkippedList>
          )}
        </ModalBody>

        {typeof onDismiss === 'function' && (
          <ModalFooter>
            <FooterHint>
              {interventionList.length > 0
                ? 'Η αναφορά παραμένει διαθέσιμη όσο υπάρχουν εκκρεμείς χαρακτηρισμοί.'
                : 'Τα ευρήματα κάθε υποέργου παραμένουν και μέσα στην επεξεργασία του, μέχρι να τα κλείσετε εκεί.'}
            </FooterHint>
            <DismissBtn
              type="button"
              onClick={onDismiss}
              disabled={retrying || interventionList.length > 0}
              title={retrying
                ? 'Η επανάληψη είναι σε εξέλιξη'
                : interventionList.length > 0
                  ? 'Ολοκληρώστε πρώτα τους εκκρεμείς χαρακτηρισμούς'
                  : 'Απόκρυψη της αναφοράς αυτής της εκτέλεσης'}
            >
              Τα είδα — απόκρυψη αναφοράς
            </DismissBtn>
          </ModalFooter>
        )}
      </ModalBox>
    </ModalOverlay>,
    document.body
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
  onRetryLiveChange,
  onOpenReport,
  staleCount = 0,
  oldestDays = null,
  lastRunInfo = null,
  hasReport = false,
  retrySignal = null,
  cancelSignal = null,
  compact = false,
  embedded = false,
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

  const actingUsername = currentUser?.username || '';

  const fetchEligiblePreview = useCallback(async ({ resetScope = false } = {}) => {
    setEligibleLoading(true);
    try {
      const eligRes = await ipcRenderer.invoke('batch-khmdhs-refresh-eligible', {
        actingUsername,
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
  }, [actingUsername]);

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

  // Όσο ο διάλογος είναι ανοιχτός κρατάμε τη λίστα ζωντανή, ώστε ο αριθμός στο κουμπί
  // εκκίνησης να μη διαφέρει από αυτόν που θα τρέξει τελικά (π.χ. κλειδώματα που άλλαξαν).
  useEffect(() => {
    if (!confirmOpen) return undefined;
    const id = setInterval(() => {
      void fetchEligiblePreview({ resetScope: false });
    }, ELIGIBLE_PREVIEW_MAX_AGE_MS);
    return () => clearInterval(id);
  }, [confirmOpen, fetchEligiblePreview]);

  // Τρέχει ήδη μαζική ανανέωση αλλού; Καλύτερα να το δει ο χρήστης πριν πατήσει «Έναρξη».
  const [otherRun, setOtherRun] = useState(null);
  useEffect(() => {
    if (!confirmOpen) return undefined;
    let cancelled = false;
    const check = () => {
      ipcRenderer.invoke('check-khmdhs-batch-run', { actingUsername: currentUser?.username })
        .then((res) => { if (!cancelled) setOtherRun(res?.running ? res : null); })
        .catch(() => { /* ignore */ });
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [confirmOpen, currentUser?.username]);

  /** Γράφει τα ευρήματα μέσα στο υποέργο, όταν δεν γίνεται κανονική αποθήκευση δεδομένων. */
  const persistItemFindings = useCallback(async (subprojectId, findings) => {
    try {
      await ipcRenderer.invoke('save-khmdhs-refresh-findings', {
        subprojectId,
        actingUsername: currentUser?.username,
        findings,
      });
    } catch { /* τα ευρήματα παραμένουν στην αναφορά εκτέλεσης */ }
  }, [currentUser]);

  const handleBatchRefresh = useCallback(async (opts = {}) => {
    // Λίστα συγκεκριμένων υποέργων για «Επανάληψη» (failed/κλειδωμένα) — παρακάμπτει
    // τον εντοπισμό επιλεξιμότητας και το φιλτράρισμα εμβέλειας.
    const retryItems = Array.isArray(opts.retryItems) ? opts.retryItems : null;
    const scope = batchScope;
    const runId = `batch-${Date.now()}`;
    const runStartedAt = new Date().toISOString();
    setConfirmOpen(false);

    // Μία μαζική ανανέωση τη φορά σε όλο τον δήμο: δύο ταυτόχρονες θα «τσακώνονταν» για τα
    // ίδια υποέργα και θα έδιναν δύο μισές αναφορές.
    let runMarked = false;
    try {
      const startRes = await ipcRenderer.invoke('start-khmdhs-batch-run', {
        actingUsername: currentUser?.username,
      });
      if (!startRes?.success) {
        showToast(
          startRes?.running
            ? `Εκτελείται ήδη μαζική ανανέωση από ${startRes.by}. Περιμένετε να ολοκληρωθεί.`
            : (startRes?.error || 'Δεν ήταν δυνατή η εκκίνηση της μαζικής ανανέωσης.'),
          'warning'
        );
        return;
      }
      runMarked = true;
    } catch { /* χωρίς σήμανση συνεχίζουμε — δεν μπλοκάρουμε τη δουλειά */ }

    setRunning(true);
    setLogEntries([]);
    setShowLog(false);
    cancelRef.current = false;
    setCancelRequested(false);
    setProgress({ current: 0, total: 0, label: 'Εντοπισμός υποέργων…' });

    const heartbeat = window.setInterval(() => {
      ipcRenderer.invoke('start-khmdhs-batch-run', {
        actingUsername: currentUser?.username,
        heartbeat: true,
      }).catch(() => { /* ignore */ });
    }, 20000);

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

      if (!eligible.length) {
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

      const isRetryRun = !!retryItems;
      const maxRounds = isRetryRun ? KHMDHS_RETRY_MAX_ROUNDS : 1;
      const sessionLatest = new Map();
      let queue = eligible;
      let lastToast = null;

      const publishRetryLive = (payload) => {
        if (!isRetryRun || typeof onRetryLiveChange !== 'function') return;
        onRetryLiveChange(payload);
      };

      publishRetryLive({
        active: true,
        phase: 'run',
        round: 1,
        maxRounds,
        current: 0,
        total: queue.length,
        remaining: queue.length,
        label: '',
        countdownSec: null,
      });

      for (let round = 0; round < maxRounds && queue.length && !cancelRef.current; round++) {
        if (round > 0) {
          const delayMs = nextKhmdhsRetryDelayMs(round);
          addLog('⏳', `Παύση ${Math.round(delayMs / 1000)}″ — απομένουν ${queue.length} για νέα προσπάθεια`);
          const ok = await waitKhmdhsRetryPause(delayMs, cancelRef, (sec) => {
            setProgress({
              current: 0,
              total: queue.length,
              label: `Επόμενη προσπάθεια σε ${sec}″ — απομένουν ${queue.length}`,
            });
            publishRetryLive({
              active: true,
              phase: 'wait',
              round: round + 1,
              maxRounds,
              current: 0,
              total: queue.length,
              remaining: queue.length,
              label: '',
              countdownSec: sec,
            });
          });
          if (!ok || cancelRef.current) break;
        }

        eligible = queue;
        const total = eligible.length;

        setProgress({ current: 0, total, label: `0 / ${total}` });
        if (round === 0 && !isRetryRun) {
          addLog(
            '🔍',
            scope === 'stale'
              ? `Θα ανανεωθούν ${total} παλαιά υποέργα (>${STALE_BATCH_DAYS} ημ. ή χωρίς ανανέωση)`
              : `Θα ανανεωθούν όλα τα ${total} επιλέξιμα υποέργα`
          );
        } else if (isRetryRun) {
          addLog(
            '🔁',
            round === 0
              ? `Ξανατρέχουμε μόνο ${total} υποέργα που δεν ολοκληρώθηκαν`
              : `Προσπάθεια ${round + 1} από ${maxRounds} — ${total} υποέργα`
          );
        }

        let refreshed = 0;
        let needsIntervention = 0;
        let failed = 0;
        const interventionItems = [];
        const detailItems = (!isRetryRun && round === 0) ? [...skippedItems] : [];

      for (let i = 0; i < total; i++) {
        if (cancelRef.current) {
          addLog('⛔', 'Η διαδικασία ακυρώθηκε');
          break;
        }
        const item = eligible[i];
        setProgress({ current: i + 1, total, label: `${i + 1} / ${total} — ${item.label}` });
        publishRetryLive({
          active: true,
          phase: 'run',
          round: round + 1,
          maxRounds,
          current: i + 1,
          total,
          remaining: Math.max(0, total - i),
          label: item.label,
          countdownSec: null,
        });
        let unsubItemProgress = () => {};
        if (typeof ipcRenderer?.on === 'function') {
          unsubItemProgress = ipcRenderer.on('khmdhs-refresh-progress', (payload) => {
            if (!payload || payload.subprojectId !== item.id) return;
            if (!payload.message) return;
            setProgress({
              current: i + 1,
              total,
              label: `${i + 1} / ${total} — ${item.label}: ${payload.message}`,
            });
            publishRetryLive({
              active: true,
              phase: 'run',
              round: round + 1,
              maxRounds,
              current: i + 1,
              total,
              remaining: Math.max(0, total - i),
              label: `${item.label}: ${payload.message}`,
              countdownSec: null,
            });
          }) || (() => {});
        }

        // Κλείδωμα του υποέργου για ΟΛΗ τη διάρκεια ανάγνωσης→αποθήκευσης, ώστε να μην
        // «πατηθούν» αλλαγές που κάνει ταυτόχρονα άλλος χρήστης σε άλλον υπολογιστή.
        let lockAcquired = false;
        try {
          let lockRes = null;
          try {
            lockRes = await ipcRenderer.invoke('acquire-khmdhs-refresh-lock', {
              subprojectId: item.id,
              actingUsername: currentUser?.username,
            });
          } catch {
            lockRes = { success: false };
          }
          if (!lockRes?.success) {
            // Δεν είναι αποτυχία: το υποέργο είναι απλώς πιασμένο αυτή τη στιγμή.
            const busyEntry = {
              status: 'skipped',
              busy: true,
              id: item.id,
              label: item.label,
              reason: lockRes?.lockedBy
                ? `Το επεξεργάζεται ο/η ${lockRes.lockedBy} — δοκιμάστε ξανά αργότερα`
                : 'Είναι ανοιχτό αυτή τη στιγμή — δοκιμάστε ξανά αργότερα',
            };
            skippedItems.push(busyEntry);
            detailItems.push(busyEntry);
            addLog('🔒', `${item.label} — Ανοιχτό από άλλον χρήστη`);
            try { unsubItemProgress(); } catch (_) { /* ignore */ }
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
            const failError = res?.error || 'Αποτυχία ανάκτησης από ΚΗΜΔΗΣ';
            failed++;
            detailItems.push({
              status: 'failed',
              id: item.id,
              label: item.label,
              error: failError,
              phase: 'preview',
            });
            await persistItemFindings(item.id, buildKhmdhsRefreshFindings({
              outcome: KHMDHS_FINDING_OUTCOME.FAILED,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              error: failError,
              actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.RETRY_FETCH, {
                detail: `${summarizeKhmdhsFetchFailure(failError)} Δεν αποθηκεύτηκε καμία αλλαγή.`,
              })],
            }));
            addLog('❌', `${item.label} — ${failError}`);
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
            await persistItemFindings(item.id, buildKhmdhsRefreshFindings({
              outcome: KHMDHS_FINDING_OUTCOME.FAILED,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              error: stitchCompleteness.message,
              actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.RETRY_FETCH, {
                detail: stitchCompleteness.message,
              })],
            }));
            addLog('❌', `${item.label} — Μερική αποτυχία τεχνητής αλυσίδας`);
            continue;
          }

          const project = res.projectSnapshot;
          const existingPlan = project?.khmdhsSymvChainPlan;
          const planChainRes = resolvePlanChainResForKhmdhsRefresh(res);
          const reusablePlan = resolveReusablePlanForKhmdhsRefresh(existingPlan, res);

          // Τεχνητή αλυσίδα / ανανέωση σε επίπεδο υποέργου: πάντα stitch (όχι replace στη γραμμή 0).
          const registryChainResList = [];
          let applyResult;
          if (res.usesStitchPlan && Array.isArray(res.stitchResults) && res.stitchResults.length) {
            applyResult = applyStitchRefreshResults(project, res.stitchResults, {
              fallbackChainRes: planChainRes || res.chainRes,
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
            await persistItemFindings(item.id, buildKhmdhsRefreshFindings({
              outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              seedAdam: res.seedAdam,
              actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
            }));
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

          mergedProject.khmdhsDocumentRegistry = applyAutoDocumentRegistryFromChain(
            mergedProject,
            registryChainResList.length ? registryChainResList : [res.chainRes]
          );

          const report = buildKhmdhsRefreshChangeReport(project, mergedProject, applyResult, {
            chainWarnings: (registryChainResList.length ? registryChainResList : [res.chainRes])
              .flatMap((cr) => cr?.warnings || []),
          });

          // Τα βήματα που στη μεμονωμένη ανάκτηση ανοίγουν παράθυρο (έλεγχος στοιχείων, ΑΠΕ)
          // δεν μπορούν να εμφανιστούν μαζικά — καταγράφονται μέσα στο υποέργο ως ευρήματα.
          const findingActions = [];
          if (applyResult.apeConflict) {
            findingActions.push(buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT, {
              detail: applyResult.apeConflict.contractLabel
                ? `Γραμμή: ${applyResult.apeConflict.contractLabel}. Κρατήστε την τρέχουσα τιμή ή δεχτείτε την πρόταση ΚΗΜΔΗΣ.`
                : '',
            }));
          }
          const unresolvedReviewCount = getUnresolvedReviewItems(
            mergedProject.khmdhsDataQualityReview,
            mergedProject
          ).length;
          if (unresolvedReviewCount > 0) {
            findingActions.push(buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW, {
              detail: unresolvedReviewCount === 1
                ? '1 πεδίο χρειάζεται συμπλήρωση ή επιβεβαίωση μετά την ανανέωση.'
                : `${unresolvedReviewCount} πεδία χρειάζονται συμπλήρωση ή επιβεβαίωση μετά την ανανέωση.`,
            }));
          }

          const projectToSave = {
            ...mergedProject,
            // Η έκδοση του υποέργου πάνω στην οποία δουλέψαμε — αν άλλαξε στο μεταξύ,
            // η αποθήκευση σταματά αντί να πατήσει τη δουλειά άλλου χρήστη.
            __expectedUpdatedAt: project?.updatedAt,
            khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
              outcome: report.category,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              seedAdam: res.seedAdam,
              appliedLines: report.appliedLines,
              attentionLines: report.attentionLines,
              actions: findingActions,
            }),
          };

          await ipcRenderer.invoke('create-khmdhs-refresh-snapshot', {
            subprojectId: item.id,
            actingUsername: currentUser?.username,
          });
          const saveRes = await ipcRenderer.invoke('save-project-data', projectToSave);
          if (saveRes?.success) {
            refreshed++;
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
              actions: findingActions,
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
            await persistItemFindings(item.id, buildKhmdhsRefreshFindings({
              outcome: KHMDHS_FINDING_OUTCOME.FAILED,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              seedAdam: res.seedAdam,
              error: saveRes?.error || 'Σφάλμα αποθήκευσης',
              actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.RETRY_FETCH, {
                detail: saveRes?.error || 'Σφάλμα αποθήκευσης',
              })],
            }));
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
          try {
            await persistItemFindings(item.id, buildKhmdhsRefreshFindings({
              outcome: KHMDHS_FINDING_OUTCOME.FAILED,
              runId,
              at: runStartedAt,
              by: currentUser?.username,
              error: err?.message || 'Απρόσμενο σφάλμα',
              actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.RETRY_FETCH, {
                detail: err?.message || 'Απρόσμενο σφάλμα',
              })],
            }));
          } catch { /* ignore persist failure */ }
          addLog('❌', `${item.label} — Εξαίρεση`);
        } finally {
          try { unsubItemProgress(); } catch (_) { /* ignore */ }
          if (lockAcquired) {
            try {
              await ipcRenderer.invoke('release-khmdhs-refresh-lock', {
                subprojectId: item.id,
                actingUsername: currentUser?.username,
              });
            } catch { /* ignore */ }
          }
        }

        await new Promise((r) => setTimeout(r, isRetryRun ? KHMDHS_RETRY_ITEM_GAP_MS : 300));
      }

      // Ό,τι δεν προλάβαμε (ακύρωση ή διακοπή) μένει για συνέχιση με την «Επανάληψη»,
      // ώστε να μη χρειάζεται να ξανατρέξει ο χρήστης όλη τη λίστα από την αρχή.
      const touchedIds = new Set(detailItems.map((d) => d.id).filter(Boolean));
      for (const item of eligible) {
        if (!item?.id || touchedIds.has(item.id)) continue;
        const pendingEntry = {
          status: 'skipped',
          notProcessed: true,
          id: item.id,
          label: item.label,
          reason: 'Δεν προλάβαμε να το δούμε — η εκτέλεση σταμάτησε νωρίτερα',
        };
        skippedItems.push(pendingEntry);
        detailItems.push(pendingEntry);
      }

      for (const entry of detailItems) {
        if (entry?.id) sessionLatest.set(entry.id, entry);
      }

      const resultItems = isRetryRun ? [...sessionLatest.values()] : detailItems;
      const batchResults = {
        refreshed: isRetryRun
          ? resultItems.filter((i) => i.status === 'refreshed').length
          : refreshed,
        needsIntervention: isRetryRun
          ? resultItems.filter((i) => i.status === 'intervened').length
          : needsIntervention,
        failed: isRetryRun
          ? resultItems.filter((i) => i.status === 'failed').length
          : failed,
        skipped: isRetryRun ? 0 : skippedItems.length,
        interventionItems: isRetryRun
          ? resultItems
            .filter((i) => i.status === 'intervened' && i.id)
            .map((i) => ({ id: i.id, label: i.label }))
          : interventionItems,
        items: resultItems,
        // Η επανάληψη ενημερώνει μόνο τα υποέργα που ξανατρέξαμε — δεν αντικαθιστά την αναφορά.
        isRetry: isRetryRun,
      };

      // Πρώτα φρέσκα υποέργα στη λίστα, μετά η αναφορά — αλλιώς ο συγχρονισμός
      // μπορεί να «κλείσει» εκκρεμότητες πάνω σε παλιά δεδομένα μνήμης.
      if (typeof onRefreshComplete === 'function') {
        await onRefreshComplete();
      }

      if (typeof onBatchResults === 'function') {
        onBatchResults(batchResults);
      }

      const lockedCount = resultItems.filter((d) => d.busy).length;
      const pendingCount = resultItems.filter((d) => d.notProcessed).length;
      lastToast = {
        isRetryRun,
        cancelled: !!cancelRef.current,
        refreshed: isRetryRun ? resultItems.filter((i) => i.status === 'refreshed').length : refreshed,
        needsIntervention: batchResults.needsIntervention,
        failed: batchResults.failed,
        lockedCount,
        pendingCount,
        total,
        remaining: pickKhmdhsBatchRetryCandidates(detailItems).length,
      };

      queue = pickKhmdhsBatchRetryCandidates(detailItems);
      if (!isRetryRun) break;
      }

      if (lastToast) {
        const {
          refreshed: doneCount, needsIntervention: needCount,
          failed: failCount, lockedCount, pendingCount, total: passTotal, remaining,
          isRetryRun: wasRetry,
        } = lastToast;
        const cancelled = lastToast.cancelled || !!cancelRef.current;
        if (cancelled) {
          showToast(
            `Η ${wasRetry ? 'επανάληψη' : 'μαζική ανανέωση'} ακυρώθηκε. Ολοκληρώθηκαν ${doneCount} από ${passTotal}` +
            (needCount ? `, ${needCount} χρειάζονται χαρακτηρισμό` : '') +
            (failCount ? `, ${failCount} απέτυχαν` : '') +
            (lockedCount ? `, ${lockedCount} ήταν σε χρήση` : '') +
            (pendingCount ? `, ${pendingCount} μένουν για συνέχεια` : ''),
            'info'
          );
        } else if (wasRetry && remaining > 0) {
          showToast(
            `Η επανάληψη σταμάτησε με ${remaining} ακόμα εκκρεμή. Ξαναπατήστε «Επανάληψη» όταν το ΚΗΜΔΗΣ ηρεμήσει.` +
            (doneCount ? ` Ολοκληρώθηκαν ${doneCount}.` : ''),
            'warning'
          );
        } else {
          showToast(
            (wasRetry ? 'Η επανάληψη ολοκληρώθηκε: ' : 'Μαζική ανανέωση ολοκληρώθηκε: ') +
            `${doneCount} ενημερώθηκαν` +
            (needCount ? `, ${needCount} χρειάζονται χαρακτηρισμό` : '') +
            (failCount ? `, ${failCount} απέτυχαν` : '') +
            (lockedCount ? `, ${lockedCount} για αργότερα (ήταν σε χρήση)` : ''),
            (needCount || failCount) ? 'warning' : 'success'
          );
        }
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
      window.clearInterval(heartbeat);
      if (runMarked) {
        ipcRenderer.invoke('end-khmdhs-batch-run', {
          actingUsername: currentUser?.username,
        }).catch(() => { /* η σήμανση λήγει μόνη της χωρίς σφυγμό */ });
      }
      setCancelRequested(false);
      setRunning(false);
      if (typeof onRetryLiveChange === 'function') onRetryLiveChange(null);
    }
  }, [
    batchScope, currentUser, showToast, onRefreshComplete, onBatchResults, onRetryLiveChange,
    addLog, eligiblePreview, persistItemFindings,
  ]);

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
  const lastCancelTokenRef = useRef(null);

  useEffect(() => {
    if (!cancelSignal) return;
    if (lastCancelTokenRef.current === cancelSignal) return;
    lastCancelTokenRef.current = cancelSignal;
    cancelRef.current = true;
    setCancelRequested(true);
    addLog('⛔', 'Ακύρωση επανάληψης από την αναφορά…');
    if (ipcRenderer?.invoke) {
      ipcRenderer.invoke('cancel-khmdhs-batch-refresh', {
        actingUsername: currentUser?.username,
      }).catch(() => {});
    }
  }, [cancelSignal, currentUser, addLog]);

  useEffect(() => {
    if (!retrySignal || !retrySignal.token) return;
    if (lastRetryTokenRef.current === retrySignal.token) return;
    const items = Array.isArray(retrySignal.items) ? retrySignal.items : [];
    if (!items.length) {
      lastRetryTokenRef.current = retrySignal.token;
      return;
    }
    // Αν τρέχει ακόμα η προηγούμενη μαζική, μην κάψεις το σήμα — ξαναδοκίμασε όταν ελευθερωθεί.
    if (running) return;
    lastRetryTokenRef.current = retrySignal.token;
    void handleBatchRefresh({ retryItems: items });
  }, [retrySignal, running, handleBatchRefresh]);

  if (!canUse) return null;

  return (
    <>
      <Container $compact={compact} $embedded={embedded}>
        <Header>
          <HeaderLeft>
            <IconChip $compact={compact} $embedded={embedded}>{running ? <FabSpinner>⟳</FabSpinner> : '🔄'}</IconChip>
            <TitleGroup>
              <Title $compact={compact} $embedded={embedded}>
                Μαζική ανανέωση ΚΗΜΔΗΣ
                {!running && staleCount > 0 && (
                  <StaleBadge $embedded={embedded}>
                    {staleCount} για ανανέωση
                    {oldestDays ? ` · έως ${oldestDays} ημ.` : ''}
                  </StaleBadge>
                )}
              </Title>
              <Subtitle $compact={compact} $embedded={embedded}>
                {running
                  ? 'Ανανέωση σε εξέλιξη — ενημερώνουμε τα υποέργα από το ΚΗΜΔΗΣ…'
                  : staleCount > 0
                    ? 'Ελέγχει το ΚΗΜΔΗΣ και ενημερώνει αυτόματα τα υποέργα σας.'
                    : 'Όλα ενημερωμένα — τρέξτε έλεγχο όποτε θέλετε.'}
              </Subtitle>
            </TitleGroup>
          </HeaderLeft>
          {!running && (
            <Btn $compact={compact} $embedded={embedded} onClick={handleConfirmStart}>Εκτέλεση</Btn>
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
          <MetaLine $compact={compact} $embedded={embedded}>
            <span>Τελευταία εκτέλεση: {lastRunInfo.date} — {lastRunInfo.refreshed} ενημερώθηκαν</span>
            {hasReport && typeof onOpenReport === 'function' && (
              <ReportLinkBtn type="button" onClick={onOpenReport} $embedded={embedded}>
                Δείτε αναφορά
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

      {confirmOpen && createPortal(
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

            {otherRun?.running && !otherRun.mine && (
              <ConfirmDesc style={{ color: '#b45309', fontWeight: 700 }}>
                ⏳ Αυτή τη στιγμή εκτελείται μαζική ανανέωση από {otherRun.by}.
                Περιμένετε να ολοκληρωθεί για να μην «τσακωθούν» οι δύο εκτελέσεις.
              </ConfirmDesc>
            )}

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
              Τα υποέργα που χρειάζονται χαρακτηρισμό εγγράφων δεν θα πειραχτούν — θα εμφανιστούν σε λίστα
              και θα σημανθούν μέσα στο υποέργο. Όσο το παράθυρο μένει ανοιχτό, η λίστα ανανεώνεται
              αυτόματα κάθε 2 λεπτά.
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
                onClick={() => handleBatchRefresh()}
                disabled={eligibleLoading || eligiblePreview == null || !selectedCount}
              >
                {eligibleLoading && eligiblePreview == null
                  ? 'Εντοπισμός…'
                  : `Εκκίνηση (${selectedCount || 0} υποέργα)`}
              </ConfirmProceed>
            </ConfirmActions>
          </ConfirmBox>
        </ConfirmOverlay>,
        document.body
      )}
    </>
  );
}
