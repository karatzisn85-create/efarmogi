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
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = `${filePath}.tmp-${uniqueSuffix}`;
  const content = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    rotateBackups(filePath);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

async function safeWriteJSONAsync(filePath, data) {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = `${filePath}.tmp-${uniqueSuffix}`;
  const content = JSON.stringify(data, null, 2);

  try {
    await fs.promises.writeFile(tmpPath, content, 'utf8');
    rotateBackups(filePath);
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    try { await fs.promises.unlink(tmpPath); } catch (_) {}
    throw err;
  }
}

module.exports = { safeWriteJSON, safeWriteJSONAsync };
