import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import SubprojectSearchModal from './SubprojectSearchModal';
import { safeConfirm } from '../utils/safeDialogs';

const ipcRenderer = window.electronAPI;

const PanelOverlay = styled.div`
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
  padding: 0.65rem 1cm;
  z-index: 9999;
  overflow-y: auto;
  box-sizing: border-box;

  @media (min-width: 900px) {
    padding: 0.85rem 1cm;
  }
`;

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1920px;
  max-height: 94vh;
  min-height: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.95);
  overflow: hidden;
  margin-top: 0.35rem;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;

const PanelContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #ffffff;
`;

const PanelHeader = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 0.65rem;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h2`
  margin: 0;
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 700;
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

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
`;

const HeaderButton = styled.button`
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

  ${(p) =>
    p.$primary
      ? `
    background: #4f46e5;
    color: #f8fafc;
    border: 1px solid #4338ca;
    &:hover {
      background: #4338ca;
      border-color: #3730a3;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.22);
    }
  `
      : `
    background: #ffffff;
    color: #475569;
    border: 1px solid #cbd5e1;
    &:hover {
      background: #f8fafc;
      color: #0f172a;
      border-color: #94a3b8;
    }
  `}

  &:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const SearchSection = styled.div`
  flex-shrink: 0;
  padding: 0.65rem 1.25rem 0.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

const SearchRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SearchInputContainer = styled.div`
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const SearchLabel = styled.label`
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const SearchInput = styled.input`
  padding: 0.55rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #ffffff;
  color: #1e293b;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    outline: none;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SearchActions = styled.div`
  display: flex;
  align-items: flex-end;
`;

const ClearFiltersButton = styled.button`
  padding: 0.55rem 1rem;
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

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

const ContentArea = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ContentScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.65rem;
  background: #f1f5f9;
`;

const ProjectCard = styled.div`
  position: relative;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #94a3b8;
  box-shadow:
    0 4px 18px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  overflow: visible;
`;

const ProjectHeader = styled.div`
  position: relative;
  padding: 1rem 1.2rem 1.1rem;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #334155 100%);
  border-bottom: 3px solid #6366f1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
`;

const ProjectTitle = styled.h3`
  margin: 0;
  flex: 1 1 220px;
  min-width: 0;
  color: #f8fafc;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.45;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  display: block;
  overflow-wrap: anywhere;
  word-break: break-word;
  padding-left: 0.7rem;
  border-left: 4px solid #a5b4fc;
  border-radius: 2px;
`;

const EditProjectButton = styled.button`
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.35);
  padding: 0.32rem 0.6rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.55);
  }
`;

const EditProjectInput = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1.05rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
  min-width: 0;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
  }
`;

const EditProjectActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  align-self: flex-start;
`;

const SaveButton = styled.button`
  background: #15803d;
  color: #ffffff;
  border: 1px solid #166534;
  padding: 0.35rem 0.65rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #166534;
    border-color: #14532d;
  }
`;

const CancelButton = styled.button`
  background: #ffffff;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 0.35rem 0.65rem;
  border-radius: 7px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #fef2f2;
    border-color: #f87171;
  }
`;

const ModificationsBadge = styled.div`
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.1rem;
  margin-left: auto;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #fde68a;
    border-color: #fbbf24;
  }
`;

const ModificationsDropdown = styled.div`
  position: absolute;
  right: 1.8rem;
  top: calc(100% + 0.75rem);
  background: white;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
  border: 1px solid #e2e8f0;
  padding: 1.1rem;
  z-index: 50;
  min-width: 320px;
`;

const ModificationsTitle = styled.div`
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
`;

const PdfsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.7rem;
`;

const PdfGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.7rem;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  }
`;

const PdfItem = styled.div`
  background: #f1f5f9;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #334155;
  border-left: 3px solid #6366f1;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const PdfActions = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const PdfActionButton = styled.button`
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.45rem;
  border-radius: 6px;
  border: none;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: white;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ViewButton = styled(PdfActionButton)`
  background: #4f46e5;
  color: #f8fafc;
  border: 1px solid #4338ca;
  box-shadow: 0 1px 4px rgba(67, 56, 202, 0.2);

  &:hover {
    background: #4338ca;
    border-color: #3730a3;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.28);
  }
`;

const DownloadButton = styled(PdfActionButton)`
  background: #15803d;
  border: 1px solid #166534;

  &:hover {
    background: #166534;
    border-color: #14532d;
  }
`;

const SubprojectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.15rem 1.15rem;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
`;

const SubprojectItem = styled.div`
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 1rem 1.1rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
    border-color: #cbd5e1;
  }
`;

const SubprojectInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const SubprojectHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const SubprojectNumber = styled.div`
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  min-width: 70px;
  text-align: center;
`;

const SubprojectTitle = styled.h4`
  margin: 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EditSubprojectButton = styled.button`
  background: #ffffff;
  color: #334155;
  border: 1px solid #cbd5e1;
  padding: 0.25rem 0.5rem;
  border-radius: 7px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }
`;

const EditSubprojectInput = styled.input`
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  background: white;
  min-width: 0;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
  }
`;


const SubprojectHeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const LinkButton = styled.button`
  background: #ffffff;
  color: #4338ca;
  border: 1px solid #a5b4fc;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover:not(:disabled) {
    background: #eef2ff;
    border-color: #818cf8;
  }

  &:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    border-color: #e2e8f0;
    cursor: not-allowed;
  }
`;

const UnlinkButton = styled(LinkButton)`
  background: #dc3545;
  font-size: 0.7rem;
  padding: 0.35rem 0.7rem;

  &:hover {
    background: #c82333;
  }
`;

const DeletePdfButton = styled(PdfActionButton)`
  background: #dc3545;
  padding: 0.25rem 0.4rem;
  font-size: 0.65rem;
  min-width: auto;
  flex: 0 0 auto;

  &:hover {
    background: #c82333;
    transform: scale(1.05);
  }
`;

const DeleteModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20000;
  backdrop-filter: blur(3px);
`;

const DeleteModalContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease-out;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const DeleteModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
`;

const DeleteModalMessage = styled.p`
  margin: 0 0 1.5rem 0;
  color: #495057;
  font-size: 0.95rem;
  line-height: 1.5;
`;

const DeleteModalOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DeleteOptionButton = styled.button`
  padding: 0.9rem 1.2rem;
  border-radius: 10px;
  border: 2px solid ${props => props.danger ? '#dc3545' : '#6c757d'};
  background: ${props => props.danger ? '#dc3545' : 'white'};
  color: ${props => props.danger ? 'white' : '#6c757d'};
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &:hover {
    background: ${props => props.danger ? '#c82333' : '#f8f9fa'};
    border-color: ${props => props.danger ? '#c82333' : '#495057'};
    transform: translateX(4px);
  }

  &:active {
    transform: translateX(2px);
  }
`;

