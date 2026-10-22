---
document_id: pliris_katagrafh
audience: ai_agents_only
language: el
product_name: ERGOHUB
npm_name: efarmogi-app
app_id: com.efarmogi.app
version_observed: 1.4.135
observed_on: 2026-10-21
repo_root: EFARMOGI
author_org: Δήμος Αρχανών-Αστερούσιων
purpose: Πλήρης επιχειρησιακός χάρτης ώστε άλλο μοντέλο να κατανοήσει την εφαρμογή χωρίς να ξαναδιαβάσει όλο το αποθετήριο.
authority: Αν αυτό το αρχείο και ο κώδικας διαφωνούν, ισχύει ο κώδικας. Αυτό το αρχείο καταγράφει την κατάσταση της έκδοσης 1.4.135.
do_not_treat_as: εγχειρίδιο τελικού χρήστη, νομική γνωμοδότηση, ή άδεια να αγνοηθούν οι κανόνες ασφαλείας του αποθετηρίου.
---

# ERGOHUB — πλήρης καταγραφή για μοντέλα

Διάβασε πρώτα την ενότητα 0 και την ενότητα 24. Μετά πήγαινε στην ενότητα του τομέα που σε αφορά. Μην συμπεραίνεις συμπεριφορά από το όνομα ενός κουμπιού αν η ενότητα 24 λέει το αντίθετο.

## 0. Πρωτόκολλο ανάγνωσης

1. Η εφαρμογή είναι **offline desktop** για τεχνική υπηρεσία δήμου. Διαχειρίζεται υποέργα, χρηματοδότηση, δημόσιες συμβάσεις (ΚΗΜΔΗΣ), Διαύγεια, αρχεία, εργασίες προσωπικού και αναφορές.
2. Δεν υπάρχει βάση δεδομένων, δεν υπάρχει server της εφαρμογής, δεν υπάρχει URL routing. Τα δεδομένα του δήμου είναι JSON και αρχεία σε έναν φάκελο `dataDir`.
3. Τρία στρώματα, πάντα με αυτή τη σειρά: οθόνη React (`src/`) → `window.electronAPI` (`public/preload.js`) → handlers στο `public/electron.js` → δίσκος ή εξωτερικό API.
4. Ο renderer **δεν** έχει `fs`, `require('electron')` ή Node. Κάθε νέα γέφυρα πρέπει να μπει και στο allowlist του `preload.js`, αλλιώς απορρίπτεται σιωπηλά.
5. Ο έλεγχος δικαιώματος στην οθόνη είναι μόνο εμφάνιση. Η απόφαση που μετράει είναι στον handler του main process, με ρόλο διαβασμένο από το `users.json`, όχι με ρόλο που στέλνει η οθόνη.
6. Κοινή λογική (κανόνες που πρέπει να είναι ίδιοι σε οθόνη, αποθήκευση και δοκιμές) ζει στο `app/core/*.js` και είναι **χωρίς Node APIs** όταν την φορτώνει και ο browser.
7. Ηλεκτρονικό παράθυρο φορτώνει πάντα το ήδη χτισμένο `build/index.html`. Αλλαγή στην οθόνη δεν φαίνεται στο Electron αν δεν ξαναχτιστεί το `build/`.
8. Αναγνωριστικά οντοτήτων: UUID v4. Χρόνοι: ISO 8601. Γλώσσα οθόνης και μηνυμάτων: ελληνικά. Enums: `src/data/formOptions.js`, όχι ελεύθερο κείμενο μέσα σε components.
9. Μην αποθηκεύεις το παλιό πεδίο `supervisor`. Η χρέωση είναι `supervisorEngineerIds`.
10. Μην επιστρέφεις `passwordHash` στην οθόνη. Μην γράφεις κωδικό SMTP σε log ή απάντηση IPC.

## 1. Ταυτότητα

| Γεγονός | Τιμή |
|---|---|
| Όνομα προϊόντος στο installer | ERGOHUB |
| Περιγραφή πακέτου | Desktop εφαρμογή διαχείρισης έργων |
| Κύρια διαδικασία | `public/electron.js` (~21.000 γραμμές· αλλαγές μόνο στοχευμένες) |
| Preload | `public/preload.js` |
| Παράθυρο | 1400×900, ανοίγει maximized, εικονίδιο `public/assets/icons/icon.ico` |
| Στόχος εγκατάστασης | Windows NSIS x64. Υπάρχει και στόχος Linux AppImage / κατηγορία mac, αλλά η παραγωγή είναι Windows. |
| Όνομα αρχείου installer | `ERGOHUB-${version}-Setup.exe` |
| Υπογραφή κώδικα | απενεργοποιημένη (`signAndEditExecutable: false`) |
| Πακέτο | asar, με `public/electron.js` unpacked |
| Οργανισμός προέλευσης | Δήμος Αρχανών-Αστερούσιων· ο φάκελος δεδομένων μπορεί να ανήκει και σε άλλον δήμο μετά τον οδηγό πρώτης ρύθμισης |

Τι κάνει ο υπάλληλος, σε μία πρόταση: κρατά το χαρτοφυλάκιο υποέργων του δήμου, τα δένει με εντάξεις, προσκλήσεις, εγκρίσεις πίστωσης, μελέτες, ωρίμανση και εργοτάξιο, τραβά την αλυσίδα δημόσιας σύμβασης από το ΚΗΜΔΗΣ, και βγάζει προγράμματα, στατιστικά, απολογισμό και δημοσίευση στην πύλη διαφάνειας.

## 2. Αρχιτεκτονική

```
React 18 (src/)
  styled-components, useState / useMemo / useCallback
  μοναδικό context: ToastProvider
  MemoryRouter, μία διαδρομή "/"
        |
        | window.electronAPI.invoke / .send / .on
        v
public/preload.js
  ALLOWED_INVOKE (407 ονόματα, περιλαμβάνει και send)
  ALLOWED_RECEIVE (γεγονότα main → οθόνη)
        |
        v
public/electron.js
  ipcMain.handle (406 κανάλια) + ipcMain.on('restart-app')
  ρόλοι, locks, audit, αποθήκευση
        |
        +-- public/*.js βοηθητικά modules
        +-- app/core/*.js καθαροί κανόνες
        v
Φάκελος dataDir (JSON + δυαδικά αρχεία)
        |
        +-- HTTPS: ΚΗΜΔΗΣ OpenData, Διαύγεια OpenData, Dropbox (ενημερώσεις + πύλη), Gmail SMTP
```

Κατάσταση οθόνης: cache. Η αλήθεια είναι ο δίσκος. Μετά από αποθήκευση η οθόνη ξαναφορτώνει (`load-all-projects` ή `load-one-subproject`). `localStorage` μόνο για προτιμήσεις εμφάνισης (π.χ. κλεισμένες επισημάνσεις, προτιμήσεις οθόνης εισόδου), ποτέ για επιχειρησιακά δεδομένα.

Δεν υπάρχουν Redux, Zustand, SQL, ORM.

## 3. Τεχνολογίες

### 3.1 Πλατφόρμα

| Κομμάτι | Τεχνολογία |
|---|---|
| Desktop shell | Electron 28 |
| UI | React 18, react-router-dom 6 (MemoryRouter μόνο), styled-components 5 |
| Build UI | Create React App 5 μέσω CRACO (`craco.config.js`) |
| Πακετάρισμα | electron-builder 23, NSIS |
| Ταυτότητα πακέτου | `com.efarmogi.app` |
| Δοκιμές οθόνης | Playwright (`e2e/p*-*.spec.cjs`) πάνω στο πραγματικό παράθυρο και προσωρινό φάκελο |
| Δοκιμές κανόνων | Jest (`src/**/*.test.js`, `craco test`) και `node --test` (`tests/unit/*.test.mjs`) |
| Γραφήματα | chart.js 3 + react-chartjs-2 |
| Χάρτης απολογισμού | leaflet 1.9 + @geoman-io/leaflet-geoman-free |
| PDF οθόνης / αναφορών | @react-pdf/renderer, pdf-lib, @pdf-lib/fontkit, pdfjs-dist, react-pdf |
| Excel | exceljs, xlsx, xlsx-js-style |
| Word | docx |
| Παρουσιάσεις | pptxgenjs |
| Συμπίεση | archiver, yauzl |
| Εικόνες | sharp, html2canvas |
| Email | nodemailer (Gmail SMTP) |
| HTTP εκτός browser | node-fetch 2 |
| Χρονοπρογραμματισμός | node-schedule |
| Ταυτότητες | uuid 9 |
| Γραμματοσειρές | dejavu-fonts-ttf (και συγχρονισμός για απολογισμό) |
| Emoji στον χώρο εργασίας | @emoji-mart/react |
| Python (βοηθητικά, όχι πυρήνας Electron) | `apply_excel_validations.py`, `verify_export.py` (openpyxl), μπαίνουν στα extraResources |

### 3.2 Τι δεν χρησιμοποιείται

Δεν υπάρχει Tailwind, MUI, βάση, cloud backend της εφαρμογής, ούτε multi-window routing. `webSecurity` του BrowserWindow είναι `false` (φόρτωση τοπικών αρχείων). `nodeIntegration` είναι `false`, `contextIsolation` είναι `true`. GPU switches είναι σβηστά (`--disable-gpu` κ.ά.) και η γλώσσα παραθύρου είναι `el-GR`. `isDev` στο main είναι σταθερά `false`: ακόμα και σε ανάπτυξη φορτώνεται το `build/index.html`.

### 3.3 Κοινά modules οθόνης και main

Το `craco.config.js` επιτρέπει imports από `app/core/` και `public/` και μηδενίζει Node fallbacks (`fs`, `crypto`, `http` κ.λπ. = false, `path` = path-browserify). Τα modules που δηλώνονται ρητά ως κοινά και πρέπει να μείνουν χωρίς Node:

`public/apologismosAppearance.js`, `app/core/subprojectCard.js`, `subprojectList.js`, `subprojectLifecycle.js`, `calendarDeadlines.js`, `prosklisiCatalog.js`, `entaxiCatalog.js`, `egkrisiCatalog.js`, `subprojectFiles.js`, `taskWorkspace.js`, `userCatalog.js`, `auditCatalog.js`, `khmdhsRefresh.js`, `khmdhsPostFetch.js`, `excelImport.js`, `reportsExport.js`, `portalCatalog.js`, `orimanthiCatalog.js`, `meletaiCatalog.js`, `siteDiary.js`, `epProgramCatalog.js`.

Υπάρχουν και άλλα αρχεία στο `app/core/` (π.χ. `contractorRegistry.js`, `backupCatalog.js`, `emailCatalog.js`, `managedFiles.js`, `entaxiDiavgeiaParse.js`, `entaxiAcceptanceMatch.js`, `entaxiAcceptancePersist.js`, `orimanthiFileChecklist.js`, `prosklisiFileGroups.js`, `apologismosCatalog.js`). Πριν τα εισάγεις στον renderer, έλεγξε ότι δεν ακουμπούν `fs`.

## 4. Χάρτης αποθετηρίου

| Διαδρομή | Ρόλος |
|---|---|
| `src/App.js`, `src/index.js` | Εκκίνηση React, splash, ενημέρωση, toast, κλείδωμα κλεισίματος |
| `src/components/` | Οθόνες. Ονόματα PascalCase. ~149 αρχεία `.js` |
| `src/components/pdf/` | Αναφορές `@react-pdf/renderer` |
| `src/utils/` | Καθαρή λογική οθόνης, κυρίως ΚΗΜΔΗΣ, εξαγωγές, ημερολόγιο |
| `src/data/formOptions.js` | Enums φόρμας υποέργου |
| `public/electron.js` | Όλοι οι IPC handlers |
| `public/preload.js` | contextBridge + allowlists |
| `public/*.js` | Modules του main (υπηρεσίες, ΚΗΜΔΗΣ, email, εξαγωγές) |
| `app/core/` | Κανόνες χωρίς (ή με ελάχιστο) Node, κοινοί σε παραγωγή και δοκιμές |
| `e2e/` | Playwright ροές P0–P14 |
| `tests/unit/` | node:test πάνω στα core modules |
| `scripts/` | build, γραμματοσειρές, επαληθεύσεις ΚΗΜΔΗΣ, upload |
| `public/dictionaries/` | Λεξικό ορθογραφίας el-GR |
| `.cursor/rules/` | Κανόνες για όποιον αλλάζει τον κώδικα (ασφάλεια, οπτική συνάφεια, E2E, electron) |

Μην ξαναγράφεις το `electron.js`. Εντόπισε τον handler και άλλαξε μόνο αυτόν.

## 5. Εκκίνηση και ρυθμίσεις

### 5.1 Σειρά που βλέπει ο χρήστης

1. Splash («Εκκίνηση εφαρμογής...») και έλεγχος έκδοσης.
2. Αν δεν υπάρχει `dataDir` → `SetupWizard` (επιλογή φακέλου, στοιχεία οργανισμού).
3. Αλλιώς `UserSelection`: είσοδος ή αυτοεγγραφή.
4. Με χρήστη → `Dashboard`. Η μοναδική διαδρομή του router είναι `/`. Το ποια οθόνη φαίνεται κρίνεται από κατάσταση React, όχι από URL.
5. Πάντα διαθέσιμα στο App: `SplashScreen`, `ErrorBoundary`, `UpdateNotifier`, `WhatsNew`, `ToastProvider`, `InteractionGuard`, `ConfirmModal`, `FileConflictModal`, `SavePdfDialog`.
6. Αν ο χρήστης είναι μέσα στο Dashboard και κλείσει το παράθυρο, εμφανίζεται φραγή «Είστε ακόμα συνδεδεμένοι!» μέχρι αποσύνδεση (`set-dashboard-session-active`).

### 5.2 Πού βρίσκεται ο φάκελος δεδομένων

Λογική στο `public/appConfig.js`, συνάρτηση `resolveDataDir`, με αυτή τη σειρά:

1. Μεταβλητή περιβάλλοντος `DATA_DIR`, αν ο φάκελος υπάρχει.
2. Δείκτης `%Electron userData%/data-dir.json` (`{ dataDir }`). Δεν γράφεται σε διαδικασία E2E.
3. Παλιό `app-config.json` εκτός dataDir (μεταφέρεται μέσα και μετά σβήνεται, μαζί με `.bak1`–`.bak3`).
4. Υποψήφιες ρίζες: `EFARMOGI_ROOT`, `Z:\EFARMOGI`, `K:\EFARMOGI`, ρίζα εγκατάστασης/workspace. Μέσα τους ψάχνει `dedomena_ergon`.
5. Αν τίποτα δεν υπάρχει, επιστρέφει `null` και ανοίγει ο οδηγός.

