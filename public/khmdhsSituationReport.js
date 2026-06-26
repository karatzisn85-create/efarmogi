/**
 * Αναφορά καταστάσεων / απροόπτων ΚΗΜΔΗΣ — εξηγήσεις και επιλογές για τον χρήστη.
 */

const {
  ELECTRONIC_VS_PAPER_SHORT,
  contractAmountFallbackTitle,
  contractAmountFallbackMessage,
  incompleteKhmdhsFieldsIntro,
  orphanSymvSeedTitle,
  orphanSymvSeedExplanation,
  followUpCommitmentNoSupplementaryTitle,
  followUpCommitmentNoSupplementaryExplanation,
  parallelContractsTitle,
  parallelContractsExplanation,
} = require('./khmdhsUserCopy');

const SEVERITY = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const ACTION = {
  ACCEPT_PARTIAL: 'accept_partial',
  OPEN_REVIEW: 'open_review',
  TRY_SYMV: 'try_symv',
  RETRY_SEED: 'retry_seed',
  TRY_PRIMARY_SEED: 'try_primary_seed',
  ADD_SUPPLEMENTARY_ADAM: 'add_supplementary_adam',
  CLEAR_KHMDHS: 'clear_khmdhs',
  MANUAL_CONTINUE: 'manual_continue',
  DISMISS: 'dismiss',
};

const STAGE_LABELS = {
  request: 'πρωτογενές αίτημα',
  notice: 'δημοσίευση',
  auction: 'ανάθεση',
  contract: 'σύμβαση',
};

const STAGE_TYPE_LABELS = {
  REQ: 'πρωτογενές αίτημα',
  PROC: 'δημοσίευση',
  AWRD: 'ανάθεση',
  SYMV: 'σύμβαση',
  PAY: 'ένταλμα πληρωμής',
};

function stageTypeLabel(type) {
  return STAGE_TYPE_LABELS[String(type || '').toUpperCase()] || 'έγγραφο';
}

function adamType(adam) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adam || ''));
  return m ? m[2].toUpperCase() : '';
}

