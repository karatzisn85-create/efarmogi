import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plan = require('../../app/core/subprojectFolderPlan.js');
const writer = require('../../public/subprojectFolderExport.js');

function rels(result) {
  return result.copies.map((item) => item.relativePath);
}

function pdfRels(result) {
  return result.pdfs.map((item) => item.relativePath);
}

test('αρχείο με συντομογραφία όπως Δ.Σ. δεν μένει έξω από τον φάκελο', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: {
      subprojectTitle: 'Γέφυρα',
      files: ['113-2026 Δ.Σ..pdf', 'ΑΠΟΦΑΣΗ ΟΡ. ΠΡΟΘΕΣΜ..pdf'],
      fileGroups: [{ title: '..', files: ['εκτός.pdf'] }],
    },
  });
  assert.ok(rels(result).includes('ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/113-2026 Δ.Σ..pdf'));
  assert.ok(rels(result).includes('ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/ΑΠΟΦΑΣΗ ΟΡ. ΠΡΟΘΕΣΜ..pdf'));
  assert.equal(rels(result).some((item) => item.includes('..\\') || item.split('/').includes('..')), false);
  assert.ok(rels(result).includes('ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/Ομάδα/εκτός.pdf'));
});

test('ομάδες με ίδιο περικομμένο τίτλο μένουν χωριστά και φαίνονται οι διαφορές', () => {
  const stem = 'ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΥΠΟΒΟΛΗΣ - ΒΕΛΤΙΩΣΗ ΥΦΙΣΤΑΜΕΝΗΣ ΑΓΡΟΤΙΚΗΣ ΟΔΟΥ ΕΥΡΥΤΕΡΗΣ ΠΕΡΙΟΧΗΣ';
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', projectTitle: 'Γέφυρα', subprojectTitle: 'Γέφυρα' },
    proskliseis: [{
      prosklisiId: 'psk',
      title: 'Πρόσκληση',
      fileGroups: [
        { title: `${stem} ΑΓ. ΠΑΡΑΣΚΙΩΝ`, files: ['πρώτο.pdf'] },
        { title: `${stem} ΜΕΤΑΞΟΧΩΡΙΟΥ`, files: ['δεύτερο.pdf'] },
      ],
    }],
  });
  const paths = rels(result);
  assert.equal(paths.filter((item) => item.endsWith('πρώτο.pdf')).length, 1);
  assert.equal(paths.filter((item) => item.endsWith('δεύτερο.pdf')).length, 1);
  const first = paths.find((item) => item.endsWith('πρώτο.pdf'));
  const second = paths.find((item) => item.endsWith('δεύτερο.pdf'));
  assert.notEqual(first.split('/').slice(0, -1).join('/'), second.split('/').slice(0, -1).join('/'));
  assert.match(first, /ΠΑΡΑΣΚ/);
  assert.match(second, /ΜΕΤΑΞ/);
});

test('αρχείο πρόσκλησης που φαίνεται μόνο στον φάκελο μπαίνει στην εξαγωγή', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-loose-psk-'));
  const dataDir = path.join(root, 'data');
  const filesDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', 'psk', 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ', 'Επισυναπτόμενα Αρχεία Υποβολής');
  fs.mkdirSync(path.join(dataDir, 'proj', 'sub'), { recursive: true });
  fs.mkdirSync(filesDir, { recursive: true });
  fs.writeFileSync(path.join(filesDir, 'Πρόσκληση.pdf'), 'invite');
  fs.writeFileSync(path.join(dataDir, 'proj', 'sub', 'data.json'), JSON.stringify({
    projectId: 'proj',
    subprojectId: 'sub',
    projectTitle: 'Γέφυρα',
    subprojectTitle: 'Γέφυρα',
  }));
  fs.writeFileSync(path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', 'psk', 'data.json'), JSON.stringify({
    prosklisiId: 'psk',
    title: 'Γέφυρα',
    fileGroups: [],
    prosklisiFiles: [],
  }));
  const loaded = writer.loadFolderInput(dataDir, 'proj', 'sub');
  const built = plan.buildSubprojectFolderPlan(loaded.input);
  assert.ok(rels(built).includes('ΠΡΟΣΚΛΗΣΗ/Πρόσκληση.pdf'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('αρχείο με όνομα ΠΡΟΣΚΛΗΣΗ κρατά το όνομά του και το συνοπτικό φύλλο παραμερίζει', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', projectTitle: 'Γέφυρα', subprojectTitle: 'Γέφυρα' },
    proskliseis: [{
      prosklisiId: 'psk',
      title: 'Γέφυρα',
      prosklisiFiles: [{ fileName: 'ΠΡΟΣΚΛΗΣΗ.pdf' }],
      modifications: [{ modificationPDF: 'ΤΡΟΠΟΠΟΙΗΣΗ 1 ΠΡΟΣΚΛΗΣΗΣ.pdf' }],
    }],
  });
  assert.ok(rels(result).includes('ΠΡΟΣΚΛΗΣΗ/ΠΡΟΣΚΛΗΣΗ.pdf'));
  assert.ok(rels(result).includes('ΠΡΟΣΚΛΗΣΗ/ΤΡΟΠΟΠΟΙΗΣΗ 1 ΠΡΟΣΚΛΗΣΗΣ.pdf'));
  assert.ok(pdfRels(result).includes('ΠΡΟΣΚΛΗΣΗ/ΠΡΟΣΚΛΗΣΗ - συνοπτικό.pdf'));
  assert.ok(pdfRels(result).includes('ΠΡΟΣΚΛΗΣΗ/ΤΡΟΠΟΠΟΙΗΣΗ 1 ΠΡΟΣΚΛΗΣΗΣ - συνοπτικό.pdf'));
});