Μέσα στον dataDir:

| Αρχείο | Περιεχόμενο |
|---|---|
| `app-config.json` | Ενεργές ρυθμίσεις οργανισμού, `dataDir`, σημαίες πύλης (`portalEnabled`, `portalDimosUid`, `portalPublicUrl`, `portalExportFields`, …) |
| `org-config.json` | Αντίγραφο στοιχείων οργανισμού από την πρώτη ρύθμιση |

### 5.3 Φάκελοι που δημιουργούνται στην εκκίνηση

`entaxeis`, `ΠΡΟΣΚΛΗΣΕΙΣ`, `ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ`, `ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ`, `EGKRISEIS_DIATHESIS_PISTOSIS`, `ARCHIVE_EGKRISEIS`, `DOCUMENT_TEMPLATES`, `ΣΗΜΕΙΩΣΕΙΣ`, `locks`, `egkriseis_links`, `subproject_links`, `backups`, `ektelestea_erga`, `ANATHESEIS_ERGASION`, `ΑΠΟΛΟΓΙΣΜΟΣ`.

Φάκελοι που δημιουργούνται όταν χρησιμοποιηθεί η λειτουργία:

| Φάκελος | Οντότητα |
|---|---|
| `{projectId}/{subprojectId}/` | Υποέργο. Αρχείο `data.json`. Αρχεία στο `ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/`. Προαιρετικά `ΕΓΚΡΙΣΕΙΣ_ΔΙΑΘΕΣΗΣ/` |
| `ΜΕΛΕΤΕΣ/{meletiId}/` | Μελέτη |
| `ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ/{proposalId}/` | Δελτίο ωρίμανσης |
| `ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ/` | Ένα JSON ανά πρόγραμμα |
| `ΜΗΤΡΩΟ ΑΝΑΔΟΧΩΝ/{recordId}/` | Καρτέλα αναδόχου |
| `ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΟΤΑΞΙΟΥ/{subprojectId}/` | Ημερολόγιο επισκέψεων |
| `config/` | Ημερολόγιο, email, μελέτες, ωρίμανση, δημοτικές ενότητες, λογότυπο, ΚΗΜΔΗΣ batch, υπενθυμίσεις |
| `ONLINE_STATUS/` | Καρφιές παρουσίας χρηστών |
| `ΥΠΟΔΕΙΓΜΑΤΑ_ΕΓΓΡΑΦΩΝ/` | Παλιό όνομα· ο ενεργός φάκελος είναι `DOCUMENT_TEMPLATES` |

Αρχεία ρίζας που δεν είναι φάκελοι εκκίνησης αλλά υπάρχουν στην πράξη: `users.json`, `audit_log.json`, `backup_settings.json`, `backup_location.json`, `projects_index.json`, `projects_index.lock`, `portal-published.json`, `funding_options.json`. Το παλιό `registered-engineers.json` διαγράφεται στην εκκίνηση· ο κατάλογος μηχανικών βγαίνει από τους χρήστες.

### 5.4 Αποθήκευση αρχείων JSON

`public/safeWrite.js`: γράφει σε μοναδικό προσωρινό, κρατά έως 3 `.bakN`, και κάνει rename. Για δεδομένα δήμου μην χρησιμοποιείς σκέτο `writeFileSync`.

Ευρετήριο `public/projectsIndex.js`: επιταχύνει το `load-all-projects`. Χαλιέται σε μαζικές αλλαγές. Ο διαχειριστής μπορεί «Επαναδημιουργία ευρετηρίου» (`rebuild-projects-index`). Υπάρχει και `peek-projects-index` για ελαφρύ έλεγχο αλλαγών (η οθόνη κοιτάζει περίπου κάθε 45 δευτερόλεπτα, και τα locks περίπου κάθε 60).

## 6. Ασφάλεια και ρόλοι

### 6.1 Ρόλοι

| Ρόλος | Τι μπορεί |
|---|---|
| `SUPERADMIN` | Όλα όσα ο ADMIN, συν χρήστες, δημοτικές ενότητες, θέση αντιγράφων, εισαγωγή Excel υποέργων, απολογισμό, ρυθμίσεις πύλης, πρώτο χρήστη του συστήματος |
| `ADMIN` | Δημιουργία/μεταβολή/διαγραφή έργων, εντάξεων, προσκλήσεων, εγκρίσεων· αντίγραφα, υποδείγματα, εξαγωγή πύλης, επιχειρησιακό πρόγραμμα, μαζική ανανέωση ΚΗΜΔΗΣ |
| `ENGINEER` | Βλέπει υποέργα φιλτραρισμένα από `assignedSupervisors` και τη χρέωση της κάρτας. Γράφει σε υποέργο μόνο αν είναι χρεωμένος (`assertCanWriteChargedOrAdminSubproject`). Στις εντάξεις/προσκλήσεις/εγκρίσεις η οθόνη τον αντιμετωπίζει ως θεατή (`userRoleForWorkflowModals = USER`). Μπορεί ημερολόγιο εργοταξίου, εγγυήσεις/παραλαβές στο μητρώο αναδόχων εντός εμβέλειας, ιστορικό ενεργειών (φιλτραρισμένο), σημειώσεις |
| `USER` | Ανάγνωση ροών. Σημειώσεις. Χωρίς διαχείριση χαρτοφυλακίου |

Πρόσθετες σημαίες σε USER/ENGINEER, τις δίνει διαχειριστής: `orimanthiCanEdit`, `meletaiCanEdit`. Χώρος εργασιών: `taskAssignment = { canAssign, assignableScope: none|all|selected, assignableUsernames }`.

Σημαίες οθόνης στο Dashboard: `canManageAll` = ADMIN ή SUPERADMIN. `canManageWorkflow` = ούτε USER ούτε ENGINEER.

Ειδικά δικαιώματα (όχι μόνο οι δύο σημαίες):

| Λειτουργία | Ποιος |
|---|---|
| Νέα ένταξη / πρόσκληση | όχι USER, όχι ENGINEER |
| Επεξεργασία ωρίμανσης | ADMIN/SUPERADMIN ή σημαία `orimanthiCanEdit` |
| Επεξεργασία μελετών | ADMIN/SUPERADMIN ή σημαία `meletaiCanEdit` |
| Εγγραφή εργοταξίου | SUPERADMIN και ENGINEER |
| Μητρώο αναδόχων | ADMIN/SUPERADMIN πλήρες· USER ανάγνωση· ENGINEER εγγυήσεις/παραλαβές στο ορατό πεδίο |
| Επιχειρησιακό πρόγραμμα | ADMIN/SUPERADMIN |
| Απολογισμός και μαζική εισαγωγή Excel | SUPERADMIN |
| Εξαγωγή πύλης | ADMIN/SUPERADMIN |
| Χρήστες και δημοτικές ενότητες | SUPERADMIN |
| Ανανέωση ΚΗΜΔΗΣ | όχι USER· ENGINEER μόνο σε ορατό υποέργο· μαζική μόνο ADMIN/SUPERADMIN· μπλοκάρεται σε κατάσταση `ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ` |
| Επαναφορά στιγμιοτύπου ΚΗΜΔΗΣ | ADMIN/SUPERADMIN |

### 6.2 Λογαριασμοί

Αρχείο: `{dataDir}/users.json` (πίνακας).

Πεδία: `username`, `passwordHash`, `role`, `fullName`, `email`, `active`, `approved`, `assignedSupervisors[]`, `taskAssignment`, `orimanthiCanEdit`, `meletaiCanEdit`, `notificationPreferences`, `createdAt`, `updatedAt`.

Κωδικοί (`public/passwordAuth.js`):

- Νέοι: `scrypt` (`scrypt$salt$hash`).
- Παλιοί: SHA-256 του `ErgoHub2026!@#SecureSalt` + κωδικός. Στην επιτυχή είσοδο γίνεται rehash (`needsPasswordRehash`).
- Ελάχιστο μήκος: 8 χαρακτήρες.
- Αυτοεγγραφή (`register-user`): μόνο ρόλοι `ADMIN` και `USER`, `approved: false`. Δεν μπαίνει μέσα μέχρι έγκριση.
- Πρώτος λογαριασμός (`create-user` με κενό αρχείο): πρέπει να είναι `SUPERADMIN`.
- Αλλαγή κωδικού: μόνο ο ίδιος (`change-password`).
- Μετονομασία: `rename-user` με τρέχοντα κωδικό.
- Η οθόνη παίρνει sanitized αντικείμενο (`sanitizeTaskAssignmentForClient`), χωρίς hash.
- `isSuperAdminUser(username)` διαβάζει τον ρόλο από δίσκο. Το `actingUsername` πρέπει να είναι το username που κράτησε το main στη σύνοδο (`loggedInUsername`), όχι ό,τι δηλώνει μόνος του ο renderer σε ευαίσθητες ενέργειες.

Παρουσία: `{dataDir}/ONLINE_STATUS/{username}.json`. Καρφιά περίπου κάθε 15 δευτερόλεπτα, θεωρείται ανενεργή μετά από περίπου 45. Κανάλι `get-online-users`.

### 6.3 Κλειδώματα ταυτόχρονης επεξεργασίας

| Μηχανισμός | Πού |
|---|---|
| Κλείδωμα οντότητας | `{dataDir}/locks/{entityType}/{entityId}.json`. Κανάλια `create-entity-lock`, `remove-entity-lock`, `check-entity-lock`. Αλλαγή ειδοποιεί την οθόνη (`locks-changed`) |
| Κλείδωμα έργου | `create-project-lock`, `check-project-lock`, `check-projects-locks-bulk`, `unlock-project`. Παλιά αρχεία `{projectId}/.lock` καθαρίζονται στην εκκίνηση |
| Κλείδωμα υπηρεσίας | `public/fileLock.js` (`withServiceLock`), π.χ. `ANATHESEIS_ERGASION/.write.lock`, `projects_index.lock` |
| Λήξη κλειδώματος | Απομακρυσμένο lock θεωρείται μπαγιάτικο στα 30 λεπτά. Τοπικό lock με νεκρό PID ή χωρίς ανανέωση στα 8 ώρες. Lock αντιγράφου στα 30 λεπτά |
| Κλείδωμα ανανέωσης ΚΗΜΔΗΣ | `acquire-khmdhs-refresh-lock` / `release-khmdhs-refresh-lock` |
| Καθάρισμα | `clear-all-locks` |

Μην αγνοείς υπάρχον lock σε handler που γράφει δεδομένα.

### 6.4 Ιστορικό ενεργειών

`{dataDir}/audit_log.json`, σχήμα `{ logs: [...] }`. Κάθε εγγραφή: `id`, `timestamp`, `userFullName`, `userRole`, `action`, `entityType`, `entityId`, `entityTitle`, `details`, προαιρετικά `changes` (από `oldValue` / `newValue`). Κενές ενημερώσεις παραλείπονται (`auditCatalog.shouldSkipEmptyUpdate`). Όριο περίπου 10.000 εγγραφές. Ο ENGINEER βλέπει φιλτραρισμένο υποσύνολο. Βαριά στιγμιότυπα ΚΗΜΔΗΣ αφαιρούνται από τα diffs. Καταστροφικές ενέργειες πρέπει να γράφουν audit.

Κανάλια: `get-audit-log`, `clear-audit-log`, `fix-audit-log-projectids`. Οθόνη: `AuditLogViewer.js` («Ιστορικό Ενεργειών»).

### 6.5 Μονοπάτια αρχείων

Κάθε path που έρχεται από τον renderer ελέγχεται ότι μένει μέσα στο `dataDir` (`path.resolve` + `startsWith`). Αλλιώς «Μη επιτρεπτό path».

### 6.6 Ορθογραφία

`public/greekSpellcheck.js`. Λεξικό `el-GR` από `public/dictionaries/`, αντιγράφεται στο userData `Dictionaries/`. Το παράθυρο έχει `spellcheck: true`. Κατάσταση για δοκιμές: `e2e-spellcheck-status`. Μενού επεξεργασίας: `public/editContextMenu.js`, `e2e-last-edit-menu`.

## 7. Οντότητες και πεδία

Τα παρακάτω είναι τα πεδία που καθορίζουν τη συμπεριφορά. Οι φόρμες έχουν και επιπλέον προαιρετικά πεδία· αν χρειάζεσαι εξαντλητική λίστα κλειδιών, διάβασε το αντίστοιχο `data.json` και το module αποθήκευσης, μην εφεύρεις κλειδιά.

### 7.1 Υποέργο

Διαδρομή: `{dataDir}/{projectId}/{subprojectId}/data.json`. Ο φάκελος έργου δεν έχει δικό του JSON· το έργο είναι ομάδα υποέργων με κοινό `projectId` και `projectTitle`.

Ταυτότητα: `projectId`, `subprojectId`, `projectTitle`, `subprojectTitle`, `createdAt`, `updatedAt` (το `createdAt` δεν αντικαθίσταται σε ενημέρωση).

Φάση Α (στοιχεία που γράφει ο υπάλληλος):

