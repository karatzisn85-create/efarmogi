import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  CALENDAR_EVENT_TYPES,
  buildProcurementCalendarEvents,
} from '../utils/procurementCalendarEvents';
import {
  buildCustomCalendarEvents,
  mergeCalendarEventLists,
} from '../utils/customCalendarEvents';
import { buildAepoCalendarEvents } from '../utils/aepoCalendarEvents';
import { buildProsklisiCalendarEvents } from '../utils/prosklisiCalendarEvents';
import { buildContractorRadarCalendarEvents } from '../utils/contractorRadarCalendarEvents';
import {
  buildCalendarDeadlineAlerts,
  formatCalendarDaysLabel,
} from '../utils/calendarAlerts';

const ipcRenderer = window.electronAPI;
const RADAR_EXPANDED_KEY = 'ergohub-deadline-radar-expanded';

function readExpandedPreference() {
  try {
    return localStorage.getItem(RADAR_EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45), 0 12px 40px rgba(15, 118, 110, 0.22); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.12), 0 16px 48px rgba(15, 118, 110, 0.28); }
`;

const shimmer = keyframes`
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

const urgentShellAnimation = css`
  animation: ${pulseGlow} 2.8s ease-in-out infinite, ${shimmer} 9s ease-in-out infinite;
`;

const Shell = styled.section`
  position: relative;
  margin-bottom: ${(p) => (p.$compact || p.$embedded || p.$panel ? '0' : '1rem')};
  border-radius: ${(p) => (p.$embedded || p.$panel ? '0' : (p.$compact ? '14px' : '18px'))};
  padding: ${(p) => (p.$embedded || p.$panel ? '0' : (p.$compact ? '2px' : '3px'))};
  height: auto;
  min-height: ${(p) => (p.$compact || p.$embedded ? '100%' : '0')};
  background: ${(p) => {
    if (p.$embedded || p.$panel) return 'transparent';
    return `linear-gradient(
      135deg,
      #0d9488 0%,
      #f59e0b 38%,
      #0f766e 68%,
      #14b8a6 100%
    )`;
  }};
  background-size: ${(p) => (p.$embedded || p.$panel ? 'auto' : '220% 220%')};
  ${(p) => (!p.$embedded && !p.$panel ? css`animation: ${shimmer} 9s ease-in-out infinite;` : '')}
  box-shadow: ${(p) => {
    if (p.$embedded || p.$panel) return 'none';
    return p.$compact
      ? '0 8px 28px rgba(15, 118, 110, 0.22)'
      : '0 14px 44px rgba(15, 118, 110, 0.28)';
  }};
  ${(p) => (p.$hasUrgent && !p.$embedded && !p.$panel ? urgentShellAnimation : '')}
`;

const Widget = styled.div`
  border-radius: ${(p) => (p.$embedded || p.$panel ? '0' : (p.$compact ? '12px' : '16px'))};
  overflow: hidden;
  background: ${(p) => {
    if (p.$embedded || p.$panel) return 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
    return 'linear-gradient(165deg, #042f2e 0%, #0f4c47 42%, #134e4a 100%)';
  }};
  color: ${(p) => (p.$embedded || p.$panel ? '#334155' : '#ecfdf5')};
  height: auto;
  min-height: ${(p) => (p.$compact || p.$embedded ? '100%' : '0')};
  box-shadow: none;
`;

const Hero = styled.div`
  position: relative;
  padding: ${(p) => (p.$compact ? '0.55rem 0.85rem' : '0.85rem 1.15rem')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  border-bottom: ${(p) => (p.$expanded
    ? ((p.$embedded || p.$panel) ? '1px solid rgba(226, 232, 240, 0.95)' : '1px solid rgba(255, 255, 255, 0.1)')
    : 'none')};
  background: ${(p) => ((p.$embedded || p.$panel)
    ? `radial-gradient(ellipse 80% 120% at 100% 0%, rgba(245, 158, 11, 0.08) 0%, transparent 55%),
       radial-gradient(ellipse 60% 80% at 0% 100%, rgba(20, 184, 166, 0.07) 0%, transparent 50%)`
    : `radial-gradient(ellipse 80% 120% at 100% 0%, rgba(245, 158, 11, 0.22) 0%, transparent 55%),
       radial-gradient(ellipse 60% 80% at 0% 100%, rgba(20, 184, 166, 0.18) 0%, transparent 50%)`)};
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  user-select: none;
`;

