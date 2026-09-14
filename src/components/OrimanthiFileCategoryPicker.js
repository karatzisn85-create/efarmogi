import React, { useState, useCallback, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FILE_CATEGORY_ROOTS,
  FILE_CATEGORY_ROOT_MELETES,
  FILE_CATEGORY_ROOT_ADEIODOTISEIS,
  getSpecsForRoot,
  getDefaultSpecsForRoot,
  isSpecUsed,
  buildFileGroupLabel,
} from '../utils/orimanthiFileCategories';

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const PickerShell = styled.div`
  animation: ${fadeUp} 0.25s ease;
`;

const PickerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
`;

const PickerTitle = styled.span`
  font-size: 0.68rem;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.45px;
`;

const BackBtn = styled.button`
  border: none;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.28rem 0.55rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  line-height: 1;
  &:hover { background: #f1f5f9; color: #475569; }
`;

const RootGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const RootCard = styled.button`
  position: relative;
  overflow: hidden;
  border: none;
  border-radius: 14px;
  padding: 1.1rem 1rem;
  text-align: left;
  cursor: pointer;
  background: ${(p) => p.$gradient};
  color: white;
  box-shadow: 0 8px 24px ${(p) => p.$shadow};
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(255,255,255,0.22) 0%, transparent 45%);
    pointer-events: none;
  }
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 32px ${(p) => p.$shadow};
  }
  &:active { transform: translateY(-1px); }
`;

const RootIcon = styled.div`
  font-size: 1.65rem;
  margin-bottom: 0.45rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
`;

const RootLabel = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1.25;
`;

const RootHint = styled.div`
  margin-top: 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.88;
`;

const SpecGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const SpecChipWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
`;

const SpecChip = styled.button`
  padding: 0.38rem 0.72rem;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$used ? '#cbd5e1' : p.$accent)};
  background: ${(p) => {
    if (p.$used) return '#f8fafc';
    if (p.$selected) return p.$accent;
    return 'white';
  }};
  color: ${(p) => {
    if (p.$used) return '#94a3b8';
    if (p.$selected) return 'white';
    return p.$accent;
  }};
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: ${(p) => (p.$used ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$used ? 0.65 : 1)};
  transition: all 0.18s ease;
  &:hover:not(:disabled) {
    background: ${(p) => (p.$selected ? p.$accent : p.$accentLight)};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${(p) => `${p.$accent}33`};
  }
`;

const SpecDeleteBtn = styled.button`
  width: 1.05rem;
  height: 1.05rem;
  border: none;
  border-radius: 999px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  &:hover {
    background: #fee2e2;
    color: #b91c1c;
  }
`;

const AddSpecRow = styled.div`
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px dashed #cbd5e1;
`;

const AddSpecInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0.42rem 0.65rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 9px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #334155;
  &:focus {
    outline: none;
    border-color: ${(p) => p.$accent || '#6366f1'};
    box-shadow: 0 0 0 3px ${(p) => `${p.$accent || '#6366f1'}22`};
  }
`;

const AddSpecBtn = styled.button`
  flex-shrink: 0;
  padding: 0.42rem 0.75rem;
  border: none;
  border-radius: 9px;
  background: ${(p) => p.$accent || '#6366f1'};
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const UsedHint = styled.div`
  margin-top: 0.45rem;
  font-size: 0.65rem;
  color: ${(p) => (p.$warn ? '#b45309' : '#94a3b8')};
  font-style: italic;
`;

const ConfirmRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  margin-top: 0.7rem;
`;

