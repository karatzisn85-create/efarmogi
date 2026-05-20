import React, { useState, useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import { safeConfirm } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';
import styled from 'styled-components';
import EntaxisForm from './EntaxisForm';
import ModificationForm from './ModificationForm';
import EntaxisExportDialog from './EntaxisExportDialog';
import EntaxisFileViewer from './EntaxisFileViewer';
import { containsSearchTerm } from '../utils/searchUtils';

const ipcRenderer = window.electronAPI;
const path = require('path-browserify');

const EntaxisOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  padding: 0.65rem 1cm;
  overflow-y: auto;
  box-sizing: border-box;

  @media (min-width: 900px) {
    padding: 0.85rem 1cm;
  }
`;

const EntaxisContainer = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 0;
  width: 100%;
  max-width: 1920px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.95);
  margin-top: 0.35rem;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;

const EntaxisTopSection = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.98);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h2`
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.02em;
  line-height: 1.2;

  &::before {
    content: '';
    width: 3px;
    height: 1.15rem;
    border-radius: 3px;
    background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
    flex-shrink: 0;
  }
`;

const CloseButton = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: #f8fafc;
    color: #0f172a;
    border-color: #94a3b8;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(148, 163, 184, 0.08) 100%);
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  flex-wrap: wrap;
  align-items: center;
`;

const QuickSearchInput = styled.input`
  flex: 1;
  max-width: 280px;
  min-width: 140px;
  padding: 0.45rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SearchBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0.45rem 0 0;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DateInput = styled.input`
  padding: 0.65rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

const SearchButton = styled.button`
  padding: 0.65rem 1.25rem;
  background: #1e293b;
  color: #f8fafc;
  border: 1px solid #334155;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.45rem;

  &:hover {
    background: #334155;
    border-color: #475569;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ClearButton = styled.button`
  padding: 0.65rem 1.25rem;
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.45rem;

  &:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #0f172a;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  user-select: none;

  &:hover {
    border-color: rgba(99, 102, 241, 0.45);
    background: rgba(99, 102, 241, 0.04);
  }

  input[type='checkbox'] {
    margin: 0;
    cursor: pointer;
    accent-color: #4f46e5;
  }

  label {
    margin: 0;
    cursor: pointer;
    font-size: 0.875rem;
    color: #334155;
    font-weight: 500;
  }
`;

const ExportButton = styled.button`
  padding: 0.45rem 0.85rem;
  background: #15803d;
  color: #ffffff;
  border: 1px solid #166534;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;

  &:hover {
    background: #166534;
    border-color: #14532d;
    box-shadow: 0 2px 8px rgba(21, 128, 61, 0.2);
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ToolbarToggleButton = styled.button`
  padding: 0.45rem 0.85rem;
  background: ${(p) => (p.$active ? '#fef2f2' : '#ffffff')};
  color: ${(p) => (p.$active ? '#991b1b' : '#1e293b')};
  border: 1px solid ${(p) => (p.$active ? '#fecaca' : '#cbd5e1')};
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.35rem;

  &:hover {
    background: ${(p) => (p.$active ? '#fee2e2' : '#f8fafc')};
    border-color: ${(p) => (p.$active ? '#f87171' : '#94a3b8')};
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const SearchStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.55rem;
  margin-bottom: 0;
  background: rgba(248, 250, 252, 0.95);
  border-radius: 8px;
  font-size: 0.72rem;
  color: #475569;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;

  .stats-section {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-weight: 500;
  }

  .stat-icon {
    font-size: 0.72rem;
    opacity: 0.75;
  }

  .stat-number {
    color: #4f46e5;
    font-weight: 700;
  }

  .stat-label {
    color: #64748b;
    font-weight: 500;
  }

  .filters-badge {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .filter-icon {
    font-size: 0.68rem;
  }
`;

const ActionButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  ${(props) =>
    props.primary
      ? `
    background: #4f46e5;
    color: #f8fafc;
    border: 1px solid #4338ca;

    &:hover {
      background: #4338ca;
      border-color: #3730a3;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.25);
    }
  `
      : `
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;

    &:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
  `}

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const EntaxisContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.45rem 1.25rem 1rem;
  border-top: 1px solid #e2e8f0;
`;

const NoEntaxisMessage = styled.div`
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: #64748b;
  font-size: 1rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const ProjectGroup = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid ${(props) => (props.isUnlinked ? '#fecaca' : '#e2e8f0')};
  border-radius: 12px;
  background: ${(props) => (props.isUnlinked ? '#fef2f2' : '#f8fafc')};
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const ProjectHeader = styled.div`
  background: ${(props) =>
    props.isUnlinked
      ? 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)'
      : 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)'};
  color: #f8fafc;
  padding: 0.9rem 1.25rem;
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.02em;
`;

const EntaxisList = styled.div`
  padding: 1rem;
`;

const EntaxisItem = styled.div`
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 1rem;
  overflow: hidden;
  position: relative;
  opacity: ${(props) => (props.isLocked ? 0.72 : 1)};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
`;

const LockIndicator = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${(props) => (props.isLocked ? '#b91c1c' : '#15803d')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2);
  z-index: 10;
  border: 2px solid #ffffff;
`;

const EntaxisHeader = styled.div`
  background: ${(props) => (props.isMain ? '#f8fafc' : '#fffbeb')};
  padding: 1.25rem 1.35rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
`;

const EntaxisInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
`;

const EntaxisTitle = styled.div`
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${(props) => (props.isMain ? '#2563eb' : '#d97706')};
    flex-shrink: 0;
  }
`;

const EntaxisSubject = styled.div`
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.45;
  padding: 0.75rem 0.9rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #6366f1;
  border-radius: 8px;
  margin: 0.25rem 0;
`;

const EntaxisMetadata = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.5rem;
  margin-top: 0.35rem;
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.875rem;
  padding: 0.35rem 0;

  .icon {
    font-size: 0.95rem;
    opacity: 0.72;
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  .label {
    color: #64748b;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
    font-size: 0.8rem;
  }

  .value {
    color: #1e293b;
    font-weight: 600;
    word-break: break-word;
    line-height: 1.4;
  }
`;

const EntaxisDetails = styled.div`
  font-size: 0.875rem;
  color: #64748b;
`;

const EntaxisAmount = styled.div`
  font-size: 1.05rem;
  font-weight: 600;
  color: ${(props) =>
    props.positive ? '#15803d' : props.negative ? '#b91c1c' : '#1d4ed8'};
`;

const EntaxisActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SmallButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-family: inherit;

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  ${(props) => {
    if (props.$filesPrimary) {
      return `
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #f8fafc;
      border: 1px solid #3730a3;
      font-weight: 700;
      letter-spacing: 0.04em;
      box-shadow: 0 2px 10px rgba(67, 56, 202, 0.35);
      &:hover {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        border-color: #6366f1;
        box-shadow: 0 4px 16px rgba(79, 70, 229, 0.45);
      }
      &:active {
        background: #4338ca;
      }
    `;
    }
    if (props.view) {
      return `
      background: #ffffff;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      &:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
    `;
    }
    if (props.edit) {
      return `
      background: #ecfdf5;
      color: #14532d;
      border: 1px solid #86efac;
      &:hover {
        background: #dcfce7;
        border-color: #4ade80;
      }
    `;
    }
    if (props.delete) {
      return `
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
      &:hover {
        background: #fee2e2;
        border-color: #f87171;
      }
    `;
    }
    return `
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      &:hover {
        background: #334155;
        border-color: #475569;
      }
    `;
  }}
`;

const ModificationsList = styled.div`
  padding: 1rem 1.25rem;
`;

const ModificationItem = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CommentsModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 1rem;
`;

const CommentsModalPanel = styled.div`
  background: rgba(255, 255, 255, 0.98);
  border-radius: 14px;
  padding: 1.75rem;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28);
  border: 1px solid #e2e8f0;
`;

const CommentsModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const CommentsModalTitle = styled.h3`
  margin: 0;
  color: #1e293b;
  font-size: 1.1rem;
  font-weight: 700;
`;

const CommentsModalBody = styled.div`
  font-size: 0.95rem;
  line-height: 1.65;
  color: #334155;
  white-space: pre-wrap;
`;

const CommentsModalClose = styled.button`
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;

  &:hover {
    background: #f8fafc;
    color: #0f172a;
  }
`;

const EntaxisActionsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 200px;
`;

const CommentsCallout = styled(EntaxisDetails)`
  margin-top: 0.8rem;
  padding: 0.65rem 0.85rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 3px solid #f59e0b;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const CommentsCalloutLabel = styled.span`
  font-weight: 600;
  color: #92400e;
`;

const CommentsCalloutText = styled.span`
  margin-left: 0.5rem;
  color: #334155;
`;

const ProsklisiLinkText = styled.span`
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 0.5rem;
  font-weight: 600;

  &:hover {
    color: #1d4ed8;
  }

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

const InlineTextButton = styled.button`
  background: #ffffff;
  color: #1e40af;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
  }
`;

const EmptyStateHint = styled.div`
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #64748b;
`;

// ΧΕΙΡΟΚΙΝΗΤΗ ΔΙΟΡΘΩΣΗ - Καλέστε από Console: fixAllEntaxeis()
window.fixAllEntaxeis = async () => {
  const ipc = window.electronAPI;
  try {
    console.log('🔧 Loading all entaxeis...');
    const allEntaxeis = await ipc.invoke('load-all-entaxeis');
    console.log(`📋 Found ${allEntaxeis.length} entaxeis`);
    
    for (const entaxi of allEntaxeis) {
      console.log(`🔧 Fixing ${entaxi.entaxiId}...`);
      const result = await ipc.invoke('fix-entaxi-file-objects', entaxi.entaxiId);
      console.log(`  ${result.success ? '✅' : '❌'} ${result.message || result.error}`);
    }
    
    alert('✅ Όλες οι εντάξεις διορθώθηκαν! Κάντε F5 για refresh.');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Σφάλμα: ' + error.message);
  }
};

function EntaxisManager({ isOpen, onClose, userRole, projectFilter = null, onDataChange, proskliseis = [], handleOpenProsklisi, onViewFile }) {
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [entaxeis, setEntaxeis] = useState([]);
  const [filteredEntaxeis, setFilteredEntaxeis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [editingEntaxi, setEditingEntaxi] = useState(null);
  const [selectedEntaxiForMod, setSelectedEntaxiForMod] = useState(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [editingModification, setEditingModification] = useState(null);
  const [selectedModification, setSelectedModification] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [entaxisLocks, setEntaxisLocks] = useState({});
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedEntaxiForViewer, setSelectedEntaxiForViewer] = useState(null);
  
  // Search state
  const [searchFilters, setSearchFilters] = useState({
    subject: '',
    fundingAuthority: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: '',
    projectTitle: '',
    showUnlinkedOnly: false
  });
  
  // Quick search state
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEntaxeis();
      lockBodyScroll('entaxis');
    }
    return () => {
      unlockBodyScroll('entaxis');
    };
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [entaxeis, searchFilters, projectFilter, quickSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (entaxeis.length > 0) {
      loadEntaxisLocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entaxeis]);

  // Realtime lock monitoring για entaxeis - αθόρυβο με βελτιστοποίηση
  useEffect(() => {
    if (!isOpen) return;

    let isActive = true;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      setEntaxeis(currentEntaxeis => {
        if (!currentEntaxeis || currentEntaxeis.length === 0) return currentEntaxeis;
        
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < currentEntaxeis.length; i += BATCH_SIZE) {
          batches.push(currentEntaxeis.slice(i, i + BATCH_SIZE));
        }
        
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const batchLocks = {};
            await Promise.all(
              batch.map(async (entaxi) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                  batchLocks[entaxi.entaxiId] = lockStatus.locked;
                } catch (error) {
                  setEntaxisLocks(prevLocks => {
                    batchLocks[entaxi.entaxiId] = prevLocks[entaxi.entaxiId] || false;
                    return prevLocks;
                  });
                }
              })
            );
            return batchLocks;
          })
        ).then(batchResults => {
          if (!isActive) return;
          
          const newLocks = Object.assign({}, ...batchResults);
          setEntaxisLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => 
              newLocks[id] !== prevLocks[id]
            );
            
            if (hasChanges) {
              console.log('Entaxi lock changes detected, updating silently...');
              return newLocks;
            }
            return prevLocks;
          });
        }).catch(error => {
          console.error('Error checking entaxi locks:', error);
        });
        
        return currentEntaxeis;
      });
    };
    
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      checkLocks();
      
      intervalId = setInterval(() => {
        if (isActive) {
          checkLocks();
        }
      }, 8000);
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEntaxeis = async () => {
    try {
      setLoading(true);
      const loadedEntaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      console.log('Loaded entaxeis:', loadedEntaxeis); // Debug log
      setEntaxeis(loadedEntaxeis || []);
    } catch (error) {
      console.error('Error loading entaxeis:', error);
      setEntaxeis([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadEntaxisLocks = async () => {
    try {
      const locks = {};
      for (const entaxi of entaxeis) {
        const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
        locks[entaxi.entaxiId] = lockStatus.locked || false;
      }
      setEntaxisLocks(locks);
    } catch (error) {
      console.error('Error loading entaxis locks:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...entaxeis];

    // Project filter (if provided)
    if (projectFilter) {
      filtered = filtered.filter(entaxi => 
        entaxi.projectTitle === projectFilter
      );
    }

    // Quick search filter (searches in title/subject)
    if (quickSearchTerm) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, quickSearchTerm) ||
        containsSearchTerm(entaxi.projectTitle, quickSearchTerm)
      );
    }

    // Search filters
    if (searchFilters.subject) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.subject, searchFilters.subject)
      );
    }

    if (searchFilters.fundingAuthority) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.fundingAuthority, searchFilters.fundingAuthority)
      );
    }

    if (searchFilters.projectTitle) {
      filtered = filtered.filter(entaxi => 
        containsSearchTerm(entaxi.projectTitle, searchFilters.projectTitle)
      );
    }

    // Amount filters
    if (searchFilters.minAmount) {
      const minAmount = parseFloat(searchFilters.minAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount >= minAmount;
      });
    }

    if (searchFilters.maxAmount) {
      const maxAmount = parseFloat(searchFilters.maxAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(entaxi => {
        const amount = parseFloat(entaxi.initialAmount?.replace(/[^\d.,]/g, '').replace(',', '.') || 0);
        return amount <= maxAmount;
      });
    }

    // Date filters
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      filtered = filtered.filter(entaxi => {
        const entaxiDate = new Date(entaxi.documentDate);
        return entaxiDate >= fromDate;
      });
    }

    // Unlinked entaxeis filter
    if (searchFilters.showUnlinkedOnly) {
      filtered = filtered.filter(entaxi => {
        // Check if entaxi is not linked to any project
        return !entaxi.projectTitle || entaxi.projectTitle === '' || 
               (!entaxi.subprojectIds || entaxi.subprojectIds.length === 0);
      });
    }

    setFilteredEntaxeis(filtered);
  };

  const handleSearchChange = (field, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchFilters({
      subject: '',
      fundingAuthority: '',
      minAmount: '',
      maxAmount: '',
      dateFrom: '',
      projectTitle: '',
      showUnlinkedOnly: false
    });
    setQuickSearchTerm('');
  };

  // Συνάρτηση για κλείσιμο του modal με καθαρισμό φίλτρων
  const handleClose = () => {
    clearFilters(); // Καθαρισμός όλων των φίλτρων
    onClose(); // Κλείσιμο του modal
  };

  const getActiveFiltersCount = () => {
    return Object.entries(searchFilters).filter(([key, value]) => {
      if (key === 'showUnlinkedOnly') {
        return value === true;
      }
      return value !== '';
    }).length;
  };

  const handleSaveEntaxi = async (entaxiData) => {
    try {
      await ipcRenderer.invoke('save-entaxi', entaxiData);
      
      await loadEntaxeis();
      setIsFormOpen(false);
      setEditingEntaxi(null);
      if (onDataChange) {
        onDataChange();
      }
    } catch (error) {
      console.error('Error saving entaxi:', error);
      alert('Σφάλμα αποθήκευσης ένταξης: ' + error.message);
    } finally {
      if (editingEntaxi && editingEntaxi.entaxiId) {
        try {
          await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
          setEntaxisLocks(prev => ({
            ...prev,
            [editingEntaxi.entaxiId]: false
          }));
        } catch (lockErr) {
          console.error('Error removing lock:', lockErr);
        }
      }
    }
  };

  const handleSaveModification = async (modificationData) => {
    try {
      await ipcRenderer.invoke('save-modification', selectedEntaxiForMod.entaxiId, modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την αποθήκευση τροποποίησης
      if (selectedEntaxiForMod && selectedEntaxiForMod.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [selectedEntaxiForMod.entaxiId]: false
        }));
      }
      
      await loadEntaxeis();
      setIsModificationFormOpen(false);
      setSelectedEntaxiForMod(null);
    } catch (error) {
      console.error('Error saving modification:', error);
    }
  };

  const handleDeleteEntaxi = async (entaxiId) => {
    if (await showConfirm({ title: 'Διαγραφή Ένταξης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την ένταξη;', detail: 'Η ενέργεια είναι μη αναστρέψιμη.', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        await ipcRenderer.invoke('delete-entaxi', entaxiId);
        await loadEntaxeis();
        // Ανανέωση των κυρίως έργων στο Dashboard
        if (onDataChange) {
          onDataChange();
        }
      } catch (error) {
        console.error('Error deleting entaxi:', error);
      }
    }
  };

  const handleViewFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      console.log('Viewing file:', { entaxiId, actualFileName, originalFileName: fileName });
      
      // Use the same method as proskliseis - direct file opening
      await ipcRenderer.invoke('view-entaxi-file', entaxiId, actualFileName);
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Σφάλμα κατά την προβολή του αρχείου: ' + error.message);
    }
  };

  const handleOpenFileViewer = (entaxi) => {
    setSelectedEntaxiForViewer(entaxi);
    setFileViewerOpen(true);
  };

  const handleCloseFileViewer = () => {
    setFileViewerOpen(false);
    setSelectedEntaxiForViewer(null);
  };

  const handleDownloadFile = async (entaxiId, fileName) => {
    try {
      // Handle both string and object fileName
      const actualFileName = typeof fileName === 'string' ? fileName : fileName.fileName;
      const result = await ipcRenderer.invoke('download-entaxi-file', entaxiId, actualFileName);
      
      if (result.success) {
        alert('Το αρχείο λήφθηκε επιτυχώς!');
      } else if (result.error !== 'Download cancelled') {
        alert('Σφάλμα κατά τη λήψη του αρχείου: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Σφάλμα κατά τη λήψη του αρχείου: ' + error.message);
    }
  };

  const handleDeleteFile = async (entaxiId, fileName, isModification = false) => {
    // Handle both string and object fileName
    let actualFileName;
    if (typeof fileName === 'string') {
      actualFileName = fileName;
    } else if (fileName && typeof fileName === 'object') {
      console.log('⚠️ fileName is object, fixing entaxi first...');
      // Fix the entaxi JSON first
      const fixResult = await ipcRenderer.invoke('fix-entaxi-file-objects', entaxiId);
      console.log('🔧 Fix result:', fixResult);
      
      // Reload entaxeis to get the fixed data
      await loadEntaxeis();
      
      // Extract filename from object for display
      actualFileName = fileName.fileName || fileName.name || path.basename(fileName.filePath || '');
      alert(`Τα δεδομένα διορθώθηκαν. Παρακαλώ πατήστε Διαγραφή ξανά.`);
      return;
    } else {
      console.error('❌ Invalid fileName:', fileName);
      alert('Σφάλμα: Μη έγκυρο όνομα αρχείου');
      return;
    }
    
    console.log('🗑️ DELETE FILE REQUEST:', {
      entaxiId,
      fileName,
      actualFileName,
      isModification,
      fileNameType: typeof fileName
    });
    
    if (await showConfirm({ title: 'Διαγραφή Αρχείου', message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${actualFileName}";`, confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        console.log('📤 Sending delete request to backend...');
        const result = await ipcRenderer.invoke('delete-entaxi-file', entaxiId, actualFileName, isModification);
        console.log('📥 Delete result:', result);
        
        if (result.success) {
          console.log('✅ Delete successful, reloading entaxeis...');
          await loadEntaxeis(); // Reload to update UI
          console.log('✅ Entaxeis reloaded');
          alert('Το αρχείο διαγράφηκε επιτυχώς!');
        } else {
          console.error('❌ Delete failed:', result.error);
          alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + result.error);
        }
      } catch (error) {
        console.error('❌ Error deleting file:', error);
        alert('Σφάλμα κατά τη διαγραφή του αρχείου: ' + error.message);
      }
    }
  };

  const handleEditModification = (modification, parentEntaxi) => {
    setEditingModification({
      ...modification,
      entaxiId: parentEntaxi.entaxiId,
      subject: parentEntaxi.subject,
      fundingAuthority: parentEntaxi.fundingAuthority,
      initialAmount: parentEntaxi.initialAmount
    });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (entaxiId, modificationId) => {
    if (await showConfirm({ title: 'Διαγραφή Τροποποίησης', message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;', confirmLabel: 'Διαγραφή', icon: '🗑' })) {
      try {
        await ipcRenderer.invoke('delete-entaxi-modification', entaxiId, modificationId);
        await loadEntaxeis(); // Reload to update UI
        alert('Η τροποποίηση διαγράφηκε επιτυχώς');
      } catch (error) {
        console.error('Error deleting modification:', error);
        alert('Σφάλμα διαγραφής τροποποίησης: ' + error.message);
      }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-entaxi-modification', modificationData);
      
      // Ξεκλείδωμα της ένταξης μετά την ενημέρωση τροποποίησης
      if (editingModification && editingModification.entaxiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingModification.entaxiId);
        // Άμεση ενημέρωση του UI
        setEntaxisLocks(prev => ({
          ...prev,
          [editingModification.entaxiId]: false
        }));
      }
      
      await loadEntaxeis(); // Reload to update UI
      setEditingModification(null);
      setIsModificationFormOpen(false);
    } catch (error) {
      console.error('Error updating modification:', error);
      alert('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message);
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '0,00';
    return amount.toString().replace(/\./g, ',');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getProsklisiTitle = (prosklisiId) => {
    const prosklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    return prosklisi ? prosklisi.title : 'Άγνωστη πρόσκληση';
  };

  const calculateCumulativeAmount = (entaxi) => {
    let total = parseFloat((entaxi.initialAmount || '0').replace(/\./g, '').replace(',', '.')) || 0;

    if (entaxi.modifications && Array.isArray(entaxi.modifications)) {
      entaxi.modifications.forEach((mod) => {
        const rawAmount = (mod.amount || '0').replace(/[^\d,.+-]/g, '').replace(/\./g, '').replace(',', '.');
        const modAmount = parseFloat(rawAmount) || 0;

        // Αν η τροποποίηση είναι απόλυτου ποσού (mod.changeAmount true) αντικαθιστούμε το σύνολο
        // Διαφορετικά, θεωρούμε ότι είναι μεταβολή (delta) και το προσθέτουμε στο σύνολο
        if (mod.changeAmount) {
          total = modAmount;
        } else {
          total += modAmount;
        }
      });
    }

    return total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group filtered entaxeis by project
  const groupedEntaxeis = filteredEntaxeis.reduce((groups, entaxi) => {
    const key = entaxi.projectTitle || 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entaxi);
    return groups;
  }, {});

  if (!isOpen) return null;

  return (
    <EntaxisOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <EntaxisContainer>
        <EntaxisTopSection>
        <Header>
          <Title>Εντάξεις Έργων</Title>
          <CloseButton type="button" onClick={handleClose}>Κλείσιμο</CloseButton>
        </Header>

        <ActionsBar>
          {canManageWorkflow && (
            <ActionButton
              type="button"
              primary
              onClick={() => {
                setEditingEntaxi(null);
                setIsFormOpen(true);
              }}
            >
              ➕ Νέα Ένταξη
            </ActionButton>
          )}
          <ExportButton type="button" onClick={() => setIsExportDialogOpen(true)}>
            📊 Εξαγωγή σε Excel
          </ExportButton>
          <QuickSearchInput
            type="text"
            placeholder="🔍 Γρήγορη αναζήτηση τίτλου ένταξης..."
            value={quickSearchTerm}
            onChange={(e) => setQuickSearchTerm(e.target.value)}
          />
          <ToolbarToggleButton
            type="button"
            $active={showAdvancedSearch}
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            🔍 {showAdvancedSearch ? 'ΑΠΟΚΡΥΨΗ ΦΙΛΤΡΩΝ' : 'ΣΥΝΘΕΤΗ ΑΝΑΖΗΤΗΣΗ'}
          </ToolbarToggleButton>
        </ActionsBar>

        {/* Στατιστικά - Εμφανίζονται πάντα */}
        <SearchStats>
          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-icon">📊</span>
              <span className="stat-label">Συνολικά:</span>
              <span className="stat-number">{entaxeis.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🔗</span>
              <span className="stat-label">Συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => e.projectTitle && e.projectTitle.trim() !== '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">❌</span>
              <span className="stat-label">Μη συσχετισμένες:</span>
              <span className="stat-number">{entaxeis.filter(e => !e.projectTitle || e.projectTitle.trim() === '').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">📅</span>
              <span className="stat-label">{new Date().getFullYear()}:</span>
              <span className="stat-number">{entaxeis.filter(e => {
                if (!e.documentDate) return false;
                const entaxiYear = new Date(e.documentDate).getFullYear();
                return entaxiYear === new Date().getFullYear();
              }).length}</span>
            </div>
          </div>
          <div>
            {getActiveFiltersCount() > 0 && (
              <div className="filters-badge">
                <span className="filter-icon">🔧</span>
                <span>Φίλτρα: {getActiveFiltersCount()}</span>
              </div>
            )}
          </div>
        </SearchStats>

        {showAdvancedSearch && (
          <SearchBar>
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά θέμα..."
                value={searchFilters.subject}
                onChange={(e) => handleSearchChange('subject', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά φορέα χρηματοδότησης..."
                value={searchFilters.fundingAuthority}
                onChange={(e) => handleSearchChange('fundingAuthority', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Αναζήτηση κατά τίτλο έργου..."
                value={searchFilters.projectTitle}
                onChange={(e) => handleSearchChange('projectTitle', e.target.value)}
              />
            </SearchRow>
            
            <SearchRow>
              <SearchInput
                type="text"
                placeholder="Ελάχιστο ποσό (€)..."
                value={searchFilters.minAmount}
                onChange={(e) => handleSearchChange('minAmount', e.target.value)}
              />
              <SearchInput
                type="text"
                placeholder="Μέγιστο ποσό (€)..."
                value={searchFilters.maxAmount}
                onChange={(e) => handleSearchChange('maxAmount', e.target.value)}
              />
              <DateInput
                type="date"
                placeholder="Από ημερομηνία..."
                value={searchFilters.dateFrom}
                onChange={(e) => handleSearchChange('dateFrom', e.target.value)}
              />
              <SearchButton type="button" onClick={() => applyFilters()}>
                🔍 Αναζήτηση
              </SearchButton>
              <ClearButton type="button" onClick={clearFilters}>
                🗑️ Καθαρισμός
              </ClearButton>
            </SearchRow>

            <SearchRow>
              <CheckboxContainer 
                onClick={() => handleSearchChange('showUnlinkedOnly', !searchFilters.showUnlinkedOnly)}
              >
                <input
                  type="checkbox"
                  checked={searchFilters.showUnlinkedOnly}
                  onChange={(e) => handleSearchChange('showUnlinkedOnly', e.target.checked)}
                />
                <label>Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο</label>
              </CheckboxContainer>
            </SearchRow>
          </SearchBar>
        )}
        </EntaxisTopSection>

        <EntaxisContent>
          {loading ? (
            <NoEntaxisMessage>
              Φόρτωση εντάξεων...
            </NoEntaxisMessage>
          ) : filteredEntaxeis.length === 0 || Object.keys(groupedEntaxeis).length === 0 ? (
            <NoEntaxisMessage>
              {projectFilter 
                ? `Δεν βρέθηκαν εντάξεις για το έργο "${projectFilter}".`
                : "Δεν βρέθηκαν εντάξεις έργων."
              }
              {canManageWorkflow && !projectFilter && (
                <EmptyStateHint>
                  Πατήστε "Νέα Ένταξη" για να προσθέσετε την πρώτη ένταξη.
                </EmptyStateHint>
              )}
            </NoEntaxisMessage>
          ) : (
            Object.entries(groupedEntaxeis)
              .sort(([a], [b]) => {
                // Ταξινόμηση: οι μη συσχετισμένες εντάξεις πρώτα
                const aIsUnlinked = a === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                const bIsUnlinked = b === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                if (aIsUnlinked && !bIsUnlinked) return -1;
                if (!aIsUnlinked && bIsUnlinked) return 1;
                return a.localeCompare(b);
              })
              .map(([projectTitle, projectEntaxeis]) => {
                const isUnlinked = projectTitle === 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';
                return (
                  <ProjectGroup key={projectTitle} isUnlinked={isUnlinked}>
                    <ProjectHeader isUnlinked={isUnlinked}>{projectTitle}</ProjectHeader>
                <EntaxisList>
                  {projectEntaxeis.map(entaxi => (
                    <EntaxisItem 
                      key={entaxi.entaxiId}
                      isLocked={entaxisLocks[entaxi.entaxiId]}
                    >
                      <LockIndicator isLocked={entaxisLocks[entaxi.entaxiId]}>
                        {entaxisLocks[entaxi.entaxiId] ? '🔒' : '🔓'}
                      </LockIndicator>
                      <EntaxisHeader isMain>
                        <EntaxisInfo>
                          <EntaxisTitle isMain>
                            Αρχική Ένταξη
                          </EntaxisTitle>
                          
                          {/* ΘΕΜΑ ΕΝΤΑΞΗΣ - ΚΥΡΙΟ ΣΤΟΙΧΕΙΟ */}
                          <EntaxisSubject>
                            {entaxi.subject}
                          </EntaxisSubject>
                          
                          {/* METADATA ΣΕ GRID */}
                          <EntaxisMetadata>
                            <MetadataItem>
                              <span className="icon">📅</span>
                              <span className="label">Ημερομηνία:</span>
                              <span className="value">{formatDate(entaxi.documentDate)}</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">🏛️</span>
                              <span className="label">Φορέας Χρημ/σης:</span>
                              <span className="value">{entaxi.fundingAuthority}</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">💰</span>
                              <span className="label">Ποσό Ένταξης:</span>
                              <span className="value">{formatAmount(entaxi.initialAmount)} €</span>
                            </MetadataItem>
                            
                            <MetadataItem>
                              <span className="icon">📊</span>
                              <span className="label">Διαμορφωθέν Ποσό:</span>
                              <span className="value" style={{ color: '#15803d', fontWeight: 700 }}>
                                {calculateCumulativeAmount(entaxi)} €
                              </span>
                            </MetadataItem>
                          </EntaxisMetadata>
                          
                          {/* ΣΧΟΛΙΑ */}
                          {entaxi.comments && entaxi.comments.trim() !== '' && (
                            <CommentsCallout>
                              <CommentsCalloutLabel>Σχόλια:</CommentsCalloutLabel>
                              <CommentsCalloutText>{entaxi.comments}</CommentsCalloutText>
                            </CommentsCallout>
                          )}
                          
                          {/* ΣΥΣΧΕΤΙΣΗ ΜΕ ΠΡΟΣΚΛΗΣΗ */}
                          {entaxi.prosklisiId && (
                            <EntaxisDetails style={{ marginTop: '0.5rem' }}>
                              Συσχετισμένη πρόσκληση:
                              <ProsklisiLinkText
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (handleOpenProsklisi) {
                                    onClose();
                                    setTimeout(() => {
                                      handleOpenProsklisi(entaxi.prosklisiId);
                                    }, 300);
                                  }
                                }}
                              >
                                {getProsklisiTitle(entaxi.prosklisiId)}
                              </ProsklisiLinkText>
                            </EntaxisDetails>
                          )}
                        </EntaxisInfo>
                        
                        {/* ACTIONS SIDEBAR */}
                        <EntaxisActionsColumn>
                          <SmallButton
                            type="button"
                            $filesPrimary
                            onClick={() => handleOpenFileViewer(entaxi)}
                            style={{ width: '100%' }}
                          >
                            Προβολή Αρχείων
                          </SmallButton>

                          {/* ΕΝΕΡΓΕΙΕΣ ΔΙΑΧΕΙΡΙΣΗΣ */}
                          {canManageWorkflow && (
                            <>
                              <SmallButton 
                                onClick={async () => {
                                  // Έλεγχος αν η ένταξη είναι κλειδωμένη
                                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (lockStatus.locked) {
                                    alert('Η ένταξη είναι υπό επεξεργασία από άλλον διαχειριστή!');
                                    return;
                                  }

                                  // Δημιουργία lock για την ένταξη
                                  const lockResult = await ipcRenderer.invoke('create-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (!lockResult.success) {
                                    alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
                                    return;
                                  }

                                  // Άμεση ενημέρωση του UI για να δείξει το lock
                                  setEntaxisLocks(prev => ({
                                    ...prev,
                                    [entaxi.entaxiId]: true
                                  }));

                                  setSelectedEntaxiForMod(entaxi);
                                  setIsModificationFormOpen(true);
                                }}
                                style={{ width: '100%' }}
                              >
                                ⚡ Νέα Τροποποίηση
                              </SmallButton>
                              <SmallButton 
                                edit 
                                onClick={async () => {
                                  // Έλεγχος αν η ένταξη είναι κλειδωμένη
                                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (lockStatus.locked) {
                                    alert('Η ένταξη είναι υπό επεξεργασία από άλλον διαχειριστή!');
                                    return;
                                  }

                                  // Δημιουργία lock για την ένταξη
                                  const lockResult = await ipcRenderer.invoke('create-entity-lock', 'entaxeis', entaxi.entaxiId);
                                  if (!lockResult.success) {
                                    alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
                                    return;
                                  }

                                  // Άμεση ενημέρωση του UI για να δείξει το lock
                                  setEntaxisLocks(prev => ({
                                    ...prev,
                                    [entaxi.entaxiId]: true
                                  }));

                                  setEditingEntaxi(entaxi);
                                  setIsFormOpen(true);
                                }}
                                style={{ width: '100%' }}
                              >
                                ✏️ Επεξεργασία
                              </SmallButton>
                              <SmallButton 
                                delete 
                                onClick={() => handleDeleteEntaxi(entaxi.entaxiId)}
                                style={{ width: '100%' }}
                              >
                                🗑️ Διαγραφή
                              </SmallButton>
                            </>
                          )}
                        </EntaxisActionsColumn>
                      </EntaxisHeader>

                      {entaxi.modifications && entaxi.modifications.length > 0 && (
                        <ModificationsList>
                          {entaxi.modifications.map((mod, index) => (
                            <ModificationItem key={mod.modificationId || index}>
                              <div>
                                <EntaxisTitle>
                                  {index + 1}η Τροποποίηση
                                </EntaxisTitle>
                                <EntaxisDetails>
                                  📅 {formatDate(mod.date)} | 📝 {mod.comments ? (mod.comments.length > 50 ? mod.comments.substring(0, 50) + '...' : mod.comments) : 'Χωρίς σχόλια'}
                                  {mod.comments && mod.comments.length > 50 && (
                                    <InlineTextButton
                                      type="button"
                                      onClick={() => setSelectedModification(mod)}
                                    >
                                      Δες περισσότερα
                                    </InlineTextButton>
                                  )}
                                </EntaxisDetails>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <EntaxisAmount 
                                  positive={mod.amount.includes('+')} 
                                  negative={mod.amount.includes('-')}
                                >
                                  {formatAmount(mod.amount)} €
                                </EntaxisAmount>
                                <EntaxisActions style={{ marginTop: '0.3rem' }}>
                                  {mod.modificationPDF && (
                                    <>
                                      <SmallButton 
                                        view 
                                        onClick={() => handleViewFile(entaxi.entaxiId, mod.modificationPDF)}
                                      >
                                        👁️ Τροποποίηση
                                      </SmallButton>
                                      <SmallButton 
                                        onClick={() => handleDownloadFile(entaxi.entaxiId, mod.modificationPDF)}
                                      >
                                        📥 Λήψη
                                      </SmallButton>
                                      {canManageWorkflow && (
                                        <>
                                          <SmallButton 
                                            edit 
                                            onClick={() => handleEditModification(mod, entaxi)}
                                          >
                                            ✏️ Επεξεργασία
                                          </SmallButton>
                                          <SmallButton 
                                            delete 
                                            onClick={() => handleDeleteModification(entaxi.entaxiId, mod.modificationId)}
                                          >
                                            🗑️ Διαγραφή
                                          </SmallButton>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {mod.approvalPDF && (
                                    <>
                                      <SmallButton 
                                        view 
                                        onClick={() => handleViewFile(entaxi.entaxiId, mod.approvalPDF)}
                                      >
                                        📋 Αποδοχή
                                      </SmallButton>
                                      <SmallButton 
                                        onClick={() => handleDownloadFile(entaxi.entaxiId, mod.approvalPDF)}
                                      >
                                        📥 Λήψη
                                      </SmallButton>
                                      <SmallButton 
                                        delete 
                                        onClick={() => handleDeleteFile(entaxi.entaxiId, mod.approvalPDF, true)}
                                      >
                                        🗑️ Διαγραφή
                                      </SmallButton>
                                    </>
                                  )}
                                </EntaxisActions>
                              </div>
                            </ModificationItem>
                          ))}
                        </ModificationsList>
                      )}
                    </EntaxisItem>
                  ))}
                </EntaxisList>
              </ProjectGroup>
                );
              })
          )}
        </EntaxisContent>

        {/* Entaxi Form Modal */}
        <EntaxisForm
          isOpen={isFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (editingEntaxi) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', editingEntaxi.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [editingEntaxi.entaxiId]: false
              }));
            }
            setIsFormOpen(false);
            setEditingEntaxi(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveEntaxi}
          editingEntaxi={editingEntaxi}
        />

        {/* Modification Form Modal */}
        <ModificationForm
          isOpen={isModificationFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης ένταξης
            if (selectedEntaxiForMod) {
              await ipcRenderer.invoke('remove-entity-lock', 'entaxeis', selectedEntaxiForMod.entaxiId);
              // Άμεση ενημέρωση του UI
              setEntaxisLocks(prev => ({
                ...prev,
                [selectedEntaxiForMod.entaxiId]: false
              }));
            }
            setIsModificationFormOpen(false);
            setSelectedEntaxiForMod(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadEntaxeis();
          }}
          onSave={handleSaveModification}
          entaxi={selectedEntaxiForMod}
        />

        {/* Modification Edit Modal */}
        {editingModification && (
          <ModificationForm
            isOpen={!!editingModification}
            onClose={async () => {
              // Καθάρισε όλα τα locks όταν κλείνει η φόρμα επεξεργασίας τροποποίησης
              await ipcRenderer.invoke('clear-all-locks');
              setEditingModification(null);
              // Ανανέωση για να ενημερωθεί το lock status
              await loadEntaxeis();
            }}
            onSave={handleSaveModificationEdit}
            entaxi={editingModification}
            isEditMode={true}
          />
        )}

        {/* Export Dialog Modal */}
        <EntaxisExportDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          entaxeis={filteredEntaxeis}
          totalEntaxeis={entaxeis.length}
        />

        {/* Comments Modal */}
        {selectedModification && (
          <CommentsModalOverlay onClick={() => setSelectedModification(null)}>
            <CommentsModalPanel onClick={(e) => e.stopPropagation()}>
              <CommentsModalHeader>
                <CommentsModalTitle>Σχόλια Τροποποίησης</CommentsModalTitle>
                <CommentsModalClose type="button" onClick={() => setSelectedModification(null)}>
                  Κλείσιμο
                </CommentsModalClose>
              </CommentsModalHeader>
              <CommentsModalBody>
                {selectedModification.comments || 'Δεν υπάρχουν σχόλια για αυτή την τροποποίηση.'}
              </CommentsModalBody>
            </CommentsModalPanel>
          </CommentsModalOverlay>
        )}
      </EntaxisContainer>

      {/* File Viewer Modal */}
      {fileViewerOpen && (
        <EntaxisFileViewer
          isOpen={fileViewerOpen}
          onClose={handleCloseFileViewer}
          entaxi={selectedEntaxiForViewer}
          userRole={userRole}
        />
      )}
    </EntaxisOverlay>
  );
}

export default EntaxisManager;
