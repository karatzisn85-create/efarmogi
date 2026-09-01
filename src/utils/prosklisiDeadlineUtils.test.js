/**
 * @jest-environment node
 */
import {
  compareProskliseisByDeadline,
  getEffectiveProsklisiDeadline,
  getProsklisiDeadlineChipMeta,
  getProsklisiDeadlineUrgency,
  getProsklisiViewTab,
  isProsklisiDeadlineExpiringSoon,
  parseProsklisiDeadline,
  partitionProskliseisByViewTab,
  PROSKLISI_VIEW_TABS,
  countProsklisiActiveFilters,
  collectProsklisiFilterChips,
  resolveProsklisiExportRows,
  PROSKLISI_EXPORT_SCOPE,
  buildProsklisiExportRecord,
} from './prosklisiDeadlineUtils';

describe('prosklisiDeadlineUtils', () => {
  const now = new Date('2026-07-20T12:00:00');

  test('parse greek and iso dates', () => {
    expect(parseProsklisiDeadline('2026-07-25').getFullYear()).toBe(2026);
    expect(parseProsklisiDeadline('25-07-2026').getDate()).toBe(25);
    expect(parseProsklisiDeadline('-')).toBeNull();
  });

  test('urgency buckets', () => {
    expect(getProsklisiDeadlineUrgency('2026-07-10', now)).toBe('expired');
    expect(getProsklisiDeadlineUrgency('2026-07-20', now)).toBe('urgent');
    expect(getProsklisiDeadlineUrgency('2026-07-27', now)).toBe('urgent');
    expect(getProsklisiDeadlineUrgency('2026-08-10', now)).toBe('soon');
    expect(getProsklisiDeadlineUrgency('2026-12-01', now)).toBe('ok');
  });

  test('chip meta labels', () => {
    const fmt = (d) => d;
    expect(getProsklisiDeadlineChipMeta('2026-07-10', fmt, now).label).toMatch(/Έληξε/);
    expect(getProsklisiDeadlineChipMeta('2026-07-20', fmt, now).label).toMatch(/σήμερα/);
    expect(isProsklisiDeadlineExpiringSoon('2026-07-25', 30, now)).toBe(true);
    expect(isProsklisiDeadlineExpiringSoon('2026-12-01', 30, now)).toBe(false);
  });

  test('sort by deadline ascending, missing last', () => {
    const list = [
      { deadline: '2026-08-01' },
      { deadline: '' },
      { deadline: '2026-07-01' }
    ].sort(compareProskliseisByDeadline);
    expect(list[0].deadline).toBe('2026-07-01');
    expect(list[2].deadline).toBe('');
  });

  test('effective deadline prefers latest modification change', () => {
    const prosklisi = { deadline: '2019-10-31' };
    const mods = [
      {
        modificationDocumentDate: '2025-10-01',
        changes: {
          deadline: { original: '2019-10-31', current: '2026-12-31' },
        },
      },
    ];
    expect(getEffectiveProsklisiDeadline(prosklisi, mods)).toBe('2026-12-31');
    expect(getProsklisiDeadlineUrgency(
      getEffectiveProsklisiDeadline(prosklisi, mods),
      now
    )).toBe('ok');
    // Παλιά ριζική ημερομηνία χωρίς τροποποίηση → ληγμένη
    expect(getProsklisiDeadlineUrgency(prosklisi.deadline, now)).toBe('expired');
  });

  test('effective deadline falls back to root when no deadline changes', () => {
    expect(getEffectiveProsklisiDeadline(
      { deadline: '2026-06-01' },
      [{ changes: { title: { original: 'A', current: 'B' } } }]
    )).toBe('2026-06-01');
  });

  test('effective deadline uses chronologically last change', () => {
    const prosklisi = { deadline: '2019-10-31' };
    const mods = [
      {
        modificationDocumentDate: '2024-01-01',
        changes: { deadline: { original: '2019-10-31', current: '2024-06-30' } },
      },
      {
        modificationDocumentDate: '2025-10-01',
        changes: { deadline: { original: '2024-06-30', current: '2025-12-31' } },
      },
    ];
    expect(getEffectiveProsklisiDeadline(prosklisi, mods)).toBe('2025-12-31');
  });

  test('view tabs: active / expired / submitted', () => {
    expect(getProsklisiViewTab(
      { status: 'Υπό Ωρίμανση', deadline: '2026-12-01' },
      [],
      now
    )).toBe(PROSKLISI_VIEW_TABS.ACTIVE);
    expect(getProsklisiViewTab(
      { status: 'Υπό Υποβολή', deadline: '2026-01-01' },
      [],
      now
    )).toBe(PROSKLISI_VIEW_TABS.EXPIRED);
    expect(getProsklisiViewTab(
      { status: 'Υποβληθέν ΤΔΠ', deadline: '2020-01-01' },
      [],
      now
    )).toBe(PROSKLISI_VIEW_TABS.SUBMITTED);
  });

  test('partition puts open expired in expired tab even if status is ωρίμανση', () => {
    const list = [
      { prosklisiId: 'a', status: 'Υπό Ωρίμανση', deadline: '2026-12-01', title: 'A' },
      { prosklisiId: 'b', status: 'Υπό Ωρίμανση', deadline: '2020-01-01', title: 'B' },
      { prosklisiId: 'c', status: 'Υποβληθέν', deadline: '2020-01-01', title: 'C' },
    ];
    const parts = partitionProskliseisByViewTab(list, {}, now);
    expect(parts.active.map((p) => p.prosklisiId)).toEqual(['a']);
    expect(parts.expired.map((p) => p.prosklisiId)).toEqual(['b']);
    expect(parts.submitted.map((p) => p.prosklisiId)).toEqual(['c']);
  });
});

