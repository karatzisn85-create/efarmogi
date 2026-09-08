/**
 * @jest-environment node
 */
const {
  defaultConfig,
  normalizeConfig,
  normalizeNotifyEventTypes,
  isNotifyEventTypeEnabled,
  getEventTypeSetting,
  userMatchesEventTypeRecipients,
  NOTIFY_EVENT_TYPES,
} = require('../../public/calendarConfigService');

describe('calendarConfigService', () => {
  test('default config includes all reminder event types and per-type settings', () => {
    const cfg = defaultConfig();
    expect(cfg.notifyEventTypes).toEqual(Object.values(NOTIFY_EVENT_TYPES));
    expect(cfg.daysBefore).toEqual([7, 3, 1, 0]);
    expect(cfg.eventTypeSettings).toBeTruthy();
    Object.values(NOTIFY_EVENT_TYPES).forEach((type) => {
      expect(cfg.eventTypeSettings[type].enabled).toBe(true);
      expect(cfg.eventTypeSettings[type].recipientRoles).toEqual(['ADMIN', 'ENGINEER']);
    });
  });

  test('normalizeConfig keeps month and mid-month reminder thresholds', () => {
    const normalized = normalizeConfig({
      daysBefore: [180, 90, 30, 15, 7],
    });
    expect(normalized.daysBefore).toEqual([180, 90, 30, 15, 7]);
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

  test('legacy flat recipients migrate to every enabled type', () => {
    const normalized = normalizeConfig({
      recipientRoles: ['ADMIN'],
      recipientUsernames: ['maria'],
      notifyEventTypes: ['contract_end', 'deadline'],
    });
    expect(normalized.eventTypeSettings.contract_end.recipientRoles).toEqual(['ADMIN']);
    expect(normalized.eventTypeSettings.contract_end.recipientUsernames).toEqual(['maria']);
    expect(normalized.eventTypeSettings.deadline.recipientRoles).toEqual(['ADMIN']);
    expect(normalized.eventTypeSettings.offers_expiry.enabled).toBe(false);
  });

  test('per-type recipients are preserved and legacy fields are derived', () => {
    const normalized = normalizeConfig({
      eventTypeSettings: {
        contract_end: {
          enabled: true,
          recipientRoles: ['ADMIN'],
          recipientUsernames: [],
        },
        deadline: {
          enabled: true,
          recipientRoles: ['ENGINEER'],
          recipientUsernames: ['giorgos'],
        },
        offers_expiry: {
          enabled: false,
          recipientRoles: ['USER'],
          recipientUsernames: [],
        },
      },
    });
    expect(normalized.eventTypeSettings.contract_end.recipientRoles).toEqual(['ADMIN']);
    expect(normalized.eventTypeSettings.deadline.recipientRoles).toEqual(['ENGINEER']);
    expect(normalized.eventTypeSettings.deadline.recipientUsernames).toEqual(['giorgos']);
    expect(normalized.eventTypeSettings.offers_expiry.enabled).toBe(false);
    expect(normalized.notifyEventTypes).toEqual(
      expect.arrayContaining(['contract_end', 'deadline'])
    );
    expect(normalized.notifyEventTypes).not.toContain('offers_expiry');
    expect(normalized.recipientRoles.sort()).toEqual(['ADMIN', 'ENGINEER'].sort());
    expect(normalized.recipientUsernames).toEqual(['giorgos']);
  });

  test('all event types disabled leaves notifyEventTypes empty', () => {
    const eventTypeSettings = {};
    Object.values(NOTIFY_EVENT_TYPES).forEach((type) => {
      eventTypeSettings[type] = {
        enabled: false,
        recipientRoles: ['ADMIN'],
        recipientUsernames: [],
      };
    });
    const normalized = normalizeConfig({ eventTypeSettings });
    expect(normalized.notifyEventTypes).toEqual([]);
    expect(isNotifyEventTypeEnabled(normalized, 'deadline')).toBe(false);
  });

  test('empty roles kept when explicit usernames are set', () => {
    const normalized = normalizeConfig({
      eventTypeSettings: {
        contract_end: {
          enabled: true,
          recipientRoles: [],
          recipientUsernames: ['maria'],
        },
      },
    });
    expect(normalized.eventTypeSettings.contract_end.recipientRoles).toEqual([]);
    expect(normalized.eventTypeSettings.contract_end.recipientUsernames).toEqual(['maria']);
    expect(
      userMatchesEventTypeRecipients(
        { username: 'maria', role: 'USER' },
        normalized.eventTypeSettings.contract_end
      )
    ).toBe(true);
  });

  test('νέος τύπος εγγυητικών ενεργοποιείται όταν λείπει από παλιές ρυθμίσεις ανά τύπο', () => {
    const normalized = normalizeConfig({
      eventTypeSettings: {
        contract_end: {
          enabled: true,
          recipientRoles: ['ADMIN'],
          recipientUsernames: [],
        },
      },
    });
    expect(normalized.eventTypeSettings.contractor_registry.enabled).toBe(true);
    expect(normalized.eventTypeSettings.contractor_registry.recipientRoles).toEqual(['ADMIN', 'ENGINEER']);
    expect(normalized.notifyEventTypes).toContain('contractor_registry');
  });

  test('νέος τύπος ΝοΔε ενεργοποιείται όταν λείπει από παλιές ρυθμίσεις ανά τύπο', () => {
    const normalized = normalizeConfig({
      eventTypeSettings: {
        deadline: {
          enabled: true,
          recipientRoles: ['ADMIN'],
          recipientUsernames: [],
        },
      },
    });
    expect(normalized.eventTypeSettings.entaxi_node_deadline.enabled).toBe(true);
    expect(normalized.eventTypeSettings.entaxi_node_deadline.recipientRoles).toEqual(['ADMIN', 'ENGINEER']);
    expect(normalized.notifyEventTypes).toContain('entaxi_node_deadline');
    expect(normalized.eventTypeSettings.entaxi_end_date.enabled).toBe(true);
    expect(normalized.notifyEventTypes).toContain('entaxi_end_date');
  });

  test('ΝοΔε μπορεί να σταλεί μόνο στον υπερδιαχειριστή ή σε συγκεκριμένο άτομο', () => {
    const onlySuper = normalizeConfig({
      eventTypeSettings: {
        entaxi_node_deadline: {
          enabled: true,
          recipientRoles: ['SUPERADMIN'],
          recipientUsernames: [],
        },
      },
    });
    expect(onlySuper.eventTypeSettings.entaxi_node_deadline.recipientRoles).toEqual(['SUPERADMIN']);
    expect(userMatchesEventTypeRecipients(
      { username: 'boss', role: 'SUPERADMIN' },
      onlySuper.eventTypeSettings.entaxi_node_deadline
    )).toBe(true);
    expect(userMatchesEventTypeRecipients(
      { username: 'admin1', role: 'ADMIN' },
      onlySuper.eventTypeSettings.entaxi_node_deadline
    )).toBe(false);

    const namedOnly = normalizeConfig({
      eventTypeSettings: {
        entaxi_node_deadline: {
          enabled: true,
          recipientRoles: [],
          recipientUsernames: ['manager'],
        },
      },
    });
    expect(userMatchesEventTypeRecipients(
      { username: 'manager', role: 'ADMIN' },
      namedOnly.eventTypeSettings.entaxi_node_deadline
    )).toBe(true);
    expect(userMatchesEventTypeRecipients(
      { username: 'boss', role: 'SUPERADMIN' },
      namedOnly.eventTypeSettings.entaxi_node_deadline
    )).toBe(false);
  });

  test('userMatchesEventTypeRecipients checks role and explicit username', () => {
    const setting = getEventTypeSetting(
      {
        eventTypeSettings: {
          contract_end: {
            enabled: true,
            recipientRoles: ['ADMIN'],
            recipientUsernames: ['nikos'],
          },
        },
      },
      'contract_end'
    );
    expect(userMatchesEventTypeRecipients(
      { username: 'admin1', role: 'ADMIN' },
      setting
    )).toBe(true);
    expect(userMatchesEventTypeRecipients(
      { username: 'boss', role: 'SUPERADMIN' },
      setting
    )).toBe(true);
    expect(userMatchesEventTypeRecipients(
      { username: 'boss', role: 'SUPERADMIN' },
      getEventTypeSetting({
        eventTypeSettings: {
          entaxi_node_deadline: {
            enabled: true,
            recipientRoles: ['SUPERADMIN'],
            recipientUsernames: [],
          },
        },
      }, 'entaxi_node_deadline')
    )).toBe(true);
    expect(userMatchesEventTypeRecipients(
      { username: 'eng1', role: 'ENGINEER' },
      setting
    )).toBe(false);
    expect(userMatchesEventTypeRecipients(
      { username: 'nikos', role: 'USER' },
      setting
    )).toBe(true);
  });
});
