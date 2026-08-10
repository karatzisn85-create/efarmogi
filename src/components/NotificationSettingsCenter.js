import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_LABELS,
} from '../utils/procurementCalendarEvents';

const ipcRenderer = window.electronAPI;

/* ─── Styled Components ─── */

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
  border-radius: 16px;
  width: 680px;
  max-width: 96vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.28);
`;

const HeaderBar = styled.div`
  padding: 24px 28px 0;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 19px;
  color: #0f172a;
  font-weight: 800;
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

const Subtitle = styled.p`
  margin: 0 0 18px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.55;
`;

const TabBar = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e2e8f0;
  padding: 0 28px;
`;

const Tab = styled.button`
  padding: 10px 18px;
  border: none;
  background: none;
  font-size: 13.5px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  color: ${(p) => (p.$active ? '#4f46e5' : '#64748b')};
  cursor: pointer;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -2px;
    height: 2.5px;
    border-radius: 2px 2px 0 0;
    background: ${(p) => (p.$active ? '#6366f1' : 'transparent')};
  }
  &:hover { color: #4f46e5; }
`;

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 22px 28px 28px;
`;

const Section = styled.div`
  margin-bottom: 22px;
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
  input { width: 16px; height: 16px; cursor: pointer; accent-color: #6366f1; }
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
  line-height: 1.55;
`;

const InfoBox = styled.div`
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: #0c4a6e;
  line-height: 1.6;
  margin-bottom: 16px;
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
  margin-top: 20px;
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
  font-weight: 600;
  color: ${(p) => (p.$error ? '#dc2626' : '#059669')};
`;

/* ─── Constants ─── */

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

const TABS = [
  { id: 'calendar', label: 'Ημερολόγιο', icon: '📅' },
  { id: 'aepo', label: 'ΑΕΠΟ', icon: '🏗' },
  { id: 'notes', label: 'Σημειώσεις', icon: '📝' },
];

/* ─── Main Component ─── */

export default function NotificationSettingsCenter({ onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('calendar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [users, setUsers] = useState([]);

  // Calendar state
  const [calEnabled, setCalEnabled] = useState(false);
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

  // AEPO state
  const [aepoEnabled, setAepoEnabled] = useState(true);
  const [aepoUseAdminEmails, setAepoUseAdminEmails] = useState(true);
  const [aepoDays90, setAepoDays90] = useState(true);
  const [aepoDays60, setAepoDays60] = useState(true);
  const [aepoDays30, setAepoDays30] = useState(true);
  const [aepoExtraEmails, setAepoExtraEmails] = useState('');

  // Notes state
  const [notesEnabled, setNotesEnabled] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      const [cfgRes, usersList, aepoRes, notesRes] = await Promise.all([
        ipcRenderer.invoke('get-calendar-config', { actingUsername: currentUser?.username }),
        ipcRenderer.invoke('get-users'),
        ipcRenderer.invoke('get-orimanthi-config', { actingUsername: currentUser?.username }).catch(() => null),
        ipcRenderer.invoke('get-note-reminder-config', { actingUsername: currentUser?.username }).catch(() => null),
      ]);

      const userRows = Array.isArray(usersList) ? usersList : (usersList?.users || []);
      if (userRows.length) {
        setUsers(
          userRows
            .filter((u) => u.active && u.approved && String(u.email || '').includes('@'))
            .sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username, 'el'))
        );
      }

      // Calendar config
      if (cfgRes?.success) {
        const cfg = cfgRes.config || {};
        setCalEnabled(cfg.enabled === true);
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
      }

      // AEPO config
      if (aepoRes?.success) {
        const ac = aepoRes.config?.aepoReminders || {};
        setAepoEnabled(ac.enabled !== false);
        setAepoUseAdminEmails(ac.useAdminEmails !== false);
        const ad = ac.daysBefore || [30, 60, 90];
        setAepoDays90(ad.includes(90));
        setAepoDays60(ad.includes(60));
        setAepoDays30(ad.includes(30));
        setAepoExtraEmails((ac.recipientEmails || []).join(', '));
      }

      // Notes config
      if (notesRes?.success) {
        setNotesEnabled(notesRes.config?.enabled !== false);
      }
    } catch (e) {
      setStatus(e.message || 'Σφάλμα φόρτωσης');
      setStatusError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ─── Calendar handlers ─── */

  const buildCalendarPayload = () => {
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
      enabled: calEnabled,
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
      if (activeTab === 'calendar') {
        const res = await ipcRenderer.invoke('save-calendar-config', {
          config: buildCalendarPayload(),
          actingUsername: currentUser?.username,
        });
        if (!res?.success) { setStatus(res?.error || 'Αποτυχία αποθήκευσης'); setStatusError(true); return; }
      } else if (activeTab === 'aepo') {
        const daysBefore = [];
        if (aepoDays90) daysBefore.push(90);
        if (aepoDays60) daysBefore.push(60);
        if (aepoDays30) daysBefore.push(30);
        if (!daysBefore.length) daysBefore.push(30, 60, 90);
        const res = await ipcRenderer.invoke('save-orimanthi-config', {
          actingUsername: currentUser?.username,
          config: {
            aepoReminders: {
              enabled: aepoEnabled,
              useAdminEmails: aepoUseAdminEmails,
              daysBefore,
              recipientEmails: aepoExtraEmails
                .split(/[,;]+/)
                .map((e) => e.trim())
                .filter((e) => e.includes('@')),
            },
          },
        });
        if (!res?.success) { setStatus(res?.error || 'Αποτυχία αποθήκευσης'); setStatusError(true); return; }
      } else if (activeTab === 'notes') {
        const res = await ipcRenderer.invoke('save-note-reminder-config', {
          actingUsername: currentUser?.username,
          config: { enabled: notesEnabled },
        });
        if (!res?.success) { setStatus(res?.error || 'Αποτυχία αποθήκευσης'); setStatusError(true); return; }
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
      if (!res?.success) { setStatus(res?.error || 'Αποτυχία αποστολής δοκιμαστικού'); setStatusError(true); return; }
      setStatus('Δοκιμαστικό email αποστάλη στο email σας.');
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

  /* ─── Render helpers ─── */

  const renderCalendarTab = () => (
    <>
      <InfoBox>
        Για κάθε τύπο προθεσμίας ορίζετε ξεχωριστά αν θα στέλνονται email και
        ποιοι θα τα λαμβάνουν. Οι ημέρες πριν την καταληκτική ισχύουν για όλους
        τους ενεργούς τύπους.
      </InfoBox>

      <Section>
        <SectionTitle>Κατάσταση</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={calEnabled} onChange={(e) => setCalEnabled(e.target.checked)} />
          <span>Ενεργές αυτόματες υπενθυμίσεις ημερολογίου</span>
        </CheckRow>
        <HelpText>
          Απαιτείται ρύθμιση SMTP στις «Ρυθμίσεις Email» (Σύστημα). Αν δεν
          υπάρχει SMTP, τα email δεν θα σταλούν ακόμα κι αν η ρύθμιση είναι ενεργή.
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
        <HelpText>
          Π.χ. οι λήξεις συμβάσεων μόνο στους διαχειριστές, οι προθεσμίες
          προσφορών και στους μηχανικούς. Οι μηχανικοί βλέπουν μόνο υποέργα
          που τους αφορούν.
        </HelpText>
      </Section>

      <Section>
        <SectionTitle>Πότε στέλνεται η υπενθύμιση</SectionTitle>
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
        <HelpText>
          Κάθε email στέλνεται μία φορά ανά κατώφλι ανά υποέργο — δεν θα λάβετε
          διπλά email για την ίδια προθεσμία στο ίδιο κατώφλι.
        </HelpText>
      </Section>

      <Section>
        <SectionTitle>Επείγουσα επανάληψη (τελευταίες 7 ημέρες)</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={urgentEnabled} onChange={(e) => setUrgentEnabled(e.target.checked)} />
          <span>Στείλε επιπλέον υπενθυμίσεις όταν η προθεσμία πλησιάζει πολύ</span>
        </CheckRow>
        <FieldGroup>
          <Label>Μέγιστες επαναλήψεις ανά υποέργο</Label>
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
          <Label>Διάστημα μεταξύ επαναλήψεων</Label>
          <Select
            value={urgentIntervalHours}
            onChange={(e) => setUrgentIntervalHours(Number(e.target.value))}
            disabled={!urgentEnabled}
          >
            <option value={6}>Κάθε 6 ώρες</option>
            <option value={12}>Κάθε 12 ώρες</option>
            <option value={24}>Κάθε 24 ώρες (μία φορά τη μέρα)</option>
            <option value={48}>Κάθε 48 ώρες</option>
          </Select>
        </FieldGroup>
      </Section>
    </>
  );

  const renderAepoTab = () => (
    <>
      <InfoBox>
        Ρυθμίστε τις email υπενθυμίσεις για τις Άδειες Εκτέλεσης Ποιοτικού Ελέγχου
        (ΑΕΠΟ) που πλησιάζουν σε λήξη. Οι ειδοποιήσεις βοηθούν στην έγκαιρη
        ανανέωση πριν εκπνεύσει η ισχύς.
      </InfoBox>

      <Section>
        <SectionTitle>Κατάσταση</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={aepoEnabled} onChange={(e) => setAepoEnabled(e.target.checked)} />
          <span>Ενεργές email υπενθυμίσεις ΑΕΠΟ</span>
        </CheckRow>
      </Section>

      <Section>
        <SectionTitle>Παραλήπτες</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={aepoUseAdminEmails} onChange={(e) => setAepoUseAdminEmails(e.target.checked)} />
          <span>Αποστολή σε Διαχειριστές (ADMIN / SUPERADMIN)</span>
        </CheckRow>
        <FieldGroup>
          <Label>Επιπλέον emails (χωρισμένα με κόμμα)</Label>
          <Input
            placeholder="user@example.com, other@example.com"
            value={aepoExtraEmails}
            onChange={(e) => setAepoExtraEmails(e.target.value)}
          />
          <HelpText>
            Χρήσιμο αν θέλετε να λαμβάνουν υπενθυμίσεις ΑΕΠΟ και συνάδελφοι
            που δεν είναι Διαχειριστές στο σύστημα.
          </HelpText>
        </FieldGroup>
      </Section>

      <Section>
        <SectionTitle>Πότε στέλνεται</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={aepoDays90} onChange={(e) => setAepoDays90(e.target.checked)} />
          <span>90 ημέρες πριν τη λήξη</span>
        </CheckRow>
        <CheckRow>
          <input type="checkbox" checked={aepoDays60} onChange={(e) => setAepoDays60(e.target.checked)} />
          <span>60 ημέρες πριν τη λήξη</span>
        </CheckRow>
        <CheckRow>
          <input type="checkbox" checked={aepoDays30} onChange={(e) => setAepoDays30(e.target.checked)} />
          <span>30 ημέρες πριν τη λήξη</span>
        </CheckRow>
        <HelpText>
          Οι υπενθυμίσεις στέλνονται μία φορά σε κάθε κατώφλι ανά ΑΕΠΟ. Π.χ. αν
          επιλέξετε και τα τρία, θα σταλούν 3 email (στις 90, 60 και 30 ημέρες πριν).
        </HelpText>
      </Section>
    </>
  );

  const renderNotesTab = () => (
    <>
      <InfoBox>
        Οι σημειώσεις μπορούν να έχουν ημερομηνία υπενθύμισης. Όταν φτάσει η ώρα,
        αποστέλλεται email στον δημιουργό της σημείωσης. Εδώ μπορείτε να
        ενεργοποιήσετε ή απενεργοποιήσετε αυτή τη δυνατότητα για ολόκληρο το σύστημα.
      </InfoBox>

      <Section>
        <SectionTitle>Κατάσταση</SectionTitle>
        <CheckRow>
          <input type="checkbox" checked={notesEnabled} onChange={(e) => setNotesEnabled(e.target.checked)} />
          <span>Ενεργές email υπενθυμίσεις σημειώσεων</span>
        </CheckRow>
        <HelpText>
          Κάθε σημείωση με υπενθύμιση θα στείλει email στον δημιουργό της, στην
          ημερομηνία/ώρα που αυτός έχει ορίσει.
        </HelpText>
      </Section>
    </>
  );

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <HeaderBar>
          <TitleRow>
            <Title>Κέντρο Ειδοποιήσεων</Title>
            <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
          </TitleRow>
          <Subtitle>
            Διαχειριστείτε τις αυτόματες email υπενθυμίσεις που στέλνει το σύστημα.
            Κάθε κατηγορία ρυθμίζεται ξεχωριστά.
          </Subtitle>
        </HeaderBar>

        <TabBar>
          {TABS.map((tab) => (
            <Tab
              key={tab.id}
              $active={activeTab === tab.id}
              onClick={() => { setActiveTab(tab.id); setStatus(''); }}
            >
              {tab.icon} {tab.label}
            </Tab>
          ))}
        </TabBar>

        <ScrollBody>
          {loading ? (
            <HelpText>Φόρτωση ρυθμίσεων…</HelpText>
          ) : (
            <>
              {activeTab === 'calendar' && renderCalendarTab()}
              {activeTab === 'aepo' && renderAepoTab()}
              {activeTab === 'notes' && renderNotesTab()}

              <BtnRow>
                <PrimaryBtn type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </PrimaryBtn>
                {activeTab === 'calendar' && (
                  <SecondaryBtn type="button" onClick={handleTestEmail} disabled={testing || !calEnabled}>
                    {testing ? 'Αποστολή…' : 'Δοκιμαστικό email'}
                  </SecondaryBtn>
                )}
                <SecondaryBtn type="button" onClick={onClose}>Κλείσιμο</SecondaryBtn>
              </BtnRow>

              {status && <StatusMsg $error={statusError}>{status}</StatusMsg>}
            </>
          )}
        </ScrollBody>
      </Panel>
    </Overlay>
  );
}
