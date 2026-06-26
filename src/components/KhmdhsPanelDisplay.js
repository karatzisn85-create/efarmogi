import React, { useMemo, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const KHMDHS_PANEL_THEMES = {
  request: {
    accent: '#4338ca',
    accentDark: '#3730a3',
    bg: 'linear-gradient(145deg, #eef2ff 0%, #f5f3ff 35%, #f8fafc 100%)',
    border: 'rgba(99, 102, 241, 0.35)',
    headerBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(255, 255, 255, 0.5) 100%)',
    headerBorder: 'rgba(99, 102, 241, 0.2)',
    groupTitle: '#4338ca',
    badgeBorder: 'rgba(99, 102, 241, 0.35)',
    badgeColor: '#4338ca',
    btnBorder: 'rgba(99, 102, 241, 0.4)',
    btnColor: '#4338ca',
    btnHover: '#eef2ff',
    btnOpen: '#e0e7ff',
    groupBorder: 'rgba(99, 102, 241, 0.22)',
    chipBorder: 'rgba(99, 102, 241, 0.18)',
    shadow: 'rgba(99, 102, 241, 0.12)',
    shadowCompact: 'rgba(99, 102, 241, 0.08)',
  },
  contract: {
    accent: '#b45309',
    accentDark: '#92400e',
    bg: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 28%, #f8fafc 100%)',
    border: 'rgba(245, 158, 11, 0.4)',
    headerBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(255, 255, 255, 0.55) 100%)',
    headerBorder: 'rgba(245, 158, 11, 0.25)',
    groupTitle: '#b45309',
    badgeBorder: 'rgba(245, 158, 11, 0.45)',
    badgeColor: '#b45309',
    btnBorder: 'rgba(245, 158, 11, 0.45)',
    btnColor: '#b45309',
    btnHover: '#fffbeb',
    btnOpen: '#fef3c7',
    groupBorder: 'rgba(245, 158, 11, 0.25)',
    chipBorder: 'rgba(245, 158, 11, 0.22)',
    shadow: 'rgba(245, 158, 11, 0.14)',
    shadowCompact: 'rgba(245, 158, 11, 0.09)',
  },
  supplementary: {
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    bg: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 32%, #f8fafc 100%)',
    border: 'rgba(124, 58, 237, 0.38)',
    headerBg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.16) 0%, rgba(255, 255, 255, 0.55) 100%)',
    headerBorder: 'rgba(124, 58, 237, 0.24)',
    groupTitle: '#6d28d9',
    badgeBorder: 'rgba(124, 58, 237, 0.38)',
    badgeColor: '#6d28d9',
    btnBorder: 'rgba(124, 58, 237, 0.42)',
    btnColor: '#6d28d9',
    btnHover: '#f5f3ff',
    btnOpen: '#ede9fe',
    groupBorder: 'rgba(124, 58, 237, 0.22)',
    chipBorder: 'rgba(124, 58, 237, 0.2)',
    shadow: 'rgba(124, 58, 237, 0.14)',
    shadowCompact: 'rgba(124, 58, 237, 0.09)',
  },
  award: {
    accent: '#0891b2',
    accentDark: '#0e7490',
    bg: 'linear-gradient(145deg, #ecfeff 0%, #cffafe 30%, #f8fafc 100%)',
    border: 'rgba(6, 182, 212, 0.35)',
    headerBg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(255, 255, 255, 0.5) 100%)',
    headerBorder: 'rgba(6, 182, 212, 0.22)',
    groupTitle: '#0891b2',
    badgeBorder: 'rgba(6, 182, 212, 0.35)',
    badgeColor: '#0891b2',
    btnBorder: 'rgba(6, 182, 212, 0.4)',
    btnColor: '#0891b2',
    btnHover: '#ecfeff',
    btnOpen: '#cffafe',
    groupBorder: 'rgba(6, 182, 212, 0.22)',
    chipBorder: 'rgba(6, 182, 212, 0.2)',
    shadow: 'rgba(6, 182, 212, 0.12)',
    shadowCompact: 'rgba(6, 182, 212, 0.08)',
  },
  commitment: {
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    bg: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 32%, #f8fafc 100%)',
    border: 'rgba(139, 92, 246, 0.35)',
    headerBg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(255, 255, 255, 0.5) 100%)',
    headerBorder: 'rgba(139, 92, 246, 0.22)',
    groupTitle: '#6d28d9',
    badgeBorder: 'rgba(139, 92, 246, 0.35)',
    badgeColor: '#6d28d9',
    btnBorder: 'rgba(139, 92, 246, 0.4)',
    btnColor: '#6d28d9',
    btnHover: '#f5f3ff',
    btnOpen: '#ede9fe',
    groupBorder: 'rgba(139, 92, 246, 0.22)',
    chipBorder: 'rgba(139, 92, 246, 0.2)',
    shadow: 'rgba(139, 92, 246, 0.12)',
    shadowCompact: 'rgba(139, 92, 246, 0.08)',
  },
  payment: {
    accent: '#0d9488',
    accentDark: '#0f766e',
    bg: 'linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 30%, #f8fafc 100%)',
    border: 'rgba(13, 148, 136, 0.35)',
    headerBg: 'linear-gradient(135deg, rgba(13, 148, 136, 0.14) 0%, rgba(255, 255, 255, 0.5) 100%)',
    headerBorder: 'rgba(13, 148, 136, 0.22)',
    groupTitle: '#0f766e',
    badgeBorder: 'rgba(13, 148, 136, 0.35)',
    badgeColor: '#0f766e',
    btnBorder: 'rgba(13, 148, 136, 0.4)',
    btnColor: '#0f766e',
    btnHover: '#f0fdfa',
    btnOpen: '#ccfbf1',
    groupBorder: 'rgba(13, 148, 136, 0.22)',
    chipBorder: 'rgba(13, 148, 136, 0.2)',
    shadow: 'rgba(13, 148, 136, 0.12)',
    shadowCompact: 'rgba(13, 148, 136, 0.08)',
  },
  ape: {
    accent: '#0d9488',
    accentDark: '#115e59',
    bg: 'linear-gradient(145deg, #ecfdf5 0%, #d1fae5 28%, #f8fafc 100%)',
    border: 'rgba(13, 148, 136, 0.38)',
    headerBg: 'linear-gradient(135deg, rgba(13, 148, 136, 0.16) 0%, rgba(255, 255, 255, 0.55) 100%)',
    headerBorder: 'rgba(13, 148, 136, 0.24)',
    groupTitle: '#0f766e',
    badgeBorder: 'rgba(13, 148, 136, 0.38)',
    badgeColor: '#0f766e',
    btnBorder: 'rgba(13, 148, 136, 0.42)',
    btnColor: '#0f766e',
    btnHover: '#ecfdf5',
    btnOpen: '#d1fae5',
    groupBorder: 'rgba(13, 148, 136, 0.22)',
    chipBorder: 'rgba(13, 148, 136, 0.2)',
    shadow: 'rgba(13, 148, 136, 0.14)',
    shadowCompact: 'rgba(13, 148, 136, 0.09)',
  },
};

