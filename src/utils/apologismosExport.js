import React from 'react';
import { savePdfWithDialog } from './savePdfFile';

const ipcRenderer = window.electronAPI;

/**
 * Εξαγωγή PDF απολογισμού από presentation model.
 * mediaMap: { relativePath: absolutePathOrDataUrl }
 */
export async function exportApologismosPdf({ model, appConfig, mediaMap = {} }) {
  const { registerApologismosPdfFonts } = await import('./apologismosFonts');
  await registerApologismosPdfFonts();
  const { pdf } = await import('@react-pdf/renderer');
  const { default: ApologismosReport } = await import('../components/pdf/ApologismosReport');
  const el = React.createElement(ApologismosReport, { model, appConfig, mediaMap });
  const blob = await pdf(el).toBlob();
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const defaultName = `Απολογισμός_${model?.period?.startYear || ''}-${model?.period?.endYear || ''}.pdf`;
  return savePdfWithDialog({
    buffer,
    defaultName,
    title: 'Αποθήκευση απολογισμού ως έγγραφο',
    subtitle: model?.period?.label || '',
  });
}

export async function exportApologismosPptx({ periodId, actingUsername }) {
  return ipcRenderer.invoke('apologismos-export-pptx', {
    actingUsername,
    periodId,
  });
}
