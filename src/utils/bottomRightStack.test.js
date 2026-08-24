/**
 * @jest-environment node
 */
import {
  DEFAULT_CORNER_BOTTOM_PX,
  OPS_STACK_BOTTOM_PX,
  computeFabClearancePx,
} from './bottomRightStack';

describe('computeFabClearancePx', () => {
  test('χωρίς FAB → προεπιλογή κάτω άκρης', () => {
    expect(computeFabClearancePx()).toBe(DEFAULT_CORNER_BOTTOM_PX);
    expect(computeFabClearancePx({ notesVisible: false, opsVisible: false })).toBe(
      DEFAULT_CORNER_BOTTOM_PX
    );
  });

  test('μόνο σημειώσεις → πάνω από το NotesFab', () => {
    const px = computeFabClearancePx({ notesVisible: true });
    expect(px).toBeGreaterThan(DEFAULT_CORNER_BOTTOM_PX);
    expect(px).toBe(86); // 24 + 50 + 12
  });

  test('ops χωρίς ΚΗΜΔΗΣ → πάνω από τη στοίβα ops', () => {
    const px = computeFabClearancePx({ notesVisible: true, opsVisible: true });
    expect(px).toBeGreaterThan(OPS_STACK_BOTTOM_PX);
    expect(px).toBe(OPS_STACK_BOTTOM_PX + 50 + 12);
  });

  test('ops με ΚΗΜΔΗΣ → ψηλότερα από χωρίς ΚΗΜΔΗΣ', () => {
    const without = computeFabClearancePx({ opsVisible: true, khmdhsVisible: false });
    const withKh = computeFabClearancePx({ opsVisible: true, khmdhsVisible: true });
    expect(withKh).toBeGreaterThan(without);
  });

  test('ops με οδηγό → ψηλότερα ώστε να μην καλύπτει το νέο κουμπί', () => {
    const without = computeFabClearancePx({ opsVisible: true, khmdhsVisible: true });
    const withHelp = computeFabClearancePx({
      opsVisible: true,
      khmdhsVisible: true,
      helpVisible: true,
    });
    expect(withHelp).toBe(without + 12 + 50);
  });
});
