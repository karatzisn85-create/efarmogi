import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import emailCatalog from '../../app/core/emailCatalog';

const ipcRenderer = window.electronAPI;

/** Κανονικοποίηση Gmail: πλήρης διεύθυνση + καθαρισμός App Password */
function normalizeGmailUser(raw) {
  let u = String(raw || '').trim().toLowerCase();
  if (!u) return '';
  if (!u.includes('@')) u = `${u}@gmail.com`;
  return u;
}

function normalizeAppPassword(raw) {
  return String(raw || '').replace(/\s+/g, '').trim();
}

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
`;

const Panel = styled.div`
  background: white;
  border-radius: 12px;
  padding: 28px 32px;
  width: 480px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  color: #0f172a;
  font-weight: 700;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #64748b;
  padding: 4px 8px;
  border-radius: 6px;
  &:hover { background: #f1f5f9; }
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
`;

const FieldGroup = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 5px;
`;

const Input = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }
`;

const HelpText = styled.p`
  font-size: 12px;
  color: #6b7280;
  margin: 5px 0 0 0;
  line-height: 1.5;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 24px;
  flex-wrap: wrap;
`;

const PrimaryBtn = styled.button`
  padding: 10px 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  padding: 10px 18px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f9fafb; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const TestBtn = styled.button`
  padding: 10px 18px;
  border: 1.5px solid #6366f1;
  border-radius: 8px;
  background: white;
  color: #4f46e5;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: #eef2ff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Message = styled.div`
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 14px;
  background: ${p => p.$error ? '#fef2f2' : p.$warn ? '#fffbeb' : '#f0fdf4'};
  color: ${p => p.$error ? '#b91c1c' : p.$warn ? '#92400e' : '#166534'};
  border: 1px solid ${p => p.$error ? '#fecaca' : p.$warn ? '#fde68a' : '#bbf7d0'};
  line-height: 1.5;
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.$active ? '#22c55e' : '#d1d5db'};
  margin-right: 6px;
`;

const InfoBox = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  margin-bottom: 16px;
`;

