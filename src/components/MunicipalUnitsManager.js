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
  width: 560px;
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

const Section = styled.section`
  margin-bottom: 22px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
`;

const SectionHint = styled.p`
  margin: 0 0 12px 0;
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.45;
`;

const LogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

const LogoPreview = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 12px;
  border: 1.5px dashed #cbd5e1;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

const LogoImg = styled.img`
  max-width: 88px;
  max-height: 88px;
  object-fit: contain;
`;

const LogoActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
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

const GhostBtn = styled.button`
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #334155;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: #f8fafc; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const DangerBtn = styled(GhostBtn)`
  border-color: #fecaca;
  color: #dc2626;
  &:hover { background: #fef2f2; }
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
  const [logoDataUrl, setLogoDataUrl] = useState(null);
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
        setLogoDataUrl(res.logoDataUrl || null);
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
      if (res.logoDataUrl !== undefined) setLogoDataUrl(res.logoDataUrl || null);
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

  const handlePickLogo = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const pick = await ipcRenderer.invoke('select-municipality-logo', { actingUsername });
      if (!pick?.success) {
        setError(pick?.error || 'Αποτυχία επιλογής αρχείου');
        return;
      }
      if (pick.canceled || !pick.filePath) return;
      const res = await ipcRenderer.invoke('save-municipality-logo', {
        actingUsername,
        sourcePath: pick.filePath,
      });
      if (!res?.success) {
        setError(res?.error || 'Αποτυχία αποθήκευσης λογοτύπου');
        return;
      }
      setLogoDataUrl(res.logoDataUrl || null);
      setSuccess('Το λογότυπο του δήμου αποθηκεύτηκε');
    } catch (e) {
      setError(e.message || 'Αποτυχία αποθήκευσης λογοτύπου');
    } finally {
      setSaving(false);
    }
  };

  const handleClearLogo = async () => {
    if (!await safeConfirm('Να αφαιρεθεί το λογότυπο του δήμου;')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await ipcRenderer.invoke('clear-municipality-logo', { actingUsername });
      if (!res?.success) {
        setError(res?.error || 'Αποτυχία διαγραφής λογοτύπου');
        return;
      }
      setLogoDataUrl(null);
      setSuccess('Το λογότυπο αφαιρέθηκε');
    } catch (e) {
      setError(e.message || 'Αποτυχία διαγραφής λογοτύπου');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>Δημοτικές Ενότητες</Title>
            <Subtitle>
              Καταχωρήστε τις δημοτικές ενότητες και το λογότυπο του δήμου.
              Το λογότυπο μπορεί να εμφανιστεί διακριτικά στον Απολογισμό, αν το επιλέξετε εκεί.
            </Subtitle>
          </div>
          <CloseBtn type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseBtn>
        </Header>

        <Section>
          <SectionTitle>Λογότυπο δήμου</SectionTitle>
          <SectionHint>
            Προτιμήστε εικόνα με διαφάνεια (PNG). Θα χρησιμοποιηθεί στον Απολογισμό μόνο αν το ενεργοποιήσετε στην εμφάνιση παρουσίασης.
          </SectionHint>
          <LogoRow>
            <LogoPreview>
              {logoDataUrl ? (
                <LogoImg src={logoDataUrl} alt="Λογότυπο δήμου" />
              ) : (
                <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>
                  Χωρίς λογότυπο
                </span>
              )}
            </LogoPreview>
            <LogoActions>
              <PrimaryBtn type="button" disabled={loading || saving} onClick={handlePickLogo}>
                {logoDataUrl ? 'Αλλαγή λογοτύπου' : 'Προσθήκη λογοτύπου'}
              </PrimaryBtn>
              {logoDataUrl ? (
                <DangerBtn type="button" disabled={loading || saving} onClick={handleClearLogo}>
                  Αφαίρεση
                </DangerBtn>
              ) : null}
            </LogoActions>
          </LogoRow>
        </Section>

        <Section>
          <SectionTitle>Λίστα ενοτήτων</SectionTitle>
          <SectionHint>
            Η λίστα εμφανίζεται στις φόρμες έργων ωρίμανσης και σε άλλα σημεία της εφαρμογής.
          </SectionHint>
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
        </Section>

        {error ? <StatusMsg $error>{error}</StatusMsg> : null}
        {success ? <StatusMsg>{success}</StatusMsg> : null}
      </Panel>
    </Overlay>
  );
}

export default MunicipalUnitsManager;
