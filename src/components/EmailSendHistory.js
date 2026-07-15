import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

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
  border-radius: 16px;
  width: 700px;
  max-width: 96vw;
  max-height: 88vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.28);
`;

const Header = styled.div`
  padding: 24px 28px 16px;
  border-bottom: 1px solid #e2e8f0;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
`;

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 28px 28px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
  font-size: 14px;
`;

const EntryCard = styled.div`
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  margin-bottom: 10px;
  background: ${(p) => (p.$type === 'urgent' ? '#fef2f2' : p.$type === 'compliance' ? '#fffbeb' : '#f8fafc')};
  transition: box-shadow 0.12s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
`;

const EntryIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  background: ${(p) => {
    if (p.$type === 'urgent') return '#fee2e2';
    if (p.$type === 'compliance') return '#fef3c7';
    return '#e0e7ff';
  }};
`;

const EntryBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const EntryTitle = styled.div`
  font-size: 13.5px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 3px;
`;

const EntryMeta = styled.div`
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: ${(p) => p.$bg || '#e0e7ff'};
  color: ${(p) => p.$color || '#3730a3'};
  margin-right: 6px;
`;

function getCategoryLabel(category) {
  if (category === 'calendar') return 'Ημερολόγιο';
  if (category === 'aepo') return 'ΑΕΠΟ';
  if (category === 'notes') return 'Σημειώσεις';
  if (category === 'workspace') return 'Χώρος Εργασίας';
  return category || 'Άγνωστο';
}

function getTypeLabel(type) {
  if (type === 'threshold') return 'Υπενθύμιση';
  if (type === 'urgent') return 'Επείγον';
  if (type === 'compliance') return 'Συμμόρφωση';
  return type || '';
}

function getTypeIcon(type) {
  if (type === 'urgent') return '⚠';
  if (type === 'compliance') return '⚖';
  return '📬';
}

function getTypeBadge(type) {
  if (type === 'urgent') return { bg: '#fee2e2', color: '#991b1b' };
  if (type === 'compliance') return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#e0e7ff', color: '#3730a3' };
}

function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function EmailSendHistory({ onClose, currentUser }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-email-send-history', {
        actingUsername: currentUser?.username,
      });
      if (res?.success) setEntries(res.entries || []);
    } catch {}
    setLoading(false);
  }, [currentUser?.username]);

  useEffect(() => { load(); }, [load]);

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <TitleRow>
            <Title>Ιστορικό αποστολών email</Title>
            <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
          </TitleRow>
          <Subtitle>
            Τα τελευταία 200 email υπενθυμίσεων που αποστάλθηκαν από το σύστημα.
          </Subtitle>
        </Header>

        <ScrollBody>
          {loading ? (
            <EmptyState>Φόρτωση…</EmptyState>
          ) : entries.length === 0 ? (
            <EmptyState>
              Δεν υπάρχει ακόμα ιστορικό αποστολών. Τα email θα εμφανιστούν εδώ
              αυτόματα μόλις σταλούν υπενθυμίσεις.
            </EmptyState>
          ) : (
            entries.map((entry, idx) => {
              const badge = getTypeBadge(entry.type);
              return (
                <EntryCard key={idx} $type={entry.type}>
                  <EntryIcon $type={entry.type}>
                    {getTypeIcon(entry.type)}
                  </EntryIcon>
                  <EntryBody>
                    <EntryTitle>
                      <Badge $bg={badge.bg} $color={badge.color}>
                        {getCategoryLabel(entry.category)}
                      </Badge>
                      {getTypeLabel(entry.type)}
                      {entry.itemCount ? ` · ${entry.itemCount} εγγραφ${entry.itemCount === 1 ? 'ή' : 'ές'}` : ''}
                    </EntryTitle>
                    <EntryMeta>
                      Προς: <strong>{entry.recipientName || entry.recipientEmail}</strong>
                      {entry.recipientEmail && entry.recipientName ? ` (${entry.recipientEmail})` : ''}
                      {' · '}
                      {formatTimestamp(entry.timestamp)}
                    </EntryMeta>
                    {entry.items && entry.items.length > 0 && (
                      <EntryMeta style={{ marginTop: 3, color: '#475569' }}>
                        {entry.items.map((it, i) => (
                          <span key={i}>
                            {it.title}{it.daysLeft != null ? ` (${it.daysLeft} ημ.)` : ''}
                            {i < entry.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </EntryMeta>
                    )}
                  </EntryBody>
                </EntryCard>
              );
            })
          )}
        </ScrollBody>
      </Panel>
    </Overlay>
  );
}
