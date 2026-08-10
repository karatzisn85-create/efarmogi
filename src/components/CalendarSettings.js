import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_LABELS,
} from '../utils/procurementCalendarEvents';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
`;

const Panel = styled.div`
  background: white;
  border-radius: 12px;
  padding: 28px 32px;
  width: 640px;
  max-width: 96vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
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

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  input { width: 16px; height: 16px; cursor: pointer; }
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
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  background: white;
`;

const HelpText = styled.p`
  font-size: 12px;
  color: #6b7280;
  margin: 5px 0 0 0;
  line-height: 1.5;
`;

const UserList = styled.div`
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  background: #f8fafc;
`;

const TypeCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: ${(p) => (p.$enabled ? '#f8fafc' : '#fafafa')};
  opacity: ${(p) => (p.$enabled ? 1 : 0.72)};
`;

const TypeCardBody = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
`;

const TypeCardRoles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-bottom: 10px;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 24px;
  flex-wrap: wrap;
`;

const PrimaryBtn = styled.button`
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: white;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  &:hover { background: #4f46e5; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  padding: 10px 18px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  &:hover { background: #f8fafc; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const StatusMsg = styled.div`
  margin-top: 12px;
  font-size: 13px;
  color: ${(p) => (p.$error ? '#dc2626' : '#059669')};
