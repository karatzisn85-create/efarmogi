/**
 * Ανάκτηση ένταξης από Διαύγεια: κάρτα πράξης + PDF + ανάγνωση προτύπου ΟΠΣ.
 */

const path = require('path');
const diavgeiaOpenData = require('./diavgeiaOpenData');
const { extractPdfText } = require('./pdfTextExtract');
const parse = require(path.join(__dirname, '..', 'app', 'core', 'entaxiDiavgeiaParse'));

function defaultPdfFileName(ada, mode) {
  const n = diavgeiaOpenData.normalizeAda(ada);
  const prefix = mode === 'modification' ? 'Τροποποίηση ένταξης' : 'Ένταξη';
  return n ? `${prefix} — Διαύγεια ${n}.pdf` : `${prefix} — Διαύγεια.pdf`;
}

async function fetchEntaxiByAda(adaRaw, { mode = 'new' } = {}) {
  const decisionRes = await diavgeiaOpenData.fetchDiavgeiaDecisionByAda(adaRaw);
  if (!decisionRes.success) return decisionRes;

  const ada = decisionRes.decision.ada;
  let pdf = null;
  let pdfError = '';
  let pdfText = '';

  const dl = await diavgeiaOpenData.downloadDiavgeiaDecisionPdf(ada, {
    documentUrl: decisionRes.decision.documentUrl,
    fileName: defaultPdfFileName(ada, mode),
  });

  if (dl.success && dl.path) {
    pdf = { path: dl.path, fileName: dl.fileName || defaultPdfFileName(ada, mode) };
    const extracted = await extractPdfText(dl.path, { maxPages: 20 });
    if (extracted.success) {
      pdfText = extracted.text || '';
      if (!String(pdfText).trim()) {
        pdfError = 'Το έγγραφο δεν περιέχει αναγνώσιμο κείμενο. Συμπληρώστε χειροκίνητα τα στοιχεία που λείπουν.';
      }
    } else {
      pdfError = extracted.error || 'Αποτυχία ανάγνωσης εγγράφου.';
    }
  } else {
    pdfError = dl.error || 'Δεν ήταν δυνατή η λήψη του εγγράφου από τη Διαύγεια.';
  }

  const extracted = parse.parseEntaxiDiavgeiaDocument({
    subject: decisionRes.decision.subject,
    pdfText,
  });

  return {
    success: true,
    decision: decisionRes.decision,
    pdf,
    pdfError: pdfError || null,
    extracted,
  };
}

module.exports = {
  fetchEntaxiByAda,
  defaultPdfFileName,
};
