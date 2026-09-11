import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const list = require('../../app/core/orimanthiFileChecklist.js');
const excel = require('../../public/orimanthiHubExcel.js');

test('μελέτη: ✓ όταν υπάρχει αρχείο, — όταν είναι άδεια', () => {
  const withFile = {
    fileCategoryRoot: 'meletes',
    fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ',
    files: [{ name: 't.pdf' }],
  };
  const empty = {
    fileCategoryRoot: 'meletes',
    fileCategorySpec: 'ΣΤΑΤΙΚΑ',
    files: [],
  };
  assert.equal(list.studyMark(withFile), '✓');
  assert.equal(list.studyMark(empty), '—');
  assert.equal(list.classifyGroup(withFile).kind, 'hasFile');
  assert.equal(list.classifyGroup(empty).kind, 'noFile');
});

test('άδεια: ✓ μόνο όταν ο χρήστης σημείωσε έκδοση, όχι από αρχεία', () => {
  const withDocs = {
    fileCategoryRoot: 'adeiodotiseis',
    fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
    permitIssued: false,
    files: [{ name: 'αίτηση.pdf' }],
  };
  const issued = { ...withDocs, permitIssued: true };
  assert.equal(list.permitMark(withDocs), '×');
  assert.equal(list.permitMark(issued), '✓');
  assert.equal(list.classifyGroup(withDocs).kind, 'pending');
  assert.equal(list.classifyGroup(issued).kind, 'issued');
});

test('καρτέλα έργου χωρίζει μελέτες και αδειοδοτήσεις', () => {
  const card = list.buildProposalCard({
    title: 'Οδός Αρχανών',
    status: 'maturing',
    projectCategory: 'ΟΔΟΠΟΙΙΑ',
    notes: 'Αναμονή αρχαιολογικής',
    fileGroups: [
      {
        fileCategoryRoot: 'meletes',
        fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ',
        files: [{ name: 't.pdf' }],
      },
      {
        fileCategoryRoot: 'adeiodotiseis',
        fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
        permitIssued: false,
        files: [],
      },
    ],
  });
  assert.equal(card.title, 'Οδός Αρχανών');
  assert.equal(card.files, 1);
  assert.equal(card.notes, 'Αναμονή αρχαιολογικής');
  assert.deepEqual(card.meletes.map((x) => [x.spec, x.mark]), [['ΤΟΠΟΓΡΑΦΙΚΑ', '✓']]);
  assert.deepEqual(card.adeiodotiseis.map((x) => [x.spec, x.mark]), [['ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', '×']]);
});

test('σήμανση άδειας μένει μετά από ανέβασμα πάνω στον δίσκο', () => {
  const onDisk = [{
    id: 'g1',
    fileCategoryRoot: 'adeiodotiseis',
    fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
    files: [],
  }];
  const afterMark = list.setGroupPermitIssued(onDisk, 'g1', true);
  const afterUpload = afterMark.map((g) => (
    g.id === 'g1' ? { ...g, files: [...(g.files || []), { name: 'aitisi.pdf' }] } : g
  ));
  assert.equal(afterUpload[0].permitIssued, true);
  assert.equal(afterUpload[0].files[0].name, 'aitisi.pdf');
});

test('σήμανση άδειας δεν σβήνει μη αποθηκευμένες σημειώσεις', () => {
  const local = {
    id: 'p1',
    notes: 'ΜΗ ΑΠΟΘΗΚΕΥΜΕΝΗ σημείωση',
    updatedAt: 'T1',
    fileGroups: [{ id: 'g1', permitIssued: true, files: [{ name: 'τοπικό.pdf' }] }],
  };
  const saved = {
    id: 'p1',
    notes: '',
    updatedAt: 'T2',
    fileGroups: [{ id: 'g1', permitIssued: true, files: [] }],
  };
  const next = list.applyPermitIssuedFromSaved(local, saved, 'g1');
  assert.equal(next.notes, 'ΜΗ ΑΠΟΘΗΚΕΥΜΕΝΗ σημείωση');
  assert.equal(next.updatedAt, 'T2');
  assert.equal(next.fileGroups[0].permitIssued, true);
  assert.equal(next.fileGroups[0].files[0].name, 'τοπικό.pdf');
});

