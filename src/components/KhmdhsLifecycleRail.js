import React, { useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  buildKhmdhsLifecycleStages,
  getKhmdhsLifecycleProgress,
  shouldShowKhmdhsLifecycleRail,
} from '../utils/khmdhsLifecycleStages';
import {
  buildKhmdhsLifecycleRailColumns,
  countKhmdhsLifecycleRailNodes,
} from '../utils/khmdhsLifecycleRailGraph';
import KhmdhsFreshnessBadge from './KhmdhsFreshnessBadge';

const pulseRing = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 var(--ring-color); }
  50% { box-shadow: 0 0 0 6px transparent; }
`;

const shimmer = keyframes`
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

const secondaryGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.28), 0 2px 6px rgba(13, 148, 136, 0.18); }
  50% { box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.14), 0 3px 10px rgba(13, 148, 136, 0.3); }
`;

const RailShell = styled.div`
  border-radius: ${(p) => (p.$slim ? '10px' : p.$compact ? '12px' : '14px')};
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 55%, #f1f5f9 100%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: ${(p) => (p.$slim
    ? '0 1px 4px rgba(15, 23, 42, 0.04)'
    : p.$compact
      ? '0 2px 10px rgba(15, 23, 42, 0.05)'
      : '0 4px 20px rgba(15, 23, 42, 0.07)')};
  overflow: hidden;
  flex-shrink: 0;
  width: 100%;
  position: ${(p) => (p.$slim || p.$compact ? 'relative' : 'sticky')};
  top: ${(p) => (p.$slim || p.$compact ? 'auto' : '0')};
  /* compact στην κάρτα: χαμηλό z-index — αλλιώς καλύπτει το κουμπί αναφοράς */
  z-index: ${(p) => (p.$slim || p.$compact ? 1 : 50)};
`;

/* ── Slim variant — compact αλλά αναγνώσιμη ─────────────────────────── */

const SlimHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0.8rem 0;
  flex-wrap: wrap;
`;

const SlimHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  min-width: 0;
`;

const SlimHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
`;

const RefreshBtn = styled.button`
  border: 1px solid rgba(99, 102, 241, 0.35);
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4338ca;
  font-size: 0.58rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    filter: brightness(0.97);
  }
`;

const SlimTitle = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  color: #4338ca;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const SlimProgress = styled.div`
  font-size: 0.6rem;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
`;

const SlimProgressBar = styled.div`
  height: 2px;
  margin: 0.22rem 0.8rem 0;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
`;

const SlimProgressFill = styled.div`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: linear-gradient(90deg, #6366f1, #10b981, #0891b2, #d97706);
  background-size: 300% 100%;
  animation: ${shimmer} 4s linear infinite;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
`;

const SLIM_STEP_WIDTH_PX = 84;
const GRAPH_STEP_WIDTH_PX = 98;

const ScrollLaneWrap = styled.div`
  position: relative;
  width: 100%;
`;

const ScrollViewport = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: ${(p) => {
    if (p.$slim) return '0.4rem 0.35rem 0.55rem';
    if (p.$compact) return '0 0.15rem';
    return '0';
  }};
  padding-left: ${(p) => (p.$padLeft ? '1.55rem' : undefined)};
  padding-right: ${(p) => (p.$padRight ? '1.55rem' : undefined)};

  &::-webkit-scrollbar {
    display: none;
  }
`;

const ScrollFade = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2.35rem;
  z-index: 2;
  pointer-events: none;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.25s ease;
  ${(p) => (p.$side === 'left' ? 'left: 0;' : 'right: 0;')}
  background: ${(p) => (p.$side === 'left'
    ? 'linear-gradient(90deg, #f8fafc 10%, rgba(248, 250, 252, 0.95) 40%, transparent 100%)'
    : 'linear-gradient(270deg, #f8fafc 10%, rgba(248, 250, 252, 0.95) 40%, transparent 100%)')};
`;

const ScrollArrowBtn = styled.button`
  position: absolute;
  top: ${(p) => (p.$compact ? '1.25rem' : '1.05rem')};
  ${(p) => (p.$side === 'left' ? 'left: 0.15rem;' : 'right: 0.15rem;')}
  z-index: 3;
  width: ${(p) => (p.$compact ? '1.6rem' : '1.45rem')};
  height: ${(p) => (p.$compact ? '1.6rem' : '1.45rem')};
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.45);
  background: linear-gradient(145deg, #ffffff, #eef2ff);
  color: #4338ca;
  font-size: ${(p) => (p.$compact ? '1.05rem' : '0.95rem')};
  font-weight: 900;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(67, 56, 202, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  font-family: inherit;
  padding: 0;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? 'auto' : 'none')};

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 14px rgba(67, 56, 202, 0.32);
    background: linear-gradient(145deg, #ffffff, #e0e7ff);
  }

  &:active {
    transform: scale(0.94);
  }
