import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

/* ─── Styled Components ─── */

const WidgetContainer = styled.div`
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
`;

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const WidgetTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const WidgetBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 800;
  background: ${(p) => p.$bg || '#e0e7ff'};
  color: ${(p) => p.$color || '#4338ca'};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 16px 10px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
`;

const TaskRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: ${(p) => (p.$highlight ? '#fef3c7' : '#f8fafc')};
  border: 1px solid ${(p) => (p.$highlight ? '#fde68a' : '#f1f5f9')};
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  &:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
  }
`;

const TaskIcon = styled.span`
  font-size: 15px;
  flex-shrink: 0;
`;

const TaskTitle = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TaskMeta = styled.span`
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
`;

const StatusDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$color || '#94a3b8'};
  flex-shrink: 0;
`;

const MoreLink = styled.button`
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 8px;
  padding: 7px;
  border: none;
  border-radius: 8px;
  background: #f1f5f9;
  color: #6366f1;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #e0e7ff; }
`;


/* ─── Status color mapping ─── */
const STATUS_COLORS = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  cancelled: '#94a3b8',
};

/* ─── Engineer Widget ─── */

function EngineerWidget({ currentUser, onOpenTaskAssignments }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const res = await ipcRenderer.invoke('get-task-assignments-summary', {
        actingUsername: currentUser?.username,
      });
      if (res?.success) setTasks(res.tasks || []);
    } catch {}
    setLoading(false);
  }, [currentUser?.username]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').slice(0, 5),
    [tasks]
  );

  const totalActive = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
    [tasks]
  );

  if (loading) return null;

  return (
    <WidgetContainer>
      <WidgetHeader>
        <WidgetTitle>
          📋 Οι εργασίες μου
          {totalActive > 0 && (
            <WidgetBadge $bg="#dbeafe" $color="#1d4ed8">{totalActive}</WidgetBadge>
          )}
        </WidgetTitle>
      </WidgetHeader>

      {activeTasks.length === 0 ? (
        <EmptyState>
          Δεν έχετε ανοιχτές εργασίες αυτή τη στιγμή. Εξαιρετικά!
        </EmptyState>
      ) : (
        <>
          {activeTasks.map((t) => (
            <TaskRow
              key={t.id}
              $highlight={t.status === 'pending'}
              onClick={() => onOpenTaskAssignments?.(t.id)}
            >
              <StatusDot $color={STATUS_COLORS[t.status]} />
              <TaskTitle title={t.title}>{t.title}</TaskTitle>
              <TaskMeta>
                {t.status === 'pending' ? 'Νέα' : 'Σε εξέλιξη'}
              </TaskMeta>
            </TaskRow>
          ))}
          {totalActive > 5 && (
            <MoreLink onClick={() => onOpenTaskAssignments?.()}>
              Δείτε όλες ({totalActive})
            </MoreLink>
          )}
        </>
      )}
    </WidgetContainer>
  );
}

/* ─── USER Widget ─── */

function UserWidget({ upcomingDeadlines }) {
  const items = useMemo(
    () => (upcomingDeadlines || []).slice(0, 4),
    [upcomingDeadlines]
  );

  return (
    <WidgetContainer>
      <WidgetHeader>
        <WidgetTitle>
          📅 Ερχόμενα γεγονότα
          {items.length > 0 && (
            <WidgetBadge $bg="#fef3c7" $color="#92400e">{items.length}</WidgetBadge>
          )}
        </WidgetTitle>
      </WidgetHeader>

      {items.length === 0 ? (
        <EmptyState>
          Δεν υπάρχουν επερχόμενα γεγονότα τις επόμενες ημέρες.
        </EmptyState>
      ) : (
        items.map((item, idx) => (
          <TaskRow key={idx}>
            <TaskIcon>{item.daysLeft <= 3 ? '⚠' : '📌'}</TaskIcon>
            <TaskTitle title={item.label || item.subprojectTitle}>
              {item.label || item.subprojectTitle}
            </TaskTitle>
            <TaskMeta>
              {item.daysLeft === 0
                ? 'Σήμερα'
                : item.daysLeft === 1
                  ? 'Αύριο'
                  : `σε ${item.daysLeft} ημ.`}
            </TaskMeta>
          </TaskRow>
        ))
      )}
    </WidgetContainer>
  );
}

/* ─── Main Export ─── */

export default function RoleDashboardWidget({
  userRole,
  currentUser,
  upcomingDeadlines,
  onOpenTaskAssignments,
}) {
  if (userRole === 'ENGINEER') {
    return (
      <>
        <EngineerWidget
          currentUser={currentUser}
          onOpenTaskAssignments={onOpenTaskAssignments}
        />
      </>
    );
  }

  if (userRole === 'USER') {
    return (
      <UserWidget upcomingDeadlines={upcomingDeadlines} />
    );
  }

  return null;
}
