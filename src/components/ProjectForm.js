import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import {
  IMPLEMENTATION_FORMS,
  PROJECT_TYPES,
  FUNDING_SOURCES,
  PROJECT_STATUSES,
  FUNDING_DETAILS,
  STATUSES_WITH_CONTRACT_FIELDS,
  STATUSES_WITH_KHMDHS_ADAM
} from '../data/formOptions';
import {
  emptyKhmdhsOnContract,
  isMultipleContractsForm,
  normalizeContractsFromProject
} from '../utils/khmdhsFields';

const ipcRenderer = window.electronAPI;

const ADAM_FORMAT_REGEX = /^(\d{2})([A-Z]{3,4})(\d{9})$/i;
const ADAM_MAX_LEN = 15; // 2 + 4 + 9

function statusRequiresKhmdhsAdam(status) {
  return STATUSES_WITH_KHMDHS_ADAM.includes(status);
}

/** Μόνο έγκυροι χαρακτήρες ΑΔΑΜ κατά την πληκτρολόγηση */
function sanitizeAdamInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ADAM_MAX_LEN);
}

/**
 * @param {'live'|'strict'} mode — live: σφάλμα μόνο σε πλήρες μήκος (δεν «κολλάει» κατά την πληκτρολόγηση)
 */
function getAdamFieldError(value, mode = 'strict') {
  const adam = sanitizeAdamInput(value);
  if (!adam) return null;
  if (ADAM_FORMAT_REGEX.test(adam)) return null;
  if (mode === 'live' && adam.length < ADAM_MAX_LEN) return null;
  return 'Μη έγκυρη μορφή ΑΔΑΜ. Χρησιμοποιήστε μορφή όπως 26SYMV018523441 (έτος + τύπος π.χ. SYMV + 9 ψηφία).';
}

function pickKhmdhsSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const out = {
    anadoxosName: snapshot.anadoxosName || null,
    anadoxosVat: snapshot.anadoxosVat != null ? String(snapshot.anadoxosVat) : null,
    assigningAuthority: snapshot.assigningAuthority || null
  };
  if (!out.anadoxosName && !out.anadoxosVat && !out.assigningAuthority) return null;
  return out;
}

function resolveSingleKhmdhsForSave(formData, editingProject) {
  const adam = sanitizeAdamInput(formData.khmdhsAdam);
  const snapshotForm = pickKhmdhsSnapshot(formData.khmdhsContractSnapshot);
  const snapshotStored = editingProject ? pickKhmdhsSnapshot(editingProject.khmdhsContractSnapshot) : null;
  const snapshot = snapshotForm || (adam && snapshotStored ? snapshotStored : null);
  const fetchedAt = adam
    ? String(formData.khmdhsContractFetchedAt || editingProject?.khmdhsContractFetchedAt || '')
    : '';
  if (!adam) {
    return { khmdhsAdam: '', khmdhsContractSnapshot: null, khmdhsContractFetchedAt: '' };
  }
  return { khmdhsAdam: adam, khmdhsContractSnapshot: snapshot, khmdhsContractFetchedAt: fetchedAt };
}

function resolveContractKhmdhsRow(contract, existingContract) {
  const adam = sanitizeAdamInput(contract?.khmdhsAdam);
  const snapshotForm = pickKhmdhsSnapshot(contract?.khmdhsContractSnapshot);
  const snapshotStored = existingContract ? pickKhmdhsSnapshot(existingContract.khmdhsContractSnapshot) : null;
  const snapshot = snapshotForm || (adam && snapshotStored ? snapshotStored : null);
  const fetchedAt = adam
    ? String(contract?.khmdhsContractFetchedAt || existingContract?.khmdhsContractFetchedAt || '')
    : '';
  if (!adam) {
    return { ...contract, ...emptyKhmdhsOnContract() };
  }
  return {
    ...contract,
    khmdhsAdam: adam,
    khmdhsContractSnapshot: snapshot,
    khmdhsContractFetchedAt: fetchedAt
  };
}

/** Διατήρηση ΑΔΑΜ/ΚΗΜΔΗΣ — μία σύμβαση στο έργο ή ανά σύμβαση στο contracts[] */
function resolveKhmdhsFieldsForSave(formData, editingProject) {
  if (isMultipleContractsForm(formData.implementationForm)) {
    const contracts = (formData.contracts || []).map((c, i) =>
      resolveContractKhmdhsRow(c, editingProject?.contracts?.[i])
    );
    return {
      contracts,
      khmdhsAdam: '',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: ''
    };
  }
  return {
    contracts: (formData.contracts || []).map((c) => ({ ...c, ...emptyKhmdhsOnContract() })),
    ...resolveSingleKhmdhsForSave(formData, editingProject)
  };
}

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
  overflow: hidden;
`;

const FormContainer = styled.div`
  background: linear-gradient(165deg, #f8fafc 0%, #eef2ff 40%, #f1f5f9 100%);
  border-radius: 18px;
  width: calc(100vw - 2rem);
  max-width: 1120px;
  height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.55) inset,
    0 25px 50px -12px rgba(15, 23, 42, 0.35),
    0 12px 40px rgba(79, 70, 229, 0.12);
  animation: formSlideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  box-sizing: border-box;

  @keyframes formSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const FormHeader = styled.div`
  position: relative;
  background: linear-gradient(135deg, #312e81 0%, #4f46e5 42%, #6366f1 100%);
  color: #fff;
  padding: 1.25rem 1.75rem 1.35rem;
  border-radius: 18px 18px 0 0;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(49, 46, 129, 0.45);

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  }
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
`;

const FormSubtitle = styled.p`
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
  max-width: 52ch;
`;

const FormScrollArea = styled.div`
  padding: 1.35rem 1.65rem 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.45) transparent;

  &::-webkit-scrollbar {
    width: 9px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.12);
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #818cf8, #6366f1);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
`;

const Section = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #fafbff 100%);
  border-radius: 14px;
  padding: 1.35rem 1.45rem 1.4rem 1.35rem;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-left: 4px solid #6366f1;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 6px 20px rgba(15, 23, 42, 0.055);
  min-width: 0;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.35);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.05),
      0 8px 28px rgba(79, 70, 229, 0.08);
  }
`;

const SectionTitle = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #4338ca;
  margin: 0 0 1.05rem 0;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid rgba(99, 102, 241, 0.18);
  display: flex;
  align-items: center;
  gap: 0.45rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(
    ${props => props.cols || 2},
    minmax(0, 1fr)
  );
  gap: 1.1rem 1.35rem;
  min-width: 0;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: repeat(
      ${props => Math.min(props.cols || 2, 2)},
      minmax(0, 1fr)
    );
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  grid-column: ${props => props.fullWidth ? `1 / -1` : 'span 1'};

  & > input,
  & > select,
  & > textarea {
    width: 100%;
  }
`;

const Label = styled.label`
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.45rem;
  font-size: 0.875rem;
  letter-spacing: 0.01em;
`;

const Input = styled.input`
  padding: 0.78rem 0.85rem;
  border: 1.5px solid ${props => {
    if (props.$hasError) return '#ef4444';
    if (props.$isValid && props.$touched) return '#22c55e';
    return '#cbd5e1';
  }};
  border-radius: 10px;
  font-size: 0.98rem;
  outline: none;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: ${props => {
      if (props.$hasError) return '#ef4444';
      if (props.$isValid && props.$touched) return '#22c55e';
      return '#6366f1';
    }};
    box-shadow: 0 0 0 3px
      ${props => {
        if (props.$hasError) return 'rgba(239, 68, 68, 0.2)';
        if (props.$isValid && props.$touched) return 'rgba(34, 197, 94, 0.2)';
        return 'rgba(99, 102, 241, 0.22)';
      }};
  }

  &:disabled {
    background-color: #f1f5f9;
    cursor: not-allowed;
    color: #64748b;
  }
`;

const TextArea = styled.textarea`
  padding: 0.78rem 0.85rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.98rem;
  outline: none;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }

  &:disabled {
    background-color: #f1f5f9;
    cursor: not-allowed;
    color: #64748b;
  }
`;

const Select = styled.select`
  padding: 0.78rem 0.85rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.98rem;
  outline: none;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }
`;

const FieldHint = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.45rem;
  line-height: 1.5;
  padding: 0.55rem 0.65rem;
  background: rgba(241, 245, 249, 0.95);
  border-radius: 8px;
  border-left: 3px solid #818cf8;
`;

const EngineerPickGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.25rem;
  margin-top: 0.35rem;
  min-width: 0;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const EngineerPickCard = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const EngineerPickCardTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4f46e5;
  margin-bottom: 0.55rem;
`;

const AuxiliaryParticipantBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
`;

const AuxiliaryEmpty = styled.div`
  padding: 0.75rem 0.55rem;
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.45;
  text-align: center;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.9);
`;

const AuxiliaryChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-height: 0;
`;

const AuxiliaryChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.28rem 0.4rem 0.28rem 0.5rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #312e81;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border: 1px solid rgba(129, 140, 248, 0.55);
  line-height: 1.2;
`;

const AuxiliaryChipName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(22ch, 100%);
`;

const AuxiliaryChipRemove = styled.button`
  flex-shrink: 0;
  border: none;
  background: rgba(99, 102, 241, 0.15);
  color: #4338ca;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #b91c1c;
  }
`;

const MutedText = styled.p`
  margin: 0.35rem 0;
  color: #94a3b8;
  font-size: 0.82rem;
`;

const ContractsListWrap = styled.div`
  min-width: 0;
`;

const ContractPanel = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
`;

const ContractPanelTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 800;
  color: #4338ca;
  margin-bottom: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const SupplementaryOuter = styled.div`
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 55%, #f8fafc 100%);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(34, 197, 94, 0.35);
  margin-top: 0.5rem;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.08);
`;

const SupplementarySectionTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 800;
  color: #047857;
  margin-bottom: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const SupplementaryInner = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 0.85rem;
  margin-bottom: 0.55rem;
  border: 1px solid rgba(34, 197, 94, 0.22);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
`;

const FileGroupCard = styled.div`
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #ffffff 100%);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: 12px;
  margin-top: 0.55rem;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.07);
`;

const FileGroupToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const FileGroupTitleBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  min-width: 0;
`;

const FileGroupMetaBadge = styled.span`
  font-size: 0.72rem;
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  font-weight: 700;
`;

const SmallFileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.55rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.28rem;
  gap: 0.5rem;
`;

