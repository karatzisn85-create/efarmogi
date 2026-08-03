/**
 * Ανάκτηση δημόσιων δεδομένων σύμβασης από το επίσημο ΚΗΜΔΗΣ OpenData API.
 * Βάση: https://cerpp.eprocurement.gov.gr — τεκμηρίωση /khmdhs-opendata/
 */

const KHMDHS_BASE = 'https://cerpp.eprocurement.gov.gr';
const {
  grossFromContractBudget,
  grossFromCostSnapshot,
  KHMDHS_VAT_RATE,
} = require('./khmdhsVatHelper');
const {
  friendlyKhmdhsAdamNotFoundError,
  friendlyKhmdhsInvalidResponseError,
  friendlyKhmdhsTransientHttpError,
  resolveKhmdhsHttpError,
} = require('./khmdhsHttpErrors');

const RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 1500;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
/** Ανώτατος χρόνος αναμονής ανά μεμονωμένο αίτημα προς το ΚΗΜΔΗΣ. */
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

function createAbortError() {
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function createTimeoutError() {
  const err = new Error('Το αίτημα προς το ΚΗΜΔΗΣ διήρκεσε πάρα πολύ.');
  err.name = 'TimeoutError';
  return err;
}

function sleepWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(t);
      reject(createAbortError());
    };
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Εκτελεί fetch με:
 *  - ανώτατο χρονικό όριο ανά προσπάθεια (αποφυγή «κολλήματος» σε αργό/χαμένο δίκτυο),
 *  - επαναπροσπάθειες σε προσωρινά σφάλματα (429/5xx) και σε λήξη χρόνου,
 *  - υποστήριξη εξωτερικής ακύρωσης (signal) από τον χρήστη.
 * Διακρίνει την ακύρωση του χρήστη (AbortError) από τη λήξη χρόνου (TimeoutError).
 */
async function fetchWithRetry(url, options, { maxRetries = RETRY_COUNT, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}) {
  const externalSignal = options?.signal;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) throw createAbortError();

    const controller = new AbortController();
    const onExternalAbort = () => { try { controller.abort(); } catch { /* ignore */ } };
    if (externalSignal) externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      if (res.ok || !RETRYABLE_STATUS_CODES.has(res.status) || attempt === maxRetries) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      if (e.name === 'AbortError') {
        // Ακύρωση από τον χρήστη → διαδίδεται αμέσως.
        if (externalSignal?.aborted) throw createAbortError();
        // Διαφορετικά πρόκειται για λήξη χρόνου → θεωρείται προσωρινό σφάλμα (retry).
        lastError = createTimeoutError();
        if (attempt === maxRetries) throw lastError;
      } else {
        lastError = e;
        if (attempt === maxRetries) throw e;
      }
    }

    if (externalSignal?.aborted) throw createAbortError();
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    await sleepWithAbort(delay, externalSignal);
  }
  throw lastError;
}

/** Καταστάσεις με υπογεγραμμένη σύμβαση — ο ΑΔΑΜ διατηρείται μεταξύ τους */
const STATUSES_WITH_KHMDHS_ADAM = [
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ'
];

function statusRequiresKhmdhsAdam(status) {
  return STATUSES_WITH_KHMDHS_ADAM.includes(status);
}

/** ΑΔΑΜ: 2 ψηφία έτος + τύπος (REQ, PROC, AWRD, SYMV, PAY, …) + 9 ψηφία */
const ADAM_REGEX = /^(\d{2})([A-Z]{3,4})(\d{9})$/i;
const NOTICE_ADAM_TYPE = 'PROC';
const REQUEST_ADAM_TYPE = 'REQ';

function keyValueText(field) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field).trim();
  if (typeof field === 'object' && field.value != null) return String(field.value).trim();
  return '';
}

/**
 * Μονάδα μέτρησης διάρκειας/ισχύος από raw ΚΗΜΔΗΣ ή ήδη mapped snapshot.
 * Raw: { key: "3", value: "Μήνες" } ή "3" · Mapped: "Μήνες" / "3".
 */
function unitOfMeasureText(rawField, mappedField) {
  const fromRaw = keyValueText(rawField);
  if (fromRaw) return fromRaw;
  if (rawField && typeof rawField === 'object' && rawField.key != null) {
    const k = String(rawField.key).trim();
    if (k) return k;
  }
  const fromMapped = keyValueText(mappedField);
  if (fromMapped) return fromMapped;
  return '';
}

/** ΚΗΜΔΗΣ: 1 ημέρες, 2 εβδομάδες, 3 μήνες, 4 έτη → ελληνική ετικέτα */
function humanizeUnitOfMeasure(rawField, mappedField) {
  const text = unitOfMeasureText(rawField, mappedField);
  if (!text) return '';
  const u = String(text).trim().toLowerCase();
  if (u === '1' || /ημέρ|ημερ|day/i.test(u)) return 'Ημέρες';
  if (u === '2' || /εβδομ|week/i.test(u)) return 'Εβδομάδες';
  if (u === '3' || /μήν|μην|month/i.test(u)) return 'Μήνες';
  if (u === '4' || /έτ|ετ|year/i.test(u)) return 'Έτη';
  return String(text).trim();
}

function isoDateOnly(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && value.value != null) {
    return isoDateOnly(value.value);
  }
  const s = String(value).trim();
  // Αν η τιμή ξεκινά ήδη με YYYY-MM-DD, επιστρέφουμε απευθείας — αποφεύγουμε TZ μετατροπή
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function extractKhmdhsDateField(row, field) {
  if (!row || typeof row !== 'object') return null;
  const v = row[field];
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'object' && v.value != null) return v.value;
  return null;
}

function deriveContractProcessStartDateFromNotice(snapshot) {
  if (!snapshot) return '';
  for (const key of ['signedDate', 'finalSubmissionDate', 'submissionDate', 'lastUpdateDate']) {
    const iso = isoDateOnly(snapshot[key]);
    if (iso) return iso;
  }
  return '';
}

function buildNoticeSearchBody(referenceNumber) {
  return {
    referenceNumber: String(referenceNumber).trim().toUpperCase()
  };
}

