import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import styled, { keyframes } from 'styled-components';
import ProjectForm from './ProjectForm';

import ProjectCard from './ProjectCard';
import SubprojectDetailModal from './SubprojectDetailModal';
import { KHMDHS_COMPLETED_STATUS_SUGGESTION } from '../utils/khmdhsContractExpiryPrompt';
import { uploadSubprojectFiles, uploadSubprojectFolder } from '../utils/uploadSubprojectFiles';
import AdvancedFilters from './AdvancedFilters';
import ActiveFiltersBanner from './ActiveFiltersBanner';
import FileManager from './FileManager';
import TaskAssignmentToastHost from './TaskAssignmentToastHost';
import { KhmdhsBatchReportFab, KhmdhsBatchReportModal } from './KhmdhsBatchRefreshWidget';
import LinkedNoteSticker, { getEntityLinkedNotes } from './LinkedNoteSticker';
import {
  enrichProjectsFromLoad,
  refreshProjectsLockStatus,
  sortProjectsForDisplay
} from '../utils/dashboardProjectLocks';
import { containsSearchTerm } from '../utils/searchUtils';
import {
  getProjectChargeSearchText,
  projectMatchesChargeFilters,
  projectVisibleToAssignedEngineer,
  buildEngineerVisibilityContext
} from '../utils/supervisorChargeDisplay';
import {
  getProjectKhmdhsSearchText,
  projectMatchesKhmdhsAnadoxosFilters
} from '../utils/khmdhsFields';
import { getProjectAssignmentProcedure } from '../utils/khmdhsNoticeFields';
import {
  getCharacterization,
  statusShowsAssignmentProcedure,
  normalizeProjectType,
  PROJECT_STATUS_ABANDONED,
  isAbandonedSubproject,
  excludeAbandonedSubprojects
} from '../data/formOptions';
import {
  findDirectAssignmentViolations,
  getViolationSubprojectIds,
  getViolationsForSubproject
} from '../utils/directAssignmentCompliance';
import { matchesKhmdhsDeadlineFilter } from '../utils/procurementDeadlines';
import { useToast } from './ToastProvider';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';
import { formatDateEl } from '../utils/dateFormat';
import { showConfirm } from '../utils/confirmModal';
import { exportSubprojectReport } from '../utils/subprojectReportExport';

const Statistics = lazy(() => import('./Statistics'));
const StatisticsModal = lazy(() => import('./StatisticsModal'));
const PDFViewer = lazy(() => import('./PDFViewer'));
const ExportData = lazy(() => import('./ExportData'));
const TechnicalProgramExport = lazy(() => import('./TechnicalProgramExport'));
const ReportsModal = lazy(() => import('./ReportsModal'));
const InvestExport = lazy(() => import('./InvestExport'));
const PortalExport = lazy(() => import('./PortalExport'));
const PortalSettingsModal = lazy(() => import('./PortalSettingsModal'));
const PortalHubModal = lazy(() => import('./PortalHubModal'));
const EntaxisManager = lazy(() => import('./EntaxisManager'));
const ProsklisisManager = lazy(() => import('./ProsklisisManager'));
const EgkriseisManager = lazy(() => import('./EgkriseisManager'));
const EgkriseisForm = lazy(() => import('./EgkriseisForm'));
const CreditApprovalsPanel = lazy(() => import('./CreditApprovalsPanel'));
const DocumentTemplatesManager = lazy(() => import('./DocumentTemplatesManager'));
const BackupManager = lazy(() => import('./BackupManager'));
const AuditLogViewer = lazy(() => import('./AuditLogViewer'));
const UserManagement = lazy(() => import('./UserManagement'));
const EmailSettingsModal = lazy(() => import('./EmailSettingsModal'));
const NotificationSettingsCenter = lazy(() => import('./NotificationSettingsCenter'));
const MyNotificationPreferences = lazy(() => import('./MyNotificationPreferences'));
const EmailSendHistory = lazy(() => import('./EmailSendHistory'));
const RoleDashboardWidget = lazy(() => import('./RoleDashboardWidget'));
const KhmdhsBatchRefreshWidget = lazy(() => import('./KhmdhsBatchRefreshWidget'));
const MunicipalUnitsManager = lazy(() => import('./MunicipalUnitsManager'));
const TaskAssignmentManager = lazy(() => import('./TaskAssignmentManager'));
const EpProgramManager = lazy(() => import('./EpProgramManager'));
const OrimanthiManager = lazy(() => import('./OrimanthiManager'));
const CalendarDeadlineWidget = lazy(() => import('./CalendarDeadlineWidget'));
const ProcurementCalendar = lazy(() => import('./ProcurementCalendar'));
const MeletaiManager = lazy(() => import('./MeletaiManager'));

const ipcRenderer = window.electronAPI;


/**
 * Τίτλος κεφαλίδας ομάδας υποέργων: όταν το ίδιο έργο έχει διαφορετική κεφαλαιοποίηση στο projectTitle
 * ανά data.json, επιλέγουμε την πιο συχνή τιμή (ώστε μία κεφαλίδα αντί για διπλότυπα).
 */
function pickDisplayProjectTitleForGroup(subprojects) {
  if (!subprojects?.length) return '';
  const counts = new Map();
  for (const p of subprojects) {
    const t = (p.projectTitle || '').trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  let best = (subprojects[0] && subprojects[0].projectTitle) || '';
  let bestCount = -1;
  for (const [t, c] of counts) {
    if (c > bestCount || (c === bestCount && t.length > best.length)) {
      best = t;
      bestCount = c;
    }
  }
  return best;
}

const LOCK_POLL_INTERVAL_MS = 30000;

const LazyChunkFallback = styled.div`
  padding: 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 600;
`;

const DashboardContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 40%, #f0f9ff 70%, #f8fafc 100%);
  padding: 0;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(241, 245, 249, 0.8);
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
    border-radius: 10px;
    border: 2px solid rgba(241, 245, 249, 0.8);
    transition: all 0.3s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
  }

  scroll-behavior: smooth;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  top: 0;
  left: 240px;
  right: 0;
  z-index: 900;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  padding: 1rem 2rem;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.25), 0 1px 0 rgba(99, 102, 241, 0.15);

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5), transparent);
  }

  @media (max-width: 1200px) {
    left: 0;
  }
`;

const CenteredTitleContainer = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;

const MainTitle = styled.h1`
  color: #f8fafc;
  font-size: 1.65rem;
  font-weight: 800;
  margin: 0 0 0.25rem 0;
  line-height: 1.2;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #a5b4fc 60%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
`;

const SubTitle = styled.h2`
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.8rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.3;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1.5px;
  text-transform: uppercase;
`;

const QuickSearchContainer = styled.div`
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  padding: 12px;
  margin-top: 8px;
  margin-bottom: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.25);
  width: 100%;
`;

const QuickSearchGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SearchInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const SearchLabel = styled.label`
  color: rgba(203, 213, 225, 0.85);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SearchInput = styled.input`
  padding: 8px 10px;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 7px;
  font-size: 0.8rem;
  transition: all 0.25s ease;
  background: rgba(15, 23, 42, 0.6);
  color: #f1f5f9;
  width: 100%;

  &:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.65);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    background: rgba(15, 23, 42, 0.85);
  }

  &::placeholder {
    color: rgba(148, 163, 184, 0.6);
    font-size: 0.75rem;
  }
`;

const SearchSelect = styled.select`
  padding: 8px 10px;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 7px;
  font-size: 0.8rem;
  transition: all 0.25s ease;
  background: rgba(15, 23, 42, 0.6);
  color: #f1f5f9;
  cursor: pointer;
  width: 100%;

  &:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.65);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    background: rgba(15, 23, 42, 0.85);
  }

  option {
    background: #1e293b;
    color: #f1f5f9;
  }
`;

const ClearButton = styled.button`
  padding: 8px 12px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: 1px solid rgba(248, 113, 113, 0.4);
  border-radius: 7px;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.4px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  }

  &:active {
    transform: translateY(0);
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 1;
`;

const UserRole = styled.span`
  background: ${props => props.role === 'SUPERADMIN'
    ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
    : props.role === 'ADMIN'
      ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
      : props.role === 'ENGINEER'
        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
      : 'linear-gradient(135deg, #10b981, #059669)'};
  color: white;
  padding: 0.45rem 1rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
`;

const RoleTag = styled.span`
  background: rgba(15, 23, 42, 0.45);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.38rem 0.78rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const LogoutButton = styled.button`
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.25s ease;
  letter-spacing: 0.3px;

  &:hover {
    background: rgba(239, 68, 68, 0.85);
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    transform: translateY(-1px);
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  z-index: 1;
`;

const VersionText = styled.div`
  color: rgba(100, 116, 139, 0.8);
  font-size: 0.7rem;
  text-align: right;
  min-width: 60px;
  font-weight: 600;
  letter-spacing: 0.5px;
`;

const getRoleLabel = (role) => {
  if (role === 'SUPERADMIN') return 'Superadmin';
  if (role === 'ADMIN') return 'admin';
  if (role === 'ENGINEER') return 'Μηχανικός';
  return 'viewer';
};

const ContentArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;



const ProjectsContainer = styled.div`
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
  border: 1px solid rgba(226, 232, 240, 0.6);
  min-height: 400px;
  width: 100%;
`;

const ProjectsTitle = styled.h2`
  color: #1e293b;
  margin-bottom: 2rem;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  text-align: left;
  position: relative;
  padding-left: 16px;
  text-transform: uppercase;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 4px;
  }
`;



const ProjectGroup = styled.div`
  margin-bottom: 2.5rem;
  border: 1.5px solid rgba(165, 180, 252, 0.45);
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.04),
    0 10px 28px rgba(99, 102, 241, 0.07);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    box-shadow:
      0 4px 10px rgba(15, 23, 42, 0.05),
      0 14px 36px rgba(99, 102, 241, 0.11);
    border-color: rgba(129, 140, 248, 0.55);
  }
`;

const ProjectGroupHeaderBand = styled.div`
  padding: 1rem 1.35rem 0.95rem;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 52%, #ffffff 100%);
  border-bottom: 2px solid rgba(165, 180, 252, 0.32);
  position: relative;
`;

const ProjectGroupHeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
  min-height: 28px;
`;

const ProjectKindLabel = styled.span`
  display: block;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #4338ca;
  margin: 0;
  flex-shrink: 0;
`;

const ProjectGroupTitleText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 1.16rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.38;
  letter-spacing: 0.01em;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const ProjectGroupBody = styled.div`
  padding: 1.15rem 1.25rem 1.35rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.65) 0%, rgba(255, 255, 255, 0.9) 100%);
`;

const ProjectGroupTitle = styled.h3`
  margin: 0;
  padding: 0;
  border: none;
`;

const EntaxiAmountChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%) !important;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
  white-space: nowrap;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
  margin-left: auto;
  z-index: 1;
  -webkit-text-fill-color: initial !important;
  background-clip: padding-box !important;
  -webkit-background-clip: padding-box !important;
  isolation: isolate;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
  }
`;

const EntaxiIcon = styled.span`
  font-size: 1.2rem;
  line-height: 1;
  display: block;
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
`;

const EntaxiLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a202c !important;
  letter-spacing: 0.3px;
  white-space: nowrap;
  display: block;
  -webkit-text-fill-color: #1a202c !important;
`;

const EntaxiValue = styled.span`
  font-size: 1.1rem;
  font-weight: 800;
  color: #000000 !important;
  letter-spacing: 0.5px;
  white-space: nowrap;
  display: block;
  -webkit-text-fill-color: #000000 !important;
`;


const SubprojectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 1.15rem;
  grid-auto-rows: 1fr;
  align-items: stretch;
  overflow: visible;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
`;

const EmptyStateIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  margin-bottom: 1.25rem;
`;

const EmptyStateText = styled.p`
  font-size: 1.15rem;
  font-weight: 700;
  color: #334155;
  margin: 0 0 0.5rem 0;
`;

const EmptyStateSubtext = styled.p`
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
  max-width: 380px;
  line-height: 1.6;
`;

const EmptyStateAction = styled.button`
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.45);
  }
`;

const skeletonShimmer = keyframes`
  0%   { background-position: -600px 0; }
  100% { background-position: 600px 0; }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.7) 25%,
    rgba(241, 245, 249, 0.9) 50%,
    rgba(226, 232, 240, 0.7) 75%
  );
  background-size: 600px 100%;
  animation: ${skeletonShimmer} 1.4s ease-in-out infinite;
  border-radius: 6px;
`;

const SkeletonCard = styled.div`
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(226, 232, 240, 0.7);
  min-height: 380px;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const SkeletonLine = styled(SkeletonBase)`
  height: ${props => props.$h || '14px'};
  width: ${props => props.$w || '100%'};
`;

const SkeletonGroup = styled.div`
  margin-bottom: 2.5rem;
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 16px;
  padding: 1.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(248, 250, 252, 0.9) 100%);
`;

function SkeletonProjectsGrid() {
  return (
    <>
      <SkeletonGroup>
        <SkeletonLine $h="22px" $w="45%" style={{ marginBottom: '1.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i}>
              <SkeletonLine $h="20px" $w="85%" />
              <SkeletonLine $h="12px" $w="60%" />
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem' }}>
                {[1, 2, 3, 4].map(j => <SkeletonLine key={j} $h="20px" $w="70px" style={{ borderRadius: '20px' }} />)}
              </div>
              <SkeletonLine $h="12px" $w="70%" style={{ marginTop: '0.5rem' }} />
              <SkeletonLine $h="12px" $w="55%" />
              <SkeletonLine $h="12px" $w="80%" />
              <SkeletonLine $h="12px" $w="65%" />
              <SkeletonLine $h="12px" $w="75%" />
              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(226,232,240,0.6)', display: 'flex', gap: '0.5rem' }}>
                <SkeletonLine $h="32px" $w="48%" style={{ borderRadius: '8px' }} />
                <SkeletonLine $h="32px" $w="48%" style={{ borderRadius: '8px' }} />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </SkeletonGroup>
      <SkeletonGroup>
        <SkeletonLine $h="22px" $w="55%" style={{ marginBottom: '1.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {[1, 2].map(i => (
            <SkeletonCard key={i}>
              <SkeletonLine $h="20px" $w="75%" />
              <SkeletonLine $h="12px" $w="50%" />
              <SkeletonLine $h="12px" $w="70%" style={{ marginTop: '0.5rem' }} />
              <SkeletonLine $h="12px" $w="60%" />
            </SkeletonCard>
          ))}
        </div>
      </SkeletonGroup>
    </>
  );
}

const GroupHeaderWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  border-radius: 10px;
  padding: 0.25rem 0.35rem;
  margin: -0.25rem -0.35rem;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.05);
  }
`;

const GroupCollapseIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 0.75rem;
  flex-shrink: 0;
  transition: transform 0.25s ease, background 0.2s ease;
  transform: ${props => props.$collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
  margin-left: 0.5rem;
`;

const GroupSubCount = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.6rem;
  border-radius: 20px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  margin-left: 0.6rem;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 1.2rem;
  color: #6c757d;
`;

// Banner για αρχειοθετημένα έργα
const ArchiveBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(30, 41, 59, 0.96) 100%);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-left: 4px solid #6366f1;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.12);
  animation: fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const ArchiveBannerIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2));
  border: 1px solid rgba(99, 102, 241, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
`;

const ArchiveBannerContent = styled.div`
  flex: 1;
`;

const ArchiveBannerTitle = styled.div`
  color: #e0e7ff;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 0.35rem;
`;

const ArchiveBannerText = styled.div`
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.8rem;
  line-height: 1.6;
`;

const ArchiveBannerTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  margin-left: 0.5rem;
  vertical-align: middle;
`;

const ArchiveBannerClose = styled.button`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(148, 163, 184, 0.7);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
  align-self: flex-start;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
`;

// Κουμπί αρχείου στη sidebar με ειδικό στυλ
const ArchiveButton = styled.button`
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.1) 100%);
  color: ${props => props.$active ? '#34d399' : '#a7f3d0'};
  border: 1px solid ${props => props.$active ? 'rgba(52, 211, 153, 0.55)' : 'rgba(16, 185, 129, 0.2)'};
  padding: 10px 12px;
  border-radius: 9px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 40px;
  width: 100%;
  line-height: 1.25;
  position: relative;
  box-shadow: ${props => props.$active ? '0 0 0 1px rgba(52, 211, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)' : 'none'};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: ${props => props.$active ? '3px' : '0'};
    background: linear-gradient(180deg, #34d399, #10b981);
    border-radius: 0 2px 2px 0;
    transition: width 0.25s ease;
  }

  &:hover {
    transform: translateX(3px);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.18) 100%);
    border-color: rgba(52, 211, 153, 0.5);
    color: #34d399;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);

    &::before {
      width: 3px;
    }
  }
`;

// Modern σταθερή sidebar αριστερά με ομαδοποιημένα κουμπιά
const AdminSidebar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  backdrop-filter: blur(20px);
  padding: 18px 12px 18px 12px;
  box-shadow: 4px 0 32px rgba(15, 23, 42, 0.35), inset -1px 0 0 rgba(99, 102, 241, 0.15);
  border-right: 1px solid rgba(99, 102, 241, 0.2);
  width: 240px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100vh;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.6));
    border-radius: 10px;

    &:hover {
      background: linear-gradient(180deg, rgba(99, 102, 241, 0.9), rgba(139, 92, 246, 0.9));
    }
  }

  @media (max-width: 1200px) {
    display: none; /* Κρύψε σε μικρές οθόνες */
  }
`;

const SidebarBrand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px 16px 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const SidebarBrandLogo = styled.img`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
  flex-shrink: 0;
  object-fit: cover;
`;

const SidebarBrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.1;
`;

const SidebarBrandTitle = styled.span`
  color: #f8fafc;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const SidebarBrandSubtitle = styled.span`
  color: rgba(148, 163, 184, 0.85);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.4px;
  margin-top: 2px;
`;

// Μετατροπή hex (#rrggbb) σε "r, g, b" για χρήση με rgba(var(--x), opacity)
function hexToRgbStr(hex) {
  const h = (hex || '#6366f1').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

const CategorySection = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
  /* CSS custom properties κληρονομούνται από CategoryBody και AdminButton */
  --sec-accent: ${props => props.$accentColor || '#6366f1'};
  --sec-rgb: ${props => hexToRgbStr(props.$accentColor)};
  --sec-grad: ${props => props.$accentGrad || 'linear-gradient(135deg, #6366f1, #8b5cf6)'};
`;

const CategoryHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 12px;
  background: ${props => props.$open
    ? 'rgba(var(--sec-rgb), 0.16)'
    : 'rgba(255, 255, 255, 0.025)'};
  border: 1px solid ${props => props.$open
    ? 'rgba(var(--sec-rgb), 0.4)'
    : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;

  &:hover {
    background: rgba(var(--sec-rgb), 0.2);
    border-color: rgba(var(--sec-rgb), 0.5);
    transform: translateX(2px);
  }
`;

const CategoryHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
`;

const CategoryHeaderIcon = styled.span`
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: ${props => props.$accent || 'linear-gradient(135deg, #6366f1, #8b5cf6)'};
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
`;

const CategoryHeaderTitle = styled.span`
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const CategoryHeaderChevron = styled.span`
  color: rgba(148, 163, 184, 0.85);
  font-size: 0.7rem;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${props => props.$open ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const CategoryBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  max-height: ${props => props.$open ? '900px' : '0'};
  opacity: ${props => props.$open ? '1' : '0'};
  margin-top: ${props => props.$open ? '6px' : '0'};
  padding-left: 10px;
  /* Αριστερή γραμμή σύνδεσης — χρώμα από την κατηγορία */
  border-left: 2px solid rgba(var(--sec-rgb), ${props => props.$open ? '0.35' : '0'});
  margin-left: 3px;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.25s ease,
              margin-top 0.25s ease,
              border-color 0.3s ease;
`;

const AdminButton = styled.button`
  background: ${props => props.primary
    ? 'var(--sec-grad)'
    : 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)'};
  color: ${props => props.primary ? '#ffffff' : '#e2e8f0'};
  border: 1px solid ${props => props.primary
    ? 'rgba(var(--sec-rgb), 0.45)'
    : 'rgba(var(--sec-rgb), 0.15)'};
  padding: 10px 12px;
  border-radius: 9px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: none;
  letter-spacing: 0.2px;
  white-space: normal;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 40px;
  width: 100%;
  box-shadow: ${props => props.primary
    ? '0 4px 14px rgba(var(--sec-rgb), 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
    : '0 1px 3px rgba(0, 0, 0, 0.25)'};
  line-height: 1.25;
  position: relative;
  overflow: hidden;

  /* Left accent stripe — πάντα ορατό, χρώμα κατηγορίας */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${props => props.primary
      ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
      : 'rgba(var(--sec-rgb), 0.55)'};
    transition: all 0.25s ease;
  }

  &:hover {
    transform: translateX(3px);
    background: ${props => props.primary
      ? 'var(--sec-grad)'
      : 'rgba(var(--sec-rgb), 0.18)'};
    border-color: rgba(var(--sec-rgb), 0.5);
    box-shadow: ${props => props.primary
      ? '0 6px 18px rgba(var(--sec-rgb), 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      : '0 4px 12px rgba(var(--sec-rgb), 0.25)'};
    color: #ffffff;

    &::before {
      background: var(--sec-grad);
      width: 4px;
    }
  }

  &:active {
    transform: translateX(1px);
  }
`;

const AdminButtonIcon = styled.span`
  margin-right: 8px;
  font-size: 0.95rem;
  flex-shrink: 0;
  width: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const CalendarNavButton = styled.button`
  width: 100%;
  margin-bottom: 10px;
  padding: 11px 12px;
  border: 1px solid rgba(16, 185, 129, 0.45);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-align: left;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.12) 100%);
  color: #ecfdf5;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.2px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: all 0.22s ease;

  &:hover {
    transform: translateX(3px);
    border-color: rgba(52, 211, 153, 0.75);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.2) 100%);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.32);
  }

  &:active {
    transform: translateX(1px);
  }
`;

const CalendarNavIcon = styled.span`
  font-size: 1.05rem;
  flex-shrink: 0;
`;

const StatsNavButton = styled.button`
  width: 100%;
  margin-bottom: 10px;
  padding: 11px 12px;
  border: 1px solid rgba(99, 102, 241, 0.45);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-align: left;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(79, 70, 229, 0.14) 100%);
  color: #eef2ff;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.2px;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: all 0.22s ease;

  &:hover {
    transform: translateX(3px);
    border-color: rgba(129, 140, 248, 0.75);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(79, 70, 229, 0.22) 100%);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.32);
  }

  &:active {
    transform: translateX(1px);
  }
`;

const SidebarCountBadge = styled.span`
  margin-left: auto;
  min-width: 1.25rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
`;

/* ── Notes (redesigned) ── */
const NotesOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12000;
  padding: 24px;
  animation: notesFadeIn 0.25s ease-out;

  @keyframes notesFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

const NotesPanel = styled.div`
  width: min(1200px, 96vw);
  height: min(85vh, 92vh);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 80px rgba(30, 41, 59, 0.28), 0 0 0 1px rgba(99, 102, 241, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: notesSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes notesSlideUp {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const NotesHeader = styled.div`
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
`;

const NotesCloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;


const NoteSearchBar = styled.input`
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
  font-size: 0.8rem;
  font-family: inherit;
  transition: all 0.15s ease;
  box-sizing: border-box;

  &::placeholder { color: #b0b8c4; }
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.08);
  }
`;

const NewNoteBtn = styled.button`
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(67, 56, 202, 0.35);
  }
`;

const NotesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const NoteItem = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-left: 3px solid transparent;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    border-left-color: #818cf8;
    background: #eef2ff;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
  }
`;

const NoteItemTitle = styled.div`
  color: #1e293b;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.3;
`;

const NoteItemContent = styled.div`
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
`;

const NoteItemDate = styled.div`
  color: #94a3b8;
  font-size: 0.7rem;
`;

const NoteItemActions = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;

  ${NoteItem}:hover & {
    opacity: 1;
  }
`;

const NoteActionBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $danger }) => $danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)'};
    border-color: ${({ $danger }) => $danger ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'};
    color: ${({ $danger }) => $danger ? '#dc2626' : '#6366f1'};
  }
`;

const NotesEmpty = styled.div`
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 0.9rem;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  margin-top: 16px;
`;

const NotesLayout = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`;

const NotesListCol = styled.div`
  width: 300px;
  min-width: 260px;
  background: #f8fafc;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: rgba(203, 213, 225, 0.5);
    border-radius: 10px;
  }
`;

const NotePreviewCol = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 28px 30px;
  display: flex;
  flex-direction: column;
  gap: 0;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: rgba(203, 213, 225, 0.5);
    border-radius: 10px;
  }
`;

const NotePreviewTitle = styled.h3`
  margin: 0 0 6px;
  color: #1e293b;
  font-size: 1.15rem;
  font-weight: 700;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e7ff;
`;

const NotePreviewContent = styled.div`
  color: #334155;
  font-size: 0.9rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
  padding: 14px 0;
`;

const NotePreviewSection = styled.div`
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const NotePreviewSectionLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const NotePreviewMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  color: #94a3b8;
  font-size: 0.76rem;
  padding: 10px 0;
  border-top: 1px solid #f1f5f9;
`;

const NotePreviewActions = styled.div`
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
`;

