'use strict';

const fs = require('fs');
const path = require('path');

const POINTER = path.join(process.env.APPDATA || '', 'efarmogi-app', 'data-dir.json');

const REAL = {
  advisorContract: '25SYMV017808386',
  advisorNotice: '25PROC017733777',
  advisorAward: '25AWRD017805306',
  advisorRequest: '25REQ017699746',
  tenderNotice: '26PROC019504834',
  tenderRequest: '26REQ019343559',
  asphaltRequest: '25REQ018036589',
  asphaltContracts: ['26SYMV019081537', '26SYMV019123856'],
};

const SKIP = new Set([
  'entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ',
  'ANATHESEIS_ERGASION', 'ΑΠΟΛΟΓΙΣΜΟΣ', 'locks', 'config',
  'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΜΕΛΕΤΕΣ', 'backups', 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ',
  '_e2e_uploads',
]);

function resolveLaptopDataDir() {
  try {
    const raw = JSON.parse(fs.readFileSync(POINTER, 'utf8'));
    const dir = raw && raw.dataDir;
    if (dir && fs.existsSync(dir)) return dir;
  } catch {
    /* δεν υπάρχει δείκτης */
  }
  return null;
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function walkLaptopProjects(laptopDir) {
  const found = [];
  if (!laptopDir || !fs.existsSync(laptopDir)) return found;
  for (const projectDir of fs.readdirSync(laptopDir)) {
    if (SKIP.has(projectDir) || projectDir.startsWith('.')) continue;
    const projectPath = path.join(laptopDir, projectDir);
    let st;
    try { st = fs.statSync(projectPath); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const sub of fs.readdirSync(projectPath)) {
      const dataFile = path.join(projectPath, sub, 'data.json');
      if (!fs.existsSync(dataFile)) continue;
      const d = readJson(dataFile);
      if (d) found.push(d);
    }
  }
  return found;
}

function findByAdam(projects, adam) {
  const want = String(adam || '').toUpperCase();
  return projects.find((p) => {
    const keys = [
      p.khmdhsAdam, p.khmdhsNoticeAdam, p.khmdhsAwardAdam, p.khmdhsAuctionAdam,
    ].map((x) => String(x || '').toUpperCase());
    return keys.includes(want);
  }) || null;
}

function adamType(adam) {
  const m = String(adam || '').toUpperCase().match(/^\d{2}([A-Z]{3,4})\d{9}$/);
  return m ? m[1] : '';
}

/**
 * Ίδιο ΑΔΑΜ χρησιμοποιείται και στο adamChain (GET) και στην πράξη (POST).
 * Το σώμα πρέπει να έχει και λίστες αλυσίδας και content[] εγγραφής.
 */
function khmdhsFixture(row, extraStages = {}) {
  const adam = String(row.referenceNumber || '').toUpperCase();
  const type = adamType(adam);
  const stages = {
    requests: [],
    approvedRequests: [],
    notices: [],
    auctions: [],
    contracts: [],
    payments: [],
  };
  if (type === 'REQ') stages.requests = [adam];
  else if (type === 'PROC') stages.notices = [adam];
  else if (type === 'AWRD') stages.auctions = [adam];
  else if (type === 'SYMV') stages.contracts = [adam];
  else if (type === 'PAY') stages.payments = [adam];
  return {
    ok: true,
    status: 200,
    body: {
      content: [row],
      ...stages,
      ...extraStages,
    },
  };
}

function wrapContract(snap, adam) {
  const s = snap && typeof snap === 'object' ? snap : {};
  return {
    ...s,
    referenceNumber: s.referenceNumber || adam,
    title: s.title || '',
    contractSignedDate: s.contractSignedDate || s.signedDate || null,
    organization: s.organization && typeof s.organization === 'object'
      ? s.organization
      : { value: s.assigningAuthority || 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ' },
    contractingDataDetails: s.contractingDataDetails || {
      contractingMembersDataList: [{
        name: s.anadoxosName || '',
        vatNumber: s.anadoxosVat || '',
      }],
    },
    cancelled: !!s.cancelled,
  };
}

function wrapNotice(snap, adam) {
  const s = snap && typeof snap === 'object' ? snap : {};
  const asKv = (v) => (v && typeof v === 'object' ? v : (v ? { value: v } : null));
  return {
    ...s,
    referenceNumber: s.referenceNumber || adam,
    title: s.title || '',
    noticeType: asKv(s.noticeType) || { value: 'Προκήρυξη' },
    signedDate: s.signedDate || null,
    finalSubmissionDate: s.finalSubmissionDate || null,
    cancelled: !!s.cancelled,
  };
}

function wrapAward(snap, adam) {
  const s = snap && typeof snap === 'object' ? snap : {};
  return {
    ...s,
    referenceNumber: s.referenceNumber || adam,
    title: s.title || '',
    cancelled: !!s.cancelled,
  };
}

function wrapRequest(snap, adam) {
  const s = snap && typeof snap === 'object' ? snap : {};
  return {
    ...s,
    referenceNumber: s.referenceNumber || adam,
    title: s.title || '',
    cancelled: !!s.cancelled,
    isInitial: s.isInitial === true,
    isApproved: s.isApproved === true,
    totalCostWithVAT: s.totalCostWithVAT != null ? s.totalCostWithVAT : null,
    totalCostWithoutVAT: s.totalCostWithoutVAT != null ? s.totalCostWithoutVAT : null,
  };
}

function syntheticContract(adam, title, anadoxos, links = {}) {
  return wrapContract({
    referenceNumber: adam,
    title,
    anadoxosName: anadoxos,
    assigningAuthority: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
    contractSignedDate: '2024-06-01',
    contractBudget: 100000,
    noticeReferenceNumber: links.notice || null,
    auctionRefNo: links.award || null,
  }, adam);
}

function syntheticNotice(adam, title) {
  return wrapNotice({
    referenceNumber: adam,
    title,
    signedDate: '2024-01-15',
    finalSubmissionDate: '2026-09-14T14:00:00',
  }, adam);
}

function buildKhmdhsFixtures() {
  const fixtures = Object.create(null);
  fixtures['24REQ000000001'] = khmdhsFixture(wrapRequest({
    referenceNumber: '24REQ000000001',
    title: 'Πρωτογενές αίτημα φωτισμού κόμβου Αρχανών',
    isInitial: true,
    totalCostWithVAT: 148800,
    totalCostWithoutVAT: 120000,
  }, '24REQ000000001'), {
    notices: ['24PROC000000001'],
    auctions: ['24AWRD000000001'],
    contracts: ['24SYMV000000001'],
  });
  fixtures['24PROC000000001'] = khmdhsFixture(syntheticNotice(
    '24PROC000000001',
    'Δημοσίευση φωτισμού κόμβου Αρχανών',
  ), {
    requests: ['24REQ000000001'],
    auctions: ['24AWRD000000001'],
    contracts: ['24SYMV000000001'],
  });
  fixtures['24SYMV000000001'] = khmdhsFixture(syntheticContract(
    '24SYMV000000001',
    'Σύμβαση φωτισμού κόμβου Αρχανών',
    'Δοκιμαστικός Ανάδοχος Α.Ε.',
    { notice: '24PROC000000001', award: '24AWRD000000001' },
  ), {
    requests: ['24REQ000000001'],
    notices: ['24PROC000000001'],
    auctions: ['24AWRD000000001'],
  });
  fixtures['24AWRD000000001'] = khmdhsFixture(wrapAward({
    referenceNumber: '24AWRD000000001',
    title: 'Ανάθεση φωτισμού κόμβου Αρχανών',
  }, '24AWRD000000001'), {
    requests: ['24REQ000000001'],
    notices: ['24PROC000000001'],
    contracts: ['24SYMV000000001'],
  });
  fixtures['24SYMV000000002'] = khmdhsFixture(syntheticContract(
    '24SYMV000000002',
    'Σύμβαση δεξαμενής Παρανύμφων',
    'Δοκιμαστικός Ανάδοχος Β.Ε.',
  ));

  fixtures['24REQ000000010'] = khmdhsFixture(wrapRequest({
    referenceNumber: '24REQ000000010',
    title: 'Πρωτογενές αίτημα με δύο συμβάσεις',
    isInitial: true,
    totalCostWithVAT: 200000,
    totalCostWithoutVAT: 161290.32,
  }, '24REQ000000010'), {
    notices: ['24PROC000000010'],
    contracts: ['24SYMV000000010', '24SYMV000000011'],
  });
  fixtures['24PROC000000010'] = khmdhsFixture(syntheticNotice(
    '24PROC000000010',
    'Δημοσίευση δύο τμημάτων',
  ), {
    requests: ['24REQ000000010'],
    contracts: ['24SYMV000000010', '24SYMV000000011'],
  });
  fixtures['24SYMV000000010'] = khmdhsFixture(syntheticContract(
    '24SYMV000000010',
    'Σύμβαση τμήματος Α',
    'Ανάδοχος Τμήματος Α',
  ), {
    requests: ['24REQ000000010'],
    notices: ['24PROC000000010'],
    contracts: ['24SYMV000000010', '24SYMV000000011'],
  });
  fixtures['24SYMV000000011'] = khmdhsFixture(syntheticContract(
    '24SYMV000000011',
    'Σύμβαση τμήματος Β',
    'Ανάδοχος Τμήματος Β',
  ), {
    requests: ['24REQ000000010'],
    notices: ['24PROC000000010'],
    contracts: ['24SYMV000000010', '24SYMV000000011'],
  });
  fixtures['24REQ000000088'] = khmdhsFixture(wrapRequest({
    referenceNumber: '24REQ000000088',
    title: 'Ακυρωμένο πρωτογενές αίτημα',
    cancelled: true,
  }, '24REQ000000088'), {
    requests: ['24REQ000000088**'],
  });

  const laptop = resolveLaptopDataDir();
  const projects = walkLaptopProjects(laptop);

  const advisor = findByAdam(projects, REAL.advisorContract);
  const advisorContractRow = advisor
    ? wrapContract(advisor.khmdhsContractSnapshot, REAL.advisorContract)
    : syntheticContract(
      REAL.advisorContract,
      'Τεχνικός σύμβουλος Δη-ΣΜΕ μείωσης εκπομπών',
      'ΙΝΙΤΙΑ ΑΕ',
      { notice: REAL.advisorNotice, award: REAL.advisorAward },
    );
  const advisorNoticeRow = advisor
    ? wrapNotice(advisor.khmdhsNoticeSnapshot, REAL.advisorNotice)
    : syntheticNotice(REAL.advisorNotice, 'Προκήρυξη τεχνικού συμβούλου Δη-ΣΜΕ');
  const advisorAwardRow = wrapAward(
    (advisor && (advisor.khmdhsAwardSnapshot || advisor.khmdhsAuctionSnapshot)) || {
      title: 'Ανάθεση τεχνικού συμβούλου Δη-ΣΜΕ',
    },
    REAL.advisorAward,
  );
  fixtures[REAL.advisorContract] = khmdhsFixture(advisorContractRow, {
    notices: [REAL.advisorNotice],
    auctions: [REAL.advisorAward],
  });
  fixtures[REAL.advisorNotice] = khmdhsFixture(advisorNoticeRow, {
    contracts: [REAL.advisorContract],
    auctions: [REAL.advisorAward],
  });
  fixtures[REAL.advisorAward] = khmdhsFixture(advisorAwardRow, {
    notices: [REAL.advisorNotice],
    contracts: [REAL.advisorContract],
  });

  const tender = findByAdam(projects, REAL.tenderNotice);
  const tenderRow = tender
    ? wrapNotice(tender.khmdhsNoticeSnapshot, REAL.tenderNotice)
    : syntheticNotice(
      REAL.tenderNotice,
      'ΕΡΓΑΣΙΕΣ ΑΠΟΚΑΤΑΣΤΑΣΗΣ ΔΗΜΟΤΙΚΗΣ ΟΔΟΠΟΙΙΑΣ Δ.Ε. Ν. ΚΑΖΑΝΤΖΑΚΗ',
    );
  fixtures[REAL.tenderNotice] = khmdhsFixture(tenderRow);

  return fixtures;
}

function copyLaptopEmailConfig(testDir) {
  const laptop = resolveLaptopDataDir();
  if (!laptop) return { copied: false };
  const src = path.join(laptop, 'config', 'email-config.json');
  if (!fs.existsSync(src)) return { copied: false };
  const destDir = path.join(testDir, 'config');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, 'email-config.json'));
  const parsed = readJson(src) || {};
  return {
    copied: true,
    gmailUser: parsed.gmail && parsed.gmail.user,
  };
}

module.exports = {
  REAL,
  resolveLaptopDataDir,
  buildKhmdhsFixtures,
  copyLaptopEmailConfig,
};
