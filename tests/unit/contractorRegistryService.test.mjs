import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createContractorRegistryService, CONTRACTOR_REGISTRY_DIR_NAME } =
  require('../../public/contractorRegistryService.js');

const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const G_OWN = '11111111-1111-4111-8111-111111111111';
const G_FOREIGN = '22222222-2222-4222-8222-222222222222';

function makeService() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anadoxoi-'));
  const svc = createContractorRegistryService({ dataDir });
  return { dataDir, svc };
}

function validGuarantee(overrides = {}) {
  return {
    type: 'καλής εκτέλεσης',
    status: 'ενεργή',
    expiresOn: '2026-12-01',
    subprojectId: 'sub-a',
    ...overrides,
  };
}

test('αποθήκευση και ανάγνωση καρτέλας αναδόχου', () => {
  const { dataDir, svc } = makeService();
  const saved = svc.saveRecord({
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    phone: '2810123456',
    guarantees: [validGuarantee({ letterNumber: 'ΕΓΓ-1' })],
  });
  assert.equal(saved.success, true);
  assert.equal(saved.isNew, true);
  assert.equal(saved.record.identityKey, 'vat:123456789');
  assert.match(saved.record.id, /^[0-9a-f-]{36}$/i);
  const disk = path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME, saved.record.id, 'data.json');
  assert.equal(fs.existsSync(disk), true);

  const listed = svc.listRecords();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].phone, '2810123456');
  assert.equal(listed[0].guarantees[0].letterNumber, 'ΕΓΓ-1');
  assert.equal(svc.loadRecord(saved.record.id).vat, '123456789');
});

test('ίδιο ΑΦΜ δεν ανοίγει δεύτερη καρτέλα', () => {
  const { svc } = makeService();
  const first = svc.saveRecord({ name: 'Α', vat: '111', guarantees: [] });
  assert.equal(first.success, true);
  const second = svc.saveRecord({ name: 'Β', vat: '111', guarantees: [] });
  assert.equal(second.success, false);
  assert.equal(second.duplicate, true);
  assert.equal(svc.listRecords().length, 1);
});

test('σύγκρουση ενημέρωσης αν άλλαξε στο μεταξύ', () => {
  const { svc } = makeService();
  const first = svc.saveRecord({ id: UUID_A, name: 'Α', vat: '1' });
  assert.equal(first.success, true);
  const clash = svc.saveRecord(
    { id: UUID_A, name: 'Α2', vat: '1' },
    { expectedUpdatedAt: '2000-01-01T00:00:00.000Z' },
  );
  assert.equal(clash.success, false);
  assert.equal(clash.conflict, true);
  const ok = svc.saveRecord(
    { id: UUID_A, name: 'Α2', vat: '1', phone: '9' },
    { expectedUpdatedAt: first.record.updatedAt },
  );
  assert.equal(ok.success, true);
  assert.equal(ok.record.phone, '9');
});

test('απόρριψη path traversal και κακής εγγυητικής', () => {
  const { svc } = makeService();
  const badId = svc.saveRecord({ id: '../escape', name: 'Α', vat: '1' });
  assert.equal(badId.success, false);
  const badG = svc.saveRecord({
    name: 'Α',
    vat: '1',
    guarantees: [{ type: 'καλής εκτέλεσης', status: 'ενεργή', subprojectId: 'sub-a' }],
  });
  assert.equal(badG.success, false);
  assert.match(badG.error, /λήξης/);
});

test('μηχανικός δεν σβήνει εγγυητική άλλου υποέργου', () => {
  const { svc } = makeService();
  const created = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    guarantees: [
      validGuarantee({ id: G_FOREIGN, subprojectId: 'sub-z', letterNumber: 'ΞΕΝΗ' }),
      validGuarantee({ id: G_OWN, subprojectId: 'sub-a', letterNumber: 'ΔΙΚΗ' }),
    ],
  });
  assert.equal(created.success, true);

  const eng = svc.saveRecord(
    {
      id: UUID_A,
      name: 'Α',
      vat: '1',
      guarantees: [
        validGuarantee({ id: G_OWN, subprojectId: 'sub-a', letterNumber: 'ΝΕΑ', expiresOn: '2027-01-01' }),
      ],
    },
    { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) },
  );
  assert.equal(eng.success, true);
  const letters = eng.record.guarantees.map((g) => g.letterNumber).sort();
  assert.deepEqual(letters, ['ΝΕΑ', 'ΞΕΝΗ']);
});