test('τα αρχεία του υποέργου κρατούν την ομάδα και τον υποφάκελο', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: {
      projectId: 'p1',
      subprojectId: 's1',
      subprojectTitle: 'Γέφυρα',
      fileGroups: [{
        title: 'Σύμβαση',
        files: ['σύμβαση.pdf'],
        subgroups: [{ title: 'Πρωτόκολλα', files: [{ name: 'πρωτοκ.pdf' }] }],
      }],
      files: ['ελεύθερο.pdf', 'σύμβαση.pdf'],
    },
  });
  assert.deepEqual(rels(result), [
    'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/Σύμβαση/σύμβαση.pdf',
    'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/Σύμβαση/Πρωτόκολλα/πρωτοκ.pdf',
    'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/ελεύθερο.pdf',
  ]);
  assert.equal(result.rootName, 'Γέφυρα');
  assert.ok(pdfRels(result).includes('ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ.pdf'));
});

test('ένταξη και τροποποίηση παίρνουν τα συμφωνημένα ονόματα· η δεύτερη ένταξη αριθμείται', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα' },
    entaxeis: [
      {
        entaxiId: 'e2',
        subject: 'Β ένταξη',
        entaxiPDFs: ['απόφαση.pdf'],
        modifications: [{ date: '2025-03-01', comments: 'Δεύτερη', modificationPDF: 'mod-b.pdf' }],
      },
      {
        entaxiId: 'e1',
        subject: 'Α ένταξη',
        entaxiPDF: 'παλαιό.pdf',
        diskFiles: ['παλαιό.pdf', 'Επιπλέον — Διαύγεια.pdf'],
        modifications: [{ date: '2025-02-15', amount: '120.000,00', comments: 'Αύξηση' }],
      },
    ],
  });
  assert.ok(pdfRels(result).includes('ΕΝΤΑΞΗ/ΕΝΤΑΞΗ.pdf'));
  assert.ok(pdfRels(result).includes('ΕΝΤΑΞΗ/ΤΡΟΠΟΠΟΙΗΣΗ 1 ΕΝΤΑΞΗΣ.pdf'));
  assert.ok(pdfRels(result).includes('ΕΝΤΑΞΗ 2/ΕΝΤΑΞΗ 2.pdf'));
  assert.ok(pdfRels(result).includes('ΕΝΤΑΞΗ 2/ΤΡΟΠΟΠΟΙΗΣΗ 1 ΕΝΤΑΞΗΣ.pdf'));
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ/παλαιό.pdf'));
  assert.equal(rels(result).includes('ΕΝΤΑΞΗ/Επιπλέον — Διαύγεια.pdf'), false);
  assert.equal(rels(result).filter((item) => item === 'ΕΝΤΑΞΗ/παλαιό.pdf').length, 1);
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ 2/απόφαση.pdf'));
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ 2/mod-b.pdf'));
  const firstMod = result.pdfs.find((item) => item.relativePath === 'ΕΝΤΑΞΗ/ΤΡΟΠΟΠΟΙΗΣΗ 1 ΕΝΤΑΞΗΣ.pdf');
  assert.equal(firstMod.rows.find((row) => row.label === 'Σχόλια').value, 'Αύξηση');
});

