/**
 * SiteDiaryManager — η ευρεία σελίδα «Ημερολόγιο Εργοταξίου».
 *
 * Δύο προβολές: μία κάρτα ανά υποέργο (με τελευταία επίσκεψη και μικρογραφίες)
 * και χρονολόγιο όλων των επισκέψεων ανά ημέρα. Το ίδιο κέλυφος με τις Μελέτες
 * και την Ωρίμανση, σε πετρόλ/κυανό — το χρώμα της κατηγορίας «Διαδικασίες Έργων».
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { useToast } from './ToastProvider';
import SiteDiaryPanel from './SiteDiaryPanel';
import siteDiary from '../../app/core/siteDiary';
import {
  C,
  HEADER_GRADIENT,
  HEADER_STRIPE,
  BODY_GRADIENT,
  PRIMARY_GRADIENT,
  dayNumber,
  monthShort,
  weekdayName,
  longDate,
  shortDate,
} from '../utils/siteDiaryTheme';

const ipcRenderer = window.electronAPI;
const SCROLL_HOLDER = 'site-diary-manager';

const EXECUTING_STATUS = 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ';
const COMPLETED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ';
const PAID_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';

const STATUS_TONES = {
  [EXECUTING_STATUS]: { label: 'Εκτελούμενο', bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  [COMPLETED_STATUS]: { label: 'Ολοκληρωμένο', bg: '#d1fae5', text: '#064e3b', border: '#6ee7b7' },
  [PAID_STATUS]: { label: 'Αποπληρωμένο', bg: '#ccfbf1', text: '#134e4a', border: '#5eead4' },
};
const DEFAULT_STATUS_TONE = { label: 'Υποέργο', bg: C.slate100, text: C.slate600, border: C.slate300 };

const STATUS_FILTERS = [
  { key: 'executing', status: EXECUTING_STATUS, label: 'Εκτελούμενα' },
  { key: 'completed', status: COMPLETED_STATUS, label: 'Ολοκληρωμένα' },
  { key: 'paid', status: PAID_STATUS, label: 'Αποπληρωμένα' },
];

const STATUS_GROUP_ORDER = [EXECUTING_STATUS, COMPLETED_STATUS, PAID_STATUS];

const LIST_COLUMNS = 'minmax(220px, 1.8fr) 132px minmax(140px, 0.9fr) 88px 108px';

const VISIT_FILTERS_SUBPROJECTS = [
  {
    key: 'needsVisit',
    label: 'Χρειάζονται επίσκεψη',
    hint: 'Μόνο εκτελούμενα: χωρίς καμία επίσκεψη, ή τελευταία επίσκεψη πριν από πάνω από 21 ημέρες.',
    danger: true,
  },
  {
    key: 'week',
    label: 'Αυτή την εβδομάδα',
    hint: 'Υποέργα με τελευταία επίσκεψη τις τελευταίες 7 ημέρες.',
  },
  {
    key: 'attention',
    label: 'Καθυστέρηση / διακοπή',
    hint: 'Η τελευταία καταγραφή σημειώνει καθυστέρηση ή διακοπή εργασιών.',
    danger: true,
  },
];

const VISIT_FILTERS_TIMELINE = [
  {
    key: 'week',
    label: 'Αυτή την εβδομάδα',
    hint: 'Επισκέψεις των τελευταίων 7 ημερών.',
  },
  {
    key: 'orders',
    label: 'Με εντολή προς ανάδοχο',
    hint: 'Επισκέψεις στις οποίες δόθηκε εντολή στον ανάδοχο.',
  },
  {
    key: 'attention',
    label: 'Καθυστέρηση / διακοπή',
    hint: 'Επισκέψεις με καθυστέρηση ή διακοπή εργασιών.',
    danger: true,
  },
];

function statusTone(status) {
  return STATUS_TONES[String(status || '').trim()] || DEFAULT_STATUS_TONE;
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

/* ─── Κέλυφος ─────────────────────────────────────────────────────────────── */

const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: stretch;
  z-index: 9998;
  padding: 0.45rem;
  overflow: hidden;
