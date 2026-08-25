/**
 * @jest-environment node
 *
 * Κανόνες Ημερολογίου Εργοταξίου: ποιος βλέπει, ποιος γράφει, ποιος αλλάζει τι,
 * πότε εμφανίζεται το κουμπί στην κάρτα υποέργου και τι δέχεται μια εγγραφή.
 */
import siteDiary from '../../app/core/siteDiary';

const TODAY = '2026-08-25';

describe('ρόλοι', () => {
  test('ο χρήστης μόνο-ανάγνωσης δεν βλέπει καθόλου το ημερολόγιο', () => {
    expect(siteDiary.canViewSiteDiary('USER')).toBe(false);
    expect(siteDiary.showSiteDiaryButton('USER')).toBe(false);
    expect(siteDiary.canWriteSiteDiary('USER')).toBe(false);
  });

  test('μηχανικός γράφει, διαχειριστής μόνο βλέπει, υπερδιαχειριστής διορθώνει χωρίς να καταχωρεί', () => {
    expect(siteDiary.canWriteSiteDiary('ENGINEER')).toBe(true);
    expect(siteDiary.canWriteSiteDiary('SUPERADMIN')).toBe(true);
    expect(siteDiary.canWriteSiteDiary('ADMIN')).toBe(false);
    expect(siteDiary.canViewSiteDiary('ADMIN')).toBe(true);
    expect(siteDiary.isSiteDiaryReadOnly('ADMIN')).toBe(true);
    expect(siteDiary.isSiteDiaryReadOnly('ENGINEER')).toBe(false);
    expect(siteDiary.isSiteDiaryReadOnly('SUPERADMIN')).toBe(false);
  });
});

describe('εύρος υποέργων μηχανικού', () => {
  const visible = new Set(['sub-mine']);

  test('ο μηχανικός βλέπει μόνο τα χρεωμένα του υποέργα', () => {
    expect(siteDiary.canViewSubprojectDiary({
      role: 'ENGINEER', visibleSubprojectIds: visible, subprojectId: 'sub-mine',
    })).toBe(true);
    expect(siteDiary.canViewSubprojectDiary({
      role: 'ENGINEER', visibleSubprojectIds: visible, subprojectId: 'sub-other',
    })).toBe(false);
  });

  test('ο διαχειριστής βλέπει κάθε υποέργο χωρίς λίστα ορατών', () => {
    expect(siteDiary.canViewSubprojectDiary({
      role: 'ADMIN', visibleSubprojectIds: null, subprojectId: 'sub-other',
    })).toBe(true);
  });

  test('καταχώριση μόνο από μηχανικό εντός χρέωσης — ο υπερδιαχειριστής δεν ανοίγει νέα επίσκεψη', () => {
    expect(siteDiary.canAddEntry({
      role: 'ENGINEER', visibleSubprojectIds: visible, subprojectId: 'sub-mine',
    })).toBe(true);
    expect(siteDiary.canAddEntry({
      role: 'ENGINEER', visibleSubprojectIds: visible, subprojectId: 'sub-other',
    })).toBe(false);
    expect(siteDiary.canAddEntry({
      role: 'SUPERADMIN', visibleSubprojectIds: null, subprojectId: 'sub-other',
    })).toBe(false);
    expect(siteDiary.canAddEntry({
      role: 'ADMIN', visibleSubprojectIds: null, subprojectId: 'sub-mine',
    })).toBe(false);
  });
});

describe('αλλαγή εγγραφής', () => {
  const mine = { authorUsername: 'kmichalis' };
  const foreign = { authorUsername: 'apapadopoulos' };

  test('ο μηχανικός αλλάζει μόνο τις δικές του καταχωρίσεις', () => {
    expect(siteDiary.canEditEntry({ role: 'ENGINEER', username: 'kmichalis', entry: mine })).toBe(true);
    expect(siteDiary.canEditEntry({ role: 'ENGINEER', username: 'kmichalis', entry: foreign })).toBe(false);
  });

  test('ο υπερδιαχειριστής αλλάζει τα πάντα, ο διαχειριστής τίποτα', () => {
    expect(siteDiary.canEditEntry({ role: 'SUPERADMIN', username: 'root', entry: foreign })).toBe(true);
    expect(siteDiary.canEditEntry({ role: 'ADMIN', username: 'admin', entry: foreign })).toBe(false);
  });

  test('κενό όνομα χρήστη δεν ταιριάζει ποτέ με κενό συντάκτη', () => {
    expect(siteDiary.canEditEntry({ role: 'ENGINEER', username: '', entry: { authorUsername: '' } })).toBe(false);
  });
});

