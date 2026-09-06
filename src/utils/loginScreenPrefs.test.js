/**
 * @jest-environment node
 */
import {
  LAST_LOGIN_USERNAME_KEY,
  readLastLoginUsername,
  saveLastLoginUsername,
  isCapsLockOn,
} from './loginScreenPrefs';

function memoryStorage(start = {}) {
  const data = { ...start };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
    _data: data,
  };
}

describe('loginScreenPrefs', () => {
  test('διαβάζει το τελευταίο όνομα και κόβει κενά', () => {
    const storage = memoryStorage({ [LAST_LOGIN_USERNAME_KEY]: '  maria  ' });
    expect(readLastLoginUsername(storage)).toBe('maria');
  });

  test('κενή ή κατεστραμμένη αποθήκευση επιστρέφει κενό', () => {
    expect(readLastLoginUsername(memoryStorage())).toBe('');
    expect(readLastLoginUsername({
      getItem: () => { throw new Error('blocked'); },
    })).toBe('');
  });

  test('αποθηκεύει μόνο μετά από επιτυχή είσοδο — χωρίς κωδικό', () => {
    const storage = memoryStorage();
    saveLastLoginUsername('  nikos  ', storage);
    expect(storage.getItem(LAST_LOGIN_USERNAME_KEY)).toBe('nikos');
    expect(JSON.stringify(storage._data)).not.toMatch(/pass/i);
  });

  test('κενό όνομα καθαρίζει την αποθήκευση', () => {
    const storage = memoryStorage({ [LAST_LOGIN_USERNAME_KEY]: 'maria' });
    saveLastLoginUsername('   ', storage);
    expect(storage.getItem(LAST_LOGIN_USERNAME_KEY)).toBeNull();
  });

  test('Caps Lock από το πληκτρολόγιο', () => {
    expect(isCapsLockOn(null)).toBe(false);
    expect(isCapsLockOn({})).toBe(false);
    expect(isCapsLockOn({ getModifierState: (m) => m === 'CapsLock' })).toBe(true);
    expect(isCapsLockOn({ getModifierState: () => false })).toBe(false);
  });
});