`;

const Modal = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: 100%;
  max-width: none;
  min-height: calc(100vh - 0.9rem);
  height: calc(100vh - 0.9rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(8, 145, 178, 0.18), 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: ${slideIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
`;

const ModalHeader = styled.div`
  background: ${HEADER_GRADIENT};
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(8, 145, 178, 0.25);

  &::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: ${HEADER_STRIPE};
    opacity: 0.85;
  }
  &::after {
    content: '';
    position: absolute;
    top: -40%; right: -5%;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }
`;

const HeaderTitle = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  min-width: 0;
  z-index: 1;
`;
const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  width: 46px; height: 46px;
  border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
`;
const HeaderText = styled.div`min-width: 0;`;
const HeaderH = styled.h2`
  color: ${C.white}; margin: 0;
  font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em;
`;
const HeaderSub = styled.div`
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem; font-weight: 600; margin-top: 0.1rem;
`;
const HeaderRight = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  z-index: 1;
`;
const ReadOnlyBadge = styled.span`
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.68rem; font-weight: 800;
  white-space: nowrap;
`;
const CloseBtn = styled.button`
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 36px; height: 36px; border-radius: 10px;
  font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  &:hover { background: rgba(255, 255, 255, 0.22); color: ${C.white}; }
`;

const Body = styled.div`
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
  overflow: hidden;
  position: relative;
  background: ${BODY_GRADIENT};
`;

const HubShell = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem 1.5rem 1.35rem;
  min-height: 0;
`;

/* ─── Εργαλειοθήκη ────────────────────────────────────────────────────────── */

const HubControlsPanel = styled.div`
  position: sticky;
  top: 0;
  z-index: 4;
  margin-bottom: 1rem;
  padding: 0.9rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(236,254,255,0.92) 100%);
  border: 1px solid rgba(8, 145, 178, 0.18);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(8, 145, 178, 0.1), inset 0 1px 0 rgba(255,255,255,0.8);
  backdrop-filter: blur(10px);
`;

const HubToolbarCard = styled.div`
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  padding: 0.75rem 0.85rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
  margin-bottom: 0.75rem;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: ${HEADER_STRIPE};
  }
`;

const HubSearch = styled.input`
  flex: 1;
  min-width: 220px;
  padding: 0.55rem 0.75rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.78rem;
  font-family: inherit;
  color: ${C.slate800};
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: ${C.cyan}; box-shadow: 0 0 0 3px ${C.cyanLight}; }
`;

const HubViewToggle = styled.div`
  display: inline-flex;
  gap: 0.2rem;
  padding: 0.2rem;
  border-radius: 10px;
  background: ${C.slate100};
  border: 1px solid ${C.slate200};
`;

const HubViewBtn = styled.button`
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? PRIMARY_GRADIENT : 'transparent')};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.72rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.18s;
  &:hover { color: ${(p) => (p.$active ? C.white : C.cyanDark)}; }
`;

const FilterGroups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
`;

const FilterGroupLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${C.slate400};
  min-width: 5.8rem;
`;

const HubQuickFilterPill = styled.button`
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? 'transparent' : C.slate200)};
  background: ${(p) => (p.$active ? (p.$activeBg || PRIMARY_GRADIENT) : C.white)};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.7rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
  box-shadow: ${(p) => (p.$active ? '0 3px 12px rgba(8,145,178,0.3)' : '0 1px 3px rgba(15,23,42,0.04)')};
  &:hover { border-color: ${C.cyan}; transform: translateY(-1px); }
`;

const PillCount = styled.span`
  margin-left: 0.28rem;
  opacity: 0.78;
  font-weight: 800;
`;

const HubCountLine = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: ${C.slate500};
  margin-bottom: 0.7rem;
  strong { color: ${C.cyanDeep}; font-weight: 800; }
`;

/* ─── Λίστα ανά υποέργο (ίδια γλώσσα με τις Μελέτες) ─────────────────────── */

const HubListWrap = styled.div`
  background: ${C.white};
  border: 1px solid rgba(8, 145, 178, 0.16);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