describe('κουμπί στην κάρτα υποέργου', () => {
  const base = { role: 'ADMIN', visibleSubprojectIds: null, subprojectId: 'sub-1' };

  test('εμφανίζεται σε εκτελούμενο υποέργο χωρίς καμία εγγραφή', () => {
    expect(siteDiary.showCardDiaryButton({
      ...base, projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ', entryCount: 0,
    })).toBe(true);
  });

  test('δεν εμφανίζεται σε υποέργο υπό ωρίμανση χωρίς εγγραφές', () => {
    expect(siteDiary.showCardDiaryButton({
      ...base, projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ', entryCount: 0,
    })).toBe(false);
  });

  test('εμφανίζεται πάντα όταν υπάρχει έστω μία εγγραφή — ακόμη κι αν αλλάξει η κατάσταση', () => {
    expect(siteDiary.showCardDiaryButton({
      ...base, projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ', entryCount: 3,
    })).toBe(true);
  });

  test('ο χρήστης μόνο-ανάγνωσης δεν το βλέπει ποτέ', () => {
    expect(siteDiary.showCardDiaryButton({
      ...base, role: 'USER', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ', entryCount: 5,
    })).toBe(false);
  });

  test('ο μηχανικός δεν το βλέπει σε υποέργο εκτός χρέωσής του', () => {
    expect(siteDiary.showCardDiaryButton({
      role: 'ENGINEER',
      visibleSubprojectIds: new Set(['sub-mine']),
      subprojectId: 'sub-other',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      entryCount: 9,
    })).toBe(false);
  });
});

describe('έλεγχος εγγραφής επίσκεψης', () => {
  const valid = { visitDate: '2026-08-24', visitTime: '09:30', notes: 'Σκυροδέτηση πλάκας' };

  test('δέχεται πλήρη εγγραφή και συμπληρώνει προεπιλεγμένη πορεία', () => {
    const res = siteDiary.validateEntry(valid, { today: TODAY });
    expect(res.ok).toBe(true);
    expect(res.progress).toBe('normal');
    expect(res.contractorOrder).toBe('');
  });

  test('απαιτεί ημερομηνία', () => {
    const res = siteDiary.validateEntry({ ...valid, visitDate: '' }, { today: TODAY });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('visitDate');
  });

  test('δεν δέχεται μελλοντική ημερομηνία', () => {
    const res = siteDiary.validateEntry({ ...valid, visitDate: '2026-08-26' }, { today: TODAY });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('visitDate');
  });

  test('δέχεται τη σημερινή ημερομηνία', () => {
    expect(siteDiary.validateEntry({ ...valid, visitDate: TODAY }, { today: TODAY }).ok).toBe(true);
  });

  test('η ώρα είναι προαιρετική αλλά πρέπει να είναι έγκυρη', () => {
    expect(siteDiary.validateEntry({ ...valid, visitTime: '' }, { today: TODAY }).ok).toBe(true);
    const bad = siteDiary.validateEntry({ ...valid, visitTime: '25:00' }, { today: TODAY });
    expect(bad.ok).toBe(false);
    expect(bad.field).toBe('visitTime');
  });

  test('απαιτεί περιγραφή της επίσκεψης', () => {
    const res = siteDiary.validateEntry({ ...valid, notes: '   ' }, { today: TODAY });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('notes');
  });

  test('απορρίπτει άγνωστη κατάσταση πορείας', () => {
    const res = siteDiary.validateEntry({ ...valid, progress: 'ανύπαρκτο' }, { today: TODAY });
    expect(res.ok).toBe(false);
    expect(res.field).toBe('progress');
  });
});

describe('φρεσκάδα τελευταίας επίσκεψης', () => {
  test('πρόσφατη, παλαιότερη και ξεχασμένη', () => {
    expect(siteDiary.recencyTone('2026-08-24', TODAY)).toBe('fresh');
    expect(siteDiary.recencyTone('2026-08-10', TODAY)).toBe('aging');
    expect(siteDiary.recencyTone('2026-06-01', TODAY)).toBe('stale');
    expect(siteDiary.recencyTone('', TODAY)).toBe('none');
  });

  test('λεκτικό για σήμερα, χθες και παλαιότερα', () => {
    expect(siteDiary.recencyLabel(TODAY, TODAY)).toBe('Σήμερα');
    expect(siteDiary.recencyLabel('2026-08-24', TODAY)).toBe('Χθες');
    expect(siteDiary.recencyLabel('2026-08-20', TODAY)).toBe('Πριν 5 ημέρες');
    expect(siteDiary.recencyLabel('', TODAY)).toBe('Καμία επίσκεψη');
  });
});

