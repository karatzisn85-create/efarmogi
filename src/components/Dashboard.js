import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import ProjectForm from './ProjectForm';
import EgkriseisForm from './EgkriseisForm';

import ProjectCard from './ProjectCard';
import SubprojectDetailModal from './SubprojectDetailModal';
import Statistics from './Statistics';
import PDFViewer from './PDFViewer';
import AdvancedFilters from './AdvancedFilters';
import ActiveFiltersBanner from './ActiveFiltersBanner';
import FileManager from './FileManager';
import ExportData from './ExportData';
import TechnicalProgramExport from './TechnicalProgramExport';
import InvestExport from './InvestExport';
import EntaxisManager from './EntaxisManager';
import ProsklisisManager from './ProsklisisManager';
import EgkriseisManager from './EgkriseisManager';
import CreditApprovalsPanel from './CreditApprovalsPanel';
import DocumentTemplatesManager from './DocumentTemplatesManager';
import BackupManager from './BackupManager';
import AuditLogViewer from './AuditLogViewer';
import UserManagement from './UserManagement';
import { containsSearchTerm } from '../utils/searchUtils';
import { getCharacterization } from '../data/formOptions';

const ipcRenderer = window.electronAPI;

const DEFAULT_NOTE_GROUP_ID = 'general-notes';

const hexToRgba = (hex, alpha = 0.25) => {
  if (!hex) return `rgba(99, 102, 241, ${alpha})`;
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized.split('').map(ch => ch + ch).join('');
  }
  if (sanitized.length !== 6) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Force webpack to include EgkriseisForm
const EgkriseisFormComponent = EgkriseisForm;

const DashboardContainer = styled.div`
  min-height: 100vh;
  background: #ffffff;
  padding: 0;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  
  /* Enhanced scrollbar for dashboard */
  &::-webkit-scrollbar {
    width: 16px;
  }

  &::-webkit-scrollbar-track {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
    border-radius: 15px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
    border-radius: 15px;
    border: 3px solid rgba(102, 126, 234, 0.3);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(15px);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    transform: scale(1.08);
    border-color: rgba(102, 126, 234, 0.5);
  }

  &::-webkit-scrollbar-thumb:active {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
    box-shadow: 0 3px 10px rgba(102, 126, 234, 0.7);
    transform: scale(1.02);
  }

  &::-webkit-scrollbar-corner {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  /* Smooth scrolling */
  scroll-behavior: smooth;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const CenteredTitleContainer = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;

const MainTitle = styled.h1`
  color: #1a237e;
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  padding-bottom: 0.5rem;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100px;
    height: 3px;
    background: linear-gradient(90deg, transparent, #ffd700, transparent);
    border-radius: 2px;
  }
`;

const SubTitle = styled.h2`
  color: #3949ab;
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0.5rem 0 0 0;
  line-height: 1.3;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 1px;
  text-transform: uppercase;
`;

const QuickSearchContainer = styled.div`
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 15px;
  padding: 12px;
  margin-top: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  width: 100%;
`;

const QuickSearchGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SearchInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SearchLabel = styled.label`
  color: #555;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const SearchInput = styled.input`
  padding: 8px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.8rem;
  transition: all 0.3s ease;
  background: white;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
  
  &::placeholder {
    color: #999;
    font-size: 0.75rem;
  }
`;

const SearchSelect = styled.select`
  padding: 8px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.8rem;
  transition: all 0.3s ease;
  background: white;
  cursor: pointer;
  width: 100%;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
`;

const ClearButton = styled.button`
  padding: 8px 12px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const UserRole = styled.span`
  background: ${props => props.role === 'SUPERADMIN' ? '#7b1fa2' : props.role === 'ADMIN' ? '#2196F3' : '#4CAF50'};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
`;

const LogoutButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s ease;

  &:hover {
    background: #c82333;
  }
`;

const ContentArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;



const ProjectsContainer = styled.div`
  background: white;
  border-radius: 15px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  min-height: 400px;
  width: 100%;
`;

const ProjectsTitle = styled.h2`
  color: #1a237e;
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-align: center;
  position: relative;
  padding-bottom: 1rem;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 4px;
    background: linear-gradient(90deg, transparent, #ffd700, transparent);
    border-radius: 2px;
  }
  
  box-shadow: 0 2px 8px rgba(26, 35, 126, 0.1);
`;



const ProjectGroup = styled.div`
  margin-bottom: 3rem;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  background: #f8f9fa;
`;

const ProjectGroupTitle = styled.h3`
  color: #1a237e;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #283593 0%, #3949ab 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  border-bottom: 3px solid #3949ab;
  padding-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: -3px;
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, #ffd700, transparent);
    border-radius: 2px;
  }
  
  box-shadow: 0 2px 4px rgba(57, 73, 171, 0.1);
`;

const EntaxiAmountChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1.3rem;
  background: linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%) !important;
  border: 2px solid #667eea;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.2);
  white-space: nowrap;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
  margin-left: auto;
  z-index: 1;
  /* CRITICAL: Override parent's transparent text fill */
  -webkit-text-fill-color: initial !important;
  background-clip: padding-box !important;
  -webkit-background-clip: padding-box !important;
  isolation: isolate;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.15), transparent);
    transition: left 0.5s ease;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
    border-color: #5a67d8;
    background: linear-gradient(135deg, #e8f0ff 0%, #ede8ff 100%);
    
    &::before {
      left: 100%;
    }
  }
`;

const EntaxiIcon = styled.span`
  font-size: 1.2rem;
  line-height: 1;
  display: block;
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
`;

const EntaxiLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a202c !important;
  letter-spacing: 0.3px;
  white-space: nowrap;
  display: block;
  -webkit-text-fill-color: #1a202c !important;
`;

const EntaxiValue = styled.span`
  font-size: 1.1rem;
  font-weight: 800;
  color: #000000 !important;
  letter-spacing: 0.5px;
  white-space: nowrap;
  display: block;
  -webkit-text-fill-color: #000000 !important;
`;


const SubprojectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  grid-auto-rows: 1fr; /* Όλες οι σειρές έχουν το ίδιο ύψος */
  align-items: stretch; /* Stretch για να γεμίσουν τον χώρο */
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem;
  color: #6c757d;
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyStateText = styled.p`
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
`;

const EmptyStateSubtext = styled.p`
  font-size: 1rem;
  opacity: 0.7;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 1.2rem;
  color: #6c757d;
`;

// Σταθερή μπάρα κουμπιών δεξιά - για όλους τους χρήστες
const AdminSidebar = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px 0 0 20px;
  padding: 20px 16px;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-right: none;
  width: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 100vh;
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
  
  @media (max-width: 1200px) {
    display: none; /* Κρύψε σε μικρές οθόνες */
  }
`;

const AdminButton = styled.button`
  background: linear-gradient(135deg, #2c5282 0%, #2b6cb0 100%);
  color: white;
  border: none;
  padding: 14px 18px;
  border-radius: 10px;
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: none;
  letter-spacing: 0.3px;
  white-space: normal;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  width: 100%;
  box-shadow: 0 2px 8px rgba(44, 82, 130, 0.25);
  line-height: 1.4;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(44, 82, 130, 0.35);
    background: linear-gradient(135deg, #2b6cb0 0%, #3182ce 100%);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(44, 82, 130, 0.25);
  }
`;

const AdminButtonIcon = styled.span`
  margin-right: 6px;
  font-size: 0.9rem;
`;

// Ειδικό κουμπί για Εξαγωγή Δεδομένων με διαφορετικό στυλ
const ExportButton = styled(AdminButton)`
  /* Χρησιμοποιεί το ίδιο στυλ με το AdminButton */
`;

// 🚀 ΕΝΤΥΠΩΣΙΑΚΟ ΚΟΥΜΠΙ ΑΝΑΝΕΩΣΗΣ
const RefreshButton = styled(AdminButton)`
  /* Χρησιμοποιεί το ίδιο στυλ με το AdminButton */
`;

const RefreshIcon = styled.span`
  font-size: 1.3rem;
  animation: spin 2s linear infinite;
  margin-bottom: 4px;
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  ${RefreshButton}:hover & {
    animation: spin 0.5s linear infinite;
  }
`;

const RefreshText = styled.div`
  line-height: 1.1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const RefreshEmphasis = styled.span`
  font-size: 0.8rem;
  font-weight: 900;
  color: #ffff00;
  text-shadow: 0 0 10px rgba(255, 255, 0, 0.8);
`;

const RefreshGlow = styled.div`
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  border-radius: 15px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;

  ${RefreshButton}:hover & {
    opacity: 1;
    animation: glow 1.5s ease infinite;
  }

  @keyframes glow {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
  }
`;

const BackupButton = styled(AdminButton)`
  /* Χρησιμοποιεί το ίδιο στυλ με το AdminButton */
`;

const BackupIcon = styled.span`
  font-size: 1.3rem;
  margin-bottom: 4px;
`;

const BackupText = styled.div`
  line-height: 1.1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const NotesButton = styled(AdminButton)`
  /* Χρησιμοποιεί το ίδιο στυλ με το AdminButton */
`;

const NotesButtonIcon = styled.span`
  margin-right: 6px;
  font-size: 1rem;
`;

const NotesOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(240, 245, 250, 0.92);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12000;
  padding: 20px;
  animation: fadeIn 0.3s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const NotesContainer = styled.div`
  width: min(1600px, 98vw);
  height: min(900px, 95vh);
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.99) 0%, 
    rgba(250, 252, 255, 0.97) 30%,
    rgba(248, 250, 252, 0.98) 60%,
    rgba(241, 245, 249, 0.99) 100%
  );
  border-radius: 32px;
  box-shadow: 
    0 32px 120px rgba(100, 116, 139, 0.2),
    0 16px 48px rgba(100, 116, 139, 0.15),
    0 0 0 1px rgba(203, 213, 225, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.5);
  display: flex;
  overflow: hidden;
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
      transparent 0%,
      rgba(99, 102, 241, 0.2) 50%,
      transparent 100%
    );
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const NotesSidebar = styled.div`
  width: 320px;
  background: linear-gradient(180deg, 
    rgba(248, 250, 252, 0.98) 0%, 
    rgba(241, 245, 249, 0.95) 50%,
    rgba(248, 250, 252, 0.98) 100%
  );
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  border-right: 1px solid rgba(203, 213, 225, 0.4);
  overflow-y: auto;
  position: relative;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(241, 245, 249, 0.5);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(203, 213, 225, 0.6);
    border-radius: 10px;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(148, 163, 184, 0.7);
    }
  }
`;

const NotesMain = styled.div`
  flex: 1;
  padding: 40px 36px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  overflow: hidden;
  background: linear-gradient(180deg, 
    rgba(255, 255, 255, 0.5) 0%,
    rgba(248, 250, 252, 0.3) 100%
  );
`;

const NotesSidebarHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const NotesSidebarTitle = styled.h3`
  margin: 0;
  color: #334155;
  font-size: 1.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  padding-bottom: 8px;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 40px;
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 2px;
  }
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GroupListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const GroupDeleteButton = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(203, 213, 225, 0.5);
  background: rgba(255, 255, 255, 0.8);
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #dc2626;
  }
`;

const GroupButton = styled.button`
  background: ${({ active, color }) =>
    active 
      ? `linear-gradient(135deg, ${hexToRgba(color || '#6366f1', 0.18)} 0%, ${hexToRgba(color || '#6366f1', 0.1)} 100%)` 
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(241, 245, 249, 0.8) 100%)'};
  border: 2px solid ${({ active, color }) => (active ? hexToRgba(color || '#6366f1', 0.6) : 'rgba(203, 213, 225, 0.5)')};
  color: ${({ active }) => (active ? '#1e293b' : '#64748b')};
  border-radius: 16px;
  padding: 16px 18px;
  text-align: left;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${({ active, color }) => 
    active 
      ? `0 12px 32px ${hexToRgba(color || '#6366f1', 0.3)}, 0 4px 12px ${hexToRgba(color || '#6366f1', 0.2)}` 
      : '0 2px 8px rgba(100, 116, 139, 0.08), 0 1px 3px rgba(100, 116, 139, 0.05)'};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255, 255, 255, 0.4), 
      transparent
    );
    transition: left 0.5s ease;
  }

  &:hover::before {
    left: 100%;
  }

  span {
    font-size: 0.8rem;
    opacity: ${({ active }) => (active ? 0.8 : 0.65)};
    color: ${({ active }) => (active ? '#475569' : '#94a3b8')};
    font-weight: 500;
    transition: all 0.3s ease;
  }

  &:hover {
    transform: translateY(-3px) scale(1.02);
    border-color: ${({ color }) => hexToRgba(color || '#6366f1', 0.7)};
    box-shadow: ${({ color }) => 
      `0 16px 40px ${hexToRgba(color || '#6366f1', 0.35)}, 0 6px 16px ${hexToRgba(color || '#6366f1', 0.25)}`};
  }

  &:active {
    transform: translateY(-1px) scale(1);
  }
`;

const GroupForm = styled.div`
  margin-top: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(203, 213, 225, 0.5);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GroupFormRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const GroupInput = styled.input`
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(203, 213, 225, 0.6);
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  font-size: 0.9rem;
  font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif;
  transition: all 0.2s ease;

  &::placeholder {
    color: #94a3b8;
    font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif;
  }

  &:focus {
    border-color: rgba(99, 102, 241, 0.6);
    outline: none;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    background: rgba(255, 255, 255, 1);
  }
`;

const ColorInput = styled.input`
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: transparent;
  cursor: pointer;
`;

const GroupFormButton = styled.button`
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(59, 130, 246, 0.35);
  }
`;

const NotesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const NotesHeaderTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  h2 {
    margin: 0;
    color: #1e293b;
    font-size: 1.6rem;
    font-weight: 800;
    background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }

  span {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
  }
`;

const NotesCloseButton = styled.button`
  background: rgba(241, 245, 249, 0.9);
  border: 1px solid rgba(203, 213, 225, 0.5);
  color: #475569;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.4);
    color: #6366f1;
  }
`;

const NotesSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const NotesSearchInput = styled(GroupInput)`
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(203, 213, 225, 0.6);
`;

const NoteComposer = styled.div`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.9) 100%
  );
  border: 1px solid rgba(203, 213, 225, 0.5);
  border-radius: 24px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 
    0 12px 40px rgba(100, 116, 139, 0.12),
    0 4px 16px rgba(100, 116, 139, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  position: relative;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, 
      #6366f1 0%,
      #8b5cf6 50%,
      #6366f1 100%
    );
    border-radius: 24px 24px 0 0;
    opacity: 0.6;
  }

  &:hover {
    box-shadow: 
      0 16px 48px rgba(100, 116, 139, 0.15),
      0 6px 20px rgba(100, 116, 139, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
  }
`;

const NoteComposerRow = styled.div`
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
`;

const NoteGroupSelect = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(203, 213, 225, 0.6);
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  font-size: 0.9rem;
  font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;

  &:focus {
    border-color: rgba(99, 102, 241, 0.6);
    outline: none;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    background: rgba(255, 255, 255, 1);
  }
`;

const NoteTextInput = styled.textarea`
  width: 100%;
  min-height: 120px;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 0.95rem;
  font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif;
  border: 1px solid rgba(203, 213, 225, 0.6);
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  resize: vertical;
  transition: all 0.2s ease;

  &::placeholder {
    color: #94a3b8;
    font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif;
  }

  &:focus {
    border-color: rgba(99, 102, 241, 0.6);
    outline: none;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    background: rgba(255, 255, 255, 1);
  }
`;

const NoteSubmitRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const SubtleHint = styled.span`
  color: #94a3b8;
  font-size: 0.78rem;
`;

const NoteSubmitButton = styled.button`
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
  border: none;
  border-radius: 12px;
  padding: 12px 22px;
  color: white;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(13, 148, 136, 0.4);
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 36px rgba(13, 148, 136, 0.5);
  }
`;

const NotesGrid = styled.div`
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 8px 4px 20px 4px;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(241, 245, 249, 0.5);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(203, 213, 225, 0.6);
    border-radius: 10px;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(148, 163, 184, 0.7);
    }
  }
`;

const NoteCard = styled.div`
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.9) 100%
  );
  border: 1px solid rgba(203, 213, 225, 0.5);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 
    0 6px 20px rgba(100, 116, 139, 0.1),
    0 2px 8px rgba(100, 116, 139, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: ${({ 'data-accent': accent }) => accent 
      ? `linear-gradient(180deg, ${accent}, ${accent}dd)` 
      : 'linear-gradient(180deg, #6366f1, #8b5cf6)'};
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 70%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    box-shadow: 
      0 12px 32px rgba(100, 116, 139, 0.15),
      0 4px 16px rgba(100, 116, 139, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transform: translateY(-4px) scale(1.01);
    border-color: rgba(99, 102, 241, 0.4);

    &::before {
      opacity: 1;
    }

    &::after {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-2px) scale(1);
  }
`;

const NoteTitle = styled.h4`
  margin: 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
`;

const NoteContent = styled.p`
  margin: 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const NoteMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: #94a3b8;
  font-size: 0.75rem;
`;

const NotesEmptyState = styled.div`
  flex: 1;
  border-radius: 20px;
  border: 1px dashed rgba(203, 213, 225, 0.6);
  background: rgba(248, 250, 252, 0.6);
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
  text-align: center;
`;

const Tag = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  font-size: 0.72rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

const NoteActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: auto;
  z-index: 1;
`;

const NoteActionButton = styled.button`
  flex: 1;
  background: rgba(241, 245, 249, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.5);
  border-radius: 10px;
  padding: 8px;
  color: #475569;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #dc2626;
  }
