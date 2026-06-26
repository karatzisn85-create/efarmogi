/**
 * Προεπισκόπηση ΑΠΕ από Διαύγεια (ΑΔΑ) — χωρίς αυτόματο ποσό.
 */

import { formatDateEl } from './dateFormat';

export function normalizeDiavgeiaAda(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function isValidDiavgeiaAdaFormat(ada) {
  const n = normalizeDiavgeiaAda(ada);
  if (!n) return false;
  return /^[Α-ΩA-Z0-9]+-[Α-ΩA-Z0-9]+$/u.test(n);
}

/** @param {object|null} decision από IPC */
export function buildDiavgeiaApePreview(decision) {
  if (!decision) {
    return {
      ada: '',
      protocolNumber: '',
      subject: '',
      issueDate: '',
      issueDateDisplay: '',
      organization: '',
      decisionType: '',
      unit: '',
      documentUrl: '',
      documentType: '',
    };
  }
  const issueDate = String(decision.issueDate || '').slice(0, 10);
  return {
    ada: normalizeDiavgeiaAda(decision.ada),
    protocolNumber: String(decision.protocolNumber || '').trim(),
    subject: String(decision.subject || '').trim(),
    issueDate,
    issueDateDisplay: formatDateEl(issueDate, ''),
    organization: String(decision.organization || '').trim(),
    decisionType: String(decision.decisionType || '').trim(),
    unit: String(decision.unit || '').trim(),
    documentUrl: String(decision.documentUrl || '').trim(),
    documentType: String(decision.documentType || '').trim(),
  };
}

export function buildDiavgeiaApeCommentSuffix(preview) {
  if (!preview?.ada) return '';
  const parts = [`ΑΔΑ Διαύγειας: ${preview.ada}`];
  if (preview.protocolNumber) parts.push(`Πρωτ. ${preview.protocolNumber}`);
  return parts.join(' · ');
}
