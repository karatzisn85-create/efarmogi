/**
 * @jest-environment node
 */
import { getDefaultSubprojectPhaseTab } from './subprojectPhaseTabDefault';

describe('getDefaultSubprojectPhaseTab', () => {
  test('χωρίς project → Α', () => {
    expect(getDefaultSubprojectPhaseTab(null)).toBe('A');
    expect(getDefaultSubprojectPhaseTab(undefined)).toBe('A');
  });

  test('υπό βραχυπρόθεσμη ωρίμανση → Α ακόμη κι αν υπάρχει ΚΗΜΔΗΣ', () => {
    expect(getDefaultSubprojectPhaseTab({
      projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
      khmdhsAdam: '25SYMV001234567',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV001234567' },
    })).toBe('A');
  });

  test('άλλη κατάσταση χωρίς ανάκτηση → Α', () => {
    expect(getDefaultSubprojectPhaseTab({
      projectStatus: 'ΣΕ ΕΞΕΛΙΞΗ',
    })).toBe('A');
  });

  test('άλλη κατάσταση με αρχική ανάκτηση → Β', () => {
    expect(getDefaultSubprojectPhaseTab({
      projectStatus: 'ΣΕ ΕΞΕΛΙΞΗ',
      implementationForm: 'Μια Σύμβαση',
      khmdhsRequestAdam: '21REQ009553549',
      khmdhsRequestSnapshot: { referenceNumber: '21REQ009553549' },
      khmdhsAdam: '22SYMV011799800',
      khmdhsContractSnapshot: { referenceNumber: '22SYMV011799800' },
    })).toBe('B');
  });
});
