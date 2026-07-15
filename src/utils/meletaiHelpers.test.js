/**
 * @jest-environment node
 */
import { parseAssignedToNames, formatAssignedToNames } from './meletaiHelpers';

describe('parseAssignedToNames', () => {
  test('διαχωρίζει ονόματα με κόμμα', () => {
    expect(parseAssignedToNames('Γιώργος Παπαδόπουλος, Μαρία Ιωάννου')).toEqual([
      'Γιώργος Παπαδόπουλος',
      'Μαρία Ιωάννου',
    ]);
  });

  test('διαχωρίζει και με ελληνικό ερωτηματικό/άνω τελεία δεν επηρεάζεται — μόνο κόμμα/;', () => {
    expect(parseAssignedToNames('Α; Β')).toEqual(['Α', 'Β']);
  });

  test('αγνοεί κενά ονόματα και επιπλέον κενά', () => {
    expect(parseAssignedToNames('  Α  ,, Β ,')).toEqual(['Α', 'Β']);
  });

  test('μεμονωμένο όνομα (backward compatible με παλιά records)', () => {
    expect(parseAssignedToNames('Γιώργος Παπαδόπουλος')).toEqual(['Γιώργος Παπαδόπουλος']);
  });

  test('κενή/null τιμή', () => {
    expect(parseAssignedToNames('')).toEqual([]);
    expect(parseAssignedToNames(null)).toEqual([]);
    expect(parseAssignedToNames(undefined)).toEqual([]);
  });
});

describe('formatAssignedToNames', () => {
  test('ενώνει ονόματα με κόμμα', () => {
    expect(formatAssignedToNames(['Α', 'Β'])).toBe('Α, Β');
  });

  test('αφαιρεί διπλότυπα χωρίς να ενδιαφέρει το πεζά/κεφαλαία', () => {
    expect(formatAssignedToNames(['Γιαννης', 'ΓΙΑΝΝΗΣ', 'Μαρια'])).toBe('Γιαννης, Μαρια');
  });

  test('αγνοεί κενά ονόματα', () => {
    expect(formatAssignedToNames(['Α', '', '  ', 'Β'])).toBe('Α, Β');
  });

  test('κενή λίστα', () => {
    expect(formatAssignedToNames([])).toBe('');
    expect(formatAssignedToNames(null)).toBe('');
  });

  test('round-trip με parseAssignedToNames', () => {
    const original = 'Γιώργος Παπαδόπουλος, Μαρία Ιωάννου';
    expect(formatAssignedToNames(parseAssignedToNames(original))).toBe(original);
  });
});