const DeleteOptionIcon = styled.span`
  font-size: 1.3rem;
`;

const DeleteOptionText = styled.div`
  flex: 1;
`;

const DeleteOptionTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const DeleteOptionDescription = styled.div`
  font-size: 0.8rem;
  opacity: 0.8;
`;

const DeleteModalCancel = styled.button`
  margin-top: 1rem;
  padding: 0.7rem 1.2rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background: white;
  color: #6c757d;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
  }
`;

const LinkedStatus = styled.div`
  font-size: 0.72rem;
  color: #27ae60;
  font-weight: 600;
  background: rgba(39, 174, 96, 0.12);
  border: 1px solid rgba(39, 174, 96, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
`;

const PaginationButton = styled.button`
  background: ${(props) => (props.active ? '#4f46e5' : '#ffffff')};
  color: ${(props) => (props.active ? '#f8fafc' : '#475569')};
  border: 1px solid ${(props) => (props.active ? '#4338ca' : '#cbd5e1')};
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled) {
    background: ${(props) => (props.active ? '#4338ca' : '#f8fafc')};
    border-color: ${(props) => (props.active ? '#3730a3' : '#94a3b8')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PaginationInfo = styled.span`
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem 0;
  color: #64748b;
  font-size: 1.05rem;
  font-weight: 500;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: #64748b;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
`;

const EmptyStateIcon = styled.div`
  font-size: 3rem;
  opacity: 0.45;
`;

const EmptyStateText = styled.div`
  font-size: 1.05rem;
  font-weight: 600;
`;

const EmptyStateSubtext = styled.div`
  font-size: 0.9rem;
  opacity: 0.8;
