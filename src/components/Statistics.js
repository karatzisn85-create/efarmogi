import React, { useMemo, useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ASSIGNMENT_PROCEDURES,
  PROJECT_STATUS_ABANDONED,
  statusShowsAssignmentProcedure
} from '../data/formOptions';
import { getTotalContractAmount } from '../utils/khmdhsFields';
import {
  buildContractorProfiles,
  buildContractorChronology,
  getContractsTimelineByYear,
  getContractorAmountByYear,
  groupChronologyByYear
} from '../utils/contractorFields';
import {
  findDirectAssignmentViolations,
  formatViolationSummary,
  DIRECT_ASSIGNMENT_COOLING_MONTHS
} from '../utils/directAssignmentCompliance';
import { buildProcurementStatistics } from '../utils/procurementStatistics';
import { buildKhmdhsPortfolioStatistics, resolvePortfolioDrillIds, PORTFOLIO_DRILL_LABELS } from '../utils/khmdhsPortfolioStatistics';
import { LIFECYCLE_STAGE_META } from '../utils/khmdhsLifecycleStages';
import StatisticsExportModal from './StatisticsExportModal';
import ExportSuccessModal from './ExportSuccessModal';
import { useToast } from './ToastProvider';
import { formatDateEl } from '../utils/dateFormat';
import { containsSearchTerm } from '../utils/searchUtils';
import { getProjectAssignmentProcedure } from '../utils/khmdhsNoticeFields';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const StatisticsContainer = styled.div`
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  padding: 1.5rem 1.75rem;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  border: 1px solid rgba(226, 232, 240, 0.55);
  width: 100%;
  margin-bottom: 1.25rem;
`;

const EmbeddedStatsRoot = styled.div`
  width: 100%;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(226, 232, 240, 0.75);
`;

const StatsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 0.75rem;
`;

const ExportReportBtn = styled.button`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.25);
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const OpenFullStatsBtn = styled.button`
  background: transparent;
  color: #4f46e5;
  border: 1px solid rgba(79, 70, 229, 0.35);
  border-radius: 10px;
  padding: 0.45rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;

  &:hover {
    background: rgba(79, 70, 229, 0.08);
    border-color: rgba(79, 70, 229, 0.55);
  }
`;

const StatisticsTitle = styled.h2`
  color: #1e293b;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-align: left;
  position: relative;
  padding-left: 14px;
  text-transform: uppercase;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 80%;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 4px;
  }
`;

// ─── Chain tab styled components ──────────────────────────────────────────────


const ChainBodyGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ChainFunnelCard = styled.div`
  background: #fff;
  border: 1px solid rgba(226,232,240,0.7);
  border-radius: 14px;
  padding: 1rem 1.15rem;
`;

const ChainSectionTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
`;

const ChainFunnelNote = styled.div`
  font-size: 0.68rem;
  color: #94a3b8;
  margin-bottom: 0.85rem;
`;

const FunnelRow = styled.button`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.55rem;
  width: 100%;
  padding: 0.25rem 0.35rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  &:hover {
    background: #f8fafc;
  }
`;
const FunnelLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 160px;
  flex-shrink: 0;
`;
const FunnelIcon = styled.span`
  font-size: 0.85rem;
`;
const FunnelLabelText = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const FunnelBarWrap = styled.div`
  flex: 1;
  height: 10px;
  background: rgba(226,232,240,0.5);
  border-radius: 99px;
  overflow: hidden;
`;
const FunnelBar = styled.div`
  height: 100%;
  width: ${p => p.$pct || 0}%;
  background: ${p => p.$color || '#6366f1'};
  border-radius: 99px;
  transition: width 0.5s ease;
`;
const FunnelCountBadge = styled.div`
  font-size: 0.75rem;
  font-weight: 800;
  color: ${p => p.$color || '#1e293b'};
  white-space: nowrap;
  min-width: 48px;
  text-align: right;
`;
const FunnelPctSpan = styled.span`
  font-weight: 600;
  color: #94a3b8;
  font-size: 0.65rem;
`;
const FunnelAmtBadge = styled.div`
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 700;
  white-space: nowrap;
  min-width: 50px;
  text-align: right;
`;

const ChainStageGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  align-content: start;
`;

const StageDetailCard = styled.button`
  background: ${p => p.$bg || '#f8fafc'};
  border: 1px solid ${p => p.$border || 'rgba(226,232,240,0.6)'};
  border-left: 3px solid ${p => p.$accent || '#6366f1'};
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  width: 100%;
  text-align: left;
  cursor: pointer;
  &:hover {
    box-shadow: 0 2px 8px rgba(15,23,42,0.06);
  }
`;
const StageCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
`;
const StageCardIcon = styled.span`
  font-size: 0.9rem;
`;
const StageCardTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #334155;
  flex: 1;
`;
const StageCardCount = styled.div`
  font-size: 1.1rem;
  font-weight: 900;
  color: ${p => p.$accent || '#6366f1'};
  line-height: 1;
`;
const StageCardAmount = styled.div`
  font-size: 0.75rem;
  font-weight: 800;
  color: #1e293b;
  margin-top: 0.15rem;
`;
const StageCardExtras = styled.div`
  font-size: 0.62rem;
  color: #94a3b8;
  margin-top: 0.15rem;
`;

const ChainGapSection = styled.div`
  margin-bottom: 1.25rem;
`;
const GapGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-top: 0.65rem;
`;
const GapCard = styled.div`
  background: ${p => p.$bg || '#fff'};
  border: 1px solid ${p => p.$color ? p.$color + '33' : 'rgba(226,232,240,0.7)'};
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
`;
const GapCardHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
`;
const GapCardTitle = styled.div`
  flex: 1;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${p => p.$color || '#334155'};
`;
const GapCardCount = styled.div`
  font-size: 1rem;
  font-weight: 900;
  color: ${p => p.$color || '#1e293b'};
`;
const GapList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;
const GapListItem = styled.button`
  border-top: 1px solid rgba(226,232,240,0.5);
  padding-top: 0.3rem;
  width: 100%;
  border-left: none;
  border-right: none;
  border-bottom: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  &:hover {
    background: rgba(248,250,252,0.85);
  }
`;
const GapListTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const GapListMeta = styled.div`
  font-size: 0.62rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ExpandMoreBtn = styled.button`
  font-size: 0.65rem;
  color: #4f46e5;
  padding: 0.4rem 0.55rem;
  margin-top: 0.35rem;
  font-weight: 700;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.28);
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(79, 70, 229, 0.14);
    border-color: rgba(79, 70, 229, 0.45);
  }
`;

const ChainPipelineSection = styled.div`
  background: #fff;
  border: 1px solid rgba(226,232,240,0.7);
  border-radius: 14px;
  padding: 1rem 1.15rem;
  margin-bottom: 1rem;
`;
const PipelineNote = styled.div`
  font-size: 0.68rem;
  color: #94a3b8;
  margin-bottom: 0.85rem;
  line-height: 1.5;
`;
const PipelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.6rem;
`;
const PipelineRowLabel = styled.div`
  width: 200px;
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #334155;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
`;
const PipelineRowCount = styled.div`
  font-size: 0.6rem;
  color: #94a3b8;
  font-weight: 500;
`;
const PipelineBarWrap = styled.div`
  flex: 1;
  height: 12px;
  background: rgba(226,232,240,0.5);
  border-radius: 99px;
  overflow: hidden;
`;
const PipelineBar = styled.div`
  height: 100%;
  width: ${p => p.$pct || 0}%;
  background: ${p => p.$color || '#6366f1'};
  border-radius: 99px;
  transition: width 0.5s ease;
`;
const PipelineRowValue = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: #1e293b;
  white-space: nowrap;
  min-width: 110px;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: flex-end;
`;
const PipelinePct = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  color: ${p => p.$color || '#94a3b8'};
`;
const PipelineSummaryRow = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(226,232,240,0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
`;
const PipelineExecBadge = styled.span`
  background: ${p => p.$pct >= 70 ? '#ecfdf5' : p.$pct >= 30 ? '#fffbeb' : '#f8fafc'};
  color: ${p => p.$pct >= 70 ? '#059669' : p.$pct >= 30 ? '#b45309' : '#64748b'};
  border: 1px solid ${p => p.$pct >= 70 ? 'rgba(5,150,105,0.25)' : p.$pct >= 30 ? 'rgba(245,158,11,0.25)' : 'rgba(226,232,240,0.7)'};
  border-radius: 8px;
  padding: 0.2rem 0.55rem;
  font-weight: 800;
  font-size: 0.72rem;
`;

const ChainDepthRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(226,232,240,0.5);
`;
const ChainDepthLabel = styled.div`
  font-size: 0.68rem;
  color: #94a3b8;
`;
const ChainDepthValue = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
`;

const FinancialTopGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FinancialExecCard = styled.div`
  background: #fff;
  border: 1px solid rgba(226,232,240,0.7);
  border-top: 3px solid ${p => p.$accent || '#6366f1'};
  border-radius: 14px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const FinancialExecTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.35rem;
`;

const FinancialExecBig = styled.div`
  font-size: 2rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
`;

const FinancialExecSub = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
`;

const FinancialDoughnutWrap = styled.div`
  width: 100%;
  max-width: 200px;
  height: 160px;
  margin-top: 0.25rem;
`;

const FinancialBodyGrid = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const FinancialTableMore = ExpandMoreBtn;

const PortfolioHealthBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.65rem;
  margin-bottom: 1rem;
`;

const HealthPill = styled.button`
  background: ${p => p.$bg || '#f8fafc'};
  border: 1px solid ${p => p.$border || 'rgba(226,232,240,0.7)'};
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }
`;

const HealthPillValue = styled.div`
  font-size: 1.35rem;
  font-weight: 900;
  color: ${p => p.$color || '#0f172a'};
  line-height: 1;
`;

const HealthPillLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const HealthPillSub = styled.div`
  font-size: 0.62rem;
  color: #94a3b8;
`;

const QualityScoreHero = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: #fff;
  border: 1px solid rgba(226,232,240,0.7);
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }
`;

const QualityScoreCircle = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 6px solid ${p => p.$color || '#6366f1'};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${p => p.$bg || '#f8fafc'};
`;

const QualityScoreNumber = styled.div`
  font-size: 2rem;
  font-weight: 900;
  color: ${p => p.$color || '#0f172a'};
  line-height: 1;
`;

const QualityScoreOf = styled.div`
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 600;
`;

const QualityScoreBreakdown = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    width: 100%;
  }
`;

const QualityScorePart = styled.div``;

const QualityPartLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.25rem;
`;

const QualityPartBar = styled.div`
  height: 8px;
  background: rgba(226,232,240,0.5);
  border-radius: 99px;
  overflow: hidden;
`;

const QualityPartFill = styled.div`
  height: 100%;
  width: ${p => Math.min(p.$pct || 0, 100)}%;
  background: ${p => p.$color || '#6366f1'};
  border-radius: 99px;
`;

const AttentionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 420px;
  overflow-y: auto;
`;

const AttentionItem = styled.button`
  background: rgba(248,250,252,0.95);
  border: 1px solid rgba(226,232,240,0.7);
  border-left: 3px solid ${p => p.$accent || '#f59e0b'};
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  width: 100%;
  text-align: left;
  cursor: pointer;
  &:hover {
    background: #f8fafc;
  }
`;

const AttentionTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #334155;
`;

const AttentionMeta = styled.div`
  font-size: 0.62rem;
  color: #94a3b8;
  margin-top: 0.1rem;
`;

const AttentionIssues = styled.div`
  font-size: 0.68rem;
  color: #64748b;
  margin-top: 0.35rem;
  line-height: 1.45;
`;

// ─── (end chain styled components) ────────────────────────────────────────────

const StatsDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), transparent);
  margin-bottom: 1.25rem;
`;

const ScopeNoteBanner = styled.div`
  margin: -0.5rem 0 1rem;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
`;

const StatsTabBar = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  padding: 0.35rem;
  background: rgba(241, 245, 249, 0.7);
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.8);
`;

const StatsTab = styled.button`
  background: ${(props) => (props.$active ? 'white' : 'transparent')};
  color: ${(props) => (props.$active ? '#4f46e5' : '#64748b')};
  border: 1px solid ${(props) => (props.$active ? 'rgba(99, 102, 241, 0.35)' : 'transparent')};
  padding: 0.55rem 1rem;
  border-radius: 9px;
  font-size: 0.78rem;
  font-weight: ${(props) => (props.$active ? '700' : '600')};
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: ${(props) => (props.$active ? '0 2px 8px rgba(99, 102, 241, 0.12)' : 'none')};

  &:hover {
    color: #4f46e5;
    background: ${(props) => (props.$active ? 'white' : 'rgba(255, 255, 255, 0.7)')};
  }
`;

const RankedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 0.25rem;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.5);
    border-radius: 99px;
  }
`;

const RankedItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 10px;
`;

const RankedItemMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
`;

const RankedItemTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RankedItemMeta = styled.div`
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 600;
`;

const RankedItemValue = styled.div`
  font-size: 0.75rem;
  font-weight: 800;
  color: #4f46e5;
  white-space: nowrap;
`;

const MiniStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const MiniStatCard = styled.div`
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 12px;
  padding: 0.85rem 1rem;
`;

const MiniStatValue = styled.div`
  font-size: 1.35rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.1;
`;

const MiniStatLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 0.2rem;
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 rgba(99, 102, 241, 0); }
  50% { box-shadow: 0 0 18px rgba(99, 102, 241, 0.22); }
`;

const slideInUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

const timelinePulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
`;

const ContractorGlowCard = styled.div`
  background: ${(p) => p.$bg || 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.9))'};
  border: 1px solid ${(p) => p.$border || 'rgba(99, 102, 241, 0.2)'};
  border-radius: 14px;
  padding: 0.9rem 1.05rem;
  position: relative;
  overflow: hidden;
  animation: ${glowPulse} 3.5s ease-in-out infinite;
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%);
    background-size: 200% 100%;
    animation: ${shimmer} 4s linear infinite;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
  }
`;

const ContractorGlowValue = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: ${(p) => p.$color || '#1e293b'};
  line-height: 1.1;
  position: relative;
  z-index: 1;
`;

const ContractorGlowLabel = styled.div`
  font-size: 0.64rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.55px;
  margin-top: 0.25rem;
  position: relative;
  z-index: 1;
`;

const ContractorTwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 1rem;
  margin-bottom: 1rem;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const LeaderboardPanel = styled.div`
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 14px;
  padding: 1rem 1.05rem;
`;

const LeaderboardTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 0.75rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7);
`;

const LeaderboardItem = styled.button`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.65rem;
  margin-bottom: 0.45rem;
  border-radius: 11px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.45)' : 'rgba(226, 232, 240, 0.7)')};
  background: ${(p) => (p.$active ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))' : 'rgba(248, 250, 252, 0.9)')};
  cursor: pointer;
  transition: all 0.2s ease;
  animation: ${slideInUp} 0.45s ease both;
  animation-delay: ${(p) => (p.$delay || 0)}ms;

  &:hover {
    border-color: rgba(99, 102, 241, 0.35);
    transform: translateX(3px);
  }
`;

const RankBadge = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => (p.$medal ? '1rem' : '0.68rem')};
  font-weight: 800;
  flex-shrink: 0;
  background: ${(p) => p.$bg || 'rgba(99, 102, 241, 0.12)'};
  color: ${(p) => p.$color || '#4f46e5'};
`;

const LeaderboardBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const LeaderboardName = styled.div`
  font-size: 0.76rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LeaderboardMeta = styled.div`
  font-size: 0.62rem;
  color: #94a3b8;
  font-weight: 600;
  margin-top: 0.1rem;
`;

const ShareBarTrack = styled.div`
  height: 5px;
  background: rgba(226, 232, 240, 0.8);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 0.35rem;
`;

const ShareBarFill = styled.div`
  height: 100%;
  width: ${(p) => Math.min(100, p.$pct || 0)}%;
  background: ${(p) => p.$color || 'linear-gradient(90deg, #6366f1, #8b5cf6)'};
  border-radius: 99px;
  transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
`;

const ContractorHero = styled.div`
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #6366f1 100%);
  border-radius: 16px;
  padding: 1.15rem 1.25rem;
  color: white;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 32px rgba(79, 70, 229, 0.28);
  animation: ${slideInUp} 0.4s ease;

  &::after {
    content: '';
    position: absolute;
    top: -30%;
    right: -10%;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }
`;

const ContractorHeroName = styled.div`
  font-size: 1.05rem;
  font-weight: 800;
  margin-bottom: 0.3rem;
  position: relative;
  z-index: 1;
`;

const ContractorHeroSub = styled.div`
  font-size: 0.72rem;
  opacity: 0.85;
  font-weight: 600;
  margin-bottom: 0.85rem;
  position: relative;
  z-index: 1;
`;

const StatPillsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  position: relative;
  z-index: 1;
`;

const StatPill = styled.div`
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-size: 0.68rem;
  font-weight: 700;
`;

const ProcedureBarRow = styled.div`
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
`;

const ProcedureBarLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 0.3rem;
`;

const ChronoSummaryRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.1rem;
`;

const ChronoFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.04));
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
`;

const TimelineContainer = styled.div`
  position: relative;
  padding-left: 2rem;
`;

const TimelineRail = styled.div`
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #6366f1, #8b5cf6, #a78bfa, transparent);
  border-radius: 99px;
`;

const TimelineYearBlock = styled.div`
  margin-bottom: 1.5rem;
  animation: ${slideInUp} 0.5s ease both;
  animation-delay: ${(p) => (p.$delay || 0)}ms;
`;

const TimelineYearHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  margin-left: -2rem;
  padding-left: 0;
`;

const TimelineYearBadge = styled.div`
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  font-size: 0.82rem;
  font-weight: 800;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
  letter-spacing: 0.5px;
`;

const TimelineYearStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const TimelineYearChip = styled.span`
  font-size: 0.64rem;
  font-weight: 700;
  color: #64748b;
  background: rgba(248, 250, 252, 0.95);
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
`;

const TimelineEvent = styled.div`
  position: relative;
  margin-bottom: 0.75rem;
  margin-left: 0.5rem;
  padding: 0.85rem 1rem 0.85rem 1.15rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-left: 4px solid ${(p) => p.$accent || '#6366f1'};
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  transition: all 0.25s ease;
  animation: ${slideInUp} 0.45s ease both;
  animation-delay: ${(p) => (p.$delay || 0)}ms;

  &:hover {
    transform: translateX(4px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.25);
  }
`;

const TimelineDot = styled.div`
  position: absolute;
  left: -1.65rem;
  top: 1.1rem;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${(p) => p.$accent || '#6366f1'};
  border: 3px solid white;
  box-shadow: 0 0 0 2px ${(p) => p.$accent || '#6366f1'};
  animation: ${timelinePulse} 2.5s ease-in-out infinite;
`;

const TimelineEventHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
`;

const TimelineEventDate = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: #4f46e5;
  white-space: nowrap;
`;

const TimelineEventAmount = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  color: #059669;
  white-space: nowrap;
`;

const TimelineContractor = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.2rem;
`;

const TimelineSubproject = styled.div`
  font-size: 0.74rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.15rem;
`;

const TimelineProject = styled.div`
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 600;
`;

const TimelineBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
`;

const TimelineBadge = styled.span`
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: ${(p) => p.$bg || 'rgba(99, 102, 241, 0.1)'};
  color: ${(p) => p.$color || '#4f46e5'};
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const ContractorSelect = styled.select`
  flex: 1;
  min-width: 240px;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: white;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
`;

const ContractorSearchInput = styled.input`
  flex: 1;
  min-width: 240px;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: white;
  font-size: 0.82rem;
  font-weight: 500;
  color: #334155;

  &::placeholder {
    color: #94a3b8;
    font-weight: 500;
  }

  &:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.55);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  }
`;

const LeaderboardList = styled.div`
  max-height: min(68vh, 720px);
  overflow-y: auto;
  padding-right: 0.2rem;
  margin-right: -0.15rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.45);
    border-radius: 99px;
  }
`;

const LeaderboardEmptySearch = styled.div`
  padding: 1.25rem 0.75rem;
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.5;
`;

const DetailPanel = styled.div`
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
`;

const DetailPanelTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.35rem;
`;

const HistoryTableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 10px;
`;

const CompliancePanel = styled.div`
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 14px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
`;

const CompliancePanelTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: #b45309;
  margin-bottom: 0.5rem;
`;

const ComplianceItem = styled.div`
  font-size: 0.75rem;
  color: #92400e;
  line-height: 1.5;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(252, 211, 77, 0.5);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;

  th, td {
    padding: 0.5rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid rgba(226, 232, 240, 0.7);
  }

  th {
    background: #f8fafc;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: 0.64rem;
  }

  tr:last-child td {
    border-bottom: none;
  }

  td {
    color: #334155;
    vertical-align: top;
  }
`;

const SummaryStats = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;

  @media (min-width: 900px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const StatCardSubtext = styled.div`
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  margin-top: 0.15rem;
  letter-spacing: 0.3px;
`;

const StatCardDualNumbers = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 1rem;
`;

const StatCardDualItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;

  &:not(:last-child) {
    padding-right: 1rem;
    border-right: 1px solid rgba(255, 255, 255, 0.18);
  }
`;

const BudgetSummaryRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.04), rgba(99, 102, 241, 0.04));
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 14px;
  flex-wrap: wrap;
`;

const BudgetSummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 140px;
  padding: 0 0.75rem;
  border-right: 1px solid rgba(226, 232, 240, 0.7);

  &:last-child {
    border-right: none;
  }
`;

const BudgetSummaryLabel = styled.div`
  font-size: 0.62rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const BudgetSummaryValue = styled.div`
  font-size: 1rem;
  font-weight: 800;
  color: ${props => props.$color || '#1e293b'};
  letter-spacing: -0.3px;
`;

const BudgetSummaryPct = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: ${props => props.$color || '#64748b'};
`;

const BudgetBarTrack = styled.div`
  height: 3px;
  background: rgba(226, 232, 240, 0.8);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 0.35rem;
`;

const BudgetBarFill = styled.div`
  height: 100%;
  width: ${props => Math.min(100, props.$pct || 0)}%;
  background: ${props => props.$gradient || 'linear-gradient(90deg, #6366f1, #8b5cf6)'};
  border-radius: 99px;
  transition: width 0.6s ease;
`;

const StatCard = styled.div`
  background: ${props => props.bg || 'linear-gradient(135deg, #6366f1, #4f46e5)'};
  border-radius: 14px;
  padding: 1.1rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${props => props.shadow || '0 4px 16px rgba(99, 102, 241, 0.25)'};
  border: 1px solid rgba(255, 255, 255, 0.12);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: -40%;
    right: -20%;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${props => props.shadowHover || '0 8px 28px rgba(99, 102, 241, 0.35)'};
  }
`;

const StatCardIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
`;

const StatCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 1;
`;

const StatNumber = styled.div`
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1;
  letter-spacing: -0.5px;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartContainer = styled.div`
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  border: 1px solid rgba(226, 232, 240, 0.55);
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.07);
    border-color: rgba(165, 180, 252, 0.35);
  }
`;

const ChartTitle = styled.h3`
  color: #475569;
  margin: 0 0 0.85rem 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  padding-bottom: 0.55rem;
`;

const ChartWrapper = styled.div`
  height: 230px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const NoDataMessage = styled.div`
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  font-size: 0.85rem;
  padding: 1.5rem;
