/**
 * Προθεσμίες προσκλήσεων — urgencies για κάρτες / φίλτρα / ταξινόμηση.
 */
import prosklisiCatalog from '../../app/core/prosklisiCatalog';

export const parseProsklisiDeadline = prosklisiCatalog.parseProsklisiDeadline;
export const getEffectiveProsklisiDeadline = prosklisiCatalog.getEffectiveProsklisiDeadline;
export const getProsklisiDeadlineUrgency = prosklisiCatalog.getProsklisiDeadlineUrgency;
export const getProsklisiDeadlineDaysLeft = prosklisiCatalog.getProsklisiDeadlineDaysLeft;
export const isProsklisiDeadlineExpiringSoon = prosklisiCatalog.isProsklisiDeadlineExpiringSoon;
export const isProsklisiSubmittedStatus = prosklisiCatalog.isProsklisiSubmittedStatus;
export const getProsklisiViewTab = prosklisiCatalog.getProsklisiViewTab;
export const compareActiveProskliseis = prosklisiCatalog.compareActiveProskliseis;
export const compareExpiredProskliseis = prosklisiCatalog.compareExpiredProskliseis;
export const compareProskliseisByDeadline = prosklisiCatalog.compareProskliseisByDeadline;
export const partitionProskliseisByViewTab = prosklisiCatalog.partitionProskliseisByViewTab;
export const PROSKLISI_VIEW_TABS = prosklisiCatalog.PROSKLISI_VIEW_TABS;
export const applyProsklisiDailyFilters = prosklisiCatalog.applyProsklisiDailyFilters;
export const prosklisiMatchesQuickSearch = prosklisiCatalog.prosklisiMatchesQuickSearch;
export const showNewProsklisiButton = prosklisiCatalog.showNewProsklisiButton;
export const isProsklisiUnlinked = prosklisiCatalog.isProsklisiUnlinked;

export function getProsklisiDeadlineChipMeta(deadline, formatDateFn, now = new Date()) {
  const urgency = getProsklisiDeadlineUrgency(deadline, now);
  if (urgency === 'none') return null;
  const days = getProsklisiDeadlineDaysLeft(deadline, now);
  const dateLabel = typeof formatDateFn === 'function' ? formatDateFn(deadline) : String(deadline);
  let label = `Λήξη: ${dateLabel}`;
  let title = 'Ημερομηνία λήξης υποβολής';
  if (urgency === 'expired') {
    label = `Έληξε · ${dateLabel}`;
    title = 'Η προθεσμία υποβολής έχει παρέλθει';
  } else if (urgency === 'urgent') {
    label = days === 0 ? `Λήγει σήμερα · ${dateLabel}` : `Λήγει σε ${days} ημ. · ${dateLabel}`;
    title = 'Προθεσμία εντός 7 ημερών';
  } else if (urgency === 'soon') {
    label = `Λήγει σε ${days} ημ. · ${dateLabel}`;
    title = 'Προθεσμία εντός 30 ημερών';
  }
  return { urgency, label, title, days };
}

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}
