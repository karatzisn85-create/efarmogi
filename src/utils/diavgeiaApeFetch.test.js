/**
 * @jest-environment node
 */
import {
  buildDiavgeiaApeCommentSuffix,
  buildDiavgeiaApePreview,
  isValidDiavgeiaAdaFormat,
  normalizeDiavgeiaAda,
} from './diavgeiaApeFetch';

describe('diavgeiaApeFetch', () => {
  test('normalizeDiavgeiaAda', () => {
    expect(normalizeDiavgeiaAda(' ρωεκωψμ-σ0υ ')).toBe('ΡΩΕΚΩΨΜ-Σ0Υ');
  });

  test('isValidDiavgeiaAdaFormat', () => {
    expect(isValidDiavgeiaAdaFormat('ΡΩΕΚΩΨΜ-Σ0Υ')).toBe(true);
    expect(isValidDiavgeiaAdaFormat('invalid')).toBe(false);
    expect(isValidDiavgeiaAdaFormat('')).toBe(false);
  });

  test('buildDiavgeiaApePreview', () => {
    const preview = buildDiavgeiaApePreview({
      ada: 'ρωεκωψμ-σ0υ',
      protocolNumber: '334-2025',
      subject: 'ΑΠΕ δοκιμή',
      issueDate: '2025-10-27',
      organization: 'Δήμος Αρχανών-Αστερουσίων',
      documentUrl: 'https://diavgeia.gov.gr/doc/ΡΩΕΚΩΨΜ-Σ0Υ',
    });
    expect(preview.ada).toBe('ΡΩΕΚΩΨΜ-Σ0Υ');
    expect(preview.protocolNumber).toBe('334-2025');
    expect(preview.subject).toBe('ΑΠΕ δοκιμή');
    expect(preview.organization).toContain('Αρχανών');
    expect(preview.documentUrl).toContain('diavgeia.gov.gr');
    expect(preview.amount).toBeUndefined();
  });

  test('buildDiavgeiaApeCommentSuffix', () => {
    expect(buildDiavgeiaApeCommentSuffix({
      ada: 'ΡΩΕΚΩΨΜ-Σ0Υ',
      protocolNumber: '334-2025',
    })).toBe('ΑΔΑ Διαύγειας: ΡΩΕΚΩΨΜ-Σ0Υ · Πρωτ. 334-2025');
  });
});
