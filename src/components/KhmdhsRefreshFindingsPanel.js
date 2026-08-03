import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  KHMDHS_FINDING_ACTION,
  KHMDHS_FINDING_OUTCOME,
  khmdhsFindingsNeedAttention,
} from '../utils/khmdhsRefreshFindings';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const softPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.22); }
  50% { box-shadow: 0 0 0 7px rgba(234, 88, 12, 0); }
`;

const Panel = styled.div`
  animation: ${fadeIn} 0.25s ease;
  position: relative;
  margin-bottom: 0.9rem;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${(p) => (p.$attention ? '#fed7aa' : '#bae6fd')};
  background: ${(p) => (p.$attention
    ? 'linear-gradient(135deg, #fffbf5 0%, #fff7ed 100%)'
    : 'linear-gradient(135deg, #f8fbff 0%, #f0f9ff 100%)')};

  ${(p) => p.$attention && css`animation: ${fadeIn} 0.25s ease, ${softPulse} 3s ease-in-out 3;`}
`;

const Head = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  width: 100%;
  padding: 0.75rem 0.9rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
`;

const HeadIcon = styled.span`
  flex-shrink: 0;
  font-size: 1.05rem;
  line-height: 1.2;
`;

const HeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  color: ${(p) => (p.$attention ? '#9a3412' : '#075985')};
  line-height: 1.3;
`;

const Sub = styled.div`
  margin-top: 2px;
  font-size: 0.67rem;
  font-weight: 500;
  color: #64748b;
  line-height: 1.4;
`;

const Chevron = styled.span`
  flex-shrink: 0;
  font-size: 0.6rem;
  color: #94a3b8;
  transition: transform 0.2s;
  margin-top: 0.25rem;
  ${(p) => p.$open && 'transform: rotate(90deg);'}
`;

const Body = styled.div`
  padding: 0 0.9rem 0.85rem;
`;

const GroupLabel = styled.div`
  margin: 0.5rem 0 0.25rem;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: ${(p) => p.$color || '#0f766e'};
`;

const Line = styled.div`
  font-size: 0.7rem;
  line-height: 1.5;
  color: #334155;
  padding: 0.15rem 0 0.15rem 0.85rem;
  position: relative;

  &::before {
    content: '•';
    position: absolute;
    left: 0.15rem;
    color: ${(p) => p.$warn ? '#ea580c' : '#0d9488'};
    font-weight: 700;
  }
`;

const ActionCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-top: 0.4rem;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #fed7aa;
`;

const ActionIcon = styled.span`
  flex-shrink: 0;
  font-size: 0.95rem;
  line-height: 1.2;
`;

const ActionBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionTitle = styled.div`
  font-size: 0.73rem;
  font-weight: 800;
  color: #7c2d12;
  line-height: 1.3;
`;

const ActionDetail = styled.div`
  margin-top: 2px;
  font-size: 0.67rem;
  font-weight: 500;
  color: #9a3412;
  line-height: 1.45;
`;

const ActionCta = styled.button`
  margin-top: 0.4rem;
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: #fff;
  font-size: 0.66rem;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 2px 7px rgba(234, 88, 12, 0.3);
  &:hover { transform: translateY(-1px); }
`;

const ErrorBox = styled.div`
  margin-top: 0.45rem;
  padding: 0.55rem 0.7rem;
  border-radius: 9px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  font-size: 0.68rem;
  line-height: 1.45;
  color: #991b1b;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px dashed #e2e8f0;
`;

const FooterMeta = styled.div`
  font-size: 0.63rem;
  color: #94a3b8;
  font-weight: 500;
`;