`;

const HubListHead = styled.div`
  display: grid;
  grid-template-columns: ${LIST_COLUMNS};
  gap: 0.65rem;
  padding: 0.65rem 1.05rem;
  background: linear-gradient(90deg, ${C.slate800} 0%, ${C.cyanDark} 100%);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.88);
`;

const StatusGroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 1.05rem;
  background: linear-gradient(90deg, ${C.slate50} 0%, ${C.cyanLight} 100%);
  border-top: 1px solid ${C.slate200};
  border-bottom: 1px solid ${C.cyan}33;
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.cyanDeep};
  letter-spacing: 0.02em;
`;

const HubListRow = styled.button`
  display: grid;
  grid-template-columns: ${LIST_COLUMNS};
  gap: 0.65rem;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 0.85rem 1.05rem;
  border: none;
  border-bottom: 1px solid ${C.slate100};
  border-left: 4px solid ${(p) => p.$accent || C.slate300};
  background: ${C.white};
  cursor: pointer;
  font-family: inherit;
  animation: ${fadeIn} 0.18s ease;
  transition: background 0.15s;

  &:hover {
    background: linear-gradient(90deg, ${C.cyanLight} 0%, ${C.white} 70%);
    box-shadow: inset 0 0 0 1px ${C.cyan}22;
  }
`;

const TitleCell = styled.span`
  min-width: 0;
  display: block;
`;

const RowTitle = styled.span`
  display: block;
  font-size: 0.84rem;
  font-weight: 800;
  color: ${C.slate900};
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const RowProject = styled.span`
  display: block;
  margin-top: 0.18rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate500};
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: ${(p) => p.$tone.bg};
  color: ${(p) => p.$tone.text};
  border: 1px solid ${(p) => p.$tone.border};
  font-size: 0.64rem;
  font-weight: 800;
  white-space: nowrap;
  width: fit-content;
`;

const RecencyCell = styled.span`
  min-width: 0;
  display: block;
`;

const RecencyValue = styled.span`
  display: block;
  font-size: 0.78rem;
  font-weight: 800;
  color: ${(p) => p.$tone?.text || C.slate700};
  line-height: 1.3;
`;

const RecencyDate = styled.span`
  display: block;
  margin-top: 0.12rem;
  font-size: 0.66rem;
  font-weight: 700;
  color: ${C.slate500};
`;

const CountCell = styled.span`
  display: block;
  font-size: 0.78rem;
  font-weight: 800;
  color: ${C.cyanDeep};
`;

const OpenCell = styled.span`
  justify-self: end;
  font-size: 0.7rem;
  font-weight: 800;
  color: ${C.cyanDark};
  white-space: nowrap;
`;

const MetaChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  background: ${(p) => p.$bg || C.slate100};
  color: ${(p) => p.$color || C.slate600};
  border: 1px solid ${(p) => p.$border || C.slate200};
  font-size: 0.64rem;
  font-weight: 700;
`;

/* ─── Χρονολόγιο όλων των επισκέψεων ──────────────────────────────────────── */

const FeedDay = styled.div`
  margin-bottom: 1.1rem;
`;

const FeedDayHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.5rem;
`;

const FeedDayBubble = styled.div`
  width: 2.6rem;
  padding: 0.28rem 0;
  border-radius: 11px;
  background: ${PRIMARY_GRADIENT};
  color: ${C.white};
  text-align: center;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
  flex-shrink: 0;
`;
const FeedDayNum = styled.div`font-size: 0.92rem; font-weight: 900; line-height: 1;`;
const FeedDayMonth = styled.div`
  font-size: 0.52rem; font-weight: 800; letter-spacing: 0.06em; opacity: 0.9; margin-top: 0.06rem;
`;
const FeedDayLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${C.slate500};
`;

const FeedRow = styled.button`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.4rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-left: 4px solid ${(p) => p.$accent};
  border-radius: 11px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.16s;
  &:hover {
    transform: translateX(2px);
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.09);
    border-color: ${C.cyan}66;
  }
`;

