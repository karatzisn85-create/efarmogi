/**
 * @jest-environment node
 */
import {
  recordKhmdhsFieldOverride,
  updateKhmdhsFieldOverrideComment,
  applyUserEditsAfterKhmdhsFetch,
} from './khmdhsFieldOverrides';

describe('updateKhmdhsFieldOverrideComment', () => {
  const fieldKey = 'contractAmount';

  test('preserves spaces while typing comments', () => {
    let form = { contractAmount: '332.101,10' };
    form = recordKhmdhsFieldOverride(form, {
      fieldKey,
      newValue: '332.101,10',
      khmdhsBaseline: '267.823,47',
      label: 'Ποσό σύμβασης (με ΦΠΑ)',
    });

    form = updateKhmdhsFieldOverrideComment(form, fieldKey, 'τιμή ');
    expect(form.khmdhsUserEdits.fieldOverrides[fieldKey].comment).toBe('τιμή ');

    form = updateKhmdhsFieldOverrideComment(form, fieldKey, 'τιμή από PDF');
    expect(form.khmdhsUserEdits.fieldOverrides[fieldKey].comment).toBe('τιμή από PDF');
  });
});

describe('applyUserEditsAfterKhmdhsFetch — προστασία assignmentProcedure', () => {
  test('δεν επαναφέρει επ’ άπειρον κενή «προστατευμένη» τιμή όταν το ΚΗΜΔΗΣ βρίσκει πλέον διαδικασία', () => {
    // Ένα παλιό, ακούσια καταγεγραμμένο «κενό» override (π.χ. από ιστορικό bug φόρτωσης
    // φόρμας) δεν πρέπει να μπλοκάρει για πάντα τη σωστή τιμή που βρίσκει το ΚΗΜΔΗΣ.
    const prevForm = {
      assignmentProcedure: '',
      khmdhsUserEdits: {
        fieldOverrides: {
          assignmentProcedure: { value: '', khmdhsValue: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ', label: 'Τρόπος ανάθεσης' },
        },
        excludedChainAdams: [],
        journal: [],
      },
    };
    const fetchedForm = { assignmentProcedure: 'ΑΝΤΑΓΩΝΙΣΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ ΜΕ ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ' };
    const { form, protectedCount } = applyUserEditsAfterKhmdhsFetch(prevForm, fetchedForm);
    expect(form.assignmentProcedure).toBe('ΑΝΤΑΓΩΝΙΣΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ ΜΕ ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ');
    expect(form.khmdhsUserEdits.fieldOverrides.assignmentProcedure).toBeUndefined();
    expect(protectedCount).toBe(0);
  });

  test('διατηρεί μια πραγματική (μη κενή) χειροκίνητη επιλογή assignmentProcedure', () => {
    const prevForm = {
      assignmentProcedure: 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ',
      khmdhsUserEdits: {
        fieldOverrides: {
          assignmentProcedure: { value: 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ', khmdhsValue: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ', label: 'Τρόπος ανάθεσης' },
        },
        excludedChainAdams: [],
        journal: [],
      },
    };
    const fetchedForm = { assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ' };
    const { form } = applyUserEditsAfterKhmdhsFetch(prevForm, fetchedForm);
    expect(form.assignmentProcedure).toBe('ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ');
    expect(form.khmdhsUserEdits.fieldOverrides.assignmentProcedure).toBeTruthy();
  });
});
