import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ops = require('../../public/prosklisiFileOps.js');

function makeProsklisiDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psk-files-'));
  const main = path.join(dir, ops.FILES_ROOT_NAME);
  fs.mkdirSync(main, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({
    title: 'Δοκιμή',
    prosklisiFiles: [],
    fileGroups: [],
  }));
  return dir;
}

test('διαγραφή ομάδας με υποομάδα δεν αφήνει άδειο φάκελο στη λίστα', () => {
  const dir = makeProsklisiDir();
  const src = path.join(dir, 'src.pdf');
  fs.writeFileSync(src, 'x');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [{ fileName: 'src.pdf', originalName: 'src.pdf', targetFolder: 'attachments' }],
    fileGroups: [],
  });
  fs.mkdirSync(path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής'), { recursive: true });
  fs.renameSync(src, path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής', 'src.pdf'));

  const parent = ops.organizeFiles(dir, { action: 'new', title: 'Δικαιολογητικά', fileNames: [] });
  assert.equal(parent.ok, true);
  const sub = ops.organizeFiles(dir, {
    action: 'subgroup',
    parentGroupId: parent.groupId,
    title: 'Φορολογικά',
    fileNames: ['src.pdf'],
  });
  assert.equal(sub.ok, true);
  const nested = path.join(dir, ops.FILES_ROOT_NAME, 'Δικαιολογητικά', 'Φορολογικά', 'src.pdf');
  assert.equal(fs.existsSync(nested), true);

  const deleted = ops.deleteGroup(dir, parent.groupId);
  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(path.join(dir, ops.FILES_ROOT_NAME, 'Δικαιολογητικά')), false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.folders.main.some((f) => f.folderName === 'Δικαιολογητικά'), false);
  assert.equal(listed.fileGroups.length, 0);
  assert.equal(listed.files.attachments.some((f) => f.fileName === 'src.pdf'), true);
});

test('η δήλωση υποβολής αποθηκεύεται και δεν αλλάζει την κατάσταση της πρόσκλησης', () => {
  const dir = makeProsklisiDir();
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    status: 'Υπό Υποβολή',
    prosklisiFiles: [{ fileName: 'ΠΡΟΣΚΛΗΣΗ.pdf', originalName: 'ΠΡΟΣΚΛΗΣΗ.pdf' }],
    fileGroups: [{ id: 'g1', title: 'Συνοδευτικά', files: [], subgroups: [] }],
    submissions: [],
  });
  const ensured = ops.ensureSubmissionRecord(dir, {
    newId: 's1',
    orimanthiProposalId: 'p1',
    title: 'Κτίριο',
  });
  assert.equal(ensured.ok, true);
  assert.equal(ensured.status, 'Υπό Υποβολή');
  const marked = ops.setSubmissionDeclared(dir, 's1', true, '2026-11-13');
  assert.equal(marked.ok, true);
  assert.equal(marked.submission.submittedOn, '2026-11-13');
  assert.equal(marked.status, 'Υπό Υποβολή');

  const grouped = ops.organizeFiles(dir, {
    action: 'new',
    title: 'Συνοδευτικά',
    submissionId: 's1',
    fileNames: [],
  });
  assert.equal(grouped.ok, true);
  const listed = ops.listForUi(dir);
  assert.equal(listed.submissions[0].submitted, true);
  assert.equal(listed.prosklisiStatus, 'Υπό Υποβολή');
  const owned = listed.fileGroups.find((group) => group.submissionId === 's1');
  assert.equal(owned.title, 'Συνοδευτικά');
  assert.equal(listed.files.attachments.some((file) => file.fileName === 'ΠΡΟΣΚΛΗΣΗ.pdf' && !file.shelf), true);

  const kept = ops.materializeFormGroups(
    dir,
    [{ id: owned.id, title: 'Συνοδευτικά', files: [], subgroups: [] }],
    listed.fileGroups
  );
  assert.equal(kept.find((group) => group.id === owned.id).submissionId, 's1');
});

test('διαγραφή φακέλου πράξης αφήνει τα αρχεία στην ίδια πράξη', () => {
  const dir = makeProsklisiDir();
  const filePath = path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής', 'α.pdf');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'x');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    status: 'Υπό Ωρίμανση',
    prosklisiFiles: [],
    submissions: [{ id: 's1', title: 'Κτίριο', orimanthiProposalId: 'p1', submitted: false, submittedOn: '' }],
    fileGroups: [{
      id: 'g1',
      title: 'Τεύχη',
      submissionId: 's1',
      files: [{ fileName: 'α.pdf', originalName: 'α.pdf' }],
      subgroups: [],
    }],
  });
  fs.mkdirSync(path.join(dir, ops.FILES_ROOT_NAME, 'Τεύχη'), { recursive: true });
  fs.renameSync(filePath, path.join(dir, ops.FILES_ROOT_NAME, 'Τεύχη', 'α.pdf'));
  const deleted = ops.deleteGroup(dir, 'g1');
  assert.equal(deleted.ok, true);
  const listed = ops.listForUi(dir);
  const row = listed.files.attachments.find((file) => file.fileName === 'α.pdf');
  assert.equal(row.shelf, 's1');
  assert.equal(listed.prosklisiStatus, 'Υπό Ωρίμανση');
});
