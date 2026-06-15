/**

 * meletaiExportHandler.js — Εξαγωγή αναφοράς Hub / Μελέτης (Excel / PDF)

 */

const fs = require('fs');

const { exportHtmlToPdf } = require('./htmlPdfExportHelper');

const { buildHubReportHtml, buildStudyReportHtml } = require('./meletaiReportHtml');



const APP_NAME = 'ERGOHUB';



function formatDateGreek(iso) {

  try {

    return new Date(iso).toLocaleString('el-GR', {

      day: '2-digit',

      month: '2-digit',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    });

  } catch {

    return String(iso || '');

  }

}



function formatDateOnlyGreek(iso) {

  if (!iso) return '—';

  try {

    return new Date(iso).toLocaleDateString('el-GR', {

      day: '2-digit',

      month: '2-digit',

      year: 'numeric',

    });

  } catch {

    return '—';

  }

}



function buildStudyInfoRows(meleti) {

  const linked = meleti.linkedSubprojectTitle

    ? `${meleti.linkedProjectTitle ? `${meleti.linkedProjectTitle} · ` : ''}${meleti.linkedSubprojectTitle}`

    : '—';

  return [

    ['Αριθμός μελέτης', meleti.studyNumber || '—'],

    ['Τίτλος', meleti.title || '(Χωρίς τίτλο)'],

    ['Κατηγορία', meleti.category || '—'],

    ['Χρεωμένη σε', meleti.assignedTo || '—'],

    ['Συνδεδεμένο υποέργο', linked],

    ['Σημειώσεις', String(meleti.notes || '').trim() || '—'],

    ['Καταχώρηση', formatDateOnlyGreek(meleti.createdAt)],

    ['Τελευταία ενημέρωση', formatDateOnlyGreek(meleti.updatedAt)],

  ];

}



function countMeletiFiles(meleti) {

  return (meleti?.fileGroups || []).reduce((sum, g) => {

    return sum + (g.files || []).reduce((s, entry) => {

      if (entry?.kind === 'folder') return s + (entry.fileCount || 0);

      return s + 1;

    }, 0);

  }, 0);

}



function buildHubReportRows(meletai) {

  return (meletai || []).map((m) => ({

    studyNumber: m.studyNumber || '—',

    title: m.title || '(Χωρίς τίτλο)',

    category: m.category || '—',

    assignedTo: m.assignedTo || '—',

    subproject: m.linkedSubprojectTitle

      ? `${m.linkedProjectTitle ? `${m.linkedProjectTitle} · ` : ''}${m.linkedSubprojectTitle}`

      : '—',

    files: countMeletiFiles(m),

    updatedAt: m.updatedAt ? formatDateOnlyGreek(m.updatedAt) : '—',

  }));

}



