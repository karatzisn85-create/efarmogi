import React from 'react';
import styled from 'styled-components';
import { PROJECT_STATUSES, getCharacterization } from '../data/formOptions';

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    border-color: #c5cae9;
  }
`;

const ViewDetailsHint = styled.div`
  text-align: center;
  font-size: 0.72rem;
  color: #9e9e9e;
  margin-top: 0.4rem;
  letter-spacing: 0.3px;
  opacity: 0;
  transition: opacity 0.2s;

  ${Card}:hover & {
    opacity: 1;
  }
`;

const CardHeader = styled.div`
  border-bottom: 2px solid #f8f9fa;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
`;

const SubprojectTitle = styled.h4`
  color: #5c6bc0;
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  position: relative;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid #e3f2fd;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 50px;
    height: 2px;
    background: linear-gradient(90deg, #ffd700, rgba(255, 215, 0, 0.3));
    border-radius: 1px;
  }
`;

const MisPraxhsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  background: transparent;
  color: #000000;
  border: none;
  border-radius: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  box-shadow: none;
  white-space: nowrap;
`;

const CardContent = styled.div`
  display: grid;
  gap: 0.8rem;
  flex: 1; /* Γεμίζει τον διαθέσιμο χώρο */
  align-content: start; /* Στοιχίζει περιεχόμενο στην αρχή */
`;

const InfoRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 0.5rem;
  align-items: start;
`;

const InfoLabel = styled.span`
  font-weight: 500;
  color: #6c757d;
  font-size: 0.85rem;
`;

const InfoValue = styled.span`
  color: #333;
  font-size: 0.9rem;
  word-break: break-word;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  background: ${props => {
    switch (props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return '#ffc107';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return '#fd7e14';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return '#007bff';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return '#28a745';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return '#20c997';
      default: return '#6c757d';
    }
  }};
  color: white;
`;

const CharacterizationBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: ${props => props.$type === 'ΝΕΟ' ? '#e3f2fd' : '#fff8e1'};
  color: ${props => props.$type === 'ΝΕΟ' ? '#1565c0' : '#e65100'};
  border: 1px solid ${props => props.$type === 'ΝΕΟ' ? '#90caf9' : '#ffcc80'};
`;

const TypeBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${props => {
    switch (props.type) {
      case 'ΠΡΟΜΗΘΕΙΑ': return '#e3f2fd';
      case 'ΕΡΓΟ': return '#f3e5f5';
      case 'ΜΕΛΕΤΗ': return '#e8f5e8';
      case 'ΥΠΗΡΕΣΙΑ': return '#fff3e0';
      default: return '#f8f9fa';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'ΠΡΟΜΗΘΕΙΑ': return '#1976d2';
      case 'ΕΡΓΟ': return '#7b1fa2';
      case 'ΜΕΛΕΤΗ': return '#388e3c';
      case 'ΥΠΗΡΕΣΙΑ': return '#f57c00';
      default: return '#495057';
    }
  }};
`;

const AmountValue = styled.span`
  font-weight: 600;
  color: #28a745;
`;

const ContractDateLabel = styled(InfoLabel)`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.95rem;
`;

const ContractDateValue = styled(InfoValue)`
  font-weight: 600;
  color: #5c6bc0;
  font-size: 1rem;
`;

const ContractAmountLabel = styled(InfoLabel)`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.95rem;
`;

const ContractAmountValue = styled(InfoValue)`
  font-weight: 700;
  color: #28a745;
  font-size: 1rem;
`;

const ContractInfo = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 4px solid #007bff;
`;

const ContractTitle = styled.div`
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const MultipleContracts = styled.div`
  display: grid;
  gap: 0.8rem;
`;

const ContractItem = styled.div`
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  border: 1px solid #dee2e6;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
`;

const TopButtonsContainer = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  width: 100%;
`;

const BottomButtonContainer = styled.div`
  width: 100%;
`;

const ActionButton = styled.button`
  flex: 1;
  min-width: 80px;
  padding: 0.4rem 0.6rem;
  border: none;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
`;

const EditButton = styled(ActionButton)`
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;

  &:hover {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
  }
`;

const DeleteButton = styled(ActionButton)`
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;

  &:hover {
    background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
    box-shadow: 0 6px 20px rgba(250, 112, 154, 0.4);
  }
`;

const FilesButton = styled(ActionButton)`
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #2c3e50;
  font-weight: 700;

  &:hover {
    background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
    box-shadow: 0 6px 20px rgba(168, 237, 234, 0.4);
  }
`;

