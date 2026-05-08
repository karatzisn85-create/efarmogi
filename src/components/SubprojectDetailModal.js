import React, { useEffect } from 'react';
import styled from 'styled-components';
import { PROJECT_STATUSES } from '../data/formOptions';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1.5rem;
  backdrop-filter: blur(4px);
`;

const Modal = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.25s ease-out;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  color: white;
  padding: 1.5rem 2rem;
  border-radius: 16px 16px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const HeaderLeft = styled.div`
  flex: 1;
`;

const ProjectTitleSmall = styled.div`
  font-size: 0.85rem;
  opacity: 0.85;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SubprojectTitleLarge = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.3;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
`;

const EditButton = styled.button`
  background: white;
  color: #5c6bc0;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    background: #f0f4ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const CloseButton = styled.button`
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255,255,255,0.35);
  }
`;

const ModalBody = styled.div`
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
`;

const Section = styled.div`
  margin-bottom: 1.8rem;
`;

const SectionTitle = styled.h3`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #9e9e9e;
  margin: 0 0 0.8rem 0;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid #f0f0f0;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem 2rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const FieldFull = styled(Field)`
  grid-column: span 2;
  @media (max-width: 600px) {
    grid-column: span 1;
  }
`;

const FieldLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #9e9e9e;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const FieldValue = styled.span`
  font-size: 0.95rem;
  color: #212529;
  font-weight: 400;
  word-break: break-word;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
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

const TypeBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.7rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
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
  font-weight: 700;
  color: #28a745;
  font-size: 1rem;
`;

const ContractBox = styled.div`
  background: #f8f9fa;
  border-radius: 10px;
  padding: 1rem 1.2rem;
  border-left: 4px solid #5c6bc0;
  margin-bottom: 0.8rem;
`;

const ContractBoxTitle = styled.div`
  font-weight: 700;
  color: #5c6bc0;
  font-size: 0.9rem;
  margin-bottom: 0.6rem;
`;

const SupplementaryBox = styled(ContractBox)`
  border-left-color: #28a745;
  background: #f0faf0;
`;

const TotalBox = styled.div`
  background: #e8f4fd;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
  border: 2px solid #007bff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
`;

const AleRemainingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const AleBadge = styled.span`
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyValue = styled.span`
  color: #bdbdbd;
  font-style: italic;
  font-size: 0.9rem;
`;

