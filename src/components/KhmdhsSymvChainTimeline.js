import React, { useMemo } from 'react';
import styled from 'styled-components';
import { getKhmdhsDisplayEntries } from '../utils/khmdhsFields';
import { buildKhmdhsContractChainHistoryGroup } from '../utils/khmdhsContractDisplayFields';
import { formatDateEl } from '../utils/dateFormat';
import { SYMV_CHAIN_ROLE_LABELS } from '../utils/khmdhsSymvChainPlanner';

const TimelineShell = styled.div`
  margin-top: 0.35rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  border: 1px solid #cbd5e1;
`;

const TimelineTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: #334155;
  margin-bottom: 0.55rem;
`;

const StepList = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

const Step = styled.li`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.55rem;
  align-items: start;
`;

const StepIndex = styled.span`
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  font-weight: 800;
  color: #fff;
  background: ${(p) => p.$color || '#64748b'};
  flex-shrink: 0;
`;

const StepBody = styled.div`
  min-width: 0;
`;

const StepLabel = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
`;

const StepMeta = styled.div`
  margin-top: 0.12rem;
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.4;
`;

const ROLE_COLORS = {
  main: '#4f46e5',
  parallel: '#0284c7',
  supplementary: '#059669',
  extension: '#d97706',
  intermediate: '#475569',
};

function roleColorFromLabel(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('αρχική') || l.includes('κύρια')) return ROLE_COLORS.main;
  if (l.includes('συμπληρωματ')) return ROLE_COLORS.supplementary;
  if (l.includes('παράταση') || l.includes('παραταση')) return ROLE_COLORS.extension;
  if (l.includes('ενδιάμεσ') || l.includes('ενδιαμεσ')) return ROLE_COLORS.intermediate;
  if (l.includes('παράλληλ')) return ROLE_COLORS.parallel;
  return ROLE_COLORS.intermediate;
}

/**
 * Χρονολογική αλυσίδα SYMV μετά την κατανομή — ξεχωριστή προβολή ώστε να μην «χάνονται» κρίκοι.
 */
export default function KhmdhsSymvChainTimeline({ project }) {
  const rows = useMemo(() => {
    if (!project?.khmdhsSymvChainPlan?.items?.length) return [];
    const entry = getKhmdhsDisplayEntries(project)[0];
    const history = entry?.chainHistory || [];
    const group = buildKhmdhsContractChainHistoryGroup(history);
    if (!group?.rows?.length) return [];
    return group.rows.map((row, idx) => ({
      index: idx + 1,
      label: row.label,
      value: row.value,
      color: roleColorFromLabel(row.label),
    }));
  }, [project]);

  if (!rows.length) return null;

  return (
    <TimelineShell>
      <TimelineTitle>📜 Χρονολογική αλυσίδα SYMV ({rows.length} κρίκοι)</TimelineTitle>
      <StepList>
        {rows.map((row) => (
          <Step key={`${row.index}-${row.label}`}>
            <StepIndex $color={row.color}>{row.index}</StepIndex>
            <StepBody>
              <StepLabel>{row.label}</StepLabel>
              <StepMeta>{row.value}</StepMeta>
            </StepBody>
          </Step>
        ))}
      </StepList>
    </TimelineShell>
  );
}

export function buildSymvPlanRoleSummary(project) {
  const plan = project?.khmdhsSymvChainPlan;
  if (!plan?.items?.length) return '';
  const active = plan.items.filter((i) => i?.adam && i.role !== 'skip');
  const parts = active.map((i) => {
    const roleLabel = SYMV_CHAIN_ROLE_LABELS[i.role] || i.role;
    const date = String(i.date || '').slice(0, 10);
    return `${i.adam}: ${roleLabel}${date ? ` (${formatDateEl(date, '')})` : ''}`;
  });
  return parts.join(' · ');
}
