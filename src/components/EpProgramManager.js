import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import ExportSuccessModal from './ExportSuccessModal';
import EpProgramStatsPanel from './EpProgramStatsPanel';
import { useToast } from './ToastProvider';

const ipcRenderer = window.electronAPI;

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeIn = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); }`;
const spin = keyframes`to { transform: rotate(360deg); }`;

// ─── Root Overlay ─────────────────────────────────────────────────────────────
const EpOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 40%, #f0f9ff 70%, #f8fafc 100%);
  z-index: 1200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// ─── Header ───────────────────────────────────────────────────────────────────
const EpHeader = styled.div`
  flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%);
  color: white;
  padding: 0 28px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
`;

const EpHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const EpHeaderIcon = styled.div`
  width: 42px;
  height: 42px;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
`;

const EpHeaderTitleMain = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.2px;
`;

const EpHeaderTitleSub = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  margin-top: 2px;
`;

const EpHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 16px;
  width: 36px;
  height: 36px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.28); border-color: rgba(255, 255, 255, 0.5); }
`;

// ─── Program Info Bar ─────────────────────────────────────────────────────────
const ProgramInfoBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px 20px;
  padding: 10px 28px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
`;

const ProgramInfoChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 20px;
  padding: 4px 13px;
  font-size: 12px;
  color: #4338ca;
  font-weight: 600;
`;

const ProgramInfoStat = styled.div`
  font-size: 12px;
  color: #64748b;
  span { color: #4338ca; font-weight: 700; }
`;

