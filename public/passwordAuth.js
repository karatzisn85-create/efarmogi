/**
 * Hashing κωδικών πρόσβασης (scrypt) με συμβατότητα παλιού SHA-256+SALT.
 */
const crypto = require('crypto');

const LEGACY_SALT = 'ErgoHub2026!@#SecureSalt';
const SCHEME = 'scrypt';
const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const MIN_PASSWORD_LENGTH = 8;

function hashPasswordLegacy(password) {
  return crypto.createHash('sha256').update(LEGACY_SALT + String(password || '')).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, SCRYPT_KEYLEN, SCRYPT_OPTS).toString('hex');
  return `${SCHEME}$${salt}$${hash}`;
}

function isScryptHash(storedHash) {
  return String(storedHash || '').startsWith(`${SCHEME}$`);
}

function verifyPassword(password, storedHash) {
  const stored = String(storedHash || '');
  if (!stored) return false;
  if (isScryptHash(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expected = parts[2];
    let computed;
    try {
      computed = crypto.scryptSync(String(password || ''), salt, SCRYPT_KEYLEN, SCRYPT_OPTS).toString('hex');
    } catch {
      return false;
    }
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(computed, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
  return stored === hashPasswordLegacy(password);
}

function needsPasswordRehash(storedHash) {
  return !isScryptHash(storedHash);
}

function validatePasswordPolicy(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Ο κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες`,
    };
  }
  return { ok: true };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  hashPasswordLegacy,
  verifyPassword,
  needsPasswordRehash,
  validatePasswordPolicy,
  isScryptHash,
};
