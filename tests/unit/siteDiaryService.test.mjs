import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createSiteDiaryService, SITE_DIARY_DIR_NAME, PHOTOS_DIR_NAME } =
  require('../../public/siteDiaryService.js');

const SUB_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUB_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const AUTHOR = { username: 'nikolas', fullName: 'Νικόλας Κ.' };
const META = { projectId: 'p1', projectTitle: 'ΕΡΓΟ Α', subprojectTitle: 'ΥΠΟΕΡΓΟ 1' };

function makeService() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imerologio-'));
  return { dataDir, svc: createSiteDiaryService({ dataDir }) };
}

function validDraft(overrides = {}) {
  return {
    visitDate: '2020-05-04',
    visitTime: '09:30',
    progress: 'normal',
    notes: 'Σκυροδέτηση πλάκας ισογείου',
    contractorOrder: '',
    ...overrides,
  };
}

function diaryDir(dataDir, subprojectId) {
  return path.join(dataDir, SITE_DIARY_DIR_NAME, subprojectId);
}

function readDiary(dataDir, subprojectId) {
  return JSON.parse(fs.readFileSync(path.join(diaryDir(dataDir, subprojectId), 'data.json'), 'utf8'));
}

function makeSourceFile(name, contents = 'δοκιμαστικό περιεχόμενο') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imerologio-src-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
}

test('καταχώριση επίσκεψης γράφει στον φάκελο του υποέργου', async () => {
  const { dataDir, svc } = makeService();
  const res = await svc.addEntry({
    subprojectId: SUB_A,
    subprojectMeta: META,
    draft: validDraft(),
    author: AUTHOR,
  });

  assert.equal(res.success, true);
  assert.match(res.entry.id, /^[0-9a-f-]{36}$/i);
  assert.equal(res.entry.authorUsername, 'nikolas');
  assert.equal(res.entry.authorFullName, 'Νικόλας Κ.');
  assert.equal(res.entry.visitDate, '2020-05-04');
  assert.deepEqual(res.entry.photos, []);

  const disk = readDiary(dataDir, SUB_A);
  assert.equal(disk.entries.length, 1);
  assert.equal(disk.subprojectTitle, 'ΥΠΟΕΡΓΟ 1');
  assert.equal(disk.projectTitle, 'ΕΡΓΟ Α');
});

test('άκυρη επίσκεψη δεν αποθηκεύεται', async () => {
  const { dataDir, svc } = makeService();

  const noNotes = await svc.addEntry({
    subprojectId: SUB_A,
    draft: validDraft({ notes: '   ' }),
    author: AUTHOR,
  });
  assert.equal(noNotes.success, false);
  assert.equal(noNotes.field, 'notes');

  const future = await svc.addEntry({
    subprojectId: SUB_A,
    draft: validDraft({ visitDate: '2999-01-01' }),
    author: AUTHOR,
  });
  assert.equal(future.success, false);
  assert.equal(future.field, 'visitDate');

  assert.equal(fs.existsSync(diaryDir(dataDir, SUB_A)), false);
});

test('πολλές επισκέψεις την ίδια ημέρα επιτρέπονται', async () => {
  const { svc } = makeService();
  await svc.addEntry({ subprojectId: SUB_A, draft: validDraft({ visitTime: '08:00' }), author: AUTHOR });
  const second = await svc.addEntry({
    subprojectId: SUB_A,
    draft: validDraft({ visitTime: '16:00', notes: 'Δεύτερη επίσκεψη' }),
    author: AUTHOR,
  });
  assert.equal(second.success, true);
  assert.equal(second.diary.entries.length, 2);
});

