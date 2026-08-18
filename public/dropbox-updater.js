/**
 * ERGOHUB - Dropbox Auto-Update Manager
 * Adapted from ydrometer-pro
 */

const { app, shell } = require('electron');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const { enrichUpdateCheckResult } = require('./appUpdatePolicy');

class DropboxUpdater {
  constructor(config, progressCallback = null) {
    this.config = config;
    this.progressCallback = progressCallback;
    this.updateState = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      installing: false,
      error: null,
      currentVersion: app.getVersion(),
      latestVersion: null,
      downloadPath: null,
      downloadProgress: 0,
      updateInfo: null
    };
  }

  async checkForUpdates() {
    if (this.updateState.checking) {
      return { available: false, reason: 'check_in_progress' };
    }

    this.updateState.checking = true;
    this.updateState.error = null;

    try {
      console.log('[Update] Checking for updates...');
      const versionInfo = await this.fetchVersionInfo();

      if (!versionInfo) {
        throw new Error('Failed to fetch version info');
      }

      console.log(`[Update] Current: ${this.updateState.currentVersion}, Latest: ${versionInfo.version}`);
      const isNewer = this.isNewerVersion(versionInfo.version, this.updateState.currentVersion);

      if (isNewer) {
        this.updateState.available = true;
        this.updateState.latestVersion = versionInfo.version;
        this.updateState.updateInfo = versionInfo;

        console.log(`[Update] New version available: ${versionInfo.version}`);
        return enrichUpdateCheckResult({
          available: true,
          version: versionInfo.version,
          releaseDate: versionInfo.releaseDate,
          downloadUrl: versionInfo.downloadUrl,
          fileSize: versionInfo.fileSize,
          checksum: versionInfo.checksum,
          changelog: versionInfo.changelog,
          mandatory: versionInfo.mandatory || false
        }, this.updateState.currentVersion);
      } else {
        console.log('[Update] Already up to date');
        return { available: false, reason: 'up_to_date' };
      }
    } catch (error) {
      console.error('[Update] Check failed:', error.message);
      this.updateState.error = error.message;
      return { available: false, error: error.message };
    } finally {
      this.updateState.checking = false;
    }
  }

  async fetchVersionInfo() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.CHECK_TIMEOUT);

    try {
      const url = this.config.VERSION_JSON_URL;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        try { return JSON.parse(text); }
        catch (_e) { throw new Error('Invalid response: expected JSON'); }
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Update check timeout - no internet connection?');
      }
      throw error;
    }
  }

  async downloadUpdate(downloadUrl) {
    if (this.updateState.downloading) {
      return null;
    }

    this.updateState.downloading = true;
    this.updateState.downloadProgress = 0;
    this.updateState.error = null;

    try {
      console.log('[Update] Starting download...');

      const baseDir = this.config.USE_DOWNLOADS_FOLDER
        ? app.getPath('downloads')
        : app.getPath('temp');
      const tempDir = path.join(baseDir, this.config.TEMP_FOLDER);

      if (!fs.existsSync(tempDir)) {
        await fsPromises.mkdir(tempDir, { recursive: true });
      }

      const downloadPath = path.join(tempDir, this.config.INSTALLER_NAME);

      if (fs.existsSync(downloadPath)) {
        await fsPromises.unlink(downloadPath);
      }

      await this.retryOperation(async () => {
        await this.downloadFile(downloadUrl, downloadPath);
      }, this.config.MAX_RETRIES);

      if (this.updateState.updateInfo && this.updateState.updateInfo.checksum) {
        console.log('[Update] Verifying checksum...');
        await this.verifyDownload(downloadPath, this.updateState.updateInfo.checksum);
        console.log('[Update] Checksum verified: OK');
      }

      this.updateState.downloaded = true;
      this.updateState.downloadPath = downloadPath;
      this.updateState.downloadProgress = 100;

      console.log(`[Update] Download complete: ${downloadPath}`);
      return downloadPath;
    } catch (error) {
      console.error('[Update] Download failed:', error.message);
      this.updateState.error = error.message;
      throw error;
    } finally {
      this.updateState.downloading = false;
    }
  }

  async downloadFile(url, destination) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.DOWNLOAD_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      const fileStream = fs.createWriteStream(destination);
      const reader = response.body.getReader();

      let downloadedSize = 0;
      let lastLoggedProgress = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const canContinue = fileStream.write(Buffer.from(value));
        if (!canContinue) {
          await new Promise(resolve => fileStream.once('drain', resolve));
        }

        downloadedSize += value.length;

        if (totalSize > 0) {
          this.updateState.downloadProgress = Math.round((downloadedSize / totalSize) * 100);
          if (this.progressCallback) {
            this.progressCallback({
              percent: this.updateState.downloadProgress,
              transferred: downloadedSize,
              total: totalSize
            });
          }
          if (this.updateState.downloadProgress !== lastLoggedProgress &&
              this.updateState.downloadProgress % 25 === 0) {
            console.log(`[Update] Downloading: ${this.updateState.downloadProgress}%`);
            lastLoggedProgress = this.updateState.downloadProgress;
          }
        }
      }

      await new Promise((resolve, reject) => {
        const streamTimeout = setTimeout(() => {
          reject(new Error('File stream did not finish writing in time'));
        }, 60000);
        fileStream.on('finish', () => { clearTimeout(streamTimeout); resolve(); });
        fileStream.on('error', (err) => { clearTimeout(streamTimeout); reject(err); });
        fileStream.end();
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') throw new Error('Download timeout');
      throw error;
    }
  }

  async installUpdate() {
    if (!this.updateState.downloaded || !this.updateState.downloadPath) {
      throw new Error('Δεν υπάρχει κατεβασμένη ενημέρωση.');
    }

    if (!fs.existsSync(this.updateState.downloadPath)) {
      this.updateState.downloaded = false;
      this.updateState.downloadPath = null;
      throw new Error('Το αρχείο εγκατάστασης δεν βρέθηκε στο δίσκο.');
    }

    if (this.updateState.installing) {
      return { success: true, message: 'Already installing' };
    }

    this.updateState.installing = true;

    try {
      console.log('[Update] Installing update...');
      await this.savePreUpdateSnapshot();
      return await this.runInstaller(this.updateState.downloadPath);
    } catch (error) {
      console.error('[Update] Installation failed:', error.message);
      this.updateState.error = error.message;
      this.updateState.installing = false;
      throw error;
    }
  }

  async runInstaller(installerPath) {
    if (process.platform === 'win32') {
      try {
        const tempDir = app.getPath('temp');
        const tempInstallerPath = path.join(tempDir, 'ergohub-installer-temp.exe');
        const logFile = path.join(tempDir, 'ergohub-update.log');
        const batchPath = path.join(tempDir, 'ergohub-update-launcher.bat');

        await fsPromises.copyFile(installerPath, tempInstallerPath);

        const myPid = process.pid;
        const batchContent = [
          '@echo off',
          'setlocal',
          `echo [%date% %time%] Update launcher started > "${logFile}"`,
          `echo [%date% %time%] Waiting for PID ${myPid} to exit... >> "${logFile}"`,
          '',
          'set /a WAIT_COUNT=0',
          ':WAIT_LOOP',
          `tasklist /FI "PID eq ${myPid}" 2>nul | find /I "${myPid}" >nul`,
          'if %ERRORLEVEL% EQU 0 (',
          `  echo [%date% %time%] App still running... >> "${logFile}"`,
          '  set /a WAIT_COUNT+=1',
          '  if %WAIT_COUNT% GEQ 20 (',
          `    echo [%date% %time%] Timeout - proceeding anyway >> "${logFile}"`,
          '    goto WAIT_DONE',
          '  )',
          '  timeout /t 1 /nobreak >nul 2>&1',
          '  goto WAIT_LOOP',
          ')',
          ':WAIT_DONE',
          '',
          `echo [%date% %time%] Launching installer... >> "${logFile}"`,
          `"${tempInstallerPath}"`,
          `echo [%date% %time%] Installer exited: %ERRORLEVEL% >> "${logFile}"`,
          `del "${tempInstallerPath}" >nul 2>&1`,
          'endlocal',
        ].join('\r\n');

        await fsPromises.writeFile(batchPath, batchContent, 'utf8');

        const vbsPath = path.join(tempDir, 'ergohub-update-launcher.vbs');
        const escapedBatch = batchPath.replace(/\\/g, '\\\\');
        const vbsContent = [
          'Set WshShell = CreateObject("WScript.Shell")',
          `WshShell.Run "cmd.exe /c """ & "${escapedBatch}" & """", 0, False`,
          'Set WshShell = Nothing',
        ].join('\r\n');
        await fsPromises.writeFile(vbsPath, vbsContent, 'utf8');

        spawn('wscript.exe', ['//nologo', vbsPath], {
          detached: true, stdio: 'ignore', shell: false
        }).unref();

        console.log('[Update] Installer spawned, quitting app...');
        setTimeout(() => { app.quit(); }, 1000);

        return { success: true };
      } catch (error) {
        console.error('[Update] Failed to prepare installer:', error);
        throw error;
      }
    } else {
      exec(installerPath, (error) => {
        if (error) console.error('[Update] Installer failed:', error);
        setTimeout(() => { app.quit(); }, 2000);
      });
      return { success: true };
    }
  }

  async verifyDownload(filePath, expectedChecksum) {
    const fileBuffer = await fsPromises.readFile(filePath);
    let algorithm = 'sha256';
    let expectedHash = expectedChecksum;

    if (expectedChecksum.includes(':')) {
      [algorithm, expectedHash] = expectedChecksum.split(':');
    }

    const actualHash = crypto.createHash(algorithm).update(fileBuffer).digest('hex');

    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      await fsPromises.unlink(filePath);
      throw new Error(`Checksum mismatch`);
    }
    return true;
  }

  isNewerVersion(latest, current) {
    const latestClean = latest.replace(/^v/, '');
    const currentClean = current.replace(/^v/, '');
    const latestParts = latestClean.split('.').map(Number);
    const currentParts = currentClean.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  async retryOperation(operation, maxRetries) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try { return await operation(); }
      catch (error) {
        lastError = error;
        console.warn(`[Update] Attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt < maxRetries) {
          const delay = Math.min(this.config.RETRY_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async savePreUpdateSnapshot() {
    try {
      const snapshotPath = path.join(app.getPath('userData'), 'pre-update-snapshot.json');
      const snapshot = {
        version: app.getVersion(),
        timestamp: Date.now(),
        updateTo: this.updateState.latestVersion
      };
      await fsPromises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
      console.warn('[Update] Failed to save snapshot:', error.message);
    }
  }

  async checkUpdateHealth() {
    try {
      const snapshotPath = path.join(app.getPath('userData'), 'pre-update-snapshot.json');
      if (!fs.existsSync(snapshotPath)) return { healthy: true, reason: 'no_snapshot' };

      const snapshotData = await fsPromises.readFile(snapshotPath, 'utf8');
      const snapshot = JSON.parse(snapshotData);
      const timeSinceUpdate = Date.now() - snapshot.timestamp;

      if (timeSinceUpdate < 300000) {
        await fsPromises.unlink(snapshotPath);
        return { healthy: true, updated: true, from: snapshot.version, to: app.getVersion() };
      }

      await fsPromises.unlink(snapshotPath);
      return { healthy: true, reason: 'old_snapshot' };
    } catch (error) {
      return { healthy: true, reason: 'check_failed' };
    }
  }

  async cleanup() {
    try {
      const baseDir = this.config.USE_DOWNLOADS_FOLDER
        ? app.getPath('downloads') : app.getPath('temp');
      const tempDir = path.join(baseDir, this.config.TEMP_FOLDER);
      if (fs.existsSync(tempDir)) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (_e) { /* ignore */ }
  }

  getState() {
    return { ...this.updateState };
  }
}

module.exports = { DropboxUpdater };
