import React, { useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  buildKhmdhsNoticeCardSummary,
  buildKhmdhsNoticeDisplayGroups,
  formatKhmdhsEuro,
  noticeDrivesAssignmentProcedure,
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData
} from '../utils/khmdhsNoticeFields';
import { openExternalUrl } from '../utils/openExternalUrl';
import {
  formatDeadlineCountdownLabel,
  getProcurementDeadlineInfo,
  projectProcurementPhaseConcluded
} from '../utils/procurementDeadlines';
import { publicationDocumentLabel } from '../utils/khmdhsDocumentRegistry';
import { computeKhmdhsContractVariance } from '../utils/khmdhsExportFields';

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Panel = styled.div`
  border-radius: ${(p) => (p.$compact ? '10px' : '14px')};
  background: linear-gradient(145deg, #ecfdf5 0%, #f0fdf4 35%, #f8fafc 100%);
  border: 1px solid rgba(16, 185, 129, 0.35);
  box-shadow: ${(p) => (p.$compact
    ? '0 2px 8px rgba(16, 185, 129, 0.08)'
    : '0 4px 18px rgba(16, 185, 129, 0.12)')};
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: ${(p) => (p.$compact ? '0.55rem 0.65rem' : '0.85rem 1rem')};
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(255, 255, 255, 0.5) 100%);
  border-bottom: 1px solid rgba(16, 185, 129, 0.2);
`;

const HeaderMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeaderTitle = styled.div`
  font-weight: 800;
  font-size: ${(p) => (p.$compact ? '0.78rem' : '0.92rem')};
  color: #065f46;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const HeaderSub = styled.div`
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
`;

const AdamBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  background: #fff;
  border: 1px solid rgba(16, 185, 129, 0.35);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  color: #047857;
  letter-spacing: 0.02em;
`;

const DeadlineCountdownBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  margin-left: 0.35rem;
  white-space: nowrap;
  flex-shrink: 0;
  color: ${(p) => {
    if (p.$kind === 'cancelled') return '#991b1b';
    if (p.$urgency === 'past') return '#64748b';
    if (p.$urgency === 'urgent') return '#b91c1c';
    if (p.$urgency === 'soon') return '#b45309';
    return '#047857';
  }};
  background: ${(p) => {
    if (p.$kind === 'cancelled') return '#fef2f2';
    if (p.$urgency === 'past') return '#f1f5f9';
    if (p.$urgency === 'urgent') return '#fef2f2';
    if (p.$urgency === 'soon') return '#fffbeb';
    return '#ecfdf5';
  }};
  border: 1px solid ${(p) => {
    if (p.$kind === 'cancelled') return 'rgba(239, 68, 68, 0.35)';
    if (p.$urgency === 'past') return 'rgba(148, 163, 184, 0.45)';
    if (p.$urgency === 'urgent') return 'rgba(239, 68, 68, 0.35)';
    if (p.$urgency === 'soon') return 'rgba(245, 158, 11, 0.45)';
    return 'rgba(16, 185, 129, 0.35)';
  }};
`;

const ExpandBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.45rem;
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 8px;
  background: #fff;
  color: #047857;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    background: #ecfdf5;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  }

  &:active {
    transform: scale(0.96);
  }

  ${(p) => p.$open && css`
    background: #d1fae5;
  `}
`;

const Chevron = styled.span`
  display: inline-block;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(${(p) => (p.$open ? '180deg' : '0deg')});
  font-size: 0.85rem;
  line-height: 1;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.35rem 0.55rem;
  padding: 0.55rem 0.65rem 0.65rem;
`;

const SummaryChip = styled.div`
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(16, 185, 129, 0.18);
  font-size: 0.74rem;
  line-height: 1.35;

  ${(p) => p.$highlight && css`
    border-color: rgba(245, 158, 11, 0.45);
    background: linear-gradient(135deg, #fffbeb 0%, #fff 100%);
  `}

  ${(p) => p.$warn && css`
    border-color: rgba(239, 68, 68, 0.4);
    background: #fef2f2;
    color: #b91c1c;
    font-weight: 700;
  `}
`;

const ChipLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.1rem;
`;

const ChipValue = styled.div`
  font-weight: ${(p) => (p.$strong ? 700 : 500)};
  color: ${(p) => (p.$strong ? '#b45309' : '#0f172a')};
  word-break: break-word;
`;

const ExpandableWrap = styled.div`
  display: grid;
  grid-template-rows: ${(p) => (p.$open ? '1fr' : '0fr')};
  transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
`;

const ExpandableInner = styled.div`
  overflow: hidden;
  min-height: 0;
`;

const DetailBody = styled.div`
  padding: ${(p) => (p.$compact ? '0.5rem 0.65rem 0.65rem' : '0.75rem 1rem 1rem')};
  animation: ${fadeSlideIn} 0.28s ease-out;
`;

const GroupBlock = styled.div`
  &:not(:last-child) {
    margin-bottom: ${(p) => (p.$compact ? '0.65rem' : '0.85rem')};
    padding-bottom: ${(p) => (p.$compact ? '0.65rem' : '0.85rem')};
    border-bottom: 1px dashed rgba(16, 185, 129, 0.22);
  }
`;

const GroupTitle = styled.div`
  font-size: ${(p) => (p.$compact ? '0.72rem' : '0.78rem')};
  font-weight: 800;
  color: #047857;
  margin-bottom: 0.45rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const RowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${(p) => (p.$compact ? '160px' : '200px')}, 1fr));
  gap: 0.35rem 0.75rem;
