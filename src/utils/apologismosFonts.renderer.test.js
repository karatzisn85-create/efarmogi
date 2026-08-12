/**
 * @jest-environment node
 *
 * Έλεγχοι resolver URL χωρίς φόρτωση @react-pdf.
 */
import {
  resolveApologismosFontUrl,
  APOLOGISMOS_CSS_FONT_FAMILY,
  APOLOGISMOS_PDF_FONT_FAMILY,
  APOLOGISMOS_CSS_FONT_STACK,
} from './apologismosFonts';

describe('apologismosFonts renderer URL', () => {
  test('resolveApologismosFontUrl χτίζει path fonts/apologismos', () => {
    const url = resolveApologismosFontUrl('DejaVuSans.ttf');
    expect(url.replace(/\\/g, '/')).toContain('fonts/apologismos/DejaVuSans.ttf');
  });

  test('οικογένειες CSS/PDF ευθυγραμμισμένες', () => {
    expect(APOLOGISMOS_PDF_FONT_FAMILY).toBe('DejaVu');
    expect(APOLOGISMOS_CSS_FONT_FAMILY).toBe('DejaVu Sans');
    expect(APOLOGISMOS_CSS_FONT_STACK).toContain('DejaVu Sans');
  });
});
