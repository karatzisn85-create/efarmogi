import React, { Suspense, useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';

const LazyChunkFallback = styled.div`
  padding: 0.85rem 1rem;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
`;

const Stack = styled.div`
  position: fixed;
  right: 24px;
  bottom: 86px;
  z-index: 9000;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: 0.75rem;
  pointer-events: none;
`;

const FabWrap = styled.div`
  position: relative;
  pointer-events: all;
`;

const fabPulseAlert = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35), 0 6px 20px rgba(15, 23, 42, 0.18); }
  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0), 0 8px 24px rgba(220, 38, 38, 0.28); }
`;

const fabSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const khmdhsOrbit = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const khmdhsBreath = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 0 rgba(45, 212, 191, 0.35),
      0 8px 28px rgba(13, 148, 136, 0.42),
      0 2px 8px rgba(15, 23, 42, 0.12);
    transform: translateY(0) scale(1);
  }
  50% {
    box-shadow:
      0 0 0 10px rgba(45, 212, 191, 0),
      0 12px 36px rgba(13, 148, 136, 0.5),
      0 4px 12px rgba(15, 23, 42, 0.14);
    transform: translateY(-3px) scale(1.03);
  }
`;

const khmdhsAlertPulse = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 0 rgba(245, 158, 11, 0.45),
      0 8px 28px rgba(217, 119, 6, 0.45);
  }
  50% {
    box-shadow:
      0 0 0 12px rgba(245, 158, 11, 0),
      0 12px 36px rgba(217, 119, 6, 0.55);
  }
`;

const OpsFab = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: ${(p) => (p.$alert
    ? 'linear-gradient(135deg, #ea580c 0%, #f59e0b 55%, #fbbf24 100%)'
    : 'linear-gradient(135deg, #0f766e 0%, #14b8a6 60%, #5eead4 100%)')};
  box-shadow: 0 6px 20px ${(p) => (p.$alert ? 'rgba(217, 119, 6, 0.4)' : 'rgba(13, 148, 136, 0.35)')};

  ${(p) => p.$alert && css`
    animation: ${fabPulseAlert} 2.2s ease-in-out infinite;
  `}

  ${(p) => p.$active && css`
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 2px;
  `}

  &:hover {
    transform: translateY(-3px) scale(1.08);
    animation: none;
  }

  &:active {
    transform: translateY(-1px) scale(0.96);
  }
`;

/** Ξεχωριστό «ήρωας» κουμπί για μαζική ανανέωση ΚΗΜΔΗΣ */
const KhmdhsHeroFab = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  background: ${(p) => (p.$alert
    ? 'linear-gradient(160deg, #f59e0b 0%, #0f766e 48%, #115e59 100%)'
    : 'linear-gradient(160deg, #2dd4bf 0%, #14b8a6 38%, #0f766e 72%, #115e59 100%)')};
  box-shadow:
    0 8px 28px rgba(13, 148, 136, 0.45),
    0 2px 8px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow: visible;

  ${(p) => {
    if (p.$running) return 'animation: none;';
    if (p.$alert) return css`animation: ${khmdhsAlertPulse} 2s ease-in-out infinite;`;
    return css`animation: ${khmdhsBreath} 3.2s ease-in-out infinite;`;
  }}

  ${(p) => p.$active && css`
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  `}

  &:hover {
    transform: translateY(-4px) scale(1.08);
    animation: none;
    box-shadow:
      0 14px 40px rgba(13, 148, 136, 0.55),
      0 4px 14px rgba(15, 23, 42, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.45);
  }

  &:active {
    transform: translateY(-1px) scale(0.97);
  }
`;

const KhmdhsOrbit = styled.span`
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1.5px dashed rgba(45, 212, 191, 0.55);
  pointer-events: none;
  animation: ${khmdhsOrbit} 10s linear infinite;
  ${(p) => p.$alert && css`
    border-color: rgba(251, 191, 36, 0.65);
    animation-duration: 6s;
  `}
  ${(p) => p.$running && css`
    border-style: solid;
    border-color: rgba(45, 212, 191, 0.75);
    animation-duration: 1.4s;
  `}