- `implementationForm`: `Μια Σύμβαση` | `Πολλές Συμβάσεις`
- `projectType`: `ΠΡΟΜΗΘΕΙΑ`, `ΕΡΓΟ`, `ΜΕΛΕΤΗ`, `ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ`, `ΠΑΡΟΧΗ ΤΕΧΝΙΚΩΝ ΚΑΙ ΛΟΙΠΩΝ ΣΥΝΑΦΩΝ ΕΠΙΣΤΗΜΟΝΙΚΩΝ ΥΠΗΡΕΣΙΩΝ`, `ΚΟΙΝΩΝΙΚΕΣ ΚΑΙ ΑΛΛΕΣ ΕΙΔΙΚΕΣ ΥΠΗΡΕΣΙΕΣ`. Παλιές ονομασίες κανονικοποιούνται μέσω `normalizeProjectType` (`LEGACY_PROJECT_TYPE_ALIASES` στο `app/core/subprojectList.js`).
- `projectStatus`: `ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ`, `ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ`, `ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ`, `ΟΛΟΚΛΗΡΩΜΕΝΟ`, `ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ`, `ΑΠΕΝΤΑΓΜΕΝΟ`. Το απενταγμένο μένει για επαναφορά και δεν μπαίνει σε στατιστικά/εξαγωγές (`isAbandonedSubproject`).
- `kaCode`, κωδικοί Α.Λ.Ε. / MIS, `fundingSource`, `fundingDetails`, συγχρηματοδότηση, ποσά (`approvedAmount`, `projectBudget`, υπόλοιπα έτους), σχόλια, αναφορά οικονομικής υπηρεσίας.
- Πηγές χρηματοδότησης (σταθερές λίστες στο `formOptions.js`): Πρόγραμμα Αντώνης Τρίτσης, Φιλόδημος ΙΙ, ΠΔΕ ΥΠΕΣ ΣΑΕ055, ΕΣΠΑ 2014–2020, ΕΣΠΑ 2021–2027, Εθνικό ΠΔΕ ή ΕΠΑ 2021–2025, Ταμείο Ανάκαμψης, Λοιπά. Οι υποκατηγορίες είναι δεκάδες κωδικοί ανά πηγή, στο ίδιο αρχείο. Πρόσθετες πηγές του δήμου: `{dataDir}/funding_options.json` (`load-funding-options`, `save-funding-options`, οθόνη `FundingOptionsModal.js` μέσα από τη φόρμα, όχι από το μενού).
- Χρέωση: `supervisorEngineerIds[]`. Εμφάνιση μέσω `resolveChargeDisplay` (`app/core/subprojectCard.js`). Κλειδί φίλτρου `user:{username}`. Υπάρχει και ελεύθερη χρέωση εκτός καταλόγου (`free:`).
- `contracts[]` όταν η μορφή είναι πολλές συμβάσεις.
- `fileGroups[]` και δυαδικά στο `ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ/`.
- `egkriseisDialthesisPistosis[]` σύνδεσμοι εγκρίσεων πάνω στην κάρτα.
- Πεδία ΚΗΜΔΗΣ: ενότητα 13.

Καθάρισμα πριν την αποθήκευση: `subprojectCard.sanitizeSubprojectForPersist` και `stripLegacySupervisorField`. Συγχώνευση με υπάρχοντα: `public/subprojectSaveMerge.js`. Κανάλι αποθήκευσης: `save-project-data` (με `withMandatoryUpdateGuard`).

Αρχεία: ομαδοποίηση, ανέβασμα, μετονομασία (`rename-subproject-file`, `public/managedFileRename.js`), διπλότυπα (`cleanup-duplicate-files`), σύγκρουση ονόματος (`FileConflictModal`, `src/utils/fileConflictDialog.js`). Οθόνες: `FileManager.js`, αποβάθρα αρχείων μέσα στη `ProjectForm.js`.

Κανόνας 12μήνου απευθείας ανάθεσης (`src/utils/directAssignmentCompliance.js`): για είδος `ΕΡΓΟ` ή `ΜΕΛΕΤΗ` με διαδικασία `ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ`, έλεγχος 12 μηνών στον ίδιο ανάδοχο (ΑΦΜ ή όνομα από στιγμιότυπο ΚΗΜΔΗΣ). Η φόρμα και τα στατιστικά δείχνουν προειδοποίηση· δεν είναι σιωπηλή απόρριψη αποθήκευσης.

Σύνδεση υποέργου με υποέργο: `link-subproject-to-subproject`, `load-subproject-links`, φάκελος `subproject_links/`.

Διαγραφή: `delete-subproject` (ADMIN+). Νέο: φόρμα από «Νέο Υποέργο».

Εισαγωγή Excel (SUPERADMIN): πρότυπο `export-subprojects-import-template`, επιλογή `select-subprojects-import-xlsx`, προεπισκόπηση `preview-subprojects-excel-import`, οριστική `commit-subprojects-excel-import`. Λογική `app/core/excelImport.js`, `public/subprojectExcelImport.js`, enums `public/subprojectImportEnums.json`. Οθόνη `SubprojectExcelImportModal.js`. Το πρότυπο δεν χαλαρώνει τους κανόνες της φόρμας.

Ευρετήριο αναζήτησης: τίτλος έργου, τίτλος υποέργου, ΚΑ, χρέωση, κατάσταση, είδος (`src/utils/searchUtils.js`, `AdvancedFilters.js`).

### 7.2 Ένταξη

Διαδρομή: `{dataDir}/entaxeis/{entaxiId}/data.json`. Αρχεία: `ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ/`. Τροποποιήσεις: `ΤΡΟΠΟΠΟΙΗΣΕΙΣ/ΤΡΟΠ_{n}/`.

Σημαντικά πεδία: `entaxiId`, `documentDate`, `fundingAuthority`, `initialAmount`, `subject` (υποχρεωτικά στη δημιουργία — `entaxiCatalog.collectEntaxiRequiredErrors`), `linkedProjects[]`, `subprojectIds[]`, `projectTitle` (παλιός μονός σύνδεσμος), `modifications[]`, `entaxiPDF`, `approvalPDF`, `opsCode`, `beneficiary`, `diavgeiaAda`, `diavgeiaMeta`, `diavgeiaAcceptanceAda`, `diavgeiaAcceptanceMeta`, `updatedAt`.

Οθόνες: `EntaxisManager.js`, `EntaxisForm.js`, `EntaxiDetailModal.js`, `ModificationForm.js` (τροποποίηση ένταξης, με ποσά και Διαύγεια), `EntaxisExportDialog.js`, `EntaxisFileViewer.js`, `EntaxiDiavgeiaSection.js`, `EntaxiAcceptanceSearchModal.js`. Αναζήτηση υποέργου για σύνδεση: `SubprojectSearchModal.js`.

Κανάλια (χαρακτηριστικά): `load-all-entaxeis`, `load-entaxi-data`, `save-entaxi`, `delete-entaxi`, αρχεία/τροποποιήσεις `*-entaxi-*`, `diavgeia-fetch-entaxi-by-ada`, `diavgeia-search-entaxi-acceptance`, `diavgeia-attach-entaxi-acceptance`.

### 7.3 Πρόσκληση

Διαδρομή: `{dataDir}/ΠΡΟΣΚΛΗΣΕΙΣ/{id}/data.json`. Μπορεί να υπάρχει και sidecar `prosklisi_data.json`. Αρχεία μέσω `prosklisiFiles` + `fileGroups` (`public/prosklisiFileOps.js`).

Πεδία: `prosklisiId`, `title`, `axis`, `fundingSource`, `code`, `deadline`, `budgetRange`, `status` (`Υπό Ωρίμανση`, `Υπό Υποβολή`, `Υποβληθέν ΤΔΠ`), `linkedProjects[]`, `linkedOrimanthiProposals[]`, `prosklisiFiles[]`, `fileGroups[]`, `modifications[]`, `diavgeiaMeta`, `diavgeiaDocument`.

Οθόνες: `ProsklisisManager.js`, `ProsklisisForm.js`, `ProsklisiDetailModal.js`, `ProsklisisFileManager.js`, `ProsklisiModificationForm.js`, `ProsklisisExportDialog.js`, `ProsklisiDiavgeiaSection.js`.

Εξαγωγές: `export-prosklisi`, `export-proskliseis-excel`, `export-proskliseis-pdf`, `export-proskliseis-orimanthi-excel` (μπλοκ ωρίμανσης). Προθεσμίες μπαίνουν στο ημερολόγιο (`src/utils/prosklisiCalendarEvents.js`, `public/prosklisiDeadlineHelper.js`).

### 7.4 Έγκριση διάθεσης πίστωσης

Διπλή αποθήκευση:

1. Συγκεντρωτικό `{dataDir}/ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ/egkriseis-data.json` με `{ projects, metadata }`.
2. Δέντρο PDF στο `ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ/` και σύνδεσμοι πάνω στο υποέργο (`egkriseisDialthesisPistosis`) και στο `egkriseis_links/`.
3. Παλιές διαδρομές `EGKRISEIS_DIATHESIS_PISTOSIS/`, `ARCHIVE_EGKRISEIS/` παραμένουν για συμβατότητα.

Οθόνες: κύρια από το μενού `CreditApprovalsPanel.js`· φόρμα `EgkriseisForm.js` / `EgkrisiForm.js`· πλήρης περιηγητής `EgkriseisManager.js`· `EgkriseisLinkingWizard.js`, `EgkriseisStructureViewer.js`, `EgkriseisCreditApprovalViewer.js`, `SubprojectLinkingModal.js`.

Κανάλια: `load-egkriseis-data`, `load-egkriseis-v2`, `save-egkriseis-data`, `save-egkrisi`, `create-credit-approval`, `upload-egkriseis-pdfs`, `import-egkriseis-csv`, `scan-egkriseis-folder`, `link-egkrisi-to-subproject`, `link-egkrisi-manual`, `create-manual-egkrisi-link`, `validate-and-clean-egkrisi-links`, διαγραφές `delete-egkrisi-*`. Τύποι audit: `egkrisi`, `egkrisi_subproject`, `egkrisi_link`.

### 7.5 Χώρος εργασιών (αναθέσεις)

Φάκελος `ANATHESEIS_ERGASION/`: `index.json`, `notifications.json`, `{taskId}/data.json`, αρχεία στο `{taskId}/ARXEIA/`. Υπηρεσία: `public/taskAssignmentService.js`. Κανόνες: `app/core/taskWorkspace.js`.

Πεδία: `id`, `title`, `description`, `status` (`pending` | `in_progress` | `completed` | `cancelled`), `priority`, `dueDate`, `dueTime`, `assignees[]`, `createdBy`, `files[]`, `comments[]`, `statusHistory[]`, `withdrawnByAssigner`, `leftArchiveBy[]`, `departedAssignees[]`.

Οθόνες: `TaskAssignmentManager.js` σε δύο όψεις — «Χώρος Εργασίας» και «Αποθήκη Εργασιών». Φόρμα `TaskAssignmentForm.js`, χώρος `TaskAssignmentWorkspace.js`, toasts `TaskAssignmentToastHost.js`. Παρακολούθηση ανοιχτού αρχείου: `watch-task-file` / `unwatch-task-file`. Email ανάθεσης: ενότητα 11. Γεγονός `task-data-changed`, `task-notification`.

### 7.6 Μελέτες

`ΜΕΛΕΤΕΣ/{meletiId}/data.json`. Υπηρεσία `public/meletaiService.js`, ρυθμίσεις `public/meletaiConfigService.js` → `config/meletai-config.json`.

Πεδία: `id`, `studyNumber` (μοναδικό, π.χ. `2/2026`), `title`, προαιρετικό `linkedSubprojectId` (ένα υποέργο), `fileGroups[]` κάτω από `files/{groupId}/`, `createdAt`, `updatedAt`. Κατηγορίες μελέτης προσθαφαιρούνται (`add-meletai-study-category`).

Οθόνη: `MeletaiManager.js`. Εξαγωγές `export-meletai-study-report`, `export-meletai-hub-report`. Συντήρηση `run-meletai-maintenance`. Έλεγχος αριθμού `check-meleti-number`.

### 7.7 Ωρίμανση έργων

`ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ/{proposalId}/data.json`. Ρυθμίσεις `public/orimanthiConfigService.js` → `config/orimanthi-config.json`.

Πεδία: `id`, `title`, `status` (π.χ. `maturing`), `projectCategory`, `infrastructureSpecialization`, `municipalUnit`, `settlement`, `actionResponsible`, `aepoRenewalDate`, `description`, `notes`, `pendingItems[]`, `fileGroups[]`. Υποέργα υλοποίησης κανονικοποιούνται από `app/core/orimanthiFileChecklist.js`. Σύνδεση με προσκλήσεις (στιγμιότυπα `linkedOrimanthiProposals` στην πρόσκληση και αντίστροφα `set-proposal-file-prosklisi-link`).

Οθόνη: `OrimanthiManager.js` (πίνακας/hub). Κατηγορίες αρχείων: `OrimanthiFileCategoryPicker.js`. Εξαγωγή hub Excel/PDF `export-orimanthi-hub-report`. Εξαγωγή δελτίου `export-proposal` (Word με ταυτότητα ERGOHUB). Υπενθυμίσεις ΑΕΠΟ: `public/orimanthiAepoReminderService.js`, κανάλι `get-orimanthi-aepo-alerts`. Το component `OrimanthiAepoWidget.js` υπάρχει αλλά δεν είναι συνδεδεμένο στο μενού· οι ειδοποιήσεις ΑΕΠΟ περνούν από προτιμήσεις και ημερολόγιο.

### 7.8 Ημερολόγιο εργοταξίου

`ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΟΤΑΞΙΟΥ/{subprojectId}/data.json`. Φωτογραφίες: `ΦΩΤΟΓΡΑΦΙΕΣ/{entryId}/`. Υπηρεσία `public/siteDiaryService.js`. Κανόνες `app/core/siteDiary.js`.

Εγγραφή: `id`, `visitDate`, `visitTime`, `progress` (`normal` / `delay` / …), `notes`, `workOrder`, φωτογραφίες. Οι φωτογραφίες δεν είναι τα αρχεία του υποέργου.

Οθόνες: hub `SiteDiaryManager.js`, από κάρτα `SubprojectSiteDiaryModal.js`, πάνελ `SiteDiaryPanel.js`.

### 7.9 Μητρώο αναδόχων

`ΜΗΤΡΩΟ ΑΝΑΔΟΧΩΝ/{recordId}/data.json`. Υπηρεσία `public/contractorRegistryService.js`.

Πεδία: `id`, `identityKey`, `name`, `vat`, `phone`, `email`, `notes`, `guarantees[]`, `acceptances[]` (με `subprojectId` όπου ισχύει). Οθόνη `ContractorRegistryManager.js`. Άνοιγμα από σύμβαση κάρτας εστιάζει στον ανάδοχο.

### 7.10 Επιχειρησιακό πρόγραμμα

`ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ/{startYear}_{endYear}_{programId}.json`. Υπηρεσία `public/epProgramService.js`.

Πεδία: `id`, `title`, `startYear`, `endYear`, `isActive`, `budgetYears[]`, `axes[]`, `measures[]`, `objectives[]`, `actions[]`, `importedAt`, `importedBy`. Εισαγωγή από xlsx (`import-ep-program`, `preview-ep-program`). Σύνδεση δράσης με υποέργο (`link-ep-subproject`, `get-ep-actions-for-subproject`) φαίνεται στη φάση Α της κάρτας («Σύνδεση με Δράση ΕΠ»). Οθόνες: `EpProgramManager.js`, `EpProgramStatsPanel.js`. Πρότυπο `download-ep-program-template`, εξαγωγή `export-ep-program`.

### 7.11 Απολογισμός δημοτικής περιόδου

Φάκελος `ΑΠΟΛΟΓΙΣΜΟΣ/`: `periods.json` (`periods[{id, startYear, endYear, …}]`), `reports/{periodId}.json`, `media/`, `appearance/`.

