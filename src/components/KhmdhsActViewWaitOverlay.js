import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { subscribeKhmdhsActViewWait } from '../utils/khmdhsActViewWaitBridge';
import {
  KHMDHS_ACT_VIEW_WAIT_BODY,
  KHMDHS_ACT_VIEW_WAIT_CANCEL,
  KHMDHS_ACT_VIEW_WAIT_TITLE,
  buildKhmdhsActViewWaitLabel,
} from '../utils/khmdhsActViewWaitCopy';
import { cancelOpenKhmdhsActOnline } from '../utils/openKhmdhsActOnline';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  /* Πάνω από Έλεγχο δεδομένων ΚΗΜΔΗΣ (100002) και συρραφή (100020). */
  z-index: 100050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(238, 242, 255, 0.78);
  backdrop-filter: blur(4px);
  pointer-events: all;
  animation: ${fadeIn} 0.18s ease;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: min(440px, 100%);
  background: #fff;
  border: 1.5px solid #c7d2fe;
  border-radius: 16px;
  padding: 1.45rem 1.7rem 1.35rem;
  box-shadow: 0 8px 32px rgba(79, 70, 229, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
  text-align: center;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

const Badge = styled.div`
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4338ca;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
`;

const Title = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #3730a3;
  line-height: 1.35;
`;

const DocLine = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: #4338ca;
  line-height: 1.35;
`;

const Body = styled.div`
  font-size: 0.8rem;
  font-weight: 500;
  color: #6366f1;
  line-height: 1.5;
`;

const CancelBtn = styled.button`
  margin-top: 0.35rem;
  border: 1px solid #c7d2fe;
  background: #fff;
  color: #4338ca;
  border-radius: 10px;
  padding: 0.5rem 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #eef2ff;
  }
`;

function KhmdhsActViewWaitOverlay() {
  const [wait, setWait] = useState({ active: false, label: '', adam: '' });

  useEffect(() => subscribeKhmdhsActViewWait(setWait), []);

  if (!wait.active) return null;

  const docLine = buildKhmdhsActViewWaitLabel(wait.label);

  return (
    <Overlay
      data-testid="khmdhs-act-view-wait"
      role="alertdialog"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby="khmdhs-act-view-wait-title"
      onClick={cancelOpenKhmdhsActOnline}
    >
      <Card onClick={(e) => e.stopPropagation()}>
        <Spinner aria-hidden />
        <Badge>ΚΗΜΔΗΣ</Badge>
        <Title id="khmdhs-act-view-wait-title">{KHMDHS_ACT_VIEW_WAIT_TITLE}</Title>
        {docLine ? <DocLine>{docLine}</DocLine> : null}
        <Body>{KHMDHS_ACT_VIEW_WAIT_BODY}</Body>
        <CancelBtn
          type="button"
          data-testid="khmdhs-act-view-wait-cancel"
          onClick={cancelOpenKhmdhsActOnline}
        >
          {KHMDHS_ACT_VIEW_WAIT_CANCEL}
        </CancelBtn>
      </Card>
    </Overlay>
  );
}

export default KhmdhsActViewWaitOverlay;
