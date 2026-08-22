import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const files = require('../../app/core/subprojectFiles.js');

const seed = [
  { id: 'grp-contract', title: 'Σύμβαση', files: [{ name: 'σύμβαση.pdf' }] },
];

test('νέα ομάδα / υπάρχουσα / χωρίς ομάδα στη φόρμα', () => {
  const created = files.applyFormFileGrouping(seed, [], { action: 'new', title: 'Σχέδια' }, [{ name: 'α.pdf' }], 'g2');
  assert.equal(created.fileGroups.length, 2);
  assert.equal(created.fileGroups[1].title, 'Σχέδια');
  assert.equal(created.ungroupedFiles.length, 0);

  const added = files.applyFormFileGrouping(seed, [], { action: 'existing', groupId: 'grp-contract' }, [{ name: 'β.pdf' }], 'x');
  assert.equal(added.fileGroups[0].files.length, 2);
  assert.equal(added.ungroupedFiles.length, 0);

  const loose = files.applyFormFileGrouping(seed, [], false, [{ name: 'γ.pdf' }], 'x');
  assert.equal(loose.fileGroups.length, 1);
  assert.equal(loose.ungroupedFiles[0].name, 'γ.pdf');

  const formCancel = files.applyFormFileGrouping(seed, [], null, [{ name: 'δ.pdf' }], 'x');
  assert.equal(formCancel.ungroupedFiles.length, 0);
  assert.equal(formCancel.fileGroups.length, 1);
});

test('ακύρωση ανεβάσματος από τη λίστα αρχείων δεν προσθέτει', () => {
  assert.equal(files.isUploadGroupingCancelled(null), true);
  assert.equal(files.isUploadGroupingCancelled(false), false);
  assert.equal(files.isNewGroupTitleValid('  '), false);
  assert.equal(files.isNewGroupTitleValid('Σχέδια'), true);
});

test('φάκελος: κενό όνομα γίνεται Φάκελος· αφαίρεση τελευταίου σβήνει την ομάδα', () => {
  assert.equal(files.folderGroupTitle('  '), 'Φάκελος');
  assert.equal(files.folderGroupTitle('Προσφορές'), 'Προσφορές');
  const grouped = files.applyFolderAsNewGroup([], '  ', [{ name: 'α.pdf' }], 'g1');
  assert.equal(grouped[0].title, 'Φάκελος');
  const gone = files.removeFileFromGroup(seed, 'grp-contract', 0);
  assert.equal(gone.length, 0);
});

test('προσθήκη αρχείων: όχι απλός χρήστης· κλειδωμένο μπλοκάρει', () => {
  assert.equal(files.showSubprojectFileUpload('ADMIN'), true);
  assert.equal(files.showSubprojectFileUpload('ENGINEER'), true);
  assert.equal(files.showSubprojectFileUpload('USER'), false);
  assert.equal(files.isSubprojectFileUploadBlocked({ isLocked: true }, 'ADMIN'), true);
  assert.equal(files.isSubprojectFileUploadBlocked({ isLocked: false }, 'ADMIN'), false);
  assert.equal(files.isSubprojectFileUploadBlocked({}, 'USER'), true);
});
