/**
 * Έλεγχος λήξης σύμβασης / παρατάσεων μετά ανάκτηση ΚΗΜΔΗΣ — πρόταση «Ολοκληρωμένο».
 */
import {
  PROJECT_STATUS_CONTRACT_PROCESS,
  isKhmdhsStatusProtectedFromAutoUpdate,
  isProjectStatusAtOrBeyondCompleted,
} from '../data/formOptions';
import { PROJECT_STATUS_EXECUTED } from './khmdhsAdamGuidance';
import {
  getTotalContractAmount,
  isMultipleContractsForm,
  normalizeContractsFromProject,
  parseGreekAmountString,
  resolveEffectivePayableAmountGrossForPayments,
} from './khmdhsFields';
import { daysUntilDate } from './procurementDeadlines';
import { resolveContractEndDateIso } from './procurementCalendarEvents';
import { formatKhmdhsDateOnly } from './khmdhsNoticeFields';
import { computeChainCharacterizationEffects } from './khmdhsChainActions';
import { reconcileKhmdhsPaymentsFromProject } from './khmdhsPaymentReconciliation';

export const KHMDHS_COMPLETED_STATUS_SUGGESTION = 'ΟΛΟΚΛΗΡΩΜΕΝΟ';

const ELIGIBLE_STATUSES = new Set([
  PROJECT_STATUS_CONTRACT_PROCESS,
  PROJECT_STATUS_EXECUTED,
]);

function contractRowLooksSigned(row) {
  return !!(
    String(row?.khmdhsAdam || '').trim()
    || row?.khmdhsContractSnapshot
    || String(row?.date || '').trim()
    || parseGreekAmountString(row?.amount) > 0
  );
}

function hasSignedContractFootprint(form) {
  if (!form || getTotalContractAmount(form) <= 0) return false;
  if (isMultipleContractsForm(form.implementationForm)) {
    return normalizeContractsFromProject(form).some(contractRowLooksSigned);
  }
  return !!(
    String(form.khmdhsAdam || '').trim()
    || form.khmdhsContractSnapshot
    || String(form.contractDate || '').trim()
    || parseGreekAmountString(form.contractAmount) > 0
  );
}

function collectExpiryTracks(form) {
  const review = form.khmdhsDataQualityReview || null;
  const tracks = [];

  if (isMultipleContractsForm(form.implementationForm)) {
    normalizeContractsFromProject(form).forEach((contract, index) => {
      if (!contractRowLooksSigned(contract)) return;
      const endIso = resolveContractEndDateIso(form, contract);
      const chainHistory = contract.khmdhsContractChainHistory || [];
      const effects = chainHistory.length
        ? computeChainCharacterizationEffects(chainHistory, review)
        : null;
      const hasExtension = (effects?.perAct || []).some((a) => a.effect === 'deadline');
      tracks.push({
        label: `Σύμβαση ${index + 1}`,
        endIso,
        hasExtension,
        adam: contract.khmdhsAdam || '',
      });
    });
    return tracks;
  }

  const endIso = resolveContractEndDateIso(form);
  const chainHistory = form.khmdhsContractChainHistory || [];
  const effects = chainHistory.length
    ? computeChainCharacterizationEffects(chainHistory, review)
    : null;
  const hasExtension = (effects?.perAct || []).some((a) => a.effect === 'deadline');
  tracks.push({
    label: 'Σύμβαση',
    endIso,
    hasExtension,
    adam: form.khmdhsAdam || '',
  });
  return tracks;
}

function shouldSkipExpiryPromptForStatus(...statuses) {
  return statuses.some((status) => isProjectStatusAtOrBeyondCompleted(status));
}

/** Έχει καλυφθεί πλήρως το τελικό πληρωτέο από εντάλματα ΚΗΜΔΗΣ. */
function isFullyPaidByKhmdhsPayments(form) {
  if (!form) return false;
  const payable = resolveEffectivePayableAmountGrossForPayments(form);
  if (payable == null || payable <= 0) return false;
  const recon = reconcileKhmdhsPaymentsFromProject(form);
  if (!recon?.activeCount) return false;
  const paid = recon.hasUserClassification
    ? recon.countableTotalGross
    : recon.estimatedContractorPaymentGross;
  return paid >= payable - 0.5;
}

/**
 * @returns {null | {
 *   suggestedStatus: string,
 *   latestEndIso: string,
 *   latestEndLabel: string,
 *   hasExtension: boolean,
 *   tracks: Array,
 *   daysPast: number,
 * }}
 */
export function evaluateKhmdhsContractExpiryPrompt(form, options = {}) {
  const status = form?.projectStatus;
  const statusBeforeKhmdhsRefresh = options?.statusBeforeKhmdhsRefresh;
  if (shouldSkipExpiryPromptForStatus(status, statusBeforeKhmdhsRefresh)) return null;
  if (!status || !ELIGIBLE_STATUSES.has(status)) return null;
  if (isKhmdhsStatusProtectedFromAutoUpdate(status)) return null;
  if (!hasSignedContractFootprint(form)) return null;
  if (isFullyPaidByKhmdhsPayments(form)) return null;

  const tracks = collectExpiryTracks(form);
  if (!tracks.length) return null;
  if (tracks.some((t) => !t.endIso)) return null;

  const allExpired = tracks.every((t) => {
    const days = daysUntilDate(t.endIso);
    return days !== null && days < 0;
  });
  if (!allExpired) return null;

  const latestEndIso = tracks
    .map((t) => t.endIso)
    .sort()
    .reverse()[0];
  const hasExtension = tracks.some((t) => t.hasExtension);
  const daysPast = Math.abs(daysUntilDate(latestEndIso) || 0);

  return {
    suggestedStatus: KHMDHS_COMPLETED_STATUS_SUGGESTION,
    latestEndIso,
    latestEndLabel: formatKhmdhsDateOnly(latestEndIso),
    hasExtension,
    tracks,
    daysPast,
  };
}

export function buildKhmdhsContractExpiryPromptMessage(prompt) {
  if (!prompt) return '';
  const deadlineKind = prompt.hasExtension
    ? 'η καταληκτική προθεσμία μετά από παράταση'
    : 'η ημερομηνία λήξης της σύμβασης';
  const trackLines = (prompt.tracks || []).map((t) => {
    const suffix = t.hasExtension ? ' (μετά από παράταση)' : '';
    return `${t.label}: ${formatKhmdhsDateOnly(t.endIso)}${suffix}`;
  });
  const tracksText = trackLines.length > 1
    ? ` Οι προθεσμίες που εντοπίστηκαν: ${trackLines.join(' · ')}.`
    : '';
  return (
    `Σύμφωνα με τα στοιχεία ΚΗΜΔΗΣ, ${deadlineKind} (${prompt.latestEndLabel}) έχει περάσει`
    + ` — πριν ${prompt.daysPast} ${prompt.daysPast === 1 ? 'ημέρα' : 'ημέρες'}.`
    + tracksText
    + ' Θέλετε να χαρακτηριστεί το υποέργο ως «Ολοκληρωμένο»;'
  );
}