`;

const safeParseAmt = (val) => {
  if (!val) return 0;
  const str = typeof val === 'number' ? String(val) : val;
  const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const STATS_TABS = [
  { id: 'overview', label: 'Σύνοψη', icon: '📊' },
  { id: 'funding', label: 'Χρηματοδότηση', icon: '💰' },
  { id: 'chain', label: 'Αλυσίδα ΚΗΜΔΗΣ', icon: '🔗' },
  { id: 'financial', label: 'Οικονομικά ΚΗΜΔΗΣ', icon: '💶' },
  { id: 'quality', label: 'Ποιότητα Δεδομένων', icon: '✅' },
  { id: 'assignment', label: 'Διαδικασίες Ανάθεσης', icon: '📋' },
  { id: 'procurement', label: 'Δημοσίευση', icon: '📢' },
  { id: 'contractors', label: 'Ανάδοχοι', icon: '🏢' },
  { id: 'contractor-chronology', label: 'Χρονολόγιο Αναδόχων', icon: '📅' }
];

const CONTRACTOR_STATUS_COLORS = {
  'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': { bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309' },
  'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': { bg: 'rgba(234, 88, 12, 0.12)', color: '#c2410c' },
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': { bg: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' },
  'ΟΛΟΚΛΗΡΩΜΕΝΟ': { bg: 'rgba(5, 150, 105, 0.12)', color: '#047857' },
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': { bg: 'rgba(13, 148, 136, 0.12)', color: '#0f766e' },
  [PROJECT_STATUS_ABANDONED]: { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569' }
};

const RANK_STYLES = [
  { medal: true, bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' },
  { medal: true, bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', color: '#475569' },
  { medal: true, bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', color: '#c2410c' }
];

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

const STAGE_FUNNEL_ORDER = ['REQ', 'COMMIT', 'PROC', 'AWRD', 'SYMV', 'PAY'];

const GAP_LIST_PREVIEW = 6;
const FINANCIAL_VARIANCE_PREVIEW = 25;
const QUALITY_ATTENTION_PREVIEW = 30;

function formatPercentInt(pct, { signed = false } = {}) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const rounded = Math.round(Number(pct));
  if (signed && rounded > 0) return `+${rounded}%`;
  return `${rounded}%`;
}

const GAP_LABELS = {
  awrd_no_symv:   { label: 'Ανάθεση χωρίς Σύμβαση', color: '#ea580c', bg: '#fff7ed', icon: '⚠️' },
  proc_no_awrd:   { label: 'Δημοσίευση χωρίς Ανάθεση', color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  proc_cancelled: { label: 'Ματαιωμένη Δημοσίευση', color: '#64748b', bg: '#f8fafc', icon: '🚫' },
};

function formatDateElGR(dateStr) {
  return formatDateEl(dateStr, '—');
}

function Statistics({
  projects,
  directAssignmentViolations: directAssignmentViolationsProp,
  loggedInUsername = '',
  onPortfolioDrillDown,
  statisticsFilterNote = '',
  statisticsScopeNote = '',
  variant = 'full',
  embedded = false,
  onOpenFullStatistics,
}) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedContractorKey, setSelectedContractorKey] = useState('');
  const [contractorSearchQuery, setContractorSearchQuery] = useState('');
  const [chronoFilterKey, setChronoFilterKey] = useState('all');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);
  const [expandedGapLists, setExpandedGapLists] = useState({});
  const [financialVarianceExpanded, setFinancialVarianceExpanded] = useState(false);
  const [qualityAttentionExpanded, setQualityAttentionExpanded] = useState(false);

  const toggleGapListExpanded = (gapKey) => {
    setExpandedGapLists((prev) => ({ ...prev, [gapKey]: !prev[gapKey] }));
  };

  const ipcRenderer = window.electronAPI;

  const scopeSubprojectIds = useMemo(
    () => (projects || []).map((p) => p.subprojectId).filter(Boolean),
    [projects]
  );

  const renderScopeNote = () => (
    statisticsScopeNote ? <ScopeNoteBanner>{statisticsScopeNote}</ScopeNoteBanner> : null
  );

  const directAssignmentViolations = useMemo(
    () => directAssignmentViolationsProp || findDirectAssignmentViolations(projects),
    [directAssignmentViolationsProp, projects]
  );

  const procurementStats = useMemo(
    () => buildProcurementStatistics(projects),
    [projects]
  );

  const portfolioStats = useMemo(
    () => buildKhmdhsPortfolioStatistics(projects),
    [projects]
  );

  const applyPortfolioDrill = (key, extra = {}) => {
    if (!onPortfolioDrillDown) return;
    const ids = resolvePortfolioDrillIds(portfolioStats, key, extra);
    const label = extra.label
      || (extra.gapKey && GAP_LABELS[extra.gapKey]?.label)
      || PORTFOLIO_DRILL_LABELS[key]
      || 'Φιλτράρισμα ΚΗΜΔΗΣ';
    onPortfolioDrillDown(label, ids);
  };

  const handlePortfolioExport = async (reportType) => {
    if (!loggedInUsername) {
      showToast('Απαιτείται σύνδεση χρήστη', 'warning');
      return;
    }
    setExportingReport(true);
    try {
      const res = await ipcRenderer.invoke('export-portfolio-report', {
        reportType,
        stats: portfolioStats,
        actingUsername: loggedInUsername,
        filterNote: statisticsFilterNote || `${projects.length} υποέργα`,
        projectCount: projects.length,
        scopeSubprojectIds,
      });
      if (res?.success) {
        setExportModalOpen(false);
        setExportSuccess({
          filePath: res.filePath,
          sheetCount: res.sheetCount,
          exportedAt: res.exportedAt,
          actionCount: projects.length,
        });
      } else if (!res?.canceled) {
        showToast(res?.error || 'Αποτυχία εξαγωγής', 'error');
      }
    } finally {
      setExportingReport(false);
    }
  };

  const buildTabExportPayload = (tabId) => ({
    tabId,
    tabLabel: STATS_TABS.find((t) => t.id === tabId)?.label || tabId,
    statistics,
    portfolioStats,
    procurementStats,
    directAssignmentViolations: (directAssignmentViolations || []).map((v) => ({
      subprojectTitle: v.laterEvent?.subprojectTitle || v.earlierEvent?.subprojectTitle || '',
      projectTitle: v.laterEvent?.projectTitle || v.earlierEvent?.projectTitle || '',
      message: formatViolationSummary(v),
    })),
    contractorChronology: buildContractorChronology(statistics.contractors || []),
  });

  const handleStatisticsTabExport = async (scope) => {
    if (!loggedInUsername) {
      showToast('Απαιτείται σύνδεση χρήστη', 'warning');
      return;
    }
    const tabs = scope === 'all'
      ? STATS_TABS.map((t) => buildTabExportPayload(t.id))
      : [buildTabExportPayload(activeTab)];
    setExportingReport(true);
    try {
      const res = await ipcRenderer.invoke('export-statistics-report', {
        tabs,
        actingUsername: loggedInUsername,
        filterNote: statisticsFilterNote || `${projects.length} υποέργα`,
        projectCount: projects.length,
        scopeSubprojectIds,
        reportTitle: scope === 'all' ? 'Πλήρης Στατιστική Αναφορά ERGOHUB' : undefined,
      });
      if (res?.success) {
        setExportModalOpen(false);
        setExportSuccess({
          filePath: res.filePath,
          sheetCount: res.sheetCount || tabs.length,
          exportedAt: res.exportedAt,
          actionCount: projects.length,
        });
      } else if (!res?.canceled) {
        showToast(res?.error || 'Αποτυχία εξαγωγής', 'error');
      }
    } finally {
      setExportingReport(false);
    }
  };

  const handleKhmdhsExportFromModal = async (reportType) => {
    await handlePortfolioExport(reportType);
  };

  const statistics = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        totalProjects: 0, totalFunding: 0, totalContracted: 0, totalCompleted: 0,
        inProgressCount: 0, completedCount: 0,
        projectTypes: {}, fundingSources: {}, fundingDetails: {}, projectStatuses: {},
        assignmentProcedures: {}, assignmentWithProcedure: 0, assignmentWithoutProcedure: 0,
        contractors: [], uniqueContractors: 0, projectsWithKhmdhs: 0,
        contractsTimelineByYear: {}, contractorAmountByYear: {},
        totalContractorAmount: 0, totalContractorContracts: 0,
        uniqueProjects: 0
      };
    }

    const totalProjects = projects.length;
    const uniqueProjects = new Set(projects.map(p => p.projectTitle)).size;

    const totalFunding = projects.reduce((sum, p) => sum + safeParseAmt(p.approvedAmount), 0);

    const totalContracted = projects.reduce((sum, p) => {
      return sum + (getTotalContractAmount(p) || 0);
    }, 0);

    const inProgressCount = projects.filter(p =>
      p.projectStatus === 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ'
    ).length;

    // Μόνο "ΟΛΟΚΛΗΡΩΜΕΝΟ" (εκτέλεση ολοκληρώθηκε, δεν έχει αποπληρωθεί ακόμα)
    const completedCount = projects.filter(p =>
      p.projectStatus === 'ΟΛΟΚΛΗΡΩΜΕΝΟ'
    ).length;

    const projectTypes = projects.reduce((acc, p) => {
      const type = p.projectType || 'Άγνωστο';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const fundingSources = projects.reduce((acc, p) => {
      const source = p.fundingSource || 'Άγνωστο';
      const amount = safeParseAmt(p.approvedAmount);
      if (!acc[source]) acc[source] = { count: 0, amount: 0 };
      acc[source].count += 1;
      acc[source].amount += amount;
      return acc;
    }, {});

    const projectStatuses = projects.reduce((acc, p) => {
      const status = p.projectStatus || 'Άγνωστο';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const fundingDetails = projects.reduce((acc, p) => {
      const detail = p.fundingDetails || 'Χωρίς εξειδίκευση';
      const amount = safeParseAmt(p.approvedAmount);
      if (!acc[detail]) acc[detail] = { count: 0, amount: 0 };
      acc[detail].count += 1;
      acc[detail].amount += amount;
      return acc;
    }, {});

    const assignmentProcedures = {};
    ASSIGNMENT_PROCEDURES.forEach((proc) => {
      assignmentProcedures[proc] = { count: 0, amount: 0 };
    });
    assignmentProcedures['Χωρίς καταχώριση'] = { count: 0, amount: 0 };

    let assignmentWithProcedure = 0;
    let assignmentWithoutProcedure = 0;

    projects.forEach((p) => {
      if (!statusShowsAssignmentProcedure(p.projectStatus)) return;
      const proc = getProjectAssignmentProcedure(p) || 'Χωρίς καταχώριση';
      if (!assignmentProcedures[proc]) {
        assignmentProcedures[proc] = { count: 0, amount: 0 };
      }
      const amt = getTotalContractAmount(p) || safeParseAmt(p.approvedAmount);
      assignmentProcedures[proc].count += 1;
      assignmentProcedures[proc].amount += amt;
      if (proc === 'Χωρίς καταχώριση') assignmentWithoutProcedure += 1;
      else assignmentWithProcedure += 1;
    });

    const contractors = buildContractorProfiles(projects);
    const projectsWithKhmdhs = new Set(
      contractors.flatMap((c) => c.assignments.map((a) => a.subprojectId))
    ).size;
    const contractsTimelineByYear = getContractsTimelineByYear(contractors);
    const contractorAmountByYear = getContractorAmountByYear(contractors);
    const totalContractorAmount = contractors.reduce((s, c) => s + c.amount, 0);
    const totalContractorContracts = contractors.reduce((s, c) => s + c.count, 0);

    return {
      totalProjects, totalFunding, totalContracted,
      inProgressCount, completedCount,
      projectTypes, fundingSources, fundingDetails, projectStatuses,
      assignmentProcedures, assignmentWithProcedure, assignmentWithoutProcedure,
      contractors,
      uniqueContractors: contractors.length,
      projectsWithKhmdhs,
      contractsTimelineByYear,
      contractorAmountByYear,
      totalContractorAmount,
      totalContractorContracts,
      uniqueProjects
    };
  }, [projects]);

  useEffect(() => {
    if (!statistics.contractors.length) {
      setSelectedContractorKey('');
      return;
    }
    const stillValid = statistics.contractors.some((c) => c.key === selectedContractorKey);
    if (!stillValid) {
      setSelectedContractorKey(statistics.contractors[0].key);
    }
  }, [statistics.contractors, selectedContractorKey]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Project Types Doughnut
  const projectTypesData = {
    labels: Object.keys(statistics.projectTypes),
    datasets: [{
      data: Object.values(statistics.projectTypes),
      backgroundColor: CHART_COLORS.slice(0, Object.keys(statistics.projectTypes).length),
      borderWidth: 3,
      borderColor: '#fff',
      hoverOffset: 6,
    }]
  };

  // Funding Sources Bar
  const fundingSourcesData = {
    labels: Object.keys(statistics.fundingSources).map(s => s.length > 18 ? s.substring(0, 15) + '…' : s),
    datasets: [{
      label: 'Χρηματοδότηση (€)',
      data: Object.values(statistics.fundingSources).map(item => item.amount),
      backgroundColor: CHART_COLORS.map(c => c + 'cc'),
      borderColor: CHART_COLORS,
      borderWidth: 1,
      borderRadius: 8,
    }]
  };

  // Project Statuses Doughnut
  const statusColorMap = {
    'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': '#f59e0b',
    'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': '#ea580c',
    'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': '#2563eb',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ': '#059669',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': '#0d9488',
    [PROJECT_STATUS_ABANDONED]: '#64748b',
    'Άγνωστο': '#94a3b8',
  };
  const statusKeys = Object.keys(statistics.projectStatuses);
  const projectStatusesData = {
    labels: statusKeys.map(s => s.length > 22 ? s.substring(0, 20) + '…' : s),
    datasets: [{
      data: statusKeys.map(k => statistics.projectStatuses[k]),
      backgroundColor: statusKeys.map(k => statusColorMap[k] || '#94a3b8'),
      borderWidth: 3,
      borderColor: '#fff',
      hoverOffset: 6,
    }]
  };

  const contractedPct = statistics.totalFunding > 0
    ? Math.round((statistics.totalContracted / statistics.totalFunding) * 100)
    : 0;

  const truncateLabel = (text, max = 22) => {
    const s = String(text || '');
    return s.length > max ? `${s.substring(0, max - 1)}…` : s;
  };

  const topFundingDetails = Object.entries(statistics.fundingDetails || {})
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10);

  const fundingDetailsData = {
    labels: topFundingDetails.map(([k]) => truncateLabel(k, 28)),
    datasets: [{
      label: 'Εγκεκριμένο ποσό (€)',
      data: topFundingDetails.map(([, v]) => v.amount),
      backgroundColor: CHART_COLORS.map((c) => `${c}cc`),
      borderColor: CHART_COLORS,
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const assignmentEntries = Object.entries(statistics.assignmentProcedures || {})
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => {
      const ai = ASSIGNMENT_PROCEDURES.indexOf(a[0]);
      const bi = ASSIGNMENT_PROCEDURES.indexOf(b[0]);
      if (a[0] === 'Χωρίς καταχώριση') return 1;
      if (b[0] === 'Χωρίς καταχώριση') return -1;
      if (ai === -1 && bi === -1) return b[1].count - a[1].count;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const assignmentCountData = {
    labels: assignmentEntries.map(([k]) => truncateLabel(k, 24)),
    datasets: [{
      label: 'Υποέργα',
      data: assignmentEntries.map(([, v]) => v.count),
      backgroundColor: '#6366f1cc',
      borderColor: '#6366f1',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const assignmentAmountData = {
    labels: assignmentEntries.map(([k]) => truncateLabel(k, 24)),
    datasets: [{
      label: 'Ποσό σύμβασης (€)',
      data: assignmentEntries.map(([, v]) => v.amount),
      backgroundColor: '#0ea5e9cc',
      borderColor: '#0ea5e9',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const procurementProcedureEntries = Object.entries(procurementStats.procedureDistribution || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const procurementNoticeTypeEntries = Object.entries(procurementStats.noticeTypeDistribution || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const procurementActiveAmountEntries = Object.entries(procurementStats.activeEstimatedByProcedure || {})
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].amount - a[1].amount);

  const procurementProcedureCountData = {
    labels: procurementProcedureEntries.map(([k]) => truncateLabel(k, 22)),
    datasets: [{
      label: 'Υποέργα με δημοσίευση',
      data: procurementProcedureEntries.map(([, count]) => count),
      backgroundColor: '#dc2626cc',
      borderColor: '#dc2626',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const procurementNoticeTypeData = {
    labels: procurementNoticeTypeEntries.map(([k]) => truncateLabel(k, 22)),
    datasets: [{
      label: 'Υποέργα',
      data: procurementNoticeTypeEntries.map(([, count]) => count),
      backgroundColor: '#f97316cc',
      borderColor: '#f97316',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const procurementActiveAmountData = {
    labels: procurementActiveAmountEntries.map(([k]) => truncateLabel(k, 22)),
    datasets: [{
      label: 'Εκτιμ. αξία (€)',
      data: procurementActiveAmountEntries.map(([, v]) => v.amount),
      backgroundColor: '#b91c1ccc',
      borderColor: '#b91c1c',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const topContractors = (statistics.contractors || []).slice(0, 10);
  const selectedContractor = (statistics.contractors || []).find((c) => c.key === selectedContractorKey) || null;

  const timelineYears = Object.keys(statistics.contractsTimelineByYear || {})
    .map(Number)
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);

  const contractsTimelineData = {
    labels: timelineYears.map(String),
    datasets: [{
      label: 'Συμβάσεις',
      data: timelineYears.map((y) => statistics.contractsTimelineByYear[y] || 0),
      backgroundColor: '#8b5cf6cc',
      borderColor: '#8b5cf6',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const selectedProcedureEntries = selectedContractor
    ? Object.entries(selectedContractor.procedureCounts || {}).filter(([, v]) => v > 0)
    : [];
  const selectedProcedureData = {
    labels: selectedProcedureEntries.map(([k]) => truncateLabel(k, 20)),
    datasets: [{
      data: selectedProcedureEntries.map(([, v]) => v),
      backgroundColor: CHART_COLORS.slice(0, selectedProcedureEntries.length),
      borderWidth: 3,
      borderColor: '#fff',
      hoverOffset: 6
    }]
  };

  const contractorsAmountData = {
    labels: topContractors.map((c) => truncateLabel(c.name, 20)),
    datasets: [{
      label: 'Ποσό σύμβάσεων (€)',
      data: topContractors.map((c) => c.amount),
      backgroundColor: '#10b981cc',
      borderColor: '#10b981',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const contractsAmountTimelineData = {
    labels: timelineYears.map(String),
    datasets: [{
      label: 'Ποσό συμβάσεων (€)',
      data: timelineYears.map((y) => statistics.contractorAmountByYear[y] || 0),
      backgroundColor: '#0ea5e9cc',
      borderColor: '#0ea5e9',
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const top5Contractors = (statistics.contractors || []).slice(0, 5);
  const othersContractorAmount = Math.max(
    0,
    statistics.totalContractorAmount - top5Contractors.reduce((s, c) => s + c.amount, 0)
  );
  const marketShareData = {
    labels: [
      ...top5Contractors.map((c) => truncateLabel(c.name, 16)),
      ...(othersContractorAmount > 0 ? ['Λοιποί ανάδοχοι'] : [])
    ],
    datasets: [{
      data: [
        ...top5Contractors.map((c) => c.amount),
        ...(othersContractorAmount > 0 ? [othersContractorAmount] : [])
      ],
      backgroundColor: CHART_COLORS.slice(0, top5Contractors.length + (othersContractorAmount > 0 ? 1 : 0)),
      borderWidth: 3,
      borderColor: '#fff',
      hoverOffset: 8
    }]
  };

  const contractorAnalytics = useMemo(() => {
    const contractors = statistics.contractors || [];
    const totalAmount = statistics.totalContractorAmount || 0;
    const enriched = contractors.map((c) => {
      const topProcEntry = Object.entries(c.procedureCounts || {}).sort((a, b) => b[1] - a[1])[0];
      return {
        ...c,
        avgAmount: c.count > 0 ? c.amount / c.count : 0,
        sharePercent: totalAmount > 0 ? (c.amount / totalAmount) * 100 : 0,
        activeYears: Object.keys(c.contractsByYear || {}).length,
        topProcedure: topProcEntry ? topProcEntry[0] : '—'
      };
    });
    const chronology = buildContractorChronology(contractors);
    const chronologyByYear = groupChronologyByYear(chronology);
    const colorMap = {};
    contractors.forEach((c, i) => {
      colorMap[c.key] = CHART_COLORS[i % CHART_COLORS.length];
    });
    const years = chronologyByYear.map((g) => g.year);
    return {
      enriched,
      chronology,
      chronologyByYear,
      colorMap,
      yearSpan: years.length ? `${years[0]} – ${years[years.length - 1]}` : '—',
      totalChronoAmount: chronology.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    };
  }, [statistics.contractors, statistics.totalContractorAmount]);

  const filteredChronologyByYear = useMemo(() => {
    if (chronoFilterKey === 'all') return contractorAnalytics.chronologyByYear;
    return contractorAnalytics.chronologyByYear
      .map((group) => ({
        ...group,
        events: group.events.filter((e) => e.contractorKey === chronoFilterKey),
        contractCount: group.events.filter((e) => e.contractorKey === chronoFilterKey).length,
        totalAmount: group.events
          .filter((e) => e.contractorKey === chronoFilterKey)
          .reduce((s, e) => s + (Number(e.amount) || 0), 0),
        contractorCount: 1
      }))
      .filter((g) => g.events.length > 0);
  }, [contractorAnalytics.chronologyByYear, chronoFilterKey]);

  const selectedContractorEnriched = contractorAnalytics.enriched.find(
    (c) => c.key === selectedContractorKey
  ) || null;

  const contractorRankByKey = useMemo(() => {
    const ranks = {};
    contractorAnalytics.enriched.forEach((c, idx) => {
      ranks[c.key] = idx;
    });
    return ranks;
  }, [contractorAnalytics.enriched]);

  const filteredContractorsForList = useMemo(() => {
    const all = contractorAnalytics.enriched;
    const q = contractorSearchQuery.trim();
    if (!q) return all;
    return all.filter(
      (c) => containsSearchTerm(c.name, q) || containsSearchTerm(c.vat || '', q)
    );
  }, [contractorAnalytics.enriched, contractorSearchQuery]);

  useEffect(() => {
    if (!contractorSearchQuery.trim() || filteredContractorsForList.length === 0) return;
    const stillVisible = filteredContractorsForList.some((c) => c.key === selectedContractorKey);
    if (!stillVisible) {
      setSelectedContractorKey(filteredContractorsForList[0].key);
    }
  }, [contractorSearchQuery, filteredContractorsForList, selectedContractorKey]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 10,
          boxWidth: 10,
          boxHeight: 10,
          font: { size: 10, weight: '600' },
          color: '#475569'
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 11, weight: '700' },
        bodyFont: { size: 11 }
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, color: '#64748b' }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
        ticks: {
          font: { size: 9 },
          color: '#64748b',
          callback: function(value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M€';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'K€';
            return value + '€';
          }
        }
      }
    },
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    }
  };

  const doughnutOptions = {
    ...chartOptions,
    cutout: '62%',
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'bottom',
      }
    }
  };

  // ── Helpers for chain tab ────────────────────────────────────────────────
  const formatCurrencyShort = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `€${Math.round(n / 1_000)}K`;
    return `€${Math.round(n).toLocaleString('el-GR')}`;
  };

  const reliabilityScoreColor = (score) => {
    if (score == null) return { color: '#94a3b8', bg: '#f8fafc' };
    if (score >= 80) return { color: '#059669', bg: '#ecfdf5' };
    if (score >= 60) return { color: '#d97706', bg: '#fffbeb' };
    return { color: '#dc2626', bg: '#fef2f2' };
  };

  const renderPortfolioHealthBar = () => {
    const hb = portfolioStats.healthBar || {};
    const total = portfolioStats.total;
    const payPct = hb.payVsSymvPct;
    const awaitingPay = hb.awaitingFirstPayment ?? portfolioStats.awaitingFirstPaymentIds?.length ?? 0;
    return (
      <PortfolioHealthBar>
        <HealthPill
          type="button"
          $bg="#ecfdf5"
          $border="rgba(16,185,129,0.25)"
          onClick={() => applyPortfolioDrill('fullChain')}
          title="Έως σύμβαση (τα εντάλματα μετράνε ξεχωριστά). Κλικ για φιλτράρισμα."
        >
          <HealthPillValue $color="#059669">{hb.fullChain ?? 0}</HealthPillValue>
          <HealthPillLabel>Πλήρης αλυσίδα</HealthPillLabel>
          <HealthPillSub>
            έως σύμβαση
            {total > 0 ? ` · ${Math.round((hb.fullChain / total) * 100)}%` : ''}
          </HealthPillSub>
        </HealthPill>
        <HealthPill
          type="button"
          $bg="#fffbeb"
          $border="rgba(245,158,11,0.25)"
          onClick={() => applyPortfolioDrill('inProgress')}
          title="Ενδιάμεσα στάδια, εντός φυσιολογικού χρόνου. Κλικ για φιλτράρισμα."
        >
          <HealthPillValue $color="#d97706">{hb.inProgress ?? 0}</HealthPillValue>
          <HealthPillLabel>Σε εξέλιξη</HealthPillLabel>
          <HealthPillSub>ενδιάμεσα στάδια, εντός χρόνου</HealthPillSub>
        </HealthPill>
        <HealthPill
          type="button"
          $bg="#fff7ed"
          $border="rgba(234,88,12,0.28)"
          onClick={() => applyPortfolioDrill('stuck')}
          title="Καθυστερήσεις μεταξύ σταδίων (δημοσίευση→ανάθεση ή ανάθεση→σύμβαση) μετά το εύλογο περιθώριο. Δεν σημαίνει «χαλασμένο» έργο. Κλικ για φιλτράρισμα."
        >
          <HealthPillValue $color="#ea580c">{hb.stuck ?? 0}</HealthPillValue>
          <HealthPillLabel>Χρειάζονται προσοχή</HealthPillLabel>
          <HealthPillSub>καθυστερήσεις μεταξύ σταδίων</HealthPillSub>
        </HealthPill>
        <HealthPill
          type="button"
          $bg="#ecfeff"
          $border="rgba(6,182,212,0.22)"
          onClick={() => applyPortfolioDrill('withSymv')}
          title="Ποσοστό ποσού πληρωμών προς ποσό συμβάσεων. Κλικ για υποέργα με σύμβαση."
        >
          <HealthPillValue $color="#0891b2">
            {payPct != null ? `${payPct}%` : '—'}
          </HealthPillValue>
          <HealthPillLabel>Πληρωμές / Σύμβαση</HealthPillLabel>
          <HealthPillSub>
            {hb.payTotal > 0
              ? `${formatCurrencyShort(hb.payTotal)} / ${formatCurrencyShort(hb.symvTotal)}`
              : 'χωρίς εντάλματα ακόμα'}
          </HealthPillSub>
        </HealthPill>
        {awaitingPay > 0 && (
          <HealthPill
            type="button"
            $bg="#f0f9ff"
            $border="rgba(14,165,233,0.22)"
            onClick={() => applyPortfolioDrill('awaitingFirstPayment')}
            title="Έχουν σύμβαση αλλά δεν έχουν ακόμα εντάλματα πληρωμής — συχνά φυσιολογικό. Κλικ για φιλτράρισμα."
          >
            <HealthPillValue $color="#0284c7">{awaitingPay}</HealthPillValue>
            <HealthPillLabel>Χωρίς εντάλματα ακόμα</HealthPillLabel>
            <HealthPillSub>με σύμβαση, χωρίς PAY</HealthPillSub>
          </HealthPill>
        )}
      </PortfolioHealthBar>
    );
  };

  const renderChainTab = () => {
    const ps = portfolioStats;
    const total = ps.total;

    const anyCount = ps.withKhmdhsIds?.length ?? ps.funnel.any.length;
    const relatedCount = ps.relatedDocsCount ?? ps.funnel.RELATED?.length ?? 0;
    const pipeline = ps.pipeline;

    return (
      <>
        {(relatedCount > 0 || anyCount > 0) && (
          <ChainFunnelNote style={{ marginBottom: '1rem' }}>
            {anyCount} υποέργα με κύρια αλυσίδα ΚΗΜΔΗΣ
            {relatedCount > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => applyPortfolioDrill('withRelated')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {relatedCount} με σχετικά έγγραφα
                </button>
              </>
            )}
            {onPortfolioDrillDown && ' — κλικ σε στάδιο/κενό για φιλτράρισμα λίστας'}
          </ChainFunnelNote>
        )}

        {/* ── Funnel + Stage cards ─────────────────────────────── */}
        <ChainBodyGrid>
          {/* Left: Funnel */}
          <ChainFunnelCard>
            <ChainSectionTitle>Κύκλος ζωής — Funnel σταδίων</ChainSectionTitle>
            <ChainFunnelNote>
              Αριθμός υποέργων σε κάθε στάδιο. Η μείωση προς τα εντάλματα είναι συχνά φυσιολογική
              (χρόνος μέχρι τον πρώτο λογαριασμό) — όχι απαραίτητα πρόβλημα.
            </ChainFunnelNote>
            {STAGE_FUNNEL_ORDER.map((id) => {
              const meta = LIFECYCLE_STAGE_META[id] || {};
              const ids = ps.funnel[id] || [];
              const count = ids.length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barPct = anyCount > 0 ? Math.round((count / anyCount) * 100) : 0;
              const stageAmt = ps.stageDetails[id]?.total;
              return (
                <FunnelRow
                  key={id}
                  type="button"
                  onClick={() => applyPortfolioDrill(`stage_${id}`)}
                  title="Φιλτράρισμα λίστας υποέργων"
                >
                  <FunnelLabel>
                    <FunnelIcon>{meta.icon}</FunnelIcon>
                    <FunnelLabelText>{meta.label || id}</FunnelLabelText>
                  </FunnelLabel>
                  <FunnelBarWrap>
                    <FunnelBar $pct={barPct} $color={meta.accent || '#6366f1'} />
                  </FunnelBarWrap>
                  <FunnelCountBadge $color={meta.accent || '#6366f1'}>
                    {count} <FunnelPctSpan>({pct}%)</FunnelPctSpan>
                  </FunnelCountBadge>
                  {stageAmt > 0 && (
                    <FunnelAmtBadge>{formatCurrencyShort(stageAmt)}</FunnelAmtBadge>
                  )}
                </FunnelRow>
              );
            })}
          </ChainFunnelCard>

          {/* Right: Stage detail cards */}
          <ChainStageGrid>
            {STAGE_FUNNEL_ORDER.map((id) => {
              const meta = LIFECYCLE_STAGE_META[id] || {};
              const det = ps.stageDetails[id] || {};
              const count = (ps.funnel[id] || []).length;
              const extras = [];
              if (det.cancelledIds?.length) extras.push(`${det.cancelledIds.length} ακυρωμέν${det.cancelledIds.length === 1 ? 'ο' : 'α'}`);
              if (det.multipleIds?.length)  extras.push(`${det.multipleIds.length} με πολλαπλές`);
              return (
                <StageDetailCard
                  key={id}
                  type="button"
                  $accent={meta.accent}
                  $bg={meta.bg}
                  $border={meta.border}
                  onClick={() => applyPortfolioDrill(`stage_${id}`)}
                  title="Φιλτράρισμα λίστας υποέργων"
                >
                  <StageCardHeader>
                    <StageCardIcon>{meta.icon}</StageCardIcon>
                    <StageCardTitle>{meta.shortLabel || id}</StageCardTitle>
                    <StageCardCount $accent={meta.accent}>{count}</StageCardCount>
                  </StageCardHeader>
                  {det.total > 0 && (
                    <StageCardAmount>{formatCurrencyShort(det.total)}</StageCardAmount>
                  )}
                  {extras.length > 0 && (
                    <StageCardExtras>{extras.join(' · ')}</StageCardExtras>
                  )}
                </StageDetailCard>
              );
            })}
          </ChainStageGrid>
        </ChainBodyGrid>

        {/* ── Gaps table ───────────────────────────────────────── */}
        {Object.values(ps.gaps).some((a) => a.length > 0) && (
          <ChainGapSection>
            <ChainSectionTitle>Καθυστερήσεις μεταξύ σταδίων — χρειάζονται προσοχή</ChainSectionTitle>
            <GapGrid>
              {Object.entries(GAP_LABELS).map(([key, meta]) => {
                const items = ps.gaps[key] || [];
                if (!items.length) return null;
                const gapExpanded = !!expandedGapLists[key];
                const visibleGapItems = gapExpanded ? items : items.slice(0, GAP_LIST_PREVIEW);
                return (
                  <GapCard key={key} $color={meta.color} $bg={meta.bg}>
                    <GapCardHeader
                      type="button"
                      onClick={() => applyPortfolioDrill(null, { gapKey: key })}
                      title="Φιλτράρισμα λίστας υποέργων"
                    >
                      <span>{meta.icon}</span>
                      <GapCardTitle $color={meta.color}>{meta.label}</GapCardTitle>
                      <GapCardCount $color={meta.color}>{items.length}</GapCardCount>
                    </GapCardHeader>
                    <GapList>
                      {visibleGapItems.map((item) => (
                        <GapListItem
                          key={item.subprojectId}
                          type="button"
                          onClick={() => applyPortfolioDrill(null, {
                            subprojectId: item.subprojectId,
                            label: item.subprojectTitle || item.projectTitle,
                          })}
                        >
                          <GapListTitle title={`${item.projectTitle} — ${item.subprojectTitle}`}>
                            {item.subprojectTitle || item.projectTitle || item.subprojectId}
                          </GapListTitle>
                          <GapListMeta>{item.projectTitle}</GapListMeta>
                        </GapListItem>
                      ))}
                      {items.length > GAP_LIST_PREVIEW && (
                        <ExpandMoreBtn
                          type="button"
                          onClick={() => toggleGapListExpanded(key)}
                        >
                          {gapExpanded
                            ? 'Σύμπτυξη λίστας'
                            : `Εμφάνιση όλων (${items.length})`}
                        </ExpandMoreBtn>
                      )}
                    </GapList>
                  </GapCard>
                );
              })}
            </GapGrid>
          </ChainGapSection>
        )}

        {/* ── Financial pipeline ───────────────────────────────── */}
        {pipeline.approved > 0 || pipeline.symvTotal > 0 ? (
          <ChainPipelineSection>
            <ChainSectionTitle>💶 Χρηματικός αγωγός (σύνολα από ΚΗΜΔΗΣ)</ChainSectionTitle>
            <PipelineNote>
              Πορεία χρήματος από εγκεκριμένο ποσό έως πληρωμές — βάσει δεδομένων ΚΗΜΔΗΣ.
              Για αποφάσεις ανάληψης υποχρέωσης χρησιμοποιείται η πιο πρόσφατη ετήσια απόφαση ανά υποέργο (όχι άθροισμα ετών).
            </PipelineNote>
            {[
              { label: 'Εγκεκριμένο σύνολο', value: pipeline.approved, pct: 100, color: '#6366f1' },
              { label: 'Αιτήματα REQ', value: pipeline.reqTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.reqTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.REQ.accent, count: pipeline.reqCount, stage: 'REQ' },
              { label: LIFECYCLE_STAGE_META.COMMIT.label, value: pipeline.commitTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.commitTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.COMMIT.accent, count: pipeline.commitCount, stage: 'COMMIT' },
              { label: `Εκτίμηση ${LIFECYCLE_STAGE_META.PROC.label}`, value: pipeline.procTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.procTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.PROC.accent, count: pipeline.procCount, stage: 'PROC' },
              { label: 'Ανάθεση AWRD', value: pipeline.awrdTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.awrdTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.AWRD.accent, count: pipeline.awrdCount, stage: 'AWRD' },
              { label: 'Σύμβαση SYMV', value: pipeline.symvTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.symvTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.SYMV.accent, count: pipeline.symvCount, stage: 'SYMV' },
              { label: 'Πληρωμές PAY', value: pipeline.payTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.payTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.PAY.accent, count: pipeline.payCount, stage: 'PAY' },
            ].filter((r) => r.value > 0).map((row) => (
              <PipelineRow key={row.label}>
                <PipelineRowLabel>
                  {row.stage && LIFECYCLE_STAGE_META[row.stage]
                    ? <span>{LIFECYCLE_STAGE_META[row.stage].icon} </span>
                    : null}
                  {row.label}
                  {row.count != null && (
                    <PipelineRowCount>{row.count} υποέργα</PipelineRowCount>
                  )}
                </PipelineRowLabel>
                <PipelineBarWrap>
                  <PipelineBar $pct={Math.min(row.pct || 0, 100)} $color={row.color} />
                </PipelineBarWrap>
                <PipelineRowValue>
                  {formatCurrency(row.value)}
                  {row.pct != null && row.pct !== 100 && (
                    <PipelinePct $color={row.pct >= 80 ? '#059669' : row.pct >= 40 ? '#f59e0b' : '#94a3b8'}>
                      {row.pct}%
                    </PipelinePct>
                  )}
                </PipelineRowValue>
              </PipelineRow>
            ))}
            {ps.payVsSymvPct != null && (
              <PipelineSummaryRow>
                <span>Εκτέλεση: </span>
                <PipelineExecBadge $pct={ps.payVsSymvPct}>
                  {ps.payVsSymvPct}% πληρωμένο / συμβατό
                </PipelineExecBadge>
              </PipelineSummaryRow>
            )}
          </ChainPipelineSection>
        ) : null}

        {/* ── Avg depth ─────────────────────────────────────────── */}
        <ChainDepthRow>
          <ChainDepthLabel>Μέσο βάθος αλυσίδας ανά υποέργο</ChainDepthLabel>
          <ChainDepthValue>{ps.avgDepth} / 6 στάδια</ChainDepthValue>
        </ChainDepthRow>
      </>
    );
  };

  const renderFinancialTab = () => {
    const ps = portfolioStats;
    const pipeline = ps.pipeline;
    const symvT = pipeline.symvTotal || 0;
    const payT = pipeline.payTotal || 0;
    const approvedT = pipeline.approved || 0;
    const payVsSymv = ps.payVsSymvPct;
    const symvVsApproved = ps.symvVsApprovedPct;

    const executionDoughnut = symvT > 0 ? {
      labels: ['Πληρωμένο', 'Υπόλοιπο σύμβασης'],
      datasets: [{
        data: [payT, Math.max(0, symvT - payT)],
        backgroundColor: ['#059669', '#e2e8f0'],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 4,
      }],
    } : null;

    const contractingDoughnut = approvedT > 0 ? {
      labels: ['Συμβασιοποιημένο', 'Μη συμβασιοποιημένο'],
      datasets: [{
        data: [symvT, Math.max(0, approvedT - symvT)],
        backgroundColor: ['#2563eb', '#e2e8f0'],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 4,
      }],
    } : null;

    const payMonths = Object.keys(ps.payByMonthAmounts || {}).sort();
    const recentMonths = payMonths.slice(-18);
    const payTimelineData = recentMonths.length ? {
      labels: recentMonths.map((ym) => {
        const [y, m] = ym.split('-');
        const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
        return `${months[parseInt(m, 10) - 1] || m} '${String(y).slice(2)}`;
      }),
      datasets: [{
        label: 'Πληρωμές (€)',
        data: recentMonths.map((ym) => ps.payByMonthAmounts[ym]),
        backgroundColor: 'rgba(6, 182, 212, 0.75)',
        borderColor: '#0891b2',
        borderWidth: 1,
        borderRadius: 6,
      }],
    } : null;

    const varianceWithSymv = (ps.varianceRows || []).filter((r) => r.symvAmount != null && r.symvAmount > 0);

    const pipelineRows = [
      { label: 'Εγκεκριμένο σύνολο', value: pipeline.approved, pct: 100, color: '#6366f1' },
      { label: 'Αιτήματα REQ', value: pipeline.reqTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.reqTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.REQ.accent, count: pipeline.reqCount, stage: 'REQ' },
      { label: LIFECYCLE_STAGE_META.COMMIT.label, value: pipeline.commitTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.commitTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.COMMIT.accent, count: pipeline.commitCount, stage: 'COMMIT' },
      { label: `Εκτίμηση ${LIFECYCLE_STAGE_META.PROC.label}`, value: pipeline.procTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.procTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.PROC.accent, count: pipeline.procCount, stage: 'PROC' },
      { label: 'Ανάθεση AWRD', value: pipeline.awrdTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.awrdTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.AWRD.accent, count: pipeline.awrdCount, stage: 'AWRD' },
      { label: 'Σύμβαση SYMV', value: pipeline.symvTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.symvTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.SYMV.accent, count: pipeline.symvCount, stage: 'SYMV' },
      { label: 'Πληρωμές PAY', value: pipeline.payTotal, pct: pipeline.approved > 0 ? Math.round(pipeline.payTotal / pipeline.approved * 100) : null, color: LIFECYCLE_STAGE_META.PAY.accent, count: pipeline.payCount, stage: 'PAY' },
    ].filter((r) => r.value > 0);

    return (
      <>
        {/* ── Execution KPIs + doughnuts ── */}
        <FinancialTopGrid>
          <FinancialExecCard $accent="#059669">
            <FinancialExecTitle>Εκτέλεση (πληρωμές / σύμβαση)</FinancialExecTitle>
            {symvT > 0 ? (
              <>
                <FinancialExecBig>{formatPercentInt(payVsSymv)}</FinancialExecBig>
                <FinancialExecSub>
                  {formatCurrency(payT)} από {formatCurrency(symvT)}
                </FinancialExecSub>
                {ps.procVsSymvAggregatePct != null && (
                  <FinancialExecSub style={{ marginTop: '0.35rem' }}>
                    Σύνολο σύμβασης vs δημοσίευση: {formatPercentInt(ps.procVsSymvAggregatePct, { signed: true })}
                  </FinancialExecSub>
                )}
                {executionDoughnut && (
                  <FinancialDoughnutWrap>
                    <Doughnut data={executionDoughnut} options={doughnutOptions} />
                  </FinancialDoughnutWrap>
                )}
              </>
            ) : (
              <NoDataMessage style={{ padding: '1rem 0' }}>Δεν υπάρχουν συμβασιοποιημένα ποσά</NoDataMessage>
            )}
          </FinancialExecCard>

          <FinancialExecCard $accent="#2563eb">
            <FinancialExecTitle>Συμβασιοποίηση (σύμβαση / εγκεκριμένο)</FinancialExecTitle>
            {approvedT > 0 ? (
              <>
                <FinancialExecBig>{formatPercentInt(symvVsApproved)}</FinancialExecBig>
                <FinancialExecSub>
                  {formatCurrency(symvT)} από {formatCurrency(approvedT)}
                </FinancialExecSub>
                {contractingDoughnut && (
                  <FinancialDoughnutWrap>
                    <Doughnut data={contractingDoughnut} options={doughnutOptions} />
                  </FinancialDoughnutWrap>
                )}
              </>
            ) : (
              <NoDataMessage style={{ padding: '1rem 0' }}>Δεν υπάρχουν εγκεκριμένα ποσά</NoDataMessage>
            )}
          </FinancialExecCard>
        </FinancialTopGrid>

        {/* ── Pipeline ── */}
        {pipelineRows.length > 0 && (
          <ChainPipelineSection>
            <ChainSectionTitle>💶 Χρηματικός αγωγός</ChainSectionTitle>
            <PipelineNote>
              Πορεία χρημάτων από εγκεκριμένο ποσό έως πληρωμές — βάσει δεδομένων ΚΗΜΔΗΣ ανά στάδιο.
              Οι αποφάσεις ανάληψης υποχρέωσης αθροίζονται με βάση την τελευταία ετήσια απόφαση κάθε υποέργου.
            </PipelineNote>
            {pipelineRows.map((row) => (
              <PipelineRow key={row.label}>
                <PipelineRowLabel>
                  {row.stage && LIFECYCLE_STAGE_META[row.stage]
                    ? <span>{LIFECYCLE_STAGE_META[row.stage].icon} </span>
                    : null}
                  {row.label}
                  {row.count != null && (
                    <PipelineRowCount>{row.count} υποέργα</PipelineRowCount>
                  )}
                </PipelineRowLabel>
                <PipelineBarWrap>
                  <PipelineBar $pct={Math.min(row.pct || 0, 100)} $color={row.color} />
                </PipelineBarWrap>
                <PipelineRowValue>
                  {formatCurrency(row.value)}
                  {row.pct != null && row.pct !== 100 && (
                    <PipelinePct $color={row.pct >= 80 ? '#059669' : row.pct >= 40 ? '#f59e0b' : '#94a3b8'}>
                      {row.pct}%
                    </PipelinePct>
                  )}
                </PipelineRowValue>
              </PipelineRow>
            ))}
          </ChainPipelineSection>
        )}

        {/* ── Variance table + PAY timeline ── */}
        <FinancialBodyGrid>
          <ChartContainer>
            <ChartTitle>📋 Αποκλίσεις ανά υποέργο (δημοσίευση → σύμβαση → πληρωμές)</ChartTitle>
            {varianceWithSymv.length > 0 ? (
              <HistoryTableWrap>
                <HistoryTable>
                  <thead>
                    <tr>
                      <th>Υποέργο</th>
                      <th>Εκτίμ. δημοσίευσης</th>
                      <th>Σύμβαση</th>
                      <th>Δημοσ.→Σύμβ.</th>
                      <th>Πληρωμές</th>
                      <th>% εκτ.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(financialVarianceExpanded
                      ? varianceWithSymv
                      : varianceWithSymv.slice(0, FINANCIAL_VARIANCE_PREVIEW)
                    ).map((row) => (
                      <tr key={row.subprojectId}>
                        <td title={`${row.projectTitle} — ${row.subprojectTitle}`}>
                          {row.subprojectTitle || row.projectTitle}
                        </td>
                        <td>{row.procAmount != null ? formatCurrency(row.procAmount) : '—'}</td>
                        <td>{formatCurrency(row.symvAmount)}</td>
                        <td style={{
                          fontWeight: 600,
                          color: row.procVsSymvPct == null ? '#94a3b8'
                            : row.procVsSymvPct > 10 ? '#dc2626'
                            : row.procVsSymvPct < -10 ? '#2563eb'
                            : '#64748b',
                        }}>
                          {row.procVsSymvPct != null ? formatPercentInt(row.procVsSymvPct, { signed: true }) : '—'}
                        </td>
                        <td>{row.payAmount != null ? formatCurrency(row.payAmount) : '—'}</td>
                        <td style={{
                          fontWeight: 700,
                          color: row.executionPct == null ? '#94a3b8'
                            : row.executionPct >= 80 ? '#059669'
                            : row.executionPct >= 40 ? '#d97706'
                            : '#dc2626',
                        }}>
                          {formatPercentInt(row.executionPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </HistoryTable>
              </HistoryTableWrap>
            ) : (
              <NoDataMessage>Δεν υπάρχουν υποέργα με καταχωρημένο ποσό σύμβασης</NoDataMessage>
            )}
            {varianceWithSymv.length > FINANCIAL_VARIANCE_PREVIEW && (
              <FinancialTableMore
                type="button"
                onClick={() => setFinancialVarianceExpanded((v) => !v)}
              >
                {financialVarianceExpanded
                  ? 'Σύμπτυξη πίνακα'
                  : `Εμφάνιση όλων (${varianceWithSymv.length} υποέργα)`}
              </FinancialTableMore>
            )}
          </ChartContainer>

          <ChartContainer>
            <ChartTitle>📅 Timeline πληρωμών (ανά μήνα)</ChartTitle>
            {payTimelineData ? (
              <ChartWrapper style={{ height: 280 }}>
                <Bar data={payTimelineData} options={barChartOptions} />
              </ChartWrapper>
            ) : (
              <NoDataMessage>Δεν υπάρχουν ημερομηνίες ενταλμάτων πληρωμής</NoDataMessage>
            )}
          </ChartContainer>
        </FinancialBodyGrid>
      </>
    );
  };

  const renderQualityTab = () => {
    const ps = portfolioStats;
    const score = ps.reliabilityScore;
    const parts = ps.scoreParts || {};
    const scoreStyle = reliabilityScoreColor(score);
    const fresh = ps.freshness || { fresh: [], stale: [], old: [], none: [] };

    const freshnessChartData = {
      labels: ['< 30 ημέρες', 'Προτείνεται ανανέωση', 'Αναγκαία ανανέωση', 'Χωρίς ΚΗΜΔΗΣ'],
      datasets: [{
        label: 'Υποέργα',
        data: [
          fresh.fresh.length,
          fresh.stale.length,
          fresh.old.length,
          fresh.none.length,
        ],
        backgroundColor: ['#059669', '#f59e0b', '#dc2626', '#94a3b8'],
        borderWidth: 1,
        borderRadius: 6,
      }],
    };

    const scorePartRows = [
      { key: 'khmdhsCoverage', label: 'Κάλυψη ΚΗΜΔΗΣ', pct: parts.khmdhsCoverage },
      { key: 'dqrClean', label: 'Χωρίς εκκρεμή έλεγχο', pct: parts.dqrClean },
      { key: 'freshnessGood', label: 'Ανανεωμένα / αποδεκτά', pct: parts.freshnessGood },
      { key: 'noCancelled', label: 'Χωρίς ματαιωμένα στάδια', pct: parts.noCancelled },
    ];

    return (
      <>
        <QualityScoreHero>
          <QualityScoreCircle $color={scoreStyle.color} $bg={scoreStyle.bg}>
            <QualityScoreNumber $color={scoreStyle.color}>
              {score != null ? score : '—'}
            </QualityScoreNumber>
            <QualityScoreOf>/ 100</QualityScoreOf>
          </QualityScoreCircle>
          <div style={{ flex: 1 }}>
            <ChainSectionTitle>Σκορ αξιοπιστίας χαρτοφυλακίου</ChainSectionTitle>
            <PipelineNote style={{ marginBottom: '0.75rem' }}>
              Συνδυασμός κάλυψης ΚΗΜΔΗΣ, καθαρότητας ελέγχου δεδομένων, φρεσκάδας ανακτήσεων και ακεραιότητας αλυσίδας.
            </PipelineNote>
            <QualityScoreBreakdown>
              {scorePartRows.map((row) => (
                <QualityScorePart key={row.key}>
                  <QualityPartLabel>
                    <span>{row.label}</span>
                    <span>{row.pct != null ? `${row.pct}%` : '—'}</span>
                  </QualityPartLabel>
                  <QualityPartBar>
                    <QualityPartFill
                      $pct={row.pct}
                      $color={row.pct >= 80 ? '#059669' : row.pct >= 50 ? '#f59e0b' : '#dc2626'}
                    />
                  </QualityPartBar>
                </QualityScorePart>
              ))}
            </QualityScoreBreakdown>
          </div>
        </QualityScoreHero>

        <FinancialBodyGrid>
          <ChartContainer>
            <ChartTitle>⚠️ Χρειάζονται προσοχή ({ps.attentionList?.length || 0})</ChartTitle>
            {(ps.attentionList || []).length > 0 ? (
              <AttentionList>
                {(qualityAttentionExpanded
                  ? ps.attentionList
                  : ps.attentionList.slice(0, QUALITY_ATTENTION_PREVIEW)
                ).map((item) => (
                  <AttentionItem
                    key={item.subprojectId}
                    type="button"
                    $accent={item.unresolvedCount > 0 ? '#dc2626' : '#f59e0b'}
                    onClick={() => applyPortfolioDrill(null, {
                      subprojectId: item.subprojectId,
                      label: item.subprojectTitle || item.projectTitle,
                    })}
                  >
                    <AttentionTitle>{item.subprojectTitle || item.projectTitle}</AttentionTitle>
                    <AttentionMeta>
                      {item.projectTitle}
                      {item.projectStatus ? ` · ${item.projectStatus}` : ''}
                    </AttentionMeta>
                    <AttentionIssues>{item.issues.join(' · ')}</AttentionIssues>
                  </AttentionItem>
                ))}
                {ps.attentionList.length > QUALITY_ATTENTION_PREVIEW && (
                  <ExpandMoreBtn
                    type="button"
                    onClick={() => setQualityAttentionExpanded((v) => !v)}
                  >
                    {qualityAttentionExpanded
                      ? 'Σύμπτυξη λίστας'
                      : `Εμφάνιση όλων (${ps.attentionList.length})`}
                  </ExpandMoreBtn>
                )}
              </AttentionList>
            ) : (
              <NoDataMessage>Δεν εντοπίστηκαν θέματα — το χαρτοφυλάκιο είναι σε καλή κατάσταση</NoDataMessage>
            )}
          </ChartContainer>

          <ChartContainer>
            <ChartTitle>🕐 Φρεσκάδα ανακτήσεων ΚΗΜΔΗΣ</ChartTitle>
            <ChartWrapper style={{ height: 260 }}>
              <Bar data={freshnessChartData} options={{
                ...barChartOptions,
                plugins: {
                  ...barChartOptions.plugins,
                  legend: { display: false },
                },
              }}
              />
            </ChartWrapper>
            <PipelineNote style={{ marginTop: '0.65rem' }}>
              {fresh.fresh.length} πρόσφατα · {fresh.stale.length} 1–6 μήνες · {fresh.old.length} παλιά · {fresh.none.length} χωρίς ΚΗΜΔΗΣ
            </PipelineNote>
          </ChartContainer>
        </FinancialBodyGrid>
      </>
    );
  };

  if (projects.length === 0) {
    const EmptyShell = embedded ? EmbeddedStatsRoot : StatisticsContainer;
    return (
      <EmptyShell>
        {variant === 'full' && (
          <StatsHeader>
            <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
          </StatsHeader>
        )}
        {variant === 'summary' && (
          <StatsHeader>
            <StatisticsTitle>Σύνοψη Υποέργων</StatisticsTitle>
          </StatsHeader>
        )}
        <NoDataMessage>Δεν υπάρχουν δεδομένα για την εμφάνιση στατιστικών</NoDataMessage>
      </EmptyShell>
    );
  }

  const renderOverviewTab = () => (
    <>
      <SummaryStats>
        <StatCard
          bg="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          shadow="0 4px 18px rgba(16, 185, 129, 0.28)"
          shadowHover="0 8px 28px rgba(16, 185, 129, 0.42)"
        >
          <StatCardIcon>🏗️</StatCardIcon>
          <StatCardBody>
            <StatCardDualNumbers>
              <StatCardDualItem>
                <StatNumber>{statistics.uniqueProjects}</StatNumber>
                <StatLabel>Έργα</StatLabel>
              </StatCardDualItem>
              <StatCardDualItem>
                <StatNumber>{statistics.totalProjects}</StatNumber>
                <StatLabel>Υποέργα</StatLabel>
              </StatCardDualItem>
            </StatCardDualNumbers>
          </StatCardBody>
        </StatCard>

        <StatCard
          bg="linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
          shadow="0 4px 18px rgba(37, 99, 235, 0.28)"
          shadowHover="0 8px 28px rgba(37, 99, 235, 0.42)"
        >
          <StatCardIcon>⚡</StatCardIcon>
          <StatCardBody>
            <StatNumber>{statistics.inProgressCount}</StatNumber>
            <StatLabel>Εκτελούμενα</StatLabel>
            <StatCardSubtext>συμβασιοποιημένα</StatCardSubtext>
          </StatCardBody>
        </StatCard>

        <StatCard
          bg="linear-gradient(135deg, #059669 0%, #047857 100%)"
          shadow="0 4px 18px rgba(5, 150, 105, 0.28)"
          shadowHover="0 8px 28px rgba(5, 150, 105, 0.42)"
        >
          <StatCardIcon>✅</StatCardIcon>
          <StatCardBody>
            <StatNumber>{statistics.completedCount}</StatNumber>
            <StatLabel>Ολοκληρωμένα</StatLabel>
            <StatCardSubtext>εκτέλεση ολοκλ.</StatCardSubtext>
          </StatCardBody>
        </StatCard>

        <StatCard
          bg="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          shadow="0 4px 18px rgba(245, 158, 11, 0.28)"
          shadowHover="0 8px 28px rgba(245, 158, 11, 0.42)"
        >
          <StatCardIcon>💰</StatCardIcon>
          <StatCardBody>
            <StatNumber style={{ fontSize: '1.1rem' }}>{formatCurrency(statistics.totalFunding)}</StatNumber>
            <StatLabel>Εγκεκριμένη Χρηματ/ση</StatLabel>
          </StatCardBody>
        </StatCard>
      </SummaryStats>

      {/* Budget Summary Row */}
      {statistics.totalFunding > 0 && (
        <BudgetSummaryRow>
          <BudgetSummaryItem>
            <BudgetSummaryLabel>Εγκεκριμένο σύνολο</BudgetSummaryLabel>
            <BudgetSummaryValue $color="#1e293b">{formatCurrency(statistics.totalFunding)}</BudgetSummaryValue>
            <BudgetBarTrack><BudgetBarFill $pct={100} $gradient="linear-gradient(90deg, #6366f1, #8b5cf6)" /></BudgetBarTrack>
          </BudgetSummaryItem>
          <BudgetSummaryItem>
            <BudgetSummaryLabel>Συμβασιοποιημένο</BudgetSummaryLabel>
            <BudgetSummaryValue $color="#2563eb">{formatCurrency(statistics.totalContracted)}</BudgetSummaryValue>
            <BudgetBarTrack><BudgetBarFill $pct={contractedPct} $gradient="linear-gradient(90deg, #60a5fa, #2563eb)" /></BudgetBarTrack>
          </BudgetSummaryItem>
          <BudgetSummaryItem>
            <BudgetSummaryLabel>% Συμβασιοποίησης</BudgetSummaryLabel>
            <BudgetSummaryValue $color={contractedPct >= 70 ? '#059669' : contractedPct >= 30 ? '#f59e0b' : '#94a3b8'}>
              {contractedPct}%
            </BudgetSummaryValue>
            <BudgetSummaryPct $color="#94a3b8">
              {statistics.inProgressCount} εκτελούμενα · {statistics.completedCount} ολοκληρωμένα
            </BudgetSummaryPct>
          </BudgetSummaryItem>
        </BudgetSummaryRow>
      )}

      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Είδη Υποέργων</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.projectTypes).length > 0 ? (
              <Doughnut data={projectTypesData} options={doughnutOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Χρηματοδότηση ανά Πηγή</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.fundingSources).length > 0 ? (
              <Bar data={fundingSourcesData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Κατάσταση Υποέργων</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.projectStatuses).length > 0 ? (
              <Doughnut data={projectStatusesData} options={doughnutOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </>
  );

  const renderFundingTab = () => (
    <>
      <MiniStatsRow>
        <MiniStatCard>
          <MiniStatValue>{formatCurrency(statistics.totalFunding)}</MiniStatValue>
          <MiniStatLabel>Συνολική εγκεκριμένη χρηματοδότηση</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{Object.keys(statistics.fundingSources).length}</MiniStatValue>
          <MiniStatLabel>Πηγές χρηματοδότησης</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{Object.keys(statistics.fundingDetails).length}</MiniStatValue>
          <MiniStatLabel>Εξειδικεύσεις πηγής</MiniStatLabel>
        </MiniStatCard>
      </MiniStatsRow>
      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Ποσά ανά Πηγή Χρηματοδότησης</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.fundingSources).length > 0 ? (
              <Bar data={fundingSourcesData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
        <ChartContainer style={{ gridColumn: 'span 2' }}>
          <ChartTitle>Κορυφαίες Εξειδικεύσεις Πηγής (Top 10)</ChartTitle>
          <ChartWrapper>
            {topFundingDetails.length > 0 ? (
              <Bar data={fundingDetailsData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα εξειδίκευσης</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </>
  );

  const renderAssignmentTab = () => (
    <>
      <MiniStatsRow>
        <MiniStatCard>
          <MiniStatValue>{statistics.assignmentWithProcedure}</MiniStatValue>
          <MiniStatLabel>Με καταχωρισμένη διαδικασία</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{statistics.assignmentWithoutProcedure}</MiniStatValue>
          <MiniStatLabel>Χωρίς καταχώριση</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{assignmentEntries.length}</MiniStatValue>
          <MiniStatLabel>Διαφορετικές διαδικασίες</MiniStatLabel>
        </MiniStatCard>
      </MiniStatsRow>
      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Υποέργα ανά Διαδικασία Ανάθεσης</ChartTitle>
          <ChartWrapper>
            {assignmentEntries.length > 0 ? (
              <Bar data={assignmentCountData} options={countBarChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν υποέργα σε στάδιο σύμβασης/εκτέλεσης</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
        <ChartContainer style={{ gridColumn: 'span 2' }}>
          <ChartTitle>Ποσά Συμβάσεων ανά Διαδικασία</ChartTitle>
          <ChartWrapper>
            {assignmentEntries.length > 0 ? (
              <Bar data={assignmentAmountData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα ποσών</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </>
  );

  const countBarChartOptions = {
    ...barChartOptions,
    scales: {
      ...barChartOptions.scales,
      y: {
        ...barChartOptions.scales.y,
        ticks: {
          ...barChartOptions.scales.y.ticks,
          stepSize: 1,
          precision: 0,
          callback(value) {
            if (Number.isInteger(value)) return value;
            return '';
          }
        }
      }
    },
    plugins: {
      ...barChartOptions.plugins,
      tooltip: {
        ...barChartOptions.plugins.tooltip,
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${context.raw}`;
          }
        }
      }
    }
  };

  const renderProcurementTab = () => (
    <>
      <MiniStatsRow>
        <MiniStatCard>
          <MiniStatValue>{procurementStats.activeCount}</MiniStatValue>
          <MiniStatLabel>Ενεργές δημοσίευσεις</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{formatCurrency(procurementStats.totalEstimatedValue)}</MiniStatValue>
          <MiniStatLabel>Συνολική εκτιμ. αξία (ενεργοί)</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{procurementStats.withNoticeCount}</MiniStatValue>
          <MiniStatLabel>Υποέργα με δημοσίευση (ΚΗΜΔΗΣ)</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>{procurementStats.cancelledCount}</MiniStatValue>
          <MiniStatLabel>Ματαιωμένες δημοσίευσεις</MiniStatLabel>
        </MiniStatCard>
        <MiniStatCard>
          <MiniStatValue>
            {procurementStats.avgDaysSignedToDeadline != null
              ? procurementStats.avgDaysSignedToDeadline
              : '—'}
          </MiniStatValue>
          <MiniStatLabel>Μέσες ημέρες έκδοσης → καταληκτική</MiniStatLabel>
        </MiniStatCard>
      </MiniStatsRow>

      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Υποέργα ανά Διαδικασία (δημοσίευση)</ChartTitle>
          <ChartWrapper>
            {procurementProcedureEntries.length > 0 ? (
              <Bar data={procurementProcedureCountData} options={countBarChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα δημοσίευσης</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
        <ChartContainer>
          <ChartTitle>Κατανομή Τύπου Δημοσίευσης</ChartTitle>
          <ChartWrapper>
            {procurementNoticeTypeEntries.length > 0 ? (
              <Bar data={procurementNoticeTypeData} options={countBarChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
        <ChartContainer style={{ gridColumn: 'span 2' }}>
          <ChartTitle>Εκτιμ. Αξία Ενεργών Δημοσιεύσεων ανά Διαδικασία</ChartTitle>
          <ChartWrapper>
            {procurementActiveAmountEntries.length > 0 ? (
              <Bar data={procurementActiveAmountData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν ενεργές δημοσίευσεις με εκτιμ. αξία</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </>
  );

  const renderContractorsTab = () => (
    <>
      {directAssignmentViolations.length > 0 ? (
        <CompliancePanel>
          <CompliancePanelTitle>
            ⚠️ {directAssignmentViolations.length} πιθανή/ές παράβαση/εις κανόνα {DIRECT_ASSIGNMENT_COOLING_MONTHS} μηνών
            {' '}(απευθείας ανάθεση έργου/μελέτης)
          </CompliancePanelTitle>
          {directAssignmentViolations.map((v, idx) => (
            <ComplianceItem key={idx}>{formatViolationSummary(v)}</ComplianceItem>
          ))}
        </CompliancePanel>
      ) : (
        <CompliancePanel style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
          <CompliancePanelTitle style={{ color: '#166534' }}>
            ✓ Δεν εντοπίστηκαν παραβάσεις κανόνα {DIRECT_ASSIGNMENT_COOLING_MONTHS}μήνου απευθείας ανάθεσης
          </CompliancePanelTitle>
          <ComplianceItem style={{ color: '#166534', border: 'none', padding: 0 }}>
            Έλεγχος για συμβάσεις έργου/μελέτης με διαδικασία «ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ» και ίδιο ανάδοχο (ΑΦΜ/ΚΗΜΔΗΣ).
          </ComplianceItem>
        </CompliancePanel>
      )}

      <ChronoSummaryRow>
        <ContractorGlowCard $border="rgba(99, 102, 241, 0.25)">
          <ContractorGlowValue $color="#4f46e5">{statistics.uniqueContractors}</ContractorGlowValue>
          <ContractorGlowLabel>Μοναδικοί ανάδοχοι</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(16, 185, 129, 0.25)">
          <ContractorGlowValue $color="#059669">{statistics.totalContractorContracts}</ContractorGlowValue>
          <ContractorGlowLabel>Συνολικές συμβάσεις</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(14, 165, 233, 0.25)">
          <ContractorGlowValue $color="#0284c7">{formatCurrency(statistics.totalContractorAmount)}</ContractorGlowValue>
          <ContractorGlowLabel>Συνολικό ποσό συμβάσεων</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(139, 92, 246, 0.25)">
          <ContractorGlowValue $color="#7c3aed">
            {statistics.totalContractorContracts > 0
              ? formatCurrency(statistics.totalContractorAmount / statistics.totalContractorContracts)
              : '—'}
          </ContractorGlowValue>
          <ContractorGlowLabel>Μέσο ποσό ανά σύμβαση</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(245, 158, 11, 0.25)">
          <ContractorGlowValue $color="#d97706">
            {statistics.totalProjects > 0
              ? `${Math.round((statistics.projectsWithKhmdhs / statistics.totalProjects) * 100)}%`
              : '0%'}
          </ContractorGlowValue>
          <ContractorGlowLabel>Κάλυψη δεδομένων ΚΗΜΔΗΣ</ContractorGlowLabel>
        </ContractorGlowCard>
      </ChronoSummaryRow>

      {statistics.contractors.length > 0 ? (
        <>
          <ChronoFilterBar>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', flexShrink: 0 }}>
              🔍 Αναζήτηση ανάδοχου
            </span>
            <ContractorSearchInput
              type="search"
              value={contractorSearchQuery}
              onChange={(e) => setContractorSearchQuery(e.target.value)}
              placeholder="Επωνυμία ή ΑΦΜ…"
              aria-label="Αναζήτηση ανάδοχου"
            />
            <ContractorSelect
              value={selectedContractorKey}
              onChange={(e) => {
                setSelectedContractorKey(e.target.value);
                setContractorSearchQuery('');
              }}
              aria-label="Επιλογή ανάδοχου από λίστα"
            >
              {statistics.contractors.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}{c.vat ? ` (ΑΦΜ ${c.vat})` : ''}
                </option>
              ))}
            </ContractorSelect>
            {contractorSearchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setContractorSearchQuery('')}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  background: 'white',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                Καθαρισμός
              </button>
            ) : null}
          </ChronoFilterBar>

          <ContractorTwoCol>
          <LeaderboardPanel>
            <LeaderboardTitle>
              🏆 Κατάταξη ανάδόχων (κατά ποσό)
              {' · '}
              <span style={{ color: '#6366f1' }}>
                {filteredContractorsForList.length}
                {contractorSearchQuery.trim()
                  ? ` / ${contractorAnalytics.enriched.length}`
                  : ` σύνολο`}
              </span>
            </LeaderboardTitle>
            <LeaderboardList>
              {filteredContractorsForList.length > 0 ? (
                filteredContractorsForList.map((c, listIdx) => {
                  const globalIdx = contractorRankByKey[c.key] ?? listIdx;
                  const rankStyle = RANK_STYLES[globalIdx];
                  const rankLabel = globalIdx === 0 ? '🥇' : globalIdx === 1 ? '🥈' : globalIdx === 2 ? '🥉' : `${globalIdx + 1}`;
                  const barColor = contractorAnalytics.colorMap[c.key];
                  return (
                    <LeaderboardItem
                      key={c.key}
                      type="button"
                      $active={selectedContractorKey === c.key}
                      $delay={Math.min(listIdx, 12) * 45}
                      onClick={() => setSelectedContractorKey(c.key)}
                    >
                      <RankBadge
                        $medal={!!rankStyle}
                        $bg={rankStyle?.bg}
                        $color={rankStyle?.color}
                      >
                        {rankLabel}
                      </RankBadge>
                      <LeaderboardBody>
                        <LeaderboardName title={c.name}>{c.name}</LeaderboardName>
                        <LeaderboardMeta>
                          {c.vat ? `ΑΦΜ ${c.vat} · ` : ''}
                          {c.count} σύμβ. · {formatCurrency(c.amount)} · {c.sharePercent.toFixed(1)}% μερίδιο
                        </LeaderboardMeta>
                        <ShareBarTrack>
                          <ShareBarFill $pct={c.sharePercent} $color={barColor} />
                        </ShareBarTrack>
                      </LeaderboardBody>
                    </LeaderboardItem>
                  );
                })
              ) : (
                <LeaderboardEmptySearch>
                  Δεν βρέθηκε ανάδοχος για «{contractorSearchQuery.trim()}».
                  <br />
                  Δοκιμάστε επωνυμία ή ΑΦΜ.
                </LeaderboardEmptySearch>
              )}
            </LeaderboardList>
          </LeaderboardPanel>

          <div>
            {selectedContractorEnriched ? (
              <>
                <ContractorHero>
                  <ContractorHeroName>{selectedContractorEnriched.name}</ContractorHeroName>
                  <ContractorHeroSub>
                    {selectedContractorEnriched.vat ? `ΑΦΜ ${selectedContractorEnriched.vat} · ` : ''}
                    {selectedContractorEnriched.firstContractDate
                      ? `Δραστηριότητα ${formatDateElGR(selectedContractorEnriched.firstContractDate)} – ${formatDateElGR(selectedContractorEnriched.lastContractDate)}`
                      : 'Χωρίς ημερομηνίες σύμβασης'}
                  </ContractorHeroSub>
                  <StatPillsRow>
                    <StatPill>{selectedContractorEnriched.count} συμβάσεις</StatPill>
                    <StatPill>{formatCurrency(selectedContractorEnriched.amount)} σύνολο</StatPill>
                    <StatPill>Μ.Ο. {formatCurrency(selectedContractorEnriched.avgAmount)}</StatPill>
                    <StatPill>{selectedContractorEnriched.sharePercent.toFixed(1)}% αγοράς</StatPill>
                    <StatPill>{selectedContractorEnriched.activeYears} έτη δραστηριότητας</StatPill>
                    <StatPill>Κυρίαρχη: {truncateLabel(selectedContractorEnriched.topProcedure, 22)}</StatPill>
                  </StatPillsRow>
                </ContractorHero>

                <DetailPanel style={{ marginTop: '0.85rem' }}>
                  <DetailPanelTitle style={{ fontSize: '0.82rem' }}>Ιστορικό αναθέσεων</DetailPanelTitle>
                  {Object.entries(selectedContractorEnriched.procedureCounts || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([proc, cnt]) => {
                      const pct = selectedContractorEnriched.count > 0
                        ? (cnt / selectedContractorEnriched.count) * 100
                        : 0;
                      return (
                        <ProcedureBarRow key={proc}>
                          <ProcedureBarLabel>
                            <span>{truncateLabel(proc, 28)}</span>
                            <span>{cnt} ({pct.toFixed(0)}%)</span>
                          </ProcedureBarLabel>
                          <ShareBarTrack>
                            <ShareBarFill
                              $pct={pct}
                              $color={contractorAnalytics.colorMap[selectedContractorEnriched.key]}
                            />
                          </ShareBarTrack>
                        </ProcedureBarRow>
                      );
                    })}
                  <HistoryTableWrap style={{ marginTop: '0.85rem' }}>
                    <HistoryTable>
                      <thead>
                        <tr>
                          <th>Υποέργο</th>
                          <th>Διαδικασία</th>
                          <th>Ημ. Σύμβασης</th>
                          <th>Ποσό</th>
                          <th>Κατάσταση</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContractorEnriched.assignments.map((a, idx) => (
                          <tr key={`${a.subprojectId}-${a.contractIndex || 0}-${idx}`}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.subprojectTitle || '—'}</div>
                              <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{a.projectTitle}</div>
                            </td>
                            <td>{a.assignmentProcedure}</td>
                            <td>{formatDateElGR(a.contractDate)}</td>
                            <td>{a.amount > 0 ? formatCurrency(a.amount) : '—'}</td>
                            <td>{a.projectStatus || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </HistoryTable>
                  </HistoryTableWrap>
                </DetailPanel>
              </>
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα αναδόχων</NoDataMessage>
            )}
          </div>
        </ContractorTwoCol>
        </>
      ) : (
        <NoDataMessage>Δεν υπάρχουν ανάδοχοι από ΚΗΜΔΗΣ</NoDataMessage>
      )}

      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Συμβάσεις ανά Έτος (αριθμός)</ChartTitle>
          <ChartWrapper>
            {timelineYears.length > 0 ? (
              <Bar data={contractsTimelineData} options={countBarChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν ημερομηνίες συμβάσεων</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Ποσά Συμβάσεων ανά Έτος</ChartTitle>
          <ChartWrapper>
            {timelineYears.length > 0 ? (
              <Bar data={contractsAmountTimelineData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν ποσά συμβάσεων</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>
            {selectedContractor ? `Διαδικασίες — ${truncateLabel(selectedContractor.name, 18)}` : 'Διαδικασίες Ανάδοχου'}
          </ChartTitle>
          <ChartWrapper>
            {selectedProcedureEntries.length > 0 ? (
              <Doughnut data={selectedProcedureData} options={doughnutOptions} />
            ) : (
              <NoDataMessage>Επιλέξτε ανάδοχο ή συμπληρώστε διαδικασία ανάθεσης</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Top 10 κατά Ποσό</ChartTitle>
          <ChartWrapper>
            {topContractors.length > 0 ? (
              <Bar data={contractorsAmountData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν ανάδοχοι από ΚΗΜΔΗΣ</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer style={{ gridColumn: 'span 2' }}>
          <ChartTitle>Μερίδιο Αγοράς — Top 5 Ανάδοχοι</ChartTitle>
          <ChartWrapper>
            {top5Contractors.length > 0 ? (
              <Doughnut data={marketShareData} options={doughnutOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα μεριδίου</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </>
  );

  const renderContractorChronologyTab = () => (
    <>
      <ChronoSummaryRow>
        <ContractorGlowCard>
          <ContractorGlowValue>{contractorAnalytics.chronology.length}</ContractorGlowValue>
          <ContractorGlowLabel>Συμβάσεις στο χρονολόγιο</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(16, 185, 129, 0.25)">
          <ContractorGlowValue $color="#059669">
            {formatCurrency(contractorAnalytics.totalChronoAmount)}
          </ContractorGlowValue>
          <ContractorGlowLabel>Συνολικό ποσό</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(139, 92, 246, 0.25)">
          <ContractorGlowValue $color="#7c3aed">{contractorAnalytics.yearSpan}</ContractorGlowValue>
          <ContractorGlowLabel>Χρονική κάλυψη</ContractorGlowLabel>
        </ContractorGlowCard>
        <ContractorGlowCard $border="rgba(14, 165, 233, 0.25)">
          <ContractorGlowValue $color="#0284c7">{statistics.uniqueContractors}</ContractorGlowValue>
          <ContractorGlowLabel>Ενεργοί ανάδοχοι</ContractorGlowLabel>
        </ContractorGlowCard>
      </ChronoSummaryRow>

      <ChronoFilterBar>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>🔍 Φίλτρο ανάδοχου:</span>
        <ContractorSelect
          value={chronoFilterKey}
          onChange={(e) => setChronoFilterKey(e.target.value)}
        >
          <option value="all">Όλοι οι ανάδοχοι</option>
          {statistics.contractors.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}{c.vat ? ` (ΑΦΜ ${c.vat})` : ''}
            </option>
          ))}
        </ContractorSelect>
        {chronoFilterKey !== 'all' && (
          <button
            type="button"
            onClick={() => setChronoFilterKey('all')}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.45)',
              background: 'white',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            Καθαρισμός
          </button>
        )}
      </ChronoFilterBar>

      {filteredChronologyByYear.length > 0 ? (
        <TimelineContainer>
          <TimelineRail />
          {filteredChronologyByYear.map((yearGroup, yIdx) => (
            <TimelineYearBlock key={yearGroup.year} $delay={yIdx * 80}>
              <TimelineYearHeader>
                <TimelineYearBadge>{yearGroup.year}</TimelineYearBadge>
                <TimelineYearStats>
                  <TimelineYearChip>{yearGroup.contractCount} συμβάσεις</TimelineYearChip>
                  <TimelineYearChip>{formatCurrency(yearGroup.totalAmount)}</TimelineYearChip>
                  <TimelineYearChip>{yearGroup.contractorCount} ανάδοχοι</TimelineYearChip>
                </TimelineYearStats>
              </TimelineYearHeader>

              {yearGroup.events.map((event, eIdx) => {
                const accent = contractorAnalytics.colorMap[event.contractorKey] || '#6366f1';
                const statusStyle = CONTRACTOR_STATUS_COLORS[event.projectStatus] || {
                  bg: 'rgba(148, 163, 184, 0.12)',
                  color: '#64748b'
                };
                return (
                  <TimelineEvent
                    key={`${event.subprojectId}-${event.contractIndex || 0}-${eIdx}`}
                    $accent={accent}
                    $delay={yIdx * 80 + eIdx * 35}
                  >
                    <TimelineDot $accent={accent} />
                    <TimelineEventHeader>
                      <TimelineEventDate>{formatDateElGR(event.contractDate)}</TimelineEventDate>
                      <TimelineEventAmount>
                        {event.amount > 0 ? formatCurrency(event.amount) : '—'}
                      </TimelineEventAmount>
                    </TimelineEventHeader>
                    <TimelineContractor>{event.contractorName}</TimelineContractor>
                    {event.contractorVat ? (
                      <TimelineProject>ΑΦΜ {event.contractorVat}</TimelineProject>
                    ) : null}
                    <TimelineSubproject>{event.subprojectTitle || '—'}</TimelineSubproject>
                    <TimelineProject>{event.projectTitle}</TimelineProject>
                    <TimelineBadges>
                      <TimelineBadge $bg="rgba(99, 102, 241, 0.1)" $color="#4f46e5">
                        {event.assignmentProcedure}
                      </TimelineBadge>
                      <TimelineBadge $bg={statusStyle.bg} $color={statusStyle.color}>
                        {event.projectStatus || '—'}
                      </TimelineBadge>
                      {event.projectType ? (
                        <TimelineBadge $bg="rgba(14, 165, 233, 0.1)" $color="#0284c7">
                          {event.projectType}
                        </TimelineBadge>
                      ) : null}
                      {event.fundingSource ? (
                        <TimelineBadge $bg="rgba(16, 185, 129, 0.1)" $color="#059669">
                          {truncateLabel(event.fundingSource, 24)}
                        </TimelineBadge>
                      ) : null}
                    </TimelineBadges>
                  </TimelineEvent>
                );
              })}
            </TimelineYearBlock>
          ))}
        </TimelineContainer>
      ) : (
        <NoDataMessage>
          {chronoFilterKey !== 'all'
            ? 'Ο επιλεγμένος ανάδοχος δεν έχει καταγεγραμμένες συμβάσεις με ημερομηνία'
            : 'Δεν υπάρχουν συμβάσεις με ημερομηνία για χρονολόγιο'}
        </NoDataMessage>
      )}
    </>
  );

  const activeTabMeta = STATS_TABS.find((t) => t.id === activeTab);
  const Shell = embedded ? EmbeddedStatsRoot : StatisticsContainer;

  if (variant === 'summary') {
    return (
      <StatisticsContainer>
        <StatsHeader>
          <StatisticsTitle>Σύνοψη Υποέργων</StatisticsTitle>
          {onOpenFullStatistics && (
            <OpenFullStatsBtn type="button" onClick={onOpenFullStatistics}>
              Άνοιγμα αναλυτικών →
            </OpenFullStatsBtn>
          )}
        </StatsHeader>
        <StatsDivider />
        {renderScopeNote()}
        {renderOverviewTab()}
      </StatisticsContainer>
    );
  }

  return (
    <Shell>
      <StatsHeader>
        <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
        <ExportReportBtn
          type="button"
          disabled={exportingReport || projects.length === 0}
          onClick={() => setExportModalOpen(true)}
        >
          Εξαγωγή αναφοράς
        </ExportReportBtn>
      </StatsHeader>
      <StatsDivider />

      {renderScopeNote()}

      {renderPortfolioHealthBar()}

      <StatsTabBar>
        {STATS_TABS.map((tab) => (
          <StatsTab
            key={tab.id}
            type="button"
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </StatsTab>
        ))}
      </StatsTabBar>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'funding' && renderFundingTab()}
      {activeTab === 'chain' && renderChainTab()}
      {activeTab === 'financial' && renderFinancialTab()}
      {activeTab === 'quality' && renderQualityTab()}
      {activeTab === 'assignment' && renderAssignmentTab()}
      {activeTab === 'procurement' && renderProcurementTab()}
      {activeTab === 'contractors' && renderContractorsTab()}
      {activeTab === 'contractor-chronology' && renderContractorChronologyTab()}

      <StatisticsExportModal
        isOpen={exportModalOpen}
        projectCount={projects.length}
        exporting={exportingReport}
        activeTabLabel={activeTabMeta?.label || 'Σύνοψη'}
        onClose={() => !exportingReport && setExportModalOpen(false)}
        onExportTab={() => handleStatisticsTabExport('current')}
        onExportAllTabs={() => handleStatisticsTabExport('all')}
        onExportKhmdhs={handleKhmdhsExportFromModal}
      />
      <ExportSuccessModal
        isOpen={!!exportSuccess}
        onClose={() => setExportSuccess(null)}
        filePath={exportSuccess?.filePath}
        actionCount={exportSuccess?.actionCount}
        sheetCount={exportSuccess?.sheetCount}
        exportedAt={exportSuccess?.exportedAt}
        title="Η αναφορά εξήχθη επιτυχώς"
      />
    </Shell>
  );
}

export default Statistics;
