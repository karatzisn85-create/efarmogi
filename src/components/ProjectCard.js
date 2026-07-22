import React, { useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  PROJECT_STATUS_ABANDONED,
  isAbandonedSubproject,
  getCharacterization,
  getProjectTypeBadgeColors,
  normalizeProjectType
} from '../data/formOptions';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { getKhmdhsChainFreshness } from '../utils/khmdhsChainRefresh';
import { getSubprojectActRootReq } from '../utils/khmdhsBranchAnchor';
import { formatDateEl } from '../utils/dateFormat';
import KhmdhsFreshnessBadge from './KhmdhsFreshnessBadge';
import KhmdhsLifecycleRail from './KhmdhsLifecycleRail';
import LinkedNoteSticker, { getEntityLinkedNotes } from './LinkedNoteSticker';
import {
  buildProjectCardContractRows,
  shouldShowContractZone,
  shouldShowProcedureZone,
  formatAleCodes,
} from '../utils/projectCardDisplay';
import { getProjectAssignmentProcedure } from '../utils/khmdhsNoticeFields';
import { evaluateKhmdhsContractExpiryPrompt } from '../utils/khmdhsContractExpiryPrompt';
import KhmdhsContractExpiryPromptDialog from './KhmdhsContractExpiryPromptDialog';

const iconProps = { width: 14, height: 14, 'aria-hidden': true };

export const STATUS_COLORS = {
  'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': {
    primary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    shadow: 'rgba(245,158,11,0.32)',
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fcd34d',
  },
  'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': {
    primary: '#ea580c',
    gradient: 'linear-gradient(135deg, #fb923c, #ea580c)',
    shadow: 'rgba(234,88,12,0.32)',
    bg: '#ffedd5',
    text: '#7c2d12',
    border: '#fdba74',
  },
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': {
    primary: '#2563eb',
    gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)',
    shadow: 'rgba(37,99,235,0.32)',
    bg: '#dbeafe',
    text: '#1e3a8a',
    border: '#93c5fd',
  },
  'ΟΛΟΚΛΗΡΩΜΕΝΟ': {
    primary: '#059669',
    gradient: 'linear-gradient(135deg, #34d399, #059669)',
    shadow: 'rgba(5,150,105,0.32)',
    bg: '#d1fae5',
    text: '#064e3b',
    border: '#6ee7b7',
  },
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': {
    primary: '#0d9488',
    gradient: 'linear-gradient(135deg, #2dd4bf, #0d9488)',
    shadow: 'rgba(13,148,136,0.32)',
    bg: '#ccfbf1',
    text: '#134e4a',
    border: '#5eead4',
  },
  [PROJECT_STATUS_ABANDONED]: {
    primary: '#64748b',
    gradient: 'repeating-linear-gradient(135deg, #94a3b8 0, #94a3b8 6px, #cbd5e1 6px, #cbd5e1 12px)',
    shadow: 'rgba(100,116,139,0.22)',
    bg: '#f1f5f9',
    text: '#475569',
    border: '#94a3b8',
  },
};

const DEFAULT_STATUS_COLOR = {
  primary: '#64748b',
  gradient: 'linear-gradient(135deg, #94a3b8, #64748b)',
  shadow: 'rgba(100,116,139,0.32)',
  bg: '#f1f5f9',
  text: '#334155',
  border: '#cbd5e1',
};

export function getStatusColor(status) {
  return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
}

