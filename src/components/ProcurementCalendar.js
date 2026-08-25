import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import CalendarCustomEventForm from './CalendarCustomEventForm';
import CalendarCustomEventView from './CalendarCustomEventView';
import { useToast } from './ToastProvider';
import {
  buildProcurementCalendarEvents,
  eventsInMonth,
  eventsWithinDays,
  filterCalendarEventsByType,
  formatDaysLeftLabel,
  formatEventDateTime,
  calendarEventRowKey,
  CALENDAR_EVENT_TYPES,
} from '../utils/procurementCalendarEvents';
import {
  buildCustomCalendarEvents,
  mergeCalendarEventLists,
  describeCustomVisibility,
  canManageCustomEvent,
  canCreateCustomCalendarEvent,
} from '../utils/customCalendarEvents';
import { buildAepoCalendarEvents } from '../utils/aepoCalendarEvents';
import { buildProsklisiCalendarEvents } from '../utils/prosklisiCalendarEvents';
import { buildContractorRadarCalendarEvents } from '../utils/contractorRadarCalendarEvents';
import { CALENDAR_TIME_WINDOWS, getCalendarWindowLabel } from '../utils/calendarAlerts';
import { exportCalendarEventsToExcel } from '../utils/calendarExport';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(6px);
  z-index: 2100;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2vh 1rem 2rem;
  overflow-y: auto;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 1080px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #fff;
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
`;

const Subtitle = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  opacity: 0.9;
`;

const CloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  &:hover { background: rgba(255, 255, 255, 0.28); }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-shrink: 0;
`;

const AddBtn = styled.button`
  background: rgba(255, 255, 255, 0.92);
  border: none;
  color: #047857;
  border-radius: 8px;
  padding: 0.45rem 0.9rem;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.8rem;
  &:hover { background: #fff; }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  align-items: center;
`;

const TabBtn = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$active ? '#059669' : '#cbd5e1')};
  background: ${(p) => (p.$active ? '#ecfdf5' : '#fff')};
  color: ${(p) => (p.$active ? '#047857' : '#475569')};
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
`;

const Body = styled.div`
  padding: 1rem 1.25rem 1.25rem;
  overflow-y: auto;
  flex: 1;
`;

const MonthNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
`;

const MonthLabel = styled.div`
  font-weight: 800;
  font-size: 1.05rem;
  color: #1e293b;
  text-transform: capitalize;
`;

const NavBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font-weight: 700;
  color: #334155;
  &:hover { background: #f1f5f9; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const Weekday = styled.div`
  text-align: center;
  font-size: 0.68rem;
  font-weight: 800;
  color: #64748b;
  padding: 0.35rem 0;
  text-transform: uppercase;
`;

const DayCell = styled.div`
  min-height: 88px;
  border: 1px solid ${(p) => (p.$today ? '#059669' : '#e2e8f0')};
  border-radius: 8px;
  padding: 0.25rem;
  background: ${(p) => (p.$muted ? '#f8fafc' : '#fff')};
  opacity: ${(p) => (p.$muted ? 0.55 : 1)};
`;

const DayNum = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: ${(p) => (p.$today ? '#047857' : '#334155')};
  margin-bottom: 0.2rem;
`;

const EventPill = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 4px;
  padding: 0.15rem 0.25rem;
  margin-bottom: 0.15rem;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.25;
  cursor: pointer;
  color: #fff;
  background: ${(p) => {
    if (p.$type === CALENDAR_EVENT_TYPES.CUSTOM) return '#4f46e5';
    if (p.$type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M) return '#b45309';
    if (p.$type === CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY) return '#1d4ed8';
    if (p.$type === CALENDAR_EVENT_TYPES.GUARANTEE_EXPIRY) return '#7c3aed';
    if (p.$urgency === 'past') return '#94a3b8';
    if (p.$urgency === 'urgent') return '#dc2626';
    if (p.$urgency === 'soon') return '#d97706';
    return '#059669';
  }};
  &:hover { filter: brightness(1.08); }
`;

const DayMoreBtn = styled.button`
  display: block;
  width: 100%;
  border: 1px dashed #94a3b8;
  background: #f8fafc;
  border-radius: 4px;
  padding: 0.12rem 0.2rem;
  margin-top: 0.1rem;
  font-size: 0.6rem;
  font-weight: 700;
  color: #4f46e5;
  cursor: pointer;
  text-align: center;
  &:hover { background: #eef2ff; border-color: #6366f1; }
`;

const ListSection = styled.div`
  margin-bottom: 1rem;
`;

const ListTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.88rem;
  color: #334155;
`;

const EventRow = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.45rem;
  background: #fff;
  cursor: pointer;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  &:hover { border-color: #86efac; background: #f0fdf4; }
`;

const EventDateCol = styled.div`
  flex-shrink: 0;
  min-width: 88px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #047857;
`;

const EventMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const EventTitle = styled.div`
  font-weight: 700;
  font-size: 0.82rem;
  color: #1e293b;
  line-height: 1.35;
`;

const EventMeta = styled.div`
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: #64748b;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
`;

const EmptyMsg = styled.div`
  text-align: center;
  padding: 2rem 1rem;
  color: #64748b;
  font-size: 0.9rem;
`;

const MonthHint = styled.div`
  text-align: center;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px dashed #86efac;
  color: #047857;
  font-size: 0.82rem;
  font-weight: 600;
`;

const ExportBtn = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #6366f1;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  &:hover { background: #e0e7ff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const TYPE_FILTER_LABELS = {
  all: 'Όλα',
  deadlines: 'Διαγωνισμοί',
  contracts: 'Λήξεις συμβάσεων',
  custom: 'Ειδοποιήσεις',
  compliance: 'Παράβαση 12μ.',
  aepo: 'ΑΕΠΟ',
  proskliseis: 'Προσκλήσεις',
  contractors: 'Ανάδοχοι',
};

const CheckLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  input { width: 15px; height: 15px; cursor: pointer; }
`;

const WEEKDAYS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function ProcurementCalendar({
  isOpen,
  onClose,
  projects = [],
  proskliseis = [],
  userRole = 'USER',
  currentUser = null,
  engineerCatalog = [],
  onViewSubproject,
  onOpenProsklisi,
  onCalendarDataChanged,
  initialCustomEventId = null,
  includeAepo = false,
  onOpenOrimanthi,
  onOpenContractorRegistry,
  visibleSubprojectIds = null,
}) {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState('month');
  const [typeFilter, setTypeFilter] = useState('all');
  const [listWindow, setListWindow] = useState(30);
  const [includePastInList, setIncludePastInList] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [expandedCalendarDays, setExpandedCalendarDays] = useState({});
  const [customEventsRaw, setCustomEventsRaw] = useState([]);
  const [aepoAlertsRaw, setAepoAlertsRaw] = useState([]);
  const [contractorRecords, setContractorRecords] = useState([]);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [editingCustomEvent, setEditingCustomEvent] = useState(null);
  const [viewingCustomEvent, setViewingCustomEvent] = useState(null);
  const consumedFocusRef = useRef(null);

  const canManageCustomEvents = canCreateCustomCalendarEvent(currentUser || { role: userRole });

  const loadCustomEvents = useCallback(async () => {
    if (!currentUser?.username) {
      setCustomEventsRaw([]);
      return;
    }
    try {
      const res = await ipcRenderer.invoke('get-calendar-custom-events', {
        actingUsername: currentUser.username,
      });
      if (res?.success) setCustomEventsRaw(res.events || []);
    } catch {
      setCustomEventsRaw([]);
    }
  }, [currentUser?.username]);

  const loadAepoAlerts = useCallback(async () => {
    if (!includeAepo) {
      setAepoAlertsRaw([]);
      return;
    }
    try {
      const res = await ipcRenderer.invoke('get-orimanthi-aepo-alerts', { maxDays: 365, limit: 0 });
      if (res?.success) setAepoAlertsRaw(res.alerts || []);
      else setAepoAlertsRaw([]);
    } catch {
      setAepoAlertsRaw([]);
    }
  }, [includeAepo]);

  const loadContractorRecords = useCallback(async () => {
    if (userRole === 'USER' || !currentUser?.username) {
      setContractorRecords([]);
      return;
    }
    try {
      const res = await ipcRenderer.invoke('load-contractor-registry', {
        actingUsername: currentUser.username,
      });
      if (res?.success) setContractorRecords(res.records || []);
      else setContractorRecords([]);
    } catch {
      setContractorRecords([]);
    }
  }, [userRole, currentUser?.username]);

  useEffect(() => {
    if (!isOpen) {
      consumedFocusRef.current = null;
      return;
    }
    loadCustomEvents();
    loadAepoAlerts();
    loadContractorRecords();
  }, [isOpen, loadCustomEvents, loadAepoAlerts, loadContractorRecords]);

  useEffect(() => {
    if (!isOpen || !initialCustomEventId) return;
    if (consumedFocusRef.current === initialCustomEventId) return;
    const raw = customEventsRaw.find((row) => row.id === initialCustomEventId);
    if (!raw) return;
    consumedFocusRef.current = initialCustomEventId;
    if (canManageCustomEvents && canManageCustomEvent(raw, currentUser)) {
      setEditingCustomEvent(raw);
      setCustomFormOpen(true);
    } else {
      setViewingCustomEvent(raw);
    }
  }, [isOpen, initialCustomEventId, customEventsRaw, canManageCustomEvents, currentUser]);

  const procurementEvents = useMemo(
    () => buildProcurementCalendarEvents(projects, { userRole, currentUser, engineerCatalog }),
    [projects, userRole, currentUser, engineerCatalog]
  );

  const customEvents = useMemo(
    () => buildCustomCalendarEvents(customEventsRaw),
    [customEventsRaw]
  );

  const prosklisiEvents = useMemo(
    () => buildProsklisiCalendarEvents(proskliseis),
    [proskliseis]
  );

  const contractorEvents = useMemo(
    () => buildContractorRadarCalendarEvents({
      projects,
      records: contractorRecords,
      role: userRole,
      visibleSubprojectIds,
      warnDays: 30,
      urgentDays: 7,
    }),
    [projects, contractorRecords, userRole, visibleSubprojectIds]
  );

  const allEvents = useMemo(
    () => mergeCalendarEventLists(
      procurementEvents,
      customEvents,
      buildAepoCalendarEvents(aepoAlertsRaw),
      prosklisiEvents,
      contractorEvents
    ),
    [procurementEvents, customEvents, aepoAlertsRaw, prosklisiEvents, contractorEvents]
  );

  const filteredEvents = useMemo(
    () => filterCalendarEventsByType(allEvents, typeFilter),
    [allEvents, typeFilter]
  );

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthEvents = useMemo(
    () => eventsInMonth(filteredEvents, year, monthIndex),
    [filteredEvents, year, monthIndex]
  );

  const hasEventsOutsideMonth = useMemo(
    () => filteredEvents.some((e) => {
      const d = new Date(e.dateIso);
      if (Number.isNaN(d.getTime())) return false;
      return d.getFullYear() !== year || d.getMonth() !== monthIndex;
    }),
    [filteredEvents, year, monthIndex]
  );

  const listEvents = useMemo(
    () => eventsWithinDays(filteredEvents, listWindow, { includePastDeadlines: includePastInList }),
    [filteredEvents, listWindow, includePastInList]
  );

  const exportableListEvents = useMemo(() => {
    const sorted = [...listEvents].sort(
      (a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)
        || (a.subprojectTitle || '').localeCompare(b.subprojectTitle || '', 'el', { sensitivity: 'base' })
    );
    return sorted;
  }, [listEvents]);

  const handleExport = () => {
    const result = exportCalendarEventsToExcel(exportableListEvents, {
      windowDays: listWindow,
      typeFilterLabel: TYPE_FILTER_LABELS[typeFilter] || 'Όλα',
    });
    if (!result.success) {
      showToast(result.error || 'Αποτυχία εξαγωγής', 'error');
      return;
    }
    showToast(`Εξήχθησαν ${result.count} εγγραφές (${result.fileName})`, 'success');
  };

  const overdueDeadlines = useMemo(
    () => listEvents.filter(
      (e) => e.daysLeft != null
        && e.daysLeft < 0
        && e.type !== CALENDAR_EVENT_TYPES.COMPLIANCE_12M
    ),
    [listEvents]
  );

  const upcomingList = useMemo(
    () => listEvents.filter(
      (e) => e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M
        || e.daysLeft == null
        || e.daysLeft >= 0
    ),
    [listEvents]
  );

  if (!isOpen) return null;

  const todayKey = new Date().toDateString();
  const monthLabel = cursor.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
  const grid = buildMonthGrid(year, monthIndex);

  const eventsByDay = {};
  monthEvents.forEach((ev) => {
    const day = Number(ev.dateKey.split('-')[2]);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  });

  const handleEventClick = (ev) => {
    if (ev.isContractorRegistry || ev.type === CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY) {
      onOpenContractorRegistry?.({ rowKey: ev.contractorRowKey, subprojectId: ev.subprojectId });
      onClose?.();
      return;
    }
    if (ev.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL && ev.orimanthiProposalId) {
      onOpenOrimanthi?.();
      onClose?.();
      return;
    }
    if (ev.type === CALENDAR_EVENT_TYPES.CUSTOM) {
      const raw = customEventsRaw.find((row) => row.id === ev.customEventId);
      if (!raw) {
        showToast(ev.subprojectTitle || ev.label || 'Ειδοποίηση', 'info');
        return;
      }
      if (canManageCustomEvents && canManageCustomEvent(raw, currentUser)) {
        setEditingCustomEvent(raw);
        setCustomFormOpen(true);
        return;
      }
      setViewingCustomEvent(raw);
      return;
    }
    if (ev.prosklisiId) {
      onOpenProsklisi?.(ev.prosklisiId);
      return;
    }
    if (ev.subprojectId) onViewSubproject?.(ev.subprojectId);
  };

  const eventRowKey = calendarEventRowKey;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>📅 Ημερολόγιο Προθεσμιών</Title>
            <Subtitle>
              Προθεσμίες ΚΗΜΔΗΣ & ειδοποιήσεις · {filteredEvents.length}{' '}
              {filteredEvents.length === 1 ? 'εγγραφή' : 'εγγραφές'}
              {userRole === 'ENGINEER' ? ' · μόνο τα υποέργα σας' : ''}
            </Subtitle>
          </div>
          <HeaderActions>
            {canManageCustomEvents && (
              <AddBtn
                type="button"
                onClick={() => {
                  setEditingCustomEvent(null);
                  setCustomFormOpen(true);
                }}
              >
                + Νέα προθεσμία
              </AddBtn>
            )}
            <CloseBtn type="button" onClick={onClose}>Κλείσιμο</CloseBtn>
          </HeaderActions>
        </Header>

        <Toolbar>
          <TabBtn type="button" $active={viewMode === 'month'} onClick={() => setViewMode('month')}>
            Μηνιαία προβολή
          </TabBtn>
          <TabBtn type="button" $active={viewMode === 'list'} onClick={() => setViewMode('list')}>
            Λίστα & εξαγωγή
          </TabBtn>
          {viewMode === 'list' && (
            <ExportBtn type="button" onClick={handleExport} disabled={!exportableListEvents.length}>
              Εξαγωγή Excel
            </ExportBtn>
          )}
          <span style={{ flex: 1, minWidth: 8 }} />
          <TabBtn type="button" $active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            Όλα
          </TabBtn>
          <TabBtn type="button" $active={typeFilter === 'deadlines'} onClick={() => setTypeFilter('deadlines')}>
            Διαγωνισμοί
          </TabBtn>
          <TabBtn type="button" $active={typeFilter === 'contracts'} onClick={() => setTypeFilter('contracts')}>
            Λήξεις συμβάσεων
          </TabBtn>
          <TabBtn type="button" $active={typeFilter === 'custom'} onClick={() => setTypeFilter('custom')}>
            Ειδοποιήσεις
          </TabBtn>
          <TabBtn type="button" $active={typeFilter === 'compliance'} onClick={() => setTypeFilter('compliance')}>
            Παράβαση 12μ.
          </TabBtn>
          <TabBtn type="button" $active={typeFilter === 'proskliseis'} onClick={() => setTypeFilter('proskliseis')}>
            Προσκλήσεις
          </TabBtn>
          {includeAepo && (
            <TabBtn type="button" $active={typeFilter === 'aepo'} onClick={() => setTypeFilter('aepo')}>
              ΑΕΠΟ
            </TabBtn>
          )}
          {userRole !== 'USER' && (
            <TabBtn type="button" $active={typeFilter === 'contractors'} onClick={() => setTypeFilter('contractors')}>
              Ανάδοχοι
            </TabBtn>
          )}
        </Toolbar>

        <Body>
          {viewMode === 'month' ? (
            <>
              <MonthNav>
                <NavBtn type="button" onClick={() => { setCursor(new Date(year, monthIndex - 1, 1)); setExpandedCalendarDays({}); }}>‹</NavBtn>
                <MonthLabel>{monthLabel}</MonthLabel>
                <NavBtn type="button" onClick={() => { setCursor(new Date(year, monthIndex + 1, 1)); setExpandedCalendarDays({}); }}>›</NavBtn>
              </MonthNav>
              <Grid>
                {WEEKDAYS.map((w) => <Weekday key={w}>{w}</Weekday>)}
                {grid.map((day, idx) => {
                  if (day == null) {
                    return <DayCell key={`e-${idx}`} $muted />;
                  }
                  const cellDate = new Date(year, monthIndex, day);
                  const isToday = cellDate.toDateString() === todayKey;
                  const dayEvents = eventsByDay[day] || [];
                  const dayKey = `${year}-${monthIndex + 1}-${day}`;
                  const dayExpanded = !!expandedCalendarDays[dayKey];
                  const visibleDayEvents = dayExpanded ? dayEvents : dayEvents.slice(0, 3);
                  return (
                    <DayCell key={`d-${day}`} $today={isToday}>
                      <DayNum $today={isToday}>{day}</DayNum>
                      {visibleDayEvents.map((ev) => (
                        <EventPill
                          key={eventRowKey(ev)}
                          type="button"
                          $urgency={ev.urgency}
                          $type={ev.type}
                          title={`${ev.label} — ${ev.subprojectTitle}`}
                          onClick={() => handleEventClick(ev)}
                        >
                          {ev.type === CALENDAR_EVENT_TYPES.DEADLINE ? '⏰'
                            : ev.type === CALENDAR_EVENT_TYPES.OFFERS_EXPIRY ? '⌛'
                            : ev.type === CALENDAR_EVENT_TYPES.CONTRACT_END ? '📋'
                            : ev.type === CALENDAR_EVENT_TYPES.CUSTOM ? '📌'
                            : ev.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M ? '⚠'
                            : ev.type === CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY ? '🏦'
                            : ev.type === CALENDAR_EVENT_TYPES.GUARANTEE_EXPIRY ? '📄' : '•'}{' '}
                          {(ev.subprojectTitle || '').slice(0, 18)}
                          {(ev.subprojectTitle || '').length > 18 ? '…' : ''}
                        </EventPill>
                      ))}
                      {dayEvents.length > 3 && (
                        <DayMoreBtn
                          type="button"
                          onClick={() => setExpandedCalendarDays((prev) => ({
                            ...prev,
                            [dayKey]: !prev[dayKey],
                          }))}
                        >
                          {dayExpanded
                            ? 'Λιγότερα'
                            : `+${dayEvents.length - 3} ακόμα`}
                        </DayMoreBtn>
                      )}
                    </DayCell>
                  );
                })}
              </Grid>
              {monthEvents.length === 0 && filteredEvents.length > 0 && hasEventsOutsideMonth && (
                <MonthHint>
                  Δεν υπάρχουν προθεσμίες σε αυτόν τον μήνα — χρησιμοποιήστε ‹ › για άλλους μήνες
                  ή ανοίξτε τη «Λίστα & εξαγωγή».
                </MonthHint>
              )}
            </>
          ) : (
            <>
              <Toolbar style={{ padding: 0, marginBottom: '0.5rem', background: 'transparent', border: 'none' }}>
                {CALENDAR_TIME_WINDOWS.map((w) => (
                  <TabBtn
                    key={w.days}
                    type="button"
                    $active={listWindow === w.days}
                    onClick={() => setListWindow(w.days)}
                  >
                    {w.label}
                  </TabBtn>
                ))}
              </Toolbar>
              <Toolbar style={{ padding: 0, marginBottom: '0.75rem', background: 'transparent', border: 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  {exportableListEvents.length} εγγραφές · παράθυρο: {getCalendarWindowLabel(listWindow)}
                  {typeFilter !== 'all' ? ` · ${TYPE_FILTER_LABELS[typeFilter]}` : ''}
                </span>
                <span style={{ flex: 1, minWidth: 8 }} />
                <CheckLabel>
                  <input
                    type="checkbox"
                    checked={includePastInList}
                    onChange={(e) => setIncludePastInList(e.target.checked)}
                  />
                  Συμπερίληψη ληγμένων
                </CheckLabel>
              </Toolbar>

              {overdueDeadlines.length > 0 && (
                <ListSection>
                  <ListTitle>Ληγμένες προθεσμίες</ListTitle>
                  {overdueDeadlines.map((ev) => (
                    <EventRow key={eventRowKey(ev, 'od-')} type="button" onClick={() => handleEventClick(ev)}>
                      <EventDateCol>{formatEventDateTime(ev.dateIso)}</EventDateCol>
                      <EventMain>
                        <EventTitle>{ev.subprojectTitle}</EventTitle>
                        <EventMeta>
                          <span>{ev.label}</span>
                          {ev.adam && <span>{ev.adam}</span>}
                          {ev.daysLeft != null && ev.daysLeft < 0 && (
                            <span style={{ color: '#b45309', fontWeight: 700 }}>{formatDaysLeftLabel(ev.daysLeft)}</span>
                          )}
                        </EventMeta>
                      </EventMain>
                    </EventRow>
                  ))}
                </ListSection>
              )}

              <ListSection>
                <ListTitle>Προθεσμίες εντός {getCalendarWindowLabel(listWindow)}</ListTitle>
                {upcomingList.length === 0 ? (
                  <EmptyMsg>Δεν υπάρχουν προθεσμίες στο επιλεγμένο διάστημα.</EmptyMsg>
                ) : (
                  upcomingList.map((ev) => (
                    <EventRow key={eventRowKey(ev)} type="button" onClick={() => handleEventClick(ev)}>
                      <EventDateCol>{formatEventDateTime(ev.dateIso)}</EventDateCol>
                      <EventMain>
                        <EventTitle>{ev.subprojectTitle}</EventTitle>
                        <EventMeta>
                          <span>{ev.label}</span>
                          {ev.adam && <span>{ev.adam}</span>}
                          {ev.type === CALENDAR_EVENT_TYPES.CUSTOM && ev.createdByFullName && (
                            <span>από {ev.createdByFullName}</span>
                          )}
                          {ev.type === CALENDAR_EVENT_TYPES.CUSTOM && (
                            <span>{describeCustomVisibility(ev)}</span>
                          )}
                          {ev.complianceSummary && <span>{ev.complianceSummary}</span>}
                          {ev.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M && (
                            <span style={{ fontWeight: 700, color: '#b45309' }}>Ενεργή παράβαση</span>
                          )}
                          {ev.description && <span>{ev.description}</span>}
                          {ev.daysLeft != null && ev.daysLeft >= 0 && (
                            <span style={{ fontWeight: 700 }}>{formatDaysLeftLabel(ev.daysLeft)}</span>
                          )}
                        </EventMeta>
                      </EventMain>
                    </EventRow>
                  ))
                )}
              </ListSection>
            </>
          )}

          {filteredEvents.length === 0 && (
            <EmptyMsg>
              Δεν υπάρχουν προθεσμίες για εμφάνιση με τα τρέχοντα φίλτρα.
            </EmptyMsg>
          )}
        </Body>
      </Panel>

      <CalendarCustomEventForm
        isOpen={customFormOpen}
        onClose={() => {
          setCustomFormOpen(false);
          setEditingCustomEvent(null);
        }}
        currentUser={currentUser}
        editingEvent={editingCustomEvent}
        onSaved={() => {
          loadCustomEvents();
          onCalendarDataChanged?.();
        }}
      />

      <CalendarCustomEventView
        isOpen={!!viewingCustomEvent}
        event={viewingCustomEvent}
        onClose={() => setViewingCustomEvent(null)}
      />
    </Overlay>
  );
}