`;

const RowItem = styled.div`
  grid-column: ${(p) => (p.$full ? '1 / -1' : 'auto')};
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-size: ${(p) => (p.$compact ? '0.74rem' : '0.8rem')};
  line-height: 1.45;

  ${(p) => p.$highlight && css`
    border-color: rgba(245, 158, 11, 0.45);
    background: linear-gradient(135deg, #fffbeb 0%, #fff 100%);
  `}
`;

const RowLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.12rem;
`;

const RowValue = styled.div`
  color: #0f172a;
  font-weight: ${(p) => (p.$badge ? 700 : p.$highlight ? 700 : 400)};
  word-break: break-word;

  ${(p) => p.$highlight && css`color: #b45309;`}

  a {
    color: #2563eb;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

function formatFetchedAt(fetchedAt) {
  if (!fetchedAt) return '';
  try {
    const d = new Date(fetchedAt);
    return Number.isNaN(d.getTime()) ? fetchedAt : d.toLocaleString('el-GR');
  } catch {
    return fetchedAt;
  }
}

const ExternalLink = styled.button`
  display: inline;
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  font: inherit;
  text-align: left;
  cursor: pointer;
  word-break: break-all;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: #1d4ed8;
  }
`;

function renderRowValue(row, onLinkClick) {
  if (row.link && row.value && /^https?:\/\//i.test(row.value)) {
    return (
      <ExternalLink
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onLinkClick) onLinkClick(e);
          openExternalUrl(row.value);
        }}
      >
        {row.value}
      </ExternalLink>
    );
  }
  return row.value;
}

function NoticeGroups({ groups, compact, onLinkClick }) {
  return groups.map((group) => (
    <GroupBlock key={group.id} $compact={compact}>
      <GroupTitle $compact={compact}>{group.icon} {group.title}</GroupTitle>
      <RowGrid $compact={compact}>
        {group.rows.map((row) => (
          <RowItem key={row.label} $full={row.fullWidth} $highlight={row.highlight}>
            <RowLabel>{row.label}</RowLabel>
            <RowValue $highlight={row.highlight} $badge={row.badge}>
              {renderRowValue(row, onLinkClick)}
            </RowValue>
          </RowItem>
        ))}
      </RowGrid>
    </GroupBlock>
  ));
}

/**
 * @param {{ project: object, variant?: 'detail'|'card', defaultExpanded?: boolean }} props
 */
