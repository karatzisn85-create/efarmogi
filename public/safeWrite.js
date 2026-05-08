const fs = require('fs');

function safeWriteJSON(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';
  const content = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, content, 'utf8');

  if (fs.existsSync(filePath)) {
    try { fs.renameSync(filePath, bakPath); } catch (_) {}
  }

  fs.renameSync(tmpPath, filePath);

  try { if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath); } catch (_) {}
}

async function safeWriteJSONAsync(filePath, data) {
  const tmpPath = filePath + '.tmp';
  const bakPath = filePath + '.bak';
  const content = JSON.stringify(data, null, 2);

  await fs.promises.writeFile(tmpPath, content, 'utf8');

  try {
    await fs.promises.access(filePath);
    try { await fs.promises.rename(filePath, bakPath); } catch (_) {}
  } catch (_) {}

  await fs.promises.rename(tmpPath, filePath);

  try { await fs.promises.unlink(bakPath); } catch (_) {}
}

module.exports = { safeWriteJSON, safeWriteJSONAsync };
