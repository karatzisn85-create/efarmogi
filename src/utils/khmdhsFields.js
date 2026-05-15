/** ΚΗΜΔΗΣ / ΑΔΑΜ — μία σύμβαση (επίπεδο έργου) ή ανά εγγραφή στο contracts[] */

import { containsSearchTerm } from './searchUtils';

export function emptyKhmdhsOnContract() {
  return {
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: ''
  };
}

export function normalizeContractRow(contract) {
  const c = contract && typeof contract === 'object' ? contract : {};
  return {
    date: c.date != null ? String(c.date) : '',
    amount: c.amount != null ? String(c.amount) : '',
    apeAmount: c.apeAmount != null ? String(c.apeAmount) : '',
    comments: c.comments != null ? String(c.comments) : '',
    khmdhsAdam: c.khmdhsAdam != null ? String(c.khmdhsAdam) : '',
    khmdhsContractSnapshot: c.khmdhsContractSnapshot || null,
    khmdhsContractFetchedAt: c.khmdhsContractFetchedAt != null ? String(c.khmdhsContractFetchedAt) : ''
  };
}

export function isMultipleContractsForm(implementationForm) {
  return implementationForm === 'Πολλές Συμβάσεις';
}

/** Μεταφορά παλιού ενιαίου ΑΔΑΜ στην 1η σύμβαση */
export function normalizeContractsFromProject(project) {
  if (!project) return [];
  let contracts = Array.isArray(project.contracts)
    ? project.contracts.map(normalizeContractRow)
    : [];
  if (isMultipleContractsForm(project.implementationForm) && project.khmdhsAdam && contracts.length > 0) {
    const topAdam = String(project.khmdhsAdam || '').trim();
    if (topAdam && !String(contracts[0].khmdhsAdam || '').trim()) {
      contracts = contracts.map((c, i) =>
        i === 0
          ? {
              ...c,
              khmdhsAdam: topAdam,
              khmdhsContractSnapshot: project.khmdhsContractSnapshot || c.khmdhsContractSnapshot,
              khmdhsContractFetchedAt:
                project.khmdhsContractFetchedAt != null ? String(project.khmdhsContractFetchedAt) : c.khmdhsContractFetchedAt
            }
          : c
      );
    }
  }
  return contracts;
}

/** Εγγραφές για κάρτα / λεπτομέρεια */
export function getKhmdhsDisplayEntries(project) {
  if (!project) return [];
  if (isMultipleContractsForm(project.implementationForm) && Array.isArray(project.contracts)) {
    return project.contracts
      .map((c, i) => ({
        contractIndex: i + 1,
        adam: String(c?.khmdhsAdam || '').trim(),
        snapshot: c?.khmdhsContractSnapshot || null,
        fetchedAt: c?.khmdhsContractFetchedAt || ''
      }))
      .filter((e) => e.adam || e.snapshot);
  }
  const adam = String(project.khmdhsAdam || '').trim();
  const snapshot = project.khmdhsContractSnapshot || null;
  if (!adam && !snapshot) return [];
  return [
    {
      contractIndex: null,
      adam,
      snapshot,
      fetchedAt: project.khmdhsContractFetchedAt || ''
    }
  ];
}

export function projectHasKhmdhsData(project) {
  return getKhmdhsDisplayEntries(project).length > 0;
}

function normalizeVatDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function matchesAnadoxosVat(storedVat, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  const stored = String(storedVat || '').trim();
  if (!stored) return false;
  if (containsSearchTerm(stored, q)) return true;
  const qDigits = normalizeVatDigits(q);
  const sDigits = normalizeVatDigits(stored);
  return qDigits.length > 0 && sDigits.includes(qDigits);
}

/** Κείμενο αναζήτησης από όλες τις εγγραφές ΚΗΜΔΗΣ του υποέργου. */
export function getProjectKhmdhsSearchText(project) {
  const parts = [];
  getKhmdhsDisplayEntries(project).forEach((entry) => {
    if (entry.adam) parts.push(entry.adam);
    const snap = entry.snapshot;
    if (!snap) return;
    if (snap.anadoxosName) parts.push(snap.anadoxosName);
    if (snap.anadoxosVat) parts.push(snap.anadoxosVat);
    if (snap.assigningAuthority) parts.push(snap.assigningAuthority);
  });
  return parts.join(' ');
}

/**
 * Φίλτρο επωνυμίας / ΑΦΜ ανάδοχου (στοιχεία από ΚΗΜΔΗΣ).
 * Αν συμπληρωθούν και τα δύο, πρέπει να ταιριάζουν στην ίδια σύμβαση.
 */
export function projectMatchesKhmdhsAnadoxosFilters(project, { anadoxosName = '', anadoxosVat = '' } = {}) {
  const nameQ = String(anadoxosName || '').trim();
  const vatQ = String(anadoxosVat || '').trim();
  if (!nameQ && !vatQ) return true;

  const entries = getKhmdhsDisplayEntries(project).filter((e) => e.snapshot);
  if (entries.length === 0) return false;

  return entries.some((entry) => {
    const snap = entry.snapshot;
    const nameOk = !nameQ || containsSearchTerm(snap.anadoxosName, nameQ);
    const vatOk = matchesAnadoxosVat(snap.anadoxosVat, vatQ);
    return nameOk && vatOk;
  });
}
