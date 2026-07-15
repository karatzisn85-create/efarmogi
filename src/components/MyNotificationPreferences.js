import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

/* ─── Styled Components ─── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10010;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  width: 460px;
  max-width: 94vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
  padding: 28px 30px 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
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
  margin: 0 0 22px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.55;
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid #e2e8f0;
`;

const OptionRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  cursor: pointer;
  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #6366f1;
    margin-top: 1px;
    flex-shrink: 0;
  }
`;

const OptionContent = styled.div``;

const OptionLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 2px;
`;

const OptionHint = styled.div`
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
`;

const TimeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  margin-left: 30px;
`;

const TimeInput = styled.input`
  padding: 6px 10px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  width: 90px;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TimeLabel = styled.span`
  font-size: 12.5px;
  color: #475569;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const PrimaryBtn = styled.button`
  padding: 10px 20px;
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
`;

const StatusMsg = styled.div`
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => (p.$error ? '#dc2626' : '#059669')};
`;

/* ─── Component ─── */

export default function MyNotificationPreferences({ onClose, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);

  const [calendarEmail, setCalendarEmail] = useState(true);
  const [aepoEmail, setAepoEmail] = useState(true);
  const [noteEmail, setNoteEmail] = useState(true);
  const [workspaceToasts, setWorkspaceToasts] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-my-notification-preferences', {
        actingUsername: currentUser?.username,
      });
      if (res?.success && res.preferences) {
        const p = res.preferences;
        setCalendarEmail(p.calendarEmail !== false);
        setAepoEmail(p.aepoEmail !== false);
        setNoteEmail(p.noteEmail !== false);
        setWorkspaceToasts(p.workspaceToasts !== false);
        setQuietHoursEnabled(p.quietHoursEnabled === true);
        setQuietHoursStart(p.quietHoursStart || '22:00');
        setQuietHoursEnd(p.quietHoursEnd || '08:00');
      }
    } catch (e) {
      setStatus(e.message || 'Σφάλμα');
      setStatusError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const res = await ipcRenderer.invoke('save-my-notification-preferences', {
        actingUsername: currentUser?.username,
        preferences: {
          calendarEmail,
          aepoEmail,
          noteEmail,
          workspaceToasts,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
        },
      });
      if (!res?.success) {
        setStatus(res?.error || 'Αποτυχία αποθήκευσης');
        setStatusError(true);
        return;
      }
      setStatus('Οι προτιμήσεις σας αποθηκεύτηκαν.');
      setStatusError(false);
    } catch (e) {
      setStatus(e.message || 'Σφάλμα');
      setStatusError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Οι ειδοποιήσεις μου</Title>
          <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
        </Header>
        <Subtitle>
          Επιλέξτε ποιες ειδοποιήσεις θέλετε να λαμβάνετε. Οι ρυθμίσεις αυτές
          αφορούν μόνο εσάς — δεν επηρεάζουν τους υπόλοιπους χρήστες.
        </Subtitle>

        {loading ? (
          <OptionHint>Φόρτωση…</OptionHint>
        ) : (
          <>
            <Section>
              <SectionTitle>Email που θέλω να λαμβάνω</SectionTitle>

              <OptionRow>
                <input type="checkbox" checked={calendarEmail} onChange={(e) => setCalendarEmail(e.target.checked)} />
                <OptionContent>
                  <OptionLabel>Υπενθυμίσεις ημερολογίου</OptionLabel>
                  <OptionHint>
                    Προθεσμίες ΚΗΜΔΗΣ, λήξεις συμβάσεων, λήξη προσφορών, παραβάσεις
                    12μήνου, και χειροκίνητα γεγονότα ημερολογίου.
                  </OptionHint>
                </OptionContent>
              </OptionRow>

              <OptionRow>
                <input type="checkbox" checked={aepoEmail} onChange={(e) => setAepoEmail(e.target.checked)} />
                <OptionContent>
                  <OptionLabel>Υπενθυμίσεις ΑΕΠΟ</OptionLabel>
                  <OptionHint>
                    Ειδοποιήσεις πριν τη λήξη Αδειών Εκτέλεσης Ποιοτικού Ελέγχου (ΑΕΠΟ),
                    ώστε να προλάβετε την ανανέωσή τους.
                  </OptionHint>
                </OptionContent>
              </OptionRow>

              <OptionRow>
                <input type="checkbox" checked={noteEmail} onChange={(e) => setNoteEmail(e.target.checked)} />
                <OptionContent>
                  <OptionLabel>Υπενθυμίσεις σημειώσεων</OptionLabel>
                  <OptionHint>
                    Email στην ημερομηνία υπενθύμισης που έχετε ορίσει σε μια σημείωση.
                  </OptionHint>
                </OptionContent>
              </OptionRow>
            </Section>

            <Section>
              <SectionTitle>Ειδοποιήσεις στην εφαρμογή</SectionTitle>

              <OptionRow>
                <input type="checkbox" checked={workspaceToasts} onChange={(e) => setWorkspaceToasts(e.target.checked)} />
                <OptionContent>
                  <OptionLabel>Ειδοποιήσεις χώρου εργασίας</OptionLabel>
                  <OptionHint>
                    Αναδυόμενα μηνύματα (toasts) για νέες αναθέσεις, σχόλια, αλλαγές
                    κατάστασης εργασιών, κ.λπ.
                  </OptionHint>
                </OptionContent>
              </OptionRow>
            </Section>

            <Section>
              <SectionTitle>Ήσυχες ώρες</SectionTitle>

              <OptionRow>
                <input type="checkbox" checked={quietHoursEnabled} onChange={(e) => setQuietHoursEnabled(e.target.checked)} />
                <OptionContent>
                  <OptionLabel>Μη στέλνετε email σε ήσυχες ώρες</OptionLabel>
                  <OptionHint>
                    Τα email θα αποστέλλονται μόνο εντός ωραρίου. Αν μια υπενθύμιση πέσει
                    σε ήσυχες ώρες, θα σταλεί στην αρχή του επόμενου ενεργού παραθύρου.
                  </OptionHint>
                </OptionContent>
              </OptionRow>

              {quietHoursEnabled && (
                <TimeRow>
                  <TimeLabel>Από</TimeLabel>
                  <TimeInput
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                  />
                  <TimeLabel>έως</TimeLabel>
                  <TimeInput
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                  />
                </TimeRow>
              )}
            </Section>

            <BtnRow>
              <PrimaryBtn type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </PrimaryBtn>
              <SecondaryBtn type="button" onClick={onClose}>Κλείσιμο</SecondaryBtn>
            </BtnRow>

            {status && <StatusMsg $error={statusError}>{status}</StatusMsg>}
          </>
        )}
      </Card>
    </Overlay>
  );
}