test('κάθε αρχείο ένταξης μπαίνει μία φορά, όσο και αν επαναλαμβάνεται η ένδειξη', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Οδός' },
    entaxeis: [{
      entaxiId: 'e1',
      subject: 'Ένταξη',
      entaxiPDFs: ['Ένταξη — Διαύγεια Α.pdf'],
      entaxiPDF: 'παλιό.pdf',
      approvalPDFs: [
        'Αποδοχή Δ.Σ. — Διαύγεια Β.pdf',
        'Αποδοχή Επιτροπής — Διαύγεια Γ.pdf',
      ],
      approvalPDF: 'Αποδοχή Δ.Σ. — Διαύγεια Β.pdf',
      diskFiles: [
        'Ένταξη — Διαύγεια Α.pdf',
        'Αποδοχή Δ.Σ. — Διαύγεια Β.pdf',
        'Αποδοχή Επιτροπής — Διαύγεια Γ.pdf',
        'παλιό.pdf',
      ],
    }],
  });
  assert.deepEqual(rels(result).filter((item) => item.startsWith('ΕΝΤΑΞΗ/')).sort(), [
    'ΕΝΤΑΞΗ/Αποδοχή Δ.Σ. — Διαύγεια Β.pdf',
    'ΕΝΤΑΞΗ/Αποδοχή Επιτροπής — Διαύγεια Γ.pdf',
    'ΕΝΤΑΞΗ/Ένταξη — Διαύγεια Α.pdf',
  ].sort());
});

test('ένταξη χωρίς ένδειξη κρατά το μοναδικό αρχείο του φακέλου· η τροποποίηση παίρνει και την αποδοχή', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Οδός' },
    entaxeis: [{
      entaxiId: 'e1',
      subject: 'Ένταξη',
      entaxiPDFs: [],
      approvalPDFs: [],
      diskFiles: ['μοναδικό.pdf'],
      modifications: [{
        modificationPDF: 'Τροποποίηση ένταξης — Διαύγεια Α.pdf',
        approvalPDF: 'Αποδοχή Δ.Σ. — Διαύγεια Β.pdf',
        approvalPDFs: ['Αποδοχή Δ.Σ. — Διαύγεια Β.pdf'],
      }],
    }],
  });
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ/μοναδικό.pdf'));
  assert.equal(rels(result).filter((item) => item === 'ΕΝΤΑΞΗ/μοναδικό.pdf').length, 1);
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ/Τροποποίηση ένταξης — Διαύγεια Α.pdf'));
  assert.ok(rels(result).includes('ΕΝΤΑΞΗ/Αποδοχή Δ.Σ. — Διαύγεια Β.pdf'));
  assert.equal(rels(result).filter((item) => item.includes('Αποδοχή Δ.Σ.')).length, 1);
});

test('χωρίς πράξεις βγαίνουν όλα τα αρχεία της πρόσκλησης· με πράξη μόνο η δική της και τα κοινά', () => {
  const common = {
    prosklisiId: 'psk',
    title: 'Πρόσκληση σχολείων',
    fileGroups: [
      { id: 'g1', title: 'Δικαιολογητικά', files: [{ fileName: 'κοινο.pdf' }] },
      { id: 'g2', title: 'Φάκελος πράξης', submissionId: 'act-1', files: [{ fileName: 'πραξη.pdf' }] },
      { id: 'g3', title: 'Άλλη πράξη', submissionId: 'act-2', files: [{ fileName: 'αλλη.pdf' }] },
    ],
    prosklisiFiles: [{ fileName: 'όροι.pdf' }],
    submissions: [
      { id: 'act-1', title: 'Οδικό δίκτυο' },
      { id: 'act-2', title: 'Άλλο έργο' },
    ],
  };
  const matched = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', projectTitle: 'Οδικό δίκτυο', subprojectTitle: 'Γέφυρα' },
    proskliseis: [common],
  });
  const paths = rels(matched);
  assert.ok(paths.includes('ΠΡΟΣΚΛΗΣΗ/Δικαιολογητικά/κοινο.pdf'));
  assert.ok(paths.includes('ΠΡΟΣΚΛΗΣΗ/Φάκελος πράξης/πραξη.pdf'));
  assert.ok(paths.includes('ΠΡΟΣΚΛΗΣΗ/όροι.pdf'));
  assert.equal(paths.some((item) => item.includes('αλλη.pdf')), false);
  assert.ok(pdfRels(matched).includes('ΠΡΟΣΚΛΗΣΗ/ΠΡΟΣΚΛΗΣΗ.pdf'));

  const all = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', projectTitle: 'Άγνωστο', subprojectTitle: 'Γέφυρα' },
    proskliseis: [common],
  });
  assert.ok(rels(all).some((item) => item.includes('αλλη.pdf')));

  const noActs = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα' },
    proskliseis: [{ ...common, submissions: [] }],
  });
  assert.ok(rels(noActs).some((item) => item.includes('αλλη.pdf')));
});