test('αλλαγή επίσκεψης κρατά τον συντάκτη και την ώρα δημιουργίας', async () => {
  const { svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });

  const updated = await svc.updateEntry({
    subprojectId: SUB_A,
    entryId: created.entry.id,
    draft: validDraft({ notes: 'Διορθωμένη περιγραφή', progress: 'delay' }),
  });

  assert.equal(updated.success, true);
  assert.equal(updated.entry.notes, 'Διορθωμένη περιγραφή');
  assert.equal(updated.entry.progress, 'delay');
  assert.equal(updated.entry.authorUsername, 'nikolas');
  assert.equal(updated.entry.createdAt, created.entry.createdAt);
  assert.equal(updated.previous.notes, 'Σκυροδέτηση πλάκας ισογείου');
});

test('αλλαγή ανύπαρκτης επίσκεψης δεν πειράζει το ημερολόγιο', async () => {
  const { svc } = makeService();
  await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const missing = await svc.updateEntry({
    subprojectId: SUB_A,
    entryId: '11111111-1111-4111-8111-111111111111',
    draft: validDraft(),
  });
  assert.equal(missing.success, false);
  assert.match(missing.error, /δεν βρέθηκε/);
});

test('φωτογραφίες μπαίνουν σε δικό τους φάκελο ανά επίσκεψη', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const entryId = created.entry.id;

  const res = await svc.addEntryPhotos({
    subprojectId: SUB_A,
    entryId,
    files: [makeSourceFile('οψη.jpg'), makeSourceFile('σημειωσεις.txt')],
  });

  assert.equal(res.success, true);
  assert.equal(res.photos.length, 1, 'μόνο η εικόνα περνά');
  assert.equal(res.skipped, 1, 'το μη-εικονικό αρχείο παραλείπεται');
  assert.equal(res.entry.photos.length, 1);
  assert.equal(res.entry.photos[0].originalName, 'οψη.jpg');

  const photosDir = path.join(diaryDir(dataDir, SUB_A), PHOTOS_DIR_NAME, entryId);
  assert.equal(fs.readdirSync(photosDir).length, 1);

  // Ο φάκελος των φωτογραφιών είναι χωριστός από τα «Αρχεία Υποέργου».
  assert.equal(fs.existsSync(path.join(dataDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ')), false);
});

test('οι φωτογραφίες φτάνουν στην οθόνη ως εικόνες, χωρίς να μπλοκάρουν σε ό,τι λείπει', async () => {
  const { svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const entryId = created.entry.id;
  const added = await svc.addEntryPhotos({
    subprojectId: SUB_A,
    entryId,
    files: [makeSourceFile('οψη.jpg')],
  });
  const photoName = added.photos[0].name;

  const map = await svc.resolvePhotos([
    { subprojectId: SUB_A, entryId, name: photoName },
    { subprojectId: SUB_A, entryId, name: 'χαμενη.jpg' },
  ]);

  assert.match(map[`${SUB_A}|${entryId}|${photoName}`] || '', /^data:image\//);
  assert.equal(Object.keys(map).length, 1, 'όσες λείπουν απλώς παραλείπονται');
});

test('διαγραφή φωτογραφίας σβήνει και το αρχείο', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const entryId = created.entry.id;
  const added = await svc.addEntryPhotos({
    subprojectId: SUB_A,
    entryId,
    files: [makeSourceFile('οψη.jpg')],
  });
  const photoName = added.photos[0].name;
  const photosDir = path.join(diaryDir(dataDir, SUB_A), PHOTOS_DIR_NAME, entryId);

  const res = await svc.deleteEntryPhoto({ subprojectId: SUB_A, entryId, photoName });
  assert.equal(res.success, true);
  assert.equal(res.entry.photos.length, 0);
  assert.equal(fs.existsSync(path.join(photosDir, photoName)), false);
});

test('διαγραφή επίσκεψης παίρνει μαζί τις φωτογραφίες της', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const entryId = created.entry.id;
  await svc.addEntryPhotos({ subprojectId: SUB_A, entryId, files: [makeSourceFile('οψη.jpg')] });
  const photosDir = path.join(diaryDir(dataDir, SUB_A), PHOTOS_DIR_NAME, entryId);
  assert.equal(fs.existsSync(photosDir), true);

  const res = await svc.deleteEntry({ subprojectId: SUB_A, entryId });
  assert.equal(res.success, true);
  assert.equal(res.diary.entries.length, 0);
  assert.equal(fs.existsSync(photosDir), false);
});

test('όριο φωτογραφιών ανά επίσκεψη', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  const entryId = created.entry.id;

  const disk = readDiary(dataDir, SUB_A);
  disk.entries[0].photos = Array.from({ length: svc.MAX_PHOTOS_PER_ENTRY }, (_, i) => ({ name: `p${i}.jpg` }));
  fs.writeFileSync(path.join(diaryDir(dataDir, SUB_A), 'data.json'), JSON.stringify(disk));

  const res = await svc.addEntryPhotos({
    subprojectId: SUB_A,
    entryId,
    files: [makeSourceFile('ακομη-μια.jpg')],
  });
  assert.equal(res.success, false);
  assert.match(res.error, /ήδη/);
});

test('διαγραφή υποέργου καθαρίζει ολόκληρο το ημερολόγιό του', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  await svc.addEntryPhotos({
    subprojectId: SUB_A,
    entryId: created.entry.id,
    files: [makeSourceFile('οψη.jpg')],
  });
  await svc.addEntry({ subprojectId: SUB_B, draft: validDraft(), author: AUTHOR });

  const res = await svc.deleteSubprojectDiary(SUB_A);
  assert.equal(res.success, true);
  assert.equal(fs.existsSync(diaryDir(dataDir, SUB_A)), false);
  assert.equal(fs.existsSync(diaryDir(dataDir, SUB_B)), true, 'τα άλλα ημερολόγια μένουν');
  assert.deepEqual(Object.keys(svc.getEntryCountsBySubproject()), [SUB_B]);
});