const Panel = styled.div`
  border-radius: ${(p) => (p.$compact ? '10px' : '14px')};
  background: ${(p) => p.$theme.bg};
  border: 1px solid ${(p) => p.$theme.border};
  box-shadow: ${(p) => (p.$compact
    ? `0 2px 8px ${p.$theme.shadowCompact}`
    : `0 4px 18px ${p.$theme.shadow}`)};
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  padding: ${(p) => (p.$compact ? '0.55rem 0.65rem' : '0.85rem 1rem')};
  background: ${(p) => p.$theme.headerBg};
  border-bottom: 1px solid ${(p) => p.$theme.headerBorder};
`;

const HeaderMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeaderTitle = styled.div`
  font-weight: 800;
  font-size: ${(p) => (p.$compact ? '0.78rem' : '0.92rem')};
  color: ${(p) => p.$theme.accentDark};
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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
  border: 1px solid ${(p) => p.$theme.badgeBorder};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${(p) => p.$theme.badgeColor};
  letter-spacing: 0.02em;
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
  border: 1px solid ${(p) => p.$theme.btnBorder};
  border-radius: 8px;
  background: #fff;
  color: ${(p) => p.$theme.btnColor};
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    background: ${(p) => p.$theme.btnHover};
    box-shadow: 0 2px 8px ${(p) => p.$theme.shadowCompact};
  }

  &:active {
    transform: scale(0.96);
  }

  ${(p) => p.$open && css`
    background: ${p.$theme.btnOpen};
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
  border: 1px solid ${(p) => p.$theme.chipBorder};
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
    border-bottom: 1px dashed ${(p) => p.$theme.groupBorder};
  }
