/**
 * @jest-environment node
 */
const { mergeKhmdhsFieldsForSave } = require('../../public/khmdhsOpenData');

describe('mergeKhmdhsFieldsForSave — assignmentProcedure κατά την αποθήκευση', () => {
  const noticeSnapshot = {
    referenceNumber: '23PROC013450673',
    title: 'ΔΟΚΙΜΑΣΤΙΚΟ ΕΡΓΟ',
    noticeType: 'Διακήρυξη',
    mappedAssignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
  };

  test('διατηρεί την τιμή που υπολόγισε ο renderer αντί να τη μηδενίζει (bug: μήνυμα epeat)', () => {
    // Αυτό είναι το σενάριο του πραγματικού bug: η φόρμα (renderer) έχει ήδη υπολογίσει
    // σωστά το assignmentProcedure από τη δημοσίευση, αλλά η αποθήκευση το μηδένιζε άνευ
    // όρων κάθε φορά — με αποτέλεσμα η επόμενη ανανέωση ΚΗΜΔΗΣ να το «ανακαλύπτει» ξανά.
    const existingData = {
      khmdhsNoticeAdam: '',
      khmdhsNoticeSnapshot: null,
      assignmentProcedure: '',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      implementationForm: 'Μια Σύμβαση',
    };
    const projectData = {
      ...existingData,
      khmdhsNoticeAdam: '23PROC013450673',
      khmdhsNoticeSnapshot: noticeSnapshot,
      khmdhsNoticeFetchedAt: '2026-01-01T00:00:00.000Z',
      assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.assignmentProcedure).toBe('ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
  });

  test('παράγει αυτόματα τη διαδικασία από το snapshot όταν ο renderer δεν έστειλε τιμή', () => {
    const existingData = { projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ', implementationForm: 'Μια Σύμβαση' };
    const projectData = {
      ...existingData,
      khmdhsNoticeAdam: '23PROC013450673',
      khmdhsNoticeSnapshot: noticeSnapshot,
      assignmentProcedure: '',
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.assignmentProcedure).toBe('ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
  });

  test('διατηρεί μια πραγματική χειροκίνητη επιλογή διαφορετική από τη δημοσίευση', () => {
    const existingData = { projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ', implementationForm: 'Μια Σύμβαση' };
    const projectData = {
      ...existingData,
      khmdhsNoticeAdam: '23PROC013450673',
      khmdhsNoticeSnapshot: noticeSnapshot,
      assignmentProcedure: 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ',
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.assignmentProcedure).toBe('ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ');
  });

  test('κατά την αποθήκευση δεν χάνει τη μονάδα ισχύος προσφορών από ήδη mapped snapshot', () => {
    const existingData = {
      projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
      implementationForm: 'Μια Σύμβαση',
    };
    const projectData = {
      ...existingData,
      khmdhsNoticeAdam: '26PROC019490561',
      khmdhsNoticeFetchedAt: '2026-07-22T10:00:00.000Z',
      khmdhsNoticeSnapshot: {
        referenceNumber: '26PROC019490561',
        title: 'Επισκευές γεωτρήσεων ύδρευσης.',
        offersValidTime: 12,
        offersValidTimeUnit: 'Μήνες',
        contractDuration: 1,
        contractDurationUnit: 'Μήνες',
      },
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.khmdhsNoticeSnapshot.offersValidTime).toBe(12);
    expect(merged.khmdhsNoticeSnapshot.offersValidTimeUnit).toBe('Μήνες');
    expect(merged.khmdhsNoticeSnapshot.contractDurationUnit).toBe('Μήνες');
  });
});
