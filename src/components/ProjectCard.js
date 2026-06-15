import React, { useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_ABANDONED,
  isAbandonedSubproject,
  getCharacterization,
  statusShowsAssignmentProcedure,
  getProjectTypeBadgeColors,
  normalizeProjectType
} from '../data/formOptions';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { getKhmdhsDisplayEntries, getTotalContractAmount, isMultipleContractsForm } from '../utils/khmdhsFields';
import LinkedNoteSticker, { getEntityLinkedNotes } from './LinkedNoteSticker';

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
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  cursor: pointer;
  position: relative;
  overflow: visible;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.$statusGrad || 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)'};
    border-radius: 16px 16px 0 0;
    opacity: 0.7;
    transition: opacity 0.35s ease, height 0.25s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px ${props => props.$statusShadow || 'rgba(99, 102, 241, 0.12)'}, 0 8px 16px rgba(0, 0, 0, 0.06);
    border-color: rgba(165, 180, 252, 0.6);

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
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
`;

const SubprojectTitle = styled.h4`
  color: #1e293b;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  letter-spacing: 0.3px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
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
  display: grid;
  gap: 0.8rem;
  flex: 1; /* Γεμίζει τον διαθέσιμο χώρο */
  align-content: start; /* Στοιχίζει περιεχόμενο στην αρχή */
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

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.3px;
  background: ${props => getStatusColor(props.status).gradient};
  color: white;
  box-shadow: 0 2px 6px ${props => getStatusColor(props.status).shadow};
`;

const CompletionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
`;

const CompletionChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.55rem;
  border-radius: 20px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  background: ${props => props.$active ? props.$activeBg || '#d1fae5' : 'rgba(226, 232, 240, 0.5)'};
  color: ${props => props.$active ? props.$activeText || '#065f46' : '#94a3b8'};
  border: 1px solid ${props => props.$active ? props.$activeBorder || '#6ee7b7' : 'rgba(203, 213, 225, 0.5)'};
  transition: all 0.2s ease;
  line-height: 1;
`;

const BudgetBarWrap = styled.div`
  margin: 0.75rem 0 0.5rem;
  padding: 0.65rem 0.85rem;
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9));
  border-radius: 10px;
  border: 1px solid rgba(226, 232, 240, 0.6);
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
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: ${props => props.$type === 'ΝΕΟ' ? '#e3f2fd' : '#fff8e1'};
  color: ${props => props.$type === 'ΝΕΟ' ? '#1565c0' : '#e65100'};
  border: 1px solid ${props => props.$type === 'ΝΕΟ' ? '#90caf9' : '#ffcc80'};
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

const CatalogSupervisorRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  margin: 0.15rem 0 0.45rem;
  border-radius: 10px;
  background: linear-gradient(105deg, rgba(238, 242, 255, 0.9) 0%, rgba(255, 255, 255, 0.5) 100%);
  border: 1px solid rgba(165, 180, 252, 0.45);
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.07);
`;

const CatalogChargeRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 0.5rem;
  align-items: start;
`;

const CatalogPrimaryName = styled.div`
  font-size: 0.9rem;
  font-weight: 800;
  color: #312e81;
  letter-spacing: 0.01em;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
`;

const CatalogAuxLine = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: #64748b;
  line-height: 1.4;
  letter-spacing: 0.02em;
`;

const ContractInfo = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 10px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 3px solid #6366f1;
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-left: 3px solid #6366f1;
`;