// Ειδικό κουμπί για Αρχεία Υποέργου - πιο ξεχωριστό
const MainFilesButton = styled.button`
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
  }

  &:hover {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
    transform: translateY(-3px);
  }

  &:hover::before {
    opacity: 1;
  }
`;

// Κόκκινο κουμπάκι για lock status
const LockStatusButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: ${props => props.isLocked ? '#dc3545' : '#28a745'};
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
`;

// Tooltip για το lock status
const LockTooltip = styled.div`
  position: absolute;
  top: -35px;
  right: 0;
  background: #333;
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 20;

  ${LockStatusButton}:hover & {
    opacity: 1;
    visibility: visible;
  }

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    right: 10px;
    border: 4px solid transparent;
    border-top-color: #333;
  }
`;


function ProjectCard({ 
  project, 
  userRole, 
  onEdit, 
  onDelete, 
  onViewFile, 
  onDownloadFile, 
  onDeleteFile, 
  onOpenFileManager,
  onOpenEntaxis,
  onOpenEgkriseis,
  hasCreditApproval = false,
  hasLinkedEgkrisi = false,
  linkedProsklisi,
  onOpenLinkedProsklisi,
  isLocked = false,
  hasEntaxi = false,
  onOpenSpecificEntaxi,
  hasProsklisi = false,
  onOpenSpecificProsklisi,
  onViewDetails
}) {

  const handleEdit = () => {
    if (isLocked) {
      alert('Το υποέργο είναι υπό επεξεργασία από άλλον διαχειριστή!');
      return;
    }
    onEdit(project);
  };

  const handleCardClick = (e) => {
    // Αγνοούμε click αν προέρχεται από κουμπί ή interactive element
    if (e.target.closest('button') || e.target.closest('a')) return;
    if (onViewDetails) onViewDetails(project);
  };

  const handleToggleFiles = () => {
    onOpenFileManager(project.projectId, project.subprojectId);
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00 €';
    return `${amount} €`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const hasContractInfo = project.contractDate || project.contractAmount || (project.contracts && project.contracts.length > 0);

  // Calculate total contract amounts
  const calculateTotalContractAmount = () => {
    let total = 0;
    
    // Add main contract amount
    if (project.contractAmount) {
      // Remove all non-digit characters except comma and dot, then remove dots (thousands separators), then replace comma with dot
      const cleaned = project.contractAmount.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(cleaned);
      if (!isNaN(amount)) total += amount;
    }
    
    // Add multiple contracts amounts
    if (project.contracts && project.contracts.length > 0) {
      project.contracts.forEach((contract, index) => {
        if (contract.amount) {
          const cleaned = contract.amount.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
          const amount = parseFloat(cleaned);
          if (!isNaN(amount)) total += amount;
        }
      });
    }
    
    // Add supplementary contracts amounts
    if (project.supplementaryContracts && project.supplementaryContracts.length > 0) {
      project.supplementaryContracts.forEach((contract, index) => {
        if (contract.amount) {
          const cleaned = contract.amount.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
          const amount = parseFloat(cleaned);
          if (!isNaN(amount)) total += amount;
        }
      });
    }
    
    return total;
  };

  const totalContractAmount = calculateTotalContractAmount();

  return (
    <>
      <Card onClick={handleCardClick}>
        {/* Lock Status Button */}
        <LockStatusButton isLocked={isLocked}>
          {isLocked ? '🔒' : '🔓'}
          <LockTooltip>
            {isLocked ? 'Ανοιχτό από άλλον χρήστη' : 'Διαθέσιμο'}
          </LockTooltip>
        </LockStatusButton>
        
        <CardHeader>
          <SubprojectTitle>
            {project.subprojectTitle}
            {project.misPraxhsName && project.misPraxhsCode && (
              <MisPraxhsBadge>
                {project.misPraxhsName}: {project.misPraxhsCode}
              </MisPraxhsBadge>
            )}
          </SubprojectTitle>
        </CardHeader>

      <CardContent>
        <InfoRow>
          <InfoLabel>Μορφή Υλοποίησης:</InfoLabel>
          <InfoValue>{project.implementationForm}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Κωδικός ΚΑ:</InfoLabel>
          <InfoValue>{project.kaCode}</InfoValue>
        </InfoRow>

        {((project.aleCodes && project.aleCodes.length > 0) || project.aleCode) && (
          <InfoRow>
            <InfoLabel>Κωδ. Α.Λ.Ε.:</InfoLabel>
            <InfoValue>
              {project.aleCodes && Array.isArray(project.aleCodes) && project.aleCodes.length > 0
                ? project.aleCodes.filter(c => c && c.trim()).join(' • ')
                : project.aleCode || ''}
            </InfoValue>
          </InfoRow>
        )}

        <InfoRow>
          <InfoLabel>Είδος:</InfoLabel>
          <InfoValue>
            <TypeBadge type={project.projectType}>{project.projectType}</TypeBadge>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Πηγή Χρηματοδότησης:</InfoLabel>
          <InfoValue>{project.fundingSource}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Εξειδίκευση:</InfoLabel>
          <InfoValue>{project.fundingDetails}</InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Εγκεκριμένο Ποσό:</InfoLabel>
          <InfoValue>
            <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Προϋπολογισμός:</InfoLabel>
          <InfoValue>
            <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
          </InfoValue>
        </InfoRow>

        <InfoRow>
          <InfoLabel>Κατάσταση:</InfoLabel>
          <InfoValue style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <StatusBadge status={project.projectStatus}>{project.projectStatus}</StatusBadge>
            {getCharacterization(project) && (
              <CharacterizationBadge $type={getCharacterization(project)}>
                {getCharacterization(project)}
              </CharacterizationBadge>
            )}
          </InfoValue>
        </InfoRow>

        {project.supervisor && (
          <InfoRow>
            <InfoLabel>Επιβλέπων:</InfoLabel>
            <InfoValue>{project.supervisor}</InfoValue>
          </InfoRow>
        )}

        {project.comments && (
          <InfoRow>
            <InfoLabel>Σχόλια:</InfoLabel>
            <InfoValue style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {project.comments}
            </InfoValue>
          </InfoRow>
        )}

        {hasContractInfo && (
          <ContractInfo>
            <ContractTitle>Στοιχεία Σύμβασης</ContractTitle>
            
            {project.implementationForm === 'Μια Σύμβαση' ? (
              <div>
                {project.projectStatus && PROJECT_STATUSES.indexOf(project.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ') && project.contractProcessStartDate && (
                  <InfoRow>
                    <InfoLabel>Ημερομηνία έναρξης διαδικασίας:</InfoLabel>
                    <InfoValue>{formatDate(project.contractProcessStartDate)}</InfoValue>
                  </InfoRow>
                )}
                {project.contractDate && (
                  <InfoRow>
                    <ContractDateLabel>Ημερ. Σύμβασης:</ContractDateLabel>
                    <ContractDateValue>{formatDate(project.contractDate)}</ContractDateValue>
                  </InfoRow>
                )}
                {project.contractAmount && (
                  <InfoRow>
                    <ContractAmountLabel>Ποσό Σύμβασης:</ContractAmountLabel>
                    <ContractAmountValue>{formatAmount(project.contractAmount)}</ContractAmountValue>
                  </InfoRow>
                )}
                {project.apeAmount && (
                  <InfoRow>
                    <InfoLabel>ΑΠΕ + Συμπλ.:</InfoLabel>
                    <InfoValue>
                      <AmountValue>{formatAmount(project.apeAmount)}</AmountValue>
                    </InfoValue>
                  </InfoRow>
                )}
                {project.apeComments && (
                  <InfoRow>
                    <InfoLabel>Σχόλια ΑΠΕ:</InfoLabel>
                    <InfoValue>{project.apeComments}</InfoValue>
                  </InfoRow>
                )}
              </div>
            ) : (
              <MultipleContracts>
                {/* Ημερομηνία έναρξης διαδικασίας - εμφανίζεται μόνο για multiple contracts αν υπάρχει */}
                {project.projectStatus && PROJECT_STATUSES.indexOf(project.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ') && project.contractProcessStartDate && (
                  <InfoRow style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #dee2e6' }}>
                    <InfoLabel style={{ fontWeight: 600, color: '#5c6bc0' }}>Ημερομηνία έναρξης διαδικασίας:</InfoLabel>
                    <InfoValue style={{ fontWeight: 600, color: '#5c6bc0', fontSize: '0.95rem' }}>{formatDate(project.contractProcessStartDate)}</InfoValue>
                  </InfoRow>
                )}
                {project.contracts && project.contracts.map((contract, index) => (
                  <ContractItem key={index}>
                    <strong>Σύμβαση {index + 1}</strong>
                    {contract.date && (
                      <InfoRow>
                        <InfoLabel>Ημερομηνία:</InfoLabel>
                        <InfoValue>{formatDate(contract.date)}</InfoValue>
                      </InfoRow>
                    )}
                    {contract.amount && (
                      <InfoRow>
                        <InfoLabel>Ποσό:</InfoLabel>
                        <InfoValue>
                          <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                        </InfoValue>
                      </InfoRow>
                    )}
                    {contract.apeAmount && (
                      <InfoRow>
                        <InfoLabel>ΑΠΕ + Συμπλ.:</InfoLabel>
                        <InfoValue>
                          <AmountValue>{formatAmount(contract.apeAmount)}</AmountValue>
                        </InfoValue>
                      </InfoRow>
                    )}
                    {contract.comments && (
                      <InfoRow>
                        <InfoLabel>Σχόλια:</InfoLabel>
                        <InfoValue>{contract.comments}</InfoValue>
                      </InfoRow>
                    )}
                  </ContractItem>
                ))}
              </MultipleContracts>
            )}
            
          </ContractInfo>
        )}

        {/* Supplementary Contracts */}
        {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && (
          <ContractInfo style={{ background: '#e8f5e8', border: '2px solid #28a745' }}>
            <ContractTitle style={{ color: '#155724' }}>Συμπληρωματικές Συμβάσεις</ContractTitle>
            
            {project.supplementaryContracts.map((contract, index) => (
              <ContractItem key={index} style={{ background: 'white', marginBottom: '1rem' }}>
                <InfoRow>
                  <InfoLabel>Συμπληρωματική {index + 1}:</InfoLabel>
                  <InfoValue>
                    {contract.date && formatDate(contract.date)}
                    {contract.amount && (
                      <span style={{ marginLeft: '1rem' }}>
                        <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                      </span>
                    )}
                  </InfoValue>
                </InfoRow>
                {contract.comments && (
                  <InfoRow>
                    <InfoLabel>Σχόλια:</InfoLabel>
                    <InfoValue>{contract.comments}</InfoValue>
                  </InfoRow>
                )}
              </ContractItem>
            ))}
          </ContractInfo>
        )}

        {/* Total Contract Amount - Only show if there are supplementary contracts - MOVED TO BOTTOM */}
        {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && totalContractAmount > 0 && (
          <ContractInfo style={{ 
            background: '#f8f9fa', 
            border: '2px solid #007bff',
            marginTop: '0.5rem'
          }}>
            <ContractTitle style={{ color: '#007bff', fontSize: '1rem', marginBottom: '0.5rem' }}>
              Σύνολο Συμβάσεων
            </ContractTitle>
            <InfoRow style={{ padding: '0.5rem 0' }}>
              <InfoLabel style={{ fontWeight: 'bold', fontSize: '1rem', color: '#007bff' }}>
                Συνολικό Ποσό:
              </InfoLabel>
              <InfoValue>
                <AmountValue style={{ fontSize: '1.1rem', color: '#007bff' }}>
                  {totalContractAmount.toLocaleString('el-GR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2,
                    useGrouping: true
                  })} €
                </AmountValue>
              </InfoValue>
            </InfoRow>
          </ContractInfo>
        )}
      </CardContent>

      <ButtonContainer>
        <TopButtonsContainer>
          {(hasCreditApproval || hasLinkedEgkrisi) && (
            <FilesButton 
              onClick={() => onOpenEgkriseis && onOpenEgkriseis(project.projectTitle, project.subprojectTitle)}
              style={hasLinkedEgkrisi ? { 
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
              } : undefined}
            >
              ✅ ΕΓΚΡΙΣΗ ΔΙΑΘ. ΠΙΣΤΩΣΗΣ
            </FilesButton>
          )}
          {linkedProsklisi && (
            <FilesButton 
              onClick={() => onOpenLinkedProsklisi && onOpenLinkedProsklisi(linkedProsklisi.prosklisiId)}
              style={{ 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)'
              }}
            >
              📢 Πρόσκληση
            </FilesButton>
          )}
          {hasEntaxi && (
            <FilesButton 
              onClick={() => onOpenSpecificEntaxi && onOpenSpecificEntaxi()}
              style={{ 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)'
              }}
            >
              📋 ΕΝΤΑΞΗ
            </FilesButton>
          )}
          {hasProsklisi && (
            <FilesButton 
              onClick={() => onOpenSpecificProsklisi && onOpenSpecificProsklisi()}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              📢 ΠΡΟΣΚΛΗΣΗ
            </FilesButton>
          )}
        </TopButtonsContainer>
        <BottomButtonContainer>
          <MainFilesButton onClick={handleToggleFiles}>
            📁 Αρχεία Υποέργου
          </MainFilesButton>
        </BottomButtonContainer>
      </ButtonContainer>

        <ViewDetailsHint>👆 Κλικ στην κάρτα για λεπτομέρειες</ViewDetailsHint>
      </Card>
    </>
  );
}

export default ProjectCard;
