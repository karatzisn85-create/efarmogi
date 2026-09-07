import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import ergohubLogo from '../assets/ergohub-logo.svg';
import { isCapsLockOn } from '../utils/loginScreenPrefs';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 210000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
`;

const Brand = styled.div`
  text-align: center;
  margin-bottom: 1.1rem;
  z-index: 1;
`;

const LogoImg = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.28);
  margin-bottom: 8px;
`;

const AppBrand = styled.h1`
  font-size: 1.7rem;
  font-weight: 900;
  color: #fff;
  margin: 0;
  letter-spacing: 2px;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
`;

const StatusLine = styled.p`
  margin: 0.45rem 0 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.45;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 2.4rem 2.6rem 2.2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  width: min(420px, 100%);
  animation: ${fadeIn} 0.35s ease-out;
  position: relative;
  z-index: 1;
`;

const CardTitle = styled.h2`
  color: #1a2a3a;
  margin: 0 0 0.45rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 1px;
`;

const CardHint = styled.p`
  margin: 0 0 1.4rem;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.45;
`;

const FormGroup = styled.div`
  margin-bottom: 1.2rem;
  text-align: left;
`;

const Label = styled.label`
  display: block;
  color: #555;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 4px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: ${(p) => (p.readOnly ? '#f8fafc' : '#fff')};

  &:focus { border-color: #2c3e50; outline: none; }
  &::placeholder { color: #bbb; }
`;

const PrimaryButton = styled.button`
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const ErrorBox = styled.div`
  background: #ffeaea;
  color: #c62828;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 12px;
  border: 1px solid #ffcdd2;
  text-align: left;
`;

const NoticeBox = styled.div`
  background: #fff7ed;
  color: #9a3412;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  margin-bottom: 12px;
  border: 1px solid #fed7aa;
  text-align: left;
`;

function formatLockStatus({ running, live, idleCountdown }) {
  if (idleCountdown && Number(idleCountdown.remainingSec) >= 0) {
    const sec = Math.max(0, Number(idleCountdown.remainingSec) || 0);
    return idleCountdown.shutdownScheduled
      ? `Ο υπολογιστής σβήνει σε ${sec}″. Συνδεθείτε για να μείνει ανοιχτός.`
      : `Η εφαρμογή κλείνει σε ${sec}″. Συνδεθείτε για να μείνει ανοιχτή.`;
  }
  const pct = Number(live?.pct);
  if (running && Number.isFinite(pct) && pct > 0) {
    return `Η μαζική ανανέωση συνεχίζεται — ${pct}%.`;
  }
  if (running) return 'Η μαζική ανανέωση συνεχίζεται στο φόντο.';
  return 'Η εφαρμογή είναι κλειδωμένη.';
}

export default function KhmdhsSessionLockOverlay({
  open,
  username,
  running = false,
  live = null,
  idleCountdown = null,
  onUnlocked,
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [tickCountdown, setTickCountdown] = useState(null);
  const overlayRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setPassword('');
    setError('');
    setLoading(false);
    setTickCountdown(null);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || !ipcRenderer?.on) return undefined;
    const unsubTick = ipcRenderer.on('khmdhs-idle-shutdown-tick', (payload) => {
      if (!payload) return;
      setTickCountdown({
        remainingSec: Number(payload.remainingSec) || 0,
        shutdownScheduled: !!payload.shutdownScheduled,
      });
    });
    const unsubAbort = ipcRenderer.on('khmdhs-idle-shutdown-aborted', () => {
      setTickCountdown(null);
    });
    return () => {
      if (typeof unsubTick === 'function') unsubTick();
      if (typeof unsubAbort === 'function') unsubAbort();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onMod = (e) => {
      const on = isCapsLockOn(e);
      setCapsLockOn((prev) => (prev === on ? prev : on));
    };
    window.addEventListener('keydown', onMod);
    window.addEventListener('keyup', onMod);
    const trapTab = (e) => {
      if (e.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll(
        'input:not([readonly]):not([disabled]), button:not([disabled])'
      );
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapTab, true);
    const id = window.setTimeout(() => {
      passwordRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', trapTab, true);
      window.removeEventListener('keydown', onMod);
      window.removeEventListener('keyup', onMod);
    };
  }, [open]);

  if (!open) return null;

  const handleUnlock = async () => {
    if (!password) {
      setError('Εισάγετε τον κωδικό');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await ipcRenderer.invoke('unlock-khmdhs-session', {
        username: String(username || '').trim(),
        password,
      });
      if (result?.success) {
        setPassword('');
        if (typeof onUnlocked === 'function') onUnlocked();
      } else {
        setError(result?.error || 'Αποτυχία σύνδεσης');
        setPassword('');
      }
    } catch {
      setError('Σφάλμα επικοινωνίας');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleUnlock();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === 'Tab') {
      const root = overlayRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll(
        'input:not([readonly]):not([disabled]), button:not([disabled])'
      );
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <Overlay
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Κλείδωμα εφαρμογής"
      data-testid="khmdhs-session-lock"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <Brand>
        <LogoImg src={ergohubLogo} alt="" />
        <AppBrand>ERGOHUB</AppBrand>
        <StatusLine>{formatLockStatus({ running, live, idleCountdown: idleCountdown || tickCountdown })}</StatusLine>
      </Brand>
      <Card>
        <CardTitle>Σύνδεση</CardTitle>
        <CardHint>
          Η εφαρμογή είναι κλειδωμένη όσο λείπετε. Για ακύρωση, άνοιγμα υποέργου ή ακύρωση σβησίματος χρειάζεται ο κωδικός σας.
        </CardHint>
        {error && <ErrorBox data-testid="session-lock-error">{error}</ErrorBox>}
        <FormGroup>
          <Label htmlFor="session-lock-username">Όνομα χρήστη</Label>
          <Input
            id="session-lock-username"
            type="text"
            value={username || ''}
            readOnly
            aria-label="Όνομα χρήστη"
            data-testid="session-lock-username"
          />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="session-lock-password">Κωδικός</Label>
          <Input
            id="session-lock-password"
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Εισάγετε τον κωδικό"
            autoFocus
            aria-label="Κωδικός πρόσβασης"
            data-testid="session-lock-password"
          />
        </FormGroup>
        {capsLockOn && (
          <NoticeBox data-testid="session-lock-caps-lock">
            Το Caps Lock είναι ενεργό — ο κωδικός γράφεται με κεφαλαία.
          </NoticeBox>
        )}
        <PrimaryButton
          type="button"
          onClick={handleUnlock}
          disabled={loading}
          data-testid="session-lock-submit"
        >
          {loading ? 'Σύνδεση...' : 'Είσοδος'}
        </PrimaryButton>
      </Card>
    </Overlay>,
    document.body
  );
}
