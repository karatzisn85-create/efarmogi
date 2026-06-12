/**
 * orimanthiExportHandler.js
 * Εξαγωγή έργου ωρίμανσης: φάκελος κατηγοριών + Word (.doc HTML) με σημειώσεις/εκκρεμότητες.
 * Μορφή Word HTML για συμβατότητα με Word 2007+.
 */
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const APP_NAME = 'ERGOHUB';
const APP_TAGLINE = 'Σύστημα Διαχείρισης Έργων Δήμου';
const WORD_FILE_NAME = 'Σημειώσεις_και_Εκκρεμότητες.doc';

const PROPOSAL_STATUS_LABELS = {
  draft: 'Αρχική καταγραφή',
  maturing: 'Υπό ωρίμανση',
  ready: 'Πλήρως ώριμο',
  submitted: 'Σε διαδικασία έγκρισης',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορρίφθηκε',
};

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

function infoRow(label, value) {
  return `<tr>
    <td class="label">${escapeHtml(label)}</td>
    <td class="value">${htmlLines(value || '')}</td>
  </tr>`;
}

function buildPendingHtml(pendingItems) {
  if (!pendingItems.length) {
    return '<p class="muted"><em>Δεν έχουν καταχωρηθεί εκκρεμότητες.</em></p>';
  }

  const openItems = pendingItems.filter((item) => !item.done);
  const doneItems = pendingItems.filter((item) => item.done);
  let html = '';

  if (openItems.length) {
    html += `<p class="pending-open"><strong>Ανοιχτές εκκρεμότητες (${openItems.length})</strong></p><ul class="pending-list">`;
    openItems.forEach((item, index) => {
      html += `<li><strong>${index + 1}.</strong> [ ] ${htmlLines(item.text || '')}</li>`;
    });
    html += '</ul>';
  }

  if (doneItems.length) {
    html += `<p class="pending-done"><strong>Ολοκληρωμένες (${doneItems.length})</strong></p><ul class="pending-list done">`;
    doneItems.forEach((item, index) => {
      html += `<li><strong>${index + 1}.</strong> [x] <span class="strike">${htmlLines(item.text || '')}</span></li>`;
    });
    html += '</ul>';
  }

  return html;
}

function buildCategoryExportHtml(categorySummary) {
  if (!categorySummary?.length) return '';

  let html = '<h2>Κατάλογος εξαγόμενων αρχείων και φακέλων</h2>';

  categorySummary.forEach((cat, catIndex) => {
    const catNum = catIndex + 1;
    html += `<p class="category-section">${catNum}. ${escapeHtml(cat.label)}</p>`;

    const items = cat.items || [];
    if (!items.length) {
      html += '<p class="muted"><em>Δεν περιλαμβάνονται αρχεία σε αυτή την κατηγορία.</em></p>';
      return;
    }

    html += `<table class="export-registry">
      <thead>
        <tr>
          <th>Α/Α</th>
          <th>Τύπος</th>
          <th>Ονομασία αρχείου / φακέλου</th>
        </tr>
      </thead>
      <tbody>`;

    let itemIndex = 0;
    items.forEach((item) => {
      itemIndex += 1;
      const num = `${catNum}.${itemIndex}`;

      if (item.kind === 'file') {
        html += `<tr>
          <td class="num">${num}</td>
          <td class="type">Αρχείο</td>
          <td class="name">${escapeHtml(item.name)}</td>
        </tr>`;
        return;
      }

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
    });

    html += '</tbody></table>';
  });

  return html;
}

function formatAepoDateExport(value) {
  if (!value) return '';
  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return String(value);
}