function friendlyKhmdhsNoticeError(message, httpStatus, adam) {
  const raw = String(message || '').trim();
  if (httpStatus === 404 || /no auctions found|no notices found|δε βρέθηκε|δεν βρέθηκε/i.test(raw)) {
    return friendlyKhmdhsAdamNotFoundError({ adam, kind: 'notice' });
  }
  return resolveKhmdhsHttpError(
    raw,
    httpStatus,
    () => `Σφάλμα επικοινωνίας με το ΚΗΜΔΗΣ (HTTP ${httpStatus}).`
  );
}

/** Αντιστοίχιση διαδικασίας ΚΗΜΔΗΣ → λίστα εφαρμογής */
function mapKhmdhsToAssignmentProcedure(record) {
  if (!record || typeof record !== 'object') return null;
  const proc = keyValueText(record.typeOfProcedure).toLowerCase();
  const noticeType = keyValueText(record.noticeType).toLowerCase();
  const legal = keyValueText(record.legalContext).toLowerCase();
  const blob = `${proc} ${noticeType} ${legal}`;

  // Τύποι δημοσίευσης ΚΗΜΔΗΣ → Απευθείας Ανάθεση (κανόνας εφαρμογής)
  if (/πρόσκληση\s*εκδήλωσης\s*ενδιαφέροντος/i.test(noticeType)) return 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
  if (/πρόσκληση\s*υποβολής\s*προσφορ/i.test(noticeType)) return 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
  if (/εκδήλωσης ενδιαφέροντος/i.test(noticeType)) return 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
  if (/υποβολ[ήη]ς\s*προσφορ/i.test(noticeType)) return 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';

  if (/απευθείας|άμεσ/i.test(blob)) return 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
  if (/διακήρυξη|διακηρυξη|δημοπράτηση|δημοπρατηση/i.test(noticeType || proc || blob)) {
    return 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ';
  }
  if (/ανοιχτ/i.test(proc || blob)) return 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ';
  if (/κλειστ/i.test(proc || blob)) return 'ΚΛΕΙΣΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ';
  if (/συνοπτικ/i.test(proc || blob)) return 'ΣΥΝΟΠΤΙΚΟΣ ΔΙΑΓΩΝΙΣΜΟΣ';
  if (/32\s*α|32α/i.test(blob)) return 'ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ ΧΩΡΙΣ ΔΗΜΟΣΙΕΥΣΗ ΑΡΘΡΟ 32Α';
  if (/διαπραγμάτευση/i.test(proc || blob)) return 'ΑΝΤΑΓΩΝΙΣΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ ΜΕ ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ';
  if (/διαλογ/i.test(proc || blob)) return 'ΑΝΤΑΓΩΝΙΣΤΙΚΟΣ ΔΙΑΛΟΓΟΣ';
  if (/128/.test(proc || blob)) return 'ΑΝΤΑΓΩΝΙΣΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ ΜΕ ΔΙΑΠΡΑΓΜΑΤΕΥΣΗ';
  if (/ησσόν|μικρότερ/i.test(blob)) return 'ΗΣΣΟΝΟΣ ΑΞΙΑΣ';
  if (/καινοτομ/i.test(blob)) return 'ΣΥΜΠΡΑΞΗ ΚΑΙΝΟΤΟΜΙΑΣ';
  if (/τεχνικής βοήθειας/i.test(blob)) return 'ΕΝΕΡΓΕΙΕΣ ΤΕΧΝΙΚΗΣ ΒΟΗΘΕΙΑΣ';

  return null;
}

function buildFundingSummary(fundingDetails) {
  if (!fundingDetails || typeof fundingDetails !== 'object') return '';
  const parts = [];
  if (fundingDetails.publicFundingRefNum) parts.push(`ΠΔΕ: ${fundingDetails.publicFundingRefNum}`);
  if (fundingDetails.publicFundingRefOps) parts.push(`ΟΠΣ: ${fundingDetails.publicFundingRefOps}`);
  if (fundingDetails.cofundProgramRef) parts.push(`Συγχρημ.: ${fundingDetails.cofundProgramRef}`);
  if (fundingDetails.espaFundProgramRef) parts.push(`ΕΣΠΑ: ${fundingDetails.espaFundProgramRef}`);
  if (fundingDetails.regularBudgetFundedProgramRef) {
    parts.push(`Τακτ.: ${fundingDetails.regularBudgetFundedProgramRef}`);
  }
  return parts.join(' · ');
}

function mapNoticeRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const cpvs = [];
  (row.objectDetails || []).forEach((obj) => {
    (obj.cpvs || []).forEach((cpv) => {
      const k = cpv?.key || cpv?.value;
      if (k) cpvs.push(String(k));
    });
  });

  const mappedAssignmentProcedure = mapKhmdhsToAssignmentProcedure(row);

  return {
    referenceNumber: row.referenceNumber || null,
    title: row.title || null,
    noticeType: keyValueText(row.noticeType) || null,
    typeOfProcedure: keyValueText(row.typeOfProcedure) || null,
    mappedAssignmentProcedure,
    contractType: keyValueText(row.contractType) || null,
    legalContext: keyValueText(row.legalContext) || null,
    conductingProceedings: keyValueText(row.conductingProceedings) || null,
    digitalPlatform: keyValueText(row.digitalPlatform) || null,
    criteriaCode: keyValueText(row.criteriaCode) || null,
    organization: keyValueText(row.organization) || null,
    unitsOperator: keyValueText(row.contractingData?.unitsOperator) || null,
    signer: keyValueText(row.contractingData?.signers) || null,
    signedDate: extractKhmdhsDateField(row, 'signedDate'),
    finalSubmissionDate: extractKhmdhsDateField(row, 'finalSubmissionDate'),
    submissionDate: extractKhmdhsDateField(row, 'submissionDate'),
    lastUpdateDate: row.lastUpdateDate || null,
    cancelled: !!row.cancelled,
    cancellationDate: row.cancellationDate || null,
    cancellationReason: row.cancellationReason || null,
    totalCostWithoutVAT: row.totalCostWithoutVAT != null ? row.totalCostWithoutVAT : null,
    totalCostWithVAT: row.totalCostWithVAT != null ? row.totalCostWithVAT : null,
    contractDuration: row.contractDuration != null ? row.contractDuration : null,
    contractDurationUnit: humanizeUnitOfMeasure(
      row.contractDurationUnitOfMeasure,
      row.contractDurationUnit
    ) || null,
    offersValidTime: row.offersValidTime != null ? row.offersValidTime : null,
    offersValidTimeUnit: humanizeUnitOfMeasure(
      row.offersValidTimeUnitOfMeasure,
      row.offersValidTimeUnit
    ) || null,
    biddingWebsite: row.biddingWebsite || null,
    systemicNumber: row.systemicNumbers?.[0]?.systemicNumber || null,
    approvedRequestAdam: row.approvedRequests?.[0]?.code || null,
    auctionRefNos: Array.isArray(row.auctionRefNo) ? row.auctionRefNo.map(String) : [],
    amendsNoticeRefNos: Array.isArray(row.amendsNoticeRefNo) ? row.amendsNoticeRefNo.map(String) : [],
    amendedNoticeADAM: row.amendedNoticeADAM || null,
    cpvs,
    fundingSummary: buildFundingSummary(row.fundingDetails)
  };
}

