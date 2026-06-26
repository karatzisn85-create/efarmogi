import React, { useMemo } from 'react';
import styled from 'styled-components';
import KhmdhsStageCard from './KhmdhsStageCard';
import KhmdhsRequestDisplay from './KhmdhsRequestDisplay';
import KhmdhsCommitmentDisplay from './KhmdhsCommitmentDisplay';
import KhmdhsNoticeDisplay from './KhmdhsNoticeDisplay';
import KhmdhsAwardDisplay from './KhmdhsAwardDisplay';
import KhmdhsContractDetailDisplay from './KhmdhsContractDetailDisplay';
import KhmdhsSupplementaryDisplay from './KhmdhsSupplementaryDisplay';
import KhmdhsPaymentsDisplay from './KhmdhsPaymentsDisplay';
import KhmdhsSymvChainTimeline from './KhmdhsSymvChainTimeline';
import KhmdhsApeDisplay from './KhmdhsApeDisplay';
import { getKhmdhsDisplayEntries } from '../utils/khmdhsFields';
import {
  projectHasKhmdhsRequestData,
  buildKhmdhsRequestCardSummary,
  pickKhmdhsRequestSnapshot,
} from '../utils/khmdhsRequestFields';
import { projectHasKhmdhsNoticeData, buildKhmdhsNoticeCardSummary } from '../utils/khmdhsNoticeFields';
import {
  projectHasKhmdhsAwardData,
  buildKhmdhsAwardCardSummary,
  pickKhmdhsAwardSnapshot,
} from '../utils/khmdhsAwardFields';
import {
  projectHasKhmdhsCommitmentData,
  projectHasKhmdhsPaymentData,
  getKhmdhsPaymentEntries,
  buildKhmdhsCommitmentCardSummary,
  buildKhmdhsPaymentsTotals,
  collectKhmdhsCommitmentDecisions,
} from '../utils/khmdhsChainExtraFields';
import { buildKhmdhsContractCardSummary } from '../utils/khmdhsContractDisplayFields';
import {
  getKhmdhsSupplementaryStageEntries,
  projectHasKhmdhsSupplementaryData,
  buildKhmdhsSupplementaryCardSummary,
  buildSupplementaryStageTitle,
  isSupplementaryApeEligible,
} from '../utils/khmdhsSupplementaryStageEntries';
import { LIFECYCLE_STAGE_META } from '../utils/khmdhsLifecycleStages';
import { isMultipleContractsForm } from '../utils/khmdhsFields';
import {
  buildApeCardSummary,
  buildApeSummarySuffix,
  formatApeAmountDisplay,
  hasApeEntryData,
  listContractApeEntries,
  getLatestContractApeAmount,
  hasSupplementaryApe,
  readContractApeFields,
  readSupplementaryApeFields,
  readApeFileRef,
  shouldShowApeSubCard,
} from '../utils/khmdhsApeEntry';
import KhmdhsApeEntryButton from './KhmdhsApeEntryButton';

