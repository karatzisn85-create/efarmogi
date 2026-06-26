import React from 'react';
import styled from 'styled-components';

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: ${(p) => (p.$compact ? '0.58rem' : '0.65rem')};
  font-weight: 800;
  letter-spacing: 0.02em;
  padding: ${(p) => (p.$compact ? '2px 6px' : '3px 8px')};
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid ${(p) => (p.$level === 'red' ? '#fecaca' : '#fde68a')};
  background: ${(p) => (p.$level === 'red' ? '#fef2f2' : '#fffbeb')};
  color: ${(p) => (p.$level === 'red' ? '#b91c1c' : '#b45309')};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
`;

export default function KhmdhsFreshnessBadge({ freshness, compact = false, title }) {
  if (!freshness || freshness.level === 'none') return null;
  const tip = title || freshness.label || '';
  const short = freshness.level === 'red'
    ? (freshness.days != null ? `↻ ${freshness.days}η` : '↻!')
    : (freshness.days != null ? `↻ ${freshness.days}η` : '↻');
  return (
    <Badge $level={freshness.level} $compact={compact} title={tip}>
      {freshness.level === 'red' ? '🔴' : '🟡'} {short}
    </Badge>
  );
}
