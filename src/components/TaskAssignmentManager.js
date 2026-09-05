import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { css } from 'styled-components';
import TaskAssignmentForm from './TaskAssignmentForm';
import { useToast } from './ToastProvider';
import TaskAssignmentWorkspace from './TaskAssignmentWorkspace';
import { DISMISS_TASK_EVENT } from './TaskAssignmentToastHost';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  isTaskWithdrawnByAssigner,
  formatAssigneeDisplayNames
} from '../utils/taskAssignmentDisplay';
import taskWorkspace from '../../app/core/taskWorkspace';
import {
  allowDocumentInteractionLock,
  resetDocumentInteractionState,
  scheduleDocumentInteractionRecovery
} from '../utils/documentInteractionReset';
import { showConfirm } from '../utils/confirmModal';

const ipcRenderer = window.electronAPI;

function defaultPersonTaskMode(person) {
  if (person && person.openCount === 0 && person.completedCount > 0) return 'completed';
  return 'open';
}

function pickRosterPersonUsername(task, actingUsername) {
  const self = String(actingUsername || '').toLowerCase();
  const found = (task?.assignees || []).find((a) => String(a || '').toLowerCase() !== self);
  return found || '';
}

function personModeForTask(task) {
  return task?.status === 'completed' ? 'completed' : 'open';
}

function personAllTasks(person) {
  if (!person) return [];
  return (person.openTasks || []).concat(person.completedTasks || [], person.closedTasks || []);
}

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

const VIEW_HELP_DISMISS_KEY = 'ef-workspace-view-help-dismissed';

function readViewHelpDismissed(username) {
  if (!username) return false;
  try {
    return localStorage.getItem(`${VIEW_HELP_DISMISS_KEY}:${username}`) === '1';
  } catch {
    return false;
  }
}

function persistViewHelpDismissed(username) {
  if (!username) return;
  try {
    localStorage.setItem(`${VIEW_HELP_DISMISS_KEY}:${username}`, '1');
  } catch {
    /* ignore */
  }
}

function clearViewHelpDismissed(username) {
  if (!username) return;
  try {
    localStorage.removeItem(`${VIEW_HELP_DISMISS_KEY}:${username}`);
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

const ViewHelpBanner = styled(ArchiveInfoBanner)`
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #3730a3;
`;

const ViewHelpDetails = styled(ArchiveInfoDetails)`
  color: #4338ca;
`;

const ViewHelpLinkBtn = styled(ArchiveInfoLinkBtn)`
  color: #4338ca;
  &:hover {
    background: rgba(67, 56, 202, 0.1);
  }
`;

const ViewHelpCloseBtn = styled(ArchiveInfoCloseBtn)`
  color: #3730a3;
  &:hover {
    background: rgba(67, 56, 202, 0.12);
  }
`;

const ViewHelpTrigger = styled(ArchiveHelpTrigger)`
  color: #4338ca;
  &:hover {
    color: #3730a3;
  }
`;

const TabBtnHint = styled.span`
  display: ${(p) => (p.$hide ? 'none' : 'block')};
  margin-top: 0.08rem;
  font-size: 0.64rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  opacity: 0.82;
  line-height: 1.2;
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
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.2;
  text-align: left;
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
  gap: 0.5rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(148, 163, 184, 0.08) 100%);
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.14);

  ${(p) =>
    p.$dense &&
    css`
      gap: 0.34rem;
      padding: 0.28rem 0.4rem;
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

const ToolbarCluster = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: inherit;
  ${(p) =>
    p.$end &&
    css`
      margin-left: auto;
    `}
`;

const ViewSwitch = styled.div`
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
`;

const ViewSwitchBtn = styled(TabBtn)`
  border: none;
  border-radius: 0;
  & + & {
    border-left: 1px solid #c7d2fe;
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const SIDEBAR_FULL = 'clamp(240px, 22vw, 300px)';
const SIDEBAR_BROWSE = 'clamp(220px, 20vw, 280px)';
const SIDEBAR_ROSTER = 'clamp(240px, 24vw, 300px)';

const Sidebar = styled.div`
  width: ${(p) => {
    if (p.$hidden) return '0';
    if (p.$mode === 'roster') return SIDEBAR_ROSTER;
    if (p.$mode === 'full') return SIDEBAR_FULL;
    return SIDEBAR_BROWSE;
  }};
  min-width: ${(p) => {
    if (p.$hidden) return '0';
    if (p.$mode === 'roster') return SIDEBAR_ROSTER;
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

const RosterSummary = styled.div`
  font-size: 0.68rem;
  font-weight: 650;
  color: #64748b;
  line-height: 1.4;
  padding: 0.2rem 0.15rem 0.45rem;
`;

const PersonRow = styled.button`
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

const PersonName = styled.div`
  font-weight: 700;
  font-size: 0.8rem;
  color: #0f172a;
  line-height: 1.3;
  margin-bottom: 0.22rem;
`;

const PersonMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem 0.4rem;
  align-items: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
`;

const OverdueHint = styled.span`
  color: #b91c1c;
  font-weight: 800;
`;

const IdleHint = styled.div`
  margin: 0.35rem 0.1rem 0.2rem;
  font-size: 0.68rem;
  font-weight: 650;
  color: #94a3b8;
  line-height: 1.4;
`;

const ClosedSectionLabel = styled.div`
  margin: 0.85rem 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 750;
  color: #854d0e;
  letter-spacing: 0.01em;
`;

const TogetherChip = styled.span`
  display: inline-block;
  padding: 0.1rem 0.38rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  line-height: 1.25;
`;

const PersonPane = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 0.9rem 1.1rem;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
`;

const PersonPaneHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.65rem;
`;

const PersonPaneTitle = styled.h3`
  margin: 0;
  flex: 1;
  min-width: 8rem;
  font-size: 1.02rem;
  font-weight: 750;
  color: #0f172a;
`;

const ModeChip = styled.button`
  padding: 0.28rem 0.62rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.14)' : '#fff')};
  color: ${(p) => (p.$active ? '#3730a3' : '#475569')};
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  &:hover {
    border-color: #c7d2fe;
    background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.14)' : '#f8fafc')};
  }
`;

const BackPeopleBtn = styled.button`
  display: block;
  width: 100%;
  margin-bottom: 0.4rem;
  padding: 0.32rem 0.45rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #4338ca;
  font-size: 0.72rem;
  font-weight: 750;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  &:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
  }
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

