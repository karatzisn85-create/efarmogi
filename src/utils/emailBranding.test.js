/**
 * @jest-environment node
 */
const {
  greekUpperNoTonos,
  buildEmailHtml,
  buildAppOpenPromptHtml,
} = require('../../public/taskAssignmentEmailService');

describe('email branding helpers', () => {
  test('greekUpperNoTonos αφαιρεί τόνους σε κεφαλαία', () => {
    expect(greekUpperNoTonos('Προθεσμία')).toBe('ΠΡΟΘΕΣΜΙΑ');
    expect(greekUpperNoTonos('Επείγον')).toBe('ΕΠΕΙΓΟΝ');
    expect(greekUpperNoTonos('Συμμόρφωση')).toBe('ΣΥΜΜΟΡΦΩΣΗ');
  });

  test('buildEmailHtml badge χωρίς τόνο', () => {
    const html = buildEmailHtml({
      appName: 'ergoHub',
      badgeLabel: 'Προθεσμία',
      badgeColor: '#059669',
      headline: 'Δοκιμή',
      workspaceTitle: 'Ημερολόγιο Προθεσμιών',
      rows: [],
      useCidLogo: false,
    });
    expect(html).toContain('ΠΡΟΘΕΣΜΙΑ');
    expect(html).not.toContain('ΠΡΟΘΕΣΜΊΑ');
    expect(html).toContain('παρακαλούμε ανοίξτε την εφαρμογή');
  });

  test('buildAppOpenPromptHtml είναι επίσημη και διακριτική', () => {
    const block = buildAppOpenPromptHtml('ergoHub');
    expect(block).toContain('Ενημέρωση');
    expect(block).toContain('ergoHub');
    expect(block).toContain('παρακαλούμε ανοίξτε την εφαρμογή');
  });
});