`;

const NoteEditButton = styled(NoteActionButton)`
  &:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: #2563eb;
  }
`;

const NoteCancelButton = styled(NoteActionButton)`
  background: rgba(241, 245, 249, 0.9);
  &:hover {
    background: rgba(148, 163, 184, 0.15);
    border-color: rgba(148, 163, 184, 0.4);
    color: #64748b;
  }
`;

// Modal for viewing/editing notes
const NoteModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const NoteModalContainer = styled.div`
  background: white;
  border-radius: 24px;
  width: min(800px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const NoteModalHeader = styled.div`
  padding: 24px 28px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NoteModalTitle = styled.h2`
  margin: 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
`;

const NoteModalCloseButton = styled.button`
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #334155;
  }
`;

const NoteModalContent = styled.div`
  padding: 28px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const NoteModalField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const NoteModalLabel = styled.label`
  font-weight: 600;
  color: #334155;
  font-size: 0.9rem;
`;

const NoteModalInput = styled.input`
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const NoteModalTextarea = styled.textarea`
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  min-height: 200px;
  resize: vertical;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const NoteModalFooter = styled.div`
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const NoteModalButton = styled.button`
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${props => props.primary ? `
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
    }
  ` : `
    background: #f1f5f9;
    color: #475569;

    &:hover {
      background: #e2e8f0;
    }
  `}
`;

const ContentWrapper = styled.div`
  margin-right: 200px; /* Άφησε χώρο για τη σταθερή μπάρα - ακριβώς το πλάτος του sidebar */
  padding: 2rem;
  width: calc(100% - 200px); /* Αφαιρούμε το πλάτος του sidebar */
  max-width: calc(100% - 200px);
  
  @media (max-width: 1200px) {
    margin-right: 0; /* Σε μικρές οθόνες κρύψε τη μπάρα */
    width: 100%;
    max-width: 100%;
  }