const FeedTime = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${C.slate700};
  font-variant-numeric: tabular-nums;
  min-width: 2.6rem;
`;

const FeedSubproject = styled.span`
  font-size: 0.76rem;
  font-weight: 800;
  color: ${C.slate900};
  flex: 1;
  min-width: 160px;
  overflow-wrap: anywhere;
`;

const FeedSnippet = styled.div`
  flex-basis: 100%;
  font-size: 0.74rem;
  color: ${C.slate600};
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const FeedPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: ${(p) => p.$tone.bg};
  color: ${(p) => p.$tone.text};
  border: 1px solid ${(p) => p.$tone.border};
  font-size: 0.62rem;
  font-weight: 800;
  white-space: nowrap;
`;

/* ─── Κενές καταστάσεις / detail ──────────────────────────────────────────── */

const EmptyBox = styled.div`
  padding: 3rem 1.2rem;
  text-align: center;
  background: ${C.white};
  border: 1px dashed ${C.slate300};
  border-radius: 16px;
`;
const EmptyIcon = styled.div`font-size: 2.4rem; margin-bottom: 0.6rem; opacity: 0.75;`;
const EmptyTitle = styled.div`
  font-size: 0.95rem; font-weight: 800; color: ${C.slate700}; margin-bottom: 0.3rem;
`;
const EmptyText = styled.div`
  font-size: 0.78rem; font-weight: 600; color: ${C.slate500};
  line-height: 1.55; max-width: 480px; margin: 0 auto;
`;
const LoadingBox = styled.div`
  padding: 3rem 1rem; text-align: center;
  font-size: 0.85rem; font-weight: 700; color: ${C.slate500};
`;

const DetailOverlay = styled.div`
  position: absolute; inset: 0;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 0.9rem;
  z-index: 20;
  animation: ${fadeIn} 0.16s ease;
`;

const DetailCard = styled.div`
  background: ${C.white};
  border-radius: 14px;
  width: 100%;
  max-width: 940px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, ${C.slate800} 0%, ${C.cyanDark} 100%);
  flex-shrink: 0;
`;

const DetailTitle = styled.div`
  color: ${C.white};
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
  min-width: 0;
`;

const DetailBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: ${BODY_GRADIENT};
`;

/* ─── Component ───────────────────────────────────────────────────────────── */