test('από την ωρίμανση μένουν μόνο όσα φαίνονται σε αδειοδοτήσεις και μελέτες έργου', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα' },
    proskliseis: [{
      prosklisiId: 'psk',
      title: 'Πρόσκληση',
      fileGroups: [],
      orimanthiFiles: [
        { categoryLabel: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ', subtitle: 'ΟΙΚΟΔΟΜΙΚΗ', originalName: 'αδεια.pdf', sourcePath: 'C:/data/αδεια.pdf', sourceProposalTitle: 'Έργο' },
        { categoryLabel: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ', subtitle: 'ΣΤΑΤΙΚΑ', originalName: 'στατικα.pdf', sourcePath: 'C:/data/στατικα.pdf', sourceProposalTitle: 'Έργο' },
        { categoryLabel: 'ΑΛΛΑ', originalName: 'σημειωση.pdf', sourcePath: 'C:/data/σημειωση.pdf', sourceProposalTitle: 'Έργο' },
      ],
    }],
  });
  const paths = rels(result);
  assert.ok(paths.includes('ΠΡΟΣΚΛΗΣΗ/ΑΔΕΙΟΔΟΤΗΣΕΙΣ/ΟΙΚΟΔΟΜΙΚΗ/αδεια.pdf'));
  assert.ok(paths.includes('ΠΡΟΣΚΛΗΣΗ/ΜΕΛΕΤΕΣ ΕΡΓΟΥ/ΣΤΑΤΙΚΑ/στατικα.pdf'));
  assert.equal(paths.some((item) => item.includes('σημειωση')), false);
});

test('η έγκριση παίρνει τα αρχεία της γραμμής και τις τροποποιήσεις της πράξης', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα' },
    egkriseis: [{
      projectFolder: 'egk-1',
      actTitle: 'Πράξη σταδίου',
      subTitle: 'Γέφυρα',
      pdfs: ['εγκριση.pdf'],
      modifications: ['τροποποιηση-πραξης.pdf'],
    }],
  });
  assert.deepEqual(rels(result), [
    'ΕΓΚΡΙΣΗ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ/εγκριση.pdf',
    'ΕΓΚΡΙΣΗ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ/τροποποιηση-πραξης.pdf',
  ]);
});

test('οι πράξεις Διαύγειας για ΑΠΕ και παράταση μπαίνουν ως αρχεία', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα' },
    diavgeiaEntries: [
      { ada: '9τ9γωψμ-θος', stage: 'APE', documentUrl: 'https://diavgeia.gov.gr/doc/9Τ9ΓΩΨΜ-ΘΟΣ' },
      { ada: 'Ε16ΡΩΨΜ-3Ι3', stage: 'EXT' },
      { ada: '24SYMV015449653', stage: 'APE' },
      { ada: 'ΨΩΗΠΩΨΜ-0ΧΘ', stage: 'REQ' },
    ],
  });
  const diavgeia = result.copies.filter((item) => item.source && item.source.type === 'diavgeia');
  assert.deepEqual(diavgeia.map((item) => item.relativePath).sort(), [
    'ΚΗΜΔΗΣ/ΑΠΕ/9Τ9ΓΩΨΜ-ΘΟΣ.pdf',
    'ΚΗΜΔΗΣ/Παράταση/Ε16ΡΩΨΜ-3Ι3.pdf',
  ].sort());
  assert.equal(diavgeia[0].source.documentUrl || diavgeia[1].source.documentUrl, 'https://diavgeia.gov.gr/doc/9Τ9ΓΩΨΜ-ΘΟΣ');
});