function pickKhmdhsNoticeSnapshot(snapshot) {
  const mapped = mapNoticeRecord(snapshot) || snapshot;
  if (!mapped || typeof mapped !== 'object') return null;
  if (!mapped.title && !mapped.referenceNumber) return null;
  return mapped;
}

function normalizeNoticeAdam(s) {
  const t = normalizeAdam(s);
  if (!t) return null;
  const match = ADAM_REGEX.exec(t);
  if (!match) return null;
  const type = match[2].toUpperCase();
  if (type !== NOTICE_ADAM_TYPE) {
    return null;
  }
  return t;
}

function statusAllowsKhmdhsNoticeRetention(status) {
  return statusRequiresKhmdhsAdam(status) || status === 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ';
}

function mergeKhmdhsNoticeFieldsForSave(projectData, existingData) {
  const existing = existingData && typeof existingData === 'object' ? existingData : {};
  const incoming = projectData && typeof projectData === 'object' ? projectData : {};
  const status = incoming.projectStatus || existing.projectStatus || '';
  const retain = statusAllowsKhmdhsNoticeRetention(status);

  const adamIncoming = normalizeNoticeAdam(incoming.khmdhsNoticeAdam) || '';
  const adamExisting = normalizeNoticeAdam(existing.khmdhsNoticeAdam) || '';
  const adam = adamIncoming || (retain ? adamExisting : '');

  let snapshot = pickKhmdhsNoticeSnapshot(incoming.khmdhsNoticeSnapshot);
  if (!snapshot && adam) snapshot = pickKhmdhsNoticeSnapshot(existing.khmdhsNoticeSnapshot);

  const fetchedAt = adam
    ? String(incoming.khmdhsNoticeFetchedAt || existing.khmdhsNoticeFetchedAt || '')
    : '';

  if (!adam) {
    return {
      khmdhsNoticeAdam: '',
      khmdhsNoticeSnapshot: null,
      khmdhsNoticeFetchedAt: ''
    };
  }

  const out = {
    khmdhsNoticeAdam: adam,
    khmdhsNoticeSnapshot: snapshot,
    khmdhsNoticeFetchedAt: fetchedAt,
  };

  // ΣΗΜΑΝΤΙΚΟ: εδώ ΔΕΝ μηδενίζουμε πλέον το assignmentProcedure. Ο renderer έχει ήδη
  // υπολογίσει τη σωστή τιμή πριν την αποθήκευση (χειροκίνητη επιλογή ή αυτόματη από τη
  // δημοσίευση — βλ. mergeSharedKhmdhsFromChain / applySymvChainPlanToForm). Αν εδώ τη
  // μηδενίζαμε άνευ όρων, η αποθηκευμένη τιμή γινόταν πάντα κενή σε κάθε αποθήκευση, με
  // αποτέλεσμα κάθε επόμενη ανανέωση ΚΗΜΔΗΣ να «ανακαλύπτει» ξανά και ξανά την ίδια
  // διαδικασία ανάθεσης σαν να ήταν καινούρια — bug που επαναλαμβανόταν επ' άπειρον.
  const incomingProcedure = String(incoming.assignmentProcedure || '').trim();
  if (incomingProcedure) {
    out.assignmentProcedure = incomingProcedure;
  } else {
    const autoProcedure = snapshot
      ? (String(snapshot.mappedAssignmentProcedure || '').trim() || mapKhmdhsToAssignmentProcedure(snapshot) || '')
      : '';
    out.assignmentProcedure = autoProcedure || String(existing.assignmentProcedure || '').trim();
  }

  const processStart = deriveContractProcessStartDateFromNotice(snapshot);
  if (processStart && !String(incoming.contractProcessStartDate || existing.contractProcessStartDate || '').trim()) {
    out.contractProcessStartDate = processStart;
  }

  return out;
}

