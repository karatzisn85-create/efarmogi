import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { css } from 'styled-components';
import TaskAssignmentForm from './TaskAssignmentForm';
import TaskAssignmentWorkspace from './TaskAssignmentWorkspace';
import { DISMISS_TASK_EVENT } from './TaskAssignmentToastHost';
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  formatTaskDueDate,
  isTaskOverdue,
  isTaskWithdrawnByAssigner,
  formatAssigneeDisplayNames
} from '../utils/taskAssignmentDisplay';
import { containsSearchTerm } from '../utils/searchUtils';
import {
  resetDocumentInteractionState,
  scheduleDocumentInteractionRecovery
} from '../utils/documentInteractionReset';

const ipcRenderer = window.electronAPI;

/** Πλήρης οθόνη εντός της εφαρμογής — χωρίς σκοτεινό υπόβαθρο / ελαστικό modal. */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #fff;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: visible;
`;

const Container = styled.div`
  flex: 1;
  min-height: 0;
  width: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Top = styled.div`
  flex-shrink: 0;
  padding: ${(p) => (p.$compact ? '0.36rem 0.75rem 0.4rem' : '0.95rem 1.35rem 1rem')};
  border-bottom: 1px solid #dce3fb;
  position: relative;
  background: linear-gradient(180deg, #f5f3ff 0%, #eef2ff 42%, #f8fafc 100%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;
`;

const ScreenSubtitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  margin-top: 0.35rem;
  padding-left: 0.65rem;
  max-width: min(52rem, 100%);
`;

const ScreenSubtitle = styled.p`
  margin: 0;
  font-size: ${(p) => (p.$compact ? '0.78rem' : '0.88rem')};
  line-height: 1.45;
  color: #64748b;
  font-weight: 500;
`;

const ArchiveHelpTrigger = styled.button`
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: #15803d;
  font-size: ${(p) => (p.$compact ? '0.74rem' : '0.8rem')};
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
  &:hover {
    color: #166534;
  }
`;

const ARCHIVE_INFO_DISMISS_KEY = 'ef-work-archive-info-dismissed';

function readArchiveInfoDismissed(username) {
  if (!username) return false;
  try {
    return localStorage.getItem(`${ARCHIVE_INFO_DISMISS_KEY}:${username}`) === '1';
  } catch {
    return false;
  }
}

function persistArchiveInfoDismissed(username) {
  if (!username) return;
  try {
    localStorage.setItem(`${ARCHIVE_INFO_DISMISS_KEY}:${username}`, '1');
  } catch {
    /* ignore */
  }
}

function clearArchiveInfoDismissed(username) {
  if (!username) return;
  try {
    localStorage.removeItem(`${ARCHIVE_INFO_DISMISS_KEY}:${username}`);
  } catch {
    /* ignore */
  }
}

const ArchiveInfoBanner = styled.div`
  flex-shrink: 0;
  margin: 0 0.75rem 0.35rem;
  padding: 0.38rem 0.5rem 0.38rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
  font-size: 0.78rem;
  line-height: 1.35;
`;

const ArchiveInfoRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
`;

const ArchiveInfoText = styled.div`
  flex: 1;
  min-width: 0;
  font-weight: 500;
`;

const ArchiveInfoDetails = styled.p`
  margin: 0.3rem 0 0;
  color: #15803d;
  font-weight: 500;
`;

const ArchiveInfoActions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.1rem;
`;

const ArchiveInfoLinkBtn = styled.button`
  border: none;
  background: transparent;
  color: #15803d;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  border-radius: 6px;
  font-family: inherit;
  white-space: nowrap;
  &:hover {
    background: rgba(21, 128, 61, 0.1);
  }
`;

const ArchiveInfoCloseBtn = styled.button`
  border: none;
  background: transparent;
  color: #166534;
  font-size: 1.05rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-family: inherit;
  opacity: 0.75;
  &:hover {
    opacity: 1;
    background: rgba(21, 128, 61, 0.12);
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${(p) => (p.$compact ? '0.28rem' : '0.65rem')};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${(p) => (p.$compact ? '1.05rem' : '1.38rem')};
  color: #0f172a;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &::before {
    content: '';
    width: 4px;
    height: ${(p) => (p.$compact ? '1.05rem' : '1.35rem')};
    border-radius: 4px;
    background: linear-gradient(180deg, #6366f1, #4f46e5);
  }
`;

const CloseBtn = styled.button`
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: ${(p) => (p.$compact ? '0.28rem 0.65rem' : '0.5rem 1rem')};
  border-radius: ${(p) => (p.$compact ? '8px' : '10px')};
  cursor: pointer;
  font-size: ${(p) => (p.$compact ? '0.8rem' : '0.88rem')};
  font-weight: 700;
  letter-spacing: 0.03em;
  font-family: inherit;
  color: #334155;
  min-height: ${(p) => (p.$compact ? '32px' : '46px')};
  &:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }
