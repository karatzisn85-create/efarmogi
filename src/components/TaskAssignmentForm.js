import React, { useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { DEFAULT_REMINDER_OFFSETS } from '../utils/taskAssignmentDisplay';
import {
  allowDocumentInteractionLock,
  resetDocumentInteractionState,
  scheduleDocumentInteractionRecovery
} from '../utils/documentInteractionReset';

const ipcRenderer = window.electronAPI;

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.82) 0%, rgba(49, 46, 129, 0.65) 45%, rgba(15, 23, 42, 0.78) 100%);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 10050;
  padding: 1.75rem 1rem 2rem;
  overflow-y: auto;
  isolation: isolate;
  pointer-events: auto;
`;

const FormShell = styled.div`
  width: 100%;
  max-width: min(1200px, calc(100vw - 2rem));
  border-radius: 18px;
  overflow: hidden;
  pointer-events: auto;
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.06),
    0 24px 48px rgba(30, 27, 75, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
`;

const FormHero = styled.div`
  padding: 1.35rem 1.65rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 42%, #4338ca 100%);
  color: #fff;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 70% at 85% 0%, rgba(255, 255, 255, 0.22), transparent 55%);
    pointer-events: none;
  }
`;

const HeroEyebrow = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.88;
  margin-bottom: 0.35rem;
`;

const HeroTitle = styled.h3`
  margin: 0;
  font-size: 1.42rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  position: relative;
  z-index: 1;
`;

const HeroSubtitle = styled.p`
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.45;
  opacity: 0.92;
  max-width: min(52rem, 100%);
  position: relative;
  z-index: 1;
`;

const FormBody = styled.div`
  padding: 1.35rem 1.65rem 1.65rem;
  background: linear-gradient(180deg, #fafbff 0%, #ffffff 28%);
`;

const Section = styled.section`
  margin-bottom: 1.35rem;
  &:last-of-type {
    margin-bottom: 1rem;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const SectionTitle = styled.span`
  font-size: 0.82rem;
  font-weight: 800;
  color: #312e81;
  letter-spacing: 0.03em;
`;

const SectionHint = styled.span`
  font-size: 0.76rem;
  font-weight: 600;
  color: #94a3b8;
`;

const Label = styled.label`
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.38rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.98rem;
  margin-bottom: 0;
  box-sizing: border-box;
  font-family: inherit;
  min-height: 46px;
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 128px;
  padding: 0.68rem 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.52;
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.62rem 0.88rem;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  font-size: 0.96rem;
  box-sizing: border-box;
  font-family: inherit;
  min-height: 46px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 0.65rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  padding: 0.58rem 1.25rem;
  border-radius: 11px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  font-size: 0.93rem;
  font-family: inherit;
  min-height: 46px;
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const SecondaryBtn = styled(Btn)`
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
`;

const FileZone = styled.div`
  border: 1px dashed #c7d2fe;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.65) 0%, #ffffff 100%);
`;

const FileList = styled.ul`
  margin: 0.65rem 0 0;
  padding-left: 1.2rem;
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.45;
`;

const AssigneeGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  border: 1px solid #e8eef7;
  background: #fff;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const AssigneeCard = styled.label`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.42rem 0.55rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.92rem;
  line-height: 1.35;
  border: 1px solid transparent;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
  &:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
  }
`;

const AssigneeCheck = styled.input`
  width: 17px;
  height: 17px;
  accent-color: #4f46e5;
  flex-shrink: 0;
`;

const ReminderChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
`;

const RemChip = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? 'rgba(99, 102, 241, 0.12)' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#64748b')};
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
`;

const ErrorMsg = styled.div`
  color: #b91c1c;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  font-weight: 600;
  line-height: 1.45;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
