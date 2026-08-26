/**
 * SiteDiaryPanel — το ημερολόγιο εργοταξίου ενός υποέργου, ως κάθετο χρονολόγιο.
 *
 * Χρησιμοποιείται και από την καρτέλα που ανοίγει από την κάρτα υποέργου και από
 * την ευρεία σελίδα, ώστε ο χρήστης να βλέπει ακριβώς την ίδια εικόνα και στα δύο.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useToast } from './ToastProvider';
import { showConfirm } from '../utils/confirmModal';
import { safeFileDialog } from '../utils/safeDialogs';
import siteDiary from '../../app/core/siteDiary';
import {
  C,
  PRIMARY_GRADIENT,
  dayNumber,
  monthShort,
  weekdayName,
  longDate,
  relativeDayLabel,
  yearIfNotCurrent,
  todayInputValue,
  photoKey,
} from '../utils/siteDiaryTheme';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

/* ─── Κέλυφος ─────────────────────────────────────────────────────────────── */

const PanelRoot = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
`;

const PanelScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: ${(p) => (p.$embedded ? '0.9rem 1.1rem 1.4rem' : '1.1rem 1.5rem 1.6rem')};
`;

/* ─── Σύνοψη υποέργου ─────────────────────────────────────────────────────── */

/** Ο τίτλος του υποέργου φαίνεται ήδη στην μπάρα· εδώ αρκεί το έργο-γονέας. */
const ContextLine = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: ${C.slate500};
  margin-bottom: 0.7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.85rem;
`;

const StatCard = styled.div`
  padding: 0.55rem 0.75rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const StatLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.34rem;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${C.slate500};
  margin-bottom: 0.24rem;

  &::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${(p) => p.$dot || C.slate300};
    flex-shrink: 0;
  }
`;

const StatValue = styled.div`
  font-size: 0.95rem;
  font-weight: 800;
  color: ${(p) => p.$color || C.slate900};
  line-height: 1.2;
`;

const StatHint = styled.div`
  font-size: 0.66rem;
  font-weight: 600;
  color: ${C.slate500};
  margin-top: 0.12rem;
`;

/* ─── Εργαλειοθήκη ────────────────────────────────────────────────────────── */

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.9rem;
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.95rem;
  border: none;
  border-radius: 10px;
  background: ${PRIMARY_GRADIENT};
  color: ${C.white};
  font-size: 0.75rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(8, 145, 178, 0.35);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(8, 145, 178, 0.45);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: 0.5rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.76rem;
  font-family: inherit;
  color: ${C.slate800};
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: ${C.cyan}; box-shadow: 0 0 0 3px ${C.cyanLight}; }
`;

const FilterPill = styled.button`
  padding: 0.36rem 0.7rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? 'transparent' : C.slate200)};
  background: ${(p) => (p.$active ? p.$activeBg || PRIMARY_GRADIENT : C.white)};
  color: ${(p) => (p.$active ? C.white : C.slate600)};
  font-size: 0.68rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
  &:hover { transform: translateY(-1px); border-color: ${C.cyan}; }
`;

const ReadOnlyNote = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.36rem 0.7rem;
  border-radius: 999px;
  background: ${C.slate100};
  border: 1px solid ${C.slate200};
  color: ${C.slate600};
  font-size: 0.68rem;
  font-weight: 700;
`;

/* ─── Φόρμα επίσκεψης ─────────────────────────────────────────────────────── */

const FormCard = styled.div`
  position: relative;
  padding: 1rem;
  margin-bottom: 1rem;
  background: ${C.white};
  border: 1px solid rgba(8, 145, 178, 0.28);
  border-radius: 14px;
  box-shadow: 0 8px 28px rgba(8, 145, 178, 0.12);
  animation: ${fadeIn} 0.2s ease;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: ${PRIMARY_GRADIENT};
  }
`;

const FormTitle = styled.h4`
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: ${C.slate900};
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.7rem;
  margin-bottom: 0.7rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
`;

const Label = styled.label`
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${C.slate600};
`;

const Input = styled.input`
  padding: 0.5rem 0.65rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.78rem;
  font-family: inherit;
  color: ${C.slate800};
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: ${C.cyan}; box-shadow: 0 0 0 3px ${C.cyanLight}; }
`;

const TextArea = styled.textarea`
  padding: 0.6rem 0.7rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  font-size: 0.8rem;
  font-family: inherit;
  color: ${C.slate800};
  line-height: 1.5;
  outline: none;
  resize: vertical;
  min-height: ${(p) => p.$minHeight || '92px'};
  box-sizing: border-box;
  &:focus { border-color: ${C.cyan}; box-shadow: 0 0 0 3px ${C.cyanLight}; }
