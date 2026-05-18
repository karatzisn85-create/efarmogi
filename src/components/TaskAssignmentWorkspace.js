import React, { useState, useMemo, useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  formatTaskDueDate,
  isTaskOverdue,
  isTaskWithdrawnByAssigner,
  hasLeftWorkArchive,
  formatAssigneeDisplayNames,
  formatLeftArchiveDisplayNames,
  formatDepartedAssigneeDisplayNames,
  getArchiveReadonlyMessage
} from '../utils/taskAssignmentDisplay';
import { scheduleDocumentInteractionRecovery } from '../utils/documentInteractionReset';

const ipcRenderer = window.electronAPI;

const Root = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  background: #f8fafc;
  overflow: hidden;
`;

const TopBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.42rem 0.75rem 0.48rem;
  background: linear-gradient(180deg, #f8fafc 0%, #fafbff 55%, #ffffff 100%);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 0 rgba(238, 242, 255, 0.9);
`;

const HeadTitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  row-gap: 0.25rem;
`;

const HeadMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const TaskTitle = styled.h2`
  margin: 0;
  font-size: 1.06rem;
  color: #0f172a;
  line-height: 1.25;
  font-weight: 700;
`;

const ParticipantDetails = styled.details`
  margin-top: 0.15rem;
  font-size: 0.84rem;
  color: #475569;
  line-height: 1.5;
`;

const ParticipantSummary = styled.summary`
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  color: #64748b;
  user-select: none;
  &:hover {
    color: #475569;
  }
`;

const ParticipantPanel = styled.div`
  margin-top: 0.45rem;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #334155;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  align-items: center;
  font-size: 0.84rem;
  color: #475569;
  line-height: 1.35;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.52rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: ${(p) => p.$bg || '#e2e8f0'};
  color: ${(p) => p.$color || '#334155'};
`;

const DueMeta = styled.span`
  font-weight: ${(p) => (p.$overdue ? 700 : 500)};
  color: ${(p) => (p.$overdue ? '#b91c1c' : '#64748b')};
`;

const MetaMuted = styled.span`
  color: #94a3b8;
  font-weight: 600;
  font-size: 0.76rem;
`;

const ActionsCol = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
  align-self: center;
  max-width: min(440px, 46%);
  align-items: flex-end;
`;

const StatusStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-end;
`;

const StatusFieldLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
`;