function EmailSettingsModal({ onClose, currentUser }) {
  const [gmailUser, setGmailUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [fromName, setFromName] = useState('ergoHub');
  const [appPasswordSet, setAppPasswordSet] = useState(false);
  const [decryptFailed, setDecryptFailed] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const loadConfig = useCallback(async () => {
    const result = await ipcRenderer.invoke('get-email-config', {
      actingUsername: currentUser?.username,
    });
    if (result.success) {
      setGmailUser(result.config.gmail.user || '');
      setFromName(result.config.gmail.fromName || 'ergoHub');
      setAppPasswordSet(!!result.config.gmail.appPasswordSet);
      setDecryptFailed(!!result.config.gmail.decryptFailed);
      if (result.config.gmail.user) {
        setTestTo(result.config.gmail.user);
      }
    }
  }, [currentUser?.username]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    const check = emailCatalog.evaluateSaveEmailConfig({
      role: currentUser?.role,
      gmailUser,
      appPassword,
      appPasswordSet
    });
    if (!check.ok) {
      setMessage({ text: check.error, error: true });
      return;
    }
    const normalizedUser = check.gmailUser;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        actingUsername: currentUser?.username,
        user: normalizedUser,
        fromName: fromName.trim() || 'ergoHub'
      };
      if (appPassword) payload.appPassword = normalizeAppPassword(appPassword);
      const result = await ipcRenderer.invoke('save-email-config', payload);
      if (result.success) {
        setAppPassword('');
        setMessage({ text: 'Οι ρυθμίσεις αποθηκεύτηκαν', error: false });
        await loadConfig();
      } else {
        setMessage({ text: result.error, error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testTo.trim()) {
      setMessage({ text: 'Εισάγετε διεύθυνση email για δοκιμή', error: true });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const result = await ipcRenderer.invoke('test-email-config', {
        actingUsername: currentUser?.username,
        toAddress: testTo.trim(),
      });
      if (result.success) {
        setMessage({ text: `Δοκιμαστικό email στάλθηκε στο ${testTo}`, error: false });
      } else if (result.skipped) {
        setMessage({ text: `Δεν εστάλη: ${result.reason}`, warn: true });
      } else {
        setMessage({ text: `Αποτυχία: ${result.error}`, error: true });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel>
        <Header>
          <Title>&#9993; Ρυθμίσεις Email</Title>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>

        <InfoBox>
          Το σύστημα χρησιμοποιεί Gmail SMTP για αποστολή ειδοποιήσεων Χώρου Εργασίας.
          Ο δημιουργός κάθε χώρου ενεργοποιεί/απενεργοποιεί ανεξάρτητα τις ειδοποιήσεις.
        </InfoBox>

        <Section>
          <SectionTitle>Gmail Λογαριασμός Αποστολής</SectionTitle>

          <FieldGroup>
            <Label>Gmail διεύθυνση</Label>
            <Input
              type="email"
              data-testid="email-gmail"
              value={gmailUser}
              onChange={e => setGmailUser(e.target.value)}
              onBlur={() => {
                const n = normalizeGmailUser(gmailUser);
                if (n && n !== gmailUser.trim().toLowerCase()) setGmailUser(n);
              }}
              placeholder="π.χ. ergohubapp@gmail.com"
            />
            <HelpText>Πλήρης διεύθυνση Gmail — όχι μόνο το όνομα χρήστη.</HelpText>
          </FieldGroup>

          <FieldGroup>
            <Label>
              App Password
              {appPasswordSet && (
                <span data-testid="email-password-set" style={{ marginLeft: 8, fontWeight: 400, color: '#16a34a' }}>
                  <StatusDot $active /> Ρυθμισμένο
                </span>
              )}
            </Label>
            <Input
              type="password"
              data-testid="email-password"
              value={appPassword}
              onChange={e => setAppPassword(e.target.value)}
              placeholder={appPasswordSet ? '(κενό = χωρίς αλλαγή)' : 'Εισάγετε Google App Password'}
            />
            <HelpText>
              Google Account → Ασφάλεια → 2-Step Verification → App Passwords.
              Δημιουργήστε password για "Mail" και επικολλήστε το εδώ.
            </HelpText>
            {decryptFailed && (
              <HelpText style={{ color: '#b45309', marginTop: 6 }}>
                Ο αποθηκευμένος κωδικός δεν ανοίγει σε αυτόν τον υπολογιστή (π.χ. αντιγραφή φακέλου δεδομένων).
                Ξαναεισάγετέ τον εδώ και αποθηκεύστε.
              </HelpText>
            )}
          </FieldGroup>

          <FieldGroup>
            <Label>Όνομα αποστολέα</Label>
            <Input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder="π.χ. ergoHub"
            />
          </FieldGroup>
        </Section>

        <Section>
          <SectionTitle>Δοκιμαστικό Email</SectionTitle>
          <FieldGroup>
            <Label>Αποστολή στο</Label>
            <Input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="email@example.com"
            />
          </FieldGroup>
        </Section>

        {message && (
          <Message data-testid="email-error" $error={message.error} $warn={message.warn}>{message.text}</Message>
        )}

        <BtnRow>
          <PrimaryBtn data-testid="btn-email-save" onClick={handleSave} disabled={saving || testing}>
            {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </PrimaryBtn>
          <TestBtn data-testid="btn-email-test" onClick={handleTest} disabled={saving || testing || !appPasswordSet}>
            {testing ? 'Αποστολή...' : 'Δοκιμαστικό email'}
          </TestBtn>
          <SecondaryBtn onClick={onClose} disabled={saving || testing}>
            Κλείσιμο
          </SecondaryBtn>
        </BtnRow>
      </Panel>
    </Overlay>
  );
}

export default EmailSettingsModal;