Υπηρεσία `public/apologismosService.js`. Μοντέλο `public/apologismosDomain.js`. Παρουσίαση: `apologismosPresentation.js`, `apologismosPptxExport.js`, `apologismosPptxMotion.js`, `apologismosSlideDesign.js`, `apologismosSlideFlatten.js`, `apologismosCoverFrame.js`, `apologismosFonts.js`, `apologismosMediaIngest.js`, `apologismosEpSuggest.js`, `apologismosFinalContractAmount.js`, `apologismosPhotoRequestEmail.js`, `apologismosTocLayout.js`.

Οθόνες: `ApologismosManager.js` (SUPERADMIN, «Δημιουργία Απολογισμού Δημοτικής Περιόδου»), `ApologismosSlideView.js`, `ApologismosMapEditor.js`, `ApologismosLiveMap.js`, `ApologismosAppearanceEditor.js`. PDF αναφοράς: `src/components/pdf/ApologismosReport.js`. Εξαγωγή διαφανειών: `apologismos-export-pptx`. Κάρτες από υποέργα ή χειροκίνητες (`apologismos-add-from-subproject`, `apologismos-add-legacy-card`). Αιτήματα φωτογραφιών με email. Ποσά συγχρονίζονται με την κάρτα και ο χρήστης μπορεί να κλείσει ειδοποίηση διαφοράς (`apologismos-dismiss-amount-badge`).

Όλα τα κανάλια αρχίζουν με `apologismos-` (27 handlers· πλήρης λίστα στην ενότητα 15). Κάλυμμα και κάδρο εικόνων: `apologismosCoverFrame.js`, `apologismosCoverFrameCache.js`.

### 7.12 Σημειώσεις

`ΣΗΜΕΙΩΣΕΙΣ/notes_data.json`: `notes[]`, `groups[]` (προεπιλογή `general-notes`). Ορατότητα: προσωπική, ορατή σε ρόλους, ορατή σε χρήστες. Σύνδεση με έργο, υποέργο, ένταξη, πρόσκληση, έγκριση, μελέτη. Αρχεία σημείωσης ξεχωριστά. Υπενθυμίσεις: `config/note_reminder_config.json`.

Οθόνη: δεν είναι ξεχωριστό component αρχείου· είναι επικάλυψη μέσα στο `Dashboard.js` (κουμπί «Γρήγορες Σημειώσεις») και αυτοκόλλητα `LinkedNoteSticker.js`. Ρόλοι ADMIN/ENGINEER/USER έχουν πρόσβαση στο πάνελ, με φίλτρο ορατότητας.

### 7.13 Ημερολόγιο προθεσμιών

Δεν είναι ξεχωριστή οντότητα δίσκου για τις προθεσμίες ΚΗΜΔΗΣ/προσκλήσεων/ΑΕΠΟ· χτίζονται από τα δεδομένα (`public/calendarEventsBuilder.js`, `app/core/calendarDeadlines.js`, `src/utils/procurementCalendarEvents.js`, `entaxiCalendarEvents.js`, `prosklisiCalendarEvents.js`, `aepo` events, `customCalendarEvents.js`).

Ρυθμίσεις: `config/calendar_config.json` (`calendarConfigService.js`). Χειροκίνητα γεγονότα: `config/calendar_custom_events.json` (`calendarCustomEventsService.js`), δημιουργία από ADMIN/SUPERADMIN. Οθόνες: `ProcurementCalendar.js` («Ημερολόγιο Προθεσμιών»), συμπαγές ραντάρ `CalendarDeadlineWidget.js`, φόρμες `CalendarCustomEventForm.js` / `CalendarCustomEventView.js`. Το `CalendarSettings.js` υπάρχει· το μενού συστήματος ανοίγει το `NotificationSettingsCenter.js`.

Υπενθυμίσεις email: `public/procurementCalendarReminderService.js`. Πρώτος έλεγχος 15 λεπτά μετά την εκκίνηση, μετά κάθε 2 ώρες, και κάθε μέρα στις 08:00. Δοκιμαστική αποστολή: `send-test-procurement-calendar-reminder`. Ιστορικό αποστολών: `{dataDir}/config/email-send-history.json`. Ημερολόγιο υπενθυμίσεων που έχουν ήδη σταλεί: `{dataDir}/config/procurement-calendar-reminder-log.json`. Οθόνη ιστορικού: `EmailSendHistory.js` (`get-email-send-history`). Το αρχείο `CalendarSettings.js` δεν ανοίγει από το μενού· το κουμπί «Κέντρο Ειδοποιήσεων» ανοίγει `NotificationSettingsCenter.js`.

### 7.14 Πύλη διαφάνειας

Τοπική κατάσταση: `{dataDir}/portal-published.json` (`subprojectIds`, `lastExportedIds`, `lastExportedAt`, `lastDropboxLink`). Κανάλια `load-portal-published`, `save-portal-published`, `export-portal-data`.

Εξαγωγή: JSON `erga.json` με `dimos`, `dimosUid`, `lastUpdated`, `erga[]` (`app/core/portalCatalog.js`, `buildErgonEntry`). Ανέβασμα Dropbox: `public/portalDropboxUploader.js` στο `/portal/{dimosUid}/erga.json`, shared link. Token cache στο userData `portal-dropbox-token-cache.json` (όχι μέσα στα δεδομένα δήμου που αντιγράφονται). Οθόνη: `PortalHubModal.js`. Παλιότερα `PortalExport.js` και `PortalSettingsModal.js` παραμένουν στον κώδικα. Στην κάρτα (φάση Α, ανάγνωση) υπάρχει διακόπτης συμμετοχής, με έλεγχο ρόλου. Πρόσβαση εξαγωγής: `portalCatalog.evaluatePortalExportAccess` (ADMIN/SUPERADMIN).

### 7.15 Υποδείγματα εγγράφων

`DOCUMENT_TEMPLATES/templates_data.json`: `categories[{id,name,color}]`, `documents[]` + δυαδικά στον ίδιο φάκελο. Οθόνη `DocumentTemplatesManager.js` (ADMIN+). Κανάλια `load-document-templates`, `upload-document-template`, `add-document-category`, `copy-document-template`, `rename-document-template`, `delete-document-template`, `open-document-template`, `download-document-template`.

### 7.16 Δημοτικές ενότητες

`config/municipal-units.json`: `units[]`, `logoRelativePath`, `updatedAt`. Λογότυπο `config/branding/municipality-logo.*`. Υπηρεσία `public/municipalUnitsConfigService.js`. Οθόνη `MunicipalUnitsManager.js` (SUPERADMIN). Χρησιμοποιούνται στην ωρίμανση και στις ταυτότητες εγγράφων.

### 7.17 Αντίγραφα ασφαλείας

Προεπιλογή `{dataDir}/backups` ή προσαρμοσμένος φάκελος `{custom}/ERGOHUB_BACKUPS` (`backup_location.json`, μόνο SUPERADMIN). `metadata.json` κρατά τον κατάλογο. Αυτόματα αντίγραφα υπάρχουν ως ρύθμιση αλλά είναι σβηστά εξ ορισμού· η ροή είναι χειροκίνητη. Εξαιρούνται από το πακέτο: `backups`, `locks`, `app-config.json`, `backup_settings.json`, `backup_location.json`. Εφαρμογή επαναφοράς: `public/backupRestoreApply.js`. Κανόνες: `app/core/backupCatalog.js`. Οθόνη `BackupManager.js`. Κανάλια: `create-backup`, `cancel-backup`, `restore-backup`, `verify-backup`, `delete-backup`, `get-backup-list`, `get-backup-info`, `get-backup-status`, `get-backup-settings`, `save-backup-settings`, `get-backup-location`, `save-backup-location`, `select-backup-folder`, `cleanup-old-backups`. Γεγονότα: `backup-progress`, `backup-completed`. Το Dashboard δείχνει υπενθύμιση.

### 7.18 Τεχνικό πρόγραμμα και εκτελεστέα

«Τεχνικό Πρόγραμμα»: `TechnicalProgramExport.js` (Excel). «Εκτελεστέα Έργα» / INVEST: `InvestExport.js` και `export-invest-projects` υπάρχουν, το κουμπί μενού είναι κρυμμένο, ο φάκελος `ektelestea_erga/` κρατά πρότυπο xlsx. `verify_export.py` ελέγχει φύλλο `02. ΠΙΝΑΚΑΣ ΕΡΓΩΝ`. `apply_excel_validations.py` αντιγράφει επικυρώσεις από πρότυπο σε εξαγόμενο βιβλίο.

## 8. Χάρτης οθόνης (Dashboard)

Κέλυφος: `src/components/Dashboard.js`. Οργανισμός + «ERGOHUB - Διαχείριση Έργων & Προμηθειών», όνομα και ρόλος, «Ειδοποιήσεις» (`MyNotificationPreferences.js`), «Αποσύνδεση».

Αριστερή στήλη:

| Ομάδα | Ετικέτα | Component |
|---|---|---|
| Καρφίτσα | Αναζήτηση & Φίλτρα | `AdvancedFilters.js` |
| Καρφίτσα | Γρήγορη αναζήτηση, Κατάσταση, Είδος, Καθαρισμός | μέσα στο Dashboard |
| Καρφίτσα | Ημερολόγιο Προθεσμιών | `ProcurementCalendar.js` |
| Καρφίτσα | Στατιστικά & Αναφορές | `StatisticsModal.js` → `Statistics.js` |
| Καρφίτσα | Νέο Υποέργο | `ProjectForm.js` |
| Καρφίτσα | Ολοκληρωμένα & Αποπληρωμένα | εναλλαγή προβολής αρχείου |
| Διαδικασίες Έργων | Εντάξεις Έργων | `EntaxisManager.js` |
| Διαδικασίες Έργων | Προσκλήσεις | `ProsklisisManager.js` |
| Διαδικασίες Έργων | Εγκρίσεις Διάθεσης Πίστωσης | `CreditApprovalsPanel.js` |
| Διαδικασίες Έργων | Ωρίμανση Έργων | `OrimanthiManager.js` |
| Διαδικασίες Έργων | Μητρώο Μελετών | `MeletaiManager.js` |
| Διαδικασίες Έργων | Μητρώο Αναδόχων | `ContractorRegistryManager.js` |
| Διαδικασίες Έργων | Ημερολόγιο Εργοταξίου | `SiteDiaryManager.js` |
| Διαδικασίες Έργων | Επιχειρησιακό Πρόγραμμα | `EpProgramManager.js` |
| Χώρος Εργασίας | Άνοιγμα χώρου Εργασιών / Αποθήκη Εργασιών | `TaskAssignmentManager.js` |
| Εξαγωγές | Τεχνικό Πρόγραμμα | `TechnicalProgramExport.js` |
| Εξαγωγές | Πύλη Διαφάνειας | `PortalHubModal.js` |
| Εξαγωγές | Εξαγωγή Δεδομένων | `ExportData.js` |
| Εξαγωγές | Αναφορές σε PDF | `ReportsModal.js` |
| Εργαλεία | Ιστορικό Ενεργειών | `AuditLogViewer.js` |
| Εργαλεία | Υποδείγματα Εγγράφων | `DocumentTemplatesManager.js` |
| Εργαλεία | Μαζική Εισαγωγή από Excel | `SubprojectExcelImportModal.js` |
| Εργαλεία | Δημιουργία Απολογισμού Δημοτικής Περιόδου | `ApologismosManager.js` |
| Σύστημα | Αντίγραφα Ασφαλείας | `BackupManager.js` |
| Σύστημα | Κέντρο Ειδοποιήσεων | `NotificationSettingsCenter.js` |
| Σύστημα | Ιστορικό Email | `EmailSendHistory.js` |
| Σύστημα | Διαχείριση Χρηστών | `UserManagement.js` |
| Σύστημα | Ρυθμίσεις Email | `EmailSettingsModal.js` |
| Σύστημα | Δημοτικές Ενότητες | `MunicipalUnitsManager.js` |
| Σύστημα | Εργαλεία προγραμματιστή | ξανανοίγει `PostSetupChecklistBanner.js` |
| Σύστημα | Επαναδημιουργία ευρετηρίου | `rebuild-projects-index` |

Κύριο σώμα: λίστα ελέγχου μετά την εγκατάσταση (email, αντίγραφο, πύλη), υπενθύμιση αντιγράφου, επισκόπηση `DashboardOverviewZone.js` με συνοπτικά στατιστικά, ενεργά φίλτρα `ActiveFiltersBanner.js`, κάρτες `ProjectCard.js` ομαδοποιημένες κατά έργο, αυτοκόλλητα σημειώσεων. Για ENGINEER/USER: `RoleDashboardWidget.js` (προεπισκόπηση εργασιών).

Κάτω δεξιά: σημειώσεις, `DashboardOpsFabStack.js` (ραντάρ προθεσμιών, μαζική ανανέωση ΚΗΜΔΗΣ, οδηγός χρήσης `UserGuideModal.js` + `UserGuideTour.js`), toasts εργασιών, overlay κλειδώματος συνεδρίας ΚΗΜΔΗΣ.

Ενέργειες πάνω στην κάρτα `ProjectCard.js`: έγκριση πίστωσης, πρόσκληση, ωρίμανση, ένταξη, μελέτη, ημερολόγιο, αρχεία, αναφορά PDF. Η κάρτα δείχνει κατάσταση, φρεσκάδα ΚΗΜΔΗΣ, χρέωση, ζώνη σύμβασης, υπαινιγμό πύλης, παραβάσεις 12μήνου. Κλικ ανοίγει `SubprojectDetailModal.js` (ανάγνωση). Επεξεργασία ανοίγει `ProjectForm.js`.

Φόρτωση δεδομένων (`loadDataWithCache`): παράλληλα `load-all-projects`, `load-all-entaxeis`, `load-all-proskliseis`, `load-egkriseis-data`, `load-egkrisi-links`, μετά `load-subproject-links`. Cache περίπου 5 λεπτών· `forceRefresh` το καθαρίζει. Εμπλουτισμός locks: `src/utils/dashboardProjectLocks.js`, `mergeLoadedSubproject.js`. Μετά από αποθήκευση κάρτας συχνά αρκεί `load-one-subproject`.

### 8.1 Καρτέλα υποέργου — δύο φάσεις

Δεν υπάρχει μακριά σειρά καρτελών. `src/utils/projectFormPhases.js` κρατά τα κλειδιά της φάσης Α για έλεγχο μη αποθηκευμένων αλλαγών (`ProjectFormUnsavedModal.js`), όχι ονόματα καρτελών.

