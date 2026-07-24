/**
 * Server-side: seed ΑΔΑΜ ανανέωσης + έλεγχος δικαιωμάτων.
 */
const { projectVisibleToEngineerContext, buildEngineerVisibilityContext } = require('./chargeFilterUtils');

function parseAdamType(adamRaw) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adamRaw || '').trim());
  return m ? m[2].toUpperCase() : '';
}

function sanitizeAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
}

function pickFirstAdam(...candidates) {
  for (const raw of candidates) {
    const adam = sanitizeAdam(raw);
    if (adam) return adam;
  }
  return '';
}

function getKhmdhsRefreshSeedAdam(project) {
  if (!project) {
    return { adam: '', source: 'none', label: '' };
  }

  const branchAdam = pickFirstAdam(project.khmdhsBranchAnchorAdam);
  if (branchAdam) {
    const branchType = parseAdamType(branchAdam);
    const branchLabels = {
      SYMV: 'άγκυρα — σύμβαση',
      PROC: 'άγκυρα — δημοσίευση',
      REQ: 'άγκυρα — αίτημα',
    };
    return {
      adam: branchAdam,
      source: 'branch',
      label: branchLabels[branchType] || 'άγκυρα υποέργου',
    };
  }

  const reqAdam = pickFirstAdam(
    project.khmdhsRequestAdam,
    project.khmdhsRequestSnapshot?.referenceNumber,
  );
  if (reqAdam && parseAdamType(reqAdam) === 'REQ') {
    return { adam: reqAdam, source: 'req', label: 'πρωτογενές αίτημα (REQ)' };
  }

  const procAdam = pickFirstAdam(
    project.khmdhsNoticeAdam,
    project.khmdhsNoticeSnapshot?.referenceNumber,
  );
  if (procAdam) {
    return { adam: procAdam, source: 'proc', label: 'δημοσίευση / πρόσκληση (PROC)' };
  }

  const awrdAdam = pickFirstAdam(
    project.khmdhsAwardAdam,
    project.khmdhsAwardSnapshot?.referenceNumber,
  );
  if (awrdAdam) {
    return { adam: awrdAdam, source: 'awrd', label: 'ανάθεση (AWRD)' };
  }

  const symvAdam = pickFirstAdam(
    project.khmdhsAdam,
    project.khmdhsContractSnapshot?.referenceNumber,
    ...(project.contracts || []).map((c) => c?.khmdhsAdam),
    project.khmdhsChainSeedAdam,
  );
  if (symvAdam) {
    return { adam: symvAdam, source: 'symv', label: 'σύμβαση (SYMV)' };
  }

  const legacy = pickFirstAdam(project.khmdhsChainSeedAdam);
  if (legacy) {
    return { adam: legacy, source: 'legacy', label: 'αποθηκευμένος ΑΔΑΜ αλυσίδας' };
  }

  return { adam: '', source: 'none', label: '' };
}

function isConfirmedStitchPlan(plan) {
  if (!plan || plan.status !== 'confirmed' || !Array.isArray(plan.segments)) return false;
  const withSeed = plan.segments.filter((s) => sanitizeAdam(s?.seedAdam));
  return withSeed.length >= 2;
}

function stitchPlanConflictsWithImplementationForm(plan, implementationForm) {
  if (!isConfirmedStitchPlan(plan)) return false;
  const stored = String(plan.implementationFormAtConfirm || '').trim();
  // Παλιά σχέδια χωρίς αποθηκευμένη μορφή: δεν εφαρμόζουμε σιωπηλά.
  if (!stored) return true;
  const wasMulti = stored === 'Πολλές Συμβάσεις';
  const isMulti = String(implementationForm || '').trim() === 'Πολλές Συμβάσεις';
  return wasMulti !== isMulti;
}

/** Οι σπόροι του επιβεβαιωμένου σχεδίου τεχνητής αλυσίδας (με σειρά, μοναδικοί). */
function getConfirmedStitchSeedAdams(project) {
  const plan = project?.khmdhsChainStitchPlan;
  if (!isConfirmedStitchPlan(plan)) return [];
  const seen = new Set();
  const out = [];
  plan.segments.forEach((s) => {
    const a = sanitizeAdam(s?.seedAdam);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  });
  return out;
}