`;

function StepsScrollLane({ stepWidth, slim, compact, stageCount, children }) {
  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const hasOverflow = maxScroll > 4;
    setScrollState({
      hasOverflow,
      canScrollLeft: hasOverflow && el.scrollLeft > 4,
      canScrollRight: hasOverflow && el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(() => updateEdges());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    el.addEventListener('scroll', updateEdges, { passive: true });

    const t1 = requestAnimationFrame(() => updateEdges());
    const t2 = window.setTimeout(() => updateEdges(), 120);

    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      el.removeEventListener('scroll', updateEdges);
    };
  }, [updateEdges, stageCount, stepWidth]);

  const scrollBySteps = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const stride = Math.max(stepWidth * 2, el.clientWidth * 0.52);
    el.scrollBy({ left: direction * stride, behavior: 'smooth' });
  }, [stepWidth]);

  const stopCardClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const { hasOverflow, canScrollLeft, canScrollRight } = scrollState;

  return (
    <ScrollLaneWrap onClick={stopCardClick} onMouseDown={stopCardClick}>
      <ScrollFade $side="left" $visible={hasOverflow && canScrollLeft} />
      <ScrollFade $side="right" $visible={hasOverflow && canScrollRight} />
      <ScrollArrowBtn
        type="button"
        $side="left"
        $compact={compact}
        $visible={hasOverflow && canScrollLeft}
        aria-label="Προηγούμενα στάδια αλυσίδας"
        title="Προηγούμενα στάδια"
        onClick={(e) => {
          e.stopPropagation();
          scrollBySteps(-1);
        }}
      >
        ‹
      </ScrollArrowBtn>
      <ScrollArrowBtn
        type="button"
        $side="right"
        $compact={compact}
        $visible={hasOverflow && canScrollRight}
        aria-label="Επόμενα στάδια αλυσίδας"
        title="Επόμενα στάδια (π.χ. εντάλματα πληρωμής)"
        onClick={(e) => {
          e.stopPropagation();
          scrollBySteps(1);
        }}
      >
        ›
      </ScrollArrowBtn>
      <ScrollViewport
        ref={scrollRef}
        $slim={slim}
        $compact={compact}
        $padLeft={hasOverflow && canScrollLeft}
        $padRight={hasOverflow && canScrollRight}
      >
        {children}
      </ScrollViewport>
    </ScrollLaneWrap>
  );
}

const SlimBody = styled.div`
  padding: 0;
`;

const SlimStepsRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0;
  width: max-content;
  padding: 0 0.15rem;
  box-sizing: border-box;
`;

const SlimStepWrap = styled.div`
  flex: 0 0 ${(p) => (p.$graph ? GRAPH_STEP_WIDTH_PX : SLIM_STEP_WIDTH_PX)}px;
  width: ${(p) => (p.$graph ? GRAPH_STEP_WIDTH_PX : SLIM_STEP_WIDTH_PX)}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  padding: 0 2px;
  box-sizing: border-box;

  ${(p) => p.$clickable && css`
    &:hover > div:first-of-type > div:first-child { transform: scale(1.08); }
  `}
`;

const SlimConnector = styled.div`
  position: absolute;
  top: 15px;
  left: calc(50% + 15px);
  width: calc(100% - 30px);
  height: ${(p) => (p.$tone === 'pending' ? '2px' : '2.5px')};
  z-index: 0;
  border-radius: 999px;
  pointer-events: none;
  background: ${(p) => {
    if (p.$tone === 'complete') return `linear-gradient(90deg, ${p.$from}, ${p.$to})`;
    if (p.$tone === 'partial') return `linear-gradient(90deg, ${p.$from} 0%, ${p.$from} 55%, #e2e8f0 55%)`;
    return 'transparent';
  }};
  border-top: ${(p) => (p.$tone === 'pending' ? '2px dashed #cbd5e1' : 'none')};
