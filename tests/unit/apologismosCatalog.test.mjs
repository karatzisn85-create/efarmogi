import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const apo = require('../../app/core/apologismosCatalog.js');

const period = apo.createDefaultPeriod();

test('κουμπί απολογισμού μόνο στον υπερδιαχειριστή', () => {
  assert.equal(apo.showApologismosButton('SUPERADMIN'), true);
  assert.equal(apo.showApologismosButton('ADMIN'), false);
  assert.equal(apo.showApologismosButton('ENGINEER'), false);
  assert.equal(apo.showApologismosButton('USER'), false);
  assert.equal(apo.canManageApologismos({ role: 'SUPERADMIN' }), true);
  assert.equal(apo.canManageApologismos({ role: 'ADMIN' }), false);
});

test('περίοδος: έτη υποχρεωτικά και έναρξη όχι μετά τη λήξη', () => {
  assert.match(apo.evaluateApologismosPeriod('', '2028').error, /έτος/);
  assert.match(apo.evaluateApologismosPeriod('2029', '2024').error, /έτη περιόδου/);
  const ok = apo.evaluateApologismosPeriod('2024', '2028');
  assert.equal(ok.ok, true);
  assert.equal(ok.id, '2024-2028');
  assert.match(ok.label, /2024–2028/);
  assert.equal(period.startYear, 2024);
  assert.equal(period.endYear, 2028);
});

test('ένταξη: μόνο ολοκληρωμένα, χωρίς διπλότυπο', () => {
  const done = { subprojectId: 'sub-paid', projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ' };
  const running = { subprojectId: 'sub-lights', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' };
  assert.equal(apo.canAddLinkedSubproject(done, []).ok, true);
  assert.match(apo.canAddLinkedSubproject(running, []).error, /ολοκληρωμένα/);
  assert.match(
    apo.canAddLinkedSubproject(done, [{ source: 'linked', subprojectId: 'sub-paid' }]).error,
    /ήδη/
  );
  const eligible = apo.listEligibleSubprojects([done, running], []);
  assert.deepEqual(eligible.map((s) => s.subprojectId), ['sub-paid']);
});

test('παλαιότερο έργο: τίτλος, περιοχή, έτος περιόδου και ποσά', () => {
  assert.match(apo.validateLegacyCardInput({ title: '' }, period).errors.join(' '), /τίτλος/);
  assert.match(
    apo.validateLegacyCardInput({
      title: 'Παλιό',
      area: 'Αρχάνες',
      completionYear: 2018,
      approvedAmount: '10',
      contractAmount: '9'
    }, period).errors.join(' '),
    /δεν ανήκει/
  );
  const ok = apo.validateLegacyCardInput({
    title: 'Παλιό',
    area: 'Αρχάνες',
    completionYear: 2025,
    approvedAmount: '10.000,00',
    contractAmount: '9.000,00'
  }, period);
  assert.equal(ok.ok, true);
});

test('αναζήτηση: τίτλος υποέργου, τίτλος έργου και περιοχή· ΚΑ όχι', () => {
  const cards = [
    { id: '1', title: 'Αίθουσα εκδηλώσεων', projectTitle: 'Ολοκληρωμένο έργο σχολείου', area: 'Αρχανών', ready: false },
    { id: '2', title: 'Παλιό υδραγωγείο', projectTitle: '', area: 'Χουδέτσι', ready: true }
  ];
  assert.deepEqual(apo.filterApologismosCards(cards, { search: 'αίθουσα' }).map((c) => c.id), ['1']);
  assert.deepEqual(apo.filterApologismosCards(cards, { search: 'σχολείου' }).map((c) => c.id), ['1']);
  assert.deepEqual(apo.filterApologismosCards(cards, { search: 'ΧΟΥΔΕΤΣΙ' }).map((c) => c.id), ['2']);
  assert.equal(apo.filterApologismosCards(cards, { search: 'ΚΑ-400' }).length, 0);
  assert.deepEqual(apo.filterApologismosCards(cards, { status: 'ready' }).map((c) => c.id), ['2']);
  assert.deepEqual(apo.filterApologismosCards(cards, { status: 'pending' }).map((c) => c.id), ['1']);
});

test('νέα κάρτα δεν είναι έτοιμη· με κείμενο και «μόνο κείμενο» γίνεται', () => {
  const draft = apo.withReadiness({
    title: 'Αίθουσα εκδηλώσεων',
    source: 'linked',
    approvedAmount: '80.000,00',
    contractAmount: '75.000,00'
  });
  assert.equal(draft.ready, false);
  assert.equal(apo.canStartPresentation([draft]), false);
  const ready = apo.completeAsSimpleCard(draft);
  assert.equal(ready.ready, true);
  assert.equal(apo.canStartPresentation([ready]), true);
});
