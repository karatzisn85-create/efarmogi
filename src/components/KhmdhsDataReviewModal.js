import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import {
  KHMDHS_REVIEW_STATUS,
  KHMDHS_RESOLUTION_SOURCE,
  reviewItemKey,
  getUnresolvedReviewItems,
  getUserResolvedReviewItems,
  getKhmdhsCompleteReviewItems,
  groupReviewItemsBySection,
  getReviewActionDescriptor,
  canApplySuggestedReviewValue,
  extractKhmdhsAdamFromItem,
  extractPaymentAdamsFromReviewItem,
  isReviewItemResolved,
  isReviewItemUnresolved,
  getReviewFieldInputKind,
  getInitialEditorValue,
  getFormValueForReviewItem,
  parseReviewDisplayValue,
  buildReviewContextLine,
  getResolutionConflict,
  formatResolutionSourceLabel,
  formatResolutionDate,
  getReviewItemUserGuide,
  sortReviewItemsByUserPriority,
  normalizeReviewSearchSteps,
  normalizeReviewFieldValue,
} from '../utils/khmdhsDataQualityReport';
import { showConfirm } from '../utils/confirmModal';
import { ASSIGNMENT_PROCEDURES } from '../data/formOptions';
import {
  CHAIN_KIND,
  CHAIN_KIND_LABEL,
  MOD_AMOUNT_TYPE,
  CORRECTS_PART,
  getChainKindChoice,
  describeChainKindAction,
  computeRunningTotalBeforeChainAdam,
} from '../utils/khmdhsChainActions';
import { openKhmdhsActOnline } from '../utils/openKhmdhsActOnline';
import { enrichChainKindReviewItem } from '../utils/khmdhsChainKindOptions';
import { getChainKindFieldProfile, validateChainKindDraft } from '../utils/khmdhsChainKindFields';
import { prefillSupplementaryModAmount } from '../utils/khmdhsSupplementaryAmountLogic';
import {
  PAYMENT_DOCUMENT_ROLE,
  PAYMENT_DOCUMENT_ROLE_LABELS,
  buildDefaultPaymentRoleDraft,
  mergePaymentLabelsFromProject,
  mergePaymentRolesFromProject,
  paymentRoleCountsTowardTotal,
  validatePaymentRoleDraft,
} from '../utils/khmdhsPaymentDocumentRoles';
import { formatKhmdhsEuro } from '../utils/khmdhsNoticeFields';
import KhmdhsSupplementaryDetailsModal from './KhmdhsSupplementaryDetailsModal';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.98) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const highlightPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.45); }
  70% { box-shadow: 0 0 0 8px rgba(2, 132, 199, 0); }
  100% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 100002;
  padding: 1rem 1.25rem 1.5rem;
  overflow: hidden;
  overscroll-behavior: contain;
  animation: ${fadeIn} 0.2s ease;
`;

const Card = styled.div`
  background: #f8fafc;
  border-radius: 20px;
  max-width: min(1140px, 96vw);
  width: 100%;
  max-height: min(calc(100vh - 1.25rem), 920px);
  height: min(calc(100vh - 1.25rem), 920px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.24);
  animation: ${popIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  margin: auto;
  border: 1px solid rgba(148, 163, 184, 0.35);
`;

const Header = styled.div`
  background: linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%);
  color: #fff;
  padding: 0.7rem 1.1rem 0.65rem;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const Sub = styled.p`
  margin: 0.28rem 0 0;
  font-size: 0.74rem;
  opacity: 0.9;
  line-height: 1.4;
  max-width: 52rem;
`;

const CaseTitle = styled.div`
  margin-top: 0.45rem;
  padding: 0.38rem 0.55rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.76rem;
  line-height: 1.35;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeaderMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
  margin-top: 0.45rem;
`;

const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`;

const StatChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.22);
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  padding: 0.45rem 1.1rem;
  background: #fff;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
  flex-shrink: 0;
`;

const FilterTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const FilterTab = styled.button`
  border: 1.5px solid ${(p) => (p.$active ? '#0284c7' : '#cbd5e1')};
  background: ${(p) => (p.$active ? '#e0f2fe' : '#fff')};
  color: ${(p) => (p.$active ? '#0369a1' : '#475569')};
  border-radius: 999px;
  padding: 0.38rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${(p) => (p.$active ? '#e0f2fe' : '#f1f5f9')};
  }
`;

const ToolbarHint = styled.span`
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.4;
`;

const WorkflowSteps = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  align-items: center;
  font-size: 0.72rem;
  color: #64748b;
`;

const WorkflowStep = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: ${(p) => (p.$active ? '#e0f2fe' : '#f1f5f9')};
  color: ${(p) => (p.$active ? '#0369a1' : '#64748b')};
  font-weight: ${(p) => (p.$active ? 800 : 600)};
  border: 1px solid ${(p) => (p.$active ? 'rgba(2, 132, 199, 0.35)' : 'transparent')};
`;

const NextStepsPanel = styled.div`
  background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%);
  border: 1.5px solid rgba(245, 158, 11, 0.4);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
`;

const NextStepsTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 0.55rem;
`;

const NextStepRow = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  border: 1px solid rgba(245, 158, 11, 0.25);
  background: #fff;
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;

  & + & { margin-top: 0.4rem; }

  &:hover {
    background: #fffbeb;
    border-color: rgba(245, 158, 11, 0.45);
  }
`;

const StepNum = styled.span`
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #f59e0b;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const NextStepText = styled.div`
  flex: 1;
  min-width: 0;
`;

const NextStepLabel = styled.div`
  font-size: 0.84rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.35;
`;

const NextStepHint = styled.div`
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 0.12rem;
  line-height: 1.4;
`;

const CompactFieldRow = styled.div`
  display: grid;
  grid-template-columns: minmax(7rem, 0.42fr) minmax(0, 1fr);
  gap: 0.35rem 0.55rem;
  align-items: center;
  margin-top: 0.4rem;
`;

const CompactLabel = styled.label`
  font-size: 0.74rem;
  font-weight: 700;
  color: #475569;
  line-height: 1.3;
`;

const CompactHint = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
  margin-top: 0.35rem;
`;

const InlineSignals = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.28);
`;

const GuideStepsBox = styled.div`
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.35);
`;

const PaymentPreviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.65rem;
`;

const PaymentPreviewRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.65rem;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  background: #f0fdfa;
  border: 1px solid rgba(13, 148, 136, 0.25);
  font-size: 0.8rem;
  color: #0f766e;

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 700;
    color: #0f172a;
  }
`;

const PaymentRoleSelect = styled.select`
  min-width: 220px;
  max-width: 100%;
  padding: 0.38rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 0.76rem;
  font-family: inherit;
`;

const PaymentLabelInput = styled.input`
  min-width: 220px;
  max-width: 100%;
  padding: 0.38rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 0.76rem;
  font-family: inherit;
`;

const PaymentClassSummary = styled.div`
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  color: #92400e;
  font-size: 0.76rem;
  line-height: 1.45;
  font-weight: 600;
`;

const GuideStepsTitle = styled.div`
  font-size: 0.74rem;
  font-weight: 800;
  color: #475569;
  margin-bottom: 0.4rem;
`;

const ActionCtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const ItemStepBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: #e0f2fe;
  color: #0369a1;
  margin-bottom: 0.35rem;
`;

const Body = styled.div`
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { width: 9px; }
  &::-webkit-scrollbar-track { background: rgba(148, 163, 184, 0.12); }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #cbd5e1, #94a3b8);
    border-radius: 5px;
  }
`;

/** Inner scroll wrapper */
const BodyInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.65rem 1.1rem 0.85rem;
  min-height: min-content;
`;

const ContextPanel = styled.div`
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  margin-bottom: 0.55rem;
  flex-shrink: 0;
  overflow: hidden;
`;

const ContextToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.65rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;

  &:hover {
    background: #f8fafc;
  }
`;

const ContextChevron = styled.span`
  font-size: 0.68rem;
  color: #64748b;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
  transition: transform 0.2s ease;
`;

const ContextTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  flex: 1;
`;

const ContextBody = styled.div`
  padding: 0 0.65rem 0.55rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
`;

const RefGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.3rem 0.65rem;
`;

const RefRow = styled.div`
  font-size: 0.74rem;
  line-height: 1.35;
  color: #334155;

  strong {
    display: block;
    font-size: 0.64rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.08rem;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    color: #0f172a;
    word-break: break-all;
  }
`;

const SectionBlock = styled.section`
  flex-shrink: 0;

  & + & {
    margin-top: 1.35rem;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.45rem;
  border-bottom: 2px solid rgba(2, 132, 199, 0.2);
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
`;