async function fetchKhmdhsNoticeByAdam(adamRaw) {
  const adam = normalizeNoticeAdam(adamRaw);
  if (!adam) {
    const raw = normalizeAdam(adamRaw);
    if (raw && !normalizeNoticeAdam(adamRaw)) {
      return {
        success: false,
        error:
          'Μη έγκυρος ΑΔΑΜ προκήρυξης/πρόσκλησης. Χρησιμοποιήστε μορφή ##PROC######### (π.χ. 26PROC018492003).'
      };
    }
    return {
      success: false,
      error:
        'Μη έγκυρος κωδικός ΑΔΑΜ. Χρησιμοποιήστε μορφή όπως 26PROC018492003 (έτος + PROC + 9 ψηφία).'
    };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/notice?page=0`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(buildNoticeSearchBody(adam))
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: friendlyKhmdhsInvalidResponseError(res.status) };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsNoticeError(typeof msg === 'string' ? msg : String(msg), res.status, adam),
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return {
      success: false,
      error: friendlyKhmdhsAdamNotFoundError({ adam, kind: 'notice' }),
    };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper);
  if (!row) {
    return { success: false, error: `Ο ΑΔΑΜ ${adam} δεν αντιστοιχεί ακριβώς σε κάποια διακήρυξη στα αποτελέσματα ΚΗΜΔΗΣ. Ελέγξτε τον κωδικό.` };
  }
  const snapshot = mapNoticeRecord(row);
  if (!snapshot) {
    return { success: false, error: 'Βρέθηκε η πράξη αλλά δεν επιστράφηκαν δεδομένα από το ΚΗΜΔΗΣ.' };
  }
  return { success: true, snapshot };
}

function normalizeRequestAdam(s) {
  const t = normalizeAdam(s);
  if (!t) return null;
  const match = ADAM_REGEX.exec(t);
  if (!match || match[2].toUpperCase() !== REQUEST_ADAM_TYPE) return null;
  return t;
}

function mapRequestCpvsFromRow(row) {
  const cpvs = [];
  const details = row.objectDetails || row.objectDetailsList || [];
  (Array.isArray(details) ? details : []).forEach((obj) => {
    (obj.cpvs || []).forEach((cpv) => {
      const k = cpv?.key || cpv?.value;
      if (k) cpvs.push(String(k));
    });
  });
  return cpvs;
}

/** Snapshot πρωτογενούς / εγκεκριμένου αιτήματος (REQ) */
function mapRequestRecord(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    referenceNumber: row.referenceNumber || null,
    title: row.title || null,
    contractType: keyValueText(row.contractType)
      || (Array.isArray(row.contractTypes) && row.contractTypes[0] ? keyValueText(row.contractTypes[0]) : null),
    organization: keyValueText(row.organization) || null,
    signedDate: row.signedDate || null,
    submissionDate: row.submissionDate || null,
    lastUpdateDate: row.lastUpdateDate || null,
    cancelled: !!row.cancelled,
    cancellationDate: row.cancellationDate || null,
    totalCostWithoutVAT: row.totalCostWithoutVAT != null ? row.totalCostWithoutVAT : null,
    totalCostWithVAT: row.totalCostWithVAT != null ? row.totalCostWithVAT : null,
    isInitial: row.isInitial === true,
    isApproved: row.isApproved === true,
    previousRequestReferenceNumber: row.previousRequestReferenceNumber || null,
    contractRefNo: Array.isArray(row.contractRefNo)
      ? row.contractRefNo.filter(Boolean)
      : (row.contractRefNo ? [row.contractRefNo] : []),
    cpvs: mapRequestCpvsFromRow(row),
    fundingSummary: buildFundingSummary(row.fundingDetails),
  };
}

function pickKhmdhsRequestSnapshot(snapshot) {
  const mapped = mapRequestRecord(snapshot) || snapshot;
  if (!mapped || typeof mapped !== 'object') return null;
  if (!mapped.title && !mapped.referenceNumber && mapped.totalCostWithoutVAT == null) return null;
  return mapped;
}

function friendlyKhmdhsRequestError(message, httpStatus, adam) {
  const raw = String(message || '').trim();
  // Το API αιτημάτων συχνά επιστρέφει «No notices found» ακόμα και για REQ.
  if (
    httpStatus === 404
    || /no requests found|no request found|no notices found/i.test(raw)
    || /δε βρέθηκε|δεν βρέθηκε/i.test(raw)
  ) {
    return friendlyKhmdhsAdamNotFoundError({ adam, kind: 'request' });
  }
  return resolveKhmdhsHttpError(
    raw,
    httpStatus,
    () => `Σφάλμα επικοινωνίας με το ΚΗΜΔΗΣ (HTTP ${httpStatus}).`
  );
}

async function fetchKhmdhsRequestByAdam(adamRaw) {
  const adam = normalizeRequestAdam(adamRaw);
  if (!adam) {
    const raw = normalizeAdam(adamRaw);
    if (raw && !normalizeRequestAdam(adamRaw)) {
      return {
        success: false,
        error: 'Μη έγκυρος ΑΔΑΜ αιτήματος. Χρησιμοποιήστε μορφή ##REQ######### (π.χ. 26REQ018492003).',
      };
    }
    return {
      success: false,
      error: 'Μη έγκυρος κωδικός ΑΔΑΜ αιτήματος (REQ).',
    };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/request?page=0`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ referenceNumber: adam }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: friendlyKhmdhsInvalidResponseError(res.status) };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsRequestError(typeof msg === 'string' ? msg : String(msg), res.status, adam),
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return {
      success: false,
      error: friendlyKhmdhsAdamNotFoundError({ adam, kind: 'request' }),
    };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper);
  if (!row) {
    return { success: false, error: `Ο ΑΔΑΜ ${adam} δεν αντιστοιχεί ακριβώς σε κάποιο αίτημα στα αποτελέσματα ΚΗΜΔΗΣ. Ελέγξτε τον κωδικό.` };
  }
  const snapshot = mapRequestRecord(row);
  if (!snapshot) {
    return { success: false, error: 'Βρέθηκε το αίτημα αλλά δεν επιστράφηκαν δεδομένα από το ΚΗΜΔΗΣ.' };
  }
  return { success: true, snapshot };
}

function normalizeAdam(s) {
  const t = String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  return ADAM_REGEX.test(t) ? t : null;
}

/**
 * Αναζήτηση σύμβασης με ΑΔΑΜ.
 * Το API δέχεται μόνο referenceNumber· αν προστεθούν κενά πεδία (title, cpvItems, …)
 * μαζί με ημερομηνίες, επιστρέφει λανθασμένα «No auctions found» ακόμα κι όταν η σύμβαση υπάρχει.
 */
function buildContractSearchBody(referenceNumber) {
  return {
    referenceNumber: String(referenceNumber).trim().toUpperCase()
  };
}

function friendlyKhmdhsError(message, httpStatus, adam, kind = 'contract') {
  const raw = String(message || '').trim();
  if (httpStatus === 404 || /no auctions found|no notices found|δε βρέθηκε|δεν βρέθηκε|not found/i.test(raw)) {
    return friendlyKhmdhsAdamNotFoundError({ adam, kind });
  }
  return resolveKhmdhsHttpError(
    raw,
    httpStatus,
    () => `Σφάλμα επικοινωνίας με το ΚΗΜΔΗΣ (HTTP ${httpStatus}).`
  );
}

/** Μηνύματα για αποτυχία αλυσίδας ΑΔΑΜ (ισχύει για REQ/PROC/AWRD/SYMV/PAY — όχι μόνο συμβάσεις). */
function friendlyKhmdhsChainError(message, httpStatus, adam) {
  const raw = String(message || '').trim();
  if (httpStatus === 404 || /δε βρέθηκε|δεν βρέθηκε|not found|no auctions found|no notices found/i.test(raw)) {
    return friendlyKhmdhsAdamNotFoundError({ adam, kind: 'chain' });
  }
  return resolveKhmdhsHttpError(
    raw,
    httpStatus,
    () => `Σφάλμα επικοινωνίας με το ΚΗΜΔΗΣ (HTTP ${httpStatus}).`
  );
}