// ─── Filter Bar ───────────────────────────────────────────────────────────────
const FilterBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 28px;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  flex-wrap: wrap;
`;

const FilterInput = styled.input`
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #1e293b;
  font-size: 13px;
  padding: 7px 12px;
  outline: none;
  min-width: 220px;
  flex: 1;
  &::placeholder { color: #94a3b8; }
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
`;

const FilterSelect = styled.select`
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #374151;
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  cursor: pointer;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
`;

const FilterClearBtn = styled.button`
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { background: #fecaca; }
`;

const FilterResultCount = styled.div`
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  margin-left: auto;
  span { color: #4338ca; font-weight: 700; }
`;

// ─── Content Area ─────────────────────────────────────────────────────────────
const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px 36px;

  &::-webkit-scrollbar { width: 10px; }
  &::-webkit-scrollbar-track { background: rgba(241, 245, 249, 0.8); border-radius: 6px; }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%);
    border-radius: 10px;
    border: 2px solid rgba(241, 245, 249, 0.8);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #818cf8 0%, #4f46e5 100%);
  }
`;

// ─── Group divider ────────────────────────────────────────────────────────────
const GroupDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 12px;
  &:first-child { margin-top: 0; }
`;
const GroupLine = styled.div`flex: 1; height: 1px; background: linear-gradient(90deg, #c7d2fe, #e2e8f0);`;
const GroupLabel = styled.div`
  font-size: 11px;
  font-weight: 800;
  color: #4338ca;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  white-space: nowrap;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  border: 1.5px solid #c7d2fe;
  border-radius: 20px;
  padding: 4px 14px;
  box-shadow: 0 1px 3px rgba(99,102,241,0.1);
`;

// ─── Action Card ──────────────────────────────────────────────────────────────
const ActionCard = styled.div`
  background: #ffffff;
  border: 1px solid #e8ecf2;
  border-radius: 12px;
  margin-bottom: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s;
  animation: ${fadeIn} 0.2s ease;
  &:hover {
    box-shadow: 0 6px 24px rgba(99, 102, 241, 0.11), 0 1px 4px rgba(15, 23, 42, 0.06);
    border-color: #c7d2fe;
    transform: translateY(-1px);
  }
`;

const CardStripe = styled.div`
  height: 3px;
  background: ${({ $prio }) =>
    $prio === "Α'" ? 'linear-gradient(90deg,#ef4444,#f87171)' :
    $prio === "Β'" ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' :
    'linear-gradient(90deg,#6366f1,#818cf8)'};
`;

const LinkedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: linear-gradient(90deg, #ecfdf5, #d1fae5);
  border-bottom: 1px solid #6ee7b7;
  font-size: 11.5px;
  font-weight: 800;
  color: #065f46;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  &::before {
    content: '🔗';
    font-size: 13px;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 18px 12px;
`;

const CardAA = styled.div`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border: 1.5px solid #c7d2fe;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #4338ca;
  letter-spacing: -0.5px;
`;

const CardMain = styled.div`flex: 1; min-width: 0;`;

const CardHierarchy = styled.div`
  font-size: 11px;
  color: #6366f1;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CardHierarchySep = styled.span`color: #a5b4fc; font-weight: 400;`;

const CardTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.5;
  margin-bottom: 8px;
`;

const CardBadgesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
`;

const CardMetaItem = styled.span`
  font-size: 12px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
`;

// ─── Badges ───────────────────────────────────────────────────────────────────
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.15px;

  ${({ $v }) => $v === 'new' && css`
    background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;
  `}
  ${({ $v }) => $v === 'continuing' && css`
    background: #fffbeb; color: #b45309; border: 1px solid #fde68a;
  `}
  ${({ $v }) => $v === 'type' && css`
    background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe;
  `}
  ${({ $v }) => $v === 'prio-a' && css`
    background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
  `}
  ${({ $v }) => $v === 'prio-b' && css`
    background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
  `}
  ${({ $v }) => $v === 'prio-c' && css`
    background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;
  `}
  ${({ $v }) => $v === 'linked' && css`
    background: linear-gradient(135deg,#ecfdf5,#d1fae5);
    color: #065f46;
    border: 1.5px solid #6ee7b7;
    box-shadow: 0 0 0 2px rgba(110,231,183,0.25);
    font-weight: 800;
  `}
`;

// ─── Card Footer ─────────────────────────────────────────────────────────────
const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px 10px 72px;
  background: #f8fafc;
  border-top: 1px solid #f0f4f8;
  gap: 12px;
  flex-wrap: wrap;
`;

const BudgetSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const BudgetTotal = styled.div`
  font-size: 14px;
  font-weight: 800;
  color: #3730a3;
  letter-spacing: -0.3px;
`;

const BudgetExpandBtn = styled.button`
  background: #ffffff;
  border: 1px solid #dde3ee;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  transition: all 0.12s;
  &:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
`;

const BudgetYearsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px 10px 72px;
  background: #f8fafc;
  border-top: 1px solid #edf2f7;
  flex-wrap: wrap;
`;

const BudgetYearChip = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${({ $active }) => $active ? '#3730a3' : '#94a3b8'};
  background: ${({ $active }) => $active ? '#eef2ff' : '#f1f5f9'};
  border: 1px solid ${({ $active }) => $active ? '#c7d2fe' : '#e2e8f0'};
  border-radius: 6px;
  padding: 3px 10px;
  display: flex; align-items: center; gap: 5px;
  span { font-weight: 700; }
`;

const FundingTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 9px;
`;

const CardActions = styled.div`
  display: flex;
  gap: 5px;
`;

const CardActionBtn = styled.button`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 13px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.13s;
  &:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #6366f1;
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

// ─── Buttons ──────────────────────────────────────────────────────────────────
const PrimaryBtn = styled.button`
  display: flex; align-items: center; gap: 7px;
  background: white;
  border: 2px solid rgba(255,255,255,0.5);
  border-radius: 8px;
  color: #4338ca;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 16px;
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { background: rgba(255,255,255,0.9); border-color: white; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  display: flex; align-items: center; gap: 7px;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { background: rgba(255,255,255,0.22); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ModalPrimaryBtn = styled.button`
  display: flex; align-items: center; gap: 7px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 9px 18px;
  transition: all 0.15s;
  &:hover { opacity: 0.88; transform: translateY(-1px); }
  &:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
`;

const ModalSecondaryBtn = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #475569;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 18px;
  transition: all 0.15s;
  &:hover { background: #e2e8f0; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  animation: ${fadeIn} 0.3s ease;
`;

const EmptyIcon = styled.div`font-size: 72px; margin-bottom: 18px; opacity: 0.5;`;

const EmptyTitle = styled.h2`
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
`;

const EmptyDesc = styled.p`
  margin: 0 0 28px;
  font-size: 14px;
  color: #64748b;
  max-width: 420px;
  line-height: 1.7;
`;

const EmptyPrimaryBtn = styled.button`
  display: flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  padding: 11px 24px;
  transition: all 0.15s;
  box-shadow: 0 4px 14px rgba(99,102,241,0.35);
  &:hover { opacity: 0.88; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
`;

// ─── Spinner ──────────────────────────────────────────────────────────────────
const SpinnerWrap = styled.div`display: flex; justify-content: center; padding: 80px;`;
const Spinner = styled.div`
  width: 36px; height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

// ─── Import Modal ─────────────────────────────────────────────────────────────
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 14px;
  width: min(520px, 95vw);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3);
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  padding: 18px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: white;
`;

const ModalCloseBtn = styled.button`
  background: rgba(255,255,255,0.15);
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: rgba(255,255,255,0.28); }
`;

const ModalBody = styled.div`
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`display: flex; flex-direction: column; gap: 6px;`;

const FormLabel = styled.label`
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FormInput = styled.input`
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #1e293b;
  font-size: 14px;
  padding: 10px 12px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  &::placeholder { color: #cbd5e1; }
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: white; }
`;

const YearRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const TitlePreview = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #4338ca;
`;

const FilePickArea = styled.div`
  border: 2px dashed #c7d2fe;
  border-radius: 10px;
  padding: 22px;
  text-align: center;
  cursor: pointer;
  background: #f8fafc;
  transition: all 0.15s;
  &:hover { border-color: #6366f1; background: #eef2ff; }
`;

const FilePickIcon = styled.div`font-size: 30px; margin-bottom: 8px;`;
const FilePickText = styled.div`
  font-size: 13px;
  color: #94a3b8;
  span { color: #6366f1; font-weight: 600; }
`;
const FilePickSelected = styled.div`
  font-size: 13px;
  color: #16a34a;
  font-weight: 600;
  margin-top: 6px;
  word-break: break-all;
`;

const PreviewBox = styled.div`
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 14px 16px;
`;
const PreviewTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #16a34a;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
`;
const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;
const PreviewItem = styled.div`
  font-size: 13px;
  color: #475569;
  span { color: #16a34a; font-weight: 700; font-size: 17px; }
`;

const WarningBox = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #92400e;
  line-height: 1.6;
`;

const ErrorMsg = styled.div`
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #dc2626;
`;

const ModalFooter = styled.div`
  padding: 14px 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #f1f5f9;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatEuro(n) {
  if (!n || n === 0) return '—';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(n);
}

function getPrioVariant(priority) {
  if (!priority) return 'prio-c';
  const p = priority.replace(/['\s]/g, '').toUpperCase();
  if (p.startsWith('Α') || p.startsWith('A') || p === '1') return 'prio-a';
  if (p.startsWith('Β') || p.startsWith('B') || p === '2') return 'prio-b';
  return 'prio-c';
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ViewTabBar = styled.div`
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  padding: 0 28px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const ViewTab = styled.button`
  padding: 0.5rem 1.1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$active ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#ffffff'};
  color: ${p => p.$active ? '#ffffff' : '#475569'};
  border: 1.5px solid ${p => p.$active ? 'transparent' : '#e2e8f0'};
  box-shadow: ${p => p.$active ? '0 3px 10px rgba(99,102,241,0.28)' : 'none'};
`;

export default function EpProgramManager({ isOpen, onClose, currentUser, canManageAll, appConfig = {} }) {
  const { showToast } = useToast();
  const [pageView, setPageView] = useState('actions'); // 'actions' | 'stats'
  const [programs, setPrograms] = useState([]);
  const [activeProgram, setActiveProgram] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [filterAxis, setFilterAxis] = useState('');
  const [filterMeasure, setFilterMeasure] = useState('');
  const [filterObjective, setFilterObjective] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterNew, setFilterNew] = useState('');
  const [expandedBudget, setExpandedBudget] = useState(new Set());

  // Action form
  const [showActionForm, setShowActionForm] = useState(false);
  const [editingAction, setEditingAction] = useState(null);

  // Delete confirm
  const [deletingActionId, setDeletingActionId] = useState(null);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importStartYear, setImportStartYear] = useState('');
  const [importEndYear, setImportEndYear] = useState('');
  const [importFilePath, setImportFilePath] = useState('');
  const [importFileLabel, setImportFileLabel] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  const username = currentUser?.username || '';

  // ─── Load ───────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!isOpen || !username) return;
    setLoading(true);
    setError(null);
    try {
      const [listRes, programRes] = await Promise.all([
        ipcRenderer.invoke('load-ep-programs', { requestingUsername: username }),
        ipcRenderer.invoke('get-ep-program', { requestingUsername: username })
      ]);
      if (listRes.success) setPrograms(listRes.programs || []);
      if (programRes.success) setActiveProgram(programRes.program || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isOpen, username]);

  useEffect(() => { if (isOpen) loadAll(); }, [isOpen, loadAll]);

  // ─── Cascading filter options ────────────────────────────────────────────────
  const availableMeasures = useMemo(() => {
    if (!activeProgram) return [];
    return (activeProgram.measures || []).filter(m => !filterAxis || m.axisCode === filterAxis);
  }, [activeProgram, filterAxis]);

  const availableObjectives = useMemo(() => {
    if (!activeProgram) return [];
    return (activeProgram.objectives || []).filter(o => {
      if (filterMeasure) return o.measureCode === filterMeasure;
      if (filterAxis) return o.axisCode === filterAxis;
      return true;
    });
  }, [activeProgram, filterAxis, filterMeasure]);

  const filteredActions = useMemo(() => {
    if (!activeProgram) return [];
    let list = activeProgram.actions || [];
    if (filterAxis) list = list.filter(a => a.axisCode === filterAxis);
    if (filterMeasure) list = list.filter(a => a.measureCode === filterMeasure);
    if (filterObjective) list = list.filter(a => a.objectiveCode === filterObjective);
    if (filterType) list = list.filter(a => a.actionType === filterType);
    if (filterNew === 'new') list = list.filter(a => a.isNew);
    if (filterNew === 'continuing') list = list.filter(a => !a.isNew);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q) ||
        a.responsibleService?.toLowerCase().includes(q) ||
        a.fundingSources?.some(f => f.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeProgram, filterAxis, filterMeasure, filterObjective, filterType, filterNew, search]);

  const hasFilters = filterAxis || filterMeasure || filterObjective || filterType || filterNew || search;

  const clearFilters = () => {
    setSearch(''); setFilterAxis(''); setFilterMeasure('');
    setFilterObjective(''); setFilterType(''); setFilterNew('');
  };

  // ─── Budget expand ──────────────────────────────────────────────────────────
  const toggleBudget = (id) => setExpandedBudget(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // ─── Grouped by axis ────────────────────────────────────────────────────────
  const groupedActions = useMemo(() => {
    const g = {};
    for (const a of filteredActions) {
      const k = a.axisCode || '__';
      if (!g[k]) g[k] = [];
      g[k].push(a);
    }
    return g;
  }, [filteredActions]);

  const axisKeys = useMemo(
    () => Object.keys(groupedActions).sort((a, b) => parseFloat(a) - parseFloat(b)),
    [groupedActions]
  );

  const axisTitle = useCallback((code) => {
    const ax = (activeProgram?.axes || []).find(a => a.code === code);
    return ax?.title || `Άξονας ${code}`;
  }, [activeProgram]);

  // ─── Import ─────────────────────────────────────────────────────────────────
  // ─── Action CRUD ─────────────────────────────────────────────────────────────
  const openNewAction = () => { setEditingAction(null); setShowActionForm(true); };
  const openEditAction = (action) => { setEditingAction(action); setShowActionForm(true); };

  const handleSaveAction = async (actionData) => {
    if (!activeProgram) return;
    try {
      const res = await ipcRenderer.invoke('save-ep-action', {
        programId: activeProgram.id,
        action: actionData,
        requestingUsername: username
      });
      if (res.success) {
        setShowActionForm(false);
        await loadAll();
      } else {
        showToast(res.error || 'Σφάλμα αποθήκευσης', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteAction = async (actionId) => {
    if (!activeProgram) return;
    try {
      const res = await ipcRenderer.invoke('delete-ep-action', {
        programId: activeProgram.id,
        actionId,
        requestingUsername: username
      });
      if (res.success) {
        setDeletingActionId(null);
        await loadAll();
      } else {
        showToast(res.error || 'Σφάλμα διαγραφής', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleExportExcel = async () => {
    if (!activeProgram) return;
    setExporting(true);
    try {
      const res = await ipcRenderer.invoke('export-ep-program', {
        programId: activeProgram.id,
        requestingUsername: username
      });
      if (res.canceled) return;
      if (!res.success) {
        showToast(res.error || 'Σφάλμα κατά την εξαγωγή Excel', 'error');
        return;
      }
      if (res.downloadPath) {
        setExportSuccess({
          filePath: res.downloadPath,
          actionCount: res.actionCount,
          sheetCount: res.sheetCount,
          exportedAt: res.exportedAt
        });
      }
    } catch (e) {
      showToast(e.message || 'Σφάλμα εξαγωγής', 'error');
    } finally {
      setExporting(false);
    }
  };

  const openImport = () => {
    setImportStartYear(''); setImportEndYear('');
    setImportFilePath(''); setImportFileLabel('');
    setImportPreview(null); setImportError('');
    setShowImport(true);
  };

  const handleStartYear = (val) => {
    const y = val.replace(/\D/g, '').slice(0, 4);
    setImportStartYear(y);
    if (y.length === 4) setImportEndYear(String(parseInt(y, 10) + 4));
  };

  const handleSelectFile = async () => {
    try {
      const result = await ipcRenderer.invoke('select-excel-file');
      if (result?.success && result.filePath) {
        setImportFilePath(result.filePath);
        setImportFileLabel(result.filePath.split(/[\\/]/).pop());
        setImportPreview(null);
        setImportError('');
      }
    } catch (e) {
      setImportError('Σφάλμα επιλογής αρχείου: ' + e.message);
    }
  };

  const handleImport = async () => {
    if (!importStartYear || !importEndYear || !importFilePath) {
      setImportError('Συμπληρώστε όλα τα πεδία');
      return;
    }
    setImportError('');
    setImporting(true);
    try {
      const res = await ipcRenderer.invoke('import-ep-program', {
        filePath: importFilePath,
        startYear: parseInt(importStartYear, 10),
        endYear: parseInt(importEndYear, 10),
        requestingUsername: username
      });
      if (res.success) {
        setImportPreview({
          title: res.title,
          actionCount: res.actionCount,
          axesCount: res.axesCount,
          measuresCount: res.measuresCount,
          objectivesCount: res.objectivesCount
        });
        await loadAll();
        setShowImport(false);
      } else {
        setImportError(res.error || 'Σφάλμα κατά την εισαγωγή');
      }
    } catch (e) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <EpOverlay>
      {/* ── Header ── */}
      <EpHeader>
        <EpHeaderLeft>
          <EpHeaderIcon>🗺️</EpHeaderIcon>
          <div>
            <EpHeaderTitleMain>
              {activeProgram ? activeProgram.title : 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ'}
            </EpHeaderTitleMain>
            {activeProgram && (
              <EpHeaderTitleSub>
                Πενταετές Επιχειρησιακό Πρόγραμμα {activeProgram.startYear}–{activeProgram.endYear}
              </EpHeaderTitleSub>
            )}
          </div>
        </EpHeaderLeft>
        <EpHeaderActions>
          {activeProgram && (
            <SecondaryBtn onClick={handleExportExcel} disabled={exporting || loading}>
              {exporting ? '⏳ Εξαγωγή...' : '📤 Εξαγωγή Excel'}
            </SecondaryBtn>
          )}
          {canManageAll && activeProgram && (
            <SecondaryBtn onClick={openImport}>
              📥 Νέα Εισαγωγή Excel
            </SecondaryBtn>
          )}
          {canManageAll && activeProgram && (
            <PrimaryBtn onClick={openNewAction}>
              ➕ Νέα Δράση
            </PrimaryBtn>
          )}
          <CloseBtn onClick={onClose} title="Κλείσιμο">✕</CloseBtn>
        </EpHeaderActions>
      </EpHeader>

      {activeProgram && (
        <ViewTabBar>
          <ViewTab $active={pageView === 'actions'} onClick={() => setPageView('actions')}>
            📋 Δράσεις ΕΠ
          </ViewTab>
          <ViewTab $active={pageView === 'stats'} onClick={() => setPageView('stats')}>
            📊 Στατιστικά &amp; Εξαγωγές
          </ViewTab>
        </ViewTabBar>
      )}

      {pageView === 'stats' && activeProgram ? (
        <ContentArea style={{ padding: '20px 28px' }}>
          <EpProgramStatsPanel currentUser={currentUser} appConfig={appConfig} />
        </ContentArea>
      ) : (
      <>
      {/* ── Info Bar ── */}
      {activeProgram && (
        <ProgramInfoBar>
          <ProgramInfoChip>
            📅 {activeProgram.startYear} – {activeProgram.endYear}
          </ProgramInfoChip>
          <ProgramInfoStat>Άξονες: <span>{(activeProgram.axes || []).length}</span></ProgramInfoStat>
          <ProgramInfoStat>Μέτρα: <span>{(activeProgram.measures || []).length}</span></ProgramInfoStat>
          <ProgramInfoStat>Ειδ. Στόχοι: <span>{(activeProgram.objectives || []).length}</span></ProgramInfoStat>
          <ProgramInfoStat>Δράσεις: <span>{(activeProgram.actions || []).length}</span></ProgramInfoStat>
          {programs.filter(p => !p.isActive).length > 0 && (
            <ProgramInfoStat>
              Αρχειοθετημένα: <span>{programs.filter(p => !p.isActive).length}</span>
            </ProgramInfoStat>
          )}
        </ProgramInfoBar>
      )}

      {/* ── Filter Bar ── */}
      {activeProgram && (
        <FilterBar>
          <FilterInput
            placeholder="🔍  Αναζήτηση σε τίτλο, χωροθέτηση, υπηρεσία, πηγή..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <FilterSelect
            value={filterAxis}
            onChange={e => { setFilterAxis(e.target.value); setFilterMeasure(''); setFilterObjective(''); }}
          >
            <option value="">Όλοι οι Άξονες</option>
            {(activeProgram.axes || []).map(ax => (
              <option key={ax.code} value={ax.code}>{ax.title}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={filterMeasure}
            onChange={e => { setFilterMeasure(e.target.value); setFilterObjective(''); }}
          >
            <option value="">Όλα τα Μέτρα</option>
            {availableMeasures.map(m => <option key={m.code} value={m.code}>{m.title}</option>)}
          </FilterSelect>
          <FilterSelect
            value={filterObjective}
            onChange={e => setFilterObjective(e.target.value)}
          >
            <option value="">Όλοι οι Ειδ. Στόχοι</option>
            {availableObjectives.map(o => <option key={o.code} value={o.code}>{o.title}</option>)}
          </FilterSelect>
          <FilterSelect value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Όλα τα Είδη</option>
            {['Έργο', 'Μελέτη', 'Υπηρεσία', 'Προμήθεια', 'Αγορά γης'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={filterNew} onChange={e => setFilterNew(e.target.value)}>
            <option value="">Νέα &amp; Συνεχιζόμενα</option>
            <option value="new">Μόνο Νέα</option>
            <option value="continuing">Μόνο Συνεχιζόμενα</option>
          </FilterSelect>
          {hasFilters && <FilterClearBtn onClick={clearFilters}>✕ Εκκαθάριση</FilterClearBtn>}
          <FilterResultCount>
            <span>{filteredActions.length}</span> / {(activeProgram.actions || []).length} δράσεις
          </FilterResultCount>
        </FilterBar>
      )}

      {/* ── Content ── */}
      <ContentArea>
        {loading && <SpinnerWrap><Spinner /></SpinnerWrap>}

        {!loading && error && <ErrorMsg>⚠️ Σφάλμα: {error}</ErrorMsg>}

        {!loading && !error && !activeProgram && (
          <EmptyState>
            <EmptyIcon>🗺️</EmptyIcon>
            <EmptyTitle>Δεν υπάρχει Επιχειρησιακό Πρόγραμμα</EmptyTitle>
            <EmptyDesc>
              Εισάγετε το Excel του πενταετούς Επιχειρησιακού Προγράμματος
              για να ξεκινήσετε. Χρησιμοποιήστε αρχείο με φύλλο ΕΠ_ΔΡΑΣΕΙΣ.
            </EmptyDesc>
            {canManageAll && (
              <EmptyPrimaryBtn onClick={openImport}>
                📥 Εισαγωγή από Excel
              </EmptyPrimaryBtn>
            )}
          </EmptyState>
        )}

        {!loading && !error && activeProgram && filteredActions.length === 0 && hasFilters && (
          <EmptyState>
            <EmptyIcon>🔍</EmptyIcon>
            <EmptyTitle>Δεν βρέθηκαν αποτελέσματα</EmptyTitle>
            <EmptyDesc>Δοκιμάστε να αλλάξετε τα κριτήρια αναζήτησης.</EmptyDesc>
            <EmptyPrimaryBtn onClick={clearFilters} style={{ background: 'linear-gradient(135deg,#64748b,#475569)', boxShadow: 'none' }}>
              Εκκαθάριση Φίλτρων
            </EmptyPrimaryBtn>
          </EmptyState>
        )}

        {!loading && !error && activeProgram && filteredActions.length > 0 && axisKeys.map(axisCode => (
          <div key={axisCode}>
            <GroupDivider>
              <GroupLine />
              <GroupLabel>{axisTitle(axisCode)} ({groupedActions[axisCode].length})</GroupLabel>
              <GroupLine />
            </GroupDivider>
            {groupedActions[axisCode].map(action => (
              <ActionCardItem
                key={action.id}
                action={action}
                budgetYears={activeProgram.budgetYears || []}
                expanded={expandedBudget.has(action.id)}
                onToggleBudget={() => toggleBudget(action.id)}
                canManage={canManageAll}
                onEdit={() => openEditAction(action)}
                onDelete={() => setDeletingActionId(action.id)}
              />
            ))}
          </div>
        ))}
      </ContentArea>
      </>
      )}

      {/* ── Action Form ── */}
      {showActionForm && activeProgram && (
        <EpActionForm
          action={editingAction}
          program={activeProgram}
          onSave={handleSaveAction}
          onClose={() => setShowActionForm(false)}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deletingActionId && (
        <ModalOverlay onClick={() => setDeletingActionId(null)}>
          <ModalBox style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>🗑️ Διαγραφή Δράσης</ModalTitle>
              <ModalCloseBtn onClick={() => setDeletingActionId(null)}>✕</ModalCloseBtn>
            </ModalHeader>
            <ModalBody>
              <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη δράση; Η ενέργεια δεν αναιρείται.
              </p>
            </ModalBody>
            <ModalFooter>
              <ModalSecondaryBtn onClick={() => setDeletingActionId(null)}>Ακύρωση</ModalSecondaryBtn>
              <ModalPrimaryBtn
                style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}
                onClick={() => handleDeleteAction(deletingActionId)}
              >
                🗑️ Διαγραφή
              </ModalPrimaryBtn>
            </ModalFooter>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* ── Import Modal ── */}
      {showImport && (
        <ModalOverlay onClick={e => e.target === e.currentTarget && !importing && setShowImport(false)}>
          <ModalBox>
            <ModalHeader>
              <ModalTitle>📥 Εισαγωγή Επιχειρησιακού Προγράμματος από Excel</ModalTitle>
              <ModalCloseBtn onClick={() => !importing && setShowImport(false)}>✕</ModalCloseBtn>
            </ModalHeader>
            <ModalBody>
              {activeProgram && (
                <WarningBox>
                  ⚠️ Υπάρχει ήδη ενεργό πρόγραμμα <strong>({activeProgram.title})</strong>.
                  Η εισαγωγή νέου θα το αρχειοθετήσει αυτόματα.
                </WarningBox>
              )}

              <YearRow>
                <FormGroup>
                  <FormLabel>Έτος Έναρξης</FormLabel>
                  <FormInput
                    type="number" placeholder="π.χ. 2024"
                    value={importStartYear}
                    onChange={e => handleStartYear(e.target.value)}
                    min="2000" max="2100"
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>Έτος Λήξης</FormLabel>
                  <FormInput
                    type="number" placeholder="π.χ. 2028"
                    value={importEndYear}
                    onChange={e => setImportEndYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    min="2000" max="2100"
                  />
                </FormGroup>
              </YearRow>

              {importStartYear.length === 4 && importEndYear.length >= 4 && (
                <TitlePreview>
                  🗺️ ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ {importStartYear}–{importEndYear}
                </TitlePreview>
              )}

              <FormGroup>
                <FormLabel>Αρχείο Excel (φύλλο ΕΠ_ΔΡΑΣΕΙΣ)</FormLabel>
                <FilePickArea onClick={handleSelectFile}>
                  <FilePickIcon>📊</FilePickIcon>
                  {importFileLabel
                    ? <FilePickSelected>✅ {importFileLabel}</FilePickSelected>
                    : <FilePickText><span>Επιλέξτε αρχείο</span> .xlsx ή .xls</FilePickText>
                  }
                </FilePickArea>
              </FormGroup>

              {importPreview && (
                <PreviewBox>
                  <PreviewTitle>✅ Αποτελέσματα εισαγωγής</PreviewTitle>
                  <PreviewGrid>
                    <PreviewItem>Δράσεις: <span>{importPreview.actionCount}</span></PreviewItem>
                    <PreviewItem>Άξονες: <span>{importPreview.axesCount}</span></PreviewItem>
                    <PreviewItem>Μέτρα: <span>{importPreview.measuresCount}</span></PreviewItem>
                    <PreviewItem>Ειδ. Στόχοι: <span>{importPreview.objectivesCount}</span></PreviewItem>
                  </PreviewGrid>
                </PreviewBox>
              )}

              {importError && <ErrorMsg>⚠️ {importError}</ErrorMsg>}
            </ModalBody>
            <ModalFooter>
              <ModalSecondaryBtn onClick={() => setShowImport(false)} disabled={importing}>
                Ακύρωση
              </ModalSecondaryBtn>
              <ModalPrimaryBtn
                onClick={handleImport}
                disabled={importing || !importStartYear || !importEndYear || !importFilePath}
              >
                {importing ? '⏳ Εισαγωγή...' : '📥 Εισαγωγή'}
              </ModalPrimaryBtn>
            </ModalFooter>
          </ModalBox>
        </ModalOverlay>
      )}

      <ExportSuccessModal
        isOpen={!!exportSuccess}
        onClose={() => setExportSuccess(null)}
        filePath={exportSuccess?.filePath}
        actionCount={exportSuccess?.actionCount}
        sheetCount={exportSuccess?.sheetCount}
        exportedAt={exportSuccess?.exportedAt}
      />
    </EpOverlay>
  );
}

// ─── EpActionForm ─────────────────────────────────────────────────────────────
const ACTION_TYPES = ['Έργο', 'Μελέτη', 'Υπηρεσία', 'Προμήθεια', 'Αγορά γης'];
const PRIORITIES = ["Α'", "Β'", "Γ'"];

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;
const FormGridFull = styled.div`grid-column: 1 / -1;`;
const BudgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
`;
const BudgetYearLabel = styled.div`font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 3px;`;
const FundingRow = styled.div`display: flex; gap: 8px; align-items: center;`;
const RemoveBtn = styled.button`
  background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px; padding: 0 4px;
  &:hover { color: #b91c1c; }
`;
const AddBtn = styled.button`
  background: none; border: 1px dashed #c7d2fe; border-radius: 6px; color: #6366f1;
  cursor: pointer; font-size: 12px; font-weight: 600; padding: 6px 12px; transition: all 0.13s;
  &:hover { background: #eef2ff; }
`;
const FormSectionLabel = styled.div`
  font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase;
  letter-spacing: 0.6px; margin-top: 4px; margin-bottom: 2px;
  padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;
`;
const TotalDisplay = styled.div`
  background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px;
  padding: 10px 14px; font-size: 13px; font-weight: 700; color: #4338ca;
`;

function EpActionForm({ action, program, onSave, onClose }) {
  const isEdit = !!action;

  const [axisCode, setAxisCode] = useState(action?.axisCode || '');
  const [measureCode, setMeasureCode] = useState(action?.measureCode || '');
  const [objectiveCode, setObjectiveCode] = useState(action?.objectiveCode || '');
  const [title, setTitle] = useState(action?.title || '');
  const [actionType, setActionType] = useState(action?.actionType || '');
  const [isNew, setIsNew] = useState(action ? action.isNew : true);
  const [location, setLocation] = useState(action?.location || '');
  const [priority, setPriority] = useState(action?.priority || '');
  const [responsibleService, setResponsibleService] = useState(action?.responsibleService || '');
  const [budgetYearsData, setBudgetYearsData] = useState(() => {
    const obj = {};
    for (const y of (program.budgetYears || [])) {
      obj[y] = action?.budgetYears?.[y] ?? 0;
    }
    return obj;
  });
  const [fundingSources, setFundingSources] = useState(
    action?.fundingSources?.length ? [...action.fundingSources] : ['']
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availMeasures = useMemo(
    () => (program.measures || []).filter(m => !axisCode || m.axisCode === axisCode),
    [program, axisCode]
  );
  const availObjectives = useMemo(
    () => (program.objectives || []).filter(o => {
      if (measureCode) return o.measureCode === measureCode;
      if (axisCode) return o.axisCode === axisCode;
      return true;
    }),
    [program, axisCode, measureCode]
  );

  const total = Object.values(budgetYearsData).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const updateBudgetYear = (year, val) => {
    setBudgetYearsData(prev => ({ ...prev, [year]: val === '' ? 0 : parseFloat(val) || 0 }));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Ο τίτλος είναι υποχρεωτικός'); return; }
    setSaving(true);
    setError('');
    const payload = {
      id: action?.id,
      aa: action?.aa,
      axisCode, measureCode, objectiveCode,
      title: title.trim(),
      actionType, isNew,
      location: location.trim(),
      priority,
      responsibleService: responsibleService.trim(),
      budgetYears: budgetYearsData,
      total,
      fundingSources: fundingSources.filter(f => f.trim()),
      linkedSubprojectIds: action?.linkedSubprojectIds || []
    };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <ModalOverlay onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <ModalBox style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{isEdit ? '✏️ Επεξεργασία Δράσης' : '➕ Νέα Δράση ΕΠ'}</ModalTitle>
          <ModalCloseBtn onClick={() => !saving && onClose()}>✕</ModalCloseBtn>
        </ModalHeader>
        <ModalBody>
          <FormSectionLabel>Ιεραρχία ΕΠ</FormSectionLabel>
          <FormGrid>
            <FormGroup>
              <FormLabel>Άξονας</FormLabel>
              <FormInput as="select" value={axisCode} onChange={e => { setAxisCode(e.target.value); setMeasureCode(''); setObjectiveCode(''); }}>
                <option value="">— Επιλέξτε Άξονα —</option>
                {(program.axes || []).map(ax => <option key={ax.code} value={ax.code}>{ax.title}</option>)}
              </FormInput>
            </FormGroup>
            <FormGroup>
              <FormLabel>Μέτρο</FormLabel>
              <FormInput as="select" value={measureCode} onChange={e => { setMeasureCode(e.target.value); setObjectiveCode(''); }}>
                <option value="">— Επιλέξτε Μέτρο —</option>
                {availMeasures.map(m => <option key={m.code} value={m.code}>{m.title}</option>)}
              </FormInput>
            </FormGroup>
            <FormGridFull>
              <FormGroup>
                <FormLabel>Ειδικός Στόχος</FormLabel>
                <FormInput as="select" value={objectiveCode} onChange={e => setObjectiveCode(e.target.value)}>
                  <option value="">— Επιλέξτε Ειδικό Στόχο —</option>
                  {availObjectives.map(o => <option key={o.code} value={o.code}>{o.title}</option>)}
                </FormInput>
              </FormGroup>
            </FormGridFull>
          </FormGrid>

          <FormSectionLabel style={{ marginTop: 16 }}>Στοιχεία Δράσης</FormSectionLabel>
          <FormGrid>
            <FormGridFull>
              <FormGroup>
                <FormLabel>Τίτλος Δράσης *</FormLabel>
                <FormInput
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Εισάγετε τίτλο δράσης..."
                />
              </FormGroup>
            </FormGridFull>
            <FormGroup>
              <FormLabel>Είδος Δράσης</FormLabel>
              <FormInput as="select" value={actionType} onChange={e => setActionType(e.target.value)}>
                <option value="">— Επιλέξτε —</option>
                {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </FormInput>
            </FormGroup>
            <FormGroup>
              <FormLabel>Νέα / Συνεχιζόμενη</FormLabel>
              <FormInput as="select" value={isNew ? 'new' : 'continuing'} onChange={e => setIsNew(e.target.value === 'new')}>
                <option value="new">Νέα</option>
                <option value="continuing">Συνεχιζόμενη</option>
              </FormInput>
            </FormGroup>
            <FormGroup>
              <FormLabel>Χωροθέτηση</FormLabel>
              <FormInput value={location} onChange={e => setLocation(e.target.value)} placeholder="π.χ. Δ.Ε. Αρχανών" />
            </FormGroup>
            <FormGroup>
              <FormLabel>Προτεραιότητα</FormLabel>
              <FormInput as="select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="">— —</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </FormInput>
            </FormGroup>
            <FormGridFull>
              <FormGroup>
                <FormLabel>Αρμόδια Υπηρεσία</FormLabel>
                <FormInput value={responsibleService} onChange={e => setResponsibleService(e.target.value)} placeholder="π.χ. Διεύθυνση Τεχνικών Υπηρεσιών" />
              </FormGroup>
            </FormGridFull>
          </FormGrid>

          <FormSectionLabel style={{ marginTop: 16 }}>Προϋπολογισμός ανά έτος (€)</FormSectionLabel>
          <BudgetGrid>
            {(program.budgetYears || []).map(year => (
              <div key={year}>
                <BudgetYearLabel>{year}</BudgetYearLabel>
                <FormInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetYearsData[year] ?? 0}
                  onChange={e => updateBudgetYear(year, e.target.value)}
                  style={{ padding: '7px 8px', fontSize: 13 }}
                />
              </div>
            ))}
          </BudgetGrid>
          {total > 0 && (
            <TotalDisplay style={{ marginTop: 8 }}>
              Σύνολο: {new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total)}
            </TotalDisplay>
          )}

          <FormSectionLabel style={{ marginTop: 16 }}>Πηγές Χρηματοδότησης</FormSectionLabel>
          {fundingSources.map((src, i) => (
            <FundingRow key={i} style={{ marginBottom: 6 }}>
              <FormInput
                value={src}
                onChange={e => { const arr = [...fundingSources]; arr[i] = e.target.value; setFundingSources(arr); }}
                placeholder={`${i + 1}η Πηγή...`}
                style={{ flex: 1 }}
              />
              {fundingSources.length > 1 && (
                <RemoveBtn onClick={() => setFundingSources(fundingSources.filter((_, j) => j !== i))}>✕</RemoveBtn>
              )}
            </FundingRow>
          ))}
          {fundingSources.length < 3 && (
            <AddBtn onClick={() => setFundingSources([...fundingSources, ''])}>+ Προσθήκη πηγής</AddBtn>
          )}

          {error && <ErrorMsg style={{ marginTop: 8 }}>⚠️ {error}</ErrorMsg>}
        </ModalBody>
        <ModalFooter>
          <ModalSecondaryBtn onClick={onClose} disabled={saving}>Ακύρωση</ModalSecondaryBtn>
          <ModalPrimaryBtn onClick={handleSubmit} disabled={saving}>
            {saving ? '⏳ Αποθήκευση...' : (isEdit ? '💾 Αποθήκευση' : '➕ Δημιουργία')}
          </ModalPrimaryBtn>
        </ModalFooter>
      </ModalBox>
    </ModalOverlay>
  );
}

// ─── ActionCardItem ───────────────────────────────────────────────────────────
function ActionCardItem({ action, budgetYears, expanded, onToggleBudget, canManage, onEdit, onDelete }) {
  const hasLinked = (action.linkedSubprojectIds || []).length > 0;
  const yearValues = (budgetYears || []).map(y => ({ year: y, val: (action.budgetYears || {})[y] || 0 }));
  const hasYearData = yearValues.some(y => y.val > 0);

  const hierarchyParts = [action.axisCode, action.measureCode, action.objectiveCode].filter(Boolean);

  return (
    <ActionCard>
      <CardStripe $prio={action.priority} />
      {hasLinked && (
        <LinkedBanner>
          Συνδεδεμένη με {action.linkedSubprojectIds.length === 1 ? '1 υποέργο' : `${action.linkedSubprojectIds.length} υποέργα`}
        </LinkedBanner>
      )}
      <CardTop>
        <CardAA>{action.aa}</CardAA>
        <CardMain>
          {hierarchyParts.length > 0 && (
            <CardHierarchy>
              {hierarchyParts.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <CardHierarchySep>›</CardHierarchySep>}
                  {p}
                </React.Fragment>
              ))}
            </CardHierarchy>
          )}
          <CardTitle>{action.title}</CardTitle>
          <CardBadgesRow>
            <Badge $v={action.isNew ? 'new' : 'continuing'}>
              {action.isNew ? '● Νέα' : '◐ Συνεχιζόμενη'}
            </Badge>
            {action.actionType && <Badge $v="type">{action.actionType}</Badge>}
            {action.priority && <Badge $v={getPrioVariant(action.priority)}>Προτ. {action.priority}</Badge>}
            {hasLinked && (
              <Badge $v="linked">
                🔗 {action.linkedSubprojectIds.length === 1 ? '1 υποέργο' : `${action.linkedSubprojectIds.length} υποέργα`}
              </Badge>
            )}
          </CardBadgesRow>
          <CardMeta>
            {action.location && (
              <CardMetaItem>
                <span style={{ color: '#6366f1' }}>📍</span> {action.location}
              </CardMetaItem>
            )}
            {action.responsibleService && (
              <CardMetaItem>
                <span style={{ color: '#6366f1' }}>🏢</span> {action.responsibleService}
              </CardMetaItem>
            )}
            {action.fundingSources?.length > 0 && action.fundingSources.slice(0, 2).map((f, i) => (
              <FundingTag key={i}>📌 {f}</FundingTag>
            ))}
            {action.fundingSources?.length > 2 && (
              <FundingTag>+{action.fundingSources.length - 2} πηγές</FundingTag>
            )}
          </CardMeta>
        </CardMain>
      </CardTop>

      <CardFooter>
        <BudgetSection>
          <BudgetTotal>{formatEuro(action.total)}</BudgetTotal>
          {hasYearData && (
            <BudgetExpandBtn onClick={onToggleBudget}>
              {expanded ? '▲ ανά έτος' : '▾ ανά έτος'}
            </BudgetExpandBtn>
          )}
        </BudgetSection>

        <CardActions>
          {canManage && (
            <>
              <CardActionBtn title="Επεξεργασία" onClick={onEdit}>✏️</CardActionBtn>
              <CardActionBtn
                title="Διαγραφή"
                onClick={onDelete}
                style={{ color: '#dc2626' }}
                onMouseEnter={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.borderColor='#fecaca'; }}
                onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderColor=''; }}
              >
                🗑️
              </CardActionBtn>
            </>
          )}
        </CardActions>
      </CardFooter>

      {expanded && hasYearData && (
        <BudgetYearsRow>
          {yearValues.map(({ year, val }) => (
            <BudgetYearChip key={year} $active={val > 0}>
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>{year}</span>
              <span>{formatEuro(val)}</span>
            </BudgetYearChip>
          ))}
        </BudgetYearsRow>
      )}
    </ActionCard>
  );
}
