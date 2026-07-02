/** ΚΗΜΔΗΣ — προκήρυξη / πρόσκληση (φάση διαδικασίας σύναψης) */

import { ASSIGNMENT_PROCEDURES } from '../data/formOptions';
import { formatDateEl, formatDateTimeEl } from './dateFormat';
import { formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';

export function emptyKhmdhsNoticeFields() {
  return {
    khmdhsNoticeAdam: '',
    khmdhsNoticeSnapshot: null,
    khmdhsNoticeFetchedAt: ''
  };
}

export function pickKhmdhsNoticeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const title = snapshot.title != null ? String(snapshot.title).trim() : '';
  if (!title && !snapshot.referenceNumber) return null;
  return snapshot;
}

export function projectHasKhmdhsNoticeData(project) {
  const adam = String(project?.khmdhsNoticeAdam || '').trim();
  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  return !!(adam || snap);
}

export function noticeDrivesAssignmentProcedure(project) {
  return !!(String(project?.khmdhsNoticeAdam || '').trim()
    && pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot));
}

/** Ετικέτα πεδίου ΑΔΑΜ ανάλογα με τη διαδικασία (χειροκίνητη ή από ΚΗΜΔΗΣ). */
export function getNoticeAdamFieldLabel(assignmentProcedure) {
  const p = String(assignmentProcedure || '').trim();
  if (p === 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ') {
    return 'ΑΔΑΜ πρόσκλησης υποβολής προσφοράς (ΚΗΜΔΗΣ)';
  }
  if (p) {
    return 'ΑΔΑΜ προκήρυξης (ΚΗΜΔΗΣ)';
  }
  return 'ΑΔΑΜ προκήρυξης / πρόσκλησης (ΚΗΜΔΗΣ)';
}

const DIRECT_ASSIGNMENT_PROCEDURE = 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';

/**
 * Τύποι δημοσίευσης ΚΗΜΔΗΣ που αντιστοιχούν πάντα σε Απευθείας Ανάθεση.
 * «Πρόσκληση εκδήλωσης ενδιαφέροντος» · «Πρόσκληση υποβολής προσφορών»
 */
export function mapNoticeTypeToAssignmentProcedure(noticeType) {
  const nt = String(noticeType || '').trim().toLowerCase();
  if (!nt) return null;

  if (/πρόσκληση\s*εκδήλωσης\s*ενδιαφέροντος/i.test(nt)) return DIRECT_ASSIGNMENT_PROCEDURE;
  if (/πρόσκληση\s*υποβολής\s*προσφορ/i.test(nt)) return DIRECT_ASSIGNMENT_PROCEDURE;
  if (/εκδήλωσης\s*ενδιαφέροντος/i.test(nt)) return DIRECT_ASSIGNMENT_PROCEDURE;
  if (/υποβολ[ήη]ς\s*προσφορ/i.test(nt)) return DIRECT_ASSIGNMENT_PROCEDURE;

  return null;
}

/** Διαδικασία εφαρμογής από snapshot — συμπεριλαμβανομένου κανόνα τύπου δημοσίευσης */
export function resolveKhmdhsNoticeAssignmentProcedure(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) return '';

  const stored = String(snap.mappedAssignmentProcedure || '').trim();
  if (stored) return stored;

  const fromNoticeType = mapNoticeTypeToAssignmentProcedure(snap.noticeType);
  if (fromNoticeType) return fromNoticeType;

  return String(snap.typeOfProcedure || '').trim();
}

/** Διαδικασία ανάθεσης — χειροκίνητο πεδίο πρώτα, αλλιώς από snapshot δημοσίευσης */
export function getProjectAssignmentProcedure(project) {
  if (!project) return '';
  const manual = String(project.assignmentProcedure || '').trim();
  if (manual) return manual;
  if (noticeDrivesAssignmentProcedure(project)) {
    return resolveKhmdhsNoticeAssignmentProcedure(project.khmdhsNoticeSnapshot);
  }
  return '';
}

/** Ημ. έναρξης διαδικασίας σύμβασης — από πεδίο υποέργου (αυτόματο ή χειροκίνητο) */
export function getProjectContractProcessStartDate(project) {
  if (!project) return '';
  return String(project.contractProcessStartDate || '').trim();
}

/** Μία γραμμή διαδικασίας για προβολή — χωρίς διπλό ΚΗΜΔΗΣ + εφαρμογή */
export function getKhmdhsNoticeProcedureRow(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) return null;
  const resolved = resolveKhmdhsNoticeAssignmentProcedure(snap);
  const mapped = resolved && ASSIGNMENT_PROCEDURES.includes(resolved) ? resolved : '';
  const raw = String(snap.typeOfProcedure || '').trim();
  if (mapped) {
    return { label: 'Διαδικασία ανάθεσης', value: mapped, highlight: true };
  }
  if (raw) {
    return { label: 'Διαδικασία (ΚΗΜΔΗΣ)', value: raw };
  }
  if (resolved) {
    return { label: 'Διαδικασία (ΚΗΜΔΗΣ)', value: resolved };
  }
  return null;
}