/** Πλήρη snapshot σύμβασης από ΚΗΜΔΗΣ */
function mapContractRecord(c) {
  if (!c || typeof c !== 'object') return null;
  const members = (c.contractingDataDetails && c.contractingDataDetails.contractingMembersDataList) || [];
  const member = members[0] || {};
  const auctionRef = c.auctionRefNo;
  return {
    referenceNumber: c.referenceNumber || null,
    title: c.title || null,
    anadoxosName: member.name || null,
    anadoxosVat: member.vatNumber != null ? String(member.vatNumber) : null,
    assigningAuthority: c.organization && c.organization.value ? c.organization.value : null,
    contractSignedDate: c.contractSignedDate || null,
    startDate: c.startDate || null,
    endDate: c.endDate || null,
    noEndDate: c.noEndDate === true,
    contractBudget: c.contractBudget != null ? c.contractBudget : null,
    // Συνολική αξία της σύμβασης — συμπληρωματική πηγή ποσού όταν λείπει το contractBudget
    totalCostWithoutVAT: c.totalCostWithoutVAT != null ? c.totalCostWithoutVAT : null,
    totalCostWithVAT: c.totalCostWithVAT != null ? c.totalCostWithVAT : null,
    contractDuration: c.contractDuration != null ? c.contractDuration : null,
    contractDurationUnit: humanizeUnitOfMeasure(
      c.contractDurationUnitOfMeasure,
      c.contractDurationUnit
    ) || null,
    cancelled: !!c.cancelled,
    cancellationDate: c.cancellationDate || null,
    cancellationReason: c.cancellationReason || null,
    prevReferenceNo: c.prevReferenceNo || null,
    nextRefNo: c.nextRefNo || null,
    nextExtended: c.nextExtended === true,
    nextModified: c.nextModified === true,
    noticeReferenceNumber: c.noticeReferenceNumber || null,
    auctionRefNo: Array.isArray(auctionRef) ? auctionRef[0] : (auctionRef || null),
    submissionDate: c.submissionDate || null,
    lastUpdateDate: c.lastUpdateDate || null,
  };
}

function refListField(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function mapAwardCpvsFromRow(row) {
  const cpvs = [];
  (row.objectDetailsList || []).forEach((obj) => {
    (obj.cpvs || []).forEach((cpv) => {
      const k = cpv?.key || cpv?.value;
      if (k) cpvs.push(String(k));
    });
  });
  return cpvs;
}

function mapAwardContractors(row) {
  const members = (row.contractingDataDetails && row.contractingDataDetails.contractingMembersDataList) || [];
  return members
    .map((m) => ({
      name: m.name || null,
      vat: m.vatNumber != null ? String(m.vatNumber) : null,
      greekVat: m.greekVatNumber === true,
      country: keyValueText(m.installationCountry) || null,
    }))
    .filter((m) => m.name || m.vat);
}

/** Πλήρες snapshot ανάθεσης (AWRD) από ΚΗΜΔΗΣ OpenData */
function mapAuctionRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const contractors = mapAwardContractors(row);
  const primary = contractors[0] || {};
  const noticeRef = row.noticeRefNo != null ? row.noticeRefNo : row.noticeReferenceNumber;
  const durationVal = row.contractDuration != null ? String(row.contractDuration).trim() : '';
  const durationUnit = humanizeUnitOfMeasure(
    row.contractDurationUnitOfMeasure,
    row.contractDurationUnit
  );

  return {
    referenceNumber: row.referenceNumber || null,
    title: row.title || null,
    cancelled: !!row.cancelled,
    cancellationDate: row.cancellationDate || null,
    cancellationType: keyValueText(row.cancellationType) || null,
    cancellationReason: row.cancellationReason || null,
    cancellationADA: row.cancellationADA || null,
    amendedAuctionADAM: row.amendedAuctionADAM || null,
    amendPreviousAuction: row.amendPreviousAuction === true,
    noticeReferenceNumber: Array.isArray(noticeRef) ? noticeRef[0] : (noticeRef || null),
    noticeRefNos: refListField(noticeRef),
    submissionDate: row.submissionDate || null,
    lastUpdateDate: row.lastUpdateDate || null,
    signedDate: row.signedDate || null,
    awardDate: row.awardDate || row.signedDate || null,
    protocolNumber: row.protocolNumber || null,
    organization: keyValueText(row.organization) || null,
    organizationVatNumber: row.organizationVatNumber != null ? String(row.organizationVatNumber) : null,
    unitsOperator: keyValueText(row.contractingData?.unitsOperator) || null,
    signer: keyValueText(row.contractingData?.signers) || null,
    procedureType: keyValueText(row.procedureType) || null,
    contractType: keyValueText(row.contractType) || null,
    criteriaCode: keyValueText(row.criteriaCode) || null,
    legalContext: keyValueText(row.legalContext) || null,
    awardProcedure: row.awardProcedure || null,
    contractDuration: durationVal || null,
    contractDurationUnit: durationUnit || null,
    auctionAmount: row.auctionAmount != null ? row.auctionAmount : null,
    budget: row.budget != null ? row.budget : null,
    totalCostWithoutVAT: row.totalCostWithoutVAT != null ? row.totalCostWithoutVAT : null,
    totalCostWithVAT: row.totalCostWithVAT != null ? row.totalCostWithVAT : null,
    commitmentNo: row.commitmentNo || null,
    anadoxosName: primary.name || null,
    anadoxosVat: primary.vat || null,
    contractors,
    cpvs: mapAwardCpvsFromRow(row),
    contractRefNos: refListField(row.contractRefNo),
    amendsAuctionRefNos: refListField(row.amendsAuctionRefNo),
    approvedRequestAdams: (row.approvedRequestsList || [])
      .map((r) => (r && (r.code || r.referenceNumber)) || null)
      .filter(Boolean),
    numberOfSections: row.numberOfSections != null ? row.numberOfSections : null,
    authorEmail: row.authorEmail || null,
  };
}

function pickKhmdhsAwardSnapshot(snapshot) {
  const mapped = mapAuctionRecord(snapshot) || snapshot;
  if (!mapped || typeof mapped !== 'object') return null;
  if (!mapped.title && !mapped.referenceNumber) return null;
  return mapped;
}

