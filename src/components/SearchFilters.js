import React, { useState } from 'react';
import styled from 'styled-components';
import {
  PROJECT_TYPES,
  FUNDING_SOURCES,
  PROJECT_STATUSES
} from '../data/formOptions';

const SearchContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
`;

const SearchTitle = styled.h3`
  color: #333;
  margin-bottom: 0.8rem;
  font-size: 1.1rem;
  font-weight: 500;
  text-align: center;
`;

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const FilterLabel = styled.label`
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const FilterInput = styled.input`
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #2196F3;
  }

  &::placeholder {
    color: #adb5bd;
  }
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #2196F3;
  }
`;

const AmountFiltersRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
`;

const SearchButton = styled.button`
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
  }
`;

const ClearButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #5a6268;
  }
`;

const ToggleButton = styled.button`
  background: transparent;
  color: #2196F3;
  border: 1px solid #2196F3;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 0.5rem;

  &:hover {
    background: #2196F3;
    color: white;
  }
`;

const CollapsibleSection = styled.div`
  overflow: hidden;
  transition: max-height 0.3s ease;
  max-height: ${props => props.isOpen ? '1000px' : '0'};
`;

function SearchFilters({ onApplyFilters }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    projectTitle: '',
    subprojectTitle: '',
    supervisor: '',
    projectType: '',
    fundingSource: '',
    projectStatus: '',
    minAmount: '',
    maxAmount: ''
  });

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    onApplyFilters(filters);
  };

  const handleClear = () => {
    const clearedFilters = {
      projectTitle: '',
      subprojectTitle: '',
      supervisor: '',
      projectType: '',
      fundingSource: '',
      projectStatus: '',
      minAmount: '',
      maxAmount: ''
    };
    setFilters(clearedFilters);
    onApplyFilters(clearedFilters);
  };

  const formatAmountInput = (value) => {
    if (!value) return '';
    
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα και τελείες
    let cleaned = value.replace(/[^\d,.]/g, '');
    
    // Αν δεν υπάρχουν ψηφία, επιστρέφω κενό
    if (!/\d/.test(cleaned)) return '';
    
    // Επιτρέπω στον χρήστη να πληκτρολογεί ελεύθερα
    // Μόνο αν δεν τελειώνει με κόμμα ή τελεία, κάνω μορφοποίηση
    if (cleaned.endsWith(',') || cleaned.endsWith('.')) {
      return cleaned;
    }
    
    // Απλή μορφοποίηση για αναζήτηση - λιγότερο αυστηρή
    let integerPart = '';
    let decimalPart = '';
    
    if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      integerPart = parts[0].replace(/\./g, '');
      decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    } else if (cleaned.includes('.')) {
      let parts = cleaned.split('.');
      if (parts[0].length <= 3 && parts[1]) {
        integerPart = parts[0];
        decimalPart = parts[1].slice(0, 2);
      } else {
        integerPart = cleaned.replace(/\./g, '');
      }
    } else {
      integerPart = cleaned;
    }
    
    // Μορφοποίηση μόνο αν το νούμερο είναι μεγάλο
    let formattedInteger = integerPart;
    if (integerPart.length > 3) {
      formattedInteger = '';
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          formattedInteger = '.' + formattedInteger;
        }
        formattedInteger = integerPart[i] + formattedInteger;
      }
    }
    
    let result = formattedInteger;
    if (decimalPart) {
      result += ',' + decimalPart;
    }
    
    return result;
  };

  const handleAmountChange = (field, value) => {
    const formattedValue = formatAmountInput(value);
    handleFilterChange(field, formattedValue);
  };

  return (
    <SearchContainer>
      <SearchTitle>Αναζήτηση και Φίλτρα</SearchTitle>
      
      <div style={{ textAlign: 'center' }}>
        <ToggleButton onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Απόκρυψη Φίλτρων' : 'Εμφάνιση Φίλτρων'}
        </ToggleButton>
      </div>

      <CollapsibleSection isOpen={isExpanded}>
        <FiltersGrid>
          <FilterGroup>
            <FilterLabel>Τίτλος Έργου</FilterLabel>
            <FilterInput
              type="text"
              placeholder="Αναζήτηση στον τίτλο έργου..."
              value={filters.projectTitle}
              onChange={(e) => handleFilterChange('projectTitle', e.target.value)}
            />
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Τίτλος Υποέργου</FilterLabel>
            <FilterInput
              type="text"
              placeholder="Αναζήτηση στον τίτλο υποέργου..."
              value={filters.subprojectTitle}
              onChange={(e) => handleFilterChange('subprojectTitle', e.target.value)}
            />
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Επιβλέπων</FilterLabel>
            <FilterInput
              type="text"
              placeholder="Αναζήτηση με βάση το όνομα επιβλέποντα..."
              value={filters.supervisor}
              onChange={(e) => handleFilterChange('supervisor', e.target.value)}
            />
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Είδος</FilterLabel>
            <FilterSelect
              value={filters.projectType}
              onChange={(e) => handleFilterChange('projectType', e.target.value)}
            >
              <option value="">Όλα τα είδη</option>
              {PROJECT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Πηγή Χρηματοδότησης</FilterLabel>
            <FilterSelect
              value={filters.fundingSource}
              onChange={(e) => handleFilterChange('fundingSource', e.target.value)}
            >
              <option value="">Όλες οι πηγές</option>
              {FUNDING_SOURCES.map(source => (
                <option key={source} value={source}>
                  {source.length > 40 ? source.substring(0, 37) + '...' : source}
                </option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Κατάσταση</FilterLabel>
            <FilterSelect
              value={filters.projectStatus}
              onChange={(e) => handleFilterChange('projectStatus', e.target.value)}
            >
              <option value="">Όλες οι καταστάσεις</option>
              {PROJECT_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </FilterSelect>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Εύρος Εγκεκριμένου Ποσού</FilterLabel>
            <AmountFiltersRow>
              <FilterInput
                type="text"
                placeholder="Από (π.χ. 10.000,00)"
                value={filters.minAmount}
                onChange={(e) => handleAmountChange('minAmount', e.target.value)}
              />
              <FilterInput
                type="text"
                placeholder="Έως (π.χ. 100.000,00)"
                value={filters.maxAmount}
                onChange={(e) => handleAmountChange('maxAmount', e.target.value)}
              />
            </AmountFiltersRow>
          </FilterGroup>
        </FiltersGrid>

        <ButtonContainer>
          <SearchButton onClick={handleSearch}>
            Εφαρμογή Φίλτρων
          </SearchButton>
          <ClearButton onClick={handleClear}>
            Καθαρισμός
          </ClearButton>
        </ButtonContainer>
      </CollapsibleSection>
    </SearchContainer>
  );
}

export default SearchFilters;
