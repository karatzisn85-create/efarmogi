import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useToast } from './ToastProvider';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { showConfirm } from '../utils/confirmModal';
import { formatDateEl } from '../utils/dateFormat';
import { formatKhmdhsEuro } from '../utils/khmdhsNoticeFields';
import { buildContractorProfiles } from '../utils/contractorFields';
import contractorRegistry from '../../app/core/contractorRegistry';

const ipcRenderer = window.electronAPI;

const C = {
  blue: '#1d4ed8',
  blueDark: '#1e3a8a',
  blueLight: '#dbeafe',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  white: '#ffffff',
  emerald: '#059669',
  amber: '#d97706',
};

const slideIn = keyframes`from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); }`;
const spin = keyframes`to { transform: rotate(360deg); }`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: stretch;
  z-index: 1200;
  padding: 0.45rem;
  overflow: hidden;
`;

const Modal = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: 100%;
  min-height: calc(100vh - 0.9rem);
  height: calc(100vh - 0.9rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(29, 78, 216, 0.18), 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const MainModalHeader = styled.div`
  background: linear-gradient(135deg, ${C.blueDark} 0%, ${C.blue} 55%, #3b82f6 100%);
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const HeaderTitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeaderH = styled.h2`
  color: white;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
`;

const HeaderSub = styled.div`
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.1rem;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const CloseBtn = styled.button`
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.22); color: white; }
`;

const ReadOnlyBadge = styled.span`
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.72rem;
  font-weight: 700;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  position: relative;
  background: linear-gradient(160deg, #eff6ff 0%, #f8fafc 55%, #eff6ff 100%);
`;

const HubShell = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.5rem 1.35rem;
  min-height: 0;
  transition: opacity 0.22s ease, filter 0.22s ease;
  ${(p) => p.$dimmed && css`
    opacity: 0.52;
    filter: blur(1px);
    pointer-events: none;
    user-select: none;
  `}
`;

const HubToolbarCard = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  padding: 0.75rem 0.85rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  margin-bottom: 0.85rem;
`;

const HubSearch = styled.input`
  flex: 1;
  min-width: 220px;
  padding: 0.55rem 0.85rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.82rem;
  color: ${C.slate700};
  outline: none;
  &:focus { border-color: ${C.blue}; box-shadow: 0 0 0 3px ${C.blueLight}; }
`;

const HubListWrap = styled.div`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  overflow: hidden;
`;

const HubListHead = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 1.6fr) 120px 90px 110px 110px;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  background: ${C.slate50};
  color: ${C.slate500};
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const HubListRow = styled.button`
  display: grid;
  grid-template-columns: minmax(180px, 1.6fr) 120px 90px 110px 110px;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: none;
  border-bottom: 1px solid ${C.slate100};
  background: ${C.white};
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  &:nth-child(even) { background: ${C.slate50}99; }
  &:hover {
    background: ${C.blueLight};
    box-shadow: inset 4px 0 0 ${C.blue};
  }
`;

const NameCell = styled.div`
  min-width: 0;
`;

const NameTitle = styled.div`
  font-size: 0.84rem;
  font-weight: 800;
  color: ${C.slate800};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NameSub = styled.div`
  font-size: 0.7rem;
  color: ${C.slate500};
  margin-top: 0.12rem;
`;

const Cell = styled.div`
  font-size: 0.74rem;
  font-weight: 600;
  color: ${C.slate600};
`;

const EmptyState = styled.div`
  padding: 2.2rem 1rem;
  text-align: center;
  color: ${C.slate500};
  font-size: 0.88rem;
`;

const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid ${C.blueLight};
  border-top-color: ${C.blue};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
  margin: 2rem auto;
`;

const DetailOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  justify-content: center;
  padding: 0.85rem 1.1rem 1.1rem;
  overflow: auto;
  background: rgba(15, 23, 42, 0.12);
`;

const DetailCard = styled.div`
  width: min(880px, 100%);
  background: ${C.slate50};
  border-radius: 18px;
  border: 1px solid ${C.slate200};
  box-shadow: 0 22px 56px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
`;

const DetailHead = styled.div`
  padding: 1.05rem 1.25rem 1.05rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid ${C.slate200};
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  flex-shrink: 0;
`;

const DetailIdentity = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  min-width: 0;
`;

const Avatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, ${C.blue} 0%, ${C.blueDark} 100%);
  color: white;
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 18px rgba(29, 78, 216, 0.28);
`;

const DetailTitle = styled.h3`
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  color: ${C.slate900};
  line-height: 1.25;
  letter-spacing: -0.015em;
  word-break: break-word;
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.14rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: ${(p) => (p.$tone === 'live' ? '#ecfdf5' : p.$tone === 'edit' ? '#fff7ed' : C.slate100)};
  color: ${(p) => (p.$tone === 'live' ? C.emerald : p.$tone === 'edit' ? C.amber : C.slate600)};
  border: 1px solid ${(p) => (p.$tone === 'live' ? '#a7f3d0' : p.$tone === 'edit' ? '#fed7aa' : C.slate200)};
`;

const DetailBody = styled.div`
  padding: 1rem 1.15rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const SectionPanel = styled.section`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 14px;
  padding: 0.9rem 1rem 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: ${(p) => (p.$tight ? '0' : '0.7rem')};
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  font-weight: 800;
  color: ${C.slate800};
`;

const SectionIcon = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => p.$bg || C.blueLight};
  font-size: 0.9rem;
`;

const FactGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const Fact = styled.div`
  min-width: 0;
`;

const FactLabel = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${C.slate400};
  margin-bottom: 0.18rem;
`;

const FactValue = styled.div`
  font-size: 0.88rem;
  font-weight: 700;
  color: ${(p) => (p.$empty ? C.slate400 : C.slate800)};
  line-height: 1.4;
  word-break: break-word;
  white-space: ${(p) => (p.$multiline ? 'pre-wrap' : 'normal')};
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${C.slate500};
`;

const Input = styled.input`
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 9px;
  font-size: 0.84rem;
  color: ${C.slate800};
  font-weight: 600;
  &:disabled { background: ${C.slate50}; color: ${C.slate600}; }
  &:focus { outline: none; border-color: ${C.blue}; box-shadow: 0 0 0 3px ${C.blueLight}; }
`;

const TextArea = styled.textarea`
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 9px;
  font-size: 0.84rem;
  color: ${C.slate800};
  min-height: 72px;
  resize: vertical;
  font-family: inherit;
  &:disabled { background: ${C.slate50}; }
  &:focus { outline: none; border-color: ${C.blue}; box-shadow: 0 0 0 3px ${C.blueLight}; }
`;

const GhostBtn = styled.button`
  padding: 0.42rem 0.8rem;
  border-radius: 9px;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate700};
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  &:hover { border-color: ${C.blue}; color: ${C.blueDark}; }
`;

const DangerBtn = styled(GhostBtn)`
  color: #b91c1c;
  border-color: #fecaca;
  &:hover { border-color: #dc2626; color: #991b1b; background: #fef2f2; }
`;

const PrimaryBtn = styled.button`
  padding: 0.42rem 0.9rem;
  border-radius: 9px;
  border: none;
  background: ${C.blue};
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  &:hover:not(:disabled) { background: ${C.blueDark}; }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const ItemCard = styled.div`
  border: 1px solid ${C.slate200};
  border-left: 3px solid ${(p) => (p.$live ? C.emerald : p.$warn ? C.amber : C.slate200)};
  border-radius: 12px;
  padding: 0.7rem 0.8rem 0.75rem;
  background: ${C.white};
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const ItemTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
`;

const ItemTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: ${C.slate800};
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ItemSub = styled.div`
  font-size: 0.7rem;
  color: ${C.slate500};
  margin-top: 0.18rem;
  line-height: 1.4;
`;

const ItemMeta = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 0.45rem 0.75rem;
  margin-top: 0.65rem;
  padding-top: 0.55rem;
  border-top: 1px dashed ${C.slate200};
`;

const MetaStat = styled.div`
  min-width: 0;
`;

const MetaStatLabel = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${C.slate400};
  margin-bottom: 0.12rem;
`;

const MetaStatValue = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: ${(p) => (p.$accent ? C.blueDark : C.slate800)};
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 11rem;
  padding: 0.16rem 0.5rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${(p) => (p.$active ? '#ecfdf5' : p.$warn ? '#fff7ed' : C.white)};
  color: ${(p) => (p.$active ? C.emerald : p.$warn ? C.amber : C.slate600)};
  border: 1px solid ${(p) => (p.$active ? '#a7f3d0' : p.$warn ? '#fed7aa' : C.slate200)};
`;

const EmptyBox = styled.div`
  padding: 0.95rem 0.7rem;
  text-align: center;
  color: ${C.slate500};
  font-size: 0.78rem;
  line-height: 1.45;
  background: ${C.slate50};
  border: 1px dashed ${C.slate200};
  border-radius: 10px;
`;

const InfoNote = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: ${C.slate500};
  line-height: 1.45;
  padding: 0.55rem 0.7rem;
  background: #eff6ff;
  border: 1px solid ${C.blueLight};
  border-radius: 10px;
`;

const Select = styled.select`
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 9px;
  font-size: 0.84rem;
  color: ${C.slate800};
  font-weight: 600;
  background: ${C.white};
  font-family: inherit;
  &:disabled { background: ${C.slate50}; color: ${C.slate600}; }
  &:focus { outline: none; border-color: ${C.blue}; box-shadow: 0 0 0 3px ${C.blueLight}; }
`;

const GuaranteeForm = styled.div`
  margin: 0 0 0.7rem;
  padding: 0.85rem;
  border: 1px solid ${C.blueLight};
  border-radius: 12px;
  background: #f8fbff;
`;

const FormError = styled.div`
  color: #be123c;
  font-size: 0.75rem;
  font-weight: 700;
  margin-bottom: 0.55rem;
`;

const LinkBtn = styled.button`
  border: none;
  background: none;
  color: ${C.blue};
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  &:disabled { color: ${C.slate400}; cursor: not-allowed; }
  &:hover:not(:disabled) { text-decoration: underline; }
`;

const DangerLink = styled(LinkBtn)`
  color: #be123c;
`;

const ItemActions = styled.div`
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
`;

function emptyGuaranteeForm(choices) {
  const first = choices[0] || {};
  return {
    id: '',
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    amount: '',
    bank: '',
    letterNumber: '',
    issuedOn: '',
    expiresOn: '',
    subprojectId: first.subprojectId || '',
    projectId: first.projectId || '',
    notes: '',
  };
}

function formFromGuarantee(g, choices) {
  const match = (choices || []).find((c) => c.subprojectId === g.subprojectId);
  return {
    id: g.id || '',
    type: g.type || 'καλής εκτέλεσης',
    status: g.status || 'ενεργή',
    amount: g.amount == null ? '' : String(g.amount),
    bank: g.bank || '',
    letterNumber: g.letterNumber || '',
    issuedOn: g.issuedOn || '',
    expiresOn: g.expiresOn || '',
    subprojectId: g.subprojectId || '',
    projectId: g.projectId || match?.projectId || '',
    notes: g.notes || '',
  };
}

function contractorInitials(name) {
  const parts = String(name || '').trim().split(/[\s.&]+/).filter((p) => p && /[A-Za-zΑ-Ωα-ωΆ-Ώά-ώ]/.test(p));
  const letters = parts.slice(0, 2).map((p) => p[0]).join('');
  return letters.toLocaleUpperCase('el') || 'Α';
}

function readableTitle(text) {
  const raw = String(text || '').trim();
  if (raw.length < 18) return raw;
  const letters = raw.replace(/[^A-Za-zΑ-Ωα-ωΆ-ώ]/g, '');
  if (letters.length < 12) return raw;
  const lowers = raw.replace(/[^a-zα-ωάέήίόύώϊϋΐΰ]/g, '');
  if (lowers.length / Math.max(letters.length, 1) > 0.12) return raw;
  const lower = raw.toLocaleLowerCase('el-GR');
  return lower.charAt(0).toLocaleUpperCase('el-GR') + lower.slice(1);
}

function textOrEmpty(value) {
  return String(value == null ? '' : value).trim();
}

function contractStatusShort(status) {
  const s = String(status || '');
  if (/ΕΚΤΕΛΟΥΜΕΝΟ/i.test(s)) return 'Εκτελούμενο';
  if (/ΑΠΟΠΛΗΡΩΜΕΝΟ/i.test(s)) return 'Ολοκληρωμένο';
  if (/ΟΛΟΚΛΗΡΩΜΕΝΟ/i.test(s)) return 'Ολοκληρωμένο';
  if (/ΑΠΕΝΤΑΓ/i.test(s)) return 'Απενταγμένο';
  return s || '—';
}

function guaranteeStatusLabel(status) {
  return status || '—';
}

function emptyAcceptanceForm(choices) {
  const first = choices[0] || {};
  return {
    id: '',
    subprojectId: first.subprojectId || '',
    projectId: first.projectId || '',
    provisionalDate: '',
    finalDate: '',
    warrantyEndsOn: '',
    notes: '',
  };
}

function formFromAcceptance(a, choices) {
  const match = (choices || []).find((c) => c.subprojectId === a.subprojectId);
  return {
    id: a.id || '',
    subprojectId: a.subprojectId || '',
    projectId: a.projectId || match?.projectId || '',
    provisionalDate: a.provisionalDate || '',
    finalDate: a.finalDate || '',
    warrantyEndsOn: a.warrantyEndsOn || '',
    notes: a.notes || '',
  };
}

function acceptancePhaseLabel(acc) {
  if (!acc) return '—';
  if (acc.warrantyEndsOn) {
    const days = contractorRegistry.daysUntilDate(acc.warrantyEndsOn);
    if (days != null && days < 0) return 'Έληξε η εγγύηση';
    return 'Χρόνος εγγύησης';
  }
  if (acc.finalDate) return 'Οριστική παραλαβή';
  if (acc.provisionalDate) return 'Προσωρινή παραλαβή';
  return 'Εκκρεμεί';
}

function rowIdentity(row) {
  return contractorRegistry.hubRowKey(row);
}

function ContractorRegistryManager({
  onClose,
  loggedInUsername,
  userRole,
  visibleSubprojectIds = null,
  projects = [],
  initialRowKey = null,
  focusNonce = 0,
}) {
  const { showToast } = useToast();
  const isReadOnly = contractorRegistry.isContractorRegistryReadOnly(userRole);
  const canEdit = contractorRegistry.canEditGuarantees(userRole);
  const canManage = contractorRegistry.canManageContractorRegistry(userRole);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [draft, setDraft] = useState({ phone: '', email: '', notes: '' });
  const [guaranteesDraft, setGuaranteesDraft] = useState([]);
  const [guaranteeForm, setGuaranteeForm] = useState(null);
  const [guaranteeFormError, setGuaranteeFormError] = useState('');
  const [acceptancesDraft, setAcceptancesDraft] = useState([]);
  const [acceptanceForm, setAcceptanceForm] = useState(null);
  const [acceptanceFormError, setAcceptanceFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lockBlocked, setLockBlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const lockedIdRef = useRef(null);
  const selectedKeyRef = useRef(null);
  const consumedFocusRef = useRef(null);
  const rebindAfterLoadRef = useRef(null);

  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
      const id = lockedIdRef.current;
      if (id) ipcRenderer.invoke('remove-entity-lock', 'contractor-registry', id);
    };
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('load-contractor-registry', {
        actingUsername: loggedInUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αδυναμία φόρτωσης μητρώου αναδόχων', 'error');
        setRecords([]);
        return;
      }
      setRecords(res.records || []);
    } catch (e) {
      showToast(e.message || 'Αδυναμία φόρτωσης μητρώου αναδόχων', 'error');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [loggedInUsername, showToast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const hubRows = useMemo(() => {
    const profiles = buildContractorProfiles(projects);
    const rows = contractorRegistry.buildContractorHubRows(profiles, records);
    return contractorRegistry.filterHubForViewer(rows, {
      role: userRole,
      visibleSubprojectIds,
    });
  }, [projects, records, userRole, visibleSubprojectIds]);

  const filteredRows = useMemo(
    () => contractorRegistry.filterContractorHub(hubRows, { search }),
    [hubRows, search]
  );

  const selected = useMemo(
    () => hubRows.find((row) => rowIdentity(row) === selectedKey) || null,
    [hubRows, selectedKey]
  );

  const dirty = selected && (
    draft.phone !== (selected.phone || '')
    || draft.email !== (selected.email || '')
    || draft.notes !== (selected.registryNotes || selected.notes || '')
    || contractorRegistry.guaranteesFingerprint(guaranteesDraft)
      !== contractorRegistry.guaranteesFingerprint(selected.guarantees || [])
    || contractorRegistry.acceptancesFingerprint(acceptancesDraft)
      !== contractorRegistry.acceptancesFingerprint(selected.acceptances || [])
  );
  const hasUnsavedWork = editing && (dirty || guaranteeForm || acceptanceForm);

  const applyRowDraft = (row) => {
    setDraft({
      phone: row?.phone || '',
      email: row?.email || '',
      notes: row?.registryNotes || row?.notes || '',
    });
    setGuaranteesDraft(row?.guarantees || []);
    setGuaranteeForm(null);
    setGuaranteeFormError('');
    setAcceptancesDraft(row?.acceptances || []);
    setAcceptanceForm(null);
    setAcceptanceFormError('');
  };

  const releaseLock = useCallback(() => {
    const id = lockedIdRef.current;
    if (!id) return;
    ipcRenderer.invoke('remove-entity-lock', 'contractor-registry', id);
    lockedIdRef.current = null;
  }, []);

  const openRow = async (row) => {
    const key = rowIdentity(row);
    setSelectedKey(key);
    selectedKeyRef.current = key;
    applyRowDraft(row);
    setEditing(false);
    setLockBlocked(false);
    releaseLock();
  };

  const enterEdit = async () => {
    if (!canEdit || !selected) return;
    const lockId = selected.registryId
      || contractorRegistry.contractorPendingLockId(selected);
    if (lockId) {
      const lock = await ipcRenderer.invoke(
        'create-entity-lock',
        'contractor-registry',
        lockId,
        loggedInUsername || ''
      );
      if (!lock?.success) {
        setLockBlocked(true);
        showToast(`Η καρτέλα είναι ανοιχτή από ${lock?.lockedBy || 'άλλον χρήστη'} — μόνο ανάγνωση`, 'warning');
        return;
      }
      lockedIdRef.current = lockId;
    }
    setLockBlocked(false);
    applyRowDraft(selected);
    setEditing(true);
  };

  const exitEdit = async () => {
    if (hasUnsavedWork) {
      const ok = await showConfirm({
        title: 'Μη αποθηκευμένες αλλαγές',
        message: 'Θέλετε να επιστρέψετε στην προβολή χωρίς αποθήκευση;',
        confirmLabel: 'Ναι, προβολή',
        cancelLabel: 'Άκυρο',
        danger: false,
        icon: '💾',
      });
      if (!ok) return;
    }
    applyRowDraft(selected);
    setEditing(false);
    setLockBlocked(false);
    releaseLock();
  };

  useEffect(() => {
    const bindId = rebindAfterLoadRef.current;
    if (!bindId || loading) return;
    const row = hubRows.find((r) => (
      r.registryId === bindId || rowIdentity(r) === bindId
    ));
    if (!row) return;
    rebindAfterLoadRef.current = null;
    setEditing(false);
    setLockBlocked(false);
    releaseLock();
    void openRow(row);
  }, [loading, hubRows, releaseLock]);

  useEffect(() => {
    if (!initialRowKey || loading) return;
    const stamp = `${focusNonce}:${initialRowKey}`;
    if (consumedFocusRef.current === stamp) return;
    const row = hubRows.find((r) => {
      const key = rowIdentity(r);
      return key === initialRowKey
        || r.registryId === initialRowKey
        || r.identityKey === initialRowKey;
    });
    if (!row) return;
    consumedFocusRef.current = stamp;
    void openRow(row);
  }, [initialRowKey, focusNonce, loading, hubRows]);

  const requestBack = async () => {
    if (hasUnsavedWork) {
      const ok = await showConfirm({
        title: 'Μη αποθηκευμένες αλλαγές',
        message: 'Θέλετε να φύγετε χωρίς αποθήκευση;',
        confirmLabel: 'Ναι, φύγε',
        cancelLabel: 'Άκυρο',
        danger: false,
        icon: '💾',
      });
      if (!ok) return;
    }
    releaseLock();
    setEditing(false);
    setLockBlocked(false);
    setSelectedKey(null);
    selectedKeyRef.current = null;
    consumedFocusRef.current = null;
  };

  const handleClose = async () => {
    if (selectedKey && hasUnsavedWork) {
      const ok = await showConfirm({
        title: 'Μη αποθηκευμένες αλλαγές',
        message: 'Θέλετε να κλείσετε χωρίς αποθήκευση;',
        confirmLabel: 'Ναι, κλείσε',
        cancelLabel: 'Άκυρο',
        danger: false,
        icon: '💾',
      });
      if (!ok) return;
    }
    releaseLock();
    onClose?.();
  };

  const saveCard = async (overrides = {}) => {
    if (!selected || !canEdit || lockBlocked) return false;
    const nextGuarantees = Object.prototype.hasOwnProperty.call(overrides, 'guarantees')
      ? overrides.guarantees
      : guaranteesDraft;
    const nextAcceptances = Object.prototype.hasOwnProperty.call(overrides, 'acceptances')
      ? overrides.acceptances
      : acceptancesDraft;
    const payload = {
      id: selected.registryId || undefined,
      name: selected.name,
      vat: selected.vat,
      phone: overrides.phone != null ? overrides.phone : draft.phone,
      email: overrides.email != null ? overrides.email : draft.email,
      notes: overrides.notes != null ? overrides.notes : draft.notes,
      guarantees: nextGuarantees,
      acceptances: nextAcceptances,
    };
    const ident = contractorRegistry.evaluateContractorIdentity(payload);
    if (!ident.ok) {
      showToast(ident.error, 'error');
      return false;
    }
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('save-contractor-registry-record', {
        record: payload,
        actingUsername: loggedInUsername,
        expectedUpdatedAt: selected.updatedAt || undefined,
        assignments: selected.assignments || [],
      });
      if (!res?.success) {
        if (res?.conflict || res?.duplicate) {
          const bindId = res.existingId || res.record?.id;
          if (bindId) rebindAfterLoadRef.current = bindId;
          showToast(res.error || (res.duplicate
            ? 'Υπάρχει ήδη καρτέλα για αυτόν τον ανάδοχο. Ανοίγει η αποθηκευμένη.'
            : 'Η καρτέλα άλλαξε από άλλον. Φορτώνεται η τρέχουσα.'), 'warning');
          await loadRecords();
          return false;
        }
        showToast(res?.error || 'Η αποθήκευση απέτυχε', 'error');
        return false;
      }
      const savedId = res.record?.id;
      if (savedId && lockedIdRef.current !== savedId && canEdit) {
        releaseLock();
        const lock = await ipcRenderer.invoke(
          'create-entity-lock',
          'contractor-registry',
          savedId,
          loggedInUsername || ''
        );
        if (lock?.success) lockedIdRef.current = savedId;
        else setLockBlocked(true);
      }
      await loadRecords();
      setSelectedKey(savedId || selectedKey);
      selectedKeyRef.current = savedId || selectedKey;
      setDraft({
        phone: res.record?.phone || '',
        email: res.record?.email || '',
        notes: res.record?.notes || '',
      });
      setGuaranteesDraft(res.record?.guarantees || []);
      setAcceptancesDraft(res.record?.acceptances || []);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    const ok = await saveCard();
    if (ok) showToast('Τα στοιχεία αποθηκεύτηκαν', 'success');
  };

  const deleteCard = async () => {
    if (!canManage || !selected?.registryId || saving) return;
    const ok = await showConfirm({
      title: 'Διαγραφή καρτέλας αναδόχου',
      message: `Να διαγραφεί οριστικά η καρτέλα «${selected.name || selected.vat || 'ανάδοχος'}»; Θα αφαιρεθούν εγγυητικές, παραλαβές και στοιχεία επικοινωνίας.`,
      confirmLabel: 'Διαγραφή',
      cancelLabel: 'Άκυρο',
      danger: true,
      icon: '🗑',
    });
    if (!ok) return;
    const lockId = selected.registryId;
    if (lockedIdRef.current !== lockId) {
      const lock = await ipcRenderer.invoke(
        'create-entity-lock',
        'contractor-registry',
        lockId,
        loggedInUsername || ''
      );
      if (!lock?.success) {
        showToast(`Η καρτέλα είναι ανοιχτή από ${lock?.lockedBy || 'άλλον χρήστη'}`, 'warning');
        return;
      }
      lockedIdRef.current = lockId;
    }
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('delete-contractor-registry-record', {
        recordId: lockId,
        actingUsername: loggedInUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Η διαγραφή απέτυχε', 'error');
        return;
      }
      releaseLock();
      setEditing(false);
      setSelectedKey(null);
      selectedKeyRef.current = null;
      applyRowDraft(null);
      await loadRecords();
      showToast('Η καρτέλα διαγράφηκε', 'success');
    } finally {
      setSaving(false);
    }
  };

  const activeContracts = (selected?.assignments || []).filter(contractorRegistry.assignmentIsActive);
  const otherContracts = (selected?.assignments || []).filter((a) => !contractorRegistry.assignmentIsActive(a));
  const viewerOpts = { role: userRole, visibleSubprojectIds };
  const subprojectChoices = contractorRegistry.filterSubprojectChoicesForViewer(
    contractorRegistry.subprojectChoicesFromAssignments(selected?.assignments || []),
    viewerOpts,
  );
  const sortedGuarantees = contractorRegistry.sortGuarantees(
    contractorRegistry.filterLinkedItemsForViewer(guaranteesDraft, viewerOpts),
  );
  const sortedAcceptances = contractorRegistry.sortAcceptances(
    contractorRegistry.filterLinkedItemsForViewer(acceptancesDraft, viewerOpts),
  );
  const acceptanceChoices = contractorRegistry.subprojectChoicesWithoutAcceptance(
    subprojectChoices,
    acceptancesDraft,
  );
  const fieldsLocked = !editing || !canEdit || lockBlocked;
  const phoneWritable = editing && !fieldsLocked
    && contractorRegistry.canEditContactField(selected?.phone, userRole);
  const emailWritable = editing && !fieldsLocked
    && contractorRegistry.canEditContactField(selected?.email, userRole);
  const notesWritable = editing && !fieldsLocked
    && contractorRegistry.canEditContactField(selected?.registryNotes || selected?.notes, userRole);
  const contactInEdit = phoneWritable || emailWritable || notesWritable;

  const submitGuaranteeForm = async () => {
    if (!guaranteeForm || fieldsLocked) return;
    const choice = subprojectChoices.find((c) => c.subprojectId === guaranteeForm.subprojectId);
    const evaluated = contractorRegistry.evaluateGuarantee({
      ...guaranteeForm,
      projectId: choice?.projectId || guaranteeForm.projectId,
    });
    if (!evaluated.ok) {
      setGuaranteeFormError(evaluated.error);
      return;
    }
    if (!contractorRegistry.guaranteeIsEditable(evaluated.guarantee, viewerOpts)) {
      setGuaranteeFormError('Δεν έχετε δικαίωμα καταχώρισης για αυτό το υποέργο');
      return;
    }
    setGuaranteeFormError('');
    const next = contractorRegistry.upsertGuaranteeInList(guaranteesDraft, evaluated.guarantee);
    const ok = await saveCard({ guarantees: next });
    if (ok) {
      setGuaranteeForm(null);
      showToast(guaranteeForm.id ? 'Η εγγυητική ενημερώθηκε' : 'Η εγγυητική καταχωρίστηκε', 'success');
    }
  };

  const markGuaranteeStatus = async (guarantee, status) => {
    if (fieldsLocked || !contractorRegistry.guaranteeIsEditable(guarantee, viewerOpts)) return;
    const evaluated = contractorRegistry.evaluateGuarantee({ ...guarantee, status });
    if (!evaluated.ok) {
      showToast(evaluated.error, 'error');
      return;
    }
    const next = contractorRegistry.upsertGuaranteeInList(guaranteesDraft, evaluated.guarantee);
    const ok = await saveCard({ guarantees: next });
    if (ok) showToast('Η κατάσταση της εγγυητικής ενημερώθηκε', 'success');
  };

  const deleteGuarantee = async (guarantee) => {
    if (fieldsLocked || !contractorRegistry.guaranteeIsEditable(guarantee, viewerOpts)) return;
    const ok = await showConfirm({
      title: 'Διαγραφή εγγυητικής',
      message: 'Να αφαιρεθεί αυτή η εγγυητική από την καρτέλα;',
      confirmLabel: 'Διαγραφή',
      cancelLabel: 'Άκυρο',
    });
    if (!ok) return;
    const next = contractorRegistry.removeGuaranteeFromList(guaranteesDraft, guarantee.id);
    const saved = await saveCard({ guarantees: next });
    if (saved) showToast('Η εγγυητική αφαιρέθηκε', 'success');
  };

  const submitAcceptanceForm = async () => {
    if (!acceptanceForm || fieldsLocked) return;
    const choice = subprojectChoices.find((c) => c.subprojectId === acceptanceForm.subprojectId);
    const evaluated = contractorRegistry.evaluateAcceptance({
      ...acceptanceForm,
      projectId: choice?.projectId || acceptanceForm.projectId,
    });
    if (!evaluated.ok) {
      setAcceptanceFormError(evaluated.error);
      return;
    }
    if (!contractorRegistry.acceptanceIsEditable(evaluated.acceptance, viewerOpts)) {
      setAcceptanceFormError('Δεν έχετε δικαίωμα καταχώρισης για αυτό το υποέργο');
      return;
    }
    setAcceptanceFormError('');
    const next = contractorRegistry.upsertAcceptanceInList(acceptancesDraft, evaluated.acceptance);
    const ok = await saveCard({ acceptances: next });
    if (ok) {
      setAcceptanceForm(null);
      showToast(acceptanceForm.id ? 'Οι ημερομηνίες ενημερώθηκαν' : 'Οι ημερομηνίες καταχωρίστηκαν', 'success');
    }
  };

  const deleteAcceptance = async (acceptance) => {
    if (fieldsLocked || !contractorRegistry.acceptanceIsEditable(acceptance, viewerOpts)) return;
    const ok = await showConfirm({
      title: 'Διαγραφή παραλαβής',
      message: 'Να αφαιρεθούν οι ημερομηνίες παραλαβής και εγγύησης για αυτό το υποέργο;',
      confirmLabel: 'Διαγραφή',
      cancelLabel: 'Άκυρο',
    });
    if (!ok) return;
    const next = contractorRegistry.removeAcceptanceFromList(acceptancesDraft, acceptance.id);
    const saved = await saveCard({ acceptances: next });
    if (saved) showToast('Οι ημερομηνίες αφαιρέθηκαν', 'success');
  };

  return (
    <Overlay>
      <Modal>
        <MainModalHeader>
          <HeaderTitleWrap>
            <HeaderIcon>🏢</HeaderIcon>
            <div>
              <HeaderH>Μητρώο αναδόχων</HeaderH>
              <HeaderSub>
                {filteredRows.length} {filteredRows.length === 1 ? 'ανάδοχος' : 'ανάδοχοι'} από συμβάσεις
              </HeaderSub>
            </div>
          </HeaderTitleWrap>
          <HeaderActions>
            {isReadOnly && <ReadOnlyBadge>Μόνο ανάγνωση</ReadOnlyBadge>}
            <CloseBtn type="button" onClick={handleClose} aria-label="Κλείσιμο">✕</CloseBtn>
          </HeaderActions>
        </MainModalHeader>
        <Body>
          <HubShell $dimmed={!!selected}>
            <HubToolbarCard>
              <HubSearch
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Αναζήτηση επωνυμίας, ΑΦΜ, τηλεφώνου…"
                aria-label="Αναζήτηση αναδόχου"
              />
            </HubToolbarCard>
            {loading ? (
              <Spinner />
            ) : filteredRows.length === 0 ? (
              <EmptyState>
                {search.trim()
                  ? 'Δεν βρέθηκε ανάδοχος με αυτά τα στοιχεία.'
                  : 'Δεν υπάρχουν ακόμα ανάδοχοι από συμβάσεις.'}
              </EmptyState>
            ) : (
              <HubListWrap>
                <HubListHead>
                  <div>Επωνυμία</div>
                  <div>ΑΦΜ</div>
                  <div>Συμβάσεις</div>
                  <div>Ενεργές</div>
                  <div>Ποσό</div>
                </HubListHead>
                {filteredRows.map((row) => (
                  <HubListRow key={rowIdentity(row)} type="button" onClick={() => openRow(row)}>
                    <NameCell>
                      <NameTitle>{row.name || 'Χωρίς επωνυμία'}</NameTitle>
                      <NameSub>
                        {row.phone || row.email || (row.orphan ? 'Χωρίς σύμβαση στο χαρτοφυλάκιο' : 'Κλικ για καρτέλα')}
                      </NameSub>
                    </NameCell>
                    <Cell>{row.vat || '—'}</Cell>
                    <Cell>{row.count || (row.assignments || []).length || 0}</Cell>
                    <Cell>{contractorRegistry.countActiveAssignments(row)}</Cell>
                    <Cell>{row.amount ? formatKhmdhsEuro(row.amount) : '—'}</Cell>
                  </HubListRow>
                ))}
              </HubListWrap>
            )}
          </HubShell>

          {selected && (
            <DetailOverlay>
              <DetailCard>
                <DetailHead>
                  <DetailIdentity>
                    <Avatar aria-hidden>{contractorInitials(selected.name)}</Avatar>
                    <div style={{ minWidth: 0 }}>
                      <DetailTitle>{selected.name || 'Ανάδοχος'}</DetailTitle>
                      <ChipRow>
                        <Chip>ΑΦΜ {selected.vat || '—'}</Chip>
                        {activeContracts.length > 0 && (
                          <Chip $tone="live">
                            {activeContracts.length === 1
                              ? '1 εκτελούμενη σύμβαση'
                              : `${activeContracts.length} εκτελούμενες συμβάσεις`}
                          </Chip>
                        )}
                        {editing && <Chip $tone="edit">Επεξεργασία</Chip>}
                        {selected.duplicate && <Chip>Διπλή καρτέλα</Chip>}
                        {selected.orphan && !selected.duplicate && <Chip>Χωρίς σύμβαση στο χαρτοφυλάκιο</Chip>}
                      </ChipRow>
                    </div>
                  </DetailIdentity>
                  <HeaderActions>
                    {editing ? (
                      <>
                        <PrimaryBtn type="button" onClick={saveContact} disabled={saving || !dirty}>
                          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                        </PrimaryBtn>
                        <GhostBtn type="button" onClick={exitEdit}>Τέλος επεξεργασίας</GhostBtn>
                      </>
                    ) : (
                      canEdit && (
                        <PrimaryBtn type="button" onClick={enterEdit}>Επεξεργασία</PrimaryBtn>
                      )
                    )}
                    {canManage && selected.registryId && (
                      <DangerBtn type="button" onClick={deleteCard} disabled={saving}>
                        Διαγραφή καρτέλας
                      </DangerBtn>
                    )}
                    <GhostBtn type="button" onClick={requestBack}>Πίσω στη λίστα</GhostBtn>
                  </HeaderActions>
                </DetailHead>
                <DetailBody>
                  <SectionPanel>
                    <SectionHead>
                      <SectionTitle>
                        <SectionIcon>📞</SectionIcon>
                        Στοιχεία επικοινωνίας
                      </SectionTitle>
                    </SectionHead>
                    {editing && contactInEdit ? (
                      <>
                        <FieldGrid>
                          <Field>
                            Τηλέφωνο
                            {phoneWritable ? (
                              <Input
                                value={draft.phone}
                                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                                placeholder="π.χ. 2810 123456"
                              />
                            ) : (
                              <FactValue $empty={!textOrEmpty(draft.phone)}>
                                {textOrEmpty(draft.phone) || '—'}
                              </FactValue>
                            )}
                          </Field>
                          <Field>
                            Email
                            {emailWritable ? (
                              <Input
                                value={draft.email}
                                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                                placeholder="name@example.gr"
                              />
                            ) : (
                              <FactValue $empty={!textOrEmpty(draft.email)}>
                                {textOrEmpty(draft.email) || '—'}
                              </FactValue>
                            )}
                          </Field>
                        </FieldGrid>
                        <Field style={{ marginTop: '0.75rem' }}>
                          Σημειώσεις υπηρεσίας
                          {notesWritable ? (
                            <TextArea
                              value={draft.notes}
                              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                              placeholder="Επικοινωνία, παρατηρήσεις…"
                            />
                          ) : (
                            <FactValue $multiline $empty={!textOrEmpty(draft.notes)}>
                              {textOrEmpty(draft.notes) || '—'}
                            </FactValue>
                          )}
                        </Field>
                      </>
                    ) : (
                      <>
                        {!textOrEmpty(draft.phone) && !textOrEmpty(draft.email) && !textOrEmpty(draft.notes) ? (
                          <EmptyBox>Δεν έχουν καταχωρηθεί στοιχεία επικοινωνίας.</EmptyBox>
                        ) : (
                          <>
                            <FactGrid>
                              <Fact>
                                <FactLabel>Τηλέφωνο</FactLabel>
                                <FactValue $empty={!textOrEmpty(draft.phone)}>
                                  {textOrEmpty(draft.phone) || '—'}
                                </FactValue>
                              </Fact>
                              <Fact>
                                <FactLabel>Email</FactLabel>
                                <FactValue $empty={!textOrEmpty(draft.email)}>
                                  {textOrEmpty(draft.email) || '—'}
                                </FactValue>
                              </Fact>
                            </FactGrid>
                            {textOrEmpty(draft.notes) ? (
                              <Fact style={{ marginTop: '0.75rem' }}>
                                <FactLabel>Σημειώσεις υπηρεσίας</FactLabel>
                                <FactValue $multiline>{draft.notes}</FactValue>
                              </Fact>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                  </SectionPanel>

                  <SectionPanel>
                    <SectionHead>
                        <SectionTitle>
                          <SectionIcon $bg="#ecfdf5">📋</SectionIcon>
                          Ενεργές συμβάσεις
                          {activeContracts.length > 0 && <Chip $tone="live">{activeContracts.length}</Chip>}
                        </SectionTitle>
                    </SectionHead>
                    {activeContracts.length === 0 ? (
                      <EmptyBox>Δεν υπάρχει εκτελούμενη σύμβαση.</EmptyBox>
                    ) : (
                      <ItemList>
                        {activeContracts.map((a) => (
                          <ItemCard key={`${a.subprojectId}-${a.adam || a.contractIndex || ''}`} $live>
                            <ItemTop>
                              <div style={{ minWidth: 0 }}>
                                <ItemTitle>{readableTitle(a.subprojectTitle || a.projectTitle || 'Υποέργο')}</ItemTitle>
                                {a.projectTitle && a.subprojectTitle ? (
                                  <ItemSub>{readableTitle(a.projectTitle)}</ItemSub>
                                ) : null}
                              </div>
                              <StatusPill $active>Εκτελούμενο</StatusPill>
                            </ItemTop>
                            <ItemMeta>
                              <MetaStat>
                                <MetaStatLabel>Ημερομηνία</MetaStatLabel>
                                <MetaStatValue>{a.contractDate ? formatDateEl(a.contractDate) : '—'}</MetaStatValue>
                              </MetaStat>
                              <MetaStat>
                                <MetaStatLabel>Ποσό</MetaStatLabel>
                                <MetaStatValue $accent>{a.amount ? formatKhmdhsEuro(a.amount) : '—'}</MetaStatValue>
                              </MetaStat>
                            </ItemMeta>
                          </ItemCard>
                        ))}
                      </ItemList>
                    )}
                  </SectionPanel>

                  {otherContracts.length > 0 && (
                    <SectionPanel>
                      <SectionHead>
                        <SectionTitle>
                          <SectionIcon $bg="#f1f5f9">📁</SectionIcon>
                          Ιστορικό συμβάσεων
                          <Chip>{otherContracts.length}</Chip>
                        </SectionTitle>
                      </SectionHead>
                      <ItemList>
                        {otherContracts.map((a) => (
                          <ItemCard key={`${a.subprojectId}-h-${a.adam || a.contractIndex || ''}`}>
                            <ItemTop>
                              <div style={{ minWidth: 0 }}>
                                <ItemTitle>{readableTitle(a.subprojectTitle || a.projectTitle || 'Υποέργο')}</ItemTitle>
                                {a.projectTitle && a.subprojectTitle ? (
                                  <ItemSub>{readableTitle(a.projectTitle)}</ItemSub>
                                ) : null}
                              </div>
                              <StatusPill>{contractStatusShort(a.projectStatus)}</StatusPill>
                            </ItemTop>
                            <ItemMeta>
                              <MetaStat>
                                <MetaStatLabel>Ημερομηνία</MetaStatLabel>
                                <MetaStatValue>{a.contractDate ? formatDateEl(a.contractDate) : '—'}</MetaStatValue>
                              </MetaStat>
                              <MetaStat>
                                <MetaStatLabel>Ποσό</MetaStatLabel>
                                <MetaStatValue $accent>{a.amount ? formatKhmdhsEuro(a.amount) : '—'}</MetaStatValue>
                              </MetaStat>
                            </ItemMeta>
                          </ItemCard>
                        ))}
                      </ItemList>
                    </SectionPanel>
                  )}

                  <SectionPanel>
                    <SectionHead>
                      <SectionTitle>
                        <SectionIcon $bg="#eef2ff">🏦</SectionIcon>
                        Εγγυητικές επιστολές
                        {sortedGuarantees.length > 0 && <Chip>{sortedGuarantees.length}</Chip>}
                      </SectionTitle>
                      {editing && canEdit && !lockBlocked && subprojectChoices.length > 0 && (
                        <GhostBtn
                          type="button"
                          onClick={() => {
                            setAcceptanceForm(null);
                            setAcceptanceFormError('');
                            setGuaranteeFormError('');
                            setGuaranteeForm(emptyGuaranteeForm(subprojectChoices));
                          }}
                        >
                          + Νέα εγγυητική
                        </GhostBtn>
                      )}
                    </SectionHead>

                  {editing && canEdit && !lockBlocked && subprojectChoices.length === 0 && (
                    <InfoNote>Για να καταχωρίσετε εγγυητική, ο ανάδοχος πρέπει να έχει σύμβαση σε υποέργο.</InfoNote>
                  )}

                  {editing && guaranteeForm && (
                    <GuaranteeForm>
                      {guaranteeFormError && <FormError>{guaranteeFormError}</FormError>}
                      <FieldGrid>
                        <Field>
                          Είδος
                          <Select
                            value={guaranteeForm.type}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, type: e.target.value }))}
                          >
                            {contractorRegistry.GUARANTEE_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field>
                          Κατάσταση
                          <Select
                            value={guaranteeForm.status}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, status: e.target.value }))}
                          >
                            {contractorRegistry.GUARANTEE_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field>
                          Ποσό (€)
                          <Input
                            value={guaranteeForm.amount}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="όπως στο χαρτί, π.χ. 1.234,56"
                          />
                        </Field>
                        <Field>
                          Τράπεζα
                          <Input
                            value={guaranteeForm.bank}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, bank: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          Αριθμός επιστολής
                          <Input
                            value={guaranteeForm.letterNumber}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, letterNumber: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          Υποέργο
                          <Select
                            value={guaranteeForm.subprojectId}
                            onChange={(e) => {
                              const choice = subprojectChoices.find((c) => c.subprojectId === e.target.value);
                              setGuaranteeForm((f) => ({
                                ...f,
                                subprojectId: e.target.value,
                                projectId: choice?.projectId || '',
                              }));
                            }}
                          >
                            {subprojectChoices.map((c) => (
                              <option key={c.subprojectId} value={c.subprojectId}>{c.label}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field>
                          Έκδοση
                          <Input
                            type="date"
                            value={guaranteeForm.issuedOn}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, issuedOn: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          Λήξη
                          <Input
                            type="date"
                            value={guaranteeForm.expiresOn}
                            onChange={(e) => setGuaranteeForm((f) => ({ ...f, expiresOn: e.target.value }))}
                          />
                        </Field>
                      </FieldGrid>
                      <Field style={{ marginTop: '0.75rem' }}>
                        Σημειώσεις
                        <TextArea
                          value={guaranteeForm.notes}
                          onChange={(e) => setGuaranteeForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </Field>
                      <HeaderActions style={{ marginTop: '0.75rem' }}>
                        <PrimaryBtn type="button" onClick={submitGuaranteeForm} disabled={saving}>
                          {guaranteeForm.id ? 'Ενημέρωση εγγυητικής' : 'Καταχώριση εγγυητικής'}
                        </PrimaryBtn>
                        <GhostBtn type="button" onClick={() => { setGuaranteeForm(null); setGuaranteeFormError(''); }}>
                          Άκυρο
                        </GhostBtn>
                      </HeaderActions>
                    </GuaranteeForm>
                  )}

                  {sortedGuarantees.length === 0 && !guaranteeForm ? (
                    <EmptyBox>Δεν έχουν καταχωρηθεί εγγυητικές.</EmptyBox>
                  ) : (
                    <ItemList>
                      {sortedGuarantees.map((g) => {
                    const editable = editing && contractorRegistry.guaranteeIsEditable(g, viewerOpts) && !lockBlocked;
                    const choice = (selected.assignments || []).find((a) => a.subprojectId === g.subprojectId);
                    const daysLeft = g.status === 'ενεργή'
                      ? contractorRegistry.daysUntilDate(g.expiresOn)
                      : null;
                    return (
                      <ItemCard
                        key={g.id || `${g.letterNumber}-${g.subprojectId}`}
                        $live={g.status === 'ενεργή' && !(daysLeft != null && daysLeft < 0)}
                        $warn={g.status === 'ενεργή' && daysLeft != null && daysLeft < 0}
                      >
                        <ItemTop>
                          <div style={{ minWidth: 0 }}>
                            <ItemTitle>{g.type}</ItemTitle>
                            <ItemSub>
                              {g.letterNumber ? `Αρ. ${g.letterNumber}` : 'Χωρίς αριθμό'}
                              {g.bank ? ` · ${g.bank}` : ''}
                              {choice ? ` · ${choice.subprojectTitle || choice.projectTitle}` : ''}
                            </ItemSub>
                          </div>
                          <StatusPill $active={g.status === 'ενεργή'} $warn={g.status === 'ενεργή' && daysLeft != null && daysLeft < 0}>
                            {guaranteeStatusLabel(g.status)}
                          </StatusPill>
                        </ItemTop>
                        <ItemMeta>
                          <MetaStat>
                            <MetaStatLabel>Έκδοση</MetaStatLabel>
                            <MetaStatValue>{g.issuedOn ? formatDateEl(g.issuedOn) : '—'}</MetaStatValue>
                          </MetaStat>
                          <MetaStat>
                            <MetaStatLabel>Λήξη</MetaStatLabel>
                            <MetaStatValue>
                              {g.expiresOn ? formatDateEl(g.expiresOn) : '—'}
                              {daysLeft != null && g.status === 'ενεργή' ? (
                                <ItemSub>
                                  {daysLeft < 0 ? `έληξε πριν ${-daysLeft} ημ.` : `σε ${daysLeft} ημ.`}
                                </ItemSub>
                              ) : null}
                            </MetaStatValue>
                          </MetaStat>
                          <MetaStat>
                            <MetaStatLabel>Ποσό</MetaStatLabel>
                            <MetaStatValue $accent>
                              {g.amount != null && g.amount !== '' ? formatKhmdhsEuro(g.amount) : '—'}
                            </MetaStatValue>
                          </MetaStat>
                        </ItemMeta>
                        {textOrEmpty(g.notes) ? (
                          <ItemSub>{g.notes}</ItemSub>
                        ) : null}
                        {editable && !saving && (
                          <ItemActions>
                            <LinkBtn type="button" onClick={() => {
                              setAcceptanceForm(null);
                              setAcceptanceFormError('');
                              setGuaranteeFormError('');
                              setGuaranteeForm(formFromGuarantee(g, subprojectChoices));
                            }}>
                              Επεξεργασία
                            </LinkBtn>
                            {g.status === 'ενεργή' && (
                              <LinkBtn type="button" onClick={() => markGuaranteeStatus(g, 'επιστράφηκε')}>Επιστροφή</LinkBtn>
                            )}
                            <DangerLink type="button" onClick={() => deleteGuarantee(g)}>Διαγραφή</DangerLink>
                          </ItemActions>
                        )}
                      </ItemCard>
                    );
                  })}
                    </ItemList>
                  )}
                  </SectionPanel>

                  <SectionPanel>
                    <SectionHead>
                      <SectionTitle>
                        <SectionIcon $bg="#ecfeff">🛡️</SectionIcon>
                        Παραλαβές και χρόνος εγγύησης
                        {sortedAcceptances.length > 0 && <Chip>{sortedAcceptances.length}</Chip>}
                      </SectionTitle>
                      {editing && canEdit && !lockBlocked && acceptanceChoices.length > 0 && (
                        <GhostBtn
                          type="button"
                          onClick={() => {
                            setGuaranteeForm(null);
                            setGuaranteeFormError('');
                            setAcceptanceFormError('');
                            setAcceptanceForm(emptyAcceptanceForm(acceptanceChoices));
                          }}
                        >
                          + Παραλαβή / εγγύηση
                        </GhostBtn>
                      )}
                    </SectionHead>

                  {editing && canEdit && !lockBlocked && subprojectChoices.length === 0 && (
                    <InfoNote>Για να καταχωρίσετε παραλαβή, ο ανάδοχος πρέπει να έχει σύμβαση σε υποέργο.</InfoNote>
                  )}

                  {editing && acceptanceForm && (
                    <GuaranteeForm>
                      {acceptanceFormError && <FormError>{acceptanceFormError}</FormError>}
                      <FieldGrid>
                        <Field>
                          Υποέργο
                          {acceptanceForm.id ? (
                            <Input
                              disabled
                              value={
                                (selected.assignments || []).find((a) => a.subprojectId === acceptanceForm.subprojectId)
                                  ?.subprojectTitle
                                || (selected.assignments || []).find((a) => a.subprojectId === acceptanceForm.subprojectId)
                                  ?.projectTitle
                                || acceptanceForm.subprojectId
                              }
                            />
                          ) : (
                            <Select
                              value={acceptanceForm.subprojectId}
                              onChange={(e) => {
                                const choice = acceptanceChoices.find((c) => c.subprojectId === e.target.value);
                                setAcceptanceForm((f) => ({
                                  ...f,
                                  subprojectId: e.target.value,
                                  projectId: choice?.projectId || '',
                                }));
                              }}
                            >
                              {acceptanceChoices.map((c) => (
                                <option key={c.subprojectId} value={c.subprojectId}>{c.label}</option>
                              ))}
                            </Select>
                          )}
                        </Field>
                        <Field>
                          Προσωρινή παραλαβή
                          <Input
                            type="date"
                            value={acceptanceForm.provisionalDate}
                            onChange={(e) => setAcceptanceForm((f) => ({ ...f, provisionalDate: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          Οριστική παραλαβή
                          <Input
                            type="date"
                            value={acceptanceForm.finalDate}
                            onChange={(e) => setAcceptanceForm((f) => ({ ...f, finalDate: e.target.value }))}
                          />
                        </Field>
                        <Field>
                          Λήξη χρόνου εγγύησης
                          <Input
                            type="date"
                            value={acceptanceForm.warrantyEndsOn}
                            onChange={(e) => setAcceptanceForm((f) => ({ ...f, warrantyEndsOn: e.target.value }))}
                          />
                        </Field>
                      </FieldGrid>
                      <Field style={{ marginTop: '0.75rem' }}>
                        Σημειώσεις
                        <TextArea
                          value={acceptanceForm.notes}
                          onChange={(e) => setAcceptanceForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </Field>
                      <HeaderActions style={{ marginTop: '0.75rem' }}>
                        <PrimaryBtn type="button" onClick={submitAcceptanceForm} disabled={saving}>
                          {acceptanceForm.id ? 'Ενημέρωση ημερομηνιών' : 'Καταχώριση ημερομηνιών'}
                        </PrimaryBtn>
                        <GhostBtn type="button" onClick={() => { setAcceptanceForm(null); setAcceptanceFormError(''); }}>
                          Άκυρο
                        </GhostBtn>
                      </HeaderActions>
                    </GuaranteeForm>
                  )}

                  {sortedAcceptances.length === 0 && !acceptanceForm ? (
                    <EmptyBox>Δεν έχουν καταχωρηθεί παραλαβές ή χρόνος εγγύησης.</EmptyBox>
                  ) : (
                    <ItemList>
                      {sortedAcceptances.map((acc) => {
                    const editable = editing && contractorRegistry.acceptanceIsEditable(acc, viewerOpts) && !lockBlocked;
                    const choice = (selected.assignments || []).find((a) => a.subprojectId === acc.subprojectId);
                    const daysLeft = acc.warrantyEndsOn
                      ? contractorRegistry.daysUntilDate(acc.warrantyEndsOn)
                      : null;
                    const phase = acceptancePhaseLabel(acc);
                    const warn = phase === 'Έληξε η εγγύηση';
                    const live = phase === 'Χρόνος εγγύησης';
                    return (
                      <ItemCard key={acc.id || acc.subprojectId} $live={live} $warn={warn}>
                        <ItemTop>
                          <div style={{ minWidth: 0 }}>
                            <ItemTitle>{readableTitle(choice?.subprojectTitle || choice?.projectTitle || 'Υποέργο')}</ItemTitle>
                          </div>
                          <StatusPill $active={live} $warn={warn}>{phase}</StatusPill>
                        </ItemTop>
                        <ItemMeta>
                          <MetaStat>
                            <MetaStatLabel>Προσωρινή</MetaStatLabel>
                            <MetaStatValue>{acc.provisionalDate ? formatDateEl(acc.provisionalDate) : '—'}</MetaStatValue>
                          </MetaStat>
                          <MetaStat>
                            <MetaStatLabel>Οριστική</MetaStatLabel>
                            <MetaStatValue>{acc.finalDate ? formatDateEl(acc.finalDate) : '—'}</MetaStatValue>
                          </MetaStat>
                          <MetaStat>
                            <MetaStatLabel>Λήξη εγγύησης</MetaStatLabel>
                            <MetaStatValue>
                              {acc.warrantyEndsOn ? formatDateEl(acc.warrantyEndsOn) : '—'}
                              {daysLeft != null && acc.warrantyEndsOn ? (
                                <ItemSub>
                                  {daysLeft < 0 ? `έληξε πριν ${-daysLeft} ημ.` : `σε ${daysLeft} ημ.`}
                                </ItemSub>
                              ) : null}
                            </MetaStatValue>
                          </MetaStat>
                        </ItemMeta>
                        {textOrEmpty(acc.notes) ? (
                          <ItemSub>{acc.notes}</ItemSub>
                        ) : null}
                        {editable && !saving && (
                          <ItemActions>
                            <LinkBtn type="button" onClick={() => {
                              setGuaranteeForm(null);
                              setGuaranteeFormError('');
                              setAcceptanceFormError('');
                              setAcceptanceForm(formFromAcceptance(acc, subprojectChoices));
                            }}>
                              Επεξεργασία
                            </LinkBtn>
                            <DangerLink type="button" onClick={() => deleteAcceptance(acc)}>Διαγραφή</DangerLink>
                          </ItemActions>
                        )}
                      </ItemCard>
                    );
                  })}
                    </ItemList>
                  )}
                  </SectionPanel>

                  {editing && (
                    <InfoNote>
                      Ποσά εγγυητικών όπως στο χαρτί της τράπεζας. Ημερομηνίες παραλαβής και λήξη εγγύησης όπως τις ορίζει η σύμβαση — χωρίς αυτόματο υπολογισμό.
                    </InfoNote>
                  )}
                </DetailBody>
              </DetailCard>
            </DetailOverlay>
          )}
        </Body>
      </Modal>
    </Overlay>
  );
}

export default ContractorRegistryManager;