const ToolbarDeleteBtn = styled.button`
  background: #fff;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.28rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
  &:hover {
    background: #fef2f2;
    border-color: #f87171;
  }
`;

const ToolbarRemoveFileBtn = styled.button`
  background: #fffbeb;
  color: #a16207;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.18rem 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: #fef9c3;
  }
`;

const FileListLabel = styled.strong`
  font-size: 0.86rem;
  color: #475569;
  font-weight: 700;
  display: block;
  margin-bottom: 0.35rem;
`;

const FileUploadTitle = styled.strong`
  font-size: 1.02rem;
  color: #312e81;
`;

const FileUploadHint = styled.p`
  margin: 0.4rem 0 0 0;
  font-size: 0.86rem;
  color: #64748b;
  line-height: 1.45;
`;

const AddContractButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-top: 1rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveContractButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-left: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const FileUploadSection = styled.div`
  border: 2px dashed rgba(99, 102, 241, 0.45);
  border-radius: 14px;
  padding: 1.75rem 1.5rem;
  text-align: center;
  margin: 1rem 0;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.65) 0%, rgba(255, 255, 255, 0.9) 100%);

  &:hover {
    border-color: #6366f1;
    background: linear-gradient(180deg, rgba(224, 231, 255, 0.9) 0%, #fff 100%);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  }
`;

const FileList = styled.div`
  margin-top: 1rem;
`;

const FileItem = styled.div`
  background: #fff;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  margin: 0.45rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  gap: 0.5rem;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  background: linear-gradient(90deg, rgba(238, 242, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%);
  border-radius: 10px;
  border: 1px solid rgba(129, 140, 248, 0.35);
`;

const Checkbox = styled.input`
  margin-right: 0.5rem;
  transform: scale(1.2);
`;

const CheckboxLabel = styled.label`
  font-weight: 500;
  color: #495057;
  cursor: pointer;
`;

const AleCodesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AleCodeItem = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  width: 100%;
`;

const AleCodeInput = styled(Input)`
  flex: 1;
  min-width: 0;
`;

const AddAleButton = styled.button`
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  
  &:hover {
    background: #218838;
    transform: translateY(-1px);
  }
`;

const RemoveAleButton = styled.button`
  padding: 0.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  min-width: 36px;
  transition: all 0.2s;
  
  &:hover {
    background: #c82333;
    transform: translateY(-1px);
  }
`;


const AddSupplementaryButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveSupplementaryButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-top: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const StickyFooter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  padding: 1rem 1.5rem 1.1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, #f1f5f9 100%);
  border-radius: 0 0 18px 18px;
  flex-shrink: 0;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.04);
`;

const SecondaryOutlineButton = styled.button`
  background: #fff;
  color: #4338ca;
  border: 1.5px solid #6366f1;
  padding: 0.62rem 1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  &:hover:not(:disabled) {
    background: #eef2ff;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.6rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(76, 175, 80, 0.35);
  }
`;

const CancelButton = styled.button`
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #5a6268;
    transform: translateY(-1px);
  }
`;

const DeleteFormButton = styled.button`
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(220, 53, 69, 0.35);
  }
`;

const ErrorMessage = styled.div`
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem;
  background: rgba(254, 242, 242, 0.95);
  border-radius: 6px;
  border: 1px solid #fecaca;
`;

