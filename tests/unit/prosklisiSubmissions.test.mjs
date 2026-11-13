import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const shelf = require('../../app/core/prosklisiSubmissions.js');

test('τα υπάρχοντα αρχεία δεν μπαίνουν μόνα τους σε πράξη', () => {
  const loose = [{ fileName: 'ΠΡΟΣΚΛΗΣΗ.pdf' }, { fileName: 'σημειωση.pdf', shelf: 'unassigned' }];
  const groups = [{ id: 'g1', title: 'Π178-41 Συνοδευτικά', files: [{ fileName: 'α.pdf' }], subgroups: [] }];
  const view = shelf.buildShelf({
    linkedProposals: [{ id: 'p1', title: 'Ολοκλήρωση υποδομών' }],
    linkedFiles: [],
    submissions: [],
    fileGroups: groups,
    looseFiles: loose,
  });
  assert.equal(view.cards.length, 1);
  assert.equal(view.cards[0].title, 'Ολοκλήρωση υποδομών');
  assert.equal(view.cards[0].files.length, 0);
  assert.equal(view.cards[0].groups.length, 0);
  assert.equal(view.cards[0].submitted, false);
  assert.deepEqual(view.invitationFiles.map((file) => file.fileName), ['ΠΡΟΣΚΛΗΣΗ.pdf', 'σημειωση.pdf']);
  assert.equal(view.invitationGroups[0].title, 'Π178-41 Συνοδευτικά');
  assert.equal(view.unassignedGroups.length, 0);
  assert.equal(view.submittedCount, 0);
  assert.equal(view.totalCount, 1);
  assert.equal(loose[0].shelf, undefined);
  assert.equal(groups[0].submissionId, undefined);
});

test('κάθε δεμένη ωρίμανση έχει κάρτα ακόμη και χωρίς αρχεία, και τα αρχεία δεν ανακατεύονται', () => {
  const view = shelf.buildShelf({
    linkedProposals: [
      { id: 'p1', title: 'Κτίριο' },
      { id: 'p2', title: 'Πλατεία' },
    ],
    linkedFiles: [
      { fileName: 'αδεια.pdf', sourceProposalId: 'p1', sourceProposalTitle: 'Κτίριο' },
      { fileName: 'μελετη.pdf', sourceProposalId: 'p2', sourceProposalTitle: 'Πλατεία' },
    ],
    submissions: [
      { id: 's1', title: 'παλιός', orimanthiProposalId: 'p1', submitted: false },
    ],
    fileGroups: [
      { id: 'g1', title: 'Τεύχη', submissionId: 's1', files: [{ fileName: 'τευχή.pdf' }], subgroups: [] },
      { id: 'g2', title: 'Άλλο', submissionId: 's2', files: [], subgroups: [] },
    ],
    looseFiles: [
      { fileName: 'δελτιο.pdf', shelf: 's1' },
    ],
  });
  assert.deepEqual(view.cards.map((card) => card.title), ['Κτίριο', 'Πλατεία']);
  assert.equal(view.cards[0].orimanthiFiles.length, 1);
  assert.equal(view.cards[0].groups[0].title, 'Τεύχη');
  assert.equal(view.cards[0].files[0].fileName, 'δελτιο.pdf');
  assert.equal(view.cards[1].orimanthiFiles[0].fileName, 'μελετη.pdf');
  assert.equal(view.cards[1].groups.length, 0);
  assert.equal(view.cards[1].persisted, false);
  assert.equal(view.unassignedGroups[0].id, 'g2');
  assert.equal(view.singleCardStartsOpen, false);
});

test('ωρίμανση που φαίνεται μόνο από αρχεία παίρνει κάρτα, χωρίς δεύτερη για την ίδια πράξη', () => {
  const view = shelf.buildShelf({
    linkedProposals: [{ id: 'p1', title: 'Κτίριο' }],
    linkedFiles: [
      { fileName: 'α.pdf', sourceProposalId: 'p1', sourceProposalTitle: 'Κτίριο' },
      { fileName: 'β.pdf', sourceProposalId: 'p9', sourceProposalTitle: 'Οδός' },
    ],
    submissions: [],
    fileGroups: [],
    looseFiles: [],
  });
  assert.equal(view.cards.length, 2);
  assert.equal(view.cards[0].orimanthiFiles.length, 1);
  assert.equal(view.cards[1].title, 'Οδός');
  assert.equal(view.cards[1].orimanthiFiles[0].fileName, 'β.pdf');
});

