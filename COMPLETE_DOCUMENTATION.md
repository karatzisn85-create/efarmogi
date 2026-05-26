λοιπόν `# ERGOHUB — Πλήρης Τεκμηρίωση

**Έκδοση εφαρμογής:** 1.3.8  
**Τελευταία ενημέρωση τεκμηρίωσης:** Μάιος 2026  
**Τύπος:** Desktop Electron (offline)  
**Οργανισμός:** Δήμος Αρχανών-Αστερούσιων  

> **Για AI agents:** Αυτό είναι το **μοναδικό** αρχείο τεκμηρίωσης του repo. Περιγράφει αρχιτεκτονική, ρόλους, μοντέλα δεδομένων, modules, IPC και συμβάσεις. Ο authoritative κώδικας είναι `public/electron.js` (~11k γραμμές) και `public/preload.js` (allowlist channels).

---

## Πίνακας περιεχομένων

1. [Γρήγορη εκκίνηση](#γρήγορη-εκκίνηση)
2. [Σκοπός & δυνατότητες](#σκοπός--δυνατότητες)
3. [Αρχιτεκτονική](#αρχιτεκτονική)
4. [Ρόλοι & ασφάλεια](#ρόλοι--ασφάλεια)
5. [Ροή εφαρμογής](#ροή-εφαρμογής)
6. [Αποθήκευση δεδομένων](#αποθήκευση-δεδομένων)
7. [Μοντέλα δεδομένων](#μοντέλα-δεδομένων)
8. [Λειτουργικές ενότητες](#λειτουργικές-ενότητες)
9. [IPC channels](#ipc-channels)
10. [Main-process modules](#main-process-modules)
11. [React components](#react-components)
12. [UI & coding conventions](#ui--coding-conventions)
13. [Build & ανάπτυξη](#build--ανάπτυξη)
14. [Οδηγίες για αλλαγές κώδικα (AI/dev)](#οδηγίες-για-αλλαγές-κώδικα-aidev)

---

## Γρήγορη εκκίνηση

### Απαιτήσεις

- Node.js 18+, npm 9+
- Windows 10/11 (κύρια πλατφόρμα)

### Εγκατάσταση & εκτέλεση

```bash
npm install
npm start          # Electron + υπάρχον build
```

Για development με hot-reload React (ξεχωριστά): `npm run build` μετά restart, ή ρύθμιση dev workflow του project.

### Build production

```bash
npm run build              # React → build/
npm run dist               # NSIS installer → dist/
npm run build:upload       # build + upload Dropbox (production pipeline)
```

### Ρύθμιση φακέλου δεδομένων

- **`app-config.json`** (ρίζα workspace / δίπλα στο executable): πεδίο `dataDir` → απόλυτο path στον φάκελο δεδομένων.
- **Env:** `DATA_DIR`, `EFARMOGI_ROOT` (ψάχνει `{root}/dedomena_ergon`).
- **Προεπιλογή:** `dedomena_ergon` κάτω από workspace, ή `Z:\EFARMOGI\dedomena_ergon`, `K:\EFARMOGI\dedomena_ergon` αν υπάρχουν.

Πρώτη εκκίνηση χωρίς `users.json` → **SetupWizard** για επιλογή/δημιουργία φακέλου δεδομένων.

---

## Σκοπός & δυνατότητες

**ERGOHUB** (παλιά ονομασία: «Εφαρμογή Διαχείρισης Έργων») είναι offline σύστημα διαχείρισης:

| Ενότητα | Περιγραφή |
|---------|-----------|
| **Έργα / Υποέργα** | CRUD, αναζήτηση, φίλτρα, στατιστικά, ομαδοποίηση PDF, σύνδεση υποέργων |
| **Προσκλήσεις** | Διαχείριση προσκλήσεων, φακέλοι αρχείων, τροποποιήσεις, export |
| **Εντάξεις** | Εντάξεις χρηματοδότησης, τροποποιήσεις, αρχεία |
| **Εγκρίσεις διάθεσης πίστωσης** | Δομή v1/v2, linking με υποέργα, credit approvals |
| **Χρέωση μηχανικών** | `supervisorEngineerIds` ανά υποέργο (όχι legacy `supervisor` string) |
| **Χώρος εργασίας (Tasks)** | Αναθέσεις εργασιών, σχόλια, αρχεία, ειδοποιήσεις, email |
| **INVEST export** | Excel εκτελεστέων έργων (Υπουργείο) |
| **KHMDHS** | Ανάκτηση snapshot σύμβασης με ΑΔΑΜ |
| **Χρήστες** | 4 ρόλοι, έγκριση εγγραφής, task permissions |
| **Backups / Audit** | Χειροκίνητα backups, audit log, πρότυπα εγγράφων |
| **Ενημερώσεις** | Dropbox-based auto-update (main process) |

**Βασικά χαρακτηριστικά:** 100% offline, JSON + PDF στο δίσκο, atomic writes (`safeWriteJSON`), entity locks, cache 5 λεπτών για projects list, ελληνικό UI.

---

## Αρχιτεκτονική

### Στρώματα (υποχρεωτικό μοτίβο)

```
React (src/)  →  window.electronAPI  →  ipcMain (public/electron.js)  →  FS / JSON
                     ↑
              public/preload.js (contextBridge + ALLOWED_INVOKE allowlist)
