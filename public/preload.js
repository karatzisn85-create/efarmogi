const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_INVOKE = new Set([
  'add-document-category','add-files-to-group','add-task-assignment-comment','add-task-assignment-files','authenticate',
  'change-password','check-data-dir-exists',
  'check-entity-lock','check-folder-has-config','check-for-updates',
  'check-project-lock','clean-entaxi-modification-file','cleanup-duplicate-files',
  'cleanup-old-backups','cleanup-temp-files','clear-all-locks','clear-audit-log','commit-subprojects-excel-import',
  'copy-document-template','copy-file','create-backup','create-credit-approval',
  'create-entity-lock','create-file-group','create-manual-egkrisi-link',
  'create-project-lock','create-task-assignment','create-user','delete-backup','delete-task-assignment','delete-document-category',
  'delete-document-template','delete-egkrisi-file','delete-egkrisi-link',
  'delete-egkrisi-pdf-completely','delete-egkrisi-pdf-from-subproject',
  'delete-egkrisi-subproject','delete-entaxi','delete-entaxi-file',
  'delete-entaxi-modification','delete-file','delete-file-from-folder',
  'delete-item-from-folder','delete-item-from-subfolder','delete-prosklisi',
  'delete-prosklisi-file','delete-prosklisi-folder','delete-prosklisi-group',
  'delete-prosklisi-modification','delete-subproject','delete-user',
  'download-document-template','download-egkriseis-pdf','download-entaxi-file',
  'download-file-from-folder','download-file-from-subfolder','download-prosklisi-file',
  'download-subproject-file','download-update','export-invest-projects','export-subprojects-import-template',
  'find-egkrisi-keys-by-subproject-id','find-project-by-subproject-id',
  'find-project-by-title','find-subproject-by-title','fix-audit-log-projectids',
  'fix-entaxi-file-objects','get-all-subprojects','get-all-supervisors',
  'get-app-config','getAppVersion','get-audit-log','get-backup-info',
  'get-backup-list','get-backup-settings','get-data-dir',
  'get-document-template-path','get-entaxi-file-path','get-entaxi-files',
  'get-file-path','get-folder-contents','get-projects','get-prosklisi-files','get-registered-engineers',
  'khmdhs-fetch-contract-by-adam',
  'get-subfolder-contents','get-subproject-files','get-subproject-id-by-number',
  'get-task-assignment','get-task-assignment-access','get-task-assignment-permissions',
  'get-update-state','get-users','has-users','import-egkriseis-csv',
  'install-update','link-egkrisi-manual','link-egkrisi-to-subproject',
  'link-subproject-to-subproject','load-all-entaxeis','load-all-projects',
  'load-all-proskliseis','load-all-subprojects','load-document-templates',
  'load-egkriseis-data','load-egkriseis-v2','load-egkrisi-links',
  'load-entaxi-data','load-notes','load-organized-egkriseis-structure','load-task-assignments','load-task-notifications','leave-task-assignment-workspace','leave-task-work-archive',
  'load-project-egkriseis','load-prosklisi-modifications','load-subproject-links',
  'load-unlinked-egkriseis','mark-task-notifications-read','mark-task-notifications-read-for-task','open-document-template','open-egkrisi-v2-pdf',
  'open-file-dialog','open-pdf-file','open-prosklisi-folder','open-task-assignment-file','preview-subprojects-excel-import','register-user',
  'remove-entity-lock','rename-document-template','restore-backup',
  'rollback-audit-entry','save-app-config','save-backup-settings',
  'save-egkriseis-data','save-egkrisi','save-entaxi','save-files',
  'save-modification','save-note-groups','save-notes','save-project-data',
  'save-prosklisi',  'save-prosklisi-modification','scan-egkriseis-folder',
  'select-data-folder','select-file','select-folder',  'select-multiple-files','select-subprojects-import-xlsx','set-dashboard-session-active',
  'show-save-dialog','unlock-project','update-document-category',
  'update-egkrisi-project-title','update-egkrisi-subproject-title',
  'update-entaxi-modification','update-prosklisi-modification','update-subproject-supervisor-engineers',
  'update-task-assignment','update-task-assignment-status','update-user',
  'upload-document-template','upload-egkriseis-pdfs',
  'validate-and-clean-egkrisi-links','verify-backup','view-egkriseis-pdf',
  'view-egkrisi-file','view-entaxi-file','view-file-from-folder',
  'view-file-from-subfolder','view-modification-pdf','view-prosklisi-file',
  'write-debug-log','restart-app'
]);

const ALLOWED_RECEIVE = new Set([
  'app-close-blocked','backup-completed','backup-progress','locks-changed',
  'update-available','update-downloaded','update-download-progress','update-installed',
  'task-notification'
]);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (!ALLOWED_INVOKE.has(channel)) {
      console.warn('[Preload] Blocked invoke:', channel);
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel, ...args) => {
    if (!ALLOWED_INVOKE.has(channel)) {
      console.warn('[Preload] Blocked send:', channel);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },
  on: (channel, callback) => {
    if (!ALLOWED_RECEIVE.has(channel)) {
      console.warn('[Preload] Blocked on:', channel);
      return () => {};
    }
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  once: (channel, callback) => {
    if (!ALLOWED_RECEIVE.has(channel)) return;
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
  removeAllListeners: (channel) => {
    if (!ALLOWED_RECEIVE.has(channel)) return;
    ipcRenderer.removeAllListeners(channel);
  }
});