test('νέο έργο: η ανακατασκευή ομάδας κρατά τη σήμανση άδειας', () => {
  const staged = {
    id: 'g1',
    label: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ · ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
    fileCategoryRoot: 'adeiodotiseis',
    fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
    permitIssued: true,
  };
  const persisted = list.buildPersistedFileGroupFromStaged(staged, [{ name: 'aitisi.pdf' }]);
  assert.equal(persisted.permitIssued, true);
  assert.equal(persisted.files[0].name, 'aitisi.pdf');
});

test('συγχώνευση από δίσκο κρατά σημειώσεις, νέα κατηγορία και σήμανση άδειας', () => {
  const local = {
    id: 'p1',
    title: 'Τοπικός τίτλος',
    notes: 'ΜΗ ΑΠΟΘΗΚΕΥΜΕΝΗ σημείωση',
    updatedAt: 'T1',
    fileGroups: [
      { id: 'g1', permitIssued: true, files: [{ name: 'τοπικό.pdf' }] },
      { id: 'g-new', label: 'Νέα κατηγορία', permitIssued: false, files: [] },
    ],
  };
  const saved = {
    id: 'p1',
    title: 'Τίτλος δίσκου',
    notes: '',
    updatedAt: 'T2',
    fileGroups: [
      { id: 'g1', permitIssued: false, files: [{ name: 'νέο-ανέβασμα.pdf' }] },
    ],
  };
  const next = list.mergeProposalFromDisk(local, saved);
  assert.equal(next.notes, 'ΜΗ ΑΠΟΘΗΚΕΥΜΕΝΗ σημείωση');
  assert.equal(next.title, 'Τοπικός τίτλος');
  assert.equal(next.updatedAt, 'T2');
  assert.equal(next.fileGroups[0].permitIssued, true);
  assert.equal(next.fileGroups[0].files[0].name, 'νέο-ανέβασμα.pdf');
  assert.equal(next.fileGroups[1].id, 'g-new');
});

test('σύγκρουση αποθήκευσης μετά τη σήμανση: η επόμενη αποθήκευση χρησιμοποιεί νέο updatedAt', () => {
  const local = {
    id: 'p1',
    notes: 'νέες σημειώσεις',
    updatedAt: 'T1',
    fileGroups: [{ id: 'g1', permitIssued: true, files: [] }],
  };
  const afterPermit = {
    id: 'p1',
    notes: '',
    updatedAt: 'T2',
    fileGroups: [{ id: 'g1', permitIssued: true, files: [] }],
  };
  const merged = list.applyPermitIssuedFromSaved(local, afterPermit, 'g1');
  assert.equal(merged.notes, 'νέες σημειώσεις');
  assert.equal(merged.updatedAt, 'T2');
  const conflictDisk = { ...afterPermit, notes: 'παλιές' };
  const afterConflict = list.mergeProposalFromDisk(merged, conflictDisk);
  assert.equal(afterConflict.notes, 'νέες σημειώσεις');
  assert.equal(afterConflict.updatedAt, 'T2');
});

test('Excel μοντέλο: ένα μπλοκ ανά έργο, χωρίς στήλη εκκρεμοτήτων', () => {
  const model = excel.buildHubExcelModel([
    {
      title: 'Οδός Αρχανών',
      status: 'maturing',
      projectCategory: 'ΟΔΟΠΟΙΙΑ',
      municipalUnit: 'Δ.Ε. ΑΡΧΑΝΩΝ',
      fileGroups: [
        {
          fileCategoryRoot: 'meletes',
          fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ',
          files: [{ name: 't.pdf' }],
        },
        {
          fileCategoryRoot: 'adeiodotiseis',
          fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
          permitIssued: true,
          files: [],
        },
      ],
    },
  ]);
  const texts = model.rows.flat().map((c) => c.v);
  assert.equal(model.cards.length, 1);
  assert.ok(texts.includes('Οδός Αρχανών'));
  assert.ok(texts.includes('ΜΕΛΕΤΕΣ ΕΡΓΟΥ'));
  assert.ok(texts.includes('ΑΔΕΙΟΔΟΤΗΣΕΙΣ'));
  assert.ok(texts.includes('ΤΟΠΟΓΡΑΦΙΚΑ'));
  assert.ok(texts.includes('ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ'));
  assert.ok(texts.includes(excel.REPORT_TITLE));
  assert.ok(texts.includes(excel.REPORT_CREDIT));
  assert.ok(texts.some((v) => String(v).includes(excel.APP_NAME)));
  assert.ok(!texts.some((v) => String(v).includes('Εκκρεμότητες')));
});