export function formatKhmdhsDateTime(value) {
  return formatDateTimeEl(value, '');
}

export function formatKhmdhsDateOnly(value) {
  return formatDateEl(value, '');
}

/** Ημερομηνία εγγράφου προκήρυξης για χρονολόγιο — όχι ημερομηνία ανάκτησης. */
export function pickKhmdhsNoticeDocumentDateForTimeline(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) {
    return { dateLabel: '', fallbackDate: '', signedDateLabel: '', submissionDateLabel: '' };
  }
  const signedDateLabel = formatKhmdhsDateOnly(snap.signedDate);
  const submissionDateLabel = snap.submissionDate ? formatKhmdhsDateTime(snap.submissionDate) : '';
  const dateLabel = signedDateLabel
    || (snap.submissionDate ? formatKhmdhsDateOnly(snap.submissionDate) : '')
    || submissionDateLabel;
  return {
    dateLabel,
    fallbackDate: snap.submissionDate || snap.signedDate || '',
    signedDateLabel,
    submissionDateLabel,
  };
}

export function formatKhmdhsEuro(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** Γραμμές προβολής στην κάρτα — [{ label, value, highlight? }] */
export function buildKhmdhsNoticeDisplayRows(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) return [];

  const rows = [];
  const push = (label, value, highlight = false) => {
    const v = value != null ? String(value).trim() : '';
    if (v) rows.push({ label, value: v, highlight });
  };

  push('Τίτλος δημοσίευσης', snap.title);
  push('ΑΔΑΜ', snap.referenceNumber);
  push('Τύπος δημοσίευσης', snap.noticeType);
  const procRow = getKhmdhsNoticeProcedureRow(snap);
  if (procRow) push(procRow.label, procRow.value, procRow.highlight);
  push('Είδος', snap.contractType);
  push('Νομικό πλαίσιο', snap.legalContext);
  push('Τρόπος διεξαγωγής', snap.conductingProceedings);
  push('Πλατφόρμα', snap.digitalPlatform);
  push('Κριτήριο ανάθεσης', snap.criteriaCode);
  push('Αναθέτουσα αρχή', snap.organization);
  push('Οργανική μονάδα', snap.unitsOperator);
  push('Αποφαινόμενο όργανο', snap.signer);

  push('Ημ. έκδοσης / πρωτοκόλλου', formatKhmdhsDateOnly(snap.signedDate));
  push('Καταληκτική υποβολής προσφορών', formatKhmdhsDateTime(snap.finalSubmissionDate), true);
  push('Ημ. καταχώρισης ΚΗΜΔΗΣ', formatKhmdhsDateTime(snap.submissionDate));

  if (snap.cancelled) {
    push('Κατάσταση', 'Ματαιωμένη', true);
    push('Ημ. ματαίωσης', formatKhmdhsDateTime(snap.cancellationDate));
    push('Λόγος ματαίωσης', snap.cancellationReason);
  }

  push('Εκτιμώμενη αξία (με ΦΠΑ)', formatKhmdhsCostSnapshotGross(snap));
  push('Εκτιμώμενη αξία (χωρίς ΦΠΑ)', formatKhmdhsEuro(snap.totalCostWithoutVAT));

  if (snap.contractDuration != null && snap.contractDuration !== '') {
    const unit = snap.contractDurationUnit ? ` ${snap.contractDurationUnit}` : '';
    push('Διάρκεια σύμβασης', `${snap.contractDuration}${unit}`);
  }
  if (snap.offersValidTime != null && snap.offersValidTime !== '') {
    const unit = snap.offersValidTimeUnit ? ` ${snap.offersValidTimeUnit}` : '';
    push('Ισχύς προσφορών', `${snap.offersValidTime}${unit}`);
  }

  push('Ιστότοπος υποβολής', snap.biddingWebsite);
  if (snap.systemicNumber) push('Αρ. ηλεκτρ. δημοσίευσης', snap.systemicNumber);
  if (snap.approvedRequestAdam) push('Συνδ. αίτημα (ΑΔΑΜ)', snap.approvedRequestAdam);
  if (Array.isArray(snap.auctionRefNos) && snap.auctionRefNos.length) {
    push('Συνδ. αναθέσεις (ΑΔΑΜ)', snap.auctionRefNos.join(', '));
  }
  if (Array.isArray(snap.cpvs) && snap.cpvs.length) {
    push('CPV', snap.cpvs.join(', '));
  }
  if (snap.fundingSummary) push('Χρηματοδότηση', snap.fundingSummary);

  return rows;
}