const AckBtn = styled.button`
  padding: 0.35rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  font-size: 0.66rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const OUTCOME_HEAD = {
  [KHMDHS_FINDING_OUTCOME.APPLIED]: { icon: '✅', title: 'Η τελευταία ανανέωση ενημέρωσε στοιχεία' },
  [KHMDHS_FINDING_OUTCOME.ATTENTION]: { icon: '📌', title: 'Η τελευταία ανανέωση άφησε σημεία προς έλεγχο' },
  [KHMDHS_FINDING_OUTCOME.UNCHANGED]: { icon: '➖', title: 'Η τελευταία ανανέωση δεν βρήκε διαφορές' },
  [KHMDHS_FINDING_OUTCOME.INTERVENED]: { icon: '⚠️', title: 'Η μαζική ανανέωση σταμάτησε εδώ και περιμένει εσάς' },
  [KHMDHS_FINDING_OUTCOME.FAILED]: { icon: '❌', title: 'Η τελευταία ανανέωση δεν ολοκληρώθηκε' },
};

function formatWhen(iso) {
  const t = Date.parse(String(iso || ''));
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('el-GR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Αναφορά τελευταίας ανανέωσης ΚΗΜΔΗΣ μέσα στην επεξεργασία του υποέργου.
 * Παραμένει ορατή μέχρι ο χρήστης να δηλώσει ότι την είδε — και αποθηκεύεται μαζί
 * με το υποέργο, ώστε να μη χάνεται με το κλείσιμο της εφαρμογής.
 */
export default function KhmdhsRefreshFindingsPanel({ findings, onOpenReview, onAcknowledge }) {
  const needsAttention = khmdhsFindingsNeedAttention(findings);
  const [open, setOpen] = useState(needsAttention);

  if (!findings) return null;
  if (findings.acknowledgedAt && !(findings.appliedLines?.length)) return null;

  const head = OUTCOME_HEAD[findings.outcome] || OUTCOME_HEAD[KHMDHS_FINDING_OUTCOME.ATTENTION];
  const when = formatWhen(findings.at);
  const sourceLabel = findings.source === 'batch' ? 'μαζική ανανέωση' : 'ανανέωση υποέργου';
  const applied = findings.appliedLines || [];
  const attention = findings.attentionLines || [];
  const actions = findings.actions || [];

  const summaryParts = [];
  if (actions.length) summaryParts.push(`${actions.length} ενέργει${actions.length === 1 ? 'α' : 'ες'} για εσάς`);
  if (attention.length) summaryParts.push(`${attention.length} σημεί${attention.length === 1 ? 'ο' : 'α'} προσοχής`);
  if (applied.length) summaryParts.push(`${applied.length} αλλαγ${applied.length === 1 ? 'ή' : 'ές'}`);

  return (
    <Panel $attention={needsAttention}>
      <Head type="button" onClick={() => setOpen((v) => !v)}>
        <HeadIcon>{head.icon}</HeadIcon>
        <HeadText>
          <Title $attention={needsAttention}>{head.title}</Title>
          <Sub>
            {summaryParts.join(' · ') || 'Χωρίς ευρήματα'}
            {when ? ` — ${sourceLabel}, ${when}` : ''}
            {findings.acknowledgedAt ? ' · το είδατε' : ''}
          </Sub>
        </HeadText>
        <Chevron $open={open}>▶</Chevron>
      </Head>

      {open && (
        <Body>
          {findings.error && <ErrorBox>{findings.error}</ErrorBox>}

          {actions.length > 0 && (
            <>
              <GroupLabel $color="#9a3412">Χρειάζεται ενέργεια</GroupLabel>
              {actions.map((action) => (
                <ActionCard key={action.id}>
                  <ActionIcon>{action.icon}</ActionIcon>
                  <ActionBody>
                    <ActionTitle>{action.title}</ActionTitle>
                    {action.detail && <ActionDetail>{action.detail}</ActionDetail>}
                    {action.id === KHMDHS_FINDING_ACTION.DATA_REVIEW && typeof onOpenReview === 'function' && (
                      <ActionCta type="button" onClick={() => onOpenReview(null)}>
                        Άνοιγμα ελέγχου στοιχείων →
                      </ActionCta>
                    )}
                  </ActionBody>
                </ActionCard>
              ))}
            </>
          )}

          {attention.length > 0 && (
            <>
              <GroupLabel $color="#9a3412">Σημεία προς προσοχή</GroupLabel>
              {attention.map((line, idx) => (
                <Line key={`att-${idx}`} $warn>{line}</Line>
              ))}
            </>
          )}

          {applied.length > 0 && (
            <>
              <GroupLabel>Τι ενημερώθηκε</GroupLabel>
              {applied.map((line, idx) => (
                <Line key={`app-${idx}`}>{line}</Line>
              ))}
            </>
          )}

          <Footer>
            <FooterMeta>
              {findings.acknowledgedAt
                ? `Επιβεβαιώθηκε ${formatWhen(findings.acknowledgedAt)}`
                : 'Η αναφορά παραμένει εδώ μέχρι να δηλώσετε ότι την είδατε.'}
            </FooterMeta>
            {!findings.acknowledgedAt && typeof onAcknowledge === 'function' && (
              <AckBtn type="button" onClick={onAcknowledge}>Τα είδα</AckBtn>
            )}
          </Footer>
        </Body>
      )}
    </Panel>
  );
}
