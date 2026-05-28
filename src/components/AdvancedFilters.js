import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { PROJECT_TYPES, FUNDING_SOURCES, PROJECT_STATUSES, FUNDING_DETAILS, IMPLEMENTATION_FORMS } from '../data/formOptions';
import { collectChargeFilterOptions } from '../utils/supervisorChargeDisplay';

const FiltersOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(3px);
`;

const FiltersContainer = styled.div`
  background: white;
  border-radius: 20px;
  max-width: 1400px;
  width: 95%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 2px solid #dee2e6;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2.5rem;
  border-bottom: 3px solid #e9ecef;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 18px 18px 0 0;
`;

const Title = styled.h2`
  color: white;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  &::before {
    content: "🔍";
    font-size: 1.6rem;
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 0.7rem 1.5rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #e9ecef;
  background: #f8f9fa;
  padding: 0 1.5rem;
  overflow-x: auto;
`;

const Tab = styled.button`
  background: ${props => props.$active ? 'white' : 'transparent'};
  color: ${props => props.$active ? '#667eea' : '#6c757d'};
  border: none;
  padding: 1.2rem 2rem;
  font-size: 0.95rem;
  font-weight: ${props => props.$active ? '700' : '500'};
  cursor: pointer;
  border-bottom: 3px solid ${props => props.$active ? '#667eea' : 'transparent'};
  transition: all 0.2s ease;
  white-space: nowrap;
  position: relative;
  
  &:hover {
    background: ${props => props.$active ? 'white' : 'rgba(102, 126, 234, 0.05)'};
    color: #667eea;
  }

  ${props => props.$active && `
    box-shadow: 0 -2px 8px rgba(102, 126, 234, 0.1);
  `}
`;

const ContentArea = styled.div`
  padding: 2rem 2.5rem;
  overflow-y: auto;
  flex: 1;
  
  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 10px;
  }
`;

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
`;

const FilterSection = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.2rem;
  border: 1px solid #dee2e6;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: #667eea;
  }
`;

const FilterLabel = styled.label`
  color: #495057;
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #adb5bd;
  }
