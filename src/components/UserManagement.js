import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

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
  background: ${p => p.role === 'SUPERADMIN' ? '#e8eaf6' : p.role === 'ADMIN' ? '#e3f2fd' : '#e8f5e9'};
  color: ${p => p.role === 'SUPERADMIN' ? '#283593' : p.role === 'ADMIN' ? '#1565c0' : '#2e7d32'};
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.active ? '#4caf50' : '#ccc'};
  margin-right: 6px;
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

const FormTitle = styled.h3`
  margin: 0 0 16px 0;
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

const ROLE_LABELS = {
  SUPERADMIN: 'Υπερδιαχειριστής',
  ADMIN: 'Διαχειριστής',
  USER: 'Χρήστης'
};

function UserManagement({ onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', fullName: '', role: 'USER' });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const loadUsers = useCallback(async () => {
    const result = await ipcRenderer.invoke('get-users');
    setUsers(result);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const pendingUsers = users.filter(u => !u.approved);
  const approvedUsers = users.filter(u => u.approved);

  const resetForm = () => {
    setFormData({ username: '', password: '', fullName: '', role: 'USER' });
    setEditingUser(null);
    setShowForm(false);
    setMessage(null);
  };

  const handleSubmit = async () => {
    setMessage(null);

    if (editingUser) {
      const updates = { fullName: formData.fullName, role: formData.role };
      if (formData.password) updates.password = formData.password;
      const result = await ipcRenderer.invoke('update-user', { username: editingUser, updates });
      if (result.success) {
        setMessage({ text: 'Ο χρήστης ενημερώθηκε', error: false });
        loadUsers();
        setTimeout(resetForm, 1200);
      } else {
        setMessage({ text: result.error, error: true });
      }
    } else {
      if (!formData.username.trim()) { setMessage({ text: 'Εισάγετε όνομα χρήστη', error: true }); return; }
      if (!formData.password || formData.password.length < 4) { setMessage({ text: 'Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες', error: true }); return; }

      const result = await ipcRenderer.invoke('create-user', {
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        fullName: formData.fullName.trim() || formData.username.trim()
      });

      if (result.success) {
        setMessage({ text: 'Ο χρήστης δημιουργήθηκε', error: false });
        loadUsers();
        setTimeout(resetForm, 1200);
      } else {
        setMessage({ text: result.error, error: true });
      }
    }
  };

  const handleEdit = (user) => {
    setFormData({ username: user.username, password: '', fullName: user.fullName, role: user.role });
    setEditingUser(user.username);
    setShowForm(true);
    setMessage(null);
  };

  const handleToggleActive = async (user) => {
    await ipcRenderer.invoke('update-user', {
      username: user.username,
      updates: { active: !user.active }
    });
    loadUsers();
  };

  const handleApprove = async (user) => {
    await ipcRenderer.invoke('update-user', {
      username: user.username,
      updates: { approved: true }
    });
    loadUsers();
  };

  const handleReject = async (user) => {
    if (!window.confirm(`Απόρριψη και διαγραφή αιτήματος του "${user.username}";`)) return;
    await ipcRenderer.invoke('delete-user', { username: user.username });
    loadUsers();
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Διαγραφή χρήστη "${user.username}";`)) return;
    const result = await ipcRenderer.invoke('delete-user', { username: user.username });
    if (result.success) {
      loadUsers();
    } else {
      setMessage({ text: result.error, error: true });
    }
  };

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel>
        <Header>
          <Title>Διαχείριση Χρηστών</Title>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>

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
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('el-GR') : '-'}
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
              <th>Κατάσταση</th>
              <th>Χρήστης</th>
              <th>Ονοματεπώνυμο</th>
              <th>Ρόλος</th>
              <th>Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {approvedUsers.length === 0 ? (
              <EmptyRow><td colSpan="5">Δεν υπάρχουν εγκεκριμένοι χρήστες</td></EmptyRow>
            ) : (
              approvedUsers.map(u => (
                <tr key={u.username}>
                  <td><StatusDot active={u.active} />{u.active ? 'Ενεργός' : 'Ανενεργός'}</td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.fullName}</td>
                  <td><RoleBadge role={u.role}>{ROLE_LABELS[u.role] || u.role}</RoleBadge></td>
                  <td>
                    {u.role !== 'SUPERADMIN' && (
                      <ActionBtn onClick={() => handleEdit(u)}>Επεξεργασία</ActionBtn>
                    )}
                    {u.username !== currentUser.username && u.role !== 'SUPERADMIN' && (
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
          <PrimaryBtn onClick={() => { resetForm(); setShowForm(true); }}>
            + Νέος Χρήστης
          </PrimaryBtn>
        ) : (
          <FormSection>
            <FormTitle>{editingUser ? `Επεξεργασία: ${editingUser}` : 'Νέος Χρήστης'}</FormTitle>
            
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
                <Label>Ρόλος</Label>
                <Select value={formData.role} onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}>
                  <option value="USER">Χρήστης</option>
                  <option value="ADMIN">Διαχειριστής</option>
                </Select>
              </FieldGroup>
            </FormRow>

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
