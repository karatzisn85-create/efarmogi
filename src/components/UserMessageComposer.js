import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2200;
  padding: 1.5rem;
`;

const Window = styled.div`
  width: min(1080px, 100%);
  height: min(760px, 92vh);
  background: #f8fafc;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.35);
`;

const Header = styled.div`
  background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
  color: white;
  padding: 1.15rem 1.4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
`;

const HeaderNote = styled.p`
  margin: 0.25rem 0 0;
  font-size: 0.86rem;
  color: #e0e7ff;
  line-height: 1.45;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.16);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  font-weight: 650;
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.28); }
  &:disabled { opacity: 0.55; cursor: default; }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px 1fr;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    overflow: auto;
  }
`;

const People = styled.aside`
  border-right: 1px solid #e2e8f0;
  background: white;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const PeopleHead = styled.div`
  padding: 0.9rem 1rem 0.55rem;
`;

const Search = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 0.62rem 0.75rem;
  font-size: 0.92rem;
  outline: none;
  &:focus { border-color: #4338ca; box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.15); }
`;

const PeopleList = styled.div`
  overflow: auto;
  padding: 0.35rem 0.55rem 0.8rem;
`;

const Person = styled.label`
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.62rem 0.55rem;
  border-radius: 10px;
  cursor: pointer;
  &:hover { background: #eef2ff; }
`;

const PersonName = styled.div`
  font-weight: 650;
  color: #1e1b4b;
  font-size: 0.92rem;
`;

const PersonMail = styled.div`
  color: #64748b;
  font-size: 0.78rem;
  word-break: break-all;
`;

const Letter = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 1rem 1.15rem 0.9rem;
  gap: 0.7rem;
`;

const SenderLine = styled.div`
  background: white;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  padding: 0.7rem 0.85rem;
  color: #312e81;
  font-size: 0.9rem;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 0.28rem;
`;

const Subject = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  font-size: 1.05rem;
  font-weight: 650;
  color: #1e1b4b;
  outline: none;
  &:focus { border-color: #4338ca; }
`;

const Message = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  flex: 1;
  min-height: 180px;
  resize: none;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.9rem 1rem;
  font-size: 1rem;
  line-height: 1.65;
  color: #1e293b;
  font-family: inherit;
  outline: none;
  &:focus { border-color: #4338ca; }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #eef2ff;
  color: #312e81;
  border-radius: 999px;
  padding: 0.28rem 0.55rem 0.28rem 0.7rem;
  font-size: 0.8rem;
`;

const ChipRemove = styled.button`
  border: 0;
  background: transparent;
  color: #4338ca;
  cursor: pointer;
  font-weight: 700;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const GhostButton = styled.button`
  background: white;
  color: #4338ca;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 0.62rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #eef2ff; }
  &:disabled { opacity: 0.55; cursor: default; }
`;

const SendButton = styled.button`
  background: #4338ca;
  color: white;
  border: 0;
  border-radius: 10px;
  padding: 0.7rem 1.15rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #3730a3; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

const ErrorText = styled.div`
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.88rem;
`;

function UserMessageComposer({ currentUser, onClose, showToast }) {
  const [people, setPeople] = useState([]);
  const [me, setMe] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({});
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await ipcRenderer.invoke('list-user-message-recipients', {
          actingUsername: currentUser?.username,
        });
        if (!alive) return;
        if (!result?.success) {
          setError(result?.error || 'Οι παραλήπτες δεν φορτώθηκαν.');
          return;
        }
        setPeople(result.recipients || []);
        setMe(result.me || null);
        const name = result.me?.fullName || currentUser?.fullName || '';
        setSubject(name ? `Μήνυμα από ${name}` : 'Μήνυμα');
      } catch (err) {
        if (alive) setError(err?.message || 'Οι παραλήπτες δεν φορτώθηκαν.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) => (
      containsSearchTerm(person.fullName, term) || containsSearchTerm(person.email, term)
    ));
  }, [people, query]);

  const chosen = people.filter((person) => selected[person.username]);

  const toggle = (username) => {
    setSelected((prev) => ({ ...prev, [username]: !prev[username] }));
  };

  const addFiles = async () => {
    setError('');
    const picked = await ipcRenderer.invoke('open-user-message-files');
    if (!picked || picked.canceled) return;
    const paths = picked.filePaths || [];
    setFiles((prev) => {
      const known = new Set(prev.map((file) => file.path));
      const next = prev.slice();
      paths.forEach((filePath) => {
        if (!filePath || known.has(filePath)) return;
        known.add(filePath);
        const parts = String(filePath).split(/[\\/]/);
        next.push({ path: filePath, name: parts[parts.length - 1] || 'αρχείο' });
      });
      return next;
    });
  };

  const send = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    if (!chosen.length) {
      sendingRef.current = false;
      setError('Επίλεξε τουλάχιστον έναν παραλήπτη.');
      return;
    }
    if (!subject.trim()) {
      sendingRef.current = false;
      setError('Γράψε θέμα.');
      return;
    }
    if (!body.trim()) {
      sendingRef.current = false;
      setError('Γράψε το μήνυμα.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await ipcRenderer.invoke('send-user-message-email', {
        actingUsername: currentUser?.username,
        recipientUsernames: chosen.map((person) => person.username),
        subject,
        body,
        attachments: files.map((file) => ({ path: file.path })),
      });
      if (!result?.success) {
        setError(result?.error || 'Το μήνυμα δεν στάλθηκε.');
        sendingRef.current = false;
        setSending(false);
        return;
      }
      if (showToast) showToast('Το μήνυμα στάλθηκε. Αντίγραφο έρχεται και στο email σου.', 'success');
      onClose();
    } catch (err) {
      setError(err?.message || 'Το μήνυμα δεν στάλθηκε.');
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Overlay>
      <Window data-testid="user-message-window" role="dialog" aria-label="Αποστολή email">
        <Header>
          <div>
            <Title>Αποστολή email</Title>
            <HeaderNote>
              Φεύγει από το email της εφαρμογής. Η απάντηση πάει στα προσωπικά email όσων επιλέγεις, και αντίγραφο έρχεται και σε σένα.
            </HeaderNote>
          </div>
          <CloseButton type="button" data-testid="user-message-close" onClick={onClose} disabled={sending}>
            Κλείσιμο
          </CloseButton>
        </Header>
        <Body>
          <People>
            <PeopleHead>
              <FieldLabel>Παραλήπτες</FieldLabel>
              <Search
                data-testid="user-message-search"
                value={query}
                placeholder="Αναζήτηση ονόματος"
                onChange={(event) => setQuery(event.target.value)}
              />
            </PeopleHead>
            <PeopleList>
              {loading ? <PersonMail>Φόρτωση…</PersonMail> : null}
              {!loading && visible.length === 0 ? (
                <PersonMail>
                  {query.trim() ? 'Δεν βρέθηκε τέτοιο όνομα.' : 'Δεν υπάρχει άλλος χρήστης με email.'}
                </PersonMail>
              ) : null}
              {visible.map((person) => (
                <Person key={person.username}>
                  <input
                    type="checkbox"
                    data-testid={`user-message-person-${person.username}`}
                    checked={!!selected[person.username]}
                    onChange={() => toggle(person.username)}
                  />
                  <span>
                    <PersonName>{person.fullName}</PersonName>
                    <PersonMail>{person.email}</PersonMail>
                  </span>
                </Person>
              ))}
            </PeopleList>
          </People>
          <Letter>
            <SenderLine data-testid="user-message-sender">
              Από: <strong>{me?.fullName || currentUser?.fullName || 'Εσύ'}</strong>
              {me?.email ? ` · ${me.email}` : ''}
            </SenderLine>
            <div>
              <FieldLabel htmlFor="user-message-subject">Θέμα</FieldLabel>
              <Subject
                id="user-message-subject"
                data-testid="user-message-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <Message
              data-testid="user-message-body"
              placeholder="Γράψε εδώ το μήνυμα"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {files.length > 0 && (
              <Chips>
                {files.map((file) => (
                  <Chip key={file.path} data-testid={`user-message-file-${file.name}`}>
                    {file.name}
                    <ChipRemove type="button" onClick={() => setFiles((prev) => prev.filter((item) => item.path !== file.path))} aria-label={`Αφαίρεση ${file.name}`}>
                      ×
                    </ChipRemove>
                  </Chip>
                ))}
              </Chips>
            )}
            {error ? <ErrorText data-testid="user-message-error">{error}</ErrorText> : null}
            <Footer>
              <GhostButton type="button" data-testid="user-message-attach" onClick={addFiles} disabled={sending}>
                Επισύναψη εικόνας, βίντεο ή αρχείου
              </GhostButton>
              <SendButton type="button" data-testid="user-message-send" onClick={send} disabled={sending}>
                {sending ? 'Αποστολή...' : `Αποστολή${chosen.length ? ` (${chosen.length})` : ''}`}
              </SendButton>
            </Footer>
          </Letter>
        </Body>
      </Window>
    </Overlay>
  );
}

export default UserMessageComposer;
