/**
 * @jest-environment node
 */
const parse = require('../../app/core/entaxiDiavgeiaParse');

const ARCHANES_SUBJECT =
  'Ένταξη της Πράξης «ΜΕΛΕΤΗ ΒΙΟΚΛΙΜΑΤΙΚΗΣ ΑΝΑΠΛΑΣΗΣ ΣΕ ΤΜΗΜΑΤΑ ΤΟΥ ΠΑΡΑΔΟΣΙΑΚΟΥ\n'
  + 'ΟΙΚΙΣΜΟΥ ΑΡΧΑΝΩΝ» με Κωδικό ΟΠΣ 5225302 στο «ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025»';

const ARCHANES_PDF = `
ΗΡΑΚΛΕΙΟ, 28/11/2024
Α.Π.: 423662
ΘΕΜΑ: Ένταξη της Πράξης «ΜΕΛΕΤΗ ΒΙΟΚΛΙΜΑΤΙΚΗΣ ΑΝΑΠΛΑΣΗΣ ΣΕ ΤΜΗΜΑΤΑ ΤΟΥ ΠΑΡΑΔΟΣΙΑΚΟΥ
ΟΙΚΙΣΜΟΥ ΑΡΧΑΝΩΝ» με Κωδικό ΟΠΣ 5225302 στο «ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025»
στον Άξονα Προτεραιότητας «Ολοκληρωμένη ανάπτυξη των αστικών, αγροτικών και παράκτιων περιοχών -στήριξη τοπικών πρωτοβουλιών»
| 1.Κωδικός Πράξης/MIS (ΟΠΣ): | | | | 5225302 | |
| 2.Δικαιούχος: | | | | ΔΗΜΟΣ ΑΡΧΑΝΩΝ | - ΑΣΤΕΡΟΥΣΙΩΝ |
| 3.Κωδικός Δικαιούχου: | | | | 40117222 | |
| 7. Η ημερομηνία έναρξης της Πράξης ορίζεται η 23/12/2024. | | | | | |
| 8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/12/2025. | | | | | |
| 10. Η ανάληψη της νομικής δέσμευσης όλων των υποέργων της πράξης πραγματοποιείται έως. 24/02/2025 | | | | | |
| ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ | (ΠΔΕ) 37.200,00 |
| ΙΔΙΩΤΙΚΗ ΣΥΜΜΕΤΟΧΗ και ΔΑΠΑΝΕΣ ΕΚΤΟΣ ΠΔΕ | 0,00 |
| ΣΥΝΟΛΙΚΟ ΚΟΣΤΟΣ ΠΡΑΞΗΣ 37.200,00 |
Η νομική δέσμευση των υποέργων αναλαμβάνεται εντός της προθεσμίας που ορίζει η Υπηρεσία Διαχείρισης
(ΥΔ) στην απόφαση ένταξης. Σε κάθε περίπτωση, η συνολική διάρκεια της προθεσμίας δεν υπερβαίνει τους
18μήνες από την αρχική ένταξη της πράξης.
`;

const STEREAS_SPLIT_NODE =
  '| 10. Η ανάληψη | της νομικής δέσμευσης όλων | των υποέργων | της πράξης πραγματοποιείται | | έως. 30/09/2026 | |';

const PDFJS_JOINED =
  '10. Η ανάληψη της νομικής δέσμευσης όλων των υποέργων της πράξης πραγματοποιείται έως. 24/02/2025 '
  + 'ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ (ΠΔΕ) 37.200,00';

