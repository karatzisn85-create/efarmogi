/**
 * @jest-environment node
 */
const {
  collectGuaranteeReminderItems,
  itemVisibleToRecipient,
  EVENT_TYPES,
} = require('../../public/calendarEventsBuilder');

describe('collectGuaranteeReminderItems', () => {
  const project = {
    subprojectId: 'sub-1',
    subprojectTitle: 'Προμήθεια φυτών',
    projectTitle: 'Πράσινο',
    supervisorEngineerIds: ['user:giorgos'],
  };

  const records = [{
    id: 'rec-1',
    name: 'ΑΝΑΔΟΧΟΣ ΑΕ',
    guarantees: [
      {
        id: 'g-live',
        status: 'ενεργή',
        type: 'καλής εκτέλεσης',
        letterNumber: 'ΕΓΓ-9',
        expiresOn: '2099-12-01',
        subprojectId: 'sub-1',
      },
      {
        id: 'g-returned',
        status: 'επιστράφηκε',
        type: 'καλής εκτέλεσης',
        expiresOn: '2099-06-01',
        subprojectId: 'sub-1',
      },
      {
        id: 'g-nodate',
        status: 'ενεργή',
        type: 'προκαταβολής',
        subprojectId: 'sub-1',
      },
    ],
  }];

  test('συμπεριλαμβάνει μόνο ενεργές εγγυητικές με ημερομηνία λήξης', () => {
    const items = collectGuaranteeReminderItems(records, [project]);
    expect(items).toHaveLength(1);
    expect(items[0].eventType).toBe(EVENT_TYPES.CONTRACTOR_REGISTRY);
    expect(items[0].subprojectTitle).toBe('ΑΝΑΔΟΧΟΣ ΑΕ');
    expect(items[0].adam).toBe('ΕΓΓ-9');
    expect(items[0].deadlineIso).toBe('2099-12-01');
    expect(items[0].label).toContain('καλής εκτέλεσης');
    expect(items[0].project).toEqual(project);
  });

  test('διαχειριστής βλέπει την εγγυητική, χρήστης όχι', () => {
    const [item] = collectGuaranteeReminderItems(records, [project]);
    expect(itemVisibleToRecipient(item, { role: 'ADMIN', username: 'admin1' })).toBe(true);
    expect(itemVisibleToRecipient(item, { role: 'USER', username: 'reader' })).toBe(false);
  });

  test('συμπεριλαμβάνει λήξη χρόνου εγγύησης', () => {
    const withWarranty = [{
      id: 'rec-2',
      name: 'ΑΝΑΔΟΧΟΣ ΑΕ',
      guarantees: [],
      acceptances: [{
        id: 'acc-1',
        subprojectId: 'sub-1',
        warrantyEndsOn: '2099-11-01',
      }],
    }];
    const items = collectGuaranteeReminderItems(withWarranty, [project]);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Λήξη χρόνου εγγύησης');
    expect(items[0].deadlineIso).toBe('2099-11-01');
    expect(items[0].eventType).toBe(EVENT_TYPES.CONTRACTOR_REGISTRY);
  });
});
