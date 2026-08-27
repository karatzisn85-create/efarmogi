/**
 * @jest-environment node
 */
import { shouldRequestChargeGreetingOnSave } from './supervisorChargeGreetingGate';

describe('shouldRequestChargeGreetingOnSave', () => {
  const ready = {
    checkboxOn: true,
    firstChargeEligible: true,
    outsideCatalog: false,
    hasCatalogEngineer: true,
    phaseASaveOnly: false,
  };

  test('αποθήκευση Φάσης Β με τικ → αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave(ready)).toBe(true);
  });

  test('μόνη αποθήκευση Φάσης Α → όχι ακόμα αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave({ ...ready, phaseASaveOnly: true })).toBe(false);
  });

  test('χωρίς τικ → καμία αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave({ ...ready, checkboxOn: false })).toBe(false);
  });

  test('εκτός καταλόγου → καμία αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave({ ...ready, outsideCatalog: true })).toBe(false);
  });

  test('χωρίς μηχανικό καταλόγου → καμία αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave({ ...ready, hasCatalogEngineer: false })).toBe(false);
  });

  test('ήδη χρεωμένο (κουτάκι ανενεργό) → καμία αποστολή', () => {
    expect(shouldRequestChargeGreetingOnSave({ ...ready, firstChargeEligible: false })).toBe(false);
  });
});