const ContractTitle = styled.div`
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
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
  padding-top: 1rem;
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  flex-shrink: 0;
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

// Κόκκινο κουμπάκι για lock status
const LockStatusButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: ${props => props.isLocked ? '#dc3545' : '#28a745'};
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
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
  onDelete,
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
  onExportReport
}) {
  const [exportingReport, setExportingReport] = useState(false);
  const statusColor = getStatusColor(project.projectStatus);
  const isAbandoned = isAbandonedSubproject(project);

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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const hasContractInfo = isMultipleContractsForm(project.implementationForm)
    ? (project.contracts && project.contracts.length > 0)
    : (project.contractDate || project.contractAmount);

  const safeParseAmount = (val) => {
    if (!val) return 0;
    const str = typeof val === 'number' ? String(val) : val;
    const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  };

  const totalContractAmount = getTotalContractAmount(project);

  const approvedAmountNum = safeParseAmount(project.approvedAmount);
  const progressPct = approvedAmountNum > 0 && totalContractAmount > 0
    ? Math.min(100, Math.round((totalContractAmount / approvedAmountNum) * 100))
    : 0;

  const { displayChargePrimary, displayChargeParticipants } = useMemo(
    () => getProjectChargeDisplay(project, engineerCatalog),
    [project, engineerCatalog]
  );

  const khmdhsEntries = useMemo(() => getKhmdhsDisplayEntries(project), [project]);
  const linkedNotes = getEntityLinkedNotes(linkedNotesMap, project.subprojectId);

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
          <SubprojectTitle>
            {project.subprojectTitle}
            {portalEnabled && isPublishedToPortal && (
              <span
                title="Δημοσιευμένο στην Πύλη Διαφάνειας"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'linear-gradient(135deg, #2563eb22, #0ea5e922)',
                  border: '1px solid #2563eb44',
                  color: '#2563eb',
                  borderRadius: 5,
                  padding: '1px 7px',
                  fontSize: 10,
                  fontWeight: 700,
                  marginLeft: 6,
                  letterSpacing: '0.03em',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap'
                }}
              >
                🌐 PORTAL
              </span>
            )}
            {project.misPraxhsName && project.misPraxhsCode && (
              <MisPraxhsBadge>
                {project.misPraxhsName}: {project.misPraxhsCode}
              </MisPraxhsBadge>
            )}
            {epLinkedAction && (
              <EpLinkBadge
                title={`Επιχειρησιακό Πρόγραμμα — Δράση #${epLinkedAction.aa || '—'}: ${epLinkedAction.title || ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                🔗 Επιχειρησιακό
              </EpLinkBadge>
            )}
            {hasDirectAssignmentViolation && (
              <span
                title="Πιθανή παράβαση κανόνα 12 μηνών — απευθείας ανάθεση έργου/μελέτης στον ίδιο ανάδοχο"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  color: '#b45309',
                  borderRadius: 5,
                  padding: '1px 7px',
                  fontSize: 10,
                  fontWeight: 800,
                  marginLeft: 6,
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap'
                }}
              >
                ⚠️ 12μ.
              </span>
            )}
          </SubprojectTitle>

        </CardHeader>

      <CardContent>
        <InfoRow>
          <InfoLabel>Μορφή Υλοποίησης:</InfoLabel>
          <InfoValue>{project.implementationForm}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Κωδικός ΚΑ:</InfoLabel>
          <InfoValue>{project.kaCode}</InfoValue>
        </InfoRow>

        {((project.aleCodes && project.aleCodes.length > 0) || project.aleCode) && (
          <InfoRow>
            <InfoLabel>Κωδ. Α.Λ.Ε.:</InfoLabel>
            <InfoValue>
              {project.aleCodes && Array.isArray(project.aleCodes) && project.aleCodes.length > 0
                ? project.aleCodes.filter(c => c && c.trim()).join(' • ')
                : project.aleCode || ''}
            </InfoValue>
          </InfoRow>
        )}

        <InfoRow>
          <InfoLabel>Είδος:</InfoLabel>
          <InfoValue>
            <TypeBadge type={project.projectType}>{normalizeProjectType(project.projectType)}</TypeBadge>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Πηγή Χρηματοδότησης:</InfoLabel>
          <InfoValue>{project.fundingSource}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Εξειδίκευση:</InfoLabel>
          <InfoValue>{project.fundingDetails}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Εγκεκριμένο Ποσό:</InfoLabel>
          <InfoValue>
            <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Προϋπολογισμός:</InfoLabel>
          <InfoValue>
            <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Κατάσταση:</InfoLabel>
          <InfoValue style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <StatusBadge status={project.projectStatus}>{project.projectStatus}</StatusBadge>
            {getCharacterization(project) && (
              <CharacterizationBadge $type={getCharacterization(project)}>
                {getCharacterization(project)}
              </CharacterizationBadge>
            )}
          </InfoValue>
        </InfoRow>

        {statusShowsAssignmentProcedure(project.projectStatus) && project.assignmentProcedure && (
          <InfoRow>
            <InfoLabel>Διαδικασία ανάθεσης:</InfoLabel>
            <InfoValue style={{ fontWeight: 600, color: '#5c6bc0', fontSize: '0.9rem' }}>
              {project.assignmentProcedure}
            </InfoValue>
          </InfoRow>
        )}

        {khmdhsEntries.length > 0 && (
          <InfoRow>
            <InfoLabel>ΚΗΜΔΗΣ:</InfoLabel>
            <InfoValue style={{ fontSize: '0.86rem', lineHeight: 1.5 }}>
              {khmdhsEntries.map((entry, idx) => (
                <div key={entry.contractIndex ?? `k-${idx}`} style={{ marginBottom: idx < khmdhsEntries.length - 1 ? '0.35rem' : 0 }}>
                  {entry.contractIndex != null && (
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Σύμβαση {entry.contractIndex}: </span>
                  )}
                  {entry.adam && (
                    <>
                      <strong>ΑΔΑΜ</strong> {entry.adam}
                    </>
                  )}
                  {entry.snapshot?.anadoxosName && (
                    <>
                      {entry.adam ? ' · ' : null}
                      {entry.snapshot.anadoxosName}
                    </>
                  )}
                  {entry.snapshot?.anadoxosVat && (
                    <span style={{ color: '#64748b' }}> (ΑΦΜ {entry.snapshot.anadoxosVat})</span>
                  )}
                </div>
              ))}
            </InfoValue>
          </InfoRow>
        )}

        {(displayChargePrimary || displayChargeParticipants) && (
          <CatalogSupervisorRow>
            {displayChargePrimary && (
              <CatalogChargeRow>
                <InfoLabel>Χρεωμένο σε:</InfoLabel>
                <CatalogPrimaryName>{displayChargePrimary}</CatalogPrimaryName>
              </CatalogChargeRow>
            )}
            {displayChargeParticipants && (
              <CatalogChargeRow>
                <InfoLabel>Συμμετέχουν:</InfoLabel>
                <CatalogAuxLine>{displayChargeParticipants}</CatalogAuxLine>
              </CatalogChargeRow>
            )}
          </CatalogSupervisorRow>
        )}

        {project.comments && (
          <InfoRow>
            <InfoLabel>Σχόλια:</InfoLabel>
            <InfoValue style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {project.comments}
            </InfoValue>
          </InfoRow>
        )}

        {hasContractInfo && (
          <ContractInfo>
            <ContractTitle>Στοιχεία Σύμβασης</ContractTitle>
            
            {project.implementationForm === 'Μια Σύμβαση' ? (
              <div>
                {statusShowsAssignmentProcedure(project.projectStatus) && project.contractProcessStartDate && (
                  <InfoRow>
                    <InfoLabel>Ημερομηνία έναρξης διαδικασίας:</InfoLabel>
                    <InfoValue>{formatDate(project.contractProcessStartDate)}</InfoValue>
                  </InfoRow>
                )}
                {project.contractDate && (
                  <InfoRow>
                    <ContractDateLabel>Ημερ. Σύμβασης:</ContractDateLabel>
                    <ContractDateValue>{formatDate(project.contractDate)}</ContractDateValue>
                  </InfoRow>
                )}
                {project.contractAmount && (
                  <InfoRow>
                    <ContractAmountLabel>Ποσό Σύμβασης:</ContractAmountLabel>
                    <ContractAmountValue>{formatAmount(project.contractAmount)}</ContractAmountValue>
                  </InfoRow>
                )}
                {project.apeAmount && (
                  <InfoRow>
                    <InfoLabel>ΑΠΕ + Συμπλ.:</InfoLabel>
                    <InfoValue>
                      <AmountValue>{formatAmount(project.apeAmount)}</AmountValue>
                    </InfoValue>
                  </InfoRow>
                )}
                {project.apeComments && (
                  <InfoRow>
                    <InfoLabel>Σχόλια ΑΠΕ:</InfoLabel>
                    <InfoValue>{project.apeComments}</InfoValue>
                  </InfoRow>
                )}
              </div>
            ) : (
              <MultipleContracts>
                {/* Ημερομηνία έναρξης διαδικασίας - εμφανίζεται μόνο για multiple contracts αν υπάρχει */}
                {statusShowsAssignmentProcedure(project.projectStatus) && project.contractProcessStartDate && (
                  <InfoRow style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #dee2e6' }}>
                    <InfoLabel style={{ fontWeight: 600, color: '#5c6bc0' }}>Ημερομηνία έναρξης διαδικασίας:</InfoLabel>
                    <InfoValue style={{ fontWeight: 600, color: '#5c6bc0', fontSize: '0.95rem' }}>{formatDate(project.contractProcessStartDate)}</InfoValue>
                  </InfoRow>
                )}
                {project.contracts && project.contracts.map((contract, index) => (
                  <ContractItem key={index}>
                    <strong>Σύμβαση {index + 1}</strong>
                    {contract.date && (
                      <InfoRow>
                        <InfoLabel>Ημερομηνία:</InfoLabel>
                        <InfoValue>{formatDate(contract.date)}</InfoValue>
                      </InfoRow>
                    )}
                    {contract.amount && (
                      <InfoRow>
                        <InfoLabel>Ποσό:</InfoLabel>
                        <InfoValue>
                          <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                        </InfoValue>
                      </InfoRow>
                    )}
                    {contract.apeAmount && (
                      <InfoRow>
                        <InfoLabel>ΑΠΕ + Συμπλ.:</InfoLabel>
                        <InfoValue>
                          <AmountValue>{formatAmount(contract.apeAmount)}</AmountValue>
                        </InfoValue>
                      </InfoRow>
                    )}
                    {contract.comments && (
                      <InfoRow>
                        <InfoLabel>Σχόλια:</InfoLabel>
                        <InfoValue>{contract.comments}</InfoValue>
                      </InfoRow>
                    )}
                  </ContractItem>
                ))}
              </MultipleContracts>
            )}
            
          </ContractInfo>
        )}

        {/* Supplementary Contracts */}
        {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && (
          <ContractInfo style={{ background: '#e8f5e8', border: '2px solid #28a745' }}>
            <ContractTitle style={{ color: '#155724' }}>Συμπληρωματικές Συμβάσεις</ContractTitle>
            
            {project.supplementaryContracts.map((contract, index) => (
              <ContractItem key={index} style={{ background: 'white', marginBottom: '1rem' }}>
                <InfoRow>
                  <InfoLabel>Συμπληρωματική {index + 1}:</InfoLabel>
                  <InfoValue>
                    {contract.date && formatDate(contract.date)}
                    {contract.amount && (
                      <span style={{ marginLeft: '1rem' }}>
                        <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                      </span>
                    )}
                  </InfoValue>
                </InfoRow>
                {contract.comments && (
                  <InfoRow>
                    <InfoLabel>Σχόλια:</InfoLabel>
                    <InfoValue>{contract.comments}</InfoValue>
                  </InfoRow>
                )}
              </ContractItem>
            ))}
          </ContractInfo>
        )}

        {/* Total Contract Amount - Only show if there are supplementary contracts - MOVED TO BOTTOM */}
        {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && totalContractAmount > 0 && (
          <ContractInfo style={{ 
            background: '#f8f9fa', 
            border: '2px solid #007bff',
            marginTop: '0.5rem'
          }}>
            <ContractTitle style={{ color: '#007bff', fontSize: '1rem', marginBottom: '0.5rem' }}>
              Σύνολο Συμβάσεων
            </ContractTitle>
            <InfoRow style={{ padding: '0.5rem 0' }}>
              <InfoLabel style={{ fontWeight: 'bold', fontSize: '1rem', color: '#007bff' }}>
                Συνολικό Ποσό:
              </InfoLabel>
              <InfoValue>
                <AmountValue style={{ fontSize: '1.1rem', color: '#007bff' }}>
                  {totalContractAmount.toLocaleString('el-GR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2,
                    useGrouping: true
                  })} €
                </AmountValue>
              </InfoValue>
            </InfoRow>
          </ContractInfo>
        )}
      </CardContent>

      <ButtonContainer>
        <TopButtonsContainer>
          {(hasCreditApproval || hasLinkedEgkrisi) && (
            <ToolbarButton
              type="button"
              $tone={hasLinkedEgkrisi ? 'success' : undefined}
              onClick={() => onOpenEgkriseis && onOpenEgkriseis(project.projectTitle, project.subprojectTitle)}
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
            <ToolbarButton type="button" onClick={() => onOpenSpecificEntaxi && onOpenSpecificEntaxi()}>
              <IconDocument />
              ΕΝΤΑΞΗ
            </ToolbarButton>
          )}
          {hasProsklisi && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificProsklisi && onOpenSpecificProsklisi()}>
              <IconMegaphone />
              ΠΡΟΣΚΛΗΣΗ
            </ToolbarButton>
          )}
          {hasMeleti && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificMeleti && onOpenSpecificMeleti()}>
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
    </>
  );
}

export default React.memo(ProjectCard);