test('η δήλωση υποβολής κρατά ημερομηνία και αναιρείται, χωρίς να απαιτεί αρχεία', () => {
  const ensured = shelf.ensureSubmission([], { orimanthiProposalId: 'p1', title: 'Κτίριο' }, 's1');
  assert.equal(ensured.created, true);
  const again = shelf.ensureSubmission(ensured.submissions, { orimanthiProposalId: 'p1', title: 'Κτίριο' }, 's2');
  assert.equal(again.created, false);
  assert.equal(again.submission.id, 's1');

  const marked = shelf.setSubmitted(again.submissions, 's1', {
    submitted: true,
    submittedOn: '',
    today: '2026-11-13',
  });
  assert.equal(marked.ok, true);
  assert.equal(marked.submission.submitted, true);
  assert.equal(marked.submission.submittedOn, '2026-11-13');
  assert.equal(shelf.statusLabel(marked.submission), 'Υποβλήθηκε 13/11/2026');
  assert.equal(Object.keys(marked.submission).includes('status'), false);

  const bad = shelf.setSubmitted(marked.submissions, 's1', { submitted: true, submittedOn: '2026-02-31' });
  assert.equal(bad.ok, false);

  const cleared = shelf.setSubmitted(marked.submissions, 's1', { submitted: false });
  assert.equal(cleared.submission.submitted, false);
  assert.equal(cleared.submission.submittedOn, '');
  assert.equal(shelf.statusLabel(cleared.submission), 'Εκκρεμεί η υποβολή');

  const view = shelf.buildShelf({
    linkedProposals: [{ id: 'p1', title: 'Κτίριο' }, { id: 'p2', title: 'Πλατεία' }],
    submissions: marked.submissions,
    fileGroups: [],
    looseFiles: [],
    linkedFiles: [],
  });
  assert.equal(view.submittedCount, 1);
  assert.equal(view.totalCount, 2);
  assert.equal(shelf.summaryLabel(view.submittedCount, view.totalCount), 'Υποβλήθηκαν 1 από 2');
});

test('διπλή καταχώριση της ίδιας ωρίμανσης μένει μία κάρτα και τα αρχεία ακολουθούν', () => {
  const view = shelf.buildShelf({
    linkedProposals: [{ id: 'p1', title: 'Κτίριο' }],
    submissions: [
      { id: 'a', orimanthiProposalId: 'p1', submitted: false, title: '' },
      { id: 'b', orimanthiProposalId: 'p1', submitted: true, submittedOn: '2026-03-01', title: 'Κτίριο' },
    ],
    fileGroups: [{ id: 'g1', title: 'Τεύχη', submissionId: 'b', files: [], subgroups: [] }],
    looseFiles: [],
    linkedFiles: [],
  });
  assert.equal(view.cards.length, 1);
  assert.equal(view.cards[0].submissionId, 'a');
  assert.equal(view.cards[0].submitted, true);
  assert.equal(view.cards[0].submittedOn, '2026-03-01');
  assert.equal(view.cards[0].groups[0].id, 'g1');
  assert.equal(view.idRemap.b, 'a');
});

test('η μεταφορά φακέλου και αρχείου πιάνει μόνο την κορυφή και το ζητούμενο αρχείο', () => {
  const groups = [{
    id: 'g1',
    title: 'Συνοδευτικά',
    files: [],
    subgroups: [{ id: 'g2', title: 'Μέσα', files: [], subgroups: [] }],
  }];
  const moved = shelf.assignGroup(groups, 'g1', 's1');
  assert.equal(moved.ok, true);
  assert.equal(moved.fileGroups[0].submissionId, 's1');
  assert.equal(groups[0].submissionId, undefined);
  const inner = shelf.assignGroup(groups, 'g2', 's1');
  assert.equal(inner.ok, false);

  const files = [{ fileName: 'ΠΡΟΣΚΛΗΣΗ.pdf' }, { fileName: 'σημειωση.pdf', shelf: 'unassigned' }];
  const placed = shelf.placeLooseFile(files, 'σημειωση.pdf', 's1');
  assert.equal(placed.looseFiles[1].shelf, 's1');
  assert.equal(files[1].shelf, 'unassigned');
  const back = shelf.placeLooseFile(placed.looseFiles, 'σημειωση.pdf', 'invitation');
  assert.equal(back.looseFiles[1].shelf, undefined);
});

test('φάκελος πράξης και φάκελος πρόσκλησης δεν προσφέρονται στο ίδιο σημείο', () => {
  const groups = [
    { id: 'inv', title: 'Π178-41', submissionId: '', files: [{ fileName: 'α.pdf' }], subgroups: [] },
    { id: 'act', title: 'Τεύχη', submissionId: 's1', files: [{ fileName: 'β.pdf' }], subgroups: [
      { id: 'inner', title: 'Μέσα', files: [{ fileName: 'γ.pdf' }], subgroups: [] },
    ] },
  ];
  const loose = [{ fileName: 'δελτιο.pdf', shelf: 's1' }, { fileName: 'όροι.pdf' }];
  assert.deepEqual(shelf.groupsOwnedBy(groups, '').map((group) => group.id), ['inv']);
  assert.deepEqual(shelf.groupsOwnedBy(groups, 's1').map((group) => group.id), ['act']);
  assert.equal(shelf.ownerOfNamedFile(loose, groups, 'α.pdf'), '');
  assert.equal(shelf.ownerOfNamedFile(loose, groups, 'γ.pdf'), 's1');
  assert.equal(shelf.ownerOfNamedFile(loose, groups, 'δελτιο.pdf'), 's1');
  assert.equal(shelf.ownerOfNamedFile(loose, groups, 'όροι.pdf'), '');
  const same = shelf.sharedOwner(loose, groups, ['β.pdf', 'δελτιο.pdf']);
  assert.equal(same.ok, true);
  assert.equal(same.ownerId, 's1');
  const mixed = shelf.sharedOwner(loose, groups, ['α.pdf', 'β.pdf']);
  assert.equal(mixed.ok, false);
});