/** Ομαδοποίηση για λεπτομερή προβολή */
export function buildKhmdhsNoticeDisplayGroups(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) return [];

  const mkRows = (entries) => entries.filter((r) => r.value);

  const identity = mkRows([
    { label: 'Τίτλος δημοσίευσης', value: snap.title, fullWidth: true },
    { label: 'ΑΔΑΜ', value: snap.referenceNumber, badge: true },
    { label: 'Τύπος δημοσίευσης', value: snap.noticeType },
    { label: 'Είδος', value: snap.contractType }
  ]);

  const procedure = mkRows([
    getKhmdhsNoticeProcedureRow(snap),
    { label: 'Νομικό πλαίσιο', value: snap.legalContext, fullWidth: true },
    { label: 'Τρόπος διεξαγωγής', value: snap.conductingProceedings },
    { label: 'Πλατφόρμα', value: snap.digitalPlatform },
    { label: 'Κριτήριο ανάθεσης', value: snap.criteriaCode }
  ].filter(Boolean));

  const authority = mkRows([
    { label: 'Αναθέτουσα αρχή', value: snap.organization, fullWidth: true },
    { label: 'Οργανική μονάδα', value: snap.unitsOperator, fullWidth: true },
    { label: 'Αποφαινόμενο όργανο', value: snap.signer, fullWidth: true }
  ]);

  const dates = mkRows([
    { label: 'Ημ. έκδοσης / πρωτοκόλλου', value: formatKhmdhsDateOnly(snap.signedDate) },
    { label: 'Καταληκτική υποβολής προσφορών', value: formatKhmdhsDateTime(snap.finalSubmissionDate), highlight: true },
    { label: 'Ημ. καταχώρισης ΚΗΜΔΗΣ', value: formatKhmdhsDateTime(snap.submissionDate) },
    ...(snap.cancelled ? [
      { label: 'Κατάσταση', value: 'Ματαιωμένη', highlight: true },
      { label: 'Ημ. ματαίωσης', value: formatKhmdhsDateTime(snap.cancellationDate) },
      { label: 'Λόγος ματαίωσης', value: snap.cancellationReason, fullWidth: true }
    ] : [])
  ]);

  const financial = mkRows([
    { label: 'Εκτιμώμενη αξία (με ΦΠΑ)', value: formatKhmdhsCostSnapshotGross(snap), highlight: true },
    { label: 'Εκτιμώμενη αξία (χωρίς ΦΠΑ)', value: formatKhmdhsEuro(snap.totalCostWithoutVAT) },
    ...(snap.contractDuration != null && snap.contractDuration !== '' ? [{
      label: 'Διάρκεια σύμβασης',
      value: `${snap.contractDuration}${snap.contractDurationUnit ? ` ${snap.contractDurationUnit}` : ''}`
    }] : []),
    ...(snap.offersValidTime != null && snap.offersValidTime !== '' ? [{
      label: 'Ισχύς προσφορών',
      value: `${snap.offersValidTime}${snap.offersValidTimeUnit ? ` ${snap.offersValidTimeUnit}` : ''}`
    }] : [])
  ]);

  const links = mkRows([
    { label: 'Ιστότοπος υποβολής', value: snap.biddingWebsite, fullWidth: true, link: true },
    { label: 'Αρ. ηλεκτρ. δημοσίευσης', value: snap.systemicNumber },
    { label: 'Συνδ. αίτημα (ΑΔΑΜ)', value: snap.approvedRequestAdam },
    { label: 'Συνδ. αναθέσεις (ΑΔΑΜ)', value: Array.isArray(snap.auctionRefNos) && snap.auctionRefNos.length ? snap.auctionRefNos.join(', ') : '' },
    { label: 'CPV', value: Array.isArray(snap.cpvs) && snap.cpvs.length ? snap.cpvs.join(', ') : '', fullWidth: true },
    { label: 'Χρηματοδότηση', value: snap.fundingSummary, fullWidth: true }
  ]);

  return [
    identity.length && { id: 'identity', title: 'Ταυτότητα', icon: '📋', rows: identity },
    procedure.length && { id: 'procedure', title: 'Διαδικασία', icon: '⚖️', rows: procedure },
    authority.length && { id: 'authority', title: 'Αναθέτουσα αρχή', icon: '🏛️', rows: authority },
    dates.length && { id: 'dates', title: 'Ημερομηνίες', icon: '📅', rows: dates },
    financial.length && { id: 'financial', title: 'Οικονομικά', icon: '💰', rows: financial },
    links.length && { id: 'links', title: 'Σύνδεση & λοιπά', icon: '🔗', rows: links }
  ].filter(Boolean);
}

/** Σύνοψη για συμπτυγμένη κάρτα */
export function buildKhmdhsNoticeCardSummary(snapshot) {
  const snap = pickKhmdhsNoticeSnapshot(snapshot);
  if (!snap) return null;
  return {
    adam: snap.referenceNumber || '',
    title: snap.title || '',
    procedure: resolveKhmdhsNoticeAssignmentProcedure(snap) || snap.typeOfProcedure || '',
    deadline: formatKhmdhsDateTime(snap.finalSubmissionDate),
    amount: formatKhmdhsCostSnapshotGross(snap),
    noticeType: snap.noticeType || '',
    cancelled: !!snap.cancelled
  };
}

export function resolveAssignmentProcedureFromNotice(snapshot) {
  const proc = resolveKhmdhsNoticeAssignmentProcedure(snapshot);
  if (!proc) return '';
  return ASSIGNMENT_PROCEDURES.includes(proc) ? proc : '';
}
