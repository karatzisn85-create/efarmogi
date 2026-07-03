/**
 * Εμπλουτισμός payload αναφοράς υποέργου (σύνοψη, χρονολόγιο, πληρότητα, αρχεία).
 */

import { STATUSES_WITH_KHMDHS_ADAM } from '../data/formOptions';

const CHAIN_STAGE_LABELS = {
  req: 'Πρωτογενές αίτημα',
  commit: 'Απόφαση ανάληψης υποχρέωσης',
  proc: 'Προκήρυξη / Πρόσκληση',
  awrd: 'Ανάθεση',
  symv: 'Σύμβαση',
  supp: 'Συμπληρωματική σύμβαση',
  ape: 'ΑΠΕ',
  pay: 'Εντάλμα πληρωμής',
};

const CHAIN_TYPE_SORT_ORDER = {
  req: 1,
  commit: 2,
  proc: 3,
  awrd: 4,
  symv: 5,
  supp: 6,
  ape: 7,
  pay: 8,
};

const KHMDHS_STALE_DAYS = 30;

function parseAmountNumber(raw) {
  const s = String(raw ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseReportDateLabel(label) {
  const s = String(label || '').trim();
  if (!s || s === '—') return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const t = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmY) {
    const t = new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1])).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

function daysSinceIso(iso) {
  const t = Date.parse(String(iso || ''));
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function formatEuroNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatPercent(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { maximumFractionDigits: 1 })}%`;
}

export function buildNumberedFileInventory(inventory) {
  const base = inventory && typeof inventory === 'object' ? inventory : { groups: [], ungrouped: [], totalCount: 0 };
  let globalIndex = 0;
  const groups = (base.groups || []).map((group, gi) => {
    const files = (group.files || []).map((name) => {
      globalIndex += 1;
      return { index: globalIndex, name: String(name || '') };
    });
    return {
      title: group.title || 'Ομάδα αρχείων',
      categoryNumber: gi + 1,
      files,
    };
  });
  const ungrouped = (base.ungrouped || []).map((name) => {
    globalIndex += 1;
    return { index: globalIndex, name: String(name || '') };
  });
  return {
    groups,
    ungrouped,
    totalCount: globalIndex,
  };
}

export function buildPaymentSummaryForReport(basic, khmdhsChain) {
  const contractAmount = basic?.totalContractAmount > 0
    ? basic.totalContractAmount
    : parseAmountNumber(basic?.contractAmount);
  const pay = khmdhsChain?.pay || null;
  // «displayTotalGross»: το ποσό που πράγματι μετράει (μετά χαρακτηρισμό/χειροκίνητη διόρθωση/
  // εκτίμηση συγχρηματοδότησης) — ίδιο με ό,τι βλέπει ο χρήστης στην κάρτα πληρωμών του υποέργου.
  const paidAmount = pay?.displayTotalGross != null
    ? pay.displayTotalGross
    : (pay?.countableTotalGross != null
      ? pay.countableTotalGross
      : (pay?.estimatedContractorPaymentGross != null ? pay.estimatedContractorPaymentGross : pay?.totalGross));
  const paid = paidAmount != null && Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;
  const hasContract = contractAmount > 0;
  const hasPayments = (pay?.count || 0) > 0;
  const remaining = hasContract ? Math.max(0, contractAmount - paid) : null;
  const percentPaid = hasContract && contractAmount > 0
    ? Math.min(100, (paid / contractAmount) * 100)
    : null;

  return {
    hasContract,
    hasPayments,
    contractAmount,
    contractAmountLabel: hasContract ? formatEuroNum(contractAmount) : '—',
    paidAmount: paid,
    paidAmountLabel: hasPayments ? formatEuroNum(paid) : '—',
    remainingAmount: remaining,
    remainingLabel: remaining != null ? formatEuroNum(remaining) : '—',
    percentPaid,
    percentPaidLabel: percentPaid != null ? formatPercent(percentPaid) : '—',
    paymentCount: pay?.count || 0,
    usesCountableTotal: pay?.displayTotalGross != null || pay?.countableTotalGross != null,
  };
}

export function buildCompletenessGapsForReport(project, basic, khmdhsChain, files, entaxeis) {
  const gaps = [];
  const push = (level, text) => {
    if (text) gaps.push({ level, text });
  };

  if (!basic?.displayChargePrimary && !basic?.displayChargeParticipants) {
    push('info', 'Δεν έχει καταχωρηθεί επιβλέπων μηχανικός.');
  }

  const hasContract = !!(basic?.contractAmount || basic?.totalContractAmount > 0 || basic?.khmdhsAdam);
  const hasApe = basic?.isMultipleContracts
    ? (basic?.contracts || []).some((c) => parseAmountNumber(c?.apeAmount) > 0)
    : parseAmountNumber(basic?.apeAmount) > 0;

  if (hasContract && !hasApe) {
    push('warn', 'Δεν έχει καταχωρηθεί ποσό ΑΠΕ (+ συμπληρωματικές).');
  }

  if (hasContract && !(khmdhsChain?.pay?.count > 0)) {
    push('warn', 'Δεν υπάρχουν καταγεγραμμένα εντάλματα πληρωμής από ΚΗΜΔΗΣ.');
  }

  if (STATUSES_WITH_KHMDHS_ADAM.includes(basic?.projectStatus) && !basic?.khmdhsAdam) {
    push('warn', 'Η κατάσταση απαιτεί ΑΔΑΜ σύμβασης ΚΗΜΔΗΣ — λείπει από το υποέργο.');
  }

  if (hasContract && !basic?.contractDate) {
    push('info', 'Δεν έχει καταχωρηθεί ημερομηνία σύμβασης.');
  }

  const fetchedCandidates = [
    project?.khmdhsContractFetchedAt,
    project?.khmdhsRequestFetchedAt,
    project?.khmdhsAwardFetchedAt,
    project?.khmdhsNoticeFetchedAt,
  ].filter(Boolean);

  if (basic?.khmdhsAdam && fetchedCandidates.length > 0) {
    const oldestDays = Math.max(
      ...fetchedCandidates.map((iso) => daysSinceIso(iso)).filter((d) => d != null)
    );
    if (oldestDays >= KHMDHS_STALE_DAYS) {
      push('warn', `Τα δεδομένα ΚΗΜΔΗΣ δεν ανανεώθηκαν εδώ και ${oldestDays} ημέρες — συνιστάται ανανέωση.`);
    }
  } else if (basic?.khmdhsAdam && fetchedCandidates.length === 0) {
    push('info', 'Δεν υπάρχει καταγεγραμμένη ημερομηνία τελευταίας ανάκτησης ΚΗΜΔΗΣ.');
  }

  if (!(files?.totalCount > 0)) {
    push('info', 'Δεν υπάρχουν αρχεία στον φάκελο υποέργου.');
  }

  if (!(entaxeis?.length > 0) && basic?.fundingSource) {
    push('info', 'Δεν έχει συνδεθεί ένταξη χρηματοδότησης.');
  }

  if (khmdhsChain?.pay?.needsClassification) {
    push('warn', 'Τα εντάλματα πληρωμής απαιτούν χαρακτηρισμό (τι μετρά στο σύνολο).');
  }

  return gaps;
}

function commitLabel(index, total) {
  if (total <= 1) return CHAIN_STAGE_LABELS.commit;
  return `${CHAIN_STAGE_LABELS.commit} (${index + 1}/${total})`;
}

function timelineItem({
  type,
  stageName,
  title = '',
  adam = '',
  dateLabel = '',
  fallbackDate = '',
  cancelled = false,
  fields = [],
  themeKey = 'proc',
  commitIndex = null,
  sequence = 0,
}) {
  const sortTs = parseReportDateLabel(dateLabel)
    ?? parseReportDateLabel(fallbackDate)
    ?? Number.MAX_SAFE_INTEGER;
  return {
    type,
    stageName,
    title,
    adam,
    dateLabel: dateLabel || fallbackDate || '—',
    cancelled,
    fields: fields.filter((f) => f && f.value),
    themeKey,
    sortTs,
    commitIndex,
    sequence,
  };
}

/** Ταξινόμηση αλυσίδας: πρωτογενές πάντα πρώτο, μετά χρονολογία, μετά τύπος σταδίου. */
export function compareChainTimelineItems(a, b) {
  if (a?.type === 'req' && b?.type !== 'req') return -1;
  if (b?.type === 'req' && a?.type !== 'req') return 1;

  const byDate = (a?.sortTs ?? Number.MAX_SAFE_INTEGER) - (b?.sortTs ?? Number.MAX_SAFE_INTEGER);
  if (byDate !== 0) return byDate;

  const byType = (CHAIN_TYPE_SORT_ORDER[a?.type] || 99) - (CHAIN_TYPE_SORT_ORDER[b?.type] || 99);
  if (byType !== 0) return byType;

  if (a?.type === 'commit' && b?.type === 'commit') {
    return (a.commitIndex ?? 0) - (b.commitIndex ?? 0);
  }

  return (a?.sequence ?? 0) - (b?.sequence ?? 0);
}

export function buildChronologicalChainTimeline(khmdhsChain, khmdhsNotice, basic) {
  const items = [];
  const chain = khmdhsChain || {};
  const commitTotal = chain.commit?.length || 0;
  let sequence = 0;

  if (chain.req) {
    const r = chain.req;
    items.push(timelineItem({
      type: 'req',
      stageName: CHAIN_STAGE_LABELS.req,
      title: r.title,
      adam: r.adam,
      dateLabel: r.signedDate,
      fallbackDate: r.fetchedAt,
      cancelled: r.cancelled,
      themeKey: 'req',
      sequence: sequence++,
      fields: [
        { label: 'Π/Υ (με ΦΠΑ)', value: r.amount },
        { label: 'Αναθέτουσα', value: r.organization },
        { label: 'Τελ. λήψη', value: r.fetchedAt },
      ],
    }));
  }

  (chain.commit || []).forEach((d, i) => {
    items.push(timelineItem({
      type: 'commit',
      stageName: commitLabel(i, commitTotal),
      title: d.title,
      adam: d.adam,
      dateLabel: d.signedDate,
      fallbackDate: d.fetchedAt,
      cancelled: d.cancelled,
      themeKey: 'commit',
      commitIndex: i,
      sequence: sequence++,
      fields: [
        { label: 'Ποσό (με ΦΠΑ)', value: d.amount },
        { label: 'Αναθέτουσα', value: d.organization },
        { label: 'Τελ. λήψη', value: d.fetchedAt },
      ],
    }));
  });

  if (khmdhsNotice?.adam) {
    items.push(timelineItem({
      type: 'proc',
      stageName: CHAIN_STAGE_LABELS.proc,
      title: khmdhsNotice.title || '',
      adam: khmdhsNotice.adam,
      dateLabel: khmdhsNotice.documentDateLabel || khmdhsNotice.signedDateLabel || '',
      fallbackDate: khmdhsNotice.submissionDateLabel || '',
      cancelled: khmdhsNotice.cancelled,
      themeKey: 'proc',
      fields: [
        { label: 'Ημ. έκδοσης', value: khmdhsNotice.signedDateLabel },
        { label: 'Καταχώριση ΚΗΜΔΗΣ', value: khmdhsNotice.submissionDateLabel },
        { label: 'Προθεσμία', value: khmdhsNotice.deadlineLabel },
        { label: 'Τελ. λήψη', value: khmdhsNotice.fetchedAtLabel },
      ],
    }));
  }

  if (chain.awrd) {
    const a = chain.awrd;
    items.push(timelineItem({
      type: 'awrd',
      stageName: CHAIN_STAGE_LABELS.awrd,
      title: a.title,
      adam: a.adam,
      dateLabel: a.awardDate,
      fallbackDate: a.fetchedAt,
      cancelled: a.cancelled,
      themeKey: 'awrd',
      fields: [
        { label: 'Ανάδοχος', value: a.contractor },
        { label: 'Ποσό κατακύρωσης', value: a.amount },
        { label: 'Τελ. λήψη', value: a.fetchedAt },
      ],
    }));
  }

  if (basic?.isMultipleContracts) {
    const contractRows = basic?.contracts || [];
    contractRows.forEach((c, i) => {
      if (!c.khmdhsAdam && !c.amount) return;
      const total = contractRows.length;
      items.push(timelineItem({
        type: 'symv',
        stageName: total > 1 ? `${CHAIN_STAGE_LABELS.symv} (${i + 1}/${total})` : CHAIN_STAGE_LABELS.symv,
        adam: c.khmdhsAdam,
        dateLabel: c.date,
        fallbackDate: c.khmdhsFetchedAt,
        themeKey: 'symv',
        fields: [
          { label: 'Ποσό σύμβασης', value: c.amount },
          { label: 'Ανάδοχος', value: c.khmdhsAnadoxos },
        ],
      }));
      if (parseAmountNumber(c.apeAmount) > 0) {
        items.push(timelineItem({
          type: 'ape',
          stageName: total > 1 ? `${CHAIN_STAGE_LABELS.ape} (${i + 1})` : CHAIN_STAGE_LABELS.ape,
          dateLabel: c.date,
          themeKey: 'procedure',
          fields: [{ label: 'ΑΠΕ', value: c.apeAmount }],
        }));
      }
    });
  } else if (basic?.khmdhsAdam) {
    const symvEntry = basic.khmdhsEntries?.[0];
    const symvLabel = String(symvEntry?.roleLabel || '').trim() || CHAIN_STAGE_LABELS.symv;
    items.push(timelineItem({
      type: 'symv',
      stageName: symvLabel,
      title: symvEntry?.snapshot?.title || '',
      adam: basic.khmdhsAdam,
      dateLabel: basic.contractDate ? String(basic.contractDate).slice(0, 10) : '',
      fallbackDate: basic.khmdhsContractFetchedAt,
      themeKey: 'symv',
      sequence: sequence++,
      fields: [
        { label: 'Ποσό σύμβασης', value: basic.contractAmount },
        { label: 'Ανάδοχος', value: basic.khmdhsContractSnapshot?.anadoxosName },
      ],
    }));
  }

  const suppForTimeline = (basic?.supplementaryStageEntries?.length
    ? basic.supplementaryStageEntries
    : (basic?.supplementaryContracts || []).map((c, i) => ({
      title: (basic.supplementaryContracts.length > 1
        ? `${CHAIN_STAGE_LABELS.supp} ${i + 1}`
        : CHAIN_STAGE_LABELS.supp),
      date: c.date,
      amount: c.amount,
      amountLabel: 'Ποσό',
      adam: c.khmdhsAdam,
      isExtension: false,
    })));

  suppForTimeline.forEach((entry, i) => {
    items.push(timelineItem({
      type: 'supp',
      stageName: entry.title || CHAIN_STAGE_LABELS.supp,
      adam: entry.adam || '',
      dateLabel: entry.date,
      themeKey: entry.isExtension ? 'procedure' : 'symv',
      sequence: sequence++,
      fields: [
        ...(entry.adam ? [{ label: 'ΑΔΑΜ', value: entry.adam }] : []),
        ...(entry.amount ? [{ label: entry.amountLabel || 'Ποσό', value: entry.amount }] : []),
      ],
    }));
  });

  if (!basic?.isMultipleContracts && parseAmountNumber(basic?.apeAmount) > 0) {
    items.push(timelineItem({
      type: 'ape',
      stageName: CHAIN_STAGE_LABELS.ape,
      themeKey: 'procedure',
      fields: [{ label: 'ΑΠΕ + συμπληρωματικές', value: basic.apeAmount }],
    }));
  }

  if (chain.pay?.entries?.length) {
    const payEntries = chain.pay.entries.filter((e) => e && !e.cancelled);
    const dated = payEntries
      .map((e) => ({ e, ts: parseReportDateLabel(e.signedDate) ?? 0 }))
      .sort((a, b) => b.ts - a.ts);
    const latest = dated[0]?.e || chain.pay.entries[chain.pay.entries.length - 1];
    items.push(timelineItem({
      type: 'pay',
      stageName: CHAIN_STAGE_LABELS.pay,
      adam: `${chain.pay.count} εντάλματα`,
      dateLabel: latest?.signedDate,
      themeKey: 'pay',
      fields: [
        {
          label: 'Σύνολο πληρωμών',
          value: chain.pay.displayTotalGross != null
            ? formatEuroNum(chain.pay.displayTotalGross)
            : formatEuroNum(chain.pay.countableTotalGross ?? chain.pay.totalGross),
        },
      ],
    }));
  }

  return items.sort(compareChainTimelineItems);
}

export function buildExecutiveSummaryForReport({
  basic,
  khmdhsChain,
  paymentSummary,
  completenessGaps,
  chronologicalTimeline,
  files,
  entaxeis,
  proskliseis,
  egkrisiTotal,
  epActions,
  meta,
}) {
  const chainCtx = khmdhsChain ? {
    contractor: basic?.khmdhsContractSnapshot?.anadoxosName || khmdhsChain?.awrd?.contractor || '',
    contractorVat: basic?.khmdhsContractSnapshot?.anadoxosVat || khmdhsChain?.awrd?.contractorVat || '',
  } : { contractor: '', contractorVat: '' };

  return {
    projectTitle: basic?.projectTitle || '',
    subprojectTitle: basic?.subprojectTitle || '',
    projectStatus: basic?.projectStatus || '',
    characterization: basic?.characterization || '',
    projectType: basic?.projectType || '',
    implementationForm: basic?.implementationForm || '',
    fundingSource: basic?.fundingSource || '',
    approvedAmount: basic?.approvedAmount || '',
    projectBudget: basic?.projectBudget || '',
    contractAmountLabel: paymentSummary?.contractAmountLabel || '—',
    paidAmountLabel: paymentSummary?.paidAmountLabel || '—',
    remainingLabel: paymentSummary?.remainingLabel || '—',
    percentPaidLabel: paymentSummary?.percentPaidLabel || '—',
    paymentCount: paymentSummary?.paymentCount || 0,
    contractor: chainCtx.contractor,
    contractorVat: chainCtx.contractorVat,
    supervisor: basic?.displayChargePrimary || '',
    assistants: basic?.displayChargeParticipants || '',
    aleCodes: (basic?.aleCodes || []).filter(Boolean).join(' · '),
    khmdhsAdam: basic?.khmdhsAdam || '',
    completenessCount: (completenessGaps || []).length,
    timelinePreview: (chronologicalTimeline || []).slice(0, 10),
    counts: {
      files: files?.totalCount || 0,
      entaxeis: entaxeis?.length || 0,
      proskliseis: proskliseis?.length || 0,
      egkriseis: egkrisiTotal || 0,
      epActions: epActions?.length || 0,
      khmdhsStages: (chronologicalTimeline || []).length,
    },
    isPublishedToPortal: !!meta?.isPublishedToPortal,
    updatedAt: basic?.updatedAt || '',
  };
}