`;

const SlimNode = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  position: relative;
  z-index: 1;
  border: 2px solid ${(p) => p.$border};
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color || '#64748b'};
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  ${(p) => p.$muted && css`opacity: 0.4; filter: grayscale(0.3);`}
  ${(p) => p.$complete && css`box-shadow: 0 2px 6px ${p.$shadow};`}
`;

const SlimLabel = styled.div`
  margin-top: 0.3rem;
  text-align: center;
  font-size: 0.56rem;
  font-weight: ${(p) => (p.$active ? 800 : 500)};
  color: ${(p) => (p.$active ? p.$accent : '#94a3b8')};
  line-height: 1.2;
  width: 100%;
  max-width: 100%;
  min-height: 2.35em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;

const SlimAdamChip = styled.div`
  margin-top: 0.12rem;
  padding: 0.06rem 0.22rem;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.48rem;
  font-weight: 700;
  color: ${(p) => p.$copied ? '#047857' : p.$accent};
  background: ${(p) => p.$copied ? '#d1fae5' : p.$bg};
  border: 1px solid ${(p) => p.$copied ? '#6ee7b7' : p.$border};
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  user-select: none;

  &:hover {
    filter: brightness(0.93);
    opacity: 0.92;
  }
`;

const SlimExtraChip = styled.div`
  margin-top: 0.08rem;
  padding: 0.04rem 0.22rem;
  border-radius: 999px;
  font-size: 0.48rem;
  font-weight: 800;
  color: #7c3aed;
  background: #f5f3ff;
  border: 1px solid rgba(124, 58, 237, 0.25);
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  box-sizing: border-box;
`;

const GraphColumnStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const SecondaryBranch = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: 0.1rem;

  &::before {
    content: '';
    width: 2px;
    height: 0.4rem;
    background: linear-gradient(180deg, ${(p) => p.$accent || '#0d9488'} 0%, rgba(148, 163, 184, 0.35) 100%);
    border-radius: 2px;
    opacity: 0.85;
  }
`;

const SecondaryNode = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  position: relative;
  z-index: 1;
  border: 1.5px solid ${(p) => p.$border};
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color || '#0f766e'};
  transition: transform 0.2s ease;
  animation: ${secondaryGlow} 2.8s ease-in-out infinite;
  margin-top: 0.12rem;
`;

const SecondaryLabel = styled.div`
  margin-top: 0.18rem;
  text-align: center;
  font-size: 0.5rem;
  font-weight: 800;
  color: ${(p) => p.$accent || '#0f766e'};
  line-height: 1.15;
  width: 100%;
`;

const BadgeChip = styled(SlimAdamChip)`
  color: ${(p) => (p.$copied ? '#047857' : p.$accent)};
  font-size: 0.46rem;
`;

const RailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: ${(p) => (p.$compact ? '0.5rem 0.75rem' : '0.65rem 1rem')};
  background: linear-gradient(135deg, rgba(67, 56, 202, 0.08) 0%, rgba(255,255,255,0.4) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
`;

const RailTitle = styled.div`
  font-size: ${(p) => (p.$compact ? '0.72rem' : '0.8rem')};
  font-weight: 800;
  color: #312e81;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const RailProgress = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
`;

const ProgressBarTrack = styled.div`
  height: 3px;
  background: rgba(148, 163, 184, 0.2);
  margin: 0 ${(p) => (p.$compact ? '0.75rem' : '1rem')};
  border-radius: 999px;
  overflow: hidden;
`;

const ProgressBarFill = styled.div`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: linear-gradient(90deg, #6366f1, #10b981, #0891b2, #d97706);
  background-size: 300% 100%;
  animation: ${shimmer} 4s linear infinite;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
`;

const RailBody = styled.div`
  padding: ${(p) => (p.$compact ? '0.65rem 0.2rem 0.75rem' : '0.85rem 0.75rem 1rem')};
  overflow: visible;
`;

const StepsRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0;
  width: max-content;
  padding: 0 0.25rem;
`;

const StepWrap = styled.div`
  flex: 0 0 ${(p) => p.$stepWidth}px;
  width: ${(p) => p.$stepWidth}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  padding: 0 3px;
  box-sizing: border-box;

  ${(p) => p.$clickable && `
    &:hover > div:first-child {
      transform: scale(1.1);
    }
  `}
`;

const Connector = styled.div`
  position: absolute;
  top: ${(p) => (p.$compact ? '17px' : '21px')};
  left: calc(50% + ${(p) => (p.$compact ? '18px' : '22px')});
  width: calc(100% - ${(p) => (p.$compact ? '36px' : '44px')});
  height: ${(p) => (p.$tone === 'pending' ? '2px' : '3px')};
  z-index: 0;
  border-radius: 999px;
  pointer-events: none;
  background: ${(p) => {
    if (p.$tone === 'complete') return `linear-gradient(90deg, ${p.$from}, ${p.$to})`;
    if (p.$tone === 'partial') return `linear-gradient(90deg, ${p.$from} 0%, ${p.$from} 55%, #e2e8f0 55%, #e2e8f0 100%)`;
    return 'transparent';
  }};
  border-top: ${(p) => (p.$tone === 'pending' ? '2px dashed #cbd5e1' : 'none')};
  opacity: ${(p) => (p.$tone === 'pending' ? 0.9 : 1)};
`;

const NodeCircle = styled.div`
  width: ${(p) => (p.$compact ? '36px' : '44px')};
  height: ${(p) => (p.$compact ? '36px' : '44px')};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => (p.$compact ? '0.95rem' : '1.1rem')};
  position: relative;
  z-index: 1;
  border: 2px solid ${(p) => p.$border};
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color || '#64748b'};
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  ${(p) => p.$status === 'current' && css`
    --ring-color: ${p.$ring};
    animation: ${pulseRing} 2s ease-in-out infinite;
    transform: scale(1.06);
    box-shadow: 0 4px 14px ${p.$shadow};
  `}

  ${(p) => p.$status === 'complete' && css`
    box-shadow: 0 2px 8px ${p.$shadow};
  `}

  ${(p) => p.$muted && css`
    opacity: 0.42;
    filter: grayscale(0.35);
  `}

  ${(p) => p.$status === 'cancelled' && css`
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
  `}
`;

const CheckMark = styled.span`
  font-size: ${(p) => (p.$compact ? '0.85rem' : '1rem')};
  font-weight: 900;
  line-height: 1;
`;

const StepLabel = styled.div`
  margin-top: 0.45rem;
  text-align: center;
  font-size: ${(p) => (p.$compact ? '0.62rem' : '0.7rem')};
  font-weight: ${(p) => (p.$active ? 800 : 500)};
  color: ${(p) => (p.$active ? p.$accent : '#cbd5e1')};
  opacity: ${(p) => (p.$active ? 1 : 0.75)};
  line-height: 1.25;
  width: 100%;
  max-width: 100%;
  min-height: 2.4em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;

const AdamChip = styled.div`
  margin-top: 0.28rem;
  padding: 0.12rem 0.35rem;
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: ${(p) => (p.$compact ? '0.55rem' : '0.62rem')};
  font-weight: 700;
  color: ${(p) => p.$copied ? '#047857' : p.$accent};
  background: ${(p) => p.$copied ? '#d1fae5' : p.$bg};
  border: 1px solid ${(p) => p.$copied ? '#6ee7b7' : p.$border};
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  user-select: none;

  &:hover {
    filter: brightness(0.93);
    opacity: 0.92;
  }
`;

const StatusTag = styled.span`
  display: inline-block;
  margin-top: 0.22rem;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  border: 1px solid ${(p) => p.$border};
`;