const SectionCount = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  background: #e2e8f0;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const ItemRow = styled.article`
  border-radius: 12px;
  padding: 0.75rem 0.85rem 0.8rem;
  background: #fff;
  flex-shrink: 0;
  scroll-margin-top: 1rem;
  border: 1px solid ${(p) => {
    if (p.$status === KHMDHS_REVIEW_STATUS.MISSING) return 'rgba(239, 68, 68, 0.4)';
    if (p.$status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) return 'rgba(245, 158, 11, 0.45)';
    return 'rgba(34, 197, 94, 0.35)';
  }};
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.25s ease;

  ${(p) => p.$highlight && css`
    animation: ${highlightPulse} 1.2s ease 2;
  `}
  ${(p) => p.$wizard && `
    padding: 1rem 1.05rem 1rem;
    min-height: 0;
    border-width: 2px;
    border-color: rgba(2, 132, 199, 0.5);
    box-shadow: 0 8px 22px rgba(2, 132, 199, 0.14);
    background: #fff;
  `}
`;

const ActiveWizardShell = styled.div`
  border-radius: 14px;
  padding: 0.3rem;
  background: linear-gradient(135deg, #dbeafe 0%, #f8fafc 55%, #fffbeb 100%);
  margin-bottom: 0.35rem;
`;

const WizardBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.42rem 0.55rem;
  margin-bottom: 0.45rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(59, 130, 246, 0.22);
`;

const WizardCounter = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #1e40af;
  white-space: nowrap;
`;

const WizardAdam = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  font-weight: 800;
  color: #0f172a;
  background: #fff;
  padding: 0.12rem 0.4rem;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
`;

const WizardHint = styled.div`
  font-size: 0.72rem;
  color: #475569;
  flex: 1;
  min-width: 8rem;
  line-height: 1.35;
`;

const WizardNavBtns = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const ItemTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const ItemHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
`;

const ItemIcon = styled.span`
  font-size: 1.2rem;
  line-height: 1.3;
  flex-shrink: 0;
`;

const ItemTitle = styled.div`
  font-size: 0.98rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.35;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  background: ${(p) => {
    if (p.$status === KHMDHS_REVIEW_STATUS.MISSING) return '#fee2e2';
    if (p.$status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) return '#fef3c7';
    return '#dcfce7';
  }};
  color: ${(p) => {
    if (p.$status === KHMDHS_REVIEW_STATUS.MISSING) return '#991b1b';
    if (p.$status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) return '#92400e';
    return '#166534';
  }};
`;

const ValueBox = styled.div`
  margin-top: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  background: #f1f5f9;
  border: 1px dashed rgba(100, 116, 139, 0.35);
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
`;

const ItemMessage = styled.p`
  margin: 0.65rem 0 0;
  font-size: 0.86rem;
  line-height: 1.55;
  color: #475569;
`;

const DetailBlock = styled.div`
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px dashed rgba(148, 163, 184, 0.45);
`;

const DetailTitle = styled.div`
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-bottom: 0.45rem;
`;

const StepList = styled.ol`
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #334155;

  li + li {
    margin-top: 0.35rem;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem 0.85rem;
  margin-top: 0.35rem;
`;

const InfoCell = styled.div`
  font-size: 0.82rem;
  line-height: 1.45;
  color: #334155;

  strong {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.1rem;
  }
`;

const FormHint = styled.div`
  margin-top: 0.75rem;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  background: #eff6ff;
  border: 1px solid rgba(59, 130, 246, 0.25);
  font-size: 0.82rem;
  line-height: 1.45;
  color: #1e40af;

  strong {
    font-weight: 800;
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-top: 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #fffbeb;
  border: 1px solid rgba(245, 158, 11, 0.35);
  font-size: 0.84rem;
  line-height: 1.45;
  color: #334155;
  cursor: pointer;
  user-select: none;

  input {
    margin-top: 0.2rem;
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  padding: 1rem 1.75rem 1.4rem;
  justify-content: flex-end;
  border-top: 1px solid rgba(148, 163, 184, 0.3);
  background: #fff;
  flex-shrink: 0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1.15rem;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #0284c7, #0369a1);
  color: #fff;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
`;

const GhostBtn = styled(Btn)`
  background: #fff;
  color: #475569;
  border: 1.5px solid #cbd5e1;
`;

const FooterHint = styled.p`
  flex: 1 1 100%;
  margin: 0 0 0.35rem 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.5;
`;

const EmptyFilter = styled.p`
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  color: #64748b;
  font-size: 0.88rem;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
  flex-shrink: 0;
`;

const ProgressBar = styled.div`
  flex: 1 1 6rem;
  min-width: 5rem;
  max-width: 10rem;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: #86efac;
  transition: width 0.25s ease;
  width: ${(p) => p.$pct}%;
`;

const ProgressLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  opacity: 0.92;
  white-space: nowrap;
`;

const ContextLine = styled.div`
  margin-top: 0.55rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #475569;
`;

const EditorRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  margin-top: 0.75rem;
`;

const EditorInput = styled.input`
  flex: 1 1 160px;
  min-width: 0;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: #0f172a;
  background: #fff;

  &:focus {
    outline: none;
    border-color: #0284c7;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
  }
`;

const KindSelect = styled.select`
  flex: 1 1 200px;
  min-width: 0;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
  background: #fff;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #0284c7;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
  }
`;

const SubQuestion = styled.div`
  margin-top: 0.45rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.3);
`;

const SubLabel = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #475569;
  margin-bottom: 0.45rem;
`;

const RadioRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.85rem;
  color: #334155;
  cursor: pointer;

  input { margin-top: 0.2rem; flex-shrink: 0; }
`;

const PartChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const PartChip = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$on ? '#e0f2fe' : '#fff')};
  color: ${(p) => (p.$on ? '#0369a1' : '#475569')};
  border: 1.5px solid ${(p) => (p.$on ? '#0284c7' : '#cbd5e1')};

  input { display: none; }
`;

const ActionPreview = styled.div`
  margin-top: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: #ecfdf5;
  border: 1px solid rgba(16, 185, 129, 0.3);
  font-size: 0.8rem;
  line-height: 1.45;
  color: #065f46;
`;

const FieldsBlock = styled.div`
  margin-top: 0.65rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid rgba(34, 197, 94, 0.28);
`;

const FieldsBlockTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #166534;
  margin-bottom: 0.45rem;
`;

const ValidationHint = styled.div`
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: #b45309;
`;

const SuggestionNote = styled.div`
  margin-top: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #64748b;

  strong { color: #0f172a; font-weight: 800; }
`;

const HelpToggle = styled.button`
  border: none;
  background: none;
  padding: 0;
  margin-top: 0.55rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0369a1;
  cursor: pointer;
  text-decoration: underline;

  &:hover { color: #0c4a6e; }
`;

const ConflictBadge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-top: 0.45rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid rgba(245, 158, 11, 0.45);
`;

const ResolvedMeta = styled.div`
  margin-top: 0.55rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #64748b;
`;

const ResolvedValue = styled.div`
  margin-top: 0.45rem;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
`;

const ActionSummary = styled.div`
  background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%);
  border: 1.5px solid rgba(245, 158, 11, 0.45);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
`;

const ActionSummaryTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 0.55rem;
`;

const ActionSummaryList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const ActionSummaryRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
  padding: 0.55rem 0.65rem;
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.25);
  font-size: 0.84rem;
  line-height: 1.4;
  color: #334155;
`;

const ActionSummaryLabel = styled.span`
  flex: 1 1 180px;
  font-weight: 700;
  color: #0f172a;
`;

const ActionTag = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: ${(p) => (p.$missing ? '#fee2e2' : '#fef3c7')};
  color: ${(p) => (p.$missing ? '#991b1b' : '#92400e')};
  white-space: nowrap;
`;

const ActionBtnRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`;

const MiniBtn = styled.button`
  border: 1.5px solid ${(p) => (p.$primary ? '#0284c7' : '#cbd5e1')};
  background: ${(p) => (p.$primary ? '#e0f2fe' : '#fff')};
  color: ${(p) => (p.$primary ? '#0369a1' : '#475569')};
  border-radius: 8px;
  padding: 0.28rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: ${(p) => (p.$primary ? '#bae6fd' : '#f1f5f9')};
  }
`;

const ItemActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
`;

const FieldReviewHint = styled.div`
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.45;
  background: ${(p) => (p.$missing ? '#fef2f2' : '#fffbeb')};
  border: 1px solid ${(p) => (p.$missing ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)')};
  color: ${(p) => (p.$missing ? '#991b1b' : '#92400e')};
`;

const FieldReviewHintActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
`;


function statusIcon(status) {
  if (status === KHMDHS_REVIEW_STATUS.COMPLETE) return '✅';
  if (status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) return '⚠️';
  return '❌';
}

function contractScopeLabel(contractIndex) {
  if (contractIndex == null) return '';
  return ` · Σύμβαση ${contractIndex + 1}`;
}

function formatEditorDisplayValue(item, value) {
  if (!value) return '—';
  const kind = getReviewFieldInputKind(item);
  if (kind === 'amount') return `${value} €`;
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return value;
}

function draftMatchesSuggestion(item, draft) {
  const suggested = parseReviewDisplayValue(item);
  if (!suggested || !draft) return false;
  return String(draft).trim() === String(suggested).trim();
}

const KIND_OPTION_HINTS = {
  modification: 'Αλλαγή ποσού ή όρων (συμπληρωματική)',
  extension: 'Μόνο νέα προθεσμία',
  republication: 'Διόρθωση προηγούμενης',
  other: 'Σχετικό έγγραφο',
  uncertain: 'Χειροκίνητος έλεγχος',
};

function scrollToReviewItem(itemKey, bodyEl) {
  if (!itemKey || typeof itemKey !== 'string' || !bodyEl) return;
  const escaped = typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(itemKey)
    : itemKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  window.requestAnimationFrame(() => {
    const el = bodyEl.querySelector(`[data-review-item-key="${escaped}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function chainModAmountPrefill(existingModAmount, enrichedItem, runningTotal = 0) {
  return prefillSupplementaryModAmount(existingModAmount, enrichedItem, runningTotal);
}

function buildChainKindChoicePayload({
  kind,
  correctsAdam,
  parts,
  modAmountType,
  modAmount,
  modDate,
  endDate,
  note,
  enrichedItem,
}) {
  return {
    kind,
    correctsAdam: kind === CHAIN_KIND.REPUBLICATION
      ? (correctsAdam || enrichedItem.defaultCorrectsAdam || null)
      : null,
    correctsParts: kind === CHAIN_KIND.REPUBLICATION ? [...parts] : [],
    modAmountType: kind === CHAIN_KIND.MODIFICATION ? modAmountType : null,
    modAmount: kind === CHAIN_KIND.MODIFICATION ? modAmount : '',
    modDate: kind === CHAIN_KIND.MODIFICATION ? modDate : '',
    endDate: kind === CHAIN_KIND.EXTENSION ? endDate : '',
    note,
  };
}

function ChainKindCard({ item, review, formData, onResolveChainKind, onRevoke, highlight = false, wizard = false }) {
  const enrichedItem = useMemo(
    () => enrichChainKindReviewItem(item, formData),
    [item, formData]
  );
  const adam = enrichedItem.chainAdam || extractKhmdhsAdamFromItem(enrichedItem);
  const runningTotalBefore = useMemo(
    () => computeRunningTotalBeforeChainAdam(formData, review, item),
    [formData, review, item]
  );
  const existing = getChainKindChoice(review, adam);
  const itemKey = reviewItemKey(enrichedItem);

  const [kind, setKind] = useState(() => existing?.kind || enrichedItem.suggestedKind || '');
  const [correctsAdam, setCorrectsAdam] = useState(
    () => existing?.correctsAdam || enrichedItem.defaultCorrectsAdam || ''
  );
  const [parts, setParts] = useState(() => new Set(existing?.correctsParts || [CORRECTS_PART.TITLE]));
  const [modAmountType, setModAmountType] = useState(
    () => existing?.modAmountType || MOD_AMOUNT_TYPE.DELTA
  );
  const [modAmount, setModAmount] = useState(
    () => chainModAmountPrefill(existing?.modAmount, enrichedItem, runningTotalBefore)
  );
  const [modDate, setModDate] = useState(() => existing?.modDate || enrichedItem.contractDateIso || '');
  const [endDate, setEndDate] = useState(() => existing?.endDate || enrichedItem.endDateIso || '');
  const [note, setNote] = useState(() => existing?.note || '');
  const [suppModalOpen, setSuppModalOpen] = useState(false);
  const lastAutoSaveRef = useRef('');
  /** Μόνο μετά ρητή επιλογή χρήστη — όχι αυτόματη αποθήκευση της πρότασης στο mount */
  const userEditedKindRef = useRef(!!existing?.kind);

  useEffect(() => {
    const e = getChainKindChoice(review, adam);
    setKind(e?.kind || enrichedItem.suggestedKind || '');
    setCorrectsAdam(e?.correctsAdam || enrichedItem.defaultCorrectsAdam || '');
    setParts(new Set(e?.correctsParts || [CORRECTS_PART.TITLE]));
    setModAmountType(e?.modAmountType || MOD_AMOUNT_TYPE.DELTA);
    setModAmount(chainModAmountPrefill(e?.modAmount, enrichedItem, runningTotalBefore));
    setModDate(e?.modDate || enrichedItem.contractDateIso || '');
    setEndDate(e?.endDate || enrichedItem.endDateIso || '');
    setNote(e?.note || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, review?.generatedAt]);

  const fieldProfile = kind
    ? getChainKindFieldProfile(kind, {
      hasKhmdhsAmount: enrichedItem.hasAmount,
      hasKhmdhsDate: enrichedItem.hasKhmdhsDate,
    })
    : null;

  const validation = validateChainKindDraft({
    kind,
    endDate,
    modAmount,
    modAmountType,
    modDate,
    correctsAdam: correctsAdam || enrichedItem.defaultCorrectsAdam || '',
    correctsParts: [...parts],
    hasKhmdhsAmount: enrichedItem.hasAmount,
    hasKhmdhsDate: enrichedItem.hasKhmdhsDate,
  });
  const canSave = kind === CHAIN_KIND.MODIFICATION
    ? !!kind
    : validation.ok;

  const persistChoice = useCallback((choice, { silent = false } = {}) => {
    if (!kind || !onResolveChainKind) return;
    onResolveChainKind(item, choice, { silent });
  }, [item, kind, onResolveChainKind]);

  const handleKindChange = (newKind) => {
    userEditedKindRef.current = true;
    setKind(newKind);
    if (newKind === CHAIN_KIND.EXTENSION && !endDate && enrichedItem.endDateIso) {
      setEndDate(enrichedItem.endDateIso);
    }
    if (newKind === CHAIN_KIND.MODIFICATION && !getChainKindChoice(review, adam)) {
      window.setTimeout(() => setSuppModalOpen(true), 0);
    }
  };

  useEffect(() => {
    if (!userEditedKindRef.current) return;
    if (!kind || kind === CHAIN_KIND.MODIFICATION || !onResolveChainKind) return;
    if (isReviewItemResolved(review, formData, item)) return;
    const draftValidation = validateChainKindDraft({
      kind,
      endDate,
      modAmount,
      modAmountType,
      modDate,
      correctsAdam: correctsAdam || enrichedItem.defaultCorrectsAdam || '',
      correctsParts: [...parts],
      hasKhmdhsAmount: enrichedItem.hasAmount,
      hasKhmdhsDate: enrichedItem.hasKhmdhsDate,
    });
    if (!draftValidation.ok) return;

    const choice = buildChainKindChoicePayload({
      kind,
      correctsAdam,
      parts,
      modAmountType,
      modAmount,
      modDate,
      endDate,
      note,
      enrichedItem,
    });
    const fingerprint = JSON.stringify(choice);
    if (lastAutoSaveRef.current === fingerprint) return;
    lastAutoSaveRef.current = fingerprint;
    persistChoice(choice, { silent: true });
  }, [
    kind,
    endDate,
    modAmount,
    modAmountType,
    modDate,
    correctsAdam,
    parts,
    note,
    enrichedItem,
    onResolveChainKind,
    persistChoice,
    adam,
    review,
    formData,
    item,
  ]);

  const handleSave = () => {
    if (!kind || !onResolveChainKind) return;
    if (kind === CHAIN_KIND.MODIFICATION) {
      setSuppModalOpen(true);
      return;
    }
    if (!validation.ok) return;
    const choice = buildChainKindChoicePayload({
      kind,
      correctsAdam,
      parts,
      modAmountType,
      modAmount,
      modDate,
      endDate,
      note,
      enrichedItem,
    });
    lastAutoSaveRef.current = JSON.stringify(choice);
    persistChoice(choice, { silent: false });
  };

  const handleSuppSubmit = (choice) => {
    if (!onResolveChainKind) return;
    lastAutoSaveRef.current = JSON.stringify(choice);
    onResolveChainKind(item, choice, { silent: false });
    setSuppModalOpen(false);
  };

  const resolved = isReviewItemResolved(review, formData, item);
  const status = resolved ? KHMDHS_REVIEW_STATUS.COMPLETE : enrichedItem.status;
  const suggestionLabel = enrichedItem.suggestedKind ? CHAIN_KIND_LABEL[enrichedItem.suggestedKind] : '';
  const khmdhsLabel = (enrichedItem.references || []).find((r) => /πώς τη συνδέει/i.test(r.label || ''))?.value;
  const signals = (enrichedItem.relatedInfo || []).filter((r) => /ένδειξη/i.test(r.label || ''));

  return (
    <ItemRow
      $status={status}
      data-review-item-key={itemKey}
      $highlight={highlight}
      $wizard={wizard}
    >
      {!wizard ? <ItemStepBadge>Βήμα: χαρακτηρισμός εγγράφου</ItemStepBadge> : null}
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>{resolved ? '✔️' : '🏷️'}</ItemIcon>
          <ItemTitle>{enrichedItem.label}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={status}>
          {resolved ? 'Ολοκληρώθηκε' : 'Επιλέξτε τύπο'}
        </StatusBadge>
      </ItemTop>

      <ContextLine>{buildReviewContextLine(enrichedItem)}</ContextLine>

      {!wizard ? (
        <CompactHint>
          {enrichedItem.message || (
            suggestionLabel
              ? <>Πρόταση: <strong>{suggestionLabel}</strong> — επιλέξτε τον σωστό τύπο.</>
              : <>Διαλέξτε τι είδους έγγραφο είναι.</>
          )}
          {khmdhsLabel ? <> ΚΗΜΔΗΣ: «{khmdhsLabel}».</> : null}
        </CompactHint>
      ) : null}

      {signals.length > 0 && (
        wizard ? (
          <details style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ενδείξεις από ΚΗΜΔΗΣ</summary>
            <div style={{ marginTop: '0.25rem', lineHeight: 1.4 }}>
              {signals.map((s) => s.value).join(' · ')}
            </div>
          </details>
        ) : (
          <InlineSignals>
            <strong>Ενδείξεις:</strong>{' '}
            {signals.map((s) => s.value).join(' · ')}
          </InlineSignals>
        )
      )}

      <CompactFieldRow>
        <CompactLabel htmlFor={`kind-select-${adam}`}>Τύπος εγγράφου</CompactLabel>
        <KindSelect
          id={`kind-select-${adam}`}
          value={kind}
          onChange={(e) => handleKindChange(e.target.value)}
          aria-label="Είδος εγγράφου"
        >
          <option value="">— επιλέξτε —</option>
          {(enrichedItem.kindOptions || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}{KIND_OPTION_HINTS[o.value] ? ` — ${KIND_OPTION_HINTS[o.value]}` : ''}
            </option>
          ))}
        </KindSelect>
      </CompactFieldRow>

      {kind ? <ActionPreview>{describeChainKindAction(kind)}</ActionPreview> : null}

      {kind === CHAIN_KIND.REPUBLICATION && (
        <SubQuestion>
          <CompactFieldRow>
            <CompactLabel>Διορθώνει έγγραφο</CompactLabel>
            <KindSelect value={correctsAdam} onChange={(e) => setCorrectsAdam(e.target.value)}>
              {(enrichedItem.peerOptions || []).length === 0 && <option value="">—</option>}
              {(enrichedItem.peerOptions || []).map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </KindSelect>
          </CompactFieldRow>
          <CompactFieldRow>
            <CompactLabel htmlFor={`repub-parts-${adam}`}>Τι διορθώνει</CompactLabel>
            <KindSelect
              id={`repub-parts-${adam}`}
              multiple
              value={[...parts]}
              onChange={(e) => {
                const selected = [...e.target.selectedOptions].map((o) => o.value);
                setParts(new Set(selected.length ? selected : [CORRECTS_PART.TITLE]));
              }}
              size={3}
            >
              <option value={CORRECTS_PART.TITLE}>Τίτλο</option>
              <option value={CORRECTS_PART.AMOUNT}>Ποσό</option>
              <option value={CORRECTS_PART.DATE}>Ημερομηνία</option>
            </KindSelect>
          </CompactFieldRow>
        </SubQuestion>
      )}

      {kind === CHAIN_KIND.MODIFICATION && resolved && existing && (
        <DetailBlock>
          <DetailTitle>Καταχωρημένα στοιχεία συμπληρωματικής</DetailTitle>
          <StepList>
            {existing.modDate || enrichedItem.contractDateIso ? (
              <li>Ημερομηνία: {(existing.modDate || enrichedItem.contractDateIso || '').slice(0, 10)}</li>
            ) : null}
            {existing.modAmount ? <li>Ποσό: {existing.modAmount} €</li> : null}
            {existing.modAmountType ? (
              <li>
                Τύπος: {existing.modAmountType === MOD_AMOUNT_TYPE.TOTAL ? 'Νέα συνολική αξία' : 'Διαφορά'}
              </li>
            ) : null}
            {existing.note ? <li>Σχόλιο: {existing.note}</li> : null}
          </StepList>
        </DetailBlock>
      )}

      {kind === CHAIN_KIND.EXTENSION && (
        <SubQuestion>
          <CompactFieldRow>
            <CompactLabel>Νέα προθεσμία</CompactLabel>
            <EditorInput type="date" value={(endDate || '').slice(0, 10)} onChange={(e) => setEndDate(e.target.value)} />
          </CompactFieldRow>
          {!endDate ? (
            <CompactHint>Για παράταση χρόνου δεν χρειάζεται ποσό — μόνο η νέα προθεσμία.</CompactHint>
          ) : null}
        </SubQuestion>
      )}

      {!canSave && kind && kind !== CHAIN_KIND.MODIFICATION && validation.message ? (
        <ValidationHint>{validation.message}</ValidationHint>
      ) : null}

      {kind !== CHAIN_KIND.MODIFICATION && (
        <CompactFieldRow>
          <CompactLabel>Σχόλιο</CompactLabel>
          <EditorInput type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="προαιρετικό" />
        </CompactFieldRow>
      )}

      <ItemActions>
        <MiniBtn type="button" $primary onClick={handleSave} disabled={!canSave}>
          {kind === CHAIN_KIND.MODIFICATION
            ? (resolved ? 'Επεξεργασία στοιχείων συμπληρωματικής' : 'Συμπλήρωση στοιχείων συμπληρωματικής…')
            : (resolved ? 'Ενημέρωση χαρακτηρισμού' : 'Αποθήκευση χαρακτηρισμού')}
        </MiniBtn>
        {adam && (
          <MiniBtn
            type="button"
            onClick={async () => {
              const res = await openKhmdhsActOnline(adam);
              if (res?.success === false && res?.error) window.alert(res.error);
            }}
          >
            Προβολή online
          </MiniBtn>
        )}
        {resolved && onRevoke && (
          <MiniBtn type="button" onClick={() => onRevoke(itemKey)}>
            Αναίρεση
          </MiniBtn>
        )}
      </ItemActions>

      {resolved && existing?.resolvedBy && (
        <ResolvedMeta>Χαρακτηρίστηκε από: {existing.resolvedBy}</ResolvedMeta>
      )}

      <KhmdhsSupplementaryDetailsModal
        isOpen={suppModalOpen}
        enrichedItem={enrichedItem}
        formData={formData}
        review={review}
        existingChoice={existing || {
          modAmountType,
          modAmount,
          modDate,
          note,
        }}
        onClose={() => setSuppModalOpen(false)}
        onSubmit={handleSuppSubmit}
      />
    </ItemRow>
  );
}

function ReviewFieldEditor({ inputKind, draft, onChange, placeholder = '', onBlur, onKeyDown }) {
  if (inputKind === 'assignmentProcedure') {
    return (
      <KindSelect value={draft} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
        <option value="">— Επιλέξτε διαδικασία —</option>
        {ASSIGNMENT_PROCEDURES.map((procedure) => (
          <option key={procedure} value={procedure}>{procedure}</option>
        ))}
      </KindSelect>
    );
  }
  return (
    <EditorInput
      type={inputKind === 'date' ? 'date' : 'text'}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  );
}

function PaymentClassificationCard({
  item, formData, review, onResolve, stepIndex = null, highlight = false, wizard = false,
}) {
  const action = getReviewActionDescriptor(item);
  const guide = getReviewItemUserGuide(item);
  const recon = item?.paymentsReconciliation || {};
  const itemKey = reviewItemKey(item);
  const steps = normalizeReviewSearchSteps(item, action);
  const existingRoles = useMemo(
    () => mergePaymentRolesFromProject(formData, review, item),
    [formData, review, item]
  );
  const existingLabels = useMemo(
    () => mergePaymentLabelsFromProject(formData, review, item),
    [formData, review, item]
  );
  const paymentSnapshots = useMemo(() => {
    const map = new Map();
    (formData?.khmdhsPayments || []).forEach((p) => {
      const adam = String(p?.adam || p?.snapshot?.referenceNumber || '').trim().toUpperCase();
      if (adam) map.set(adam, p?.snapshot || null);
    });
    return map;
  }, [formData?.khmdhsPayments]);

  const [roleDraft, setRoleDraft] = useState(() => {
    const defaults = buildDefaultPaymentRoleDraft(recon.entries, recon.coFinancingPattern);
    return { ...defaults, ...existingRoles };
  });
  const [labelDraft, setLabelDraft] = useState(() => ({ ...existingLabels }));

  useEffect(() => {
    const defaults = buildDefaultPaymentRoleDraft(recon.entries, recon.coFinancingPattern);
    setRoleDraft({ ...defaults, ...mergePaymentRolesFromProject(formData, review, item) });
    setLabelDraft({ ...mergePaymentLabelsFromProject(formData, review, item) });
  }, [itemKey, review?.generatedAt, formData, item, recon.entries, recon.coFinancingPattern]);

  const activeEntries = (recon.entries || []).filter((e) => e?.active && e?.adam);
  const countableTotal = activeEntries.reduce((sum, e) => {
    const adam = String(e.adam || '').trim().toUpperCase();
    const role = roleDraft[adam];
    if (!role || !paymentRoleCountsTowardTotal(role)) return sum;
    return sum + (e.gross || 0);
  }, 0);
  const validation = validatePaymentRoleDraft(recon.entries, roleDraft);
  const payable = recon.contractAmountGross;
  const exceedsAfterClassify = payable != null && countableTotal > payable + 0.5;

  const handleSave = () => {
    if (!validation.ok || !onResolve) return;
    onResolve(item, {
      value: 'classified',
      source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
      meta: { paymentRoles: roleDraft, paymentLabels: labelDraft },
    });
  };

  const handleSaveAcknowledgedExceed = async () => {
    if (!validation.ok || !onResolve || !exceedsAfterClassify) return;
    const ok = await showConfirm({
      title: 'Αποθήκευση με διαφορά',
      message: 'Το άθροισμα των ενταλμάτων που μετρούν υπερβαίνει το τελικό πληρωτέο ποσό.',
      detail: payable != null
        ? `Μετά τους χαρακτηρισμούς: ${formatKhmdhsEuro(countableTotal)} έναντι ${formatKhmdhsEuro(payable)}. Θα αποθηκευτούν οι χαρακτηρισμοί σας όπως είναι — η διαφορά θα παραμείνει καταγεγραμμένη.`
        : 'Θα αποθηκευτούν οι χαρακτηρισμοί σας όπως είναι.',
      confirmLabel: 'Αποθήκευση έτσι',
      cancelLabel: 'Άκυρο',
      danger: false,
      icon: '⚠️',
    });
    if (!ok) return;
    onResolve(item, {
      value: 'classified',
      source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
      meta: {
        paymentRoles: roleDraft,
        paymentLabels: labelDraft,
        acknowledgedPayableExceeds: true,
      },
    });
  };

  return (
    <ItemRow $status={item.status} data-review-item-key={itemKey} $highlight={highlight} $wizard={wizard}>
      {stepIndex != null && <ItemStepBadge>Βήμα {stepIndex}</ItemStepBadge>}
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>{guide.icon || statusIcon(item.status)}</ItemIcon>
          <ItemTitle>{item.label}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={item.status}>
          {item.status === KHMDHS_REVIEW_STATUS.MISSING ? 'Λείπει' : 'Έλεγχος'}
        </StatusBadge>
      </ItemTop>

      <ContextLine>{buildReviewContextLine(item)}</ContextLine>
      {item.message ? <ItemMessage>{item.message}</ItemMessage> : null}

      {steps.length > 0 && (
        <GuideStepsBox>
          <GuideStepsTitle>Τι να ελέγξετε</GuideStepsTitle>
          <StepList>
            {steps.map((step) => <li key={step}>{step}</li>)}
          </StepList>
        </GuideStepsBox>
      )}

      <PaymentClassSummary>
        Ακατέργαστο άθροισμα: {formatKhmdhsEuro(recon.rawTotalGross)}
        {payable != null && (
          <> · Μετά τους χαρακτηρισμούς: {formatKhmdhsEuro(countableTotal)} / {formatKhmdhsEuro(payable)}</>
        )}
        {exceedsAfterClassify && ' — το ποσό που μετράει ακόμη υπερβαίνει το τελικό πληρωτέο.'}
      </PaymentClassSummary>

      <PaymentPreviewList>
        {activeEntries.map((entry, idx) => {
          const adam = String(entry.adam || '').trim().toUpperCase();
          const snap = paymentSnapshots.get(adam);
          const title = snap?.title || '';
          return (
            <PaymentPreviewRow key={adam}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <strong>Έγγραφο {idx + 1}</strong>
                {' · '}
                <code>{adam}</code>
                {entry.payer?.shortLabel ? ` · ${entry.payer.shortLabel}` : ''}
                {entry.gross != null ? ` · ${formatKhmdhsEuro(entry.gross)}` : ''}
                {title ? (
                  <div style={{ marginTop: '0.25rem', color: '#475569', fontSize: '0.72rem' }}>
                    {title}
                  </div>
                ) : null}
              </div>
              <PaymentRoleSelect
                value={roleDraft[adam] || PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER}
                onChange={(e) => setRoleDraft((prev) => ({ ...prev, [adam]: e.target.value }))}
              >
                {Object.entries(PAYMENT_DOCUMENT_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </PaymentRoleSelect>
              <PaymentLabelInput
                type="text"
                value={labelDraft[adam] || ''}
                onChange={(e) => setLabelDraft((prev) => ({ ...prev, [adam]: e.target.value }))}
                placeholder="Δική σας ονομασία (προαιρετικά)"
              />
              <MiniBtn
                type="button"
                onClick={async () => {
                  const res = await openKhmdhsActOnline(adam);
                  if (res?.success === false && res?.error) window.alert(res.error);
                }}
              >
                Προβολή
              </MiniBtn>
            </PaymentPreviewRow>
          );
        })}
      </PaymentPreviewList>

      {!validation.ok && (
        <ConflictBadge>{validation.error}</ConflictBadge>
      )}

      <ActionCtaRow>
        <MiniBtn
          type="button"
          $primary
          onClick={handleSave}
          disabled={!validation.ok || exceedsAfterClassify}
        >
          {action.saveLabel || 'Αποθήκευση χαρακτηρισμών'}
        </MiniBtn>
        {exceedsAfterClassify && validation.ok && (
          <MiniBtn
            type="button"
            onClick={handleSaveAcknowledgedExceed}
            title="Αποθηκεύει τους τρέχοντες χαρακτηρισμούς χωρίς να αλλάξετε ποιο έγγραφο μετράει"
          >
            Αποθήκευση έτσι όπως είναι
          </MiniBtn>
        )}
      </ActionCtaRow>
    </ItemRow>
  );
}

function PaymentClassificationResolvedCard({ item, review, formData, onRevoke }) {
  const key = reviewItemKey(item);
  const resolution = review?.resolutions?.[key];
  const roles = mergePaymentRolesFromProject(formData, review, item);
  const labels = mergePaymentLabelsFromProject(formData, review, item);
  const entries = (item?.paymentsReconciliation?.entries || []).filter((e) => e?.active && e?.adam);

  if (!resolution) return null;

  return (
    <ItemRow $status="resolved">
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>✔️</ItemIcon>
          <ItemTitle>{item.label}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={KHMDHS_REVIEW_STATUS.COMPLETE}>Επιλυμένο</StatusBadge>
      </ItemTop>
      <ResolvedMeta>
        {formatResolutionSourceLabel(resolution.source)}
        {resolution.resolvedAt ? ` · ${formatResolutionDate(resolution.resolvedAt)}` : ''}
        {resolution?.meta?.acknowledgedPayableExceeds
          ? ' · Αποθηκεύτηκε με αποδοχή διαφοράς έναντι τελικού πληρωτέου'
          : ''}
      </ResolvedMeta>
      <PaymentPreviewList>
        {entries.map((entry, idx) => {
          const adam = String(entry.adam || '').trim().toUpperCase();
          const role = roles[adam];
          const custom = labels[adam];
          const roleLabel = PAYMENT_DOCUMENT_ROLE_LABELS[role] || role || '—';
          return (
            <PaymentPreviewRow key={adam}>
              <span>
                <strong>Έγγραφο {idx + 1}</strong> · <code>{adam}</code>
                {entry.gross != null ? ` · ${formatKhmdhsEuro(entry.gross)}` : ''}
                <div style={{ marginTop: '0.2rem', color: '#475569' }}>
                  {custom ? `Ονομασία: ${custom}` : roleLabel}
                </div>
              </span>
            </PaymentPreviewRow>
          );
        })}
      </PaymentPreviewList>
      <ItemActions>
        <MiniBtn type="button" onClick={() => onRevoke?.(key)}>
          Αναίρεση επιλογής
        </MiniBtn>
      </ItemActions>
    </ItemRow>
  );
}

function ActionReviewCard({ item, formData, review, onResolve, stepIndex = null, highlight = false, wizard = false }) {
  const [draft, setDraft] = useState(() => getInitialEditorValue(item, formData));
  const action = getReviewActionDescriptor(item);
  const guide = getReviewItemUserGuide(item);
  const inputKind = getReviewFieldInputKind(item);
  const canApply = canApplySuggestedReviewValue(item, formData);
  const paymentPreviews = useMemo(
    () => (item.fieldId === 'paymentsReconciliation' ? extractPaymentAdamsFromReviewItem(item) : []),
    [item]
  );
  const adam = item.fieldId === 'paymentsReconciliation' ? '' : extractKhmdhsAdamFromItem(item);
  const conflict = getResolutionConflict(review, item);
  const scope = contractScopeLabel(item.contractIndex);
  const itemKey = reviewItemKey(item);
  const steps = normalizeReviewSearchSteps(item, action);

  useEffect(() => {
    setDraft(getInitialEditorValue(item, formData));
  }, [itemKey, formData, review?.generatedAt]);

  const canSave = inputKind === 'acknowledge'
    ? true
    : String(draft || '').trim() !== '';

  const handleSave = () => {
    if (!canSave || !onResolve) return;
    let source = KHMDHS_RESOLUTION_SOURCE.USER_MANUAL;
    if (inputKind === 'acknowledge') {
      source = KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED;
    } else if (draftMatchesSuggestion(item, draft)) {
      source = item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW
        ? KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED
        : KHMDHS_RESOLUTION_SOURCE.KHMDHS_APPLIED;
    }
    onResolve(item, {
      value: inputKind === 'acknowledge' ? 'confirmed' : draft,
      source,
    });
  };

  const saveFieldOnEnter = () => {
    if (inputKind === 'acknowledge') return;
    const formVal = getFormValueForReviewItem(formData, item);
    if (!canSave) return;
    if (normalizeReviewFieldValue(item, draft) === normalizeReviewFieldValue(item, formVal)) return;
    handleSave();
  };

  const handleApplySuggested = () => {
    const suggested = parseReviewDisplayValue(item);
    if (!suggested) return;
    setDraft(suggested);
  };

  return (
    <ItemRow $status={item.status} data-review-item-key={itemKey} $highlight={highlight} $wizard={wizard}>
      {stepIndex != null && (
        <ItemStepBadge>Βήμα {stepIndex}</ItemStepBadge>
      )}
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>{guide.icon || statusIcon(item.status)}</ItemIcon>
          <ItemTitle>{item.label}{scope}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={item.status}>
          {item.status === KHMDHS_REVIEW_STATUS.MISSING ? 'Λείπει' : 'Έλεγχος'}
        </StatusBadge>
      </ItemTop>

      <ContextLine>{buildReviewContextLine(item)}</ContextLine>
      {item.message ? <ItemMessage>{item.message}</ItemMessage> : null}
      {conflict && (
        <ConflictBadge>
          Νέα πρόταση ΚΗΜΔΗΣ: {conflict.currentSuggestion} (πριν: {conflict.previousSuggestion})
        </ConflictBadge>
      )}

      {inputKind === 'acknowledge' ? (
        <>
          {steps.length > 0 && (
            <GuideStepsBox>
              <GuideStepsTitle>Τι να ελέγξετε</GuideStepsTitle>
              <StepList>
                {steps.map((step) => <li key={step}>{step}</li>)}
              </StepList>
            </GuideStepsBox>
          )}
          <ActionCtaRow>
            <MiniBtn type="button" $primary onClick={handleSave}>
              {action.saveLabel || guide.cta || 'Επιβεβαίωση'}
            </MiniBtn>
            {paymentPreviews.length > 0 ? (
              <PaymentPreviewList style={{ flex: '1 1 100%', marginTop: 0 }}>
                {paymentPreviews.map((p) => (
                  <PaymentPreviewRow key={p.adam}>
                    <span>
                      {p.label} · <code>{p.adam}</code>
                      {p.inactive ? ' (ανενεργό)' : ''}
                    </span>
                    <MiniBtn
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={async () => {
                        const res = await openKhmdhsActOnline(p.adam);
                        if (res?.success === false && res?.error) window.alert(res.error);
                      }}
                    >
                      Προβολή στο ΚΗΜΔΗΣ
                    </MiniBtn>
                  </PaymentPreviewRow>
                ))}
              </PaymentPreviewList>
            ) : adam ? (
              <MiniBtn
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  const res = await openKhmdhsActOnline(adam);
                  if (res?.success === false && res?.error) window.alert(res.error);
                }}
              >
                Προβολή στο ΚΗΜΔΗΣ
              </MiniBtn>
            ) : null}
          </ActionCtaRow>
        </>
      ) : (
        <EditorRow>
          <ReviewFieldEditor
            inputKind={inputKind}
            draft={draft}
            onChange={setDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveFieldOnEnter();
              }
            }}
            placeholder={inputKind === 'amount' ? 'π.χ. 12.358,58' : ''}
          />
          {canApply && (
            <MiniBtn type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleApplySuggested}>
              {action.applyLabel || 'Πρόταση'}
            </MiniBtn>
          )}
          <MiniBtn type="button" $primary onMouseDown={(e) => e.preventDefault()} onClick={handleSave} disabled={!canSave}>
            {action.saveLabel || 'Επιβεβαίωση'}
          </MiniBtn>
          {adam && (
            <MiniBtn
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                const res = await openKhmdhsActOnline(adam);
                if (res?.success === false && res?.error) window.alert(res.error);
              }}
            >
              Προβολή online
            </MiniBtn>
          )}
        </EditorRow>
      )}
    </ItemRow>
  );
}

function ResolvedReviewCard({ item, review, formData, onResolve, onRevoke }) {
  const key = reviewItemKey(item);
  const resolution = review?.resolutions?.[key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => getFormValueForReviewItem(formData, item));
  const conflict = getResolutionConflict(review, item);
  const scope = contractScopeLabel(item.contractIndex);
  const inputKind = getReviewFieldInputKind(item);

  if (!resolution) return null;

  const handleUpdate = () => {
    if (inputKind === 'acknowledge') {
      onResolve?.(item, { value: 'confirmed', source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED });
      setEditing(false);
      return;
    }
    if (!String(draft || '').trim()) return;
    onResolve?.(item, { value: draft, source: KHMDHS_RESOLUTION_SOURCE.USER_MANUAL });
    setEditing(false);
  };

  return (
    <ItemRow $status="resolved">
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>✔️</ItemIcon>
          <ItemTitle>{item.label}{scope}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={KHMDHS_REVIEW_STATUS.COMPLETE}>Επιλυμένο</StatusBadge>
      </ItemTop>

      {!editing ? (
        <>
          <ResolvedValue>
            {formatEditorDisplayValue(item, getFormValueForReviewItem(formData, item) || resolution.value)}
          </ResolvedValue>
          <ResolvedMeta>
            {formatResolutionSourceLabel(resolution.source)}
            {resolution.resolvedAt ? ` · ${formatResolutionDate(resolution.resolvedAt)}` : ''}
          </ResolvedMeta>
          {conflict && (
            <ConflictBadge>
              Η πρόταση ΚΗΜΔΗΣ άλλαξε — η δική σας τιμή παραμένει
            </ConflictBadge>
          )}
          <ItemActions>
            <MiniBtn type="button" onClick={() => { setDraft(getFormValueForReviewItem(formData, item)); setEditing(true); }}>
              Επεξεργασία
            </MiniBtn>
            <MiniBtn type="button" onClick={() => onRevoke?.(key)}>
              Αναίρεση επιλογής
            </MiniBtn>
          </ItemActions>
        </>
      ) : (
        <>
          {inputKind !== 'acknowledge' && (
            <EditorRow>
              <ReviewFieldEditor
                inputKind={inputKind}
                draft={draft}
                onChange={setDraft}
              />
            </EditorRow>
          )}
          <ItemActions>
            <MiniBtn type="button" $primary onClick={handleUpdate}>Ενημέρωση</MiniBtn>
            <MiniBtn type="button" onClick={() => setEditing(false)}>Ακύρωση</MiniBtn>
          </ItemActions>
        </>
      )}
    </ItemRow>
  );
}

function CompleteReviewCard({ item }) {
  const scope = contractScopeLabel(item.contractIndex);
  return (
    <ItemRow $status={item.status}>
      <ItemTop>
        <ItemHead>
          <ItemIcon aria-hidden>✅</ItemIcon>
          <ItemTitle>{item.label}{scope}</ItemTitle>
        </ItemHead>
        <StatusBadge $status={item.status}>Πλήρες</StatusBadge>
      </ItemTop>
      {item.displayValue ? <ValueBox>{item.displayValue}</ValueBox> : null}
      {item.message ? <ItemMessage style={{ marginTop: '0.45rem' }}>{item.message}</ItemMessage> : null}
    </ItemRow>
  );
}

export default function KhmdhsDataReviewModal({
  isOpen,
  review,
  formData,
  focusItemKey = null,
  onConfirm,
  onDismiss,
  onResolveItem,
  onResolveChainKind,
  onRevokeResolution,
  onApplyAllSuggested,
}) {
  const [filter, setFilter] = useState('action');
  const [highlightKey, setHighlightKey] = useState(null);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [refsExpanded, setRefsExpanded] = useState(false);
  const bodyScrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFilter('action');
      setHighlightKey(
        typeof focusItemKey === 'string' && focusItemKey.trim() ? focusItemKey.trim() : null
      );
      if (!focusItemKey) setWizardIndex(0);
      lockBodyScroll('khmdhs-data-review');
      return () => unlockBodyScroll('khmdhs-data-review');
    }
    return undefined;
  }, [isOpen, review?.generatedAt, focusItemKey]);

  const unresolved = useMemo(
    () => sortReviewItemsByUserPriority(getUnresolvedReviewItems(review, formData)),
    [review, formData]
  );
  const resolvedByUser = useMemo(
    () => getUserResolvedReviewItems(review, formData),
    [review, formData]
  );
  const completeItems = useMemo(
    () => getKhmdhsCompleteReviewItems(review),
    [review]
  );
  const ctx = review?.context || {};

  const totalItems = unresolved.length + resolvedByUser.length + completeItems.length;
  const doneCount = resolvedByUser.length + completeItems.length;
  const progressPct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 100;

  const tabItems = useMemo(() => {
    if (filter === 'resolved') return resolvedByUser;
    if (filter === 'complete') return completeItems;
    return unresolved;
  }, [filter, unresolved, resolvedByUser, completeItems]);

  const stepIndexByKey = useMemo(() => {
    const map = new Map();
    unresolved.forEach((item, idx) => {
      map.set(reviewItemKey(item), idx + 1);
    });
    return map;
  }, [unresolved]);

  const hasChainKindPending = unresolved.some((i) => i.fieldId === 'chainKindReview');
  const hasFieldPending = unresolved.some((i) => i.fieldId !== 'chainKindReview' && i.fieldId !== 'paymentsReconciliation');
  const hasPaymentsPending = unresolved.some((i) => i.fieldId === 'paymentsReconciliation');

  useEffect(() => {
    if (!isOpen || !highlightKey) return undefined;
    const t = window.setTimeout(() => {
      scrollToReviewItem(highlightKey, bodyScrollRef.current);
      window.setTimeout(() => setHighlightKey(null), 2400);
    }, 120);
    return () => window.clearTimeout(t);
  }, [isOpen, highlightKey, filter, tabItems.length]);

  const grouped = useMemo(
    () => groupReviewItemsBySection(tabItems),
    [tabItems]
  );

  const applicableCount = useMemo(
    () => unresolved.filter((i) => canApplySuggestedReviewValue(i, formData)).length,
    [unresolved, formData]
  );

  const unresolvedKeys = useMemo(
    () => unresolved.map((i) => reviewItemKey(i)).join('\u0001'),
    [unresolved]
  );

  const focusWizardIndex = useMemo(() => {
    if (!focusItemKey || typeof focusItemKey !== 'string' || !unresolvedKeys) return null;
    const idx = unresolvedKeys.split('\u0001').indexOf(focusItemKey);
    return idx >= 0 ? idx : null;
  }, [focusItemKey, unresolvedKeys]);

  const useWizardView = filter === 'action' && unresolved.length > 0;
  const safeWizardIndex = useWizardView
    ? Math.min(wizardIndex, Math.max(0, unresolved.length - 1))
    : 0;
  const currentWizardItem = useWizardView ? unresolved[safeWizardIndex] : null;
  const currentWizardGuide = currentWizardItem
    ? getReviewItemUserGuide(currentWizardItem)
    : null;

  useEffect(() => {
    if (!isOpen || filter !== 'action' || focusWizardIndex == null) return undefined;
    setWizardIndex(focusWizardIndex);
    return undefined;
  }, [isOpen, filter, focusWizardIndex]);

  const prevPaymentsPendingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || filter !== 'action' || unresolved.length === 0) return undefined;
    setWizardIndex((i) => Math.min(i, unresolved.length - 1));
    return undefined;
  }, [isOpen, filter, unresolved.length]);

  useEffect(() => {
    if (!isOpen) {
      prevPaymentsPendingRef.current = false;
      return undefined;
    }
    const paymentsPending = unresolved.some((i) => i.fieldId === 'paymentsReconciliation');
    if (filter === 'action' && prevPaymentsPendingRef.current && !paymentsPending) {
      const paymentsResolvedByUser = resolvedByUser.some((i) => i.fieldId === 'paymentsReconciliation');
      if (paymentsResolvedByUser) setFilter('resolved');
    }
    prevPaymentsPendingRef.current = paymentsPending;
    return undefined;
  }, [isOpen, filter, unresolved, resolvedByUser]);

  const renderReviewItem = useCallback((item, { stepIdx = null, highlight = false, wizard = false } = {}) => {
    const key = reviewItemKey(item);
    if (item.fieldId === 'chainKindReview') {
      return (
        <ChainKindCard
          key={key}
          item={item}
          review={review}
          formData={formData}
          onResolveChainKind={onResolveChainKind}
          onRevoke={onRevokeResolution}
          highlight={highlight}
          wizard={wizard}
        />
      );
    }
    if (item.fieldId === 'paymentsReconciliation') {
      return (
        <PaymentClassificationCard
          key={key}
          item={item}
          formData={formData}
          review={review}
          onResolve={onResolveItem}
          stepIndex={stepIdx}
          highlight={highlight}
          wizard={wizard}
        />
      );
    }
    if (filter === 'complete') {
      return <CompleteReviewCard key={key} item={item} />;
    }
    if (filter === 'resolved') {
      if (item.fieldId === 'paymentsReconciliation') {
        return (
          <PaymentClassificationResolvedCard
            key={key}
            item={item}
            review={review}
            formData={formData}
            onRevoke={onRevokeResolution}
          />
        );
      }
      return (
        <ResolvedReviewCard
          key={key}
          item={item}
          review={review}
          formData={formData}
          onResolve={onResolveItem}
          onRevoke={onRevokeResolution}
        />
      );
    }
    return (
      <ActionReviewCard
        key={key}
        item={item}
        formData={formData}
        review={review}
        onResolve={onResolveItem}
        stepIndex={stepIdx}
        highlight={highlight}
        wizard={wizard}
      />
    );
  }, [
    review,
    formData,
    filter,
    onResolveChainKind,
    onRevokeResolution,
    onResolveItem,
  ]);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || !isOpen) return undefined;

    const onWheel = (e) => {
      if (!el.contains(e.target)) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const next = Math.min(maxScroll, Math.max(0, el.scrollTop + e.deltaY));
      if (next === el.scrollTop) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = next;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen, filter, tabItems.length, grouped.length]);

  if (!isOpen || !review) return null;

  const canClose = unresolved.length === 0;

  return (
    <Overlay
      data-khmdhs-review-modal
      onClick={(e) => e.target === e.currentTarget && onDismiss?.()}
    >
      <Card role="dialog" aria-modal="true" aria-labelledby="khmdhs-review-title">
        <Header>
          <Title id="khmdhs-review-title">Έλεγχος &amp; συμπλήρωση στοιχείων ΚΗΜΔΗΣ</Title>
          <Sub title="Ελέγχουμε τα στοιχεία που επιστρέφει ηλεκτρονικά το ΚΗΜΔΗΣ — όχι το έντυπο ή το PDF στον φάκελό σας.">
            Στοιχεία από ΚΗΜΔΗΣ — επιβεβαιώστε ή συμπληρώστε ό,τι λείπει.
          </Sub>
          {ctx.caseTitle ? (
            <CaseTitle title={ctx.caseTitle}>Υπόθεση: {ctx.caseTitle}</CaseTitle>
          ) : null}
          <HeaderMetaRow>
            <ProgressLabel>{doneCount} / {totalItems} ολοκληρωμένα</ProgressLabel>
            <ProgressBar aria-hidden>
              <ProgressFill $pct={progressPct} />
            </ProgressBar>
            <StatsRow>
              {unresolved.length > 0 && <StatChip>⏳ {unresolved.length}</StatChip>}
              {resolvedByUser.length > 0 && <StatChip>✔️ {resolvedByUser.length}</StatChip>}
              {completeItems.length > 0 && <StatChip>✅ {completeItems.length}</StatChip>}
            </StatsRow>
          </HeaderMetaRow>
        </Header>

        <Toolbar>
          <div>
            <FilterTabs>
              <FilterTab type="button" $active={filter === 'action'} onClick={() => setFilter('action')}>
                Εκκρεμή ({unresolved.length})
              </FilterTab>
              <FilterTab type="button" $active={filter === 'resolved'} onClick={() => setFilter('resolved')}>
                Ολοκληρωμένα από εσάς ({resolvedByUser.length})
              </FilterTab>
              <FilterTab type="button" $active={filter === 'complete'} onClick={() => setFilter('complete')}>
                Αυτόματα ({completeItems.length})
              </FilterTab>
            </FilterTabs>
            {filter === 'action' && unresolved.length > 0 && (
              <WorkflowSteps style={{ marginTop: '0.35rem' }}>
                <WorkflowStep $active={hasChainKindPending}>① Χαρακτηρισμός</WorkflowStep>
                <span>→</span>
                <WorkflowStep $active={!hasChainKindPending && hasFieldPending}>② Πεδία</WorkflowStep>
                <span>→</span>
                <WorkflowStep $active={!hasChainKindPending && !hasFieldPending && hasPaymentsPending}>③ Ειδοποιήσεις</WorkflowStep>
              </WorkflowSteps>
            )}
          </div>
        </Toolbar>

        <Body ref={bodyScrollRef}>
          <BodyInner>
            {filter !== 'complete' && (ctx.referenceIndex || []).length > 0 && (
              <ContextPanel>
                <ContextToggle
                  type="button"
                  aria-expanded={refsExpanded}
                  onClick={() => setRefsExpanded((v) => !v)}
                >
                  <ContextChevron $open={refsExpanded} aria-hidden>▶</ContextChevron>
                  <ContextTitle>Κωδικοί αναφοράς υπόθεσης ({(ctx.referenceIndex || []).length})</ContextTitle>
                </ContextToggle>
                {refsExpanded && (
                  <ContextBody>
                    <RefGrid>
                      {(ctx.referenceIndex || []).map((r) => (
                        <RefRow key={`${r.label}-${r.value}`}>
                          <strong>{r.label}</strong>
                          <code>{r.value}</code>
                        </RefRow>
                      ))}
                    </RefGrid>
                  </ContextBody>
                )}
              </ContextPanel>
            )}

            {filter === 'action' && unresolved.length > 0 && useWizardView && (
              <WizardBar>
                <WizardCounter>{safeWizardIndex + 1} / {unresolved.length}</WizardCounter>
                {currentWizardItem?.chainAdam ? (
                  <WizardAdam>{currentWizardItem.chainAdam}</WizardAdam>
                ) : null}
                <WizardHint>
                  {currentWizardGuide?.title || currentWizardItem?.label || 'Εκκρεμές στοιχείο'}
                </WizardHint>
                <WizardNavBtns>
                  <MiniBtn
                    type="button"
                    disabled={safeWizardIndex <= 0}
                    onClick={() => setWizardIndex((i) => Math.max(0, i - 1))}
                  >
                    ←
                  </MiniBtn>
                  <MiniBtn
                    type="button"
                    disabled={safeWizardIndex >= unresolved.length - 1}
                    onClick={() => setWizardIndex((i) => Math.min(unresolved.length - 1, i + 1))}
                  >
                    →
                  </MiniBtn>
                </WizardNavBtns>
              </WizardBar>
            )}

            {filter === 'action' && unresolved.length > 0 && !useWizardView && (
              <NextStepsPanel>
                <NextStepsTitle>Τι χρειάζεται τώρα ({unresolved.length})</NextStepsTitle>
                {unresolved.slice(0, 4).map((item, idx) => {
                  const key = reviewItemKey(item);
                  const guide = getReviewItemUserGuide(item);
                  return (
                    <NextStepRow
                      key={key}
                      type="button"
                      onClick={() => scrollToReviewItem(key, bodyScrollRef.current)}
                    >
                      <StepNum>{idx + 1}</StepNum>
                      <NextStepText>
                        <NextStepLabel>{guide.icon} {guide.title || item.label}</NextStepLabel>
                        <NextStepHint>{guide.hint || item.message || ''}</NextStepHint>
                      </NextStepText>
                    </NextStepRow>
                  );
                })}
                {unresolved.length > 4 && (
                  <ToolbarHint style={{ marginTop: '0.45rem', display: 'block' }}>
                    + {unresolved.length - 4} ακόμα — δείτε παρακάτω ανά ενότητα
                  </ToolbarHint>
                )}
              </NextStepsPanel>
            )}

            {filter === 'action' && applicableCount > 1 && onApplyAllSuggested && !useWizardView && (
              <ActionSummary style={{ background: '#eff6ff', borderColor: 'rgba(59,130,246,0.35)' }}>
                <ActionSummaryTitle style={{ color: '#1e40af' }}>Γρήγορη εφαρμογή</ActionSummaryTitle>
                <MiniBtn type="button" $primary onClick={onApplyAllSuggested}>
                  Εφαρμογή όλων των προτάσεων ΚΗΜΔΗΣ ({applicableCount})
                </MiniBtn>
              </ActionSummary>
            )}

            {useWizardView && currentWizardItem ? (
              <ActiveWizardShell>
                <ItemList>
                  {renderReviewItem(currentWizardItem, {
                    stepIdx: safeWizardIndex + 1,
                    highlight: highlightKey === reviewItemKey(currentWizardItem),
                    wizard: true,
                  })}
                </ItemList>
              </ActiveWizardShell>
            ) : grouped.length === 0 ? (
              <EmptyFilter>
                {filter === 'action' && 'Όλα τα εκκρεμή στοιχεία έχουν επιλυθεί.'}
                {filter === 'resolved' && 'Δεν υπάρχουν επιλυμένα πεδία από εσάς ακόμα.'}
                {filter === 'complete' && 'Δεν υπάρχουν αυτόματα πλήρη πεδία.'}
              </EmptyFilter>
            ) : (
              grouped.map((group) => (
                <SectionBlock key={group.section}>
                  <SectionHead>
                    <SectionTitle>{group.sectionLabel}</SectionTitle>
                    <SectionCount>{group.items.length}</SectionCount>
                  </SectionHead>
                  <ItemList>
                    {group.items.map((item) => {
                      const key = reviewItemKey(item);
                      const stepIdx = stepIndexByKey.get(key) ?? null;
                      const isHighlighted = highlightKey === key;
                      return renderReviewItem(item, { stepIdx, highlight: isHighlighted });
                    })}
                  </ItemList>
                </SectionBlock>
              ))
            )}
          </BodyInner>
        </Body>

        <Footer>
          {!canClose && (
            <FooterHint>
              Επιβεβαιώστε κάθε εκκρεμές πεδίο πριν κλείσετε. Εκκρεμή: {unresolved.length}.
            </FooterHint>
          )}
          <GhostBtn type="button" onClick={onDismiss}>
            {canClose ? 'Κλείσιμο' : 'Θα το ελέγξω αργότερα'}
          </GhostBtn>
          {canClose && (
            <PrimaryBtn type="button" onClick={() => onConfirm?.()}>
              Ολοκλήρωση ελέγχου
            </PrimaryBtn>
          )}
        </Footer>
      </Card>
    </Overlay>
  );
}

export function KhmdhsDataReviewBanner({ review, formData, onOpenReview }) {
  const unresolved = sortReviewItemsByUserPriority(getUnresolvedReviewItems(review, formData));
  if (!review?.hasActionRequired || unresolved.length === 0) return null;

  const nextGuide = getReviewItemUserGuide(unresolved[0]);

  return (
    <BannerWrap>
      <BannerTitle>⚠️ Εκκρεμή στοιχεία ΚΗΜΔΗΣ ({unresolved.length})</BannerTitle>
      <BannerText>
        {nextGuide.hint
          ? `Επόμενο βήμα: ${nextGuide.title} — ${nextGuide.hint}`
          : 'Ανοίξτε τον έλεγχο για χαρακτηρισμό εγγράφων, συμπλήρωση πεδίων και επιβεβαίωση ειδοποιήσεων.'}
      </BannerText>
      {onOpenReview && (
        <BannerBtn type="button" onClick={() => onOpenReview(reviewItemKey(unresolved[0]))}>
          {nextGuide.cta || 'Άνοιγμα ελέγχου'} →
        </BannerBtn>
      )}
    </BannerWrap>
  );
}

export function KhmdhsChainReviewHints({ review, formData, onOpenReview }) {
  const items = getUnresolvedReviewItems(review, formData).filter((i) => i.fieldId === 'chainKindReview');
  if (!items.length) return null;

  return (
    <>
      {items.map((item) => (
        <FieldReviewHint key={reviewItemKey(item)} $missing={false}>
          ⚠️ {item.label} — {item.message || 'Ασυμφωνία χαρακτηρισμού'}
          {onOpenReview && (
            <FieldReviewHintActions>
              <MiniBtn
                type="button"
                $primary
                onClick={() => onOpenReview(reviewItemKey(item))}
              >
                Έλεγχος στην αναφορά
              </MiniBtn>
            </FieldReviewHintActions>
          )}
        </FieldReviewHint>
      ))}
    </>
  );
}

export function KhmdhsFieldReviewHint({
  review, formData, fieldId, contractIndex, supplementaryIndex, onOpenReview,
}) {
  const item = (review?.items || []).find((i) => {
    if (i.fieldId !== fieldId) return false;
    if (supplementaryIndex != null) return i.supplementaryIndex === supplementaryIndex;
    if (contractIndex != null) return i.contractIndex === contractIndex;
    return i.contractIndex == null && i.supplementaryIndex == null && !i.chainAdam;
  });
  if (!item || !isReviewItemUnresolved(review, formData, item)) return null;

  const guide = getReviewItemUserGuide(item);
  const missing = item.status === KHMDHS_REVIEW_STATUS.MISSING;
  const itemKey = reviewItemKey(item);

  return (
    <FieldReviewHint $missing={missing}>
      <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
        {guide.icon} {guide.title || item.label}
      </strong>
      {guide.hint || item.message || (missing ? 'Λείπει από την ηλεκτρονική καταχώριση' : 'Χρειάζεται έλεγχος')}
      {onOpenReview && (
        <FieldReviewHintActions>
          <MiniBtn type="button" $primary onClick={() => onOpenReview(itemKey)}>
            {guide.cta || 'Άνοιγμα ελέγχου'} →
          </MiniBtn>
        </FieldReviewHintActions>
      )}
    </FieldReviewHint>
  );
}

const BannerWrap = styled.div`
  margin: 0.75rem 0 0.25rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.45);
  background: #fffbeb;
`;

const BannerTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 0.25rem;
`;

const BannerText = styled.p`
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #78350f;
`;

const BannerBtn = styled.button`
  margin-top: 0.55rem;
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  background: #f59e0b;
  color: #fff;

  &:hover {
    background: #d97706;
  }
`;
