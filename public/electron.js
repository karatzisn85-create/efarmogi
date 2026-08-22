const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const os = require('os');
const { safeWriteJSON, safeWriteJSONAsync } = require('./safeWrite');
const { bootstrapConfig, setActiveDataDir, loadConfig, saveConfig } = require('./appConfig');
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
const { MANDATORY_UPDATE_WRITE_ERROR } = require('./appUpdatePolicy');
const { uploadPortalJson } = require('./portalDropboxUploader');
const { logger } = require('./logger');
const {
  createTaskAssignmentService,
  normalizeTaskAssignment,
  sanitizeTaskAssignmentForClient
} = require('./taskAssignmentService');
const {
  loadEmailConfig,
  saveEmailConfig,
  isConfigured,
  sendWorkspaceCreatedEmail,
  sendWorkspaceActivityEmail,
  sendTestEmail,
  buildLogoAttachment,
  buildAppOpenPromptHtml,
  getAppDisplayName,
} = require('./taskAssignmentEmailService');
const {
  hashPassword,
  verifyPassword,
  needsPasswordRehash,
  validatePasswordPolicy,
} = require('./passwordAuth');
const { createMeletaiService, DATA_DIR_SKIP_ROOT_DIRS } = require('./meletaiService');
const projectsIndex = require('./projectsIndex');
const concurrencyGuards = require('./concurrencyGuards');
const { mergeFileGroupsForSave, mergeEgkriseisForSave } = require('./subprojectSaveMerge');
const subprojectCardCore = require('../app/core/subprojectCard');
const subprojectLifecycleCore = require('../app/core/subprojectLifecycle');

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
  return subprojectCardCore.stripLegacySupervisorField(obj);
}

/** Μετονομασία παλιού «ΥΠΗΡΕΣΙΑ» → «ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ» */
function normalizeProjectTypeField(obj) {
  return subprojectCardCore.normalizeProjectTypeField(obj);
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
let heartbeatInterval = null;
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_STALE_MS = 45000;

function getHeartbeatDir() {
  if (!dataDir) return null;
  const dir = path.join(dataDir, 'ONLINE_STATUS');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeHeartbeat(username) {
  try {
    const dir = getHeartbeatDir();
    if (!dir || !username) return;
    const filePath = path.join(dir, `${username}.json`);
    const data = { username, timestamp: Date.now(), hostname: os.hostname(), pid: process.pid };
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (e) { /* ignore */ }
}

function removeHeartbeat(username) {
  try {
    const dir = getHeartbeatDir();
    if (!dir || !username) return;
    const filePath = path.join(dir, `${username}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) { /* ignore */ }
}

function startHeartbeat(username) {
  stopHeartbeat();
  writeHeartbeat(username);
  heartbeatInterval = setInterval(() => writeHeartbeat(username), HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
}

function getOnlineUsers() {
  try {
    const dir = getHeartbeatDir();
    if (!dir) return [];
    const now = Date.now();
    const online = [];
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        if (data.timestamp && (now - data.timestamp) < HEARTBEAT_STALE_MS) {
          online.push(data.username);
        } else {
          try { fs.unlinkSync(path.join(dir, file)); } catch {}
        }
      } catch {}
    }
    return online;
  } catch { return []; }
}

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    cleanupStaleEntityLocks();
    // Εκκίνηση του lock watcher
    startLockWatcher(mainWindow);
    // Καθαρισμός παλιών temp files κατά την εκκίνηση
    cleanupOldTempFiles();
    // Καθαρισμός αντιγράφων πριν την ανανέωση — στο παρασκήνιο, όχι στο πρώτο paint
    setTimeout(() => {
      try { cleanupOldKhmdhsSnapshots(); } catch { /* ignore */ }
    }, 5 * 60 * 1000);
  });

  // Error handlers for the window (Electron 28+: render-process-gone· κρατάμε και crashed για συμβατότητα)
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details?.reason || details);
  });
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
  const prevUser = loggedInUsername;
  if (typeof activeOrPayload === 'boolean') {
    dashboardSessionActive = activeOrPayload;
    if (!activeOrPayload) loggedInUsername = null;
  } else {
    const p = activeOrPayload && typeof activeOrPayload === 'object' ? activeOrPayload : {};
    dashboardSessionActive = Boolean(p.active);
    loggedInUsername =
      dashboardSessionActive && p.username ? String(p.username).trim() : null;
  }
  if (loggedInUsername) {
    startHeartbeat(loggedInUsername);
  } else {
    stopHeartbeat();
    if (prevUser) removeHeartbeat(prevUser);
  }
  return { ok: true };
});

ipcMain.handle('get-online-users', () => {
  return { success: true, onlineUsers: getOnlineUsers() };
});

ipcMain.handle('save-app-config', async (_event, newConfig) => {
  // Ενημέρωση in-memory dataDir πριν από οποιαδήποτε εγγραφή (κρίσιμο για setup wizard)
  if (newConfig.dataDir) {
    dataDir = newConfig.dataDir;
    setActiveDataDir(newConfig.dataDir);
    ensureSubDirs();
    // Ανανέωση μονοπατιών που εξαρτώνται από τον φάκελο δεδομένων
    locksDir = path.join(dataDir, 'locks');
    backupSettingsPath = path.join(dataDir, 'backup_settings.json');
    auditLogPath = path.join(dataDir, 'audit_log.json');
    backupDir = resolveBackupDir();
    if (auditLogPath && !fs.existsSync(auditLogPath)) {
      try { safeWriteJSON(auditLogPath, { logs: [] }); } catch (_e) { /* non-critical */ }
    }
  }

  saveConfig(newConfig);

  // Αποθήκευση org στοιχείων στον dataDir ώστε να είναι διαθέσιμα σε επόμενες εγκαταστάσεις
  // (π.χ. νέο μηχάνημα που δείχνει στον ίδιο κοινόχρηστο φάκελο)
  if (newConfig.organizationName !== undefined || newConfig.organizationFullName !== undefined) {
    const targetDir = newConfig.dataDir || dataDir;
    if (targetDir && fs.existsSync(targetDir)) {
      const merged = loadConfig(true);
      const orgData = {
        organizationType:    merged.organizationType    || newConfig.organizationType    || '',
        organizationName:    merged.organizationName    || newConfig.organizationName    || '',
        organizationFullName:merged.organizationFullName|| newConfig.organizationFullName|| '',
        department:          merged.department          || newConfig.department          || '',
      };
      try {
        safeWriteJSON(path.join(targetDir, 'org-config.json'), orgData);
      } catch (_e) { /* non-critical */ }
    }
  }

  // Relaunch μόνο όταν ολοκληρώνεται η αρχική ρύθμιση — όχι σε ενδιάμεση αποθήκευση dataDir
  if (newConfig.setupCompleted === true) {
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
  // Διαβάζουμε τα org στοιχεία που αποθηκεύτηκαν στον dataDir κατά την αρχική ρύθμιση
  let orgConfig = null;
  const orgConfigPath = path.join(folderPath, 'org-config.json');
  if (fs.existsSync(orgConfigPath)) {
    try { orgConfig = JSON.parse(fs.readFileSync(orgConfigPath, 'utf8')); } catch (_e) { /* ignore */ }
  }
  return { hasUsers, hasProjects: projectCount > 0, projectCount, orgConfig };
});

// ── User Management ──
// Hashing: public/passwordAuth.js (scrypt + συμβατότητα παλιού SHA-256)

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

function orimanthiEditEligibleRole(role) {
  return role === 'USER' || role === 'ENGINEER';
}

function resolveOrimanthiCanEditFlag(user) {
  return orimanthiEditEligibleRole(user?.role) && user.orimanthiCanEdit === true;
}

function meletaiEditEligibleRole(role) {
  return role === 'USER' || role === 'ENGINEER';
}

function resolveMeletaiCanEditFlag(user) {
  return meletaiEditEligibleRole(user?.role) && user.meletaiCanEdit === true;
}

function canManageMeletaiUser(user) {
  if (!user) return false;
  if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
  return resolveMeletaiCanEditFlag(user);
}

function isSuperAdminUser(username) {
  const u = findUserByUsername(username);
  return !!(u && u.role === 'SUPERADMIN');
}

function isSuperAdminOrAdminUser(username) {
  const u = findUserByUsername(username);
  return !!(u && (u.role === 'SUPERADMIN' || u.role === 'ADMIN'));
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
  const user = users.find((u) => (
    u.username.toLowerCase() === String(username || '').toLowerCase()
    && u.active !== false
    && verifyPassword(password, u.passwordHash)
  ));
  if (!user) return { success: false, error: 'Λάθος όνομα χρήστη ή κωδικός' };
  if (user.approved === false) return { success: false, error: 'Ο λογαριασμός σας αναμένει έγκριση από τον διαχειριστή' };

  // Μετάβαση: παλιά hashes αναβαθμίζονται αθόρυβα μετά από επιτυχή είσοδο.
  if (needsPasswordRehash(user.passwordHash)) {
    try {
      user.passwordHash = hashPassword(password);
      saveUsers(users);
    } catch (e) {
      logger.warn('authenticate', 'password rehash failed', e?.message || e);
    }
  }

  return {
    success: true,
    user: {
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      assignedSupervisors: Array.isArray(user.assignedSupervisors) ? user.assignedSupervisors : [],
      taskAssignment: sanitizeTaskAssignmentForClient(user.taskAssignment),
      orimanthiCanEdit: resolveOrimanthiCanEditFlag(user),
      meletaiCanEdit: resolveMeletaiCanEditFlag(user),
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
  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return { success: false, error: policy.error };

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
    ...(u.email ? { email: u.email } : {}),
    active: u.active !== false,
    approved: u.approved !== false,
    createdAt: u.createdAt,
    assignedSupervisors: Array.isArray(u.assignedSupervisors) ? u.assignedSupervisors : [],
    taskAssignment: sanitizeTaskAssignmentForClient(u.taskAssignment),
    orimanthiCanEdit: resolveOrimanthiCanEditFlag(u),
    meletaiCanEdit: resolveMeletaiCanEditFlag(u),
  }));
});

ipcMain.handle('get-my-notification-preferences', async (_event, { actingUsername } = {}) => {
  const user = findUserByUsername(actingUsername || loggedInUsername);
  if (!user) return { success: false, error: 'Χρήστης δεν βρέθηκε' };
  return { success: true, preferences: user.notificationPreferences || {} };
});

ipcMain.handle('save-my-notification-preferences', async (_event, { actingUsername, preferences } = {}) => {
  const username = actingUsername || loggedInUsername;
  const users = loadUsers();
  const idx = users.findIndex(u => u.username?.toLowerCase() === String(username || '').toLowerCase());
  if (idx < 0) return { success: false, error: 'Χρήστης δεν βρέθηκε' };
  users[idx].notificationPreferences = {
    calendarEmail: preferences?.calendarEmail !== false,
    aepoEmail: preferences?.aepoEmail !== false,
    noteEmail: preferences?.noteEmail !== false,
    workspaceToasts: preferences?.workspaceToasts !== false,
    quietHoursEnabled: preferences?.quietHoursEnabled === true,
    quietHoursStart: String(preferences?.quietHoursStart || '22:00'),
    quietHoursEnd: String(preferences?.quietHoursEnd || '08:00'),
  };
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('create-user', async (_event, { username, password, role, fullName, email, assignedSupervisors = [], taskAssignment, orimanthiCanEdit, meletaiCanEdit, actingUsername }) => {
  const users = loadUsers();
  const noUsersYet = users.length === 0;
  const actor = actingUsername || loggedInUsername;
  // Αρχική ρύθμιση (κανένας χρήστης) ή μόνο SUPERADMIN.
  if (!noUsersYet && !isSuperAdminUser(actor)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χρηστών' };
  }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Το όνομα χρήστη υπάρχει ήδη' };
  }
  const validRoles = ['SUPERADMIN', 'ADMIN', 'USER', 'ENGINEER'];
  if (!validRoles.includes(role)) return { success: false, error: 'Μη έγκυρος ρόλος' };
  // Κατά bootstrap επιτρέπεται μόνο SUPERADMIN.
  if (noUsersYet && role !== 'SUPERADMIN') {
    return { success: false, error: 'Ο πρώτος λογαριασμός πρέπει να είναι Υπερδιαχειριστής' };
  }
  const policy = validatePasswordPolicy(password);
  if (!policy.ok) return { success: false, error: policy.error };
  const normalizedSupervisors = Array.isArray(assignedSupervisors)
    ? [...new Set(assignedSupervisors.map(s => String(s || '').trim()).filter(Boolean))]
    : [];

  let taskAssignmentNorm = normalizeTaskAssignment({ canAssign: false, assignableScope: 'none', assignableUsernames: [] });
  if (taskAssignment !== undefined) {
    if (!isSuperAdminUser(actor)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να ορίσει δικαιώματα χώρου εργασίας' };
    }
    taskAssignmentNorm = normalizeTaskAssignment(taskAssignment);
  }

  if (orimanthiCanEdit !== undefined && !isSuperAdminUser(actor)) {
    return { success: false, error: 'Μόνο ο superadmin μπορεί να ορίσει δικαιώματα ωρίμανσης έργων' };
  }
  if (meletaiCanEdit !== undefined && !isSuperAdminUser(actor)) {
    return { success: false, error: 'Μόνο ο superadmin μπορεί να ορίσει δικαιώματα μητρώου μελετών' };
  }

  const newUserEmail = String(email || '').trim().toLowerCase() || null;
  users.push({
    username: username.trim(),
    passwordHash: hashPassword(password),
    role,
    fullName: fullName || username,
    ...(newUserEmail ? { email: newUserEmail } : {}),
    active: true,
    approved: role === 'SUPERADMIN' ? true : false,
    assignedSupervisors: role === 'ENGINEER' ? normalizedSupervisors : [],
    taskAssignment: taskAssignmentNorm,
    ...(orimanthiEditEligibleRole(role) && orimanthiCanEdit === true ? { orimanthiCanEdit: true } : {}),
    ...(meletaiEditEligibleRole(role) && meletaiCanEdit === true ? { meletaiCanEdit: true } : {}),
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
  const actor = actingUsername || loggedInUsername;
  if (!isSuperAdminUser(actor)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα ενημέρωσης χρηστών' };
  }
  const users = loadUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  const oldUserData = { ...users[idx] };
  delete oldUserData.passwordHash;

  if (updates.fullName !== undefined) users[idx].fullName = updates.fullName;
  if (updates.role !== undefined) users[idx].role = updates.role;
  if (updates.active !== undefined) users[idx].active = updates.active;
  if (updates.approved !== undefined) users[idx].approved = updates.approved;
  if (updates.password) {
    const policy = validatePasswordPolicy(updates.password);
    if (!policy.ok) return { success: false, error: policy.error };
    users[idx].passwordHash = hashPassword(updates.password);
  }
  if ('email' in updates) {
    const emailVal = String(updates.email || '').trim().toLowerCase() || null;
    if (emailVal) {
      users[idx].email = emailVal;
    } else {
      delete users[idx].email;
    }
  }
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
    if (!isSuperAdminUser(actor)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να αλλάξει δικαιώματα χώρου εργασίας' };
    }
    users[idx].taskAssignment = normalizeTaskAssignment(updates.taskAssignment);
  }
  if (updates.orimanthiCanEdit !== undefined) {
    if (!isSuperAdminUser(actor)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να αλλάξει δικαιώματα ωρίμανσης έργων' };
    }
    const effectiveRole = updates.role !== undefined ? updates.role : users[idx].role;
    if (orimanthiEditEligibleRole(effectiveRole) && updates.orimanthiCanEdit === true) {
      users[idx].orimanthiCanEdit = true;
    } else {
      delete users[idx].orimanthiCanEdit;
    }
  }
  if (updates.meletaiCanEdit !== undefined) {
    if (!isSuperAdminUser(actor)) {
      return { success: false, error: 'Μόνο ο superadmin μπορεί να αλλάξει δικαιώματα μητρώου μελετών' };
    }
    const effectiveRole = updates.role !== undefined ? updates.role : users[idx].role;
    if (meletaiEditEligibleRole(effectiveRole) && updates.meletaiCanEdit === true) {
      users[idx].meletaiCanEdit = true;
    } else {
      delete users[idx].meletaiCanEdit;
    }
  }
  if (updates.role !== undefined && !orimanthiEditEligibleRole(updates.role)) {
    delete users[idx].orimanthiCanEdit;
  }
  if (updates.role !== undefined && !meletaiEditEligibleRole(updates.role)) {
    delete users[idx].meletaiCanEdit;
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

ipcMain.handle('delete-user', async (_event, { username, actingUsername } = {}) => {
  const actor = actingUsername || loggedInUsername;
  if (!isSuperAdminUser(actor)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα διαγραφής χρηστών' };
  }
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
  const targetName = String(username || '').trim();
  const actor = String(loggedInUsername || '').trim();
  if (!actor || actor.toLowerCase() !== targetName.toLowerCase()) {
    return { success: false, error: 'Δεν έχετε δικαίωμα αλλαγής κωδικού άλλου χρήστη' };
  }
  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === targetName.toLowerCase());
  if (!user) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  if (!verifyPassword(oldPassword, user.passwordHash)) {
    return { success: false, error: 'Ο τρέχων κωδικός είναι λάθος' };
  }
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) return { success: false, error: policy.error };

  user.passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
});

ipcMain.handle('has-users', async () => {
  const users = loadUsers();
  return users.length > 0;
});

ipcMain.handle('rename-user', async (_event, { username, currentPassword, newUsername }) => {
  const targetName = String(username || '').trim();
  const actor = String(loggedInUsername || '').trim();
  if (!actor || actor.toLowerCase() !== targetName.toLowerCase()) {
    return { success: false, error: 'Δεν έχετε δικαίωμα μετονομασίας άλλου χρήστη' };
  }
  const users = loadUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === targetName.toLowerCase());
  if (idx === -1) return { success: false, error: 'Χρήστης δεν βρέθηκε' };

  if (!verifyPassword(currentPassword, users[idx].passwordHash)) {
    return { success: false, error: 'Ο τρέχων κωδικός είναι λάθος' };
  }

  const trimmed = String(newUsername || '').trim();
  if (!trimmed) return { success: false, error: 'Εισάγετε νέο όνομα χρήστη' };
  if (trimmed.toLowerCase() === username.toLowerCase()) {
    return { success: false, error: 'Το νέο username είναι ίδιο με το τρέχον' };
  }
  if (users.some(u => u.username.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, error: 'Το username χρησιμοποιείται ήδη από άλλον χρήστη' };
  }

  const oldUsername = users[idx].username;
  users[idx].username = trimmed;
  saveUsers(users);
  logAuditAction({
    type: 'update',
    entityType: 'user',
    entityId: trimmed,
    entityTitle: users[idx].fullName || trimmed,
    details: `Username άλλαξε από "${oldUsername}" σε "${trimmed}"`
  });
  return { success: true };
});

// ── Auto-Update ──
let updater = null;
let mandatoryUpdateKnown = false;
let mandatoryInstallerReady = false;

function rememberUpdateCheck(updateInfo) {
  if (!updateInfo) return updateInfo;
  if (updateInfo.error) return updateInfo;
  if (!updateInfo.available) {
    mandatoryUpdateKnown = false;
    mandatoryInstallerReady = false;
    return updateInfo;
  }
  mandatoryUpdateKnown = !!updateInfo.mandatory;
  if (!mandatoryUpdateKnown) mandatoryInstallerReady = false;
  return updateInfo;
}

function writesBlockedByMandatoryUpdate() {
  return mandatoryUpdateKnown && mandatoryInstallerReady;
}

function withMandatoryUpdateGuard(handler) {
  return async (event, ...args) => {
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
    return handler(event, ...args);
  };
}

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

      const updateInfo = rememberUpdateCheck(await updater.checkForUpdates());
      if (updateInfo.available) {
        console.log(`[Update] New version available: ${updateInfo.version}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', updateInfo);
        }
        if (UPDATE_CONFIG.AUTO_DOWNLOAD) {
          try {
            const downloadPath = await updater.downloadUpdate(updateInfo.downloadUrl);
            if (downloadPath) {
              if (mandatoryUpdateKnown) mandatoryInstallerReady = true;
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-downloaded', {
                  version: updateInfo.version, path: downloadPath, mandatory: !!updateInfo.mandatory
                });
              }
            }
          } catch (dlErr) {
            mandatoryInstallerReady = false;
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
        const updateInfo = rememberUpdateCheck(await updater.checkForUpdates());
        if (updateInfo.available && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', updateInfo);
          if (UPDATE_CONFIG.AUTO_DOWNLOAD) {
            const downloadPath = await updater.downloadUpdate(updateInfo.downloadUrl);
            if (downloadPath) {
              if (mandatoryUpdateKnown) mandatoryInstallerReady = true;
              if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-downloaded', {
                  version: updateInfo.version, path: downloadPath, mandatory: !!updateInfo.mandatory
                });
              }
            }
          }
        }
      } catch (_e) { /* silent */ }
    }, UPDATE_CONFIG.CHECK_INTERVAL);
  }
}

ipcMain.handle('check-for-updates', async () => {
  if (!updater) return { available: false, error: 'Updater not initialized' };
  return rememberUpdateCheck(await updater.checkForUpdates());
});

ipcMain.handle('download-update', async (_event, downloadUrl) => {
  if (!updater) throw new Error('Updater not initialized');
  try {
    const downloadPath = await updater.downloadUpdate(downloadUrl);
    if (downloadPath && mandatoryUpdateKnown) mandatoryInstallerReady = true;
    return downloadPath;
  } catch (err) {
    mandatoryInstallerReady = false;
    throw err;
  }
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
    stopHeartbeat();
    if (loggedInUsername) removeHeartbeat(loggedInUsername);

    if (lockWatcher) { lockWatcher.close(); lockWatcher = null; }
    if (activeTaskWatcher) { activeTaskWatcher.close(); activeTaskWatcher = null; }
    
    // Clean up mainWindow reference
    mainWindow = null;
    
    // Καθαρισμός lock files κατά το κλείσιμο της εφαρμογής
    try {
      // Χωρίς φάκελο δεδομένων δεν υπάρχει τίποτα να καθαριστεί — αλλά η εφαρμογή
      // πρέπει να κλείσει κανονικά, αλλιώς μένει ζωντανή στο παρασκήνιο.
      if (!dataDir) { app.quit(); return; }
      const myHostname = os.hostname();
      // Old-style locks
      if (fs.existsSync(dataDir)) {
        for (const dir of fs.readdirSync(dataDir)) {
          try {
            const lockFile = path.join(dataDir, dir, '.lock');
            if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
          } catch {}
        }
      }
      // New-style locks — σβήνουμε μόνο τα δικά μας (ίδιο hostname)
      const locksDir = path.join(dataDir, 'locks');
      if (fs.existsSync(locksDir)) {
        for (const entityType of fs.readdirSync(locksDir)) {
          const entityDir = path.join(locksDir, entityType);
          try {
            if (!fs.statSync(entityDir).isDirectory()) continue;
          } catch { continue; }
          for (const lockFile of fs.readdirSync(entityDir)) {
            if (!lockFile.endsWith('.lock')) continue;
            const lockPath = path.join(entityDir, lockFile);
            try {
              const lockData = readLockData(lockPath);
              if (!lockData || lockData.hostname === myHostname) {
                fs.unlinkSync(lockPath);
              }
            } catch {
              try { fs.unlinkSync(lockPath); } catch {}
            }
          }
        }
      }
      // Σήμανση μαζικής ανανέωσης αυτού του υπολογιστή: αλλιώς οι υπόλοιποι θα περίμεναν
      // άσκοπα μέχρι να λήξει ο σφυγμός.
      try {
        const runPath = path.join(dataDir, 'config', KHMDHS_BATCH_RUN_FILE);
        if (fs.existsSync(runPath)) {
          const runState = JSON.parse(fs.readFileSync(runPath, 'utf8'));
          if (!runState?.host || runState.host === myHostname) fs.unlinkSync(runPath);
        }
      } catch { /* λήγει μόνη της χωρίς σφυγμό */ }
    } catch (error) {
      console.error('[lock] Error cleaning up lock files:', error);
    }
    
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let dataDir = bootstrapConfig(app);

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
  'ANATHESEIS_ERGASION',
  'ΑΠΟΛΟΓΙΣΜΟΣ'
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


let locksDir = dataDir ? path.join(dataDir, 'locks') : null;

// Εκκίνηση file watcher για locks
function startLockWatcher(mainWindow) {
  if (!locksDir) {
    console.log('Lock watcher skipped — δεν έχει οριστεί ακόμη φάκελος δεδομένων.');
    return;
  }
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
        if (mainWindow && !mainWindow.isDestroyed()) {
          const parts = String(filename).replace(/\\/g, '/').split('/').filter(Boolean);
          const last = parts[parts.length - 1] || '';
          const entityId = last.toLowerCase().endsWith('.lock')
            ? last.slice(0, -5)
            : '';
          const entityType = parts.length >= 2 ? parts[parts.length - 2] : 'projects';
          mainWindow.webContents.send('locks-changed', {
            eventType,
            entityType,
            entityId,
          });
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

// ============================================================
// LOCK FILE HELPERS
// ============================================================

const LOCK_STALE_REMOTE_MS = 30 * 60 * 1000; // 30 λεπτά για remote locks
const LOCK_STALE_LOCAL_MS = 8 * 60 * 60 * 1000; // 8 ώρες για τοπικά locks με νεκρό PID ή χωρίς ανανέωση

// Check if process is running (τοπικό μόνο)
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

// Διαβάζει lock file — επιστρέφει parsed object ή null αν stale/ανύπαρκτο
function readLockData(lockFile) {
  try {
    const raw = fs.readFileSync(lockFile, 'utf8').trim();
    // Νέο format: JSON
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    // Παλιό format: plain PID number — μετατροπή σε object
    const pid = parseInt(raw);
    return { hostname: os.hostname(), username: '', pid, createdAt: null };
  } catch {
    return null;
  }
}

// Ελέγχει αν ένα lock object είναι ακόμα έγκυρο
function isLockValid(lockData) {
  if (!lockData) return false;
  const myHostname = os.hostname();
  if (lockData.hostname === myHostname) {
    if (lockData.pid === process.pid) return true;
    if (!isProcessRunning(lockData.pid)) return false;
    if (lockData.createdAt) {
      const age = Date.now() - new Date(lockData.createdAt).getTime();
      if (age >= LOCK_STALE_LOCAL_MS) return false;
    }
    return true;
  }
  // Απομακρυσμένο: stale αν > 30 λεπτά χωρίς ανανέωση
  if (!lockData.createdAt) return true; // παλιό format από άλλο PC — θεωρείται έγκυρο
  const age = Date.now() - new Date(lockData.createdAt).getTime();
  return age < LOCK_STALE_REMOTE_MS;
}

function cleanupStaleEntityLocks() {
  try {
    if (!dataDir) return { removed: 0 };
    const locksDir = path.join(dataDir, 'locks');
    if (!fs.existsSync(locksDir)) return { removed: 0 };
    let removed = 0;
    for (const entityType of fs.readdirSync(locksDir)) {
      const entityDir = path.join(locksDir, entityType);
      try {
        if (!fs.statSync(entityDir).isDirectory()) continue;
      } catch { continue; }
      for (const lockFile of fs.readdirSync(entityDir)) {
        if (!lockFile.endsWith('.lock')) continue;
        const lockPath = path.join(entityDir, lockFile);
        try {
          const lockData = readLockData(lockPath);
          if (!isLockValid(lockData)) {
            fs.unlinkSync(lockPath);
            removed += 1;
          }
        } catch { /* ignore */ }
      }
    }
    if (removed > 0) console.log(`[lock] Cleaned ${removed} stale entity lock(s) at startup`);
    return { removed };
  } catch (error) {
    console.error('[lock] cleanupStaleEntityLocks failed:', error);
    return { removed: 0 };
  }
}

// Generic lock file creation
function createEntityLock(entityType, entityId, username) {
  try {
    const locksDir = path.join(dataDir, 'locks', entityType);
    if (!fs.existsSync(locksDir)) {
      fs.mkdirSync(locksDir, { recursive: true });
    }
    const lockFile = path.join(locksDir, `${entityId}.lock`);

    if (fs.existsSync(lockFile)) {
      const lockData = readLockData(lockFile);
      if (isLockValid(lockData)) {
        if (lockData.username === (username || '')) {
          return { success: true, alreadyHeld: true };
        }
        const who = lockData.username || lockData.hostname || 'άλλον χρήστη';
        return { success: false, error: `Ανοιχτό από: ${who}`, lockedBy: who };
      }
      // stale — σβήνουμε
      try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
    }

    const lockData = {
      hostname: os.hostname(),
      username: username || '',
      pid: process.pid,
      createdAt: new Date().toISOString()
    };
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeSync(fd, JSON.stringify(lockData));
      fs.closeSync(fd);
    } catch (writeErr) {
      if (writeErr.code === 'EEXIST' && fs.existsSync(lockFile)) {
        const lockDataExisting = readLockData(lockFile);
        if (isLockValid(lockDataExisting)) {
          const who = lockDataExisting.username || lockDataExisting.hostname || 'άλλον χρήστη';
          return { success: false, error: `Ανοιχτό από: ${who}`, lockedBy: who };
        }
        try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
        const fd = fs.openSync(lockFile, 'wx');
        fs.writeSync(fd, JSON.stringify(lockData));
        fs.closeSync(fd);
      } else {
        throw writeErr;
      }
    }
    console.log(`[lock] Created lock for ${entityType}/${entityId} by ${username || 'unknown'}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create lock file for project (backward compatibility)
function createProjectLock(projectId, username) {
  return createEntityLock('projects', projectId, username);
}

// Generic lock file removal
function removeEntityLock(entityType, entityId) {
  try {
    const locksDir = path.join(dataDir, 'locks', entityType);
    const lockFile = path.join(locksDir, `${entityId}.lock`);
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      console.log(`[lock] Removed lock for ${entityType}/${entityId}`);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Remove lock file for project (backward compatibility)
function removeProjectLock(projectId) {
  try {
    const oldLock = path.join(dataDir, projectId, '.lock');
    if (fs.existsSync(oldLock)) fs.unlinkSync(oldLock);
  } catch {}
  return removeEntityLock('projects', projectId);
}

// Generic check if entity is locked — επιστρέφει { locked, lockedBy }
function isEntityLocked(entityType, entityId) {
  try {
    const locksDir = path.join(dataDir, 'locks', entityType);
    const lockFile = path.join(locksDir, `${entityId}.lock`);
    if (!fs.existsSync(lockFile)) return { locked: false };

    const lockData = readLockData(lockFile);
    if (!lockData) { fs.unlinkSync(lockFile); return { locked: false }; }

    if (isLockValid(lockData)) {
      const lockedBy = lockData.username || lockData.hostname || '';
      return { locked: true, lockedBy, hostname: lockData.hostname };
    }
    // stale — σβήνουμε
    fs.unlinkSync(lockFile);
    return { locked: false };
  } catch (error) {
    return { locked: false, error: error.message };
  }
}

// Check if project is locked (backward compatibility + old-style check)
function isProjectLocked(projectId) {
  // Πρώτα παλιό format lock
  try {
    const oldLock = path.join(dataDir, projectId, '.lock');
    if (fs.existsSync(oldLock)) {
      const raw = fs.readFileSync(oldLock, 'utf8').trim();
      const pid = parseInt(raw);
      if (!isNaN(pid) && isProcessRunning(pid)) {
        return { locked: true, lockedBy: os.hostname() };
      }
      fs.unlinkSync(oldLock);
    }
  } catch {}
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

    // Καθαρισμός παλιών (old-style) project locks
    if (fs.existsSync(dataDir)) {
      for (const dir of fs.readdirSync(dataDir)) {
        const lockFile = path.join(dataDir, dir, '.lock');
        if (!fs.existsSync(lockFile)) continue;
        try {
          const lockData = readLockData(lockFile);
          if (!isLockValid(lockData)) {
            fs.unlinkSync(lockFile);
            clearedCount++;
            console.log(`[lock] Cleared stale old-style lock: ${dir}`);
          }
        } catch {
          try { fs.unlinkSync(lockFile); clearedCount++; } catch {}
        }
      }
    }

    // Καθαρισμός new-style locks
    const locksDir = path.join(dataDir, 'locks');
    if (fs.existsSync(locksDir)) {
      for (const entityType of fs.readdirSync(locksDir)) {
        const entityDir = path.join(locksDir, entityType);
        try {
          if (!fs.statSync(entityDir).isDirectory()) continue;
        } catch { continue; }
        for (const lockFile of fs.readdirSync(entityDir)) {
          if (!lockFile.endsWith('.lock')) continue;
          const lockPath = path.join(entityDir, lockFile);
          try {
            const lockData = readLockData(lockPath);
            if (!isLockValid(lockData)) {
              fs.unlinkSync(lockPath);
              clearedCount++;
              console.log(`[lock] Cleared stale ${entityType} lock: ${lockFile}`);
            } else {
              console.log(`[lock] Keeping active ${entityType} lock: ${lockFile} (${lockData.hostname}/${lockData.username})`);
            }
          } catch {
            try { fs.unlinkSync(lockPath); clearedCount++; } catch {}
          }
        }
      }
    }

    return { success: true, clearedCount };
  } catch (error) {
    console.error('[lock] Error clearing locks:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler για ξεκλείδωμα συγκεκριμένου project - REMOVED (duplicate, see backward compatibility section)

// Generic IPC Handlers για locking system
ipcMain.handle('create-entity-lock', async (event, entityType, entityId, username) => {
  return createEntityLock(entityType, entityId, username);
});

ipcMain.handle('remove-entity-lock', async (event, entityType, entityId) => {
  return removeEntityLock(entityType, entityId);
});

ipcMain.handle('check-entity-lock', async (event, entityType, entityId) => {
  return isEntityLocked(entityType, entityId);
});

// Backward compatibility για project locks
// Το subprojectId είναι προαιρετικό: όταν δίνεται, δεν ανοίγουμε για επεξεργασία υποέργο
// που κρατά εκείνη τη στιγμή μια ανανέωση ΚΗΜΔΗΣ (κλειδώνει ανά υποέργο, όχι ανά έργο).
ipcMain.handle('create-project-lock', async (event, projectId, username, subprojectId) => {
  const sid = String(subprojectId || '').trim();
  if (sid) {
    const busy = isEntityLocked('projects', sid);
    if (busy.locked && busy.lockedBy && busy.lockedBy !== String(username || '').trim()) {
      return {
        success: false,
        error: `Ανοιχτό από: ${busy.lockedBy}`,
        lockedBy: busy.lockedBy,
      };
    }
  }
  return createProjectLock(projectId, username);
});

ipcMain.handle('check-project-lock', async (event, projectId) => {
  return isProjectLocked(projectId);
});

// Bulk έλεγχος κλειδωμάτων — αντικαθιστά N σειριακά/παράλληλα IPC με ένα (Φάση 1 βελτίωσης απόδοσης)
ipcMain.handle('check-projects-locks-bulk', async (_event, projectIds) => {
  const ids = Array.isArray(projectIds) ? [...new Set(projectIds.filter(Boolean))] : [];
  const result = {};
  for (const projectId of ids) {
    try {
      const lockStatus = isProjectLocked(projectId);
      result[projectId] = { locked: !!lockStatus.locked, lockedBy: lockStatus.lockedBy || '' };
    } catch {
      result[projectId] = { locked: false, lockedBy: '' };
    }
  }
  return { success: true, locks: result };
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
    
    // 4. Ενημέρωση συνδεδεμένων μελετών (τίτλος έργου)
    try {
      const meletaiSvc = getMeletaiService();
      if (meletaiSvc && fs.existsSync(projectDir)) {
        for (const subprojectDir of fs.readdirSync(projectDir)) {
          const subprojectPath = path.join(projectDir, subprojectDir);
          try {
            if (!fs.statSync(subprojectPath).isDirectory()) continue;
          } catch { continue; }
          const dataFile = path.join(subprojectPath, 'data.json');
          if (!fs.existsSync(dataFile)) continue;
          try {
            const subprojectData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            if (subprojectData.subprojectId) {
              meletaiSvc.syncLinkedTitlesForSubproject(subprojectData.subprojectId, {
                projectTitle: newProjectTitle,
                subprojectTitle: subprojectData.subprojectTitle || '',
              });
            }
          } catch (err) {
            console.error(`Error syncing meletai titles for subproject ${subprojectDir}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing meletai linked project titles:', err);
    }

    console.log('Finished updating related data after project title change');
  } catch (error) {
    console.error('Error updating related data after project title change:', error);
    throw error;
  }
}

function isPathInsideDir(candidatePath, rootDir) {
  if (!candidatePath || !rootDir) return false;
  try {
    const resolved = path.resolve(candidatePath);
    const root = path.resolve(rootDir);
    return resolved === root || resolved.startsWith(root + path.sep);
  } catch {
    return false;
  }
}

/** Μετά την αντιγραφή στον φάκελο υποέργου, κρατά μόνο όνομα — όχι προσωρινό path. */
function normalizeFileGroupsAfterCopy(fileGroups, filesDir) {
  const root = path.resolve(filesDir);
  return (fileGroups || []).map((group) => ({
    ...group,
    files: (group.files || []).map((file) => {
      const name = typeof file === 'string'
        ? path.basename(file)
        : String(file?.name || file?.fileName || '').trim()
          || (file?.path ? path.basename(file.path) : '');
      if (!name) return file;
      const localPath = path.join(filesDir, name);
      if (fs.existsSync(localPath)) return { name };
      if (typeof file === 'object' && file.path && isPathInsideDir(file.path, root) && fs.existsSync(file.path)) {
        return { name };
      }
      return typeof file === 'string' ? name : { ...file, name };
    }),
  }));
}

function findFileInDirectoryTree(dir, fileName) {
  const target = String(fileName || '').trim().toLowerCase();
  if (!target || !fs.existsSync(dir)) return null;

  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let items = [];
    try {
      items = fs.readdirSync(current);
    } catch {
      continue;
    }
    for (const item of items) {
      const itemPath = path.join(current, item);
      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          stack.push(itemPath);
        } else if (stat.isFile() && item.toLowerCase().trim() === target) {
          return itemPath;
        }
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

// IPC Handlers για διαχείριση αρχείων
async function handleSaveProjectData(event, projectData) {
  try {
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
    // Προαιρετικός έλεγχος «άλλαξε στο μεταξύ;»: ο καλών δηλώνει σε ποια έκδοση του υποέργου
    // βασίστηκε. Γίνεται ΠΡΙΝ από οποιαδήποτε αλλαγή στον δίσκο, ώστε να μη μείνει τίποτα μισό.
    const expectedUpdatedAt = projectData.__expectedUpdatedAt;
    delete projectData.__expectedUpdatedAt;
    if (expectedUpdatedAt && projectData.subprojectId) {
      let currentUpdatedAt = '';
      try {
        const currentPath = findSubprojectDataJsonPath(projectData.subprojectId);
        if (currentPath) {
          currentUpdatedAt = JSON.parse(fs.readFileSync(currentPath, 'utf8'))?.updatedAt || '';
        }
      } catch { /* αν δεν διαβάζεται, δεν μπλοκάρουμε την αποθήκευση */ }
      const versionCheck = concurrencyGuards.detectSaveConflict(expectedUpdatedAt, currentUpdatedAt);
      if (versionCheck.conflict) {
        logger.info(`save-project-data: conflict for ${projectData.subprojectId}`
          + ` (expected ${expectedUpdatedAt}, found ${versionCheck.updatedAt})`);
        return {
          success: false,
          conflict: true,
          updatedAt: versionCheck.updatedAt,
          error: 'Το υποέργο άλλαξε από άλλον χρήστη όσο ήταν ανοιχτό. Ανοίξτε το ξανά για να δείτε την πιο πρόσφατη εικόνα και επαναλάβετε.',
        };
      }
    }

    let projectId = projectData.projectId;
    let isNewProject = !projectData.projectId;
    
    // Αν δεν υπάρχει projectId, ψάχνουμε για υπάρχον έργο με ίδιο τίτλο
    if (!projectId && projectData.projectTitle) {
      const existingProjects = await loadAllProjects();
      const resolved = subprojectLifecycleCore.resolveProjectIdWhenMissing(
        '',
        projectData.projectTitle,
        existingProjects
      );
      if (resolved.reusedExisting) {
        projectId = resolved.projectId;
        isNewProject = false;
        console.log(`Found existing project with same title: ${projectData.projectTitle}, adding as subproject`);
      } else {
        projectId = uuidv4();
        isNewProject = true;
        console.log(`No existing project found with title: ${projectData.projectTitle}, creating new project`);
      }
    } else if (!projectId) {
      projectId = uuidv4();
      isNewProject = true;
    }
    
    const subprojectId = projectData.subprojectId || uuidv4();
    
    // Αν ζητείται μετακίνηση υποέργου σε υπάρχον project (αλλαγή τίτλου → ενοποίηση)
    if (projectData.moveToExistingProject && subprojectId && projectId) {
      const SKIP_DIRS = DATA_DIR_SKIP_ROOT_DIRS;
      const projectDirs = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
      let oldProjectDir = null;
      for (const dir of projectDirs) {
        if (SKIP_DIRS.has(dir) || dir === projectId) continue;
        const potentialSubprojectDir = path.join(dataDir, dir, subprojectId);
        if (fs.existsSync(potentialSubprojectDir) && fs.statSync(potentialSubprojectDir).isDirectory()) {
          oldProjectDir = dir;
          break;
        }
      }
      if (oldProjectDir && oldProjectDir !== projectId) {
        const srcPath = path.join(dataDir, oldProjectDir, subprojectId);
        const targetProjectDir = path.join(dataDir, projectId);
        if (!fs.existsSync(targetProjectDir)) fs.mkdirSync(targetProjectDir, { recursive: true });
        const destPath = path.join(targetProjectDir, subprojectId);
        fs.renameSync(srcPath, destPath);
        logger.info(`Moved subproject ${subprojectId} from project ${oldProjectDir} to ${projectId}`);
        // Αν ο παλιός φάκελος project έμεινε κενός, τον αφαιρούμε
        const remaining = fs.readdirSync(path.join(dataDir, oldProjectDir));
        if (remaining.length === 0) {
          fs.rmdirSync(path.join(dataDir, oldProjectDir));
          logger.info(`Removed empty project folder ${oldProjectDir}`);
        }
        isNewProject = false;
      }
    } else if (!isNewProject && subprojectId) {
      // Για υπάρχοντα υποέργα χωρίς μετακίνηση, βρίσκουμε το σωστό projectId από το φάκελο
      const SKIP_DIRS = DATA_DIR_SKIP_ROOT_DIRS;
      const projectDirs = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
      for (const dir of projectDirs) {
        if (SKIP_DIRS.has(dir)) continue;
        const potentialSubprojectDir = path.join(dataDir, dir, subprojectId);
        if (fs.existsSync(potentialSubprojectDir) && fs.statSync(potentialSubprojectDir).isDirectory()) {
          projectId = dir;
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
    const oldSubprojectTitle = String(existingData.subprojectTitle || '').trim();
    const newSubprojectTitle = String(projectData.subprojectTitle || '').trim();
    const subprojectTitleChanged = !isNewProject && oldSubprojectTitle !== newSubprojectTitle;
    
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
    
    const existingFileGroups = existingData.fileGroups || [];
    const newFileGroups = projectData.fileGroups || [];
    logger.debug(`Merging fileGroups: existing=${existingFileGroups.length}, incoming=${newFileGroups.length}`);
    const mergedFileGroups = mergeFileGroupsForSave(
      existingFileGroups,
      newFileGroups,
      (fileName, file) => {
        if (fs.existsSync(path.join(filesDir, fileName))) return true;
        const sourcePath = typeof file === 'string'
          ? file
          : (file && (file.path || file.filePath));
        return Boolean(sourcePath && path.isAbsolute(sourcePath) && fs.existsSync(sourcePath));
      }
    );
    logger.debug(`Merged fileGroups: result=${mergedFileGroups.length} groups`);
    
    const dataToSave = subprojectCardCore.sanitizeSubprojectForPersist(projectData, existingData, {
      projectId: finalProjectId, // ΠΑΝΤΑ το projectId από το όνομα φακέλου
      subprojectId,
      nowIso: new Date().toISOString(),
      fileGroups: mergedFileGroups,
      egkriseisDialthesisPistosis: mergeEgkriseisForSave(
        existingData.egkriseisDialthesisPistosis,
        projectData.egkriseisDialthesisPistosis
      ),
      extra: require('./khmdhsOpenData').mergeKhmdhsFieldsForSave(projectData, existingData),
    });

    // Αντιγραφή μόνο νέων αρχείων (με πλήρη διαδρομή). Τα ήδη καταχωρημένα
    // έχουν μόνο όνομα — είναι ήδη στον φάκελο ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ.
    if (mergedFileGroups && mergedFileGroups.length > 0) {
      for (const group of mergedFileGroups) {
        if (group.files && group.files.length > 0) {
          for (const file of group.files) {
            try {
              const sourcePath = typeof file === 'string' 
                ? file 
                : (file.path || file.filePath);

              if (!sourcePath || !path.isAbsolute(sourcePath)) {
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

    dataToSave.fileGroups = normalizeFileGroupsAfterCopy(mergedFileGroups, finalFilesDir);
    
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
    } else if (subprojectTitleChanged) {
      try {
        const meletaiSvc = getMeletaiService();
        if (meletaiSvc) {
          meletaiSvc.syncLinkedTitlesForSubproject(subprojectId, {
            projectTitle: dataToSave.projectTitle,
            subprojectTitle: dataToSave.subprojectTitle,
          });
        }
      } catch (err) {
        console.error('Error syncing meletai linked subproject title:', err);
      }
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
      oldValue: isNewProject ? null : stripHeavyFieldsForAudit(existingData),
      newValue: stripHeavyFieldsForAudit(dataToSave),
    });
    
    // Επιστρέφουμε και το πλήρες, κανονικοποιημένο αντικείμενο ώστε ο renderer να μπορεί
    // να ενημερώσει τοπικά τη λίστα χωρίς πλήρη επαναφόρτωση (Φάση 1 βελτίωσης απόδοσης)
    try {
      projectsIndex.upsertProjectsIndexEntry(dataDir, {
        ...dataToSave,
        projectId: finalProjectId,
        subprojectId,
      });
    } catch (idxErr) {
      console.error('projectsIndex upsert after save failed:', idxErr?.message || idxErr);
    }
    return { success: true, projectId: finalProjectId, subprojectId, project: dataToSave };
  } catch (error) {
    console.error('Error saving project data:', error);
    return { success: false, error: error.message };
  }
}

ipcMain.handle('save-project-data', withMandatoryUpdateGuard(handleSaveProjectData));


// ─────────────────────────────────────────────────────────────────────────────
//  Μαζική εισαγωγή έργων/υποέργων από Excel (ΜΟΝΟ SUPERADMIN)
//  Χρησιμοποιεί το αυτόνομο module public/subprojectExcelImport.js
// ─────────────────────────────────────────────────────────────────────────────

/** Χάρτης υπαρχόντων υποέργων ανά κλειδί (τίτλος έργου|||τίτλος υποέργου) → {projectId, subprojectId}. */
async function buildExistingSubprojectKeyMap() {
  const importer = require('./subprojectExcelImport');
  const existing = await loadAllProjects();
  const map = new Map();
  for (const p of existing) {
    const key = `${importer.normalizeTitleKey(p.projectTitle)}|||${importer.normalizeTitleKey(p.subprojectTitle)}`;
    if (!map.has(key)) {
      map.set(key, { projectId: p.projectId, subprojectId: p.subprojectId });
    }
  }
  return map;
}

/** Ανάγνωση + έλεγχος αρχείου Excel· επιστρέφει δομημένη αναφορά προεπισκόπησης. */
async function buildSubprojectImportReport(filePath) {
  const importer = require('./subprojectExcelImport');
  const buffer = fs.readFileSync(filePath);
  const parsed = await importer.parseImportWorkbookBuffer(buffer);
  const fundingEnums = getLiveFundingEnumsForImport();
  const validation = importer.validateAllRows(parsed.rows, { fundingEnums });

  const existingKeyMap = await buildExistingSubprojectKeyMap();
  const existingDuplicates = validation.validRows
    .filter((vr) => existingKeyMap.has(vr.dupKey))
    .map((vr) => ({
      excelRow: vr.excelRow,
      projectTitle: vr.project.projectTitle,
      subprojectTitle: vr.project.subprojectTitle,
    }));

  return {
    versionOk: parsed.versionOk,
    parseErrors: parsed.parseErrors || [],
    totalRows: validation.count,
    validCount: validation.validRows.length,
    errorRows: validation.errors,
    existingCount: existingKeyMap.size,
    existingDuplicates,
    validation,
    existingKeyMap,
  };
}

ipcMain.handle('export-subprojects-import-template', async () => {
  try {
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να δημιουργήσει το πρότυπο εισαγωγής.' };
    }
    const ExcelJS = require('exceljs');
    const importer = require('./subprojectExcelImport');
    const fundingEnums = getLiveFundingEnumsForImport();
    const wb = importer.buildTemplateWorkbook(ExcelJS, { fundingEnums });
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Αποθήκευση προτύπου αρχικής εισαγωγής',
      defaultPath: `ERGOHUB_Εισαγωγη_Εργων_${stamp}.xlsx`,
      filters: [{ name: 'Αρχεία Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    await wb.xlsx.writeFile(result.filePath);
    logAuditAction({
      type: 'export',
      entityType: 'subproject',
      entityId: 'bulk-import-template',
      entityTitle: 'Πρότυπο μαζικής εισαγωγής',
      details: 'Δημιουργία προτύπου Excel για αρχική εισαγωγή έργων & υποέργων',
    });
    return { success: true, filePath: result.filePath };
  } catch (e) {
    logger.error('export-subprojects-import-template failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-subprojects-import-xlsx', async () => {
  try {
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να εισάγει έργα από Excel.' };
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Επιλογή συμπληρωμένου αρχείου Excel',
      properties: ['openFile'],
      filters: [{ name: 'Αρχεία Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    return { success: true, filePath: result.filePaths[0], fileName: path.basename(result.filePaths[0]) };
  } catch (e) {
    logger.error('select-subprojects-import-xlsx failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('preview-subprojects-excel-import', async (_event, { filePath } = {}) => {
  try {
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να εισάγει έργα από Excel.' };
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Δεν βρέθηκε το επιλεγμένο αρχείο.' };
    }
    const report = await buildSubprojectImportReport(filePath);
    return {
      success: true,
      fileName: path.basename(filePath),
      versionOk: report.versionOk,
      parseErrors: report.parseErrors,
      totalRows: report.totalRows,
      validCount: report.validCount,
      errorRows: report.errorRows,
      existingCount: report.existingCount,
      existingDuplicates: report.existingDuplicates,
    };
  } catch (e) {
    logger.error('preview-subprojects-excel-import failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('commit-subprojects-excel-import', async (_event, payload = {}) => {
  try {
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Μόνο ο υπερδιαχειριστής μπορεί να εισάγει έργα από Excel.' };
    }
    const { filePath, wipeExisting = false, duplicatePolicy = 'skip' } = payload;
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Δεν βρέθηκε το επιλεγμένο αρχείο.' };
    }
    if (!['skip', 'update', 'create'].includes(duplicatePolicy)) {
      return { success: false, error: 'Μη έγκυρη πολιτική διπλοτύπων.' };
    }

    // Επαναϋπολογισμός από τον δίσκο (δεν εμπιστευόμαστε δεδομένα από τον renderer)
    const report = await buildSubprojectImportReport(filePath);

    if (report.parseErrors.length > 0) {
      return { success: false, error: 'Το αρχείο δεν διαβάστηκε σωστά.', report: { parseErrors: report.parseErrors } };
    }
    if (report.errorRows.length > 0) {
      return {
        success: false,
        error: 'Υπάρχουν γραμμές με λάθη. Διορθώστε το αρχείο και ξαναδοκιμάστε.',
        report: { errorRows: report.errorRows },
      };
    }
    if (report.validCount === 0) {
      return { success: false, error: 'Δεν βρέθηκαν έγκυρες γραμμές προς εισαγωγή.' };
    }

    // Πλήρης διαγραφή υπαρχόντων (προαιρετικά)
    let deletedProjects = 0;
    if (wipeExisting) {
      try { projectsIndex.invalidateProjectsIndex(dataDir); } catch { /* ignore */ }
      // Σαρώνει όλους τους φακέλους έργων στον δίσκο (όχι μόνο όσα περνούν το
      // φίλτρο τίτλων του loadAllProjects) ώστε να μην μείνουν ορφανά data.json
      // που μετά μετρούν ως «χρειάζονται ανανέωση ΚΗΜΔΗΣ».
      let rootDirs = [];
      try { rootDirs = fs.readdirSync(dataDir); } catch { rootDirs = []; }
      for (const dirName of rootDirs) {
        if (DATA_DIR_SKIP_ROOT_DIRS.has(dirName)) continue;
        const dir = path.join(dataDir, dirName);
        try {
          if (!fs.statSync(dir).isDirectory()) continue;
          // Διαγράφουμε μόνο φακέλους που μοιάζουν με έργο (έχουν υποφάκελο με data.json)
          let looksLikeProject = false;
          try {
            for (const sub of fs.readdirSync(dir)) {
              if (fs.existsSync(path.join(dir, sub, 'data.json'))) {
                looksLikeProject = true;
                break;
              }
            }
          } catch { /* ignore */ }
          if (!looksLikeProject) continue;
          fs.rmSync(dir, { recursive: true, force: true });
          deletedProjects += 1;
        } catch (delErr) {
          logger.error('commit-subprojects-excel-import: delete failed for ' + dirName, delErr);
        }
      }
      // Καθαρισμός παλιών αναφορών μαζικής ανανέωσης (αναφέρονται σε διαγραμμένα υποέργα)
      try {
        const configDir = path.join(dataDir, 'config');
        for (const name of (fs.existsSync(configDir) ? fs.readdirSync(configDir) : [])) {
          if (!name.startsWith('khmdhs-batch-report') || !name.endsWith('.json')) continue;
          try { fs.unlinkSync(path.join(configDir, name)); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      logAuditAction({
        type: 'delete',
        entityType: 'subproject',
        entityId: 'bulk-import-wipe',
        entityTitle: 'Πλήρης διαγραφή πριν την εισαγωγή',
        details: `Διαγράφηκαν ${deletedProjects} έργα πριν τη μαζική εισαγωγή`,
      });
    }

    // Χάρτης διπλοτύπων (ξαναφτιάχνεται μετά από πιθανή διαγραφή)
    const existingKeyMap = wipeExisting ? new Map() : await buildExistingSubprojectKeyMap();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const failed = [];

    for (const vr of report.validation.validRows) {
      const isDuplicate = existingKeyMap.has(vr.dupKey);
      if (isDuplicate && duplicatePolicy === 'skip') {
        skipped += 1;
        continue;
      }
      const projectData = { ...vr.project };
      let isUpdate = false;
      if (isDuplicate && duplicatePolicy === 'update') {
        const target = existingKeyMap.get(vr.dupKey);
        projectData.projectId = target.projectId;
        projectData.subprojectId = target.subprojectId;
        isUpdate = true;
      }
      // 'create' ή νέο: χωρίς ids → δημιουργία & αυτόματη ομαδοποίηση ανά τίτλο έργου
      try {
        const res = await handleSaveProjectData(null, projectData);
        if (res && res.success) {
          if (isUpdate) updated += 1; else created += 1;
        } else {
          failed.push({ excelRow: vr.excelRow, error: (res && res.error) || 'άγνωστο σφάλμα' });
        }
      } catch (rowErr) {
        failed.push({ excelRow: vr.excelRow, error: rowErr.message });
      }
    }

    logAuditAction({
      type: 'create',
      entityType: 'subproject',
      entityId: 'bulk-import',
      entityTitle: 'Μαζική εισαγωγή από Excel',
      details: `Εισαγωγή από Excel — νέα: ${created}, ενημερώσεις: ${updated}, παραλείψεις: ${skipped}, αποτυχίες: ${failed.length}${wipeExisting ? `, διαγραφή: ${deletedProjects}` : ''}`,
    });

    // Ξαναχτίσιμο ευρετηρίου μετά τη μαζική εισαγωγή
    try {
      projectsIndex.invalidateProjectsIndex(dataDir);
      await loadAllProjects();
    } catch (idxErr) {
      logger.error('commit-subprojects-excel-import: index rebuild failed', idxErr);
    }

    return { success: true, created, updated, skipped, failed, deletedProjects, wipeExisting };
  } catch (e) {
    logger.error('commit-subprojects-excel-import failed', e);
    return { success: false, error: e.message };
  }
});


/**
 * Κανονικοποίηση τίτλου έργου για σύγκριση (ίδια λογική παντού: φόρμα, find-by-title, αποθήκευση).
 * Συμπτύσσει whitespace ώστε «ίδιος» τίτλος να μην δημιουργεί διπλό φάκελο έργου.
 */
function normalizeProjectTitleForMatching(text) {
  return subprojectLifecycleCore.normalizeProjectTitleForMatching(text);
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

// Dedupe για επαναλαμβανόμενα προειδοποιητικά logs στο loadAllProjects (hot path — τρέχει σε κάθε reload)
const loggedSubprojectIdMismatches = new Set();

// Internal function to load all projects
const loadAllProjects = async () => {
  try {
    const projects = [];
    if (!fs.existsSync(dataDir)) {
      console.log('loadAllProjects: dataDir does not exist:', dataDir);
      return projects;
    }

    const t0 = Date.now();

    // Γρήγορη διαδρομή μέσω ευρετηρίου (Φάση 2) — αν αποτύχει, πλήρης σάρωση
    const indexed = projectsIndex.loadProjectsViaIndex(dataDir, {
      skipRoot: DATA_DIR_SKIP_ROOT_DIRS,
      normalizeProjectTypeField,
      isProjectLocked,
      loggedSubprojectIdMismatches,
    });
    if (Array.isArray(indexed)) {
      console.log('loadAllProjects: summary', {
        via: 'index',
        returned: indexed.length,
        ms: Date.now() - t0,
      });
      return indexed;
    }

    const projectDirs = fs.readdirSync(dataDir);
    // Πλήρης λίστα: αναθέσεις, μελέτες, config κ.λπ. — όχι μόνο εντάξεις/προσκλήσεις
    const skipRoot = DATA_DIR_SKIP_ROOT_DIRS;

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
            normalizeProjectTypeField(data);

            // Χωρίς τίτλους δεν είναι έγκυρο υποέργο — χωρίς θόρυβο στο τερματικό
            const pTitle = data.projectTitle == null ? '' : String(data.projectTitle).trim();
            const sTitle = data.subprojectTitle == null ? '' : String(data.subprojectTitle).trim();
            if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') {
              continue;
            }

            // Add lock information to project data
            data.isLocked = !!lockStatus.locked;
            if (lockStatus.locked) {
              data.lockedBy = lockStatus.lockedBy || '';
              data.lockMessage = 'Ανοιχτό από άλλον χρήστη';
            } else {
              data.lockedBy = '';
              data.lockMessage = '';
            }

            // Ensure projectId / subprojectId match the actual folder names on disk.
            // Αν το JSON έχει παλιό/λάθος projectId, η διαγραφή και άλλα IPC που εμπιστεύονται
            // το πεδίο ψάχνουν σε λάθος φάκελο και «επιτυγχάνουν» χωρίς να σβήσουν τίποτα.
            if (data.projectId !== projectDir) {
              data.projectId = projectDir;
            }
            
            // CRITICAL: Ensure subprojectId matches the folder name (subprojectDir)
            // This is essential for opening files correctly, especially for projects with multiple contracts
            if (data.subprojectId !== subprojectDir) {
              // Το πεδίο δεν διορθώνεται μόνιμο στον δίσκο, οπότε θα ξαναεμφανιζόταν σε κάθε reload —
              // καταγράφουμε μία φορά ανά εκτέλεση της εφαρμογής για να αποφύγουμε θόρυβο σε hot path.
              if (!loggedSubprojectIdMismatches.has(subprojectDir)) {
                loggedSubprojectIdMismatches.add(subprojectDir);
                console.log(`⚠️ SubprojectId mismatch detected: data.json has "${data.subprojectId}" but folder is "${subprojectDir}". Using folder name.`);
              }
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

    // Ξαναχτίσιμο ευρετηρίου μετά από πλήρη σάρωση (ασφαλές, μη κρίσιμο αν αποτύχει)
    try {
      projectsIndex.rebuildProjectsIndex(dataDir, projects);
    } catch (idxErr) {
      console.error('loadAllProjects: index rebuild failed', idxErr?.message || idxErr);
    }

    console.log('loadAllProjects: summary', {
      via: 'scan',
      scannedProjects: scanned,
      skippedRoot: skipped,
      errors: errored,
      returned: projects.length,
      ms: Date.now() - t0,
    });
    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
};

// IPC Handler για λήψη όλων των έργων
ipcMain.handle('load-all-projects', async () => {
  let reachable = true;
  try { fs.accessSync(dataDir, fs.constants.R_OK); } catch { reachable = false; }
  const projects = await loadAllProjects();
  if (!reachable && projects.length === 0) {
    return { __unreachable: true, projects: [] };
  }
  return projects;
});

function isResolvedPathInsideDataDir(filePath) {
  if (!dataDir || !filePath) return false;
  const resolved = path.resolve(filePath);
  const root = path.resolve(dataDir);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (process.platform === 'win32') {
    const r = resolved.toLowerCase();
    const rootL = root.toLowerCase();
    const prefixL = prefix.toLowerCase();
    return r === rootL || r.startsWith(prefixL);
  }
  return resolved === root || resolved.startsWith(prefix);
}

function hydrateSubprojectFromDisk(raw, projectDir, subprojectDir) {
  if (!raw || typeof raw !== 'object') return null;
  const data = { ...raw };
  if (typeof normalizeProjectTypeField === 'function') {
    normalizeProjectTypeField(data);
  }
  const pTitle = data.projectTitle == null ? '' : String(data.projectTitle).trim();
  const sTitle = data.subprojectTitle == null ? '' : String(data.subprojectTitle).trim();
  if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') return null;

  const lockStatus = isProjectLocked(projectDir);
  data.isLocked = !!lockStatus.locked;
  if (lockStatus.locked) {
    data.lockedBy = lockStatus.lockedBy || '';
    data.lockMessage = 'Ανοιχτό από άλλον χρήστη';
  } else {
    data.lockedBy = '';
    data.lockMessage = '';
  }
  data.projectId = projectDir;
  data.subprojectId = subprojectDir;

  if (data.remainingAmountsByYear && Array.isArray(data.remainingAmountsByYear) && data.remainingAmountsByYear.length > 0) {
    const sortedEntries = [...data.remainingAmountsByYear].sort((a, b) => parseInt(b.year) - parseInt(a.year));
    const latestEntry = sortedEntries.find((entry) => {
      const amount = (entry.amount || '').toString().trim();
      return amount && amount !== '0' && amount !== '0,00';
    });
    if (latestEntry) {
      data.remainingAmount = latestEntry.amount;
      data.remainingAmountYear = latestEntry.year;
    } else {
      data.remainingAmount = sortedEntries[0].amount || '';
      data.remainingAmountYear = sortedEntries[0].year || '';
    }
  }
  return data;
}

function resolveSubprojectJsonPath(projectId, subprojectId) {
  const pid = String(projectId || '').trim();
  const sid = String(subprojectId || '').trim();
  if (pid && sid) {
    const direct = path.join(dataDir, pid, sid, 'data.json');
    if (fs.existsSync(direct) && isResolvedPathInsideDataDir(direct)) return direct;
  }
  if (sid) {
    const found = findSubprojectDataJsonPath(sid);
    if (found && isResolvedPathInsideDataDir(found)) return found;
  }
  return '';
}

ipcMain.handle('load-one-subproject', async (_event, payload = {}) => {
  try {
    const projectId = String(payload.projectId || '').trim();
    const subprojectId = String(payload.subprojectId || '').trim();
    if (!subprojectId) {
      return { success: false, error: 'Απαιτείται υποέργο', missing: true };
    }
    // Πριν θεωρήσουμε ότι λείπει, ελέγχουμε αν ο κοινός φάκελος είναι προσβάσιμος.
    // Σε πτώση δικτύου, fs.existsSync → false → false-positive «missing».
    let dataDirReachable = true;
    try {
      fs.accessSync(dataDir, fs.constants.R_OK);
    } catch {
      dataDirReachable = false;
    }
    const jsonPath = resolveSubprojectJsonPath(projectId, subprojectId);
    if (!jsonPath) {
      if (!dataDirReachable) {
        return { success: false, error: 'Ο κοινός φάκελος δεδομένων δεν είναι προσβάσιμος' };
      }
      return { success: false, error: 'Το υποέργο δεν βρέθηκε', missing: true };
    }
    if (!isResolvedPathInsideDataDir(jsonPath)) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }
    const projectDir = path.basename(path.dirname(path.dirname(jsonPath)));
    const subDir = path.basename(path.dirname(jsonPath));
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (readErr) {
      console.error('load-one-subproject read failed:', readErr);
      return { success: false, error: readErr.message || 'Αποτυχία ανάγνωσης υποέργου' };
    }
    const project = hydrateSubprojectFromDisk(raw, projectDir, subDir);
    if (!project) {
      return { success: false, error: 'Μη έγκυρα δεδομένα υποέργου' };
    }
    return { success: true, project };
  } catch (error) {
    console.error('load-one-subproject failed:', error);
    return { success: false, error: error.message || 'Αποτυχία ανάγνωσης υποέργου' };
  }
});

ipcMain.handle('peek-projects-index', async () => {
  try {
    try { fs.accessSync(dataDir, fs.constants.R_OK); } catch {
      return { success: false, error: 'Ο κοινός φάκελος δεδομένων δεν είναι προσβάσιμος' };
    }
    const index = projectsIndex.readProjectsIndex(dataDir);
    if (!index || !Array.isArray(index.entries)) {
      return { success: false };
    }
    return {
      success: true,
      updatedAt: index.updatedAt || '',
      entries: index.entries
        .filter((e) => e && e.subprojectId)
        .map((e) => ({
          projectId: e.projectId || '',
          subprojectId: e.subprojectId,
          mtimeMs: Number(e.mtimeMs) || 0,
        })),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Επαναδημιουργία ευρετηρίου υποέργων (SUPERADMIN) — Φάση 2
ipcMain.handle('rebuild-projects-index', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    projectsIndex.invalidateProjectsIndex(dataDir);
    const projects = await loadAllProjects();
    return { success: true, count: projects.length };
  } catch (error) {
    console.error('rebuild-projects-index failed:', error);
    return { success: false, error: error.message };
  }
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

/** Χρήστες για χρέωση επιβλέποντα: όλοι οι ενεργοί/εγκεκριμένοι λογαριασμοί (όχι μόνο ENGINEER). */
function engineersFromUserAccounts() {
  const users = loadUsers();
  const roleLabel = (role) => {
    const r = String(role || '').toUpperCase();
    if (r === 'SUPERADMIN') return 'Υπερδιαχειριστής';
    if (r === 'ADMIN') return 'Διαχειριστής';
    if (r === 'ENGINEER') return 'Μηχανικός';
    if (r === 'USER') return 'Χρήστης';
    return r || 'Χρήστης';
  };
  return users
    .filter((u) => u && u.active !== false && u.approved !== false)
    .map((u) => {
      const username = String(u.username || '').trim();
      const fullName = String(u.fullName || username || '').trim() || username;
      const role = String(u.role || 'USER').toUpperCase();
      return {
        id: `user:${username.toLowerCase()}`,
        fullName,
        role,
        roleLabel: roleLabel(role),
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

const { engineerChargeFilterKey, buildEngineerVisibilityContext, projectVisibleToEngineerContext } = require('./chargeFilterUtils');

function normalizeSupervisorEngineerIdList(ids) {
  return subprojectCardCore.normalizeSupervisorEngineerIdList(ids);
}

function filterSupervisorEngineerIds(ids) {
  const allowed = getAllowedSupervisorEngineerIdSet();
  return normalizeSupervisorEngineerIdList(ids).filter((id) => allowed.has(id));
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
  // Due-date checks disabled — deadlines removed from task assignments
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

ipcMain.handle('get-task-assignments-summary', async (_event, { actingUsername } = {}) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, tasks: [] };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, tasks: [] };
    const result = svc.loadAssignments({ actingUsername: auth.username, view: 'asAssignee', listScope: 'default' });
    const tasks = (result.tasks || []).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));
    return { success: true, tasks };
  } catch { return { success: false, tasks: [] }; }
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
    const result = svc.createTask({ actingUsername: auth.username, payload, newFiles: newFiles || [] });
    if (result.success && result.task) {
      const emailConfig = loadEmailConfig(dataDir);
      sendWorkspaceCreatedEmail(result.task, loadUsers(), emailConfig)
        .then(emailResult => {
          if (emailResult.skipped) {
            console.log(`[email] created email skipped: ${emailResult.reason}`);
          } else if (emailResult.success) {
            console.log(`[email] created email sent to: ${(emailResult.sentTo || []).join(', ')}`);
          }
        })
        .catch(e => console.error('[email] sendWorkspaceCreatedEmail error:', e.message));
    }
    return result;
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
    const result = svc.addComment({ actingUsername: auth.username, taskId, text });
    if (result.success && result.task) {
      const emailConfig = loadEmailConfig(dataDir);
      sendWorkspaceActivityEmail(result.task, auth.username, text, loadUsers(), emailConfig)
        .then(emailResult => {
          if (emailResult.skipped) {
            console.log(`[email] comment email skipped: ${emailResult.reason}`);
          } else if (emailResult.success) {
            console.log(`[email] comment email sent to: ${(emailResult.sentTo || []).join(', ')}`);
          }
          if (emailResult.updatedLastEmailSentAt) {
            svc.updateLastEmailSentAt({ taskId, timestamp: emailResult.updatedLastEmailSentAt });
          }
        })
        .catch(e => console.error('[email] sendWorkspaceActivityEmail error:', e.message));
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-task-assignment-files', async (_event, { actingUsername, taskId, newFiles, batch }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    const result = svc.addFiles({
      actingUsername: auth.username,
      taskId,
      newFiles: newFiles || [],
      batch: batch || null
    });
    if (result.success && result.task) {
      const fileNames = (result.task.files || []).slice(-newFiles.length).map(f => f.name).join(', ');
      const msgText = `Νέα αρχεία: ${fileNames}`;
      const emailConfig = loadEmailConfig(dataDir);
      sendWorkspaceActivityEmail(result.task, auth.username, msgText, loadUsers(), emailConfig)
        .then(emailResult => {
          if (emailResult.skipped) {
            console.log(`[email] files email skipped: ${emailResult.reason}`);
          } else if (emailResult.success) {
            console.log(`[email] files email sent to: ${(emailResult.sentTo || []).join(', ')}`);
          }
          if (emailResult.updatedLastEmailSentAt) {
            svc.updateLastEmailSentAt({ taskId, timestamp: emailResult.updatedLastEmailSentAt });
          }
        })
        .catch(e => console.error('[email] sendWorkspaceActivityEmail (files) error:', e.message));
    }
    return result;
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

ipcMain.handle('open-task-assignment-file', async (_event, { actingUsername, taskId, filePath, fileId, fileName }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    const check = svc.resolveTaskFilePath({ actingUsername: auth.username, taskId, filePath, fileId, fileName });
    if (!check.success) return check;
    const openResult = await shell.openPath(check.filePath);
    if (openResult) return { success: false, error: `Αδυναμία ανοίγματος αρχείου: ${openResult}` };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-task-assignment-file', async (_event, { actingUsername, taskId, filePath, fileId, fileName }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    const check = svc.resolveTaskFilePath({ actingUsername: auth.username, taskId, filePath, fileId, fileName });
    if (!check.success) return check;
    const defaultName = fileName || path.basename(check.filePath);
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: defaultName,
      filters: [{ name: 'Όλα τα αρχεία', extensions: ['*'] }]
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    fs.copyFileSync(check.filePath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-task-assignment-folder', async (_event, { actingUsername, taskId, batchId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    const batchInfo = svc.resolveTaskBatchForDownload({
      actingUsername: auth.username,
      taskId,
      batchId
    });
    if (!batchInfo.success) return batchInfo;

    const pickResult = await dialog.showOpenDialog({
      title: 'Επιλογή φακέλου προορισμού',
      properties: ['openDirectory', 'createDirectory']
    });
    if (pickResult.canceled || !pickResult.filePaths?.[0]) {
      return { success: false, canceled: true };
    }

    const sanitizeFolderName = (name) => {
      const cleaned = String(name || 'Φάκελος').replace(/[<>:"/\\|?*]/g, '_').trim();
      return cleaned || 'Φάκελος';
    };

    const destParent = pickResult.filePaths[0];
    const baseName = sanitizeFolderName(batchInfo.label);
    let folderName = baseName;
    let destDir = path.join(destParent, folderName);
    let folderCounter = 1;
    while (fs.existsSync(destDir)) {
      folderName = `${baseName}_${folderCounter}`;
      destDir = path.join(destParent, folderName);
      folderCounter += 1;
    }
    fs.mkdirSync(destDir, { recursive: true });

    let copied = 0;
    batchInfo.files.forEach((fileEntry) => {
      const ext = path.extname(fileEntry.name);
      const nameNoExt = path.basename(fileEntry.name, ext);
      let destName = fileEntry.name;
      let destPath = path.join(destDir, destName);
      let fileCounter = 1;
      while (fs.existsSync(destPath)) {
        destName = `${nameNoExt}_${fileCounter}${ext}`;
        destPath = path.join(destDir, destName);
        fileCounter += 1;
      }
      fs.copyFileSync(fileEntry.filePath, destPath);
      copied += 1;
    });

    return {
      success: true,
      destDir,
      copied,
      missing: batchInfo.missing?.length ? batchInfo.missing : undefined
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-task-assignment-attachment', async (_event, { actingUsername, taskId, fileId, batchId }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.deleteTaskAttachment({
      actingUsername: auth.username,
      taskId,
      fileId: fileId || null,
      batchId: batchId || null
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/* ── Email Config & Workspace Email Toggle ── */

ipcMain.handle('get-email-config', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στις ρυθμίσεις email' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const config = loadEmailConfig(dataDir);
    return {
      success: true,
      config: {
        gmail: {
          user: config.gmail?.user || '',
          appPasswordSet: !!(config.gmail?.appPassword || config.gmail?._appPasswordCipher),
          decryptFailed: !!config.gmail?._decryptFailed,
          fromName: config.gmail?.fromName || 'ergoHub'
        }
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/** Μόνο boolean — για UI χώρου εργασίας· χωρίς credentials. */
ipcMain.handle('is-email-configured', async (_event, { actingUsername } = {}) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, configured: false, error: auth.error };
  try {
    if (!dataDir) return { success: true, configured: false };
    return { success: true, configured: isConfigured(loadEmailConfig(dataDir)) };
  } catch (error) {
    return { success: false, configured: false, error: error.message };
  }
});

ipcMain.handle('save-email-config', async (_event, { actingUsername, user, appPassword, fromName }) => {
  try {
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα αλλαγής ρυθμίσεων email' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const existing = loadEmailConfig(dataDir);
    let normalizedUser = String(user || '').trim().toLowerCase();
    if (normalizedUser && !normalizedUser.includes('@')) {
      normalizedUser = `${normalizedUser}@gmail.com`;
    }
    const providedNewPass = appPassword !== undefined
      ? String(appPassword).replace(/\s+/g, '').trim()
      : '';
    // Χωρίς νέο password: κράτα plaintext αν υπάρχει, αλλιώς το παλιό ciphertext (μην το σβήνεις).
    const updated = {
      gmail: {
        user: normalizedUser,
        appPassword: providedNewPass || existing.gmail?.appPassword || '',
        fromName: (fromName || 'ergoHub').trim(),
        ...(
          !providedNewPass && !existing.gmail?.appPassword && existing.gmail?._appPasswordCipher
            ? { _appPasswordCipher: existing.gmail._appPasswordCipher }
            : {}
        ),
      }
    };
    saveEmailConfig(dataDir, updated);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-email-config', async (_event, { actingUsername, toAddress }) => {
  try {
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα δοκιμής email' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const emailConfig = loadEmailConfig(dataDir);
    return await sendTestEmail(toAddress, emailConfig);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-workspace-email-notifications', async (_event, { actingUsername, taskId, enabled }) => {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    const svc = getTaskAssignmentService();
    if (!svc) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων (dataDir)' };
    return svc.toggleEmailNotifications({ actingUsername: auth.username, taskId, enabled });
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

ipcMain.handle('diavgeia-fetch-decision-by-ada', async (_event, { ada }) => {
  try {
    const dg = require('./diavgeiaOpenData');
    return await dg.fetchDiavgeiaDecisionByAda(ada);
  } catch (error) {
    console.error('diavgeia-fetch-decision-by-ada:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('diavgeia-download-decision-pdf', async (_event, { ada, documentUrl, fileName }) => {
  try {
    const dg = require('./diavgeiaOpenData');
    return await dg.downloadDiavgeiaDecisionPdf(ada, { documentUrl, fileName });
  } catch (error) {
    console.error('diavgeia-download-decision-pdf:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('khmdhs-fetch-notice-by-adam', async (_event, { adam }) => {
  try {
    const kh = require('./khmdhsOpenData');
    const res = await kh.fetchKhmdhsNoticeByAdam(adam);
    if (!res.success) return res;
    const snapshot = kh.pickKhmdhsNoticeSnapshot(res.snapshot);
    if (!snapshot) {
      return {
        success: false,
        error: 'Βρέθηκε η πράξη αλλά δεν επιστράφηκαν δεδομένα προκήρυξης από το ΚΗΜΔΗΣ.'
      };
    }
    return {
      success: true,
      snapshot,
      fetchedAt: new Date().toISOString(),
      mappedAssignmentProcedure: snapshot.mappedAssignmentProcedure || null
    };
  } catch (error) {
    console.error('khmdhs-fetch-notice-by-adam:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('khmdhs-resolve-adam-chain', async (_event, { adam, apeAmount }) => {
  try {
    const chainSvc = require('./khmdhsAdamChainService');
    return await chainSvc.resolveKhmdhsAdamChain(adam, { apeAmount: apeAmount ?? null });
  } catch (error) {
    console.error('khmdhs-resolve-adam-chain:', error);
    return { success: false, error: error.message || String(error) };
  }
});

/** Ακύρωση in-flight μαζικής ανανέωσης ΚΗΜΔΗΣ (διακόπτει το τρέχον δίκτυο). */
let khmdhsBatchRefreshAbortController = null;

ipcMain.handle('cancel-khmdhs-batch-refresh', async (_event, { actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (!username) {
      return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    }
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (khmdhsBatchRefreshAbortController) {
      try {
        khmdhsBatchRefreshAbortController.abort();
      } catch {
        /* ignore */
      }
    }
    return { success: true };
  } catch (e) {
    logger.error('cancel-khmdhs-batch-refresh error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

/**
 * Είναι το υποέργο πιασμένο από άλλον χρήστη;
 *
 * Υπάρχουν δύο κλειδαριές για το ίδιο πράγμα: η επεξεργασία από το UI κλειδώνει ολόκληρο
 * το έργο (φάκελος γονέας), ενώ η ανανέωση ΚΗΜΔΗΣ κλειδώνει το μεμονωμένο υποέργο.
 * Ελέγχουμε και τις δύο, αλλιώς οι δύο διαδρομές γράφουν ταυτόχρονα και η μία σβήνει την άλλη.
 */
function getKhmdhsSubprojectBusyStatus(subprojectId, username) {
  const sid = String(subprojectId || '').trim();
  if (!sid) return { locked: false };
  const keys = [sid];
  try {
    const jsonPath = findSubprojectDataJsonPath(sid);
    if (jsonPath) {
      const parentId = path.basename(path.dirname(path.dirname(jsonPath)));
      if (parentId && parentId !== sid) keys.push(parentId);
    }
  } catch { /* αν δεν βρεθεί ο γονέας, ελέγχουμε τουλάχιστον το υποέργο */ }
  return concurrencyGuards.resolveBusyStatus(
    keys,
    username,
    (key) => isEntityLocked('projects', key)
  );
}

ipcMain.handle('preview-subproject-khmdhs-refresh', async (event, { subprojectId, actingUsername, batchMode } = {}) => {
  let localAbort = null;
  try {
    const username = String(actingUsername || '').trim();
    if (!username) {
      return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    }
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }

    const sid = String(subprojectId || '').trim();
    if (!sid) {
      return { success: false, error: 'Λείπει αναγνωριστικό υποέργου' };
    }

    // Επιτρέπεται αν το υποέργο δεν είναι κλειδωμένο ή αν το κλείδωμα ανήκει στον ίδιο
    // χρήστη (η μαζική ανανέωση κρατά κλείδωμα σε όλη τη διάρκεια ανάγνωσης→αποθήκευσης).
    const lockStatus = getKhmdhsSubprojectBusyStatus(sid, username);
    if (lockStatus.locked) {
      return {
        success: false,
        error: `Το υποέργο επεξεργάζεται από ${lockStatus.lockedBy}. Δοκιμάστε ξανά σε λίγο.`,
      };
    }

    const project = findSubprojectDataById(sid);
    if (!project) {
      return { success: false, error: 'Δεν βρέθηκε το υποέργο' };
    }

    const refreshSeed = require('./khmdhsChainRefreshSeed');
    if (refreshSeed.isKhmdhsChainClosedSubproject(project)) {
      return {
        success: false,
        error: 'Το υποέργο είναι ολοκληρωμένο και αποπληρωμένο — ο κύκλος ΚΗΜΔΗΣ έχει κλείσει.',
      };
    }
    if (!refreshSeed.canUserRefreshKhmdhsOnServer(user, project)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα ανανέωσης ΚΗΜΔΗΣ για αυτό το υποέργο' };
    }

    const seedPlan = refreshSeed.getKhmdhsRefreshSeedAdams(project);
    const seedInfo = seedPlan.primary;
    if (!seedInfo.adam) {
      return {
        success: false,
        error: 'Δεν βρέθηκε ΑΔΑΜ αφετηρίας για ανανέωση. Ανοίξτε την επεξεργασία του υποέργου, εισάγετε τον ΑΔΑΜ στη Φάση Β (π.χ. αίτημα ή σύμβαση) και εκτελέστε αρχική ανάκτηση.',
      };
    }

    const apeAmount = refreshSeed.parseStoredApeAmountGross(project);

    if (batchMode) {
      localAbort = new AbortController();
      khmdhsBatchRefreshAbortController = localAbort;
    }

    const chainSvc = require('./khmdhsAdamChainService');
    const sharedContractCache = new Map();
    const sharedPaymentCache = new Map();
    const emitProgress = (payload) => {
      try {
        if (event?.sender && !event.sender.isDestroyed()) {
          event.sender.send('khmdhs-refresh-progress', {
            subprojectId: sid,
            ...(payload && typeof payload === 'object' ? payload : {}),
          });
        }
      } catch (_) { /* ignore */ }
    };
    const resolveOptsBase = {
      apeAmount,
      signal: localAbort?.signal,
      preferNoticeAdam: project.khmdhsNoticeAdam || project.khmdhsNoticeSnapshot?.referenceNumber || '',
      extraAdams: [
        project.khmdhsNoticeAdam,
        project.khmdhsNoticeSnapshot?.referenceNumber,
      ].filter(Boolean),
      contractCache: sharedContractCache,
      paymentCache: sharedPaymentCache,
      onProgress: emitProgress,
    };

    // Τεχνητή (συρραμμένη) αλυσίδα: ανακτούμε διαδοχικά ΟΛΟΥΣ τους σπόρους του σχεδίου
    // ώστε να ξαναχτιστεί όλη η αλυσίδα (ο renderer τα συγχωνεύει με stitch, χωρίς σβήσιμο).
    // Κοινό cache συμβάσεων/πληρωμών μεταξύ σπόρων — αποφεύγει διπλά downloads.
    if (seedPlan.usesStitchPlan && seedPlan.adams.length >= 2) {
      const stitchResults = [];
      const totalSeeds = seedPlan.adams.length;
      for (let seedIdx = 0; seedIdx < seedPlan.adams.length; seedIdx += 1) {
        const seedAdam = seedPlan.adams[seedIdx];
        emitProgress({
          phase: 'stitch',
          message: `Συρραφή αλυσίδας ${seedIdx + 1}/${totalSeeds}…`,
          current: seedIdx + 1,
          total: totalSeeds,
        });
        // eslint-disable-next-line no-await-in-loop
        const r = await chainSvc.resolveKhmdhsAdamChain(seedAdam, resolveOptsBase);
        if (r?.aborted) {
          return { success: false, aborted: true, error: 'Η διαδικασία ακυρώθηκε.' };
        }
        stitchResults.push({ seedAdam, chainRes: r || null, success: !!r?.success });
      }
      const failedAdams = stitchResults
        .filter((s) => !s.success)
        .map((s) => s.seedAdam)
        .filter(Boolean);
      // Fail-closed: μερική επιτυχία δεν επιτρέπεται — αλλιώς αποθηκεύεται μισή αλυσίδα.
      if (failedAdams.length) {
        return {
          success: false,
          partialStitchFailure: true,
          failedAdams,
          stitchResults,
          error: failedAdams.length === 1
            ? `Η τεχνητή αλυσίδα δεν ανανεώθηκε πλήρως — απέτυχε ο κωδικός ${failedAdams[0]}. Δεν εφαρμόστηκαν αλλαγές.`
            : `Η τεχνητή αλυσίδα δεν ανανεώθηκε πλήρως — απέτυχαν οι κωδικοί ${failedAdams.join(', ')}. Δεν εφαρμόστηκαν αλλαγές.`,
          seedAdam: seedInfo.adam,
          seedSource: seedInfo.source,
          seedLabel: seedInfo.label,
        };
      }
      const primary = stitchResults[0];
      return {
        success: true,
        chainRes: primary.chainRes,
        seedAdam: seedInfo.adam,
        seedSource: seedInfo.source,
        seedLabel: seedInfo.label,
        usesStitchPlan: true,
        stitchPlanFormMismatch: false,
        stitchResults,
        projectSnapshot: project,
      };
    }

    const chainRes = await chainSvc.resolveKhmdhsAdamChain(seedInfo.adam, resolveOptsBase);

    if (!chainRes?.success) {
      return {
        success: false,
        aborted: !!chainRes?.aborted,
        error: chainRes?.error || 'Η ανάκτηση από το ΚΗΜΔΗΣ απέτυχε.',
        seedAdam: seedInfo.adam,
        seedSource: seedInfo.source,
        seedLabel: seedInfo.label,
      };
    }

    return {
      success: true,
      chainRes,
      seedAdam: seedInfo.adam,
      seedSource: seedInfo.source,
      seedLabel: seedInfo.label,
      usesStitchPlan: false,
      stitchPlanFormMismatch: !!seedPlan.stitchPlanFormMismatch,
      projectSnapshot: seedPlan.stitchPlanFormMismatch
        ? { ...project, khmdhsChainStitchPlan: null }
        : project,
    };
  } catch (e) {
    if (e?.name === 'AbortError' || e?.aborted) {
      return { success: false, aborted: true, error: 'Η διαδικασία ακυρώθηκε.' };
    }
    logger.error('preview-subproject-khmdhs-refresh error:', e.message);
    return { success: false, error: e.message || String(e) };
  } finally {
    if (localAbort && khmdhsBatchRefreshAbortController === localAbort) {
      khmdhsBatchRefreshAbortController = null;
    }
  }
});

/**
 * Πιάνει το υποέργο για όλη τη διάρκεια ανάγνωσης→αποθήκευσης μιας ανανέωσης ΚΗΜΔΗΣ,
 * αφού πρώτα βεβαιωθεί ότι δεν το κρατά ήδη κάποιος άλλος (ούτε μέσω του έργου του).
 */
ipcMain.handle('acquire-khmdhs-refresh-lock', async (_event, { subprojectId, actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (!username) return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const sid = String(subprojectId || '').trim();
    if (!sid) return { success: false, error: 'Λείπει αναγνωριστικό υποέργου' };

    const busy = getKhmdhsSubprojectBusyStatus(sid, username);
    if (busy.locked) {
      return {
        success: false,
        error: `Το υποέργο επεξεργάζεται από ${busy.lockedBy}`,
        lockedBy: busy.lockedBy,
      };
    }
    return createEntityLock('projects', sid, username);
  } catch (e) {
    logger.error('acquire-khmdhs-refresh-lock error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

/** Ελευθερώνει το κλείδωμα ανανέωσης — μόνο αν ανήκει στον ίδιο χρήστη. */
ipcMain.handle('release-khmdhs-refresh-lock', async (_event, { subprojectId, actingUsername } = {}) => {
  try {
    const sid = String(subprojectId || '').trim();
    const username = String(actingUsername || '').trim();
    if (!sid) return { success: false };
    const status = isEntityLocked('projects', sid);
    if (status.locked && status.lockedBy && username && status.lockedBy !== username) {
      return { success: false, error: 'Το κλείδωμα ανήκει σε άλλον χρήστη' };
    }
    return removeEntityLock('projects', sid);
  } catch (e) {
    logger.error('release-khmdhs-refresh-lock error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('batch-khmdhs-refresh-eligible', async (_event, { actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (!username) return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return { success: false, error: 'Η μαζική ανανέωση επιτρέπεται μόνο σε διαχειριστές.' };
    }

    const refreshSeed = require('./khmdhsChainRefreshSeed');
    const eligible = [];
    const skipped = [];

    if (!dataDir || !fs.existsSync(dataDir)) {
      return { success: true, eligible, skipped };
    }

    let projectDirs = [];
    try { projectDirs = fs.readdirSync(dataDir); } catch { projectDirs = []; }
    for (const projectDir of projectDirs) {
      try {
        if (DATA_DIR_SKIP_ROOT_DIRS.has(projectDir)) continue;
        const projectPath = path.join(dataDir, projectDir);
        let pStat;
        try { pStat = fs.statSync(projectPath); } catch { continue; }
        if (!pStat.isDirectory()) continue;
        let subDirs = [];
        try { subDirs = fs.readdirSync(projectPath); } catch { continue; }
        for (const subDir of subDirs) {
          try {
            const subPath = path.join(projectPath, subDir);
            let sStat;
            try { sStat = fs.statSync(subPath); } catch { continue; }
            if (!sStat.isDirectory()) continue;
            const jsonPath = path.join(subPath, 'data.json');
            if (!fs.existsSync(jsonPath)) continue;
            let project;
            try { project = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch { continue; }
            const sid = project.subprojectId;
            if (!sid) continue;
            // Ίδιο φίλτρο με loadAllProjects: χωρίς τίτλους δεν εμφανίζονται στο Dashboard
            // και δεν πρέπει να μετράνε ως επιλέξιμα για μαζική ανανέωση.
            const pTitle = String(project.projectTitle || '').trim();
            const sTitle = String(project.subprojectTitle || '').trim();
            if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') continue;
            const label = sTitle || sid;

            if (refreshSeed.isKhmdhsChainClosedSubproject(project)) {
              skipped.push({ id: sid, label, reason: 'Ολοκληρωμένο' });
              continue;
            }
            const seedInfo = refreshSeed.getKhmdhsRefreshSeedAdam(project);
            if (!seedInfo.adam) {
              skipped.push({ id: sid, label, reason: 'Χωρίς ΑΔΑΜ' });
              continue;
            }
            const lockStatus = isEntityLocked('projects', sid);
            if (lockStatus.locked) {
              skipped.push({ id: sid, label, reason: 'Κλειδωμένο' });
              continue;
            }
            // Ίδιος ορισμός ηλικίας με το badge φρεσκάδας της κάρτας (παλαιότερο fetchedAt)
            const { ageDays, lastRefreshed } = refreshSeed.getKhmdhsRefreshAge(project);
            eligible.push({
              id: sid,
              label,
              seedAdam: seedInfo.adam,
              lastRefreshed,
              ageDays,
            });
          } catch { /* προσπερνάμε προβληματικό υποέργο */ }
        }
      } catch { /* προσπερνάμε προβληματικό φάκελο έργου */ }
    }

    return { success: true, eligible, skipped };
  } catch (e) {
    logger.error('batch-khmdhs-refresh-eligible error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('khmdhs-fetch-supplementary-contract', async (_event, payload = {}) => {
  try {
    const chainSvc = require('./khmdhsAdamChainService');
    return await chainSvc.resolveKhmdhsSupplementaryContract(payload.adam, {
      primaryContractAdam: payload.primaryContractAdam,
      existingChainAdams: payload.existingChainAdams,
      amountContext: payload.amountContext,
    });
  } catch (error) {
    console.error('khmdhs-fetch-supplementary-contract:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('check-khmdhs-staleness', async (_event, { maxAgeDays = null, actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (username) {
      const user = findUserByUsername(username);
      if (!user || user.active === false) return { success: true, stale: [] };
      if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') return { success: true, stale: [] };
    }
    const refreshSeed = require('./khmdhsChainRefreshSeed');
    const stale = [];
    if (!dataDir || !fs.existsSync(dataDir)) return { success: true, stale };

    const staleAfterDays = Number.isFinite(Number(maxAgeDays)) && Number(maxAgeDays) > 0
      ? Number(maxAgeDays)
      : refreshSeed.KHMDHS_STALE_DAYS;

    // Επαναχρησιμοποίηση loadAllProjects (ευρετήριο) — όχι δεύτερη πλήρης σάρωση του δίσκου.
    const projects = await loadAllProjects();
    for (const project of projects || []) {
      try {
        if (!project) continue;
        const sid = project.subprojectId;
        if (!sid) continue;
        const pTitle = String(project.projectTitle || '').trim();
        const sTitle = String(project.subprojectTitle || '').trim();
        if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') continue;
        if (refreshSeed.isKhmdhsChainClosedSubproject(project)) continue;
        const seedInfo = refreshSeed.getKhmdhsRefreshSeedAdam(project);
        if (!seedInfo.adam) continue;

        const { ageDays, lastRefreshed } = refreshSeed.getKhmdhsRefreshAge(project);
        if (ageDays == null || ageDays >= staleAfterDays) {
          stale.push({
            id: sid,
            label: sTitle || sid,
            lastRefreshed,
            ageDays,
          });
        }
      } catch { /* προσπερνάμε προβληματικό υποέργο */ }
    }
    return { success: true, stale };
  } catch (e) {
    logger.error('check-khmdhs-staleness error:', e.message);
    return { success: true, stale: [] };
  }
});

const KHMDHS_BATCH_REPORT_FILE = 'khmdhs-batch-report.json';

/** Ασφαλές όνομα αρχείου από username (χωρίς διαδρομές/ειδικούς χαρακτήρες). */
function sanitizeUserFileKey(username) {
  const raw = String(username || '').trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]/g, '_').slice(0, 40);
  if (safe && safe === raw) return safe;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8);
  return `${safe || 'user'}-${hash}`;
}

/**
 * Η αναφορά μαζικής ανανέωσης κρατιέται ανά χρήστη: σε δήμο με πολλούς διαχειριστές, η
 * εκτέλεση του ενός δεν σβήνει τα ευρήματα του άλλου ούτε μπορεί να τα απορρίψει.
 */
function getKhmdhsBatchReportPath(username) {
  const key = sanitizeUserFileKey(username);
  return path.join(dataDir || '', 'config', `khmdhs-batch-report.${key}.json`);
}

function getLegacyKhmdhsBatchReportPath() {
  return path.join(dataDir || '', 'config', KHMDHS_BATCH_REPORT_FILE);
}

function requireKhmdhsBatchReportAccess(actingUsername) {
  const username = String(actingUsername || '').trim();
  if (!username) return { ok: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
  const user = findUserByUsername(username);
  if (!user || user.active === false || user.approved === false) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα' };
  }
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    return { ok: false, error: 'Δεν έχετε δικαίωμα' };
  }
  return { ok: true, username };
}

ipcMain.handle('get-khmdhs-batch-report', async (_event, { actingUsername } = {}) => {
  try {
    const auth = requireKhmdhsBatchReportAccess(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!dataDir) return { success: true, state: null };
    const filePath = getKhmdhsBatchReportPath(auth.username);

    // Μετάβαση από την παλιά κοινή αναφορά: την παραλαμβάνει ο πρώτος που θα τη ζητήσει.
    if (!fs.existsSync(filePath)) {
      const legacyPath = getLegacyKhmdhsBatchReportPath();
      if (fs.existsSync(legacyPath)) {
        try {
          fs.renameSync(legacyPath, filePath);
        } catch {
          return { success: true, state: null };
        }
      } else {
        return { success: true, state: null };
      }
    }
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { success: true, state: state && typeof state === 'object' ? state : null };
  } catch (e) {
    logger.error('get-khmdhs-batch-report error:', e.message);
    return { success: true, state: null };
  }
});

ipcMain.handle('save-khmdhs-batch-report', async (_event, { actingUsername, state } = {}) => {
  try {
    const auth = requireKhmdhsBatchReportAccess(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!dataDir) return { success: false, error: 'Δεν έχει οριστεί φάκελος δεδομένων' };
    const configDir = path.join(dataDir, 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const toSave = {
      ...(state && typeof state === 'object' ? state : {}),
      runBy: auth.username,
      updatedAt: new Date().toISOString(),
    };
    safeWriteJSON(getKhmdhsBatchReportPath(auth.username), toSave);
    return { success: true, state: toSave };
  } catch (e) {
    logger.error('save-khmdhs-batch-report error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('clear-khmdhs-batch-report', async (_event, { actingUsername } = {}) => {
  try {
    const auth = requireKhmdhsBatchReportAccess(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    // Σβήνει μόνο τη δική του αναφορά — ποτέ κάποιου άλλου διαχειριστή.
    const filePath = getKhmdhsBatchReportPath(auth.username);
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
    return { success: true };
  } catch (e) {
    logger.error('clear-khmdhs-batch-report error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Σήμανση εκτέλεσης μαζικής ανανέωσης — μία τη φορά σε όλο τον δήμο
// ─────────────────────────────────────────────────────────────────────────────

const KHMDHS_BATCH_RUN_FILE = 'khmdhs-batch-run.json';
/** Χωρίς σφυγμό για τόση ώρα, η εκτέλεση θεωρείται εγκαταλελειμμένη (κλείσιμο/κόλλημα). */
const KHMDHS_BATCH_RUN_STALE_MS = 2 * 60 * 1000;

function getKhmdhsBatchRunPath() {
  return path.join(dataDir || '', 'config', KHMDHS_BATCH_RUN_FILE);
}

/** Η ενεργή εκτέλεση, ή null αν δεν υπάρχει/έχει εγκαταλειφθεί. */
function readActiveKhmdhsBatchRun() {
  try {
    const filePath = getKhmdhsBatchRunPath();
    if (!dataDir || !fs.existsSync(filePath)) return null;
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!state?.username) return null;
    const beat = new Date(state.heartbeatAt || state.startedAt || 0).getTime();
    if (!beat || (Date.now() - beat) > KHMDHS_BATCH_RUN_STALE_MS) return null;
    return state;
  } catch {
    return null;
  }
}

ipcMain.handle('check-khmdhs-batch-run', async (_event, { actingUsername } = {}) => {
  const active = readActiveKhmdhsBatchRun();
  if (!active) return { success: true, running: false };
  const me = String(actingUsername || '').trim();
  return {
    success: true,
    running: true,
    mine: active.username === me,
    by: active.fullName || active.username,
    startedAt: active.startedAt || '',
    progress: active.progress || null,
  };
});

/** Πιάνει (ή ανανεώνει με σφυγμό) τη σήμανση εκτέλεσης. */
ipcMain.handle('start-khmdhs-batch-run', async (_event, { actingUsername, heartbeat, progress } = {}) => {
  try {
    const auth = requireKhmdhsBatchReportAccess(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!dataDir) return { success: false, error: 'Δεν έχει οριστεί φάκελος δεδομένων' };

    const active = readActiveKhmdhsBatchRun();
    if (active && active.username !== auth.username) {
      return {
        success: false,
        running: true,
        by: active.fullName || active.username,
        startedAt: active.startedAt || '',
        error: `Μαζική ανανέωση εκτελείται ήδη από ${active.fullName || active.username}.`,
      };
    }

    const user = findUserByUsername(auth.username);
    const configDir = path.join(dataDir, 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    safeWriteJSON(getKhmdhsBatchRunPath(), {
      username: auth.username,
      fullName: user?.fullName || '',
      host: os.hostname(),
      startedAt: (heartbeat && active?.startedAt) || new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      progress: progress || null,
    });
    return { success: true };
  } catch (e) {
    logger.error('start-khmdhs-batch-run error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

/** Ελευθερώνει τη σήμανση — μόνο ο ίδιος ο χρήστης που την κρατά. */
ipcMain.handle('end-khmdhs-batch-run', async (_event, { actingUsername } = {}) => {
  try {
    const me = String(actingUsername || '').trim();
    const filePath = getKhmdhsBatchRunPath();
    if (!dataDir || !fs.existsSync(filePath)) return { success: true };
    const active = readActiveKhmdhsBatchRun();
    if (active && active.username !== me) {
      return { success: false, error: 'Η εκτέλεση ανήκει σε άλλον χρήστη' };
    }
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    return { success: true };
  } catch (e) {
    logger.error('end-khmdhs-batch-run error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

/** Διαδρομή του data.json ενός υποέργου (άμεσος φάκελος ή σάρωση ανά έργο). */
function findSubprojectDataJsonPath(subprojectId) {
  const sid = String(subprojectId || '').trim();
  if (!sid || !dataDir) return '';
  // Πρώτα από το ευρετήριο — αλλιώς κάθε αναζήτηση σαρώνει όλο τον κοινό φάκελο.
  let hadIndex = false;
  try {
    const indexed = projectsIndex.findIndexedSubprojectPath(dataDir, sid);
    if (indexed) return indexed;
    // Μόνο όταν αποτύχει το ευρετήριο μας ενδιαφέρει αν υπήρχε — η μαζική ανανέωση καλεί
    // αυτή τη συνάρτηση εκατοντάδες φορές και δεν θέλουμε διπλό διάβασμα κάθε φορά.
    hadIndex = !!projectsIndex.readProjectsIndex(dataDir);
  } catch { /* πέφτουμε στην πλήρη σάρωση */ }

  // Αν το υποέργο υπάρχει στον δίσκο αλλά έλειπε από το ευρετήριο, συμπληρώνουμε την εγγραφή
  // που λείπει. Δεν σβήνουμε ολόκληρο το ευρετήριο: θα ανάγκαζε κάθε επόμενη αναζήτηση σε
  // πλήρη σάρωση του κοινού φακέλου μέχρι την επόμενη φόρτωση.
  const healIndexIfStale = (found) => {
    if (!found || !hadIndex) return found;
    try {
      const data = JSON.parse(fs.readFileSync(found, 'utf8'));
      if (data?.projectTitle && data?.subprojectTitle) {
        projectsIndex.upsertProjectsIndexEntry(dataDir, {
          ...data,
          projectId: path.basename(path.dirname(path.dirname(found))),
          subprojectId: path.basename(path.dirname(found)),
        });
      }
    } catch { /* το ευρετήριο θα ξαναχτιστεί στην επόμενη πλήρη φόρτωση */ }
    return found;
  };

  let rootDirs = [];
  try { rootDirs = fs.readdirSync(dataDir); } catch { rootDirs = []; }
  for (const dir of rootDirs) {
    try {
      if (DATA_DIR_SKIP_ROOT_DIRS.has(dir)) continue;
      const projectPath = path.join(dataDir, dir);
      try { if (!fs.statSync(projectPath).isDirectory()) continue; } catch { continue; }
      const directJson = path.join(projectPath, sid, 'data.json');
      if (fs.existsSync(directJson)) return healIndexIfStale(directJson);
      let subDirs = [];
      try { subDirs = fs.readdirSync(projectPath); } catch { continue; }
      for (const sub of subDirs) {
        try {
          const jsonPath = path.join(projectPath, sub, 'data.json');
          if (!fs.existsSync(jsonPath)) continue;
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (data.subprojectId === sid) return healIndexIfStale(jsonPath);
        } catch { /* προσπερνάμε προβληματικό υποέργο */ }
      }
    } catch { /* προσπερνάμε προβληματικό φάκελο έργου */ }
  }
  return '';
}

const KHMDHS_SNAPSHOT_SUFFIX = '.before-refresh';
/** Πόσο κρατάμε τα αντίγραφα πριν την ανανέωση προτού καθαριστούν. */
const KHMDHS_SNAPSHOT_KEEP_DAYS = 30;

ipcMain.handle('create-khmdhs-refresh-snapshot', async (_event, { subprojectId, actingUsername }) => {
  try {
    const username = String(actingUsername || '').trim();
    if (username) {
      const user = findUserByUsername(username);
      if (!user || user.active === false || user.approved === false) {
        return { success: false, error: 'Δεν έχετε δικαίωμα' };
      }
    }
    const jsonPath = findSubprojectDataJsonPath(subprojectId);
    if (!jsonPath) return { success: false };
    fs.copyFileSync(jsonPath, `${jsonPath}${KHMDHS_SNAPSHOT_SUFFIX}`);
    return { success: true };
  } catch (e) {
    logger.error('create-khmdhs-refresh-snapshot error:', e.message);
    return { success: false };
  }
});

/** Πληροφορίες για το αντίγραφο ασφαλείας πριν την τελευταία ανανέωση. */
ipcMain.handle('get-khmdhs-refresh-snapshot-info', async (_event, { subprojectId, actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (!username) return { success: true, exists: false };
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: true, exists: false };
    }
    const jsonPath = findSubprojectDataJsonPath(subprojectId);
    if (!jsonPath) return { success: true, exists: false };
    const snapshotPath = `${jsonPath}${KHMDHS_SNAPSHOT_SUFFIX}`;
    if (!fs.existsSync(snapshotPath)) return { success: true, exists: false };
    const st = fs.statSync(snapshotPath);
    return { success: true, exists: true, takenAt: new Date(st.mtimeMs).toISOString() };
  } catch (e) {
    logger.error('get-khmdhs-refresh-snapshot-info error:', e.message);
    return { success: true, exists: false };
  }
});

/**
 * Επαναφέρει το υποέργο στην κατάσταση που είχε πριν την τελευταία ανανέωση ΚΗΜΔΗΣ.
 * Το αντίγραφο κρατιέται αυτόματα σε κάθε ανανέωση· εδώ αποκτά νόημα για τον χρήστη.
 */
ipcMain.handle('restore-khmdhs-refresh-snapshot', async (_event, { subprojectId, actingUsername } = {}) => {
  try {
    const username = String(actingUsername || '').trim();
    if (!username) return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return { success: false, error: 'Η επαναφορά επιτρέπεται μόνο σε διαχειριστές' };
    }

    const sid = String(subprojectId || '').trim();
    const busy = getKhmdhsSubprojectBusyStatus(sid, username);
    if (busy.locked) {
      return { success: false, error: `Το υποέργο το επεξεργάζεται ο/η ${busy.lockedBy}. Δοκιμάστε ξανά σε λίγο.` };
    }

    const jsonPath = findSubprojectDataJsonPath(sid);
    if (!jsonPath) return { success: false, error: 'Δεν βρέθηκε το υποέργο' };
    const snapshotPath = `${jsonPath}${KHMDHS_SNAPSHOT_SUFFIX}`;
    if (!fs.existsSync(snapshotPath)) {
      return { success: false, error: 'Δεν υπάρχει αποθηκευμένη προηγούμενη κατάσταση' };
    }

    let snapshot;
    try {
      snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      return { success: false, error: 'Το αντίγραφο δεν είναι αναγνώσιμο' };
    }
    if (!snapshot || snapshot.subprojectId !== sid) {
      return { success: false, error: 'Το αντίγραφο δεν αντιστοιχεί σε αυτό το υποέργο' };
    }

    // Κρατάμε το υποέργο για όση ώρα γράφουμε, όπως κάνει και η ανανέωση.
    const lockRes = createEntityLock('projects', sid, username);
    if (!lockRes?.success) {
      return { success: false, error: lockRes?.error || 'Το υποέργο είναι πιασμένο αυτή τη στιγμή' };
    }
    try {
      snapshot.updatedAt = new Date().toISOString();
      delete snapshot.khmdhsLastRefreshFindings;
      safeWriteJSON(jsonPath, snapshot);
      try { projectsIndex.upsertProjectsIndexEntry(dataDir, snapshot); } catch { /* ignore */ }
      // Το αντίγραφο καταναλώνεται: δεν επαναφέρουμε δεύτερη φορά την ίδια κατάσταση.
      try { fs.unlinkSync(snapshotPath); } catch { /* ignore */ }
    } finally {
      if (!lockRes.alreadyHeld) removeEntityLock('projects', sid);
    }

    logAuditAction({
      type: 'update',
      entityType: 'subproject',
      entityId: sid,
      entityTitle: snapshot.subprojectTitle || '',
      userFullName: user.fullName || username,
      userRole: user.role,
      details: 'Επαναφορά στην κατάσταση πριν την τελευταία ανανέωση ΚΗΜΔΗΣ',
    });
    return { success: true };
  } catch (e) {
    logger.error('restore-khmdhs-refresh-snapshot error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

/** Καθαρισμός παλιών αντιγράφων πριν την ανανέωση — δεν χρειάζονται για πάντα. */
function cleanupOldKhmdhsSnapshots() {
  try {
    if (!dataDir || !fs.existsSync(dataDir)) return { removed: 0 };
    const cutoff = Date.now() - KHMDHS_SNAPSHOT_KEEP_DAYS * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const projectDir of fs.readdirSync(dataDir)) {
      if (DATA_DIR_SKIP_ROOT_DIRS.has(projectDir)) continue;
      const projectPath = path.join(dataDir, projectDir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue;
        for (const subDir of fs.readdirSync(projectPath)) {
          const snapshotPath = path.join(projectPath, subDir, `data.json${KHMDHS_SNAPSHOT_SUFFIX}`);
          try {
            if (!fs.existsSync(snapshotPath)) continue;
            if (fs.statSync(snapshotPath).mtimeMs >= cutoff) continue;
            fs.unlinkSync(snapshotPath);
            removed++;
          } catch { /* προσπερνάμε προβληματικό αντίγραφο */ }
        }
      } catch { /* προσπερνάμε προβληματικό φάκελο */ }
    }
    if (removed) logger.info(`cleanupOldKhmdhsSnapshots: removed ${removed}`);
    return { removed };
  } catch (e) {
    logger.error('cleanupOldKhmdhsSnapshots error:', e.message);
    return { removed: 0 };
  }
}

/**
 * Γράφει ΜΟΝΟ το πεδίο ευρημάτων τελευταίας ανανέωσης στο υποέργο.
 * Χρησιμοποιείται όταν η μαζική ανανέωση δεν αποθηκεύει δεδομένα (αποτυχία, εκκρεμής
 * χαρακτηρισμός) αλλά πρέπει να μείνει ίχνος μέσα στο υποέργο για τον χρήστη.
 */
ipcMain.handle('save-khmdhs-refresh-findings', async (_event, { subprojectId, actingUsername, findings } = {}) => {
  try {
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
    const username = String(actingUsername || '').trim();
    if (!username) return { success: false, error: 'Απαιτείται ταυτοποίηση χρήστη' };
    const user = findUserByUsername(username);
    if (!user || user.active === false || user.approved === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const jsonPath = findSubprojectDataJsonPath(subprojectId);
    if (!jsonPath) return { success: false, error: 'Δεν βρέθηκε το υποέργο' };

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {
      return { success: false, error: 'Δεν ήταν δυνατή η ανάγνωση του υποέργου' };
    }
    if (findings && typeof findings === 'object') {
      data.khmdhsLastRefreshFindings = findings;
    } else {
      delete data.khmdhsLastRefreshFindings;
    }
    safeWriteJSON(jsonPath, data);
    // Ενημέρωση ευρετηρίου (αλλιώς το αλλαγμένο mtime επιβάλλει πλήρη σάρωση στο επόμενο load)
    try { projectsIndex.upsertProjectsIndexEntry(dataDir, data); } catch { /* ignore */ }
    return { success: true };
  } catch (e) {
    logger.error('save-khmdhs-refresh-findings error:', e.message);
    return { success: false, error: e.message || String(e) };
  }
});

ipcMain.handle('open-external-url', async (_event, { url }) => {
  try {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) {
      return { success: false, error: 'Μη έγκυρο URL' };
    }
    await shell.openExternal(u);
    return { success: true };
  } catch (error) {
    console.error('open-external-url:', error);
    return { success: false, error: error.message || String(error) };
  }
});

ipcMain.handle('open-khmdhs-act-view', async (_event, { adam, label } = {}) => {
  try {
    const { openKhmdhsPdfInBrowser } = require('./khmdhsPdfBrowserView');
    return await openKhmdhsPdfInBrowser(adam, label);
  } catch (error) {
    logger.error('open-khmdhs-act-view:', error);
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

/**
 * Εντοπισμός πραγματικού φακέλου υποέργου στον δίσκο.
 * Δεν εμπιστευόμαστε τυφλά το projectId από τον renderer — μπορεί να διαφέρει από το όνομα φακέλου.
 * @returns {{ projectDirName: string, subprojectDir: string } | null}
 */
function resolveSubprojectDirOnDisk(projectId, subprojectId) {
  const sid = String(subprojectId || '').trim();
  if (!sid || !dataDir || !fs.existsSync(dataDir)) return null;

  const tryPath = (projectDirName) => {
    const subDir = path.join(dataDir, projectDirName, sid);
    try {
      if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
        return { projectDirName, subprojectDir: subDir };
      }
    } catch { /* ignore */ }
    return null;
  };

  // 1) Προτιμούμε το δηλωθέν projectId αν υπάρχει ο φάκελος
  if (projectId) {
    const hit = tryPath(String(projectId).trim());
    if (hit) return hit;
  }

  // 2) Σάρωση όλων των φακέλων έργου — ίδια λογική με την αποθήκευση
  for (const dir of fs.readdirSync(dataDir)) {
    if (DATA_DIR_SKIP_ROOT_DIRS.has(dir)) continue;
    const projectPath = path.join(dataDir, dir);
    try {
      if (!fs.statSync(projectPath).isDirectory()) continue;
    } catch { continue; }

    const byFolder = tryPath(dir);
    if (byFolder) return byFolder;

    // 3) Fallback: φάκελος με διαφορετικό όνομα αλλά data.json.subprojectId = sid
    try {
      for (const sub of fs.readdirSync(projectPath)) {
        const subPath = path.join(projectPath, sub);
        const jsonPath = path.join(subPath, 'data.json');
        if (!fs.existsSync(jsonPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (String(data.subprojectId || '').trim() === sid) {
            return { projectDirName: dir, subprojectDir: subPath };
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return null;
}

ipcMain.handle('delete-subproject', async (event, projectId, subprojectId) => {
  try {
    console.log(`Deleting subproject: ${projectId}/${subprojectId}`);

    const resolved = resolveSubprojectDirOnDisk(projectId, subprojectId);
    if (!resolved) {
      console.error('Subproject directory not found for delete:', { projectId, subprojectId });
      return {
        success: false,
        error: 'Ο φάκελος του υποέργου δεν βρέθηκε στον δίσκο. Ανανεώστε τη λίστα και δοκιμάστε ξανά.',
      };
    }

    // Προστασία: αν κάποιος χρήστης επεξεργάζεται αυτό το υποέργο, δεν διαγράφεται.
    const lockCheck = isProjectLocked(resolved.projectDirName);
    const deleteGate = subprojectLifecycleCore.evaluateSubprojectDelete({
      projectId: resolved.projectDirName,
      subprojectId,
      locked: lockCheck.locked,
    });
    if (!deleteGate.ok && deleteGate.reason === 'locked') {
      const who = lockCheck.lockedBy || 'άλλον χρήστη';
      return {
        success: false,
        error: `Το υποέργο είναι κλειδωμένο από ${who}. Κλείστε πρώτα την επεξεργασία.`,
      };
    }

    const { projectDirName, subprojectDir } = resolved;
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
    console.log('Deleting subproject directory:', subprojectDir);
    fs.rmSync(subprojectDir, { recursive: true, force: true });
    if (fs.existsSync(subprojectDir)) {
      return {
        success: false,
        error: 'Ο φάκελος δεν διαγράφηκε (ίσως είναι ανοιχτός σε άλλη εφαρμογή). Κλείστε σχετικά παράθυρα και δοκιμάστε ξανά.',
      };
    }
    console.log('Subproject directory deleted successfully');
    
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

    // Αποσύνδεση μελετών από διαγραμμένο υποέργο
    try {
      const meletaiSvc = getMeletaiService();
      if (meletaiSvc) {
        const unlinkRes = meletaiSvc.unlinkStudiesForSubproject(subprojectId);
        if (unlinkRes?.unlinked > 0) {
          console.log(`Unlinked ${unlinkRes.unlinked} meleti record(s) from subproject ${subprojectId}`);
          logAuditAction({
            type: 'update',
            entityType: 'meleti',
            entityId: unlinkRes.meletiId,
            entityTitle: unlinkRes.previous
              ? `${unlinkRes.previous.studyNumber} — ${unlinkRes.previous.title}`
              : unlinkRes.meletiId,
            userFullName: 'Σύστημα',
            userRole: 'SYSTEM',
            details: `Αυτόματη αποσύνδεση — διαγράφηκε υποέργο ${deletedData?.subprojectTitle || subprojectId}`,
            oldValue: meletaiSvc.pickAuditSnapshot(unlinkRes.previous),
            newValue: meletaiSvc.pickAuditSnapshot(unlinkRes.meleti),
          });
        }
      }
    } catch (err) {
      console.error('Error unlinking meletai from subproject:', err);
    }
    
    // Έλεγχος αν το έργο είναι άδειο — χρησιμοποιούμε τον πραγματικό φάκελο που βρήκαμε
    const projectDir = path.join(dataDir, projectDirName);
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

    try {
      projectsIndex.removeProjectsIndexEntry(dataDir, subprojectId);
    } catch (idxErr) {
      console.error('projectsIndex remove after delete failed:', idxErr?.message || idxErr);
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
    const filesDir = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
    
    const savedFiles = [];
    
    for (const file of files) {
      let fileName = path.basename(file.name || file.path || '');
      if (!fileName) continue;

      let destPath = path.join(filesDir, fileName);
      let counter = 1;
      while (fs.existsSync(destPath)) {
        const ext = path.extname(fileName);
        const stem = path.basename(fileName, ext);
        fileName = `${stem}_${counter}${ext}`;
        destPath = path.join(filesDir, fileName);
        counter += 1;
      }

      fs.copyFileSync(file.path, destPath);
      savedFiles.push(fileName);
    }
    
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    if (fs.existsSync(dataPath) && savedFiles.length > 0) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        if (!Array.isArray(data.files)) {
          data.files = [];
        }
        savedFiles.forEach((fileName) => {
          if (!data.files.includes(fileName)) {
            data.files.push(fileName);
          }
        });
        data.updatedAt = new Date().toISOString();
        safeWriteJSON(dataPath, data);
      } catch (jsonErr) {
        console.error('Error updating data.json after save-files:', jsonErr);
      }
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

function removeFileFromSubprojectData(data, fileName) {
  if (!data || !fileName) return;
  if (data.subprojectFiles && Array.isArray(data.subprojectFiles)) {
    data.subprojectFiles = data.subprojectFiles.filter((file) => file !== fileName);
  }
  if (data.files && Array.isArray(data.files)) {
    data.files = data.files.filter((file) => file !== fileName);
  }
  if (data.fileGroups && Array.isArray(data.fileGroups)) {
    data.fileGroups = data.fileGroups
      .map((group) => ({
        ...group,
        files: group.files.filter((file) => {
          const n = typeof file === 'string' ? file : (file?.name || file?.fileName || '');
          return n !== fileName;
        }),
      }))
      .filter((group) => group.files.length > 0);
  }
}

ipcMain.handle('delete-file', async (event, projectId, subprojectId, fileName) => {
  try {
    const filePath = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');
    if (fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        removeFileFromSubprojectData(data, fileName);
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
      details: 'Διαγραφή αρχείου υποέργου',
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-files', async (_event, { projectId, subprojectId, fileNames } = {}) => {
  try {
    if (!projectId || !subprojectId) {
      return { success: false, error: 'Απαιτούνται projectId και subprojectId' };
    }
    const names = [...new Set(
      (Array.isArray(fileNames) ? fileNames : [])
        .map((f) => String(f || '').trim())
        .filter(Boolean)
    )];
    if (!names.length) {
      return { success: false, error: 'Δεν επιλέχθηκαν αρχεία' };
    }

    const filesDir = path.join(dataDir, projectId, subprojectId, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    const dataPath = path.join(dataDir, projectId, subprojectId, 'data.json');

    names.forEach((fileName) => {
      const filePath = path.join(filesDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    if (fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        names.forEach((fileName) => removeFileFromSubprojectData(data, fileName));
        safeWriteJSON(dataPath, data);
      } catch (jsonError) {
        console.error('Error updating JSON after bulk file deletion:', jsonError);
        return { success: false, error: jsonError.message };
      }
    }

    const titlePreview = names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 3).join(', ')} (+${names.length - 3})`;

    logAuditAction({
      type: 'delete',
      entityType: 'file',
      entityId: subprojectId,
      entityTitle: titlePreview,
      details: `Μαζική διαγραφή ${names.length} αρχείων υποέργου`,
    });

    return { success: true, deletedCount: names.length };
  } catch (error) {
    console.error('Error deleting files:', error);
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
                const mainFilePath = path.join(mainFilesDir, actualFileName);
                if (fs.existsSync(mainFilePath)) {
                  console.log('✅ File found in main directory (from group):', mainFilePath);
                  return mainFilePath;
                }

                const safeGroupName = (group.title || group.id || 'GROUP')
                  .replace(/[<>:"/\\|?*]/g, '_')
                  .substring(0, 50);
                const groupFolderPath = path.join(mainFilesDir, safeGroupName);

                if (fs.existsSync(groupFolderPath)) {
                  const groupFilePath = path.join(groupFolderPath, actualFileName);
                  if (fs.existsSync(groupFilePath)) {
                    console.log('✅ File found in group folder:', groupFilePath);
                    return groupFilePath;
                  }
                }

                const treeMatch = findFileInDirectoryTree(mainFilesDir, actualFileName);
                if (treeMatch) {
                  console.log('✅ File found in directory tree (from group):', treeMatch);
                  return treeMatch;
                }

                if (filePathFromData && fs.existsSync(filePathFromData)
                  && isPathInsideDir(filePathFromData, mainFilesDir)) {
                  console.log('✅ File found at path inside subproject files:', filePathFromData);
                  return filePathFromData;
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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
      entityTitle: savedData.subject || savedData.title || savedData.projectTitle || entaxiId,
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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

// File picker for multiple files (entaxis: έγγραφα · chat/χώρος: όλα τα αρχεία με allFileTypes)
ipcMain.handle('select-multiple-files', async (event, arg = 'Επιλογή Αρχείων') => {
  try {
    const { dialog } = require('electron');
    const title = typeof arg === 'string' ? arg : (arg?.title || 'Επιλογή Αρχείων');
    const allFileTypes = typeof arg === 'object' && !!arg?.allFileTypes;
    const filters = allFileTypes
      ? [{ name: 'Όλα τα αρχεία', extensions: ['*'] }]
      : [
          { name: 'Έγγραφα (PDF, Word)', extensions: ['pdf', 'doc', 'docx'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Word', extensions: ['doc', 'docx'] },
          { name: 'Όλα τα αρχεία', extensions: ['*'] }
        ];
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile', 'multiSelections'],
      filters
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // Χώρος εργασίας: άμεση αναφορά στα πρωτότυπα (αντιγραφή στο addFiles) — αποφυγή collision στο temp
      if (allFileTypes) {
        const files = result.filePaths.map((filePath) => ({
          filePath,
          fileName: path.basename(filePath).replace(/[<>:"/\\|?*]/g, '_')
        }));
        return { success: true, files };
      }

      const files = copyFilePathsToTempUpload(result.filePaths);
      return {
        success: true,
        files
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error selecting files:', error);
    return { success: false, error: error.message };
  }
});

const TASK_UPLOAD_MAX_FOLDER_FILES = 250;

function copyFilePathsToTempUpload(filePaths) {
  const tempDir = getTempDir();
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const files = [];
  for (const sourcePath of filePaths) {
    const baseName = path.basename(sourcePath).replace(/[<>:"/\\|?*]/g, '_');
    if (!baseName) continue;
    let destName = baseName;
    let tempFilePath = path.join(tempDir, destName);
    let counter = 1;
    while (fs.existsSync(tempFilePath)) {
      const ext = path.extname(baseName);
      const stem = path.basename(baseName, ext);
      destName = `${stem}_${counter}${ext}`;
      tempFilePath = path.join(tempDir, destName);
      counter += 1;
    }
    fs.copyFileSync(sourcePath, tempFilePath);
    files.push({ filePath: tempFilePath, fileName: destName });
  }
  return files;
}

function collectFilesRecursive(dirPath, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        collectFilesRecursive(full, collected);
      } else if (entry.isFile()) {
        collected.push(full);
      }
    } catch {
      /* skip inaccessible */
    }
  }
  return collected;
}

/** Επιλογή ενός φακέλου — όλα τα αρχεία (υποφάκελοι) για ανέβασμα σε χώρο εργασίας */
ipcMain.handle('select-folder-files-flat', async (_event, arg = {}) => {
  try {
    const title = typeof arg === 'string' ? arg : (arg?.title || 'Επιλογή φακέλου');
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true };
    }
    const folderPath = result.filePaths[0];
    const sourceFiles = collectFilesRecursive(folderPath);
    if (sourceFiles.length === 0) {
      return { success: false, error: 'Ο φάκελος δεν περιέχει αρχεία' };
    }
    if (sourceFiles.length > TASK_UPLOAD_MAX_FOLDER_FILES) {
      return {
        success: false,
        error: `Ο φάκελος περιέχει πάρα πολλά αρχεία (${sourceFiles.length}). Μέγιστο: ${TASK_UPLOAD_MAX_FOLDER_FILES}.`
      };
    }
    const files = copyFilePathsToTempUpload(sourceFiles);
    if (!files.length) {
      return { success: false, error: 'Δεν αντιγράφηκαν αρχεία από τον φάκελο' };
    }
    return {
      success: true,
      files,
      folderName: path.basename(folderPath),
      fileCount: files.length
    };
  } catch (error) {
    console.error('Error selecting folder files:', error);
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

async function loadAllProskliseis() {
  try {
    const { applyEffectiveDeadlineToProsklisi } = require('./prosklisiDeadlineHelper');
    const dir = dataDir ? path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ') : proskliseisDir;
    if (!dir) return [];
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return [];
    }
    const proskliseis = [];
    const prosklisiDirs = fs.readdirSync(dir);
    for (const prosklisiDir of prosklisiDirs) {
      const folderPath = path.join(dir, prosklisiDir);
      const dataFilePath = path.join(folderPath, 'data.json');
      if (!fs.existsSync(dataFilePath)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        // Ισχύουσα λήξη από τροποποιήσεις (μόνο στη μνήμη — χωρίς εγγραφή στο hot path φόρτωσης)
        proskliseis.push(applyEffectiveDeadlineToProsklisi(raw, folderPath, { persist: false }));
      } catch (parseError) {
        console.error('Error parsing prosklisi data:', parseError);
      }
    }
    return proskliseis;
  } catch (error) {
    console.error('Error loading proskliseis:', error);
    return [];
  }
}

// Load all proskliseis
ipcMain.handle('load-all-proskliseis', async () => loadAllProskliseis());

// Save prosklisi
ipcMain.handle('save-prosklisi', async (event, prosklisiData) => {
  try {
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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

    const dataFilePath = path.join(prosklisiDir, 'data.json');
    let existingProsklisiData = null;
    if (fs.existsSync(dataFilePath)) {
      try { existingProsklisiData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8')); } catch (_e) { /* ignore */ }
    }
    const existingOnDisk = existingProsklisiData || {};

    // Prepare data to save
    const savedData = { ...prosklisiData };

    // Handle file groups FIRST - copy files and save groups data
    if (prosklisiData.fileGroups && Array.isArray(prosklisiData.fileGroups) && prosklisiData.fileGroups.length > 0) {
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
          
          const existingGroup = (existingOnDisk.fileGroups || []).find((g) => g.id === group.id);
          const groupFiles = [...(existingGroup?.files || [])];
          
          for (const file of group.files) {
            if (file.filePath) {
              // Use original filename without any prefixes
              const originalFileName = path.basename(file.fileName || file.filePath);
              const destPath = path.join(groupFolderPath, originalFileName);
              
              if (fs.existsSync(file.filePath)) {
                console.log('Copying group file from:', file.filePath, 'to:', destPath);
                fs.copyFileSync(file.filePath, destPath);
                if (!groupFiles.some((gf) => gf.fileName === originalFileName)) {
                  groupFiles.push({
                    fileName: originalFileName,
                    originalName: file.fileName,
                    filePath: destPath
                  });
                }
                console.log('Group file copied successfully');
              } else {
                console.error('Source group file not found:', file.filePath);
              }
            } else if (file.fileName && !groupFiles.some((gf) => gf.fileName === file.fileName)) {
              groupFiles.push(file);
            }
          }
          
          savedData.fileGroups.push({
            id: group.id,
            title: group.title,
            files: groupFiles
          });
        }
      }

      for (const existingGroup of existingOnDisk.fileGroups || []) {
        if (!savedData.fileGroups.some((g) => g.id === existingGroup.id)) {
          savedData.fileGroups.push(existingGroup);
        }
      }
    } else if (existingOnDisk.fileGroups?.length) {
      savedData.fileGroups = existingOnDisk.fileGroups;
    }

    // Handle prosklisi PDF files (multiple files with folder choice) - AFTER file groups
    if (prosklisiData.prosklisiFiles && Array.isArray(prosklisiData.prosklisiFiles)) {
      const newUploads = prosklisiData.prosklisiFiles.filter((file) => file.filePath);
      savedData.prosklisiFiles = [...(existingOnDisk.prosklisiFiles || [])];
      
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
      
      for (const file of newUploads) {
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
            if (!savedData.prosklisiFiles.some((f) => f.fileName === originalFileName)) {
              savedData.prosklisiFiles.push({
                fileName: originalFileName,
                originalName: file.fileName,
                targetFolder: file.targetFolder
              });
            }
            console.log('Prosklisi file copied successfully');
          } else {
            console.error('Source prosklisi file not found:', file.filePath);
          }
        }
      }
    } else if (existingOnDisk.prosklisiFiles?.length) {
      savedData.prosklisiFiles = existingOnDisk.prosklisiFiles;
    }

    // Handle prosklisi folders
    if (prosklisiData.prosklisiFolders && Array.isArray(prosklisiData.prosklisiFolders)) {
      const newFolderUploads = prosklisiData.prosklisiFolders.filter((folder) => folder.folderPath);
      savedData.prosklisiFolders = [...(existingOnDisk.prosklisiFolders || [])];
      
      for (const folder of newFolderUploads) {
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
            
            if (!savedData.prosklisiFolders.some((f) => f.folderName === folderName)) {
              savedData.prosklisiFolders.push({
                folderName: folderName,
                originalName: folder.folderName,
                targetFolder: folder.targetFolder
              });
            }
            console.log('Prosklisi folder copied successfully');
          } else {
            console.error('Source prosklisi folder not found:', folder.folderPath);
          }
        }
      }
    } else if (existingOnDisk.prosklisiFolders?.length) {
      savedData.prosklisiFolders = existingOnDisk.prosklisiFolders;
    }


    const finalData = {
      ...existingOnDisk,
      ...savedData,
      createdAt: existingOnDisk.createdAt || savedData.createdAt,
      fileGroups: savedData.fileGroups ?? existingOnDisk.fileGroups ?? [],
      prosklisiFiles: savedData.prosklisiFiles ?? existingOnDisk.prosklisiFiles ?? [],
      prosklisiFolders: savedData.prosklisiFolders ?? existingOnDisk.prosklisiFolders ?? [],
      documentRegistry: savedData.documentRegistry ?? existingOnDisk.documentRegistry
    };

    safeWriteJSON(dataFilePath, finalData);
    
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
    
    const mergedData = {
      ...existingData,
      ...finalData,
      fileGroups: finalData.fileGroups?.length
        ? finalData.fileGroups
        : (existingData.fileGroups || existingOnDisk.fileGroups || []),
      prosklisiFiles: finalData.prosklisiFiles,
      prosklisiFolders: finalData.prosklisiFolders
    };
    
    safeWriteJSON(prosklisiDataPath, mergedData);
    
    console.log('Prosklisi saved successfully to:', dataFilePath);
    logAuditAction({
      type: existingProsklisiData ? 'update' : 'create',
      entityType: 'prosklisi',
      entityId: prosklisiData.prosklisiId,
      entityTitle: finalData.title || prosklisiData.prosklisiId,
      details: existingProsklisiData ? 'Ενημέρωση πρόσκλησης' : 'Δημιουργία νέας πρόσκλησης',
      oldValue: existingProsklisiData,
      newValue: finalData
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
    let documentRegistry = [];
    let diavgeiaMeta = null;
    let diavgeiaAda = '';
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      documentRegistry = data.documentRegistry || [];
      diavgeiaMeta = data.diavgeiaMeta || null;
      diavgeiaAda = data.diavgeiaAda || '';
      
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
    
    let modifications = [];
    const modificationsPath = path.join(prosklisiDir, 'modifications.json');
    if (fs.existsSync(modificationsPath)) {
      try {
        modifications = JSON.parse(fs.readFileSync(modificationsPath, 'utf8')) || [];
      } catch (modErr) {
        console.error('Error loading prosklisi modifications for file manager:', modErr);
      }
    }

    return {
      success: true,
      files: files,
      folders: folders,
      fileGroups: fileGroups,
      documentRegistry,
      diavgeiaMeta,
      diavgeiaAda,
      modifications,
    };
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

// Create prosklisi group — ομαδοποιεί ήδη ανεβασμένα αρχεία (π.χ. μετά από ανέβασμα φακέλου)
ipcMain.handle('create-prosklisi-group', async (event, prosklisiId, groupTitle, fileNames) => {
  try {
    if (!prosklisiId) return { success: false, error: 'Απαιτείται prosklisiId' };
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return { success: false, error: 'Δεν δόθηκαν αρχεία για ομαδοποίηση' };
    }

    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const dataPath = path.join(prosklisiDir, 'data.json');
    if (!fs.existsSync(dataPath)) {
      return { success: false, error: 'Η πρόσκληση δεν βρέθηκε' };
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const prosklisiFiles = Array.isArray(data.prosklisiFiles) ? data.prosklisiFiles : [];
    const nameSet = new Set(fileNames);
    const isMatch = (f) => nameSet.has(f.fileName) && f.targetFolder !== 'main';
    const matchedFiles = prosklisiFiles.filter(isMatch);
    if (matchedFiles.length === 0) {
      return { success: false, error: 'Τα αρχεία δεν βρέθηκαν στη λίστα μη ομαδοποιημένων' };
    }

    data.prosklisiFiles = prosklisiFiles.filter((f) => !isMatch(f));
    const newGroup = {
      id: uuidv4(),
      title: String(groupTitle || 'Φάκελος').trim() || 'Φάκελος',
      files: matchedFiles,
    };
    data.fileGroups = [...(Array.isArray(data.fileGroups) ? data.fileGroups : []), newGroup];
    data.updatedAt = new Date().toISOString();
    safeWriteJSON(dataPath, data);

    // Το prosklisi_data.json τροφοδοτεί την ενότητα «Ομαδοποιημένα Αρχεία» — πρέπει να μείνει
    // συγχρονισμένο, αλλιώς η νέα ομάδα δεν θα εμφανιστεί πουθενά στο modal.
    const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
    let existingData = {};
    if (fs.existsSync(prosklisiDataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
      } catch (_e) { /* ignore */ }
    }
    safeWriteJSON(prosklisiDataPath, {
      ...existingData,
      ...data,
      prosklisiFiles: data.prosklisiFiles,
      fileGroups: data.fileGroups,
      updatedAt: data.updatedAt,
    });

    logAuditAction({
      type: 'create',
      entityType: 'file_group',
      entityId: newGroup.id,
      entityTitle: newGroup.title,
      details: `Δημιουργία ομάδας αρχείων πρόσκλησης με ${matchedFiles.length} αρχεία`
    });

    return { success: true, groupId: newGroup.id };
  } catch (error) {
    console.error('Error creating prosklisi group:', error);
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

    if (!isPathInsideDir(filePath, dataDir)) {
      const fileName = path.basename(filePath);
      const parentParts = String(filePath).split(/[/\\]/);
      const subprojectHint = parentParts.find((p) => p && p.length === 36) || '';
      if (subprojectHint) {
        const projectHint = parentParts[parentParts.indexOf(subprojectHint) - 1] || '';
        if (projectHint) {
          const filesDir = path.join(dataDir, projectHint, subprojectHint, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
          const resolved = findFileInDirectoryTree(filesDir, fileName);
          if (resolved) filePath = resolved;
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

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
ipcMain.handle('upload-prosklisi-files', async (_event, { prosklisiId, files, targetFolder = 'attachments' }) => {
  try {
    if (!prosklisiId) return { success: false, error: 'Απαιτείται prosklisiId' };
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'Δεν επιλέχθηκαν αρχεία' };
    }

    const prosklisiDir = path.join(proskliseisDir, prosklisiId);
    const dataFilePath = path.join(prosklisiDir, 'data.json');
    if (!fs.existsSync(dataFilePath)) {
      return { success: false, error: 'Η πρόσκληση δεν βρέθηκε' };
    }

    const mainFilesDir = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachmentsDir = path.join(mainFilesDir, 'Επισυναπτόμενα Αρχεία Υποβολής');
    if (!fs.existsSync(mainFilesDir)) fs.mkdirSync(mainFilesDir, { recursive: true });
    if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });

    const targetDir = targetFolder === 'main' ? mainFilesDir : attachmentsDir;
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const prosklisiFiles = [...(data.prosklisiFiles || [])];
    const added = [];

    for (const file of files) {
      if (!file?.filePath || !fs.existsSync(file.filePath)) continue;
      const originalFileName = path.basename(file.fileName || file.filePath);
      if (prosklisiFiles.some((f) => f.fileName === originalFileName)) continue;
      const destPath = path.join(targetDir, originalFileName);
      fs.copyFileSync(file.filePath, destPath);
      prosklisiFiles.push({
        fileName: originalFileName,
        originalName: file.fileName,
        targetFolder: targetFolder === 'main' ? 'main' : 'attachments',
      });
      added.push(originalFileName);
    }

    if (!added.length) {
      return { success: false, error: 'Δεν προστέθηκαν νέα αρχεία (ίσως υπάρχουν ήδη)' };
    }

    data.prosklisiFiles = prosklisiFiles;
    data.updatedAt = new Date().toISOString();
    safeWriteJSON(dataFilePath, data);

    const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
    if (fs.existsSync(prosklisiDataPath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
        safeWriteJSON(prosklisiDataPath, { ...existingData, ...data, prosklisiFiles });
      } catch (_e) { /* ignore */ }
    }

    logAuditAction({
      type: 'update',
      entityType: 'prosklisi',
      entityId: prosklisiId,
      entityTitle: data.title || prosklisiId,
      details: `Προστέθηκαν ${added.length} αρχεία στην πρόσκληση`,
    });
    return { success: true, addedCount: added.length, added };
  } catch (error) {
    console.error('Error uploading prosklisi files:', error);
    return { success: false, error: error.message };
  }
});

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

        // Συγχρονισμός με prosklisi_data.json (τροφοδοτεί την ενότητα «Ομαδοποιημένα Αρχεία»)
        const prosklisiDataPath = path.join(prosklisiDir, 'prosklisi_data.json');
        if (fs.existsSync(prosklisiDataPath)) {
          try {
            const existingData = JSON.parse(fs.readFileSync(prosklisiDataPath, 'utf8'));
            safeWriteJSON(prosklisiDataPath, {
              ...existingData,
              prosklisiFiles: data.prosklisiFiles,
              fileGroups: data.fileGroups,
              prosklisiFolders: data.prosklisiFolders,
            });
          } catch (_e) { /* ignore */ }
        }
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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
    if (writesBlockedByMandatoryUpdate()) {
      return { success: false, error: MANDATORY_UPDATE_WRITE_ERROR, mandatoryUpdate: true };
    }
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
    let projectTitle = null;
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
                projectTitle = data.projectTitle;
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

    const normalizeEgkrisiText = (text) => {
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
        const normalizedSubprojectTitle = normalizeEgkrisiText(subproject.title);
        const normalizedSearchTitle = normalizeEgkrisiText(subprojectTitle);
        
        if (normalizedSubprojectTitle === normalizedSearchTitle || 
            normalizedSubprojectTitle.includes(normalizedSearchTitle.substring(0, 20)) ||
            normalizedSearchTitle.includes(normalizedSubprojectTitle.substring(0, 20))) {
          console.log('✅ Found egkrisi keys:', { projectKey, subprojectKey });
          return { projectKey, subprojectKey };
        }
      }
    }

    // Fallback: τροποποίηση/έγκριση επιπέδου έργου χωρίς καταχώρηση υποέργου
    if (projectTitle) {
      const normalizedDashboardProjectTitle = normalizeEgkrisiText(projectTitle);
      for (const [projectKey, project] of Object.entries(projects)) {
        const normalizedEgkrisiProjectTitle = normalizeEgkrisiText(project.title);
        const hasModifications = Array.isArray(project.modifications) && project.modifications.length > 0;
        const titleMatches =
          normalizedEgkrisiProjectTitle === normalizedDashboardProjectTitle ||
          normalizedEgkrisiProjectTitle.includes(normalizedDashboardProjectTitle.substring(0, 20)) ||
          normalizedDashboardProjectTitle.includes(normalizedEgkrisiProjectTitle.substring(0, 20));

        if (titleMatches && hasModifications) {
          console.log('✅ Found egkrisi project-level keys:', { projectKey });
          return { projectKey, subprojectKey: null, projectLevelOnly: true };
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
    const subprojects = [];
    if (!dataDir || !fs.existsSync(dataDir)) {
      return { success: true, data: subprojects };
    }
    for (const projectDir of fs.readdirSync(dataDir)) {
      if (DATA_DIR_SKIP_ROOT_DIRS.has(projectDir)) continue;
      const projectPath = path.join(dataDir, projectDir);
      if (!fs.statSync(projectPath).isDirectory()) continue;
      for (const subprojectDir of fs.readdirSync(projectPath)) {
        const subprojectPath = path.join(projectPath, subprojectDir);
        if (!fs.statSync(subprojectPath).isDirectory()) continue;
        const jsonPath = path.join(subprojectPath, 'data.json');
        if (!fs.existsSync(jsonPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (data.subprojectId && data.subprojectTitle && data.projectTitle) {
            subprojects.push({
              subprojectId: data.subprojectId,
              subprojectTitle: data.subprojectTitle,
              projectTitle: data.projectTitle,
              projectId: data.projectId,
            });
          }
        } catch (error) {
          console.error('Error reading subproject data:', error);
        }
      }
    }
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

    data.notes = data.notes.map(n => ({
      visibility: 'private',
      visibleToRoles: [],
      visibleToUsers: [],
      createdBy: '',
      ...n
    }));
    
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
    
    // Merge reminderSent from disk (the scheduler may have updated it)
    const existingNotesMap = {};
    for (const n of (existingData.notes || [])) {
      if (n.id) existingNotesMap[n.id] = n;
    }
    const mergedNotes = notesData.notes.map(n => {
      const disk = existingNotesMap[n.id];
      if (disk && disk.reminderSent && !n.reminderSent) {
        if (n.reminderDate === disk.reminderDate && n.reminderTime === disk.reminderTime) {
          return { ...n, reminderSent: true };
        }
      }
      return n;
    });

    const dataToSave = {
      notes: mergedNotes,
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

ipcMain.handle('get-users-list', async () => {
  try {
    const users = loadUsers();
    const safeList = users.map(u => ({
      username: u.username,
      fullName: u.fullName || u.username,
      role: u.role,
      active: u.active !== false
    })).filter(u => u.active);
    return { success: true, data: safeList };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get linked entities map from notes
ipcMain.handle('get-notes-linked-entities', async () => {
  try {
    let notesData = { notes: [] };
    if (fs.existsSync(notesDataPath)) {
      try {
        notesData = JSON.parse(fs.readFileSync(notesDataPath, 'utf8'));
      } catch (e) { /* ignore */ }
    }
    const entityMap = {};
    for (const note of (notesData.notes || [])) {
      if (!note.linkedEntities || !Array.isArray(note.linkedEntities)) continue;
      for (const link of note.linkedEntities) {
        if (!link.id) continue;
        if (!entityMap[link.id]) entityMap[link.id] = [];
        entityMap[link.id].push({ noteId: note.id, noteTitle: note.title || 'Χωρίς τίτλο' });
      }
    }
    return { success: true, data: entityMap };
  } catch (error) {
    console.error('Error getting notes linked entities:', error);
    return { success: false, error: error.message };
  }
});

// Get all entity names for note linking picker
ipcMain.handle('get-all-entity-names', async () => {
  try {
    const entities = [];
    const skipRoot = DATA_DIR_SKIP_ROOT_DIRS;
    const seenProjects = new Set();

    if (fs.existsSync(dataDir)) {
      const dirs = fs.readdirSync(dataDir);
      for (const dir of dirs) {
        if (skipRoot.has(dir)) continue;
        const dirPath = path.join(dataDir, dir);
        try {
          if (!fs.statSync(dirPath).isDirectory()) continue;
          const subDirs = fs.readdirSync(dirPath);
          for (const sub of subDirs) {
            const dataPath = path.join(dirPath, sub, 'data.json');
            if (!fs.existsSync(dataPath)) continue;
            try {
              const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
              if (data.projectTitle && data.projectId && !seenProjects.has(data.projectId)) {
                seenProjects.add(data.projectId);
                entities.push({ type: 'project', id: data.projectId, title: data.projectTitle });
              }
              if (data.subprojectTitle && data.subprojectId) {
                entities.push({ type: 'subproject', id: data.subprojectId, title: data.subprojectTitle, parentTitle: data.projectTitle });
              }
              if (data.egkriseisDialthesisPistosis && Array.isArray(data.egkriseisDialthesisPistosis)) {
                for (const eg of data.egkriseisDialthesisPistosis) {
                  if (eg.id) {
                    const dateStr = eg.date ? new Date(eg.date).toLocaleDateString('el-GR') : '';
                    const egTitle = `${data.subprojectTitle || ''} ${dateStr} ${eg.fileName || ''}`.trim() || eg.id;
                    entities.push({ type: 'egkrisi', id: eg.id, title: egTitle, parentTitle: data.projectTitle });
                  }
                }
              }
            } catch (e) { /* skip */ }
          }
        } catch (e) { /* skip */ }
      }
    }

    // Entaxeis
    const entaxeisDir = path.join(dataDir, 'entaxeis');
    if (fs.existsSync(entaxeisDir)) {
      const entaxiDirs = fs.readdirSync(entaxeisDir).filter(d => { try { return fs.statSync(path.join(entaxeisDir, d)).isDirectory(); } catch (e) { return false; } });
      for (const dir of entaxiDirs) {
        const dataPath = path.join(entaxeisDir, dir, 'data.json');
        if (!fs.existsSync(dataPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
          entities.push({ type: 'entaxi', id: data.entaxiId || dir, title: data.subject || data.projectTitle || dir });
        } catch (e) { /* skip */ }
      }
    }

    // Proskliseis
    const proskliseisDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ');
    if (fs.existsSync(proskliseisDir)) {
      const prosklisiDirs = fs.readdirSync(proskliseisDir).filter(d => { try { return fs.statSync(path.join(proskliseisDir, d)).isDirectory(); } catch (e) { return false; } });
      for (const dir of prosklisiDirs) {
        const dataPath = path.join(proskliseisDir, dir, 'data.json');
        if (!fs.existsSync(dataPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
          entities.push({ type: 'prosklisi', id: data.prosklisiId || dir, title: data.title || dir });
        } catch (e) { /* skip */ }
      }
    }

    // Standalone egkriseis from EgkriseisManager
    const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
    if (fs.existsSync(egkriseisDataPath)) {
      try {
        const egData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
        const seenEgkrisiIds = new Set(entities.filter(e => e.type === 'egkrisi').map(e => e.id));
        if (egData.projects) {
          for (const [projKey, projVal] of Object.entries(egData.projects)) {
            const projName = projVal.title || projVal.name || projKey;
            if (projVal.subprojects) {
              for (const [subKey, subVal] of Object.entries(projVal.subprojects)) {
                const subName = subVal.title || subVal.name || subKey.replace(/_/g, ' ');
                const egId = `egkrisi_${projKey}_${subKey}`;
                if (!seenEgkrisiIds.has(egId)) {
                  entities.push({ type: 'egkrisi', id: egId, title: subName, parentTitle: projName });
                }
              }
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    // Meletai (Μητρώο Μελετών)
    const meletaiDir = path.join(dataDir, 'ΜΕΛΕΤΕΣ');
    if (fs.existsSync(meletaiDir)) {
      const meletaiDirs = fs.readdirSync(meletaiDir).filter(d => {
        try { return fs.statSync(path.join(meletaiDir, d)).isDirectory(); } catch (e) { return false; }
      });
      for (const dir of meletaiDirs) {
        const dataPath = path.join(meletaiDir, dir, 'data.json');
        if (!fs.existsSync(dataPath)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
          if (data.id) {
            const title = `${data.studyNumber || ''} — ${data.title || dir}`.trim();
            entities.push({
              type: 'meleti',
              id: data.id,
              title,
              parentTitle: data.linkedSubprojectTitle || data.linkedProjectTitle || '',
            });
          }
        } catch (e) { /* skip */ }
      }
    }

    return { success: true, data: entities };
  } catch (error) {
    console.error('Error getting entity names:', error);
    return { success: false, error: error.message };
  }
});

// Upload files to a note
ipcMain.handle('upload-note-files', async (_event, { noteId }) => {
  try {
    if (!noteId) return { success: false, error: 'Απαιτείται noteId' };

    const result = await dialog.showOpenDialog({
      title: 'Επιλογή Αρχείων Σημείωσης',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Όλα τα Αρχεία', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const noteFilesDir = path.join(notesDir, 'ΑΡΧΕΙΑ', noteId);
    if (!fs.existsSync(noteFilesDir)) {
      fs.mkdirSync(noteFilesDir, { recursive: true });
    }

    const savedFiles = [];
    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      let destName = fileName;
      let counter = 1;
      while (fs.existsSync(path.join(noteFilesDir, destName))) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        destName = `${base} (${counter})${ext}`;
        counter++;
      }
      fs.copyFileSync(filePath, path.join(noteFilesDir, destName));
      savedFiles.push(destName);
    }

    return { success: true, files: savedFiles };
  } catch (error) {
    logger.error('upload-note-files failed', error);
    return { success: false, error: error.message };
  }
});

// Get files for a note
ipcMain.handle('get-note-files', async (_event, { noteId }) => {
  try {
    if (!noteId) return { success: true, files: [] };
    const noteFilesDir = path.join(notesDir, 'ΑΡΧΕΙΑ', noteId);
    if (!fs.existsSync(noteFilesDir)) return { success: true, files: [] };

    const files = fs.readdirSync(noteFilesDir)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const stat = fs.statSync(path.join(noteFilesDir, f));
        return { name: f, size: stat.size };
      });
    return { success: true, files };
  } catch (error) {
    logger.error('get-note-files failed', error);
    return { success: true, files: [] };
  }
});

// Open a note file
ipcMain.handle('open-note-file', async (_event, { noteId, fileName }) => {
  try {
    if (!noteId || !fileName) return { success: false, error: 'Απαιτείται noteId και fileName' };
    const filePath = path.join(notesDir, 'ΑΡΧΕΙΑ', noteId, fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(notesDir))) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }

    await shell.openPath(resolved);
    return { success: true };
  } catch (error) {
    logger.error('open-note-file failed', error);
    return { success: false, error: error.message };
  }
});

// Delete a note file
ipcMain.handle('delete-note-file', async (_event, { noteId, fileName }) => {
  try {
    if (!noteId || !fileName) return { success: false, error: 'Απαιτείται noteId και fileName' };
    const filePath = path.join(notesDir, 'ΑΡΧΕΙΑ', noteId, fileName);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(notesDir))) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    logger.error('delete-note-file failed', error);
    return { success: false, error: error.message };
  }
});

// Delete all files for a note (cleanup on note delete)
ipcMain.handle('delete-note-files-dir', async (_event, { noteId }) => {
  try {
    if (!noteId) return { success: true };
    const noteFilesDir = path.join(notesDir, 'ΑΡΧΕΙΑ', noteId);
    if (fs.existsSync(noteFilesDir)) {
      fs.rmSync(noteFilesDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (error) {
    logger.error('delete-note-files-dir failed', error);
    return { success: true };
  }
});

// Check if user has email + get superadmin name
ipcMain.handle('check-user-email', async (_event, { username }) => {
  try {
    const users = loadUsers();
    const user = users.find(u => u.username?.toLowerCase() === (username || '').toLowerCase());
    const hasEmail = !!(user?.email && user.email.includes('@'));
    const superAdmin = users.find(u => u.role === 'SUPERADMIN');
    return {
      hasEmail,
      userEmail: hasEmail ? user.email : null,
      superAdminFullName: superAdmin?.fullName || null
    };
  } catch (error) {
    return { hasEmail: false, superAdminFullName: null };
  }
});

// ── Note reminder config ──
function loadNoteReminderConfig() {
  try {
    const p = path.join(dataDir, 'config', 'note_reminder_config.json');
    if (!fs.existsSync(p)) return { enabled: true };
    return { enabled: true, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch { return { enabled: true }; }
}

function saveNoteReminderConfig(config) {
  const dir = path.join(dataDir, 'config');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(path.join(dir, 'note_reminder_config.json'), config);
}

ipcMain.handle('get-note-reminder-config', async (_event, { actingUsername } = {}) => {
  if (!isSuperAdminOrAdminUser(actingUsername || loggedInUsername)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα' };
  }
  return { success: true, config: loadNoteReminderConfig() };
});

ipcMain.handle('save-note-reminder-config', async (_event, { actingUsername, config } = {}) => {
  if (!isSuperAdminOrAdminUser(actingUsername || loggedInUsername)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα' };
  }
  try {
    saveNoteReminderConfig({ enabled: config?.enabled !== false });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Note reminder scheduler ──
let noteReminderInterval = null;

function startNoteReminderChecker() {
  if (noteReminderInterval) return;
  noteReminderInterval = setInterval(async () => {
    try {
      if (!notesDataPath || !fs.existsSync(notesDataPath)) return;
      const noteReminderCfg = loadNoteReminderConfig();
      if (noteReminderCfg.enabled === false) return;
      const data = JSON.parse(fs.readFileSync(notesDataPath, 'utf8'));
      if (!data?.notes || !Array.isArray(data.notes)) return;

      const now = new Date();
      let changed = false;
      const emailConfig = loadEmailConfig(dataDir);
      if (!isConfigured(emailConfig)) return;

      const users = loadUsers();

      for (const note of data.notes) {
        if (!note.reminderDate || note.reminderSent) continue;
        const reminderDt = new Date(note.reminderDate + 'T' + (note.reminderTime || '09:00'));
        if (isNaN(reminderDt.getTime()) || reminderDt > now) continue;

        const creator = note.createdBy
          ? users.find(u => u.username?.toLowerCase() === note.createdBy.toLowerCase())
          : null;
        if (!creator?.email || !creator.email.includes('@')) {
          note.reminderSent = true;
          changed = true;
          continue;
        }

        try {
          const nodemailer = require('nodemailer');
          const user = String(emailConfig.gmail.user || '').trim().toLowerCase();
          const pass = String(emailConfig.gmail.appPassword || '').replace(/\s+/g, '').trim();
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
          });

          const noteTitle = note.title || 'Χωρίς τίτλο';
          const noteContent = (note.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
          const appName = getAppDisplayName(emailConfig);
          const logoAttachment = buildLogoAttachment();
          const logoRow = logoAttachment
            ? `<div style="margin-bottom:12px"><img src="cid:ergohub-logo@ergohub" alt="${String(appName || 'ergoHub').replace(/</g, '&lt;')}" style="display:block;max-height:40px;max-width:160px;border:0;" /></div>`
            : '';
          const html = `
<div style="font-family:Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
  ${logoRow}
  <div style="background:linear-gradient(135deg,#4338ca,#6366f1);padding:16px 20px;border-radius:10px;margin-bottom:16px">
    <h2 style="color:#fff;margin:0;font-size:1.1rem">🔔 Υπενθύμιση Σημείωσης</h2>
  </div>
  <h3 style="color:#1e293b;margin:0 0 8px">${noteTitle.replace(/</g, '&lt;')}</h3>
  <div style="color:#475569;font-size:0.92rem;line-height:1.6;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px">${noteContent || '<em>Κενό περιεχόμενο</em>'}</div>
  <div style="color:#94a3b8;font-size:0.8rem">${String(appName || 'ergoHub').replace(/</g, '&lt;')} · Γρήγορες Σημειώσεις</div>
  ${buildAppOpenPromptHtml(appName)}
</div>`;

          await transporter.sendMail({
            from: `${appName} <${user}>`,
            to: creator.email,
            subject: `🔔 Υπενθύμιση: ${noteTitle}`,
            html,
            attachments: logoAttachment ? [logoAttachment] : [],
          });

          logger.info(`Note reminder email sent to ${creator.email} for note "${noteTitle}"`);
        } catch (emailErr) {
          logger.error('Failed to send note reminder email', emailErr);
        }

        note.reminderSent = true;
        changed = true;
      }

      if (changed) {
        safeWriteJSON(notesDataPath, data);
      }
    } catch (error) {
      logger.error('Note reminder check failed', error);
    }
  }, 5 * 60 * 1000);
}

startNoteReminderChecker();

function startOrimanthiAepoReminderChecker() {
  const run = () => {
    try {
      orimanthiAepoReminderService.checkAndSendAepoReminders({
        dataDir,
        loadUsers,
        loadAllProposals: loadAllProposalsList,
      }).catch((e) => logger.error('Orimanthi AEPO reminder check failed', e));
    } catch (e) {
      logger.error('Orimanthi AEPO reminder init failed', e);
    }
  };
  setTimeout(run, 45 * 1000);
  setInterval(run, 6 * 60 * 60 * 1000);
}

function startProcurementCalendarReminderChecker() {
  const run = () => {
    try {
      procurementCalendarReminderService.checkAndSendProcurementCalendarReminders({
        dataDir,
        loadUsers,
        loadAllProjects,
        loadAllProskliseis,
      }).catch((e) => logger.error('Procurement calendar reminder check failed', e));
    } catch (e) {
      logger.error('Procurement calendar reminder init failed', e);
    }
  };
  setTimeout(run, 15 * 60 * 1000);
  setInterval(run, 2 * 60 * 60 * 1000);
  try {
    schedule.scheduleJob('0 8 * * *', run);
  } catch (e) {
    logger.error('Procurement calendar daily scheduler error', e);
  }
}

// Defer until dataDir is ready — registered after Orimanthi section defines loadAllProposalsList
let orimanthiAepoCheckerStarted = false;
function ensureOrimanthiAepoCheckerStarted() {
  if (orimanthiAepoCheckerStarted || !dataDir) return;
  orimanthiAepoCheckerStarted = true;
  startOrimanthiAepoReminderChecker();
}

let procurementCalendarCheckerStarted = false;
function ensureProcurementCalendarCheckerStarted() {
  if (procurementCalendarCheckerStarted || !dataDir) return;
  procurementCalendarCheckerStarted = true;
  startProcurementCalendarReminderChecker();
}

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
// Η θέση αποθήκευσης των αντιγράφων ασφαλείας μπορεί να οριστεί εκτός του φακέλου
// δεδομένων και είναι ορατή ΜΟΝΟ στον SUPERADMIN. Αποθηκεύεται τοπικά σε
// backup_location.json (δεν εξάγεται ποτέ σε αντίγραφο ασφαλείας).
function getBackupLocationConfigPath() {
  return dataDir ? path.join(dataDir, 'backup_location.json') : null;
}
function getDefaultBackupDir() {
  return dataDir ? path.join(dataDir, 'backups') : null;
}
let backupSettingsPath = dataDir ? path.join(dataDir, 'backup_settings.json') : null;
let auditLogPath = dataDir ? path.join(dataDir, 'audit_log.json') : null;

// Ονόματα πρώτου επιπέδου που ΔΕΝ μπαίνουν ποτέ σε αντίγραφο ασφαλείας
const BACKUP_EXCLUDE_ENTRIES = new Set([
  'backups',
  'locks',
  'app-config.json',
  'data-dir.json',
  'backup_settings.json',
  'backup_location.json',
]);

function readBackupLocationSetting() {
  try {
    const cfgPath = getBackupLocationConfigPath();
    if (cfgPath && fs.existsSync(cfgPath)) {
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (raw && typeof raw.location === 'string' && raw.location.trim()) {
        return raw.location.trim();
      }
    }
  } catch (e) {
    console.warn('Could not read backup_location.json:', e.message);
  }
  return null;
}

function resolveBackupDir() {
  if (!dataDir) return null;
  const custom = readBackupLocationSetting();
  if (custom) {
    try {
      const target = path.join(custom, 'ERGOHUB_BACKUPS');
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      return target;
    } catch (e) {
      console.error('Custom backup location not usable, falling back to default:', e.message);
    }
  }
  return getDefaultBackupDir();
}

let backupDir = resolveBackupDir();

function getBackupMetadataPath() {
  return backupDir ? path.join(backupDir, 'metadata.json') : null;
}

if (backupDir && !fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Initialize audit log if it doesn't exist (μόνο όταν υπάρχει ήδη φάκελος δεδομένων)
if (auditLogPath && !fs.existsSync(auditLogPath)) {
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
    if (backupSettingsPath && fs.existsSync(backupSettingsPath)) {
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
    
    if (!backupSettingsPath) return false;
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
    const mp = getBackupMetadataPath();
    if (mp && fs.existsSync(mp)) {
      return JSON.parse(fs.readFileSync(mp, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading backup metadata:', error);
  }
  return { backups: [] };
}

// Save backup metadata
function saveBackupMetadata(metadata) {
  try {
    const mp = getBackupMetadataPath();
    if (!mp) return false;
    safeWriteJSON(mp, metadata);
    return true;
  } catch (error) {
    console.error('Error saving backup metadata:', error);
    return false;
  }
}

// ── Mutex / lock ώστε να τρέχει ΜΟΝΟ ΕΝΑ backup ή restore κάθε φορά ──
let backupOperationInProgress = false;
let backupAbortRequested = false;
const BACKUP_LOCK_STALE_MS = 30 * 60 * 1000; // 30 λεπτά

function getBackupLockPath() {
  return backupDir ? path.join(backupDir, '.backup.lock') : null;
}

function acquireBackupLock(info = {}) {
  if (backupOperationInProgress) {
    return { ok: false, error: 'Βρίσκεται ήδη σε εξέλιξη μια εργασία αντιγράφου ασφαλείας.' };
  }
  const lockPath = getBackupLockPath();
  try {
    if (lockPath && fs.existsSync(lockPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const age = Date.now() - new Date(raw.timestamp || 0).getTime();
        if (age < BACKUP_LOCK_STALE_MS) {
          return {
            ok: false,
            error: 'Βρίσκεται ήδη σε εξέλιξη μια εργασία αντιγράφου ασφαλείας από άλλον χρήστη.',
          };
        }
      } catch (_e) { /* stale/corrupt lock — θα αντικατασταθεί */ }
    }
    backupOperationInProgress = true;
    backupAbortRequested = false;
    if (lockPath) {
      try {
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(lockPath, JSON.stringify({ timestamp: new Date().toISOString(), ...info }), 'utf8');
      } catch (_e) { /* το in-process flag αρκεί */ }
    }
    return { ok: true };
  } catch (e) {
    backupOperationInProgress = true;
    backupAbortRequested = false;
    return { ok: true };
  }
}

function releaseBackupLock() {
  backupOperationInProgress = false;
  backupAbortRequested = false;
  const lockPath = getBackupLockPath();
  try {
    if (lockPath && fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch (_e) { /* ignore */ }
}

function requestBackupAbort() {
  backupAbortRequested = true;
}

function throwIfBackupAborted() {
  if (backupAbortRequested) {
    const err = new Error('Η δημιουργία αντιγράφου ακυρώθηκε από τον χρήστη.');
    err.code = 'BACKUP_ABORTED';
    throw err;
  }
}

// SHA-256 με stream (όχι φόρτωση ολόκληρου του zip στη μνήμη)
function sha256FileStreaming(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => {
      if (backupAbortRequested) {
        stream.destroy();
        const err = new Error('Η δημιουργία αντιγράφου ακυρώθηκε από τον χρήστη.');
        err.code = 'BACKUP_ABORTED';
        reject(err);
        return;
      }
      hash.update(chunk);
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Επιστρέφει το πιο πρόσφατο επιτυχημένο πραγματικό αντίγραφο (όχι safety)
function getLastRealBackup(metadata) {
  const list = (metadata && metadata.backups) || [];
  const real = list.filter(b => b && b.status === 'success' && b.type !== 'safety');
  if (real.length === 0) return null;
  return real.reduce((newest, b) =>
    (new Date(b.timestamp) > new Date(newest.timestamp) ? b : newest)
  );
}

const PROJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Πλήρες αντίγραφο: περιλαμβάνει ΟΛΟΚΛΗΡΟ τον φάκελο δεδομένων (χρήστες, έργα,
// εντάξεις, προσκλήσεις, εγκρίσεις, μελέτες, αναθέσεις εργασιών, σημειώσεις,
// ρυθμίσεις, καταγραφές κ.λπ.) εκτός από προσωρινά/συστημικά αρχεία.
async function getFilesToBackup() {
  const files = [];
  try {
    const entries = fs.readdirSync(dataDir);
    for (const entry of entries) {
      if (BACKUP_EXCLUDE_ENTRIES.has(entry)) continue;
      if (entry.startsWith('.')) continue;
      if (entry.startsWith('temp_')) continue;
      if (entry.endsWith('.lock') || entry.endsWith('.tmp')) continue;
      if (/\.tmp-\d+$/.test(entry)) continue;
      if (/\.bak\d*$/.test(entry)) continue;

      const full = path.join(dataDir, entry);
      // Παράλειψη της ενεργής θέσης αντιγράφων αν βρίσκεται εντός του φακέλου δεδομένων
      if (backupDir && path.resolve(full) === path.resolve(backupDir)) continue;

      let stat;
      try { stat = fs.statSync(full); } catch (_e) { continue; }

      files.push({
        type: stat.isDirectory() ? 'dir' : 'file',
        path: full,
        relativePath: entry,
      });
    }
  } catch (error) {
    console.error('Error getting files to backup:', error);
  }

  return files;
}

// Υπολογίζει το συνολικό πλήθος αρχείων και bytes ώστε να δείχνουμε πραγματική πρόοδο
// (με yield ώστε να μην «παγώνει» η εφαρμογή σε μεγάλα δέντρα αρχείων)
async function computeBackupTotals(filesToBackup, onProgress = null) {
  let files = 0;
  let bytes = 0;
  let walked = 0;
  const walk = async (p) => {
    throwIfBackupAborted();
    let st;
    try { st = fs.statSync(p); } catch (_e) { return; }
    if (st.isDirectory()) {
      let entries = [];
      try { entries = fs.readdirSync(p); } catch (_e) { return; }
      for (const e of entries) await walk(path.join(p, e));
    } else {
      files++;
      bytes += st.size;
      walked++;
      if (walked % 40 === 0) {
        if (onProgress) {
          onProgress({
            phase: 'scanning',
            entries: files,
            total: files,
            bytes,
            totalBytes: bytes
          });
        }
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  };
  try {
    for (const f of filesToBackup) {
      throwIfBackupAborted();
      await walk(f.path);
    }
  } catch (e) {
    if (e && e.code === 'BACKUP_ABORTED') throw e;
  }
  return { files, bytes };
}

// Μετρά τα περιεχόμενα του αντιγράφου για εμφάνιση στο ιστορικό
function countBackupContents(filesToBackup) {
  const contents = { projects: 0, proskliseis: 0, entaxeis: 0, egkriseis: 0, meletai: 0, tasks: 0, users: 0 };
  try {
    for (const f of filesToBackup) {
      const name = f.relativePath;
      if (f.type === 'dir' && PROJECT_UUID_RE.test(name)) contents.projects++;
      else if (name === 'ΠΡΟΣΚΛΗΣΕΙΣ') contents.proskliseis = 1;
      else if (name === 'entaxeis') contents.entaxeis = 1;
      else if (name === 'EGKRISEIS_DIATHESIS_PISTOSIS') contents.egkriseis = 1;
      else if (name === 'ΜΕΛΕΤΕΣ') contents.meletai = 1;
      else if (name === 'ANATHESEIS_ERGASION') contents.tasks = 1;
      else if (name === 'users.json') contents.users = 1;
    }
  } catch (_e) { /* ignore */ }
  return contents;
}

// Ελληνικές ετικέτες τύπου αντιγράφου
const BACKUP_TYPE_LABELS_EL = {
  full: 'Πλήρες',
  manual: 'Χειροκίνητο',
  safety: 'Ασφαλείας',
};

// Καθαρίζει ένα όνομα ώστε να είναι έγκυρο για όνομα αρχείου (Windows)
function sanitizeForFileName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')   // μη επιτρεπτοί χαρακτήρες
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, '_')            // κενά → underscore
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

// Χτίζει ελληνικό, περιγραφικό όνομα αρχείου με ημερομηνία/ώρα και δημιουργό
function buildBackupFileName(type, createdBy, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const typeLabel = BACKUP_TYPE_LABELS_EL[type] || 'Αντίγραφο';
  const author = sanitizeForFileName((createdBy && createdBy.fullName) || (createdBy && createdBy.username) || 'Άγνωστος');
  return `Αντίγραφο_${dd}-${mm}-${yyyy}_${hh}-${mi}-${ss}_${typeLabel}_${author}.zip`;
}

// Create backup (non-blocking, background execution)
// Το αντίγραφο είναι ΠΑΝΤΑ πλήρες — περιλαμβάνει ολόκληρο τον φάκελο δεδομένων.
async function createBackup(options = {}) {
  const {
    type = 'full', // full | manual | safety
    notifyUser = false,
    onProgress = null,
    actingUser = null, // { username, fullName, role }
    manageLock = false, // αν true, αποκτά/απελευθερώνει το backup lock εδώ
  } = options;

  let lockAcquiredHere = false;
  if (manageLock) {
    const lock = acquireBackupLock({ operation: 'backup', by: actingUser?.fullName || '' });
    if (!lock.ok) {
      return { success: false, error: lock.error };
    }
    lockAcquiredHere = true;
  }

  const backupId = uuidv4();

  const createdBy = actingUser
    ? { username: actingUser.username || '', fullName: actingUser.fullName || '', role: actingUser.role || '' }
    : (() => { const u = getCurrentAuditUser(); return { username: u.username, fullName: u.fullName, role: u.role }; })();

  const backupFileName = buildBackupFileName(type, createdBy, new Date());
  const backupPath = path.join(backupDir, backupFileName);

  const backupInfo = {
    backupId,
    timestamp: new Date().toISOString(),
    type,
    fileName: backupFileName,
    path: backupPath,
    status: 'in_progress',
    size: 0,
    createdBy,
    contents: {
      projects: 0,
      proskliseis: 0,
      entaxeis: 0,
      egkriseis: 0,
      meletai: 0,
    },
    error: null
  };
  
  try {
    console.log(`🔄 Starting backup: ${backupFileName}`);
    if (backupDir && !fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    throwIfBackupAborted();

    // Πλήρες αντίγραφο ολόκληρου του φακέλου δεδομένων
    if (onProgress) {
      onProgress({ phase: 'scanning', entries: 0, total: 0, bytes: 0, totalBytes: 0 });
    }
    const filesToBackup = await getFilesToBackup();
    throwIfBackupAborted();
    backupInfo.contents = countBackupContents(filesToBackup);

    // Υπολογισμός συνόλων ώστε ο χρήστης να βλέπει πραγματική πρόοδο (ποσοστό/MB)
    const totals = await computeBackupTotals(filesToBackup, onProgress);
    throwIfBackupAborted();
    if (onProgress) {
      onProgress({
        phase: 'archiving',
        entries: 0,
        total: totals.files,
        bytes: 0,
        totalBytes: totals.bytes
      });
    }

    // Create ZIP archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 6 } // Medium compression (balanced)
    });
    
    // Handle archive events
    archive.on('error', (err) => {
      // Το abort() του archiver εκπέμπει error — το αγνοούμε αν ακυρώσαμε
      if (backupAbortRequested || (err && err.code === 'ABORTED')) return;
      throw err;
    });
    
    let lastProgressAt = 0;
    archive.on('progress', (progress) => {
      if (!onProgress || backupAbortRequested) return;
      // Throttle σε ~150ms για να μη πλημμυρίζει το IPC, αλλά να δείχνει ζωντανή κίνηση
      const now = Date.now();
      const done = progress.entries.processed >= progress.entries.total && progress.entries.total > 0;
      if (now - lastProgressAt < 150 && !done) return;
      lastProgressAt = now;
      onProgress({
        phase: 'archiving',
        entries: progress.entries.processed,
        total: totals.files || progress.entries.total,
        bytes: progress.fs.processedBytes,
        totalBytes: totals.bytes
      });
    });
    
    archive.pipe(output);

    const abortArchiveStreams = () => {
      try { archive.abort(); } catch (_e) { /* ignore */ }
      try { output.destroy(); } catch (_e) { /* ignore */ }
    };
    
    // Add files to archive
    try {
      for (let i = 0; i < filesToBackup.length; i++) {
        throwIfBackupAborted();
        const file = filesToBackup[i];
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
        if (i % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      throwIfBackupAborted();
      
      // Finalize archive
      await archive.finalize();
      throwIfBackupAborted();
    } catch (loopErr) {
      if (loopErr && (loopErr.code === 'BACKUP_ABORTED' || backupAbortRequested)) {
        abortArchiveStreams();
      }
      throw loopErr;
    }
    
    // Wait for file to be written
    await new Promise((resolve, reject) => {
      const onClose = () => {
        try {
          throwIfBackupAborted();
          const stats = fs.statSync(backupPath);
          backupInfo.size = stats.size;
          backupInfo.status = 'success';
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      output.on('close', onClose);
      output.on('error', reject);
      // Αν ζητήθηκε ακύρωση ενώ γράφει το αρχείο
      const abortPoll = setInterval(() => {
        if (backupAbortRequested) {
          clearInterval(abortPoll);
          try { archive.abort(); } catch (_e) { /* ignore */ }
          try { output.destroy(); } catch (_e) { /* ignore */ }
          reject(Object.assign(new Error('Η δημιουργία αντιγράφου ακυρώθηκε από τον χρήστη.'), { code: 'BACKUP_ABORTED' }));
        }
      }, 400);
      output.once('close', () => clearInterval(abortPoll));
      output.once('error', () => clearInterval(abortPoll));
    });
    
    // Calculate checksum (streaming — δεν φορτώνει όλο το zip στη μνήμη)
    if (onProgress) {
      onProgress({
        phase: 'finalizing',
        bytes: backupInfo.size,
        totalBytes: backupInfo.size
      });
    }
    throwIfBackupAborted();
    backupInfo.checksum = await sha256FileStreaming(backupPath);
    
    // Update metadata — αφαίρεσε τυχόν προηγούμενη εγγραφή με το ίδιο όνομα (άμυνα κατά διπλότυπων)
    const metadata = loadBackupMetadata();
    metadata.backups = (metadata.backups || []).filter(b => b && b.fileName !== backupFileName);
    metadata.backups.unshift(backupInfo);
    saveBackupMetadata(metadata);
    
    console.log(`✅ Backup completed: ${backupFileName} (${(backupInfo.size / 1024 / 1024).toFixed(2)} MB)`);

    // Καταγραφή στο μητρώο ενεργειών (ποιος το έκανε) — όχι για τα safety
    if (type !== 'safety') {
      try {
        logAuditAction({
          type: 'create',
          entityType: 'backup',
          entityId: backupId,
          entityTitle: 'Αντίγραφο ασφαλείας',
          details: `Δημιουργήθηκε πλήρες αντίγραφο ασφαλείας (${(backupInfo.size / 1024 / 1024).toFixed(1)} MB)`,
          userFullName: createdBy.fullName || undefined,
          userRole: createdBy.role || undefined,
        });
      } catch (_e) { /* non-critical */ }
    }

    // Ειδοποίηση στον χρήστη που το εκκίνησε
    if (notifyUser && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-completed', {
        success: true,
        backupId,
        backupInfo,
        message: 'Το αντίγραφο ασφαλείας ολοκληρώθηκε επιτυχώς'
      });
    }

    return { success: true, backupInfo };
    
  } catch (error) {
    const aborted = backupAbortRequested || (error && error.code === 'BACKUP_ABORTED');
    console.error(aborted ? '⏹ Backup aborted by user' : '❌ Backup failed:', error);
    backupInfo.status = aborted ? 'cancelled' : 'failed';
    backupInfo.error = aborted ? 'Ακυρώθηκε από τον χρήστη' : (error && error.message);

    // Καθαρισμός ημιτελούς αρχείου
    try {
      if (backupPath && fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch (_e) { /* ignore */ }

    // Μην κρατάμε ακυρωμένα στο ιστορικό ως κανονικά αντίγραφα
    if (!aborted) {
      const metadata = loadBackupMetadata();
      metadata.backups.unshift(backupInfo);
      saveBackupMetadata(metadata);
    }
    
    // Notify user if requested
    if (notifyUser && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-completed', {
        success: false,
        aborted: !!aborted,
        backupId,
        message: aborted
          ? 'Η δημιουργία αντιγράφου ακυρώθηκε.'
          : `Σφάλμα κατά το αντίγραφο ασφαλείας: ${error.message}`
      });
    }
    
    return {
      success: false,
      aborted: !!aborted,
      error: aborted ? 'Ακυρώθηκε από τον χρήστη' : (error && error.message),
      backupInfo
    };
  } finally {
    if (lockAcquiredHere) releaseBackupLock();
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
    if (backupSettingsPath && fs.existsSync(backupSettingsPath)) {
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

// Πολιτική διατήρησης βασισμένη σε πλήθος (προβλέψιμη):
//  - Κρατάμε τα πιο πρόσφατα KEEP_REAL πλήρη/χειροκίνητα αντίγραφα.
//  - Κρατάμε τα πιο πρόσφατα KEEP_SAFETY αντίγραφα ασφαλείας πριν από επαναφορά.
const BACKUP_KEEP_REAL = 15;
const BACKUP_KEEP_SAFETY = 3;

function cleanupOldBackups() {
  try {
    const metadata = loadBackupMetadata();
    let deletedCount = 0;

    const all = [...(metadata.backups || [])].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    let realCount = 0;
    let safetyCount = 0;
    const backupsToKeep = [];
    const backupsToDelete = [];

    for (const backup of all) {
      const isSafety = backup.type === 'safety';
      const limit = isSafety ? BACKUP_KEEP_SAFETY : BACKUP_KEEP_REAL;
      const current = isSafety ? ++safetyCount : ++realCount;

      // Αποτυχημένα αντίγραφα χωρίς αρχείο: αφαιρούνται από το μητρώο
      const fileMissing = !backup.path || !fs.existsSync(backup.path);
      if (backup.status !== 'success' && fileMissing) {
        continue; // ούτε κρατάμε ούτε προσπαθούμε διαγραφή αρχείου
      }

      if (current <= limit) {
        backupsToKeep.push(backup);
      } else {
        backupsToDelete.push(backup);
      }
    }

    for (const backup of backupsToDelete) {
      try {
        if (backup.path && fs.existsSync(backup.path)) {
          fs.unlinkSync(backup.path);
          deletedCount++;
          console.log(`🗑️ Deleted old backup: ${backup.fileName}`);
        }
      } catch (error) {
        console.error(`❌ Error deleting backup ${backup.fileName}:`, error);
      }
    }

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

/**
 * Αφαιρεί τα βαρέα ΚΗΜΔΗΣ fields από ένα project object πριν αποθηκευτεί στο audit log.
 * Τα snapshots, payments, apeEntries κτλ. είναι αυτόματα ανακτημένα — δεν χρειάζεται diff.
 */
const AUDIT_STRIP_TOP_FIELDS = new Set([
  'khmdhsContractSnapshot', 'khmdhsAwardSnapshot', 'khmdhsRequestSnapshot',
  'khmdhsNoticeSnapshot', 'khmdhsCommitmentSnapshots',
  'khmdhsPayments', 'khmdhsChainHistory', 'khmdhsAdamChain',
  'khmdhsAdamChainFetchedAt',
  'documentRegistry',
  'apeEntries',
  'fileGroups', 'subprojectFiles', 'files',
]);
const AUDIT_STRIP_CONTRACT_FIELDS = new Set([
  'khmdhsContractSnapshot', 'apeEntries', 'khmdhsAdamChain',
]);

function stripHeavyFieldsForAudit(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (AUDIT_STRIP_TOP_FIELDS.has(k)) continue;
    if (k === 'contracts' && Array.isArray(v)) {
      out[k] = v.map((c) => {
        const cc = { ...c };
        for (const sf of AUDIT_STRIP_CONTRACT_FIELDS) delete cc[sf];
        return cc;
      });
      continue;
    }
    if (k === 'supplementaryContracts' && Array.isArray(v)) {
      out[k] = v.map((c) => {
        const { snapshot: _s, ...rest } = c || {};
        return rest;
      });
      continue;
    }
    out[k] = v;
  }
  return out;
}

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

    const changes = (oldValue && newValue)
      ? collectAuditChanges(oldValue, newValue, { engineerCatalog: getRegisteredEngineersList() })
      : null;

    if (type === 'update' && changes && Object.keys(changes).length === 0) {
      return;
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
      changes: changes,
    };

    logger.debug(`Audit: ${userFullName} ${type} ${entityType} ${entityId}`);

    setImmediate(async () => {
      try {
        let logs = [];
        if (fs.existsSync(auditLogPath)) {
          try {
            const raw = await fs.promises.readFile(auditLogPath, 'utf8');
            logs = JSON.parse(raw)?.logs || [];
          } catch (_) {
            logs = [];
          }
        }
        logs.unshift(auditEntry);
        if (logs.length > 10000) logs = logs.slice(0, 10000);
        await safeWriteJSONAsync(auditLogPath, { logs });
      } catch (err) {
        console.error('Error writing audit log async:', err);
      }
    });

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

// Αφαιρεί διπλότυπες εγγραφές με το ίδιο όνομα αρχείου, κρατώντας την πληρέστερη
// (μεγαλύτερο μέγεθος / με checksum). Καθαρίζει «φαντάσματα» από ημιτελή αρχεία.
function dedupeBackupsByFileName(metadata) {
  if (!metadata || !Array.isArray(metadata.backups)) return metadata;
  const best = new Map();
  for (const b of metadata.backups) {
    if (!b || !b.fileName) continue;
    const prev = best.get(b.fileName);
    if (!prev) { best.set(b.fileName, b); continue; }
    const bScore = (b.size || 0) + (b.checksum ? 1 : 0);
    const pScore = (prev.size || 0) + (prev.checksum ? 1 : 0);
    if (bScore > pScore) best.set(b.fileName, b);
  }
  // Διατήρηση αρχικής σειράς (πιο πρόσφατα πρώτα)
  const seen = new Set();
  const deduped = [];
  for (const b of metadata.backups) {
    if (!b || !b.fileName) { deduped.push(b); continue; }
    if (seen.has(b.fileName)) continue;
    seen.add(b.fileName);
    deduped.push(best.get(b.fileName));
  }
  metadata.backups = deduped;
  return metadata;
}

// Scan backup directory for backup files and sync with metadata
function syncBackupMetadata() {
  try {
    const metadata = loadBackupMetadata();

    // Όσο τρέχει backup/restore, το αρχείο γράφεται ακόμη στον δίσκο.
    // ΜΗΝ το καταχωρείς — αλλιώς δημιουργούνται διπλές/φαντάσματα εγγραφές.
    if (backupOperationInProgress) {
      return dedupeBackupsByFileName(metadata);
    }

    const existingBackupIds = new Set((metadata.backups || []).map(b => b.backupId));
    const existingFileNames = new Set((metadata.backups || []).map(b => b.fileName));
    
    if (!fs.existsSync(backupDir)) {
      return dedupeBackupsByFileName(metadata);
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
      let discoveredAuthor = '';

      // Νέο ελληνικό format: Αντίγραφο_dd-mm-yyyy_HH-MI-SS_Τύπος_Δημιουργός.zip
      const greekMatch = file.match(/^Αντίγραφο_(\d{2})-(\d{2})-(\d{4})_(\d{2})-(\d{2})-(\d{2})_([^_]+)_(.+)\.zip$/);
      if (greekMatch) {
        const [, gdd, gmm, gyyyy, ghh, gmi, gss, gtype, gauthor] = greekMatch;
        timestamp = new Date(`${gyyyy}-${gmm}-${gdd}T${ghh}:${gmi}:${gss}`).toISOString();
        const labelToType = { 'Πλήρες': 'full', 'Χειροκίνητο': 'manual', 'Ασφαλείας': 'safety' };
        backupType = labelToType[gtype] || 'manual';
        discoveredAuthor = (gauthor || '').replace(/_/g, ' ').trim();
      } else if (match) {
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
      
      // Υπολογισμός checksum μόνο για αρχεία < ~1.9GB (όριο readFileSync).
      // Για μεγαλύτερα, ο έλεγχος γίνεται με streaming κατά το «Έλεγχος».
      let checksum = null;
      try {
        if (stats.size < 1.9 * 1024 * 1024 * 1024) {
          const fileBuffer = fs.readFileSync(filePath);
          checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        }
      } catch (e) {
        console.error('Error calculating checksum for', file, e.message);
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
        createdBy: { username: '', fullName: discoveredAuthor || '', role: '' },
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
    
    // Καθαρισμός τυχόν διπλότυπων (π.χ. από παλαιότερα ημιτελή αρχεία)
    const before = (metadata.backups || []).length;
    dedupeBackupsByFileName(metadata);
    const removed = before - (metadata.backups || []).length;

    if (foundNew || removed > 0) {
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
    // Αυτόματος καθαρισμός παλαιών — ΟΧΙ όσο τρέχει backup/restore
    if (!backupOperationInProgress) {
      cleanupOldBackups();
    }
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

// Επιστρέφει το αντικείμενο χρήστη (από δίσκο) για καταγραφή «ποιος το έκανε»
function resolveBackupActingUser(actingUsername) {
  const name = actingUsername || loggedInUsername;
  const u = findUserByUsername(name);
  if (!u) return null;
  return { username: u.username, fullName: u.fullName || u.username, role: u.role || 'USER' };
}

// Create manual backup — επιτρέπεται σε ADMIN και SUPERADMIN. Πάντα πλήρες.
ipcMain.handle('create-backup', async (event, options = {}) => {
  try {
    const actingUsername = options.actingUsername;
    if (!isSuperAdminOrAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα δημιουργίας αντιγράφου ασφαλείας.' };
    }
    const actingUser = resolveBackupActingUser(actingUsername);
    const result = await createBackup({
      type: 'manual',
      notifyUser: true,
      manageLock: true,
      actingUser,
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

// Ακύρωση αντιγράφου που τρέχει — ξεκλειδώνει και το UI ακόμη κι αν η διαδικασία καθυστερεί
ipcMain.handle('cancel-backup', async (event, opts = {}) => {
  try {
    const actingUsername = (opts && opts.actingUsername) || loggedInUsername;
    if (!isSuperAdminOrAdminUser(actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα ακύρωσης αντιγράφου ασφαλείας.' };
    }
    requestBackupAbort();
    // Αν η διαδικασία έχει «κολλήσει» (π.χ. αργή εγγραφή σε δικτυακό/OneDrive φάκελο),
    // απελευθερώνουμε το κλείδωμα μετά από λίγο ώστε να μην μείνει μόνιμα κλειδωμένο.
    setTimeout(() => {
      if (backupAbortRequested && backupOperationInProgress) {
        console.warn('⏹ Force-releasing backup lock after cancel timeout');
        releaseBackupLock();
      }
    }, 4000);
    return { success: true, wasInProgress: backupOperationInProgress };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete backup — μόνο SUPERADMIN (μη αναστρέψιμη ενέργεια)
ipcMain.handle('delete-backup', async (event, backupId, opts = {}) => {
  try {
    const actingUsername = (opts && opts.actingUsername) || null;
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Μόνο ο Υπερδιαχειριστής μπορεί να διαγράψει αντίγραφα ασφαλείας.' };
    }
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

    try {
      const actor = resolveBackupActingUser(actingUsername);
      logAuditAction({
        type: 'delete',
        entityType: 'backup',
        entityId: backupId,
        entityTitle: 'Αντίγραφο ασφαλείας',
        details: 'Διαγραφή αντιγράφου ασφαλείας',
        userFullName: actor?.fullName,
        userRole: actor?.role,
      });
    } catch (_e) { /* non-critical */ }

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
    
    // Calculate checksum (streaming — υποστηρίζει και αρχεία >2GB)
    const currentChecksum = await sha256FileStreaming(backup.path);
    
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

// Κατάσταση αντιγράφων ασφαλείας + λογική υπενθύμισης 10 ημερών (ADMIN + SUPERADMIN)
// ΔΕΝ εκθέτει ποτέ τη διαδρομή αποθήκευσης.
const BACKUP_REMINDER_DAYS = 10;
ipcMain.handle('get-backup-status', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const metadata = syncBackupMetadata();
    const last = getLastRealBackup(metadata);
    const lastAt = last ? last.timestamp : null;
    const daysSince = lastAt ? (Date.now() - new Date(lastAt).getTime()) / 86400000 : null;
    const reminderDue = daysSince === null || daysSince >= BACKUP_REMINDER_DAYS;
    return {
      success: true,
      hasBackup: !!last,
      lastBackupAt: lastAt,
      lastBackupId: last ? last.backupId : null,
      lastBackupBy: last && last.createdBy ? (last.createdBy.fullName || null) : null,
      daysSince: daysSince === null ? null : Math.floor(daysSince),
      reminderDue,
      reminderThresholdDays: BACKUP_REMINDER_DAYS,
      inProgress: backupOperationInProgress,
    };
  } catch (error) {
    console.error('Error getting backup status:', error);
    return { success: false, error: error.message };
  }
});

// Θέση αποθήκευσης αντιγράφων — ΟΡΑΤΗ ΜΟΝΟ ΣΤΟΝ SUPERADMIN
ipcMain.handle('get-backup-location', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const custom = readBackupLocationSetting();
    return {
      success: true,
      location: custom,             // η βασική διαδρομή που επέλεξε ο χρήστης (ή null)
      effectiveDir: backupDir,      // ο πραγματικός φάκελος αποθήκευσης
      isDefault: !custom,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Ορισμός θέσης αποθήκευσης — SUPERADMIN, ή κατά την αρχική ρύθμιση (πριν υπάρξουν χρήστες)
ipcMain.handle('save-backup-location', async (_event, { actingUsername, location } = {}) => {
  try {
    const noUsersYet = loadUsers().length === 0;
    if (!noUsersYet && !isSuperAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα αλλαγής της θέσης αποθήκευσης' };
    }
    const cfgPath = getBackupLocationConfigPath();
    if (!cfgPath) {
      return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    }

    const loc = String(location || '').trim();
    if (loc) {
      const resolved = path.resolve(loc);
      if (!fs.existsSync(resolved)) {
        return { success: false, error: 'Η διαδρομή δεν υπάρχει' };
      }
      let stat;
      try { stat = fs.statSync(resolved); } catch (_e) { stat = null; }
      if (!stat || !stat.isDirectory()) {
        return { success: false, error: 'Η διαδρομή δεν είναι φάκελος' };
      }
      // Έλεγχος δικαιώματος εγγραφής
      try {
        fs.accessSync(resolved, fs.constants.W_OK);
      } catch (_e) {
        return { success: false, error: 'Δεν υπάρχει δικαίωμα εγγραφής στη διαδρομή' };
      }
      safeWriteJSON(cfgPath, { location: resolved, updatedAt: new Date().toISOString() });
    } else {
      // Επαναφορά στην προεπιλογή
      try { if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath); } catch (_e) { /* ignore */ }
    }

    backupDir = resolveBackupDir();
    if (backupDir && !fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    if (!noUsersYet) {
      try {
        const actor = resolveBackupActingUser(actingUsername);
        logAuditAction({
          type: 'update',
          entityType: 'backup_location',
          entityId: 'system',
          entityTitle: 'Θέση αποθήκευσης αντιγράφων',
          details: 'Άλλαξε η θέση αποθήκευσης των αντιγράφων ασφαλείας',
          userFullName: actor?.fullName,
          userRole: actor?.role,
        });
      } catch (_e) { /* non-critical */ }
    }

    return { success: true, effectiveDir: backupDir, isDefault: !loc };
  } catch (error) {
    console.error('Error saving backup location:', error);
    return { success: false, error: error.message };
  }
});

// Επιλογή φακέλου αποθήκευσης αντιγράφων (native dialog)
ipcMain.handle('select-backup-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Επιλέξτε φάκελο αποθήκευσης αντιγράφων ασφαλείας',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
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

    // Βήμα 1: Υποχρεωτικό αντίγραφο ασφαλείας πριν την επαναφορά.
    // Αν αποτύχει, ΔΕΝ προχωράμε — προστατεύουμε τα τρέχοντα δεδομένα.
    let safetyBackup = null;
    try {
      safetyBackup = await createSafetyBackup();
      console.log(`✅ Safety backup created: ${safetyBackup.fileName}`);
    } catch (error) {
      console.error('❌ Could not create safety backup — aborting restore:', error);
      return {
        success: false,
        error: 'Δεν ήταν δυνατή η δημιουργία αντιγράφου ασφαλείας πριν την επαναφορά. Η επαναφορά ακυρώθηκε για την προστασία των δεδομένων σας.',
      };
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
        // Full restore: αντικατάσταση όλων των δεδομένων
        console.log('🔄 Performing full restore...');

        const extractedDataDir = path.join(tempExtractDir, 'dedomena_ergon');
        const sourceDir = fs.existsSync(extractedDataDir) ? extractedDataDir : tempExtractDir;

        // 4α. Καθαρίζουμε τα τρέχοντα δεδομένα (εκτός συστημικών/προσωρινών),
        //     ώστε το αποτέλεσμα να είναι πιστό αντίγραφο του backup.
        try {
          const currentEntries = fs.readdirSync(dataDir);
          for (const entry of currentEntries) {
            if (BACKUP_EXCLUDE_ENTRIES.has(entry)) continue;
            if (entry.startsWith('.')) continue;
            if (entry.startsWith('temp_')) continue; // περιλαμβάνει το temp_restore_*
            const p = path.join(dataDir, entry);
            if (backupDir && path.resolve(p) === path.resolve(backupDir)) continue;
            try {
              const st = fs.statSync(p);
              if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
              else fs.unlinkSync(p);
            } catch (_e) { /* συνεχίζουμε */ }
          }
        } catch (e) {
          console.error('Error clearing current data before full restore:', e);
        }

        // 4β. Αντιγραφή όλων των στοιχείων από το backup
        const entries = fs.readdirSync(sourceDir);
        for (const entry of entries) {
          if (entry === 'backups' || entry === 'locks') continue;
          const sourcePath = path.join(sourceDir, entry);
          const destPath = path.join(dataDir, entry);
          if (fs.statSync(sourcePath).isDirectory()) {
            if (fs.existsSync(destPath)) fs.rmSync(destPath, { recursive: true, force: true });
            fse.copySync(sourcePath, destPath);
          } else {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.copyFileSync(sourcePath, destPath);
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
      const restoreActor = options.actingUser || (() => { const u = getCurrentAuditUser(); return { username: u.username, fullName: u.fullName, role: u.role }; })();
      const restoreInfo = {
        restoreId: uuidv4(),
        backupId: backupId,
        timestamp: new Date().toISOString(),
        type: type,
        safetyBackupId: safetyBackup ? safetyBackup.backupId : null,
        restoredBy: restoreActor,
        success: true
      };

      try {
        logAuditAction({
          type: 'restore',
          entityType: 'backup',
          entityId: backupId,
          entityTitle: 'Επαναφορά αντιγράφου ασφαλείας',
          details: `Επαναφορά δεδομένων από αντίγραφο (${backup.fileName})`,
          userFullName: restoreActor?.fullName,
          userRole: restoreActor?.role,
        });
      } catch (_e) { /* non-critical */ }
      
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

// Restore backup IPC handler — ΜΟΝΟ SUPERADMIN
ipcMain.handle('restore-backup', async (event, backupId, options = {}) => {
  const actingUsername = (options && options.actingUsername) || null;
  if (!isSuperAdminUser(actingUsername || loggedInUsername)) {
    return { success: false, error: 'Μόνο ο Υπερδιαχειριστής μπορεί να κάνει επαναφορά δεδομένων.' };
  }
  const lock = acquireBackupLock({ operation: 'restore' });
  if (!lock.ok) {
    return { success: false, error: lock.error };
  }
  try {
    const actingUser = resolveBackupActingUser(actingUsername);
    const result = await restoreBackup(backupId, { ...options, actingUser });
    return result;
  } catch (error) {
    console.error('Error in restore-backup handler:', error);
    return { success: false, error: error.message };
  } finally {
    releaseBackupLock();
  }
});

// Restart app IPC handler
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// Επαναφορά keyboard routing μετά από native dialogs (window.alert/confirm).
// Χρησιμοποιεί sendInputEvent για να εγχύσει συνθετικό Shift keydown/keyup
// κατευθείαν στο Chromium IPC — παρακάμπτει το OS keyboard routing
// και επαναφέρει τον Chromium keyboard dispatcher χωρίς κανένα visual flicker.
ipcMain.handle('refocus-window', (_event) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const wc = mainWindow.webContents;
      // Πρώτα webContents.focus() για να βεβαιωθούμε ότι έχει focus
      wc.focus();
      // Στη συνέχεια synthetic Shift key — αόρατο, χωρίς side effects στο app,
      // αλλά επαναφέρει τον Chromium keyboard event dispatcher
      setTimeout(() => {
        try {
          if (!mainWindow.isDestroyed()) {
            wc.sendInputEvent({ type: 'keyDown', keyCode: 'Shift' });
            wc.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' });
          }
        } catch { /* ignore */ }
      }, 50);
    }
  } catch (e) {
    logger.warn('refocus-window error:', e.message);
  }
  return { success: true };
});

// ============================================================
// FUNDING OPTIONS IPC HANDLERS
// ============================================================

// Built-in defaults — αντιγραφή από formOptions.js (δεν γίνεται require του renderer bundle)
const BUILT_IN_FUNDING_SOURCES = [
  'ΠΡΟΓΡΑΜΜΑ ΑΝΤΩΝΗΣ ΤΡΙΤΣΗΣ',
  'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ',
  'ΠΔΕ ΥΠΕΣ ΣΑΕ055',
  'ΕΣΠΑ 2014_2020',
  'ΕΣΠΑ 2021_2027',
  'ΕΘΝΙΚΟ ΠΔΕ ή EΠΑ_2021_2025',
  'ΤΑΜΕΙΟ ΑΝΑΚΑΜΨΗΣ και ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ',
  'ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ',
];

const BUILT_IN_FUNDING_DETAILS = {
  'ΠΡΟΓΡΑΜΜΑ ΑΝΤΩΝΗΣ ΤΡΙΤΣΗΣ': ['ΑΤ01. Υποδομές ύδρευσης','ΑΤ02. Ολοκληρωμένη διαχείριση αστικών λυμάτων','ΑΤ03. Παρεμβάσεις και δράσεις βελτίωσης της διαχείρισης ενέργειας και αξιοποίηση Ανανεώσιμων Πηγών Ενέργειας στις υποδομές διαχείρισης υδάτων και λυμάτων','ΑΤ04. Χωριστή Συλλογή Βιοαποβλήτων, Γωνιές Ανακύκλωσης και Σταθμοί Μεταφόρτωσης Απορριμμάτων','ΑΤ05. Ανάπτυξη της υπαίθρου-Αγροτική Οδοποιία','ΑΤ06. Αστική Αναζωογόνηση','ΑΤ07. Αξιοποίηση του κτιριακού αποθέματος των Δήμων','ΑΤ08. Smart cities, ευφυείς εφαρμογές, συστήματα και πλατφόρμες για την ασφάλεια, υγεία - πρόνοια, ηλεκτρονική διακυβέρνηση….','ΑΤ09. Ωρίμανση έργων και δράσεων για την υλοποίηση του Προγράμματος','ΑΤ10. Συντήρηση δημοτικών ανοιχτών αθλητικών χώρων, σχολικών μονάδων, προσβασιμότητα ΑμΕΑ','ΑΤ11. Δράσεις για υποδομές που χρήζουν αντισεισμικής προστασίας (προσεισμικός έλεγχος)','ΑΤ12. Δράσεις Ηλεκτροκίνησης στους Δήμους','ΑΤ13. Έργα αντιπλημμυρικής προστασίας','ΑΤ14. Ελλάδα 1821 - Ελλάδα 2021'],
  'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ': ['Π000. Επιχορήγηση των Δήμων της χώρας από το πρόγραμμα «Φιλόδημος ΙΙ» βάσει της 30292/19.04.2019 υπουργικής απόφασης','Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού','Π002. Επισκευή, συντήρηση σχολικών κτιρίων & αύλειων χώρων και λοιπές δράσεις','Π003. Προμήθεια-τοποθέτηση εξοπλισμού για την αναβάθμιση παιδικών χαρών των δήμων της Χώρας','Π004. Κατασκευή, επισκευή και συντήρηση αθλητικών εγκαταστάσεων των Δήμων','Π005. Προμήθεια εξοπλισμού, κατασκευή, μεταφορά και τοποθέτηση στεγάστρων, για την δημιουργία ή και αναβάθμιση των στάσεων.','Π006. Σύνταξη / Επικαιροποίηση Γενικών Σχεδίων Ύδρευσης (Masterplan) και Σύνταξη / Επικαιροποίηση Σχεδίων Ασφάλειας Νερού','Π007. Σύνταξη / Επικαιροποίηση Σχεδίων και Μελετών στο πλαίσιο της κατασκευής, βελτίωσης και συντήρησης των λιμενικών υποδομών των Δημοτικών Λιμενικών Ταμείων και Γραφείων.','Π008. Εκπόνηση μελετών και υλοποίηση μέτρων και μέσων πυροπροστασίας στις σχολικές μονάδες της χώρας','Π009. Κατασκευή ραμπών και χώρων υγιεινής για την πρόσβαση και την εξυπηρέτηση ΑΜΕΑ σε σχολικές μονάδες','Π010. Κατασκευή, επισκευή, συντήρηση και εξοπλισμός εγκαταστάσεων καταφυγίων αδέσποτων ζώων συντροφιάς.','Π011. Ειδική Επιχορήγηση των δήμων οι οποίοι έχουν συσταθεί δυνάμει του άρθρου 154 του Ν. 4600/2019','Π012. Κατασκευή, επισκευή, συντήρηση και εξοπλισμός εγκαταστάσεων καταφυγίων αδέσποτων ζώων συντροφιάς – Πρόγραμμα «Άργος»','Π099. Λοιπές περιπτώσεις (διευκρινίστε στη στήλη ΠΑΡΑΤΗΡΗΣΕΙΣ)'],
  'ΠΔΕ ΥΠΕΣ ΣΑΕ055': ['0301. ΠΥΡΚΑΓΙΕΣ: Πρόληψη και αντιμετώπιση ζημιών και καταστροφών από πυρκαγιές.','0302. ΘΕΟΜΗΝΙΕΣ: Πρόληψη και αντιμετώπιση ζημιών και καταστροφών από θεομηνίες.','0303. ΛΕΙΨΥΔΡΙΑ: Εκτέλεση εργασιών για την αντιμετώπιση του φαινομένου της λειψυδρίας.','0304. ΣΤΑΘΜΟΙ: Πρασαρμογή βρεφικών, παιδικών και βρεφονηπιακών σταθμών στο ΠΔ 99/2017.','0305. ΛΟΙΠΑ'],
  'ΕΣΠΑ 2014_2020': ['0401. ΕΠ ΑΝΕΚ: Ανταγωνιστικότητα, Επιχειρηματικότητα και Καινοτομία','0402. ΕΠ ΥΜΕΠΕΡΑΑ: Υποδομές Μεταφορών, Περιβάλλον και Αειφόρος Ανάπτυξη','0403. ΕΠ ΑΝΑΔΕΔΒ: Ανάπτυξη Ανθρώπινου Δυναμικού, Εκπαίδευση και Διά Βίου Μάθηση','0404. ΕΠ ΜΔΤ: Μεταρρύθμιση Δημόσιου Τομέα','0405. ΕΠ ΑλΘ: Αλιείας και Θάλασσας','0406. Επιχειρησιακό Πρόγραμμα Αγροτική Ανάπτυξη','0407. ΠΕΠ Ανατολικής Μακεδονίας και Θράκης','0408. ΠΕΠ Αττικής','0409. ΠΕΠ Βορείου Αιγαίου','0410. ΠΕΠ Δυτικής Ελλάδας','0411. ΠΕΠ Δυτικής Μακεδονίας','0412. ΠΕΠ Ηπείρου','0413. ΠΕΠ Θεσσαλίας','0414. ΠΕΠ Ιονίων Νήσων','0415. ΠΕΠ Κεντρικής Μακεδονίας','0416. ΠΕΠ Κρήτης','0417. ΠΕΠ Νοτίου Αιγαίου','0418. ΠΕΠ Πελοποννήσου','0419. ΠΕΠ Στερεάς Ελλάδας','0420. ΕΣΠΑ 2007-2013 (μεταφερόμενο)','0499. Άλλο (διευκρινίστε στη στήλη ΠΑΡΑΤΗΡΗΣΕΙΣ)'],
  'ΕΣΠΑ 2021_2027': ['0501. ΕΠ Ανταγωνιστικότητα','0502. ΕΠ Ψηφιακός μετασχηματισμός','0503. ΕΠ Περιβάλλον και κλιματική αλλαγή','0504. ΕΠ Μεταφορές','0505. ΕΠ Πολιτική προστασία','0506. ΕΠ Ανθρώπινο δυναμικό και κοινωνική συνοχή','0507. ΕΠ Δίκαιο αναπτυξιακή μετάβαση','0508. ΕΠ Αλιεία, υδατοκαλλιέργεια και θάλασσα','0509. ΠΕΠ Ανατολικής Μακεδονίας και Θράκης','0510. ΠΕΠ Αττικής','0511. ΠΕΠ Βορείου Αιγαίου','0512. ΠΕΠ Δυτικής Ελλάδας','0513. ΠΕΠ Δυτικής Μακεδονίας','0514. ΠΕΠ Ηπείρου','0515. ΠΕΠ Θεσσαλίας','0516. ΠΕΠ Ιονίων Νήσων','0517. ΠΕΠ Κεντρικής Μακεδονίας','0518. ΠΕΠ Κρήτης','0519. ΠΕΠ Νοτίου Αιγαίου','0520. ΠΕΠ Πελοποννήσου','0521. ΠΕΠ Στερεάς Ελλάδας','0599. Άλλο (διευκρινίστε στη στήλη ΠΑΡΑΤΗΡΗΣΕΙΣ)'],
  'ΕΘΝΙΚΟ ΠΔΕ ή EΠΑ_2021_2025': ['0601. Υπουργείο Οικονομικών','0602. Υπουργείο Ανάπτυξης & Επενδύσεων','0603. Υπουργείο Παιδείας & Θρησκευμάτων','0604. Υπουργείο Εργασίας & Κοινωνικών Υποθέσεων','0605. Υπουργείο Υγείας','0606. Υπουργείο Περιβάλλοντος & Ενέργειας','0607. Υπουργείο Προστασίας του Πολίτη','0608. Υπουργείο Πολιτισμού & Αθλητισμού','0609. Υπουργείο Εσωτερικών','0610. Υπουργείο Μετανάστευσης και Ασύλου','0611. Υπουργείο Ψηφιακής Διακυβέρνησης','0612. Υπουργείο Υποδομών & Μεταφορών','0613. Υπουργείο Ναυτιλίας & Νησιωτικής Πολιτικής','0614. Υπουργείο Αγροτικής Ανάπτυξης &Τροφίμων','0615. Υπουργείο Τουρισμού','0616. Υπουργείο Κλιματικής Αλλαγής & Πολιτικής Προστασίας','0617. Περιφέρειας Ανατολικής Μακεδονίας και Θράκης','0618. Περιφέρειας Αττικής','0619. Περιφέρειας Βορείου Αιγαίου','0620. Περιφέρειας Δυτικής Ελλάδας','0621. Περιφέρειας Δυτικής Μακεδονίας','0622. Περιφέρειας Ηπείρου','0623. Περιφέρειας Θεσσαλίας','0624. Περιφέρειας Ιονίων Νήσων','0625. Περιφέρειας Κεντρικής Μακεδονίας','0626. Περιφέρειας Κρήτης','0627. Περιφέρειας Νοτίου Αιγαίου','0628. Περιφέρειας Πελοποννήσου','0629. Περιφέρειας Στερεάς Ελλάδας','0630. Αναπτυξιακό Πρόγραμμα Ειδικού Σκοπού Βορείου Αιγαίου','0631. Αναπτυξιακό Πρόγραμμα Ειδικού Σκοπού Νοτίου Αιγαίου','0632. Ειδικό Πρόγραμμα Δήμου Αθηναίων','0633. Ειδικό Πρόγραμμα Φυσικών Καταστροφών','0634. Ειδικό Πρόγραμμα Αντιμετώπισης Έκτακτων Αναγκών','0699. Άλλο (διευκρινίστε στη στήλη ΠΑΡΑΤΗΡΗΣΕΙΣ)'],
  'ΤΑΜΕΙΟ ΑΝΑΚΑΜΨΗΣ και ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ': ['0701. Smart Cities','0702. Παρεμβάσεις με στόχο τη βελτίωση του Δημόσιου Χώρου','0703. Αειφόρος χρήση των πόρων, ανθεκτικότητα στην κλιματική αλλαγή και διατήρηση της βιοοιποικιλότητας (Πράσινη Μετάβαση - Επεξεργασία Λυμάτων)','0704. Βελτίωση οδικής ασφάλειας','0705. Παρεμβάσεις αναβάθμισης περιφερειακών λιμένων','0706. Στρατηγικές αστικές αναπλάσεις','0707. Εκσυγχρονισμός των ΚΕΠ','0708. Αειφόρος χρήση των πόρων, ανθεκτικότητα στην κλιματική αλλαγή και διατήρηση της βιοποικιλότητας (Ύδατα)','0709. Αειφόρος χρήση των πόρων, ανθεκτικότητα στην κλιματική αλλαγή και διατήρηση της βιοποικιλότητας (Εθνικό Δίκτυο Μονοπατιών)','0710. Βελτίωση της ενεργειακής απόδοσης σε εγκαταστάσεις οδοφωτισμού στους ΟΤΑ','0799. Άλλο (διευκρινίστε στη στήλη ΠΑΡΑΤΗΡΗΣΕΙΣ)'],
  'ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ': ['1001. Πράσινο Ταμείο','1002. Ταμείο Αλληλεγγύης (Υπουργείου Μετανάστευσης και Ασύλου)','1003. Ίδρυση νέων τμημάτων βρεφικής, παιδικής και βρεφονηπιακής φροντίδας','1004. ΗΛΕΚΤΡΑ: Πρόγραμμα Ενεργειακής Αναβάθμισης Δημόσιων Κτιρίων (Υπουργείου Περιβάλλοντος και Ενέργειας)','1005. θα καλυφθεί από ΚΑΠ για επενδύσεις (πρώην ΣΑΤΑ)','1006. Παραμένει κενό προς μελλοντική χρήση','1007. Εκπόνηση Τοπικών Πολεοδομικών Σχεδίων (ΤΠΣ) (Υπουργείου Περιβάλλοντος και Ενέργειας)','1099. ΙΔΙΟΙ ΠΟΡΟΙ'],
};

function getFundingOptionsPath() {
  return dataDir ? path.join(dataDir, 'funding_options.json') : null;
}

function loadFundingOptionsFromDisk() {
  try {
    const fundingOptionsPath = getFundingOptionsPath();
    if (fundingOptionsPath && fs.existsSync(fundingOptionsPath)) {
      return JSON.parse(fs.readFileSync(fundingOptionsPath, 'utf8'));
    }
  } catch (e) {
    logger.error('Error reading funding_options.json:', e.message);
  }
  return { sourceOverrides: {}, customSources: [], detailOverrides: {}, customDetails: {} };
}

function mergeFundingOptions(local) {
  const overrides = local.sourceOverrides || {};
  const customSources = local.customSources || [];
  const detailOverrides = local.detailOverrides || {};
  const customDetails = local.customDetails || {};

  // Πηγές: built-ins + custom, εφαρμογή overrides
  const sources = [
    ...BUILT_IN_FUNDING_SOURCES.map(s => {
      const ov = overrides[s] || {};
      return { value: s, label: ov.label || s, hidden: !!ov.hidden, isBuiltIn: true };
    }),
    ...customSources.map(s => ({ value: s.value, label: s.label || s.value, hidden: !!s.hidden, isBuiltIn: false })),
  ];

  // Εξειδικεύσεις: για κάθε πηγή
  const details = {};
  const allSourceValues = sources.map(s => s.value);
  for (const srcValue of allSourceValues) {
    const builtInList = BUILT_IN_FUNDING_DETAILS[srcValue] || [];
    const srcDetailOverrides = detailOverrides[srcValue] || {};
    const srcCustomDetails = customDetails[srcValue] || [];
    details[srcValue] = [
      ...builtInList.map(d => {
        const ov = srcDetailOverrides[d] || {};
        return { value: d, label: ov.label || d, hidden: !!ov.hidden, isBuiltIn: true };
      }),
      ...srcCustomDetails.map(d => ({ value: d.value, label: d.label || d.value, hidden: !!d.hidden, isBuiltIn: false })),
    ];
  }

  return { sources, details };
}

/** Ορατές πηγές/εξειδικεύσεις όπως στην κάρτα υποέργου — για πρότυπο Excel & validation εισαγωγής. */
function getLiveFundingEnumsForImport() {
  const local = loadFundingOptionsFromDisk();
  const merged = mergeFundingOptions(local);
  const visibleSources = (merged.sources || []).filter((s) => !s.hidden);
  const FUNDING_SOURCES = visibleSources.map((s) => s.value);
  const FUNDING_DETAILS = {};
  for (const src of visibleSources) {
    FUNDING_DETAILS[src.value] = (merged.details[src.value] || [])
      .filter((d) => !d.hidden)
      .map((d) => d.value);
  }
  return { FUNDING_SOURCES, FUNDING_DETAILS };
}

ipcMain.handle('load-funding-options', async () => {
  try {
    const local = loadFundingOptionsFromDisk();
    const merged = mergeFundingOptions(local);
    return { success: true, data: merged, raw: local };
  } catch (e) {
    logger.error('load-funding-options error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-funding-options', async (_event, payload) => {
  try {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Μη έγκυρο payload' };
    }
    const toSave = {
      sourceOverrides: payload.sourceOverrides || {},
      customSources: payload.customSources || [],
      detailOverrides: payload.detailOverrides || {},
      customDetails: payload.customDetails || {},
    };
    const fundingOptionsPath = getFundingOptionsPath();
    if (!fundingOptionsPath) {
      return { success: false, error: 'Δεν έχει οριστεί φάκελος δεδομένων' };
    }
    safeWriteJSON(fundingOptionsPath, toSave);
    return { success: true };
  } catch (e) {
    logger.error('save-funding-options error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============================================================
// PDF EXPORT IPC HANDLER
// ============================================================

ipcMain.handle('get-user-downloads-path', async () => {
  try {
    return { success: true, path: app.getPath('downloads') };
  } catch (e) {
    return { success: true, path: path.join(require('os').homedir(), 'Downloads') };
  }
});

ipcMain.handle('pick-save-folder', async (_event, { defaultPath } = {}) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: defaultPath || app.getPath('downloads'),
      title: 'Επιλογή φακέλου αποθήκευσης',
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }
    return { success: true, path: result.filePaths[0] };
  } catch (e) {
    logger.error('pick-save-folder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('check-file-exists', async (_event, { filePath } = {}) => {
  try {
    if (!filePath || typeof filePath !== 'string') return { exists: false };
    return { exists: fs.existsSync(filePath) };
  } catch {
    return { exists: false };
  }
});

ipcMain.handle('write-pdf-file', async (_event, { buffer, filePath } = {}) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Δεν δόθηκε διαδρομή αρχείου' };
    }
    const resolved = path.resolve(filePath);
    if (!resolved.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Μη έγκυρο αρχείο PDF' };
    }
    const bytes = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer instanceof Uint8Array ? buffer : (buffer || []));
    fs.writeFileSync(resolved, bytes);
    return { success: true, path: resolved };
  } catch (e) {
    logger.error('write-pdf-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-pdf-file', async (_event, { buffer, defaultName, filePath }) => {
  try {
    if (filePath) {
      const resolved = path.resolve(filePath);
      fs.writeFileSync(resolved, Buffer.from(buffer));
      return { success: true, path: resolved };
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName || 'ERGOHUB_Report.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      title: 'Αποθήκευση Αναφοράς PDF',
    });
    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true };
    }
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    return { success: true, path: result.filePath };
  } catch (e) {
    logger.error('save-pdf-file error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============================================================
// SUBPROJECT REPORT ATTACHMENT RESOLVER
// ============================================================

ipcMain.handle('get-subproject-report-attachments', async (_event, {
  projectId, subprojectId,
  entaxeis = [], proskliseis = [], egkriseis = []
}) => {
  try {
    const attachments = [];

    // ── Ένταξη PDFs ──────────────────────────────────────────
    const entaxisDir = path.join(dataDir, 'entaxeis');
    for (const entaxi of entaxeis) {
      if (!entaxi.entaxiId) continue;
      const base = path.join(entaxisDir, entaxi.entaxiId, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
      for (const fileName of (entaxi.entaxiPDFs || [])) {
        const p = path.join(base, fileName);
        if (fs.existsSync(p)) attachments.push({ label: `Ένταξη: ${fileName}`, filePath: p });
      }
      for (const fileName of (entaxi.approvalPDFs || [])) {
        const p = path.join(base, fileName);
        if (fs.existsSync(p)) attachments.push({ label: `Έγκριση Ένταξης: ${fileName}`, filePath: p });
      }
    }

    // ── Πρόσκληση PDFs ───────────────────────────────────────
    const proskliseisDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ');
    for (const prosk of proskliseis) {
      if (!prosk.prosklisiId) continue;
      const base = path.join(proskliseisDir, prosk.prosklisiId);
      if (!fs.existsSync(base)) continue;
      try {
        const files = fs.readdirSync(base).filter(f =>
          f.toLowerCase().endsWith('.pdf') && !f.startsWith('.')
        );
        for (const f of files) {
          attachments.push({ label: `Πρόσκληση: ${f}`, filePath: path.join(base, f) });
        }
      } catch { /* skip */ }
    }

    // ── Έγκριση Διάθεσης Πίστωσης — πιο πρόσφατη ────────────
    // Τα αρχεία έχουν ως όνομα ημερομηνία· επιλέγουμε το μεγαλύτερο (λεξικογραφικά)
    const possibleEgkrisiPaths = [];
    for (const eg of egkriseis) {
      if (!eg.fileName) continue;
      const candidates = [
        path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS', 'projects', projectId, 'subprojects', subprojectId, 'egkriseis', eg.fileName),
        eg.fileName.endsWith('.pdf')
          ? path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', projectId, subprojectId, eg.fileName)
          : path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', projectId, subprojectId, eg.fileName + '.pdf'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          possibleEgkrisiPaths.push({ name: eg.fileName, filePath: c });
          break;
        }
      }
    }
    if (possibleEgkrisiPaths.length > 0) {
      // Sort by filename descending → most recent date first
      possibleEgkrisiPaths.sort((a, b) => b.name.localeCompare(a.name));
      const best = possibleEgkrisiPaths[0];
      attachments.push({ label: `Έγκριση Διάθεσης Πίστωσης: ${best.name}`, filePath: best.filePath });
    }

    return { success: true, attachments };
  } catch (e) {
    logger.error('get-subproject-report-attachments error:', e.message);
    return { success: false, error: e.message, attachments: [] };
  }
});

// ============================================================
// MERGE AND SAVE PDF (main report + attachments)
// ============================================================

ipcMain.handle('merge-and-save-pdf', async (_event, { mainBuffer, attachmentPaths = [], defaultName }) => {
  try {
    const { PDFDocument } = require('pdf-lib');

    const merged = await PDFDocument.create();

    // Copy pages from main report
    const mainDoc = await PDFDocument.load(Buffer.from(mainBuffer));
    const mainPages = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
    mainPages.forEach(p => merged.addPage(p));

    // Append each attachment
    for (const filePath of attachmentPaths) {
      if (!filePath || !fs.existsSync(filePath)) continue;
      try {
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(dataDir))) continue; // security check
        const bytes = fs.readFileSync(resolved);
        const attDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(attDoc, attDoc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } catch (attachErr) {
        logger.warn('merge-and-save-pdf: skipping attachment', filePath, attachErr.message);
      }
    }

    const mergedBytes = await merged.save();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(require('os').homedir(), 'Desktop', defaultName || 'ERGOHUB_Report.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      title: 'Αποθήκευση Αναφοράς PDF',
    });
    if (result.canceled || !result.filePath) return { success: true, canceled: true };
    fs.writeFileSync(result.filePath, Buffer.from(mergedBytes));
    return { success: true, path: result.filePath };
  } catch (e) {
    logger.error('merge-and-save-pdf error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============================================================
// AUDIT TRAIL IPC HANDLERS
// ============================================================

// Get audit log
ipcMain.handle('get-audit-log', async (event, options = {}) => {
  try {
    const { limit = 1000, entityType = null, entityId = null, action = null, startDate = null, endDate = null, requestingUser = null } = options;

    // Ρόλος μόνο από συνεδρία main process — όχι από username που στέλνει ο renderer.
    const actor = findUserByUsername(loggedInUsername);
    if (!actor || actor.active === false) {
      return { success: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στο ιστορικό' };
    }

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
    {
      const role = actor.role;
      const reqUsername = (actor.username || '').toLowerCase();
      const reqFullName = (actor.fullName || '').toLowerCase();
      
      if (role === 'ENGINEER' || role === 'USER') {
        filteredLogs = filteredLogs.filter(log => {
          const logUser = (log.userFullName || log.user || '').toLowerCase();
          return logUser === reqFullName || logUser === reqUsername;
        });
      } else if (role === 'ADMIN') {
        filteredLogs = filteredLogs.filter(log => {
          const logRole = (log.userRole || '').toUpperCase();
          return logRole === 'ADMIN' || !logRole;
        });
      }
      // SUPERADMIN sees everything - no filtering
    }
    
    // Filter by entity type
    if (entityType) {
      filteredLogs = filteredLogs.filter(log => log.entityType === entityType);
    }

    // Filter by entity id
    if (entityId) {
      filteredLogs = filteredLogs.filter(log => log.entityId === entityId);
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
ipcMain.handle('clear-audit-log', async (_event, keepLast = 1000) => {
  try {
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα εκκαθάρισης ιστορικού ενεργειών' };
    }
    const keep = Math.max(0, Number(keepLast) || 0);
    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
    }

    const before = (auditLog.logs || []).length;
    if (before > keep) {
      auditLog.logs = auditLog.logs.slice(0, keep);
      safeWriteJSON(auditLogPath, auditLog);
      return { success: true, deletedCount: before - auditLog.logs.length };
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
    if (!isSuperAdminUser(loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
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
      const skipDirs = DATA_DIR_SKIP_ROOT_DIRS;

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
const orimanthiExportHandler = require('./orimanthiExportHandler');

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

// ============================================================
// PORTAL DIAFANIAS IPC HANDLERS
// ============================================================

// Helper: convert Greek-formatted amount string (e.g. "142.500,00") to number
function parseGreekAmount(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Helper: read entaxeis from disk (sync, lightweight — for portal export only)
function loadEntaxeisForPortal() {
  if (!entaxisDir || !fs.existsSync(entaxisDir)) return [];
  const result = [];
  try {
    for (const dir of fs.readdirSync(entaxisDir)) {
      const dataFile = path.join(entaxisDir, dir, 'data.json');
      if (fs.existsSync(dataFile)) {
        try { result.push(JSON.parse(fs.readFileSync(dataFile, 'utf8'))); } catch (_) {}
      }
    }
  } catch (_) {}
  return result;
}

// Helper: read proskliseis from disk (sync, lightweight — for portal export only)
function loadProskliseisForPortal() {
  if (!proskliseisDir || !fs.existsSync(proskliseisDir)) return [];
  const result = [];
  try {
    for (const dir of fs.readdirSync(proskliseisDir)) {
      const dataFile = path.join(proskliseisDir, dir, 'data.json');
      if (fs.existsSync(dataFile)) {
        try { result.push(JSON.parse(fs.readFileSync(dataFile, 'utf8'))); } catch (_) {}
      }
    }
  } catch (_) {}
  return result;
}

// Default portal export fields — all enabled
const PORTAL_EXPORT_FIELDS_DEFAULT = {
  xrimatodotisi: true,
  proupologismos: true,
  approvedAmount: true,
  symvasiPoso: true,
  anadochos: true,
  diadikasia_anathesis: true,
  hmerominia_enarksis: true,
  adam: true,
  mis: true,
  kategoria: true,
};

// Statuses for which ΑΔΑΜ is relevant (contract signed/active/completed)
const ADAM_VISIBLE_STATUSES = new Set([
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
]);

/**
 * Συνολικό τρέχον ποσό σύμβασης για μία υποσύνολο/σύμβαση (portal export).
 * Αθροίζει βασικό + καταγεγραμμένες συμπληρωματικές (εξαιρεί παρατάσεις που δεν έχουν ποσό).
 */
function computePortalSingleContractTotal(baseAmountStr, supplementaryContracts) {
  let running = parseGreekAmount(baseAmountStr) || 0;
  (Array.isArray(supplementaryContracts) ? supplementaryContracts : []).forEach((row) => {
    const amt = parseGreekAmount(row?.amount);
    if (amt && amt > 0) running += amt;
  });
  return running > 0 ? running : null;
}

// Helper: map one subproject to the erga.json ergon entry format
// fieldMask controls which optional fields are included (id/titlos/katastasi always included)
// mergeCompleted: if true, "ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ" is normalized to "ΟΛΟΚΛΗΡΩΜΕΝΟ"
function buildErgonEntry(sp, fieldMask = PORTAL_EXPORT_FIELDS_DEFAULT, mergeCompleted = false) {
  const mask = { ...PORTAL_EXPORT_FIELDS_DEFAULT, ...fieldMask };

  let symvasiPoso = null;
  let anadochos = null;
  let hmEnarksis = null;

  let adam = null;

  if (sp.implementationForm === 'Πολλές Συμβάσεις' && Array.isArray(sp.contracts) && sp.contracts.length > 0) {
    let total = 0;
    for (const c of sp.contracts) {
      const v = computePortalSingleContractTotal(c.amount, sp.supplementaryContracts?.filter(sc => sc?.contractIndex === sp.contracts.indexOf(c)));
      if (v !== null) total += v;
    }
    symvasiPoso = total > 0 ? total : null;

    for (const c of sp.contracts) {
      const name = c.khmdhsContractSnapshot?.anadoxosName;
      if (name) { anadochos = name; break; }
    }
    const firstWithDate = sp.contracts.find(c => c.date);
    if (firstWithDate) hmEnarksis = firstWithDate.date;

    // ΑΔΑΜ: συγκέντρωση όλων των μη-κενών ΑΔΑΜ από τις συμβάσεις
    const adamValues = sp.contracts
      .map(c => (c.khmdhsAdam || '').trim())
      .filter(Boolean);
    adam = adamValues.length > 0 ? adamValues.join(', ') : null;
  } else {
    symvasiPoso = computePortalSingleContractTotal(sp.contractAmount, sp.supplementaryContracts);
    anadochos = sp.khmdhsContractSnapshot?.anadoxosName || null;
    hmEnarksis = sp.contractDate || null;
    adam = (sp.khmdhsAdam || '').trim() || null;
  }

  const mis = sp.misPraxhsCode ? String(sp.misPraxhsCode).trim() || null : null;

  // Κανονικοποίηση κατάστασης αν ενεργοποιηθεί η συγχώνευση
  const rawStatus = sp.projectStatus || null;
  const katastasi = (mergeCompleted && rawStatus === 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ')
    ? 'ΟΛΟΚΛΗΡΩΜΕΝΟ'
    : rawStatus;

  // Πάντα παρόν: id, titlos, katastasi
  const entry = {
    id: sp.subprojectId,
    titlos: sp.subprojectTitle || null,
    katastasi,
  };

  if (mask.kategoria)           entry.kategoria           = sp.projectType || null;
  if (mask.xrimatodotisi)       entry.xrimatodotisi       = sp.fundingSource || null;
  if (mask.proupologismos)      entry.proupologismos      = parseGreekAmount(sp.projectBudget);
  if (mask.approvedAmount)      entry.approvedAmount      = parseGreekAmount(sp.approvedAmount);
  if (mask.symvasiPoso)         entry.symvasiPoso         = symvasiPoso;
  if (mask.anadochos)           entry.anadochos           = anadochos;
  if (mask.diadikasia_anathesis) {
    const proc = sp.assignmentProcedure != null ? String(sp.assignmentProcedure).trim() : '';
    entry.diadikasia_anathesis = proc || null;
  }
  if (mask.hmerominia_enarksis) entry.hmerominia_enarksis = hmEnarksis || null;
  // ΑΔΑΜ: εμφανίζεται μόνο για εκτελούμενα/ολοκληρωμένα/αποπληρωμένα (σύμβαση υπαρκτή)
  if (mask.adam && ADAM_VISIBLE_STATUSES.has(sp.projectStatus)) entry.adam = adam;
  if (mask.mis)                 entry.mis                 = mis;

  return entry;
}

ipcMain.handle('export-portal-data', async (_event, { selectedSubprojectIds, actingUsername, dimosUid }) => {
  try {
    const actingUser = findUserByUsername(actingUsername);
    if (!actingUser || (actingUser.role !== 'ADMIN' && actingUser.role !== 'SUPERADMIN')) {
      return { success: false, error: 'Δεν έχετε δικαίωμα εξαγωγής για την Πύλη Διαφάνειας.' };
    }

    if (!Array.isArray(selectedSubprojectIds) || selectedSubprojectIds.length === 0) {
      return { success: false, error: 'Δεν επιλέχθηκαν υποέργα.' };
    }

    const uid = String(dimosUid || '').trim();
    if (!uid) return { success: false, error: 'Το αναγνωριστικό Δήμου (dimosUid) δεν έχει οριστεί.' };

    const allProjects = await loadAllProjects();
    const selectedSet = new Set(selectedSubprojectIds);
    const selected = allProjects.filter(
      (p) => selectedSet.has(p.subprojectId) && p.projectStatus !== 'ΑΠΕΝΤΑΓΜΕΝΟ'
    );

    const config = loadConfig();
    const dimosOnoma = config.organizationName || '';
    const fieldMask = { ...PORTAL_EXPORT_FIELDS_DEFAULT, ...(config.portalExportFields || {}) };
    const mergeCompleted = config.portalMergeCompleted === true;

    const erga = selected.map(sp => buildErgonEntry(sp, fieldMask, mergeCompleted));

    const ergaJson = {
      dimos: dimosOnoma,
      dimosUid: uid,
      lastUpdated: new Date().toISOString(),
      erga
    };

    const jsonContent = JSON.stringify(ergaJson, null, 2);

    const { dropboxLink } = await uploadPortalJson(jsonContent, uid);

    const publishedPath = path.join(dataDir, 'portal-published.json');
    safeWriteJSON(publishedPath, {
      subprojectIds: selectedSubprojectIds,
      lastExportedAt: new Date().toISOString(),
      lastDropboxLink: dropboxLink
    });

    if (!config.portalDimosUid || config.portalDimosUid !== uid) {
      saveConfig({ portalDimosUid: uid });
    }

    logger.info(`Portal export: ${erga.length} υποέργα → Dropbox /portal/${uid}/erga.json (by ${actingUsername})`);

    return { success: true, dropboxLink, count: erga.length };
  } catch (e) {
    logger.error('export-portal-data failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('load-portal-published', async () => {
  try {
    const publishedPath = path.join(dataDir, 'portal-published.json');
    if (!fs.existsSync(publishedPath)) {
      return { success: true, data: { subprojectIds: [], lastExportedAt: null, lastDropboxLink: null } };
    }
    const data = JSON.parse(fs.readFileSync(publishedPath, 'utf8'));
    return { success: true, data };
  } catch (e) {
    logger.error('load-portal-published failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-portal-published', async (_event, { subprojectIds }) => {
  try {
    const publishedPath = path.join(dataDir, 'portal-published.json');
    const existing = fs.existsSync(publishedPath)
      ? JSON.parse(fs.readFileSync(publishedPath, 'utf8'))
      : {};
    safeWriteJSON(publishedPath, {
      ...existing,
      subprojectIds: Array.isArray(subprojectIds) ? subprojectIds : []
    });
    return { success: true };
  } catch (e) {
    logger.error('save-portal-published failed', e);
    return { success: false, error: e.message };
  }
});

// ============================================================
// ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ IPC HANDLERS
// ============================================================

ipcMain.handle('select-excel-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Επιλογή αρχείου Excel',
      properties: ['openFile'],
      filters: [
        { name: 'Excel Αρχεία', extensions: ['xlsx', 'xls'] },
        { name: 'Όλα τα Αρχεία', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: true, filePath: null };
    }
    return { success: true, filePath: result.filePaths[0] };
  } catch (e) {
    logger.error('select-excel-file error:', e.message);
    return { success: false, error: e.message };
  }
});

const {
  loadAllPrograms: _epLoadAll,
  getActiveProgram: _epGetActive,
  getProgramById: _epGetById,
  importEpProgram: _epImport,
  saveEpAction: _epSaveAction,
  deleteEpAction: _epDeleteAction,
  getEpActionsForSubproject: _epGetActionsForSubproject,
  linkEpSubproject: _epLinkSubproject
} = require('./epProgramService');

ipcMain.handle('load-ep-programs', async (_event, { requestingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στο Επιχειρησιακό Πρόγραμμα' };
    }
    const programs = _epLoadAll(dataDir);
    return { success: true, programs };
  } catch (e) {
    logger.error('load-ep-programs error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-ep-program', async (_event, { programId, requestingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στο Επιχειρησιακό Πρόγραμμα' };
    }
    const program = programId
      ? _epGetById(dataDir, programId)
      : _epGetActive(dataDir);
    if (!program) return { success: true, program: null };
    return { success: true, program };
  } catch (e) {
    logger.error('get-ep-program error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('import-ep-program', async (_event, { filePath, startYear, endYear, requestingUsername }) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα εισαγωγής Επιχειρησιακού Προγράμματος' };
    }
    const result = _epImport(dataDir, { filePath, startYear, endYear, importedBy: requestingUsername });
    logger.info(`EP Program imported by ${requestingUsername}: ${result.title} (${result.actionCount} actions)`);
    return result;
  } catch (e) {
    logger.error('import-ep-program error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-ep-action', async (_event, { programId, action, requestingUsername }) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας δράσεων' };
    }
    return _epSaveAction(dataDir, { programId, action });
  } catch (e) {
    logger.error('save-ep-action error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-ep-action', async (_event, { programId, actionId, requestingUsername }) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα διαγραφής δράσεων' };
    }
    return _epDeleteAction(dataDir, { programId, actionId });
  } catch (e) {
    logger.error('delete-ep-action error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-ep-actions-for-subproject', async (_event, { subprojectId, requestingUsername }) => {
  try {
    const actions = _epGetActionsForSubproject(dataDir, subprojectId);
    return { success: true, actions };
  } catch (e) {
    logger.error('get-ep-actions-for-subproject error:', e.message);
    return { success: false, error: e.message };
  }
});

function _epBuildSubprojectLinkMap(program) {
  const map = {};
  if (!program) return map;
  for (const action of program.actions || []) {
    for (const sid of action.linkedSubprojectIds || []) {
      if (!map[sid]) {
        map[sid] = {
          id: action.id,
          aa: action.aa,
          title: action.title,
          axisCode: action.axisCode,
          measureCode: action.measureCode,
          objectiveCode: action.objectiveCode,
          actionType: action.actionType,
          programId: program.id
        };
      }
    }
  }
  return map;
}

ipcMain.handle('get-ep-subproject-link-map', async (_event, { requestingUsername, programId } = {}) => {
  try {
    if (!findUserByUsername(requestingUsername)) {
      return { success: false, error: 'Μη έγκυρος χρήστης' };
    }
    const program = programId ? _epGetById(dataDir, programId) : _epGetActive(dataDir);
    return { success: true, map: _epBuildSubprojectLinkMap(program) };
  } catch (e) {
    logger.error('get-ep-subproject-link-map error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('link-ep-subproject', async (_event, { programId, actionId, subprojectId, link, requestingUsername }) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα σύνδεσης δράσεων' };
    }
    return _epLinkSubproject(dataDir, { programId, actionId, subprojectId, link });
  } catch (e) {
    logger.error('link-ep-subproject error:', e.message);
    return { success: false, error: e.message };
  }
});

const epProgramExportHandler = require('./epProgramExportHandler');
const { computeEpProgramStatistics, computeEpImplementationStats } = require('./epProgramStats');

ipcMain.handle('get-ep-program-statistics', async (_event, { programId, requestingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στα στατιστικά ΕΠ' };
    }
    const program = programId
      ? _epGetById(dataDir, programId)
      : _epGetActive(dataDir);
    if (!program) {
      return { success: false, error: 'Δεν βρέθηκε Επιχειρησιακό Πρόγραμμα' };
    }
    const stats = computeEpProgramStatistics(program);

    // Φόρτωση υποέργων για υπολογισμό στατιστικών υλοποίησης
    let implStats = null;
    try {
      const subprojects = await loadAllProjects();
      implStats = computeEpImplementationStats(program, subprojects);
    } catch (implErr) {
      logger.warn('get-ep-program-statistics: impl stats skipped:', implErr.message);
    }

    return { success: true, stats: { ...stats, implStats } };
  } catch (e) {
    logger.error('get-ep-program-statistics error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-exported-file', async (_event, { filePath, revealInFolder } = {}) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Μη έγκυρο path αρχείου' };
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const openErr = await shell.openPath(resolved);
      if (openErr) return { success: false, error: openErr };
      return { success: true };
    }
    if (!stat.isFile()) {
      return { success: false, error: 'Μη έγκυρο path' };
    }
    if (revealInFolder) {
      shell.showItemInFolder(resolved);
    } else {
      const openErr = await shell.openPath(resolved);
      if (openErr) return { success: false, error: openErr };
    }
    return { success: true };
  } catch (e) {
    logger.error('open-exported-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-ep-program', async (_event, { programId, requestingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(requestingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα εξαγωγής Επιχειρησιακού Προγράμματος' };
    }

    const program = programId
      ? _epGetById(dataDir, programId)
      : _epGetActive(dataDir);

    if (!program) {
      return { success: false, error: 'Δεν βρέθηκε ενεργό Επιχειρησιακό Πρόγραμμα για εξαγωγή' };
    }

    const result = await epProgramExportHandler.exportEpProgram({
      program,
      exportedBy: requestingUsername,
      appVersion: app.getVersion()
    });

    if (!result.success) return result;

    const saveResult = await dialog.showSaveDialog({
      title: 'Αποθήκευση Επιχειρησιακού Προγράμματος (Excel)',
      defaultPath: result.filename,
      filters: [{ name: 'Excel Αρχεία', extensions: ['xlsx'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      try {
        if (fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath);
      } catch (e) {}
      return { success: true, canceled: true };
    }

    fs.copyFileSync(result.outputPath, saveResult.filePath);
    logger.info(`EP Program exported by ${requestingUsername}: ${saveResult.filePath}`);

    return {
      ...result,
      canceled: false,
      downloadPath: saveResult.filePath
    };
  } catch (e) {
    logger.error('export-ep-program error:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ (Project Maturation / Proposal Pipeline) ─────────────────

const ORIMANTHI_DIR_NAME = 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ';
const orimanthiConfigService = require('./orimanthiConfigService');
const orimanthiAepoReminderService = require('./orimanthiAepoReminderService');
const calendarConfigService = require('./calendarConfigService');
const calendarCustomEventsService = require('./calendarCustomEventsService');
const procurementCalendarReminderService = require('./procurementCalendarReminderService');
const municipalUnitsConfigService = require('./municipalUnitsConfigService');
const { migrateProposalFileGroups } = require('./orimanthiFileCategoriesHelper');
const orimanthiProjectCategoriesHelper = require('./orimanthiProjectCategoriesHelper');

function loadProposalWithFileGroupMigration(proposalId, { persist = false } = {}) {
  const proposal = loadProposal(proposalId);
  if (!proposal) return null;
  const { proposal: migrated, changed } = migrateProposalFileGroups(proposal);
  if (!changed) return proposal;
  if (persist) {
    const toSave = { ...migrated, updatedAt: new Date().toISOString() };
    safeWriteJSON(getProposalDataPath(proposalId), toSave);
    return toSave;
  }
  return migrated;
}

function loadAllProposalsList() {
  const rootDir = ensureOrimanthiDir();
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const proposals = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const proposal = loadProposalWithFileGroupMigration(entry.name, { persist: true });
    if (proposal) proposals.push(proposal);
  }
  proposals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return proposals;
}

function getOrimanthiDir() {
  return path.join(dataDir, ORIMANTHI_DIR_NAME);
}

function ensureOrimanthiDir() {
  const dir = getOrimanthiDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProposalDir(proposalId) {
  return path.join(ensureOrimanthiDir(), proposalId);
}

function getProposalDataPath(proposalId) {
  return path.join(getProposalDir(proposalId), 'data.json');
}

function loadProposal(proposalId) {
  const dataPath = getProposalDataPath(proposalId);
  if (!fs.existsSync(dataPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch {
    return null;
  }
}

const PROPOSAL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_CLIENT_PROPOSAL_ACTIVITY = [
  /^Προστέθηκε εκκρεμότητα:/,
  /^Ολοκλήρωση εκκρεμότητας:/,
  /^Επανάνοιγμα εκκρεμότητας:/,
  /^Διαγραφή εκκρεμότητας:/,
];

const proposalUploadQueues = new Map();

function resolveOrimanthiActingUser(actingUsername) {
  return resolveTaskActingUser(actingUsername);
}

function assertValidProposalId(proposalId) {
  const id = String(proposalId || '').trim();
  if (!PROPOSAL_ID_RE.test(id)) {
    return { ok: false, error: 'Μη έγκυρο αναγνωριστικό έργου' };
  }
  const resolved = path.resolve(getProposalDir(id));
  const rootResolved = path.resolve(getOrimanthiDir());
  if (!resolved.startsWith(rootResolved + path.sep)) {
    return { ok: false, error: 'Μη επιτρεπτό path έργου' };
  }
  return { ok: true, id };
}

function requireOrimanthiSession(actingUsername) {
  const auth = resolveOrimanthiActingUser(actingUsername);
  if (!auth.ok) return auth;
  const user = findUserByUsername(auth.username);
  if (!user || user.active === false || user.approved === false) {
    return { ok: false, error: 'Δεν έχετε πρόσβαση στο σύστημα' };
  }
  return { ok: true, username: auth.username, user };
}

function requireOrimanthiManage(actingUsername) {
  const session = requireOrimanthiSession(actingUsername);
  if (!session.ok) return session;
  const denied = denyOrimanthiManage(session.username);
  if (denied) return { ok: false, error: denied.error };
  return { ok: true, username: session.username, user: session.user };
}

function requireProposalGroup(proposalId, groupId) {
  const idCheck = assertValidProposalId(proposalId);
  if (!idCheck.ok) return idCheck;
  const proposal = loadProposal(idCheck.id);
  if (!proposal) return { ok: false, error: 'Το έργο δεν βρέθηκε' };
  const group = (proposal.fileGroups || []).find((g) => g.id === groupId);
  if (!group) return { ok: false, error: 'Η κατηγορία δεν βρέθηκε στο έργο' };
  return { ok: true, proposalId: idCheck.id, proposal, group };
}

function enqueueProposalUpload(proposalId, fn) {
  const prev = proposalUploadQueues.get(proposalId) || Promise.resolve();
  const run = prev.then(() => fn());
  proposalUploadQueues.set(proposalId, run.catch(() => {}));
  return run;
}

function proposalAuditedFieldsChanged(before, after) {
  const keys = [
    'title', 'status', 'projectCategory', 'infrastructureSpecialization',
    'municipalUnit', 'settlement', 'aepoRenewalDate', 'description', 'notes',
  ];
  for (const key of keys) {
    if (String(before?.[key] ?? '') !== String(after?.[key] ?? '')) return true;
  }
  if (JSON.stringify(before?.pendingItems || []) !== JSON.stringify(after?.pendingItems || [])) {
    return true;
  }
  if (JSON.stringify(before?.fileGroups || []) !== JSON.stringify(after?.fileGroups || [])) {
    return true;
  }
  return false;
}

function pickProposalAuditSnapshot(proposal) {
  if (!proposal) return {};
  const pending = proposal.pendingItems || [];
  const fileGroups = proposal.fileGroups || [];
  let fileEntries = 0;
  fileGroups.forEach((g) => { fileEntries += (g.files || []).length; });
  return {
    title: proposal.title || '',
    status: proposal.status || '',
    projectCategory: proposal.projectCategory || '',
    infrastructureSpecialization: proposal.infrastructureSpecialization || '',
    municipalUnit: proposal.municipalUnit || '',
    settlement: proposal.settlement || '',
    aepoRenewalDate: proposal.aepoRenewalDate || '',
    description: proposal.description || '',
    notes: proposal.notes || '',
    pendingOpen: pending.filter((i) => !i.done).length,
    pendingTotal: pending.length,
    fileCategories: fileGroups.length,
    fileEntries,
  };
}

function getOrimanthiAuditActor(actingUsername) {
  const user = findUserByUsername(actingUsername);
  return {
    fullName: (user?.fullName || '').trim() || actingUsername || '',
    role: user?.role || 'USER',
  };
}

function getOrimanthiActorLabel(actingUsername) {
  return getOrimanthiAuditActor(actingUsername).fullName;
}

function logProposalActivity(proposalId, type, details, actingUsername) {
  const proposal = loadProposal(proposalId);
  const actor = getOrimanthiAuditActor(actingUsername);
  logAuditAction({
    type: type || 'update',
    entityType: 'proposal',
    entityId: proposalId,
    entityTitle: proposal?.title || '',
    userFullName: actor.fullName,
    userRole: actor.role,
    details: details || '',
  });
}

function atomicUpdateProposalFileGroups(proposalId, nextFileGroups) {
  const idCheck = assertValidProposalId(proposalId);
  if (!idCheck.ok) return { success: false, error: idCheck.error };
  const proposal = loadProposal(idCheck.id);
  if (!proposal) return { success: false, error: 'Το έργο δεν βρέθηκε' };
  const previousSnapshot = JSON.parse(JSON.stringify(proposal));
  const toSave = {
    ...proposal,
    fileGroups: nextFileGroups,
    updatedAt: new Date().toISOString(),
  };
  try {
    safeWriteJSON(getProposalDataPath(idCheck.id), toSave);
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true, proposal: toSave, previousSnapshot, proposalId: idCheck.id };
}

function rollbackProposalSnapshot(proposalId, snapshot) {
  if (!snapshot) return;
  const idCheck = assertValidProposalId(proposalId);
  if (!idCheck.ok) return;
  try {
    safeWriteJSON(getProposalDataPath(idCheck.id), snapshot);
  } catch (e) {
    logger.error('rollbackProposalSnapshot failed:', e.message);
  }
}

function listProposalFolderFilesOnDisk(proposalId, groupId, folderId) {
  try {
    const folderPath = resolveProposalGroupPath(proposalId, groupId, folderId);
    if (!fs.existsSync(folderPath)) return [];
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => {
        const fp = path.join(folderPath, e.name);
        const st = fs.statSync(fp);
        return {
          name: e.name,
          size: st.size,
          uploadedAt: st.mtime.toISOString(),
        };
      });
  } catch {
    return [];
  }
}

function reconcileProposalFolderEntry(proposalId, groupId, folderId) {
  const idCheck = assertValidProposalId(proposalId);
  if (!idCheck.ok) return { ok: false, error: idCheck.error };
  const pid = idCheck.id;
  const filesOnDisk = listProposalFolderFilesOnDisk(pid, groupId, folderId);
  const proposal = loadProposal(pid);
  if (!proposal) return { ok: false, error: 'Το έργο δεν βρέθηκε' };

  let removed = false;
  const totalSize = filesOnDisk.reduce((s, f) => s + (f.size || 0), 0);
  const updatedGroups = (proposal.fileGroups || []).map((g) => {
    if (g.id !== groupId) return g;
    const newFiles = (g.files || []).flatMap((f) => {
      if (f.kind !== 'folder' || f.id !== folderId) return [f];
      if (filesOnDisk.length === 0) {
        removed = true;
        return [];
      }
      return [{ ...f, fileCount: filesOnDisk.length, size: totalSize }];
    });
    return { ...g, files: newFiles };
  });

  if (filesOnDisk.length === 0) {
    removed = removed || (proposal.fileGroups || []).some(
      (g) => g.id === groupId && (g.files || []).some((f) => f.kind === 'folder' && f.id === folderId)
    );
    try {
      const folderPath = resolveProposalGroupPath(pid, groupId, folderId);
      if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
    } catch { /* ignore */ }
  }

  const toSave = { ...proposal, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
  safeWriteJSON(getProposalDataPath(pid), toSave);
  return {
    ok: true,
    proposal: loadProposal(pid),
    filesOnDisk,
    removed,
  };
}

function mergeUploadedFilesIntoProposal(proposalId, groupId, savedFiles) {
  const proposal = loadProposal(proposalId);
  if (!proposal) return null;
  const groupExists = (proposal.fileGroups || []).some((g) => g.id === groupId);
  if (!groupExists) return null;
  const updatedGroups = (proposal.fileGroups || []).map((g) => {
    if (g.id !== groupId) return g;
    const existingKeys = new Set((g.files || []).map((f) => (f.kind === 'folder' ? f.id : f.name)));
    const merged = [...(g.files || [])];
    savedFiles.forEach((f) => {
      if (!existingKeys.has(f.name)) merged.push(f);
    });
    return { ...g, files: merged };
  });
  const toSave = { ...proposal, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
  safeWriteJSON(getProposalDataPath(proposalId), toSave);
  return loadProposal(proposalId);
}

function mergeUploadedFolderIntoProposal(proposalId, groupId, folderEntry) {
  const proposal = loadProposal(proposalId);
  if (!proposal) return null;
  const groupExists = (proposal.fileGroups || []).some((g) => g.id === groupId);
  if (!groupExists) return null;
  const updatedGroups = (proposal.fileGroups || []).map((g) => {
    if (g.id !== groupId) return g;
    const exists = (g.files || []).some((f) => f.kind === 'folder' && f.id === folderEntry.id);
    if (exists) return g;
    return { ...g, files: [...(g.files || []), folderEntry] };
  });
  const toSave = { ...proposal, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
  safeWriteJSON(getProposalDataPath(proposalId), toSave);
  return loadProposal(proposalId);
}

function resolveProposalGroupPath(proposalId, groupId, ...parts) {
  const target = path.resolve(path.join(getProposalDir(proposalId), 'files', groupId, ...parts));
  const root = path.resolve(getOrimanthiDir());
  if (!target.startsWith(root + path.sep)) {
    throw new Error('Μη επιτρεπτό path');
  }
  return target;
}

function canManageOrimanthi(username) {
  const user = findUserByUsername(username);
  if (!user || user.active === false || user.approved === false) return false;
  if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
  if (resolveOrimanthiCanEditFlag(user)) return true;
  return false;
}

function denyOrimanthiManage(username) {
  if (canManageOrimanthi(username)) return null;
  return { success: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας ωρίμανσης έργων' };
}

ipcMain.handle('load-all-proposals', async () => {
  try {
    const rootDir = ensureOrimanthiDir();
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const proposals = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const proposal = loadProposalWithFileGroupMigration(entry.name, { persist: true });
      if (proposal) proposals.push(proposal);
    }
    proposals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { success: true, proposals };
  } catch (e) {
    logger.error('load-all-proposals error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-proposal', async (_event, { proposal, actingUsername, skipAudit, expectedUpdatedAt } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposal || !proposal.id) return { success: false, error: 'Μη έγκυρα δεδομένα έργου' };
    const idCheck = assertValidProposalId(proposal.id);
    if (!idCheck.ok) return { success: false, error: idCheck.error };

    const proposalDir = getProposalDir(idCheck.id);
    const dataPath = getProposalDataPath(idCheck.id);
    const existedBefore = fs.existsSync(dataPath);
    const existing = existedBefore ? loadProposal(idCheck.id) : null;

    if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      return {
        success: false,
        conflict: true,
        error: 'Το έργο τροποποιήθηκε από άλλη ενέργεια. Φορτώστε ξανά και επαναλάβετε.',
        proposal: existing,
      };
    }

    const orimanthiCfg = orimanthiConfigService.loadOrimanthiConfig(dataDir);
    const categoryValidation = orimanthiProjectCategoriesHelper.validateProposalCategoryFields(
      proposal,
      orimanthiCfg.customCategorySpecializations
    );
    if (!categoryValidation.ok) {
      return { success: false, error: categoryValidation.error };
    }

    if (!fs.existsSync(proposalDir)) fs.mkdirSync(proposalDir, { recursive: true });
    const toSave = { ...proposal, id: idCheck.id, updatedAt: new Date().toISOString() };
    if (existing?.createdAt && !toSave.createdAt) toSave.createdAt = existing.createdAt;

    const mustAudit = !skipAudit || (existing && proposalAuditedFieldsChanged(existing, toSave));
    safeWriteJSON(dataPath, toSave);

    if (mustAudit) {
      const actor = getOrimanthiAuditActor(auth.username);
      if (!existedBefore) {
        logAuditAction({
          type: 'create',
          entityType: 'proposal',
          entityId: idCheck.id,
          entityTitle: proposal.title || '',
          userFullName: actor.fullName,
          userRole: actor.role,
          details: 'Δημιουργία νέου έργου ωρίμανσης',
        });
      } else {
        logAuditAction({
          type: 'update',
          entityType: 'proposal',
          entityId: idCheck.id,
          entityTitle: proposal.title || '',
          userFullName: actor.fullName,
          userRole: actor.role,
          oldValue: pickProposalAuditSnapshot(existing),
          newValue: pickProposalAuditSnapshot(toSave),
        });
      }
    }
    return { success: true, proposal: toSave };
  } catch (e) {
    logger.error('save-proposal error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-proposal', async (_event, { proposalId, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const resolved = path.resolve(getProposalDir(idCheck.id));
    const rootResolved = path.resolve(getOrimanthiDir());
    if (!resolved.startsWith(rootResolved + path.sep)) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }
    const proposal = loadProposal(idCheck.id);
    if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
    const actor = getOrimanthiAuditActor(auth.username);
    logAuditAction({
      type: 'delete',
      entityType: 'proposal',
      entityId: idCheck.id,
      entityTitle: proposal?.title || idCheck.id,
      userFullName: actor.fullName,
      userRole: actor.role,
      details: 'Διαγραφή έργου ωρίμανσης'
    });
    return { success: true };
  } catch (e) {
    logger.error('delete-proposal error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('upload-proposal-files', async (_event, { proposalId, groupId, files, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'Μη έγκυρες παράμετροι ανεβάσματος' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };

    return enqueueProposalUpload(idCheck.id, async () => {
      const groupCheck = requireProposalGroup(idCheck.id, groupId);
      if (!groupCheck.ok) return { success: false, error: groupCheck.error };

      const groupDir = resolveProposalGroupPath(idCheck.id, groupId);
      if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

      const saved = [];
      for (const file of files) {
        if (!file.path || !fs.existsSync(file.path)) continue;
        let baseName = path.basename(file.name || file.path);
        let destPath = path.join(groupDir, baseName);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          destPath = path.join(groupDir, `${nameNoExt}_${counter}${ext}`);
          counter++;
        }
        fs.copyFileSync(file.path, destPath);
        saved.push({
          kind: 'file',
          name: path.basename(destPath),
          originalName: baseName,
          size: fs.statSync(destPath).size,
          uploadedAt: new Date().toISOString()
        });
      }
      if (saved.length === 0) {
        return { success: false, error: 'Δεν αντιγράφηκε κανένα αρχείο' };
      }
      const updatedProposal = mergeUploadedFilesIntoProposal(idCheck.id, groupId, saved);
      if (!updatedProposal) {
        saved.forEach((f) => {
          try {
            const p = path.join(groupDir, f.name);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch { /* ignore rollback errors */ }
        });
        return { success: false, error: 'Αποτυχία αποθήκευσης metadata μετά το ανέβασμα' };
      }
      logProposalActivity(
        idCheck.id,
        'update',
        `Προστέθηκαν ${saved.length} αρχεία στην κατηγορία: ${saved.map((f) => f.name).join(', ')}`,
        auth.username
      );
      return { success: true, files: saved, proposal: updatedProposal };
    });
  } catch (e) {
    logger.error('upload-proposal-files error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('upload-proposal-folder', async (_event, { proposalId, groupId, folderName, files, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'Μη έγκυρες παράμετροι ανεβάσματος φακέλου' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };

    return enqueueProposalUpload(idCheck.id, async () => {
      const groupCheck = requireProposalGroup(idCheck.id, groupId);
      if (!groupCheck.ok) return { success: false, error: groupCheck.error };

      const groupDir = resolveProposalGroupPath(idCheck.id, groupId);
      if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

      const folderId = uuidv4();
      const folderDir = resolveProposalGroupPath(idCheck.id, groupId, folderId);
      fs.mkdirSync(folderDir, { recursive: true });

      const saved = [];
      let totalSize = 0;
      for (const file of files) {
        const sourcePath = file.path || file.filePath;
        if (!sourcePath || !fs.existsSync(sourcePath)) continue;
        let baseName = path.basename(file.name || file.fileName || sourcePath);
        baseName = baseName.replace(/[<>:"/\\|?*]/g, '_');
        let destPath = path.join(folderDir, baseName);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          destPath = path.join(folderDir, `${nameNoExt}_${counter}${ext}`);
          counter += 1;
        }
        fs.copyFileSync(sourcePath, destPath);
        const size = fs.statSync(destPath).size;
        totalSize += size;
        saved.push({
          name: path.basename(destPath),
          size,
          uploadedAt: new Date().toISOString()
        });
      }
      if (!saved.length) {
        try {
          if (fs.existsSync(folderDir)) fs.rmSync(folderDir, { recursive: true, force: true });
        } catch { /* ignore */ }
        return { success: false, error: 'Δεν αντιγράφηκαν αρχεία από τον φάκελο' };
      }

      const safeLabel = String(folderName || 'Φάκελος').trim() || 'Φάκελος';
      const folder = {
        kind: 'folder',
        id: folderId,
        name: safeLabel,
        fileCount: saved.length,
        size: totalSize,
        uploadedAt: new Date().toISOString()
      };
      const updatedProposal = mergeUploadedFolderIntoProposal(idCheck.id, groupId, folder);
      if (!updatedProposal) {
        try {
          if (fs.existsSync(folderDir)) fs.rmSync(folderDir, { recursive: true, force: true });
        } catch { /* ignore rollback errors */ }
        return { success: false, error: 'Αποτυχία αποθήκευσης metadata μετά το ανέβασμα φακέλου' };
      }
      logProposalActivity(
        idCheck.id,
        'update',
        `Προστέθηκε φάκελος «${safeLabel}» (${saved.length} αρχεία)`,
        auth.username
      );
      return { success: true, folder, files: saved, proposal: updatedProposal };
    });
  } catch (e) {
    logger.error('upload-proposal-folder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-proposal-file', async (_event, {
  proposalId, groupId, fileName, nextFileGroups, actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !fileName) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId και fileName' };
    }
    if (!Array.isArray(nextFileGroups)) {
      return { success: false, error: 'Απαιτούνται nextFileGroups' };
    }
    const metaRes = atomicUpdateProposalFileGroups(proposalId, nextFileGroups);
    if (!metaRes.success) return metaRes;
    const pid = metaRes.proposalId;
    const filePath = resolveProposalGroupPath(pid, groupId, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) throw new Error('Η εγγραφή δεν είναι αρχείο');
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: e.message };
    }
    logProposalActivity(pid, 'update', `Διαγράφηκε αρχείο «${fileName}»`, auth.username);
    return { success: true, proposal: loadProposal(pid) };
  } catch (e) {
    logger.error('delete-proposal-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('rename-proposal-file', async (_event, {
  proposalId,
  groupId,
  folderId,
  oldFileName,
  newFileName,
  actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !oldFileName || !newFileName) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId, oldFileName και newFileName' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const pid = idCheck.id;

    const safeOld = path.basename(String(oldFileName).trim());
    let safeNew = path.basename(String(newFileName).trim());
    safeNew = safeNew.replace(/[<>:"/\\|?*]/g, '_').trim();
    if (!safeOld || !safeNew || safeOld === '.' || safeOld === '..' || safeNew === '.' || safeNew === '..') {
      return { success: false, error: 'Μη έγκυρο όνομα αρχείου' };
    }
    if (safeOld === safeNew) {
      return { success: false, error: 'Το νέο όνομα είναι ίδιο με το παλιό' };
    }

    const srcPath = folderId
      ? resolveProposalGroupPath(pid, groupId, folderId, safeOld)
      : resolveProposalGroupPath(pid, groupId, safeOld);
    const destPath = folderId
      ? resolveProposalGroupPath(pid, groupId, folderId, safeNew)
      : resolveProposalGroupPath(pid, groupId, safeNew);

    if (!fs.existsSync(srcPath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    const stat = fs.statSync(srcPath);
    if (!stat.isFile()) return { success: false, error: 'Η εγγραφή δεν είναι αρχείο' };
    if (fs.existsSync(destPath)) {
      return { success: false, error: 'Υπάρχει ήδη αρχείο με αυτό το όνομα' };
    }

    fs.renameSync(srcPath, destPath);

    if (!folderId) {
      const proposal = loadProposal(pid);
      if (!proposal) return { success: false, error: 'Το έργο δεν βρέθηκε' };
      const updatedGroups = (proposal.fileGroups || []).map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          files: (g.files || []).map((f) => {
            if (f.kind === 'folder' || f.name !== safeOld) return f;
            return { ...f, name: safeNew };
          }),
        };
      });
      try {
        safeWriteJSON(getProposalDataPath(pid), {
          ...proposal,
          fileGroups: updatedGroups,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        try { fs.renameSync(destPath, srcPath); } catch { /* ignore rollback */ }
        return { success: false, error: e.message };
      }
    } else {
      reconcileProposalFolderEntry(pid, groupId, folderId);
    }

    logProposalActivity(
      pid,
      'update',
      `Μετονομασία αρχείου: «${safeOld}» → «${safeNew}»`,
      auth.username
    );
    const updatedProposal = loadProposal(pid);
    return {
      success: true,
      oldFileName: safeOld,
      newFileName: safeNew,
      proposal: updatedProposal,
    };
  } catch (e) {
    logger.error('rename-proposal-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-proposal-folder', async (_event, {
  proposalId, groupId, folderId, nextFileGroups, actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !folderId) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId και folderId' };
    }
    if (!Array.isArray(nextFileGroups)) {
      return { success: false, error: 'Απαιτούνται nextFileGroups' };
    }
    const metaRes = atomicUpdateProposalFileGroups(proposalId, nextFileGroups);
    if (!metaRes.success) return metaRes;
    const pid = metaRes.proposalId;
    const folderPath = resolveProposalGroupPath(pid, groupId, folderId);
    try {
      if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
    } catch (e) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: e.message };
    }
    logProposalActivity(pid, 'update', 'Διαγράφηκε φάκελος αρχείων', auth.username);
    return { success: true, proposal: loadProposal(pid) };
  } catch (e) {
    logger.error('delete-proposal-folder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-proposal-group', async (_event, {
  proposalId, groupId, groupLabel, nextFileGroups, actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId) {
      return { success: false, error: 'Απαιτούνται proposalId και groupId' };
    }
    if (!Array.isArray(nextFileGroups)) {
      return { success: false, error: 'Απαιτούνται nextFileGroups' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const pid = idCheck.id;
    const groupPath = path.resolve(path.join(getProposalDir(pid), 'files', groupId));
    const rootResolved = path.resolve(getOrimanthiDir());
    if (!groupPath.startsWith(rootResolved + path.sep)) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }
    const metaRes = atomicUpdateProposalFileGroups(pid, nextFileGroups);
    if (!metaRes.success) return metaRes;
    try {
      if (fs.existsSync(groupPath)) fs.rmSync(groupPath, { recursive: true, force: true });
    } catch (e) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: e.message };
    }
    const label = String(groupLabel || '').trim();
    logProposalActivity(
      pid,
      'update',
      label ? `Διαγράφηκε κατηγορία αρχείων «${label}»` : 'Διαγράφηκε κατηγορία αρχείων',
      auth.username
    );
    return { success: true, proposal: loadProposal(pid) };
  } catch (e) {
    logger.error('delete-proposal-group error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('move-proposal-entry', async (_event, {
  proposalId,
  sourceGroupId,
  targetGroupId,
  entryKind,
  fileName,
  folderId,
  nextFileGroups,
  actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !sourceGroupId || !targetGroupId || !entryKind) {
      return { success: false, error: 'Μη έγκυρες παράμετροι μεταφοράς' };
    }
    if (sourceGroupId === targetGroupId) {
      return { success: false, error: 'Η κατηγορία προορισμού είναι ίδια με την πηγή' };
    }
    if (!Array.isArray(nextFileGroups)) {
      return { success: false, error: 'Απαιτούνται nextFileGroups' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const pid = idCheck.id;

    const metaRes = atomicUpdateProposalFileGroups(pid, nextFileGroups);
    if (!metaRes.success) return metaRes;

    let movedEntry = null;
    try {
      if (entryKind === 'folder') {
        if (!folderId) throw new Error('Απαιτείται folderId');
        const srcPath = resolveProposalGroupPath(pid, sourceGroupId, folderId);
        if (!fs.existsSync(srcPath)) throw new Error('Ο φάκελος δεν βρέθηκε');
        const destPath = resolveProposalGroupPath(pid, targetGroupId, folderId);
        if (fs.existsSync(destPath)) {
          throw new Error('Υπάρχει ήδη φάκελος με το ίδιο όνομα στον προορισμό');
        }
        await fse.move(srcPath, destPath);
        movedEntry = { kind: 'folder', id: folderId };
      } else {
        if (!fileName) throw new Error('Απαιτείται fileName');
        const safeName = path.basename(String(fileName).trim());
        const srcPath = resolveProposalGroupPath(pid, sourceGroupId, safeName);
        if (!fs.existsSync(srcPath)) throw new Error('Το αρχείο δεν βρέθηκε');
        const stat = fs.statSync(srcPath);
        if (!stat.isFile()) throw new Error('Η εγγραφή δεν είναι αρχείο');

        let destName = safeName;
        let destPath = resolveProposalGroupPath(pid, targetGroupId, destName);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const ext = path.extname(safeName);
          const nameNoExt = path.basename(safeName, ext);
          destName = `${nameNoExt}_${counter}${ext}`;
          destPath = resolveProposalGroupPath(pid, targetGroupId, destName);
          counter += 1;
        }
        await fse.move(srcPath, destPath);
        const movedStat = fs.statSync(destPath);
        movedEntry = {
          kind: 'file',
          name: destName,
          originalName: safeName,
          size: movedStat.size,
          uploadedAt: movedStat.mtime.toISOString(),
        };
      }
    } catch (e) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: e.message };
    }

    logProposalActivity(
      pid,
      'update',
      entryKind === 'folder'
        ? 'Μεταφορά φακέλου σε άλλη κατηγορία αρχείων'
        : `Μεταφορά αρχείου «${fileName}» σε άλλη κατηγορία`,
      auth.username
    );

    let finalProposal = loadProposal(pid);
    if (entryKind === 'file' && movedEntry) {
      const safeOrig = path.basename(String(fileName).trim());
      if (movedEntry.name !== safeOrig) {
        const patchedGroups = (finalProposal.fileGroups || []).map((g) => {
          if (g.id !== targetGroupId) return g;
          return {
            ...g,
            files: (g.files || []).map((f) => {
              if (f.kind === 'file' && f.name === safeOrig) return { ...f, name: movedEntry.name };
              return f;
            }),
          };
        });
        safeWriteJSON(getProposalDataPath(pid), {
          ...finalProposal,
          fileGroups: patchedGroups,
          updatedAt: new Date().toISOString(),
        });
        finalProposal = loadProposal(pid);
      }
    }

    return { success: true, proposal: finalProposal, entry: movedEntry };
  } catch (e) {
    logger.error('move-proposal-entry error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-proposal-file', async (_event, { proposalId, groupId, fileName, folderId } = {}) => {
  try {
    if (!proposalId || !groupId || !fileName) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId και fileName' };
    }
    const filePath = folderId
      ? resolveProposalGroupPath(proposalId, groupId, folderId, fileName)
      : resolveProposalGroupPath(proposalId, groupId, fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    const openErr = await shell.openPath(filePath);
    if (openErr) return { success: false, error: openErr };
    return { success: true };
  } catch (e) {
    logger.error('open-proposal-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('download-proposal-file', async (_event, { proposalId, groupId, fileName, folderId } = {}) => {
  try {
    if (!proposalId || !groupId || !fileName) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId και fileName' };
    }
    const filePath = folderId
      ? resolveProposalGroupPath(proposalId, groupId, folderId, fileName)
      : resolveProposalGroupPath(proposalId, groupId, fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };

    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: fileName,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    fs.copyFileSync(filePath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (e) {
    logger.error('download-proposal-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-proposal-folder-files', async (_event, {
  proposalId, groupId, folderId, syncMetadata,
} = {}) => {
  try {
    if (!proposalId || !groupId || !folderId) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId και folderId' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const pid = idCheck.id;

    if (syncMetadata) {
      const reconciled = reconcileProposalFolderEntry(pid, groupId, folderId);
      if (!reconciled.ok) return { success: false, error: reconciled.error };
      return {
        success: true,
        files: reconciled.filesOnDisk,
        proposal: reconciled.proposal,
        folderRemoved: reconciled.removed,
      };
    }

    const files = listProposalFolderFilesOnDisk(pid, groupId, folderId);
    return { success: true, files };
  } catch (e) {
    logger.error('get-proposal-folder-files error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-proposal-files', async (_event, { proposalId, groupId } = {}) => {
  try {
    if (!proposalId || !groupId) return { success: false, error: 'Απαιτούνται proposalId και groupId' };
    const groupDir = resolveProposalGroupPath(proposalId, groupId);
    if (!fs.existsSync(groupDir)) return { success: true, files: [] };
    const entries = fs.readdirSync(groupDir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => ({
        name: e.name,
        size: fs.statSync(path.join(groupDir, e.name)).size,
        uploadedAt: fs.statSync(path.join(groupDir, e.name)).mtime.toISOString()
      }));
    return { success: true, files: entries };
  } catch (e) {
    logger.error('get-proposal-files error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-proposal-folder-file', async (_event, {
  proposalId, groupId, folderId, fileName, nextFileGroups, actingUsername,
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !groupId || !folderId || !fileName) {
      return { success: false, error: 'Απαιτούνται proposalId, groupId, folderId και fileName' };
    }
    if (!Array.isArray(nextFileGroups)) {
      return { success: false, error: 'Απαιτούνται nextFileGroups' };
    }
    const metaRes = atomicUpdateProposalFileGroups(proposalId, nextFileGroups);
    if (!metaRes.success) return metaRes;
    const pid = metaRes.proposalId;
    const filePath = resolveProposalGroupPath(pid, groupId, folderId, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) throw new Error('Η εγγραφή δεν είναι αρχείο');
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: e.message };
    }
    const reconciled = reconcileProposalFolderEntry(pid, groupId, folderId);
    if (!reconciled.ok) {
      rollbackProposalSnapshot(pid, metaRes.previousSnapshot);
      return { success: false, error: reconciled.error };
    }
    logProposalActivity(
      pid,
      'update',
      reconciled.removed
        ? `Διαγράφηκε αρχείο «${fileName}» — ο φάκελος αφαιρέθηκε (ήταν κενός)`
        : `Διαγράφηκε αρχείο «${fileName}» από φάκελο`,
      auth.username
    );
    return {
      success: true,
      proposal: reconciled.proposal,
      folderRemoved: reconciled.removed,
      files: reconciled.filesOnDisk,
    };
  } catch (e) {
    logger.error('delete-proposal-folder-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-proposal', async (_event, { proposalId, includeFiles, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const proposal = loadProposal(idCheck.id);
    if (!proposal) return { success: false, error: 'Το έργο δεν βρέθηκε' };

    const { dialog } = require('electron');
    const pickResult = await dialog.showOpenDialog({
      title: 'Επιλογή φακέλου προορισμού εξαγωγής',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (pickResult.canceled || !pickResult.filePaths?.[0]) {
      return { success: false, canceled: true };
    }

    const actor = getOrimanthiAuditActor(auth.username);
    const exportedByLabel = actor.fullName || auth.username;

    const result = await orimanthiExportHandler.exportProposal({
      proposal,
      proposalId: idCheck.id,
      destParentDir: pickResult.filePaths[0],
      includeFiles: includeFiles !== false,
      appVersion: app.getVersion(),
      exportedBy: exportedByLabel,
      resolveProposalGroupPath,
    });

    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'proposal',
        entityId: idCheck.id,
        entityTitle: proposal.title || '',
        userFullName: actor.fullName,
        userRole: actor.role,
        details: includeFiles !== false
          ? 'Εξαγωγή έργου ωρίμανσης με αρχεία'
          : 'Εξαγωγή έργου ωρίμανσης (Word μόνο)',
      });
    }

    return result;
  } catch (e) {
    logger.error('export-proposal error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('log-proposal-activity', async (_event, { proposalId, details, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!proposalId || !details) return { success: false, error: 'Απαιτούνται proposalId και details' };
    const detailText = String(details).trim();
    if (detailText.length > 500) {
      return { success: false, error: 'Το κείμενο καταγραφής είναι πολύ μεγάλο' };
    }
    const allowed = ALLOWED_CLIENT_PROPOSAL_ACTIVITY.some((re) => re.test(detailText));
    if (!allowed) {
      return { success: false, error: 'Μη επιτρεπτή καταγραφή δραστηριότητας' };
    }
    logProposalActivity(proposalId, 'update', detailText, auth.username);
    return { success: true };
  } catch (e) {
    logger.error('log-proposal-activity error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('clear-proposal-audit-log', async (_event, { proposalId, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminUser(auth.username)) {
      return { success: false, error: 'Μόνο super admin μπορεί να εκκαθαρίσει ιστορικό' };
    }
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };

    const proposal = loadProposal(idCheck.id);
    if (!proposal) return { success: false, error: 'Το έργο δεν βρέθηκε' };

    let auditLog = { logs: [] };
    if (fs.existsSync(auditLogPath)) {
      try {
        auditLog = JSON.parse(fs.readFileSync(auditLogPath, 'utf8'));
      } catch (e) {
        logger.error('clear-proposal-audit-log read error:', e.message);
        return { success: false, error: 'Σφάλμα ανάγνωσης ιστορικού' };
      }
    }

    const logs = auditLog.logs || [];
    const remaining = logs.filter(
      (log) => !(log.entityType === 'proposal' && log.entityId === idCheck.id)
    );
    const deletedCount = logs.length - remaining.length;

    auditLog.logs = remaining;
    safeWriteJSON(auditLogPath, auditLog);

    const actor = getOrimanthiAuditActor(auth.username);
    logAuditAction({
      type: 'delete',
      entityType: 'proposal',
      entityId: idCheck.id,
      entityTitle: proposal.title || '',
      userFullName: actor.fullName,
      userRole: actor.role,
      details: deletedCount > 0
        ? `Εκκαθάριση ιστορικού ωρίμανσης (${deletedCount} καταγραφές)`
        : 'Εκκαθάριση ιστορικού ωρίμανσης (κανένα entry)',
    });

    return { success: true, deletedCount };
  } catch (e) {
    logger.error('clear-proposal-audit-log error:', e.message);
    return { success: false, error: e.message };
  }
});

function searchFilesInKnownFolder(proposalId, groupId, groupLabel, folderId, folderDisplayName, proposalMeta, query, results, seen) {
  let absDir;
  try {
    absDir = resolveProposalGroupPath(proposalId, groupId, folderId);
  } catch {
    return;
  }
  if (!fs.existsSync(absDir)) return;
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.toLowerCase().includes(query)) continue;
    const key = `${proposalId}:${groupId}:${folderId}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      projectId: proposalId,
      projectTitle: proposalMeta.title || '(Χωρίς τίτλο)',
      projectCategory: proposalMeta.projectCategory || '',
      groupId,
      groupLabel,
      entryKind: 'file',
      fileName: name,
      folderId,
      folderDisplayName: folderDisplayName || 'Φάκελος',
      pathHint: `${folderDisplayName || 'Φάκελος'}/${name}`,
    });
  }
}

function searchProposalFilesInMetadata(proposal, query, results, seen) {
  const proposalId = proposal.id;
  for (const group of proposal.fileGroups || []) {
    for (const entry of group.files || []) {
      if (entry.kind === 'folder') {
        const displayName = entry.name || 'Φάκελος';
        if (displayName.toLowerCase().includes(query)) {
          let folderDir;
          try {
            folderDir = resolveProposalGroupPath(proposalId, group.id, entry.id);
          } catch {
            folderDir = null;
          }
          if (folderDir && fs.existsSync(folderDir)) {
            const key = `${proposalId}:${group.id}:folder:${entry.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                projectId: proposalId,
                projectTitle: proposal.title || '(Χωρίς τίτλο)',
                projectCategory: proposal.projectCategory || '',
                groupId: group.id,
                groupLabel: group.label || '',
                entryKind: 'folder',
                fileName: displayName,
                folderId: entry.id,
                pathHint: displayName,
              });
            }
          }
        }
        let folderDirForSearch;
        try {
          folderDirForSearch = resolveProposalGroupPath(proposalId, group.id, entry.id);
        } catch {
          folderDirForSearch = null;
        }
        if (folderDirForSearch && fs.existsSync(folderDirForSearch)) {
          searchFilesInKnownFolder(
            proposalId,
            group.id,
            group.label || '',
            entry.id,
            displayName,
            proposal,
            query,
            results,
            seen
          );
        }
      } else {
        const fileName = entry.name || '';
        if (!fileName.toLowerCase().includes(query)) continue;
        let srcFile;
        try {
          srcFile = resolveProposalGroupPath(proposalId, group.id, fileName);
        } catch {
          continue;
        }
        if (!fs.existsSync(srcFile) || !fs.statSync(srcFile).isFile()) continue;
        const key = `${proposalId}:${group.id}:file:${fileName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          projectId: proposalId,
          projectTitle: proposal.title || '(Χωρίς τίτλο)',
          projectCategory: proposal.projectCategory || '',
          groupId: group.id,
          groupLabel: group.label || '',
          entryKind: 'file',
          fileName,
          folderId: null,
          pathHint: fileName,
        });
      }
    }
  }
}

ipcMain.handle('get-municipal-units-config', async () => {
  try {
    const config = municipalUnitsConfigService.loadMunicipalUnitsConfig(dataDir);
    const logo = municipalUnitsConfigService.getMunicipalityLogoDataUrl(dataDir);
    return {
      success: true,
      config,
      logoDataUrl: logo.dataUrl || null,
    };
  } catch (e) {
    logger.error('get-municipal-units-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-municipal-units-config', async (_event, { units, logoRelativePath, actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!Array.isArray(units)) {
      return { success: false, error: 'Μη έγκυρη λίστα δημοτικών ενοτήτων' };
    }
    const payload = { units };
    if (logoRelativePath !== undefined) payload.logoRelativePath = logoRelativePath;
    const saved = municipalUnitsConfigService.saveMunicipalUnitsConfig(dataDir, payload);
    const actor = findUserByUsername(actingUsername);
    logAuditAction({
      type: 'update',
      entityType: 'municipalUnitsConfig',
      entityId: 'municipal-units',
      entityTitle: 'Δημοτικές Ενότητες',
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'SUPERADMIN',
      details: `Ενημέρωση λίστας (${saved.units.length} ενότητες)${saved.logoRelativePath ? ' · λογότυπο' : ''}`,
    });
    const logo = municipalUnitsConfigService.getMunicipalityLogoDataUrl(dataDir);
    return { success: true, config: saved, logoDataUrl: logo.dataUrl || null };
  } catch (e) {
    logger.error('save-municipal-units-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-municipality-logo', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const pick = await dialog.showOpenDialog({
      title: 'Επιλογή λογοτύπου δήμου',
      properties: ['openFile'],
      filters: [{ name: 'Εικόνες', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (pick.canceled || !pick.filePaths?.length) {
      return { success: true, canceled: true };
    }
    return { success: true, canceled: false, filePath: pick.filePaths[0] };
  } catch (e) {
    logger.error('select-municipality-logo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-municipality-logo', async (_event, { actingUsername, sourcePath } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const result = await municipalUnitsConfigService.saveMunicipalityLogo(dataDir, {
      sourcePath,
      fileName: sourcePath ? path.basename(sourcePath) : 'logo.jpg',
    });
    if (!result.success) return result;
    const actor = findUserByUsername(actingUsername);
    logAuditAction({
      type: 'update',
      entityType: 'municipalUnitsConfig',
      entityId: 'municipality-logo',
      entityTitle: 'Λογότυπο Δήμου',
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'SUPERADMIN',
      details: 'Αποθήκευση λογοτύπου δήμου',
    });
    const logo = municipalUnitsConfigService.getMunicipalityLogoDataUrl(dataDir);
    return {
      success: true,
      config: result.config,
      relativePath: result.relativePath,
      logoDataUrl: logo.dataUrl || null,
    };
  } catch (e) {
    logger.error('save-municipality-logo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('clear-municipality-logo', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminUser(actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const result = municipalUnitsConfigService.clearMunicipalityLogo(dataDir);
    const actor = findUserByUsername(actingUsername);
    logAuditAction({
      type: 'update',
      entityType: 'municipalUnitsConfig',
      entityId: 'municipality-logo',
      entityTitle: 'Λογότυπο Δήμου',
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'SUPERADMIN',
      details: 'Διαγραφή λογοτύπου δήμου',
    });
    return { success: true, config: result.config, logoDataUrl: null };
  } catch (e) {
    logger.error('clear-municipality-logo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-email-send-history', async (_event, { actingUsername } = {}) => {
  try {
    if (!isSuperAdminOrAdminUser(actingUsername || loggedInUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    const history = procurementCalendarReminderService.loadEmailHistory(dataDir);
    return { success: true, entries: history.entries || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-calendar-config', async (_event, { actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminOrAdminUser(auth.username)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    return { success: true, config: calendarConfigService.loadCalendarConfig(dataDir) };
  } catch (e) {
    logger.error('get-calendar-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-calendar-config', async (_event, { config, actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminOrAdminUser(auth.username)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'Μη έγκυρες ρυθμίσεις' };
    }
    const saved = calendarConfigService.saveCalendarConfig(dataDir, config);
    const actor = findUserByUsername(auth.username);
    logAuditAction({
      type: 'update',
      entityType: 'calendarConfig',
      entityId: 'procurement-calendar',
      entityTitle: 'Ρυθμίσεις Ημερολογίου',
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'SUPERADMIN',
      details: `Ενημέρωση ρυθμίσεων ημερολογίου (ενεργό: ${saved.enabled ? 'ναι' : 'όχι'})`,
    });
    return { success: true, config: saved };
  } catch (e) {
    logger.error('save-calendar-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-calendar-custom-events', async (_event, { actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = findUserByUsername(auth.username);
    if (!actor) return { success: false, error: 'Μη έγκυρος χρήστης' };
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const events = calendarCustomEventsService.listEventsForUser(dataDir, actor);
    return { success: true, events };
  } catch (e) {
    logger.error('get-calendar-custom-events error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-calendar-custom-event', async (_event, { event, actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminOrAdminUser(auth.username)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const actor = findUserByUsername(auth.username);
    const isUpdate = !!(event && event.id);
    const result = calendarCustomEventsService.upsertEvent(dataDir, event, actor);
    if (!result.success) return result;
    logAuditAction({
      type: isUpdate ? 'update' : 'create',
      entityType: 'calendarCustomEvent',
      entityId: result.event.id,
      entityTitle: result.event.title,
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'ADMIN',
      details: `${isUpdate ? 'Ενημέρωση' : 'Δημιουργία'} ειδοποίησης ημερολογίου`,
    });
    return result;
  } catch (e) {
    logger.error('save-calendar-custom-event error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-calendar-custom-event', async (_event, { eventId, actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminOrAdminUser(auth.username)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const actor = findUserByUsername(auth.username);
    const result = calendarCustomEventsService.deleteEvent(dataDir, eventId, actor);
    if (!result.success) return result;
    logAuditAction({
      type: 'delete',
      entityType: 'calendarCustomEvent',
      entityId: String(eventId || ''),
      entityTitle: 'Ειδοποίηση ημερολογίου',
      userFullName: actor?.fullName || actingUsername || '',
      userRole: actor?.role || 'ADMIN',
      details: 'Διαγραφή ειδοποίησης ημερολογίου',
    });
    return result;
  } catch (e) {
    logger.error('delete-calendar-custom-event error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('send-test-procurement-calendar-reminder', async (_event, { actingUsername } = {}) => {
  try {
    const auth = resolveTaskActingUser(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!isSuperAdminOrAdminUser(auth.username)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα' };
    }
    if (!dataDir) return { success: false, error: 'Δεν είναι διαθέσιμος φάκελος δεδομένων' };
    const actor = findUserByUsername(auth.username);
    const toEmail = String(actor?.email || '').trim();
    if (!toEmail.includes('@')) {
      return { success: false, error: 'Δεν υπάρχει email στο προφίλ σας' };
    }
    return await procurementCalendarReminderService.sendTestProcurementCalendarReminder({
      dataDir,
      loadUsers,
      loadAllProjects,
      loadAllProskliseis,
      toEmail,
    });
  } catch (e) {
    logger.error('send-test-procurement-calendar-reminder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-orimanthi-config', async () => {
  try {
    return { success: true, config: orimanthiConfigService.loadOrimanthiConfig(dataDir) };
  } catch (e) {
    logger.error('get-orimanthi-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-orimanthi-config', async (_event, { config, actingUsername } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'Μη έγκυρες ρυθμίσεις' };
    }
    const current = orimanthiConfigService.loadOrimanthiConfig(dataDir);
    const merged = {
      pendingTemplates: { ...current.pendingTemplates, ...(config.pendingTemplates || {}) },
      aepoReminders: { ...current.aepoReminders, ...(config.aepoReminders || {}) },
      customProjectCategories: current.customProjectCategories,
      customCategorySpecializations: current.customCategorySpecializations,
    };
    if (Array.isArray(config.customProjectCategories)) {
      merged.customProjectCategories = config.customProjectCategories
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    }
    if (config.customCategorySpecializations && typeof config.customCategorySpecializations === 'object') {
      merged.customCategorySpecializations = {};
      Object.entries(config.customCategorySpecializations).forEach(([cat, specs]) => {
        const label = String(cat || '').trim();
        if (!label) return;
        merged.customCategorySpecializations[label] = Array.isArray(specs)
          ? specs.map((x) => String(x || '').trim()).filter(Boolean)
          : [];
      });
    }
    orimanthiConfigService.saveOrimanthiConfig(dataDir, merged);
    return { success: true, config: merged };
  } catch (e) {
    logger.error('save-orimanthi-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apply-orimanthi-pending-template', async (_event, {
  proposalId, category, actingUsername, action = 'apply',
} = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const idCheck = assertValidProposalId(proposalId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const proposal = loadProposal(idCheck.id);
    if (!proposal) return { success: false, error: 'Το έργο δεν βρέθηκε' };
    const config = orimanthiConfigService.loadOrimanthiConfig(dataDir);
    const cat = String(category || proposal.projectCategory || '').trim();
    const templateTexts = orimanthiConfigService.getPendingTemplateForCategory(config, cat);
    if (!templateTexts.length) {
      return { success: false, error: `Δεν υπάρχει πρότυπο εκκρεμοτήτων για την κατηγορία «${cat || '—'}»` };
    }

    if (action === 'remove') {
      const beforeCount = (proposal.pendingItems || []).length;
      const pendingItems = orimanthiConfigService.removePendingTemplateItems(
        proposal.pendingItems || [],
        cat
      );
      const removedCount = beforeCount - pendingItems.length;
      const toSave = {
        ...proposal,
        pendingItems,
        pendingTemplateCategory: orimanthiProjectCategoriesHelper.categoriesAreEquivalent(
          proposal.pendingTemplateCategory,
          cat
        ) ? '' : (proposal.pendingTemplateCategory || ''),
        updatedAt: new Date().toISOString(),
      };
      safeWriteJSON(getProposalDataPath(idCheck.id), toSave);
      const actor = getOrimanthiAuditActor(auth.username);
      logAuditAction({
        type: 'update',
        entityType: 'proposal',
        entityId: idCheck.id,
        entityTitle: proposal.title || '',
        userFullName: actor.fullName,
        userRole: actor.role,
        details: removedCount > 0
          ? `Αφαίρεση προτύπου εκκρεμοτήτων (${cat}) — ${removedCount} στοιχεία`
          : `Αφαίρεση προτύπου εκκρεμοτήτων (${cat}) — καμία αλλαγή`,
      });
      return { success: true, proposal: toSave, removedCount, action: 'remove' };
    }

    const pendingItems = orimanthiConfigService.mergePendingTemplateItems(
      proposal.pendingItems || [],
      templateTexts,
      cat
    );
    const addedCount = pendingItems.length - (proposal.pendingItems || []).length;
    const finalItems = addedCount === 0
      ? orimanthiConfigService.reTagExistingTemplateItems(pendingItems, cat, templateTexts)
      : pendingItems;
    const toSave = {
      ...proposal,
      pendingItems: finalItems,
      pendingTemplateCategory: cat,
      updatedAt: new Date().toISOString(),
    };
    if (addedCount === 0 && !orimanthiConfigService.isPendingTemplateApplied(proposal, cat, templateTexts)) {
      return {
        success: true,
        proposal,
        addedCount: 0,
        action: 'apply',
        message: 'Δεν βρέθηκαν νέες εκκρεμότητες προς προσθήκη από το πρότυπο',
      };
    }
    safeWriteJSON(getProposalDataPath(idCheck.id), toSave);
    const actor = getOrimanthiAuditActor(auth.username);
    logAuditAction({
      type: 'update',
      entityType: 'proposal',
      entityId: idCheck.id,
      entityTitle: proposal.title || '',
      userFullName: actor.fullName,
      userRole: actor.role,
      details: addedCount > 0
        ? `Εφαρμογή προτύπου εκκρεμοτήτων (${cat}) — ${addedCount} νέα στοιχεία`
        : `Εφαρμογή προτύπου εκκρεμοτήτων (${cat})`,
    });
    return { success: true, proposal: toSave, addedCount, action: 'apply' };
  } catch (e) {
    logger.error('apply-orimanthi-pending-template error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-orimanthi-aepo-alerts', async (_event, { limit = 5, maxDays = 90 } = {}) => {
  try {
    const proposals = loadAllProposalsList();
    const { alerts, total } = orimanthiAepoReminderService.computeAepoAlerts(proposals, { limit, maxDays });
    return { success: true, alerts, total };
  } catch (e) {
    logger.error('get-orimanthi-aepo-alerts error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-orimanthi-hub-report', async (_event, { format, actingUsername, proposalIds } = {}) => {
  try {
    const auth = requireOrimanthiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const fmt = format === 'pdf' ? 'pdf' : 'excel';
    const allProposals = loadAllProposalsList();
    let proposals = allProposals;
    if (Array.isArray(proposalIds) && proposalIds.length > 0) {
      const idSet = new Set(proposalIds.filter(Boolean));
      proposals = allProposals.filter((p) => idSet.has(p.id));
    }
    const { dialog } = require('electron');
    const defaultName = fmt === 'pdf'
      ? `Αναφορά_Ωρίμανσης_${new Date().toISOString().slice(0, 10)}.pdf`
      : `Αναφορά_Ωρίμανσης_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αναφοράς Hub Ωρίμανσης',
      defaultPath: defaultName,
      filters: fmt === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    const actor = getOrimanthiAuditActor(auth.username);
    const result = await orimanthiExportHandler.exportHubReport({
      proposals,
      format: fmt,
      destFilePath: pick.filePath,
      exportedBy: actor.fullName || auth.username,
      appVersion: app.getVersion(),
    });
    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'orimanthi_hub',
        entityId: 'hub',
        entityTitle: 'Αναφορά Hub Ωρίμανσης',
        userFullName: actor.fullName,
        userRole: actor.role,
        details: fmt === 'pdf' ? 'Εξαγωγή αναφοράς Hub (PDF)' : 'Εξαγωγή αναφοράς Hub (Excel)',
      });
    }
    return result;
  } catch (e) {
    logger.error('export-orimanthi-hub-report error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('search-proposal-files', async (_event, { query } = {}) => {
  try {
    const q = String(query || '').trim().toLowerCase();
    if (!q || q.length < 2) return { success: true, results: [] };
    const root = ensureOrimanthiDir();
    const results = [];
    const seen = new Set();
    const entries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const entry of entries) {
      const proposalId = entry.name;
      const proposal = loadProposal(proposalId);
      if (!proposal) continue;
      searchProposalFilesInMetadata(proposal, q, results, seen);
    }
    results.sort((a, b) =>
      a.fileName.localeCompare(b.fileName, 'el') ||
      a.projectTitle.localeCompare(b.projectTitle, 'el')
    );
    return { success: true, results: results.slice(0, 200) };
  } catch (e) {
    logger.error('search-proposal-files error:', e.message);
    return { success: false, error: e.message };
  }
});

// ─── ΜΗΤΡΩΟ ΜΕΛΕΤΩΝ ───────────────────────────────────────────────────────────

const meletaiConfigService = require('./meletaiConfigService');
const meletaiExportHandler = require('./meletaiExportHandler');
const khmdhsPortfolioExportHandler = require('./khmdhsPortfolioExportHandler');
const statisticsExportHandler = require('./statisticsExportHandler');
// createMeletaiService + DATA_DIR_SKIP_ROOT_DIRS: require στην κορυφή του αρχείου

let meletaiService = null;

function getMeletaiService() {
  if (!meletaiService && dataDir) {
    meletaiService = createMeletaiService({ dataDir });
  }
  return meletaiService;
}

function canManageMeletaiRole(role) {
  return role === 'SUPERADMIN' || role === 'ADMIN';
}

function canViewMeletaiRole(role) {
  return canManageMeletaiRole(role) || role === 'USER' || role === 'ENGINEER';
}

function requireMeletaiSession(actingUsername) {
  const auth = resolveTaskActingUser(actingUsername);
  if (!auth.ok) return auth;
  const user = findUserByUsername(auth.username);
  if (!user || user.active === false || user.approved === false) {
    return { ok: false, error: 'Δεν έχετε πρόσβαση στο σύστημα' };
  }
  if (!canViewMeletaiRole(user.role)) {
    return { ok: false, error: 'Δεν έχετε πρόσβαση στο μητρώο μελετών' };
  }
  return { ok: true, username: auth.username, user };
}

function requireMeletaiManage(actingUsername) {
  const session = requireMeletaiSession(actingUsername);
  if (!session.ok) return session;
  if (!canManageMeletaiUser(session.user)) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας μελετών' };
  }
  return session;
}

function getMeletaiAuditActor(actingUsername) {
  const user = findUserByUsername(actingUsername);
  return {
    fullName: (user?.fullName || '').trim() || actingUsername || '',
    role: user?.role || 'USER',
  };
}

function requireMeletiEntityLock(meletiId, actingUsername) {
  const id = String(meletiId || '').trim();
  if (!id) return { ok: true };
  const lockStatus = isEntityLocked('meleti', id);
  if (!lockStatus.locked) return { ok: true };
  try {
    const lockFile = path.join(dataDir, 'locks', 'meleti', `${id}.lock`);
    if (fs.existsSync(lockFile)) {
      const lockData = readLockData(lockFile);
      const acting = String(actingUsername || '').trim();
      if (lockData && lockData.username === acting) return { ok: true };
    }
  } catch { /* ignore */ }
  return {
    ok: false,
    error: `Η μελέτη είναι κλειδωμένη από ${lockStatus.lockedBy || 'άλλον χρήστη'}`,
    locked: true,
    lockedBy: lockStatus.lockedBy,
  };
}

function meletaiEngineerChargeFilterKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return lower.startsWith('user:') ? lower : `user:${lower}`;
}

function meletaiFreeChargeFilterKey(text) {
  const t = String(text || '').trim().toLowerCase();
  return t ? `free:${t}` : '';
}

function findSubprojectDataById(subprojectId) {
  const sid = String(subprojectId || '').trim();
  if (!sid || !dataDir || !fs.existsSync(dataDir)) return null;

  // Γρήγορη διαδρομή μέσω ευρετηρίου
  try {
    const indexedPath = projectsIndex.findIndexedSubprojectPath(dataDir, sid);
    if (indexedPath) {
      try {
        const data = JSON.parse(fs.readFileSync(indexedPath, 'utf8'));
        if (!data.subprojectId || data.subprojectId === sid) return data;
      } catch { /* fallback to scan */ }
    }
  } catch { /* fallback */ }

  for (const dir of fs.readdirSync(dataDir)) {
    if (DATA_DIR_SKIP_ROOT_DIRS.has(dir)) continue;
    const projectPath = path.join(dataDir, dir);
    try {
      if (!fs.statSync(projectPath).isDirectory()) continue;
    } catch { continue; }
    const directJson = path.join(projectPath, sid, 'data.json');
    if (fs.existsSync(directJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(directJson, 'utf8'));
        if (!data.subprojectId || data.subprojectId === sid) return data;
      } catch { /* skip */ }
    }
    for (const sub of fs.readdirSync(projectPath)) {
      const jsonPath = path.join(projectPath, sub, 'data.json');
      if (!fs.existsSync(jsonPath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (data.subprojectId === sid) return data;
      } catch { /* skip */ }
    }
  }
  return null;
}

function getSubprojectChargeFilterKeys(subproject) {
  if (!subproject) return [];
  const keys = new Set();
  const ids = Array.isArray(subproject.supervisorEngineerIds)
    ? subproject.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const freeP = String(subproject.supervisorChargeFreePrimary || '').trim();
  const freePart = String(subproject.supervisorChargeFreeParticipants || '').trim();
  const outsideMode = subproject.outsideEngineerCharge === true
    || subproject.outsideEngineerCharge === 1
    || String(subproject.outsideEngineerCharge || '').toLowerCase() === 'true';
  ids.forEach((id) => {
    const k = meletaiEngineerChargeFilterKey(id);
    if (k) keys.add(k);
  });
  if (outsideMode || ids.length === 0) {
    const fp = meletaiFreeChargeFilterKey(freeP);
    if (fp) keys.add(fp);
  }
  if (freePart) {
    freePart.split(/\n|·/).map((s) => s.trim()).filter(Boolean).forEach((part) => {
      const pk = meletaiFreeChargeFilterKey(part);
      if (pk) keys.add(pk);
    });
  }
  return [...keys];
}

function buildEngineerVisibilityKeys(user) {
  const keys = new Set();
  const username = String(user?.username || '').trim().toLowerCase();
  if (username) keys.add(`user:${username}`);
  (Array.isArray(user?.assignedSupervisors) ? user.assignedSupervisors : []).forEach((label) => {
    const fk = meletaiFreeChargeFilterKey(label);
    if (fk) keys.add(fk);
  });
  return keys;
}

/** Έλεγχος δικαιώματος εξαγωγής στατιστικών — μηχανικοί μόνο στο εύρος χρέωσής τους. */
function assertStatisticsExportPermission(user, { scopeSubprojectIds } = {}) {
  if (!user || user.approved === false) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα εξαγωγής' };
  }
  const role = String(user.role || 'USER').toUpperCase();
  if (!['SUPERADMIN', 'ADMIN', 'USER', 'ENGINEER'].includes(role)) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα εξαγωγής' };
  }
  if (role !== 'ENGINEER') return { ok: true, role };

  const ids = Array.isArray(scopeSubprojectIds)
    ? [...new Set(scopeSubprojectIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
  if (!ids.length) {
    return { ok: false, error: 'Κενό εύρος εξαγωγής' };
  }
  const ctx = buildEngineerVisibilityContext(user.username, user.assignedSupervisors);
  for (const sid of ids) {
    const sp = findSubprojectDataById(sid);
    if (!sp || !projectVisibleToEngineerContext(sp, ctx)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα εξαγωγής για μέρος των δεδομένων' };
    }
  }
  return { ok: true, role };
}

function canEngineerLinkMeletiSubproject(user, subprojectId) {
  if (user?.role !== 'ENGINEER') return { ok: true };
  const sid = String(subprojectId || '').trim();
  if (!sid) return { ok: true };
  const sp = findSubprojectDataById(sid);
  if (!sp) return { ok: false, error: 'Το υποέργο δεν βρέθηκε' };
  const userKeys = buildEngineerVisibilityKeys(user);
  const projectKeys = getSubprojectChargeFilterKeys(sp);
  const match = projectKeys.some((pk) => userKeys.has(String(pk).toLowerCase()));
  if (!match) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα σύνδεσης με αυτό το υποέργο' };
  }
  return { ok: true };
}

ipcMain.handle('load-all-meletai', async (_event, { actingUsername, skipMaintenance } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    if (!svc) return { success: false, error: 'Δεν έχει ρυθμιστεί φάκελος δεδομένων' };
    if (!skipMaintenance) {
      const { migration, cleared } = svc.runMeletaiMaintenance();
      if (migration.formatFixed > 0 || migration.duplicatesResolved > 0) {
        console.log(`[meletai] Migration: formatFixed=${migration.formatFixed}, duplicatesResolved=${migration.duplicatesResolved}`);
      }
      if (Array.isArray(cleared) && cleared.length > 0) {
        cleared.forEach(({ previous, meleti }) => {
          logAuditAction({
            type: 'update',
            entityType: 'meleti',
            entityId: meleti.id,
            entityTitle: `${meleti.studyNumber} — ${meleti.title}`,
            userFullName: 'Σύστημα',
            userRole: 'SYSTEM',
            details: 'Αυτόματη αποσύνδεση — το συνδεδεμένο υποέργο δεν υπάρχει πλέον',
            oldValue: svc.pickAuditSnapshot(previous),
            newValue: svc.pickAuditSnapshot(meleti),
          });
        });
      }
    }
    return { success: true, meletai: svc.loadAllMeletai() };
  } catch (e) {
    logger.error('load-all-meletai error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('run-meletai-maintenance', async (_event, { actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    if (!svc) return { success: false, error: 'Δεν έχει ρυθμιστεί φάκελος δεδομένων' };
    const { migration, cleared } = svc.runMeletaiMaintenance();
    if (Array.isArray(cleared) && cleared.length > 0) {
      cleared.forEach(({ previous, meleti }) => {
        logAuditAction({
          type: 'update',
          entityType: 'meleti',
          entityId: meleti.id,
          entityTitle: `${meleti.studyNumber} — ${meleti.title}`,
          userFullName: 'Σύστημα',
          userRole: 'SYSTEM',
          details: 'Αυτόματη αποσύνδεση — το συνδεδεμένο υποέργο δεν υπάρχει πλέον',
          oldValue: svc.pickAuditSnapshot(previous),
          newValue: svc.pickAuditSnapshot(meleti),
        });
      });
    }
    return {
      success: true,
      formatFixed: migration.formatFixed,
      duplicatesResolved: migration.duplicatesResolved,
      orphansCleared: cleared.length,
    };
  } catch (e) {
    logger.error('run-meletai-maintenance error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-meletai-subprojects', async (_event, { actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    if (!svc) return { success: false, error: 'Δεν έχει ρυθμιστεί φάκελος δεδομένων' };
    return { success: true, data: svc.listAllSubprojectsBrief() };
  } catch (e) {
    logger.error('get-meletai-subprojects error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('check-meleti-number', async (_event, { studyNumber, excludeId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    const result = svc.checkStudyNumberAvailable(studyNumber, excludeId || null);
    return { success: true, ...result };
  } catch (e) {
    logger.error('check-meleti-number error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-meleti', async (_event, { meleti, actingUsername, expectedUpdatedAt } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    const existing = meleti?.id ? svc.loadMeleti(meleti.id) : null;
    if (existing) {
      const lockCheck = requireMeletiEntityLock(meleti.id, auth.username);
      if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    } else if (meleti?.linkedSubprojectId) {
      const engineerCheck = canEngineerLinkMeletiSubproject(auth.user, meleti.linkedSubprojectId);
      if (!engineerCheck.ok) return { success: false, error: engineerCheck.error };
    }
    const result = await svc.saveMeleti(meleti, { expectedUpdatedAt });
    if (!result.success) return result;

    const actor = getMeletaiAuditActor(auth.username);
    if (result.isNew) {
      logAuditAction({
        type: 'create',
        entityType: 'meleti',
        entityId: result.meleti.id,
        entityTitle: `${result.meleti.studyNumber} — ${result.meleti.title}`,
        userFullName: actor.fullName,
        userRole: actor.role,
        details: 'Δημιουργία νέας μελέτης',
      });
    } else if (result.previous) {
      logAuditAction({
        type: 'update',
        entityType: 'meleti',
        entityId: result.meleti.id,
        entityTitle: `${result.meleti.studyNumber} — ${result.meleti.title}`,
        userFullName: actor.fullName,
        userRole: actor.role,
        oldValue: svc.pickAuditSnapshot(result.previous),
        newValue: svc.pickAuditSnapshot(result.meleti),
      });
    }
    return result;
  } catch (e) {
    logger.error('save-meleti error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-meleti', async (_event, { meletiId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    const svc = getMeletaiService();
    const result = await svc.deleteMeleti(meletiId);
    if (result.success) {
      const actor = getMeletaiAuditActor(auth.username);
      logAuditAction({
        type: 'delete',
        entityType: 'meleti',
        entityId: meletiId,
        entityTitle: result.meleti ? `${result.meleti.studyNumber} — ${result.meleti.title}` : meletiId,
        userFullName: actor.fullName,
        userRole: actor.role,
        details: 'Διαγραφή μελέτης',
      });
    }
    return result;
  } catch (e) {
    logger.error('delete-meleti error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('link-meleti-subproject', async (_event, { meletiId, subprojectId, projectTitle, subprojectTitle, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    if (subprojectId) {
      const engineerCheck = canEngineerLinkMeletiSubproject(auth.user, subprojectId);
      if (!engineerCheck.ok) return { success: false, error: engineerCheck.error };
    }
    const svc = getMeletaiService();
    const result = await svc.linkSubproject(meletiId, subprojectId, projectTitle, subprojectTitle);
    if (result.success) {
      const actor = getMeletaiAuditActor(auth.username);
      logAuditAction({
        type: 'update',
        entityType: 'meleti',
        entityId: meletiId,
        entityTitle: `${result.meleti.studyNumber} — ${result.meleti.title}`,
        userFullName: actor.fullName,
        userRole: actor.role,
        details: subprojectId
          ? `Σύνδεση με υποέργο: ${subprojectTitle || subprojectId}`
          : 'Αποσύνδεση υποέργου',
      });
    }
    return result;
  } catch (e) {
    logger.error('link-meleti-subproject error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('unlink-meleti-subproject', async (_event, { meletiId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    const svc = getMeletaiService();
    const result = await svc.unlinkSubproject(meletiId);
    if (result.success) {
      const actor = getMeletaiAuditActor(auth.username);
      logAuditAction({
        type: 'update',
        entityType: 'meleti',
        entityId: meletiId,
        entityTitle: `${result.meleti.studyNumber} — ${result.meleti.title}`,
        userFullName: actor.fullName,
        userRole: actor.role,
        details: 'Αποσύνδεση υποέργου',
        oldValue: svc.pickAuditSnapshot(result.previous),
        newValue: svc.pickAuditSnapshot(result.meleti),
      });
    }
    return result;
  } catch (e) {
    logger.error('unlink-meleti-subproject error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-meleti-by-subproject', async (_event, { subprojectId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const svc = getMeletaiService();
    const meleti = svc.getMeletiBySubprojectId(subprojectId);
    return { success: true, meleti };
  } catch (e) {
    logger.error('get-meleti-by-subproject error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-meletai-config', async (_event, { actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const config = meletaiConfigService.loadMeletaiConfig(dataDir);
    return { success: true, config };
  } catch (e) {
    logger.error('get-meletai-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-meletai-config', async (_event, { config, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const saved = meletaiConfigService.saveMeletaiConfig(dataDir, config);
    return { success: true, config: saved };
  } catch (e) {
    logger.error('save-meletai-config error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('add-meletai-study-category', async (_event, { label, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    return meletaiConfigService.addStudyCategory(dataDir, label);
  } catch (e) {
    logger.error('add-meletai-study-category error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('remove-meletai-study-category', async (_event, { label, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const configResult = meletaiConfigService.removeStudyCategory(dataDir, label);
    if (!configResult.success) return configResult;
    const svc = getMeletaiService();
    const cleared = svc ? svc.clearStudyCategoryFromAllMeletai(label) : { updated: 0 };
    return { ...configResult, meletaiCategoryCleared: cleared.updated || 0 };
  } catch (e) {
    logger.error('remove-meletai-study-category error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('add-meleti-file-group', async (_event, { meletiId, label, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().addFileGroup(meletiId, label);
  } catch (e) {
    logger.error('add-meleti-file-group error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('upload-meleti-files', async (_event, { meletiId, groupId, files, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().uploadFiles(meletiId, groupId || null, files);
  } catch (e) {
    logger.error('upload-meleti-files error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('upload-meleti-folder', async (_event, { meletiId, groupId, folderName, files, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().uploadFolder(meletiId, groupId || null, folderName, files);
  } catch (e) {
    logger.error('upload-meleti-folder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-meleti-file', async (_event, { meletiId, groupId, fileName, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().deleteFile(meletiId, groupId, fileName);
  } catch (e) {
    logger.error('delete-meleti-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-meleti-folder', async (_event, { meletiId, groupId, folderId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().deleteFolder(meletiId, groupId, folderId);
  } catch (e) {
    logger.error('delete-meleti-folder error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-meleti-folder-file', async (_event, { meletiId, groupId, folderId, fileName, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().deleteFolderFile(meletiId, groupId, folderId, fileName);
  } catch (e) {
    logger.error('delete-meleti-folder-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('rename-meleti-file', async (_event, { meletiId, groupId, oldName, newName, folderId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().renameFile(meletiId, groupId, oldName, newName, folderId || null);
  } catch (e) {
    logger.error('rename-meleti-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-meleti-group', async (_event, { meletiId, groupId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const lockCheck = requireMeletiEntityLock(meletiId, auth.username);
    if (!lockCheck.ok) return { success: false, error: lockCheck.error, locked: true, lockedBy: lockCheck.lockedBy };
    return await getMeletaiService().deleteGroup(meletiId, groupId);
  } catch (e) {
    logger.error('delete-meleti-group error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-meleti-folder-files', async (_event, { meletiId, groupId, folderId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    return getMeletaiService().getFolderFiles(meletiId, groupId, folderId);
  } catch (e) {
    logger.error('get-meleti-folder-files error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-meleti-file', async (_event, { meletiId, groupId, fileName, folderId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const fp = getMeletaiService().getFilePath(meletiId, groupId, fileName, folderId);
    if (!fp.success) return fp;
    await shell.openPath(fp.filePath);
    return { success: true };
  } catch (e) {
    logger.error('open-meleti-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('download-meleti-file', async (_event, { meletiId, groupId, fileName, folderId, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiSession(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const fp = getMeletaiService().getFilePath(meletiId, groupId, fileName, folderId);
    if (!fp.success) return fp;
    const { dialog } = require('electron');
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου',
      defaultPath: fileName,
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    fs.copyFileSync(fp.filePath, pick.filePath);
    return { success: true, filePath: pick.filePath };
  } catch (e) {
    logger.error('download-meleti-file error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-meletai-hub-report', async (_event, { format, meletiIds, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const fmt = format === 'pdf' ? 'pdf' : 'excel';
    let meletai = getMeletaiService().loadAllMeletai();
    if (Array.isArray(meletiIds) && meletiIds.length > 0) {
      const idSet = new Set(meletiIds.map((id) => String(id || '').trim()).filter(Boolean));
      meletai = meletai.filter((m) => idSet.has(m.id));
    }
    const { dialog } = require('electron');
    const defaultName = fmt === 'pdf'
      ? `Αναφορά_Μελετών_${new Date().toISOString().slice(0, 10)}.pdf`
      : `Αναφορά_Μελετών_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αναφοράς Μητρώου Μελετών',
      defaultPath: defaultName,
      filters: fmt === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    const actor = getMeletaiAuditActor(auth.username);
    const result = await meletaiExportHandler.exportHubReport({
      meletai,
      format: fmt,
      destFilePath: pick.filePath,
      exportedBy: actor.fullName || auth.username,
      appVersion: app.getVersion(),
    });
    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'meletai_hub',
        entityId: 'hub',
        entityTitle: 'Αναφορά Μητρώου Μελετών',
        userFullName: actor.fullName,
        userRole: actor.role,
        details: fmt === 'pdf' ? 'Εξαγωγή αναφοράς Hub (PDF)' : 'Εξαγωγή αναφοράς Hub (Excel)',
      });
    }
    return result;
  } catch (e) {
    logger.error('export-meletai-hub-report error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-meletai-study-report', async (_event, { meletiId, format, actingUsername } = {}) => {
  try {
    const auth = requireMeletaiManage(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const fmt = format === 'pdf' ? 'pdf' : 'excel';
    const inventoryResult = getMeletaiService().buildFileInventory(meletiId);
    if (!inventoryResult.success) return inventoryResult;
    const meleti = inventoryResult.meleti;
    const safeNumber = String(meleti.studyNumber || 'μελέτη').replace(/[<>:"/\\|?*]/g, '_');
    const { dialog } = require('electron');
    const defaultName = fmt === 'pdf'
      ? `Μελέτη_${safeNumber}_${new Date().toISOString().slice(0, 10)}.pdf`
      : `Μελέτη_${safeNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αναφοράς μελέτης',
      defaultPath: defaultName,
      filters: fmt === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    const actor = getMeletaiAuditActor(auth.username);
    const result = await meletaiExportHandler.exportStudyReport({
      meleti,
      fileInventory: inventoryResult.rows,
      format: fmt,
      destFilePath: pick.filePath,
      exportedBy: actor.fullName || auth.username,
      appVersion: app.getVersion(),
    });
    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'meleti',
        entityId: meleti.id,
        entityTitle: meleti.title || meleti.studyNumber || 'Μελέτη',
        userFullName: actor.fullName,
        userRole: actor.role,
        details: fmt === 'pdf' ? 'Εξαγωγή αναφοράς μελέτης (PDF)' : 'Εξαγωγή αναφοράς μελέτης (Excel)',
      });
    }
    return result;
  } catch (e) {
    logger.error('export-meletai-study-report error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-portfolio-report', async (_event, { reportType, stats, actingUsername, filterNote, projectCount, scopeSubprojectIds } = {}) => {
  try {
    const user = findUserByUsername(actingUsername);
    const perm = assertStatisticsExportPermission(user, { scopeSubprojectIds });
    if (!perm.ok) {
      return { success: false, error: perm.error };
    }
    const config = loadConfig();
    const org = config.organizationFullName || config.organizationName || '';
    const date = new Date().toISOString().slice(0, 10);
    const defaultNames = {
      portfolio: `Αναφορά_Χαρτοφυλακίου_${date}.pdf`,
      gaps: `Κενά_Αλυσίδας_ΚΗΜΔΗΣ_${date}.pdf`,
      financial: `Οικονομική_Αναφορά_${date}.pdf`,
    };
    const type = ['portfolio', 'gaps', 'financial'].includes(reportType) ? reportType : 'portfolio';
    const { dialog } = require('electron');
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αναφοράς PDF',
      defaultPath: defaultNames[type],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };

    const result = await khmdhsPortfolioExportHandler.exportPortfolioReport({
      reportType: type,
      stats: stats || {},
      destFilePath: pick.filePath,
      organizationName: org,
      exportedBy: user.fullName || user.username,
      appVersion: app.getVersion(),
      filterNote: filterNote || '',
      projectCount: projectCount || 0,
    });
    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'portfolio_statistics',
        entityId: type,
        entityTitle: defaultNames[type],
        userFullName: user.fullName,
        userRole: user.role,
        details: `Εξαγωγή αναφοράς χαρτοφυλακίου (${type})`,
      });
    }
    return result;
  } catch (e) {
    logger.error('export-portfolio-report error:', e.message);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-statistics-report', async (_event, {
  tabs,
  actingUsername,
  filterNote,
  projectCount,
  reportTitle,
  scopeSubprojectIds,
} = {}) => {
  try {
    const user = findUserByUsername(actingUsername);
    const perm = assertStatisticsExportPermission(user, { scopeSubprojectIds });
    if (!perm.ok) {
      return { success: false, error: perm.error };
    }
    const tabList = Array.isArray(tabs) ? tabs : [];
    if (!tabList.length) {
      return { success: false, error: 'Δεν υπάρχουν δεδομένα για εξαγωγή' };
    }
    const config = loadConfig();
    const org = config.organizationFullName || config.organizationName || '';
    const date = new Date().toISOString().slice(0, 10);
    const isFull = tabList.length > 1;
    const defaultName = isFull
      ? `Στατιστικές_Αναφορά_Πλήρης_${date}.pdf`
      : `Στατιστική_${String(tabList[0].tabLabel || tabList[0].tabId || 'tab').replace(/\s+/g, '_')}_${date}.pdf`;
    const { dialog } = require('electron');
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση στατιστικής αναφοράς PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };

    const result = await statisticsExportHandler.exportStatisticsReport({
      tabs: tabList,
      destFilePath: pick.filePath,
      organizationName: org,
      exportedBy: user.fullName || user.username,
      appVersion: app.getVersion(),
      filterNote: filterNote || '',
      projectCount: projectCount || 0,
      reportTitle: reportTitle || (isFull ? 'Πλήρης Στατιστική Αναφορά' : tabList[0].tabLabel),
    });
    if (result.success) {
      logAuditAction({
        type: 'export',
        entityType: 'statistics_report',
        entityId: isFull ? 'all_tabs' : tabList[0].tabId,
        entityTitle: defaultName,
        userFullName: user.fullName,
        userRole: user.role,
        details: `Εξαγωγή στατιστικής αναφοράς (${tabList.length} ενότητες)`,
      });
    }
    return result;
  } catch (e) {
    logger.error('export-statistics-report error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============================================================
// ΑΠΟΛΟΓΙΣΜΟΣ ΤΕΧΝΙΚΟΥ ΕΡΓΟΥ IPC HANDLERS (SUPERADMIN)
// ============================================================

const apologismosService = require('./apologismosService');
const apologismosPhotoRequestEmail = require('./apologismosPhotoRequestEmail');

function assertApologismosSuperAdmin(actingUsername) {
  if (!dashboardSessionActive || !loggedInUsername) {
    return { ok: false, error: 'Δεν είστε συνδεδεμένοι στο σύστημα' };
  }
  const claimed = String(actingUsername || '').trim();
  if (!claimed || claimed.toLowerCase() !== String(loggedInUsername).toLowerCase()) {
    return { ok: false, error: 'Μη εξουσιοδοτημένη ενέργεια' };
  }
  if (!isSuperAdminUser(loggedInUsername)) {
    return { ok: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στον Απολογισμό' };
  }
  return { ok: true, username: loggedInUsername };
}

/** Readiness + επιβλέπων από συνδεδεμένο υποέργο (μόνο για απόκριση στον renderer). */
function enrichApologismosReportForClient(report) {
  const base = apologismosService.enrichReportWithReadiness(report);
  const users = loadUsers();
  const subCache = new Map();
  const cards = (base.cards || []).map((card) => {
    if (card?.source !== 'linked' || !card.subprojectId) {
      return { ...card, supervisor: null };
    }
    let sub = subCache.get(card.subprojectId);
    if (sub === undefined) {
      sub = loadSubprojectDataById(card.subprojectId);
      subCache.set(card.subprojectId, sub);
    }
    const contact = apologismosPhotoRequestEmail.resolveSupervisorContact(sub, users);
    if (!contact?.displayName) {
      return { ...card, supervisor: null };
    }
    return {
      ...card,
      supervisor: {
        displayName: contact.displayName,
        hasEmail: !!contact.email,
        email: contact.email || '',
      },
    };
  });
  return { ...base, cards };
}

function loadSubprojectDataById(subprojectId) {
  if (!dataDir || !subprojectId) return null;
  const jsonPath = findSubprojectDataJsonPath(subprojectId);
  if (!jsonPath || !fs.existsSync(jsonPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return {
      ...data,
      projectId: data.projectId || path.basename(path.dirname(path.dirname(jsonPath))),
      subprojectId: data.subprojectId || subprojectId,
    };
  } catch (_) {
    return null;
  }
}

/** Πλήρης χάρτης — μόνο για λίστα eligible (αραιότερη χρήση). */
function buildSubprojectAmountMap() {
  const map = {};
  if (!dataDir) return map;
  let projectDirs = [];
  try {
    projectDirs = fs.readdirSync(dataDir).filter((f) => {
      try {
        return fs.statSync(path.join(dataDir, f)).isDirectory()
          && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f);
      } catch (_) {
        return false;
      }
    });
  } catch (_) {
    return map;
  }
  for (const projectDir of projectDirs) {
    const projectPath = path.join(dataDir, projectDir);
    let subDirs = [];
    try {
      subDirs = fs.readdirSync(projectPath).filter((f) => {
        try {
          return fs.statSync(path.join(projectPath, f)).isDirectory()
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f);
        } catch (_) {
          return false;
        }
      });
    } catch (_) {
      continue;
    }
    for (const subId of subDirs) {
      const dataPath = path.join(projectPath, subId, 'data.json');
      if (!fs.existsSync(dataPath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        map[subId] = {
          approvedAmount: data.approvedAmount,
          contractAmount: data.contractAmount,
          apeAmount: data.apeAmount,
          apeEntries: data.apeEntries,
          implementationForm: data.implementationForm,
          contracts: data.contracts,
          projectStatus: data.projectStatus,
          subprojectTitle: data.subprojectTitle,
          projectTitle: data.projectTitle,
          projectType: data.projectType,
          projectId: data.projectId || projectDir,
          subprojectId: data.subprojectId || subId,
        };
      } catch (_) {}
    }
  }
  return map;
}

/** Sync μόνο για linked subprojectIds της αναφοράς — αποφεύγει πλήρη σάρωση. */
function buildSubprojectAmountMapForIds(subprojectIds) {
  const map = {};
  const ids = [...new Set((subprojectIds || []).filter(Boolean))];
  for (const subId of ids) {
    const data = loadSubprojectDataById(subId);
    if (!data) continue;
    map[subId] = {
      approvedAmount: data.approvedAmount,
      contractAmount: data.contractAmount,
      apeAmount: data.apeAmount,
      apeEntries: data.apeEntries,
      implementationForm: data.implementationForm,
      contracts: data.contracts,
      projectStatus: data.projectStatus,
      subprojectTitle: data.subprojectTitle,
      projectTitle: data.projectTitle,
      projectType: data.projectType,
      projectId: data.projectId,
      subprojectId: data.subprojectId || subId,
    };
  }
  return map;
}

/** Φόρτωση αναφοράς + συγχρονισμός ποσών από συνδεδεμένα υποέργα. */
function loadApologismosReportWithSyncedAmounts(periodId) {
  const loaded = apologismosService.loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const linkedIds = (loaded.report.cards || [])
    .filter((c) => c.source === 'linked' && c.subprojectId)
    .map((c) => c.subprojectId);
  const synced = apologismosService.syncAmounts(dataDir, {
    periodId: loaded.period.id,
    subprojectById: buildSubprojectAmountMapForIds(linkedIds),
  });
  if (!synced.success) {
    return {
      success: true,
      report: loaded.report,
      period: loaded.period,
      amountsSynced: false,
    };
  }
  return {
    success: true,
    report: synced.report,
    period: synced.period || loaded.period,
    amountsSynced: !!synced.changed,
  };
}

ipcMain.handle('apologismos-get-meta', async (_event, { actingUsername } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    return { success: true, meta: apologismosService.getMeta() };
  } catch (e) {
    logger.error('apologismos-get-meta failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-get-periods', async (_event, { actingUsername } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const periods = apologismosService.loadPeriods(dataDir);
    return { success: true, periods };
  } catch (e) {
    logger.error('apologismos-get-periods failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-upsert-period', async (_event, { actingUsername, period } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.upsertPeriod(dataDir, period || {});
    return result;
  } catch (e) {
    logger.error('apologismos-upsert-period failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-get-report', async (_event, { actingUsername, periodId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const loaded = loadApologismosReportWithSyncedAmounts(periodId);
    if (!loaded.success) return loaded;
    const sanitized = apologismosService.sanitizeReportPhotos(dataDir, loaded.report);
    const report = enrichApologismosReportForClient(
      sanitized.success ? sanitized.report : loaded.report
    );
    return {
      success: true,
      report,
      period: loaded.period,
      amountsSynced: !!loaded.amountsSynced,
    };
  } catch (e) {
    logger.error('apologismos-get-report failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-save-report', async (_event, { actingUsername, report } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const saved = apologismosService.saveReport(dataDir, report);
    if (!saved.success) return saved;
    return {
      success: true,
      report: enrichApologismosReportForClient(saved.report),
    };
  } catch (e) {
    logger.error('apologismos-save-report failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-add-from-subproject', async (_event, { actingUsername, periodId, subprojectId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const subproject = loadSubprojectDataById(subprojectId);
    if (!subproject) return { success: false, error: 'Δεν βρέθηκε υποέργο' };
    let epActions = [];
    try {
      epActions = _epGetActionsForSubproject(dataDir, subprojectId) || [];
    } catch (_) {
      epActions = [];
    }
    const result = apologismosService.addFromSubproject(dataDir, {
      periodId,
      subproject,
      epActions,
    });
    if (result.success) {
      logAuditAction({
        type: 'create',
        entityType: 'apologismos_card',
        entityId: result.card.id,
        entityTitle: result.card.title,
        userFullName: findUserByUsername(auth.username)?.fullName || auth.username,
        userRole: 'SUPERADMIN',
        details: `Ένταξη υποέργου στον απολογισμό (${subprojectId})`,
      });
      return {
        success: true,
        report: enrichApologismosReportForClient(result.report),
        period: result.period,
        card: result.card,
      };
    }
    return result;
  } catch (e) {
    logger.error('apologismos-add-from-subproject failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-add-legacy-card', async (_event, { actingUsername, periodId, input } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.addLegacyCard(dataDir, { periodId, input: input || {} });
    if (result.success) {
      logAuditAction({
        type: 'create',
        entityType: 'apologismos_card',
        entityId: result.card.id,
        entityTitle: result.card.title,
        userFullName: findUserByUsername(auth.username)?.fullName || auth.username,
        userRole: 'SUPERADMIN',
        details: 'Χειροκίνητη καταχώρηση παλαιότερου έργου στον απολογισμό',
      });
      return {
        success: true,
        report: enrichApologismosReportForClient(result.report),
        period: result.period,
        card: result.card,
      };
    }
    return result;
  } catch (e) {
    logger.error('apologismos-add-legacy-card failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-update-card', async (_event, {
  actingUsername, periodId, cardId, patch, pruneUnusedVisuals,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.updateCard(dataDir, {
      periodId,
      cardId,
      patch: patch || {},
      // default true — ρητή αποθήκευση καθαρίζει κατάλοιπα· silent στέλνει false
      pruneUnusedVisuals: pruneUnusedVisuals !== false,
    });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      card: result.card,
    };
  } catch (e) {
    logger.error('apologismos-update-card failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-request-card-photos', async (_event, {
  actingUsername, periodId, cardId, optionalDeadline, optionalNote,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!periodId || !cardId) {
      return { success: false, error: 'Απαιτείται περίοδος και κάρτα' };
    }

    const loaded = apologismosService.loadReport(dataDir, periodId);
    if (!loaded.success) return loaded;
    const card = (loaded.report.cards || []).find((c) => c.id === cardId);
    if (!card) return { success: false, error: 'Δεν βρέθηκε κάρτα' };
    if (card.source !== 'linked' || !card.subprojectId) {
      return { success: false, error: 'Το αίτημα ισχύει μόνο για συνδεδεμένα υποέργα.' };
    }

    const phases = apologismosPhotoRequestEmail.photoPhasesForCard(card);
    if (!phases.length) {
      return {
        success: false,
        error: 'Η κάρτα δεν έχει τρόπο προβολής με φωτογραφίες. Επιλέξτε πρώτα πριν/μετά ή αντίστοιχο τρόπο.',
      };
    }

    const sub = loadSubprojectDataById(card.subprojectId);
    if (!sub) return { success: false, error: 'Δεν βρέθηκε το συνδεδεμένο υποέργο.' };
    const users = loadUsers();
    const contact = apologismosPhotoRequestEmail.resolveSupervisorContact(sub, users);
    if (!contact?.displayName) {
      return { success: false, error: 'Δεν υπάρχει καταγεγραμμένος επιβλέπων στο υποέργο.' };
    }
    if (!contact.email) {
      return {
        success: false,
        error: 'Ο επιβλέπων δεν έχει καταχωρημένο email στον λογαριασμό χρήστη του.',
      };
    }

    const replyToContact = apologismosPhotoRequestEmail.resolveSuperAdminReplyTo(users, auth.username);
    if (!replyToContact?.email) {
      return {
        success: false,
        error: 'Ορίστε email στον λογαριασμό SUPERADMIN, ώστε οι απαντήσεις με φωτογραφίες να φτάνουν σε εσάς.',
      };
    }

    const period = loaded.period || {};
    const periodLabel = String(period.label || period.name || '').trim()
      || (period.startYear && period.endYear ? `${period.startYear}–${period.endYear}` : '');
    const senderUser = findUserByUsername(auth.username);
    let org = '';
    try {
      const cfg = loadConfig();
      org = cfg?.organizationFullName || cfg?.organizationName || '';
    } catch (_) {
      org = '';
    }

    const content = apologismosPhotoRequestEmail.buildPhotoRequestEmailContent({
      supervisorDisplayName: contact.displayName,
      periodLabel,
      projectTitle: card.projectTitle || sub.projectTitle || '',
      subprojectTitle: card.title || sub.subprojectTitle || '',
      phases,
      optionalDeadline: optionalDeadline || '',
      optionalNote: optionalNote || '',
      // Όνομα στο κείμενο = ποιος λαμβάνει τις απαντήσεις (Reply-To), όχι απαραίτητα ο πατώντας Αποστολή αν δεν έχει email.
      senderDisplayName: replyToContact.displayName || senderUser?.fullName || auth.username,
      senderOrg: org,
    });

    const sent = await apologismosPhotoRequestEmail.sendPhotoRequestEmail({
      dataDir,
      toEmail: contact.email,
      subject: content.subject,
      html: content.html,
      textBody: content.textBody,
      replyTo: replyToContact,
    });
    if (!sent.success) return sent;

    const photoRequestLast = {
      sentAt: new Date().toISOString(),
      toEmail: contact.email,
      toName: contact.displayName,
      replyTo: replyToContact.email,
      replyToName: replyToContact.displayName || '',
      phases: [...phases],
      periodLabel,
    };
    const updated = apologismosService.updateCard(dataDir, {
      periodId,
      cardId,
      patch: { photoRequestLast },
      pruneUnusedVisuals: false,
    });
    if (!updated.success) {
      const cardsWithSent = (loaded.report.cards || []).map((c) => (
        c.id === cardId ? { ...c, photoRequestLast } : c
      ));
      return {
        success: true,
        warning: 'Το email στάλθηκε, αλλά δεν αποθηκεύτηκε η ένδειξη αποστολής στην κάρτα.',
        photoRequestLast,
        report: enrichApologismosReportForClient({ ...loaded.report, cards: cardsWithSent }),
      };
    }

    logAuditAction({
      type: 'update',
      entityType: 'apologismos_card',
      entityId: cardId,
      entityTitle: card.title || cardId,
      userFullName: senderUser?.fullName || auth.username,
      userRole: 'SUPERADMIN',
      details: `Αίτημα φωτογραφιών απολογισμού προς ${contact.displayName} <${contact.email}> (απάντηση σε ${replyToContact.email})`,
    });

    return {
      success: true,
      photoRequestLast,
      report: enrichApologismosReportForClient(updated.report),
      card: updated.card,
    };
  } catch (e) {
    logger.error('apologismos-request-card-photos failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-remove-card', async (_event, { actingUsername, periodId, cardId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const before = apologismosService.loadReport(dataDir, periodId);
    const title = before.success
      ? (before.report.cards.find((c) => c.id === cardId)?.title || cardId)
      : cardId;
    const result = apologismosService.removeCard(dataDir, { periodId, cardId });
    if (result.success) {
      logAuditAction({
        type: 'delete',
        entityType: 'apologismos_card',
        entityId: cardId,
        entityTitle: title,
        userFullName: findUserByUsername(auth.username)?.fullName || auth.username,
        userRole: 'SUPERADMIN',
        details: 'Διαγραφή κάρτας από απολογισμό',
      });
      return {
        success: true,
        report: enrichApologismosReportForClient(result.report),
        period: result.period,
      };
    }
    return result;
  } catch (e) {
    logger.error('apologismos-remove-card failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-sync-amounts', async (_event, { actingUsername, periodId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const loaded = apologismosService.loadReport(dataDir, periodId);
    if (!loaded.success) return loaded;
    const linkedIds = (loaded.report.cards || [])
      .filter((c) => c.source === 'linked' && c.subprojectId)
      .map((c) => c.subprojectId);
    const result = apologismosService.syncAmounts(dataDir, {
      periodId,
      subprojectById: buildSubprojectAmountMapForIds(linkedIds),
    });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      changed: result.changed,
    };
  } catch (e) {
    logger.error('apologismos-sync-amounts failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-dismiss-amount-badge', async (_event, { actingUsername, periodId, cardId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.dismissBadge(dataDir, { periodId, cardId });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      card: result.card,
    };
  } catch (e) {
    logger.error('apologismos-dismiss-amount-badge failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-select-photos', async (_event, { actingUsername } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = await dialog.showOpenDialog({
      title: 'Επιλογή φωτογραφιών απολογισμού',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Εικόνες', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'Όλα τα Αρχεία', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: true, canceled: true, filePaths: [] };
    }
    return { success: true, canceled: false, filePaths: result.filePaths };
  } catch (e) {
    logger.error('apologismos-select-photos failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-save-photo', async (_event, {
  actingUsername, periodId, cardId, phase, sourcePath,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const loaded = apologismosService.loadReport(dataDir, periodId);
    if (!loaded.success) return loaded;
    const card = loaded.report.cards.find((c) => c.id === cardId);
    if (!card) return { success: false, error: 'Δεν βρέθηκε κάρτα' };

    const slot = apologismosService.domain.canAddPhotoToPhase(card.photos, phase);
    if (!slot.ok) return { success: false, error: slot.error };

    const savedPhoto = await apologismosService.saveCardPhoto(dataDir, {
      cardId,
      phase,
      sourcePath,
      fileName: path.basename(sourcePath || ''),
      currentPhotos: card.photos,
    });
    if (!savedPhoto.success) return savedPhoto;

    const photos = {
      before: [...(card.photos?.before || [])],
      during: [...(card.photos?.during || [])],
      after: [...(card.photos?.after || [])],
    };
    photos[phase] = [...(photos[phase] || []), savedPhoto.relativePath];
    const updated = apologismosService.updateCard(dataDir, {
      periodId,
      cardId,
      patch: { photos },
      // Καθαρισμός καταλοίπων μόνο με ρητή «Αποθήκευση κάρτας».
      pruneUnusedVisuals: false,
    });
    if (!updated.success) return updated;
    return {
      success: true,
      relativePath: savedPhoto.relativePath,
      report: enrichApologismosReportForClient(updated.report),
      card: updated.card,
    };
  } catch (e) {
    logger.error('apologismos-save-photo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-remove-photo', async (_event, {
  actingUsername, periodId, cardId, phase, relativePath,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.removeCardPhoto(dataDir, {
      periodId, cardId, phase, relativePath,
    });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      card: result.card,
    };
  } catch (e) {
    logger.error('apologismos-remove-photo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-reorder-photo-primary', async (_event, {
  actingUsername, periodId, cardId, phase, relativePath,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.reorderCardPhotoPrimary(dataDir, {
      periodId, cardId, phase, relativePath,
    });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      card: result.card,
    };
  } catch (e) {
    logger.error('apologismos-reorder-photo-primary failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-export-photo', async (_event, { actingUsername, relativePath } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const abs = apologismosService.resolveCardMediaAbsolute(dataDir, relativePath);
    if (!abs || !fs.existsSync(abs)) {
      return { success: false, error: 'Δεν βρέθηκε το αρχείο της φωτογραφίας' };
    }
    const baseName = path.basename(abs);
    const ext = path.extname(baseName).replace('.', '').toLowerCase();
    const filters = [];
    if (ext) filters.push({ name: 'Εικόνα', extensions: [ext] });
    filters.push({ name: 'Όλα τα Αρχεία', extensions: ['*'] });
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση φωτογραφίας',
      defaultPath: baseName,
      filters,
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    fs.copyFileSync(abs, pick.filePath);
    return { success: true, filePath: pick.filePath };
  } catch (e) {
    logger.error('apologismos-export-photo failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-save-map-snapshot', async (_event, {
  actingUsername, periodId, cardId, dataUrl, mapDrawing, mapView,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!periodId || !cardId) {
      return { success: false, error: 'Απαιτούνται περίοδος και κάρτα' };
    }
    if (!dataUrl) {
      return { success: false, error: 'Λείπει το στιγμιότυπο χάρτη' };
    }
    const result = apologismosService.saveMapSnapshot(dataDir, {
      periodId,
      cardId,
      dataUrl,
      mapDrawing,
      mapView,
    });
    if (!result.success) return result;
    return {
      success: true,
      relativePath: result.relativePath,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      card: result.card,
    };
  } catch (e) {
    logger.error('apologismos-save-map-snapshot failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-list-eligible-subprojects', async (_event, { actingUsername } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const map = buildSubprojectAmountMap();
    const list = Object.values(map)
      .filter((s) => apologismosService.domain.isEligibleSubprojectStatus(s.projectStatus))
      .map((s) => ({
        subprojectId: s.subprojectId,
        projectId: s.projectId,
        title: s.subprojectTitle || s.projectTitle || s.subprojectId,
        projectTitle: s.projectTitle || '',
        approvedAmount: s.approvedAmount,
        contractAmount: s.contractAmount,
        projectStatus: s.projectStatus,
      }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title), 'el'));
    return { success: true, subprojects: list };
  } catch (e) {
    logger.error('apologismos-list-eligible-subprojects failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-resolve-media-map', async (_event, {
  actingUsername, relativePaths, asDataUrl = false, variant = 'full',
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const mediaMap = await apologismosService.resolveMediaMap(dataDir, relativePaths, {
      asDataUrl: !!asDataUrl,
      variant: variant === 'preview' ? 'preview' : 'full',
    });
    return { success: true, mediaMap };
  } catch (e) {
    logger.error('apologismos-resolve-media-map failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-get-presentation', async (_event, { actingUsername, periodId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const loaded = loadApologismosReportWithSyncedAmounts(periodId);
    if (!loaded.success) return loaded;
    const config = loadConfig();
    const model = apologismosService.buildPresentationModel(loaded.report, loaded.period, config, dataDir);
    return {
      success: true,
      model,
      period: loaded.period,
      amountsSynced: !!loaded.amountsSynced,
    };
  } catch (e) {
    logger.error('apologismos-get-presentation failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-update-appearance', async (_event, { actingUsername, periodId, patch } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = apologismosService.updateAppearance(dataDir, { periodId, patch });
    if (!result.success) return result;
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      appearance: result.appearance,
    };
  } catch (e) {
    logger.error('apologismos-update-appearance failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-select-cover-images', async (_event, { actingUsername, multi = false } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = await dialog.showOpenDialog({
      title: multi ? 'Επιλογή φωτογραφιών εξωφύλλου' : 'Επιλογή φωτογραφίας εξωφύλλου',
      properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        { name: 'Εικόνες', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'Όλα τα Αρχεία', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { success: true, canceled: true, filePaths: [] };
    }
    return { success: true, canceled: false, filePaths: result.filePaths };
  } catch (e) {
    logger.error('apologismos-select-cover-images failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-save-cover-image', async (_event, {
  actingUsername, periodId, sourcePath, slotIndex = 0, commitToReport = true, kind = 'cover',
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const result = await apologismosService.saveCoverImage(dataDir, {
      periodId,
      sourcePath,
      fileName: sourcePath ? path.basename(sourcePath) : (kind === 'mayor' ? 'mayor.jpg' : 'cover.jpg'),
      slotIndex,
      commitToReport: commitToReport !== false,
      kind: kind === 'mayor' ? 'mayor' : 'cover',
    });
    if (!result.success) return result;
    if (!result.report) {
      return {
        success: true,
        relativePath: result.relativePath,
        committed: false,
      };
    }
    return {
      success: true,
      report: enrichApologismosReportForClient(result.report),
      period: result.period,
      appearance: result.appearance,
      relativePath: result.relativePath,
      committed: true,
    };
  } catch (e) {
    logger.error('apologismos-save-cover-image failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-write-export-file', async (_event, {
  actingUsername, buffer, defaultName, filters,
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση αρχείου απολογισμού',
      defaultPath: defaultName || 'apologismos',
      filters: filters || [{ name: 'Αρχεία', extensions: ['*'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    const buf = Buffer.from(Array.isArray(buffer) ? buffer : []);
    const resolved = path.resolve(pick.filePath);
    fs.writeFileSync(resolved, buf);
    return { success: true, path: resolved };
  } catch (e) {
    logger.error('apologismos-write-export-file failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-frame-cover-images', async (_event, {
  actingUsername, periodId, channel = 'pdf',
} = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const loaded = apologismosService.loadReport(dataDir, periodId);
    if (!loaded.success) return loaded;
    return apologismosService.frameCoverImagesForExport(dataDir, {
      appearance: loaded.report.appearance,
      channel: channel === 'pptx' ? 'pptx' : 'pdf',
    });
  } catch (e) {
    logger.error('apologismos-frame-cover-images failed', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('apologismos-export-pptx', async (_event, { actingUsername, periodId } = {}) => {
  try {
    const auth = assertApologismosSuperAdmin(actingUsername);
    if (!auth.ok) return { success: false, error: auth.error };
    const { buildApologismosPptx } = require('./apologismosPptxExport');
    const loaded = loadApologismosReportWithSyncedAmounts(periodId);
    if (!loaded.success) return loaded;
    const config = loadConfig();
    const model = apologismosService.buildPresentationModel(loaded.report, loaded.period, config, dataDir);
    const framed = await apologismosService.frameCoverImagesForExport(dataDir, {
      appearance: loaded.report.appearance,
      channel: 'pptx',
    });
    const exportModel = framed.success && framed.mayorFrame && model.mayorMessage?.photo
      ? {
          ...model,
          mayorMessage: {
            ...model.mayorMessage,
            photo: { ...model.mayorMessage.photo, framedDataUrl: framed.mayorFrame },
          },
        }
      : model;
    const buffer = await buildApologismosPptx(exportModel, {
      resolveMedia: (rel) => apologismosService.resolveCardMediaAbsolute(dataDir, rel),
      coverFrames: framed.success ? framed.frames : [],
    });
    const defaultName = `Απολογισμός_${loaded.period.startYear}-${loaded.period.endYear}.pptx`;
    const pick = await dialog.showSaveDialog({
      title: 'Αποθήκευση παρουσίασης διαφανειών',
      defaultPath: defaultName,
      filters: [{ name: 'Παρουσίαση διαφανειών', extensions: ['pptx'] }],
    });
    if (pick.canceled || !pick.filePath) return { success: false, canceled: true };
    fs.writeFileSync(pick.filePath, buffer);
    logAuditAction({
      type: 'export',
      entityType: 'apologismos',
      entityId: loaded.period.id,
      entityTitle: defaultName,
      userFullName: findUserByUsername(auth.username)?.fullName || auth.username,
      userRole: 'SUPERADMIN',
      details: 'Εξαγωγή απολογισμού ως παρουσίαση διαφανειών',
    });
    return { success: true, path: pick.filePath };
  } catch (e) {
    logger.error('apologismos-export-pptx failed', e);
    return { success: false, error: e.message };
  }
});

ensureOrimanthiAepoCheckerStarted();
ensureProcurementCalendarCheckerStarted();
