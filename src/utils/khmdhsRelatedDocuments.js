/**
 * Σχετικά έγγραφα ΚΗΜΔΗΣ — online αναφορές εκτός κύριας αλυσίδας.
 */
import { v4 as uuidv4 } from 'uuid';
import { buildKhmdhsOpenUrl } from './khmdhsPortalLinks';
import { formatKhmdhsDateOnly } from './khmdhsNoticeFields';
import { annotateRegistryLinkLabels } from './khmdhsDocumentRegistry';
import { buildBranchCandidatePreview } from './khmdhsBranchPickerPreview';

export const KHMDHS_RELATED_DOCS_SECTION_TITLE = 'Σχετικά έγγραφα ΚΗΜΔΗΣ';

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

/** Προτεινόμενο όνομα καταγραφής από τίτλο ΚΗΜΔΗΣ */
export function suggestRelatedDocumentLabel(candidate, preview = null) {
  const title = String(
    candidate?.title
    || preview?.summary?.title
    || ''
  ).trim();
  if (title) return title;
  const adam = normalizeAdam(candidate?.adam);
  return adam ? `Έγγραφο ${adam}` : 'Σχετικό έγγραφο';
}

export function buildRelatedDocumentEntry(candidate, { linkLabel = '', preview = null } = {}) {
  const adam = normalizeAdam(candidate?.adam);
  if (!adam) return null;

  const summary = preview?.summary || {};
  const title = String(candidate?.title || summary.title || '').trim();
  const label = String(linkLabel || suggestRelatedDocumentLabel(candidate, preview)).trim();

  return {
    id: uuidv4(),
    adam,
    type: String(candidate?.type || '').toUpperCase() || 'SYMV',
    stage: 'RELATED',
    stageLabel: 'Σχετικό έγγραφο',
    title,
    subtitle: String(candidate?.subtitle || summary.contractor || '').trim(),
    amount: String(candidate?.amount || summary.amount || '').trim(),
    date: summary.signedDate
      ? formatKhmdhsDateOnly(summary.signedDate)
      : (summary.awardDate ? formatKhmdhsDateOnly(summary.awardDate) : ''),
    openUrl: buildKhmdhsOpenUrl(adam),
    linkLabel: label,
    recordedAt: '',
    chainFetchedAt: '',
    isRelated: true,
  };
}

export function buildRelatedEntriesFromCandidates(candidates, { previews = {}, labels = {} } = {}) {
  return (candidates || [])
    .map((c) => buildRelatedDocumentEntry(c, {
      linkLabel: labels[c.adam] || '',
      preview: previews[c.adam] || null,
    }))
    .filter(Boolean);
}

/** Προετοιμασία candidates με preview (για modal) */
export function enrichRejectedBranchCandidates(candidates, seedChainRes, { previews = {} } = {}) {
  return (candidates || []).map((c) => {
    const cached = previews[c.adam];
    const preview = cached && !cached.loading && !cached.error && (cached.summary || cached.groups)
      ? cached
      : buildBranchCandidatePreview(c, seedChainRes);
    return {
      candidate: c,
      preview: preview?.error ? null : preview,
      suggestedLabel: suggestRelatedDocumentLabel(c, preview?.error ? null : preview),
    };
  });
}

export function mergeKhmdhsRelatedDocuments(existing, selected) {
  const byAdam = new Map();
  (existing || []).forEach((e) => {
    const key = normalizeAdam(e.adam);
    if (key) byAdam.set(key, e);
  });

  const now = new Date().toISOString();
  (selected || []).forEach((entry) => {
    const key = normalizeAdam(entry.adam);
    if (!key) return;
    const prev = byAdam.get(key);
    byAdam.set(key, {
      ...entry,
      id: prev?.id || entry.id || uuidv4(),
      stage: 'RELATED',
      isRelated: true,
      recordedAt: prev?.recordedAt || now,
      linkLabel: entry.linkLabel || prev?.linkLabel || entry.title || '',
    });
  });

  return annotateRegistryLinkLabels([...byAdam.values()]);
}