async function fetchKhmdhsAuctionByAdam(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ ανάθεσης (AWRD).' };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/auction?page=0`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ referenceNumber: adam }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: friendlyKhmdhsInvalidResponseError(res.status) };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsError(typeof msg === 'string' ? msg : String(msg), res.status, adam, 'award'),
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return { success: false, error: friendlyKhmdhsAdamNotFoundError({ adam, kind: 'award' }) };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper);
  if (!row) {
    return { success: false, error: `Ο ΑΔΑΜ ${adam} δεν αντιστοιχεί ακριβώς σε κάποια ανάθεση στα αποτελέσματα ΚΗΜΔΗΣ. Ελέγξτε τον κωδικό.` };
  }
  const snapshot = mapAuctionRecord(row);
  if (!snapshot) {
    return { success: false, error: 'Βρέθηκε η ανάθεση αλλά δεν επιστράφηκαν δεδομένα.' };
  }
  return { success: true, snapshot, raw: row };
}

function pickKhmdhsSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const out = {
    referenceNumber: snapshot.referenceNumber || null,
    title: snapshot.title || null,
    anadoxosName: snapshot.anadoxosName || null,
    anadoxosVat: snapshot.anadoxosVat != null ? String(snapshot.anadoxosVat) : null,
    assigningAuthority: snapshot.assigningAuthority || null,
    contractSignedDate: snapshot.contractSignedDate || null,
    startDate: snapshot.startDate || null,
    endDate: snapshot.endDate || null,
    noEndDate: snapshot.noEndDate === true,
    contractBudget: snapshot.contractBudget != null ? snapshot.contractBudget : null,
    totalCostWithoutVAT: snapshot.totalCostWithoutVAT != null ? snapshot.totalCostWithoutVAT : null,
    totalCostWithVAT: snapshot.totalCostWithVAT != null ? snapshot.totalCostWithVAT : null,
    resolvedContractAmount: snapshot.resolvedContractAmount != null ? snapshot.resolvedContractAmount : null,
    contractAmountSource: snapshot.contractAmountSource || null,
    contractDuration: snapshot.contractDuration != null ? snapshot.contractDuration : null,
    contractDurationUnit: snapshot.contractDurationUnit || null,
    cancelled: snapshot.cancelled === true,
    prevReferenceNo: snapshot.prevReferenceNo || null,
    nextRefNo: snapshot.nextRefNo || null,
    nextExtended: snapshot.nextExtended === true,
    nextModified: snapshot.nextModified === true,
    noticeReferenceNumber: snapshot.noticeReferenceNumber || null,
    auctionRefNo: snapshot.auctionRefNo || null,
    submissionDate: snapshot.submissionDate || null,
    lastUpdateDate: snapshot.lastUpdateDate || null,
  };
  const hasData = out.anadoxosName || out.anadoxosVat || out.assigningAuthority
    || out.referenceNumber || out.contractSignedDate || out.contractBudget != null
    || out.resolvedContractAmount != null;
  if (!hasData) return null;
  return out;
}

/**
 * Πλαίσιο ποσού για μία ανάκτηση αλυσίδας.
 * linkedContractCount = παράλληλες ρίζες (μπλοκάρει fallback ανάθεσης) ή 1 για γραμμική αλυσίδα.
 */
function buildKhmdhsAmountContext({
  stages,
  contractWalk,
  parallelContractInfo,
  auctionSnapshot,
  noticeSnapshot,
  contextualVatRate,
} = {}) {
  const parallelActive = parallelContractInfo?.parallel
    && (parallelContractInfo.siblingRoots?.length || 0) > 1;
  let linkedContractCount;
  if (parallelActive) {
    linkedContractCount = parallelContractInfo.siblingRoots.length;
  } else if (contractWalk?.primaryAdam) {
    linkedContractCount = 1;
  } else {
    linkedContractCount = Math.max(stages?.contracts?.length || 0, 0);
  }
  return {
    auctionSnapshot: auctionSnapshot || null,
    noticeSnapshot: noticeSnapshot || null,
    linkedContractCount,
    parallelCase: parallelActive,
    blockSharedAwardFallback: parallelActive,
    contextualVatRate: contextualVatRate ?? null,
  };
}

/** Ένδειξη προέλευσης όταν το ποσό προκύπτει από τη συνολική αξία της σύμβασης στο ΚΗΜΔΗΣ */
const CONTRACT_TOTAL_AMOUNT_SOURCE = 'Σύμβαση (ΚΗΜΔΗΣ — συνολική αξία)';

/** Ποσό σύμβασης — SYMV ή fallback AWRD/PROC (όχι κοινό ποσό ανάθεσης σε παράλληλες συμβάσεις) */
function resolveKhmdhsContractAmount(contractSnapshot, {
  auctionSnapshot,
  noticeSnapshot,
  linkedContractCount = 0,
  parallelCase = false,
  blockSharedAwardFallback = false,
  allowAwardFallback = true,
  contextualVatRate = null,
} = {}) {
  const vatRate = contextualVatRate != null ? contextualVatRate : KHMDHS_VAT_RATE;
  // Συνολική αξία της ίδιας της σύμβασης, όπως τη δηλώνει το ΚΗΜΔΗΣ. Αφορά μόνο αυτήν
  // (σε παράλληλες συμβάσεις τα επιμέρους ποσά αθροίζουν στο ποσό ανάθεσης), οπότε είναι
  // ασφαλής συμπληρωματική πηγή όταν λείπει ή δεν είναι αξιόπιστο το ποσό σύμβασης.
  const ownTotalGross = grossFromCostSnapshot(contractSnapshot);
  const budget = contractSnapshot?.contractBudget;
  if (budget != null && budget !== '' && Number.isFinite(Number(budget))) {
    // Για παράλληλες συμβάσεις: το contractBudget στο ΚΗΜΔΗΣ συχνά περιέχει
    // το συνολικό ποσό ανάθεσης αντί του ποσού της μεμονωμένης σύμβασης.
    if (parallelCase || Number(linkedContractCount) > 1) {
      if (ownTotalGross != null) {
        return { amount: ownTotalGross, source: CONTRACT_TOTAL_AMOUNT_SOURCE };
      }
      return { amount: null, source: '', multipleContracts: true, suspiciousBudget: true };
    }
    return {
      amount: grossFromContractBudget(budget, vatRate),
      source: 'Σύμβαση (ΚΗΜΔΗΣ)',
    };
  }
  if (allowAwardFallback === false) {
    return { amount: null, source: '' };
  }
  if (ownTotalGross != null) {
    return { amount: ownTotalGross, source: CONTRACT_TOTAL_AMOUNT_SOURCE };
  }
  if (parallelCase || blockSharedAwardFallback || Number(linkedContractCount) > 1) {
    return { amount: null, source: '', multipleContracts: true };
  }
  const awrdGross = grossFromCostSnapshot(auctionSnapshot);
  if (awrdGross != null) {
    return { amount: awrdGross, source: 'Απόφαση ανάθεσης' };
  }
  const procGross = grossFromCostSnapshot(noticeSnapshot);
  if (procGross != null) {
    return { amount: procGross, source: 'Δημοσίευση' };
  }
  return { amount: null, source: '' };
}

