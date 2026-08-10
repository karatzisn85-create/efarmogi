/**
 * Μετά-επεξεργασία PPTX: ήρεμη Fade μετάβαση σε κάθε διαφάνεια.
 */
const JSZip = require('jszip');

const FADE_TRANSITION_XML = '<p:transition spd="slow"><p:fade/></p:transition>';

/**
 * Εισάγει ή αντικαθιστά p:transition Fade σε slide XML.
 * @param {string} xml
 * @returns {string}
 */
function injectSlideFadeTransition(xml) {
  if (!xml || typeof xml !== 'string') return xml;
  if (!/<p:sld[\s>]/i.test(xml)) return xml;
  if (/<p:transition\b/i.test(xml)) {
    return xml.replace(/<p:transition\b[^>]*\/>|<p:transition\b[^>]*>[\s\S]*?<\/p:transition>/i, FADE_TRANSITION_XML);
  }
  if (!/<\/p:sld>/i.test(xml)) return xml;
  return xml.replace(/<\/p:sld>/i, `${FADE_TRANSITION_XML}</p:sld>`);
}

/**
 * @param {Buffer} pptxBuffer
 * @param {{ enabled?: boolean }} [opts]
 * @returns {Promise<Buffer>}
 */
async function applyFormalSlideTransitions(pptxBuffer, { enabled = false } = {}) {
  if (!enabled) return Buffer.from(pptxBuffer);
  const zip = await JSZip.loadAsync(pptxBuffer);
  const tasks = [];
  zip.forEach((relativePath, file) => {
    if (!/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) return;
    if (file.dir) return;
    tasks.push(
      file.async('string').then((xml) => {
        const next = injectSlideFadeTransition(xml);
        zip.file(relativePath, next);
      })
    );
  });
  await Promise.all(tasks);
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  return Buffer.from(out);
}

module.exports = {
  FADE_TRANSITION_XML,
  injectSlideFadeTransition,
  applyFormalSlideTransitions,
};
