/**
 * @jest-environment node
 */
import {
  getImplementationFormValidationError,
  statusAllowsEmptyImplementationForm,
  IMPLEMENTATION_FORM_REQUIRED_MESSAGE,
} from './formOptions';

describe('μορφή υλοποίησης — υποχρεωτικότητα ανά κατάσταση', () => {
  test('στην υπό βραχυπρόθεσμη ωρίμανση επιτρέπεται κενή μορφή', () => {
    expect(statusAllowsEmptyImplementationForm('ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ')).toBe(true);
    expect(
      getImplementationFormValidationError({
        projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
        implementationForm: '',
      })
    ).toBeNull();
  });

  test('στο απενταγμένο επιτρέπεται κενή μορφή', () => {
    expect(statusAllowsEmptyImplementationForm('ΑΠΕΝΤΑΓΜΕΝΟ')).toBe(true);
    expect(
      getImplementationFormValidationError({
        projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ',
        implementationForm: '',
      })
    ).toBeNull();
  });

  test('σε διαδικασία σύναψης χωρίς μορφή μπλοκάρει με το γνωστό μήνυμα', () => {
    expect(statusAllowsEmptyImplementationForm('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ')).toBe(false);
    expect(
      getImplementationFormValidationError({
        projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
        implementationForm: '',
      })
    ).toBe(IMPLEMENTATION_FORM_REQUIRED_MESSAGE);
  });

  test('με επιλεγμένη μορφή δεν υπάρχει σφάλμα', () => {
    expect(
      getImplementationFormValidationError({
        projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
        implementationForm: 'Μια Σύμβαση',
      })
    ).toBeNull();
  });
});
