/**
 * @jest-environment node
 */
const {
  organizationNameScore,
  organizationSearchQueries,
  buildIssueDateWindows,
  neededIssueDateWindows,
} = require('../../public/diavgeiaOpenData');

describe('organizationNameScore', () => {
  it('ταιριάζει το όνομα του δήμου όπως το κρατά η εφαρμογή με το επίσημο της Διαύγειας', () => {
    const score = organizationNameScore(
      'Δήμος Αρχανών-Αστερούσιων',
      'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ'
    );
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeGreaterThan(
      organizationNameScore('Δήμος Αρχανών-Αστερούσιων', 'ΜΗΤΡΩΟ ΔΗΜΟΥ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ')
    );
  });

  it('ταιριάζει και το κεφαλαίο επίσημο όνομα', () => {
    expect(organizationNameScore(
      'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
      'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ'
    )).toBeGreaterThanOrEqual(3);
  });

  it('τα παράθυρα αναζήτησης φτάνουν μέχρι σήμερα και για παλιά ένταξη', () => {
    const from = '2020-01-15';
    const to = '2026-09-13';
    const maxWindows = neededIssueDateWindows(from, to);
    expect(maxWindows).toBeGreaterThan(6);
    const windows = buildIssueDateWindows(from, to, { maxWindows });
    expect(windows[0].from).toBe(from);
    expect(windows[windows.length - 1].to).toBe(to);
  });

  it('χτίζει εναλλακτικές φράσεις αναζήτησης χωρίς παύλα', () => {
    const queries = organizationSearchQueries('Δήμος Αρχανών-Αστερούσιων');
    expect(queries[0]).toBe('Δήμος Αρχανών-Αστερούσιων');
    expect(queries.some((q) => /αρχανων/i.test(q))).toBe(true);
  });
});
