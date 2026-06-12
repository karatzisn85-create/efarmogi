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

const StatsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
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

const StatsDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), transparent);
  margin-bottom: 1.25rem;
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
  { id: 'assignment', label: 'Διαδικασίες Ανάθεσης', icon: '📋' },
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

function formatDateElGR(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('el-GR');
  } catch {
    return '—';
  }
}

function Statistics({ projects, directAssignmentViolations: directAssignmentViolationsProp }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedContractorKey, setSelectedContractorKey] = useState('');
  const [chronoFilterKey, setChronoFilterKey] = useState('all');

  const directAssignmentViolations = useMemo(
    () => directAssignmentViolationsProp || findDirectAssignmentViolations(projects),
    [directAssignmentViolationsProp, projects]
  );

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
      let amt = safeParseAmt(p.contractAmount);
      if (p.contracts) p.contracts.forEach(c => { amt += safeParseAmt(c.amount); });
      if (p.supplementaryContracts) p.supplementaryContracts.forEach(c => { amt += safeParseAmt(c.amount); });
      return sum + amt;
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
      const proc = (p.assignmentProcedure && String(p.assignmentProcedure).trim()) || 'Χωρίς καταχώριση';
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

  if (projects.length === 0) {
    return (
      <StatisticsContainer>
        <StatsHeader>
          <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
        </StatsHeader>
        <NoDataMessage>Δεν υπάρχουν δεδομένα για την εμφάνιση στατιστικών</NoDataMessage>
      </StatisticsContainer>
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
              <Bar data={assignmentCountData} options={barChartOptions} />
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
    plugins: {
      ...barChartOptions.plugins,
      tooltip: {
        ...barChartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.raw}`;
          }
        }
      }
    }
  };

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
        <ContractorTwoCol>
          <LeaderboardPanel>
            <LeaderboardTitle>🏆 Κατάταξη ανάδόχων (κατά ποσό)</LeaderboardTitle>
            {contractorAnalytics.enriched.slice(0, 10).map((c, idx) => {
              const rankStyle = RANK_STYLES[idx];
              const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
              const barColor = contractorAnalytics.colorMap[c.key];
              return (
                <LeaderboardItem
                  key={c.key}
                  type="button"
                  $active={selectedContractorKey === c.key}
                  $delay={idx * 45}
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
                      {c.count} σύμβ. · {formatCurrency(c.amount)} · {c.sharePercent.toFixed(1)}% μερίδιο
                    </LeaderboardMeta>
                    <ShareBarTrack>
                      <ShareBarFill $pct={c.sharePercent} $color={barColor} />
                    </ShareBarTrack>
                  </LeaderboardBody>
                </LeaderboardItem>
              );
            })}
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

  return (
    <StatisticsContainer>
      <StatsHeader>
        <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
      </StatsHeader>
      <StatsDivider />

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
      {activeTab === 'assignment' && renderAssignmentTab()}
      {activeTab === 'contractors' && renderContractorsTab()}
      {activeTab === 'contractor-chronology' && renderContractorChronologyTab()}
    </StatisticsContainer>
  );
}

export default Statistics;
