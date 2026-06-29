/**
 * @jest-environment node
 */
import {
  buildApeFetchPreview,
  resolveKhmdhsApeDocumentDateFromSnapshot,
} from './khmdhsApeFetch';

describe('khmdhsApeFetch', () => {
  test('buildApeFetchPreview από snapshot', () => {
    const preview = buildApeFetchPreview({
      referenceNumber: '24SYMV015347394',
      title: 'Δοκιμή σύμβασης',
      totalCostWithVAT: 256680,
      signedDate: '2024-05-15',
    });
    expect(preview.adam).toBe('24SYMV015347394');
    expect(preview.title).toBe('Δοκιμή σύμβασης');
    expect(preview.amount).toBe('256.680,00');
    expect(preview.amountDisplay).toBe('256.680,00');
    expect(preview.signedDateDisplay).toBeTruthy();
  });

  test('ημερομηνία από contractSignedDate / startDate', () => {
    const iso = resolveKhmdhsApeDocumentDateFromSnapshot({
      contractSignedDate: '2024-07-19',
      startDate: '2024-07-19',
    });
    expect(iso).toBe('2024-07-19');
    const preview = buildApeFetchPreview({
      referenceNumber: '24SYMV015159432',
      contractSignedDate: '2024-07-19',
    });
    expect(preview.signedDate).toBe('2024-07-19');
    expect(preview.signedDateDisplay).toBe('19/07/2024');
  });

  test('τροποποίηση — προτεραιότητα σε submissionDate έναντι αρχικής σύμβασης', () => {
    const iso = resolveKhmdhsApeDocumentDateFromSnapshot({
      referenceNumber: '25SYMV018192699',
      prevReferenceNo: '25SYMV017590663',
      contractSignedDate: '2024-07-19',
      startDate: '2024-07-19',
      submissionDate: '2025-12-17T14:38:06.166',
    });
    expect(iso).toBe('2025-12-17');
    const preview = buildApeFetchPreview({
      referenceNumber: '25SYMV018192699',
      prevReferenceNo: '25SYMV017590663',
      contractSignedDate: '2024-07-19',
      submissionDate: '2025-12-17T14:38:06.166',
    });
    expect(preview.signedDate).toBe('2025-12-17');
    expect(preview.signedDateDisplay).toBe('17/12/2025');
  });
});
