import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import styled from 'styled-components';
import {
  statusShowsAssignmentProcedure,
  getProjectTypeBadgeColors,
  normalizeProjectType
} from '../data/formOptions';
import { formatViolationSummary } from '../utils/directAssignmentCompliance';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { getKhmdhsDisplayEntries, getTotalContractAmount, isMultipleContractsForm, sumNonExtensionSupplementaryGross } from '../utils/khmdhsFields';
import { noticeDrivesAssignmentProcedure, projectHasKhmdhsNoticeData, getProjectAssignmentProcedure, getProjectContractProcessStartDate } from '../utils/khmdhsNoticeFields';
import { projectHasKhmdhsDerivedSupplementary } from '../utils/khmdhsChainDerivedFields';
import { buildKhmdhsPaymentsTotals } from '../utils/khmdhsChainExtraFields';
import {
  hasApeEntryData,
  readContractApeFields,
  readSupplementaryApeFields,
} from '../utils/khmdhsApeEntry';
import { formatDateEl } from '../utils/dateFormat';
import { getDefaultSubprojectPhaseTab } from '../utils/subprojectPhaseTabDefault';
import { getVisibleFundingSourceRows, isCoFinancedProject } from '../utils/coFinancingDisplay';
import KhmdhsLifecycleRail from './KhmdhsLifecycleRail';
import KhmdhsRefreshActionButton from './KhmdhsRefreshActionButton';
import khmdhsRefresh from '../../app/core/khmdhsRefresh';
import portalCatalog from '../../app/core/portalCatalog';
import KhmdhsFormStageResults, { projectHasKhmdhsFormResults } from './KhmdhsFormStageResults';
import KhmdhsChainRefreshDialog from './KhmdhsChainRefreshDialog';
import KhmdhsContractExpiryPromptDialog from './KhmdhsContractExpiryPromptDialog';
import KhmdhsDocumentRegistryModal from './KhmdhsDocumentRegistryModal';
import {
  applyAutoDocumentRegistryFromChain,
  mergeKhmdhsDocumentRegistry,
} from '../utils/khmdhsDocumentRegistry';
import { findActRootSiblings, getSubprojectActRootReq } from '../utils/khmdhsBranchAnchor';
import { useToast } from './ToastProvider';
import {
  getKhmdhsChainFreshness,
  getKhmdhsRefreshSeedAdam,
  canUserRefreshKhmdhsChain,
  buildKhmdhsRefreshChangeReport,
} from '../utils/khmdhsChainRefresh';
import { getUnresolvedReviewItems } from '../utils/khmdhsDataQualityReport';
import {
  buildKhmdhsRefreshFindings,
  buildKhmdhsFindingAction,
  KHMDHS_FINDING_ACTION,
} from '../utils/khmdhsRefreshFindings';
import { applyAdamChainResult, applyStitchRefreshResults } from '../utils/khmdhsChainApply';
import { getConfirmedKhmdhsStitchPlan, evaluateStitchRefreshCompleteness } from '../utils/khmdhsChainStitchPlan';
import {
  resolveReusablePlanForKhmdhsRefresh,
  resolvePlanChainResForKhmdhsRefresh,
  needsSymvPlannerAfterKhmdhsRefresh,
} from '../utils/khmdhsSymvChainPlanner';
import KhmdhsSymvChainPlannerDialog from './KhmdhsSymvChainPlannerDialog';
import {
  evaluateKhmdhsContractExpiryPrompt,
  KHMDHS_COMPLETED_STATUS_SUGGESTION,
} from '../utils/khmdhsContractExpiryPrompt';
import {
  filterAndRankEpActions,
  highlightTitleMatches
} from '../utils/epActionSearch';

const ipcRenderer = window.electronAPI;

/** Ευρήματα ανανέωσης που μένουν μέσα στο υποέργο (ίδια μορφή με τη μαζική ανανέωση). */
function buildRefreshFindingsForProject({ report, applyResult, mergedProject, seedAdam, by }) {
  const actions = [];
  if (applyResult?.apeConflict) {
    actions.push(buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT, {
      detail: applyResult.apeConflict.contractLabel
        ? `Γραμμή: ${applyResult.apeConflict.contractLabel}.`
        : '',
    }));
  }
  const unresolved = getUnresolvedReviewItems(
    mergedProject?.khmdhsDataQualityReview,
    mergedProject
  ).length;
  if (unresolved > 0) {
    actions.push(buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW, {
      detail: unresolved === 1
        ? '1 πεδίο χρειάζεται συμπλήρωση ή επιβεβαίωση.'
        : `${unresolved} πεδία χρειάζονται συμπλήρωση ή επιβεβαίωση.`,
    }));
  }
  return buildKhmdhsRefreshFindings({
    outcome: report.category,
    source: 'single',
    by,
    seedAdam,
    appliedLines: report.appliedLines,
    attentionLines: report.attentionLines,
    actions,
  });
}

function formatEpBudget(val) {
  if (!val || val === 0) return null;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(val);
}

function EpPickerResultRow({
  action,
  subprojectTitle,
  searchQuery,
  matchLabel,
  highlight,
  disabled,
  onSelect
}) {
  const titleParts = highlightTitleMatches(action.title, subprojectTitle, searchQuery);
  const hierarchy = [action.axisCode, action.measureCode, action.objectiveCode].filter(Boolean).join(' › ');
  const budget = formatEpBudget(action.total);

  return (
    <EpPickerItem
      $highlight={highlight}
      onClick={() => !disabled && onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <EpPickerItemMain>
        <EpPickerItemTop>
          <EpPickerItemCode>#{action.aa}</EpPickerItemCode>
          {hierarchy && <EpPickerHierarchy>{hierarchy}</EpPickerHierarchy>}
          {matchLabel && (
            <EpPickerMatchBadge $v={matchLabel.variant}>{matchLabel.text}</EpPickerMatchBadge>
          )}
        </EpPickerItemTop>
        <EpPickerItemTitle>
          {titleParts.map((part, i) =>
            part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>
          )}
        </EpPickerItemTitle>
        <EpPickerItemMeta>
          {action.actionType && <span>📋 {action.actionType}</span>}
          {action.location && <span>📍 {action.location}</span>}
          {action.priority && <span>Προτ. {action.priority}</span>}
          {budget && <span>💰 {budget}</span>}
          {action.isNew != null && (
            <span>{action.isNew ? '🟢 Νέα' : '🟡 Συνεχιζόμενη'}</span>
          )}
        </EpPickerItemMeta>
      </EpPickerItemMain>
      <EpPickerSelectBtn
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}
      >
        Επιλογή
      </EpPickerSelectBtn>
    </EpPickerItem>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1.5rem 3vw;
  overflow: hidden;
  overscroll-behavior: none;
`;

const Modal = styled.div`
  background: #ffffff;
  border-radius: 18px;
  width: min(calc(100vw - 6vw), 1420px);
  max-height: min(calc(100vh - 3rem), 900px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
  box-sizing: border-box;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.20),
    0 24px 56px -16px rgba(15, 23, 42, 0.32),
    0 8px 24px rgba(79, 70, 229, 0.10);
  animation: slideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const ModalHeader = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: white;
  padding: 0.72rem 1.25rem 0.62rem;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  flex: 1;
  position: relative;
  z-index: 1;
`;

const ProjectTitleSmall = styled.div`
  font-size: 0.68rem;
  opacity: 0.88;
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
`;

const SubprojectTitleLarge = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
`;

const HeaderBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.15rem;
`;

const HeaderMetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(4px);
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
`;

const HeaderEditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.38rem 0.85rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.97);
  color: #4338ca;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    background: #fff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.16);
  border: none;
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }
`;

const PhaseTabRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-top: 0.55rem;
  flex-wrap: wrap;
  width: 100%;
`;

const PhaseTabStrip = styled.div`
  display: flex;
  gap: 0.35rem;
  padding: 0.22rem;
  background: rgba(0, 0, 0, 0.18);
  border-radius: 10px;
  align-self: flex-start;
`;

const PhaseTab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 1.15rem;
  border-radius: 7px;
  border: none;
  font-size: 0.8rem;
  font-weight: ${(p) => (p.$active ? 700 : 600)};
  cursor: pointer;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
  background: ${(p) => (p.$active ? 'rgba(255,255,255,0.97)' : 'transparent')};
  color: ${(p) => (p.$active ? '#4f46e5' : 'rgba(255,255,255,0.6)')};
  box-shadow: ${(p) => (p.$active ? '0 2px 10px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)' : 'none')};
  transform: ${(p) => (p.$active ? 'translateY(-1px)' : 'none')};

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.12)')};
    color: ${(p) => (p.$active ? '#4f46e5' : 'rgba(255,255,255,0.9)')};
  }
`;

const PhaseTabDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) => p.$color || 'rgba(255,255,255,0.7)'};
  flex-shrink: 0;
  box-shadow: ${(p) => (p.$color && p.$color !== 'rgba(255,255,255,0.45)' ? `0 0 5px ${p.$color}` : 'none')};
`;

const ModalBody = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: ${(p) => (p.$phaseB ? '0.65rem 1.1rem 0.75rem' : '1rem 1.5rem 1.25rem')};
  background: ${(p) => (p.$phaseB ? '#f8f9ff' : '#fafbff')};
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.45) transparent;

  &::-webkit-scrollbar { width: 9px; }
  &::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.12);
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #818cf8, #6366f1);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
`;

const ModalBodyInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$phaseB ? '0.5rem' : '1rem')};
  min-height: min-content;
`;

const DetailFooter = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.4rem 0.85rem 0.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: #f8fafc;
  border-radius: 0 0 16px 16px;
  flex-shrink: 0;
  width: 100%;
`;

const FooterBtn = styled.button`
  padding: 0.48rem 1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
`;

const FooterCloseBtn = styled(FooterBtn)`
  background: #fff;
  color: #64748b;
  border: 1px solid rgba(148, 163, 184, 0.35);

  &:hover {
    background: #f8fafc;
    color: #1e293b;
  }
`;

const FooterFilesBtn = styled(FooterBtn)`
  background: #fff;
  color: #4338ca;
  border: 1px solid rgba(99, 102, 241, 0.35);

  &:hover {
    background: #eef2ff;
  }
`;

const PhaseBEmpty = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  border-radius: 14px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  border: 1px dashed rgba(148, 163, 184, 0.35);
  color: #64748b;
`;

const PhaseBEmptyIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
`;

const PhaseBEmptyTitle = styled.div`
  font-size: 0.92rem;
  font-weight: 800;
  color: #475569;
  margin-bottom: 0.35rem;
`;

const PhaseBEmptyText = styled.div`
  font-size: 0.8rem;
  line-height: 1.5;
  max-width: 420px;
  margin: 0 auto;
`;

const DetailSectionCard = styled.section`
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 2px 14px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  flex-shrink: 0;
  width: 100%;
