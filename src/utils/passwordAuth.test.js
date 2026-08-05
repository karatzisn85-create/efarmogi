/**
 * @jest-environment node
 */
const {
  hashPassword,
  verifyPassword,
  needsPasswordRehash,
  validatePasswordPolicy,
  hashPasswordLegacy,
  MIN_PASSWORD_LENGTH,
} = require('../../public/passwordAuth');

describe('passwordAuth', () => {
  test('νέο hash επαληθεύεται και δεν είναι legacy', () => {
    const hash = hashPassword('SecretPass1');
    expect(needsPasswordRehash(hash)).toBe(false);
    expect(verifyPassword('SecretPass1', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  test('παλιό SHA-256 hash επαληθεύεται και χρειάζεται rehash', () => {
    const legacy = hashPasswordLegacy('OldPass99');
    expect(needsPasswordRehash(legacy)).toBe(true);
    expect(verifyPassword('OldPass99', legacy)).toBe(true);
    expect(verifyPassword('nope', legacy)).toBe(false);
  });

  test('πολιτική μήκους', () => {
    expect(validatePasswordPolicy('short').ok).toBe(false);
    expect(validatePasswordPolicy('a'.repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true);
  });
});
