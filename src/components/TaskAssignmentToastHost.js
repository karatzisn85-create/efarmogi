import React, { useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

const DISMISS_TASK_EVENT = 'ef-task-toast-dismiss';
const AUTO_DISMISS_MS = 14500;
const MAX_STACK = 4;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(110%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
`;

const progressShrink = keyframes`
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
`;

const StackRoot = styled.div`
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-end;
  pointer-events: none;
  max-width: min(420px, calc(100vw - 1.5rem));
`;

const ToastSurface = styled.article`
  pointer-events: auto;
  width: min(400px, calc(100vw - 1.5rem));
  border-radius: 18px;
  overflow: hidden;
  position: relative;
  animation: ${slideIn} 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  box-shadow:
    0 22px 50px rgba(15, 23, 42, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.55) inset;
  background: linear-gradient(
      165deg,
      rgba(255, 255, 255, 0.94) 0%,
      rgba(248, 250, 252, 0.92) 45%,
      rgba(241, 245, 249, 0.94) 100%
    );
  backdrop-filter: blur(14px);
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 2px;
    border-radius: 18px;
    background: ${(p) =>
      p.$accent ||
      'linear-gradient(135deg, rgba(99,102,241,0.75), rgba(168,85,247,0.65), rgba(59,130,246,0.55))'};
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
`;

const ToastInner = styled.div`
  position: relative;
  padding: 1rem 1rem 0.85rem;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.65rem 0.75rem;
  align-items: start;
`;

const IconBadge = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  background: ${(p) => p.$bg || 'linear-gradient(145deg, #6366f1, #4f46e5)'};
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
`;

const ToastBody = styled.div`
  min-width: 0;
`;

const KindLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => p.$color || '#64748b'};
  margin-bottom: 0.2rem;
`;

const TaskTitle = styled.div`
  font-size: 0.98rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.3;
  margin-bottom: 0.35rem;
`;

const Preview = styled.p`
  margin: 0;
  font-size: 0.89rem;
  color: #475569;
  line-height: 1.48;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CloseGhost = styled.button`
  border: none;
  background: rgba(241, 245, 249, 0.85);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.05rem;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
`;

const ActionsRow = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(226, 232, 240, 0.95);
`;

const PrimaryMini = styled.button`
  flex: 1;
  min-width: 120px;
  padding: 0.52rem 0.85rem;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  font-weight: 800;
  font-size: 0.85rem;
  font-family: inherit;
  color: #fff;
  background: linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #4f46e5 100%);
  background-size: 200% 200%;
  animation: ${shimmer} 5s ease infinite;
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.3);
  &:hover {
    filter: brightness(1.05);
  }
`;

const ProgressTrack = styled.div`
  height: 4px;
  background: rgba(226, 232, 240, 0.8);
  position: relative;
`;

const ProgressFill = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: linear-gradient(90deg, #6366f1, #a855f7, #38bdf8);
  animation: ${progressShrink} ${AUTO_DISMISS_MS}ms linear forwards;
`;

function toastAccent(type) {
  if (type === 'comment_added') {
    return 'linear-gradient(135deg, rgba(20,184,166,0.85), rgba(59,130,246,0.7), rgba(99,102,241,0.55))';
  }
  if (type === 'assignment_created') {
    return 'linear-gradient(135deg, rgba(245,158,11,0.85), rgba(236,72,153,0.55), rgba(99,102,241,0.6))';
  }
  return 'linear-gradient(135deg, rgba(99,102,241,0.75), rgba(168,85,247,0.65), rgba(59,130,246,0.55))';
}

function toastIcon(type) {
  if (type === 'comment_added') return '💬';
  if (type === 'assignment_created') return '📋';
  return '🔔';
}

function toastKindLabel(type) {
  if (type === 'comment_added') return 'Νέο σχόλιο';
  if (type === 'assignment_created') return 'Νέα ανάθεση';
  if (type === 'assignment_updated') return 'Ενημέρωση';
  return 'Ανάθεση';
}

function toastIconBg(type) {
  if (type === 'comment_added') return 'linear-gradient(145deg, #0d9488, #0284c7)';
  if (type === 'assignment_created') return 'linear-gradient(145deg, #d97706, #db2777)';
  return 'linear-gradient(145deg, #6366f1, #4f46e5)';
}

