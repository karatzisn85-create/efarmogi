import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const psk = require('../../app/core/prosklisiCatalog.js');

function daysFrom(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test('ισχύουσα λήξη από τελευταία τροποποίηση, όχι από την παλιά ρίζα', () => {
  const effective = psk.getEffectiveProsklisiDeadline(
    { deadline: daysFrom(-400) },
    [{
      modificationDocumentDate: daysFrom(-10),
      changes: { deadline: { original: daysFrom(-400), current: daysFrom(8) } },
    }]
  );
  assert.equal(effective, daysFrom(8));
  assert.equal(psk.getProsklisiViewTab({
    status: 'Υπό Ωρίμανση',
    deadline: daysFrom(-400),
  }, [{
    modificationDocumentDate: daysFrom(-10),
    changes: { deadline: { original: daysFrom(-400), current: daysFrom(8) } },
  }]), psk.PROSKLISI_VIEW_TABS.ACTIVE);
});

test('λήγουν σύντομα: εντός 30 ημερών ή ήδη ληγμένες, όχι μακρινές', () => {
  assert.equal(psk.isProsklisiDeadlineExpiringSoon(daysFrom(5), 30), true);
  assert.equal(psk.isProsklisiDeadlineExpiringSoon(daysFrom(200), 30), false);
  assert.equal(psk.isProsklisiDeadlineExpiringSoon(daysFrom(-2), 30), true);
});

test('χωρίς έργο και αναζήτηση στον τρέχοντα κωδικό', () => {
  const far = { prosklisiId: 'psk-far', title: 'Πρόσκληση μακρινή', code: 'PSK-200', linkedProjects: [] };
  const schools = {
    prosklisiId: 'psk-schools',
    title: 'Πρόσκληση σχολείων',
    code: 'PSK-100',
    linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }],
  };
  assert.equal(psk.isProsklisiUnlinked(far), true);
  assert.equal(psk.isProsklisiUnlinked(schools), false);
  assert.equal(psk.prosklisiMatchesQuickSearch(schools, 'PSK-100'), true);
  assert.equal(psk.prosklisiMatchesQuickSearch(schools, 'PSK-200'), false);
  assert.equal(psk.prosklisiMatchesQuickSearch(schools, 'Οδικό δίκτυο'), true);
});

test('Νέα Πρόσκληση μόνο για διαχειριστή', () => {
  assert.equal(psk.showNewProsklisiButton('ADMIN'), true);
  assert.equal(psk.showNewProsklisiButton('ENGINEER'), false);
  assert.equal(psk.showNewProsklisiButton('USER'), false);
});

test('νέα πρόσκληση: μόνο τίτλος και άξονας, με trim', () => {
  const empty = psk.collectProsklisiRequiredErrors({});
  assert.equal(empty.title, 'Ο τίτλος είναι υποχρεωτικός');
  assert.equal(empty.axis, 'Ο άξονας προτεραιότητας είναι υποχρεωτικός');
  const spaces = psk.collectProsklisiRequiredErrors({ title: '   ', axis: '  ' });
  assert.equal(spaces.title, 'Ο τίτλος είναι υποχρεωτικός');
  assert.equal(spaces.axis, 'Ο άξονας προτεραιότητας είναι υποχρεωτικός');
  const ok = psk.collectProsklisiRequiredErrors({ title: 'Πρόσκληση', axis: 'Άξονας 1' });
  assert.deepEqual(ok, {});
});

test('ταξινόμηση κατά λήξη δεν μετράει ως φίλτρο — οι ετικέτες δείχνουν τι κόβει τη λίστα', () => {
  const none = psk.collectProsklisiFilterChips({ sortByDeadline: true });
  assert.deepEqual(none, []);
  assert.equal(psk.countProsklisiActiveFilters({ sortByDeadline: true }), 0);
  const chips = psk.collectProsklisiFilterChips({
    searchTerm: '  σχολείων  ',
    showExpiringSoonOnly: true,
    sortByDeadline: true,
    advancedFilters: { axis: 'Εκπαίδευση', status: 'Υπό Υποβολή' },
  });
  assert.deepEqual(chips.map((c) => c.id), ['search', 'expiringSoon', 'axis']);
  assert.equal(chips.find((c) => c.id === 'search').label.includes('σχολείων'), true);
});

