/**
 * @jest-environment node
 */
import {
  getEntaxiDiavgeiaOpenUrl,
  getEntaxiDiavgeiaViewUrl,
  getEntaxiDiavgeiaAdaText,
} from './entaxiDiavgeiaRegistry';

describe('entaxiDiavgeiaRegistry', () => {
  it('ανοίγει την κάρτα πράξης, όχι τη λήψη PDF', () => {
    const ada = '9ΖΣΕ7ΛΚ-Ρ47';
    const url = getEntaxiDiavgeiaViewUrl({
      ada,
      documentUrl: `https://diavgeia.gov.gr/doc/${ada}`,
    });
    expect(url).toBe(`https://diavgeia.gov.gr/decision/view/${encodeURIComponent(ada)}`);
    expect(url).not.toContain('/doc/');
    expect(getEntaxiDiavgeiaOpenUrl({ ada })).toBe(url);
  });

  it('διαβάζει ΑΔΑ και από το καταχωρημένο έγγραφο Διαύγειας', () => {
    expect(getEntaxiDiavgeiaAdaText({
      diavgeiaDocument: { ada: 'Ψ84Ρ7ΛΚ-ΑΨΝ' },
    })).toBe('Ψ84Ρ7ΛΚ-ΑΨΝ');
  });
});
