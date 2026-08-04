import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  SYMV_CHAIN_ROLE,
  SYMV_CHAIN_ROLE_LABELS,
  collectSymvChainDocuments,
  buildDefaultSymvChainPlan,
  validateSymvChainPlan,
  symvPlanMatchesChain,
  mergeExistingSymvPlanOntoChain,
} from '../utils/khmdhsSymvChainPlanner';
import { openKhmdhsActOnline } from '../utils/openKhmdhsActOnline';
import { useToast } from './ToastProvider';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const ROLE_VISUAL = {
  [SYMV_CHAIN_ROLE.SKIP]: {
    border: '#cbd5e1',
    bg: '#f8fafc',
    badgeBg: '#e2e8f0',
    badgeColor: '#64748b',
    selectBorder: '#cbd5e1',
  },
  [SYMV_CHAIN_ROLE.MAIN]: {
    border: '#818cf8',
    bg: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
    badgeBg: '#4f46e5',
    badgeColor: '#fff',
    selectBorder: '#6366f1',
  },
  [SYMV_CHAIN_ROLE.PARALLEL]: {
    border: '#38bdf8',
    bg: 'linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%)',
    badgeBg: '#0284c7',
    badgeColor: '#fff',
    selectBorder: '#0ea5e9',
  },
  [SYMV_CHAIN_ROLE.SUPPLEMENTARY]: {
    border: '#34d399',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
    badgeBg: '#059669',
    badgeColor: '#fff',
    selectBorder: '#10b981',
  },
  [SYMV_CHAIN_ROLE.EXTENSION]: {
    border: '#fbbf24',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    badgeBg: '#d97706',
    badgeColor: '#fff',
    selectBorder: '#f59e0b',
  },
  [SYMV_CHAIN_ROLE.INTERMEDIATE]: {
    border: '#94a3b8',
    bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    badgeBg: '#475569',
    badgeColor: '#fff',
    selectBorder: '#64748b',
  },
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(3px);
  z-index: 12450;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 16px;
  width: min(760px, 100%);
  height: min(92vh, 860px);
  max-height: min(92vh, 860px);
  display: flex;
  flex-direction: column;
  box-shadow:
    0 28px 70px rgba(49, 46, 129, 0.22),
    0 0 0 1px rgba(99, 102, 241, 0.08);
  overflow: hidden;
  animation: ${fadeIn} 0.22s ease-out;
  min-height: 0;
`;

const Header = styled.div`
  padding: 1.1rem 1.25rem 0.95rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(135deg, #312e81 0%, #4f46e5 48%, #6366f1 100%);
  flex-shrink: 0;
  color: #fff;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Title = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.01em;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.88);
`;

const CountPill = styled.span`
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  white-space: nowrap;
`;

const Body = styled.div`
  padding: 1rem 1.2rem;
  overflow-y: scroll;
  overflow-x: hidden;
  flex: 1 1 0;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 120px);
`;

const Intro = styled.div`
  margin: 0 0 0.85rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #334155;
  background: #fff;
  border: 1px solid #e0e7ff;
  border-left: 4px solid #6366f1;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
`;

const Row = styled.div`
  border: 1px solid ${(p) => p.$border};
  border-left-width: 4px;
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.65rem;
  background: ${(p) => p.$bg};
  opacity: ${(p) => (p.$skipped ? 0.78 : 1)};
  transition: box-shadow 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
  box-shadow: ${(p) => (p.$skipped ? 'none' : '0 2px 10px rgba(15, 23, 42, 0.05)')};

  &:hover {
    box-shadow: ${(p) => (p.$skipped ? 'none' : '0 6px 18px rgba(15, 23, 42, 0.08)')};
    transform: ${(p) => (p.$skipped ? 'none' : 'translateY(-1px)')};
  }
`;

const RowTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: flex-start;
  justify-content: space-between;
`;

const DocMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const AdamRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
`;

const StepBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  color: #64748b;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.1rem 0.35rem;
  min-width: 1.4rem;
  text-align: center;
`;

const Adam = styled.span`
  font-family: ui-monospace, monospace;
  font-weight: 800;
  font-size: 0.8rem;
  color: #0f172a;
  letter-spacing: 0.02em;
`;

const RoleBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  white-space: nowrap;
`;

const RecordTitle = styled.div`
  margin-top: 0.35rem;
  font-size: 0.78rem;
  line-height: 1.45;
  font-weight: 600;
  color: #1e293b;
`;

const Meta = styled.div`
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: #64748b;
`;

const WarnTag = styled.span`
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
`;

const RoleSelect = styled.select`
  min-width: 230px;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.42rem 0.5rem;
  border: 2px solid ${(p) => p.$border};
  border-radius: 9px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  transition: box-shadow 0.15s ease;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const ViewBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.45rem;
  border: 1px solid #6366f1;
  background: linear-gradient(180deg, #fff 0%, #eef2ff 100%);
  color: #4338ca;
  border-radius: 8px;
  padding: 0.32rem 0.65rem;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background: #e0e7ff;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$singleColumn ? '1fr' : '1fr 1fr')};
  gap: 0.55rem;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px dashed rgba(100, 116, 139, 0.25);

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  font-size: 0.68rem;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const Input = styled.input`
  font-size: 0.82rem;
  padding: 0.42rem 0.55rem;
  border-radius: 8px;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;

  ${(p) => p.$state === 'user' && css`
    color: #0f172a;
    font-weight: 800;
    font-style: normal;
    background: #ffffff;
    border: 2px solid #1e293b;
    letter-spacing: 0.01em;
  `}

  ${(p) => p.$state === 'suggested' && css`
    color: #64748b;
    font-weight: 500;
    font-style: italic;
    background: #f1f5f9;
    border: 1px dashed #94a3b8;
  `}

  ${(p) => p.$state === 'empty' && css`
    color: #64748b;
    font-weight: 400;
    font-style: italic;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
  `}

  &::placeholder {
    color: #94a3b8;
    font-weight: 400;
    font-style: italic;
    opacity: 1;
  }

  &:focus {
    outline: none;
    color: #0f172a;
    font-weight: 800;
    font-style: normal;
    background: #fff;
    border: 2px solid #4f46e5;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }
`;

const FieldHint = styled.span`
  font-size: 0.65rem;
  font-weight: 500;
  color: ${(p) => (p.$muted ? '#64748b' : '#92400e')};
  font-style: ${(p) => (p.$muted ? 'italic' : 'normal')};
  text-transform: none;
  letter-spacing: normal;
  line-height: 1.35;
`;

const Error = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #b91c1c;
  font-weight: 700;
  padding: 0.5rem 0.65rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
`;

const SummaryBar = styled.div`
  margin: 0.85rem 0 0;
  padding: 0.55rem 0.7rem;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #4338ca;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  font-weight: 600;
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.55rem;
  padding: 0.9rem 1.2rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const FooterHint = styled.span`
  font-size: 0.7rem;
  color: #64748b;
  max-width: 22rem;
  line-height: 1.4;
`;

const FooterActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Btn = styled.button`
  border: none;
  border-radius: 9px;
  padding: 0.52rem 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.12s ease, box-shadow 0.15s ease;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }
`;

const CancelBtn = styled(Btn)`
  background: #e2e8f0;
  color: #475569;

  &:hover:not(:disabled) {
    background: #cbd5e1;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);

  &:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(79, 70, 229, 0.45);
  }
`;

const ROLE_OPTIONS = [
  SYMV_CHAIN_ROLE.SKIP,
  SYMV_CHAIN_ROLE.MAIN,
  SYMV_CHAIN_ROLE.PARALLEL,
  SYMV_CHAIN_ROLE.SUPPLEMENTARY,
  SYMV_CHAIN_ROLE.EXTENSION,
  SYMV_CHAIN_ROLE.INTERMEDIATE,
];

function planItemMap(plan) {
  const map = new Map();
  (plan?.items || []).forEach((item) => {
    if (item?.adam) map.set(item.adam, item);
  });
  return map;
}

function dateFieldLabel(role) {
  if (role === SYMV_CHAIN_ROLE.EXTENSION) {
    return 'Καταληκτική ημερομηνία παράτασης';
  }
  if (role === SYMV_CHAIN_ROLE.INTERMEDIATE) {
    return 'Ημερομηνία εγγράφου';
  }
  if (role === SYMV_CHAIN_ROLE.SUPPLEMENTARY) {
    return 'Ημερομηνία υπογραφής συμπληρωματικής';
  }
  return 'Ημερομηνία υπογραφής σύμβασης';
}

function roleNeedsAmount(role) {
  return role !== SYMV_CHAIN_ROLE.EXTENSION && role !== SYMV_CHAIN_ROLE.INTERMEDIATE;
}

function roleNeedsCharacterization(role) {
  return role === SYMV_CHAIN_ROLE.INTERMEDIATE;
}

function inputVisualState(value, userTouched) {
  if (!String(value || '').trim()) return 'empty';
  return userTouched ? 'user' : 'suggested';
}

function amountPlaceholder(doc) {
  if (doc.defaultAmount) return `Ενδεικτικά από ΚΗΜΔΗΣ: ${doc.defaultAmount}`;
  return 'π.χ. 74.155,85';
}

export default function KhmdhsSymvChainPlannerDialog({
  isOpen,
  chainRes = null,
  subprojectTitle = '',
  existingPlan = null,
  onDismiss,
  onConfirm,
}) {
  const { showToast } = useToast();
  const docs = useMemo(
    () => (isOpen && chainRes ? collectSymvChainDocuments(chainRes) : []),
    [isOpen, chainRes]
  );
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [viewingAdam, setViewingAdam] = useState('');
  const bodyScrollRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !chainRes) return;
    setPlan((prev) => {
      if (prev?.items?.length && symvPlanMatchesChain(prev, chainRes)) return prev;
      if (existingPlan?.items?.length && symvPlanMatchesChain(existingPlan, chainRes)) {
        return existingPlan;
      }
      if (existingPlan?.items?.length) {
        return mergeExistingSymvPlanOntoChain(existingPlan, chainRes);
      }
      return buildDefaultSymvChainPlan(chainRes);
    });
    setError('');
    setViewingAdam('');
  }, [isOpen, chainRes, existingPlan]);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || !isOpen) return undefined;

    const onWheel = (e) => {
      if (!el.contains(e.target)) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const next = Math.min(maxScroll, Math.max(0, el.scrollTop + e.deltaY));
      if (next === el.scrollTop) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = next;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  const handleViewDocument = useCallback(async (adam, title = '') => {
    const norm = String(adam || '').trim();
    if (!norm) return;
    setViewingAdam(norm);
    try {
      const res = await openKhmdhsActOnline(norm, { label: title });
      if (!res?.success) {
        showToast(res?.error || 'Δεν ήταν δυνατή η προβολή του εγγράφου.', 'error');
      }
    } catch (e) {
      showToast(e?.message || 'Σφάλμα κατά την προβολή.', 'error');
    } finally {
      setViewingAdam((current) => (current === norm ? '' : current));
    }
  }, [showToast]);

  if (!isOpen || docs.length < 2 || !plan) return null;

  const itemByAdam = planItemMap(plan);

  const updateItem = (adam, patch, { userField } = {}) => {
    setPlan((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => {
        if (item.adam !== adam) return item;
        const next = { ...item, ...patch };
        if (userField) {
          next.userTouched = { ...(item.userTouched || {}), [userField]: true };
        }
        return next;
      }),
    }));
    setError('');
  };

  const getDraftPlan = () => ({
    ...plan,
    items: (plan.items || []).map(({ userTouched, ...item }) => item),
  });

  const handleDismiss = () => {
    if (!plan) {
      onDismiss?.(null);
      return;
    }
    onDismiss?.(getDraftPlan());
  };

  const handleConfirm = () => {
    const cleanPlan = {
      ...plan,
      items: (plan.items || []).map(({ userTouched, ...item }) => item),
    };
    const validation = validateSymvChainPlan(cleanPlan);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    onConfirm?.(cleanPlan);
  };

  const activeCount = (plan.items || []).filter((i) => i.role !== SYMV_CHAIN_ROLE.SKIP).length;

  return (
    <Overlay
      data-khmdhs-symv-planner-modal
      onClick={(e) => e.target === e.currentTarget && handleDismiss()}
    >
      <Dialog data-khmdhs-symv-planner-modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <HeaderTop>
            <div>
              <Title>Κατανομή εγγραφών SYMV</Title>
              <Sub>
                {subprojectTitle ? `«${subprojectTitle}» — ` : ''}
                ορίστε τι είναι το καθένα πριν την εφαρμογή στην αλυσίδα.
              </Sub>
            </div>
            <CountPill>{docs.length} εγγραφές</CountPill>
          </HeaderTop>
        </Header>
        <Body ref={bodyScrollRef} data-khmdhs-symv-planner-scroll>
          <Intro>
            Για κάθε ΑΔΑΜ επιλέξτε ρόλο. Χρησιμοποιήστε <strong>«Προβολή εγγράφου»</strong> για
            να δείτε το PDF στον browser πριν αποφασίσετε. Για έγγραφα που δεν είναι σύμβαση αλλά
            ανήκουν στη ροή (π.χ. απόφαση, διακήρυξη), επιλέξτε
            <strong> «Ενδιάμεσος κρίκος»</strong> — η ημερομηνία εγγράφου καθορίζει τη θέση στην αλυσίδα.
            <br />
            <strong>Έντονα μαύρα</strong> = δική σας εισαγωγή.
            {' '}
            <em style={{ color: '#64748b' }}>Γκρι πλάγια / διακεκομμένο πλαίσιο</em>
            {' '}
            = ενδεικτική τιμή από ΚΗΜΔΗΣ — επιβεβαιώστε ή διορθώστε.
          </Intro>
          {docs.map((doc, idx) => {
            const item = itemByAdam.get(doc.adam) || {
              adam: doc.adam,
              role: SYMV_CHAIN_ROLE.SKIP,
              date: '',
              amount: '',
              label: '',
            };
            const role = item.role;
            const visual = ROLE_VISUAL[role] || ROLE_VISUAL[SYMV_CHAIN_ROLE.SKIP];
            const skipped = role === SYMV_CHAIN_ROLE.SKIP;
            const showFields = !skipped;
            const showAmount = showFields && roleNeedsAmount(role);
            const showCharacterization = showFields && roleNeedsCharacterization(role);
            const isViewing = viewingAdam === doc.adam;
            const dateValue = String(item.date || '').slice(0, 10);
            const amountValue = String(item.amount || '').trim();
            const labelValue = String(item.label || '').trim();
            const dateState = inputVisualState(dateValue, item.userTouched?.date);
            const amountState = inputVisualState(amountValue, item.userTouched?.amount);
            const labelState = inputVisualState(labelValue, item.userTouched?.label);

            return (
              <Row
                key={doc.adam}
                $skipped={skipped}
                $border={visual.border}
                $bg={visual.bg}
              >
                <RowTop>
                  <DocMain>
                    <AdamRow>
                      <StepBadge>{idx + 1}</StepBadge>
                      <Adam>{doc.adam}</Adam>
                      <RoleBadge $bg={visual.badgeBg} $color={visual.badgeColor}>
                        {SYMV_CHAIN_ROLE_LABELS[role]}
                      </RoleBadge>
                    </AdamRow>
                    {doc.title ? <RecordTitle>{doc.title}</RecordTitle> : null}
                    {doc.historyLabel && doc.historyLabel !== doc.title ? (
                      <Meta>{doc.historyLabel}</Meta>
                    ) : null}
                    {doc.contractor ? <Meta>Ανάδοχος: {doc.contractor}</Meta> : null}
                    {doc.nonContractReason ? <WarnTag>{doc.nonContractReason}</WarnTag> : null}
                    <ViewBtn
                      type="button"
                      disabled={isViewing}
                      onClick={() => handleViewDocument(doc.adam, doc.title)}
                      title="Άνοιγμα PDF στον browser"
                    >
                      <span aria-hidden>{isViewing ? '⏳' : '👁'}</span>
                      {isViewing ? 'Φόρτωση…' : 'Προβολή εγγράφου'}
                    </ViewBtn>
                  </DocMain>
                  <RoleSelect
                    $border={visual.selectBorder}
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      const patch = { role: newRole };
                      if (newRole === SYMV_CHAIN_ROLE.EXTENSION
                        || newRole === SYMV_CHAIN_ROLE.INTERMEDIATE) {
                        patch.amount = '';
                      }
                      if (newRole !== SYMV_CHAIN_ROLE.INTERMEDIATE) {
                        patch.label = '';
                      }
                      updateItem(doc.adam, patch);
                    }}
                    aria-label={`Ρόλος για ${doc.adam}`}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{SYMV_CHAIN_ROLE_LABELS[opt]}</option>
                    ))}
                  </RoleSelect>
                </RowTop>
                {showFields ? (
                  <Fields $singleColumn={!showAmount && !showCharacterization}>
                    <Field>
                      {dateFieldLabel(role)}
                      <Input
                        type="date"
                        $state={dateState}
                        value={dateValue}
                        onChange={(e) => updateItem(doc.adam, { date: e.target.value }, { userField: 'date' })}
                      />
                      {dateState === 'suggested' ? (
                        <FieldHint $muted>Ενδεικτική ημερομηνία από ΚΗΜΔΗΣ — αλλάξτε αν δεν συμφωνεί.</FieldHint>
                      ) : null}
                      {role === SYMV_CHAIN_ROLE.EXTENSION ? (
                        <FieldHint>
                          Η νέα προθεσμία εκτέλεσης μετά την παράταση — όχι η ημερομηνία έκδοσης του εγγράφου.
                        </FieldHint>
                      ) : null}
                      {role === SYMV_CHAIN_ROLE.INTERMEDIATE ? (
                        <FieldHint $muted>
                          Η ημερομηνία εγγράφου καθορίζει τη θέση του κρίκου ανάμεσα στις υπόλοιπες πράξεις της αλυσίδας.
                        </FieldHint>
                      ) : null}
                    </Field>
                    {showCharacterization ? (
                      <Field>
                        Χαρακτηρισμός εγγράφου
                        <Input
                          type="text"
                          $state={labelState}
                          value={item.label || ''}
                          placeholder="π.χ. Απόφαση Δ.Σ., Διακήρυξη, Πρακτικό"
                          onChange={(e) => updateItem(doc.adam, { label: e.target.value }, { userField: 'label' })}
                        />
                        <FieldHint $muted>
                          Προαιρετικό — εμφανίζεται στο ιστορικό αλυσίδας ως περιγραφή του κρίκου.
                        </FieldHint>
                      </Field>
                    ) : null}
                    {showAmount ? (
                      <Field>
                        Ποσό (με ΦΠΑ)
                        <Input
                          type="text"
                          $state={amountState}
                          value={item.amount || ''}
                          placeholder={amountPlaceholder(doc)}
                          onChange={(e) => updateItem(doc.adam, { amount: e.target.value }, { userField: 'amount' })}
                        />
                        {amountState === 'suggested' ? (
                          <FieldHint $muted>Ενδεικτικό ποσό από ΚΗΜΔΗΣ — αλλάξτε αν δεν συμφωνεί.</FieldHint>
                        ) : null}
                      </Field>
                    ) : null}
                  </Fields>
                ) : null}
              </Row>
            );
          })}
          {error ? <Error>{error}</Error> : null}
          <SummaryBar>
            Επιλέχθηκαν <strong>{activeCount}</strong> εγγραφές για καταχώριση.
            {' '}Μία κύρια + συμπληρωματική = «Μια Σύμβαση». Δύο ή περισσότερες κύριες/παράλληλες = «Πολλές Συμβάσεις».
            {' '}Οι <strong>ενδιάμεσοι κρίκοι</strong> μπαίνουν στο ιστορικό αλυσίδας ταξινομημένοι κατά ημερομηνία εγγράφου.
          </SummaryBar>
        </Body>
        <Footer>
          <FooterHint>
            Κλείσιμο ή κλικ έξω διατηρεί τις επιλογές σας — μπορείτε να ξανανοίξετε την κατανομή από τη Φάση Β.
          </FooterHint>
          <FooterActions>
            <CancelBtn type="button" onClick={handleDismiss}>Κλείσιμο</CancelBtn>
            <PrimaryBtn type="button" onClick={handleConfirm}>
              Εφαρμογή κατανομής
            </PrimaryBtn>
          </FooterActions>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