`;

const ActionsBarWrap = styled.div`
  position: relative;
`;

const TabBtn = styled.button`
  padding: 0.48rem 0.95rem;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$active ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.14)' : '#fff')};
  color: ${(p) => (p.$active ? '#3730a3' : '#334155')};
  font-weight: 600;
  font-size: 0.93rem;
  cursor: pointer;
  font-family: inherit;
  min-height: 46px;
`;

const PrimaryBtn = styled.button`
  padding: 0.5rem 1.05rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  font-weight: 700;
  font-size: 0.93rem;
  cursor: pointer;
  font-family: inherit;
  min-height: 46px;
`;

const SearchInput = styled.input`
  padding: 0.52rem 0.85rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.98rem;
  min-width: 210px;
  min-height: 46px;
  font-family: inherit;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
`;

const FilterSelectFull = styled.select`
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 0.88rem;
  font-family: inherit;
  min-height: 40px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  box-sizing: border-box;
`;

const FilterMegaPanel = styled.div`
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: min(360px, calc(100vw - 2rem));
  padding: 1rem 1.05rem;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e8eef4;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.05),
    0 18px 42px rgba(15, 23, 42, 0.14);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const FilterMegaSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const FilterMegaLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #64748b;
`;

const FilterChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`;

const FilterChip = styled.button`
  padding: 0.34rem 0.65rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.14)' : '#fff')};
  color: ${(p) => (p.$active ? '#3730a3' : '#475569')};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  &:hover {
    border-color: #c7d2fe;
    background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.14)' : '#f8fafc')};
  }
`;

const ToolbarSearch = styled(SearchInput)`
  flex: 1 1 120px;
  min-width: 100px;
  max-width: min(260px, 40vw);
  min-height: 40px;
  ${(p) =>
    p.$dense &&
    css`
      min-height: 32px;
      font-size: 0.82rem;
      padding: 0.28rem 0.58rem;
      max-width: min(220px, 42vw);
    `}
`;

const NotifBackdrop = styled.button`
  position: fixed;
  inset: 0;
  z-index: 50;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(2px);
`;

const ActionsBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;

  ${(p) =>
    p.$dense &&
    css`
      gap: 0.34rem;
      row-gap: 0.34rem;
      ${TabBtn}, ${PrimaryBtn} {
        min-height: 32px;
        padding: 0.24rem 0.62rem;
        font-size: 0.78rem;
        border-radius: 8px;
      }
      ${ToolbarSearch} {
        min-height: 32px;
        padding: 0.28rem 0.58rem;
        font-size: 0.82rem;
        border-radius: 8px;
      }
    `}
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const SIDEBAR_FULL = 'clamp(156px, 12vw, 196px)';
const SIDEBAR_BROWSE = 'clamp(148px, 11vw, 184px)';

const Sidebar = styled.div`
  width: ${(p) => {
    if (p.$hidden) return '0';
    if (p.$mode === 'full') return SIDEBAR_FULL;
    return SIDEBAR_BROWSE;
  }};
  min-width: ${(p) => {
    if (p.$hidden) return '0';
    if (p.$mode === 'full') return SIDEBAR_FULL;
    return SIDEBAR_BROWSE;
  }};
  border-right: ${(p) => (p.$hidden ? 'none' : '1px solid #e2e8f0')};
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%);
  transition: width 0.22s ease, min-width 0.22s ease;
`;

const SidebarScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.45rem 0.5rem;
`;

const WorkspaceArea = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const EmptyWorkspace = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1.25rem;
  text-align: center;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-left: 1px solid #e8eef4;
`;

const EmptyPanel = styled.div`
  max-width: min(440px, 100%);
  padding: 1.75rem 2rem;
  border-radius: 14px;
  border: 1px solid #e8eef4;
  background: #fff;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
  color: #64748b;
`;

const EmptyIcon = styled.div`
  font-size: 3.25rem;
  margin-bottom: 1rem;
  opacity: 0.55;
`;

const EmptyHeading = styled.h3`
  margin: 0 0 0.65rem;
  color: #475569;
  font-weight: 700;
  font-size: 1.28rem;
  line-height: 1.3;
`;

const EmptyText = styled.p`
  margin: 0;
  max-width: 460px;
  line-height: 1.58;
  font-size: 1.03rem;
  color: #64748b;
`;

