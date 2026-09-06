import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const files = require('../../app/core/managedFiles.js');

test('μετονομασία κρατά την κατάληξη και κόβει διαδρομές', () => {
  const ok = files.buildRenamedFileName('σύμβαση.pdf', 'Νέα σύμβαση');
  assert.equal(ok.ok, true);
  assert.equal(ok.newName, 'Νέα σύμβαση.pdf');

  const withExt = files.buildRenamedFileName('α.pdf', 'β.pdf');
  assert.equal(withExt.newName, 'β.pdf');

  const bad = files.buildRenamedFileName('α.pdf', '../secret');
  assert.equal(bad.ok, false);

  const empty = files.buildRenamedFileName('α.pdf', '   ');
  assert.equal(empty.ok, false);
});

test('διπλό όνομα: αντικατάσταση ή κράτα και τα δύο', () => {
  const existing = ['σύμβαση.pdf', 'σχέδιο.pdf'];
  const incoming = ['σύμβαση.pdf', 'παράρτημα.pdf'];

  const conflicts = files.findNameConflicts(incoming, existing);
  assert.deepEqual(conflicts.conflicts, ['σύμβαση.pdf']);
  assert.deepEqual(conflicts.unique, ['παράρτημα.pdf']);

  const keep = files.applyConflictPolicy(incoming, existing, 'keep-both');
  assert.equal(keep[0].dest, 'σύμβαση (1).pdf');
  assert.equal(keep[0].replace, false);
  assert.equal(keep[1].dest, 'παράρτημα.pdf');

  const replace = files.applyConflictPolicy(incoming, existing, 'replace');
  assert.equal(replace[0].dest, 'σύμβαση.pdf');
  assert.equal(replace[0].replace, true);
  assert.equal(replace[1].replace, false);
});

test('δύο εισερχόμενα με το ίδιο όνομα παίρνουν ξεχωριστό προορισμό', () => {
  const incoming = ['σύμβαση.pdf', 'σύμβαση.pdf'];
  const keep = files.applyConflictPolicy(incoming, [], 'keep-both');
  assert.equal(keep.length, 2);
  assert.equal(keep[0].dest, 'σύμβαση.pdf');
  assert.equal(keep[1].dest, 'σύμβαση (1).pdf');

  const withExisting = files.applyConflictPolicy(incoming, ['σύμβαση.pdf'], 'keep-both');
  assert.equal(withExisting[0].dest, 'σύμβαση (1).pdf');
  assert.equal(withExisting[1].dest, 'σύμβαση (2).pdf');
});

test('ίδιο όνομα με διαφορετικά πεζά/κεφαλαία μετράει ως διπλότυπο', () => {
  const conflicts = files.findNameConflicts(['Σύμβαση.pdf', 'Σύμβαση.pdf'], ['σύμβαση.pdf']);
  assert.deepEqual(conflicts.conflicts, ['Σύμβαση.pdf']);

  const keep = files.applyConflictPolicy(['Σύμβαση.pdf'], ['σύμβαση.pdf'], 'keep-both');
  assert.equal(keep[0].dest, 'Σύμβαση (1).pdf');
  assert.equal(keep[0].replace, false);

  const replace = files.applyConflictPolicy(['Σύμβαση.pdf'], ['σύμβαση.pdf'], 'replace');
  assert.equal(replace[0].dest, 'σύμβαση.pdf');
  assert.equal(replace[0].replace, true);

  const latin = files.findNameConflicts(['CONTRACT.PDF'], ['contract.pdf']);
  assert.deepEqual(latin.conflicts, ['CONTRACT.PDF']);
});

test('επόμενο ελεύθερο όνομα παραλείπει όσα υπάρχουν ήδη', () => {
  const used = new Set(['α.pdf', 'α (1).pdf']);
  assert.equal(files.nextAvailableName('α.pdf', used), 'α (2).pdf');
});

test('μετονομασία ενημερώνει λίστα και ομάδες χωρίς να ανοίγει φάκελο', () => {
  const data = {
    files: ['σύμβαση.pdf', 'άλλο.pdf'],
    fileGroups: [{ id: 'g1', title: 'Σύμβαση', files: [{ name: 'σύμβαση.pdf', path: 'X/σύμβαση.pdf' }] }],
  };
  files.renameFileInSubprojectData(data, 'σύμβαση.pdf', 'νέα.pdf');
  assert.deepEqual(data.files, ['νέα.pdf', 'άλλο.pdf']);
  assert.equal(data.fileGroups[0].files[0].name, 'νέα.pdf');
  assert.match(data.fileGroups[0].files[0].path, /νέα\.pdf$/);
});