function ProjectForm({ isOpen, onClose, onSave, onDelete, editingProject = null }) {
  const [touched, setTouched] = useState({}); // Track which fields have been touched
  const [formData, setFormData] = useState({
    projectTitle: '',
    subprojectTitle: '',
    implementationForm: '',
    kaCode: '',
    noKaCode: false,
    eisigitikiEkthesi: '',
    aleCodes: [], // Array κωδικών Α.Λ.Ε.
    misPraxhsName: '',
    misPraxhsCode: '',
    projectType: '',
    fundingSource: '',
    fundingDetails: '',
    approvedAmount: '',
    projectBudget: '',
    projectStatus: '',
    contractProcessStartDate: '', // Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης
    contractDate: '',
    contractAmount: '',
    apeAmount: '',
    apeComments: '',
    supervisorEngineerIds: [],
    supervisorChargeOutsideEngineers: false,
    supervisorChargeFreePrimary: '',
    supervisorChargeFreeParticipants: '',
    comments: '',
    remainingAmount: '',
    remainingAmountYear: '2026',
    remainingAmountComments: '',
    aleRemainingAmounts: [],
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
    files: [],
    fileGroups: [], // Νέα δομή για ομαδοποίηση αρχείων
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: ''
  });

  const [errors, setErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [registeredEngineers, setRegisteredEngineers] = useState([]);
  const [auxPickerKey, setAuxPickerKey] = useState(0);
  const [khmdhsFetchLoadingTarget, setKhmdhsFetchLoadingTarget] = useState(null);
  const khmdhsFetchGenRef = React.useRef(0);

  const cancelKhmdhsFetch = React.useCallback(() => {
    khmdhsFetchGenRef.current += 1;
    setKhmdhsFetchLoadingTarget(null);
  }, []);

  useEffect(() => {
    if (isOpen) return undefined;
    cancelKhmdhsFetch();
    return undefined;
  }, [isOpen, cancelKhmdhsFetch]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-registered-engineers');
        if (cancelled) return;
        if (res?.success && Array.isArray(res.engineers)) {
          setRegisteredEngineers(res.engineers);
        } else {
          setRegisteredEngineers([]);
        }
      } catch {
        if (!cancelled) setRegisteredEngineers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (editingProject) {
      // Backward compatibility: μετατροπή aleCode string σε aleCodes array
      let aleCodes = [];
      if (editingProject.aleCodes && Array.isArray(editingProject.aleCodes)) {
        aleCodes = editingProject.aleCodes;
      } else if (editingProject.aleCode && typeof editingProject.aleCode === 'string') {
        aleCodes = [editingProject.aleCode];
      }
      
      // Backward compat για aleRemainingAmounts
      let aleRemainingAmounts = [];
      if (editingProject.aleRemainingAmounts && Array.isArray(editingProject.aleRemainingAmounts)) {
        aleRemainingAmounts = editingProject.aleRemainingAmounts;
        // Εξασφαλίζουμε ότι το μέγεθος ταιριάζει με τους κωδικούς
        while (aleRemainingAmounts.length < aleCodes.length) {
          aleRemainingAmounts = [...aleRemainingAmounts, ''];
        }
        aleRemainingAmounts = aleRemainingAmounts.slice(0, aleCodes.length);
      } else {
        // Δεν υπάρχουν δεδομένα - αρχικοποιούμε κενά
        aleRemainingAmounts = aleCodes.map(() => '');
      }

      const supervisorEngineerIds = Array.isArray(editingProject.supervisorEngineerIds)
        ? editingProject.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
        : [];

      const fp0 = editingProject.supervisorChargeFreePrimary != null ? String(editingProject.supervisorChargeFreePrimary) : '';
      const fpart0 =
        editingProject.supervisorChargeFreeParticipants != null ? String(editingProject.supervisorChargeFreeParticipants) : '';
      const hadLegacyFree = !!(fp0.trim() || fpart0.trim());
      const explicitOutside = editingProject.supervisorChargeOutsideEngineers === true;
      const explicitInside = editingProject.supervisorChargeOutsideEngineers === false;
      const supervisorChargeOutsideEngineers =
        explicitOutside || (!explicitInside && hadLegacyFree && supervisorEngineerIds.length === 0);
      const mergedFree = [fp0.trim(), fpart0.trim()].filter(Boolean).join('\n');

      const { supervisor: _legacySupervisor, ...editingRest } = editingProject;
      setFormData({
        ...editingRest,
        aleCodes: aleCodes,
        aleRemainingAmounts: aleRemainingAmounts,
        contracts: normalizeContractsFromProject(editingProject),
        fileGroups: editingProject.fileGroups || [],
        supervisorEngineerIds,
        supervisorChargeOutsideEngineers,
        supervisorChargeFreePrimary: supervisorChargeOutsideEngineers ? mergedFree || fp0 : fp0,
        supervisorChargeFreeParticipants: supervisorChargeOutsideEngineers ? '' : fpart0,
        khmdhsAdam: editingProject.khmdhsAdam != null ? String(editingProject.khmdhsAdam) : '',
        khmdhsContractSnapshot: pickKhmdhsSnapshot(editingProject.khmdhsContractSnapshot),
        khmdhsContractFetchedAt: editingProject.khmdhsContractFetchedAt != null ? String(editingProject.khmdhsContractFetchedAt) : ''
      });
    } else {
      // Reset form for new project
      setFormData({
        projectTitle: '',
        subprojectTitle: '',
        implementationForm: '',
        kaCode: '',
        noKaCode: false,
        eisigitikiEkthesi: '',
        aleCodes: [],
        misPraxhsName: '',
        misPraxhsCode: '',
        projectType: '',
        fundingSource: '',
        fundingDetails: '',
        approvedAmount: '',
        projectBudget: '',
        projectStatus: '',
        contractProcessStartDate: '',
        contractDate: '',
        contractAmount: '',
        apeAmount: '',
        apeComments: '',
        supervisorEngineerIds: [],
        supervisorChargeOutsideEngineers: false,
        supervisorChargeFreePrimary: '',
        supervisorChargeFreeParticipants: '',
        comments: '',
        remainingAmount: '',
        remainingAmountYear: '2026',
        remainingAmountComments: '',
        aleRemainingAmounts: [],
        contracts: [],
        hasSupplementaryContracts: false,
        supplementaryContracts: [],
        files: [],
        fileGroups: [],
        khmdhsAdam: '',
        khmdhsContractSnapshot: null,
        khmdhsContractFetchedAt: ''
      });
    }
    setErrors({});
    setTouched({}); // Reset touched fields when form opens/closes
    setSelectedFiles([]);
  }, [editingProject, isOpen]);

  const validateKACode = (code) => {
    const pattern = /^\d{2}-\d{4}\.\d{3}$/;
    return pattern.test(code);
  };

  // Real-time validation functions
  const validateField = (field, value) => {
    switch (field) {
      case 'projectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος έργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος έργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος έργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'subprojectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος υποέργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος υποέργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος υποέργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'kaCode':
        if (formData.noKaCode) {
          return null; // No validation if noKaCode is checked
        }
        // Πλέον ο κωδικός ΚΑ δεν είναι υποχρεωτικός
        if (!value || value.trim().length === 0) {
          return null; // Επιτρέπεται κενό
        }
        if (!validateKACode(value)) {
          return 'Ο κωδικός ΚΑ πρέπει να έχει μορφή: 12-3456.789';
        }
        return null; // Valid
        
      case 'approvedAmount':
      case 'projectBudget':
      case 'contractAmount':
      case 'apeAmount':
        if (!value || value.trim().length === 0) {
          return null; // Allow empty for now, will be validated on submit
        }
        // Remove formatting (spaces, dots, commas) but keep minus
        let cleanValue = value.replace(/[\s.,]/g, '');
        // Handle comma as decimal separator
        if (value.includes(',')) {
          const parts = value.split(',');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s.]/g, '') + '.' + parts[1];
          }
        }
        // Handle dot as decimal separator if no comma
        else if (value.includes('.') && !value.includes(',')) {
          const parts = value.split('.');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s,]/g, '') + '.' + parts[1];
          }
        }
        // Keep minus if present
        const hasMinus = cleanValue.startsWith('-');
        cleanValue = cleanValue.replace(/[^\d.]/g, '');
        if (hasMinus) {
          cleanValue = '-' + cleanValue;
        }
        
        const numValue = parseFloat(cleanValue);
        if (isNaN(numValue)) {
          return 'Πρέπει να είναι αριθμός';
        }
        // Allow negative numbers (removed the < 0 check)
        if (Math.abs(numValue) > 999999999.99) {
          return 'Το ποσό είναι πολύ μεγάλο (μέγιστο 999.999.999,99)';
        }
        return null; // Valid
        
      default:
        return null;
    }
  };

  const formatAmount = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα, τελείες και πλην στην αρχή
    let cleaned = value;
    
    // Κρατάω πλην μόνο στην αρχή
    const hasMinusAtStart = cleaned.startsWith('-');
    cleaned = cleaned.replace(/[^\d,.]/g, '');
    if (hasMinusAtStart && cleaned.length > 0) {
      cleaned = '-' + cleaned;
    }
    
    // Αν δεν υπάρχουν ψηφία, επιστρέφω κενό
    if (!/\d/.test(cleaned)) return '';
    
    // Απλή καθαρισμό για typing - επιτρέπω ελεύθερη πληκτρολόγηση
    return cleaned;
  };

  const formatAmountOnBlur = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    const hasMinusAtStart = value.trim().startsWith('-');
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα και τελείες
    let cleaned = value.replace(/[^\d,.]/g, '');
    
    if (!/\d/.test(cleaned)) return '';
    
    let integerPart = '';
    let decimalPart = '';
    
    // Αφαίρεση πλην προσωρινά για processing
    const isNegative = cleaned.startsWith('-');
    if (isNegative) {
      cleaned = cleaned.substring(1);
    }
    
    // Αναγνώριση του τρόπου εισαγωγής και μετατροπή σε ευρωπαϊκή μορφή
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
        // Αμερικανική μορφή (25,254.25)
        let parts = cleaned.split('.');
        integerPart = parts[0].replace(/,/g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      } else {
        // Ευρωπαϊκή μορφή (25.254,25)
        let parts = cleaned.split(',');
        integerPart = parts[0].replace(/\./g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      }
    } else if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    } else if (cleaned.includes('.')) {
      let parts = cleaned.split('.');
      if (parts[0].length <= 3 && parts[1]) {
        integerPart = parts[0];
        decimalPart = parts[1].slice(0, 2);
      } else {
        integerPart = cleaned.replace(/\./g, '');
      }
    } else {
      integerPart = cleaned;
    }
    
    // Μορφοποίηση του ακέραιου μέρους με τελείες για χιλιάδες
    let formattedInteger = '';
    if (integerPart.length > 3) {
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          formattedInteger = '.' + formattedInteger;
        }
        formattedInteger = integerPart[i] + formattedInteger;
      }
    } else {
      formattedInteger = integerPart;
    }
    
    let result = formattedInteger;
    if (decimalPart) {
      result += ',' + decimalPart;
    }
    
    // Προσθήκη πλην αν υπήρχε στην αρχή
    if (hasMinusAtStart) {
      result = '-' + result;
    }
    
    return result;
  };

  // ALE Codes management
  const handleAddAleCode = () => {
    setFormData(prev => ({
      ...prev,
      aleCodes: [...prev.aleCodes, ''],
      aleRemainingAmounts: [...(prev.aleRemainingAmounts || []), '']
    }));
  };

  const handleAleCodeChange = (index, value) => {
    setFormData(prev => {
      const newAleCodes = [...prev.aleCodes];
      newAleCodes[index] = value;
      return { ...prev, aleCodes: newAleCodes };
    });
  };

  const handleRemoveAleCode = (index) => {
    setFormData(prev => {
      const newAleCodes = prev.aleCodes.filter((_, i) => i !== index);
      const newAleRemainingAmounts = (prev.aleRemainingAmounts || []).filter((_, i) => i !== index);
      // Υπολογισμός νέου συνόλου
      const newTotal = newAleRemainingAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleCodes: newAleCodes,
        aleRemainingAmounts: newAleRemainingAmounts,
        remainingAmount: newAleCodes.length >= 1 && newTotal > 0
          ? formatNumberToEuropean(newTotal)
          : ''
      };
    });
  };

  // Helper: μετατροπή μορφοποιημένου ποσού σε αριθμό
  const parseFormattedAmount = (value) => {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
  };

  // Helper: μετατροπή αριθμού σε ευρωπαϊκή μορφή (25.587,56)
  const formatNumberToEuropean = (num) => {
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('el-GR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    });
  };

  const handleAleRemainingAmountChange = (index, value) => {
    value = formatAmount(value);
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = value;
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const handleAleRemainingAmountBlur = (index) => {
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = formatAmountOnBlur(newAmounts[index] || '');
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.projectTitle.trim()) {
      newErrors.projectTitle = 'Απαιτείται τίτλος έργου';
    }

    if (!formData.subprojectTitle.trim()) {
      newErrors.subprojectTitle = 'Απαιτείται τίτλος υποέργου';
    }

    if (!formData.implementationForm) {
      newErrors.implementationForm = 'Επιλέξτε μορφή υλοποίησης';
    }

    if (
      !formData.noKaCode &&
      formData.kaCode &&
      formData.kaCode.trim().length > 0 &&
      !validateKACode(formData.kaCode)
    ) {
      newErrors.kaCode = 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx';
    }

    // Validation για MIS ΠΡΑΞΗΣ: αν έχει ένα από τα δύο, πρέπει να έχει και το άλλο
    const hasMisPraxhsName = formData.misPraxhsName && formData.misPraxhsName.trim();
    const hasMisPraxhsCode = formData.misPraxhsCode && formData.misPraxhsCode.trim();
    
    if (hasMisPraxhsName && !hasMisPraxhsCode) {
      newErrors.misPraxhsCode = 'Παρακαλώ συμπληρώστε και τον κωδικό';
    }
    
    if (hasMisPraxhsCode && !hasMisPraxhsName) {
      newErrors.misPraxhsName = 'Παρακαλώ συμπληρώστε και το όνομα του κωδικού';
    }

    if (!formData.projectType) {
      newErrors.projectType = 'Επιλέξτε είδος';
    }

    if (!formData.fundingSource) {
      newErrors.fundingSource = 'Επιλέξτε πηγή χρηματοδότησης';
    }

    if (!formData.fundingDetails) {
      newErrors.fundingDetails = 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης';
    }

    if (!formData.approvedAmount) {
      newErrors.approvedAmount = 'Απαιτείται εγκεκριμένο ποσό';
    }

    if (!formData.projectBudget) {
      newErrors.projectBudget = 'Απαιτείται προϋπολογισμός έργου';
    }

    if (!formData.projectStatus) {
      newErrors.projectStatus = 'Επιλέξτε κατάσταση έργου';
    }

    if (isMultipleContractsForm(formData.implementationForm)) {
      (formData.contracts || []).forEach((contract, index) => {
        const adamErr = getAdamFieldError(contract?.khmdhsAdam, 'strict');
        if (adamErr) newErrors[`khmdhsAdam${index}`] = adamErr;
      });
    } else {
      const adamErr = getAdamFieldError(formData.khmdhsAdam, 'strict');
      if (adamErr) newErrors.khmdhsAdam = adamErr;
    }

    // Validate contract process start date if status is "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ"
    // Check if contractProcessStartDate is before contractDate (if contractDate exists)
    // This validation applies to all statuses from "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ" onwards
    if (formData.projectStatus && PROJECT_STATUSES.indexOf(formData.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ')) {
      if (formData.contractProcessStartDate) {
        const processStartDate = new Date(formData.contractProcessStartDate);
        
        // For single contract
        if (formData.implementationForm === 'Μια Σύμβαση' && formData.contractDate) {
          const contractDate = new Date(formData.contractDate);
          if (processStartDate >= contractDate) {
            newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη της ημερομηνίας σύμβασης';
          }
        }
        
        // For multiple contracts - check against all contract dates
        if (formData.implementationForm === 'Πολλές Συμβάσεις' && formData.contracts && formData.contracts.length > 0) {
          const invalidContracts = formData.contracts.filter((contract, index) => {
            if (contract.date) {
              const contractDate = new Date(contract.date);
              return processStartDate >= contractDate;
            }
            return false;
          });
          
          if (invalidContracts.length > 0) {
            newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη όλων των ημερομηνιών σύμβασης';
          }
        }
      }
    }

    // Validate contract fields if needed
    if (STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus)) {
      if (formData.implementationForm === 'Μια Σύμβαση') {
        if (!formData.contractDate) {
          newErrors.contractDate = 'Απαιτείται ημερομηνία υπογραφής σύμβασης';
        }
        if (!formData.contractAmount) {
          newErrors.contractAmount = 'Απαιτείται ποσό σύμβασης';
        }
        if (!formData.apeAmount) {
          newErrors.apeAmount = 'Απαιτείται ποσό ΑΠΕ + Συμπληρωματικές συμβάσεις';
        }
      } else {
        // Validate multiple contracts
        formData.contracts.forEach((contract, index) => {
          if (!contract.date) {
            newErrors[`contractDate${index}`] = 'Απαιτείται ημερομηνία';
          }
          if (!contract.amount) {
            newErrors[`contractAmount${index}`] = 'Απαιτείται ποσό';
          }
          if (!contract.apeAmount) {
            newErrors[`apeAmount${index}`] = 'Απαιτείται ποσό ΑΠΕ';
          }
        });
      }
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleInputChange = (field, value) => {
    if (field === 'kaCode' && !formData.noKaCode) {
      // Auto-format KA code - επιτρέπω ψηφία, παύλα και τελεία
      value = value.replace(/[^\d\-.]/g, '');
      
      // Αυτόματη μορφοποίηση
      let digitsOnly = value.replace(/[^\d]/g, '');
      
      if (digitsOnly.length <= 2) {
        value = digitsOnly;
      } else if (digitsOnly.length <= 6) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2);
      } else if (digitsOnly.length <= 9) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6);
      } else {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6, 9);
      }
    }

    if (field === 'approvedAmount' || field === 'projectBudget' || field === 'contractAmount' || field === 'apeAmount') {
      value = formatAmount(value);
    }

    if (field === 'khmdhsAdam') {
      cancelKhmdhsFetch();
      value = sanitizeAdamInput(value);
    }

    if (field === 'projectStatus') {
      cancelKhmdhsFetch();
      setFormData((prev) => {
        const next = { ...prev, projectStatus: value };
        const wasKhmdhs = statusRequiresKhmdhsAdam(prev.projectStatus);
        const isKhmdhs = statusRequiresKhmdhsAdam(value);
        // Μεταξύ καταστάσεων με σύμβαση: κρατάμε ΑΔΑΜ και στοιχεία ΚΗΜΔΗΣ
        if (wasKhmdhs && !isKhmdhs) {
          next.khmdhsAdam = '';
          next.khmdhsContractSnapshot = null;
          next.khmdhsContractFetchedAt = '';
        }
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.khmdhsAdam;
        return next;
      });
      return;
    }

    // ΔΕΝ κάνουμε normalization κατά την πληκτρολόγηση για κανένα πεδίο
    // Το normalization γίνεται μόνο κατά την αποθήκευση (στο handleSave)
    // Αυτό επιτρέπει κανονική πληκτρολόγηση με spaces σε όλα τα πεδία

    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));

    // Πάντα ενημέρωση/καθαρισμός σφάλματος πεδίου — ώστε να μην «κολλάει» μήνυμα μετά από διόρθωση
    const fieldError =
      field === 'khmdhsAdam' ? getAdamFieldError(value, 'live') : validateField(field, value);

    if (fieldError && !touched[field]) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const value = field === 'khmdhsAdam' ? sanitizeAdamInput(formData[field]) : formData[field];
    const fieldError =
      field === 'khmdhsAdam' ? getAdamFieldError(value, 'strict') : validateField(field, value);

    setErrors((prev) => {
      const next = { ...prev };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  };

  const handleAmountBlur = (field) => {
    const currentValue = formData[field];
    const formattedValue = formatAmountOnBlur(currentValue);
    
    if (formattedValue !== currentValue) {
      setFormData(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    }
  };

  const handleNoKACodeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      noKaCode: checked,
      kaCode: checked ? 'ΔΕΝ ΥΠΑΡΧΕΙ' : ''
    }));
  };

  const handleFundingSourceChange = (source) => {
    setFormData(prev => ({
      ...prev,
      fundingSource: source,
      fundingDetails: '' // Reset funding details when source changes
    }));
  };

  const addContract = () => {
    setFormData(prev => ({
      ...prev,
      contracts: [...prev.contracts, { date: '', amount: '', apeAmount: '', comments: '', ...emptyKhmdhsOnContract() }]
    }));
  };

  const updateContract = (index, field, value) => {
    if (field === 'amount' || field === 'apeAmount') {
      value = formatAmount(value);
    }
    if (field === 'khmdhsAdam') {
      cancelKhmdhsFetch();
      value = sanitizeAdamInput(value);
    }

    setFormData((prev) => ({
      ...prev,
      contracts: prev.contracts.map((contract, i) => (i === index ? { ...contract, [field]: value } : contract))
    }));

    if (field === 'khmdhsAdam') {
      const adamErr = getAdamFieldError(value, 'live');
      const errKey = `khmdhsAdam${index}`;
      setErrors((prev) => {
        const next = { ...prev };
        if (adamErr) next[errKey] = adamErr;
        else delete next[errKey];
        return next;
      });
    }
  };


  const removeContract = (index) => {
    cancelKhmdhsFetch();
    setFormData((prev) => ({
      ...prev,
      contracts: prev.contracts.filter((_, i) => i !== index)
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`khmdhsAdam${index}`];
      return next;
    });
  };

  // Functions for supplementary contracts
  const addSupplementaryContract = () => {
    setFormData(prev => ({
      ...prev,
      supplementaryContracts: [...prev.supplementaryContracts, { 
        date: '', 
        amount: '', 
        comments: '' 
      }]
    }));
  };

  const updateSupplementaryContract = (index, field, value) => {
    if (field === 'amount') {
      value = formatAmount(value);
    }

    setFormData(prev => ({
      ...prev,
      supplementaryContracts: prev.supplementaryContracts.map((contract, i) => 
        i === index ? { ...contract, [field]: value } : contract
      )
    }));
  };

  const removeSupplementaryContract = (index) => {
    setFormData(prev => ({
      ...prev,
      supplementaryContracts: prev.supplementaryContracts.filter((_, i) => i !== index)
    }));
  };

  const handleFileSelect = async () => {
    try {
      const result = await ipcRenderer.invoke('open-file-dialog');
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles = result.filePaths.map(path => ({
          path,
          name: path.split('\\').pop().split('/').pop()
        }));
        
        // Απλό modal για επιλογή ομαδοποίησης
        const groupingChoice = await showSimpleGroupingModal(newFiles.length, formData.fileGroups || []);
        
        if (groupingChoice !== null && groupingChoice !== false) {
          if (groupingChoice.action === 'new') {
            // Δημιουργία νέας ομάδας
            setFormData(prev => ({
              ...prev,
              fileGroups: [...(prev.fileGroups || []), {
                id: uuidv4(),
                title: groupingChoice.title,
                files: newFiles
              }]
            }));
          } else if (groupingChoice.action === 'existing') {
            // Προσθήκη σε υπάρχουσα ομάδα
            setFormData(prev => ({
              ...prev,
              fileGroups: (prev.fileGroups || []).map(group => 
                group.id === groupingChoice.groupId
                  ? { ...group, files: [...group.files, ...newFiles] }
                  : group
              )
            }));
          }
        } else {
          // Κανονική προσθήκη αρχείων χωρίς ομαδοποίηση
          setSelectedFiles(prev => [...prev, ...newFiles]);
        }
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };


  const removeFileGroup = (groupId) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.filter(group => group.id !== groupId)
    }));
  };

  const removeFileFromGroup = (groupId, fileIndex) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.map(group => 
        group.id === groupId 
          ? { ...group, files: group.files.filter((_, i) => i !== fileIndex) }
          : group
      ).filter(group => group.files.length > 0) // Αφαιρούμε ομάδες χωρίς αρχεία
    }));
  };

  // Απλό modal για ομαδοποίηση αρχείων
  const showSimpleGroupingModal = (fileCount, existingGroups = []) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      `;

      // Δημιουργία επιλογών για υπάρχουσες ομάδες
      const existingGroupsOptions = existingGroups.length > 0 
        ? existingGroups.map(group => `<option value="${group.id}">${group.title}</option>`).join('')
        : '';

      modalContent.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
          📁 Ομαδοποίηση Αρχείων
        </h3>
        <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
          Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;
        </p>
        <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
          <button id="newGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">🆕 Νέα Ομάδα</button>
          ${existingGroups.length > 0 ? `
          <button id="existingGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📂 Προσθήκη σε Υπάρχουσα Ομάδα</button>
          ` : ''}
          <button id="noGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📄 Χωρίς Ομαδοποίηση</button>
        </div>
        <div id="newGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος νέας ομάδας:
          </label>
          <input 
            type="text" 
            id="newGroupTitle" 
            placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="confirmNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
        <div id="existingGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε υπάρχουσα ομάδα:
          </label>
          <select 
            id="existingGroupSelect" 
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          >
            <option value="">-- Επιλέξτε ομάδα --</option>
            ${existingGroupsOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="confirmExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Event listeners για τα κουμπιά
      const newGroupBtn = modalContent.querySelector('#newGroupBtn');
      const existingGroupBtn = modalContent.querySelector('#existingGroupBtn');
      const noGroupBtn = modalContent.querySelector('#noGroupBtn');
      
      const newGroupSection = modalContent.querySelector('#newGroupSection');
      const existingGroupSection = modalContent.querySelector('#existingGroupSection');
      
      const newGroupTitle = modalContent.querySelector('#newGroupTitle');
      const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
      
      const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
      const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
      const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
      const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');

      // Νέα ομάδα
      newGroupBtn.addEventListener('click', () => {
        newGroupBtn.style.display = 'none';
        if (existingGroupBtn) existingGroupBtn.style.display = 'none';
        noGroupBtn.style.display = 'none';
        newGroupSection.style.display = 'block';
        newGroupTitle.focus();
      });

      // Υπάρχουσα ομάδα
      if (existingGroupBtn) {
        existingGroupBtn.addEventListener('click', () => {
          newGroupBtn.style.display = 'none';
          existingGroupBtn.style.display = 'none';
          noGroupBtn.style.display = 'none';
          existingGroupSection.style.display = 'block';
        });
      }

      // Χωρίς ομαδοποίηση
      noGroupBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      // Επιβεβαίωση νέας ομάδας
      confirmNewBtn.addEventListener('click', () => {
        const title = newGroupTitle.value.trim();
        if (title) {
          document.body.removeChild(modal);
          resolve({ action: 'new', title });
        } else {
          alert('Παρακαλώ εισάγετε τίτλο ομάδας');
        }
      });

      // Ακύρωση νέας ομάδας
      cancelNewBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      let handleKeyDown;
      const cleanup = (result) => {
        if (modal.parentNode === document.body) {
          document.body.removeChild(modal);
        }
        if (handleKeyDown) {
          document.removeEventListener('keydown', handleKeyDown);
        }
        resolve(result);
      };

      // Επιβεβαίωση υπάρχουσας ομάδας
      confirmExistingBtn.addEventListener('click', () => {
        const selectedGroupId = existingGroupSelect.value;
        if (selectedGroupId) {
          cleanup({ action: 'existing', groupId: selectedGroupId });
        } else {
          alert('Παρακαλώ επιλέξτε ομάδα');
        }
      });

      // Ακύρωση υπάρχουσας ομάδας
      cancelExistingBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Κλείσιμο με ESC
      handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
    });
  };

  // Συνάρτηση για normalization κειμένου
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')           // Αντιγράφει \n literals
      .replace(/\n/g, ' ')            // Αντιγράφει πραγματικά newlines
      .replace(/\r/g, ' ')            // Αντιγράφει carriage returns
      .replace(/\t/g, ' ')            // Αντιγράφει tabs
      .replace(/\s+/g, ' ')           // Αντικαθιστά όλα τα whitespace (συμπεριλαμβανομένων διπλών κενών) με ένα κενό
      .replace(/\u00A0/g, ' ')        // Αντιγράφει non-breaking spaces
      .replace(/[\u2000-\u200B]/g, ' ') // Αντιγράφει διάφορα είδη spaces (Unicode)
      .replace(/\u2028/g, ' ')        // Αντιγράφει line separator
      .replace(/\u2029/g, ' ')        // Αντιγράφει paragraph separator
      .trim();
  };

  const handleKhmdhsFetch = async (target) => {
    const isMulti = isMultipleContractsForm(formData.implementationForm);
    const contractIndex = typeof target === 'number' ? target : -1;
    const adam = isMulti
      ? sanitizeAdamInput(formData.contracts?.[contractIndex]?.khmdhsAdam)
      : sanitizeAdamInput(formData.khmdhsAdam);
    if (!adam) return;
    const errKey = isMulti ? `khmdhsAdam${contractIndex}` : 'khmdhsAdam';
    const formatErr = getAdamFieldError(adam, 'strict');
    if (formatErr) {
      setErrors((prev) => ({ ...prev, [errKey]: formatErr }));
      setTouched((prev) => ({ ...prev, [errKey]: true }));
      return;
    }
    const gen = ++khmdhsFetchGenRef.current;
    setKhmdhsFetchLoadingTarget(isMulti ? contractIndex : 'single');
    try {
      const fetchPromise = ipcRenderer.invoke('khmdhs-fetch-contract-by-adam', { adam });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Η ανάκτηση από το ΚΗΜΔΗΣ διήρκεσε πολύ. Δοκιμάστε ξανά.')), 90000);
      });
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (gen !== khmdhsFetchGenRef.current) return;
      if (res?.success && res.snapshot) {
        const snapshot = pickKhmdhsSnapshot(res.snapshot);
        const fetchedAt = res.fetchedAt || new Date().toISOString();
        setFormData((prev) => {
          if (isMulti) {
            return {
              ...prev,
              contracts: prev.contracts.map((c, i) =>
                i === contractIndex
                  ? { ...c, khmdhsAdam: adam, khmdhsContractSnapshot: snapshot, khmdhsContractFetchedAt: fetchedAt }
                  : c
              )
            };
          }
          return {
            ...prev,
            khmdhsAdam: adam,
            khmdhsContractSnapshot: snapshot,
            khmdhsContractFetchedAt: fetchedAt
          };
        });
        setErrors((prev) => {
          const next = { ...prev };
          delete next[errKey];
          return next;
        });
      } else {
        alert(res?.error || 'Η ανάκτηση από το ΚΗΜΔΗΣ απέτυχε.');
      }
    } catch (e) {
      if (gen === khmdhsFetchGenRef.current) {
        alert(e?.message || 'Σφάλμα κατά την επικοινωνία με το ΚΗΜΔΗΣ.');
      }
    } finally {
      if (gen === khmdhsFetchGenRef.current) {
        setKhmdhsFetchLoadingTarget(null);
      }
    }
  };

  const renderKhmdhsAdamBlock = ({
    adam,
    snapshot,
    fetchedAt,
    errorKey,
    loading,
    onAdamChange,
    onBlur,
    onFetch,
    titleSuffix = ''
  }) => (
    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(99, 102, 241, 0.35)' }}>
      <Label style={{ marginBottom: '0.45rem' }}>
        ΑΔΑΜ σύμβασης{titleSuffix} (ΚΗΜΔΗΣ — προαιρετικό)
      </Label>
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          type="text"
          style={{ flex: '1 1 220px', minWidth: 0 }}
          value={adam || ''}
          onChange={onAdamChange}
          onBlur={onBlur}
          placeholder="π.χ. 26SYMV018523441"
          maxLength={ADAM_MAX_LEN}
          autoComplete="off"
          spellCheck={false}
        />
        <SecondaryOutlineButton type="button" disabled={loading || !String(adam || '').trim()} onClick={onFetch}>
          {loading ? 'Λήψη…' : 'Ανάκτηση από ΚΗΜΔΗΣ'}
        </SecondaryOutlineButton>
      </div>
      <FieldHint style={{ marginTop: '0.4rem' }}>
        Προαιρετικό — ανάδοχος, ΑΦΜ και αναθέτουσα από cerpp.eprocurement.gov.gr
      </FieldHint>
      {errors[errorKey] && <ErrorMessage>{errors[errorKey]}</ErrorMessage>}
      {fetchedAt && (
        <FieldHint style={{ marginTop: '0.35rem', fontWeight: 600 }}>
          Τελευταία λήψη:{' '}
          {(() => {
            try {
              const d = new Date(fetchedAt);
              return Number.isNaN(d.getTime()) ? fetchedAt : d.toLocaleString('el-GR');
            } catch {
              return fetchedAt;
            }
          })()}
        </FieldHint>
      )}
      {snapshot && (
        <div
          style={{
            marginTop: '0.65rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            fontSize: '0.84rem',
            lineHeight: 1.5
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#312e81' }}>Προεπισκόπηση</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.3rem 0.75rem' }}>
            {snapshot.anadoxosName && (
              <span>
                <strong>Ανάδοχος:</strong> {snapshot.anadoxosName}
              </span>
            )}
            {snapshot.anadoxosVat && (
              <span>
                <strong>ΑΦΜ:</strong> {snapshot.anadoxosVat}
              </span>
            )}
            {snapshot.assigningAuthority && (
              <span>
                <strong>Αναθέτουσα:</strong> {snapshot.assigningAuthority}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const handleSave = async () => {
    console.log('=== SAVE ATTEMPT ===');
    console.log('Form data:', formData);
    console.log('Selected files:', selectedFiles);
    console.log('Editing project:', editingProject);
    
    const validation = validateForm();
    if (!validation.isValid) {
      console.log('Validation failed, errors:', validation.errors);
      setErrors(validation.errors);
      setTouched((prev) => ({
        ...prev,
        ...Object.keys(validation.errors).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {})
      }));
      return;
    }

    console.log('Validation passed, proceeding with save...');

    try {
      // Normalize τα κείμενα πριν την αποθήκευση
      let outside = Boolean(formData.supervisorChargeOutsideEngineers);
      let supervisorEngineerIds = [];
      if (!outside) {
        const rawEng = Array.isArray(formData.supervisorEngineerIds) ? formData.supervisorEngineerIds : [];
        const pEng = String(rawEng[0] || '').trim();
        const seenEng = new Set();
        if (pEng) {
          supervisorEngineerIds.push(pEng);
          seenEng.add(pEng);
        }
        rawEng.slice(1).forEach((id) => {
          const s = String(id || '').trim();
          if (s && !seenEng.has(s)) {
            seenEng.add(s);
            supervisorEngineerIds.push(s);
          }
        });
      }

      let supervisorChargeFreePrimary = normalizeText(formData.supervisorChargeFreePrimary || '');
      let supervisorChargeFreeParticipants = normalizeText(formData.supervisorChargeFreeParticipants || '');

      // Πριν καθαρισμό πεδίων: ελεύθερο κείμενο χωρίς κατάλογο = χρέωση εκτός μηχανικών
      if (supervisorChargeFreePrimary.trim() && supervisorEngineerIds.length === 0) {
        outside = true;
      }

      if (outside) {
        supervisorChargeFreeParticipants = '';
      } else {
        supervisorChargeFreePrimary = '';
        supervisorChargeFreeParticipants = '';
      }

      const { supervisor: _legacySupervisorSave, ...formWithoutLegacy } = formData;
      const normalizedFormData = {
        ...formWithoutLegacy,
        projectTitle: normalizeText(formData.projectTitle),
        subprojectTitle: normalizeText(formData.subprojectTitle),
        comments: normalizeText(formData.comments),
        apeComments: normalizeText(formData.apeComments),
        remainingAmountComments: normalizeText(formData.remainingAmountComments),
        aleRemainingAmounts: formData.aleRemainingAmounts || [],
        supervisorEngineerIds,
        supervisorChargeOutsideEngineers: outside,
        supervisorChargeFreePrimary,
        supervisorChargeFreeParticipants,
        ...resolveKhmdhsFieldsForSave(formData, editingProject)
      };

      const projectData = {
        ...normalizedFormData,
        files: selectedFiles,
        fileGroups: formData.fileGroups || []
      };

      if (editingProject) {
        // Έλεγχος αν ο τίτλος του έργου άλλαξε κατά την επεξεργασία
        const originalProjectTitle = editingProject.projectTitle;
        const newProjectTitle = formData.projectTitle;
        
        if (originalProjectTitle !== newProjectTitle) {
          console.log('⚠️ Project title changed during editing:', {
            original: originalProjectTitle,
            new: newProjectTitle
          });
          
          // Έλεγχος αν υπάρχει ήδη έργο με τον νέο τίτλο
          const existingProject = await ipcRenderer.invoke('find-project-by-title', newProjectTitle);
          
          if (existingProject && existingProject.projectId !== editingProject.projectId) {
            // Υπάρχει άλλο έργο με τον νέο τίτλο - δημιουργούμε νέο έργο
            console.log('🆕 Title conflict detected - creating new project');
            projectData.projectId = null; // Θα δημιουργηθεί νέο ID
          } else {
            // Δεν υπάρχει σύγκρουση - απλά ενημερώνουμε το υπάρχον έργο
            console.log('📝 Updating existing project with new title');
            projectData.projectId = editingProject.projectId;
          }
        } else {
          // Ο τίτλος δεν άλλαξε - κανονική επεξεργασία
          projectData.projectId = editingProject.projectId;
        }
        
        projectData.subprojectId = editingProject.subprojectId;
      } else {
        // Έλεγχος αν υπάρχει έργο με τον ίδιο τίτλο (μόνο για νέα έργα)
        if (normalizedFormData.projectTitle) {
          const existingProject = await ipcRenderer.invoke(
            'find-project-by-title',
            normalizedFormData.projectTitle
          );
          if (existingProject) {
                  // Custom modal για επιλογή
                  const shouldAddToExisting = await new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: rgba(0, 0, 0, 0.7);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      z-index: 10000;
                    `;

                    const modalContent = document.createElement('div');
                    modalContent.style.cssText = `
                      background: white;
                      border-radius: 12px;
                      padding: 2rem;
                      max-width: 500px;
                      width: 90%;
                      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    `;

                    modalContent.innerHTML = `
                      <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
                        🔍 Υπάρχον Έργο Βρέθηκε
                      </h3>
                      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
                        Βρέθηκε υπάρχον έργο με τίτλο:<br>
                        <strong>"${formData.projectTitle}"</strong>
                      </p>
                      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem; font-weight: 500;">
                        Θέλετε να προσθέσετε το νέο υποέργο στο υπάρχον έργο;
                      </p>
                      <div style="display: flex; gap: 1rem;">
                        <button id="yesBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #28a745;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΝΑΙ - Προσθήκη στο Υπάρχον</button>
                        <button id="noBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #007bff;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΟΧΙ - Νέο Έργο</button>
                      </div>
                    `;

                    modal.appendChild(modalContent);
                    document.body.appendChild(modal);

                    const yesBtn = modalContent.querySelector('#yesBtn');
                    const noBtn = modalContent.querySelector('#noBtn');

                    let handleKeyDown;
                    const cleanup = (result) => {
                      if (modal.parentNode === document.body) {
                        document.body.removeChild(modal);
                      }
                      if (handleKeyDown) {
                        document.removeEventListener('keydown', handleKeyDown);
                      }
                      resolve(result);
                    };

                    yesBtn.addEventListener('click', () => cleanup(true));
                    noBtn.addEventListener('click', () => cleanup(false));

                    // Κλείσιμο με ESC
                    handleKeyDown = (e) => {
                      if (e.key === 'Escape') {
                        cleanup(false);
                      }
                    };
                    document.addEventListener('keydown', handleKeyDown);
                  });
            
            if (shouldAddToExisting) {
              // Χρησιμοποιούμε το υπάρχον projectId
              projectData.projectId = existingProject.projectId;
              console.log('🔗 Adding subproject to existing project:', existingProject.projectId);
            } else {
              console.log('🆕 Creating new project with same title');
            }
          }
        }
      }

      console.log('Sending project data:', projectData);
      await onSave(projectData);
      console.log('Project saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const mergeSupervisorEngineerIds = (primaryId, auxiliaryIds) => {
    const p = String(primaryId || '').trim();
    const aux = Array.isArray(auxiliaryIds) ? auxiliaryIds : [];
    const seen = new Set();
    const out = [];
    if (p) {
      out.push(p);
      seen.add(p);
    }
    aux.forEach((id) => {
      const s = String(id || '').trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    });
    return out;
  };

  const primaryEngineerId = (formData.supervisorEngineerIds || [])[0] || '';
  const auxiliaryEngineerIds = (formData.supervisorEngineerIds || []).slice(1);
  const auxiliaryEngineerOptions = (registeredEngineers || []).filter((e) => e.id && e.id !== primaryEngineerId);

  const toggleAuxiliaryEngineer = (engineerId) => {
    const sid = String(engineerId || '').trim();
    if (!sid) return;
    setFormData((prev) => {
      const prim = (prev.supervisorEngineerIds || [])[0] || '';
      if (sid === prim) return prev;
      const ids = prev.supervisorEngineerIds || [];
      const aux = ids.slice(1);
      const has = aux.includes(sid);
      const nextAux = has ? aux.filter((x) => x !== sid) : [...aux, sid];
      return {
        ...prev,
        supervisorEngineerIds: mergeSupervisorEngineerIds(prim, nextAux)
      };
    });
  };

  const addAuxiliaryEngineerFromPicker = (engineerId) => {
    const sid = String(engineerId || '').trim();
    if (!sid) return;
    setFormData((prev) => {
      const prim = (prev.supervisorEngineerIds || [])[0] || '';
      const aux = (prev.supervisorEngineerIds || []).slice(1);
      if (sid === prim || aux.includes(sid)) return prev;
      return {
        ...prev,
        supervisorEngineerIds: mergeSupervisorEngineerIds(prim, [...aux, sid])
      };
    });
    setAuxPickerKey((k) => k + 1);
  };

  const auxiliaryAddDropdownOptions = auxiliaryEngineerOptions.filter((e) => !auxiliaryEngineerIds.includes(e.id));

  const labelForEngineerId = (id) => {
    const sid = String(id || '').trim();
    const eng = (registeredEngineers || []).find(
      (e) => e && e.id && String(e.id).trim().toLowerCase() === sid.toLowerCase()
    );
    return eng ? String(eng.fullName || eng.id).trim() || sid : sid;
  };

  if (!isOpen) return null;

  const showContractFields = STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus);
  const availableFundingDetails = FUNDING_DETAILS[formData.fundingSource] || [];

  return (
    <FormOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <FormContainer>
        {/* Header */}
        <FormHeader>
          <FormTitle>
            {editingProject ? '✏️ Επεξεργασία Υποέργου' : '➕ Εισαγωγή Νέου Υποέργου'}
          </FormTitle>
          <FormSubtitle>
            {editingProject
              ? 'Τροποποιήστε τα πεδία και αποθηκεύστε. Οι ενότητες είναι ομαδοποιημένες για πιο εύκολη πλοήγηση.'
              : 'Συμπληρώστε βήμα-βήμα τα στοιχεία του νέου υποέργου. Τα πεδία με * είναι υποχρεωτικά.'}
          </FormSubtitle>
        </FormHeader>

        <FormScrollArea>

          {/* ── SECTION 1: Τίτλοι ── */}
          <Section>
            <SectionTitle>📋 Στοιχεία Έργου & Υποέργου</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Έργου *</Label>
                <Input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο έργου"
                />
                {errors.projectTitle && <ErrorMessage>{errors.projectTitle}</ErrorMessage>}
              </FormGroup>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Υποέργου *</Label>
                <Input
                  type="text"
                  value={formData.subprojectTitle}
                  onChange={(e) => handleInputChange('subprojectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο υποέργου"
                />
                {errors.subprojectTitle && <ErrorMessage>{errors.subprojectTitle}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 2: Κωδικοί ── */}
          <Section>
            <SectionTitle>🔢 Κωδικοί</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Μορφή Υλοποίησης *</Label>
                <Select
                  value={formData.implementationForm}
                  onChange={(e) => handleInputChange('implementationForm', e.target.value)}
                >
                  <option value="">Επιλέξτε μορφή</option>
                  {IMPLEMENTATION_FORMS.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </Select>
                {errors.implementationForm && <ErrorMessage>{errors.implementationForm}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός ΚΑ (προαιρετικό)</Label>
                <Input
                  type="text"
                  value={formData.kaCode}
                  onChange={(e) => handleInputChange('kaCode', e.target.value)}
                  onBlur={() => handleFieldBlur('kaCode')}
                  disabled={formData.noKaCode}
                  placeholder="xx-xxxx.xxx"
                  maxLength="11"
                  $hasError={!!errors.kaCode}
                  $isValid={!errors.kaCode && formData.kaCode && validateKACode(formData.kaCode)}
                  $touched={touched.kaCode}
                />
                <CheckboxContainer style={{ marginTop: '0.4rem', padding: '0.5rem 0.7rem' }}>
                  <Checkbox
                    type="checkbox"
                    checked={formData.noKaCode}
                    onChange={(e) => handleNoKACodeChange(e.target.checked)}
                  />
                  <CheckboxLabel>Δεν υπάρχει ΚΑ</CheckboxLabel>
                </CheckboxContainer>
                {errors.kaCode && <ErrorMessage>{errors.kaCode}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδ. Α.Λ.Ε.</Label>
                <AleCodesContainer>
                  {formData.aleCodes && formData.aleCodes.length > 0 ? (
                    formData.aleCodes.map((code, index) => (
                      <AleCodeItem key={index}>
                        <AleCodeInput
                          type="text"
                          value={code}
                          onChange={(e) => handleAleCodeChange(index, e.target.value)}
                          placeholder={`Α.Λ.Ε. ${index + 1}`}
                          maxLength="50"
                        />
                        <RemoveAleButton type="button" onClick={() => handleRemoveAleCode(index)} title="Αφαίρεση">✕</RemoveAleButton>
                      </AleCodeItem>
                    ))
                  ) : (
                    <MutedText>Δεν έχουν προστεθεί κωδικοί Α.Λ.Ε.</MutedText>
                  )}
                  <AddAleButton type="button" onClick={handleAddAleCode}>+ Προσθήκη Α.Λ.Ε.</AddAleButton>
                </AleCodesContainer>
              </FormGroup>

              <FormGroup>
                <Label>Όνομα Κωδικού Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsName}
                  onChange={(e) => handleInputChange('misPraxhsName', e.target.value)}
                  placeholder="π.χ. MIS (προαιρετικό)"
                />
                {errors.misPraxhsName && <ErrorMessage>{errors.misPraxhsName}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsCode}
                  onChange={(e) => handleInputChange('misPraxhsCode', e.target.value)}
                  placeholder="Τιμή κωδικού (προαιρετικό)"
                />
                {errors.misPraxhsCode && <ErrorMessage>{errors.misPraxhsCode}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 3: Χρηματοδότηση & Ποσά ── */}
          <Section>
            <SectionTitle>💰 Χρηματοδότηση & Ποσά</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Είδος *</Label>
                <Select
                  value={formData.projectType}
                  onChange={(e) => handleInputChange('projectType', e.target.value)}
                >
                  <option value="">Επιλέξτε είδος</option>
                  {PROJECT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
                {errors.projectType && <ErrorMessage>{errors.projectType}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Βασική Πηγή Χρηματοδότησης *</Label>
                <Select
                  value={formData.fundingSource}
                  onChange={(e) => handleFundingSourceChange(e.target.value)}
                >
                  <option value="">Επιλέξτε πηγή</option>
                  {FUNDING_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </Select>
                {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Εξειδίκευση Πηγής *</Label>
                <Select
                  value={formData.fundingDetails}
                  onChange={(e) => handleInputChange('fundingDetails', e.target.value)}
                  disabled={!formData.fundingSource}
                >
                  <option value="">Επιλέξτε εξειδίκευση</option>
                  {availableFundingDetails.map(detail => (
                    <option key={detail} value={detail}>{detail}</option>
                  ))}
                </Select>
                {errors.fundingDetails && <ErrorMessage>{errors.fundingDetails}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Εγκεκριμένο Ποσό *</Label>
                <Input
                  type="text"
                  value={formData.approvedAmount}
                  onChange={(e) => handleInputChange('approvedAmount', e.target.value)}
                  onBlur={() => { handleAmountBlur('approvedAmount'); handleFieldBlur('approvedAmount'); }}
                  placeholder="π.χ. 25.254,25"
                  $hasError={!!errors.approvedAmount}
                  $isValid={!errors.approvedAmount && formData.approvedAmount && validateField('approvedAmount', formData.approvedAmount) === null}
                  $touched={touched.approvedAmount}
                />
                {errors.approvedAmount && <ErrorMessage>{errors.approvedAmount}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Προϋπολογισμός Έργου *</Label>
                <Input
                  type="text"
                  value={formData.projectBudget}
                  onChange={(e) => handleInputChange('projectBudget', e.target.value)}
                  onBlur={() => { handleAmountBlur('projectBudget'); handleFieldBlur('projectBudget'); }}
                  placeholder="π.χ. 30.000,00"
                  $hasError={!!errors.projectBudget}
                  $isValid={!errors.projectBudget && formData.projectBudget && validateField('projectBudget', formData.projectBudget) === null}
                  $touched={touched.projectBudget}
                />
                {errors.projectBudget && <ErrorMessage>{errors.projectBudget}</ErrorMessage>}
              </FormGroup>

              {/* Υπόλοιπα */}
              {formData.aleCodes && formData.aleCodes.length >= 1 ? (
                <FormGroup fullWidth cols={3}>
                  <Label>Υπόλοιπα για το Έτος ανά Α.Λ.Ε.</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#666' }}>Έτος:</span>
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '90px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {formData.aleCodes.map((aleCode, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ minWidth: '110px', fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', background: '#e3f2fd', padding: '0.35rem 0.5rem', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {aleCode || `Α.Λ.Ε. ${index + 1}`}
                        </span>
                        <Input type="text" value={(formData.aleRemainingAmounts || [])[index] || ''} onChange={(e) => handleAleRemainingAmountChange(index, e.target.value)} onBlur={() => handleAleRemainingAmountBlur(index)} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '2px solid #28a745' }}>
                    <span style={{ minWidth: '110px', fontSize: '0.85rem', fontWeight: 700, color: '#155724' }}>Σύνολο:</span>
                    <Input type="text" value={formData.remainingAmount} disabled placeholder="Αυτόματος υπολογισμός" style={{ flex: 1, background: '#d4edda', fontWeight: 700, color: '#155724', cursor: 'not-allowed' }} />
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              ) : (
                <FormGroup>
                  <Label>Υπόλοιπα για το Έτος</Label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Input type="text" value={formData.remainingAmount} onChange={(e) => handleInputChange('remainingAmount', e.target.value)} onBlur={() => handleAmountBlur('remainingAmount')} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '80px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              )}

              <FormGroup>
                <Label>Σχόλια Υπολοίπων</Label>
                <TextArea value={formData.remainingAmountComments} onChange={(e) => handleInputChange('remainingAmountComments', e.target.value)} placeholder="Σχόλια για τα υπόλοιπα..." rows={2} style={{ minHeight: '56px' }} />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 4: Κατάσταση & Γενικά ── */}
          <Section>
            <SectionTitle>📌 Κατάσταση & Γενικά</SectionTitle>
            <FormGrid cols={3}>
              <FormGroup>
                <Label>Κατάσταση Έργου *</Label>
                <Select
                  value={formData.projectStatus}
                  onChange={(e) => handleInputChange('projectStatus', e.target.value)}
                >
                  <option value="">Επιλέξτε κατάσταση</option>
                  {PROJECT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
                {errors.projectStatus && <ErrorMessage>{errors.projectStatus}</ErrorMessage>}
              </FormGroup>

              {formData.projectStatus && PROJECT_STATUSES.indexOf(formData.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ') && (
                <FormGroup>
                  <Label>Ημερ. Έναρξης Διαδικασίας Σύμβασης</Label>
                  <Input
                    type="date"
                    value={formData.contractProcessStartDate || ''}
                    onChange={(e) => handleInputChange('contractProcessStartDate', e.target.value)}
                  />
                  {errors.contractProcessStartDate && <ErrorMessage>{errors.contractProcessStartDate}</ErrorMessage>}
                </FormGroup>
              )}

              <FormGroup fullWidth cols={3}>
                <Label>Χρέωση από κατάλογο μηχανικών (προαιρετικό)</Label>
                <CheckboxContainer style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <Checkbox
                    type="checkbox"
                    id="supervisorChargeOutsideEngineers"
                    checked={!!formData.supervisorChargeOutsideEngineers}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        supervisorChargeOutsideEngineers: on,
                        ...(on
                          ? { supervisorEngineerIds: [] }
                          : {
                              supervisorChargeFreePrimary: '',
                              supervisorChargeFreeParticipants: ''
                            })
                      }));
                    }}
                  />
                  <CheckboxLabel htmlFor="supervisorChargeOutsideEngineers">Χρέωση εκτός μηχανικών</CheckboxLabel>
                </CheckboxContainer>

                {!formData.supervisorChargeOutsideEngineers ? (
                  <>
                    <EngineerPickGrid>
                      <EngineerPickCard>
                        <EngineerPickCardTitle>Κύριος / Κύρια (κατάλογος)</EngineerPickCardTitle>
                        <Select
                          value={primaryEngineerId}
                          onChange={(e) => {
                            const newPrimary = e.target.value;
                            const aux = auxiliaryEngineerIds.filter((x) => x !== newPrimary);
                            setFormData((prev) => ({
                              ...prev,
                              supervisorEngineerIds: mergeSupervisorEngineerIds(newPrimary, aux)
                            }));
                          }}
                        >
                          <option value="">— Καμία επιλογή —</option>
                          {(registeredEngineers || []).map((eng) => (
                            <option key={eng.id} value={eng.id}>
                              {eng.fullName}
                            </option>
                          ))}
                        </Select>
                        {registeredEngineers.length === 0 && (
                          <FieldHint style={{ marginTop: '0.5rem' }}>
                            Δεν υπάρχουν διαθέσιμοι μηχανικοί. Ορίστε χρήστες με ρόλο «Μηχανικός» στη Διαχείριση χρηστών.
                          </FieldHint>
                        )}
                      </EngineerPickCard>

                      <EngineerPickCard>
                        <EngineerPickCardTitle>Συμμετέχουν (κατάλογος)</EngineerPickCardTitle>
                        <AuxiliaryParticipantBlock>
                          {auxiliaryEngineerOptions.length === 0 ? (
                            <AuxiliaryEmpty>
                              {registeredEngineers.length === 0
                                ? 'Κενός κατάλογος.'
                                : registeredEngineers.length <= 1
                                  ? 'Μόνο ένας μηχανικός στον κατάλογο.'
                                  : 'Δεν υπάρχουν άλλοι διαθέσιμοι (ο κύριος εξαιρείται).'}
                            </AuxiliaryEmpty>
                          ) : (
                            <>
                              {auxiliaryAddDropdownOptions.length > 0 ? (
                                <Select
                                  key={auxPickerKey}
                                  defaultValue=""
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v) addAuxiliaryEngineerFromPicker(v);
                                  }}
                                  aria-label="Προσθήκη συμμετέχοντος από κατάλογο"
                                >
                                  <option value="">— Προσθήκη συμμετέχοντος —</option>
                                  {auxiliaryAddDropdownOptions.map((eng) => (
                                    <option key={eng.id} value={eng.id}>
                                      {eng.fullName}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <AuxiliaryEmpty>Όλοι οι διαθέσιμοι μηχανικοί έχουν προστεθεί ως συμμετέχοντες.</AuxiliaryEmpty>
                              )}
                              {auxiliaryEngineerIds.length > 0 && (
                                <AuxiliaryChips>
                                  {auxiliaryEngineerIds.map((id) => (
                                    <AuxiliaryChip key={id}>
                                      <AuxiliaryChipName title={labelForEngineerId(id)}>
                                        {labelForEngineerId(id)}
                                      </AuxiliaryChipName>
                                      <AuxiliaryChipRemove
                                        type="button"
                                        aria-label={`Αφαίρεση ${labelForEngineerId(id)}`}
                                        onClick={() => toggleAuxiliaryEngineer(id)}
                                      >
                                        ×
                                      </AuxiliaryChipRemove>
                                    </AuxiliaryChip>
                                  ))}
                                </AuxiliaryChips>
                              )}
                            </>
                          )}
                        </AuxiliaryParticipantBlock>
                      </EngineerPickCard>
                    </EngineerPickGrid>
                    <FieldHint style={{ marginTop: '0.5rem' }}>
                      Κύριος/κύρια από το αριστερό μενού· συμμετέχοντες με προσθήκη από τη λίστα (εμφανίζονται ως ετικέτες). Για χρέωση σε άλλη υπηρεσία / ελεύθερο κείμενο, τικάρετε «Χρέωση εκτός μηχανικών».
                    </FieldHint>
                  </>
                ) : (
                  <>
                    <Label>Χρέωση (ελεύθερο κείμενο)</Label>
                    <TextArea
                      value={formData.supervisorChargeFreePrimary}
                      onChange={(e) => handleInputChange('supervisorChargeFreePrimary', e.target.value)}
                      placeholder="π.χ. Υπηρεσία, υπεύθυνος από άλλη υπηρεσία, ονόματα — ό,τι χρειάζεται για τη χρέωση"
                      rows={4}
                      style={{ minHeight: '100px' }}
                    />
                    <FieldHint>
                      Οι επιλογές από τον κατάλογο μηχανικών απενεργοποιούνται για αυτό το υποέργο. Στην κάρτα εμφανίζεται αυτό το
                      κείμενο ως «Χρεωμένο σε».
                    </FieldHint>
                  </>
                )}
              </FormGroup>

              <FormGroup fullWidth cols={3}>
                <Label>Σχόλια</Label>
                <TextArea
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  placeholder="Γενικά σχόλια για το υποέργο..."
                  rows={3}
                />
              </FormGroup>

              <FormGroup fullWidth cols={3}>
                <Label>Εισηγητική Έκθεση</Label>
                <TextArea
                  value={formData.eisigitikiEkthesi || ''}
                  onChange={(e) => handleInputChange('eisigitikiEkthesi', e.target.value)}
                  placeholder="Ελεύθερο κείμενο εισηγητικής έκθεσης..."
                  rows={5}
                  style={{ minHeight: '100px' }}
                />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 5: Στοιχεία Σύμβασης ── */}
          {showContractFields && (
            <Section>
              <SectionTitle>📝 Στοιχεία Σύμβασης</SectionTitle>

              {formData.implementationForm === 'Μια Σύμβαση' ? (
                <>
                  <FormGrid cols={3}>
                    <FormGroup>
                      <Label>Ημερομηνία Υπογραφής *</Label>
                      <Input type="date" value={formData.contractDate} onChange={(e) => handleInputChange('contractDate', e.target.value)} />
                      {errors.contractDate && <ErrorMessage>{errors.contractDate}</ErrorMessage>}
                    </FormGroup>
                    <FormGroup>
                      <Label>Ποσό Σύμβασης *</Label>
                      <Input type="text" value={formData.contractAmount} onChange={(e) => handleInputChange('contractAmount', e.target.value)} onBlur={() => handleAmountBlur('contractAmount')} placeholder="π.χ. 25.254,25" />
                      {errors.contractAmount && <ErrorMessage>{errors.contractAmount}</ErrorMessage>}
                    </FormGroup>
                    <FormGroup>
                      <Label>ΑΠΕ + Συμπληρωματικές *</Label>
                      <Input type="text" value={formData.apeAmount} onChange={(e) => handleInputChange('apeAmount', e.target.value)} onBlur={() => handleAmountBlur('apeAmount')} placeholder="π.χ. 2.500,00" />
                      <Input type="text" value={formData.apeComments} onChange={(e) => handleInputChange('apeComments', e.target.value)} placeholder="Σχόλια ΑΠΕ" style={{ marginTop: '0.4rem' }} />
                      {errors.apeAmount && <ErrorMessage>{errors.apeAmount}</ErrorMessage>}
                    </FormGroup>
                  </FormGrid>
                  <FormGroup fullWidth cols={3}>
                    {renderKhmdhsAdamBlock({
                      adam: formData.khmdhsAdam,
                      snapshot: formData.khmdhsContractSnapshot,
                      fetchedAt: formData.khmdhsContractFetchedAt,
                      errorKey: 'khmdhsAdam',
                      loading: khmdhsFetchLoadingTarget === 'single',
                      onAdamChange: (e) => handleInputChange('khmdhsAdam', e.target.value),
                      onBlur: () => handleFieldBlur('khmdhsAdam'),
                      onFetch: () => handleKhmdhsFetch('single')
                    })}
                  </FormGroup>
                </>
              ) : (
                <ContractsListWrap>
                  {formData.contracts.map((contract, index) => (
                    <ContractPanel key={index}>
                      <ContractPanelTitle>Σύμβαση {index + 1}</ContractPanelTitle>
                      <FormGrid cols={3}>
                        <FormGroup>
                          <Label>Ημερομηνία Υπογραφής</Label>
                          <Input type="date" value={contract.date} onChange={(e) => updateContract(index, 'date', e.target.value)} />
                          {errors[`contractDate${index}`] && <ErrorMessage>{errors[`contractDate${index}`]}</ErrorMessage>}
                        </FormGroup>
                        <FormGroup>
                          <Label>Ποσό Σύμβασης</Label>
                          <Input type="text" value={contract.amount} onChange={(e) => updateContract(index, 'amount', e.target.value)} placeholder="π.χ. 25.254,25" />
                          {errors[`contractAmount${index}`] && <ErrorMessage>{errors[`contractAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                        <FormGroup>
                          <Label>ΑΠΕ + Συμπληρωματικές</Label>
                          <Input type="text" value={contract.apeAmount} onChange={(e) => updateContract(index, 'apeAmount', e.target.value)} placeholder="π.χ. 2.500,00" />
                          <Input type="text" value={contract.comments} onChange={(e) => updateContract(index, 'comments', e.target.value)} placeholder="Σχόλια" style={{ marginTop: '0.4rem' }} />
                          {errors[`apeAmount${index}`] && <ErrorMessage>{errors[`apeAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                      </FormGrid>
                      {renderKhmdhsAdamBlock({
                        adam: contract.khmdhsAdam,
                        snapshot: contract.khmdhsContractSnapshot,
                        fetchedAt: contract.khmdhsContractFetchedAt,
                        errorKey: `khmdhsAdam${index}`,
                        loading: khmdhsFetchLoadingTarget === index,
                        titleSuffix: ` (σύμβαση ${index + 1})`,
                        onAdamChange: (e) => updateContract(index, 'khmdhsAdam', e.target.value),
                        onBlur: () => {
                          const err = getAdamFieldError(
                            sanitizeAdamInput(formData.contracts?.[index]?.khmdhsAdam),
                            'strict'
                          );
                          setErrors((prev) => {
                            const next = { ...prev };
                            const key = `khmdhsAdam${index}`;
                            if (err) next[key] = err;
                            else delete next[key];
                            return next;
                          });
                        },
                        onFetch: () => handleKhmdhsFetch(index)
                      })}
                      <RemoveContractButton onClick={() => removeContract(index)} style={{ marginTop: '0.5rem' }}>Αφαίρεση Σύμβασης</RemoveContractButton>
                    </ContractPanel>
                  ))}
                  <AddContractButton onClick={addContract}>+ Προσθήκη Σύμβασης</AddContractButton>
                </ContractsListWrap>
              )}

              {/* Συμπληρωματικές */}
              <CheckboxContainer style={{ marginTop: '1rem' }}>
                <Checkbox type="checkbox" id="hasSupplementaryContracts" checked={formData.hasSupplementaryContracts} onChange={(e) => handleInputChange('hasSupplementaryContracts', e.target.checked)} />
                <CheckboxLabel htmlFor="hasSupplementaryContracts">Υπάρχει Συμπληρωματική Σύμβαση</CheckboxLabel>
              </CheckboxContainer>

              {formData.hasSupplementaryContracts && (
                <SupplementaryOuter>
                  <SupplementarySectionTitle>Συμπληρωματικές συμβάσεις</SupplementarySectionTitle>
                  {formData.supplementaryContracts.map((contract, index) => (
                    <SupplementaryInner key={index}>
                      <FormGrid cols={3}>
                        <FormGroup>
                          <Label>Ημερομηνία {index + 1}</Label>
                          <Input type="date" value={contract.date} onChange={(e) => updateSupplementaryContract(index, 'date', e.target.value)} />
                        </FormGroup>
                        <FormGroup>
                          <Label>Ποσό {index + 1}</Label>
                          <Input type="text" value={contract.amount} onChange={(e) => updateSupplementaryContract(index, 'amount', e.target.value)} placeholder="π.χ. 5.000,00" />
                        </FormGroup>
                        <FormGroup>
                          <Label>Σχόλια {index + 1}</Label>
                          <Input type="text" value={contract.comments} onChange={(e) => updateSupplementaryContract(index, 'comments', e.target.value)} placeholder="Σχόλια" />
                        </FormGroup>
                      </FormGrid>
                      <RemoveSupplementaryButton onClick={() => removeSupplementaryContract(index)} style={{ marginTop: '0.5rem' }}>Αφαίρεση</RemoveSupplementaryButton>
                    </SupplementaryInner>
                  ))}
                  <AddSupplementaryButton onClick={addSupplementaryContract}>+ Προσθήκη Συμπληρωματικής</AddSupplementaryButton>
                </SupplementaryOuter>
              )}
            </Section>
          )}

          {/* ── SECTION 6: Αρχεία ── */}
          <Section>
            <SectionTitle>📁 Αρχεία Υποέργου</SectionTitle>
            <FileUploadSection onClick={handleFileSelect}>
              <div>
                <FileUploadTitle>Ανέβασμα αρχείων</FileUploadTitle>
                <FileUploadHint>Κλικ εδώ για επιλογή αρχείων (π.χ. PDF, Word). Μπορείτε στη συνέχεια να τα ομαδοποιήσετε σε ομάδες.</FileUploadHint>
              </div>
            </FileUploadSection>

            {formData.fileGroups && formData.fileGroups.length > 0 && (
              <FileList>
                <FileListLabel>Ομάδες αρχείων</FileListLabel>
                {formData.fileGroups.map((group) => (
                  <FileGroupCard key={group.id}>
                    <FileGroupToolbar>
                      <FileGroupTitleBlock>
                        <span aria-hidden>📁</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{group.title}</span>
                        <FileGroupMetaBadge>{group.files.length} αρχείο(α)</FileGroupMetaBadge>
                      </FileGroupTitleBlock>
                      <ToolbarDeleteBtn type="button" onClick={() => removeFileGroup(group.id)}>🗑 Αφαίρεση ομάδας</ToolbarDeleteBtn>
                    </FileGroupToolbar>
                    {group.files.map((file, fileIndex) => (
                      <SmallFileRow key={fileIndex}>
                        <span style={{ fontSize: '0.8rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {file.name}</span>
                        <ToolbarRemoveFileBtn type="button" onClick={() => removeFileFromGroup(group.id, fileIndex)}>Αφαίρεση</ToolbarRemoveFileBtn>
                      </SmallFileRow>
                    ))}
                  </FileGroupCard>
                ))}
              </FileList>
            )}

            {selectedFiles.length > 0 && (
              <FileList>
                <FileListLabel>Αρχεία χωρίς ομαδοποίηση</FileListLabel>
                {selectedFiles.map((file, index) => (
                  <FileItem key={index}>
                    <span style={{ fontSize: '0.88rem', color: '#334155' }}>{file.name}</span>
                    <RemoveContractButton onClick={() => removeFile(index)}>Αφαίρεση</RemoveContractButton>
                  </FileItem>
                ))}
              </FileList>
            )}
          </Section>

        </FormScrollArea>

        <StickyFooter>
          <CancelButton onClick={onClose}>
            ✕ ΑΚΥΡΩΣΗ
          </CancelButton>
          <SaveButton onClick={handleSave}>
            ✓ ΑΠΟΘΗΚΕΥΣΗ
          </SaveButton>
          {editingProject && onDelete && (
            <DeleteFormButton
              onClick={() => onDelete(editingProject.projectId, editingProject.subprojectId)}
            >
              🗑 ΔΙΑΓΡΑΦΗ
            </DeleteFormButton>
          )}
        </StickyFooter>
      </FormContainer>
    </FormOverlay>
  );
}

export default ProjectForm;
