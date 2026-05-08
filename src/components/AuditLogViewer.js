import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

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

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
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
    if (props.action === 'create') return '#d4edda';
    if (props.action === 'update') return '#fff3cd';
    if (props.action === 'delete') return '#f8d7da';
    return '#e9ecef';
  }};
  color: ${props => {
    if (props.action === 'create') return '#155724';
    if (props.action === 'update') return '#856404';
    if (props.action === 'delete') return '#721c24';
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

const RollbackButton = styled.button`
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  margin-left: auto;

  &:hover {
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
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

function AuditLogViewer({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState(null);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: ''
  });

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('get-audit-log', {
        limit: 1000,
        entityType: filters.entityType || null,
        action: filters.action || null,
        startDate: filters.startDate || null,
        endDate: filters.endDate || null
      });
      
      if (result.success) {
        setLogs(result.logs);
      } else {
        console.error('Error loading audit log:', result.error);
        alert('Σφάλμα φόρτωσης ιστορικού: ' + result.error);
      }
    } catch (error) {
      console.error('Error loading audit log:', error);
      alert('Σφάλμα φόρτωσης ιστορικού: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (isOpen) {
      loadAuditLog();
    }
  }, [isOpen, loadAuditLog]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('el-GR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      'create': 'Δημιουργία',
      'update': 'Ενημέρωση',
      'delete': 'Διαγραφή'
    };
    return labels[action] || action;
  };

  const getEntityTypeLabel = (entityType) => {
    const labels = {
      'project': 'Έργο',
      'subproject': 'Υποέργο',
      'prosklisi': 'Πρόσκληση',
      'entaxi': 'Ένταξη',
      'egkrisi': 'Έγκριση'
    };
    return labels[entityType] || entityType;
  };

  const formatChangeValue = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      // If it's an array
      if (Array.isArray(value)) {
        if (value.length === 0) return '(κενό)';
        // Αν είναι array από strings (π.χ. aleCodes), δείξε τα
        if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
          return value.join(' • ');
        }
        return `[${value.length} στοιχείο${value.length > 1 ? 'α' : ''}]`;
      }
      // If it's an object with path and name (file object)
      if (value.path && value.name) {
        return `${value.name} (${value.path})`;
      }
      // For other objects, show a summary
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      if (keys.length <= 3) {
        return JSON.stringify(value);
      }
      return `{${keys.length} πεδία}`;
    }
    return String(value);
  };

  const handleRollback = async (log) => {
    // Only allow rollback for update actions with oldValue
    if (log.action === 'create') {
      alert('⚠️ Δεν μπορεί να γίνει rollback δημιουργίας. Χρησιμοποιήστε διαγραφή αν θέλετε να αφαιρέσετε το στοιχείο.');
      return;
    }
    
    if (log.action === 'delete') {
      alert('⚠️ Δεν μπορεί να γίνει rollback διαγραφής. Τα δεδομένα έχουν διαγραφεί.');
      return;
    }
    
    if (!log.oldValue) {
      alert('⚠️ Δεν υπάρχουν παλιά δεδομένα για rollback.');
      return;
    }
    
    if (!window.confirm(
      `⚠️ ΕΠΙΒΕΒΑΙΩΣΗ ROLLBACK\n\n` +
      `Θέλετε να επαναφέρετε το "${log.entityTitle}" στην προηγούμενη κατάσταση;\n\n` +
      `Αυτή η ενέργεια:\n` +
      `- Θα δημιουργήσει safety backup\n` +
      `- Θα επαναφέρει τα παλιά δεδομένα\n` +
      `- Δεν μπορεί να αναιρεθεί εύκολα\n\n` +
      `Είστε σίγουροι;`
    )) {
      return;
    }
    
    setRollingBack(log.id);
    try {
      const result = await ipcRenderer.invoke('rollback-audit-entry', log.id);
      
      if (result.success) {
        alert('✅ Το rollback ολοκληρώθηκε επιτυχώς!\n\nΗ εφαρμογή θα ανανεωθεί για να δείτε τις αλλαγές.');
        // Reload audit log
        await loadAuditLog();
        // Reload the app data (trigger refresh)
        window.location.reload();
      } else {
        alert(`❌ Σφάλμα rollback: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rolling back:', error);
      alert(`❌ Σφάλμα: ${error.message}`);
    } finally {
      setRollingBack(null);
    }
  };

  // Calculate statistics
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
          <ModalTitle>📋 Ιστορικό Αλλαγών (Audit Log)</ModalTitle>
          <CloseButton onClick={onClose}>✕ Κλείσιμο</CloseButton>
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
                <option value="egkrisi">Εγκρίσεις</option>
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
                        <span><strong>Χρήστης:</strong> {log.user}</span>
                        <span><strong>Ημερομηνία:</strong> {formatDate(log.timestamp)}</span>
                        <span><strong>Τύπος:</strong> {getEntityTypeLabel(log.entityType)}</span>
                      </LogMeta>
                    </LogInfo>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <ActionBadge action={log.action}>
                        {getActionLabel(log.action)}
                      </ActionBadge>
                      {log.action === 'update' && log.oldValue && (
                        <RollbackButton
                          onClick={() => handleRollback(log)}
                          disabled={rollingBack === log.id}
                          title="Επαναφορά στην προηγούμενη κατάσταση"
                        >
                          {rollingBack === log.id ? '⏳...' : '↩️ Rollback'}
                        </RollbackButton>
                      )}
                    </div>
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
                          <ChangeField>{field}:</ChangeField>
                          <ChangeValue>
                            <span style={{ color: '#dc3545' }}>"{formatChangeValue(change.old)}"</span>
                            {' → '}
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