export default function KhmdhsNoticeDisplay({
  project,
  variant = 'detail',
  defaultExpanded = false
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const compact = variant === 'card';

  const snapshot = useMemo(
    () => pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot),
    [project?.khmdhsNoticeSnapshot]
  );
  const procurementConcluded = useMemo(
    () => projectProcurementPhaseConcluded(project),
    [project]
  );
  const groups = useMemo(() => {
    const built = buildKhmdhsNoticeDisplayGroups(snapshot);
    if (!procurementConcluded) return built;
    return built
      .map((group) => {
        if (group.id !== 'dates') return group;
        return {
          ...group,
          rows: (group.rows || []).filter((row) => !/καταληκτική/i.test(String(row.label || '')))
        };
      })
      .filter((group) => (group.rows || []).length > 0);
  }, [snapshot, procurementConcluded]);
  const summary = useMemo(() => buildKhmdhsNoticeCardSummary(snapshot), [snapshot]);
  const publicationTitle = useMemo(
    () => publicationDocumentLabel(summary?.noticeType, 1, 1),
    [summary?.noticeType]
  );

  const deadlineInfo = useMemo(
    () => getProcurementDeadlineInfo(project),
    [project]
  );
  const countdownLabel = useMemo(
    () => formatDeadlineCountdownLabel(deadlineInfo),
    [deadlineInfo]
  );
  const contractVariance = useMemo(
    () => computeKhmdhsContractVariance(project),
    [project]
  );

  if (!projectHasKhmdhsNoticeData(project) || !snapshot || !summary) return null;

  const fetchedLabel = formatFetchedAt(project.khmdhsNoticeFetchedAt);
  const fromKhmdhs = noticeDrivesAssignmentProcedure(project);

  const countdownBadge = countdownLabel ? (
    <DeadlineCountdownBadge
      $urgency={deadlineInfo.urgency}
      $kind={deadlineInfo.kind}
      title="Καταληκτική υποβολής προσφορών (ΚΗΜΔΗΣ)"
    >
      {countdownLabel}
    </DeadlineCountdownBadge>
  ) : null;

  if (variant === 'detail') {
    return (
      <Panel $compact={compact}>
        <PanelHeader $compact={compact}>
          <HeaderMain>
            <HeaderTitle $compact={compact}>
              🌐 {publicationTitle} από ΚΗΜΔΗΣ
              {summary.adam && <AdamBadge>{summary.adam}</AdamBadge>}
              {countdownBadge}
            </HeaderTitle>
            <HeaderSub>
              {fromKhmdhs && 'Η διαδικασία ανάθεσης συμπληρώθηκε αυτόματα από τον ΑΔΑΜ.'}
              {fromKhmdhs && fetchedLabel ? ' · ' : ''}
              {fetchedLabel ? `Τελευταία λήψη: ${fetchedLabel}` : ''}
            </HeaderSub>
          </HeaderMain>
        </PanelHeader>
        <DetailBody $compact={compact}>
          <NoticeGroups groups={groups} compact={compact} />
        </DetailBody>
      </Panel>
    );
  }

  return (
    <Panel $compact>
      <PanelHeader $compact>
        <HeaderMain>
          <HeaderTitle $compact>
            🌐 {publicationTitle}
            {summary.adam && <AdamBadge>{summary.adam}</AdamBadge>}
            {countdownBadge}
          </HeaderTitle>
          {summary.title && (
            <HeaderSub style={{
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {summary.title}
            </HeaderSub>
          )}
        </HeaderMain>
        <ExpandBtn
          type="button"
          $open={expanded}
          aria-expanded={expanded}
          aria-label={expanded ? 'Σύμπτυξη στοιχείων δημοσίευσης' : 'Πλήρη στοιχεία δημοσίευσης'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <Chevron $open={expanded}>▾</Chevron>
        </ExpandBtn>
      </PanelHeader>

      <SummaryGrid onClick={(e) => e.stopPropagation()}>
        {countdownLabel && deadlineInfo.kind !== 'cancelled' && (
          <SummaryChip $highlight={deadlineInfo.urgency === 'urgent' || deadlineInfo.urgency === 'soon'}>
            <ChipLabel>Απομένουν</ChipLabel>
            <ChipValue $strong>{countdownLabel}</ChipValue>
          </SummaryChip>
        )}
        {summary.procedure ? (
          <SummaryChip>
            <ChipLabel>Διαδικασία</ChipLabel>
            <ChipValue $strong>{summary.procedure}</ChipValue>
          </SummaryChip>
        ) : summary.noticeType ? (
          <SummaryChip>
            <ChipLabel>Τύπος δημοσίευσης</ChipLabel>
            <ChipValue>{summary.noticeType}</ChipValue>
          </SummaryChip>
        ) : null}
        {summary.deadline && !procurementConcluded && (
          <SummaryChip $highlight>
            <ChipLabel>Καταληκτική</ChipLabel>
            <ChipValue $strong>{summary.deadline}</ChipValue>
          </SummaryChip>
        )}
        {summary.amount && (
          <SummaryChip>
            <ChipLabel>Εκτιμ. αξία</ChipLabel>
            <ChipValue>{summary.amount}</ChipValue>
          </SummaryChip>
        )}
        {contractVariance && (
          <SummaryChip $highlight={Math.abs(contractVariance.pct) >= 10}>
            <ChipLabel>Σύμβαση vs εκτίμηση</ChipLabel>
            <ChipValue $strong>
              {formatKhmdhsEuro(contractVariance.contract)}
              {' · '}
              {contractVariance.pct > 0 ? '+' : ''}
              {contractVariance.pct.toFixed(1)}%
            </ChipValue>
          </SummaryChip>
        )}
        {summary.cancelled && (
          <SummaryChip $warn>
            <ChipLabel>Κατάσταση</ChipLabel>
            <ChipValue>Ματαιωμένη</ChipValue>
          </SummaryChip>
        )}
      </SummaryGrid>

      <ExpandableWrap $open={expanded}>
        <ExpandableInner>
          <DetailBody $compact onClick={(e) => e.stopPropagation()}>
            <NoticeGroups groups={groups} compact />
          </DetailBody>
        </ExpandableInner>
      </ExpandableWrap>
    </Panel>
  );
}