`;

const KhmdhsIconChip = styled.span`
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  background: linear-gradient(145deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow:
    0 4px 12px rgba(37, 99, 235, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.35);
`;

const FabBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #dc2626;
  color: #fff;
  font-size: 0.58rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 2;
`;

const FabSpinIcon = styled.span`
  display: inline-block;
  animation: ${fabSpin} 1s linear infinite;
`;

const FabTip = styled.span`
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: #1e293b;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 3;

  ${FabWrap}:hover & {
    opacity: 1;
  }
`;

const Panel = styled.div`
  position: fixed;
  right: 88px;
  bottom: 86px;
  z-index: 9050;
  width: min(440px, calc(100vw - 110px));
  max-height: min(72vh, 640px);
  overflow: auto;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(13, 148, 136, 0.22);
  box-shadow:
    0 18px 48px rgba(15, 23, 42, 0.16),
    0 2px 8px rgba(13, 148, 136, 0.1);
  pointer-events: ${(p) => (p.$open ? 'all' : 'none')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  transform: ${(p) => (p.$open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)')};
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem 0.45rem 0.85rem;
  border-bottom: 1px solid rgba(226, 232, 240, 0.95);
  background: linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%);
  position: sticky;
  top: 0;
  z-index: 1;
`;

const PanelTitle = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0f766e;
`;

const PanelClose = styled.button`
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: #fff;
  color: #475569;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  font-size: 0.85rem;
  cursor: pointer;
  line-height: 1;
  &:hover:not(:disabled) { background: #f8fafc; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const PanelBody = styled.div`
  padding: 0.55rem;
`;

/**
 * Αιωρούμενα κουμπιά για μαζική ανανέωση ΚΗΜΔΗΣ και ραντάρ προθεσμιών,
 * πάνω από το κουμπί γρήγορων σημειώσεων.
 */
export default function DashboardOpsFabStack({
  visible = true,
  canManageKhmdhs = false,
  khmdhsBatchRunning = false,
  staleCount = 0,
  oldestDays = null,
  KhmdhsBatchRefreshWidget,
  CalendarDeadlineWidget,
  khmdhsWidgetProps = {},
  deadlineWidgetProps = {},
}) {
  const [khmdhsOpen, setKhmdhsOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineSummary, setDeadlineSummary] = useState({ totalCount: 0, hasUrgent: false });

  useEffect(() => {
    if (khmdhsBatchRunning) setKhmdhsOpen(true);
  }, [khmdhsBatchRunning]);

  useEffect(() => {
    if (!visible) {
      if (!khmdhsBatchRunning) setKhmdhsOpen(false);
      setDeadlineOpen(false);
    }
  }, [visible, khmdhsBatchRunning]);

  const showUi = visible || khmdhsBatchRunning;
  if (!showUi) return null;

  const showStack = visible;
  const khmdhsAlert = !khmdhsBatchRunning && staleCount > 0;
  const deadlineBadge = deadlineSummary.totalCount > 0 ? deadlineSummary.totalCount : null;

  const khmdhsTip = khmdhsBatchRunning
    ? 'Μαζική ανανέωση σε εξέλιξη…'
    : staleCount > 0
      ? `Μαζική ανανέωση ΚΗΜΔΗΣ — ${staleCount} για ανανέωση${oldestDays ? ` · έως ${oldestDays} ημ.` : ''}`
      : 'Μαζική ανανέωση ΚΗΜΔΗΣ';

  const deadlineTip = deadlineSummary.totalCount > 0
    ? `Ραντάρ προθεσμιών — ${deadlineSummary.totalCount} λήξεις${deadlineSummary.hasUrgent ? ' · επείγουσες' : ''}`
    : 'Ραντάρ προθεσμιών';

  const khmdhsPanelOpen = khmdhsOpen || khmdhsBatchRunning;
  const deadlinePanelOpen = showStack && deadlineOpen && !khmdhsBatchRunning;

  return (
    <>
      {showStack && (
        <Stack aria-label="Γρήγορες διαδικασίες ελέγχου">
          <FabWrap>
            <OpsFab
              type="button"
              $tone="deadline"
              $alert={!!deadlineSummary.hasUrgent}
              $active={deadlineOpen}
              onClick={() => {
                if (khmdhsBatchRunning) return;
                setDeadlineOpen((v) => !v);
                setKhmdhsOpen(false);
              }}
              aria-expanded={deadlineOpen}
              aria-label={deadlineTip}
              title={khmdhsBatchRunning ? 'Διαθέσιμο μετά τη μαζική ανανέωση' : undefined}
            >
              <FabTip>{deadlineTip}</FabTip>
              ⏳
              {deadlineBadge != null && <FabBadge>{deadlineBadge > 99 ? '99+' : deadlineBadge}</FabBadge>}
            </OpsFab>
          </FabWrap>

          {canManageKhmdhs && (
            <FabWrap>
              <KhmdhsHeroFab
                type="button"
                $alert={khmdhsAlert}
                $running={khmdhsBatchRunning}
                $active={khmdhsOpen}
                onClick={() => {
                  setKhmdhsOpen((v) => !v);
                  setDeadlineOpen(false);
                }}
                aria-expanded={khmdhsOpen}
                aria-label={khmdhsTip}
              >
                <FabTip>{khmdhsTip}</FabTip>
                <KhmdhsOrbit $alert={khmdhsAlert} $running={khmdhsBatchRunning} aria-hidden />
                <KhmdhsIconChip aria-hidden>
                  {khmdhsBatchRunning ? <FabSpinIcon>⟳</FabSpinIcon> : '🔄'}
                </KhmdhsIconChip>
                {khmdhsAlert && <FabBadge>{staleCount > 99 ? '99+' : staleCount}</FabBadge>}
              </KhmdhsHeroFab>
            </FabWrap>
          )}
        </Stack>
      )}

      {/* Πάνελ προθεσμιών — πάντα mounted όσο φαίνεται η στοίβα, για ενημέρωση σήματος */}
      {showStack && CalendarDeadlineWidget && (
        <Panel $open={deadlinePanelOpen} role="dialog" aria-label="Ραντάρ προθεσμιών" aria-hidden={!deadlinePanelOpen}>
          <PanelHead>
            <PanelTitle>Ραντάρ προθεσμιών</PanelTitle>
            <PanelClose type="button" onClick={() => setDeadlineOpen(false)} aria-label="Κλείσιμο">✕</PanelClose>
          </PanelHead>
          <PanelBody>
            <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
              <CalendarDeadlineWidget
                {...deadlineWidgetProps}
                compact
                panelMode
                onSummaryChange={setDeadlineSummary}
              />
            </Suspense>
          </PanelBody>
        </Panel>
      )}

      {canManageKhmdhs && KhmdhsBatchRefreshWidget && (
        <Panel
          $open={khmdhsPanelOpen}
          role="dialog"
          aria-label="Μαζική ανανέωση ΚΗΜΔΗΣ"
          aria-hidden={!khmdhsPanelOpen}
        >
          <PanelHead>
            <PanelTitle>Μαζική ανανέωση ΚΗΜΔΗΣ</PanelTitle>
            <PanelClose
              type="button"
              onClick={() => setKhmdhsOpen(false)}
              aria-label="Κλείσιμο"
              disabled={khmdhsBatchRunning}
              title={khmdhsBatchRunning ? 'Η ανανέωση είναι σε εξέλιξη' : 'Κλείσιμο'}
            >
              ✕
            </PanelClose>
          </PanelHead>
          <PanelBody>
            <Suspense fallback={<LazyChunkFallback>Φόρτωση…</LazyChunkFallback>}>
              <KhmdhsBatchRefreshWidget
                {...khmdhsWidgetProps}
                compact
              />
            </Suspense>
          </PanelBody>
        </Panel>
      )}
    </>
  );
}
