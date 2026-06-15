/** Pure helpers for Ωρίμανση Έργων (Hub, stats, search, history). */

export const PROPOSAL_STATUS_LABELS = {
  draft: 'Αρχική καταγραφή',
  maturing: 'Υπό ωρίμανση',
  ready: 'Πλήρως ώριμο',
  submitted: 'Σε διαδικασία έγκρισης',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορρίφθηκε',
};

export const PROPOSAL_ACTION_LABELS = {
  create: 'Δημιουργία',
  update: 'Ενημέρωση',
  delete: 'Διαγραφή',
  export: 'Εξαγωγή',
};

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']);

export function isImageFileName(fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  return IMAGE_EXT.has(ext);
}

export function formatDateTimeEl(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatShortDateEl(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatProposalStatusValue(value) {
  return PROPOSAL_STATUS_LABELS[value] || value || '(κενό)';
}

export function formatAuditFieldValue(fieldKey, value) {
  if (fieldKey === 'status') return formatProposalStatusValue(value);
  if (value === null || value === undefined || value === '') return '(κενό)';
  if (fieldKey === 'aepoRenewalDate') return formatShortDateEl(value);
  if (typeof value === 'string' && value.length > 120) {
    return `${value.slice(0, 117)}…`;
  }
  return String(value);
}

const PROPOSAL_FIELD_LABELS = {
  title: 'Τίτλος',
  status: 'Κατάσταση ωρίμανσης',
  projectCategory: 'Κατηγορία έργου',
  infrastructureSpecialization: 'Εξειδίκευση',
  municipalUnit: 'Δημοτική Ενότητα',
  settlement: 'Οικισμός',
  aepoRenewalDate: 'Ημερομηνία ανανέωσης ΑΕΠΟ',
  description: 'Περιγραφή',
  notes: 'Σημειώσεις',
};

export function getProposalFieldLabel(key) {
  return PROPOSAL_FIELD_LABELS[key] || key;
}

export function summarizeHistoryEntry(log) {
  if (log.details && String(log.details).trim()) return log.details;
  if (log.action === 'create') return 'Δημιουργία νέου έργου';
  if (log.action === 'delete') return 'Διαγραφή έργου';
  if (log.action === 'export') return 'Εξαγωγή έργου';
  if (log.changes && Object.keys(log.changes).length > 0) {
    const parts = Object.entries(log.changes).map(([field, change]) => {
      const label = getProposalFieldLabel(field);
      const oldV = formatAuditFieldValue(field, change.old);
      const newV = formatAuditFieldValue(field, change.new);
      return `${label}: «${oldV}» → «${newV}»`;
    });
    return parts.join(' · ');
  }
  return PROPOSAL_ACTION_LABELS[log.action] || 'Ενέργεια στο έργο';
}

/** Μετρά αρχεία μιας κατηγορίας (φάκελοι → fileCount, αρχεία → 1). */
export function countGroupFileEntries(group) {
  return (group?.files || []).reduce(
    (sum, entry) => sum + (entry?.kind === 'folder' ? (entry.fileCount || 0) : 1),
    0
  );
}

/** Συνολικός αριθμός αρχείων έργου (ίδια λογική παντού). */
export function countProposalFiles(project) {
  return (project?.fileGroups || []).reduce(
    (sum, g) => sum + countGroupFileEntries(g),
    0
  );
}

/** Fingerprint για έλεγχο μη αποθηκευμένων αλλαγών. */
export function proposalPersistFingerprint(proposal) {
  if (!proposal) return '';
  return JSON.stringify({
    title: proposal.title || '',
    status: proposal.status || '',
    projectCategory: proposal.projectCategory || '',
    infrastructureSpecialization: proposal.infrastructureSpecialization || '',
    municipalUnit: proposal.municipalUnit || '',
    settlement: proposal.settlement || '',
    aepoRenewalDate: proposal.aepoRenewalDate || '',
    description: proposal.description || '',
    notes: proposal.notes || '',
    pendingItems: proposal.pendingItems || [],
    pendingTemplateCategory: proposal.pendingTemplateCategory || '',
    fileGroups: proposal.fileGroups || [],
  });
}

/** Φίλτρο αρχείων εντός τρέχοντος έργου (tab Αρχεία). */
export function filterGroupFiles(group, query, folderIdsWithInnerMatch = null) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return group.files || [];
  const innerMatch = folderIdsWithInnerMatch instanceof Set ? folderIdsWithInnerMatch : null;
  return (group.files || []).filter((entry) => {
    if (entry.kind === 'folder') {
      const name = String(entry.name || '').toLowerCase();
      if (name.includes(q)) return true;
      if (innerMatch?.has(entry.id)) return true;
      return false;
    }
    const name = String(entry.name || entry.originalName || '').toLowerCase();
    return name.includes(q);
  });
}

export function buildDonutGradient(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return C_FALLBACK;
  let cursor = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const pct = (seg.value / total) * 100;
      const start = cursor;
      cursor += pct;
      return `${seg.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${stops.join(', ')})`;
}

const C_FALLBACK = '#e2e8f0';

export function computeExtendedHubStats(proposals, statusDefs) {
  const byStatus = {};
  const byCategory = {};
  const byMunicipalUnit = {};
  const bySettlement = {};
  let totalFiles = 0;
  let totalPending = 0;
  let totalPendingOpen = 0;
  let withAepo = 0;
  let aepoDueSoon = 0;
  let withNotes = 0;
  let withMunicipalUnit = 0;
  let withSettlement = 0;
  const aepoSoonList = [];
  const topPending = [];
  const recentlyUpdated = [];
  const soonLimit = new Date();
  soonLimit.setDate(soonLimit.getDate() + 60);
  const now = new Date();

  (proposals || []).forEach((p) => {
    const statusKey = p.status || 'draft';
    byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    const cat = String(p.projectCategory || '').trim() || 'Χωρίς κατηγορία';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const mu = String(p.municipalUnit || '').trim();
    if (mu) {
      withMunicipalUnit += 1;
      byMunicipalUnit[mu] = (byMunicipalUnit[mu] || 0) + 1;
    } else {
      byMunicipalUnit['Χωρίς δημοτική ενότητα'] = (byMunicipalUnit['Χωρίς δημοτική ενότητα'] || 0) + 1;
    }

    const settlement = String(p.settlement || '').trim();
    if (settlement) {
      withSettlement += 1;
      bySettlement[settlement] = (bySettlement[settlement] || 0) + 1;
    }

    totalFiles += countProposalFiles(p);

    const pending = p.pendingItems || [];
    const openPending = pending.filter((i) => !i.done).length;
    totalPending += pending.length;
    totalPendingOpen += openPending;

    if (String(p.notes || '').trim()) withNotes += 1;

    if (p.aepoRenewalDate) {
      withAepo += 1;
      const d = new Date(p.aepoRenewalDate);
      if (!Number.isNaN(d.getTime())) {
        if (d <= soonLimit) {
          aepoDueSoon += 1;
          aepoSoonList.push({
            id: p.id,
            title: p.title || '(Χωρίς τίτλο)',
            date: p.aepoRenewalDate,
            daysLeft: Math.ceil((d - now) / (1000 * 60 * 60 * 24)),
          });
        }
      }
    }

    if (openPending > 0) {
      topPending.push({
        id: p.id,
        title: p.title || '(Χωρίς τίτλο)',
        open: openPending,
        total: pending.length,
      });
    }

    recentlyUpdated.push({
      id: p.id,
      title: p.title || '(Χωρίς τίτλο)',
      updatedAt: p.updatedAt || p.createdAt,
    });
  });

  aepoSoonList.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  topPending.sort((a, b) => b.open - a.open || b.total - a.total);
  recentlyUpdated.sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );

  const statusDonut = (statusDefs || []).map((s) => ({
    label: s.label,
    value: byStatus[s.value] || 0,
    color: s.color,
    key: s.value,
  }));

  const categoryDonut = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: CATEGORY_DONUT_COLORS[i % CATEGORY_DONUT_COLORS.length],
      key: label,
    }));

  const municipalUnitDonut = Object.entries(byMunicipalUnit)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: CATEGORY_DONUT_COLORS[i % CATEGORY_DONUT_COLORS.length],
      key: label,
    }));

  const settlementDonut = Object.entries(bySettlement)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: CATEGORY_DONUT_COLORS[(i + 3) % CATEGORY_DONUT_COLORS.length],
      key: label,
    }));

  return {
    total: proposals.length,
    byStatus,
    byCategory,
    byMunicipalUnit,
    bySettlement,
    totalFiles,
    totalPending,
    totalPendingOpen,
    withAepo,
    aepoDueSoon,
    withNotes,
    withMunicipalUnit,
    withSettlement,
    maturing: proposals.filter((p) => p.status === 'maturing' || p.status === 'draft').length,
    ready: proposals.filter((p) => p.status === 'ready').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
    submitted: proposals.filter((p) => p.status === 'submitted').length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
    aepoSoonList,
    topPending: topPending.slice(0, 8),
    recentlyUpdated: recentlyUpdated.slice(0, 8),
    statusDonut,
    categoryDonut,
    municipalUnitDonut,
    settlementDonut,
  };
}

const CATEGORY_DONUT_COLORS = [
  '#6366f1', '#0d9488', '#f59e0b', '#7c3aed', '#10b981',
  '#f43f5e', '#2563eb', '#64748b',
];
