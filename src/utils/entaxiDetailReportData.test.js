/**
 * @jest-environment node
 */
import { buildEntaxiDetailReportPayload, fileNameFromEntaxiRef } from './entaxiDetailReportData';

describe('buildEntaxiDetailReportPayload', () => {
  const entaxi = {
    entaxiId: 'ent-road',
    subject: 'Ανάπλαση γέφυρας',
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    documentDate: '2024-11-28',
    fundingAuthority: 'ΠΕΡΙΦΕΡΕΙΑ ΚΡΗΤΗΣ',
    beneficiary: 'Δήμος Αρχανών-Αστερουσίων',
    comments: 'Σχόλιο ένταξης',
    opsCode: '5225302',
    diavgeiaAda: 'ΨΩΚΖ7ΛΚ-8ΦΤ',
    startDate: '2024-12-01',
    endDate: '2029-08-31',
    legalCommitmentDeadline: '2025-02-24',
    initialAmount: '100.000,00',
    prosklisiId: 'psk-schools',
    subprojectIds: ['sub-bridge'],
    entaxiPDFs: [{ fileName: 'entaxi.pdf' }],
    approvalPDFs: ['approval.pdf'],
    createdAt: '2024-03-01T08:00:00.000Z',
    modifications: [
      {
        modificationId: 'mod-1',
        date: '2025-02-15',
        changeAmount: true,
        amount: '120.000,00',
        comments: 'Αύξηση προϋπολογισμού γέφυρας',
        diavgeiaAda: 'Ψ84Ρ7ΛΚ-ΑΨΝ',
        endDate: '2029-12-31',
        modificationPDF: { fileName: 'mod.pdf' },
      },
      {
        modificationId: 'mod-2',
        date: '2025-06-01',
        changeAmount: false,
        comments: 'Διορθωτική χωρίς ποσό',
      },
    ],
  };

  it('συγκεντρώνει ποσά, κωδικούς, λήξη και τροποποιήσεις', () => {
    const data = buildEntaxiDetailReportPayload({
      entaxi,
      prosklisiTitle: 'Πρόσκληση σχολείων',
      linkedNotes: [{ title: 'Σημείωση Α', content: 'Κείμενο' }],
      organizationName: 'Δήμος Αρχανών-Αστερουσίων',
    });

    expect(data.subject).toBe('Ανάπλαση γέφυρας');
    expect(data.documentDate).toBe('28/11/2024');
    expect(data.opsCode).toBe('5225302');
    expect(data.diavgeiaAda).toBe('ΨΩΚΖ7ΛΚ-8ΦΤ');
    expect(data.diavgeiaUrl).toContain('decision/view/');
    expect(data.endDate).toBe('31/08/2029');
    expect(data.currentAmountLabel).toContain('120.000,00');
    expect(data.initialAmountLabel).toContain('100.000,00');
    expect(data.amountDeltaLabel).toMatch(/^\+/);
    expect(data.modificationsCount).toBe(2);
    expect(data.modifications[0].comments).toBe('Αύξηση προϋπολογισμού γέφυρας');
    expect(data.modifications[0].amountLabel).toContain('120.000,00');
    expect(data.modifications[0].ada).toBe('Ψ84Ρ7ΛΚ-ΑΨΝ');
    expect(data.modifications[0].files).toEqual([
      { kind: 'Τροποποίηση', name: 'mod.pdf' },
    ]);
    expect(data.modifications[1].changeAmount).toBe(false);
    expect(data.prosklisiTitle).toBe('Πρόσκληση σχολείων');
    expect(data.files.entaxi).toEqual(['entaxi.pdf']);
    expect(data.files.approval).toEqual(['approval.pdf']);
    expect(data.notes[0].title).toBe('Σημείωση Α');
    expect(data.unlinked).toBe(false);
  });

  it('μεμονωμένη ένταξη χωρίς τροποποιήσεις δεν εφευρίσκει ποσά αλλαγής', () => {
    const data = buildEntaxiDetailReportPayload({
      entaxi: {
        subject: 'Μεμονωμένη ένταξη',
        projectTitle: '',
        subprojectIds: [],
        initialAmount: '10.000,00',
      },
    });
    expect(data.unlinked).toBe(true);
    expect(data.currentAmountLabel).toContain('10.000,00');
    expect(data.amountDeltaLabel).toBe('');
    expect(data.modifications).toEqual([]);
    expect(data.diavgeiaAda).toBe('');
  });

  it('διαβάζει όνομα αρχείου από string, αντικείμενο ή διαδρομή', () => {
    expect(fileNameFromEntaxiRef('a.pdf')).toBe('a.pdf');
    expect(fileNameFromEntaxiRef({ fileName: 'b.pdf' })).toBe('b.pdf');
    expect(fileNameFromEntaxiRef({ filePath: 'C:\\data\\entaxeis\\mod.pdf' })).toBe('mod.pdf');
    expect(fileNameFromEntaxiRef(null)).toBe('');
  });

  it('βρίσκει ΑΔΑ τροποποίησης από το έγγραφο Διαύγειας όταν λείπει το πεδίο ΑΔΑ', () => {
    const data = buildEntaxiDetailReportPayload({
      entaxi: {
        subject: 'Τροποποίηση μόνο με έγγραφο',
        initialAmount: '10.000,00',
        modifications: [{
          date: '2025-02-15',
          comments: 'Τροποποίηση',
          diavgeiaDocument: { ada: 'Ψ84Ρ7ΛΚ-ΑΨΝ' },
        }],
      },
    });
    expect(data.modifications[0].ada).toBe('Ψ84Ρ7ΛΚ-ΑΨΝ');
    expect(data.modifications[0].adaUrl).toContain('decision/view/');
  });
});
