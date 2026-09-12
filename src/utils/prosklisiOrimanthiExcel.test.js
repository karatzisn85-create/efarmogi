/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx-js-style');
const {
  MIXED_CORE_FIELD_IDS,
  resolveMixedInvitationFields,
  getInvitationCellValue,
  resolveLinkedProposals,
  buildMixedProsklisiOrimanthiModel,
  computeMixedRowHeights,
  writeMixedWorkbook,
  REPORT_TITLE,
} = require('../../public/prosklisiOrimanthiExcel');

function cellText(model) {
  return model.rows.map((row) => row.map((cell) => (cell && cell.v) || '').join('\t')).join('\n');
}

function findRowWith(model, text) {
  return model.rows.findIndex((row) => row.some((cell) => String(cell && cell.v || '').includes(text)));
}

function invitationMergesForCol(model, col) {
  return model.merges.filter((m) => m.s.c === col && m.e.c === col && m.e.r > m.s.r);
}

function rowHasValue(row, value) {
  return (row || []).some((cell) => (cell && cell.v) === value);
}

function countValue(model, value) {
  return model.rows.filter((row) => rowHasValue(row, value)).length;
}

describe('prosklisiOrimanthiExcel', () => {
  const excelOptions = {
    columns: { status: true, municipal: true, settlement: true, category: true },
    includeStudies: true,
    includePermits: true,
  };

  const roadProposal = {
    id: 'road-1',
    title: 'Ανακατασκευή οδού Αρχανών',
    status: 'maturing',
    projectCategory: 'ΟΔΟΠΟΙΙΑ',
    municipalUnit: 'Δ.Ε. ΑΡΧΑΝΩΝ',
    settlement: 'Αρχάνες',
    notes: 'Αναμονή αρχαιολογικής έγκρισης.',
    fileGroups: [
      {
        id: 'fg-study',
        fileCategoryRoot: 'meletes',
        fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ',
        files: [{ name: 'topo.pdf' }],
      },
      {
        id: 'fg-permit',
        fileCategoryRoot: 'adeiodotiseis',
        fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
        permitIssued: false,
        files: [],
      },
    ],
  };

  const waterProposal = {
    id: 'water-1',
    title: 'Δίκτυο ύδρευσης',
    status: 'ready',
    projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
    municipalUnit: 'Δ.Ε. ΑΣΤΕΡΟΥΣΙΩΝ',
    settlement: 'Παρανύμφοι',
    notes: '',
    fileGroups: [
      {
        id: 'fg-s1',
        fileCategoryRoot: 'meletes',
        fileCategorySpec: 'ΥΔΡΑΥΛΙΚΗ',
        files: [],
      },
      {
        id: 'fg-s2',
        fileCategoryRoot: 'meletes',
        fileCategorySpec: 'ΗΛΕΚΤΡΟΜΗΧΑΝΟΛΟΓΙΚΗ',
        files: [{ name: 'em.pdf' }],
      },
      {
        id: 'fg-p1',
        fileCategoryRoot: 'adeiodotiseis',
        fileCategorySpec: 'ΔΕΥΑ',
        permitIssued: true,
        files: [],
      },
    ],
  };

  test('μικτή σειρά στηλών: πρώτα τα βασικά της πρόσκλησης, μετά όσα επιλέχθηκαν', () => {
    const fields = resolveMixedInvitationFields([
      'status', 'code', 'title', 'linkedOrimanthiLabel', 'diavgeiaAda',
    ]);
    expect(fields.map((f) => f.id)).toEqual([
      ...MIXED_CORE_FIELD_IDS,
      'code',
      'status',
      'diavgeiaAda',
    ]);
    expect(fields.some((f) => f.id === 'linkedOrimanthiLabel')).toBe(false);
  });

  test('η ισχύουσα λήξη γράφεται όπως ήρθε από την πρόσκληση', () => {
    expect(getInvitationCellValue({ deadline: '2026-12-31' }, { id: 'deadline' }, 0)).toBe('31/12/2026');
    expect(getInvitationCellValue({ title: 'Σχολεία' }, { id: 'title' }, 0)).toBe('Σχολεία');
    expect(getInvitationCellValue({}, { id: 'rowNumber' }, 2)).toBe('3');
  });

  test('συσχετισμένα έργα διαβάζονται από τα ζωντανά δεδομένα ωρίμανσης', () => {
    const linked = resolveLinkedProposals({
      linkedOrimanthiProposals: [
        { id: 'road-1', title: 'Παλιός τίτλος' },
        { id: 'missing', title: 'Διαγραμμένο' },
      ],
    }, [roadProposal]);
    expect(linked).toHaveLength(2);
    expect(linked[0].title).toBe('Ανακατασκευή οδού Αρχανών');
    expect(linked[0].fileGroups).toHaveLength(2);
    expect(linked[1].title).toBe('Διαγραμμένο');
  });

  test('πρόσκληση χωρίς έργα ωρίμανσης κρατά μία γραμμή και παύλα στα δεξιά', () => {
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: 'Πρόσκληση μακρινή',
        axis: 'Υποδομές',
        fundingSource: 'ΠΔΕ',
        deadline: '2026-09-01',
        budgetRange: '50.000',
        linkedOrimanthiProposals: [],
      }],
      allProposals: [roadProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const text = cellText(model);
    expect(text).toContain(REPORT_TITLE);
    expect(text).toContain('Πρόσκληση μακρινή');
    expect(text).toContain('Υποδομές');
    expect(text).toContain('ΠΔΕ');
    expect(text).toContain('01/09/2026');
    expect(text).toContain('50.000');
    expect(text).toContain('ΠΡΟΣΚΛΗΣΗ');
    expect(text).toContain('ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ');
    expect(text).toContain('Α/Α έργου');
    expect(text).toContain('Τίτλος έργου');
    expect(text).toContain('ΜΕΛΕΤΕΣ ΕΡΓΟΥ');
    expect(text).toContain('ΑΔΕΙΟΔΟΤΗΣΕΙΣ');
    expect(model.projectCount).toBe(0);
    expect(countValue(model, 'Α/Α έργου')).toBe(1);
    expect(countValue(model, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ')).toBe(1);
    const dataRow = model.rows[findRowWith(model, 'Πρόσκληση μακρινή')];
    const projectSerial = dataRow[MIXED_CORE_FIELD_IDS.length];
    const projectTitle = dataRow[MIXED_CORE_FIELD_IDS.length + 1];
    expect(projectSerial.v).toBe('—');
    expect(projectTitle.v).toBe('—');
  });

  test('ένα συσχετισμένο έργο διακλαδώνει μελέτες, άδειες και σημειώσεις όπως η ωρίμανση', () => {
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: 'Πρόσκληση σχολείων',
        axis: 'Εκπαίδευση',
        fundingSource: 'ΕΣΠΑ 2021-2027',
        deadline: '2026-08-20',
        budgetRange: '100.000 - 200.000',
        linkedOrimanthiProposals: [{ id: 'road-1' }],
      }],
      allProposals: [roadProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const text = cellText(model);
    expect(text).toContain('ΠΡΟΣΚΛΗΣΗ');
    expect(text).toContain('ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ');
    expect(text).toContain('Πρόσκληση σχολείων');
    expect(text).toContain('Εκπαίδευση');
    expect(text).toContain('ΕΣΠΑ 2021-2027');
    expect(text).toContain('20/08/2026');
    expect(text).toContain('Ανακατασκευή οδού Αρχανών');
    expect(text).toContain('Υπό ωρίμανση');
    expect(text).toContain('Δ.Ε. ΑΡΧΑΝΩΝ');
    expect(text).toContain('ΤΟΠΟΓΡΑΦΙΚΑ');
    expect(text).toContain('ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ');
    expect(text).toContain('Σημειώσεις: Αναμονή αρχαιολογικής έγκρισης.');
    expect(model.projectCount).toBe(1);

    const invRow = findRowWith(model, 'Πρόσκληση σχολείων');
    const projectRow = findRowWith(model, 'Ανακατασκευή οδού Αρχανών');
    expect(projectRow).toBe(invRow);
    expect(countValue(model, 'Α/Α έργου')).toBe(1);
    expect(countValue(model, 'ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ')).toBe(1);
    const projectTitle = model.rows[projectRow][MIXED_CORE_FIELD_IDS.length + 1];
    expect(projectTitle.v).toContain('Ανακατασκευή οδού Αρχανών');
    expect(projectTitle.v).toContain('Σημειώσεις: Αναμονή αρχαιολογικής έγκρισης.');
  });

  test('δύο έργα στην ίδια πρόσκληση: η πρόσκληση συγχωνεύεται και κάθε έργο διακλαδώνει χωριστά', () => {
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: 'Κοινή πρόσκληση',
        axis: 'Υποδομές',
        fundingSource: 'ΕΣΠΑ',
        deadline: '2026-10-01',
        budgetRange: '1.000.000',
        linkedOrimanthiProposals: [{ id: 'road-1' }, { id: 'water-1' }],
      }],
      allProposals: [roadProposal, waterProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const text = cellText(model);
    expect(text).toContain('Κοινή πρόσκληση');
    expect(text).toContain('Ανακατασκευή οδού Αρχανών');
    expect(text).toContain('Δίκτυο ύδρευσης');
    expect(text).toContain('ΤΟΠΟΓΡΑΦΙΚΑ');
    expect(text).toContain('ΥΔΡΑΥΛΙΚΗ');
    expect(text).toContain('ΗΛΕΚΤΡΟΜΗΧΑΝΟΛΟΓΙΚΗ');
    expect(text).toContain('ΔΕΥΑ');
    expect(model.projectCount).toBe(2);

    const invRow = findRowWith(model, 'Κοινή πρόσκληση');
    const roadRow = findRowWith(model, 'Ανακατασκευή οδού Αρχανών');
    const waterRow = findRowWith(model, 'Δίκτυο ύδρευσης');
    const hydroStudyRow = findRowWith(model, 'ΗΛΕΚΤΡΟΜΗΧΑΝΟΛΟΓΙΚΗ');
    expect(roadRow).toBe(invRow);
    expect(waterRow).toBeGreaterThan(roadRow);
    expect(countValue(model, 'Α/Α έργου')).toBe(1);
    expect(countValue(model, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ')).toBe(1);
    expect(countValue(model, 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ')).toBe(1);
    const titleMerge = invitationMergesForCol(model, 1).find((m) => m.s.r === invRow);
    expect(titleMerge).toBeTruthy();
    expect(titleMerge.e.r).toBeGreaterThanOrEqual(hydroStudyRow);

    const invSerialCol = MIXED_CORE_FIELD_IDS.length;
    const firstProjectSerial = model.rows[roadRow][invSerialCol].v;
    const secondProjectSerial = model.rows[waterRow][invSerialCol].v;
    expect(firstProjectSerial).toBe('1');
    expect(secondProjectSerial).toBe('2');

    const roadTitle = model.rows[roadRow][invSerialCol + 1].v;
    const waterTitle = model.rows[waterRow][invSerialCol + 1].v;
    expect(roadTitle).toContain('Σημειώσεις: Αναμονή αρχαιολογικής έγκρισης.');
    expect(waterTitle).toBe('Δίκτυο ύδρευσης');
    expect(waterTitle).not.toContain('Σημειώσεις');
    const between = model.rows.slice(roadRow + 1, waterRow);
    expect(between.some((row) => row.some((cell) => cell && cell.kind === 'projectBreak'))).toBe(true);
    expect(between.some((row) => row.some((cell) => cell && cell.kind === 'separator'))).toBe(false);
    expect(model.rows[waterRow].some((cell) => cell && cell.kind === 'projectAlt')).toBe(true);
    expect(between.some((row) => rowHasValue(row, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ'))).toBe(false);
    expect(between.some((row) => rowHasValue(row, 'Α/Α έργου'))).toBe(false);
    between.forEach((row) => {
      expect(row.some((cell) => String((cell && cell.v) || '').includes('Αναμονή αρχαιολογικής'))).toBe(false);
    });
  });

  test('ο χωρισμός δύο προσκλήσεων είναι διαφορετικός από τον χωρισμό δύο έργων', () => {
    const invitation = (title) => ({
      title,
      axis: 'Υποδομές',
      fundingSource: 'ΕΣΠΑ',
      deadline: '2026-10-01',
      budgetRange: '1.000',
      linkedOrimanthiProposals: [{ id: 'road-1' }, { id: 'water-1' }],
    });
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [invitation('Πρώτη πρόσκληση'), invitation('Δεύτερη πρόσκληση')],
      allProposals: [roadProposal, waterProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const firstRow = findRowWith(model, 'Πρώτη πρόσκληση');
    const secondRow = findRowWith(model, 'Δεύτερη πρόσκληση');
    const between = model.rows.slice(firstRow + 1, secondRow);
    const invitationBreaks = between.filter((row) => row.every((cell) => cell && cell.kind === 'separator'));
    const projectBreaks = between.filter((row) => row.some((cell) => cell && cell.kind === 'projectBreak'));
    expect(invitationBreaks).toHaveLength(1);
    expect(projectBreaks).toHaveLength(1);
  });

  test('μακρύς τίτλος σε πρόσκληση χωρίς έργα δεν κλειδώνει σε μία κοντή γραμμή', () => {
    const longTitle = 'Πρόσκληση για την ολοκληρωμένη ανάπλαση κοινόχρηστων χώρων και την ενεργειακή αναβάθμιση σχολικών μονάδων στον Δήμο Αρχανών-Αστερουσίων';
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: longTitle,
        axis: 'Εκπαίδευση',
        fundingSource: 'ΕΣΠΑ 2021-2027',
        deadline: '2026-09-01',
        budgetRange: '50.000',
        linkedOrimanthiProposals: [],
      }],
      allProposals: [],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const rowIdx = findRowWith(model, longTitle);
    const heights = computeMixedRowHeights(model);
    expect(heights[rowIdx].hpt).toBeGreaterThan(28);
  });

  test('τα ενωμένα κελιά δεν φουσκώνουν μία γραμμή — ο χώρος υπάρχει ήδη', () => {
    const permitsProposal = {
      ...roadProposal,
      id: 'permits-1',
      notes: 'ΕΚΚΡΕΜΟΥΝ ΤΑ ΕΞΗΣ ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΠΡΙΝ ΤΗΝ ΥΠΟΒΟΛΗ ΤΟΥ ΦΑΚΕΛΟΥ',
      fileGroups: [
        { id: 'sp', fileCategoryRoot: 'meletes', fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ', files: [{ name: 'a.pdf' }] },
        { id: 'pa', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ', permitIssued: true, files: [] },
        { id: 'pb', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: true, files: [] },
        { id: 'pc', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ', permitIssued: false, files: [] },
      ],
    };
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: 'ΟΧΕ Εμβληματικών Διαδρομών Κρήτης / Περιβάλλον και Πολιτισμός',
        axis: 'Δράσεις Στοχευμένης Ολοκληρωμένης Χωρικής Επένδυσης (ΟΧΕ)',
        fundingSource: 'ΠΕΡΙΦΕΡΕΙΑ ΚΡΗΤΗΣ ΕΙΔΙΚΗ ΥΠΗΡΕΣΙΑ ΔΙΑΧΕΙΡΙΣΗΣ ΠΡΟΓΡΑΜΜΑΤΟΣ «ΚΡΗΤΗ»',
        deadline: '2026-09-30',
        budgetRange: 'ΕΛΑΧΙΣΤΟΣ Π/Υ 200.000,00€',
        linkedOrimanthiProposals: [{ id: 'permits-1' }],
      }],
      allProposals: [permitsProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    const heights = computeMixedRowHeights(model);
    const notesRow = findRowWith(model, 'ΕΚΚΡΕΜΟΥΝ ΤΑ ΕΞΗΣ');
    expect(notesRow).toBeGreaterThan(-1);
    expect(heights[notesRow].hpt).toBeLessThanOrEqual(32);
    heights.forEach((h) => expect(h.hpt).toBeLessThanOrEqual(40));
  });

  test('οι 4 πρώτες γραμμές είναι σταθερές και όλα τα κελιά στο κέντρο', async () => {
    const dest = path.join(os.tmpdir(), `psk-orimanthi-center-${Date.now()}.xlsx`);
    const model = buildMixedProsklisiOrimanthiModel({
      invitations: [{
        title: 'Πρόσκληση σχολείων',
        axis: 'Εκπαίδευση',
        fundingSource: 'ΕΣΠΑ',
        deadline: '2026-08-20',
        budgetRange: '100.000',
        linkedOrimanthiProposals: [{ id: 'road-1' }],
      }],
      allProposals: [roadProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
    });
    expect(model.freezeRows).toBe(4);
    expect(countValue(model, 'Α/Α έργου')).toBe(1);
    expect(rowHasValue(model.rows[2], 'ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ')).toBe(true);
    expect(rowHasValue(model.rows[2], 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ')).toBe(true);
    expect(rowHasValue(model.rows[3], 'Α/Α έργου')).toBe(true);

    await writeMixedWorkbook({
      invitations: [{
        title: 'Πρόσκληση σχολείων',
        axis: 'Εκπαίδευση',
        fundingSource: 'ΕΣΠΑ',
        deadline: '2026-08-20',
        budgetRange: '100.000',
        linkedOrimanthiProposals: [{ id: 'road-1' }],
      }],
      allProposals: [roadProposal],
      selectedFields: MIXED_CORE_FIELD_IDS,
      excelOptions,
      destFilePath: dest,
      exportedBy: 'Δοκιμή',
      exportedAt: '12/09/2026',
    });

    try {
      const wb = XLSX.readFile(dest, { cellStyles: true });
      expect(wb.SheetNames).toEqual(['Προσκλήσεις και ωρίμανση', 'Πληροφορίες']);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; R += 1) {
        for (let C = range.s.c; C <= range.e.c; C += 1) {
          const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (!cell || !cell.s || !cell.s.alignment) continue;
          expect(cell.s.alignment.horizontal).toBe('center');
          expect(cell.s.alignment.vertical).toBe('center');
        }
      }

      let JSZip;
      try {
        JSZip = require('jszip');
      } catch (_) {
        JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('exceljs'))] }));
      }
      const zip = await JSZip.loadAsync(fs.readFileSync(dest));
      const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
      expect(xml).toContain('ySplit="4"');
      expect(xml).toContain('topLeftCell="A5"');
      expect(xml).toContain('state="frozen"');
      expect(xml).not.toMatch(/xSplit=/);
      expect(xml).not.toMatch(/<pageSetup/);
    } finally {
      try { fs.unlinkSync(dest); } catch (_) { /* ignore */ }
    }
  });
});
