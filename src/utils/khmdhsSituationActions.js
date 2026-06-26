/** Σταθερές ενεργειών κατάστασης ΚΗΜΔΗΣ (renderer) */

export const KHMDHS_SITUATION_ACTION = {
  ACCEPT_PARTIAL: 'accept_partial',
  OPEN_REVIEW: 'open_review',
  TRY_SYMV: 'try_symv',
  TRY_PRIMARY_SEED: 'try_primary_seed',
  ADD_SUPPLEMENTARY_ADAM: 'add_supplementary_adam',
  RETRY_SEED: 'retry_seed',
  CLEAR_KHMDHS: 'clear_khmdhs',
  MANUAL_CONTINUE: 'manual_continue',
  DISMISS: 'dismiss',
};

export const KHMDHS_SITUATION_SEVERITY = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export function shouldShowKhmdhsSituationModal(report) {
  if (!report?.hasSituations) return false;
  if (report.requiresDecision) return true;
  if (report.primarySeverity === KHMDHS_SITUATION_SEVERITY.ERROR
    || report.primarySeverity === KHMDHS_SITUATION_SEVERITY.WARNING) {
    return true;
  }
  return (report.situations || []).length >= 2;
}

/** Εύρημα πολλών συμβάσεων — ήδη καλύπτεται από επιλογή κλάδου + σχετικά έγγραφα */
export const KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS = 'parallel_contracts_same_case';

const SEVERITY_RANK = {
  [KHMDHS_SITUATION_SEVERITY.ERROR]: 4,
  [KHMDHS_SITUATION_SEVERITY.WARNING]: 3,
  [KHMDHS_SITUATION_SEVERITY.INFO]: 2,
  [KHMDHS_SITUATION_SEVERITY.SUCCESS]: 1,
};

function highestSituationSeverity(situations) {
  let best = KHMDHS_SITUATION_SEVERITY.INFO;
  let rank = 0;
  (situations || []).forEach((s) => {
    const r = SEVERITY_RANK[s.severity] || 0;
    if (r > rank) {
      rank = r;
      best = s.severity;
    }
  });
  return best;
}

/** Αφαιρεί ευρήματα που ο χρήστης έχει ήδη επιλύσει μέσω επιλογής κλάδου */
export function refineSituationReportForBranchSelection(report, { userSelectedBranch = false } = {}) {
  if (!report || !userSelectedBranch) return report;
  const situations = (report.situations || []).filter(
    (s) => s.id !== KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS
  );
  if (situations.length === (report.situations || []).length) return report;
  return {
    ...report,
    situations,
    hasSituations: situations.length > 0,
    requiresDecision: situations.some((s) => s.requiresDecision),
    primarySeverity: situations.length ? highestSituationSeverity(situations) : report.primarySeverity,
  };
}

/** Ακυρωμένο πρωτογενές χωρίς σύμβαση — μην εφαρμόζουμε δεδομένα πριν την επιλογή του χρήστη. */
export function shouldDeferKhmdhsApplyForSituation(report) {
  if (!report?.hasSituations) return false;
  return (report.situations || []).some(
    (s) => s.id === 'seed_cancelled_partial' && s.requiresDecision && !s.found?.contract
  );
}

export function getPrimarySituationAction(situation) {
  if (!situation?.actions?.length) return null;
  return situation.actions.find((a) => a.primary) || situation.actions[0];
}