function IconCredit() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 11H4a1 1 0 0 0-1 1z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const Card = styled.div`
  background: linear-gradient(165deg, #ffffff 0%, #f8fafc 100%);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  padding: 1.25rem 1.35rem 1.15rem;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.32s ease, border-color 0.32s ease;
  border: 1.5px solid rgba(203, 213, 225, 0.9);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 320px;
  cursor: pointer;
  position: relative;
  overflow: visible;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${(props) => props.$statusGrad || 'linear-gradient(90deg, #6366f1, #8b5cf6)'};
    border-radius: 18px 18px 0 0;
    opacity: 0.9;
    transition: opacity 0.35s ease, height 0.25s ease;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow:
      0 16px 36px ${(props) => props.$statusShadow || 'rgba(99, 102, 241, 0.14)'},
      0 4px 12px rgba(15, 23, 42, 0.06);
    border-color: rgba(165, 180, 252, 0.55);

    &::before {
      opacity: 1;
      height: 5px;
    }
  }

  ${props => props.$abandoned && css`
    opacity: 0.88;
    border: 2px dashed #94a3b8;
    background: linear-gradient(160deg, #f8fafc 0%, #f1f5f9 55%, #e2e8f0 100%);
    filter: grayscale(0.35);

    &::before {
      opacity: 0.55;
      height: 3px;
    }

    &:hover {
      transform: translateY(-2px);
      opacity: 0.95;
      border-color: #64748b;
      filter: grayscale(0.2);
    }
  `}
`;

const AbandonedRibbon = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  background: #64748b;
  color: #f8fafc;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.28rem 0.55rem;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(71, 85, 105, 0.35);
  pointer-events: none;
`;

const ViewDetailsHint = styled.div`
  text-align: center;
  font-size: 0.65rem;
  color: #64748b;
  margin-top: 0.45rem;
  letter-spacing: 0.02em;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.3s ease;

  ${Card}:hover & {
    opacity: 1;
  }
`;

const CardHeader = styled.div`
  margin: -1.25rem -1.35rem 0.85rem;
  padding: 0.95rem 3.25rem 0.85rem 1.35rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(255, 255, 255, 0.55) 100%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 16px 16px 0 0;
`;

const CardKindLabel = styled.span`
  display: block;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6366f1;
  margin-bottom: 0.3rem;
`;

const TypeBadgeProminent = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
  background: ${(props) => getProjectTypeBadgeColors(props.type).bg};
  color: ${(props) => getProjectTypeBadgeColors(props.type).color};
  border: 1px solid ${(props) => getProjectTypeBadgeColors(props.type).color}33;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.07);
`;

const StatusStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
  padding: 0.45rem 0.6rem;
  border-radius: 11px;
  background: ${(p) => p.$bg || 'rgba(248, 250, 252, 0.9)'};
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};
`;

const HeaderTopRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
`;

const ChargeHeaderStrip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  margin-top: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  background: linear-gradient(105deg, rgba(238, 242, 255, 0.95) 0%, rgba(255, 255, 255, 0.88) 100%);
  border: 1px solid rgba(129, 140, 248, 0.42);
  box-shadow: 0 1px 5px rgba(99, 102, 241, 0.1);
`;

const ChargeHeaderLine = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.4;
`;

const ChargeHeaderRole = styled.span`
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6366f1;
  padding-top: 0.12rem;
  min-width: 5.5rem;
`;

const ChargeHeaderName = styled.span`
  font-weight: 700;
  color: #312e81;
  word-break: break-word;
`;

const ChargeHeaderAux = styled.span`
  font-weight: 600;
  color: #475569;
  word-break: break-word;
`;

const HeaderMetaTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.45rem;
`;

const MetaTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: ${(p) => p.$color || '#64748b'};
  background: ${(p) => p.$bg || '#f8fafc'};
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};
  white-space: nowrap;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.38rem 0.8rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.2;
  color: ${(p) => p.$text || '#334155'};
  background: ${(p) => p.$bg || '#f1f5f9'};
  border: 1px solid ${(p) => p.$border || '#e2e8f0'};
  box-shadow: 0 1px 3px ${(p) => p.$shadow || 'rgba(15, 23, 42, 0.06)'};
  max-width: 100%;

  &::before {
    content: '';
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${(p) => p.$primary || '#64748b'};
    box-shadow: 0 0 0 3px ${(p) => `${p.$primary || '#64748b'}30`};
  }
`;

const OverviewDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.9), transparent);
`;

const TitleBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
`;

const OverviewPanel = styled.div`
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 0.75rem 0.85rem;
  display: grid;
  gap: 0.65rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: box-shadow 0.28s ease;

  ${Card}:hover & {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 2px 10px rgba(15, 23, 42, 0.04);
  }
`;

const CardSection = styled.section`
  border-radius: 14px;
  background: ${(p) => p.$tint || 'rgba(255, 255, 255, 0.65)'};
  border: 1px solid rgba(226, 232, 240, 0.7);
  padding: 0.65rem 0.75rem 0.7rem 0.88rem;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.28s ease, border-color 0.28s ease;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    background: ${(p) => p.$accent || '#6366f1'};
    border-radius: 0 3px 3px 0;
    opacity: 0.75;
  }

  ${Card}:hover & {
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
    border-color: rgba(203, 213, 225, 0.9);
  }
`;

const SectionHeader = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-bottom: 0.5rem;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
`;

const MetaCell = styled.div`
  min-width: 0;

  ${(p) => p.$full && 'grid-column: 1 / -1;'}
`;

const MetaLabel = styled.div`
  font-size: 0.62rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.15rem;
`;

const MetaValue = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #1e293b;
  word-break: break-word;
  line-height: 1.38;
`;

const FinanceRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
`;

const FinanceBox = styled.div`
  padding: 0.55rem 0.5rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(16, 185, 129, 0.22);
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  ${Card}:hover & {
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
  }
`;

const FinanceBoxLabel = styled.div`
  font-size: 0.6rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.2rem;
`;

const FinanceBoxValue = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: #059669;
  letter-spacing: 0.01em;
`;

