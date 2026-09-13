/**
 * Αναζήτηση αποδοχής χρηματοδότησης / απόφασης Δ.Σ. στη Διαύγεια
 * και αποθήκευση του PDF στα αρχεία αποδοχής της ένταξης.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const diavgeiaOpenData = require('./diavgeiaOpenData');
const match = require(path.join(__dirname, '..', 'app', 'core', 'entaxiAcceptanceMatch'));
const { peekE2EDiavgeiaAcceptance, takeE2EDiavgeiaAcceptance, isE2EProcess } = require('./e2eMode');

function fileNameList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      return String(item.fileName || item.name || '').trim();
    }
    return '';
  }).filter(Boolean);
}

function defaultApprovalFileName(ada, role) {
  const n = match.normalizeAda(ada);
  const prefix = role === 'committee_accept' ? 'Αποδοχή Επιτροπής' : 'Αποδοχή Δ.Σ.';
  return n ? `${prefix} — Διαύγεια ${n}.pdf` : `${prefix} — Διαύγεια.pdf`;
}

function writeMinimalPdf(destPath) {
  const body = '%PDF-1.1\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  fs.writeFileSync(destPath, body);
}

function acceptanceSearchOptions(entaxi, modification) {
  const mode = modification ? 'modification' : 'entaxi';
  const fromDate = modification
    ? String(modification.date || modification.documentDate || entaxi?.documentDate || entaxi?.createdAt || '').slice(0, 10)
    : String(entaxi?.documentDate || entaxi?.createdAt || '').slice(0, 10);
  return { mode, fromDate };
}

async function searchEntaxiAcceptance(entaxi, { organizationName = '', modification = null } = {}) {
  if (!entaxi || !entaxi.entaxiId) {
    return { success: false, error: 'Λείπει η ένταξη.' };
  }
  if (modification && !String(modification.modificationId || '').trim()) {
    return { success: false, error: 'Λείπει η τροποποίηση.' };
  }

  const searchOpts = acceptanceSearchOptions(entaxi, modification);
  const queued = peekE2EDiavgeiaAcceptance();
  if (queued) {
    if (queued.success === false) {
      return { success: false, error: queued.error || 'Δεν βρέθηκε αποδοχή στη Διαύγεια.' };
    }
    const ranked = match.rankAcceptanceCandidates(entaxi, queued.decisions || [], searchOpts);
    return {
      success: true,
      organization: queued.organization || { uid: 'e2e', label: organizationName || 'Δήμος' },
      phrases: match.buildSearchPhrases(entaxi),
      candidates: ranked,
      searchedCount: (queued.decisions || []).length,
      mode: searchOpts.mode,
    };
  }

  const phrases = match.buildSearchPhrases(entaxi);
  if (!phrases.length) {
    return {
      success: false,
      error: 'Η ένταξη δεν έχει ΟΠΣ ούτε αρκετά διακριτικό τίτλο για αναζήτηση στη Διαύγεια.',
    };
  }

  const orgRes = await diavgeiaOpenData.resolveDiavgeiaOrganization(organizationName);
  if (!orgRes.success) return orgRes;

  const fromDate = searchOpts.fromDate;
  const toDate = diavgeiaOpenData.todayIso();
  const windows = diavgeiaOpenData.buildIssueDateWindows(
    fromDate,
    toDate,
    { maxWindows: diavgeiaOpenData.neededIssueDateWindows(fromDate, toDate) }
  );
  const seen = Object.create(null);
  const collected = [];

  for (const phrase of phrases) {
    for (const window of windows) {
      const res = await diavgeiaOpenData.searchDiavgeiaDecisions({
        term: phrase,
        org: orgRes.organization.uid,
        fromIssueDate: window.from,
        toIssueDate: window.to,
        size: 50,
      });
      if (!res.success) continue;
      (res.decisions || []).forEach((d) => {
        const ada = match.normalizeAda(d.ada);
        if (!ada || seen[ada]) return;
        seen[ada] = true;
        collected.push({
          ...d,
          organization: orgRes.organization.label,
        });
      });
    }
  }

  const candidates = match.rankAcceptanceCandidates(entaxi, collected, searchOpts);
  return {
    success: true,
    organization: orgRes.organization,
    phrases,
    candidates,
    searchedCount: collected.length,
    mode: searchOpts.mode,
  };
}

async function prepareAcceptancePdf(candidate) {
  const ada = match.normalizeAda(candidate?.ada);
  if (!ada) {
    return { success: false, error: 'Λείπει ο ΑΔΑ αποδοχής.' };
  }
  const queued = isE2EProcess() ? takeE2EDiavgeiaAcceptance() : null;
  let pdf = null;
  if (queued && queued.attachPdfPath) {
    pdf = { path: queued.attachPdfPath, fileName: defaultApprovalFileName(ada, candidate?.role) };
  } else if (isE2EProcess()) {
    const dest = path.join(os.tmpdir(), `ergohub-diavgeia-e2e-${ada}-${Date.now()}.pdf`);
    writeMinimalPdf(dest);
    pdf = { path: dest, fileName: defaultApprovalFileName(ada, candidate?.role) };
  } else {
    const dl = await diavgeiaOpenData.downloadDiavgeiaDecisionPdf(ada, {
      documentUrl: candidate.documentUrl,
      fileName: defaultApprovalFileName(ada, candidate?.role),
    });
    if (!dl.success) return dl;
    pdf = { path: dl.path, fileName: dl.fileName || defaultApprovalFileName(ada, candidate?.role) };
  }
  return {
    success: true,
    pdf,
    meta: {
      ada,
      subject: String(candidate.subject || '').trim(),
      issueDate: String(candidate.issueDate || '').trim(),
      protocolNumber: String(candidate.protocolNumber || '').trim(),
      role: String(candidate.role || '').trim(),
      roleLabel: String(candidate.roleLabel || '').trim(),
      organization: String(candidate.organization || '').trim(),
      documentUrl: String(candidate.documentUrl || `https://diavgeia.gov.gr/doc/${encodeURIComponent(ada)}`),
      fetchedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  searchEntaxiAcceptance,
  prepareAcceptancePdf,
  fileNameList,
  defaultApprovalFileName,
};