/**
 * Εμφανίζει εντυπωσιακά toast για νέα ανάθεση και νέα σχόλια· κλείνουν με Χ, αυτόματα, ή όταν ανοίγει η ανάθεση.
 */
function TaskAssignmentToastHost({ actingUsername, onOpenTaskAssignment, onNotificationConsumed }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
  }, []);

  const markOneRead = useCallback(
    async (notificationId) => {
      if (!actingUsername || !notificationId) return;
      try {
        await window.electronAPI.invoke('mark-task-notifications-read', {
          actingUsername,
          notificationIds: [notificationId]
        });
        if (typeof onNotificationConsumed === 'function') onNotificationConsumed();
      } catch {
        /* ignore */
      }
    },
    [actingUsername, onNotificationConsumed]
  );

  const scheduleAutoDismiss = useCallback(
    (id) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const h = setTimeout(() => {
        timersRef.current.delete(id);
        removeToast(id);
        markOneRead(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, h);
    },
    [markOneRead, removeToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((h) => clearTimeout(h));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.on?.('task-notification', (payload) => {
      if (payload?.username?.toLowerCase() !== actingUsername?.toLowerCase()) return;
      const n = payload?.notification;
      if (!n?.id || !n.taskId) return;
      if (!['assignment_created', 'comment_added'].includes(n.type)) return;

      setToasts((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        const entry = { ...n, _receivedAt: Date.now() };
        let next = [...prev, entry];
        while (next.length > MAX_STACK) next = next.slice(next.length - MAX_STACK);
        return next;
      });

      queueMicrotask(() => scheduleAutoDismiss(n.id));
    });

    const onDismissByTask = (ev) => {
      const tid = ev.detail?.taskId;
      if (!tid) return;
      setToasts((prev) => {
        prev
          .filter((t) => t.taskId === tid)
          .forEach((t) => {
            const h = timersRef.current.get(t.id);
            if (h) clearTimeout(h);
            timersRef.current.delete(t.id);
          });
        return prev.filter((t) => t.taskId !== tid);
      });
    };

    window.addEventListener(DISMISS_TASK_EVENT, onDismissByTask);
    return () => {
      if (typeof unsub === 'function') unsub();
      window.removeEventListener(DISMISS_TASK_EVENT, onDismissByTask);
    };
  }, [actingUsername, scheduleAutoDismiss]);

  const handleDismiss = (t) => {
    removeToast(t.id);
    markOneRead(t.id);
  };

  const handleOpen = (t) => {
    removeToast(t.id);
    markOneRead(t.id);
    if (typeof onOpenTaskAssignment === 'function') onOpenTaskAssignment(t.taskId);
  };

  if (!actingUsername) return null;

  return (
    <StackRoot aria-live="polite" aria-label="Ειδοποιήσεις αναθέσεων">
      {toasts.map((t) => (
        <ToastSurface key={t.id} $accent={toastAccent(t.type)} role="status">
          <ToastInner>
            <IconBadge $bg={toastIconBg(t.type)} aria-hidden>
              {toastIcon(t.type)}
            </IconBadge>
            <ToastBody>
              <KindLabel $color={t.type === 'comment_added' ? '#0f766e' : '#a16207'}>{toastKindLabel(t.type)}</KindLabel>
              <TaskTitle>{t.title || 'Ανάθεση εργασίας'}</TaskTitle>
              <Preview>{t.message || ''}</Preview>
            </ToastBody>
            <CloseGhost type="button" onClick={() => handleDismiss(t)} aria-label="Κλείσιμο ειδοποίησης">
              ✕
            </CloseGhost>
            <ActionsRow>
              <PrimaryMini type="button" onClick={() => handleOpen(t)}>
                Προβολή ανάθεσης
              </PrimaryMini>
            </ActionsRow>
          </ToastInner>
          <ProgressTrack aria-hidden>
            <ProgressFill />
          </ProgressTrack>
        </ToastSurface>
      ))}
    </StackRoot>
  );
}

export default TaskAssignmentToastHost;
export { DISMISS_TASK_EVENT };