const CommentsBlock = styled.div`
  font-size: 0.78rem;
  line-height: 1.45;
  color: #475569;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px dashed rgba(148, 163, 184, 0.4);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const SupplementaryHint = styled.div`
  font-size: 0.68rem;
  line-height: 1.35;
  color: #64748b;
  font-family: ui-monospace, monospace;
  margin-top: 0.15rem;
`;

const AmendmentsLine = styled.div`
  font-size: 0.74rem;
  line-height: 1.4;
  color: #64748b;
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px dashed rgba(203, 213, 225, 0.7);
`;

const ContractExpiryBanner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
  margin: 0.35rem 0 0.15rem;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #92400e;
`;

const ContractExpiryBannerText = styled.span`
  flex: 1 1 12rem;
`;

const ContractExpiryBannerButton = styled.button`
  flex: 0 0 auto;
  border: none;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  background: #f59e0b;
  color: #fff;

  &:hover {
    background: #d97706;
  }
`;

const ContractRowBlock = styled.div`
  padding: 0.55rem 0.62rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(199, 210, 254, 0.45);

  &:not(:last-child) {
    margin-bottom: 0.45rem;
  }
`;

const ContractRowTitle = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4338ca;
  margin-bottom: 0.4rem;
`;

const IdentityStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
`;

const KhmdhsContractLine = styled.div`
  font-size: 0.78rem;
  line-height: 1.45;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.18);

  &:not(:last-child) {
    margin-bottom: 0.35rem;
  }

  strong {
    color: #4338ca;
    font-weight: 700;
  }
`;

const SubprojectTitle = styled.h4`
  color: #0f172a;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.01em;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  flex: 1;
  min-width: 0;
`;

const MisPraxhsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: transparent;
  color: #000000;
  border: none;
  border-radius: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  box-shadow: none;
  white-space: nowrap;
`;

const EpLinkBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1.5px solid #6ee7b7;
  color: #065f46;
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 10.5px;
  font-weight: 800;
  margin-left: 8px;
  letter-spacing: 0.25px;
  vertical-align: middle;
  white-space: nowrap;
  box-shadow: 0 0 0 3px rgba(110,231,183,0.2), 0 1px 4px rgba(5,150,105,0.12);
  text-transform: uppercase;
  cursor: default;
  transition: box-shadow 0.15s;
  &:hover {
    box-shadow: 0 0 0 4px rgba(110,231,183,0.3), 0 2px 8px rgba(5,150,105,0.18);
  }
`;

function formatEpDisplayCode(epLinkedAction) {
  if (!epLinkedAction?.axisCode) return 'ΕΠ';
  const mc = epLinkedAction.measureCode;
  if (!mc) return epLinkedAction.axisCode;
  const parts = mc.split('.');
  if (parts.length > 1) return `${epLinkedAction.axisCode}.${parts.slice(1).join('.')}`;
  return mc;
}


const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 1;
  align-content: start;
`;

const InfoRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 0.5rem;
  align-items: start;
`;

const InfoLabel = styled.span`
  font-weight: 600;
  color: #64748b;
  font-size: 0.8rem;
  letter-spacing: 0.2px;
`;

const InfoValue = styled.span`
  color: #1e293b;
  font-size: 0.85rem;
  word-break: break-word;
  font-weight: 500;
`;

const BudgetBarWrap = styled.div`
  margin: 0.15rem 0 0;
  padding: 0.55rem 0.65rem;
  background: rgba(248, 250, 252, 0.85);
  border-radius: 10px;
  border: 1px solid rgba(226, 232, 240, 0.55);
`;

const BudgetBarLabels = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
`;

const BudgetBarLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.2px;
`;

const BudgetBarPct = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${props => {
    if (props.$pct >= 100) return '#059669';
    if (props.$pct >= 70) return '#2563eb';
    if (props.$pct >= 30) return '#f59e0b';
    return '#94a3b8';
  }};
`;

const BudgetBarTrack = styled.div`
  height: 6px;
  background: rgba(226, 232, 240, 0.8);
  border-radius: 99px;
  overflow: hidden;
`;

const BudgetBarFill = styled.div`
  height: 100%;
  width: ${props => Math.min(100, props.$pct || 0)}%;
  background: ${props => {
    if (props.$pct >= 100) return 'linear-gradient(90deg, #34d399, #059669)';
    if (props.$pct >= 70) return 'linear-gradient(90deg, #60a5fa, #2563eb)';
    if (props.$pct >= 30) return 'linear-gradient(90deg, #fbbf24, #f59e0b)';
    return 'linear-gradient(90deg, #cbd5e1, #94a3b8)';
  }};
  border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