`;

const LifecycleRailWrap = styled.div`
  flex-shrink: 0;
  width: 100%;
`;

const FreshnessHint = styled.p`
  margin: 0.35rem 0 0;
  padding: 0 0.15rem;
  font-size: 0.72rem;
  color: ${(p) => (p.$level === 'red' ? '#b91c1c' : '#b45309')};
  line-height: 1.4;
`;

/** Διακριτική επαναφορά στην εικόνα που είχε το υποέργο πριν την τελευταία ανανέωση. */
const RestoreSnapshotBtn = styled.button`
  margin-top: 0.4rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; color: #1e293b; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

const DetailSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(135deg, ${(p) => p.$accent}14 0%, rgba(255,255,255,0.6) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  border-left: 4px solid ${(p) => p.$accent};

  .section-icon {
    font-size: 1rem;
    line-height: 1;
  }
`;

const DetailSectionTitle = styled.h3`
  margin: 0;
  font-size: 0.86rem;
  font-weight: 800;
  color: ${(p) => p.$accentDark || p.$accent};
  letter-spacing: 0.03em;
`;

const DetailSectionBody = styled.div`
  padding: 0.95rem 1rem 1.05rem;
`;

const HeroStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 0.55rem;
  flex-shrink: 0;
  width: 100%;
`;

const HeroChip = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid ${(p) => p.$border || 'rgba(148, 163, 184, 0.22)'};
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07);
  }
`;

const HeroChipLabel = styled.div`
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-bottom: 0.3rem;
`;

const HeroChipValue = styled.div`
  font-size: ${(p) => (p.$large ? '1.05rem' : '0.88rem')};
  font-weight: ${(p) => (p.$strong ? 800 : 600)};
  color: ${(p) => p.$color || '#0f172a'};
  line-height: 1.35;
  word-break: break-word;
`;

const AlertBanner = styled.div`
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.1);
  flex-shrink: 0;
  width: 100%;
`;

const AlertBannerTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  color: #b45309;
  margin-bottom: 0.45rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const AlertBannerItem = styled.div`
  font-size: 0.82rem;
  color: #92400e;
  line-height: 1.55;
  padding: 0.55rem 0.65rem;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 8px;
  border: 1px solid rgba(251, 191, 36, 0.35);

  &:not(:last-child) {
    margin-bottom: 0.4rem;
  }
`;

const TextBlock = styled.div`
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.65;
  white-space: pre-wrap;
`;

const PortalToggleCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: ${(p) => (p.$published
    ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
    : 'linear-gradient(135deg, #f8fafc 0%, #fff 100%)')};
  border: 1.5px solid ${(p) => (p.$published ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.25)')};
`;

const PortalToggleBtn = styled.button`
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.82rem;
  color: white;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: ${(p) => (p.$published
    ? 'linear-gradient(135deg, #dc2626, #ef4444)'
    : 'linear-gradient(135deg, #2563eb, #0ea5e9)')};
  box-shadow: ${(p) => (p.$published
    ? '0 3px 10px rgba(220, 38, 38, 0.3)'
    : '0 3px 10px rgba(37, 99, 235, 0.3)')};

  &:hover {
    transform: translateY(-1px);
  }
`;

// EP Program link styled components
const EpActionChip = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
`;
const EpActionChipCode = styled.span`
  flex-shrink: 0;
  background: #6366f1;
  color: white;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  margin-top: 2px;
`;
const EpActionChipTitle = styled.div`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #3730a3;
  line-height: 1.4;
`;
const EpActionChipMeta = styled.div`
  font-size: 11px;
  color: #6366f1;
  margin-top: 3px;
`;
const EpUnlinkBtn = styled.button`
  flex-shrink: 0;
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  color: #dc2626;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  transition: all 0.13s;
  &:hover { background: #fee2e2; }
`;
const EpLinkBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  transition: all 0.15s;
  margin-top: 6px;
  &:hover { opacity: 0.88; }
`;
const EpPickerOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.5);
  backdrop-filter: blur(3px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const EpPickerBox = styled.div`
  background: white;
  border-radius: 12px;
  width: min(720px, 95vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden;
`;
const EpPickerHeader = styled.div`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  padding: 16px 20px 14px;
`;
const EpPickerHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;
const EpPickerTitle = styled.h3`margin: 0; font-size: 15px; font-weight: 700; color: white;`;
const EpPickerSubtitle = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255,255,255,0.78);
  line-height: 1.4;
`;
const EpPickerClose = styled.button`
  background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
  border-radius: 6px; color: white; cursor: pointer; font-size: 13px;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:hover { background: rgba(255,255,255,0.25); }
`;
const EpPickerContext = styled.div`
  margin: 0 16px 10px;
  padding: 10px 12px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 12px;
  color: #4338ca;
  line-height: 1.5;
  strong { font-weight: 700; }
`;
const EpPickerSearchWrap = styled.div`padding: 0 16px 8px;`;
const EpPickerSearch = styled.input`
  width: 100%;
  box-sizing: border-box;
  background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;
  color: #1e293b; font-size: 13px; padding: 10px 12px; outline: none;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: white; }
`;
const EpPickerSearchHint = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
`;
const EpPickerList = styled.div`
  flex: 1; overflow-y: auto; padding: 0 12px 14px;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #a5b4fc, #6366f1); border-radius: 4px; }
`;
const EpPickerSectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 8px 4px 8px;
`;
const EpPickerItem = styled.div`
  border: 1px solid ${({ $highlight }) => $highlight ? '#a5b4fc' : '#e2e8f0'};
  border-left: 4px solid ${({ $highlight }) => $highlight ? '#6366f1' : '#cbd5e1'};
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  background: ${({ $highlight }) => $highlight ? '#f5f3ff' : 'white'};
  transition: all 0.12s;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  &:hover {
    border-color: #818cf8;
    border-left-color: #4f46e5;
    background: #eef2ff;
    box-shadow: 0 4px 14px rgba(99,102,241,0.12);
  }
`;
const EpPickerItemMain = styled.div`flex: 1; min-width: 0;`;
const EpPickerItemTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
`;
const EpPickerItemCode = styled.span`
  font-size: 11px; font-weight: 700; color: white;
  background: #6366f1; border-radius: 5px; padding: 2px 7px;
`;
const EpPickerHierarchy = styled.span`
  font-size: 10px; color: #64748b; font-family: monospace;
  background: #f1f5f9; border-radius: 4px; padding: 2px 6px;
`;
const EpPickerMatchBadge = styled.span`
  font-size: 10px; font-weight: 700; border-radius: 12px; padding: 2px 8px;
  background: ${({ $v }) => $v === 'high' ? '#dcfce7' : $v === 'good' ? '#dbeafe' : '#fef3c7'};
  color: ${({ $v }) => $v === 'high' ? '#166534' : $v === 'good' ? '#1d4ed8' : '#92400e'};
  border: 1px solid ${({ $v }) => $v === 'high' ? '#bbf7d0' : $v === 'good' ? '#bfdbfe' : '#fde68a'};
`;
const EpPickerItemTitle = styled.div`
  font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.45;
  mark {
    background: #fef08a;
    color: #854d0e;
    border-radius: 3px;
    padding: 0 2px;
  }
`;
const EpPickerItemMeta = styled.div`
  font-size: 11px; color: #64748b; margin-top: 6px;
  display: flex; flex-wrap: wrap; gap: 8px;
`;
const EpPickerSelectBtn = styled.button`
  flex-shrink: 0;
  align-self: center;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 12px;
  white-space: nowrap;
  transition: opacity 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.9; }
`;
const EpPickerEmpty = styled.div`
  text-align: center;
  padding: 28px 16px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  margin: 4px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.55rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const BasicSplitGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
  align-items: start;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const BasicColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
  transition: border-color 0.2s ease, background 0.2s ease;

  &:hover {
    background: #f1f5f9;
    border-color: rgba(99, 102, 241, 0.22);
  }
`;

const FieldFull = styled(Field)`
  grid-column: 1 / -1;
`;

