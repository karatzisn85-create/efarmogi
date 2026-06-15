/**
 * htmlPdfExportHelper.js — Μετατροπή styled HTML σε PDF μέσω Electron printToPDF
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BrowserWindow } = require('electron');

async function exportHtmlToPdf(html, destFilePath, { landscape = false } = {}) {
  const tempHtml = path.join(os.tmpdir(), `ergohub-report-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tempHtml, `\uFEFF${html}`, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
    },
  });

  try {
    await win.loadFile(tempHtml);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: !!landscape,
      marginsType: 'custom',
      pageSize: 'A4',
      margins: {
        top: 0.35,
        bottom: 0.35,
        left: 0.35,
        right: 0.35,
      },
    });

    fs.writeFileSync(destFilePath, pdfBuffer);

    let sheetCount = 1;
    try {
      const { PDFDocument } = require('pdf-lib');
      const doc = await PDFDocument.load(pdfBuffer);
      sheetCount = doc.getPageCount();
    } catch {
      /* optional */
    }

    return { success: true, filePath: destFilePath, sheetCount };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try { fs.unlinkSync(tempHtml); } catch { /* ignore */ }
  }
}

module.exports = { exportHtmlToPdf };
