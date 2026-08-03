/**
 * @jest-environment node
 */
import {
  buildPostSetupItems,
  isPortalConfigured,
  isPostSetupChecklistComplete,
  shouldShowPostSetupChecklist,
  isPostSetupChecklistDismissed,
  dismissPostSetupChecklist,
  POST_SETUP_DISMISS_KEY,
  POST_SETUP_DISMISS_DAYS,
} from './postSetupChecklist';

function memoryStorage(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => (map[k] == null ? null : map[k]),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
  };
}

describe('postSetupChecklist', () => {
  test('portal configured needs enable + uid', () => {
    expect(isPortalConfigured({ portalEnabled: true, portalDimosUid: 'dimos1' })).toBe(true);
    expect(isPortalConfigured({ portalEnabled: true, portalDimosUid: '' })).toBe(false);
    expect(isPortalConfigured({ portalEnabled: false, portalDimosUid: 'dimos1' })).toBe(false);
  });

  test('build items reflects status', () => {
    const items = buildPostSetupItems({
      emailConfigured: true,
      hasBackup: false,
      portalConfigured: false,
    });
    expect(items.find((i) => i.id === 'email').done).toBe(true);
    expect(items.find((i) => i.id === 'backup').done).toBe(false);
    expect(isPostSetupChecklistComplete(items)).toBe(false);
  });

  test('show only for SUPERADMIN with incomplete and not dismissed', () => {
    const items = buildPostSetupItems({ emailConfigured: false, hasBackup: true, portalConfigured: true });
    expect(shouldShowPostSetupChecklist({
      userRole: 'SUPERADMIN',
      items,
      dismissed: false,
    })).toBe(true);
    expect(shouldShowPostSetupChecklist({
      userRole: 'ADMIN',
      items,
      dismissed: false,
    })).toBe(false);
    expect(shouldShowPostSetupChecklist({
      userRole: 'SUPERADMIN',
      items: buildPostSetupItems({ emailConfigured: true, hasBackup: true, portalConfigured: true }),
      dismissed: false,
    })).toBe(false);
  });

  test('dismiss lasts POST_SETUP_DISMISS_DAYS', () => {
    const store = memoryStorage();
    const now = Date.parse('2026-07-23T12:00:00.000Z');
    dismissPostSetupChecklist(store, now);
    expect(store.getItem(POST_SETUP_DISMISS_KEY)).toBeTruthy();
    expect(isPostSetupChecklistDismissed(now, store)).toBe(true);
    const later = now + (POST_SETUP_DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(isPostSetupChecklistDismissed(later, store)).toBe(false);
  });
});