const ConfirmBtn = styled.button`
  padding: 0.42rem 0.85rem;
  border: none;
  border-radius: 9px;
  background: ${(p) => p.$accent || '#6366f1'};
  color: white;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

function OrimanthiFileCategoryPicker({
  existingGroups = [],
  customMeletesSpecs = [],
  customAdeiodotiseisSpecs = [],
  hiddenMeletesSpecs = [],
  hiddenAdeiodotiseisSpecs = [],
  allowMultiple = true,
  onSelect,
  onSelectMany,
  onCancel,
  onAddCustomSpec,
  onRemoveSpec,
}) {
  const [step, setStep] = useState('root');
  const [selectedRoot, setSelectedRoot] = useState(null);
  const [newSpecInput, setNewSpecInput] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState([]);
  const [actionHint, setActionHint] = useState('');
  const selectedSpecsRef = useRef([]);

  const setSelectedSpecsNow = useCallback((updater) => {
    setSelectedSpecs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      selectedSpecsRef.current = next;
      return next;
    });
  }, []);

  const rootMeta = selectedRoot ? FILE_CATEGORY_ROOTS[selectedRoot] : null;

  const specs = useMemo(() => {
    if (!selectedRoot) return [];
    return getSpecsForRoot(
      selectedRoot,
      customMeletesSpecs,
      customAdeiodotiseisSpecs,
      hiddenMeletesSpecs,
      hiddenAdeiodotiseisSpecs
    );
  }, [
    selectedRoot,
    customMeletesSpecs,
    customAdeiodotiseisSpecs,
    hiddenMeletesSpecs,
    hiddenAdeiodotiseisSpecs,
  ]);

  const handlePickRoot = useCallback((rootId) => {
    setSelectedRoot(rootId);
    setStep('spec');
    setNewSpecInput('');
    setActionHint('');
    setSelectedSpecsNow([]);
  }, [setSelectedSpecsNow]);

  const emitPicks = useCallback((specList) => {
    if (!selectedRoot) return;
    const requested = (specList || []).map((spec) => String(spec || '').trim()).filter(Boolean);
    const picks = requested
      .filter((spec) => !isSpecUsed(existingGroups, selectedRoot, spec))
      .map((spec) => ({
        rootId: selectedRoot,
        spec,
        label: buildFileGroupLabel(selectedRoot, spec),
      }));
    if (!picks.length) {
      if (requested.length) {
        setActionHint('Οι κατηγορίες υπάρχουν ήδη στο έργο.');
      }
      return;
    }
    setActionHint('');
    if (allowMultiple && onSelectMany) onSelectMany(picks);
    else if (onSelect) onSelect(picks[0]);
  }, [allowMultiple, existingGroups, onSelect, onSelectMany, selectedRoot]);

  const handlePickSpec = useCallback((spec) => {
    if (!selectedRoot || isSpecUsed(existingGroups, selectedRoot, spec)) return;
    if (!allowMultiple) {
      emitPicks([spec]);
      return;
    }
    setSelectedSpecsNow((prev) => (
      prev.some((x) => x.toLowerCase() === spec.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== spec.toLowerCase())
        : [...prev, spec]
    ));
  }, [allowMultiple, emitPicks, existingGroups, selectedRoot, setSelectedSpecsNow]);

  const handleAddCustom = useCallback(() => {
    const trimmed = newSpecInput.trim();
    if (!selectedRoot || !trimmed) return;
    const allSpecs = getSpecsForRoot(
      selectedRoot,
      customMeletesSpecs,
      customAdeiodotiseisSpecs,
      hiddenMeletesSpecs,
      hiddenAdeiodotiseisSpecs
    );
    const existing = allSpecs.find((s) => s.toLowerCase() === trimmed.toLowerCase());
    const catalogName = existing || trimmed;
    if (isSpecUsed(existingGroups, selectedRoot, catalogName)) {
      if (!existing) onAddCustomSpec?.(selectedRoot, trimmed, getDefaultSpecsForRoot(selectedRoot));
      setNewSpecInput('');
      setActionHint('Η κατηγορία υπάρχει ήδη στο έργο.');
      return;
    }
    if (existing) {
      handlePickSpec(existing);
      setNewSpecInput('');
      setActionHint('');
      return;
    }
    onAddCustomSpec?.(selectedRoot, trimmed, getDefaultSpecsForRoot(selectedRoot));
    setNewSpecInput('');
    setActionHint('');
    if (!allowMultiple) {
      emitPicks([trimmed]);
      return;
    }
    setSelectedSpecsNow((prev) => (
      prev.some((x) => x.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    ));
  }, [
    allowMultiple,
    customAdeiodotiseisSpecs,
    customMeletesSpecs,
    emitPicks,
    existingGroups,
    handlePickSpec,
    hiddenAdeiodotiseisSpecs,
    hiddenMeletesSpecs,
    newSpecInput,
    onAddCustomSpec,
    selectedRoot,
    setSelectedSpecsNow,
  ]);

  const handleConfirm = useCallback(() => {
    emitPicks([...selectedSpecsRef.current]);
  }, [emitPicks]);

  const handleRemoveSpec = useCallback(async (spec, event) => {
    event?.stopPropagation();
    event?.preventDefault();
    if (!selectedRoot || !onRemoveSpec) return;
    const removed = await onRemoveSpec(selectedRoot, spec);
    if (removed === false) return;
    setSelectedSpecsNow((prev) => prev.filter((x) => x.toLowerCase() !== spec.toLowerCase()));
  }, [onRemoveSpec, selectedRoot, setSelectedSpecsNow]);

  if (step === 'root') {
    return (
      <PickerShell>
        <PickerHeader>
          <PickerTitle>Επιλέξτε τύπο αρχείων</PickerTitle>
          <CloseBtn type="button" onClick={onCancel} aria-label="Κλείσιμο">✕</CloseBtn>
        </PickerHeader>
        <RootGrid>
          {[FILE_CATEGORY_ROOT_MELETES, FILE_CATEGORY_ROOT_ADEIODOTISEIS].map((rootId) => {
            const root = FILE_CATEGORY_ROOTS[rootId];
            return (
              <RootCard
                key={rootId}
                type="button"
                data-testid={`orimanthi-file-root-${rootId}`}
                $gradient={root.gradient}
                $shadow={`${root.accent}44`}
                onClick={() => handlePickRoot(rootId)}
              >
                <RootIcon>{root.icon}</RootIcon>
                <RootLabel>{root.label}</RootLabel>
                <RootHint>
                  {rootId === FILE_CATEGORY_ROOT_MELETES
                    ? 'Μελέτες, σχέδια, τεύχη'
                    : 'Άδειες, εγκρίσεις, διοικητικά'}
                </RootHint>
              </RootCard>
            );
          })}
        </RootGrid>
      </PickerShell>
    );
  }

  return (
    <PickerShell>
      <PickerHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
          <BackBtn type="button" onClick={() => { setStep('root'); setSelectedRoot(null); setSelectedSpecsNow([]); setActionHint(''); }}>
            ← Πίσω
          </BackBtn>
          <PickerTitle style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rootMeta?.label} — εξειδίκευση
          </PickerTitle>
        </div>
        <CloseBtn type="button" onClick={onCancel} aria-label="Κλείσιμο">✕</CloseBtn>
      </PickerHeader>
      <SpecGrid>
        {specs.map((spec) => {
          const used = isSpecUsed(existingGroups, selectedRoot, spec);
          const selected = selectedSpecs.some((x) => x.toLowerCase() === spec.toLowerCase());
          return (
            <SpecChipWrap key={spec}>
              <SpecChip
                type="button"
                $used={used}
                $selected={selected}
                $accent={rootMeta?.accent}
                $accentLight={rootMeta?.accentLight}
                disabled={used}
                data-testid={`orimanthi-file-spec-${spec}`}
                aria-pressed={selected}
                title={used ? 'Η κατηγορία υπάρχει ήδη στο έργο' : spec}
                onClick={() => handlePickSpec(spec)}
              >
                {spec}
              </SpecChip>
              {onRemoveSpec ? (
                <SpecDeleteBtn
                  type="button"
                  data-testid={`orimanthi-file-spec-delete-${spec}`}
                  title="Αφαίρεση από τη λίστα επιλογών"
                  aria-label={`Αφαίρεση εξειδίκευσης από τη λίστα: ${spec}`}
                  onClick={(e) => handleRemoveSpec(spec, e)}
                >
                  ×
                </SpecDeleteBtn>
              ) : null}
            </SpecChipWrap>
          );
        })}
      </SpecGrid>
      <AddSpecRow>
        <AddSpecInput
          $accent={rootMeta?.accent}
          placeholder="Νέα εξειδίκευση…"
          value={newSpecInput}
          onChange={(e) => setNewSpecInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddCustom();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <AddSpecBtn
          type="button"
          $accent={rootMeta?.accent}
          data-testid="orimanthi-file-spec-add-custom"
          disabled={!newSpecInput.trim()}
          onClick={handleAddCustom}
        >
          + Προσθήκη
        </AddSpecBtn>
      </AddSpecRow>
      <UsedHint $warn={!!actionHint}>
        {actionHint
          || (allowMultiple
            ? 'Επιλέξτε όσες εξειδικεύσεις θέλετε. Οι γκρι υπάρχουν ήδη στο έργο. Το × τις αφαιρεί από τη λίστα.'
            : 'Οι γκρι επιλογές υπάρχουν ήδη στο έργο. Το × αφαιρεί μια εξειδίκευση από τη λίστα.')}
      </UsedHint>
      {allowMultiple ? (
        <ConfirmRow>
          <ConfirmBtn
            type="button"
            $accent={rootMeta?.accent}
            data-testid="orimanthi-file-spec-confirm"
            data-selected-specs={selectedSpecs.join('|')}
            disabled={!selectedSpecs.length}
            onClick={handleConfirm}
          >
            {selectedSpecs.length > 1
              ? `Προσθήκη ${selectedSpecs.length} κατηγοριών`
              : 'Προσθήκη κατηγορίας'}
          </ConfirmBtn>
        </ConfirmRow>
      ) : null}
    </PickerShell>
  );
}

export default OrimanthiFileCategoryPicker;
