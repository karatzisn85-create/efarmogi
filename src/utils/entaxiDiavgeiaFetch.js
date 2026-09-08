/**
 * Αντιστοίχιση πράξης Διαύγειας + ανάγνωσης PDF → πεδία φόρμας ένταξης.
 */

import { buildDiavgeiaApePreview, normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import { buildFundingSourceFromDecision } from './prosklisiDiavgeiaFetch';
import { getEntaxiDiavgeiaOpenUrl } from './entaxiDiavgeiaRegistry';

const parse = require('../../app/core/entaxiDiavgeiaParse');

export function buildDefaultEntaxiPdfFileName(ada, mode = 'new') {
  const n = normalizeDiavgeiaAda(ada);
  const prefix = mode === 'modification' ? 'Τροποποίηση ένταξης' : 'Ένταξη';
  return n ? `${prefix} — Διαύγεια ${n}.pdf` : `${prefix} — Διαύγεια.pdf`;
}

export function mapDiavgeiaDecisionToEntaxiFields(decision, extracted = {}, mode = 'new') {
  const preview = buildDiavgeiaApePreview(decision);
  const parsed = extracted && typeof extracted === 'object' && ('opsCode' in extracted || 'kind' in extracted)
    ? extracted
    : parse.parseEntaxiDiavgeiaDocument({
      subject: preview.subject || decision?.subject,
      pdfText: extracted?.pdfText || '',
    });

  const fields = {};
  const autoFilledKeys = [];
  const missingFromPdf = [];

  const push = (key, value) => {
    if (value == null || String(value).trim() === '') return;
    fields[key] = String(value).trim();
    autoFilledKeys.push(key);
  };

  if (mode === 'modification') {
    push('date', preview.issueDate || parsed.documentDate);
    push('comments', parsed.modificationDescription || parsed.subject);
    if (parsed.initialAmount) {
      fields.changeAmount = true;
      autoFilledKeys.push('changeAmount');
      push('amount', parsed.initialAmount);
    }
    push('legalCommitmentDeadline', parsed.legalCommitmentDeadline);
    push('opsCode', parsed.opsCode);
    push('endDate', parsed.endDate);
    if (!parsed.legalCommitmentDeadline) {
      missingFromPdf.push(
        parsed.noObligationDeadline
          ? 'Προθεσμία ΝοΔε (το έγγραφο γράφει ότι δεν υπάρχει προθεσμία ανάληψης υποχρέωσης)'
          : 'Προθεσμία ΝοΔε'
      );
    }
    if (!parsed.initialAmount) missingFromPdf.push('Νέο ποσό (αν άλλαξε)');
    return { fields, autoFilledKeys, preview, parsed, missingFromPdf };
  }

  push('subject', parsed.subject || preview.subject);
  push('documentDate', preview.issueDate || parsed.documentDate);
  push('fundingAuthority', buildFundingSourceFromDecision(decision));
  push('initialAmount', parsed.initialAmount);
  push('opsCode', parsed.opsCode);
  push('legalCommitmentDeadline', parsed.legalCommitmentDeadline);
  push('startDate', parsed.startDate);
  push('endDate', parsed.endDate);
  push('beneficiary', parsed.beneficiary);

  if (!parsed.initialAmount) missingFromPdf.push('Ποσό χρηματοδότησης');
  if (!parsed.legalCommitmentDeadline) {
    missingFromPdf.push(
      parsed.noObligationDeadline
        ? 'Προθεσμία ΝοΔε (το έγγραφο γράφει ότι δεν υπάρχει προθεσμία ανάληψης υποχρέωσης)'
        : 'Προθεσμία ΝοΔε'
    );
  }
  if (!parsed.opsCode) missingFromPdf.push('Κωδικός ΟΠΣ');
  if (!parsed.endDate) missingFromPdf.push('Λήξη πράξης');

  return { fields, autoFilledKeys, preview, parsed, missingFromPdf };
}

export function buildEntaxiDiavgeiaMeta(preview, parsed) {
  if (!preview?.ada) return null;
  return {
    ada: preview.ada,
    protocolNumber: preview.protocolNumber || '',
    organization: preview.organization || '',
    subject: preview.subject || '',
    issueDate: preview.issueDate || '',
    issueDateDisplay: preview.issueDateDisplay || '',
    documentUrl: getEntaxiDiavgeiaOpenUrl(preview),
    fetchedAt: new Date().toISOString(),
    extracted: parsed
      ? {
        opsCode: parsed.opsCode || '',
        subjectOpsCode: parsed.subjectOpsCode || '',
        pdfOpsCode: parsed.pdfOpsCode || '',
        opsMismatch: !!parsed.opsMismatch,
        subjectMismatch: !!parsed.subjectMismatch,
        cardSubject: parsed.cardSubject || '',
        pdfSubject: parsed.pdfSubject || '',
        legalCommitmentDeadline: parsed.legalCommitmentDeadline || '',
        legalCommitmentStatus: parsed.legalCommitmentStatus || '',
        noObligationDeadline: !!parsed.noObligationDeadline,
        initialAmount: parsed.initialAmount || '',
        startDate: parsed.startDate || '',
        endDate: parsed.endDate || '',
        beneficiary: parsed.beneficiary || '',
        programme: parsed.programme || '',
      }
      : null,
  };
}

export const ENTAXI_MANUAL_FIELDS_NEW = [
  'Συσχέτιση με έργο / υποέργα / πρόσκληση',
  'Ό,τι δεν βρέθηκε στο έγγραφο (ποσό, ΟΠΣ ή ΝοΔε)',
];

export const ENTAXI_MANUAL_FIELDS_MODIFICATION = [
  'Σχόλια τροποποίησης (αν δεν βγήκαν από το θέμα)',
  'Νέο ποσό, αν άλλαξε και δεν βρέθηκε στο έγγραφο',
  'Λήξη πράξης, αν άλλαξε και δεν βρέθηκε στο έγγραφο',
];

/** Καθαρίζει πεδία που γέμισε η προηγούμενη ανάκτηση και δεν υπάρχουν στη νέα. */
export function mergeDiavgeiaFormFields(prev, fields, previousAutoKeys, parsed) {
  const next = { ...(prev || {}) };
  const prevAuto = previousAutoKeys instanceof Set
    ? previousAutoKeys
    : new Set(Array.isArray(previousAutoKeys) ? previousAutoKeys : []);
  prevAuto.forEach((key) => {
    const incoming = fields && Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined;
    if (incoming != null && String(incoming).trim() !== '') return;
    if (key === 'changeAmount') {
      next.changeAmount = false;
      return;
    }
    next[key] = '';
  });
  Object.keys(fields || {}).forEach((key) => {
    next[key] = fields[key];
  });
  if (parsed && parsed.noObligationDeadline) {
    next.legalCommitmentDeadline = '';
  }
  return next;
}
