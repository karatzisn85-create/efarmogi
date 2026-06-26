/**
 * Καταχώριση εγγράφων ΑΠΕ στον κατάλογο παραπομπών (ΚΗΜΔΗΣ + Διαύγεια).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  mergeKhmdhsDocumentRegistry,
  annotateRegistryLinkLabels,
} from './khmdhsDocumentRegistry';
import { buildKhmdhsOpenUrl } from './khmdhsPortalLinks';
import { normalizeDiavgeiaAda } from './diavgeiaApeFetch';

export const APE_REGISTRY_STAGE = 'APE';

export function buildApeRegistryLinkKey(target) {
  const kind = target?.kind || 'contract';
  const idx = target?.arrayIndex ?? 0;
  return `ape:${kind}:${idx}`;
}

function normalizeRegistryKey(value) {
  return String(value || '').trim().toUpperCase();
}

export function buildDiavgeiaApeRegistryEntry(preview, { roleLabel = 'ΑΠΕ', linkKey = '' } = {}) {
  const ada = normalizeDiavgeiaAda(preview?.ada);
  if (!ada) return null;
  const openUrl = preview?.documentUrl
    || `https://diavgeia.gov.gr/doc/${encodeURIComponent(ada)}`;
  return {
    id: uuidv4(),
    adam: ada,
    type: 'DIAV',
    stage: APE_REGISTRY_STAGE,
    source: 'diavgeia',
    stageLabel: 'ΑΠΕ (Διαύγεια)',
    title: String(preview?.subject || '').trim(),
    subtitle: [preview?.organization, preview?.decisionType].filter(Boolean).join(' · '),
    amount: '',
    date: String(preview?.issueDateDisplay || preview?.issueDate || '').trim(),
    openUrl,
    roleLabel: String(roleLabel || 'ΑΠΕ').trim(),
    linkLabel: '',
    recordedAt: '',
    chainFetchedAt: '',
    apeLinkKey: linkKey,
    isStub: false,
  };
}

export function buildKhmdhsAdamApeRegistryEntry(adamRaw, {
  roleLabel = 'ΑΠΕ',
  title = '',
  date = '',
  linkKey = '',
} = {}) {
  const adam = normalizeRegistryKey(adamRaw);
  if (!adam) return null;
  return {
    id: uuidv4(),
    adam,
    type: 'SYMV',
    stage: APE_REGISTRY_STAGE,
    source: 'khmdhs',
    stageLabel: 'ΑΠΕ (ΚΗΜΔΗΣ)',
    title: String(title || '').trim(),
    subtitle: '',
    amount: '',
    date: String(date || '').trim(),
    openUrl: buildKhmdhsOpenUrl(adam),
    roleLabel: String(roleLabel || 'ΑΠΕ').trim(),
    linkLabel: '',
    recordedAt: '',
    chainFetchedAt: '',
    apeLinkKey: linkKey,
    isStub: !title,
  };
}

export function buildApeRegistryEntries(target, {
  targetTitle = '',
  sourceAdam = '',
  diavgeiaAda = '',
  diavgeiaPreview = null,
  khmdhsMeta = null,
} = {}) {
  const linkKey = buildApeRegistryLinkKey(target);
  const roleLabel = targetTitle ? `ΑΠΕ — ${targetTitle}` : 'ΑΠΕ';
  const entries = [];

  const khmdhsEntry = buildKhmdhsAdamApeRegistryEntry(sourceAdam, {
    roleLabel,
    title: khmdhsMeta?.title || '',
    date: khmdhsMeta?.signedDateDisplay || khmdhsMeta?.signedDate || '',
    linkKey,
  });
  if (khmdhsEntry) entries.push(khmdhsEntry);

  const diavPreview = diavgeiaPreview
    || (diavgeiaAda ? { ada: normalizeDiavgeiaAda(diavgeiaAda) } : null);
  const diavEntry = buildDiavgeiaApeRegistryEntry(diavPreview, { roleLabel, linkKey });
  if (diavEntry) entries.push(diavEntry);

  return entries;
}

export function mergeApeIntoDocumentRegistry(project, target, options = {}) {
  const linkKey = buildApeRegistryLinkKey(target);
  const withoutOld = (project?.khmdhsDocumentRegistry || []).filter(
    (e) => e?.apeLinkKey !== linkKey
  );
  const newEntries = buildApeRegistryEntries(target, options);
  if (!newEntries.length) {
    return { khmdhsDocumentRegistry: withoutOld };
  }
  return {
    khmdhsDocumentRegistry: mergeKhmdhsDocumentRegistry(withoutOld, newEntries),
  };
}

export function removeApeFromDocumentRegistry(project, target) {
  const linkKey = buildApeRegistryLinkKey(target);
  const next = (project?.khmdhsDocumentRegistry || []).filter(
    (e) => e?.apeLinkKey !== linkKey
  );
  if (next.length === (project?.khmdhsDocumentRegistry || []).length) return {};
  return { khmdhsDocumentRegistry: annotateRegistryLinkLabels(next) };
}
