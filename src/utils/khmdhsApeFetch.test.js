/**
 * @jest-environment node
 */
import { buildApeFetchPreview } from './khmdhsApeFetch';

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
});
