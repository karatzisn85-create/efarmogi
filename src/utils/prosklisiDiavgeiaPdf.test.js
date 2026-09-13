/**
 * @jest-environment node
 */
const pdf = require('../../app/core/prosklisiDiavgeiaPdf');

const ETPA40 = [
  'Κωδικός Πρόσκλησης: ΕΤΠΑ_40 Α/Α Πρόσκλησης ΟΠΣ: 24026',
  'ελάχιστος προϋπολογισμός των υποβαλλόμενων πράξεων ορίζεται το ποσό των 200.000,00€.',
  'μέγιστος προϋπολογισμός των υποβαλλόμενων πράξεων :δεν αφορά.',
  '4.2. Οι προτάσεις υποβάλλονται μέσω του ΟΠΣ από την 27/07/2026',
  '(ημερομηνία έναρξης υποβολής προτάσεων), ώρα 08:00 έως, αποκλειστικά, την 15/10/2026',
  '(ημερομηνία λήξης υποβολής προτάσεων), ώρα 15:00',
].join(' ');

describe('prosklisiDiavgeiaPdf', () => {
  it('βγάζει κωδικό ΕΤΠΑ από το θέμα χωρίς PDF', () => {
    expect(pdf.extractInvitationCodeFromSubject(
      'ΠΡΟΣΚΛΗΣΗ ΕΤΠΑ_40 ΜΕ ΤΙΤΛΟ «Δράση ύδρευσης»'
    )).toBe('ΕΤΠΑ_40');
  });

  it('δεν παίρνει ως κωδικό το «ΠΡΟΣΚΛΗΣΗ VI»', () => {
    expect(pdf.extractInvitationCodeFromSubject(
      'ΠΡΟΣΚΛΗΣΗ VI ΓΙΑ ΤΗΝ ΥΠΟΒΟΛΗ ΑΙΤΗΣΕΩΝ'
    )).toBe('');
  });

  it('από το κείμενο PDF γεμίζει κωδικό, ελάχιστο Π/Υ και λήξη υποβολής', () => {
    const fields = pdf.extractProsklisiFieldsFromPdfText(ETPA40);
    expect(fields.code).toBe('ΕΤΠΑ_40');
    expect(fields.budgetRange).toBe('από 200.000,00€');
    expect(fields.deadline).toBe('2026-10-15');
  });

  it('όταν υπάρχει μέγιστο ποσό το βάζει στο εύρος', () => {
    const text = 'ελάχιστος προϋπολογισμός ορίζεται το ποσό των 100.000,00€. '
      + 'μέγιστος προϋπολογισμός ορίζεται το ποσό των 500.000,00€.';
    expect(pdf.extractBudgetRangeFromText(text)).toBe('100.000,00€ – 500.000,00€');
  });

  it('συμπληρώνει κενά πεδία από το PDF χωρίς να σβήνει όσα ήρθαν από το θέμα', () => {
    const merged = pdf.mergeProsklisiExtractedFields(
      { code: 'ΕΤΠΑ_40', title: 'Ύδρευση' },
      { code: 'ΑΛΛΟ', budgetRange: 'από 200.000,00€', deadline: '2026-10-15' }
    );
    expect(merged.code).toBe('ΕΤΠΑ_40');
    expect(merged.budgetRange).toBe('από 200.000,00€');
    expect(merged.deadline).toBe('2026-10-15');
    expect(merged.title).toBe('Ύδρευση');
  });
});