describe('φίλτρα και εξαγωγή προσκλήσεων', () => {
  test('η ταξινόμηση δεν μετράει ως ενεργό φίλτρο', () => {
    expect(countProsklisiActiveFilters({ sortByDeadline: true })).toBe(0);
    expect(collectProsklisiFilterChips({
      showUnlinkedOnly: true,
      sortByDeadline: true,
    }).map((c) => c.id)).toEqual(['unlinked']);
    expect(collectProsklisiFilterChips({
      advancedFilters: { linkedProject: 'Οδικό δίκτυο Αρχανών', minBudget: '90.000' },
    }).map((c) => c.id)).toEqual(['linkedProject', 'minBudget']);
  });

  test('εξαγωγή καρτέλας vs όλα τα φίλτρα', () => {
    const visible = [{ prosklisiId: 'a' }];
    const allFiltered = [{ prosklisiId: 'a' }, { prosklisiId: 'b' }];
    expect(resolveProsklisiExportRows(PROSKLISI_EXPORT_SCOPE.VISIBLE_TAB, {
      visibleRows: visible,
      allFilteredRows: allFiltered,
    })).toHaveLength(1);
    expect(resolveProsklisiExportRows(PROSKLISI_EXPORT_SCOPE.ALL_FILTERED, {
      visibleRows: visible,
      allFilteredRows: allFiltered,
    })).toHaveLength(2);
  });

  test('εγγραφή εξαγωγής χρησιμοποιεί ισχύουσα λήξη', () => {
    const record = buildProsklisiExportRecord(
      { deadline: '2019-10-31', title: 'Π' },
      {
        modifications: [{
          modificationDocumentDate: '2025-10-01',
          changes: { deadline: { original: '2019-10-31', current: '2026-12-31' } },
        }],
      }
    );
    expect(record.originalDeadline).toBe('2019-10-31');
    expect(record.deadline).toBe('2026-12-31');
    expect(record.lastModificationDate).toBe('2025-10-01');
  });
});
