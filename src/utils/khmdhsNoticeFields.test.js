/**
 * @jest-environment node
 */
import {
  getProjectAssignmentProcedure,
  getProjectContractProcessStartDate,
  noticeDrivesAssignmentProcedure,
  formatKhmdhsDurationLabel,
  humanizeKhmdhsDurationUnit,
} from './khmdhsNoticeFields';
import { shouldShowProcedureZone } from './projectCardDisplay';

describe('formatKhmdhsDurationLabel', () => {
  test('εμφανίζει Μήνες από κείμενο ή κωδικό ΚΗΜΔΗΣ', () => {
    expect(formatKhmdhsDurationLabel(12, 'Μήνες')).toBe('12 Μήνες');
    expect(formatKhmdhsDurationLabel(12, '3')).toBe('12 Μήνες');
    expect(humanizeKhmdhsDurationUnit('3')).toBe('Μήνες');
  });

  test('χωρίς μονάδα επιστρέφει μόνο τον αριθμό', () => {
    expect(formatKhmdhsDurationLabel(12, null)).toBe('12');
  });
});

describe('getProjectAssignmentProcedure', () => {
  test('προτιμά χειροκίνητη τιμή ακόμη κι όταν υπάρχει δημοσίευση ΚΗΜΔΗΣ', () => {
    const project = {
      assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
      khmdhsNoticeAdam: '24PROC000000001',
      khmdhsNoticeSnapshot: {
        referenceNumber: '24PROC000000001',
        title: 'Δημοσίευση',
        typeOfProcedure: 'Απευθείας Ανάθεση',
      },
    };
    expect(noticeDrivesAssignmentProcedure(project)).toBe(true);
    expect(getProjectAssignmentProcedure(project)).toBe('ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
  });

  test('επιστρέφει από snapshot όταν δεν υπάρχει χειροκίνητη τιμή', () => {
    const project = {
      khmdhsNoticeAdam: '24PROC000000001',
      khmdhsNoticeSnapshot: {
        referenceNumber: '24PROC000000001',
        title: 'Δημοσίευση',
        noticeType: 'Πρόσκληση υποβολής προσφορών',
      },
    };
    expect(getProjectAssignmentProcedure(project)).toBe('ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ');
  });

  test('επιστρέφει χειροκίνητη τιμή χωρίς δημοσίευση', () => {
    const project = { assignmentProcedure: 'ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ' };
    expect(getProjectAssignmentProcedure(project)).toBe('ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ');
  });
});

describe('getProjectContractProcessStartDate', () => {
  test('επιστρέφει αποθηκευμένη ημερομηνία', () => {
    expect(getProjectContractProcessStartDate({ contractProcessStartDate: '2024-05-10' }))
      .toBe('2024-05-10');
  });
});

describe('shouldShowProcedureZone με χειροκίνητη διαδικασία', () => {
  test('εμφανίζεται στην κάρτα όταν υπάρχει δημοσίευση και χειροκίνητη τιμή', () => {
    expect(shouldShowProcedureZone({
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
      khmdhsNoticeAdam: '24PROC000000001',
      khmdhsNoticeSnapshot: {
        referenceNumber: '24PROC000000001',
        title: 'Δημοσίευση',
      },
    })).toBe(true);
  });
});