| Καρτέλα | Επεξεργασία | Ανάγνωση |
|---|---|---|
| Α — Στοιχεία | Ταυτότητα, κωδικοί, χρηματοδότηση, σχόλια, χρέωση, κατάσταση, αρχεία | Τα ίδια, συν σύνδεσμος ΕΠ και διακόπτης πύλης |
| Β — ΚΗΜΔΗΣ (στη φόρμα: «Β — ΚΗΜΔΗΣ & Σύμβαση») | Αλυσίδα σύμβασης. Κλειδωμένη μέχρι να αποθηκευτεί η φάση Α | Εμφάνιση, ανανέωση, επαναφορά στιγμιοτύπου |

Η φάση Β περιλαμβάνει ράγα ζωής, αποτελέσματα σταδίων, συμβάσεις, συμπληρωματικές, πληρωμές, ΑΠΕ, παρατάσεις, μητρώο εγγράφων, και τα παράθυρα που περιγράφει η ενότητα 13. Επαναφορά φάσης Β: «↺ Επαναφορά Φάσης Β» καθαρίζει πεδία μέσω `khmdhsPhaseResetFields.js` (δεν σβήνει τη φάση Α).

Οπτική γλώσσα: styled-components, σκούρο slate (`#0f172a`, `#1e293b`), indigo (`#6366f1`, `#4f46e5`), overlays με θόλωμα. Κοινό χρώμιο φορμών: `modernFormChrome.js`. Z-index: overlays ~9000–10000, modals 10001–50000, κρίσιμοι διάλογοι ~100000. Νέα οθόνη αντιγράφει υπάρχον παράθυρο (Προσκλήσεις / κάρτα), δεν φέρνει δική της παλέτα. Επιβεβαιώσεις μέσω `useToast` και `ConfirmModal`, όχι `alert`/`confirm`.

Βοηθητικά παράθυρα που δεν είναι καταχωρήσεις μενού: προεπισκόπηση PDF `PDFViewer.js`, μετονομασία `FileRenameModal.js`, επιτυχία εξαγωγής `ExportSuccessModal.js`, αναζήτηση υποέργου `SubprojectSearchModal.js`. Τα `SearchFilters.js` και `OrimanthiAepoWidget.js` υπάρχουν ως αρχεία αλλά δεν τα εισάγει άλλο component.

## 9. Εξαγωγές που παράγει ο υπάλληλος

| Μορφή | Από πού |
|---|---|
| Excel γενικών δεδομένων | `ExportData.js` |
| Excel τεχνικού προγράμματος | `TechnicalProgramExport.js` |
| Excel/PDF εντάξεων | `EntaxisExportDialog.js` και `ReportsModal` |
| Excel/PDF προσκλήσεων, και Excel με ωρίμανση | `ProsklisisExportDialog.js` |
| PDF τεσσάρων καταλόγων (υποέργα, εντάξεις, προσκλήσεις, εγκρίσεις) | `ReportsModal.js` → `SubprojectsReport.js`, `EntaxeisReport.js`, `ProskliseisReport.js`, `EgkriseisReport.js` |
| PDF στατιστικών και χαρτοφυλακίου / κενών ΚΗΜΔΗΣ | `Statistics.js`, `StatisticsExportModal.js`, `PortfolioReportExportModal.js`· handlers `export-statistics-report`, `export-portfolio-report` (`public/statisticsExportHandler.js`, `khmdhsPortfolioExportHandler.js`) |
| PDF υποέργου πλήρης ή συνοπτική | `SubprojectReportChoiceModal.js`· δεδομένα `src/utils/subprojectReportData.js`· PDF `SubprojectDetailReport.js`, `SubprojectSummaryReport.js` |
| PDF μελέτης και λίστας μελετών | `MeletaiManager.js` |
| Excel/PDF hub ωρίμανσης και Word δελτίου | `OrimanthiManager.js` |
| PDF + PPTX απολογισμού | `ApologismosManager.js` |
| Excel επιχειρησιακού | `EpProgramManager.js`· PDF στατιστικών ΕΠ `EpProgramStatsReport.js` |
| JSON πύλης στο Dropbox | `PortalHubModal.js` |
| Excel INVEST | κώδικας `InvestExport.js`, χωρίς κουμπί μενού |
| Κοινά κομμάτια PDF | `ReportHeader.js`, `ReportFooter.js`, `ReportContinuationHeader.js`, `ReportStyles.js`, `EntaxiDetailReport.js` |

Δύο μηχανές PDF. Αναφορές καταλόγων και κάρτας υποέργου χτίζονται στον renderer με `@react-pdf/renderer` (`src/components/pdf/`). Αναφορές στατιστικών, χαρτοφυλακίου ΚΗΜΔΗΣ, μελετών και ωρίμανσης χτίζονται ως HTML στο main (`statisticsReportHtml.js`, `khmdhsPortfolioReportHtml.js`, `meletaiReportHtml.js`, `orimanthiReportHtml.js`) και γίνονται PDF με κρυφό παράθυρο (`htmlPdfExportHelper.js`, `printToPDF`). Ελληνικά σε pdf-lib: `pdfFontHelper.js` (Segoe/Arial/Calibri των Windows ή ενσωματωμένες). Κείμενο από PDF χωρίς OCR: `pdfTextExtract.js` (έως λίγες σελίδες, για Διαύγεια).

Άνοιγμα εξαγόμενου: `open-exported-file`. Αποθήκευση PDF που φτιάχνει η οθόνη: `show-save-dialog`, `save-pdf-file`, `write-pdf-file`, `merge-and-save-pdf`, `pick-save-folder`.

## 10. Ενημερώσεις εφαρμογής

`public/dropbox-updater.js` + `public/update-config.js` + `public/appUpdatePolicy.js`. Στην εκκίνηση (με τυχαία καθυστέρηση 3–15 δευτ.) και περίπου κάθε ώρα ελέγχει ένα `version.json` στο Dropbox (το πλήρες URL είναι σταθερά μέσα στο `update-config.js`). Κατεβάζει installer στο φάκελο λήψεων, υποφάκελος `ergohub-updates`, αρχείο `ergohub-update.exe`. Ρόλοι που επιτρέπεται να δουν ενημέρωση: `SUPERADMIN`, `ADMIN`, `USER` (όπως είναι γραμμένο στο config). Η οθόνη είναι `UpdateNotifier.js`. Κανάλια: `check-for-updates`, `download-update`, `install-update`, `get-update-state`. Γεγονότα: `update-available`, `update-downloaded`, `update-download-progress`, `update-installed`. Αποτυχία δικτύου είναι σιωπηλή (`SILENT_FAIL`). Το `scripts/build-and-upload.js` είναι η ροή ανεβάσματος installer· δεν τρέχει ως μέρος της κανονικής λειτουργίας του δήμου.

«Τι νέο υπάρχει»: `WhatsNew.js`, κείμενο μέσα στην εφαρμογή, όχι ξεχωριστή υπηρεσία.

## 11. Ημερολόγιο, email, ειδοποιήσεις

### 11.1 SMTP

`public/taskAssignmentEmailService.js`. Gmail μέσω nodemailer. Αρχείο `{dataDir}/config/email-config.json`. Το app password αποθηκεύεται με πρόθεμα `safeStorage:v1:` (Electron `safeStorage`), ποτέ plaintext αν η κρυπτογράφηση πέτυχε. Αν αποκρυπτογράφηση αποτύχει, ο κωδικός δεν επιστρέφεται· μένει σημαία αποτυχίας. HTML περνά από `escapeHtml`. Λογότυπο email πρέπει να είναι κάτω από 80KB αλλιώς το Gmail κόβει το μήνυμα.

Κανάλια: `get-email-config`, `save-email-config`, `test-email-config`, `is-email-configured`, `toggle-workspace-email-notifications`. Οθόνη: `EmailSettingsModal.js`.

### 11.2 Τι στέλνει email

| Γεγονός | Module |
|---|---|
| Ανάθεση / σχόλιο / κατάσταση εργασίας | `taskAssignmentEmailService.js` |
| Χαιρετισμός χρέωσης μηχανικού | `public/supervisorChargeGreetingEmail.js` |
| Προθεσμίες ημερολογίου | `procurementCalendarReminderService.js` |
| ΑΕΠΟ ωρίμανσης | `orimanthiAepoReminderService.js`· πρώτος έλεγχος ~45 δευτ. μετά την εκκίνηση, μετά κάθε 6 ώρες |
| Υπενθυμίσεις σημειώσεων | handlers στο `electron.js` + `note_reminder_config.json`· έλεγχος κάθε 5 λεπτά |
| Αίτημα φωτογραφιών απολογισμού | `apologismosPhotoRequestEmail.js` |

Προσωπικές προτιμήσεις (`notificationPreferences` στον χρήστη): τύποι email, ΑΕΠΟ, toasts εργασιών, ώρες ησυχίας. Οθόνη `MyNotificationPreferences.js`. Κέντρο διαχειριστή `NotificationSettingsCenter.js`: τύποι γεγονότων, παραλήπτες, χρονισμός, επανάληψη επείγοντος (περίπου 7 ημέρες). Ώρες ησυχίας και προτιμήσεις δεν παρακάμπτονται σιωπηλά από τον αποστολέα.

## 12. Εξωτερικά συστήματα

| Σύστημα | Βάση | Χρήση |
|---|---|---|
| ΚΗΜΔΗΣ OpenData | `https://cerpp.eprocurement.gov.gr` | Αλυσίδα δημόσιας σύμβασης. Λεπτομέρειες ενότητα 13 |
| Πύλη ΚΗΜΔΗΣ (σελίδες, όχι JSON) | `.../upgkimdis/unprotected/home.xhtml` | Άνοιγμα πράξης στον browser ή μέσα στην εφαρμογή |
| Διαύγεια OpenData | `https://diavgeia.gov.gr/luminapi/opendata` | Αποφάσεις ΑΠΕ, εντάξεων, προσκλήσεων, αποδοχής. Ενότητα 14 |
| Dropbox HTTP API | `api.dropboxapi.com`, `content.dropboxapi.com` | Ανέβασμα `erga.json` πύλης και λήψη installer |
| Gmail SMTP | μέσω nodemailer | Όλα τα email |
| Leaflet tiles | ό,τι ορίζει ο χάρτης απολογισμού | Μόνο απολογισμός |

Δεν υπάρχει λογαριασμός χρήστη σε αυτά τα συστήματα μέσα στην εφαρμογή, εκτός από το Gmail του δήμου (SMTP) και το Dropbox token της πύλης/ενημερώσεων. Το ΚΗΜΔΗΣ και η Διαύγεια καλούνται ως ανοιχτά δεδομένα.

## 13. ΚΗΜΔΗΣ

Σκοπός: κάθε κάρτα υποέργου δένεται με την πραγματική αλυσίδα σύμβασης. Ο υπάλληλος δίνει έναν ΑΔΑΜ, η εφαρμογή αναλύει την αλυσίδα, γεμίζει τη φάση Β, και σε μεταγενέστερη ανανέωση ξαναδιαβάζει το ΚΗΜΔΗΣ χωρίς να πατάει χειροκίνητες διορθώσεις.

### 13.1 Μορφή ΑΔΑΜ

`YY + ΤΥΠΟΣ (3–4 γράμματα) + 9 ψηφία`, π.χ. μορφή `26SYMV018523441`. Κανονική έκφραση στο `public/khmdhsOpenData.js` (`ADAM_REGEX`).

| Κωδικός | Νόημα | Πού γράφεται |
|---|---|---|
| REQ | Πρωτογενές αίτημα | `khmdhsRequestAdam`, `khmdhsRequestSnapshot`, `khmdhsRequestFetchedAt` |
| (επόμενο REQ) | Ανάληψη υποχρέωσης, όχι ξεχωριστός κωδικός τύπου | `khmdhsCommitmentAdam`, `khmdhsCommitmentSnapshot`, `khmdhsCommitmentFetchedAt`, `khmdhsCommitmentDecisions[]` |
| PROC | Διακήρυξη / πρόσκληση σύμβασης | `khmdhsNoticeAdam`, `khmdhsNoticeSnapshot`, `khmdhsNoticeFetchedAt` |
| AWRD | Κατακύρωση | `khmdhsAwardAdam`, `khmdhsAwardSnapshot`, `khmdhsAwardFetchedAt` |
| SYMV | Σύμβαση | Μία σύμβαση: `khmdhsAdam`, `khmdhsContractSnapshot`, `khmdhsContractFetchedAt`. Πολλές: τα ίδια μέσα σε κάθε γραμμή `contracts[]` |
| PAY | Εντολή πληρωμής | `khmdhsPayments[]` |

Στάδια που επιστρέφει το chain API (`parseChainLists` στο `khmdhsAdamChainService.js`): `requests`, `approvedRequests`, `notices`, `auctions`, `contracts`, `payments`. Η ανανέωση μετρά και `budgetCommitments`.

Ακυρωμένοι κρίκοι: δείκτης `*` (τροποποιημένος) ή `**` (ακυρωμένος). Οι ακυρωμένοι δεν μπαίνουν στα ενεργά στάδια· μαζεύονται στο `confirmedCancelledAdams` (`khmdhsCancelledAdams.js`, μέσα στο `khmdhsAdamChainMeta`). Αποτυχία δικτύου δεν είναι ακύρωση.

### 13.2 Άλλα πεδία κάρτας

- `khmdhsAdamChainMeta`: `linkedAdams`, χάρτες snapshots ανά ΑΔΑΜ, `confirmedCancelledAdams`, `parallelContracts`, `stageCounts`.
- `khmdhsContractChainHistory[]`, `khmdhsContractAmendments[]`, `khmdhsContractRoleLabel`.
- `khmdhsDataQualityReview`: θέματα και αποφάσεις χρήστη.
- `khmdhsChainLastRefreshedAt`, `khmdhsLastRefreshFindings`.
- `khmdhsSymvChainPlan`, `khmdhsSymvPlanAppliedAt`.
- `khmdhsChainStitchPlan`, `khmdhsChainSeedAdam`, `khmdhsBranchAnchorAdam`, `khmdhsBranchAnchorType`, `khmdhsActRootReqAdam`.
- `khmdhsUserEdits`: `{ fieldOverrides, excludedChainAdams, journal }`. Αυτά νικούν την επόμενη ανάκτηση.
- `khmdhsDocumentRegistry[]`, `khmdhsDocumentRegistryDismissed`, `khmdhsRelatedDocuments[]`.
- `khmdhsAcknowledgedSituationIds[]`.
- `supplementaryContracts[]`, `hasSupplementaryContracts`.
- `apeEntries[]` (και μέσα σε κάθε σύμβαση στις πολλές συμβάσεις). Η ΑΠΕ δεν είναι τύπος ΑΔΑΜ του ΚΗΜΔΗΣ· είναι απόφαση (συχνά Διαύγεια) με ποσό που οριστικοποιεί το πληρωτέο.
- `manualExtensionEntries[]`: παράταση δημάρχου / απόφαση, ρητά εκτός ανάρτησης ΚΗΜΔΗΣ.
- Παλιά κλειδιά που μπορεί να υπάρχουν σε παλιές κάρτες και αφαιρούνται από audit diffs: `khmdhsAdamChain`, `khmdhsAdamChainFetchedAt`, `khmdhsChainHistory`.

