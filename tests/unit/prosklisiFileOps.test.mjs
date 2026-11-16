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
  assert.equal(fs.existsSync(nested), false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.folders.main.some((f) => f.folderName === 'Δικαιολογητικά'), false);
  assert.equal(listed.fileGroups.length, 0);
  assert.equal(listed.files.attachments.some((f) => f.fileName === 'src.pdf'), false);
  assert.equal(listed.files.main.some((f) => f.fileName === 'src.pdf'), false);
});

test('η δήλωση υποβολής αποθηκεύεται και δεν αλλάζει την κατάσταση της πρόσκλησης', () => {
  const dir = makeProsklisiDir();
  const looseDir = path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής');
  fs.mkdirSync(looseDir, { recursive: true });
  fs.writeFileSync(path.join(looseDir, 'ΠΡΟΣΚΛΗΣΗ.pdf'), 'x');
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

test('διαγραφή φακέλου πράξης σβήνει και τα αρχεία του', () => {
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
  assert.equal(fs.existsSync(path.join(dir, ops.FILES_ROOT_NAME, 'Τεύχη', 'α.pdf')), false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.files.attachments.some((file) => file.fileName === 'α.pdf'), false);
  assert.equal(listed.fileGroups.length, 0);
  assert.equal(listed.prosklisiStatus, 'Υπό Ωρίμανση');
});

test('εγγραφή χωρίς αποθηκευμένο αρχείο φεύγει μόνη της και η διαγραφή της δεν αποτυγχάνει', () => {
  const dir = makeProsklisiDir();
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [{ fileName: 'ορφανό.pdf', originalName: 'ορφανό.pdf', targetFolder: 'attachments' }],
    fileGroups: [{
      id: 'g1',
      title: 'Κενό πλέον',
      files: [{ fileName: 'έλειπε.pdf', originalName: 'έλειπε.pdf' }],
      subgroups: [],
    }],
  });
  const deleted = ops.deleteFiles(dir, ['ορφανό.pdf']);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deleted, 1);
  const listed = ops.listForUi(dir);
  assert.equal(listed.files.attachments.some((file) => file.fileName === 'ορφανό.pdf'), false);
  assert.equal(listed.fileGroups[0].files.length, 0);
});

test('διαγραφή φυσικού φακέλου σβήνει και την εγγραφή του αρχείου', () => {
  const dir = makeProsklisiDir();
  const folder = path.join(dir, ops.FILES_ROOT_NAME, 'Φάκελος μελετών');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'μελέτη.pdf'), 'x');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [{ fileName: 'μελέτη.pdf', originalName: 'μελέτη.pdf', targetFolder: 'main' }],
    fileGroups: [],
  });
  const deleted = ops.deletePhysicalFolder(dir, 'Φάκελος μελετών', 'main');
  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(folder), false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.files.main.some((file) => file.fileName === 'μελέτη.pdf'), false);
  assert.equal(listed.files.attachments.some((file) => file.fileName === 'μελέτη.pdf'), false);
});

test('διαγραφή φακέλου με ίδιο όνομα αρχείου δεν σβήνει το αρχείο μιας πράξης', () => {
  const dir = makeProsklisiDir();
  const looseFolder = path.join(dir, ops.FILES_ROOT_NAME, 'Συνοδευτικά');
  const groupFolder = path.join(dir, ops.FILES_ROOT_NAME, 'Τεύχη');
  fs.mkdirSync(looseFolder, { recursive: true });
  fs.mkdirSync(groupFolder, { recursive: true });
  fs.writeFileSync(path.join(looseFolder, 'α.pdf'), 'loose');
  fs.writeFileSync(path.join(groupFolder, 'α.pdf'), 'group');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [],
    fileGroups: [{
      id: 'g1',
      title: 'Τεύχη',
      submissionId: 's1',
      files: [{ fileName: 'α.pdf', originalName: 'α.pdf' }],
      subgroups: [],
    }],
  });
  const deleted = ops.deletePhysicalFolder(dir, 'Συνοδευτικά', 'main');
  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(looseFolder), false);
  assert.equal(fs.existsSync(path.join(groupFolder, 'α.pdf')), true);
  const listed = ops.listForUi(dir);
  const group = listed.fileGroups.find((item) => item.id === 'g1');
  assert.equal(group.files.some((file) => file.fileName === 'α.pdf'), true);
});