test('κατάσταση στα tabs: μόνο ανοιχτές στις ενεργές, μόνο υποβληθείσες στο δικό τους tab', () => {
  const all = ['Υπό Ωρίμανση', 'Υπό Υποβολή', 'Υποβληθέν ΤΔΠ', 'Υποβληθέν'];
  assert.deepEqual(
    psk.statusesForProsklisiViewTab(all, psk.PROSKLISI_VIEW_TABS.ACTIVE),
    ['Υπό Υποβολή', 'Υπό Ωρίμανση']
  );
  assert.deepEqual(
    psk.statusesForProsklisiViewTab(all, psk.PROSKLISI_VIEW_TABS.SUBMITTED),
    ['Υποβληθέν', 'Υποβληθέν ΤΔΠ']
  );
});

test('εξαγωγή προεπιλογή: όσες φαίνονται στο tab, όχι όλες τις φιλτραρισμένες', () => {
  const visible = [{ prosklisiId: 'a' }, { prosklisiId: 'b' }];
  const allFiltered = [{ prosklisiId: 'a' }, { prosklisiId: 'b' }, { prosklisiId: 'expired' }];
  const seen = psk.resolveProsklisiExportRows(psk.PROSKLISI_EXPORT_SCOPE.VISIBLE_TAB, {
    visibleRows: visible,
    allFilteredRows: allFiltered,
  });
  assert.deepEqual(seen.map((p) => p.prosklisiId), ['a', 'b']);
  const across = psk.resolveProsklisiExportRows(psk.PROSKLISI_EXPORT_SCOPE.ALL_FILTERED, {
    visibleRows: visible,
    allFilteredRows: allFiltered,
  });
  assert.deepEqual(across.map((p) => p.prosklisiId), ['a', 'b', 'expired']);
  const fallback = psk.resolveProsklisiExportRows('unknown', {
    visibleRows: visible,
    allFilteredRows: allFiltered,
  });
  assert.deepEqual(fallback.map((p) => p.prosklisiId), ['a', 'b']);
});

test('εξαγωγή γράφει την ισχύουσα λήξη μετά την τροποποίηση, όχι την παλιά ρίζα', () => {
  const record = psk.buildProsklisiExportRecord(
    { prosklisiId: 'psk-modded', deadline: daysFrom(-400), title: 'Με τροποποίηση' },
    {
      modifications: [{
        modificationDocumentDate: daysFrom(-10),
        changes: { deadline: { original: daysFrom(-400), current: daysFrom(8) } },
      }],
    }
  );
  assert.equal(record.originalDeadline, daysFrom(-400));
  assert.equal(record.deadline, daysFrom(8));
  assert.equal(record.lastModificationDate, daysFrom(-10));
  const afterLoad = psk.buildProsklisiExportRecord(
    { prosklisiId: 'psk-modded', deadline: daysFrom(8), title: 'Με τροποποίηση' },
    {
      modifications: [{
        modificationDocumentDate: daysFrom(-10),
        changes: { deadline: { original: daysFrom(-400), current: daysFrom(8) } },
      }],
    }
  );
  assert.equal(afterLoad.originalDeadline, daysFrom(-400));
  assert.equal(afterLoad.deadline, daysFrom(8));
  assert.equal(record.title, 'Με τροποποίηση');
  assert.equal(record.modificationsCount, 1);
});

test('PDF αναφορά: ίδιες γραμμές με την οθόνη, χωρίς HTML από τίτλο', () => {
  const html = psk.buildProsklisiExportHtml({
    columns: [
      { id: 'title', label: 'Τίτλος Πρόσκλησης' },
      { id: 'deadline', label: 'Ημερομηνία Λήξης' },
      { id: 'originalDeadline', label: 'Αρχική λήξη' },
    ],
    rows: [{
      title: 'Πρόσκληση με <τροπή>',
      deadline: '09/09/2026',
      originalDeadline: '28/07/2025',
    }],
    meta: {
      organizationName: 'Δήμος Αρχανών-Αστερουσίων',
      scopeLabel: '1 πρόσκληση από τις «Ενεργές»',
      filterSummary: ['Με τροποποιήσεις'],
      exportedAt: '01/09/2026',
    },
  });
  assert.equal(html.includes('Πρόσκληση με <τροπή>'), false);
  assert.equal(html.includes('Πρόσκληση με &lt;τροπή&gt;'), true);
  assert.equal(html.includes('09/09/2026'), true);
  assert.equal(html.includes('28/07/2025'), true);
  assert.equal(html.includes('Με τροποποιήσεις'), true);
  assert.equal(html.includes('Ενεργές'), true);
  assert.equal(psk.PROSKLISI_EXPORT_FORMAT.PDF, 'pdf');
});