```

| Κανόνας | Λεπτομέρεια |
|---------|-------------|
| Renderer | **Ποτέ** `require('fs')`, **ποτέ** business logic για persistence |
| IPC | Πάντα `const ipcRenderer = window.electronAPI` — όχι `window.require('electron')` |
| Νέο channel | Handler στο `electron.js` + entry στα **δύο** sets του `preload.js` |
| Εγγραφή JSON | Μόνο `safeWriteJSON` / `safeWriteJSONAsync` — όχι απευθείας `writeFileSync` για data |
| State | Authoritative = δίσκος· renderer κρατά cache και ξαναφορτώνει μετά mutations |
| React state | Μόνο `useState` / `useMemo` / `useCallback` — όχι Redux/Zustand |
| Context | Μόνο `ToastProvider` για toasts |
| Routing | `MemoryRouter`: `SetupWizard` → `UserSelection` → `Dashboard` |

### Τεχνολογίες (κύρια)

| Στρώμα | Τεχνολογία |
|--------|------------|
| UI | React 18, styled-components, React Router 6 |
| Desktop | Electron 25 |
| Δεδομένα | JSON files, fs-extra |
| Excel | xlsx, xlsx-js-style, exceljs |
| Email | nodemailer (`taskAssignmentEmailService.js`) |
| Charts | Chart.js + react-chartjs-2 |
| PDF | react-pdf / pdfjs-dist |
| IDs | uuid v4 |
| Build | CRACO, react-scripts, electron-builder |

---

## Ρόλοι & ασφάλεια

### Πίνακας ρόλων

| Ρόλος | Δικαιώματα (ενδεικτικά) |
|-------|-------------------------|
| **SUPERADMIN** | Όλα· CRUD χρηστών, email config, backups, task admin, locks cleanup |
| **ADMIN** | CRUD έργων/εντάξεων/προσκλήσεων/εγκρίσεων, INVEST, exports |
| **ENGINEER** | Έργα filtered by `assignedSupervisors`· task workspace· workflow modals = read-only |
| **USER** | Read-only σε workflow modals· χωρίς διαχείριση έργων |

### Renderer checks (Dashboard pattern)

```javascript
const canManageAll = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
const userRoleForWorkflowModals = isEngineer ? 'USER' : userRole;
```

**Σημαντικό:** Οι έλεγχοι UI δεν αρκούν. Κάθε privileged handler στο `electron.js` επαληθεύει ρόλο από **`users.json`** μέσω `actingUsername` / `findUserByUsername` — **ποτέ** trusted role από payload renderer.

### Χρήστες (`users.json`)

```javascript
{
  username, passwordHash,   // SHA-256 + SALT — ποτέ επιστροφή hash στον renderer
  role,                     // SUPERADMIN | ADMIN | ENGINEER | USER
  fullName, email,
  active, approved,         // νέοι: approved: false μέχρι έγκριση
  assignedSupervisors: [],  // ENGINEER: φιλτράρισμα έργων
  taskAssignment: {
    canAssign,               // boolean
    assignableScope,         // 'none' | 'all' | 'selected'
    assignableUsernames      // όταν selected
  },
  createdAt
}
```

- **Self-registration** (`register-user`): μόνο `ADMIN` ή `USER`.
- **SUPERADMIN / ENGINEER:** μόνο από διαχειριστή (`create-user`).
- **`sanitizeTaskAssignmentForClient()`** σε κάθε επιστροφή user object.

### SMTP (`email_config.json` στο dataDir)

- Κρυπτογραφημένο app password· ποτέ σε logs/IPC responses.
- HTML emails: `escapeHtml()` πριν template.
- Ρύθμιση: SUPERADMIN → `EmailSettingsModal`.

### Path traversal

Κάθε path από renderer: `path.resolve` + έλεγχος `startsWith(path.resolve(dataDir))`.

### Audit

`audit_log.json` — destructive actions: `type`, `entityType`, `entityId`, `userFullName`, `userRole`, `oldValue`, `newValue`, `timestamp`.

---

## Ροή εφαρμογής

1. **SplashScreen** → έλεγχος `dataDir`, updates.
2. **SetupWizard** — αν λείπει/config invalid.
3. **UserSelection** — login (`authenticate`) ή εγγραφή (`register-user`).
4. **Dashboard** — κεντρικό hub: projects, managers (Entaxis, Prosklisis, Egkriseis), tasks, statistics, backups (superadmin), users.

**Session:** `set-dashboard-session-active` — main process ξέρει αν ο χρήστης είναι στο dashboard (κλείσιμο app κτλ.).

---

## Αποθήκευση δεδομένων

### Root: `dataDir` (π.χ. `dedomena_ergon/`)

Υποφάκελοι που δημιουργούνται αυτόματα (`ensureSubDirs`):

| Φάκελος | Περιεχόμενο |
|---------|-------------|
| `{projectId}/{subprojectId}/` | `data.json` + `ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/` |
| `entaxeis/{entaxiId}/` | `data.json`, `ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ/`, `ΑΡΧΕΙΑ_ΕΓΚΡΙΣΗΣ/` |
| `ΠΡΟΣΚΛΗΣΕΙΣ/{prosklisiId}/` | `prosklisi_data.json`, δομή φακέλων |
| `ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ/` | PDF αρχεία |
| `ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ/` | JSON metadata εγκρίσεων |
| `EGKRISEIS_DIATHESIS_PISTOSIS/` | v2 structure |
| `egkriseis_links/` | Σύνδεση εγκρίσεων ↔ υποέργα |
| `subproject_links/` | Σύνδεση υποέργων |
| `ANATHESEIS_ERGASION/` | Tasks (βλ. παρακάτω) |
| `DOCUMENT_TEMPLATES/` | Πρότυπα |
| `ΣΗΜΕΙΩΣΕΙΣ/` | `notes_data.json` |
| `backups/` | ZIP backups |
| `locks/` | Entity locks |
| `ektelestea_erga/` | INVEST Excel exports |
| `users.json`, `audit_log.json`, `email_config.json` | Στο root dataDir |

### Atomic write

`public/safeWrite.js`: temp file → rename + `.bak` rotation.

### Locks

- `create-entity-lock` / `remove-entity-lock` / `check-entity-lock` — γενικό entity lock.
- Legacy: `create-project-lock`, `check-project-lock`, `unlock-project`.
- Task writes: `.write.lock` στο `ANATHESEIS_ERGASION/` (`fileLock.js`).

---

## Μοντέλα δεδομένων

### Υποέργο (`{projectId}/{subprojectId}/data.json`)

```javascript
{
  projectId, subprojectId,          // UUID v4
  projectTitle, subprojectTitle,
  implementationForm, projectType, fundingSource, fundingDetails,
  projectStatus, kaCode, noKaCode,
  misPraxhsName, misPraxhsCode,
  approvedAmount, projectBudget,
  contractDate, contractAmount, contracts: [],
  hasSupplementaryContracts, supplementaryContracts: [],
  apeAmount, apeComments,
  remainingAmount, remainingAmountYear, remainingAmountComments,
  comments,
  files: [],                        // legacy flat list
  fileGroups: [{ id, title, files: [] }],
  egkriseisDialthesisPistosis: [],
  supervisorEngineerIds: [],        // UUIDs μηχανικών — ΟΧΙ legacy supervisor
  khmdhsAdam, khmdhsContractSnapshot,
  createdAt, updatedAt               // ISO 8601 — createdAt immutable on update
}
```

**Κανόνες:** `stripLegacySupervisorField()` σε κάθε save· arrays πάντα `[]` όχι `null`.

### Ενότητα Task (`ANATHESEIS_ERGASION/{taskId}/data.json`)

```javascript
{
  id, title, description,
  status,        // pending | in_progress | completed | cancelled
  priority, dueDate, dueTime,
  assignees: [], createdBy,
  files: [], comments: [], statusHistory: [],
  withdrawnByAssigner, leftArchiveBy: [], departedAssignees: [],
  emailNotificationsEnabled,       // per-task preference
  createdAt, updatedAt
}
```

- Index: `ANATHESEIS_ERGASION/index.json`
- Αρχεία: `ANATHESEIS_ERGASION/{taskId}/ARXEIA/`
- Notifications: `ANATHESEIS_ERGASION/notifications.json`
- Module: `public/taskAssignmentService.js`

### Χρήστες / enums UI

- Dropdown labels/values: `src/data/formOptions.js` — όχι hardcoded strings στο UI.

---

## Λειτουργικές ενότητες

### Έργα & υποέργα

- Κάρτες έργων, advanced filters, στατιστικά (`Statistics.js`).
- `ProjectForm`, `SubprojectDetailModal`, `SubprojectSearchModal`, `SubprojectLinkingModal`.
- Excel μαζική εισαγωγή: `export-subprojects-import-template`, `preview-subprojects-excel-import`, `commit-subprojects-excel-import`.
- KHMDHS: `khmdhs-fetch-contract-by-adam` → snapshot σε υποέργο.

### Προσκλήσεις / Εντάξεις / Εγκρίσεις

- Full-screen managers: `ProsklisisManager`, `EntaxisManager`, `EgkriseisManager`.
- ENGINEER: viewer mode στα workflow modals.
- Egkriseis: v2, linking wizard, credit approvals panel, CSV import.

### Χώρος εργασίας (Tasks)

- `TaskAssignmentManager` + `TaskAssignmentWorkspace`.
- Views: assigned / created / archive· permissions από `taskAssignment` στον user.
- Realtime: `task-data-changed`, `task-notification` (preload ALLOWED_RECEIVE).
- Email: reminders, workspace notifications (`taskAssignmentEmailService.js`).

### INVEST — Εκτελεστέα Έργα

- **Πρόσβαση:** ADMIN / SUPERADMIN — κουμπί «ΕΚΤΕΛΕΣΤΕΑ ΕΡΓΑ».
- **Channel:** `export-invest-projects`.
- **Handler:** `public/investExportHandler.js`.
- **Φίλτρο (όλα):**
  - Τύπος: ΕΡΓΟ, ΠΡΟΜΗΘΕΙΑ, ΥΠΗΡΕΣΙΑ, ΜΕΛΕΤΗ
  - Προϋπολογισμός ≥ 20.000 €
  - Όχι «ΙΔΙΟΙ ΠΟΡΟΙ» / 1099
  - Έργα που υπήρχαν μέχρι τέλος επιλεγμένου μήνα
- **Έξοδος:** `{dataDir}/ektelestea_erga/INVEST{YYYY}{MM}_.xlsx` — 8 sheets, merge οικονομικών από προηγούμενο export όπου ορίζεται στο handler.

### Backups, audit, templates, notes

- `BackupManager`, `AuditLogViewer`, `DocumentTemplatesManager`.
- Notes: `load-notes`, `save-notes`, `save-note-groups`.

### Ενημερώσεις

- `check-for-updates`, `download-update`, `install-update` — `dropbox-updater.js`, events στο renderer.

---

## IPC channels

Πηγή αλήθειας: `ALLOWED_INVOKE` στο `public/preload.js`. Νέο channel **υποχρεωτικά** και στα δύο μέρη.

### Events (main → renderer)

`ALLOWED_RECEIVE`: `app-close-blocked`, `backup-completed`, `backup-progress`, `locks-changed`, `task-data-changed`, `task-notification`, `update-available`, `update-downloaded`, `update-download-progress`, `update-installed`.

### Ομαδοποίηση invoke channels

**App & config:** `getAppVersion`, `get-app-config`, `save-app-config`, `get-data-dir`, `check-data-dir-exists`, `select-data-folder`, `check-folder-has-config`, `set-dashboard-session-active`, `restart-app`, `write-debug-log`

**Auth & users:** `authenticate`, `register-user`, `has-users`, `get-users`, `create-user`, `update-user`, `delete-user`, `change-password`

**Updates:** `check-for-updates`, `download-update`, `install-update`, `get-update-state`

**Locks:** `create-entity-lock`, `remove-entity-lock`, `check-entity-lock`, `create-project-lock`, `check-project-lock`, `unlock-project`, `clear-all-locks`

**Projects / subprojects:** `load-all-projects`, `get-projects`, `load-all-subprojects`, `get-all-subprojects`, `save-project-data`, `delete-subproject`, `get-subproject-files`, `save-files`, `delete-file`, `get-file-path`, `download-subproject-file`, `create-file-group`, `add-files-to-group`, `get-all-supervisors`, `get-registered-engineers`, `update-subproject-supervisor-engineers`, `find-project-by-subproject-id`, `find-project-by-title`, `find-subproject-by-title`, `get-subproject-id-by-number`, `export-subprojects-import-template`, `preview-subprojects-excel-import`, `commit-subprojects-excel-import`, `select-subprojects-import-xlsx`, `khmdhs-fetch-contract-by-adam`, `export-invest-projects`

**Tasks & email:** `get-task-assignment-access`, `get-task-assignment-permissions`, `load-task-assignments`, `get-task-assignment`, `create-task-assignment`, `update-task-assignment`, `delete-task-assignment`, `update-task-assignment-status`, `add-task-assignment-comment`, `add-task-assignment-files`, `open-task-assignment-file`, `load-task-notifications`, `mark-task-notifications-read`, `mark-task-notifications-read-for-task`, `leave-task-work-archive`, `leave-task-assignment-workspace`, `watch-task-file`, `unwatch-task-file`, `get-email-config`, `save-email-config`, `test-email-config`, `toggle-workspace-email-notifications`

**Entaxeis:** `load-all-entaxeis`, `save-entaxi`, `load-entaxi-data`, `delete-entaxi`, `get-entaxi-files`, `download-entaxi-file`, `view-entaxi-file`, `get-entaxi-file-path`, `delete-entaxi-file`, `save-modification`, `update-entaxi-modification`, `delete-entaxi-modification`, `clean-entaxi-modification-file`, `fix-entaxi-file-objects`, `view-modification-pdf`

**Proskliseis:** `load-all-proskliseis`, `save-prosklisi`, `delete-prosklisi`, `get-prosklisi-files`, `load-prosklisi-modifications`, `save-prosklisi-modification`, `update-prosklisi-modification`, `delete-prosklisi-modification`, `delete-prosklisi-file`, `delete-prosklisi-group`, `download-prosklisi-file`, `view-prosklisi-file`, `open-prosklisi-folder`, `get-folder-contents`, `get-subfolder-contents`, `view-file-from-folder`, `download-file-from-folder`, `delete-file-from-folder`, `delete-item-from-folder`, `view-file-from-subfolder`, `download-file-from-subfolder`, `delete-item-from-subfolder`, `delete-prosklisi-folder`

**Egkriseis:** `load-egkriseis-data`, `load-egkriseis-v2`, `save-egkriseis-data`, `save-egkrisi`, `load-egkrisi-links`, `link-egkrisi-to-subproject`, `link-egkrisi-manual`, `create-manual-egkrisi-link`, `delete-egkrisi-link`, `validate-and-clean-egkrisi-links`, `load-unlinked-egkriseis`, `load-organized-egkriseis-structure`, `load-project-egkriseis`, `scan-egkriseis-folder`, `import-egkriseis-csv`, `upload-egkriseis-pdfs`, `view-egkriseis-pdf`, `open-egkrisi-v2-pdf`, `download-egkriseis-pdf`, `view-egkrisi-file`, `delete-egkrisi-file`, `delete-egkrisi-pdf-completely`, `delete-egkrisi-pdf-from-subproject`, `delete-egkrisi-subproject`, `update-egkrisi-project-title`, `update-egkrisi-subproject-title`, `find-egkrisi-keys-by-subproject-id`, `create-credit-approval`

**Links:** `load-subproject-links`, `link-subproject-to-subproject`

**Files / dialogs:** `open-file-dialog`, `select-file`, `select-multiple-files`, `select-folder`, `show-save-dialog`, `open-pdf-file`, `copy-file`, `cleanup-temp-files`, `cleanup-duplicate-files`

**Document templates:** `load-document-templates`, `upload-document-template`, `download-document-template`, `delete-document-template`, `rename-document-template`, `open-document-template`, `get-document-template-path`, `copy-document-template`, `add-document-category`, `update-document-category`, `delete-document-category`

**Backups & audit:** `create-backup`, `get-backup-list`, `get-backup-info`, `restore-backup`, `delete-backup`, `verify-backup`, `get-backup-settings`, `save-backup-settings`, `cleanup-old-backups`, `get-audit-log`, `clear-audit-log`, `rollback-audit-entry`, `fix-audit-log-projectids`

**Notes:** `load-notes`, `save-notes`, `save-note-groups`

---

## Main-process modules

| Αρχείο | Ρόλος |
|--------|-------|
| `electron.js` | IPC handlers, auth, FS, locks, audit, orchestration |
| `preload.js` | contextBridge, channel allowlists |
| `appConfig.js` | `app-config.json`, `resolveDataDir` |
| `safeWrite.js` | Atomic JSON writes |
| `fileLock.js` | Service locks (tasks) |
| `taskAssignmentService.js` | Task CRUD, permissions, notifications |
| `taskAssignmentEmailService.js` | SMTP, templates, reminders |
| `investExportHandler.js` | INVEST Excel export |
| `subprojectExcelImport.js` | Μαζική εισαγωγή υποέργων |
| `khmdhsOpenData.js` | KHMDHS API |
| `chargeFilterUtils.js` | Φιλτράρισμα χρέωσης μηχανικών |
| `auditFieldLabels.js` | Labels audit πεδίων |
| `dropbox-updater.js` | Updates |
| `logger.js` | Logging |

---

## React components

| Component | Ρόλος |
|-----------|-------|
| `App.js` | Router, splash, update notifier, close guard |
| `SetupWizard.js` | Αρχική ρύθμιση dataDir |
| `UserSelection.js` | Login / register |
| `Dashboard.js` | Κύρια σελίδα (~5k+ γραμμές) |
| `ProjectForm.js`, `ProjectCard.js` | Έργα |
| `ProsklisisManager/Form/FileManager/ExportDialog` | Προσκλήσεις |
| `EntaxisManager/Form/FileViewer/ExportDialog` | Εντάξεις |
| `EgkriseisManager/Form/EgkrisiForm/LinkingWizard/...` | Εγκρίσεις |
| `CreditApprovalsPanel.js` | Εγκρίσεις πίστωσης |
| `TaskAssignmentManager/Workspace/Form` | Χώρος εργασίας |
| `EmailSettingsModal.js` | SMTP (superadmin) |
| `UserManagement.js` | Χρήστες |
| `BackupManager.js`, `AuditLogViewer.js` | Σύστημα |
| `Statistics.js`, `AdvancedFilters.js`, `SearchFilters.js` | Αναζήτηση / στατιστικά |
| `InvestExport.js` | INVEST UI |
| `SubprojectDetailModal`, `SubprojectSearchModal`, `SubprojectLinkingModal`, `SubprojectExcelImportModal` | Υποέργα |
| `DocumentTemplatesManager.js` | Πρότυπα |
| `TechnicalProgramExport.js`, `ExportData.js` | Exports |
| `ToastProvider.js`, `ConfirmModal.js`, `InteractionGuard.js` | UX infrastructure |

Utilities: `src/utils/` (camelCase). Static enums: `src/data/formOptions.js`.

---

## UI & coding conventions

- **Styling:** μόνο styled-components — όχι Tailwind/MUI για layout.
- **Γλώσσα UI:** Ελληνικά labels/errors.
- **Toasts:** `useToast()` από `ToastProvider` — όχι `alert()`.
- **Confirm:** `safeConfirm` / `showConfirm` από `src/utils/`.
- **Managers:** `position: fixed; inset: 0` overlays με `onClose`.
- **Z-index:** overlays 9000–10000, modals 10001–50000, critical 100000.
- **Χρώματα:** `#1e293b`, indigo `#6366f1` / `#4f46e5`, bg `#f8fafc`.