test('Excel επικεφαλίδα: ημερομηνία και πλήθος αριστερά, εξαγωγή δεξιά', () => {
  const model = excel.buildHubExcelModel(
    [{ title: 'Έργο', status: 'draft', fileGroups: [] }],
    null,
    { exportedAt: '11/09/2026, 03:15 μ.μ.', exportedBy: 'ΝΙΚΟΛΑΟΣ ΚΑΡΑΤΖΙΑΣ' },
  );
  const { COL } = excel;
  assert.equal(model.rows[0][0].v, excel.REPORT_TITLE);
  assert.equal(model.rows[0][0].kind, 'reportTitle');
  assert.equal(model.rows[1][0].v, 'Ημερομηνία: 11/09/2026, 03:15 μ.μ.   ·   Έργα: 1');
  assert.equal(model.rows[1][COL.studyName].v, 'Εξαγωγή: ΝΙΚΟΛΑΟΣ ΚΑΡΑΤΖΙΑΣ');
  assert.ok(model.merges.some((m) => m.s.r === 0 && m.s.c === 0 && m.e.c === excel.COLS - 1));
  assert.ok(model.merges.some((m) => m.s.r === 1 && m.s.c === 0 && m.e.c === COL.category));
  assert.ok(model.merges.some((m) => m.s.r === 1 && m.s.c === COL.studyName && m.e.c === excel.COLS - 1));
});

