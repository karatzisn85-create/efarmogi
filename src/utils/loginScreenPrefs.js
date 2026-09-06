export const LAST_LOGIN_USERNAME_KEY = 'ergohub.lastLoginUsername';

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

export function readLastLoginUsername(storage) {
  try {
    const raw = resolveStorage(storage)?.getItem(LAST_LOGIN_USERNAME_KEY);
    if (typeof raw !== 'string') return '';
    return raw.trim();
  } catch {
    return '';
  }
}

export function saveLastLoginUsername(username, storage) {
  const name = String(username || '').trim();
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    if (!name) store.removeItem(LAST_LOGIN_USERNAME_KEY);
    else store.setItem(LAST_LOGIN_USERNAME_KEY, name);
  } catch {
    /* ιδιωτική λειτουργία / γεμάτη αποθήκευση */
  }
}

export function isCapsLockOn(event) {
  if (!event || typeof event.getModifierState !== 'function') return false;
  try {
    return Boolean(event.getModifierState('CapsLock'));
  } catch {
    return false;
  }
}