test('η λήψη από τη Διαύγεια γράφει το PDF στον φάκελο του σταδίου', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-diavgeia-'));
  const dataDir = path.join(root, 'data');
  const subDir = path.join(dataDir, 'proj', 'sub');
  const cache = path.join(root, 'pdf');
  fs.mkdirSync(subDir, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'data.json'), JSON.stringify({
    projectId: 'proj',
    subprojectId: 'sub',
    subprojectTitle: 'Γέφυρα',
    khmdhsDocumentRegistry: [
      { source: 'diavgeia', stage: 'APE', adam: '9Τ9ΓΩΨΜ-ΘΟΣ', openUrl: 'https://diavgeia.gov.gr/doc/9Τ9ΓΩΨΜ-ΘΟΣ' },
      { source: 'diavgeia', stage: 'EXT', adam: 'Ε16ΡΩΨΜ-3Ι3' },
      { source: 'khmdhs', stage: 'APE', adam: '24SYMV015449653' },
    ],
  }));
  const loaded = writer.loadFolderInput(dataDir, 'proj', 'sub');
  assert.deepEqual(loaded.input.diavgeiaEntries.map((entry) => entry.ada).sort(), ['9Τ9ΓΩΨΜ-ΘΟΣ', 'Ε16ΡΩΨΜ-3Ι3'].sort());
  fs.writeFileSync(path.join(cache, 'ape.pdf'), '%PDF-1.4 diavgeia');
  const destParent = path.join(root, 'out');
  fs.mkdirSync(destParent);
  const dest = path.join(destParent, 'Φάκελος');
  const written = await writer.writeSubprojectFolder({
    dataDir,
    destDir: dest,
    plan: {
      pdfs: [],
      copies: [{
        relativePath: 'ΚΗΜΔΗΣ/ΑΠΕ/9Τ9ΓΩΨΜ-ΘΟΣ.pdf',
        source: { type: 'diavgeia', ada: '9Τ9ΓΩΨΜ-ΘΟΣ', stage: 'APE', documentUrl: '' },
      }],
    },
    pdfs: [],
    downloadDiavgeia: async () => path.join(cache, 'ape.pdf'),
  });
  assert.equal(written.success, true);
  assert.equal(written.diavgeiaMissing, 0);
  assert.equal(fs.readFileSync(path.join(dest, 'ΚΗΜΔΗΣ', 'ΑΠΕ', '9Τ9ΓΩΨΜ-ΘΟΣ.pdf'), 'utf8'), '%PDF-1.4 diavgeia');
  fs.rmSync(root, { recursive: true, force: true });
});

test('τα έγγραφα ΚΗΜΔΗΣ μπαίνουν ανά στάδιο και αγνοείται ό,τι δεν ανήκει στο υποέργο', () => {
  const result = plan.buildSubprojectFolderPlan({
    project: { subprojectId: 's1', subprojectTitle: 'Γέφυρα', khmdhsAdam: '24SYMV000000001' },
    khmdhsEntries: [
      { adam: '24SYMV000000001', stage: 'SYMV' },
      { adam: '24REQ000000009', stage: 'REQ' },
    ],
  });
  assert.deepEqual(rels(result), ['ΚΗΜΔΗΣ/Σύμβαση/24SYMV000000001.pdf']);
});