`;

const GroupTitle = styled.div`
  font-size: ${(p) => (p.$compact ? '0.72rem' : '0.78rem')};
  font-weight: 800;
  color: ${(p) => p.$theme.groupTitle};
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
`;

function safeVal(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return v;
  // Raw KHMDHS {key, value} object — pick the value property
  if (typeof v === 'object' && v.value != null) return String(v.value);
  if (typeof v === 'object' && v.key != null) return String(v.key);
  return String(v);
}

function PanelGroups({ groups, compact, theme }) {
  if (!groups?.length) return null;
  return groups.map((group) => (
    <GroupBlock key={group.id} $compact={compact} $theme={theme}>
      <GroupTitle $compact={compact} $theme={theme}>
        {group.icon} {group.title}
      </GroupTitle>
      <RowGrid $compact={compact}>
        {group.rows.map((row) => (
          <RowItem key={`${group.id}-${row.label}`} $full={row.fullWidth} $highlight={row.highlight}>
            <RowLabel>{row.label}</RowLabel>
            <RowValue $highlight={row.highlight} $badge={row.badge}>
              {safeVal(row.value)}
            </RowValue>
          </RowItem>
        ))}
      </RowGrid>
    </GroupBlock>
  ));
}

/**
 * @param {{
 *   themeKey: 'request'|'contract'|'award',
 *   title: string,
 *   adam?: string,
 *   subtitle?: string,
 *   headerExtra?: React.ReactNode,
 *   groups: Array,
 *   summaryChips?: Array<{ label: string, value: string, highlight?: boolean, warn?: boolean, strong?: boolean }>,
 *   cardSubtitle?: string,
 *   variant?: 'detail'|'card',
 *   defaultExpanded?: boolean,
 * }} props
 */
export default function KhmdhsPanelDisplay({
  themeKey = 'request',
  title,
  adam,
  subtitle,
  headerExtra,
  groups,
  summaryChips = [],
  cardSubtitle,
  variant = 'detail',
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const compact = variant === 'card';
  const theme = KHMDHS_PANEL_THEMES[themeKey] || KHMDHS_PANEL_THEMES.request;

  const visibleGroups = useMemo(
    () => (groups || []).filter((g) => g?.rows?.length),
    [groups]
  );

  if (!visibleGroups.length && !summaryChips.length) return null;

  if (variant === 'detail') {
    return (
      <Panel $compact={compact} $theme={theme}>
        <PanelHeader $compact={compact} $theme={theme}>
          <HeaderMain>
            <HeaderTitle $compact={compact} $theme={theme}>
              {title}
              {adam && <AdamBadge $theme={theme}>{adam}</AdamBadge>}
              {headerExtra}
            </HeaderTitle>
            {subtitle && <HeaderSub>{subtitle}</HeaderSub>}
          </HeaderMain>
        </PanelHeader>
        <DetailBody $compact={compact}>
          <PanelGroups groups={visibleGroups} compact={compact} theme={theme} />
        </DetailBody>
      </Panel>
    );
  }

  return (
    <Panel $compact $theme={theme}>
      <PanelHeader $compact $theme={theme}>
        <HeaderMain>
          <HeaderTitle $compact $theme={theme}>
            {title}
            {adam && <AdamBadge $theme={theme}>{adam}</AdamBadge>}
            {headerExtra}
          </HeaderTitle>
          {cardSubtitle && (
            <HeaderSub style={{
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {cardSubtitle}
            </HeaderSub>
          )}
        </HeaderMain>
        {visibleGroups.length > 0 && (
          <ExpandBtn
            type="button"
            $open={expanded}
            $theme={theme}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            <Chevron $open={expanded}>▾</Chevron>
          </ExpandBtn>
        )}
      </PanelHeader>

      {summaryChips.length > 0 && (
        <SummaryGrid $theme={theme} onClick={(e) => e.stopPropagation()}>
          {summaryChips.map((chip) => (
            <SummaryChip
              key={chip.label}
              $theme={theme}
              $highlight={chip.highlight}
              $warn={chip.warn}
            >
              <ChipLabel>{chip.label}</ChipLabel>
              <ChipValue $strong={chip.strong}>{chip.value}</ChipValue>
            </SummaryChip>
          ))}
        </SummaryGrid>
      )}

      <ExpandableWrap $open={expanded}>
        <ExpandableInner>
          <DetailBody $compact onClick={(e) => e.stopPropagation()}>
            <PanelGroups groups={visibleGroups} compact theme={theme} />
          </DetailBody>
        </ExpandableInner>
      </ExpandableWrap>
    </Panel>
  );
}
