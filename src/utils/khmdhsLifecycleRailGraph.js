/**
 * Πλήρης γραφική αλυσίδα ΚΗΜΔΗΣ — κύριοι και δευτερεύοντες κρίκοι (ΑΠΕ κ.λπ.).
 */

import { getKhmdhsDisplayEntries, isMultipleContractsForm } from './khmdhsFields';
import {
  LIFECYCLE_STAGE_META,
  buildKhmdhsLifecycleStages,
} from './khmdhsLifecycleStages';
import { collectKhmdhsCommitmentDecisions, getKhmdhsPaymentEntries } from './khmdhsChainExtraFields';
import {
  getKhmdhsSupplementaryStageEntries,
  buildSupplementaryStageTitle,
  isSupplementaryApeEligible,
} from './khmdhsSupplementaryStageEntries';
import {
  formatApeAmountDisplay,
  readContractApeFields,
  readSupplementaryApeFields,
  shouldShowApeSubCard,
} from './khmdhsApeEntry';

const APE_META = {
  id: 'APE',
  label: 'ΑΠΕ',
  shortLabel: 'ΑΠΕ',
  icon: '📑',
  accent: '#0d9488',
  accentDark: '#0f766e',
  bg: '#ecfdf5',
  border: 'rgba(13, 148, 136, 0.38)',
};

function nodeStatusFromBase(stage) {
  if (stage?.cancelled) return 'cancelled';
  if (stage?.status === 'skipped') return 'skipped';
  if (stage?.has || stage?.status === 'complete') return 'complete';
  if (stage?.status === 'current') return 'current';
  return 'pending';
}

function makeNode({
  key,
  stageId,
  tier = 'primary',
  label,
  shortLabel,
  icon,
  meta,
  adam = '',
  badge = '',
  scrollId = '',
  status = 'complete',
  parentKey = '',
}) {
  const m = meta || LIFECYCLE_STAGE_META[stageId] || APE_META;
  return {
    key,
    stageId,
    tier,
    label: label || m.label,
    shortLabel: shortLabel || m.shortLabel,
    icon: icon || m.icon,
    accent: m.accent,
    accentDark: m.accentDark,
    bg: m.bg,
    border: m.border,
    adam: String(adam || '').trim(),
    badge: String(badge || '').trim(),
    scrollId: scrollId || '',
    status,
    parentKey,
    clickable: status === 'complete' || status === 'current',
  };
}

function buildSymvTitle(entry, idx, total) {
  const rl = String(entry?.roleLabel || '').trim().replace(/\s*\(επιλεγμένη\)/i, '').trim();
  if (rl) return rl;
  return total > 1
    ? `Σύμβαση ${entry.contractIndex != null ? entry.contractIndex : idx + 1}`
    : 'Σύμβαση';
}

function buildApeSecondaryNode(project, target, parentKey, parentTitle, stageEntry = null) {
  if (target.kind === 'supplementary' && stageEntry && !isSupplementaryApeEligible(stageEntry)) {
    return null;
  }
  if (!shouldShowApeSubCard(project, target, stageEntry)) return null;

  const fields = target.kind === 'supplementary'
    ? readSupplementaryApeFields(project, target.arrayIndex)
    : readContractApeFields(project, target.arrayIndex);
  const apeFmt = formatApeAmountDisplay(fields.apeAmount);
  const scrollSuffix = target.kind === 'supplementary'
    ? `supp-${target.arrayIndex}`
    : `contract-${target.arrayIndex}`;

  return makeNode({
    key: `${parentKey}::ape`,
    stageId: 'APE',
    tier: 'secondary',
    label: `ΑΠΕ — ${parentTitle}`,
    shortLabel: 'ΑΠΕ',
    icon: '📑',
    meta: APE_META,
    adam: fields.diavgeiaAda || fields.sourceAdam || '',
    badge: apeFmt ? `${apeFmt} €` : '',
    scrollId: `stage-APE-${scrollSuffix}`,
    status: 'complete',
    parentKey,
  });
}

/**
 * @returns {Array<{ key: string, primary: object, secondaries: object[] }>}
 */
