/**
 * Ανάκτηση πρόσκλησης από Διαύγεια: κάρτα πράξης + ανάγνωση PDF για κωδικό / εύρος / λήξη.
 */

const path = require('path');
const diavgeiaOpenData = require('./diavgeiaOpenData');
const { extractPdfText } = require('./pdfTextExtract');
const { isE2EProcess } = require('./e2eMode');
const pdf = require(path.join(__dirname, '..', 'app', 'core', 'prosklisiDiavgeiaPdf'));

function defaultPdfFileName(ada) {
  const n = diavgeiaOpenData.normalizeAda(ada);
  return n ? `Πρόσκληση — Διαύγεια ${n}.pdf` : 'Πρόσκληση — Διαύγεια.pdf';
}

async function fetchProsklisiByAda(adaRaw) {
  const decisionRes = await diavgeiaOpenData.fetchDiavgeiaDecisionByAda(adaRaw);
  if (!decisionRes.success) return decisionRes;

  const decision = decisionRes.decision;
  let pdfFields = {};
  let pdfError = null;

  if (isE2EProcess()) {
    return { success: true, decision, pdfFields, pdfError: null };
  }

  const ada = decision.ada;
  const dl = await diavgeiaOpenData.downloadDiavgeiaDecisionPdf(ada, {
    documentUrl: decision.documentUrl,
    fileName: defaultPdfFileName(ada),
  });

  if (dl.success && dl.path) {
    const extracted = await extractPdfText(dl.path, { maxPages: 10 });
    if (extracted.success) {
      const text = extracted.text || '';
      if (String(text).trim()) {
        pdfFields = pdf.extractProsklisiFieldsFromPdfText(text);
      } else {
        pdfError = 'Το έγγραφο δεν περιέχει αναγνώσιμο κείμενο. Συμπληρώστε χειροκίνητα όσα λείπουν.';
      }
    } else {
      pdfError = extracted.error || 'Αποτυχία ανάγνωσης εγγράφου.';
    }
  } else {
    pdfError = dl.error || 'Δεν ήταν δυνατή η λήψη του εγγράφου από τη Διαύγεια.';
  }

  return {
    success: true,
    decision,
    pdfFields,
    pdfError,
  };
}

module.exports = {
  fetchProsklisiByAda,
  defaultPdfFileName,
};
