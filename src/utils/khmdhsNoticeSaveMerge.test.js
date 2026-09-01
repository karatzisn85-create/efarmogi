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

describe('mergeKhmdhsFieldsForSave — ADAM και γραμμές συμβάσεων', () => {
  const snapA = { referenceNumber: '24SYMV000000001', title: 'Σύμβαση Α', contractors: [{ name: 'Ανάδοχος Α' }] };
  const snapB = { referenceNumber: '24SYMV000000002', title: 'Σύμβαση Β', contractors: [{ name: 'Ανάδοχος Β' }] };

  test('νέος ΑΔΑΜ χωρίς snapshot δεν κρατά την παλιά εικόνα πράξης', () => {
    const existingData = {
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      implementationForm: 'Μια Σύμβαση',
      khmdhsAdam: '24SYMV000000001',
      khmdhsContractSnapshot: snapA,
      khmdhsContractFetchedAt: '2026-01-01T00:00:00.000Z',
    };
    const projectData = {
      ...existingData,
      khmdhsAdam: '24SYMV000000002',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: '',
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.khmdhsAdam).toBe('24SYMV000000002');
    expect(merged.khmdhsContractSnapshot).toBeNull();
  });

  test('ίδιος ΑΔΑΜ χωρίς snapshot στην αποστολή κρατά την αποθηκευμένη εικόνα', () => {
    const existingData = {
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      implementationForm: 'Μια Σύμβαση',
      khmdhsAdam: '24SYMV000000001',
      khmdhsContractSnapshot: snapA,
      khmdhsContractFetchedAt: '2026-01-01T00:00:00.000Z',
    };
    const projectData = {
      ...existingData,
      khmdhsContractSnapshot: null,
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.khmdhsAdam).toBe('24SYMV000000001');
    expect(merged.khmdhsContractSnapshot.referenceNumber).toBe('24SYMV000000001');
  });

  test('πολλές συμβάσεις συγχωνεύονται κατά ΑΔΑΜ, όχι κατά θέση γραμμής', () => {
    const existingData = {
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { id: 'r1', khmdhsAdam: '24SYMV000000001', khmdhsContractSnapshot: snapA, title: 'Γραμμή 1' },
        { id: 'r2', khmdhsAdam: '24SYMV000000002', khmdhsContractSnapshot: snapB, title: 'Γραμμή 2' },
      ],
    };
    const projectData = {
      ...existingData,
      contracts: [
        { id: 'r2', khmdhsAdam: '24SYMV000000002', khmdhsContractSnapshot: null, title: 'Πρώτη πλέον' },
        { id: 'r1', khmdhsAdam: '24SYMV000000001', khmdhsContractSnapshot: null, title: 'Δεύτερη πλέον' },
      ],
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.contracts[0].khmdhsAdam).toBe('24SYMV000000002');
    expect(merged.contracts[0].khmdhsContractSnapshot.referenceNumber).toBe('24SYMV000000002');
    expect(merged.contracts[1].khmdhsAdam).toBe('24SYMV000000001');
    expect(merged.contracts[1].khmdhsContractSnapshot.referenceNumber).toBe('24SYMV000000001');
  });

  test('νέα κενή γραμμή δεν παίρνει τα στοιχεία ΚΗΜΔΗΣ της παλιάς πρώτης γραμμής', () => {
    const existingData = {
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { id: 'r1', khmdhsAdam: '24SYMV000000001', khmdhsContractSnapshot: snapA },
      ],
    };
    const projectData = {
      ...existingData,
      contracts: [
        { id: 'new', khmdhsAdam: '', khmdhsContractSnapshot: null },
        { id: 'r1', khmdhsAdam: '24SYMV000000001', khmdhsContractSnapshot: null },
      ],
    };
    const merged = mergeKhmdhsFieldsForSave(projectData, existingData);
    expect(merged.contracts[0].khmdhsAdam).toBe('');
    expect(merged.contracts[0].khmdhsContractSnapshot).toBeNull();
    expect(merged.contracts[1].khmdhsAdam).toBe('24SYMV000000001');
    expect(merged.contracts[1].khmdhsContractSnapshot.referenceNumber).toBe('24SYMV000000001');
  });
});
