/**
 * @jest-environment node
 */
import {
  orimanthiHasPendingPermit,
  summarizeOrimanthiPermits,
} from './orimanthiFileCategories';

describe('orimanthi permit progress', () => {
  const groups = [
    { id: 's', fileCategoryRoot: 'meletes', fileCategorySpec: 'ΤΟΠΟΓΡΑΦΙΚΑ' },
    { id: 'a', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ', permitIssued: true },
    { id: 'b', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: true },
    { id: 'c', fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ', permitIssued: false },
  ];

  it('μετρά μόνο τις αδειοδοτήσεις', () => {
    expect(summarizeOrimanthiPermits(groups)).toEqual({ total: 3, issued: 2, pending: 1 });
    expect(orimanthiHasPendingPermit(groups)).toBe(true);
  });

  it('χωρίς φακέλους αδειών δεν είναι εκκρεμότητα', () => {
    expect(summarizeOrimanthiPermits([{ fileCategoryRoot: 'meletes' }])).toEqual({
      total: 0, issued: 0, pending: 0,
    });
    expect(orimanthiHasPendingPermit([])).toBe(false);
  });
});
