/**
 * statisticsExportHandler.js — Εξαγωγή στατιστικών PDF (ανά tab / πλήρης)
 */
const { exportHtmlToPdf } = require('./htmlPdfExportHelper');
const { buildStatisticsReportHtml, TAB_TITLES } = require('./statisticsReportHtml');

async function exportStatisticsReport({
  tabs = [],
  destFilePath,
  organizationName = '',
  exportedBy = '',
  appVersion = '',
  filterNote = '',
  projectCount = 0,
  reportTitle = 'Στατιστική Αναφορά ERGOHUB',
}) {
  const html = buildStatisticsReportHtml({
    tabs,
    organizationName,
    exportedBy,
    filterNote,
    projectCount,
    reportTitle,
  });

  const landscape = tabs.length === 1 && tabs[0].tabId === 'chain';
  const result = await exportHtmlToPdf(html, destFilePath, { landscape });
  return {
    ...result,
    sheetCount: tabs.length,
    exportedAt: new Date().toISOString(),
    tabLabels: tabs.map((t) => t.tabLabel || TAB_TITLES[t.tabId] || t.tabId),
  };
}

module.exports = { exportStatisticsReport };
