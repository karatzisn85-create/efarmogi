/**
 * Ενιαία λίστα εκκρεμοτήτων μετά ανάκτηση ΚΗΜΔΗΣ (Βήμα 1β / 1γ).
 */
import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { POST_APPLY_TASK } from '../utils/khmdhsPostApplyQueue';
import { KHMDHS_SITUATION_ACTION } from '../utils/khmdhsSituationActions';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  z-index: 100015;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.25rem 1rem 1.5rem;
  overflow: auto;
`;

const Card = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  width: min(640px, 100%);
  margin-top: 1.5rem;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  max-height: min(88vh, 820px);
`;

const Header = styled.div`
  padding: 1rem 1.15rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h2`
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  color: #0f172a;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 0.85rem 1.15rem;
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

const TaskCard = styled.div`
  background: #fff;
  border: 1px solid ${(p) => (p.$done ? '#bbf7d0' : '#e2e8f0')};
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  opacity: ${(p) => (p.$done ? 0.72 : 1)};
`;

const TaskQuestion = styled.div`
  font-size: 0.88rem;
  font-weight: 650;
  color: #0f172a;
  line-height: 1.4;
`;

const TaskDetail = styled.div`
  margin-top: 0.3rem;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-top: 0.45rem;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: ${(p) => {
    if (p.$tone === 'required') return '#fef2f2';
    if (p.$tone === 'important') return '#fffbeb';
    return '#f1f5f9';
  }};
  color: ${(p) => {
    if (p.$tone === 'required') return '#b91c1c';
    if (p.$tone === 'important') return '#b45309';
    return '#475569';
  }};
`;

const MoreToggle = styled.button`
  margin-top: 0.45rem;
  border: none;
  background: none;
  color: #0369a1;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-align: left;
  &:hover { text-decoration: underline; }
`;

const MoreBox = styled.pre`
  margin: 0.4rem 0 0;
  padding: 0.5rem 0.6rem;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 0.7rem;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-sans-serif, system-ui, sans-serif;
  line-height: 1.45;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
  background: ${(p) => {
    if (p.$variant === 'primary') return 'linear-gradient(135deg, #0d9488, #14b8a6)';
    if (p.$variant === 'danger') return '#fee2e2';
    if (p.$variant === 'ghost') return '#f1f5f9';
    return '#e2e8f0';
  }};
  color: ${(p) => {
    if (p.$variant === 'primary') return '#fff';
    if (p.$variant === 'danger') return '#991b1b';
    return '#1e293b';
  }};
  &:hover { filter: brightness(0.98); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Footer = styled.div`
  padding: 0.85rem 1.15rem 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const ReadyBanner = styled.div`
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.4;
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
`;

function priorityLabel(priority) {
  if (priority === 'required') return 'Απαιτείται';
  if (priority === 'important') return 'Σημαντικό';
  return 'Προαιρετικό';
}

function formatMore(task) {
  if (!task?.more) return '';
  if (task.type === POST_APPLY_TASK.STITCH_B) {
    return (task.more.segments || [])
      .map((s, i) => {
        const scope = s.scopeLabel ? `${s.scopeLabel}: ` : '';
        return `Σπόρος ${i + 1}: ${scope}${s.adam}${s.stages?.length ? ` (${s.stages.join(', ')})` : ''}`;
      })
      .join('\n');
  }
  if (task.type === POST_APPLY_TASK.SITUATION) {
    return (task.more.situations || [])
      .map((s) => `• ${s.title}${s.message ? `\n  ${s.message}` : ''}`)
      .join('\n\n');
  }
  if (task.type === POST_APPLY_TASK.APE) {
    return `Τρέχον: ${task.more.current || '—'}\nΠρόταση ΚΗΜΔΗΣ: ${task.more.suggested || '—'}`;
  }
  if (task.type === POST_APPLY_TASK.EXPIRY) {
    return task.detail || '';
  }
  return '';
}

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {Array} props.tasks
 * @param {function} props.onClose
 * @param {function} props.onOpenDataReview
 * @param {function} props.onSituationAction - (actionId, situationId, action, task)
 * @param {function} props.onStitchConfirm
 * @param {function} props.onStitchDecline
 * @param {function} props.onOpenRegistry
 * @param {function} props.onSkipRegistry
 * @param {function} props.onApeAccept
 * @param {function} props.onApeKeep
 * @param {function} props.onExpiryAccept
 * @param {function} props.onExpiryDismiss
 * @param {function} props.onDismissTask - (taskId) optional skip for optional items
 */