describe('ταξινόμηση, ομαδοποίηση και φίλτρα', () => {
  const entries = [
    { id: 'a', visitDate: '2026-08-20', visitTime: '08:00', notes: 'Εκσκαφή', progress: 'normal', authorUsername: 'eng1', photos: [{ name: 'p1' }] },
    { id: 'b', visitDate: '2026-08-24', visitTime: '15:00', notes: 'Οπλισμός', progress: 'delay', authorUsername: 'eng2', contractorOrder: 'Ενίσχυση συνεργείου' },
    { id: 'c', visitDate: '2026-08-24', visitTime: '09:00', notes: 'Καλούπωμα', progress: 'normal', authorUsername: 'eng1' },
  ];

  test('νεότερη επίσκεψη πρώτη, με την ώρα να σπάει την ισοβαθμία', () => {
    expect(siteDiary.sortEntriesDesc(entries).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  test('ομαδοποίηση ανά ημέρα με τη νεότερη ημέρα πρώτη', () => {
    const groups = siteDiary.groupEntriesByDate(entries);
    expect(groups.map((g) => g.date)).toEqual(['2026-08-24', '2026-08-20']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['b', 'c']);
  });

  test('φίλτρο «οι δικές μου»', () => {
    const res = siteDiary.filterEntries(entries, { quickFilter: 'mine', username: 'eng1' });
    expect(res.map((e) => e.id).sort()).toEqual(['a', 'c']);
  });

  test('φίλτρο «καθυστέρηση / διακοπή»', () => {
    const res = siteDiary.filterEntries(entries, { quickFilter: 'attention' });
    expect(res.map((e) => e.id)).toEqual(['b']);
  });

  test('φίλτρο «με εντολή»', () => {
    const res = siteDiary.filterEntries(entries, { quickFilter: 'orders' });
    expect(res.map((e) => e.id)).toEqual(['b']);
  });

  test('αναζήτηση σε κείμενο επίσκεψης', () => {
    expect(siteDiary.filterEntries(entries, { search: 'οπλισμ' }).map((e) => e.id)).toEqual(['b']);
    expect(siteDiary.filterEntries(entries, { search: 'ανύπαρκτο' })).toEqual([]);
  });

  test('ο μηχανικός δεν παίρνει ποτέ εγγραφές εκτός των υποέργων του', () => {
    const rows = [
      { id: 'x', subprojectId: 'sub-mine' },
      { id: 'y', subprojectId: 'sub-other' },
    ];
    const res = siteDiary.filterEntriesForViewer(rows, {
      role: 'ENGINEER',
      visibleSubprojectIds: new Set(['sub-mine']),
    });
    expect(res.map((e) => e.id)).toEqual(['x']);
    expect(siteDiary.filterEntriesForViewer(rows, { role: 'ADMIN' })).toHaveLength(2);
  });

  test('σύνοψη: πλήθος, φωτογραφίες, εντολές και τελευταία επίσκεψη', () => {
    const summary = siteDiary.summarizeEntries(entries, { today: TODAY });
    expect(summary.total).toBe(3);
    expect(summary.photoCount).toBe(1);
    expect(summary.orderCount).toBe(1);
    expect(summary.lastVisitDate).toBe('2026-08-24');
    expect(summary.lastProgress).toBe('delay');
    expect(summary.daysSinceLastVisit).toBe(1);
    expect(summary.recencyTone).toBe('fresh');
    expect(summary.byProgress.normal).toBe(2);
    expect(summary.byProgress.delay).toBe(1);
  });

  test('κενό ημερολόγιο δίνει ουδέτερη σύνοψη', () => {
    const summary = siteDiary.summarizeEntries([], { today: TODAY });
    expect(summary.total).toBe(0);
    expect(summary.latest).toBeNull();
    expect(summary.recencyTone).toBe('none');
    expect(summary.recencyLabel).toBe('Καμία επίσκεψη');
  });
});
