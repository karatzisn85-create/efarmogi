import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { formatAuditDisplayValue } from '../utils/formatAuditDisplay';
import { showConfirm } from '../utils/confirmModal';
import auditConfig from '../data/auditFieldLabels.json';

const ipcRenderer = window.electronAPI;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 15px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const InfoButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.4);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;
  font-style: italic;
  font-family: Georgia, serif;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(255, 255, 255, 0.6);
  }
`;

const InfoPopover = styled.div`
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  background: white;
  color: #333;
  border-radius: 12px;
  padding: 1.25rem;
  width: 380px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 100;
  font-style: normal;
  font-family: inherit;
  text-align: left;

  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 12px;
    width: 16px;
    height: 16px;
    background: white;
    transform: rotate(45deg);
    box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.05);
  }
`;

const InfoTitle = styled.div`
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #4f46e5;
`;

const InfoText = styled.div`
  font-size: 0.88rem;
  line-height: 1.6;
  color: #555;
  margin-bottom: 0.5rem;
`;

const InfoHighlight = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #333;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #f0f0ff;
  border-radius: 8px;
  border-left: 3px solid #4f46e5;
`;

const ClearButton = styled.button`
  background: rgba(220, 53, 69, 0.8);
  border: none;
  color: white;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  margin-right: 0.5rem;

  &:hover {
    background: rgba(220, 53, 69, 1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalContent = styled.div`
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
`;

const FiltersContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FilterLabel = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: #666;
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;

  &:focus {
    border-color: #6366f1;
  }
`;

const FilterInput = styled.input`
  padding: 0.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;

  &:focus {
    border-color: #6366f1;
  }
`;

const LogList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const LogItem = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1rem;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const LogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 0.5rem;
`;

const LogInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const LogTitle = styled.div`
  font-weight: 600;
  font-size: 1rem;
  color: #333;
`;

const LogMeta = styled.div`
  font-size: 0.85rem;
  color: #666;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const ActionBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    if (props.$action === 'create') return '#d4edda';
    if (props.$action === 'update') return '#fff3cd';
    if (props.$action === 'delete') return '#f8d7da';
    if (props.$action === 'import') return '#d1ecf1';
    return '#e9ecef';
  }};
  color: ${props => {
    if (props.$action === 'create') return '#155724';
    if (props.$action === 'update') return '#856404';
    if (props.$action === 'delete') return '#721c24';
    if (props.$action === 'import') return '#0c5460';
    return '#495057';
  }};
`;

const LogDetails = styled.div`
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
`;

const ChangesList = styled.div`
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
`;

const ChangeItem = styled.div`
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const ChangeField = styled.span`
  font-weight: 600;
  color: #333;
`;

const ChangeValue = styled.span`
  color: #666;
  margin-left: 0.5rem;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #999;
  font-size: 1rem;
`;


const StatsContainer = styled.div`
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: #666;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
`;

const ENTITY_TYPE_LABELS = {
  'project': 'Έργο',
  'subproject': 'Υποέργο',
  'prosklisi': 'Πρόσκληση',
  'entaxi': 'Ένταξη',
  'egkrisi': 'Έγκριση Διάθεσης Πίστωσης',
  'egkrisi_subproject': 'Υποέργο Εγκρίσεων',
  'prosklisi_modification': 'Τροποποίηση Πρόσκλησης',
  'entaxi_modification': 'Τροποποίηση Ένταξης',
  'user': 'Χρήστης',
  'file': 'Αρχείο',
  'file_group': 'Ομάδα Αρχείων',
  'document_template': 'Υπόδειγμα Εγγράφου',
  'document_category': 'Κατηγορία Εγγράφων',
  'note': 'Σημείωση',
  'note_group': 'Ομάδα Σημειώσεων',
  'egkrisi_link': 'Σύνδεση Έγκρισης',
  'proposal': 'Έργο Ωρίμανσης',
};

const ACTION_LABELS = {
  'create': 'Δημιουργία',
  'update': 'Ενημέρωση',
  'delete': 'Διαγραφή',
  'import': 'Εισαγωγή',
  'export': 'Εξαγωγή',
};

function getVisibilityText(role) {
  if (role === 'SUPERADMIN') return 'Βλέπετε τις ενέργειες ΟΛΩΝ των χρηστών.';
  if (role === 'ADMIN') return 'Βλέπετε τις ενέργειες όλων των Διαχειριστών και Μηχανικών.';
  return 'Βλέπετε μόνο τις δικές σας ενέργειες.';
}

