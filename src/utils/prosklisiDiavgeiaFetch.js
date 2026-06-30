/**
 * Αντιστοίχιση πράξης Διαύγειας → πεδία φόρμας πρόσκλησης.
 */

import { buildDiavgeiaApePreview, normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import { getProsklisiDiavgeiaOpenUrl } from './prosklisiDiavgeiaRegistry';

export function buildDefaultProsklisiPdfFileName(ada) {
  const n = normalizeDiavgeiaAda(ada);
  return n ? `Πρόσκληση — Διαύγεια ${n}.pdf` : 'Πρόσκληση — Διαύγεια.pdf';
}

export function extractAxisFromSubject(subject) {
  const s = String(subject || '');
  const axisMatch = s.match(/ΑΞΟΝΑ[^:]*:\s*[«"]([^»"]+)[»"]/iu);
  if (axisMatch) return axisMatch[1].trim();
  const titleMatch = s.match(/ΜΕ ΤΙΤΛΟ:\s*[«"]([^»"]+)[»"]/iu);
  if (titleMatch) return titleMatch[1].trim();
  return '';
}

export function subjectLooksLikeModification(subject) {
  return /ΤΡΟΠΟΠΟΙΗΣΗ/i.test(String(subject || ''));
}

export function extractModificationDescriptionFromSubject(subject) {
  const s = String(subject || '').replace(/\s+/g, ' ').trim();
  if (!subjectLooksLikeModification(s)) return '';
  const m = s.match(/^(\d+η\s+)?ΤΡΟΠΟΠΟΙΗΣΗ[^.]{0,160}/iu);
  return m ? m[0].trim() : 'Τροποποίηση πρόσκλησης (από Διαύγεια)';
}

/**
 * Πηγή χρηματοδότησης = φορέας έκδοσης του εγγράφου (από Διαύγεια).
 * Για ΝΠΔΔ/υπηρεσίες υπό υπουργείο: υπουργείο + φορέας σε δύο γραμμές.
 */
export function buildFundingSourceFromDecision(decision) {
  const org = String(decision?.organization || '').trim();
  const supervisor = String(decision?.organizationSupervisor || '').trim();

  if (supervisor && org && supervisor !== org) {
    return `${supervisor}\n${org}`;
  }
  return org || supervisor;
}

export function buildProsklisiTitleFromSubject(subject) {
  return String(subject || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {object|null} decision — από IPC diavgeia-fetch-decision-by-ada
 * @param {'new'|'modification'} mode
 */
export function mapDiavgeiaDecisionToProsklisiFields(decision, mode = 'new') {
  const preview = buildDiavgeiaApePreview(decision);
  const subject = preview.subject;
  const fields = {};
  const autoFilledKeys = [];

  // Η τροποποίηση ΔΕΝ είναι ανεξάρτητη πρόσκληση: τα πεδία της πρόσκλησης
  // (τίτλος, άξονας, πηγή, κωδικός) δεν αλλάζουν εδώ. Συμπληρώνουμε μόνο
  // τα στοιχεία που αφορούν την ίδια την τροποποίηση.
  if (mode === 'modification') {
    if (preview.issueDate) {
      fields.modificationDocumentDate = preview.issueDate;
      autoFilledKeys.push('modificationDocumentDate');
    }
    const modDesc = extractModificationDescriptionFromSubject(subject);
    if (modDesc) {
      fields.modificationDescription = modDesc;
      autoFilledKeys.push('modificationDescription');
    }
    return { fields, autoFilledKeys, preview };
  }

  if (subject) {
    fields.title = buildProsklisiTitleFromSubject(subject);
    autoFilledKeys.push('title');
  }

  const axis = extractAxisFromSubject(subject);
  if (axis) {
    fields.axis = axis;
    autoFilledKeys.push('axis');
  }

  const funding = buildFundingSourceFromDecision(decision);
  if (funding) {
    fields.fundingSource = funding;
    autoFilledKeys.push('fundingSource');
  }

  // Ο κωδικός πρόσκλησης (π.χ. Π.Ι. 2025-2026) δεν παρέχεται από τη Διαύγεια — μόνο στο PDF.

  return { fields, autoFilledKeys, preview };
}

export function buildProsklisiDiavgeiaMeta(preview) {
  if (!preview?.ada) return null;
  return {
    ada: preview.ada,
    protocolNumber: preview.protocolNumber || '',
    organization: preview.organization || '',
    subject: preview.subject || '',
    issueDate: preview.issueDate || '',
    issueDateDisplay: preview.issueDateDisplay || '',
    documentUrl: preview.documentUrl || getProsklisiDiavgeiaOpenUrl(preview),
    fetchedAt: new Date().toISOString(),
  };
}

export const PROSKLISI_MANUAL_FIELDS_NEW = [
  'Κωδικός πρόσκλησης (από το έγγραφο)',
  'Ημερομηνία λήξης υποβολής',
  'Εύρος προϋπολογισμού',
  'Άξονας (αν δεν εξήχθη από το θέμα)',
  'Συσχέτιση με έργα',
];

export const PROSKLISI_MANUAL_FIELDS_MODIFICATION = [
  'Νέα ημερομηνία λήξης υποβολής (από το έγγραφο)',
];
