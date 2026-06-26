/**
 * @jest-environment node
 */
import {
  recordKhmdhsFieldOverride,
  updateKhmdhsFieldOverrideComment,
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
