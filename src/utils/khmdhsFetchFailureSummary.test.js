/**
 * @jest-environment node
 */
import {
  summarizeKhmdhsFetchFailure,
  classifyKhmdhsFailure,
  groupKhmdhsFailuresByCause,
  KHMDHS_FAILURE_CAUSES,
} from './khmdhsFetchFailureSummary';

describe('summarizeKhmdhsFetchFailure', () => {
  test('not-found style message → short retry guidance', () => {
    expect(summarizeKhmdhsFetchFailure(
      'Ο ΑΔΑΜ 26REQ019495415 δεν βρέθηκε ακόμα στα ανοικτά δεδομένα. Αν μόλις αναρτήθηκε, δοκιμάστε ξανά αργότερα.'
    )).toMatch(/δεν είναι ακόμα διαθέσιμος/i);
  });

  test('empty → generic failure', () => {
    expect(summarizeKhmdhsFetchFailure('')).toBe('Δεν ολοκληρώθηκε η ανανέωση');
  });
});

describe('classifyKhmdhsFailure', () => {
  test('ο ΑΔΑΜ δεν πέρασε ακόμη στα ανοικτά δεδομένα', () => {
    expect(classifyKhmdhsFailure(
      'Ο ΑΔΑΜ 26SYMV019495415 (σύμβαση) δεν βρέθηκε ακόμα στα ανοικτά δεδομένα του ΚΗΜΔΗΣ.'
    )).toBe(KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE);
  });

  test('η πύλη μας περιόρισε', () => {
    expect(classifyKhmdhsFailure(
      'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή. Περιμένετε λίγα δευτερόλεπτα και δοκιμάστε ξανά.'
    )).toBe(KHMDHS_FAILURE_CAUSES.BUSY);
  });

  test('ο διακομιστής δεν απαντούσε', () => {
    expect(classifyKhmdhsFailure(
      'Ο διακομιστής του ΚΗΜΔΗΣ δεν είναι προσωρινά διαθέσιμος. Δοκιμάστε ξανά σε λίγα λεπτά.'
    )).toBe(KHMDHS_FAILURE_CAUSES.BUSY);
  });

  test('λήξη χρόνου μετριέται ως φόρτος, όχι ως «άγνωστο»', () => {
    expect(classifyKhmdhsFailure(
      'Η ανάκτηση της αλυσίδας ΑΔΑΜ διήρκεσε πάρα πολύ. Δοκιμάστε αργότερα.'
    )).toBe(KHMDHS_FAILURE_CAUSES.BUSY);
  });

  test('πρόβλημα δικτύου ξεχωρίζει από πρόβλημα ΚΗΜΔΗΣ', () => {
    expect(classifyKhmdhsFailure('fetch failed')).toBe(KHMDHS_FAILURE_CAUSES.CONNECTION);
    expect(classifyKhmdhsFailure('getaddrinfo ENOTFOUND cerpp.eprocurement.gov.gr'))
      .toBe(KHMDHS_FAILURE_CAUSES.CONNECTION);
  });

  test('λάθος κωδικός στο υποέργο', () => {
    expect(classifyKhmdhsFailure('Μη έγκυρος ΑΔΑΜ σύμβασης.'))
      .toBe(KHMDHS_FAILURE_CAUSES.INVALID_ADAM);
  });

  test('κλειδωμένο από συνάδελφο', () => {
    expect(classifyKhmdhsFailure('Το υποέργο είναι κλειδωμένο από τον Γιάννη.'))
      .toBe(KHMDHS_FAILURE_CAUSES.LOCKED);
  });

  test('άγνωστο κείμενο → άλλη αιτία', () => {
    expect(classifyKhmdhsFailure('κάτι εντελώς άλλο')).toBe(KHMDHS_FAILURE_CAUSES.OTHER);
  });
});

describe('groupKhmdhsFailuresByCause', () => {
  test('μετράει ανά αιτία, από τη συχνότερη στη σπανιότερη', () => {
    const groups = groupKhmdhsFailuresByCause([
      { error: 'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή.' },
      { error: 'Ο ΑΔΑΜ δεν βρέθηκε ακόμα στα ανοικτά δεδομένα του ΚΗΜΔΗΣ.' },
      { error: 'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή.' },
      { reason: 'Η ανάκτηση της αλυσίδας ΑΔΑΜ διήρκεσε πάρα πολύ.' },
    ]);

    expect(groups[0]).toMatchObject({ cause: KHMDHS_FAILURE_CAUSES.BUSY, count: 3 });
    expect(groups[1]).toMatchObject({ cause: KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE, count: 1 });
    expect(groups[0].explanation).toBeTruthy();
  });

  test('κενή ή άκυρη λίστα δεν σπάει την αναφορά', () => {
    expect(groupKhmdhsFailuresByCause([])).toEqual([]);
    expect(groupKhmdhsFailuresByCause(null)).toEqual([]);
    expect(groupKhmdhsFailuresByCause(undefined)).toEqual([]);
  });
});
