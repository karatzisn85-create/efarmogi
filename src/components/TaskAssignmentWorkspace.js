import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import EmojiPicker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
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

const EmailToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.72rem;
  min-height: 34px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  border: 1.5px solid ${p => p.$active ? '#059669' : '#cbd5e1'};
  background: ${p => p.$active ? '#ecfdf5' : '#f8fafc'};
  color: ${p => p.$active ? '#065f46' : '#64748b'};
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  &:hover:not(:disabled) {
    border-color: ${p => p.$active ? '#047857' : '#94a3b8'};
    background: ${p => p.$active ? '#d1fae5' : '#f1f5f9'};
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
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

const CompactAttachmentBubble = styled.div`
  flex: 1;
  min-width: 0;
  max-width: min(520px, 100%);
  box-sizing: border-box;
  padding: 0.5rem 0.7rem;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const CompactAttachmentLabel = styled.div`
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #64748b;
  margin-bottom: 0.3rem;
`;

const CompactFileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
`;

const CompactFileChip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.18rem 0.3rem;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid #e2e8f0;
`;

const CompactFileChipName = styled.button`
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  color: #3730a3;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font-family: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover {
    color: #4f46e5;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  &:focus-visible {
    outline: 2px solid rgba(99, 102, 241, 0.45);
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const MiniDownloadBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #86efac;
  background: #f0fdf4;
  color: #166534;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  &:hover {
    background: #dcfce7;
    border-color: #4ade80;
  }
  &:focus-visible {
    outline: 2px solid #22c55e;
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
`;

const MiniDeleteBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  &:hover {
    background: #fee2e2;
    border-color: #f87171;
  }
  &:focus-visible {
    outline: 2px solid #ef4444;
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const FolderAttachmentRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
`;

const FolderAttachmentBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 9px;
  border: 1px dashed #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  }
  &:focus-visible {
    outline: 3px solid rgba(59, 130, 246, 0.4);
    outline-offset: 2px;
  }
`;

const FolderIconWrap = styled.span`
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
`;

const FolderAttachmentMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const FolderAttachmentTitle = styled.div`
  font-weight: 700;
  font-size: 0.86rem;
  color: #1e3a8a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FolderAttachmentSub = styled.div`
  margin-top: 0.12rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #475569;
`;

const FolderFilesModalList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const FolderFilesModalItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const FolderFilesModalName = styled.button`
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  color: #3730a3;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font-family: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
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
    if (p.$variant === 'assigner') return '#fffdf7';
    if (p.$variant === 'assignee') return '#f8fafc';
    return '#f8fafc';
  }};
  color: ${(p) => (p.$variant === 'mine' ? '#fff' : '#1e293b')};
  border: 1px solid
    ${(p) => {
      if (p.$variant === 'mine') return 'rgba(255,255,255,0.12)';
      if (p.$variant === 'assigner') return '#fde68a';
      if (p.$variant === 'assignee') return '#e2e8f0';
      return '#e2e8f0';
    }};
  border-radius: ${(p) => (p.$mine ? '14px 14px 5px 14px' : '14px 14px 14px 5px')};
  padding: 0.55rem 0.8rem 0.6rem;
  box-shadow: ${(p) =>
    p.$variant === 'mine'
      ? '0 3px 14px rgba(79, 70, 229, 0.22)'
      : '0 1px 4px rgba(15, 23, 42, 0.05)'};
`;

const BubbleAuthorBar = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.28rem;
  margin-bottom: ${(p) => (p.$compact ? '0.28rem' : '0.4rem')};
  max-width: 100%;
`;

const BubbleAuthorMain = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
`;

const BubbleAuthorName = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: ${(p) => (p.$mine ? 'rgba(255,255,255,0.92)' : '#64748b')};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetaMoreBtn = styled.button`
  flex-shrink: 0;
  margin-left: auto;
  border: none;
  background: ${(p) => (p.$mine ? 'rgba(255,255,255,0.16)' : '#f1f5f9')};
  color: ${(p) => (p.$mine ? 'rgba(255,255,255,0.95)' : '#64748b')};
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  line-height: 1.3;
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: ${(p) => (p.$mine ? 'rgba(255,255,255,0.26)' : '#e2e8f0')};
    color: ${(p) => (p.$mine ? '#fff' : '#334155')};
  }
`;

const BubbleMetaDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.45rem;
  padding: 0.28rem 0.4rem;
  border-radius: 8px;
  background: ${(p) => (p.$mine ? 'rgba(255,255,255,0.12)' : '#f8fafc')};
  border: 1px solid ${(p) => (p.$mine ? 'rgba(255,255,255,0.16)' : '#eef2f7')};
`;

const BubbleAuthorUser = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: ${(p) => (p.$mine ? 'rgba(224,231,255,0.95)' : '#64748b')};
`;

const BubbleRoleTag = styled.span`
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
`;

const BubbleTime = styled.time`
  font-size: 0.72rem;
  font-weight: 600;
  color: ${(p) => (p.$mine ? 'rgba(224,231,255,0.9)' : '#94a3b8')};
`;

const BubbleText = styled.div`
  font-size: 0.96rem;
  white-space: pre-wrap;
  line-height: 1.55;
  word-break: break-word;
`;

const FileActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
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

const FileDownloadBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #86efac;
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  color: #166534;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  &:hover {
    background: #bbf7d0;
    border-color: #4ade80;
  }
  &:focus-visible {
    outline: 2px solid #22c55e;
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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

const EmojiPickerWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: flex-end;
`;