test('μοναδικές τιμές άξονα/πηγής για τις λίστες φίλτρου', () => {
  const values = psk.uniqueSortedProsklisiFieldValues([
    { axis: 'Υποδομές' },
    { axis: 'Εκπαίδευση' },
    { axis: 'Εκπαίδευση' },
    { axis: '  ' },
  ], 'axis');
  assert.deepEqual(values, ['Εκπαίδευση', 'Υποδομές']);
});

test('προϋπολογισμός: ελληνικές χιλιάδες και εύρος, όχι parseFloat στα τυφλά', () => {
  const range = psk.parseProsklisiBudgetRange('100.000 - 200.000');
  assert.equal(range.min, 100000);
  assert.equal(range.max, 200000);
  const single = psk.parseProsklisiBudgetRange('50.000 €');
  assert.equal(single.min, 50000);
  assert.equal(single.max, 50000);
  const greek = psk.parseProsklisiBudgetRange('1.234.567,89 έως 2.000.000,00');
  assert.equal(greek.min, 1234567.89);
  assert.equal(greek.max, 2000000);
  assert.equal(psk.prosklisiMatchesBudgetWindow({ budgetRange: '100.000 - 200.000' }, '90.000', ''), true);
  assert.equal(psk.prosklisiMatchesBudgetWindow({ budgetRange: '50.000' }, '90.000', ''), false);
  assert.equal(psk.prosklisiMatchesBudgetWindow({ budgetRange: '100.000 - 200.000' }, '', '80.000'), false);
  assert.equal(psk.prosklisiMatchesBudgetWindow({ budgetRange: '' }, '10.000', ''), false);
  assert.equal(psk.prosklisiMatchesBudgetWindow({ budgetRange: '100.000 - 200.000' }, 'abc', ''), true);
});

test('φίλτρο συσχετισμένου έργου και εξωτερικό φίλτρο έργου', () => {
  const schools = {
    prosklisiId: 'psk-schools',
    title: 'Πρόσκληση σχολείων',
    linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }],
  };
  const far = { prosklisiId: 'psk-far', title: 'Πρόσκληση μακρινή', linkedProjects: [] };
  const water = {
    prosklisiId: 'psk-expired',
    title: 'Πρόσκληση που έληξε',
    linkedProjects: [{ title: 'Ύδρευση Αστερουσίων' }],
  };
  assert.deepEqual(
    psk.uniqueLinkedProjectTitles([schools, far, water]),
    ['Οδικό δίκτυο Αρχανών', 'Ύδρευση Αστερουσίων']
  );
  const byLink = psk.applyProsklisiAdvancedFilters([schools, far, water], {
    advancedFilters: { linkedProject: 'Οδικό δίκτυο Αρχανών' },
  });
  assert.deepEqual(byLink.map((p) => p.prosklisiId), ['psk-schools']);
  const fromCard = psk.applyProsklisiAdvancedFilters([schools, far, water], {
    projectFilter: 'Οδικό δίκτυο Αρχανών',
  });
  assert.deepEqual(fromCard.map((p) => p.prosklisiId), ['psk-schools']);
  const byInviteTitle = psk.applyProsklisiAdvancedFilters([schools, far], {
    projectFilter: 'Πρόσκληση μακρινή',
  });
  assert.deepEqual(byInviteTitle.map((p) => p.prosklisiId), ['psk-far']);
});

test('λήγουν σύντομα στον κατάλογο: ανοιχτές εντός 30 ημερών, όχι ήδη ληγμένες', () => {
  const soon = { prosklisiId: 'a', deadline: daysFrom(5) };
  const far = { prosklisiId: 'b', deadline: daysFrom(200) };
  const expired = { prosklisiId: 'c', deadline: daysFrom(-2) };
  const ids = psk.applyProsklisiDailyFilters([soon, far, expired], {
    showExpiringSoonOnly: true,
  }).map((p) => p.prosklisiId);
  assert.deepEqual(ids, ['a']);
  assert.equal(psk.isProsklisiDeadlineUpcomingSoon(daysFrom(5), 30), true);
  assert.equal(psk.isProsklisiDeadlineUpcomingSoon(daysFrom(-2), 30), false);
});

