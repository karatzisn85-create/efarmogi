/**
 * @jest-environment node
 */
import { getProjectChargeDisplay, resolveChargeDisplay } from './supervisorChargeDisplay';

const catalog = [
  { id: 'user:maria', username: 'maria', fullName: 'Μαρία Παπαδοπούλου' },
  { id: 'user:nikos', username: 'nikos', fullName: 'Νίκος Γεωργίου' },
];

describe('getProjectChargeDisplay', () => {
  test('εμφανίζει μηχανικό καταλόγου από ids', () => {
    const { displayChargePrimary, displayChargeParticipants } = getProjectChargeDisplay(
      { supervisorEngineerIds: ['user:maria', 'user:nikos'] },
      catalog
    );
    expect(displayChargePrimary).toBe('Μαρία Παπαδοπούλου');
    expect(displayChargeParticipants).toBe('Νίκος Γεωργίου');
  });

  test('outside mode με κενό ελεύθερο κείμενο αλλά καταγεγραμμένα ids — fallback σε κατάλογο', () => {
    const { displayChargePrimary } = getProjectChargeDisplay(
      {
        supervisorChargeOutsideEngineers: true,
        supervisorChargeFreePrimary: '',
        supervisorEngineerIds: ['user:maria'],
      },
      catalog
    );
    expect(displayChargePrimary).toBe('Μαρία Παπαδοπούλου');
  });

  test('outside mode με ελεύθερο κείμενο προτιμά το κείμενο', () => {
    const { displayChargePrimary } = getProjectChargeDisplay(
      {
        supervisorChargeOutsideEngineers: true,
        supervisorChargeFreePrimary: 'Εξωτερικός Σύμβουλος',
        supervisorEngineerIds: ['user:maria'],
      },
      catalog
    );
    expect(displayChargePrimary).toBe('Εξωτερικός Σύμβουλος');
  });

  test('ανενεργός/άγνωστος μηχανικός — εμφάνιση από user id', () => {
    const { displayChargePrimary } = getProjectChargeDisplay(
      { supervisorEngineerIds: ['user:oldeng'] },
      catalog
    );
    expect(displayChargePrimary).toBe('Oldeng');
  });

  test('legacy supervisor πεδίο ως τελευταίο fallback', () => {
    const { displayChargePrimary } = getProjectChargeDisplay(
      { supervisor: 'Παλιός Επιβλέπων' },
      catalog
    );
    expect(displayChargePrimary).toBe('Παλιός Επιβλέπων');
  });
});

describe('resolveChargeDisplay', () => {
  test('ταιριάζει username χωρίς user: prefix', () => {
    expect(resolveChargeDisplay('maria', catalog)).toBe('Μαρία Παπαδοπούλου');
  });
});
