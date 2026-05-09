const fs = require('fs');
const path = require('path');

const MAX_BACKUPS = 3;

function rotateBackups(filePath) {
  for (let i = MAX_BACKUPS; i >= 1; i--) {
    const older = filePath + `.bak${i}`;
    if (i === MAX_BACKUPS) {
      try { if (fs.existsSync(older)) fs.unlinkSync(older); } catch (_) {}
    } else {
      const newer = filePath + `.bak${i + 1}`;
      try { if (fs.existsSync(older)) fs.renameSync(older, newer); } catch (_) {}
    }
  }
  const bak1 = filePath + '.bak1';
  if (fs.existsSync(filePath)) {
    try { fs.copyFileSync(filePath, bak1); } catch (_) {}
  }
}

function safeWriteJSON(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, content, 'utf8');
  rotateBackups(filePath);
  fs.renameSync(tmpPath, filePath);
}

async function safeWriteJSONAsync(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2);

  await fs.promises.writeFile(tmpPath, content, 'utf8');
  rotateBackups(filePath);
  await fs.promises.rename(tmpPath, filePath);
}

module.exports = { safeWriteJSON, safeWriteJSONAsync };
