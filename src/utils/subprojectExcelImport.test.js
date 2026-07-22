/**
 * Tests για το module μαζικής εισαγωγής υποέργων (public/subprojectExcelImport.js).
 * @jest-environment node
 */
const ExcelJS = require('exceljs');
const m = require('../../public/subprojectExcelImport');

describe('subprojectExcelImport — helpers', () => {
  test('sanitizeCellText αφαιρεί αόρατους χαρακτήρες, NBSP και αλλαγές γραμμής', () => {
    expect(m.sanitizeCellText('\uFEFFΑνάπλαση\u200B  πλατείας\n')).toBe('Ανάπλαση πλατείας');
    expect(m.sanitizeCellText('Α\u00A0Β')).toBe('Α Β');
    expect(m.sanitizeCellText('γραμμή1\r\nγραμμή2')).toBe('γραμμή1 γραμμή2');
    expect(m.sanitizeCellText(null)).toBe('');
  });

  test('amountToNumber δέχεται ελληνική και διεθνή μορφή', () => {
    expect(m.amountToNumber('25.125,23')).toBeCloseTo(25125.23, 2);
    expect(m.amountToNumber('1.000,00')).toBeCloseTo(1000, 2);
    expect(m.amountToNumber('25125.23')).toBeCloseTo(25125.23, 2);
    expect(m.amountToNumber(1500)).toBeCloseTo(1500, 2);
    expect(Number.isNaN(m.amountToNumber('abc'))).toBe(true);
  });

  test('formatAmountGr παράγει μορφή 25.125,23', () => {
    expect(m.formatAmountGr(25125.23)).toBe('25.125,23');
    expect(m.formatAmountGr(1000)).toBe('1.000,00');
    expect(m.formatAmountGr(0)).toBe('0,00');
  });

  test('splitAleCodes διασπά με / και ανοχή σε κενά', () => {
    expect(m.splitAleCodes('02.15.6262 / 02.30.7331')).toEqual(['02.15.6262', '02.30.7331']);
    expect(m.splitAleCodes('02.15.6262/02.30.7331')).toEqual(['02.15.6262', '02.30.7331']);
    expect(m.splitAleCodes('02.15.6262/ 02.30.7331')).toEqual(['02.15.6262', '02.30.7331']);
    expect(m.splitAleCodes('  ')).toEqual([]);
  });

  test('normalizeTitleKey είναι ανθεκτικό σε κεφαλαία/κενά για ομαδοποίηση', () => {
    expect(m.normalizeTitleKey('Ανάπλαση  Πλατείας')).toBe(m.normalizeTitleKey('ανάπλαση πλατείας'));
  });

  test('οι εξαιρούμενες καταστάσεις δεν περιλαμβάνονται στις επιτρεπτές', () => {
    expect(m.ALLOWED_STATUSES).not.toContain('ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ');
    expect(m.ALLOWED_STATUSES).toContain('ΟΛΟΚΛΗΡΩΜΕΝΟ');
  });
});

describe('subprojectExcelImport — template & parse', () => {
  test('το πρότυπο περιέχει τα απαραίτητα φύλλα και είναι αναγνωρίσιμο', async () => {
    const wb = m.buildTemplateWorkbook(ExcelJS);
    expect(wb.getWorksheet(m.SHEET_DATA)).toBeTruthy();
    expect(wb.getWorksheet(m.SHEET_INFO)).toBeTruthy();
    const buf = await wb.xlsx.writeBuffer();
    const parsed = await m.parseImportWorkbookBuffer(Buffer.from(buf));
    expect(parsed.versionOk).toBe(true);
    expect(parsed.parseErrors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(0);
  });

  test('το πρότυπο δέχεται live funding enums (custom πηγές)', async () => {
    const customEnums = {
      FUNDING_SOURCES: ['ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ', 'ΝΕΑ ΠΗΓΗ ΔΟΚΙΜΗΣ'],
      FUNDING_DETAILS: {
        'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ': ['Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού'],
        'ΝΕΑ ΠΗΓΗ ΔΟΚΙΜΗΣ': ['ΝΔ01. Εξειδίκευση δοκιμής'],
      },
    };
    const wb = m.buildTemplateWorkbook(ExcelJS, { fundingEnums: customEnums });
    const lists = wb.getWorksheet(m.SHEET_LISTS);
    const values = [];
    lists.getColumn(1).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber > 1) values.push(cell.value);
    });
    expect(values).toContain('ΝΕΑ ΠΗΓΗ ΔΟΚΙΜΗΣ');
    expect(values).not.toContain('ΕΣΠΑ 2021_2027');
  });
});

