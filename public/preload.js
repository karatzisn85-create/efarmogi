const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_INVOKE = new Set([
  'add-document-category','add-files-to-group','add-task-assignment-comment','add-task-assignment-files','authenticate',
  'change-password','check-data-dir-exists','check-file-exists',
  'check-entity-lock','check-folder-has-config','check-for-updates',
  'check-project-lock','check-projects-locks-bulk','clean-entaxi-modification-file','cleanup-duplicate-files',
  'cleanup-old-backups','cleanup-temp-files','clear-all-locks','clear-audit-log',
  'copy-document-template','copy-file','create-backup','cancel-backup','create-credit-approval',
  'create-entity-lock','create-file-group','create-manual-egkrisi-link','create-prosklisi-group',
  'create-project-lock','create-task-assignment','create-user','delete-backup','delete-task-assignment','delete-task-assignment-attachment','delete-document-category',
  'delete-document-template','delete-egkrisi-file','delete-egkrisi-link',
  'delete-egkrisi-pdf-completely','delete-egkrisi-pdf-from-subproject',
  'delete-egkrisi-subproject','delete-entaxi','delete-entaxi-file',
  'delete-entaxi-modification','delete-file','delete-files','delete-file-from-folder',
  'delete-item-from-folder','delete-item-from-subfolder','delete-prosklisi',
  'delete-prosklisi-file','delete-prosklisi-folder','delete-prosklisi-group',
  'delete-prosklisi-modification','delete-subproject','delete-user',
  'download-document-template','download-egkriseis-pdf','download-entaxi-file',
  'download-file-from-folder','download-file-from-subfolder','download-prosklisi-file',
  'download-subproject-file','download-update','export-invest-projects',
  'find-egkrisi-keys-by-subproject-id','find-project-by-subproject-id',
  'find-project-by-title','find-subproject-by-title','fix-audit-log-projectids',
  'fix-entaxi-file-objects','get-all-subprojects','get-all-supervisors',
  'get-all-entity-names','get-app-config','getAppVersion','get-audit-log','get-backup-info',
  'get-backup-list','get-backup-settings','get-backup-status','get-backup-location','save-backup-location','select-backup-folder','get-data-dir',
  'get-document-template-path','get-entaxi-file-path','get-entaxi-files',
  'get-file-path','get-folder-contents','get-note-files','get-notes-linked-entities','get-online-users','get-projects','get-prosklisi-files','get-registered-engineers',
  'khmdhs-fetch-contract-by-adam',
  'khmdhs-fetch-notice-by-adam',
  'diavgeia-fetch-decision-by-ada',
  'diavgeia-download-decision-pdf',
  'khmdhs-resolve-adam-chain',
  'preview-subproject-khmdhs-refresh',
  'cancel-khmdhs-batch-refresh',
  'batch-khmdhs-refresh-eligible',
  'check-khmdhs-staleness',
  'get-khmdhs-batch-report',
  'save-khmdhs-batch-report',
  'clear-khmdhs-batch-report',
  'create-khmdhs-refresh-snapshot',
  'save-khmdhs-refresh-findings',
  'acquire-khmdhs-refresh-lock',
  'release-khmdhs-refresh-lock',
  'check-khmdhs-batch-run',
  'start-khmdhs-batch-run',
  'end-khmdhs-batch-run',
  'restore-khmdhs-refresh-snapshot',
  'get-khmdhs-refresh-snapshot-info',
  'khmdhs-fetch-supplementary-contract',
  'get-subfolder-contents','get-subproject-files','get-subproject-id-by-number',
  'get-task-assignment','get-task-assignment-access','get-task-assignment-permissions',
  'get-update-state','get-user-downloads-path','get-users','get-users-list','has-users','import-egkriseis-csv',
  'install-update','link-egkrisi-manual','link-egkrisi-to-subproject',
  'link-subproject-to-subproject','load-all-entaxeis','load-all-projects',
  'load-all-proskliseis','load-all-subprojects','load-document-templates',
  'load-egkriseis-data','load-egkriseis-v2','load-egkrisi-links',
  'load-entaxi-data','load-notes','load-organized-egkriseis-structure','load-task-assignments','load-task-notifications','leave-task-assignment-workspace','leave-task-work-archive',
  'load-project-egkriseis','load-prosklisi-modifications','load-subproject-links',
  'load-unlinked-egkriseis','mark-task-notifications-read','mark-task-notifications-read-for-task','open-document-template','open-egkrisi-v2-pdf',
  'open-file-dialog','open-note-file','open-pdf-file','open-prosklisi-folder','open-task-assignment-file','download-task-assignment-file','download-task-assignment-folder','register-user',
  'remove-entity-lock','rename-document-template','restore-backup',
  'save-app-config','save-backup-settings',
  'save-egkriseis-data','save-egkrisi','save-entaxi','save-files',
  'save-modification','save-note-groups','save-notes','save-project-data',
  'export-subprojects-import-template','select-subprojects-import-xlsx',
  'preview-subprojects-excel-import','commit-subprojects-excel-import',
  'rebuild-projects-index',
  'save-prosklisi',  'save-prosklisi-modification','scan-egkriseis-folder',
  'upload-prosklisi-files',
  'select-data-folder','select-file','select-folder','select-folder-files-flat','select-multiple-files','set-dashboard-session-active',
  'show-save-dialog','unlock-project','update-document-category',
  'update-egkrisi-project-title','update-egkrisi-subproject-title',
  'update-entaxi-modification','update-prosklisi-modification','update-subproject-supervisor-engineers',
  'update-task-assignment','update-task-assignment-status','update-user',
  'check-user-email','delete-note-file','delete-note-files-dir','upload-document-template','upload-note-files','upload-egkriseis-pdfs',
  'validate-and-clean-egkrisi-links','verify-backup','view-egkriseis-pdf',
  'view-egkrisi-file','view-entaxi-file','view-file-from-folder',
  'view-file-from-subfolder','view-modification-pdf','view-prosklisi-file',
  'watch-task-file','unwatch-task-file',
  'get-email-config','save-email-config','test-email-config','is-email-configured',
  'toggle-workspace-email-notifications',
  'get-my-notification-preferences','save-my-notification-preferences',
  'get-task-assignments-summary',
  'write-debug-log','restart-app','rename-user',
  'export-portal-data','load-portal-published','save-portal-published',
  'refocus-window',
  'load-funding-options','save-funding-options',
  'pick-save-folder',
  'save-pdf-file',
  'write-pdf-file',
  'get-subproject-report-attachments',
  'merge-and-save-pdf',
  'select-excel-file',
  'load-ep-programs',
  'get-ep-program',
  'import-ep-program',
  'save-ep-action',
  'delete-ep-action',
  'get-ep-actions-for-subproject',
  'link-ep-subproject',
  'export-ep-program',
  'get-ep-program-statistics',
  'get-ep-subproject-link-map',
  'open-exported-file','open-external-url','open-khmdhs-act-view',
  'load-all-proposals','save-proposal','delete-proposal',
  'upload-proposal-files','upload-proposal-folder','delete-proposal-file','delete-proposal-folder-file','rename-proposal-file','delete-proposal-folder','delete-proposal-group','move-proposal-entry','open-proposal-file','download-proposal-file','get-proposal-folder-files','get-proposal-files','export-proposal','log-proposal-activity','clear-proposal-audit-log','search-proposal-files',
  'get-municipal-units-config','save-municipal-units-config',
  'get-calendar-config','save-calendar-config','send-test-procurement-calendar-reminder','get-email-send-history',
  'get-calendar-custom-events','save-calendar-custom-event','delete-calendar-custom-event',
  'get-note-reminder-config','save-note-reminder-config',
  'get-orimanthi-config','save-orimanthi-config','apply-orimanthi-pending-template','get-orimanthi-aepo-alerts','export-orimanthi-hub-report',
  'load-all-meletai','run-meletai-maintenance','get-meletai-subprojects','check-meleti-number','save-meleti','delete-meleti','link-meleti-subproject','unlink-meleti-subproject','get-meleti-by-subproject',
  'get-meletai-config','save-meletai-config','add-meletai-study-category','remove-meletai-study-category',
  'add-meleti-file-group','upload-meleti-files','upload-meleti-folder','delete-meleti-file','delete-meleti-folder','delete-meleti-folder-file','rename-meleti-file','delete-meleti-group',
  'get-meleti-folder-files','open-meleti-file','download-meleti-file','export-meletai-hub-report','export-meletai-study-report','export-portfolio-report','export-statistics-report',
]);

const ALLOWED_RECEIVE = new Set([
  'app-close-blocked','backup-completed','backup-progress','locks-changed',
  'task-data-changed',
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
