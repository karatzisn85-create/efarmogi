import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { groupedGuideFlows, roleGuideLabel } from '../utils/userGuide';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 12600;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const Sheet = styled.div`
  width: min(880px, 100%);
  max-height: min(86vh, 760px);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #fffbeb 0%, #ffffff 100%);
`;

const HeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0 0 4px;
  font-size: 1.05rem;
  color: #0f172a;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.4;
`;

const HeadActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const HeadTourBtn = styled.button`
  appearance: none;
  border: 1px solid #f59e0b;
  background: #fffbeb;
  color: #92400e;
  font-weight: 700;
  font-size: 0.78rem;
  border-radius: 10px;
  padding: 7px 12px;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #fef3c7; }
`;

const Close = styled.button`
  appearance: none;
  border: 1px solid #cbd5e1;
  background: #fff;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  color: #475569;
  font-size: 1rem;
  line-height: 1;
  &:hover { background: #f8fafc; }
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 36%) 1fr;
  min-height: 0;
  flex: 1;
  overflow: hidden;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const List = styled.div`
  overflow: auto;
  border-right: 1px solid #e2e8f0;
  padding: 8px 8px 12px;
  background: #f8fafc;
`;

const SectionLabel = styled.div`
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #94a3b8;
  padding: 10px 10px 4px;
`;

const FlowBtn = styled.button`
  appearance: none;
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid ${(p) => (p.$active ? '#f59e0b' : 'transparent')};
  background: ${(p) => (p.$active ? '#fffbeb' : 'transparent')};
  color: #0f172a;
  border-radius: 10px;
  padding: 9px 10px;
  margin-bottom: 3px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: ${(p) => (p.$active ? 750 : 600)};
  line-height: 1.35;
  &:hover { background: ${(p) => (p.$active ? '#fffbeb' : '#fff')}; }
`;

const Detail = styled.div`
  overflow: auto;
  padding: 18px 20px 20px;
`;

const DetailKicker = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #b45309;
  margin-bottom: 6px;
`;

const DetailTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 1.05rem;
  color: #0f172a;
  line-height: 1.35;
`;

const DetailBody = styled.p`
  margin: 0 0 12px;
  font-size: 0.9rem;
  line-height: 1.55;
  color: #334155;
`;

const Points = styled.ul`
  margin: 0 0 18px;
  padding: 0 0 0 1.1rem;
  color: #334155;
  font-size: 0.86rem;
  line-height: 1.5;

  li { margin-bottom: 6px; }
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Primary = styled.button`
  appearance: none;
  border: none;
  background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
  color: #fff;
  font-weight: 750;
  font-size: 0.85rem;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
`;

export default function UserGuideModal({
  open = false,
  role,
  canManageKhmdhs = false,
  onClose,
  onStartTour,
  onShowTarget,
}) {
  const groups = useMemo(
    () => groupedGuideFlows({ role, canManageKhmdhs }),
    [role, canManageKhmdhs]
  );
  const allFlows = useMemo(() => groups.flatMap((g) => g.flows), [groups]);
  const [activeId, setActiveId] = useState(null);
  const resolvedId = allFlows.some((f) => f.id === activeId) ? activeId : allFlows[0]?.id;
  const active = allFlows.find((f) => f.id === resolvedId) || allFlows[0];

  if (!open) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose?.()} role="presentation">
      <Sheet role="dialog" aria-labelledby="user-guide-title" aria-modal="true">
        <Head>
          <HeadText>
            <Title id="user-guide-title">Οδηγός χρήσης</Title>
            <Sub>
              Κάρτες ανά τμήμα της εφαρμογής, για {roleGuideLabel(role)}.
              Διαλέξτε θέμα αριστερά και πατήστε «Δείξε μου πού είναι» για να φωτιστεί αυτό το σημείο.
            </Sub>
          </HeadText>
          <HeadActions>
            <HeadTourBtn type="button" onClick={onStartTour}>
              Ξενάγηση δομής (4 βήματα)
            </HeadTourBtn>
            <Close type="button" onClick={onClose} aria-label="Κλείσιμο">×</Close>
          </HeadActions>
        </Head>
        <Body>
          <List>
            {groups.map((group) => (
              <div key={group.id}>
                {group.title ? <SectionLabel>{group.title}</SectionLabel> : null}
                {group.flows.map((flow) => (
                  <FlowBtn
                    key={flow.id}
                    type="button"
                    $active={flow.id === active?.id}
                    onClick={() => setActiveId(flow.id)}
                  >
                    {flow.title}
                  </FlowBtn>
                ))}
              </div>
            ))}
          </List>
          <Detail>
            {active && (
              <>
                {active.sectionTitle ? (
                  <DetailKicker>{active.sectionTitle}</DetailKicker>
                ) : null}
                <DetailTitle>{active.title}</DetailTitle>
                <DetailBody>{active.body}</DetailBody>
                {active.points?.length > 0 && (
                  <Points>
                    {active.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </Points>
                )}
                <Row>
                  {active.target && (
                    <Primary
                      type="button"
                      onClick={() => onShowTarget?.(active)}
                    >
                      Δείξε μου πού είναι
                    </Primary>
                  )}
                </Row>
              </>
            )}
          </Detail>
        </Body>
      </Sheet>
    </Overlay>
  );
}