`;

const FilterSelect = styled.select`
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  &[multiple] {
    min-height: 120px;
    padding: 0.5rem;
    
    option {
      padding: 0.6rem;
      border-radius: 4px;
      margin: 2px 0;
      
      &:checked {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
    }
  }
`;

const DateRangeContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
`;

const DateLabel = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 0.4rem;
  font-weight: 500;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 2.5rem;
  border-top: 3px solid #e9ecef;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 0 0 18px 18px;
`;

const ApplyButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 3rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ClearButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 1rem 3rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
  
  &:hover {
    background: #5a6268;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const HelpText = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.4rem;
  font-style: italic;
`;

function AdvancedFilters({ isOpen, onClose, onApplyFilters, currentFilters = {}, projects = [], engineerCatalog = [] }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [chargeOptions, setChargeOptions] = useState([]);
  const [chargeOptionsLoaded, setChargeOptionsLoaded] = useState(false);
  const [filters, setFilters] = useState({
    projectTitle: '',
    subprojectTitle: '',
    kaCode: '',
    aleCode: '',
    supervisor: [],
    projectType: [],
    fundingSource: [],
    fundingDetails: [],
    projectStatus: [],
    implementationForm: [],
    hasSupplementaryContracts: '',
    contractsCount: '',
    hasEgkriseisDialthesisPistosis: '',
    hasProsklisiLink: '',
    hasEntaxiLink: '',
    hasComments: '',
    hasApeComments: '',
    hasRemainingComments: '',
    hasEisigitikiEkthesi: '',
    misPraxhsCode: '',
    remainingYear: '',
    remainingAmountCondition: 'all',
    contractDateFrom: '',
    contractDateTo: '',
    contractProcessDateFrom: '',
    contractProcessDateTo: '',
    approvedAmountMin: '',
    approvedAmountMax: '',
    contractAmountMin: '',
    contractAmountMax: '',
    apeAmountMin: '',
    apeAmountMax: '',
    anadoxosName: '',
    anadoxosVat: '',
    sortBy: 'kaCode',
    sortOrder: 'asc'
  });

  const loadChargeFilterOptions = () => {
    if (chargeOptionsLoaded && chargeOptions.length > 0) return;
    setChargeOptionsLoaded(true);
    const fromProjects = collectChargeFilterOptions(projects, engineerCatalog);
    setChargeOptions(fromProjects);
  };

  // Initialize filters
  useEffect(() => {
    if (isOpen && currentFilters) {
      setFilters(prev => ({ ...prev, ...currentFilters }));
    }
  }, [isOpen, currentFilters]);

  useEffect(() => {
    if (!isOpen) return;
    const opts = collectChargeFilterOptions(projects, engineerCatalog);
    setChargeOptions(opts);
    setChargeOptionsLoaded(opts.length > 0);
  }, [isOpen, projects, engineerCatalog]);

  const availableFundingDetails = useMemo(() => {
    if (filters.fundingSource.length === 1) {
      return FUNDING_DETAILS[filters.fundingSource[0]] || [];
    }
    return [];
  }, [filters.fundingSource]);

  const handleInputChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMultiSelectChange = (field, event) => {
    const options = event.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    setFilters(prev => ({
      ...prev,
      [field]: selected
    }));
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      projectTitle: '',
      subprojectTitle: '',
      kaCode: '',
      supervisor: [],
      projectType: [],
      fundingSource: [],
      fundingDetails: [],
      projectStatus: [],
      implementationForm: [],
      characterization: '',
      hasSupplementaryContracts: '',
      contractsCount: '',
      hasEgkriseisDialthesisPistosis: '',
      hasProsklisiLink: '',
      hasEntaxiLink: '',
      hasComments: '',
      hasApeComments: '',
      hasRemainingComments: '',
      hasEisigitikiEkthesi: '',
      misPraxhsCode: '',
      remainingYear: '',
      remainingAmountCondition: 'all',
      contractDateFrom: '',
      contractDateTo: '',
      contractProcessDateFrom: '',
      contractProcessDateTo: '',
      approvedAmountMin: '',
      approvedAmountMax: '',
      contractAmountMin: '',
      contractAmountMax: '',
      apeAmountMin: '',
      apeAmountMax: '',
      anadoxosName: '',
      anadoxosVat: '',
      sortBy: 'kaCode',
      sortOrder: 'asc'
    };
    setFilters(clearedFilters);
  };

  if (!isOpen) return null;

  return (
    <FiltersOverlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <FiltersContainer onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Προηγμένα Φίλτρα Αναζήτησης</Title>
          <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
        </Header>

        <TabsContainer>
          <Tab $active={activeTab === 'basic'} onClick={() => setActiveTab('basic')}>
            📝 Βασικά
          </Tab>
          <Tab $active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>
            📦 Κατηγορίες
          </Tab>
          <Tab $active={activeTab === 'amounts'} onClick={() => setActiveTab('amounts')}>
            💰 Ποσά & Ημερομηνίες
          </Tab>
          <Tab $active={activeTab === 'khmdhs'} onClick={() => setActiveTab('khmdhs')}>
            📋 ΚΗΜΔΗΣ
          </Tab>
          <Tab $active={activeTab === 'links'} onClick={() => setActiveTab('links')}>
            🔗 Συσχετίσεις
          </Tab>
          <Tab $active={activeTab === 'sort'} onClick={() => setActiveTab('sort')}>
            ⇅ Ταξινόμηση
          </Tab>
        </TabsContainer>

        <ContentArea>
          {/* BASIC TAB */}
          {activeTab === 'basic' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>📝 Τίτλος Έργου</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Αναζήτηση στον τίτλο έργου..."
                  value={filters.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                />
              </FilterSection>

              <FilterSection>
                <FilterLabel>📄 Τίτλος Υποέργου</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Αναζήτηση στον τίτλο υποέργου..."
                  value={filters.subprojectTitle}
                  onChange={(e) => handleInputChange('subprojectTitle', e.target.value)}
                />
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔢 Κωδικός ΚΑ</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="π.χ. 64-7422.001"
                  value={filters.kaCode}
                  onChange={(e) => handleInputChange('kaCode', e.target.value)}
                />
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔢 Κωδ. Α.Λ.Ε.</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Αναζήτηση με κωδικό Α.Λ.Ε..."
                  value={filters.aleCode}
                  onChange={(e) => handleInputChange('aleCode', e.target.value)}
                />
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔢 Κωδικός ΜΙΣ</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Αναζήτηση με κωδικό MIS..."
                  value={filters.misPraxhsCode}
                  onChange={(e) => handleInputChange('misPraxhsCode', e.target.value)}
                />
              </FilterSection>

              <FilterSection>
                <FilterLabel>📄 Εισηγητική Έκθεση</FilterLabel>
                <FilterSelect
                  value={filters.hasEisigitikiEkthesi || ''}
                  onChange={(e) => handleInputChange('hasEisigitikiEkthesi', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="yes">Έχει περιεχόμενο</option>
                  <option value="no">Είναι κενή</option>
                </FilterSelect>
              </FilterSection>
            </FiltersGrid>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>👷 Χρεωμένο σε</FilterLabel>
                <FilterSelect
                  multiple
                  value={filters.supervisor}
                  onChange={(e) => handleMultiSelectChange('supervisor', e)}
                  onFocus={loadChargeFilterOptions}
                >
                  {chargeOptionsLoaded ? (
                    chargeOptions.length > 0 ? (
                      chargeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    ) : (
                      <option disabled>Δεν υπάρχουν καταχωρημένες χρεώσεις</option>
                    )
                  ) : (
                    <option disabled>Κάντε κλικ για φόρτωση...</option>
                  )}
                </FilterSelect>
                <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή · βάσει νέου συστήματος χρέωσης</HelpText>
              </FilterSection>

              <FilterSection>
                <FilterLabel>📦 Είδος</FilterLabel>
                <FilterSelect
                  multiple
                  value={filters.projectType}
                  onChange={(e) => handleMultiSelectChange('projectType', e)}
                >
                  {PROJECT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </FilterSelect>
                <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή</HelpText>
              </FilterSection>

              <FilterSection>
                <FilterLabel>💰 Πηγή Χρηματοδότησης</FilterLabel>
                <FilterSelect
                  multiple
                  value={filters.fundingSource}
                  onChange={(e) => handleMultiSelectChange('fundingSource', e)}
                >
                  {FUNDING_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </FilterSelect>
                <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή</HelpText>
              </FilterSection>

              {availableFundingDetails.length > 0 && (
                <FilterSection>
                  <FilterLabel>📋 Λεπτομέρειες Χρηματοδότησης</FilterLabel>
                  <FilterSelect
                    multiple
                    value={filters.fundingDetails}
                    onChange={(e) => handleMultiSelectChange('fundingDetails', e)}
                  >
                    {availableFundingDetails.map(detail => (
                      <option key={detail} value={detail}>{detail}</option>
                    ))}
                  </FilterSelect>
                  <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή</HelpText>
                </FilterSection>
              )}

              <FilterSection>
                <FilterLabel>📊 Κατάσταση</FilterLabel>
                <FilterSelect
                  multiple
                  value={filters.projectStatus}
                  onChange={(e) => handleMultiSelectChange('projectStatus', e)}
                >
                  {PROJECT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </FilterSelect>
                <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή</HelpText>
              </FilterSection>

              <FilterSection>
                <FilterLabel>🏷️ Χαρακτηρισμός</FilterLabel>
                <FilterSelect
                  value={filters.characterization || ''}
                  onChange={(e) => handleInputChange('characterization', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="ΝΕΟ">ΝΕΟ</option>
                  <option value="ΣΥΝΕΧΙΖΟΜΕΝΟ">ΣΥΝΕΧΙΖΟΜΕΝΟ</option>
                </FilterSelect>
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔧 Μορφή Υλοποίησης</FilterLabel>
                <FilterSelect
                  multiple
                  value={filters.implementationForm}
                  onChange={(e) => handleMultiSelectChange('implementationForm', e)}
                >
                  {IMPLEMENTATION_FORMS.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </FilterSelect>
                <HelpText>Κρατήστε Ctrl (ή Cmd) για πολλαπλή επιλογή</HelpText>
              </FilterSection>

              <FilterSection>
                <FilterLabel>➕ Συμπληρωματικές Συμβάσεις</FilterLabel>
                <FilterSelect
                  value={filters.hasSupplementaryContracts}
                  onChange={(e) => handleInputChange('hasSupplementaryContracts', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="yes">Ναι</option>
                  <option value="no">Όχι</option>
                </FilterSelect>
              </FilterSection>

              <FilterSection>
                <FilterLabel>📝 Πλήθος Συμβάσεων</FilterLabel>
                <FilterSelect
                  value={filters.contractsCount}
                  onChange={(e) => handleInputChange('contractsCount', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="0">Καμία</option>
                  <option value="1">1 σύμβαση</option>
                  <option value="2">2 συμβάσεις</option>
                  <option value="3+">3+ συμβάσεις</option>
                </FilterSelect>
              </FilterSection>
            </FiltersGrid>
          )}

          {/* KHMDHS TAB */}
          {activeTab === 'khmdhs' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>🏢 Επωνυμία αναδόχου</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Μερικό ή πλήρες όνομα ανάδοχου από ΚΗΜΔΗΣ..."
                  value={filters.anadoxosName}
                  onChange={(e) => handleInputChange('anadoxosName', e.target.value)}
                />
                <HelpText>Αναζήτηση στα στοιχεία σύμβασης που αντλήθηκαν με ΑΔΑΜ (χωρίς τόνους)</HelpText>
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔢 ΑΦΜ ανάδοχου</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="π.χ. 094012345"
                  value={filters.anadoxosVat}
                  onChange={(e) => handleInputChange('anadoxosVat', e.target.value)}
                />
                <HelpText>Μερικό ΑΦΜ ή πλήρες · αγνοεί κενά και σύμβολα</HelpText>
              </FilterSection>
            </FiltersGrid>
          )}

          {/* AMOUNTS & DATES TAB */}
          {activeTab === 'amounts' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>💵 Υπόλοιπα Έτους</FilterLabel>
                <FilterSelect
                  value={filters.remainingYear}
                  onChange={(e) => handleInputChange('remainingYear', e.target.value)}
                  style={{ marginBottom: '0.8rem' }}
                >
                  <option value="">Όλα τα έτη</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                  <option value="2030">2030</option>
                </FilterSelect>
                {filters.remainingYear && (
                  <FilterSelect
                    value={filters.remainingAmountCondition}
                    onChange={(e) => handleInputChange('remainingAmountCondition', e.target.value)}
                  >
                    <option value="all">Όλα</option>
                    <option value="hasAmount">Με υπόλοιπο &gt; 0</option>
                    <option value="zeroOrEmpty">Μηδενικό ή κενό</option>
                  </FilterSelect>
                )}
              </FilterSection>

              <FilterSection>
                <FilterLabel>📅 Ημ. Σύμβασης</FilterLabel>
                <DateRangeContainer>
                  <div>
                    <DateLabel>Από</DateLabel>
                    <FilterInput
                      type="date"
                      value={filters.contractDateFrom}
                      onChange={(e) => handleInputChange('contractDateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <DateLabel>Έως</DateLabel>
                    <FilterInput
                      type="date"
                      value={filters.contractDateTo}
                      onChange={(e) => handleInputChange('contractDateTo', e.target.value)}
                    />
                  </div>
                </DateRangeContainer>
              </FilterSection>

              <FilterSection>
                <FilterLabel>📅 Ημ. Έναρξης Διαδικασίας</FilterLabel>
                <DateRangeContainer>
                  <div>
                    <DateLabel>Από</DateLabel>
                    <FilterInput
                      type="date"
                      value={filters.contractProcessDateFrom}
                      onChange={(e) => handleInputChange('contractProcessDateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <DateLabel>Έως</DateLabel>
                    <FilterInput
                      type="date"
                      value={filters.contractProcessDateTo}
                      onChange={(e) => handleInputChange('contractProcessDateTo', e.target.value)}
                    />
                  </div>
                </DateRangeContainer>
              </FilterSection>

              <FilterSection>
                <FilterLabel>💰 Εγκεκριμένο Ποσό</FilterLabel>
                <DateRangeContainer>
                  <div>
                    <DateLabel>Από</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="0,00"
                      value={filters.approvedAmountMin}
                      onChange={(e) => handleInputChange('approvedAmountMin', e.target.value)}
                    />
                  </div>
                  <div>
                    <DateLabel>Έως</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="100.000,00"
                      value={filters.approvedAmountMax}
                      onChange={(e) => handleInputChange('approvedAmountMax', e.target.value)}
                    />
                  </div>
                </DateRangeContainer>
              </FilterSection>

              <FilterSection>
                <FilterLabel>💰 Συμβατικό Ποσό</FilterLabel>
                <DateRangeContainer>
                  <div>
                    <DateLabel>Από</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="0,00"
                      value={filters.contractAmountMin}
                      onChange={(e) => handleInputChange('contractAmountMin', e.target.value)}
                    />
                  </div>
                  <div>
                    <DateLabel>Έως</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="100.000,00"
                      value={filters.contractAmountMax}
                      onChange={(e) => handleInputChange('contractAmountMax', e.target.value)}
                    />
                  </div>
                </DateRangeContainer>
              </FilterSection>

              <FilterSection>
                <FilterLabel>💰 Ποσό ΑΠΕ</FilterLabel>
                <DateRangeContainer>
                  <div>
                    <DateLabel>Από</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="0,00"
                      value={filters.apeAmountMin}
                      onChange={(e) => handleInputChange('apeAmountMin', e.target.value)}
                    />
                  </div>
                  <div>
                    <DateLabel>Έως</DateLabel>
                    <FilterInput
                      type="text"
                      placeholder="100.000,00"
                      value={filters.apeAmountMax}
                      onChange={(e) => handleInputChange('apeAmountMax', e.target.value)}
                    />
                  </div>
                </DateRangeContainer>
              </FilterSection>
            </FiltersGrid>
          )}

          {/* LINKS TAB */}
          {activeTab === 'links' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>✅ Εγκρίσεις Διάθεσης Πίστωσης</FilterLabel>
                <FilterSelect
                  value={filters.hasEgkriseisDialthesisPistosis}
                  onChange={(e) => handleInputChange('hasEgkriseisDialthesisPistosis', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="yes">Έχει συσχέτιση</option>
                  <option value="no">Δεν έχει συσχέτιση</option>
                </FilterSelect>
              </FilterSection>

              <FilterSection>
                <FilterLabel>📢 Συσχέτιση με Πρόσκληση</FilterLabel>
                <FilterSelect
                  value={filters.hasProsklisiLink}
                  onChange={(e) => handleInputChange('hasProsklisiLink', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="yes">Έχει συσχέτιση</option>
                  <option value="no">Δεν έχει συσχέτιση</option>
                </FilterSelect>
              </FilterSection>

              <FilterSection>
                <FilterLabel>🎯 Συσχέτιση με Ένταξη</FilterLabel>
                <FilterSelect
                  value={filters.hasEntaxiLink}
                  onChange={(e) => handleInputChange('hasEntaxiLink', e.target.value)}
                >
                  <option value="">Όλα</option>
                  <option value="yes">Έχει συσχέτιση</option>
                  <option value="no">Δεν έχει συσχέτιση</option>
                </FilterSelect>
              </FilterSection>
            </FiltersGrid>
          )}

          {/* SORT TAB */}
          {activeTab === 'sort' && (
            <FiltersGrid>
              <FilterSection>
                <FilterLabel>📊 Ταξινόμηση κατά</FilterLabel>
                <FilterSelect
                  value={filters.sortBy}
                  onChange={(e) => handleInputChange('sortBy', e.target.value)}
                >
                  <option value="kaCode">Κωδικός ΚΑ</option>
                  <option value="aleCode">Κωδ. Α.Λ.Ε.</option>
                  <option value="projectTitle">Τίτλος Έργου</option>
                  <option value="subprojectTitle">Τίτλος Υποέργου</option>
                  <option value="approvedAmount">Εγκεκριμένο Ποσό</option>
                  <option value="contractAmount">Συμβατικό Ποσό</option>
                  <option value="apeAmount">Ποσό ΑΠΕ</option>
                  <option value="contractDate">Ημερομηνία Σύμβασης</option>
                  <option value="contractProcessStartDate">Ημ. Έναρξης Διαδικασίας</option>
                  <option value="projectStatus">Κατάσταση</option>
                  <option value="chargeTo">Χρεωμένο σε</option>
                </FilterSelect>
              </FilterSection>

              <FilterSection>
                <FilterLabel>🔀 Σειρά Ταξινόμησης</FilterLabel>
                <FilterSelect
                  value={filters.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', e.target.value)}
                >
                  <option value="asc">Αύξουσα (Α-Ω, 0-9)</option>
                  <option value="desc">Φθίνουσα (Ω-Α, 9-0)</option>
                </FilterSelect>
              </FilterSection>
            </FiltersGrid>
          )}
        </ContentArea>

        <ButtonContainer>
          <ApplyButton onClick={handleApplyFilters}>
            Εφαρμογή Φίλτρων
          </ApplyButton>
          <ClearButton onClick={handleClearFilters}>
            Καθαρισμός Όλων
          </ClearButton>
        </ButtonContainer>
      </FiltersContainer>
    </FiltersOverlay>
  );
}

export default React.memo(AdvancedFilters);
