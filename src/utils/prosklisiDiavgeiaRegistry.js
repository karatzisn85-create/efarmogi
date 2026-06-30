/**
 * Καταχώριση πράξης Διαύγειας για πρόσκληση — προβολή στον browser (χωρίς λήψη PDF).
 */

import { v4 as uuidv4 } from 'uuid';
import { normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import { buildDiavgeiaApePreview } from './diavgeiaApeFetch';

export const PROSKLISI_DIAVGEIA_STAGE = 'PROSKLISI';

export function getProsklisiDiavgeiaOpenUrl(previewOrMeta) {
  const ada = normalizeDiavgeiaAda(previewOrMeta?.ada);
  return String(previewOrMeta?.documentUrl || '').trim()
    || (ada ? `https://diavgeia.gov.gr/doc/${encodeURIComponent(ada)}` : '');
}

/** @param {object|null} preview — από buildDiavgeiaApePreview ή IPC decision */
export function buildProsklisiDiavgeiaRegistryEntry(preview, { roleLabel = 'Πρόσκληση' } = {}) {
  const p = preview?.ada ? preview : buildDiavgeiaApePreview(preview);
  const ada = normalizeDiavgeiaAda(p?.ada);
  if (!ada) return null;

  const openUrl = getProsklisiDiavgeiaOpenUrl(p);
  return {
    id: uuidv4(),
    ada,
    adam: ada,
    type: 'DIAV',
    source: 'diavgeia',
    stage: PROSKLISI_DIAVGEIA_STAGE,
    stageLabel: `${roleLabel} (Διαύγεια)`,
    roleLabel: String(roleLabel || 'Πρόσκληση').trim(),
    title: String(p.subject || '').trim(),
    subtitle: [p.organization, p.decisionType].filter(Boolean).join(' · '),
    date: String(p.issueDateDisplay || p.issueDate || '').trim(),
    protocolNumber: String(p.protocolNumber || '').trim(),
    organization: String(p.organization || '').trim(),
    openUrl,
    recordedAt: new Date().toISOString(),
  };
}

export async function openProsklisiDiavgeiaDocument(entryOrMeta, { showToast } = {}) {
  const url = getProsklisiDiavgeiaOpenUrl(entryOrMeta);
  if (!url) {
    showToast?.('Δεν υπάρχει σύνδεσμος προβολής για αυτή την πράξη.', 'error');
    return { success: false };
  }
  const ipcRenderer = window.electronAPI;
  const res = await ipcRenderer.invoke('open-external-url', { url });
  if (res?.success === false && res?.error) {
    showToast?.(res.error, 'error');
  }
  return res;
}

export function getProsklisiDiavgeiaEntry(prosklisi) {
  if (!prosklisi) return null;
  const fromRegistry = Array.isArray(prosklisi.documentRegistry)
    ? prosklisi.documentRegistry.find((e) => e?.source === 'diavgeia')
    : null;
  if (fromRegistry) return fromRegistry;
  if (prosklisi.diavgeiaMeta?.ada) {
    return buildProsklisiDiavgeiaRegistryEntry({
      ada: prosklisi.diavgeiaMeta.ada,
      protocolNumber: prosklisi.diavgeiaMeta.protocolNumber,
      organization: prosklisi.diavgeiaMeta.organization,
      documentUrl: prosklisi.diavgeiaMeta.documentUrl,
      subject: prosklisi.diavgeiaMeta.subject || prosklisi.title,
      issueDate: prosklisi.diavgeiaMeta.issueDate,
      issueDateDisplay: prosklisi.diavgeiaMeta.issueDateDisplay,
    });
  }
  if (prosklisi.diavgeiaAda) {
    return buildProsklisiDiavgeiaRegistryEntry({ ada: prosklisi.diavgeiaAda }, { roleLabel: 'Πρόσκληση' });
  }
  return null;
}

function normalizeProsklisiRegistryEntryForChain(entry) {
  if (!entry) return null;
  const ada = normalizeDiavgeiaAda(entry.ada || entry.adam);
  if (!ada) return null;
  return {
    ...entry,
    ada,
    adam: ada,
    type: entry.type || 'DIAV',
    source: entry.source || 'diavgeia',
    stage: entry.stage || PROSKLISI_DIAVGEIA_STAGE,
    stageLabel: entry.stageLabel || `${entry.roleLabel || 'Πρόσκληση'} (Διαύγεια)`,
    openUrl: entry.openUrl || getProsklisiDiavgeiaOpenUrl(entry),
  };
}

/** Συλλογή καταχωρήσεων Διαύγειας για προβολή στο παράθυρο αρχείων πρόσκλησης */
export function collectProsklisiRegistryEntries({
  documentRegistry = [],
  diavgeiaMeta = null,
  diavgeiaAda = '',
  modifications = [],
} = {}) {
  const entries = [];
  const seen = new Set();

  const push = (raw) => {
    const normalized = normalizeProsklisiRegistryEntryForChain(raw);
    if (!normalized || seen.has(normalized.adam)) return;
    seen.add(normalized.adam);
    entries.push(normalized);
  };

  (documentRegistry || [])
    .filter((e) => e?.source === 'diavgeia')
    .forEach(push);

  if (diavgeiaMeta?.ada) {
    push(buildProsklisiDiavgeiaRegistryEntry(diavgeiaMeta, { roleLabel: 'Πρόσκληση' }));
  } else if (diavgeiaAda) {
    push(buildProsklisiDiavgeiaRegistryEntry({ ada: diavgeiaAda }, { roleLabel: 'Πρόσκληση' }));
  }

  (modifications || []).forEach((mod, index) => {
    const roleLabel = `Τροποποίηση #${index + 1}`;
    if (mod?.diavgeiaDocument) {
      push({
        ...mod.diavgeiaDocument,
        roleLabel,
        stageLabel: `${roleLabel} (Διαύγεια)`,
      });
      return;
    }
    if (mod?.diavgeiaMeta?.ada) {
      push(buildProsklisiDiavgeiaRegistryEntry(mod.diavgeiaMeta, { roleLabel }));
    }
  });

  return entries;
}
