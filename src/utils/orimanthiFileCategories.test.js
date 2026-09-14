/**
 * @jest-environment node
 */
import {
  orimanthiHasPendingPermit,
  summarizeOrimanthiPermits,
  getAdeiodotiseisSpecs,
  filterHiddenSpecs,
  appendFileCategoryGroups,
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

describe('orimanthi file spec catalog', () => {
  it('κρύβει εξειδικεύσεις που αφαιρέθηκαν από τη λίστα', () => {
    expect(filterHiddenSpecs(['Α', 'Β'], ['β'])).toEqual(['Α']);
    const visible = getAdeiodotiseisSpecs(['ΝΕΑ ΑΔΕΙΑ'], ['ΟΠΕΚΕΠΕ']);
    expect(visible).toContain('ΝΕΑ ΑΔΕΙΑ');
    expect(visible).toContain('ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ');
    expect(visible).not.toContain('ΟΠΕΚΕΠΕ');
  });

  it('προσθέτει πολλές εξειδικεύσεις μαζί χωρίς να χάνεται καμία', () => {
    const existing = [{
      id: 'fg-permit-arch',
      fileCategoryRoot: 'adeiodotiseis',
      fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
    }];
    let n = 0;
    const { groups, added } = appendFileCategoryGroups(existing, [
      { rootId: 'adeiodotiseis', spec: 'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ' },
      { rootId: 'adeiodotiseis', spec: 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ' },
      { rootId: 'adeiodotiseis', spec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ' },
    ], () => `id-${++n}`);
    expect(added.map((g) => g.fileCategorySpec)).toEqual(['ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ', 'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ']);
    expect(groups.map((g) => g.fileCategorySpec)).toEqual([
      'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ',
      'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ',
      'ΥΠΗΡΕΣΙΑ ΔΟΜΗΣΗΣ',
    ]);
  });
});