test('Excel δομή: πίνακας ανά έργο με συγχωνεύσεις καθ’ ύψος', () => {
  const model = excel.buildHubExcelModel([
    {
      title: 'δοκιμη 1',
      status: 'maturing',
      projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
      infrastructureSpecialization: 'ΥΔΡΕΥΣΗ',
      municipalUnit: 'ΑΡΧΑΝΩΝ',
      settlement: 'ΑΝΩ ΑΡΧΑΝΕΣ',
      fileGroups: [
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΚΤΗΜΑΤΟΛΟΓΙΟ', files: [{ name: 'k.pdf' }] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: true, files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΣΥΜΒΟΥΛΙΟ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ', permitIssued: true, files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ', permitIssued: false, files: [] },
      ],
    },
  ]);
  const { COL, BANNER_ROW_COUNT: B } = excel;
  assert.equal(model.rows[0][0].v, excel.REPORT_TITLE);
  assert.equal(model.rows[B][COL.serial].v, 'Α/Α');
  assert.equal(model.rows[B][COL.title].v, 'Τίτλος έργου');
  assert.equal(model.rows[B][COL.studyName].v, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ');
  assert.equal(model.rows[B][COL.permitName].v, 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ');
  assert.ok(model.merges.some((m) => m.s.r === B && m.s.c === COL.studyName && m.e.c === COL.studyMark));
  assert.ok(model.merges.some((m) => m.s.r === B && m.s.c === COL.permitName && m.e.c === COL.permitMark));

  assert.equal(model.rows[B + 1][COL.serial].v, '1');
  assert.equal(model.rows[B + 1][COL.title].v, 'δοκιμη 1');
  assert.equal(model.rows[B + 1][COL.status].v, 'Υπό ωρίμανση');
  assert.equal(model.rows[B + 1][COL.category].v, 'ΥΔΡΑΥΛΙΚΑ · ΥΔΡΕΥΣΗ');
  assert.equal(model.rows[B + 1][COL.studyName].v, 'ΚΤΗΜΑΤΟΛΟΓΙΟ');
  assert.equal(model.rows[B + 1][COL.studyMark].v, '✓');
  assert.equal(model.rows[B + 1][COL.permitName].v, 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ');
  assert.equal(model.rows[B + 2][COL.permitName].v, 'ΣΥΜΒΟΥΛΙΟ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ');
  assert.equal(model.rows[B + 3][COL.permitName].v, 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ');
  assert.equal(model.rows[B + 3][COL.permitMark].v, '×');

  // 1 μελέτη + 3 άδειες → οι αριστερές στήλες και η μελέτη συγχωνεύονται σε 3 γραμμές.
  assert.ok(model.merges.some((m) => m.s.r === B + 1 && m.e.r === B + 3 && m.s.c === COL.serial && m.e.c === COL.serial));
  assert.ok(model.merges.some((m) => m.s.r === B + 1 && m.e.r === B + 3 && m.s.c === COL.title && m.e.c === COL.title));
  assert.ok(model.merges.some((m) => m.s.r === B + 1 && m.e.r === B + 3 && m.s.c === COL.studyName && m.e.c === COL.studyName));
  assert.ok(model.merges.some((m) => m.s.r === B + 1 && m.e.r === B + 3 && m.s.c === COL.studyMark && m.e.c === COL.studyMark));
  // Οι τρεις άδειες μένουν σε χωριστές γραμμές — χωρίς κατακόρυφη συγχώνευση ονόματος.
  assert.ok(!model.merges.some((m) => m.s.c === COL.permitName && m.e.r > m.s.r));
});

test('Excel: άνισες μελέτες/άδειες συγχωνεύουν τα κενά κελιά της κοντύτερης στήλης', () => {
  const model = excel.buildHubExcelModel([
    {
      title: 'Άνισο',
      status: 'maturing',
      fileGroups: [
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ', files: [{ name: 't.pdf' }] },
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΣΤΑΤΙΚΑ', files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: true, files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΑΣΑΡΧΕΙΟ', permitIssued: false, files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ', permitIssued: false, files: [] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΟΠΕΚΕΠΕ', permitIssued: false, files: [] },
      ],
    },
  ]);
  const { COL, BANNER_ROW_COUNT: B } = excel;
  // 2 μελέτες + 4 άδειες → οι δύο κενές γραμμές μελετών συγχωνεύονται.
  assert.ok(model.merges.some((m) => (
    m.s.r === B + 3 && m.e.r === B + 4 && m.s.c === COL.studyName && m.e.c === COL.studyName
  )));
  assert.ok(!model.merges.some((m) => m.s.c === COL.permitName && m.e.r > m.s.r));
});

test('Excel: δύο καρτέλες χωρίζονται με μπάρα, χωρίς κατηγορίες που δεν υπάρχουν', () => {
  const model = excel.buildHubExcelModel([
    {
      title: 'Πρώτο',
      status: 'draft',
      fileGroups: [
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ', files: [] },
      ],
    },
    {
      title: 'Δεύτερο',
      status: 'maturing',
      fileGroups: [
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΑΣΑΡΧΕΙΟ', permitIssued: false, files: [] },
      ],
    },
  ]);
  const texts = model.rows.flat().map((c) => c.v);
  assert.ok(texts.includes('Πρώτο'));
  assert.ok(texts.includes('Δεύτερο'));
  assert.ok(texts.includes('ΤΟΠΟΓΡΑΦΙΚΑ'));
  assert.ok(texts.includes('ΔΑΣΑΡΧΕΙΟ'));
  assert.ok(!texts.includes('ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ'));
  assert.ok(model.rows.some((row) => row[0].kind === 'separator'));
});

test('Excel επιλογές: χωρίς οικισμό και χωρίς αδειοδοτήσεις', () => {
  const model = excel.buildHubExcelModel(
    [{
      title: 'Επιλογή στηλών',
      status: 'maturing',
      municipalUnit: 'ΑΡΧΑΝΩΝ',
      settlement: 'ΑΝΩ ΑΡΧΑΝΕΣ',
      projectCategory: 'ΟΔΟΠΟΙΙΑ',
      fileGroups: [
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ', files: [{ name: 't.pdf' }] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: true, files: [] },
      ],
    }],
    null,
    null,
    {
      columns: { status: true, municipal: true, settlement: false, category: true },
      includeStudies: true,
      includePermits: false,
    },
  );
  const texts = model.rows.flat().map((c) => c.v);
  assert.ok(texts.includes('Κατάσταση'));
  assert.ok(texts.includes('Δημοτική ενότητα'));
  assert.ok(texts.includes('Κατηγορία / Εξειδίκευση'));
  assert.ok(!texts.includes('Οικισμός'));
  assert.ok(!texts.includes('ΑΝΩ ΑΡΧΑΝΕΣ'));
  assert.ok(texts.includes('ΜΕΛΕΤΕΣ ΕΡΓΟΥ'));
  assert.ok(texts.includes('ΤΟΠΟΓΡΑΦΙΚΑ'));
  assert.ok(!texts.includes('ΑΔΕΙΟΔΟΤΗΣΕΙΣ'));
  assert.ok(!texts.includes('ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ'));
  const { COL, COLS } = excel.layoutFromOptions({
    columns: { status: true, municipal: true, settlement: false, category: true },
    includeStudies: true,
    includePermits: false,
  });
  assert.equal(COLS, 7);
  assert.equal(COL.studyName, 5);
  assert.equal(COL.studyMark, 6);
  assert.equal(COL.permitName, undefined);
});

test('Excel επιλογές: μόνο αδειοδοτήσεις, χωρίς στήλες κατάστασης', () => {
  const model = excel.buildHubExcelModel(
    [{
      title: 'Μόνο άδειες',
      status: 'maturing',
      fileGroups: [
        { fileCategoryRoot: 'meletes', fileCategorySpec: 'ΚΤΗΜΑΤΟΛΟΓΙΟ', files: [{ name: 'k.pdf' }] },
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΑΣΑΡΧΕΙΟ', permitIssued: false, files: [] },
      ],
    }],
    null,
    null,
    {
      columns: { status: false, municipal: false, settlement: false, category: false },
      includeStudies: false,
      includePermits: true,
    },
  );
  const texts = model.rows.flat().map((c) => c.v);
  assert.ok(texts.includes('Α/Α'));
  assert.ok(texts.includes('Τίτλος έργου'));
  assert.ok(texts.includes('ΑΔΕΙΟΔΟΤΗΣΕΙΣ'));
  assert.ok(texts.includes('ΔΑΣΑΡΧΕΙΟ'));
  assert.ok(!texts.includes('Κατάσταση'));
  assert.ok(!texts.includes('ΜΕΛΕΤΕΣ ΕΡΓΟΥ'));
  assert.ok(!texts.includes('ΚΤΗΜΑΤΟΛΟΓΙΟ'));
});

test('Excel: κενό έργο μπαίνει ως καρτέλα, χωρίς στήλη εκκρεμοτήτων', () => {
  const model = excel.buildHubExcelModel([
    { title: 'Κενό έργο', status: 'draft', fileGroups: [] },
  ]);
  const texts = model.rows.flat().map((c) => c.v);
  assert.equal(model.cards.length, 1);
  assert.ok(texts.includes('Κενό έργο'));
  assert.ok(!texts.some((v) => String(v).includes('Εκκρεμότητες')));
});

test('HTML αναφορά hub: οκτώ στήλες, χωρίς εκκρεμότητες', () => {
  const htmlMod = require('../../public/orimanthiReportHtml.js');
  const html = htmlMod.buildHubReportHtml({
    rows: [{
      title: 'Οδός',
      statusKey: 'maturing',
      status: 'Υπό ωρίμανση',
      category: 'ΟΔΟΠΟΙΙΑ',
      municipalUnit: 'Δ.Ε. ΑΡΧΑΝΩΝ',
      settlement: '—',
      aepo: '—',
      files: 1,
      updatedAt: '11/09/2026',
    }],
    exportedAt: '11/09/2026',
    exportedBy: 'Δοκιμή',
    appVersion: '1.4.106',
  });
  assert.match(html, /<th>Τίτλος<\/th>/);
  assert.match(html, /<th>Ενημέρωση<\/th>/);
  assert.equal((html.match(/<th>/g) || []).length, 8);
  assert.ok(!html.includes('Εκκρεμότητες'));
  const emptyHtml = htmlMod.buildHubReportHtml({
    rows: [],
    exportedAt: '11/09/2026',
  });
  assert.match(emptyHtml, /colspan="8"/);
  assert.ok(!emptyHtml.includes('Εκκρεμότητες'));
});
