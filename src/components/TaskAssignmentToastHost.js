import React, { useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

const DISMISS_TASK_EVENT = 'ef-task-toast-dismiss';
const AUTO_DISMISS_MS = 14500;
const MAX_STACK = 4;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
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

/** Τύποι ειδοποιήσεων που εμφανίζονται ως «κάρτα» (συμβατοί με taskAssignmentService). */
const TOAST_ELIGIBLE_TYPES = new Set([
  'assignment_created',
  'comment_added',
  'assignment_updated',
  'status_changed',
  'assignment_completed',
  'assignment_departed',
  'assignment_withdrawn',
  'archive_left',
  'due_soon',
  'overdue'
]);

const STARTUP_STAGGER_MS = 420;

const StackRoot = styled.div`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  top: auto;
  left: auto;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 0.75rem;
  pointer-events: none;
  max-width: min(420px, calc(100vw - 1.5rem));
  max-height: calc(100vh - 2rem);
  overflow: visible;
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
  if (type === 'assignment_departed' || type === 'overdue') {
    return 'linear-gradient(135deg, rgba(220,38,38,0.75), rgba(185,28,28,0.65), rgba(99,102,241,0.45))';
  }
  if (type === 'assignment_completed') {
    return 'linear-gradient(135deg, rgba(22,163,74,0.75), rgba(59,130,246,0.55), rgba(99,102,241,0.5))';
  }
  if (type === 'due_soon') {
    return 'linear-gradient(135deg, rgba(234,179,8,0.85), rgba(249,115,22,0.6), rgba(99,102,241,0.5))';
  }
  return 'linear-gradient(135deg, rgba(99,102,241,0.75), rgba(168,85,247,0.65), rgba(59,130,246,0.55))';
}

function toastIcon(type) {
  if (type === 'comment_added') return '💬';
  if (type === 'assignment_created') return '📋';
  if (type === 'assignment_completed') return '✓';
  if (type === 'assignment_departed') return '↩';
  if (type === 'due_soon' || type === 'overdue') return '⏱';
  if (type === 'status_changed') return '↻';
  return '🔔';
}

function toastKindLabel(type) {
  if (type === 'comment_added') return 'Νέο σχόλιο';
  if (type === 'assignment_created') return 'Νέος χώρος';
  if (type === 'assignment_updated') return 'Ενημέρωση χώρου';
  if (type === 'status_changed') return 'Αλλαγή κατάστασης';
  if (type === 'assignment_completed') return 'Ολοκληρώθηκε';
  if (type === 'assignment_departed') return 'Αποχώρηση';
  if (type === 'assignment_withdrawn') return 'Κλείσιμο χώρου';
  if (type === 'archive_left') return 'Αποχώρηση από αποθήκη';
  if (type === 'due_soon') return 'Προθεσμία σύντομα';
  if (type === 'overdue') return 'Εκπρόθεσμη';
  return 'Χώρος Εργασίας';
}

function toastKindLabelColor(type) {
  if (type === 'comment_added') return '#0f766e';
  if (type === 'assignment_created') return '#a16207';
  if (type === 'assignment_completed') return '#15803d';
  if (type === 'assignment_departed' || type === 'overdue') return '#b45309';
  if (type === 'due_soon') return '#a16207';
  return '#4338ca';
}

function toastIconBg(type) {
  if (type === 'comment_added') return 'linear-gradient(145deg, #0d9488, #0284c7)';
  if (type === 'assignment_created') return 'linear-gradient(145deg, #d97706, #db2777)';
  if (type === 'assignment_completed') return 'linear-gradient(145deg, #16a34a, #059669)';
  if (type === 'assignment_departed' || type === 'overdue') return 'linear-gradient(145deg, #d97706, #b45309)';
  if (type === 'due_soon') return 'linear-gradient(145deg, #ca8a04, #ea580c)';
  return 'linear-gradient(145deg, #6366f1, #4f46e5)';
}

function isToastableNotification(n) {
  return Boolean(n?.id && n?.taskId && TOAST_ELIGIBLE_TYPES.has(n.type));
}

/**
 * Εμφανίζει ειδοποιήσεις χώρου εργασίας κάτω δεξιά: σε πραγματικό χρόνο (IPC) και κατά την είσοδο χρήστη (μη αναγνωσμένες).
 */
function TaskAssignmentToastHost({ actingUsername, onOpenTaskAssignment, onNotificationConsumed }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const startupFetchGenRef = useRef(0);

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
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, h);
    },
    [removeToast]
  );

  const scheduleAutoDismissRef = useRef(scheduleAutoDismiss);
  scheduleAutoDismissRef.current = scheduleAutoDismiss;

  useEffect(() => {
    return () => {
      timersRef.current.forEach((h) => clearTimeout(h));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setToasts([]);
    timersRef.current.forEach((h) => clearTimeout(h));
    timersRef.current.clear();
  }, [actingUsername]);

  /** Μία φόρτωση ανά «γενιά» εισόδου χρήστη: μη αναγνωσμένες ειδοποιήσεις εμφανίζονται κάτω δεξιά. */
  useEffect(() => {
    if (!actingUsername || !window.electronAPI?.invoke) return undefined;

    startupFetchGenRef.current += 1;
    const gen = startupFetchGenRef.current;
    let cancelled = false;
    const staggerTimers = [];

    (async () => {
      try {
        let res = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          if (cancelled || startupFetchGenRef.current !== gen) return;
          res = await window.electronAPI.invoke('load-task-notifications', {
            actingUsername,
            unreadOnly: true
          });
          if (res?.success) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelled || startupFetchGenRef.current !== gen || !res?.success) return;
        const raw = Array.isArray(res.notifications) ? res.notifications : [];
        const filtered = raw.filter(isToastableNotification);
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const batch = filtered.slice(0, MAX_STACK);

        batch.forEach((n, idx) => {
          const delay = idx * STARTUP_STAGGER_MS;
          const tid = setTimeout(() => {
            if (cancelled || startupFetchGenRef.current !== gen) return;
            setToasts((prev) => {
              if (prev.some((x) => x.id === n.id)) return prev;
              const entry = { ...n, _receivedAt: Date.now(), _fromStartup: true };
              let next = [entry, ...prev];
              while (next.length > MAX_STACK) next = next.slice(0, MAX_STACK);
              return next;
            });
            queueMicrotask(() => scheduleAutoDismissRef.current(n.id));
          }, delay);
          staggerTimers.push(tid);
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      staggerTimers.forEach((tid) => clearTimeout(tid));
    };
  }, [actingUsername]);

  /** Κοινός φάκελος server: νέες ειδοποιήσεις από άλλο PC (χωρίς τοπικό IPC). */
  useEffect(() => {
    if (!actingUsername || !window.electronAPI?.invoke) return undefined;
    const poll = async () => {
      try {
        const res = await window.electronAPI.invoke('load-task-notifications', {
          actingUsername,
          unreadOnly: true
        });
        if (!res?.success) return;
        const incoming = (Array.isArray(res.notifications) ? res.notifications : []).filter(
          isToastableNotification
        );
        if (incoming.length === 0) return;
        setToasts((prev) => {
          let next = prev;
          let added = false;
          incoming.forEach((n) => {
            if (next.some((x) => x.id === n.id)) return;
            const entry = { ...n, _receivedAt: Date.now(), _fromPoll: true };
            next = [entry, ...next];
            added = true;
            queueMicrotask(() => scheduleAutoDismissRef.current(n.id));
          });
          if (!added) return prev;
          while (next.length > MAX_STACK) next = next.slice(0, MAX_STACK);
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    const intervalId = setInterval(poll, 60000);
    return () => clearInterval(intervalId);
  }, [actingUsername]);

  useEffect(() => {
    const unsub = window.electronAPI?.on?.('task-notification', (payload) => {
      if (payload?.username?.toLowerCase() !== actingUsername?.toLowerCase()) return;
      const n = payload?.notification;
      if (!isToastableNotification(n)) return;

      setToasts((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        const entry = { ...n, _receivedAt: Date.now() };
        let next = [entry, ...prev];
        while (next.length > MAX_STACK) next = next.slice(0, MAX_STACK);
        return next;
      });

      queueMicrotask(() => scheduleAutoDismissRef.current(n.id));
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
  }, [actingUsername]);

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
    <StackRoot aria-live="polite" aria-label="Ειδοποιήσεις χώρου εργασίας">
      {toasts.map((t) => (
        <ToastSurface key={t.id} $accent={toastAccent(t.type)} role="status">
          <ToastInner>
            <IconBadge $bg={toastIconBg(t.type)} aria-hidden>
              {toastIcon(t.type)}
            </IconBadge>
            <ToastBody>
              <KindLabel $color={toastKindLabelColor(t.type)}>{toastKindLabel(t.type)}</KindLabel>
              <TaskTitle>{t.title || 'Χώρος εργασίας'}</TaskTitle>
              <Preview>{t.message || ''}</Preview>
            </ToastBody>
            <CloseGhost type="button" onClick={() => handleDismiss(t)} aria-label="Κλείσιμο ειδοποίησης">
              ✕
            </CloseGhost>
            <ActionsRow>
              <PrimaryMini type="button" onClick={() => handleOpen(t)}>
                Άνοιγμα χώρου
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
