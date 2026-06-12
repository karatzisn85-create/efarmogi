import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useToast } from './ToastProvider';

const ipcRenderer = window.electronAPI;

// ── Styled components ──────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  z-index: 10500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.2rem 1.5rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 1.3rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  &:hover { color: #334155; }
`;

const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Tab = styled.button`
  flex: 1;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 3px solid ${p => p.$active ? '#6366f1' : 'transparent'};
  color: ${p => p.$active ? '#6366f1' : '#64748b'};
  font-weight: ${p => p.$active ? '700' : '500'};
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: #6366f1; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
`;

const ItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  margin-bottom: 4px;
  background: ${p => p.$hidden ? '#f8fafc' : '#fff'};
  border: 1px solid ${p => p.$hidden ? '#e2e8f0' : '#e2e8f0'};
  opacity: ${p => p.$hidden ? 0.55 : 1};
  &:hover { background: #f1f5f9; }
`;

const ItemLabel = styled.span`
  flex: 1;
  font-size: 0.86rem;
  color: #334155;
  word-break: break-word;
  text-decoration: ${p => p.$hidden ? 'line-through' : 'none'};
`;

const ItemBadge = styled.span`
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: ${p => p.$custom ? '#ede9fe' : '#f1f5f9'};
  color: ${p => p.$custom ? '#7c3aed' : '#64748b'};
  font-weight: 600;
  flex-shrink: 0;
`;