test('η εγγραφή αντιγράφει τα αρχεία στον φάκελο και δεν πειράζει τα δεδομένα', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-folder-'));
  const dataDir = path.join(root, 'data');
  const filesDir = path.join(dataDir, 'proj', 'sub', 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
  const entaxiDir = path.join(dataDir, 'entaxeis', 'ent-1', 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
  fs.mkdirSync(filesDir, { recursive: true });
  fs.mkdirSync(entaxiDir, { recursive: true });
  fs.writeFileSync(path.join(filesDir, 'σύμβαση.pdf'), 'contract');
  fs.writeFileSync(path.join(filesDir, 'εκτος-καταλογου.pdf'), 'loose');
  fs.writeFileSync(path.join(entaxiDir, 'απόφαση.pdf'), 'decision');
  fs.writeFileSync(path.join(dataDir, 'proj', 'sub', 'data.json'), JSON.stringify({
    projectId: 'proj',
    subprojectId: 'sub',
    subprojectTitle: 'Γέφυρα δοκιμής',
    fileGroups: [{ title: 'Σύμβαση', files: ['σύμβαση.pdf'] }],
  }));
  fs.mkdirSync(path.join(dataDir, 'entaxeis', 'ent-1'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'entaxeis', 'ent-1', 'data.json'), JSON.stringify({
    entaxiId: 'ent-1',
    subject: 'Ένταξη',
    subprojectIds: ['sub'],
    entaxiPDFs: ['απόφαση.pdf'],
    modifications: [{ date: '2025-01-02', comments: 'Αλλαγή' }],
  }));

  const loaded = writer.loadFolderInput(dataDir, 'proj', 'sub');
  assert.equal(loaded.ok, true);
  const built = plan.buildSubprojectFolderPlan(loaded.input);
  const destParent = path.join(root, 'out');
  fs.mkdirSync(destParent);
  const dest = path.join(destParent, built.rootName);
  const written = await writer.writeSubprojectFolder({
    dataDir,
    destDir: dest,
    plan: built,
    pdfs: [{ relativePath: 'ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ.pdf', buffer: Buffer.from('%PDF-1.4 test') }],
    downloadKhmdhs: async () => null,
  });
  assert.equal(written.success, true);
  assert.equal(fs.readFileSync(path.join(dest, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'Σύμβαση', 'σύμβαση.pdf'), 'utf8'), 'contract');
  assert.equal(fs.readFileSync(path.join(dest, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'εκτος-καταλογου.pdf'), 'utf8'), 'loose');
  assert.equal(fs.readFileSync(path.join(dest, 'ΕΝΤΑΞΗ', 'απόφαση.pdf'), 'utf8'), 'decision');
  assert.equal(fs.readFileSync(path.join(dest, 'ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ.pdf'), 'utf8'), '%PDF-1.4 test');
  assert.equal(fs.existsSync(path.join(dest, 'ΕΝΤΑΞΗ', 'ΕΝΤΑΞΗ.pdf')), false);
  assert.equal(fs.readFileSync(path.join(filesDir, 'σύμβαση.pdf'), 'utf8'), 'contract');
  const refused = await writer.writeSubprojectFolder({
    dataDir,
    destDir: path.join(dataDir, 'εξαγωγή'),
    plan: built,
    pdfs: [],
  });
  assert.equal(refused.success, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('η λήψη κρίκου ξαναδοκιμάζεται μέχρι να έρθει το αρχείο', async () => {
  let calls = 0;
  const notes = [];
  const pdfPath = await writer.downloadKhmdhsWithRetry('24REQ000000001', {
    hasAttachment: () => 'https://example.test/file.pdf',
    download: async () => {
      calls += 1;
      if (calls === 1) throw new Error('προσωρινό');
      return 'C:\\cache\\file.pdf';
    },
    notify: (info) => notes.push(info),
    sleep: async () => {},
    clearCancel: () => {},
  });
  assert.equal(pdfPath, 'C:\\cache\\file.pdf');
  assert.equal(calls, 2);
  assert.equal(notes[0].attempt, 1);
  assert.equal(notes[1].waiting, true);
  assert.equal(notes[1].attempt, 2);
});

test('κρίκος χωρίς αρχείο στο ΚΗΜΔΗΣ δεν κρατάει τη διαδικασία', async () => {
  let calls = 0;
  const pdfPath = await writer.downloadKhmdhsWithRetry('24XXXX000000001', {
    hasAttachment: () => null,
    download: async () => {
      calls += 1;
      return 'δεν πρέπει';
    },
    sleep: async () => {},
  });
  assert.equal(pdfPath, null);
  assert.equal(calls, 0);
});

test('αποτυχημένη αντικατάσταση αφήνει τον φάκελο που υπήρχε', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-folder-replace-'));
  const dataDir = path.join(root, 'data');
  const filesDir = path.join(dataDir, 'proj', 'sub', 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
  fs.mkdirSync(filesDir, { recursive: true });
  fs.writeFileSync(path.join(filesDir, 'a.pdf'), 'pdf');
  const dest = path.join(root, 'out', 'Φάκελος');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'ΠΑΛΙΟ.txt'), 'old');
  const original = fs.copyFileSync;
  fs.copyFileSync = () => { throw new Error('δίσκος γεμάτος'); };
  try {
    const written = await writer.writeSubprojectFolder({
      dataDir,
      destDir: dest,
      plan: {
        pdfs: [],
        copies: [{
          relativePath: 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/a.pdf',
          source: { type: 'subproject-file', projectId: 'proj', subprojectId: 'sub', fileName: 'a.pdf' },
        }],
      },
      pdfs: [],
    });
    assert.equal(written.success, false);
    assert.equal(fs.readFileSync(path.join(dest, 'ΠΑΛΙΟ.txt'), 'utf8'), 'old');
    assert.equal(fs.existsSync(`${dest}.__ergohub_tmp`), false);
    assert.equal(fs.existsSync(`${dest}.__ergohub_old`), false);
  } finally {
    fs.copyFileSync = original;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