function formatDateEl(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function buildSituation(base) {
  return {
    requiresDecision: false,
    details: [],
    found: {},
    missing: [],
    actions: [],
    ...base,
  };
}

function action(id, label, description, { primary = false, suggestedAdam = null } = {}) {
  return { id, label, description, primary, suggestedAdam };
}

function collectFound(ctx, chainMeta) {
  const found = {};
  if (ctx.request?.adam) {
    found.request = ctx.request.adam;
    if (ctx.request.snapshot?.cancelled) found.requestCancelled = true;
    if (ctx.request.snapshot?.cancellationDate) {
      found.requestCancelledDate = formatDateEl(ctx.request.snapshot.cancellationDate);
    }
  }
  if (ctx.notice?.adam) {
    found.notice = ctx.notice.adam;
    if (ctx.notice.snapshot?.cancelled) found.noticeCancelled = true;
  }
  if (ctx.auction?.adam) {
    found.auction = ctx.auction.adam;
    if (ctx.auction.snapshot?.cancelled) found.auctionCancelled = true;
  }
  if (ctx.contract?.adam) {
    found.contract = ctx.contract.adam;
  } else {
    const parallel = (chainMeta?.parallelContracts || []).filter(Boolean);
    if (parallel.length > 1) {
      found.parallelContracts = parallel.length;
      found.contracts = parallel.join(', ');
    }
  }
  return found;
}

function collectMissing(ctx, chainMeta) {
  const missing = [];
  const parallel = (chainMeta?.parallelContracts || []).filter(Boolean);
  const hasParallelContracts = parallel.length > 1;
  if (!ctx.request?.adam) missing.push(STAGE_LABELS.request);
  if (!ctx.notice?.adam) missing.push(STAGE_LABELS.notice);
  if (!ctx.auction?.adam) missing.push(STAGE_LABELS.auction);
  if (!ctx.contract?.adam && !hasParallelContracts) missing.push(STAGE_LABELS.contract);
  return missing;
}

function highestSeverity(situations) {
  const order = [SEVERITY.ERROR, SEVERITY.WARNING, SEVERITY.INFO, SEVERITY.SUCCESS];
  for (const sev of order) {
    if (situations.some((s) => s.severity === sev)) return sev;
  }
  return SEVERITY.INFO;
}

function buildKhmdhsSituationReport(ctx = {}) {
  const {
    success = false,
    error = '',
    warnings = [],
    chainMeta = null,
    request = null,
    notice = null,
    auction = null,
    contract = null,
    dataQualityReport = null,
    isOrphanSymvSeed = false,
    followUpCommitmentsWithoutContract = [],
    derivedSupplementaryCount = 0,
  } = ctx;

  const seedAdam = chainMeta?.seedAdam || '';
  const seedType = chainMeta?.seedType || adamType(seedAdam);
  const skippedCancelled = chainMeta?.skippedCancelled || [];
  const linked = chainMeta?.linkedAdams || {};
  const found = collectFound({ request, notice, auction, contract }, chainMeta);
  const missing = collectMissing({ request, notice, auction, contract }, chainMeta);
  const situations = [];

  const warnText = warnings.join(' ');

  if (!success) {
    const onlyCancelled = skippedCancelled.some((s) => s.adam === seedAdam);
    situations.push(buildSituation({
      id: onlyCancelled ? 'seed_cancelled_no_chain' : 'no_linked_actions',
      severity: SEVERITY.ERROR,
      requiresDecision: true,
      title: onlyCancelled
        ? 'Ο ΑΔΑΜ είναι ακυρωμένος στο ΚΗΜΔΗΣ'
        : 'Δεν βρέθηκαν συνδεδεμένες πράξεις',
      explanation: error || (onlyCancelled
        ? `Το ΚΗΜΔΗΣ επιστρέφει τον κωδικό ${seedAdam} ως ακυρωμένο ή ματαιωμένο και δεν υπάρχουν ενεργές συνδεδεμένες πράξεις.`
        : 'Το ΚΗΜΔΗΣ δεν επέστρεψε ενεργές πράξεις για αυτόν τον κωδικό.'),
      details: onlyCancelled
        ? [
          'Το έγγραφο μπορεί να υπάρχει στον φάκελό σας, αλλά στο ΚΗΜΔΗΣ η διαδικασία σημειώνεται ως ακυρωμένη.',
          'Αν υπάρχει νεότερο αίτημα ή σύμβαση, χρησιμοποιήστε εκείνον τον κωδικό.',
        ]
        : [
          'Ελέγξτε ότι ο κωδικός είναι σωστός (μορφή: 2 ψηφία + γράμματα + 9 ψηφία, π.χ. 24AWRD015398215).',
          'Αν η διαδικασία ολοκληρώθηκε φυσικά, δοκιμάστε τον κωδικό της υπογεγραμμένης σύμβασης — μπορεί να μην συνδέεται ηλεκτρονικά.',
        ],
      found: { seed: seedAdam, seedType },
      missing: Object.values(STAGE_LABELS),
      actions: [
        action(ACTION.RETRY_SEED, 'Δοκιμή άλλου ΑΔΑΜ', 'Επιστροφή στο πεδίο αλυσίδας για νέα ανάκτηση.', { primary: true }),
        ...(seedType !== 'SYMV'
          ? [action(ACTION.TRY_SYMV, 'Ανάκτηση με κωδικό σύμβασης', 'Αν γνωρίζετε τον κωδικό της υπογεγραμμένης σύμβασης.')]
          : []),
        action(ACTION.MANUAL_CONTINUE, 'Συνέχεια χειροκίνητα', 'Κλείσιμο και συμπλήρωση πεδίων χωρίς ΚΗΜΔΗΣ.'),
        action(ACTION.CLEAR_KHMDHS, 'Ακύρωση ανάκτησης', 'Διαγραφή τυχόν μερικών στοιχείων ΚΗΜΔΗΣ.'),
      ],
    }));
  } else {
    const seedCancelled = (
      (seedType === 'REQ' && found.requestCancelled)
      || (seedType === 'PROC' && found.noticeCancelled)
      || (seedType === 'AWRD' && found.auctionCancelled)
    );

    if (seedCancelled) {
      const cancelDate = found.requestCancelledDate || '';
      situations.push(buildSituation({
        id: 'seed_cancelled_partial',
        severity: SEVERITY.WARNING,
        requiresDecision: true,
        title: 'Ο κωδικός που δώσατε είναι ακυρωμένος στο ΚΗΜΔΗΣ',
        explanation: `Στο ΚΗΜΔΗΣ ο κωδικός ${seedAdam} σημειώνεται ως ακυρωμένος ή ματαιωμένος.${cancelDate ? ` Ημερομηνία ακύρωσης: ${cancelDate}.` : ''} Εμφανίζονται όσα ηλεκτρονικά στοιχεία υπάρχουν ακόμα — δεν σημαίνει ότι δεν έχετε έγγραφα στον φάκελο.`,
        details: [
          'Η διαδικασία μπορεί να μην έχει προχωρήσει πέρα από αυτό το στάδιο στο σύστημα.',
          'Συχνά υπάρχει νεότερο πρωτογενές αμέσως μετά την ακύρωση — δοκιμάστε τον ΑΔΑΜ της σύμβασης ή της δέσμευσης από τον φάκελό σας.',
          missing.length
            ? `Δεν βρέθηκαν: ${missing.join(', ')}.`
            : 'Βρέθηκαν όλα τα στάδια της αλυσίδας.',
        ],
        found,
        missing,
        actions: [
          action(ACTION.ACCEPT_PARTIAL, 'Αποδοχή διαθέσιμων στοιχείων', 'Κράτηση όσων βρέθηκαν και συνέχεια.', { primary: true }),
          action(ACTION.RETRY_SEED, 'Δοκιμή άλλου ΑΔΑΜ', 'Αν υπάρχει νεότερο αίτημα ή σύμβαση.'),
          ...(missing.includes(STAGE_LABELS.contract)
            ? [action(ACTION.TRY_SYMV, 'Ανάκτηση με κωδικό σύμβασης', 'Αν η σύμβαση καταχωρίστηκε με άλλο κωδικό.')]
            : []),
          action(ACTION.MANUAL_CONTINUE, 'Συμπλήρωση χειροκίνητα', 'Συμπληρώστε τα υπόλοιπα πεδία μόνοι σας.'),
        ],
      }));
    }

    if (skippedCancelled.length > 0 && !seedCancelled) {
      situations.push(buildSituation({
        id: 'skipped_cancelled_in_chain',
        severity: SEVERITY.INFO,
        requiresDecision: false,
        title: 'Παραλείφθηκαν ακυρωμένες πράξεις στην αλυσίδα',
        explanation: `Στα ηλεκτρονικά δεδομένα του ΚΗΜΔΗΣ υπάρχουν ${skippedCancelled.length} ακυρωμένη/ες πράξη/εις που αγνοήθηκαν — χρησιμοποιήθηκαν μόνο οι ενεργές.`,
        details: skippedCancelled.slice(0, 5).map((s) => `${stageTypeLabel(s.stage)}: ${s.adam || s.original}`),
        found,
        missing,
        actions: [
          action(ACTION.ACCEPT_PARTIAL, 'Κατάλαβα', 'Συνέχεια με τις ενεργές πράξεις.', { primary: true }),
        ],
      }));
    }

    if (/συμπληρώθηκε από συνδεδεμένο αίτημα/i.test(warnText)) {
      situations.push(buildSituation({
        id: 'chain_enriched_from_req',
        severity: SEVERITY.INFO,
        requiresDecision: false,
        title: 'Η αλυσίδα συμπληρώθηκε έμμεσα',
        explanation: 'Όταν ξεκινάτε από δημοσίευση ή ανάθεση, το ΚΗΜΔΗΣ δεν επιστρέφει πάντα όλα τα στάδια ηλεκτρονικά. Η εφαρμογή αναζήτησε συνδεδεμένο αίτημα για να συμπληρώσει την αλυσίδα — όχι επειδή λείπουν έγγραφα από τον φάκελό σας.',
        details: [
          found.contract ? `Βρέθηκε σύμβαση: ${found.contract}` : null,
          found.auction ? `Βρέθηκε ανάθεση: ${found.auction}` : null,
        ].filter(Boolean),
        found,
        missing,
        actions: [
          action(ACTION.ACCEPT_PARTIAL, 'Εντάξει', 'Συνέχεια με τα συμπληρωμένα στοιχεία.', { primary: true }),
        ],
      }));
    }

    if (!contract?.adam && notice?.adam && seedType === 'PROC') {
      situations.push(buildSituation({
        id: 'proc_without_contract',
        severity: SEVERITY.WARNING,
        requiresDecision: true,
        title: 'Βρέθηκε δημοσίευση — όχι ηλεκτρονική σύμβαση',
        explanation: 'Στα δεδομένα του ΚΗΜΔΗΣ βρέθηκε δημοσίευση, αλλά όχι συνδεδεμένη ηλεκτρονική καταχώριση σύμβασης. Η σύμβαση μπορεί να έχει ήδη υπογραφεί φυσικά — απλώς δεν εμφανίζεται ή δεν συνδέεται στο σύστημα.',
        details: [
          'Η σύμβαση μπορεί να μην έχει καταχωριστεί ακόμα ηλεκτρονικά στο ΚΗΜΔΗΣ.',
          'Μπορεί να έχει καταχωριστεί με άλλο κωδικό ή να μην συνδέεται σωστά με τη δημοσίευση.',
          'Αν έχετε την υπογεγραμμένη σύμβαση στον φάκελο, δοκιμάστε τον κωδικό της απευθείας.',
        ],
        found,
        missing: missing.filter((m) => m === STAGE_LABELS.contract),
        actions: [
          action(ACTION.ACCEPT_PARTIAL, 'Κράτηση δημοσίευσης', 'Χρήση στοιχείων δημοσίευσης και συμπλήρωση υπόλοιπων χειροκίνητα.', { primary: true }),
          action(ACTION.TRY_SYMV, 'Ανάκτηση με κωδικό σύμβασης', 'Νέα ανάκτηση με κωδικό σύμβασης.'),
          action(ACTION.OPEN_REVIEW, 'Έλεγχος ελλιπών πεδίων', 'Άνοιγμα αναφοράς για συμπλήρωση.'),
        ],
      }));
    }

    if (!contract?.adam && seedType === 'REQ' && request?.adam && !request?.snapshot?.cancelled) {
      const hasLaterStages = notice?.adam || auction?.adam;
      if (!hasLaterStages) {
        situations.push(buildSituation({
          id: 'req_only_early_stage',
          severity: SEVERITY.INFO,
          requiresDecision: true,
          title: 'Μόνο πρωτογενές αίτημα — χωρίς σύμβαση',
          explanation: 'Στο ΚΗΜΔΗΣ βρέθηκε μόνο το πρωτογενές αίτημα — δεν υπάρχουν ακόμα ηλεκτρονικά δημοσίευση, ανάθεση ή σύμβαση. Αυτό δεν αναιρεί ότι μπορεί να έχετε ήδη έγγραφα σε προχωρημένο στάδιο στον φάκελο.',
          details: [
            'Φυσιολογικό αν η διαδικασία είναι σε πρώιμο στάδιο και δεν έχει καταχωριστεί περαιτέρω στο ΚΗΜΔΗΣ.',
            'Όταν καταχωριστεί σύμβαση στο σύστημα, κάντε νέα ανάκτηση με τον κωδικό της.',
          ],
          found,
          missing: missing.filter((m) => m !== STAGE_LABELS.request),
          actions: [
            action(ACTION.ACCEPT_PARTIAL, 'Αποδοχή στοιχείων αιτήματος', 'Κράτηση προϋπολογισμού και τίτλου από το αίτημα.', { primary: true }),
            action(ACTION.RETRY_SEED, 'Ανάκτηση με άλλο κωδικό', 'π.χ. δημοσίευσης ή σύμβασης όταν προχωρήσει η διαδικασία.'),
            action(ACTION.OPEN_REVIEW, 'Έλεγχος πεδίων', 'Συμπλήρωση όσων λείπουν.'),
          ],
        }));
      }
    }

    const contractAmountReviewItem = (dataQualityReport?.items || []).find(
      (i) => i.fieldId === 'contractAmount' && i.status === 'needs_review'
    );
    const hasAmountFallbackSignal = contractAmountReviewItem
      || /προέρχεται από|συμπληρώθηκε|πεδίο ποσού|Προτάθηκε [\d.,]+/i.test(warnText);

    if (contract?.adam && hasAmountFallbackSignal) {
      situations.push(buildSituation({
        id: 'contract_amount_fallback',
        severity: SEVERITY.WARNING,
        requiresDecision: true,
        title: contractAmountFallbackTitle(),
        explanation: contractAmountReviewItem?.message
          || contractAmountFallbackMessage('από την ανάθεση ή τη δημοσίευση της ίδιας υπόθεσης'),
        details: [
          ELECTRONIC_VS_PAPER_SHORT,
          'Συγκρίνετε το προτεινόμενο ποσό με την υπογεγραμμένη σύμβαση ή την απόφαση ανάθεσης πριν την αποθήκευση.',
        ],
        found,
        missing,
        actions: [
          action(ACTION.OPEN_REVIEW, 'Έλεγχος & επιβεβαίωση ποσού', 'Άνοιγμα αναφοράς ελέγχου.', { primary: true }),
          action(ACTION.ACCEPT_PARTIAL, 'Αποδοχή όπως είναι', 'Κράτηση του υπολογισμένου ποσού.'),
        ],
      }));
    }

    if (isOrphanSymvSeed && contract?.adam) {
      situations.push(buildSituation({
        id: 'orphan_symv_seed',
        severity: SEVERITY.WARNING,
        requiresDecision: true,
        title: orphanSymvSeedTitle(),
        explanation: orphanSymvSeedExplanation(),
        details: [
          ELECTRONIC_VS_PAPER_SHORT,
          `Βρέθηκε μόνο η σύμβαση ${contract.adam} — όχι πρωτογενές αίτημα, δημοσίευση ή ανάθεση.`,
          'Για να φέρετε ολόκληρη την υπόθεση: ξεκινήστε με τον ΑΔΑΜ του πρωτογενούς αιτήματος ή της αρχικής σύμβασης.',
          'Αν αυτός ο κωδικός είναι συμπληρωματική σύμβαση, κάντε πρώτα ανάκτηση με τον κωδικό της κύριας αλυσίδας και μετά προσθέστε τον εδώ ως συμπληρωματική.',
        ],
        found,
        missing: missing.filter((m) => m !== STAGE_LABELS.contract),
        actions: [
          action(ACTION.TRY_PRIMARY_SEED, 'Ανάκτηση με κωδικό κύριας αλυσίδας', 'Πρωτογενές αίτημα ή αρχική σύμβαση — για ολόκληρη την υπόθεση.', { primary: true }),
          action(ACTION.ACCEPT_PARTIAL, 'Κράτηση μόνο αυτής της σύμβασης', 'Χρήση στοιχείων σύμβασης χωρίς υπόλοιπα στάδια.'),
          action(ACTION.CLEAR_KHMDHS, 'Ακύρωση ανάκτησης', 'Διαγραφή μερικών στοιχείων ΚΗΜΔΗΣ.'),
        ],
      }));
    }

    const parallelContracts = Array.isArray(chainMeta?.parallelContracts)
      ? chainMeta.parallelContracts.filter(Boolean)
      : [];
    const amountHints = chainMeta?.parallelContractAmountsByAdam || {};
    const amountsInferred = !!chainMeta?.parallelAmountsFullyInferred;
    if (parallelContracts.length > 1) {
      const detailLines = [
        ELECTRONIC_VS_PAPER_SHORT,
        ...parallelContracts.slice(0, 5).map((a) => {
          const hint = amountHints[a];
          const amt = hint?.displayValue ? ` — ${hint.displayValue} € (από ${hint.sourceLabel || 'εντάλματα'})` : '';
          return `Σύμβαση: ${a}${amt}`;
        }),
      ];
      if (amountsInferred) {
        detailLines.push(
          'Τα ποσά προέρχονται από εντάλματα πληρωμής του ΚΗΜΔΗΣ. Μπορείτε να τα διορθώσετε στα πεδία σύμβασης — η διόρθωσή σας αποθηκεύεται ως οριστική και δεν αντικαθίσταται σε νέα ανάκτηση.',
        );
      } else {
        detailLines.push(
          'Το συνολικό ποσό της ανάθεσης δεν αντιστοιχεί σε μία μόνο σύμβαση — συμπληρώστε το ποσό από το PDF της σύμβασης που σας ενδιαφέρει.',
        );
      }

      situations.push(buildSituation({
        id: 'parallel_contracts_same_case',
        severity: amountsInferred ? SEVERITY.INFO : SEVERITY.WARNING,
        requiresDecision: !amountsInferred,
        title: amountsInferred
          ? `${parallelContracts.length} ξεχωριστές συμβάσεις — καταχωρήθηκαν αυτόματα`
          : parallelContractsTitle(),
        explanation: amountsInferred
          ? `Στην ίδια υπόθεση εμφανίζονται ${parallelContracts.length} ανεξάρτητες συμβάσεις (διαφορετικοί αναδόχοι ή αντικείμενα). Η μορφή «Πολλές Συμβάσεις» εφαρμόστηκε αυτόματα και τα ποσά προτάθηκαν από τα εντάλματα πληρωμής.`
          : parallelContractsExplanation(parallelContracts.length),
        details: detailLines,
        found,
        missing,
        actions: amountsInferred
          ? [
            action(ACTION.OPEN_REVIEW, 'Έλεγχος ποσών συμβάσεων', 'Άνοιγμα αναφοράς για επιβεβαίωση ή διόρθωση.', { primary: true }),
            action(ACTION.DISMISS, 'Εντάξει', 'Συνέχεια — τα ποσά μπορείτε να τα αλλάξετε ανά πάσα στιγμή στη φόρμα.'),
          ]
          : [
            ...parallelContracts.slice(0, 3).map((a, idx) => action(
              ACTION.TRY_SYMV,
              `Ανάκτηση ${a}`,
              'Φόρτωση στοιχείων αυτής της σύμβασης.',
              { primary: idx === 0, suggestedAdam: a }
            )),
            action(ACTION.ACCEPT_PARTIAL, 'Συνέχεια χωρίς σύμβαση', 'Κράτηση δημοσίευσης/ανάθεσης — συμπληρώστε σύμβαση χειροκίνητα.'),
          ],
      }));
    }

    const followUps = Array.isArray(followUpCommitmentsWithoutContract)
      ? followUpCommitmentsWithoutContract.filter((f) => f?.adam)
      : [];
    if (
      followUps.length > 0
      && seedType === 'REQ'
      && request?.adam
      && derivedSupplementaryCount === 0
    ) {
      situations.push(buildSituation({
        id: 'followup_commitment_no_supplementary',
        severity: SEVERITY.WARNING,
        requiresDecision: true,
        title: followUpCommitmentNoSupplementaryTitle(),
        explanation: followUpCommitmentNoSupplementaryExplanation(),
        details: [
          ELECTRONIC_VS_PAPER_SHORT,
          ...followUps.slice(0, 3).map((f) => `Εγκεκριμένο αίτημα συμπληρωματικής: ${f.adam}${f.title ? ` — ${String(f.title).slice(0, 80)}` : ''}`),
          'Η συμπληρωματική σύμβαση μπορεί να υπάρχει στον φάκελό σας αλλά να μην έχει ηλεκτρονικά συνδεθεί με το πρωτογενές.',
        ],
        found,
        missing,
        actions: [
          action(ACTION.ADD_SUPPLEMENTARY_ADAM, 'Προσθήκη ΑΔΑΜ συμπληρωματικής', 'Δώστε τον κωδικό της συμπληρωματικής σύμβασης — τα υπόλοιπα στοιχεία θα μείνουν.', { primary: true }),
          action(ACTION.ACCEPT_PARTIAL, 'Συνέχεια χωρίς συμπληρωματική', 'Κράτηση της κύριας αλυσίδας όπως είναι.'),
        ],
      }));
    }

    // Αποφάσεις Ανάληψης Υποχρέωσης — κρίκος 2, αναγνωρίζονται σιωπηλά χωρίς situation.
    // Καταγράφονται στο chainMeta.linkedAdams.budgetCommitments για αναφορά.
    const altApproved = (linked.approvedRequests || []).filter((a) => a && a !== found.request);
    if (altApproved.length && !contract?.adam) {
      situations.push(buildSituation({
        id: 'alternate_approved_requests',
        severity: SEVERITY.INFO,
        requiresDecision: true,
        title: 'Υπάρχουν εγκεκριμένα αιτήματα στην αλυσίδα',
        explanation: 'Στο ΚΗΜΔΗΣ εμφανίζονται εγκεκριμένα αιτήματα διαφορετικά από το πρωτογενές — συχνά οδηγούν σε πλήρη ηλεκτρονική αλυσίδα.',
        details: altApproved.slice(0, 4).map((a) => `Εγκεκριμένο αίτημα: ${a}`),
        found,
        missing,
        actions: [
          action(ACTION.RETRY_SEED, `Δοκιμή ${altApproved[0]}`, 'Νέα ανάκτηση με εγκεκριμένο αίτημα.', {
            primary: true,
            suggestedAdam: altApproved[0],
          }),
          action(ACTION.ACCEPT_PARTIAL, 'Συνέχεια με τρέχοντα', 'Κράτηση όσων βρέθηκαν τώρα.'),
        ],
      }));
    }
  }

  const pendingReviewItems = (dataQualityReport?.items || []).filter(
    (i) => i.status === 'missing' || i.status === 'needs_review'
  );
  // Το ποσό από fallback (AWRD/PROC) έχει ήδη ξεχωριστή κάρτα — όχι δεύτερη γενική ειδοποίηση
  const hasAmountFallbackCard = situations.some((s) => s.id === 'contract_amount_fallback');
  const reviewItemsStillGeneric = hasAmountFallbackCard
    ? pendingReviewItems.filter((i) => i.fieldId !== 'contractAmount')
    : pendingReviewItems;
  const missingFieldCount = reviewItemsStillGeneric.length;

  const skipGenericIncomplete = situations.some(
    (s) => s.id === 'orphan_symv_seed' || s.id === 'followup_commitment_no_supplementary'
  );
  if (success && missingFieldCount > 0 && !situations.some((s) => s.id === 'proc_without_contract') && !skipGenericIncomplete) {
    situations.push(buildSituation({
      id: 'incomplete_fields',
      severity: SEVERITY.WARNING,
      requiresDecision: true,
      title: `${missingFieldCount} πεδία χρειάζονται έλεγχο ή συμπλήρωση`,
      explanation: incompleteKhmdhsFieldsIntro(),
      details: [
        ELECTRONIC_VS_PAPER_SHORT,
        'Ανοίξτε την αναφορά ελέγχου για σύγκριση με τα έγγραφά σας και συμπλήρωση όσων λείπουν ηλεκτρονικά.',
      ],
      found,
      missing,
      actions: [
        action(ACTION.OPEN_REVIEW, 'Άνοιγμα αναφοράς ελέγχου', 'Συμπλήρωση/επιβεβαίωση πεδίων εκεί.', { primary: true }),
        action(ACTION.ACCEPT_PARTIAL, 'Θα τα ελέγξω αργότερα', 'Συνέχεια — η αναφορά μένει διαθέσιμη.'),
      ],
    }));
  }

  const deduped = [];
  const seenIds = new Set();
  situations.forEach((s) => {
    if (seenIds.has(s.id)) return;
    seenIds.add(s.id);
    deduped.push(s);
  });

  return {
    situations: deduped,
    hasSituations: deduped.length > 0,
    requiresDecision: deduped.some((s) => s.requiresDecision),
    primarySeverity: highestSeverity(deduped),
    seedAdam,
    seedType,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  SEVERITY,
  ACTION,
  buildKhmdhsSituationReport,
};
