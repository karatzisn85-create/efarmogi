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