function truncateAdam(adam, compact) {
  const s = String(adam || '').trim();
  if (!s) return '';
  if (!compact || s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-5)}`;
}

function nodeVisual(stage, compact) {
  const { status, accent, accentDark, bg, border } = stage;
  if (status === 'skipped') {
    return {
      border: '#cbd5e1',
      bg: '#f8fafc',
      color: '#64748b',
      ring: 'transparent',
      shadow: 'transparent',
      inner: '—',
      muted: false,
    };
  }
  if (status === 'cancelled') {
    return {
      border: '#fca5a5',
      bg: '#fef2f2',
      color: '#dc2626',
      ring: 'rgba(239, 68, 68, 0.35)',
      shadow: 'rgba(239, 68, 68, 0.25)',
      inner: '✕',
      muted: false,
    };
  }
  if (status === 'complete') {
    return {
      border: accent,
      bg: `linear-gradient(145deg, ${bg} 0%, #fff 100%)`,
      color: accentDark,
      ring: `${accent}55`,
      shadow: `${accent}33`,
      inner: <CheckMark $compact={compact}>✓</CheckMark>,
      muted: false,
    };
  }
  if (status === 'current') {
    return {
      border: accent,
      bg: `linear-gradient(145deg, ${accent} 0%, ${accentDark} 100%)`,
      color: '#fff',
      ring: `${accent}44`,
      shadow: `${accent}40`,
      inner: stage.icon,
      muted: false,
    };
  }
  return {
    border: '#e2e8f0',
    bg: '#f1f5f9',
    color: '#cbd5e1',
    ring: 'transparent',
    shadow: 'transparent',
    inner: stage.icon,
    muted: true,
  };
}

function connectorTone(left, right) {
  if (left.status === 'cancelled' || right.status === 'cancelled') return 'pending';
  if (left.status === 'skipped' || right.status === 'skipped') {
    if (left.status === 'complete' || left.status === 'skipped') {
      if (right.status === 'complete' || right.status === 'current' || right.status === 'skipped') {
        return 'complete';
      }
    }
    return 'partial';
  }
  if (left.status === 'complete' && (right.status === 'complete' || right.status === 'current')) {
    return 'complete';
  }
  if (left.status === 'complete' && right.status === 'pending') return 'partial';
  if (left.status === 'current') return 'partial';
  return 'pending';
}