/**
 * Λίστα σπόρων ανανέωσης. Αν υπάρχει επιβεβαιωμένο σχέδιο τεχνητής αλυσίδας,
 * επιστρέφει όλους τους σπόρους του σχεδίου· αλλιώς τον έναν σπόρο (μονή άγκυρα).
 * Αν άλλαξε η μορφή υλοποίησης (μία ↔ πολλές) από την επιβεβαίωση, αγνοεί το σχέδιο.
 * @returns {{ adams: string[], usesStitchPlan: boolean, primary: {adam,source,label}, stitchPlanFormMismatch?: boolean }}
 */
function getKhmdhsRefreshSeedAdams(project) {
  const plan = project?.khmdhsChainStitchPlan;
  const planConflict = stitchPlanConflictsWithImplementationForm(
    plan,
    project?.implementationForm
  );
  const planSeeds = planConflict ? [] : getConfirmedStitchSeedAdams(project);
  if (planSeeds.length >= 2) {
    return {
      adams: planSeeds,
      usesStitchPlan: true,
      primary: { adam: planSeeds[0], source: 'stitch', label: 'τεχνητή αλυσίδα (πολλοί ΑΔΑΜ)' },
      stitchPlanFormMismatch: false,
    };
  }
  const single = getKhmdhsRefreshSeedAdam(project);
  return {
    adams: single.adam ? [single.adam] : [],
    usesStitchPlan: false,
    primary: single,
    stitchPlanFormMismatch: planConflict,
  };
}

const KHMDHS_CHAIN_CLOSED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';

function isKhmdhsChainClosedSubproject(project) {
  return project?.projectStatus === KHMDHS_CHAIN_CLOSED_STATUS;
}

function readStoredApeAmountRaw(project, contractIndex = null) {
  if (!project) return '';
  const isMulti = project.implementationForm === 'Πολλές Συμβάσεις';

  const fromSlice = (slice) => {
    if (!slice || typeof slice !== 'object') return '';
    const entries = Array.isArray(slice.apeEntries) ? slice.apeEntries : [];
    if (entries.length) {
      const sorted = [...entries].sort((a, b) => {
        const da = String(a?.documentDate || a?.createdAt || '').slice(0, 10);
        const db = String(b?.documentDate || b?.createdAt || '').slice(0, 10);
        return da.localeCompare(db);
      });
      const latest = sorted[sorted.length - 1];
      const fromEntry = String(latest?.apeAmount || '').trim();
      if (fromEntry) return fromEntry;
      const legacy = String(slice.apeAmount || '').trim();
      if (legacy && entries.some((e) => (
        String(e?.apeSourceAdam || '').trim()
        || String(e?.apeDiavgeiaAda || '').trim()
        || String(e?.apeFileName || '').trim()
        || String(e?.comments || '').trim()
      ))) {
        return legacy;
      }
    }
    return String(slice.apeAmount || '').trim();
  };

  if (contractIndex != null && contractIndex >= 0 && isMulti) {
    return fromSlice(project.contracts?.[contractIndex]);
  }
  if (isMulti) return '';
  return fromSlice(project);
}

function parseStoredApeAmountGross(project) {
  const raw = readStoredApeAmountRaw(project);
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function canUserRefreshKhmdhsOnServer(user, project) {
  if (!user || !project) return false;
  if (isKhmdhsChainClosedSubproject(project)) return false;
  const role = user.role;
  if (role === 'USER') return false;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
  if (role === 'ENGINEER') {
    const ctx = buildEngineerVisibilityContext(
      user.username,
      user.assignedSupervisors || []
    );
    return projectVisibleToEngineerContext(project, ctx);
  }
  return false;
}

module.exports = {
  getKhmdhsRefreshSeedAdam,
  getKhmdhsRefreshSeedAdams,
  getConfirmedStitchSeedAdams,
  isConfirmedStitchPlan,
  canUserRefreshKhmdhsOnServer,
  isKhmdhsChainClosedSubproject,
  readStoredApeAmountRaw,
  parseStoredApeAmountGross,
};