const NotePreviewBtn = styled.button`
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;

  ${({ $primary }) => $primary ? `
    background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(67, 56, 202, 0.25);
    &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(67, 56, 202, 0.35); }
  ` : `
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
    &:hover { background: #f1f5f9; color: #475569; }
  `}
`;

const NotePreviewEmpty = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 0.88rem;
`;

const NoteReminderBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: ${({ $past }) => $past ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'};
  color: ${({ $past }) => $past ? '#dc2626' : '#d97706'};
  font-size: 0.72rem;
  font-weight: 600;
`;

const NoteEditOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13000;
  padding: 24px;
  animation: notesFadeIn 0.2s ease-out;
`;

const NoteEditPanel = styled.div`
  background: #fff;
  border-radius: 18px;
  width: min(780px, 94vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(30, 41, 59, 0.3);
  animation: notesSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;

  h3 {
    margin: 0;
    padding: 20px 24px;
    background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
  }
`;

const NoteEditInput = styled.input`
  margin: 20px 24px 0;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 1rem;
  font-family: inherit;
  color: #1e293b;
  transition: all 0.2s ease;

  &::placeholder { color: #94a3b8; }
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const NoteEditTextarea = styled.textarea`
  margin: 12px 24px 0;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 0.95rem;
  font-family: inherit;
  color: #334155;
  min-height: 220px;
  resize: vertical;
  flex: 1;
  transition: all 0.2s ease;

  &::placeholder { color: #94a3b8; }
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const NoteEditFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: auto;
`;

const NoteEditCancelBtn = styled.button`
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { background: #e2e8f0; }
`;

const NoteEditSaveBtn = styled.button`
  padding: 10px 22px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(67, 56, 202, 0.35);
  }
`;

const NotesFab = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%);
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow:
    0 6px 24px rgba(67, 56, 202, 0.45),
    0 2px 6px rgba(99, 102, 241, 0.3);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  animation: fabFloat 3s ease-in-out infinite;

  @keyframes fabFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  &:hover {
    transform: translateY(-3px) scale(1.08);
    box-shadow:
      0 10px 36px rgba(67, 56, 202, 0.55),
      0 4px 12px rgba(99, 102, 241, 0.4);
    animation: none;
  }

  &:active {
    transform: translateY(-1px) scale(0.96);
    animation: none;
  }
`;

const NoteFilesSection = styled.div`
  margin: 8px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const NoteFileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.82rem;
  color: #334155;
  transition: all 0.15s;

  &:hover { background: #eef2ff; border-color: #c7d2fe; }
`;

const NoteFileName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
`;

const NoteFileBtn = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.78rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    background: ${({ $danger }) => $danger ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)'};
    border-color: ${({ $danger }) => $danger ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'};
    color: ${({ $danger }) => $danger ? '#dc2626' : '#6366f1'};
  }
`;

const NoteUploadBtn = styled.button`
  margin: 6px 24px 0;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px dashed #c7d2fe;
  background: rgba(99, 102, 241, 0.04);
  color: #6366f1;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    border-color: #818cf8;
  }
`;

const NoteFilesBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  font-size: 0.72rem;
  font-weight: 600;
`;

const NoteLinksBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
  font-size: 0.72rem;
  font-weight: 600;
`;

const LinkPickerWrap = styled.div`
  margin: 8px 24px 0;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
`;

const LinkPickerLabel = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: #166534;
  margin-bottom: 8px;
`;

const LinkTypeTabs = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const LinkTypeTab = styled.button`
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => $active ? '#059669' : '#d1d5db'};
  background: ${({ $active }) => $active ? '#059669' : '#fff'};
  color: ${({ $active }) => $active ? '#fff' : '#6b7280'};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #059669; }
`;

const LinkSearchInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #d1fae5;
  background: #fff;
  font-size: 0.8rem;
  font-family: inherit;
  color: #1e293b;
  box-sizing: border-box;

  &::placeholder { color: #94a3b8; }
  &:focus { outline: none; border-color: #34d399; box-shadow: 0 0 0 2px rgba(16,185,129,0.1); }
`;

const LinkResultsList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 10px; }
`;

const LinkResultItem = styled.div`
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #334155;
  cursor: pointer;
  transition: background 0.1s;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover { background: #d1fae5; }

  span.type-icon { font-size: 0.85rem; flex-shrink: 0; }
  span.parent-hint { color: #94a3b8; font-size: 0.7rem; margin-left: auto; }
`;

const LinkedChipsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
`;

const LinkedChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 220px;

  span.chip-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const LinkedChipRemove = styled.button`
  background: none;
  border: none;
  color: #dc2626;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  font-weight: 700;

  &:hover { color: #991b1b; }
`;

const NoteLinkedChipPreview = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
  color: #065f46;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  max-width: 200px;

  &:hover {
    border-color: #059669;
    box-shadow: 0 2px 8px rgba(16,185,129,0.15);
  }

  span.chip-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ContentWrapper = styled.div`
  margin-left: 240px;
  margin-top: ${(props) => (typeof props.$headerOffset === 'number' ? props.$headerOffset : 0)}px;
  padding: 1.75rem 2rem;
  width: calc(100% - 240px);
  max-width: calc(100% - 240px);

  @media (max-width: 1200px) {
    margin-left: 0;
    width: 100%;
    max-width: 100%;
  }
`;

const ipc = window.electronAPI;

const ENTITY_TYPE_META = {
  project:    { icon: '🏗', label: 'Έργο' },
  subproject: { icon: '📦', label: 'Υποέργο' },
  entaxi:     { icon: '📋', label: 'Ένταξη' },
  prosklisi:  { icon: '📢', label: 'Πρόσκληση' },
  egkrisi:    { icon: '💰', label: 'Έγκριση' },
  meleti:     { icon: '📐', label: 'Μελέτη' },
};

const VISIBILITY_OPTIONS = [
  { key: 'private', label: '🔒 Προσωπική', desc: 'Μόνο εσείς' },
  { key: 'roles', label: '👥 Ορατή σε ρόλους', desc: 'Επιλέξτε ρόλους' },
  { key: 'users', label: '👤 Ορατή σε χρήστες', desc: 'Επιλέξτε χρήστες' }
];
const ROLE_OPTIONS = [
  { key: 'SUPERADMIN', label: 'Superadmin' },
  { key: 'ADMIN', label: 'Διαχειριστής' },
  { key: 'ENGINEER', label: 'Μηχανικός' },
  { key: 'USER', label: 'Χρήστης' }
];

const NoteEditModal = React.memo(function NoteEditModal({ note, onSave, onCancel, currentUser }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [reminderDate, setReminderDate] = useState(note?.reminderDate || '');
  const initTime = note?.reminderTime || '';
  const [reminderHour, setReminderHour] = useState(initTime ? initTime.split(':')[0] : '');
  const [reminderMinute, setReminderMinute] = useState(initTime ? initTime.split(':')[1] : '');
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [linkedEntities, setLinkedEntities] = useState(note?.linkedEntities || []);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkTypeFilter, setLinkTypeFilter] = useState('all');
  const [linkSearch, setLinkSearch] = useState('');
  const [allEntities, setAllEntities] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [egkrisiSearchBy, setEgkrisiSearchBy] = useState('subproject');
  const [visibility, setVisibility] = useState(note?.visibility || 'private');
  const [visibleToRoles, setVisibleToRoles] = useState(note?.visibleToRoles || []);
  const [visibleToUsers, setVisibleToUsers] = useState(note?.visibleToUsers || []);
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const noteId = note?.id;
  const isExisting = !!noteId;

  useEffect(() => {
    if (!isExisting) return;
    let canceled = false;
    (async () => {
      setLoadingFiles(true);
      try {
        const res = await ipc.invoke('get-note-files', { noteId });
        if (!canceled && res?.files) setFiles(res.files);
      } catch (_) { /* ignore */ }
      if (!canceled) setLoadingFiles(false);
    })();
    return () => { canceled = true; };
  }, [noteId, isExisting]);

  useEffect(() => {
    (async () => {
      try {
        const res = await ipc.invoke('check-user-email', { username: currentUser?.username });
        setEmailStatus(res);
      } catch (_) { /* ignore */ }
    })();
  }, [currentUser?.username]);

  useEffect(() => {
    if (visibility !== 'users') return;
    if (usersList.length > 0) return;
    let canceled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const res = await ipc.invoke('get-users-list');
        if (!canceled && res?.success && res.data) {
          setUsersList(res.data.filter(u => u.username !== currentUser?.username));
        }
      } catch (_) { /* ignore */ }
      if (!canceled) setUsersLoading(false);
    })();
    return () => { canceled = true; };
  }, [visibility, usersList.length, currentUser?.username]);

  const loadEntities = useCallback(async () => {
    if (allEntities.length > 0) return;
    setLoadingEntities(true);
    try {
      const res = await ipc.invoke('get-all-entity-names');
      if (res?.success && res.data) setAllEntities(res.data);
    } catch (_) { /* ignore */ }
    setLoadingEntities(false);
  }, [allEntities.length]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const handleOpenLinkPicker = useCallback(() => {
    setLinkPickerOpen(true);
  }, []);

  const handleAddLink = useCallback((entity) => {
    setLinkedEntities(prev => {
      if (prev.some(e => e.id === entity.id && e.type === entity.type)) return prev;
      return [...prev, { type: entity.type, id: entity.id, title: entity.title }];
    });
  }, []);

  const handleRemoveLink = useCallback((entityId, entityType) => {
    setLinkedEntities(prev => prev.filter(e => !(e.id === entityId && e.type === entityType)));
  }, []);

  const filteredEntities = useMemo(() => {
    const term = linkSearch.trim();
    if (!term || term.length < 2) return [];
    return allEntities.filter(e => {
      if (linkTypeFilter !== 'all' && e.type !== linkTypeFilter) return false;
      if (linkedEntities.some(l => l.id === e.id && l.type === e.type)) return false;
      if (e.type === 'egkrisi' && linkTypeFilter === 'egkrisi') {
        if (egkrisiSearchBy === 'project') return containsSearchTerm(e.parentTitle, term);
        return containsSearchTerm(e.title, term);
      }
      return containsSearchTerm(e.title, term) || containsSearchTerm(e.parentTitle, term);
    }).slice(0, 30);
  }, [allEntities, linkSearch, linkTypeFilter, linkedEntities, egkrisiSearchBy]);

  const isEntityOrphan = useCallback((ent) => {
    if (allEntities.length === 0) return false;
    return !allEntities.some(e => e.id === ent.id && e.type === ent.type);
  }, [allEntities]);

  const reminderTime = (reminderHour && reminderMinute) ? `${reminderHour}:${reminderMinute}` : '';

  const handleUpload = useCallback(async () => {
    let id = noteId;
    if (!id) {
      id = `note-${Date.now()}`;
      onSave({ title: title.trim(), content: content.trim(), reminderDate, reminderTime, id, keepOpen: true });
    }
    try {
      const res = await ipc.invoke('upload-note-files', { noteId: id });
      if (res?.success && res.files) {
        setFiles(prev => [...prev, ...res.files.map(name => ({ name, size: 0 }))]);
      }
    } catch (_) { /* ignore */ }
  }, [noteId, title, content, reminderDate, reminderTime, onSave]);

  const handleOpenFile = useCallback(async (fileName) => {
    if (!noteId) return;
    await ipc.invoke('open-note-file', { noteId, fileName });
  }, [noteId]);

  const handleDeleteFile = useCallback(async (fileName) => {
    if (!noteId) return;
    const res = await ipc.invoke('delete-note-file', { noteId, fileName });
    if (res?.success) {
      setFiles(prev => prev.filter(f => f.name !== fileName));
    }
  }, [noteId]);

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return;
    onSave({
      title: title.trim(), content: content.trim(),
      reminderDate: reminderDate || null, reminderTime: reminderTime || null,
      linkedEntities, visibility,
      visibleToRoles: visibility === 'roles' ? visibleToRoles : [],
      visibleToUsers: visibility === 'users' ? visibleToUsers : []
    });
  }, [title, content, reminderDate, reminderTime, linkedEntities, visibility, visibleToRoles, visibleToUsers, onSave]);

  const userHasEmail = emailStatus?.hasEmail;
  const superAdminName = emailStatus?.superAdminFullName;

  return (
    <NoteEditOverlay onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <NoteEditPanel onClick={(e) => e.stopPropagation()}>
        <h3>{isExisting ? 'Επεξεργασία Σημείωσης' : 'Νέα Σημείωση'}</h3>
        <NoteEditInput
          type="text"
          placeholder="Τίτλος"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <NoteEditTextarea
          placeholder="Περιεχόμενο..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div style={{ margin: '8px 24px 0', padding: '12px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
            🔔 Υπενθύμιση μέσω email (προαιρετικό)
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <select
                value={reminderHour}
                onChange={(e) => setReminderHour(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', minWidth: '58px' }}
              >
                <option value="">ΩΩ</option>
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span style={{ fontWeight: '700', color: '#64748b', fontSize: '1rem' }}>:</span>
              <select
                value={reminderMinute}
                onChange={(e) => setReminderMinute(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', minWidth: '58px' }}
              >
                <option value="">ΛΛ</option>
                {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {reminderDate && (
              <button
                type="button"
                onClick={() => { setReminderDate(''); setReminderHour(''); setReminderMinute(''); }}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
              >
                Αφαίρεση
              </button>
            )}
          </div>
          {reminderDate && !userHasEmail && (
            <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', fontSize: '0.78rem', color: '#b91c1c', lineHeight: '1.4' }}>
              Δεν έχει καταχωρηθεί email στον λογαριασμό σας. Επικοινωνήστε με τον διαχειριστή
              {superAdminName ? ` (${superAdminName})` : ''} για να καταχωρηθεί το email σας ώστε να λαμβάνετε υπενθυμίσεις.
            </div>
          )}
          {reminderDate && userHasEmail && (
            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#15803d' }}>
              Θα λάβετε email υπενθύμιση στις {formatDateEl(reminderDate, '')}{reminderTime ? ` ${reminderTime}` : ''}.
            </div>
          )}
        </div>
        {files.length > 0 && (
          <NoteFilesSection>
            {files.map(f => (
              <NoteFileItem key={f.name}>
                <span style={{ fontSize: '0.9rem' }}>📎</span>
                <NoteFileName>{f.name}</NoteFileName>
                {isExisting && <NoteFileBtn type="button" title="Άνοιγμα" onClick={() => handleOpenFile(f.name)}>👁</NoteFileBtn>}
                <NoteFileBtn type="button" title="Διαγραφή" $danger onClick={() => handleDeleteFile(f.name)}>✕</NoteFileBtn>
              </NoteFileItem>
            ))}
          </NoteFilesSection>
        )}
        {loadingFiles && <div style={{ margin: '6px 24px', color: '#94a3b8', fontSize: '0.8rem' }}>Φόρτωση αρχείων...</div>}
        <NoteUploadBtn type="button" onClick={handleUpload}>
          📎 Επισύναψη αρχείου
        </NoteUploadBtn>
        <div style={{ margin: '8px 24px 0', padding: '12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0c4a6e', marginBottom: '8px' }}>
            👁 Ορατότητα σημείωσης
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: visibility !== 'private' ? '8px' : '0' }}>
            {VISIBILITY_OPTIONS.map(opt => (
              <label key={opt.key} style={{
                display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                padding: '5px 10px', borderRadius: '8px', fontSize: '0.8rem',
                background: visibility === opt.key ? '#dbeafe' : '#fff',
                border: `1px solid ${visibility === opt.key ? '#3b82f6' : '#e2e8f0'}`,
                fontWeight: visibility === opt.key ? '600' : '400',
                transition: 'all 0.15s'
              }}>
                <input
                  type="radio" name="noteVisibility" value={opt.key}
                  checked={visibility === opt.key}
                  onChange={() => setVisibility(opt.key)}
                  style={{ accentColor: '#3b82f6' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {visibility === 'roles' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ROLE_OPTIONS.map(r => (
                <label key={r.key} style={{
                  display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem',
                  background: visibleToRoles.includes(r.key) ? '#dbeafe' : '#fff',
                  border: `1px solid ${visibleToRoles.includes(r.key) ? '#3b82f6' : '#cbd5e1'}`,
                  transition: 'all 0.15s'
                }}>
                  <input
                    type="checkbox"
                    checked={visibleToRoles.includes(r.key)}
                    onChange={(e) => {
                      if (e.target.checked) setVisibleToRoles(prev => [...prev, r.key]);
                      else setVisibleToRoles(prev => prev.filter(x => x !== r.key));
                    }}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          )}
          {visibility === 'users' && (
            <div>
              {usersLoading ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '4px' }}>Φόρτωση χρηστών...</div>
              ) : (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {usersList.map(u => (
                    <label key={u.username} style={{
                      display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem',
                      background: visibleToUsers.includes(u.username) ? '#dbeafe' : '#fff',
                      border: `1px solid ${visibleToUsers.includes(u.username) ? '#3b82f6' : '#cbd5e1'}`,
                      transition: 'all 0.15s'
                    }}>
                      <input
                        type="checkbox"
                        checked={visibleToUsers.includes(u.username)}
                        onChange={(e) => {
                          if (e.target.checked) setVisibleToUsers(prev => [...prev, u.username]);
                          else setVisibleToUsers(prev => prev.filter(x => x !== u.username));
                        }}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      {u.fullName} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({u.role})</span>
                    </label>
                  ))}
                  {usersList.length === 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Δεν βρέθηκαν χρήστες</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <LinkPickerWrap>
          <LinkPickerLabel>🔗 Συσχέτιση με Έργο / Υποέργο / Ένταξη / Πρόσκληση / Έγκριση</LinkPickerLabel>
          {linkedEntities.length > 0 && (
            <LinkedChipsWrap style={{ marginBottom: '8px' }}>
              {linkedEntities.map(ent => {
                const meta = ENTITY_TYPE_META[ent.type] || { icon: '🔗', label: ent.type };
                const orphan = isEntityOrphan(ent);
                return (
                  <LinkedChip key={`${ent.type}-${ent.id}`} style={orphan ? { opacity: 0.5, borderColor: '#fca5a5', background: '#fef2f2' } : undefined}>
                    <span>{meta.icon}</span>
                    <span className="chip-title">{ent.title}{orphan ? ' (Διαγράφηκε)' : ''}</span>
                    <LinkedChipRemove type="button" onClick={() => handleRemoveLink(ent.id, ent.type)}>✕</LinkedChipRemove>
                  </LinkedChip>
                );
              })}
            </LinkedChipsWrap>
          )}
          <LinkTypeTabs>
            {[{ key: 'all', label: 'Όλα' }, { key: 'project', label: '🏗 Έργα' }, { key: 'subproject', label: '📦 Υποέργα' }, { key: 'entaxi', label: '📋 Εντάξεις' }, { key: 'prosklisi', label: '📢 Προσκλήσεις' }, { key: 'egkrisi', label: '💰 Εγκρίσεις' }, { key: 'meleti', label: '📐 Μελέτες' }].map(tab => (
              <LinkTypeTab key={tab.key} $active={linkTypeFilter === tab.key} type="button" onClick={() => setLinkTypeFilter(tab.key)}>
                {tab.label}
              </LinkTypeTab>
            ))}
          </LinkTypeTabs>
          {linkTypeFilter === 'egkrisi' && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '0.76rem', color: '#475569' }}>
              <span style={{ fontWeight: 600, color: '#166534' }}>Αναζήτηση βάσει:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input type="radio" name="egkrisiSearchBy" value="subproject" checked={egkrisiSearchBy === 'subproject'} onChange={() => setEgkrisiSearchBy('subproject')} style={{ accentColor: '#059669' }} />
                Τίτλου Υποέργου
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input type="radio" name="egkrisiSearchBy" value="project" checked={egkrisiSearchBy === 'project'} onChange={() => setEgkrisiSearchBy('project')} style={{ accentColor: '#059669' }} />
                Τίτλου Έργου
              </label>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <LinkSearchInput
              type="text"
              placeholder={linkTypeFilter === 'egkrisi' ? (egkrisiSearchBy === 'project' ? 'Αναζήτηση βάσει τίτλου Έργου...' : 'Αναζήτηση βάσει τίτλου Υποέργου...') : 'Πληκτρολογήστε για αναζήτηση...'}
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
            />
            {linkSearch.trim().length >= 2 && (
              <LinkResultsList style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #d1fae5', borderTop: 'none', borderRadius: '0 0 8px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                {loadingEntities ? (
                  <div style={{ padding: '10px', color: '#94a3b8', fontSize: '0.78rem' }}>Φόρτωση...</div>
                ) : filteredEntities.length === 0 ? (
                  <div style={{ padding: '10px', color: '#94a3b8', fontSize: '0.78rem' }}>Δεν βρέθηκαν αποτελέσματα</div>
                ) : (
                  filteredEntities.map(ent => {
                    const meta = ENTITY_TYPE_META[ent.type] || { icon: '🔗', label: ent.type };
                    return (
                      <LinkResultItem key={`${ent.type}-${ent.id}`} onClick={() => { handleAddLink(ent); setLinkSearch(''); }}>
                        <span className="type-icon">{meta.icon}</span>
                        {ent.title}
                        {ent.parentTitle && <span className="parent-hint">{ent.parentTitle}</span>}
                      </LinkResultItem>
                    );
                  })
                )}
              </LinkResultsList>
            )}
          </div>
        </LinkPickerWrap>
        <NoteEditFooter>
          <NoteEditCancelBtn type="button" onClick={onCancel}>Ακύρωση</NoteEditCancelBtn>
          <NoteEditSaveBtn type="button" onClick={handleSave}>Αποθήκευση</NoteEditSaveBtn>
        </NoteEditFooter>
      </NoteEditPanel>
    </NoteEditOverlay>
  );
});

function Dashboard({ currentUser, appVersion, appConfig = {}, onLogout, onSyncCurrentUser }) {
  const { showToast } = useToast();
  const userRole = currentUser?.role || 'USER';
  const isSuperAdmin = userRole === 'SUPERADMIN';
  const canManageAll = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const isEngineer = userRole === 'ENGINEER';
  /** Στα modals εντάξεων / προσκλήσεων / εγκρίσεων ο μηχανικός συμπεριφέρεται όπως viewer */
  const userRoleForWorkflowModals = isEngineer ? 'USER' : userRole;
  const engineerSupervisors = useMemo(() => (
    Array.isArray(currentUser?.assignedSupervisors)
      ? currentUser.assignedSupervisors.map(s => String(s || '').trim()).filter(Boolean)
      : []
  ), [currentUser?.assignedSupervisors]);

  const engineerVisibilityContext = useMemo(
    () => buildEngineerVisibilityContext(currentUser, engineerSupervisors),
    [currentUser, engineerSupervisors]
  );
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [entaxeis, setEntaxeis] = useState([]);
  const [proskliseis, setProskliseis] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEgkriseisFormOpen, setIsEgkriseisFormOpen] = useState(false);
  const [isEgkriseisManagerOnly, setIsEgkriseisManagerOnly] = useState(false);
  const [egkriseisInitialSearch, setEgkriseisInitialSearch] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, filePath: '', fileName: '' });
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  // Sidebar accordion state - ποιες κατηγορίες είναι ανοιχτές
  // Ξεκινά πάντα "κλειστό" σε κάθε άνοιγμα της εφαρμογής (χωρίς απομνημόνευση)
  const [expandedCategories, setExpandedCategories] = useState({
    projects: false,
    management: false,
    assignments: false,
    exports: false,
    tools: false,
    system: false
  });
  const toggleCategory = useCallback((key) => {
    setExpandedCategories(prev => {
      return { ...prev, [key]: !prev[key] };
    });
  }, []);
  const [advancedFilters, setAdvancedFilters] = useState({
    projectTitle: '',
    subprojectTitle: '',
    kaCode: '',
    aleCode: '',
    supervisor: [],
    projectType: [],
    fundingSource: [],
    fundingDetails: [],
    projectStatus: [],
    implementationForm: [],
    characterization: '',
    hasSupplementaryContracts: '',
    contractsCount: '',
    hasEgkriseisDialthesisPistosis: '',
    hasProsklisiLink: '',
    hasEntaxiLink: '',
    hasComments: '',
    hasApeComments: '',
    hasRemainingComments: '',
    hasEisigitikiEkthesi: '',
    misPraxhsCode: '',
    remainingYear: '',
    remainingAmountCondition: 'all',
    contractDateFrom: '',
    contractDateTo: '',
    contractProcessDateFrom: '',
    contractProcessDateTo: '',
    approvedAmountMin: '',
    approvedAmountMax: '',
    contractAmountMin: '',
    contractAmountMax: '',
    apeAmountMin: '',
    apeAmountMax: '',
    anadoxosName: '',
    anadoxosVat: '',
    assignmentProcedure: [],
    hasAssignmentProcedure: '',
    khmdhsDeadlineFilter: '',
    sortBy: 'kaCode',
    sortOrder: 'asc'
  });
  
  // Εμφάνιση αρχειοθετημένων (Ολοκληρωμένα & Αποπληρωμένα)
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [isStatisticsModalOpen, setIsStatisticsModalOpen] = useState(false);
  const [portfolioDrillFilter, setPortfolioDrillFilter] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroupCollapse = useCallback((projectId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Scroll position preservation
  const dashboardScrollRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const savedScrollPosition = useRef(0);
  /** Scroll πριν ανοίξει modal λεπτομερειών/επεξεργασίας — δεν ενημερώνεται όσο το modal είναι ανοιχτό */
  const dashboardScrollBeforeModalRef = useRef(null);
  const dashboardScrollBeforeFormRef = dashboardScrollBeforeModalRef;
  const projectsListRef = useRef(null);
  const shouldRestoreScroll = useRef(false);
  /** Αύξηση μετά από αποθήκευση ώστε να τρέξει επαναφορά scroll ακόμα κι αν δεν αλλάξει το πλήθος υποέργων */
  const [scrollRestoreTick, setScrollRestoreTick] = useState(0);
  /** Επιστροφή στις σημειώσεις μετά από μετάβαση από chip συσχέτισης */
  const noteReturnRef = useRef(null);
  const meletaiReturnRef = useRef(null);
  // Separate monotonic counters for loadDataWithCache and loadProjects
  // Keeping them separate so one does not accidentally cancel the other
  const loadRequestIdRef = useRef(0);
  const loadProjectsRequestIdRef = useRef(0);

  const mainHeaderRef = useRef(null);
  const [mainHeaderOffsetPx, setMainHeaderOffsetPx] = useState(88);

  const captureDashboardScrollForForm = useCallback(() => {
    const y = dashboardScrollRef.current?.scrollTop ?? 0;
    dashboardScrollBeforeModalRef.current = y;
    savedScrollPosition.current = y;
  }, []);

  const openSubprojectDetail = useCallback((project) => {
    if (!project) return;
    captureDashboardScrollForForm();
    setSelectedDetailProject(project);
  }, [captureDashboardScrollForForm]);

  const isSubprojectDashboardModalOpen = isFormOpen || !!selectedDetailProject;

  const restoreDashboardScrollPosition = useCallback((y) => {
    if (y == null) return;
    const apply = () => {
      if (dashboardScrollRef.current) {
        dashboardScrollRef.current.scrollTop = y;
      }
    };
    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        setTimeout(apply, 50);
      });
    });
  }, []);

  useLayoutEffect(() => {
    const el = dashboardScrollRef.current;
    if (!el) return undefined;

    if (isSubprojectDashboardModalOpen) {
      if (dashboardScrollBeforeModalRef.current == null) {
        dashboardScrollBeforeModalRef.current = el.scrollTop;
        savedScrollPosition.current = el.scrollTop;
      }
      el.style.overflow = 'hidden';
      const y = dashboardScrollBeforeModalRef.current;
      if (y != null && el.scrollTop !== y) {
        el.scrollTop = y;
      }
      return undefined;
    }

    el.style.overflow = '';
    const y = dashboardScrollBeforeModalRef.current;
    if (y != null) {
      savedScrollPosition.current = y;
      shouldRestoreScroll.current = true;
      restoreDashboardScrollPosition(y);
    }
    dashboardScrollBeforeModalRef.current = null;
    return undefined;
  }, [isSubprojectDashboardModalOpen, restoreDashboardScrollPosition]);

  useEffect(() => {
    if (!isSubprojectDashboardModalOpen) return undefined;
    const dash = dashboardScrollRef.current;
    const blockDashboardScroll = (e) => {
      if (e.target.closest('[data-project-form-modal]')) return;
      if (e.target.closest('[data-subproject-detail-modal]')) return;
      if (e.target.closest('[data-khmdhs-review-modal]')) return;
      if (e.target.closest('[data-khmdhs-situation-modal]')) return;
      if (e.target.closest('[data-khmdhs-document-registry-modal]')) return;
      if (e.target.closest('[data-khmdhs-branch-picker-modal]')) return;
      if (e.target.closest('[data-khmdhs-symv-planner-modal]')) return;
      if (e.target.closest('[data-khmdhs-ape-entry-modal]')) return;
      if (e.target.closest('[data-khmdhs-related-docs-modal]')) return;
      if (e.target.closest('[data-file-manager-modal]')) return;
      e.preventDefault();
    };
    dash?.addEventListener('wheel', blockDashboardScroll, { passive: false });
    dash?.addEventListener('touchmove', blockDashboardScroll, { passive: false });
    return () => {
      dash?.removeEventListener('wheel', blockDashboardScroll);
      dash?.removeEventListener('touchmove', blockDashboardScroll);
    };
  }, [isSubprojectDashboardModalOpen]);

  useLayoutEffect(() => {
    const el = mainHeaderRef.current;
    if (!el) return undefined;
    const sync = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setMainHeaderOffsetPx((prev) => (prev === h ? prev : h));
    };
    sync();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [currentUser?.fullName, currentUser?.username, userRole, appConfig?.organizationFullName, appVersion]);
  
  // Quick Search states
  const [quickSearchText, setQuickSearchText] = useState('');
  const [quickSearchStatus, setQuickSearchStatus] = useState('');
  const [quickSearchType, setQuickSearchType] = useState('');
  const [fileManager, setFileManager] = useState({ 
    isOpen: false, 
    projectId: null, 
    subprojectId: null, 
    files: [], 
    fileGroups: [],
    khmdhsDocumentRegistry: [],
    khmdhsRelatedDocuments: [],
  });
  const [fileManagerUploading, setFileManagerUploading] = useState(false);

  useEffect(() => {
    if (!fileManager.isOpen) return undefined;
    const dash = dashboardScrollRef.current;
    const blockBehindFileManager = (e) => {
      if (e.target.closest('[data-file-manager-modal]')) return;
      e.preventDefault();
    };
    dash?.addEventListener('wheel', blockBehindFileManager, { passive: false });
    dash?.addEventListener('touchmove', blockBehindFileManager, { passive: false });
    return () => {
      dash?.removeEventListener('wheel', blockBehindFileManager);
      dash?.removeEventListener('touchmove', blockBehindFileManager);
    };
  }, [fileManager.isOpen]);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTechnicalProgramOpen, setIsTechnicalProgramOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [reportsInitialTab, setReportsInitialTab] = useState('subprojects');
  const [isInvestExportOpen, setIsInvestExportOpen] = useState(false);
  const [isPortalExportOpen, setIsPortalExportOpen] = useState(false);
  const [isPortalHubOpen, setIsPortalHubOpen] = useState(false);
  const [isPortalSettingsOpen, setIsPortalSettingsOpen] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(appConfig.portalEnabled === true);
  const [publishedSubprojectIds, setPublishedSubprojectIds] = useState(new Set());
  const [isBackupManagerOpen, setIsBackupManagerOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isProcurementCalendarOpen, setIsProcurementCalendarOpen] = useState(false);
  const [calendarFocusCustomEventId, setCalendarFocusCustomEventId] = useState(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [isMyNotifPrefsOpen, setIsMyNotifPrefsOpen] = useState(false);
  const [isEmailHistoryOpen, setIsEmailHistoryOpen] = useState(false);
  const [isMunicipalUnitsOpen, setIsMunicipalUnitsOpen] = useState(false);
  const [isTaskAssignmentsOpen, setIsTaskAssignmentsOpen] = useState(false);
  const [taskAssignmentInitialScreen, setTaskAssignmentInitialScreen] = useState('workspace');
  const [taskAssignmentsFocusTaskId, setTaskAssignmentsFocusTaskId] = useState(null);
  const [taskAccess, setTaskAccess] = useState({ showModule: false, unreadCount: 0, canAssign: false });
  const [engineerCatalogForCards, setEngineerCatalogForCards] = useState([]);

  const visibleProjects = useMemo(() => {
    if (!isEngineer) return projects;
    return projects.filter((project) =>
      projectVisibleToAssignedEngineer(project, engineerVisibilityContext, engineerCatalogForCards)
    );
  }, [projects, isEngineer, engineerVisibilityContext, engineerCatalogForCards]);

  const canOpenProcurementCalendar = true;

  const engineerVisibleSubprojectIds = useMemo(() => {
    if (!isEngineer) return null;
    return new Set(visibleProjects.map((p) => p.subprojectId).filter(Boolean));
  }, [isEngineer, visibleProjects]);

  const [isEntaxisOpen, setIsEntaxisOpen] = useState(false);
  const [entaxisProjectFilter, setEntaxisProjectFilter] = useState(null);
  const [selectedEntaxiId, setSelectedEntaxiId] = useState(null);
  const [isProsklisisOpen, setIsProsklisisOpen] = useState(false);
  const [prosklisiProjectFilter, setProsklisiProjectFilter] = useState(null);
  const [selectedProsklisiId, setSelectedProsklisiId] = useState(null);
  const [isCreditApprovalsOpen, setIsCreditApprovalsOpen] = useState(false);
  const [creditApprovals, setCreditApprovals] = useState({});
  const [linkedEgkriseis, setLinkedEgkriseis] = useState({});
  const [egkriseisRefreshTrigger, setEgkriseisRefreshTrigger] = useState(0);
  const [isEpProgramOpen, setIsEpProgramOpen] = useState(false);
  const [isOrimanthiOpen, setIsOrimanthiOpen] = useState(false);
  const [isMeletaiOpen, setIsMeletaiOpen] = useState(false);
  const [selectedMeletiId, setSelectedMeletiId] = useState(null);
  const [meletaiRestoreScrollTop, setMeletaiRestoreScrollTop] = useState(0);
  const [meletaiBySubproject, setMeletaiBySubproject] = useState({});
  const [epSubprojectMap, setEpSubprojectMap] = useState({}); // subprojectId → epActionInfo

  const refreshEpSubprojectMap = useCallback(async () => {
    const username = currentUser?.username || '';
    if (!username) return;
    try {
      const epRes = await ipcRenderer.invoke('get-ep-subproject-link-map', { requestingUsername: username });
      if (epRes?.success) {
        setEpSubprojectMap(epRes.map || {});
      }
    } catch {
      /* non-blocking */
    }
  }, [currentUser?.username]);

  const refreshMeletaiSubprojectMap = useCallback(async () => {
    const username = currentUser?.username || '';
    if (!username) return;
    try {
      const res = await ipcRenderer.invoke('load-all-meletai', {
        actingUsername: username,
        skipMaintenance: true,
      });
      if (res?.success) {
        const map = {};
        (res.meletai || []).forEach((m) => {
          if (m.linkedSubprojectId) map[m.linkedSubprojectId] = m;
        });
        setMeletaiBySubproject(map);
      }
    } catch {
      /* non-blocking */
    }
  }, [currentUser?.username]);
  const [isDocumentTemplatesOpen, setIsDocumentTemplatesOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [batchReportResults, setBatchReportResults] = useState(null);
  const [batchPendingItems, setBatchPendingItems] = useState([]);
  const [isBatchReportOpen, setIsBatchReportOpen] = useState(false);
  const [khmdhsStaleCount, setKhmdhsStaleCount] = useState(0);
  const [khmdhsOldestDays, setKhmdhsOldestDays] = useState(null);
  const [khmdhsLastRun, setKhmdhsLastRun] = useState(null);
  const [khmdhsBatchRunning, setKhmdhsBatchRunning] = useState(false);
  const [notes, setNotes] = useState([]);
  const [notesSearch, setNotesSearch] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [noteFileCounts, setNoteFileCounts] = useState({});
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [previewFiles, setPreviewFiles] = useState([]);

  const refreshKhmdhsStaleCount = useCallback(async () => {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return;
    try {
      const res = await ipcRenderer.invoke('check-khmdhs-staleness', {
        maxAgeDays: 7,
        actingUsername: currentUser?.username,
      });
      if (res?.success) {
        setKhmdhsStaleCount(res.stale?.length || 0);
        if (res.stale?.length) {
          const ages = res.stale.map((s) => s.ageDays).filter(Boolean);
          setKhmdhsOldestDays(ages.length ? Math.max(...ages) : null);
        } else {
          setKhmdhsOldestDays(null);
        }
      }
    } catch {}
  }, [userRole, currentUser]);

  useEffect(() => {
    refreshKhmdhsStaleCount();
  }, [refreshKhmdhsStaleCount]);

  useEffect(() => {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-khmdhs-batch-report', {
          actingUsername: currentUser?.username,
        });
        if (cancelled || !res?.success || !res.state) return;
        const state = res.state;
        if (state.results) setBatchReportResults(state.results);
        const pending = Array.isArray(state.pendingItems) ? state.pendingItems : [];
        setBatchPendingItems(pending);
        if (state.lastRun) setKhmdhsLastRun(state.lastRun);
        // Αν υπάρχουν εκκρεμότητες μετά το άνοιγμα, θυμίζουμε με το πλωτό κουμπί (όχι auto-open).
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userRole, currentUser?.username]);

  const persistKhmdhsBatchReport = useCallback(async (payload) => {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return;
    try {
      await ipcRenderer.invoke('save-khmdhs-batch-report', {
        actingUsername: currentUser?.username,
        state: payload,
      });
    } catch { /* ignore */ }
  }, [userRole, currentUser?.username]);

  const clearPersistedKhmdhsBatchReport = useCallback(async () => {
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return;
    try {
      await ipcRenderer.invoke('clear-khmdhs-batch-report', {
        actingUsername: currentUser?.username,
      });
    } catch { /* ignore */ }
  }, [userRole, currentUser?.username]);

  const handleBatchResults = useCallback((results) => {
    const pending = results.interventionItems || [];
    const lastRun = {
      date: new Date().toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      refreshed: results.refreshed || 0,
    };
    const hasMeaningfulOutcome =
      (results.refreshed || 0) > 0 ||
      (results.needsIntervention || 0) > 0 ||
      (results.failed || 0) > 0;
    setBatchReportResults(results);
    setBatchPendingItems(pending);
    // Ανοίγουμε αυτόματα την αναφορά μόνο όταν πράγματι έγινε κάτι — όχι σε κενή/ακυρωμένη
    // εκτέλεση ή όταν όλα απλώς παραλείφθηκαν.
    if (hasMeaningfulOutcome) {
      setIsBatchReportOpen(true);
    }
    setKhmdhsLastRun(lastRun);
    if (pending.length > 0) {
      void persistKhmdhsBatchReport({
        results,
        pendingItems: pending,
        lastRun,
      });
    } else {
      // Χωρίς εκκρεμότητες δεν κρατάμε αναφορά μετά το κλείσιμο της εφαρμογής.
      void clearPersistedKhmdhsBatchReport();
    }
    refreshKhmdhsStaleCount();
  }, [refreshKhmdhsStaleCount, persistKhmdhsBatchReport, clearPersistedKhmdhsBatchReport]);

  const handleBatchSubprojectResolved = useCallback((subprojectId) => {
    setBatchPendingItems((prev) => {
      const resolved = prev.find((item) => item.id === subprojectId);
      const next = prev.filter((item) => item.id !== subprojectId);
      if (resolved) {
        setTimeout(() => showToast(`✓ Χαρακτηρισμός ολοκληρώθηκε: ${resolved.label}`, 'success'), 0);
        if (next.length === 0) {
          setTimeout(() => showToast('🎉 Όλοι οι εκκρεμείς χαρακτηρισμοί ολοκληρώθηκαν!', 'success'), 1200);
          setBatchReportResults(null);
          setIsBatchReportOpen(false);
          void clearPersistedKhmdhsBatchReport();
        } else {
          setBatchReportResults((prevResults) => {
            const updated = prevResults
              ? { ...prevResults, interventionItems: next, needsIntervention: next.length }
              : prevResults;
            void persistKhmdhsBatchReport({
              results: updated,
              pendingItems: next,
              lastRun: khmdhsLastRun,
            });
            return updated;
          });
        }
      }
      return next;
    });
  }, [showToast, clearPersistedKhmdhsBatchReport, persistKhmdhsBatchReport, khmdhsLastRun]);

  // Χάρτης entityId → σημειώσεις — υπολογίζεται από in-memory notes (όχι IPC/δίσκο)
  // ώστε τα stickers ενημερώνονται αμέσως μετά από αποθήκευση σημείωσης.
  const linkedNotesMap = useMemo(() => {
    const entityMap = {};
    for (const note of notes) {
      if (!note?.linkedEntities || !Array.isArray(note.linkedEntities)) continue;
      for (const link of note.linkedEntities) {
        if (!link?.id) continue;
        if (!entityMap[link.id]) entityMap[link.id] = [];
        entityMap[link.id].push({
          noteId: note.id,
          noteTitle: note.title || 'Χωρίς τίτλο',
        });
      }
    }
    return entityMap;
  }, [notes]);

  // 🚀 CACHE SYSTEM για να μην φορτώνονται τα στατιστικά κάθε φορά
  const [dataCache, setDataCache] = useState({
    projects: null,
    entaxeis: null,
    proskliseis: null,
    creditApprovals: null,
    linkedEgkriseis: null,
    lastCacheTime: null,
    needsRefresh: false
  });

  // Επαναφορά scroll μετά από κλείσιμο φόρμας/λεπτομερειών και ανανέωση λίστας (χωρίς skeleton)
  useEffect(() => {
    if (!shouldRestoreScroll.current) return undefined;
    if (isSubprojectDashboardModalOpen || loading) return undefined;
    if (!dashboardScrollRef.current || filteredProjects.length === 0) return undefined;

    const y = savedScrollPosition.current;
    const applyRestore = () => restoreDashboardScrollPosition(y);

    applyRestore();
    const t1 = setTimeout(applyRestore, 100);
    const t2 = setTimeout(applyRestore, 250);
    const t3 = setTimeout(() => {
      applyRestore();
      shouldRestoreScroll.current = false;
    }, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [
    scrollRestoreTick,
    projects,
    loading,
    isSubprojectDashboardModalOpen,
    filteredProjects.length,
    restoreDashboardScrollPosition,
  ]);

  useEffect(() => {
    loadDataWithCache();
    loadLinkedEgkriseis();

    // Listener για file watcher events - χρήση functional update για fresh state
    const handleLocksChanged = () => {
      console.log('Locks changed event received, refreshing lock status...');
      setProjects((currentProjects) => {
        if (currentProjects.length === 0) return currentProjects;
        refreshProjectsLockStatus(ipcRenderer, currentProjects)
          .then((updated) => {
            const hasChanges = updated.some((p) => {
              const prev = currentProjects.find((x) => x.subprojectId === p.subprojectId);
              return prev && (prev.isLocked !== p.isLocked || (prev.lockedBy || '') !== (p.lockedBy || ''));
            });
            if (hasChanges) {
              setProjects(sortProjectsForDisplay(updated));
            }
          })
          .catch((error) => {
            console.error('Error updating lock status:', error);
          });
        return currentProjects;
      });
    };

    // Εγγραφή στο event
    const unsubscribe = ipcRenderer.on('locks-changed', handleLocksChanged);

    return () => {
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load linked egkriseis only once when component mounts
  useEffect(() => {
    loadLinkedEgkriseis();
  }, []); // Load only once on mount to avoid unnecessary re-renders

  // Φόρτωση επιλεγμένων υποέργων πύλης (όταν η υπηρεσία είναι ενεργή)
  useEffect(() => {
    if (!portalEnabled) {
      setPublishedSubprojectIds(new Set());
      return;
    }
    ipcRenderer.invoke('load-portal-published').then((res) => {
      if (res?.success && Array.isArray(res.data?.subprojectIds)) {
        setPublishedSubprojectIds(new Set(res.data.subprojectIds));
      }
    }).catch(() => {});
  }, [portalEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load notes from file on mount
  const notesLoadedRef = useRef(false);
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const data = await ipcRenderer.invoke('load-notes');
        if (data && data.notes && Array.isArray(data.notes)) {
          setNotes(data.notes);
        }
      } catch (error) {
        console.error('Error loading notes from file:', error);
      } finally {
        notesLoadedRef.current = true;
      }
    };
    loadNotes();
  }, []);

  // Save notes to file whenever they change (with debounce)
  const saveNotesTimeoutRef = useRef(null);
  useEffect(() => {
    if (!notesLoadedRef.current) return;

    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }
    
    saveNotesTimeoutRef.current = setTimeout(async () => {
      try {
        await ipcRenderer.invoke('save-notes', {
          notes,
          groups: []
        });
      } catch (error) {
        console.error('Error saving notes to file:', error);
      }
    }, 500);
    
    return () => {
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current);
      }
    };
  }, [notes]);

  useEffect(() => {
    setFilteredProjects(projects.filter(
      (p) => p.projectStatus !== 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ' && !isAbandonedSubproject(p)
    ));
  }, [projects]);


  // Debounce για quickSearchText - αποφυγή συνεχών κλήσεων applyFilters
  const debounceTimeoutRef = useRef(null);
  const [debouncedQuickSearchText, setDebouncedQuickSearchText] = useState('');
  const quickSearchInputRef = useRef(null);

  useEffect(() => {
    // Καθαρισμός του προηγούμενου timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Νέο timeout για debounce (300ms)
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuickSearchText(quickSearchText);
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [quickSearchText]);

  // Helper function to parse Greek amounts
  const parseGreekAmount = (amountStr) => {
    if (!amountStr || amountStr === '') return 0;
    return parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Helper function to compare dates
  const isDateInRange = (dateStr, fromDate, toDate) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate)) return false;
    return true;
  };

  // Count active filters
  const countActiveFilters = useCallback((filters) => {
    let count = 0;
    if (filters.projectTitle) count++;
    if (filters.subprojectTitle) count++;
    if (filters.kaCode) count++;
    if (filters.misPraxhsCode) count++;
    if (filters.supervisor && filters.supervisor.length > 0) count++;
    if (filters.projectType && filters.projectType.length > 0) count++;
    if (filters.fundingSource && filters.fundingSource.length > 0) count++;
    if (filters.fundingDetails && filters.fundingDetails.length > 0) count++;
    if (filters.projectStatus && filters.projectStatus.length > 0) count++;
    if (filters.implementationForm && filters.implementationForm.length > 0) count++;
    if (filters.characterization) count++;
    if (filters.hasSupplementaryContracts) count++;
    if (filters.contractsCount) count++;
    if (filters.hasEgkriseisDialthesisPistosis) count++;
    if (filters.hasProsklisiLink) count++;
    if (filters.hasEntaxiLink) count++;
    if (filters.hasEisigitikiEkthesi) count++;
    if (filters.remainingYear) count++;
    if (filters.contractDateFrom || filters.contractDateTo) count++;
    if (filters.contractProcessDateFrom || filters.contractProcessDateTo) count++;
    if (filters.approvedAmountMin || filters.approvedAmountMax) count++;
    if (filters.contractAmountMin || filters.contractAmountMax) count++;
    if (filters.apeAmountMin || filters.apeAmountMax) count++;
    if (filters.anadoxosName) count++;
    if (filters.anadoxosVat) count++;
    if (filters.assignmentProcedure && filters.assignmentProcedure.length > 0) count++;
    if (filters.hasAssignmentProcedure) count++;
    if (filters.khmdhsDeadlineFilter) count++;
    return count;
  }, []);

  // Memoized applyFilters with advanced filtering and sorting
  const applyFilters = useCallback((filters) => {
    const performFiltering = () => {
      let filtered = [...visibleProjects];

      // Quick Search - text search in all fields
      if (debouncedQuickSearchText) {
        filtered = filtered.filter(p => {
          const aleCodesMatch = (p.aleCodes && Array.isArray(p.aleCodes) && 
            p.aleCodes.some(code => containsSearchTerm(code, debouncedQuickSearchText))) ||
            containsSearchTerm(p.aleCode, debouncedQuickSearchText);
          
          return containsSearchTerm(p.projectTitle, debouncedQuickSearchText) ||
            containsSearchTerm(p.subprojectTitle, debouncedQuickSearchText) ||
            containsSearchTerm(p.kaCode, debouncedQuickSearchText) ||
            aleCodesMatch ||
            containsSearchTerm(getProjectChargeSearchText(p, engineerCatalogForCards), debouncedQuickSearchText) ||
            containsSearchTerm(getProjectKhmdhsSearchText(p), debouncedQuickSearchText);
        });
      }

      // Quick Search - status filter
      if (quickSearchStatus) {
        filtered = filtered.filter(p => p.projectStatus === quickSearchStatus);
      }

      // Quick Search - project type filter
      if (quickSearchType) {
        filtered = filtered.filter((p) => normalizeProjectType(p.projectType) === quickSearchType);
      }

      // Advanced Filters
      if (filters.projectTitle) {
        filtered = filtered.filter(p => containsSearchTerm(p.projectTitle, filters.projectTitle));
      }

      if (filters.subprojectTitle) {
        filtered = filtered.filter(p => containsSearchTerm(p.subprojectTitle, filters.subprojectTitle));
      }

      if (filters.kaCode) {
        filtered = filtered.filter(p => containsSearchTerm(p.kaCode, filters.kaCode));
      }

      if (filters.aleCode) {
        filtered = filtered.filter(p => {
          if (p.aleCodes && Array.isArray(p.aleCodes)) {
            return p.aleCodes.some(code => containsSearchTerm(code, filters.aleCode));
          }
          return containsSearchTerm(p.aleCode, filters.aleCode);
        });
      }

      if (filters.misPraxhsCode) {
        filtered = filtered.filter(p => containsSearchTerm(p.misPraxhsCode, filters.misPraxhsCode));
      }

      if (filters.supervisor && filters.supervisor.length > 0) {
        filtered = filtered.filter((p) => projectMatchesChargeFilters(p, filters.supervisor));
      }

      if (filters.anadoxosName || filters.anadoxosVat) {
        filtered = filtered.filter((p) =>
          projectMatchesKhmdhsAnadoxosFilters(p, {
            anadoxosName: filters.anadoxosName,
            anadoxosVat: filters.anadoxosVat
          })
        );
      }

      if (filters.projectType && filters.projectType.length > 0) {
        filtered = filtered.filter((p) =>
          filters.projectType.includes(normalizeProjectType(p.projectType))
        );
      }

      if (filters.fundingSource && filters.fundingSource.length > 0) {
        filtered = filtered.filter(p => filters.fundingSource.includes(p.fundingSource));
      }

      if (filters.fundingDetails && filters.fundingDetails.length > 0) {
        filtered = filtered.filter(p => 
          p.fundingDetails && filters.fundingDetails.includes(p.fundingDetails)
        );
      }

      if (filters.projectStatus && filters.projectStatus.length > 0) {
        filtered = filtered.filter(p => filters.projectStatus.includes(p.projectStatus));
      }

      if (filters.implementationForm && filters.implementationForm.length > 0) {
        filtered = filtered.filter(p => filters.implementationForm.includes(p.implementationForm));
      }

      if (filters.assignmentProcedure && filters.assignmentProcedure.length > 0) {
        filtered = filtered.filter((p) => filters.assignmentProcedure.includes(getProjectAssignmentProcedure(p)));
      }

      if (filters.hasAssignmentProcedure === 'yes') {
        filtered = filtered.filter((p) => !!getProjectAssignmentProcedure(p));
      } else if (filters.hasAssignmentProcedure === 'no') {
        filtered = filtered.filter((p) =>
          statusShowsAssignmentProcedure(p.projectStatus)
            && !getProjectAssignmentProcedure(p)
        );
      }

      if (filters.khmdhsDeadlineFilter) {
        filtered = filtered.filter((p) =>
          matchesKhmdhsDeadlineFilter(p, filters.khmdhsDeadlineFilter)
        );
      }

      if (filters.characterization) {
        filtered = filtered.filter(p => getCharacterization(p) === filters.characterization);
      }

      // Boolean filters
      if (filters.hasSupplementaryContracts === 'yes') {
        filtered = filtered.filter(p => p.hasSupplementaryContracts === true);
      } else if (filters.hasSupplementaryContracts === 'no') {
        filtered = filtered.filter(p => !p.hasSupplementaryContracts);
      }

      if (filters.contractsCount) {
        if (filters.contractsCount === '0') {
          filtered = filtered.filter(p => !p.contracts || p.contracts.length === 0);
        } else if (filters.contractsCount === '1') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length === 1);
        } else if (filters.contractsCount === '2') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length === 2);
        } else if (filters.contractsCount === '3+') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length >= 3);
        }
      }

      // Egkriseis filter - check if button exists (via egkrisiLinks)
      if (filters.hasEgkriseisDialthesisPistosis === 'yes') {
        filtered = filtered.filter(p => p.hasEgkrisiLink === true);
      } else if (filters.hasEgkriseisDialthesisPistosis === 'no') {
        filtered = filtered.filter(p => !p.hasEgkrisiLink);
      }

      // Prosklisi link filter
      if (filters.hasProsklisiLink === 'yes') {
        filtered = filtered.filter(p => p.hasProsklisiLink === true);
      } else if (filters.hasProsklisiLink === 'no') {
        filtered = filtered.filter(p => !p.hasProsklisiLink);
      }

      // Entaxi link filter
      if (filters.hasEntaxiLink === 'yes') {
        filtered = filtered.filter(p => p.hasEntaxiLink === true);
      } else if (filters.hasEntaxiLink === 'no') {
        filtered = filtered.filter(p => !p.hasEntaxiLink);
      }

      if (filters.hasEisigitikiEkthesi === 'yes') {
        filtered = filtered.filter(p => p.eisigitikiEkthesi && p.eisigitikiEkthesi.trim().length > 0);
      } else if (filters.hasEisigitikiEkthesi === 'no') {
        filtered = filtered.filter(p => !p.eisigitikiEkthesi || p.eisigitikiEkthesi.trim().length === 0);
      }

      // Comments filters
      if (filters.hasComments === 'yes') {
        filtered = filtered.filter(p => p.comments && p.comments.trim().length > 0);
      } else if (filters.hasComments === 'no') {
        filtered = filtered.filter(p => !p.comments || p.comments.trim().length === 0);
      }

      if (filters.hasApeComments === 'yes') {
        filtered = filtered.filter(p => p.apeComments && p.apeComments.trim().length > 0);
      } else if (filters.hasApeComments === 'no') {
        filtered = filtered.filter(p => !p.apeComments || p.apeComments.trim().length === 0);
      }

      if (filters.hasRemainingComments === 'yes') {
        filtered = filtered.filter(p => p.remainingComments && p.remainingComments.trim().length > 0);
      } else if (filters.hasRemainingComments === 'no') {
        filtered = filtered.filter(p => !p.remainingComments || p.remainingComments.trim().length === 0);
      }

      // Remaining amounts filter
      if (filters.remainingYear) {
        filtered = filtered.filter(p => {
          if (!p.remainingAmountsByYear || !Array.isArray(p.remainingAmountsByYear)) {
            // Αν δεν έχει το πεδίο, θεωρείται ως κενό
            return filters.remainingAmountCondition === 'zeroOrEmpty';
          }
          
          const yearEntry = p.remainingAmountsByYear.find(item => item.year === filters.remainingYear);
          
          if (!yearEntry) {
            // Αν δεν υπάρχει entry για το έτος, θεωρείται ως κενό
            return filters.remainingAmountCondition === 'zeroOrEmpty' || filters.remainingAmountCondition === 'all';
          }
          
          const amountStr = yearEntry.amount || '';
          const amount = parseGreekAmount(amountStr);
          
          if (filters.remainingAmountCondition === 'hasAmount') {
            return amount > 0;
          } else if (filters.remainingAmountCondition === 'zeroOrEmpty') {
            return amount === 0 || amountStr.trim() === '';
          }
          return true; // 'all'
        });
      }

      // Date range filters
      if (filters.contractDateFrom || filters.contractDateTo) {
        filtered = filtered.filter(p => 
          isDateInRange(p.contractDate, filters.contractDateFrom, filters.contractDateTo)
        );
      }

      if (filters.contractProcessDateFrom || filters.contractProcessDateTo) {
        filtered = filtered.filter(p => 
          isDateInRange(p.contractProcessStartDate, filters.contractProcessDateFrom, filters.contractProcessDateTo)
        );
      }

      // Amount range filters
      if (filters.approvedAmountMin) {
        const min = parseGreekAmount(filters.approvedAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.approvedAmount) >= min);
      }

      if (filters.approvedAmountMax) {
        const max = parseGreekAmount(filters.approvedAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.approvedAmount) <= max);
      }

      if (filters.contractAmountMin) {
        const min = parseGreekAmount(filters.contractAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.contractAmount) >= min);
      }

      if (filters.contractAmountMax) {
        const max = parseGreekAmount(filters.contractAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.contractAmount) <= max);
      }

      if (filters.apeAmountMin) {
        const min = parseGreekAmount(filters.apeAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.apeAmount) >= min);
      }

      if (filters.apeAmountMax) {
        const max = parseGreekAmount(filters.apeAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.apeAmount) <= max);
      }

      // SORTING
      if (filters.sortBy) {
        filtered.sort((a, b) => {
          let aVal, bVal;

          switch (filters.sortBy) {
            case 'kaCode':
              aVal = a.kaCode || '';
              bVal = b.kaCode || '';
              break;
            case 'aleCode':
              aVal = (a.aleCodes && a.aleCodes.length > 0) ? a.aleCodes.join(' ') : (a.aleCode || '');
              bVal = (b.aleCodes && b.aleCodes.length > 0) ? b.aleCodes.join(' ') : (b.aleCode || '');
              break;
            case 'projectTitle':
              aVal = a.projectTitle || '';
              bVal = b.projectTitle || '';
              break;
            case 'subprojectTitle':
              aVal = a.subprojectTitle || '';
              bVal = b.subprojectTitle || '';
              break;
            case 'approvedAmount':
              aVal = parseGreekAmount(a.approvedAmount);
              bVal = parseGreekAmount(b.approvedAmount);
              break;
            case 'contractAmount':
              aVal = parseGreekAmount(a.contractAmount);
              bVal = parseGreekAmount(b.contractAmount);
              break;
            case 'apeAmount':
              aVal = parseGreekAmount(a.apeAmount);
              bVal = parseGreekAmount(b.apeAmount);
              break;
            case 'contractDate':
              aVal = a.contractDate ? new Date(a.contractDate).getTime() : 0;
              bVal = b.contractDate ? new Date(b.contractDate).getTime() : 0;
              break;
            case 'contractProcessStartDate':
              aVal = a.contractProcessStartDate ? new Date(a.contractProcessStartDate).getTime() : 0;
              bVal = b.contractProcessStartDate ? new Date(b.contractProcessStartDate).getTime() : 0;
              break;
            case 'projectStatus':
              aVal = a.projectStatus || '';
              bVal = b.projectStatus || '';
              break;
            case 'chargeTo':
              aVal = getProjectChargeSearchText(a, engineerCatalogForCards) || '';
              bVal = getProjectChargeSearchText(b, engineerCatalogForCards) || '';
              break;
            default:
              aVal = a.kaCode || '';
              bVal = b.kaCode || '';
          }

          // Comparison
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const comparison = aVal.localeCompare(bVal, 'el');
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          } else {
            const comparison = aVal - bVal;
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          }
        });
      }

      // Εξαίρεση αρχειοθετημένων / απενταγμένων από την κανονική προβολή
      const ARCHIVED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';
      const userExplicitlyFilteredByArchived =
        (filters.projectStatus && filters.projectStatus.includes(ARCHIVED_STATUS)) ||
        quickSearchStatus === ARCHIVED_STATUS;
      const userExplicitlyFilteredByAbandoned =
        (filters.projectStatus && filters.projectStatus.includes(PROJECT_STATUS_ABANDONED)) ||
        quickSearchStatus === PROJECT_STATUS_ABANDONED;

      if (showArchivedProjects) {
        // Εμφάνιση ΜΟΝΟ αρχειοθετημένων
        filtered = filtered.filter(p => p.projectStatus === ARCHIVED_STATUS);
      } else if (!userExplicitlyFilteredByArchived) {
        // Απόκρυψη αρχειοθετημένων από την κανονική λίστα
        filtered = filtered.filter(p => p.projectStatus !== ARCHIVED_STATUS);
      }

      if (!userExplicitlyFilteredByAbandoned) {
        filtered = filtered.filter(p => !isAbandonedSubproject(p));
      }

      setFilteredProjects(filtered);
    };

    setTimeout(performFiltering, 0);
  }, [visibleProjects, debouncedQuickSearchText, quickSearchStatus, quickSearchType, showArchivedProjects, engineerCatalogForCards]);

  // Apply filters when dependencies change
  const applyFiltersTimeoutRef = useRef(null);
  useEffect(() => {
    if (applyFiltersTimeoutRef.current) {
      clearTimeout(applyFiltersTimeoutRef.current);
    }

    applyFiltersTimeoutRef.current = setTimeout(() => {
      applyFilters(advancedFilters);
    }, 0);

    return () => {
      if (applyFiltersTimeoutRef.current) {
        clearTimeout(applyFiltersTimeoutRef.current);
      }
    };
  }, [debouncedQuickSearchText, quickSearchStatus, quickSearchType, advancedFilters, applyFilters, showArchivedProjects]);

  // Realtime lock monitoring - αθόρυβος έλεγχος με βελτιστοποίηση
  useEffect(() => {
    // Χρήση ref για να αποφύγουμε stale closures
    let isActive = true;
    let timeoutId = null;
    let intervalId = null;
    
    const checkLocks = () => {
      if (!isActive) return;
      setLoading((currentLoading) => {
        if (currentLoading) return currentLoading;
        setProjects((currentProjects) => {
          if (currentProjects.length === 0) return currentProjects;
          refreshProjectsLockStatus(ipcRenderer, currentProjects)
            .then((updated) => {
              if (!isActive) return;
              const hasChanges = updated.some((p) => {
                const prev = currentProjects.find((x) => x.subprojectId === p.subprojectId);
                return prev && (prev.isLocked !== p.isLocked || (prev.lockedBy || '') !== (p.lockedBy || ''));
              });
              if (hasChanges) {
                setProjects(sortProjectsForDisplay(updated));
              }
            })
            .catch((error) => {
              console.error('Error checking lock status:', error);
            });
          return currentProjects;
        });
        return currentLoading;
      });
    };

    timeoutId = setTimeout(() => {
      checkLocks();
      intervalId = setInterval(() => {
        if (isActive) checkLocks();
      }, LOCK_POLL_INTERVAL_MS);
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty deps - uses functional updates


  // 🚀 ΚΕΝΤΡΙΚΗ FUNCTION ΜΕ CACHE - Φορτώνει δεδομένα μόνο αν χρειάζεται - NON-BLOCKING
  const loadDataWithCache = async (forceRefresh = false, options = {}) => {
    const silent = options.silent === true;
    const myRequestId = ++loadRequestIdRef.current;
    try {
      // Χρήση setTimeout για να μην μπλοκάρει το UI thread
      await new Promise(resolve => setTimeout(resolve, 0));

      // Bail out if a newer load request has already started
      if (loadRequestIdRef.current !== myRequestId) return;
      
      if (!silent) {
        setLoading(true);
      }
      console.log('🔄 Loading data with cache...');
      
      // Αν είναι force refresh, καθάρισε το cache ΠΡΙΝ τον έλεγχο
      if (forceRefresh) {
        console.log('🔄 Force refresh - clearing cache completely...');
        setDataCache({
          projects: null,
          entaxeis: null,
          proskliseis: null,
          creditApprovals: null,
          linkedEgkriseis: null,
          lastCacheTime: null,
          needsRefresh: true
        });
      }
      
      // Έλεγχος αν χρειάζεται refresh
      const now = Date.now();
      const cacheExpiry = 5 * 60 * 1000; // 5 λεπτά cache
      const hasValidCache = dataCache.lastCacheTime && 
                           (now - dataCache.lastCacheTime) < cacheExpiry && 
                           !dataCache.needsRefresh && 
                           !forceRefresh;
      
      if (hasValidCache && dataCache.projects) {
        console.log('✅ Using cached data - no reload needed!');
        setProjects(dataCache.projects);
        setEntaxeis(dataCache.entaxeis || []);
        setProskliseis(dataCache.proskliseis || []);
        setCreditApprovals(dataCache.creditApprovals || {});
        setLinkedEgkriseis(dataCache.linkedEgkriseis || {});
        if (!silent) {
          setLoading(false);
        }
        return;
      }
      
      console.log('🔄 Cache miss or expired - loading fresh data...');
      
      // Batch processing για lock checks - μειώνει το blocking
      const [
        loadedProjects,
        loadedEntaxeis, 
        loadedProskliseis,
        loadedCreditApprovals,
        loadedLinkedEgkriseis
      ] = await Promise.all([
        ipcRenderer.invoke('load-all-projects'),
        ipcRenderer.invoke('load-all-entaxeis'),
        ipcRenderer.invoke('load-all-proskliseis'),
        ipcRenderer.invoke('load-egkriseis-data'),
        ipcRenderer.invoke('load-egkrisi-links')
      ]);
      
      refreshEpSubprojectMap();
      refreshMeletaiSubprojectMap();
      if (currentUser?.username) {
        void ipcRenderer.invoke('run-meletai-maintenance', {
          actingUsername: currentUser.username,
        }).then(() => refreshMeletaiSubprojectMap());
      }

      // Φόρτωμα prosklisi links - ΠΕΡΙΜΕΝΟΥΜΕ
      const prosklisiLinksResult = await ipcRenderer.invoke('load-subproject-links').catch((err) => {
        console.error('Error loading prosklisi links:', err);
        return { success: false, data: {} };
      });
      const prosklisiLinksSet = new Set();
      if (prosklisiLinksResult.success && prosklisiLinksResult.data) {
        console.log('🔗 Prosklisi links data:', Object.keys(prosklisiLinksResult.data).length, 'links');
        Object.values(prosklisiLinksResult.data).forEach(link => {
          if (link.sourceSubprojectId) prosklisiLinksSet.add(link.sourceSubprojectId);
          if (link.targetSubprojectId) prosklisiLinksSet.add(link.targetSubprojectId);
        });
      }
      
      // Convert egkrisi link data to Set - ΟΛΕΣ οι συσχετίσεις (manual ΚΑΙ auto)
      const linkedEgkriseisData = loadedLinkedEgkriseis.success && loadedLinkedEgkriseis.data ? loadedLinkedEgkriseis.data : {};
      console.log('✅ Egkrisi links data:', Object.keys(linkedEgkriseisData).length, 'links');
      console.log('Sample egkrisi links:', Object.values(linkedEgkriseisData).slice(0, 3));
      
      const egkrisiLinksSet = new Set(
        Object.values(linkedEgkriseisData).map(link => link.subprojectId).filter(id => id)
      );
      
      const entaxiLinksMap = new Map();
      loadedEntaxeis.forEach(entaxi => {
        if (entaxi.subprojectIds && Array.isArray(entaxi.subprojectIds)) {
          entaxi.subprojectIds.forEach(subId => {
            entaxiLinksMap.set(subId, true);
          });
        }
      });
      
      console.log(`📊 FINAL TOTALS: ${egkrisiLinksSet.size} egkrisi, ${prosklisiLinksSet.size} prosklisi, ${entaxiLinksMap.size} entaxi`);

      const sortedProjects = sortProjectsForDisplay(
        enrichProjectsFromLoad(loadedProjects, { egkrisiLinksSet, prosklisiLinksSet, entaxiLinksMap })
      );
      
      // Process credit approvals
      let approvals = {};
      if (loadedCreditApprovals.success && loadedCreditApprovals.data && loadedCreditApprovals.data.projects) {
        Object.values(loadedCreditApprovals.data.projects).forEach(project => {
          if (project.modifications && project.modifications.length > 0) {
            const key = `${project.title}-${project.title}`;
            approvals[key] = true;
          }
          if (project.subprojects) {
            Object.values(project.subprojects).forEach(subproject => {
              if (subproject.pdfs && subproject.pdfs.length > 0) {
                const key = `${project.title}-${subproject.title}`;
                approvals[key] = true;
              }
            });
          }
        });
      }
      
      // Bail out if a newer load request superseded us while we were awaiting IPC calls
      if (loadRequestIdRef.current !== myRequestId) return;

      // Update all states directly — no rAF delay needed; React batches these in the same flush
      setProjects(sortedProjects);
      setEntaxeis(loadedEntaxeis || []);
      setProskliseis(loadedProskliseis || []);
      setCreditApprovals(approvals);
      setLinkedEgkriseis(linkedEgkriseisData);

      // Update cache with fresh data
      setDataCache({
        projects: sortedProjects,
        entaxeis: loadedEntaxeis || [],
        proskliseis: loadedProskliseis || [],
        creditApprovals: approvals,
        linkedEgkriseis: linkedEgkriseisData,
        lastCacheTime: now,
        needsRefresh: false
      });

      if (!silent) {
        setLoading(false);
      }
      
    } catch (error) {
      console.error('Error in loadDataWithCache:', error);
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Invalidate cache όταν δημιουργείται/επεξεργάζεται υποέργο
  const invalidateCache = () => {
    console.log('🗑️ Cache invalidated - next load will be fresh');
    setDataCache(prev => ({ ...prev, needsRefresh: true }));
  };

  const loadEngineerCatalogForCards = useCallback(async () => {
    try {
      const res = await ipcRenderer.invoke('get-registered-engineers');
      if (res?.success && Array.isArray(res.engineers)) {
        setEngineerCatalogForCards(res.engineers);
      } else {
        setEngineerCatalogForCards([]);
      }
    } catch {
      setEngineerCatalogForCards([]);
    }
  }, []);

  useEffect(() => {
    loadEngineerCatalogForCards();
  }, [loadEngineerCatalogForCards]);

  const loadProjects = async () => {
    const myRequestId = ++loadProjectsRequestIdRef.current;
    try {
      // Πρώτα καθάρισε τα κολλημένα locks
      try {
        const clearResult = await ipcRenderer.invoke('clear-all-locks');
        if (clearResult.success && clearResult.clearedCount > 0) {
          console.log(`Cleared ${clearResult.clearedCount} stale locks`);
        }
      } catch (clearError) {
        console.error('Error clearing locks:', clearError);
      }
      
      // Αυτόματη συσχέτιση αφαιρέθηκε - χρησιμοποιείται μόνο χειροκίνητη συσχέτιση
      
      const [
        loadedProjects,
        loadedLinkedEgkriseis,
        loadedEntaxeis,
        prosklisiLinksResult,
        loadedProskliseis
      ] = await Promise.all([
        ipcRenderer.invoke('load-all-projects'),
        ipcRenderer.invoke('load-egkrisi-links'),
        ipcRenderer.invoke('load-all-entaxeis').catch(() => []),
        ipcRenderer.invoke('load-subproject-links').catch(() => ({ success: false, data: {} })),
        ipcRenderer.invoke('load-all-proskliseis').catch(() => [])
      ]);
      
      // Prosklisi links Set
      const prosklisiLinksSet = new Set();
      if (prosklisiLinksResult.success && prosklisiLinksResult.data) {
        Object.values(prosklisiLinksResult.data).forEach(link => {
          if (link.sourceSubprojectId) prosklisiLinksSet.add(link.sourceSubprojectId);
          if (link.targetSubprojectId) prosklisiLinksSet.add(link.targetSubprojectId);
        });
      }
      
      // Convert to Sets για γρήγορο lookup
      const linkedEgkriseisData = loadedLinkedEgkriseis.success && loadedLinkedEgkriseis.data ? loadedLinkedEgkriseis.data : {};
      const egkrisiLinksSet = new Set(
        Object.values(linkedEgkriseisData).map(link => link.subprojectId).filter(id => id)
      );
      
      const entaxiLinksMap = new Map();
      loadedEntaxeis.forEach(entaxi => {
        if (entaxi.subprojectIds && Array.isArray(entaxi.subprojectIds)) {
          entaxi.subprojectIds.forEach(subId => {
            entaxiLinksMap.set(subId, true);
          });
        }
      });
      
      console.log(`📊 loadProjects: ${egkrisiLinksSet.size} egkrisi, ${prosklisiLinksSet.size} prosklisi, ${entaxiLinksMap.size} entaxi`);

      const sortedProjects = sortProjectsForDisplay(
        enrichProjectsFromLoad(loadedProjects, { egkrisiLinksSet, prosklisiLinksSet, entaxiLinksMap })
      );
      
      // Bail out if a newer loadProjects superseded us while awaiting IPC calls
      if (loadProjectsRequestIdRef.current !== myRequestId) return;

      setProjects(sortedProjects);
      setProskliseis(loadedProskliseis || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };


  const loadLinkedEgkriseis = async () => {
    try {
      const result = await ipcRenderer.invoke('load-egkrisi-links');
      
      if (result.success && result.data) {
        setLinkedEgkriseis(result.data);
      }
    } catch (error) {
      console.error('Error loading linked egkriseis:', error);
    }
  };


  // Helper function to normalize text for comparison
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')   // Replace literal \n with space (from JSON)
      .replace(/\n/g, ' ')    // Replace actual newlines with space
      .replace(/\r/g, ' ')    // Replace carriage returns
      .replace(/\t/g, ' ')    // Replace tabs
      .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
      .trim()                 // Remove leading/trailing spaces
      .toLowerCase();         // Case insensitive
  };

  // Function to check if a subproject has credit approval
  const hasCreditApproval = (projectTitle, subprojectTitle, subprojectId) => {
    if (!subprojectTitle) return false;
    
    // ΠΡΩΤΑ: Ελέγχουμε αν υπάρχει χειροκίνητη συσχέτιση (linkedEgkriseis)
    if (subprojectId && linkedEgkriseis) {
      const hasManualLink = Object.values(linkedEgkriseis).some(link => 
        link && link.subprojectId === subprojectId
      );
      if (hasManualLink) {
        return true;
      }
    }
    
    // ΔΕΥΤΕΡΑ: Ελέγχουμε τις ΑΥΤΟΜΑΤΕΣ συσχετίσεις από linkedEgkriseis (νέα λογική)
    if (subprojectTitle && linkedEgkriseis) {
      const normalizedSubprojectTitle = normalizeText(subprojectTitle);
      
      const hasAutoLink = Object.values(linkedEgkriseis).some(link => {
        if (!link || !link.autoLinked) return false;
        
        const normalizedLinkTitle = normalizeText(link.subprojectTitle || '');
        return normalizedSubprojectTitle === normalizedLinkTitle;
      });
      
      if (hasAutoLink) {
        return true;
      }
    }
    
    // ΤΡΙΤΑ: Ελέγχουμε τις συσχετίσεις από creditApprovals (παλιά λογική για συμβατότητα)
    const normalizedSubprojectTitle = normalizeText(subprojectTitle);
    
    // Πρώτα ψάχνουμε με το παλιό κλειδί (συμβατότητα)
    const oldKey = `${projectTitle}-${subprojectTitle}`;
    if (creditApprovals[oldKey]) {
      return true;
    }
    
    // Στη συνέχεια ψάχνουμε με fuzzy matching
    for (const [approvalKey, approvalValue] of Object.entries(creditApprovals)) {
      if (!approvalValue) continue;
      
      // Extract το τμήμα μετά το τελευταίο "-" (που είναι ο τίτλος υποέργου)
      const keyParts = approvalKey.split('-');
      if (keyParts.length < 2) continue;
      
      const approvalSubprojectTitle = keyParts.slice(1).join('-'); // Πάρε όλα μετά το πρώτο "-"
      const normalizedApprovalTitle = normalizeText(approvalSubprojectTitle);
      
      if (normalizedSubprojectTitle === normalizedApprovalTitle) {
        return true;
      }
    }
    
    return false;
  };

  // Function to check if a subproject has linked egkrisi
  const hasLinkedEgkrisi = (subprojectId, subprojectTitle) => {
    if (!subprojectId || !linkedEgkriseis) {
      return false;
    }
    
    
    // Ελέγχουμε αν κάποια έγκριση είναι συσχετισμένη με αυτό το υποέργο
    // Ελέγχουμε ΤΟΥΣ ΔΥΟ: subprojectId (UUID) ΚΑΙ subprojectTitle για ακριβή ταίριασμα
    // Αυτό αποφεύγει λάθος links που έχουν σωστό subprojectId αλλά λάθος τίτλο
    const hasLink = Object.values(linkedEgkriseis).some(link => {
      if (!link) return false;
      
      // ΠΡΩΤΑ: Ελέγχουμε το subprojectId (UUID) - πρέπει να ταιριάζει
      if (link.subprojectId !== subprojectId) {
        return false;
      }
      
      // ΔΕΥΤΕΡΟ: Ελέγχουμε και τον τίτλο - αλλά με πιο ευέλικτο τρόπο
      // Το subprojectId είναι το πιο σημαντικό - αν ταιριάζει, το link είναι έγκυρο
      // Ο τίτλος μπορεί να έχει μικρές διαφορές (π.χ. case, whitespace) αλλά το subprojectId είναι μοναδικό
      // Αν το subprojectId ταιριάζει, το link είναι έγκυρο
      // Το subprojectId (UUID) είναι το πιο σημαντικό - είναι μοναδικό και αξιόπιστο
      // Ο τίτλος μπορεί να έχει μικρές διαφορές (π.χ. case, whitespace, punctuation)
      // αλλά το subprojectId είναι πάντα σωστό
      return true; // Το subprojectId ταιριάζει, οπότε το link είναι έγκυρο
    });
    
    return hasLink;
  };

  // 🔗 ΧΕΙΡΟΚΙΝΗΤΗ ΣΥΣΧΕΤΙΣΗ ΕΓΚΡΙΣΗΣ

  const loadEntaxeis = async () => {
    try {
      const loadedEntaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      setEntaxeis(loadedEntaxeis || []);
    } catch (error) {
      console.error('Error loading entaxeis:', error);
    }
  };


  // Helper function to find linked prosklisi for a subproject
  const findLinkedProsklisi = (subprojectId, projectTitle) => {
    // Find prosklisi that matches the subproject ID
    const matchingProsklisi = proskliseis.find(prosklisi => {
      // Check if prosklisi is linked to this specific subproject
      return prosklisi.linkedSubprojectId === subprojectId;
    });
    
    return matchingProsklisi || null;
  };

  const handleSaveProject = async (projectData) => {
    try {
      console.log('🔄 Dashboard handleSaveProject called with:', {
        projectId: projectData.projectId,
        projectTitle: projectData.projectTitle,
        isEditing: !!editingProject
      });
      
      // Η λογική ελέγχου τίτλου έχει μεταφερθεί στο ProjectForm.js
      // Εδώ απλά αποθηκεύουμε τα δεδομένα όπως τα έλαβε
      
      const { keepFormOpen, files, ...dataForSave } = projectData;
      const result = await ipcRenderer.invoke('save-project-data', dataForSave);
      
      if (result.success) {
        // Save files if any
        if (files && files.length > 0) {
          await ipcRenderer.invoke('save-files', files, result.projectId, result.subprojectId);
        }

        const shouldKeepFormOpen = keepFormOpen === true;

        // Ξεκλείδωμα του έργου μετά την επιτυχή αποθήκευση (μόνο όταν κλείνει η φόρμα)
        if (!shouldKeepFormOpen && editingProject && editingProject.projectId) {
          await ipcRenderer.invoke('unlock-project', editingProject.projectId);
        }

        // Διατήρηση scroll — όχι ανάγνωση από container όσο το modal είναι ανοιχτό (scrollTop ≈ 0)
        const scrollY = dashboardScrollBeforeModalRef.current ?? savedScrollPosition.current;
        savedScrollPosition.current = scrollY;

        invalidateCache();
        shouldRestoreScroll.current = true;
        setScrollRestoreTick((t) => t + 1);

        // silent: κρατάμε τη λίστα ορατή πίσω από τη φόρμα — το skeleton μηδενίζει το scroll
        await loadDataWithCache(true, { silent: true });
        await loadEngineerCatalogForCards();

        if (shouldKeepFormOpen) {
          setEditingProject({
            ...dataForSave,
            projectId: result.projectId,
            subprojectId: result.subprojectId,
          });
          return {
            success: true,
            projectId: result.projectId,
            subprojectId: result.subprojectId,
          };
        }

        setIsFormOpen(false);
        setEditingProject(null);
        return { success: true, projectId: result.projectId, subprojectId: result.subprojectId };
      } else {
        console.error('Error saving project:', result.error);
        showToast('Σφάλμα αποθήκευσης: ' + result.error, 'error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving project:', error);
      showToast('Σφάλμα αποθήκευσης: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  };

  
  // Advanced filters handlers
  const handleApplyAdvancedFilters = useCallback((filters) => {
    setAdvancedFilters(filters);
  }, []);

  const handleClearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({
      projectTitle: '',
      subprojectTitle: '',
      kaCode: '',
      supervisor: [],
      projectType: [],
      fundingSource: [],
      fundingDetails: [],
      projectStatus: [],
      implementationForm: [],
      hasSupplementaryContracts: '',
      contractsCount: '',
      hasEgkriseisDialthesisPistosis: '',
      hasProsklisiLink: '',
      hasEntaxiLink: '',
      hasComments: '',
      hasApeComments: '',
      hasRemainingComments: '',
      hasEisigitikiEkthesi: '',
      misPraxhsCode: '',
      remainingYear: '',
      remainingAmountCondition: 'all',
      contractDateFrom: '',
      contractDateTo: '',
      contractProcessDateFrom: '',
      contractProcessDateTo: '',
      approvedAmountMin: '',
      approvedAmountMax: '',
      contractAmountMin: '',
      contractAmountMax: '',
      apeAmountMin: '',
      apeAmountMax: '',
      anadoxosName: '',
      anadoxosVat: '',
      assignmentProcedure: [],
      hasAssignmentProcedure: '',
      khmdhsDeadlineFilter: '',
      sortBy: 'kaCode',
      sortOrder: 'asc'
    });
  }, []);

  const handleClearAllListFilters = useCallback(() => {
    setPortfolioDrillFilter(null);
    setQuickSearchText('');
    setQuickSearchStatus('');
    setQuickSearchType('');
    handleClearAdvancedFilters();
  }, [handleClearAdvancedFilters]);

  const handlePortfolioDrillDown = useCallback((label, subprojectIds) => {
    const ids = Array.isArray(subprojectIds) ? subprojectIds.filter(Boolean) : [];
    if (!ids.length) {
      showToast('Δεν υπάρχουν υποέργα σε αυτή την κατηγορία', 'info');
      return;
    }
    setPortfolioDrillFilter({ label: label || 'Φιλτράρισμα ΚΗΜΔΗΣ', subprojectIds: ids });
    requestAnimationFrame(() => {
      projectsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    showToast(`Φιλτράρισμα: ${label} (${ids.length} υποέργα)`, 'info');
  }, [showToast]);

  const activeFilterCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters, countActiveFilters]);
const handleDeleteProject = async (projectId, subprojectId) => {
    console.log('Attempting to delete subproject:', { projectId, subprojectId });
    
    // Έλεγχος αν τα IDs είναι έγκυρα
    if (!projectId || !subprojectId) {
      console.error('Invalid IDs for deletion:', { projectId, subprojectId });
      showToast('Σφάλμα: Μη έγκυρα δεδομένα για διαγραφή', 'error');
      return;
    }
    
    if (await showConfirm({ title: 'Διαγραφή Υποέργου', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το υποέργο;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        const result = await ipcRenderer.invoke('delete-subproject', projectId, subprojectId);
        
        if (result.success) {
          // Force reload projects and clear any cached data
          setProjects([]);
          setFilteredProjects([]);
          await loadProjects();
          // Also reload linked egkriseis to update the UI
          await loadLinkedEgkriseis();
          showToast('Το υποέργο διαγράφηκε επιτυχώς!', 'success');
        } else {
          console.error('Deletion failed:', result.error);
          showToast('Σφάλμα κατά τη διαγραφή: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Σφάλμα κατά τη διαγραφή: ' + error.message, 'error');
      }
    }
  };

  const handleContractExpiryAccept = async (project) => {
    if (!project?.subprojectId) return;
    try {
      const updated = {
        ...project,
        projectStatus: KHMDHS_COMPLETED_STATUS_SUGGESTION,
        updatedAt: new Date().toISOString(),
      };
      const result = await ipcRenderer.invoke('save-project-data', updated);
      if (!result?.success) {
        showToast(result?.error || 'Αποτυχία αποθήκευσης.', 'error');
        return;
      }
      showToast('Η κατάσταση ορίστηκε σε «Ολοκληρωμένο».', 'success');
      await loadDataWithCache(true);
    } catch (error) {
      showToast(error?.message || 'Σφάλμα αποθήκευσης.', 'error');
    }
  };

  const handleEditProject = async (project) => {
    captureDashboardScrollForForm();
    try {
      // Έλεγχος αν το έργο είναι ήδη κλειδωμένο
      const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
      
      if (lockStatus.locked) {
        const whoLocked = lockStatus.lockedBy ? `«${lockStatus.lockedBy}»` : 'άλλον χρήστη';
        const clearStaleResult = await showConfirm({
          title: 'Κλειδωμένο έργο',
          message: `Το έργο είναι ανοιχτό από ${whoLocked}.`,
          detail: 'Αν αυτό είναι λάθος (π.χ. κολλημένο lock), θέλετε να καθαρίσετε και να δοκιμάσετε ξανά;',
          confirmLabel: 'Καθαρισμός lock',
          cancelLabel: 'Άκυρο',
          icon: '🔒',
          danger: false,
        });
        
        if (clearStaleResult) {
          await ipcRenderer.invoke('clear-all-locks');
          await loadProjects();
          const newLockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
          if (newLockStatus.locked) {
            const whoStill = newLockStatus.lockedBy ? `«${newLockStatus.lockedBy}»` : 'άλλον διαχειριστή';
            showToast(`Το έργο είναι ακόμα κλειδωμένο από ${whoStill}.`, 'warning');
            return;
          }
        } else {
          return;
        }
      }

      // Δημιουργία lock με username
      const lockOwner = currentUser?.fullName || currentUser?.username || '';
      const lockResult = await ipcRenderer.invoke('create-project-lock', project.projectId, lockOwner);
      if (!lockResult.success) {
        showToast('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.', 'warning');
        return;
      }

      // Άμεση ενημέρωση του UI για να δείξει το lock με διατήρηση ταξινόμησης
      const updatedProjects = projects.map(p => 
        p.projectId === project.projectId ? { ...p, isLocked: true } : p
      ).sort((a, b) => {
        const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
        if (projectComparison !== 0) return projectComparison;
        return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
      });
      setProjects(updatedProjects);

      setEditingProject(project);
      loadEngineerCatalogForCards();
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error in handleEditProject:', error);
      showToast('Σφάλμα κατά το άνοιγμα του έργου: ' + error.message, 'error');
    }
  };

  const handleViewFile = async (projectId, subprojectId, fileName) => {
    try {
      const filePath = await ipcRenderer.invoke('get-file-path', projectId, subprojectId, fileName);
      setPdfViewer({
        isOpen: true,
        filePath,
        fileName
      });
    } catch (error) {
      console.error('Error getting file path:', error);
    }
  };

  const handleDownloadFile = async (projectId, subprojectId, fileName) => {
    try {
      const result = await ipcRenderer.invoke('download-subproject-file', projectId, subprojectId, fileName);
      if (result.success) {
        showToast('Το αρχείο αποθηκεύτηκε επιτυχώς!', 'success');
      } else if (result.canceled) {
        // User cancelled the save dialog - no need to show error
        return;
      } else {
        showToast('Σφάλμα κατά τη λήψη: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Σφάλμα κατά τη λήψη: ' + error.message, 'error');
    }
  };

  const handleDeleteFile = async (projectId, subprojectId, fileName) => {
    try {
      const result = await ipcRenderer.invoke('delete-file', projectId, subprojectId, fileName);
      if (result.success) {
        await loadProjects();
        if (fileManager.isOpen && fileManager.projectId === projectId && fileManager.subprojectId === subprojectId) {
          handleOpenFileManager(projectId, subprojectId);
        }
      } else {
        showToast(result.error || 'Σφάλμα κατά τη διαγραφή', 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Σφάλμα κατά τη διαγραφή: ' + error.message, 'error');
    }
  };

  const handleDeleteFiles = async (projectId, subprojectId, fileNames) => {
    const names = (Array.isArray(fileNames) ? fileNames : []).filter(Boolean);
    if (!names.length) return;
    try {
      const result = await ipcRenderer.invoke('delete-files', { projectId, subprojectId, fileNames: names });
      if (result.success) {
        showToast(`Διαγράφηκαν ${result.deletedCount || names.length} αρχεία.`, 'success');
        await loadProjects();
        if (fileManager.isOpen && fileManager.projectId === projectId && fileManager.subprojectId === subprojectId) {
          handleOpenFileManager(projectId, subprojectId);
        }
      } else {
        showToast(result.error || 'Σφάλμα κατά τη μαζική διαγραφή', 'error');
      }
    } catch (error) {
      console.error('Error deleting files:', error);
      showToast('Σφάλμα κατά τη μαζική διαγραφή: ' + error.message, 'error');
    }
  };

  const handleOpenFileManager = async (projectId, subprojectId) => {
    try {
      const result = await ipcRenderer.invoke('get-subproject-files', projectId, subprojectId);
      const subproject = findSubprojectByIds(projectId, subprojectId);
      setFileManager({
        isOpen: true,
        projectId,
        subprojectId,
        files: result.files || [],
        fileGroups: result.fileGroups || [],
        khmdhsDocumentRegistry: subproject?.khmdhsDocumentRegistry || [],
        khmdhsRelatedDocuments: subproject?.khmdhsRelatedDocuments || [],
      });
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  };

  const findSubprojectByIds = (projectId, subprojectId) =>
    projects.find((p) => p.projectId === projectId && p.subprojectId === subprojectId) || null;

  const assertSubprojectUploadAllowed = (project) => {
    if (userRole === 'USER') {
      showToast('Δεν έχετε δικαίωμα προσθήκης αρχείων.', 'warning');
      return false;
    }
    if (project?.isLocked) {
      const who = project.lockedBy ? `«${project.lockedBy}»` : 'άλλον χρήστη';
      showToast(`Το έργο είναι κλειδωμένο από ${who}. Δεν μπορούν να προστεθούν αρχεία αυτή τη στιγμή.`, 'warning');
      return false;
    }
    return true;
  };

  const refreshAfterSubprojectUpload = async (projectId, subprojectId, count, groupTitle) => {
    invalidateCache();
    await loadDataWithCache(true);

    if (
      fileManager.isOpen &&
      fileManager.projectId === projectId &&
      fileManager.subprojectId === subprojectId
    ) {
      await handleOpenFileManager(projectId, subprojectId);
    }

    const suffix = groupTitle ? ` στον φάκελο «${groupTitle}»` : '';
    showToast(`Προστέθηκαν επιτυχώς ${count} αρχείο(α) στο υποέργο${suffix}.`, 'success');
  };

  const handleUploadSubprojectFolder = async (projectId, subprojectId) => {
    const project = findSubprojectByIds(projectId, subprojectId);
    if (!assertSubprojectUploadAllowed(project)) return;

    setFileManagerUploading(true);
    try {
      const result = await uploadSubprojectFolder({ projectId, subprojectId });

      if (result.cancelled) {
        return;
      }

      if (!result.success) {
        showToast('Σφάλμα κατά την προσθήκη φακέλου: ' + (result.error || 'Άγνωστο σφάλμα'), 'error');
        return;
      }

      await refreshAfterSubprojectUpload(
        projectId,
        subprojectId,
        result.count,
        result.groupTitle
      );
    } catch (error) {
      console.error('Error uploading subproject folder:', error);
      showToast('Σφάλμα κατά την προσθήκη φακέλου: ' + error.message, 'error');
    } finally {
      setFileManagerUploading(false);
    }
  };

  const handleUploadSubprojectFilesFromManager = async () => {
    if (!fileManager.isOpen || !fileManager.projectId || !fileManager.subprojectId) return;

    const project = findSubprojectByIds(fileManager.projectId, fileManager.subprojectId);
    if (!assertSubprojectUploadAllowed(project)) return;

    setFileManagerUploading(true);
    try {
      const result = await uploadSubprojectFiles({
        projectId: fileManager.projectId,
        subprojectId: fileManager.subprojectId
      });

      if (result.cancelled) {
        return;
      }

      if (!result.success) {
        showToast('Σφάλμα κατά την προσθήκη αρχείων: ' + (result.error || 'Άγνωστο σφάλμα'), 'error');
        return;
      }

      await refreshAfterSubprojectUpload(
        fileManager.projectId,
        fileManager.subprojectId,
        result.count
      );
    } catch (error) {
      console.error('Error uploading subproject files:', error);
      showToast('Σφάλμα κατά την προσθήκη αρχείων: ' + error.message, 'error');
    } finally {
      setFileManagerUploading(false);
    }
  };

  const handleOpenLinkedProsklisi = (prosklisiId) => {
    // Set the selected prosklisi ID για φιλτράρισμα
    setSelectedProsklisiId(prosklisiId);
    // Open the ProsklisisManager
    setIsProsklisisOpen(true);
  };

  const handleCloseFileManager = () => {
    setFileManager({
      isOpen: false,
      projectId: null,
      subprojectId: null,
      files: [],
      fileGroups: [],
      khmdhsDocumentRegistry: [],
      khmdhsRelatedDocuments: [],
    });
  };

  // Συνάρτηση για ομαδοποίηση αρχείων στο FileManager
  const handleGroupFiles = async (filesToGroup, existingGroups = []) => {
    if (!filesToGroup || filesToGroup.length === 0) {
      showToast('Δεν υπάρχουν αρχεία για ομαδοποίηση', 'warning');
      return;
    }

    // Helper function για ασφαλή αφαίρεση modal
    const safeRemoveModal = (modal) => {
      if (modal && modal.parentNode === document.body) {
        try {
          document.body.removeChild(modal);
        } catch (error) {
          // Το modal έχει ήδη αφαιρεθεί
          console.log('Modal already removed');
        }
      }
    };

    // Απλό modal για τίτλο ομάδας
    const showGroupTitleModal = () => {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
            📁 Δημιουργία Νέας Ομάδας
          </h3>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος ομάδας:
          </label>
          <input 
            type="text" 
            id="groupTitle" 
            placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1.5rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="okBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">OK</button>
            <button id="cancelBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const groupTitle = modalContent.querySelector('#groupTitle');
        const okBtn = modalContent.querySelector('#okBtn');
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        // Focus στο input
        groupTitle.focus();

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        // OK button
        okBtn.addEventListener('click', () => {
          const title = groupTitle.value.trim();
          if (title) {
            cleanup(title);
          } else {
            showToast('Παρακαλώ εισάγετε τίτλο ομάδας', 'warning');
          }
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // Enter key
        groupTitle.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            okBtn.click();
          }
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Modal για επιλογή: Νέα Ομάδα ή Υπάρχουσα Ομάδα
    const showGroupSelectionModal = () => {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        const hasExistingGroups = existingGroups && existingGroups.length > 0;
        
        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1.5rem 0; color: #333; font-size: 1.3rem;">
            📁 Μεταφορά Αρχείων σε Ομάδα
          </h3>
          <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
            Επιλέξτε πώς θέλετε να μεταφέρετε τα ${filesToGroup.length} επιλεγμένα αρχεία:
          </p>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
            <button id="newGroupBtn" style="
              padding: 1rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
              text-align: left;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            ">
              <span style="font-size: 1.2rem;">➕</span>
              <div>
                <strong>Δημιουργία Νέας Ομάδας</strong>
                <div style="font-size: 0.85rem; opacity: 0.9;">Δημιουργήστε μια νέα ομάδα για τα αρχεία</div>
              </div>
            </button>
            ${hasExistingGroups ? `
            <button id="existingGroupBtn" style="
              padding: 1rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
              text-align: left;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            ">
              <span style="font-size: 1.2rem;">📁</span>
              <div>
                <strong>Μεταφορά σε Υπάρχουσα Ομάδα</strong>
                <div style="font-size: 0.85rem; opacity: 0.9;">Προσθέστε τα αρχεία σε μια υπάρχουσα ομάδα</div>
              </div>
            </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 1rem;">
            <button id="cancelBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const newGroupBtn = modalContent.querySelector('#newGroupBtn');
        const existingGroupBtn = hasExistingGroups ? modalContent.querySelector('#existingGroupBtn') : null;
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        newGroupBtn.addEventListener('click', () => {
          cleanup('new');
        });

        if (existingGroupBtn) {
          existingGroupBtn.addEventListener('click', () => {
            cleanup('existing');
          });
        }

        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Modal για επιλογή υπάρχουσας ομάδας
    const showExistingGroupSelectionModal = () => {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        const groupOptions = existingGroups.map(group => 
          `<option value="${group.id}">${group.title} (${group.files.length} αρχεία)</option>`
        ).join('');

        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
            📁 Επιλογή Ομάδας
          </h3>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε ομάδα:
          </label>
          <select id="groupSelect" style="
            width: 100%;
            padding: 0.8rem;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            margin-bottom: 1.5rem;
          ">
            ${groupOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="okBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">OK</button>
            <button id="cancelBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const groupSelect = modalContent.querySelector('#groupSelect');
        const okBtn = modalContent.querySelector('#okBtn');
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        okBtn.addEventListener('click', () => {
          const selectedGroupId = groupSelect.value;
          cleanup(selectedGroupId);
        });

        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Main logic for grouping files
    try {
      // Βήμα 1: Επιλογή τύπου ομάδας (Νέα ή Υπάρχουσα)
      const groupType = await showGroupSelectionModal();
      if (!groupType) return;

      if (groupType === 'new') {
        // Δημιουργία νέας ομάδας
        const groupTitle = await showGroupTitleModal();
        if (!groupTitle) return;

        // Χρησιμοποιούμε τα ήδη επιλεγμένα αρχεία
        const selectedFiles = filesToGroup;

        // Δημιουργία ομάδας
        const result = await ipcRenderer.invoke('create-file-group', fileManager.projectId, fileManager.subprojectId, groupTitle, selectedFiles);
        if (result.success) {
          // Ανανέωση των αρχείων
          await handleOpenFileManager(fileManager.projectId, fileManager.subprojectId);
          showToast(`Ομάδα "${groupTitle}" δημιουργήθηκε επιτυχώς με ${selectedFiles.length} αρχείο(α)!`, 'success');
        } else {
          showToast('Σφάλμα δημιουργίας ομάδας: ' + result.error, 'error');
        }
      } else if (groupType === 'existing') {
        // Μεταφορά σε υπάρχουσα ομάδα
        const selectedGroupId = await showExistingGroupSelectionModal();
        if (!selectedGroupId) return;

        // Μεταφορά αρχείων στην ομάδα
        const result = await ipcRenderer.invoke('add-files-to-group', fileManager.projectId, fileManager.subprojectId, selectedGroupId, filesToGroup);
        if (result.success) {
          // Ανανέωση των αρχείων
          await handleOpenFileManager(fileManager.projectId, fileManager.subprojectId);
          const selectedGroup = existingGroups.find(g => g.id === selectedGroupId);
          showToast(`${filesToGroup.length} αρχείο(α) μεταφέρθηκαν επιτυχώς στην ομάδα "${selectedGroup?.title || 'Ομάδα'}"!`, 'success');
        } else {
          showToast('Σφάλμα μεταφοράς αρχείων: ' + result.error, 'error');
        }
      }
    } catch (error) {
      console.error('Error grouping files:', error);
      showToast('Σφάλμα ομαδοποίησης αρχείων: ' + error.message, 'error');
    }
  };

  const visibleNotes = useMemo(() => {
    const me = currentUser?.username || '';
    const myRole = userRole || '';
    return notes.filter(note => {
      if (note.createdBy === me) return true;
      const vis = note.visibility || 'private';
      if (vis === 'private') return false;
      if (vis === 'roles') return (note.visibleToRoles || []).includes(myRole);
      if (vis === 'users') return (note.visibleToUsers || []).includes(me);
      return false;
    });
  }, [notes, currentUser?.username, userRole]);

  const filteredNotes = useMemo(() => {
    const term = notesSearch.trim().toLowerCase();
    return visibleNotes
      .filter(note => {
        if (!term) return true;
        return (note.title || '').toLowerCase().includes(term) ||
               (note.content || '').toLowerCase().includes(term);
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [visibleNotes, notesSearch]);

  const handleSaveNote = useCallback(({ title, content, reminderDate, reminderTime, linkedEntities: le, visibility: vis, visibleToRoles: vRoles, visibleToUsers: vUsers, id: forcedId, keepOpen }) => {
    if (!title && !content) return;

    if (editingNote && editingNote.id) {
      const updatedNote = {
        ...editingNote,
        title,
        content,
        linkedEntities: le || editingNote.linkedEntities || [],
        reminderDate: reminderDate || null,
        reminderTime: reminderTime || null,
        reminderSent: (reminderDate && reminderDate === editingNote.reminderDate && reminderTime === editingNote.reminderTime) ? editingNote.reminderSent : false,
        visibility: vis || editingNote.visibility || 'private',
        visibleToRoles: vRoles || editingNote.visibleToRoles || [],
        visibleToUsers: vUsers || editingNote.visibleToUsers || [],
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => prev.map(n => n.id === editingNote.id ? updatedNote : n));
      if (!keepOpen) setEditingNote(null);
    } else {
      const noteId = forcedId || `note-${Date.now()}`;
      const newNote = {
        id: noteId,
        title,
        content,
        linkedEntities: le || [],
        reminderDate: reminderDate || null,
        reminderTime: reminderTime || null,
        reminderSent: false,
        visibility: vis || 'private',
        visibleToRoles: vRoles || [],
        visibleToUsers: vUsers || [],
        createdBy: currentUser?.username || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => [newNote, ...prev]);
      if (keepOpen) {
        setEditingNote(newNote);
      } else {
        setEditingNote(null);
      }
    }
  }, [editingNote, currentUser?.username]);

  const handleDeleteNote = useCallback(async (noteId) => {
    if (!await showConfirm({ title: 'Διαγραφή Σημείωσης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη σημείωση;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingNote && editingNote.id === noteId) {
      setEditingNote(null);
    }
    ipcRenderer.invoke('delete-note-files-dir', { noteId }).catch(() => {});
  }, [editingNote]);

  const handleEditNote = useCallback((note) => {
    setEditingNote(note);
  }, []);

  useEffect(() => {
    if (!selectedNoteId) { setPreviewFiles([]); return; }
    let canceled = false;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-note-files', { noteId: selectedNoteId });
        if (!canceled && res?.files) setPreviewFiles(res.files);
        else if (!canceled) setPreviewFiles([]);
      } catch (_) { if (!canceled) setPreviewFiles([]); }
    })();
    return () => { canceled = true; };
  }, [selectedNoteId]);

  const loadNoteFileCounts = useCallback(async (notesList) => {
    const counts = {};
    for (const note of (notesList || notes)) {
      if (!note.id) continue;
      try {
        const res = await ipcRenderer.invoke('get-note-files', { noteId: note.id });
        if (res?.files?.length) counts[note.id] = res.files.length;
      } catch (_) { /* ignore */ }
    }
    setNoteFileCounts(counts);
  }, [notes]);

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null);
    loadNoteFileCounts();
    if (selectedNoteId) {
      ipcRenderer.invoke('get-note-files', { noteId: selectedNoteId })
        .then(res => { if (res?.files) setPreviewFiles(res.files); })
        .catch(() => {});
    }
  }, [loadNoteFileCounts, selectedNoteId]);

  const clearNoteReturnContext = useCallback(() => {
    noteReturnRef.current = null;
  }, []);

  const clearMeletiReturnContext = useCallback(() => {
    meletaiReturnRef.current = null;
    setMeletaiRestoreScrollTop(0);
  }, []);

  const captureMeletiReturnContext = useCallback(({ meletiId, scrollTop = 0 } = {}) => {
    const id = meletiId || selectedMeletiId;
    if (!isMeletaiOpen || !id) return;
    meletaiReturnRef.current = {
      meletiId: id,
      scrollTop: scrollTop || 0,
    };
  }, [isMeletaiOpen, selectedMeletiId]);

  const restoreMeletiReturnContext = useCallback(() => {
    const ctx = meletaiReturnRef.current;
    if (!ctx?.meletiId) return false;
    meletaiReturnRef.current = null;
    setMeletaiRestoreScrollTop(ctx.scrollTop || 0);
    setSelectedMeletiId(ctx.meletiId);
    setIsMeletaiOpen(true);
    return true;
  }, []);

  const handleNavigateToSubprojectFromMeleti = useCallback((subprojectId, { scrollTop, meletiId } = {}) => {
    if (!subprojectId) return;
    captureMeletiReturnContext({ meletiId, scrollTop });
    setIsMeletaiOpen(false);
    const found = projects.find((p) => p.subprojectId === subprojectId);
    if (found) {
      openSubprojectDetail(found);
    } else {
      showToast('Δεν έχετε πρόσβαση σε αυτό το υποέργο ή δεν υπάρχει πλέον', 'warning');
    }
  }, [projects, captureMeletiReturnContext, showToast, openSubprojectDetail]);

  const captureNoteReturnContext = useCallback(() => {
    if (!isNotesOpen) return;
    const noteId = editingNote?.id || selectedNoteId;
    if (!noteId) return;
    noteReturnRef.current = { noteId, wasEditing: !!editingNote?.id };
  }, [isNotesOpen, editingNote, selectedNoteId]);

  const restoreNoteReturnContext = useCallback(() => {
    const ctx = noteReturnRef.current;
    if (!ctx?.noteId) return false;
    noteReturnRef.current = null;
    setIsNotesOpen(true);
    setNotesSearch('');
    setSelectedNoteId(ctx.noteId);
    loadNoteFileCounts();
    if (ctx.wasEditing) {
      const note = notes.find((n) => n.id === ctx.noteId);
      setEditingNote(note || null);
    } else {
      setEditingNote(null);
    }
    ipcRenderer.invoke('get-note-files', { noteId: ctx.noteId })
      .then((res) => { if (res?.files) setPreviewFiles(res.files); })
      .catch(() => {});
    return true;
  }, [notes, loadNoteFileCounts]);

  const handleOpenNotes = useCallback(() => {
    clearNoteReturnContext();
    setIsNotesOpen(true);
    setNotesSearch('');
    setEditingNote(null);
    loadNoteFileCounts();
  }, [clearNoteReturnContext, loadNoteFileCounts]);

  const handleCloseNotes = useCallback(() => {
    clearNoteReturnContext();
    setIsNotesOpen(false);
    setEditingNote(null);
  }, [clearNoteReturnContext]);

  const handleOpenNoteFromEntity = useCallback((noteId) => {
    clearNoteReturnContext();
    setIsNotesOpen(true);
    setNotesSearch('');
    setEditingNote(null);
    setSelectedNoteId(noteId);
    loadNoteFileCounts();
  }, [clearNoteReturnContext, loadNoteFileCounts]);

  const handleNavigateToLinkedEntity = useCallback((entity) => {
    if (!entity) return;

    const { type, id, title } = entity;
    const opensModal = type === 'subproject' || type === 'entaxi' || type === 'prosklisi' || type === 'egkrisi' || type === 'meleti';
    if (opensModal) captureNoteReturnContext();

    setIsNotesOpen(false);
    setEditingNote(null);

    if (type === 'project') {
      setQuickSearchText(title || '');
    } else if (type === 'subproject') {
      const found = projects.find(p => p.subprojectId === id);
      if (found) openSubprojectDetail(found);
    } else if (type === 'entaxi') {
      setEntaxisProjectFilter(null);
      setSelectedEntaxiId(id);
      setIsEntaxisOpen(true);
    } else if (type === 'prosklisi') {
      setProsklisiProjectFilter(null);
      setSelectedProsklisiId(id);
      setIsProsklisisOpen(true);
    } else if (type === 'egkrisi') {
      setHighlightProject({
        projectTitle: null,
        subprojectTitle: title || null,
        projectKey: null,
        subprojectKey: null
      });
      setIsCreditApprovalsOpen(true);
    } else if (type === 'meleti') {
      setSelectedMeletiId(id);
      setIsMeletaiOpen(true);
    }
  }, [projects, captureNoteReturnContext, openSubprojectDetail]);

  const refreshTaskAccessRef = useRef(null);
  const refreshTaskAccess = useCallback(async () => {
    const username = currentUser?.username;
    if (!username || !ipcRenderer?.invoke) return;
    const fallbackCanAssign = !!currentUser?.taskAssignment?.canAssign || isSuperAdmin;
    try {
      await ipcRenderer.invoke('set-dashboard-session-active', { active: true, username });
      if (currentUser?.username !== username) return;
      let res = await ipcRenderer.invoke('get-task-assignment-access', { actingUsername: username });
      if (!res?.success) {
        await new Promise((r) => setTimeout(r, 120));
        if (currentUser?.username !== username) return;
        res = await ipcRenderer.invoke('get-task-assignment-access', { actingUsername: username });
      }
      if (currentUser?.username !== username) return;
      if (typeof onSyncCurrentUser === 'function') await onSyncCurrentUser();
      if (res?.success) {
        setTaskAccess({ showModule: !!res.showModule, unreadCount: res.unreadCount || 0, canAssign: !!res.canAssign });
      } else {
        const approvedViewer = currentUser?.approved !== false && currentUser?.active !== false;
        setTaskAccess({
          showModule: approvedViewer || fallbackCanAssign,
          unreadCount: 0,
          canAssign: fallbackCanAssign
        });
      }
    } catch {
      if (currentUser?.username !== username) return;
      const approvedViewer = currentUser?.approved !== false && currentUser?.active !== false;
      setTaskAccess({
        showModule: approvedViewer || fallbackCanAssign,
        unreadCount: 0,
        canAssign: fallbackCanAssign
      });
    }
  }, [currentUser?.username, currentUser?.taskAssignment?.canAssign, isSuperAdmin, onSyncCurrentUser]);
  refreshTaskAccessRef.current = refreshTaskAccess;

  const openTaskAssignmentsFromToast = useCallback((taskId) => {
    setTaskAssignmentInitialScreen('workspace');
    setTaskAssignmentsFocusTaskId(taskId || null);
    setIsTaskAssignmentsOpen(true);
  }, []);

  const openTaskWorkspace = useCallback(() => {
    setTaskAssignmentInitialScreen('workspace');
    setTaskAssignmentsFocusTaskId(null);
    setIsTaskAssignmentsOpen(true);
  }, []);

  const openWorkArchive = useCallback(() => {
    setTaskAssignmentInitialScreen('workArchive');
    setTaskAssignmentsFocusTaskId(null);
    setIsTaskAssignmentsOpen(true);
  }, []);

  const handleFocusTaskConsumed = useCallback(() => {
    setTaskAssignmentsFocusTaskId(null);
  }, []);

  const handleTogglePortalSubproject = useCallback(async (subprojectId) => {
    setPublishedSubprojectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subprojectId)) {
        next.delete(subprojectId);
      } else {
        next.add(subprojectId);
      }
      ipcRenderer.invoke('save-portal-published', { subprojectIds: Array.from(next) }).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    refreshTaskAccess();
  }, [refreshTaskAccess]);

  useEffect(() => {
    const unsub = window.electronAPI?.on?.('task-notification', (payload) => {
      if (payload?.username?.toLowerCase() === currentUser?.username?.toLowerCase()) {
        refreshTaskAccess();
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [currentUser?.username, refreshTaskAccess]);

  /** Κοινός φάκελος: ανανέωση πρόσβασης/μη αναγνωσμένων χωρίς IPC από άλλο PC. */
  useEffect(() => {
    if (!currentUser?.username) return undefined;
    const intervalId = setInterval(() => refreshTaskAccess(), 60000);
    return () => clearInterval(intervalId);
  }, [currentUser?.username, refreshTaskAccess]);

  const handleOpenEntaxis = (projectTitle = null) => {
    setEntaxisProjectFilter(projectTitle);
    setIsEntaxisOpen(true);
  };

  // Check if there's an entaxi for a specific subproject
  const hasEntaxiForSubproject = (subprojectId) => {
    return entaxeis.some(entaxi => 
      entaxi.subprojectIds && entaxi.subprojectIds.includes(subprojectId)
    );
  };

  // Get the entaxi for a specific subproject
  const getEntaxiForSubproject = (subprojectId) => {
    return entaxeis.find(entaxi => 
      entaxi.subprojectIds && entaxi.subprojectIds.includes(subprojectId)
    );
  };

  // Handle opening specific entaxi
  const handleOpenSpecificEntaxi = (subprojectId) => {
    const entaxi = getEntaxiForSubproject(subprojectId);
    if (entaxi) {
      setEntaxisProjectFilter(entaxi.projectTitle);
      setIsEntaxisOpen(true);
      // TODO: Highlight the specific entaxi when the modal opens
    }
  };

  const hasMeletiForSubproject = (subprojectId) => !!meletaiBySubproject[subprojectId];

  const handleOpenSpecificMeleti = (subprojectId) => {
    const meleti = meletaiBySubproject[subprojectId];
    if (meleti) {
      setSelectedMeletiId(meleti.id);
      setIsMeletaiOpen(true);
    }
  };

  // Check if there's a prosklisi for a specific project title or linked projects
  const hasProsklisiForProject = (projectTitle, projectId) => {
    const normTitle = normalizeText(projectTitle);
    return proskliseis.some(prosklisi => {
      if (normalizeText(prosklisi.title) === normTitle) return true;
      if (prosklisi.linkedProjects && Array.isArray(prosklisi.linkedProjects)) {
        return prosklisi.linkedProjects.some(linkedProject =>
          linkedProject.id === projectId || normalizeText(linkedProject.title) === normTitle
        );
      }
      return false;
    });
  };

  // Get the prosklisi for a specific project title or linked projects
  const getProsklisiForProject = (projectTitle, projectId) => {
    const normTitle = normalizeText(projectTitle);
    return proskliseis.find(prosklisi => {
      if (normalizeText(prosklisi.title) === normTitle) return true;
      if (prosklisi.linkedProjects && Array.isArray(prosklisi.linkedProjects)) {
        return prosklisi.linkedProjects.some(linkedProject =>
          linkedProject.id === projectId || normalizeText(linkedProject.title) === normTitle
        );
      }
      return false;
    });
  };

  // Handle opening specific prosklisi
  const handleOpenSpecificProsklisi = (projectTitle, projectId) => {
    const prosklisi = getProsklisiForProject(projectTitle, projectId);
    if (prosklisi) {
      // Ανοίγουμε το ProsklisisManager με φίλτρο για τη συγκεκριμένη πρόσκληση
      setProsklisiProjectFilter(prosklisi.title);
      setIsProsklisisOpen(true);
    }
  };

  const [highlightProject, setHighlightProject] = useState({
    projectTitle: null,
    subprojectTitle: null,
    projectKey: null,
    subprojectKey: null
  });

  const handleOpenEgkriseis = async (projectTitle, subprojectTitle = null, subprojectId = null) => {
    // Βρίσκουμε τον σωστό τίτλο από τις εγκρίσεις αν υπάρχει συσχέτιση
    let egkrisiTitle = subprojectTitle;
    let egkrisiProjectKey = null;
    let egkrisiSubprojectKey = null;

    if (subprojectId && linkedEgkriseis) {
      const linkedEgkrisi = Object.values(linkedEgkriseis).find(link => 
        link && link.subprojectId === subprojectId
      );
      if (linkedEgkrisi && linkedEgkrisi.egkrisiTitle) {
        egkrisiTitle = linkedEgkrisi.egkrisiTitle;
      }
      if (linkedEgkrisi && linkedEgkrisi.egkrisiProjectKey) {
        egkrisiProjectKey = linkedEgkrisi.egkrisiProjectKey;
      }
      if (linkedEgkrisi && linkedEgkrisi.egkrisiSubprojectKey) {
        egkrisiSubprojectKey = linkedEgkrisi.egkrisiSubprojectKey;
      }
    }
    
    // Αν δεν υπάρχει link, προσπαθούμε να βρούμε τα keys από το egkriseis-data.json
    if (!egkrisiProjectKey && subprojectId) {
      try {
        const keysResult = await ipcRenderer.invoke('find-egkrisi-keys-by-subproject-id', subprojectId);
        if (keysResult) {
          egkrisiProjectKey = keysResult.projectKey;
          egkrisiSubprojectKey = keysResult.subprojectKey;
        }
      } catch (error) {
        console.error('Error finding egkrisi keys:', error);
      }
    }
    
    setHighlightProject({
      projectTitle,
      subprojectTitle: egkrisiTitle,
      projectKey: egkrisiProjectKey,
      subprojectKey: egkrisiSubprojectKey
    });
    setIsCreditApprovalsOpen(true);
  };

  // Quick Search functions
  const handleQuickSearchClear = () => {
    setQuickSearchText('');
    setQuickSearchStatus('');
    setQuickSearchType('');
  };


  // Get unique values for dropdowns - Memoized για καλύτερη performance
  const getUniqueStatuses = useMemo(() => {
    const statuses = [...new Set(visibleProjects.map(p => p.projectStatus).filter(Boolean))];
    return statuses.sort();
  }, [visibleProjects]);

  const getUniqueTypes = useMemo(() => {
    const types = [...new Set(visibleProjects.map((p) => normalizeProjectType(p.projectType)).filter(Boolean))];
    return types.sort();
  }, [visibleProjects]);


  // Ομαδοποίηση κατά projectId (πηγή αλήθειας)· ο τίτλος μπορεί να διαφέρει σε κεφαλαιοποίηση ανά υποέργο.
  const groupedProjects = useMemo(() => {
    let source = filteredProjects;
    if (portfolioDrillFilter?.subprojectIds?.length) {
      const idSet = new Set(portfolioDrillFilter.subprojectIds);
      source = source.filter((p) => idSet.has(p.subprojectId));
    }
    return source.reduce((groups, project) => {
      const key = project.projectId || `__missing_project_id__:${project.subprojectId || 'unknown'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
      return groups;
    }, {});
  }, [filteredProjects, portfolioDrillFilter]);

  // Τα έργα που περνάνε στα στατιστικά — εξαιρούνται τα αρχειοθετημένα
  // εκτός αν ο χρήστης τα έχει επιλέξει ρητά
  const directAssignmentViolations = useMemo(
    () => findDirectAssignmentViolations(projects),
    [projects]
  );

  const directAssignmentViolationSubprojectIds = useMemo(
    () => getViolationSubprojectIds(directAssignmentViolations),
    [directAssignmentViolations]
  );

  const handleExportSubprojectReport = useCallback(async (project) => {
    try {
      await exportSubprojectReport({
        project,
        entaxeis,
        proskliseis,
        linkedEgkriseis,
        engineerCatalog: engineerCatalogForCards,
        linkedNotesMap,
        notes,
        directAssignmentViolations: getViolationsForSubproject(
          directAssignmentViolations,
          project.subprojectId
        ),
        isPublishedToPortal: publishedSubprojectIds.has(project.subprojectId),
        appConfig,
        appVersion,
        requestingUsername: currentUser?.username || '',
        showToast
      });
    } catch (error) {
      console.error('Subproject report export error:', error);
      showToast('Σφάλμα κατά τη δημιουργία αναφοράς', 'error');
    }
  }, [
    entaxeis,
    proskliseis,
    linkedEgkriseis,
    engineerCatalogForCards,
    linkedNotesMap,
    directAssignmentViolations,
    publishedSubprojectIds,
    notes,
    appConfig,
    appVersion,
    currentUser?.username,
    showToast
  ]);

  // Τα έργα που περνάνε στα στατιστικά — πλήρες χαρτοφυλάκιο για ADMIN/SUPERADMIN/USER,
  // μόνο χρεωμένα υποέργα για μηχανικούς
  const statisticsScopeProjects = useMemo(() => (
    isEngineer ? visibleProjects : projects
  ), [isEngineer, visibleProjects, projects]);

  const statisticsProjects = useMemo(() => {
    let base = filteredProjects;
    if (portfolioDrillFilter?.subprojectIds?.length) {
      const idSet = new Set(portfolioDrillFilter.subprojectIds);
      base = base.filter((p) => idSet.has(p.subprojectId));
    }
    return base;
  }, [filteredProjects, portfolioDrillFilter]);

  const statisticsDirectAssignmentViolations = useMemo(
    () => findDirectAssignmentViolations(statisticsProjects),
    [statisticsProjects]
  );

  const statisticsScopeNote = useMemo(() => {
    if (!isEngineer) return '';
    const n = statisticsScopeProjects.length;
    return `Μόνο υποέργα της χρέωσής σας (${n})`;
  }, [isEngineer, statisticsScopeProjects.length]);

  const statisticsFilterNote = useMemo(() => {
    const parts = [];
    if (statisticsScopeNote) {
      parts.push(statisticsScopeNote);
    }
    if (portfolioDrillFilter?.label) {
      parts.push(`λίστα: ${portfolioDrillFilter.label}`);
    }
    if (activeFilterCount > 0) {
      parts.push(`${activeFilterCount} φίλτρα`);
    }
    if (quickSearchText.trim()) {
      parts.push(`αναζήτηση «${quickSearchText.trim().slice(0, 40)}»`);
    }
    if (quickSearchStatus) {
      parts.push(`κατάσταση: ${quickSearchStatus}`);
    }
    if (quickSearchType) {
      parts.push(`είδος: ${quickSearchType}`);
    }
    const scope = statisticsProjects.length;
    return parts.length ? `${scope} υποέργα · ${parts.join(' · ')}` : `${scope} υποέργα`;
  }, [
    portfolioDrillFilter,
    statisticsScopeNote,
    activeFilterCount,
    quickSearchText,
    quickSearchStatus,
    quickSearchType,
    statisticsProjects.length,
  ]);

  const exportProjects = useMemo(() => {
    const userExplicitlyFilteredByAbandoned =
      (Array.isArray(advancedFilters?.projectStatus) && advancedFilters.projectStatus.includes(PROJECT_STATUS_ABANDONED)) ||
      quickSearchStatus === PROJECT_STATUS_ABANDONED;
    if (userExplicitlyFilteredByAbandoned) return filteredProjects;
    return excludeAbandonedSubprojects(filteredProjects);
  }, [filteredProjects, advancedFilters?.projectStatus, quickSearchStatus]);

  // Group projects as array of arrays for EgkriseisManager
  const projectsAsArrayOfArrays = useMemo(() => {
    const allProjects = projects.length > 0 ? projects : filteredProjects;
    const grouped = allProjects.reduce((groups, project) => {
      const key = project.projectId || `__missing_project_id__:${project.subprojectId || 'unknown'}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
      return groups;
    }, {});
    // Convert object to array of arrays
    return Object.values(grouped);
  }, [projects, filteredProjects]);

  return (
    <DashboardContainer ref={dashboardScrollRef}>
      <Header ref={mainHeaderRef}>
        <UserInfo>
          <UserRole role={userRole}>
            {currentUser?.fullName || currentUser?.username || userRole}
          </UserRole>
          <RoleTag>{getRoleLabel(userRole)}</RoleTag>
        </UserInfo>
        <CenteredTitleContainer>
          <MainTitle>{appConfig.organizationFullName || 'ΟΡΓΑΝΙΣΜΟΣ'}</MainTitle>
          <SubTitle>ERGOHUB - Διαχείριση Έργων & Προμηθειών</SubTitle>
        </CenteredTitleContainer>
        <HeaderRight>
          <LogoutButton onClick={() => setIsMyNotifPrefsOpen(true)} style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', marginRight: 6 }}>
            🔔 Ειδοποιήσεις
          </LogoutButton>
          <LogoutButton onClick={onLogout}>
            Αποσύνδεση
          </LogoutButton>
          <VersionText>
            {appVersion ? `v${appVersion}` : ''}
          </VersionText>
        </HeaderRight>
      </Header>

      <ContentWrapper ref={contentWrapperRef} $headerOffset={mainHeaderOffsetPx}>
        <ContentArea>
          {/* Active Filters Banner */}
          <ActiveFiltersBanner
            activeFilterCount={activeFilterCount}
            portfolioDrillLabel={portfolioDrillFilter?.label || ''}
            onClearFilters={handleClearAllListFilters}
          />

          {/* Statistics — εξαιρούνται τα αρχειοθετημένα εκτός αν επιλεγούν */}
          <Suspense fallback={<LazyChunkFallback>Φόρτωση στατιστικών…</LazyChunkFallback>}>
            <Statistics
              variant="summary"
              projects={statisticsProjects}
              directAssignmentViolations={statisticsDirectAssignmentViolations}
              loggedInUsername={currentUser?.username || ''}
              onPortfolioDrillDown={handlePortfolioDrillDown}
              statisticsFilterNote={statisticsFilterNote}
              statisticsScopeNote={statisticsScopeNote}
              onOpenFullStatistics={() => setIsStatisticsModalOpen(true)}
            />
          </Suspense>

          {(userRole === 'ADMIN' || userRole === 'SUPERADMIN') && (
            <Suspense fallback={null}>
              <KhmdhsBatchRefreshWidget
                userRole={userRole}
                currentUser={currentUser}
                onRefreshComplete={() => { loadProjects(); refreshKhmdhsStaleCount(); }}
                onBatchResults={handleBatchResults}
                onRunningChange={setKhmdhsBatchRunning}
                onOpenReport={() => setIsBatchReportOpen(true)}
                staleCount={khmdhsStaleCount}
                oldestDays={khmdhsOldestDays}
                lastRunInfo={khmdhsLastRun}
                hasReport={!!batchReportResults}
              />
            </Suspense>
          )}

          <Suspense fallback={null}>
            <CalendarDeadlineWidget
              projects={visibleProjects}
              userRole={userRole}
              currentUser={currentUser}
              engineerCatalog={engineerCatalogForCards}
              includeAepo={userRole === 'ADMIN' || userRole === 'SUPERADMIN' || !!currentUser?.orimanthiCanEdit}
              maxDays={30}
              limit={8}
              refreshKey={calendarRefreshKey}
              onOpenOrimanthi={() => setIsOrimanthiOpen(true)}
              onOpenCalendar={(opts) => {
                if (opts?.customEventId) setCalendarFocusCustomEventId(opts.customEventId);
                setIsProcurementCalendarOpen(true);
              }}
              onViewSubproject={(subprojectId) => {
                const p = projects.find((row) => row.subprojectId === subprojectId);
                if (p) openSubprojectDetail(p);
              }}
            />
          </Suspense>

          {(userRole === 'ENGINEER' || userRole === 'USER') && (
            <Suspense fallback={null}>
              <RoleDashboardWidget
                userRole={userRole}
                currentUser={currentUser}
                onOpenTaskAssignments={(taskId) => openTaskAssignmentsFromToast(taskId)}
              />
            </Suspense>
          )}

          {/* Banner αρχειοθετημένων έργων */}
          {showArchivedProjects && (
            <ArchiveBanner>
              <ArchiveBannerIcon>🗄️</ArchiveBannerIcon>
              <ArchiveBannerContent>
                <ArchiveBannerTitle>
                  Αρχείο Ολοκληρωμένων Έργων
                  <ArchiveBannerTag>✓ Αρχείο</ArchiveBannerTag>
                </ArchiveBannerTitle>
                <ArchiveBannerText>
                  Τα παρακάτω έργα έχουν ολοκληρωθεί πλήρως και αποπληρωθεί. Έχουν μεταφερθεί στο αρχείο και
                  δεν εκκρεμεί καμία ενέργεια για αυτά. Προβάλλονται αποκλειστικά για λόγους
                  ιστορικής αναφοράς.
                </ArchiveBannerText>
              </ArchiveBannerContent>
              <ArchiveBannerClose
                onClick={() => setShowArchivedProjects(false)}
                title="Κλείσιμο αρχείου"
              >
                ✕
              </ArchiveBannerClose>
            </ArchiveBanner>
          )}

          <ProjectsContainer ref={projectsListRef}>
            <ProjectsTitle>
              {showArchivedProjects ? 'Αρχείο — Ολοκληρωμένα & Αποπληρωμένα' : 'Έργα & Υποέργα'}
            </ProjectsTitle>

            {loading ? (
              <SkeletonProjectsGrid />
            ) : Object.keys(groupedProjects).length === 0 ? (
              (() => {
                const hasActiveFilters = activeFilterCount > 0
                  || portfolioDrillFilter
                  || quickSearchText.trim()
                  || quickSearchStatus
                  || quickSearchType;
                return (
                  <EmptyState>
                    <EmptyStateIcon>
                      {hasActiveFilters ? '🔍' : '📁'}
                    </EmptyStateIcon>
                    <EmptyStateText>
                      {hasActiveFilters ? 'Κανένα αποτέλεσμα' : 'Δεν υπάρχουν έργα'}
                    </EmptyStateText>
                    <EmptyStateSubtext>
                      {hasActiveFilters
                        ? 'Τα φίλτρα που εφαρμόσατε δεν επέστρεψαν αποτελέσματα. Δοκιμάστε να αλλάξετε τα κριτήρια αναζήτησης.'
                        : canManageAll
                          ? 'Δεν έχει εισαχθεί ακόμα κανένα υποέργο. Ξεκινήστε πατώντας το κουμπί "ΕΙΣΑΓΩΓΗ ΝΕΟΥ ΥΠΟΕΡΓΟΥ".'
                          : 'Δεν έχουν εισαχθεί έργα ακόμα.'
                      }
                    </EmptyStateSubtext>
                    {hasActiveFilters && (
                      <EmptyStateAction onClick={handleClearAllListFilters}>
                        Εκκαθάριση φίλτρων
                      </EmptyStateAction>
                    )}
                  </EmptyState>
                );
              })()
            ) : (
              Object.entries(groupedProjects)
                .sort(([, subsA], [, subsB]) => {
                  const titleA = pickDisplayProjectTitleForGroup(subsA);
                  const titleB = pickDisplayProjectTitleForGroup(subsB);
                  return titleA.localeCompare(titleB, 'el', { sensitivity: 'base' });
                })
                .map(([projectId, subprojects]) => {
                  const projectTitle = pickDisplayProjectTitleForGroup(subprojects);
                  // Calculate total entaxi amount for all subprojects in this project
                  // IMPORTANT: Use unique entaxis to avoid counting the same entaxi multiple times
                  // if it's linked to multiple subprojects
                  const uniqueEntaxiIds = new Set();
                  subprojects.forEach(subproject => {
                    const entaxi = getEntaxiForSubproject(subproject.subprojectId);
                    if (entaxi && entaxi.entaxiId) {
                      uniqueEntaxiIds.add(entaxi.entaxiId);
                    }
                  });
                  
                  // Sum amounts from unique entaxis only
                  const totalEntaxiAmount = Array.from(uniqueEntaxiIds).reduce((total, entaxiId) => {
                    const entaxi = entaxeis.find(e => e.entaxiId === entaxiId);
                    if (entaxi && entaxi.initialAmount) {
                      // Parse amount: remove non-digit chars except comma/dot, remove dots (thousands), replace comma with dot
                      const cleaned = entaxi.initialAmount.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
                      const amount = parseFloat(cleaned);
                      if (!isNaN(amount)) {
                        return total + amount;
                      }
                    }
                    return total;
                  }, 0);
                  
                  const formatAmount = (amount) => {
                    if (!amount || amount === 0) return null;
                    return amount.toLocaleString('el-GR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) + ' €';
                  };
                  
                  const projectLinkedNotes = getEntityLinkedNotes(linkedNotesMap, projectId);
                  const isGroupCollapsed = collapsedGroups.has(projectId);
                  return (
                  <ProjectGroup key={projectId}>
                    <ProjectGroupHeaderBand>
                      <ProjectGroupHeaderTop>
                        <ProjectKindLabel>Πράξη</ProjectKindLabel>
                        {projectLinkedNotes.length > 0 && (
                          <LinkedNoteSticker
                            links={projectLinkedNotes}
                            onOpenNote={handleOpenNoteFromEntity}
                            placement="inline"
                          />
                        )}
                      </ProjectGroupHeaderTop>
                      <ProjectGroupTitle>
                        <GroupHeaderWrap onClick={() => toggleGroupCollapse(projectId)}>
                          <ProjectGroupTitleText>{projectTitle}</ProjectGroupTitleText>
                          <GroupSubCount>{subprojects.length} {subprojects.length === 1 ? 'υποέργο' : 'υποέργα'}</GroupSubCount>
                          {totalEntaxiAmount > 0 && (
                            <EntaxiAmountChip onClick={(e) => e.stopPropagation()}>
                              <EntaxiIcon>💰</EntaxiIcon>
                              <EntaxiLabel>Ποσό ένταξης:</EntaxiLabel>
                              <EntaxiValue>{formatAmount(totalEntaxiAmount)}</EntaxiValue>
                            </EntaxiAmountChip>
                          )}
                          <GroupCollapseIcon $collapsed={isGroupCollapsed}>▼</GroupCollapseIcon>
                        </GroupHeaderWrap>
                      </ProjectGroupTitle>
                    </ProjectGroupHeaderBand>
                    {!isGroupCollapsed && (
                      <ProjectGroupBody>
                        <SubprojectsGrid>
                        {subprojects
                          .sort((a, b) => a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' }))
                          .map(project => {
                            const linkedProsklisi = findLinkedProsklisi(project.subprojectId, project.projectTitle);
                            const isLocked = project.isLocked || false;
                            return (
                              <ProjectCard
                                key={project.subprojectId}
                                project={project}
                                userRole={userRole}
                                onEdit={handleEditProject}
                                onDelete={canManageAll ? handleDeleteProject : undefined}
                                onViewFile={handleViewFile}
                                onDownloadFile={handleDownloadFile}
                                onDeleteFile={handleDeleteFile}
                                onOpenFileManager={handleOpenFileManager}
                                onOpenEntaxis={handleOpenEntaxis}
                                onOpenEgkriseis={() => handleOpenEgkriseis(project.projectTitle, project.subprojectTitle, project.subprojectId)}
                                hasCreditApproval={hasCreditApproval(project.projectTitle, project.subprojectTitle, project.subprojectId)}
                                hasLinkedEgkrisi={hasLinkedEgkrisi(project.subprojectId, project.subprojectTitle)}
                                linkedProsklisi={linkedProsklisi}
                                onOpenLinkedProsklisi={handleOpenLinkedProsklisi}
                                isLocked={isLocked}
                                hasEntaxi={hasEntaxiForSubproject(project.subprojectId)}
                                onOpenSpecificEntaxi={() => handleOpenSpecificEntaxi(project.subprojectId)}
                                hasProsklisi={hasProsklisiForProject(project.projectTitle, project.projectId)}
                                onOpenSpecificProsklisi={() => handleOpenSpecificProsklisi(project.projectTitle, project.projectId)}
                                hasMeleti={hasMeletiForSubproject(project.subprojectId)}
                                onOpenSpecificMeleti={() => handleOpenSpecificMeleti(project.subprojectId)}
                                onViewDetails={openSubprojectDetail}
                                engineerCatalog={engineerCatalogForCards}
                                linkedNotesMap={linkedNotesMap}
                                notes={notes}
                                onOpenNoteFromEntity={handleOpenNoteFromEntity}
                                portalEnabled={portalEnabled}
                                isPublishedToPortal={publishedSubprojectIds.has(project.subprojectId)}
                                epLinkedAction={epSubprojectMap[project.subprojectId] || null}
                                hasDirectAssignmentViolation={directAssignmentViolationSubprojectIds.has(project.subprojectId)}
                                onExportReport={handleExportSubprojectReport}
                                allSubprojects={projects}
                                onContractExpiryAccept={canManageWorkflow ? handleContractExpiryAccept : undefined}
                              />
                            );
                          })}
                        </SubprojectsGrid>
                      </ProjectGroupBody>
                    )}
                  </ProjectGroup>
                  );
                })
            )}
          </ProjectsContainer>

          {isCreditApprovalsOpen && (
            <Suspense fallback={<LazyChunkFallback>Φόρτωση εγκρίσεων…</LazyChunkFallback>}>
            <CreditApprovalsPanel
              isOpen={isCreditApprovalsOpen}
              onClose={() => {
                setIsCreditApprovalsOpen(false);
                setHighlightProject({
                  projectTitle: null,
                  subprojectTitle: null,
                  projectKey: null,
                  subprojectKey: null
                });
                loadLinkedEgkriseis();
                restoreNoteReturnContext();
                scheduleDocumentInteractionRecovery();
              }}
              userRole={userRoleForWorkflowModals}
              onOpenForm={() => setIsEgkriseisFormOpen(true)}
              highlightProjectTitle={highlightProject.projectTitle}
              highlightSubprojectTitle={highlightProject.subprojectTitle}
              highlightProjectKey={highlightProject.projectKey}
              highlightSubprojectKey={highlightProject.subprojectKey}
              onLinkCreated={async () => {
                await loadLinkedEgkriseis();
              }}
              onLinkRemoved={async () => {
                await loadLinkedEgkriseis();
              }}
              externalLinkedEgkriseis={linkedEgkriseis}
              onRequestRefresh={async () => {
                await loadLinkedEgkriseis();
              }}
              onEgkriseisDataSaved={egkriseisRefreshTrigger}
              linkedNotesMap={linkedNotesMap}
              onOpenNoteFromEntity={handleOpenNoteFromEntity}
              dashboardProjects={projects.length > 0 ? projects : filteredProjects}
              notes={notes}
            />
            </Suspense>
          )}
        </ContentArea>
      </ContentWrapper>

      {/* Modern σταθερή sidebar αριστερά με ομαδοποιημένα κουμπιά */}
      <AdminSidebar>
        {/* Brand */}
        <SidebarBrand>
          <SidebarBrandLogo src={require('../assets/ergohub-logo.svg').default || require('../assets/ergohub-logo.svg')} alt="ERGOHUB" />
          <SidebarBrandText>
            <SidebarBrandTitle>ERGOHUB</SidebarBrandTitle>
            <SidebarBrandSubtitle>Διαχείριση Έργων</SidebarBrandSubtitle>
          </SidebarBrandText>
        </SidebarBrand>

        {/* Quick Search - πάντα προσβάσιμη στην κορυφή */}
        <QuickSearchContainer>
          <QuickSearchGrid>
            <SearchInputContainer>
              <SearchLabel>Γρήγορη Αναζήτηση</SearchLabel>
              <SearchInput
                ref={quickSearchInputRef}
                type="text"
                placeholder="Έργο, υποέργο, ΚΑ..."
                value={quickSearchText}
                onChange={(e) => {
                  setQuickSearchText(e.target.value);
                }}
                onFocus={(e) => {
                  e.target.style.caretColor = 'auto';
                }}
              />
            </SearchInputContainer>

            <SearchInputContainer>
              <SearchLabel>Κατάσταση</SearchLabel>
              <SearchSelect
                value={quickSearchStatus}
                onChange={(e) => setQuickSearchStatus(e.target.value)}
              >
                <option value="">Όλες</option>
                {getUniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </SearchSelect>
            </SearchInputContainer>

            <SearchInputContainer>
              <SearchLabel>Είδος</SearchLabel>
              <SearchSelect
                value={quickSearchType}
                onChange={(e) => setQuickSearchType(e.target.value)}
              >
                <option value="">Όλα</option>
                {getUniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </SearchSelect>
            </SearchInputContainer>

            {(quickSearchText || quickSearchStatus || quickSearchType) && (
              <ClearButton onClick={handleQuickSearchClear}>
                🗑️ Καθαρισμός
              </ClearButton>
            )}
          </QuickSearchGrid>
        </QuickSearchContainer>

        {canOpenProcurementCalendar && (
          <CalendarNavButton type="button" onClick={() => setIsProcurementCalendarOpen(true)}>
            <CalendarNavIcon>📅</CalendarNavIcon>
            Ημερολόγιο Προθεσμιών
          </CalendarNavButton>
        )}

        <StatsNavButton type="button" onClick={() => setIsStatisticsModalOpen(true)}>
          <CalendarNavIcon>📊</CalendarNavIcon>
          Στατιστικά & Αναφορές
        </StatsNavButton>

        {/* Κατηγορία: ΕΡΓΑ */}
        <CategorySection $accentColor="#4f46e5" $accentGrad="linear-gradient(135deg, #4f46e5, #7c3aed)">
          <CategoryHeader $open={expandedCategories.projects} onClick={() => toggleCategory('projects')}>
            <CategoryHeaderLeft>
              <CategoryHeaderIcon $accent="linear-gradient(135deg, #4f46e5, #7c3aed)">📁</CategoryHeaderIcon>
              <CategoryHeaderTitle>Έργα</CategoryHeaderTitle>
            </CategoryHeaderLeft>
            <CategoryHeaderChevron $open={expandedCategories.projects}>▶</CategoryHeaderChevron>
          </CategoryHeader>
          <CategoryBody $open={expandedCategories.projects}>
            {canManageAll && (
              <AdminButton primary onClick={() => {
                captureDashboardScrollForForm();
                setEditingProject(null);
                loadEngineerCatalogForCards();
                setIsFormOpen(true);
              }}>
                <AdminButtonIcon>➕</AdminButtonIcon>
                Νέο Υποέργο
              </AdminButton>
            )}
            <AdminButton onClick={() => setIsFiltersOpen(true)}>
              <AdminButtonIcon>🔍</AdminButtonIcon>
              Αναζήτηση & Φίλτρα
            </AdminButton>
            <ArchiveButton
              $active={showArchivedProjects}
              onClick={() => {
                setShowArchivedProjects(prev => !prev);
                if (dashboardScrollRef.current) {
                  dashboardScrollRef.current.scrollTop = 0;
                }
              }}
            >
              <AdminButtonIcon>🗄️</AdminButtonIcon>
              Ολοκληρωμένα &amp; Αποπληρωμένα
            </ArchiveButton>
            {canManageAll && (
              <AdminButton onClick={() => {
                if (dashboardScrollRef.current) {
                  savedScrollPosition.current = dashboardScrollRef.current.scrollTop;
                }
                setIsEpProgramOpen(true);
              }}>
                <AdminButtonIcon>🗺️</AdminButtonIcon>
                Επιχειρησιακό Πρόγραμμα
              </AdminButton>
            )}
          </CategoryBody>
        </CategorySection>

        {/* Κατηγορία: ΔΙΑΔΙΚΑΣΙΕΣ ΕΡΓΩΝ */}
          <CategorySection $accentColor="#0891b2" $accentGrad="linear-gradient(135deg, #0891b2, #06b6d4)">
            <CategoryHeader $open={expandedCategories.management} onClick={() => toggleCategory('management')}>
              <CategoryHeaderLeft>
                <CategoryHeaderIcon $accent="linear-gradient(135deg, #0891b2, #06b6d4)">📂</CategoryHeaderIcon>
                <CategoryHeaderTitle>Διαδικασίες Έργων</CategoryHeaderTitle>
              </CategoryHeaderLeft>
              <CategoryHeaderChevron $open={expandedCategories.management}>▶</CategoryHeaderChevron>
            </CategoryHeader>
            <CategoryBody $open={expandedCategories.management}>
              <AdminButton onClick={() => {
                if (dashboardScrollRef.current) {
                  savedScrollPosition.current = dashboardScrollRef.current.scrollTop;
                }
                setIsEntaxisOpen(true);
              }}>
                <AdminButtonIcon>📊</AdminButtonIcon>
                Εντάξεις Έργων
              </AdminButton>
              <AdminButton onClick={() => {
                if (dashboardScrollRef.current) {
                  savedScrollPosition.current = dashboardScrollRef.current.scrollTop;
                }
                setIsProsklisisOpen(true);
              }}>
                <AdminButtonIcon>📢</AdminButtonIcon>
                Προσκλήσεις
              </AdminButton>
              <AdminButton onClick={() => setIsCreditApprovalsOpen(true)}>
                <AdminButtonIcon>📋</AdminButtonIcon>
                Εγκρίσεις Διάθεσης Πίστωσης
              </AdminButton>
              <AdminButton onClick={() => setIsOrimanthiOpen(true)} title="Βάση Δεδομένων — καταγραφή ωρίμανσης έργων">
                <AdminButtonIcon>🌱</AdminButtonIcon>
                Ωρίμανση Έργων
              </AdminButton>
              <AdminButton onClick={() => {
                if (dashboardScrollRef.current) {
                  savedScrollPosition.current = dashboardScrollRef.current.scrollTop;
                }
                setSelectedMeletiId(null);
                setIsMeletaiOpen(true);
              }} title="Μητρώο καταχώρησης μελετών">
                <AdminButtonIcon>📐</AdminButtonIcon>
                Μητρώο Μελετών
              </AdminButton>
            </CategoryBody>
          </CategorySection>

        {taskAccess.showModule && (
          <CategorySection $accentColor="#6366f1" $accentGrad="linear-gradient(135deg, #6366f1, #4f46e5)">
            <CategoryHeader $open={expandedCategories.assignments} onClick={() => toggleCategory('assignments')}>
              <CategoryHeaderLeft>
                <CategoryHeaderIcon $accent="linear-gradient(135deg, #6366f1, #4f46e5)">📌</CategoryHeaderIcon>
                <CategoryHeaderTitle>Χώρος Εργασίας</CategoryHeaderTitle>
              </CategoryHeaderLeft>
              <CategoryHeaderChevron $open={expandedCategories.assignments}>▶</CategoryHeaderChevron>
            </CategoryHeader>
            <CategoryBody $open={expandedCategories.assignments}>
              <AdminButton onClick={openTaskWorkspace}>
                <AdminButtonIcon>✅</AdminButtonIcon>
                Άνοιγμα χώρου Εργασιών
                {taskAccess.unreadCount > 0 && (
                  <SidebarCountBadge>{taskAccess.unreadCount > 99 ? '99+' : taskAccess.unreadCount}</SidebarCountBadge>
                )}
              </AdminButton>
              <AdminButton onClick={openWorkArchive}>
                <AdminButtonIcon>📦</AdminButtonIcon>
                ΑΠΟΘΗΚΗ ΕΡΓΑΣΙΩΝ
              </AdminButton>
            </CategoryBody>
          </CategorySection>
        )}

        {/* Κατηγορία: ΕΞΑΓΩΓΕΣ */}
        <CategorySection $accentColor="#059669" $accentGrad="linear-gradient(135deg, #059669, #10b981)">
            <CategoryHeader $open={expandedCategories.exports} onClick={() => toggleCategory('exports')}>
              <CategoryHeaderLeft>
                <CategoryHeaderIcon $accent="linear-gradient(135deg, #059669, #10b981)">📤</CategoryHeaderIcon>
                <CategoryHeaderTitle>Εξαγωγές</CategoryHeaderTitle>
              </CategoryHeaderLeft>
              <CategoryHeaderChevron $open={expandedCategories.exports}>▶</CategoryHeaderChevron>
            </CategoryHeader>
            <CategoryBody $open={expandedCategories.exports}>
              {!isEngineer && (
                <AdminButton onClick={() => setIsTechnicalProgramOpen(true)}>
                  <AdminButtonIcon>📋</AdminButtonIcon>
                  Τεχνικό Πρόγραμμα
                </AdminButton>
              )}
              {!isEngineer && (
                <AdminButton onClick={() => setIsInvestExportOpen(true)}>
                  <AdminButtonIcon>📊</AdminButtonIcon>
                  Εκτελεστέα Έργα
                </AdminButton>
              )}
              {(canManageAll || isEngineer) && (
                <AdminButton onClick={() => setIsPortalHubOpen(true)}>
                  <AdminButtonIcon>🌐</AdminButtonIcon>
                  Πύλη Διαφάνειας
                </AdminButton>
              )}
              <AdminButton onClick={() => setIsExportOpen(true)}>
                <AdminButtonIcon>📑</AdminButtonIcon>
                Εξαγωγή Δεδομένων
              </AdminButton>
              <AdminButton onClick={() => { setReportsInitialTab('subprojects'); setIsReportsOpen(true); }}>
                <AdminButtonIcon>📊</AdminButtonIcon>
                Αναφορές σε PDF
              </AdminButton>
            </CategoryBody>
          </CategorySection>

        {/* Κατηγορία: ΕΡΓΑΛΕΙΑ - ADMIN/SUPERADMIN/ENGINEER */}
        {(canManageAll || isEngineer) && (
          <CategorySection $accentColor="#d97706" $accentGrad="linear-gradient(135deg, #d97706, #f59e0b)">
            <CategoryHeader $open={expandedCategories.tools} onClick={() => toggleCategory('tools')}>
              <CategoryHeaderLeft>
                <CategoryHeaderIcon $accent="linear-gradient(135deg, #d97706, #f59e0b)">🛠️</CategoryHeaderIcon>
                <CategoryHeaderTitle>Εργαλεία</CategoryHeaderTitle>
              </CategoryHeaderLeft>
              <CategoryHeaderChevron $open={expandedCategories.tools}>▶</CategoryHeaderChevron>
            </CategoryHeader>
            <CategoryBody $open={expandedCategories.tools}>
              <AdminButton onClick={() => setIsAuditLogOpen(true)}>
                <AdminButtonIcon>📋</AdminButtonIcon>
                Ιστορικό Ενεργειών
              </AdminButton>
              {canManageAll && (
                <AdminButton onClick={() => setIsCalendarSettingsOpen(true)}>
                  <AdminButtonIcon>🔔</AdminButtonIcon>
                  Κέντρο Ειδοποιήσεων
                </AdminButton>
              )}
              {canManageAll && (
                <AdminButton onClick={() => setIsEmailHistoryOpen(true)}>
                  <AdminButtonIcon>📬</AdminButtonIcon>
                  Ιστορικό Email
                </AdminButton>
              )}
              {canManageAll && (
                <AdminButton onClick={() => setIsDocumentTemplatesOpen(true)}>
                  <AdminButtonIcon>📄</AdminButtonIcon>
                  Υποδείγματα Εγγράφων
                </AdminButton>
              )}
            </CategoryBody>
          </CategorySection>
        )}

        {/* Κατηγορία: ΣΥΣΤΗΜΑ - μόνο για SUPERADMIN */}
        {isSuperAdmin && (
          <CategorySection $accentColor="#be185d" $accentGrad="linear-gradient(135deg, #be185d, #ec4899)">
            <CategoryHeader $open={expandedCategories.system} onClick={() => toggleCategory('system')}>
              <CategoryHeaderLeft>
                <CategoryHeaderIcon $accent="linear-gradient(135deg, #be185d, #ec4899)">⚙️</CategoryHeaderIcon>
                <CategoryHeaderTitle>Σύστημα</CategoryHeaderTitle>
              </CategoryHeaderLeft>
              <CategoryHeaderChevron $open={expandedCategories.system}>▶</CategoryHeaderChevron>
            </CategoryHeader>
            <CategoryBody $open={expandedCategories.system}>
              <AdminButton onClick={() => setIsBackupManagerOpen(true)}>
                <AdminButtonIcon>💾</AdminButtonIcon>
                Backup Δεδομένων
              </AdminButton>
              <AdminButton onClick={() => setIsUserManagementOpen(true)}>
                <AdminButtonIcon>👥</AdminButtonIcon>
                Διαχείριση Χρηστών
              </AdminButton>
              <AdminButton onClick={() => setIsEmailSettingsOpen(true)}>
                <AdminButtonIcon>✉</AdminButtonIcon>
                Ρυθμίσεις Email
              </AdminButton>
              <AdminButton onClick={() => setIsMunicipalUnitsOpen(true)}>
                <AdminButtonIcon>🏘</AdminButtonIcon>
                Δημοτικές Ενότητες
              </AdminButton>
            </CategoryBody>
          </CategorySection>
        )}
      </AdminSidebar>

      {/* Subproject Detail Modal */}
      {selectedDetailProject && (
        <SubprojectDetailModal
          project={selectedDetailProject}
          engineerCatalog={engineerCatalogForCards}
          engineerVisibilityContext={engineerVisibilityContext}
          onClose={() => {
            setSelectedDetailProject(null);
            if (!restoreMeletiReturnContext()) {
              restoreNoteReturnContext();
            }
          }}
          onEdit={async (p) => {
            captureDashboardScrollForForm();
            await handleEditProject(p);
            setSelectedDetailProject(null);
          }}
          onOpenFileManager={() => handleOpenFileManager(selectedDetailProject.projectId, selectedDetailProject.subprojectId)}
          userRole={userRole}
          currentUser={currentUser}
          isLocked={selectedDetailProject.isLocked || false}
          lockedBy={selectedDetailProject.lockedBy || ''}
          portalEnabled={portalEnabled}
          isPublishedToPortal={publishedSubprojectIds.has(selectedDetailProject.subprojectId)}
          onTogglePortal={handleTogglePortalSubproject}
          onRefreshProject={async () => {
            await loadDataWithCache(true);
            const refreshed = await ipcRenderer.invoke('load-all-projects');
            if (refreshed && Array.isArray(refreshed)) {
              const updated = refreshed.find(
                (p) => p.subprojectId === selectedDetailProject.subprojectId
              );
              if (updated) setSelectedDetailProject(updated);
            }
            handleBatchSubprojectResolved(selectedDetailProject.subprojectId);
            refreshKhmdhsStaleCount();
          }}
          onEpLinksChanged={refreshEpSubprojectMap}
          directAssignmentViolations={getViolationsForSubproject(
            directAssignmentViolations,
            selectedDetailProject.subprojectId
          )}
          engineerVisibilityContext={engineerVisibilityContext}
          allSubprojects={projects}
        />
      )}

      {/* Project Form Modal */}
      <ProjectForm
        isOpen={isFormOpen}
        onClose={async () => {
          // Ξεκλείδωσε το project αν υπάρχει
          const projectToUnlock = editingProject;
          if (projectToUnlock && projectToUnlock.projectId) {
            try {
              await ipcRenderer.invoke('unlock-project', projectToUnlock.projectId);
              // Functional update ώστε να χρησιμοποιούνται πάντα τα πιο πρόσφατα δεδομένα
              setProjects(prev => prev.map(p => 
                p.projectId === projectToUnlock.projectId ? { ...p, isLocked: false } : p
              ).sort((a, b) => {
                const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
                if (projectComparison !== 0) return projectComparison;
                return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
              }));
            } catch (error) {
              console.error('Error unlocking project:', error);
            }
          }
          setIsFormOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        onDelete={canManageAll ? async (projectId, subprojectId) => {
          if (!projectId || !subprojectId) {
            showToast('Σφάλμα: Μη έγκυρα δεδομένα για διαγραφή', 'error');
            return;
          }
          if (await showConfirm({ title: 'Διαγραφή Υποέργου', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το υποέργο;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
            try {
              // Ξεκλείδωμα πριν τη διαγραφή
              if (editingProject && editingProject.projectId) {
                await ipcRenderer.invoke('unlock-project', editingProject.projectId);
              }
              const result = await ipcRenderer.invoke('delete-subproject', projectId, subprojectId);
              if (result.success) {
                setIsFormOpen(false);
                setEditingProject(null);
                setProjects([]);
                setFilteredProjects([]);
                await loadProjects();
                await loadLinkedEgkriseis();
                showToast('Το υποέργο διαγράφηκε επιτυχώς!', 'success');
              } else {
                showToast('Σφάλμα κατά τη διαγραφή: ' + result.error, 'error');
              }
            } catch (error) {
              showToast('Σφάλμα κατά τη διαγραφή: ' + error.message, 'error');
            }
          }
        } : undefined}
        editingProject={editingProject}
        userRole={userRole}
        allProjects={projects}
      />


      {/* PDF Viewer Modal */}
      {pdfViewer.isOpen ? (
        <Suspense fallback={null}>
          <PDFViewer
            isOpen={pdfViewer.isOpen}
            filePath={pdfViewer.filePath}
            fileName={pdfViewer.fileName}
            onClose={() => setPdfViewer({ isOpen: false, filePath: '', fileName: '' })}
          />
        </Suspense>
      ) : null}

      {/* Advanced Filters Modal */}
      <AdvancedFilters
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApplyFilters={handleApplyAdvancedFilters}
        currentFilters={advancedFilters}
        projects={visibleProjects}
        engineerCatalog={engineerCatalogForCards}
      />

      {/* File Manager Modal */}
      {fileManager.isOpen && (
        <FileManager
          files={fileManager.files}
          fileGroups={fileManager.fileGroups}
          khmdhsDocumentRegistry={fileManager.khmdhsDocumentRegistry}
          khmdhsRelatedDocuments={fileManager.khmdhsRelatedDocuments}
          userRole={userRole}
          canUpload={userRole !== 'USER'}
          isUploading={fileManagerUploading}
          onUploadFiles={handleUploadSubprojectFilesFromManager}
          onUploadFolder={() => handleUploadSubprojectFolder(fileManager.projectId, fileManager.subprojectId)}
          onViewFile={(fileName) => handleViewFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onDownloadFile={(fileName) => handleDownloadFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onDeleteFile={(fileName) => handleDeleteFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onDeleteFiles={(fileNames) => handleDeleteFiles(fileManager.projectId, fileManager.subprojectId, fileNames)}
          onClose={handleCloseFileManager}
          onRefresh={() => handleOpenFileManager(fileManager.projectId, fileManager.subprojectId)}
          onGroupFiles={handleGroupFiles}
        />
      )}

      {/* Export Data Modal */}
      {isExportOpen ? (
        <Suspense fallback={null}>
          <ExportData
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            projects={exportProjects}
            totalProjects={excludeAbandonedSubprojects(projects).length}
            organizationName={appConfig?.organizationFullName || ''}
            appVersion={appVersion}
          />
        </Suspense>
      ) : null}

      {/* Technical Program Export Modal */}
      {isTechnicalProgramOpen ? (
        <Suspense fallback={null}>
          <TechnicalProgramExport
            isOpen={isTechnicalProgramOpen}
            onClose={() => setIsTechnicalProgramOpen(false)}
            projects={excludeAbandonedSubprojects(projects)}
            organizationName={appConfig?.organizationFullName || ''}
            currentUser={currentUser}
            appConfig={appConfig}
          />
        </Suspense>
      ) : null}

      {/* Reports Modal */}
      {isReportsOpen ? (
        <Suspense fallback={null}>
          <ReportsModal
            projects={exportProjects}
            entaxeis={entaxeis}
            proskliseis={proskliseis}
            appConfig={appConfig}
            initialTab={reportsInitialTab}
            onClose={() => setIsReportsOpen(false)}
          />
        </Suspense>
      ) : null}

      {/* Invest Export Modal */}
      {isInvestExportOpen ? (
        <Suspense fallback={null}>
          <InvestExport
            isOpen={isInvestExportOpen}
            onClose={() => setIsInvestExportOpen(false)}
          />
        </Suspense>
      ) : null}

      {/* Portal Diafanias Export Modal */}
      {isPortalExportOpen ? (
        <Suspense fallback={null}>
          <PortalExport
            isOpen={isPortalExportOpen}
            onClose={() => setIsPortalExportOpen(false)}
            projects={excludeAbandonedSubprojects(projects)}
            currentUser={currentUser}
            appConfig={appConfig}
            onDimosUidSaved={(uid) => {
              // Ενημέρωση του τοπικού appConfig αντικειμένου ώστε το
              // modal να μην ξαναζητά το slug στην ίδια session
              if (appConfig && !appConfig.portalDimosUid) {
                appConfig.portalDimosUid = uid;
              }
            }}
          />
        </Suspense>
      ) : null}

      {/* Entaxis Manager Modal */}
      {isEntaxisOpen ? (
      <Suspense fallback={<LazyChunkFallback>Φόρτωση εντάξεων…</LazyChunkFallback>}>
      <EntaxisManager
        isOpen={isEntaxisOpen}
        selectedEntaxiId={selectedEntaxiId}
        onClose={async () => {
          await ipcRenderer.invoke('clear-all-locks');
          setIsEntaxisOpen(false);
          setEntaxisProjectFilter(null);
          setSelectedEntaxiId(null);
          await loadProjects();
          setTimeout(() => {
            if (dashboardScrollRef.current) {
              dashboardScrollRef.current.scrollTop = savedScrollPosition.current;
            }
          }, 100);
          restoreNoteReturnContext();
        }}
        onDataChange={async () => {
          await loadProjects();
          await loadEntaxeis();
        }} // Callback για ανανέωση όταν αλλάζουν δεδομένα
        userRole={userRoleForWorkflowModals}
        currentUser={currentUser}
        projectFilter={entaxisProjectFilter}
        proskliseis={proskliseis}
        handleOpenProsklisi={handleOpenLinkedProsklisi}
        onViewFile={(filePath, fileName) => {
          setPdfViewer({
            isOpen: true,
            filePath,
            fileName
          });
        }}
        linkedNotesMap={linkedNotesMap}
        notes={notes}
        onOpenNoteFromEntity={handleOpenNoteFromEntity}
        organizationName={appConfig?.organizationFullName || ''}
      />
      </Suspense>
      ) : null}

      {/* Ωρίμανση Έργων */}
      {isOrimanthiOpen ? (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση Ωρίμανσης Έργων…</LazyChunkFallback>}>
          <OrimanthiManager
            onClose={() => setIsOrimanthiOpen(false)}
            loggedInUsername={currentUser?.username || ''}
            userRole={userRole}
            orimanthiCanEdit={!!currentUser?.orimanthiCanEdit}
          />
        </Suspense>
      ) : null}

      {/* Μητρώο Μελετών */}
      {isMeletaiOpen ? (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση Μητρώου Μελετών…</LazyChunkFallback>}>
          <MeletaiManager
            onClose={() => {
              clearMeletiReturnContext();
              setIsMeletaiOpen(false);
              setSelectedMeletiId(null);
              refreshMeletaiSubprojectMap();
              setTimeout(() => {
                if (dashboardScrollRef.current) {
                  dashboardScrollRef.current.scrollTop = savedScrollPosition.current;
                }
              }, 100);
            }}
            loggedInUsername={currentUser?.username || ''}
            userRole={userRole}
            meletaiCanEdit={!!currentUser?.meletaiCanEdit}
            visibleSubprojectIds={engineerVisibleSubprojectIds}
            initialMeletiId={selectedMeletiId}
            onNavigateToSubproject={handleNavigateToSubprojectFromMeleti}
            initialDetailScrollTop={meletaiRestoreScrollTop}
            onDetailScrollRestored={() => setMeletaiRestoreScrollTop(0)}
          />
        </Suspense>
      ) : null}

      {/* EP Program Manager */}
      {isEpProgramOpen ? (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση Επιχειρησιακού Προγράμματος…</LazyChunkFallback>}>
          <EpProgramManager
            isOpen={isEpProgramOpen}
            onClose={() => {
              setIsEpProgramOpen(false);
              refreshEpSubprojectMap();
              setTimeout(() => {
                if (dashboardScrollRef.current) {
                  dashboardScrollRef.current.scrollTop = savedScrollPosition.current;
                }
              }, 100);
            }}
            currentUser={currentUser}
            appConfig={appConfig}
            canManageAll={canManageAll}
          />
        </Suspense>
      ) : null}

      {/* Prosklisis Manager Modal */}
      {isProsklisisOpen ? (
      <Suspense fallback={<LazyChunkFallback>Φόρτωση προσκλήσεων…</LazyChunkFallback>}>
      <ProsklisisManager
        isOpen={isProsklisisOpen}
        onClose={async () => {
          await ipcRenderer.invoke('clear-all-locks');
          setIsProsklisisOpen(false);
          setProsklisiProjectFilter(null);
          setSelectedProsklisiId(null);
          await loadProjects();
          setTimeout(() => {
            if (dashboardScrollRef.current) {
              dashboardScrollRef.current.scrollTop = savedScrollPosition.current;
            }
          }, 100);
          restoreNoteReturnContext();
        }}
        userRole={userRoleForWorkflowModals}
        currentUser={currentUser}
        projectFilter={prosklisiProjectFilter}
        selectedProsklisiId={selectedProsklisiId}
        linkedNotesMap={linkedNotesMap}
        notes={notes}
        onOpenNoteFromEntity={handleOpenNoteFromEntity}
        organizationName={appConfig?.organizationFullName || ''}
      />
      </Suspense>
      ) : null}


      {/* Egkriseis Form Modal */}
      {(isEgkriseisFormOpen) ? (
      <Suspense fallback={<LazyChunkFallback>Φόρτωση φόρμας…</LazyChunkFallback>}>
      <EgkriseisForm
        isOpen={isEgkriseisFormOpen}
        onClose={async () => {
          await ipcRenderer.invoke('clear-all-locks');
          setIsEgkriseisFormOpen(false);
          // Reload projects and linked egkriseis to update any changes
          await loadProjects();
          await loadLinkedEgkriseis();
        }}
        onSave={async () => {
          // Reload projects and linked egkriseis to update any changes
          await loadProjects();
          await loadLinkedEgkriseis();
          
          // Trigger refresh στο CreditApprovalsPanel αν είναι ανοιχτό
          // Χρήση requestAnimationFrame για non-blocking update
          if (isCreditApprovalsOpen) {
            requestAnimationFrame(() => {
              setEgkriseisRefreshTrigger(prev => prev + 1);
            });
          }
        }}
      />
      </Suspense>
      ) : null}

      {isNotesOpen && (() => {
        const selNote = selectedNoteId ? notes.find(n => n.id === selectedNoteId) : null;
        const isReminderPast = selNote?.reminderDate && new Date(selNote.reminderDate + 'T' + (selNote.reminderTime || '09:00')) < new Date();
        return (
          <NotesOverlay onClick={(e) => e.target === e.currentTarget && handleCloseNotes()}>
            <NotesPanel onClick={(e) => e.stopPropagation()}>
              <NotesHeader>
                <h2>Γρήγορες Σημειώσεις</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <NewNoteBtn type="button" onClick={() => { setEditingNote({}); }} style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
                    + Νέα Σημείωση
                  </NewNoteBtn>
                  <NotesCloseBtn onClick={handleCloseNotes}>✕</NotesCloseBtn>
                </div>
              </NotesHeader>
              <NotesLayout>
                <NotesListCol>
                  <NoteSearchBar
                    type="text"
                    placeholder="🔍 Αναζήτηση..."
                    value={notesSearch}
                    onChange={(e) => setNotesSearch(e.target.value)}
                  />
                  {filteredNotes.length === 0 ? (
                    <NotesEmpty style={{ minHeight: '100px', marginTop: '8px' }}>Δεν υπάρχουν σημειώσεις</NotesEmpty>
                  ) : (
                    <NotesList>
                      {filteredNotes.map(note => {
                        const isSelected = selectedNoteId === note.id;
                        return (
                          <NoteItem
                            key={note.id}
                            onClick={() => setSelectedNoteId(note.id)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? '#eef2ff' : undefined,
                              borderLeftColor: isSelected ? '#6366f1' : undefined,
                              boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.1)' : undefined
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <NoteItemTitle style={{ flex: 1, marginBottom: 0 }}>{note.title || 'Χωρίς τίτλο'}</NoteItemTitle>
                              <span title={note.visibility === 'private' ? 'Προσωπική' : note.visibility === 'roles' ? 'Ορατή σε ρόλους' : note.visibility === 'users' ? 'Ορατή σε χρήστες' : 'Προσωπική'} style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                {note.visibility === 'roles' ? '👥' : note.visibility === 'users' ? '👤' : '🔒'}
                              </span>
                            </div>
                            {note.content && <NoteItemContent>{note.content}</NoteItemContent>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                              <NoteItemDate>
                                {note.createdBy && note.createdBy !== (currentUser?.username || '') && (
                                  <span style={{ fontWeight: 600, color: '#6366f1', marginRight: '4px' }}>{note.createdBy}</span>
                                )}
                                {new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString('el-GR', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </NoteItemDate>
                              {noteFileCounts[note.id] > 0 && (
                                <NoteFilesBadge>📎 {noteFileCounts[note.id]}</NoteFilesBadge>
                              )}
                              {note.linkedEntities && note.linkedEntities.length > 0 && (
                                <NoteLinksBadge>🔗 {note.linkedEntities.length}</NoteLinksBadge>
                              )}
                              {note.reminderDate && (
                                <NoteReminderBadge $past={note.reminderDate && new Date(note.reminderDate + 'T' + (note.reminderTime || '09:00')) < new Date()}>
                                  🔔 {formatDateEl(note.reminderDate, '')}
                                </NoteReminderBadge>
                              )}
                            </div>
                            {note.createdBy === (currentUser?.username || '') && (
                              <NoteItemActions onClick={(e) => e.stopPropagation()}>
                                <NoteActionBtn type="button" title="Επεξεργασία" onClick={(e) => { e.stopPropagation(); handleEditNote(note); }}>✏</NoteActionBtn>
                                <NoteActionBtn type="button" title="Διαγραφή" $danger onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}>✕</NoteActionBtn>
                              </NoteItemActions>
                            )}
                          </NoteItem>
                        );
                      })}
                    </NotesList>
                  )}
                </NotesListCol>
                <NotePreviewCol>
                  {selNote ? (
                    <>
                      <NotePreviewTitle>{selNote.title || 'Χωρίς τίτλο'}</NotePreviewTitle>
                      <NotePreviewContent>{selNote.content || '(Κενό περιεχόμενο)'}</NotePreviewContent>

                      {(selNote.reminderDate || previewFiles.length > 0) && (
                        <NotePreviewSection>
                          {selNote.reminderDate && (
                            <div>
                              <NotePreviewSectionLabel>Υπενθύμιση</NotePreviewSectionLabel>
                              <NoteReminderBadge $past={isReminderPast} style={{ marginTop: '4px', padding: '5px 12px', fontSize: '0.8rem' }}>
                                🔔 {formatDateEl(selNote.reminderDate, '')}{selNote.reminderTime ? ` στις ${selNote.reminderTime}` : ''}{isReminderPast ? ' — παρήλθε' : ''}
                              </NoteReminderBadge>
                            </div>
                          )}
                          {previewFiles.length > 0 && (
                            <div>
                              <NotePreviewSectionLabel>Επισυναπτόμενα ({previewFiles.length})</NotePreviewSectionLabel>
                              <NoteFilesSection style={{ margin: '6px 0 0' }}>
                                {previewFiles.map(f => (
                                  <NoteFileItem key={f.name}>
                                    <span style={{ fontSize: '0.85rem' }}>📎</span>
                                    <NoteFileName>{f.name}</NoteFileName>
                                    <NoteFileBtn type="button" title="Άνοιγμα" onClick={async () => { await ipcRenderer.invoke('open-note-file', { noteId: selNote.id, fileName: f.name }); }}>👁</NoteFileBtn>
                                    {selNote.createdBy === (currentUser?.username || '') && (
                                      <NoteFileBtn type="button" title="Διαγραφή" $danger onClick={async () => {
                                        const res = await ipcRenderer.invoke('delete-note-file', { noteId: selNote.id, fileName: f.name });
                                        if (res?.success) {
                                          setPreviewFiles(prev => prev.filter(x => x.name !== f.name));
                                          loadNoteFileCounts();
                                        }
                                      }}>✕</NoteFileBtn>
                                    )}
                                  </NoteFileItem>
                                ))}
                              </NoteFilesSection>
                            </div>
                          )}
                        </NotePreviewSection>
                      )}

                      {selNote.linkedEntities && selNote.linkedEntities.length > 0 && (
                        <NotePreviewSection>
                          <NotePreviewSectionLabel>Συσχετίσεις ({selNote.linkedEntities.length})</NotePreviewSectionLabel>
                          <LinkedChipsWrap style={{ marginTop: '4px' }}>
                            {selNote.linkedEntities.map(ent => {
                              const meta = ENTITY_TYPE_META[ent.type] || { icon: '🔗', label: ent.type };
                              return (
                                <NoteLinkedChipPreview key={`${ent.type}-${ent.id}`} title={`Μετάβαση σε: ${meta.label} — ${ent.title}`} onClick={() => handleNavigateToLinkedEntity(ent)}>
                                  <span>{meta.icon}</span>
                                  <span className="chip-title">{ent.title}</span>
                                </NoteLinkedChipPreview>
                              );
                            })}
                          </LinkedChipsWrap>
                        </NotePreviewSection>
                      )}

                      <NotePreviewMeta>
                        {selNote.createdBy && (
                          <span style={{ fontWeight: 600, color: '#6366f1' }}>
                            ✍ {selNote.createdBy}
                          </span>
                        )}
                        <span>
                          {selNote.visibility === 'private' ? '🔒 Προσωπική' : selNote.visibility === 'roles' ? `👥 Ορατή σε: ${(selNote.visibleToRoles || []).join(', ')}` : selNote.visibility === 'users' ? `👤 Ορατή σε: ${(selNote.visibleToUsers || []).join(', ')}` : '🔒 Προσωπική'}
                        </span>
                        <span>Δημιουργία: {new Date(selNote.createdAt || Date.now()).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {selNote.updatedAt && selNote.updatedAt !== selNote.createdAt && (
                          <span>Ενημέρωση: {new Date(selNote.updatedAt).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </NotePreviewMeta>
                      {selNote.createdBy === (currentUser?.username || '') && (
                        <NotePreviewActions>
                          <NotePreviewBtn $primary onClick={() => handleEditNote(selNote)}>✏ Επεξεργασία</NotePreviewBtn>
                          <NotePreviewBtn onClick={() => handleDeleteNote(selNote.id)}>🗑 Διαγραφή</NotePreviewBtn>
                        </NotePreviewActions>
                      )}
                    </>
                  ) : (
                    <NotePreviewEmpty>
                      <span style={{ fontSize: '2rem', opacity: 0.4 }}>📝</span>
                      Επιλέξτε μια σημείωση για προβολή
                    </NotePreviewEmpty>
                  )}
                </NotePreviewCol>
              </NotesLayout>
            </NotesPanel>

            {editingNote && (
              <NoteEditModal
                note={editingNote}
                onSave={handleSaveNote}
                onCancel={handleCancelEdit}
                currentUser={currentUser}
              />
            )}
          </NotesOverlay>
        );
      })()}

      {/* Egkriseis Manager Modal */}
      {(isEgkriseisFormOpen || isEgkriseisManagerOnly) ? (
      <Suspense fallback={<LazyChunkFallback>Φόρτωση εγκρίσεων…</LazyChunkFallback>}>
      <EgkriseisManager
        isOpen
        onClose={async () => {
          await ipcRenderer.invoke('clear-all-locks');
          setIsEgkriseisFormOpen(false);
          setIsEgkriseisManagerOnly(false);
          setEgkriseisInitialSearch('');
          await loadLinkedEgkriseis();
          scheduleDocumentInteractionRecovery();
        }}
        onLinkCreated={async () => {
          await loadLinkedEgkriseis();
        }}
        projects={projectsAsArrayOfArrays}
        userRole={userRoleForWorkflowModals}
        currentUser={currentUser}
        linkedNotesMap={linkedNotesMap}
        onOpenNoteFromEntity={handleOpenNoteFromEntity}
        initialSearchTerm={egkriseisInitialSearch}
      />
      </Suspense>
      ) : null}

      {/* Document Templates Manager */}
      {isDocumentTemplatesOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
          <DocumentTemplatesManager
            onClose={() => {
              setIsDocumentTemplatesOpen(false);
              scheduleDocumentInteractionRecovery();
            }}
          />
        </Suspense>
      )}

      {isBackupManagerOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
          <BackupManager
            isOpen={isBackupManagerOpen}
            onClose={() => setIsBackupManagerOpen(false)}
          />
        </Suspense>
      )}

      {isAuditLogOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
          <AuditLogViewer
            isOpen={isAuditLogOpen}
            onClose={() => setIsAuditLogOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isProcurementCalendarOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση ημερολογίου…</LazyChunkFallback>}>
          <ProcurementCalendar
            isOpen={isProcurementCalendarOpen}
            initialCustomEventId={calendarFocusCustomEventId}
            onClose={() => {
              setIsProcurementCalendarOpen(false);
              setCalendarFocusCustomEventId(null);
              setCalendarRefreshKey((k) => k + 1);
            }}
            onCalendarDataChanged={() => setCalendarRefreshKey((k) => k + 1)}
            projects={projects}
            userRole={userRole}
            currentUser={currentUser}
            engineerCatalog={engineerCatalogForCards}
            includeAepo={userRole === 'ADMIN' || userRole === 'SUPERADMIN' || !!currentUser?.orimanthiCanEdit}
            onOpenOrimanthi={() => {
              setIsProcurementCalendarOpen(false);
              setIsOrimanthiOpen(true);
            }}
            onViewSubproject={(subprojectId) => {
              setIsProcurementCalendarOpen(false);
              const p = projects.find((x) => x.subprojectId === subprojectId);
              if (p) openSubprojectDetail(p);
            }}
          />
        </Suspense>
      )}

      {isStatisticsModalOpen && (
        <Suspense fallback={null}>
          <StatisticsModal
            isOpen={isStatisticsModalOpen}
            onClose={() => setIsStatisticsModalOpen(false)}
            projects={statisticsProjects}
            directAssignmentViolations={statisticsDirectAssignmentViolations}
            loggedInUsername={currentUser?.username || ''}
            statisticsScopeNote={statisticsScopeNote}
            onPortfolioDrillDown={(label, ids) => {
              setIsStatisticsModalOpen(false);
              handlePortfolioDrillDown(label, ids);
            }}
            statisticsFilterNote={statisticsFilterNote}
          />
        </Suspense>
      )}

      {currentUser?.username && (
        <TaskAssignmentToastHost
          actingUsername={currentUser.username}
          onOpenTaskAssignment={openTaskAssignmentsFromToast}
          onNotificationConsumed={refreshTaskAccess}
        />
      )}

      {isTaskAssignmentsOpen ? (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση χώρων εργασίας…</LazyChunkFallback>}>
          <TaskAssignmentManager
            isOpen={isTaskAssignmentsOpen}
            onClose={() => {
              setIsTaskAssignmentsOpen(false);
              setTaskAssignmentsFocusTaskId(null);
            }}
            currentUser={currentUser}
            isSuperAdmin={isSuperAdmin}
            onAccessRefresh={refreshTaskAccess}
            focusTaskId={taskAssignmentsFocusTaskId}
            onFocusTaskConsumed={handleFocusTaskConsumed}
            initialScreen={taskAssignmentInitialScreen}
          />
        </Suspense>
      ) : null}

      {isUserManagementOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
          <UserManagement
            onClose={() => {
              setIsUserManagementOpen(false);
              loadEngineerCatalogForCards();
            }}
            onUsersChanged={loadEngineerCatalogForCards}
            currentUser={currentUser}
            onSyncCurrentUser={onSyncCurrentUser}
          />
        </Suspense>
      )}

      {isEmailSettingsOpen && (
        <Suspense fallback={null}>
          <EmailSettingsModal
            onClose={() => setIsEmailSettingsOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isCalendarSettingsOpen && (
        <Suspense fallback={null}>
          <NotificationSettingsCenter
            onClose={() => setIsCalendarSettingsOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isMyNotifPrefsOpen && (
        <Suspense fallback={null}>
          <MyNotificationPreferences
            onClose={() => setIsMyNotifPrefsOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isEmailHistoryOpen && (
        <Suspense fallback={null}>
          <EmailSendHistory
            onClose={() => setIsEmailHistoryOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isMunicipalUnitsOpen && (
        <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
          <MunicipalUnitsManager
            onClose={() => setIsMunicipalUnitsOpen(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {isPortalSettingsOpen && (
        <Suspense fallback={null}>
          <PortalSettingsModal
            isOpen={isPortalSettingsOpen}
            onClose={() => setIsPortalSettingsOpen(false)}
            appConfig={{ ...appConfig, portalEnabled, portalDimosUid: appConfig.portalDimosUid, portalExportFields: appConfig.portalExportFields, portalMergeCompleted: appConfig.portalMergeCompleted }}
            onConfigSaved={({ portalEnabled: enabled, portalDimosUid: uid, portalPublicUrl: purl, portalExportFields: fields, portalMergeCompleted: merge }) => {
              setPortalEnabled(enabled);
              appConfig.portalEnabled = enabled;
              appConfig.portalDimosUid = uid;
              if (purl !== undefined) appConfig.portalPublicUrl = purl;
              if (fields) appConfig.portalExportFields = fields;
              appConfig.portalMergeCompleted = !!merge;
            }}
          />
        </Suspense>
      )}

      {isPortalHubOpen && (
        <Suspense fallback={null}>
          <PortalHubModal
            isOpen={isPortalHubOpen}
            onClose={() => setIsPortalHubOpen(false)}
            projects={projects}
            currentUser={currentUser}
            appConfig={{ ...appConfig, portalEnabled, portalDimosUid: appConfig.portalDimosUid, portalPublicUrl: appConfig.portalPublicUrl, portalExportFields: appConfig.portalExportFields, portalMergeCompleted: appConfig.portalMergeCompleted }}
            isSuperAdmin={isSuperAdmin}
            onConfigSaved={({ portalEnabled: enabled, portalDimosUid: uid, portalPublicUrl: purl, portalExportFields: fields, portalMergeCompleted: merge }) => {
              setPortalEnabled(enabled);
              appConfig.portalEnabled = enabled;
              appConfig.portalDimosUid = uid;
              if (purl !== undefined) appConfig.portalPublicUrl = purl;
              if (fields) appConfig.portalExportFields = fields;
              appConfig.portalMergeCompleted = !!merge;
            }}
            onDimosUidSaved={(uid) => { appConfig.portalDimosUid = uid; }}
          />
        </Suspense>
      )}


      {(canManageAll || isEngineer) && !isNotesOpen && (
        <NotesFab onClick={handleOpenNotes} title="Γρήγορες Σημειώσεις">
          📝
        </NotesFab>
      )}

      <KhmdhsBatchReportFab
        pendingItems={batchPendingItems}
        onClick={() => setIsBatchReportOpen(true)}
        isRunning={khmdhsBatchRunning}
        hasReport={!!batchReportResults}
      />

      <KhmdhsBatchReportModal
        isOpen={isBatchReportOpen}
        onClose={() => setIsBatchReportOpen(false)}
        results={batchReportResults}
        pendingItems={batchPendingItems}
        onNavigateToSubproject={(subprojectId) => {
          const p = projects.find((row) => row.subprojectId === subprojectId);
          if (p) openSubprojectDetail(p);
        }}
      />

    </DashboardContainer>
  );
}

export default Dashboard;
