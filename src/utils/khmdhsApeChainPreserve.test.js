/**
 * @jest-environment node
 */
import { resolveStoredApeAmount } from './khmdhsFields';
import { applyAdamChainResult } from './khmdhsChainApply';

describe('khmdhs APE preservation on chain apply', () => {
  test('resolveStoredApeAmount διαβάζει από apeEntries', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      apeAmount: '554.600,51',
      apeEntries: [{
        id: 'e1',
        documentDate: '2020-10-09',
        apeAmount: '554.600,51',
      }],
    };
    expect(resolveStoredApeAmount(form)).toBe('554.600,51');
  });

  test('applyAdamChainResult διατηρεί ΑΠΕ και στο apeEntries', () => {
    const prev = {
      implementationForm: 'Μια Σύμβαση',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      contractAmount: '494.855,49',
      contractDate: '2020-10-09',
      apeAmount: '554.600,51',
      apeEntries: [{
        id: 'ape-legacy',
        documentDate: '2020-10-09',
        apeAmount: '',
        apeSourceAdam: '20SYMV007453715',
      }],
      khmdhsAdam: '20SYMV007453715',
    };
    const chainRes = {
      success: true,
      contract: {
        adam: '20SYMV007453715',
        snapshot: { referenceNumber: '20SYMV007453715', endDate: '2021-10-09' },
        fetchedAt: new Date().toISOString(),
        roleLabel: 'Αρχική σύμβαση',
        formFields: {
          contractDate: '2020-10-09',
          contractAmount: '494.855,49',
          contractEndDate: '2021-10-09',
        },
      },
      suggestedApeAmount: '494.855,49',
      contractChainHistory: [{ adam: '20SYMV007453715', isRoot: true, order: 0 }],
      contractAmendments: [],
      dataQualityReport: { items: [], resolutions: {} },
    };
    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '20SYMV007453715' });
    expect(form.apeAmount).toBe('554.600,51');
    const latestEntry = (form.apeEntries || []).slice(-1)[0];
    expect(latestEntry?.apeAmount).toBe('554.600,51');
  });

  test('μετά επαναφορά Φάσης Β δεν εμφανίζονται διπλά ΑΠΕ με μηδενικό ποσό', () => {
    const prev = {
      implementationForm: 'Μια Σύμβαση',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      contractAmount: '',
      contractDate: '',
      apeAmount: '0,00',
      apeDocumentDate: '2025-01-08',
      apeEntries: [{ id: 'stale', documentDate: '2025-01-08', apeAmount: '' }],
      khmdhsChainSeedAdam: '24REQ015990366',
    };
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV016136159',
        snapshot: { referenceNumber: '25SYMV016136159', signedDate: '2025-01-08' },
        fetchedAt: new Date().toISOString(),
        roleLabel: 'Αρχική σύμβαση',
        formFields: {
          contractDate: '2025-01-07',
          contractAmount: '37.080,50',
        },
      },
      suggestedApeAmount: '37.080,50',
      contractChainHistory: [{ adam: '25SYMV016136159', isRoot: true, order: 0 }],
      contractAmendments: [],
      dataQualityReport: { items: [], resolutions: {} },
    };
    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '24REQ015990366' });
    expect(form.apeEntries || []).toHaveLength(0);
    expect(form.apeAmount).toBe('');
  });
});
