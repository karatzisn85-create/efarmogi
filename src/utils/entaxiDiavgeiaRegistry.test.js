/**
 * @jest-environment node
 */
import {
  getEntaxiDiavgeiaOpenUrl,
  getEntaxiDiavgeiaViewUrl,
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
});