`;

const HoverPreview = styled.div`
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  background: rgba(15, 23, 42, 0.97);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-top: 3px solid ${props => props.$statusPrimary || '#6366f1'};
  border-radius: 12px;
  padding: 0.9rem 1rem;
  z-index: 300;
  pointer-events: none;
  opacity: 0;
  transform: translateY(6px) scale(0.98);
  transition: opacity 0.22s ease, transform 0.22s ease;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.15);

  ${Card}:hover & {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const HoverPreviewTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(148, 163, 184, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
`;

const HoverPreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const HoverPreviewItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const HoverPreviewItemLabel = styled.span`
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(100, 116, 139, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const HoverPreviewItemValue = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HoverPreviewBudgetBar = styled.div`
  margin-top: 0.6rem;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  overflow: hidden;
`;

const HoverPreviewBudgetFill = styled.div`
  height: 100%;
  width: ${props => Math.min(100, props.$pct || 0)}%;
  background: ${props => props.$statusGrad || 'linear-gradient(90deg, #6366f1, #8b5cf6)'};
  border-radius: 99px;
`;

const CharacterizationBadge = styled.span`
  display: inline-block;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  background: ${(props) => (props.$type === 'ΝΕΟ' ? '#eff6ff' : '#fffbeb')};
  color: ${(props) => (props.$type === 'ΝΕΟ' ? '#1d4ed8' : '#b45309')};
  border: 1px solid ${(props) => (props.$type === 'ΝΕΟ' ? '#bfdbfe' : '#fde68a')};
`;

const TypeBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${(props) => getProjectTypeBadgeColors(props.type).bg};
  color: ${(props) => getProjectTypeBadgeColors(props.type).color};
`;

const AmountValue = styled.span`
  font-weight: 600;
  color: #28a745;
`;

const ContractDateLabel = styled(InfoLabel)`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.95rem;
`;

const ContractDateValue = styled(InfoValue)`
  font-weight: 600;
  color: #5c6bc0;
  font-size: 1rem;
`;

const ContractAmountLabel = styled(InfoLabel)`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.95rem;
`;

const ContractAmountValue = styled(InfoValue)`
  font-weight: 700;
  color: #28a745;
  font-size: 1rem;
`;

const ContractInfo = styled.div`
  background: linear-gradient(145deg, rgba(238, 242, 255, 0.55) 0%, rgba(248, 250, 252, 0.95) 100%);
  border-radius: 12px;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgba(165, 180, 252, 0.35);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #6366f1, #818cf8);
    border-radius: 3px 0 0 3px;
  }
`;

const ContractTitle = styled.div`
  font-weight: 800;
  color: #4338ca;
  margin-bottom: 0.55rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const MultipleContracts = styled.div`
  display: grid;
  gap: 0.8rem;
`;

const ContractItem = styled.div`
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  border: 1px solid #dee2e6;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px dashed rgba(203, 213, 225, 0.85);
  flex-shrink: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(248, 250, 252, 0.5) 100%);
  margin-left: -0.15rem;
  margin-right: -0.15rem;
  padding-left: 0.15rem;
  padding-right: 0.15rem;
`;

const TopButtonsContainer = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  width: 100%;
`;

const BottomButtonContainer = styled.div`
  width: 100%;
`;

const ToolbarButton = styled.button`
  flex: 1 1 0;
  min-width: 0;
  padding: 0.5rem 0.45rem;
  border-radius: 8px;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);

  svg {
    flex-shrink: 0;
    color: #64748b;
  }

  &:hover svg {
    color: #334155;
  }

  &:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.07);
  }

  &:active {
    background: #f1f5f9;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  ${(p) =>
    p.$tone === 'success' &&
    css`
      background: #f0fdf4;
      border-color: #86efac;
      color: #14532d;

      &:hover {
        background: #dcfce7;
        border-color: #4ade80;
      }

      svg {
        color: #15803d;
      }

      &:hover svg {
        color: #166534;
      }
    `}