const HeroLeft = styled.div`
  display: flex;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
`;

const HeroActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const ToggleBtn = styled.button`
  border: 1px solid ${(p) => ((p.$embedded || p.$panel) ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.25)')};
  background: ${(p) => ((p.$embedded || p.$panel) ? '#ffffff' : 'rgba(255, 255, 255, 0.1)')};
  color: ${(p) => ((p.$embedded || p.$panel) ? '#334155' : '#ecfdf5')};
  border-radius: 10px;
  padding: 0.45rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: ${(p) => ((p.$embedded || p.$panel) ? '#f8fafc' : 'rgba(255, 255, 255, 0.18)')}; }
`;

const IconBadge = styled.div`
  flex-shrink: 0;
  width: ${(p) => (p.$compact ? '34px' : '46px')};
  height: ${(p) => (p.$compact ? '34px' : '46px')};
  border-radius: ${(p) => (p.$compact ? '10px' : '14px')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => (p.$compact ? '1.05rem' : '1.35rem')};
  background: linear-gradient(145deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 6px 18px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  border: none;
`;

const HeroText = styled.div`
  min-width: 0;
`;

const Eyebrow = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${(p) => ((p.$embedded || p.$panel) ? '#0f766e' : '#5eead4')};
  margin-bottom: 0.2rem;
`;

const WidgetTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => (p.$compact ? '0.9rem' : '1.02rem')};
  font-weight: 900;
  line-height: 1.25;
  color: ${(p) => ((p.$embedded || p.$panel) ? '#0f172a' : '#fff')};
  text-shadow: ${(p) => ((p.$embedded || p.$panel) ? 'none' : '0 1px 12px rgba(0, 0, 0, 0.25)')};
`;

const WidgetSub = styled.p`
  margin: ${(p) => (p.$compact ? '0.2rem 0 0' : '0.35rem 0 0')};
  font-size: ${(p) => (p.$compact ? '0.68rem' : '0.76rem')};
  color: ${(p) => ((p.$embedded || p.$panel) ? '#64748b' : 'rgba(236, 253, 245, 0.78)')};
  line-height: 1.4;
`;

const CountPill = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: ${(p) => ((p.$embedded || p.$panel) ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.22)')};
  border: 1px solid ${(p) => ((p.$embedded || p.$panel) ? 'rgba(245, 158, 11, 0.35)' : 'rgba(251, 191, 36, 0.45)')};
  color: ${(p) => ((p.$embedded || p.$panel) ? '#b45309' : '#fde68a')};
  font-weight: 800;
  font-size: 0.72rem;
`;

const OpenBtn = styled.button`
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 55%, #ea580c 100%);
  color: #422006;
  font-size: 0.76rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
  }
`;

const Body = styled.div`
  padding: 0.75rem 0.85rem 0.9rem;
  background: ${(p) => (p.$panel
    ? 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
    : 'linear-gradient(180deg, rgba(4, 47, 46, 0.35) 0%, rgba(15, 76, 71, 0.55) 100%)')};
`;

const AlertList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const urgencyAccent = (urgent, soon) => {
  if (urgent) return '#ef4444';
  if (soon) return '#f59e0b';
  return '#2dd4bf';
};

const AlertItem = styled.li`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.7rem 0.6rem 0.85rem;
  border-radius: 12px;
  background: ${(p) => (p.$panel ? '#ffffff' : 'rgba(255, 255, 255, 0.07)')};
  border: 1px solid ${(p) => (p.$panel ? 'rgba(226, 232, 240, 0.95)' : 'rgba(255, 255, 255, 0.1)')};
  backdrop-filter: ${(p) => (p.$panel ? 'none' : 'blur(8px)')};
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  overflow: hidden;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${(p) => urgencyAccent(p.$urgent, p.$soon)};
    box-shadow: 0 0 12px ${(p) => urgencyAccent(p.$urgent, p.$soon)};
  }

  &:hover {
    ${(p) => p.$clickable && `
      transform: translateX(3px);
      background: ${p.$panel ? '#f8fafc' : 'rgba(255, 255, 255, 0.11)'};
      border-color: ${p.$panel ? 'rgba(13, 148, 136, 0.35)' : 'rgba(45, 212, 191, 0.35)'};
    `}
  }