test('πλήθη επισκέψεων ανά υποέργο για τα κουμπιά των καρτών', async () => {
  const { svc } = makeService();
  await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });
  await svc.addEntry({ subprojectId: SUB_A, draft: validDraft({ visitTime: '' }), author: AUTHOR });
  await svc.addEntry({ subprojectId: SUB_B, draft: validDraft(), author: AUTHOR });

  const counts = svc.getEntryCountsBySubproject();
  assert.equal(counts[SUB_A], 2);
  assert.equal(counts[SUB_B], 1);
});

test('ημερολόγιο που δεν υπάρχει επιστρέφει άδειο, χωρίς σφάλμα', () => {
  const { svc } = makeService();
  const res = svc.loadSubprojectDiary(SUB_A);
  assert.equal(res.success, true);
  assert.equal(res.exists, false);
  assert.deepEqual(res.diary.entries, []);
});

test('δεν βγαίνουμε ποτέ έξω από τον φάκελο του ημερολογίου', async () => {
  const { dataDir, svc } = makeService();
  const created = await svc.addEntry({ subprojectId: SUB_A, draft: validDraft(), author: AUTHOR });

  for (const badId of ['../escape', '..', 'a/b', 'ab', '']) {
    const res = await svc.addEntry({ subprojectId: badId, draft: validDraft(), author: AUTHOR });
    assert.equal(res.success, false, `${badId} δεν πρέπει να γίνεται δεκτό`);
    assert.match(res.error, /αναγνωριστικό/);
  }

  const escapeTarget = path.join(dataDir, 'ΕΚΤΟΣ.jpg');
  fs.writeFileSync(escapeTarget, 'μην με σβήσεις');
  const sneaky = await svc.deleteEntryPhoto({
    subprojectId: SUB_A,
    entryId: created.entry.id,
    photoName: '../../../ΕΚΤΟΣ.jpg',
  });
  assert.equal(sneaky.success, false);
  assert.equal(fs.existsSync(escapeTarget), true);

  assert.equal((await svc.deleteSubprojectDiary('../..')).success, false);
});