export function projectHasKhmdhsFormResults(project) {
  if (!project) return false;
  return (
    projectHasKhmdhsRequestData(project)
    || projectHasKhmdhsCommitmentData(project)
    || projectHasKhmdhsNoticeData(project)
    || projectHasKhmdhsAwardData(project)
    || getKhmdhsDisplayEntries(project).length > 0
    || projectHasKhmdhsSupplementaryData(project)
    || projectHasKhmdhsPaymentData(project)
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildReqSummary(project) {
  const s = buildKhmdhsRequestCardSummary(project?.khmdhsRequestSnapshot);
  if (!s) return '';
  const parts = [s.title, s.amount].filter(Boolean);
  return parts.join(' · ');
}

function buildCommitSummary(project) {
  const decisions = collectKhmdhsCommitmentDecisions(project).filter((d) => d?.snapshot);
  if (decisions.length === 0) {
    const s = buildKhmdhsCommitmentCardSummary(project?.khmdhsCommitmentSnapshot);
    if (!s) return '';
    return [s.title, s.amount].filter(Boolean).join(' · ');
  }
  if (decisions.length === 1) {
    const s = buildKhmdhsCommitmentCardSummary(decisions[0].snapshot);
    if (!s) return '';
    return [s.title, s.amount].filter(Boolean).join(' · ');
  }
  return `${decisions.length} αποφάσεις ανάληψης υποχρέωσης`;
}

function buildProcSummary(project) {
  const s = buildKhmdhsNoticeCardSummary(project?.khmdhsNoticeSnapshot);
  if (!s) return '';
  const parts = [s.procedure, s.amount].filter(Boolean);
  return parts.join(' · ');
}

function buildAwrdSummary(project) {
  const snap = pickKhmdhsAwardSnapshot
    ? pickKhmdhsAwardSnapshot(project?.khmdhsAwardSnapshot)
    : project?.khmdhsAwardSnapshot;
  const s = buildKhmdhsAwardCardSummary(snap);
  if (!s) return '';
  const parts = [s.contractor, s.amount, s.awardDate].filter(Boolean);
  return parts.join(' · ');
}

function buildSymvSummary(entry, project, arrayIndex) {
  const s = buildKhmdhsContractCardSummary(entry?.snapshot, { storedAmount: entry?.storedAmount || '' });
  const parts = [];
  if (s?.title) parts.push(s.title);
  if (s?.contractor) parts.push(s.contractor);
  const apeTarget = { kind: 'contract', arrayIndex };
  if (!hasApeEntryData(project, apeTarget)) {
    const apeSuffix = buildApeSummarySuffix(project, apeTarget);
    if (apeSuffix) {
      parts.push(apeSuffix);
    } else if (s?.amount) {
      parts.push(s.amount);
    }
  } else if (s?.amount) {
    parts.push(s.amount);
  }
  if (s?.signedDate) parts.push(s.signedDate);
  return parts.join(' · ');
}

function buildSymvStageTitle(entry, idx, total) {
  const rl = String(entry?.roleLabel || '').trim().replace(/\s*\(επιλεγμένη\)/i, '').trim();
  if (rl) return rl;
  return total > 1
    ? `Σύμβαση ${entry.contractIndex != null ? entry.contractIndex : idx + 1}`
    : 'Σύμβαση';
}

function buildPaySummary(project) {
  const totals = buildKhmdhsPaymentsTotals(project);
  if (!totals.count) return '';
  const amtStr = totals.rawTotalGross != null
    ? `${totals.rawTotalGross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '';
  const parts = [`${totals.count} ένταλμα${totals.count !== 1 ? 'τα' : ''}`, amtStr].filter(Boolean);
  return parts.join(' · ');
}

// ── Styled ───────────────────────────────────────────────────────────────────

const ResultsShell = styled.div`
  margin-top: 0.5rem;
`;

const CardStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: #334155;
  letter-spacing: 0.01em;
  margin-bottom: 0.4rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
`;

/**
 * Αποτελέσματα ΚΗΜΔΗΣ στη φόρμα — ξεχωριστά ανά στάδιο (REQ → PROC → AWRD → SYMV).
 *
 * @param {{
 *   project: object,
 *   canEditApe?: boolean,
 *   onOpenApeEntry?: (target: object) => void,
 * }} props
 */
export default function KhmdhsFormStageResults({ project, canEditApe = false, onOpenApeEntry }) {
  const contractEntries = useMemo(() => getKhmdhsDisplayEntries(project), [project]);
  const supplementaryEntries = useMemo(
    () => getKhmdhsSupplementaryStageEntries(project),
    [project]
  );
  const hasResults = projectHasKhmdhsFormResults(project);

  const commitDecisions = useMemo(
    () => collectKhmdhsCommitmentDecisions(project),
    [project]
  );

  if (!hasResults) return null;

  let stepCounter = 0;
  const nextStep = () => { stepCounter += 1; return stepCounter; };

  return (
    <ResultsShell>
      <SectionHeader>
        <span>🔗</span>
        <span>Αποτελέσματα από ΚΗΜΔΗΣ</span>
      </SectionHeader>

      <CardStack>
        {/* ── REQ — Πρωτογενές αίτημα ──────────────────────────────── */}
        {projectHasKhmdhsRequestData(project) && (
          <KhmdhsStageCard
            stageType="REQ"
            icon={LIFECYCLE_STAGE_META.REQ.icon}
            title="Πρωτογενές αίτημα"
            adam={project.khmdhsRequestAdam}
            stepNumber={nextStep()}
            statusLabel={pickKhmdhsRequestSnapshot(project.khmdhsRequestSnapshot) ? 'Ανακτήθηκε' : undefined}
            statusOk={!!pickKhmdhsRequestSnapshot(project.khmdhsRequestSnapshot)}
            summary={buildReqSummary(project)}
            scrollId="stage-REQ"
          >
            <KhmdhsRequestDisplay project={project} variant="detail" />
          </KhmdhsStageCard>
        )}

        {/* ── COMMIT — Απόφαση(εις) ανάληψης υποχρέωσης ───────────── */}
        {commitDecisions.length > 0 && (
          <KhmdhsStageCard
            stageType="COMMIT"
            icon={LIFECYCLE_STAGE_META.COMMIT.icon}
            title={commitDecisions.length > 1
              ? `Αποφάσεις ανάληψης (${commitDecisions.length})`
              : 'Απόφαση ανάληψης υποχρέωσης'}
            adam={commitDecisions.length === 1 ? (commitDecisions[0].adam || '') : ''}
            stepNumber={nextStep()}
            statusLabel="Ανακτήθηκε"
            statusOk
            summary={buildCommitSummary(project)}
            scrollId="stage-COMMIT"
          >
            <KhmdhsCommitmentDisplay project={project} variant="detail" />
          </KhmdhsStageCard>
        )}

        {/* ── PROC — Δημοσίευση ────────────────────────────────────── */}
        {projectHasKhmdhsNoticeData(project) && (
          <KhmdhsStageCard
            stageType="PROC"
            icon={LIFECYCLE_STAGE_META.PROC.icon}
            title={LIFECYCLE_STAGE_META.PROC.label}
            adam={project.khmdhsNoticeAdam}
            stepNumber={nextStep()}
            statusLabel="Ανακτήθηκε"
            statusOk
            summary={buildProcSummary(project)}
            scrollId="stage-PROC"
          >
            <KhmdhsNoticeDisplay project={project} variant="detail" />
          </KhmdhsStageCard>
        )}

        {/* ── AWRD — Ανάθεση ────────────────────────────────────────── */}
        {projectHasKhmdhsAwardData(project) && (
          <KhmdhsStageCard
            stageType="AWRD"
            icon={LIFECYCLE_STAGE_META.AWRD.icon}
            title="Ανάθεση"
            adam={project.khmdhsAwardAdam}
            stepNumber={nextStep()}
            statusLabel="Ανακτήθηκε"
            statusOk
            summary={buildAwrdSummary(project)}
            scrollId="stage-AWRD"
          >
            <KhmdhsAwardDisplay project={project} variant="detail" />
          </KhmdhsStageCard>
        )}

        {/* ── SYMV — Σύμβαση / Συμβάσεις ───────────────────────────── */}
        {contractEntries.map((entry, idx) => {
          const step = nextStep();
          const arrayIndex = isMultipleContractsForm(project?.implementationForm) ? idx : 0;
          const summary = buildSymvSummary(entry, project, arrayIndex);
          const label = buildSymvStageTitle(entry, idx, contractEntries.length);
          const apeTarget = { kind: 'contract', arrayIndex, title: label };
          const apeEntries = listContractApeEntries(project, arrayIndex);
          const latestApeFmt = formatApeAmountDisplay(getLatestContractApeAmount(project, arrayIndex));
          const hasApeEntries = apeEntries.length > 0;
          const openNewApe = () => onOpenApeEntry?.({ ...apeTarget, entryId: null });
          return (
            <React.Fragment key={entry.contractIndex ?? `symv-${idx}`}>
              <KhmdhsStageCard
                stageType="SYMV"
                icon={LIFECYCLE_STAGE_META.SYMV.icon}
                title={label}
                adam={entry.adam || (entry.snapshot?.referenceNumber ?? '')}
                stepNumber={step}
                statusLabel={hasApeEntries && latestApeFmt ? `ΑΠΕ ${latestApeFmt} €` : (entry.snapshot ? 'Ενεργή' : undefined)}
                statusOk={!!entry.snapshot && !entry.snapshot?.cancelled}
                statusWarn={!!entry.snapshot?.cancelled}
                summary={summary}
                scrollId={`stage-SYMV-${idx}`}
                headerAction={canEditApe && onOpenApeEntry ? (
                  <KhmdhsApeEntryButton
                    hasApe={false}
                    shortLabel="+"
                    title="Νέος ΑΠΕ"
                    onClick={openNewApe}
                  />
                ) : null}
              >
                <KhmdhsContractDetailDisplay
                  entry={entry}
                  variant="detail"
                  apeAmount={hasApeEntries ? '' : ''}
                  khmdhsAmount={entry.storedAmount || ''}
                  apeFileName=""
                />
                {idx === 0 && project?.khmdhsSymvChainPlan?.items?.length > 0 && (
                  <KhmdhsSymvChainTimeline project={project} />
                )}
              </KhmdhsStageCard>
              {apeEntries.map((apeEntry, apeIdx) => {
                const entryTarget = { ...apeTarget, entryId: apeEntry.id };
                const entryFields = readContractApeFields(project, arrayIndex, apeEntry.id);
                const entryFmt = formatApeAmountDisplay(entryFields.apeAmount);
                const apeTitleDate = entryFields.documentDate
                  ? new Date(`${entryFields.documentDate}T12:00:00`).toLocaleDateString('el-GR')
                  : '';
                const apeCardTitle = apeTitleDate
                  ? `ΑΠΕ — ${label} (${apeTitleDate})`
                  : (apeEntries.length > 1 ? `ΑΠΕ — ${label} ${apeIdx + 1}` : `ΑΠΕ — ${label}`);
                return (
                  <KhmdhsStageCard
                    key={apeEntry.id}
                    nested
                    stageType="APE"
                    icon="📑"
                    title={apeCardTitle}
                    adam={entryFields.diavgeiaAda || entryFields.sourceAdam || ''}
                    statusLabel={entryFmt ? `${entryFmt} €` : 'καταχωρημένο'}
                    statusOk
                    summary={buildApeCardSummary(project, entryTarget)}
                    scrollId={`stage-APE-contract-${idx}-${apeEntry.id}`}
                    headerAction={canEditApe && onOpenApeEntry ? (
                      <KhmdhsApeEntryButton
                        hasApe
                        shortLabel="✎"
                        title="Επεξεργασία ΑΠΕ"
                        onClick={() => onOpenApeEntry?.(entryTarget)}
                      />
                    ) : null}
                  >
                    <KhmdhsApeDisplay
                      project={project}
                      target={entryTarget}
                      parentTitle={label}
                      variant="detail"
                    />
                  </KhmdhsStageCard>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* ── SUPP — Συμπληρωματικές συμβάσεις ───────────────────────── */}
        {supplementaryEntries.map((entry, idx) => {
          const summaryBase = buildKhmdhsSupplementaryCardSummary(entry);
          const apeTarget = { kind: 'supplementary', arrayIndex: idx };
          const apeEligible = isSupplementaryApeEligible(entry);
          const showApeCard = shouldShowApeSubCard(project, apeTarget, entry);
          const apeSuffix = apeEligible && !showApeCard ? buildApeSummarySuffix(project, apeTarget) : '';
          const summary = [summaryBase, apeSuffix].filter(Boolean).join(' · ');
          const title = buildSupplementaryStageTitle(entry);
          const showApeButton = canEditApe && onOpenApeEntry && apeEligible;
          const hasApe = apeEligible && hasSupplementaryApe(project, idx);
          const { apeAmount } = readSupplementaryApeFields(project, idx);
          const apeFmt = formatApeAmountDisplay(apeAmount);
          const openApe = () => onOpenApeEntry?.({ ...apeTarget, title });
          return (
            <React.Fragment key={`SUPP-${entry.adam || idx}`}>
              <KhmdhsStageCard
                stageType="SUPP"
                icon={LIFECYCLE_STAGE_META.SUPP.icon}
                title={title}
                stepNumber={nextStep()}
                statusLabel={apeEligible && hasApe && apeFmt ? `ΑΠΕ ${apeFmt} €` : (entry.adam || 'καταχωρημένη')}
                statusOk
                summary={summary}
                scrollId={`stage-SUPP-${idx}`}
                headerAction={showApeButton ? (
                  <KhmdhsApeEntryButton
                    hasApe={showApeCard}
                    shortLabel="ΑΠΕ"
                    title={showApeCard ? 'Επεξεργασία ΑΠΕ' : 'Καταχώριση ΑΠΕ'}
                    onClick={openApe}
                  />
                ) : null}
              >
                <KhmdhsSupplementaryDisplay entry={entry} variant="detail" />
              </KhmdhsStageCard>
              {showApeCard ? (
                <KhmdhsStageCard
                  nested
                  stageType="APE"
                  icon="📑"
                  title={`ΑΠΕ — ${title}`}
                  adam={readSupplementaryApeFields(project, idx).diavgeiaAda
                    || readSupplementaryApeFields(project, idx).sourceAdam
                    || ''}
                  statusLabel={apeFmt ? `${apeFmt} €` : 'καταχωρημένο'}
                  statusOk
                  summary={buildApeCardSummary(project, apeTarget)}
                  scrollId={`stage-APE-supp-${idx}`}
                  headerAction={showApeButton ? (
                    <KhmdhsApeEntryButton
                      hasApe
                      shortLabel="✎"
                      title="Επεξεργασία ΑΠΕ"
                      onClick={openApe}
                    />
                  ) : null}
                >
                  <KhmdhsApeDisplay
                    project={project}
                    target={apeTarget}
                    parentTitle={title}
                    variant="detail"
                  />
                </KhmdhsStageCard>
              ) : null}
            </React.Fragment>
          );
        })}

        {/* ── PAY — Εντάλματα πληρωμής ─────────────────────────────── */}
        {projectHasKhmdhsPaymentData(project) && (
          <KhmdhsStageCard
            stageType="PAY"
            icon={LIFECYCLE_STAGE_META.PAY.icon}
            title="Εντάλματα πληρωμής"
            stepNumber={nextStep()}
            statusLabel={`${getKhmdhsPaymentEntries(project).length} εντάλματα`}
            statusOk
            summary={buildPaySummary(project)}
            scrollId="stage-PAY"
          >
            <KhmdhsPaymentsDisplay project={project} variant="detail" />
          </KhmdhsStageCard>
        )}
      </CardStack>
    </ResultsShell>
  );
}