`;

const ProgressChoices = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const ProgressChoice = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.72rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? p.$tone.border : C.slate200)};
  background: ${(p) => (p.$active ? p.$tone.bg : C.white)};
  color: ${(p) => (p.$active ? p.$tone.text : C.slate600)};
  font-size: 0.7rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.16s;

  &::before {
    content: '';
    width: 8px; height: 8px;
    border-radius: 50%;
    background: ${(p) => p.$tone.dot};
    box-shadow: 0 0 0 3px ${(p) => `${p.$tone.dot}22`};
  }
  &:hover { border-color: ${(p) => p.$tone.border}; transform: translateY(-1px); }
`;

const FormActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px dashed ${C.slate200};
`;

const GhostBtn = styled.button`
  padding: 0.48rem 0.85rem;
  border: 1px solid ${C.slate200};
  border-radius: 10px;
  background: ${C.white};
  color: ${C.slate600};
  font-size: 0.74rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: ${C.slate400}; color: ${C.slate800}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PendingPhotos = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-right: auto;
`;

const PendingChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  background: ${C.cyanLight};
  border: 1px solid ${C.cyanTint};
  color: ${C.cyanDeep};
  font-size: 0.66rem;
  font-weight: 700;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ─── Χρονολόγιο ──────────────────────────────────────────────────────────── */

const Timeline = styled.div`
  position: relative;
  padding-left: 3.4rem;

  &::before {
    content: '';
    position: absolute;
    left: 1.42rem;
    top: 0.6rem;
    bottom: 0.6rem;
    width: 2px;
    background: linear-gradient(180deg, ${C.cyanTint} 0%, ${C.slate200} 100%);
    border-radius: 2px;
  }
`;

const DayBlock = styled.div`
  position: relative;
  margin-bottom: 1.1rem;
  &:last-child { margin-bottom: 0; }
`;

const DayBubble = styled.div`
  position: absolute;
  left: -3.4rem;
  top: 0;
  width: 2.85rem;
  padding: 0.32rem 0;
  border-radius: 12px;
  background: ${PRIMARY_GRADIENT};
  color: ${C.white};
  text-align: center;
  box-shadow: 0 4px 14px rgba(8, 145, 178, 0.32);
  border: 2px solid ${C.white};
`;

const DayNum = styled.div`
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
`;

const DayMonth = styled.div`
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  opacity: 0.9;
  margin-top: 0.08rem;
`;

const DayHeading = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  padding-top: 0.28rem;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${C.slate500};
`;

const DayRelative = styled.span`
  padding: 0.1rem 0.42rem;
  border-radius: 999px;
  background: ${C.cyanLight};
  border: 1px solid ${C.cyanTint};
  color: ${C.cyanDeep};
  font-size: 0.6rem;
  letter-spacing: 0.03em;
`;

const EntryCard = styled.div`
  position: relative;
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.5rem;
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-left: 3px solid ${(p) => p.$accent || C.slate300};
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.18s, border-color 0.18s;
  &:last-child { margin-bottom: 0; }
  &:hover { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); }

  /* Οι ενέργειες και το ✕ των φωτογραφιών εμφανίζονται μόνο όταν χρειάζονται,
     ώστε η καταχώριση να διαβάζεται καθαρά. */
  .sd-hover-actions { opacity: 0; transition: opacity 0.15s; }
  &:hover .sd-hover-actions,
  &:focus-within .sd-hover-actions { opacity: 1; }
`;

const EntryHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.45rem;
`;

const EntryTime = styled.span`
  font-size: 0.74rem;
  font-weight: 800;
  color: ${C.slate800};
  font-variant-numeric: tabular-nums;
`;

const ProgressPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  background: ${(p) => p.$tone.bg};
  color: ${(p) => p.$tone.text};
  border: 1px solid ${(p) => p.$tone.border};
  font-size: 0.65rem;
  font-weight: 800;

  &::before {
    content: '';
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${(p) => p.$tone.dot};
  }
`;

const EntryAuthor = styled.span`
  margin-left: auto;
  font-size: 0.66rem;
  font-weight: 700;
  color: ${(p) => (p.$mine ? C.cyanDark : C.slate500)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
`;

