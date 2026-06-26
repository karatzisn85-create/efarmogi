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

const KHMDHS_CHAIN_CLOSED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';

function isKhmdhsChainClosedSubproject(project) {
  return project?.projectStatus === KHMDHS_CHAIN_CLOSED_STATUS;
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
  canUserRefreshKhmdhsOnServer,
  isKhmdhsChainClosedSubproject,
};
