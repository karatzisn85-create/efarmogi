/**
 * @jest-environment node
 *
 * Καλύπτει το bug «Α»: ο μηχανικός δεν πρέπει ΠΟΤΕ να χάνει σιωπηλά μια εγγυητική/παραλαβή
 * όταν το υποέργο δεν ανήκει στα ορατά/χρεωμένα του. Αντί για σιωπηλό «πέταγμα»,
 * ο έλεγχος πρέπει να το εντοπίζει ώστε η αποθήκευση να ακυρώνεται με σαφές μήνυμα.
 */
import contractorRegistry from '../../app/core/contractorRegistry';

describe('findUnauthorizedEngineerSubprojects', () => {
  const visible = new Set(['sub-visible']);

  test('επιστρέφει κενό όταν όλα τα στοιχεία είναι σε ορατά υποέργα', () => {
    const incoming = {
      guarantees: [{ id: 'g1', subprojectId: 'sub-visible' }],
      acceptances: [{ id: 'a1', subprojectId: 'sub-visible' }],
    };
    expect(
      contractorRegistry.findUnauthorizedEngineerSubprojects(incoming, visible)
    ).toEqual([]);
  });

  test('εντοπίζει εγγυητική σε μη-ορατό υποέργο', () => {
    const incoming = {
      guarantees: [
        { id: 'g1', subprojectId: 'sub-visible' },
        { id: 'g2', subprojectId: 'sub-hidden' },
      ],
      acceptances: [],
    };
    expect(
      contractorRegistry.findUnauthorizedEngineerSubprojects(incoming, visible)
    ).toEqual(['sub-hidden']);
  });

  test('εντοπίζει παραλαβή σε μη-ορατό υποέργο', () => {
    const incoming = {
      guarantees: [],
      acceptances: [{ id: 'a1', subprojectId: 'sub-hidden' }],
    };
    expect(
      contractorRegistry.findUnauthorizedEngineerSubprojects(incoming, visible)
    ).toEqual(['sub-hidden']);
  });

  test('δεν επιστρέφει διπλότυπα', () => {
    const incoming = {
      guarantees: [{ id: 'g1', subprojectId: 'sub-hidden' }],
      acceptances: [{ id: 'a1', subprojectId: 'sub-hidden' }],
    };
    expect(
      contractorRegistry.findUnauthorizedEngineerSubprojects(incoming, visible)
    ).toEqual(['sub-hidden']);
  });

  test('αγνοεί στοιχεία χωρίς υποέργο', () => {
    const incoming = {
      guarantees: [{ id: 'g1', subprojectId: '' }],
      acceptances: [],
    };
    expect(
      contractorRegistry.findUnauthorizedEngineerSubprojects(incoming, visible)
    ).toEqual([]);
  });
});

describe('mergeEngineerRecordSave — διατήρηση ξένων στοιχείων', () => {
  const visible = new Set(['sub-own']);

  test('κρατά τα ξένα (μη-ορατά) στοιχεία του υπάρχοντος και δέχεται τα δικά του', () => {
    const existing = {
      id: 'rec-1',
      identityKey: 'vat:123456789',
      name: 'ΤΕΧΝΙΚΗ Α.Ε.',
      vat: '123456789',
      guarantees: [
        { id: 'foreign', subprojectId: 'sub-foreign', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2027-01-01' },
      ],
      acceptances: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const incoming = {
      id: 'rec-1',
      guarantees: [
        { id: 'own', subprojectId: 'sub-own', type: 'καλής εκτέλεσης', status: 'ενεργή', expiresOn: '2027-06-01' },
      ],
      acceptances: [],
    };
    const merged = contractorRegistry.mergeEngineerRecordSave(existing, incoming, visible);
    const ids = merged.guarantees.map((g) => g.id).sort();
    expect(ids).toEqual(['foreign', 'own']);
  });
});
