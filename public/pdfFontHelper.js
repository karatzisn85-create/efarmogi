/**
 * pdfFontHelper.js — Ενσωμάτωση TTF γραμματοσειράς με υποστήριξη ελληνικών για pdf-lib
 */
const fs = require('fs');
const path = require('path');

function getWindowsFontCandidates() {
  const fontsDir = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const names = [
    'segoeui.ttf',
    'SegoeUI.ttf',
    'arial.ttf',
    'Arial.ttf',
    'calibri.ttf',
    'Calibri.ttf',
    'verdana.ttf',
    'Verdana.ttf',
    'tahoma.ttf',
    'Tahoma.ttf',
    'times.ttf',
    'timesbd.ttf',
    'arialuni.ttf',
  ];
  return names.map((name) => path.join(fontsDir, name));
}

function getBundledFontCandidates() {
  return [
    path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf'),
    path.join(__dirname, 'fonts', 'DejaVuSans.ttf'),
  ];
}

/**
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @returns {Promise<{ font: import('pdf-lib').PDFFont, fontBold: import('pdf-lib').PDFFont } | null>}
 */
async function embedGreekPdfFont(pdfDoc) {
  let fontkit;
  try {
    fontkit = require('@pdf-lib/fontkit');
  } catch (err) {
    console.error('pdfFontHelper: @pdf-lib/fontkit not available', err.message);
    return null;
  }

  pdfDoc.registerFontkit(fontkit);

  const candidates = [...getWindowsFontCandidates(), ...getBundledFontCandidates()];
  for (const fontPath of candidates) {
    if (!fs.existsSync(fontPath)) continue;
    try {
      const bytes = fs.readFileSync(fontPath);
      const font = await pdfDoc.embedFont(bytes, { subset: true });
      return { font, fontBold: font };
    } catch (err) {
      console.warn('pdfFontHelper: skip font', fontPath, err.message);
    }
  }

  console.error('pdfFontHelper: no usable TTF font found for Greek PDF export');
  return null;
}

module.exports = {
  embedGreekPdfFont,
  getWindowsFontCandidates,
};
