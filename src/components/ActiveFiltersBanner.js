import React from 'react';
import styled, { keyframes } from 'styled-components';

const slideDown = keyframes`
  from {
    transform: translateY(-100%);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  animation: ${slideDown} 0.4s ease;
  border-bottom: 3px solid rgba(255, 255, 255, 0.2);
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const FilterIcon = styled.div`
  font-size: 1.5rem;
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
`;

const FilterBadge = styled.span`
  background: rgba(255, 255, 255, 0.3);
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const FilterMessage = styled.span`
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.3px;
`;

const ClearButton = styled.button`
  background: rgba(255, 255, 255, 0.25);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.6);
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:hover {
    background: rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &::before {
    content: "✕";
    font-size: 1.2rem;
    font-weight: 700;
  }
`;

function ActiveFiltersBanner({ activeFilterCount, onClearFilters }) {
  if (activeFilterCount === 0) return null;

  return (
    <Banner>
      <LeftSection>
        <FilterIcon>🔍</FilterIcon>
        <FilterBadge>{activeFilterCount}</FilterBadge>
        <FilterMessage>
          {activeFilterCount === 1 ? 'Ενεργό Φίλτρο' : 'Ενεργά Φίλτρα'}
        </FilterMessage>
      </LeftSection>
      <ClearButton onClick={onClearFilters}>
        Καθαρισμός Φίλτρων
      </ClearButton>
    </Banner>
  );
}

export default ActiveFiltersBanner;