const NotifExpandBtn = styled.button`
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid rgba(79, 70, 229, 0.28);
  border-radius: 8px;
  background: rgba(79, 70, 229, 0.08);
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: rgba(79, 70, 229, 0.14); }
`;


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
  const { showToast } = useToast();
  const actingUsername = currentUser?.username || '';
  const canAssign = currentUser?.taskAssignment?.canAssign || isSuperAdmin;

  /** Όποιος αναθέτει ανοίγει ανά άτομο· «Συμμετέχω» μένει ένα κλικ δίπλα για χώρους που σας πρόσθεσαν άλλοι. */
  const [tab, setTab] = useState(() => (
    (currentUser?.taskAssignment?.canAssign || isSuperAdmin) ? 'asAssigner' : 'asAssignee'
  ));
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
  const [notifListExpanded, setNotifListExpanded] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedPersonUsername, setSelectedPersonUsername] = useState('');
  const [personTaskMode, setPersonTaskMode] = useState('open');
  /** workspace = ενεργοί χώροι · workArchive = μόνο ολοκληρωμένοι */
  const [screen, setScreen] = useState(initialScreen);
  const [archiveInfoExpanded, setArchiveInfoExpanded] = useState(false);
  const [archiveInfoDismissed, setArchiveInfoDismissed] = useState(() =>
    readArchiveInfoDismissed(actingUsername)
  );
  const [viewHelpDismissed, setViewHelpDismissed] = useState(() =>
    readViewHelpDismissed(actingUsername)
  );
  const [viewHelpExpanded, setViewHelpExpanded] = useState(false);
  const prevScreenRef = useRef(screen);
  const toolbarWrapRef = useRef(null);
  const mountedRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const managerWasOpenRef = useRef(false);
  const focusTaskHandledRef = useRef(null);
  const onAccessRefreshRef = useRef(onAccessRefresh);
  onAccessRefreshRef.current = onAccessRefresh;

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

  const loadTasks = useCallback(async ({ silent = false, viewOverride } = {}) => {
    if (!silent) setLoading(true);
    const activeTab = viewOverride ?? tab;
    const view = activeTab === 'all' ? 'all' : activeTab;
    const res = await ipcRenderer.invoke('load-task-assignments', {
      actingUsername,
      view,
      listScope: screen === 'workArchive'
        ? 'workArchive'
        : (activeTab === 'asAssigner' ? 'assignerAll' : 'default')
    });
    if (res?.success) {
      setTasks(res.tasks || []);
      setListError('');
    } else if (!silent) {
      setListError(res?.error || 'Αποτυχία φόρτωσης λίστας χώρων');
    }
    if (!silent) setLoading(false);
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
    allowDocumentInteractionLock();
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resetDocumentInteractionState();
    };
  }, []);

  const recoverTaskManagerScroll = useCallback(() => {
    if (!mountedRef.current || !isOpen) {
      resetDocumentInteractionState();
      return;
    }
    allowDocumentInteractionLock();
    scheduleDocumentInteractionRecovery({ lockScroll: true });
  }, [isOpen]);

  /** Άνοιγμα manager ή αλλαγή entry point από Dashboard — όχι σε εσωτερική εναλλαγή οθόνης. */
  useEffect(() => {
    setArchiveInfoDismissed(readArchiveInfoDismissed(actingUsername));
    setArchiveInfoExpanded(false);
    setViewHelpDismissed(readViewHelpDismissed(actingUsername));
    setViewHelpExpanded(false);
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

  const dismissViewHelp = useCallback(() => {
    setViewHelpDismissed(true);
    setViewHelpExpanded(false);
    persistViewHelpDismissed(actingUsername);
  }, [actingUsername]);

  const showViewHelp = useCallback(() => {
    clearViewHelpDismissed(actingUsername);
    setViewHelpDismissed(false);
    setViewHelpExpanded(true);
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
      prevScreenRef.current = initialScreen;
      const openingTab = canAssign && initialScreen !== 'workArchive' ? 'asAssigner' : 'asAssignee';
      setTab(openingTab);
      setSelectedId(null);
      setSelectedTask(null);
      setSelectedPersonUsername('');
      setPersonTaskMode('open');
      loadTasks({ silent: false, viewOverride: openingTab });
      onAccessRefreshRef.current?.();
    }
  }, [isOpen, initialScreen, canAssign, loadUsers, loadAssignable, loadNotifications, loadTasks]); // loadTasks: initial fetch on open

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
        loadTasks({ silent: true });
        refreshSelectedTask();
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen, actingUsername, loadNotifications, loadTasks, refreshSelectedTask]);

  /** Κοινός φάκελος server: περιοδική ανανέωση όσο είναι ανοιχτός ο manager. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const intervalId = setInterval(() => {
      loadTasks({ silent: true });
      loadNotifications();
      refreshSelectedTask();
    }, 45000);
    return () => clearInterval(intervalId);
  }, [isOpen, loadTasks, loadNotifications, refreshSelectedTask]);

  /** Real-time watcher: fs.watch στο data.json του ανοιχτού χώρου. */
  useEffect(() => {
    const tid = selectedTask?.id;
    if (!isOpen || !tid) return undefined;
    ipcRenderer.invoke('watch-task-file', { taskId: tid }).catch(() => {});
    const unsub = ipcRenderer.on('task-data-changed', (payload) => {
      if (payload?.taskId === selectedIdRef.current) refreshSelectedTask();
    });
    return () => {
      ipcRenderer.invoke('unwatch-task-file').catch(() => {});
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen, selectedTask?.id, refreshSelectedTask]);

  useEffect(() => {
    if (!isOpen) return;
    if (!canAssign && tab === 'asAssigner') setTab('asAssignee');
  }, [isOpen, canAssign, tab]);

  /** Εναλλαγή Χώρος Εργασίας ↔ Αποθήκη — καθαρισμός επιλογής μόνο όταν αλλάζει η οθόνη. */
  useEffect(() => {
    if (!isOpen) {
      prevScreenRef.current = screen;
      return;
    }
    if (prevScreenRef.current === screen) return;
    setSelectedId(null);
    setSelectedTask(null);
    prevScreenRef.current = screen;
    loadTasks({ silent: false });
  }, [screen, isOpen, loadTasks]);

  useEffect(() => {
    if (!isOpen) return;
    loadTasks({ silent: true });
  }, [tab, isOpen, loadTasks]);

  const isWorkArchive = screen === 'workArchive';
  const isAssignerRoster = canAssign && tab === 'asAssigner' && !isWorkArchive;

  const filtered = useMemo(() => {
    return taskWorkspace.applyTaskDailyFilters(tasks, {
      isWorkArchive,
      statusFilter,
      search
    });
  }, [tasks, search, statusFilter, isWorkArchive]);

  const assignerRoster = useMemo(() => {
    if (!isAssignerRoster) {
      return { people: [], openSpaceCount: 0, peopleWithWorkCount: 0, idleCount: 0 };
    }
    return taskWorkspace.buildAssignerPersonRoster(tasks, {
      actingUsername,
      usersMap,
      search,
      assignableUsernames: assignableUsers.map((u) => u.username),
    });
  }, [isAssignerRoster, tasks, actingUsername, usersMap, search, assignableUsers]);

  const selectedPerson = useMemo(
    () => assignerRoster.people.find(
      (p) => String(p.username || '').toLowerCase() === String(selectedPersonUsername || '').toLowerCase()
    ) || null,
    [assignerRoster.people, selectedPersonUsername]
  );

  const personVisibleTasks = useMemo(() => {
    if (!selectedPerson) return [];
    const raw = personTaskMode === 'completed' ? selectedPerson.completedTasks : selectedPerson.openTasks;
    return raw.filter((t) => {
      if (search && !taskWorkspace.taskMatchesQuickSearch(t, search)
        && !taskWorkspace.taskMatchesQuickSearch({
          title: selectedPerson.fullName,
          description: selectedPerson.username,
          createdBy: '',
          assignees: []
        }, search)) {
        return false;
      }
      return true;
    });
  }, [selectedPerson, personTaskMode, search]);

  const personVisibleClosed = useMemo(() => {
    if (!selectedPerson || personTaskMode !== 'open') return [];
    return (selectedPerson.closedTasks || []).filter((t) => {
      if (search && !taskWorkspace.taskMatchesQuickSearch(t, search)
        && !taskWorkspace.taskMatchesQuickSearch({
          title: selectedPerson.fullName,
          description: selectedPerson.username,
          createdBy: '',
          assignees: []
        }, search)) {
        return false;
      }
      return true;
    });
  }, [selectedPerson, personTaskMode, search]);

  useEffect(() => {
    if (!isOpen || !isAssignerRoster) return;
    const still = assignerRoster.people.some(
      (p) => String(p.username || '').toLowerCase() === String(selectedPersonUsername || '').toLowerCase()
    );
    if (still) return;
    const first = assignerRoster.people.find((p) => p.openCount > 0) || assignerRoster.people[0];
    setSelectedPersonUsername(first?.username || '');
    setPersonTaskMode(defaultPersonTaskMode(first));
  }, [isOpen, isAssignerRoster, assignerRoster.people, selectedPersonUsername]);

  useEffect(() => {
    if (!isAssignerRoster || !selectedTask) return;
    if (!selectedPerson) {
      setSelectedTask(null);
      setSelectedId(null);
      return;
    }
    const belongs = personAllTasks(selectedPerson).some((t) => t.id === selectedTask.id);
    if (!belongs) {
      setSelectedTask(null);
      setSelectedId(null);
    }
  }, [isAssignerRoster, selectedPerson, selectedTask]);

  useEffect(() => {
    if (!selectedTask || loading) return;
    const pool = isAssignerRoster ? tasks : filtered;
    const stillVisible = pool.some((t) => t.id === selectedTask.id);
    if (!stillVisible) {
      setSelectedTask(null);
      setSelectedId(null);
    }
  }, [filtered, tasks, isAssignerRoster, selectedTask, loading]);

  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const onDoc = (e) => {
      if (!toolbarWrapRef.current?.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterMenuOpen]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const isSelectedTaskAssigner =
    !!selectedTask &&
    selectedTask.createdBy?.toLowerCase() === actingUsername?.toLowerCase();
  const canEditSelectedAsAssigner = canAssign && isSelectedTaskAssigner;
  const showSidebar = true;
  const focusMode = !!selectedTask;
  const sidebarMode = selectedTask ? 'full' : (isAssignerRoster ? 'roster' : 'browse');
  const showFilterButton = !isWorkArchive && (!isAssignerRoster || isSuperAdmin);

  useEffect(() => {
    if (!showFilterButton) setFilterMenuOpen(false);
  }, [showFilterButton]);

  const openCreateAssignmentForm = useCallback(() => {
    resetDocumentInteractionState();
    allowDocumentInteractionLock();
    setEditingTask(null);
    setTaskFormMountKey((k) => k + 1);
    setFormOpen(true);
    loadAssignable();
  }, [loadAssignable]);

  const openEditAssignmentForm = useCallback((task) => {
    resetDocumentInteractionState();
    allowDocumentInteractionLock();
    setEditingTask(task);
    setTaskFormMountKey((k) => k + 1);
    setFormOpen(true);
  }, []);

  const revealTask = useCallback(
    async (taskId, { stayInWorkspace } = {}) => {
      const res = await ipcRenderer.invoke('get-task-assignment', { actingUsername, taskId });
      if (!res?.success) {
        // Χωρίς πρόσβαση (π.χ. αποχώρηση): καθαρίζουμε τις ειδοποιήσεις του χώρου
        // ώστε να μην ξαναεμφανίζονται στην κεντρική οθόνη.
        try {
          await ipcRenderer.invoke('mark-task-notifications-read-for-task', { actingUsername, taskId });
          window.dispatchEvent(new CustomEvent(DISMISS_TASK_EVENT, { detail: { taskId } }));
          onAccessRefreshRef.current?.();
        } catch {
          /* ignore */
        }
        setListError(
          res?.error ||
            'Δεν ήταν δυνατή η πρόσβαση στον χώρο (π.χ. κλειστός χώρος ή λάθος προβολή στα Φίλτρα).'
        );
        return false;
      }
      setListError('');
      setSelectedId(taskId);
      setSelectedTask(res.task);
      const isCompleted = res.task.status === 'completed';
      if (!(isCompleted && stayInWorkspace)) {
        const nextScreen = isCompleted ? 'workArchive' : 'workspace';
        prevScreenRef.current = nextScreen;
        setScreen(nextScreen);
      }
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
    async (taskId, { forceTab, stayInWorkspace } = {}) => {
      if (forceTab) setTab(forceTab);
      const ok = await revealTask(taskId, { stayInWorkspace });
      if (ok) {
        await loadTasks({ silent: true, viewOverride: forceTab || undefined });
        loadNotifications();
      }
    },
    [revealTask, loadNotifications, loadTasks]
  );

  useEffect(() => {
    if (!isOpen || !focusTaskId || !actingUsername) return undefined;
    if (focusTaskHandledRef.current === focusTaskId) return undefined;
    let cancelled = false;
    (async () => {
      setTab('asAssignee');
      const ok = await revealTask(focusTaskId);
      if (!cancelled && ok) {
        focusTaskHandledRef.current = focusTaskId;
        await loadTasks({ silent: true, viewOverride: 'asAssignee' });
        await loadNotifications();
      }
      if (!cancelled) onFocusTaskConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, focusTaskId, actingUsername, revealTask, loadTasks, loadNotifications, onFocusTaskConsumed]);

  useEffect(() => {
    if (!isOpen) focusTaskHandledRef.current = null;
  }, [isOpen]);

  const handleTaskUpdated = (task) => {
    if (task.status === 'completed' && screen === 'workspace') {
      setSelectedTask(null);
      setSelectedId(null);
      if (isAssignerRoster) setPersonTaskMode('completed');
    } else if (task.status !== 'completed' && screen === 'workArchive') {
      setScreen('workspace');
      prevScreenRef.current = 'workspace';
      setSelectedTask(task);
      setSelectedId(task.id);
    } else {
      setSelectedTask(task);
    }
    if (isAssignerRoster && (task.status === 'pending' || task.status === 'in_progress')) {
      setPersonTaskMode('open');
    }
    loadTasks({ silent: true });
    loadNotifications();
  };

  const handleLeaveArchive = async (task) => {
    if (!task?.id) return;
    const res = await ipcRenderer.invoke('leave-task-work-archive', { actingUsername, taskId: task.id });
    if (res?.success) {
      window.dispatchEvent(new CustomEvent(DISMISS_TASK_EVENT, { detail: { taskId: task.id } }));
      setSelectedId(null);
      setSelectedTask(null);
      loadTasks({ silent: true });
      loadNotifications();
      onAccessRefreshRef.current?.();
    } else {
      showToast(res?.error || 'Αποτυχία αποχώρησης', 'error');
      recoverTaskManagerScroll();
    }
  };

  const handleDelete = async (task) => {
    const deletingArchived = isWorkArchive || task.status === 'completed';
    const confirmed = await showConfirm({
      title: deletingArchived ? 'Οριστική διαγραφή' : 'Διαγραφή χώρου εργασίας',
      message: deletingArchived
        ? `Οριστική διαγραφή του χώρου «${task.title}» από την αποθήκη;`
        : `Διαγραφή χώρου «${task.title}»;`,
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!confirmed) {
      recoverTaskManagerScroll();
      return;
    }
    const res = await ipcRenderer.invoke('delete-task-assignment', { actingUsername, taskId: task.id });
    if (res?.success) {
      setSelectedId(null);
      setSelectedTask(null);
      setFormOpen(false);
      setEditingTask(null);
      setTaskFormMountKey((k) => k + 1);
      loadTasks({ silent: true });
      onAccessRefreshRef.current?.();
    } else {
      showToast(res?.error || 'Αποτυχία διαγραφής', 'error');
    }
    resetDocumentInteractionState();
    if (isOpen) {
      allowDocumentInteractionLock();
      scheduleDocumentInteractionRecovery({ lockScroll: true });
    }
  };

  const markAllRead = async () => {
    await ipcRenderer.invoke('mark-task-notifications-read', { actingUsername });
    loadNotifications();
    onAccessRefreshRef.current?.();
  };

  const renderTaskPreview = (t, { withTogether } = {}) => {
    const sc = TASK_STATUS_COLORS[t.status] || {};
    const assignees = formatAssigneeDisplayNames(t, usersMap);
    const isActive = selectedId === t.id;
    const showWithdrawBadge =
      isTaskWithdrawnByAssigner(t) && t.createdBy?.toLowerCase() === actingUsername?.toLowerCase();
    const together = withTogether && selectedPerson
      ? taskWorkspace.togetherWithLabel(t, selectedPerson.username, usersMap)
      : '';

    return (
      <TaskCard
        key={t.id}
        type="button"
        $active={isActive}
        data-testid={`task-card-${t.id}`}
        onClick={() => openTask(t.id, { stayInWorkspace: isAssignerRoster })}
      >
        <CardTitle>{t.title}</CardTitle>
        <CardMeta>
          <StatusBadge $bg={sc.bg} $color={sc.color}>
            {TASK_STATUS_LABELS[t.status] || t.status}
          </StatusBadge>
          {showWithdrawBadge ? <WithdrawBadge title="Ο χώρος δεν εμφανίζεται πλέον στους συναδέλφους">Κλειστός · ενέργεια</WithdrawBadge> : null}
          {together ? <TogetherChip>{together}</TogetherChip> : null}
        </CardMeta>
        {!withTogether && assignees ? (
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
              <Title $compact={focusMode}>{isWorkArchive ? 'Αποθήκη Εργασιών' : 'Χώρος Εργασίας'}</Title>
              {!focusMode ? (
              <ScreenSubtitleRow>
                <ScreenSubtitle $compact={focusMode}>
                  {isWorkArchive
                    ? 'Εδώ εμφανίζονται μόνο οι ολοκληρωμένες εργασίες — χώροι με κατάσταση «Ολοκληρώθηκε».'
                    : isAssignerRoster
                      ? 'Δημιούργησα εγώ — όσα χρεώσατε, ανά συνάδελφο.'
                      : canAssign
                        ? 'Συμμετέχω — μόνο χώροι που σας ανέθεσαν άλλοι.'
                        : 'Ενεργοί χώροι εργασίας. Οι ολοκληρωμένες εργασίες μεταφέρονται στην Αποθήκη Εργασιών.'}
                </ScreenSubtitle>
                {isWorkArchive && archiveInfoDismissed ? (
                  <ArchiveHelpTrigger type="button" $compact={focusMode} onClick={showArchiveHelp}>
                    Εμφάνιση βοήθειας
                  </ArchiveHelpTrigger>
                ) : null}
                {canAssign && !isWorkArchive && viewHelpDismissed ? (
                  <ViewHelpTrigger type="button" $compact={focusMode} onClick={showViewHelp}>
                    Εμφάνιση βοήθειας
                  </ViewHelpTrigger>
                ) : null}
              </ScreenSubtitleRow>
              ) : null}
            </div>
            <CloseBtn type="button" $compact={focusMode} onClick={onClose}>
              Κλείσιμο
            </CloseBtn>
          </Header>
          <ActionsBarWrap ref={toolbarWrapRef}>
            <ActionsBar $dense={focusMode}>
              <ToolbarCluster>
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
                  Αποθήκη Εργασιών
                </TabBtn>
              )}
              {canAssign ? (
                <ViewSwitch role="group" aria-label="Προβολή χώρων">
                  <ViewSwitchBtn
                    type="button"
                    $active={tab === 'asAssignee'}
                    data-testid="workspace-view-assigned"
                    title={isWorkArchive
                      ? 'Ολοκληρωμένοι χώροι όπου σας έβαλαν συνάδελφοι'
                      : 'Χώροι όπου σας έβαλαν συνάδελφοι'}
                    onClick={() => {
                      setTab('asAssignee');
                      setFilterMenuOpen(false);
                      if (selectedTask && taskWorkspace.isTaskAssigner(selectedTask, actingUsername)) {
                        setSelectedId(null);
                        setSelectedTask(null);
                      }
                    }}
                  >
                    Συμμετέχω
                    <TabBtnHint $hide={focusMode}>μου ανέθεσαν</TabBtnHint>
                  </ViewSwitchBtn>
                  <ViewSwitchBtn
                    type="button"
                    $active={tab === 'asAssigner'}
                    data-testid="workspace-view-created"
                    title={isWorkArchive
                      ? 'Ολοκληρωμένοι χώροι που δημιουργήσατε'
                      : 'Όσα χρεώσατε εσείς, ανά συνάδελφο'}
                    onClick={() => {
                      setTab('asAssigner');
                      setFilterMenuOpen(false);
                      if (selectedTask) {
                        const pick = pickRosterPersonUsername(selectedTask, actingUsername);
                        if (pick) setSelectedPersonUsername(pick);
                        setPersonTaskMode(personModeForTask(selectedTask));
                      } else {
                        setSelectedId(null);
                        setSelectedTask(null);
                      }
                    }}
                  >
                    Δημιούργησα εγώ
                    <TabBtnHint $hide={focusMode}>χρέωσα ανά άτομο</TabBtnHint>
                  </ViewSwitchBtn>
                </ViewSwitch>
              ) : null}
              </ToolbarCluster>
              {!focusMode && showFilterButton ? (
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
              ) : null}
              {!focusMode ? (
              <ToolbarSearch
                $dense={focusMode}
                placeholder="Αναζήτηση..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              ) : null}
              <ToolbarCluster $end>
              {!focusMode && taskWorkspace.showCreateTaskButton(canAssign, isWorkArchive) ? (
                <PrimaryBtn type="button" onClick={openCreateAssignmentForm}>
                  Δημιουργία Χώρου
                </PrimaryBtn>
              ) : null}
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
              </ToolbarCluster>
            </ActionsBar>
            {showFilterButton && !focusMode && filterMenuOpen && (
              <FilterMegaPanel role="dialog" aria-label={isWorkArchive ? 'Φίλτρα αποθήκης' : 'Φίλτρα χώρου εργασίας'}>
                {isSuperAdmin ? (
                <FilterMegaSection>
                  <FilterMegaLabel>Προβολή λίστας</FilterMegaLabel>
                  <FilterChipRow>
                    <FilterChip type="button" $active={tab === 'all'} onClick={() => {
                      setTab('all');
                      setFilterMenuOpen(false);
                    }}>
                      Όλες
                    </FilterChip>
                  </FilterChipRow>
                </FilterMegaSection>
                ) : null}
                {!isWorkArchive && !isAssignerRoster && (
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
                  <>
                  {(notifListExpanded ? notifications : notifications.slice(0, 40)).map((n) => (
                    <NotifItem
                      key={n.id}
                      $unread={!n.readAt}
                      onClick={async () => {
                        await ipcRenderer.invoke('mark-task-notifications-read', {
                          actingUsername,
                          notificationIds: [n.id]
                        });
                        const opened = await ipcRenderer.invoke('get-task-assignment', {
                          actingUsername,
                          taskId: n.taskId
                        });
                        const mine = String(opened?.task?.createdBy || '').toLowerCase()
                          === String(actingUsername || '').toLowerCase();
                        if (mine && canAssign && !isWorkArchive) {
                          const pick = pickRosterPersonUsername(opened.task, actingUsername);
                          if (pick) setSelectedPersonUsername(pick);
                          setPersonTaskMode(personModeForTask(opened.task));
                          await openTask(n.taskId, { forceTab: 'asAssigner', stayInWorkspace: true });
                        } else {
                          await openTask(n.taskId, { forceTab: 'asAssignee' });
                        }
                        setShowNotif(false);
                        loadNotifications();
                      }}
                    >
                      <NotifLinePrimary $bold={!n.readAt}>{n.message || n.title}</NotifLinePrimary>
                      <NotifLineMeta>{new Date(n.createdAt).toLocaleString('el-GR')}</NotifLineMeta>
                    </NotifItem>
                  ))}
                  {notifications.length > 40 && (
                    <NotifExpandBtn
                      type="button"
                      onClick={() => setNotifListExpanded((v) => !v)}
                    >
                      {notifListExpanded
                        ? 'Σύμπτυξη λίστας'
                        : `Εμφάνιση όλων (${notifications.length})`}
                    </NotifExpandBtn>
                  )}
                  </>
                )}
              </NotifPanel>
            </>
          )}
        </Top>

        {canAssign && !isWorkArchive && !selectedTask && !viewHelpDismissed && (
          <ViewHelpBanner role="note" data-testid="workspace-view-help">
            <ArchiveInfoRow>
              <ArchiveInfoText>
                Δύο όψεις.{' '}
                <strong>Δημιούργησα εγώ:</strong> όσα χρεώσατε εσείς, ανά συνάδελφο.{' '}
                <strong>Συμμετέχω:</strong> μόνο χώροι όπου σας έβαλαν άλλοι — όχι όσα ανοίξατε εσείς.
                {viewHelpExpanded ? (
                  <ViewHelpDetails>
                    Στο «Δημιούργησα εγώ» πατάτε πρώτα το άτομο και μετά τον χώρο.
                    Τα ολοκληρωμένα μένουν στο άτομο και μαζεύονται και στην Αποθήκη.
                    Αν κλείσετε έναν χώρο, μένει μόνο σε εσάς ως κλειστός — οι συνάδελφοι δεν τον βλέπουν.
                    Αν κλείσετε αυτό το σημείωμα, δεν εμφανίζεται στην επόμενη είσοδο· το επαναφέρετε από «Εμφάνιση βοήθειας».
                  </ViewHelpDetails>
                ) : null}
              </ArchiveInfoText>
              <ArchiveInfoActions>
                <ViewHelpLinkBtn
                  type="button"
                  onClick={() => setViewHelpExpanded((v) => !v)}
                  aria-expanded={viewHelpExpanded}
                >
                  {viewHelpExpanded ? 'Λιγότερα' : 'Λεπτομέρειες'}
                </ViewHelpLinkBtn>
                <ViewHelpCloseBtn
                  type="button"
                  data-testid="workspace-view-help-dismiss"
                  aria-label="Απόκρυψη ενημέρωσης"
                  onClick={dismissViewHelp}
                >
                  ×
                </ViewHelpCloseBtn>
              </ArchiveInfoActions>
            </ArchiveInfoRow>
          </ViewHelpBanner>
        )}
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
              ) : isAssignerRoster && !selectedTask ? (
                <>
                  <RosterSummary data-testid="assigner-roster-summary">
                    {assignerRoster.openSpaceCount} ανοιχτοί χώροι · {assignerRoster.peopleWithWorkCount} άτομα με δουλειά
                  </RosterSummary>
                  {assignerRoster.people.length === 0 ? (
                    <ListHint style={{ textAlign: 'center' }}>
                      {search.trim()
                        ? 'Δεν βρέθηκαν άτομα ή χώροι με αυτό τον όρο.'
                        : 'Δεν υπάρχουν χρεώσεις σε συναδέλφους από εσάς ακόμα. Δημιουργήστε χώρο και επιλέξτε σε ποιον ανατίθεται.'}
                    </ListHint>
                  ) : (
                    assignerRoster.people.map((p) => {
                      const active = String(p.username || '').toLowerCase()
                        === String(selectedPersonUsername || '').toLowerCase();
                      return (
                        <PersonRow
                          key={p.username}
                          type="button"
                          $active={active}
                          data-testid={`assigner-person-${p.username}`}
                          onClick={() => {
                            const same = String(p.username || '').toLowerCase()
                              === String(selectedPersonUsername || '').toLowerCase();
                            setSelectedPersonUsername(p.username);
                            if (!same) setPersonTaskMode(defaultPersonTaskMode(p));
                            setSelectedId(null);
                            setSelectedTask(null);
                          }}
                        >
                          <PersonName>{p.fullName}</PersonName>
                          <PersonMeta>
                            <span>Ανοιχτά {p.openCount}</span>
                            {p.completedCount > 0 ? <span>Έκλεισαν {p.completedCount}</span> : null}
                            {p.closedCount > 0 ? <span>Κλειστοί {p.closedCount}</span> : null}
                            {p.overdueCount > 0 ? (
                              <OverdueHint>
                                {p.overdueCount === 1 ? '1 εκπρόθεσμη' : `${p.overdueCount} εκπρόθεσμες`}
                              </OverdueHint>
                            ) : null}
                          </PersonMeta>
                        </PersonRow>
                      );
                    })
                  )}
                  {assignerRoster.idleCount > 0 && assignerRoster.people.length > 0 ? (
                    <IdleHint>και {assignerRoster.idleCount} χωρίς χρέωση από εσάς</IdleHint>
                  ) : null}
                </>
              ) : isAssignerRoster && selectedTask ? (
                <>
                  <BackPeopleBtn
                    type="button"
                    data-testid="assigner-back-people"
                    onClick={() => {
                      setSelectedId(null);
                      setSelectedTask(null);
                    }}
                  >
                    ← Άτομα
                  </BackPeopleBtn>
                  {personVisibleTasks.length === 0 && personVisibleClosed.length === 0 ? (
                    <ListHint style={{ textAlign: 'center' }}>Δεν υπάρχουν χώροι σε αυτή την προβολή.</ListHint>
                  ) : (
                    <>
                      {personVisibleTasks.map((t) => renderTaskPreview(t, { withTogether: true }))}
                      {personVisibleClosed.length > 0 ? (
                        <>
                          <ClosedSectionLabel>Κλειστοί — φαίνονται μόνο σε εσάς</ClosedSectionLabel>
                          {personVisibleClosed.map((t) => renderTaskPreview(t, { withTogether: true }))}
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ) : filtered.length === 0 ? (
                <ListHint style={{ textAlign: 'center' }}>
                  {isWorkArchive
                    ? 'Δεν υπάρχουν ολοκληρωμένες εργασίες στην αποθήκη σας (ή έχετε αποχωρήσει από αυτές).'
                    : tab === 'asAssigner' && canAssign
                      ? (isWorkArchive
                        ? 'Δεν υπάρχουν ολοκληρωμένοι χώροι που δημιουργήσατε εσείς.'
                        : 'Δεν υπάρχουν χρεώσεις σε συναδέλφους από εσάς ακόμα. Δημιουργήστε χώρο και επιλέξτε σε ποιον ανατίθεται.')
                      : tab === 'asAssignee' && canAssign
                        ? (isWorkArchive
                          ? 'Δεν υπάρχουν ολοκληρωμένοι χώροι όπου σας έβαλαν άλλοι. Όσα ολοκληρώσατε εσείς είναι στο «Δημιούργησα εγώ».'
                          : 'Δεν σας έχει βάλει κάποιος σε χώρο. Όσα δημιουργήσατε εσείς είναι στο «Δημιούργησα εγώ».')
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
                canEditAsAssigner={canEditSelectedAsAssigner}
                onUpdated={handleTaskUpdated}
                onDeparted={() => {
                  const departedTaskId = selectedTask?.id;
                  if (departedTaskId) {
                    window.dispatchEvent(new CustomEvent(DISMISS_TASK_EVENT, { detail: { taskId: departedTaskId } }));
                  }
                  setSelectedId(null);
                  setSelectedTask(null);
                  loadTasks({ silent: true });
                  loadNotifications();
                  onAccessRefreshRef.current?.();
                }}
                onEdit={
                  canEditSelectedAsAssigner &&
                  !(selectedTask.status === 'completed') &&
                  !(selectedTask.status === 'cancelled' && !selectedTask.withdrawnByAssigner)
                    ? () => openEditAssignmentForm(selectedTask)
                    : undefined
                }
                onDelete={
                  canEditSelectedAsAssigner ? () => handleDelete(selectedTask) : undefined
                }
                workArchiveMode={isWorkArchive || selectedTask?.status === 'completed'}
                onLeaveArchive={handleLeaveArchive}
                canAssign={canAssign}
                assignableUsers={assignableUsers}
              />
            ) : isAssignerRoster && selectedPerson ? (
              <PersonPane data-testid="assigner-person-pane">
                <PersonPaneHead>
                  <PersonPaneTitle>{selectedPerson.fullName}</PersonPaneTitle>
                  <ModeChip
                    type="button"
                    $active={personTaskMode === 'open'}
                    data-testid="assigner-mode-open"
                    onClick={() => setPersonTaskMode('open')}
                  >
                    Ανοιχτά ({selectedPerson.openCount})
                  </ModeChip>
                  <ModeChip
                    type="button"
                    $active={personTaskMode === 'completed'}
                    data-testid="assigner-mode-completed"
                    onClick={() => setPersonTaskMode('completed')}
                  >
                    Ολοκληρωμένα ({selectedPerson.completedCount})
                  </ModeChip>
                </PersonPaneHead>
                {personVisibleTasks.length === 0 && personVisibleClosed.length === 0 ? (
                  <ListHint>
                    {personTaskMode === 'completed'
                      ? 'Δεν υπάρχουν ολοκληρωμένοι χώροι γι’ αυτό το άτομο.'
                      : 'Δεν υπάρχουν ανοιχτοί χώροι γι’ αυτό το άτομο.'}
                  </ListHint>
                ) : (
                  <>
                    {personVisibleTasks.map((t) => renderTaskPreview(t, { withTogether: true }))}
                    {personVisibleClosed.length > 0 ? (
                      <>
                        <ClosedSectionLabel>Κλειστοί — φαίνονται μόνο σε εσάς</ClosedSectionLabel>
                        {personVisibleClosed.map((t) => renderTaskPreview(t, { withTogether: true }))}
                      </>
                    ) : null}
                  </>
                )}
              </PersonPane>
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
                      : isAssignerRoster
                        ? (search.trim()
                          ? 'Δεν βρέθηκε συνάδελφος ή χώρος με αυτό τον όρο.'
                          : 'Δεν υπάρχουν χρεώσεις σε συναδέλφους από εσάς ακόμα. Δημιουργήστε χώρο και επιλέξτε σε ποιον ανατίθεται.')
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
          key={`ta-form-${taskFormMountKey}-${editingTask?.id ?? 'create'}`}
          onClose={() => {
            setFormOpen(false);
            setEditingTask(null);
            resetDocumentInteractionState();
            if (isOpen) {
              allowDocumentInteractionLock();
              scheduleDocumentInteractionRecovery({ lockScroll: true });
            }
          }}
          actingUsername={actingUsername}
          editingTask={editingTask}
          assignableUsers={assignableUsers}
          onSaved={async (task) => {
            const nextTab = canAssign ? 'asAssigner' : 'asAssignee';
            setTab(nextTab);
            await loadTasks({ silent: true, viewOverride: nextTab });
            loadNotifications();
            if (canAssign && Array.isArray(task?.assignees)) {
              const stillSelected = task.assignees.some(
                (a) => String(a || '').toLowerCase() === String(selectedPersonUsername || '').toLowerCase()
              );
              const pick = stillSelected
                ? selectedPersonUsername
                : pickRosterPersonUsername(task, actingUsername);
              if (pick) {
                setSelectedPersonUsername(pick);
                setPersonTaskMode('open');
              }
            }
            if (task?.id) await openTask(task.id, { forceTab: nextTab });
            onAccessRefreshRef.current?.();
          }}
        />
      )}
    </Overlay>
  );
}

export default TaskAssignmentManager;