test('μηχανικός σε νέα καρτέλα δεν περνά εγγυητική ξένου υποέργου', () => {
  const { svc } = makeService();
  const engineer = { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) };

  // Ξένο υποέργο μέσα στην καρτέλα: απόρριψη ολόκληρης της αποθήκευσης,
  // ώστε ο μηχανικός να μη χάσει σιωπηλά ό,τι πληκτρολόγησε.
  const sneak = svc.saveRecord(
    {
      name: 'ΝΕΟΣ',
      vat: '555',
      guarantees: [
        validGuarantee({ subprojectId: 'sub-a', letterNumber: 'ΔΙΚΗ' }),
        validGuarantee({ subprojectId: 'sub-z', letterNumber: 'ΞΕΝΗ' }),
      ],
    },
    engineer,
  );
  assert.equal(sneak.success, false);
  assert.match(sneak.error, /δικαίωμα/);
  assert.equal(svc.listRecords().length, 0);

  const onlyForeign = svc.saveRecord(
    {
      name: 'ΞΕΝΟΣ',
      vat: '556',
      guarantees: [validGuarantee({ subprojectId: 'sub-z', letterNumber: 'ΞΕΝΗ' })],
    },
    engineer,
  );
  assert.equal(onlyForeign.success, false);
  assert.match(onlyForeign.error, /δικαίωμα/);
  assert.equal(svc.listRecords().length, 0);

  // Καρτέλα χωρίς καμία σύνδεση σε υποέργο: ο μηχανικός δεν ανοίγει ορφανούς αναδόχους.
  const unlinked = svc.saveRecord({ name: 'ΚΕΝΟΣ', vat: '557', guarantees: [] }, engineer);
  assert.equal(unlinked.success, false);
  assert.match(unlinked.error, /χρεωμένο υποέργο/);
  assert.equal(svc.listRecords().length, 0);

  // Καθαρή καρτέλα μόνο με δικό του υποέργο: αποθηκεύεται κανονικά.
  const ok = svc.saveRecord(
    {
      name: 'ΔΙΚΟΣ',
      vat: '558',
      guarantees: [validGuarantee({ subprojectId: 'sub-a', letterNumber: 'ΔΙΚΗ' })],
    },
    engineer,
  );
  assert.equal(ok.success, true);
  assert.deepEqual(ok.record.guarantees.map((g) => g.letterNumber), ['ΔΙΚΗ']);
  assert.equal(svc.listRecords().length, 1);
});

test('ανάγνωση ξαναυπολογίζει κλειδί ταυτότητας από ΑΦΜ', () => {
  const { dataDir, svc } = makeService();
  const saved = svc.saveRecord({ name: 'Α', vat: '123456789' });
  const file = path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME, saved.record.id, 'data.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.identityKey = 'name:ΠΑΛΙΟ';
  fs.writeFileSync(file, JSON.stringify(raw));
  const loaded = svc.loadRecord(saved.record.id);
  assert.equal(loaded.identityKey, 'vat:123456789');
});

test('μηχανικός αποθηκεύει στοιχεία επικοινωνίας σε ανάδοχο χρεωμένου υποέργου', () => {
  const { svc } = makeService();
  const saved = svc.saveRecord(
    { name: 'ΕΠΑΦΗ ΑΕ', vat: '777', phone: '2810111111' },
    {
      role: 'ENGINEER',
      visibleSubprojectIds: new Set(['sub-a']),
      assignments: [{ subprojectId: 'sub-a', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' }],
    },
  );
  assert.equal(saved.success, true);
  assert.equal(saved.record.phone, '2810111111');
  assert.equal(saved.record.guarantees.length, 0);
});

test('μηχανικός δεν αντικαθιστά υπάρχον τηλέφωνο καρτέλας', () => {
  const { svc } = makeService();
  const created = svc.saveRecord({
    id: UUID_A,
    name: 'ΕΠΑΦΗ ΑΕ',
    vat: '777',
    phone: '2810111111',
  });
  assert.equal(created.success, true);
  const eng = svc.saveRecord(
    {
      id: UUID_A,
      name: 'ΕΠΑΦΗ ΑΕ',
      vat: '777',
      phone: '9999999999',
      guarantees: [validGuarantee({ id: G_OWN })],
    },
    { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) },
  );
  assert.equal(eng.success, true);
  assert.equal(eng.record.phone, '2810111111');
});

test('αποθήκευση εγγυητικής σε υπάρχουσα καρτέλα', () => {
  const { svc } = makeService();
  const created = svc.saveRecord({ id: UUID_A, name: 'Α', vat: '1' });
  assert.equal(created.success, true);
  const withG = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    guarantees: [validGuarantee({ letterNumber: 'ΕΓΓ-22', amount: '2.500,00' })],
  }, { expectedUpdatedAt: created.record.updatedAt });
  assert.equal(withG.success, true);
  assert.equal(withG.record.guarantees.length, 1);
  assert.equal(withG.record.guarantees[0].letterNumber, 'ΕΓΓ-22');
  assert.equal(withG.record.guarantees[0].amount, 2500);
});