`;

const REMINDER_EVENT_TYPES = [
  CALENDAR_EVENT_TYPES.DEADLINE,
  CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
  CALENDAR_EVENT_TYPES.CONTRACT_END,
  CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
  CALENDAR_EVENT_TYPES.CUSTOM,
  CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
];

function makeDefaultTypeSetting() {
  return {
    enabled: true,
    recipientRoles: ['ADMIN', 'ENGINEER'],
    recipientUsernames: [],
  };
}

function buildDefaultEventTypeSettings() {
  const out = {};
  REMINDER_EVENT_TYPES.forEach((type) => {
    out[type] = makeDefaultTypeSetting();
  });
  return out;
}

function loadEventTypeSettingsFromConfig(cfg = {}) {
  const legacyRoles = Array.isArray(cfg.recipientRoles) && cfg.recipientRoles.length
    ? cfg.recipientRoles
    : ['ADMIN', 'ENGINEER'];
  const legacyUsers = Array.isArray(cfg.recipientUsernames) ? cfg.recipientUsernames : [];
  const legacyEnabled = Array.isArray(cfg.notifyEventTypes)
    ? cfg.notifyEventTypes.filter((t) => REMINDER_EVENT_TYPES.includes(t))
    : [...REMINDER_EVENT_TYPES];
  const enabledSet = new Set(legacyEnabled.length ? legacyEnabled : REMINDER_EVENT_TYPES);
  const src = cfg.eventTypeSettings && typeof cfg.eventTypeSettings === 'object'
    ? cfg.eventTypeSettings
    : null;
  const out = {};
  REMINDER_EVENT_TYPES.forEach((type) => {
    const row = src?.[type];
    if (row && typeof row === 'object') {
      const roles = Array.isArray(row.recipientRoles)
        ? row.recipientRoles.filter((r) => ['ADMIN', 'ENGINEER', 'USER'].includes(r))
        : [];
      out[type] = {
        enabled: row.enabled !== false,
        recipientRoles: roles.length ? roles : (Array.isArray(row.recipientUsernames) && row.recipientUsernames.length ? [] : ['ADMIN']),
        recipientUsernames: Array.isArray(row.recipientUsernames)
          ? row.recipientUsernames.map((u) => String(u).toLowerCase())
          : [],
      };
    } else {
      out[type] = {
        enabled: enabledSet.has(type),
        recipientRoles: [...legacyRoles],
        recipientUsernames: [...legacyUsers],
      };
    }
  });
  return out;
}

const DAY_OPTIONS = [
  { value: 180, label: '6 μήνες πριν' },
  { value: 90, label: '3 μήνες πριν' },
  { value: 30, label: '1 μήνα πριν' },
  { value: 15, label: '15 μέρες πριν' },
  { value: 7, label: '7 ημέρες πριν' },
  { value: 3, label: '3 ημέρες πριν' },
  { value: 1, label: '1 ημέρα πριν' },
  { value: 0, label: 'Ημέρα καταληκτικής (σήμερα)' },
];

export default function CalendarSettings({ onClose, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [users, setUsers] = useState([]);

  const [enabled, setEnabled] = useState(false);
  const [eventTypeSettings, setEventTypeSettings] = useState(buildDefaultEventTypeSettings);
  const [days180, setDays180] = useState(false);
  const [days90, setDays90] = useState(false);
  const [days30, setDays30] = useState(false);
  const [days15, setDays15] = useState(false);
  const [days7, setDays7] = useState(true);
  const [days3, setDays3] = useState(true);
  const [days1, setDays1] = useState(true);
  const [days0, setDays0] = useState(true);
  const [urgentEnabled, setUrgentEnabled] = useState(true);
  const [urgentMaxCount, setUrgentMaxCount] = useState(3);
  const [urgentIntervalHours, setUrgentIntervalHours] = useState(24);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      const [cfgRes, usersList] = await Promise.all([
        ipcRenderer.invoke('get-calendar-config', { actingUsername: currentUser?.username }),
        ipcRenderer.invoke('get-users'),
      ]);
      const userRows = Array.isArray(usersList) ? usersList : (usersList?.users || []);
      if (userRows.length) {
        setUsers(
          userRows
            .filter((u) => u.active && u.approved && String(u.email || '').includes('@'))
            .sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username, 'el'))
        );
      }
      if (!cfgRes?.success) {
        setStatus(cfgRes?.error || 'Αποτυχία φόρτωσης ρυθμίσεων');
        setStatusError(true);
        return;
      }
      const cfg = cfgRes.config || {};
      setEnabled(cfg.enabled === true);
      setEventTypeSettings(loadEventTypeSettingsFromConfig(cfg));
      const db = cfg.daysBefore || [7, 3, 1, 0];
      setDays180(db.includes(180));
      setDays90(db.includes(90));
      setDays30(db.includes(30));
      setDays15(db.includes(15));
      setDays7(db.includes(7));
      setDays3(db.includes(3));
      setDays1(db.includes(1));
      setDays0(db.includes(0));
      const urg = cfg.urgentRepeat || {};
      setUrgentEnabled(urg.enabled !== false);
      setUrgentMaxCount(Number(urg.maxCount) || 3);
      setUrgentIntervalHours(Number(urg.intervalHours) || 24);
    } catch (e) {
      setStatus(e.message || 'Σφάλμα φόρτωσης');
      setStatusError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const buildPayload = () => {
    const daysBefore = [];
    if (days180) daysBefore.push(180);
    if (days90) daysBefore.push(90);
    if (days30) daysBefore.push(30);
    if (days15) daysBefore.push(15);
    if (days7) daysBefore.push(7);
    if (days3) daysBefore.push(3);
    if (days1) daysBefore.push(1);
    if (days0) daysBefore.push(0);
    const payloadSettings = {};
    REMINDER_EVENT_TYPES.forEach((type) => {
      const row = eventTypeSettings[type] || makeDefaultTypeSetting();
      const roles = Array.isArray(row.recipientRoles) ? row.recipientRoles : [];
      payloadSettings[type] = {
        enabled: row.enabled === true,
        recipientRoles: roles.length ? roles : (Array.isArray(row.recipientUsernames) && row.recipientUsernames.length ? [] : ['ADMIN']),
        recipientUsernames: Array.isArray(row.recipientUsernames) ? row.recipientUsernames : [],
      };
    });
    return {
      enabled,
      daysBefore: daysBefore.length ? daysBefore : [7, 3, 1, 0],
      eventTypeSettings: payloadSettings,
      urgentRepeat: {
        enabled: urgentEnabled,
        maxCount: Math.max(1, Math.min(14, Number(urgentMaxCount) || 3)),
        intervalHours: Math.max(6, Math.min(168, Number(urgentIntervalHours) || 24)),
      },
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const res = await ipcRenderer.invoke('save-calendar-config', {
        config: buildPayload(),
        actingUsername: currentUser?.username,
      });
      if (!res?.success) {
        setStatus(res?.error || 'Αποτυχία αποθήκευσης');
        setStatusError(true);
        return;
      }
      setStatus('Οι ρυθμίσεις αποθηκεύτηκαν.');
      setStatusError(false);
    } catch (e) {
      setStatus(e.message || 'Σφάλμα αποθήκευσης');
      setStatusError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setStatus('');
    try {
      const res = await ipcRenderer.invoke('send-test-procurement-calendar-reminder', {
        actingUsername: currentUser?.username,
      });
      if (!res?.success) {
        setStatus(res?.error || 'Αποτυχία αποστολής δοκιμαστικού email');
        setStatusError(true);
        return;
      }
      setStatus('Δοκιμαστικό email αποστάλη στο email του λογαριασμού σας.');
      setStatusError(false);
    } catch (e) {
      setStatus(e.message || 'Σφάλμα αποστολής');
      setStatusError(true);
    } finally {
      setTesting(false);
    }
  };

  const updateTypeSetting = (eventType, patch) => {
    setEventTypeSettings((prev) => ({
      ...prev,
      [eventType]: {
        ...(prev[eventType] || makeDefaultTypeSetting()),
        ...patch,
      },
    }));
  };

  const toggleTypeRole = (eventType, role) => {
    setEventTypeSettings((prev) => {
      const row = prev[eventType] || makeDefaultTypeSetting();
      const roles = new Set(row.recipientRoles || []);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return {
        ...prev,
        [eventType]: {
          ...row,
          recipientRoles: [...roles],
        },
      };
    });
  };

  const toggleTypeUsername = (eventType, username) => {
    const u = String(username || '').trim().toLowerCase();
    if (!u) return;
    setEventTypeSettings((prev) => {
      const row = prev[eventType] || makeDefaultTypeSetting();
      const list = Array.isArray(row.recipientUsernames) ? row.recipientUsernames : [];
      const next = list.includes(u) ? list.filter((x) => x !== u) : [...list, u];
      return {
        ...prev,
        [eventType]: {
          ...row,
          recipientUsernames: next,
        },
      };
    });
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Ρυθμίσεις Ημερολογίου</Title>
          <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
        </Header>

        {loading ? (
          <HelpText>Φόρτωση ρυθμίσεων…</HelpText>
        ) : (
          <>
            <Section>
              <SectionTitle>Email υπενθυμίσεις</SectionTitle>
              <CheckRow>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span>Ενεργές αυτόματες υπενθυμίσεις ημερολογίου</span>
              </CheckRow>
              <HelpText>
                Απαιτείται ρύθμιση SMTP (Σύστημα → Ρυθμίσεις Email). Για κάθε τύπο
                προθεσμίας ορίζετε ξεχωριστά αν θα στέλνονται email και σε ποιους.
              </HelpText>
            </Section>

            <Section>
              <SectionTitle>Τύποι γεγονότων &amp; παραλήπτες</SectionTitle>
              {REMINDER_EVENT_TYPES.map((eventType) => {
                const row = eventTypeSettings[eventType] || makeDefaultTypeSetting();
                const roles = row.recipientRoles || [];
                return (
                  <TypeCard key={eventType} $enabled={row.enabled === true}>
                    <CheckRow>
                      <input
                        type="checkbox"
                        checked={row.enabled === true}
                        onChange={(e) => updateTypeSetting(eventType, { enabled: e.target.checked })}
                      />
                      <span style={{ fontWeight: 700 }}>{CALENDAR_EVENT_LABELS[eventType]}</span>
                    </CheckRow>
                    {row.enabled === true && (
                      <TypeCardBody>
                        <TypeCardRoles>
                          <CheckRow>
                            <input
                              type="checkbox"
                              checked={roles.includes('ADMIN')}
                              onChange={() => toggleTypeRole(eventType, 'ADMIN')}
                            />
                            <span>Διαχειριστές</span>
                          </CheckRow>
                          <CheckRow>
                            <input
                              type="checkbox"
                              checked={roles.includes('ENGINEER')}
                              onChange={() => toggleTypeRole(eventType, 'ENGINEER')}
                            />
                            <span>Μηχανικοί</span>
                          </CheckRow>
                          <CheckRow>
                            <input
                              type="checkbox"
                              checked={roles.includes('USER')}
                              onChange={() => toggleTypeRole(eventType, 'USER')}
                            />
                            <span>Χρήστες</span>
                          </CheckRow>
                        </TypeCardRoles>
                        <FieldGroup style={{ marginBottom: 0 }}>
                          <Label>Επιπλέον συγκεκριμένοι χρήστες</Label>
                          <UserList>
                            {users.length === 0 && <HelpText>Δεν βρέθηκαν ενεργοί χρήστες με email.</HelpText>}
                            {users.map((u) => (
                              <CheckRow key={`${eventType}-${u.username}`}>
                                <input
                                  type="checkbox"
                                  checked={(row.recipientUsernames || []).includes(String(u.username).toLowerCase())}
                                  onChange={() => toggleTypeUsername(eventType, u.username)}
                                />
                                <span>{u.fullName || u.username} ({u.role})</span>
                              </CheckRow>
                            ))}
                          </UserList>
                        </FieldGroup>
                      </TypeCardBody>
                    )}
                  </TypeCard>
                );
              })}
            </Section>

            <Section>
              <SectionTitle>Ημέρες πριν την καταληκτική</SectionTitle>
              {DAY_OPTIONS.map(({ value, label }) => {
                const stateMap = {
                  180: [days180, setDays180],
                  90: [days90, setDays90],
                  30: [days30, setDays30],
                  15: [days15, setDays15],
                  7: [days7, setDays7],
                  3: [days3, setDays3],
                  1: [days1, setDays1],
                  0: [days0, setDays0],
                };
                const [checked, setter] = stateMap[value];
                return (
                  <CheckRow key={value}>
                    <input type="checkbox" checked={checked} onChange={(e) => setter(e.target.checked)} />
                    <span>{label}</span>
                  </CheckRow>
                );
              })}
            </Section>

            <Section>
              <SectionTitle>Επανάληψη σε κίνδυνο (≤7 ημέρες)</SectionTitle>
              <CheckRow>
                <input type="checkbox" checked={urgentEnabled} onChange={(e) => setUrgentEnabled(e.target.checked)} />
                <span>Επιπλέον υπενθυμίσεις όταν απομένουν λιγότερες από 7 ημέρες</span>
              </CheckRow>
              <FieldGroup>
                <Label>Μέγιστος αριθμός επαναλήψεων ανά υποέργο</Label>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={urgentMaxCount}
                  onChange={(e) => setUrgentMaxCount(e.target.value)}
                  disabled={!urgentEnabled}
                />
              </FieldGroup>
              <FieldGroup>
                <Label>Διάστημα μεταξύ επαναλήψεων (ώρες)</Label>
                <Select
                  value={urgentIntervalHours}
                  onChange={(e) => setUrgentIntervalHours(Number(e.target.value))}
                  disabled={!urgentEnabled}
                >
                  <option value={6}>6 ώρες</option>
                  <option value={12}>12 ώρες</option>
                  <option value={24}>24 ώρες</option>
                  <option value={48}>48 ώρες</option>
                </Select>
              </FieldGroup>
            </Section>

            <BtnRow>
              <PrimaryBtn type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={handleTestEmail} disabled={testing}>
                {testing ? 'Αποστολή…' : 'Δοκιμαστικό email'}
              </SecondaryBtn>
              <SecondaryBtn type="button" onClick={onClose}>Κλείσιμο</SecondaryBtn>
            </BtnRow>

            {status && <StatusMsg $error={statusError}>{status}</StatusMsg>}
          </>
        )}
      </Panel>
    </Overlay>
  );
}
