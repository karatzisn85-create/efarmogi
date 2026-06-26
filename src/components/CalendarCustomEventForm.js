import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import { showConfirm } from '../utils/confirmModal';
import { CUSTOM_VISIBILITY_ROLES, describeCustomVisibility } from '../utils/customCalendarEvents';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  z-index: 2200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3vh 1rem 2rem;
  overflow-y: auto;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: #fff;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
`;

const Subtitle = styled.p`
  margin: 0.3rem 0 0;
  font-size: 0.78rem;
  opacity: 0.9;
`;

const CloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-weight: 700;
  cursor: pointer;
`;

const Body = styled.div`
  padding: 1.1rem 1.25rem 1.25rem;
`;

const Field = styled.div`
  margin-bottom: 0.9rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.35rem;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
  font-family: inherit;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
  font-family: inherit;
  min-height: 88px;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
`;

const SectionTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0.35rem 0 0.55rem;
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  font-size: 0.84rem;
  color: #334155;
  cursor: pointer;
  input { width: 16px; height: 16px; }
`;

const UserPick = styled.select`
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
  background: #fff;
`;

const ChipWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
`;

const Chip = styled.button`
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #3730a3;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
`;

const Help = styled.p`
  margin: 0.25rem 0 0;
  font-size: 0.74rem;
  color: #64748b;
  line-height: 1.45;
`;