function applyContractAmountResolution(record, context = {}) {
  if (!record || typeof record !== 'object') return record;
  const resolved = resolveKhmdhsContractAmount(record, context);
  if (resolved.amount == null) {
    // Παράλληλη σύμβαση: το contractBudget του ΚΗΜΔΗΣ είναι αναξιόπιστο (συχνά
    // περιέχει το συνολικό ποσό ανάθεσης). Το σημαδεύουμε ώστε η εμφάνιση να
    // το αποκρύψει και να ζητήσει χειροκίνητη συμπλήρωση.
    if (resolved.suspiciousBudget) {
      return { ...record, contractBudgetSuppressed: true };
    }
    return record;
  }
  return {
    ...record,
    resolvedContractAmount: resolved.amount,
    resolvedContractAmountGross: true,
    contractAmountSource: resolved.source,
  };
}

function mergeContractKhmdhsRow(incomingRow, existingRow, requires) {
  const inc = incomingRow && typeof incomingRow === 'object' ? incomingRow : {};
  const ex = existingRow && typeof existingRow === 'object' ? existingRow : {};
  const adamIncoming = normalizeAdam(inc.khmdhsAdam) || '';
  const adamExisting = normalizeAdam(ex.khmdhsAdam) || '';
  const adam = adamIncoming || (requires ? adamExisting : '');
  let snapshot = pickKhmdhsSnapshot(inc.khmdhsContractSnapshot);
  if (!snapshot && adam) snapshot = pickKhmdhsSnapshot(ex.khmdhsContractSnapshot);
  const fetchedAt = adam
    ? String(inc.khmdhsContractFetchedAt || ex.khmdhsContractFetchedAt || '')
    : '';
  if (!adam) {
    return { ...inc, khmdhsAdam: '', khmdhsContractSnapshot: null, khmdhsContractFetchedAt: '' };
  }
  return {
    ...inc,
    khmdhsAdam: adam,
    khmdhsContractSnapshot: snapshot,
    khmdhsContractFetchedAt: fetchedAt
  };
}

function isMultipleContractsForm(implementationForm) {
  return implementationForm === 'Πολλές Συμβάσεις';
}

/** Συγχώνευση ΑΔΑΜ/στοιχείων ΚΗΜΔΗΣ κατά την αποθήκευση */
function mergeKhmdhsFieldsForSave(projectData, existingData) {
  const existing = existingData && typeof existingData === 'object' ? existingData : {};
  const incoming = projectData && typeof projectData === 'object' ? projectData : {};
  const status = incoming.projectStatus || existing.projectStatus || '';
  const requires = statusRequiresKhmdhsAdam(status);
  const impl = incoming.implementationForm || existing.implementationForm || '';
  const noticeFields = mergeKhmdhsNoticeFieldsForSave(projectData, existingData);

  if (isMultipleContractsForm(impl)) {
    const incContracts = Array.isArray(incoming.contracts) ? incoming.contracts : [];
    const exContracts = Array.isArray(existing.contracts) ? existing.contracts : [];
    const contracts = incContracts.map((row, i) => mergeContractKhmdhsRow(row, exContracts[i], requires));
    return {
      contracts,
      khmdhsAdam: '',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: '',
      ...noticeFields
    };
  }

  const adamIncoming = normalizeAdam(incoming.khmdhsAdam) || '';
  const adamExisting = normalizeAdam(existing.khmdhsAdam) || '';
  const adam = adamIncoming || (requires ? adamExisting : '');

  let snapshot = pickKhmdhsSnapshot(incoming.khmdhsContractSnapshot);
  if (!snapshot && adam) snapshot = pickKhmdhsSnapshot(existing.khmdhsContractSnapshot);

  const fetchedAt = adam
    ? String(incoming.khmdhsContractFetchedAt || existing.khmdhsContractFetchedAt || '')
    : '';

  const clearedContracts = Array.isArray(incoming.contracts)
    ? incoming.contracts.map((row) => ({
        ...row,
        khmdhsAdam: '',
        khmdhsContractSnapshot: null,
        khmdhsContractFetchedAt: ''
      }))
    : incoming.contracts;

  if (!adam) {
    return {
      contracts: clearedContracts,
      khmdhsAdam: '',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: '',
      ...noticeFields
    };
  }

  return {
    contracts: clearedContracts,
    khmdhsAdam: adam,
    khmdhsContractSnapshot: snapshot,
    khmdhsContractFetchedAt: fetchedAt,
    ...noticeFields
  };
}