export default function KhmdhsPendingTasksModal({
  isOpen,
  tasks = [],
  completedIds = [],
  onClose,
  onOpenDataReview,
  onSituationAction,
  onStitchConfirm,
  onStitchDecline,
  onOpenRegistry,
  onSkipRegistry,
  onApeAccept,
  onApeKeep,
  onExpiryAccept,
  onExpiryDismiss,
  onDismissTask,
}) {
  const [expandedMore, setExpandedMore] = useState({});

  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setExpandedMore({});
  }, [isOpen]);

  const remaining = useMemo(
    () => (tasks || []).filter((t) => !completedIds.includes(t.id)),
    [tasks, completedIds]
  );
  const allDone = remaining.length === 0;

  if (!isOpen) return null;

  return (
    <Overlay onMouseDown={(e) => { if (e.target === e.currentTarget && allDone) onClose?.(); }}>
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="khmdhs-pending-tasks-title"
        data-khmdhs-pending-tasks-modal
      >
        <Header>
          <Title id="khmdhs-pending-tasks-title">Εκκρεμότητες μετά την ανάκτηση</Title>
          <Subtitle>
            Φέρνω δεδομένα → ελέγχω εκκρεμότητες εδώ → αποθηκεύω.
            Ανοίξτε μόνο όσα χρειάζονται· τα υπόλοιπα είναι προαιρετικά.
          </Subtitle>
        </Header>
        <Body>
          {allDone ? (
            <ReadyBanner>
              Ολοκληρώσατε τις εκκρεμότητες — μπορείτε να αποθηκεύσετε το υποέργο.
            </ReadyBanner>
          ) : (
            remaining.map((task) => {
              const moreText = formatMore(task);
              const done = completedIds.includes(task.id);
              return (
                <TaskCard key={task.id} $done={done}>
                  <TaskQuestion>{task.question}</TaskQuestion>
                  {task.detail ? <TaskDetail>{task.detail}</TaskDetail> : null}
                  <BadgeRow>
                    <Badge $tone={task.priority}>{priorityLabel(task.priority)}</Badge>
                  </BadgeRow>
                  {moreText ? (
                    <>
                      <MoreToggle
                        type="button"
                        onClick={() => setExpandedMore((prev) => ({
                          ...prev,
                          [task.id]: !prev[task.id],
                        }))}
                      >
                        {expandedMore[task.id] ? 'Λιγότερα' : 'Περισσότερα'}
                      </MoreToggle>
                      {expandedMore[task.id] ? <MoreBox>{moreText}</MoreBox> : null}
                    </>
                  ) : null}
                  <Actions>
                    {task.type === POST_APPLY_TASK.DATA_REVIEW && (
                      <Btn type="button" $variant="primary" onClick={() => onOpenDataReview?.()}>
                        Άνοιγμα ελέγχου
                      </Btn>
                    )}
                    {task.type === POST_APPLY_TASK.SITUATION && (
                      (task.report?.situations || []).flatMap((sit) =>
                        (sit.actions || []).slice(0, 3).map((act) => (
                          <Btn
                            key={`${sit.id}-${act.id}-${act.suggestedAdam || ''}`}
                            type="button"
                            $variant={act.id === KHMDHS_SITUATION_ACTION.CLEAR_KHMDHS ? 'danger' : 'primary'}
                            onClick={() => onSituationAction?.(act.id, sit.id, act, task)}
                          >
                            {act.label || act.id}
                          </Btn>
                        ))
                      )
                    )}
                    {task.type === POST_APPLY_TASK.SITUATION && (
                      <Btn type="button" $variant="ghost" onClick={() => onDismissTask?.(task.id)}>
                        Το είδα
                      </Btn>
                    )}
                    {task.type === POST_APPLY_TASK.STITCH_B && (
                      <>
                        <Btn type="button" $variant="primary" onClick={() => onStitchConfirm?.(task)}>
                          Ναι, καταχώρηση
                        </Btn>
                        <Btn type="button" $variant="ghost" onClick={() => onStitchDecline?.(task)}>
                          Όχι για τώρα
                        </Btn>
                      </>
                    )}
                    {task.type === POST_APPLY_TASK.REGISTRY && (
                      <>
                        <Btn type="button" $variant="primary" onClick={() => onOpenRegistry?.(task)}>
                          Επιλογή εγγράφων
                        </Btn>
                        <Btn type="button" $variant="ghost" onClick={() => onSkipRegistry?.(task)}>
                          Παράλειψη
                        </Btn>
                      </>
                    )}
                    {task.type === POST_APPLY_TASK.APE && (
                      <>
                        <Btn type="button" $variant="primary" onClick={() => onApeAccept?.(task)}>
                          Αποδοχή ΚΗΜΔΗΣ
                        </Btn>
                        <Btn type="button" $variant="ghost" onClick={() => onApeKeep?.(task)}>
                          Διατήρηση τρέχοντος
                        </Btn>
                      </>
                    )}
                    {task.type === POST_APPLY_TASK.EXPIRY && (
                      <>
                        <Btn type="button" $variant="primary" onClick={() => onExpiryAccept?.(task)}>
                          Ορισμός Ολοκληρωμένου
                        </Btn>
                        <Btn type="button" $variant="ghost" onClick={() => onExpiryDismiss?.(task)}>
                          Όχι τώρα
                        </Btn>
                      </>
                    )}
                  </Actions>
                </TaskCard>
              );
            })
          )}
        </Body>
        <Footer>
          {allDone ? (
            <FooterRow>
              <Btn type="button" $variant="primary" onClick={() => onClose?.()}>
                Επιστροφή στη φόρμα
              </Btn>
            </FooterRow>
          ) : (
            <FooterRow>
              <Btn type="button" $variant="ghost" onClick={() => onClose?.()}>
                Κλείσιμο — θα συνεχίσω αργότερα
              </Btn>
            </FooterRow>
          )}
        </Footer>
      </Card>
    </Overlay>
  );
}
