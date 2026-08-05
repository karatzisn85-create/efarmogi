import React from 'react';
import styled, { keyframes } from 'styled-components';

const slideDown = keyframes`
  from {
    transform: translateY(-6px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const Banner = styled.div`
  position: sticky;
  top: 0;
  z-index: 99;
  background: #f8fafc;
  color: #475569;
  padding: 0.4rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  animation: ${slideDown} 0.22s ease;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex-wrap: wrap;
`;

const FilterIcon = styled.span`
  font-size: 0.85rem;
  line-height: 1;
  color: #64748b;
  flex-shrink: 0;
`;

const FilterBadge = styled.span`
  background: #e2e8f0;
  color: #334155;
  font-weight: 650;
  font-size: 0.72rem;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  line-height: 1.3;
  flex-shrink: 0;
`;

const FilterMessage = styled.span`
  font-size: 0.82rem;
  font-weight: 500;
  color: #64748b;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ClearButton = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 0.28rem 0.7rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
  }

  &::before {
    content: '✕';
    font-size: 0.7rem;
    font-weight: 700;
    opacity: 0.7;
  }
`;

function ActiveFiltersBanner({ activeFilterCount, onClearFilters, portfolioDrillLabel }) {
  const totalCount = activeFilterCount + (portfolioDrillLabel ? 1 : 0);
  if (totalCount === 0) return null;

  return (
    <Banner role="status" aria-live="polite">
      <LeftSection>
        <FilterIcon aria-hidden="true">🔍</FilterIcon>
        <FilterBadge>{totalCount}</FilterBadge>
        <FilterMessage>
          {totalCount === 1 ? 'Ενεργό φίλτρο' : 'Ενεργά φίλτρα'}
          {portfolioDrillLabel ? ` · ΚΗΜΔΗΣ: ${portfolioDrillLabel}` : ''}
        </FilterMessage>
      </LeftSection>
      <ClearButton type="button" onClick={onClearFilters}>
        Καθαρισμός
      </ClearButton>
    </Banner>
  );
}

export default ActiveFiltersBanner;
