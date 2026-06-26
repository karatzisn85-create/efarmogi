/**
 * khmdhsPortfolioExportHandler.js — Εξαγωγή αναφορών χαρτοφυλακίου (PDF)
 */
const { exportHtmlToPdf } = require('./htmlPdfExportHelper');
const {
  buildPortfolioReportHtml,
  buildGapReportHtml,
  buildFinancialReportHtml,
} = require('./khmdhsPortfolioReportHtml');

const VALID_TYPES = new Set(['portfolio', 'gaps', 'financial']);

async function exportPortfolioReport({
  reportType = 'portfolio',
  stats,
  destFilePath,
  organizationName = '',
  exportedBy = '',
  appVersion = '',
  filterNote = '',
  projectCount = 0,
}) {
  const type = VALID_TYPES.has(reportType) ? reportType : 'portfolio';
  const opts = {
    stats: stats || {},
    organizationName,
    exportedBy,
    appVersion,
    filterNote,
    projectCount,
  };

  let html;
  if (type === 'gaps') html = buildGapReportHtml(opts);
  else if (type === 'financial') html = buildFinancialReportHtml(opts);
  else html = buildPortfolioReportHtml(opts);

  const landscape = type === 'portfolio';
  const result = await exportHtmlToPdf(html, destFilePath, { landscape });
  return {
    ...result,
    reportType: type,
    exportedAt: new Date().toISOString(),
  };
}

module.exports = { exportPortfolioReport };