`;

const TypeIcon = styled.span`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  background: ${(p) => p.$bg || 'rgba(255,255,255,0.12)'};
`;

const AlertMain = styled.div`
  min-width: 0;
  flex: 1;
`;

const AlertTitle = styled.div`
  font-weight: 700;
  font-size: 0.82rem;
  color: ${(p) => (p.$panel ? '#0f172a' : '#f8fafc')};
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const AlertMeta = styled.div`
  margin-top: 0.18rem;
  font-size: 0.68rem;
  color: ${(p) => (p.$panel ? '#64748b' : 'rgba(204, 251, 241, 0.72)')};
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
`;

const TypeTag = styled.span`
  padding: 0.08rem 0.35rem;
  border-radius: 4px;
  background: ${(p) => (p.$panel ? 'rgba(13, 148, 136, 0.1)' : 'rgba(20, 184, 166, 0.2)')};
  border: 1px solid ${(p) => (p.$panel ? 'rgba(13, 148, 136, 0.25)' : 'rgba(45, 212, 191, 0.25)')};
  color: ${(p) => (p.$panel ? '#0f766e' : '#99f6e4')};
  font-weight: 700;
`;

const AdamTag = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: ${(p) => (p.$panel ? '#b45309' : '#fde68a')};
  font-weight: 700;
`;

const MoreNote = styled.div`
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: ${(p) => (p.$panel ? '#64748b' : 'rgba(204, 251, 241, 0.85)')};
`;

const DaysBadge = styled.span`
  flex-shrink: 0;
  min-width: 62px;
  text-align: center;
  padding: 0.35rem 0.5rem;
  border-radius: 10px;
  font-weight: 900;
  font-size: 0.72rem;
  line-height: 1.2;
  color: ${(p) => (p.$urgent ? '#fff' : p.$soon ? '#422006' : '#042f2e')};
  background: ${(p) => {
    if (p.$urgent) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    if (p.$soon) return 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
    return 'linear-gradient(135deg, #5eead4 0%, #2dd4bf 100%)';
  }};
  box-shadow: ${(p) => (p.$urgent
    ? '0 4px 14px rgba(239, 68, 68, 0.45)'
    : p.$soon
      ? '0 4px 12px rgba(245, 158, 11, 0.35)'
      : '0 4px 12px rgba(45, 212, 191, 0.25)')};