`;

function Dashboard({ currentUser, appVersion, appConfig = {}, onLogout }) {
  const userRole = currentUser?.role || 'USER';
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [entaxeis, setEntaxeis] = useState([]);
  const [proskliseis, setProskliseis] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEgkriseisFormOpen, setIsEgkriseisFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfViewer, setPdfViewer] = useState({ isOpen: false, filePath: '', fileName: '' });
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    projectTitle: '',
    subprojectTitle: '',
    kaCode: '',
    aleCode: '',
    supervisor: [],
    projectType: [],
    fundingSource: [],
    fundingDetails: [],
    projectStatus: [],
    implementationForm: [],
    characterization: '',
    hasSupplementaryContracts: '',
    contractsCount: '',
    hasEgkriseisDialthesisPistosis: '',
    hasProsklisiLink: '',
    hasEntaxiLink: '',
    hasComments: '',
    hasApeComments: '',
    hasRemainingComments: '',
    hasEisigitikiEkthesi: '',
    misPraxhsCode: '',
    remainingYear: '',
    remainingAmountCondition: 'all',
    contractDateFrom: '',
    contractDateTo: '',
    contractProcessDateFrom: '',
    contractProcessDateTo: '',
    approvedAmountMin: '',
    approvedAmountMax: '',
    contractAmountMin: '',
    contractAmountMax: '',
    apeAmountMin: '',
    apeAmountMax: '',
    sortBy: 'kaCode',
    sortOrder: 'asc'
  });
  
  // Scroll position preservation
  const contentWrapperRef = useRef(null);
  const savedScrollPosition = useRef(0);
  const shouldRestoreScroll = useRef(false);
  
  // Quick Search states
  const [quickSearchText, setQuickSearchText] = useState('');
  const [quickSearchStatus, setQuickSearchStatus] = useState('');
  const [quickSearchType, setQuickSearchType] = useState('');
  const [fileManager, setFileManager] = useState({ 
    isOpen: false, 
    projectId: null, 
    subprojectId: null, 
    files: [], 
    fileGroups: [] 
  });
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTechnicalProgramOpen, setIsTechnicalProgramOpen] = useState(false);
  const [isInvestExportOpen, setIsInvestExportOpen] = useState(false);
  const [isBackupManagerOpen, setIsBackupManagerOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isEntaxisOpen, setIsEntaxisOpen] = useState(false);
  const [entaxisProjectFilter, setEntaxisProjectFilter] = useState(null);
  const [isProsklisisOpen, setIsProsklisisOpen] = useState(false);
  const [prosklisiProjectFilter, setProsklisiProjectFilter] = useState(null);
  const [selectedProsklisiId, setSelectedProsklisiId] = useState(null);
  const [isCreditApprovalsOpen, setIsCreditApprovalsOpen] = useState(false);
  const [creditApprovals, setCreditApprovals] = useState({});
  const [linkedEgkriseis, setLinkedEgkriseis] = useState({});
  const [egkriseisRefreshTrigger, setEgkriseisRefreshTrigger] = useState(0);
  const [isDocumentTemplatesOpen, setIsDocumentTemplatesOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [noteGroups, setNoteGroups] = useState(() => [{
    id: DEFAULT_NOTE_GROUP_ID,
    name: 'Γενικές Σημειώσεις',
    color: '#6366f1'
  }]);
  const [selectedNoteGroupId, setSelectedNoteGroupId] = useState(DEFAULT_NOTE_GROUP_ID);
  const [notes, setNotes] = useState([]);
  const [groupForm, setGroupForm] = useState({ name: '', color: '#38bdf8' });
  const [noteForm, setNoteForm] = useState({ 
    title: '', 
    content: '', 
    tags: '', 
    groupId: DEFAULT_NOTE_GROUP_ID,
    priority: 'medium', // low, medium, high
    status: 'new', // new, in-progress, completed
    dueDate: '',
    checklist: [] // Array of { id, text, completed }
  });
  const [notesSearch, setNotesSearch] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [notesSortBy, _setNotesSortBy] = useState('createdAt');
  // eslint-disable-next-line no-unused-vars
  const [notesFilterStatus, _setNotesFilterStatus] = useState('all');
  // eslint-disable-next-line no-unused-vars
  const [notesFilterPriority, _setNotesFilterPriority] = useState('all');
  const [editingNote, setEditingNote] = useState(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedNoteForModal, setSelectedNoteForModal] = useState(null);
  
  // 🚀 CACHE SYSTEM για να μην φορτώνονται τα στατιστικά κάθε φορά
  const [dataCache, setDataCache] = useState({
    projects: null,
    entaxeis: null,
    proskliseis: null,
    creditApprovals: null,
    linkedEgkriseis: null,
    lastCacheTime: null,
    needsRefresh: false
  });

  // Επαναφορά scroll position όταν αλλάζουν τα projects (μετά από save)
  useEffect(() => {
    if (shouldRestoreScroll.current && contentWrapperRef.current && filteredProjects.length > 0) {
      // Χρησιμοποιούμε πολλαπλά requestAnimationFrame και setTimeout για να επιβεβαιώσουμε ότι το DOM έχει render
      const restoreScroll = () => {
        if (contentWrapperRef.current) {
          contentWrapperRef.current.scrollTop = savedScrollPosition.current;
          shouldRestoreScroll.current = false;
        }
      };
      
      // Δοκιμάζουμε πολλές φορές για να βεβαιωθούμε
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(restoreScroll, 50);
          setTimeout(restoreScroll, 150);
          setTimeout(restoreScroll, 300);
        });
      });
    }
  }, [filteredProjects.length]);

  useEffect(() => {
    loadDataWithCache();
    loadLinkedEgkriseis();

    // Listener για file watcher events - χρήση functional update για fresh state
    const handleLocksChanged = async () => {
      console.log('Locks changed event received, refreshing lock status...');
      // Χρήση functional update για να πάρουμε το fresh state
      setProjects(currentProjects => {
        if (currentProjects.length === 0) return currentProjects;
        
        // Ασύγχρονη ενημέρωση locks με timeout για να μην block το UI
        Promise.all(
          currentProjects.map(async (project) => {
            try {
              const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
              return { projectId: project.projectId, isLocked: lockStatus.locked };
            } catch (error) {
              console.error('Error checking lock for project:', project.projectId, error);
              return { projectId: project.projectId, isLocked: project.isLocked };
            }
          })
        ).then(lockChecks => {
          const hasChanges = lockChecks.some((check) => {
            const currentProject = currentProjects.find(p => p.projectId === check.projectId);
            return currentProject && currentProject.isLocked !== check.isLocked;
          });
          
          if (hasChanges) {
            console.log('Lock status changes detected, updating UI silently...');
            setProjects(prevProjects => {
              return prevProjects.map(project => {
                const lockCheck = lockChecks.find(c => c.projectId === project.projectId);
                return lockCheck ? { ...project, isLocked: lockCheck.isLocked } : project;
              }).sort((a, b) => {
                const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
                if (projectComparison !== 0) return projectComparison;
                return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
              });
            });
          }
        }).catch(error => {
          console.error('Error updating lock status:', error);
        });
        
        return currentProjects; // Return immediately, update will happen async
      });
    };

    // Εγγραφή στο event
    const unsubscribe = ipcRenderer.on('locks-changed', handleLocksChanged);

    return () => {
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load linked egkriseis only once when component mounts
  useEffect(() => {
    loadLinkedEgkriseis();
  }, []); // Load only once on mount to avoid unnecessary re-renders

  // Load notes and groups from file on mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const data = await ipcRenderer.invoke('load-notes');
        if (data && data.notes && Array.isArray(data.notes)) {
          setNotes(data.notes);
        }
        if (data && data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
          setNoteGroups(data.groups);
        }
      } catch (error) {
        console.error('Error loading notes from file:', error);
      }
    };
    loadNotes();
  }, []);

  // Save notes to file whenever they change (with debounce)
  const saveNotesTimeoutRef = useRef(null);
  useEffect(() => {
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }
    
    saveNotesTimeoutRef.current = setTimeout(async () => {
      try {
        await ipcRenderer.invoke('save-notes', {
          notes,
          groups: noteGroups
        });
      } catch (error) {
        console.error('Error saving notes to file:', error);
      }
    }, 500); // Debounce 500ms
    
    return () => {
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current);
      }
    };
  }, [notes, noteGroups]);

  useEffect(() => {
    if (!noteGroups.some(group => group.id === selectedNoteGroupId)) {
      if (noteGroups.length > 0) {
        setSelectedNoteGroupId(noteGroups[0].id);
      } else {
        setSelectedNoteGroupId(DEFAULT_NOTE_GROUP_ID);
      }
    }
  }, [noteGroups, selectedNoteGroupId]);

  useEffect(() => {
    setNoteForm(prev => ({ ...prev, groupId: selectedNoteGroupId }));
  }, [selectedNoteGroupId]);

  useEffect(() => {
    setFilteredProjects(projects);
  }, [projects]);


  // Debounce για quickSearchText - αποφυγή συνεχών κλήσεων applyFilters
  const debounceTimeoutRef = useRef(null);
  const [debouncedQuickSearchText, setDebouncedQuickSearchText] = useState('');
  const quickSearchInputRef = useRef(null);

  useEffect(() => {
    // Καθαρισμός του προηγούμενου timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Νέο timeout για debounce (300ms)
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuickSearchText(quickSearchText);
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [quickSearchText]);

  // Helper function to parse Greek amounts
  const parseGreekAmount = (amountStr) => {
    if (!amountStr || amountStr === '') return 0;
    return parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Helper function to compare dates
  const isDateInRange = (dateStr, fromDate, toDate) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate)) return false;
    return true;
  };

  // Count active filters
  const countActiveFilters = useCallback((filters) => {
    let count = 0;
    if (filters.projectTitle) count++;
    if (filters.subprojectTitle) count++;
    if (filters.kaCode) count++;
    if (filters.misPraxhsCode) count++;
    if (filters.supervisor && filters.supervisor.length > 0) count++;
    if (filters.projectType && filters.projectType.length > 0) count++;
    if (filters.fundingSource && filters.fundingSource.length > 0) count++;
    if (filters.fundingDetails && filters.fundingDetails.length > 0) count++;
    if (filters.projectStatus && filters.projectStatus.length > 0) count++;
    if (filters.implementationForm && filters.implementationForm.length > 0) count++;
    if (filters.characterization) count++;
    if (filters.hasSupplementaryContracts) count++;
    if (filters.contractsCount) count++;
    if (filters.hasEgkriseisDialthesisPistosis) count++;
    if (filters.hasProsklisiLink) count++;
    if (filters.hasEntaxiLink) count++;
    if (filters.hasEisigitikiEkthesi) count++;
    if (filters.remainingYear) count++;
    if (filters.contractDateFrom || filters.contractDateTo) count++;
    if (filters.contractProcessDateFrom || filters.contractProcessDateTo) count++;
    if (filters.approvedAmountMin || filters.approvedAmountMax) count++;
    if (filters.contractAmountMin || filters.contractAmountMax) count++;
    if (filters.apeAmountMin || filters.apeAmountMax) count++;
    return count;
  }, []);

  // Memoized applyFilters with advanced filtering and sorting
  const applyFilters = useCallback((filters) => {
    const performFiltering = () => {
      let filtered = [...projects];

      // Quick Search - text search in all fields
      if (debouncedQuickSearchText) {
        filtered = filtered.filter(p => {
          const aleCodesMatch = (p.aleCodes && Array.isArray(p.aleCodes) && 
            p.aleCodes.some(code => containsSearchTerm(code, debouncedQuickSearchText))) ||
            containsSearchTerm(p.aleCode, debouncedQuickSearchText);
          
          return containsSearchTerm(p.projectTitle, debouncedQuickSearchText) ||
            containsSearchTerm(p.subprojectTitle, debouncedQuickSearchText) ||
            containsSearchTerm(p.kaCode, debouncedQuickSearchText) ||
            aleCodesMatch ||
            containsSearchTerm(p.supervisor, debouncedQuickSearchText);
        });
      }

      // Quick Search - status filter
      if (quickSearchStatus) {
        filtered = filtered.filter(p => p.projectStatus === quickSearchStatus);
      }

      // Quick Search - project type filter
      if (quickSearchType) {
        filtered = filtered.filter(p => p.projectType === quickSearchType);
      }

      // Advanced Filters
      if (filters.projectTitle) {
        filtered = filtered.filter(p => containsSearchTerm(p.projectTitle, filters.projectTitle));
      }

      if (filters.subprojectTitle) {
        filtered = filtered.filter(p => containsSearchTerm(p.subprojectTitle, filters.subprojectTitle));
      }

      if (filters.kaCode) {
        filtered = filtered.filter(p => containsSearchTerm(p.kaCode, filters.kaCode));
      }

      if (filters.aleCode) {
        filtered = filtered.filter(p => {
          if (p.aleCodes && Array.isArray(p.aleCodes)) {
            return p.aleCodes.some(code => containsSearchTerm(code, filters.aleCode));
          }
          return containsSearchTerm(p.aleCode, filters.aleCode);
        });
      }

      if (filters.misPraxhsCode) {
        filtered = filtered.filter(p => containsSearchTerm(p.misPraxhsCode, filters.misPraxhsCode));
      }

      if (filters.supervisor && filters.supervisor.length > 0) {
        filtered = filtered.filter(p => filters.supervisor.includes(p.supervisor));
      }

      if (filters.projectType && filters.projectType.length > 0) {
        filtered = filtered.filter(p => filters.projectType.includes(p.projectType));
      }

      if (filters.fundingSource && filters.fundingSource.length > 0) {
        filtered = filtered.filter(p => filters.fundingSource.includes(p.fundingSource));
      }

      if (filters.fundingDetails && filters.fundingDetails.length > 0) {
        filtered = filtered.filter(p => 
          p.fundingDetails && filters.fundingDetails.includes(p.fundingDetails)
        );
      }

      if (filters.projectStatus && filters.projectStatus.length > 0) {
        filtered = filtered.filter(p => filters.projectStatus.includes(p.projectStatus));
      }

      if (filters.implementationForm && filters.implementationForm.length > 0) {
        filtered = filtered.filter(p => filters.implementationForm.includes(p.implementationForm));
      }

      if (filters.characterization) {
        filtered = filtered.filter(p => getCharacterization(p) === filters.characterization);
      }

      // Boolean filters
      if (filters.hasSupplementaryContracts === 'yes') {
        filtered = filtered.filter(p => p.hasSupplementaryContracts === true);
      } else if (filters.hasSupplementaryContracts === 'no') {
        filtered = filtered.filter(p => !p.hasSupplementaryContracts);
      }

      if (filters.contractsCount) {
        if (filters.contractsCount === '0') {
          filtered = filtered.filter(p => !p.contracts || p.contracts.length === 0);
        } else if (filters.contractsCount === '1') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length === 1);
        } else if (filters.contractsCount === '2') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length === 2);
        } else if (filters.contractsCount === '3+') {
          filtered = filtered.filter(p => p.contracts && p.contracts.length >= 3);
        }
      }

      // Egkriseis filter - check if button exists (via egkrisiLinks)
      if (filters.hasEgkriseisDialthesisPistosis === 'yes') {
        filtered = filtered.filter(p => p.hasEgkrisiLink === true);
      } else if (filters.hasEgkriseisDialthesisPistosis === 'no') {
        filtered = filtered.filter(p => !p.hasEgkrisiLink);
      }

      // Prosklisi link filter
      if (filters.hasProsklisiLink === 'yes') {
        filtered = filtered.filter(p => p.hasProsklisiLink === true);
      } else if (filters.hasProsklisiLink === 'no') {
        filtered = filtered.filter(p => !p.hasProsklisiLink);
      }

      // Entaxi link filter
      if (filters.hasEntaxiLink === 'yes') {
        filtered = filtered.filter(p => p.hasEntaxiLink === true);
      } else if (filters.hasEntaxiLink === 'no') {
        filtered = filtered.filter(p => !p.hasEntaxiLink);
      }

      if (filters.hasEisigitikiEkthesi === 'yes') {
        filtered = filtered.filter(p => p.eisigitikiEkthesi && p.eisigitikiEkthesi.trim().length > 0);
      } else if (filters.hasEisigitikiEkthesi === 'no') {
        filtered = filtered.filter(p => !p.eisigitikiEkthesi || p.eisigitikiEkthesi.trim().length === 0);
      }

      // Remaining amounts filter
      if (filters.remainingYear) {
        filtered = filtered.filter(p => {
          if (!p.remainingAmountsByYear || !Array.isArray(p.remainingAmountsByYear)) {
            // Αν δεν έχει το πεδίο, θεωρείται ως κενό
            return filters.remainingAmountCondition === 'zeroOrEmpty';
          }
          
          const yearEntry = p.remainingAmountsByYear.find(item => item.year === filters.remainingYear);
          
          if (!yearEntry) {
            // Αν δεν υπάρχει entry για το έτος, θεωρείται ως κενό
            return filters.remainingAmountCondition === 'zeroOrEmpty' || filters.remainingAmountCondition === 'all';
          }
          
          const amountStr = yearEntry.amount || '';
          const amount = parseGreekAmount(amountStr);
          
          if (filters.remainingAmountCondition === 'hasAmount') {
            return amount > 0;
          } else if (filters.remainingAmountCondition === 'zeroOrEmpty') {
            return amount === 0 || amountStr.trim() === '';
          }
          return true; // 'all'
        });
      }

      // Date range filters
      if (filters.contractDateFrom || filters.contractDateTo) {
        filtered = filtered.filter(p => 
          isDateInRange(p.contractDate, filters.contractDateFrom, filters.contractDateTo)
        );
      }

      if (filters.contractProcessDateFrom || filters.contractProcessDateTo) {
        filtered = filtered.filter(p => 
          isDateInRange(p.contractProcessStartDate, filters.contractProcessDateFrom, filters.contractProcessDateTo)
        );
      }

      // Amount range filters
      if (filters.approvedAmountMin) {
        const min = parseGreekAmount(filters.approvedAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.approvedAmount) >= min);
      }

      if (filters.approvedAmountMax) {
        const max = parseGreekAmount(filters.approvedAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.approvedAmount) <= max);
      }

      if (filters.contractAmountMin) {
        const min = parseGreekAmount(filters.contractAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.contractAmount) >= min);
      }

      if (filters.contractAmountMax) {
        const max = parseGreekAmount(filters.contractAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.contractAmount) <= max);
      }

      if (filters.apeAmountMin) {
        const min = parseGreekAmount(filters.apeAmountMin);
        filtered = filtered.filter(p => parseGreekAmount(p.apeAmount) >= min);
      }

      if (filters.apeAmountMax) {
        const max = parseGreekAmount(filters.apeAmountMax);
        filtered = filtered.filter(p => parseGreekAmount(p.apeAmount) <= max);
      }

      // SORTING
      if (filters.sortBy) {
        filtered.sort((a, b) => {
          let aVal, bVal;

          switch (filters.sortBy) {
            case 'kaCode':
              aVal = a.kaCode || '';
              bVal = b.kaCode || '';
              break;
            case 'aleCode':
              aVal = (a.aleCodes && a.aleCodes.length > 0) ? a.aleCodes.join(' ') : (a.aleCode || '');
              bVal = (b.aleCodes && b.aleCodes.length > 0) ? b.aleCodes.join(' ') : (b.aleCode || '');
              break;
            case 'projectTitle':
              aVal = a.projectTitle || '';
              bVal = b.projectTitle || '';
              break;
            case 'subprojectTitle':
              aVal = a.subprojectTitle || '';
              bVal = b.subprojectTitle || '';
              break;
            case 'approvedAmount':
              aVal = parseGreekAmount(a.approvedAmount);
              bVal = parseGreekAmount(b.approvedAmount);
              break;
            case 'contractAmount':
              aVal = parseGreekAmount(a.contractAmount);
              bVal = parseGreekAmount(b.contractAmount);
              break;
            case 'apeAmount':
              aVal = parseGreekAmount(a.apeAmount);
              bVal = parseGreekAmount(b.apeAmount);
              break;
            case 'contractDate':
              aVal = a.contractDate ? new Date(a.contractDate).getTime() : 0;
              bVal = b.contractDate ? new Date(b.contractDate).getTime() : 0;
              break;
            case 'contractProcessStartDate':
              aVal = a.contractProcessStartDate ? new Date(a.contractProcessStartDate).getTime() : 0;
              bVal = b.contractProcessStartDate ? new Date(b.contractProcessStartDate).getTime() : 0;
              break;
            case 'projectStatus':
              aVal = a.projectStatus || '';
              bVal = b.projectStatus || '';
              break;
            case 'supervisor':
              aVal = a.supervisor || '';
              bVal = b.supervisor || '';
              break;
            default:
              aVal = a.kaCode || '';
              bVal = b.kaCode || '';
          }

          // Comparison
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const comparison = aVal.localeCompare(bVal, 'el');
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          } else {
            const comparison = aVal - bVal;
            return filters.sortOrder === 'desc' ? -comparison : comparison;
          }
        });
      }

      setFilteredProjects(filtered);
    };

    if (typeof window !== 'undefined' && window.requestIdleCallback) {
      window.requestIdleCallback(performFiltering, { timeout: 100 });
    } else {
      setTimeout(performFiltering, 0);
    }
  }, [projects, debouncedQuickSearchText, quickSearchStatus, quickSearchType]);

  // Apply filters when dependencies change
  const applyFiltersTimeoutRef = useRef(null);
  useEffect(() => {
    if (applyFiltersTimeoutRef.current) {
      clearTimeout(applyFiltersTimeoutRef.current);
    }

    applyFiltersTimeoutRef.current = setTimeout(() => {
      applyFilters(advancedFilters);
    }, 0);

    return () => {
      if (applyFiltersTimeoutRef.current) {
        clearTimeout(applyFiltersTimeoutRef.current);
      }
    };
  }, [debouncedQuickSearchText, quickSearchStatus, quickSearchType, advancedFilters, applyFilters]);

  // Realtime lock monitoring - αθόρυβος έλεγχος με βελτιστοποίηση
  useEffect(() => {
    // Χρήση ref για να αποφύγουμε stale closures
    let isActive = true;
    let timeoutId = null;
    let intervalId = null;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      // Μόνο αν δεν είμαστε σε φόρτωση
      setLoading(currentLoading => {
        if (currentLoading) return currentLoading;
        
        setProjects(currentProjects => {
          if (currentProjects.length === 0) return currentProjects;
          
          // Batch checking - limit concurrent requests
          const BATCH_SIZE = 10;
          const batches = [];
          for (let i = 0; i < currentProjects.length; i += BATCH_SIZE) {
            batches.push(currentProjects.slice(i, i + BATCH_SIZE));
          }
          
          // Process batches sequentially to avoid overwhelming the system
          Promise.all(
            batches.map(async (batch, batchIndex) => {
              // Small delay between batches to prevent blocking
              if (batchIndex > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              return Promise.all(
                batch.map(async (project) => {
                  try {
                    const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
                    return { projectId: project.projectId, isLocked: lockStatus.locked };
                  } catch (error) {
                    return { projectId: project.projectId, isLocked: project.isLocked };
                  }
                })
              );
            })
          ).then(batchResults => {
            if (!isActive) return;
            
            const lockChecks = batchResults.flat();
            setProjects(prevProjects => {
              const hasChanges = lockChecks.some((check) => {
                const currentProject = prevProjects.find(p => p.projectId === check.projectId);
                return currentProject && currentProject.isLocked !== check.isLocked;
              });
              
              if (hasChanges) {
                console.log('Lock status changes detected, updating UI silently...');
                return prevProjects.map(project => {
                  const lockCheck = lockChecks.find(c => c.projectId === project.projectId);
                  return lockCheck ? { ...project, isLocked: lockCheck.isLocked } : project;
                }).sort((a, b) => {
                  const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
                  if (projectComparison !== 0) return projectComparison;
                  return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
                });
              }
              return prevProjects;
            });
          }).catch(error => {
            console.error('Error checking lock status:', error);
          });
          
          return currentProjects;
        });
        
        return currentLoading;
      });
    };
    
    // Αρχική εκτέλεση με delay
    timeoutId = setTimeout(() => {
      checkLocks();
      
      // Periodic check - μειωμένη συχνότητα για καλύτερη απόδοση
      intervalId = setInterval(() => {
        if (isActive) {
          checkLocks();
        }
      }, 10000); // Κάθε 10 δευτερόλεπτα (από 5) για μείωση φορτίου
    }, 2000); // Αρχικό delay 2 δευτερόλεπτα
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty deps - uses functional updates


  // 🚀 ΚΕΝΤΡΙΚΗ FUNCTION ΜΕ CACHE - Φορτώνει δεδομένα μόνο αν χρειάζεται - NON-BLOCKING
  const loadDataWithCache = async (forceRefresh = false) => {
    try {
      // Χρήση setTimeout για να μην μπλοκάρει το UI thread
      await new Promise(resolve => setTimeout(resolve, 0));
      
      setLoading(true);
      console.log('🔄 Loading data with cache...');
      
      // Αν είναι force refresh, καθάρισε το cache ΠΡΙΝ τον έλεγχο
      if (forceRefresh) {
        console.log('🔄 Force refresh - clearing cache completely...');
        setDataCache({
          projects: null,
          entaxeis: null,
          proskliseis: null,
          creditApprovals: null,
          linkedEgkriseis: null,
          lastCacheTime: null,
          needsRefresh: true
        });
      }
      
      // Έλεγχος αν χρειάζεται refresh
      const now = Date.now();
      const cacheExpiry = 5 * 60 * 1000; // 5 λεπτά cache
      const hasValidCache = dataCache.lastCacheTime && 
                           (now - dataCache.lastCacheTime) < cacheExpiry && 
                           !dataCache.needsRefresh && 
                           !forceRefresh;
      
      if (hasValidCache && dataCache.projects) {
        console.log('✅ Using cached data - no reload needed!');
        // Use requestAnimationFrame for better UI responsiveness
        requestAnimationFrame(() => {
          setProjects(dataCache.projects);
          setEntaxeis(dataCache.entaxeis || []);
          setProskliseis(dataCache.proskliseis || []);
          setCreditApprovals(dataCache.creditApprovals || {});
          setLinkedEgkriseis(dataCache.linkedEgkriseis || {});
          setLoading(false);
        });
        return;
      }
      
      console.log('🔄 Cache miss or expired - loading fresh data...');
      
      // Batch processing για lock checks - μειώνει το blocking
      const [
        loadedProjects,
        loadedEntaxeis, 
        loadedProskliseis,
        loadedCreditApprovals,
        loadedLinkedEgkriseis
      ] = await Promise.all([
        ipcRenderer.invoke('load-all-projects'),
        ipcRenderer.invoke('load-all-entaxeis'),
        ipcRenderer.invoke('load-all-proskliseis'),
        ipcRenderer.invoke('load-egkriseis-data'),
        ipcRenderer.invoke('load-egkrisi-links')
      ]);
      
      // Φόρτωμα prosklisi links - ΠΕΡΙΜΕΝΟΥΜΕ
      const prosklisiLinksResult = await ipcRenderer.invoke('load-subproject-links').catch((err) => {
        console.error('Error loading prosklisi links:', err);
        return { success: false, data: {} };
      });
      const prosklisiLinksSet = new Set();
      if (prosklisiLinksResult.success && prosklisiLinksResult.data) {
        console.log('🔗 Prosklisi links data:', Object.keys(prosklisiLinksResult.data).length, 'links');
        Object.values(prosklisiLinksResult.data).forEach(link => {
          if (link.sourceSubprojectId) prosklisiLinksSet.add(link.sourceSubprojectId);
          if (link.targetSubprojectId) prosklisiLinksSet.add(link.targetSubprojectId);
        });
      }
      
      // Convert egkrisi link data to Set - ΟΛΕΣ οι συσχετίσεις (manual ΚΑΙ auto)
      const linkedEgkriseisData = loadedLinkedEgkriseis.success && loadedLinkedEgkriseis.data ? loadedLinkedEgkriseis.data : {};
      console.log('✅ Egkrisi links data:', Object.keys(linkedEgkriseisData).length, 'links');
      console.log('Sample egkrisi links:', Object.values(linkedEgkriseisData).slice(0, 3));
      
      const egkrisiLinksSet = new Set(
        Object.values(linkedEgkriseisData).map(link => link.subprojectId).filter(id => id)
      );
      
      const entaxiLinksMap = new Map();
      loadedEntaxeis.forEach(entaxi => {
        if (entaxi.subprojectIds && Array.isArray(entaxi.subprojectIds)) {
          entaxi.subprojectIds.forEach(subId => {
            entaxiLinksMap.set(subId, true);
          });
        }
      });
      
      console.log(`📊 FINAL TOTALS: ${egkrisiLinksSet.size} egkrisi, ${prosklisiLinksSet.size} prosklisi, ${entaxiLinksMap.size} entaxi`);
      
      // Process projects with lock status - ΑΠΛΟΠΟΙΗΜΕΝΟ
      const BATCH_SIZE = 20;
      const projectsWithLockStatus = [];
      
      for (let i = 0; i < loadedProjects.length; i += BATCH_SIZE) {
        const batch = loadedProjects.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (project) => {
            try {
              const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
              
              return {
                ...project,
                isLocked: lockStatus.locked || false,
                hasEgkrisiLink: egkrisiLinksSet.has(project.subprojectId),
                hasProsklisiLink: prosklisiLinksSet.has(project.subprojectId),
                hasEntaxiLink: entaxiLinksMap.has(project.subprojectId)
              };
            } catch (error) {
              return {
                ...project,
                isLocked: false,
                hasEgkrisiLink: false,
                hasProsklisiLink: false,
                hasEntaxiLink: false
              };
            }
          })
        );
        projectsWithLockStatus.push(...batchResults);
        
        if (i + BATCH_SIZE < loadedProjects.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      // Sort projects
      const sortedProjects = projectsWithLockStatus.sort((a, b) => {
        const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
        if (projectComparison !== 0) return projectComparison;
        return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
      });
      
      // Process credit approvals
      let approvals = {};
      if (loadedCreditApprovals.success && loadedCreditApprovals.data && loadedCreditApprovals.data.projects) {
        Object.values(loadedCreditApprovals.data.projects).forEach(project => {
          if (project.modifications && project.modifications.length > 0) {
            const key = `${project.title}-${project.title}`;
            approvals[key] = true;
          }
          if (project.subprojects) {
            Object.values(project.subprojects).forEach(subproject => {
              if (subproject.pdfs && subproject.pdfs.length > 0) {
                const key = `${project.title}-${subproject.title}`;
                approvals[key] = true;
              }
            });
          }
        });
      }
      
      // Update all states - use double requestAnimationFrame to ensure React has time to process
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
        setProjects(sortedProjects);
        setEntaxeis(loadedEntaxeis || []);
        setProskliseis(loadedProskliseis || []);
        setCreditApprovals(approvals);
        setLinkedEgkriseis(linkedEgkriseisData);
        
        // Update cache with fresh data
        setDataCache({
          projects: sortedProjects,
          entaxeis: loadedEntaxeis || [],
          proskliseis: loadedProskliseis || [],
          creditApprovals: approvals,
          linkedEgkriseis: linkedEgkriseisData,
          lastCacheTime: now,
          needsRefresh: false
        });
        
          // Clear loading state AFTER state updates
        setLoading(false);
          
          // Force React to process all updates and re-enable inputs
          // Use setTimeout to ensure this runs after React's render cycle
          setTimeout(() => {
            // Trigger a small state update to force React to re-render and re-enable inputs
            // This ensures all event handlers are properly attached
            setProjects(prev => [...prev]);
          }, 50);
        });
      });
      
    } catch (error) {
      console.error('Error in loadDataWithCache:', error);
      setLoading(false);
    }
  };

  // Invalidate cache όταν δημιουργείται/επεξεργάζεται υποέργο
  const invalidateCache = () => {
    console.log('🗑️ Cache invalidated - next load will be fresh');
    setDataCache(prev => ({ ...prev, needsRefresh: true }));
  };

  const loadProjects = async () => {
    try {
      // Πρώτα καθάρισε τα κολλημένα locks
      try {
        const clearResult = await ipcRenderer.invoke('clear-all-locks');
        if (clearResult.success && clearResult.clearedCount > 0) {
          console.log(`Cleared ${clearResult.clearedCount} stale locks`);
        }
      } catch (clearError) {
        console.error('Error clearing locks:', clearError);
      }
      
      // Αυτόματη συσχέτιση αφαιρέθηκε - χρησιμοποιείται μόνο χειροκίνητη συσχέτιση
      
      const [
        loadedProjects,
        loadedLinkedEgkriseis,
        loadedEntaxeis,
        prosklisiLinksResult
      ] = await Promise.all([
        ipcRenderer.invoke('load-all-projects'),
        ipcRenderer.invoke('load-egkrisi-links'),
        ipcRenderer.invoke('load-all-entaxeis').catch(() => []),
        ipcRenderer.invoke('load-subproject-links').catch(() => ({ success: false, data: {} }))
      ]);
      
      // Prosklisi links Set
      const prosklisiLinksSet = new Set();
      if (prosklisiLinksResult.success && prosklisiLinksResult.data) {
        Object.values(prosklisiLinksResult.data).forEach(link => {
          if (link.sourceSubprojectId) prosklisiLinksSet.add(link.sourceSubprojectId);
          if (link.targetSubprojectId) prosklisiLinksSet.add(link.targetSubprojectId);
        });
      }
      
      // Convert to Sets για γρήγορο lookup
      const linkedEgkriseisData = loadedLinkedEgkriseis.success && loadedLinkedEgkriseis.data ? loadedLinkedEgkriseis.data : {};
      const egkrisiLinksSet = new Set(
        Object.values(linkedEgkriseisData).map(link => link.subprojectId).filter(id => id)
      );
      
      const entaxiLinksMap = new Map();
      loadedEntaxeis.forEach(entaxi => {
        if (entaxi.subprojectIds && Array.isArray(entaxi.subprojectIds)) {
          entaxi.subprojectIds.forEach(subId => {
            entaxiLinksMap.set(subId, true);
          });
        }
      });
      
      console.log(`📊 loadProjects: ${egkrisiLinksSet.size} egkrisi, ${prosklisiLinksSet.size} prosklisi, ${entaxiLinksMap.size} entaxi`);
      
      // Check lock status - simplified
      const projectsWithLockStatus = await Promise.all(
        loadedProjects.map(async (project) => {
          try {
            const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
            
            return {
              ...project,
              isLocked: lockStatus.locked || false,
              hasEgkrisiLink: egkrisiLinksSet.has(project.subprojectId),
              hasProsklisiLink: prosklisiLinksSet.has(project.subprojectId),
              hasEntaxiLink: entaxiLinksMap.has(project.subprojectId)
            };
          } catch (error) {
            return {
              ...project,
              isLocked: false,
              hasEgkrisiLink: false,
              hasProsklisiLink: false,
              hasEntaxiLink: false
            };
          }
        })
      );
      
      // Ταξινόμηση έργων αλφαβητικά πριν την εμφάνιση
      const sortedProjects = projectsWithLockStatus.sort((a, b) => {
        // Πρώτα ταξινόμηση ανά έργο
        const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
        if (projectComparison !== 0) return projectComparison;
        
        // Μετά ταξινόμηση ανά υποέργο
        return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
      });
      
      setProjects(sortedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };


  const loadLinkedEgkriseis = async () => {
    try {
      const result = await ipcRenderer.invoke('load-egkrisi-links');
      
      if (result.success && result.data) {
        setLinkedEgkriseis(result.data);
      }
    } catch (error) {
      console.error('Error loading linked egkriseis:', error);
    }
  };


  // Helper function to normalize text for comparison
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')   // Replace literal \n with space (from JSON)
      .replace(/\n/g, ' ')    // Replace actual newlines with space
      .replace(/\r/g, ' ')    // Replace carriage returns
      .replace(/\t/g, ' ')    // Replace tabs
      .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
      .trim()                 // Remove leading/trailing spaces
      .toLowerCase();         // Case insensitive
  };

  // Function to check if a subproject has credit approval
  const hasCreditApproval = (projectTitle, subprojectTitle, subprojectId) => {
    if (!subprojectTitle) return false;
    
    // ΠΡΩΤΑ: Ελέγχουμε αν υπάρχει χειροκίνητη συσχέτιση (linkedEgkriseis)
    if (subprojectId && linkedEgkriseis) {
      const hasManualLink = Object.values(linkedEgkriseis).some(link => 
        link && link.subprojectId === subprojectId
      );
      if (hasManualLink) {
        return true;
      }
    }
    
    // ΔΕΥΤΕΡΑ: Ελέγχουμε τις ΑΥΤΟΜΑΤΕΣ συσχετίσεις από linkedEgkriseis (νέα λογική)
    if (subprojectTitle && linkedEgkriseis) {
      const normalizedSubprojectTitle = normalizeText(subprojectTitle);
      
      const hasAutoLink = Object.values(linkedEgkriseis).some(link => {
        if (!link || !link.autoLinked) return false;
        
        const normalizedLinkTitle = normalizeText(link.subprojectTitle || '');
        return normalizedSubprojectTitle === normalizedLinkTitle;
      });
      
      if (hasAutoLink) {
        return true;
      }
    }
    
    // ΤΡΙΤΑ: Ελέγχουμε τις συσχετίσεις από creditApprovals (παλιά λογική για συμβατότητα)
    const normalizedSubprojectTitle = normalizeText(subprojectTitle);
    
    // Πρώτα ψάχνουμε με το παλιό κλειδί (συμβατότητα)
    const oldKey = `${projectTitle}-${subprojectTitle}`;
    if (creditApprovals[oldKey]) {
      return true;
    }
    
    // Στη συνέχεια ψάχνουμε με fuzzy matching
    for (const [approvalKey, approvalValue] of Object.entries(creditApprovals)) {
      if (!approvalValue) continue;
      
      // Extract το τμήμα μετά το τελευταίο "-" (που είναι ο τίτλος υποέργου)
      const keyParts = approvalKey.split('-');
      if (keyParts.length < 2) continue;
      
      const approvalSubprojectTitle = keyParts.slice(1).join('-'); // Πάρε όλα μετά το πρώτο "-"
      const normalizedApprovalTitle = normalizeText(approvalSubprojectTitle);
      
      if (normalizedSubprojectTitle === normalizedApprovalTitle) {
        return true;
      }
    }
    
    return false;
  };

  // Function to check if a subproject has linked egkrisi
  const hasLinkedEgkrisi = (subprojectId, subprojectTitle) => {
    if (!subprojectId || !linkedEgkriseis) {
      return false;
    }
    
    
    // Ελέγχουμε αν κάποια έγκριση είναι συσχετισμένη με αυτό το υποέργο
    // Ελέγχουμε ΤΟΥΣ ΔΥΟ: subprojectId (UUID) ΚΑΙ subprojectTitle για ακριβή ταίριασμα
    // Αυτό αποφεύγει λάθος links που έχουν σωστό subprojectId αλλά λάθος τίτλο
    const hasLink = Object.values(linkedEgkriseis).some(link => {
      if (!link) return false;
      
      // ΠΡΩΤΑ: Ελέγχουμε το subprojectId (UUID) - πρέπει να ταιριάζει
      if (link.subprojectId !== subprojectId) {
        return false;
      }
      
      // ΔΕΥΤΕΡΟ: Ελέγχουμε και τον τίτλο - αλλά με πιο ευέλικτο τρόπο
      // Το subprojectId είναι το πιο σημαντικό - αν ταιριάζει, το link είναι έγκυρο
      // Ο τίτλος μπορεί να έχει μικρές διαφορές (π.χ. case, whitespace) αλλά το subprojectId είναι μοναδικό
      // Αν το subprojectId ταιριάζει, το link είναι έγκυρο
      // Το subprojectId (UUID) είναι το πιο σημαντικό - είναι μοναδικό και αξιόπιστο
      // Ο τίτλος μπορεί να έχει μικρές διαφορές (π.χ. case, whitespace, punctuation)
      // αλλά το subprojectId είναι πάντα σωστό
      return true; // Το subprojectId ταιριάζει, οπότε το link είναι έγκυρο
    });
    
    return hasLink;
  };

  // 🔗 ΧΕΙΡΟΚΙΝΗΤΗ ΣΥΣΧΕΤΙΣΗ ΕΓΚΡΙΣΗΣ

  const loadEntaxeis = async () => {
    try {
      const loadedEntaxeis = await ipcRenderer.invoke('load-all-entaxeis');
      setEntaxeis(loadedEntaxeis || []);
    } catch (error) {
      console.error('Error loading entaxeis:', error);
    }
  };


  // Helper function to find linked prosklisi for a subproject
  const findLinkedProsklisi = (subprojectId, projectTitle) => {
    // Find prosklisi that matches the subproject ID
    const matchingProsklisi = proskliseis.find(prosklisi => {
      // Check if prosklisi is linked to this specific subproject
      return prosklisi.linkedSubprojectId === subprojectId;
    });
    
    return matchingProsklisi || null;
  };

  const handleSaveProject = async (projectData) => {
    try {
      console.log('🔄 Dashboard handleSaveProject called with:', {
        projectId: projectData.projectId,
        projectTitle: projectData.projectTitle,
        isEditing: !!editingProject
      });
      
      // Η λογική ελέγχου τίτλου έχει μεταφερθεί στο ProjectForm.js
      // Εδώ απλά αποθηκεύουμε τα δεδομένα όπως τα έλαβε
      
      const result = await ipcRenderer.invoke('save-project-data', projectData);
      
      if (result.success) {
        // Save files if any
        if (projectData.files && projectData.files.length > 0) {
          await ipcRenderer.invoke('save-files', projectData.files, result.projectId, result.subprojectId);
        }
        
        // Ξεκλείδωμα του έργου μετά την επιτυχή αποθήκευση
        if (editingProject && editingProject.projectId) {
          await ipcRenderer.invoke('unlock-project', editingProject.projectId);
        }
        
        // Αποθήκευση scroll position πριν το reload
        if (contentWrapperRef.current) {
          savedScrollPosition.current = contentWrapperRef.current.scrollTop;
        }
        
        // 🗑️ INVALIDATE CACHE μετά την αποθήκευση υποέργου
        invalidateCache();
        
        // Ορίζουμε flag για επαναφορά scroll position
        shouldRestoreScroll.current = true;
        setIsFormOpen(false);
        setEditingProject(null);
        
        await loadDataWithCache(true); // Force refresh για να δείξει τις αλλαγές
      } else {
        console.error('Error saving project:', result.error);
        alert('Σφάλμα αποθήκευσης: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Σφάλμα αποθήκευσης: ' + error.message);
    }
  };

  
  // Advanced filters handlers
  const handleApplyAdvancedFilters = useCallback((filters) => {
    setAdvancedFilters(filters);
  }, []);

  const handleClearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({
      projectTitle: '',
      subprojectTitle: '',
      kaCode: '',
      supervisor: [],
      projectType: [],
      fundingSource: [],
      fundingDetails: [],
      projectStatus: [],
      implementationForm: [],
      hasSupplementaryContracts: '',
      contractsCount: '',
      hasEgkriseisDialthesisPistosis: '',
      hasProsklisiLink: '',
      hasEntaxiLink: '',
      hasComments: '',
      hasApeComments: '',
      hasRemainingComments: '',
      hasEisigitikiEkthesi: '',
      misPraxhsCode: '',
      remainingYear: '',
      remainingAmountCondition: 'all',
      contractDateFrom: '',
      contractDateTo: '',
      contractProcessDateFrom: '',
      contractProcessDateTo: '',
      approvedAmountMin: '',
      approvedAmountMax: '',
      contractAmountMin: '',
      contractAmountMax: '',
      apeAmountMin: '',
      apeAmountMax: '',
      sortBy: 'kaCode',
      sortOrder: 'asc'
    });
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters, countActiveFilters]);
const handleDeleteProject = async (projectId, subprojectId) => {
    console.log('Attempting to delete subproject:', { projectId, subprojectId });
    
    // Έλεγχος αν τα IDs είναι έγκυρα
    if (!projectId || !subprojectId) {
      console.error('Invalid IDs for deletion:', { projectId, subprojectId });
      alert('Σφάλμα: Μη έγκυρα δεδομένα για διαγραφή');
      return;
    }
    
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το υποέργο;')) {
      try {
        const result = await ipcRenderer.invoke('delete-subproject', projectId, subprojectId);
        
        if (result.success) {
          // Force reload projects and clear any cached data
          setProjects([]);
          setFilteredProjects([]);
          await loadProjects();
          // Also reload linked egkriseis to update the UI
          await loadLinkedEgkriseis();
          alert('Το υποέργο διαγράφηκε επιτυχώς!');
        } else {
          console.error('Deletion failed:', result.error);
          alert('Σφάλμα κατά τη διαγραφή: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
      }
    }
  };

  const handleEditProject = async (project) => {
    try {
      // Έλεγχος αν το έργο είναι ήδη κλειδωμένο
      const lockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
      
      if (lockStatus.locked) {
        const clearStaleResult = await window.confirm(
          'Το έργο φαίνεται κλειδωμένο. Αυτό μπορεί να οφείλεται σε κολλημένο lock. ' +
          'Θέλετε να καθαρίσετε τα κολλημένα locks και να δοκιμάσετε ξανά;'
        );
        
        if (clearStaleResult) {
          // Καθάρισε τα κολλημένα locks
          await ipcRenderer.invoke('clear-all-locks');
          // Ανανέωση των projects
          await loadProjects();
          
          // Δοκίμασε ξανά
          const newLockStatus = await ipcRenderer.invoke('check-project-lock', project.projectId);
          if (newLockStatus.locked) {
            alert('Το έργο είναι ακόμα κλειδωμένο από άλλον διαχειριστή!');
            return;
          }
        } else {
          return;
        }
      }

      // Δημιουργία lock για το έργο
      const lockResult = await ipcRenderer.invoke('create-project-lock', project.projectId);
      if (!lockResult.success) {
        alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
        return;
      }

      // Άμεση ενημέρωση του UI για να δείξει το lock με διατήρηση ταξινόμησης
      const updatedProjects = projects.map(p => 
        p.projectId === project.projectId ? { ...p, isLocked: true } : p
      ).sort((a, b) => {
        const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
        if (projectComparison !== 0) return projectComparison;
        return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
      });
      setProjects(updatedProjects);

      setEditingProject(project);
      // Αποθήκευση scroll position
      if (contentWrapperRef.current) {
        savedScrollPosition.current = contentWrapperRef.current.scrollTop;
      }
      setIsFormOpen(true);
    } catch (error) {
      console.error('Error in handleEditProject:', error);
      alert('Σφάλμα κατά το άνοιγμα του έργου: ' + error.message);
    }
  };

  const handleViewFile = async (projectId, subprojectId, fileName) => {
    try {
      const filePath = await ipcRenderer.invoke('get-file-path', projectId, subprojectId, fileName);
      setPdfViewer({
        isOpen: true,
        filePath,
        fileName
      });
    } catch (error) {
      console.error('Error getting file path:', error);
    }
  };

  const handleDownloadFile = async (projectId, subprojectId, fileName) => {
    try {
      const result = await ipcRenderer.invoke('download-subproject-file', projectId, subprojectId, fileName);
      if (result.success) {
        alert('✅ Το αρχείο αποθηκεύτηκε επιτυχώς!');
      } else if (result.canceled) {
        // User cancelled the save dialog - no need to show error
        return;
      } else {
        alert('❌ Σφάλμα κατά τη λήψη: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('❌ Σφάλμα κατά τη λήψη: ' + error.message);
    }
  };

  const handleDeleteFile = async (projectId, subprojectId, fileName) => {
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο "${fileName}";`)) {
      try {
        const result = await ipcRenderer.invoke('delete-file', projectId, subprojectId, fileName);
        if (result.success) {
          await loadProjects();
          // Ανανέωση των αρχείων στο FileManager αν είναι ανοιχτό για αυτό το έργο
          if (fileManager.isOpen && fileManager.projectId === projectId && fileManager.subprojectId === subprojectId) {
            handleOpenFileManager(projectId, subprojectId);
          }
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const handleOpenFileManager = async (projectId, subprojectId) => {
    try {
      const result = await ipcRenderer.invoke('get-subproject-files', projectId, subprojectId);
      setFileManager({
        isOpen: true,
        projectId,
        subprojectId,
        files: result.files || [],
        fileGroups: result.fileGroups || []
      });
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  };

  const handleOpenLinkedProsklisi = (prosklisiId) => {
    // Set the selected prosklisi ID για φιλτράρισμα
    setSelectedProsklisiId(prosklisiId);
    // Open the ProsklisisManager
    setIsProsklisisOpen(true);
  };

  const handleCloseFileManager = () => {
    setFileManager({
      isOpen: false,
      projectId: null,
      subprojectId: null,
      files: [],
      fileGroups: []
    });
  };

  // Συνάρτηση για ομαδοποίηση αρχείων στο FileManager
  const handleGroupFiles = async (filesToGroup, existingGroups = []) => {
    if (!filesToGroup || filesToGroup.length === 0) {
      alert('Δεν υπάρχουν αρχεία για ομαδοποίηση');
      return;
    }

    // Helper function για ασφαλή αφαίρεση modal
    const safeRemoveModal = (modal) => {
      if (modal && modal.parentNode === document.body) {
        try {
          document.body.removeChild(modal);
        } catch (error) {
          // Το modal έχει ήδη αφαιρεθεί
          console.log('Modal already removed');
        }
      }
    };

    // Απλό modal για τίτλο ομάδας
    const showGroupTitleModal = () => {
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
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
            📁 Δημιουργία Νέας Ομάδας
          </h3>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος ομάδας:
          </label>
          <input 
            type="text" 
            id="groupTitle" 
            placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1.5rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="okBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">OK</button>
            <button id="cancelBtn" style="
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
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const groupTitle = modalContent.querySelector('#groupTitle');
        const okBtn = modalContent.querySelector('#okBtn');
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        // Focus στο input
        groupTitle.focus();

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        // OK button
        okBtn.addEventListener('click', () => {
          const title = groupTitle.value.trim();
          if (title) {
            cleanup(title);
          } else {
            alert('Παρακαλώ εισάγετε τίτλο ομάδας');
          }
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // Enter key
        groupTitle.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            okBtn.click();
          }
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Modal για επιλογή: Νέα Ομάδα ή Υπάρχουσα Ομάδα
    const showGroupSelectionModal = () => {
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

        const hasExistingGroups = existingGroups && existingGroups.length > 0;
        
        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1.5rem 0; color: #333; font-size: 1.3rem;">
            📁 Μεταφορά Αρχείων σε Ομάδα
          </h3>
          <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
            Επιλέξτε πώς θέλετε να μεταφέρετε τα ${filesToGroup.length} επιλεγμένα αρχεία:
          </p>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
            <button id="newGroupBtn" style="
              padding: 1rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
              text-align: left;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            ">
              <span style="font-size: 1.2rem;">➕</span>
              <div>
                <strong>Δημιουργία Νέας Ομάδας</strong>
                <div style="font-size: 0.85rem; opacity: 0.9;">Δημιουργήστε μια νέα ομάδα για τα αρχεία</div>
              </div>
            </button>
            ${hasExistingGroups ? `
            <button id="existingGroupBtn" style="
              padding: 1rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
              text-align: left;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            ">
              <span style="font-size: 1.2rem;">📁</span>
              <div>
                <strong>Μεταφορά σε Υπάρχουσα Ομάδα</strong>
                <div style="font-size: 0.85rem; opacity: 0.9;">Προσθέστε τα αρχεία σε μια υπάρχουσα ομάδα</div>
              </div>
            </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 1rem;">
            <button id="cancelBtn" style="
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
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const newGroupBtn = modalContent.querySelector('#newGroupBtn');
        const existingGroupBtn = hasExistingGroups ? modalContent.querySelector('#existingGroupBtn') : null;
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        newGroupBtn.addEventListener('click', () => {
          cleanup('new');
        });

        if (existingGroupBtn) {
          existingGroupBtn.addEventListener('click', () => {
            cleanup('existing');
          });
        }

        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Modal για επιλογή υπάρχουσας ομάδας
    const showExistingGroupSelectionModal = () => {
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

        const groupOptions = existingGroups.map(group => 
          `<option value="${group.id}">${group.title} (${group.files.length} αρχεία)</option>`
        ).join('');

        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
            📁 Επιλογή Ομάδας
          </h3>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε ομάδα:
          </label>
          <select id="groupSelect" style="
            width: 100%;
            padding: 0.8rem;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            margin-bottom: 1.5rem;
          ">
            ${groupOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="okBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">OK</button>
            <button id="cancelBtn" style="
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
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const groupSelect = modalContent.querySelector('#groupSelect');
        const okBtn = modalContent.querySelector('#okBtn');
        const cancelBtn = modalContent.querySelector('#cancelBtn');

        let handleKeyDown;
        const cleanup = (result) => {
          safeRemoveModal(modal);
          if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
          }
          resolve(result);
        };

        okBtn.addEventListener('click', () => {
          const selectedGroupId = groupSelect.value;
          cleanup(selectedGroupId);
        });

        cancelBtn.addEventListener('click', () => {
          cleanup(null);
        });

        // ESC key
        handleKeyDown = (e) => {
          if (e.key === 'Escape') {
            cleanup(null);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
      });
    };

    // Main logic for grouping files
    try {
      // Βήμα 1: Επιλογή τύπου ομάδας (Νέα ή Υπάρχουσα)
      const groupType = await showGroupSelectionModal();
      if (!groupType) return;

      if (groupType === 'new') {
        // Δημιουργία νέας ομάδας
        const groupTitle = await showGroupTitleModal();
        if (!groupTitle) return;

        // Χρησιμοποιούμε τα ήδη επιλεγμένα αρχεία
        const selectedFiles = filesToGroup;

        // Δημιουργία ομάδας
        const result = await ipcRenderer.invoke('create-file-group', fileManager.projectId, fileManager.subprojectId, groupTitle, selectedFiles);
        if (result.success) {
          // Ανανέωση των αρχείων
          await handleOpenFileManager(fileManager.projectId, fileManager.subprojectId);
          alert(`Ομάδα "${groupTitle}" δημιουργήθηκε επιτυχώς με ${selectedFiles.length} αρχείο(α)!`);
        } else {
          alert('Σφάλμα δημιουργίας ομάδας: ' + result.error);
        }
      } else if (groupType === 'existing') {
        // Μεταφορά σε υπάρχουσα ομάδα
        const selectedGroupId = await showExistingGroupSelectionModal();
        if (!selectedGroupId) return;

        // Μεταφορά αρχείων στην ομάδα
        const result = await ipcRenderer.invoke('add-files-to-group', fileManager.projectId, fileManager.subprojectId, selectedGroupId, filesToGroup);
        if (result.success) {
          // Ανανέωση των αρχείων
          await handleOpenFileManager(fileManager.projectId, fileManager.subprojectId);
          const selectedGroup = existingGroups.find(g => g.id === selectedGroupId);
          alert(`${filesToGroup.length} αρχείο(α) μεταφέρθηκαν επιτυχώς στην ομάδα "${selectedGroup?.title || 'Ομάδα'}"!`);
        } else {
          alert('Σφάλμα μεταφοράς αρχείων: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Error grouping files:', error);
      alert('Σφάλμα ομαδοποίησης αρχείων: ' + error.message);
    }
  };

  const groupCounts = useMemo(() => {
    const counts = {};
    notes.forEach(note => {
      counts[note.groupId] = (counts[note.groupId] || 0) + 1;
    });
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const term = notesSearch.trim().toLowerCase();
    let filtered = notes
      .filter(note => note.groupId === selectedNoteGroupId)
      .filter(note => {
        if (!term) return true;
        const haystack = `${note.title || ''} ${note.content || ''} ${(note.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes(term);
      })
      .filter(note => {
        if (notesFilterStatus === 'all') return true;
        return (note.status || 'new') === notesFilterStatus;
      })
      .filter(note => {
        if (notesFilterPriority === 'all') return true;
        return (note.priority || 'medium') === notesFilterPriority;
      });

    // Sorting
    filtered.sort((a, b) => {
      switch (notesSortBy) {
        case 'dueDate':
          const aDate = a.dueDate ? new Date(a.dueDate) : new Date(0);
          const bDate = b.dueDate ? new Date(b.dueDate) : new Date(0);
          return aDate - bDate;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority || 'medium'] || 0) - (priorityOrder[a.priority || 'medium'] || 0);
        case 'status':
          const statusOrder = { 'in-progress': 2, new: 1, completed: 0 };
          return (statusOrder[b.status || 'new'] || 0) - (statusOrder[a.status || 'new'] || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'createdAt':
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return filtered;
  }, [notes, selectedNoteGroupId, notesSearch, notesSortBy, notesFilterStatus, notesFilterPriority]);

  const activeNoteGroup = useMemo(
    () => noteGroups.find(group => group.id === selectedNoteGroupId),
    [noteGroups, selectedNoteGroupId]
  );

  const handleAddGroup = useCallback(async () => {
    const name = groupForm.name.trim();
    if (!name) {
      alert('Παρακαλώ εισάγετε όνομα ομάδας σημειώσεων.');
      return;
    }
    const color = groupForm.color || '#6366f1';
    const newGroup = {
      id: `note-group-${Date.now()}`,
      name,
      color
    };
    const updatedGroups = [...noteGroups, newGroup];
    setNoteGroups(updatedGroups);
    setGroupForm(prev => ({ ...prev, name: '' }));
    setSelectedNoteGroupId(newGroup.id);
    
    // Save immediately after adding group
    try {
      await ipcRenderer.invoke('save-note-groups', updatedGroups);
    } catch (error) {
      console.error('Error saving note group:', error);
    }
  }, [groupForm, noteGroups]);

  const handleDeleteGroup = useCallback(async (groupId) => {
    if (groupId === DEFAULT_NOTE_GROUP_ID) {
      alert('Η βασική ομάδα δεν μπορεί να διαγραφεί.');
      return;
    }
    const updatedGroups = noteGroups.filter(group => group.id !== groupId);
    const updatedNotes = notes.map(note =>
      note.groupId === groupId ? { ...note, groupId: DEFAULT_NOTE_GROUP_ID } : note
    );
    
    setNoteGroups(updatedGroups);
    setNotes(updatedNotes);
    setSelectedNoteGroupId(DEFAULT_NOTE_GROUP_ID);
    
    // Save immediately after deleting group
    try {
      await ipcRenderer.invoke('save-notes', {
        notes: updatedNotes,
        groups: updatedGroups
      });
    } catch (error) {
      console.error('Error saving after group deletion:', error);
    }
  }, [notes, noteGroups]);

  const handleAddNote = useCallback(async () => {
    if (!noteForm.title.trim() && !noteForm.content.trim()) {
      alert('Παρακαλώ γράψτε τουλάχιστον έναν τίτλο ή περιεχόμενο για τη σημείωση.');
      return;
    }

    const groupId = noteForm.groupId || selectedNoteGroupId || DEFAULT_NOTE_GROUP_ID;
    
    // Αν επεξεργαζόμαστε μια υπάρχουσα σημείωση
    if (editingNote) {
      const updatedNote = {
        ...editingNote,
        title: noteForm.title.trim() || 'Χωρίς τίτλο',
        content: noteForm.content.trim(),
        tags: noteForm.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        groupId,
        priority: noteForm.priority || 'medium',
        status: noteForm.status || 'new',
        dueDate: noteForm.dueDate || '',
        checklist: noteForm.checklist || [],
        updatedAt: new Date().toISOString()
      };

      const updatedNotes = notes.map(note => 
        note.id === editingNote.id ? updatedNote : note
      );
      
      setNotes(updatedNotes);
      setEditingNote(null);
      setNoteForm({
        title: '',
        content: '',
        tags: '',
        groupId
      });
      
      // Save immediately after updating note
      try {
        await ipcRenderer.invoke('save-notes', {
          notes: updatedNotes,
          groups: noteGroups
        });
      } catch (error) {
        console.error('Error saving note update:', error);
      }
    } else {
      // Νέα σημείωση
      const newNote = {
        id: `note-${Date.now()}`,
        title: noteForm.title.trim() || 'Χωρίς τίτλο',
        content: noteForm.content.trim(),
        tags: noteForm.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        groupId,
        priority: noteForm.priority || 'medium',
        status: noteForm.status || 'new',
        dueDate: noteForm.dueDate || '',
        checklist: noteForm.checklist || [],
        createdAt: new Date().toISOString()
      };

      setNotes(prev => [newNote, ...prev]);
      setNoteForm(prev => ({
        ...prev,
        title: '',
        content: '',
        tags: '',
        groupId
      }));
      
      // Save immediately after adding note
      try {
        await ipcRenderer.invoke('save-notes', {
          notes: [newNote, ...notes],
          groups: noteGroups
        });
      } catch (error) {
        console.error('Error saving note:', error);
      }
    }
  }, [noteForm, selectedNoteGroupId, notes, noteGroups, editingNote]);

  const handleDeleteNote = useCallback(async (noteId) => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη σημείωση;')) {
      return;
    }
    
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    
    // Αν διαγράφουμε τη σημείωση που επεξεργαζόμασταν, καθαρίζουμε το form
    if (editingNote && editingNote.id === noteId) {
      setEditingNote(null);
      setNoteForm({ title: '', content: '', tags: '', groupId: selectedNoteGroupId || DEFAULT_NOTE_GROUP_ID });
    }
    
    // Save immediately after deleting note
    try {
      await ipcRenderer.invoke('save-notes', {
        notes: updatedNotes,
        groups: noteGroups
      });
    } catch (error) {
      console.error('Error saving after note deletion:', error);
    }
  }, [notes, noteGroups, editingNote, selectedNoteGroupId]);

  const handleOpenNoteModal = useCallback((note) => {
    setSelectedNoteForModal({ ...note });
    setIsNoteModalOpen(true);
  }, []);

  const handleCloseNoteModal = useCallback(() => {
    setIsNoteModalOpen(false);
    setSelectedNoteForModal(null);
  }, []);

  const handleSaveNoteFromModal = useCallback(async () => {
    if (!selectedNoteForModal) return;

    const updatedNote = {
      ...selectedNoteForModal,
      title: selectedNoteForModal.title || '',
      content: selectedNoteForModal.content || '',
      tags: selectedNoteForModal.tags || [],
      updatedAt: new Date().toISOString()
    };

    const updatedNotes = notes.map(note => 
      note.id === selectedNoteForModal.id ? updatedNote : note
    );
    
    setNotes(updatedNotes);
    handleCloseNoteModal();

    // Save to file
    try {
      await ipcRenderer.invoke('save-notes', {
        notes: updatedNotes,
        groups: noteGroups
      });
    } catch (error) {
      console.error('Error saving note from modal:', error);
    }
  }, [selectedNoteForModal, notes, noteGroups, handleCloseNoteModal]);

  const handleUpdateNoteInModal = useCallback((field, value) => {
    if (!selectedNoteForModal) return;
    
    setSelectedNoteForModal(prev => {
      if (field === 'tags') {
        const tagsArray = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        return { ...prev, [field]: tagsArray };
      }
      if (field === 'checklist') {
        // value is the entire checklist array
        return { ...prev, [field]: value };
      }
      return { ...prev, [field]: value };
    });
  }, [selectedNoteForModal]);

  const handleAddChecklistItem = useCallback(() => {
    if (!selectedNoteForModal) return;
    const newItem = {
      id: `checklist-${Date.now()}`,
      text: '',
      completed: false
    };
    setSelectedNoteForModal(prev => ({
      ...prev,
      checklist: [...(prev.checklist || []), newItem]
    }));
  }, [selectedNoteForModal]);

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null);
    setNoteForm({ title: '', content: '', tags: '', groupId: selectedNoteGroupId || DEFAULT_NOTE_GROUP_ID });
  }, [selectedNoteGroupId]);

  const handleOpenNotes = useCallback(() => {
    setIsNotesOpen(true);
    setNotesSearch('');
    setEditingNote(null);
    setNoteForm({ 
      title: '', 
      content: '', 
      tags: '', 
      groupId: selectedNoteGroupId || DEFAULT_NOTE_GROUP_ID,
      priority: 'medium',
      status: 'new',
      dueDate: '',
      checklist: []
    });
  }, [selectedNoteGroupId]);

  const handleCloseNotes = useCallback(() => {
    setIsNotesOpen(false);
  }, []);

  const handleOpenEntaxis = (projectTitle = null) => {
    setEntaxisProjectFilter(projectTitle);
    setIsEntaxisOpen(true);
  };

  // Check if there's an entaxi for a specific subproject
  const hasEntaxiForSubproject = (subprojectId) => {
    return entaxeis.some(entaxi => 
      entaxi.subprojectIds && entaxi.subprojectIds.includes(subprojectId)
    );
  };

  // Get the entaxi for a specific subproject
  const getEntaxiForSubproject = (subprojectId) => {
    return entaxeis.find(entaxi => 
      entaxi.subprojectIds && entaxi.subprojectIds.includes(subprojectId)
    );
  };

  // Handle opening specific entaxi
  const handleOpenSpecificEntaxi = (subprojectId) => {
    const entaxi = getEntaxiForSubproject(subprojectId);
    if (entaxi) {
      setEntaxisProjectFilter(entaxi.projectTitle);
      setIsEntaxisOpen(true);
      // TODO: Highlight the specific entaxi when the modal opens
    }
  };

  // Check if there's a prosklisi for a specific project title or linked projects
  const hasProsklisiForProject = (projectTitle, projectId) => {
    return proskliseis.some(prosklisi => {
      // Check if prosklisi title matches project title (automatic linking)
      if (prosklisi.title === projectTitle) {
        return true;
      }
      // Check if prosklisi is manually linked to this project
      if (prosklisi.linkedProjects && Array.isArray(prosklisi.linkedProjects)) {
        return prosklisi.linkedProjects.some(linkedProject => 
          linkedProject.id === projectId || linkedProject.title === projectTitle
        );
      }
      return false;
    });
  };

  // Get the prosklisi for a specific project title or linked projects
  const getProsklisiForProject = (projectTitle, projectId) => {
    return proskliseis.find(prosklisi => {
      // Check if prosklisi title matches project title (automatic linking)
      if (prosklisi.title === projectTitle) {
        return true;
      }
      // Check if prosklisi is manually linked to this project
      if (prosklisi.linkedProjects && Array.isArray(prosklisi.linkedProjects)) {
        return prosklisi.linkedProjects.some(linkedProject => 
          linkedProject.id === projectId || linkedProject.title === projectTitle
        );
      }
      return false;
    });
  };

  // Handle opening specific prosklisi
  const handleOpenSpecificProsklisi = (projectTitle, projectId) => {
    const prosklisi = getProsklisiForProject(projectTitle, projectId);
    if (prosklisi) {
      // Ανοίγουμε το ProsklisisManager με φίλτρο για τη συγκεκριμένη πρόσκληση
      setProsklisiProjectFilter(prosklisi.title);
      setIsProsklisisOpen(true);
    }
  };

  const [highlightProject, setHighlightProject] = useState({
    projectTitle: null,
    subprojectTitle: null,
    projectKey: null,
    subprojectKey: null
  });

  const handleOpenEgkriseis = async (projectTitle, subprojectTitle = null, subprojectId = null) => {
    // Βρίσκουμε τον σωστό τίτλο από τις εγκρίσεις αν υπάρχει συσχέτιση
    let egkrisiTitle = subprojectTitle;
    let egkrisiProjectKey = null;
    let egkrisiSubprojectKey = null;

    if (subprojectId && linkedEgkriseis) {
      const linkedEgkrisi = Object.values(linkedEgkriseis).find(link => 
        link && link.subprojectId === subprojectId
      );
      if (linkedEgkrisi && linkedEgkrisi.egkrisiTitle) {
        egkrisiTitle = linkedEgkrisi.egkrisiTitle;
      }
      if (linkedEgkrisi && linkedEgkrisi.egkrisiProjectKey) {
        egkrisiProjectKey = linkedEgkrisi.egkrisiProjectKey;
      }
      if (linkedEgkrisi && linkedEgkrisi.egkrisiSubprojectKey) {
        egkrisiSubprojectKey = linkedEgkrisi.egkrisiSubprojectKey;
      }
    }
    
    // Αν δεν υπάρχει link, προσπαθούμε να βρούμε τα keys από το egkriseis-data.json
    if (!egkrisiProjectKey && subprojectId) {
      try {
        const keysResult = await ipcRenderer.invoke('find-egkrisi-keys-by-subproject-id', subprojectId);
        if (keysResult) {
          egkrisiProjectKey = keysResult.projectKey;
          egkrisiSubprojectKey = keysResult.subprojectKey;
        }
      } catch (error) {
        console.error('Error finding egkrisi keys:', error);
      }
    }
    
    setHighlightProject({
      projectTitle,
      subprojectTitle: egkrisiTitle,
      projectKey: egkrisiProjectKey,
      subprojectKey: egkrisiSubprojectKey
    });
    setIsCreditApprovalsOpen(true);
  };

  // Quick Search functions
  const handleQuickSearchClear = () => {
    setQuickSearchText('');
    setQuickSearchStatus('');
    setQuickSearchType('');
  };


  // Get unique values for dropdowns - Memoized για καλύτερη performance
  const getUniqueStatuses = useMemo(() => {
    const statuses = [...new Set(projects.map(p => p.projectStatus).filter(Boolean))];
    return statuses.sort();
  }, [projects]);

  const getUniqueTypes = useMemo(() => {
    const types = [...new Set(projects.map(p => p.projectType).filter(Boolean))];
    return types.sort();
  }, [projects]);


  // Group projects by project title - Memoized for performance
  const groupedProjects = useMemo(() => {
    return filteredProjects.reduce((groups, project) => {
      const key = project.projectTitle;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
      return groups;
    }, {});
  }, [filteredProjects]);

  // Group projects as array of arrays for EgkriseisManager
  const projectsAsArrayOfArrays = useMemo(() => {
    const allProjects = projects.length > 0 ? projects : filteredProjects;
    const grouped = allProjects.reduce((groups, project) => {
      const key = project.projectTitle;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
      return groups;
    }, {});
    // Convert object to array of arrays
    return Object.values(grouped);
  }, [projects, filteredProjects]);

  return (
    <DashboardContainer>
      <Header>
        <UserInfo>
          <UserRole role={userRole}>
            {currentUser?.fullName || currentUser?.username || userRole}
          </UserRole>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
            {userRole === 'SUPERADMIN' ? 'Υπερδιαχειριστής' : userRole === 'ADMIN' ? 'Διαχειριστής' : 'Χρήστης'}
          </span>
          <LogoutButton onClick={onLogout}>
            Αποσύνδεση
          </LogoutButton>
        </UserInfo>
        <CenteredTitleContainer>
          <MainTitle>{appConfig.organizationFullName || 'ΟΡΓΑΝΙΣΜΟΣ'}</MainTitle>
          <SubTitle>ERGOHUB - Διαχείριση Έργων & Προμηθειών</SubTitle>
        </CenteredTitleContainer>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textAlign: 'right', minWidth: '80px' }}>
          {appVersion ? `v${appVersion}` : ''}
        </div>
      </Header>

      <ContentWrapper ref={contentWrapperRef}>
        <ContentArea>
          {/* Active Filters Banner */}
          <ActiveFiltersBanner
            activeFilterCount={activeFilterCount}
            onClearFilters={handleClearAdvancedFilters}
          />

          {/* Statistics */}
          <Statistics projects={filteredProjects} />

          <ProjectsContainer>
            <ProjectsTitle>Έργα & Υποέργα</ProjectsTitle>

            {loading ? (
              <LoadingSpinner>Φόρτωση δεδομένων...</LoadingSpinner>
            ) : Object.keys(groupedProjects).length === 0 ? (
              <EmptyState>
                <EmptyStateIcon>📁</EmptyStateIcon>
                <EmptyStateText>Δεν υπάρχουν έργα</EmptyStateText>
                <EmptyStateSubtext>
                  {userRole !== 'USER' 
                    ? 'Κάντε κλικ στο κουμπί "ΕΙΣΑΓΩΓΗ ΝΕΟΥ ΥΠΟΕΡΓΟΥ" για να προσθέσετε το πρώτο έργο'
                    : 'Δεν έχουν εισαχθεί έργα ακόμα'
                  }
                </EmptyStateSubtext>
              </EmptyState>
            ) : (
              Object.entries(groupedProjects)
                .sort(([a], [b]) => a.localeCompare(b, 'el', { sensitivity: 'base' })) // Αλφαβητική ταξινόμηση
                .map(([projectTitle, subprojects]) => {
                  // Calculate total entaxi amount for all subprojects in this project
                  // IMPORTANT: Use unique entaxis to avoid counting the same entaxi multiple times
                  // if it's linked to multiple subprojects
                  const uniqueEntaxiIds = new Set();
                  subprojects.forEach(subproject => {
                    const entaxi = getEntaxiForSubproject(subproject.subprojectId);
                    if (entaxi && entaxi.entaxiId) {
                      uniqueEntaxiIds.add(entaxi.entaxiId);
                    }
                  });
                  
                  // Sum amounts from unique entaxis only
                  const totalEntaxiAmount = Array.from(uniqueEntaxiIds).reduce((total, entaxiId) => {
                    const entaxi = entaxeis.find(e => e.entaxiId === entaxiId);
                    if (entaxi && entaxi.initialAmount) {
                      // Parse amount: remove non-digit chars except comma/dot, remove dots (thousands), replace comma with dot
                      const cleaned = entaxi.initialAmount.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
                      const amount = parseFloat(cleaned);
                      if (!isNaN(amount)) {
                        return total + amount;
                      }
                    }
                    return total;
                  }, 0);
                  
                  const formatAmount = (amount) => {
                    if (!amount || amount === 0) return null;
                    return amount.toLocaleString('el-GR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    }) + ' €';
                  };
                  
                  return (
                  <ProjectGroup key={projectTitle}>
                    <ProjectGroupTitle>
                      <span style={{ flex: 1 }}>{projectTitle}</span>
                      {totalEntaxiAmount > 0 && (
                        <EntaxiAmountChip>
                          <EntaxiIcon>💰</EntaxiIcon>
                          <EntaxiLabel>Ποσό ένταξης:</EntaxiLabel>
                          <EntaxiValue>{formatAmount(totalEntaxiAmount)}</EntaxiValue>
                        </EntaxiAmountChip>
                      )}
                    </ProjectGroupTitle>
                    <SubprojectsGrid>
                      {subprojects
                        .sort((a, b) => a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' })) // Ταξινόμηση υποέργων
                        .map(project => {
                          const linkedProsklisi = findLinkedProsklisi(project.subprojectId, project.projectTitle);
                          const isLocked = project.isLocked || false;
                          return (
                            <ProjectCard
                              key={project.subprojectId}
                              project={project}
                              userRole={userRole}
                              onEdit={handleEditProject}
                              onDelete={handleDeleteProject}
                              onViewFile={handleViewFile}
                              onDownloadFile={handleDownloadFile}
                              onDeleteFile={handleDeleteFile}
                              onOpenFileManager={handleOpenFileManager}
                              onOpenEntaxis={handleOpenEntaxis}
                              onOpenEgkriseis={() => handleOpenEgkriseis(project.projectTitle, project.subprojectTitle, project.subprojectId)}
                              hasCreditApproval={hasCreditApproval(project.projectTitle, project.subprojectTitle, project.subprojectId)}
                              hasLinkedEgkrisi={hasLinkedEgkrisi(project.subprojectId, project.subprojectTitle)}
                              linkedProsklisi={linkedProsklisi}
                              onOpenLinkedProsklisi={handleOpenLinkedProsklisi}
                              isLocked={isLocked}
                              hasEntaxi={hasEntaxiForSubproject(project.subprojectId)}
                              onOpenSpecificEntaxi={() => handleOpenSpecificEntaxi(project.subprojectId)}
                              hasProsklisi={hasProsklisiForProject(project.projectTitle, project.projectId)}
                              onOpenSpecificProsklisi={() => handleOpenSpecificProsklisi(project.projectTitle, project.projectId)}
                              onViewDetails={(p) => setSelectedDetailProject(p)}
                            />
                          );
                        })}
                    </SubprojectsGrid>
                  </ProjectGroup>
                  );
                })
            )}
          </ProjectsContainer>

          {isCreditApprovalsOpen && (
            <CreditApprovalsPanel
              isOpen={isCreditApprovalsOpen}
              onClose={() => {
                setIsCreditApprovalsOpen(false);
                setHighlightProject({
                  projectTitle: null,
                  subprojectTitle: null,
                  projectKey: null,
                  subprojectKey: null
                });
                loadLinkedEgkriseis();
              }}
              userRole={userRole}
              onOpenForm={() => setIsEgkriseisFormOpen(true)}
              highlightProjectTitle={highlightProject.projectTitle}
              highlightSubprojectTitle={highlightProject.subprojectTitle}
              highlightProjectKey={highlightProject.projectKey}
              highlightSubprojectKey={highlightProject.subprojectKey}
              onLinkCreated={async () => {
                await loadLinkedEgkriseis();
                invalidateCache();
                await loadDataWithCache(true);
              }}
              onLinkRemoved={async () => {
                await loadLinkedEgkriseis();
                invalidateCache();
                await loadDataWithCache(true);
              }}
              externalLinkedEgkriseis={linkedEgkriseis}
              onRequestRefresh={async () => {
                await loadLinkedEgkriseis();
              }}
              onEgkriseisDataSaved={egkriseisRefreshTrigger}
            />
          )}
        </ContentArea>
      </ContentWrapper>

      {/* Sidebar με κουμπιά */}
      <AdminSidebar>
        {userRole !== 'USER' && (
          <>
            <AdminButton primary onClick={() => {
              if (contentWrapperRef.current) {
                savedScrollPosition.current = contentWrapperRef.current.scrollTop;
              }
              setIsFormOpen(true);
            }}>
              <AdminButtonIcon>➕</AdminButtonIcon>
              Νέο Υποέργο
            </AdminButton>
          </>
        )}
        
        <AdminButton onClick={() => setIsFiltersOpen(true)}>
          <AdminButtonIcon>🔍</AdminButtonIcon>
          Αναζήτηση &<br/>Φίλτρα
        </AdminButton>
        
        {/* Κουμπιά Εντάξεις & Προσκλήσεις - για όλους τους χρήστες */}
        <AdminButton onClick={() => {
          // Αποθήκευση scroll position
          if (contentWrapperRef.current) {
            savedScrollPosition.current = contentWrapperRef.current.scrollTop;
          }
          setIsEntaxisOpen(true);
        }}>
          <AdminButtonIcon>📊</AdminButtonIcon>
          Εντάξεις<br/>Έργων
        </AdminButton>
        
        <AdminButton onClick={() => {
          // Αποθήκευση scroll position
          if (contentWrapperRef.current) {
            savedScrollPosition.current = contentWrapperRef.current.scrollTop;
          }
          setIsProsklisisOpen(true);
        }}>
          <AdminButtonIcon>📢</AdminButtonIcon>
          Προσκλήσεις
        </AdminButton>
        
        <AdminButton onClick={() => setIsCreditApprovalsOpen(true)}>
          <AdminButtonIcon>📋</AdminButtonIcon>
          Εγκρίσεις Διάθεσης<br/>Πίστωσης
        </AdminButton>
        
        <AdminButton onClick={() => setIsTechnicalProgramOpen(true)}>
          <AdminButtonIcon>📋</AdminButtonIcon>
          Εξαγωγή Τεχνικού<br/>Προγράμματος
        </AdminButton>
        
        <AdminButton onClick={() => setIsInvestExportOpen(true)}>
          <AdminButtonIcon>📊</AdminButtonIcon>
          ΕΚΤΕΛΕΣΤΕΑ<br/>ΕΡΓΑ
        </AdminButton>
        
        <ExportButton onClick={() => setIsExportOpen(true)}>
          <AdminButtonIcon>📑</AdminButtonIcon>
          Εξαγωγή<br/>Δεδομένων
        </ExportButton>
        
        <AdminButton onClick={() => setIsDocumentTemplatesOpen(true)}>
          <AdminButtonIcon>📄</AdminButtonIcon>
          Υποδείγματα<br/>Εγγράφων
        </AdminButton>
        
        {userRole !== 'USER' && (
        <NotesButton onClick={handleOpenNotes}>
          <NotesButtonIcon>📝</NotesButtonIcon>
          ΣΗΜΕΙΩΣΕΙΣ
        </NotesButton>
        )}
        
        {userRole !== 'USER' && (
          <>
            <RefreshButton onClick={async () => {
              if (window.confirm('🔄 Θέλετε να κάνετε πλήρη ανανέωση της εφαρμογής; Αυτό θα φορτώσει όλα τα δεδομένα εκ νέου και θα καθαρίσει τυχόν προβλήματα.')) {
                try {
                  setLoading(true);
                  
                  // Καθαρισμός locks
                  await ipcRenderer.invoke('clear-all-locks');
                  
                  // Πλήρης ανανέωση όλων των δεδομένων (το cache καθαρίζεται μέσα στη function)
                  await loadDataWithCache(true); // Force refresh
                  
                  // Wait a bit longer to ensure all state updates are processed
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // Ensure loading is cleared
                  setLoading(false);
                  
                  // Force React to re-render and re-enable all inputs
                  // This ensures event handlers are properly attached
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      // Trigger a state update to force re-render
                      setProjects(prev => [...prev]);
                    });
                  });
                  
                  // Small delay before showing success message
                  setTimeout(() => {
                    alert('✅ Η εφαρμογή ανανεώθηκε επιτυχώς!');
                  }, 300);
                } catch (error) {
                  console.error('Error during full refresh:', error);
                  setLoading(false);
                  
                  // Χρήση setTimeout για να μην μπλοκάρει το UI
                  setTimeout(() => {
                    alert('❌ Σφάλμα κατά την ανανέωση: ' + error.message);
                  }, 100);
                }
              }
            }}>
              <RefreshIcon>🔄</RefreshIcon>
              <RefreshText>
                ΠΛΗΡΗΣ<br/>
                <RefreshEmphasis>ΑΝΑΝΕΩΣΗ</RefreshEmphasis>
              </RefreshText>
              <RefreshGlow />
            </RefreshButton>
            
            <BackupButton 
              onClick={() => setIsAuditLogOpen(true)}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: '2px solid rgba(255, 255, 255, 0.35)' }}
            >
              <BackupIcon>📋</BackupIcon>
              <BackupText>
                ΙΣΤΟΡΙΚΟ<br/>ΑΛΛΑΓΩΝ
              </BackupText>
            </BackupButton>

            {userRole === 'SUPERADMIN' && (
              <>
                <BackupButton onClick={() => setIsBackupManagerOpen(true)}>
                  <BackupIcon>💾</BackupIcon>
                  <BackupText>
                    BACKUP<br/>ΔΕΔΟΜΕΝΩΝ
                  </BackupText>
                </BackupButton>
                <BackupButton 
                  onClick={() => setIsUserManagementOpen(true)}
                  style={{ background: 'linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)', border: '2px solid rgba(255, 255, 255, 0.35)' }}
                >
                  <BackupIcon>👥</BackupIcon>
                  <BackupText>
                    ΔΙΑΧΕΙΡΙΣΗ<br/>ΧΡΗΣΤΩΝ
                  </BackupText>
                </BackupButton>
              </>
            )}
            
          </>
        )}
        
        {/* Quick Search */}
        <QuickSearchContainer>
          <QuickSearchGrid>
            <SearchInputContainer>
              <SearchLabel>Αναζήτηση</SearchLabel>
              <SearchInput
                ref={quickSearchInputRef}
                type="text"
                placeholder="Έργο, υποέργο, ΚΑ..."
                value={quickSearchText}
                onChange={(e) => {
                  // Άμεση ενημέρωση για responsive UI
                  setQuickSearchText(e.target.value);
                }}
                onFocus={(e) => {
                  // Βεβαιώνουμε ότι το input είναι responsive
                  e.target.style.caretColor = 'auto';
                }}
              />
            </SearchInputContainer>
            
            <SearchInputContainer>
              <SearchLabel>Κατάσταση</SearchLabel>
              <SearchSelect
                value={quickSearchStatus}
                onChange={(e) => setQuickSearchStatus(e.target.value)}
              >
                <option value="">Όλες</option>
                {getUniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </SearchSelect>
            </SearchInputContainer>
            
            <SearchInputContainer>
              <SearchLabel>Είδος</SearchLabel>
              <SearchSelect
                value={quickSearchType}
                onChange={(e) => setQuickSearchType(e.target.value)}
              >
                <option value="">Όλα</option>
                {getUniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </SearchSelect>
            </SearchInputContainer>
            
            {(quickSearchText || quickSearchStatus || quickSearchType) && (
              <ClearButton onClick={handleQuickSearchClear}>
                🗑️ Καθαρισμός
              </ClearButton>
            )}
          </QuickSearchGrid>
        </QuickSearchContainer>
      </AdminSidebar>

      {/* Subproject Detail Modal */}
      {selectedDetailProject && (
        <SubprojectDetailModal
          project={selectedDetailProject}
          onClose={() => setSelectedDetailProject(null)}
          onEdit={(p) => {
            setSelectedDetailProject(null);
            handleEditProject(p);
          }}
          userRole={userRole}
          isLocked={selectedDetailProject.isLocked || false}
        />
      )}

      {/* Project Form Modal */}
      <ProjectForm
        isOpen={isFormOpen}
        onClose={async () => {
          // Ξεκλείδωσε το project αν υπάρχει
          const projectToUnlock = editingProject;
          if (projectToUnlock && projectToUnlock.projectId) {
            try {
              await ipcRenderer.invoke('unlock-project', projectToUnlock.projectId);
              // Αθόρυβη ενημέρωση του lock status με διατήρηση ταξινόμησης
              const updatedProjects = projects.map(p => 
                p.projectId === projectToUnlock.projectId ? { ...p, isLocked: false } : p
              ).sort((a, b) => {
                // Διατήρηση αλφαβητικής ταξινόμησης
                const projectComparison = a.projectTitle.localeCompare(b.projectTitle, 'el', { sensitivity: 'base' });
                if (projectComparison !== 0) return projectComparison;
                return a.subprojectTitle.localeCompare(b.subprojectTitle, 'el', { sensitivity: 'base' });
              });
              setProjects(updatedProjects);
            } catch (error) {
              console.error('Error unlocking project:', error);
            }
          }
          setIsFormOpen(false);
          setEditingProject(null);
          // Επαναφορά scroll position
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (contentWrapperRef.current) {
                contentWrapperRef.current.scrollTop = savedScrollPosition.current;
              }
            });
          });
        }}
        onSave={handleSaveProject}
        onDelete={async (projectId, subprojectId) => {
          if (!projectId || !subprojectId) {
            alert('Σφάλμα: Μη έγκυρα δεδομένα για διαγραφή');
            return;
          }
          if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το υποέργο; Η ενέργεια είναι μη αναστρέψιμη.')) {
            try {
              // Ξεκλείδωμα πριν τη διαγραφή
              if (editingProject && editingProject.projectId) {
                await ipcRenderer.invoke('unlock-project', editingProject.projectId);
              }
              const result = await ipcRenderer.invoke('delete-subproject', projectId, subprojectId);
              if (result.success) {
                setIsFormOpen(false);
                setEditingProject(null);
                setProjects([]);
                setFilteredProjects([]);
                await loadProjects();
                await loadLinkedEgkriseis();
                alert('Το υποέργο διαγράφηκε επιτυχώς!');
              } else {
                alert('Σφάλμα κατά τη διαγραφή: ' + result.error);
              }
            } catch (error) {
              alert('Σφάλμα κατά τη διαγραφή: ' + error.message);
            }
          }
        }}
        editingProject={editingProject}
      />


      {/* PDF Viewer Modal */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        filePath={pdfViewer.filePath}
        fileName={pdfViewer.fileName}
        onClose={() => setPdfViewer({ isOpen: false, filePath: '', fileName: '' })}
      />

      {/* Advanced Filters Modal */}
      <AdvancedFilters
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onApplyFilters={handleApplyAdvancedFilters}
        currentFilters={advancedFilters}
      />

      {/* File Manager Modal */}
      {fileManager.isOpen && (
        <FileManager
          files={fileManager.files}
          fileGroups={fileManager.fileGroups}
          userRole={userRole}
          onViewFile={(fileName) => handleViewFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onDownloadFile={(fileName) => handleDownloadFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onDeleteFile={(fileName) => handleDeleteFile(fileManager.projectId, fileManager.subprojectId, fileName)}
          onClose={handleCloseFileManager}
          onRefresh={() => handleOpenFileManager(fileManager.projectId, fileManager.subprojectId)}
          onGroupFiles={handleGroupFiles}
        />
      )}

      {/* Export Data Modal */}
      <ExportData
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projects={filteredProjects}
        totalProjects={projects.length}
      />

      {/* Technical Program Export Modal */}
      <TechnicalProgramExport
        isOpen={isTechnicalProgramOpen}
        onClose={() => setIsTechnicalProgramOpen(false)}
        projects={projects} // Χρησιμοποιούμε όλα τα υποέργα, όχι τα ήδη φιλτραρισμένα, ώστε το τεχνικό πρόγραμμα να περιλαμβάνει κάθε υποέργο με υπόλοιπο στο επιλεγμένο έτος
      />

      {/* Invest Export Modal */}
      <InvestExport
        isOpen={isInvestExportOpen}
        onClose={() => setIsInvestExportOpen(false)}
      />

      {/* Entaxis Manager Modal */}
      <EntaxisManager
        isOpen={isEntaxisOpen}
        onClose={async () => {
          // Καθάρισε όλα τα locks όταν κλείνει η φόρμα
          await ipcRenderer.invoke('clear-all-locks');
          setIsEntaxisOpen(false);
          setEntaxisProjectFilter(null);
          // Ανανέωση των projects για να ενημερωθεί το lock status
          await loadProjects();
          // Επαναφορά scroll position
          setTimeout(() => {
            if (contentWrapperRef.current) {
              contentWrapperRef.current.scrollTop = savedScrollPosition.current;
            }
          }, 100);
        }}
        onDataChange={async () => {
          await loadProjects();
          await loadEntaxeis();
        }} // Callback για ανανέωση όταν αλλάζουν δεδομένα
        userRole={userRole}
        projectFilter={entaxisProjectFilter}
        proskliseis={proskliseis}
        handleOpenProsklisi={handleOpenLinkedProsklisi}
        onViewFile={(filePath, fileName) => {
          setPdfViewer({
            isOpen: true,
            filePath,
            fileName
          });
        }}
      />

      {/* Prosklisis Manager Modal */}
      <ProsklisisManager
        isOpen={isProsklisisOpen}
        onClose={async () => {
          // Καθάρισε όλα τα locks όταν κλείνει η φόρμα
          await ipcRenderer.invoke('clear-all-locks');
          setIsProsklisisOpen(false);
          setProsklisiProjectFilter(null);
          setSelectedProsklisiId(null);
          // Ανανέωση των projects για να ενημερωθεί το lock status
          await loadProjects();
          // Επαναφορά scroll position
          setTimeout(() => {
            if (contentWrapperRef.current) {
              contentWrapperRef.current.scrollTop = savedScrollPosition.current;
            }
          }, 100);
        }}
        userRole={userRole}
        projectFilter={prosklisiProjectFilter}
        selectedProsklisiId={selectedProsklisiId}
      />


      {/* Egkriseis Form Modal */}
      <EgkriseisFormComponent
        isOpen={isEgkriseisFormOpen}
        onClose={async () => {
          // Καθάρισε όλα τα locks όταν κλείνει η φόρμα
          await ipcRenderer.invoke('clear-all-locks');
          setIsEgkriseisFormOpen(false);
          // Reload projects and linked egkriseis to update any changes
          await loadProjects();
          await loadLinkedEgkriseis();
        }}
        onSave={async () => {
          // Reload projects and linked egkriseis to update any changes
          await loadProjects();
          await loadLinkedEgkriseis();
          
          // Trigger refresh στο CreditApprovalsPanel αν είναι ανοιχτό
          // Χρήση requestAnimationFrame για non-blocking update
          if (isCreditApprovalsOpen) {
            requestAnimationFrame(() => {
              setEgkriseisRefreshTrigger(prev => prev + 1);
            });
          }
        }}
      />

      {isNotesOpen && (
        <NotesOverlay onClick={(e) => e.target === e.currentTarget && handleCloseNotes()}>
          <NotesContainer>
            <NotesSidebar>
              <NotesSidebarHeader>
                <NotesSidebarTitle>Ομάδες</NotesSidebarTitle>
                <SubtleHint>Οργάνωσε τις σημειώσεις σου όπως σε εξυπηρετεί</SubtleHint>
              </NotesSidebarHeader>
              <GroupList>
                {noteGroups.map(group => (
                  <GroupListItem key={group.id}>
                    <GroupButton
                      type="button"
                      color={group.color}
                      active={selectedNoteGroupId === group.id}
                      onClick={() => setSelectedNoteGroupId(group.id)}
                    >
                      {group.name}
                      <span>{groupCounts[group.id] || 0} σημειώσεις</span>
                    </GroupButton>
                    {group.id !== DEFAULT_NOTE_GROUP_ID && (
                      <GroupDeleteButton
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Διαγραφή ομάδας"
                      >
                        ✕
                      </GroupDeleteButton>
                    )}
                  </GroupListItem>
                ))}
              </GroupList>
              <GroupForm>
                <GroupFormRow>
                  <GroupInput
                    type="text"
                    placeholder="Όνομα νέας ομάδας"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <ColorInput
                    type="color"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, color: e.target.value }))}
                  />
                </GroupFormRow>
                <GroupFormButton type="button" onClick={handleAddGroup}>
                  + Προσθήκη Ομάδας
                </GroupFormButton>
              </GroupForm>
            </NotesSidebar>
            <NotesMain>
              <NotesHeader>
                <NotesHeaderTitle>
                  <h2>Ψηφιακό Σημειωματάριο</h2>
                  <span>{activeNoteGroup ? activeNoteGroup.name : '—'} · {filteredNotes.length} σημειώσεις</span>
                </NotesHeaderTitle>
                <NotesCloseButton onClick={handleCloseNotes}>Κλείσιμο</NotesCloseButton>
              </NotesHeader>

              <NotesSearchRow>
                <NotesSearchInput
                  type="text"
                  placeholder="Αναζήτηση σε τίτλους, περιεχόμενο ή ετικέτες..."
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                />
              </NotesSearchRow>

              <NoteComposer data-note-composer>
                {editingNote && (
                  <div style={{ 
                    marginBottom: '12px', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#2563eb',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    ✏️ Επεξεργασία: {editingNote.title}
                  </div>
                )}
                <NoteComposerRow>
                  <GroupInput
                    type="text"
                    placeholder="Τίτλος σημείωσης"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <NoteGroupSelect
                    value={noteForm.groupId}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, groupId: e.target.value }))}
                  >
                    {noteGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </NoteGroupSelect>
                  <GroupInput
                    type="text"
                    placeholder="Ετικέτες (χωρισμένες με κόμμα)"
                    value={noteForm.tags}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, tags: e.target.value }))}
                  />
                </NoteComposerRow>
                <NoteTextInput
                  placeholder="Κατέγραψε ιδέες, εκκρεμότητες ή υπενθυμίσεις..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                />
                {noteForm.checklist && noteForm.checklist.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    padding: '12px',
                    background: 'rgba(241, 245, 249, 0.5)',
                    borderRadius: '12px',
                    border: '1px solid rgba(203, 213, 225, 0.5)'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155', marginBottom: '4px' }}>
                      Checklist:
                    </div>
                    {noteForm.checklist.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={item.completed || false}
                          onChange={(e) => {
                            const updated = noteForm.checklist.map(i => 
                              i.id === item.id ? { ...i, completed: e.target.checked } : i
                            );
                            setNoteForm(prev => ({ ...prev, checklist: updated }));
                          }}
                        />
                        <input
                          type="text"
                          value={item.text || ''}
                          onChange={(e) => {
                            const updated = noteForm.checklist.map(i => 
                              i.id === item.id ? { ...i, text: e.target.value } : i
                            );
                            setNoteForm(prev => ({ ...prev, checklist: updated }));
                          }}
                          placeholder="Εργασία..."
                          style={{ 
                            flex: 1, 
                            padding: '6px 10px', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = noteForm.checklist.filter(i => i.id !== item.id);
                            setNoteForm(prev => ({ ...prev, checklist: updated }));
                          }}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newItem = { id: `checklist-${Date.now()}`, text: '', completed: false };
                        setNoteForm(prev => ({ ...prev, checklist: [...(prev.checklist || []), newItem] }));
                      }}
                      style={{
                        background: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginTop: '4px'
                      }}
                    >
                      + Προσθήκη Εργασίας
                    </button>
                  </div>
                )}
                {(!noteForm.checklist || noteForm.checklist.length === 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newItem = { id: `checklist-${Date.now()}`, text: '', completed: false };
                      setNoteForm(prev => ({ ...prev, checklist: [newItem] }));
                    }}
                    style={{
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#6366f1',
                      border: '1px dashed #6366f1',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}
                  >
                    + Προσθήκη Checklist
                  </button>
                )}
                <NoteSubmitRow>
                  <SubtleHint>
                    {editingNote 
                      ? 'Κάνε τις αλλαγές σου και πάτα "Ενημέρωση" για να αποθηκευτούν.'
                      : 'Χρησιμοποίησε ετικέτες για γρήγορη ομαδοποίηση και αναζήτηση.'}
                  </SubtleHint>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {editingNote && (
                      <NoteCancelButton type="button" onClick={handleCancelEdit}>
                        Ακύρωση
                      </NoteCancelButton>
                    )}
                    <NoteSubmitButton type="button" onClick={handleAddNote}>
                      {editingNote ? 'Ενημέρωση Σημείωσης' : 'Προσθήκη Σημείωσης'}
                    </NoteSubmitButton>
                  </div>
                </NoteSubmitRow>
              </NoteComposer>

              {filteredNotes.length === 0 ? (
                <NotesEmptyState>
                  <div style={{ fontSize: '1.5rem' }}>🌌</div>
                  <div>Δεν υπάρχουν σημειώσεις στην επιλεγμένη ομάδα ακόμη.</div>
                  <SubtleHint>Ξεκίνα να οργανώνεις τις σκέψεις σου δημιουργώντας την πρώτη σημείωση.</SubtleHint>
                </NotesEmptyState>
              ) : (
                <NotesGrid>
                  {filteredNotes.map(note => {
                    const group = noteGroups.find(g => g.id === note.groupId);
                    const priority = note.priority || 'medium';
                    const status = note.status || 'new';
                    const priorityColors = { high: '#dc2626', medium: '#f59e0b', low: '#10b981' };
                    const statusColors = { 'new': '#3b82f6', 'in-progress': '#f59e0b', 'completed': '#10b981' };
                    const accent = group?.color || '#6366f1';
                    const priorityColor = priorityColors[priority] || priorityColors.medium;
                    const statusColor = statusColors[status] || statusColors.new;
                    const isOverdue = note.dueDate && new Date(note.dueDate) < new Date() && status !== 'completed';
                    
                    return (
                      <NoteCard
                        key={note.id}
                        data-accent={accent}
                        onClick={() => handleOpenNoteModal(note)}
                        style={{
                          borderColor: isOverdue ? '#dc2626' : accent,
                          boxShadow: `0 12px 28px ${hexToRgba(isOverdue ? '#dc2626' : accent, 0.22)}`,
                          borderLeftWidth: '4px',
                          borderLeftColor: priorityColor
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <NoteTitle style={{ flex: 1 }}>{note.title || 'Χωρίς τίτλο'}</NoteTitle>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              background: `${priorityColor}20`,
                              color: priorityColor,
                              textTransform: 'uppercase'
                            }}>
                              {priority === 'high' ? '🔴 Υψηλή' : priority === 'medium' ? '🟡 Μεσαία' : '🟢 Χαμηλή'}
                            </span>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              background: `${statusColor}20`,
                              color: statusColor,
                              textTransform: 'uppercase'
                            }}>
                              {status === 'new' ? 'Νέο' : status === 'in-progress' ? 'Σε εξέλιξη' : 'Ολοκληρωμένο'}
                            </span>
                          </div>
                        </div>
                        {note.content && <NoteContent>{note.content}</NoteContent>}
                        {note.checklist && note.checklist.length > 0 && (
                          <div style={{ 
                            marginTop: '8px',
                            padding: '8px',
                            background: 'rgba(241, 245, 249, 0.6)',
                            borderRadius: '8px',
                            fontSize: '0.8rem'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#475569' }}>
                              Checklist ({note.checklist.filter(item => item.completed).length}/{note.checklist.length}):
                            </div>
                            {note.checklist.slice(0, 3).map((item, idx) => (
                              <div key={item.id || idx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                textDecoration: item.completed ? 'line-through' : 'none',
                                opacity: item.completed ? 0.6 : 1,
                                color: item.completed ? '#94a3b8' : '#475569'
                              }}>
                                <span>{item.completed ? '✅' : '☐'}</span>
                                <span>{item.text || 'Χωρίς περιεχόμενο'}</span>
                              </div>
                            ))}
                            {note.checklist.length > 3 && (
                              <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.75rem' }}>
                                +{note.checklist.length - 3} περισσότερες...
                              </div>
                            )}
                          </div>
                        )}
                        {note.tags && note.tags.length > 0 && (
                          <NoteMeta>
                            {note.tags.map(tag => (
                              <Tag key={`${note.id}-${tag}`}>#{tag}</Tag>
                            ))}
                          </NoteMeta>
                        )}
                        <NoteMeta>
                          <span>{new Date(note.createdAt || Date.now()).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {note.dueDate && (
                            <span style={{ 
                              color: isOverdue ? '#dc2626' : '#64748b',
                              fontWeight: isOverdue ? '700' : '400'
                            }}>
                              • Due: {new Date(note.dueDate).toLocaleDateString('el-GR')}
                              {isOverdue && ' ⚠️'}
                            </span>
                          )}
                          {group && <span style={{ color: hexToRgba(group.color, 0.8) }}>• {group.name}</span>}
                        </NoteMeta>
                        <NoteActions onClick={(e) => e.stopPropagation()}>
                          <NoteEditButton onClick={(e) => {
                            e.stopPropagation();
                            handleOpenNoteModal(note);
                          }}>
                            Επεξεργασία
                          </NoteEditButton>
                          <NoteActionButton onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}>
                            Διαγραφή
                          </NoteActionButton>
                        </NoteActions>
                      </NoteCard>
                    );
                  })}
                </NotesGrid>
              )}
            </NotesMain>
          </NotesContainer>
        </NotesOverlay>
      )}

      {/* Egkriseis Manager Modal */}
      <EgkriseisManager
        isOpen={isEgkriseisFormOpen}
        onClose={async () => {
          // Καθάρισε όλα τα locks όταν κλείνει η φόρμα
          await ipcRenderer.invoke('clear-all-locks');
          setIsEgkriseisFormOpen(false);
          // Reload linked egkriseis when closing the modal
          await loadLinkedEgkriseis();
          await loadProjects();
        }}
        onLinkCreated={async () => {
          // Reload linked egkriseis when a new link is created
          await loadLinkedEgkriseis();
        }}
        projects={projectsAsArrayOfArrays}
        userRole={userRole}
      />

      {/* Document Templates Manager */}
      {isDocumentTemplatesOpen && (
        <DocumentTemplatesManager
          onClose={() => setIsDocumentTemplatesOpen(false)}
        />
      )}

      {isBackupManagerOpen && (
        <BackupManager
          isOpen={isBackupManagerOpen}
          onClose={() => setIsBackupManagerOpen(false)}
        />
      )}

      {isAuditLogOpen && (
        <AuditLogViewer
          isOpen={isAuditLogOpen}
          onClose={() => setIsAuditLogOpen(false)}
          currentUser={currentUser}
        />
      )}

      {isUserManagementOpen && (
        <UserManagement
          onClose={() => setIsUserManagementOpen(false)}
          currentUser={currentUser}
        />
      )}


      {/* Note Modal */}
      {isNoteModalOpen && selectedNoteForModal && (
        <NoteModalOverlay onClick={handleCloseNoteModal}>
          <NoteModalContainer onClick={(e) => e.stopPropagation()}>
            <NoteModalHeader>
              <NoteModalTitle>Επεξεργασία Σημείωσης</NoteModalTitle>
              <NoteModalCloseButton onClick={handleCloseNoteModal}>✕</NoteModalCloseButton>
            </NoteModalHeader>
            <NoteModalContent>
              <NoteModalField>
                <NoteModalLabel>Τίτλος</NoteModalLabel>
                <NoteModalInput
                  type="text"
                  value={selectedNoteForModal.title || ''}
                  onChange={(e) => handleUpdateNoteInModal('title', e.target.value)}
                  placeholder="Τίτλος σημείωσης"
                />
              </NoteModalField>
              <NoteModalField>
                <NoteModalLabel>Περιεχόμενο</NoteModalLabel>
                <NoteModalTextarea
                  value={selectedNoteForModal.content || ''}
                  onChange={(e) => handleUpdateNoteInModal('content', e.target.value)}
                  placeholder="Περιεχόμενο σημείωσης"
                />
              </NoteModalField>
              <NoteModalField>
                <NoteModalLabel>Ετικέτες (διαχωρισμένες με κόμμα)</NoteModalLabel>
                <NoteModalInput
                  type="text"
                  value={(selectedNoteForModal.tags || []).join(', ')}
                  onChange={(e) => handleUpdateNoteInModal('tags', e.target.value)}
                  placeholder="π.χ. σημαντικό, έκτακτο, follow-up"
                />
              </NoteModalField>
              <NoteModalField>
                <NoteModalLabel>Ομάδα</NoteModalLabel>
                <NoteGroupSelect
                  value={selectedNoteForModal.groupId || DEFAULT_NOTE_GROUP_ID}
                  onChange={(e) => handleUpdateNoteInModal('groupId', e.target.value)}
                >
                  {noteGroups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </NoteGroupSelect>
              </NoteModalField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <NoteModalField>
                  <NoteModalLabel>Προτεραιότητα</NoteModalLabel>
                  <NoteGroupSelect
                    value={selectedNoteForModal.priority || 'medium'}
                    onChange={(e) => handleUpdateNoteInModal('priority', e.target.value)}
                  >
                    <option value="low">Χαμηλή</option>
                    <option value="medium">Μεσαία</option>
                    <option value="high">Υψηλή</option>
                  </NoteGroupSelect>
                </NoteModalField>
                <NoteModalField>
                  <NoteModalLabel>Status</NoteModalLabel>
                  <NoteGroupSelect
                    value={selectedNoteForModal.status || 'new'}
                    onChange={(e) => handleUpdateNoteInModal('status', e.target.value)}
                  >
                    <option value="new">Νέο</option>
                    <option value="in-progress">Σε εξέλιξη</option>
                    <option value="completed">Ολοκληρωμένο</option>
                  </NoteGroupSelect>
                </NoteModalField>
                <NoteModalField>
                  <NoteModalLabel>Due Date</NoteModalLabel>
                  <NoteModalInput
                    type="date"
                    value={selectedNoteForModal.dueDate || ''}
                    onChange={(e) => handleUpdateNoteInModal('dueDate', e.target.value)}
                  />
                </NoteModalField>
              </div>
              <NoteModalField>
                <NoteModalLabel>Checklist</NoteModalLabel>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  padding: '12px',
                  background: 'rgba(241, 245, 249, 0.5)',
                  borderRadius: '12px',
                  border: '1px solid rgba(203, 213, 225, 0.5)'
                }}>
                  {(selectedNoteForModal.checklist || []).map((item, idx) => (
                    <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={item.completed || false}
                        onChange={(e) => {
                          const updated = (selectedNoteForModal.checklist || []).map(i => 
                            i.id === item.id ? { ...i, completed: e.target.checked } : i
                          );
                          handleUpdateNoteInModal('checklist', updated);
                        }}
                      />
                      <NoteModalInput
                        type="text"
                        value={item.text || ''}
                        onChange={(e) => {
                          const updated = (selectedNoteForModal.checklist || []).map(i => 
                            i.id === item.id ? { ...i, text: e.target.value } : i
                          );
                          handleUpdateNoteInModal('checklist', updated);
                        }}
                        placeholder="Εργασία..."
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (selectedNoteForModal.checklist || []).filter(i => i.id !== item.id);
                          handleUpdateNoteInModal('checklist', updated);
                        }}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    style={{
                      background: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      marginTop: '4px'
                    }}
                  >
                    + Προσθήκη Εργασίας
                  </button>
                </div>
              </NoteModalField>
            </NoteModalContent>
            <NoteModalFooter>
              <NoteModalButton onClick={handleCloseNoteModal}>
                Ακύρωση
              </NoteModalButton>
              <NoteModalButton primary onClick={handleSaveNoteFromModal}>
                Αποθήκευση
              </NoteModalButton>
            </NoteModalFooter>
          </NoteModalContainer>
        </NoteModalOverlay>
      )}

    </DashboardContainer>
  );
}

export default Dashboard;