const IconBtn = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 7px;
  font-size: 0.78rem;
  cursor: pointer;
  color: #64748b;
  flex-shrink: 0;
  transition: all 0.12s;
  &:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const AddInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  &:focus { border-color: #6366f1; }
`;

const AddBtn = styled.button`
  padding: 8px 16px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  &:hover { background: #4f46e5; }
  &:disabled { background: #c7d2fe; cursor: not-allowed; }
`;

const EditInlineRow = styled.div`
  display: flex;
  gap: 6px;
  flex: 1;
`;

const EditInlineInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border: 1.5px solid #6366f1;
  border-radius: 6px;
  font-size: 0.84rem;
  font-family: inherit;
  outline: none;
`;

const SaveBtn = styled.button`
  padding: 4px 10px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #4f46e5; }
`;

const CancelBtn = styled.button`
  padding: 4px 10px;
  background: none;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
  color: #64748b;
  &:hover { border-color: #94a3b8; }
`;

const EmptyNote = styled.p`
  color: #94a3b8;
  font-size: 0.84rem;
  text-align: center;
  padding: 1.5rem 0;
`;

const InfoNote = styled.p`
  color: #64748b;
  font-size: 0.8rem;
  margin: 0 0 10px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 3px solid #6366f1;
`;

const Divider = styled.div`
  height: 1px;
  background: #e2e8f0;
  margin: 12px 0;
`;

// ── Helper ─────────────────────────────────────────────────────────────────────

function buildInitialRaw() {
  return { sourceOverrides: {}, customSources: [], detailOverrides: {}, customDetails: {} };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FundingOptionsModal({ isOpen, onClose, initialTab = 'sources', activeSource = null, onOptionsChanged }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(initialTab);
  const [sources, setSources] = useState([]); // merged list
  const [details, setDetails] = useState({}); // merged map
  const [raw, setRaw] = useState(buildInitialRaw()); // local overrides/custom
  const [loading, setLoading] = useState(true);
  const [editingSource, setEditingSource] = useState(null); // { value, editLabel }
  const [editingDetail, setEditingDetail] = useState(null); // { sourceValue, value, editLabel }
  const [newSourceText, setNewSourceText] = useState('');
  const [newDetailText, setNewDetailText] = useState('');
  const [selectedSourceForDetails, setSelectedSourceForDetails] = useState(activeSource || '');

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('load-funding-options');
      if (res?.success) {
        setSources(res.data.sources || []);
        setDetails(res.data.details || {});
        setRaw(res.raw || buildInitialRaw());
        if (!selectedSourceForDetails && (activeSource || (res.data.sources || [])[0]?.value)) {
          setSelectedSourceForDetails(activeSource || res.data.sources[0]?.value || '');
        }
      }
    } catch (e) {
      showToast('Σφάλμα φόρτωσης επιλογών χρηματοδότησης', 'error');
    }
    setLoading(false);
  }, [activeSource, selectedSourceForDetails, showToast]);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setSelectedSourceForDetails(activeSource || '');
      loadOptions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const saveRaw = useCallback(async (newRaw) => {
    try {
      const res = await ipcRenderer.invoke('save-funding-options', newRaw);
      if (!res?.success) {
        showToast('Σφάλμα αποθήκευσης: ' + (res?.error || ''), 'error');
        return false;
      }
      setRaw(newRaw);
      // Reload merged data
      const res2 = await ipcRenderer.invoke('load-funding-options');
      if (res2?.success) {
        setSources(res2.data.sources || []);
        setDetails(res2.data.details || {});
      }
      onOptionsChanged?.();
      return true;
    } catch (e) {
      showToast('Σφάλμα αποθήκευσης', 'error');
      return false;
    }
  }, [showToast, onOptionsChanged]);

  // ── Sources tab actions ──────────────────────────────────────────────────────

  const handleToggleSourceHidden = useCallback(async (srcValue, isBuiltIn, currentlyHidden) => {
    const newRaw = JSON.parse(JSON.stringify(raw));
    if (isBuiltIn) {
      if (!newRaw.sourceOverrides[srcValue]) newRaw.sourceOverrides[srcValue] = {};
      newRaw.sourceOverrides[srcValue].hidden = !currentlyHidden;
    } else {
      const idx = newRaw.customSources.findIndex(s => s.value === srcValue);
      if (idx !== -1) newRaw.customSources[idx].hidden = !currentlyHidden;
    }
    const ok = await saveRaw(newRaw);
    if (ok) showToast(currentlyHidden ? 'Η πηγή εμφανίζεται πλέον' : 'Η πηγή αποκρύφθηκε', 'success');
  }, [raw, saveRaw, showToast]);

  const handleStartEditSource = useCallback((src) => {
    setEditingSource({ value: src.value, editLabel: src.label });
  }, []);

  const handleSaveEditSource = useCallback(async () => {
    if (!editingSource) return;
    const newLabel = editingSource.editLabel.trim();
    if (!newLabel) return;
    const isBuiltIn = sources.find(s => s.value === editingSource.value)?.isBuiltIn;
    const newRaw = JSON.parse(JSON.stringify(raw));
    if (isBuiltIn) {
      if (!newRaw.sourceOverrides[editingSource.value]) newRaw.sourceOverrides[editingSource.value] = {};
      newRaw.sourceOverrides[editingSource.value].label = newLabel;
    } else {
      const idx = newRaw.customSources.findIndex(s => s.value === editingSource.value);
      if (idx !== -1) newRaw.customSources[idx].label = newLabel;
    }
    const ok = await saveRaw(newRaw);
    if (ok) { showToast('Το όνομα ενημερώθηκε', 'success'); setEditingSource(null); }
  }, [editingSource, sources, raw, saveRaw, showToast]);

  const handleAddSource = useCallback(async () => {
    const val = newSourceText.trim();
    if (!val) return;
    if (sources.some(s => s.label.toLowerCase() === val.toLowerCase())) {
      showToast('Υπάρχει ήδη πηγή με αυτό το όνομα', 'warning');
      return;
    }
    const newRaw = JSON.parse(JSON.stringify(raw));
    newRaw.customSources.push({ value: val, label: val, hidden: false });
    const ok = await saveRaw(newRaw);
    if (ok) {
      showToast('Η νέα πηγή προστέθηκε', 'success');
      setNewSourceText('');
      setSelectedSourceForDetails(val);
      setTab('details');
    }
  }, [newSourceText, sources, raw, saveRaw, showToast]);

  // ── Details tab actions ──────────────────────────────────────────────────────

  const handleToggleDetailHidden = useCallback(async (srcValue, detailValue, isBuiltIn, currentlyHidden) => {
    const newRaw = JSON.parse(JSON.stringify(raw));
    if (isBuiltIn) {
      if (!newRaw.detailOverrides[srcValue]) newRaw.detailOverrides[srcValue] = {};
      if (!newRaw.detailOverrides[srcValue][detailValue]) newRaw.detailOverrides[srcValue][detailValue] = {};
      newRaw.detailOverrides[srcValue][detailValue].hidden = !currentlyHidden;
    } else {
      const list = newRaw.customDetails[srcValue] || [];
      const idx = list.findIndex(d => d.value === detailValue);
      if (idx !== -1) list[idx].hidden = !currentlyHidden;
      newRaw.customDetails[srcValue] = list;
    }
    const ok = await saveRaw(newRaw);
    if (ok) showToast(currentlyHidden ? 'Η εξειδίκευση εμφανίζεται πλέον' : 'Η εξειδίκευση αποκρύφθηκε', 'success');
  }, [raw, saveRaw, showToast]);

  const handleStartEditDetail = useCallback((srcValue, detail) => {
    setEditingDetail({ sourceValue: srcValue, value: detail.value, editLabel: detail.label });
  }, []);

  const handleSaveEditDetail = useCallback(async () => {
    if (!editingDetail) return;
    const newLabel = editingDetail.editLabel.trim();
    if (!newLabel) return;
    const { sourceValue, value } = editingDetail;
    const detailList = details[sourceValue] || [];
    const isBuiltIn = detailList.find(d => d.value === value)?.isBuiltIn;
    const newRaw = JSON.parse(JSON.stringify(raw));
    if (isBuiltIn) {
      if (!newRaw.detailOverrides[sourceValue]) newRaw.detailOverrides[sourceValue] = {};
      if (!newRaw.detailOverrides[sourceValue][value]) newRaw.detailOverrides[sourceValue][value] = {};
      newRaw.detailOverrides[sourceValue][value].label = newLabel;
    } else {
      const list = newRaw.customDetails[sourceValue] || [];
      const idx = list.findIndex(d => d.value === value);
      if (idx !== -1) list[idx].label = newLabel;
      newRaw.customDetails[sourceValue] = list;
    }
    const ok = await saveRaw(newRaw);
    if (ok) { showToast('Το όνομα ενημερώθηκε', 'success'); setEditingDetail(null); }
  }, [editingDetail, details, raw, saveRaw, showToast]);

  const handleAddDetail = useCallback(async () => {
    const val = newDetailText.trim();
    if (!val || !selectedSourceForDetails) return;
    const existingList = details[selectedSourceForDetails] || [];
    if (existingList.some(d => d.label.toLowerCase() === val.toLowerCase())) {
      showToast('Υπάρχει ήδη εξειδίκευση με αυτό το όνομα', 'warning');
      return;
    }
    const newRaw = JSON.parse(JSON.stringify(raw));
    if (!newRaw.customDetails[selectedSourceForDetails]) newRaw.customDetails[selectedSourceForDetails] = [];
    newRaw.customDetails[selectedSourceForDetails].push({ value: val, label: val, hidden: false });
    const ok = await saveRaw(newRaw);
    if (ok) { showToast('Η νέα εξειδίκευση προστέθηκε', 'success'); setNewDetailText(''); }
  }, [newDetailText, selectedSourceForDetails, details, raw, saveRaw, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const currentDetails = details[selectedSourceForDetails] || [];
  const visibleSources = sources.filter(s => !s.hidden);

  const modal = (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Διαχείριση Πηγών Χρηματοδότησης</Title>
          <CloseBtn onClick={onClose}>✕</CloseBtn>
        </Header>

        <Tabs>
          <Tab $active={tab === 'sources'} onClick={() => setTab('sources')}>
            Βασικές Πηγές ({sources.length})
          </Tab>
          <Tab $active={tab === 'details'} onClick={() => setTab('details')}>
            Εξειδικεύσεις
            {selectedSourceForDetails ? ` — ${sources.find(s => s.value === selectedSourceForDetails)?.label || selectedSourceForDetails}` : ''}
          </Tab>
        </Tabs>

        <Body>
          {loading ? (
            <EmptyNote>Φόρτωση...</EmptyNote>
          ) : tab === 'sources' ? (
            <>
              <InfoNote>
                Τα κρυμμένα στοιχεία δεν εμφανίζονται στη φόρμα. Αν κρύψετε μια βασική πηγή, κρύβονται αυτόματα και οι εξειδικεύσεις της.
              </InfoNote>
              {sources.length === 0 && <EmptyNote>Δεν υπάρχουν εγγραφές</EmptyNote>}
              {sources.map(src => (
                <ItemRow key={src.value} $hidden={src.hidden}>
                  {editingSource?.value === src.value ? (
                    <EditInlineRow>
                      <EditInlineInput
                        value={editingSource.editLabel}
                        onChange={e => setEditingSource(prev => ({ ...prev, editLabel: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEditSource(); if (e.key === 'Escape') setEditingSource(null); }}
                        autoFocus
                      />
                      <SaveBtn onClick={handleSaveEditSource}>Αποθήκευση</SaveBtn>
                      <CancelBtn onClick={() => setEditingSource(null)}>Άκυρο</CancelBtn>
                    </EditInlineRow>
                  ) : (
                    <ItemLabel $hidden={src.hidden}>{src.label}</ItemLabel>
                  )}
                  {!editingSource || editingSource.value !== src.value ? (
                    <>
                      {!src.isBuiltIn && <ItemBadge $custom>custom</ItemBadge>}
                      <IconBtn title="Επεξεργασία ονόματος" onClick={() => handleStartEditSource(src)}>✏️</IconBtn>
                      <IconBtn
                        title={src.hidden ? 'Ενεργοποίηση' : 'Απόκρυψη'}
                        onClick={() => handleToggleSourceHidden(src.value, src.isBuiltIn, src.hidden)}
                      >
                        {src.hidden ? '👁' : '🚫'}
                      </IconBtn>
                      <IconBtn
                        title="Διαχείριση εξειδικεύσεων"
                        onClick={() => { setSelectedSourceForDetails(src.value); setTab('details'); }}
                      >
                        →
                      </IconBtn>
                    </>
                  ) : null}
                </ItemRow>
              ))}
              <Divider />
              <AddRow>
                <AddInput
                  placeholder="Όνομα νέας βασικής πηγής..."
                  value={newSourceText}
                  onChange={e => setNewSourceText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSource()}
                />
                <AddBtn onClick={handleAddSource} disabled={!newSourceText.trim()}>+ Προσθήκη</AddBtn>
              </AddRow>
            </>
          ) : (
            <>
              <InfoNote>
                Επιλέξτε βασική πηγή για να δείτε τις εξειδικεύσεις της.
              </InfoNote>
              <select
                value={selectedSourceForDetails}
                onChange={e => setSelectedSourceForDetails(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit', marginBottom: '12px', outline: 'none' }}
              >
                <option value="">Επιλέξτε πηγή...</option>
                {sources.map(s => (
                  <option key={s.value} value={s.value} disabled={s.hidden}>{s.label}{s.hidden ? ' (κρυφή)' : ''}</option>
                ))}
              </select>

              {!selectedSourceForDetails ? (
                <EmptyNote>Επιλέξτε βασική πηγή παραπάνω</EmptyNote>
              ) : currentDetails.length === 0 && !visibleSources.find(s => s.value === selectedSourceForDetails) ? (
                <EmptyNote>Η πηγή είναι κρυμμένη — οι εξειδικεύσεις δεν θα εμφανίζονται</EmptyNote>
              ) : (
                <>
                  {currentDetails.length === 0 && (
                    <EmptyNote>Δεν υπάρχουν εξειδικεύσεις — προσθέστε παρακάτω</EmptyNote>
                  )}
                  {currentDetails.map(det => (
                    <ItemRow key={det.value} $hidden={det.hidden}>
                      {editingDetail?.value === det.value && editingDetail?.sourceValue === selectedSourceForDetails ? (
                        <EditInlineRow>
                          <EditInlineInput
                            value={editingDetail.editLabel}
                            onChange={e => setEditingDetail(prev => ({ ...prev, editLabel: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditDetail(); if (e.key === 'Escape') setEditingDetail(null); }}
                            autoFocus
                          />
                          <SaveBtn onClick={handleSaveEditDetail}>Αποθήκευση</SaveBtn>
                          <CancelBtn onClick={() => setEditingDetail(null)}>Άκυρο</CancelBtn>
                        </EditInlineRow>
                      ) : (
                        <ItemLabel $hidden={det.hidden}>{det.label}</ItemLabel>
                      )}
                      {(!editingDetail || editingDetail.value !== det.value || editingDetail.sourceValue !== selectedSourceForDetails) && (
                        <>
                          {!det.isBuiltIn && <ItemBadge $custom>custom</ItemBadge>}
                          <IconBtn title="Επεξεργασία ονόματος" onClick={() => handleStartEditDetail(selectedSourceForDetails, det)}>✏️</IconBtn>
                          <IconBtn
                            title={det.hidden ? 'Ενεργοποίηση' : 'Απόκρυψη'}
                            onClick={() => handleToggleDetailHidden(selectedSourceForDetails, det.value, det.isBuiltIn, det.hidden)}
                          >
                            {det.hidden ? '👁' : '🚫'}
                          </IconBtn>
                        </>
                      )}
                    </ItemRow>
                  ))}
                  <Divider />
                  <AddRow>
                    <AddInput
                      placeholder="Όνομα νέας εξειδίκευσης..."
                      value={newDetailText}
                      onChange={e => setNewDetailText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddDetail()}
                    />
                    <AddBtn onClick={handleAddDetail} disabled={!newDetailText.trim()}>+ Προσθήκη</AddBtn>
                  </AddRow>
                </>
              )}
            </>
          )}
        </Body>
      </Panel>
    </Overlay>
  );

  return createPortal(modal, document.body);
}