`;

const MainFilesButton = styled.button`
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  color: #f8fafc;
  background: #1e293b;
  border: 1px solid #334155;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);

  svg {
    flex-shrink: 0;
    color: #cbd5e1;
  }

  &:hover svg {
    color: #f1f5f9;
  }

  &:hover {
    background: #334155;
    border-color: #475569;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
  }

  &:active {
    background: #0f172a;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const reportFloat = keyframes`
  0%, 100% {
    transform: translateY(-50%) translateY(0px) rotate(-2deg);
    box-shadow:
      0 14px 28px rgba(99, 102, 241, 0.38),
      0 6px 12px rgba(15, 23, 42, 0.12),
      0 0 0 1px rgba(255, 255, 255, 0.45) inset;
  }
  50% {
    transform: translateY(-50%) translateY(-8px) rotate(2deg);
    box-shadow:
      0 22px 40px rgba(139, 92, 246, 0.45),
      0 10px 18px rgba(15, 23, 42, 0.14),
      0 0 0 1px rgba(255, 255, 255, 0.55) inset;
  }
`;

const ReportFab = styled.button`
  position: absolute;
  right: -16px;
  top: 46%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  border: none;
  border-radius: 15px;
  cursor: pointer;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: linear-gradient(145deg, #818cf8 0%, #6366f1 42%, #a855f7 100%);
  animation: ${reportFloat} 3.2s ease-in-out infinite;
  transition: transform 0.25s ease, filter 0.25s ease;
  pointer-events: auto;

  &::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 18px;
    background: linear-gradient(145deg, rgba(129, 140, 248, 0.35), rgba(168, 85, 247, 0.2));
    filter: blur(8px);
    z-index: -1;
    opacity: 0.85;
  }

  svg {
    filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.25));
  }

  &:hover {
    animation: none;
    transform: translateY(-50%) translateY(-6px) scale(1.1) rotate(0deg);
    filter: brightness(1.08);
  }

  &:active {
    transform: translateY(-50%) scale(0.96);
  }

  &:focus-visible {
    outline: 2px solid #c4b5fd;
    outline-offset: 3px;
  }

  &:disabled {
    opacity: 0.65;
    cursor: wait;
    animation: none;
    transform: translateY(-50%);
  }
`;

const ReportFabTooltip = styled.span`
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: rgba(15, 23, 42, 0.94);
  color: #f8fafc;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);

  ${ReportFab}:hover & {
    opacity: 1;
    visibility: visible;
  }

  &::after {
    content: '';
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 5px solid transparent;
    border-left-color: rgba(15, 23, 42, 0.94);
  }
`;

function IconReport() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
      <path d="M16 3l4 4" strokeWidth="1.8" />
    </svg>
  );
}

const LockStatusButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: ${(props) => (props.isLocked ? '#dc3545' : '#28a745')};
  color: white;
  font-size: 0.68rem;
  font-weight: bold;
  cursor: default;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
  z-index: 12;
  pointer-events: none;
`;

// Tooltip για το lock status
const LockTooltip = styled.div`
  position: absolute;
  top: -35px;
  right: 0;
  background: #333;
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 20;

  ${LockStatusButton}:hover & {
    opacity: 1;
    visibility: visible;
  }

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 10px;
    border: 4px solid transparent;
    border-top-color: #333;
  }
`;


