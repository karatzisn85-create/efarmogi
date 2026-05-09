/**
 * ERGOHUB - Automated Build & Upload Script
 *
 * Builds the portable exe and uploads it to Dropbox.
 * Usage: npm run build:upload
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { getDropboxAccessToken } = require('./dropbox-token-manager');

const ROOT_DIR = path.join(__dirname, '..');

let DROPBOX_TOKEN = null;
const DROPBOX_FOLDER = '/ergohub';
const DROPBOX_INSTALLER_FILENAME = 'ERGOHUB-Setup.exe';
const DROPBOX_VERSION_FILENAME = 'version.json';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, total, message) {
  log(`\n[${step}/${total}] ${message}`, 'cyan');
}

function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function getVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return packageJson.version;
}

function escapeUnicode(str) {
  return str.replace(/[\u0080-\uFFFF]/g, (char) => {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
  });
}

async function uploadToDropbox(localPath, dropboxPath) {
  const fileContent = fs.readFileSync(localPath);
  const fileSize = fileContent.length;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

  log(`  📤 Uploading ${path.basename(localPath)} (${fileSizeMB} MB)...`, 'blue');

  const CHUNK_SIZE = 150 * 1024 * 1024;

  if (fileSize > CHUNK_SIZE) {
    return await uploadLargeFile(fileContent, dropboxPath, fileSize);
  }

  const dropboxApiArg = JSON.stringify({
    path: dropboxPath,
    mode: 'overwrite',
    autorename: false,
    mute: false
  });

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': escapeUnicode(dropboxApiArg)
    },
    body: fileContent
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }

  log(`  ✅ Uploaded successfully`, 'green');
  return await response.json();
}

async function uploadLargeFile(fileContent, dropboxPath, fileSize) {
  const CHUNK_SIZE = 150 * 1024 * 1024;
  let offset = 0;

  const startChunk = fileContent.slice(0, Math.min(CHUNK_SIZE, fileSize));
  const startResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ close: false })
    },
    body: startChunk
  });

  if (!startResponse.ok) {
    const error = await startResponse.text();
    throw new Error(`Upload session start failed: ${startResponse.status} - ${error}`);
  }

  const startResult = await startResponse.json();
  const sessionId = startResult.session_id;
  offset += startChunk.length;
  log(`    📊 Progress: ${((offset / fileSize) * 100).toFixed(1)}%`, 'cyan');

  while (offset < fileSize) {
    const chunk = fileContent.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
    const isLastChunk = (offset + chunk.length) >= fileSize;

    const appendResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: sessionId, offset: offset },
          close: isLastChunk
        })
      },
      body: chunk
    });

    if (!appendResponse.ok) {
      const error = await appendResponse.text();
      throw new Error(`Upload session append failed: ${appendResponse.status} - ${error}`);
    }

    offset += chunk.length;
    log(`    📊 Progress: ${((offset / fileSize) * 100).toFixed(1)}%`, 'cyan');
  }

  const commitArg = JSON.stringify({
    cursor: { session_id: sessionId, offset: offset },
    commit: {
      path: dropboxPath,
      mode: 'overwrite',
      autorename: false,
      mute: false
    }
  });

  const finishResponse = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': escapeUnicode(commitArg)
    },
    body: Buffer.alloc(0)
  });

  if (!finishResponse.ok) {
    const error = await finishResponse.text();
    throw new Error(`Upload session finish failed: ${finishResponse.status} - ${error}`);
  }

  log(`  ✅ Uploaded successfully`, 'green');
  return await finishResponse.json();
}

async function createShareLink(dropboxPath) {
  const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path: dropboxPath,
      settings: { requested_visibility: 'public' }
    })
  });

  if (response.ok) {
    const result = await response.json();
    let shareLink = result.url;
    shareLink = shareLink.replace(/[?&]dl=0/, (match) => match.charAt(0) + 'dl=1');
    return shareLink;
  } else if (response.status === 409) {
    const error = await response.text();
    if (error.includes('shared_link_already_exists')) {
      return await getExistingShareLink(dropboxPath);
    }
    throw new Error(`Create link failed: ${response.status} - ${error}`);
  } else {
    const error = await response.text();
    throw new Error(`Create link failed: ${response.status} - ${error}`);
  }
}

async function getExistingShareLink(dropboxPath) {
  const response = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: dropboxPath })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Get link failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const link = result.links.find(l => l.path_lower === dropboxPath.toLowerCase());

  if (link) {
    let shareLink = link.url;
    shareLink = shareLink.replace(/[?&]dl=0/, (match) => match.charAt(0) + 'dl=1');
    return shareLink;
  } else {
    throw new Error('No existing link found');
  }
}

async function ensureDropboxFolder(folderPath) {
  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: folderPath, autorename: false })
    });

    if (response.ok) {
      log(`  📁 Created Dropbox folder: ${folderPath}`, 'green');
    } else {
      const error = await response.text();
      if (error.includes('path/conflict/folder')) {
        log(`  📁 Dropbox folder exists: ${folderPath}`, 'blue');
      } else {
        throw new Error(`Create folder failed: ${response.status} - ${error}`);
      }
    }
  } catch (err) {
    if (err.message.includes('Create folder failed')) throw err;
    log(`  📁 Folder check: ${folderPath}`, 'blue');
  }
}

async function listDropboxFiles(folderPath) {
  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: folderPath })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`List failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.entries || [];
}

async function main() {
  try {
    log('\n🚀 ERGOHUB - Automated Build & Upload', 'bright');
    log('═'.repeat(50), 'cyan');

    DROPBOX_TOKEN = await getDropboxAccessToken();
    log('✅ Dropbox token ready', 'green');

    await ensureDropboxFolder(DROPBOX_FOLDER);

    const version = getVersion();
    log(`\n📦 Building version: ${version}`, 'bright');

    // Step 1: Clean dist
    logStep(1, 6, 'Cleaning dist folder...');
    execSync('npm run clean', { cwd: ROOT_DIR, stdio: 'inherit' });
    log('  ✅ Clean completed', 'green');

    // Step 2: Build React app
    logStep(2, 6, 'Building React app...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    log('  ✅ React build completed', 'green');

    // Step 3: Build NSIS installer
    logStep(3, 6, 'Building NSIS installer...');
    execSync('npm run clean-build-temp && set NODE_OPTIONS=--max-old-space-size=8192 && electron-builder --win nsis --x64', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    log('  ✅ Installer build completed', 'green');

    // Step 4: Locate exe
    logStep(4, 6, 'Locating built file...');
    const distDir = path.join(ROOT_DIR, 'dist');
    const files = fs.readdirSync(distDir);
    const exeFile = files.find(f => f.endsWith('-Setup.exe') && f.includes('ERGOHUB'));

    if (!exeFile) {
      throw new Error('Could not find ERGOHUB exe in dist/ folder!');
    }

    const exePath = path.join(distDir, exeFile);
    const fileSizeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(2);
    log(`  📄 ${exeFile} (${fileSizeMB} MB)`, 'blue');

    const checksum = calculateChecksum(exePath);
    log(`  🔐 Checksum: ${checksum}`, 'green');

    // Step 5: Upload to Dropbox
    logStep(5, 6, 'Uploading to Dropbox...');
    await uploadToDropbox(exePath, `${DROPBOX_FOLDER}/${DROPBOX_INSTALLER_FILENAME}`);
    log(`  ✅ Uploaded as: ${DROPBOX_INSTALLER_FILENAME}`, 'green');

    const shareLink = await createShareLink(`${DROPBOX_FOLDER}/${DROPBOX_INSTALLER_FILENAME}`);
    log(`  🔗 Link: ${shareLink}`, 'green');

    const today = new Date().toISOString().split('T')[0];

    const fileSize = fs.statSync(exePath).size;
    const versionInfo = {
      version: version,
      releaseDate: today,
      downloadUrl: shareLink,
      fileSize: fileSize,
      checksum: checksum,
      changelog: [`Ενημέρωση ERGOHUB ${version}`],
      mandatory: false
    };

    const versionPath = path.join(ROOT_DIR, 'version.json');
    fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2));
    await uploadToDropbox(versionPath, `${DROPBOX_FOLDER}/version.json`);
    log('  ✅ Uploaded: version.json', 'green');
    fs.unlinkSync(versionPath);

    // Step 6: Verify
    logStep(6, 6, 'Post-upload verification...');
    try {
      const items = await listDropboxFiles(DROPBOX_FOLDER);
      const fileList = items.filter(f => f['.tag'] === 'file');
      log(`  📄 Files in Dropbox: ${fileList.map(f => f.name).join(', ')}`, 'green');
    } catch (err) {
      log(`  ⚠️  Verification warning: ${err.message}`, 'yellow');
    }

    log('\n' + '═'.repeat(50), 'cyan');
    log('✅ BUILD & UPLOAD COMPLETED!', 'green');
    log('═'.repeat(50), 'cyan');
    log(`\n📦 Version: ${version}`, 'bright');
    log(`📅 Date: ${today}`, 'bright');
    log(`\n📁 Uploaded: ${DROPBOX_INSTALLER_FILENAME}`, 'green');
    log(`🔗 ${shareLink}`, 'blue');
    log('\n🎉 Η ενημέρωση είναι έτοιμη!\n', 'bright');

  } catch (error) {
    log('\n❌ ERROR: ' + error.message, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