Χαρακτηρισμός κρίκου SYMV (`khmdhsChainKindClassifier.js`): `contract`, `modification`, `extension`, `republication`, `ape`, `other`, `uncertain`. Το `uncertain` δεν γίνεται σιωπηλά σύμβαση· ο χρήστης το λύνει στο `khmdhsDataQualityReview`. Η παράταση (`extension`) δεν αυξάνει το πληρωτέο ποσό. Αν υπάρχει ποσό ΑΠΕ, αυτό είναι το τελικό μετά την ΑΠΕ (`resolveMainContractTrackGross` στο `src/utils/khmdhsFields.js`).

Πολλές συμβάσεις: τα πεδία σύμβασης της ρίζας καθαρίζονται στην αποθήκευση (`mergeKhmdhsFieldsForSave`). Κάθε γραμμή `contracts[]` κρατά τα δικά της. Αν η εισερχόμενη αποθήκευση έχει κενό ΑΔΑΜ ενώ η κατάσταση δικαιούται ΑΔΑΜ, τα υπάρχοντα πεδία ΚΗΜΔΗΣ διατηρούνται.

ΦΠΑ: προεπιλογή 24% επί καθαρού (`public/khmdhsVatHelper.js`). Αν το μικτό/καθαρό δείχνει άλλο συντελεστή, συνάγεται. Αν το `totalCostWithVAT` ισούται με το καθαρό, η λογική δεν διπλοφορολογεί.

Παράλληλες συμβάσεις: αδερφές SYMV (`khmdhsParallelContracts.js`, `khmdhsParallelContractAmounts.js`). Ορφανή συμπληρωματική ελέγχεται, δεν κολλιέται σιωπηλά.

Πληρωμές: ζεύγος Δήμου και Περιφερειακού Ταμείου συγχωνεύεται σε μία λογική πληρωμή (`khmdhsPaymentReconciliation.js`). Άσχετες PAY φιλτράρονται.

Πρόταση κατάστασης: αν η αλυσίδα έχει σύμβαση και η κάρτα ήταν «σε διαδικασία σύμβασης», προτείνεται `ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ`, εκτός αν το πεδίο προστατεύεται.

### 13.3 HTTP

Module `public/khmdhsOpenData.js`. Βάση `KHMDHS_BASE`.

| Κλήση | Συνάρτηση |
|---|---|
| POST `/khmdhs-opendata/notice?page=0` | `fetchKhmdhsNoticeByAdam` |
| POST `/khmdhs-opendata/request?page=0` | `fetchKhmdhsRequestByAdam` |
| POST `/khmdhs-opendata/auction?page=0` | `fetchKhmdhsAuctionByAdam` |
| POST `/khmdhs-opendata/contract?page=0` | `fetchKhmdhsContractByAdam` |
| POST `/khmdhs-opendata/payment?page=0` | `fetchKhmdhsPaymentByAdam` |
| GET `/khmdhs-opendata/adamChain/{adam}` | `fetchKhmdhsAdamChain` |

`fetchWithRetry`: timeouts, επανάληψη σε 429/5xx, σεβασμός `Retry-After`, ακύρωση. Ουρά/cache: `khmdhsFetchPool.js`. Οπισθοχώρηση ρυθμού: `khmdhsThrottleState.js`. Μηνύματα προς τον χρήστη: `khmdhsHttpErrors.js`.

PDF συνημμένου: `/khmdhs-opendata/{request|notice|auction|contract|payment}/attachment/{adam}` (`src/utils/khmdhsPortalLinks.js`, `buildKhmdhsDocumentUrl`). Σελίδα πράξης: `buildKhmdhsPortalViewUrl`. Άνοιγμα μέσα στην εφαρμογή: `public/khmdhsPdfBrowserView.js` μέσω `open-khmdhs-act-view`, `cancel-khmdhs-act-view`, `prefetch-khmdhs-act-pdfs`. Αναμονή οθόνης: `KhmdhsActViewWaitOverlay.js`.

### 13.4 Ροές χρήστη

| Ροή | Τι γίνεται |
|---|---|
| Ανάκτηση με ΑΔΑΜ | `khmdhs-resolve-adam-chain` → `resolveKhmdhsAdamChain`. Η οθόνη εφαρμόζει με `src/utils/khmdhsChainApply.js`. Μετά την εφαρμογή, ουρά παραθύρων `khmdhsPostApplyQueue.js` σύμφωνα με `app/core/khmdhsPostFetch.js`: έλεγχος δεδομένων, εικόνα κατάστασης, ραφή, μητρώο εγγράφων, ΑΠΕ, λήξη σύμβασης |
| Ελαφριά έναντι πλήρους ανανέωσης | `decideKhmdhsRefreshMode`. Ελαφριά μόνο αν το ζωντανό σύνολο ΑΔΑΜ ταυτίζεται ακριβώς με το αποθηκευμένο. Αλλιώς πλήρης. Η μερική ραφή αποτυγχάνει κλειστά: δεν εφαρμόζεται τίποτα |
| Ανανέωση μίας κάρτας | `preview-subproject-khmdhs-refresh`. Σπόρος ΑΔΑΜ από `khmdhsChainRefreshSeed.js` / `app/core/khmdhsRefresh.js` |
| Μαζική | Ίδιο κανάλι με `batchMode`, συν `batch-khmdhs-refresh-eligible`, `start/end/check-khmdhs-batch-run`, `cancel-khmdhs-batch-refresh`. Πρόοδος: γεγονός `khmdhs-refresh-progress`. Οθόνη `KhmdhsBatchRefreshWidget.js` |
| Στιγμιότυπο πριν την ανανέωση | `{data.json}.before-refresh`, διατήρηση περίπου 30 ημερών. `create-khmdhs-refresh-snapshot`, `get-khmdhs-refresh-snapshot-info`, `restore-khmdhs-refresh-snapshot` |
| Μπαγιάτικα | `check-khmdhs-staleness`. Όριο `KHMDHS_STALE_DAYS` = 30 στο `app/core/khmdhsRefresh.js`. Σήμα `KhmdhsFreshnessBadge` |
| Κλείδωμα συνεδρίας στη μαζική | `lock-khmdhs-session` / `unlock-khmdhs-session` (ίδιο username + κωδικός). Overlay `KhmdhsSessionLockOverlay.js`. Αυτόματο κλείδωμα ~20 δευτ. όταν είναι οπλισμένο το σβήσιμο |
| Σβήσιμο υπολογιστή μετά τη μαζική | `arm/disarm/commit-khmdhs-idle-shutdown`, `public/khmdhsIdleShutdown.js`. Γεγονότα `khmdhs-idle-shutdown-tick`, `khmdhs-idle-shutdown-aborted` |
| Συμπληρωματική σύμβαση | `khmdhs-fetch-supplementary-contract` |
| Εικόνα κατάστασης | `public/khmdhsSituationReport.js` (ορφανή SYMV, παράλληλες, κομμένη αλυσίδα). Οθόνη `KhmdhsSituationModal.js` |
| Μητρώο εγγράφων | Χτίζεται στην οθόνη (`khmdhsDocumentRegistry.js`), όχι ως ξεχωριστό αρχείο δίσκου |

Αρχεία κατάστασης μαζικής (όχι cache του OpenData· η cache είναι μνήμη ανά τρέξιμο):

- `config/khmdhs-batch-report.json` και `config/khmdhs-batch-report.{key}.json` ανά χρήστη
- `config/khmdhs-batch-run.json` με καρδιά· μπαγιάτικο τρέξιμο περίπου στα 2 λεπτά

### 13.5 Παράθυρα ΚΗΜΔΗΣ (οθόνη)

Κέλυφος και στάδια: `KhmdhsPanelDisplay`, `KhmdhsLifecycleRail`, `KhmdhsStageCard`, `KhmdhsSymvChainTimeline`, `KhmdhsFormStageResults`, `KhmdhsRequestDisplay`, `KhmdhsCommitmentDisplay`, `KhmdhsNoticeDisplay`, `KhmdhsAwardDisplay`, `KhmdhsContractDetailDisplay`, `KhmdhsPaymentsDisplay`, `KhmdhsSupplementaryDisplay`, `KhmdhsApeDisplay`, `KhmdhsManualExtensionDisplay`.

Αποφάσεις μετά την ανάκτηση: `KhmdhsBranchPickerDialog`, `KhmdhsSymvChainPlannerDialog`, `KhmdhsDuplicateAnchorDialog`, `KhmdhsChainStitchPromptADialog`, `KhmdhsChainStitchPromptBDialog`, `KhmdhsDataReviewModal`, `KhmdhsSituationModal`, `KhmdhsPendingTasksModal`, `KhmdhsPendingFab`, `KhmdhsContractExpiryPromptDialog`, `KhmdhsApeEntryButton`, `KhmdhsApeEntryModal`, `KhmdhsApeConflictModal`, `KhmdhsSupplementaryConfirmDialog`, `KhmdhsSupplementaryDetailsModal`.

Διορθώσεις χρήστη: `KhmdhsPreSaveOverridesModal`, `KhmdhsUserEditsPanel`, `KhmdhsInlineField`, `KhmdhsFieldOverrideBadge`, `KhmdhsStatusCleanupModal`, `KhmdhsRemovableChainEntries`.

Λειτουργία: `KhmdhsChainRefreshDialog`, `KhmdhsRefreshActionButton`, `KhmdhsRefreshFindingsPanel`, `KhmdhsFreshnessBadge`, `KhmdhsBatchRefreshWidget`, `KhmdhsSessionLockOverlay`, `KhmdhsDocumentRegistryModal`, `KhmdhsDocumentRegistryPanel`, `KhmdhsDocumentRegistryChainView`, `KhmdhsRelatedDocumentsModal`, `KhmdhsManualExtensionModal`, `KhmdhsActViewWaitOverlay`.

### 13.6 Modules main για ΚΗΜΔΗΣ

| Αρχείο | Δουλειά |
|---|---|
| `khmdhsOpenData.js` | HTTP, αντιστοίχιση πεδίων, `mergeKhmdhsFieldsForSave` |
| `khmdhsAdamChainService.js` | Ανάλυση αλυσίδας, συμπληρωματική, ελαφρύς έλεγχος |
| `khmdhsChainKindClassifier.js` | Είδος κρίκου SYMV |
| `khmdhsChainCharacterizationEffects.js` | Εφαρμογή χαρακτηρισμού σε ποσά |
| `khmdhsRefreshMode.js` | Ελαφριά vs πλήρης |
| `khmdhsChainRefreshSeed.js` | Σπόρος ανανέωσης, ορατότητα μηχανικού |
| `khmdhsFetchPool.js` | Ταυτόχρονες κλήσεις και πρόοδος |
| `khmdhsThrottleState.js` | Οπισθοχώρηση μετά από 429 |
| `khmdhsHttpErrors.js` | Ελληνικά μηνύματα |
| `khmdhsVatHelper.js` | ΦΠΑ |
| `khmdhsPaymentReconciliation.js` | Συγχώνευση PAY |
| `khmdhsParallelContracts.js` / `khmdhsParallelContractAmounts.js` | Παράλληλες SYMV |
| `khmdhsContractEndDateResolver.js` | Ημερομηνία λήξης |
| `khmdhsCancelledAdams.js` | Ακυρωμένοι ΑΔΑΜ |
| `khmdhsSituationReport.js` | Εικόνα κατάστασης |
| `khmdhsDataQualityReport.js` | Θέματα πληρότητας |
| `khmdhsUserCopy.js` | Κοινά ελληνικά κείμενα |
| `khmdhsDateUtils.js` | Ημερομηνίες εγγραφών |
| `khmdhsIdleShutdown.js` | Προγραμματισμός σβησίματος Windows |
| `khmdhsPortfolioExportHandler.js` / `khmdhsPortfolioReportHtml.js` | PDF χαρτοφυλακίου |
| `khmdhsPdfBrowserView.js` | Προβολή PDF πράξης μέσα στο παράθυρο |

Κανόνας δοκιμών: ψεύτικος ΑΔΑΜ του seed (π.χ. `24PROC000000001`, `24SYMV000000001`) δεν «ανακτάται». Χωρίς ουρά fixture ή `e2e-set-khmdhs-live`, το `public/e2eMode.js` απαντά 404 «δεν υπάρχει απάντηση ΚΗΜΔΗΣ». Επιτυχής ανάκτηση σε δοκιμή θέλει πραγματικό ΑΔΑΜ και ζωντανή κλήση, ή ρητό fixture. Μην εφευρίσκεις ανάδοχο ή ποσό για να γεμίσει ψεύτικη αλυσίδα.

## 14. Διαύγεια

Module `public/diavgeiaOpenData.js`. Βάση `https://diavgeia.gov.gr/luminapi/opendata`.

| Κλήση | Χρήση |
|---|---|
| `/decisions/{ada}.json` | Απόφαση από ΑΔΑ |
| `/organizations/{id}.json`, `/types/{id}.json`, `/units/{id}.json` | Εμπλουτισμός απόφασης |
| `/search.json` | Αναζήτηση, κυρίως αποδοχή ένταξης |
| PDF | `documentUrl`, `/decisions/{ada}/document`, `https://diavgeia.gov.gr/doc/{ada}.pdf` |

Υψηλότερα:

| Module | Δουλειά |
|---|---|
| `entaxiDiavgeiaService.js` | Ένταξη από ΑΔΑ, κείμενο PDF, ανάλυση (`app/core/entaxiDiavgeiaParse.js`) |
| `prosklisiDiavgeiaService.js` | Πρόσκληση από ΑΔΑ και εξαγωγή πεδίων από PDF |
| `entaxiAcceptanceDiavgeiaService.js` | Αναζήτηση και επισύναψη πράξης αποδοχής χρηματοδότησης |
| `src/utils/diavgeiaApeFetch.js` | ΑΠΕ υποέργου από ΑΔΑ |
| `src/utils/entaxiDiavgeiaFetch.js`, `entaxiDiavgeiaRegistry.js` | Οθόνη εντάξεων |
| `src/utils/prosklisiDiavgeiaFetch.js`, `prosklisiDiavgeiaRegistry.js` | Οθόνη προσκλήσεων |
| `app/core/prosklisiDiavgeiaPdf.js` | Εξαγωγή κωδικού, εύρους προϋπολογισμού και λήξης από θέμα/κείμενο PDF πρόσκλησης, χωρίς δίκτυο |

