/**
 * Ανάκτηση δημόσιων δεδομένων σύμβασης από το επίσημο ΚΗΜΔΗΣ OpenData API.
 * Βάση: https://cerpp.eprocurement.gov.gr — τεκμηρίωση /khmdhs-opendata/
 */

const KHMDHS_BASE = 'https://cerpp.eprocurement.gov.gr';

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

function friendlyKhmdhsError(message, httpStatus) {
  const raw = String(message || '').trim();
  if (/no auctions found/i.test(raw)) {
    return 'Δεν βρέθηκε σύμβαση με αυτόν τον ΑΔΑΜ στο ΚΗΜΔΗΣ (ανοικτό API). Ελέγξτε τον κωδικό ή δοκιμάστε αργότερα.';
  }
  if (httpStatus === 404) {
    return 'Δεν βρέθηκε σύμβαση με αυτόν τον ΑΔΑΜ στο ΚΗΜΔΗΣ (ανοικτό API).';
  }
  return raw || `Σφάλμα επικοινωνίας με το ΚΗΜΔΗΣ (HTTP ${httpStatus}).`;
}

/** Μόνο ανάδοχος, ΑΦΜ και αναθέτουσα — χωρίς ποσά ή λοιπά πεδία. */
function mapContractRecord(c) {
  if (!c || typeof c !== 'object') return null;
  const members = (c.contractingDataDetails && c.contractingDataDetails.contractingMembersDataList) || [];
  const member = members[0] || {};
  return {
    anadoxosName: member.name || null,
    anadoxosVat: member.vatNumber != null ? String(member.vatNumber) : null,
    assigningAuthority: c.organization && c.organization.value ? c.organization.value : null
  };
}

function pickKhmdhsSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const out = {
    anadoxosName: snapshot.anadoxosName || null,
    anadoxosVat: snapshot.anadoxosVat != null ? String(snapshot.anadoxosVat) : null,
    assigningAuthority: snapshot.assigningAuthority || null
  };
  if (!out.anadoxosName && !out.anadoxosVat && !out.assigningAuthority) return null;
  return out;
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

  if (isMultipleContractsForm(impl)) {
    const incContracts = Array.isArray(incoming.contracts) ? incoming.contracts : [];
    const exContracts = Array.isArray(existing.contracts) ? existing.contracts : [];
    const contracts = incContracts.map((row, i) => mergeContractKhmdhsRow(row, exContracts[i], requires));
    return {
      contracts,
      khmdhsAdam: '',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: ''
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
      khmdhsContractFetchedAt: ''
    };
  }

  return {
    contracts: clearedContracts,
    khmdhsAdam: adam,
    khmdhsContractSnapshot: snapshot,
    khmdhsContractFetchedAt: fetchedAt
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
  const res = await fetch(url, {
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
    return { success: false, error: `Μη έγκυρη απάντηση από τον διακομιστή ΚΗΜΔΗΣ (HTTP ${res.status}).` };
  }
  if (!res.ok) {
    const msg = json.message || (json.errors && JSON.stringify(json.errors)) || `HTTP ${res.status}`;
    return {
      success: false,
      error: friendlyKhmdhsError(typeof msg === 'string' ? msg : String(msg), res.status)
    };
  }
  const content = json.content;
  if (!Array.isArray(content) || content.length === 0) {
    return {
      success: false,
      error: 'Δεν βρέθηκε σύμβαση με αυτόν τον ΑΔΑΜ στο ΚΗΜΔΗΣ (ανοικτό API). Ελέγξτε τον κωδικό ή δοκιμάστε αργότερα.'
    };
  }
  const upper = adam.toUpperCase();
  const row = content.find((x) => String(x.referenceNumber || '').toUpperCase() === upper) || content[0];
  const snapshot = mapContractRecord(row);
  return { success: true, snapshot };
}

/** Συνδεδεμένες πράξεις (αλυσίδα ΑΔΑΜ) — GET, χωρίς σώμα */
async function fetchKhmdhsAdamChain(adamRaw) {
  const adam = normalizeAdam(String(adamRaw || '').trim());
  if (!adam) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ για αλυσίδα.' };
  }
  const url = `${KHMDHS_BASE}/khmdhs-opendata/adamChain/${encodeURIComponent(adam)}`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: json.message || `HTTP ${res.status}` };
  }
  return { success: true, adamChain: json };
}

module.exports = {
  STATUSES_WITH_KHMDHS_ADAM,
  statusRequiresKhmdhsAdam,
  normalizeAdam,
  mapContractRecord,
  pickKhmdhsSnapshot,
  mergeKhmdhsFieldsForSave,
  fetchKhmdhsContractByAdam,
  fetchKhmdhsAdamChain
};
