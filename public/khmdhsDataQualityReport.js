/**
 * Έλεγχος πληρότητας στοιχείων ΚΗΜΔΗΣ — αναλυτικές αναφορές για τον χρήστη.
 */
const { resolveKhmdhsContractAmount } = require('./khmdhsOpenData');
const {
  grossFromCostSnapshot,
  grossFromContractBudget,
  grossFromContractRecord,
} = require('./khmdhsVatHelper');
const {
  isSupplementaryModificationEntry,
  kindLabelEl,
  USER_CHAIN_KIND_OPTIONS,
} = require('./khmdhsChainKindClassifier');
const {
  ELECTRONIC_VS_PAPER_SHORT,
  khmdhsElectronicGap,
  contractAmountFallbackMessage,
  contractAmountSplitContractsMessage,
} = require('./khmdhsUserCopy');
const {
  reconcileKhmdhsPayments,
} = require('./khmdhsPaymentReconciliation');
const { formatAmountEl } = require('./khmdhsParallelContractAmounts');
const STATUS = {
  COMPLETE: 'complete',
  NEEDS_REVIEW: 'needs_review',
  MISSING: 'missing',
};

const SECTION = {
  CASE: 'case',
  CONTRACT: 'contract',
  MODIFICATION: 'modification',
  PAYMENTS: 'payments',
};

const SECTION_LABELS = {
  [SECTION.CASE]: 'Γενικά στοιχεία υπόθεσης',
  [SECTION.CONTRACT]: 'Αρχική σύμβαση',
  [SECTION.MODIFICATION]: 'Συμπληρωματικές συμβάσεις',
  [SECTION.PAYMENTS]: 'Εντάλματα πληρωμής',
};

const STATUS_LABELS = {
  [STATUS.COMPLETE]: 'Πλήρες',
  [STATUS.NEEDS_REVIEW]: 'Χρειάζεται έλεγχο',
  [STATUS.MISSING]: 'Λείπει',
};