function SiteDiaryManager({
  onClose,
  currentUser,
  userRole,
  projects,
  initialSubprojectId = '',
}) {
  const { showToast } = useToast();
  const actingUsername = currentUser?.username || '';

  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState([]);
  const [access, setAccess] = useState({ canWrite: false, readOnly: true });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('executing');
  const [quickFilter, setQuickFilter] = useState('');
  const [view, setView] = useState('subprojects');
  const [selectedId, setSelectedId] = useState(initialSubprojectId || '');

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    lockBodyScroll(SCROLL_HOLDER);
    return () => unlockBodyScroll(SCROLL_HOLDER);
  }, []);

  const loadHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('load-site-diary-hub', { actingUsername });
      if (!mountedRef.current) return;
      if (!res?.success) {
        showToast(res?.error || 'Δεν ήταν δυνατή η φόρτωση του ημερολογίου', 'error');
        setDiaries([]);
        return;
      }
      setDiaries(res.diaries || []);
      setAccess(res.access || { canWrite: false, readOnly: true });
    } catch (e) {
      if (mountedRef.current) showToast(e?.message || 'Σφάλμα φόρτωσης', 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [actingUsername, showToast]);

  useEffect(() => { void loadHub(); }, [loadHub]);

  const today = useMemo(() => siteDiary.todayIso(), []);

  /** Ένωση υποέργων και ημερολογίων: εργοτάξια χωρίς εγγραφή εμφανίζονται κι αυτά. */
  const rows = useMemo(() => {
    const byId = new Map();

    (projects || []).forEach((p) => {
      const sid = String(p?.subprojectId || '').trim();
      if (!sid) return;
      byId.set(sid, {
        subprojectId: sid,
        projectTitle: p.projectTitle || '',
        subprojectTitle: p.subprojectTitle || '',
        projectStatus: p.projectStatus || '',
        entries: [],
      });
    });

    (diaries || []).forEach((d) => {
      const sid = String(d?.subprojectId || '').trim();
      if (!sid) return;
      const base = byId.get(sid) || {
        subprojectId: sid,
        projectTitle: d.projectTitle || '',
        subprojectTitle: d.subprojectTitle || '',
        projectStatus: '',
      };
      byId.set(sid, { ...base, entries: d.entries || [] });
    });

    return [...byId.values()]
      .filter((r) => r.entries.length > 0 || siteDiary.isSiteActiveStatus(r.projectStatus))
      .map((r) => {
        const summary = siteDiary.summarizeEntries(r.entries, { today });
        // Η «φρεσκάδα» έχει νόημα μόνο σε ενεργό εργοτάξιο — τα ολοκληρωμένα δεν
        // κοκκινίζουν επειδή δεν τα επισκέπτεται πια κανείς.
        const isExecuting = r.projectStatus === EXECUTING_STATUS;
        const tone = isExecuting ? summary.recencyTone : 'none';
        return {
          ...r,
          summary,
          isExecuting,
          recency: siteDiary.recencyColors(tone),
          recencyLabel: summary.lastVisitDate
            ? (isExecuting ? summary.recencyLabel : longDate(summary.lastVisitDate))
            : 'Καμία επίσκεψη',
          needsVisit: isExecuting && (!summary.lastVisitDate || tone === 'stale'),
        };
      });
  }, [projects, diaries, today]);

  const matchesRowSearch = useCallback((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (`${row.subprojectTitle} ${row.projectTitle}`.toLowerCase().includes(q)) return true;
    return (row.entries || []).some((e) => siteDiary.matchesEntrySearch(e, q));
  }, [search]);

  const matchesVisitFilter = useCallback((row) => {
    if (!quickFilter) return true;
    if (quickFilter === 'week') {
      const d = row.summary.lastVisitDate ? siteDiary.daysSince(row.summary.lastVisitDate, today) : null;
      return d !== null && d <= 7 && d >= 0;
    }
    if (quickFilter === 'needsVisit') return !!row.needsVisit;
    if (quickFilter === 'attention') {
      const p = row.summary.lastProgress;
      return p === 'delay' || p === 'stopped';
    }
    return true;
  }, [quickFilter, today]);

  const matchesStatusFilter = useCallback((row) => {
    if (!statusFilter) return true;
    const wanted = STATUS_FILTERS.find((f) => f.key === statusFilter);
    return wanted ? row.projectStatus === wanted.status : true;
  }, [statusFilter]);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => (
      matchesRowSearch(row) && matchesVisitFilter(row) && matchesStatusFilter(row)
    ));

    return filtered.sort((a, b) => {
      if (a.needsVisit !== b.needsVisit) return a.needsVisit ? -1 : 1;
      const da = a.summary.lastVisitDate ? (a.summary.daysSinceLastVisit ?? 0) : Number.MAX_SAFE_INTEGER;
      const db = b.summary.lastVisitDate ? (b.summary.daysSinceLastVisit ?? 0) : Number.MAX_SAFE_INTEGER;
      if (da !== db) return db - da;
      return String(a.subprojectTitle).localeCompare(String(b.subprojectTitle), 'el');
    });
  }, [rows, matchesRowSearch, matchesVisitFilter, matchesStatusFilter]);

  const groupedRows = useMemo(() => {
    if (statusFilter) return [{ status: '', rows: visibleRows }];
    const map = new Map();
    visibleRows.forEach((row) => {
      const key = STATUS_GROUP_ORDER.includes(row.projectStatus) ? row.projectStatus : '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return [...STATUS_GROUP_ORDER, ''].filter((s) => map.has(s)).map((status) => ({
      status,
      rows: map.get(status),
    }));
  }, [visibleRows, statusFilter]);

  const statusCounts = useMemo(() => {
    const base = rows.filter((row) => matchesRowSearch(row) && matchesVisitFilter(row));
    const counts = { all: base.length };
    STATUS_FILTERS.forEach((f) => {
      counts[f.key] = base.filter((r) => r.projectStatus === f.status).length;
    });
    return counts;
  }, [rows, matchesRowSearch, matchesVisitFilter]);

  const visitCounts = useMemo(() => {
    const base = rows.filter((row) => matchesRowSearch(row) && matchesStatusFilter(row));
    return {
      week: base.filter((r) => {
        const d = r.summary.lastVisitDate ? siteDiary.daysSince(r.summary.lastVisitDate, today) : null;
        return d !== null && d <= 7 && d >= 0;
      }).length,
      needsVisit: base.filter((r) => r.needsVisit).length,
      attention: base.filter((r) => r.summary.lastProgress === 'delay' || r.summary.lastProgress === 'stopped').length,
    };
  }, [rows, matchesRowSearch, matchesStatusFilter, today]);

  const feedGroups = useMemo(() => {
    if (view !== 'timeline') return [];
    const flat = [];
    visibleRows.forEach((row) => {
      (row.entries || []).forEach((entry) => {
        flat.push({ ...entry, subprojectId: row.subprojectId, subprojectTitle: row.subprojectTitle, projectTitle: row.projectTitle });
      });
    });
    const filtered = siteDiary.filterEntries(flat, {
      search,
      quickFilter: ['mine', 'week', 'attention', 'orders'].includes(quickFilter) ? quickFilter : '',
      username: actingUsername,
      today,
    });
    return siteDiary.groupEntriesByDate(filtered);
  }, [view, visibleRows, search, quickFilter, actingUsername, today]);

  const totalEntries = useMemo(
    () => rows.reduce((sum, r) => sum + r.entries.length, 0),
    [rows]
  );

  const selectedRow = useMemo(
    () => rows.find((r) => r.subprojectId === selectedId) || null,
    [rows, selectedId]
  );

  const handleDetailClose = useCallback(() => {
    setSelectedId('');
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedId) handleDetailClose();
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, handleDetailClose, onClose]);

  const feedCount = feedGroups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <Overlay onClick={() => { if (!selectedId) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <HeaderTitle>
            <HeaderIcon>🏗️</HeaderIcon>
            <HeaderText>
              <HeaderH>Ημερολόγιο Εργοταξίου</HeaderH>
              <HeaderSub>
                Επίβλεψη έργων · {totalEntries} {totalEntries === 1 ? 'επίσκεψη' : 'επισκέψεις'} σε {rows.length} {rows.length === 1 ? 'υποέργο' : 'υποέργα'}
              </HeaderSub>
            </HeaderText>
          </HeaderTitle>
          <HeaderRight>
            {access.readOnly ? <ReadOnlyBadge>👁 Προβολή μόνο</ReadOnlyBadge> : null}
            <CloseBtn type="button" onClick={onClose} title="Κλείσιμο και επιστροφή στο Dashboard">✕</CloseBtn>
          </HeaderRight>
        </ModalHeader>

        <Body>
          <HubShell>
            <HubControlsPanel>
              <HubToolbarCard>
                <HubSearch
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Αναζήτηση σε υποέργα και επισκέψεις…"
                />
                <HubViewToggle>
                  <HubViewBtn type="button" $active={view === 'subprojects'} onClick={() => setView('subprojects')}>
                    Ανά υποέργο
                  </HubViewBtn>
                  <HubViewBtn type="button" $active={view === 'timeline'} onClick={() => {
                    setView('timeline');
                    if (quickFilter === 'needsVisit') setQuickFilter('');
                  }}>
                    Χρονολόγιο
                  </HubViewBtn>
                </HubViewToggle>
              </HubToolbarCard>

              <FilterGroups>
                <FilterGroup>
                  <FilterGroupLabel>Κατάσταση</FilterGroupLabel>
                  <HubQuickFilterPill
                    type="button"
                    $active={!statusFilter}
                    title="Όλα τα υποέργα που έχουν ημερολόγιο ή βρίσκονται σε εκτέλεση και μετά"
                    onClick={() => setStatusFilter('')}
                  >
                    Όλα<PillCount>{statusCounts.all}</PillCount>
                  </HubQuickFilterPill>
                  {STATUS_FILTERS.map((f) => (
                    <HubQuickFilterPill
                      key={f.key}
                      type="button"
                      $active={statusFilter === f.key}
                      title={f.label}
                      onClick={() => setStatusFilter(statusFilter === f.key ? '' : f.key)}
                    >
                      {f.label}<PillCount>{statusCounts[f.key] || 0}</PillCount>
                    </HubQuickFilterPill>
                  ))}
                </FilterGroup>
                <FilterGroup>
                  <FilterGroupLabel>Επισκέψεις</FilterGroupLabel>
                  {(view === 'subprojects' ? VISIT_FILTERS_SUBPROJECTS : VISIT_FILTERS_TIMELINE).map((f) => (
                    <HubQuickFilterPill
                      key={f.key}
                      type="button"
                      $active={quickFilter === f.key}
                      $activeBg={f.danger ? `linear-gradient(135deg, ${C.orange} 0%, ${C.red} 100%)` : undefined}
                      title={f.hint}
                      onClick={() => setQuickFilter(quickFilter === f.key ? '' : f.key)}
                    >
                      {f.label}
                      {view === 'subprojects' && visitCounts[f.key] != null ? (
                        <PillCount>{visitCounts[f.key]}</PillCount>
                      ) : null}
                    </HubQuickFilterPill>
                  ))}
                </FilterGroup>
              </FilterGroups>
            </HubControlsPanel>

            {loading ? (
              <LoadingBox>Φόρτωση ημερολογίου εργοταξίου…</LoadingBox>
            ) : view === 'subprojects' ? (
              <>
                <HubCountLine>
                  <strong>{visibleRows.length}</strong> {visibleRows.length === 1 ? 'υποέργο' : 'υποέργα'}
                  {statusFilter === 'executing' ? ' σε εκτέλεση' : ' στην επιλογή'}
                </HubCountLine>
                {visibleRows.length === 0 ? (
                  <EmptyBox>
                    <EmptyIcon>🏗️</EmptyIcon>
                    <EmptyTitle>Δεν υπάρχουν υποέργα με αυτά τα κριτήρια</EmptyTitle>
                    <EmptyText>
                      Δοκιμάστε άλλη κατάσταση ή καθαρίστε τα φίλτρα επισκέψεων.
                      Από προεπιλογή εμφανίζονται τα εκτελούμενα — τα ολοκληρωμένα ανοίγουν με το αντίστοιχο φίλτρο.
                    </EmptyText>
                  </EmptyBox>
                ) : (
                  <HubListWrap>
                    <HubListHead>
                      <span>Υποέργο</span>
                      <span>Κατάσταση</span>
                      <span>Τελευταία επίσκεψη</span>
                      <span>Επισκέψεις</span>
                      <span />
                    </HubListHead>
                    {groupedRows.map((group) => (
                      <React.Fragment key={group.status || 'other'}>
                        {!statusFilter && group.rows.length > 0 ? (
                          <StatusGroupHeader>
                            {statusTone(group.status).label}
                            {' · '}
                            {group.rows.length}
                          </StatusGroupHeader>
                        ) : null}
                        {group.rows.map((row) => {
                          const tone = statusTone(row.projectStatus);
                          return (
                            <HubListRow
                              key={row.subprojectId}
                              type="button"
                              $accent={row.needsVisit ? row.recency.dot : C.slate200}
                              onClick={() => setSelectedId(row.subprojectId)}
                            >
                              <TitleCell>
                                <RowTitle>{row.subprojectTitle || 'Υποέργο'}</RowTitle>
                                {row.projectTitle ? <RowProject>{row.projectTitle}</RowProject> : null}
                              </TitleCell>
                              <StatusPill $tone={tone}>{tone.label}</StatusPill>
                              <RecencyCell>
                                {row.summary.lastVisitDate ? (
                                  <>
                                    <RecencyValue $tone={row.recency}>
                                      {row.isExecuting ? row.recencyLabel : shortDate(row.summary.lastVisitDate)}
                                    </RecencyValue>
                                    {row.isExecuting ? (
                                      <RecencyDate>{shortDate(row.summary.lastVisitDate)}</RecencyDate>
                                    ) : null}
                                  </>
                                ) : (
                                  <RecencyValue $tone={row.recency}>Χωρίς επίσκεψη</RecencyValue>
                                )}
                              </RecencyCell>
                              <CountCell>
                                {row.summary.total}
                              </CountCell>
                              <OpenCell>Άνοιγμα →</OpenCell>
                            </HubListRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </HubListWrap>
                )}
              </>
            ) : (
              <>
                <HubCountLine>
                  <strong>{feedCount}</strong> {feedCount === 1 ? 'επίσκεψη' : 'επισκέψεις'} στο χρονολόγιο
                </HubCountLine>
                {feedGroups.length === 0 ? (
                  <EmptyBox>
                    <EmptyIcon>📋</EmptyIcon>
                    <EmptyTitle>Καμία επίσκεψη με αυτά τα κριτήρια</EmptyTitle>
                    <EmptyText>Δοκιμάστε άλλη αναζήτηση ή καθαρίστε τα φίλτρα.</EmptyText>
                  </EmptyBox>
                ) : feedGroups.map((group) => (
                  <FeedDay key={group.date}>
                    <FeedDayHead>
                      <FeedDayBubble>
                        <FeedDayNum>{dayNumber(group.date)}</FeedDayNum>
                        <FeedDayMonth>{monthShort(group.date)}</FeedDayMonth>
                      </FeedDayBubble>
                      <FeedDayLabel>{weekdayName(group.date)} · {longDate(group.date)}</FeedDayLabel>
                    </FeedDayHead>
                    {group.entries.map((entry) => {
                      const state = siteDiary.progressState(entry.progress);
                      const tone = siteDiary.PROGRESS_TONE_COLORS[state.tone];
                      return (
                        <FeedRow
                          key={`${entry.subprojectId}-${entry.id}`}
                          type="button"
                          $accent={tone.dot}
                          onClick={() => setSelectedId(entry.subprojectId)}
                        >
                          <FeedTime>{entry.visitTime || '—'}</FeedTime>
                          <FeedSubproject>{entry.subprojectTitle || 'Υποέργο'}</FeedSubproject>
                          <FeedPill $tone={tone}>{state.short}</FeedPill>
                          <MetaChip>👷 {entry.authorFullName || entry.authorUsername || '—'}</MetaChip>
                          {(entry.photos || []).length > 0 ? (
                            <MetaChip>📷 {(entry.photos || []).length}</MetaChip>
                          ) : null}
                          {String(entry.contractorOrder || '').trim() ? (
                            <MetaChip $bg="#fffbeb" $color="#92400e" $border="#fcd34d">⚑ Εντολή</MetaChip>
                          ) : null}
                          <FeedSnippet>{entry.notes}</FeedSnippet>
                        </FeedRow>
                      );
                    })}
                  </FeedDay>
                ))}
              </>
            )}
          </HubShell>

          {selectedRow ? (
            <DetailOverlay onClick={handleDetailClose}>
              <DetailCard onClick={(e) => e.stopPropagation()}>
                <DetailHeader>
                  <DetailTitle>🏗️ {selectedRow.subprojectTitle || 'Υποέργο'}</DetailTitle>
                  <CloseBtn type="button" onClick={handleDetailClose} title="Κλείσιμο καρτέλας">✕</CloseBtn>
                </DetailHeader>
                <DetailBody>
                  <SiteDiaryPanel
                    subprojectId={selectedRow.subprojectId}
                    fallbackMeta={{
                      projectTitle: selectedRow.projectTitle,
                      subprojectTitle: selectedRow.subprojectTitle,
                    }}
                    currentUser={currentUser}
                    userRole={userRole}
                    embedded
                  />
                </DetailBody>
              </DetailCard>
            </DetailOverlay>
          ) : null}
        </Body>
      </Modal>
    </Overlay>
  );
}

export default SiteDiaryManager;
