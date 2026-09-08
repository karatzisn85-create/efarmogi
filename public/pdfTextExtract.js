/**
 * Ανάγνωση κειμένου από PDF (χωρίς OCR — μόνο ενσωματωμένο κείμενο).
 */

const fs = require('fs');

async function extractPdfText(filePath, { maxPages = 8 } = {}) {
  const resolved = String(filePath || '').trim();
  if (!resolved) {
    return { success: false, error: 'Λείπει το αρχείο PDF.', text: '' };
  }
  if (!fs.existsSync(resolved)) {
    return { success: false, error: 'Δεν βρέθηκε το αρχείο PDF.', text: '' };
  }

  let data;
  try {
    data = new Uint8Array(fs.readFileSync(resolved));
  } catch (e) {
    return { success: false, error: e?.message || 'Αποτυχία ανάγνωσης αρχείου.', text: '' };
  }
  if (data.length < 128 || String.fromCharCode(data[0], data[1], data[2], data[3]) !== '%PDF') {
    return { success: false, error: 'Το αρχείο δεν είναι έγκυρο PDF.', text: '' };
  }

  try {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjs.getDocument({
      data,
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const pageCount = doc.numPages || 0;
    const limit = Math.min(pageCount, Math.max(1, Number(maxPages) || 8));
    let text = '';
    for (let i = 1; i <= limit; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += (content.items || []).map((item) => item.str || '').join(' ');
      text += '\n';
    }
    return { success: true, text, pageCount };
  } catch (e) {
    return {
      success: false,
      error: e?.message || 'Αποτυχία ανάγνωσης κειμένου από το PDF.',
      text: '',
    };
  }
}

module.exports = {
  extractPdfText,
};