export function buildKhmdhsLifecycleRailColumns(project) {
  if (!project) return [];

  const baseStages = buildKhmdhsLifecycleStages(project);
  const columns = [];

  const pushPrimary = (node, secondaries = []) => {
    columns.push({
      key: node.key,
      primary: node,
      secondaries: secondaries.filter(Boolean),
    });
  };

  baseStages.forEach((stage) => {
    if (stage.id === 'COMMIT' && stage.has) {
      const decisions = collectKhmdhsCommitmentDecisions(project);
      if (decisions.length > 1) {
        decisions.forEach((d, i) => {
          const adam = String(d.adam || d.snapshot?.referenceNumber || '').trim();
          pushPrimary(makeNode({
            key: `COMMIT-${i}`,
            stageId: 'COMMIT',
            label: decisions.length > 1 ? `Ανάληψη ${i + 1}` : stage.label,
            shortLabel: decisions.length > 1 ? `Ανάλ. ${i + 1}` : stage.shortLabel,
            adam,
            scrollId: 'stage-COMMIT',
            status: nodeStatusFromBase(stage),
          }));
        });
        return;
      }
    }

    if (stage.id === 'SYMV' && stage.has) {
      const entries = getKhmdhsDisplayEntries(project);
      const list = entries.length ? entries : [{ adam: stage.adam, snapshot: project?.khmdhsContractSnapshot }];
      list.forEach((entry, idx) => {
        const arrayIndex = isMultipleContractsForm(project?.implementationForm) ? idx : 0;
        const title = buildSymvTitle(entry, idx, list.length);
        const adam = String(entry.adam || entry.snapshot?.referenceNumber || '').trim();
        const parentKey = `SYMV-${idx}`;
        const apeTarget = { kind: 'contract', arrayIndex, title };
        const apeNode = buildApeSecondaryNode(project, apeTarget, parentKey, title);
        pushPrimary(makeNode({
          key: parentKey,
          stageId: 'SYMV',
          label: title,
          shortLabel: list.length > 1 ? `Συμβ. ${idx + 1}` : stage.shortLabel,
          adam,
          scrollId: `stage-SYMV-${idx}`,
          status: nodeStatusFromBase(stage),
        }), apeNode ? [apeNode] : []);
      });
      return;
    }

    if (stage.id === 'SUPP' && stage.has) {
      const entries = getKhmdhsSupplementaryStageEntries(project);
      entries.forEach((entry, idx) => {
        const title = buildSupplementaryStageTitle(entry);
        const parentKey = `SUPP-${idx}`;
        const apeTarget = { kind: 'supplementary', arrayIndex: idx, title };
        const apeNode = buildApeSecondaryNode(project, apeTarget, parentKey, title, entry);
        pushPrimary(makeNode({
          key: parentKey,
          stageId: 'SUPP',
          label: title,
          shortLabel: entry.isExtension ? 'Παράτ.' : 'Συμπλ.',
          icon: entry.isExtension ? '⏱️' : '➕',
          adam: entry.adam || '',
          scrollId: `stage-SUPP-${idx}`,
          status: 'complete',
        }), apeNode ? [apeNode] : []);
      });
      return;
    }

    if (stage.id === 'PAY' && stage.has) {
      const payments = getKhmdhsPaymentEntries(project);
      if (payments.length > 1) {
        payments.forEach((p, i) => {
          const adam = String(p.adam || p.snapshot?.referenceNumber || '').trim();
          pushPrimary(makeNode({
            key: `PAY-${i}`,
            stageId: 'PAY',
            label: `Ένταλμα ${i + 1}`,
            shortLabel: `Εντ. ${i + 1}`,
            adam,
            scrollId: 'stage-PAY',
            status: nodeStatusFromBase(stage),
          }));
        });
        return;
      }
    }

    const scrollId = stage.id === 'COMMIT' ? 'stage-COMMIT'
      : stage.id === 'PAY' ? 'stage-PAY'
      : stage.id === 'SYMV' ? 'stage-SYMV-0'
      : `stage-${stage.id}`;

    pushPrimary(makeNode({
      key: stage.id,
      stageId: stage.id,
      label: stage.label,
      shortLabel: stage.shortLabel,
      icon: stage.icon,
      adam: stage.adam || '',
      badge: stage.extraLabel || '',
      scrollId,
      status: nodeStatusFromBase(stage),
    }));
  });

  return columns;
}

export function countKhmdhsLifecycleRailNodes(columns) {
  const list = Array.isArray(columns) ? columns : [];
  return list.reduce((n, col) => n + 1 + (col.secondaries?.length || 0), 0);
}
