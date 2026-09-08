/**
 * @jest-environment node
 */
import {
  mapDiavgeiaDecisionToEntaxiFields,
  buildEntaxiDiavgeiaMeta,
  buildDefaultEntaxiPdfFileName,
  mergeDiavgeiaFormFields,
} from './entaxiDiavgeiaFetch';

const parse = require('../../app/core/entaxiDiavgeiaParse');

const decision = {
  ada: 'ΨΩΚΖ7ΛΚ-8ΦΤ',
  protocolNumber: '423662',
  subject: 'Ένταξη της Πράξης «ΜΕΛΕΤΗ ΒΙΟΚΛΙΜΑΤΙΚΗΣ ΑΝΑΠΛΑΣΗΣ ΣΕ ΤΜΗΜΑΤΑ ΤΟΥ ΠΑΡΑΔΟΣΙΑΚΟΥ ΟΙΚΙΣΜΟΥ ΑΡΧΑΝΩΝ» με Κωδικό ΟΠΣ 5225302 στο «ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025»',
  issueDate: '2024-11-28',
  organization: 'ΠΕΡΙΦΕΡΕΙΑ ΚΡΗΤΗΣ',
  documentUrl: 'https://diavgeia.gov.gr/doc/ΨΩΚΖ7ΛΚ-8ΦΤ',
};

