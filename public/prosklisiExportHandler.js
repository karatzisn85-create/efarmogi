/**
 * Εξαγωγή πρόσκλησης: δομή φακέλων αρχείων + Word (.doc HTML) με τα στοιχεία
 * και τους τίτλους αρχείων. Ίδια μορφή με την εξαγωγή έργου ωρίμανσης.
 */
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const APP_NAME = 'ERGOHUB';
const APP_TAGLINE = 'Σύστημα Διαχείρισης Έργων Δήμου';
const WORD_FILE_NAME = 'Αναφορά πρόσκλησης.doc';
const FILES_EXPORT_FOLDER = 'Αρχεία πρόσκλησης';
const LINKED_EXPORT_FOLDER = 'Δικαιολογητικά από την ωρίμανση';

function sanitizeFolderName(name, maxLen = 120) {
  let sanitized = String(name || 'Άτιτλος')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .trim();
  if (!sanitized) sanitized = 'Άτιτλος';
  if (sanitized.length > maxLen) sanitized = sanitized.substring(0, maxLen).trim();
  return sanitized;
}

function sanitizeDocText(value) {
  return String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
}

function escapeHtml(text) {
  return sanitizeDocText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlLines(text) {
  const safe = escapeHtml(text);
  if (!safe) return '&mdash;';
  return safe.replace(/\r?\n/g, '<br/>');
}

function getUniqueDirPath(parentDir, baseName) {
  let candidate = path.join(parentDir, baseName);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parentDir, `${baseName} (${counter})`);
    counter += 1;
  }
  return candidate;
}