const ListHint = styled.p`
  margin: 0;
  color: #475569;
  font-size: 0.98rem;
  line-height: 1.55;
`;

const TaskCard = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.48rem 0.52rem;
  margin-bottom: 0.38rem;
  border: 1px solid ${(p) => (p.$active ? '#818cf8' : '#e8eef4')};
  border-radius: 10px;
  background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.07)' : '#fff')};
  cursor: pointer;
  font-family: inherit;
  box-shadow: ${(p) => (p.$active ? '0 0 0 1px rgba(129, 140, 248, 0.35)' : '0 1px 2px rgba(15, 23, 42, 0.04)')};
  transition: border-color 0.15s, background 0.15s;
  &:hover {
    border-color: #a5b4fc;
    background: #f8fafc;
  }
`;

const CardTitle = styled.div`
  font-weight: 700;
  font-size: 0.82rem;
  color: #0f172a;
  margin-bottom: 0.28rem;
  line-height: 1.28;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem 0.45rem;
  align-items: center;
  font-size: 0.68rem;
  color: #475569;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.12rem 0.42rem;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  background: ${(p) => p.$bg || '#e2e8f0'};
  color: ${(p) => p.$color || '#334155'};
`;

const PriorityPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  ${(p) => {
    const pr = String(p.$priority || 'normal');
    if (pr === 'high') {
      return css`
        background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%);
        color: #991b1b;
        border: 1px solid #fecaca;
      `;
    }
    if (pr === 'low') {
      return css`
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        color: #64748b;
        border: 1px solid #e2e8f0;
      `;
    }
    return css`
      background: linear-gradient(180deg, #fafbff 0%, #eef2ff 100%);
      color: #3730a3;
      border: 1px solid #c7d2fe;
    `;
  }}
`;

const WithdrawBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.38rem;
  border-radius: 6px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fde047;
`;

const NotifPanel = styled.div`
  position: fixed;
  right: 0.85rem;
  top: 4.25rem;
  width: min(380px, calc(100vw - 1.25rem));
  max-height: min(460px, calc(100vh - 5.5rem));
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(180deg, #fafbff 0%, #ffffff 35%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 22px 48px rgba(30, 27, 75, 0.18);
  z-index: 60;
  padding: 0.85rem 1rem 1rem;
  padding-top: 2.35rem;
`;

const NotifCloseBtn = styled.button`
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: rgba(15, 23, 42, 0.11);
    color: #0f172a;
  }
`;

const NotifItem = styled.div`
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  margin-bottom: 0.45rem;
  font-size: 0.93rem;
  cursor: pointer;
  line-height: 1.45;
  background: ${(p) => (p.$unread ? 'rgba(99, 102, 241, 0.09)' : '#f8fafc')};
  border: 1px solid ${(p) => (p.$unread ? 'rgba(99, 102, 241, 0.28)' : '#e2e8f0')};
`;

const NotifHeadRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
  flex-wrap: wrap;
  padding-right: 2rem;
`;

const NotifHeadTitle = styled.strong`
  font-size: 0.95rem;
  color: #312e81;
  font-weight: 800;
`;

const NotifMarkReadBtn = styled.button`
  font-size: 0.88rem;
  cursor: pointer;
  border: none;
  background: none;
  color: #4f46e5;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  font-family: inherit;
  padding: 0.25rem 0;
  &:hover {
    color: #3730a3;
  }
`;

const NotifEmpty = styled.div`
  color: #64748b;
  font-size: 0.96rem;
  line-height: 1.5;
`;

const NotifLinePrimary = styled.div`
  font-weight: ${(p) => (p.$bold ? 700 : 500)};
  font-size: 0.96rem;
  color: #1e293b;
`;

const NotifLineMeta = styled.div`
  font-size: 0.82rem;
  color: #64748b;
  margin-top: 0.25rem;
`;

const statusColors = {
  pending: { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#f1f5f9', color: '#64748b' }
};

function TaskAssignmentManager({
  isOpen,
  onClose,
  currentUser,
  isSuperAdmin,
  onAccessRefresh,
  focusTaskId,
  onFocusTaskConsumed,
  initialScreen = 'workspace'
}) {
  const actingUsername = currentUser?.username || '';
  const canAssign = currentUser?.taskAssignment?.canAssign || isSuperAdmin;

  const [tab, setTab] = useState(canAssign ? 'asAssigner' : 'asAssignee');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  /** Bump on each open so TaskAssignmentForm remounts with fresh local state (avoids sticky fields). */
  const [taskFormMountKey, setTaskFormMountKey] = useState(0);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [listError, setListError] = useState('');
  /** workspace = ενεργοί χώροι · workArchive = μόνο ολοκληρωμένοι */
  const [screen, setScreen] = useState(initialScreen);
  const [archiveInfoExpanded, setArchiveInfoExpanded] = useState(false);
  const [archiveInfoDismissed, setArchiveInfoDismissed] = useState(() =>
    readArchiveInfoDismissed(actingUsername)
  );
  const prevTabRef = useRef(tab);
  const toolbarWrapRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  const managerWasOpenRef = useRef(false);

  const usersMap = useMemo(() => {
    const m = {};
    users.forEach((u) => {
      m[u.username] = u;
    });
    return m;
  }, [users]);

  const loadUsers = useCallback(async () => {
    const list = await ipcRenderer.invoke('get-users');
    if (Array.isArray(list)) setUsers(list);
  }, []);

  const loadAssignable = useCallback(async () => {
    if (!canAssign) return;
    const res = await ipcRenderer.invoke('get-task-assignment-permissions', { actingUsername });
    if (res?.success) setAssignableUsers(res.users || []);
  }, [actingUsername, canAssign]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const view = tab === 'all' ? 'all' : tab;
    const res = await ipcRenderer.invoke('load-task-assignments', {
      actingUsername,
      view,
      listScope: screen === 'workArchive' ? 'workArchive' : 'default'
    });
    if (res?.success) {
      setTasks(res.tasks || []);
      setListError('');
    } else {
      setListError(res?.error || 'Αποτυχία φόρτωσης λίστας χώρων');
    }
    setLoading(false);
  }, [actingUsername, tab, screen]);

  const refreshSelectedTask = useCallback(async () => {
    const tid = selectedIdRef.current;
    if (!tid || !actingUsername) return;
    const res = await ipcRenderer.invoke('get-task-assignment', { actingUsername, taskId: tid });
    if (res?.success) setSelectedTask(res.task);
  }, [actingUsername]);

  const loadNotifications = useCallback(async () => {
    const res = await ipcRenderer.invoke('load-task-notifications', { actingUsername, unreadOnly: false });
    if (res?.success) setNotifications(res.notifications || []);
  }, [actingUsername]);

  useEffect(() => {
    if (!isOpen) {
      resetDocumentInteractionState();
      return undefined;
    }
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    return () => {
      resetDocumentInteractionState();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !formOpen) return undefined;
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    return undefined;
  }, [isOpen, formOpen]);

  /** Αποσύνδεση / ασυνήθιστο unmount: σβήνει scroll-lock ώστε να μη «κολλάει» η οθόνη σύνδεσης. */
  useEffect(() => {
    return () => {
      resetDocumentInteractionState();
    };
  }, []);

  /** Άνοιγμα manager ή αλλαγή entry point από Dashboard — όχι σε εσωτερική εναλλαγή οθόνης. */
  useEffect(() => {
    setArchiveInfoDismissed(readArchiveInfoDismissed(actingUsername));
    setArchiveInfoExpanded(false);
  }, [actingUsername]);

  const dismissArchiveInfo = useCallback(() => {
    setArchiveInfoDismissed(true);
    setArchiveInfoExpanded(false);
    persistArchiveInfoDismissed(actingUsername);
  }, [actingUsername]);

  const showArchiveHelp = useCallback(() => {
    clearArchiveInfoDismissed(actingUsername);
    setArchiveInfoDismissed(false);
    setArchiveInfoExpanded(true);
  }, [actingUsername]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!isOpen) {
      managerWasOpenRef.current = false;
      return;
    }
    const justOpened = !managerWasOpenRef.current;
    managerWasOpenRef.current = true;
    loadUsers();
    loadAssignable();
    loadNotifications();
    if (justOpened) {
      setScreen(initialScreen);
      setSelectedId(null);
      setSelectedTask(null);
      if (onAccessRefresh) onAccessRefresh();
    }
  }, [isOpen, initialScreen, loadUsers, loadAssignable, loadNotifications, onAccessRefresh]);

  useEffect(() => {
    if (!isOpen) return;
    setScreen(initialScreen);
  }, [initialScreen, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setFormOpen(false);
    setEditingTask(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const unsub = window.electronAPI?.on?.('task-notification', (payload) => {
      if (payload?.username?.toLowerCase() === actingUsername.toLowerCase()) {
        loadNotifications();
        loadTasks();
        refreshSelectedTask();
        if (onAccessRefresh) onAccessRefresh();
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen, actingUsername, loadNotifications, loadTasks, refreshSelectedTask, onAccessRefresh]);

  useEffect(() => {
    if (!isOpen) return;
    if (!canAssign && tab === 'asAssigner') setTab('asAssignee');
  }, [isOpen, canAssign, tab]);

  useEffect(() => {
    if (!isOpen) {
      prevTabRef.current = tab;
      return;
    }
    if (prevTabRef.current !== tab) {
      setFormOpen(false);
      setEditingTask(null);
    }
    prevTabRef.current = tab;
  }, [tab, isOpen]);

  /** Εναλλαγή Χώρος Εργασίας ↔ Αποθήκη — χωρίς επαναφορά στο initialScreen. */
  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setSelectedTask(null);
    loadTasks();
  }, [screen, isOpen, loadTasks]);

  useEffect(() => {
    if (!isOpen) return;
    loadTasks();
  }, [tab, isOpen, loadTasks]);

  const isWorkArchive = screen === 'workArchive';

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (isWorkArchive) {
        if (t.status !== 'completed') return false;
      } else if (t.status === 'completed') {
        return false;
      }
      if (statusFilter === 'overdue_filter') {
        if (!isTaskOverdue(t)) return false;
      } else if (statusFilter && t.status !== statusFilter) {
        return false;
      }
      if (search) {
        const blob = [t.title, t.description, t.createdBy, ...(t.assignees || [])].join(' ');
        if (!containsSearchTerm(blob, search)) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, isWorkArchive]);

  useEffect(() => {
    if (!selectedTask) return;
    const stillVisible = filtered.some((t) => t.id === selectedTask.id);
    if (!stillVisible) {
      setSelectedTask(null);
      setSelectedId(null);
    }
  }, [filtered, selectedTask]);

  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const onDoc = (e) => {
      if (!toolbarWrapRef.current?.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterMenuOpen]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const showSidebar = true;
  const focusMode = !!selectedTask;
  const sidebarMode = selectedTask ? 'full' : 'browse';

  const openCreateAssignmentForm = useCallback(() => {
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    setEditingTask(null);
    setTaskFormMountKey((k) => k + 1);
    setFormOpen(true);
  }, []);

  const openEditAssignmentForm = useCallback((task) => {
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    setEditingTask(task);
    setTaskFormMountKey((k) => k + 1);
    setFormOpen(true);
  }, []);

  const revealTask = useCallback(
    async (taskId) => {
      const res = await ipcRenderer.invoke('get-task-assignment', { actingUsername, taskId });
      if (!res?.success) return false;
      setSelectedId(taskId);
      setSelectedTask(res.task);
      setScreen(res.task.status === 'completed' ? 'workArchive' : 'workspace');
      try {
        await ipcRenderer.invoke('mark-task-notifications-read-for-task', { actingUsername, taskId });
        window.dispatchEvent(new CustomEvent(DISMISS_TASK_EVENT, { detail: { taskId } }));
      } catch {
        /* ignore */
      }
      return true;
    },
    [actingUsername]
  );

  const openTask = useCallback(
    async (taskId) => {
      const ok = await revealTask(taskId);
      if (ok) {
        loadNotifications();
        if (onAccessRefresh) onAccessRefresh();
      }
    },
    [revealTask, loadNotifications, onAccessRefresh]
  );

  useEffect(() => {
    if (!isOpen || !focusTaskId || !actingUsername) return undefined;
    let cancelled = false;
    (async () => {
      const ok = await revealTask(focusTaskId);
      if (!cancelled && ok) {
        await loadTasks();
        await loadNotifications();
        if (onAccessRefresh) onAccessRefresh();
      }
      if (!cancelled) onFocusTaskConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, focusTaskId, actingUsername, revealTask, loadTasks, loadNotifications, onAccessRefresh, onFocusTaskConsumed]);

  const handleTaskUpdated = (task) => {
    if (task.status === 'completed' && screen === 'workspace') {
      setSelectedTask(null);
      setSelectedId(null);
    } else if (task.status !== 'completed' && screen === 'workArchive') {
      setScreen('workspace');
      setSelectedTask(task);
      setSelectedId(task.id);
    } else {
      setSelectedTask(task);
    }
    loadTasks();
    loadNotifications();
    if (onAccessRefresh) onAccessRefresh();
  };

  const handleLeaveArchive = async (task) => {
    if (!task?.id) return;
    const res = await ipcRenderer.invoke('leave-task-work-archive', { actingUsername, taskId: task.id });
    if (res?.success) {
      setSelectedId(null);
      setSelectedTask(null);
      loadTasks();
      if (onAccessRefresh) onAccessRefresh();
    } else {
      alert(res?.error || 'Αποτυχία αποχώρησης');
      scheduleDocumentInteractionRecovery({ lockScroll: isOpen });
    }
  };

  const handleDelete = async (task) => {
    const msg = isWorkArchive
      ? `Οριστική διαγραφή του χώρου «${task.title}» από την αποθήκη;`
      : `Διαγραφή χώρου «${task.title}»;`;
    const confirmed = window.confirm(msg);
    scheduleDocumentInteractionRecovery({ lockScroll: isOpen });
    if (!confirmed) return;
    const res = await ipcRenderer.invoke('delete-task-assignment', { actingUsername, taskId: task.id });
    if (res?.success) {
      setSelectedId(null);
      setSelectedTask(null);
      loadTasks();
      if (onAccessRefresh) onAccessRefresh();
    } else {
      alert(res?.error || 'Αποτυχία διαγραφής');
      scheduleDocumentInteractionRecovery({ lockScroll: isOpen });
    }
  };

  const markAllRead = async () => {
    await ipcRenderer.invoke('mark-task-notifications-read', { actingUsername });
    loadNotifications();
    if (onAccessRefresh) onAccessRefresh();
  };

  const renderTaskPreview = (t) => {
    const sc = statusColors[t.status] || {};
    const overdue = isTaskOverdue(t);
    const assignees = formatAssigneeDisplayNames(t, usersMap);
    const isActive = selectedId === t.id;
    const showWithdrawBadge =
      isTaskWithdrawnByAssigner(t) && t.createdBy?.toLowerCase() === actingUsername?.toLowerCase();

    return (
      <TaskCard key={t.id} type="button" $active={isActive} onClick={() => openTask(t.id)}>
        <CardTitle>{t.title}</CardTitle>
        <CardMeta>
          <StatusBadge $bg={sc.bg} $color={sc.color}>
            {TASK_STATUS_LABELS[t.status] || t.status}
          </StatusBadge>
          <PriorityPill $priority={t.priority}>{TASK_PRIORITY_LABELS[t.priority] || t.priority}</PriorityPill>
          {showWithdrawBadge ? <WithdrawBadge title="Ο χώρος δεν εμφανίζεται πλέον στους συναδέλφους">Κλειστός · ενέργεια</WithdrawBadge> : null}
          <span style={{ fontWeight: 700, color: overdue ? '#b91c1c' : '#334155' }}>
            {formatTaskDueDate(t.dueDate, t.dueTime)}
          </span>
        </CardMeta>
        {assignees ? (
          <div
            style={{
              marginTop: 4,
              fontSize: '0.62rem',
              fontWeight: 600,
              color: '#64748b',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={assignees}
          >
            Συνάδελφοι: {assignees}
          </div>
        ) : null}
      </TaskCard>
    );
  };

  if (!isOpen) return null;

  return (
    <Overlay>
      <Container onClick={(e) => e.stopPropagation()}>
        <Top $compact={focusMode}>
          <Header $compact={focusMode}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Title $compact={focusMode}>{isWorkArchive ? 'ΑΠΟΘΗΚΗ ΕΡΓΑΣΙΩΝ' : 'Χώρος Εργασίας'}</Title>
              <ScreenSubtitleRow>
                <ScreenSubtitle $compact={focusMode}>
                  {isWorkArchive
                    ? 'Εδώ εμφανίζονται μόνο οι ολοκληρωμένες εργασίες — χώροι με κατάσταση «Ολοκληρώθηκε».'
                    : 'Ενεργοί χώροι εργασίας. Οι ολοκληρωμένες εργασίες μεταφέρονται στην Αποθήκη Εργασιών.'}
                </ScreenSubtitle>
                {isWorkArchive && archiveInfoDismissed ? (
                  <ArchiveHelpTrigger type="button" $compact={focusMode} onClick={showArchiveHelp}>
                    Εμφάνιση βοήθειας
                  </ArchiveHelpTrigger>
                ) : null}
              </ScreenSubtitleRow>
            </div>
            <CloseBtn type="button" $compact={focusMode} onClick={onClose}>
              Κλείσιμο
            </CloseBtn>
          </Header>
          <ActionsBarWrap ref={toolbarWrapRef}>
            <ActionsBar $dense={focusMode}>
              {isWorkArchive ? (
                <TabBtn
                  type="button"
                  onClick={() => {
                    setScreen('workspace');
                    setSelectedId(null);
                    setSelectedTask(null);
                    setFilterMenuOpen(false);
                  }}
                >
                  ← Χώρος Εργασίας
                </TabBtn>
              ) : (
                <TabBtn
                  type="button"
                  onClick={() => {
                    setScreen('workArchive');
                    setSelectedId(null);
                    setSelectedTask(null);
                    setFilterMenuOpen(false);
                  }}
                >
                  ΑΠΟΘΗΚΗ ΕΡΓΑΣΙΩΝ
                </TabBtn>
              )}
              <TabBtn
                type="button"
                $active={filterMenuOpen}
                onClick={() => {
                  setFilterMenuOpen((v) => !v);
                  setShowNotif(false);
                }}
              >
                Φίλτρα {filterMenuOpen ? '▴' : '▾'}
              </TabBtn>
              <ToolbarSearch
                $dense={focusMode}
                placeholder="Αναζήτηση..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!isWorkArchive && canAssign && tab === 'asAssigner' && (
                <PrimaryBtn type="button" onClick={openCreateAssignmentForm}>
                  Δημιουργία Χώρου
                </PrimaryBtn>
              )}
              <TabBtn
                type="button"
                $active={showNotif}
                onClick={() => {
                  setShowNotif((v) => !v);
                  setFilterMenuOpen(false);
                }}
              >
                Ειδοποιήσεις {unreadCount > 0 ? `(${unreadCount})` : ''}
              </TabBtn>
            </ActionsBar>
            {filterMenuOpen && (
              <FilterMegaPanel role="dialog" aria-label={isWorkArchive ? 'Φίλτρα αποθήκης' : 'Φίλτρα χώρου εργασίας'}>
                <FilterMegaSection>
                  <FilterMegaLabel>Προβολή λίστας</FilterMegaLabel>
                  <FilterChipRow>
                    {canAssign && (
                      <FilterChip type="button" $active={tab === 'asAssigner'} onClick={() => setTab('asAssigner')}>
                        Οι Χώροι Εργασίας μου
                      </FilterChip>
                    )}
                    <FilterChip type="button" $active={tab === 'asAssignee'} onClick={() => setTab('asAssignee')}>
                      Συμμετέχω
                    </FilterChip>
                    {isSuperAdmin && (
                      <FilterChip type="button" $active={tab === 'all'} onClick={() => setTab('all')}>
                        Όλες
                      </FilterChip>
                    )}
                  </FilterChipRow>
                </FilterMegaSection>
                {!isWorkArchive && (
                  <FilterMegaSection>
                    <FilterMegaLabel>Κατάσταση</FilterMegaLabel>
                    <FilterSelectFull value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">Όλες οι καταστάσεις</option>
                      {Object.entries(TASK_STATUS_LABELS)
                        .filter(([k]) => k !== 'completed')
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      <option value="overdue_filter">Εκπρόθεσμες</option>
                    </FilterSelectFull>
                  </FilterMegaSection>
                )}
              </FilterMegaPanel>
            )}
          </ActionsBarWrap>
          {showNotif && (
            <>
              <NotifBackdrop type="button" aria-label="Κλείσιμο ειδοποιήσεων" onClick={() => setShowNotif(false)} />
              <NotifPanel>
                <NotifCloseBtn type="button" aria-label="Κλείσιμο" onClick={() => setShowNotif(false)}>
                  ×
                </NotifCloseBtn>
                <NotifHeadRow>
                  <NotifHeadTitle>Ειδοποιήσεις</NotifHeadTitle>
                  <NotifMarkReadBtn type="button" onClick={markAllRead}>
                    Σήμανση όλων ως αναγνωσμένες
                  </NotifMarkReadBtn>
                </NotifHeadRow>
                {notifications.length === 0 ? (
                  <NotifEmpty>Δεν υπάρχουν ειδοποιήσεις.</NotifEmpty>
                ) : (
                  notifications.slice(0, 40).map((n) => (
                    <NotifItem
                      key={n.id}
                      $unread={!n.readAt}
                      onClick={async () => {
                        await ipcRenderer.invoke('mark-task-notifications-read', {
                          actingUsername,
                          notificationIds: [n.id]
                        });
                        await openTask(n.taskId);
                        setShowNotif(false);
                        loadNotifications();
                      }}
                    >
                      <NotifLinePrimary $bold={!n.readAt}>{n.message || n.title}</NotifLinePrimary>
                      <NotifLineMeta>{new Date(n.createdAt).toLocaleString('el-GR')}</NotifLineMeta>
                    </NotifItem>
                  ))
                )}
              </NotifPanel>
            </>
          )}
        </Top>

        {isWorkArchive && !archiveInfoDismissed && (
          <ArchiveInfoBanner role="note">
            <ArchiveInfoRow>
              <ArchiveInfoText>
                Μόνο <strong>ολοκληρωμένες</strong> εργασίες — μετά την ολοκλήρωση μεταφέρονται εδώ από τον ενεργό χώρο.
                {archiveInfoExpanded ? (
                  <ArchiveInfoDetails>
                    Ο αναθέτης μπορεί <strong>οριστική διαγραφή</strong>· οι συνάδελφοι μπορούν{' '}
                    <strong>αποχώρηση από αποθήκη</strong> (εξαφανίζονται από τη λίστα τους, τα δεδομένα μένουν).
                  </ArchiveInfoDetails>
                ) : null}
              </ArchiveInfoText>
              <ArchiveInfoActions>
                <ArchiveInfoLinkBtn
                  type="button"
                  onClick={() => setArchiveInfoExpanded((v) => !v)}
                  aria-expanded={archiveInfoExpanded}
                >
                  {archiveInfoExpanded ? 'Λιγότερα' : 'Λεπτομέρειες'}
                </ArchiveInfoLinkBtn>
                <ArchiveInfoCloseBtn type="button" aria-label="Απόκρυψη ενημέρωσης" onClick={dismissArchiveInfo}>
                  ×
                </ArchiveInfoCloseBtn>
              </ArchiveInfoActions>
            </ArchiveInfoRow>
          </ArchiveInfoBanner>
        )}

        <Body>
          <Sidebar $hidden={!showSidebar} $mode={sidebarMode}>
            <SidebarScroll>
              {listError ? (
                <ListHint style={{ color: '#b91c1c', fontWeight: 700 }}>{listError}</ListHint>
              ) : null}
              {loading ? (
                <ListHint>Φόρτωση λίστας…</ListHint>
              ) : filtered.length === 0 ? (
                <ListHint style={{ textAlign: 'center' }}>
                  {isWorkArchive
                    ? 'Δεν υπάρχουν ολοκληρωμένες εργασίες στην αποθήκη σας (ή έχετε αποχωρήσει από αυτές).'
                    : 'Δεν βρέθηκαν ενεργοί χώροι με τα κριτήρια που επιλέξατε.'}
                </ListHint>
              ) : (
                filtered.map((t) => renderTaskPreview(t))
              )}
            </SidebarScroll>
          </Sidebar>

          <WorkspaceArea>
            {selectedTask ? (
              <TaskAssignmentWorkspace
                task={selectedTask}
                actingUsername={actingUsername}
                usersMap={usersMap}
                isSuperAdmin={isSuperAdmin}
                canEditAsAssigner={canAssign}
                onUpdated={handleTaskUpdated}
                onEdit={
                  canAssign &&
                  selectedTask.createdBy === actingUsername &&
                  selectedTask.status !== 'completed'
                    ? () => openEditAssignmentForm(selectedTask)
                    : undefined
                }
                onDelete={
                  canAssign && selectedTask.createdBy === actingUsername
                    ? () => handleDelete(selectedTask)
                    : undefined
                }
                workArchiveMode={isWorkArchive}
                onLeaveArchive={handleLeaveArchive}
              />
            ) : (
              <EmptyWorkspace>
                <EmptyPanel>
                  <EmptyIcon aria-hidden>💬</EmptyIcon>
                  <EmptyHeading>
                    {isWorkArchive ? 'Επιλέξτε ολοκληρωμένη εργασία' : 'Επιλέξτε χώρο από τα αριστερά'}
                  </EmptyHeading>
                  <EmptyText>
                    {isWorkArchive
                      ? 'Στην Αποθήκη Εργασιών εμφανίζονται μόνο ολοκληρωμένες εργασίες. Επιλέξτε μία από τη λίστα για να δείτε την ιστορία, τα αρχεία και τη ροή συνεργασίας.'
                      : 'Κάθε φορά που ανοίγετε τον Χώρο Εργασίας, η προβολή ξεκινά κενή. Κάντε κλικ σε έναν χώρο στη λίστα στα αριστερά για να εμφανιστεί εδώ η περιγραφή, τα αρχεία και η ροή συνομιλίας. Οι ολοκληρωμένες εργασίες μεταφέρονται στην Αποθήκη Εργασιών.'}
                  </EmptyText>
                </EmptyPanel>
              </EmptyWorkspace>
            )}
          </WorkspaceArea>
        </Body>
      </Container>

      {formOpen && (
        <TaskAssignmentForm
          key={taskFormMountKey}
          onClose={() => {
            setFormOpen(false);
            setEditingTask(null);
            scheduleDocumentInteractionRecovery({ lockScroll: isOpen });
          }}
          actingUsername={actingUsername}
          editingTask={editingTask}
          assignableUsers={assignableUsers}
          onSaved={(task) => {
            loadTasks();
            loadNotifications();
            if (task?.id) openTask(task.id);
            if (onAccessRefresh) onAccessRefresh();
          }}
        />
      )}
    </Overlay>
  );
}

export default TaskAssignmentManager;