async function fetchKhmdhsContractByAdam(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) {
    return {
      success: false,
      error:
        'Μη έγκυρος κωδικός ΑΔΑΜ. Χρησιμοποιήστε μορφή όπως 26SYMV018523441 (έτος + τύπος π.χ. SYMV + 9 ψηφία).'
    };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/contract?page=0`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(buildContractSearchBody(adam))
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: friendlyKhmdhsInvalidResponseError(res.status) };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsError(typeof msg === 'string' ? msg : String(msg), res.status, adam, 'contract'),
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return {
      success: false,
      error: friendlyKhmdhsAdamNotFoundError({ adam, kind: 'contract' }),
    };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper);
  if (!row) {
    return { success: false, error: `Ο ΑΔΑΜ ${adam} δεν αντιστοιχεί ακριβώς σε κάποια σύμβαση στα αποτελέσματα ΚΗΜΔΗΣ. Ελέγξτε τον κωδικό.` };
  }
  const snapshot = mapContractRecord(row);
  if (!snapshot) {
    return { success: false, error: 'Βρέθηκε η σύμβαση αλλά δεν επιστράφηκαν δεδομένα από το ΚΗΜΔΗΣ.' };
  }
  return { success: true, snapshot };
}

const PAYMENT_ADAM_TYPE = 'PAY';

function normalizePaymentAdam(s) {
  const t = normalizeAdam(s);
  if (!t) return null;
  const match = ADAM_REGEX.exec(t);
  if (!match || match[2].toUpperCase() !== PAYMENT_ADAM_TYPE) return null;
  return t;
}

/** Snapshot χρηματικού εντάλματος πληρωμής (PAY) */
function mapPaymentRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const contractRef = row.contractRefNo;
  const auctionRef = row.auctionRefNo;
  const requestRef = row.requestRefNo;
  return {
    referenceNumber: row.referenceNumber || null,
    title: row.title || null,
    signedDate: row.signedDate || null,
    submissionDate: row.submissionDate || null,
    lastUpdateDate: row.lastUpdateDate || null,
    cancelled: !!row.cancelled,
    cancellationDate: row.cancellationDate || null,
    cancellationReason: row.cancellationReason || null,
    credit: row.credit === true,
    protocolNumber: row.protocolNumber || null,
    paymentCommitmentCode: row.paymentCommitmentCode || null,
    commitmentNo: row.commitmentNo || null,
    aaht: row.aaht || null,
    paymentRelatedAda: row.paymentRelatedAda || null,
    organization: keyValueText(row.organization) || null,
    contractType: keyValueText(row.contractType) || null,
    contractValue: row.contractValue != null ? row.contractValue : null,
    totalCostWithoutVAT: row.totalCostWithoutVAT != null ? row.totalCostWithoutVAT : null,
    totalCostWithVAT: row.totalCostWithVAT != null ? row.totalCostWithVAT : null,
    fundingSummary: buildFundingSummary(row.fundingDetails),
    contractRefNo: Array.isArray(contractRef) ? contractRef[0] : (contractRef || null),
    auctionRefNo: Array.isArray(auctionRef) ? auctionRef[0] : (auctionRef || null),
    requestRefNo: Array.isArray(requestRef) ? requestRef[0] : (requestRef || null),
  };
}

function pickKhmdhsPaymentSnapshot(snapshot) {
  const mapped = mapPaymentRecord(snapshot) || snapshot;
  if (!mapped || typeof mapped !== 'object') return null;
  if (!mapped.title && !mapped.referenceNumber && mapped.totalCostWithVAT == null) return null;
  return mapped;
}

async function fetchKhmdhsPaymentByAdam(adamRaw) {
  const adam = normalizePaymentAdam(adamRaw);
  if (!adam) {
    return {
      success: false,
      error: 'Μη έγκυρος ΑΔΑΜ εντάλματος πληρωμής. Χρησιμοποιήστε μορφή ##PAY######### (π.χ. 26PAY019139980).',
    };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/payment?page=0`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ referenceNumber: adam }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, error: friendlyKhmdhsInvalidResponseError(res.status) };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsError(typeof msg === 'string' ? msg : String(msg), res.status, adam, 'payment'),
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return { success: false, error: friendlyKhmdhsAdamNotFoundError({ adam, kind: 'payment' }) };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper);
  if (!row) {
    return { success: false, error: `Ο ΑΔΑΜ ${adam} δεν αντιστοιχεί ακριβώς σε κάποιο ένταλμα στα αποτελέσματα ΚΗΜΔΗΣ. Ελέγξτε τον κωδικό.` };
  }
  const snapshot = mapPaymentRecord(row);
  if (!snapshot) {
    return { success: false, error: 'Βρέθηκε το ένταλμα αλλά δεν επιστράφηκαν δεδομένα από το ΚΗΜΔΗΣ.' };
  }
  return { success: true, snapshot };
}

/** Συνδεδεμένες πράξεις (αλυσίδα ΑΔΑΜ) — GET, χωρίς σώμα */
async function fetchKhmdhsAdamChain(adamRaw, opts = {}) {
  const adam = normalizeAdam(String(adamRaw || '').trim());
  if (!adam) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ για αλυσίδα.' };
  }
  const externalSignal = opts?.signal;
  if (externalSignal?.aborted) {
    return { success: false, error: 'Η διαδικασία ακυρώθηκε.', aborted: true };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/adamChain/${encodeURIComponent(adam)}`;
  let res;
  try {
    res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: externalSignal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      return { success: false, aborted: true, error: 'Η διαδικασία ακυρώθηκε.' };
    }
    if (e.name === 'TimeoutError') {
      return {
        success: false,
        error: 'Η ανάκτηση της αλυσίδας ΑΔΑΜ διήρκεσε πάρα πολύ. Δοκιμάστε αργότερα.',
      };
    }
    return { success: false, error: e.message || 'Σφάλμα σύνδεσης με ΚΗΜΔΗΣ.' };
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return { success: false, error: friendlyKhmdhsChainError(json?.message, res.status, adam) };
  }
  if (!json) {
    return { success: false, error: 'Το ΚΗΜΔΗΣ επέστρεψε μη έγκυρη απόκριση στην αλυσίδα ΑΔΑΜ.' };
  }
  return { success: true, adamChain: json };
}

module.exports = {
  STATUSES_WITH_KHMDHS_ADAM,
  statusRequiresKhmdhsAdam,
  normalizeAdam,
  normalizeNoticeAdam,
  normalizeRequestAdam,
  normalizePaymentAdam,
  mapContractRecord,
  mapNoticeRecord,
  mapRequestRecord,
  mapPaymentRecord,
  pickKhmdhsPaymentSnapshot,
  mapKhmdhsToAssignmentProcedure,
  pickKhmdhsSnapshot,
  pickKhmdhsNoticeSnapshot,
  pickKhmdhsRequestSnapshot,
  pickKhmdhsAwardSnapshot,
  mergeKhmdhsFieldsForSave,
  fetchKhmdhsContractByAdam,
  fetchKhmdhsNoticeByAdam,
  fetchKhmdhsAuctionByAdam,
  fetchKhmdhsRequestByAdam,
  fetchKhmdhsPaymentByAdam,
  fetchKhmdhsAdamChain,
  mapAuctionRecord,
  resolveKhmdhsContractAmount,
  applyContractAmountResolution,
  buildKhmdhsAmountContext,
  friendlyKhmdhsChainError,
};