const ErrorText = styled.div`
  color: #dc2626;
  font-size: 0.78rem;
  margin-top: 0.25rem;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid #e2e8f0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.95rem;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
  background: ${(p) => (p.$primary ? '#4f46e5' : p.$danger ? '#fee2e2' : '#f1f5f9')};
  color: ${(p) => (p.$primary ? '#fff' : p.$danger ? '#b91c1c' : '#334155')};
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

function isoFromDateAndTime(dateStr, timeStr) {
  const date = String(dateStr || '').trim();
  if (!date) return '';
  const time = String(timeStr || '').trim();
  if (!time) return `${date}T12:00:00.000Z`;
  return `${date}T${time}:00`;
}

function splitDateTime(iso) {
  if (!iso) return { date: '', time: '' };
  const raw = String(iso);
  if (/^\d{4}-\d{2}-\d{2}T12:00:00(\.000)?Z$/i.test(raw)) {
    return { date: raw.slice(0, 10), time: '' };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const hasExplicitTime = String(iso).includes('T') && !(hh === '12' && mm === '00');
  return {
    date: `${y}-${m}-${day}`,
    time: hasExplicitTime ? `${hh}:${mm}` : '',
  };
}

export default function CalendarCustomEventForm({
  isOpen,
  onClose,
  currentUser,
  editingEvent = null,
  onSaved,
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [roleAdmin, setRoleAdmin] = useState(false);
  const [roleEngineer, setRoleEngineer] = useState(false);
  const [roleUser, setRoleUser] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const [userPick, setUserPick] = useState('');
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!(editingEvent && editingEvent.id);

  const resetFromEvent = useCallback((event) => {
    if (!event) {
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setRoleAdmin(false);
      setRoleEngineer(false);
      setRoleUser(false);
      setSelectedUsernames([]);
      return;
    }
    const parts = splitDateTime(event.dateIso);
    setTitle(event.title || '');
    setDescription(event.description || '');
    setDate(parts.date);
    setTime(parts.time);
    const roles = event.visibilityRoles || [];
    setRoleAdmin(roles.includes('ADMIN'));
    setRoleEngineer(roles.includes('ENGINEER'));
    setRoleUser(roles.includes('USER'));
    setSelectedUsernames(Array.isArray(event.visibilityUsernames) ? [...event.visibilityUsernames] : []);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    resetFromEvent(editingEvent);
    setError('');
  }, [isOpen, editingEvent, resetFromEvent]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await ipcRenderer.invoke('get-users');
        if (cancelled) return;
        const list = (Array.isArray(rows) ? rows : [])
          .filter((u) => u.active !== false && u.approved !== false)
          .sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username, 'el'));
        setUsers(list);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const availableUsers = useMemo(
    () => users.filter((u) => !selectedUsernames.includes(u.username)),
    [users, selectedUsernames]
  );

  const previewVisibility = useMemo(() => describeCustomVisibility({
    visibilityRoles: [
      ...(roleAdmin ? ['ADMIN'] : []),
      ...(roleEngineer ? ['ENGINEER'] : []),
      ...(roleUser ? ['USER'] : []),
    ],
    visibilityUsernames: selectedUsernames,
  }), [roleAdmin, roleEngineer, roleUser, selectedUsernames]);

  const addUser = () => {
    const name = String(userPick || '').trim();
    if (!name || selectedUsernames.includes(name)) return;
    setSelectedUsernames((prev) => [...prev, name]);
    setUserPick('');
  };

  const buildPayload = () => {
    const visibilityRoles = [];
    if (roleAdmin) visibilityRoles.push('ADMIN');
    if (roleEngineer) visibilityRoles.push('ENGINEER');
    if (roleUser) visibilityRoles.push('USER');
    return {
      id: editingEvent?.id,
      title: title.trim(),
      description: description.trim(),
      dateIso: isoFromDateAndTime(date, time),
      visibilityRoles,
      visibilityUsernames: selectedUsernames,
    };
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Συμπληρώστε τίτλο.');
      return;
    }
    if (!date) {
      setError('Επιλέξτε ημερομηνία.');
      return;
    }
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('save-calendar-custom-event', {
        event: buildPayload(),
        actingUsername: currentUser?.username,
      });
      if (!res?.success) {
        setError(res?.error || 'Αποτυχία αποθήκευσης');
        return;
      }
      showToast(isEdit ? 'Η προθεσμία ενημερώθηκε.' : 'Η προθεσμία καταχωρήθηκε.', 'success');
      onSaved?.(res.event);
      onClose?.();
    } catch (e) {
      setError(e.message || 'Σφάλμα αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !editingEvent?.id) return;
    const ok = await showConfirm({
      title: 'Διαγραφή προθεσμίας',
      message: 'Θέλετε να διαγραφεί αυτή η προθεσμία;',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('delete-calendar-custom-event', {
        eventId: editingEvent.id,
        actingUsername: currentUser?.username,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία διαγραφής', 'error');
        return;
      }
      showToast('Η προθεσμία διαγράφηκε.', 'success');
      onSaved?.(null);
      onClose?.();
    } catch (e) {
      showToast(e.message || 'Σφάλμα διαγραφής', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>{isEdit ? 'Επεξεργασία προθεσμίας' : 'Νέα προθεσμία / ειδοποίηση'}</Title>
            <Subtitle>Ορατότητα: {previewVisibility}</Subtitle>
          </div>
          <CloseBtn type="button" onClick={onClose}>Κλείσιμο</CloseBtn>
        </Header>
        <Body>
          <Field>
            <Label htmlFor="cal-custom-title">Τίτλος *</Label>
            <Input
              id="cal-custom-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="π.χ. Υποβολή στοιχείων στην ΕΑΔΗΣΥ"
            />
          </Field>
          <Field>
            <Label htmlFor="cal-custom-desc">Περιγραφή</Label>
            <TextArea
              id="cal-custom-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Προαιρετικές λεπτομέρειες για τους χρήστες"
            />
          </Field>
          <Row>
            <Field>
              <Label htmlFor="cal-custom-date">Ημερομηνία *</Label>
              <Input
                id="cal-custom-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="cal-custom-time">Ώρα (προαιρετικά)</Label>
              <Input
                id="cal-custom-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </Row>

          <SectionTitle>Ορατότητα</SectionTitle>
          <Help>
            Αν δεν επιλέξετε ρόλους ή χρήστες, η προθεσμία θα είναι ορατή σε όλους.
            Μπορείτε να συνδυάσετε ρόλους και συγκεκριμένους χρήστες.
          </Help>
          {CUSTOM_VISIBILITY_ROLES.map((row) => (
            <CheckRow key={row.id}>
              <input
                type="checkbox"
                checked={row.id === 'ADMIN' ? roleAdmin : row.id === 'ENGINEER' ? roleEngineer : roleUser}
                onChange={(e) => {
                  if (row.id === 'ADMIN') setRoleAdmin(e.target.checked);
                  else if (row.id === 'ENGINEER') setRoleEngineer(e.target.checked);
                  else setRoleUser(e.target.checked);
                }}
              />
              {row.label}
            </CheckRow>
          ))}

          <Field style={{ marginTop: '0.65rem' }}>
            <Label htmlFor="cal-custom-user">Συγκεκριμένοι χρήστες</Label>
            <Row>
              <UserPick
                id="cal-custom-user"
                value={userPick}
                onChange={(e) => setUserPick(e.target.value)}
              >
                <option value="">— Επιλογή χρήστη —</option>
                {availableUsers.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.fullName || u.username} ({u.role})
                  </option>
                ))}
              </UserPick>
              <Btn type="button" onClick={addUser} disabled={!userPick}>Προσθήκη</Btn>
            </Row>
            {selectedUsernames.length > 0 && (
              <ChipWrap>
                {selectedUsernames.map((name) => {
                  const u = users.find((row) => row.username === name);
                  return (
                    <Chip
                      key={name}
                      type="button"
                      onClick={() => setSelectedUsernames((prev) => prev.filter((x) => x !== name))}
                      title="Αφαίρεση"
                    >
                      {u?.fullName || name} ×
                    </Chip>
                  );
                })}
              </ChipWrap>
            )}
          </Field>

          {error && <ErrorText>{error}</ErrorText>}

          <Footer>
            <div>
              {isEdit && (
                <Btn type="button" $danger onClick={handleDelete} disabled={saving}>
                  Διαγραφή
                </Btn>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn type="button" onClick={onClose} disabled={saving}>Άκυρο</Btn>
              <Btn type="button" $primary onClick={handleSave} disabled={saving}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </Btn>
            </div>
          </Footer>
        </Body>
      </Panel>
    </Overlay>
  );
}
