import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const groups = require('../../app/core/prosklisiFileGroups.js');

test('νέα ομάδα και υποομάδα κρατούν τα αρχεία στη σωστή θέση', () => {
  const withGroup = groups.applyFormChoice([], [], { action: 'new', title: 'Δικαιολογητικά' }, [
    { fileName: 'α.pdf' }
  ], 'g1');
  assert.equal(withGroup.fileGroups.length, 1);
  assert.equal(withGroup.fileGroups[0].title, 'Δικαιολογητικά');
  assert.equal(withGroup.ungroupedFiles.length, 0);

  const withSub = groups.applyFormChoice(withGroup.fileGroups, [], {
    action: 'subgroup',
    parentId: 'g1',
    title: 'Φορολογικά'
  }, [{ fileName: 'β.pdf' }], 'g2');
  const parent = groups.findGroupById(withSub.fileGroups, 'g1');
  const child = groups.findGroupById(withSub.fileGroups, 'g2');
  assert.equal(parent.files.length, 1);
  assert.equal(child.title, 'Φορολογικά');
  assert.equal(child.files[0].fileName, 'β.pdf');
  assert.deepEqual(groups.titlesPathForGroup(withSub.fileGroups, 'g2'), ['Δικαιολογητικά', 'Φορολογικά']);
  assert.equal(groups.countGroupFiles(parent), 2);
});

test('μεταφορά αρχείων από λίστα σε υπάρχουσα ομάδα', () => {
  const pulled = groups.pullFilesByName(
    [{ fileName: 'α.pdf' }, { fileName: 'β.pdf' }],
    [{ id: 'g1', title: 'Όροι', files: [{ fileName: 'γ.pdf' }], subgroups: [] }],
    ['α.pdf', 'γ.pdf']
  );
  assert.equal(pulled.files.length, 2);
  assert.equal(pulled.prosklisiFiles.length, 1);
  assert.equal(pulled.prosklisiFiles[0].fileName, 'β.pdf');
  assert.equal(pulled.fileGroups[0].files.length, 0);

  const next = groups.addFilesToGroup(pulled.fileGroups, 'g1', pulled.files);
  assert.equal(next[0].files.length, 2);
});

test('οι περιττοί φάκελοι εξαγωγής αναγνωρίζονται ως περιτυλίγματα', () => {
  assert.equal(groups.isWrapperFolderName('Αρχεία πρόσκλησης'), true);
  assert.equal(groups.isWrapperFolderName('Επισυναπτόμενα Αρχεία Υποβολής'), true);
  assert.equal(groups.isWrapperFolderName('Δικαιολογητικά'), false);
});

test('τα αρχεία ωρίμανσης γίνονται μία ομάδα με σαφή τίτλο και χωρίς κενές υποομάδες', () => {
  const one = groups.buildOrimanthiLinkedGroup([{
    fileName: 'τοπογραφικο.pdf',
    categoryLabel: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
    subtitle: 'ΤΟΠΟΓΡΑΦΙΚΑ',
    sourceProposalId: 'p1',
    sourceProposalTitle: 'Οδός Αρχανών',
  }]);
  assert.equal(one.title, 'Αρχεία από την ωρίμανση');
  assert.equal(one.subgroups.length, 1);
  assert.equal(one.subgroups[0].title, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ');
  assert.equal(one.subgroups[0].subgroups[0].title, 'ΤΟΠΟΓΡΑΦΙΚΑ');
  assert.deepEqual(
    groups.orimanthiExportDirSegments(one.subgroups[0].subgroups[0].files[0], one.subgroups[0].subgroups[0].files),
    ['Αρχεία από την ωρίμανση', 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ', 'ΤΟΠΟΓΡΑΦΙΚΑ']
  );

  const blankSpec = groups.buildOrimanthiLinkedGroup([{
    fileName: 'α.pdf',
    categoryLabel: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
    subtitle: '—',
    sourceProposalId: 'p1',
  }]);
  assert.equal(blankSpec.subgroups[0].files[0].fileName, 'α.pdf');
  assert.equal(blankSpec.subgroups[0].subgroups.length, 0);
  assert.deepEqual(
    groups.orimanthiExportDirSegments(blankSpec.subgroups[0].files[0], blankSpec.subgroups[0].files),
    ['Αρχεία από την ωρίμανση', 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ']
  );

  const two = groups.buildOrimanthiLinkedGroup([
    { fileName: 'α.pdf', categoryLabel: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ', subtitle: 'ΤΟΠΟΓΡΑΦΙΚΑ', sourceProposalId: 'p1', sourceProposalTitle: 'Οδός' },
    { fileName: 'β.pdf', categoryLabel: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ', subtitle: 'ΠΕΡΙΒΑΛΛΟΝ', sourceProposalId: 'p2', sourceProposalTitle: 'Ύδρευση' },
  ]);
  assert.equal(two.subgroups.map((g) => g.title).join('|'), 'Οδός|Ύδρευση');
  assert.deepEqual(
    groups.orimanthiExportDirSegments(two.subgroups[1].subgroups[0].subgroups[0].files[0], [
      two.subgroups[0].subgroups[0].subgroups[0].files[0],
      two.subgroups[1].subgroups[0].subgroups[0].files[0],
    ]),
    ['Αρχεία από την ωρίμανση', 'Ύδρευση', 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ', 'ΠΕΡΙΒΑΛΛΟΝ']
  );
  assert.equal(groups.buildOrimanthiLinkedGroup([]), null);
});

test('δεν επιτρέπεται ίδιο όνομα ομάδας ούτε το όνομα της ωρίμανσης', () => {
  const existing = [{ id: 'g1', title: 'Δικαιολογητικά', files: [], subgroups: [] }];
  assert.equal(groups.canUseGroupTitle(existing, 'Δικαιολογητικά', null).ok, false);
  assert.equal(groups.canUseGroupTitle(existing, 'Τεχνικά', null).ok, true);
  assert.equal(groups.canUseGroupTitle(existing, 'Αρχεία από την ωρίμανση', null).ok, false);
  const withSub = [{
    id: 'g1',
    title: 'Δικαιολογητικά',
    files: [],
    subgroups: [{ id: 'g2', title: 'Φορολογικά', files: [], subgroups: [] }],
  }];
  assert.equal(groups.canUseGroupTitle(withSub, 'Φορολογικά', 'g1').ok, false);
  assert.equal(groups.canUseGroupTitle(withSub, 'Ασφαλιστικά', 'g1').ok, true);
  assert.equal(groups.canUseGroupTitle(withSub, 'Αρχεία από την ωρίμανση', 'g1').ok, true);
});
