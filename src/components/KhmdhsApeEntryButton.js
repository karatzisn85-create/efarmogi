import React from 'react';
import styled, { css, keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.45); }
  50% { box-shadow: 0 0 0 7px rgba(99, 102, 241, 0); }
`;

const pulseAmber = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.45); }
  50% { box-shadow: 0 0 0 7px rgba(217, 119, 6, 0); }
`;

const VARIANT_COLORS = {
  default: {
    filledBorder: '#059669',
    filledBg: 'linear-gradient(145deg, #ecfdf5, #d1fae5)',
    filledColor: '#047857',
    emptyBorder: '#6366f1',
    emptyBg: 'linear-gradient(145deg, #ffffff, #eef2ff)',
    emptyColor: '#4338ca',
    hoverShadow: 'rgba(67, 56, 202, 0.28)',
    pulse,
  },
  amber: {
    filledBorder: '#b45309',
    filledBg: 'linear-gradient(145deg, #fffbeb, #fef3c7)',
    filledColor: '#92400e',
    emptyBorder: '#d97706',
    emptyBg: 'linear-gradient(145deg, #ffffff, #fffbeb)',
    emptyColor: '#92400e',
    hoverShadow: 'rgba(180, 83, 9, 0.28)',
    pulse: pulseAmber,
  },
};

const Btn = styled.button`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 2px solid ${(p) => (p.$filled ? p.$colors.filledBorder : p.$colors.emptyBorder)};
  background: ${(p) => (p.$filled ? p.$colors.filledBg : p.$colors.emptyBg)};
  color: ${(p) => (p.$filled ? p.$colors.filledColor : p.$colors.emptyColor)};
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
  animation: ${(p) => (!p.$filled ? css`${p.$colors.pulse} 2.4s ease-in-out infinite` : 'none')};

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 14px ${(p) => p.$colors.hoverShadow};
  }

  &:active {
    transform: scale(0.94);
  }
`;

/**
 * @param {{ hasApe?: boolean, shortLabel?: string, title?: string, variant?: 'default'|'amber', onClick: Function }} props
 */
export default function KhmdhsApeEntryButton({
  hasApe = false,
  shortLabel = '',
  title = 'Καταχώριση ΑΠΕ',
  variant = 'default',
  onClick,
}) {
  const colors = VARIANT_COLORS[variant] || VARIANT_COLORS.default;
  return (
    <Btn
      type="button"
      $filled={hasApe}
      $colors={colors}
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