function buildProposalWordDocument({ proposal, appVersion, exportedBy, categorySummary }) {
  const statusLabel = PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status || '-';
  const exportDate = formatDateGreek(new Date().toISOString());
  const pendingItems = Array.isArray(proposal.pendingItems) ? proposal.pendingItems : [];
  const title = escapeHtml(proposal.title || 'Άτιτλο έργου');

  const categoryHtml = buildCategoryExportHtml(categorySummary);

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="${APP_NAME}">
<title>${title}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Normal</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotPromptForConvert/>
  <w:DoNotShowRevisions/>
  <w:DoNotPrintRevisions/>
  <w:ValidateAgainstSchemas/>
  <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
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
  .notes {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    padding: 10pt 12pt;
    margin-bottom: 12pt;
  }
  .pending-open { color: #B45309; margin: 0 0 6pt 0; }
  .pending-done { color: #059669; margin: 12pt 0 6pt 0; }
  ul.pending-list { margin: 0 0 10pt 18pt; padding: 0; }
  ul.pending-list.done { color: #64748B; }
  .strike { text-decoration: line-through; }
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
  <p class="subtitle">Αναφορά Έργου &mdash; Βάση Ωρίμανσης</p>
  <h1>${title}</h1>

  <h2>Στοιχεία έργου</h2>
  <table class="info">
    ${infoRow('Τίτλος έργου', proposal.title)}
    ${infoRow('Κατάσταση ωρίμανσης', statusLabel)}
    ${infoRow('Κατηγορία έργου', proposal.projectCategory)}
    ${infoRow('Εξειδίκευση υποδομής', proposal.infrastructureSpecialization)}
    ${infoRow('Ημερομηνία ανανέωσης ΑΕΠΟ', proposal.aepoRenewalDate ? formatAepoDateExport(proposal.aepoRenewalDate) : '')}
    ${infoRow('Περιγραφή', proposal.description)}
    ${infoRow('Ημερομηνία εξαγωγής', exportDate)}
    ${exportedBy ? infoRow('Εξαγωγή από', exportedBy) : ''}
  </table>

  <h2>Σημειώσεις</h2>
  <div class="notes">${htmlLines(proposal.notes)}</div>

  <h2>Εκκρεμότητες</h2>
  ${buildPendingHtml(pendingItems)}

  ${categoryHtml}

  <div class="footer">
    <p class="footer-brand">${APP_NAME} &mdash; ${APP_TAGLINE}</p>
    <p class="footer-note">Η παρούσα αναφορά παράχθηκε αυτόματα από την εφαρμογή ${APP_NAME}${appVersion ? ` v${escapeHtml(appVersion)}` : ''}.</p>
  </div>
</body>
</html>`;
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

async function listFolderFileNames(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

async function copyGroupFiles({ proposalId, group, destCategoryDir, resolveProposalGroupPath }) {
  await fse.ensureDir(destCategoryDir);
  let fileCount = 0;
  let folderCount = 0;
  const items = [];

  for (const entry of group.files || []) {
    if (entry.kind === 'folder') {
      const srcFolder = resolveProposalGroupPath(proposalId, group.id, entry.id);
      if (!fs.existsSync(srcFolder)) continue;
      const folderName = sanitizeFolderName(entry.name || 'Φάκελος');
      const destFolder = getUniqueDirPath(destCategoryDir, folderName);
      await copyDirectoryRecursive(srcFolder, destFolder);
      const exportedFolderName = path.basename(destFolder);
      const innerFiles = await listFolderFileNames(destFolder);
      items.push({
        kind: 'folder',
        name: exportedFolderName,
        files: innerFiles,
      });
      folderCount += 1;
      fileCount += innerFiles.length;
    } else {
      const srcFile = resolveProposalGroupPath(proposalId, group.id, entry.name);
      if (!fs.existsSync(srcFile) || !fs.statSync(srcFile).isFile()) continue;
      const destFile = getUniqueFilePath(destCategoryDir, entry.name);
      await fse.copy(srcFile, destFile);
      items.push({
        kind: 'file',
        name: path.basename(destFile),
      });
      fileCount += 1;
    }
  }

  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? 1 : -1;
    return a.name.localeCompare(b.name, 'el', { sensitivity: 'base' });
  });

  return { fileCount, folderCount, items };
}

async function exportProposal(options) {
  const {
    proposal,
    proposalId,
    destParentDir,
    includeFiles = true,
    appVersion,
    exportedBy,
    resolveProposalGroupPath,
  } = options;

  if (!proposal || !proposalId || !destParentDir) {
    return { success: false, error: 'Λείπουν απαιτούμενες παράμετροι εξαγωγής' };
  }

  const folderTitle = sanitizeFolderName(proposal.title || 'Έργο');
  const exportRoot = getUniqueDirPath(destParentDir, folderTitle);
  await fse.ensureDir(exportRoot);

  const categorySummary = [];
  let totalFiles = 0;
  let totalFolders = 0;

  if (includeFiles) {
    for (const group of proposal.fileGroups || []) {
      const categoryName = sanitizeFolderName(group.label || 'Κατηγορία');
      const categoryDir = getUniqueDirPath(exportRoot, categoryName);
      const stats = await copyGroupFiles({
        proposalId,
        group,
        destCategoryDir: categoryDir,
        resolveProposalGroupPath,
      });
      categorySummary.push({
        label: group.label || categoryName,
        fileCount: stats.fileCount,
        folderCount: stats.folderCount,
        items: stats.items,
      });
      totalFiles += stats.fileCount;
      totalFolders += stats.folderCount;
    }
  }

  const wordHtml = buildProposalWordDocument({
    proposal,
    appVersion,
    exportedBy,
    categorySummary: includeFiles ? categorySummary : [],
  });

  const wordPath = path.join(exportRoot, WORD_FILE_NAME);
  fs.writeFileSync(wordPath, `\uFEFF${wordHtml}`, 'utf8');

  return {
    success: true,
    exportPath: exportRoot,
    wordPath,
    stats: {
      categories: categorySummary.length,
      files: totalFiles,
      folders: totalFolders,
      includeFiles,
    },
  };
}

module.exports = {
  exportProposal,
  sanitizeFolderName,
  APP_NAME,
  WORD_FILE_NAME,
};