`;

function typeVisual(type) {
  switch (type) {
    case CALENDAR_EVENT_TYPES.DEADLINE:
      return { icon: '⏰', bg: 'rgba(239, 68, 68, 0.2)' };
    case CALENDAR_EVENT_TYPES.OFFERS_EXPIRY:
      return { icon: '⌛', bg: 'rgba(245, 158, 11, 0.22)' };
    case CALENDAR_EVENT_TYPES.CONTRACT_END:
      return { icon: '📋', bg: 'rgba(59, 130, 246, 0.22)' };
    case CALENDAR_EVENT_TYPES.CUSTOM:
      return { icon: '📌', bg: 'rgba(139, 92, 246, 0.22)' };
    case CALENDAR_EVENT_TYPES.COMPLIANCE_12M:
      return { icon: '⚠', bg: 'rgba(251, 146, 60, 0.22)' };
    case CALENDAR_EVENT_TYPES.AEPO_RENEWAL:
      return { icon: '🌿', bg: 'rgba(99, 102, 241, 0.25)' };
    case CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE:
      return { icon: '📢', bg: 'rgba(14, 165, 233, 0.22)' };
    case CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY:
      return { icon: '🏦', bg: 'rgba(29, 78, 216, 0.22)' };
    default:
      return { icon: '📅', bg: 'rgba(255, 255, 255, 0.12)' };
  }
}

/** Συμπαγές ραντάρ — λίστα αναδιπλούμενη, όλοι οι τύποι προθεσμιών. */
export default function CalendarDeadlineWidget({
  projects = [],
  proskliseis = [],
  userRole = 'USER',
  currentUser = null,
  engineerCatalog = [],
  onViewSubproject,
  onOpenProsklisi,
  onOpenCalendar,
  onOpenOrimanthi,
  onOpenContractorRegistry,
  visibleSubprojectIds = null,
  includeAepo = false,
  maxDays = 30,
  limit = 8,
  refreshKey = 0,
  compact = false,
  embedded = false,
  panelMode = false,
  onSummaryChange,
}) {
  const [customEventsRaw, setCustomEventsRaw] = useState([]);
  const [aepoAlertsRaw, setAepoAlertsRaw] = useState([]);
  const [contractorRecords, setContractorRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => (panelMode ? true : readExpandedPreference()));

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
      else setCustomEventsRaw([]);
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
      const res = await ipcRenderer.invoke('get-orimanthi-aepo-alerts', { maxDays, limit: 0 });
      if (res?.success) setAepoAlertsRaw(res.alerts || []);
      else setAepoAlertsRaw([]);
    } catch {
      setAepoAlertsRaw([]);
    }
  }, [includeAepo, maxDays]);

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
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadCustomEvents(), loadAepoAlerts(), loadContractorRecords()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadCustomEvents, loadAepoAlerts, loadContractorRecords, refreshKey]);

  const allEvents = useMemo(() => {
    const procurement = buildProcurementCalendarEvents(projects, {
      userRole,
      currentUser,
      engineerCatalog,
    });
    const custom = buildCustomCalendarEvents(customEventsRaw);
    const aepo = buildAepoCalendarEvents(aepoAlertsRaw);
    const prosklisiEv = buildProsklisiCalendarEvents(proskliseis);
    const contractorEv = buildContractorRadarCalendarEvents({
      projects,
      records: contractorRecords,
      role: userRole,
      visibleSubprojectIds,
      warnDays: maxDays,
      urgentDays: 7,
    });
    return mergeCalendarEventLists(procurement, custom, aepo, prosklisiEv, contractorEv);
  }, [projects, proskliseis, userRole, currentUser, engineerCatalog, customEventsRaw, aepoAlertsRaw, contractorRecords, visibleSubprojectIds, maxDays]);

  const { alerts, totalCount } = useMemo(
    () => buildCalendarDeadlineAlerts(allEvents, { maxDays, limit: 0 }),
    [allEvents, maxDays]
  );

  const visibleAlerts = useMemo(
    () => (limit > 0 ? alerts.slice(0, limit) : alerts),
    [alerts, limit]
  );

  const hasUrgent = alerts.some((row) => row.daysLeft != null && row.daysLeft <= 7);
  const hiddenCount = Math.max(0, totalCount - visibleAlerts.length);
  const canExpand = totalCount > 0;

  useEffect(() => {
    if (typeof onSummaryChange !== 'function') return;
    onSummaryChange({ totalCount, hasUrgent, loading });
  }, [totalCount, hasUrgent, loading, onSummaryChange]);

  const toggleExpanded = () => {
    if (!canExpand) return;
    const next = !expanded;
    setExpanded(next);
    if (panelMode) return;
    try {
      localStorage.setItem(RADAR_EXPANDED_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
  };

  const handleClick = (row) => {
    if (row.isContractorRegistry && onOpenContractorRegistry) {
      onOpenContractorRegistry({ rowKey: row.contractorRowKey, subprojectId: row.subprojectId });
      return;
    }
    if (row.orimanthiProposalId && onOpenOrimanthi) {
      onOpenOrimanthi({ proposalId: row.orimanthiProposalId });
      return;
    }
    if (row.prosklisiId && onOpenProsklisi) {
      onOpenProsklisi(row.prosklisiId);
      return;
    }
    if (row.customEventId && onOpenCalendar) {
      onOpenCalendar({ customEventId: row.customEventId });
      return;
    }
    if (row.subprojectId && onViewSubproject) {
      onViewSubproject(row.subprojectId);
      return;
    }
    onOpenCalendar?.();
  };

  const subtitleParts = [
    'Όλοι οι τύποι προθεσμιών',
    userRole === 'ENGINEER' ? 'μόνο τα υποέργα σας' : null,
    includeAepo ? 'συμπ. ΑΕΠΟ' : null,
    hasUrgent ? 'επείγουσες!' : null,
    !expanded && totalCount > 0 ? 'πατήστε για λίστα' : null,
  ].filter(Boolean);

  const lightChrome = embedded || panelMode;

  return (
    <Shell $compact={compact} $embedded={embedded} $panel={panelMode} $hasUrgent={hasUrgent && !expanded} aria-label="Ραντάρ προθεσμιών">
      <Widget $compact={compact} $embedded={embedded} $panel={panelMode}>
        <Hero
          $compact={compact}
          $embedded={embedded}
          $panel={panelMode}
          $expanded={expanded && canExpand}
          $clickable={canExpand}
          onClick={canExpand ? toggleExpanded : undefined}
          role={canExpand ? 'button' : undefined}
          aria-expanded={canExpand ? expanded : undefined}
        >
          <HeroLeft>
            <IconBadge $compact={compact} $embedded={embedded} aria-hidden>⏳</IconBadge>
            <HeroText>
              <Eyebrow $embedded={embedded} $panel={panelMode}>Ραντάρ προθεσμιών</Eyebrow>
              <WidgetTitle $compact={compact} $embedded={embedded} $panel={panelMode}>
                Λήξεις εντός {maxDays} ημερών
                {!loading && <CountPill $embedded={embedded} $panel={panelMode}>{totalCount}</CountPill>}
              </WidgetTitle>
              <WidgetSub $compact={compact} $embedded={embedded} $panel={panelMode}>
                {loading
                  ? 'Φόρτωση…'
                  : totalCount === 0
                    ? 'Δεν υπάρχουν ενεργές προθεσμίες στο παράθυρο αυτό'
                    : subtitleParts.join(' · ')}
              </WidgetSub>
            </HeroText>
          </HeroLeft>
          <HeroActions onClick={(e) => e.stopPropagation()}>
            {canExpand && (
              <ToggleBtn type="button" $embedded={embedded} $panel={panelMode} onClick={toggleExpanded}>
                {expanded ? '▲ Κλείσιμο' : '▼ Λίστα'}
              </ToggleBtn>
            )}
            {onOpenCalendar && (
              <OpenBtn $embedded={lightChrome} type="button" onClick={() => onOpenCalendar()}>
                Ημερολόγιο
              </OpenBtn>
            )}
          </HeroActions>
        </Hero>

        {expanded && canExpand && (
        <Body $panel={panelMode}>
          <AlertList>
            {visibleAlerts.map((row) => {
              const urgent = row.daysLeft != null && row.daysLeft <= 7;
              const soon = row.daysLeft != null && row.daysLeft > 7 && row.daysLeft <= 14;
              const vis = typeVisual(row.type);
              const clickable = !!(
                row.isContractorRegistry
                || row.subprojectId
                || row.customEventId
                || row.orimanthiProposalId
                || onOpenCalendar
              );
              return (
                <AlertItem
                  key={row.id}
                  $panel={panelMode}
                  $clickable={clickable}
                  $urgent={urgent}
                  $soon={soon}
                  onClick={() => handleClick(row)}
                  title={
                    row.isContractorRegistry
                      ? 'Άνοιγμα καρτέλας αναδόχου'
                      : row.orimanthiProposalId
                        ? 'Άνοιγμα Ωρίμανσης'
                        : row.subprojectId
                          ? 'Άνοιγμα υποέργου'
                          : row.customEventId
                            ? 'Προβολή ειδοποίησης'
                            : 'Άνοιγμα ημερολογίου'
                  }
                >
                  <TypeIcon $bg={vis.bg} aria-hidden>{vis.icon}</TypeIcon>
                  <AlertMain>
                    <AlertTitle $panel={panelMode} title={row.title}>{row.title}</AlertTitle>
                    <AlertMeta $panel={panelMode}>
                      <TypeTag $panel={panelMode}>{row.label}</TypeTag>
                      {row.adam && <AdamTag $panel={panelMode}>{row.adam}</AdamTag>}
                    </AlertMeta>
                  </AlertMain>
                  <DaysBadge $urgent={urgent} $soon={soon}>
                    {row.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M
                      ? 'Παράβαση'
                      : formatCalendarDaysLabel(row.daysLeft)}
                  </DaysBadge>
                </AlertItem>
              );
            })}
          </AlertList>
          {hiddenCount > 0 && (
            <MoreNote $panel={panelMode}>
              +{hiddenCount} ακόμα — ανοίξτε το ημερολόγιο για πλήρη λίστα
            </MoreNote>
          )}
        </Body>
        )}
      </Widget>
    </Shell>
  );
}