const EntryActions = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: 0.3rem;
`;

const ActionBtn = styled.button`
  padding: 0.24rem 0.55rem;
  border-radius: 8px;
  border: 1px solid ${C.slate200};
  background: ${C.white};
  color: ${C.slate600};
  font-size: 0.67rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  &:hover {
    border-color: ${(p) => (p.$danger ? '#fecaca' : C.cyanTint)};
    background: ${(p) => (p.$danger ? '#fef2f2' : C.cyanLight)};
    color: ${(p) => (p.$danger ? C.red : C.cyanDeep)};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const EntryNotes = styled.div`
  font-size: 0.82rem;
  line-height: 1.55;
  color: ${C.slate700};
  white-space: pre-wrap;
  word-break: break-word;
`;

const OrderCallout = styled.div`
  margin-top: 0.55rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0 10px 10px 0;
  background: #fffbeb;
  border-left: 3px solid ${C.amber};
  font-size: 0.78rem;
  line-height: 1.5;
  color: #78350f;
  white-space: pre-wrap;
  word-break: break-word;
`;

const OrderTag = styled.span`
  margin-right: 0.4rem;
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #b45309;
`;

const PhotoStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
`;

/** Ίδιο μέγεθος και κόψιμο σε όλες τις μικρογραφίες — αλλιώς η σειρά φαίνεται ανομοιόμορφη. */
const TILE = `
  width: 104px;
  height: 78px;
  border-radius: 10px;
  flex-shrink: 0;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
`;

const Thumb = styled.button`
  ${TILE}
  position: relative;
  border: 1px solid ${C.slate200};
  background-color: ${C.slate100};
  background-image: ${(p) => (p.$src ? `url("${p.$src}")` : 'none')};
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
  transition: transform 0.16s, box-shadow 0.16s, border-color 0.16s;

  /* Λεπτή εσωτερική σκίαση: οι ανοιχτόχρωμες φωτογραφίες δεν «λιώνουν» στο λευκό. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
    pointer-events: none;
  }
  &:hover {
    transform: translateY(-2px);
    border-color: ${C.cyan};
    box-shadow: 0 6px 16px rgba(8, 145, 178, 0.22);
  }

  /* Το ✕ μόνο πάνω στη φωτογραφία που δείχνει ο χρήστης, όχι σε όλες μαζί. */
  .sd-thumb-x { opacity: 0; }
  &:hover .sd-thumb-x,
  &:focus-visible .sd-thumb-x { opacity: 1; }
`;

const ThumbDelete = styled.span`
  position: absolute;
  top: 4px; right: 4px;
  z-index: 2;
  width: 20px; height: 20px;
  border-radius: 7px;
  background: rgba(15, 23, 42, 0.6);
  color: ${C.white};
  font-size: 0.6rem;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, opacity 0.15s;
  &:hover { background: ${C.red}; }
`;

const MoreTile = styled.button`
  ${TILE}
  border: 1px solid ${C.slate200};
  background: ${C.slate100};
  color: ${C.slate600};
  font-size: 0.82rem;
  font-weight: 800;
  transition: all 0.16s;
  &:hover { border-color: ${C.cyan}; color: ${C.cyanDeep}; background: ${C.cyanLight}; }
`;

const AddPhotoTile = styled.button`
  ${TILE}
  border: 1px dashed ${C.slate300};
  background: transparent;
  color: ${C.slate500};
  font-size: 0.62rem;
  font-weight: 700;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.1rem;
  transition: all 0.16s;
  &:hover { border-color: ${C.cyan}; color: ${C.cyanDark}; background: ${C.cyanLight}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const AddPhotoLink = styled.button`
  margin-top: 0.5rem;
  padding: 0;
  border: none;
  background: none;
  color: ${C.slate500};
  font-size: 0.7rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: ${C.cyanDark}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ─── Κενές καταστάσεις ───────────────────────────────────────────────────── */

const EmptyBox = styled.div`
  padding: 2.2rem 1.2rem;
  text-align: center;
  background: ${C.white};
  border: 1px dashed ${C.slate300};
  border-radius: 14px;
`;

const EmptyIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.75;
`;

const EmptyTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: ${C.slate700};
  margin-bottom: 0.25rem;
`;

const EmptyText = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${C.slate500};
  line-height: 1.5;
  max-width: 420px;
  margin: 0 auto;
`;

const LoadingBox = styled.div`
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: ${C.slate500};
`;

/* ─── Μεγέθυνση φωτογραφίας ───────────────────────────────────────────────── */

const LightboxOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(4px);
  z-index: 10050;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 0.85rem;
`;

const LightboxImage = styled.img`
  max-width: 100%;
  max-height: calc(100vh - 9rem);
  border-radius: 12px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  object-fit: contain;
`;

const LightboxBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const LightboxBtn = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.14);
  color: ${C.white};
  font-size: 0.74rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.26); }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

const LightboxCounter = styled.span`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.74rem;
  font-weight: 700;
`;

/* ─── Component ───────────────────────────────────────────────────────────── */

/** Πόσες μικρογραφίες δείχνουμε πριν μαζευτούν σε «+N» — οι πολλές πνίγουν το κείμενο. */
const VISIBLE_PHOTOS = 5;

const EMPTY_DRAFT = () => ({
  visitDate: todayInputValue(),
  visitTime: '',
  progress: siteDiary.DEFAULT_PROGRESS,
  notes: '',
  contractorOrder: '',
});

function SiteDiaryPanel({
  subprojectId,
  fallbackMeta,
  currentUser,
  userRole,
  embedded = false,
  onCountChange,
}) {
  const { showToast } = useToast();
  const actingUsername = currentUser?.username || '';
  const role = currentUser?.role || userRole;

  const [loading, setLoading] = useState(true);
  const [diary, setDiary] = useState(null);
  const [access, setAccess] = useState({ canAdd: false, readOnly: true });
  const [thumbs, setThumbs] = useState({});
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState('');

  const [lightbox, setLightbox] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState('');

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Οι ήδη φορτωμένες μικρογραφίες διαβάζονται χωρίς να ξαναστήνεται η φόρτωση.
  const thumbsRef = useRef({});
  useEffect(() => { thumbsRef.current = thumbs; }, [thumbs]);

  const entries = useMemo(() => (diary?.entries || []), [diary]);

  /**
   * Ζητάμε από τον δίσκο μόνο όσες μικρογραφίες δείχνουμε και μόνο όσες δεν
   * έχουμε ήδη. Αλλιώς κάθε αποθήκευση ξανακατέβαζε ολόκληρο το άλμπουμ και η
   * καρτέλα «πάγωνε» για λίγα δευτερόλεπτα.
   */
  const loadThumbs = useCallback(async (rows) => {
    const validKeys = new Set();
    const missing = [];
    (rows || []).forEach((entry) => {
      (entry.photos || []).slice(0, VISIBLE_PHOTOS).forEach((photo) => {
        const key = photoKey(subprojectId, entry.id, photo.name);
        validKeys.add(key);
        if (!thumbsRef.current[key]) {
          missing.push({ subprojectId, entryId: entry.id, name: photo.name });
        }
      });
    });

    setThumbs((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === validKeys.size && keys.every((k) => validKeys.has(k))) return prev;
      const kept = {};
      keys.forEach((k) => { if (validKeys.has(k)) kept[k] = prev[k]; });
      return kept;
    });

    if (!missing.length) return;
    try {
      const res = await ipcRenderer.invoke('resolve-site-diary-photos', {
        items: missing,
        variant: 'thumb',
        actingUsername,
      });
      if (mountedRef.current && res?.success) {
        setThumbs((prev) => ({ ...prev, ...(res.map || {}) }));
      }
    } catch {
      /* οι μικρογραφίες είναι διακοσμητικές — δεν μπλοκάρουν το ημερολόγιο */
    }
  }, [subprojectId, actingUsername]);

  const loadDiary = useCallback(async () => {
    if (!subprojectId) {
      setDiary(null);
      setAccess({ canAdd: false, readOnly: true });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('get-subproject-site-diary', {
        subprojectId,
        actingUsername,
      });
      if (!mountedRef.current) return;
      if (!res?.success) {
        showToast(res?.error || 'Δεν ήταν δυνατή η φόρτωση του ημερολογίου', 'error');
        setDiary(null);
        return;
      }
      setDiary(res.diary);
      setAccess(res.access || { canAdd: false, readOnly: true });
      if (onCountChange) onCountChange(subprojectId, (res.diary.entries || []).length);
      void loadThumbs(res.diary.entries || []);
    } catch (e) {
      if (mountedRef.current) showToast(e?.message || 'Σφάλμα φόρτωσης ημερολογίου', 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [subprojectId, actingUsername, showToast, loadThumbs, onCountChange]);

  useEffect(() => { void loadDiary(); }, [loadDiary]);

  const summary = useMemo(() => siteDiary.summarizeEntries(entries), [entries]);

  const visibleGroups = useMemo(() => {
    const filtered = siteDiary.filterEntries(entries, {
      search,
      quickFilter,
      username: actingUsername,
    });
    return siteDiary.groupEntriesByDate(filtered);
  }, [entries, search, quickFilter, actingUsername]);

  const filteredCount = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.entries.length, 0),
    [visibleGroups]
  );

  const canEditEntry = useCallback((entry) => siteDiary.canEditEntry({
    role,
    username: actingUsername,
    entry,
  }), [role, actingUsername]);

  /* ── Φόρμα ── */

  const openNewForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT());
    setPendingPhotos([]);
    setFormOpen(true);
  };

  const openEditForm = (entry) => {
    setEditingId(entry.id);
    setDraft({
      visitDate: entry.visitDate || '',
      visitTime: entry.visitTime || '',
      progress: entry.progress || siteDiary.DEFAULT_PROGRESS,
      notes: entry.notes || '',
      contractorOrder: entry.contractorOrder || '',
    });
    setPendingPhotos([]);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setPendingPhotos([]);
  };

  const pickPhotos = useCallback(async () => {
    const res = await safeFileDialog('select-site-diary-photos', { actingUsername });
    if (!res?.success || res.canceled) return [];
    return Array.isArray(res.filePaths) ? res.filePaths : [];
  }, [actingUsername]);

  const handlePickPendingPhotos = async () => {
    const picked = await pickPhotos();
    if (!picked.length) return;
    // Το ίδιο αρχείο δύο φορές θα ανέβαινε δύο φορές — κρατάμε μία εγγραφή ανά αρχείο.
    setPendingPhotos((prev) => [...new Set([...prev, ...picked])]);
  };

  const handleSave = async () => {
    const check = siteDiary.validateEntry(draft);
    if (!check.ok) {
      showToast(check.error, 'warning');
      return;
    }
    setSaving(true);
    try {
      const channel = editingId ? 'update-site-diary-entry' : 'add-site-diary-entry';
      const res = await ipcRenderer.invoke(channel, {
        subprojectId,
        entryId: editingId || undefined,
        draft,
        actingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία αποθήκευσης', 'error');
        return;
      }

      if (!editingId && pendingPhotos.length && res.entry?.id) {
        const up = await ipcRenderer.invoke('add-site-diary-photos', {
          subprojectId,
          entryId: res.entry.id,
          filePaths: pendingPhotos,
          actingUsername,
        });
        if (!up?.success) {
          showToast(up?.error || 'Η επίσκεψη αποθηκεύτηκε, αλλά οι φωτογραφίες δεν προστέθηκαν', 'warning');
        } else if (up.skipped > 0) {
          showToast(`Η επίσκεψη αποθηκεύτηκε — ${up.skipped} φωτογραφίες παραλείφθηκαν`, 'warning');
        }
      }

      showToast(editingId ? 'Η επίσκεψη ενημερώθηκε' : 'Η επίσκεψη καταχωρίστηκε', 'success');
      closeForm();
      await loadDiary();
    } catch (e) {
      showToast(e?.message || 'Σφάλμα αποθήκευσης', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    const ok = await showConfirm({
      title: 'Διαγραφή επίσκεψης',
      message: `Θέλετε να διαγράψετε την επίσκεψη της ${longDate(entry.visitDate)};`,
      detail: 'Θα διαγραφούν και οι φωτογραφίες της. Η ενέργεια δεν αναιρείται.',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!ok) return;
    setBusyEntryId(entry.id);
    try {
      const res = await ipcRenderer.invoke('delete-site-diary-entry', {
        subprojectId,
        entryId: entry.id,
        actingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία διαγραφής', 'error');
        return;
      }
      showToast('Η επίσκεψη διαγράφηκε', 'success');
      await loadDiary();
    } finally {
      setBusyEntryId('');
    }
  };

  const handleAddPhotosToEntry = async (entry) => {
    const picked = await pickPhotos();
    if (!picked.length) return;
    setBusyEntryId(entry.id);
    try {
      const res = await ipcRenderer.invoke('add-site-diary-photos', {
        subprojectId,
        entryId: entry.id,
        filePaths: picked,
        actingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία προσθήκης φωτογραφιών', 'error');
        return;
      }
      showToast(
        res.skipped > 0
          ? `Προστέθηκαν φωτογραφίες — ${res.skipped} παραλείφθηκαν`
          : 'Οι φωτογραφίες προστέθηκαν',
        res.skipped > 0 ? 'warning' : 'success'
      );
      await loadDiary();
    } finally {
      setBusyEntryId('');
    }
  };

  const handleDeletePhoto = async (entry, photo, event) => {
    event.stopPropagation();
    const ok = await showConfirm({
      title: 'Διαγραφή φωτογραφίας',
      message: 'Θέλετε να αφαιρέσετε τη φωτογραφία από την επίσκεψη;',
      confirmLabel: 'Διαγραφή',
      icon: '🗑',
    });
    if (!ok) return;
    setBusyEntryId(entry.id);
    try {
      const res = await ipcRenderer.invoke('delete-site-diary-photo', {
        subprojectId,
        entryId: entry.id,
        photoName: photo.name,
        actingUsername,
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία διαγραφής φωτογραφίας', 'error');
        return;
      }
      await loadDiary();
    } finally {
      setBusyEntryId('');
    }
  };

  /* ── Μεγέθυνση ── */

  const openLightbox = (entry, index) => {
    setLightbox({ entryId: entry.id, names: (entry.photos || []).map((p) => p.name), index });
  };

  // Η μεγέθυνση κρατά τη λίστα των φωτογραφιών της στιγμής που άνοιξε. Αν στο μεταξύ
  // προστεθεί ή αφαιρεθεί φωτογραφία, την ευθυγραμμίζουμε με την τρέχουσα εγγραφή.
  useEffect(() => {
    if (!lightbox) return;
    const entry = entries.find((e) => e && e.id === lightbox.entryId);
    const names = entry ? (entry.photos || []).map((p) => p.name) : [];
    if (!names.length) {
      setLightbox(null);
      return;
    }
    const unchanged = names.length === lightbox.names.length
      && names.every((n, i) => n === lightbox.names[i]);
    if (unchanged) return;
    setLightbox({ ...lightbox, names, index: Math.min(lightbox.index, names.length - 1) });
  }, [entries, lightbox]);

  useEffect(() => {
    if (!lightbox) {
      setLightboxSrc('');
      return;
    }
    let cancelled = false;
    const name = lightbox.names[lightbox.index];
    if (!name) return undefined;
    // Η μικρογραφία μπαίνει ως προσωρινή εικόνα· δεν είναι λόγος να ξαναζητηθεί
    // η μεγάλη φωτογραφία κάθε φορά που αλλάζει ο κατάλογος μικρογραφιών.
    setLightboxSrc(thumbsRef.current[photoKey(subprojectId, lightbox.entryId, name)] || '');
    (async () => {
      const res = await ipcRenderer.invoke('resolve-site-diary-photos', {
        items: [{ subprojectId, entryId: lightbox.entryId, name }],
        variant: 'full',
        actingUsername,
      });
      if (cancelled || !res?.success) return;
      const src = res.map?.[photoKey(subprojectId, lightbox.entryId, name)];
      if (src) setLightboxSrc(src);
    })();
    return () => { cancelled = true; };
  }, [lightbox, subprojectId, actingUsername]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (lightbox) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setLightbox(null);
          return;
        }
        if (formOpen) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setFormOpen(false);
          setEditingId(null);
          setPendingPhotos([]);
        }
        return;
      }
      if (!lightbox) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setLightbox((prev) => (prev && prev.index < prev.names.length - 1
          ? { ...prev, index: prev.index + 1 } : prev));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setLightbox((prev) => (prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lightbox, formOpen]);

  /* ── Render ── */

  const projectTitle = diary?.projectTitle || fallbackMeta?.projectTitle || '';
  const recency = siteDiary.recencyColors(summary.recencyTone);

  if (loading) {
    return (
      <PanelRoot>
        <PanelScroll $embedded={embedded}>
          <LoadingBox>Φόρτωση ημερολογίου…</LoadingBox>
        </PanelScroll>
      </PanelRoot>
    );
  }

  return (
    <PanelRoot>
      <PanelScroll $embedded={embedded}>
        {projectTitle ? <ContextLine>{projectTitle}</ContextLine> : null}

        <StatRow>
          <StatCard>
            <StatLabel $dot={recency.dot}>Τελευταία επίσκεψη</StatLabel>
            <StatValue $color={recency.text}>{summary.recencyLabel}</StatValue>
            {summary.lastVisitDate ? <StatHint>{longDate(summary.lastVisitDate)}</StatHint> : null}
          </StatCard>
          <StatCard>
            <StatLabel $dot={C.cyan}>Επισκέψεις</StatLabel>
            <StatValue>{summary.total}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel $dot={C.indigo}>Φωτογραφίες</StatLabel>
            <StatValue>{summary.photoCount}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel $dot={C.amber}>Εντολές</StatLabel>
            <StatValue>{summary.orderCount}</StatValue>
          </StatCard>
        </StatRow>

        <Toolbar>
          {access.canAdd ? (
            <PrimaryBtn type="button" onClick={openNewForm} disabled={formOpen}>
              ＋ Νέα επίσκεψη
            </PrimaryBtn>
          ) : access.readOnly ? (
            <ReadOnlyNote>👁 Προβολή μόνο</ReadOnlyNote>
          ) : null}
          <SearchInput
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση στις επισκέψεις…"
          />
          <FilterPill
            type="button"
            $active={quickFilter === 'attention'}
            $activeBg={`linear-gradient(135deg, ${C.orange} 0%, ${C.red} 100%)`}
            onClick={() => setQuickFilter(quickFilter === 'attention' ? '' : 'attention')}
          >
            Προβλήματα
          </FilterPill>
          <FilterPill
            type="button"
            $active={quickFilter === 'orders'}
            $activeBg={`linear-gradient(135deg, ${C.amber} 0%, ${C.orange} 100%)`}
            onClick={() => setQuickFilter(quickFilter === 'orders' ? '' : 'orders')}
          >
            Με εντολή
          </FilterPill>
        </Toolbar>

        {formOpen ? (
          <FormCard>
            <FormTitle>{editingId ? 'Επεξεργασία επίσκεψης' : 'Νέα επίσκεψη εργοταξίου'}</FormTitle>
            <FormGrid>
              <Field>
                <Label htmlFor="sd-date">Ημερομηνία</Label>
                <Input
                  id="sd-date"
                  type="date"
                  max={todayInputValue()}
                  value={draft.visitDate}
                  onChange={(e) => setDraft({ ...draft, visitDate: e.target.value })}
                />
              </Field>
              <Field>
                <Label htmlFor="sd-time">Ώρα (προαιρετικά)</Label>
                <Input
                  id="sd-time"
                  type="time"
                  value={draft.visitTime}
                  onChange={(e) => setDraft({ ...draft, visitTime: e.target.value })}
                />
              </Field>
            </FormGrid>

            <Field style={{ marginBottom: '0.7rem' }}>
              <Label>Πορεία εργασιών</Label>
              <ProgressChoices>
                {siteDiary.PROGRESS_STATES.map((state) => (
                  <ProgressChoice
                    key={state.key}
                    type="button"
                    $active={draft.progress === state.key}
                    $tone={siteDiary.PROGRESS_TONE_COLORS[state.tone]}
                    onClick={() => setDraft({ ...draft, progress: state.key })}
                  >
                    {state.label}
                  </ProgressChoice>
                ))}
              </ProgressChoices>
            </Field>

            <Field style={{ marginBottom: '0.7rem' }}>
              <Label htmlFor="sd-notes">Τι διαπιστώσατε στην επίσκεψη</Label>
              <TextArea
                id="sd-notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Εργασίες που εκτελούνταν, στάδιο προόδου, παρατηρήσεις…"
              />
            </Field>

            <Field>
              <Label htmlFor="sd-order">Εντολή προς τον ανάδοχο (προαιρετικά)</Label>
              <TextArea
                id="sd-order"
                $minHeight="70px"
                value={draft.contractorOrder}
                onChange={(e) => setDraft({ ...draft, contractorOrder: e.target.value })}
                placeholder="Τι ζητήθηκε από τον ανάδοχο κατά την επίσκεψη"
              />
            </Field>

            <FormActions>
              {!editingId ? (
                <PendingPhotos>
                  <GhostBtn type="button" onClick={handlePickPendingPhotos} disabled={saving}>
                    📷 Φωτογραφίες
                  </GhostBtn>
                  {pendingPhotos.map((p) => (
                    <PendingChip key={p}>{p.split(/[\\/]/).pop()}</PendingChip>
                  ))}
                </PendingPhotos>
              ) : <PendingPhotos />}
              <GhostBtn type="button" onClick={closeForm} disabled={saving}>Άκυρο</GhostBtn>
              <PrimaryBtn type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </PrimaryBtn>
            </FormActions>
          </FormCard>
        ) : null}

        {entries.length === 0 ? (
          <EmptyBox>
            <EmptyIcon>🏗️</EmptyIcon>
            <EmptyTitle>Δεν έχει καταγραφεί επίσκεψη ακόμη</EmptyTitle>
            <EmptyText>
              {access.canAdd
                ? 'Καταγράψτε την πρώτη σας επίσκεψη στο εργοτάξιο — τι είδατε, πώς πάει η εργασία και, αν χρειάστηκε, τι ζητήσατε από τον ανάδοχο.'
                : 'Μόλις ο επιβλέπων μηχανικός καταγράψει επίσκεψη, θα εμφανιστεί εδώ.'}
            </EmptyText>
          </EmptyBox>
        ) : filteredCount === 0 ? (
          <EmptyBox>
            <EmptyIcon>🔍</EmptyIcon>
            <EmptyTitle>Καμία επίσκεψη με αυτά τα κριτήρια</EmptyTitle>
            <EmptyText>Δοκιμάστε άλλη αναζήτηση ή καθαρίστε τα φίλτρα.</EmptyText>
          </EmptyBox>
        ) : (
          <Timeline>
            {visibleGroups.map((group) => (
              <DayBlock key={group.date}>
                <DayBubble>
                  <DayNum>{dayNumber(group.date)}</DayNum>
                  <DayMonth>{monthShort(group.date)}</DayMonth>
                </DayBubble>
                <DayHeading>
                  {/* Η ημερομηνία λέγεται ήδη στη φούσκα — εδώ μένει ό,τι προσθέτει κάτι. */}
                  <span>{weekdayName(group.date)}</span>
                  {yearIfNotCurrent(group.date) ? <span>{yearIfNotCurrent(group.date)}</span> : null}
                  {relativeDayLabel(group.date)
                    ? <DayRelative>{relativeDayLabel(group.date)}</DayRelative>
                    : null}
                </DayHeading>
                {group.entries.map((entry) => {
                  const state = siteDiary.progressState(entry.progress);
                  const tone = siteDiary.PROGRESS_TONE_COLORS[state.tone];
                  const editable = canEditEntry(entry);
                  const isMine = String(entry.authorUsername || '').toLowerCase()
                    === String(actingUsername || '').toLowerCase();
                  return (
                    <EntryCard key={entry.id} $accent={tone.dot}>
                      <EntryHead>
                        {entry.visitTime ? <EntryTime>{entry.visitTime}</EntryTime> : null}
                        <ProgressPill $tone={tone}>{state.short}</ProgressPill>
                        <EntryAuthor $mine={isMine}>
                          {isMine ? 'Εσείς' : (entry.authorFullName || entry.authorUsername || '—')}
                        </EntryAuthor>
                        {editable ? (
                          <EntryActions className="sd-hover-actions">
                            <ActionBtn
                              type="button"
                              title="Διόρθωση επίσκεψης"
                              onClick={() => openEditForm(entry)}
                              disabled={busyEntryId === entry.id}
                            >
                              Διόρθωση
                            </ActionBtn>
                            <ActionBtn
                              type="button"
                              $danger
                              title="Διαγραφή επίσκεψης"
                              onClick={() => handleDelete(entry)}
                              disabled={busyEntryId === entry.id}
                            >
                              Διαγραφή
                            </ActionBtn>
                          </EntryActions>
                        ) : null}
                      </EntryHead>

                      <EntryNotes>{entry.notes}</EntryNotes>

                      {String(entry.contractorOrder || '').trim() ? (
                        <OrderCallout>
                          <OrderTag>Εντολή</OrderTag>
                          {entry.contractorOrder}
                        </OrderCallout>
                      ) : null}

                      {(entry.photos || []).length > 0 ? (
                        <PhotoStrip>
                          {(entry.photos || []).slice(0, VISIBLE_PHOTOS).map((photo, idx) => (
                            <Thumb
                              key={photo.name}
                              type="button"
                              title={photo.originalName || photo.name}
                              $src={thumbs[photoKey(subprojectId, entry.id, photo.name)]}
                              onClick={() => openLightbox(entry, idx)}
                            >
                              {editable ? (
                                <ThumbDelete
                                  className="sd-thumb-x"
                                  role="button"
                                  title="Αφαίρεση φωτογραφίας"
                                  onClick={(e) => handleDeletePhoto(entry, photo, e)}
                                >
                                  ✕
                                </ThumbDelete>
                              ) : null}
                            </Thumb>
                          ))}
                          {(entry.photos || []).length > VISIBLE_PHOTOS ? (
                            <MoreTile
                              type="button"
                              title="Προβολή όλων των φωτογραφιών"
                              onClick={() => openLightbox(entry, VISIBLE_PHOTOS)}
                            >
                              +{(entry.photos || []).length - VISIBLE_PHOTOS}
                            </MoreTile>
                          ) : null}
                          {editable ? (
                            <AddPhotoTile
                              type="button"
                              title="Προσθήκη φωτογραφιών"
                              onClick={() => handleAddPhotosToEntry(entry)}
                              disabled={busyEntryId === entry.id}
                            >
                              {busyEntryId === entry.id ? (
                                <span>Ανέβασμα…</span>
                              ) : (
                                <>
                                  <span>＋</span>
                                  <span>Φωτογραφία</span>
                                </>
                              )}
                            </AddPhotoTile>
                          ) : null}
                        </PhotoStrip>
                      ) : editable ? (
                        <AddPhotoLink
                          type="button"
                          onClick={() => handleAddPhotosToEntry(entry)}
                          disabled={busyEntryId === entry.id}
                        >
                          {busyEntryId === entry.id ? 'Ανέβασμα φωτογραφιών…' : '＋ Προσθήκη φωτογραφιών'}
                        </AddPhotoLink>
                      ) : null}
                    </EntryCard>
                  );
                })}
              </DayBlock>
            ))}
          </Timeline>
        )}
      </PanelScroll>

      {lightbox ? (
        <LightboxOverlay onClick={() => setLightbox(null)}>
          {lightboxSrc ? (
            <LightboxImage
              src={lightboxSrc}
              alt="Φωτογραφία επίσκεψης"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <LightboxCounter>Φόρτωση φωτογραφίας…</LightboxCounter>
          )}
          <LightboxBar onClick={(e) => e.stopPropagation()}>
            <LightboxBtn
              type="button"
              disabled={lightbox.index === 0}
              onClick={() => setLightbox({ ...lightbox, index: lightbox.index - 1 })}
            >
              ‹ Προηγούμενη
            </LightboxBtn>
            <LightboxCounter>{lightbox.index + 1} / {lightbox.names.length}</LightboxCounter>
            <LightboxBtn
              type="button"
              disabled={lightbox.index >= lightbox.names.length - 1}
              onClick={() => setLightbox({ ...lightbox, index: lightbox.index + 1 })}
            >
              Επόμενη ›
            </LightboxBtn>
            <LightboxBtn
              type="button"
              onClick={() => ipcRenderer.invoke('open-site-diary-photo', {
                subprojectId,
                entryId: lightbox.entryId,
                photoName: lightbox.names[lightbox.index],
                actingUsername,
              })}
            >
              Άνοιγμα στον υπολογιστή
            </LightboxBtn>
            <LightboxBtn type="button" onClick={() => setLightbox(null)}>Κλείσιμο</LightboxBtn>
          </LightboxBar>
        </LightboxOverlay>
      ) : null}
    </PanelRoot>
  );
}

export default SiteDiaryPanel;