describe('entaxiDiavgeiaFetch', () => {
  it('γεμίζει τα βασικά από Διαύγεια χωρίς να εφεύρει ποσό ή ΝοΔε', () => {
    const { fields, autoFilledKeys, missingFromPdf } = mapDiavgeiaDecisionToEntaxiFields(decision, {}, 'new');
    expect(fields.documentDate).toBe('2024-11-28');
    expect(fields.fundingAuthority).toBe('ΠΕΡΙΦΕΡΕΙΑ ΚΡΗΤΗΣ');
    expect(fields.subject).toContain('5225302');
    expect(fields.opsCode).toBe('5225302');
    expect(fields.initialAmount).toBeUndefined();
    expect(fields.legalCommitmentDeadline).toBeUndefined();
    expect(autoFilledKeys).toContain('documentDate');
    expect(missingFromPdf).toContain('Προθεσμία ΝοΔε');
    expect(missingFromPdf).toContain('Ποσό χρηματοδότησης');
    expect(missingFromPdf).toContain('Λήξη πράξης');
  });

  it('εφαρμόζει τα πεδία που βγήκαν από το έγγραφο', () => {
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: decision.subject,
      pdfText: '10. Η ανάληψη της νομικής δέσμευσης όλων των υποέργων της πράξης πραγματοποιείται έως. 24/02/2025 ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ (ΠΔΕ) 37.200,00 7. Η ημερομηνία έναρξης της Πράξης ορίζεται η 23/12/2024. 8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/12/2025.',
    });
    const { fields, missingFromPdf } = mapDiavgeiaDecisionToEntaxiFields(decision, extracted, 'new');
    expect(fields.legalCommitmentDeadline).toBe('2025-02-24');
    expect(fields.initialAmount).toBe('37.200,00');
    expect(fields.startDate).toBe('2024-12-23');
    expect(fields.endDate).toBe('2025-12-31');
    expect(missingFromPdf).toEqual([]);
  });

  it('στην τροποποίηση δεν αλλάζει θέμα/φορέα της ένταξης', () => {
    const modDecision = {
      ...decision,
      ada: 'Ω7ΕΖ465ΧΘ7-1ΝΕ',
      subject: '1η Τροποποίηση της απόφασης ένταξης της πράξης «Μελέτη» με Κωδικό ΟΠΣ 5225302',
      issueDate: '2025-03-01',
    };
    const { fields } = mapDiavgeiaDecisionToEntaxiFields(modDecision, {}, 'modification');
    expect(fields.date).toBe('2025-03-01');
    expect(fields.comments).toBe(modDecision.subject);
    expect(fields.subject).toBeUndefined();
    expect(fields.fundingAuthority).toBeUndefined();
  });

  it('στην τροποποίηση δεν εμφανίζει ως έλλειψη τη λήξη αν το έγγραφο δεν την αλλάζει', () => {
    const modDecision = {
      ...decision,
      subject: '1η Τροποποίηση της απόφασης ένταξης της πράξης «Μελέτη» με Κωδικό ΟΠΣ 5225302',
    };
    const { fields, missingFromPdf } = mapDiavgeiaDecisionToEntaxiFields(modDecision, {}, 'modification');
    expect(fields.endDate).toBeUndefined();
    expect(missingFromPdf.some((m) => /Λήξη πράξης/.test(m))).toBe(false);
  });

  it('στα σχόλια τροποποίησης κρατά ολόκληρο το θέμα, ακόμα και με Δ.Ε.', () => {
    const modDecision = {
      ...decision,
      ada: 'Ψ84Ρ7ΛΚ-ΑΨΝ',
      subject:
        'Τροποποίηση της Πράξης «ΒΕΛΤΙΩΣΗ ΚΑΙ ΣΥΝΤΗΡΗΣΗ ΔΡΟΜΩΝ ΜΕΛΙΔΟΧΩΡΙΟΥ Δ.Ε Ν.ΚΑΖΑΝΤΖΑΚΗ»'
        + ' με Κωδικό ΟΠΣ 5221312 στο «ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025»',
      issueDate: '2025-08-08',
    };
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: modDecision.subject,
      pdfText: `ΘΕΜΑ: ${modDecision.subject} ΑΠΟΦΑΣΗ Ο ΠΕΡΙΦΕΡΕΙΑΡΧΗΣ ΚΡΗΤΗΣ`,
    });
    const { fields } = mapDiavgeiaDecisionToEntaxiFields(modDecision, extracted, 'modification');
    expect(fields.comments).toBe(modDecision.subject);
    expect(fields.comments).toContain('Δ.Ε Ν.ΚΑΖΑΝΤΖΑΚΗ');
    expect(fields.comments).toContain('ΠΠΑ ΠΕΡΙΦΕΡΕΙΑΣ ΚΡΗΤΗΣ 2021-2025');
    expect(fields.comments).not.toMatch(/ΑΠΟΦΑΣΗ/);
  });

  it('γεμίζει λήξη πράξης από το χρονοδιάγραμμα του εγγράφου', () => {
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: 'Ένταξη της Πράξης «Προμήθεια μέσου μεταφοράς ΚΗΦΗ» με Κωδικό ΟΠΣ 6000001',
      pdfText: '7. Η ημερομηνία έναρξης της Πράξης ορίζεται η 01/06/2026. 8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/08/2029. Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων. ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ 278.102,20',
    });
    const { fields, missingFromPdf } = mapDiavgeiaDecisionToEntaxiFields(decision, extracted, 'new');
    expect(fields.endDate).toBe('2029-08-31');
    expect(fields.startDate).toBe('2026-06-01');
    expect(fields.initialAmount).toBe('278.102,20');
    expect(fields.legalCommitmentDeadline).toBeUndefined();
    expect(missingFromPdf.some((m) => /ΝοΔε/.test(m))).toBe(true);
    expect(missingFromPdf.some((m) => /Λήξη πράξης/.test(m))).toBe(false);
  });

  it('δεν εφευρίσκει ΝοΔε όταν το έγγραφο λέει ότι δεν υπάρχει', () => {
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: 'Ένταξη της Πράξης «ΚΕΝΤΡΟ» με Κωδικό ΟΠΣ 6049810 στο Πρόγραμμα «Κρήτη 2021-2027»',
      pdfText: 'Κωδικός ΟΠΣ: 6054527 Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων. ΣΥΝΟΛΙΚΗ ΔΗΜΟΣΙΑ ΔΑΠΑΝΗ 243.188,80',
    });
    const { fields, missingFromPdf } = mapDiavgeiaDecisionToEntaxiFields(decision, extracted, 'new');
    expect(fields.legalCommitmentDeadline).toBeUndefined();
    expect(fields.opsCode).toBe('6054527');
    expect(missingFromPdf.some((m) => /ΝοΔε/.test(m))).toBe(true);
    expect(extracted.opsMismatch).toBe(true);
  });

  it('γεμίζει θέμα από το αρχείο όταν διαφέρει από την ανάρτηση', () => {
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: decision.subject,
      pdfText: 'ΘΕΜΑ: Ένταξη της Πράξης «ΔΙΚΤΥΟ ΠΟΔΗΛΑΤΙΚΩΝ ΔΙΑΔΡΟΜΩΝ» με Κωδικό ΟΠΣ 6054527 στο Πρόγραμμα «Κρήτη 2021-2027» ΑΠΟΦΑΣΗ Ο ΠΕΡΙΦΕΡΕΙΑΡΧΗΣ',
    });
    const { fields } = mapDiavgeiaDecisionToEntaxiFields(decision, extracted, 'new');
    expect(fields.subject).toMatch(/ΔΙΚΤΥΟ ΠΟΔΗΛΑΤΙΚΩΝ/);
    expect(fields.opsCode).toBe('6054527');
  });

  it('κρατά meta με τα εξαγόμενα για αποθήκευση', () => {
    const mapped = mapDiavgeiaDecisionToEntaxiFields(decision, {
      opsCode: '5225302',
      legalCommitmentDeadline: '2025-02-24',
    }, 'new');
    const meta = buildEntaxiDiavgeiaMeta(mapped.preview, mapped.parsed);
    expect(meta.ada).toBe('ΨΩΚΖ7ΛΚ-8ΦΤ');
    expect(meta.extracted.opsCode).toBe('5225302');
    expect(meta.documentUrl).toContain('/decision/view/');
    expect(meta.documentUrl).not.toContain('/doc/');
    expect(buildDefaultEntaxiPdfFileName('ψωκζ7λκ-8φτ')).toContain('ΨΩΚΖ7ΛΚ-8ΦΤ');
  });

  it('στην τροποποίηση περνάει και τη λήξη πράξης', () => {
    const extracted = parse.parseEntaxiDiavgeiaDocument({
      subject: 'Τροποποίηση της Πράξης «ΚΗΦΗ» με Κωδικό ΟΠΣ 6000001',
      pdfText: '8. Η ημερομηνία λήξης της Πράξης ορίζεται η 31/08/2029. Δεν υπάρχει προθεσμία ανάληψης υποχρέωσης Κρίσιμων Υποέργων.',
    });
    const { fields } = mapDiavgeiaDecisionToEntaxiFields({
      ...decision,
      subject: 'Τροποποίηση της Πράξης «ΚΗΦΗ» με Κωδικό ΟΠΣ 6000001',
    }, extracted, 'modification');
    expect(fields.endDate).toBe('2029-08-31');
    expect(fields.subject).toBeUndefined();
    expect(fields.fundingAuthority).toBeUndefined();
  });

  it('νέα ανάκτηση χωρίς ΝοΔε καθαρίζει την παλιά ημερομηνία', () => {
    const merged = mergeDiavgeiaFormFields(
      { legalCommitmentDeadline: '2025-02-24', endDate: '2025-12-31', opsCode: '1' },
      { endDate: '2029-08-31', opsCode: '2' },
      ['legalCommitmentDeadline', 'endDate', 'opsCode'],
      { noObligationDeadline: true }
    );
    expect(merged.legalCommitmentDeadline).toBe('');
    expect(merged.endDate).toBe('2029-08-31');
    expect(merged.opsCode).toBe('2');
  });

  it('νέα ανάκτηση χωρίς νέο ποσό ξετσεκάρει την αλλαγή ποσού', () => {
    const merged = mergeDiavgeiaFormFields(
      { changeAmount: true, amount: '72.845,10', comments: 'παλιό' },
      { comments: 'νέο σχόλιο' },
      ['changeAmount', 'amount', 'comments'],
      {}
    );
    expect(merged.changeAmount).toBe(false);
    expect(merged.amount).toBe('');
    expect(merged.comments).toBe('νέο σχόλιο');
  });
});
