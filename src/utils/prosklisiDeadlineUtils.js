/**
 * Προθεσμίες προσκλήσεων — urgencies για κάρτες / φίλτρα / ταξινόμηση.
 */
import prosklisiCatalog from '../../app/core/prosklisiCatalog';

export const parseProsklisiDeadline = prosklisiCatalog.parseProsklisiDeadline;
export const getEffectiveProsklisiDeadline = prosklisiCatalog.getEffectiveProsklisiDeadline;
export const getOriginalProsklisiDeadline = prosklisiCatalog.getOriginalProsklisiDeadline;
export const getProsklisiDeadlineUrgency = prosklisiCatalog.getProsklisiDeadlineUrgency;
export const getProsklisiDeadlineDaysLeft = prosklisiCatalog.getProsklisiDeadlineDaysLeft;
export const isProsklisiDeadlineExpiringSoon = prosklisiCatalog.isProsklisiDeadlineExpiringSoon;
export const isProsklisiDeadlineUpcomingSoon = prosklisiCatalog.isProsklisiDeadlineUpcomingSoon;
export const getLatestProsklisiModificationDate = prosklisiCatalog.getLatestProsklisiModificationDate;
export const isProsklisiSubmittedStatus = prosklisiCatalog.isProsklisiSubmittedStatus;
export const getProsklisiViewTab = prosklisiCatalog.getProsklisiViewTab;
export const compareActiveProskliseis = prosklisiCatalog.compareActiveProskliseis;
export const compareExpiredProskliseis = prosklisiCatalog.compareExpiredProskliseis;
export const compareProskliseisByDeadline = prosklisiCatalog.compareProskliseisByDeadline;
export const partitionProskliseisByViewTab = prosklisiCatalog.partitionProskliseisByViewTab;
export const PROSKLISI_VIEW_TABS = prosklisiCatalog.PROSKLISI_VIEW_TABS;
export const applyProsklisiDailyFilters = prosklisiCatalog.applyProsklisiDailyFilters;
export const applyProsklisiAdvancedFilters = prosklisiCatalog.applyProsklisiAdvancedFilters;
export const parseProsklisiBudgetRange = prosklisiCatalog.parseProsklisiBudgetRange;
export const prosklisiMatchesBudgetWindow = prosklisiCatalog.prosklisiMatchesBudgetWindow;
export const uniqueLinkedProjectTitles = prosklisiCatalog.uniqueLinkedProjectTitles;
export const prosklisiLinksProjectTitle = prosklisiCatalog.prosklisiLinksProjectTitle;
export const prosklisiMatchesQuickSearch = prosklisiCatalog.prosklisiMatchesQuickSearch;
export const showNewProsklisiButton = prosklisiCatalog.showNewProsklisiButton;
export const showProsklisiDeleteAction = prosklisiCatalog.showProsklisiDeleteAction;
export const collectProsklisiRequiredErrors = prosklisiCatalog.collectProsklisiRequiredErrors;
export const evaluateProsklisiDelete = prosklisiCatalog.evaluateProsklisiDelete;
export const removeProsklisiFromList = prosklisiCatalog.removeProsklisiFromList;
export const isProsklisiUnlinked = prosklisiCatalog.isProsklisiUnlinked;
export const PROSKLISI_EXPORT_SCOPE = prosklisiCatalog.PROSKLISI_EXPORT_SCOPE;
export const PROSKLISI_EXPORT_FORMAT = prosklisiCatalog.PROSKLISI_EXPORT_FORMAT;
export const uniqueSortedProsklisiFieldValues = prosklisiCatalog.uniqueSortedProsklisiFieldValues;
export const statusesForProsklisiViewTab = prosklisiCatalog.statusesForProsklisiViewTab;
export const collectProsklisiFilterChips = prosklisiCatalog.collectProsklisiFilterChips;
export const countProsklisiActiveFilters = prosklisiCatalog.countProsklisiActiveFilters;
export const resolveProsklisiExportRows = prosklisiCatalog.resolveProsklisiExportRows;
export const buildProsklisiExportRecord = prosklisiCatalog.buildProsklisiExportRecord;
export const buildProsklisiExportHtml = prosklisiCatalog.buildProsklisiExportHtml;
export const getProsklisiDiavgeiaAdaText = prosklisiCatalog.getProsklisiDiavgeiaAdaText;

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
