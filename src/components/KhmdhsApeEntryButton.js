import React from 'react';
import styled, { css, keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.45); }
  50% { box-shadow: 0 0 0 7px rgba(99, 102, 241, 0); }
`;

const Btn = styled.button`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 2px solid ${(p) => (p.$filled ? '#059669' : '#6366f1')};
  background: ${(p) => (p.$filled
    ? 'linear-gradient(145deg, #ecfdf5, #d1fae5)'
    : 'linear-gradient(145deg, #ffffff, #eef2ff)')};
  color: ${(p) => (p.$filled ? '#047857' : '#4338ca')};
  font-size: ${(p) => (p.$filled ? '0.72rem' : '1.15rem')};
  font-weight: 900;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  margin-right: 0.35rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  animation: ${(p) => (!p.$filled ? css`${pulse} 2.4s ease-in-out infinite` : 'none')};

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 14px rgba(67, 56, 202, 0.28);
  }

  &:active {
    transform: scale(0.94);
  }
`;

/**
 * @param {{ hasApe?: boolean, shortLabel?: string, title?: string, onClick: Function }} props
 */
export default function KhmdhsApeEntryButton({
  hasApe = false,
  shortLabel = '',
  title = 'Καταχώριση ΑΠΕ',
  onClick,
}) {
  return (
    <Btn
      type="button"
      $filled={hasApe}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {hasApe ? (shortLabel || 'ΑΠΕ') : '+'}
    </Btn>
  );
}
