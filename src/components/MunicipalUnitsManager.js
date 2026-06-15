import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { safeConfirm } from '../utils/safeDialogs';

const ipcRenderer = window.electronAPI;

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
`;

const Panel = styled.div`
  background: white;
  border-radius: 16px;
  padding: 28px 32px;
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0 0 6px 0;
  font-size: 20px;
  color: #0f172a;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #64748b;
  padding: 4px 8px;
  border-radius: 6px;
  flex-shrink: 0;
  &:hover { background: #f1f5f9; }
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const Input = styled.input`
  flex: 1;
  padding: 9px 12px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }
`;

const PrimaryBtn = styled.button`
  padding: 9px 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #be185d, #ec4899);
  color: white;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`;

const ListItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const UnitLabel = styled.span`
  font-size: 14px;
  color: #1e293b;
`;

const RemoveBtn = styled.button`
  background: none;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  &:hover { background: #fef2f2; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const EmptyHint = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  font-style: italic;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
`;

const StatusMsg = styled.div`
  margin-top: 12px;
  font-size: 13px;
  color: ${(p) => (p.$error ? '#dc2626' : '#059669')};
`;

function MunicipalUnitsManager({ onClose, currentUser }) {
  const [units, setUnits] = useState([]);
  const [newUnit, setNewUnit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const actingUsername = currentUser?.username || '';

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('get-municipal-units-config');
      if (res.success) {
        setUnits(res.config?.units || []);
      } else {
        setError(res.error || 'Σφάλμα φόρτωσης');
      }
    } catch (e) {
      setError(e.message || 'Σφάλμα φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const persistUnits = async (nextUnits) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await ipcRenderer.invoke('save-municipal-units-config', {
        units: nextUnits,
        actingUsername,
      });
      if (!res.success) {
        setError(res.error || 'Σφάλμα αποθήκευσης');
        return false;
      }
      setUnits(res.config?.units || []);
      setSuccess('Οι αλλαγές αποθηκεύτηκαν');
      return true;
    } catch (e) {
      setError(e.message || 'Σφάλμα αποθήκευσης');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const label = newUnit.trim();
    if (!label) return;
    if (units.some((u) => u.toLowerCase() === label.toLowerCase())) {
      setError('Η δημοτική ενότητα υπάρχει ήδη στη λίστα');
      return;
    }
    const next = [...units, label];
    const ok = await persistUnits(next);
    if (ok) {
      setNewUnit('');
    }
  };

  const handleRemove = async (label) => {
    if (!await safeConfirm(`Διαγραφή της δημοτικής ενότητας «${label}»;`)) return;
    const next = units.filter((u) => u !== label);
    await persistUnits(next);
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>Δημοτικές Ενότητες</Title>
            <Subtitle>
              Καταχωρήστε τις δημοτικές ενότητες του δήμου σας. Η λίστα θα εμφανίζεται
              στις φόρμες έργων ωρίμανσης και σε άλλα σημεία της εφαρμογής.
            </Subtitle>
          </div>
          <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
        </Header>

        <AddRow>
          <Input
            placeholder="Όνομα δημοτικής ενότητας…"
            value={newUnit}
            disabled={loading || saving}
            onChange={(e) => setNewUnit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <PrimaryBtn type="button" disabled={loading || saving || !newUnit.trim()} onClick={handleAdd}>
            Προσθήκη
          </PrimaryBtn>
        </AddRow>

        {loading ? (
          <EmptyHint>Φόρτωση…</EmptyHint>
        ) : units.length === 0 ? (
          <EmptyHint>Δεν έχουν καταχωρηθεί δημοτικές ενότητες. Προσθέστε την πρώτη από το πεδίο παραπάνω.</EmptyHint>
        ) : (
          <List>
            {units.map((unit) => (
              <ListItem key={unit}>
                <UnitLabel>{unit}</UnitLabel>
                <RemoveBtn
                  type="button"
                  disabled={saving}
                  onClick={() => handleRemove(unit)}
                >
                  Διαγραφή
                </RemoveBtn>
              </ListItem>
            ))}
          </List>
        )}

        {error ? <StatusMsg $error>{error}</StatusMsg> : null}
        {success ? <StatusMsg>{success}</StatusMsg> : null}
      </Panel>
    </Overlay>
  );
}

export default MunicipalUnitsManager;