function getUniqueFilePath(dir, baseName) {
  let candidate = path.join(dir, baseName);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(baseName);
  const nameNoExt = path.basename(baseName, ext);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${nameNoExt} (${counter})${ext}`);
    counter += 1;
  }
  return candidate;
}

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

function formatDateOnly(value) {
  if (!value) return '';
  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

function infoRow(label, value) {
  return `<tr>
    <td class="label">${escapeHtml(label)}</td>
    <td class="value">${htmlLines(value || '')}</td>
  </tr>`;
}

function isPathInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function copyDirectoryRecursive(src, dest) {
  await fse.ensureDir(dest);
  const entries = await fse.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fse.copy(srcPath, destPath);
    }
  }
}

function listFolderFileNames(folderPath, relativePrefix = '') {
  if (!fs.existsSync(folderPath)) return [];
  const names = [];
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (entry.isFile()) {
        names.push(rel);
      } else if (entry.isDirectory()) {
        names.push(...listFolderFileNames(path.join(folderPath, entry.name), rel));
      }
    }
  } catch {
    return names;
  }
  return names.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));
}

function summarizeCopiedTree(rootDir) {
  if (!fs.existsSync(rootDir)) return { items: [], fileCount: 0, folderCount: 0 };
  const items = [];
  let fileCount = 0;
  let folderCount = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return { items: [], fileCount: 0, folderCount: 0 };
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const innerFiles = listFolderFileNames(path.join(rootDir, entry.name));
      items.push({ kind: 'folder', name: entry.name, files: innerFiles });
      folderCount += 1;
      fileCount += innerFiles.length;
    } else if (entry.isFile()) {
      items.push({ kind: 'file', name: entry.name });
      fileCount += 1;
    }
  }
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? 1 : -1;
    return a.name.localeCompare(b.name, 'el', { sensitivity: 'base' });
  });
  return { items, fileCount, folderCount };
}

function buildCategoryExportHtml(categorySummary) {
  if (!categorySummary?.length) return '';

  let html = '<h2>Κατάλογος εξαγόμενων αρχείων και φακέλων</h2>';

  categorySummary.forEach((cat, catIndex) => {
    const catNum = catIndex + 1;
    html += `<p class="category-section">${catNum}. ${escapeHtml(cat.label)}</p>`;

    const items = cat.items || [];
    if (!items.length) {
      html += '<p class="muted"><em>Δεν περιλαμβάνονται αρχεία σε αυτή την ενότητα.</em></p>';
      return;
    }

    html += `<table class="export-registry">
      <thead>
        <tr>
          <th>Α/Α</th>
          <th>Είδος</th>
          <th>Τίτλος</th>
        </tr>
      </thead>
      <tbody>`;

    items.forEach((item, index) => {
      const num = index + 1;
      if (item.kind === 'folder') {
        html += `<tr>
          <td class="num">${num}</td>
          <td class="type">Φάκελος</td>
          <td class="name"><strong>${escapeHtml(item.name)}</strong></td>
        </tr>`;
        (item.files || []).forEach((fileName, subIndex) => {
          html += `<tr class="sub-row">
            <td class="num">${num}.${subIndex + 1}</td>
            <td class="type">Υποαρχείο</td>
            <td class="name">${escapeHtml(fileName)}</td>
          </tr>`;
        });
        return;
      }
      html += `<tr>
        <td class="num">${num}</td>
        <td class="type">Αρχείο</td>
        <td class="name">${escapeHtml(item.name)}</td>
      </tr>`;
    });

    html += '</tbody></table>';
  });

  return html;
}

function buildProsklisiWordDocument({
  prosklisi,
  appVersion,
  exportedBy,
  categorySummary,
  modifications,
}) {
  const exportDate = formatDateGreek(new Date().toISOString());
  const title = escapeHtml(prosklisi.title || 'Πρόσκληση');
  const mods = Array.isArray(modifications) ? modifications : [];
  const categoryHtml = buildCategoryExportHtml(categorySummary);

  let modsHtml = '<p class="muted">Δεν υπάρχουν καταγεγραμμένες τροποποιήσεις.</p>';
  if (mods.length) {
    modsHtml = `<table class="info">${mods.map((mod, index) => {
      const dateLabel = formatDateOnly(mod.modificationDocumentDate || mod.createdAt);
      const ada = mod.diavgeiaAda || mod.diavgeiaMeta?.ada || '';
      const changeKeys = mod.changes && typeof mod.changes === 'object'
        ? Object.keys(mod.changes).join(', ')
        : '';
      const bits = [
        dateLabel ? `ημ. ${dateLabel}` : '',
        ada ? `ΑΔΑ ${ada}` : '',
        changeKeys ? `πεδία: ${changeKeys}` : '',
      ].filter(Boolean).join(' · ');
      return infoRow(`Τροποποίηση ${index + 1}`, bits || '—');
    }).join('')}</table>`;
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>${title}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml><![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 2cm; }
  body {
    font-family: Calibri, Arial, sans-serif;
    font-size: 11pt;
    color: #1E293B;
    line-height: 1.45;
  }
  .brand {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    color: #4338CA;
    margin: 0 0 6pt 0;
  }
  .subtitle {
    text-align: center;
    font-size: 12pt;
    color: #64748B;
    margin: 0 0 24pt 0;
  }
  h1 {
    font-size: 18pt;
    color: #1E293B;
    margin: 0 0 18pt 0;
    border-bottom: 2px solid #4338CA;
    padding-bottom: 6pt;
  }
  h2 {
    font-size: 13pt;
    color: #4338CA;
    margin: 20pt 0 8pt 0;
  }
  table.info {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16pt;
  }
  table.info td {
    border: 1px solid #CBD5E1;
    padding: 6pt 8pt;
    vertical-align: top;
  }
  table.info td.label {
    width: 34%;
    background: #F1F5F9;
    font-weight: bold;
    color: #64748B;
  }
  .category-section {
    font-size: 11pt;
    font-weight: bold;
    color: #1E293B;
    margin: 16pt 0 8pt 0;
    letter-spacing: 0.2px;
  }
  table.export-registry {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 18pt 0;
    font-size: 10pt;
  }
  table.export-registry th {
    background: #EEF2FF;
    border: 1px solid #94A3B8;
    padding: 7pt 8pt;
    text-align: center;
    font-weight: bold;
    color: #334155;
  }
  table.export-registry td {
    border: 1px solid #CBD5E1;
    padding: 6pt 8pt;
    vertical-align: middle;
  }
  table.export-registry td.num {
    width: 11%;
    text-align: center;
    font-weight: bold;
    color: #4338CA;
    background: #F8FAFC;
    white-space: nowrap;
  }
  table.export-registry td.type {
    width: 16%;
    text-align: center;
    color: #475569;
    font-weight: 600;
  }
  table.export-registry td.name {
    color: #1E293B;
  }
  table.export-registry tr.sub-row td.name {
    padding-left: 14pt;
  }
  table.export-registry tr.sub-row td.type {
    font-size: 9.5pt;
    color: #64748B;
  }
  .footer {
    text-align: center;
    margin-top: 28pt;
    padding-top: 12pt;
    border-top: 1px solid #E2E8F0;
  }
  .footer-brand {
    font-weight: bold;
    color: #4338CA;
    font-size: 11pt;
  }
  .footer-note {
    color: #64748B;
    font-size: 9pt;
    font-style: italic;
    margin-top: 6pt;
  }
  .muted { color: #64748B; }
</style>
</head>
<body>
  <p class="brand">${APP_NAME}</p>
  <p class="subtitle">Αναφορά Πρόσκλησης</p>
  <h1>${title}</h1>

  <h2>Στοιχεία πρόσκλησης</h2>
  <table class="info">
    ${infoRow('Τίτλος πρόσκλησης', prosklisi.title)}
    ${infoRow('Κωδικός & Α/Α ΟΠΣ', prosklisi.code)}
    ${infoRow('Άξονας / Δράση', prosklisi.axis)}
    ${infoRow('Πηγή χρηματοδότησης', prosklisi.fundingSource)}
    ${infoRow('Εύρος προϋπολογισμού', prosklisi.budgetRange)}
    ${infoRow('Κατάσταση', prosklisi.status)}
    ${infoRow('Ισχύουσα λήξη υποβολής', formatDateOnly(prosklisi.deadline))}
    ${infoRow('Αρχική λήξη', formatDateOnly(prosklisi.originalDeadline))}
    ${infoRow('ΑΔΑ Διαύγειας', prosklisi.diavgeiaAda || prosklisi.diavgeiaMeta?.ada || '')}
    ${infoRow('Συσχετισμένα έργα', prosklisi.linkedProjectsLabel)}
    ${infoRow('Έργα ωρίμανσης', prosklisi.linkedOrimanthiLabel)}
    ${infoRow('Σχετικές εντάξεις', prosklisi.relatedEntaxeisCount != null ? String(prosklisi.relatedEntaxeisCount) : '')}
    ${infoRow('Ημερομηνία δημιουργίας', formatDateOnly(prosklisi.createdAt) || formatDateGreek(prosklisi.createdAt))}
    ${infoRow('Τελευταία ενημέρωση', formatDateOnly(prosklisi.updatedAt) || formatDateGreek(prosklisi.updatedAt))}
    ${infoRow('Ημερομηνία εξαγωγής', exportDate)}
    ${exportedBy ? infoRow('Εξαγωγή από', exportedBy) : ''}
  </table>

  <h2>Τροποποιήσεις</h2>
  ${modsHtml}

  ${categoryHtml}

  <div class="footer">
    <p class="footer-brand">${APP_NAME} &mdash; ${APP_TAGLINE}</p>
    <p class="footer-note">Η παρούσα αναφορά παράχθηκε αυτόματα από την εφαρμογή ${APP_NAME}${appVersion ? ` v${escapeHtml(appVersion)}` : ''}.</p>
  </div>
</body>
</html>`;
}