describe('entaxiDiavgeiaParse', () => {
  it('διαβάζει ΟΠΣ, πρόγραμμα και τίτλο από το θέμα', () => {
    const s = parse.parseEntaxiSubject(ARCHANES_SUBJECT);
    expect(s.kind).toBe('new');
    expect(s.opsCode).toBe('5225302');
    expect(s.programme).toBe('ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025');
    expect(s.projectTitle).toContain('ΒΙΟΚΛΙΜΑΤΙΚΗΣ ΑΝΑΠΛΑΣΗΣ');
  });

  it('αναγνωρίζει τροποποίηση από το θέμα', () => {
    const subject = '1η Τροποποίηση της απόφασης ένταξης της πράξης «Έργο» με Κωδικό ΟΠΣ 5228279';
    expect(parse.subjectLooksLikeEntaxiModification(subject)).toBe(true);
    expect(parse.parseEntaxiSubject(subject).kind).toBe('modification');
    expect(parse.extractModificationDescriptionFromSubject(subject)).toBe(subject);
  });

  it('δεν κόβει τα σχόλια τροποποίησης στην τελεία συντομογραφίας Δ.Ε', () => {
    const subject =
      'Τροποποίηση της Πράξης «ΒΕΛΤΙΩΣΗ ΚΑΙ ΣΥΝΤΗΡΗΣΗ ΔΡΟΜΩΝ ΜΕΛΙΔΟΧΩΡΙΟΥ Δ.Ε Ν.ΚΑΖΑΝΤΖΑΚΗ»'
      + ' με Κωδικό ΟΠΣ 5221312 στο «ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025»';
    const desc = parse.extractModificationDescriptionFromSubject(subject);
    expect(desc).toBe(subject);
    expect(desc).toContain('Δ.Ε Ν.ΚΑΖΑΝΤΖΑΚΗ');
    expect(desc).toContain('5221312');
    expect(desc).not.toMatch(/ΜΕΛΙΔΟΧΩΡΙΟΥ Δ$/);

    const combined = parse.parseEntaxiDiavgeiaDocument({
      subject,
      pdfText: `ΘΕΜΑ: ${subject} ΑΠΟΦΑΣΗ Ο ΠΕΡΙΦΕΡΕΙΑΡΧΗΣ ΚΡΗΤΗΣ`,
    });
    expect(combined.kind).toBe('modification');
    expect(combined.modificationDescription).toBe(subject);
    expect(combined.subject).toBe(subject);
    expect(combined.pdfSubject).toBe(subject);
    expect(combined.subject).not.toMatch(/ΑΠΟΦΑΣΗ/);
    expect(combined.projectTitle).toContain('Δ.Ε Ν.ΚΑΖΑΝΤΖΑΚΗ');
  });

  it('βγάζει ΝοΔε, ποσό και ημερομηνίες από το πρότυπο ΟΠΣ', () => {
    const pdf = parse.parseEntaxiPdfText(ARCHANES_PDF);
    expect(pdf.legalCommitmentDeadline).toBe('2025-02-24');
    expect(pdf.initialAmount).toBe('37.200,00');
    expect(pdf.startDate).toBe('2024-12-23');
    expect(pdf.endDate).toBe('2025-12-31');
    expect(pdf.opsCode).toBe('5225302');
    expect(pdf.beneficiary).toMatch(/ΔΗΜΟΣ ΑΡΧΑΝΩΝ/);
    expect(pdf.axis).toContain('αστικών');
    expect(pdf.documentDate).toBe('2024-11-28');
  });

  it('ενώνει σπασμένο πίνακα PDF και βρίσκει τη ΝοΔε', () => {
    expect(parse.parseEntaxiPdfText(STEREAS_SPLIT_NODE).legalCommitmentDeadline).toBe('2026-09-30');
  });

  it('διαβάζει κείμενο όπως το βγάζει το pdfjs (κενά ανά λέξη)', () => {
    const pdf = parse.parseEntaxiPdfText(PDFJS_JOINED);
    expect(pdf.legalCommitmentDeadline).toBe('2025-02-24');
    expect(pdf.initialAmount).toBe('37.200,00');
  });

  it('δεν μαντεύει ημερομηνία από το παράρτημα των 18 μηνών', () => {
    const appendix = `
      Η νομική δέσμευση των υποέργων αναλαμβάνεται εντός της προθεσμίας που ορίζει η Υπηρεσία
      Διαχείρισης (ΥΔ) στην απόφαση ένταξης. η συνολική διάρκεια δεν υπερβαίνει τους 18μήνες.
    `;
    expect(parse.parseEntaxiPdfText(appendix).legalCommitmentDeadline).toBe('');
  });

  it('συνδυάζει θέμα και PDF χωρίς να εφεύρει ποσό', () => {
    const combined = parse.parseEntaxiDiavgeiaDocument({
      subject: ARCHANES_SUBJECT,
      pdfText: '',
    });
    expect(combined.opsCode).toBe('5225302');
    expect(combined.legalCommitmentDeadline).toBe('');
    expect(combined.initialAmount).toBe('');
    expect(combined.pdfFoundAny).toBe(false);
  });

  it('η ισχύουσα ΝοΔε ακολουθεί την τελευταία τροποποίηση', () => {
    expect(parse.getEffectiveEntaxiNodeDeadline({
      legalCommitmentDeadline: '2025-02-24',
      modifications: [
        { date: '2025-01-10', legalCommitmentDeadline: '' },
        { date: '2025-03-01', legalCommitmentDeadline: '2025-08-31' },
      ],
    })).toBe('2025-08-31');
    expect(parse.getEffectiveEntaxiNodeDeadline({
      legalCommitmentDeadline: '24/02/2025',
      modifications: [],
    })).toBe('2025-02-24');
    expect(parse.getEffectiveEntaxiNodeDeadline(null)).toBe('');
    expect(parse.getEffectiveEntaxiNodeDeadline({
      legalCommitmentDeadline: '2025-02-24',
      modifications: [
        { date: '15/06/2025', legalCommitmentDeadline: '30/09/2025' },
        { date: '2025-04-01', legalCommitmentDeadline: '2025-05-01' },
      ],
    })).toBe('2025-09-30');
  });

  it('διαβάζει ΝοΔε και με «έως την»', () => {
    const pdf = parse.parseEntaxiPdfText(
      'Η ανάληψη της νομικής δέσμευσης όλων των υποέργων της πράξης πραγματοποιείται έως την 15/03/2026'
    );
    expect(pdf.legalCommitmentDeadline).toBe('2026-03-15');
  });

  it('αναγνωρίζει έγγραφο 2021-2027 χωρίς ημερομηνία ΝοΔε', () => {
    const pdf = parse.parseEntaxiPdfText(`
      Κωδικός ΟΠΣ: 6054527
      3.Δικαιούχος: ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ
      4.Κωδικός Δικαιούχου: 40117222
      7. Η ημερομηνία έναρξης της Πράξης ορίζεται η 01/10/2026.
      8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/12/2029.
      Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων.
      ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ 243.188,80
    `);
    expect(pdf.legalCommitmentDeadline).toBe('');
    expect(pdf.noObligationDeadline).toBe(true);
    expect(pdf.opsCode).toBe('6054527');
    expect(pdf.beneficiary).toMatch(/ΔΗΜΟΣ ΑΡΧΑΝΩΝ/);
    expect(pdf.startDate).toBe('2026-10-01');
    expect(pdf.initialAmount).toBe('243.188,80');

    const combined = parse.parseEntaxiDiavgeiaDocument({
      subject: 'Ένταξη της Πράξης «ΚΕΝΤΡΟ» με Κωδικό ΟΠΣ 6049810 στο Πρόγραμμα «Κρήτη 2021-2027»',
      pdfText: 'Κωδικός ΟΠΣ: 6054527 Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων.',
    });
    expect(combined.opsMismatch).toBe(true);
    expect(combined.subjectOpsCode).toBe('6049810');
    expect(combined.pdfOpsCode).toBe('6054527');
    expect(combined.legalCommitmentStatus).toBe('explicitly_absent');
    expect(combined.legalCommitmentDeadline).toBe('');
  });

  it('διαβάζει λήξη πράξης από το χρονοδιάγραμμα ακόμα και χωρίς ΝοΔε', () => {
    const pdf = parse.parseEntaxiPdfText(`
      7. Η ημερομηνία έναρξης της Πράξης ορίζεται η 01/06/2026.
      8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/08/2029.
      Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων.
      ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ 278.102,20
    `);
    expect(pdf.startDate).toBe('2026-06-01');
    expect(pdf.endDate).toBe('2029-08-31');
    expect(pdf.legalCommitmentDeadline).toBe('');
    expect(pdf.noObligationDeadline).toBe(true);
    expect(pdf.initialAmount).toBe('278.102,20');
  });

  it('η ισχύουσα λήξη πράξης ακολουθεί την τελευταία τροποποίηση', () => {
    expect(parse.getEffectiveEntaxiEndDate({
      endDate: '2029-08-31',
      modifications: [
        { date: '2027-01-10', endDate: '2030-12-31' },
      ],
    })).toBe('2030-12-31');
    expect(parse.getEffectiveEntaxiEndDate({ endDate: '31/08/2029' })).toBe('2029-08-31');
    expect(parse.getEffectiveEntaxiEndDate(null)).toBe('');
  });

  it('παίρνει το θέμα από το ΘΕΜΑ του αρχείου, όχι από την κάρτα Διαύγειας', () => {
    const combined = parse.parseEntaxiDiavgeiaDocument({
      subject: 'Ένταξη της Πράξης «ΚΕΝΤΡΟ ΕΝΗΜΕΡΩΣΗΣ ΚΑΠΕΤΑΝΙΑΝΑ» με Κωδικό ΟΠΣ 6049810 στο Πρόγραμμα «Κρήτη 2021-2027»',
      pdfText: 'ΘΕΜΑ: Ένταξη της Πράξης «ΔΗΜΙΟΥΡΓΙΑ ΔΙΚΤΥΟΥ ΣΗΜΑΤΟΔΟΤΗΜΕΝΩΝ ΠΟΔΗΛΑΤΙΚΩΝ ΔΙΑΔΡΟΜΩΝ ΣΤΑ ΑΣΤΕΡΟΥΣΙΑ ΟΡΗ» με Κωδικό ΟΠΣ 6054527 στο Πρόγραμμα «Κρήτη 2021-2027» ΑΠΟΦΑΣΗ Ο ΠΕΡΙΦΕΡΕΙΑΡΧΗΣ ΚΡΗΤΗΣ',
    });
    expect(combined.subject).toMatch(/ΠΟΔΗΛΑΤΙΚΩΝ ΔΙΑΔΡΟΜΩΝ/);
    expect(combined.subject).not.toMatch(/ΚΕΝΤΡΟ ΕΝΗΜΕΡΩΣΗΣ/);
    expect(combined.subject).not.toMatch(/ΑΠΟΦΑΣΗ/);
    expect(combined.subjectMismatch).toBe(true);
    expect(combined.pdfOpsCode).toBe('6054527');
  });
});
