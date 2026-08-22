import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const egk = require('../../app/core/egkrisiCatalog.js');

const road = [
  { projectId: 'proj-road', subprojectId: 'sub-bridge', projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-100' },
  { projectId: 'proj-road', subprojectId: 'sub-lights', projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Φωτισμός κόμβου', kaCode: 'ΚΑ-101' },
];
const water = [
  { projectId: 'proj-water', subprojectId: 'sub-tank', projectTitle: 'Ύδρευση Αστερουσίων', subprojectTitle: 'Δεξαμενή Παρανύμφων', kaCode: 'ΚΑ-200', aleCode: '71-1234.001' },
];

test('αναζήτηση: όλη η ομάδα μένει αν ταιριάζει ένα υποέργο· όχι όνομα αρχείου', () => {
  const byTitle = egk.filterEgkrisiProjectGroups([road, water], 'γέφυρα');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].length, 2);
  assert.equal(byTitle[0][1].subprojectId, 'sub-lights');

  const byKa = egk.filterEgkrisiProjectGroups([road, water], 'ΚΑ-200');
  assert.equal(byKa.length, 1);
  assert.equal(byKa[0][0].subprojectId, 'sub-tank');

  const byAle = egk.filterEgkrisiProjectGroups([road, water], '71-1234');
  assert.equal(byAle[0][0].subprojectId, 'sub-tank');

  assert.equal(egk.filterEgkrisiProjectGroups([road, water], 'ΑΔΑ-XYZ').length, 0);
});

test('ίδιο υποέργο σε δεύτερη ομάδα εμφανίζεται μία φορά', () => {
  const dup = [
    ...road,
    { projectId: 'proj-other', subprojectId: 'sub-bridge', projectTitle: 'Άλλο', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-100' },
  ];
  const groups = egk.filterEgkrisiProjectGroups([road, dup], '');
  const ids = groups.flat().map((p) => p.subprojectId);
  assert.equal(ids.filter((id) => id === 'sub-bridge').length, 1);
});

test('τύπος και ρόλοι: Νέα Έγκριση πάντα· ενέργειες όχι σε μηχανικό / χρήστη', () => {
  assert.equal(egk.formatEgkrisiType('initial'), 'Αρχική');
  assert.equal(egk.formatEgkrisiType('modification'), 'Τροποποίηση');
  assert.equal(egk.formatEgkrisiType(''), '');
  assert.equal(egk.showNewEgkrisiButton('ENGINEER'), true);
  assert.equal(egk.showNewEgkrisiButton('USER'), true);
  assert.equal(egk.canManageEgkrisiActions('ADMIN'), true);
  assert.equal(egk.canManageEgkrisiActions('ENGINEER'), false);
  assert.equal(egk.canManageEgkrisiActions('USER'), false);
});

test('αυτόνομο PDF: ακριβής τίτλος, πρώτο αρχική, ήδη φορτωμένο αγνοείται', () => {
  const groups = [road, [
    { projectId: 'proj-old', subprojectId: 'sub-legacy', projectTitle: 'Παλιό έργο πλατείας', subprojectTitle: 'Ανάπλαση κεντρικής πλατείας' },
  ]];
  const existing = {
    'proj-road': [{ subprojectId: 'sub-lights', egkriseis: [{ id: 'keep', fileName: 'υπάρχον.pdf' }] }],
  };
  const merged = egk.mergeStandaloneEgkriseis(existing, {
    projects: {
      road: {
        title: 'Οδικό δίκτυο Αρχανών',
        subprojects: { lights: { title: 'Φωτισμός κόμβου', pdfs: ['should-not-appear.pdf'] } },
      },
      plateia: {
        title: 'Παλιό έργο πλατείας',
        subprojects: { anaplasi: { title: 'Ανάπλαση κεντρικής πλατείας', pdfs: ['α.pdf', 'β.pdf'] } },
      },
      ghost: {
        title: 'Άγνωστο έργο',
        subprojects: { x: { title: 'Κάτι', pdfs: ['ghost.pdf'] } },
      },
    },
  }, groups);

  assert.equal(merged['proj-road'][0].egkriseis[0].fileName, 'υπάρχον.pdf');
  assert.equal(merged['proj-old'][0].egkriseis[0].type, 'initial');
  assert.equal(merged['proj-old'][0].egkriseis[1].type, 'modification');
  assert.equal(merged['proj-old'][0].egkriseis[0].id, 'standalone_plateia_anaplasi_0');
  assert.ok(!Object.values(merged).some((list) =>
    (list || []).some((row) => (row.egkriseis || []).some((e) => e.fileName === 'ghost.pdf'))
  ));
});