/** Βοηθός: γράφει γραμμές στο πρότυπο και επιστρέφει buffer. */
async function templateWithRows(rows) {
  const wb = m.buildTemplateWorkbook(ExcelJS);
  const ws = wb.getWorksheet(m.SHEET_DATA);
  const keys = m.COLUMN_KEYS;
  rows.forEach((row, idx) => {
    const r = ws.getRow(idx + 2);
    Object.entries(row).forEach(([key, val]) => {
      const i = keys.indexOf(key);
      if (i >= 0) r.getCell(i + 1).value = val;
    });
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('subprojectExcelImport — validation & mapping', () => {
  const baseValid = {
    projectTitle: 'Ανάπλαση πλατείας κέντρου',
    subprojectTitle: 'Κατασκευή έργου ανάπλασης',
    projectType: 'ΕΡΓΟ',
    projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
    aleCodes: '02.15.6262',
    coFinanced: 'Όχι',
    fundingSource1: 'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ',
    fundingDetails1: 'Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού',
    amount1: '25.125,23',
  };

  test('έγκυρη γραμμή παράγει σωστό αντικείμενο υποέργου χωρίς ids', async () => {
    const buf = await templateWithRows([baseValid]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.errors).toHaveLength(0);
    expect(res.validRows).toHaveLength(1);
    const p = res.validRows[0].project;
    expect(p.projectId).toBeUndefined();
    expect(p.subprojectId).toBeUndefined();
    expect(p.approvedAmount).toBe('25.125,23');
    expect(p.aleCodes).toEqual(['02.15.6262']);
    expect(p.kaCode).toBe('');
    expect(p.implementationForm).toBe('');
    expect(p.khmdhsAdam).toBe('');
    expect(p.importedViaExcel).toBe(true);
  });

  test('το πρότυπο δεν περιλαμβάνει στήλες Μορφής Υλοποίησης ή ΑΔΑΜ', () => {
    expect(m.COLUMN_KEYS).not.toContain('implementationForm');
    expect(m.COLUMN_KEYS).not.toContain('khmdhsAdam');
    expect(m.COLUMNS.some((c) => /Μορφή|ΑΔΑΜ/i.test(c.header))).toBe(false);
  });

  test('κενό βασικό πεδίο (Είδος) δίνει λάθος', async () => {
    const buf = await templateWithRows([{ ...baseValid, projectType: '' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].messages.join(' ')).toMatch(/Είδος/);
  });

  test('κενό ποσό (με έγκυρα τα βασικά πεδία) δίνει λάθος ποσού', async () => {
    const buf = await templateWithRows([{ ...baseValid, amount1: '' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/Ποσό/);
  });

  test('εξαιρούμενη κατάσταση απορρίπτεται με σαφές μήνυμα', async () => {
    const buf = await templateWithRows([{ ...baseValid, projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/δεν εισάγεται/);
  });

  test('εξειδίκευση που δεν ανήκει στην πηγή απορρίπτεται', async () => {
    const buf = await templateWithRows([{
      ...baseValid,
      fundingDetails1: '0301. ΠΥΡΚΑΓΙΕΣ: Πρόληψη και αντιμετώπιση ζημιών και καταστροφών από πυρκαγιές.',
    }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.errors[0].messages.join(' ')).toMatch(/Εξειδίκευση/);
  });

  test('συγχρηματοδότηση: εγκεκριμένο = άθροισμα εκτός ιδίων πόρων', async () => {
    const buf = await templateWithRows([{
      ...baseValid,
      subprojectTitle: 'Προμήθεια εξοπλισμού',
      coFinanced: 'Ναι',
      amount1: '10.000,00',
      fundingSource2: 'ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ',
      fundingDetails2: '1099. ΙΔΙΟΙ ΠΟΡΟΙ',
      amount2: '5.000,00',
    }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.errors).toHaveLength(0);
    const p = res.validRows[0].project;
    expect(p.coFinanced).toBe(true);
    expect(p.approvedAmount).toBe('10.000,00');
    expect(p.fundingSources).toHaveLength(2);
  });

  test('συγχρηματοδότηση με μία μόνο πηγή απορρίπτεται', async () => {
    const buf = await templateWithRows([{ ...baseValid, coFinanced: 'Ναι' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/2 πηγές/);
  });

  test('διπλότυπο μέσα στο αρχείο εντοπίζεται', async () => {
    const buf = await templateWithRows([
      baseValid,
      { ...baseValid },
    ]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].messages.join(' ')).toMatch(/Διπλότυπο μέσα στο αρχείο/);
  });

  test('υποέργα ίδιας πράξης παράγουν ίδιο κλειδί πράξης για ομαδοποίηση', async () => {
    const buf = await templateWithRows([
      baseValid,
      { ...baseValid, subprojectTitle: 'Δεύτερο υποέργο' },
    ]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(2);
    const [a, b] = res.validRows;
    expect(a.dupKey.split('|||')[0]).toBe(b.dupKey.split('|||')[0]);
    expect(a.dupKey).not.toBe(b.dupKey);
  });
});