async function exportHubReportExcel({ meletai, destFilePath, exportedBy, appVersion }) {

  const XLSX = require('xlsx-js-style');

  const rows = buildHubReportRows(meletai);

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const header = ['Αριθμός', 'Τίτλος', 'Κατηγορία', 'Χρεωμένη σε', 'Συνδ. Υποέργο', 'Αρχεία', 'Τελευταία ενημέρωση'];

  const data = [

    header,

    ...rows.map((r) => [r.studyNumber, r.title, r.category, r.assignedTo, r.subproject, r.files, r.updatedAt]),

  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [

    { wch: 12 }, { wch: 42 }, { wch: 18 }, { wch: 24 }, { wch: 40 }, { wch: 10 }, { wch: 18 },

  ];

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Μελέτες');

  const meta = [

    [`${APP_NAME} — Αναφορά Μητρώου Μελετών`],

    [`Ημερομηνία: ${formatDateGreek(new Date().toISOString())}`],

    [`Εξαγωγή από: ${exportedBy || '—'}`],

    [`Έκδοση: ${appVersion || '—'}`],

    [`Σύνολο μελετών: ${rows.length}`],

  ];

  const metaWs = XLSX.utils.aoa_to_sheet(meta);

  XLSX.utils.book_append_sheet(wb, metaWs, 'Πληροφορίες');

  XLSX.writeFile(wb, destFilePath);

  return {

    success: true,

    filePath: destFilePath,

    rowCount: rows.length,

    actionCount: rows.length,

    sheetCount: wb.SheetNames.length,

    exportedAt,

    format: 'excel',

  };

}



async function exportHubReportHtml({ meletai, destFilePath, exportedBy, appVersion }) {

  const rows = buildHubReportRows(meletai);

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const html = buildHubReportHtml({ rows, exportedAt, exportedBy, appVersion });

  fs.writeFileSync(destFilePath, `\uFEFF${html}`, 'utf8');

  return {

    success: true,

    filePath: destFilePath,

    rowCount: rows.length,

    actionCount: rows.length,

    sheetCount: 1,

    exportedAt,

    format: 'html',

  };

}



async function exportHubReportPdf({ meletai, destFilePath, exportedBy, appVersion }) {

  const rows = buildHubReportRows(meletai);

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const html = buildHubReportHtml({ rows, exportedAt, exportedBy, appVersion });



  try {

    const pdfResult = await exportHtmlToPdf(html, destFilePath, { landscape: true });

    return {

      success: true,

      filePath: destFilePath,

      rowCount: rows.length,

      actionCount: rows.length,

      sheetCount: pdfResult.sheetCount || 1,

      exportedAt,

      format: 'pdf',

    };

  } catch (err) {

    console.error('exportHubReportPdf failed:', err.message);

    const htmlPath = destFilePath.replace(/\.pdf$/i, '.html');

    const htmlResult = await exportHubReportHtml({ meletai, destFilePath: htmlPath, exportedBy, appVersion });

    return {

      ...htmlResult,

      pdfFallback: true,

      message: 'Δεν ήταν δυνατή η δημιουργία PDF. Αποθηκεύτηκε styled HTML — ανοίξτε το και εκτυπώστε σε PDF.',

    };

  }

}



async function exportHubReport({ meletai, format, destFilePath, exportedBy, appVersion }) {

  if (format === 'pdf') {

    return exportHubReportPdf({ meletai, destFilePath, exportedBy, appVersion });

  }

  return exportHubReportExcel({ meletai, destFilePath, exportedBy, appVersion });

}



async function exportStudyReportExcel({ meleti, fileInventory, destFilePath, exportedBy, appVersion }) {

  const XLSX = require('xlsx-js-style');

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const infoRows = buildStudyInfoRows(meleti);

  const infoData = [['Πεδίο', 'Τιμή'], ...infoRows];

  const infoWs = XLSX.utils.aoa_to_sheet(infoData);

  infoWs['!cols'] = [{ wch: 28 }, { wch: 56 }];



  const fileHeader = ['Κατηγορία', 'Τύπος', 'Φάκελος', 'Όνομα αρχείου'];

  const fileData = [

    fileHeader,

    ...(fileInventory || []).map((row) => [

      row.category,

      row.entryType,

      row.container,

      row.fileName,

    ]),

  ];

  const filesWs = XLSX.utils.aoa_to_sheet(fileData);

  filesWs['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 42 }];



  const meta = [

    [`${APP_NAME} — Αναφορά Μελέτης`],

    [`Μελέτη: ${meleti.studyNumber || '—'} — ${meleti.title || ''}`],

    [`Ημερομηνία εξαγωγής: ${exportedAt}`],

    [`Εξαγωγή από: ${exportedBy || '—'}`],

    [`Έκδοση: ${appVersion || '—'}`],

    [`Σύνολο αρχείων: ${(fileInventory || []).filter((r) => r.fileName && r.fileName !== '—').length}`],

  ];

  const metaWs = XLSX.utils.aoa_to_sheet(meta);



  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, infoWs, 'Στοιχεία');

  XLSX.utils.book_append_sheet(wb, filesWs, 'Αρχεία');

  XLSX.utils.book_append_sheet(wb, metaWs, 'Πληροφορίες');

  XLSX.writeFile(wb, destFilePath);



  const fileCount = (fileInventory || []).filter((r) => r.fileName && r.fileName !== '—').length;

  return {

    success: true,

    filePath: destFilePath,

    actionCount: 1,

    sheetCount: wb.SheetNames.length,

    rowCount: fileCount,

    exportedAt,

    format: 'excel',

  };

}



async function exportStudyReportHtml({ meleti, fileInventory, destFilePath, exportedBy, appVersion }) {

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const html = buildStudyReportHtml({ meleti, fileInventory, exportedAt, exportedBy, appVersion });

  fs.writeFileSync(destFilePath, `\uFEFF${html}`, 'utf8');

  const fileCount = (fileInventory || []).filter((r) => r.fileName && r.fileName !== '—').length;

  return {

    success: true,

    filePath: destFilePath,

    actionCount: 1,

    sheetCount: 1,

    rowCount: fileCount,

    exportedAt,

    format: 'html',

  };

}



async function exportStudyReportPdf({ meleti, fileInventory, destFilePath, exportedBy, appVersion }) {

  const exportedAt = formatDateOnlyGreek(new Date().toISOString());

  const html = buildStudyReportHtml({ meleti, fileInventory, exportedAt, exportedBy, appVersion });

  const fileCount = (fileInventory || []).filter((r) => r.fileName && r.fileName !== '—').length;



  try {

    const pdfResult = await exportHtmlToPdf(html, destFilePath, { landscape: false });

    return {

      success: true,

      filePath: destFilePath,

      actionCount: 1,

      sheetCount: pdfResult.sheetCount || 1,

      rowCount: fileCount,

      exportedAt,

      format: 'pdf',

    };

  } catch (err) {

    console.error('exportStudyReportPdf failed:', err.message);

    const htmlPath = destFilePath.replace(/\.pdf$/i, '.html');

    const htmlResult = await exportStudyReportHtml({ meleti, fileInventory, destFilePath: htmlPath, exportedBy, appVersion });

    return {

      ...htmlResult,

      pdfFallback: true,

      message: 'Δεν ήταν δυνατή η δημιουργία PDF. Αποθηκεύτηκε styled HTML — ανοίξτε το και εκτυπώστε σε PDF.',

    };

  }

}



async function exportStudyReport({ meleti, fileInventory, format, destFilePath, exportedBy, appVersion }) {

  if (format === 'pdf') {

    return exportStudyReportPdf({ meleti, fileInventory, destFilePath, exportedBy, appVersion });

  }

  return exportStudyReportExcel({ meleti, fileInventory, destFilePath, exportedBy, appVersion });

}



module.exports = {

  exportHubReport,

  exportStudyReport,

  buildHubReportRows,

};


