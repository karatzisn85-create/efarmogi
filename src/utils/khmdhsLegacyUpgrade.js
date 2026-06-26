import { isAbandonedSubproject } from '../data/formOptions';
import { isMultipleContractsForm } from './khmdhsFields';

function normalizeSeed(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '');
}

/** ΑΔΑΜ εκκίνησης για αναβάθμιση παλιού υποέργου */
export function getKhmdhsUpgradeSeedAdam(project) {
  if (!project) return '';

  const explicit = normalizeSeed(project.khmdhsChainSeedAdam);
  if (explicit) return explicit;

  const fromMeta = normalizeSeed(project.khmdhsAdamChainMeta?.seedAdam);
  if (fromMeta) return fromMeta;

  if (isMultipleContractsForm(project.implementationForm)) {
    for (const row of project.contracts || []) {
      const adam = normalizeSeed(row?.khmdhsAdam);
      if (adam) return adam;
    }
  }

  return normalizeSeed(project.khmdhsNoticeAdam) || normalizeSeed(project.khmdhsAdam) || '';
}

/** Index σύμβασης με ΑΔΑΜ (πολλές συμβάσεις) */
export function getKhmdhsUpgradeContractIndex(project) {
  if (!project || !isMultipleContractsForm(project.implementationForm)) return -1;
  const rows = project.contracts || [];
  for (let i = 0; i < rows.length; i += 1) {
    if (normalizeSeed(rows[i]?.khmdhsAdam)) return i;
  }
  return rows.length > 0 ? 0 : -1;
}

/**
 * Παλιό υποέργο με καταχωρημένο ΑΔΑΜ αλλά χωρίς πλήρη αλυσίδα ΚΗΜΔΗΣ.
 */
export function needsKhmdhsLegacyUpgrade(project) {
  if (!project) return false;
  if (isAbandonedSubproject(project.projectStatus)) return false;
  if (project.projectStatus === 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ') return false;

  const seed = getKhmdhsUpgradeSeedAdam(project);
  if (!seed) return false;

  if (project.khmdhsAdamChainMeta?.resolvedAt) return false;

  return true;
}

/** Αναβάθμιση στη φόρμα, αποθήκευση ακόμα pending */
export function khmdhsLegacyUpgradePendingSave(formData, editingProject) {
  const hasMetaInForm = !!formData?.khmdhsAdamChainMeta?.resolvedAt;
  const hadMetaOnDisk = !!editingProject?.khmdhsAdamChainMeta?.resolvedAt;
  return hasMetaInForm && !hadMetaOnDisk;
}
