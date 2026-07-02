/**
 * @jest-environment node
 */
const {
  defaultConfig,
  normalizeConfig,
  normalizeNotifyEventTypes,
  isNotifyEventTypeEnabled,
  NOTIFY_EVENT_TYPES,
} = require('../../public/calendarConfigService');

describe('calendarConfigService', () => {
  test('default config includes all reminder event types', () => {
    const cfg = defaultConfig();
    expect(cfg.notifyEventTypes).toEqual(Object.values(NOTIFY_EVENT_TYPES));
    expect(cfg.daysBefore).toEqual([7, 3, 1, 0]);
  });

  test('normalizeConfig keeps selected notify event types', () => {
    const normalized = normalizeConfig({
      notifyEventTypes: ['contract_end', 'custom'],
      daysBefore: [180, 90, 7],
    });
    expect(normalized.notifyEventTypes).toEqual(['contract_end', 'custom']);
    expect(normalized.daysBefore).toEqual([180, 90, 7]);
  });

  test('empty notifyEventTypes falls back to all types', () => {
    expect(normalizeNotifyEventTypes([])).toEqual(Object.values(NOTIFY_EVENT_TYPES));
    expect(isNotifyEventTypeEnabled({ notifyEventTypes: [] }, 'deadline')).toBe(true);
  });

  test('isNotifyEventTypeEnabled respects selection', () => {
    const cfg = { notifyEventTypes: ['contract_end'] };
    expect(isNotifyEventTypeEnabled(cfg, 'contract_end')).toBe(true);
    expect(isNotifyEventTypeEnabled(cfg, 'deadline')).toBe(false);
  });
});
