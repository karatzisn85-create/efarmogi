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
    expect(p.khmdhsRequestAdam).toBe('');
    expect(p.importedViaExcel).toBe(true);
  });

  test('το πρότυπο δεν έχει μορφή υλοποίησης ούτε ΑΔΑΜ σύμβασης, έχει πρωτογενές', () => {
    expect(m.COLUMN_KEYS).not.toContain('implementationForm');
    expect(m.COLUMN_KEYS).not.toContain('khmdhsAdam');
    expect(m.COLUMN_KEYS).toContain('khmdhsRequestAdam');
    expect(m.COLUMNS.some((c) => /Μορφή/i.test(c.header))).toBe(false);
    const adamCol = m.COLUMNS.find((c) => c.key === 'khmdhsRequestAdam');
    expect(adamCol.header).toMatch(/πρωτογενούς/);
    expect(adamCol.required).toBe(false);
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

describe('subprojectExcelImport — ΑΔΑΜ πρωτογενούς', () => {
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

  const withContract = {
    ...baseValid,
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    khmdhsRequestAdam: '26REQ018492003',
  };

  test('εκτός ωρίμανσης χωρίς πρωτογενές απορρίπτεται', async () => {
    const buf = await templateWithRows([{ ...withContract, khmdhsRequestAdam: '' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/υποχρεωτικός/);
  });

  test('ωρίμανση με πρωτογενές απορρίπτεται', async () => {
    const buf = await templateWithRows([{ ...baseValid, khmdhsRequestAdam: '26REQ018492003' }]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/ωρίμανση/);
  });

  test('κωδικός σύμβασης, δημοσίευσης ή ανάθεσης δεν γίνεται δεκτός', async () => {
    const cases = [
      ['26SYMV018523441', /σύμβασης/],
      ['26PROC018492003', /δημοσίευσης/],
      ['26AWRD018492003', /ανάθεσης/],
      ['26PAY018492003', /πληρωμής/],
      ['26RFQ018492003', /δεν αναγνωρίζεται/],
      ['ΑΔΑΜ-λάθος', /δεν αναγνωρίζεται/],
    ];
    for (const [code, pattern] of cases) {
      const buf = await templateWithRows([{ ...withContract, khmdhsRequestAdam: code }]);
      const parsed = await m.parseImportWorkbookBuffer(buf);
      const res = m.validateAllRows(parsed.rows);
      expect(res.validRows).toHaveLength(0);
      expect(res.errors[0].messages.join(' ')).toMatch(pattern);
    }
  });

  test('πρωτογενές με κενά, πεζά ή παύλα αποθηκεύεται ως REQ και όχι ως σύμβαση', async () => {
    for (const typed of ['26 req 018492003', '26-REQ-018492003']) {
      const buf = await templateWithRows([{ ...withContract, khmdhsRequestAdam: typed }]);
      const parsed = await m.parseImportWorkbookBuffer(buf);
      const res = m.validateAllRows(parsed.rows);
      expect(res.errors).toHaveLength(0);
      const p = res.validRows[0].project;
      expect(p.khmdhsRequestAdam).toBe('26REQ018492003');
      expect(p.khmdhsAdam).toBe('');
      expect(p.implementationForm).toBe('');
    }
  });

  test('ο ίδιος κωδικός σε δύο γραμμές απορρίπτει τη δεύτερη', async () => {
    const buf = await templateWithRows([
      withContract,
      { ...withContract, subprojectTitle: 'Δεύτερο υποέργο της πράξης' },
    ]);
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].messages.join(' ')).toMatch(/ίδιος κωδικός/);
  });

  test('χωρίς την κεφαλίδα του πρωτογενούς δεν διαβάζεται διπλανό κελί', async () => {
    const wb = m.buildTemplateWorkbook(ExcelJS);
    const ws = wb.getWorksheet(m.SHEET_DATA);
    const col = m.COLUMN_KEYS.indexOf('khmdhsRequestAdam') + 1;
    ws.getRow(1).getCell(col).value = 'Σημειώσεις υπαλλήλου';
    const row = {
      ...withContract,
    };
    m.COLUMN_KEYS.forEach((key, i) => {
      if (key === 'khmdhsRequestAdam') return;
      if (row[key] != null && row[key] !== '') ws.getRow(2).getCell(i + 1).value = row[key];
    });
    ws.getRow(2).getCell(col).value = '26REQ018492003';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await m.parseImportWorkbookBuffer(buf);
    const res = m.validateAllRows(parsed.rows);
    expect(res.validRows).toHaveLength(0);
    expect(res.errors[0].messages.join(' ')).toMatch(/υποχρεωτικός/);
  });

  test('πρωτογενές που ανήκει σε άλλη κάρτα σημειώνεται, το ίδιο στην ίδια κάρτα όχι ως ξένο', () => {
    const row = {
      excelRow: 5,
      dupKey: `${m.normalizeTitleKey('Έργο Α')}|||${m.normalizeTitleKey('Υποέργο Α')}`,
      project: { khmdhsRequestAdam: '26REQ018492003' },
    };
    const other = m.collectRequestAdamOwnerConflicts([row], [{
      projectTitle: 'Άλλο έργο',
      subprojectTitle: 'Άλλο υποέργο',
      khmdhsRequestAdam: '26 req 018492003',
    }]);
    expect(other).toHaveLength(1);
    expect(other[0].sameCard).toBe(false);
    expect(other[0].adam).toBe('26REQ018492003');

    const same = m.collectRequestAdamOwnerConflicts([row], [{
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο Α',
      khmdhsRequestAdam: '26REQ018492003',
    }]);
    expect(same).toHaveLength(1);
    expect(same[0].sameCard).toBe(true);
  });

  test('ενημέρωση κρατά χρέωση και σύμβαση όταν το πρωτογενές είναι το ίδιο', () => {
    const existing = {
      projectTitle: 'Παλιός τίτλος',
      subprojectTitle: 'Παλιό υποέργο',
      implementationForm: 'Μια Σύμβαση',
      supervisorEngineerIds: ['eng-1'],
      comments: 'παλιό σχόλιο',
      khmdhsRequestAdam: '26REQ018492003',
      khmdhsRequestSnapshot: { referenceNumber: '26REQ018492003', title: 'αίτημα' },
      khmdhsAdam: '24SYMV000000001',
      khmdhsPayments: [{ adam: '24PAY000000001' }],
    };
    const excel = {
      projectTitle: 'Νέος τίτλος',
      subprojectTitle: 'Νέο υποέργο',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      comments: '',
      khmdhsRequestAdam: '26REQ018492003',
      khmdhsAdam: '',
      implementationForm: '',
      supervisorEngineerIds: [],
      contracts: [],
      importedViaExcel: true,
    };
    const next = m.applyExcelUpdateOntoExisting(excel, existing);
    expect(next.projectTitle).toBe('Νέος τίτλος');
    expect(next.comments).toBe('');
    expect(next.supervisorEngineerIds).toEqual(['eng-1']);
    expect(next.implementationForm).toBe('Μια Σύμβαση');
    expect(next.khmdhsAdam).toBe('24SYMV000000001');
    expect(next.khmdhsPayments).toHaveLength(1);
    expect(next.khmdhsRequestSnapshot.referenceNumber).toBe('26REQ018492003');
  });

  test('ενημέρωση με άλλο πρωτογενές δεν κρατά την παλιά αλυσίδα', () => {
    const existing = {
      implementationForm: 'Μια Σύμβαση',
      supervisorEngineerIds: ['eng-1'],
      khmdhsRequestAdam: '24REQ000000001',
      khmdhsRequestSnapshot: { referenceNumber: '24REQ000000001' },
      khmdhsAdam: '24SYMV000000001',
      khmdhsPayments: [{ adam: '24PAY000000001' }],
    };
    const excel = {
      projectTitle: 'Νέος τίτλος',
      khmdhsRequestAdam: '26REQ018492003',
      importedViaExcel: true,
      comments: 'νέο',
    };
    const next = m.applyExcelUpdateOntoExisting(excel, existing);
    expect(next.khmdhsRequestAdam).toBe('26REQ018492003');
    expect(next.khmdhsAdam).toBe('');
    expect(next.khmdhsRequestSnapshot).toBeNull();
    expect(next.khmdhsPayments).toEqual([]);
    expect(next.implementationForm).toBe('Μια Σύμβαση');
    expect(next.supervisorEngineerIds).toEqual(['eng-1']);
    expect(next.comments).toBe('νέο');
  });
});