test('προσθήκη φακέλου κρατά υποφακέλους και αρχεία με το ίδιο όνομα', () => {
  const dir = makeProsklisiDir();
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'psk-tree-'));
  fs.mkdirSync(path.join(src, 'Άδειες', 'Τοπογραφικά'), { recursive: true });
  fs.mkdirSync(path.join(src, 'Άδειες', 'Κενός'), { recursive: true });
  fs.writeFileSync(path.join(src, 'εξώφυλλο.pdf'), 'root');
  fs.writeFileSync(path.join(src, 'Άδειες', 'α.pdf'), 'mid');
  fs.writeFileSync(path.join(src, 'Άδειες', 'Τοπογραφικά', 'α.pdf'), 'deep');
  const imported = ops.importFolderTree(dir, {
    rootTitle: 'Πακέτο μελέτης',
    submissionId: 's1',
    directories: ['Άδειες', 'Άδειες/Τοπογραφικά', 'Άδειες/Κενός'],
    files: [
      { filePath: path.join(src, 'εξώφυλλο.pdf'), fileName: 'εξώφυλλο.pdf', relativeDir: '' },
      { filePath: path.join(src, 'Άδειες', 'α.pdf'), fileName: 'α.pdf', relativeDir: 'Άδειες' },
      { filePath: path.join(src, 'Άδειες', 'Τοπογραφικά', 'α.pdf'), fileName: 'α.pdf', relativeDir: 'Άδειες/Τοπογραφικά' },
    ],
  });
  assert.equal(imported.ok, true);
  assert.equal(imported.fileCount, 3);
  assert.equal(imported.folderCount, 3);
  const listed = ops.listForUi(dir);
  const root = listed.fileGroups.find((group) => group.title === 'Πακέτο μελέτης');
  assert.equal(root.submissionId, 's1');
  assert.equal(root.files.some((file) => file.fileName === 'εξώφυλλο.pdf'), true);
  const adeies = root.subgroups.find((group) => group.title === 'Άδειες');
  assert.equal(adeies.submissionId, undefined);
  assert.equal(adeies.files.length, 1);
  const topo = adeies.subgroups.find((group) => group.title === 'Τοπογραφικά');
  const empty = adeies.subgroups.find((group) => group.title === 'Κενός');
  assert.equal(empty.files.length, 0);
  assert.equal(topo.files.length, 1);
  assert.notEqual(adeies.files[0].fileName, topo.files[0].fileName);
  assert.equal(topo.files[0].originalName, 'α.pdf');
  assert.equal(
    fs.existsSync(path.join(dir, ops.FILES_ROOT_NAME, 'Πακέτο μελέτης', 'Άδειες', 'Τοπογραφικά', topo.files[0].fileName)),
    true
  );
  assert.equal(
    fs.existsSync(path.join(dir, ops.FILES_ROOT_NAME, 'Πακέτο μελέτης', 'Άδειες', 'Κενός')),
    true
  );
});

test('αρχείο σε βαθύ υποφάκελο μένει και σβήνεται κανονικά', () => {
  const dir = makeProsklisiDir();
  const src = path.join(dir, 'src-deep.pdf');
  fs.writeFileSync(src, 'deep');
  const parts = ['ε1', 'ε2', 'ε3', 'ε4', 'ε5', 'ε6', 'ε7', 'ε8', 'ε9'];
  const imported = ops.importFolderTree(dir, {
    rootTitle: 'Πακέτο',
    directories: parts.map((_, index) => parts.slice(0, index + 1).join('/')),
    files: [{ filePath: src, fileName: 'βαθύ.pdf', relativeDir: parts.join('/') }],
  });
  assert.equal(imported.ok, true);
  const listed = ops.listForUi(dir);
  let node = listed.fileGroups.find((group) => group.title === 'Πακέτο');
  parts.forEach((part) => {
    node = (node.subgroups || []).find((group) => group.title === part);
  });
  assert.equal(node.files.some((file) => file.fileName === 'βαθύ.pdf'), true);
  const stored = path.join(dir, ops.FILES_ROOT_NAME, 'Πακέτο', ...parts, 'βαθύ.pdf');
  assert.equal(fs.existsSync(stored), true);
  const deleted = ops.deleteFiles(dir, ['βαθύ.pdf']);
  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(stored), false);
});