`;

function TaskAssignmentForm({ onClose, onSaved, actingUsername, editingTask = null, assignableUsers = [] }) {
  const titleRef = useRef(null);
  const errorRef = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [reminderOffsets, setReminderOffsets] = useState([...DEFAULT_REMINDER_OFFSETS]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    resetDocumentInteractionState();
    allowDocumentInteractionLock();
    const focusId = requestAnimationFrame(() => {
      titleRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(focusId);
      resetDocumentInteractionState();
      allowDocumentInteractionLock();
      scheduleDocumentInteractionRecovery({ lockScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority || 'normal');
      setDueDate(editingTask.dueDate || '');
      setAssignees(Array.isArray(editingTask.assignees) ? [...editingTask.assignees] : []);
      setReminderOffsets(
        Array.isArray(editingTask.reminderOffsets) && editingTask.reminderOffsets.length
          ? editingTask.reminderOffsets
          : [...DEFAULT_REMINDER_OFFSETS]
      );
    } else {
      setTitle('');
      setDescription('');
      setPriority('normal');
      setDueDate('');
      setAssignees([]);
      setReminderOffsets([...DEFAULT_REMINDER_OFFSETS]);
    }
    setPendingFiles([]);
    setError('');
    setSaving(false);
  }, [editingTask]);

  const toggleAssignee = (username) => {
    setAssignees((prev) => {
      const has = prev.some((u) => u.toLowerCase() === username.toLowerCase());
      if (has) return prev.filter((u) => u.toLowerCase() !== username.toLowerCase());
      return [...prev, username];
    });
  };

  const toggleReminder = (days) => {
    setReminderOffsets((prev) => {
      if (prev.includes(days)) return prev.filter((d) => d !== days);
      return [...prev, days].sort((a, b) => b - a);
    });
  };

  const handlePickFiles = async () => {
    try {
      const res = await ipcRenderer.invoke('select-multiple-files', 'Επιλογή αρχείων χώρου');
      if (res?.success && !res.canceled && Array.isArray(res.files) && res.files.length > 0) {
        setPendingFiles((prev) => [...prev, ...res.files]);
      }
    } catch (e) {
      setError(e.message || 'Σφάλμα επιλογής αρχείων');
    }
  };

  const showError = (message) => {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      showError('Ο τίτλος είναι υποχρεωτικός');
      return;
    }
    if (assignees.length === 0) {
      showError(
        assignableUsers.length === 0
          ? 'Δεν υπάρχουν διαθέσιμοι συνάδελφοι — ζητήστε από τον διαχειριστή δικαίωμα ανάθεσης ή επιλογή συναδέλφων.'
          : 'Επιλέξτε τουλάχιστον έναν συνάδελφο'
      );
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      dueTime: '',
      assignees,
      reminderOffsets
    };
    try {
      let result;
      if (editingTask) {
        result = await ipcRenderer.invoke('update-task-assignment', {
          actingUsername,
          taskId: editingTask.id,
          payload,
          newFiles: pendingFiles
        });
      } else {
        result = await ipcRenderer.invoke('create-task-assignment', {
          actingUsername,
          payload,
          newFiles: pendingFiles
        });
      }
      if (result?.success) {
        await onSaved(result.task);
        onClose();
      } else {
        showError(result?.error || 'Αποτυχία αποθήκευσης');
      }
    } catch (e) {
      showError(e.message || 'Σφάλμα αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const heroTitle = editingTask ? 'Επεξεργασία χώρου' : 'Δημιουργία Χώρου';
  const heroSub = editingTask
    ? 'Ενημερώστε τα στοιχεία του χώρου και προσθέστε αρχεία αν χρειάζεται.'
    : 'Ορίστε τίτλο, περιγραφή και συναδέλφους· η ομάδα θα ενημερωθεί και θα μπορεί να συνεργαστεί στον χώρο.';

  const modal = (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormShell onClick={(e) => e.stopPropagation()}>
        <FormHero>
          <HeroEyebrow>Χώρος Εργασίας</HeroEyebrow>
          <HeroTitle>{heroTitle}</HeroTitle>
          <HeroSubtitle>{heroSub}</HeroSubtitle>
        </FormHero>

        <FormBody>
          {error && <ErrorMsg ref={errorRef}>{error}</ErrorMsg>}

          <Section>
            <SectionHead>
              <SectionTitle>Βασικά στοιχεία</SectionTitle>
              <SectionHint>υποχρεωτικά πεδία με *</SectionHint>
            </SectionHead>
            <Label htmlFor="ta-title">Τίτλος *</Label>
            <Input
              ref={titleRef}
              id="ta-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Σύντομος τίτλος θέματος"
              autoComplete="off"
            />
          </Section>

          <Section>
            <SectionHead>
              <SectionTitle>Περιγραφή</SectionTitle>
              <SectionHint>οδηγίες & παραδοτέα</SectionHint>
            </SectionHead>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Λεπτομέρειες, οδηγίες, αναμενόμενα παραδοτέα..."
            />
          </Section>

          <Section>
            <SectionHead>
              <SectionTitle>Συνάδελφοι</SectionTitle>
              <SectionHint>* τουλάχιστον ένας</SectionHint>
            </SectionHead>
            <AssigneeGrid>
              {assignableUsers.length === 0 ? (
                <span style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                  Δεν υπάρχουν διαθέσιμοι συνάδελφοι.
                </span>
              ) : (
                assignableUsers.map((u) => {
                  const on = assignees.some((a) => a.toLowerCase() === u.username.toLowerCase());
                  return (
                    <AssigneeCard key={u.username}>
                      <AssigneeCheck type="checkbox" checked={on} onChange={() => toggleAssignee(u.username)} />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{u.fullName || u.username}</span>
                      <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.84rem' }}>({u.username})</span>
                    </AssigneeCard>
                  );
                })
              )}
            </AssigneeGrid>
          </Section>

          <Section>
            <SectionHead>
              <SectionTitle>Προτεραιότητα & ολοκλήρωση εργασίας</SectionTitle>
            </SectionHead>
            <Row>
              <div>
                <Label htmlFor="ta-priority">Προτεραιότητα</Label>
                <Select id="ta-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Χαμηλή</option>
                  <option value="normal">Κανονική</option>
                  <option value="high">Υψηλή</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ta-due">Ολοκλήρωση εργασίας έως</Label>
                <Input id="ta-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </Row>
          </Section>

          <Section>
            <SectionHead>
              <SectionTitle>Υπενθυμίσεις</SectionTitle>
              <SectionHint>ημέρες πριν τη λήξη</SectionHint>
            </SectionHead>
            <ReminderChips>
              {DEFAULT_REMINDER_OFFSETS.map((d) => {
                const on = reminderOffsets.includes(d);
                return (
                  <RemChip key={d} $on={on}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleReminder(d)}
                      style={{ accentColor: '#4f46e5', width: 14, height: 14 }}
                    />
                    {d === 0 ? 'Την ημέρα' : `${d} ημ.`}
                  </RemChip>
                );
              })}
            </ReminderChips>
          </Section>

          <Section>
            <SectionHead>
              <SectionTitle>Συνημμένα</SectionTitle>
              <SectionHint>προαιρετικά</SectionHint>
            </SectionHead>
            <FileZone>
              <SecondaryBtn type="button" onClick={handlePickFiles} style={{ marginBottom: 0 }}>
                + Προσθήκη αρχείων
              </SecondaryBtn>
              {pendingFiles.length > 0 && (
                <FileList>
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.filePath}-${i}`}>{f.fileName || f.name}</li>
                  ))}
                </FileList>
              )}
            </FileZone>
          </Section>

          <BtnRow>
            <PrimaryBtn type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </PrimaryBtn>
            <SecondaryBtn type="button" onClick={onClose}>
              Ακύρωση
            </SecondaryBtn>
          </BtnRow>
        </FormBody>
      </FormShell>
    </FormOverlay>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

export default TaskAssignmentForm;