function ProjectCard({
  project,
  userRole,
  onEdit,
  onViewFile,
  onDownloadFile,
  onDeleteFile,
  onOpenFileManager,
  onOpenEntaxis,
  onOpenEgkriseis,
  hasCreditApproval = false,
  hasLinkedEgkrisi = false,
  linkedProsklisi,
  onOpenLinkedProsklisi,
  isLocked = false,
  hasEntaxi = false,
  onOpenSpecificEntaxi,
  hasProsklisi = false,
  onOpenSpecificProsklisi,
  hasMeleti = false,
  onOpenSpecificMeleti,
  onViewDetails,
  engineerCatalog = [],
  linkedNotesMap = {},
  notes = [],
  onOpenNoteFromEntity,
  portalEnabled = false,
  isPublishedToPortal = false,
  epLinkedAction = null,
  hasDirectAssignmentViolation = false,
  onExportReport,
  actRootSiblingsIndex = null,
  onContractExpiryAccept,
}) {
  const [exportingReport, setExportingReport] = useState(false);
  const [contractExpiryPrompt, setContractExpiryPrompt] = useState(null);
  const statusColor = getStatusColor(project.projectStatus);
  const isAbandoned = isAbandonedSubproject(project);
  const canSuggestStatus = userRole !== 'USER' && userRole !== 'ENGINEER';
  const contractExpiryEval = useMemo(
    () => (canSuggestStatus ? evaluateKhmdhsContractExpiryPrompt(project) : null),
    [project, canSuggestStatus]
  );

  const handleCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    if (onViewDetails) onViewDetails(project);
  };

  const handleToggleFiles = () => {
    onOpenFileManager(project.projectId, project.subprojectId);
  };

  const handleExportReport = async (e) => {
    e.stopPropagation();
    if (!onExportReport || exportingReport) return;
    setExportingReport(true);
    try {
      await onExportReport(project);
    } finally {
      setExportingReport(false);
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00 €';
    return `${amount} €`;
  };

  const formatDate = (dateString) => formatDateEl(dateString, '-');

  const characterization = getCharacterization(project);
  const aleDisplay = formatAleCodes(project);
  const contractRows = useMemo(() => buildProjectCardContractRows(project), [project]);
  const showProcedureZone = shouldShowProcedureZone(project);
  const showContractZone = shouldShowContractZone(project);

  const { displayChargePrimary, displayChargeParticipants } = useMemo(
    () => getProjectChargeDisplay(project, engineerCatalog),
    [project, engineerCatalog]
  );

  const linkedNotes = getEntityLinkedNotes(linkedNotesMap, project.subprojectId);

  const chainFreshness = useMemo(
    () => getKhmdhsChainFreshness(project),
    [project]
  );

  const actRootSiblings = useMemo(() => {
    const root = getSubprojectActRootReq(project);
    if (!root || !actRootSiblingsIndex) return [];
    const bucket = actRootSiblingsIndex.get(root) || [];
    return bucket.filter((p) => p.subprojectId !== project.subprojectId);
  }, [project, actRootSiblingsIndex]);

  const renderContractRow = (row, key) => (
    <ContractRowBlock key={key}>
      {row.label && <ContractRowTitle>{row.label}</ContractRowTitle>}
      <MetaGrid>
        {row.date && (
          <MetaCell>
            <MetaLabel>Ημ. σύμβασης</MetaLabel>
            <MetaValue style={{ color: '#4338ca', fontWeight: 700 }}>{formatDate(row.date)}</MetaValue>
          </MetaCell>
        )}
        {row.amount && (
          <MetaCell>
            <MetaLabel>Ποσό</MetaLabel>
            <MetaValue style={{ color: '#059669', fontWeight: 800 }}>{formatAmount(row.amount)}</MetaValue>
          </MetaCell>
        )}
        {row.deadline && (
          <MetaCell $full>
            <MetaLabel>{row.deadline.label}</MetaLabel>
            <MetaValue>{row.deadline.value}</MetaValue>
          </MetaCell>
        )}
        {row.apeAmount && (
          <MetaCell>
            <MetaLabel>ΑΠΕ</MetaLabel>
            <MetaValue style={{ color: '#059669' }}>{formatAmount(row.apeAmount)}</MetaValue>
          </MetaCell>
        )}
        {row.supplementarySummary?.displayAmount && (
          <MetaCell>
            <MetaLabel>{row.supplementarySummary.label}</MetaLabel>
            <MetaValue style={{ color: '#16a34a', fontWeight: 800 }}>
              {row.supplementarySummary.count === 1 && row.supplementarySummary.items[0]?.amount
                ? formatAmount(row.supplementarySummary.displayAmount)
                : `${row.supplementarySummary.displayAmount} €`}
            </MetaValue>
            {row.supplementarySummary.count === 1 && row.supplementarySummary.items[0]?.adam ? (
              <SupplementaryHint>{row.supplementarySummary.items[0].adam}</SupplementaryHint>
            ) : null}
          </MetaCell>
        )}
        {(row.contractorName || row.contractorVat) && (
          <MetaCell $full>
            <MetaLabel>Ανάδοχος</MetaLabel>
            <MetaValue>
              {row.contractorName || '—'}
              {row.contractorVat ? (
                <span style={{ color: '#64748b', fontWeight: 500 }}> · ΑΦΜ {row.contractorVat}</span>
              ) : null}
            </MetaValue>
          </MetaCell>
        )}
      </MetaGrid>
      {row.amendmentsLine ? (
        <AmendmentsLine>Τροποποιήσεις / παρατάσεις: {row.amendmentsLine}</AmendmentsLine>
      ) : null}
    </ContractRowBlock>
  );

  return (
    <>
      <Card
        onClick={handleCardClick}
        $statusGrad={statusColor.gradient}
        $statusShadow={statusColor.shadow}
        $abandoned={isAbandoned}
      >
        {isAbandoned && <AbandonedRibbon>Απενταγμένο</AbandonedRibbon>}
        {linkedNotes.length > 0 && (
          <LinkedNoteSticker links={linkedNotes} onOpenNote={onOpenNoteFromEntity} placement="top-left" />
        )}
        {/* Lock Status Button */}
        <LockStatusButton isLocked={isLocked}>
          {isLocked ? '🔒' : '🔓'}
          <LockTooltip>
            {isLocked ? 'Ανοιχτό από άλλον χρήστη' : 'Διαθέσιμο'}
          </LockTooltip>
        </LockStatusButton>

        {onExportReport && (
          <ReportFab
            type="button"
            title="Λήψη αναφοράς υποέργου (PDF)"
            disabled={exportingReport}
            onClick={handleExportReport}
            aria-label="Λήψη αναφοράς υποέργου"
          >
            <IconReport />
            <ReportFabTooltip>
              {exportingReport ? 'Δημιουργία αναφοράς…' : 'Αναφορά υποέργου'}
            </ReportFabTooltip>
          </ReportFab>
        )}
        
        <CardHeader>
          <CardKindLabel>Υποέργο</CardKindLabel>
          <HeaderTopRow>
            <SubprojectTitle>{project.subprojectTitle}</SubprojectTitle>
            {chainFreshness.level !== 'none' && (
              <KhmdhsFreshnessBadge
                freshness={chainFreshness}
                compact
                title={chainFreshness.label}
              />
            )}
          </HeaderTopRow>

          {(displayChargePrimary || displayChargeParticipants) && (
            <ChargeHeaderStrip onClick={(e) => e.stopPropagation()}>
              {displayChargePrimary && (
                <ChargeHeaderLine>
                  <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1.2 }}>👷</span>
                  <ChargeHeaderRole>Επιβλέπων</ChargeHeaderRole>
                  <ChargeHeaderName>{displayChargePrimary}</ChargeHeaderName>
                </ChargeHeaderLine>
              )}
              {displayChargeParticipants && (
                <ChargeHeaderLine>
                  <span aria-hidden style={{ fontSize: '0.85rem', lineHeight: 1.2, opacity: 0.85 }}>🤝</span>
                  <ChargeHeaderRole>Βοηθούν</ChargeHeaderRole>
                  <ChargeHeaderAux>{displayChargeParticipants}</ChargeHeaderAux>
                </ChargeHeaderLine>
              )}
            </ChargeHeaderStrip>
          )}

          {(portalEnabled && isPublishedToPortal) || (project.misPraxhsName && project.misPraxhsCode) || epLinkedAction || hasDirectAssignmentViolation || actRootSiblings.length > 0 ? (
            <HeaderMetaTags>
              {actRootSiblings.length > 0 && (
                <MetaTag
                  $color="#5b21b6"
                  $bg="#f5f3ff"
                  $border="#c4b5fd"
                  title={actRootSiblings.map((s) => s.subprojectTitle).join('\n')}
                >
                  Κοινή πράξη · {actRootSiblings.length + 1} υποέργα
                </MetaTag>
              )}
              {project.misPraxhsName && project.misPraxhsCode && (
                <MetaTag $color="#475569" $bg="#f8fafc" $border="#e2e8f0">
                  {project.misPraxhsName}: {project.misPraxhsCode}
                </MetaTag>
              )}
              {epLinkedAction && (
                <MetaTag
                  $color="#065f46"
                  $bg="#ecfdf5"
                  $border="#6ee7b7"
                  title={`Επιχειρησιακό Πρόγραμμα — Δράση #${epLinkedAction.aa || '—'}: ${epLinkedAction.title || ''}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'default' }}
                >
                  Επιχειρησιακό
                </MetaTag>
              )}
              {portalEnabled && isPublishedToPortal && (
                <MetaTag $color="#1d4ed8" $bg="#eff6ff" $border="#93c5fd">
                  Portal
                </MetaTag>
              )}
              {hasDirectAssignmentViolation && (
                <MetaTag $color="#b45309" $bg="#fffbeb" $border="#fcd34d" title="Πιθανή παράβαση κανόνα 12 μηνών">
                  ⚠ 12μ.
                </MetaTag>
              )}
            </HeaderMetaTags>
          ) : null}
        </CardHeader>

        <CardContent>
        <KhmdhsLifecycleRail project={project} variant="compact" freshness={chainFreshness} />

        <CardSection $accent="#6366f1" $tint="rgba(238, 242, 255, 0.35)">
          <SectionHeader>Ταυτότητα</SectionHeader>
          <IdentityStrip>
            <TypeBadgeProminent type={project.projectType}>
              {normalizeProjectType(project.projectType)}
            </TypeBadgeProminent>
            <StatusPill
              $primary={statusColor.primary}
              $bg={statusColor.bg}
              $text={statusColor.text}
              $border={statusColor.border}
              $shadow={statusColor.shadow}
            >
              {project.projectStatus}
            </StatusPill>
            {characterization && (
              <CharacterizationBadge $type={characterization}>
                {characterization}
              </CharacterizationBadge>
            )}
          </IdentityStrip>
          {aleDisplay && (
            <div style={{ marginTop: '0.55rem' }}>
              <MetaLabel>Κωδ. Α.Λ.Ε.</MetaLabel>
              <MetaValue>{aleDisplay}</MetaValue>
            </div>
          )}
        </CardSection>

        <CardSection $accent="#059669" $tint="rgba(236, 253, 245, 0.45)">
          <SectionHeader>Χρηματοδότηση</SectionHeader>
          <MetaGrid>
            <MetaCell>
              <MetaLabel>Πηγή</MetaLabel>
              <MetaValue>{project.fundingSource || '—'}</MetaValue>
            </MetaCell>
            {project.fundingDetails && (
              <MetaCell>
                <MetaLabel>Εξειδίκευση</MetaLabel>
                <MetaValue style={{ fontSize: '0.76rem', fontWeight: 500, color: '#64748b' }}>
                  {project.fundingDetails}
                </MetaValue>
              </MetaCell>
            )}
            <MetaCell>
              <MetaLabel>Εγκεκριμένο</MetaLabel>
              <MetaValue style={{ color: '#059669', fontWeight: 800 }}>{formatAmount(project.approvedAmount)}</MetaValue>
            </MetaCell>
            {project.projectBudget && (
              <MetaCell>
                <MetaLabel>Προϋπολογισμός</MetaLabel>
                <MetaValue>{formatAmount(project.projectBudget)}</MetaValue>
              </MetaCell>
            )}
          </MetaGrid>
        </CardSection>

        {showProcedureZone && (
          <CardSection $accent="#6366f1" $tint="rgba(238, 242, 255, 0.35)">
            <SectionHeader>Διαδικασία ανάθεσης</SectionHeader>
            <MetaValue style={{ color: '#4338ca', fontSize: '0.86rem' }}>{getProjectAssignmentProcedure(project)}</MetaValue>
          </CardSection>
        )}

        {showContractZone && contractRows.length > 0 && (
          <CardSection $accent="#4338ca" $tint="rgba(238, 242, 255, 0.2)">
            <SectionHeader>Σύμβαση{contractRows.length > 1 ? ' · Πολλές γραμμές' : ''}</SectionHeader>
            {contractExpiryEval && (
              <ContractExpiryBanner onClick={(e) => e.stopPropagation()}>
                <ContractExpiryBannerText>
                  Η λήξη της σύμβασης έχει περάσει ({contractExpiryEval.latestEndLabel}).
                  Προτείνεται κατάσταση «Ολοκληρωμένο».
                </ContractExpiryBannerText>
                <ContractExpiryBannerButton
                  type="button"
                  onClick={() => setContractExpiryPrompt(contractExpiryEval)}
                >
                  Ενημέρωση κατάστασης
                </ContractExpiryBannerButton>
              </ContractExpiryBanner>
            )}
            {contractRows.map((row, idx) => renderContractRow(row, idx))}
          </CardSection>
        )}

        {project.comments && String(project.comments).trim() && (
          <CardSection $accent="#94a3b8" $tint="rgba(248, 250, 252, 0.5)">
            <SectionHeader>Σχόλια</SectionHeader>
            <CommentsBlock>{project.comments}</CommentsBlock>
          </CardSection>
        )}
      </CardContent>

      <ButtonContainer>
        <TopButtonsContainer>
          {(hasCreditApproval || hasLinkedEgkrisi) && (
            <ToolbarButton
              type="button"
              $tone={hasLinkedEgkrisi ? 'success' : undefined}
              onClick={() => onOpenEgkriseis && onOpenEgkriseis(project.projectTitle, project.subprojectTitle, project.subprojectId)}
            >
              <IconCredit />
              ΕΓΚΡΙΣΗ ΔΙΑΘ. ΠΙΣΤΩΣΗΣ
            </ToolbarButton>
          )}
          {linkedProsklisi && (
            <ToolbarButton
              type="button"
              onClick={() => onOpenLinkedProsklisi && onOpenLinkedProsklisi(linkedProsklisi.prosklisiId)}
            >
              <IconMegaphone />
              Πρόσκληση
            </ToolbarButton>
          )}
          {hasEntaxi && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificEntaxi && onOpenSpecificEntaxi(project.subprojectId)}>
              <IconDocument />
              ΕΝΤΑΞΗ
            </ToolbarButton>
          )}
          {hasProsklisi && !linkedProsklisi && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificProsklisi && onOpenSpecificProsklisi(project.projectTitle, project.projectId)}>
              <IconMegaphone />
              ΠΡΟΣΚΛΗΣΗ
            </ToolbarButton>
          )}
          {hasMeleti && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificMeleti && onOpenSpecificMeleti(project.subprojectId)}>
              📐
              ΜΕΛΕΤΗ
            </ToolbarButton>
          )}
        </TopButtonsContainer>
        <BottomButtonContainer>
          <MainFilesButton type="button" onClick={handleToggleFiles}>
            <IconFolder />
            Αρχεία Υποέργου
          </MainFilesButton>
        </BottomButtonContainer>
      </ButtonContainer>

        <ViewDetailsHint>Κλικ στην κάρτα για λεπτομέρειες</ViewDetailsHint>
      </Card>
      <KhmdhsContractExpiryPromptDialog
        isOpen={!!contractExpiryPrompt}
        prompt={contractExpiryPrompt}
        onDismiss={() => setContractExpiryPrompt(null)}
        onAccept={() => {
          if (typeof onContractExpiryAccept === 'function') {
            onContractExpiryAccept(project);
          }
          setContractExpiryPrompt(null);
        }}
      />
    </>
  );
}

export default React.memo(ProjectCard);
