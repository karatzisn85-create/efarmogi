import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const reg = require('../../app/core/contractorRegistry.js');

const TODAY = '2026-08-24';

function liveProfile(overrides = {}) {
  return {
    key: 'vat:123456789',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    count: 1,
    amount: 100000,
    assignments: [{ subprojectId: 'sub-a', projectId: 'p1', subprojectTitle: 'Ύδρευση' }],
    ...overrides,
  };
}

test('κατάλογος: συγχώνευση συμβάσεων με καρτέλες και ορφανά', () => {
  const profiles = [liveProfile({
    assignments: [
      { subprojectId: 'sub-a', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' },
      { subprojectId: 'sub-b', projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ' },
    ],
  })];
  const records = [
    reg.createEmptyContractorRecord({
      id: 'rec-1',
      vat: '123456789',
      name: 'ΤΕΧΝΙΚΗ Α.Ε.',
      phone: '2810',
    }),
    reg.createEmptyContractorRecord({
      id: 'orphan',
      name: 'ΧΩΡΙΣ ΣΥΜΒΑΣΗ ΟΕ',
      vat: '999',
    }),
  ];
  const rows = reg.buildContractorHubRows(profiles, records);
  assert.equal(rows.length, 2);
  const live = rows.find((r) => r.vat === '123456789');
  assert.equal(live.phone, '2810');
  assert.equal(live.registryId, 'rec-1');
  assert.equal(reg.countActiveAssignments(live), 1);
  assert.equal(reg.assignmentIsActive(live.assignments[0]), true);
  assert.equal(reg.hubRowKey(live), 'rec-1');
  assert.ok(rows.find((r) => r.orphan && r.registryId === 'orphan'));
});

test('κουμπί μητρώου αναδόχων σε όλους τους ρόλους', () => {
  assert.equal(reg.showContractorRegistryButton('ADMIN'), true);
  assert.equal(reg.showContractorRegistryButton('SUPERADMIN'), true);
  assert.equal(reg.showContractorRegistryButton('ENGINEER'), true);
  assert.equal(reg.showContractorRegistryButton('USER'), true);
  assert.equal(reg.canViewContractorRegistry('USER'), true);
  assert.equal(reg.isContractorRegistryReadOnly('USER'), true);
  assert.equal(reg.isContractorRegistryReadOnly('ENGINEER'), false);
});

test('επεξεργασία: διαχειριστές όλα· μηχανικός μόνο χρεωμένα· ανάγνωση ποτέ', () => {
  assert.equal(reg.canManageContractorRegistry('ADMIN'), true);
  assert.equal(reg.canManageContractorRegistry('ENGINEER'), false);
  assert.equal(reg.canEditGuarantees('ENGINEER'), true);
  assert.equal(reg.canEditGuarantees('USER'), false);
  assert.equal(reg.canEditAcceptances('ADMIN'), true);
  assert.equal(reg.canEditForSubproject({
    role: 'ADMIN',
    visibleSubprojectIds: new Set(['sub-a']),
    subprojectId: 'sub-other',
  }), true);
  assert.equal(reg.canEditForSubproject({
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
    subprojectId: 'sub-a',
  }), true);
  assert.equal(reg.canEditForSubproject({
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
    subprojectId: 'sub-other',
  }), false);
  assert.equal(reg.canEditForSubproject({
    role: 'USER',
    visibleSubprojectIds: new Set(['sub-a']),
    subprojectId: 'sub-a',
  }), false);
});

test('ταυτότητα: ΑΦΜ προηγείται, αλλιώς επωνυμία — ίδιο κλειδί με ΚΗΜΔΗΣ', () => {
  assert.equal(reg.contractorIdentityKey({ vat: '123-456-789', name: 'ΑΛΛΟΣ' }), 'vat:123456789');
  assert.equal(reg.contractorIdentityKey({ vat: '', name: 'ACME LTD' }), 'name:ACME LTD');
  assert.equal(reg.contractorIdentityKey({ vat: '', name: '' }), '');
  assert.equal(reg.normalizeVatDigits('EL 094 123 456'), '094123456');
  const name = 'Τεχνική Α.Ε.';
  assert.equal(reg.contractorIdentityKey({ vat: '', name: name }), 'name:' + name.toUpperCase());
  assert.equal(reg.normalizeContractorDisplayName('Τεχνική Α.Ε.'), reg.normalizeContractorDisplayName('ΤΕΧΝΙΚΗ ΑΕ'));
  const ok = reg.evaluateContractorIdentity({ name: '  Τεχνική  ', vat: '123456789', email: 'a@b.gr' });
  assert.equal(ok.ok, true);
  assert.equal(ok.identityKey, 'vat:123456789');
  assert.match(reg.evaluateContractorIdentity({ name: '', vat: '' }).error, /επωνυμία ή ΑΦΜ/);
  assert.match(reg.evaluateContractorIdentity({ name: 'Α', email: 'χωρίς' }).error, /email/);
});

test('εγγυητική: είδος, κατάσταση, λήξη αν είναι ενεργή, σύνδεση υποέργου, ποσό ≥ 0', () => {
  assert.match(reg.evaluateGuarantee({}).error, /είδος/);
  assert.match(reg.evaluateGuarantee({ type: 'καλής εκτέλεσης' }).error, /κατάσταση/);
  assert.match(reg.evaluateGuarantee({
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    subprojectId: 'sub-a',
  }).error, /λήξης/);
  assert.match(reg.evaluateGuarantee({
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    expiresOn: '2026-12-01',
  }).error, /υποέργο/);
  assert.match(reg.evaluateGuarantee({
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    expiresOn: '2026-01-01',
    issuedOn: '2026-06-01',
    subprojectId: 'sub-a',
  }).error, /πριν την έκδοση/);
  assert.match(reg.evaluateGuarantee({
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    expiresOn: '2026-12-01',
    amount: -5,
    subprojectId: 'sub-a',
  }).error, /αρνητικό/);

  const ok = reg.evaluateGuarantee({
    type: 'προκαταβολής',
    status: 'ενεργή',
    amount: '1.234,56',
    bank: 'Εθνική',
    letterNumber: 'ΕΓΓ-1',
    issuedOn: '2026-01-15',
    expiresOn: '2026-12-31',
    subprojectId: 'sub-a',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.guarantee.amount, 1234.56);
  assert.equal(reg.parseAmount('1.234').value, 1234);
  assert.equal(reg.parseAmount('1234.5').value, 1234.5);
  assert.equal(ok.guarantee.type, 'προκαταβολής');

  const returned = reg.evaluateGuarantee({
    type: 'συμμετοχής',
    status: 'επιστράφηκε',
    subprojectId: 'sub-a',
  });
  assert.equal(returned.ok, true);
  assert.equal(returned.guarantee.expiresOn, '');
});

test('παραλαβή: υποέργο υποχρεωτικό· ημερομηνίες με σωστή σειρά· τουλάχιστον μία ημερομηνία', () => {
  assert.match(reg.evaluateAcceptance({}).error, /υποέργο/);
  const emptyDates = reg.evaluateAcceptance({ subprojectId: 'sub-a' });
  assert.equal(emptyDates.ok, false);
  assert.match(emptyDates.error, /ημερομηνία/);
  assert.match(reg.evaluateAcceptance({
    subprojectId: 'sub-a',
    provisionalDate: '2026-06-01',
    finalDate: '2026-05-01',
  }).error, /πριν την προσωρινή/);
  assert.match(reg.evaluateAcceptance({
    subprojectId: 'sub-a',
    finalDate: '2026-06-01',
    warrantyEndsOn: '2026-05-01',
  }).error, /πριν την οριστική/);
  const ok = reg.evaluateAcceptance({
    subprojectId: 'sub-a',
    provisionalDate: '2026-01-10',
    finalDate: '2026-03-10',
    warrantyEndsOn: '2027-03-10',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.acceptance.warrantyEndsOn, '2027-03-10');
});

test('συγχώνευση καρτέλας με προφίλ ΚΗΜΔΗΣ: ΑΦΜ ή επωνυμία', () => {
  const profiles = [liveProfile()];
  const stored = [reg.createEmptyContractorRecord({
    id: 'rec-1',
    vat: '123456789',
    name: 'Τεχνική ΑΕ',
    phone: '2810123456',
    email: 'tech@example.gr',
    notes: 'καλό συνεργείο',
    guarantees: [{ id: 'g1', status: 'ενεργή', subprojectId: 'sub-a' }],
  })];
  const merged = reg.overlayRegistryOnProfiles(profiles, stored);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].registryId, 'rec-1');
  assert.equal(merged[0].phone, '2810123456');
  assert.equal(merged[0].guarantees[0].id, 'g1');
  assert.equal(merged[0].count, 1);

  const byName = reg.findRecordForProfile(
    { key: 'name:ΤΕΧΝΙΚΗ Α.Ε.', name: 'Τεχνική Α.Ε.', vat: '' },
    [{ identityKey: 'name:ΤΕΧΝΙΚΗ ΑΕ', name: 'Τεχνική Α.Ε.', vat: '' }],
  );
  assert.ok(byName);

  assert.equal(reg.recordsMatchProfile(
    { vat: '111', name: 'ΤΕΧΝΙΚΗ Α.Ε.' },
    { vat: '222', name: 'ΤΕΧΝΙΚΗ Α.Ε.', key: 'vat:222' },
  ), false, 'διαφορετικό ΑΦΜ δεν συγχωνεύεται λόγω ίδιας επωνυμίας');
  assert.equal(reg.recordsMatchProfile(
    { vat: '111', name: 'ΠΑΛΙΑ ΕΠΩΝΥΜΙΑ' },
    { vat: '111', name: 'ΝΕΑ ΕΠΩΝΥΜΙΑ', key: 'vat:111' },
  ), true);

  const orphans = reg.listOrphanRegistryRecords(profiles, [
    stored[0],
    reg.createEmptyContractorRecord({ id: 'orphan', name: 'Άλλος ΟΕ', vat: '999' }),
  ]);
  assert.deepEqual(orphans.map((r) => r.id), ['orphan']);
});

test('μηχανικός βλέπει μόνο αναδόχους χρεωμένων υποέργων', () => {
  const rows = [
    {
      name: 'Δικός',
      assignments: [{ subprojectId: 'sub-a' }],
      guarantees: [],
      acceptances: [],
    },
    {
      name: 'Ξένος',
      assignments: [{ subprojectId: 'sub-z' }],
      guarantees: [],
      acceptances: [],
    },
    {
      name: 'Μόνο εγγυητική',
      assignments: [],
      guarantees: [{ subprojectId: 'sub-a' }],
      acceptances: [],
    },
  ];
  const visible = reg.filterHubForViewer(rows, {
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
  });
  assert.deepEqual(visible.map((r) => r.name), ['Δικός', 'Μόνο εγγυητική']);
  assert.equal(reg.filterHubForViewer(rows, { role: 'ADMIN' }).length, 3);
  assert.equal(reg.filterHubForViewer(rows, { role: 'USER' }).length, 3);
});

test('ραντάρ: ενεργή που λήγει/έληξε· επιστραμμένη αγνοείται· μακρινή όχι', () => {
  const row = {
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    key: 'vat:123456789',
    guarantees: [
      { id: 'soon', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2026-09-10', subprojectId: 'sub-a' },
      { id: 'far', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2027-08-24', subprojectId: 'sub-a' },
      { id: 'back', type: 'συμμετοχής', status: 'επιστράφηκε', expiresOn: '2026-08-25', subprojectId: 'sub-a' },
      { id: 'late', type: 'προκαταβολής', status: 'ενεργή', expiresOn: '2026-08-01', subprojectId: 'sub-a' },
      { id: 'ancient', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2025-01-01', subprojectId: 'sub-a' },
    ],
    acceptances: [
      { id: 'acc-1', subprojectId: 'sub-a', provisionalDate: '2026-09-01', finalDate: '2022-01-01', warrantyEndsOn: '2026-09-20' },
    ],
  };
  const radar = reg.listContractorRadarItems([row], { todayIso: TODAY, warnDays: 30, urgentDays: 7 });
  const kinds = radar.map((i) => `${i.kind}:${i.guaranteeId || i.acceptanceId}:${i.urgency}`).sort();
  assert.ok(kinds.includes('guarantee:soon:soon'));
  assert.ok(kinds.includes('guarantee:late:past'));
  assert.equal(kinds.some((k) => k.includes('ancient')), false, 'παλιά λήξη δεν μένει για πάντα στο ραντάρ');
  assert.ok(kinds.includes('provisional_acceptance:acc-1:soon'));
  assert.ok(kinds.includes('warranty:acc-1:soon'));
  assert.equal(kinds.some((k) => k.includes('far')), false);
  assert.equal(kinds.some((k) => k.includes('back')), false);
  assert.equal(kinds.some((k) => k.includes('final_acceptance')), false, 'παλιά οριστική δεν μένει στο ραντάρ');
  const soon = radar.find((i) => i.guaranteeId === 'soon');
  assert.equal(soon.contractorName, 'ΤΕΧΝΙΚΗ Α.Ε.');
  assert.ok(soon.rowKey);
});

test('ραντάρ: μηχανικός μόνο χρεωμένα· ανάγνωση τίποτα· διαχειριστής όλα', () => {
  const items = [
    { kind: 'guarantee', subprojectId: 'sub-a', contractorName: 'Α' },
    { kind: 'warranty', subprojectId: 'sub-z', contractorName: 'Β' },
  ];
  assert.equal(reg.filterRadarItemsForViewer(items, { role: 'USER' }).length, 0);
  assert.equal(reg.filterRadarItemsForViewer(items, { role: 'ADMIN' }).length, 2);
  const eng = reg.filterRadarItemsForViewer(items, {
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
  });
  assert.deepEqual(eng.map((i) => i.subprojectId), ['sub-a']);
});

test('αναζήτηση καταλόγου: επωνυμία, ΑΦΜ, αριθμός επιστολής', () => {
  const rows = [
    { name: 'ΤΕΧΝΙΚΗ Α.Ε.', vat: '123456789', guarantees: [{ letterNumber: 'ΕΓΓ-99', bank: 'Πειραιώς', status: 'ενεργή' }] },
    { name: 'ΑΛΛΟΣ ΟΕ', vat: '000', guarantees: [] },
  ];
  assert.equal(reg.parseContractorSearch(rows[0], 'εγγ-99'), true);
  assert.equal(reg.parseContractorSearch(rows[0], 'Πειραιώς'), true);
  assert.equal(reg.filterContractorHub(rows, { search: 'τεχνικη' }).length, 1);
  assert.equal(reg.filterContractorHub(rows, { search: 'Τεχνική' }).length, 1);
  assert.equal(reg.filterContractorHub(rows, { quickFilter: 'active_guarantee' }).length, 1);
});

test('αποθήκευση μηχανικού: κρατά εγγυητικές άλλων υποέργων, αγνοεί όσα δεν του ανήκουν', () => {
  const existing = reg.createEmptyContractorRecord({
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    phone: '111',
    guarantees: [
      { id: 'g-foreign', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2026-12-01', subprojectId: 'sub-z' },
      { id: 'g-old', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2026-10-01', subprojectId: 'sub-a' },
    ],
    acceptances: [
      { id: 'acc-z', subprojectId: 'sub-z', warrantyEndsOn: '2028-01-01' },
    ],
  });
  const incoming = {
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    phone: '222',
    guarantees: [
      { id: 'g-new', type: 'προκαταβολής', status: 'ενεργή', expiresOn: '2026-11-01', subprojectId: 'sub-a' },
      { id: 'g-sneak', type: 'συμμετοχής', status: 'ενεργή', expiresOn: '2026-09-01', subprojectId: 'sub-z' },
    ],
    acceptances: [
      { id: 'acc-a', subprojectId: 'sub-a', provisionalDate: '2026-09-01' },
    ],
  };
  const merged = reg.mergeEngineerRecordSave(existing, incoming, new Set(['sub-a']));
  assert.equal(merged.phone, '111');
  assert.equal(merged.name, 'ΤΕΧΝΙΚΗ Α.Ε.');
  assert.deepEqual(merged.guarantees.map((g) => g.id).sort(), ['g-foreign', 'g-new']);
  assert.deepEqual(merged.acceptances.map((a) => a.id).sort(), ['acc-a', 'acc-z']);
  assert.equal(reg.collectRecordSubprojectIds(merged).sort().join(','), 'sub-a,sub-z');

  const renamed = reg.mergeEngineerRecordSave(existing, {
    ...incoming,
    name: 'ΆΛΛΟΣ',
    vat: '999',
  }, new Set(['sub-a']));
  assert.equal(renamed.name, 'ΤΕΧΝΙΚΗ Α.Ε.');
  assert.equal(renamed.vat, '123456789');

  const created = reg.mergeEngineerRecordSave(null, {
    name: 'ΝΕΟΣ',
    vat: '555',
    guarantees: [
      { id: 'g-own', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2026-11-01', subprojectId: 'sub-a' },
      { id: 'g-sneak', type: 'συμμετοχής', status: 'ενεργή', expiresOn: '2026-09-01', subprojectId: 'sub-z' },
    ],
  }, new Set(['sub-a']));
  assert.deepEqual(created.guarantees.map((g) => g.id), ['g-own']);
});

test('μηχανικός συμπληρώνει κενό τηλέφωνο, δεν αντικαθιστά υπάρχον', () => {
  const existingEmpty = reg.createEmptyContractorRecord({
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    phone: '',
  });
  const filled = reg.mergeEngineerRecordSave(existingEmpty, {
    id: 'rec-1',
    phone: '2810123456',
    guarantees: [],
  }, new Set(['sub-a']));
  assert.equal(filled.phone, '2810123456');

  const existingSet = reg.createEmptyContractorRecord({
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    phone: '111',
    email: 'old@a.gr',
    notes: 'σημείωση',
  });
  const blocked = reg.mergeEngineerRecordSave(existingSet, {
    id: 'rec-1',
    phone: '999',
    email: 'new@a.gr',
    notes: 'άλλη',
    guarantees: [],
  }, new Set(['sub-a']));
  assert.equal(blocked.phone, '111');
  assert.equal(blocked.email, 'old@a.gr');
  assert.equal(blocked.notes, 'σημείωση');
});

test('ολόκληρη καρτέλα: απορρίπτει κακή εγγυητική, κανονικοποιεί έγκυρη', () => {
  assert.match(reg.evaluateRecordPayload({ name: '' }).error, /επωνυμία ή ΑΦΜ/);
  assert.match(reg.evaluateRecordPayload({
    name: 'Α',
    vat: '1',
    guarantees: [{ type: 'καλής εκτέλεσης', status: 'ενεργή', subprojectId: 'sub-a' }],
  }).error, /λήξης/);
  const ok = reg.evaluateRecordPayload({
    name: 'Α',
    vat: '123',
    guarantees: [{
      type: 'καλής εκτέλεσης',
      status: 'ενεργή',
      amount: '10,50',
      expiresOn: '2026-12-01',
      subprojectId: 'sub-a',
    }],
    acceptances: [{ subprojectId: 'sub-a', warrantyEndsOn: '2028-01-01' }],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.record.identityKey, 'vat:123');
  assert.equal(ok.record.guarantees[0].amount, 10.5);
});

test('κενή καρτέλα και προεπιλογές νέας εγγυητικής', () => {
  const rec = reg.createEmptyContractorRecord({ name: 'Νέος', vat: '111' });
  assert.equal(rec.identityKey, 'vat:111');
  assert.deepEqual(rec.guarantees, []);
  assert.deepEqual(rec.acceptances, []);
  const g = reg.createEmptyGuarantee();
  assert.equal(g.type, 'καλής εκτέλεσης');
  assert.equal(g.status, 'ενεργή');
  assert.equal(reg.GUARANTEE_TYPES.length, 4);
  assert.equal(reg.GUARANTEE_STATUSES.length, 4);
});

test('πίνακας εγγυητικών: προσθήκη, αντικατάσταση, διαγραφή, ταξινόμηση', () => {
  const first = { id: 'g1', type: 'καλής εκτέλεσης', status: 'επιστράφηκε', expiresOn: '2026-01-01', subprojectId: 'sub-a' };
  const added = reg.upsertGuaranteeInList([first], {
    id: 'g2', type: 'προκαταβολής', status: 'ενεργή', expiresOn: '2026-06-01', subprojectId: 'sub-a',
  });
  assert.equal(added.length, 2);
  const updated = reg.upsertGuaranteeInList(added, { ...added[0], status: 'καταπέσει' });
  assert.equal(updated.find((g) => g.id === 'g1').status, 'καταπέσει');
  const removed = reg.removeGuaranteeFromList(updated, 'g1');
  assert.deepEqual(removed.map((g) => g.id), ['g2']);
  const sorted = reg.sortGuarantees([
    { id: 'old', status: 'επιστράφηκε', expiresOn: '2026-01-01' },
    { id: 'soon', status: 'ενεργή', expiresOn: '2026-09-01' },
    { id: 'later', status: 'ενεργή', expiresOn: '2026-12-01' },
  ]);
  assert.deepEqual(sorted.map((g) => g.id), ['soon', 'later', 'old']);
});

test('πίνακας παραλαβών: μία ανά υποέργο, αντικατάσταση, διαγραφή, ταξινόμηση', () => {
  const first = {
    id: 'acc-1', subprojectId: 'sub-a', provisionalDate: '2026-01-10', finalDate: '', warrantyEndsOn: '',
  };
  const added = reg.upsertAcceptanceInList([first], {
    id: 'acc-2', subprojectId: 'sub-b', warrantyEndsOn: '2027-03-10',
  });
  assert.equal(added.length, 2);
  const replaced = reg.upsertAcceptanceInList(added, {
    subprojectId: 'sub-a', provisionalDate: '2026-02-01', finalDate: '2026-04-01', warrantyEndsOn: '2027-04-01',
  });
  assert.equal(replaced.length, 2);
  const same = replaced.find((a) => a.subprojectId === 'sub-a');
  assert.equal(same.id, 'acc-1');
  assert.equal(same.finalDate, '2026-04-01');
  const removed = reg.removeAcceptanceFromList(replaced, 'acc-2');
  assert.deepEqual(removed.map((a) => a.id), ['acc-1']);
  const sorted = reg.sortAcceptances([
    { id: 'later', warrantyEndsOn: '2027-12-01' },
    { id: 'empty' },
    { id: 'soon', provisionalDate: '2026-09-01' },
  ]);
  assert.deepEqual(sorted.map((a) => a.id), ['soon', 'later', 'empty']);
});

test('μηχανικός επεξεργάζεται μόνο παραλαβή χρεωμένου υποέργου', () => {
  const opts = { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) };
  assert.equal(reg.acceptanceIsEditable({ subprojectId: 'sub-a' }, opts), true);
  assert.equal(reg.acceptanceIsEditable({ subprojectId: 'sub-z' }, opts), false);
  assert.equal(reg.acceptanceIsEditable({ subprojectId: 'sub-z' }, { role: 'ADMIN' }), true);
  assert.equal(reg.acceptanceIsEditable({ subprojectId: 'sub-a' }, { role: 'USER' }), false);
  const choices = [
    { subprojectId: 'sub-a', label: 'Ύδρευση' },
    { subprojectId: 'sub-b', label: 'Άλλο' },
  ];
  const free = reg.subprojectChoicesWithoutAcceptance(choices, [
    { subprojectId: 'sub-a' },
  ]);
  assert.deepEqual(free.map((c) => c.subprojectId), ['sub-b']);
});

test('μηχανικός επεξεργάζεται μόνο εγγυητική χρεωμένου υποέργου', () => {
  const opts = { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) };
  assert.equal(reg.guaranteeIsEditable({ subprojectId: 'sub-a' }, opts), true);
  assert.equal(reg.guaranteeIsEditable({ subprojectId: 'sub-z' }, opts), false);
  assert.equal(reg.guaranteeIsEditable({ subprojectId: 'sub-z' }, { role: 'ADMIN' }), true);
  assert.equal(reg.guaranteeIsEditable({ subprojectId: 'sub-a' }, { role: 'USER' }), false);
  const choices = reg.subprojectChoicesFromAssignments([
    { subprojectId: 'sub-a', subprojectTitle: 'Ύδρευση', projectId: 'p1' },
    { subprojectId: 'sub-a', subprojectTitle: 'Ύδρευση' },
    { subprojectId: 'sub-z', subprojectTitle: 'Άλλο' },
  ]);
  assert.equal(choices.length, 2);
  assert.deepEqual(
    reg.filterSubprojectChoicesForViewer(choices, opts).map((c) => c.subprojectId),
    ['sub-a'],
  );
});

test('μηχανικός βλέπει τηλέφωνο καρτέλας χωρίς εγγυητική όταν έχει σύμβαση', () => {
  const profiles = [liveProfile({
    assignments: [{ subprojectId: 'sub-a', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' }],
  })];
  const records = [
    reg.createEmptyContractorRecord({
      id: 'rec-1',
      vat: '123456789',
      name: 'ΤΕΧΝΙΚΗ Α.Ε.',
      phone: '2810123456',
      email: 'a@b.gr',
    }),
  ];
  const rows = reg.buildContractorHubRows(profiles, records);
  const visible = reg.filterHubForViewer(rows, {
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
  });
  assert.equal(visible.length, 1);
  assert.equal(visible[0].phone, '2810123456');
  assert.equal(visible[0].email, 'a@b.gr');
  assert.equal(visible[0].registryId, 'rec-1');
  assert.equal(reg.engineerMayAccessRecord(records[0], {
    visibleSubprojectIds: new Set(['sub-a']),
    assignments: profiles[0].assignments,
  }), true);
  assert.equal(reg.engineerMayAccessRecord(records[0], {
    visibleSubprojectIds: new Set(['sub-a']),
    assignments: [],
  }), false);
});

test('μηχανικός στην καρτέλα βλέπει μόνο εγγυητικές/παραλαβές χρεωμένων υποέργων', () => {
  const opts = { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) };
  const shownG = reg.filterLinkedItemsForViewer([
    { id: 'g1', subprojectId: 'sub-a' },
    { id: 'g2', subprojectId: 'sub-z' },
  ], opts);
  const shownA = reg.filterLinkedItemsForViewer([
    { id: 'a1', subprojectId: 'sub-a' },
    { id: 'a2', subprojectId: 'sub-z' },
  ], opts);
  assert.deepEqual(shownG.map((g) => g.id), ['g1']);
  assert.deepEqual(shownA.map((a) => a.id), ['a1']);
  assert.equal(reg.filterLinkedItemsForViewer([{ id: 'g1', subprojectId: 'sub-z' }], { role: 'ADMIN' }).length, 1);
});

test('φόρτωση μηχανικού: μόνο σχετικές καρτέλες και χωρίς ξένες εγγυητικές', () => {
  const opts = {
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-a']),
    identityKeys: new Set(['vat:123456789']),
  };
  const records = [
    reg.createEmptyContractorRecord({
      id: 'own-items',
      name: 'ΔΙΚΟΣ',
      vat: '111',
      phone: '1',
      guarantees: [
        { id: 'g-a', subprojectId: 'sub-a' },
        { id: 'g-z', subprojectId: 'sub-z' },
      ],
    }),
    reg.createEmptyContractorRecord({
      id: 'overlay-only',
      name: 'ΤΕΧΝΙΚΗ Α.Ε.',
      vat: '123456789',
      phone: '2810',
      guarantees: [{ id: 'g-other', subprojectId: 'sub-z' }],
    }),
    reg.createEmptyContractorRecord({
      id: 'foreign',
      name: 'ΞΕΝΟΣ',
      vat: '999',
      phone: 'μυστικό',
      guarantees: [{ id: 'g-x', subprojectId: 'sub-z' }],
    }),
  ];
  const shown = reg.filterRecordsForViewer(records, opts);
  assert.deepEqual(shown.map((r) => r.id).sort(), ['overlay-only', 'own-items']);
  const own = shown.find((r) => r.id === 'own-items');
  assert.deepEqual(own.guarantees.map((g) => g.id), ['g-a']);
  const overlay = shown.find((r) => r.id === 'overlay-only');
  assert.equal(overlay.phone, '2810');
  assert.equal(overlay.guarantees.length, 0);
  assert.equal(shown.some((r) => r.id === 'foreign'), false);
  assert.equal(reg.filterRecordsForViewer(records, { role: 'ADMIN' }).length, 3);
  assert.equal(reg.canEditContactField('2810', 'ENGINEER'), false);
  assert.equal(reg.canEditContactField('', 'ENGINEER'), true);
  assert.equal(reg.canEditContactField('2810', 'ADMIN'), true);
});

test('διπλή καρτέλα ίδιου ΑΦΜ: κρατά την πιο πρόσφατη και δείχνει την άλλη ως ορφανή', () => {
  const profiles = [liveProfile()];
  const newer = reg.createEmptyContractorRecord({
    id: 'rec-new',
    vat: '123456789',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    phone: 'νέο',
    updatedAt: '2026-08-25T10:00:00.000Z',
  });
  const older = reg.createEmptyContractorRecord({
    id: 'rec-old',
    vat: '123456789',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    phone: 'παλιό',
    updatedAt: '2026-01-01T10:00:00.000Z',
  });
  const rows = reg.buildContractorHubRows(profiles, [older, newer]);
  const live = rows.find((r) => !r.orphan);
  const dup = rows.find((r) => r.orphan);
  assert.equal(live.registryId, 'rec-new');
  assert.equal(live.phone, 'νέο');
  assert.equal(dup.registryId, 'rec-old');
  assert.equal(dup.duplicate, true);
});

test('κλειδιά ταυτότητας από υποέργο ΚΗΜΔΗΣ', () => {
  const keys = reg.collectIdentityKeysFromSubproject({
    khmdhsContractSnapshot: { anadoxosName: 'ΑΕ', anadoxosVat: '123456789' },
    contracts: [{
      khmdhsContractSnapshot: { anadoxosName: 'ΑΛΛΟΣ', anadoxosVat: '' },
    }],
  });
  assert.ok(keys.includes('vat:123456789'));
  assert.ok(keys.includes('name:ΑΛΛΟΣ'));
});

test('κλείδωμα πρώτης καταχώρισης από ΑΦΜ/επωνυμία', () => {
  assert.equal(reg.contractorPendingLockId({ vat: '123456789', name: 'Α' }), 'new_vat_123456789');
  assert.match(reg.contractorPendingLockId({ name: 'Γ.ΚΟΝΤΖΕΔΑΚΗΣ & ΣΙΑ Ε.Ε.' }), /^new_name_/);
  assert.equal(reg.contractorPendingLockId({}), '');
});
