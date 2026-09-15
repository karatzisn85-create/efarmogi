/**
 * @jest-environment node
 */

function installDocument() {
  const attrs = {};
  const makeStyle = () => ({
    overflow: '',
    removeProperty(name) {
      if (name === 'overflow') this.overflow = '';
    },
  });
  global.window = {
    electronAPI: { invoke: () => Promise.resolve({ success: true }) },
  };
  global.document = {
    body: {
      style: makeStyle(),
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      removeAttribute(k) { delete attrs[k]; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    },
    documentElement: { style: makeStyle() },
    getElementById() { return null; },
  };
}

describe('scheduleDocumentInteractionRecovery', () => {
  let lockBodyScroll;
  let unlockBodyScroll;
  let getHolderCount;
  let forceUnlockBodyScroll;
  let scheduleDocumentInteractionRecovery;

  beforeAll(async () => {
    installDocument();
    ({
      lockBodyScroll,
      unlockBodyScroll,
      getHolderCount,
      forceUnlockBodyScroll,
    } = await import('./bodyScrollLock'));
    ({ scheduleDocumentInteractionRecovery } = await import('./documentInteractionReset'));
  });

  afterEach(() => {
    forceUnlockBodyScroll();
  });

  test('μετά από επιβεβαίωση δεν σβήνει το κλείδωμα ανοιχτού παραθύρου', () => {
    lockBodyScroll('contractor-registry');
    scheduleDocumentInteractionRecovery();
    expect(getHolderCount()).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.getAttribute('data-modal-open')).toBe('true');
    unlockBodyScroll('contractor-registry');
  });

  test('χωρίς ανοιχτό παράθυρο η επαναφορά καθαρίζει το κλείδωμα', () => {
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-modal-open', 'true');
    scheduleDocumentInteractionRecovery();
    expect(getHolderCount()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
});
