/**
 * @jest-environment node
 */
const {
  injectSlideFadeTransition,
  applyFormalSlideTransitions,
  FADE_TRANSITION_XML,
} = require('../../public/apologismosPptxMotion');

describe('apologismosPptxMotion', () => {
  test('injectSlideFadeTransition προσθέτει fade πριν το κλείσιμο sld', () => {
    const xml = '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>';
    const out = injectSlideFadeTransition(xml);
    expect(out).toContain(FADE_TRANSITION_XML);
    expect(out.indexOf('<p:transition')).toBeLessThan(out.indexOf('</p:sld>'));
  });

  test('injectSlideFadeTransition αντικαθιστά υπάρχον transition', () => {
    const xml = '<p:sld><p:cSld/><p:transition spd="fast"><p:push/></p:transition></p:sld>';
    const out = injectSlideFadeTransition(xml);
    expect(out).toContain('<p:fade/>');
    expect(out).not.toContain('<p:push/>');
    expect(out.match(/<p:transition/g)).toHaveLength(1);
  });

  test('applyFormalSlideTransitions disabled αφήνει buffer ίδιο', async () => {
    const buf = Buffer.from([1, 2, 3, 4]);
    const out = await applyFormalSlideTransitions(buf, { enabled: false });
    expect(Buffer.compare(buf, out)).toBe(0);
  });

  test('applyFormalSlideTransitions enabled βάζει fade σε slide XML', async () => {
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file(
      'ppt/slides/slide1.xml',
      '<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld/></p:sld>'
    );
    zip.file('[Content_Types].xml', '<Types></Types>');
    const input = await zip.generateAsync({ type: 'nodebuffer' });
    const out = await applyFormalSlideTransitions(input, { enabled: true });
    const loaded = await JSZip.loadAsync(out);
    const slideXml = await loaded.file('ppt/slides/slide1.xml').async('string');
    expect(slideXml).toContain('<p:fade/>');
    expect(slideXml).toContain('spd="slow"');
  });
});