async function copyLinkedOrimanthiFiles(linkedOrimanthiFiles, destRoot) {
  const missingItems = [];
  let fileCount = 0;
  const itemsByKey = new Map();

  for (const file of linkedOrimanthiFiles || []) {
    const category = sanitizeFolderName(file.categoryLabel || 'Κατηγορία');
    const spec = sanitizeFolderName(file.subtitle || 'Εξειδίκευση');
    const destDir = path.join(destRoot, category, spec);
    const src = file.sourcePath;
    const displayName = file.originalName || file.fileName || 'αρχείο';
    if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
      missingItems.push({
        kind: 'file',
        name: displayName,
        category: `${file.categoryLabel || ''} / ${file.subtitle || ''}`.trim(),
      });
      continue;
    }
    await fse.ensureDir(destDir);
    const destFile = getUniqueFilePath(destDir, path.basename(file.fileName || displayName));
    await fse.copy(src, destFile);
    const key = `${category} / ${spec}`;
    if (!itemsByKey.has(key)) {
      itemsByKey.set(key, { kind: 'folder', name: key, files: [] });
    }
    itemsByKey.get(key).files.push(`${category}/${spec}/${path.basename(destFile)}`);
    fileCount += 1;
  }

  const items = Array.from(itemsByKey.values());
  items.sort((a, b) => a.name.localeCompare(b.name, 'el', { sensitivity: 'base' }));
  return {
    fileCount,
    folderCount: items.length,
    items,
    skipped: missingItems,
  };
}

