import React from 'react';
import styled, { css } from 'styled-components';
import { PROJECT_STATUSES, getCharacterization } from '../data/formOptions';

const iconProps = { width: 14, height: 14, 'aria-hidden': true };

function IconCredit() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 11H4a1 1 0 0 0-1 1z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const Card = styled.div`
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
    opacity: 0;
    transition: opacity 0.35s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(99, 102, 241, 0.12), 0 8px 16px rgba(0, 0, 0, 0.06);
    border-color: rgba(165, 180, 252, 0.6);

    &::before {
      opacity: 1;
    }
  }
`;

const ViewDetailsHint = styled.div`
  text-align: center;
  font-size: 0.65rem;
  color: #64748b;
  margin-top: 0.45rem;
  letter-spacing: 0.02em;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.3s ease;

  ${Card}:hover & {
    opacity: 1;
  }
`;

const CardHeader = styled.div`
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
`;

const SubprojectTitle = styled.h4`
  color: #1e293b;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  letter-spacing: 0.3px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
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
  font-weight: 600;
  color: #64748b;
  font-size: 0.8rem;
  letter-spacing: 0.2px;
`;

const InfoValue = styled.span`
  color: #1e293b;
  font-size: 0.85rem;
  word-break: break-word;
  font-weight: 500;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.3px;
  background: ${props => {
    switch (props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return 'linear-gradient(135deg, #fbbf24, #f59e0b)';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return 'linear-gradient(135deg, #fb923c, #ea580c)';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return 'linear-gradient(135deg, #60a5fa, #2563eb)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return 'linear-gradient(135deg, #34d399, #059669)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return 'linear-gradient(135deg, #2dd4bf, #0d9488)';
      default: return 'linear-gradient(135deg, #94a3b8, #64748b)';
    }
  }};
  color: white;
  box-shadow: 0 2px 6px ${props => {
    switch (props.status) {
      case 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': return 'rgba(245, 158, 11, 0.3)';
      case 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': return 'rgba(234, 88, 12, 0.3)';
      case 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': return 'rgba(37, 99, 235, 0.3)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ': return 'rgba(5, 150, 105, 0.3)';
      case 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': return 'rgba(13, 148, 136, 0.3)';
      default: return 'rgba(100, 116, 139, 0.3)';
    }
  }};
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
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 10px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 3px solid #6366f1;
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-left: 3px solid #6366f1;
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
  border-top: 1px solid rgba(226, 232, 240, 0.6);
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

const ToolbarButton = styled.button`
  flex: 1 1 0;
  min-width: 0;
  padding: 0.5rem 0.45rem;
  border-radius: 8px;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);

  svg {
    flex-shrink: 0;
    color: #64748b;
  }

  &:hover svg {
    color: #334155;
  }

  &:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.07);
  }

  &:active {
    background: #f1f5f9;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  ${(p) =>
    p.$tone === 'success' &&
    css`
      background: #f0fdf4;
      border-color: #86efac;
      color: #14532d;

      &:hover {
        background: #dcfce7;
        border-color: #4ade80;
      }

      svg {
        color: #15803d;
      }

      &:hover svg {
        color: #166534;
      }
    `}
`;

const MainFilesButton = styled.button`
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  color: #f8fafc;
  background: #1e293b;
  border: 1px solid #334155;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);

  svg {
    flex-shrink: 0;
    color: #cbd5e1;
  }

  &:hover svg {
    color: #f1f5f9;
  }

  &:hover {
    background: #334155;
    border-color: #475569;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
  }

  &:active {
    background: #0f172a;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
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
    if (isNaN(date.getTime())) return '-';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const hasContractInfo = project.contractDate || project.contractAmount || (project.contracts && project.contracts.length > 0);

  const safeParseAmount = (val) => {
    if (!val) return 0;
    const str = typeof val === 'number' ? String(val) : val;
    const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  };

  const calculateTotalContractAmount = () => {
    let total = safeParseAmount(project.contractAmount);
    
    if (project.contracts && project.contracts.length > 0) {
      project.contracts.forEach((contract) => {
        total += safeParseAmount(contract.amount);
      });
    }
    
    if (project.supplementaryContracts && project.supplementaryContracts.length > 0) {
      project.supplementaryContracts.forEach((contract) => {
        total += safeParseAmount(contract.amount);
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
            <ToolbarButton
              type="button"
              $tone={hasLinkedEgkrisi ? 'success' : undefined}
              onClick={() => onOpenEgkriseis && onOpenEgkriseis(project.projectTitle, project.subprojectTitle)}
            >
              <IconCredit />
              ΕΓΚΡΙΣΗ ΔΙΑΘ. ΠΙΣΤΩΣΗΣ
            </ToolbarButton>
          )}
          {linkedProsklisi && (
            <ToolbarButton
              type="button"
              onClick={() => onOpenLinkedProsklisi && onOpenLinkedProsklisi(linkedProsklisi.prosklisiId)}
            >
              <IconMegaphone />
              Πρόσκληση
            </ToolbarButton>
          )}
          {hasEntaxi && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificEntaxi && onOpenSpecificEntaxi()}>
              <IconDocument />
              ΕΝΤΑΞΗ
            </ToolbarButton>
          )}
          {hasProsklisi && (
            <ToolbarButton type="button" onClick={() => onOpenSpecificProsklisi && onOpenSpecificProsklisi()}>
              <IconMegaphone />
              ΠΡΟΣΚΛΗΣΗ
            </ToolbarButton>
          )}
        </TopButtonsContainer>
        <BottomButtonContainer>
          <MainFilesButton type="button" onClick={handleToggleFiles}>
            <IconFolder />
            Αρχεία Υποέργου
          </MainFilesButton>
        </BottomButtonContainer>
      </ButtonContainer>

        <ViewDetailsHint>Κλικ στην κάρτα για λεπτομέρειες</ViewDetailsHint>
      </Card>
    </>
  );
}

export default ProjectCard;