`;

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η')
    .replace(/ί/g, 'ι').replace(/ό/g, 'ο').replace(/ύ/g, 'υ').replace(/ώ/g, 'ω')
    .replace(/ΐ/g, 'ι').replace(/ΰ/g, 'υ');
};

const CreditApprovalsPanel = ({
  isOpen,
  onClose,
  userRole,
  onOpenForm,
  highlightProjectTitle = null,
  highlightSubprojectTitle = null,
  highlightProjectKey = null,
  highlightSubprojectKey = null,
  onLinkCreated = null,
  onLinkRemoved = null,
  externalLinkedEgkriseis = null,
  onRequestRefresh = null,
  onEgkriseisDataSaved = null,
  onViewPdf,
  onDownloadPdf
}) => {
  const canManageWorkflow = userRole !== 'USER' && userRole !== 'ENGINEER';
  const [egkriseisData, setEgkriseisData] = useState(null);
  const [linkedMap, setLinkedMap] = useState({});
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [subprojectSearchTerm, setSubprojectSearchTerm] = useState('');
  const [debouncedProjectSearchTerm, setDebouncedProjectSearchTerm] = useState('');
  const [debouncedSubprojectSearchTerm, setDebouncedSubprojectSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [openModificationsDropdown, setOpenModificationsDropdown] = useState(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [currentSubprojectForLink, setCurrentSubprojectForLink] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editingProjectKey, setEditingProjectKey] = useState(null);
  const [editingSubprojectKey, setEditingSubprojectKey] = useState(null);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');
  const [editingSubprojectTitle, setEditingSubprojectTitle] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pdfToDelete, setPdfToDelete] = useState(null);

  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    if (!isOpen) return;
    if (externalLinkedEgkriseis) {
      setLinkedMap(externalLinkedEgkriseis);
    }
  }, [externalLinkedEgkriseis, isOpen]);

  const loadPanelData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const egkriseisResult = await ipcRenderer.invoke('load-egkriseis-data');
      console.log('🔄 CreditApprovalsPanel - Loading data...', egkriseisResult);
      if (egkriseisResult?.success) {
        // Normalize data: εξασφάλιση ότι όλα τα projects έχουν modifications array
        if (egkriseisResult.data && egkriseisResult.data.projects) {
          Object.keys(egkriseisResult.data.projects).forEach(projectKey => {
            const project = egkriseisResult.data.projects[projectKey];
            if (!project.modifications || !Array.isArray(project.modifications)) {
              project.modifications = [];
            }
          });
          // Debug: Find the specific project (KENTRO SEMINARIOU)
          const targetProject = Object.entries(egkriseisResult.data.projects).find(([key, p]) => 
            p.title && (p.title.includes('ΚΕΝΤΡΟ ΣΕΜΙΝΑΡΙΟΥ') || p.title.includes('SEMINARIOU'))
          );
          if (targetProject) {
            const [folderName, project] = targetProject;
            console.log('🎯 CreditApprovalsPanel - FOUND TARGET PROJECT:', {
              folderName: folderName,
              title: project.title,
              modifications: project.modifications,
              modificationsCount: project.modifications ? project.modifications.length : 0,
              subprojects: Object.keys(project.subprojects || {}).length
            });
          } else {
            console.log('❌ CreditApprovalsPanel - TARGET PROJECT NOT FOUND!');
            // Debug: Log all project titles
            console.log('📋 All projects:', Object.entries(egkriseisResult.data.projects).map(([key, p]) => ({
              key: key,
              title: p.title,
              modifications: p.modifications?.length || 0
            })));
          }
        }
        console.log('📊 CreditApprovalsPanel - Projects count:', Object.keys(egkriseisResult.data?.projects || {}).length);
        
        // Χρήση requestAnimationFrame για non-blocking state update
        requestAnimationFrame(() => {
        setEgkriseisData(egkriseisResult.data || null);
        });
      } else {
        setLoadError(egkriseisResult?.error || 'Αποτυχία φόρτωσης δεδομένων εγκρίσεων. Βεβαιωθείτε ότι το αρχείο egkriseis-data.json υπάρχει.');
        console.error('Failed to load credit approvals data:', egkriseisResult?.error);
        requestAnimationFrame(() => {
        setEgkriseisData(null);
        });
      }

      const linksResult = await ipcRenderer.invoke('load-egkrisi-links');
      if (linksResult?.success) {
        // Χρήση requestAnimationFrame για non-blocking state update
        requestAnimationFrame(() => {
        setLinkedMap(linksResult.data || {});
        });
      } else {
        setLoadError((prev) => prev || linksResult?.error || 'Αποτυχία φόρτωσης συνδέσεων εγκρίσεων.');
        console.error('Failed to load linked credit approvals:', linksResult?.error);
      }
    } catch (error) {
      console.error('Error loading credit approvals data:', error);
      requestAnimationFrame(() => {
      setEgkriseisData(null);
      setLoadError('Παρουσιάστηκε σφάλμα κατά τη φόρτωση των εγκρίσεων. Ελέγξτε τα αρχεία δεδομένων και δοκιμάστε ξανά.');
      });
    } finally {
      // Χρήση requestAnimationFrame για non-blocking state update
      requestAnimationFrame(() => {
      setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadPanelData();
  }, [isOpen, loadPanelData]);

  // Listen for external refresh requests (when egkriseis data is saved)
  // Χρησιμοποιούμε ένα ref για να αποφύγουμε infinite loops
  const refreshTriggerRef = useRef(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Expose a refresh function that can be called from Dashboard
  useEffect(() => {
    if (onEgkriseisDataSaved && typeof onEgkriseisDataSaved === 'function') {
      // Store the refresh function in the callback
      // This allows Dashboard to trigger a refresh when egkriseis data is saved
    }
  }, [onEgkriseisDataSaved]);
  
  // Reload data when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0 && isOpen) {
      // Χρήση setTimeout για non-blocking update
      setTimeout(async () => {
        await loadPanelData();
      }, 300);
    }
  }, [refreshTrigger, isOpen, loadPanelData]);
  
  // Trigger refresh when onEgkriseisDataSaved prop changes (indicates save happened)
  useEffect(() => {
    if (onEgkriseisDataSaved !== null && onEgkriseisDataSaved !== undefined && typeof onEgkriseisDataSaved === 'number' && onEgkriseisDataSaved > 0 && isOpen) {
      refreshTriggerRef.current += 1;
      setRefreshTrigger(refreshTriggerRef.current);
    }
  }, [onEgkriseisDataSaved, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Επαναφορά σελίδας αμέσως όταν αλλάζει το search term
    setCurrentPage(1);

    const timer = setTimeout(() => {
      setDebouncedProjectSearchTerm(projectSearchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [projectSearchTerm, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Επαναφορά σελίδας αμέσως όταν αλλάζει το search term
    setCurrentPage(1);

    const timer = setTimeout(() => {
      setDebouncedSubprojectSearchTerm(subprojectSearchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [subprojectSearchTerm, isOpen]);

  useEffect(() => {
    if (!egkriseisData) {
      setFilteredProjects([]);
      return;
    }

    const projectEntries = egkriseisData.projects || {};

    const findProjectMatch = (projectKey) => {
      if (!projectKey) return null;

      const normalizedKey = projectKey.toString();

      for (const [storedKey, project] of Object.entries(projectEntries)) {
        if (
          storedKey === normalizedKey ||
          project.projectId?.toString() === normalizedKey ||
          project.folderName === normalizedKey
        ) {
          return { storedKey, project };
        }
      }

      return null;
    };

    const findSubprojectMatch = (project, subprojectKey) => {
      if (!project || !subprojectKey) return null;

      const normalizedKey = subprojectKey.toString();
      const subprojects = project.subprojects || {};

      for (const [storedKey, subproject] of Object.entries(subprojects)) {
        if (
          storedKey === normalizedKey ||
          subproject.subprojectId?.toString() === normalizedKey ||
          subproject.subprojectRawId?.toString() === normalizedKey ||
          subproject.number?.toString() === normalizedKey ||
          subproject.folderName === normalizedKey
        ) {
          return { storedKey, subproject };
        }
      }

      return null;
    };

    if (
      highlightProjectKey &&
      !debouncedProjectSearchTerm?.trim() &&
      !debouncedSubprojectSearchTerm?.trim()
    ) {
      const projectMatch = findProjectMatch(highlightProjectKey);

      if (projectMatch) {
        let subprojects = projectMatch.project.subprojects || {};

        if (highlightSubprojectKey) {
          const subMatch = findSubprojectMatch(projectMatch.project, highlightSubprojectKey);
          if (subMatch) {
            subprojects = {
              [subMatch.storedKey]: { ...subMatch.subproject, folderName: subMatch.storedKey }
            };
          }
        }
        
        // Προσθέτουμε το folderName σε όλα τα subprojects
        const enrichedSubprojects = Object.fromEntries(
          Object.entries(subprojects).map(([key, subproject]) => [
            key,
            { ...subproject, folderName: key }
          ])
        );

        setFilteredProjects([
          {
            ...projectMatch.project,
            folderName: projectMatch.storedKey, // Ensure folderName is preserved
            subprojects: enrichedSubprojects
          }
        ]);
        return;
      }
    }

    // Convert projectEntries to array, preserving folderName (which is the key)
    // Προσθέτουμε το folderName (key) σε κάθε subproject για σωστή αναζήτηση PDFs
    let projects = Object.entries(projectEntries).map(([folderName, project]) => {
      const enrichedSubprojects = Object.fromEntries(
        Object.entries(project.subprojects || {}).map(([key, subproject]) => [
          key,
          { ...subproject, folderName: key }
        ])
      );
      
      return {
        ...project,
        folderName: folderName, // Ensure folderName is preserved from the key
        subprojects: enrichedSubprojects
      };
    });

    // 1. ΠΡΩΤΑ: Φιλτράρισμα projects (αν υπάρχει αναζήτηση έργου)
    if (debouncedProjectSearchTerm?.trim()) {
      const searchTerm = normalizeText(debouncedProjectSearchTerm);
      console.log('🔍 Project search term:', debouncedProjectSearchTerm, '→ normalized:', searchTerm);
      
      projects = projects.filter((project) => {
        const projectTitle = project.title || '';
        const normalizedTitle = normalizeText(projectTitle);
        const matches = normalizedTitle.includes(searchTerm);
        
        if (matches) {
          console.log('✅ Project match found:', {
            projectTitle: projectTitle,
            normalizedTitle: normalizedTitle,
            searchTerm: searchTerm
          });
        }
        
        return matches;
      });
      
      console.log('📋 Filtered projects count after project search:', projects.length);
    }

    // 2. ΔΕΥΤΕΡΑ: Φιλτράρισμα subprojects (αν υπάρχει αναζήτηση υποέργου)
    if (debouncedSubprojectSearchTerm?.trim()) {
      const searchTerm = normalizeText(debouncedSubprojectSearchTerm);
      console.log('🔍 Subproject search term:', debouncedSubprojectSearchTerm, '→ normalized:', searchTerm);
      
      projects = projects
        .map((project) => {
          const subprojects = project.subprojects || {};
          
          // Φιλτράρισμα subprojects
          const filteredSubprojects = Object.fromEntries(
            Object.entries(subprojects).filter(([key, subproject]) => {
              if (!subproject || !subproject.title) return false;
              const subprojectTitle = subproject.title;
              const normalizedTitle = normalizeText(subprojectTitle);
              const matches = normalizedTitle.includes(searchTerm);
              
              if (matches) {
                console.log('✅ Subproject match found:', {
                  projectTitle: project.title,
                  subprojectTitle: subprojectTitle,
                  normalizedTitle: normalizedTitle,
                  searchTerm: searchTerm
                });
              }
              
              return matches;
            })
          );

          const hasMatchingSubprojects = Object.keys(filteredSubprojects).length > 0;
          
          console.log('📊 Project filter result:', {
            projectTitle: project.title,
            totalSubprojects: Object.keys(subprojects).length,
            matchingSubprojects: Object.keys(filteredSubprojects).length,
            willKeep: hasMatchingSubprojects
          });
          
          // Κρατάμε μόνο έργα που έχουν matching subprojects — οι τροποποιήσεις δεν αρκούν
          if (!hasMatchingSubprojects) {
            return null;
          }

          // Εμφανίζουμε μόνο τα matching subprojects
          const enrichedSubprojects = Object.fromEntries(
            Object.entries(filteredSubprojects).map(([key, subproject]) => [
              key,
              { ...subproject, folderName: key }
            ])
          );
          
          return {
            ...project,
            subprojects: enrichedSubprojects
          };
        })
        .filter(Boolean);
      
      console.log('📋 Final filtered projects count after subproject search:', projects.length);
    }
    
    // Αν ΔΕΝ υπάρχει αναζήτηση, αποκλείουμε projects που δεν έχουν ούτε subprojects ούτε modifications
    if (!debouncedProjectSearchTerm?.trim() && !debouncedSubprojectSearchTerm?.trim()) {
      projects = projects.filter((project) => {
        const hasSubprojects = project.subprojects && Object.keys(project.subprojects).length > 0;
        const hasModifications = project.modifications && Array.isArray(project.modifications) && project.modifications.length > 0;
        return hasSubprojects || hasModifications;
      });
    }

    projects.sort((a, b) =>
      a.title.localeCompare(b.title, 'el', { sensitivity: 'base' })
    );

    setFilteredProjects(projects);
  }, [
    egkriseisData,
    debouncedProjectSearchTerm,
    debouncedSubprojectSearchTerm,
    highlightProjectKey,
    highlightSubprojectKey
  ]);

  useEffect(() => {
    if (isOpen && highlightProjectTitle && !highlightProjectKey) {
      setProjectSearchTerm(highlightProjectTitle);
      setDebouncedProjectSearchTerm(highlightProjectTitle);
    }
  }, [isOpen, highlightProjectTitle, highlightProjectKey]);

  useEffect(() => {
    if (isOpen && highlightSubprojectTitle && !highlightSubprojectKey) {
      setSubprojectSearchTerm(highlightSubprojectTitle);
      setDebouncedSubprojectSearchTerm(highlightSubprojectTitle);
    }
  }, [isOpen, highlightSubprojectTitle, highlightSubprojectKey]);

  useEffect(() => {
    if (!isOpen) {
      setProjectSearchTerm('');
      setSubprojectSearchTerm('');
      setDebouncedProjectSearchTerm('');
      setDebouncedSubprojectSearchTerm('');
      setCurrentPage(1);
      setOpenModificationsDropdown(null);
    }
  }, [isOpen]);

  const handleClearFilters = useCallback(() => {
    setProjectSearchTerm('');
    setSubprojectSearchTerm('');
    setDebouncedProjectSearchTerm('');
    setDebouncedSubprojectSearchTerm('');
    setCurrentPage(1);
  }, []);

  // Επαναφορά σελίδας αν είναι μεγαλύτερη από το συνολικό αριθμό σελίδων
  useEffect(() => {
    if (filteredProjects.length > 0) {
      const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
      if (currentPage > totalPages) {
        setCurrentPage(1);
      }
    }
  }, [filteredProjects.length, currentPage]);

  const paginationData = useMemo(() => {
    const totalItems = filteredProjects.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    
    // Επαναφορά σελίδας αν είναι μεγαλύτερη από το συνολικό αριθμό σελίδων
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

    return {
      totalItems,
      totalPages,
      currentPage: safePage,
      startIndex,
      endIndex,
      currentProjects: filteredProjects.slice(startIndex, endIndex)
    };
  }, [filteredProjects, currentPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    setOpenModificationsDropdown(null);
  }, []);

  const handleToggleDropdown = useCallback((projectKey) => {
    setOpenModificationsDropdown((prev) => (prev === projectKey ? null : projectKey));
  }, []);

  const viewPdf = useCallback(async (projectFolderName, pdfName, subFolderName = null) => {
    try {
      if (onViewPdf) {
        await onViewPdf(projectFolderName, pdfName, subFolderName);
        return;
      }
      await ipcRenderer.invoke('view-egkriseis-pdf', projectFolderName, pdfName, subFolderName);
    } catch (error) {
      console.error('Error viewing PDF:', error);
      alert('Προέκυψε σφάλμα κατά την προβολή του αρχείου.');
    }
  }, [onViewPdf]);

  const downloadPdf = useCallback(async (projectFolderName, pdfName, subFolderName = null) => {
    try {
      if (onDownloadPdf) {
        await onDownloadPdf(projectFolderName, pdfName, subFolderName);
        return;
      }
      const downloadResult = await ipcRenderer.invoke('download-egkriseis-pdf', projectFolderName, pdfName, subFolderName);
      if (!downloadResult?.success) {
        alert('Προέκυψε σφάλμα κατά τη λήψη του αρχείου.');
        return;
      }

      const saveResult = await ipcRenderer.invoke('show-save-dialog', {
        title: 'Αποθήκευση PDF',
        defaultPath: pdfName,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!saveResult.canceled && saveResult.filePath) {
        await ipcRenderer.invoke('copy-file', downloadResult.filePath, saveResult.filePath);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Προέκυψε σφάλμα κατά τη λήψη του αρχείου.');
    }
  }, [onDownloadPdf]);

  const handleDeletePdfClick = useCallback((project, subproject, pdfFileName) => {
    setPdfToDelete({ project, subproject, pdfFileName });
    setDeleteModalOpen(true);
  }, []);

  const handleDeletePdfCompletely = useCallback(async () => {
    if (!pdfToDelete) return;

    const { project, pdfFileName } = pdfToDelete;

    try {
      const result = await ipcRenderer.invoke(
        'delete-egkrisi-pdf-completely',
        project.folderName,
        pdfFileName
      );

      if (result?.success) {
        alert('Το αρχείο διαγράφηκε εντελώς από όλα τα υποέργα!');
        setDeleteModalOpen(false);
        setPdfToDelete(null);
        // Ανανέωση των δεδομένων
        await loadPanelData();
        if (onRequestRefresh) {
          onRequestRefresh();
        }
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + (result?.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting PDF completely:', error);
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
    }
  }, [pdfToDelete, loadPanelData, onRequestRefresh]);

  const handleDeletePdfFromSubproject = useCallback(async () => {
    if (!pdfToDelete) return;

    const { project, subproject, pdfFileName } = pdfToDelete;

    try {
      // Βρίσκουμε το subprojectKey
      const subprojectKey = Object.keys(project.subprojects || {}).find(key => 
        project.subprojects[key] === subproject || 
        (project.subprojects[key].title === subproject.title && project.subprojects[key].number === subproject.number)
      );

      if (!subprojectKey) {
        alert('Σφάλμα: Δεν βρέθηκε το κλειδί του υποέργου');
        return;
      }

      const result = await ipcRenderer.invoke(
        'delete-egkrisi-pdf-from-subproject',
        project.folderName,
        subprojectKey,
        pdfFileName
      );

      if (result?.success) {
        alert('Η συσχέτιση διαγράφηκε επιτυχώς!');
        setDeleteModalOpen(false);
        setPdfToDelete(null);
        // Ανανέωση των δεδομένων
        await loadPanelData();
        if (onRequestRefresh) {
          onRequestRefresh();
        }
      } else {
        alert('Σφάλμα κατά τη διαγραφή: ' + (result?.error || 'Άγνωστο σφάλμα'));
      }
    } catch (error) {
      console.error('Error deleting PDF from subproject:', error);
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
    }
  }, [pdfToDelete, loadPanelData, onRequestRefresh]);

  const handleOpenSearchModal = useCallback((subproject, project) => {
    setCurrentSubprojectForLink({ subproject, project });
    setIsSearchModalOpen(true);
  }, []);

  const handleEditProjectTitle = useCallback((project) => {
    setEditingProjectKey(project.folderName);
    setEditingProjectTitle(project.title);
  }, []);

  const handleSaveProjectTitle = useCallback(async () => {
    if (!editingProjectKey || !editingProjectTitle.trim()) return;
    
    try {
      const result = await ipcRenderer.invoke('update-egkrisi-project-title', editingProjectKey, editingProjectTitle.trim());
      if (result.success) {
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
        setEditingProjectKey(null);
        setEditingProjectTitle('');
        });
        
        // Reload data με delay για να μην μπλοκάρει το UI
        setTimeout(async () => {
          await loadPanelData();
        }, 100);
        
        alert('✅ Ο τίτλος του έργου ενημερώθηκε επιτυχώς!');
      } else {
        alert('❌ Σφάλμα: ' + (result.error || 'Αποτυχία ενημέρωσης'));
      }
    } catch (error) {
      console.error('Error updating project title:', error);
      alert('❌ Σφάλμα κατά την ενημέρωση του τίτλου');
    }
  }, [editingProjectKey, editingProjectTitle, loadPanelData]);

  const handleEditSubprojectTitle = useCallback((subproject, project) => {
    const subprojectKey = Object.keys(project.subprojects || {}).find(key => project.subprojects[key] === subproject);
    setEditingSubprojectKey({ projectKey: project.folderName, subprojectKey });
    setEditingSubprojectTitle(subproject.title);
  }, []);

  const handleSaveSubprojectTitle = useCallback(async () => {
    if (!editingSubprojectKey || !editingSubprojectTitle.trim()) return;
    
    try {
      const result = await ipcRenderer.invoke('update-egkrisi-subproject-title', editingSubprojectKey.projectKey, editingSubprojectKey.subprojectKey, editingSubprojectTitle.trim());
      if (result.success) {
        // Χρήση requestAnimationFrame για non-blocking UI update
        requestAnimationFrame(() => {
        setEditingSubprojectKey(null);
        setEditingSubprojectTitle('');
        });
        
        // Reload data με delay για να μην μπλοκάρει το UI
        setTimeout(async () => {
          await loadPanelData();
        }, 100);
        
        alert('✅ Ο τίτλος του υποέργου ενημερώθηκε επιτυχώς!');
      } else {
        alert('❌ Σφάλμα: ' + (result.error || 'Αποτυχία ενημέρωσης'));
      }
    } catch (error) {
      console.error('Error updating subproject title:', error);
      alert('❌ Σφάλμα κατά την ενημέρωση του τίτλου');
    }
  }, [editingSubprojectKey, editingSubprojectTitle, loadPanelData]);

  const performLink = useCallback(async (subprojectId, subproject, project) => {
    try {
      // Validation: Έλεγχος ότι έχουμε όλα τα απαραίτητα δεδομένα
      if (!subprojectId) {
        alert('❌ Σφάλμα: Δεν βρέθηκε το ID του υποέργου.');
        console.error('performLink: Missing subprojectId', { subprojectId, subproject, project });
        return;
      }

      if (!subproject || !subproject.title) {
        alert('❌ Σφάλμα: Δεν βρέθηκε ο τίτλος του υποέργου.');
        console.error('performLink: Missing subproject title', { subproject, project });
        return;
      }

      if (!project || !project.title) {
        alert('❌ Σφάλμα: Δεν βρέθηκε ο τίτλος του έργου.');
        console.error('performLink: Missing project title', { project });
        return;
      }

      const realProjectId = await ipcRenderer.invoke('find-project-by-subproject-id', subprojectId);

      if (!realProjectId) {
        alert('❌ Δεν βρέθηκε το έργο για το επιλεγμένο υποέργο.');
        console.error('performLink: Project not found for subprojectId', subprojectId);
        return;
      }

      // Βρίσκουμε το subprojectKey από το egkriseis-data.json
      let egkrisiSubprojectKey = subproject.folderName || subproject.number;
      
      // Αν δεν υπάρχει folderName, το βρίσκουμε από το key του subproject
      if (!egkrisiSubprojectKey) {
        const subprojectKey = Object.keys(project.subprojects || {}).find(key => 
          project.subprojects[key] === subproject || 
          (project.subprojects[key].title === subproject.title && project.subprojects[key].number === subproject.number)
        );
        egkrisiSubprojectKey = subprojectKey || subproject.number || '';
      }
      
      // Χρησιμοποιούμε τα folderName ως keys (όπως αποθηκεύονται στο egkriseis-data.json)
      const linkData = {
        egkrisiProjectKey: project.folderName || project.projectId,
        egkrisiSubprojectKey: egkrisiSubprojectKey,
        egkrisiTitle: subproject.title.trim(),
        egkrisiProjectTitle: project.title.trim(),
        subprojectId,
        projectId: realProjectId,
        subprojectTitle: subproject.title.trim(),
        manual: true
      };

      // Validation: Έλεγχος ότι όλα τα πεδία είναι valid
      if (!linkData.egkrisiTitle || !linkData.egkrisiProjectTitle) {
        alert('❌ Σφάλμα: Οι τίτλοι δεν μπορούν να είναι κενά.');
        console.error('performLink: Empty titles', linkData);
        return;
      }
      
      if (!linkData.egkrisiProjectKey) {
        alert('❌ Σφάλμα: Δεν βρέθηκε το project key.');
        console.error('performLink: Missing project key', { project, linkData });
        return;
      }

      console.log('🔗 Creating link with data:', linkData);
      console.log('🔍 Link data validation:', {
        egkrisiProjectKey: linkData.egkrisiProjectKey,
        egkrisiSubprojectKey: linkData.egkrisiSubprojectKey,
        egkrisiTitle: linkData.egkrisiTitle,
        egkrisiProjectTitle: linkData.egkrisiProjectTitle,
        subprojectId: linkData.subprojectId,
        projectId: linkData.projectId
      });

      const result = await ipcRenderer.invoke('create-manual-egkrisi-link', linkData);

      if (result?.success && result?.linkData) {
        setLinkedMap((prev) => ({
          ...prev,
          [result.linkData.egkrisiId]: result.linkData
        }));

        alert('✅ Η συσχέτιση εγκρίσεως με το υποέργο δημιουργήθηκε επιτυχώς!');

        // Ανανέωση των δεδομένων του panel για να εμφανιστεί η συσχετισμένη έγκριση
        await loadPanelData();

        if (onLinkCreated) {
          onLinkCreated(result.linkData);
        }

        if (onRequestRefresh) {
          onRequestRefresh();
        }
      } else {
        const errorMessage = result?.error || 'Άγνωστο σφάλμα';
        console.error('performLink: Link creation failed', result);
        console.error('performLink: Full error details:', {
          result: result,
          linkData: linkData,
          subproject: subproject,
          project: project
        });
        alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + errorMessage);
      }
    } catch (error) {
      console.error('Error creating manual egkrisi link:', error);
      console.error('performLink: Exception details:', {
        error: error,
        message: error.message,
        stack: error.stack,
        subproject: subproject,
        project: project
      });
      alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + error.message);
    }
  }, [onLinkCreated, onRequestRefresh, loadPanelData]);

  const handleLinkSubproject = useCallback(async (subproject, project) => {
    try {
      const result = await ipcRenderer.invoke('find-subproject-by-title', {
        projectId: null,
        subprojectTitle: subproject.title
      });

      if (!result?.success || !result?.subprojectId) {
        handleOpenSearchModal(subproject, project);
        return;
      }

      await performLink(result.subprojectId, subproject, project);
    } catch (error) {
      console.error('Error linking subproject:', error);
      alert('❌ Σφάλμα κατά τη δημιουργία συσχέτισης: ' + error.message);
    }
  }, [handleOpenSearchModal, performLink]);

  const handleSearchModalSelect = useCallback(async (selection) => {
    if (!currentSubprojectForLink) return;
    const { subproject, project } = currentSubprojectForLink;

    try {
      await performLink(selection.subprojectId, subproject, project);
    } finally {
      setIsSearchModalOpen(false);
      setCurrentSubprojectForLink(null);
    }
  }, [currentSubprojectForLink, performLink]);

  const handleUnlinkSubproject = useCallback(async (subproject) => {
    const linkToRemove = Object.values(linkedMap).find(
      (link) =>
        link &&
        normalizeText(link.egkrisiTitle) === normalizeText(subproject.title)
    );

    if (!linkToRemove) {
      alert('Δεν βρέθηκε συσχέτιση για ακύρωση.');
      return;
    }

    const confirmed = safeConfirm(
      `Είστε σίγουροι ότι θέλετε να ακυρώσετε τη συσχέτιση με το υποέργο "${subproject.title}";`
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await ipcRenderer.invoke('delete-egkrisi-link', linkToRemove.egkrisiId);
      if (result?.success) {
        setLinkedMap((prev) => {
          const updated = { ...prev };
          delete updated[linkToRemove.egkrisiId];
          return updated;
        });

        alert('Η συσχέτιση ακυρώθηκε επιτυχώς.');

        if (onLinkRemoved) {
          onLinkRemoved(linkToRemove);
        }

        if (onRequestRefresh) {
          onRequestRefresh();
        }
      } else {
        alert('Προέκυψε σφάλμα κατά την ακύρωση της συσχέτισης.');
      }
    } catch (error) {
      console.error('Error unlinking subproject:', error);
      alert('Προέκυψε σφάλμα κατά την ακύρωση της συσχέτισης.');
    }
  }, [linkedMap, onLinkRemoved, onRequestRefresh]);

  const isSubprojectLinked = useCallback((subprojectTitle) => {
    if (!subprojectTitle) return false;
    const normalizedTitle = normalizeText(subprojectTitle);
    return Object.values(linkedMap).some((link) =>
      link && normalizeText(link.egkrisiTitle) === normalizedTitle
    );
  }, [linkedMap]);

  if (!isOpen) {
    return null;
  }

  return (
    <PanelOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <PanelContainer>
        <PanelContent>
          <PanelHeader>
            <Title>Εγκρίσεις Διάθεσης Πίστωσης</Title>
            <HeaderActions>
              {canManageWorkflow && (
                <HeaderButton type="button" $primary onClick={onOpenForm}>
                  ✏️ Επεξεργασία/Δημιουργία
                </HeaderButton>
              )}
              <HeaderButton type="button" onClick={onClose}>Κλείσιμο</HeaderButton>
            </HeaderActions>
          </PanelHeader>

          <SearchSection>
            <SearchRow>
              <SearchInputContainer>
                <SearchLabel>Αναζήτηση έργου</SearchLabel>
                <SearchInput
                  type="text"
                  placeholder="Τίτλος έργου"
                  value={projectSearchTerm}
                  onChange={(e) => setProjectSearchTerm(e.target.value)}
                />
              </SearchInputContainer>
              <SearchInputContainer>
                <SearchLabel>Αναζήτηση υποέργου</SearchLabel>
                <SearchInput
                  type="text"
                  placeholder="Τίτλος υποέργου"
                  value={subprojectSearchTerm}
                  onChange={(e) => setSubprojectSearchTerm(e.target.value)}
                />
              </SearchInputContainer>
              <SearchActions>
                <ClearFiltersButton onClick={handleClearFilters}>
                  Καθαρισμός φίλτρων
                </ClearFiltersButton>
              </SearchActions>
            </SearchRow>
          </SearchSection>

          <ContentArea>
            <ContentScroll>
              {loading ? (
                <LoadingSpinner>Φόρτωση δεδομένων...</LoadingSpinner>
              ) : loadError ? (
                <EmptyState>
                  <EmptyStateIcon>⚠️</EmptyStateIcon>
                  <EmptyStateText>{loadError}</EmptyStateText>
                  <EmptyStateSubtext>
                    Ελέγξτε στο `dedomena_ergon/ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ/egkriseis-data.json` ότι υπάρχουν δεδομένα και ότι η εφαρμογή έχει πρόσβαση στο φάκελο.
                  </EmptyStateSubtext>
                </EmptyState>
              ) : paginationData.currentProjects.length === 0 ? (
                <EmptyState>
                  <EmptyStateIcon>📁</EmptyStateIcon>
                  <EmptyStateText>Δεν βρέθηκαν έργα</EmptyStateText>
                  <EmptyStateSubtext>
                    {(projectSearchTerm || subprojectSearchTerm)
                      ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης'
                      : 'Δεν υπάρχουν διαθέσιμες εγκρίσεις'}
                  </EmptyStateSubtext>
                </EmptyState>
              ) : (
                <>
                  {paginationData.currentProjects.map((project) => (
                    <ProjectCard key={project.projectId || project.title}>
                      <ProjectHeader>
                        {editingProjectKey === project.folderName ? (
                          <>
                            <EditProjectInput
                              value={editingProjectTitle}
                              onChange={(e) => setEditingProjectTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveProjectTitle();
                                if (e.key === 'Escape') {
                                  setEditingProjectKey(null);
                                  setEditingProjectTitle('');
                                }
                              }}
                              autoFocus
                            />
                            <EditProjectActions>
                              <SaveButton onClick={handleSaveProjectTitle}>💾 Αποθήκευση</SaveButton>
                              <CancelButton onClick={() => {
                                setEditingProjectKey(null);
                                setEditingProjectTitle('');
                              }}>✕ Ακύρωση</CancelButton>
                            </EditProjectActions>
                          </>
                        ) : (
                          <>
                            <ProjectTitle>{project.title}</ProjectTitle>
                            {canManageWorkflow && (
                              <EditProjectButton onClick={() => handleEditProjectTitle(project)}>
                                ✏️ Επεξεργασία
                              </EditProjectButton>
                            )}
                          </>
                        )}
                        {((project.modifications && project.modifications.length > 0) || (project.modificationsDetails && project.modificationsDetails.length > 0)) && (() => {
                          // Προτιμάμε πάντα το modifications array αν υπάρχει και δεν είναι άδειο
                          // Το modificationsDetails είναι παλιά δομή και μπορεί να έχει λάθος/ατελή δεδομένα
                          let pdfsToShow;
                          if (project.modifications && Array.isArray(project.modifications) && project.modifications.length > 0) {
                            // Χρησιμοποιούμε το modifications array (πιο αξιόπιστο)
                            pdfsToShow = project.modifications.map(fileName => ({ fileName }));
                          } else if (project.modificationsDetails && Array.isArray(project.modificationsDetails) && project.modificationsDetails.length > 0) {
                            // Fallback στο modificationsDetails μόνο αν δεν υπάρχει modifications
                            pdfsToShow = project.modificationsDetails;
                          } else {
                            pdfsToShow = [];
                          }
                          const count = pdfsToShow.length;
                          
                          // Debug: Log modifications for this specific project
                          if (project.title && project.title.includes('ΚΕΝΤΡΟ ΣΕΜΙΝΑΡΙΟΥ')) {
                            console.log('🔍 Rendering modifications for project:', {
                              title: project.title,
                              folderName: project.folderName,
                              modifications: project.modifications,
                              modificationsDetails: project.modificationsDetails,
                              pdfsToShow: pdfsToShow,
                              count: count
                            });
                          }
                          
                          return (
                            <>
                              <ModificationsBadge onClick={() => handleToggleDropdown(project.projectId || project.title)}>
                                📝 Τροποποιήσεις ({count})
                              </ModificationsBadge>
                              {openModificationsDropdown === (project.projectId || project.title) && (
                                <ModificationsDropdown>
                                  <ModificationsTitle>Τροποποιήσεις έργου</ModificationsTitle>
                                  <PdfsGrid>
                                    {pdfsToShow.map((pdf, index) => {
                                      const fileName = pdf.fileName || pdf;
                                      return (
                                        <PdfGroup key={fileName || index}>
                                          <PdfItem>
                                            📄 {fileName}
                                          </PdfItem>
                                          <PdfActions>
                                            <ViewButton onClick={() => viewPdf(project.folderName, fileName)}>
                                              Προβολή
                                            </ViewButton>
                                            <DownloadButton onClick={() => downloadPdf(project.folderName, fileName)}>
                                              Λήψη
                                            </DownloadButton>
                                          </PdfActions>
                                        </PdfGroup>
                                      );
                                    })}
                                  </PdfsGrid>
                                </ModificationsDropdown>
                              )}
                            </>
                          );
                        })()}
                      </ProjectHeader>

                      <SubprojectsList>
                        {Object.values(project.subprojects || {})
                          .filter((subproject) => subproject && subproject.title)
                          .map((subproject) => (
                          <SubprojectItem key={`${project.projectId || project.title}-${subproject.number || subproject.title}`}>
                            <SubprojectInfo>
                              <SubprojectHeader>
                                <SubprojectNumber>#{subproject.number || '—'}</SubprojectNumber>
                                {editingSubprojectKey && editingSubprojectKey.projectKey === project.folderName && editingSubprojectKey.subprojectKey === Object.keys(project.subprojects || {}).find(key => project.subprojects[key] === subproject) ? (
                                  <>
                                    <EditSubprojectInput
                                      value={editingSubprojectTitle}
                                      onChange={(e) => setEditingSubprojectTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveSubprojectTitle();
                                        if (e.key === 'Escape') {
                                          setEditingSubprojectKey(null);
                                          setEditingSubprojectTitle('');
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <EditProjectActions>
                                      <SaveButton onClick={handleSaveSubprojectTitle}>💾</SaveButton>
                                      <CancelButton onClick={() => {
                                        setEditingSubprojectKey(null);
                                        setEditingSubprojectTitle('');
                                      }}>✕</CancelButton>
                                    </EditProjectActions>
                                  </>
                                ) : (
                                  <>
                                    <SubprojectTitle>{subproject.title}</SubprojectTitle>
                                    {canManageWorkflow && (
                                      <EditSubprojectButton onClick={() => handleEditSubprojectTitle(subproject, project)}>
                                        ✏️
                                      </EditSubprojectButton>
                                    )}
                                  </>
                                )}
                                {canManageWorkflow && (
                                  <SubprojectHeaderActions>
                                    {isSubprojectLinked(subproject.title) ? (
                                      <>
                                        <LinkButton disabled>
                                          🔗 Συσχετισμένο
                                        </LinkButton>
                                        <UnlinkButton onClick={() => handleUnlinkSubproject(subproject)}>
                                          ❌ Ακύρωση
                                        </UnlinkButton>
                                        <LinkedStatus>Συσχετισμένο</LinkedStatus>
                                      </>
                                    ) : (
                                      <LinkButton onClick={() => handleLinkSubproject(subproject, project)}>
                                        🔗 Συσχέτιση με υποέργο
                                      </LinkButton>
                                    )}
                                  </SubprojectHeaderActions>
                                )}
                              </SubprojectHeader>

                              {subproject.pdfs?.length ? (
                                <PdfsGrid>
                                  {subproject.pdfs.map((pdf) => (
                                    <PdfGroup key={pdf}>
                                      <PdfItem>
                                        📄 {pdf}
                                      </PdfItem>
                                      <PdfActions>
                                        <ViewButton onClick={() => viewPdf(project.folderName, pdf, subproject.folderName)}>
                                          Προβολή
                                        </ViewButton>
                                        <DownloadButton onClick={() => downloadPdf(project.folderName, pdf, subproject.folderName)}>
                                          Λήψη
                                        </DownloadButton>
                                        {canManageWorkflow && (
                                          <DeletePdfButton
                                            onClick={() => handleDeletePdfClick(project, subproject, pdf)}
                                            title="Διαγραφή αρχείου"
                                          >
                                            ✕
                                          </DeletePdfButton>
                                        )}
                                      </PdfActions>
                                    </PdfGroup>
                                  ))}
                                </PdfsGrid>
                              ) : (
                                <div style={{ fontStyle: 'italic', color: '#64748b', fontSize: '0.85rem' }}>
                                  Δεν υπάρχουν διαθέσιμα αρχεία PDF.
                                </div>
                              )}
                            </SubprojectInfo>
                          </SubprojectItem>
                        ))}
                      </SubprojectsList>
                    </ProjectCard>
                  ))}

                  {paginationData.totalPages > 1 && (
                    <PaginationContainer>
                      <PaginationButton
                        onClick={() => handlePageChange(paginationData.currentPage - 1)}
                        disabled={paginationData.currentPage === 1}
                      >
                        « Προηγούμενη
                      </PaginationButton>

                      {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          const current = paginationData.currentPage;
                          const total = paginationData.totalPages;
                          return (
                            page === 1 ||
                            page === total ||
                            (page >= current - 1 && page <= current + 1)
                          );
                        })
                        .map((page, index, array) => (
                          <React.Fragment key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && <span>...</span>}
                            <PaginationButton
                              active={page === paginationData.currentPage}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </PaginationButton>
                          </React.Fragment>
                        ))}

                      <PaginationButton
                        onClick={() => handlePageChange(paginationData.currentPage + 1)}
                        disabled={paginationData.currentPage === paginationData.totalPages}
                      >
                        Επόμενη »
                      </PaginationButton>

                      <PaginationInfo>
                        {paginationData.startIndex + 1}-{paginationData.endIndex} από {paginationData.totalItems} έργα
                      </PaginationInfo>
                    </PaginationContainer>
                  )}
                </>
              )}
            </ContentScroll>
          </ContentArea>
        </PanelContent>

        <SubprojectSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => {
            setIsSearchModalOpen(false);
            setCurrentSubprojectForLink(null);
          }}
          onSelectSubproject={handleSearchModalSelect}
          egkrisiTitle={currentSubprojectForLink?.subproject?.title}
        />

        {/* Delete PDF Modal */}
        {deleteModalOpen && pdfToDelete && (
          <DeleteModalOverlay onClick={(e) => e.target === e.currentTarget && setDeleteModalOpen(false)}>
            <DeleteModalContainer>
              <DeleteModalTitle>Διαγραφή Αρχείου PDF</DeleteModalTitle>
              <DeleteModalMessage>
                Το αρχείο <strong>"{pdfToDelete.pdfFileName}"</strong> είναι συσχετισμένο με το υποέργο <strong>"{pdfToDelete.subproject.title}"</strong>.
                <br /><br />
                Επιλέξτε τη διαγραφή που θέλετε:
              </DeleteModalMessage>
              <DeleteModalOptions>
                <DeleteOptionButton
                  danger
                  onClick={handleDeletePdfCompletely}
                >
                  <DeleteOptionIcon>🗑️</DeleteOptionIcon>
                  <DeleteOptionText>
                    <DeleteOptionTitle>Διαγραφή εντελώς από την εφαρμογή</DeleteOptionTitle>
                    <DeleteOptionDescription>
                      Το αρχείο θα διαγραφεί από όλα τα υποέργα στα οποία είναι συσχετισμένο
                    </DeleteOptionDescription>
                  </DeleteOptionText>
                </DeleteOptionButton>
                <DeleteOptionButton
                  onClick={handleDeletePdfFromSubproject}
                >
                  <DeleteOptionIcon>🔗</DeleteOptionIcon>
                  <DeleteOptionText>
                    <DeleteOptionTitle>Διαγραφή μόνο η συσχέτιση</DeleteOptionTitle>
                    <DeleteOptionDescription>
                      Το αρχείο θα παραμείνει, αλλά θα αφαιρεθεί μόνο από αυτό το υποέργο
                    </DeleteOptionDescription>
                  </DeleteOptionText>
                </DeleteOptionButton>
              </DeleteModalOptions>
              <DeleteModalCancel onClick={() => {
                setDeleteModalOpen(false);
                setPdfToDelete(null);
              }}>
                Ακύρωση
              </DeleteModalCancel>
            </DeleteModalContainer>
          </DeleteModalOverlay>
        )}
      </PanelContainer>
    </PanelOverlay>
  );
};

export default CreditApprovalsPanel;