const FlowStatusSelect = styled.select`
  min-height: 34px;
  padding: 0.32rem 1.85rem 0.32rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  font-size: 0.8rem;
  font-weight: 700;
  font-family: inherit;
  background: linear-gradient(180deg, #fafbff 0%, #eef2ff 100%);
  color: #3730a3;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.55rem center;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ActionBtn = styled.button`
  padding: 0.35rem 0.72rem;
  min-height: 34px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid ${(p) => (p.$danger ? '#fecaca' : p.$primary ? 'transparent' : '#e2e8f0')};
  background: ${(p) => (p.$danger ? '#fef2f2' : p.$primary ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#fff')};
  color: ${(p) => (p.$danger ? '#b91c1c' : p.$primary ? '#fff' : '#334155')};
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const MainStage = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
`;

const MainGrid = styled.div`
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ChatColumn = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #fafbfc 0%, #f4f6f8 100%);
`;

const HistoryDrawerBackdrop = styled.button`
  position: absolute;
  inset: 0;
  z-index: 8;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.28);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
`;

const HistoryDrawer = styled.aside`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 9;
  width: min(340px, min(92vw, 100%));
  max-width: 100%;
  background: linear-gradient(180deg, #fafbfc 0%, #f4f6f9 100%);
  border-left: 1px solid #e8ecf1;
  box-shadow: -8px 0 28px rgba(15, 23, 42, 0.12);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.15rem 1.25rem 1.5rem;
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition: transform 0.22s ease;
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
`;

const TimelineShell = styled.div`
  flex: 1 1 0;
  min-height: 0;
  padding: 0.35rem clamp(0.45rem, 1.2vw, 0.85rem) 0.4rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const TimelineScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.75rem clamp(0.55rem, 1.5vw, 1.1rem) 0.95rem;
  border-radius: 10px;
  border: 1px solid #e8eef4;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
`;

const TimelineInner = styled.div`
  width: 100%;
  max-width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ChatSectionHeadInner = styled.div`
  width: 100%;
  max-width: 100%;
  margin: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const ComposerInner = styled.div`
  width: 100%;
  max-width: 100%;
  margin: 0;
`;

const OriginCard = styled.article`
  align-self: stretch;
  margin: 0;
  padding: 0.82rem 1rem 0.85rem 1.15rem;
  border-radius: 12px;
  border: 1px solid #fcd34d;
  background: linear-gradient(180deg, #fffbeb 0%, #fefce8 100%);
  box-shadow: 0 2px 12px rgba(180, 83, 9, 0.06);
  position: relative;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 6px;
    border-radius: 0 8px 8px 0;
    background: linear-gradient(180deg, #fbbf24, #d97706);
    box-shadow: 2px 0 8px rgba(217, 119, 6, 0.35);
  }
`;

const OriginBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(180, 83, 9, 0.88);
  color: #fffbeb;
`;

const OriginHeadRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.65rem;
`;

const OriginMeta = styled.div`
  font-size: 0.9rem;
  color: #92400e;
  font-weight: 600;
  line-height: 1.45;
`;

const OriginDescription = styled.div`
  margin: 0;
  font-size: 1.05rem;
  color: #0f172a;
  white-space: pre-wrap;
  line-height: 1.65;
`;

const OriginMuted = styled.p`
  margin: 0;
  font-size: 0.96rem;
  color: #b45309;
  font-style: italic;
  line-height: 1.5;
`;

const FlowDivider = styled.div`
  align-self: stretch;
  height: 1px;
  margin: 0.15rem 0;
  background: linear-gradient(90deg, transparent, #cbd5e1 12%, #cbd5e1 88%, transparent);
  opacity: 0.9;
`;

const FlowPhaseWrap = styled.div`
  align-self: stretch;
  display: flex;
  justify-content: center;
  margin: 0.25rem 0 0.35rem;
`;

const FlowPhaseLabel = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.38rem 0.95rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
`;

const SystemEventWrap = styled.div`
  align-self: stretch;
  display: flex;
  justify-content: center;
  margin: 0.35rem 0;
`;

const SystemEventCard = styled.div`
  max-width: min(36rem, 100%);
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  border: 1px solid #fde68a;
  background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
  color: #92400e;
  font-size: 0.82rem;
  line-height: 1.45;
  text-align: center;
  strong {
    font-weight: 800;
  }
  time {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.72rem;
    color: #b45309;
    font-weight: 600;
  }
`;

const FileTimelineRow = styled.div`
  align-self: stretch;
  width: 100%;
  display: flex;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const MessageBundle = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$mine ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: 0.45rem;
  width: ${(p) => (p.$mine ? 'auto' : '100%')};
  max-width: ${(p) => (p.$mine ? 'min(900px, 94%)' : '100%')};
`;

const FileBubble = styled.div`
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid #bfdbfe;
  background: #f8fafc;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
`;

const FileAttachmentLabel = styled.div`
  font-weight: 700;
  font-size: 0.76rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #2563eb;
  margin-bottom: 0.5rem;
`;

const ChatSectionHead = styled.div`
  flex-shrink: 0;
  padding: 0.38rem clamp(0.55rem, 1.5vw, 1rem);
  background: linear-gradient(180deg, #eef2ff 0%, #e8ecfc 100%);
  border-bottom: 2px solid #c7d2fe;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65) inset;
`;

const ChatSectionTitle = styled.h3`
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: none;
  color: #312e81;
`;

const HistoryDrawerBtn = styled.button`
  flex-shrink: 0;
  padding: 0.32rem 0.72rem;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$active ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$active ? 'rgba(99, 102, 241, 0.12)' : '#fff')};
  color: ${(p) => (p.$active ? '#3730a3' : '#334155')};
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
  min-height: 34px;
  &:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }
`;

const ChatMessageRow = styled.div`
  align-self: stretch;
  width: 100%;
  display: flex;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const AvatarCircle = styled.div`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  background: ${(p) => p.$bg || '#64748b'};
  border: 2px solid ${(p) => p.$ring || 'rgba(255,255,255,0.96)'};
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
`;

const BubbleStack = styled.div`
  flex: ${(p) => (p.$mine ? '0 1 auto' : '1 1 0')};
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const Bubble = styled.div`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: ${(p) => {
    if (p.$variant === 'mine') return 'linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)';
    if (p.$variant === 'assigner') return '#fffbeb';
    if (p.$variant === 'assignee') return '#eff6ff';
    return '#f1f5f9';
  }};
  color: ${(p) => (p.$variant === 'mine' ? '#fff' : '#1e293b')};
  border: 1px solid
    ${(p) => {
      if (p.$variant === 'mine') return 'rgba(255,255,255,0.12)';
      if (p.$variant === 'assigner') return '#fcd34d';
      if (p.$variant === 'assignee') return '#93c5fd';
      return '#e2e8f0';
    }};
  border-radius: ${(p) => (p.$mine ? '12px 12px 4px 12px' : '12px 12px 12px 4px')};
  padding: 0.62rem 0.82rem;
  box-shadow: ${(p) =>
    p.$variant === 'mine'
      ? '0 4px 18px rgba(79, 70, 229, 0.28)'
      : '0 2px 10px rgba(15, 23, 42, 0.06)'};
`;

const BubbleAuthorBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.55rem;
  margin-bottom: 0.45rem;
  max-width: 100%;
`;

const BubbleAuthorName = styled.span`
  font-size: 0.98rem;
  font-weight: 800;
  color: ${(p) => (p.$mine ? '#fff' : '#0f172a')};
`;

const BubbleAuthorUser = styled.span`
  font-size: 0.84rem;
  font-weight: 600;
  color: ${(p) => (p.$mine ? 'rgba(224,231,255,0.95)' : '#475569')};
`;

const BubbleRoleTag = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
`;

const BubbleTime = styled.time`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${(p) => (p.$mine ? 'rgba(224,231,255,0.9)' : '#64748b')};
`;

const BubbleText = styled.div`
  font-size: 0.98rem;
  white-space: pre-wrap;
  line-height: 1.55;
  word-break: break-word;
`;

const FileLink = styled.button`
  background: none;
  border: none;
  color: #3730a3;
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  &:hover {
    color: #4f46e5;
  }
  &:focus-visible {
    outline: 3px solid rgba(99, 102, 241, 0.45);
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Composer = styled.div`
  flex-shrink: 0;
  padding: 0.45rem clamp(0.55rem, 1.5vw, 1rem) calc(0.55rem + env(safe-area-inset-bottom, 0px));
  margin-top: 0;
  background: linear-gradient(180deg, #fafbff 0%, #f1f5ff 55%, #f8fafc 100%);
  border-top: 1px solid #dce3fb;
  box-shadow: 0 -3px 0 #c7d2fe inset;
`;

const ArchiveComposerNotice = styled.p`
  margin: 0 0 0.45rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.8rem;
  line-height: 1.45;
  font-weight: 600;
`;

const ComposerRow = styled.div`
  display: flex;
  gap: 0.45rem;
  align-items: flex-end;
  flex-wrap: wrap;
`;

const ComposerInput = styled.textarea`
  flex: 1;
  min-width: 0;
  min-height: 52px;
  height: auto;
  max-height: ${(p) => (p.$allowResize ? '220px' : '240px')};
  padding: 0.5rem 0.72rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.93rem;
  font-family: inherit;
  resize: vertical;
  overflow-y: auto;
  line-height: 1.45;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const IconBtn = styled.button`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
  font-size: 1rem;
  &:hover {
    background: #f1f5f9;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 3px solid rgba(99, 102, 241, 0.45);
    outline-offset: 2px;
  }
`;

const SendBtn = styled(IconBtn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  width: auto;
  min-width: 96px;
  padding: 0 0.85rem;
  height: 38px;
`;

const SideBlock = styled.div`
  margin-bottom: 1.5rem;
  padding-bottom: 1.35rem;
  border-bottom: 1px solid #dce3ec;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const SideTitle = styled.h4`
  margin: 0 0 0.65rem;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
`;

const SideList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.93rem;
`;

const SideListItem = styled.li`
  padding: 0.55rem 0;
  border-bottom: 1px solid #e8eef4;
  color: #334155;
  line-height: 1.45;

  &:last-child {
    border-bottom: none;
  }
`;

const ErrorBar = styled.div`
  padding: 0.55rem 0.75rem;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.93rem;
  font-weight: 600;
  border-bottom: 1px solid #fecaca;
`;

const RejectModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  animation: rejectFadeIn 0.2s ease;
  @keyframes rejectFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const RejectModalCard = styled.div`
  width: min(460px, 100%);
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 28px 56px rgba(30, 27, 75, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  animation: rejectPop 0.22s cubic-bezier(0.34, 1.2, 0.64, 1);
  @keyframes rejectPop {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const RejectModalHero = styled.div`
  padding: 1.2rem 1.45rem 1.35rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 48%, #7c3aed 100%);
  color: #fff;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 90% 80% at 90% 0%, rgba(255, 255, 255, 0.2), transparent 50%);
    pointer-events: none;
  }
`;

const RejectModalEyebrow = styled.div`
  position: relative;
  z-index: 1;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 0.35rem;
`;

const RejectModalTitle = styled.h3`
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
`;

const RejectModalTaskName = styled.p`
  position: relative;
  z-index: 1;
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.4;
  opacity: 0.94;
  max-height: 3.2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const RejectModalBody = styled.div`
  padding: 1.25rem 1.45rem 0.5rem;
`;

const RejectModalHint = styled.p`
  margin: 0 0 0.85rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #64748b;
`;

const RejectModalLabel = styled.label`
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.38rem;
`;

const RejectModalTextarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 88px;
  max-height: 200px;
  padding: 0.55rem 0.72rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.93rem;
  font-family: inherit;
  line-height: 1.45;
  resize: vertical;
  color: #0f172a;
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
`;

const RejectModalFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: flex-end;
  padding: 1rem 1.45rem 1.35rem;
`;

const RejectModalCancelBtn = styled.button`
  padding: 0.45rem 1rem;
  min-height: 40px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const RejectModalConfirmBtn = styled.button`
  padding: 0.45rem 1.1rem;
  min-height: 40px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 4px 14px rgba(185, 28, 28, 0.35);
  &:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const statusColors = {
  pending: { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1e40af' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#f1f5f9', color: '#64748b' }
};

const AVATAR_PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7', '#ec4899', '#84cc16'];

function hashUserKey(username) {
  const str = String(username || '');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarColorForUser(username) {
  return AVATAR_PALETTE[hashUserKey(username) % AVATAR_PALETTE.length];
}

function authorDisplayName(username, usersMap) {
  const u = usersMap?.[username];
  const name = (u?.fullName || username || '?').trim();
  return name || '?';
}

function authorInitials(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  const one = parts[0] || '?';
  return one.slice(0, 2).toUpperCase();
}

/** @returns {'mine' | 'assigner' | 'assignee' | 'other'} */
function chatBubbleVariant(authorUsername, actingUsername, task) {
  const a = String(authorUsername || '').toLowerCase();
  const me = String(actingUsername || '').toLowerCase();
  if (a && me && a === me) return 'mine';
  if (a && a === String(task.createdBy || '').toLowerCase()) return 'assigner';
  if ((task.assignees || []).some((x) => String(x).toLowerCase() === a)) return 'assignee';
  return 'other';
}

function roleTagForVariant(variant) {
  if (variant === 'mine') return null;
  if (variant === 'assigner') return { label: 'Δημιουργός', bg: '#fef3c7', color: '#92400e' };
  if (variant === 'assignee') return { label: 'Συνάδελφος', bg: '#dbeafe', color: '#1e40af' };
  return { label: 'Συμμετέχων', bg: '#f1f5f9', color: '#475569' };
}

/** Χρονολογική ροή: έναρξη χώρου → αρχεία & σχόλια. */
function buildUnifiedTimeline(task) {
  const TYPE_ORDER = { origin: 0, file: 1, comment: 2, system: 3 };
  const items = [];

  const originAt = task.createdAt || task.statusHistory?.[0]?.at || new Date(0).toISOString();
  items.push({
    id: 'timeline-origin',
    type: 'origin',
    at: originAt,
    author: task.createdBy,
    description: String(task.description || '').trim()
  });

  (task.files || []).forEach((f) => {
    items.push({
      id: `timeline-file-${f.id}`,
      type: 'file',
      at: f.uploadedAt || originAt,
      author: f.uploadedBy,
      file: f
    });
  });

  (task.comments || []).forEach((c) => {
    items.push({
      id: `timeline-comment-${c.id}`,
      type: 'comment',
      at: c.createdAt,
      author: c.author,
      text: c.text
    });
  });

  (task.statusHistory || []).forEach((h, idx) => {
    const note = String(h.note || '').trim();
    const st = h.status;
    const isArchive = note.includes('αποθήκη');
    const isDeparture = h.event === 'assignee_departed' || (note.includes('Αποχώρηση') && !note.includes('Επαναπρόσκληση'));
    const isRejoin = h.event === 'assignee_rejoined' || note.includes('Επαναπρόσκληση συνάδελφου');
    const isClosure = st === 'cancelled';
    if (!isArchive && !isDeparture && !isRejoin && !isClosure) return;

    let text = note;
    if (isRejoin) text = note;
    else if (isDeparture) text = note || 'Αποχώρηση από τον χώρο εργασίας';
    else if (isClosure && !note) text = 'Κλείσιμο χώρου';

    items.push({
      id: `timeline-status-${h.at}-${idx}`,
      type: 'system',
      at: h.at,
      author: h.by,
      text
    });
  });

  items.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return String(a.at).localeCompare(String(b.at));
    if (ta !== tb) return ta - tb;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return items;
}

function TaskAssignmentWorkspace({
  task,
  actingUsername,
  usersMap,
  onUpdated,
  onDeparted,
  canEditAsAssigner,
  onEdit,
  onDelete,
  isSuperAdmin = false,
  workArchiveMode = false,
  onLeaveArchive
}) {
  const [comment, setComment] = useState('');
  const [departNote, setDepartNote] = useState('');
  const [departModalOpen, setDepartModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [leaveArchiveModalOpen, setLeaveArchiveModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const feedRef = useRef(null);
  const prevDepartModalRef = useRef(false);
  const prevWithdrawModalRef = useRef(false);
  const prevLeaveArchiveModalRef = useRef(false);

  const isAssigner = task.createdBy?.toLowerCase() === actingUsername?.toLowerCase();
  const isAssignee = (task.assignees || []).some(
    (a) => String(a).toLowerCase() === String(actingUsername || '').toLowerCase()
  );
  const assignerWithdrawnCleanup = isTaskWithdrawnByAssigner(task) && isAssigner;
  const workflowOpen = task.status !== 'cancelled';
  const isArchivedReadOnly = workArchiveMode && task.status === 'completed';
  const archiveReadonlyMessage = useMemo(
    () => getArchiveReadonlyMessage(task, actingUsername, canEditAsAssigner),
    [task, actingUsername, canEditAsAssigner]
  );
  const chatAllowed = (workflowOpen || assignerWithdrawnCleanup) && !isArchivedReadOnly;
  const canReopenFromArchive =
    workArchiveMode &&
    task.status === 'completed' &&
    workflowOpen &&
    ((isAssigner && canEditAsAssigner) || isSuperAdmin);
  const canSetFlowStatus =
    canReopenFromArchive ||
    (workflowOpen &&
      (isAssigner || isAssignee || isSuperAdmin) &&
      !(workArchiveMode && task.status === 'completed'));
  const showLeaveArchiveBtn =
    workArchiveMode &&
    isAssignee &&
    !isAssigner &&
    task.status === 'completed' &&
    !hasLeftWorkArchive(task, actingUsername);
  const overdue = isTaskOverdue(task);
  const sc = statusColors[task.status] || {};

  const feedItems = useMemo(() => buildUnifiedTimeline(task), [task]);

  const feedScrollSig = useMemo(() => feedItems.map((i) => i.id).join('|'), [feedItems]);

  useEffect(() => {
    setHistoryOpen(false);
    setDepartModalOpen(false);
    setWithdrawModalOpen(false);
    setLeaveArchiveModalOpen(false);
    setDepartNote('');
  }, [task.id]);

  useEffect(() => {
    if (!departModalOpen && !withdrawModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        setDepartModalOpen(false);
        setWithdrawModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [departModalOpen, withdrawModalOpen, busy]);

  useEffect(() => {
    if (prevDepartModalRef.current && !departModalOpen) {
      scheduleDocumentInteractionRecovery({ lockScroll: true });
    }
    prevDepartModalRef.current = departModalOpen;
  }, [departModalOpen]);

  useEffect(() => {
    if (prevWithdrawModalRef.current && !withdrawModalOpen) {
      scheduleDocumentInteractionRecovery({ lockScroll: true });
    }
    prevWithdrawModalRef.current = withdrawModalOpen;
  }, [withdrawModalOpen]);

  useEffect(() => {
    if (prevLeaveArchiveModalRef.current && !leaveArchiveModalOpen) {
      scheduleDocumentInteractionRecovery({ lockScroll: true });
    }
    prevLeaveArchiveModalRef.current = leaveArchiveModalOpen;
  }, [leaveArchiveModalOpen]);

  useEffect(() => {
    if (!leaveArchiveModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) setLeaveArchiveModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveArchiveModalOpen, busy]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feedScrollSig]);

  const assigneeNames = formatAssigneeDisplayNames(task, usersMap);
  const departedNames = formatDepartedAssigneeDisplayNames(task, usersMap);
  const leftArchiveNames = formatLeftArchiveDisplayNames(task, usersMap);

  const notifyArchiveReadonly = () => {
    setError(archiveReadonlyMessage);
    scheduleDocumentInteractionRecovery({ lockScroll: true });
  };

  const runStatus = async (status, reason, withdrawFromAssignees = false) => {
    setBusy(true);
    setError('');
    const res = await ipcRenderer.invoke('update-task-assignment-status', {
      actingUsername,
      taskId: task.id,
      status,
      reason,
      withdrawFromAssignees: status === 'cancelled' ? !!withdrawFromAssignees : undefined
    });
    setBusy(false);
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    if (res?.success) {
      onUpdated(res.task);
      setWithdrawModalOpen(false);
    } else {
      setError(res?.error || 'Σφάλμα');
    }
  };

  const runDepart = async () => {
    setBusy(true);
    setError('');
    const res = await ipcRenderer.invoke('leave-task-assignment-workspace', {
      actingUsername,
      taskId: task.id,
      note: departNote
    });
    setBusy(false);
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    if (res?.success) {
      setDepartModalOpen(false);
      setDepartNote('');
      if (res.leftWorkspace) {
        onDeparted?.();
      } else {
        onUpdated(res.task);
      }
    } else {
      setError(res?.error || 'Σφάλμα');
    }
  };

  const submitComment = async () => {
    if (isArchivedReadOnly) {
      notifyArchiveReadonly();
      return;
    }
    if (!comment.trim() || busy) return;
    setBusy(true);
    const res = await ipcRenderer.invoke('add-task-assignment-comment', {
      actingUsername,
      taskId: task.id,
      text: comment.trim()
    });
    setBusy(false);
    if (res?.success) {
      setComment('');
      onUpdated(res.task);
    } else {
      setError(res?.error || 'Σφάλμα');
    }
  };

  const addFiles = async () => {
    if (isArchivedReadOnly) {
      notifyArchiveReadonly();
      return;
    }
    const picked = await ipcRenderer.invoke('select-multiple-files', 'Αρχεία χώρου');
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    if (!picked?.success || picked.canceled || !Array.isArray(picked.files) || !picked.files.length) return;
    setBusy(true);
    const res = await ipcRenderer.invoke('add-task-assignment-files', {
      actingUsername,
      taskId: task.id,
      newFiles: picked.files
    });
    setBusy(false);
    if (res?.success) onUpdated(res.task);
    else setError(res?.error || 'Σφάλμα');
  };

  const handleComposerKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitComment();
    }
  };

  const handleComposerFocus = () => {
    if (isArchivedReadOnly) notifyArchiveReadonly();
  };

  return (
    <Root>
      <TopBar>
        <HeadMain>
          <HeadTitleRow>
            <TaskTitle>{task.title}</TaskTitle>
            <MetaRow style={{ marginTop: 0 }}>
              <Badge $bg={sc.bg} $color={sc.color}>
                {TASK_STATUS_LABELS[task.status] || task.status}
              </Badge>
              <Badge>{TASK_PRIORITY_LABELS[task.priority] || task.priority}</Badge>
              {assignerWithdrawnCleanup ? (
                <Badge $bg="#fef9c3" $color="#854d0e" title="Ο χώρος δεν εμφανίζεται πλέον στους συναδέλφους">
                  Κλειστός · χρειάζεται ενέργεια
                </Badge>
              ) : null}
              <MetaMuted>Ολοκλήρωση έως</MetaMuted>
              <DueMeta $overdue={overdue}>{formatTaskDueDate(task.dueDate, task.dueTime)}</DueMeta>
              {overdue ? <Badge $bg="#fee2e2" $color="#991b1b">Εκπρόθεσμη</Badge> : null}
            </MetaRow>
          </HeadTitleRow>
          <ParticipantDetails>
            <ParticipantSummary>Συμμετέχοντες</ParticipantSummary>
            <ParticipantPanel>
              <div>
                <strong>Δημιουργός</strong> · {usersMap[task.createdBy]?.fullName || task.createdBy}{' '}
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>({task.createdBy})</span>
              </div>
              <div style={{ marginTop: '0.45rem' }}>
                <strong>Συνάδελφοι</strong> · {assigneeNames || '—'}
              </div>
              {departedNames ? (
                <div style={{ marginTop: '0.35rem', color: '#b45309', fontWeight: 600 }}>
                  <strong>Αποχώρησαν από τον χώρο</strong> · {departedNames}
                </div>
              ) : null}
              {leftArchiveNames ? (
                <div style={{ marginTop: '0.35rem', color: '#b45309', fontWeight: 600 }}>
                  <strong>Αποχώρησαν από αποθήκη</strong> · {leftArchiveNames}
                </div>
              ) : null}
            </ParticipantPanel>
          </ParticipantDetails>
        </HeadMain>
        <ActionsCol>
          {canSetFlowStatus && (
            <StatusStack>
              <StatusFieldLabel>
                {canReopenFromArchive ? 'Επαναφορά από αποθήκη' : 'Κατάσταση'}
              </StatusFieldLabel>
              <FlowStatusSelect
                aria-label={
                  canReopenFromArchive
                    ? 'Επαναφορά χώρου στον ενεργό χώρο εργασίας'
                    : 'Αλλαγή κατάστασης χώρου'
                }
                value={task.status}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === task.status) return;
                  runStatus(next);
                }}
              >
                {canReopenFromArchive ? (
                  <>
                    <option value="completed" disabled>
                      {TASK_STATUS_LABELS.completed} (τρέχουσα)
                    </option>
                    <option value="pending">{TASK_STATUS_LABELS.pending}</option>
                    <option value="in_progress">{TASK_STATUS_LABELS.in_progress}</option>
                    <option value="cancelled">{TASK_STATUS_LABELS.cancelled}</option>
                  </>
                ) : (
                  <>
                    <option value="pending">{TASK_STATUS_LABELS.pending}</option>
                    <option value="in_progress">{TASK_STATUS_LABELS.in_progress}</option>
                    <option value="completed">{TASK_STATUS_LABELS.completed}</option>
                  </>
                )}
              </FlowStatusSelect>
            </StatusStack>
          )}
          {workflowOpen && isAssignee && !isAssigner && ['pending', 'in_progress'].includes(task.status) && (
            <ActionBtn
              $danger
              type="button"
              disabled={busy}
              onClick={() => {
                setDepartNote('');
                setDepartModalOpen(true);
              }}
            >
              Αποχώρηση
            </ActionBtn>
          )}
          {workflowOpen && isAssigner && canEditAsAssigner && task.status !== 'completed' && (
            <>
              {onEdit && (
                <ActionBtn type="button" disabled={busy} onClick={onEdit}>
                  Επεξεργασία
                </ActionBtn>
              )}
              <ActionBtn $danger type="button" disabled={busy} onClick={() => setWithdrawModalOpen(true)}>
                Κλείσιμο χώρου
              </ActionBtn>
            </>
          )}
          {assignerWithdrawnCleanup && canEditAsAssigner && onEdit && (
            <ActionBtn type="button" disabled={busy} onClick={onEdit}>
              Επεξεργασία
            </ActionBtn>
          )}
          {showLeaveArchiveBtn && onLeaveArchive && (
            <ActionBtn type="button" disabled={busy} onClick={() => setLeaveArchiveModalOpen(true)}>
              Αποχώρηση από αποθήκη
            </ActionBtn>
          )}
          {onDelete && isAssigner && canEditAsAssigner && (
            <ActionBtn $danger type="button" disabled={busy} onClick={onDelete}>
              {workArchiveMode ? 'Οριστική διαγραφή' : 'Διαγραφή'}
            </ActionBtn>
          )}
        </ActionsCol>
      </TopBar>

      {departModalOpen && workflowOpen && isAssignee && !isAssigner && ['pending', 'in_progress'].includes(task.status) && (
        <RejectModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setDepartModalOpen(false);
          }}
        >
          <RejectModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="depart-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <RejectModalHero>
              <RejectModalEyebrow>Επιβεβαίωση</RejectModalEyebrow>
              <RejectModalTitle id="depart-modal-title">Αποχώρηση από τον χώρο;</RejectModalTitle>
              <RejectModalTaskName>«{task.title}»</RejectModalTaskName>
            </RejectModalHero>
            <RejectModalBody>
              <RejectModalHint>
                Θα αποχωρήσετε από αυτόν τον χώρο — οι υπόλοιποι συνάδελφοι και ο δημιουργός συνεχίζουν κανονικά.
                Ο δημιουργός μπορεί να σας ξαναπροσθέσει αργότερα μέσω επεξεργασίας. Προαιρετικά σημειώστε λόγο
                αποχώρησης.
              </RejectModalHint>
              <RejectModalLabel htmlFor="depart-note-input">Σημείωση (προαιρετική)</RejectModalLabel>
              <RejectModalTextarea
                id="depart-note-input"
                value={departNote}
                onChange={(e) => setDepartNote(e.target.value)}
                placeholder="Π.χ. δεν μπορώ πλέον να συμμετέχω σε αυτή την εργασία…"
                disabled={busy}
              />
            </RejectModalBody>
            <RejectModalFooter>
              <RejectModalCancelBtn type="button" disabled={busy} onClick={() => setDepartModalOpen(false)}>
                Πίσω
              </RejectModalCancelBtn>
              <RejectModalConfirmBtn type="button" disabled={busy} onClick={runDepart}>
                {busy ? 'Γίνεται αποχώρηση…' : 'Ναι, αποχώρηση'}
              </RejectModalConfirmBtn>
            </RejectModalFooter>
          </RejectModalCard>
        </RejectModalBackdrop>
      )}

      {withdrawModalOpen && workflowOpen && isAssigner && canEditAsAssigner && task.status !== 'completed' && (
        <RejectModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setWithdrawModalOpen(false);
          }}
        >
          <RejectModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <RejectModalHero>
              <RejectModalEyebrow>Επιβεβαίωση</RejectModalEyebrow>
              <RejectModalTitle id="withdraw-modal-title">Κλείσιμο χώρου για συναδέλφους;</RejectModalTitle>
              <RejectModalTaskName>«{task.title}»</RejectModalTaskName>
            </RejectModalHero>
            <RejectModalBody>
              <RejectModalHint>
                Με την επιβεβαίωση, ο χώρος <strong>κλείνει για τους συναδέλφους</strong>: δεν θα εμφανίζεται πλέον στη
                λίστα και στην προβολή τους. Εσείς ως αναθέτης θα τον βλέπετε ακόμα στη δική σας λίστα, με σήμανση ότι
                χρειάζεται <strong>επεξεργασία</strong> (π.χ. διόρθωση) ή <strong>διαγραφή</strong> όταν ολοκληρώσετε τη
                διαχείρισή του.
              </RejectModalHint>
            </RejectModalBody>
            <RejectModalFooter>
              <RejectModalCancelBtn type="button" disabled={busy} onClick={() => setWithdrawModalOpen(false)}>
                Πίσω
              </RejectModalCancelBtn>
              <RejectModalConfirmBtn type="button" disabled={busy} onClick={() => runStatus('cancelled', '', true)}>
                {busy ? 'Γίνεται κλείσιμο…' : 'Ναι, κλείσιμο'}
              </RejectModalConfirmBtn>
            </RejectModalFooter>
          </RejectModalCard>
        </RejectModalBackdrop>
      )}

      {leaveArchiveModalOpen && showLeaveArchiveBtn && onLeaveArchive && (
        <RejectModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setLeaveArchiveModalOpen(false);
          }}
        >
          <RejectModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-archive-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <RejectModalHero>
              <RejectModalEyebrow>Επιβεβαίωση</RejectModalEyebrow>
              <RejectModalTitle id="leave-archive-modal-title">Αποχώρηση από αποθήκη;</RejectModalTitle>
              <RejectModalTaskName>«{task.title}»</RejectModalTaskName>
            </RejectModalHero>
            <RejectModalBody>
              <RejectModalHint>
                Ο χώρος <strong>παραμένει στην αποθήκη</strong> για τον αναθέτη και τους υπόλοιπους συναδέλφους. Εσείς
                δεν θα τον βλέπετε πλέον στη λίστα σας — μπορείτε να επιστρέψετε μόνο αν σας ξαναπροσκαλέσουν σε νέο χώρο.
              </RejectModalHint>
            </RejectModalBody>
            <RejectModalFooter>
              <RejectModalCancelBtn type="button" disabled={busy} onClick={() => setLeaveArchiveModalOpen(false)}>
                Πίσω
              </RejectModalCancelBtn>
              <RejectModalConfirmBtn
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onLeaveArchive(task);
                  setBusy(false);
                  setLeaveArchiveModalOpen(false);
                }}
              >
                {busy ? 'Γίνεται αποχώρηση…' : 'Ναι, αποχώρηση'}
              </RejectModalConfirmBtn>
            </RejectModalFooter>
          </RejectModalCard>
        </RejectModalBackdrop>
      )}

      {error && <ErrorBar>{error}</ErrorBar>}

      <MainStage>
        <MainGrid>
          <ChatColumn>
          <ChatSectionHead>
            <ChatSectionHeadInner>
              <ChatSectionTitle>Ροή συνεργασίας</ChatSectionTitle>
              <HistoryDrawerBtn type="button" $active={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
                Ιστορικό {historyOpen ? '▴' : '▾'}
              </HistoryDrawerBtn>
            </ChatSectionHeadInner>
          </ChatSectionHead>

          <TimelineShell>
            <TimelineScroll ref={feedRef}>
              <TimelineInner>
              {feedItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 && feedItems[idx - 1].type === 'origin' && item.type !== 'origin' ? (
                    <>
                      <FlowDivider />
                      <FlowPhaseWrap>
                        <FlowPhaseLabel>Συνέχεια · συνομιλία και αρχεία</FlowPhaseLabel>
                      </FlowPhaseWrap>
                    </>
                  ) : null}

                  {item.type === 'origin' ? (
                    <OriginCard aria-label="Έναρξη χώρου">
                      <OriginHeadRow>
                        <OriginBadge>Έναρξη χώρου</OriginBadge>
                        <OriginMeta>
                          <strong>{authorDisplayName(item.author, usersMap)}</strong>
                          <span aria-hidden> · </span>
                          <time dateTime={item.at}>
                            {new Date(item.at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}
                          </time>
                        </OriginMeta>
                      </OriginHeadRow>
                      <OriginMeta style={{ marginBottom: item.description ? 10 : 0 }}>
                        {TASK_PRIORITY_LABELS[task.priority] || task.priority}
                        <span aria-hidden> · </span>
                        Ολοκλήρωση εργασίας έως: {formatTaskDueDate(task.dueDate, task.dueTime)}
                      </OriginMeta>
                      {item.description ? (
                        <OriginDescription>{item.description}</OriginDescription>
                      ) : (
                        <OriginMuted>Δεν προστέθηκε κείμενο στην έναρξη του χώρου.</OriginMuted>
                      )}
                    </OriginCard>
                  ) : null}

                  {item.type === 'file'
                    ? (() => {
                        const variant = chatBubbleVariant(item.author, actingUsername, task);
                        const mine = variant === 'mine';
                        const displayName = authorDisplayName(item.author, usersMap);
                        const initials = authorInitials(displayName);
                        const roleTag = roleTagForVariant(variant);
                        const avBg = mine ? '#4f46e5' : avatarColorForUser(item.author);
                        const f = item.file;
                        return (
                          <FileTimelineRow $mine={mine}>
                            <MessageBundle $mine={mine}>
                            <AvatarCircle $bg={avBg} title={`${displayName} (${item.author})`}>
                              {initials}
                            </AvatarCircle>
                            <FileBubble>
                              <BubbleAuthorBar>
                                <BubbleAuthorName $mine={false}>{displayName}</BubbleAuthorName>
                                <BubbleAuthorUser $mine={false}>({item.author})</BubbleAuthorUser>
                                {mine ? (
                                  <BubbleRoleTag $bg="#e0e7ff" $color="#3730a3">
                                    Εγώ
                                  </BubbleRoleTag>
                                ) : null}
                                {!mine && roleTag ? (
                                  <BubbleRoleTag $bg={roleTag.bg} $color={roleTag.color}>
                                    {roleTag.label}
                                  </BubbleRoleTag>
                                ) : null}
                                <BubbleTime $mine={false} dateTime={item.at}>
                                  {new Date(item.at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}
                                </BubbleTime>
                              </BubbleAuthorBar>
                              <FileAttachmentLabel>Συνημμένο αρχείο</FileAttachmentLabel>
                              <FileLink
                                type="button"
                                onClick={() =>
                                  ipcRenderer.invoke('open-task-assignment-file', {
                                    actingUsername,
                                    taskId: task.id,
                                    filePath: f.path
                                  })
                                }
                              >
                                {f.name}
                              </FileLink>
                            </FileBubble>
                            </MessageBundle>
                          </FileTimelineRow>
                        );
                      })()
                    : null}

                  {item.type === 'comment'
                    ? (() => {
                        const variant = chatBubbleVariant(item.author, actingUsername, task);
                        const mine = variant === 'mine';
                        const displayName = authorDisplayName(item.author, usersMap);
                        const initials = authorInitials(displayName);
                        const roleTag = roleTagForVariant(variant);
                        const avBg = mine ? '#4f46e5' : avatarColorForUser(item.author);
                        return (
                          <ChatMessageRow $mine={mine}>
                            <MessageBundle $mine={mine}>
                            <AvatarCircle $bg={avBg} title={`${displayName} (${item.author})`}>
                              {initials}
                            </AvatarCircle>
                            <BubbleStack $mine={mine}>
                              <Bubble $mine={mine} $variant={variant}>
                                <BubbleAuthorBar>
                                  <BubbleAuthorName $mine={mine}>{displayName}</BubbleAuthorName>
                                  <BubbleAuthorUser $mine={mine}>({item.author})</BubbleAuthorUser>
                                  {mine ? (
                                    <BubbleRoleTag $bg="rgba(255,255,255,0.22)" $color="#fff">
                                      Εγώ
                                    </BubbleRoleTag>
                                  ) : null}
                                  {!mine && roleTag ? (
                                    <BubbleRoleTag $bg={roleTag.bg} $color={roleTag.color}>
                                      {roleTag.label}
                                    </BubbleRoleTag>
                                  ) : null}
                                  <BubbleTime $mine={mine} dateTime={item.at}>
                                    {new Date(item.at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}
                                  </BubbleTime>
                                </BubbleAuthorBar>
                                <BubbleText>{item.text}</BubbleText>
                              </Bubble>
                            </BubbleStack>
                            </MessageBundle>
                          </ChatMessageRow>
                        );
                      })()
                    : null}

                  {item.type === 'system' ? (
                    <SystemEventWrap>
                      <SystemEventCard>
                        <strong>{authorDisplayName(item.author, usersMap)}</strong> — {item.text}
                        <time dateTime={item.at}>
                          {new Date(item.at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}
                        </time>
                      </SystemEventCard>
                    </SystemEventWrap>
                  ) : null}
                </React.Fragment>
              ))}
              </TimelineInner>
            </TimelineScroll>
          </TimelineShell>
          <Composer>
            <ComposerInner>
            {isArchivedReadOnly ? <ArchiveComposerNotice>{archiveReadonlyMessage}</ArchiveComposerNotice> : null}
            <ComposerRow>
              <IconBtn
                type="button"
                onClick={addFiles}
                disabled={busy || (!chatAllowed && !isArchivedReadOnly)}
                title={
                  isArchivedReadOnly
                    ? 'Η αποθήκη είναι μόνο για προβολή'
                    : 'Προσθήκη συνημμένου αρχείου'
                }
              >
                📎
              </IconBtn>
              <ComposerInput
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={handleComposerKey}
                onFocus={handleComposerFocus}
                readOnly={isArchivedReadOnly}
                placeholder={
                  isArchivedReadOnly
                    ? 'Μόνο προβολή — αλλάξτε κατάσταση για νέα σχόλια'
                    : 'Σχόλιο ή συνημμένο — Ctrl+Enter για αποστολή'
                }
                disabled={busy || (!chatAllowed && !isArchivedReadOnly)}
              />
              <SendBtn
                type="button"
                onClick={submitComment}
                disabled={busy || (!isArchivedReadOnly && (!comment.trim() || !chatAllowed))}
                title={isArchivedReadOnly ? 'Η αποθήκη είναι μόνο για προβολή' : undefined}
              >
                Αποστολή
              </SendBtn>
            </ComposerRow>
            </ComposerInner>
          </Composer>
        </ChatColumn>
      </MainGrid>
      <HistoryDrawerBackdrop
        type="button"
        aria-label="Κλείσιμο ιστορικού"
        $open={historyOpen}
        onClick={() => setHistoryOpen(false)}
      />
      <HistoryDrawer $open={historyOpen} aria-hidden={!historyOpen}>
        <SideBlock>
          <SideTitle>Ιστορικό κατάστασης</SideTitle>
          <SideList>
            {(task.statusHistory || [])
              .slice()
              .reverse()
              .map((h, i) => (
                <SideListItem key={`${h.at}-${i}`}>
                  <strong>{TASK_STATUS_LABELS[h.status] || h.status}</strong>
                  <br />
                  {usersMap[h.by]?.fullName || h.by} · {new Date(h.at).toLocaleString('el-GR')}
                  {h.note ? (
                    <>
                      <br />
                      <em>{h.note}</em>
                    </>
                  ) : null}
                </SideListItem>
              ))}
          </SideList>
        </SideBlock>
      </HistoryDrawer>
    </MainStage>
    </Root>
  );
}

export default TaskAssignmentWorkspace;
