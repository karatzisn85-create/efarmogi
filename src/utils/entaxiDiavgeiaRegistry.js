/**
 * Καταχώριση πράξης Διαύγειας για ένταξη — προβολή στον browser.
 */

import { v4 as uuidv4 } from 'uuid';
import { normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import { buildDiavgeiaApePreview } from './diavgeiaApeFetch';

export const ENTAXI_DIAVGEIA_STAGE = 'ENTAXI';

export function getEntaxiDiavgeiaViewUrl(previewOrMeta) {
  const ada = normalizeDiavgeiaAda(previewOrMeta?.ada);
  return ada ? `https://diavgeia.gov.gr/decision/view/${encodeURIComponent(ada)}` : '';
}

export function getEntaxiDiavgeiaOpenUrl(previewOrMeta) {
  return getEntaxiDiavgeiaViewUrl(previewOrMeta);
}

export function buildEntaxiDiavgeiaRegistryEntry(preview, { roleLabel = 'Ένταξη' } = {}) {
  const p = preview?.ada ? preview : buildDiavgeiaApePreview(preview);
  const ada = normalizeDiavgeiaAda(p?.ada);
  if (!ada) return null;

  const openUrl = getEntaxiDiavgeiaOpenUrl(p);
  return {
    id: uuidv4(),
    ada,
    adam: ada,
    type: 'DIAV',
    source: 'diavgeia',
    stage: ENTAXI_DIAVGEIA_STAGE,
    stageLabel: `${roleLabel} (Διαύγεια)`,
    roleLabel: String(roleLabel || 'Ένταξη').trim(),
    title: String(p.subject || '').trim(),
    subtitle: [p.organization, p.decisionType].filter(Boolean).join(' · '),
    date: String(p.issueDateDisplay || p.issueDate || '').trim(),
    protocolNumber: String(p.protocolNumber || '').trim(),
    organization: String(p.organization || '').trim(),
    openUrl,
    recordedAt: new Date().toISOString(),
  };
}

export async function openEntaxiDiavgeiaDocument(entryOrMeta, { showToast } = {}) {
  const url = getEntaxiDiavgeiaOpenUrl(entryOrMeta);
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

export function getEntaxiDiavgeiaAdaText(entaxi) {
  if (!entaxi) return '';
  return normalizeDiavgeiaAda(
    entaxi.diavgeiaAda
    || entaxi.diavgeiaMeta?.ada
    || entaxi.diavgeiaDocument?.ada
    || ''
  );
}