test('φίλτρα τροποποιήσεων, ΑΔΑ Διαύγειας και σχετικής ένταξης', () => {
  const schools = {
    prosklisiId: 'psk-schools',
    title: 'Πρόσκληση σχολείων',
    diavgeiaAda: 'Ψ1234ΩΞΞ-ΑΑΑ',
  };
  const far = { prosklisiId: 'psk-far', title: 'Πρόσκληση μακρινή' };
  const modded = { prosklisiId: 'psk-modded', title: 'Πρόσκληση με τροποποίηση λήξης' };
  const modsMap = { 'psk-modded': [{ modificationId: 'mod-1' }] };
  assert.deepEqual(
    psk.applyProsklisiDailyFilters([schools, far, modded], {
      showWithModificationsOnly: true,
      modificationsById: modsMap,
    }).map((p) => p.prosklisiId),
    ['psk-modded']
  );
  const withAda = psk.applyProsklisiAdvancedFilters([schools, far], {
    advancedFilters: { diavgeiaAda: 'yes' },
  });
  assert.deepEqual(withAda.map((p) => p.prosklisiId), ['psk-schools']);
  const adaOnlyOnMod = psk.applyProsklisiAdvancedFilters([far, modded], {
    advancedFilters: { diavgeiaAda: 'yes' },
    modificationsById: {
      'psk-modded': [{ diavgeiaMeta: { ada: 'Ω9Ψ8ΩΞΞ-ΒΒΒ' } }],
    },
  });
  assert.deepEqual(adaOnlyOnMod.map((p) => p.prosklisiId), ['psk-modded']);
  const modsWithAda = [{ diavgeiaMeta: { ada: 'Ω9Ψ8ΩΞΞ-ΒΒΒ' } }];
  assert.equal(psk.getProsklisiDiavgeiaAdaText(modded, modsWithAda), 'Ω9Ψ8ΩΞΞ-ΒΒΒ');
  assert.deepEqual(
    psk.applyProsklisiDailyFilters([far, modded], {
      searchTerm: 'Ω9Ψ8ΩΞΞ-ΒΒΒ',
      diavgeiaAdaById: {
        'psk-modded': psk.getProsklisiDiavgeiaAdaText(modded, modsWithAda),
      },
    }).map((p) => p.prosklisiId),
    ['psk-modded']
  );
  assert.equal(
    psk.buildProsklisiExportRecord(modded, { modifications: modsWithAda }).diavgeiaAda,
    'Ω9Ψ8ΩΞΞ-ΒΒΒ'
  );
  const withEntaxi = psk.applyProsklisiAdvancedFilters([schools, far], {
    advancedFilters: { relatedEntaxi: 'yes' },
    relatedEntaxiCountById: { 'psk-schools': 1 },
  });
  assert.deepEqual(withEntaxi.map((p) => p.prosklisiId), ['psk-schools']);
  const chips = psk.collectProsklisiFilterChips({
    showWithModificationsOnly: true,
    advancedFilters: { diavgeiaAda: 'yes', relatedEntaxi: 'no' },
  });
  assert.deepEqual(chips.map((c) => c.id), ['withModifications', 'diavgeiaAda', 'relatedEntaxi']);
});

test('διαγραφή πρόσκλησης χρειάζεται ταυτότητα και αφαιρεί μόνο αυτή', () => {
  assert.equal(psk.evaluateProsklisiDelete('').ok, false);
  assert.equal(psk.evaluateProsklisiDelete('psk-1').ok, true);
  assert.equal(psk.showProsklisiDeleteAction('ADMIN'), true);
  assert.equal(psk.showProsklisiDeleteAction('USER'), false);
  const next = psk.removeProsklisiFromList([
    { prosklisiId: 'a' },
    { prosklisiId: 'b' },
  ], 'a');
  assert.deepEqual(next.map((p) => p.prosklisiId), ['b']);
});
