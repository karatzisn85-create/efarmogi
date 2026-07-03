import React, { useState, useRef, useEffect } from 'react';
import styled, { css, keyframes } from 'styled-components';

// ── Χρωματικό σύστημα ανά τύπο σταδίου ─────────────────────────────────────
export const STAGE_CARD_THEMES = {
  REQ: {
    accent:      '#4F46E5',
    accentLight: '#6366f1',
    bg:          '#eef2ff',
    bgHover:     '#e0e7ff',
    border:      'rgba(79, 70, 229, 0.28)',
    chip:        '#4F46E5',
    chipBg:      'rgba(79, 70, 229, 0.1)',
    label:       'rgba(79, 70, 229, 0.85)',
  },
  COMMIT: {
    accent:      '#7C3AED',
    accentLight: '#8b5cf6',
    bg:          '#f5f3ff',
    bgHover:     '#ede9fe',
    border:      'rgba(124, 58, 237, 0.28)',
    chip:        '#7C3AED',
    chipBg:      'rgba(124, 58, 237, 0.1)',
    label:       'rgba(124, 58, 237, 0.85)',
  },
  PROC: {
    accent:      '#EA580C',
    accentLight: '#f97316',
    bg:          '#fff7ed',
    bgHover:     '#ffedd5',
    border:      'rgba(234, 88, 12, 0.28)',
    chip:        '#EA580C',
    chipBg:      'rgba(234, 88, 12, 0.1)',
    label:       'rgba(234, 88, 12, 0.85)',
  },
  AWRD: {
    accent:      '#D97706',
    accentLight: '#f59e0b',
    bg:          '#fffbeb',
    bgHover:     '#fef3c7',
    border:      'rgba(217, 119, 6, 0.28)',
    chip:        '#D97706',
    chipBg:      'rgba(217, 119, 6, 0.1)',
    label:       'rgba(217, 119, 6, 0.85)',
  },
  SYMV: {
    accent:      '#059669',
    accentLight: '#10b981',
    bg:          '#ecfdf5',
    bgHover:     '#d1fae5',
    border:      'rgba(5, 150, 105, 0.28)',
    chip:        '#059669',
    chipBg:      'rgba(5, 150, 105, 0.1)',
    label:       'rgba(5, 150, 105, 0.85)',
  },
  SUPP: {
    accent:      '#7C3AED',
    accentLight: '#8b5cf6',
    bg:          '#f5f3ff',
    bgHover:     '#ede9fe',
    border:      'rgba(124, 58, 237, 0.28)',
    chip:        '#7C3AED',
    chipBg:      'rgba(124, 58, 237, 0.1)',
    label:       'rgba(124, 58, 237, 0.85)',
  },
  PAY: {
    accent:      '#0D9488',
    accentLight: '#14b8a6',
    bg:          '#f0fdfa',
    bgHover:     '#ccfbf1',
    border:      'rgba(13, 148, 136, 0.28)',
    chip:        '#0D9488',
    chipBg:      'rgba(13, 148, 136, 0.1)',
    label:       'rgba(13, 148, 136, 0.85)',
  },
  APE: {
    accent:      '#0d9488',
    accentLight: '#14b8a6',
    bg:          '#ecfdf5',
    bgHover:     '#d1fae5',
    border:      'rgba(13, 148, 136, 0.32)',
    chip:        '#0d9488',
    chipBg:      'rgba(13, 148, 136, 0.12)',
    label:       'rgba(13, 148, 136, 0.9)',
  },
  EXT: {
    accent:      '#b45309',
    accentLight: '#d97706',
    bg:          '#fffbeb',
    bgHover:     '#fef3c7',
    border:      'rgba(180, 83, 9, 0.32)',
    chip:        '#b45309',
    chipBg:      'rgba(180, 83, 9, 0.12)',
    label:       'rgba(180, 83, 9, 0.9)',
  },
};

const expandDown = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── Styled components ────────────────────────────────────────────────────────

const Card = styled.div`
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$t.border};
  background: #fff;
  box-shadow: 0 2px 8px ${(p) => p.$t.border};
  transition: box-shadow 0.2s ease;
  ${(p) => p.$nested && css`
    margin-left: 1.35rem;
    border-left-width: 3px;
    border-radius: 10px;
    box-shadow: 0 1px 6px ${p.$t.border};
  `}

  &:hover {
    box-shadow: 0 4px 16px ${(p) => p.$t.border};
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  border-left: 4px solid ${(p) => p.$t.accent};
  background: ${(p) => (p.$expanded ? p.$t.bgHover : p.$t.bg)};
  transition: background 0.18s ease;

  &:hover {
    background: ${(p) => p.$t.bgHover};
  }
`;

const HeaderMain = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem 0.7rem 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  outline: none;

  &:focus-visible {
    outline: 2px solid ${(p) => p.$t.accent};
    outline-offset: -2px;
  }
`;

const HeaderActionSlot = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const ExpandToggle = styled.button`
  flex-shrink: 0;
  margin-right: 0.7rem;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 0.7rem;
  color: ${(p) => p.$t.label};
  cursor: pointer;
  transition: transform 0.22s ease, background 0.18s ease;
  transform: ${(p) => (p.$expanded ? 'rotate(180deg)' : 'rotate(0deg)')};
  font-family: inherit;

  &:hover {
    background: rgba(255, 255, 255, 0.45);
  }
`;

const Header = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem 0.7rem 0;
  background: ${(p) => p.$expanded ? p.$t.bgHover : p.$t.bg};
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  border-left: 4px solid ${(p) => p.$t.accent};
  transition: background 0.18s ease;
  outline: none;

  &:hover {
    background: ${(p) => p.$t.bgHover};
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.$t.accent};
    outline-offset: -2px;
  }
`;

const StepBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: ${(p) => p.$t.accent};
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  flex-shrink: 0;
  margin-left: 0.7rem;
`;

const HeaderMeta = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
`;

const StageIcon = styled.span`
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
`;

const StageTitle = styled.span`
  font-size: 0.84rem;
  font-weight: 800;
  color: ${(p) => p.$t.accent};
  letter-spacing: -0.01em;
`;

const AdamChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  background: ${(p) => p.$t.chipBg};
  color: ${(p) => p.$t.chip};
  border: 1px solid ${(p) => p.$t.border};
  font-size: 0.68rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.01em;
`;

const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;

  ${(p) => p.$ok && css`
    background: rgba(16, 185, 129, 0.1);
    color: #065f46;
    border: 1px solid rgba(16, 185, 129, 0.3);
  `}
  ${(p) => p.$warn && css`
    background: rgba(245, 158, 11, 0.1);
    color: #92400e;
    border: 1px solid rgba(245, 158, 11, 0.3);
  `}
  ${(p) => !p.$ok && !p.$warn && css`
    background: rgba(148, 163, 184, 0.12);
    color: #475569;
    border: 1px solid rgba(148, 163, 184, 0.3);
  `}
`;

const Summary = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 460px;
`;

const ExpandArrow = styled.span`
  flex-shrink: 0;
  margin-right: 0.7rem;
  font-size: 0.7rem;
  color: ${(p) => p.$t.label};
  transition: transform 0.22s ease;
  transform: ${(p) => p.$expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
`;

const Body = styled.div`
  border-top: 1px solid ${(p) => p.$t.border};
  background: #fff;
  animation: ${expandDown} 0.22s ease-out;
`;

const BodyInner = styled.div`
  padding: 0.85rem 0.9rem 0.9rem;
`;

const Footer = styled.div`
  border-top: 1px dashed ${(p) => p.$t.border};
  padding: 0.7rem 0.9rem;
  background: ${(p) => p.$t.bg};
`;

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Reusable accordion card για κάθε κρίκο της ΚΗΜΔΗΣ αλυσίδας.
 *
 * @param {{
 *   stageType:     'REQ'|'COMMIT'|'PROC'|'AWRD'|'SYMV'|'PAY',
 *   icon:          string,
 *   title:         string,
 *   adam?:         string,
 *   stepNumber?:   number,
 *   statusLabel?:  string,
 *   statusOk?:     boolean,
 *   statusWarn?:   boolean,
 *   summary?:      string,
 *   defaultExpanded?: boolean,
 *   scrollId?:     string,
 *   children:      React.ReactNode,
 *   footer?:       React.ReactNode,
 *   headerAction?:  React.ReactNode,
 *   nested?:       boolean,
 * }} props
 */
export default function KhmdhsStageCard({
  stageType = 'REQ',
  icon = '📋',
  title,
  adam,
  stepNumber,
  statusLabel,
  statusOk,
  statusWarn,
  summary,
  defaultExpanded = false,
  scrollId,
  children,
  footer,
  headerAction,
  nested = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const cardRef = useRef(null);
  const t = STAGE_CARD_THEMES[stageType] || STAGE_CARD_THEMES.REQ;

  // Expose scroll target via data attribute
  useEffect(() => {
    if (scrollId && cardRef.current) {
      cardRef.current.setAttribute('data-stage-scroll-id', scrollId);
    }
  }, [scrollId]);

  // Ακούει το custom event 'khmdhs-stage-navigate' που εκπέμπει το lifecycle rail
  useEffect(() => {
    if (!scrollId) return undefined;
    const handler = (e) => {
      if (e.detail?.scrollId === scrollId) {
        setExpanded(true);
        window.requestAnimationFrame(() => {
          cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    };
    document.addEventListener('khmdhs-stage-navigate', handler);
    return () => document.removeEventListener('khmdhs-stage-navigate', handler);
  }, [scrollId]);

  return (
    <Card ref={cardRef} $t={t} $nested={nested} data-stage-card={stageType}>
      <HeaderRow $t={t} $expanded={expanded}>
        <HeaderMain
          type="button"
          $t={t}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {stepNumber != null && <StepBadge $t={t}>{stepNumber}</StepBadge>}
          <HeaderMeta>
            <HeaderTop>
              <StageIcon>{icon}</StageIcon>
              <StageTitle $t={t}>{title}</StageTitle>
              {adam && <AdamChip $t={t}>{adam}</AdamChip>}
              {statusLabel && (
                <StatusChip $ok={statusOk} $warn={statusWarn}>
                  {statusOk ? '✓' : statusWarn ? '⚠' : '○'} {statusLabel}
                </StatusChip>
              )}
            </HeaderTop>
            {summary && !expanded && <Summary>{summary}</Summary>}
          </HeaderMeta>
        </HeaderMain>
        {headerAction ? <HeaderActionSlot>{headerAction}</HeaderActionSlot> : null}
        <ExpandToggle
          type="button"
          $t={t}
          $expanded={expanded}
          aria-label={expanded ? 'Σύμπτυξη' : 'Ανάπτυξη'}
          onClick={() => setExpanded((v) => !v)}
        >
          ▼
        </ExpandToggle>
      </HeaderRow>

      {expanded && (
        <Body $t={t}>
          <BodyInner>{children}</BodyInner>
          {footer && <Footer $t={t}>{footer}</Footer>}
        </Body>
      )}
    </Card>
  );
}
