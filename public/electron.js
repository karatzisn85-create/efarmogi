const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const { safeWriteJSON, safeWriteJSONAsync } = require('./safeWrite');
const { initConfigPath, loadConfig, saveConfig, resolveDataDir } = require('./appConfig');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const schedule = require('node-schedule');
const archiver = require('archiver');
const fse = require('fs-extra');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { DropboxUpdater } = require('./dropbox-updater');
const { UPDATE_CONFIG } = require('./update-config');
const { logger } = require('./logger');
const {
  createTaskAssignmentService,
  normalizeTaskAssignment,
  sanitizeTaskAssignmentForClient
} = require('./taskAssignmentService');

// Helper function to get temp directory path (portable-safe)
const getTempDir = () => {
  // Στο portable mode, χρησιμοποιούμε το app.getPath('userData') που είναι writable
  // Στο development mode, χρησιμοποιούμε το __dirname
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'temp_uploads');
  } else {
    return path.join(__dirname, 'temp_uploads');
  }
};

/** Αφαίρεση παλιού πεδίου «Επιβλέπων Μηχανικός» (αντικαταστάθηκε από σύστημα χρέωσης). */
function stripLegacySupervisorField(obj) {
  if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, 'supervisor')) {
    delete obj.supervisor;
  }
  return obj;
}

// Utility function για καθαρισμό temp files
const cleanupTempFiles = async (entaxiFiles = [], approvalFiles = []) => {
  try {
    const tempDir = getTempDir();
    if (!fs.existsSync(tempDir)) return;

    console.log('🧹 Starting temp files cleanup...');
    
    const filesToCleanup = [];
    
    // Συλλογή temp files από entaxi PDFs
    if (Array.isArray(entaxiFiles)) {
      entaxiFiles.forEach(file => {
        if (file && file.filePath && file.filePath.includes('temp_uploads')) {
          filesToCleanup.push(file.filePath);
        }
      });
    }
    
    // Συλλογή temp files από approval PDFs
    if (Array.isArray(approvalFiles)) {
      approvalFiles.forEach(file => {
        if (file && file.filePath && file.filePath.includes('temp_uploads')) {
          filesToCleanup.push(file.filePath);
        }
      });
    }
    
    // Διαγραφή temp files
    filesToCleanup.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('🗑️ Cleaned temp file:', path.basename(filePath));
        }
      } catch (error) {
        console.error('❌ Error cleaning temp file:', filePath, error.message);
      }
    });
    
    console.log(`✅ Cleanup completed. Removed ${filesToCleanup.length} temp files.`);
  } catch (error) {
    console.error('❌ Error in cleanupTempFiles:', error);
  }
};

// Utility function για καθαρισμό παλιών temp files (μεγαλύτερα από 24 ώρες)
const cleanupOldTempFiles = async () => {
  try {
    const tempDir = getTempDir();
    if (!fs.existsSync(tempDir)) return;

    console.log('🧹 Starting old temp files cleanup...');
    
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000; // 24 ώρες σε milliseconds
    let cleanedCount = 0;
    
    files.forEach(fileName => {
      try {
        const filePath = path.join(tempDir, fileName);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();
        
        if (fileAge > oneDayMs) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          cleanedCount++;
          console.log('🗑️ Cleaned old temp file/folder:', fileName);
        }
      } catch (error) {
        console.error('❌ Error cleaning old temp file:', fileName, error.message);
      }
    });
    
    console.log(`✅ Old temp cleanup completed. Removed ${cleanedCount} old files/folders.`);
  } catch (error) {
    console.error('❌ Error in cleanupOldTempFiles:', error);
  }
};

// Set UTF-8 encoding for the entire application
try {
  if (process.stdout && typeof process.stdout.setEncoding === 'function') {
    process.stdout.setEncoding('utf8');
  }
} catch (e) {
  // Ignore encoding errors in Electron environment
}

try {
  if (process.stderr && typeof process.stderr.setEncoding === 'function') {
    process.stderr.setEncoding('utf8');
  }
} catch (e) {
  // Ignore encoding errors in Electron environment
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Ειδική διαχείριση για file watcher errors
  if (error.code === 'ECONNRESET' && error.syscall === 'watch') {
    console.log('⚠️ File watcher ECONNRESET - Ignoring and continuing...');
    // Επανεκκίνηση του watcher αν χρειάζεται
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        startLockWatcher(mainWindow);
      } catch (e) {
        console.error('Failed to restart watcher:', e.message);
      }
    }
    return; // Δεν κάνουμε exit
  }
  
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// File watcher για realtime lock monitoring
let lockWatcher = null;

// Global mainWindow reference for backup notifications
let mainWindow = null;

/** Όταν true, το κλείσιμο παραθύρου/έξοδος εμποδίζεται — ο χρήστης πρέπει να χρησιμοποιήσει «Αποσύνδεση» στο Dashboard. */
let dashboardSessionActive = false;
/** Συνδεδεμένος χρήστης — για έλεγχο ταυτότητας στις ενέργειες χώρου εργασίας. */
let loggedInUsername = null;

const isDev = false; // Force production mode

function createWindow() {
  // Διόρθωση για GPU προβλήματα
  app.commandLine.appendSwitch('--disable-gpu');
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--disable-gpu-compositing');
  app.commandLine.appendSwitch('--disable-gpu-rasterization');
  app.commandLine.appendSwitch('--disable-gpu-process-crash-limit');
  
  // UTF-8 encoding fixes
  app.commandLine.appendSwitch('--lang', 'el-GR');
  app.commandLine.appendSwitch('--force-device-scale-factor', '1');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
    show: false,
    maximized: true
  });

  // Φόρτωση από build folder (production mode)
  // Με asar, το __dirname δείχνει στο asar archive, οπότε χρησιμοποιούμε app.getAppPath()
  const indexPath = app.isPackaged 
    ? path.join(app.getAppPath(), 'build', 'index.html')
    : path.join(__dirname, '../build/index.html');
  console.log('Loading file:', indexPath);
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('Error loading file:', err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Εκκίνηση του lock watcher
    startLockWatcher(mainWindow);
    // Καθαρισμός παλιών temp files κατά την εκκίνηση
    cleanupOldTempFiles();
  });

  // Error handlers for the window
  mainWindow.webContents.on('crashed', () => {
    console.error('Window crashed');
  });

  mainWindow.on('unresponsive', () => {
    console.error('Window became unresponsive');
  });

  mainWindow.on('responsive', () => {
    console.log('Window became responsive again');
  });

  mainWindow.on('close', (event) => {
    if (dashboardSessionActive && mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      try {
        mainWindow.webContents.send('app-close-blocked');
      } catch (err) {
        console.error('[CloseGuard] app-close-blocked send failed:', err);
      }
    }
  });

  // Developer Tools μόνο σε development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.handle('getAppVersion', () => app.getVersion());

ipcMain.handle('get-app-config', () => loadConfig());

ipcMain.handle('set-dashboard-session-active', (_event, activeOrPayload) => {
  if (typeof activeOrPayload === 'boolean') {
    dashboardSessionActive = activeOrPayload;
    if (!activeOrPayload) loggedInUsername = null;
  } else {
    const p = activeOrPayload && typeof activeOrPayload === 'object' ? activeOrPayload : {};
    dashboardSessionActive = Boolean(p.active);
    loggedInUsername =
      dashboardSessionActive && p.username ? String(p.username).trim() : null;
  }
  return { ok: true };
});

ipcMain.handle('save-app-config', async (_event, newConfig) => {
  saveConfig(newConfig);
  if (newConfig.setupCompleted || newConfig.dataDir) {
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  }
  return { success: true };
});

ipcMain.handle('get-data-dir', () => dataDir);
ipcMain.handle('check-data-dir-exists', () => dataDir && fs.existsSync(dataDir));

ipcMain.handle('select-data-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Επιλέξτε φάκελο δεδομένων',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('check-folder-has-config', async (_event, folderPath) => {
  if (!folderPath) return { hasUsers: false, hasProjects: false };
  const hasUsers = fs.existsSync(path.join(folderPath, 'users.json'));
  const projectsDir = path.join(folderPath, 'entaxeis');
  let projectCount = 0;
  if (fs.existsSync(projectsDir)) {
    try {
      projectCount = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json')).length;
    } catch (_e) { /* ignore */ }
  }
  return { hasUsers, hasProjects: projectCount > 0, projectCount };
});

// ── User Management ──

const SALT = 'ErgoHub2026!@#SecureSalt';

function hashPassword(password) {
  return crypto.createHash('sha256').update(SALT + password).digest('hex');
}

function getUsersPath() {
  return path.join(dataDir, 'users.json');
}

function loadUsers() {
  const usersPath = getUsersPath();
  try {
    if (fs.existsSync(usersPath)) {
      return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load users.json:', e.message);
  }
  return [];
}

function saveUsers(users) {
  safeWriteJSON(getUsersPath(), users);
}

function findUserByUsername(username) {
  const users = loadUsers();
  const u = String(username || '').trim();
  if (!u) return null;
  return users.find((x) => x.username.toLowerCase() === u.toLowerCase()) || null;
}

function isSuperAdminUser(username) {
  const u = findUserByUsername(username);
  return !!(u && u.role === 'SUPERADMIN');
}

let taskAssignmentService = null;

function getTaskAssignmentService() {
  if (!taskAssignmentService && dataDir) {
    taskAssignmentService = createTaskAssignmentService({
      dataDir,
      loadUsers,
      getTempDir,
      onNotifyMainWindow: (payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-notification', payload);
        }
        /* Οι ειδοποιήσεις εμφανίζονται in-app (toast)· όχι διπλό OS popup. */
      }
    });
    taskAssignmentService.ensureTaskStorage();
  }
  return taskAssignmentService;
}

ipcMain.handle('authenticate', async (_event, { username, password }) => {
  const users = loadUsers();
  const hashed = hashPassword(password);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hashed && u.active !== false);
  if (!user) return { success: false, error: 'Λάθος όνομα χρήστη ή κωδικός' };
  if (user.approved === false) return { success: false, error: 'Ο λογαριασμός σας αναμένει έγκριση από τον διαχειριστή' };
  return {
    success: true,
    user: {
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      assignedSupervisors: Array.isArray(user.assignedSupervisors) ? user.assignedSupervisors : [],
      taskAssignment: sanitizeTaskAssignmentForClient(user.taskAssignment)
    }
  };
});

ipcMain.handle('register-user', async (_event, { username, password, role, fullName }) => {
  const users = loadUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Το όνομα χρήστη υπάρχει ήδη' };
  }
  const allowedRoles = ['ADMIN', 'USER'];
  if (!allowedRoles.includes(role)) return { success: false, error: 'Μη έγκυρος ρόλος' };
  if (!password || password.length < 4) return { success: false, error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες' };

  users.push({
    username: username.trim(),
    passwordHash: hashPassword(password),
    role,
    fullName: fullName || username,
    active: true,
    approved: false,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('get-users', async () => {
  const users = loadUsers();
  return users.map(u => ({
    username: u.username,
    role: u.role,
    fullName: u.fullName,
    active: u.active !== false,
    approved: u.approved !== false,
    createdAt: u.createdAt,
    assignedSupervisors: Array.isArray(u.assignedSupervisors) ? u.assignedSupervisors : [],
    taskAssignment: sanitizeTaskAssignmentForClient(u.taskAssignment)
  }));
});

ipcMain.handle('create-user', async (_event, { username, password, role, fullName, assignedSupervisors = [], taskAssignment, actingUsername }) => {
  const users = loadUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Το όνομα χρήστη υπάρχει ήδη' };
  }
  const validRoles = ['SUPERADMIN', 'ADMIN', 'USER', 'ENGINEER'];
  if (!validRoles.includes(role)) return { success: false, error: 'Μη έγκυρος ρόλος' };
  const normalizedSupervisors = Array.isArray(assignedSupervisors)
    ? [...new Set(assignedSupervisors.map(s => String(s || '').trim()).filter(Boolean))]
    : [];

  let taskAssignmentNorm = normalizeTaskAssignment({ canAssign: false, assignableScope: 'none', assignableUsernames: [] });
  if (taskAssignment !== undefined) {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να ορίσει δικαιώματα χώρου εργασίας' };
    }
    taskAssignmentNorm = normalizeTaskAssignment(taskAssignment);
  }

  users.push({
    username: username.trim(),
    passwordHash: hashPassword(password),
    role,
    fullName: fullName || username,
    active: true,
    assignedSupervisors: role === 'ENGINEER' ? normalizedSupervisors : [],
    taskAssignment: taskAssignmentNorm,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  logAuditAction({
    type: 'create',
    entityType: 'user',
    entityId: username.trim(),
    entityTitle: fullName || username,
    details: `Δημιουργία χρήστη με ρόλο ${role === 'ENGINEER' ? 'Μηχανικός' : role === 'ADMIN' ? 'Διαχειριστής' : role}`
  });
  return { success: true };
});

ipcMain.handle('update-user', async (_event, { username, updates, actingUsername }) => {
  const users = loadUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  const oldUserData = { ...users[idx] };
  delete oldUserData.passwordHash;

  if (updates.fullName !== undefined) users[idx].fullName = updates.fullName;
  if (updates.role !== undefined) users[idx].role = updates.role;
  if (updates.active !== undefined) users[idx].active = updates.active;
  if (updates.approved !== undefined) users[idx].approved = updates.approved;
  if (updates.password) users[idx].passwordHash = hashPassword(updates.password);
  if (updates.assignedSupervisors !== undefined) {
    const normalizedSupervisors = Array.isArray(updates.assignedSupervisors)
      ? [...new Set(updates.assignedSupervisors.map(s => String(s || '').trim()).filter(Boolean))]
      : [];
    users[idx].assignedSupervisors = normalizedSupervisors;
  }
  if (updates.role !== undefined && updates.role !== 'ENGINEER') {
    users[idx].assignedSupervisors = [];
  }
  if (updates.taskAssignment !== undefined) {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να αλλάξει δικαιώματα χώρου εργασίας' };
    }
    users[idx].taskAssignment = normalizeTaskAssignment(updates.taskAssignment);
  }

  const newUserData = { ...users[idx] };
  delete newUserData.passwordHash;

  saveUsers(users);
  logAuditAction({
    type: 'update',
    entityType: 'user',
    entityId: username,
    entityTitle: users[idx].fullName || username,
    details: 'Ενημέρωση στοιχείων χρήστη',
    oldValue: oldUserData,
    newValue: newUserData
  });
  return { success: true };
});

ipcMain.handle('delete-user', async (_event, { username }) => {
  let users = loadUsers();
  const target = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!target) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  const superadmins = users.filter(u => u.role === 'SUPERADMIN' && u.active !== false);
  if (target.role === 'SUPERADMIN' && superadmins.length <= 1) {
    return { success: false, error: 'Δεν μπορεί να διαγραφεί ο τελευταίος SUPERADMIN' };
  }

  users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  saveUsers(users);
  logAuditAction({
    type: 'delete',
    entityType: 'user',
    entityId: username,
    entityTitle: target.fullName || username,
    details: 'Διαγραφή χρήστη'
  });
  return { success: true };
});

ipcMain.handle('change-password', async (_event, { username, oldPassword, newPassword }) => {
  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  if (user.passwordHash !== hashPassword(oldPassword)) {
    return { success: false, error: 'Ο τρέχων κωδικός είναι λάθος' };
  }

  user.passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('has-users', async () => {
  const users = loadUsers();
  return users.length > 0;
});

// ── Auto-Update ──
let updater = null;

function initAutoUpdate() {
  updater = new DropboxUpdater(UPDATE_CONFIG, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', progress);
    }
  });

  const delay = UPDATE_CONFIG.STARTUP_CHECK_DELAY_MIN +
    Math.random() * (UPDATE_CONFIG.STARTUP_CHECK_DELAY_MAX - UPDATE_CONFIG.STARTUP_CHECK_DELAY_MIN);

  setTimeout(async () => {
    try {
      const health = await updater.checkUpdateHealth();
      if (health.updated && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-installed', {
          from: health.from, to: health.to
        });
      }

      const updateInfo = await updater.checkForUpdates();
      if (updateInfo.available) {
        console.log(`[Update] New version available: ${updateInfo.version}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', updateInfo);
        }
        if (UPDATE_CONFIG.AUTO_DOWNLOAD) {
          try {
            const downloadPath = await updater.downloadUpdate(updateInfo.downloadUrl);
            if (downloadPath && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update-downloaded', {
                version: updateInfo.version, path: downloadPath
              });
            }
          } catch (dlErr) {
            console.error('[Update] Auto-download failed:', dlErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Update] Startup check failed:', err.message);
    }
  }, delay);

  if (UPDATE_CONFIG.CHECK_INTERVAL > 0) {
    global._updateCheckInterval = setInterval(async () => {
      try {
        const updateInfo = await updater.checkForUpdates();
        if (updateInfo.available && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', updateInfo);
          if (UPDATE_CONFIG.AUTO_DOWNLOAD) {
            const downloadPath = await updater.downloadUpdate(updateInfo.downloadUrl);
            if (downloadPath && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update-downloaded', {
                version: updateInfo.version, path: downloadPath
              });
            }
          }
        }
      } catch (_e) { /* silent */ }
    }, UPDATE_CONFIG.CHECK_INTERVAL);
  }
}

ipcMain.handle('check-for-updates', async () => {
  if (!updater) return { available: false, error: 'Updater not initialized' };
  return await updater.checkForUpdates();
});

ipcMain.handle('download-update', async (_event, downloadUrl) => {
  if (!updater) throw new Error('Updater not initialized');
  return await updater.downloadUpdate(downloadUrl);
});

ipcMain.handle('install-update', async () => {
  if (!updater) throw new Error('Updater not initialized');
  const wasDashboardSession = dashboardSessionActive;
  dashboardSessionActive = false;
  try {
    return await updater.installUpdate();
  } catch (err) {
    dashboardSessionActive = wasDashboardSession;
    throw err;
  }
});

ipcMain.handle('get-update-state', () => {
  if (!updater) return null;
  return updater.getState();
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    logger.init(path.join(app.getPath('userData'), 'logs'));
    logger.info('App', `ERGOHUB v${app.getVersion()} starting`);
    createWindow();
    initTaskAssignmentScheduler();
    if (app.isPackaged) {
      console.log('[Update] Production mode - auto-update enabled');
      initAutoUpdate();
    } else {
      console.log('[Update] Dev mode - auto-update skipped');
    }
  });
}

app.on('before-quit', (event) => {
  if (dashboardSessionActive) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      try {
        mainWindow.webContents.send('app-close-blocked');
      } catch (err) {
        console.error('[CloseGuard] before-quit notify failed:', err);
      }
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Κλείσιμο file watchers
    if (lockWatcher) { lockWatcher.close(); lockWatcher = null; }
    if (activeTaskWatcher) { activeTaskWatcher.close(); activeTaskWatcher = null; }
    
    // Clean up mainWindow reference
    mainWindow = null;
    
    // Clean up all lock files when app closes
    try {
      if (fs.existsSync(dataDir)) {
        const projectDirs = fs.readdirSync(dataDir);
        for (const projectDir of projectDirs) {
          const projectPath = path.join(dataDir, projectDir);
          if (fs.statSync(projectPath).isDirectory()) {
            const lockFile = path.join(projectPath, '.lock');
            if (fs.existsSync(lockFile)) {
              fs.unlinkSync(lockFile);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up lock files:', error);
    }
    
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

initConfigPath(app);
let dataDir = resolveDataDir(app);

console.log('Active dataDir:', dataDir);

const requiredSubDirs = [
  'entaxeis',
  'ΠΡΟΣΚΛΗΣΕΙΣ',
  'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ',
  'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ',
  'EGKRISEIS_DIATHESIS_PISTOSIS',
  'ARCHIVE_EGKRISEIS',
  'DOCUMENT_TEMPLATES',
  'ΣΗΜΕΙΩΣΕΙΣ',
  'locks',
  'egkriseis_links',
  'subproject_links',
  'backups',
  'ektelestea_erga',
  'ANATHESEIS_ERGASION'
];

function ensureSubDirs() {
  if (!dataDir) return;
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    for (const sub of requiredSubDirs) {
      const p = path.join(dataDir, sub);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }
  } catch (e) {
    console.error('Error creating subdirectories:', e.message);
  }
}

ensureSubDirs();

/** Παλιό αρχείο χειροκίνητου καταλόγου μηχανικών — το χαρακτηριστικό καταργήθηκε· διαγράφεται αν υπάρχει ακόμα. */
function removeLegacyRegisteredEngineersFile() {
  if (!dataDir) return;
  const fp = path.join(dataDir, 'registered-engineers.json');
  try {
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      console.log('[cleanup] Removed legacy registered-engineers.json');
    }
  } catch (e) {
    console.warn('[cleanup] Could not remove registered-engineers.json:', e.message);
  }
}
removeLegacyRegisteredEngineersFile();


const locksDir = dataDir ? path.join(dataDir, 'locks') : null;

// Εκκίνηση file watcher για locks
function startLockWatcher(mainWindow) {
  if (lockWatcher) {
    try {
    lockWatcher.close();
    } catch (e) {
      console.warn('Error closing previous watcher:', e.message);
    }
  }
  
  try {
    lockWatcher = fs.watch(locksDir, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith('.lock') || filename.includes('projects'))) {
        console.log(`Lock file changed: ${eventType} - ${filename}`);
        // Ενημέρωση του renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('locks-changed');
        }
      }
    });
    
    // Προσθήκη error handler για να αποφύγουμε crashes
    if (lockWatcher) {
      lockWatcher.on('error', (error) => {
        console.error('Lock watcher error:', error.message);
        // Αν υπάρξει ECONNRESET ή άλλο σφάλμα, επανεκκίνηση του watcher
        if (error.code === 'ECONNRESET' || error.code === 'EPERM' || error.code === 'ENOENT') {
          console.log('Restarting lock watcher due to error...');
          setTimeout(() => {
            startLockWatcher(mainWindow);
          }, 2000); // Περιμένουμε 2 δευτερόλεπτα πριν επανεκκινήσουμε
        }
      });
    }
    
    console.log('✅ Lock file watcher started');
  } catch (error) {
    console.error('❌ Error starting lock watcher:', error);
  }
}

// ============================================================
// FILE LOCKING FUNCTIONS
// ============================================================

// Check if process is running (Windows)
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

// Generic lock file creation for any entity type
function createEntityLock(entityType, entityId) {
  try {
    // Create locks directory structure
    const locksDir = path.join(dataDir, 'locks', entityType);
    if (!fs.existsSync(locksDir)) {
      fs.mkdirSync(locksDir, { recursive: true });
    }
    
    const lockFile = path.join(locksDir, `${entityId}.lock`);
    
    // Check if lock exists
    if (fs.existsSync(lockFile)) {
      const lockData = fs.readFileSync(lockFile, 'utf8');
      const lockPid = parseInt(lockData.trim());
      
      // Check if process is still running
      if (isProcessRunning(lockPid)) {
        return { success: false, error: `Το ${entityType} είναι ανοιχτό από άλλον χρήστη` };
      } else {
        // Process is dead, remove stale lock
        fs.unlinkSync(lockFile);
      }
    }
    
    // Create new lock
    fs.writeFileSync(lockFile, process.pid.toString());
    console.log(`Created lock for ${entityType}: ${entityId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create lock file for project (backward compatibility)
function createProjectLock(projectId) {
  return createEntityLock('projects', projectId);
}

// Generic lock file removal for any entity type
function removeEntityLock(entityType, entityId) {
  try {
    const locksDir = path.join(dataDir, 'locks', entityType);
    const lockFile = path.join(locksDir, `${entityId}.lock`);
    
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      console.log(`Removed lock for ${entityType}: ${entityId}`);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Remove lock file for project (backward compatibility)
function removeProjectLock(projectId) {
  // Also remove old-style lock
  try {
    const projectDir = path.join(dataDir, projectId);
    const lockFile = path.join(projectDir, '.lock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (error) {
    console.error('Error removing old-style lock:', error);
  }
  
  return removeEntityLock('projects', projectId);
}

// Generic check if entity is locked
function isEntityLocked(entityType, entityId) {
  try {
    const locksDir = path.join(dataDir, 'locks', entityType);
    const lockFile = path.join(locksDir, `${entityId}.lock`);
    
    if (fs.existsSync(lockFile)) {
      const lockData = fs.readFileSync(lockFile, 'utf8');
      const lockPid = parseInt(lockData.trim());
      
      // Check if process is still running
      if (isProcessRunning(lockPid)) {
        return { locked: true, pid: lockPid };
      } else {
        // Process is dead, remove stale lock
        fs.unlinkSync(lockFile);
        return { locked: false };
      }
    }
    
    return { locked: false };
  } catch (error) {
    return { locked: false, error: error.message };
  }
}

// Check if project is locked (backward compatibility)
function isProjectLocked(projectId) {
  // First check old-style lock
  try {
    const projectDir = path.join(dataDir, projectId);
    const lockFile = path.join(projectDir, '.lock');
    
    if (fs.existsSync(lockFile)) {
      const lockData = fs.readFileSync(lockFile, 'utf8');
      const lockPid = parseInt(lockData.trim());
      
      if (isProcessRunning(lockPid)) {
        return { locked: true, pid: lockPid };
      } else {
        fs.unlinkSync(lockFile);
      }
    }
  } catch (error) {
    console.error('Error checking old-style lock:', error);
  }
  
  // Then check new-style lock
  return isEntityLocked('projects', projectId);
}

// ============================================================
// IPC HANDLERS
// ============================================================

// IPC Handler για έλεγχο lock status - REMOVED (duplicate, see backward compatibility section)

// IPC Handler για καθαρισμό όλων των lock files
ipcMain.handle('clear-all-locks', async (event) => {
  try {
    let clearedCount = 0;
    
    // Clear old-style project locks
    if (fs.existsSync(dataDir)) {
      const projectDirs = fs.readdirSync(dataDir);
      
      for (const projectDir of projectDirs) {
        const projectPath = path.join(dataDir, projectDir);
        
        if (fs.statSync(projectPath).isDirectory()) {
          const lockFile = path.join(projectPath, '.lock');
          
          if (fs.existsSync(lockFile)) {
            try {
              // Read the PID from lock file
              const lockData = fs.readFileSync(lockFile, 'utf8');
              const lockPid = parseInt(lockData.trim());
              
              // Check if process is still running
              if (!isProcessRunning(lockPid)) {
                // Process is dead, remove stale lock
                fs.unlinkSync(lockFile);
                clearedCount++;
                console.log(`Cleared stale old-style lock for project: ${projectDir}`);
              } else {
                console.log(`Keeping active old-style lock for project: ${projectDir} (PID: ${lockPid})`);
              }
            } catch (error) {
              // If we can't read the lock file, delete it anyway
              fs.unlinkSync(lockFile);
              clearedCount++;
              console.log(`Cleared corrupted old-style lock for project: ${projectDir}`);
            }
          }
        }
      }
    }
    
    // Clear new-style locks
    const locksDir = path.join(dataDir, 'locks');
    if (fs.existsSync(locksDir)) {
      const entityTypes = fs.readdirSync(locksDir);
      
      for (const entityType of entityTypes) {
        const entityLocksDir = path.join(locksDir, entityType);
        
        if (fs.statSync(entityLocksDir).isDirectory()) {
          const lockFiles = fs.readdirSync(entityLocksDir);
          
          for (const lockFile of lockFiles) {
            if (lockFile.endsWith('.lock')) {
              const lockPath = path.join(entityLocksDir, lockFile);
              
              try {
                // Read the PID from lock file
                const lockData = fs.readFileSync(lockPath, 'utf8');
                const lockPid = parseInt(lockData.trim());
                
                // Check if process is still running
                if (!isProcessRunning(lockPid)) {
                  // Process is dead, remove stale lock
                  fs.unlinkSync(lockPath);
                  clearedCount++;
                  console.log(`Cleared stale ${entityType} lock: ${lockFile}`);
                } else {
                  console.log(`Keeping active ${entityType} lock: ${lockFile} (PID: ${lockPid})`);
                }
              } catch (error) {
                // If we can't read the lock file, delete it anyway
                fs.unlinkSync(lockPath);
                clearedCount++;
                console.log(`Cleared corrupted ${entityType} lock: ${lockFile}`);
              }
            }
          }
        }
      }
    }
    
    return { success: true, clearedCount };
  } catch (error) {
    console.error('Error clearing locks:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler για ξεκλείδωμα συγκεκριμένου project - REMOVED (duplicate, see backward compatibility section)

// Generic IPC Handlers για locking system
ipcMain.handle('create-entity-lock', async (event, entityType, entityId) => {
  return createEntityLock(entityType, entityId);
});

ipcMain.handle('remove-entity-lock', async (event, entityType, entityId) => {
  return removeEntityLock(entityType, entityId);
});

ipcMain.handle('check-entity-lock', async (event, entityType, entityId) => {
  return isEntityLocked(entityType, entityId);
});

// Backward compatibility για project locks
ipcMain.handle('create-project-lock', async (event, projectId) => {
  return createProjectLock(projectId);
});

ipcMain.handle('check-project-lock', async (event, projectId) => {
  return isProjectLocked(projectId);
});

ipcMain.handle('unlock-project', async (event, projectId) => {
  return removeProjectLock(projectId);
});

// Συνάρτηση για ενημέρωση σχετικών δεδομένων όταν αλλάζει το projectTitle
async function updateRelatedDataAfterProjectTitleChange(projectId, oldProjectTitle, newProjectTitle) {
  try {
    console.log(`Updating related data for project ${projectId}: "${oldProjectTitle}" -> "${newProjectTitle}"`);
    
    // 1. Ενημέρωση όλων των υποέργων του ίδιου έργου
    const projectDir = path.join(dataDir, projectId);
    if (fs.existsSync(projectDir)) {
      const subprojectDirs = fs.readdirSync(projectDir);
      for (const subprojectDir of subprojectDirs) {
        const subprojectPath = path.join(projectDir, subprojectDir);
        if (fs.statSync(subprojectPath).isDirectory()) {
          const dataFile = path.join(subprojectPath, 'data.json');
          if (fs.existsSync(dataFile)) {
            try {
              const subprojectData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
              if (subprojectData.projectTitle === oldProjectTitle) {
                subprojectData.projectTitle = newProjectTitle;
                subprojectData.updatedAt = new Date().toISOString();
                safeWriteJSON(dataFile, subprojectData);
                console.log(`Updated subproject ${subprojectDir} with new project title`);
              }
            } catch (err) {
              console.error(`Error updating subproject ${subprojectDir}:`, err);
            }
          }
        }
      }
    }

    // 2. Ενημέρωση εντάξεων που συνδέονται με το έργο
    const entaxeisDir = path.join(dataDir, 'entaxeis');
    if (fs.existsSync(entaxeisDir)) {
      const entaxeisDirs = fs.readdirSync(entaxeisDir);
      for (const entaxiDir of entaxeisDirs) {
        const entaxiPath = path.join(entaxeisDir, entaxiDir);
        if (fs.statSync(entaxiPath).isDirectory()) {
          const dataFile = path.join(entaxiPath, 'data.json');
          if (fs.existsSync(dataFile)) {
            try {
              const entaxiData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
              if (entaxiData.projectTitle === oldProjectTitle) {
                entaxiData.projectTitle = newProjectTitle;
                entaxiData.updatedAt = new Date().toISOString();
                safeWriteJSON(dataFile, entaxiData);
                console.log(`Updated entaxi ${entaxiDir} with new project title`);
              }
            } catch (err) {
              console.error(`Error updating entaxi ${entaxiDir}:`, err);
            }
          }
        }
      }
    }

    // 3. Ενημέρωση προσκλήσεων που συνδέονται με το έργο
    const proskliseisDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ');
    if (fs.existsSync(proskliseisDir)) {
      const proskliseisDirs = fs.readdirSync(proskliseisDir);
      for (const prosklisiDir of proskliseisDirs) {
        const prosklisiPath = path.join(proskliseisDir, prosklisiDir);
        if (fs.statSync(prosklisiPath).isDirectory()) {
          const dataFile = path.join(prosklisiPath, 'data.json');
          if (fs.existsSync(dataFile)) {
            try {
              const prosklisiData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
              if (prosklisiData.linkedProjects && Array.isArray(prosklisiData.linkedProjects)) {
                let updated = false;
                prosklisiData.linkedProjects = prosklisiData.linkedProjects.map(linkedProject => {
                  if (linkedProject.title === oldProjectTitle) {
                    updated = true;
                    return { ...linkedProject, title: newProjectTitle };
                  }
                  return linkedProject;
                });
                
                if (updated) {
                  prosklisiData.updatedAt = new Date().toISOString();
                  safeWriteJSON(dataFile, prosklisiData);
                  console.log(`Updated prosklisi ${prosklisiDir} with new project title`);
                }
              }
            } catch (err) {
              console.error(`Error updating prosklisi ${prosklisiDir}:`, err);
            }
          }
        }
      }
    }
    
    console.log('Finished updating related data after project title change');
  } catch (error) {
    console.error('Error updating related data after project title change:', error);
    throw error;
  }
}

// IPC Handlers για διαχείριση αρχείων
async function handleSaveProjectData(event, projectData) {
  try {
    let projectId = projectData.projectId;
    let isNewProject = !projectData.projectId;
    
    // Αν δεν υπάρχει projectId, ψάχνουμε για υπάρχον έργο με ίδιο τίτλο
    if (!projectId && projectData.projectTitle) {
      const existingProjects = await loadAllProjects();
      const normalizedIncoming = normalizeProjectTitleForMatching(projectData.projectTitle);
      const matchingProject = existingProjects.find(
        (p) => normalizeProjectTitleForMatching(p.projectTitle) === normalizedIncoming
      );
      
      if (matchingProject) {
        // Βρέθηκε έργο με ίδιο τίτλο - προσθήκη υποέργου
        projectId = matchingProject.projectId;
        isNewProject = false;
        console.log(`Found existing project with same title: ${projectData.projectTitle}, adding as subproject`);
      } else {
        // Δεν βρέθηκε - δημιουργία νέου έργου
        projectId = uuidv4();
        isNewProject = true;
        console.log(`No existing project found with title: ${projectData.projectTitle}, creating new project`);
      }
    } else if (!projectId) {
      projectId = uuidv4();
      isNewProject = true;
    }
    
    const subprojectId = projectData.subprojectId || uuidv4();
    
    // Για υπάρχοντα υποέργα, βρίσκουμε το σωστό projectId από το φάκελο
    // Αν υπάρχει subprojectId, ψάχνουμε σε όλους τους φακέλους για να βρούμε το σωστό projectId
    if (!isNewProject && subprojectId && subprojectId !== uuidv4()) {
      // Ψάχνουμε σε όλους τους φακέλους projects για να βρούμε το subprojectId
      const projectDirs = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
      for (const dir of projectDirs) {
        if (dir === 'entaxeis' || dir === 'ΠΡΟΣΚΛΗΣΕΙΣ' || dir === 'locks' || 
            dir === 'egkriseis_links' || dir === 'subproject_links' || 
            dir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' || dir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ') {
          continue;
        }
        const potentialSubprojectDir = path.join(dataDir, dir, subprojectId);
        if (fs.existsSync(potentialSubprojectDir) && fs.statSync(potentialSubprojectDir).isDirectory()) {
          // Βρέθηκε! Το σωστό projectId είναι το όνομα του φακέλου
          projectId = dir;
          console.log(`Found existing subproject: using projectId from folder name: ${projectId}`);
          break;
        }
      }
    }
    
    // Για υπάρχοντα έργα, ΔΕΝ ελέγχουμε lock γιατί το έχουμε ήδη από το handleEditProject
    // Για νέα έργα, δημιουργούμε lock
    if (isNewProject) {
      const lockResult = createProjectLock(projectId);
      if (!lockResult.success) {
        return { success: false, error: lockResult.error };
      }
    }
    
    const projectDir = path.join(dataDir, projectId);
    const subprojectDir = path.join(projectDir, subprojectId);
    const filesDir = path.join(subprojectDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    const jsonPath = path.join(subprojectDir, 'data.json');

    // Ίδιο έργο (φάκελος), ίδιος ουσιαστικός τίτλος, διαφορετική κεφαλαιοποίηση (π.χ. αντιγραφή από UI κεφαλαία)
    const siblingTitle = readSiblingProjectTitleForHarmonize(projectDir, subprojectId);
    if (
      siblingTitle &&
      projectData.projectTitle &&
      normalizeProjectTitleForMatching(siblingTitle) === normalizeProjectTitleForMatching(projectData.projectTitle) &&
      siblingTitle !== projectData.projectTitle
    ) {
      console.log('Harmonizing projectTitle casing to match sibling subproject in same project folder');
      projectData.projectTitle = siblingTitle;
    }

    // Διαβάζουμε τα υπάρχοντα δεδομένα για να διατηρήσουμε το createdAt
    let existingData = {};
    if (fs.existsSync(jsonPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        // ΒΕΒΑΙΩΝΟΜΑΣΤΕ ότι το projectId στο existingData είναι το σωστό (από το όνομα φακέλου)
        // Αυτό εξασφαλίζει ότι δεν θα αλλάξει το projectId στο audit log
        if (existingData.projectId && existingData.projectId !== projectId) {
          console.log(`Warning: projectId mismatch in JSON (${existingData.projectId}) vs folder (${projectId}). Using folder name.`);
          existingData.projectId = projectId; // Χρησιμοποιούμε το projectId από το όνομα φακέλου
        }
      } catch (error) {
        console.error('Error reading existing data:', error);
      }
    }
    
    // Δημιουργία φακέλων
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    if (!fs.existsSync(subprojectDir)) {
      fs.mkdirSync(subprojectDir, { recursive: true });
    }
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
    
    // Έλεγχος αν άλλαξε το projectTitle για ενημέρωση συσχετισμένων δεδομένων
    const oldProjectTitle = existingData.projectTitle;
    const newProjectTitle = projectData.projectTitle;
    const projectTitleChanged = !isNewProject && oldProjectTitle && oldProjectTitle !== newProjectTitle;
    
    // Το projectId ΠΑΝΤΑ παραμένει το ίδιο - δεν αλλάζει ποτέ όταν επεξεργάζεται ένα υποέργο
    // Αυτό εξασφαλίζει ότι το υποέργο παραμένει στο ίδιο έργο ακόμα και αν αλλάξει ο τίτλος
    // ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ ΠΑΝΤΑ το projectId από το όνομα φακέλου, ΟΧΙ από το projectData
    const finalProjectId = projectId; // Αυτό είναι πάντα το σωστό projectId (από το όνομα φακέλου)
    const finalProjectDir = projectDir;
    const finalSubprojectDir = subprojectDir;
    const finalFilesDir = filesDir;
    const finalJsonPath = jsonPath;
    
    // Αποθήκευση JSON δεδομένων
    // ΣΗΜΑΝΤΙΚΟ: Το projectId στο dataToSave ΠΑΝΤΑ πρέπει να είναι το finalProjectId (από το όνομα φακέλου)
    // ΑΝ το projectData.projectId είναι διαφορετικό, το αγνοούμε και χρησιμοποιούμε το finalProjectId
    
    // Έξυπνη συγχώνευση fileGroups
    let mergedFileGroups = [];
    const existingFileGroups = existingData.fileGroups || [];
    const newFileGroups = projectData.fileGroups || [];
    
    console.log('🔄 Merging fileGroups...');
    console.log('Existing fileGroups:', JSON.stringify(existingFileGroups, null, 2));
    console.log('New fileGroups from form:', JSON.stringify(newFileGroups, null, 2));
    
    if (newFileGroups.length > 0) {
      // Αν έχουμε νέα fileGroups από τη φόρμα, τα συγχωνεύουμε με τα υπάρχοντα
      const existingGroupsMap = new Map(existingFileGroups.map(g => [g.id, g]));
      
      // Προσθέτουμε/ενημερώνουμε τα νέα groups
      newFileGroups.forEach(newGroup => {
        if (existingGroupsMap.has(newGroup.id)) {
          // Ενημέρωση υπάρχουσας ομάδας - συγχώνευση αρχείων
          const existingGroup = existingGroupsMap.get(newGroup.id);
          const mergedFiles = [...existingGroup.files];
        
          // Προσθήκη νέων αρχείων που δεν υπάρχουν ήδη
          newGroup.files.forEach(newFile => {
            const fileExists = mergedFiles.some(f => 
              (typeof f === 'string' ? f : f.name) === (typeof newFile === 'string' ? newFile : newFile.name)
            );
            if (!fileExists) {
              mergedFiles.push(newFile);
            }
          });
          
          existingGroupsMap.set(newGroup.id, {
            ...existingGroup,
            title: newGroup.title, // Ενημέρωση τίτλου αν άλλαξε
            files: mergedFiles
          });
        } else {
          // Νέα ομάδα - την προσθέτουμε
          existingGroupsMap.set(newGroup.id, newGroup);
        }
      });
      
      mergedFileGroups = Array.from(existingGroupsMap.values());
    } else {
      // Αν δεν έχουμε νέα fileGroups, κρατάμε μόνο τα υπάρχοντα
      mergedFileGroups = existingFileGroups;
    }
    
    console.log('✅ Merged fileGroups:', JSON.stringify(mergedFileGroups, null, 2));
    
    const dataToSave = {
      ...projectData,
      projectId: finalProjectId, // ΠΑΝΤΑ το projectId από το όνομα φακέλου
      subprojectId,
      createdAt: existingData.createdAt || new Date().toISOString(), // Διατήρηση του αρχικού createdAt
      updatedAt: new Date().toISOString(), // Πάντα νέο updatedAt
      // Χρήση των συγχωνευμένων fileGroups
      fileGroups: mergedFileGroups,
      egkriseisDialthesisPistosis: (existingData.egkriseisDialthesisPistosis && existingData.egkriseisDialthesisPistosis.length > 0)
        ? existingData.egkriseisDialthesisPistosis
        : (projectData.egkriseisDialthesisPistosis || []),
      // Διατήρηση ανάθεσης επιβλεπόντων (νέο σύστημα) όταν η φόρμα δεν στέλνει το πεδίο
      supervisorEngineerIds: Array.isArray(projectData.supervisorEngineerIds)
        ? filterSupervisorEngineerIds(projectData.supervisorEngineerIds)
        : Array.isArray(existingData.supervisorEngineerIds)
          ? filterSupervisorEngineerIds(existingData.supervisorEngineerIds)
          : [],
      ...require('./khmdhsOpenData').mergeKhmdhsFieldsForSave(projectData, existingData)
    };

    const chargeFreeText = String(dataToSave.supervisorChargeFreePrimary || '').trim();
    const chargeEngIds = Array.isArray(dataToSave.supervisorEngineerIds)
      ? dataToSave.supervisorEngineerIds.filter((x) => String(x || '').trim())
      : [];
    if (chargeFreeText && chargeEngIds.length === 0) {
      dataToSave.supervisorChargeOutsideEngineers = true;
      dataToSave.supervisorChargeFreePrimary = chargeFreeText;
      dataToSave.supervisorEngineerIds = [];
    } else if (chargeEngIds.length > 0) {
      dataToSave.supervisorChargeOutsideEngineers = false;
    }

    stripLegacySupervisorField(dataToSave);
    
    // Αντιγραφή αρχείων από fileGroups στον φάκελο ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ
    if (mergedFileGroups && mergedFileGroups.length > 0) {
      console.log('📁 Copying files from fileGroups to ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ...');
      
      for (const group of mergedFileGroups) {
        if (group.files && group.files.length > 0) {
          // Δημιουργία φακέλου ομάδας (αν χρειάζεται)
          const safeGroupName = (group.title || group.id || 'GROUP')
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 50)
            .trim();
          const groupFolderPath = path.join(finalFilesDir, safeGroupName);
          
          // Αντιγραφή κάθε αρχείου
          for (const file of group.files) {
            try {
              // Παίρνουμε το path από το file object
              const sourcePath = typeof file === 'string' 
                ? file 
                : (file.path || file.filePath);
              
              if (!sourcePath) {
                console.warn('⚠️ File has no path:', file);
                continue;
              }
              
              // Ελέγχουμε αν το αρχείο υπάρχει
              if (!fs.existsSync(sourcePath)) {
                console.warn('⚠️ Source file not found:', sourcePath);
                continue;
              }
              
              // Παίρνουμε το όνομα αρχείου
              const fileName = typeof file === 'string' 
                ? path.basename(file) 
                : (file.name || file.fileName || path.basename(sourcePath));
              
              // Προορισμός: είτε στον main folder είτε στον group folder
              const destPath = path.join(finalFilesDir, fileName);
              
              // Αντιγραφή αρχείου
              console.log(`📋 Copying file from "${sourcePath}" to "${destPath}"`);
              fs.copyFileSync(sourcePath, destPath);
              console.log(`✅ File copied successfully: ${fileName}`);
              
            } catch (error) {
              console.error(`❌ Error copying file from group "${group.title}":`, error);
            }
          }
        }
      }
    }
    
    // Συγχρονισμός remainingAmount/remainingAmountYear με remainingAmountsByYear[]
    if (dataToSave.remainingAmount || dataToSave.remainingAmountYear) {
      const year = dataToSave.remainingAmountYear || new Date().getFullYear().toString();
      const amount = dataToSave.remainingAmount || '';
      
      // Δημιουργία ή ενημέρωση του remainingAmountsByYear array
      if (!dataToSave.remainingAmountsByYear) {
        dataToSave.remainingAmountsByYear = [];
      }
      
      // Αναζήτηση υπάρχουσας εγγραφής για το συγκεκριμένο έτος
      const yearEntryIndex = dataToSave.remainingAmountsByYear.findIndex(entry => entry.year === year);
      
      if (yearEntryIndex >= 0) {
        // Ενημέρωση υπάρχουσας εγγραφής
        dataToSave.remainingAmountsByYear[yearEntryIndex].amount = amount;
      } else {
        // Προσθήκη νέας εγγραφής
        dataToSave.remainingAmountsByYear.push({ year, amount });
      }
      
      // Ταξινόμηση κατά έτος (φθίνουσα - νεότερα πρώτα)
      dataToSave.remainingAmountsByYear.sort((a, b) => parseInt(b.year) - parseInt(a.year));
    }
    
    console.log('Saving project data:', dataToSave.projectTitle, dataToSave.subprojectTitle);
    safeWriteJSON(finalJsonPath, dataToSave);
    console.log('Project data saved successfully to:', finalJsonPath);

    // Αν άλλαξε το projectTitle, ενημέρωσε όλα τα σχετικά δεδομένα
    if (projectTitleChanged) {
      console.log(`Project title changed from "${oldProjectTitle}" to "${newProjectTitle}". Updating related data...`);
      await updateRelatedDataAfterProjectTitleChange(projectId, oldProjectTitle, newProjectTitle);
    }
    
    // Για νέα έργα, ξεκλειδώνουμε μετά την αποθήκευση
    // Για υπάρχοντα έργα, το ξεκλείδωμα γίνεται στο Dashboard
    if (isNewProject) {
      removeProjectLock(projectId);
    }
    
    logAuditAction({
      type: isNewProject ? 'create' : 'update',
      entityType: 'subproject',
      entityId: subprojectId,
      entityTitle: `${dataToSave.projectTitle} - ${dataToSave.subprojectTitle}`,
      details: isNewProject ? 'Δημιουργία νέου υποέργου' : 'Ενημέρωση υποέργου',
      oldValue: isNewProject ? null : existingData,
      newValue: dataToSave
    });
    
    return { success: true, projectId: finalProjectId, subprojectId };
  } catch (error) {
    console.error('Error saving project data:', error);
    return { success: false, error: error.message };
  }
}

ipcMain.handle('save-project-data', handleSaveProjectData);

const subprojectExcelImport = require('./subprojectExcelImport');

ipcMain.handle('export-subprojects-import-template', async () => {
  try {
    const ExcelJS = require('exceljs');
    const wb = await subprojectExcelImport.buildTemplateWorkbook(ExcelJS);
    const buffer = await wb.xlsx.writeBuffer();
    const saveResult = await dialog.showSaveDialog({
      title: 'Αποθήκευση προτύπου εισαγωγής υποέργων (Excel)',
      defaultPath: `ErgoHub_Φόρμα_εισαγωγής_δεδομένων.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { success: true, canceled: true };
    }
    fs.writeFileSync(saveResult.filePath, Buffer.from(buffer));
    return { success: true, path: saveResult.filePath };
  } catch (error) {
    console.error('export-subprojects-import-template:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('preview-subprojects-excel-import', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { success: false, error: 'Μη έγκυρη διαδρομή αρχείου' };
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx') {
      return { success: false, error: 'Επιτρέπεται μόνο αρχείο .xlsx' };
    }
    const buf = fs.readFileSync(filePath);
    const parsed = await subprojectExcelImport.parseImportWorkbookBuffer(buf);
    const blockingErrors = [...parsed.parseErrors];
    const headerMissing = blockingErrors.some(
      (e) => e.excelRow === 1 && /λείπουν|αναγνωρίζονται/i.test(String(e.message))
    );
    const sheetMissing = blockingErrors.some((e) =>
      String(e.message).includes(`Δεν βρέθηκε το φύλλο`)
    );

    let ok = [];
    let validationErrors = [];
    if (!headerMissing && !sheetMissing) {
      const v = subprojectExcelImport.validateAllRows(parsed.rows);
      ok = v.ok;
      validationErrors = v.errors;
    }

    const existing = await loadAllProjects();
    const warnings = subprojectExcelImport.duplicateWarnings(ok, existing);
    const previewRows = ok.slice(0, 50).map(({ excelRow, projectData }) => ({
      excelRow,
      projectTitle: projectData.projectTitle,
      subprojectTitle: projectData.subprojectTitle,
      projectStatus: projectData.projectStatus,
      fundingSource: projectData.fundingSource
    }));

    return {
      success: true,
      versionOk: parsed.versionOk,
      metaVersion: parsed.metaVersion,
      rowCount: parsed.rows.length,
      validCount: ok.length,
      blockingErrors,
      validationErrors,
      warnings,
      previewRows
    };
  } catch (error) {
    console.error('preview-subprojects-excel-import:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('commit-subprojects-excel-import', async (event, filePath) => {
  const fakeEvent = { sender: { getTitle: () => 'EXCEL_IMPORT' } };
  try {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { success: false, error: 'Μη έγκυρη διαδρομή αρχείου' };
    }
    if (path.extname(filePath).toLowerCase() !== '.xlsx') {
      return { success: false, error: 'Επιτρέπεται μόνο αρχείο .xlsx' };
    }
    const buf = fs.readFileSync(filePath);
    const parsed = await subprojectExcelImport.parseImportWorkbookBuffer(buf);
    if (parsed.parseErrors.length > 0) {
      return {
        success: false,
        error: 'Το αρχείο δεν πέρασε τους ελέγχους μορφής',
        blockingErrors: parsed.parseErrors,
        saved: 0
      };
    }
    const { ok, errors } = subprojectExcelImport.validateAllRows(parsed.rows);
    if (errors.length > 0) {
      return {
        success: false,
        error: 'Η εισαγωγή ακυρώθηκε λόγω σφαλμάτων επικύρωσης',
        blockingErrors: [],
        validationErrors: errors,
        saved: 0
      };
    }
    let saved = 0;
    const results = [];
    for (const { excelRow, projectData } of ok) {
      const res = await handleSaveProjectData(fakeEvent, {
        ...projectData,
        projectId: null,
        subprojectId: null
      });
      if (!res.success) {
        return {
          success: false,
          error: res.error || 'Αποτυχία αποθήκευσης',
          saved,
          failedAtRow: excelRow,
          results
        };
      }
      saved += 1;
      results.push({ excelRow, projectId: res.projectId, subprojectId: res.subprojectId });
    }
    return { success: true, saved, results };
  } catch (error) {
    console.error('commit-subprojects-excel-import:', error);
    return { success: false, error: error.message, saved: 0 };
  }
});

ipcMain.handle('select-subprojects-import-xlsx', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Επιλογή αρχείου εισαγωγής υποέργων (.xlsx)',
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return { success: false, canceled: true };
    }
    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('select-subprojects-import-xlsx:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Κανονικοποίηση τίτλου έργου για σύγκριση (ίδια λογική παντού: φόρμα, find-by-title, αποθήκευση).
 * Συμπτύσσει whitespace ώστε «ίδιος» τίτλος να μην δημιουργεί διπλό φάκελο έργου.
 */
function normalizeProjectTitleForMatching(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2000-\u200B]/g, ' ')
    .replace(/\u2028/g, ' ')
    .replace(/\u2029/g, ' ')
    .trim()
    .toLowerCase();
}

/** Τίτλος έργου από άλλο υποέργο στον ίδιο φάκελο (ίδιο projectId) για εναρμόνιση κεφαλαιοποίησης. */
function readSiblingProjectTitleForHarmonize(projectDirPath, currentSubprojectId) {
  try {
    if (!fs.existsSync(projectDirPath)) return null;
    const entries = fs.readdirSync(projectDirPath);
    for (const sid of entries) {
      if (!sid || sid === currentSubprojectId) continue;
      const subPath = path.join(projectDirPath, sid);
      let st;
      try {
        st = fs.statSync(subPath);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const jp = path.join(subPath, 'data.json');
      if (!fs.existsSync(jp)) continue;
      const data = JSON.parse(fs.readFileSync(jp, 'utf8'));
      const t = data.projectTitle;
      if (t && String(t).trim()) return String(t).trim();
    }
  } catch (e) {
    console.warn('readSiblingProjectTitleForHarmonize:', e.message);
  }
  return null;
}

// Internal function to load all projects
const loadAllProjects = async () => {
  try {
    const projects = [];
    if (!fs.existsSync(dataDir)) {
      console.log('loadAllProjects: dataDir does not exist:', dataDir);
      return projects;
    }

    const projectDirs = fs.readdirSync(dataDir);
    const skipRoot = new Set(['entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'locks', 'egkriseis_links', 'subproject_links', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ']);

    let scanned = 0;
    let skipped = 0;
    let errored = 0;

    for (const projectDir of projectDirs) {
      if (skipRoot.has(projectDir)) { skipped++; continue; }
      const projectPath = path.join(dataDir, projectDir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) { skipped++; continue; }
        scanned++;

        // Check if project is locked
        const lockStatus = isProjectLocked(projectDir);

        const subprojectDirs = fs.readdirSync(projectPath);
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectPath, subprojectDir);
          try {
            if (!fs.statSync(subprojectPath).isDirectory()) { continue; }
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (!fs.existsSync(jsonPath)) { continue; }

            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            // Add lock information to project data
            data.isLocked = lockStatus.locked;
            if (lockStatus.locked) {
              data.lockedBy = lockStatus.pid;
              data.lockMessage = 'Ανοιχτό από άλλον χρήστη';
            }

            // Ensure projectId is set
            if (!data.projectId) {
              data.projectId = projectDir;
            }
            
            // CRITICAL: Ensure subprojectId matches the folder name (subprojectDir)
            // This is essential for opening files correctly, especially for projects with multiple contracts
            if (data.subprojectId !== subprojectDir) {
              console.log(`⚠️ SubprojectId mismatch detected: data.json has "${data.subprojectId}" but folder is "${subprojectDir}". Using folder name.`);
              data.subprojectId = subprojectDir;
            }
            
            // Συγχρονισμός remainingAmount/remainingAmountYear με remainingAmountsByYear[]
            // Αν υπάρχει remainingAmountsByYear, ενημερώνουμε τα παλιά πεδία για backward compatibility
            if (data.remainingAmountsByYear && Array.isArray(data.remainingAmountsByYear) && data.remainingAmountsByYear.length > 0) {
              // Βρίσκουμε το πιο πρόσφατο έτος με ποσό > 0
              const sortedEntries = [...data.remainingAmountsByYear].sort((a, b) => parseInt(b.year) - parseInt(a.year));
              const latestEntry = sortedEntries.find(entry => {
                const amount = (entry.amount || '').toString().trim();
                return amount && amount !== '0' && amount !== '0,00';
              });
              
              if (latestEntry) {
                data.remainingAmount = latestEntry.amount;
                data.remainingAmountYear = latestEntry.year;
              } else {
                // Αν δεν υπάρχει έτος με ποσό > 0, χρησιμοποιούμε το πιο πρόσφατο
                data.remainingAmount = sortedEntries[0].amount || '';
                data.remainingAmountYear = sortedEntries[0].year || '';
              }
            }

            // Skip projects with undefined or empty titles
            if (!data.projectTitle || !data.subprojectTitle ||
                data.projectTitle === 'undefined' || data.subprojectTitle === 'undefined' ||
                data.projectTitle.trim() === '' || data.subprojectTitle.trim() === '') {
              // Keep this log to diagnose problematic entries but continue
              console.log('Skipping project with undefined/empty title:', {
                projectId: data.projectId,
                subprojectId: data.subprojectId,
                projectTitle: data.projectTitle,
                subprojectTitle: data.subprojectTitle
              });
              continue;
            }

            projects.push(data);
          } catch (errSub) {
            errored++;
            console.error('loadAllProjects: error reading subproject', { projectDir, subprojectDir, error: errSub.message });
            // continue to next subproject
          }
        }
      } catch (errProj) {
        errored++;
        console.error('loadAllProjects: error reading project dir', { projectDir, error: errProj.message });
        // continue to next project
      }
    }

    console.log('loadAllProjects: summary', { scannedProjects: scanned, skippedRoot: skipped, errors: errored, returned: projects.length });
    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
};

// IPC Handler για λήψη όλων των έργων
ipcMain.handle('load-all-projects', async () => {
  return await loadAllProjects();
});

// IPC Handler: επιλογές φίλτρου «Χρεωμένο σε» (νέο σύστημα χρέωσης)
ipcMain.handle('get-all-supervisors', async () => {
  try {
    const projects = await loadAllProjects();
    const catalog = getRegisteredEngineersList();
    const { collectChargeFilterOptions } = require('./chargeFilterUtils');
    const options = collectChargeFilterOptions(projects, catalog);
    return {
      success: true,
      supervisors: options.map((o) => o.label),
      chargeOptions: options
    };
  } catch (error) {
    console.error('Error getting charge filter options:', error);
    return { success: false, supervisors: [], chargeOptions: [], error: error.message };
  }
});

/** Μηχανικοί αποκλειστικά από λογαριασμούς (ρόλος ENGINEER, ενεργοί — ονοματεπώνυμο από τη διαχείριση χρηστών). */
function engineersFromUserAccounts() {
  const users = loadUsers();
  return users
    .filter((u) => u && u.role === 'ENGINEER' && u.active !== false)
    .map((u) => {
      const username = String(u.username || '').trim();
      const fullName = String(u.fullName || username || '').trim() || username;
      return {
        id: `user:${username.toLowerCase()}`,
        fullName,
        source: 'account',
        username
      };
    });
}

function getRegisteredEngineersList() {
  return engineersFromUserAccounts().sort((a, b) =>
    String(a.fullName || '').localeCompare(String(b.fullName || ''), 'el', { sensitivity: 'base' })
  );
}

function getAllowedSupervisorEngineerIdSet() {
  const ids = new Set();
  getRegisteredEngineersList().forEach((e) => {
    if (e && e.id) ids.add(e.id);
  });
  return ids;
}

const { engineerChargeFilterKey } = require('./chargeFilterUtils');

function filterSupervisorEngineerIds(ids) {
  const allowed = getAllowedSupervisorEngineerIdSet();
  const arr = Array.isArray(ids)
    ? [...new Set(ids.map((x) => engineerChargeFilterKey(x)).filter(Boolean))]
    : [];
  return arr.filter((id) => allowed.has(id));
}

ipcMain.handle('get-registered-engineers', async () => {
  try {
    const engineers = getRegisteredEngineersList();
    return { success: true, engineers };
  } catch (error) {
    console.error('get-registered-engineers:', error);
    return { success: false, engineers: [], error: error.message };
  }
});

// ── Χώρος Εργασίας ──
let taskDueDateJob = null;

function initTaskAssignmentScheduler() {
  if (taskDueDateJob) {
    taskDueDateJob.cancel();
    taskDueDateJob = null;
  }
  try {
    const svc = getTaskAssignmentService();
    if (svc) svc.runDueDateChecks();
    taskDueDateJob = schedule.scheduleJob('0 8 * * *', () => {
      const s = getTaskAssignmentService();
      if (s) s.runDueDateChecks();
    });
    console.log('Task assignment due-date scheduler active (daily 08:00 + startup)');
  } catch (e) {
    console.error('Task assignment scheduler error:', e.message);
  }
}

function resolveTaskActingUser(actingUsername) {
  if (!dashboardSessionActive || !loggedInUsername) {
    return { ok: false, error: 'Δεν είστε συνδεδεμένοι στο σύστημα' };
  }
  const claimed = String(actingUsername || '').trim();
  if (!claimed || claimed.toLowerCase() !== loggedInUsername.toLowerCase()) {
    return { ok: false, error: 'Μη εξουσιοδοτημένη ενέργεια' };
  }
  return { ok: true, username: loggedInUsername };
}

ipcMain.handle('get-task-assignment-access', async (_event, { actingUsername }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμο το dataDir' };
    const info = svc.userHasTaskAccess(auth.username);
    return { success: true, ...info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-task-assignment-permissions', async (_event, { actingUsername }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error, users: [] };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)', users: [] };
    return svc.getAssignableTargets(auth.username);
  } catch (error) {
    return { success: false, error: error.message, users: [] };
  }
});

ipcMain.handle('load-task-assignments', async (_event, { actingUsername, view, listScope }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error, tasks: [] };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)', tasks: [] };
    return svc.loadAssignments({
      actingUsername: auth.username,
      view: view || 'asAssignee',
      listScope: listScope === 'workArchive' ? 'workArchive' : 'default'
    });
  } catch (error) {
    return { success: false, error: error.message, tasks: [] };
  }
});

ipcMain.handle('leave-task-work-archive', async (_event, { actingUsername, taskId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.leaveWorkArchive({ actingUsername: auth.username, taskId });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('leave-task-assignment-workspace', async (_event, { actingUsername, taskId, note }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.leaveWorkspace({ actingUsername: auth.username, taskId, note: note || '' });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-task-assignment', async (_event, { actingUsername, taskId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.getTask({ actingUsername: auth.username, taskId });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-task-assignment', async (_event, { actingUsername, payload, newFiles }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.createTask({ actingUsername: auth.username, payload, newFiles: newFiles || [] });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-task-assignment', async (_event, { actingUsername, taskId, payload, newFiles }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.updateTask({ actingUsername: auth.username, taskId, payload, newFiles: newFiles || [] });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-task-assignment', async (_event, { actingUsername, taskId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.deleteTask({ actingUsername: auth.username, taskId });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-task-assignment-status', async (_event, { actingUsername, taskId, status, reason, withdrawFromAssignees }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.updateStatus({
      actingUsername: auth.username,
      taskId,
      status,
      reason,
      withdrawFromAssignees
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-task-assignment-comment', async (_event, { actingUsername, taskId, text }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.addComment({ actingUsername: auth.username, taskId, text });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-task-assignment-files', async (_event, { actingUsername, taskId, newFiles }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.addFiles({ actingUsername: auth.username, taskId, newFiles: newFiles || [] });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-task-notifications', async (_event, { actingUsername, unreadOnly }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error, notifications: [] };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)', notifications: [] };
    return svc.loadNotifications({ actingUsername: auth.username, unreadOnly: !!unreadOnly });
  } catch (error) {
    return { success: false, error: error.message, notifications: [] };
  }
});

ipcMain.handle('mark-task-notifications-read', async (_event, { actingUsername, notificationIds }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.markNotificationsRead({ actingUsername: auth.username, notificationIds });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mark-task-notifications-read-for-task', async (_event, { actingUsername, taskId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.markNotificationsReadForTask({ actingUsername: auth.username, taskId });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-task-assignment-file', async (_event, { actingUsername, taskId, filePath }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    const check = svc.resolveTaskFilePath({ actingUsername: auth.username, taskId, filePath });
    if (!check.success) return check;
    const openResult = await shell.openPath(check.filePath);
    if (openResult) return { success: false, error: `Αδυναμία ανοίγματος αρχείου: ${openResult}` };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/* ── Real-Time Task Watcher ── */
let activeTaskWatcher = null;
let activeTaskWatcherId = null;

ipcMain.handle('watch-task-file', (_event, { taskId }) => {
  if (activeTaskWatcher) { activeTaskWatcher.close(); activeTaskWatcher = null; }
  activeTaskWatcherId = null;
  const svc = getTaskAssignmentService();
  if (!svc || !taskId) return;
  const filePath = svc.getTaskDataPath(taskId);
  if (!fs.existsSync(filePath)) return;
  activeTaskWatcherId = taskId;
  let debounceTimer = null;
  try {
    activeTaskWatcher = fs.watch(filePath, () => {
      if (svc.getLastOwnWriteTs && (Date.now() - svc.getLastOwnWriteTs()) < 1500) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('task-data-changed', { taskId: activeTaskWatcherId });
        }
      }, 500);
    });
    activeTaskWatcher.on('error', () => {
      if (activeTaskWatcher) { activeTaskWatcher.close(); activeTaskWatcher = null; }
    });
  } catch (err) {
    console.warn('[TaskWatcher] fs.watch failed (fallback to polling):', err.message);
  }
});

ipcMain.handle('unwatch-task-file', () => {
  if (activeTaskWatcher) { activeTaskWatcher.close(); activeTaskWatcher = null; }
  activeTaskWatcherId = null;
});

ipcMain.handle('khmdhs-fetch-contract-by-adam', async (_event, { adam }) => {
  try {
    const kh = require('./khmdhsOpenData');
    const c = await kh.fetchKhmdhsContractByAdam(adam);
    if (!c.success) return c;
    const snapshot = kh.pickKhmdhsSnapshot(c.snapshot);
    if (!snapshot) {
      return {
        success: false,
        error: 'Βρέθηκε η σύμβαση αλλά δεν επιστράφηκαν στοιχεία ανάδοχου ή αναθέτουσας από το ΚΗΜΔΗΣ.'
      };
    }
    return {
      success: true,
      snapshot,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('khmdhs-fetch-contract-by-adam:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('update-subproject-supervisor-engineers', async (_event, { projectId, subprojectId, supervisorEngineerIds }) => {
  try {
    const pid = String(projectId || '').trim();
    const sid = String(subprojectId || '').trim();
    if (!pid || !sid) {
      return { success: false, error: 'Λείπουν projectId ή subprojectId' };
    }
    const ids = Array.isArray(supervisorEngineerIds)
      ? [...new Set(supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean))]
      : [];
    const filtered = filterSupervisorEngineerIds(ids);
    const jsonPath = path.join(dataDir, pid, sid, 'data.json');
    if (!fs.existsSync(jsonPath)) {
      return { success: false, error: 'Δεν βρέθηκε το υποέργο' };
    }
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const oldIds = data.supervisorEngineerIds || [];
    data.supervisorEngineerIds = filtered;
    data.updatedAt = new Date().toISOString();
    stripLegacySupervisorField(data);
    safeWriteJSON(jsonPath, data);
    logAuditAction({
      type: 'update',
      entityType: 'subproject',
      entityId: sid,
      entityTitle: `${data.projectTitle || pid} - ${data.subprojectTitle || sid}`,
      details: 'Ενημέρωση επιβλεπόντων μηχανικών υποέργου',
      oldValue: { supervisorEngineerIds: oldIds },
      newValue: { supervisorEngineerIds: filtered }
    });
    return { success: true, supervisorEngineerIds: filtered };
  } catch (error) {
    console.error('update-subproject-supervisor-engineers:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler για λήψη έργων (για τη φόρμα προσκλήσεων)
ipcMain.handle('get-projects', async () => {
  try {
    const projects = [];
    const projectMap = new Map(); // Χρησιμοποιούμε Map για να αποφύγουμε διπλότυπα
    
    if (!fs.existsSync(dataDir)) {
      return { success: true, projects: [] };
    }
    
    const projectDirs = fs.readdirSync(dataDir);
    
    for (const projectDir of projectDirs) {
      // Skip the entaxeis and proskliseis directories
      if (projectDir === 'entaxeis' || projectDir === 'ΠΡΟΣΚΛΗΣΕΙΣ') {
        continue;
      }
      
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        // Βρίσκουμε το πρώτο υποέργο για να πάρουμε τα στοιχεία του έργου
        const subprojectDirs = fs.readdirSync(projectPath);
        
        if (subprojectDirs.length > 0) {
          const firstSubprojectDir = subprojectDirs[0];
          const subprojectPath = path.join(projectPath, firstSubprojectDir);
          
          if (fs.statSync(subprojectPath).isDirectory()) {
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(jsonPath)) {
              const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              
              // Extract unique project information
              const projectInfo = {
                id: data.projectId,
                title: data.projectTitle,
                projectId: data.projectId
              };
              
              // Χρησιμοποιούμε Map για να αποφύγουμε διπλότυπα
              if (!projectMap.has(projectInfo.id)) {
                projectMap.set(projectInfo.id, projectInfo);
              }
            }
          }
        }
      }
    }
    
    // Μετατρέπουμε το Map σε array
    const uniqueProjects = Array.from(projectMap.values());
    
    console.log('Loaded projects for linking:', uniqueProjects.length);
    return { success: true, projects: uniqueProjects };
  } catch (error) {
    console.error('Error loading projects:', error);
    return { success: false, error: error.message, projects: [] };
  }
});

// Handle writing debug logs
ipcMain.handle('write-debug-log', async (event, debugInfo) => {
  try {
    const debugFile = path.join(process.cwd(), 'debug_log.txt');
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] ${debugInfo}\n`;
    
    fs.appendFileSync(debugFile, logEntry, 'utf8');
    console.log('Debug info written to file:', debugFile);
  } catch (error) {
    console.error('Error writing debug log:', error);
  }
});

ipcMain.handle('delete-subproject', async (event, projectId, subprojectId) => {
  try {
    console.log(`Deleting subproject: ${projectId}/${subprojectId}`);
    
    const subprojectDir = path.join(dataDir, projectId, subprojectId);
    const jsonPath = path.join(subprojectDir, 'data.json');
    
    // Load subproject data before deletion for audit log
    let deletedData = null;
    if (fs.existsSync(jsonPath)) {
      try {
        deletedData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (e) {
        console.error('Error reading subproject data for audit:', e);
      }
    }
    
    // Διαγραφή του φακέλου του υποέργου
    if (fs.existsSync(subprojectDir)) {
      console.log('Deleting subproject directory:', subprojectDir);
      fs.rmSync(subprojectDir, { recursive: true, force: true });
      console.log('Subproject directory deleted successfully');
    } else {
      console.log('Subproject directory not found:', subprojectDir);
    }
    
    // Διαγραφή συσχετισμένων εγκρίσεων
    try {
      const linksDir = path.join(dataDir, 'egkriseis_links');
      if (fs.existsSync(linksDir)) {
        const linkFiles = fs.readdirSync(linksDir);
        for (const file of linkFiles) {
          if (file.endsWith('.json')) {
            const linkPath = path.join(linksDir, file);
            try {
              const linkData = JSON.parse(fs.readFileSync(linkPath, 'utf8'));
              if (linkData.subprojectId === subprojectId) {
                console.log('Deleting linked egkrisi file:', file);
                fs.unlinkSync(linkPath);
              }
            } catch (err) {
              console.error(`Error processing link file ${file}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning up egkrisi links:', err);
    }
    
    // Διαγραφή συσχετισμένων εντάξεων
    try {
      const entaxisDir = path.join(dataDir, 'entaxis_data');
      if (fs.existsSync(entaxisDir)) {
        const entaxisFiles = fs.readdirSync(entaxisDir);
        for (const file of entaxisFiles) {
          if (file.endsWith('.json')) {
            const entaxisPath = path.join(entaxisDir, file);
            try {
              const entaxisData = JSON.parse(fs.readFileSync(entaxisPath, 'utf8'));
              if (entaxisData.subprojectId === subprojectId) {
                console.log('Deleting linked entaxis file:', file);
                fs.unlinkSync(entaxisPath);
              }
            } catch (err) {
              console.error(`Error processing entaxis file ${file}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning up entaxis data:', err);
    }
    
    // Διαγραφή συσχετισμένων προσκλήσεων
    try {
      const proskliseisDir = path.join(dataDir, 'proskliseis_data');
      if (fs.existsSync(proskliseisDir)) {
        const proskliseisFiles = fs.readdirSync(proskliseisDir);
        for (const file of proskliseisFiles) {
          if (file.endsWith('.json')) {
            const prosklisiPath = path.join(proskliseisDir, file);
            try {
              const prosklisiData = JSON.parse(fs.readFileSync(prosklisiPath, 'utf8'));
              if (prosklisiData.subprojectId === subprojectId) {
                console.log('Deleting linked prosklisi file:', file);
                fs.unlinkSync(prosklisiPath);
              }
            } catch (err) {
              console.error(`Error processing prosklisi file ${file}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning up proskliseis data:', err);
    }
    
    // Έλεγχος αν το έργο είναι άδειο
    const projectDir = path.join(dataDir, projectId);
    if (fs.existsSync(projectDir)) {
      const remainingSubprojects = fs.readdirSync(projectDir);
      if (remainingSubprojects.length === 0) {
        console.log('Project directory is empty, deleting it:', projectDir);
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    }
    
    console.log('Subproject deletion completed successfully');
    
    if (deletedData) {
      logAuditAction({
        type: 'delete',
        entityType: 'subproject',
        entityId: subprojectId,
        entityTitle: `${deletedData.projectTitle || 'N/A'} - ${deletedData.subprojectTitle || 'N/A'}`,
        details: 'Διαγραφή υποέργου',
        oldValue: deletedData,
        newValue: null
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting subproject:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Όλα τα Αρχεία', extensions: ['pdf', 'doc', 'docx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Word Documents', extensions: ['doc', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  return result;
});

ipcMain.handle('save-files', async (event, files, projectId, subprojectId) => {
  try {
    const filesDir = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
    
    const savedFiles = [];
    
    for (const file of files) {
      const fileName = path.basename(file.path);
      const destPath = path.join(filesDir, fileName);
      fs.copyFileSync(file.path, destPath);
      savedFiles.push(fileName);
    }
    
    logAuditAction({
      type: 'create',
      entityType: 'file',
      entityId: subprojectId,
      entityTitle: savedFiles.join(', '),
      details: `Προσθήκη ${savedFiles.length} αρχείου/ων στο υποέργο`
    });
    return { success: true, files: savedFiles };
  } catch (error) {
    console.error('Error saving files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-subproject-files', async (event, projectId, subprojectId) => {
  try {
    console.log('📁 get-subproject-files called with:', { projectId, subprojectId });
    
    // Ελέγχος αν υπάρχει το projectId directory
    const projectPath = path.join(dataDir, projectId);
    if (!fs.existsSync(projectPath)) {
      console.error('❌ Project directory not found:', projectPath);
      return { files: [], fileGroups: [] };
    }
    
    // Ελέγχος αν υπάρχει το subprojectId directory
    const subprojectPath = path.join(projectPath, subprojectId);
    if (!fs.existsSync(subprojectPath)) {
      console.error('❌ Subproject directory not found:', subprojectPath);
      // Προσπάθεια να βρούμε το σωστό subprojectId από το data.json
      const subprojectDirs = fs.readdirSync(projectPath).filter(f => {
        const fullPath = path.join(projectPath, f);
        return fs.statSync(fullPath).isDirectory();
      });
      
      console.log('🔍 Available subproject directories:', subprojectDirs);
      
      // Ψάχνουμε το subprojectId από τα data.json
      for (const dir of subprojectDirs) {
        const dataPath = path.join(projectPath, dir, 'data.json');
        if (fs.existsSync(dataPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            if (data.subprojectId === subprojectId) {
              console.log('✅ Found matching subprojectId in directory:', dir);
              subprojectId = dir; // Χρησιμοποιούμε το όνομα του φακέλου
              break;
            }
          } catch (err) {
            console.error('Error reading data.json:', err);
          }
        }
      }
    }
    
    const filesDir = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    console.log('📂 Looking for files in:', filesDir);
    
    if (!fs.existsSync(filesDir)) {
      console.log('⚠️ Files directory not found:', filesDir);
      return { files: [], fileGroups: [] };
    }
    
           // Φόρτωση δεδομένων υποέργου για τις ομάδες αρχείων
           const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
           let fileGroups = [];
           let pdfFiles = [];
           
           if (fs.existsSync(dataPath)) {
             try {
               const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
               fileGroups = data.fileGroups || [];
               
               // Συλλογή αρχείων από subprojectFiles
               if (data.subprojectFiles && data.subprojectFiles.length > 0) {
                 pdfFiles = data.subprojectFiles.filter(file => file.toLowerCase().endsWith('.pdf'));
               }
               
               // ΔΕΝ προσθέτουμε αρχεία από fileGroups στη γενική λίστα
               // Τα αρχεία σε ομάδες εμφανίζονται μόνο στις ομάδες τους
               
               // Αν δεν βρέθηκαν αρχεία από JSON, διαβάζουμε από τον φάκελο
               if (pdfFiles.length === 0) {
                 const allFiles = fs.readdirSync(filesDir);
                 const allPdfFiles = allFiles.filter(file => file.toLowerCase().endsWith('.pdf'));
                 
                 // Αφαιρούμε αρχεία που είναι ήδη σε ομάδες
                 const filesInGroups = [];
                 fileGroups.forEach(group => {
                   if (group.files && group.files.length > 0) {
                     group.files.forEach(file => {
                       const fileName = typeof file === 'string' ? file : file.name;
                       if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
                         filesInGroups.push(fileName);
                       }
                     });
                   }
                 });
                 
                 // Επιστρέφουμε μόνο αρχεία που ΔΕΝ είναι σε ομάδες
                 pdfFiles = allPdfFiles.filter(file => !filesInGroups.includes(file));
                 console.log('📁 All PDF files found:', allPdfFiles.length);
                 console.log('📋 Files in groups:', filesInGroups.length);
                 console.log('📄 Ungrouped files to display:', pdfFiles.length);
               }
             } catch (error) {
               console.error('Error reading project data for file groups:', error);
               // Fallback: διαβάζουμε από τον φάκελο (όλα τα αρχεία αφού δεν έχουμε fileGroups info)
               const files = fs.readdirSync(filesDir);
               pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
               fileGroups = []; // Κενό αφού δεν μπορέσαμε να διαβάσουμε τα δεδομένα
             }
           } else {
             // Fallback: διαβάζουμε από τον φάκελο
             const files = fs.readdirSync(filesDir);
             pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
           }
    
    return { 
      files: pdfFiles, 
      fileGroups: fileGroups 
    };
  } catch (error) {
    console.error('Error getting files:', error);
    return { files: [], fileGroups: [] };
  }
});

ipcMain.handle('delete-file', async (event, projectId, subprojectId, fileName) => {
  try {
    const filePath = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName);
    
    // Διαγραφή φυσικού αρχείου
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Ενημέρωση JSON αρχείου
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    if (fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
       // Αφαίρεση αρχείου από subprojectFiles
       if (data.subprojectFiles && Array.isArray(data.subprojectFiles)) {
         data.subprojectFiles = data.subprojectFiles.filter(file => file !== fileName);
       }
       
       // Αφαίρεση αρχείου από files (για συμβατότητα)
       if (data.files && Array.isArray(data.files)) {
         data.files = data.files.filter(file => file !== fileName);
       }
       
       // Αφαίρεση αρχείου από fileGroups
       if (data.fileGroups && Array.isArray(data.fileGroups)) {
         data.fileGroups = data.fileGroups.map(group => ({
           ...group,
           files: group.files.filter(file => file.name !== fileName)
         })).filter(group => group.files.length > 0); // Αφαίρεση κενών ομάδων
       }
        
        // Αποθήκευση ενημερωμένου JSON
        safeWriteJSON(dataPath, data);
        console.log(`File ${fileName} removed from JSON data`);
      } catch (jsonError) {
        console.error('Error updating JSON after file deletion:', jsonError);
      }
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: subprojectId,
      entityTitle: fileName,
      details: 'Διαγραφή αρχείου υποέργου'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-file-path', async (event, projectId, subprojectId, fileName) => {
  try {
    console.log('🔍 get-file-path called with:', { projectId, subprojectId, fileName });
    
    // First, try the main files directory
    const mainFilesDir = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    
    if (!fs.existsSync(mainFilesDir)) {
      console.error('❌ Main files directory not found:', mainFilesDir);
      return path.join(mainFilesDir, fileName); // Return path anyway
    }
    
    // Try exact match first
    let filePath = path.join(mainFilesDir, fileName);
    if (fs.existsSync(filePath)) {
      console.log('✅ File found in main directory (exact match):', filePath);
  return filePath;
    }
    
    // If not found, search all files in the directory (including subdirectories)
    console.log('🔍 Searching all files in directory...');
    const allFiles = [];
    
    const searchFiles = (dir, basePath = '') => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const relativePath = basePath ? path.join(basePath, item) : item;
          
          try {
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              // Recursively search subdirectories
              searchFiles(itemPath, relativePath);
            } else if (stat.isFile()) {
              allFiles.push({ name: item, path: itemPath, relativePath });
            }
          } catch (err) {
            console.error('Error accessing item:', itemPath, err);
          }
        }
      } catch (err) {
        console.error('Error reading directory:', dir, err);
      }
    };
    
    searchFiles(mainFilesDir);
    console.log(`📁 Found ${allFiles.length} files in directory`);
    
    // Try to find matching file (exact or partial match)
    const normalizedFileName = fileName.toLowerCase().trim();
    
    for (const file of allFiles) {
      const normalizedFile = file.name.toLowerCase().trim();
      
      // Exact match
      if (normalizedFile === normalizedFileName) {
        console.log('✅ File found (exact match):', file.path);
        return file.path;
      }
      
      // Partial match - check if fileName is contained in file.name or vice versa
      if (normalizedFile.includes(normalizedFileName) || normalizedFileName.includes(normalizedFile)) {
        // Also check if the file extension matches
        const fileExt = path.extname(fileName).toLowerCase();
        const foundExt = path.extname(file.name).toLowerCase();
        
        if (fileExt && foundExt && fileExt === foundExt) {
          console.log('✅ File found (partial match):', file.path);
          return file.path;
        }
      }
    }
    
    // If still not found, check in fileGroups from data.json
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    if (fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const fileGroups = data.fileGroups || [];
        
        console.log('🔍 Searching in', fileGroups.length, 'file groups...');
        
        // Search through all file groups
        for (const group of fileGroups) {
          if (group.files && group.files.length > 0) {
            for (const file of group.files) {
              const actualFileName = typeof file === 'string' ? file : (file.name || file.fileName);
              const filePathFromData = typeof file === 'object' && file.path ? file.path : null;
              
              // Check if this file matches
              const normalizedActualFileName = actualFileName ? actualFileName.toLowerCase().trim() : '';
              const normalizedTargetFileName = fileName.toLowerCase().trim();
              
              const matches = actualFileName && (
                normalizedActualFileName === normalizedTargetFileName ||
                normalizedActualFileName.includes(normalizedTargetFileName) ||
                normalizedTargetFileName.includes(normalizedActualFileName)
              );
              
              if (matches) {
                // First, try the original path from data.json (if it exists)
                if (filePathFromData && fs.existsSync(filePathFromData)) {
                  console.log('✅ File found at original path from data.json:', filePathFromData);
                  return filePathFromData;
                }
                
                // Try to find the file in the group folder
                const safeGroupName = (group.title || group.id || 'GROUP')
                  .replace(/[<>:"/\\|?*]/g, '_')
                  .substring(0, 50);
                const groupFolderPath = path.join(mainFilesDir, safeGroupName);
                
                // Check if group folder exists
                if (fs.existsSync(groupFolderPath)) {
                  const groupFilePath = path.join(groupFolderPath, actualFileName);
                  if (fs.existsSync(groupFilePath)) {
                    console.log('✅ File found in group folder:', groupFilePath);
                    return groupFilePath;
                  }
                }
                
                // Also try with the actual file name in main directory
                const mainFilePath = path.join(mainFilesDir, actualFileName);
                if (fs.existsSync(mainFilePath)) {
                  console.log('✅ File found in main directory (from group):', mainFilePath);
                  return mainFilePath;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error reading data.json for file groups:', error);
      }
    }
    
    // If still not found, search in ALL subproject folders of this project
    console.log('⚠️ File not found in subproject, searching in all subprojects of project...');
    const projectDir = path.join(dataDir, projectId);
    
    if (fs.existsSync(projectDir)) {
      try {
        const projectItems = fs.readdirSync(projectDir);
        const subprojectDirs = projectItems.filter(item => {
          const itemPath = path.join(projectDir, item);
          try {
            return fs.statSync(itemPath).isDirectory();
          } catch {
            return false;
          }
        });
        
        console.log(`📂 Found ${subprojectDirs.length} subproject directories, searching all...`);
        
        for (const otherSubprojectId of subprojectDirs) {
          if (otherSubprojectId === subprojectId) continue; // Already searched this one
          
          const otherFilesDir = path.join(projectDir, otherSubprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
          if (!fs.existsSync(otherFilesDir)) continue;
          
          // Search recursively in this subproject
          const otherAllFiles = [];
          const searchOtherFiles = (dir) => {
            try {
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const itemPath = path.join(dir, item);
                try {
                  const stat = fs.statSync(itemPath);
                  if (stat.isDirectory()) {
                    searchOtherFiles(itemPath);
                  } else if (stat.isFile()) {
                    otherAllFiles.push({ name: item, path: itemPath });
                  }
                } catch (err) {
                  // Skip
                }
              }
            } catch (err) {
              // Skip
            }
          };
          
          searchOtherFiles(otherFilesDir);
          
          // Try to find matching file
          const normalizedFileName = fileName.toLowerCase().trim();
          for (const file of otherAllFiles) {
            const normalizedFile = file.name.toLowerCase().trim();
            
            if (normalizedFile === normalizedFileName) {
              console.log(`✅ File found in other subproject (${otherSubprojectId}):`, file.path);
              return file.path;
            }
            
            // Partial match
            const fileExt = path.extname(fileName).toLowerCase();
            const foundExt = path.extname(file.name).toLowerCase();
            if (fileExt && foundExt && fileExt === foundExt) {
              if (normalizedFile.includes(normalizedFileName) || normalizedFileName.includes(normalizedFile)) {
                console.log(`✅ File found in other subproject (${otherSubprojectId}, partial match):`, file.path);
                return file.path;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error searching in other subprojects:', err);
      }
    }
    
    // If still not found, return the original path (will fail but at least we tried)
    console.log('⚠️ File not found after exhaustive search in all subprojects');
    console.log('📋 All files found in original directory:', allFiles.map(f => f.name).slice(0, 20));
    return filePath;
  } catch (error) {
    console.error('Error in get-file-path:', error);
    // Return the original path as fallback
    return path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName);
  }
});

// Download subproject file
ipcMain.handle('download-subproject-file', async (event, projectId, subprojectId, fileName) => {
  try {
    const { dialog } = require('electron');
    const filePath = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    }
    
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: fileName,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(filePath, result.filePath);
      return { success: true, filePath: result.filePath };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error downloading subproject file:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler για δημιουργία ομάδας αρχείων υποέργου
ipcMain.handle('create-file-group', async (event, projectId, subprojectId, groupTitle, filesToGroup) => {
  try {
    console.log('Creating file group:', { projectId, subprojectId, groupTitle, filesToGroup });
    
    const projectDir = path.join(dataDir, projectId);
    const subprojectDir = path.join(projectDir, subprojectId);
    const dataFilePath = path.join(subprojectDir, 'data.json'); // Διορθώθηκε το όνομα αρχείου
    
    // Διαβάζουμε τα υπάρχοντα δεδομένα
    let projectData = {};
    if (fs.existsSync(dataFilePath)) {
      const dataContent = fs.readFileSync(dataFilePath, 'utf8');
      projectData = JSON.parse(dataContent);
    }
    
    // Βεβαιωνόμαστε ότι υπάρχει η δομή fileGroups
    if (!projectData.fileGroups) {
      projectData.fileGroups = [];
    }
    
    // Μετατρέπουμε τα υπάρχοντα αρχεία από τη παλιά δομή στη νέα
    if (projectData.files && Array.isArray(projectData.files)) {
      // Αν τα files είναι objects με name/path, τα μετατρέπουμε σε strings
      const fileNames = projectData.files.map(file => 
        typeof file === 'string' ? file : file.name
      );
      projectData.files = fileNames;
    } else if (!projectData.files) {
      projectData.files = [];
    }
    
    // Δημιουργούμε τη νέα ομάδα
    const newGroup = {
      id: uuidv4(),
      title: groupTitle,
      files: filesToGroup.map(fileName => ({
        name: fileName,
        path: path.join(subprojectDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName)
      }))
    };
    
    // Προσθέτουμε την ομάδα στα δεδομένα
    projectData.fileGroups.push(newGroup);
    
    // Αφαιρούμε τα αρχεία από τη λίστα των μη ομαδοποιημένων
    if (projectData.files) {
      projectData.files = projectData.files.filter(file => {
        const fileName = typeof file === 'string' ? file : file.name;
        return !filesToGroup.includes(fileName);
      });
    }
    
    // Ενημερώνουμε το updatedAt
    projectData.updatedAt = new Date().toISOString();
    
    // Αποθηκεύουμε τα ενημερωμένα δεδομένα
    safeWriteJSON(dataFilePath, projectData);
    
    console.log('File group created successfully:', newGroup);
    logAuditAction({
      type: 'create',
      entityType: 'file_group',
      entityId: newGroup.id,
      entityTitle: groupTitle,
      details: `Δημιουργία ομάδας αρχείων με ${filesToGroup.length} αρχεία`
    });
    return { success: true, groupId: newGroup.id };
  } catch (error) {
    console.error('Error creating file group:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler για προσθήκη αρχείων σε υπάρχουσα ομάδα
ipcMain.handle('add-files-to-group', async (event, projectId, subprojectId, groupId, filesToAdd) => {
  try {
    console.log('Adding files to group:', { projectId, subprojectId, groupId, filesToAdd });
    
    const projectDir = path.join(dataDir, projectId);
    const subprojectDir = path.join(projectDir, subprojectId);
    const dataFilePath = path.join(subprojectDir, 'data.json'); // Διορθώθηκε το όνομα αρχείου
    
    // Διαβάζουμε τα υπάρχοντα δεδομένα
    let projectData = {};
    if (fs.existsSync(dataFilePath)) {
      const dataContent = fs.readFileSync(dataFilePath, 'utf8');
      projectData = JSON.parse(dataContent);
    }
    
    // Βρίσκουμε την ομάδα και προσθέτουμε τα αρχεία
    if (projectData.fileGroups) {
      const groupIndex = projectData.fileGroups.findIndex(group => group.id === groupId);
      if (groupIndex !== -1) {
        // Αφαιρούμε τα αρχεία από άλλες ομάδες (αν υπάρχουν)
        projectData.fileGroups.forEach((group, index) => {
          if (index !== groupIndex) {
            group.files = group.files.filter(file => {
              const fileName = typeof file === 'string' ? file : file.name;
              return !filesToAdd.includes(fileName);
            });
          }
        });
        
        // Προσθέτουμε τα νέα αρχεία (μόνο αν δεν υπάρχουν ήδη)
        const existingFileNames = new Set(
          projectData.fileGroups[groupIndex].files.map(file => 
            typeof file === 'string' ? file : file.name
          )
        );
        
        const newFiles = filesToAdd
          .filter(fileName => !existingFileNames.has(fileName))
          .map(fileName => ({
            name: fileName,
            path: path.join(subprojectDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName)
          }));
        
        projectData.fileGroups[groupIndex].files = [...projectData.fileGroups[groupIndex].files, ...newFiles];
        
        // Αφαιρούμε τα αρχεία από τη λίστα των μη ομαδοποιημένων
        if (projectData.files) {
          projectData.files = projectData.files.filter(file => {
            const fileName = typeof file === 'string' ? file : file.name;
            return !filesToAdd.includes(fileName);
          });
        }
        
        // Ενημερώνουμε το updatedAt
        projectData.updatedAt = new Date().toISOString();
        
        // Αποθηκεύουμε τα ενημερωμένα δεδομένα
        safeWriteJSON(dataFilePath, projectData);
        
        console.log('Files added to group successfully');
        logAuditAction({
          type: 'update',
          entityType: 'file_group',
          entityId: groupId,
          entityTitle: projectData.fileGroups[groupIndex].title || groupId,
          details: `Προσθήκη ${filesToAdd.length} αρχείου/ων σε ομάδα`
        });
        return { success: true };
      } else {
        return { success: false, error: 'Η ομάδα δεν βρέθηκε' };
      }
    } else {
      return { success: false, error: 'Δεν υπάρχουν ομάδες αρχείων' };
    }
  } catch (error) {
    console.error('Error adding files to group:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// ENTAXIS (ΕΝΤΆΞΕΙΣ) IPC HANDLERS
// ============================================================

const entaxisDir = dataDir ? path.join(dataDir, 'entaxeis') : null;

if (entaxisDir && !fs.existsSync(entaxisDir)) {
  fs.mkdirSync(entaxisDir, { recursive: true });
}

// Load all entaxeis
ipcMain.handle('load-all-entaxeis', async () => {
  try {
    const entaxeis = [];
    
    console.log('Loading entaxeis from:', entaxisDir);
    
    // Helper function για async exists check
    const pathExists = async (filePath) => {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    };
    
    if (!(await pathExists(entaxisDir))) {
      console.log('Entaxis directory does not exist, creating...');
      await fs.promises.mkdir(entaxisDir, { recursive: true });
      return entaxeis;
    }
    
    // Read directories - ASYNC
    const entaxiDirs = await fs.promises.readdir(entaxisDir);
    console.log('Found entaxi directories:', entaxiDirs);
    
    // Process all directories in parallel - ASYNC
    const entaxiPromises = entaxiDirs.map(async (entaxiDir) => {
      const entaxiPath = path.join(entaxisDir, entaxiDir);
      try {
        const stats = await fs.promises.stat(entaxiPath);
        if (stats.isDirectory()) {
          const dataFile = path.join(entaxiPath, 'data.json');
          if (await pathExists(dataFile)) {
            try {
              // Load data file - ASYNC
              const fileContent = await fs.promises.readFile(dataFile, 'utf8');
              const data = JSON.parse(fileContent);
              
              // Load PDF files from ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ directory - ASYNC
              const filesDir = path.join(entaxiPath, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
              if (await pathExists(filesDir)) {
                const files = await fs.promises.readdir(filesDir);
                const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
                
                // Set entaxiPDF if not already set and PDF files exist
                if (!data.entaxiPDF && pdfFiles.length > 0) {
                  data.entaxiPDF = pdfFiles[0]; // Use first PDF file
                }
                
                // Set approvalPDF if not already set and there's a second PDF file
                if (!data.approvalPDF && pdfFiles.length > 1) {
                  data.approvalPDF = pdfFiles[1]; // Use second PDF file
                }
              }
              
              return data;
            } catch (error) {
              console.error(`Error reading entaxi data from ${dataFile}:`, error);
              return null;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing entaxi directory ${entaxiDir}:`, error);
      }
      return null;
    });
    
    // Wait for all promises and filter out nulls
    const results = await Promise.all(entaxiPromises);
    const validEntaxeis = results.filter(entaxi => entaxi !== null);
    entaxeis.push(...validEntaxeis);
    
    // Sort by documentDate descending
    entaxeis.sort((a, b) => new Date(b.documentDate) - new Date(a.documentDate));
    
    // console.log(`Loaded ${entaxeis.length} entaxeis total`);
    return entaxeis;
  } catch (error) {
    console.error('Error loading entaxeis:', error);
    return [];
  }
});

// Save entaxi - ASYNC VERSION (Non-blocking)
ipcMain.handle('save-entaxi', async (event, entaxiData) => {
  try {
    const entaxiId = entaxiData.entaxiId;

    // Σημείωση: Το locking για τις εντάξεις γίνεται στο UI (EntaxisManager).
    // Δεν ελέγχουμε ούτε δημιουργούμε lock εδώ για να μην μπλοκάρουμε το save
    // όταν ο ίδιος χρήστης έχει ήδη πάρει lock από το UI.
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const filesDir = path.join(entaxiPath, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
    
    // Helper function για async exists check
    const pathExists = async (filePath) => {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    };
    
    // Δημιουργία φακέλων - ASYNC
    if (!(await pathExists(entaxiPath))) {
      await fs.promises.mkdir(entaxiPath, { recursive: true });
    }
    if (!(await pathExists(filesDir))) {
      await fs.promises.mkdir(filesDir, { recursive: true });
    }
    
    // Handle file uploads
    const savedData = { ...entaxiData };
    
    // Handle multiple entaxi PDFs - ASYNC
    const savedEntaxiFiles = [];
    console.log('🔍 Processing entaxiPDFs:', entaxiData.entaxiPDFs);
    console.log('🔍 Type of entaxiPDFs:', typeof entaxiData.entaxiPDFs);
    console.log('🔍 Is Array:', Array.isArray(entaxiData.entaxiPDFs));
    
    if (entaxiData.entaxiPDFs && Array.isArray(entaxiData.entaxiPDFs)) {
      console.log('✅ entaxiPDFs is valid array with length:', entaxiData.entaxiPDFs.length);
      for (const file of entaxiData.entaxiPDFs) {
        console.log('🔍 Processing entaxi file:', JSON.stringify(file, null, 2));
        if (file && file.filePath) {
          const fileName = path.basename(file.fileName || file.filePath);
          const destPath = path.join(filesDir, fileName);
          
          console.log('📁 Copying entaxi PDF from:', file.filePath, 'to:', destPath);
          if (await pathExists(file.filePath)) {
            await fs.promises.copyFile(file.filePath, destPath);
            console.log('✅ Entaxi PDF copied successfully:', fileName);
            savedEntaxiFiles.push(fileName);
          } else {
            console.error('❌ Source entaxi PDF file not found:', file.filePath);
          }
        } else {
          console.log('⚠️ File has no filePath:', JSON.stringify(file, null, 2));
        }
      }
    } else {
      console.log('❌ entaxiPDFs is NOT a valid array or is null/undefined');
      console.log('❌ Actual value:', entaxiData.entaxiPDFs);
    }
    
    // Handle multiple approval PDFs - ASYNC
    const savedApprovalFiles = [];
    console.log('🔍 Processing approvalPDFs:', entaxiData.approvalPDFs);
    console.log('🔍 Type of approvalPDFs:', typeof entaxiData.approvalPDFs);
    console.log('🔍 Is Array:', Array.isArray(entaxiData.approvalPDFs));
    
    if (entaxiData.approvalPDFs && Array.isArray(entaxiData.approvalPDFs)) {
      console.log('✅ approvalPDFs is valid array with length:', entaxiData.approvalPDFs.length);
      for (const file of entaxiData.approvalPDFs) {
        console.log('🔍 Processing approval file:', JSON.stringify(file, null, 2));
        if (file && file.filePath) {
          const fileName = path.basename(file.fileName || file.filePath);
          const destPath = path.join(filesDir, fileName);
          
          console.log('📁 Copying approval PDF from:', file.filePath, 'to:', destPath);
          if (await pathExists(file.filePath)) {
            await fs.promises.copyFile(file.filePath, destPath);
            console.log('Approval PDF copied successfully');
            savedApprovalFiles.push(fileName);
          } else {
            console.error('Source approval PDF file not found:', file.filePath);
          }
        }
      }
    }
    
    // Backward compatibility: Handle single file format - ASYNC
    if (entaxiData.entaxiPDF && entaxiData.entaxiPDF.filePath) {
      const fileName = path.basename(entaxiData.entaxiPDF.fileName || entaxiData.entaxiPDF.filePath);
      const destPath = path.join(filesDir, fileName);
      
      console.log('Copying single entaxi PDF from:', entaxiData.entaxiPDF.filePath, 'to:', destPath);
      if (await pathExists(entaxiData.entaxiPDF.filePath)) {
        await fs.promises.copyFile(entaxiData.entaxiPDF.filePath, destPath);
        console.log('Single entaxi PDF copied successfully');
        savedData.entaxiPDF = fileName;
      }
    }
    
    if (entaxiData.approvalPDF && entaxiData.approvalPDF.filePath) {
      const fileName = path.basename(entaxiData.approvalPDF.fileName || entaxiData.approvalPDF.filePath);
      const destPath = path.join(filesDir, fileName);
      
      console.log('Copying single approval PDF from:', entaxiData.approvalPDF.filePath, 'to:', destPath);
      if (await pathExists(entaxiData.approvalPDF.filePath)) {
        await fs.promises.copyFile(entaxiData.approvalPDF.filePath, destPath);
        console.log('Single approval PDF copied successfully');
        savedData.approvalPDF = fileName;
      }
    }
    
    // Combine new files with existing files for preservation
    const existingEntaxiFiles = entaxiData.existingEntaxiFiles || [];
    const existingApprovalFiles = entaxiData.existingApprovalFiles || [];
    
    console.log('📂 Combining files for final JSON:');
    console.log('💾 New entaxi files:', savedEntaxiFiles);
    console.log('💾 Existing entaxi files:', existingEntaxiFiles);
    console.log('💾 New approval files:', savedApprovalFiles);
    console.log('💾 Existing approval files:', existingApprovalFiles);
    
    // Final file lists combining new and existing
    const finalEntaxiFiles = [...existingEntaxiFiles, ...savedEntaxiFiles];
    const finalApprovalFiles = [...existingApprovalFiles, ...savedApprovalFiles];
    
    savedData.entaxiPDFs = finalEntaxiFiles;
    savedData.approvalPDFs = finalApprovalFiles;
    
    console.log('✅ Final combined file lists:');
    console.log('💾 Final savedData.entaxiPDFs:', savedData.entaxiPDFs);
    console.log('💾 Final savedData.approvalPDFs:', savedData.approvalPDFs);
    
    // Clean up temporary data
    delete savedData.existingEntaxiFiles;
    delete savedData.existingApprovalFiles;
    
    // Clean up temp files after successful save
    await cleanupTempFiles(entaxiData.entaxiPDFs, entaxiData.approvalPDFs);
    
    // Clean up file objects from saved data
    delete savedData.entaxiPDF?.constructor;
    delete savedData.approvalPDF?.constructor;
    
    // Save JSON data - ASYNC
    const jsonPath = path.join(entaxiPath, 'data.json');
    let existingEntaxiData = null;
    if (fs.existsSync(jsonPath)) {
      try { existingEntaxiData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (_e) { /* ignore */ }
    }
    await safeWriteJSONAsync(jsonPath, savedData);

    logAuditAction({
      type: existingEntaxiData ? 'update' : 'create',
      entityType: 'entaxi',
      entityId: entaxiId,
      entityTitle: savedData.title || savedData.projectTitle || entaxiId,
      details: existingEntaxiData ? 'Ενημέρωση ένταξης' : 'Δημιουργία νέας ένταξης',
      oldValue: existingEntaxiData,
      newValue: savedData
    });

    return { success: true, entaxiId };
  } catch (error) {
    console.error('Error saving entaxi:', error);
    return { success: false, error: error.message };
  }
});

// Get entaxi files
ipcMain.handle('get-entaxi-files', async (event, entaxiId) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const filesDir = path.join(entaxiPath, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
    
    if (!fs.existsSync(filesDir)) {
      return [];
    }
    
    const files = fs.readdirSync(filesDir);
    return files.filter(file => file.toLowerCase().endsWith('.pdf'));
  } catch (error) {
    console.error('Error getting entaxi files:', error);
    return [];
  }
});

// Load entaxi data from JSON file
ipcMain.handle('load-entaxi-data', async (event, entaxiId) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataPath = path.join(entaxiPath, 'data.json');
    
    if (!fs.existsSync(dataPath)) {
      console.log('⚠️ No data.json found for entaxi:', entaxiId);
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('✅ Loaded entaxi data from JSON:', {
      entaxiId,
      entaxiPDFs: data.entaxiPDFs || [],
      approvalPDFs: data.approvalPDFs || []
    });
    
    return data;
  } catch (error) {
    console.error('Error loading entaxi data:', error);
    return null;
  }
});

// Download entaxi file
ipcMain.handle('download-entaxi-file', async (event, entaxiId, fileName) => {
  try {
    const { dialog } = require('electron');
    let filePath;
    
    // Check in main files directory
    filePath = path.join(entaxisDir, entaxiId, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ', fileName);
    
    if (!fs.existsSync(filePath)) {
      // Check in modifications directories
      const modificationsDir = path.join(entaxisDir, entaxiId, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
      if (fs.existsSync(modificationsDir)) {
        const modDirs = fs.readdirSync(modificationsDir);
        for (const modDir of modDirs) {
          const modFilePath = path.join(modificationsDir, modDir, fileName);
          if (fs.existsSync(modFilePath)) {
            filePath = modFilePath;
            break;
          }
        }
      }
    }
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    }
    
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: fileName,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(filePath, result.filePath);
      return { success: true };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error downloading entaxi file:', error);
    return { success: false, error: error.message };
  }
});

// Save modification - ASYNC VERSION (Non-blocking)
ipcMain.handle('save-modification', async (event, entaxiId, modificationData) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataFile = path.join(entaxiPath, 'data.json');
    
    // Helper function για async exists check
    const pathExists = async (filePath) => {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    };
    
    if (!(await pathExists(dataFile))) {
      throw new Error('Entaxi not found');
    }
    
    // Load existing data - ASYNC
    const fileContent = await fs.promises.readFile(dataFile, 'utf8');
    const existingData = JSON.parse(fileContent);
    
    // Create modifications directory - ASYNC
    const modificationsDir = path.join(entaxiPath, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
    if (!(await pathExists(modificationsDir))) {
      await fs.promises.mkdir(modificationsDir, { recursive: true });
    }
    
    const modificationDir = path.join(modificationsDir, `ΤΡΟΠ_${existingData.modifications ? existingData.modifications.length + 1 : 1}`);
    if (!(await pathExists(modificationDir))) {
      await fs.promises.mkdir(modificationDir, { recursive: true });
    }
    
    // Handle file uploads for modification
    const savedModification = { ...modificationData };
    
    // Handle modification PDF - ASYNC
    if (modificationData.modificationPDF && modificationData.modificationPDF.filePath) {
      const fileName = path.basename(modificationData.modificationPDF.fileName || modificationData.modificationPDF.filePath);
      const destPath = path.join(modificationDir, fileName);
      
      console.log('Copying modification PDF from:', modificationData.modificationPDF.filePath, 'to:', destPath);
      if (await pathExists(modificationData.modificationPDF.filePath)) {
        await fs.promises.copyFile(modificationData.modificationPDF.filePath, destPath);
        console.log('Modification PDF copied successfully');
        savedModification.modificationPDF = fileName;
      } else {
        console.error('Source modification PDF file not found:', modificationData.modificationPDF.filePath);
      }
    }
    
    // Handle approval PDF - ASYNC
    if (modificationData.approvalPDF && modificationData.approvalPDF.filePath) {
      const fileName = `approval_${Date.now()}_${path.basename(modificationData.approvalPDF.fileName || modificationData.approvalPDF.filePath)}`;
      const destPath = path.join(modificationDir, fileName);
      
      console.log('Copying modification approval PDF from:', modificationData.approvalPDF.filePath, 'to:', destPath);
      if (await pathExists(modificationData.approvalPDF.filePath)) {
        await fs.promises.copyFile(modificationData.approvalPDF.filePath, destPath);
        console.log('Modification approval PDF copied successfully');
        savedModification.approvalPDF = fileName;
      } else {
        console.error('Source modification approval PDF file not found:', modificationData.approvalPDF.filePath);
      }
    }
    
    // Remove file objects
    delete savedModification.modificationPDF?.constructor;
    delete savedModification.approvalPDF?.constructor;
    
    // Add modification to array
    if (!existingData.modifications) {
      existingData.modifications = [];
    }
    existingData.modifications.push(savedModification);
    
    // Update timestamp
    existingData.updatedAt = new Date().toISOString();
    
    // Save updated data - ASYNC
    await safeWriteJSONAsync(dataFile, existingData);
    
    logAuditAction({
      type: 'create',
      entityType: 'entaxi_modification',
      entityId: entaxiId,
      entityTitle: `${existingData.title || entaxiId} - Τροποποίηση ${existingData.modifications.length}`,
      details: 'Προσθήκη τροποποίησης ένταξης',
      newValue: savedModification
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving modification:', error);
    return { success: false, error: error.message };
  }
});

// Delete entaxi
ipcMain.handle('delete-entaxi', async (event, entaxiId) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    let deletedData = null;
    const dataFile = path.join(entaxiPath, 'data.json');
    if (fs.existsSync(dataFile)) {
      try { deletedData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (_e) { /* ignore */ }
    }
    
    if (fs.existsSync(entaxiPath)) {
      fs.rmSync(entaxiPath, { recursive: true, force: true });
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'entaxi',
      entityId: entaxiId,
      entityTitle: deletedData?.title || deletedData?.projectTitle || entaxiId,
      details: 'Διαγραφή ένταξης',
      oldValue: deletedData,
      newValue: null
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting entaxi:', error);
    return { success: false, error: error.message };
  }
});

// View entaxi file
ipcMain.handle('view-entaxi-file', async (event, entaxiId, fileName) => {
  try {
    let filePath;
    
    // Check in main files directory
    filePath = path.join(entaxisDir, entaxiId, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ', fileName);
    
    if (!fs.existsSync(filePath)) {
      // Check in modifications directories
      const modificationsDir = path.join(entaxisDir, entaxiId, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
      if (fs.existsSync(modificationsDir)) {
        const modDirs = fs.readdirSync(modificationsDir);
        for (const modDir of modDirs) {
          const modFilePath = path.join(modificationsDir, modDir, fileName);
          if (fs.existsSync(modFilePath)) {
            filePath = modFilePath;
            break;
          }
        }
      }
    }
    
    if (fs.existsSync(filePath)) {
      // Use the generic file opener for all files
      console.log('Attempting to open file with exec:', filePath);
      return new Promise((resolve, reject) => {
        exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error opening file with exec:', error);
            console.error('stderr:', stderr);
            // Fallback: try with shell.openPath
            shell.openPath(filePath).then(() => {
              resolve({ success: true });
            }).catch(openError => {
              console.error('Error opening file with shell.openPath:', openError);
              reject(openError);
            });
          } else {
            console.log('File opened successfully with exec');
            resolve({ success: true });
          }
        });
      });
    } else {
      throw new Error('File not found');
    }
  } catch (error) {
    console.error('Error viewing entaxi file:', error);
    return { success: false, error: error.message };
  }
});

// Get entaxi file path (for download)
ipcMain.handle('get-entaxi-file-path', async (event, entaxiId, fileName) => {
  let filePath = path.join(entaxisDir, entaxiId, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ', fileName);
  
  if (!fs.existsSync(filePath)) {
    // Check in modifications directories
    const modificationsDir = path.join(entaxisDir, entaxiId, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
    if (fs.existsSync(modificationsDir)) {
      const modDirs = fs.readdirSync(modificationsDir);
      for (const modDir of modDirs) {
        const modFilePath = path.join(modificationsDir, modDir, fileName);
        if (fs.existsSync(modFilePath)) {
          filePath = modFilePath;
          break;
        }
      }
    }
  }
  
  return filePath;
});

// File picker for entaxi files - ASYNC VERSION (Non-blocking)
ipcMain.handle('select-file', async (event, title = 'Επιλογή Αρχείου') => {
  try {
    const { dialog } = require('electron');
          const result = await dialog.showOpenDialog({
        title: title,
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Όλα τα Αρχεία', extensions: ['pdf', 'doc', 'docx'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Word Documents', extensions: ['doc', 'docx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

    if (!result.canceled && result.filePaths.length > 0) {
      // Helper function για async exists check
      const pathExists = async (filePath) => {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      };
      
      // Create temporary directory for uploaded files - ASYNC
      const tempDir = getTempDir();
      if (!(await pathExists(tempDir))) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }
      
      // Copy files to temp directory and return temp paths - ASYNC
      const files = await Promise.all(result.filePaths.map(async (filePath) => {
        const fileName = path.basename(filePath);
        const tempFilePath = path.join(tempDir, fileName);
        await fs.promises.copyFile(filePath, tempFilePath);
        
        return {
          filePath: tempFilePath,
          fileName: fileName
        };
      }));
      
      return {
        success: true,
        files: files,
        // Keep backward compatibility
        filePath: files[0].filePath,
        fileName: files[0].fileName
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error selecting file:', error);
    return { success: false, error: error.message };
  }
});

// File picker for multiple files (specifically for entaxis)
ipcMain.handle('select-multiple-files', async (event, title = 'Επιλογή Αρχείων') => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      title: title,
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Όλα τα Αρχεία', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'Word Documents', extensions: ['doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // Create temporary directory for uploaded files
      const tempDir = getTempDir();
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Copy files to temp directory and return temp paths
      const files = result.filePaths.map(filePath => {
        const fileName = path.basename(filePath);
        const tempFilePath = path.join(tempDir, fileName);
        fs.copyFileSync(filePath, tempFilePath);
        
        return {
          filePath: tempFilePath,
          fileName: fileName
        };
      });
      
      return {
        success: true,
        files: files
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error selecting files:', error);
    return { success: false, error: error.message };
  }
});

// Folder picker for proskliseis - supports multiple folders - ASYNC VERSION (Non-blocking)
ipcMain.handle('select-folder', async (event, title = 'Επιλογή Φακέλων') => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      title: title,
      properties: ['openDirectory', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // Helper function για async exists check
      const pathExists = async (filePath) => {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      };
      
      // Create temporary directory for uploaded folders - ASYNC
      const tempDir = getTempDir();
      if (!(await pathExists(tempDir))) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }

      const folders = [];
      
      // Process each selected folder - ASYNC (sequential για να μην υπερφορτώσουμε)
      for (const folderPath of result.filePaths) {
        const folderName = path.basename(folderPath);
        // Create a safe folder name (max 50 chars, remove special characters)
        const safeFolderName = folderName
          .replace(/[<>:"/\\|?*]/g, '_')
          .substring(0, 50)
          .trim();
        const tempFolderPath = path.join(tempDir, `${Date.now()}_${safeFolderName}`);
        
        // Copy entire folder to temp directory - ASYNC RECURSIVE
        const copyFolder = async (src, dest) => {
          // Create destination directory if it doesn't exist - ASYNC
          if (!(await pathExists(dest))) {
            await fs.promises.mkdir(dest, { recursive: true });
          }
          
          // Read directory contents - ASYNC
          const items = await fs.promises.readdir(src);
          
          // Process all items in parallel for better performance - ASYNC
          await Promise.all(items.map(async (item) => {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            // Check if item is directory - ASYNC
            const stats = await fs.promises.stat(srcPath);
            
            if (stats.isDirectory()) {
              // Recursive call for subdirectories - ASYNC
              await copyFolder(srcPath, destPath);
            } else {
              // Copy file - ASYNC
              await fs.promises.copyFile(srcPath, destPath);
            }
          }));
        };
        
        // Copy folder - ASYNC
        await copyFolder(folderPath, tempFolderPath);
        
        // Get folder contents for preview - ASYNC RECURSIVE
        const getFolderContents = async (dirPath) => {
          const contents = [];
          
          // Read directory contents - ASYNC
          const items = await fs.promises.readdir(dirPath);
          
          // Process all items in parallel - ASYNC
          const itemPromises = items.map(async (item) => {
            const itemPath = path.join(dirPath, item);
            const stat = await fs.promises.stat(itemPath);
            
            if (stat.isDirectory()) {
              // Recursive call for subdirectories - ASYNC
              const subContents = await getFolderContents(itemPath);
              return {
                name: item,
                type: 'folder',
                contents: subContents
              };
            } else {
              return {
                name: item,
                type: 'file',
                size: stat.size
              };
            }
          });
          
          // Wait for all items to be processed
          const itemResults = await Promise.all(itemPromises);
          contents.push(...itemResults);
          
          return contents;
        };
        
        // Get folder contents - ASYNC
        const folderContents = await getFolderContents(tempFolderPath);
        
        folders.push({
          folderPath: tempFolderPath,
          folderName: folderName,
          originalPath: folderPath,
          contents: folderContents
        });
      }
      
      return {
        success: true,
        folders: folders,
        // Keep backward compatibility
        folder: folders[0]
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error selecting folders:', error);
    return { success: false, error: error.message };
  }
});

// Open prosklisi folder
ipcMain.handle('open-prosklisi-folder', async (event, prosklisiId, folderName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder not found');
    }
    
    const { shell } = require('electron');
    // Use openPath instead of showItemInFolder to avoid screen darkening
    await shell.openPath(folderPath);
    
    return { success: true };
  } catch (error) {
    console.error('Error opening prosklisi folder:', error);
    return { success: false, error: error.message };
  }
});

// Get folder contents
ipcMain.handle('get-folder-contents', async (event, prosklisiId, folderName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder not found');
    }
    
    const items = fs.readdirSync(folderPath);
    const contents = items.map(item => {
      const itemPath = path.join(folderPath, item);
      const isDirectory = fs.statSync(itemPath).isDirectory();
      return {
        name: item,
        isDirectory: isDirectory
      };
    });
    return { success: true, contents };
  } catch (error) {
    console.error('Error getting folder contents:', error);
    return { success: false, error: error.message };
  }
});

// Get subfolder contents
ipcMain.handle('get-subfolder-contents', async (event, prosklisiId, parentFolderName, subfolderName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const parentFolderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, parentFolderName)
      : path.join(mainFilesDir, parentFolderName);
    
    const subfolderPath = path.join(parentFolderPath, subfolderName);
    
    if (!fs.existsSync(subfolderPath)) {
      throw new Error('Subfolder not found');
    }
    
    const items = fs.readdirSync(subfolderPath);
    const contents = items.map(item => {
      const itemPath = path.join(subfolderPath, item);
      const isDirectory = fs.statSync(itemPath).isDirectory();
      return {
        name: item,
        isDirectory: isDirectory
      };
    });
    return { success: true, contents };
  } catch (error) {
    console.error('Error getting subfolder contents:', error);
    return { success: false, error: error.message };
  }
});

// View file from subfolder
ipcMain.handle('view-file-from-subfolder', async (event, prosklisiId, parentFolderName, subfolderName, fileName, targetFolder) => {
  try {
    console.log('Original fileName:', fileName);
    console.log('Original parentFolderName:', parentFolderName);
    console.log('Original subfolderName:', subfolderName);
    
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const parentFolderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, parentFolderName)
      : path.join(mainFilesDir, parentFolderName);
    
    // List all files in the subfolder to find the correct one
    const subfolderPath = path.join(parentFolderPath, subfolderName);
    console.log('Looking in subfolder:', subfolderPath);
    
    if (!fs.existsSync(subfolderPath)) {
      throw new Error('Subfolder not found');
    }
    
    const files = fs.readdirSync(subfolderPath);
    console.log('Files in subfolder:', files);
    
    // Find the file by matching the end of the name (since the beginning might be corrupted)
    let actualFileName = fileName;
    const matchingFile = files.find(file => file.endsWith(fileName.split('.').pop()) || fileName.includes(file.split('.')[0]));
    if (matchingFile) {
      actualFileName = matchingFile;
      console.log('Found matching file:', actualFileName);
    }
    
    const filePath = path.join(subfolderPath, actualFileName);
    console.log('Final filePath:', filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found: ' + filePath);
    }
    
    console.log('File exists, opening with exec...');
    console.log('File extension:', path.extname(fileName).toLowerCase());
    
    // Use the generic file opener for all files
    console.log('Attempting to open file with exec:', filePath);
    return new Promise((resolve, reject) => {
      exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error opening file with exec:', error);
          console.error('stderr:', stderr);
          // Fallback: try with shell.openPath
          shell.openPath(filePath).then(() => {
            resolve({ success: true });
          }).catch(openError => {
            console.error('Error opening file with shell.openPath:', openError);
            reject(openError);
          });
        } else {
          console.log('File opened successfully with exec');
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Error viewing file from subfolder:', error);
    return { success: false, error: error.message };
  }
});

// Download file from subfolder
ipcMain.handle('download-file-from-subfolder', async (event, prosklisiId, parentFolderName, subfolderName, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const parentFolderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, parentFolderName)
      : path.join(mainFilesDir, parentFolderName);
    
    const filePath = path.join(parentFolderPath, subfolderName, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const result = await dialog.showSaveDialog({
      defaultPath: fileName,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled) {
      fs.copyFileSync(filePath, result.filePath);
      return { success: true };
    } else {
      return { success: false, error: 'Download cancelled' };
    }
  } catch (error) {
    console.error('Error downloading file from subfolder:', error);
    return { success: false, error: error.message };
  }
});

// Delete item from subfolder (simplified)
ipcMain.handle('delete-item-from-subfolder', async (event, prosklisiId, parentFolderName, subfolderName, itemName, targetFolder, isDirectory) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const parentFolderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, parentFolderName)
      : path.join(mainFilesDir, parentFolderName);
    
    const itemPath = path.join(parentFolderPath, subfolderName, itemName);
    
    if (!fs.existsSync(itemPath)) {
      throw new Error('Item not found');
    }
    
    if (isDirectory) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: prosklisiId,
      entityTitle: itemName,
      details: `Διαγραφή ${isDirectory ? 'φακέλου' : 'αρχείου'} από υποφάκελο πρόσκλησης`
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting item from subfolder:', error);
    return { success: false, error: error.message };
  }
});

// Delete item from folder (simplified)
ipcMain.handle('delete-item-from-folder', async (event, prosklisiId, folderName, itemName, targetFolder, isDirectory) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    const itemPath = path.join(folderPath, itemName);
    
    if (!fs.existsSync(itemPath)) {
      throw new Error('Item not found');
    }
    
    if (isDirectory) {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(itemPath);
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: prosklisiId,
      entityTitle: itemName,
      details: `Διαγραφή ${isDirectory ? 'φακέλου' : 'αρχείου'} από πρόσκληση`
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting item from folder:', error);
    return { success: false, error: error.message };
  }
});

// View file from folder
ipcMain.handle('view-file-from-folder', async (event, prosklisiId, folderName, fileName, targetFolder) => {
  try {
    console.log('Original fileName:', fileName);
    console.log('Original folderName:', folderName);
    
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    console.log('Looking in folder:', folderPath);
    
    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder not found');
    }
    
    // List all files in the folder to find the correct one
    const files = fs.readdirSync(folderPath);
    console.log('Files in folder:', files);
    
    // Find the file by matching the end of the name (since the beginning might be corrupted)
    let actualFileName = fileName;
    const matchingFile = files.find(file => file.endsWith(fileName.split('.').pop()) || fileName.includes(file.split('.')[0]));
    if (matchingFile) {
      actualFileName = matchingFile;
      console.log('Found matching file:', actualFileName);
    }
    
    const filePath = path.join(folderPath, actualFileName);
    console.log('Final filePath:', filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found: ' + filePath);
    }
    
    // Use the generic file opener for all files
    console.log('Attempting to open file with exec:', filePath);
    return new Promise((resolve, reject) => {
      exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error opening file with exec:', error);
          console.error('stderr:', stderr);
          // Fallback: try with shell.openPath
          shell.openPath(filePath).then(() => {
            resolve({ success: true });
          }).catch(openError => {
            console.error('Error opening file with shell.openPath:', openError);
            reject(openError);
          });
        } else {
          console.log('File opened successfully with exec');
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Error viewing file from folder:', error);
    return { success: false, error: error.message };
  }
});

// Download file from folder
ipcMain.handle('download-file-from-folder', async (event, prosklisiId, folderName, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    const filePath = path.join(folderPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const originalName = fileName;
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση Αρχείου',
      defaultPath: originalName,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(filePath, result.filePath);
      return { success: true };
    } else {
      return { success: false, error: 'Download cancelled' };
    }
  } catch (error) {
    console.error('Error downloading file from folder:', error);
    return { success: false, error: error.message };
  }
});

// Delete file from folder
ipcMain.handle('delete-file-from-folder', async (event, prosklisiId, folderName, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    const filePath = path.join(folderPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    fs.unlinkSync(filePath);
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: prosklisiId,
      entityTitle: fileName,
      details: 'Διαγραφή αρχείου από φάκελο πρόσκλησης'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from folder:', error);
    return { success: false, error: error.message };
  }
});

// Delete prosklisi folder
ipcMain.handle('delete-prosklisi-folder', async (event, prosklisiId, folderName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const folderPath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, folderName)
      : path.join(mainFilesDir, folderName);
    
    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder not found');
    }
    
    // Remove folder recursively
    const removeFolder = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          if (fs.statSync(filePath).isDirectory()) {
            removeFolder(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
        fs.rmdirSync(dirPath);
      }
    };
    
    removeFolder(folderPath);
    
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: prosklisiId,
      entityTitle: folderName,
      details: 'Διαγραφή φακέλου πρόσκλησης'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting prosklisi folder:', error);
    return { success: false, error: error.message };
  }
});

// Delete entaxi file
ipcMain.handle('delete-entaxi-file', async (event, entaxiId, fileName, isModification = false) => {
  try {
    let filePath;
    let fileFound = false;
    
    // Check in main files directory
    filePath = path.join(entaxisDir, entaxiId, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ', fileName);
    
    if (!fs.existsSync(filePath)) {
      // Check in modifications directories
      const modificationsDir = path.join(entaxisDir, entaxiId, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
      if (fs.existsSync(modificationsDir)) {
        const modDirs = fs.readdirSync(modificationsDir);
        for (const modDir of modDirs) {
          const modFilePath = path.join(modificationsDir, modDir, fileName);
          if (fs.existsSync(modFilePath)) {
            filePath = modFilePath;
            fileFound = true;
            break;
          }
        }
      }
    } else {
      fileFound = true;
    }
    
    // Delete the physical file if it exists
    if (fileFound && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('File deleted:', filePath);
    } else {
      console.log('File not found on disk, will remove from JSON only:', fileName);
    }
    
    // Always remove from JSON (even if file doesn't exist on disk)
    if (isModification) {
      console.log('Attempting to remove from JSON - isModification:', isModification, 'fileName:', fileName);
      const dataFile = path.join(entaxisDir, entaxiId, 'data.json');
      if (fs.existsSync(dataFile)) {
        const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        if (existingData.modifications && Array.isArray(existingData.modifications)) {
          // Find and update the modification that contains this file
          let modified = false;
          existingData.modifications = existingData.modifications.map(mod => {
            console.log('Checking modification:', mod.modificationId, 'approvalPDF:', mod.approvalPDF, 'modificationPDF:', mod.modificationPDF);
            
            // Check both exact match and basename match
            const approvalMatch = mod.approvalPDF && (
              mod.approvalPDF === fileName || 
              path.basename(mod.approvalPDF) === fileName ||
              path.basename(mod.approvalPDF) === path.basename(fileName)
            );
            
            const modificationMatch = mod.modificationPDF && (
              mod.modificationPDF === fileName ||
              path.basename(mod.modificationPDF) === fileName ||
              path.basename(mod.modificationPDF) === path.basename(fileName)
            );
            
            if (approvalMatch) {
              console.log('Found approvalPDF match, removing...');
              modified = true;
              return { ...mod, approvalPDF: null };
            }
            if (modificationMatch) {
              console.log('Found modificationPDF match, removing...');
              modified = true;
              return { ...mod, modificationPDF: null };
            }
            return mod;
          });
          
          if (modified) {
            existingData.updatedAt = new Date().toISOString();
            safeWriteJSON(dataFile, existingData);
            console.log('✅ Successfully removed file reference from modification JSON');
          } else {
            console.log('⚠️ No matching file found in modifications');
          }
        }
      }
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: entaxiId,
      entityTitle: fileName,
      details: isModification ? 'Διαγραφή αρχείου τροποποίησης ένταξης' : 'Διαγραφή αρχείου ένταξης'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting entaxi file:', error);
    return { success: false, error: error.message };
  }
});

// Delete entaxi modification
ipcMain.handle('delete-entaxi-modification', async (event, entaxiId, modificationId) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataFile = path.join(entaxiPath, 'data.json');

    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Entaxi not found' };
    }

    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    if (!existingData.modifications || !Array.isArray(existingData.modifications)) {
      return { success: false, error: 'No modifications found' };
    }

    const modificationIndex = existingData.modifications.findIndex(mod => mod.modificationId === modificationId);
    if (modificationIndex === -1) {
      return { success: false, error: 'Modification not found' };
    }

    const modification = existingData.modifications[modificationIndex];
    
    // Delete associated files
    try {
      const modificationsDir = path.join(entaxiPath, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
      if (fs.existsSync(modificationsDir)) {
        const modDirs = fs.readdirSync(modificationsDir);
        for (const modDir of modDirs) {
          const modDirPath = path.join(modificationsDir, modDir);
          if (fs.statSync(modDirPath).isDirectory()) {
            // Check if this directory contains files for this modification
            const files = fs.readdirSync(modDirPath);
            const hasModificationFiles = files.some(file => 
              file === modification.modificationPDF || file === modification.approvalPDF
            );
            
            if (hasModificationFiles) {
              // Delete all files in this directory
              files.forEach(file => {
                const filePath = path.join(modDirPath, file);
                if (fs.statSync(filePath).isFile()) {
                  fs.unlinkSync(filePath);
                }
              });
              // Remove the directory if empty
              const remainingFiles = fs.readdirSync(modDirPath);
              if (remainingFiles.length === 0) {
                fs.rmdirSync(modDirPath);
              }
            }
          }
        }
        
        // Check if the main ΤΡΟΠΟΠΟΙΗΣΕΙΣ directory is now empty and delete it
        const remainingModDirs = fs.readdirSync(modificationsDir);
        if (remainingModDirs.length === 0) {
          fs.rmdirSync(modificationsDir);
          console.log('Deleted empty ΤΡΟΠΟΠΟΙΗΣΕΙΣ directory');
        }
      }
    } catch (dirError) {
      console.error('Error deleting modification directory:', dirError);
    }

    // Remove modification from array
    existingData.modifications.splice(modificationIndex, 1);

    // Update timestamp
    existingData.updatedAt = new Date().toISOString();

    // Save updated data
    safeWriteJSON(dataFile, existingData);

    console.log(`Deleted modification ${modificationId} for entaxi ${entaxiId}`);
    logAuditAction({
      type: 'delete',
      entityType: 'entaxi_modification',
      entityId: modificationId,
      entityTitle: `${existingData.title || entaxiId} - Τροποποίηση`,
      details: 'Διαγραφή τροποποίησης ένταξης',
      oldValue: modification,
      newValue: null
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting entaxi modification:', error);
    return { success: false, error: error.message };
  }
});

// Update entaxi modification
ipcMain.handle('update-entaxi-modification', async (event, modificationData) => {
  try {
    const entaxiId = modificationData.entaxiId;
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataFile = path.join(entaxiPath, 'data.json');

    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Entaxi not found' };
    }

    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    if (!existingData.modifications || !Array.isArray(existingData.modifications)) {
      return { success: false, error: 'No modifications found' };
    }

    const modificationIndex = existingData.modifications.findIndex(mod => mod.modificationId === modificationData.modificationId);
    if (modificationIndex === -1) {
      return { success: false, error: 'Modification not found' };
    }

    // Get the modification number (1-based index)
    const modificationNumber = modificationIndex + 1;
    const modificationsDir = path.join(entaxiPath, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
    const modificationDir = path.join(modificationsDir, `ΤΡΟΠ_${modificationNumber}`);
    
    // Ensure modification directory exists
    if (!fs.existsSync(modificationDir)) {
      fs.mkdirSync(modificationDir, { recursive: true });
    }

    // Handle file uploads for modification update
    const savedModification = { ...modificationData };
    
    // Handle modification PDF
    if (modificationData.modificationPDF && modificationData.modificationPDF.filePath) {
      const fileName = path.basename(modificationData.modificationPDF.fileName || modificationData.modificationPDF.filePath);
      const destPath = path.join(modificationDir, fileName);
      
      console.log('Copying modification PDF from:', modificationData.modificationPDF.filePath, 'to:', destPath);
      if (fs.existsSync(modificationData.modificationPDF.filePath)) {
        fs.copyFileSync(modificationData.modificationPDF.filePath, destPath);
        console.log('Modification PDF copied successfully');
        savedModification.modificationPDF = fileName;
      } else {
        console.error('Source modification PDF file not found:', modificationData.modificationPDF.filePath);
      }
    }
    
    // Handle approval PDF
    if (modificationData.approvalPDF && modificationData.approvalPDF.filePath) {
      const fileName = path.basename(modificationData.approvalPDF.fileName || modificationData.approvalPDF.filePath);
      const destPath = path.join(modificationDir, fileName);
      
      console.log('Copying approval PDF from:', modificationData.approvalPDF.filePath, 'to:', destPath);
      if (fs.existsSync(modificationData.approvalPDF.filePath)) {
        fs.copyFileSync(modificationData.approvalPDF.filePath, destPath);
        console.log('Approval PDF copied successfully');
        savedModification.approvalPDF = fileName;
      } else {
        console.error('Source approval PDF file not found:', modificationData.approvalPDF.filePath);
      }
    }

    // Clean up file objects - keep only filenames as strings
    if (savedModification.modificationPDF && typeof savedModification.modificationPDF === 'object') {
      savedModification.modificationPDF = savedModification.modificationPDF.fileName || savedModification.modificationPDF.filePath;
    }
    if (savedModification.approvalPDF && typeof savedModification.approvalPDF === 'object') {
      savedModification.approvalPDF = savedModification.approvalPDF.fileName || savedModification.approvalPDF.filePath;
    }

    // Update the modification with saved file names
    existingData.modifications[modificationIndex] = {
      ...existingData.modifications[modificationIndex],
      ...savedModification,
      updatedAt: new Date().toISOString()
    };

    // Update timestamp
    existingData.updatedAt = new Date().toISOString();

    // Save updated data
    safeWriteJSON(dataFile, existingData);

    console.log(`Updated modification ${modificationData.modificationId} for entaxi ${entaxiId}`);
    logAuditAction({
      type: 'update',
      entityType: 'entaxi_modification',
      entityId: modificationData.modificationId,
      entityTitle: `${existingData.title || entaxiId} - Τροποποίηση ${modificationNumber}`,
      details: 'Ενημέρωση τροποποίησης ένταξης',
      oldValue: existingData.modifications[modificationIndex],
      newValue: savedModification
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating entaxi modification:', error);
    return { success: false, error: error.message };
  }
});

// Clean orphaned file references from entaxi modification
ipcMain.handle('clean-entaxi-modification-file', async (event, entaxiId, modificationId, fileType) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataFile = path.join(entaxiPath, 'data.json');

    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Entaxi not found' };
    }

    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    if (!existingData.modifications || !Array.isArray(existingData.modifications)) {
      return { success: false, error: 'No modifications found' };
    }

    const modificationIndex = existingData.modifications.findIndex(mod => mod.modificationId === modificationId);
    if (modificationIndex === -1) {
      return { success: false, error: 'Modification not found' };
    }

    // Remove the file reference
    if (fileType === 'approvalPDF') {
      existingData.modifications[modificationIndex].approvalPDF = null;
    } else if (fileType === 'modificationPDF') {
      existingData.modifications[modificationIndex].modificationPDF = null;
    }

    existingData.updatedAt = new Date().toISOString();
    safeWriteJSON(dataFile, existingData);

    console.log(`Cleaned ${fileType} reference from modification ${modificationId}`);
    return { success: true };
  } catch (error) {
    console.error('Error cleaning entaxi modification file:', error);
    return { success: false, error: error.message };
  }
});

// Fix all object file references in entaxi to strings
ipcMain.handle('fix-entaxi-file-objects', async (event, entaxiId) => {
  try {
    const entaxiPath = path.join(entaxisDir, entaxiId);
    const dataFile = path.join(entaxiPath, 'data.json');

    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Entaxi not found' };
    }

    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    let fixed = false;

    // Fix modifications
    if (existingData.modifications && Array.isArray(existingData.modifications)) {
      existingData.modifications = existingData.modifications.map(mod => {
        const fixedMod = { ...mod };
        
        // Fix approvalPDF if it's an object
        if (fixedMod.approvalPDF && typeof fixedMod.approvalPDF === 'object') {
          console.log('Fixing approvalPDF object:', fixedMod.approvalPDF);
          fixedMod.approvalPDF = fixedMod.approvalPDF.fileName || 
                                  fixedMod.approvalPDF.name || 
                                  (fixedMod.approvalPDF.filePath ? path.basename(fixedMod.approvalPDF.filePath) : null);
          fixed = true;
        }
        
        // Fix modificationPDF if it's an object
        if (fixedMod.modificationPDF && typeof fixedMod.modificationPDF === 'object') {
          console.log('Fixing modificationPDF object:', fixedMod.modificationPDF);
          fixedMod.modificationPDF = fixedMod.modificationPDF.fileName || 
                                      fixedMod.modificationPDF.name || 
                                      (fixedMod.modificationPDF.filePath ? path.basename(fixedMod.modificationPDF.filePath) : null);
          fixed = true;
        }
        
        return fixedMod;
      });
    }

    if (fixed) {
      existingData.updatedAt = new Date().toISOString();
      safeWriteJSON(dataFile, existingData);
      console.log(`✅ Fixed file objects in entaxi ${entaxiId}`);
      return { success: true, message: 'File objects fixed' };
    } else {
      console.log(`ℹ️ No file objects to fix in entaxi ${entaxiId}`);
      return { success: true, message: 'No objects to fix' };
    }
  } catch (error) {
    console.error('Error fixing entaxi file objects:', error);
    return { success: false, error: error.message };
  }
});

// Proskliseis IPC Handlers
const proskliseisDir = dataDir ? path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ') : null;

// Load all proskliseis
ipcMain.handle('load-all-proskliseis', async () => {
  try {
    console.log('Loading proskliseis from:', proskliseisDir);
    
    if (!fs.existsSync(proskliseisDir)) {
      console.log('Proskliseis directory does not exist, creating it');
      fs.mkdirSync(proskliseisDir, { recursive: true });
      return [];
    }

    const proskliseis = [];
    const prosklisiDirs = fs.readdirSync(proskliseisDir);
    
    console.log('Found prosklisi directories:', prosklisiDirs);

    for (const prosklisiDir of prosklisiDirs) {
      const prosklisiPath = path.join(proskliseisDir, prosklisiDir);
      const dataFilePath = path.join(prosklisiPath, 'data.json');
      
      if (fs.existsSync(dataFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
          // console.log('Loaded prosklisi:', data.title || 'Unknown');
          proskliseis.push(data);
        } catch (parseError) {
          console.error('Error parsing prosklisi data:', parseError);
        }
      }
    }

    // console.log('Loaded', proskliseis.length, 'proskliseis total');
    return proskliseis;
  } catch (error) {
    console.error('Error loading proskliseis:', error);
    return [];
  }
});

// Save prosklisi
ipcMain.handle('save-prosklisi', async (event, prosklisiData) => {
  try {
    console.log('Saving prosklisi:', prosklisiData.title);
    
    // Create proskliseis directory if it doesn't exist
    if (!fs.existsSync(proskliseisDir)) {
      fs.mkdirSync(proskliseisDir, { recursive: true });
    }

    // Create prosklisi directory
    const prosklisiDir = path.join(proskliseisDir, prosklisiData.prosklisiId);
    if (!fs.existsSync(prosklisiDir)) {
      fs.mkdirSync(prosklisiDir, { recursive: true });
    }

    // Create files directories
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    if (!fs.existsSync(mainFilesDir)) {
      fs.mkdirSync(mainFilesDir, { recursive: true });
    }
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }

    // Prepare data to save
    const savedData = { ...prosklisiData };

    // Handle file groups FIRST - copy files and save groups data
    if (prosklisiData.fileGroups && Array.isArray(prosklisiData.fileGroups)) {
      savedData.fileGroups = [];
      
      for (const group of prosklisiData.fileGroups) {
        if (group.files && Array.isArray(group.files)) {
          // Create group folder with safe name
          const safeGroupName = group.title
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 50)
            .trim();
          
          const groupFolderPath = path.join(attachmentsDir, safeGroupName);
          if (!fs.existsSync(groupFolderPath)) {
            fs.mkdirSync(groupFolderPath, { recursive: true });
          }
          
          const groupFiles = [];
          
          for (const file of group.files) {
            if (file.filePath) {
              // Use original filename without any prefixes
              const originalFileName = path.basename(file.fileName || file.filePath);
              const destPath = path.join(groupFolderPath, originalFileName);
              
              if (fs.existsSync(file.filePath)) {
                console.log('Copying group file from:', file.filePath, 'to:', destPath);
                fs.copyFileSync(file.filePath, destPath);
                groupFiles.push({
                  fileName: originalFileName,
                  originalName: file.fileName,
                  filePath: destPath
                });
                console.log('Group file copied successfully');
              } else {
                console.error('Source group file not found:', file.filePath);
              }
            }
          }
          
          savedData.fileGroups.push({
            id: group.id,
            title: group.title,
            files: groupFiles
          });
        }
      }
    }

    // Handle prosklisi PDF files (multiple files with folder choice) - AFTER file groups
    if (prosklisiData.prosklisiFiles && Array.isArray(prosklisiData.prosklisiFiles)) {
      savedData.prosklisiFiles = [];
      
      // Get original names of files that are already in groups
      const groupedOriginalNames = new Set();
      if (savedData.fileGroups && Array.isArray(savedData.fileGroups)) {
        savedData.fileGroups.forEach(group => {
          if (group.files && Array.isArray(group.files)) {
            group.files.forEach(file => {
              // Προσθήκη και των δύο πεδίων για σωστό έλεγχο
              if (file.originalName) groupedOriginalNames.add(file.originalName);
              if (file.fileName) groupedOriginalNames.add(file.fileName);
              // Προσθήκη του πραγματικού ονόματος αρχείου που αποθηκεύεται
              if (file.fileName && file.fileName.startsWith('prosklisi_')) {
                // Εξαγωγή του original name από το stored filename
                const parts = file.fileName.split('_');
                if (parts.length >= 4) {
                  const extractedOriginalName = parts.slice(3).join('_');
                  groupedOriginalNames.add(extractedOriginalName);
                }
              }
            });
          }
        });
      }
      
      for (const file of prosklisiData.prosklisiFiles) {
        // Skip files that are already in groups - έλεγχος και των δύο πεδίων
        if (groupedOriginalNames.has(file.fileName) || groupedOriginalNames.has(file.originalName)) {
          console.log('Skipping duplicate file:', file.fileName, 'already in groups');
          continue;
        }
        
        if (file.filePath && file.targetFolder) {
          // Use original filename without any prefixes
          const originalFileName = path.basename(file.fileName || file.filePath);
          
          // Choose destination based on targetFolder
          const targetDir = file.targetFolder === 'attachments' ? attachmentsDir : mainFilesDir;
          const destPath = path.join(targetDir, originalFileName);
          
          if (fs.existsSync(file.filePath)) {
            console.log('Copying prosklisi file from:', file.filePath, 'to:', destPath);
            fs.copyFileSync(file.filePath, destPath);
            savedData.prosklisiFiles.push({
              fileName: originalFileName,
              originalName: file.fileName,
              targetFolder: file.targetFolder
            });
            console.log('Prosklisi file copied successfully');
          } else {
            console.error('Source prosklisi file not found:', file.filePath);
          }
        }
      }
    }

    // Handle prosklisi folders
    if (prosklisiData.prosklisiFolders && Array.isArray(prosklisiData.prosklisiFolders)) {
      savedData.prosklisiFolders = [];
      
      for (const folder of prosklisiData.prosklisiFolders) {
        if (folder.folderPath && folder.targetFolder) {
          // Create a safe folder name (max 50 chars, remove special characters)
          const safeOriginalName = folder.folderName
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 50)
            .trim();
          
          const folderName = `prosklisi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${safeOriginalName}`;
          
          // Choose destination based on targetFolder
          const targetDir = folder.targetFolder === 'attachments' ? attachmentsDir : mainFilesDir;
          const destPath = path.join(targetDir, folderName);
          
          if (fs.existsSync(folder.folderPath)) {
            console.log('Copying prosklisi folder from:', folder.folderPath, 'to:', destPath);
            
            // Copy entire folder recursively
            const copyFolder = (src, dest) => {
              if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
              }
              
              const items = fs.readdirSync(src);
              for (const item of items) {
                const srcPath = path.join(src, item);
                // Create safe item name
                const safeItemName = item
                  .replace(/[<>:"/\\|?*]/g, '_')
                  .substring(0, 100)
                  .trim();
                const destItemPath = path.join(dest, safeItemName);
                
                if (fs.statSync(srcPath).isDirectory()) {
                  copyFolder(srcPath, destItemPath);
                } else {
                  fs.copyFileSync(srcPath, destItemPath);
                }
              }
            };
            
            copyFolder(folder.folderPath, destPath);
            
            savedData.prosklisiFolders.push({
              folderName: folderName,
              originalName: folder.folderName,
              targetFolder: folder.targetFolder
            });
            console.log('Prosklisi folder copied successfully');
          } else {
            console.error('Source prosklisi folder not found:', folder.folderPath);
          }
        }
      }
    }


    // Save data to JSON file
    const dataFilePath = path.join(prosklisiDir, 'data.json');
    let existingProsklisiData = null;
    if (fs.existsSync(dataFilePath)) {
      try { existingProsklisiData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8')); } catch (_e) { /* ignore */ }
    }
    safeWriteJSON(dataFilePath, savedData);
    
    // Also save to prosklisi_data.json for file groups
    const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
    
    // Load existing prosklisi_data.json if it exists
    let existingData = {};
    if (fs.existsSync(prosklisiDataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
      } catch (error) {
        console.error('Error loading existing prosklisi_data.json:', error);
      }
    }
    
    // Merge with existing data, keeping existing fileGroups and adding new ones
    const mergedData = {
      ...existingData,
      ...savedData,
      fileGroups: savedData.fileGroups || existingData.fileGroups || []
    };
    
    safeWriteJSON(prosklisiDataPath, mergedData);
    
    console.log('Prosklisi saved successfully to:', dataFilePath);
    logAuditAction({
      type: existingProsklisiData ? 'update' : 'create',
      entityType: 'prosklisi',
      entityId: prosklisiData.prosklisiId,
      entityTitle: savedData.title || prosklisiData.prosklisiId,
      details: existingProsklisiData ? 'Ενημέρωση πρόσκλησης' : 'Δημιουργία νέας πρόσκλησης',
      oldValue: existingProsklisiData,
      newValue: savedData
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving prosklisi:', error);
    return { success: false, error: error.message };
  }
});

// Delete prosklisi
ipcMain.handle('delete-prosklisi', async (event, prosklisiId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    let deletedData = null;
    const dataFile = path.join(prosklisiDir, 'data.json');
    if (fs.existsSync(dataFile)) {
      try { deletedData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (_e) { /* ignore */ }
    }
    
    if (fs.existsSync(prosklisiDir)) {
      fs.rmSync(prosklisiDir, { recursive: true, force: true });
      console.log('Prosklisi deleted:', prosklisiId);
      logAuditAction({
        type: 'delete',
        entityType: 'prosklisi',
        entityId: prosklisiId,
        entityTitle: deletedData?.title || prosklisiId,
        details: 'Διαγραφή πρόσκλησης',
        oldValue: deletedData,
        newValue: null
      });
      return { success: true };
    } else {
      throw new Error('Prosklisi directory not found');
    }
  } catch (error) {
    console.error('Error deleting prosklisi:', error);
    return { success: false, error: error.message };
  }
});

// Old handlers removed - replaced with new ones below

// Open prosklisi folder in native file explorer
// Get prosklisi files for file manager
ipcMain.handle('get-prosklisi-files', async (event, prosklisiId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    const files = {
      main: [],
      attachments: []
    };
    
    const folders = {
      main: [],
      attachments: []
    };
    
    // Read main files and folders
    if (fs.existsSync(mainFilesDir)) {
      const mainItems = fs.readdirSync(mainFilesDir);
      
      const mainFiles = mainItems.filter(file => {
        const filePath = path.join(mainFilesDir, file);
        return fs.statSync(filePath).isFile();
      });
      
      const mainFolders = mainItems.filter(file => {
        const filePath = path.join(mainFilesDir, file);
        return fs.statSync(filePath).isDirectory() && !file.includes('Επισυναπτόμενα');
      });
      
      files.main = mainFiles.map(fileName => {
        // Τώρα τα αρχεία αποθηκεύονται με το αρχικό όνομα
        return {
          fileName: fileName,
          originalName: fileName
        };
      });
      
      // Get unique folders by filtering out duplicates
      const uniqueMainFolders = [...new Set(mainFolders)];
      folders.main = uniqueMainFolders.map(folderName => {
        // Τώρα οι φάκελοι αποθηκεύονται με το αρχικό όνομα
        return {
          folderName: folderName,
          originalName: folderName
        };
      });
    }
    
    // Read attachment files and folders from data.json (not from filesystem)
    const dataPath = path.join(prosklisiDir, 'data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      // Get files from file groups (these are the grouped files)
      if (data.fileGroups && Array.isArray(data.fileGroups)) {
        data.fileGroups.forEach(group => {
          if (group.files && Array.isArray(group.files)) {
            group.files.forEach(file => {
              files.attachments.push({
                fileName: file.fileName,
                originalName: file.originalName || file.fileName,
                isGrouped: true,
                groupId: group.id,
                groupTitle: group.title
              });
            });
          }
        });
      }
      
      // Get files from prosklisiFiles (these are the ungrouped files)
      if (data.prosklisiFiles && Array.isArray(data.prosklisiFiles)) {
        data.prosklisiFiles.forEach(file => {
          if (file.targetFolder === 'attachments') {
            files.attachments.push({
              fileName: file.fileName,
              originalName: file.originalName || file.fileName,
              isGrouped: false
            });
          } else {
            files.main.push({
              fileName: file.fileName,
              originalName: file.originalName || file.fileName,
              isGrouped: false
            });
          }
        });
      }
    }
    
    // Read ungrouped files from filesystem (attachments folder)
    if (fs.existsSync(attachmentsDir)) {
      const attachmentItems = fs.readdirSync(attachmentsDir);
      
      const attachmentFiles = attachmentItems.filter(file => {
        const filePath = path.join(attachmentsDir, file);
        return fs.statSync(filePath).isFile();
      });
      
      // Add ungrouped files from filesystem
      attachmentFiles.forEach(fileName => {
        // Check if this file is already in the list (from data.json)
        const exists = files.attachments.some(f => f.fileName === fileName);
        if (!exists) {
          // Τώρα τα αρχεία αποθηκεύονται με το αρχικό όνομα
          files.attachments.push({
            fileName: fileName,
            originalName: fileName,
            isGrouped: false
          });
        }
      });
    }
    
    // Load file groups from prosklisi data
    let fileGroups = [];
    try {
      const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
      if (fs.existsSync(prosklisiDataPath)) {
        const prosklisiData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
        fileGroups = prosklisiData.fileGroups || [];
      }
    } catch (error) {
      console.error('Error loading file groups:', error);
    }
    
    // Load grouped files from group folders
    if (fs.existsSync(attachmentsDir)) {
      const attachmentItems = fs.readdirSync(attachmentsDir);
      const groupFolders = attachmentItems.filter(item => {
        const itemPath = path.join(attachmentsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      groupFolders.forEach(groupFolderName => {
        const groupFolderPath = path.join(attachmentsDir, groupFolderName);
        const groupFiles = fs.readdirSync(groupFolderPath);
        
        groupFiles.forEach(fileName => {
          files.attachments.push({
            fileName: fileName,
            originalName: fileName,
            isGrouped: true,
            groupTitle: groupFolderName
          });
        });
      });
    }
    
    return { success: true, files: files, folders: folders, fileGroups: fileGroups };
  } catch (error) {
    console.error('Error getting prosklisi files:', error);
    return { success: false, error: error.message };
  }
});

// Delete prosklisi group
ipcMain.handle('delete-prosklisi-group', async (event, prosklisiId, groupId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
    
    if (!fs.existsSync(prosklisiDataPath)) {
      return { success: false, error: 'Prosklisi data not found' };
    }
    
    const prosklisiData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
    
    // Find and remove the group
    const groupIndex = prosklisiData.fileGroups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return { success: false, error: 'Group not found' };
    }
    
    // Move files back to main files list
    const group = prosklisiData.fileGroups[groupIndex];
    if (group.files && group.files.length > 0) {
      prosklisiData.prosklisiFiles = [...(prosklisiData.prosklisiFiles || []), ...group.files];
    }
    
    // Remove the group
    prosklisiData.fileGroups.splice(groupIndex, 1);
    
    // Save updated data
    safeWriteJSON(prosklisiDataPath, prosklisiData);
    
    // Ενημερώνουμε και το data.json
    const dataPath = path.join(prosklisiDir, 'data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      // Αφαιρούμε την ομάδα από fileGroups
      if (data.fileGroups) {
        data.fileGroups = data.fileGroups.filter(group => group.id !== groupId);
      }
      
      // Προσθέτουμε τα αρχεία στο prosklisiFiles
      if (group.files && group.files.length > 0) {
        data.prosklisiFiles = [...(data.prosklisiFiles || []), ...group.files];
      }
      
      safeWriteJSON(dataPath, data);
    }
    
    logAuditAction({
      type: 'delete',
      entityType: 'file_group',
      entityId: groupId,
      entityTitle: group.title || groupId,
      details: 'Διαγραφή ομάδας αρχείων πρόσκλησης'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting prosklisi group:', error);
    return { success: false, error: error.message };
  }
});

// Open file (generic handler for all document files - PDF, Word, etc.)
ipcMain.handle('open-pdf-file', async (event, filePath) => {
  try {
    console.log('🔍 open-pdf-file called with path:', filePath);
    
    // If file doesn't exist at exact path, try to find it
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ File not found at exact path, searching...');
      
      // Extract directory and filename from path
      const dir = path.dirname(filePath);
      const fileName = path.basename(filePath);
      
      console.log('📂 Searching in directory:', dir);
      console.log('📄 Looking for file:', fileName);
      
      // Check if directory exists
      if (!fs.existsSync(dir)) {
        console.error('❌ Directory does not exist:', dir);
        
        // Try to find the correct subprojectId by searching parent directory
        const parentDir = path.dirname(dir); // This should be the subproject folder
        const projectDir = path.dirname(parentDir); // This should be the project folder
        
        if (fs.existsSync(projectDir)) {
          console.log('🔍 Project directory exists, searching for correct subproject folder...');
          const projectItems = fs.readdirSync(projectDir);
          const subprojectDirs = projectItems.filter(item => {
            const itemPath = path.join(projectDir, item);
            try {
              return fs.statSync(itemPath).isDirectory();
            } catch {
              return false;
            }
          });
          
          console.log('📂 Found subproject directories:', subprojectDirs);
          
          // Try each subproject directory recursively
          for (const subprojectDir of subprojectDirs) {
            const testFilesDir = path.join(projectDir, subprojectDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
            if (!fs.existsSync(testFilesDir)) continue;
            
            // Search recursively in this subproject
            const searchInSubproject = (searchDir) => {
              try {
                const items = fs.readdirSync(searchDir);
                for (const item of items) {
                  const itemPath = path.join(searchDir, item);
                  try {
                    const stat = fs.statSync(itemPath);
                    if (stat.isDirectory()) {
                      const found = searchInSubproject(itemPath);
                      if (found) return found;
                    } else if (stat.isFile()) {
                      const normalizedItem = item.toLowerCase().trim();
                      const normalizedTarget = fileName.toLowerCase().trim();
                      
                      // Exact match
                      if (normalizedItem === normalizedTarget) {
                        console.log('✅ File found in alternative subproject directory:', itemPath);
                        return itemPath;
                      }
                      
                      // Partial match with same extension
                      const itemExt = path.extname(item).toLowerCase();
                      const targetExt = path.extname(fileName).toLowerCase();
                      if (itemExt && targetExt && itemExt === targetExt) {
                        if (normalizedItem.includes(normalizedTarget) || normalizedTarget.includes(normalizedItem)) {
                          console.log('✅ File found in alternative subproject directory (partial match):', itemPath);
                          return itemPath;
                        }
                      }
                    }
                  } catch (err) {
                    // Skip
                  }
                }
              } catch (err) {
                // Skip
              }
              return null;
            };
            
            const foundPath = searchInSubproject(testFilesDir);
            if (foundPath) {
              filePath = foundPath;
              dir = path.dirname(foundPath);
              break;
            }
          }
          
          if (!fs.existsSync(dir)) {
      throw new Error(`File not found: ${filePath}`);
    }
        } else {
          throw new Error(`File not found: ${filePath}`);
        }
      }
      
      // Search recursively in directory
      const searchFiles = (searchDir, basePath = '') => {
        const foundFiles = [];
        try {
          if (!fs.existsSync(searchDir)) {
            console.log('⚠️ Search directory does not exist:', searchDir);
            return foundFiles;
          }
          
          const items = fs.readdirSync(searchDir);
          console.log(`📂 Reading directory ${searchDir}, found ${items.length} items`);
          
          for (const item of items) {
            const itemPath = path.join(searchDir, item);
            const relativePath = basePath ? path.join(basePath, item) : item;
            
            try {
              const stat = fs.statSync(itemPath);
              if (stat.isDirectory()) {
                // Recursively search subdirectories
                foundFiles.push(...searchFiles(itemPath, relativePath));
              } else if (stat.isFile()) {
                foundFiles.push({ name: item, path: itemPath, relativePath });
              }
            } catch (err) {
              console.error('Error accessing item:', itemPath, err.message);
            }
          }
        } catch (err) {
          console.error('Error reading directory:', searchDir, err.message);
        }
        return foundFiles;
      };
      
      const allFiles = searchFiles(dir);
      console.log(`📁 Found ${allFiles.length} files in directory tree`);
      
      if (allFiles.length > 0) {
        console.log('📋 Sample files found:', allFiles.slice(0, 5).map(f => f.name));
      }
      
      // Try to find matching file
      const normalizedFileName = fileName.toLowerCase().trim();
      let foundFile = null;
      
      console.log('🔍 Looking for file:', fileName, '(normalized:', normalizedFileName, ')');
      
      // First try exact match
      for (const file of allFiles) {
        const normalizedFile = file.name.toLowerCase().trim();
        if (normalizedFile === normalizedFileName) {
          foundFile = file.path;
          console.log('✅ File found (exact match):', foundFile);
          break;
        }
      }
      
      // If not found, try partial match
      if (!foundFile) {
        const fileExt = path.extname(fileName).toLowerCase();
        console.log('🔍 Trying partial match with extension:', fileExt);
        
        for (const file of allFiles) {
          const normalizedFile = file.name.toLowerCase().trim();
          const foundExt = path.extname(file.name).toLowerCase();
          
          // Check if extensions match and names are similar
          if (fileExt && foundExt && fileExt === foundExt) {
            if (normalizedFile.includes(normalizedFileName) || normalizedFileName.includes(normalizedFile)) {
              foundFile = file.path;
              console.log('✅ File found (partial match):', foundFile);
              break;
            }
          }
        }
      }
      
      // If still not found, check data.json for original file paths
      if (!foundFile) {
        console.log('⚠️ File not found in filesystem, checking data.json for original paths...');
        const parentDir = path.dirname(dir); // subproject folder
        const projectDir = path.dirname(parentDir); // project folder
        const subprojectId = path.basename(parentDir);
        const projectId = path.basename(projectDir);
        
        const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
        if (fs.existsSync(dataPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            const fileGroups = data.fileGroups || [];
            
            console.log('🔍 Checking', fileGroups.length, 'file groups in data.json...');
            
            for (const group of fileGroups) {
              if (group.files && group.files.length > 0) {
                for (const file of group.files) {
                  const actualFileName = typeof file === 'string' ? file : (file.name || file.fileName);
                  const filePathFromData = typeof file === 'object' && file.path ? file.path : null;
                  
                  if (!actualFileName || !filePathFromData) continue;
                  
                  const normalizedActualFileName = actualFileName.toLowerCase().trim();
                  const normalizedTargetFileName = fileName.toLowerCase().trim();
                  
                  const matches = (
                    normalizedActualFileName === normalizedTargetFileName ||
                    normalizedActualFileName.includes(normalizedTargetFileName) ||
                    normalizedTargetFileName.includes(normalizedActualFileName)
                  );
                  
                  if (matches && fs.existsSync(filePathFromData)) {
                    foundFile = filePathFromData;
                    console.log('✅ File found at original path from data.json:', foundFile);
                    break;
                  }
                }
                if (foundFile) break;
              }
            }
          } catch (error) {
            console.error('Error reading data.json:', error);
          }
        }
      }
      
      // If still not found, try searching in ALL subprojects of the project
      if (!foundFile) {
        console.log('⚠️ File not found in current subproject, searching in all subprojects...');
        const parentDir = path.dirname(dir); // subproject folder
        const projectDir = path.dirname(parentDir); // project folder
        
        if (fs.existsSync(projectDir)) {
          const projectItems = fs.readdirSync(projectDir);
          const subprojectDirs = projectItems.filter(item => {
            const itemPath = path.join(projectDir, item);
            try {
              return fs.statSync(itemPath).isDirectory();
            } catch {
              return false;
            }
          });
          
          console.log(`📂 Searching in ${subprojectDirs.length} subproject directories...`);
          
          for (const subprojectDir of subprojectDirs) {
            const testFilesDir = path.join(projectDir, subprojectDir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
            if (!fs.existsSync(testFilesDir)) continue;
            
            const otherFiles = searchFiles(testFilesDir);
            console.log(`📁 Found ${otherFiles.length} files in subproject ${subprojectDir}`);
            
            for (const file of otherFiles) {
              const normalizedFile = file.name.toLowerCase().trim();
              
              if (normalizedFile === normalizedFileName) {
                foundFile = file.path;
                console.log(`✅ File found in subproject ${subprojectDir}:`, foundFile);
                break;
              }
              
              // Partial match
              const fileExt = path.extname(fileName).toLowerCase();
              const foundExt = path.extname(file.name).toLowerCase();
              if (fileExt && foundExt && fileExt === foundExt) {
                if (normalizedFile.includes(normalizedFileName) || normalizedFileName.includes(normalizedFile)) {
                  foundFile = file.path;
                  console.log(`✅ File found in subproject ${subprojectDir} (partial match):`, foundFile);
                  break;
                }
              }
            }
            
            if (foundFile) break;
          }
        }
      }
      
      if (foundFile) {
        filePath = foundFile;
      } else {
        console.error('❌ File not found after exhaustive search');
        console.log('📋 Available files in original directory:', allFiles.map(f => f.name).slice(0, 20));
        throw new Error(`File not found: ${filePath}`);
      }
    }

    console.log('✅ File exists, attempting to open:', filePath);
    console.log('File stats:', fs.statSync(filePath));
    
    return new Promise((resolve, reject) => {
      // Try with shell.openPath first (better for Greek characters)
      console.log('Trying with shell.openPath first...');
      shell.openPath(filePath).then(() => {
        console.log('PDF opened successfully with shell.openPath');
        resolve({ success: true });
      }).catch(openError => {
        console.error('Error opening PDF with shell.openPath:', openError);
        
        // Fallback: try with exec
        console.log('Trying fallback with exec...');
        exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error opening PDF with exec:', error);
            console.error('Error code:', error.code);
            console.error('Error signal:', error.signal);
            console.error('Error killed:', error.killed);
            console.error('Stdout:', stdout);
            console.error('Stderr:', stderr);
            reject(error);
          } else {
            console.log('PDF opened successfully with exec');
            console.log('Stdout:', stdout);
            console.log('Stderr:', stderr);
            resolve({ success: true });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error in open-pdf-file:', error);
    throw error;
  }
});

// View prosklisi file
ipcMain.handle('view-prosklisi-file', async (event, prosklisiId, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    let filePath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, fileName)
      : path.join(mainFilesDir, fileName);
    
    // If file not found in main directory, search in group folders
    if (!fs.existsSync(filePath) && targetFolder === 'attachments') {
      const attachmentItems = fs.readdirSync(attachmentsDir);
      const groupFolders = attachmentItems.filter(item => {
        const itemPath = path.join(attachmentsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      for (const groupFolder of groupFolders) {
        const groupFilePath = path.join(attachmentsDir, groupFolder, fileName);
        if (fs.existsSync(groupFilePath)) {
          filePath = groupFilePath;
          break;
        }
      }
    }
    
    if (fs.existsSync(filePath)) {
      // Use the generic PDF opener for all files
      return new Promise((resolve, reject) => {
        exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error opening file with exec:', error);
            shell.openPath(filePath).then(() => {
              resolve({ success: true });
            }).catch(openError => {
              reject(openError);
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } else {
      throw new Error('File not found: ' + filePath);
    }
  } catch (error) {
    console.error('Error viewing prosklisi file:', error);
    return { success: false, error: error.message };
  }
});

// Download prosklisi file
ipcMain.handle('download-prosklisi-file', async (event, prosklisiId, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    let sourceFilePath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, fileName)
      : path.join(mainFilesDir, fileName);
    
    // If file not found in main directory, search in group folders
    if (!fs.existsSync(sourceFilePath) && targetFolder === 'attachments') {
      const attachmentItems = fs.readdirSync(attachmentsDir);
      const groupFolders = attachmentItems.filter(item => {
        const itemPath = path.join(attachmentsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      for (const groupFolder of groupFolders) {
        const groupFilePath = path.join(attachmentsDir, groupFolder, fileName);
        if (fs.existsSync(groupFilePath)) {
          sourceFilePath = groupFilePath;
          break;
        }
      }
    }
    
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error('File not found');
    }
    
    const { dialog } = require('electron');
    const originalName = fileName.replace(/^prosklisi_\d+_[a-z0-9]+_/, '');
    
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: originalName,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(sourceFilePath, result.filePath);
      return { success: true };
    } else {
      return { success: false, error: 'Download cancelled' };
    }
  } catch (error) {
    console.error('Error downloading prosklisi file:', error);
    return { success: false, error: error.message };
  }
});

// Delete prosklisi file  
ipcMain.handle('delete-prosklisi-file', async (event, prosklisiId, fileName, targetFolder) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    let filePath = targetFolder === 'attachments' 
      ? path.join(attachmentsDir, fileName)
      : path.join(mainFilesDir, fileName);
    
    // If file not found in main directory, search in group folders
    if (!fs.existsSync(filePath) && targetFolder === 'attachments') {
      const attachmentItems = fs.readdirSync(attachmentsDir);
      const groupFolders = attachmentItems.filter(item => {
        const itemPath = path.join(attachmentsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      for (const groupFolder of groupFolders) {
        const groupFilePath = path.join(attachmentsDir, groupFolder, fileName);
        if (fs.existsSync(groupFilePath)) {
          filePath = groupFilePath;
          break;
        }
      }
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      
      // Ενημερώνουμε το data.json για να αφαιρέσουμε τις αναφορές στο αρχείο
      const dataPath = path.join(prosklisiDir, 'data.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // Αφαιρούμε από prosklisiFiles
        if (data.prosklisiFiles) {
          data.prosklisiFiles = data.prosklisiFiles.filter(file => file.fileName !== fileName);
        }
        
        // Αφαιρούμε από fileGroups
        if (data.fileGroups) {
          data.fileGroups.forEach(group => {
            if (group.files) {
              group.files = group.files.filter(file => file.fileName !== fileName);
            }
          });
          // Αφαιρούμε κενές ομάδες
          data.fileGroups = data.fileGroups.filter(group => group.files && group.files.length > 0);
        }
        
        // Αφαιρούμε από prosklisiFolders
        if (data.prosklisiFolders) {
          data.prosklisiFolders = data.prosklisiFolders.filter(folder => folder.folderName !== fileName);
        }
        
        safeWriteJSON(dataPath, data);
      }
      
      logAuditAction({
        type: 'delete',
        entityType: 'file',
        entityId: prosklisiId,
        entityTitle: fileName,
        details: 'Διαγραφή αρχείου πρόσκλησης'
      });
      return { success: true };
    } else {
      throw new Error('File not found');
    }
  } catch (error) {
    console.error('Error deleting prosklisi file:', error);
    return { success: false, error: error.message };
  }
});

// ============= ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ HANDLERS =============

// Scan folder structure for egkriseis
ipcMain.handle('scan-egkriseis-folder', async (event) => {
  try {
    const egkriseisDir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ');
    const folderStructure = {};
    
    if (!fs.existsSync(egkriseisDir)) {
      return { success: true, folderStructure: {} };
    }
    
    // Read all project folders
    const projectFolders = fs.readdirSync(egkriseisDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const projectFolder of projectFolders) {
      const projectPath = path.join(egkriseisDir, projectFolder);
      const pdfFiles = fs.readdirSync(projectPath)
        .filter(file => file.endsWith('.pdf'));
      
      folderStructure[projectFolder] = pdfFiles.map(fileName => {
        const dateMatch = fileName.match(/(\d{2}-\d{2}-\d{4})\.pdf/);
        return {
          fileName,
          date: dateMatch ? dateMatch[1] : null,
          fullPath: path.join(projectPath, fileName)
        };
      });
    }
    
    return { success: true, folderStructure };
  } catch (error) {
    console.error('Error scanning egkriseis folder:', error);
    return { success: false, error: error.message };
  }
});

// Load all egkriseis for a project
ipcMain.handle('load-project-egkriseis', async (event, projectId) => {
  try {
    const projectDir = path.join(dataDir, projectId);
    const egkriseis = [];
    
    if (!fs.existsSync(projectDir)) {
      return { success: true, egkriseis: [] };
    }
    
    // Read all subproject directories
    const subprojectDirs = fs.readdirSync(projectDir)
      .filter(dir => fs.statSync(path.join(projectDir, dir)).isDirectory());
    
    for (const subprojectId of subprojectDirs) {
      const dataPath = path.join(projectDir, subprojectId, 'data.json');
      
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        if (data.egkriseisDialthesisPistosis && data.egkriseisDialthesisPistosis.length > 0) {
          egkriseis.push({
            subprojectId,
            subprojectTitle: data.subprojectTitle,
            kaCode: data.kaCode,
            egkriseis: data.egkriseisDialthesisPistosis
          });
        }
      }
    }
    
    return { success: true, egkriseis };
  } catch (error) {
    console.error('Error loading project egkriseis:', error);
    return { success: false, error: error.message };
  }
});

// Save new egkrisi
ipcMain.handle('save-egkrisi', async (event, projectId, subprojectId, egkrisiData) => {
  try {
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    const egkriseisDir = path.join(dataDir, projectId, subprojectId, 'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ');
    
    // Create directory if not exists
    if (!fs.existsSync(egkriseisDir)) {
      fs.mkdirSync(egkriseisDir, { recursive: true });
    }
    
    // Read existing data
    let projectData = {};
    if (fs.existsSync(dataPath)) {
      projectData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    
    // Initialize egkriseis array if not exists
    if (!projectData.egkriseisDialthesisPistosis) {
      projectData.egkriseisDialthesisPistosis = [];
    }
    
    const isUpdate = projectData.egkriseisDialthesisPistosis.some(e => e.id === egkrisiData.id);

    if (isUpdate) {
      const idx = projectData.egkriseisDialthesisPistosis.findIndex(e => e.id === egkrisiData.id);
      const oldValue = projectData.egkriseisDialthesisPistosis[idx];
      projectData.egkriseisDialthesisPistosis[idx] = egkrisiData;
      
      // Save updated data
      safeWriteJSON(dataPath, projectData);

      logAuditAction({
        type: 'update',
        entityType: 'egkrisi',
        entityId: egkrisiData.id || subprojectId,
        entityTitle: egkrisiData.fileName || egkrisiData.title || '',
        details: 'Ενημέρωση έγκρισης διάθεσης πίστωσης',
        oldValue,
        newValue: egkrisiData
      });
    } else {
      // Add new egkrisi
      projectData.egkriseisDialthesisPistosis.push(egkrisiData);
      
      // Save updated data
      safeWriteJSON(dataPath, projectData);

      logAuditAction({
        type: 'create',
        entityType: 'egkrisi',
        entityId: egkrisiData.id || subprojectId,
        entityTitle: egkrisiData.fileName || egkrisiData.title || '',
        details: 'Δημιουργία νέας έγκρισης διάθεσης πίστωσης',
        newValue: egkrisiData
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving egkrisi:', error);
    return { success: false, error: error.message };
  }
});

// Import egkriseis from CSV
ipcMain.handle('import-egkriseis-csv', async (event, csvContent, projects) => {
  try {
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    // Parse CSV content (simplified - in production use a CSV parser library)
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',');
        if (values.length < 6) continue;
        
        const projectTitle = values[1].trim();
        const egkriseisPistosis = values[2].trim();
        const subprojectNumber = values[3].trim();
        const subprojectTitle = values[4].trim();
        const subprojectEgkriseis = values[5].trim();
        
        // Find matching project
        const matchingProject = projects.find(p => p.projectTitle === projectTitle);
        if (!matchingProject) {
          results.errors.push(`Project not found: ${projectTitle}`);
          results.skipped++;
          continue;
        }
        
        // Process egkriseis files
        const egkriseisFiles = [...egkriseisPistosis.split(' '), ...subprojectEgkriseis.split(' ')]
          .filter(f => f.endsWith('.pdf'))
          .map(fileName => {
            const dateMatch = fileName.match(/(\d{2})-(\d{2})-(\d{4})\.pdf/);
            return {
              id: require('uuid').v4(),
              fileName,
              date: dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null,
              type: 'imported',
              uploadDate: new Date().toISOString()
            };
          });
        
        // Save to appropriate subproject
        if (egkriseisFiles.length > 0) {
          // Implementation continues...
          results.imported++;
        }
        
      } catch (lineError) {
        results.errors.push(`Line ${i}: ${lineError.message}`);
      }
    }
    
    logAuditAction({
      type: 'create',
      entityType: 'egkrisi',
      entityId: 'csv-import',
      entityTitle: 'Εισαγωγή CSV εγκρίσεων',
      details: `Εισαγωγή εγκρίσεων από CSV: ${results.imported} εισήχθησαν, ${results.skipped} παραλείφθηκαν`,
      newValue: results
    });

    return { success: true, results };
  } catch (error) {
    console.error('Error importing CSV:', error);
    return { success: false, error: error.message };
  }
});

// Upload egkriseis PDFs
ipcMain.handle('upload-egkriseis-pdfs', async (event, files, mappings) => {
  try {
    const results = {
      uploaded: 0,
      errors: []
    };
    
    for (const file of files) {
      try {
        const mapping = mappings.find(m => m.fileName === file.name);
        if (!mapping) {
          results.errors.push(`No mapping found for ${file.name}`);
          continue;
        }
        
        const egkriseisDir = path.join(
          dataDir,
          mapping.projectId,
          mapping.subprojectId,
          'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ'
        );
        
        // Create directory if not exists
        if (!fs.existsSync(egkriseisDir)) {
          fs.mkdirSync(egkriseisDir, { recursive: true });
        }
        
        // Copy file
        const targetPath = path.join(egkriseisDir, file.name);
        fs.writeFileSync(targetPath, file.data);
        
        results.uploaded++;
      } catch (fileError) {
        results.errors.push(`${file.name}: ${fileError.message}`);
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Error uploading PDFs:', error);
    return { success: false, error: error.message };
  }
});

// View egkrisi file
ipcMain.handle('view-egkrisi-file', async (event, projectId, subprojectId, fileName) => {
  try {
    // Προσπαθούμε πολλαπλές τοποθεσίες
    const possiblePaths = [
      path.join(dataDir, projectId, subprojectId, 'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ', fileName),
      path.join(dataDir, projectId, subprojectId, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', fileName),
      path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', projectId, subprojectId, fileName)
    ];
    
    let filePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    if (filePath) {
      const { shell } = require('electron');
      await shell.openPath(filePath);
      return { success: true };
    } else {
      console.error('File not found in any location:', { projectId, subprojectId, fileName, possiblePaths });
      throw new Error(`Το αρχείο δεν βρέθηκε: ${fileName}`);
    }
  } catch (error) {
    console.error('Error viewing egkrisi file:', error);
    return { success: false, error: error.message };
  }
});

// Delete egkrisi file
ipcMain.handle('delete-egkrisi-file', async (event, projectId, subprojectId, egkrisiId) => {
  try {
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    
    if (fs.existsSync(dataPath)) {
      const projectData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      if (projectData.egkriseisDialthesisPistosis) {
        // Find the egkrisi to delete
        const egkrisiIndex = projectData.egkriseisDialthesisPistosis.findIndex(e => e.id === egkrisiId);
        
        if (egkrisiIndex !== -1) {
          const egkrisi = projectData.egkriseisDialthesisPistosis[egkrisiIndex];
          
          // Delete the PDF file
          const filePath = path.join(
            dataDir,
            projectId,
            subprojectId,
            'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ',
            egkrisi.fileName
          );
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          // Remove from array
          projectData.egkriseisDialthesisPistosis.splice(egkrisiIndex, 1);
          
          // Save updated data
          safeWriteJSON(dataPath, projectData);

          logAuditAction({
            type: 'delete',
            entityType: 'file',
            entityId: egkrisiId,
            entityTitle: egkrisi.fileName || '',
            details: 'Διαγραφή αρχείου έγκρισης',
            oldValue: egkrisi
          });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting egkrisi:', error);
    return { success: false, error: error.message };
  }
});

// Load organized egkriseis structure
ipcMain.handle('load-organized-egkriseis-structure', async () => {
  try {
    const organizedDir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ_ΟΡΓΑΝΩΜΕΝΕΣ_ΣΩΣΤΑ');

    if (!fs.existsSync(organizedDir)) {
      return { success: false, error: 'Organized structure directory not found' };
    }

    const structure = {};
    const projectFolders = fs.readdirSync(organizedDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const projectFolder of projectFolders) {
      const projectPath = path.join(organizedDir, projectFolder);
      const projectTitle = projectFolder; // This should be the original title

      // Get project-level PDFs
      const projectPdfs = fs.readdirSync(projectPath)
        .filter((file) => file.endsWith('.pdf'))
        .map((file) => file);

      // Get subprojects
      const subprojects = {};
      const subprojectFolders = fs.readdirSync(projectPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const subprojectFolder of subprojectFolders) {
        const subprojectPath = path.join(projectPath, subprojectFolder);
        const subprojectPdfs = fs.readdirSync(subprojectPath)
          .filter((file) => file.endsWith('.pdf'))
          .map((file) => file);

        subprojects[subprojectFolder] = {
          number: subprojectFolder.split('_')[0] || '1',
          pdfs: subprojectPdfs,
          directory: subprojectPath
        };
      }

      structure[projectTitle] = {
        projectId: projectFolder,
        projectPdfs,
        subprojects
      };
    }

    return { success: true, structure };
  } catch (error) {
    console.error('Error loading organized structure:', error);
    return { success: false, error: error.message };
  }
});

function resolveEgkrisiPdfPath(projectFolderName, pdfName, subFolderName = null) {
  const baseProjectPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', projectFolderName);

  const candidatePaths = [];

  if (subFolderName) {
    candidatePaths.push(path.join(baseProjectPath, subFolderName, 'pdf', pdfName));
    candidatePaths.push(path.join(baseProjectPath, subFolderName, pdfName));
  } else {
    candidatePaths.push(path.join(baseProjectPath, 'project_pdf', pdfName));
  }

  candidatePaths.push(path.join(baseProjectPath, pdfName));
  candidatePaths.push(path.join(baseProjectPath, 'pdf', pdfName));
  candidatePaths.push(path.join(baseProjectPath, 'project_pdf', pdfName));

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const projectWideMatch = fs
    .readdirSync(baseProjectPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));

  for (const folder of projectWideMatch) {
    const nestedPdfPath = path.join(baseProjectPath, folder, 'pdf', pdfName);
    if (fs.existsSync(nestedPdfPath)) {
      return nestedPdfPath;
    }

    const nestedDirectPath = path.join(baseProjectPath, folder, pdfName);
    if (fs.existsSync(nestedDirectPath)) {
      return nestedDirectPath;
    }
  }

  return null;
}

// Load egkriseis data from JSON
ipcMain.handle('load-egkriseis-data', async () => {
  try {
    const dataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');

    if (!fs.existsSync(dataPath)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { success: true, data };
  } catch (error) {
    console.error('Error loading egkriseis data:', error);
    return { success: false, error: error.message };
  }
});

// View egkriseis PDF
ipcMain.handle('view-egkriseis-pdf', async (event, projectFolderName, pdfName, subFolderName = null) => {
  try {
    const pdfPath = resolveEgkrisiPdfPath(projectFolderName, pdfName, subFolderName);

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return { success: false, error: 'PDF file not found' };
    }
    
    // Use the generic file opener for all files
    console.log('Attempting to open egkriseis PDF with exec:', pdfPath);
    return new Promise((resolve, reject) => {
      exec(`start "" "${pdfPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error opening egkriseis PDF with exec:', error);
          console.error('stderr:', stderr);
          // Fallback: try with shell.openPath
          shell.openPath(pdfPath).then(() => {
            resolve({ success: true });
          }).catch(openError => {
            console.error('Error opening egkriseis PDF with shell.openPath:', openError);
            reject(openError);
          });
        } else {
          console.log('Egkriseis PDF opened successfully with exec');
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Error viewing egkriseis PDF:', error);
    return { success: false, error: error.message };
  }
});

// Download egkriseis PDF
ipcMain.handle('download-egkriseis-pdf', async (event, projectFolderName, pdfName, subFolderName = null) => {
  try {
    const pdfPath = resolveEgkrisiPdfPath(projectFolderName, pdfName, subFolderName);

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return { success: false, error: 'PDF file not found' };
    }

    return { success: true, filePath: pdfPath };
  } catch (error) {
    console.error('Error downloading egkriseis PDF:', error);
    return { success: false, error: error.message };
  }
});

// Show save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(options);
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return { canceled: true };
  }
});

// Copy file
ipcMain.handle('copy-file', async (event, sourcePath, destinationPath) => {
  try {
    fs.copyFileSync(sourcePath, destinationPath);
    return { success: true };
  } catch (error) {
    console.error('Error copying file:', error);
    return { success: false, error: error.message };
  }
});

// Save egkriseis data - ASYNC VERSION (Non-blocking)
ipcMain.handle('save-egkriseis-data', async (event, saveData) => {
  try {
    const egkriseisDir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ');
    const dataDir_egkriseis = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ');
    const dataFile = path.join(dataDir_egkriseis, 'egkriseis-data.json');
    
    // Helper function για async exists check
    const pathExists = async (filePath) => {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    };
    
    // Create directories if they don't exist - ASYNC
    if (!(await pathExists(egkriseisDir))) {
      await fs.promises.mkdir(egkriseisDir, { recursive: true });
    }
    if (!(await pathExists(dataDir_egkriseis))) {
      await fs.promises.mkdir(dataDir_egkriseis, { recursive: true });
    }
    
    // Load existing data or create new structure - ASYNC
    let existingData = { projects: {}, metadata: { totalProjects: 0, totalSubprojects: 0 } };
    if (await pathExists(dataFile)) {
      const fileContent = await fs.promises.readFile(dataFile, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    
    // Helper function για sanitize folder names (αποφυγή μακριών paths και ειδικών χαρακτήρων)
    const sanitizeFolderName = (folderName) => {
      if (!folderName) return 'untitled';
      
      // Καθαρισμός ειδικών χαρακτήρων που δεν επιτρέπονται σε Windows paths
      let sanitized = folderName
        .replace(/[<>:"/\\|?*]/g, '') // Αφαίρεση ειδικών χαρακτήρων
        .replace(/\s+/g, ' ') // Αντικατάσταση πολλαπλών κενών με ένα
        .trim();
      
      // Περιορισμός μήκους σε 100 χαρακτήρες για να αποφύγουμε path length issues
      // (Windows έχει όριο ~260 χαρακτήρες, αλλά πρέπει να αφήσουμε χώρο για το base path)
      if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100).trim();
      }
      
      // Αν μετά τον καθαρισμό είναι κενό, χρησιμοποιούμε default
      if (!sanitized || sanitized.length === 0) {
        sanitized = 'untitled';
      }
      
      return sanitized;
    };
    
    // Determine project folder name and create project structure
    let projectFolderName;
    let projectData;
    
    if (saveData.projectType === 'new') {
      // Create new project
      const originalTitle = saveData.project.title;
      projectFolderName = sanitizeFolderName(originalTitle);
      
      // Αν το sanitized name είναι διαφορετικό, προσθέτουμε hash για μοναδικότητα
      if (projectFolderName !== originalTitle) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(originalTitle).digest('hex').substring(0, 8);
        projectFolderName = `${projectFolderName}_${hash}`;
      }
      
      projectData = {
        title: originalTitle, // Κρατάμε τον πλήρη τίτλο στα metadata
        number: (Object.keys(existingData.projects).length + 1).toString(),
        modifications: [],
        subprojects: {},
        folderName: projectFolderName, // Χρησιμοποιούμε το sanitized name για το folder
        actualPdfCount: 0
      };
    } else {
      // Use existing project
      const originalTitle = saveData.project.title;
      const existingFolderName = saveData.project.folderName;
      
      // Αν υπάρχει ήδη folderName, το χρησιμοποιούμε (για συμβατότητα)
      if (existingFolderName) {
        projectFolderName = existingFolderName;
      } else {
        // Αλλιώς δημιουργούμε νέο sanitized name
        projectFolderName = sanitizeFolderName(originalTitle);
        if (projectFolderName !== originalTitle) {
          const crypto = require('crypto');
          const hash = crypto.createHash('md5').update(originalTitle).digest('hex').substring(0, 8);
          projectFolderName = `${projectFolderName}_${hash}`;
        }
      }
      
      projectData = existingData.projects[projectFolderName] || {
        title: originalTitle,
        number: (Object.keys(existingData.projects).length + 1).toString(),
        modifications: [],
        subprojects: {},
        folderName: projectFolderName,
        actualPdfCount: 0
      };
      // Εξασφάλιση ότι το modifications array υπάρχει πάντα
      if (!projectData.modifications || !Array.isArray(projectData.modifications)) {
        projectData.modifications = [];
      }
    }
    
    // Create project directory - ASYNC
    const projectDir = path.join(egkriseisDir, projectFolderName);
    console.log('📁 Creating project directory:', projectDir);
    console.log('📏 Path length:', projectDir.length, 'characters');
    
    if (!(await pathExists(projectDir))) {
      try {
        await fs.promises.mkdir(projectDir, { recursive: true });
        console.log('✅ Project directory created successfully');
      } catch (mkdirError) {
        console.error('❌ Error creating project directory:', mkdirError);
        // Αν αποτύχει λόγω path length, δοκιμάζουμε με πιο σύντομο όνομα
        if (mkdirError.code === 'ENOENT' || mkdirError.message.includes('too long')) {
          const crypto = require('crypto');
          const shortHash = crypto.createHash('md5').update(saveData.project.title).digest('hex').substring(0, 16);
          const shortFolderName = `proj_${shortHash}`;
          projectFolderName = shortFolderName;
          projectData.folderName = shortFolderName;
          const shortProjectDir = path.join(egkriseisDir, shortFolderName);
          console.log('🔄 Retrying with shorter folder name:', shortProjectDir);
          await fs.promises.mkdir(shortProjectDir, { recursive: true });
          return { success: false, error: `Το όνομα φακέλου ήταν πολύ μακρύ. Χρησιμοποιήθηκε: ${shortFolderName}` };
        }
        throw mkdirError;
      }
    }
    
    // Handle project files (modifications) - ASYNC
    if (saveData.projectFiles && saveData.projectFiles.length > 0) {
      console.log('📁 Saving project files (modifications):', {
        projectFolderName: projectFolderName,
        filesCount: saveData.projectFiles.length,
        fileNames: saveData.projectFiles.map(f => f.name),
        existingModifications: projectData.modifications
      });
      
      for (const file of saveData.projectFiles) {
        const fileName = file.name;
        const filePath = path.join(projectDir, fileName);
        
        // Write file data to project directory - ASYNC
        const fileBuffer = Buffer.from(file.data);
        await fs.promises.writeFile(filePath, fileBuffer);
        
        // Add to modifications if not already present
        if (!projectData.modifications.includes(fileName)) {
          projectData.modifications.push(fileName);
          console.log('✅ Added modification:', fileName, 'Total modifications:', projectData.modifications.length);
        } else {
          console.log('⚠️ Modification already exists:', fileName);
        }
      }
      
      console.log('📋 Final modifications array:', projectData.modifications);
    }
    
    // Helper function to normalize subproject title for comparison
    const normalizeSubprojectTitle = (title) => {
      if (!title) return '';
      return title
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\r?\n/g, ' ') // Replace newlines with space
        .replace(/\t/g, ' ') // Replace tabs with space
        .toUpperCase();
    };
    
    // Helper function to find existing subproject by normalized title and number
    // ΠΡΩΤΑ: Ψάχνει με βάση τον τίτλο (που είναι πιο σταθερός)
    // ΔΕΥΤΕΡΟ: Αν βρεθεί, ελέγχει και τον αριθμό (για ακριβή ταίριασμα)
    const findExistingSubprojectKey = (subproject) => {
      const normalizedNumber = (subproject.number || '').toString().trim().toUpperCase();
      const normalizedTitle = normalizeSubprojectTitle(subproject.title);
      
      // ΠΡΩΤΑ: Ψάχνουμε με βάση τον τίτλο (που είναι πιο σταθερός από τον αριθμό)
      for (const [existingKey, existingSubproject] of Object.entries(projectData.subprojects)) {
        const existingTitle = normalizeSubprojectTitle(existingSubproject.title);
        
        // Αν ο τίτλος ταιριάζει, το key είναι σωστό (ακόμα και αν ο αριθμός έχει αλλάξει)
        if (existingTitle === normalizedTitle) {
          console.log(`  ✅ Found subproject by title: "${subproject.title}" -> key: ${existingKey}`);
          return existingKey;
        }
      }
      
      // ΔΕΥΤΕΡΟ: Αν δεν βρέθηκε με τίτλο, ψάχνουμε με αριθμό + τίτλο (για backward compatibility)
      for (const [existingKey, existingSubproject] of Object.entries(projectData.subprojects)) {
        const existingNumber = (existingSubproject.number || '').toString().trim().toUpperCase();
        const existingTitle = normalizeSubprojectTitle(existingSubproject.title);
        
        if (existingNumber === normalizedNumber && existingTitle === normalizedTitle) {
          console.log(`  ✅ Found subproject by number+title: "${subproject.title}" -> key: ${existingKey}`);
          return existingKey;
        }
      }
      
      return null;
    };
    
    // Handle subprojects
    let subprojectCount = 0;
    
    // Process selected existing subprojects
    if (saveData.selectedSubprojects && saveData.selectedSubprojects.length > 0) {
      console.log(`📋 Processing ${saveData.selectedSubprojects.length} selected subproject(s)`);
      for (const subproject of saveData.selectedSubprojects) {
        // ΠΡΩΤΑ: Αν το subproject έχει ήδη subprojectKey (από το frontend), το χρησιμοποιούμε
        // Αυτό είναι ΚΡΙΣΙΜΟ γιατί το key είναι το key από το egkriseis-data.json
        let subprojectKey = subproject.subprojectKey;
        
        // Αν δεν έχει subprojectKey, ψάχνουμε με findExistingSubprojectKey
        if (!subprojectKey) {
          subprojectKey = findExistingSubprojectKey(subproject);
        }
        
        // Αν ακόμα δεν βρέθηκε, ψάχνουμε με βάση τον τίτλο (όχι τον αριθμό, γιατί μπορεί να έχει αλλάξει)
        if (!subprojectKey) {
          const normalizedTitle = normalizeSubprojectTitle(subproject.title);
          for (const [existingKey, existingSubproject] of Object.entries(projectData.subprojects)) {
            const existingTitle = normalizeSubprojectTitle(existingSubproject.title);
            if (existingTitle === normalizedTitle) {
              subprojectKey = existingKey;
              console.log(`  🔍 Found subproject by title: "${subproject.title}" -> key: ${subprojectKey}`);
              break;
            }
          }
        }
        
        // Αν ακόμα δεν βρέθηκε, δημιουργούμε νέο key (χρησιμοποιώντας τον νέο αριθμό)
        if (!subprojectKey) {
          subprojectKey = `${subproject.number}_${subproject.title}`;
          // Sanitize το key για να είναι συμβατό με filesystem
          subprojectKey = subprojectKey.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);
        }
        
        console.log(`  🔍 Subproject: "${subproject.title}" -> key: ${subprojectKey} (from frontend: ${subproject.subprojectKey || 'N/A'})`);
        console.log(`  📝 Subproject number from frontend: "${subproject.number || 'N/A'}"`);
        
        if (!projectData.subprojects[subprojectKey]) {
          projectData.subprojects[subprojectKey] = {
            title: subproject.title,
            number: subproject.number,
            pdfs: []
          };
          console.log(`  ✅ Created new subproject entry for key: ${subprojectKey}`);
        } else {
          // Ενημέρωση του αριθμού αν έχει αλλάξει
          const oldNumber = projectData.subprojects[subprojectKey].number || '';
          const newNumber = (subproject.number || '').trim();
          
          // Ενημερώνουμε τον αριθμό αν έχει αλλάξει (ακόμα και αν είναι κενό string)
          if (newNumber !== oldNumber) {
            console.log(`  🔄 Updating subproject number for key "${subprojectKey}": "${oldNumber}" -> "${newNumber}"`);
            projectData.subprojects[subprojectKey].number = newNumber;
            // Ενημέρωση και του subprojectRawId αν υπάρχει
            if (projectData.subprojects[subprojectKey].subprojectRawId) {
              projectData.subprojects[subprojectKey].subprojectRawId = newNumber;
            }
            // Ενημέρωση και του subprojectId αν υπάρχει
            if (projectData.subprojects[subprojectKey].subprojectId) {
              // Κρατάμε το subprojectId, αλλά ενημερώνουμε τον αριθμό
              console.log(`  ℹ️ Keeping subprojectId: ${projectData.subprojects[subprojectKey].subprojectId}`);
            }
          } else {
            console.log(`  ✓ Subproject number unchanged for key "${subprojectKey}": "${oldNumber}"`);
          }
          // Ενημέρωση του τίτλου αν έχει αλλάξει
          if (subproject.title && subproject.title !== projectData.subprojects[subprojectKey].title) {
            console.log(`  🔄 Updating subproject title for key: ${subprojectKey}`);
            projectData.subprojects[subprojectKey].title = subproject.title;
          }
        }
        
        // Add subproject files if any - ASYNC
        // Τώρα τα αρχεία έχουν subprojectKey για να ξέρουμε σε ποιο υποέργο να τα προσθέσουμε
        if (saveData.subprojectFiles && saveData.subprojectFiles.length > 0) {
          console.log(`  📁 Processing ${saveData.subprojectFiles.length} file(s) for subproject ${subprojectKey}`);
          let filesAdded = 0;
          for (const file of saveData.subprojectFiles) {
            // Αν το αρχείο έχει subprojectKey, το προσθέτουμε μόνο στο συγκεκριμένο υποέργο
            if (file.subprojectKey && file.subprojectKey === subprojectKey) {
            const fileName = file.name;
            const filePath = path.join(projectDir, fileName);
              
              console.log(`    ✅ Adding file "${fileName}" to subproject ${subprojectKey}`);
            
            // Write file data to project directory - ASYNC
            const fileBuffer = Buffer.from(file.data);
            await fs.promises.writeFile(filePath, fileBuffer);
            
            // Add to subproject pdfs if not already present
            if (!projectData.subprojects[subprojectKey].pdfs.includes(fileName)) {
              projectData.subprojects[subprojectKey].pdfs.push(fileName);
                filesAdded++;
                console.log(`    ✅ File "${fileName}" added to subproject ${subprojectKey} PDFs array`);
              } else {
                console.log(`    ⚠️ File "${fileName}" already exists in subproject ${subprojectKey}`);
            }
            } else {
              console.log(`    ⏭️ Skipping file "${file.name}" - subprojectKey mismatch (file: ${file.subprojectKey}, target: ${subprojectKey})`);
          }
          }
          console.log(`  📊 Added ${filesAdded} file(s) to subproject ${subprojectKey}`);
        } else {
          console.log(`  ℹ️ No files to add for subproject ${subprojectKey}`);
        }
        
        subprojectCount++;
      }
    }
    
    // Process new subprojects
    if (saveData.newSubprojects && saveData.newSubprojects.length > 0) {
      for (const subproject of saveData.newSubprojects) {
        // ΠΡΩΤΑ: Αν το subproject έχει ήδη subprojectKey (από το frontend), το χρησιμοποιούμε
        let subprojectKey = subproject.subprojectKey;
        
        // Αν δεν έχει subprojectKey, ψάχνουμε με findExistingSubprojectKey
        if (!subprojectKey) {
          subprojectKey = findExistingSubprojectKey(subproject);
        }
        
        // Αν ακόμα δεν βρέθηκε, δημιουργούμε νέο key
        if (!subprojectKey) {
          subprojectKey = `${subproject.number}_${subproject.title}`;
        }
        
        // If subproject doesn't exist, create it
        if (!projectData.subprojects[subprojectKey]) {
          projectData.subprojects[subprojectKey] = {
            title: subproject.title,
            number: subproject.number,
            pdfs: []
          };
        }
        
        // Add subproject files if any - ASYNC
        // Τώρα τα αρχεία έχουν subprojectKey για να ξέρουμε σε ποιο υποέργο να τα προσθέσουμε
        if (saveData.subprojectFiles && saveData.subprojectFiles.length > 0) {
          for (const file of saveData.subprojectFiles) {
            // Αν το αρχείο έχει subprojectKey, το προσθέτουμε μόνο στο συγκεκριμένο υποέργο
            if (file.subprojectKey && file.subprojectKey === subprojectKey) {
            const fileName = file.name;
            const filePath = path.join(projectDir, fileName);
            
            // Write file data to project directory - ASYNC
            const fileBuffer = Buffer.from(file.data);
            await fs.promises.writeFile(filePath, fileBuffer);
            
            // Add to subproject pdfs if not already present
            if (!projectData.subprojects[subprojectKey].pdfs.includes(fileName)) {
              projectData.subprojects[subprojectKey].pdfs.push(fileName);
              }
            }
          }
        }
        
        subprojectCount++;
      }
    }
    
    // Update project data
    projectData.actualPdfCount = projectData.modifications.length + 
      Object.values(projectData.subprojects).reduce((total, sub) => total + sub.pdfs.length, 0);
    
    // Update existing data
    existingData.projects[projectFolderName] = projectData;
    existingData.metadata.totalProjects = Object.keys(existingData.projects).length;
    existingData.metadata.totalSubprojects = Object.values(existingData.projects)
      .reduce((total, project) => total + Object.keys(project.subprojects).length, 0);
    
    // Save updated data - ASYNC
    await safeWriteJSONAsync(dataFile, existingData);
    
    // Generate a unique egkrisi ID for linking
    const egkrisiId = `egkrisi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Δημιουργία links ΜΟΝΟ για τα επιλεγμένα υποέργα (όχι για όλα τα υποέργα του έργου)
    const linksDir = path.join(dataDir, 'egkriseis_links');
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
    }
    
    // Helper function για εύρεση projectId από τίτλο έργου
    const findProjectIdByTitle = (projectTitle) => {
      try {
        const normalizeText = (text) => {
          if (!text) return '';
          return text
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        };
        
        const normalizedSearchTitle = normalizeText(projectTitle);
        const projectDirs = fs.readdirSync(dataDir).map(dir => path.join(dataDir, dir)).filter(dir => {
          const stat = fs.statSync(dir);
          return stat.isDirectory() && 
                 dir !== path.join(dataDir, 'entaxeis') && 
                 dir !== path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ') && 
                 dir !== path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ') && 
                 dir !== path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ') && 
                 dir !== path.join(dataDir, 'egkriseis_links');
        });
        
        for (const projectDir of projectDirs) {
          if (!fs.existsSync(projectDir)) continue;
          
          const subprojectDirs = fs.readdirSync(projectDir);
          for (const subprojectDir of subprojectDirs) {
            const subprojectPath = path.join(projectDir, subprojectDir);
            if (!fs.statSync(subprojectPath).isDirectory()) continue;
            
            const dataJsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(dataJsonPath)) {
              try {
                const subprojectData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
                const normalizedProjectTitle = normalizeText(subprojectData.projectTitle || '');
                
                if (normalizedProjectTitle === normalizedSearchTitle) {
                  return subprojectData.projectId;
                }
              } catch (err) {
                // Skip invalid JSON files
              }
            }
          }
        }
        
        return null;
      } catch (error) {
        console.error('Error finding project by title:', error);
        return null;
      }
    };
    
    // Helper function για εύρεση subprojectId από τίτλο ΜΕΝΟΝΤΑΣ στο συγκεκριμένο έργο
    const findSubprojectIdByTitle = (subprojectTitle, projectId) => {
      try {
        if (!projectId) {
          console.error('❌ findSubprojectIdByTitle: projectId is REQUIRED! Cannot search in all projects.');
          return null;
        }
        
        // Ψάχνουμε ΜΟΝΟ στο συγκεκριμένο έργο
        const projectDir = path.join(dataDir, projectId);
        if (!fs.existsSync(projectDir)) {
          console.error(`❌ Project directory not found: ${projectDir}`);
          return null;
        }
        
        const normalizeText = (text) => {
          if (!text) return '';
          return text
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        };
        
        const normalizedSearchTitle = normalizeText(subprojectTitle);
        
        const subprojectDirs = fs.readdirSync(projectDir);
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectDir, subprojectDir);
          if (!fs.statSync(subprojectPath).isDirectory()) continue;
          
          const dataJsonPath = path.join(subprojectPath, 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            try {
              const subprojectData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
              const normalizedSubprojectTitle = normalizeText(subprojectData.subprojectTitle || '');
              
              if (normalizedSubprojectTitle === normalizedSearchTitle) {
                console.log(`✅ Found subproject: "${subprojectTitle}" -> ${subprojectData.subprojectId} in project ${projectId}`);
                return {
                  subprojectId: subprojectData.subprojectId,
                  projectId: subprojectData.projectId
                };
              }
            } catch (err) {
              // Skip invalid JSON files
            }
          }
        }
        
        console.log(`⚠️ Subproject not found: "${subprojectTitle}" in project ${projectId}`);
        return null;
      } catch (error) {
        console.error('Error finding subproject by title:', error);
        return null;
      }
    };
    
    // Βρίσκουμε το projectId από το επιλεγμένο έργο
    let targetProjectId = null;
    if (saveData.project && saveData.project.title) {
      targetProjectId = findProjectIdByTitle(saveData.project.title);
      console.log(`🔍 Looking for project: "${saveData.project.title}" -> ${targetProjectId}`);
    }
    
    if (!targetProjectId) {
      console.error('❌ Could not find projectId for project:', saveData.project?.title);
      console.error('⚠️ Cannot create links without projectId - skipping link creation');
      // Συνεχίζουμε χωρίς linking - δεν μπορούμε να βρούμε το projectId
    }
    
    // Helper function για εύρεση subprojectId από subprojectKey (από egkriseis-data.json)
    const findSubprojectIdByKey = (subprojectKey, projectFolderName) => {
      try {
        // Φορτώνουμε το egkriseis-data.json
        const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
        if (!fs.existsSync(egkriseisDataPath)) {
          console.log('❌ Egkriseis data file not found');
          return null;
        }
        
        const egkriseisData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
        const projects = egkriseisData.projects || {};
        
        // Βρίσκουμε το project
        const project = projects[projectFolderName];
        if (!project || !project.subprojects) {
          console.log(`❌ Project ${projectFolderName} not found in egkriseis-data.json`);
          return null;
        }
        
        // Βρίσκουμε το subproject από το key
        const subproject = project.subprojects[subprojectKey];
        if (!subproject) {
          console.log(`❌ Subproject ${subprojectKey} not found in project ${projectFolderName}`);
          return null;
        }
        
        // Τώρα πρέπει να βρούμε το subprojectId από το filesystem
        // Χρησιμοποιούμε τον αριθμό ΚΑΙ τον τίτλο για ακριβή ταίριασμα
        const normalizeText = (text) => {
          if (!text) return '';
          return text
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        };
        
        const normalizedNumber = (subproject.number || '').toString().trim().toUpperCase();
        const normalizedTitle = normalizeText(subproject.title);
        
        // Ψάχνουμε στο filesystem
        const projectDir = path.join(dataDir, targetProjectId);
        if (!fs.existsSync(projectDir)) {
          console.error(`❌ Project directory not found: ${projectDir}`);
          return null;
        }
        
        const subprojectDirs = fs.readdirSync(projectDir);
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectDir, subprojectDir);
          if (!fs.statSync(subprojectPath).isDirectory()) continue;
          
          const dataJsonPath = path.join(subprojectPath, 'data.json');
          if (fs.existsSync(dataJsonPath)) {
            try {
              const subprojectData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
              const existingNumber = (subprojectData.number || '').toString().trim().toUpperCase();
              const existingTitle = normalizeText(subprojectData.subprojectTitle || '');
              
              // Ελέγχουμε ΤΟΥΣ ΔΥΟ: αριθμό ΚΑΙ τίτλο
              if (existingNumber === normalizedNumber && existingTitle === normalizedTitle) {
                console.log(`✅ Found subproject by key+number+title: "${subproject.title}" (#${subproject.number}) -> ${subprojectData.subprojectId}`);
                return {
                  subprojectId: subprojectData.subprojectId,
                  projectId: subprojectData.projectId
                };
              }
            } catch (err) {
              // Skip invalid JSON files
            }
          }
        }
        
        console.log(`⚠️ Subproject not found by key+number+title: "${subproject.title}" (#${subproject.number})`);
        return null;
      } catch (error) {
        console.error('Error finding subprojectId by key:', error);
        return null;
      }
    };
    
    // Δημιουργία links για κάθε επιλεγμένο υποέργο
    const allSelectedSubprojects = [
      ...(saveData.selectedSubprojects || []),
      ...(saveData.newSubprojects || [])
    ];
    
    console.log(`📋 Creating links for ${allSelectedSubprojects.length} selected subproject(s) in project ${targetProjectId}`);
    
    for (const subproject of allSelectedSubprojects) {
      if (!subproject || !subproject.title) continue;
      
      if (!targetProjectId) {
        console.log(`⚠️ Skipping link creation for "${subproject.title}" - no projectId found`);
        continue;
      }
      
      // ΠΡΩΤΑ: Αν το subproject έχει subprojectKey (από το frontend), το χρησιμοποιούμε
      let subprojectInfo = null;
      if (subproject.subprojectKey && projectFolderName) {
        console.log(`  🔑 Using subprojectKey from frontend: ${subproject.subprojectKey}`);
        subprojectInfo = findSubprojectIdByKey(subproject.subprojectKey, projectFolderName);
        if (subprojectInfo) {
          console.log(`  ✅ Found subprojectId using key: ${subprojectInfo.subprojectId}`);
        } else {
          console.log(`  ⚠️ Could not find subprojectId using key, falling back to title search`);
        }
      }
      
      // Αν δεν βρέθηκε με key, ψάχνουμε με τίτλο
      if (!subprojectInfo) {
        subprojectInfo = findSubprojectIdByTitle(subproject.title, targetProjectId);
        if (subprojectInfo) {
          console.log(`  ✅ Found subprojectId using title: ${subprojectInfo.subprojectId}`);
        }
      }
      
      if (subprojectInfo && subprojectInfo.subprojectId) {
        // Δημιουργία μοναδικού ID για το link
        const crypto = require('crypto');
        const safeEgkrisiTitle = (subproject.title || '').trim();
        const safeEgkrisiProjectTitle = (projectData.title || '').trim();
        const combinedTitle = `${safeEgkrisiProjectTitle}_${safeEgkrisiTitle}`;
        const titleHash = crypto.createHash('md5').update(combinedTitle).digest('hex').substring(0, 8);
        
        const cleanTitle = safeEgkrisiTitle
          .replace(/\\n/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\t/g, ' ')
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .trim()
          .substring(0, 50);
        
        if (cleanTitle && cleanTitle.length > 0) {
          const linkEgkrisiId = `auto_egkrisi_${cleanTitle}_${titleHash}_${Date.now()}`;
          const linkFile = path.join(linksDir, `${linkEgkrisiId}.json`);
          
          // Έλεγχος αν υπάρχει ήδη link για αυτό το υποέργο
          let linkExists = false;
          const existingFiles = fs.readdirSync(linksDir);
          for (const file of existingFiles) {
            if (file.endsWith('.json')) {
              try {
                const existingLink = JSON.parse(fs.readFileSync(path.join(linksDir, file), 'utf8'));
                if (existingLink.subprojectId === subprojectInfo.subprojectId) {
                  linkExists = true;
                  break;
                }
              } catch (err) {
                // Skip invalid files
              }
            }
          }
          
          // Δημιουργία link μόνο αν δεν υπάρχει ήδη
          if (!linkExists) {
            const linkDataToSave = {
              egkrisiId: linkEgkrisiId,
              subprojectId: subprojectInfo.subprojectId,
              projectId: subprojectInfo.projectId,
              egkrisiTitle: subproject.title,
              subprojectTitle: subproject.title,
              egkrisiProjectKey: projectFolderName,
              egkrisiSubprojectKey: subproject.number || '',
              egkrisiProjectTitle: projectData.title,
              linkedAt: new Date().toISOString(),
              manual: false,
              autoLinked: true
            };
            
            safeWriteJSON(linkFile, linkDataToSave);
            console.log(`✅ Created auto link for subproject: ${subproject.title} (${subprojectInfo.subprojectId})`);
          } else {
            console.log(`⚠️ Link already exists for subproject: ${subproject.title} (${subprojectInfo.subprojectId})`);
          }
        }
      } else {
        console.log(`⚠️ Could not find subprojectId for: ${subproject.title}`);
      }
    }
    
    // ΕΠΕΞΕΡΓΑΣΙΑ ΤΩΝ editedSubprojectNumbers - Αυτό επιτρέπει την ενημέρωση αριθμών ακόμα και για υποέργα χωρίς τικ
    if (saveData.editedSubprojectNumbers && Object.keys(saveData.editedSubprojectNumbers).length > 0) {
      console.log(`📝 Processing ${Object.keys(saveData.editedSubprojectNumbers).length} edited subproject number(s)`);
      
      for (const [subprojectKey, newNumber] of Object.entries(saveData.editedSubprojectNumbers)) {
        // Βρίσκουμε το υποέργο με αυτό το key
        if (projectData.subprojects[subprojectKey]) {
          const oldNumber = (projectData.subprojects[subprojectKey].number || '').trim();
          const trimmedNewNumber = (newNumber || '').trim();
          
          if (trimmedNewNumber !== oldNumber) {
            console.log(`  🔄 Updating subproject number (from editedSubprojectNumbers) for key "${subprojectKey}": "${oldNumber}" -> "${trimmedNewNumber}"`);
            projectData.subprojects[subprojectKey].number = trimmedNewNumber;
            
            // Ενημέρωση και του subprojectRawId αν υπάρχει
            if (projectData.subprojects[subprojectKey].subprojectRawId) {
              projectData.subprojects[subprojectKey].subprojectRawId = trimmedNewNumber;
            }
          } else {
            console.log(`  ✓ Subproject number unchanged (from editedSubprojectNumbers) for key "${subprojectKey}": "${oldNumber}"`);
          }
        } else {
          console.log(`  ⚠️ Subproject with key "${subprojectKey}" not found in projectData.subprojects`);
        }
      }
    }
    
    // Ενημέρωση metadata
    existingData.metadata.totalProjects = Object.keys(existingData.projects).length;
    existingData.metadata.totalSubprojects = Object.values(existingData.projects)
      .reduce((total, project) => total + Object.keys(project.subprojects).length, 0);
    
    // Αποθήκευση των ενημερωμένων δεδομένων - ΚΡΙΣΙΜΟ: Αυτό πρέπει να γίνει ΜΕΤΑ από όλες τις ενημερώσεις
    // Ελέγχουμε αν υπάρχουν αλλαγές στους αριθμούς πριν την αποθήκευση
    const subprojectNumbers = Object.entries(projectData.subprojects).map(([key, sub]) => ({
      key,
      title: sub.title,
      number: sub.number
    }));
    console.log('📊 Final subproject numbers before save:', JSON.stringify(subprojectNumbers, null, 2));
    
    await safeWriteJSONAsync(dataFile, existingData);
    console.log('✅ Saved updated egkriseis-data.json with all subproject number changes');

    logAuditAction({
      type: 'update',
      entityType: 'egkrisi',
      entityId: egkrisiId || 'egkriseis-data',
      entityTitle: saveData.projectTitle || '',
      details: 'Αποθήκευση δεδομένων εγκρίσεων διάθεσης πίστωσης'
    });
    
    return { success: true, message: 'Egkriseis data saved successfully', egkrisiId };
  } catch (error) {
    console.error('Error saving egkriseis data:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για διαγραφή PDF από υποέργο (μόνο η συσχέτιση)
ipcMain.handle('delete-egkrisi-pdf-from-subproject', async (event, projectFolderName, subprojectKey, pdfFileName) => {
  try {
    console.log('🔗 Removing PDF link from subproject:', { projectFolderName, subprojectKey, pdfFileName });
    
    const dataDir_egkriseis = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ');
    const dataFile = path.join(dataDir_egkriseis, 'egkriseis-data.json');
    
    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }
    
    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    // Find the project
    if (!existingData.projects[projectFolderName]) {
      return { success: false, error: 'Project not found' };
    }
    
    const projectData = existingData.projects[projectFolderName];
    
    // Check if subproject exists
    if (!projectData.subprojects || !projectData.subprojects[subprojectKey]) {
      return { success: false, error: 'Subproject not found' };
    }
    
    const subproject = projectData.subprojects[subprojectKey];
    
    // Remove PDF from array (μόνο η συσχέτιση, όχι το αρχείο)
    if (subproject.pdfs && Array.isArray(subproject.pdfs)) {
      const pdfIndex = subproject.pdfs.indexOf(pdfFileName);
      if (pdfIndex !== -1) {
        subproject.pdfs.splice(pdfIndex, 1);
        console.log(`✅ Removed PDF ${pdfFileName} from subproject array (link only)`);
      } else {
        console.log(`⚠️ PDF ${pdfFileName} not found in subproject array`);
      }
    }
    
    // ΔΕΝ διαγράφουμε το φυσικό αρχείο - μόνο την συσχέτιση
    
    // Update actualPdfCount for the project
    projectData.actualPdfCount = projectData.modifications.length + 
      Object.values(projectData.subprojects).reduce((total, sub) => total + (sub.pdfs?.length || 0), 0);
    
    // Save updated data
    safeWriteJSON(dataFile, existingData);
    
    console.log(`✅ Removed PDF link ${pdfFileName} from subproject ${subprojectKey} in project ${projectFolderName}`);

    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: `${projectFolderName}/${subprojectKey}/${pdfFileName}`,
      entityTitle: pdfFileName,
      details: 'Αφαίρεση PDF από υποέργο'
    });
    
    return { success: true, message: 'PDF link removed successfully' };
  } catch (error) {
    console.error('Error removing PDF link from subproject:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για διαγραφή PDF εντελώς από όλα τα υποέργα
ipcMain.handle('delete-egkrisi-pdf-completely', async (event, projectFolderName, pdfFileName) => {
  try {
    console.log('🗑️ Deleting PDF completely:', { projectFolderName, pdfFileName });
    
    const dataDir_egkriseis = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ');
    const dataFile = path.join(dataDir_egkriseis, 'egkriseis-data.json');
    
    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }
    
    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    // Find the project
    if (!existingData.projects[projectFolderName]) {
      return { success: false, error: 'Project not found' };
    }
    
    const projectData = existingData.projects[projectFolderName];
    
    // Remove PDF from ALL subprojects in this project
    let removedCount = 0;
    if (projectData.subprojects) {
      Object.keys(projectData.subprojects).forEach(subprojectKey => {
        const subproject = projectData.subprojects[subprojectKey];
        if (subproject.pdfs && Array.isArray(subproject.pdfs)) {
          const pdfIndex = subproject.pdfs.indexOf(pdfFileName);
          if (pdfIndex !== -1) {
            subproject.pdfs.splice(pdfIndex, 1);
            removedCount++;
            console.log(`✅ Removed PDF ${pdfFileName} from subproject ${subprojectKey}`);
          }
        }
      });
    }
    
    // Delete the physical file
    const egkriseisDir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', projectFolderName);
    const pdfPath = path.join(egkriseisDir, pdfFileName);
    
    if (fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
        console.log('✅ Deleted PDF file:', pdfPath);
      } catch (fileError) {
        console.error('Error deleting PDF file:', fileError);
        // Συνεχίζουμε ακόμα και αν αποτύχει η διαγραφή του αρχείου
      }
    } else {
      console.log(`⚠️ PDF file not found at: ${pdfPath}`);
    }
    
    // Update actualPdfCount for the project
    projectData.actualPdfCount = projectData.modifications.length + 
      Object.values(projectData.subprojects).reduce((total, sub) => total + (sub.pdfs?.length || 0), 0);
    
    // Save updated data
    safeWriteJSON(dataFile, existingData);
    
    console.log(`✅ Deleted PDF ${pdfFileName} completely from project ${projectFolderName} (removed from ${removedCount} subprojects)`);

    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: `${projectFolderName}/${pdfFileName}`,
      entityTitle: pdfFileName,
      details: 'Πλήρης διαγραφή αρχείου PDF έγκρισης'
    });

    return { success: true, message: `PDF deleted completely (removed from ${removedCount} subprojects)` };
  } catch (error) {
    console.error('Error deleting PDF completely:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για διαγραφή υποέργου από egkriseis-data.json
ipcMain.handle('delete-egkrisi-subproject', async (event, projectFolderName, subprojectKey) => {
  try {
    const dataDir_egkriseis = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ');
    const dataFile = path.join(dataDir_egkriseis, 'egkriseis-data.json');
    
    if (!fs.existsSync(dataFile)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }
    
    // Load existing data
    const existingData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    // Find the project
    if (!existingData.projects[projectFolderName]) {
      return { success: false, error: 'Project not found' };
    }
    
    const projectData = existingData.projects[projectFolderName];
    
    // Check if subproject exists
    if (!projectData.subprojects || !projectData.subprojects[subprojectKey]) {
      return { success: false, error: 'Subproject not found' };
    }
    
    // Delete the subproject
    delete projectData.subprojects[subprojectKey];
    
    // Update metadata
    existingData.metadata.totalSubprojects = Object.values(existingData.projects)
      .reduce((total, project) => total + Object.keys(project.subprojects || {}).length, 0);
    
    // Update actualPdfCount for the project
    projectData.actualPdfCount = projectData.modifications.length + 
      Object.values(projectData.subprojects).reduce((total, sub) => total + sub.pdfs.length, 0);
    
    // Save updated data
    safeWriteJSON(dataFile, existingData);
    
    console.log(`✅ Deleted subproject ${subprojectKey} from project ${projectFolderName}`);
    
    if (deletedData) {
      logAuditAction({
        type: 'delete',
        entityType: 'egkrisi_subproject',
        entityId: subprojectKey,
        entityTitle: `${deletedData.projectTitle || projectFolderName} - ${deletedData.subprojectTitle || subprojectKey}`,
        details: 'Διαγραφή υποέργου από εγκρίσεις διάθεσης πίστωσης',
        oldValue: deletedData,
        newValue: null
      });
    }
    
    return { success: true, message: 'Subproject deleted successfully' };
  } catch (error) {
    console.error('Error deleting egkrisi subproject:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για φόρτωση τροποποιήσεων πρόσκλησης
ipcMain.handle('load-prosklisi-modifications', async (event, prosklisiId) => {
  try {
    const modificationsPath = path.join(proskliseisDir, prosklisiId, 'modifications.json');
    
    if (!fs.existsSync(modificationsPath)) {
      return [];
    }
    
    const data = fs.readFileSync(modificationsPath, 'utf8');
    const modifications = JSON.parse(data);
    
    return modifications || [];
  } catch (error) {
    console.error('Error loading prosklisi modifications:', error);
    return [];
  }
});

// IPC handler για αποθήκευση τροποποίησης πρόσκλησης
ipcMain.handle('save-prosklisi-modification', async (event, modificationData) => {
  try {
    const prosklisiId = modificationData.originalProsklisiId;
    const modificationsPath = path.join(proskliseisDir, prosklisiId, 'modifications.json');
    
    // Δημιουργία φακέλου αν δεν υπάρχει
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    if (!fs.existsSync(prosklisiDir)) {
      fs.mkdirSync(prosklisiDir, { recursive: true });
    }
    
    // Φόρτωση υπαρχουσών τροποποιήσεων
    let modifications = [];
    if (fs.existsSync(modificationsPath)) {
      const data = fs.readFileSync(modificationsPath, 'utf8');
      modifications = JSON.parse(data);
    }
    
    // Χειρισμός PDF αρχείου αν υπάρχει
    if (modificationData.modificationPDF && modificationData.modificationPDF.filePath) {
      try {
        const pdfDir = path.join(prosklisiDir, 'modification_files');
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        
        const pdfFileName = `modification_${modificationData.modificationId}.pdf`;
        const pdfDestination = path.join(pdfDir, pdfFileName);
        
        // Αντιγραφή PDF αρχείου
        fs.copyFileSync(modificationData.modificationPDF.filePath, pdfDestination);
        
        // Ενημέρωση του modificationData με το νέο path
        modificationData.modificationPDF = {
          fileName: modificationData.modificationPDF.fileName,
          filePath: pdfDestination,
          savedPath: pdfFileName
        };
      } catch (pdfError) {
        console.error('Error saving modification PDF:', pdfError);
        // Συνεχίζουμε χωρίς το PDF
        modificationData.modificationPDF = null;
      }
    }
    
    // Προσθήκη νέας τροποποίησης
    // Διασφάλιση ύπαρξης πεδίου ημερομηνίας εγγράφου
    if (!modificationData.modificationDocumentDate) {
      modificationData.modificationDocumentDate = modificationData.createdAt || new Date().toISOString();
    }
    modifications.push(modificationData);
    
    // Αποθήκευση
    safeWriteJSON(modificationsPath, modifications);
    
    console.log(`Saved modification for prosklisi ${prosklisiId}`);
    logAuditAction({
      type: 'create',
      entityType: 'prosklisi_modification',
      entityId: prosklisiId,
      entityTitle: modificationData.modificationTitle || `Τροποποίηση ${modifications.length}`,
      details: 'Προσθήκη τροποποίησης πρόσκλησης',
      newValue: modificationData
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving prosklisi modification:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για προβολή PDF τροποποίησης
ipcMain.handle('view-modification-pdf', async (event, prosklisiId, modificationId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const pdfPath = path.join(prosklisiDir, 'modification_files', `modification_${modificationId}.pdf`);
    
    if (!fs.existsSync(pdfPath)) {
      return { success: false, error: 'PDF file not found' };
    }
    
    // Άνοιγμα PDF με το default viewer
    shell.openPath(pdfPath);
    
    return { success: true, filePath: pdfPath };
  } catch (error) {
    console.error('Error viewing modification PDF:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για ενημέρωση τροποποίησης
ipcMain.handle('update-prosklisi-modification', async (event, modificationData) => {
  try {
    const { originalProsklisiId, modificationId } = modificationData;
    const prosklisiDir = path.join(proskliseisDir, originalProsklisiId);
    const modificationsPath = path.join(prosklisiDir, 'modifications.json');
    
    if (!fs.existsSync(modificationsPath)) {
      return { success: false, error: 'Modifications file not found' };
    }
    
    // Φόρτωση υπαρχουσών τροποποιήσεων
    let modifications = [];
    const data = fs.readFileSync(modificationsPath, 'utf8');
    modifications = JSON.parse(data);
    
    // Εύρεση και ενημέρωση της τροποποίησης
    const modificationIndex = modifications.findIndex(mod => mod.modificationId === modificationId);
    if (modificationIndex === -1) {
      return { success: false, error: 'Modification not found' };
    }
    
    // Χειρισμός PDF αρχείου αν υπάρχει
    if (modificationData.modificationPDF && modificationData.modificationPDF.filePath) {
      try {
        const pdfDir = path.join(prosklisiDir, 'modification_files');
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        
        const pdfFileName = `modification_${modificationId}.pdf`;
        const pdfDestination = path.join(pdfDir, pdfFileName);
        
        // Αντιγραφή PDF αρχείου
        fs.copyFileSync(modificationData.modificationPDF.filePath, pdfDestination);
        
        // Ενημέρωση του modificationData με το νέο path
        modificationData.modificationPDF = {
          fileName: modificationData.modificationPDF.fileName,
          filePath: pdfDestination,
          savedPath: pdfFileName
        };
      } catch (pdfError) {
        console.error('Error saving modification PDF:', pdfError);
        // Συνεχίζουμε χωρίς το PDF
        modificationData.modificationPDF = modifications[modificationIndex].modificationPDF;
      }
    }
    
    // Ενημέρωση της τροποποίησης
    if (!modificationData.modificationDocumentDate) {
      const existing = modifications[modificationIndex];
      modificationData.modificationDocumentDate = existing.modificationDocumentDate || existing.createdAt || new Date().toISOString();
    }
    modifications[modificationIndex] = modificationData;
    
    // Αποθήκευση
    safeWriteJSON(modificationsPath, modifications);
    
    console.log(`Updated modification ${modificationId} for prosklisi ${originalProsklisiId}`);
    logAuditAction({
      type: 'update',
      entityType: 'prosklisi_modification',
      entityId: modificationId,
      entityTitle: modificationData.modificationTitle || `Τροποποίηση πρόσκλησης`,
      details: 'Ενημέρωση τροποποίησης πρόσκλησης'
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating prosklisi modification:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για διαγραφή τροποποίησης
ipcMain.handle('delete-prosklisi-modification', async (event, prosklisiId, modificationId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const modificationsPath = path.join(prosklisiDir, 'modifications.json');
    
    if (!fs.existsSync(modificationsPath)) {
      return { success: false, error: 'Modifications file not found' };
    }
    
    // Φόρτωση υπαρχουσών τροποποιήσεων
    let modifications = [];
    const data = fs.readFileSync(modificationsPath, 'utf8');
    modifications = JSON.parse(data);
    
    // Εύρεση της τροποποίησης
    const modificationIndex = modifications.findIndex(mod => mod.modificationId === modificationId);
    if (modificationIndex === -1) {
      return { success: false, error: 'Modification not found' };
    }
    
    // Διαγραφή ολόκληρου φακέλου τροποποίησης
    const modification = modifications[modificationIndex];
    try {
      const modificationDir = path.join(prosklisiDir, 'modification_files');
      if (fs.existsSync(modificationDir)) {
        // Διαγραφή όλων των αρχείων στο φάκελο
        const files = fs.readdirSync(modificationDir);
        files.forEach(file => {
          const filePath = path.join(modificationDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        });
        
        // Διαγραφή του φακέλου αν είναι άδειος
        const remainingFiles = fs.readdirSync(modificationDir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(modificationDir);
        }
      }
    } catch (dirError) {
      console.error('Error deleting modification directory:', dirError);
      // Συνεχίζουμε με τη διαγραφή της τροποποίησης
    }
    
    // Διαγραφή της τροποποίησης
    modifications.splice(modificationIndex, 1);
    
    // Αποθήκευση ή διαγραφή του modifications.json
    if (modifications.length === 0) {
      // Διαγραφή του modifications.json αν δεν υπάρχουν τροποποιήσεις
      if (fs.existsSync(modificationsPath)) {
        fs.unlinkSync(modificationsPath);
        console.log('Deleted empty modifications.json file');
      }
    } else {
      // Αποθήκευση των υπαρχουσών τροποποιήσεων
      safeWriteJSON(modificationsPath, modifications);
    }
    
    console.log(`Deleted modification ${modificationId} for prosklisi ${prosklisiId}`);
    logAuditAction({
      type: 'delete',
      entityType: 'prosklisi_modification',
      entityId: modificationId,
      entityTitle: modification.modificationTitle || `Τροποποίηση πρόσκλησης`,
      details: 'Διαγραφή τροποποίησης πρόσκλησης',
      oldValue: modification,
      newValue: null
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting prosklisi modification:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για καθαρισμό διπλών αρχείων
ipcMain.handle('cleanup-duplicate-files', async (event, prosklisiId) => {
  try {
    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    
    if (!fs.existsSync(attachmentsDir)) {
      return { success: true, message: 'No attachments directory found' };
    }
    
    const files = fs.readdirSync(attachmentsDir);
    const fileMap = new Map();
    const duplicates = [];
    
    // Εύρεση διπλών αρχείων
    files.forEach(fileName => {
      if (fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Εξαγωγή του original name από το filename
        const parts = fileName.split('_');
        if (parts.length >= 4) {
          const originalName = parts.slice(3).join('_');
          if (fileMap.has(originalName)) {
            duplicates.push({
              originalName: originalName,
              files: [fileMap.get(originalName), fileName]
            });
          } else {
            fileMap.set(originalName, fileName);
          }
        }
      }
    });
    
    // Διαγραφή διπλών αρχείων (κρατάμε το πιο πρόσφατο)
    let deletedCount = 0;
    duplicates.forEach(duplicate => {
      const files = duplicate.files;
      // Κρατάμε το πιο πρόσφατο (μεγαλύτερο timestamp)
      const keepFile = files[0];
      const deleteFile = files[1];
      
      try {
        const deletePath = path.join(attachmentsDir, deleteFile);
        if (fs.existsSync(deletePath)) {
          fs.unlinkSync(deletePath);
          deletedCount++;
          console.log(`Deleted duplicate file: ${deleteFile}`);
        }
      } catch (error) {
        console.error(`Error deleting duplicate file ${deleteFile}:`, error);
      }
    });
    
    console.log(`Cleanup completed. Deleted ${deletedCount} duplicate files.`);
    return { 
      success: true, 
      deletedCount: deletedCount,
      duplicates: duplicates.length,
      message: `Deleted ${deletedCount} duplicate files out of ${duplicates.length} duplicates found`
    };
  } catch (error) {
    console.error('Error cleaning up duplicate files:', error);
    return { success: false, error: error.message };
  }
});

// Αυτόματη συσχέτιση αφαιρέθηκε - χρησιμοποιείται μόνο χειροκίνητη συσχέτιση

// IPC handler για εύρεση έργου με ίδιο τίτλο
ipcMain.handle('find-project-by-title', async (event, projectTitle) => {
  try {
    console.log('🔍 Looking for project by title:', projectTitle);
    
    const projectDirs = fs.readdirSync(dataDir);
    
    for (const projectDir of projectDirs) {
      // Skip special directories that are not projects
      if (projectDir === 'entaxeis' || projectDir === 'ΠΡΟΣΚΛΗΣΕΙΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ' || projectDir === 'egkriseis_links') {
        continue;
      }
      
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        // Ψάχνουμε σε όλα τα υποέργα του έργου για να βρούμε το projectTitle
        const subprojectDirs = fs.readdirSync(projectPath);
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectPath, subprojectDir);
          if (fs.statSync(subprojectPath).isDirectory()) {
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(jsonPath)) {
              const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              
              if (data.projectTitle) {
                const normalizedProjectTitle = normalizeProjectTitleForMatching(data.projectTitle);
                const normalizedSearchTitle = normalizeProjectTitleForMatching(projectTitle);

                if (normalizedProjectTitle === normalizedSearchTitle) {
                  console.log('✅ Found existing project with same title:', projectDir);
                  return {
                    projectId: projectDir,
                    projectTitle: data.projectTitle
                  };
                }
              }
            }
          }
        }
      }
    }
    
    console.log('❌ No existing project found with same title');
    return null;
  } catch (error) {
    console.error('Error finding project by title:', error);
    return null;
  }
});

// 🔗 ΧΕΙΡΟΚΙΝΗΤΗ ΣΥΣΧΕΤΙΣΗ ΕΓΚΡΙΣΗΣ ΜΕ ΥΠΟΕΡΓΟ
ipcMain.handle('create-manual-egkrisi-link', async (event, linkData) => {
  try {
    console.log('🔗 Creating manual egkrisi link:', linkData);
    
    const { 
      egkrisiProjectKey, 
      egkrisiSubprojectKey, 
      egkrisiTitle, 
      egkrisiProjectTitle,
      subprojectId, 
      projectId, 
      subprojectTitle, 
      manual = true 
    } = linkData;
    
    // Validation: Έλεγχος ότι έχουμε όλα τα απαραίτητα πεδία
    if (!egkrisiTitle || !egkrisiTitle.trim()) {
      console.error('❌ Missing egkrisiTitle:', egkrisiTitle);
      return { success: false, error: 'Ο τίτλος της έγκρισης είναι υποχρεωτικός' };
    }
    
    if (!egkrisiProjectTitle || !egkrisiProjectTitle.trim()) {
      console.error('❌ Missing egkrisiProjectTitle:', egkrisiProjectTitle);
      return { success: false, error: 'Ο τίτλος του έργου είναι υποχρεωτικός' };
    }
    
    if (!subprojectId) {
      console.error('❌ Missing subprojectId:', subprojectId);
      return { success: false, error: 'Το ID του υποέργου είναι υποχρεωτικό' };
    }
    
    if (!projectId) {
      console.error('❌ Missing projectId:', projectId);
      return { success: false, error: 'Το ID του έργου είναι υποχρεωτικό' };
    }
    
    // Δημιουργία φακέλου links αν δεν υπάρχει
    // Χρησιμοποιούμε το dataDir που έχει ήδη υπολογιστεί σωστά για development και portable mode
    const linksDir = path.join(dataDir, 'egkriseis_links');
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
      console.log('📁 Created egkriseis_links directory:', linksDir);
    }
    
    // Δημιουργία μοναδικού ID
    const crypto = require('crypto');
    const safeEgkrisiTitle = (egkrisiTitle || '').trim();
    const safeEgkrisiProjectTitle = (egkrisiProjectTitle || '').trim();
    const combinedTitle = `${safeEgkrisiProjectTitle}_${safeEgkrisiTitle}`;
    const titleHash = crypto.createHash('md5').update(combinedTitle).digest('hex').substring(0, 8);
    
    // Καθαρισμός του τίτλου για το filename - περιορίζουμε το μήκος
    const cleanTitle = safeEgkrisiTitle
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, 50); // Περιορίζουμε σε 50 χαρακτήρες
    
    if (!cleanTitle || cleanTitle.length === 0) {
      console.error('❌ Clean title is empty after processing:', safeEgkrisiTitle);
      return { success: false, error: 'Ο τίτλος της έγκρισης δεν μπορεί να είναι κενός' };
    }
    
    const egkrisiId = `manual_egkrisi_${cleanTitle}_${titleHash}`;
    const linkFile = path.join(linksDir, `${egkrisiId}.json`);
    
    // Έλεγχος αν υπάρχει ήδη συσχέτιση για αυτό το υποέργο
    const existingFiles = fs.readdirSync(linksDir);
    for (const file of existingFiles) {
      if (file.endsWith('.json')) {
        try {
          const existingLink = JSON.parse(fs.readFileSync(path.join(linksDir, file), 'utf8'));
          if (existingLink.subprojectId === subprojectId) {
            return { success: false, error: 'Το υποέργο έχει ήδη συσχετισμένη έγκριση' };
          }
        } catch (err) {
          // Skip invalid files
        }
      }
    }
    
    // Validation: Έλεγχος ότι το egkrisiSubprojectKey υπάρχει
    if (!egkrisiSubprojectKey || egkrisiSubprojectKey.trim() === '') {
      console.error('❌ Missing or empty egkrisiSubprojectKey:', egkrisiSubprojectKey);
      console.error('❌ Link data received:', linkData);
      return { success: false, error: 'Το κλειδί του υποέργου είναι υποχρεωτικό' };
    }
    
    // Δημιουργία δεδομένων συσχέτισης
    const linkDataToSave = {
      egkrisiId,
      subprojectId,
      projectId,
      egkrisiTitle,
      subprojectTitle,
      egkrisiProjectKey,
      egkrisiSubprojectKey: egkrisiSubprojectKey.trim(),
      egkrisiProjectTitle,
      linkedAt: new Date().toISOString(),
      manual: true,
      autoLinked: false
    };
    
    // Αποθήκευση
    safeWriteJSON(linkFile, linkDataToSave);
    
    console.log('✅ Manual egkrisi link created successfully:', linkFile);

    logAuditAction({
      type: 'create',
      entityType: 'egkrisi_link',
      entityId: egkrisiId,
      entityTitle: egkrisiTitle || '',
      details: 'Δημιουργία χειροκίνητης σύνδεσης έγκρισης',
      newValue: linkDataToSave
    });
    
    return { success: true, linkData: linkDataToSave };
    
  } catch (error) {
    console.error('Error creating manual egkrisi link:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για συσχέτιση εγκρίσεων με υποέργα
ipcMain.handle('link-egkrisi-to-subproject', async (event, { egkrisiId, subprojectId, projectId }) => {
  try {
    // Δημιουργία φακέλου για τις συσχετίσεις αν δεν υπάρχει
    const linksDir = path.join(dataDir, 'egkriseis_links');
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
    }

    // Αποθήκευση της συσχέτισης
    const linkData = {
      egkrisiId,
      subprojectId,
      projectId,
      linkedAt: new Date().toISOString()
    };

    const linkFile = path.join(linksDir, `${egkrisiId}.json`);
    safeWriteJSON(linkFile, linkData);

    console.log(`Linked egkrisi ${egkrisiId} to subproject ${subprojectId}`);
    return { success: true, data: linkData };
  } catch (error) {
    console.error('Error linking egkrisi to subproject:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για δημιουργία έγκρισης διαθέσεως πίστωσης
ipcMain.handle('create-credit-approval', async (event, { egkrisiId, subprojectId, projectId }) => {
  try {
    // Δημιουργία φακέλου για τις εγκρίσεις διαθέσεως πίστωσης
    const creditApprovalsDir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ');
    if (!fs.existsSync(creditApprovalsDir)) {
      fs.mkdirSync(creditApprovalsDir, { recursive: true });
    }

    // Δημιουργία μοναδικού ID για την έγκριση
    const approvalId = uuidv4();
    const approvalDir = path.join(creditApprovalsDir, approvalId);
    fs.mkdirSync(approvalDir, { recursive: true });

    // Δημιουργία φακέλου για τα αρχεία
    const filesDir = path.join(approvalDir, 'ΣΚΕΠΕΣ_ΑΞΙΩΣΕΩΝ');
    fs.mkdirSync(filesDir, { recursive: true });

    // Δημιουργία αρχείου δεδομένων
    const approvalData = {
      id: approvalId,
      egkrisiId,
      subprojectId,
      projectId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      files: []
    };

    const dataFile = path.join(approvalDir, 'data.json');
    safeWriteJSON(dataFile, approvalData);

    console.log(`Created credit approval ${approvalId} for egkrisi ${egkrisiId}`);
    return { success: true, data: approvalData };
  } catch (error) {
    console.error('Error creating credit approval:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για ενημέρωση τίτλου έργου στις Εγκρίσεις
ipcMain.handle('update-egkrisi-project-title', async (event, projectKey, newTitle) => {
  try {
    console.log('📝 Updating egkrisi project title:', { projectKey, newTitle });
    
    const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
    if (!fs.existsSync(egkriseisDataPath)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }
    
    const egkriseisData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
    const projects = egkriseisData.projects || {};
    
    if (!projects[projectKey]) {
      return { success: false, error: 'Project not found' };
    }
    
    const oldTitle = projects[projectKey].title;
    
    // Ενημέρωση τίτλου
    projects[projectKey].title = newTitle;
    
    // Αποθήκευση
    await safeWriteJSONAsync(egkriseisDataPath, egkriseisData);

    logAuditAction({
      type: 'update',
      entityType: 'egkrisi',
      entityId: projectKey,
      entityTitle: newTitle,
      details: 'Ενημέρωση τίτλου έργου εγκρίσεων',
      oldValue: { title: oldTitle },
      newValue: { title: newTitle }
    });
    
    console.log('✅ Updated egkrisi project title successfully');
    return { success: true };
  } catch (error) {
    console.error('Error updating egkrisi project title:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για ενημέρωση τίτλου υποέργου στις Εγκρίσεις
ipcMain.handle('update-egkrisi-subproject-title', async (event, projectKey, subprojectKey, newTitle) => {
  try {
    console.log('📝 Updating egkrisi subproject title:', { projectKey, subprojectKey, newTitle });
    
    const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
    if (!fs.existsSync(egkriseisDataPath)) {
      return { success: false, error: 'Egkriseis data file not found' };
    }
    
    const egkriseisData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
    const projects = egkriseisData.projects || {};
    
    if (!projects[projectKey]) {
      return { success: false, error: 'Project not found' };
    }
    
    const subprojects = projects[projectKey].subprojects || {};
    if (!subprojects[subprojectKey]) {
      return { success: false, error: 'Subproject not found' };
    }
    
    const oldTitle = subprojects[subprojectKey].title;
    
    // Ενημέρωση τίτλου
    subprojects[subprojectKey].title = newTitle;
    
    // Αποθήκευση
    await safeWriteJSONAsync(egkriseisDataPath, egkriseisData);

    logAuditAction({
      type: 'update',
      entityType: 'egkrisi',
      entityId: `${projectKey}/${subprojectKey}`,
      entityTitle: newTitle,
      details: 'Ενημέρωση τίτλου υποέργου εγκρίσεων',
      oldValue: { title: oldTitle },
      newValue: { title: newTitle }
    });
    
    console.log('✅ Updated egkrisi subproject title successfully');
    return { success: true };
  } catch (error) {
    console.error('Error updating egkrisi subproject title:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για εύρεση projectKey/subprojectKey από egkriseis-data.json με βάση subprojectId
ipcMain.handle('find-egkrisi-keys-by-subproject-id', async (event, subprojectId) => {
  try {
    console.log('🔍 Looking for egkrisi keys by subprojectId:', subprojectId);
    
    // Βρίσκουμε το projectId και subprojectTitle από την κεντρική σελίδα
    // Ψάχνουμε σε όλα τα έργα
    const projectDirs = fs.readdirSync(dataDir);
    let projectId = null;
    let subprojectTitle = null;
    
    for (const projectDir of projectDirs) {
      // Skip special directories
      if (projectDir === 'entaxeis' || projectDir === 'ΠΡΟΣΚΛΗΣΕΙΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ' || projectDir === 'egkriseis_links') {
        continue;
      }
      
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        const subprojectDirs = fs.readdirSync(projectPath);
        
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectPath, subprojectDir);
          if (fs.statSync(subprojectPath).isDirectory()) {
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(jsonPath)) {
              const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              if (data.subprojectId === subprojectId) {
                projectId = data.projectId;
                subprojectTitle = data.subprojectTitle;
                break;
              }
            }
          }
        }
        
        if (projectId && subprojectTitle) break;
      }
    }
    
    if (!projectId || !subprojectTitle) {
      console.log('❌ Project or subproject title not found for subprojectId:', subprojectId);
      return null;
    }
    
    // Φορτώνουμε το egkriseis-data.json
    const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
    if (!fs.existsSync(egkriseisDataPath)) {
      console.log('❌ Egkriseis data file not found');
      return null;
    }
    
    const egkriseisData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
    const projects = egkriseisData.projects || {};
    
    // Ψάχνουμε σε όλα τα projects
    for (const [projectKey, project] of Object.entries(projects)) {
      const subprojects = project.subprojects || {};
      
      // Ψάχνουμε σε όλα τα subprojects
      for (const [subprojectKey, subproject] of Object.entries(subprojects)) {
        // Σύγκριση με normalized text
        const normalizeText = (text) => {
          if (!text) return '';
          return text
            .replace(/\\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        };
        
        const normalizedSubprojectTitle = normalizeText(subproject.title);
        const normalizedSearchTitle = normalizeText(subprojectTitle);
        
        // Ελέγχουμε αν ταιριάζει ο τίτλος (μπορεί να έχει μικρές διαφορές)
        if (normalizedSubprojectTitle === normalizedSearchTitle || 
            normalizedSubprojectTitle.includes(normalizedSearchTitle.substring(0, 20)) ||
            normalizedSearchTitle.includes(normalizedSubprojectTitle.substring(0, 20))) {
          console.log('✅ Found egkrisi keys:', { projectKey, subprojectKey });
          return { projectKey, subprojectKey };
        }
      }
    }
    
    console.log('❌ Egkrisi keys not found for subprojectId:', subprojectId);
    return null;
  } catch (error) {
    console.error('Error finding egkrisi keys by subprojectId:', error);
    return null;
  }
});

// IPC handler για εύρεση subprojectId από τίτλο υποέργου (για χειροκίνητη συσχέτιση)
ipcMain.handle('find-subproject-by-title', async (event, { projectId, subprojectTitle }) => {
  try {
    console.log('🔍 Looking for subproject by title:', { projectId, subprojectTitle });
    
    // Αν δεν έχουμε projectId, ψάχνουμε σε όλα τα έργα
    if (!projectId) {
      return await findSubprojectInAllProjects(dataDir, subprojectTitle);
    }
    
    const projectPath = path.join(dataDir, projectId);
    if (!fs.existsSync(projectPath)) {
      console.log('Project directory not found:', projectPath);
      return null;
    }
    
    const subprojectDirs = fs.readdirSync(projectPath);
    
    for (const subprojectDir of subprojectDirs) {
      const subprojectPath = path.join(projectPath, subprojectDir);
      if (fs.statSync(subprojectPath).isDirectory()) {
        const jsonPath = path.join(subprojectPath, 'data.json');
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          // Ελέγχουμε αν το subproject έχει τον σωστό τίτλο
          if (data.subprojectId && data.subprojectTitle) {
            // Normalize και τα δύο τίτλους για σύγκριση
            const normalizeText = (text) => {
              if (!text) return '';
              return text
                .replace(/\\n/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            };
            
            const normalizedSubprojectTitle = normalizeText(data.subprojectTitle);
            const normalizedSearchTitle = normalizeText(subprojectTitle);
            
            if (normalizedSubprojectTitle === normalizedSearchTitle) {
              console.log('✅ Found subproject ID by title match:', data.subprojectId);
              return data.subprojectId;
            }
          }
        }
      }
    }
    
    console.log('❌ Subproject not found by title');
    return null;
  } catch (error) {
    console.error('Error finding subproject by title:', error);
    return null;
  }
});

// IPC handler για φόρτωση όλων των υποέργων
ipcMain.handle('get-all-subprojects', async () => {
  try {
    console.log('📋 Loading all subprojects...');
    
    const subprojects = [];
    const projectDirs = fs.readdirSync(dataDir);
    
    for (const projectDir of projectDirs) {
      // Skip special directories
      if (projectDir === 'entaxeis' || projectDir === 'ΠΡΟΣΚΛΗΣΕΙΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' || projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ' || projectDir === 'egkriseis_links') {
        continue;
      }
      
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        const subprojectDirs = fs.readdirSync(projectPath);
        
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectPath, subprojectDir);
          if (fs.statSync(subprojectPath).isDirectory()) {
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(jsonPath)) {
              try {
                const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                
                if (data.subprojectId && data.subprojectTitle && data.projectTitle) {
                  subprojects.push({
                    subprojectId: data.subprojectId,
                    subprojectTitle: data.subprojectTitle,
                    projectTitle: data.projectTitle,
                    projectId: data.projectId
                  });
                }
              } catch (error) {
                console.error('Error reading subproject data:', error);
              }
            }
          }
        }
      }
    }
    
    console.log(`📋 Loaded ${subprojects.length} subprojects`);
    return { success: true, data: subprojects };
  } catch (error) {
    console.error('Error loading all subprojects:', error);
    return { success: false, error: error.message };
  }
});

// Βοηθητική συνάρτηση για αναζήτηση σε όλα τα έργα
async function findSubprojectInAllProjects(dataDir, subprojectTitle) {
  try {
    console.log('🔍 Searching in all projects for:', subprojectTitle);
    
    const projectDirs = fs.readdirSync(dataDir);
    
    for (const projectDir of projectDirs) {
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        const subprojectDirs = fs.readdirSync(projectPath);
        
        for (const subprojectDir of subprojectDirs) {
          const subprojectPath = path.join(projectPath, subprojectDir);
          if (fs.statSync(subprojectPath).isDirectory()) {
            const jsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(jsonPath)) {
              const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
              
              if (data.subprojectId && data.subprojectTitle) {
                const normalizeText = (text) => {
                  if (!text) return '';
                  return text
                    .replace(/\\n/g, ' ')
                    .replace(/\n/g, ' ')
                    .replace(/\r/g, ' ')
                    .replace(/\t/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
                };
                
                const normalizedSubprojectTitle = normalizeText(data.subprojectTitle);
                const normalizedSearchTitle = normalizeText(subprojectTitle);
                
                if (normalizedSubprojectTitle === normalizedSearchTitle) {
                  console.log('✅ Found subproject ID in all projects:', data.subprojectId);
                  return data.subprojectId;
                }
              }
            }
          }
        }
      }
    }
    
    console.log('❌ Subproject not found in any project');
    return null;
  } catch (error) {
    console.error('Error searching in all projects:', error);
    return null;
  }
}

// IPC handler για εύρεση projectId από subprojectId
ipcMain.handle('find-project-by-subproject-id', async (event, subprojectId) => {
  try {
    console.log('🔍 Looking for project by subproject ID:', subprojectId);
    
    const projectDirs = fs.readdirSync(dataDir);
    
    for (const projectDir of projectDirs) {
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        const subprojectDirs = fs.readdirSync(projectPath);
        
        for (const subprojectDir of subprojectDirs) {
          if (subprojectDir === subprojectId) {
            console.log('✅ Found project ID:', projectDir);
            return projectDir;
          }
        }
      }
    }
    
    console.log('❌ Project not found for subproject ID:', subprojectId);
    return null;
  } catch (error) {
    console.error('Error finding project by subproject ID:', error);
    return null;
  }
});

// IPC handler για εύρεση subprojectId από subproject number
ipcMain.handle('get-subproject-id-by-number', async (event, { projectId, subprojectNumber }) => {
  try {
    console.log('🔍 Looking for subproject ID by number:', { projectId, subprojectNumber });
    
    const projectPath = path.join(dataDir, projectId);
    if (!fs.existsSync(projectPath)) {
      console.log('Project directory not found:', projectPath);
      return null;
    }
    
    const subprojectDirs = fs.readdirSync(projectPath);
    
    for (const subprojectDir of subprojectDirs) {
      const subprojectPath = path.join(projectPath, subprojectDir);
      if (fs.statSync(subprojectPath).isDirectory()) {
        const jsonPath = path.join(subprojectPath, 'data.json');
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          // Ελέγχουμε αν το subproject έχει το σωστό number
          // Το number μπορεί να είναι στο data.json ή να υπολογίζεται από τον τίτλο
          if (data.subprojectId && data.subprojectTitle) {
            // Αν υπάρχει number στο data.json, χρησιμοποιούμε αυτό
            if (data.number && data.number === subprojectNumber) {
              console.log('✅ Found subproject ID by number:', data.subprojectId);
              return data.subprojectId;
            }
            // Αν δεν υπάρχει number, ψάχνουμε με βάση τον τίτλο
            // (για παλιά δεδομένα που μπορεί να μην έχουν number)
            if (!data.number && subprojectNumber === '1') {
              console.log('✅ Found subproject ID by title match (no number field):', data.subprojectId);
              return data.subprojectId;
            }
          }
        }
      }
    }
    
    console.log('❌ Subproject not found');
    return null;
  } catch (error) {
    console.error('Error finding subproject ID:', error);
    return null;
  }
});

// IPC handler για διαγραφή συσχέτισης εγκρίσεων
ipcMain.handle('delete-egkrisi-link', async (event, egkrisiId) => {
  try {
    console.log('Deleting egkrisi link:', egkrisiId);
    const linksDir = path.join(dataDir, 'egkriseis_links');
    const linkFilePath = path.join(linksDir, `${egkrisiId}.json`);
    
    if (!fs.existsSync(linkFilePath)) {
      console.log('Link file not found:', linkFilePath);
      return { success: false, error: 'Link file not found' };
    }
    
    const oldLinkData = JSON.parse(fs.readFileSync(linkFilePath, 'utf8'));

    // Διαγράφουμε το αρχείο
    fs.unlinkSync(linkFilePath);
    console.log('Link file deleted successfully:', linkFilePath);

    logAuditAction({
      type: 'delete',
      entityType: 'egkrisi_link',
      entityId: egkrisiId,
      entityTitle: oldLinkData.egkrisiTitle || '',
      details: 'Διαγραφή σύνδεσης έγκρισης',
      oldValue: oldLinkData
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting egkrisi link:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για φόρτωση συσχετίσεων εγκρίσεων
ipcMain.handle('load-subproject-links', async (event) => {
  try {
    const linksDir = path.join(dataDir, 'subproject_links');
    
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
      return { success: true, data: {} };
    }

    const links = {};
    const files = fs.readdirSync(linksDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(linksDir, file);
          const linkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const linkId = `${linkData.sourceSubprojectId}_${linkData.targetSubprojectId}`;
          links[linkId] = linkData;
        } catch (error) {
          console.error(`Error reading subproject link file ${file}:`, error);
        }
      }
    }

    return { success: true, data: links };
  } catch (error) {
    console.error('Error loading subproject links:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-egkrisi-links', async (event) => {
  try {
    console.log('Loading egkrisi links...');
    const linksDir = path.join(dataDir, 'egkriseis_links');
    console.log('Links directory:', linksDir);
    
    if (!fs.existsSync(linksDir)) {
      console.log('Links directory does not exist, creating it and returning empty data');
      fs.mkdirSync(linksDir, { recursive: true });
      return { success: true, data: {} };
    }

    const links = {};
    const files = fs.readdirSync(linksDir);
    console.log('Found link files:', files);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(linksDir, file);
          const linkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log(`Loaded link file ${file}:`, linkData);
          links[linkData.egkrisiId] = linkData;
        } catch (error) {
          console.error(`Error reading link file ${file}:`, error);
        }
      }
    }

    console.log('Final links object:', links);
    return { success: true, data: links };
  } catch (error) {
    console.error('Error loading egkrisi links:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για εύρεση και καθαρισμό λάθος links
ipcMain.handle('validate-and-clean-egkrisi-links', async (event) => {
  try {
    console.log('🔍 Validating and cleaning egkrisi links...');
    const linksDir = path.join(dataDir, 'egkriseis_links');
    
    if (!fs.existsSync(linksDir)) {
      return { success: true, cleaned: 0, invalid: [] };
    }
    
    const files = fs.readdirSync(linksDir);
    const invalidLinks = [];
    let cleanedCount = 0;
    
    // Helper function για εύρεση subprojectId από filesystem
    const findSubprojectIdInFilesystem = (subprojectId) => {
      try {
        const projectDirs = fs.readdirSync(dataDir);
        for (const projectDir of projectDirs) {
          if (projectDir === 'entaxeis' || projectDir === 'ΠΡΟΣΚΛΗΣΕΙΣ' || 
              projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' || 
              projectDir === 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ' || 
              projectDir === 'egkriseis_links') {
            continue;
          }
          
          const projectPath = path.join(dataDir, projectDir);
          if (!fs.statSync(projectPath).isDirectory()) continue;
          
          const subprojectDirs = fs.readdirSync(projectPath);
          for (const subprojectDir of subprojectDirs) {
            const subprojectPath = path.join(projectPath, subprojectDir);
            if (!fs.statSync(subprojectPath).isDirectory()) continue;
            
            const dataJsonPath = path.join(subprojectPath, 'data.json');
            if (fs.existsSync(dataJsonPath)) {
              try {
                const subprojectData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
                if (subprojectData.subprojectId === subprojectId) {
                  return {
                    found: true,
                    subprojectId: subprojectData.subprojectId,
                    subprojectTitle: subprojectData.subprojectTitle,
                    projectId: subprojectData.projectId
                  };
                }
              } catch (err) {
                // Skip invalid JSON files
              }
            }
          }
        }
        return { found: false };
      } catch (error) {
        console.error('Error finding subproject in filesystem:', error);
        return { found: false };
      }
    };
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(linksDir, file);
          const linkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Ελέγχουμε αν το subprojectId υπάρχει στο filesystem
          const subprojectInfo = findSubprojectIdInFilesystem(linkData.subprojectId);
          
          if (!subprojectInfo.found) {
            // Το link είναι λάθος - το subprojectId δεν υπάρχει
            console.log(`❌ Invalid link found: ${file} - subprojectId ${linkData.subprojectId} not found in filesystem`);
            invalidLinks.push({
              file: file,
              egkrisiId: linkData.egkrisiId,
              subprojectId: linkData.subprojectId,
              subprojectTitle: linkData.subprojectTitle || linkData.egkrisiTitle,
              reason: 'SubprojectId not found in filesystem'
            });
            
            // Διαγραφή του λάθος link
            fs.unlinkSync(filePath);
            cleanedCount++;
            console.log(`✅ Deleted invalid link: ${file}`);
          } else {
            // Ελέγχουμε αν το subprojectTitle ταιριάζει
            const normalizeText = (text) => {
              if (!text) return '';
              return text
                .replace(/\\n/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
            };
            
            const linkTitle = normalizeText(linkData.subprojectTitle || linkData.egkrisiTitle || '');
            const actualTitle = normalizeText(subprojectInfo.subprojectTitle || '');
            
            // Αν οι τίτλοι είναι εντελώς διαφορετικοί (δεν έχουν κοινά τμήματα), το link είναι λάθος
            // Χρησιμοποιούμε 30 χαρακτήρες για πιο ακριβή έλεγχο
            const titleMatch = linkTitle === actualTitle || 
                              linkTitle.includes(actualTitle.substring(0, 30)) || 
                              actualTitle.includes(linkTitle.substring(0, 30));
            
            if (!titleMatch) {
              console.log(`❌ Invalid link found: ${file} - title mismatch`);
              console.log(`   Link title: "${linkData.subprojectTitle || linkData.egkrisiTitle}"`);
              console.log(`   Actual title: "${subprojectInfo.subprojectTitle}"`);
              console.log(`   SubprojectId: ${linkData.subprojectId}`);
              
              invalidLinks.push({
                file: file,
                egkrisiId: linkData.egkrisiId,
                subprojectId: linkData.subprojectId,
                subprojectTitle: linkData.subprojectTitle || linkData.egkrisiTitle,
                actualSubprojectTitle: subprojectInfo.subprojectTitle,
                reason: 'Title mismatch - link points to wrong subproject'
              });
              
              // Διαγραφή του λάθος link
              fs.unlinkSync(filePath);
              cleanedCount++;
              console.log(`✅ Deleted invalid link: ${file}`);
            } else {
              // Επιπλέον έλεγχος: Αν το link έχει διαφορετικό projectId από το actual, είναι λάθος
              if (linkData.projectId && subprojectInfo.projectId && 
                  linkData.projectId !== subprojectInfo.projectId) {
                console.log(`❌ Invalid link found: ${file} - projectId mismatch`);
                console.log(`   Link projectId: "${linkData.projectId}"`);
                console.log(`   Actual projectId: "${subprojectInfo.projectId}"`);
                
                invalidLinks.push({
                  file: file,
                  egkrisiId: linkData.egkrisiId,
                  subprojectId: linkData.subprojectId,
                  subprojectTitle: linkData.subprojectTitle || linkData.egkrisiTitle,
                  actualSubprojectTitle: subprojectInfo.subprojectTitle,
                  reason: 'ProjectId mismatch - link points to wrong project'
                });
                
                // Διαγραφή του λάθος link
                fs.unlinkSync(filePath);
                cleanedCount++;
                console.log(`✅ Deleted invalid link: ${file}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing link file ${file}:`, error);
        }
      }
    }
    
    console.log(`✅ Validation complete: ${cleanedCount} invalid link(s) deleted`);
    return { 
      success: true, 
      cleaned: cleanedCount, 
      invalid: invalidLinks 
    };
  } catch (error) {
    console.error('Error validating and cleaning egkrisi links:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler για συσχέτιση υποέργων με υποέργα
ipcMain.handle('link-subproject-to-subproject', async (event, { sourceSubprojectId, sourceProjectId, targetSubprojectId, targetProjectId }) => {
  try {
    // Δημιουργία φακέλου για τις συσχετίσεις υποέργων αν δεν υπάρχει
    const linksDir = path.join(dataDir, 'subproject_links');
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
    }

    // Αποθήκευση της συσχέτισης
    const linkData = {
      sourceSubprojectId,
      sourceProjectId,
      targetSubprojectId,
      targetProjectId,
      linkedAt: new Date().toISOString()
    };

    const linkFile = path.join(linksDir, `${sourceSubprojectId}_${sourceProjectId}.json`);
    safeWriteJSON(linkFile, linkData);

    console.log(`Linked subproject ${sourceSubprojectId} to subproject ${targetSubprojectId}`);
    return { success: true, data: linkData };
  } catch (error) {
    console.error('Error linking subproject to subproject:', error);
    return { success: false, error: error.message };
  }
});

// Application locale is handled by the system

// IPC handler για καθαρισμό temp files
ipcMain.handle('cleanup-temp-files', async () => {
  try {
    await cleanupOldTempFiles();
    return { success: true, message: 'Temp files cleaned successfully' };
  } catch (error) {
    console.error('Error cleaning temp files:', error);
    return { success: false, error: error.message };
  }
});

// ========================
// ΕΓΚΡΙΣΕΙΣ V2 - ΝΕΟ ΣΥΣΤΗΜΑ
// ========================

// Load unlinked egkriseis from archive
ipcMain.handle('load-unlinked-egkriseis', async () => {
  try {
    const archiveDir = path.join(dataDir, 'ARCHIVE_EGKRISEIS');
    const unlinkedPath = path.join(archiveDir, 'unlinked_egkriseis.json');
    
    if (!fs.existsSync(unlinkedPath)) {
      return [];
    }
    
    const data = fs.readFileSync(unlinkedPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading unlinked egkriseis:', error);
    return [];
  }
});

// Load all real subprojects for linking
ipcMain.handle('load-all-subprojects', async () => {
  try {
    const subprojects = [];
    
    // Διαβάζω όλους τους φακέλους projects (UUIDs)
    const projectDirs = fs.readdirSync(dataDir).filter(f => {
      const fullPath = path.join(dataDir, f);
      return fs.statSync(fullPath).isDirectory() && 
             f.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
    
    for (const projectDir of projectDirs) {
      const projectPath = path.join(dataDir, projectDir);
      
      // Διαβάζω όλους τους υποφακέλους subprojects (UUIDs)
      const subprojectDirs = fs.readdirSync(projectPath).filter(f => {
        const fullPath = path.join(projectPath, f);
        return fs.statSync(fullPath).isDirectory() && 
               f.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      });
      
      for (const subprojectDir of subprojectDirs) {
        const dataPath = path.join(projectPath, subprojectDir, 'data.json');
        
        if (fs.existsSync(dataPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            subprojects.push({
              projectId: projectDir,
              subprojectId: subprojectDir,
              projectTitle: data.projectTitle || '',
              subprojectTitle: data.subprojectTitle || '',
              kaCode: data.kaCode || null
            });
          } catch (error) {
            console.error(`Error reading ${dataPath}:`, error);
          }
        }
      }
    }
    
    return subprojects;
  } catch (error) {
    console.error('Error loading all subprojects:', error);
    return [];
  }
});

// Manually link an egkrisi to a subproject
ipcMain.handle('link-egkrisi-manual', async (event, linkData) => {
  try {
    const { 
      egkrisiProjectTitle, 
      egkrisiSubprojectTitle, 
      egkrisiSubprojectNumber,
      linkedProjectId, 
      linkedSubprojectId 
    } = linkData;
    
    // Load archive metadata
    const archiveDir = path.join(dataDir, 'ARCHIVE_EGKRISEIS');
    const metadataPath = path.join(archiveDir, 'archive_metadata.json');
    const archiveData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Find the egkrisi in archive
    const project = archiveData.projects.find(p => p.egkrisiProjectTitle === egkrisiProjectTitle);
    if (!project) {
      throw new Error('Project not found in archive');
    }
    
    const subproject = project.subprojects.find(sp => 
      sp.egkrisiSubprojectNumber === egkrisiSubprojectNumber &&
      sp.egkrisiSubprojectTitle === egkrisiSubprojectTitle
    );
    
    if (!subproject) {
      throw new Error('Subproject not found in archive');
    }
    
    // Create new structure if not exists
    const newEgkriseisDir = path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS');
    const projectDir = path.join(newEgkriseisDir, 'projects', linkedProjectId);
    const subprojectDir = path.join(projectDir, 'subprojects', linkedSubprojectId);
    const egkriseisDir = path.join(subprojectDir, 'egkriseis');
    
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'subprojects'), { recursive: true });
    }
    
    if (!fs.existsSync(subprojectDir)) {
      fs.mkdirSync(subprojectDir, { recursive: true });
      
      // Create subproject metadata
      const subprojectMeta = {
        subprojectId: linkedSubprojectId,
        projectId: linkedProjectId,
        egkrisiSubprojectTitle: egkrisiSubprojectTitle,
        egkrisiSubprojectNumber: egkrisiSubprojectNumber,
        createdAt: new Date().toISOString(),
        egkriseisCount: 0
      };
      
      safeWriteJSON(path.join(subprojectDir, 'subproject_metadata.json'), subprojectMeta);
    }
    
    if (!fs.existsSync(egkriseisDir)) {
      fs.mkdirSync(egkriseisDir, { recursive: true });
    }
    
    // Copy PDFs and create egkrisi records
    for (const pdf of subproject.pdfs) {
      const { randomUUID } = require('crypto');
      const egkrisiId = randomUUID();
      
      const egkrisiData = {
        egkrisiId: egkrisiId,
        projectId: linkedProjectId,
        subprojectId: linkedSubprojectId,
        date: pdf.date,
        originalFileName: pdf.originalFileName,
        archivedFileName: pdf.archivedFileName,
        pdfFileName: `${egkrisiId}.pdf`,
        type: pdf.type || 'Έγκριση Διάθεσης Πίστωσης',
        createdAt: pdf.createdAt || new Date().toISOString(),
        linkedManually: true,
        metadata: {
          egkrisiProjectTitle: egkrisiProjectTitle,
          egkrisiSubprojectTitle: egkrisiSubprojectTitle
        }
      };
      
      safeWriteJSON(path.join(egkriseisDir, `${egkrisiId}.json`), egkrisiData);
      
      // Copy PDF
      const sourcePdf = path.join(archiveDir, 'PDF_FILES', pdf.archivedFileName);
      const destPdf = path.join(egkriseisDir, `${egkrisiId}.pdf`);
      
      if (fs.existsSync(sourcePdf)) {
        fs.copyFileSync(sourcePdf, destPdf);
      }
    }
    
    // Update index
    const indexPath = path.join(newEgkriseisDir, 'egkriseis_index.json');
    let index = { version: '2.0', index: { by_subproject_id: {} } };
    
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    
    if (!index.index.by_subproject_id[linkedSubprojectId]) {
      index.index.by_subproject_id[linkedSubprojectId] = {
        projectId: linkedProjectId,
        egkrisiSubprojectTitle: egkrisiSubprojectTitle,
        egkriseisCount: subproject.pdfs.length
      };
    } else {
      index.index.by_subproject_id[linkedSubprojectId].egkriseisCount += subproject.pdfs.length;
    }
    
    safeWriteJSON(indexPath, index);
    
    return { success: true };
  } catch (error) {
    console.error('Error manually linking egkrisi:', error);
    return { success: false, error: error.message };
  }
});

// Load egkriseis from new V2 structure
ipcMain.handle('load-egkriseis-v2', async (event, subprojectId) => {
  try {
    const newEgkriseisDir = path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS');
    
    // Find the subproject in the new structure
    const projectDirs = fs.readdirSync(path.join(newEgkriseisDir, 'projects'));
    
    for (const projectDir of projectDirs) {
      const subprojectPath = path.join(newEgkriseisDir, 'projects', projectDir, 'subprojects', subprojectId);
      
      if (fs.existsSync(subprojectPath)) {
        const egkriseisPath = path.join(subprojectPath, 'egkriseis');
        
        if (!fs.existsSync(egkriseisPath)) {
          return [];
        }
        
        const egkriseisFiles = fs.readdirSync(egkriseisPath)
          .filter(f => f.endsWith('.json'));
        
        const egkriseis = egkriseisFiles.map(file => {
          const data = JSON.parse(fs.readFileSync(path.join(egkriseisPath, file), 'utf8'));
          return data;
        });
        
        return egkriseis;
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error loading egkriseis v2:', error);
    return [];
  }
});

// Open egkrisi PDF from V2 structure
ipcMain.handle('open-egkrisi-v2-pdf', async (event, egkrisiId, projectId, subprojectId) => {
  try {
    const newEgkriseisDir = path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS');
    const pdfPath = path.join(
      newEgkriseisDir, 
      'projects', 
      projectId, 
      'subprojects', 
      subprojectId, 
      'egkriseis', 
      `${egkrisiId}.pdf`
    );
    
    if (!fs.existsSync(pdfPath)) {
      return { success: false, error: 'PDF not found' };
    }
    
    await shell.openPath(pdfPath);
    return { success: true };
  } catch (error) {
    console.error('Error opening egkrisi v2 PDF:', error);
    return { success: false, error: error.message };
  }
});

// ========================
// ΣΗΜΕΙΩΣΕΙΣ (NOTES)
// ========================

const notesDir = dataDir ? path.join(dataDir, 'ΣΗΜΕΙΩΣΕΙΣ') : null;
const notesDataPath = notesDir ? path.join(notesDir, 'notes_data.json') : null;
const DEFAULT_NOTE_GROUP_ID = 'general-notes';

if (notesDir && !fs.existsSync(notesDir)) {
  fs.mkdirSync(notesDir, { recursive: true });
}

// Load notes data
ipcMain.handle('load-notes', async () => {
  try {
    if (!fs.existsSync(notesDataPath)) {
      // Create initial structure
      const initialData = {
        notes: [],
        groups: [{
          id: DEFAULT_NOTE_GROUP_ID,
          name: 'Γενικές Σημειώσεις',
          color: '#6366f1'
        }]
      };
      safeWriteJSON(notesDataPath, initialData);
      return initialData;
    }
    
    const data = JSON.parse(fs.readFileSync(notesDataPath, 'utf8'));
    
    // Ensure default group exists
    if (!data.groups || !Array.isArray(data.groups)) {
      data.groups = [];
    }
    if (!data.groups.some(g => g.id === DEFAULT_NOTE_GROUP_ID)) {
      data.groups.unshift({
        id: DEFAULT_NOTE_GROUP_ID,
        name: 'Γενικές Σημειώσεις',
        color: '#6366f1'
      });
    }
    
    if (!data.notes || !Array.isArray(data.notes)) {
      data.notes = [];
    }
    
    return data;
  } catch (error) {
    console.error('Error loading notes:', error);
    return {
      notes: [],
      groups: [{
        id: DEFAULT_NOTE_GROUP_ID,
        name: 'Γενικές Σημειώσεις',
        color: '#6366f1'
      }]
    };
  }
});

// Save notes data
ipcMain.handle('save-notes', async (event, notesData) => {
  try {
    if (!notesData || !Array.isArray(notesData.notes)) {
      return { success: false, error: 'Μη έγκυρα δεδομένα σημειώσεων.' };
    }
    
    // Load existing data to preserve groups
    let existingData = { notes: [], groups: [] };
    if (fs.existsSync(notesDataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(notesDataPath, 'utf8'));
      } catch (e) {
        console.error('Error reading existing notes data:', e);
      }
    }
    
    // Merge: update notes, preserve groups
    const dataToSave = {
      notes: notesData.notes,
      groups: notesData.groups || existingData.groups || [{
        id: DEFAULT_NOTE_GROUP_ID,
        name: 'Γενικές Σημειώσεις',
        color: '#6366f1'
      }]
    };
    
    // Ensure default group exists
    if (!dataToSave.groups.some(g => g.id === DEFAULT_NOTE_GROUP_ID)) {
      dataToSave.groups.unshift({
        id: DEFAULT_NOTE_GROUP_ID,
        name: 'Γενικές Σημειώσεις',
        color: '#6366f1'
      });
    }
    
    const hasChanged = JSON.stringify(dataToSave.notes) !== JSON.stringify(existingData.notes || []);
    safeWriteJSON(notesDataPath, dataToSave);
    if (hasChanged) {
      logAuditAction({
        type: 'update',
        entityType: 'note',
        entityId: 'notes',
        entityTitle: 'Σημειώσεις',
        details: `Ενημέρωση σημειώσεων (${dataToSave.notes.length} σημειώσεις)`
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving notes:', error);
    return { success: false, error: error.message };
  }
});

// Save note groups
ipcMain.handle('save-note-groups', async (event, groupsData) => {
  try {
    if (!groupsData || !Array.isArray(groupsData)) {
      return { success: false, error: 'Μη έγκυρα δεδομένα ομάδων.' };
    }
    
    // Load existing data to preserve notes
    let existingData = { notes: [], groups: [] };
    if (fs.existsSync(notesDataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(notesDataPath, 'utf8'));
      } catch (e) {
        console.error('Error reading existing notes data:', e);
      }
    }
    
    // Ensure default group exists
    const groupsToSave = [...groupsData];
    if (!groupsToSave.some(g => g.id === DEFAULT_NOTE_GROUP_ID)) {
      groupsToSave.unshift({
        id: DEFAULT_NOTE_GROUP_ID,
        name: 'Γενικές Σημειώσεις',
        color: '#6366f1'
      });
    }
    
    const dataToSave = {
      notes: existingData.notes || [],
      groups: groupsToSave
    };
    
    const groupsChanged = JSON.stringify(groupsToSave) !== JSON.stringify(existingData.groups || []);
    safeWriteJSON(notesDataPath, dataToSave);
    if (groupsChanged) {
      logAuditAction({
        type: 'update',
        entityType: 'note_group',
        entityId: 'note_groups',
        entityTitle: 'Ομάδες Σημειώσεων',
        details: `Ενημέρωση ομάδων σημειώσεων (${groupsToSave.length} ομάδες)`
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving note groups:', error);
    return { success: false, error: error.message };
  }
});

// ΥΠΟΔΕΙΓΜΑΤΑ ΕΓΓΡΑΦΩΝ
// ========================

const templatesDir = dataDir ? path.join(dataDir, 'DOCUMENT_TEMPLATES') : null;
const templatesDataPath = templatesDir ? path.join(templatesDir, 'templates_data.json') : null;
const defaultCategoryPalette = ['#5a6fd8', '#41b3a3', '#f57f17', '#c06c84', '#3f51b5', '#009688', '#ef5350', '#8e24aa'];
const fallbackCategoryColor = '#5a6fd8';

if (templatesDir && !fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Load document templates
ipcMain.handle('load-document-templates', async () => {
  try {
    if (!fs.existsSync(templatesDataPath)) {
      // Create initial structure - χωρίς προκαθορισμένες κατηγορίες
      const initialData = {
        categories: [],
        documents: []
      };
      safeWriteJSON(templatesDataPath, initialData);
      return initialData;
    }
    
    // Αν το αρχείο υπάρχει αλλά έχει προκαθορισμένες κατηγορίες, τις αφαιρούμε
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const defaultCategoryIds = ['contracts', 'reports', 'forms', 'letters'];
    let dataModified = false;
    
    if (data.categories && Array.isArray(data.categories)) {
      const originalLength = data.categories.length;
      data.categories = data.categories.filter(cat => !defaultCategoryIds.includes(cat.id));
      if (data.categories.length !== originalLength) {
        dataModified = true;
      }

      data.categories = data.categories.map((category, index) => {
        if (!category.color) {
          dataModified = true;
          const paletteColor = defaultCategoryPalette[index % defaultCategoryPalette.length];
          return {
            ...category,
            color: paletteColor
          };
        }
        return category;
      });
    }
    
    // Αν κάποια έγγραφα έχουν τις προκαθορισμένες κατηγορίες, τα αφαιρούμε
    if (data.documents && Array.isArray(data.documents)) {
      const originalLength = data.documents.length;
      data.documents = data.documents.filter(doc => !defaultCategoryIds.includes(doc.category));
      if (data.documents.length !== originalLength) {
        dataModified = true;
      }
    }
    
    // Αποθήκευση μόνο αν έγιναν αλλαγές
    if (dataModified) {
      safeWriteJSON(templatesDataPath, data);
    }
    
    return data;
  } catch (error) {
    console.error('Error loading templates:', error);
    return { categories: [], documents: [] };
  }
});

// Add document category
ipcMain.handle('add-document-category', async (event, categoryPayload) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const payload = typeof categoryPayload === 'string'
      ? { name: categoryPayload }
      : (categoryPayload || {});

    const categoryName = (payload.name || '').trim();
    if (!categoryName) {
      return { success: false, error: 'Το όνομα κατηγορίας δεν είναι έγκυρο.' };
    }

    const categoryColor = (payload.color || '').trim() || fallbackCategoryColor;

    const newCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: categoryName,
      color: categoryColor
    };

    data.categories.push(newCategory);
    safeWriteJSON(templatesDataPath, data);
    logAuditAction({
      type: 'create',
      entityType: 'document_category',
      entityId: newCategory.id,
      entityTitle: categoryName,
      details: 'Δημιουργία κατηγορίας υποδειγμάτων εγγράφων'
    });
    return { success: true, category: newCategory };
  } catch (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }
});

// Upload document template
ipcMain.handle('upload-document-template', async (event, categoryId) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Επιλέξτε Έγγραφα (Word, Excel, PDF)',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Word Documents', extensions: ['doc', 'docx'] },
        { name: 'Excel Documents', extensions: ['xls', 'xlsx'] },
        { name: 'PDF Documents', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    const uploadedDocuments = [];
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    
    // Process all selected files
    for (const sourcePath of result.filePaths) {
      try {
        const fileName = path.basename(sourcePath);
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = path.extname(fileName);
        const destPath = path.join(templatesDir, `${docId}${ext}`);
        
        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        
        const newDocument = {
          id: docId,
          name: fileName,
          category: categoryId,
          uploadedAt: new Date().toISOString(),
          filePath: `${docId}${ext}`
        };
        
        data.documents.push(newDocument);
        uploadedDocuments.push(newDocument);
      } catch (fileError) {
        console.error(`Error uploading file ${sourcePath}:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    // Save updated data
    safeWriteJSON(templatesDataPath, data);
    
    return { success: true, documents: uploadedDocuments, count: uploadedDocuments.length };
  } catch (error) {
    console.error('Error uploading template:', error);
    return { success: false, error: error.message };
  }
});

// Download document template
ipcMain.handle('download-document-template', async (event, docId) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const document = data.documents.find(doc => doc.id === docId);
    
    if (!document) {
      return { success: false, error: 'Document not found' };
    }
    
    const sourcePath = path.join(templatesDir, document.filePath);
    
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση Εγγράφου',
      defaultPath: document.name,
      filters: [
        { name: 'Word Documents', extensions: ['doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    
    fs.copyFileSync(sourcePath, result.filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error downloading template:', error);
    return { success: false, error: error.message };
  }
});

// Delete document template
ipcMain.handle('delete-document-template', async (event, docId) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const documentIndex = data.documents.findIndex(doc => doc.id === docId);
    
    if (documentIndex === -1) {
      return { success: false, error: 'Document not found' };
    }
    
    const document = data.documents[documentIndex];
    const filePath = path.join(templatesDir, document.filePath);
    
    // Delete file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from data
    data.documents.splice(documentIndex, 1);
    safeWriteJSON(templatesDataPath, data);
    logAuditAction({
      type: 'delete',
      entityType: 'document_template',
      entityId: docId,
      entityTitle: document.name || docId,
      details: 'Διαγραφή υποδείγματος εγγράφου'
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting template:', error);
    return { success: false, error: error.message };
  }
});

// Rename document template
ipcMain.handle('rename-document-template', async (event, docId, newName) => {
  try {
    const proposedName = (newName || '').trim();
    if (!proposedName) {
      return { success: false, error: 'Το νέο όνομα δεν είναι έγκυρο.' };
    }

    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const document = data.documents.find(doc => doc.id === docId);

    if (!document) {
      return { success: false, error: 'Document not found' };
    }

    const invalidCharsRegex = /[<>:"/\\|?*]/g;
    let baseName = proposedName.replace(invalidCharsRegex, '').trim();

    if (!baseName) {
      return { success: false, error: 'Το νέο όνομα δεν είναι έγκυρο.' };
    }

    const originalExt = path.extname(document.name) || path.extname(document.filePath) || '';
    const lastDotIndex = baseName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      baseName = baseName.substring(0, lastDotIndex).trim();
    }

    if (!baseName) {
      return { success: false, error: 'Το νέο όνομα δεν είναι έγκυρο.' };
    }

    const finalName = `${baseName}${originalExt}`;
    document.name = finalName;

    safeWriteJSON(templatesDataPath, data);

    return { success: true, document };
  } catch (error) {
    console.error('Error renaming template:', error);
    return { success: false, error: error.message };
  }
});

// Update document category properties (name/color)
ipcMain.handle('update-document-category', async (event, categoryId, updates) => {
  try {
    if (!categoryId || !updates || typeof updates !== 'object') {
      return { success: false, error: 'Μη έγκυρες παράμετροι.' };
    }

    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const category = data.categories.find(cat => cat.id === categoryId);

    if (!category) {
      return { success: false, error: 'Η κατηγορία δεν βρέθηκε.' };
    }

    if (typeof updates.name === 'string') {
      const trimmedName = updates.name.trim();
      if (trimmedName) {
        category.name = trimmedName;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'color')) {
      const colorValue = (updates.color || '').trim();
      category.color = colorValue || fallbackCategoryColor;
    }

    safeWriteJSON(templatesDataPath, data);
    logAuditAction({
      type: 'update',
      entityType: 'document_category',
      entityId: categoryId,
      entityTitle: category.name,
      details: 'Ενημέρωση κατηγορίας υποδειγμάτων εγγράφων'
    });
    return { success: true, category };
  } catch (error) {
    console.error('Error updating document category:', error);
    return { success: false, error: error.message };
  }
});

// Delete document category and associated documents
ipcMain.handle('delete-document-category', async (event, categoryId) => {
  try {
    if (!categoryId) {
      return { success: false, error: 'Μη έγκυρη κατηγορία.' };
    }

    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const categoryIndex = data.categories.findIndex(cat => cat.id === categoryId);

    if (categoryIndex === -1) {
      return { success: false, error: 'Η κατηγορία δεν βρέθηκε.' };
    }

    const documentsToDelete = data.documents.filter(doc => doc.category === categoryId);

    for (const document of documentsToDelete) {
      if (!document || !document.filePath) {
        continue;
      }

      const absolutePath = path.join(templatesDir, document.filePath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (unlinkError) {
          console.error('Error deleting template file during category deletion:', unlinkError);
        }
      }
    }

    data.documents = data.documents.filter(doc => doc.category !== categoryId);
    const deletedCategory = data.categories.splice(categoryIndex, 1)[0];

    safeWriteJSON(templatesDataPath, data);
    logAuditAction({
      type: 'delete',
      entityType: 'document_category',
      entityId: categoryId,
      entityTitle: deletedCategory.name || categoryId,
      details: `Διαγραφή κατηγορίας υποδειγμάτων εγγράφων (${documentsToDelete.length} έγγραφα)`
    });
    return {
      success: true,
      category: deletedCategory,
      removedDocuments: documentsToDelete.length
    };
  } catch (error) {
    console.error('Error deleting document category:', error);
    return { success: false, error: error.message };
  }
});

// Get document template file path
ipcMain.handle('get-document-template-path', async (event, docId) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const document = data.documents.find(doc => doc.id === docId);
    
    if (!document) {
      return { success: false, error: 'Document not found' };
    }
    
    const filePath = path.join(templatesDir, document.filePath);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    return { success: true, filePath, fileName: document.name };
  } catch (error) {
    console.error('Error getting document template path:', error);
    return { success: false, error: error.message };
  }
});

// Copy document template to another category
ipcMain.handle('copy-document-template', async (event, docId, targetCategoryId) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const sourceDocument = data.documents.find(doc => doc.id === docId);
    
    if (!sourceDocument) {
      return { success: false, error: 'Document not found' };
    }
    
    const sourceFilePath = path.join(templatesDir, sourceDocument.filePath);
    
    if (!fs.existsSync(sourceFilePath)) {
      return { success: false, error: 'Source file not found' };
    }
    
    // Create new document ID and file path
    const ext = path.extname(sourceDocument.filePath);
    const newDocId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newFilePath = `${newDocId}${ext}`;
    const destPath = path.join(templatesDir, newFilePath);
    
    // Copy the file
    fs.copyFileSync(sourceFilePath, destPath);
    
    // Create new document entry
    const newDocument = {
      id: newDocId,
      name: sourceDocument.name,
      category: targetCategoryId,
      uploadedAt: new Date().toISOString(),
      filePath: newFilePath
    };
    
    data.documents.push(newDocument);
    safeWriteJSON(templatesDataPath, data);
    
    return { success: true, document: newDocument };
  } catch (error) {
    console.error('Error copying document template:', error);
    return { success: false, error: error.message };
  }
});

// Open document template for viewing/editing
ipcMain.handle('open-document-template', async (event, docId, forEditing = false) => {
  try {
    const data = JSON.parse(fs.readFileSync(templatesDataPath, 'utf8'));
    const document = data.documents.find(doc => doc.id === docId);
    
    if (!document) {
      return { success: false, error: 'Document not found' };
    }
    
    const filePath = path.join(templatesDir, document.filePath);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    // Open file with default application (for viewing/editing)
    return new Promise((resolve, reject) => {
      shell.openPath(filePath).then(() => {
        console.log(`Document opened successfully: ${document.name}`);
        resolve({ success: true });
      }).catch(openError => {
        console.error('Error opening document with shell.openPath:', openError);
        
        // Fallback: try with exec (Windows)
        exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error opening document with exec:', error);
            reject(error);
          } else {
            console.log(`Document opened successfully with exec: ${document.name}`);
            resolve({ success: true });
          }
        });
      });
    });
  } catch (error) {
    console.error('Error opening document template:', error);
    throw error;
  }
});

// ============================================================
// BACKUP & RESTORE SYSTEM
// ============================================================

// Backup directory and settings
const backupDir = dataDir ? path.join(dataDir, 'backups') : null;
const backupSettingsPath = dataDir ? path.join(dataDir, 'backup_settings.json') : null;
const backupMetadataPath = backupDir ? path.join(backupDir, 'metadata.json') : null;
const auditLogPath = dataDir ? path.join(dataDir, 'audit_log.json') : null;

if (backupDir && !fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Initialize audit log if it doesn't exist
if (!fs.existsSync(auditLogPath)) {
  safeWriteJSON(auditLogPath, { logs: [] });
}

// Default backup settings - AUTOMATIC BACKUPS DISABLED (Manual only)
const defaultBackupSettings = {
  enabled: false, // ❌ ΑΥΤΟΜΑΤΟ BACKUP ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ - ΜΟΝΟ ΧΕΙΡΟΚΙΝΗΤΟ
  daily: {
    enabled: false, // ❌ Disabled
    time: '02:00'
  },
  weekly: {
    enabled: false, // ❌ Disabled
    day: 0, // Sunday
    time: '03:00'
  },
  monthly: {
    enabled: false, // ❌ Disabled
    day: 1, // 1st of month
    time: '04:00'
  },
  compression: 'medium', // low, medium, high
  retention: {
    daily: 30, // days
    weekly: 12, // weeks
    monthly: 12 // months
  },
  backupLocation: backupDir
};

// Load backup settings
function loadBackupSettings() {
  try {
    // ❌ FORCE DISABLE ALL AUTOMATIC BACKUPS - User requested manual only
    // Always return disabled settings, ignoring any saved settings file
    console.log('⚠️ AUTOMATIC BACKUPS ARE DISABLED - Manual backups only');
    
    // Optionally delete old settings file to prevent confusion
    if (fs.existsSync(backupSettingsPath)) {
      try {
        fs.unlinkSync(backupSettingsPath);
        console.log('✅ Deleted old backup_settings.json (automatic backups disabled)');
      } catch (err) {
        console.warn('Could not delete old backup_settings.json:', err.message);
      }
    }
    
    return defaultBackupSettings; // Always returns enabled: false
  } catch (error) {
    console.error('Error loading backup settings:', error);
  }
  return defaultBackupSettings;
}

// Save backup settings
function saveBackupSettings(settings) {
  try {
    // ❌ PREVENT SAVING ENABLED AUTOMATIC BACKUPS - Manual only mode
    if (settings.enabled === true || 
        (settings.daily && settings.daily.enabled) || 
        (settings.weekly && settings.weekly.enabled) || 
        (settings.monthly && settings.monthly.enabled)) {
      console.warn('⚠️ AUTOMATIC BACKUPS ARE DISABLED - Cannot enable automatic backups');
      console.warn('⚠️ Only manual backups are allowed');
      
      // Force disable all automatic settings
      settings.enabled = false;
      if (settings.daily) settings.daily.enabled = false;
      if (settings.weekly) settings.weekly.enabled = false;
      if (settings.monthly) settings.monthly.enabled = false;
    }
    
    safeWriteJSON(backupSettingsPath, settings);
    return true;
  } catch (error) {
    console.error('Error saving backup settings:', error);
    return false;
  }
}

// Load backup metadata
function loadBackupMetadata() {
  try {
    if (fs.existsSync(backupMetadataPath)) {
      return JSON.parse(fs.readFileSync(backupMetadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading backup metadata:', error);
  }
  return { backups: [] };
}

// Save backup metadata
function saveBackupMetadata(metadata) {
  try {
    safeWriteJSON(backupMetadataPath, metadata);
    return true;
  } catch (error) {
    console.error('Error saving backup metadata:', error);
    return false;
  }
}

// Get files to backup (with filtering)
async function getFilesToBackup(options = {}) {
  const files = [];
  const { includeProjects = true, includeProskliseis = true, includeEntaxeis = true, includeEgkriseis = true } = options;
  
  try {
    // Projects
    if (includeProjects) {
      const projectDirs = fs.readdirSync(dataDir);
      for (const projectDir of projectDirs) {
        const projectPath = path.join(dataDir, projectDir);
        if (fs.statSync(projectPath).isDirectory() && !projectDir.startsWith('.') && projectDir !== 'backups' && projectDir !== 'locks') {
          // Skip backup and locks directories
          if (projectDir === 'backups' || projectDir === 'locks' || projectDir === 'temp_uploads') continue;
          
          // Check if it's a project UUID folder
          if (projectDir.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            files.push({
              type: 'project',
              path: projectPath,
              relativePath: projectDir
            });
          }
        }
      }
    }
    
    // Proskliseis
    if (includeProskliseis) {
      const proskliseisDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ');
      if (fs.existsSync(proskliseisDir)) {
        files.push({
          type: 'proskliseis',
          path: proskliseisDir,
          relativePath: 'ΠΡΟΣΚΛΗΣΕΙΣ'
        });
      }
    }
    
    // Entaxeis
    if (includeEntaxeis) {
      const entaxeisDir = path.join(dataDir, 'entaxeis');
      if (fs.existsSync(entaxeisDir)) {
        files.push({
          type: 'entaxeis',
          path: entaxeisDir,
          relativePath: 'entaxeis'
        });
      }
    }
    
    // Egkriseis
    if (includeEgkriseis) {
      const egkriseisDir = path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS');
      if (fs.existsSync(egkriseisDir)) {
        files.push({
          type: 'egkriseis',
          path: egkriseisDir,
          relativePath: 'EGKRISEIS_DIATHESIS_PISTOSIS'
        });
      }
    }
  } catch (error) {
    console.error('Error getting files to backup:', error);
  }
  
  return files;
}

// Create backup (non-blocking, background execution)
async function createBackup(options = {}) {
  const {
    type = 'full', // full, incremental, daily, weekly, monthly
    includeProjects = true,
    includeProskliseis = true,
    includeEntaxeis = true,
    includeEgkriseis = true,
    background = true,
    notifyUser = false,
    onProgress = null
  } = options;
  
  const backupId = uuidv4();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFileName = `backup_${timestamp}_${type}.zip`;
  const backupPath = path.join(backupDir, backupFileName);
  
  const backupInfo = {
    backupId,
    timestamp: new Date().toISOString(),
    type,
    fileName: backupFileName,
    path: backupPath,
    status: 'in_progress',
    size: 0,
    contents: {
      projects: 0,
      proskliseis: 0,
      entaxeis: 0,
      egkriseis: 0
    },
    error: null
  };
  
  try {
    console.log(`🔄 Starting backup: ${backupFileName}`);
    
    // Get files to backup
    const filesToBackup = await getFilesToBackup({
      includeProjects,
      includeProskliseis,
      includeEntaxeis,
      includeEgkriseis
    });
    
    // Count contents
    if (includeProjects) {
      backupInfo.contents.projects = filesToBackup.filter(f => f.type === 'project').length;
    }
    if (includeProskliseis) {
      backupInfo.contents.proskliseis = filesToBackup.filter(f => f.type === 'proskliseis').length > 0 ? 1 : 0;
    }
    if (includeEntaxeis) {
      backupInfo.contents.entaxeis = filesToBackup.filter(f => f.type === 'entaxeis').length > 0 ? 1 : 0;
    }
    if (includeEgkriseis) {
      backupInfo.contents.egkriseis = filesToBackup.filter(f => f.type === 'egkriseis').length > 0 ? 1 : 0;
    }
    
    // Create ZIP archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 6 } // Medium compression (balanced)
    });
    
    // Handle archive events
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.on('progress', (progress) => {
      if (onProgress) {
        onProgress({
          entries: progress.entries.processed,
          total: progress.entries.total,
          bytes: progress.fs.processedBytes
        });
      }
    });
    
    archive.pipe(output);
    
    // Add files to archive
    for (const file of filesToBackup) {
      // Skip lock files and temp files
      if (file.path.includes('.lock') || file.path.includes('temp_')) continue;
      
      if (fs.existsSync(file.path)) {
        const stat = fs.statSync(file.path);
        if (stat.isDirectory()) {
          archive.directory(file.path, file.relativePath);
        } else {
          archive.file(file.path, { name: file.relativePath });
        }
      }
      
      // Yield to event loop every 10 files (non-blocking)
      if (filesToBackup.indexOf(file) % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Finalize archive
    await archive.finalize();
    
    // Wait for file to be written
    await new Promise((resolve, reject) => {
      output.on('close', () => {
        const stats = fs.statSync(backupPath);
        backupInfo.size = stats.size;
        backupInfo.status = 'success';
        resolve();
      });
      output.on('error', reject);
    });
    
    // Calculate checksum
    const fileBuffer = fs.readFileSync(backupPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    backupInfo.checksum = hashSum.digest('hex');
    
    // Update metadata
    const metadata = loadBackupMetadata();
    metadata.backups.unshift(backupInfo);
    saveBackupMetadata(metadata);
    
    console.log(`✅ Backup completed: ${backupFileName} (${(backupInfo.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Notify user if requested
    if (notifyUser && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-completed', {
        success: true,
        backupId,
        message: 'Το backup ολοκληρώθηκε επιτυχώς'
      });
    }
    
    return { success: true, backupInfo };
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    backupInfo.status = 'failed';
    backupInfo.error = error.message;
    
    // Update metadata
    const metadata = loadBackupMetadata();
    metadata.backups.unshift(backupInfo);
    saveBackupMetadata(metadata);
    
    // Notify user if requested
    if (notifyUser && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-completed', {
        success: false,
        backupId,
        message: `Σφάλμα κατά το backup: ${error.message}`
      });
    }
    
    return { success: false, error: error.message, backupInfo };
  }
}

// Perform scheduled backup (background, non-blocking)
async function performScheduledBackup(type) {
  // Run in background (non-blocking)
  setImmediate(async () => {
    try {
      if (app.isReady()) {
        console.log(`🔄 Starting scheduled ${type} backup...`);
        await createBackup({
          type,
          background: true,
          notifyUser: true
        });
      }
    } catch (error) {
      console.error(`❌ Error in scheduled ${type} backup:`, error);
    }
  });
}

// Initialize backup scheduler
let backupScheduler = {
  daily: null,
  weekly: null,
  monthly: null
};

function initializeBackupScheduler() {
  try {
    // ❌ AUTOMATIC BACKUPS PERMANENTLY DISABLED
    // User requested NO automatic backups - only manual backups allowed
    console.log('⚠️ Backup scheduler is PERMANENTLY DISABLED - Manual backups only');
    
    // Cancel ALL existing schedules
    if (backupScheduler.daily) {
      backupScheduler.daily.cancel();
      backupScheduler.daily = null;
    }
    if (backupScheduler.weekly) {
      backupScheduler.weekly.cancel();
      backupScheduler.weekly = null;
    }
    if (backupScheduler.monthly) {
      backupScheduler.monthly.cancel();
      backupScheduler.monthly = null;
    }
    
    // Delete backup settings file to prevent any automatic backups
    if (fs.existsSync(backupSettingsPath)) {
      try {
        fs.unlinkSync(backupSettingsPath);
        console.log('✅ Deleted backup_settings.json - automatic backups prevented');
      } catch (err) {
        console.warn('⚠️ Could not delete backup_settings.json:', err.message);
      }
    }
    
    return; // EXIT IMMEDIATELY - DO NOT SCHEDULE ANYTHING
    
    /* DISABLED CODE - DO NOT EXECUTE
    const settings = loadBackupSettings();
    
    if (!settings.enabled) {
      console.log('⚠️ Backup scheduler is disabled');
      return;
    }
    
    // Cancel existing schedules
    if (backupScheduler.daily) backupScheduler.daily.cancel();
    if (backupScheduler.weekly) backupScheduler.weekly.cancel();
    if (backupScheduler.monthly) backupScheduler.monthly.cancel();
    
    // ❌ ALL AUTOMATIC BACKUP SCHEDULING CODE DISABLED
    // Daily backup - DISABLED
    // Weekly backup - DISABLED
    // Monthly backup - DISABLED
    // Automatic cleanup - DISABLED
    // User requested NO automatic operations - Manual backups only
    
    console.log('✅ Backup scheduler disabled successfully - Manual backups only');
    END OF DISABLED CODE */
  } catch (error) {
    console.error('❌ Error initializing backup scheduler:', error);
  }
}

// Cleanup old backups based on retention policy
function cleanupOldBackups() {
  try {
    const settings = loadBackupSettings();
    const metadata = loadBackupMetadata();
    const now = new Date();
    let deletedCount = 0;
    
    const backupsToKeep = [];
    const backupsToDelete = [];
    
    for (const backup of metadata.backups) {
      const backupDate = new Date(backup.timestamp);
      const ageDays = (now - backupDate) / (1000 * 60 * 60 * 24);
      
      let shouldKeep = false;
      
      if (backup.type === 'daily' && ageDays <= settings.retention.daily) {
        shouldKeep = true;
      } else if (backup.type === 'weekly' && ageDays <= (settings.retention.weekly * 7)) {
        shouldKeep = true;
      } else if (backup.type === 'monthly' && ageDays <= (settings.retention.monthly * 30)) {
        shouldKeep = true;
      } else if (backup.type === 'full' || backup.type === 'manual') {
        // Keep full and manual backups for 30 days (1 month)
        if (ageDays <= 30) {
          shouldKeep = true;
        }
      } else if (backup.type === 'safety') {
        // Keep safety backups for 7 days only
        if (ageDays <= 7) {
          shouldKeep = true;
        }
      }
      
      if (shouldKeep) {
        backupsToKeep.push(backup);
      } else {
        backupsToDelete.push(backup);
      }
    }
    
    // Delete old backups
    for (const backup of backupsToDelete) {
      try {
        if (fs.existsSync(backup.path)) {
          fs.unlinkSync(backup.path);
          deletedCount++;
          console.log(`🗑️ Deleted old backup: ${backup.fileName}`);
        }
      } catch (error) {
        console.error(`❌ Error deleting backup ${backup.fileName}:`, error);
      }
    }
    
    // Update metadata
    metadata.backups = backupsToKeep;
    saveBackupMetadata(metadata);
    
    if (deletedCount > 0) {
      console.log(`✅ Cleanup completed: Deleted ${deletedCount} old backups`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up old backups:', error);
    return 0;
  }
}


// ============================================================
// AUDIT TRAIL SYSTEM
// ============================================================

const { collectAuditChanges } = require('./auditFieldLabels');

function getCurrentAuditUser() {
  if (!loggedInUsername) return { fullName: 'Σύστημα', role: 'SYSTEM', username: '' };
  try {
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === loggedInUsername.toLowerCase());
    if (user) {
      return { fullName: user.fullName || user.username, role: user.role || 'USER', username: user.username };
    }
  } catch (e) { /* ignore */ }
  return { fullName: loggedInUsername, role: 'USER', username: loggedInUsername };
}

function logAuditAction(action) {
  try {
    const { type, entityType, entityId, entityTitle, details, oldValue, newValue } = action;

    let userFullName = action.userFullName;
    let userRole = action.userRole;
    if (!userFullName) {
      const auditUser = getCurrentAuditUser();
      userFullName = auditUser.fullName;
      userRole = auditUser.role;
    }

    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userFullName: userFullName,
      userRole: userRole || 'USER',
      user: userFullName,
      action: type,
      entityType: entityType,
      entityId: entityId,
      entityTitle: entityTitle || 'N/A',
      details: details || '',
      oldValue: oldValue || null,
      newValue: newValue || null,
      changes: oldValue && newValue
        ? collectAuditChanges(oldValue, newValue, { engineerCatalog: getRegisteredEngineersList() })
        : null
    };

    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      try {
        auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
      } catch (e) {
        console.error('Error reading audit log:', e);
        auditLog = { logs: [] };
      }
    }

    auditLog.logs.unshift(auditEntry);

    if (auditLog.logs.length > 10000) {
      auditLog.logs = auditLog.logs.slice(0, 10000);
    }

    safeWriteJSON(auditLogPath, auditLog);

    console.log(`📝 Audit log: ${userFullName} ${type} ${entityType} ${entityId}`);

    return true;
  } catch (error) {
    console.error('Error logging audit action:', error);
    return false;
  }
}

// ============================================================
// BACKUP IPC HANDLERS
// ============================================================

// Get backup settings
ipcMain.handle('get-backup-settings', async () => {
  try {
    return loadBackupSettings();
  } catch (error) {
    console.error('Error getting backup settings:', error);
    return defaultBackupSettings;
  }
});

// Save backup settings
ipcMain.handle('save-backup-settings', async (event, settings) => {
  try {
    const success = saveBackupSettings(settings);
    if (success) {
      // Reinitialize scheduler with new settings
      initializeBackupScheduler();
    }
    return { success };
  } catch (error) {
    console.error('Error saving backup settings:', error);
    return { success: false, error: error.message };
  }
});

// Scan backup directory for backup files and sync with metadata
function syncBackupMetadata() {
  try {
    const metadata = loadBackupMetadata();
    const existingBackupIds = new Set((metadata.backups || []).map(b => b.backupId));
    const existingFileNames = new Set((metadata.backups || []).map(b => b.fileName));
    
    if (!fs.existsSync(backupDir)) {
      return metadata;
    }
    
    const files = fs.readdirSync(backupDir);
    let foundNew = false;
    
    for (const file of files) {
      // Skip metadata and other non-backup files
      if (file === 'metadata.json' || file === 'restore_history.json' || !file.endsWith('.zip')) {
        continue;
      }
      
      // Check if this file is already in metadata
      if (existingFileNames.has(file)) {
        continue;
      }
      
      // Found a backup file not in metadata - add it
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      // Try to extract info from filename: backup_TIMESTAMP_TYPE.zip
      // Format: backup_2025-12-02T12-10-50_manual.zip
      const match = file.match(/^backup_(.+?)_(.+?)\.zip$/);
      let backupType = 'manual';
      let timestamp = stats.mtime.toISOString();
      
      if (match) {
        // Convert timestamp from 2025-12-02T12-10-50 to ISO format
        const timestampStr = match[1];
        // Replace last dash with colon for time (12-10-50 -> 12:10:50)
        const timePart = timestampStr.split('T')[1];
        if (timePart) {
          const timeParts = timePart.split('-');
          if (timeParts.length === 3) {
            const formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
            timestamp = timestampStr.replace('T' + timePart, 'T' + formattedTime) + 'Z';
          } else {
            timestamp = timestampStr.replace(/-/g, ':') + 'Z';
          }
        } else {
          timestamp = timestampStr + 'T00:00:00Z';
        }
        backupType = match[2];
      }
      
      // Calculate checksum
      let checksum = null;
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        checksum = hashSum.digest('hex');
      } catch (e) {
        console.error('Error calculating checksum for', file, e);
      }
      
      const backupInfo = {
        backupId: uuidv4(),
        timestamp: timestamp,
        type: backupType,
        fileName: file,
        path: filePath,
        status: 'success',
        size: stats.size,
        checksum: checksum,
        contents: {
          projects: 0,
          proskliseis: 0,
          entaxeis: 0,
          egkriseis: 0
        },
        error: null
      };
      
      metadata.backups = metadata.backups || [];
      metadata.backups.unshift(backupInfo);
      foundNew = true;
      console.log(`✅ Found and added backup to metadata: ${file}`);
    }
    
    if (foundNew) {
      saveBackupMetadata(metadata);
      console.log('✅ Backup metadata synced');
    }
    
    return metadata;
  } catch (error) {
    console.error('Error syncing backup metadata:', error);
    return loadBackupMetadata();
  }
}

// Get backup list
ipcMain.handle('get-backup-list', async () => {
  try {
    // Sync metadata with actual backup files first
    const metadata = syncBackupMetadata();
    // Auto cleanup old backups when loading the list
    cleanupOldBackups();
    return metadata.backups || [];
  } catch (error) {
    console.error('Error getting backup list:', error);
    return [];
  }
});

// Get backup info
ipcMain.handle('get-backup-info', async (event, backupId) => {
  try {
    const metadata = loadBackupMetadata();
    const backup = metadata.backups.find(b => b.backupId === backupId);
    return backup || null;
  } catch (error) {
    console.error('Error getting backup info:', error);
    return null;
  }
});

// Create manual backup
ipcMain.handle('create-backup', async (event, options = {}) => {
  try {
    const result = await createBackup({
      type: options.type || 'manual',
      includeProjects: options.includeProjects !== false,
      includeProskliseis: options.includeProskliseis !== false,
      includeEntaxeis: options.includeEntaxeis !== false,
      includeEgkriseis: options.includeEgkriseis !== false,
      background: true,
      notifyUser: true,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backup-progress', progress);
        }
      }
    });
    return result;
  } catch (error) {
    console.error('Error creating backup:', error);
    return { success: false, error: error.message };
  }
});

// Delete backup
ipcMain.handle('delete-backup', async (event, backupId) => {
  try {
    const metadata = loadBackupMetadata();
    const backup = metadata.backups.find(b => b.backupId === backupId);
    
    if (!backup) {
      return { success: false, error: 'Backup not found' };
    }
    
    // Delete file
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }
    
    // Remove from metadata
    metadata.backups = metadata.backups.filter(b => b.backupId !== backupId);
    saveBackupMetadata(metadata);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return { success: false, error: error.message };
  }
});

// Verify backup integrity
ipcMain.handle('verify-backup', async (event, backupId) => {
  try {
    const metadata = loadBackupMetadata();
    const backup = metadata.backups.find(b => b.backupId === backupId);
    
    if (!backup || !fs.existsSync(backup.path)) {
      return { success: false, error: 'Backup file not found' };
    }
    
    // Calculate checksum
    const fileBuffer = fs.readFileSync(backup.path);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const currentChecksum = hashSum.digest('hex');
    
    const isValid = backup.checksum === currentChecksum;
    
    return {
      success: true,
      valid: isValid,
      checksum: currentChecksum,
      expectedChecksum: backup.checksum
    };
  } catch (error) {
    console.error('Error verifying backup:', error);
    return { success: false, error: error.message };
  }
});

// Cleanup old backups
ipcMain.handle('cleanup-old-backups', async () => {
  try {
    const deletedCount = cleanupOldBackups();
    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    return { success: false, error: error.message };
  }
});

// Extract ZIP file
function extractZip(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          const dirPath = path.join(extractTo, entry.fileName);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const filePath = path.join(extractTo, entry.fileName);
            const dirPath = path.dirname(filePath);
            
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            
            const writeStream = fs.createWriteStream(filePath);
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              zipfile.readEntry();
            });
            
            writeStream.on('error', reject);
          });
        }
      });
      
      zipfile.on('end', () => {
        resolve();
      });
      
      zipfile.on('error', reject);
    });
  });
}

// Create safety backup before restore
async function createSafetyBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safetyBackupPath = path.join(backupDir, `safety_backup_${timestamp}.zip`);
    
    console.log('🛡️ Creating safety backup before restore...');
    const result = await createBackup({
      type: 'safety',
      background: false,
      notifyUser: false
    });
    
    if (result.success) {
      console.log('✅ Safety backup created');
      return result.backupInfo;
    } else {
      throw new Error('Failed to create safety backup');
    }
  } catch (error) {
    console.error('❌ Error creating safety backup:', error);
    throw error;
  }
}

// Restore backup
async function restoreBackup(backupId, options = {}) {
  const {
    type = 'full', // 'full', 'selective', 'merge'
    items = [] // For selective/merge
  } = options;
  
  try {
    const metadata = loadBackupMetadata();
    const backup = metadata.backups.find(b => b.backupId === backupId);
    
    if (!backup) {
      return { success: false, error: 'Backup not found' };
    }
    
    if (!fs.existsSync(backup.path)) {
      return { success: false, error: 'Backup file not found' };
    }
    
    if (backup.status !== 'success') {
      return { success: false, error: 'Backup is not valid (status: ' + backup.status + ')' };
    }
    
    console.log(`🔄 Starting restore from backup: ${backup.fileName}`);
    console.log(`   Type: ${type}`);
    
    // Step 1: Create safety backup
    let safetyBackup = null;
    try {
      safetyBackup = await createSafetyBackup();
      console.log(`✅ Safety backup created: ${safetyBackup.fileName}`);
    } catch (error) {
      console.error('⚠️ Warning: Could not create safety backup:', error);
      // Continue anyway, but warn user
    }
    
    // Step 2: Create temporary extraction directory
    const tempExtractDir = path.join(dataDir, 'temp_restore_' + Date.now());
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExtractDir, { recursive: true });
    
    try {
      // Step 3: Extract backup
      console.log('📦 Extracting backup...');
      await extractZip(backup.path, tempExtractDir);
      console.log('✅ Backup extracted');
      
      // Step 4: Perform restore based on type
      if (type === 'full') {
        // Full restore: Replace everything
        console.log('🔄 Performing full restore...');
        
        // Backup current data (if safety backup failed)
        if (!safetyBackup) {
          // Try one more time
          try {
            safetyBackup = await createSafetyBackup();
          } catch (e) {
            console.error('❌ Could not create safety backup, proceeding anyway');
          }
        }
        
        // Copy extracted files to data directory
        const extractedDataDir = path.join(tempExtractDir, 'dedomena_ergon');
        if (fs.existsSync(extractedDataDir)) {
          // Copy all contents
          const entries = fs.readdirSync(extractedDataDir);
          for (const entry of entries) {
            const sourcePath = path.join(extractedDataDir, entry);
            const destPath = path.join(dataDir, entry);
            
            // Skip backups and locks directories
            if (entry === 'backups' || entry === 'locks') continue;
            
            if (fs.statSync(sourcePath).isDirectory()) {
              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }
              fse.copySync(sourcePath, destPath);
            } else {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.copyFileSync(sourcePath, destPath);
            }
          }
        } else {
          // Backup might be in root of extract
          const entries = fs.readdirSync(tempExtractDir);
          for (const entry of entries) {
            const sourcePath = path.join(tempExtractDir, entry);
            const destPath = path.join(dataDir, entry);
            
            // Skip backups and locks
            if (entry === 'backups' || entry === 'locks') continue;
            
            if (fs.statSync(sourcePath).isDirectory()) {
              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }
              fse.copySync(sourcePath, destPath);
            } else {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.copyFileSync(sourcePath, destPath);
            }
          }
        }
        
        console.log('✅ Full restore completed');
        
      } else if (type === 'selective') {
        // Selective restore: Only restore selected items
        console.log('🔄 Performing selective restore...');
        
        if (!items || items.length === 0) {
          return { success: false, error: 'Δεν επιλέχθηκαν στοιχεία για restore' };
        }
        
        // Backup current data (if safety backup failed)
        if (!safetyBackup) {
          try {
            safetyBackup = await createSafetyBackup();
          } catch (e) {
            console.error('❌ Could not create safety backup, proceeding anyway');
          }
        }
        
        // Map items to directories
        const itemToDir = {
          'projects': null, // Projects are in root, need special handling
          'proskliseis': 'ΠΡΟΣΚΛΗΣΕΙΣ',
          'entaxeis': 'entaxeis',
          'egkriseis': 'EGKRISEIS_DIATHESIS_PISTOSIS'
        };
        
        const extractedDataDir = path.join(tempExtractDir, 'dedomena_ergon');
        const sourceDir = fs.existsSync(extractedDataDir) ? extractedDataDir : tempExtractDir;
        
        // Restore selected items
        for (const item of items) {
          if (item === 'projects') {
            // Projects are in root - restore only project folders (UUID-based)
            console.log('📁 Restoring projects...');
            const sourceEntries = fs.readdirSync(sourceDir);
            for (const entry of sourceEntries) {
              const sourcePath = path.join(sourceDir, entry);
              const destPath = path.join(dataDir, entry);
              
              // Skip system directories
              if (entry === 'backups' || entry === 'locks' || 
                  entry === 'ΠΡΟΣΚΛΗΣΕΙΣ' || entry === 'entaxeis' || 
                  entry === 'EGKRISEIS_DIATHESIS_PISTOSIS') continue;
              
              // Check if it's a project folder (UUID format or contains data.json)
              const stat = fs.statSync(sourcePath);
              if (stat.isDirectory()) {
                const dataJsonPath = path.join(sourcePath, 'data.json');
                if (fs.existsSync(dataJsonPath) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry)) {
                  // It's a project folder
                  if (fs.existsSync(destPath)) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                  }
                  fse.copySync(sourcePath, destPath);
                  console.log(`  ✅ Restored project: ${entry}`);
                }
              }
            }
          } else {
            // Restore specific directory
            const dirName = itemToDir[item];
            if (!dirName) continue;
            
            console.log(`📁 Restoring ${item} (${dirName})...`);
            const sourcePath = path.join(sourceDir, dirName);
            const destPath = path.join(dataDir, dirName);
            
            if (fs.existsSync(sourcePath)) {
              if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true, force: true });
              }
              fse.copySync(sourcePath, destPath);
              console.log(`  ✅ Restored ${item}`);
            } else {
              console.log(`  ⚠️ ${item} directory not found in backup`);
            }
          }
        }
        
        console.log('✅ Selective restore completed');
        
      } else if (type === 'merge') {
        // Merge restore: Merge with existing data
        console.log('🔄 Performing merge restore...');
        
        if (!items || items.length === 0) {
          return { success: false, error: 'Δεν επιλέχθηκαν στοιχεία για merge' };
        }
        
        // Backup current data (if safety backup failed)
        if (!safetyBackup) {
          try {
            safetyBackup = await createSafetyBackup();
          } catch (e) {
            console.error('❌ Could not create safety backup, proceeding anyway');
          }
        }
        
        // Map items to directories
        const itemToDir = {
          'projects': null, // Projects are in root, need special handling
          'proskliseis': 'ΠΡΟΣΚΛΗΣΕΙΣ',
          'entaxeis': 'entaxeis',
          'egkriseis': 'EGKRISEIS_DIATHESIS_PISTOSIS'
        };
        
        const extractedDataDir = path.join(tempExtractDir, 'dedomena_ergon');
        const sourceDir = fs.existsSync(extractedDataDir) ? extractedDataDir : tempExtractDir;
        
        // Merge selected items
        for (const item of items) {
          if (item === 'projects') {
            // Projects: Add projects that don't exist, keep existing ones
            console.log('📁 Merging projects...');
            const sourceEntries = fs.readdirSync(sourceDir);
            let mergedCount = 0;
            let skippedCount = 0;
            
            for (const entry of sourceEntries) {
              const sourcePath = path.join(sourceDir, entry);
              const destPath = path.join(dataDir, entry);
              
              // Skip system directories
              if (entry === 'backups' || entry === 'locks' || 
                  entry === 'ΠΡΟΣΚΛΗΣΕΙΣ' || entry === 'entaxeis' || 
                  entry === 'EGKRISEIS_DIATHESIS_PISTOSIS') continue;
              
              // Check if it's a project folder
              const stat = fs.statSync(sourcePath);
              if (stat.isDirectory()) {
                const dataJsonPath = path.join(sourcePath, 'data.json');
                if (fs.existsSync(dataJsonPath) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry)) {
                  // It's a project folder
                  if (!fs.existsSync(destPath)) {
                    // Project doesn't exist, copy it
                    fse.copySync(sourcePath, destPath);
                    mergedCount++;
                    console.log(`  ✅ Added project: ${entry}`);
                  } else {
                    // Project exists, skip (keep existing)
                    skippedCount++;
                    console.log(`  ⏭️ Skipped existing project: ${entry}`);
                  }
                }
              }
            }
            console.log(`  📊 Merged ${mergedCount} projects, skipped ${skippedCount} existing`);
          } else {
            // Merge specific directory: Copy items that don't exist
            const dirName = itemToDir[item];
            if (!dirName) continue;
            
            console.log(`📁 Merging ${item} (${dirName})...`);
            const sourcePath = path.join(sourceDir, dirName);
            const destPath = path.join(dataDir, dirName);
            
            if (fs.existsSync(sourcePath)) {
              // Ensure destination directory exists
              if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
              }
              
              // Copy items from source that don't exist in destination
              const sourceEntries = fs.readdirSync(sourcePath);
              let mergedCount = 0;
              let skippedCount = 0;
              
              for (const entry of sourceEntries) {
                const sourceEntryPath = path.join(sourcePath, entry);
                const destEntryPath = path.join(destPath, entry);
                
                if (!fs.existsSync(destEntryPath)) {
                  // Item doesn't exist, copy it
                  const stat = fs.statSync(sourceEntryPath);
                  if (stat.isDirectory()) {
                    fse.copySync(sourceEntryPath, destEntryPath);
                  } else {
                    fs.copyFileSync(sourceEntryPath, destEntryPath);
                  }
                  mergedCount++;
                } else {
                  skippedCount++;
                }
              }
              
              console.log(`  📊 Merged ${mergedCount} items, skipped ${skippedCount} existing`);
            } else {
              console.log(`  ⚠️ ${item} directory not found in backup`);
            }
          }
        }
        
        console.log('✅ Merge restore completed');
      }
      
      // Step 5: Cleanup temp directory
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      
      // Step 6: Update restore metadata
      const restoreInfo = {
        restoreId: uuidv4(),
        backupId: backupId,
        timestamp: new Date().toISOString(),
        type: type,
        safetyBackupId: safetyBackup ? safetyBackup.backupId : null,
        success: true
      };
      
      // Save restore history (optional)
      const restoreHistoryPath = path.join(backupDir, 'restore_history.json');
      let restoreHistory = [];
      if (fs.existsSync(restoreHistoryPath)) {
        try {
          restoreHistory = JSON.parse(fs.readFileSync(restoreHistoryPath, 'utf8'));
        } catch (e) {
          restoreHistory = [];
        }
      }
      restoreHistory.unshift(restoreInfo);
      safeWriteJSON(restoreHistoryPath, restoreHistory);
      
      console.log('✅ Restore completed successfully');
      
      return {
        success: true,
        message: 'Το restore ολοκληρώθηκε επιτυχώς',
        restoreInfo: restoreInfo,
        safetyBackup: safetyBackup
      };
      
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempExtractDir)) {
        try {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        } catch (e) {
          console.error('Error cleaning up temp directory:', e);
        }
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error restoring backup:', error);
    return {
      success: false,
      error: error.message,
      message: 'Σφάλμα κατά το restore: ' + error.message
    };
  }
}

// Restore backup IPC handler
ipcMain.handle('restore-backup', async (event, backupId, options = {}) => {
  try {
    const result = await restoreBackup(backupId, options);
    return result;
  } catch (error) {
    console.error('Error in restore-backup handler:', error);
    return { success: false, error: error.message };
  }
});

// Restart app IPC handler
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// ============================================================
// AUDIT TRAIL IPC HANDLERS
// ============================================================

// Get audit log
ipcMain.handle('get-audit-log', async (event, options = {}) => {
  try {
    const { limit = 1000, entityType = null, action = null, startDate = null, endDate = null, requestingUser = null } = options;
    
    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      try {
        auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
      } catch (e) {
        console.error('Error reading audit log:', e);
        return { success: false, error: 'Error reading audit log' };
      }
    }
    
    let filteredLogs = auditLog.logs || [];
    
    // Role-based visibility filtering
    if (requestingUser && requestingUser.role) {
      const role = requestingUser.role;
      const reqUsername = (requestingUser.username || '').toLowerCase();
      const reqFullName = (requestingUser.fullName || '').toLowerCase();
      
      if (role === 'ENGINEER') {
        filteredLogs = filteredLogs.filter(log => {
          const logUser = (log.userFullName || log.user || '').toLowerCase();
          return logUser === reqFullName || logUser === reqUsername;
        });
      } else if (role === 'ADMIN') {
        filteredLogs = filteredLogs.filter(log => {
          const logRole = (log.userRole || '').toUpperCase();
          if (!logRole) return true;
          return logRole === 'ADMIN' || logRole === 'ENGINEER' || logRole === 'USER';
        });
      }
      // SUPERADMIN sees everything - no filtering
    }
    
    // Filter by entity type
    if (entityType) {
      filteredLogs = filteredLogs.filter(log => log.entityType === entityType);
    }
    
    // Filter by action
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    
    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }
    
    // Apply limit
    filteredLogs = filteredLogs.slice(0, limit);
    
    return {
      success: true,
      logs: filteredLogs,
      total: auditLog.logs.length
    };
  } catch (error) {
    console.error('Error getting audit log:', error);
    return { success: false, error: error.message };
  }
});

// Clear audit log (keep last N entries)
ipcMain.handle('clear-audit-log', async (event, keepLast = 1000) => {
  try {
    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
    }
    
    if (auditLog.logs.length > keepLast) {
      auditLog.logs = auditLog.logs.slice(0, keepLast);
      safeWriteJSON(auditLogPath, auditLog);
      return { success: true, deletedCount: auditLog.logs.length - keepLast };
    }
    
    return { success: true, deletedCount: 0 };
  } catch (error) {
    console.error('Error clearing audit log:', error);
    return { success: false, error: error.message };
  }
});

// Fix projectId in audit log entries (for entries with wrong projectId)
ipcMain.handle('fix-audit-log-projectids', async (event) => {
  try {
    console.log('🔧 Starting audit log projectId fix...');
    
    // Load audit log
    let auditLog = { logs: [] };
    if (!fs.existsSync(auditLogPath)) {
      return { success: true, fixedCount: 0, message: 'No audit log found' };
    }
    
    try {
      auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
    } catch (e) {
      console.error('Error reading audit log:', e);
      return { success: false, error: 'Error reading audit log' };
    }
    
    if (!auditLog.logs || auditLog.logs.length === 0) {
      return { success: true, fixedCount: 0, message: 'No entries to fix' };
    }
    
    let fixedCount = 0;
    const projectIdMap = new Map(); // Cache για projectId lookups
    
    // Helper function για να βρούμε το σωστό projectId από το subprojectId
    const findCorrectProjectId = (subprojectId) => {
      if (!subprojectId) return null;
      
      // Check cache first
      if (projectIdMap.has(subprojectId)) {
        return projectIdMap.get(subprojectId);
      }
      
      // Search in all project directories
      if (!fs.existsSync(dataDir)) {
        return null;
      }
      
      const projectDirs = fs.readdirSync(dataDir);
      const skipDirs = new Set(['entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'locks', 'egkriseis_links', 'subproject_links', 
                                 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 
                                 'backups', 'audit_log.json']);
      
      for (const dir of projectDirs) {
        if (skipDirs.has(dir)) continue;
        
        const projectPath = path.join(dataDir, dir);
        if (!fs.statSync(projectPath).isDirectory()) continue;
        
        const subprojectPath = path.join(projectPath, subprojectId);
        if (fs.existsSync(subprojectPath) && fs.statSync(subprojectPath).isDirectory()) {
          // Found! The correct projectId is the folder name
          projectIdMap.set(subprojectId, dir);
          return dir;
        }
      }
      
      return null;
    };
    
    // Helper function για να διορθώσουμε το projectId σε ένα value object
    const fixProjectIdInValue = (value) => {
      if (!value || typeof value !== 'object') return false;
      
      if (value.subprojectId && value.projectId) {
        const correctProjectId = findCorrectProjectId(value.subprojectId);
        if (correctProjectId && correctProjectId !== value.projectId) {
          console.log(`  Fixing projectId: ${value.projectId} -> ${correctProjectId} (subprojectId: ${value.subprojectId})`);
          value.projectId = correctProjectId;
          return true;
        }
      }
      
      return false;
    };
    
    // Process all entries
    for (const entry of auditLog.logs) {
      let entryFixed = false;
      
      // Fix oldValue
      if (entry.oldValue && fixProjectIdInValue(entry.oldValue)) {
        entryFixed = true;
      }
      
      // Fix newValue
      if (entry.newValue && fixProjectIdInValue(entry.newValue)) {
        entryFixed = true;
      }
      
      // Fix changes object (if it contains projectId)
      if (entry.changes && typeof entry.changes === 'object') {
        if (entry.changes.projectId) {
          const subprojectId = entry.oldValue?.subprojectId || entry.newValue?.subprojectId;
          if (subprojectId) {
            const correctProjectId = findCorrectProjectId(subprojectId);
            if (correctProjectId) {
              // Fix old value in changes
              if (entry.changes.projectId.old) {
                const oldProjectId = entry.changes.projectId.old;
                if (oldProjectId !== correctProjectId) {
                  console.log(`  Fixing changes.projectId.old: ${oldProjectId} -> ${correctProjectId}`);
                  entry.changes.projectId.old = correctProjectId;
                  entryFixed = true;
                }
              }
              // Fix new value in changes
              if (entry.changes.projectId.new) {
                const newProjectId = entry.changes.projectId.new;
                if (newProjectId !== correctProjectId) {
                  console.log(`  Fixing changes.projectId.new: ${newProjectId} -> ${correctProjectId}`);
                  entry.changes.projectId.new = correctProjectId;
                  entryFixed = true;
                }
              }
            }
          }
        }
      }
      
      if (entryFixed) {
        fixedCount++;
      }
    }
    
    // Save fixed audit log
    if (fixedCount > 0) {
      // Create backup of original audit log
      const backupPath = `${auditLogPath}.backup.${Date.now()}`;
      fs.copyFileSync(auditLogPath, backupPath);
      console.log(`📦 Created backup: ${backupPath}`);
      
      // Save fixed audit log
      safeWriteJSON(auditLogPath, auditLog);
      console.log(`✅ Fixed ${fixedCount} audit log entries`);
    }
    
    return {
      success: true,
      fixedCount,
      totalEntries: auditLog.logs.length,
      message: fixedCount > 0 
        ? `Διορθώθηκαν ${fixedCount} καταγραφές από ${auditLog.logs.length} συνολικά`
        : 'Όλες οι καταγραφές είναι ήδη σωστές'
    };
  } catch (error) {
    console.error('Error fixing audit log projectIds:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// INVEST EXPORT IPC HANDLER
// ============================================================

const investExportHandler = require('./investExportHandler');

ipcMain.handle('export-invest-projects', async (event, options) => {
  try {
    const { year, month } = options;
    
    console.log(`📊 Export INVEST projects request: ${year}-${month}`);
    
    const exportDir = path.join(dataDir, 'ektelestea_erga');
    
    const templatePath = path.join(exportDir, 'INVEST202412_.xlsx');
    
    // Ensure export directory exists
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      return {
        success: false,
        error: 'Το αρχείο template (INVEST202412_.xlsx) δεν βρέθηκε στον φάκελο ektelestea_erga'
      };
    }
    
    // Call export function
    const result = await investExportHandler.exportInvestProjects({
      year,
      month,
      dataDir,
      exportDir,
      templatePath
    });
    
    if (!result.success) {
      return result;
    }
    
    // Προτροπή για λήψη αρχείου στον υπολογιστή του χρήστη
    const { dialog } = require('electron');
    const saveResult = await dialog.showSaveDialog({
      title: 'Αποθήκευση Εκτελεστέων Έργων',
      defaultPath: result.filename,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ]
    });
    
    if (!saveResult.canceled && saveResult.filePath) {
      // Αντιγραφή του αρχείου στη θέση που επέλεξε ο χρήστης
      fs.copyFileSync(result.outputPath, saveResult.filePath);
      console.log(`💾 File saved to: ${saveResult.filePath}`);
      
      return {
        ...result,
        downloadPath: saveResult.filePath
      };
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error exporting INVEST projects:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Rollback to previous state
ipcMain.handle('rollback-audit-entry', async (event, auditEntryId) => {
  try {
    // Load audit log
    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
    }
    
    // Find the audit entry
    const auditEntry = auditLog.logs.find(log => log.id === auditEntryId);
    if (!auditEntry) {
      return { success: false, error: 'Audit entry not found' };
    }
    
    // Only allow rollback for update and delete actions
    if (auditEntry.action === 'create') {
      return { success: false, error: 'Cannot rollback create action. Use delete instead.' };
    }
    
    // Create safety backup before rollback
    console.log('🛡️ Creating safety backup before rollback...');
    const safetyBackupResult = await createBackup({
      type: 'safety',
      background: false,
      notifyUser: false
    });
    
    if (!safetyBackupResult.success) {
      console.error('⚠️ Warning: Could not create safety backup');
      // Continue anyway but warn
    }
    
    // Perform rollback based on entity type
    if (auditEntry.entityType === 'subproject') {
      if (auditEntry.action === 'delete') {
        // Cannot rollback delete - data is gone
        return { success: false, error: 'Δεν μπορεί να γίνει rollback διαγραφής. Τα δεδομένα έχουν διαγραφεί.' };
      } else if (auditEntry.action === 'update' && auditEntry.oldValue) {
        // Restore old values
        const projectId = auditEntry.oldValue.projectId;
        const subprojectId = auditEntry.oldValue.subprojectId || auditEntry.entityId;
        
        if (!projectId || !subprojectId) {
          return { success: false, error: 'Missing projectId or subprojectId in audit entry' };
        }
        
        const subprojectDir = path.join(dataDir, projectId, subprojectId);
        const jsonPath = path.join(subprojectDir, 'data.json');
        
        // Ensure directory exists
        if (!fs.existsSync(subprojectDir)) {
          fs.mkdirSync(subprojectDir, { recursive: true });
        }
        
        // Restore old data
        const dataToRestore = {
          ...auditEntry.oldValue,
          updatedAt: new Date().toISOString(),
          restoredAt: new Date().toISOString(),
          restoredFromAuditEntry: auditEntryId
        };
        
        safeWriteJSON(jsonPath, dataToRestore);
        
        console.log(`✅ Rolled back subproject ${subprojectId} to previous state`);
        
        // Log the rollback action
        logAuditAction({
          type: 'update',
          entityType: 'subproject',
          entityId: subprojectId,
          entityTitle: `${dataToRestore.projectTitle || 'N/A'} - ${dataToRestore.subprojectTitle || 'N/A'}`,
          details: `Επαναφορά δεδομένων σε προηγούμενη κατάσταση`,
          oldValue: null, // Current state (we don't have it)
          newValue: dataToRestore
        });
        
        return { 
          success: true, 
          message: 'Το rollback ολοκληρώθηκε επιτυχώς',
          safetyBackup: safetyBackupResult.backupInfo
        };
      }
    }
    
    return { success: false, error: 'Rollback not supported for this entity type or action' };
  } catch (error) {
    console.error('Error rolling back audit entry:', error);
    return { success: false, error: error.message };
  }
});