test('αποθήκευση παραλαβής σε υπάρχουσα καρτέλα', () => {
  const { svc } = makeService();
  const created = svc.saveRecord({ id: UUID_A, name: 'Α', vat: '1' });
  assert.equal(created.success, true);
  const withA = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    acceptances: [{
      subprojectId: 'sub-a',
      provisionalDate: '2026-01-10',
      finalDate: '2026-03-10',
      warrantyEndsOn: '2027-03-10',
    }],
  }, { expectedUpdatedAt: created.record.updatedAt });
  assert.equal(withA.success, true);
  assert.equal(withA.record.acceptances.length, 1);
  assert.equal(withA.record.acceptances[0].warrantyEndsOn, '2027-03-10');
});

test('μηχανικός δεν σβήνει παραλαβή άλλου υποέργου', () => {
  const { svc } = makeService();
  const created = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    acceptances: [
      { id: G_FOREIGN, subprojectId: 'sub-z', provisionalDate: '2026-01-01' },
      { id: G_OWN, subprojectId: 'sub-a', provisionalDate: '2026-02-01' },
    ],
  });
  assert.equal(created.success, true);
  const eng = svc.saveRecord(
    {
      id: UUID_A,
      name: 'Α',
      vat: '1',
      acceptances: [
        {
          id: G_OWN,
          subprojectId: 'sub-a',
          provisionalDate: '2026-03-01',
          finalDate: '2026-04-01',
          warrantyEndsOn: '2027-04-01',
        },
      ],
    },
    { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) },
  );
  assert.equal(eng.success, true);
  assert.deepEqual(eng.record.acceptances.map((a) => a.subprojectId).sort(), ['sub-a', 'sub-z']);
  const own = eng.record.acceptances.find((a) => a.subprojectId === 'sub-a');
  assert.equal(own.finalDate, '2026-04-01');
  assert.equal(own.warrantyEndsOn, '2027-04-01');
});

test('διαγραφή καρτέλας αφαιρεί τον φάκελο', () => {
  const { dataDir, svc } = makeService();
  const saved = svc.saveRecord({ id: UUID_B, name: 'Διαγραφή', vat: '9' });
  assert.equal(saved.success, true);
  const gone = svc.deleteRecord(UUID_B);
  assert.equal(gone.success, true);
  assert.equal(svc.loadRecord(UUID_B), null);
  assert.equal(fs.existsSync(path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME, UUID_B)), false);
  const missing = svc.deleteRecord(UUID_B);
  assert.equal(missing.success, false);
});

test('διαγραφή εγγυητικής αφαιρεί τα αρχεία της', () => {
  const { dataDir, svc } = makeService();
  const created = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    guarantees: [validGuarantee({ id: G_OWN, letterNumber: '1' })],
  });
  assert.equal(created.success, true);
  const src = path.join(dataDir, 'sample.pdf');
  fs.writeFileSync(src, 'pdf');
  const up = svc.uploadFiles(UUID_A, G_OWN, [src]);
  assert.equal(up.success, true);
  const filesDir = path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME, UUID_A, 'ΑΡΧΕΙΑ', G_OWN);
  assert.equal(fs.existsSync(filesDir), true);
  const cleared = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    guarantees: [],
  }, { expectedUpdatedAt: created.record.updatedAt });
  assert.equal(cleared.success, true);
  assert.equal(fs.existsSync(filesDir), false);
});

test('μηχανικός που αφαιρεί δική του εγγυητική δεν σβήνει αρχεία άλλης', () => {
  const { dataDir, svc } = makeService();
  const created = svc.saveRecord({
    id: UUID_A,
    name: 'Α',
    vat: '1',
    guarantees: [
      validGuarantee({ id: G_FOREIGN, subprojectId: 'sub-z', letterNumber: 'Z' }),
      validGuarantee({ id: G_OWN, subprojectId: 'sub-a', letterNumber: 'A' }),
    ],
  });
  assert.equal(created.success, true);
  const src = path.join(dataDir, 'foreign.pdf');
  fs.writeFileSync(src, 'pdf');
  assert.equal(svc.uploadFiles(UUID_A, G_FOREIGN, [src]).success, true);
  const foreignDir = path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME, UUID_A, 'ΑΡΧΕΙΑ', G_FOREIGN);
  assert.equal(fs.existsSync(foreignDir), true);
  const eng = svc.saveRecord(
    {
      id: UUID_A,
      name: 'Α',
      vat: '1',
      guarantees: [],
    },
    { role: 'ENGINEER', visibleSubprojectIds: new Set(['sub-a']) },
  );
  assert.equal(eng.success, true);
  assert.equal(eng.record.guarantees.some((g) => g.id === G_FOREIGN), true);
  assert.equal(eng.record.guarantees.some((g) => g.id === G_OWN), false);
  assert.equal(fs.existsSync(foreignDir), true);
});