const FieldLabel = styled.span`
  font-size: 0.66rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const FieldValue = styled.span`
  font-size: 0.9rem;
  color: #0f172a;
  font-weight: 500;
  word-break: break-word;
  line-height: 1.45;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  background: ${(props) => {
    switch (props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return 'linear-gradient(135deg, #fbbf24, #f59e0b)';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return 'linear-gradient(135deg, #fb923c, #ea580c)';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return 'linear-gradient(135deg, #3b82f6, #2563eb)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return 'linear-gradient(135deg, #22c55e, #16a34a)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return 'linear-gradient(135deg, #14b8a6, #0d9488)';
      case 'ΑΠΕΝΤΑΓΜΕΝΟ': return 'linear-gradient(135deg, #94a3b8, #64748b)';
      default: return 'linear-gradient(135deg, #64748b, #475569)';
    }
  }};
  color: white;
`;

const TypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: ${(props) => getProjectTypeBadgeColors(props.type).bg};
  color: ${(props) => getProjectTypeBadgeColors(props.type).color};
  border: 1px solid rgba(0, 0, 0, 0.06);
`;

const AmountValue = styled.span`
  font-weight: 800;
  color: #059669;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
`;

const CodePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
  border: 1px solid rgba(59, 130, 246, 0.25);
  margin: 0 0.35rem 0.35rem 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
`;

const ContractBox = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #fff 100%);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-left: 4px solid #6366f1;
  margin-bottom: 0.65rem;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
`;

const ContractBoxTitle = styled.div`
  font-weight: 800;
  color: #4338ca;
  font-size: 0.82rem;
  margin-bottom: 0.55rem;
  letter-spacing: 0.02em;
`;

const SupplementaryBox = styled(ContractBox)`
  border-left-color: #16a34a;
  border-color: rgba(22, 163, 74, 0.22);
  background: linear-gradient(135deg, #f0fdf4 0%, #fff 100%);
  box-shadow: 0 2px 8px rgba(22, 163, 74, 0.06);
`;

const TotalBox = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(37, 99, 235, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.55rem;
  box-shadow: 0 3px 12px rgba(37, 99, 235, 0.1);
`;

const AleRemainingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.15);
  margin-bottom: 0.4rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const AleBadge = styled.span`
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  min-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid rgba(59, 130, 246, 0.2);
`;

const EmptyValue = styled.span`
  color: #cbd5e1;
  font-style: italic;
  font-size: 0.88rem;
`;

const ACCENTS = {
  basic: '#6366f1',
  codes: '#0ea5e9',
  khmdhs: '#10b981',
  funding: '#059669',
  remaining: '#8b5cf6',
  contract: '#4338ca',
  comments: '#64748b',
  ep: '#6366f1',
  portal: '#10b981',
  files: '#6366f1',
};

function SectionBlock({ icon, title, accent, children, style }) {
  const color = accent || ACCENTS.basic;
  return (
    <DetailSectionCard style={style}>
      <DetailSectionHeader $accent={color}>
        <span className="section-icon" aria-hidden>{icon}</span>
        <DetailSectionTitle $accent={color}>{title}</DetailSectionTitle>
      </DetailSectionHeader>
      <DetailSectionBody>{children}</DetailSectionBody>
    </DetailSectionCard>
  );
}

function SubprojectDetailModal({
  project,
  onClose,
  onEdit,
  onOpenFileManager,
  userRole,
  currentUser,
  isLocked,
  lockedBy,
  engineerCatalog = [],
  portalEnabled = false,
  isPublishedToPortal = false,
  isLiveOnPortal = false,
  onTogglePortal,
  onRefreshProject,
  onEpLinksChanged,
  directAssignmentViolations = [],
  engineerVisibilityContext = null,
  allSubprojects = [],
}) {
  const { showToast } = useToast();
  const requestingUsername = currentUser?.username || '';

  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');
  const [refreshDialog, setRefreshDialog] = useState(null);
  const [symvPlannerState, setSymvPlannerState] = useState(null);
  const [khmdhsRegistryModal, setKhmdhsRegistryModal] = useState(null);
  const [contractExpiryPrompt, setContractExpiryPrompt] = useState(null);
  const contractExpiryCheckedRef = React.useRef(false);

  useEffect(() => {
    contractExpiryCheckedRef.current = false;
    setContractExpiryPrompt(null);
  }, [project?.subprojectId]);

  useEffect(() => {
    if (!project?.subprojectId || contractExpiryCheckedRef.current) return;
    contractExpiryCheckedRef.current = true;
    const prompt = evaluateKhmdhsContractExpiryPrompt(project);
    if (prompt) {
      window.setTimeout(() => setContractExpiryPrompt(prompt), 350);
    }
  }, [project]);

  // EP Program link state
  const [epLinkedActions, setEpLinkedActions] = useState([]);
  const [epLoading, setEpLoading] = useState(false);
  const [showEpPicker, setShowEpPicker] = useState(false);
  const [epPickerSearch, setEpPickerSearch] = useState('');
  const [epPickerProgram, setEpPickerProgram] = useState(null);
  const [epPickerLoading, setEpPickerLoading] = useState(false);
  const [epPickerError, setEpPickerError] = useState('');
  const [epLinkLoading, setEpLinkLoading] = useState(false);
  const [activePhaseTab, setActivePhaseTab] = useState('A');
  const canManageEp = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  const chainFreshness = useMemo(
    () => getKhmdhsChainFreshness(project),
    [project]
  );

  const actRootSiblings = useMemo(() => {
    const root = getSubprojectActRootReq(project);
    if (!root) return [];
    return findActRootSiblings(allSubprojects, root, project?.subprojectId);
  }, [project, allSubprojects]);

  const hasKhmdhsRefreshSeed = useMemo(
    () => !!getKhmdhsRefreshSeedAdam(project).adam,
    [project]
  );

  const confirmedStitchPlan = useMemo(
    () => getConfirmedKhmdhsStitchPlan(project),
    [project]
  );

  const handleCancelStitchPlan = useCallback(async () => {
    if (!project?.subprojectId || isLocked) return;
    const ok = window.confirm(
      'Να καταργηθεί η καταχώριση τεχνητής αλυσίδας; Τα δεδομένα παραμένουν, αλλά οι επόμενες '
      + 'ανανεώσεις θα χρησιμοποιούν έναν μόνο κωδικό ΚΗΜΔΗΣ.'
    );
    if (!ok) return;
    try {
      const updated = {
        ...project,
        khmdhsChainStitchPlan: null,
        updatedAt: new Date().toISOString(),
        __expectedUpdatedAt: project.updatedAt || '',
      };
      const saveRes = await ipcRenderer.invoke('save-project-data', updated);
      if (!saveRes?.success) {
        showToast(saveRes?.error || 'Δεν αποθηκεύτηκε η αλλαγή.', 'error');
        return;
      }
      showToast('Η τεχνητή αλυσίδα καταργήθηκε.', 'success');
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      showToast(e?.message || 'Σφάλμα κατά την κατάργηση.', 'error');
    }
  }, [project, isLocked, showToast, onRefreshProject]);

  const canRefreshKhmdhs = useMemo(
    () => canUserRefreshKhmdhsChain({
      userRole,
      currentUser,
      project,
      engineerContext: engineerVisibilityContext,
      engineerCatalog,
    }),
    [userRole, currentUser, project, engineerVisibilityContext, engineerCatalog]
  );

  // Κρατάμε το υποέργο πιασμένο από την ανάκτηση μέχρι την αποθήκευση ή την ακύρωση,
  // ώστε να μη γράψει ταυτόχρονα άλλος χρήστης (ή η μαζική ανανέωση) πάνω στα ίδια δεδομένα.
  const khmdhsRefreshLockRef = React.useRef('');

  const releaseKhmdhsRefreshLock = useCallback(async () => {
    const sid = khmdhsRefreshLockRef.current;
    if (!sid) return;
    khmdhsRefreshLockRef.current = '';
    try {
      await ipcRenderer.invoke('release-khmdhs-refresh-lock', {
        subprojectId: sid,
        actingUsername: requestingUsername,
      });
    } catch { /* το κλείδωμα λήγει μόνο του */ }
  }, [requestingUsername]);

  useEffect(() => () => { void releaseKhmdhsRefreshLock(); }, [releaseKhmdhsRefreshLock]);

  // Αντίγραφο πριν την τελευταία ανανέωση — δίνει τη δυνατότητα επαναφοράς αν κάτι δεν άρεσε.
  const canRestoreSnapshot = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const [snapshotInfo, setSnapshotInfo] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!canRestoreSnapshot || !project?.subprojectId || refreshLoading) return undefined;
    ipcRenderer.invoke('get-khmdhs-refresh-snapshot-info', {
      subprojectId: project.subprojectId,
      actingUsername: requestingUsername,
    })
      .then((res) => { if (!cancelled) setSnapshotInfo(res?.exists ? res : null); })
      .catch(() => { if (!cancelled) setSnapshotInfo(null); });
    return () => { cancelled = true; };
  }, [canRestoreSnapshot, project?.subprojectId, requestingUsername, refreshLoading]);

  const handleRestoreSnapshot = useCallback(async () => {
    if (!snapshotInfo?.exists || restoring) return;
    const takenAt = snapshotInfo.takenAt ? new Date(snapshotInfo.takenAt).toLocaleString('el-GR') : '';
    const ok = window.confirm(
      'Να επαναφερθεί το υποέργο στην εικόνα που είχε πριν την τελευταία ανανέωση ΚΗΜΔΗΣ'
      + (takenAt ? ` (${takenAt});` : ';')
      + '\n\nΠροσοχή: επανέρχονται ΟΛΑ τα στοιχεία του υποέργου σε εκείνη τη στιγμή — '
      + 'χάνονται και όσες αλλαγές έγιναν χειροκίνητα μετά την ανανέωση.'
      + '\nΗ ενέργεια καταγράφεται στο ιστορικό.'
    );
    if (!ok) return;
    setRestoring(true);
    try {
      const res = await ipcRenderer.invoke('restore-khmdhs-refresh-snapshot', {
        subprojectId: project.subprojectId,
        actingUsername: requestingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Η επαναφορά δεν ολοκληρώθηκε.', 'error');
        return;
      }
      setSnapshotInfo(null);
      showToast('Το υποέργο επανήλθε στην προηγούμενη κατάσταση.', 'success');
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      showToast(e?.message || 'Σφάλμα κατά την επαναφορά.', 'error');
    } finally {
      setRestoring(false);
    }
  }, [snapshotInfo, restoring, project?.subprojectId, requestingUsername, showToast, onRefreshProject]);

  const handleStartKhmdhsRefresh = useCallback(async () => {
    if (!canRefreshKhmdhs || refreshLoading || isLocked || !project?.subprojectId) return;
    setRefreshLoading(true);
    setRefreshProgress('Σύνδεση με ΚΗΜΔΗΣ…');
    let unsubProgress = () => {};
    if (typeof ipcRenderer?.on === 'function') {
      unsubProgress = ipcRenderer.on('khmdhs-refresh-progress', (payload) => {
        if (!payload || payload.subprojectId !== project.subprojectId) return;
        if (payload.message) setRefreshProgress(String(payload.message));
      }) || (() => {});
    }
    // Όσο μένει ανοιχτός ο διάλογος αλλαγών ή ο χαρακτηρισμός, το κλείδωμα παραμένει.
    let keepLock = false;
    try {
      const lockRes = await ipcRenderer.invoke('acquire-khmdhs-refresh-lock', {
        subprojectId: project.subprojectId,
        actingUsername: requestingUsername,
      });
      if (!lockRes?.success) {
        showToast(
          lockRes?.lockedBy
            ? `Το υποέργο το επεξεργάζεται αυτή τη στιγμή ο/η ${lockRes.lockedBy}. Δοκιμάστε ξανά σε λίγο.`
            : (lockRes?.error || 'Το υποέργο είναι πιασμένο αυτή τη στιγμή.'),
          'warning'
        );
        return;
      }
      khmdhsRefreshLockRef.current = project.subprojectId;

      const res = await ipcRenderer.invoke('preview-subproject-khmdhs-refresh', {
        subprojectId: project.subprojectId,
        actingUsername: requestingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Η ανάκτηση από το ΚΗΜΔΗΣ απέτυχε.', 'error');
        return;
      }
      if (res.stitchPlanFormMismatch) {
        showToast(
          'Η τεχνητή αλυσίδα ακυρώθηκε γιατί άλλαξε η μορφή υλοποίησης (μία / πολλές συμβάσεις). Η ανανέωση συνεχίζει με έναν κωδικό.',
          'warning'
        );
      }
      const stitchCompleteness = evaluateStitchRefreshCompleteness(res);
      if (!stitchCompleteness.ok) {
        showToast(stitchCompleteness.message, 'error');
        return;
      }
      // Ίδιος κανόνας με τη μαζική: επαναχρησιμοποίηση κατανομής όταν τα νέα ΑΔΑΜ
      // είναι μόνο αυτόματα «Δεν καταχωρείται»· αλλιώς ξαναρωτάμε μόνο αν χρειάζεται απόφαση.
      const existingSymvPlan = project.khmdhsSymvChainPlan;
      const planChainRes = resolvePlanChainResForKhmdhsRefresh(res);
      const reusableSymvPlan = resolveReusablePlanForKhmdhsRefresh(existingSymvPlan, res);
      if (needsSymvPlannerAfterKhmdhsRefresh(existingSymvPlan, res)) {
        setSymvPlannerState({
          open: true,
          chainRes: planChainRes || res.chainRes,
          seedAdam: res.seedAdam,
          seedLabel: res.seedLabel,
          subprojectTitle: project.subprojectTitle || '',
          existingPlan: existingSymvPlan,
        });
        keepLock = true;
        return;
      }
      // Τεχνητή αλυσίδα / ανανέωση σε επίπεδο υποέργου: πάντα stitch (όχι replace στη γραμμή 0).
      const registryChainResList = [];
      let applyResult;
      if (res.usesStitchPlan && Array.isArray(res.stitchResults) && res.stitchResults.length) {
        applyResult = applyStitchRefreshResults(project, res.stitchResults, {
          fallbackChainRes: planChainRes || res.chainRes,
          fallbackSeedAdam: res.seedAdam,
          symvChainPlan: reusableSymvPlan,
        });
        res.stitchResults.forEach((item) => {
          if (item?.success && item.chainRes) registryChainResList.push(item.chainRes);
        });
      } else {
        applyResult = applyAdamChainResult(project, res.chainRes, {
          seedAdam: res.seedAdam,
          symvChainPlan: reusableSymvPlan,
          applyMode: 'stitch',
        });
        registryChainResList.push(res.chainRes);
      }
      if (applyResult.warnings?.includes('symvPlannerRequired')) {
        setSymvPlannerState({
          open: true,
          chainRes: planChainRes || res.chainRes,
          seedAdam: res.seedAdam,
          seedLabel: res.seedLabel,
          subprojectTitle: project.subprojectTitle || '',
          existingPlan: existingSymvPlan || null,
        });
        keepLock = true;
        return;
      }
      const mergedProject = {
        ...applyResult.form,
        projectId: project.projectId,
        subprojectId: project.subprojectId,
        updatedAt: new Date().toISOString(),
        // Η έκδοση πάνω στην οποία δουλέψαμε — φρένο αν αλλάξει στο μεταξύ από αλλού.
        __expectedUpdatedAt: project.updatedAt,
        ...(res.stitchPlanFormMismatch ? { khmdhsChainStitchPlan: null } : {}),
      };
      // Αυτόματη ενημέρωση Αρχείων Υποέργου κατά την ανανέωση ΚΗΜΔΗΣ — χωρίς να ζητείται
      // καμία χειροκίνητη ενέργεια από τον χρήστη (τίτλοι + νέα πλήρη έγγραφα αλυσίδας).
      mergedProject.khmdhsDocumentRegistry = applyAutoDocumentRegistryFromChain(
        mergedProject,
        registryChainResList.length ? registryChainResList : [res.chainRes]
      );
      const report = buildKhmdhsRefreshChangeReport(project, mergedProject, applyResult, {
        chainWarnings: (registryChainResList.length ? registryChainResList : [res.chainRes])
          .flatMap((cr) => cr?.warnings || []),
      });
      // Η αναφορά μένει και μέσα στο υποέργο, ώστε να ξαναβρεθεί μετά το κλείσιμο του διαλόγου.
      mergedProject.khmdhsLastRefreshFindings = buildRefreshFindingsForProject({
        report,
        applyResult,
        mergedProject,
        seedAdam: res.seedAdam,
        by: requestingUsername,
      });
      setRefreshDialog({
        seedAdam: res.seedAdam,
        seedLabel: res.seedLabel,
        changeLines: report.lines,
        mergedProject,
        chainRes: res.chainRes,
      });
      keepLock = true;
      const expiryAfterRefresh = evaluateKhmdhsContractExpiryPrompt(mergedProject, {
        statusBeforeKhmdhsRefresh: project.projectStatus,
      });
      if (expiryAfterRefresh) {
        window.setTimeout(() => setContractExpiryPrompt(expiryAfterRefresh), 350);
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα κατά την ανανέωση ΚΗΜΔΗΣ.', 'error');
    } finally {
      try { unsubProgress(); } catch (_) { /* ignore */ }
      setRefreshLoading(false);
      setRefreshProgress('');
      if (!keepLock) await releaseKhmdhsRefreshLock();
    }
  }, [
    canRefreshKhmdhs,
    refreshLoading,
    isLocked,
    project,
    requestingUsername,
    showToast,
    releaseKhmdhsRefreshLock,
  ]);

  const handleSymvPlannerConfirm = useCallback((plan) => {
    if (!symvPlannerState?.chainRes || !plan?.items?.length) {
      setSymvPlannerState(null);
      void releaseKhmdhsRefreshLock();
      return;
    }
    const { chainRes, seedAdam } = symvPlannerState;
    setSymvPlannerState(null);
    const applyResult = applyAdamChainResult(project, chainRes, {
      seedAdam,
      symvChainPlan: plan,
    });
    const mergedProject = {
      ...applyResult.form,
      projectId: project.projectId,
      subprojectId: project.subprojectId,
      khmdhsSymvChainPlan: plan,
      khmdhsSymvPlanAppliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __expectedUpdatedAt: project.updatedAt,
    };
    mergedProject.khmdhsDocumentRegistry = applyAutoDocumentRegistryFromChain(
      mergedProject,
      [chainRes]
    );
    const report = buildKhmdhsRefreshChangeReport(project, mergedProject, applyResult, {
      chainWarnings: chainRes?.warnings || [],
    });
    mergedProject.khmdhsLastRefreshFindings = buildRefreshFindingsForProject({
      report,
      applyResult,
      mergedProject,
      seedAdam,
      by: requestingUsername,
    });
    setRefreshDialog({
      seedAdam,
      seedLabel: symvPlannerState.seedLabel,
      changeLines: report.lines,
      mergedProject,
      chainRes,
    });
    const expiryAfterRefresh = evaluateKhmdhsContractExpiryPrompt(mergedProject, {
      statusBeforeKhmdhsRefresh: project.projectStatus,
    });
    if (expiryAfterRefresh) {
      window.setTimeout(() => setContractExpiryPrompt(expiryAfterRefresh), 350);
    }
  }, [symvPlannerState, project, requestingUsername, releaseKhmdhsRefreshLock]);

  const handleContractExpiryAccept = useCallback(async () => {
    const base = refreshDialog?.mergedProject || project;
    if (!base) {
      setContractExpiryPrompt(null);
      return;
    }
    const updated = {
      ...base,
      projectStatus: KHMDHS_COMPLETED_STATUS_SUGGESTION,
      updatedAt: new Date().toISOString(),
      __expectedUpdatedAt: base.updatedAt || '',
    };
    if (refreshDialog?.mergedProject) {
      setRefreshDialog({
        ...refreshDialog,
        mergedProject: updated,
      });
      setContractExpiryPrompt(null);
      showToast('Η κατάσταση θα οριστεί σε «Ολοκληρωμένο» με την αποθήκευση.', 'info');
      return;
    }
    setContractExpiryPrompt(null);
    try {
      const saveRes = await ipcRenderer.invoke('save-project-data', updated);
      if (!saveRes?.success) {
        showToast(saveRes?.error || 'Αποτυχία αποθήκευσης.', 'error');
        return;
      }
      showToast('Η κατάσταση ορίστηκε σε «Ολοκληρωμένο».', 'success');
      if (typeof onRefreshProject === 'function') {
        await onRefreshProject();
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα αποθήκευσης.', 'error');
    }
  }, [refreshDialog, project, showToast, onRefreshProject]);

  const handleConfirmKhmdhsRefresh = useCallback(async () => {
    if (!refreshDialog?.mergedProject) return;
    setRefreshLoading(true);
    try {
      await ipcRenderer.invoke('create-khmdhs-refresh-snapshot', {
        subprojectId: refreshDialog.mergedProject.subprojectId,
        actingUsername: requestingUsername,
      });
      const saveRes = await ipcRenderer.invoke('save-project-data', refreshDialog.mergedProject);
      if (!saveRes?.success) {
        showToast(saveRes?.error || 'Αποτυχία αποθήκευσης.', 'error');
        // Αν το υποέργο άλλαξε στο μεταξύ, η ίδια αποθήκευση δεν πρόκειται να πετύχει ποτέ:
        // κλείνουμε τον διάλογο και φέρνουμε την τρέχουσα εικόνα για νέα ανανέωση.
        if (saveRes?.conflict) {
          setRefreshDialog(null);
          if (typeof onRefreshProject === 'function') await onRefreshProject();
        }
        return;
      }
      showToast('Η αλυσίδα ΚΗΜΔΗΣ ενημερώθηκε επιτυχώς.', 'success');
      setRefreshDialog(null);
      if (typeof onRefreshProject === 'function') {
        await onRefreshProject();
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα αποθήκευσης.', 'error');
    } finally {
      setRefreshLoading(false);
      await releaseKhmdhsRefreshLock();
    }
  }, [refreshDialog, showToast, onRefreshProject, requestingUsername, releaseKhmdhsRefreshLock]);

  const handleKhmdhsRegistryConfirm = useCallback(async (selectedList, neverAsk) => {
    const base = khmdhsRegistryModal?.baseProject;
    setKhmdhsRegistryModal(null);
    if (!base) return;
    const updated = {
      ...base,
      khmdhsDocumentRegistry: mergeKhmdhsDocumentRegistry(
        base.khmdhsDocumentRegistry || [],
        selectedList,
        khmdhsRegistryModal.chainFetchedAt
      ),
      ...(neverAsk ? { khmdhsDocumentRegistryDismissed: true } : {}),
      updatedAt: new Date().toISOString(),
      __expectedUpdatedAt: base.updatedAt || '',
    };
    try {
      const saveRes = await ipcRenderer.invoke('save-project-data', updated);
      if (!saveRes?.success) {
        showToast(saveRes?.error || saveRes?.conflict
          ? 'Τα δεδομένα άλλαξαν από άλλον χρήστη. Ανανεώστε πριν ξαναδοκιμάσετε.'
          : 'Αποτυχία αποθήκευσης.', 'error');
        return;
      }
      showToast('Τα έγγραφα καταγράφηκαν στα αρχεία υποέργου.', 'success');
      if (typeof onRefreshProject === 'function') {
        await onRefreshProject();
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα αποθήκευσης.', 'error');
    }
  }, [khmdhsRegistryModal, showToast, onRefreshProject]);

  const handleKhmdhsRegistryDismiss = useCallback(() => {
    setKhmdhsRegistryModal(null);
  }, []);

  const subprojectTitle = project?.subprojectTitle || project?.projectTitle || '';

  const loadEpLinks = useCallback(async () => {
    if (!project?.subprojectId) return;
    setEpLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-ep-actions-for-subproject', {
        subprojectId: project.subprojectId,
        requestingUsername
      });
      if (res.success) setEpLinkedActions(res.actions || []);
    } catch (e) {}
    finally { setEpLoading(false); }
  }, [project?.subprojectId, requestingUsername]);

  useEffect(() => { loadEpLinks(); }, [loadEpLinks]);

  const openEpPicker = async () => {
    setEpPickerSearch(subprojectTitle);
    setEpPickerError('');
    setEpPickerProgram(null);
    setShowEpPicker(true);
    setEpPickerLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-ep-program', { requestingUsername });
      if (!res.success) {
        setEpPickerError(res.error || 'Σφάλμα φόρτωσης Επιχειρησιακού Προγράμματος');
        setEpPickerProgram(null);
      } else if (!res.program) {
        setEpPickerError('Δεν υπάρχει ενεργό Επιχειρησιακό Πρόγραμμα.');
        setEpPickerProgram(null);
      } else {
        setEpPickerProgram(res.program);
      }
    } catch (e) {
      setEpPickerError(e.message || 'Σφάλμα φόρτωσης');
      setEpPickerProgram(null);
    } finally {
      setEpPickerLoading(false);
    }
  };

  const handleEpLink = async (action) => {
    setEpLinkLoading(true);
    try {
      const res = await ipcRenderer.invoke('link-ep-subproject', {
        programId: action.programId || epPickerProgram?.id,
        actionId: action.id,
        subprojectId: project.subprojectId,
        link: true,
        requestingUsername
      });
      if (res?.success === false) {
        showToast(res.error || 'Σφάλμα σύνδεσης', 'error');
        return;
      }
      setShowEpPicker(false);
      await loadEpLinks();
      if (typeof onEpLinksChanged === 'function') onEpLinksChanged();
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      showToast(e.message || 'Σφάλμα σύνδεσης', 'error');
    } finally {
      setEpLinkLoading(false);
    }
  };

  const handleEpUnlink = async (action) => {
    setEpLinkLoading(true);
    try {
      const res = await ipcRenderer.invoke('link-ep-subproject', {
        programId: action.programId,
        actionId: action.id,
        subprojectId: project.subprojectId,
        link: false,
        requestingUsername
      });
      if (res?.success === false) {
        showToast(res.error || 'Σφάλμα αποσύνδεσης', 'error');
        return;
      }
      await loadEpLinks();
      if (typeof onEpLinksChanged === 'function') onEpLinksChanged();
      if (typeof onRefreshProject === 'function') await onRefreshProject();
    } catch (e) {
      showToast(e.message || 'Σφάλμα αποσύνδεσης', 'error');
    } finally {
      setEpLinkLoading(false);
    }
  };

  const epPickerRanked = useMemo(() => {
    if (!epPickerProgram) return { suggestions: [], searchResults: [], showAll: false };
    const linkedIds = epLinkedActions.map(a => a.id);
    const query = epPickerSearch.trim();
    const hasQuery = query.length > 0;

    const suggestions = filterAndRankEpActions({
      actions: epPickerProgram.actions || [],
      subprojectTitle,
      searchQuery: '',
      linkedActionIds: linkedIds,
      showAllWhenEmpty: false,
      limit: 15
    });

    const searchResults = hasQuery
      ? filterAndRankEpActions({
          actions: epPickerProgram.actions || [],
          subprojectTitle,
          searchQuery: query,
          linkedActionIds: linkedIds,
          showAllWhenEmpty: false,
          limit: 80
        })
      : [];

    const showAll = hasQuery && searchResults.length === 0;

    return { suggestions, searchResults, showAll, hasQuery };
  }, [epPickerProgram, epPickerSearch, epLinkedActions, subprojectTitle]);

  const epPickerShowAll = useMemo(() => {
    if (!epPickerProgram || !epPickerRanked.showAll) return [];
    const linkedIds = epLinkedActions.map(a => a.id);
    return filterAndRankEpActions({
      actions: epPickerProgram.actions || [],
      subprojectTitle: '',
      searchQuery: '',
      linkedActionIds: linkedIds,
      showAllWhenEmpty: true,
      limit: 40
    });
  }, [epPickerProgram, epPickerRanked.showAll, epLinkedActions]);

  useEffect(() => {
    lockBodyScroll('subdetail');
    return () => {
      unlockBodyScroll('subdetail');
    };
  }, []);

  const { displayChargePrimary, displayChargeParticipants } = useMemo(
    () => getProjectChargeDisplay(project, engineerCatalog),
    [project, engineerCatalog]
  );

  const coFinancedRows = useMemo(() => getVisibleFundingSourceRows(project), [project]);
  const showCoFinancing = isCoFinancedProject(project) && coFinancedRows.length > 0;

  const khmdhsEntries = useMemo(() => getKhmdhsDisplayEntries(project), [project]);
  const hasKhmdhsSection = useMemo(
    () => projectHasKhmdhsFormResults(project) || khmdhsEntries.length > 0,
    [project, khmdhsEntries.length]
  );

  const paymentTotals = useMemo(
    () => (project ? buildKhmdhsPaymentsTotals(project) : null),
    [project]
  );

  const totalApeAmount = useMemo(() => {
    if (!project) return 0;
    const parseAmt = (v) => {
      const n = parseFloat(String(v || '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    if (isMultipleContractsForm(project.implementationForm)) {
      return (project.contracts || []).reduce((s, c) => s + parseAmt(c?.apeAmount), 0);
    }
    return parseAmt(project.apeAmount);
  }, [project]);

  const totalSupplementaryAmount = useMemo(() => {
    if (!project?.hasSupplementaryContracts || !Array.isArray(project.supplementaryContracts)) return 0;
    return sumNonExtensionSupplementaryGross(project);
  }, [project]);

  useEffect(() => {
    if (!project?.subprojectId) return;
    // Ωρίμανση → Α· αλλιώς Β μόνο αν έχει ήδη γίνει αρχική ανάκτηση ΚΗΜΔΗΣ
    setActivePhaseTab(getDefaultSubprojectPhaseTab(project));
    // Μόνο στο άνοιγμα / αλλαγή υποέργου — όχι σε κάθε ανανέωση δεδομένων όσο είναι ανοιχτό το modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.subprojectId]);

  if (!project) return null;

  const formatAmount = (amount) => {
    if (!amount) return null;
    return `${amount} €`;
  };

  const formatDate = (dateString) => formatDateEl(dateString, null);

  const val = (v) => v && v.toString().trim() ? v : null;

  const hasContractInfo = isMultipleContractsForm(project.implementationForm)
    ? (project.contracts && project.contracts.length > 0)
    : (project.contractDate || project.contractAmount);

  const hasKhmdhsContractPanels = khmdhsEntries.length > 0;

  const showAssignmentProcedure = statusShowsAssignmentProcedure(project.projectStatus);
  const showContractProcessDate = showAssignmentProcedure;

  const hasApeOrComments = isMultipleContractsForm(project.implementationForm)
    ? (project.contracts || []).some((_, index) => (
      hasApeEntryData(project, { kind: 'contract', arrayIndex: index })
    ))
    : hasApeEntryData(project, { kind: 'contract', arrayIndex: 0 });

  const hasSupplementaryContracts = !!(
    project.hasSupplementaryContracts
    && Array.isArray(project.supplementaryContracts)
    && project.supplementaryContracts.length > 0
  );

  const showManualSupplementary = hasSupplementaryContracts
    && !(hasKhmdhsContractPanels && projectHasKhmdhsDerivedSupplementary(project));

  const manualAssignmentProcedure = showAssignmentProcedure && getProjectAssignmentProcedure(project);

  const showManualProcedureBlock = !!(
    manualAssignmentProcedure
    || (showContractProcessDate && getProjectContractProcessStartDate(project))
  );

  const showContractSection = hasKhmdhsContractPanels
    ? (hasApeOrComments || showManualSupplementary || showManualProcedureBlock)
    : (hasContractInfo || hasSupplementaryContracts || showManualProcedureBlock);

  const contractSectionTitle = hasKhmdhsContractPanels
    ? 'ΑΠΕ & Στοιχεία ΕΦΑΡΜΟΓΗΣ'
    : 'Στοιχεία Σύμβασης';

  const totalContractAmount = getTotalContractAmount(project);

  const multipleAle = project.aleCodes && project.aleCodes.length > 1;
  const hasKhmdhsFormResults = projectHasKhmdhsFormResults(project);

  const renderDetailApeSection = () => {
    if (!hasKhmdhsContractPanels) return undefined;
    if (!hasApeOrComments && !showManualSupplementary) return undefined;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#059669', letterSpacing: '0.01em' }}>
          💡 ΑΠΕ & Συμπληρωματικά
        </div>
        {project.implementationForm === 'Μια Σύμβαση' && (project.apeAmount || project.apeComments) && (
          <FieldGrid>
            {project.apeAmount && (
              <Field>
                <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                <FieldValue><AmountValue>{formatAmount(project.apeAmount)}</AmountValue></FieldValue>
              </Field>
            )}
            {project.apeComments && (
              <FieldFull>
                <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                <FieldValue>{project.apeComments}</FieldValue>
              </FieldFull>
            )}
          </FieldGrid>
        )}
        {project.implementationForm !== 'Μια Σύμβαση' && (project.contracts || []).map((contract, index) => {
          const apeFields = readContractApeFields(project, index);
          const apeNote = String(contract?.apeComments || apeFields.comments || '').trim();
          const hasLocal = String(contract?.apeAmount || '').trim() || apeNote;
          if (!hasLocal) return null;
          return (
            <ContractBox key={index}>
              <ContractBoxTitle>Σύμβαση {index + 1} — ΑΠΕ / Σχόλια</ContractBoxTitle>
              <FieldGrid>
                {contract.apeAmount && (
                  <Field>
                    <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                    <FieldValue><AmountValue>{formatAmount(contract.apeAmount)}</AmountValue></FieldValue>
                  </Field>
                )}
                {apeNote && (
                  <FieldFull>
                    <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                    <FieldValue>{apeNote}</FieldValue>
                  </FieldFull>
                )}
              </FieldGrid>
            </ContractBox>
          );
        })}
        {showManualSupplementary && project.supplementaryContracts.map((contract, index) => {
          const suppApe = readSupplementaryApeFields(project, index);
          return (
          <SupplementaryBox key={index}>
            <ContractBoxTitle style={{ color: '#16a34a' }}>Συμπληρωματική Σύμβαση {index + 1}</ContractBoxTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                <FieldValue style={{ color: '#16a34a', fontWeight: 700 }}>
                  {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Ποσό</FieldLabel>
                <FieldValue>
                  {formatAmount(contract.amount)
                    ? <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              {suppApe.comments && (
                <FieldFull>
                  <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                  <FieldValue>{suppApe.comments}</FieldValue>
                </FieldFull>
              )}
            </FieldGrid>
          </SupplementaryBox>
          );
        })}
      </div>
    );
  };

  const renderPhaseBContractExtras = () => {
    if (!showContractSection || hasKhmdhsContractPanels) return null;
    return (
      <SectionBlock icon="📝" title={contractSectionTitle} accent={ACCENTS.contract}>
        {showManualProcedureBlock && (
          <FieldGrid style={{ marginBottom: '1rem' }}>
            {manualAssignmentProcedure && (
              <Field>
                <FieldLabel>Διαδικασία Ανάθεσης</FieldLabel>
                <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                  {getProjectAssignmentProcedure(project)}
                </FieldValue>
              </Field>
            )}
            {showContractProcessDate && getProjectContractProcessStartDate(project) && (
              <Field>
                <FieldLabel>Ημερ. Έναρξης Διαδικασίας</FieldLabel>
                <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                  {formatDate(getProjectContractProcessStartDate(project))}
                </FieldValue>
              </Field>
            )}
          </FieldGrid>
        )}
        {project.implementationForm === 'Μια Σύμβαση' && (
          <ContractBox>
            <ContractBoxTitle>Σύμβαση</ContractBoxTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                  {formatDate(project.contractDate) || <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Ποσό Σύμβασης</FieldLabel>
                <FieldValue>
                  {formatAmount(project.contractAmount)
                    ? <AmountValue>{formatAmount(project.contractAmount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              {project.apeAmount && (
                <Field>
                  <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                  <FieldValue><AmountValue>{formatAmount(project.apeAmount)}</AmountValue></FieldValue>
                </Field>
              )}
              {project.apeComments && (
                <Field>
                  <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                  <FieldValue>{project.apeComments}</FieldValue>
                </Field>
              )}
            </FieldGrid>
          </ContractBox>
        )}
        {project.implementationForm !== 'Μια Σύμβαση' && (project.contracts || []).map((contract, index) => {
          const apeFields = readContractApeFields(project, index);
          const apeNote = String(contract?.apeComments || apeFields.comments || '').trim();
          return (
          <ContractBox key={index}>
            <ContractBoxTitle>Σύμβαση {index + 1}</ContractBoxTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                  {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Ποσό</FieldLabel>
                <FieldValue>
                  {formatAmount(contract.amount)
                    ? <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              {contract.apeAmount && (
                <Field>
                  <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                  <FieldValue><AmountValue>{formatAmount(contract.apeAmount)}</AmountValue></FieldValue>
                </Field>
              )}
              {apeNote && (
                <FieldFull>
                  <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                  <FieldValue>{apeNote}</FieldValue>
                </FieldFull>
              )}
            </FieldGrid>
          </ContractBox>
          );
        })}
        {showManualSupplementary && project.supplementaryContracts.map((contract, index) => {
          const suppApe = readSupplementaryApeFields(project, index);
          return (
          <SupplementaryBox key={index}>
            <ContractBoxTitle style={{ color: '#16a34a' }}>Συμπληρωματική Σύμβαση {index + 1}</ContractBoxTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                <FieldValue style={{ color: '#16a34a', fontWeight: 700 }}>
                  {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Ποσό</FieldLabel>
                <FieldValue>
                  {formatAmount(contract.amount)
                    ? <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              {suppApe.comments && (
                <FieldFull>
                  <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                  <FieldValue>{suppApe.comments}</FieldValue>
                </FieldFull>
              )}
              {contract.comments && !suppApe.comments && (
                <FieldFull>
                  <FieldLabel>Σχόλια</FieldLabel>
                  <FieldValue>{contract.comments}</FieldValue>
                </FieldFull>
              )}
            </FieldGrid>
          </SupplementaryBox>
          );
        })}
        {totalContractAmount > 0 && (
          <TotalBox>
            <span style={{ fontWeight: 800, color: '#2563eb' }}>ΣΥΝΟΛΟ ΣΥΜΒΑΣΕΩΝ</span>
            <AmountValue style={{ color: '#2563eb', fontSize: '1.05rem' }}>
              {totalContractAmount.toLocaleString('el-GR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} €
            </AmountValue>
          </TotalBox>
        )}
      </SectionBlock>
    );
  };

  return (
    <Overlay data-subproject-detail-modal onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        {/* Header */}
        <ModalHeader>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', width: '100%' }}>
            <HeaderLeft>
              <ProjectTitleSmall>📁 {project.projectTitle}</ProjectTitleSmall>
              <SubprojectTitleLarge>{project.subprojectTitle}</SubprojectTitleLarge>
              <HeaderBadges>
                {project.implementationForm && (
                  <HeaderMetaBadge>{project.implementationForm}</HeaderMetaBadge>
                )}
                {project.projectStatus && (
                  <HeaderMetaBadge>{project.projectStatus}</HeaderMetaBadge>
                )}
                {actRootSiblings.length > 0 && (
                  <HeaderMetaBadge title={actRootSiblings.map((s) => s.subprojectTitle).join('\n')}>
                    Κοινή πράξη · {actRootSiblings.length + 1} υποέργα
                  </HeaderMetaBadge>
                )}
              </HeaderBadges>
            </HeaderLeft>
            <HeaderActions>
              {userRole !== 'USER' && (
                <HeaderEditBtn
                  type="button"
                  disabled={isLocked}
                  title={isLocked ? (lockedBy ? `Κλειδωμένο από: ${lockedBy}` : 'Κλειδωμένο') : 'Επεξεργασία υποέργου'}
                  onClick={() => { onClose(); onEdit(project); }}
                >
                  {isLocked ? '🔒 Κλειδωμένο' : '✏️ Επεξεργασία'}
                </HeaderEditBtn>
              )}
              <CloseButton type="button" onClick={onClose} title="Κλείσιμο" aria-label="Κλείσιμο">×</CloseButton>
            </HeaderActions>
          </div>
          <PhaseTabRow>
            <PhaseTabStrip>
              <PhaseTab
                type="button"
                $active={activePhaseTab === 'A'}
                onClick={() => setActivePhaseTab('A')}
              >
                <PhaseTabDot $color="#4ade80" />
                Α — Στοιχεία
              </PhaseTab>
              <PhaseTab
                type="button"
                $active={activePhaseTab === 'B'}
                onClick={() => setActivePhaseTab('B')}
              >
                <PhaseTabDot $color={hasKhmdhsFormResults ? '#4ade80' : 'rgba(255,255,255,0.45)'} />
                Β — ΚΗΜΔΗΣ & Σύμβαση
              </PhaseTab>
            </PhaseTabStrip>
            {khmdhsRefresh.showCardRefreshButton(canRefreshKhmdhs, hasKhmdhsFormResults || hasKhmdhsRefreshSeed) && (
              <KhmdhsRefreshActionButton
                onClick={handleStartKhmdhsRefresh}
                loading={refreshLoading}
                disabled={isLocked}
                freshness={chainFreshness}
                progressMessage={refreshProgress}
                title={isLocked
                  ? (lockedBy ? `Κλειδωμένο από: ${lockedBy}` : 'Το υποέργο είναι κλειδωμένο')
                  : undefined}
              />
            )}
          </PhaseTabRow>
        </ModalHeader>

        <ModalBody $phaseB={activePhaseTab === 'B'}>
        <ModalBodyInner $phaseB={activePhaseTab === 'B'}>

          {directAssignmentViolations.length > 0 && (
            <AlertBanner>
              <AlertBannerTitle>⚠️ Προειδοποίηση — Κανόνας 12 μηνών (απευθείας ανάθεση)</AlertBannerTitle>
              {directAssignmentViolations.map((v, idx) => (
                <AlertBannerItem key={idx}>
                  {formatViolationSummary(v)}
                </AlertBannerItem>
              ))}
            </AlertBanner>
          )}

          {activePhaseTab === 'A' && (
          <>
          <HeroStrip>
            <HeroChip $border="rgba(99, 102, 241, 0.25)">
              <HeroChipLabel>Κατάσταση</HeroChipLabel>
              <HeroChipValue>
                {project.projectStatus
                  ? <StatusBadge status={project.projectStatus}>{project.projectStatus}</StatusBadge>
                  : <EmptyValue>—</EmptyValue>}
              </HeroChipValue>
            </HeroChip>
            <HeroChip>
              <HeroChipLabel>Είδος</HeroChipLabel>
              <HeroChipValue>
                {project.projectType
                  ? <TypeBadge type={project.projectType}>{normalizeProjectType(project.projectType)}</TypeBadge>
                  : <EmptyValue>—</EmptyValue>}
              </HeroChipValue>
            </HeroChip>
            {formatAmount(project.projectBudget) && (
              <HeroChip $border="rgba(16, 185, 129, 0.3)">
                <HeroChipLabel>Προϋπολογισμός</HeroChipLabel>
                <HeroChipValue $strong $large $color="#059669">
                  {formatAmount(project.projectBudget)}
                </HeroChipValue>
              </HeroChip>
            )}
            {totalContractAmount > 0 && (
              <HeroChip $border="rgba(37, 99, 235, 0.28)">
                <HeroChipLabel>Σύνολο συμβάσεων</HeroChipLabel>
                <HeroChipValue $strong $color="#2563eb">
                  {totalContractAmount.toLocaleString('el-GR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} €
                </HeroChipValue>
              </HeroChip>
            )}
          </HeroStrip>

          <SectionBlock icon="📋" title="Βασικά Στοιχεία" accent={ACCENTS.basic}>
            <BasicSplitGrid>
              <BasicColumn>
                <Field>
                  <FieldLabel>Μορφή Υλοποίησης</FieldLabel>
                  <FieldValue>{val(project.implementationForm) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                {project.misPraxhsName && project.misPraxhsCode && (
                  <Field>
                    <FieldLabel>{project.misPraxhsName}</FieldLabel>
                    <FieldValue>{project.misPraxhsCode}</FieldValue>
                  </Field>
                )}
              </BasicColumn>
              <BasicColumn>
                {displayChargePrimary && (
                  <Field>
                    <FieldLabel>Επιβλέπων</FieldLabel>
                    <FieldValue style={{ fontWeight: 700, color: '#4338ca', whiteSpace: 'pre-wrap' }}>
                      {displayChargePrimary}
                    </FieldValue>
                  </Field>
                )}
                {displayChargeParticipants && (
                  <Field>
                    <FieldLabel>Βοηθούν στην επίβλεψη</FieldLabel>
                    <FieldValue style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>
                      {displayChargeParticipants}
                    </FieldValue>
                  </Field>
                )}
                {getProjectAssignmentProcedure(project) && (
                  <Field>
                    <FieldLabel>Διαδικασία ανάθεσης</FieldLabel>
                    <FieldValue style={{ color: '#047857', fontWeight: 700 }}>
                      {getProjectAssignmentProcedure(project)}
                    </FieldValue>
                  </Field>
                )}
              </BasicColumn>
            </BasicSplitGrid>
          </SectionBlock>

          <SectionBlock icon="🔢" title="Κωδικοί" accent={ACCENTS.codes}>
            <FieldGrid>
              <Field>
                <FieldLabel>Κωδικός ΚΑ</FieldLabel>
                <FieldValue>
                  {val(project.kaCode)
                    ? <CodePill>{project.kaCode}</CodePill>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Κωδικοί Α.Λ.Ε.</FieldLabel>
                <FieldValue>
                  {project.aleCodes && project.aleCodes.filter(c => c && c.trim()).length > 0
                    ? project.aleCodes.filter(c => c && c.trim()).map((code, i) => (
                        <CodePill key={i}>{code}</CodePill>
                      ))
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
            </FieldGrid>
          </SectionBlock>

          <SectionBlock
            icon="💰"
            title={showCoFinancing ? 'Χρηματοδότηση · Συγχρηματοδότηση' : 'Χρηματοδότηση'}
            accent={ACCENTS.funding}
          >
            {showCoFinancing ? (
              <>
                {coFinancedRows.map((row, idx) => (
                  <FieldGrid
                    key={`fund-detail-${idx}`}
                    style={{
                      marginBottom: '0.85rem',
                      paddingBottom: '0.85rem',
                      borderBottom: '1px solid rgba(5,150,105,0.15)',
                    }}
                  >
                    <Field>
                      <FieldLabel>
                        Πηγή {coFinancedRows.length > 1 ? idx + 1 : ''}
                        {row.ownResources ? ' (ίδιοι πόροι)' : ''}
                      </FieldLabel>
                      <FieldValue>{val(row.source) || <EmptyValue>—</EmptyValue>}</FieldValue>
                    </Field>
                    <Field>
                      <FieldLabel>Εξειδίκευση</FieldLabel>
                      <FieldValue>{val(row.details) || <EmptyValue>—</EmptyValue>}</FieldValue>
                    </Field>
                    <Field>
                      <FieldLabel>Ποσό</FieldLabel>
                      <FieldValue>
                        {formatAmount(row.amount)
                          ? (
                            <AmountValue style={row.ownResources ? { color: '#b45309' } : undefined}>
                              {formatAmount(row.amount)}
                            </AmountValue>
                          )
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </Field>
                  </FieldGrid>
                ))}
                <FieldGrid>
                  <Field>
                    <FieldLabel>Εγκεκριμένο Ποσό (σύνολο)</FieldLabel>
                    <FieldValue>
                      {formatAmount(project.approvedAmount)
                        ? <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
                        : <EmptyValue>—</EmptyValue>}
                    </FieldValue>
                  </Field>
                  <Field>
                    <FieldLabel>Προϋπολογισμός Έργου</FieldLabel>
                    <FieldValue>
                      {formatAmount(project.projectBudget)
                        ? <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
                        : <EmptyValue>—</EmptyValue>}
                    </FieldValue>
                  </Field>
                </FieldGrid>
              </>
            ) : (
              <FieldGrid>
                <Field>
                  <FieldLabel>Βασική Πηγή</FieldLabel>
                  <FieldValue>{val(project.fundingSource) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Εξειδίκευση</FieldLabel>
                  <FieldValue>{val(project.fundingDetails) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Εγκεκριμένο Ποσό</FieldLabel>
                  <FieldValue>
                    {formatAmount(project.approvedAmount)
                      ? <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Προϋπολογισμός Έργου</FieldLabel>
                  <FieldValue>
                    {formatAmount(project.projectBudget)
                      ? <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
              </FieldGrid>
            )}
          </SectionBlock>

          {(project.remainingAmount || (project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a))) && (
            <SectionBlock icon="📊" title={`Υπόλοιπα Έτους ${project.remainingAmountYear || '—'}`} accent={ACCENTS.remaining}>
              {multipleAle && project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a) ? (
                <div>
                  {project.aleCodes.map((code, i) => (
                    <AleRemainingRow key={i}>
                      <AleBadge>{code || `Α.Λ.Ε. ${i + 1}`}</AleBadge>
                      <FieldValue>
                        {project.aleRemainingAmounts[i]
                          ? <AmountValue>{project.aleRemainingAmounts[i]} €</AmountValue>
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </AleRemainingRow>
                  ))}
                  {project.remainingAmount && (
                    <TotalBox style={{ marginTop: '0.65rem' }}>
                      <span style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.85rem' }}>ΣΥΝΟΛΟ</span>
                      <AmountValue style={{ color: '#7c3aed', fontSize: '1.05rem' }}>
                        {project.remainingAmount} €
                      </AmountValue>
                    </TotalBox>
                  )}
                </div>
              ) : (
                <FieldGrid>
                  <Field>
                    <FieldLabel>Ποσό Υπολοίπων</FieldLabel>
                    <FieldValue>
                      {formatAmount(project.remainingAmount)
                        ? <AmountValue>{formatAmount(project.remainingAmount)}</AmountValue>
                        : <EmptyValue>—</EmptyValue>}
                    </FieldValue>
                  </Field>
                </FieldGrid>
              )}
              {project.remainingAmountComments && (
                <TextBlock style={{ marginTop: '0.65rem' }}>
                  {project.remainingAmountComments}
                </TextBlock>
              )}
            </SectionBlock>
          )}

          {project.comments && (
            <SectionBlock icon="💬" title="Σχόλια" accent={ACCENTS.comments}>
              <TextBlock>{project.comments}</TextBlock>
            </SectionBlock>
          )}

          {project.eisigitikiEkthesi && (
            <SectionBlock icon="📑" title="Αναφορά από πρόγραμμα Οικονομικής" accent={ACCENTS.comments}>
              <TextBlock>{project.eisigitikiEkthesi}</TextBlock>
            </SectionBlock>
          )}

          <SectionBlock icon="🗺️" title="Επιχειρησιακό Πρόγραμμα" accent={ACCENTS.ep}>
            {epLoading ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Φόρτωση...</div>
            ) : epLinkedActions.length === 0 ? (
              <TextBlock style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                Δεν έχει συνδεθεί με δράση Επιχειρησιακού Προγράμματος.
              </TextBlock>
            ) : (
              epLinkedActions.map(action => (
                <EpActionChip key={action.id}>
                  <EpActionChipCode>#{action.aa}</EpActionChipCode>
                  <div style={{ flex: 1 }}>
                    <EpActionChipTitle>{action.title}</EpActionChipTitle>
                    <EpActionChipMeta>
                      {[action.axisCode, action.measureCode, action.objectiveCode].filter(Boolean).join(' › ')}
                      {action.actionType && ` · ${action.actionType}`}
                    </EpActionChipMeta>
                    <div style={{ fontSize: 11, color: '#6b7fa3', marginTop: 2 }}>{action.programTitle}</div>
                  </div>
                  {canManageEp && (
                    <EpUnlinkBtn onClick={() => handleEpUnlink(action)} disabled={epLinkLoading}>
                      Αποσύνδεση
                    </EpUnlinkBtn>
                  )}
                </EpActionChip>
              ))
            )}
            {canManageEp && (
              <EpLinkBtn onClick={openEpPicker} disabled={epLinkLoading}>
                🔗 Σύνδεση με Δράση ΕΠ
              </EpLinkBtn>
            )}
          </SectionBlock>

          {/* EP Picker Modal */}
          {showEpPicker && (
            <EpPickerOverlay onClick={e => e.target === e.currentTarget && !epLinkLoading && setShowEpPicker(false)}>
              <EpPickerBox onClick={e => e.stopPropagation()}>
                <EpPickerHeader>
                  <EpPickerHeaderRow>
                    <EpPickerTitle>🗺️ Επιλογή Δράσης Επιχειρησιακού Προγράμματος</EpPickerTitle>
                    <EpPickerClose onClick={() => !epLinkLoading && setShowEpPicker(false)}>✕</EpPickerClose>
                  </EpPickerHeaderRow>
                  {epPickerProgram && (
                    <EpPickerSubtitle>
                      {epPickerProgram.title} · {(epPickerProgram.actions || []).length} δράσεις
                    </EpPickerSubtitle>
                  )}
                </EpPickerHeader>

                <EpPickerContext>
                  Σύνδεση υποέργου: <strong>{subprojectTitle || '—'}</strong>
                  <br />
                  Η αναζήτηση συγκρίνει τον τίτλο του υποέργου με τους τίτλους δράσεων του ενεργού ΕΠ.
                </EpPickerContext>

                <EpPickerSearchWrap>
                  <EpPickerSearch
                    autoFocus
                    placeholder="Αναζήτηση σε τίτλο δράσης, κωδικό, χωροθέτηση..."
                    value={epPickerSearch}
                    onChange={e => setEpPickerSearch(e.target.value)}
                  />
                  <EpPickerSearchHint>
                    {epPickerSearch.trim()
                      ? 'Εμφανίζονται δράσεις που ταιριάζουν με την αναζήτηση και/ή τον τίτλο υποέργου.'
                      : 'Προ-συμπληρώθηκε ο τίτλος υποέργου — επεξεργαστεί τον για πιο στοχευμένα αποτελέσματα.'}
                  </EpPickerSearchHint>
                </EpPickerSearchWrap>

                <EpPickerList>
                  {epPickerLoading && (
                    <EpPickerEmpty>⏳ Φόρτωση δράσεων Επιχειρησιακού Προγράμματος...</EpPickerEmpty>
                  )}

                  {!epPickerLoading && epPickerError && (
                    <EpPickerEmpty>⚠️ {epPickerError}</EpPickerEmpty>
                  )}

                  {!epPickerLoading && !epPickerError && epPickerProgram && (
                    <>
                      {!epPickerRanked.hasQuery && epPickerRanked.suggestions.length > 0 && (
                        <>
                          <EpPickerSectionLabel>Προτεινόμενες βάσει τίτλου υποέργου</EpPickerSectionLabel>
                          {epPickerRanked.suggestions.map(({ action, matchLabel }) => (
                            <EpPickerResultRow
                              key={`sug-${action.id}`}
                              action={action}
                              subprojectTitle={subprojectTitle}
                              searchQuery={epPickerSearch}
                              matchLabel={matchLabel}
                              highlight
                              disabled={epLinkLoading}
                              onSelect={() => handleEpLink(action)}
                            />
                          ))}
                        </>
                      )}

                      {epPickerRanked.hasQuery && epPickerRanked.searchResults.length > 0 && (
                        <>
                          <EpPickerSectionLabel>
                            Αποτελέσματα αναζήτησης ({epPickerRanked.searchResults.length})
                          </EpPickerSectionLabel>
                          {epPickerRanked.searchResults.map(({ action, matchLabel }) => (
                            <EpPickerResultRow
                              key={`res-${action.id}`}
                              action={action}
                              subprojectTitle={subprojectTitle}
                              searchQuery={epPickerSearch}
                              matchLabel={matchLabel}
                              highlight={!!matchLabel}
                              disabled={epLinkLoading}
                              onSelect={() => handleEpLink(action)}
                            />
                          ))}
                        </>
                      )}

                      {epPickerRanked.hasQuery && epPickerRanked.searchResults.length === 0 && (
                        <>
                          <EpPickerEmpty>
                            Δεν βρέθηκαν δράσεις που να ταιριάζουν με «{epPickerSearch.trim()}».
                            <br />
                            Δοκιμάστε λιγότερες ή διαφορετικές λέξεις από τον τίτλο του υποέργου.
                          </EpPickerEmpty>
                          {epPickerShowAll.length > 0 && (
                            <>
                              <EpPickerSectionLabel>Όλες οι διαθέσιμες δράσεις</EpPickerSectionLabel>
                              {epPickerShowAll.map(({ action }) => (
                                <EpPickerResultRow
                                  key={`all-${action.id}`}
                                  action={action}
                                  subprojectTitle={subprojectTitle}
                                  searchQuery=""
                                  matchLabel={null}
                                  highlight={false}
                                  disabled={epLinkLoading}
                                  onSelect={() => handleEpLink(action)}
                                />
                              ))}
                            </>
                          )}
                        </>
                      )}

                      {!epPickerRanked.hasQuery && epPickerRanked.suggestions.length === 0 && (
                        <EpPickerEmpty>
                          Δεν βρέθηκαν προτεινόμενες δράσεις για αυτόν τον τίτλο υποέργου.
                          <br />
                          Πληκτρολογήστε λέξεις-κλειδιά για χειροκίνητη αναζήτηση.
                        </EpPickerEmpty>
                      )}
                    </>
                  )}
                </EpPickerList>
              </EpPickerBox>
            </EpPickerOverlay>
          )}

          {portalCatalog.showPortalCardSection(portalEnabled) && (() => {
            const portalStatus = portalCatalog.resolvePortalCardStatus({
              selectedForNext: isPublishedToPortal,
              lastExported: isLiveOnPortal,
            });
            return (
            <SectionBlock icon="🌐" title="Πύλη Διαφάνειας" accent={ACCENTS.portal}>
              <PortalToggleCard $published={portalStatus.selectedForNext}>
                <div>
                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: portalStatus.liveOnPortal ? '#166534' : (portalStatus.selectedForNext ? '#1d4ed8' : '#475569'),
                    marginBottom: 4
                  }}>
                    {portalStatus.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    {portalStatus.hint}
                  </div>
                </div>
                {typeof onTogglePortal === 'function' && portalCatalog.canTogglePortalOnCard(userRole) && (
                  <PortalToggleBtn
                    type="button"
                    $published={portalStatus.selectedForNext}
                    onClick={() => onTogglePortal(project.subprojectId)}
                  >
                    {portalStatus.button}
                  </PortalToggleBtn>
                )}
              </PortalToggleCard>
            </SectionBlock>
            );
          })()}

          </>
          )}

          {activePhaseTab === 'B' && (
          <>
            {(hasKhmdhsFormResults || totalContractAmount > 0 || paymentTotals?.count > 0) && (
              <HeroStrip>
                {khmdhsEntries.length > 0 && (
                  <HeroChip>
                    <HeroChipLabel>Συμβάσεις ΚΗΜΔΗΣ</HeroChipLabel>
                    <HeroChipValue $strong>{khmdhsEntries.length}</HeroChipValue>
                  </HeroChip>
                )}
                {totalContractAmount > 0 && (
                  <HeroChip $border="rgba(37, 99, 235, 0.28)">
                    <HeroChipLabel>Αρχικές συμβάσεις</HeroChipLabel>
                    <HeroChipValue $strong $color="#2563eb">
                      {totalContractAmount.toLocaleString('el-GR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €
                    </HeroChipValue>
                  </HeroChip>
                )}
                {totalApeAmount > 0 && (
                  <HeroChip $border="rgba(5, 150, 105, 0.28)">
                    <HeroChipLabel>ΑΠΕ / Συμπλ. αξία</HeroChipLabel>
                    <HeroChipValue $strong $color="#047857">
                      {totalApeAmount.toLocaleString('el-GR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €
                    </HeroChipValue>
                  </HeroChip>
                )}
                {totalSupplementaryAmount > 0 && (
                  <HeroChip $border="rgba(16, 185, 129, 0.22)">
                    <HeroChipLabel>Συμπλ. συμβάσεις</HeroChipLabel>
                    <HeroChipValue $strong $color="#15803d">
                      {totalSupplementaryAmount.toLocaleString('el-GR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} €
                    </HeroChipValue>
                  </HeroChip>
                )}
                {paymentTotals?.count > 0 && (
                  <HeroChip $border="rgba(16, 185, 129, 0.3)">
                    <HeroChipLabel>Εντάλματα πληρωμής</HeroChipLabel>
                    <HeroChipValue $strong $color="#059669">
                      {paymentTotals.count}
                      {paymentTotals.displayTotalGross != null && (
                        <> · {paymentTotals.displayTotalGross.toLocaleString('el-GR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} €
                        {paymentTotals.hasUserClassification
                          && paymentTotals.rawTotalGross !== paymentTotals.countableTotalGross
                          ? ' (μετά χαρακτηρισμό)' : ''}
                        </>
                      )}
                    </HeroChipValue>
                  </HeroChip>
                )}
                {getProjectAssignmentProcedure(project) && (
                  <HeroChip $border="rgba(99, 102, 241, 0.28)">
                    <HeroChipLabel>Διαδικασία ανάθεσης</HeroChipLabel>
                    <HeroChipValue $strong $color="#4338ca" style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
                      {getProjectAssignmentProcedure(project)}
                    </HeroChipValue>
                  </HeroChip>
                )}
              </HeroStrip>
            )}

            <LifecycleRailWrap>
              <KhmdhsLifecycleRail
                project={project}
                variant="slim"
                graphMode="full"
                freshness={chainFreshness}
                showRefreshButton={false}
                onRefresh={handleStartKhmdhsRefresh}
                refreshLoading={refreshLoading}
              />
              {chainFreshness.level !== 'none' && chainFreshness.label ? (
                <FreshnessHint $level={chainFreshness.level}>
                  {chainFreshness.label}
                </FreshnessHint>
              ) : null}
              {snapshotInfo?.exists && !isLocked ? (
                <RestoreSnapshotBtn
                  type="button"
                  onClick={handleRestoreSnapshot}
                  disabled={restoring || refreshLoading}
                  title="Αναιρεί ό,τι έφερε η τελευταία ανανέωση ΚΗΜΔΗΣ"
                >
                  {restoring
                    ? 'Γίνεται επαναφορά…'
                    : `↩ Επαναφορά στην κατάσταση πριν την ανανέωση${
                      snapshotInfo.takenAt
                        ? ` (${new Date(snapshotInfo.takenAt).toLocaleDateString('el-GR')})`
                        : ''}`}
                </RestoreSnapshotBtn>
              ) : null}
              {confirmedStitchPlan ? (
                <div style={{
                  marginTop: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  fontSize: '0.72rem',
                  color: '#3730a3',
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '8px',
                  padding: '0.4rem 0.6rem',
                }}
                >
                  <span>
                    🧩 Τεχνητή αλυσίδα από {(confirmedStitchPlan.segments || []).length} κωδικούς ΚΗΜΔΗΣ —
                    οι ανανεώσεις χρησιμοποιούν όλους τους κωδικούς.
                  </span>
                  {canRefreshKhmdhs && !isLocked ? (
                    <button
                      type="button"
                      onClick={handleCancelStitchPlan}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#4338ca',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontFamily: 'inherit',
                        padding: 0,
                      }}
                    >
                      Κατάργηση
                    </button>
                  ) : null}
                </div>
              ) : null}
            </LifecycleRailWrap>

            {showManualProcedureBlock && (
              <SectionBlock icon="⚖️" title="Διαδικασία Ανάθεσης" accent={ACCENTS.khmdhs}>
                <FieldGrid>
                  {manualAssignmentProcedure && (
                    <Field>
                      <FieldLabel>Διαδικασία Ανάθεσης</FieldLabel>
                      <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                        {getProjectAssignmentProcedure(project)}
                      </FieldValue>
                    </Field>
                  )}
                  {showContractProcessDate && getProjectContractProcessStartDate(project) && (
                    <Field>
                      <FieldLabel>Ημερ. Έναρξης Διαδικασίας</FieldLabel>
                      <FieldValue style={{ color: '#4338ca', fontWeight: 700 }}>
                        {formatDate(getProjectContractProcessStartDate(project))}
                      </FieldValue>
                    </Field>
                  )}
                </FieldGrid>
              </SectionBlock>
            )}

            {hasKhmdhsFormResults ? (
              <KhmdhsFormStageResults
                project={project}
                apeSection={renderDetailApeSection()}
              />
            ) : (
              <PhaseBEmpty>
                <PhaseBEmptyIcon>🔗</PhaseBEmptyIcon>
                <PhaseBEmptyTitle>Δεν υπάρχουν δεδομένα ΚΗΜΔΗΣ</PhaseBEmptyTitle>
                <PhaseBEmptyText>
                  Δεν έχουν ανακτηθεί στοιχεία αλυσίδας για αυτό το υποέργο.
                  {' '}Ανοίξτε την επεξεργασία για νέα ανάκτηση από ΚΗΜΔΗΣ.
                </PhaseBEmptyText>
              </PhaseBEmpty>
            )}

            {renderPhaseBContractExtras()}
          </>
          )}

        </ModalBodyInner>
        </ModalBody>

        <DetailFooter>
          <FooterCloseBtn type="button" onClick={onClose}>Κλείσιμο</FooterCloseBtn>
          {typeof onOpenFileManager === 'function' && (
            <FooterFilesBtn type="button" onClick={() => onOpenFileManager()}>
              📁 Αρχεία υποέργου
            </FooterFilesBtn>
          )}
        </DetailFooter>
      </Modal>
      <KhmdhsChainRefreshDialog
        isOpen={!!refreshDialog}
        onClose={() => {
          if (refreshLoading) return;
          setRefreshDialog(null);
          void releaseKhmdhsRefreshLock();
        }}
        onConfirm={handleConfirmKhmdhsRefresh}
        saving={refreshLoading}
        seedAdam={refreshDialog?.seedAdam}
        seedLabel={refreshDialog?.seedLabel}
        changeLines={refreshDialog?.changeLines || []}
      />
      <KhmdhsContractExpiryPromptDialog
        isOpen={!!contractExpiryPrompt}
        prompt={contractExpiryPrompt}
        onDismiss={() => setContractExpiryPrompt(null)}
        onAccept={handleContractExpiryAccept}
      />
      <KhmdhsDocumentRegistryModal
        isOpen={!!khmdhsRegistryModal?.candidates?.length}
        candidates={khmdhsRegistryModal?.candidates || []}
        existing={khmdhsRegistryModal?.existing || []}
        onConfirm={handleKhmdhsRegistryConfirm}
        onDismiss={handleKhmdhsRegistryDismiss}
      />
      <KhmdhsSymvChainPlannerDialog
        isOpen={!!symvPlannerState?.open}
        chainRes={symvPlannerState?.chainRes || null}
        subprojectTitle={symvPlannerState?.subprojectTitle || ''}
        existingPlan={symvPlannerState?.existingPlan || null}
        onDismiss={() => {
          setSymvPlannerState(null);
          void releaseKhmdhsRefreshLock();
          showToast('Η ανανέωση ακυρώθηκε — δεν ορίστηκε κατανομή.', 'info');
        }}
        onConfirm={handleSymvPlannerConfirm}
      />
    </Overlay>
  );
}

export default SubprojectDetailModal;
