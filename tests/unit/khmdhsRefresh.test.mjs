import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const kh = require('../../app/core/khmdhsRefresh.js');

const now = Date.parse('2026-08-23T00:00:00.000Z');
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const bridge = {
  projectId: 'proj-road',
  subprojectId: 'sub-bridge',
  projectTitle: 'Οδικό δίκτυο Αρχανών',
  subprojectTitle: 'Γέφυρα Αγίου Σύλλα',
  khmdhsNoticeAdam: '24PROC000000001',
  khmdhsNoticeFetchedAt: daysAgo(40),
};
const lights = {
  projectId: 'proj-road',
  subprojectId: 'sub-lights',
  projectTitle: 'Οδικό δίκτυο Αρχανών',
  subprojectTitle: 'Φωτισμός κόμβου',
};
const tank = {
  projectId: 'proj-water',
  subprojectId: 'sub-tank',
  projectTitle: 'Ύδρευση Αστερουσίων',
  subprojectTitle: 'Δεξαμενή Παρανύμφων',
  khmdhsAdam: '24SYMV000000002',
  khmdhsContractFetchedAt: daysAgo(5),
};
const paid = {
  projectId: 'proj-done',
  subprojectId: 'sub-paid',
  projectTitle: 'Ολοκληρωμένο έργο σχολείου',
  subprojectTitle: 'Αίθουσα εκδηλώσεων',
  projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
  khmdhsAdam: '24SYMV000000099',
};
const untitled = {
  subprojectId: 'sub-ghost',
  projectTitle: '',
  subprojectTitle: '',
  khmdhsAdam: '24PROC000000088',
};

test('μαζική ανανέωση μόνο σε διαχειριστή / υπερδιαχειριστή', () => {
  assert.equal(kh.showBatchRefreshButton('ADMIN'), true);
  assert.equal(kh.showBatchRefreshButton('SUPERADMIN'), true);
  assert.equal(kh.showBatchRefreshButton('ENGINEER'), false);
  assert.equal(kh.showBatchRefreshButton('USER'), false);
  assert.equal(kh.evaluateBatchRefreshAccess({
    username: 'maria',
    actor: { role: 'ENGINEER', active: true, approved: true },
  }).ok, false);
  assert.equal(kh.evaluateBatchRefreshAccess({
    username: 'admin',
    actor: { role: 'ADMIN', active: true, approved: true },
  }).ok, true);
});

test('ανανέωση κάρτας: όχι χρήστης· όχι ολοκληρωμένο· μηχανικός μόνο στα χρεωμένα', () => {
  assert.equal(kh.canUserRefreshKhmdhs({ role: 'USER' }, bridge), false);
  assert.equal(kh.canUserRefreshKhmdhs({ role: 'ADMIN' }, bridge), true);
  assert.equal(kh.canUserRefreshKhmdhs({ role: 'ADMIN' }, paid), false);
  assert.equal(kh.canUserRefreshKhmdhs({ role: 'ENGINEER' }, bridge, { visibleToEngineer: true }), true);
  assert.equal(kh.canUserRefreshKhmdhs({ role: 'ENGINEER' }, tank, { visibleToEngineer: false }), false);
  assert.equal(kh.showCardRefreshButton(true, true), true);
  assert.equal(kh.showCardRefreshButton(true, false), false);
  assert.equal(kh.showCardRefreshButton(false, true), false);
});

test('μαζική: ολοκληρωμένο / χωρίς ΑΔΑΜ / κλειδωμένο / χωρίς τίτλο', () => {
  const locked = {
    ...bridge,
    subprojectId: 'sub-legacy',
    subprojectTitle: 'Ανάπλαση κεντρικής πλατείας',
  };
  const { eligible, skipped } = kh.classifyProjectsForBatch(
    [bridge, lights, tank, paid, untitled, locked],
    { locks: { 'sub-legacy': true }, now }
  );
  assert.deepEqual(eligible.map((r) => r.id).sort(), ['sub-bridge', 'sub-tank']);
  const reasons = Object.fromEntries(skipped.map((s) => [s.id, s.reason]));
  assert.equal(reasons['sub-lights'], 'Χωρίς ΑΔΑΜ');
  assert.equal(reasons['sub-paid'], 'Ολοκληρωμένο');
  assert.equal(reasons['sub-legacy'], 'Κλειδωμένο');
  assert.equal(skipped.some((s) => s.id === 'sub-ghost'), false);
});

test('μετά από ανανέωση χωρίς διαφορές δεν μένει παλαιό λόγω παλιού εγγράφου', () => {
  const justChecked = {
    ...bridge,
    khmdhsNoticeFetchedAt: daysAgo(40),
    khmdhsChainLastRefreshedAt: daysAgo(0),
  };
  const stillOld = kh.classifyForBatchRefresh(justChecked, { now });
  assert.equal(kh.isBatchItemStale(stillOld), false);
  assert.equal(kh.isKhmdhsRefreshStale(justChecked, 30, now), false);
  const neverChecked = kh.classifyForBatchRefresh(bridge, { now });
  assert.equal(kh.isBatchItemStale(neverChecked), true);
});

test('παλαιά: χωρίς ημερομηνία ή ≥30 ημέρες· φρέσκο όχι', () => {
  const stale = kh.classifyForBatchRefresh(bridge, { now });
  const fresh = kh.classifyForBatchRefresh(tank, { now });
  assert.equal(kh.isBatchItemStale(stale), true);
  assert.equal(kh.isBatchItemStale(fresh), false);
  const onlyOld = kh.classifyProjectsForBatch([bridge, tank], { now, onlyStale: true });
  assert.deepEqual(onlyOld.eligible.map((r) => r.id), ['sub-bridge']);
});

test('έναρξη ανανέωσης: κλείδωμα, χωρίς ΑΔΑΜ, ολοκληρωμένο', () => {
  const admin = { role: 'ADMIN', active: true, approved: true };
  assert.equal(kh.evaluateSingleRefreshStart({
    username: 'admin',
    actor: admin,
    subprojectId: 'sub-legacy',
    project: { ...bridge, subprojectId: 'sub-legacy' },
    locked: true,
    lockedBy: 'Νίκος',
    seedAdam: '24PROC000000001',
  }).error.includes('Νίκος'), true);
  assert.equal(kh.evaluateSingleRefreshStart({
    username: 'admin',
    actor: admin,
    subprojectId: 'sub-lights',
    project: lights,
    seedAdam: '',
  }).ok, false);
  assert.equal(kh.evaluateSingleRefreshStart({
    username: 'admin',
    actor: admin,
    subprojectId: 'sub-paid',
    project: paid,
    seedAdam: '24SYMV000000099',
  }).ok, false);
  assert.equal(kh.evaluateSingleRefreshStart({
    username: 'admin',
    actor: admin,
    subprojectId: 'sub-bridge',
    project: bridge,
    seedAdam: '24PROC000000001',
  }).ok, true);
});
