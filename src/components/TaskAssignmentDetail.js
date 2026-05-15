import React, { useState } from 'react';
import styled from 'styled-components';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, formatTaskDueDate, isTaskOverdue } from '../utils/taskAssignmentDisplay';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 10001;
  padding: 2rem 1rem;
  overflow-y: auto;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 14px;
  padding: 1.5rem 1.75rem;
  width: 100%;
  max-width: 800px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
`;

const Title = styled.h3`
  margin: 0 0 0.5rem;
  color: #1e293b;
`;

const Meta = styled.div`
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1rem;
`;

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #334155;
`;

const Btn = styled.button`
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  margin-right: 0.35rem;
  margin-bottom: 0.35rem;
  font-family: inherit;
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  border: none;
`;

const DangerBtn = styled(Btn)`
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 70px;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-family: inherit;
  margin-bottom: 0.5rem;
  box-sizing: border-box;
`;

const Timeline = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
`;

const TimelineItem = styled.li`
  padding: 0.4rem 0;
  border-bottom: 1px solid #f1f5f9;
  color: #475569;
`;

function TaskAssignmentDetail({
  isOpen,
  onClose,
  task,
  actingUsername,
  usersMap,
  onUpdated,
  canEditAsAssigner
}) {
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !task) return null;

  const isAssigner = task.createdBy?.toLowerCase() === actingUsername?.toLowerCase();
  const isAssignee = (task.assignees || []).some(
    (a) => String(a).toLowerCase() === String(actingUsername || '').toLowerCase()
  );
  const open = ['pending', 'in_progress'].includes(task.status);
  const overdue = isTaskOverdue(task);

  const assigneeNames = (task.assignees || [])
    .map((u) => usersMap[u]?.fullName || u)
    .join(', ');

  const runStatus = async (status, reason) => {
    setBusy(true);
    setError('');
    const res = await ipcRenderer.invoke('update-task-assignment-status', {
      actingUsername,
      taskId: task.id,
      status,
      reason
    });
    setBusy(false);
    if (res?.success) {
      onUpdated(res.task);
      setShowReject(false);
      setRejectReason('');
    } else {
      setError(res?.error || 'Σφάλμα');
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
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
    const picked = await ipcRenderer.invoke('select-multiple-files', 'Αρχεία ανάθεσης');
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

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Title>{task.title}</Title>
        <Meta>
          {TASK_STATUS_LABELS[task.status] || task.status}
          {' · '}
          {TASK_PRIORITY_LABELS[task.priority] || task.priority}
          {' · Προθεσμία: '}
          <span style={{ color: overdue ? '#b91c1c' : 'inherit', fontWeight: overdue ? 600 : 400 }}>
            {formatTaskDueDate(task.dueDate, task.dueTime)}
          </span>
          <br />
          Αναθέτων: {usersMap[task.createdBy]?.fullName || task.createdBy}
          <br />
          Παραλήπτες: {assigneeNames || '—'}
        </Meta>

        {error && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</div>}

        <Section>
          <SectionTitle>Περιγραφή</SectionTitle>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#334155' }}>
            {task.description || '—'}
          </div>
        </Section>

        {open && isAssignee && (
          <Section>
            <SectionTitle>Ενέργειες παραλήπτη</SectionTitle>
            {task.status === 'pending' && (
              <PrimaryBtn type="button" disabled={busy} onClick={() => runStatus('in_progress')}>
                Έναρξη εργασίας
              </PrimaryBtn>
            )}
            <PrimaryBtn type="button" disabled={busy} onClick={() => runStatus('completed')}>
              Ολοκλήρωση
            </PrimaryBtn>
            <DangerBtn type="button" disabled={busy} onClick={() => setShowReject(!showReject)}>
              Απόρριψη
            </DangerBtn>
            {showReject && (
              <div style={{ marginTop: 8 }}>
                <TextArea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Αιτιολογία απόρριψης..."
                />
                <DangerBtn type="button" disabled={busy} onClick={() => runStatus('rejected', rejectReason)}>
                  Επιβεβαίωση απόρριψης
                </DangerBtn>
              </div>
            )}
          </Section>
        )}

        {open && isAssigner && canEditAsAssigner && (
          <Section>
            <SectionTitle>Αναθέτων</SectionTitle>
            <DangerBtn type="button" disabled={busy} onClick={() => runStatus('cancelled')}>
              Ακύρωση ανάθεσης
            </DangerBtn>
          </Section>
        )}

        <Section>
          <SectionTitle>Αρχεία</SectionTitle>
          <Btn type="button" onClick={addFiles} disabled={busy}>
            + Προσθήκη αρχείου
          </Btn>
          <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>
            {(task.files || []).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => ipcRenderer.invoke('open-task-assignment-file', { filePath: f.path })}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section>
          <SectionTitle>Σχόλια</SectionTitle>
          <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Νέο σχόλιο..." />
          <Btn type="button" onClick={submitComment} disabled={busy}>
            Αποστολή σχολίου
          </Btn>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {(task.comments || []).slice().reverse().map((c) => (
              <li key={c.id} style={{ marginBottom: 10, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                <strong>{usersMap[c.author]?.fullName || c.author}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 8 }}>
                  {new Date(c.createdAt).toLocaleString('el-GR')}
                </span>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{c.text}</div>
              </li>
            ))}
          </ul>
        </Section>

        <Section>
          <SectionTitle>Ιστορικό κατάστασης</SectionTitle>
          <Timeline>
            {(task.statusHistory || []).slice().reverse().map((h, i) => (
              <TimelineItem key={`${h.at}-${i}`}>
                {TASK_STATUS_LABELS[h.status] || h.status} — {usersMap[h.by]?.fullName || h.by}
                {' · '}
                {new Date(h.at).toLocaleString('el-GR')}
                {h.note ? ` — ${h.note}` : ''}
              </TimelineItem>
            ))}
          </Timeline>
        </Section>

        <Btn type="button" onClick={onClose} style={{ marginTop: 8 }}>
          Κλείσιμο
        </Btn>
      </Panel>
    </Overlay>
  );
}

export default TaskAssignmentDetail;