function formatDisplayAmount(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatDisplayDate(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
}

function toIsoDate(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function mapAmountSourceToPlainGreek(source) {
  const s = String(source || '').trim();
  if (/ανάθεση/i.test(s)) return 'από την απόφαση ανάθεσης';
  if (/διαγων/i.test(s) || /δημοσιεύ/i.test(s)) return 'από την προκήρυξη / δημοσίευση';
  if (/σύμβαση/i.test(s)) return 'από τη σύμβαση';
  return 'από συνδεδεμένη πράξη της ίδιας υπόθεσης';
}

function ref(label, value) {
  const v = value != null ? String(value).trim() : '';
  if (!v) return null;
  return { label, value: v };
}

function refs(...entries) {
  return entries.filter(Boolean);
}

function buildItem(base) {
  return {
    searchSteps: [],
    references: [],
    relatedInfo: [],
    formLocation: '',
    section: SECTION.CASE,
    sectionLabel: SECTION_LABELS[SECTION.CASE],
    statusLabel: STATUS_LABELS[base.status] || '',
    ...base,
  };
}

function buildReportContext(ctx) {
  const {
    notice,
    request,
    auction,
    contract,
    contractChainHistory = [],
    chainMeta,
  } = ctx;

  const title = contract?.snapshot?.title
    || notice?.snapshot?.title
    || request?.snapshot?.title
    || '';

  const linked = chainMeta?.linkedAdams || {};
  const referenceIndex = refs(
    request?.adam ? ref('Πρωτογενές αίτημα', request.adam) : null,
    notice?.adam ? ref('Δημοσίευση / προκήρυξη', notice.adam) : null,
    auction?.adam ? ref('Απόφαση ανάθεσης', auction.adam) : null,
    contract?.primaryAdam ? ref('Αρχική σύμβαση', contract.primaryAdam) : null,
    contract?.rootAdam && contract.rootAdam !== contract.primaryAdam
      ? ref('Ρίζα αλυσίδας σύμβασης', contract.rootAdam) : null,
  );

  const modCount = (contractChainHistory || []).filter((h) => isSupplementaryModificationEntry(h)).length;
  const extCount = (contractChainHistory || []).filter((h) => {
    if (!h || h.isRoot) return false;
    const k = h.effectiveKind || h.userKind || h.kind;
    return k === 'extension' || h.suggestedKind === 'extension';
  }).length;
  const reclassifiedCount = (contractChainHistory || []).filter((h) => h?.kindReclassified).length;

  return {
    caseTitle: title,
    chainLength: contractChainHistory.length,
    modificationCount: modCount,
    extensionCount: extCount,
    reclassifiedCount,
    referenceIndex,
    linkedAdams: linked,
    seedAdam: chainMeta?.seedAdam || '',
  };
}

function buildProjectBudgetItem(request, ctx) {
  if (!request?.snapshot) return null;
  const snap = request.snapshot;
  const gross = grossFromCostSnapshot(snap);

  const commonRefs = refs(
    ref('Κωδικός αιτήματος (ΚΗΜΔΗΣ)', request.adam),
    ref('Τίτλος αιτήματος', snap.title),
    ref('Αναθέτουσα αρχή', snap.organization || snap.assigningAuthority),
  );

  if (gross != null) {
    return buildItem({
      fieldId: 'projectBudget',
      label: 'Προϋπολογισμός αιτήματος (με ΦΠΑ)',
      status: STATUS.COMPLETE,
      displayValue: formatDisplayAmount(gross),
      message: 'Το ποσό (με ΦΠΑ 24%) βρέθηκε στην ηλεκτρονική καταχώριση του πρωτογενούς αιτήματος στο ΚΗΜΔΗΣ.',
      manualFieldKey: 'projectBudget',
      contractIndex: null,
      section: SECTION.CASE,
      sectionLabel: SECTION_LABELS[SECTION.CASE],
      references: commonRefs,
      formLocation: 'Εμφανίζεται στα οικονομικά στοιχεία του υποέργου (από ΚΗΜΔΗΣ).',
    });
  }

  return buildItem({
    fieldId: 'projectBudget',
    label: 'Προϋπολογισμός αιτήματος',
    status: STATUS.MISSING,
    displayValue: '',
    message: `${khmdhsElectronicGap('το ποσό προϋπολογισμού')} Ελέγξτε το έγγραφο έγκρισης δαπάνης ή το αίτημα στον φάκελό σας — συχνά το ποσό υπάρχει εκεί.`,
    manualFieldKey: 'projectBudget',
    contractIndex: null,
    section: SECTION.CASE,
    sectionLabel: SECTION_LABELS[SECTION.CASE],
    references: commonRefs,
    relatedInfo: refs(
      grossFromCostSnapshot(ctx.notice?.snapshot) != null
        ? ref('Εκτίμηση δημοσίευσης (με ΦΠΑ)', formatDisplayAmount(grossFromCostSnapshot(ctx.notice.snapshot)))
        : null,
    ),
    searchSteps: [
      'Ανοίξτε το πρωτογενές αίτημα στο ΚΗΜΔΗΣ με τον κωδικό που αναφέρεται παρακάτω.',
      'Ελέγξτε το εγκεκριμένο αίτημα / απόφαση έγκρισης δαπάνης στον φάκελο του έργου.',
      'Αναζητήστε το πεδίο «Εκτιμώμενη αξία» ή «Προϋπολογισμός» στο έγγραφο.',
      'Συμπληρώστε το ποσό χειροκίνητα στην ενότητα αποτελεσμάτων ΚΗΜΔΗΣ (προϋπολογισμός αιτήματος).',
    ],
    formLocation: 'Μετά την ανάκτηση ΑΔΑΜ → πεδίο «Προϋπολογισμός αιτήματος» (εμφανίζεται όταν λείπει από ΚΗΜΔΗΣ).',
  });
}

function buildAssignmentProcedureItem(notice, mappedProcedure) {
  if (!notice?.snapshot) return null;
  const snap = notice.snapshot;
  const commonRefs = refs(
    ref('Κωδικός δημοσίευσης (ΚΗΜΔΗΣ)', notice.adam),
    ref('Τίτλος δημοσίευσης', snap.title),
    ref('Τύπος δημοσίευσης', snap.noticeType),
    ref('Είδος διαδικασίας (ΚΗΜΔΗΣ)', snap.typeOfProcedure),
    ref('Νομικό πλαίσιο', snap.legalContext),
  );

  if (mappedProcedure) {
    return buildItem({
      fieldId: 'assignmentProcedure',
      label: 'Διαδικασία ανάθεσης',
      status: STATUS.COMPLETE,
      displayValue: mappedProcedure,
      message: 'Η διαδικασία ανάθεσης αντιστοιχίστηκε από τα στοιχεία της δημοσίευσης.',
      manualFieldKey: 'assignmentProcedure',
      contractIndex: null,
      section: SECTION.CASE,
      sectionLabel: SECTION_LABELS[SECTION.CASE],
      references: commonRefs,
      formLocation: 'Εμφανίζεται αυτόματα — δεν χρειάζεται χειροκίνητη επιλογή.',
    });
  }

  const noticeType = snap.noticeType ? String(snap.noticeType).trim() : '';
  return buildItem({
    fieldId: 'assignmentProcedure',
    label: 'Διαδικασία ανάθεσης',
    status: STATUS.MISSING,
    displayValue: '',
    message: noticeType
      ? `Βρέθηκε τύπος δημοσίευσης «${noticeType}», αλλά δεν μπόρεσε να αντιστοιχιστεί αυτόματα σε διαδικασία της εφαρμογής.`
      : `${khmdhsElectronicGap('επαρκή στοιχεία για τον τύπο διαδικασίας')} Ελέγξτε την προκήρυξη ή τη διακήρυξη στον φάκελό σας.`,
    manualFieldKey: 'assignmentProcedure',
    contractIndex: null,
    section: SECTION.CASE,
    sectionLabel: SECTION_LABELS[SECTION.CASE],
    references: commonRefs,
    searchSteps: [
      'Ανοίξτε τη προκήρυξη / διακήρυξη στο ΚΗΜΔΗΣ (κωδικός παρακάτω).',
      'Δείτε την «Είδος διαδικασίας» ή τον τύπο δημοσίευσης στο έγγραφο.',
      'Συγκρίνετε με τη φυσική πρόσκληση / διακήρυξη στον φάκελο του έργου.',
      'Επιλέξτε τη σωστή διαδικασία από τη λίστα στη φόρμα (ενότητα ΚΗΜΔΗΣ).',
    ],
    formLocation: 'Ενότητα ΚΗΜΔΗΣ → «Διαδικασία Ανάθεσης» (εμφανίζεται όταν λείπει).',
  });
}

function buildProcessStartItem(notice, noticeProcessStart) {
  if (!notice?.snapshot) return null;
  const snap = notice.snapshot;
  const commonRefs = refs(
    ref('Κωδικός δημοσίευσης (ΚΗΜΔΗΣ)', notice.adam),
    ref('Τίτλος', snap.title),
    ref('Ημ. έκδοσης / πρωτοκόλλου', formatDisplayDate(snap.signedDate)),
    ref('Ημ. καταληκτικής υποβολής', formatDisplayDate(snap.finalSubmissionDate)),
  );

  if (noticeProcessStart) {
    return buildItem({
      fieldId: 'contractProcessStartDate',
      label: 'Ημερομηνία έναρξης διαδικασίας σύμβασης',
      status: STATUS.COMPLETE,
      displayValue: formatDisplayDate(noticeProcessStart),
      message: 'Η ημερομηνία προκύπτει από στοιχεία της δημοσίευσης στο ΚΗΜΔΗΣ.',
      manualFieldKey: 'contractProcessStartDate',
      contractIndex: null,
      section: SECTION.CASE,
      sectionLabel: SECTION_LABELS[SECTION.CASE],
      references: commonRefs,
      formLocation: 'Συμπληρώνεται αυτόματα από ΚΗΜΔΗΣ.',
    });
  }

  return buildItem({
    fieldId: 'contractProcessStartDate',
    label: 'Ημερομηνία έναρξης διαδικασίας σύμβασης',
    status: STATUS.MISSING,
    displayValue: '',
    message: `${khmdhsElectronicGap('η ημερομηνία έναρξης της διαδικασίας σύμβασης')} Συνήθως υπάρχει στην προκήρυξη ή τη διακήρυξη στον φάκελό σας.`,
    manualFieldKey: 'contractProcessStartDate',
    contractIndex: null,
    section: SECTION.CASE,
    sectionLabel: SECTION_LABELS[SECTION.CASE],
    references: commonRefs,
    searchSteps: [
      'Ελέγξτε την ημερομηνία έκδοσης / δημοσίευσης της προκήρυξης.',
      'Εναλλακτικά, την ημερομηνία έναρξης υποβολής προσφορών ή υπογραφής πρωτοκόλλου.',
      'Συχνά η «έναρξη διαδικασίας» είναι η πρώτη δημόσια ενέργεια (π.χ. Διακήρυξη).',
      'Συμπληρώστε την ημερομηνία στη φόρμα — πρέπει να είναι προγενέστερη της υπογραφής σύμβασης.',
    ],
    formLocation: 'Ενότητα ΚΗΜΔΗΣ → «Ημερ. Έναρξης Διαδικασίας Σύμβασης».',
  });
}

function buildContractDateItem(record, contractCtx) {
  if (!record) return null;
  const iso = toIsoDate(record.contractSignedDate || record.startDate);
  const commonRefs = refs(
    ref('Κωδικός σύμβασης (ΚΗΜΔΗΣ)', contractCtx?.adam),
    ref('Τίτλος σύμβασης', record.title),
    ref('Ανάδοχος', record.anadoxosName),
    ref('Ημ. έναρξης ισχύος', formatDisplayDate(record.startDate)),
  );

  if (iso) {
    return buildItem({
      fieldId: 'contractDate',
      label: 'Ημερομηνία υπογραφής σύμβασης',
      status: STATUS.COMPLETE,
      displayValue: formatDisplayDate(iso),
      message: 'Η ημερομηνία υπογραφής βρέθηκε στη σύμβαση του ΚΗΜΔΗΣ.',
      manualFieldKey: 'contractDate',
      contractIndex: null,
      section: SECTION.CONTRACT,
      sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
      references: commonRefs,
      formLocation: 'Συμπληρώνεται αυτόματα — εμφανίζεται στα αποτελέσματα ΚΗΜΔΗΣ.',
    });
  }

  return buildItem({
    fieldId: 'contractDate',
    label: 'Ημερομηνία υπογραφής σύμβασης',
    status: STATUS.MISSING,
    displayValue: '',
    message: `${khmdhsElectronicGap('η ημερομηνία υπογραφής')} Συνήθως αναγράφεται στην υπογεγραμμένη σύμβαση (PDF) στον φάκελό σας.`,
    manualFieldKey: 'contractDate',
    contractIndex: null,
    section: SECTION.CONTRACT,
    sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
    references: commonRefs,
    searchSteps: [
      'Ανοίξτε την υπογεγραμμένη σύμβαση (φυσικό αρχείο PDF).',
      'Αναζητήστε την ημερομηνία υπογραφής στην πρώτη ή τελευταία σελίδα.',
      'Εναλλακτικά, ελέγξτε την καταχώριση σύμβασης στο ΚΗΜΔΗΣ με τον κωδικό παρακάτω.',
      'Συμπληρώστε την ημερομηνία στην ενότητα «Στοιχεία Σύμβασης».',
    ],
    formLocation: 'Ενότητα «Στοιχεία Σύμβασης» → «Ημερομηνία Υπογραφής».',
  });
}

function resolveLinkedContractCount(amountContext, ctx) {
  if (amountContext?.parallelCase && Number(amountContext?.linkedContractCount) > 0) {
    return Number(amountContext.linkedContractCount);
  }
  const fromCtx = Number(amountContext?.linkedContractCount);
  if (fromCtx > 0) return fromCtx;
  const fromMeta = Number(ctx?.chainMeta?.stageCounts?.contracts);
  if (fromMeta > 0) return fromMeta;
  const list = ctx?.chainMeta?.linkedAdams?.contracts;
  return Array.isArray(list) ? list.length : 0;
}

function buildContractAmountItem(record, amountContext, ctx) {
  if (!record) return null;
  const budget = record.contractBudget;
  const contractAdam = ctx.contract?.primaryAdam || ctx.contract?.adam || record.referenceNumber;
  const linkedContractCount = resolveLinkedContractCount(amountContext, ctx);

  const commonRefs = refs(
    ref('Κωδικός σύμβασης (ΚΗΜΔΗΣ)', contractAdam),
    ref('Τίτλος σύμβασης', record.title),
    ref('Ανάδοχος', record.anadoxosName),
    ctx.auction?.adam ? ref('Κωδικός ανάθεσης (ΚΗΜΔΗΣ)', ctx.auction.adam) : null,
  );

  const awardGross = grossFromCostSnapshot(ctx.auction?.snapshot);
  const procGross = grossFromCostSnapshot(ctx.notice?.snapshot);
  const related = refs(
    awardGross != null ? ref('Ποσό ανάθεσης (με ΦΠΑ, συνολικά)', formatDisplayAmount(awardGross)) : null,
    linkedContractCount > 1
      ? ref('Συνδεδεμένες συμβάσεις στο ΚΗΜΔΗΣ', String(linkedContractCount))
      : null,
    procGross != null ? ref('Εκτίμηση δημοσίευσης (με ΦΠΑ)', formatDisplayAmount(procGross)) : null,
    record.contractSignedDate ? ref('Ημ. υπογραφής σύμβασης', formatDisplayDate(record.contractSignedDate)) : null,
  );

  if (budget != null && budget !== '' && Number.isFinite(Number(budget))) {
    // Για παράλληλες συμβάσεις: αν το ποσό ξεπερνά το σύνολο ανάθεσης,
    // είναι προφανώς λάθος καταχώριση — δεν το εμφανίζουμε ως COMPLETE.
    const awardNetForCheck = Number(ctx.auction?.snapshot?.totalCostWithoutVAT);
    const isParallel = !!(amountContext?.parallelCase || linkedContractCount > 1);
    const budgetExceedsAward =
      isParallel &&
      Number.isFinite(awardNetForCheck) &&
      awardNetForCheck > 0 &&
      Number(budget) > awardNetForCheck * 1.005;

    if (!budgetExceedsAward) {
      const grossBudget = grossFromContractBudget(budget);
      return buildItem({
        fieldId: 'contractAmount',
        label: 'Ποσό σύμβασης (με ΦΠΑ)',
        status: STATUS.COMPLETE,
        displayValue: formatDisplayAmount(grossBudget),
        message: 'Το ποσό (με ΦΠΑ 24%) βρέθηκε καταχωρισμένο στη σύμβαση του ΚΗΜΔΗΣ.',
        manualFieldKey: 'contractAmount',
        contractIndex: null,
        section: SECTION.CONTRACT,
        sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
        references: commonRefs,
        relatedInfo: related,
        formLocation: 'Συμπληρώνεται αυτόματα.',
      });
    }
    // Αλλιώς συνεχίζουμε — το ποσό είναι άκυρο, θα το χειριστούμε ως ελλείπον
  }

  const resolved = resolveKhmdhsContractAmount(record, {
    ...(amountContext || {}),
    linkedContractCount,
  });

  if (resolved.multipleContracts) {
    const suspiciousMsg = resolved.suspiciousBudget
      ? `Σημαντικό: Το ΚΗΜΔΗΣ έχει καταχωρισμένο ποσό για αυτή τη σύμβαση που υπερβαίνει το σύνολο ανάθεσης — αδύνατο για μία παράλληλη σύμβαση. Πιθανό λάθος καταχώρισης στο ΚΗΜΔΗΣ. Ελέγξτε και συμπληρώστε το σωστό ποσό από το PDF του συμφωνητικού.`
      : contractAmountSplitContractsMessage(linkedContractCount, awardGross != null ? formatDisplayAmount(awardGross) : '');
    return buildItem({
      fieldId: 'contractAmount',
      label: 'Ποσό σύμβασης (με ΦΠΑ)',
      status: STATUS.MISSING,
      displayValue: '',
      message: suspiciousMsg,
      manualFieldKey: 'contractAmount',
      contractIndex: null,
      section: SECTION.CONTRACT,
      sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
      references: commonRefs,
      relatedInfo: related,
      searchSteps: [
        resolved.suspiciousBudget
          ? 'Το ποσό στο ΚΗΜΔΗΣ είναι εσφαλμένο (ξεπερνά το σύνολο της ανάθεσης). Ανοίξτε το PDF του συμφωνητικού.'
          : 'Ανοίξτε το PDF της συγκεκριμένης σύμβασης — το ποσό αναγράφεται στο «Τελικό ποσό» ή «Συνολική αξία».',
        'Μην χρησιμοποιήσετε το συνολικό ποσό της ανάθεσης — σε πολλές συμβάσεις κάθε έγγραφο έχει δικό του ποσό.',
        'Συγκρίνετε με τον κωδικό σύμβασης (SYMV) που αντιστοιχεί σε αυτή τη γραμμή.',
        'Συμπληρώστε το πεδίο «Ποσό Σύμβασης» με το ποσό του PDF.',
      ],
      formLocation: 'Ενότητα «Στοιχεία Σύμβασης» → «Ποσό Σύμβασης».',
    });
  }

  if (resolved.amount != null) {
    return buildItem({
      fieldId: 'contractAmount',
      label: 'Ποσό σύμβασης (με ΦΠΑ)',
      status: STATUS.NEEDS_REVIEW,
      displayValue: formatDisplayAmount(resolved.amount),
      message: contractAmountFallbackMessage(mapAmountSourceToPlainGreek(resolved.source)),
      manualFieldKey: 'contractAmount',
      contractIndex: null,
      section: SECTION.CONTRACT,
      sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
      references: commonRefs,
      relatedInfo: related,
      searchSteps: [
        'Ανοίξτε την υπογεγραμμένη σύμβαση (PDF) στον φάκελό σας — εκεί είναι το επίσημο ποσό.',
        'Συγκρίνετε με την ηλεκτρονική καταχώριση στο ΚΗΜΔΗΣ (κωδικός παρακάτω) — συχνά λείπει το πεδίο ποσού.',
        'Ελέγξτε και την απόφαση κατακύρωσης / ανάθεσης αν διαφέρουν.',
        'Μετά τον έλεγχο, επιβεβαιώστε ή διορθώστε το πεδίο «Ποσό Σύμβασης».',
      ],
      formLocation: 'Ενότητα «Στοιχεία Σύμβασης» → «Ποσό Σύμβασης» (εμφανίζεται για έλεγχο).',
    });
  }

  return buildItem({
    fieldId: 'contractAmount',
    label: 'Ποσό σύμβασης',
    status: STATUS.MISSING,
    displayValue: '',
    message: `${khmdhsElectronicGap('ποσό')} Αναζητήστε το στην υπογεγραμμένη σύμβαση ή στην απόφαση ανάθεσης στον φάκελό σας και συμπληρώστε το χειροκίνητα.`,
    manualFieldKey: 'contractAmount',
    contractIndex: null,
    section: SECTION.CONTRACT,
    sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
    references: commonRefs,
    relatedInfo: related,
    searchSteps: [
      'Ανοίξτε την υπογεγραμμένη σύμβαση — αναζητήστε «Συνολική αξία», «Αξία σύμβασης» ή «Ποσό χωρίς ΦΠΑ».',
      'Ελέγξτε την απόφαση ανάθεσης (κωδικός παρακάτω αν υπάρχει).',
      'Στο ΚΗΜΔΗΣ, η καταχώριση σύμβασης μπορεί να μην έχει ποσό — συχνό σε παλιές υποθέσεις.',
      'Συμπληρώστε το ποσό χειροκίνητα στην ενότητα «Στοιχεία Σύμβασης».',
    ],
    formLocation: 'Ενότητα «Στοιχεία Σύμβασης» → «Ποσό Σύμβασης».',
  });
}

function buildSupplementaryItemsFromChainHistory(chainHistory, ctx) {
  const modifications = (chainHistory || []).filter((h) => isSupplementaryModificationEntry(h));
  const items = [];

  modifications.forEach((h, supplementaryIndex) => {
    const dateDisplay = h.contractDate ? formatDisplayDate(h.contractDate) : '';
    const snap = h.snapshot || {};
    const chainAdam = h.adam || null;
    const modRefs = refs(
      ref('Κωδικός συμπληρωματικής (ΚΗΜΔΗΣ)', h.adam),
      ref('Είδος πράξης', h.label || 'Συμπληρωματική σύμβαση'),
      ref('Τίτλος', snap.title),
      ref('Ανάδοχος', snap.anadoxosName),
      h.prevAdam ? ref('Προηγούμενη πράξη αλυσίδας', h.prevAdam) : null,
    );
    const modRelated = refs(
      h.endDate ? ref('Ημ. λήξης (ΚΗΜΔΗΣ)', formatDisplayDate(h.endDate)) : null,
      grossFromCostSnapshot(ctx.auction?.snapshot) != null
        ? ref('Ποσό αρχικής ανάθεσης (με ΦΠΑ)', formatDisplayAmount(grossFromCostSnapshot(ctx.auction.snapshot)))
        : null,
    );
    const scopeHint = [h.label || 'Συμπληρωματική σύμβαση', dateDisplay].filter(Boolean).join(' · ');
    const refHint = scopeHint ? ` (${scopeHint})` : '';
    const formLocBase = `Ενότητα «Συμπληρωματικές συμβάσεις» → γραμμή ${supplementaryIndex + 1}`;

    if (h.contractDate) {
      items.push(buildItem({
        fieldId: 'supplementaryDate',
        label: 'Ημερομηνία συμπληρωματικής',
        status: STATUS.COMPLETE,
        displayValue: dateDisplay,
        message: `Η ημερομηνία βρέθηκε για τη συμπληρωματική σύμβαση${refHint}.`,
        manualFieldKey: 'supplementaryDate',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        section: SECTION.MODIFICATION,
        sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
        references: modRefs,
        formLocation: `${formLocBase} → Ημερομηνία.`,
      }));
    } else {
      items.push(buildItem({
        fieldId: 'supplementaryDate',
        label: `Ημερομηνία συμπληρωματικής${refHint}`,
        status: STATUS.MISSING,
        displayValue: '',
        message: `${khmdhsElectronicGap('η ημερομηνία')} Ελέγξτε το έγγραφο συμπληρωματικής στον φάκελό σας.`,
        manualFieldKey: 'supplementaryDate',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        section: SECTION.MODIFICATION,
        sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
        references: modRefs,
        searchSteps: [
          'Ανοίξτε το PDF της συμπληρωματικής σύμβασης.',
          'Αναζητήστε την ημερομηνία υπογραφής στην πρώτη σελίδα.',
          `Στο ΚΗΜΔΗΣ, αναζητήστε την πράξη με κωδικό ${h.adam || '—'}.`,
          `Συμπληρώστε στην ${formLocBase}.`,
        ],
        formLocation: `${formLocBase} → Ημερομηνία.`,
      }));
    }

    const budget = snap.contractBudget;
    const resolved = snap.resolvedContractAmount;
    const formattedAmount = h.contractAmount ? String(h.contractAmount).trim() : '';
    const vatRate = ctx.amountContext?.contextualVatRate ?? null;

    if (formattedAmount) {
      items.push(buildItem({
        fieldId: 'supplementaryAmount',
        label: `Ποσό συμπληρωματικής (με ΦΠΑ)${refHint}`,
        status: budget != null && budget !== '' ? STATUS.COMPLETE : STATUS.NEEDS_REVIEW,
        displayValue: `${formattedAmount} €`.replace(' € €', ' €'),
        message: budget != null && budget !== ''
          ? (vatRate != null && Math.abs(vatRate - 0.24) >= 0.005
            ? `Το ποσό προκύπτει από την αλυσίδα με ΦΠΑ ${(vatRate * 100).toLocaleString('el-GR', { maximumFractionDigits: 1 })}%.`
            : 'Το ποσό (με ΦΠΑ) βρέθηκε στη συμπληρωματική σύμβαση του ΚΗΜΔΗΣ.')
          : 'Υπάρχει προτεινόμενο ποσό από την αλυσίδα — συγκρίνετε με το έγγραφο συμπληρωματικής.',
        manualFieldKey: 'supplementaryAmount',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        section: SECTION.MODIFICATION,
        sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
        references: modRefs,
        relatedInfo: modRelated,
        formLocation: `${formLocBase} → Ποσό.`,
      }));
    } else if (budget != null && budget !== '' && Number.isFinite(Number(budget))) {
      const grossBudget = grossFromContractBudget(budget, vatRate ?? undefined);
      items.push(buildItem({
        fieldId: 'supplementaryAmount',
        label: `Ποσό συμπληρωματικής (με ΦΠΑ)${refHint}`,
        status: STATUS.COMPLETE,
        displayValue: formatDisplayAmount(grossBudget),
        message: vatRate != null && Math.abs(vatRate - 0.24) >= 0.005
          ? `Το ποσό (με ΦΠΑ ${(vatRate * 100).toLocaleString('el-GR', { maximumFractionDigits: 1 })}%) βρέθηκε στη συμπληρωματική σύμβαση.`
          : 'Το ποσό (με ΦΠΑ 24%) βρέθηκε στη συμπληρωματική σύμβαση του ΚΗΜΔΗΣ.',
        manualFieldKey: 'supplementaryAmount',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        section: SECTION.MODIFICATION,
        sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
        references: modRefs,
        relatedInfo: modRelated,
        formLocation: `${formLocBase} → Ποσό.`,
      }));
    } else if (resolved != null && resolved !== '' && Number.isFinite(Number(resolved))) {
      items.push(buildItem({
        fieldId: 'supplementaryAmount',
        label: `Ποσό συμπληρωματικής${refHint}`,
        status: STATUS.NEEDS_REVIEW,
        displayValue: formatDisplayAmount(resolved),
        message: `${contractAmountFallbackMessage(mapAmountSourceToPlainGreek(h.contractAmountSource || snap.contractAmountSource))} ${ELECTRONIC_VS_PAPER_SHORT}`,
        manualFieldKey: 'supplementaryAmount',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        references: modRefs,
        relatedInfo: modRelated,
        searchSteps: [
          'Ανοίξτε το PDF της συμπληρωματικής σύμβασης.',
          'Συχνά αναφέρεται ως «Αύξηση», «Μείωση» ή «Νέα συνολική αξία».',
          'Συγκρίνετε με την καταχώριση στο ΚΗΜΔΗΣ.',
          `Διορθώστε αν χρειάζεται στο ${formLocBase}.`,
        ],
        formLocation: `${formLocBase} → Ποσό.`,
      }));
    } else {
      items.push(buildItem({
        fieldId: 'supplementaryAmount',
        label: `Ποσό συμπληρωματικής${refHint}`,
        status: STATUS.MISSING,
        displayValue: '',
        message: `${khmdhsElectronicGap('ποσό')} Συχνό σε παλιές ηλεκτρονικές καταχωρίσεις — το ποσό υπάρχει συνήθως στο PDF της συμπληρωματικής.`,
        manualFieldKey: 'supplementaryAmount',
        supplementaryIndex,
        chainAdam,
        scopeHint,
        section: SECTION.MODIFICATION,
        sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
        references: modRefs,
        relatedInfo: modRelated,
        searchSteps: [
          'Ανοίξτε το PDF της συμπληρωματικής σύμβασης.',
          'Αναζητήστε: ποσό συμπληρωματικής, αύξηση/μείωση αξίας, νέο συνολικό ποσό.',
          'Ελέγξτε σχετική απόφαση Δημοτικού/Αποφασιστικού οργάνου αν υπάρχει.',
          `Στο ΚΗΜΔΗΣ αναζητήστε την πράξη με κωδικό ${h.adam || '—'} — το πεδίο ποσού μπορεί να είναι κενό.`,
          `Συμπληρώστε το ποσό στο ${formLocBase}.`,
        ],
        formLocation: `${formLocBase} → Ποσό (το πεδίο είναι επεξεργάσιμο όταν λείπει η τιμή).`,
      }));
    }
  });

  return items;
}

/** Επιλογές χαρακτηρισμού (5 για τον χρήστη) με ετικέτα */
function buildChainKindOptions() {
  return USER_CHAIN_KIND_OPTIONS.map((k) => ({
    value: k,
    label: kindLabelEl(k).replace(/^./, (c) => c.toUpperCase()),
  }));
}

/** Λίστα άλλων πράξεων της αλυσίδας — για «ποιο έγγραφο διορθώνει» */
function buildChainPeerOptions(chainHistory, currentAdam) {
  return (chainHistory || [])
    .filter((p) => p?.adam && p.adam !== currentAdam)
    .map((p) => {
      const date = p.contractDate ? formatDisplayDate(p.contractDate) : '';
      const baseLabel = p.isRoot ? 'Αρχική σύμβαση' : (p.label || 'πράξη');
      return {
        value: p.adam,
        label: [baseLabel, p.adam, date].filter(Boolean).join(' · '),
        isRoot: !!p.isRoot,
      };
    });
}

const CONFIDENCE_PHRASE = {
  high: 'Η εφαρμογή είναι αρκετά σίγουρη για αυτή την πρόταση — επιβεβαιώστε ή αλλάξτε την.',
  low: 'Η εφαρμογή προτείνει με επιφύλαξη — ελέγξτε και επιβεβαιώστε ή αλλάξτε την.',
  none: 'Η εφαρμογή δεν είναι σίγουρη. Επιλέξτε εσείς τον σωστό χαρακτηρισμό από τα έγγραφα.',
};

/**
 * Επεξεργάσιμος χαρακτηρισμός για ΚΑΘΕ μη-αρχική πράξη της αλυσίδας.
 * Ο χρήστης επιβεβαιώνει/αλλάζει· η εφαρμογή προτείνει μόνο, δεν αποφασίζει.
 */
function buildChainClassificationReviewItems(chainHistory) {
  const items = [];
  (chainHistory || []).forEach((h) => {
    if (!h?.adam || h.isRoot) return;

    const snap = h.snapshot || {};
    const khmdhsLabel = h.khmdhsLinkKind ? kindLabelEl(h.khmdhsLinkKind) : 'δεν προσδιορίζεται';
    const suggested = h.suggestedKind || null;
    const confidence = h.confidence || 'none';
    const suggestedLabel = suggested ? kindLabelEl(suggested) : 'χρειάζεται έλεγχος';
    const refHint = ` (${h.adam})`;

    // Κάθε μη-αρχική πράξη απαιτεί ρητή επιλογή τύπου από τον χρήστη — η πρόταση δεν αρκεί.
    const status = STATUS.NEEDS_REVIEW;

    items.push(buildItem({
      fieldId: 'chainKindReview',
      isChainKind: true,
      chainAdam: h.adam,
      label: `Τι είδους είναι αυτό το έγγραφο;${refHint}`,
      status,
      displayValue: suggested ? suggestedLabel.replace(/^./, (c) => c.toUpperCase()) : '',
      message: h.kindConflict
        ? (h.kindNote || `Ασυμφωνία: ΚΗΜΔΗΣ «${khmdhsLabel}», ενδείξεις διαφορετικές. ${CONFIDENCE_PHRASE.none}`)
        : (h.kindNote
          ? h.kindNote
          : (suggested
            ? `Πρόταση εφαρμογής: «${suggestedLabel}» — επιλέξτε εσείς τον σωστό τύπο και συμπληρώστε τα αντίστοιχα πεδία. ${CONFIDENCE_PHRASE[confidence] || ''}`
            : `Η εφαρμογή δεν είναι σίγουρη. ${CONFIDENCE_PHRASE.none}`)),
      manualFieldKey: null,
      // Δεδομένα για τον editor χαρακτηρισμού
      suggestedKind: suggested,
      confidence,
      khmdhsLinkKind: h.khmdhsLinkKind || null,
      kindOptions: buildChainKindOptions(),
      peerOptions: buildChainPeerOptions(chainHistory, h.adam),
      defaultCorrectsAdam: h.prevAdam || null,
      hasAmount: !!(h.contractAmount && String(h.contractAmount).trim()),
      hasKhmdhsDate: !!(h.contractDate && String(h.contractDate).trim()),
      contractAmountDisplay: h.contractAmount || '',
      endDateIso: toIsoDate(h.endDate),
      section: SECTION.MODIFICATION,
      sectionLabel: SECTION_LABELS[SECTION.MODIFICATION],
      references: refs(
        ref('Κωδικός πράξης (ΚΗΜΔΗΣ)', h.adam),
        ref('Πώς τη συνδέει το ΚΗΜΔΗΣ', khmdhsLabel),
        ref('Πρόταση εφαρμογής', suggestedLabel),
        ref('Τίτλος', snap.title || h.title),
        h.prevAdam ? ref('Προηγούμενη πράξη', h.prevAdam) : null,
      ),
      relatedInfo: refs(
        h.contractDate ? ref('Ημ. υπογραφής/έναρξης', formatDisplayDate(h.contractDate)) : null,
        h.endDate ? ref('Ημ. λήξης', formatDisplayDate(h.endDate)) : null,
        h.contractAmount ? ref('Ποσό (με ΦΠΑ)', `${String(h.contractAmount).trim()} €`.replace(' € €', ' €')) : null,
        ...(Array.isArray(h.kindSignals) ? h.kindSignals.map((s) => ref('Ένδειξη', s)) : []),
      ),
      searchSteps: [
        'Ανοίξτε την πράξη στο ΚΗΜΔΗΣ ή το PDF στον φάκελό σας.',
        'Επιλέξτε τι είδους έγγραφο είναι — παράταση, συμπληρωματική σύμβαση, ορθή επανάληψη ή άλλο.',
        'Συμπληρώστε μόνο τα πεδία που εμφανίζονται για τον τύπο που διαλέξατε.',
      ],
      formLocation: 'Αναφορά ελέγχου → κάρτα «Τι είδους είναι αυτό το έγγραφο;».',
    }));
  });
  return items;
}

function resolveContractAmountGrossForPayments(ctx) {
  if (ctx.formContractAmountGross != null && Number.isFinite(Number(ctx.formContractAmountGross))) {
    const formAmt = Number(ctx.formContractAmountGross);
    if (formAmt > 0) return formAmt;
  }

  const vatRate = ctx.amountContext?.contextualVatRate ?? undefined;
  let contractPart = null;
  const record = ctx.primaryRecord;
  if (record?.contractBudget != null && record.contractBudget !== '' && Number.isFinite(Number(record.contractBudget))) {
    contractPart = grossFromContractBudget(record.contractBudget, vatRate);
  }
  if (contractPart == null) {
    const resolved = resolveKhmdhsContractAmount(record, {
      ...(ctx.amountContext || {}),
      linkedContractCount: resolveLinkedContractCount(ctx.amountContext, ctx),
    });
    if (resolved?.amount != null && Number.isFinite(resolved.amount)) contractPart = resolved.amount;
  }
  if (contractPart == null) {
    const awardGross = grossFromCostSnapshot(ctx.auction?.snapshot);
    if (awardGross != null) contractPart = awardGross;
  }

  let modPart = 0;
  (ctx.contractChainHistory || []).forEach((h) => {
    if (!isSupplementaryModificationEntry(h) || h.isRoot) return;
    if (h.contractAmount) {
      const cleaned = String(h.contractAmount).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      if (Number.isFinite(n) && n > 0) modPart += n;
    }
  });

  let apePart = 0;
  if (ctx.apeAmount != null && ctx.apeAmount !== '') {
    const apeStr = String(ctx.apeAmount).trim();
    const cleaned = apeStr.replace(/[^\d.,]/g, '');
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const ape = parseFloat(normalized);
    if (Number.isFinite(ape) && ape > 0) apePart = ape;
  }

  const tolerance = 0.5;
  if (apePart > tolerance) {
    return apePart + modPart;
  }

  if (contractPart != null && contractPart > 0) {
    return contractPart + modPart;
  }
  if (modPart > tolerance) return modPart;
  return null;
}

function buildPaymentsReconciliationItem(payments, ctx) {
  const list = Array.isArray(payments) ? payments.filter((p) => p?.adam || p?.snapshot) : [];
  if (list.length === 0) return null;

  const contractingOrg = ctx.auction?.snapshot?.organization
    || ctx.contract?.snapshot?.organization
    || ctx.primaryRecord?.organization
    || '';
  const contractAmountGross = resolveContractAmountGrossForPayments(ctx);
  const recon = reconcileKhmdhsPayments(list, { contractAmountGross, contractingOrg });

  const hasPayableRef = contractAmountGross != null && contractAmountGross > 0;
  const refAmountLabel = hasPayableRef
    ? 'Τελικό πληρωτέο ποσό (με ΦΠΑ)'
    : 'Συμβατικό ποσό (με ΦΠΑ)';
  const contractAdam = ctx.contract?.primaryAdam || ctx.contract?.adam || ctx.primaryRecord?.referenceNumber;
  const commonRefs = refs(
    ref('Κωδικός σύμβασης (ΚΗΜΔΗΣ)', contractAdam),
    contractAmountGross != null ? ref(refAmountLabel, formatDisplayAmount(contractAmountGross)) : null,
    contractingOrg ? ref('Αναθέτουσα αρχή (ανάθεση)', contractingOrg) : null,
  );

  const skippedUnrelated = Array.isArray(ctx.skippedUnrelatedPayments) ? ctx.skippedUnrelatedPayments : [];
  const paymentRefs = recon.entries.map((e, idx) => {
    const amt = e.gross != null ? formatDisplayAmount(e.gross) : '—';
    const statusNote = !e.active ? (e.cancelled ? ' (ακυρωμένο)' : e.credit ? ' (πιστωτικό)' : '') : '';
    return ref(
      `Ένταλμα ${idx + 1} — ${e.payer.label}`,
      `${e.adam || '—'} · ${amt}${statusNote}${e.org ? ` · ${e.org}` : ''}`,
    );
  });
  const skippedUnrelatedRefs = skippedUnrelated.map((e) =>
    ref('⚠️ Εξαιρέθηκε (άσχετη σύμβαση)', `${e.adam} — αναφέρει: ${e.unrelatedContractRef || '?'}`)
  );

  const payableHint = ' Αν το τελικό πληρωτέο ποσό δεν είναι σωστό, ελέγξτε ποσό σύμβασης, συμπληρωματικές και ΑΠΕ στη φόρμα του υποέργου.';
  const refAmountDesc = hasPayableRef
    ? `το τελικό πληρωτέο ποσό (${formatDisplayAmount(contractAmountGross)})`
    : `το συμβατικό ποσό (${formatDisplayAmount(contractAmountGross)})`;

  let message;
  let status = STATUS.COMPLETE;
  let displayValue = formatDisplayAmount(recon.estimatedContractorPaymentGross);

  if (recon.coFinancingPattern) {
    message = `Βρέθηκαν ${recon.activeCount} εντάλματα με ακατέργαστο άθροισμα ${formatDisplayAmount(recon.rawTotalGross)} — υπερβαίνει ${refAmountDesc}. `
      + 'Εντοπίστηκε τυπικό μοτίβο συγχρηματοδότησης: ένταλμα από Περιφερειακό Ταμείο/ΠΕΠΑΚ και ένταλμα από Δήμο/αναθέτουσα αρχή για το ίδιο ποσό. '
      + 'Συνήθως το Ταμείο αποζημιώνει τον Δήμο — η εκτιμώμενη πληρωμή προς εργολάβο είναι μία φορά το ποσό της σύμβασης, όχι το άθροισμα των δύο ενταλμάτων.';
    if (recon.estimatedExceedsContract) {
      status = STATUS.NEEDS_REVIEW;
      message += ` Ωστόσο, ακόμη και μετά τον έλεγχο, το εκτιμώμενο ποσό υπερβαίνει ${refAmountDesc} — απαιτείται χειροκίνητος έλεγχος.${payableHint}`;
    }
  } else if (recon.needsReview) {
    status = STATUS.NEEDS_REVIEW;
    message = `Το άθροισμα των ενταλμάτων (${formatDisplayAmount(recon.rawTotalGross)}) υπερβαίνει ${refAmountDesc}. `
      + `Δεν εντοπίστηκε μοτίβο συγχρηματοδότησης (Δήμος + Περιφερειακό Ταμείο). Ελέγξτε αν πρόκειται για διπλή καταχώριση ή πολλαπλές πληρωμές.${payableHint}`;
    displayValue = formatDisplayAmount(recon.rawTotalGross);
  } else if (recon.hasMultiplePayers) {
    message = `Βρέθηκαν ${recon.activeCount} εντάλματα από διαφορετικούς φορείς. Το άθροισμα (${formatDisplayAmount(recon.rawTotalGross)}) δεν υπερβαίνει ${refAmountDesc}.`;
  } else if (recon.activeCount === 1) {
    message = 'Βρέθηκε ένα εντάλμα πληρωμής — συμφωνεί με τα στοιχεία της αλυσίδας.';
  } else {
    message = `Βρέθηκαν ${recon.activeCount} εντάλματα πληρωμής — το άθροισμα δεν υπερβαίνει ${refAmountDesc}.`;
  }

  // Αν εξαιρέθηκαν άσχετα εντάλματα, προσθέτουμε σημείωση
  if (skippedUnrelated.length > 0) {
    const skippedAdams = skippedUnrelated.map((e) => e.adam).join(', ');
    message += ` Εξαιρέθηκ${skippedUnrelated.length === 1 ? 'ε' : 'αν'} αυτόματα `
      + `${skippedUnrelated.length} ένταλμα/τα (${skippedAdams}) που αναφέρ${skippedUnrelated.length === 1 ? 'ει' : 'ουν'} `
      + 'σύμβαση εκτός της τρέχουσας αλυσίδας. '
      + 'Αν αφορούν συμπληρωματική σύμβαση του υποέργου, ελέγξτε τα χειροκίνητα.';
    if (status === STATUS.COMPLETE) status = STATUS.NEEDS_REVIEW;
  }

  const relatedInfo = refs(
    ref('Ακατέργαστο άθροισμα (με ΦΠΑ)', formatDisplayAmount(recon.rawTotalGross)),
    recon.coFinancingPattern
      ? ref('Εκτιμώμενη πληρωμή εργολάβου (με ΦΠΑ)', formatDisplayAmount(recon.estimatedContractorPaymentGross))
      : null,
    ...paymentRefs,
    ...skippedUnrelatedRefs,
  );

  return buildItem({
    fieldId: 'paymentsReconciliation',
    label: 'Εντάλματα πληρωμής — έλεγχος ποσών & φορέων',
    status,
    displayValue,
    message,
    manualFieldKey: null,
    contractIndex: null,
    section: SECTION.PAYMENTS,
    sectionLabel: SECTION_LABELS[SECTION.PAYMENTS],
    references: commonRefs,
    relatedInfo,
    searchSteps: recon.needsReview || skippedUnrelated.length > 0
      ? [
          'Ελέγξτε τα τιμολόγια / αποδείξεις πληρωμής στον φάκελο του έργου.',
          'Συγκρίνετε κάθε ένταλμα στο ΚΗΜΔΗΣ: ποιος φορέας το εξέδωσε και σε ποιον αφορά.',
          'Σε έργα ΕΣΠΑ/ΠΕΠ, επιβεβαιώστε αν το Περιφερειακό Ταμείο αποζημιώνει τον Δήμο (όχι δεύτερη πληρωμή εργολάβου).',
          ...(skippedUnrelated.length > 0
            ? ['Για τα εξαιρεθέντα εντάλματα: ελέγξτε αν ανήκουν σε συμπληρωματική σύμβαση αυτού του υποέργου.']
            : []),
        ]
      : [
          'Δείτε την ενότητα «Εντάλματα πληρωμής» στα αποτελέσματα ΚΗΜΔΗΣ.',
          'Κάθε ένταλμα εμφανίζεται με τον φορέα που το εξέδωσε (Δήμος, Περιφ. Ταμείο κ.λπ.).',
        ],
    formLocation: 'Αναφορά ελέγχου → «Εντάλματα πληρωμής» · εμφανίζεται και στα αποτελέσματα ανάκτησης ΑΔΑΜ.',
    paymentsReconciliation: recon,
    skippedUnrelatedPayments: skippedUnrelated,
  });
}

function paymentsFromStoredRecon(recon) {
  return (recon?.entries || []).map((e) => ({
    adam: e.adam,
    snapshot: {
      referenceNumber: e.adam,
      organization: e.org || '',
      totalCostWithVAT: e.gross,
      cancelled: !!e.cancelled,
      credit: !!e.credit,
    },
  }));
}

function refValueFromItem(item, labelPattern) {
  const ref = (item?.references || []).find((r) => labelPattern.test(String(r.label || '')));
  return ref?.value ? String(ref.value).trim() : '';
}

/** Επαναϋπολογισμός ειδοποίησης ενταλμάτων με ενημερωμένο συμβατικό ποσό (π.χ. μετά συμπληρωματική). */
function rebuildPaymentsReconciliationItem(existingItem, overrides = {}) {
  if (!existingItem || existingItem.fieldId !== 'paymentsReconciliation') return existingItem;
  const recon = existingItem.paymentsReconciliation;
  if (!recon?.entries?.length) return existingItem;

  const payments = paymentsFromStoredRecon(recon);
  const contractingOrg = refValueFromItem(existingItem, /αναθέτουσα/i)
    || recon.entries.find((e) => e.org)?.org
    || '';
  const contractAdam = refValueFromItem(existingItem, /σύμβασης/i);

  const ctx = {
    apeAmount: overrides.apeAmount ?? null,
    formContractAmountGross: overrides.formContractAmountGross ?? null,
    auction: { snapshot: { organization: contractingOrg } },
    contract: { primaryAdam: contractAdam, adam: contractAdam },
    primaryRecord: contractAdam ? { referenceNumber: contractAdam } : null,
    skippedUnrelatedPayments: existingItem.skippedUnrelatedPayments
      || overrides.skippedUnrelatedPayments
      || [],
    amountContext: overrides.amountContext || {},
  };

  const fresh = buildPaymentsReconciliationItem(payments, ctx);
  if (!fresh) return existingItem;
  return {
    ...fresh,
    contractIndex: existingItem.contractIndex ?? null,
    skippedUnrelatedPayments: ctx.skippedUnrelatedPayments,
  };
}

function buildParallelContractAmountItems(chainMeta, ctx) {
  const siblings = (chainMeta?.parallelContracts || []).filter(Boolean);
  const hints = chainMeta?.parallelContractAmountsByAdam || {};
  if (siblings.length < 2) return [];

  const snapshots = chainMeta?.contractSnapshotsByAdam || {};
  return siblings.map((adam, contractIndex) => {
    const hint = hints[adam];
    const snap = snapshots[adam] || {};
    const commonRefs = refs(
      ref('Κωδικός σύμβασης (ΚΗΜΔΗΣ)', adam),
      ref('Τίτλος σύμβασης', snap.title),
      ref('Ανάδοχος', snap.anadoxosName),
      ctx.auction?.adam ? ref('Κωδικός ανάθεσης (ΚΗΜΔΗΣ)', ctx.auction.adam) : null,
    );

    if (hint?.gross) {
      const display = hint.displayValue || formatAmountEl(hint.gross);
      return buildItem({
        fieldId: 'contractAmount',
        label: `Ποσό σύμβασης ${contractIndex + 1} (με ΦΠΑ)`,
        status: STATUS.NEEDS_REVIEW,
        displayValue: `${display} €`.replace(' € €', ' €'),
        message: `Προτάθηκε ${display} € από ${hint.sourceLabel || 'εντάλματα πληρωμής'}. Ελέγξτε με το συμφωνητικό — αν διορθώσετε το ποσό στη φόρμα, η τιμή σας αποθηκεύεται ως οριστική.`,
        manualFieldKey: 'contractAmount',
        contractIndex,
        section: SECTION.CONTRACT,
        sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
        references: commonRefs,
        relatedInfo: refs(
          ref('Πηγή εκτίμησης', hint.sourceLabel || 'εντάλματα πληρωμής'),
        ),
        formLocation: `Ενότητα «Στοιχεία Σύμβασης» → γραμμή ${contractIndex + 1} → Ποσό.`,
        searchSteps: [
          'Συγκρίνετε με το υπογεγραμμένο συμφωνητικό (PDF).',
          'Αν το ποσό είναι λάθος, διορθώστε το απευθείας στο πεδίο — δεν θα αντικατασταθεί σε επανάκτηση.',
        ],
      });
    }

    return buildItem({
      fieldId: 'contractAmount',
      label: `Ποσό σύμβασης ${contractIndex + 1} (με ΦΠΑ)`,
      status: STATUS.MISSING,
      displayValue: '',
      message: contractAmountSplitContractsMessage(siblings.length),
      manualFieldKey: 'contractAmount',
      contractIndex,
      section: SECTION.CONTRACT,
      sectionLabel: SECTION_LABELS[SECTION.CONTRACT],
      references: commonRefs,
      formLocation: `Ενότητα «Στοιχεία Σύμβασης» → γραμμή ${contractIndex + 1} → Ποσό.`,
    });
  });
}

function buildKhmdhsDataQualityReport(ctx = {}) {
  const {
    primaryRecord,
    amountContext = {},
    notice,
    request,
    auction,
    contract,
    mappedProcedure = '',
    noticeProcessStart = '',
    contractChainHistory = [],
    chainMeta,
    contractIndex = null,
    payments = [],
  } = ctx;

  const reportContext = buildReportContext(ctx);

  const parallelItems = (chainMeta?.hasParallelContracts && (chainMeta?.parallelContracts || []).length > 1)
    ? buildParallelContractAmountItems(chainMeta, ctx)
    : [];

  const items = [
    buildProjectBudgetItem(request, ctx),
    buildAssignmentProcedureItem(notice, mappedProcedure),
    buildProcessStartItem(notice, noticeProcessStart),
    ...(parallelItems.length ? [] : [buildContractDateItem(primaryRecord, contract)]),
    ...(parallelItems.length ? parallelItems : [buildContractAmountItem(primaryRecord, amountContext, ctx)]),
    buildPaymentsReconciliationItem(payments, ctx),
    ...buildSupplementaryItemsFromChainHistory(contractChainHistory, ctx),
    ...buildChainClassificationReviewItems(contractChainHistory),
  ].filter(Boolean);

  const tagged = items.map((item) => ({
    ...item,
    contractIndex: item.fieldId === 'contractDate' || item.fieldId === 'contractAmount'
      ? contractIndex
      : item.contractIndex ?? null,
  }));

  const hasActionRequired = tagged.some(
    (item) => item.status === STATUS.NEEDS_REVIEW || item.status === STATUS.MISSING
  );

  return {
    items: tagged,
    context: reportContext,
    hasActionRequired,
    generatedAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedFieldIds: [],
  };
}

module.exports = {
  STATUS,
  SECTION,
  SECTION_LABELS,
  STATUS_LABELS,
  buildKhmdhsDataQualityReport,
  rebuildPaymentsReconciliationItem,
};
