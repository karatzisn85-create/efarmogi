import React, { useCallback, useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

const STORAGE_PREFIX = 'ergohub-dashboard-overview-expanded';
const LEGACY_STORAGE_KEY = 'ergohub-dashboard-overview-expanded';

function storageKeyForUser(username) {
  const key = String(username || '').trim().toLowerCase();
  return key ? `${STORAGE_PREFIX}:${key}` : LEGACY_STORAGE_KEY;
}

function readExpandedPreference(username) {
  try {
    const userKey = storageKeyForUser(username);
    const raw = localStorage.getItem(userKey);
    if (raw === '1') return true;
    if (raw === '0') return false;
    if (userKey !== LEGACY_STORAGE_KEY) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === '1') return true;
      if (legacy === '0') return false;
    }
  } catch { /* ignore */ }
  return false;
}

const expandSheen = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const Zone = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: ${(p) => (p.$embedded ? '0' : '16px')};
  border: ${(p) => (p.$embedded ? 'none' : '1px solid rgba(180, 83, 9, 0.22)')};
  background: ${(p) => (p.$embedded
    ? 'transparent'
    : 'linear-gradient(165deg, #fffbf5 0%, #fff7ed 48%, #faf6f1 100%)')};
  box-shadow: ${(p) => (p.$embedded ? 'none' : '0 1px 3px rgba(120, 53, 15, 0.05)')};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.95rem 0.65rem 1.05rem;
`;

const TitleBlock = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.16rem;
`;

const Title = styled.span`
  font-size: 0.9rem;
  font-weight: 850;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9a3412;
`;

const Subtitle = styled.span`
  font-size: 0.82rem;
  font-weight: 500;
  color: #78716c;
  line-height: 1.35;
`;

const ExpandBtn = styled.button`
  appearance: none;
  flex-shrink: 0;
  border: 1px solid rgba(180, 83, 9, 0.38);
  background: ${(p) => (p.$open
    ? 'linear-gradient(135deg, #e7e5e4 0%, #f5f5f4 100%)'
    : 'linear-gradient(110deg, #9a3412 0%, #c2410c 35%, #ea580c 55%, #c2410c 75%, #9a3412 100%)')};
  background-size: ${(p) => (p.$open ? 'auto' : '220% 100%')};
  color: ${(p) => (p.$open ? '#44403c' : '#ffffff')};
  border-radius: 999px;
  padding: 0.42rem 0.95rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  box-shadow: ${(p) => (p.$open
    ? 'none'
    : '0 4px 14px rgba(154, 52, 18, 0.22)')};
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  ${(p) => (!p.$open && css`animation: ${expandSheen} 4.5s linear infinite;`)}

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(154, 52, 18, 0.28);
    border-color: rgba(180, 83, 9, 0.55);
  }

  &:focus-visible {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }
`;

const Chevron = styled.span`
  font-size: 0.68rem;
  font-weight: 800;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
  transition: transform 0.18s ease;
`;

const Compact = styled.div`
  display: ${(p) => (p.$visible ? 'flex' : 'none')};
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 0.85rem 0.95rem;
`;

const CompactPrimary = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.55rem;
`;

const StatCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.85rem 0.65rem;
  border-radius: 14px;
  background: ${(p) => p.$bg || '#ffffff'};
  border: 1px solid ${(p) => p.$border || 'rgba(231, 229, 228, 0.95)'};
  min-width: 0;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85) inset,
    0 6px 16px rgba(120, 53, 15, 0.04);
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${(p) => p.$accent || 'rgba(217, 119, 6, 0.55)'};
  }
`;

const StatValue = styled.span`
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: ${(p) => p.$color || '#1c1917'};
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  padding-left: 0.15rem;
`;

const StatLabel = styled.span`
  font-size: 0.88rem;
  font-weight: 650;
  color: ${(p) => p.$muted || '#78716c'};
  line-height: 1.3;
  padding-left: 0.15rem;
`;

const BreakdownWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.55rem 0.6rem 0.6rem;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.9) 0%, rgba(250, 246, 241, 0.96) 100%);
  border: 1px solid rgba(180, 83, 9, 0.16);
`;

const BreakdownCaption = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9a3412;
  padding: 0 0.2rem;
  opacity: 0.9;
`;

const BreakdownGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const BreakdownItem = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.45rem 0.55rem 0.45rem 0.7rem;
  border-radius: 10px;
  background: ${(p) => p.$bg || '#ffffff'};
  border: 1px solid ${(p) => p.$border || 'rgba(231, 229, 228, 0.95)'};
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 20%;
    bottom: 20%;
    width: 3px;
    border-radius: 999px;
    background: ${(p) => p.$accent || '#a8a29e'};
  }
`;

const BreakdownValue = styled.span`
  font-size: 1.18rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: ${(p) => p.$color || '#1c1917'};
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
`;

const BreakdownLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 650;
  color: ${(p) => p.$muted || '#78716c'};
  line-height: 1.35;
  max-width: 100%;
`;

const Body = styled.div`
  display: ${(p) => (p.$open ? 'flex' : 'none')};
  flex-direction: column;
  gap: 1.25rem;
  padding: 0 0.85rem 0.95rem;
  border-top: 1px solid rgba(253, 230, 138, 0.65);
  background: linear-gradient(180deg, #fff7ed 0%, #faf6f1 100%);
`;

/**
 * Ζώνη επισκόπησης: συμπαγή βασικά νούμερα από προεπιλογή· πλήρης ανάπτυξη κατόπιν επιλογής.
 * Η επιλογή ανοίγματος/συμπτύξης αποθηκεύεται ανά χρήστη.
 */
export default function DashboardOverviewZone({
  children,
  username = '',
  stats = [],
  breakdown = [],
  embedded = false,
  subtitleCollapsed = 'Βασική εικόνα της κεντρικής οθόνης',
  subtitleExpanded = 'Πλήρης επισκόπηση — σύμπτυξη για να δείτε αμέσως τα έργα',
}) {
  const [open, setOpen] = useState(() => readExpandedPreference(username));
  const [mounted, setMounted] = useState(() => readExpandedPreference(username));
  const [prefUser, setPrefUser] = useState(username);

  useEffect(() => {
    if (username === prefUser) return;
    const next = readExpandedPreference(username);
    setOpen(next);
    setMounted(next);
    setPrefUser(username);
  }, [username, prefUser]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyForUser(username), open ? '1' : '0');
    } catch { /* ignore */ }
    if (open) setMounted(true);
  }, [open, username]);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <Zone $embedded={embedded} aria-label="Επισκόπηση">
      <Header>
        <TitleBlock>
          <Title>Αναλυτική σύνοψη</Title>
          <Subtitle>{open ? subtitleExpanded : subtitleCollapsed}</Subtitle>
        </TitleBlock>
        <ExpandBtn
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="dashboard-overview-body"
          $open={open}
        >
          <Chevron $open={open} aria-hidden="true">▶</Chevron>
          {open ? 'Σύμπτυξη' : 'Ανάπτυξη'}
        </ExpandBtn>
      </Header>

      <Compact $visible={!open} aria-hidden={open}>
        <CompactPrimary>
          {stats.map((stat) => (
            <StatCard
              key={stat.key || stat.label}
              $bg={stat.bg}
              $border={stat.border}
              $accent={stat.accent}
            >
              <StatValue $color={stat.color}>{stat.value}</StatValue>
              <StatLabel $muted={stat.muted}>{stat.label}</StatLabel>
            </StatCard>
          ))}
        </CompactPrimary>

        {breakdown.length > 0 && (
          <BreakdownWrap aria-label="Ανάλυση υποέργων κατά κατάσταση">
            <BreakdownCaption>Ανάλυση υποέργων</BreakdownCaption>
            <BreakdownGrid>
              {breakdown.map((item) => (
                <BreakdownItem
                  key={item.key || item.label}
                  title={item.title || item.label}
                  $bg={item.bg}
                  $border={item.border}
                  $accent={item.accent}
                >
                  <BreakdownValue $color={item.color}>{item.value}</BreakdownValue>
                  <BreakdownLabel $muted={item.muted}>{item.label}</BreakdownLabel>
                </BreakdownItem>
              ))}
            </BreakdownGrid>
          </BreakdownWrap>
        )}
      </Compact>

      <Body id="dashboard-overview-body" $open={open} aria-hidden={!open}>
        {mounted ? children : null}
      </Body>
    </Zone>
  );
}