const EmojiPickerPopup = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 9999;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  border-radius: 12px;
  overflow: hidden;
`;

const AttachMenuPopup = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 9999;
  min-width: 220px;
  padding: 0.35rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
`;

const AttachMenuItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.7rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #1e293b;
  font-size: 0.86rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover {
    background: #eef2ff;
    color: #3730a3;
  }
  &:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 1px;
  }
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

const DepartModalBackdrop = styled.div`
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

const DepartModalCard = styled.div`
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

const DepartModalHero = styled.div`
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

const DepartModalEyebrow = styled.div`
  position: relative;
  z-index: 1;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 0.35rem;
`;

const DepartModalTitle = styled.h3`
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
`;

const DepartModalTaskName = styled.p`
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

const DepartModalBody = styled.div`
  padding: 1.25rem 1.45rem 0.5rem;
`;

const DepartModalHint = styled.p`
  margin: 0 0 0.85rem;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #64748b;
`;

const DepartModalLabel = styled.label`
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.38rem;
`;

const DepartModalTextarea = styled.textarea`
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

const DepartModalFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: flex-end;
  padding: 1rem 1.45rem 1.35rem;
`;

const DepartModalCancelBtn = styled.button`
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

const DepartModalConfirmBtn = styled.button`
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

const DeleteConfirmBackdrop = styled(DepartModalBackdrop)`
  z-index: 210;
`;

const DeleteModalHero = styled(DepartModalHero)`
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 46%, #b91c1c 100%);
`;

const DeleteModalIcon = styled.div`
  position: relative;
  z-index: 1;
  width: 46px;
  height: 46px;
  margin-bottom: 0.6rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.45rem;
  line-height: 1;
  background: rgba(255, 255, 255, 0.22);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
`;

const DeleteModalFileName = styled.p`
  position: relative;
  z-index: 1;
  margin: 0.5rem 0 0;
  padding: 0.45rem 0.65rem;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
`;


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
  if (variant === 'mine') return { label: 'Εγώ', bg: 'rgba(255,255,255,0.22)', color: '#fff', bgLight: '#e0e7ff', colorLight: '#3730a3' };
  if (variant === 'assigner') return { label: 'Δημιουργός', bg: '#fef3c7', color: '#92400e', bgLight: '#fef3c7', colorLight: '#92400e' };
  if (variant === 'assignee') return { label: 'Συνάδελφος', bg: '#dbeafe', color: '#1e40af', bgLight: '#dbeafe', colorLight: '#1e40af' };
  return { label: 'Συμμετέχων', bg: '#f1f5f9', color: '#475569', bgLight: '#f1f5f9', colorLight: '#475569' };
}

function formatChatTimestamp(at) {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Ελαφρύ header μηνύματος: όνομα + κουμπί για λεπτομέρειες (χρήστης, ρόλος, ώρα). */
function ChatBubbleMeta({
  displayName,
  username,
  at,
  mine,
  roleTag,
  hideName = false,
  /** Ανοιχτό φόντο (π.χ. αρχεία) — πάντα σκούρα κείμενα */
  lightSurface = false
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const inverted = mine && !lightSurface;
  const roleBg = inverted
    ? (roleTag?.bg || 'rgba(255,255,255,0.22)')
    : (roleTag?.bgLight || roleTag?.bg || '#e0e7ff');
  const roleColor = inverted
    ? (roleTag?.color || '#fff')
    : (roleTag?.colorLight || roleTag?.color || '#3730a3');

  return (
    <BubbleAuthorBar $compact={!detailsOpen}>
      <BubbleAuthorMain>
        {!hideName ? (
          <BubbleAuthorName $mine={inverted} title={displayName}>
            {mine ? 'Εσείς' : displayName}
          </BubbleAuthorName>
        ) : (
          <span aria-hidden style={{ flex: 1 }} />
        )}
        <MetaMoreBtn
          type="button"
          $mine={inverted}
          aria-expanded={detailsOpen}
          title={detailsOpen ? 'Απόκρυψη λεπτομερειών' : 'Περισσότερες πληροφορίες'}
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen((v) => !v);
          }}
        >
          {detailsOpen ? 'Λιγότερα' : 'Περισσότερα'}
        </MetaMoreBtn>
      </BubbleAuthorMain>
      {detailsOpen ? (
        <BubbleMetaDetails $mine={inverted}>
          {username ? <BubbleAuthorUser $mine={inverted}>@{username}</BubbleAuthorUser> : null}
          {roleTag ? (
            <BubbleRoleTag $bg={roleBg} $color={roleColor}>
              {roleTag.label}
            </BubbleRoleTag>
          ) : null}
          <BubbleTime $mine={inverted} dateTime={at}>
            {formatChatTimestamp(at)}
          </BubbleTime>
        </BubbleMetaDetails>
      ) : null}
    </BubbleAuthorBar>
  );
}