### Ονοματοδοσία

| Στοιχείο | Σύμβαση |
|----------|---------|
| React components | PascalCase |
| Utilities | camelCase |
| IPC channels | kebab-case |
| Entity IDs | UUID v4 |
| Data folders | Ελληνικά κεφαλαία (π.χ. `ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ`) |

---

## Build & ανάπτυξη

```
EFARMOGI/
├── public/           # electron.js, preload.js, helpers
├── src/              # React
├── build/            # Production React output (μετά npm run build)
├── scripts/          # build-and-upload, electron-builder-safe-runner
├── dist/             # NSIS installer output
├── app-config.json   # dataDir, τοπικές ρυθμίσεις
└── dedomena_ergon/   # Default/sample data (αν υπάρχει)
```

**Κανόνες αλλαγής `electron.js`:** Μόνο στοχευμένα patches — **απαγορεύεται** ολική επανεγγραφή (>50 γραμμές αδιακρίτως).

**Cursor rules** (συμπληρωματικά, όχι αντικατάσταση αυτού του αρχείου): `.cursor/rules/architecture.mdc`, `security.mdc`, `electron-main.mdc`, `naming-data.mdc`, `ui-conventions.mdc`.

---

## Οδηγίες για αλλαγές κώδικα (AI/dev)

1. Διάβασε τον επηρεαζόμενο handler στο `electron.js` πριν αλλάξεις renderer.
2. Νέο IPC → handler + `preload.js` `ALLOWED_INVOKE` (+ `ALLOWED_RECEIVE` αν χρειάζεται).
3. Privileged actions → έλεγχος ρόλου από δίσκο, όχι από client.
4. Νέα πεδία schema → backward-compatible defaults για παλιά JSON.
5. Μην επαναφέρεις `supervisor` string field — χρησιμοποίησε `supervisorEngineerIds`.
6. Μετά από mutation, renderer reload από IPC — μην βασίζεσαι σε stale state.
7. Paths από UI → validation εντός `dataDir`.
8. Για tasks/email, δες `taskAssignmentService.js` και `taskAssignmentEmailService.js`.

---

## Στατιστικά (ενδεικτικά)

| Μετρική | Τιμή |
|---------|------|
| `electron.js` | ~11.000+ γραμμές |
| IPC handlers | ~100+ |
| React components (`src/components/`) | ~50 |
| Invoke channels (preload) | ~150 |

---

*Τέλος τεκμηρίωσης — ERGOHUB*
