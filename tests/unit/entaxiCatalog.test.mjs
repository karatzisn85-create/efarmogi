import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ent = require('../../app/core/entaxiCatalog.js');

const sample = {
  initialAmount: '160.000,00',
  modifications: [
    { modificationId: 'm1', changeAmount: false, amount: '' },
    { modificationId: 'm2', changeAmount: true, amount: '155.285,47' },
  ],
};

test('τρέχον ποσό: η τροποποίηση αντικαθιστά, δεν προσθέτει', () => {
  assert.ok(Math.abs(ent.getEntaxiCurrentTotal(sample) - 155285.47) < 0.01);
  assert.ok(Math.abs(ent.getEntaxiCurrentTotal(sample) - 471159.47) > 1);
  assert.equal(ent.formatEntaxiAmount(ent.getEntaxiCurrentTotal(sample)), '155.285,47');
});

test('χωρίς έργο: κενός τίτλος ή κενά υποέργα', () => {
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: '', subprojectIds: [] }), true);
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: 'Οδικό', subprojectIds: [] }), true);
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: 'Οδικό', subprojectIds: ['sub-1'] }), false);
});

test('ομαδοποίηση με κενό τίτλο πάει στις μη συσχετισμένες', () => {
  const groups = ent.groupEntaxeisByProjectTitle([
    { entaxiId: 'a', projectTitle: 'Οδικό δίκτυο Αρχανών' },
    { entaxiId: 'b', projectTitle: '' },
  ]);
  assert.equal(groups['Οδικό δίκτυο Αρχανών'].length, 1);
  assert.equal(groups[ent.UNLINKED_GROUP_TITLE][0].entaxiId, 'b');
});

test('Νέα Ένταξη μόνο για διαχειριστή', () => {
  assert.equal(ent.showNewEntaxiButton('ADMIN'), true);
  assert.equal(ent.showNewEntaxiButton('ENGINEER'), false);
  assert.equal(ent.showNewEntaxiButton('USER'), false);
});