function SubprojectDetailModal({ project, onClose, onEdit, userRole, isLocked }) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!project) return null;

  const formatAmount = (amount) => {
    if (!amount) return null;
    return `${amount} €`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const val = (v) => v && v.toString().trim() ? v : null;

  const hasContractInfo = project.contractDate || project.contractAmount ||
    (project.contracts && project.contracts.length > 0);

  const showContractProcessDate = project.projectStatus &&
    PROJECT_STATUSES.indexOf(project.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ');

  const calculateTotalContractAmount = () => {
    let total = 0;
    const parse = (v) => {
      if (!v) return 0;
      const n = parseFloat(v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? 0 : n;
    };
    total += parse(project.contractAmount);
    (project.contracts || []).forEach(c => { total += parse(c.amount); });
    (project.supplementaryContracts || []).forEach(c => { total += parse(c.amount); });
    return total;
  };

  const totalContractAmount = calculateTotalContractAmount();

  const multipleAle = project.aleCodes && project.aleCodes.length > 1;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal>
        {/* Header */}
        <ModalHeader>
          <HeaderLeft>
            <ProjectTitleSmall>📁 {project.projectTitle}</ProjectTitleSmall>
            <SubprojectTitleLarge>{project.subprojectTitle}</SubprojectTitleLarge>
          </HeaderLeft>
          <HeaderRight>
            {userRole === 'ADMIN' && (
              <EditButton
                onClick={() => { onClose(); onEdit(project); }}
                disabled={isLocked}
                title={isLocked ? 'Κλειδωμένο από άλλον χρήστη' : 'Επεξεργασία υποέργου'}
              >
                ✏️ {isLocked ? 'Κλειδωμένο' : 'Επεξεργασία'}
              </EditButton>
            )}
            <CloseButton onClick={onClose} title="Κλείσιμο">✕</CloseButton>
          </HeaderRight>
        </ModalHeader>

        {/* Body */}
        <ModalBody>

          {/* Βασικά Στοιχεία */}
          <Section>
            <SectionTitle>Βασικά Στοιχεία</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Μορφή Υλοποίησης</FieldLabel>
                <FieldValue>{val(project.implementationForm) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Κατάσταση</FieldLabel>
                <FieldValue>
                  {project.projectStatus
                    ? <StatusBadge status={project.projectStatus}>{project.projectStatus}</StatusBadge>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Είδος</FieldLabel>
                <FieldValue>
                  {project.projectType
                    ? <TypeBadge type={project.projectType}>{project.projectType}</TypeBadge>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Επιβλέπων Μηχανικός</FieldLabel>
                <FieldValue>{val(project.supervisor) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              {project.misPraxhsName && project.misPraxhsCode && (
                <Field>
                  <FieldLabel>{project.misPraxhsName}</FieldLabel>
                  <FieldValue>{project.misPraxhsCode}</FieldValue>
                </Field>
              )}
            </FieldGrid>
          </Section>

          {/* Κωδικοί */}
          <Section>
            <SectionTitle>Κωδικοί</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Κωδικός ΚΑ</FieldLabel>
                <FieldValue>{val(project.kaCode) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Κωδικοί Α.Λ.Ε.</FieldLabel>
                <FieldValue>
                  {project.aleCodes && project.aleCodes.filter(c => c && c.trim()).length > 0
                    ? project.aleCodes.filter(c => c && c.trim()).map((code, i) => (
                        <span key={i} style={{
                          display: 'inline-block',
                          background: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          marginRight: '0.4rem',
                          marginBottom: '0.3rem'
                        }}>{code}</span>
                      ))
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
            </FieldGrid>
          </Section>

          {/* Χρηματοδότηση */}
          <Section>
            <SectionTitle>Χρηματοδότηση</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel>Βασική Πηγή</FieldLabel>
                <FieldValue>{val(project.fundingSource) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Εξειδίκευση</FieldLabel>
                <FieldValue>{val(project.fundingDetails) || <EmptyValue>—</EmptyValue>}</FieldValue>
              </Field>
              <Field>
                <FieldLabel>Εγκεκριμένο Ποσό</FieldLabel>
                <FieldValue>
                  {formatAmount(project.approvedAmount)
                    ? <AmountValue>{formatAmount(project.approvedAmount)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
              <Field>
                <FieldLabel>Προϋπολογισμός Έργου</FieldLabel>
                <FieldValue>
                  {formatAmount(project.projectBudget)
                    ? <AmountValue>{formatAmount(project.projectBudget)}</AmountValue>
                    : <EmptyValue>—</EmptyValue>}
                </FieldValue>
              </Field>
            </FieldGrid>
          </Section>

          {/* Υπόλοιπα */}
          {(project.remainingAmount || (project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a))) && (
            <Section>
              <SectionTitle>Υπόλοιπα Έτους {project.remainingAmountYear || '—'}</SectionTitle>
              {multipleAle && project.aleRemainingAmounts && project.aleRemainingAmounts.some(a => a) ? (
                <div>
                  {project.aleCodes.map((code, i) => (
                    <AleRemainingRow key={i}>
                      <AleBadge>{code || `Α.Λ.Ε. ${i + 1}`}</AleBadge>
                      <FieldValue>
                        {project.aleRemainingAmounts[i]
                          ? <AmountValue>{project.aleRemainingAmounts[i]} €</AmountValue>
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </AleRemainingRow>
                  ))}
                  {project.remainingAmount && (
                    <TotalBox style={{ marginTop: '0.8rem' }}>
                      <span style={{ fontWeight: 700, color: '#007bff', fontSize: '0.9rem' }}>ΣΥΝΟΛΟ:</span>
                      <AmountValue style={{ color: '#007bff', fontSize: '1.05rem' }}>
                        {project.remainingAmount} €
                      </AmountValue>
                    </TotalBox>
                  )}
                </div>
              ) : (
                <FieldGrid>
                  <Field>
                    <FieldLabel>Ποσό Υπολοίπων</FieldLabel>
                    <FieldValue>
                      {formatAmount(project.remainingAmount)
                        ? <AmountValue>{formatAmount(project.remainingAmount)}</AmountValue>
                        : <EmptyValue>—</EmptyValue>}
                    </FieldValue>
                  </Field>
                </FieldGrid>
              )}
              {project.remainingAmountComments && (
                <FieldGrid style={{ marginTop: '0.6rem' }}>
                  <FieldFull>
                    <FieldLabel>Σχόλια Υπολοίπων</FieldLabel>
                    <FieldValue>{project.remainingAmountComments}</FieldValue>
                  </FieldFull>
                </FieldGrid>
              )}
            </Section>
          )}

          {/* Σύμβαση */}
          {hasContractInfo && (
            <Section>
              <SectionTitle>Στοιχεία Σύμβασης</SectionTitle>

              {showContractProcessDate && project.contractProcessStartDate && (
                <FieldGrid style={{ marginBottom: '1rem' }}>
                  <Field>
                    <FieldLabel>Ημερ. Έναρξης Διαδικασίας</FieldLabel>
                    <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                      {formatDate(project.contractProcessStartDate)}
                    </FieldValue>
                  </Field>
                </FieldGrid>
              )}

              {project.implementationForm === 'Μια Σύμβαση' ? (
                <ContractBox>
                  <ContractBoxTitle>Σύμβαση</ContractBoxTitle>
                  <FieldGrid>
                    <Field>
                      <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                      <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                        {formatDate(project.contractDate) || <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </Field>
                    <Field>
                      <FieldLabel>Ποσό Σύμβασης</FieldLabel>
                      <FieldValue>
                        {formatAmount(project.contractAmount)
                          ? <AmountValue style={{ color: '#5c6bc0' }}>{formatAmount(project.contractAmount)}</AmountValue>
                          : <EmptyValue>—</EmptyValue>}
                      </FieldValue>
                    </Field>
                    {project.apeAmount && (
                      <Field>
                        <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                        <FieldValue><AmountValue>{formatAmount(project.apeAmount)}</AmountValue></FieldValue>
                      </Field>
                    )}
                    {project.apeComments && (
                      <Field>
                        <FieldLabel>Σχόλια ΑΠΕ</FieldLabel>
                        <FieldValue>{project.apeComments}</FieldValue>
                      </Field>
                    )}
                  </FieldGrid>
                </ContractBox>
              ) : (
                (project.contracts || []).map((contract, index) => (
                  <ContractBox key={index}>
                    <ContractBoxTitle>Σύμβαση {index + 1}</ContractBoxTitle>
                    <FieldGrid>
                      <Field>
                        <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                        <FieldValue style={{ color: '#5c6bc0', fontWeight: 600 }}>
                          {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                        </FieldValue>
                      </Field>
                      <Field>
                        <FieldLabel>Ποσό</FieldLabel>
                        <FieldValue>
                          {formatAmount(contract.amount)
                            ? <AmountValue style={{ color: '#5c6bc0' }}>{formatAmount(contract.amount)}</AmountValue>
                            : <EmptyValue>—</EmptyValue>}
                        </FieldValue>
                      </Field>
                      {contract.apeAmount && (
                        <Field>
                          <FieldLabel>ΑΠΕ + Συμπληρωματικές</FieldLabel>
                          <FieldValue><AmountValue>{formatAmount(contract.apeAmount)}</AmountValue></FieldValue>
                        </Field>
                      )}
                      {contract.comments && (
                        <FieldFull>
                          <FieldLabel>Σχόλια</FieldLabel>
                          <FieldValue>{contract.comments}</FieldValue>
                        </FieldFull>
                      )}
                    </FieldGrid>
                  </ContractBox>
                ))
              )}

              {/* Συμπληρωματικές */}
              {project.hasSupplementaryContracts && project.supplementaryContracts && project.supplementaryContracts.length > 0 && (
                <>
                  {project.supplementaryContracts.map((contract, index) => (
                    <SupplementaryBox key={index}>
                      <ContractBoxTitle style={{ color: '#28a745' }}>Συμπληρωματική Σύμβαση {index + 1}</ContractBoxTitle>
                      <FieldGrid>
                        <Field>
                          <FieldLabel>Ημερομηνία Υπογραφής</FieldLabel>
                          <FieldValue style={{ color: '#28a745', fontWeight: 600 }}>
                            {formatDate(contract.date) || <EmptyValue>—</EmptyValue>}
                          </FieldValue>
                        </Field>
                        <Field>
                          <FieldLabel>Ποσό</FieldLabel>
                          <FieldValue>
                            {formatAmount(contract.amount)
                              ? <AmountValue>{formatAmount(contract.amount)}</AmountValue>
                              : <EmptyValue>—</EmptyValue>}
                          </FieldValue>
                        </Field>
                        {contract.comments && (
                          <FieldFull>
                            <FieldLabel>Σχόλια</FieldLabel>
                            <FieldValue>{contract.comments}</FieldValue>
                          </FieldFull>
                        )}
                      </FieldGrid>
                    </SupplementaryBox>
                  ))}
                </>
              )}

              {/* Σύνολο */}
              {totalContractAmount > 0 && (
                <TotalBox>
                  <span style={{ fontWeight: 700, color: '#007bff' }}>ΣΥΝΟΛΟ ΣΥΜΒΑΣΕΩΝ:</span>
                  <AmountValue style={{ color: '#007bff', fontSize: '1.05rem' }}>
                    {totalContractAmount.toLocaleString('el-GR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} €
                  </AmountValue>
                </TotalBox>
              )}
            </Section>
          )}

          {/* Σχόλια */}
          {project.comments && (
            <Section>
              <SectionTitle>Σχόλια</SectionTitle>
              <FieldValue style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {project.comments}
              </FieldValue>
            </Section>
          )}

          {/* Εισηγητική Έκθεση */}
          {project.eisigitikiEkthesi && (
            <Section>
              <SectionTitle>Εισηγητική Έκθεση</SectionTitle>
              <FieldValue style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {project.eisigitikiEkthesi}
              </FieldValue>
            </Section>
          )}

        </ModalBody>
      </Modal>
    </Overlay>
  );
}

export default SubprojectDetailModal;