/** Χρονολογική ροή: έναρξη χώρου → αρχεία & σχόλια. */
function buildUnifiedTimeline(task) {
  const TYPE_ORDER = { origin: 0, folder: 1, files: 1, file: 1, comment: 2, system: 3 };
  const items = [];

  const originAt = task.createdAt || task.statusHistory?.[0]?.at || new Date(0).toISOString();
  items.push({
    id: 'timeline-origin',
    type: 'origin',
    at: originAt,
    author: task.createdBy,
    description: String(task.description || '').trim()
  });

  const batchesById = new Map((task.fileBatches || []).map((b) => [b.id, b]));
  const filesInBatch = new Map();
  const orphanFiles = [];

  (task.files || []).forEach((f) => {
    if (f.batchId && batchesById.has(f.batchId)) {
      if (!filesInBatch.has(f.batchId)) filesInBatch.set(f.batchId, []);
      filesInBatch.get(f.batchId).push(f);
    } else {
      orphanFiles.push(f);
    }
  });

  (task.fileBatches || []).forEach((b) => {
    const files = filesInBatch.get(b.id) || [];
    if (!files.length) return;
    items.push({
      id: `timeline-batch-${b.id}`,
      type: b.kind === 'folder' ? 'folder' : 'files',
      at: b.uploadedAt || originAt,
      author: b.uploadedBy,
      batch: b,
      files
    });
  });

  orphanFiles.forEach((f) => {
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

function AttachmentTimelineEntry({
  item,
  task,
  actingUsername,
  usersMap,
  canDeleteAttachments,
  onOpenFile,
  onDownloadFile,
  onDownloadFolder,
  onOpenFolder,
  onDeleteFile,
  onDeleteBatch,
  downloadingFolderId
}) {
  const variant = chatBubbleVariant(item.author, actingUsername, task);
  const mine = variant === 'mine';
  const displayName = authorDisplayName(item.author, usersMap);
  const initials = authorInitials(displayName);
  const roleTag = roleTagForVariant(variant);
  const avBg = mine ? '#4f46e5' : avatarColorForUser(item.author);
  const canDeleteBatch =
    canDeleteAttachments &&
    item.author &&
    String(item.author).toLowerCase() === String(actingUsername || '').toLowerCase();

  const renderFileChip = (f) => {
    const canDeleteFile =
      canDeleteAttachments &&
      String(f.uploadedBy || item.author || '').toLowerCase() === String(actingUsername || '').toLowerCase();
    return (
      <CompactFileChip key={f.id}>
        <CompactFileChipName type="button" onClick={() => onOpenFile(f)} title={f.name}>
          {f.name}
        </CompactFileChipName>
        <MiniDownloadBtn
          type="button"
          onClick={() => onDownloadFile(f)}
          title="Αποθήκευση αρχείου στον υπολογιστή σας"
          aria-label={`Λήψη ${f.name}`}
        >
          ⬇
        </MiniDownloadBtn>
        {canDeleteFile ? (
          <MiniDeleteBtn
            type="button"
            onClick={() => onDeleteFile(f)}
            title="Διαγραφή αρχείου"
            aria-label={`Διαγραφή ${f.name}`}
          >
            ✕
          </MiniDeleteBtn>
        ) : null}
      </CompactFileChip>
    );
  };

  let body = null;
  if (item.type === 'folder') {
    const folderLabel = item.batch?.label || 'Φάκελος';
    const count = item.files?.length || 0;
    body = (
      <>
        <CompactAttachmentLabel>Φάκελος</CompactAttachmentLabel>
        <FolderAttachmentRow>
          <FolderAttachmentBtn
            type="button"
            onClick={() =>
              onOpenFolder({
                label: folderLabel,
                files: item.files || [],
                batchId: item.batch?.id,
                canDelete: canDeleteBatch,
                batchItem: item
              })}
            title="Προβολή περιεχομένων φακέλου"
          >
            <FolderIconWrap aria-hidden>📁</FolderIconWrap>
            <FolderAttachmentMeta>
              <FolderAttachmentTitle>{folderLabel}</FolderAttachmentTitle>
              <FolderAttachmentSub>
                {count} {count === 1 ? 'αρχείο' : 'αρχεία'} · κλικ για προβολή
              </FolderAttachmentSub>
            </FolderAttachmentMeta>
          </FolderAttachmentBtn>
          <MiniDownloadBtn
            type="button"
            disabled={downloadingFolderId === item.batch?.id}
            onClick={() => onDownloadFolder(item.batch?.id)}
            title="Λήψη ολόκληρου φακέλου στον υπολογιστή σας"
            aria-label={`Λήψη φακέλου ${folderLabel}`}
          >
            {downloadingFolderId === item.batch?.id ? '…' : '⬇'}
          </MiniDownloadBtn>
          {canDeleteBatch ? (
            <MiniDeleteBtn
              type="button"
              onClick={() => onDeleteBatch(item)}
              title="Διαγραφή φακέλου και όλων των αρχείων"
              aria-label={`Διαγραφή φακέλου ${folderLabel}`}
            >
              ✕
            </MiniDeleteBtn>
          ) : null}
        </FolderAttachmentRow>
      </>
    );
  } else if (item.type === 'files') {
    const count = item.files?.length || 0;
    body = (
      <>
        <CompactAttachmentLabel>
          {count === 1 ? 'Αρχείο' : `${count} αρχεία`}
          {canDeleteBatch && count > 1 ? (
            <span style={{ marginLeft: '0.45rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
              ·{' '}
              <button
                type="button"
                onClick={() => onDeleteBatch(item)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#b91c1c',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 700,
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px'
                }}
              >
                διαγραφή όλων
              </button>
            </span>
          ) : null}
        </CompactAttachmentLabel>
        <CompactFileList>{(item.files || []).map(renderFileChip)}</CompactFileList>
      </>
    );
  } else if (item.type === 'file' && item.file) {
    body = (
      <>
        <CompactAttachmentLabel>Αρχείο</CompactAttachmentLabel>
        <CompactFileList>{renderFileChip(item.file)}</CompactFileList>
      </>
    );
  }

  if (!body) return null;

  return (
    <FileTimelineRow $mine={mine}>
      <MessageBundle $mine={mine}>
        <AvatarCircle $bg={avBg} title={`${displayName} (${item.author})`}>
          {initials}
        </AvatarCircle>
        <CompactAttachmentBubble>
          <ChatBubbleMeta
            displayName={displayName}
            username={item.author}
            at={item.at}
            mine={mine}
            roleTag={roleTag}
            lightSurface
          />
          {body}
        </CompactAttachmentBubble>
      </MessageBundle>
    </FileTimelineRow>
  );
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
  const [emailNotifBusy, setEmailNotifBusy] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [folderFilesModal, setFolderFilesModal] = useState(null);
  const [downloadingFolderId, setDownloadingFolderId] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const feedRef = useRef(null);
  const prevDepartModalRef = useRef(false);
  const prevWithdrawModalRef = useRef(false);
  const prevLeaveArchiveModalRef = useRef(false);
  const composerInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);

  // Κλείσιμο emoji / attach menu με κλικ εκτός
  useEffect(() => {
    if (!emojiPickerOpen && !attachMenuOpen) return;
    const handleClickOutside = (e) => {
      if (emojiPickerOpen && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setEmojiPickerOpen(false);
      }
      if (attachMenuOpen && attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emojiPickerOpen, attachMenuOpen]);

  // Εισαγωγή emoji στη θέση του cursor
  const handleEmojiSelect = useCallback((emoji) => {
    const native = emoji.native;
    const el = composerInputRef.current;
    if (!el) {
      setComment((prev) => prev + native);
      setEmojiPickerOpen(false);
      return;
    }
    const start = el.selectionStart ?? comment.length;
    const end = el.selectionEnd ?? comment.length;
    const newValue = comment.slice(0, start) + native + comment.slice(end);
    setComment(newValue);
    setEmojiPickerOpen(false);
    // Επαναφορά focus και cursor μετά την εισαγωγή
    requestAnimationFrame(() => {
      el.focus();
      const newCursor = start + native.length;
      el.setSelectionRange(newCursor, newCursor);
    });
  }, [comment]);

  const handleToggleEmailNotifications = useCallback(async () => {
    if (emailNotifBusy) return;
    setEmailNotifBusy(true);
    try {
      const newVal = !task.emailNotifications;
      const result = await ipcRenderer.invoke('toggle-workspace-email-notifications', {
        actingUsername,
        taskId: task.id,
        enabled: newVal
      });
      if (result.success && onUpdated) onUpdated(result.task);
    } catch (e) {
      console.error('[workspace] toggle email notifications error:', e);
    } finally {
      setEmailNotifBusy(false);
    }
  }, [task, actingUsername, emailNotifBusy, onUpdated]);

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
  const chatAllowed = workflowOpen && !isArchivedReadOnly;
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
  const sc = TASK_STATUS_COLORS[task.status] || {};

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
    if (!departModalOpen && !withdrawModalOpen && !deleteConfirmModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        setDepartModalOpen(false);
        setWithdrawModalOpen(false);
        setDeleteConfirmModal(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [departModalOpen, withdrawModalOpen, deleteConfirmModal, busy]);

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

  const handleOpenTaskFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    try {
      const res = await ipcRenderer.invoke('open-task-assignment-file', {
        actingUsername,
        taskId: task.id,
        filePath: file.path,
        fileId: file.id,
        fileName: file.name
      });
      if (!res?.success) {
        setError(res?.error || 'Δεν ήταν δυνατό το άνοιγμα του αρχείου');
      }
    } catch (err) {
      setError(err.message || 'Δεν ήταν δυνατό το άνοιγμα του αρχείου');
    }
  }, [actingUsername, task.id]);

  const handleDownloadTaskFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    try {
      const res = await ipcRenderer.invoke('download-task-assignment-file', {
        actingUsername,
        taskId: task.id,
        filePath: file.path,
        fileId: file.id,
        fileName: file.name
      });
      if (res?.canceled) return;
      if (!res?.success) {
        setError(res?.error || 'Δεν ήταν δυνατή η λήψη του αρχείου');
      }
    } catch (err) {
      setError(err.message || 'Δεν ήταν δυνατή η λήψη του αρχείου');
    }
  }, [actingUsername, task.id]);

  const handleDownloadTaskFolder = useCallback(async (batchId) => {
    if (!batchId) return;
    setError('');
    setDownloadingFolderId(batchId);
    try {
      const res = await ipcRenderer.invoke('download-task-assignment-folder', {
        actingUsername,
        taskId: task.id,
        batchId
      });
      if (res?.canceled) return;
      if (!res?.success) {
        setError(res?.error || 'Δεν ήταν δυνατή η λήψη του φακέλου');
        return;
      }
      if (res.missing?.length) {
        setError(`Ο φάκελος αντιγράφηκε με ${res.copied} αρχεία. Δεν βρέθηκαν: ${res.missing.join(', ')}`);
      }
    } catch (err) {
      setError(err.message || 'Δεν ήταν δυνατή η λήψη του φακέλου');
    } finally {
      setDownloadingFolderId(null);
    }
  }, [actingUsername, task.id]);

  const runDeleteAttachment = useCallback(async ({ fileId = null, batchId = null }) => {
    setBusy(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('delete-task-assignment-attachment', {
        actingUsername,
        taskId: task.id,
        fileId,
        batchId
      });
      if (res?.success) {
        onUpdated(res.task);
        setFolderFilesModal((prev) => {
          if (!prev) return prev;
          if (batchId && prev.batchId === batchId) return null;
          if (fileId) {
            const nextFiles = (prev.files || []).filter((f) => f.id !== fileId);
            if (!nextFiles.length) return null;
            return { ...prev, files: nextFiles };
          }
          return prev;
        });
        return true;
      }
      setError(res?.error || 'Δεν ήταν δυνατή η διαγραφή');
      return false;
    } catch (err) {
      setError(err.message || 'Δεν ήταν δυνατή η διαγραφή');
      return false;
    } finally {
      setBusy(false);
    }
  }, [actingUsername, task.id, onUpdated]);

  const handleDeleteTaskFile = useCallback((file) => {
    if (!file?.id || !chatAllowed) {
      if (!chatAllowed) notifyArchiveReadonly();
      return;
    }
    setDeleteConfirmModal({ mode: 'file', file });
  }, [chatAllowed, notifyArchiveReadonly]);

  const handleDeleteTaskBatch = useCallback((item) => {
    if (!item?.batch?.id || !chatAllowed) {
      if (!chatAllowed) notifyArchiveReadonly();
      return;
    }
    setDeleteConfirmModal({
      mode: item.type === 'folder' ? 'folder' : 'batch',
      item
    });
  }, [chatAllowed, notifyArchiveReadonly]);

  const confirmDeleteAttachment = async () => {
    if (!deleteConfirmModal || busy) return;
    const { mode, file, item } = deleteConfirmModal;
    let ok = false;
    if (mode === 'file' && file?.id) {
      ok = await runDeleteAttachment({ fileId: file.id });
    } else if (item?.batch?.id) {
      ok = await runDeleteAttachment({ batchId: item.batch.id });
    }
    if (ok) setDeleteConfirmModal(null);
  };

  const deleteConfirmCopy = useMemo(() => {
    if (!deleteConfirmModal) return null;
    if (deleteConfirmModal.mode === 'file') {
      const name = deleteConfirmModal.file?.name || 'αρχείο';
      return {
        icon: '📄',
        eyebrow: 'Διαγραφή αρχείου',
        title: 'Διαγραφή συνημμένου;',
        highlight: `«${name}»`,
        hint: 'Το αρχείο θα αφαιρεθεί οριστικά από τον χώρο εργασίας. Η ενέργεια δεν αναιρείται.'
      };
    }
    const batchItem = deleteConfirmModal.item;
    const isFolder = deleteConfirmModal.mode === 'folder';
    const label = batchItem?.batch?.label || (isFolder ? 'Φάκελος' : 'Ομάδα αρχείων');
    const count = batchItem?.files?.length || 0;
    const fileWord = count === 1 ? 'αρχείο' : 'αρχεία';
    if (isFolder) {
      return {
        icon: '📁',
        eyebrow: 'Διαγραφή φακέλου',
        title: 'Διαγραφή φακέλου;',
        highlight: `«${label}» · ${count} ${fileWord}`,
        hint: `Όλα τα αρχεία του φακέλου (${count} ${fileWord}) θα διαγραφούν από τον χώρο εργασίας. Η ενέργεια δεν αναιρείται.`
      };
    }
    return {
      icon: '📎',
      eyebrow: 'Διαγραφή αρχείων',
      title: 'Διαγραφή ομάδας αρχείων;',
      highlight: `${count} ${fileWord}`,
      hint: `Όλα τα αρχεία της ομάδας (${count} ${fileWord}) θα αφαιρεθούν από τον χώρο εργασίας. Η ενέργεια δεν αναιρείται.`
    };
  }, [deleteConfirmModal]);

  const runStatus = async (status, reason, withdrawFromAssignees = false) => {
    setBusy(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('update-task-assignment-status', {
        actingUsername,
        taskId: task.id,
        status,
        reason,
        withdrawFromAssignees: status === 'cancelled' ? !!withdrawFromAssignees : undefined
      });
      scheduleDocumentInteractionRecovery({ lockScroll: true });
      if (res?.success) {
        onUpdated(res.task);
        setWithdrawModalOpen(false);
      } else {
        setError(res?.error || 'Σφάλμα');
      }
    } catch (err) {
      setError(err.message || 'Σφάλμα');
    } finally {
      setBusy(false);
    }
  };

  const runDepart = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('leave-task-assignment-workspace', {
        actingUsername,
        taskId: task.id,
        note: departNote
      });
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
    } catch (err) {
      setError(err.message || 'Σφάλμα');
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (isArchivedReadOnly) {
      notifyArchiveReadonly();
      return;
    }
    if (!comment.trim() || busy) return;
    setBusy(true);
    try {
      const res = await ipcRenderer.invoke('add-task-assignment-comment', {
        actingUsername,
        taskId: task.id,
        text: comment.trim()
      });
      if (res?.success) {
        setComment('');
        onUpdated(res.task);
      } else {
        setError(res?.error || 'Σφάλμα');
      }
    } catch (err) {
      setError(err.message || 'Σφάλμα');
    } finally {
      setBusy(false);
    }
  };

  const uploadPickedFiles = async (picked, uploadBatch = null) => {
    scheduleDocumentInteractionRecovery({ lockScroll: true });
    if (!picked?.success || picked.canceled || !Array.isArray(picked.files) || !picked.files.length) {
      if (picked?.error) setError(picked.error);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('add-task-assignment-files', {
        actingUsername,
        taskId: task.id,
        newFiles: picked.files,
        batch: uploadBatch
      });
      if (res?.success) {
        onUpdated(res.task);
        if (res?.warning) setError(res.warning);
      } else {
        setError(res?.error || 'Σφάλμα');
      }
    } catch (err) {
      setError(err.message || 'Σφάλμα');
    } finally {
      setBusy(false);
    }
  };

  const pickFilesForUpload = async () => {
    setAttachMenuOpen(false);
    if (isArchivedReadOnly) {
      notifyArchiveReadonly();
      return;
    }
    const picked = await ipcRenderer.invoke('select-multiple-files', {
      title: 'Επιλογή αρχείων',
      allFileTypes: true
    });
    await uploadPickedFiles(picked, { kind: 'files' });
  };

  const pickFolderForUpload = async () => {
    setAttachMenuOpen(false);
    if (isArchivedReadOnly) {
      notifyArchiveReadonly();
      return;
    }
    const picked = await ipcRenderer.invoke('select-folder-files-flat', {
      title: 'Επιλογή φακέλου (όλα τα αρχεία μέσα)'
    });
    await uploadPickedFiles(picked, {
      kind: 'folder',
      label: picked?.folderName || 'Φάκελος'
    });
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
          {isAssigner && (
            <EmailToggleBtn
              type="button"
              $active={!!task.emailNotifications}
              disabled={emailNotifBusy}
              title={task.emailNotifications ? 'Ειδοποιήσεις email ενεργές — κλικ για απενεργοποίηση' : 'Ειδοποιήσεις email ανενεργές — κλικ για ενεργοποίηση'}
              onClick={handleToggleEmailNotifications}
            >
              {task.emailNotifications ? '✉ Email ON' : '✉ Email OFF'}
            </EmailToggleBtn>
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
        <DepartModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setDepartModalOpen(false);
          }}
        >
          <DepartModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="depart-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <DepartModalHero>
              <DepartModalEyebrow>Επιβεβαίωση</DepartModalEyebrow>
              <DepartModalTitle id="depart-modal-title">Αποχώρηση από τον χώρο;</DepartModalTitle>
              <DepartModalTaskName>«{task.title}»</DepartModalTaskName>
            </DepartModalHero>
            <DepartModalBody>
              <DepartModalHint>
                Θα αποχωρήσετε από αυτόν τον χώρο — οι υπόλοιποι συνάδελφοι και ο δημιουργός συνεχίζουν κανονικά.
                Ο δημιουργός μπορεί να σας ξαναπροσθέσει αργότερα μέσω επεξεργασίας. Προαιρετικά σημειώστε λόγο
                αποχώρησης.
              </DepartModalHint>
              <DepartModalLabel htmlFor="depart-note-input">Σημείωση (προαιρετική)</DepartModalLabel>
              <DepartModalTextarea
                id="depart-note-input"
                value={departNote}
                onChange={(e) => setDepartNote(e.target.value)}
                placeholder="Π.χ. δεν μπορώ πλέον να συμμετέχω σε αυτή την εργασία…"
                disabled={busy}
              />
            </DepartModalBody>
            <DepartModalFooter>
              <DepartModalCancelBtn type="button" disabled={busy} onClick={() => setDepartModalOpen(false)}>
                Πίσω
              </DepartModalCancelBtn>
              <DepartModalConfirmBtn type="button" disabled={busy} onClick={runDepart}>
                {busy ? 'Γίνεται αποχώρηση…' : 'Ναι, αποχώρηση'}
              </DepartModalConfirmBtn>
            </DepartModalFooter>
          </DepartModalCard>
        </DepartModalBackdrop>
      )}

      {withdrawModalOpen && workflowOpen && isAssigner && canEditAsAssigner && task.status !== 'completed' && (
        <DepartModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setWithdrawModalOpen(false);
          }}
        >
          <DepartModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <DepartModalHero>
              <DepartModalEyebrow>Επιβεβαίωση</DepartModalEyebrow>
              <DepartModalTitle id="withdraw-modal-title">Κλείσιμο χώρου για συναδέλφους;</DepartModalTitle>
              <DepartModalTaskName>«{task.title}»</DepartModalTaskName>
            </DepartModalHero>
            <DepartModalBody>
              <DepartModalHint>
                Με την επιβεβαίωση, ο χώρος <strong>κλείνει για τους συναδέλφους</strong>: δεν θα εμφανίζεται πλέον στη
                λίστα και στην προβολή τους. Εσείς ως αναθέτης θα τον βλέπετε ακόμα στη δική σας λίστα, με σήμανση ότι
                χρειάζεται <strong>επεξεργασία</strong> (π.χ. διόρθωση) ή <strong>διαγραφή</strong> όταν ολοκληρώσετε τη
                διαχείρισή του.
              </DepartModalHint>
            </DepartModalBody>
            <DepartModalFooter>
              <DepartModalCancelBtn type="button" disabled={busy} onClick={() => setWithdrawModalOpen(false)}>
                Πίσω
              </DepartModalCancelBtn>
              <DepartModalConfirmBtn type="button" disabled={busy} onClick={() => runStatus('cancelled', '', true)}>
                {busy ? 'Γίνεται κλείσιμο…' : 'Ναι, κλείσιμο'}
              </DepartModalConfirmBtn>
            </DepartModalFooter>
          </DepartModalCard>
        </DepartModalBackdrop>
      )}

      {leaveArchiveModalOpen && showLeaveArchiveBtn && onLeaveArchive && (
        <DepartModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setLeaveArchiveModalOpen(false);
          }}
        >
          <DepartModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-archive-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <DepartModalHero>
              <DepartModalEyebrow>Επιβεβαίωση</DepartModalEyebrow>
              <DepartModalTitle id="leave-archive-modal-title">Αποχώρηση από αποθήκη;</DepartModalTitle>
              <DepartModalTaskName>«{task.title}»</DepartModalTaskName>
            </DepartModalHero>
            <DepartModalBody>
              <DepartModalHint>
                Ο χώρος <strong>παραμένει στην αποθήκη</strong> για τον αναθέτη και τους υπόλοιπους συναδέλφους. Εσείς
                δεν θα τον βλέπετε πλέον στη λίστα σας — μπορείτε να επιστρέψετε μόνο αν σας ξαναπροσκαλέσουν σε νέο χώρο.
              </DepartModalHint>
            </DepartModalBody>
            <DepartModalFooter>
              <DepartModalCancelBtn type="button" disabled={busy} onClick={() => setLeaveArchiveModalOpen(false)}>
                Πίσω
              </DepartModalCancelBtn>
              <DepartModalConfirmBtn
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onLeaveArchive(task);
                    setLeaveArchiveModalOpen(false);
                  } catch (err) {
                    setError(err.message || 'Σφάλμα');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Γίνεται αποχώρηση…' : 'Ναι, αποχώρηση'}
              </DepartModalConfirmBtn>
            </DepartModalFooter>
          </DepartModalCard>
        </DepartModalBackdrop>
      )}

      {deleteConfirmModal && deleteConfirmCopy ? (
        <DeleteConfirmBackdrop
          role="presentation"
          onClick={() => {
            if (!busy) setDeleteConfirmModal(null);
          }}
        >
          <DepartModalCard
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-attachment-modal-title"
            aria-describedby="delete-attachment-modal-hint"
            onClick={(e) => e.stopPropagation()}
          >
            <DeleteModalHero>
              <DeleteModalIcon aria-hidden>{deleteConfirmCopy.icon}</DeleteModalIcon>
              <DepartModalEyebrow>{deleteConfirmCopy.eyebrow}</DepartModalEyebrow>
              <DepartModalTitle id="delete-attachment-modal-title">
                {deleteConfirmCopy.title}
              </DepartModalTitle>
              <DeleteModalFileName>{deleteConfirmCopy.highlight}</DeleteModalFileName>
            </DeleteModalHero>
            <DepartModalBody>
              <DepartModalHint id="delete-attachment-modal-hint">
                {deleteConfirmCopy.hint}
              </DepartModalHint>
            </DepartModalBody>
            <DepartModalFooter>
              <DepartModalCancelBtn
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmModal(null)}
              >
                Πίσω
              </DepartModalCancelBtn>
              <DepartModalConfirmBtn type="button" disabled={busy} onClick={confirmDeleteAttachment}>
                {busy ? 'Γίνεται διαγραφή…' : 'Ναι, διαγραφή'}
              </DepartModalConfirmBtn>
            </DepartModalFooter>
          </DepartModalCard>
        </DeleteConfirmBackdrop>
      ) : null}

      {folderFilesModal ? (
        <DepartModalBackdrop
          role="presentation"
          onClick={() => {
            if (!busy && !deleteConfirmModal) setFolderFilesModal(null);
          }}
        >
          <DepartModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-files-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <DepartModalHero>
              <DepartModalEyebrow>Περιεχόμενα φακέλου</DepartModalEyebrow>
              <DepartModalTitle id="folder-files-modal-title">
                {folderFilesModal.label || 'Φάκελος'}
              </DepartModalTitle>
              <DepartModalTaskName>
                {(folderFilesModal.files || []).length}{' '}
                {(folderFilesModal.files || []).length === 1 ? 'αρχείο' : 'αρχεία'}
              </DepartModalTaskName>
            </DepartModalHero>
            <DepartModalBody>
              <FolderFilesModalList>
                {(folderFilesModal.files || []).map((f) => {
                  const canDeleteFile =
                    folderFilesModal.canDelete &&
                    String(f.uploadedBy || '').toLowerCase() === String(actingUsername || '').toLowerCase();
                  return (
                    <FolderFilesModalItem key={f.id}>
                      <FolderFilesModalName
                        type="button"
                        onClick={() => handleOpenTaskFile(f)}
                        title="Άνοιγμα με προεπιλεγμένο πρόγραμμα"
                      >
                        {f.name}
                      </FolderFilesModalName>
                      <FileDownloadBtn
                        type="button"
                        onClick={() => handleDownloadTaskFile(f)}
                        title="Αποθήκευση αρχείου στον υπολογιστή σας"
                      >
                        ⬇ Λήψη
                      </FileDownloadBtn>
                      {canDeleteFile ? (
                        <MiniDeleteBtn
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteTaskFile(f)}
                          title="Διαγραφή αρχείου"
                          aria-label={`Διαγραφή ${f.name}`}
                        >
                          ✕
                        </MiniDeleteBtn>
                      ) : null}
                    </FolderFilesModalItem>
                  );
                })}
              </FolderFilesModalList>
            </DepartModalBody>
            <DepartModalFooter>
              {folderFilesModal.canDelete && folderFilesModal.batchItem ? (
                <DepartModalConfirmBtn
                  type="button"
                  disabled={busy}
                  onClick={() => handleDeleteTaskBatch(folderFilesModal.batchItem)}
                  style={{ marginRight: 'auto' }}
                >
                  Διαγραφή φακέλου
                </DepartModalConfirmBtn>
              ) : null}
              <FileDownloadBtn
                type="button"
                disabled={busy || downloadingFolderId === folderFilesModal.batchId || !(folderFilesModal.files || []).length}
                onClick={() => handleDownloadTaskFolder(folderFilesModal.batchId)}
                title="Αποθήκευση όλων των αρχείων του φακέλου"
              >
                {downloadingFolderId === folderFilesModal.batchId ? '⏳ Λήψη…' : '⬇ Λήψη φακέλου'}
              </FileDownloadBtn>
              <DepartModalCancelBtn type="button" onClick={() => setFolderFilesModal(null)}>
                Κλείσιμο
              </DepartModalCancelBtn>
            </DepartModalFooter>
          </DepartModalCard>
        </DepartModalBackdrop>
      ) : null}

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
                        <OriginMeta title={formatChatTimestamp(item.at)}>
                          <strong>{authorDisplayName(item.author, usersMap)}</strong>
                        </OriginMeta>
                      </OriginHeadRow>
                      {(() => {
                        const showPriority = task.priority && task.priority !== 'normal';
                        if (!showPriority) return null;
                        return (
                          <OriginMeta style={{ marginBottom: item.description ? 10 : 0 }}>
                            {TASK_PRIORITY_LABELS[task.priority] || task.priority}
                          </OriginMeta>
                        );
                      })()}
                      {item.description ? (
                        <OriginDescription>{item.description}</OriginDescription>
                      ) : (
                        <OriginMuted>Δεν προστέθηκε κείμενο στην έναρξη του χώρου.</OriginMuted>
                      )}
                    </OriginCard>
                  ) : null}

                  {item.type === 'folder' || item.type === 'files' || item.type === 'file' ? (
                    <AttachmentTimelineEntry
                      item={item}
                      task={task}
                      actingUsername={actingUsername}
                      usersMap={usersMap}
                      canDeleteAttachments={chatAllowed}
                      onOpenFile={handleOpenTaskFile}
                      onDownloadFile={handleDownloadTaskFile}
                      onDownloadFolder={handleDownloadTaskFolder}
                      onOpenFolder={setFolderFilesModal}
                      onDeleteFile={handleDeleteTaskFile}
                      onDeleteBatch={handleDeleteTaskBatch}
                      downloadingFolderId={downloadingFolderId}
                    />
                  ) : null}

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
                                <ChatBubbleMeta
                                  displayName={displayName}
                                  username={item.author}
                                  at={item.at}
                                  mine={mine}
                                  roleTag={roleTag}
                                />
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
                      <SystemEventCard title={formatChatTimestamp(item.at)}>
                        <strong>{authorDisplayName(item.author, usersMap)}</strong> — {item.text}
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
              <EmojiPickerWrapper ref={attachMenuRef}>
                <IconBtn
                  type="button"
                  onClick={() => {
                    if (isArchivedReadOnly) {
                      notifyArchiveReadonly();
                      return;
                    }
                    setAttachMenuOpen((o) => !o);
                    setEmojiPickerOpen(false);
                  }}
                  disabled={busy || (!chatAllowed && !isArchivedReadOnly)}
                  title={
                    isArchivedReadOnly
                      ? 'Η αποθήκη είναι μόνο για προβολή'
                      : 'Προσθήκη αρχείων ή φακέλου'
                  }
                >
                  📎
                </IconBtn>
                {attachMenuOpen && chatAllowed && !isArchivedReadOnly && (
                  <AttachMenuPopup>
                    <AttachMenuItem type="button" onClick={pickFilesForUpload}>
                      📄 Αρχεία (ένα ή πολλά)
                    </AttachMenuItem>
                    <AttachMenuItem type="button" onClick={pickFolderForUpload}>
                      📁 Φάκελος (όλα τα αρχεία μέσα)
                    </AttachMenuItem>
                  </AttachMenuPopup>
                )}
              </EmojiPickerWrapper>
              <EmojiPickerWrapper ref={emojiPickerRef}>
                <IconBtn
                  type="button"
                  onClick={() => setEmojiPickerOpen((o) => !o)}
                  disabled={busy || (!chatAllowed && !isArchivedReadOnly)}
                  title="Εισαγωγή emoji"
                  style={{ fontSize: '1.15rem' }}
                >
                  😊
                </IconBtn>
                {emojiPickerOpen && (
                  <EmojiPickerPopup>
                    <EmojiPicker
                      data={emojiData}
                      onEmojiSelect={handleEmojiSelect}
                      locale="el"
                      theme="light"
                      previewPosition="none"
                      skinTonePosition="none"
                      searchPosition="sticky"
                      navPosition="top"
                      perLine={9}
                      set="native"
                      autoFocus
                    />
                  </EmojiPickerPopup>
                )}
              </EmojiPickerWrapper>
              <ComposerInput
                ref={composerInputRef}
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
