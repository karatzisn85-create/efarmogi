import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { emptyTaskAssignmentPerms } from '../utils/taskAssignmentDisplay';
import { safeConfirm } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';
import { formatDateEl } from '../utils/dateFormat';
import userCatalog from '../../app/core/userCatalog';
import orimanthiCatalog from '../../app/core/orimanthiCatalog';
import meletaiCatalog from '../../app/core/meletaiCatalog';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9000;
`;

const Panel = styled.div`
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 800px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  margin: 0;
  color: #1a2a3a;
  font-size: 22px;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 8px;
  &:hover { background: #f0f0f0; color: #333; }
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  color: #555;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PendingBadge = styled.span`
  display: inline-block;
  background: #ff9800;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  
  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #eee;
    font-size: 14px;
  }
  
  th {
    background: #f5f5f5;
    font-weight: 600;
    color: #555;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const PendingTable = styled(Table)`
  th { background: #fff8e1; }
`;

const RoleBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: ${p => p.role === 'SUPERADMIN'
    ? '#e8eaf6'
    : p.role === 'ADMIN'
      ? '#e3f2fd'
      : p.role === 'ENGINEER'
        ? '#fff3e0'
        : '#e8f5e9'};
  color: ${p => p.role === 'SUPERADMIN'
    ? '#283593'
    : p.role === 'ADMIN'
      ? '#1565c0'
      : p.role === 'ENGINEER'
        ? '#ef6c00'
        : '#2e7d32'};
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${p => p.$online ? '#22c55e' : p.$active ? '#d1d5db' : '#ef4444'};
  margin-right: 6px;
  box-shadow: ${p => p.$online ? '0 0 6px rgba(34,197,94,0.6)' : 'none'};
  transition: all 0.3s;
`;

const StatusLabel = styled.span`
  font-size: 0.82rem;
  font-weight: ${p => p.$online ? 600 : 400};
  color: ${p => p.$online ? '#16a34a' : p.$active ? '#6b7280' : '#dc2626'};
`;

const ActionBtn = styled.button`
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 4px;
  font-family: inherit;
  transition: all 0.15s;
  
  &:hover { background: #f5f5f5; border-color: #bbb; }
  &.danger:hover { background: #ffeaea; border-color: #ef9a9a; color: #c62828; }
  &.approve { border-color: #4caf50; color: #2e7d32; }
  &.approve:hover { background: #e8f5e9; }
  &.reject { border-color: #ef5350; color: #c62828; }
  &.reject:hover { background: #ffeaea; }
`;

const FormSection = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-top: 8px;
`;

const FormTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

const FormTitle = styled.h3`
  margin: 0;
  color: #333;
  font-size: 16px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  &:focus { border-color: #2c3e50; outline: none; }
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  &:focus { border-color: #2c3e50; outline: none; }
`;

const BtnRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const PrimaryBtn = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  padding: 10px 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #f5f5f5; }
`;

const Message = styled.div`
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 12px;
  background: ${p => p.error ? '#ffeaea' : '#e8f5e9'};
  color: ${p => p.error ? '#c62828' : '#2e7d32'};
  border: 1px solid ${p => p.error ? '#ffcdd2' : '#c8e6c9'};
`;

const EmptyRow = styled.tr`
  td { color: #999; font-style: italic; text-align: center !important; }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  margin-bottom: 8px;
`;

const UserPickList = styled.div`
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  margin-top: 8px;
  background: #fff;
`;

const TaskPermSection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #ddd;
`;

const ROLE_LABELS = {
  SUPERADMIN: 'Υπερδιαχειριστής',
  ADMIN: 'Διαχειριστής',
  USER: 'Χρήστης',
  ENGINEER: 'Μηχανικός'
};

const SelfSection = styled.div`
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
  border: 1.5px solid #c7d2fe;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 28px;
`;

const SelfSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
`;

const SelfSectionTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #4338ca;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ToggleChevron = styled.span`
  font-size: 13px;
  color: #6366f1;
  transition: transform 0.2s;
  transform: ${p => p.$open ? 'rotate(90deg)' : 'rotate(0deg)'};
  display: inline-block;
`;

const SelfSectionBody = styled.div`
  margin-top: 18px;
`;

const SelfHint = styled.p`
  margin: 0 0 14px;
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.5;
`;

const PasswordNote = styled.p`
  margin: 4px 0 10px;
  font-size: 11.5px;
  color: #6366f1;
  font-style: italic;
`;

const createEmptyFormData = () => ({
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 'USER',
  taskAssignment: emptyTaskAssignmentPerms(),
  orimanthiCanEdit: false,
  meletaiCanEdit: false,
});

function UserManagement({ onClose, currentUser, onUsersChanged, onSyncCurrentUser }) {
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const actingUsername = currentUser?.username || '';
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [message, setMessage] = useState(null);
  const postSuccessTimerRef = useRef(null);

  // Self-edit state (SUPERADMIN only)
  const [selfOpen, setSelfOpen] = useState(false);
  const [selfData, setSelfData] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [selfMsg, setSelfMsg] = useState(null);
  const [selfSaving, setSelfSaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await ipcRenderer.invoke('get-online-users');
        if (!cancelled && res.success) setOnlineUsers(res.onlineUsers || []);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const loadUsers = useCallback(async () => {
    const result = await ipcRenderer.invoke('get-users');
    setUsers(result);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const clearPostSuccessTimer = useCallback(() => {
    if (postSuccessTimerRef.current) {
      clearTimeout(postSuccessTimerRef.current);
      postSuccessTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPostSuccessTimer(), [clearPostSuccessTimer]);

  const { pending: pendingUsers, approved: approvedUsers } = userCatalog.partitionUsersByApproval(users);

  const openCreateForm = () => {
    clearPostSuccessTimer();
    setEditingUser(null);
    setFormData(createEmptyFormData());
    setMessage(null);
    setShowForm(true);
  };

  const resetForm = () => {
    clearPostSuccessTimer();
    setFormData(createEmptyFormData());
    setEditingUser(null);
    setShowForm(false);
    setMessage(null);
  };

  const scheduleCloseAfterSuccess = () => {
    clearPostSuccessTimer();
    postSuccessTimerRef.current = setTimeout(() => {
      postSuccessTimerRef.current = null;
      resetForm();
    }, 1200);
  };

  const assignableUserOptions = users.filter(
    (u) => u.approved && u.active && u.username !== formData.username
  );

  const toggleAssignableUsername = (username) => {
    setFormData((f) => {
      const list = f.taskAssignment.assignableUsernames || [];
      const next = list.includes(username)
        ? list.filter((x) => x !== username)
        : [...list, username];
      return {
        ...f,
        taskAssignment: { ...f.taskAssignment, assignableUsernames: next }
      };
    });
  };

  const handleSubmit = async () => {
    setMessage(null);

    const formErrors = userCatalog.collectCreateUserRequiredErrors(formData, { isEdit: !!editingUser });
    const firstError = userCatalog.firstCreateUserError(formErrors);
    if (firstError) {
      setMessage({ text: firstError, error: true });
      return;
    }

    if (editingUser) {
      const updates = {
        fullName: formData.fullName,
        email: formData.email.trim() || null,
        role: formData.role,
        assignedSupervisors: []
      };
      if (formData.password) updates.password = formData.password;
      if (isSuperAdmin) {
        updates.taskAssignment = formData.taskAssignment;
        if (formData.role === 'USER' || formData.role === 'ENGINEER') {
          updates.orimanthiCanEdit = !!formData.orimanthiCanEdit;
          updates.meletaiCanEdit = !!formData.meletaiCanEdit;
        } else {
          updates.orimanthiCanEdit = false;
          updates.meletaiCanEdit = false;
        }
      }
      const result = await ipcRenderer.invoke('update-user', {
        username: editingUser,
        updates,
        actingUsername
      });
      if (result.success) {
        setMessage({ text: 'Ο χρήστης ενημερώθηκε', error: false });
        await loadUsers();
        if (onUsersChanged) onUsersChanged();
        if (onSyncCurrentUser) onSyncCurrentUser();
        scheduleCloseAfterSuccess();
      } else {
        setMessage({ text: result.error, error: true });
      }
    } else {
      const createPayload = {
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        fullName: formData.fullName.trim() || formData.username.trim(),
        email: formData.email.trim() || null,
        assignedSupervisors: [],
        actingUsername
      };
      if (isSuperAdmin) {
        createPayload.taskAssignment = formData.taskAssignment;
        if (formData.role === 'USER' || formData.role === 'ENGINEER') {
          createPayload.orimanthiCanEdit = !!formData.orimanthiCanEdit;
          createPayload.meletaiCanEdit = !!formData.meletaiCanEdit;
        }
      }
      const result = await ipcRenderer.invoke('create-user', createPayload);

      if (result.success) {
        setMessage({ text: 'Ο χρήστης δημιουργήθηκε', error: false });
        await loadUsers();
        if (onUsersChanged) onUsersChanged();
        scheduleCloseAfterSuccess();
      } else {
        setMessage({ text: result.error, error: true });
      }
    }
  };

  const handleEdit = (user) => {
    clearPostSuccessTimer();
    setFormData({
      username: user.username,
      password: '',
      fullName: user.fullName,
      email: user.email || '',
      role: user.role,
      taskAssignment: user.taskAssignment
        ? { ...emptyTaskAssignmentPerms(), ...user.taskAssignment }
        : emptyTaskAssignmentPerms(),
      orimanthiCanEdit: !!user.orimanthiCanEdit,
      meletaiCanEdit: !!user.meletaiCanEdit,
    });
    setEditingUser(user.username);
    setShowForm(true);
    setMessage(null);
  };

  const handleToggleActive = async (user) => {
    await ipcRenderer.invoke('update-user', {
      username: user.username,
      updates: { active: !user.active },
      actingUsername
    });
    await loadUsers();
    if (onUsersChanged) onUsersChanged();
  };

  const handleApprove = async (user) => {
    await ipcRenderer.invoke('update-user', {
      username: user.username,
      updates: { approved: true },
      actingUsername
    });
    await loadUsers();
    if (onUsersChanged) onUsersChanged();
  };

  const handleReject = async (user) => {
    if (!await showConfirm({ title: 'Απόρριψη Αιτήματος', message: `Απόρριψη και διαγραφή αιτήματος του χρήστη "${user.username}";`, confirmLabel: 'Απόρριψη', icon: '🗑' })) return;
    await ipcRenderer.invoke('delete-user', { username: user.username, actingUsername });
    await loadUsers();
    if (onUsersChanged) onUsersChanged();
  };

  const handleDelete = async (user) => {
    if (!await showConfirm({ title: 'Διαγραφή Χρήστη', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη "${user.username}";`, detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) return;
    const result = await ipcRenderer.invoke('delete-user', { username: user.username, actingUsername });
    if (result.success) {
      await loadUsers();
      if (onUsersChanged) onUsersChanged();
    } else {
      setMessage({ text: result.error, error: true });
    }
  };

  // ── Self-edit (superadmin) ────────────────────────────────────────────────

  const handleSelfSave = async () => {
    setSelfMsg(null);
    const wantsPasswordChange = selfData.newPassword.trim().length > 0;
    const wantsUsernameChange = selfData.newUsername.trim().length > 0;
    const needsCurrentPassword = wantsPasswordChange || wantsUsernameChange;

    if (needsCurrentPassword && !selfData.currentPassword) {
      setSelfMsg({ text: 'Εισάγετε τον τρέχοντα κωδικό για αλλαγή username ή κωδικού', error: true });
      return;
    }
    if (wantsPasswordChange) {
      if (selfData.newPassword.length < 8) {
        setSelfMsg({ text: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες', error: true });
        return;
      }
      if (selfData.newPassword !== selfData.confirmPassword) {
        setSelfMsg({ text: 'Ο νέος κωδικός και η επιβεβαίωση δεν ταιριάζουν', error: true });
        return;
      }
    }

    setSelfSaving(true);
    try {
      // 1. fullName + email
      const infoResult = await ipcRenderer.invoke('update-user', {
        username: actingUsername,
        updates: {
          fullName: selfData.fullName.trim() || actingUsername,
          email: selfData.email.trim() || null
        },
        actingUsername
      });
      if (!infoResult.success) {
        setSelfMsg({ text: infoResult.error || 'Σφάλμα ενημέρωσης', error: true });
        return;
      }

      // 2. Password change
      if (wantsPasswordChange) {
        const pwResult = await ipcRenderer.invoke('change-password', {
          username: actingUsername,
          oldPassword: selfData.currentPassword,
          newPassword: selfData.newPassword
        });
        if (!pwResult.success) {
          setSelfMsg({ text: pwResult.error || 'Σφάλμα αλλαγής κωδικού', error: true });
          return;
        }
      }

      // 3. Username change (last — affects session)
      if (wantsUsernameChange) {
        const unResult = await ipcRenderer.invoke('rename-user', {
          username: actingUsername,
          currentPassword: selfData.currentPassword,
          newUsername: selfData.newUsername.trim()
        });
        if (!unResult.success) {
          setSelfMsg({ text: unResult.error || 'Σφάλμα αλλαγής username', error: true });
          return;
        }
      }

      await loadUsers();
      if (onUsersChanged) onUsersChanged();
      if (onSyncCurrentUser) onSyncCurrentUser();

      setSelfData(p => ({
        ...p,
        newUsername: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

      const note = wantsUsernameChange
        ? 'Αποθηκεύτηκε. Το username άλλαξε — θα χρειαστεί επανεκκίνηση ή νέα σύνδεση.'
        : 'Τα στοιχεία σας αποθηκεύτηκαν επιτυχώς.';
      setSelfMsg({ text: note, error: false });
    } finally {
      setSelfSaving(false);
    }
  };

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel>
        <Header>
          <Title>Διαχείριση Χρηστών</Title>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>

        {/* ── Ο Λογαριασμός μου (μόνο SUPERADMIN) ── */}
        {isSuperAdmin && (
          <SelfSection>
            <SelfSectionHeader onClick={() => setSelfOpen(o => !o)}>
              <SelfSectionTitle>
                👤 Ο Λογαριασμός μου
              </SelfSectionTitle>
              <ToggleChevron $open={selfOpen}>▶</ToggleChevron>
            </SelfSectionHeader>

            {selfOpen && (
              <SelfSectionBody>
                <SelfHint>
                  Επεξεργαστείτε τα στοιχεία του λογαριασμού σας. Για αλλαγή <strong>κωδικού</strong> ή <strong>username</strong> απαιτείται ο τρέχων κωδικός.
                </SelfHint>

                <FormRow>
                  <FieldGroup>
                    <Label>Ονοματεπώνυμο</Label>
                    <Input
                      value={selfData.fullName}
                      onChange={e => setSelfData(p => ({ ...p, fullName: e.target.value }))}
                      placeholder="Ονοματεπώνυμο"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label>Email <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(προαιρετικό)</span></Label>
                    <Input
                      type="email"
                      value={selfData.email}
                      onChange={e => setSelfData(p => ({ ...p, email: e.target.value }))}
                      placeholder="π.χ. user@example.com"
                    />
                  </FieldGroup>
                </FormRow>

                <FormRow>
                  <FieldGroup>
                    <Label>Νέο username <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(κενό = χωρίς αλλαγή)</span></Label>
                    <Input
                      value={selfData.newUsername}
                      onChange={e => setSelfData(p => ({ ...p, newUsername: e.target.value }))}
                      placeholder={`τρέχον: ${actingUsername}`}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label>Τρέχων κωδικός <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(για αλλαγή username/κωδικού)</span></Label>
                    <Input
                      type="password"
                      value={selfData.currentPassword}
                      onChange={e => setSelfData(p => ({ ...p, currentPassword: e.target.value }))}
                      placeholder="Εισάγετε τρέχοντα κωδικό"
                    />
                  </FieldGroup>
                </FormRow>

                <FormRow>
                  <FieldGroup>
                    <Label>Νέος κωδικός <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(κενό = χωρίς αλλαγή)</span></Label>
                    <Input
                      type="password"
                      value={selfData.newPassword}
                      onChange={e => setSelfData(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Τουλάχιστον 4 χαρακτήρες"
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Label>Επιβεβαίωση νέου κωδικού</Label>
                    <Input
                      type="password"
                      value={selfData.confirmPassword}
                      onChange={e => setSelfData(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Επαναλάβετε νέο κωδικό"
                    />
                  </FieldGroup>
                </FormRow>

                {selfMsg && <Message error={selfMsg.error}>{selfMsg.text}</Message>}

                <BtnRow>
                  <PrimaryBtn onClick={handleSelfSave} disabled={selfSaving}>
                    {selfSaving ? 'Αποθήκευση…' : '💾 Αποθήκευση στοιχείων'}
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => {
                    setSelfOpen(false);
                    setSelfMsg(null);
                  }}>Ακύρωση</SecondaryBtn>
                </BtnRow>
              </SelfSectionBody>
            )}
          </SelfSection>
        )}

        {pendingUsers.length > 0 && (
          <>
            <SectionTitle>
              Αιτήματα Εγγραφής <PendingBadge>{pendingUsers.length}</PendingBadge>
            </SectionTitle>
            <PendingTable>
              <thead>
                <tr>
                  <th>Χρήστης</th>
                  <th>Ονοματεπώνυμο</th>
                  <th>Ρόλος</th>
                  <th>Ημ. Αίτησης</th>
                  <th>Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(u => (
                  <tr key={u.username}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.fullName}</td>
                    <td><RoleBadge role={u.role}>{ROLE_LABELS[u.role] || u.role}</RoleBadge></td>
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {u.createdAt ? formatDateEl(u.createdAt, '-') : '-'}
                    </td>
                    <td>
                      <ActionBtn className="approve" onClick={() => handleApprove(u)}>Έγκριση</ActionBtn>
                      <ActionBtn className="reject" onClick={() => handleReject(u)}>Απόρριψη</ActionBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PendingTable>
          </>
        )}

        <SectionTitle>Ενεργοί Χρήστες</SectionTitle>
        <Table>
          <thead>
            <tr>
              <th>Σύνδεση</th>
              <th>Χρήστης</th>
              <th>Ονοματεπώνυμο</th>
              <th>Email</th>
              <th>Ρόλος</th>
              <th>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {approvedUsers.length === 0 ? (
              <EmptyRow><td colSpan="6">Δεν υπάρχουν εγκεκριμένοι χρήστες</td></EmptyRow>
            ) : (
              approvedUsers.map(u => (
                <tr key={u.username}>
                  <td>
                    <StatusDot $online={onlineUsers.includes(u.username)} $active={u.active} />
                    <StatusLabel $online={onlineUsers.includes(u.username)} $active={u.active}>
                      {!u.active ? 'Ανενεργός' : onlineUsers.includes(u.username) ? 'Online' : 'Offline'}
                    </StatusLabel>
                  </td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.fullName}</td>
                  <td style={{ fontSize: 12, color: u.email ? '#2563eb' : '#94a3b8' }}>{u.email || '—'}</td>
                  <td><RoleBadge role={u.role}>{ROLE_LABELS[u.role] || u.role}</RoleBadge></td>
                  <td>
                    {userCatalog.showUserEditAction(u) && (
                      <ActionBtn onClick={() => handleEdit(u)}>Επεξεργασία</ActionBtn>
                    )}
                    {userCatalog.showUserDeleteAction(currentUser.username, u) && (
                      <>
                        <ActionBtn onClick={() => handleToggleActive(u)}>
                          {u.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                        </ActionBtn>
                        <ActionBtn className="danger" onClick={() => handleDelete(u)}>Διαγραφή</ActionBtn>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        {!showForm ? (
          <PrimaryBtn onClick={openCreateForm}>
            + Νέος Χρήστης
          </PrimaryBtn>
        ) : (
          <FormSection key={editingUser || 'create'}>
            <FormTitleRow>
              <FormTitle>{editingUser ? `Επεξεργασία: ${editingUser}` : 'Νέος Χρήστης'}</FormTitle>
              {editingUser ? (
                <SecondaryBtn type="button" onClick={openCreateForm} style={{ padding: '6px 12px', fontSize: 12 }}>
                  + Νέος χρήστης
                </SecondaryBtn>
              ) : null}
            </FormTitleRow>
            
            <FormRow>
              <FieldGroup>
                <Label>Όνομα χρήστη</Label>
                <Input
                  value={formData.username}
                  onChange={e => setFormData(f => ({ ...f, username: e.target.value }))}
                  disabled={!!editingUser}
                  placeholder="π.χ. admin"
                />
              </FieldGroup>
              <FieldGroup>
                <Label>Ονοματεπώνυμο</Label>
                <Input
                  value={formData.fullName}
                  onChange={e => setFormData(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="π.χ. Γιάννης Παπαδόπουλος"
                />
              </FieldGroup>
            </FormRow>

            <FormRow>
              <FieldGroup>
                <Label>{editingUser ? 'Νέος κωδικός (κενό = χωρίς αλλαγή)' : 'Κωδικός'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? '(χωρίς αλλαγή)' : 'Τουλάχιστον 4 χαρακτήρες'}
                />
              </FieldGroup>
              <FieldGroup>
                <Label>Email <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>(προαιρετικό)</span></Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  placeholder="π.χ. user@example.com"
                />
              </FieldGroup>
            </FormRow>

            <FormRow>
              <FieldGroup>
                <Label>Ρόλος</Label>
                <Select
                  value={formData.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setFormData((f) => ({
                      ...f,
                      role,
                      orimanthiCanEdit: orimanthiCatalog.orimanthiEditEligibleRole(role) ? f.orimanthiCanEdit : false,
                      meletaiCanEdit: meletaiCatalog.meletaiEditEligibleRole(role) ? f.meletaiCanEdit : false,
                    }));
                  }}
                >
                  <option value="USER">Χρήστης</option>
                  <option value="ADMIN">Διαχειριστής</option>
                  <option value="ENGINEER">Μηχανικός</option>
                </Select>
              </FieldGroup>
            </FormRow>

            {isSuperAdmin && orimanthiCatalog.orimanthiEditEligibleRole(formData.role) && (
              <TaskPermSection>
                <SectionTitle>Ωρίμανση Έργων</SectionTitle>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={!!formData.orimanthiCanEdit}
                    onChange={(e) => setFormData((f) => ({ ...f, orimanthiCanEdit: e.target.checked }))}
                  />
                  Δικαίωμα επεξεργασίας (viewer / μηχανικός — μόνο στο module Ωρίμανση Έργων)
                </CheckboxRow>
              </TaskPermSection>
            )}

            {isSuperAdmin && meletaiCatalog.meletaiEditEligibleRole(formData.role) && (
              <TaskPermSection>
                <SectionTitle>Μητρώο Μελετών</SectionTitle>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={!!formData.meletaiCanEdit}
                    onChange={(e) => setFormData((f) => ({ ...f, meletaiCanEdit: e.target.checked }))}
                  />
                  Δικαίωμα επεξεργασίας (viewer / μηχανικός — μόνο στο Μητρώο Μελετών)
                </CheckboxRow>
              </TaskPermSection>
            )}

            {isSuperAdmin && (
              <TaskPermSection>
                <SectionTitle>Χώρος Εργασίας</SectionTitle>
                <CheckboxRow>
                  <input
                    type="checkbox"
                    checked={!!formData.taskAssignment.canAssign}
                    onChange={(e) => {
                      const canAssign = e.target.checked;
                      setFormData((f) => ({
                        ...f,
                        taskAssignment: {
                          ...f.taskAssignment,
                          canAssign,
                          assignableScope: canAssign ? (f.taskAssignment.assignableScope === 'none' ? 'all' : f.taskAssignment.assignableScope) : 'none'
                        }
                      }));
                    }}
                  />
                  Μπορεί να δημιουργεί χώρους εργασίας
                </CheckboxRow>
                {formData.taskAssignment.canAssign && (
                  <>
                    <FieldGroup>
                      <Label>Εύρος συναδέλφων</Label>
                      <Select
                        value={formData.taskAssignment.assignableScope}
                        onChange={(e) => {
                          const assignableScope = e.target.value;
                          setFormData((f) => ({
                            ...f,
                            taskAssignment: {
                              ...f.taskAssignment,
                              assignableScope,
                              assignableUsernames: assignableScope === 'selected' ? (f.taskAssignment.assignableUsernames || []) : []
                            }
                          }));
                        }}
                      >
                        <option value="all">Όλοι οι ενεργοί χρήστες</option>
                        <option value="selected">Επιλεγμένοι χρήστες</option>
                      </Select>
                    </FieldGroup>
                    {formData.taskAssignment.assignableScope === 'selected' && (
                      <UserPickList>
                        {assignableUserOptions.length === 0 ? (
                          <span style={{ color: '#888', fontSize: 13 }}>Δεν υπάρχουν διαθέσιμοι χρήστες</span>
                        ) : (
                          assignableUserOptions.map((u) => (
                            <CheckboxRow key={u.username}>
                              <input
                                type="checkbox"
                                checked={(formData.taskAssignment.assignableUsernames || []).includes(u.username)}
                                onChange={() => toggleAssignableUsername(u.username)}
                              />
                              {u.fullName} ({u.username})
                            </CheckboxRow>
                          ))
                        )}
                      </UserPickList>
                    )}
                  </>
                )}
              </TaskPermSection>
            )}

            {message && <Message error={message.error}>{message.text}</Message>}

            <BtnRow>
              <PrimaryBtn onClick={handleSubmit}>
                {editingUser ? 'Αποθήκευση' : 'Δημιουργία'}
              </PrimaryBtn>
              <SecondaryBtn onClick={resetForm}>Ακύρωση</SecondaryBtn>
            </BtnRow>
          </FormSection>
        )}
      </Panel>
    </Overlay>
  );
}

export default UserManagement;
