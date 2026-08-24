import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { scrollGuideTargetIntoView } from '../utils/userGuide';

const Z = 12500;

const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${Z};
  pointer-events: none;
`;

const Mask = styled.div`
  position: absolute;
  background: rgba(15, 23, 42, 0.58);
  pointer-events: auto;
`;

const HoleRing = styled.div`
  position: absolute;
  pointer-events: none;
  border-radius: 16px;
  box-shadow:
    0 0 0 3px rgba(251, 191, 36, 0.95),
    0 12px 32px rgba(15, 23, 42, 0.28);
  z-index: 1;
`;

const Coach = styled.div`
  position: fixed;
  z-index: ${Z + 1};
  width: min(400px, calc(100vw - 32px));
  max-height: min(70vh, 520px);
  overflow: auto;
  pointer-events: auto;
  background: #fff;
  color: #0f172a;
  border-radius: 16px;
  border: 1px solid rgba(180, 83, 9, 0.22);
  box-shadow:
    0 18px 48px rgba(15, 23, 42, 0.22),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
  padding: 16px 16px 14px;
`;

const Kicker = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #b45309;
  margin-bottom: 6px;
`;

const Title = styled.div`
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
  line-height: 1.3;
`;

const Body = styled.p`
  margin: 0 0 12px;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #334155;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Primary = styled.button`
  appearance: none;
  border: none;
  background: linear-gradient(135deg, #b45309 0%, #d97706 60%, #f59e0b 100%);
  color: #fff;
  font-weight: 750;
  font-size: 0.85rem;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
  &:hover { filter: brightness(1.05); }
`;

const Ghost = styled.button`
  appearance: none;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  font-weight: 650;
  font-size: 0.82rem;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  &:hover { background: #f8fafc; }
`;

const Skip = styled.button`
  appearance: none;
  margin-left: auto;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
  padding: 6px 4px;
  &:hover { color: #334155; }
`;

const Diagram = styled.div`
  margin: 0 0 12px;
  padding: 10px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
`;

const ActBox = styled.div`
  border-radius: 10px;
  padding: 8px;
  border: 1.5px solid ${(p) => (p.$on ? '#d97706' : '#c7d2fe')};
  background: ${(p) => (p.$on ? '#fffbeb' : '#fff')};
`;

const ActLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6366f1;
  margin-bottom: 6px;
`;

const MiniCard = styled.div`
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border: 1.5px solid ${(p) => (p.$on ? '#d97706' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#fffbeb' : '#f8fafc')};
  font-size: 0.72rem;
  color: #334155;
`;

const MiniBtns = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;

const MiniBtn = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid ${(p) => (p.$on ? '#d97706' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#fef3c7' : '#fff')};
  color: #334155;
`;

const MiniTabs = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
`;

const MiniTab = styled.span`
  font-size: 0.68rem;
  font-weight: 750;
  padding: 4px 8px;
  border-radius: 8px;
  background: ${(p) => (p.$on ? '#1e293b' : '#e2e8f0')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
`;

function measureSelector(selector) {
  if (!selector || typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function StructureDiagram({ stepId }) {
  const onAct = stepId === 'act-group' || stepId === 'home';
  const onBody = stepId === 'card-body' || stepId === 'card';
  const onBtns = stepId === 'card-actions' || stepId === 'files';
  const onTabs = stepId === 'detail-tabs';
  return (
    <Diagram aria-hidden>
      <ActBox $on={onAct}>
        <ActLabel>Πράξη</ActLabel>
        <MiniCard $on={onBody || onBtns || onTabs}>
          Υποέργο — βασικά στοιχεία
          <MiniBtns>
            <MiniBtn $on={onBtns}>Ένταξη</MiniBtn>
            <MiniBtn $on={onBtns}>Πρόσκληση</MiniBtn>
            <MiniBtn $on={onBtns}>Έγκριση</MiniBtn>
            <MiniBtn $on={onBtns}>Μελέτη</MiniBtn>
          </MiniBtns>
          {onTabs && (
            <MiniTabs>
              <MiniTab $on>Α — Στοιχεία</MiniTab>
              <MiniTab $on>Β — ΚΗΜΔΗΣ</MiniTab>
            </MiniTabs>
          )}
        </MiniCard>
        <MiniCard>Υποέργο</MiniCard>
      </ActBox>
    </Diagram>
  );
}

/**
 * Ξενάγηση με φωτισμό πραγματικού σημείου στην οθόνη.
 * Αν λείπει το σημείο (π.χ. κενό χαρτοφυλάκιο), δείχνει το ίδιο σχήμα δομής.
 */
export default function UserGuideTour({
  active = false,
  stepIndex = 0,
  steps = [],
  showDiagram = false,
  headerOffset,
  onNext,
  onBack,
  onSkip,
}) {
  const step = steps[stepIndex] || null;
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || !step?.target) {
      return undefined;
    }
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const result = scrollGuideTargetIntoView(step.target, {
        headerOffset,
      });
      attempts += 1;
      if (!result.ok && attempts < 14) {
        window.setTimeout(tryScroll, 90);
      }
    };
    const start = window.setTimeout(tryScroll, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [active, step, headerOffset]);

  useEffect(() => {
    if (!active || !step?.target) {
      setRect(null);
      return undefined;
    }
    let frame = 0;
    const measure = () => setRect(measureSelector(step.target));
    measure();
    const onWin = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    const iv = setInterval(measure, 200);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      clearInterval(iv);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, step]);

  const hole = useMemo(() => {
    if (!rect) return null;
    const pad = 8;
    return {
      top: Math.max(0, rect.top - pad),
      left: Math.max(0, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
  }, [rect]);

  if (!active || !step) return null;

  const isLast = stepIndex >= steps.length - 1;
  const total = steps.length;
  const needDiagram = showDiagram || !hole;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let coachStyle = { left: 20, bottom: 24 };
  if (hole) {
    const overlapsBottomLeft = hole.left < 440 && (hole.top + hole.height) > vh - 260;
    if (overlapsBottomLeft && hole.top > 280) {
      coachStyle = { left: 20, top: 96 };
    } else if (overlapsBottomLeft) {
      coachStyle = { right: Math.min(96, Math.max(16, vw - hole.left + 12)), bottom: 24 };
    }
  }

  return (
    <Layer role="dialog" aria-label="Ξενάγηση εφαρμογής" aria-modal="true">
      {hole ? (
        <>
          <Mask style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <Mask style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <Mask style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <Mask style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <HoleRing
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : (
        <Mask style={{ inset: 0 }} />
      )}

      <Coach style={coachStyle}>
        <Kicker>{total > 1 ? `Οδηγός · ${stepIndex + 1} από ${total}` : 'Οδηγός'}</Kicker>
        <Title>{step.title}</Title>
        {needDiagram && <StructureDiagram stepId={step.id} />}
        <Body>{step.body}</Body>
        <Actions>
          {stepIndex > 0 && (
            <Ghost type="button" onClick={onBack}>Πίσω</Ghost>
          )}
          <Primary type="button" onClick={onNext}>
            {isLast ? 'Κατάλαβα' : 'Επόμενο'}
          </Primary>
          <Skip type="button" onClick={onSkip}>Θα το δω αργότερα</Skip>
        </Actions>
      </Coach>
    </Layer>
  );
}