test('διαγραφή φακέλου με ίδιο όνομα δεν σβήνει τον φάκελο της πράξης', () => {
  const dir = makeProsklisiDir();
  const firstSrc = path.join(dir, 'src-a.pdf');
  const secondSrc = path.join(dir, 'src-b.pdf');
  fs.writeFileSync(firstSrc, 'a');
  fs.writeFileSync(secondSrc, 'b');
  const first = ops.importFolderTree(dir, {
    rootTitle: 'Κοινό',
    files: [{ filePath: firstSrc, fileName: 'a.pdf', relativeDir: '' }],
  });
  const second = ops.importFolderTree(dir, {
    rootTitle: 'Κοινό',
    submissionId: 's1',
    directories: ['Εσω'],
    files: [{ filePath: secondSrc, fileName: 'b.pdf', relativeDir: 'Εσω' }],
  });
  assert.equal(second.ok, true);
  const stored = path.join(dir, ops.FILES_ROOT_NAME, 'Κοινό', 'Εσω', 'b.pdf');
  ops.deleteGroup(dir, first.groupId);
  const listed = ops.listForUi(dir);
  const survivor = listed.fileGroups.find((group) => group.submissionId === 's1');
  assert.equal(fs.existsSync(stored), true);
  assert.equal(survivor.subgroups[0].files.some((file) => file.fileName === 'b.pdf'), true);
});

test('φάκελος που υπάρχει ήδη δεν κρύβεται όταν προστεθεί άλλος με το ίδιο όνομα', () => {
  const dir = makeProsklisiDir();
  const looseDir = path.join(dir, ops.FILES_ROOT_NAME, 'Μελέτες');
  fs.mkdirSync(looseDir, { recursive: true });
  fs.writeFileSync(path.join(looseDir, 'μελέτη.pdf'), 'old');
  const src = path.join(dir, 'src-new.pdf');
  fs.writeFileSync(src, 'new');
  const imported = ops.importFolderTree(dir, {
    rootTitle: 'Μελέτες',
    files: [{ filePath: src, fileName: 'νέο.pdf', relativeDir: '' }],
  });
  assert.equal(imported.ok, false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.folders.main.some((folder) => folder.folderName === 'Μελέτες'), true);
  assert.equal(listed.fileGroups.length, 0);
  assert.equal(fs.existsSync(path.join(looseDir, 'μελέτη.pdf')), true);
  assert.equal(fs.existsSync(path.join(looseDir, 'νέο.pdf')), false);
});

test('η λήψη φακέλου κρατά τον φάκελο και τα αρχεία μέσα του', async () => {
  const dir = makeProsklisiDir();
  const folder = path.join(dir, ops.FILES_ROOT_NAME, 'Δικαιολογητικά');
  fs.mkdirSync(path.join(folder, 'Φορολογικά'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'α.pdf'), 'a');
  fs.writeFileSync(path.join(folder, 'Φορολογικά', 'β.pdf'), 'b');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [],
    fileGroups: [{
      id: 'g1',
      title: 'Δικαιολογητικά',
      files: [{ fileName: 'α.pdf', originalName: 'α.pdf' }],
      subgroups: [{
        id: 'g2',
        title: 'Φορολογικά',
        files: [{ fileName: 'β.pdf', originalName: 'β.pdf' }],
        subgroups: [],
      }],
    }],
  });
  const collected = ops.collectGroupZipEntries(dir, 'g1');
  assert.equal(collected.ok, true);
  const dest = path.join(dir, 'ληψη.zip');
  const written = await ops.writeZipEntries(dest, collected.entries);
  assert.equal(written.ok, true);
  const names = await new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(dest, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const found = [];
      zip.on('entry', (entry) => {
        found.push(entry.fileName);
        zip.readEntry();
      });
      zip.on('end', () => resolve(found));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
  assert.equal(names.some((name) => name.endsWith('α.pdf')), true);
  assert.equal(names.some((name) => name.includes('Φορολογικά') && name.endsWith('β.pdf')), true);
  assert.equal(fs.existsSync(path.join(folder, 'α.pdf')), true);
});