function AuditLogViewer({ isOpen, onClose, currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [engineerCatalog, setEngineerCatalog] = useState([]);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: ''
  });

  const userRole = currentUser?.role || 'USER';

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = () => setShowInfo(false);
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 10);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClickOutside); };
  }, [showInfo]);

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('get-audit-log', {
        limit: 1000,
        entityType: filters.entityType || null,
        action: filters.action || null,
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        requestingUser: {
          username: currentUser?.username,
          fullName: currentUser?.fullName,
          role: currentUser?.role
        }
      });

      if (result.success) {
        const norm = (s) => {
          if (typeof s !== 'string') return s;
          return s.normalize('NFC')
            .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        };
        const cleaned = (result.logs || []).map(log => {
          if (log.action !== 'update' || !log.changes) return log;
          const realChanges = {};
          for (const [field, change] of Object.entries(log.changes)) {
            const o = norm(change.old);
            const n = norm(change.new);
            if (o !== n) realChanges[field] = change;
          }
          return { ...log, changes: realChanges };
        }).filter(log => {
          if (log.action === 'update' && log.changes && Object.keys(log.changes).length === 0) return false;
          return true;
        });
        setLogs(cleaned);
      } else {
        console.error('Error loading audit log:', result.error);
      }
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    loadAuditLog();
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-registered-engineers');
        if (res?.success && Array.isArray(res.engineers)) {
          setEngineerCatalog(res.engineers);
        } else {
          setEngineerCatalog([]);
        }
      } catch {
        setEngineerCatalog([]);
      }
    })();
  }, [isOpen, loadAuditLog]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getActionLabel = (action) => ACTION_LABELS[action] || action;

  const getEntityTypeLabel = (entityType) => ENTITY_TYPE_LABELS[entityType] || entityType;

  const getUserDisplay = (log) => log.userFullName || log.user || 'Άγνωστος';

  const formatChangeValue = (value) => formatAuditDisplayValue(value, engineerCatalog);

  /** Παλιές καταγραφές μπορεί να έχουν κλειδιά backend — μετάφραση για εμφάνιση */
  const translateChangeFieldName = (fieldKey) => {
    if (auditConfig.fieldLabels[fieldKey]) return auditConfig.fieldLabels[fieldKey];
    return fieldKey;
  };

  const handleClearAuditLog = async () => {
    const confirmed = await showConfirm({
      title: 'Εκκαθάριση Ιστορικού Ενεργειών',
      message: `Πρόκειται να διαγράψετε όλες τις ${logs.length} καταγραφές από το ιστορικό ενεργειών.`,
      detail: 'Η ενέργεια αυτή είναι μη αναστρέψιμη. Τα δεδομένα της εφαρμογής δεν θα επηρεαστούν.',
      confirmLabel: 'Εκκαθάριση',
      icon: '🗑'
    });
    if (!confirmed) return;
    try {
      const result = await ipcRenderer.invoke('clear-audit-log', 0);
      if (result.success) {
        await loadAuditLog();
      }
    } catch (error) {
      console.error('Error clearing audit log:', error);
    }
  };

  const stats = {
    total: logs.length,
    creates: logs.filter(l => l.action === 'create').length,
    updates: logs.filter(l => l.action === 'update').length,
    deletes: logs.filter(l => l.action === 'delete').length
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <HeaderLeft>
            <ModalTitle>Ιστορικό Ενεργειών</ModalTitle>
            <InfoButton
              onClick={(e) => { e.stopPropagation(); setShowInfo(prev => !prev); }}
              title="Πληροφορίες"
            >
              i
              {showInfo && (
                <InfoPopover onClick={(e) => e.stopPropagation()}>
                  <InfoTitle>Πληροφορίες Ιστορικού Ενεργειών</InfoTitle>
                  <InfoText>
                    Η υπηρεσία αυτή καταγράφει όλες τις ενέργειες που επηρεάζουν
                    δεδομένα στην εφαρμογή (δημιουργία, ενημέρωση, διαγραφή).
                  </InfoText>
                  <InfoText>
                    Δεν καταγράφονται ενέργειες στον Χώρο Εργασίας.
                  </InfoText>
                  <InfoHighlight>
                    {getVisibilityText(userRole)}
                  </InfoHighlight>
                </InfoPopover>
              )}
            </InfoButton>
          </HeaderLeft>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {userRole === 'SUPERADMIN' && logs.length > 0 && (
              <ClearButton onClick={handleClearAuditLog}>
                🗑 Εκκαθάριση
              </ClearButton>
            )}
            <CloseButton onClick={onClose}>Κλείσιμο</CloseButton>
          </div>
        </ModalHeader>

        <ModalContent>
          <StatsContainer>
            <StatItem>
              <StatLabel>Σύνολο Ενεργειών</StatLabel>
              <StatValue>{stats.total}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Δημιουργίες</StatLabel>
              <StatValue style={{ color: '#155724' }}>{stats.creates}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Ενημερώσεις</StatLabel>
              <StatValue style={{ color: '#856404' }}>{stats.updates}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Διαγραφές</StatLabel>
              <StatValue style={{ color: '#721c24' }}>{stats.deletes}</StatValue>
            </StatItem>
          </StatsContainer>

          <FiltersContainer>
            <FilterGroup>
              <FilterLabel>Τύπος</FilterLabel>
              <FilterSelect
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              >
                <option value="">Όλα</option>
                <option value="subproject">Υποέργα</option>
                <option value="project">Έργα</option>
                <option value="prosklisi">Προσκλήσεις</option>
                <option value="entaxi">Εντάξεις</option>
                <option value="egkrisi">Εγκρίσεις Διάθεσης Πίστωσης</option>
                <option value="prosklisi_modification">Τροποποιήσεις Προσκλήσεων</option>
                <option value="entaxi_modification">Τροποποιήσεις Εντάξεων</option>
                <option value="user">Χρήστες</option>
                <option value="file">Αρχεία</option>
                <option value="file_group">Ομάδες Αρχείων</option>
                <option value="document_template">Υποδείγματα Εγγράφων</option>
                <option value="document_category">Κατηγορίες Εγγράφων</option>
                <option value="note">Σημειώσεις</option>
                <option value="egkrisi_link">Συνδέσεις Εγκρίσεων</option>
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Ενέργεια</FilterLabel>
              <FilterSelect
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              >
                <option value="">Όλες</option>
                <option value="create">Δημιουργία</option>
                <option value="update">Ενημέρωση</option>
                <option value="delete">Διαγραφή</option>
                <option value="import">Εισαγωγή</option>
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Από</FilterLabel>
              <FilterInput
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>Έως</FilterLabel>
              <FilterInput
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </FilterGroup>
          </FiltersContainer>

          {loading ? (
            <LoadingMessage>Φόρτωση ιστορικού...</LoadingMessage>
          ) : logs.length === 0 ? (
            <EmptyMessage>Δεν βρέθηκαν καταγραφές</EmptyMessage>
          ) : (
            <LogList>
              {logs.map((log) => (
                <LogItem key={log.id}>
                  <LogHeader>
                    <LogInfo>
                      <LogTitle>{log.entityTitle}</LogTitle>
                      <LogMeta>
                        <span><strong>Χρήστης:</strong> {getUserDisplay(log)}</span>
                        <span><strong>Ημερομηνία:</strong> {formatDate(log.timestamp)}</span>
                        <span><strong>Τύπος:</strong> {getEntityTypeLabel(log.entityType)}</span>
                      </LogMeta>
                    </LogInfo>
                    <ActionBadge $action={log.action}>
                      {getActionLabel(log.action)}
                    </ActionBadge>
                  </LogHeader>

                  {log.details && (
                    <LogDetails>
                      <strong>Λεπτομέρειες:</strong> {log.details}
                    </LogDetails>
                  )}

                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <ChangesList>
                      <strong>Αλλαγές:</strong>
                      {Object.entries(log.changes).map(([field, change]) => (
                        <ChangeItem key={field}>
                          <ChangeField>{translateChangeFieldName(field)}:</ChangeField>
                          <ChangeValue>
                            <span style={{ color: '#dc3545' }}>"{formatChangeValue(change.old)}"</span>
                            {' \u2192 '}
                            <span style={{ color: '#28a745' }}>"{formatChangeValue(change.new)}"</span>
                          </ChangeValue>
                        </ChangeItem>
                      ))}
                    </ChangesList>
                  )}
                </LogItem>
              ))}
            </LogList>
          )}
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
}

export default AuditLogViewer;