Κανάλια: `diavgeia-fetch-decision-by-ada`, `diavgeia-download-decision-pdf`, `diavgeia-fetch-prosklisi-by-ada`, `diavgeia-fetch-entaxi-by-ada`, `diavgeia-search-entaxi-acceptance`, `diavgeia-attach-entaxi-acceptance`. E2E ουρά: `e2e-queue-diavgeia-acceptance`.

## 15. Κατάλογος IPC

Μετρημένα στις 2026-10-21: 406 `ipcMain.handle` και όλα είναι στο `ALLOWED_INVOKE`. Επιπλέον το allowlist έχει `restart-app`, που είναι `ipcMain.on` (όχι handle). Σύνολο invoke allowlist: 407.

Γεγονότα main → οθόνη (`ALLOWED_RECEIVE`): `app-close-blocked`, `backup-completed`, `backup-progress`, `locks-changed`, `task-data-changed`, `update-available`, `update-downloaded`, `update-download-progress`, `update-installed`, `task-notification`, `khmdhs-refresh-progress`, `khmdhs-idle-shutdown-tick`, `khmdhs-idle-shutdown-aborted`.

Κανάλια μόνο για δοκιμές (ενεργά όταν η διαδικασία είναι E2E): `e2e-queue-open-files`, `e2e-queue-folder-pick`, `e2e-queue-save-path`, `e2e-queue-khmdhs-fixtures`, `e2e-queue-diavgeia-acceptance`, `e2e-set-khmdhs-live`, `e2e-last-edit-menu`, `e2e-spellcheck-status`. Οι ουρές διαλόγων (`queueOpenFiles` / `queueSavePath`) μπαίνουν πριν το κλικ, γιατί ο υπάλληλος δεν πληκτρολογεί όνομα αρχείου μέσα στην αναζήτηση έργων.

### 15.1 Ονόματα καναλιών κατά πρόθεμα

**get (60):** get-all-entity-names, get-all-subprojects, get-all-supervisors, get-app-config, get-audit-log, get-backup-info, get-backup-list, get-backup-location, get-backup-settings, get-backup-status, get-calendar-config, get-calendar-custom-events, get-contractor-registry-files, get-contractor-registry-record, get-data-dir, get-document-template-path, get-email-config, get-email-send-history, get-entaxi-file-path, get-entaxi-files, get-ep-actions-for-subproject, get-ep-program, get-ep-program-statistics, get-ep-subproject-link-map, get-file-path, get-folder-contents, get-khmdhs-batch-report, get-khmdhs-refresh-snapshot-info, get-khmdhs-session-lock, get-meletai-config, get-meletai-subprojects, get-meleti-by-subproject, get-meleti-folder-files, get-municipal-units-config, get-my-notification-preferences, get-note-files, get-note-reminder-config, get-notes-linked-entities, get-online-users, get-orimanthi-aepo-alerts, get-orimanthi-config, get-projects, get-proposal-files, get-proposal-folder-files, get-prosklisi-files, get-registered-engineers, get-site-diary-entry-counts, get-subfolder-contents, get-subproject-files, get-subproject-id-by-number, get-subproject-report-attachments, get-subproject-site-diary, get-task-assignment, get-task-assignment-access, get-task-assignment-permissions, get-task-assignments-summary, get-update-state, get-user-downloads-path, get-users, get-users-list

**delete (44):** delete-backup, delete-calendar-custom-event, delete-contractor-registry-file, delete-contractor-registry-record, delete-document-category, delete-document-template, delete-egkrisi-file, delete-egkrisi-link, delete-egkrisi-pdf-completely, delete-egkrisi-pdf-from-subproject, delete-egkrisi-subproject, delete-entaxi, delete-entaxi-file, delete-entaxi-modification, delete-ep-action, delete-file, delete-file-from-folder, delete-files, delete-item-from-folder, delete-item-from-subfolder, delete-meleti, delete-meleti-file, delete-meleti-folder, delete-meleti-folder-file, delete-meleti-group, delete-note-file, delete-note-files-dir, delete-proposal, delete-proposal-file, delete-proposal-folder, delete-proposal-folder-file, delete-proposal-group, delete-prosklisi, delete-prosklisi-file, delete-prosklisi-files, delete-prosklisi-folder, delete-prosklisi-group, delete-prosklisi-modification, delete-site-diary-entry, delete-site-diary-photo, delete-subproject, delete-task-assignment, delete-task-assignment-attachment, delete-user

**save (31):** save-app-config, save-backup-location, save-backup-settings, save-calendar-config, save-calendar-custom-event, save-contractor-registry-record, save-egkriseis-data, save-egkrisi, save-email-config, save-entaxi, save-ep-action, save-files, save-funding-options, save-khmdhs-batch-report, save-khmdhs-refresh-findings, save-meletai-config, save-meleti, save-modification, save-municipal-units-config, save-municipality-logo, save-my-notification-preferences, save-note-groups, save-note-reminder-config, save-notes, save-orimanthi-config, save-pdf-file, save-portal-published, save-project-data, save-proposal, save-prosklisi, save-prosklisi-modification

**apologismos (27):** apologismos-add-from-subproject, apologismos-add-legacy-card, apologismos-dismiss-amount-badge, apologismos-export-photo, apologismos-export-pptx, apologismos-frame-cover-images, apologismos-get-meta, apologismos-get-periods, apologismos-get-presentation, apologismos-get-report, apologismos-list-eligible-subprojects, apologismos-remove-card, apologismos-remove-photo, apologismos-reorder-photo-primary, apologismos-request-card-photos, apologismos-resolve-media-map, apologismos-save-cover-image, apologismos-save-map-snapshot, apologismos-save-photo, apologismos-save-report, apologismos-select-cover-images, apologismos-select-photos, apologismos-sync-amounts, apologismos-update-appearance, apologismos-update-card, apologismos-upsert-period, apologismos-write-export-file

**load (25):** load-all-entaxeis, load-all-meletai, load-all-projects, load-all-proposals, load-all-proskliseis, load-all-subprojects, load-contractor-registry, load-document-templates, load-egkriseis-data, load-egkriseis-v2, load-egkrisi-links, load-entaxi-data, load-ep-programs, load-funding-options, load-notes, load-one-subproject, load-organized-egkriseis-structure, load-portal-published, load-project-egkriseis, load-prosklisi-modifications, load-site-diary-hub, load-subproject-links, load-task-assignments, load-task-notifications, load-unlinked-egkriseis

**export (14):** export-ep-program, export-invest-projects, export-meletai-hub-report, export-meletai-study-report, export-orimanthi-hub-report, export-portal-data, export-portfolio-report, export-proposal, export-proskliseis-excel, export-proskliseis-orimanthi-excel, export-proskliseis-pdf, export-prosklisi, export-statistics-report, export-subprojects-import-template

**open (14):** open-contractor-registry-file, open-document-template, open-egkrisi-v2-pdf, open-exported-file, open-external-url, open-file-dialog, open-khmdhs-act-view, open-meleti-file, open-note-file, open-pdf-file, open-proposal-file, open-prosklisi-folder, open-site-diary-photo, open-task-assignment-file

**download (13):** download-document-template, download-egkriseis-pdf, download-entaxi-file, download-ep-program-template, download-file-from-folder, download-file-from-subfolder, download-meleti-file, download-proposal-file, download-prosklisi-file, download-subproject-file, download-task-assignment-file, download-task-assignment-folder, download-update

**add (11):** add-document-category, add-entaxi-approval-files, add-files-to-group, add-files-to-prosklisi-group, add-meletai-study-category, add-meleti-file-group, add-site-diary-entry, add-site-diary-photos, add-task-assignment-assignees, add-task-assignment-comment, add-task-assignment-files

**check (11):** check-data-dir-exists, check-entity-lock, check-file-exists, check-folder-has-config, check-for-updates, check-khmdhs-batch-run, check-khmdhs-staleness, check-meleti-number, check-project-lock, check-projects-locks-bulk, check-user-email

**create (10):** create-backup, create-credit-approval, create-entity-lock, create-file-group, create-khmdhs-refresh-snapshot, create-manual-egkrisi-link, create-project-lock, create-prosklisi-group, create-task-assignment, create-user

**select (10):** select-backup-folder, select-data-folder, select-excel-file, select-file, select-folder, select-folder-files-flat, select-multiple-files, select-municipality-logo, select-site-diary-photos, select-subprojects-import-xlsx

**update (10):** update-document-category, update-egkrisi-project-title, update-egkrisi-subproject-title, update-entaxi-modification, update-prosklisi-modification, update-site-diary-entry, update-subproject-supervisor-engineers, update-task-assignment, update-task-assignment-status, update-user

**upload (9):** upload-contractor-registry-files, upload-document-template, upload-egkriseis-pdfs, upload-meleti-files, upload-meleti-folder, upload-note-files, upload-proposal-files, upload-proposal-folder, upload-prosklisi-files

**e2e (8):** όπως στην εισαγωγή της ενότητας.

**rename (7):** rename-document-template, rename-entaxi-file, rename-meleti-file, rename-proposal-file, rename-prosklisi-file, rename-subproject-file, rename-user

**view (7):** view-egkriseis-pdf, view-egkrisi-file, view-entaxi-file, view-file-from-folder, view-file-from-subfolder, view-modification-pdf, view-prosklisi-file

**diavgeia (6):** diavgeia-attach-entaxi-acceptance, diavgeia-download-decision-pdf, diavgeia-fetch-decision-by-ada, diavgeia-fetch-entaxi-by-ada, diavgeia-fetch-prosklisi-by-ada, diavgeia-search-entaxi-acceptance

**clear (5):** clear-all-locks, clear-audit-log, clear-khmdhs-batch-report, clear-municipality-logo, clear-proposal-audit-log

**link (5):** link-egkrisi-manual, link-egkrisi-to-subproject, link-ep-subproject, link-meleti-subproject, link-subproject-to-subproject

**khmdhs (4) συν σχετικά που δεν αρχίζουν από khmdhs:** khmdhs-fetch-contract-by-adam, khmdhs-fetch-notice-by-adam, khmdhs-fetch-supplementary-contract, khmdhs-resolve-adam-chain. Επίσης: preview-subproject-khmdhs-refresh, cancel-khmdhs-batch-refresh, cancel-khmdhs-act-view, batch-khmdhs-refresh-eligible, check-khmdhs-staleness, check-khmdhs-batch-run, start-khmdhs-batch-run, end-khmdhs-batch-run, arm-khmdhs-idle-shutdown, disarm-khmdhs-idle-shutdown, commit-khmdhs-idle-shutdown, lock-khmdhs-session, unlock-khmdhs-session, acquire-khmdhs-refresh-lock, release-khmdhs-refresh-lock, create-khmdhs-refresh-snapshot, restore-khmdhs-refresh-snapshot, prefetch-khmdhs-act-pdfs, open-khmdhs-act-view.

**Υπόλοιπα μεμονωμένα:** find-egkrisi-keys-by-subproject-id, find-project-by-subproject-id, find-project-by-title, find-subproject-by-title, preview-ep-program, preview-subprojects-excel-import, set-dashboard-session-active, set-proposal-file-prosklisi-link, set-proposal-group-permit-issued, commit-subprojects-excel-import, copy-document-template, copy-file, fix-audit-log-projectids, fix-entaxi-file-objects, import-egkriseis-csv, import-ep-program, leave-task-assignment-workspace, leave-task-work-archive, mark-task-notifications-read, mark-task-notifications-read-for-task, remove-entity-lock, remove-meletai-study-category, unlock-project, write-debug-log, write-pdf-file, apply-orimanthi-pending-template, authenticate, change-password, clean-entaxi-modification-file, getAppVersion, has-users, install-update, is-email-configured, log-proposal-activity, merge-and-save-pdf, move-proposal-entry, peek-projects-index, pick-save-folder, rebuild-projects-index, refocus-window, register-user, resolve-site-diary-photos, run-meletai-maintenance, scan-egkriseis-folder, search-proposal-files, send-test-procurement-calendar-reminder, show-save-dialog, subproject-direct-data-exists, test-email-config, toggle-workspace-email-notifications, unlink-meleti-subproject, unwatch-task-file, validate-and-clean-egkrisi-links, verify-backup, watch-task-file, cleanup-duplicate-files, cleanup-old-backups, cleanup-temp-files, cancel-backup, restart-app.

Τυπική απάντηση handler: `{ success: true, data }` ή `{ success: false, error }` με ελληνικό μήνυμα. Εξαιρέσεις υπάρχουν σε παλιότερα κανάλια που επιστρέφουν απευθείας τιμή (`getAppVersion`, `get-data-dir`, `get-app-config`). Μην υποθέτεις ενιαίο φάκελο για όλα.

## 16. Ευρετήριο modules main (`public/`)

Εκτός από `electron.js`, `preload.js` και τα khmdhs/diavgeia της ενότητας 13–14:

| Αρχείο | Δουλειά |
|---|---|
| `appConfig.js` | dataDir, app-config, δείκτης userData |
| `safeWrite.js` | Ατομική εγγραφή JSON |
| `logger.js` | Καταγραφή σφαλμάτων main |
| `passwordAuth.js` | scrypt + legacy SHA-256 |
| `fileLock.js` | Κλειδώματα υπηρεσιών |
| `concurrencyGuards.js` | Προστασία ταυτόχρονων εγγραφών |
| `projectsIndex.js` | Ευρετήριο υποέργων |
| `subprojectSaveMerge.js` | Συγχώνευση αποθήκευσης κάρτας |
| `subprojectExcelImport.js` | Μαζική εισαγωγή |
| `prosklisiFileOps.js` | Δέντρο αρχείων πρόσκλησης |
| `prosklisiDeadlineHelper.js` | Προθεσμίες πρόσκλησης |
| `prosklisiExportHandler.js` / `prosklisiOrimanthiExcel.js` | Εξαγωγές προσκλήσεων |
| `entaxiDiavgeiaService.js`, `entaxiAcceptanceDiavgeiaService.js`, `prosklisiDiavgeiaService.js` | Διαύγεια |
| `taskAssignmentService.js` | Δίσκος εργασιών |
| `taskAssignmentEmailService.js` | SMTP και πρότυπα email |
| `supervisorChargeGreetingEmail.js` | Email νέας χρέωσης |
| `meletaiService.js`, `meletaiConfigService.js`, `meletaiExportHandler.js`, `meletaiReportHtml.js` | Μελέτες |
| `orimanthiConfigService.js`, `orimanthiAepoReminderService.js`, `orimanthiExportHandler.js`, `orimanthiHubExcel.js`, `orimanthiReportHtml.js`, `orimanthiProjectCategoriesHelper.js`, `orimanthiFileCategoriesHelper.js` | Ωρίμανση |
| `siteDiaryService.js` | Εργοτάξιο |
| `contractorRegistryService.js` | Ανάδοχοι |
| `epProgramService.js`, `epProgramExportHandler.js`, `epProgramTemplate.js`, `epProgramStats.js` | Επιχειρησιακό |
| `apologismos*.js` | Απολογισμός (πολλά αρχεία, ενότητα 7.11) |
| `calendarConfigService.js`, `calendarCustomEventsService.js`, `calendarEventsBuilder.js`, `procurementCalendarReminderService.js` | Ημερολόγιο |
| `municipalUnitsConfigService.js` | Ενότητες και λογότυπο |
| `portalDropboxUploader.js` | Ανέβασμα πύλης |
| `dropbox-updater.js`, `update-config.js`, `appUpdatePolicy.js` | Ενημέρωση εφαρμογής |
| `backupRestoreApply.js` | Επαναφορά αντιγράφου |
| `statisticsExportHandler.js`, `statisticsReportHtml.js` | Στατιστικά PDF |
| `investExportHandler.js` | INVEST Excel |
| `auditFieldLabels.js`, `auditFieldLabels.json` | Ελληνικές ετικέτες diffs |
| `greekSpellcheck.js` | Ορθογραφία |
| `managedFileRename.js` | Ασφαλής μετονομασία |
| `e2eMode.js` | Fixtures και σημαία ζωντανού ΚΗΜΔΗΣ |
| `editContextMenu.js` | Μενού αντιγραφής/επικόλλησης |
| `chargeFilterUtils.js` | Φίλτρο χρέωσης |
| `htmlPdfExportHelper.js` | HTML → PDF με κρυφό BrowserWindow |
| `pdfFontHelper.js` | Ελληνική γραμματοσειρά για pdf-lib |
| `pdfTextExtract.js` | Κείμενο από PDF χωρίς OCR |
| `apologismosCoverFrameCache.js` | Cache κάδρου εξωφύλλου απολογισμού |

## 17. Δοκιμές

Τρία επίπεδα:

| Εντολή | Τι ανοίγει |
|---|---|
| `npm test` / `npm run test:jest` | Jest πάνω σε `src/**/*.test.js` |
| `npm run test:unit` | `node --test tests/unit/*.test.mjs` πάνω στα core modules |
| `npm run test:e2e:core` | `e2e/run-core.cjs`, πραγματικό Electron, προσωρινός φάκελος, δεν ακουμπά τα δεδομένα του δήμου |
| `npm run test:all` | `scripts/run-all-tests.cjs` |

Προδιαγραφές E2E (κλικ όπως ο υπάλληλος): `p0` κάρτα, `p1` λίστα, `p2` κύκλος ζωής και χρήστες και audit, `p3` κατάλογοι (εντάξεις, προσκλήσεις, εγκρίσεις, αρχεία, εργασίες, ημερολόγια), `p4` ΚΗΜΔΗΣ (πύλες, είδη ΑΔΑΜ, ανανέωση, συνεδρία, σχέδια σύμβασης, μετά την ανάκτηση, εισαγωγή Excel), `p5` αναφορές, `p7` πύλη, `p8` ωρίμανση, `p9` μελέτες, `p10` επιχειρησιακό, `p11` απολογισμός, `p12` αντίγραφα, `p13` email και είσοδος, `p14` μητρώο αναδόχων. Χάρτης ροών: `e2e/ROADMAP.md`. Σπορά: `e2e/helpers/seed.cjs`. Υποχρεωτικά πεδία σπέρνονται πλήρη· οι κανόνες φόρμας δεν χαλαρώνουν για να περάσει τεστ.

Scripts επαλήθευσης ΚΗΜΔΗΣ (`scripts/verify-khmdhs-*.js`) είναι χειροκίνητα εργαλεία, όχι η σουίτα CI.

Νέο `data-testid` στο `src/` δεν φαίνεται στο Electron αν δεν προηγηθεί `npx craco build`.

## 18. Χτίσιμο και έκδοση

| Εντολή | Αποτέλεσμα |
|---|---|
| `npm start` | Electron, φορτώνει `build/index.html` |
| `npm run dev` | Το ίδιο με inspect port 5858 |
| `npm run build` | `craco build`, μνήμη 4GB |
| `npm run dist` / `electron-pack` | build + electron-builder NSIS |
| `npm run build:upload` | installer και ανέβασμα (μόνο όταν ζητηθεί ρητά) |
| `postinstall` | `scripts/sync-apologismos-fonts.js` |

Έκδοση μόνο στο τελευταίο ψηφίο του `package.json` και στα δύο σημεία του `package-lock.json` (ρίζα και `packages.""`), ποτέ στις εκδόσεις βιβλιοθηκών. Ο φάκελος `build/` και `dist/` δεν είναι πηγαίος κώδικας.

## 19. Οπτικοί και προϊόντικοι κανόνες που επηρεάζουν τον κώδικα

- Νέο παράθυρο αντιγράφει δομή υπάρχοντος: επάνω μπάρα, εργαλειοθήκη, κυλιόμενο σώμα, ίδια κουμπιά, ίδιες ετικέτες κατάστασης (εκτελούμενο, ολοκληρωμένο, επείγον, πλησιάζει).
- Κείμενα UI ελληνικά. Enums από `formOptions.js`.
- Πλήρη overlays (`position: fixed; inset: 0`) κλείνουν με `onClose`. Παίρνουν `currentUser` και `userRole`.
- Μηχανικός στα παράθυρα εντάξεων/προσκλήσεων/εγκρίσεων βλέπει ρόλο USER.
- `Dashboard.js` είναι το κέλυφος· μην δημιουργείς δεύτερη αρχική οθόνη.

## 20. Γλωσσάρι

| Όρος στην οθόνη | Τι είναι στον κώδικα |
|---|---|
| Υποέργο | Εγγραφή `data.json` μέσα σε `{projectId}/{subprojectId}` |
| Έργο | Ομάδα υποέργων με κοινό `projectId` / `projectTitle` |
| Χρέωση | `supervisorEngineerIds`, όχι `supervisor` |
| Ένταξη | Φάκελος `entaxeis` |
| Πρόσκληση | Φάκελος `ΠΡΟΣΚΛΗΣΕΙΣ` (χρηματοδοτική πρόσκληση, όχι η PROC του ΚΗΜΔΗΣ) |
| Έγκριση διάθεσης πίστωσης | Διπλή αποθήκευση PDF + `egkriseis-data.json` |
| ΑΔΑΜ | Αριθμός ΚΗΜΔΗΣ |
| ΑΔΑ | Αριθμός Διαύγειας |
| ΑΠΕ | Οριστικό ποσό σύμβασης, συνήθως από Διαύγεια, πεδία `apeEntries` |
| ΑΕΠΟ | Ημερομηνία ανανέωσης στην ωρίμανση (`aepoRenewalDate`) |
| Ωρίμανση / πρόταση | `ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ`, κανάλια `*-proposal*` |
| Μελέτη (μητρώο) | `ΜΕΛΕΤΕΣ`, όχι το είδος υποέργου `ΜΕΛΕΤΗ` |
| Είδος `ΜΕΛΕΤΗ` | Τιμή `projectType` σε κάρτα υποέργου |
| Χώρος εργασίας | `ANATHESEIS_ERGASION` |
| Πύλη διαφάνειας | Εξαγωγή `erga.json` στο Dropbox |
| Απενταγμένο | `projectStatus === ΑΠΕΝΤΑΓΜΕΝΟ`, εκτός στατιστικών |
| Φάση Α / Φάση Β | Στοιχεία κάρτας / αλυσίδα ΚΗΜΔΗΣ |
| dataDir | Φάκελος δήμου, συχνά `dedomena_ergon` |

## 21. Αμετάβλητοι κανόνες (μην τους παραβείς σε αλλαγή)

1. Ψεύτικος ΑΔΑΜ δεν γίνεται επιτυχής ανάκτηση.
2. Ακυρωμένος ΑΔΑΜ είναι μόνο δείκτης `**` / λίστα `confirmedCancelledAdams`, όχι σφάλμα HTTP.
3. `khmdhsUserEdits.fieldOverrides` και `excludedChainAdams` επιβιώνουν της ανανέωσης.
4. Παράταση σύμβασης δεν αυξάνει το πληρωτέο. Ποσό ΑΠΕ, όταν υπάρχει, είναι το τελικό.
5. Προεπιλογή ΦΠΑ 24%, χωρίς διπλό ΦΠΑ όταν το μικτό ισούται με το καθαρό.
6. Κατάσταση `ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ` δεν ανανεώνεται από ΚΗΜΔΗΣ.
7. `ΑΠΕΝΤΑΓΜΕΝΟ` δεν μετράει σε στατιστικά και εξαγωγές.
8. Μορφή `Πολλές Συμβάσεις`: τα πεδία σύμβασης μένουν στις γραμμές `contracts[]`, όχι στη ρίζα.
9. Μην γράφεις `supervisor`. Μην αλλάζεις `createdAt` σε ενημέρωση. Πίνακες αρχικοποιούνται ως `[]`.
10. Κωδικός: scrypt για νέους, αποδοχή legacy SHA-256, rehash στην είσοδο. Μην επιστρέφεις hash. Αυτοεγγραφή δεν φτιάχνει SUPERADMIN/ENGINEER και μένει `approved: false`.
11. Path από τον renderer μένει μέσα στο dataDir. SMTP password δεν μπαίνει σε log.
12. Νέο IPC μπαίνει και στο `ALLOWED_INVOKE` ή `ALLOWED_RECEIVE`.
13. JSON δεδομένων μέσω `safeWriteJSON`. Locks δεν αγνοούνται.
14. Η οθόνη φορτώνει το `build/`. Κοινά modules στο `app/core` μένουν χωρίς Node APIs.
15. Οπτική νέα οθόνη ακολουθεί τις υπάρχουσες, όχι νέα παλέτα.
16. Μην χαλαρώνεις υποχρεωτικά πεδία για να περάσει E2E.
17. `electron.js` δεν αντικαθίσταται ολόκληρο.
18. Το κλείδωμα συνεδρίας ΚΗΜΔΗΣ ξεκλειδώνει με τον ίδιο χρήστη και τον κωδικό του. Η μαζική συνεχίζει στην ίδια σύνοδο.
19. Χειροκίνητη παράταση (`manualExtensionEntries`) δεν αναρτάται στο ΚΗΜΔΗΣ.
20. Χαρακτηρισμός `uncertain` σε κρίκο σύμβασης θέλει απόφαση χρήστη.

## 22. Τι καλύφθηκε και τι μένει σκόπιμα συνοπτικό

Καλύφθηκαν με αντιπαραβολή κώδικα: ταυτότητα πακέτου, στρώματα, τεχνολογίες, εκκίνηση, ανάλυση dataDir, ρόλοι, κωδικοί (scrypt και legacy), όλοι οι φάκελοι εκκίνησης και οι φάκελοι κατ’ απαίτηση, οι οντότητες της ενότητας 7, ο χάρτης μενού, οι δύο φάσεις κάρτας, ΚΗΜΔΗΣ (τύποι ΑΔΑΜ, πεδία, HTTP, ροές, παράθυρα, αρχεία κατάστασης), Διαύγεια, email, Dropbox ενημερώσεων και πύλης, αντίγραφα, audit, locks, εξαγωγές, δοκιμές, και τα 406+1 κανάλια.

Σκόπιμα συνοπτικό, με δείκτη στην πηγή αντί για αντιγραφή εκατοντάδων τιμών:

- Υποκατηγορίες χρηματοδότησης: πλήρης λίστα στο `src/data/formOptions.js` (`FUNDING_DETAILS`).
- Κάθε προαιρετικό κλειδί μέσα σε snapshot ΚΗΜΔΗΣ: το σχήμα έρχεται από το OpenData και χαρτογραφείται στο `khmdhsOpenData.js`. Τα κλειδιά που οδηγούν τη συμπεριφορά είναι στην ενότητα 13.
- Κάθε πεδίο του report απολογισμού: `public/apologismosDomain.js`.
- Σειρά βημάτων μέσα σε κάθε E2E spec: `e2e/ROADMAP.md` και τα `e2e/p*.spec.cjs`.
- Το πλήρες URL του `version.json` και τα Dropbox tokens: μέσα στο `update-config.js` και στο token cache, όχι εδώ, γιατί είναι μυστικά πρόσβασης και όχι μοντέλο λειτουργίας.

Γνωστά όρια αυτής της καταγραφής, ελεγμένα και όχι κρυμμένα:

- Το `OrimanthiAepoWidget.js` δεν καλείται από άλλο component. Οι ειδοποιήσεις ΑΕΠΟ ζουν αλλού.
- Το `InvestExport.js` δεν έχει ορατό κουμπί μενού.
- Το `SearchFilters.js` δεν το χρησιμοποιεί το Dashboard (χρησιμοποιεί `AdvancedFilters.js`).
- Το `CalendarSettings.js` δεν είναι το παράθυρο που ανοίγει το μενού συστήματος.
- Ορισμένα κανάλια επιστρέφουν γυμνή τιμή αντί για `{ success, data }`.
- Υπάρχουν παλιές διαδρομές εγκρίσεων και παλιά κλειδιά ΚΗΜΔΗΣ για συμβατότητα. Μην τις σβήνεις σε ανάγνωση παλιάς κάρτας χωρίς migration.

Αν προσθέσεις λειτουργία, ενημέρωσε την αντίστοιχη ενότητα και την ενότητα 15 αν πρόσθεσες κανάλι. Η καταγραφή ξαναελέγχθηκε απέναντι στα 406 `ipcMain.handle`, στο allowlist του preload (λείπει από τους handlers μόνο το `restart-app`, που είναι `ipcMain.on` και είναι γραμμένο εδώ), στα αρχεία `public/*.js` και στους φακέλους εκκίνησης του dataDir.