function statusTag(stage) {
  if (stage.status === 'skipped') {
    return { text: 'Χωρ. δημ.', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
  }
  if (stage.status === 'cancelled') {
    return { text: 'Μαται.', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  }
  if (stage.status === 'complete') {
    return { text: 'Ολοκλ.', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }
  if (stage.status === 'current') {
    return { text: 'Τρέχον', bg: stage.bg, color: stage.accentDark, border: stage.border };
  }
  return null;
}

/**
 * @param {{ project: object, variant?: 'compact'|'standard'|'hero'|'slim', graphMode?: 'summary'|'full', showHeader?: boolean, onClick?: Function, freshness?: object, onRefresh?: Function, refreshLoading?: boolean, showRefreshButton?: boolean }} props
 */
export default function KhmdhsLifecycleRail({
  project,
  variant = 'standard',
  graphMode = 'summary',
  showHeader = true,
  onClick,
  freshness = null,
  onRefresh,
  refreshLoading = false,
  showRefreshButton = false,
}) {
  const slim = variant === 'slim';
  const compact = variant === 'compact' || slim;
  const fullGraph = graphMode === 'full';
  const stages = useMemo(() => buildKhmdhsLifecycleStages(project), [project]);
  const columns = useMemo(
    () => (fullGraph ? buildKhmdhsLifecycleRailColumns(project) : []),
    [project, fullGraph]
  );
  const progress = useMemo(() => getKhmdhsLifecycleProgress(stages), [stages]);
  const graphNodeCount = useMemo(() => countKhmdhsLifecycleRailNodes(columns), [columns]);
  const stepWidth = slim ? (fullGraph ? GRAPH_STEP_WIDTH_PX : SLIM_STEP_WIDTH_PX) : (compact ? 80 : 92);
  const laneCount = fullGraph ? columns.length : stages.length;

  // copiedId: το stageId του chip που μόλις αντιγράφηκε (για flash feedback)
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyAdam = useCallback((e, stageId, adam) => {
    e.stopPropagation();
    if (!adam) return;
    navigator.clipboard?.writeText(adam).catch(() => {
      // fallback για παλιά browsers
      const ta = document.createElement('textarea');
      ta.value = adam;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedId(stageId);
    setTimeout(() => setCopiedId((prev) => (prev === stageId ? null : prev)), 1400);
  }, []);

  if (!shouldShowKhmdhsLifecycleRail(project)) return null;

  const scrollToStage = (stage) => {
    const scrollId = stage.scrollId || (stage.id === 'COMMIT' ? 'stage-COMMIT'
      : stage.id === 'PAY' ? 'stage-PAY'
      : stage.id === 'SYMV' ? 'stage-SYMV-0'
      : `stage-${stage.id}`);
    document.dispatchEvent(new CustomEvent('khmdhs-stage-navigate', { detail: { scrollId } }));
  };

  const buildNodeTooltip = (node) => {
    const parts = [node.label];
    if (node.adam) parts.push(node.adam);
    if (node.badge) parts.push(node.badge);
    if (node.tier === 'secondary') parts.push('Δευτερεύων κρίκος');
    return parts.join(' · ');
  };

  const buildStageTooltip = (stage) => {
    const parts = [stage.label];
    if (stage.adam) parts.push(stage.adam);
    if (stage.extraLabel) parts.push(stage.extraLabel);
    if (stage.status === 'complete') parts.push('Ολοκληρωμένο');
    else if (stage.status === 'current') parts.push('Τρέχον');
    else if (stage.status === 'skipped') parts.push('Χωρίς ηλεκτρονική δημοσίευση');
    return parts.join(' · ');
  };

  if (slim) {
    return (
      <RailShell
        $slim
        $compact
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        style={onClick ? { cursor: 'pointer' } : undefined}
      >
        <SlimHeader>
          <SlimHeaderLeft>
            <SlimTitle>🔗 Αλυσίδα ΚΗΜΔΗΣ</SlimTitle>
            <KhmdhsFreshnessBadge freshness={freshness} compact title={freshness?.label} />
          </SlimHeaderLeft>
          <SlimHeaderActions>
            <SlimProgress>
              {fullGraph
                ? `${graphNodeCount} κρίκοι`
                : `${progress.filled}/${progress.total} στάδια`}
            </SlimProgress>
            {showRefreshButton && typeof onRefresh === 'function' && (
              <RefreshBtn
                type="button"
                disabled={refreshLoading}
                title="Ανανέωση δεδομένων από ΚΗΜΔΗΣ"
                onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              >
                {refreshLoading ? '⏳' : '↻'} Ανανέωση
              </RefreshBtn>
            )}
          </SlimHeaderActions>
        </SlimHeader>
        <SlimProgressBar>
          <SlimProgressFill $pct={progress.pct} />
        </SlimProgressBar>
        <SlimBody>
          <StepsScrollLane
            stepWidth={stepWidth}
            slim
            compact
            stageCount={laneCount}
          >
            <SlimStepsRow>
            {fullGraph ? columns.map((col, idx) => {
              const stage = col.primary;
              const visual = nodeVisual(stage, true);
              const next = columns[idx + 1]?.primary;
              const tone = next ? connectorTone(stage, next) : 'pending';
              const isClickable = stage.clickable;
              const isActive = stage.status === 'complete' || stage.status === 'current' || stage.status === 'skipped';

              return (
                <SlimStepWrap
                  key={col.key}
                  $graph
                  $clickable={isClickable}
                  title={buildNodeTooltip(stage)}
                >
                  {idx < columns.length - 1 && (
                    <SlimConnector
                      $tone={tone}
                      $from={stage.accent}
                      $to={next?.accent || '#e2e8f0'}
                    />
                  )}
                  <GraphColumnStack>
                    <div
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={isClickable ? () => scrollToStage(stage) : undefined}
                      onKeyDown={isClickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') scrollToStage(stage);
                      } : undefined}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                    >
                      <SlimNode
                        $muted={visual.muted}
                        $border={visual.border}
                        $bg={visual.bg}
                        $color={visual.color}
                        $complete={stage.status === 'complete'}
                        $shadow={`${stage.accent}33`}
                      >
                        {visual.inner}
                      </SlimNode>
                      <SlimLabel $active={isActive} $accent={stage.accentDark}>
                        {stage.shortLabel}
                      </SlimLabel>
                      {stage.adam && isActive && (
                        <SlimAdamChip
                          $accent={stage.accentDark}
                          $bg={stage.bg}
                          $border={stage.border}
                          $copied={copiedId === stage.key}
                          title={copiedId === stage.key ? '✓ Αντιγράφηκε!' : `${stage.adam} — κλικ για αντιγραφή`}
                          onClick={(e) => handleCopyAdam(e, stage.key, stage.adam)}
                        >
                          {copiedId === stage.key ? '✓' : truncateAdam(stage.adam, true)}
                        </SlimAdamChip>
                      )}
                      {stage.badge && isActive && (
                        <BadgeChip
                          $accent={stage.accentDark}
                          $bg={stage.bg}
                          $border={stage.border}
                          title={stage.badge}
                        >
                          {stage.badge}
                        </BadgeChip>
                      )}
                    </div>
                    {col.secondaries.map((sec) => {
                      const secVisual = nodeVisual(sec, true);
                      const secActive = sec.status === 'complete' || sec.status === 'current';
                      return (
                        <SecondaryBranch key={sec.key} $accent={sec.accent}>
                          <div
                            role={sec.clickable ? 'button' : undefined}
                            tabIndex={sec.clickable ? 0 : undefined}
                            onClick={sec.clickable ? () => scrollToStage(sec) : undefined}
                            onKeyDown={sec.clickable ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') scrollToStage(sec);
                            } : undefined}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                            title={buildNodeTooltip(sec)}
                          >
                            <SecondaryNode
                              $border={secVisual.border}
                              $bg={secVisual.bg}
                              $color={secVisual.color}
                            >
                              {sec.icon}
                            </SecondaryNode>
                            <SecondaryLabel $accent={sec.accentDark}>{sec.shortLabel}</SecondaryLabel>
                            {sec.badge && secActive && (
                              <BadgeChip
                                $accent={sec.accentDark}
                                $bg={sec.bg}
                                $border={sec.border}
                                title={sec.badge}
                              >
                                {sec.badge}
                              </BadgeChip>
                            )}
                            {sec.adam && secActive && (
                              <SlimAdamChip
                                $accent={sec.accentDark}
                                $bg={sec.bg}
                                $border={sec.border}
                                $copied={copiedId === sec.key}
                                title={copiedId === sec.key ? '✓ Αντιγράφηκε!' : `${sec.adam} — κλικ για αντιγραφή`}
                                onClick={(e) => handleCopyAdam(e, sec.key, sec.adam)}
                              >
                                {copiedId === sec.key ? '✓' : truncateAdam(sec.adam, true)}
                              </SlimAdamChip>
                            )}
                          </div>
                        </SecondaryBranch>
                      );
                    })}
                  </GraphColumnStack>
                </SlimStepWrap>
              );
            }) : stages.map((stage, idx) => {
              const visual = nodeVisual(stage, true);
              const next = stages[idx + 1];
              const tone = next ? connectorTone(stage, next) : 'pending';
              const isClickable = stage.status === 'complete' || stage.status === 'current';
              const isActive = stage.status === 'complete' || stage.status === 'current' || stage.status === 'skipped';

              return (
                <SlimStepWrap
                  key={stage.id}
                  $clickable={isClickable}
                  onClick={isClickable ? () => scrollToStage(stage) : undefined}
                  title={buildStageTooltip(stage)}
                >
                  {idx < stages.length - 1 && (
                    <SlimConnector
                      $tone={tone}
                      $from={stage.accent}
                      $to={next?.accent || '#e2e8f0'}
                    />
                  )}
                  <SlimNode
                    $muted={visual.muted}
                    $border={visual.border}
                    $bg={visual.bg}
                    $color={visual.color}
                    $complete={stage.status === 'complete'}
                    $shadow={`${stage.accent}33`}
                  >
                    {visual.inner}
                  </SlimNode>
                  <SlimLabel $active={isActive} $accent={stage.accentDark}>
                    {stage.shortLabel}
                  </SlimLabel>
                  {stage.adam && isActive && (
                    <SlimAdamChip
                      $accent={stage.accentDark}
                      $bg={stage.bg}
                      $border={stage.border}
                      $copied={copiedId === stage.id}
                      title={copiedId === stage.id ? '✓ Αντιγράφηκε!' : `${stage.adam} — κλικ για αντιγραφή`}
                      onClick={(e) => handleCopyAdam(e, stage.id, stage.adam)}
                    >
                      {copiedId === stage.id ? '✓' : truncateAdam(stage.adam, true)}
                    </SlimAdamChip>
                  )}
                  {stage.extraLabel && isActive && (
                    <SlimExtraChip title={stage.extraLabel}>{stage.extraLabel}</SlimExtraChip>
                  )}
                </SlimStepWrap>
              );
            })}
            </SlimStepsRow>
          </StepsScrollLane>
        </SlimBody>
      </RailShell>
    );
  }

  return (
    <RailShell
      $compact={compact}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {showHeader && (
        <>
          <RailHeader $compact={compact}>
            <RailTitle $compact={compact}>
              🔗 Αλυσίδα ΚΗΜΔΗΣ
              {freshness?.level && freshness.level !== 'none' ? (
                <span style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                  <KhmdhsFreshnessBadge freshness={freshness} compact />
                </span>
              ) : null}
            </RailTitle>
            <RailProgress>
              {progress.filled}/{progress.total} στάδια
            </RailProgress>
          </RailHeader>
          <ProgressBarTrack $compact={compact}>
            <ProgressBarFill $pct={progress.pct} />
          </ProgressBarTrack>
        </>
      )}
      <RailBody $compact={compact}>
        <StepsScrollLane
          stepWidth={stepWidth}
          slim={false}
          compact={compact}
          stageCount={stages.length}
        >
        <StepsRow $compact={compact}>
          {stages.map((stage, idx) => {
            const visual = nodeVisual(stage, compact);
            const tag = !compact ? statusTag(stage) : null;
            const next = stages[idx + 1];
            const tone = next
              ? connectorTone(stage, next)
              : 'pending';

            const isClickable = stage.status === 'complete' || stage.status === 'current';
            const handleNodeClick = isClickable ? () => scrollToStage(stage) : undefined;

            return (
              <StepWrap
                key={stage.id}
                $compact={compact}
                $stepWidth={stepWidth}
                $clickable={isClickable}
                onClick={handleNodeClick}
                title={isClickable ? `Μετάβαση στο ${stage.label}` : undefined}
              >
                {idx < stages.length - 1 && (
                  <Connector
                    $compact={compact}
                    $tone={tone}
                    $from={stage.accent}
                    $to={next?.accent || '#e2e8f0'}
                  />
                )}
                <NodeCircle
                  $compact={compact}
                  $status={stage.status}
                  $muted={visual.muted}
                  $border={visual.border}
                  $bg={visual.bg}
                  $color={visual.color}
                  $ring={visual.ring}
                  $shadow={visual.shadow}
                  title={stage.label}
                >
                  {visual.inner}
                </NodeCircle>
                <StepLabel
                  $compact={compact}
                  $active={stage.status === 'current' || stage.status === 'complete' || stage.status === 'skipped'}
                  $accent={stage.accentDark}
                >
                  {compact ? stage.shortLabel : stage.label}
                </StepLabel>
                {stage.adam && (stage.status === 'complete' || stage.status === 'current') && (
                  <AdamChip
                    $compact={compact}
                    $accent={stage.accentDark}
                    $bg={stage.bg}
                    $border={stage.border}
                    $copied={copiedId === stage.id}
                    title={copiedId === stage.id ? '✓ Αντιγράφηκε!' : `${stage.adam} — κλικ για αντιγραφή`}
                    onClick={(e) => handleCopyAdam(e, stage.id, stage.adam)}
                  >
                    {copiedId === stage.id ? '✓ Αντιγράφηκε' : truncateAdam(stage.adam, compact)}
                  </AdamChip>
                )}
                {stage.extraLabel && (
                  <AdamChip
                    $compact={compact}
                    $accent={stage.accentDark}
                    $bg={stage.bg}
                    $border={stage.border}
                    title={stage.extraLabel}
                  >
                    {stage.extraLabel}
                  </AdamChip>
                )}
                {tag && (
                  <StatusTag $bg={tag.bg} $color={tag.color} $border={tag.border}>
                    {tag.text}
                  </StatusTag>
                )}
              </StepWrap>
            );
          })}
        </StepsRow>
        </StepsScrollLane>
      </RailBody>
    </RailShell>
  );
}
