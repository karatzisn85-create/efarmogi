import React from 'react';
import styled, { css, keyframes } from 'styled-components';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulseGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 2px 14px rgba(45, 212, 191, 0.45),
      0 0 0 0 rgba(45, 212, 191, 0.35);
  }
  50% {
    box-shadow:
      0 4px 22px rgba(45, 212, 191, 0.65),
      0 0 0 6px rgba(45, 212, 191, 0);
  }
`;

const shimmer = keyframes`
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

const BtnWrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.44rem 1rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
  font-family: inherit;
  letter-spacing: 0.03em;
  cursor: pointer;
  white-space: nowrap;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  color: #fff;
  background: linear-gradient(
    120deg,
    #0f766e 0%,
    #14b8a6 35%,
    #2dd4bf 50%,
    #14b8a6 65%,
    #0f766e 100%
  );
  background-size: 220% auto;
  box-shadow:
    0 2px 14px rgba(13, 148, 136, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;

  ${(p) => p.$urgent && css`
    animation: ${pulseGlow} 2.5s ease-in-out infinite;
  `}

  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.03);
    filter: brightness(1.06);
    animation: ${shimmer} 2.8s linear infinite;
    box-shadow:
      0 6px 24px rgba(13, 148, 136, 0.58),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
  }

  &:disabled {
    opacity: 0.62;
    cursor: not-allowed;
    animation: none;
  }

  &:focus-visible {
    outline: 2px solid #99f6e4;
    outline-offset: 2px;
  }
`;

const Icon = styled.span`
  display: inline-flex;
  font-size: 1rem;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  ${(p) => p.$spinning && css`animation: ${spin} 0.9s linear infinite;`}
`;

const HeaderFreshBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid ${(p) => (p.$level === 'red' ? 'rgba(254, 202, 202, 0.9)' : 'rgba(253, 230, 138, 0.9)')};
  background: ${(p) => (p.$level === 'red' ? 'rgba(254, 242, 242, 0.95)' : 'rgba(255, 251, 235, 0.95)')};
  color: ${(p) => (p.$level === 'red' ? '#b91c1c' : '#b45309')};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
`;

export default function KhmdhsRefreshActionButton({
  onClick,
  loading = false,
  disabled = false,
  freshness = null,
  title,
}) {
  const urgent = freshness?.level === 'yellow' || freshness?.level === 'red';
  const tip = title
    || freshness?.label
    || 'Ανανέωση δεδομένων αλυσίδας από το ΚΗΜΔΗΣ';

  return (
    <BtnWrap>
      {urgent && freshness?.days != null && (
        <HeaderFreshBadge $level={freshness.level} title={freshness.label}>
          {freshness.level === 'red' ? '🔴' : '🟡'} {freshness.days}η
        </HeaderFreshBadge>
      )}
      <Btn
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        $urgent={urgent && !loading}
        title={tip}
        aria-label="Ανανέωση δεδομένων ΚΗΜΔΗΣ"
      >
        <Icon $spinning={loading} aria-hidden>
          {loading ? '⏳' : '↻'}
        </Icon>
        Ανανέωση ΚΗΜΔΗΣ
      </Btn>
    </BtnWrap>
  );
}