async function exportProsklisi(options) {
  const {
    prosklisi,
    destParentDir,
    filesRoot,
    linkedOrimanthiFiles = [],
    modifications = [],
    appVersion,
    exportedBy,
  } = options;

  if (!prosklisi || !destParentDir) {
    return { success: false, error: 'Λείπουν απαιτούμενες παράμετροι εξαγωγής' };
  }

  const folderTitle = sanitizeFolderName(prosklisi.title || 'Πρόσκληση');
  const exportRoot = getUniqueDirPath(destParentDir, folderTitle);

  if (filesRoot && fs.existsSync(filesRoot)) {
    if (isPathInside(exportRoot, filesRoot) || isPathInside(filesRoot, exportRoot)) {
      return {
        success: false,
        error: 'Επιλέξτε φάκελο εκτός των αρχείων της πρόσκλησης',
      };
    }
  }

  await fse.ensureDir(exportRoot);

  const categorySummary = [];
  let totalFiles = 0;
  let totalFolders = 0;
  const missingItems = [];

  if (filesRoot && fs.existsSync(filesRoot)) {
    const destFilesDir = path.join(exportRoot, FILES_EXPORT_FOLDER);
    await copyDirectoryRecursive(filesRoot, destFilesDir);
    const tree = summarizeCopiedTree(destFilesDir);
    categorySummary.push({
      label: FILES_EXPORT_FOLDER,
      items: tree.items,
      fileCount: tree.fileCount,
      folderCount: tree.folderCount,
    });
    totalFiles += tree.fileCount;
    totalFolders += tree.folderCount;
  }

  if (linkedOrimanthiFiles.length) {
    const destLinkedDir = path.join(exportRoot, LINKED_EXPORT_FOLDER);
    const linkedStats = await copyLinkedOrimanthiFiles(linkedOrimanthiFiles, destLinkedDir);
    if (linkedStats.skipped?.length) missingItems.push(...linkedStats.skipped);
    categorySummary.push({
      label: LINKED_EXPORT_FOLDER,
      items: linkedStats.items,
      fileCount: linkedStats.fileCount,
      folderCount: linkedStats.folderCount,
    });
    totalFiles += linkedStats.fileCount;
    totalFolders += linkedStats.folderCount;
  }

  const wordHtml = buildProsklisiWordDocument({
    prosklisi,
    appVersion,
    exportedBy,
    categorySummary,
    modifications,
  });

  const wordPath = path.join(exportRoot, WORD_FILE_NAME);
  fs.writeFileSync(wordPath, `\uFEFF${wordHtml}`, 'utf8');

  return {
    success: true,
    exportPath: exportRoot,
    wordPath,
    stats: {
      files: totalFiles,
      folders: totalFolders,
      missingCount: missingItems.length,
    },
    missingItems,
  };
}

module.exports = {
  exportProsklisi,
  sanitizeFolderName,
  APP_NAME,
  WORD_FILE_NAME,
  FILES_EXPORT_FOLDER,
  LINKED_EXPORT_FOLDER,
};
