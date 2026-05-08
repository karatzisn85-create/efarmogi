import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ProsklisisForm from './ProsklisisForm';
import ProsklisisFileManager from './ProsklisisFileManager';
import ProsklisiModificationForm from './ProsklisiModificationForm';
import ProsklisisExportDialog from './ProsklisisExportDialog';
import { containsSearchTerm } from '../utils/searchUtils';

const { ipcRenderer } = window.require('electron');

// Styled Components
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
  z-index: 10000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 15px;
  width: 95%;
  max-width: 1400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  padding: 2rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 15px 15px 0 0;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ModalContent = styled.div`
  padding: 2rem;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const NewProsklisisButton = styled.button`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }
`;

const SearchAndFiltersContainer = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const SearchTitle = styled.h3`
  color: #333;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const QuickSearchContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 0.8rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const FilterSelect = styled.select`
  padding: 0.8rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const AdvancedFiltersToggle = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;

const AdvancedFiltersContainer = styled.div`
  display: ${props => props.show ? 'grid' : 'none'};
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
`;

const FilterInput = styled.input`
  padding: 0.6rem 0.8rem;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
`;

const FilterLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const ClearFiltersButton = styled.button`
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  grid-column: 1 / -1;
  justify-self: start;
  margin-top: 0.5rem;

  &:hover {
    background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
    transform: translateY(-1px);
  }
`;

const ExportButton = styled.button`
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  margin-left: auto;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const StatCard = styled.div`
  background: white;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-left: 3px solid ${props => props.color || '#667eea'};
`;

const StatIcon = styled.span`
  font-size: 1.1rem;
`;

const StatText = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
`;

const StatNumber = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #333;
`;

const ProsklisisList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const ProskliseiGroup = styled.div`
  background: ${props => props.groupColor || '#f8f9fa'};
  border-radius: 15px;
  padding: 2rem;
  border: 3px solid ${props => props.borderColor || '#dee2e6'};
  box-shadow: 0 8px 32px ${props => props.shadowColor || 'rgba(0, 0, 0, 0.15)'};
  will-change: auto;
  transform: translateZ(0);
  position: relative;
  margin-bottom: 2rem;
  
  /* Subtle pattern overlay για καλύτερο διαχωρισμό */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.03) 10px,
      rgba(255, 255, 255, 0.03) 20px
    );
    border-radius: 15px;
    pointer-events: none;
  }
`;

const GroupTitle = styled.h3`
  color: ${props => props.titleColor || '#333'};
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &::before {
    content: "${props => props.icon || '📋'}";
    font-size: 1.1rem;
  }
`;

const GroupProskliseis = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ProsklisisCard = styled.div`
  background: ${props => {
    if (props.isLocked) return '#ffffff';
    switch(props.status) {
      case 'Υπό Ωρίμανση': return 'linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 235, 59, 0.15) 100%)';
      case 'Υπό Υποβολή': return 'linear-gradient(135deg, rgba(0, 123, 255, 0.15) 0%, rgba(52, 144, 220, 0.15) 100%)';
      case 'Υποβληθέν': return 'linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(76, 175, 80, 0.15) 100%)';
      case 'Υποβληθέν ΤΔΠ': return 'linear-gradient(135deg, rgba(76, 175, 80, 0.18) 0%, rgba(139, 195, 74, 0.18) 100%)';
      default: return '#ffffff';
    }
  }} !important;
  border-radius: 15px;
  padding: 1.8rem;
  box-shadow: ${props => {
    switch(props.status) {
      case 'Υπό Ωρίμανση': return '0 6px 20px rgba(255, 193, 7, 0.15)';
      case 'Υπό Υποβολή': return '0 6px 20px rgba(0, 123, 255, 0.15)';
      case 'Υποβληθέν': return '0 6px 20px rgba(40, 167, 69, 0.15)';
      case 'Υποβληθέν ΤΔΠ': return '0 8px 25px rgba(76, 175, 80, 0.2)';
      default: return '0 4px 12px rgba(0, 0, 0, 0.1)';
    }
  }};
  border: 2px solid ${props => {
    switch(props.status) {
      case 'Υπό Ωρίμανση': return 'rgba(255, 193, 7, 0.2)';
      case 'Υπό Υποβολή': return 'rgba(0, 123, 255, 0.2)';
      case 'Υποβληθέν': return 'rgba(40, 167, 69, 0.2)';
      case 'Υποβληθέν ΤΔΠ': return 'rgba(76, 175, 80, 0.3)';
      default: return 'rgba(108, 117, 125, 0.1)';
    }
  }};
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  position: relative;
  opacity: ${props => props.isLocked ? 0.7 : 1};
  will-change: transform;
  transform: translateZ(0);
  
  &:hover {
    transform: translateY(-2px) translateZ(0);
    box-shadow: ${props => {
      switch(props.status) {
        case 'Υπό Ωρίμανση': return '0 6px 20px rgba(255, 193, 7, 0.2)';
        case 'Υπό Υποβολή': return '0 6px 20px rgba(0, 123, 255, 0.2)';
        case 'Υποβληθέν': return '0 6px 20px rgba(40, 167, 69, 0.2)';
        case 'Υποβληθέν ΤΔΠ': return '0 8px 25px rgba(76, 175, 80, 0.25)';
        default: return '0 4px 15px rgba(0, 0, 0, 0.12)';
      }
    }};
  }

`;

const LockIndicator = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.isLocked ? '#dc3545' : '#28a745'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
`;

const ProsklisisTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.2rem;
  font-weight: 600;
`;

const ProsklisisDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  margin-top: 1rem;
`;

const DetailItem = styled.div`
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #dee2e6;
  }
`;

const DetailLabel = styled.div`
  font-weight: 600;
  color: #495057;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  
  &::before {
    content: '';
    width: 3px;
    height: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
  }
`;

const DetailValue = styled.div`
  font-size: 0.95rem;
  color: #212529;
  font-weight: 500;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const FundingSourceItem = styled.div`
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border: 2px solid #2196f3;
  border-radius: 12px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 5px;
    height: 100%;
    background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  }
`;

const FundingSourceLabel = styled.div`
  font-weight: 700;
  color: #1565c0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FundingSourceText = styled.div`
  font-size: 1rem;
  line-height: 1.6;
  color: #0d47a1;
  font-weight: 500;
  max-height: 120px;
  overflow-y: auto;
  padding-left: 0.5rem;
`;

const StatusBadge = styled.span`
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  background: ${props => {
    switch(props.status) {
      case 'Υπό Ωρίμανση': return '#fff3cd';
      case 'Υπό Υποβολή': return '#cce5ff';
      case 'Υποβληθέν': return '#d4edda';
      default: return '#e9ecef';
    }
  }};
  color: ${props => {
    switch(props.status) {
      case 'Υπό Ωρίμανση': return '#856404';
      case 'Υπό Υποβολή': return '#004085';
      case 'Υποβληθέν': return '#155724';
      default: return '#495057';
    }
  }};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  ${props => {
    if (props.primary) return `
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
        transform: translateY(-1px);
      }
    `;
    if (props.edit) return `
      background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #1e7e34 0%, #155724 100%);
        transform: translateY(-1px);
      }
    `;
    if (props.delete) return `
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
        transform: translateY(-1px);
      }
    `;
    return `
      background: linear-gradient(135deg, #6c757d 0%, #545b62 100%);
      color: white;
      &:hover { 
        background: linear-gradient(135deg, #545b62 0%, #3d4147 100%);
        transform: translateY(-1px);
      }
    `;
  }}
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  font-size: 1.1rem;
`;

const NoDataMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  font-size: 1.1rem;
`;

const ModificationsSection = styled.div`
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 3px solid #ff9800;
  position: relative;
  
  &::before {
    content: '📝 ΤΡΟΠΟΠΟΙΗΣΕΙΣ';
    position: absolute;
    top: -12px;
    left: 1rem;
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    color: white;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  }
`;

const ModificationsContainer = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ModificationCard = styled.div`
  background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
  border: 2px solid #ffb74d;
  border-radius: 12px;
  padding: 1.2rem;
  position: relative;
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 152, 0, 0.2);
  }
`;

const ModificationNumberBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 1rem;
  background: linear-gradient(135deg, #ff6f00 0%, #e65100 100%);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(255, 111, 0, 0.4);
  border: 2px solid white;
`;

const ModificationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 2px solid rgba(255, 152, 0, 0.2);
`;

const ModificationTitle = styled.h4`
  color: #e65100;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ModificationDate = styled.div`
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(255, 152, 0, 0.3);
`;

const ModificationDescription = styled.div`
  background: white;
  border: 1px solid #ffe082;
  border-radius: 8px;
  padding: 1rem;
  color: #bf360c;
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1rem;
  font-weight: 500;
`;

const ChangesSection = styled.div`
  background: white;
  border: 2px solid #ffcc80;
  border-radius: 10px;
  padding: 1rem;
  margin-top: 1rem;
`;

const ChangesTitle = styled.div`
  font-weight: 700;
  color: #e65100;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.8rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #ffcc80;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '🔄';
    font-size: 1rem;
  }
`;

const ChangesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const ChangeItem = styled.div`
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-left: 4px solid #ff9800;
  border-radius: 6px;
  padding: 0.8rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #5d4037;
  transition: all 0.2s ease;
  
  &:hover {
    background: linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%);
    transform: translateX(4px);
  }
  
  strong {
    color: #e65100;
    font-weight: 700;
    display: block;
    margin-bottom: 0.3rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
`;

const ModificationActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
`;

const ModificationButton = styled.button`
  background: ${props => props.variant === 'edit' ? '#2196f3' : '#f44336'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover {
    background: ${props => props.variant === 'edit' ? '#1976d2' : '#d32f2f'};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;


function ProsklisisManager({ isOpen, onClose, userRole, projectFilter = null, selectedProsklisiId = null }) {
  const [proskliseis, setProskliseis] = useState([]);
  const [filteredProskliseis, setFilteredProskliseis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProsklisi, setEditingProsklisi] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileManagerOpen, setFileManagerOpen] = useState({
    isOpen: false,
    prosklisiId: null,
    prosklisiTitle: ''
  });
  const [prosklisiModifications, setProsklisiModifications] = useState({});
  const [editingModification, setEditingModification] = useState(null);
  const [isModificationFormOpen, setIsModificationFormOpen] = useState(false);
  const [prosklisiLocks, setProsklisiLocks] = useState({});
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  
  // Advanced Search state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    axis: '',
    fundingSource: '',
    status: '',
    minBudget: '',
    maxBudget: '',
    dateFrom: '',
    dateTo: ''
  });
  const [quickSearchStatus, setQuickSearchStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Καθαρισμός stale locks όταν ανοίγει ο manager
      ipcRenderer.invoke('clear-all-locks').then(() => {
        loadProskliseis();
        loadProsklisiLocks();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    filterProskliseis();
  }, [proskliseis, searchTerm, projectFilter, quickSearchStatus, advancedFilters, selectedProsklisiId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (proskliseis.length > 0) {
      loadProsklisiLocks();
    }
  }, [proskliseis]);

  // Realtime lock monitoring για proskliseis - αθόρυβο με βελτιστοποίηση
  useEffect(() => {
    let isActive = true;
    
    const checkLocks = async () => {
      if (!isActive) return;
      
      setProskliseis(currentProskliseis => {
        if (!currentProskliseis || currentProskliseis.length === 0) return currentProskliseis;
        
        // Batch processing για καλύτερη απόδοση
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < currentProskliseis.length; i += BATCH_SIZE) {
          batches.push(currentProskliseis.slice(i, i + BATCH_SIZE));
        }
        
        Promise.all(
          batches.map(async (batch, batchIndex) => {
            if (batchIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const batchLocks = {};
            await Promise.all(
              batch.map(async (prosklisi) => {
                try {
                  const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
                  batchLocks[prosklisi.prosklisiId] = lockStatus.locked;
                } catch (error) {
                  setProsklisiLocks(prevLocks => {
                    batchLocks[prosklisi.prosklisiId] = prevLocks[prosklisi.prosklisiId] || false;
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
          setProsklisiLocks(prevLocks => {
            const hasChanges = Object.keys(newLocks).some(id => 
              newLocks[id] !== prevLocks[id]
            );
            
            if (hasChanges) {
              console.log('Prosklisi lock changes detected, updating silently...');
              return newLocks;
            }
            return prevLocks;
          });
        }).catch(error => {
          console.error('Error checking prosklisi locks:', error);
        });
        
        return currentProskliseis;
      });
    };
    
    // Αρχικό delay και μετά periodic check
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      checkLocks();
      
      intervalId = setInterval(() => {
        if (isActive) {
          checkLocks();
        }
      }, 8000); // Κάθε 8 δευτερόλεπτα (από 3) για μείωση φορτίου
    }, 2000);
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // Empty deps - uses functional updates

  const loadProskliseis = async () => {
    setLoading(true);
    try {
      const data = await ipcRenderer.invoke('load-all-proskliseis');
      setProskliseis(data || []);
      
      // Φόρτωση τροποποιήσεων για κάθε πρόσκληση
      const modifications = {};
      for (const prosklisi of data || []) {
        try {
          const mods = await ipcRenderer.invoke('load-prosklisi-modifications', prosklisi.prosklisiId);
          modifications[prosklisi.prosklisiId] = mods || [];
        } catch (error) {
          console.error(`Error loading modifications for prosklisi ${prosklisi.prosklisiId}:`, error);
          modifications[prosklisi.prosklisiId] = [];
        }
      }
      setProsklisiModifications(modifications);
    } catch (error) {
      console.error('Error loading proskliseis:', error);
      setProskliseis([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProsklisiLocks = async () => {
    try {
      const locks = {};
      for (const prosklisi of proskliseis) {
        const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
        locks[prosklisi.prosklisiId] = lockStatus.locked || false;
      }
      setProsklisiLocks(locks);
    } catch (error) {
      console.error('Error loading prosklisi locks:', error);
    }
  };

  const filterProskliseis = () => {
    let filtered = [...proskliseis];
    
    // Project filter (if provided)
    if (projectFilter) {
      filtered = filtered.filter(prosklisi => 
        prosklisi.title === projectFilter
      );
    }
    
    // Quick search filter (searches in title/axis/code)
    if (searchTerm.trim()) {
      filtered = filtered.filter(prosklisi => 
        containsSearchTerm(prosklisi.title, searchTerm) ||
        containsSearchTerm(prosklisi.axis, searchTerm) ||
        containsSearchTerm(prosklisi.fundingSource, searchTerm) ||
        containsSearchTerm(prosklisi.code, searchTerm) ||
        containsSearchTerm(prosklisi.status, searchTerm)
      );
    }

    // Quick status filter
    if (quickSearchStatus) {
      filtered = filtered.filter(prosklisi => prosklisi.status === quickSearchStatus);
    }

    // Advanced filters
    if (advancedFilters.axis) {
      filtered = filtered.filter(prosklisi => 
        containsSearchTerm(prosklisi.axis, advancedFilters.axis)
      );
    }

    if (advancedFilters.fundingSource) {
      filtered = filtered.filter(prosklisi => 
        containsSearchTerm(prosklisi.fundingSource, advancedFilters.fundingSource)
      );
    }

    if (advancedFilters.status) {
      filtered = filtered.filter(prosklisi => prosklisi.status === advancedFilters.status);
    }

    // Budget range filters
    if (advancedFilters.minBudget) {
      const minBudget = parseFloat(advancedFilters.minBudget.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(prosklisi => {
        if (!prosklisi.budgetRange) return false;
        // Extract numeric values from budget range (e.g., "100.000 - 500.000 €")
        const budgetMatch = prosklisi.budgetRange.match(/(\d+(?:[.,]\d+)?)/g);
        if (!budgetMatch) return false;
        const minRange = parseFloat(budgetMatch[0].replace(',', '.'));
        return minRange >= minBudget;
      });
    }

    if (advancedFilters.maxBudget) {
      const maxBudget = parseFloat(advancedFilters.maxBudget.replace(/[^\d.,]/g, '').replace(',', '.'));
      filtered = filtered.filter(prosklisi => {
        if (!prosklisi.budgetRange) return false;
        const budgetMatch = prosklisi.budgetRange.match(/(\d+(?:[.,]\d+)?)/g);
        if (!budgetMatch) return false;
        const maxRange = parseFloat(budgetMatch[budgetMatch.length - 1].replace(',', '.'));
        return maxRange <= maxBudget;
      });
    }

    // Date filters - Helper function to parse date from various formats
    const parseDate = (dateString) => {
      if (!dateString) return null;
      
      // If it's already in YYYY-MM-DD format (from input type="date")
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString + 'T00:00:00');
      }
      
      // If it's in DD-MM-YYYY format (stored deadline format)
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('-');
        return new Date(`${year}-${month}-${day}T00:00:00`);
      }
      
      // Try default Date parsing
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) {
        console.warn('Could not parse date:', dateString);
        return null;
      }
      return parsed;
    };

    // Helper function to compare dates without time
    const compareDatesOnly = (date1, date2) => {
      const d1 = parseDate(date1);
      const d2 = parseDate(date2);
      
      // If either date couldn't be parsed, return null to indicate invalid comparison
      if (!d1 || !d2) return null;
      
      // Set time to midnight for both dates to compare only dates
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      return d1.getTime() - d2.getTime();
    };

    if (advancedFilters.dateFrom) {
      filtered = filtered.filter(prosklisi => {
        if (!prosklisi.deadline) return false;
        const comparison = compareDatesOnly(prosklisi.deadline, advancedFilters.dateFrom);
        // If comparison is null, dates couldn't be parsed, so exclude this item
        if (comparison === null) return false;
        return comparison >= 0;
      });
    }

    if (advancedFilters.dateTo) {
      filtered = filtered.filter(prosklisi => {
        if (!prosklisi.deadline) return false;
        const comparison = compareDatesOnly(prosklisi.deadline, advancedFilters.dateTo);
        // If comparison is null, dates couldn't be parsed, so exclude this item
        if (comparison === null) return false;
        return comparison <= 0;
      });
    }
    
    // Filter by selected prosklisi ID (από ένταξη)
    if (selectedProsklisiId) {
      filtered = filtered.filter(prosklisi => prosklisi.prosklisiId === selectedProsklisiId);
    }
    
    setFilteredProskliseis(filtered);
  };

  const handleSaveProsklisi = async (prosklisiData) => {
    try {
      await ipcRenderer.invoke('save-prosklisi', prosklisiData);
      
      // Ξεκλείδωμα της πρόσκλησης μετά την αποθήκευση
      if (editingProsklisi && editingProsklisi.prosklisiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
        // Άμεση ενημέρωση του UI
        setProsklisiLocks(prev => ({
          ...prev,
          [editingProsklisi.prosklisiId]: false
        }));
      }
      
      await loadProskliseis();
      setIsFormOpen(false);
      setEditingProsklisi(null);
    } catch (error) {
      console.error('Error saving prosklisi:', error);
    }
  };

  const handleSaveModification = async (modificationData) => {
    try {
      // Αποθήκευση τροποποίησης
      await ipcRenderer.invoke('save-prosklisi-modification', modificationData);
      
      // Ενημέρωση της αρχικής πρόσκλησης με τα νέα δεδομένα
      if (modificationData.changes && Object.keys(modificationData.changes).length > 0) {
        // Δημιουργία καθαρού object μόνο με τα πεδία της πρόσκλησης
        const updatedProsklisiData = {
          prosklisiId: modificationData.originalProsklisiId,
          title: modificationData.modifiedData.title,
          axis: modificationData.modifiedData.axis,
          fundingSource: modificationData.modifiedData.fundingSource,
          code: modificationData.modifiedData.code,
          deadline: modificationData.modifiedData.deadline,
          budgetRange: modificationData.modifiedData.budgetRange,
          status: modificationData.modifiedData.status,
          updatedAt: new Date().toISOString()
        };
        
        await ipcRenderer.invoke('save-prosklisi', updatedProsklisiData);
      }
      
      // Ξεκλείδωμα της πρόσκλησης μετά την αποθήκευση τροποποίησης  
      if (modificationData.originalProsklisiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', modificationData.originalProsklisiId);
        // Άμεση ενημέρωση του UI
        setProsklisiLocks(prev => ({
          ...prev,
          [modificationData.originalProsklisiId]: false
        }));
      }
      
      await loadProskliseis(); // Reload to get updated data and modifications
    } catch (error) {
      console.error('Error saving modification:', error);
      alert('Σφάλμα αποθήκευσης τροποποίησης: ' + error.message);
    }
  };

  const handleEditProsklisi = async (prosklisi) => {
    // Έλεγχος αν η πρόσκληση είναι κλειδωμένη
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisi.prosklisiId);
    if (lockStatus.locked) {
      alert('Η πρόσκληση είναι υπό επεξεργασία από άλλον διαχειριστή!');
      return;
    }

    // Δημιουργία lock για την πρόσκληση
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'proskliseis', prosklisi.prosklisiId);
    if (!lockResult.success) {
      alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
      return;
    }

    // Άμεση ενημέρωση του UI για να δείξει το lock
    setProsklisiLocks(prev => ({
      ...prev,
      [prosklisi.prosklisiId]: true
    }));

    setEditingProsklisi(prosklisi);
    setIsFormOpen(true);
  };

  const handleDeleteProsklisi = async (prosklisiId) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την πρόσκληση και όλα τα αρχεία της;')) {
      try {
        const result = await ipcRenderer.invoke('delete-prosklisi', prosklisiId);
        if (result.success) {
          await loadProskliseis(); // Reload data
        } else {
          alert('Σφάλμα διαγραφής πρόσκλησης: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting prosklisi:', error);
        alert('Σφάλμα διαγραφής πρόσκλησης: ' + error.message);
      }
    }
  };



  const handleViewFiles = (prosklisiId) => {
    // Find the prosklisi to get its title
    const prosklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    if (!prosklisi) {
      alert('Δεν βρέθηκε η πρόσκληση');
      return;
    }

    // Set state to open the file manager
    setFileManagerOpen({
      isOpen: true,
      prosklisiId: prosklisiId,
      prosklisiTitle: prosklisi.title
    });
  };

  // Συνάρτηση για ομαδοποίηση αρχείων στο ProsklisisFileManager
  const handleGroupProsklisiFiles = async (filesToGroup) => {
    if (!filesToGroup || filesToGroup.length === 0) {
      alert('Δεν υπάρχουν αρχεία για ομαδοποίηση');
      return;
    }

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
          if (modal.parentNode === document.body) {
            document.body.removeChild(modal);
          }
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

    // Modal για επιλογή αρχείων με checkboxes
    const showFileSelectionModal = (groupTitle, files) => {
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
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        const fileCheckboxes = files.map((file, index) => `
          <label style="display: flex; align-items: center; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">
            <input type="checkbox" value="${file.originalName || file.fileName}" style="margin-right: 0.5rem;">
            <span>${file.originalName || file.fileName}</span>
          </label>
        `).join('');

        modalContent.innerHTML = `
          <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
            📁 Επιλογή Αρχείων για: "${groupTitle}"
          </h3>
          <p style="margin: 0 0 1rem 0; color: #666; font-size: 1rem;">
            Επιλέξτε ποια αρχεία θέλετε να συμπεριλάβετε στην ομάδα:
          </p>
          <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem;">
            ${fileCheckboxes}
          </div>
          <div style="display: flex; gap: 1rem;">
            <button id="createBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Δημιουργία Ομάδας</button>
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

        const createBtn = modalContent.querySelector('#createBtn');
        const cancelBtn = modalContent.querySelector('#cancelBtn');

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

        // Create button
        createBtn.addEventListener('click', () => {
          const selectedFiles = [];
          const checkboxes = modalContent.querySelectorAll('input[type="checkbox"]:checked');
          checkboxes.forEach(checkbox => {
            selectedFiles.push(checkbox.value);
          });
          
          if (selectedFiles.length > 0) {
            cleanup(selectedFiles);
          } else {
            alert('Παρακαλώ επιλέξτε τουλάχιστον ένα αρχείο');
          }
        });

        // Cancel button
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

    try {
      // Βήμα 1: Ζητάμε τίτλο ομάδας
      const groupTitle = await showGroupTitleModal();
      if (!groupTitle) return;

      // Βήμα 2: Επιλογή αρχείων
      const selectedFiles = await showFileSelectionModal(groupTitle, filesToGroup);
      if (!selectedFiles) return;

      // Βήμα 3: Δημιουργία ομάδας (προς το παρόν alert)
      alert(`Ομάδα "${groupTitle}" θα δημιουργηθεί με ${selectedFiles.length} αρχείο(α)!`);
      console.log('Selected files for group:', selectedFiles);
    } catch (error) {
      console.error('Error grouping files:', error);
      alert('Σφάλμα ομαδοποίησης αρχείων: ' + error.message);
    }
  };

  const handleViewModificationPDF = async (prosklisiId, modificationId) => {
    try {
      const result = await ipcRenderer.invoke('view-modification-pdf', prosklisiId, modificationId);
      if (!result.success) {
        alert('Σφάλμα προβολής PDF: ' + result.error);
      }
    } catch (error) {
      console.error('Error viewing modification PDF:', error);
      alert('Σφάλμα προβολής PDF: ' + error.message);
    }
  };

  const handleEditModification = async (modification, prosklisiId) => {
    // Έλεγχος αν η πρόσκληση είναι κλειδωμένη
    const lockStatus = await ipcRenderer.invoke('check-entity-lock', 'proskliseis', prosklisiId);
    if (lockStatus.locked) {
      alert('Η πρόσκληση είναι υπό επεξεργασία από άλλον διαχειριστή!');
      return;
    }

    // Δημιουργία lock για την πρόσκληση
    const lockResult = await ipcRenderer.invoke('create-entity-lock', 'proskliseis', prosklisiId);
    if (!lockResult.success) {
      alert('Δεν είναι δυνατή η επεξεργασία αυτή τη στιγμή. Δοκιμάστε ξανά.');
      return;
    }

    // Άμεση ενημέρωση του UI για να δείξει το lock
    setProsklisiLocks(prev => ({
      ...prev,
      [prosklisiId]: true
    }));

    // Βρίσκουμε την αρχική πρόσκληση για να πάρουμε τα αρχικά δεδομένα
    const originalProsklisi = proskliseis.find(p => p.prosklisiId === prosklisiId);
    
    setEditingModification({
      ...modification,
      prosklisiId: prosklisiId,
      originalProsklisiData: originalProsklisi // Τα αρχικά δεδομένα της πρόσκλησης
    });
    setIsModificationFormOpen(true);
  };

  const handleDeleteModification = async (prosklisiId, modificationId) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την τροποποίηση;')) {
      try {
        await ipcRenderer.invoke('delete-prosklisi-modification', prosklisiId, modificationId);
        await loadProskliseis(); // Reload to update modifications
        alert('Η τροποποίηση διαγράφηκε επιτυχώς');
      } catch (error) {
        console.error('Error deleting modification:', error);
        alert('Σφάλμα διαγραφής τροποποίησης: ' + error.message);
      }
    }
  };

  const handleSaveModificationEdit = async (modificationData) => {
    try {
      await ipcRenderer.invoke('update-prosklisi-modification', modificationData);
      
      // Ξεκλείδωμα της πρόσκλησης μετά την ενημέρωση τροποποίησης
      if (editingModification && editingModification.prosklisiId) {
        await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingModification.prosklisiId);
        // Άμεση ενημέρωση του UI
        setProsklisiLocks(prev => ({
          ...prev,
          [editingModification.prosklisiId]: false
        }));
      }
      
      await loadProskliseis(); // Reload to update modifications
      setEditingModification(null);
      setIsModificationFormOpen(false);
    } catch (error) {
      console.error('Error updating modification:', error);
      alert('Σφάλμα ενημέρωσης τροποποίησης: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Αν το dateString είναι ήδη σε μορφή DD-MM-YYYY, το επιστρέφουμε ως έχει
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
          return dateString;
        }
        return dateString; // Fallback: επιστρέφουμε το αρχικό string
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return dateString || '-';
    }
  };

  const getFieldLabel = (field) => {
    const fieldLabels = {
      'fundingSource': 'Πηγή Χρηματοδότησης',
      'deadline': 'Ημερομηνία Λήξης Υποβολής',
      'title': 'Τίτλος',
      'axis': 'Άξονας',
      'code': 'Κωδικός',
      'budgetRange': 'Εύρος Προϋπολογισμού',
      'status': 'Κατάσταση'
    };
    return fieldLabels[field] || field;
  };

  // Helper functions for filters
  const getUniqueStatuses = () => {
    const statuses = [...new Set(proskliseis.map(p => p.status).filter(Boolean))];
    return statuses.sort();
  };

  const getUniqueAxes = () => {
    const axes = [...new Set(proskliseis.map(p => p.axis).filter(Boolean))];
    return axes.sort();
  };

  const getUniqueFundingSources = () => {
    const sources = [...new Set(proskliseis.map(p => p.fundingSource).filter(Boolean))];
    return sources.sort();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setQuickSearchStatus('');
    setAdvancedFilters({
      axis: '',
      fundingSource: '',
      status: '',
      minBudget: '',
      maxBudget: '',
      dateFrom: '',
      dateTo: ''
    });
    setShowAdvancedFilters(false);
  };

  // Συνάρτηση για κλείσιμο του modal με καθαρισμό φίλτρων
  const handleClose = () => {
    handleClearFilters(); // Καθαρισμός όλων των φίλτρων
    onClose(); // Κλείσιμο του modal
  };

  // Ομαδοποίηση προσκλήσεων βάσει κατάστασης με τη σωστή σειρά
  const groupProskliseisByStatus = () => {
    const groups = {
      'Υπό Υποβολή': [],
      'Υπό Ωρίμανση': [],
      'Ολοκληρωμένες Προσκλήσεις': [],
      'Άλλες': []
    };

    filteredProskliseis.forEach(prosklisi => {
      if (prosklisi.status === 'Υπό Υποβολή') {
        groups['Υπό Υποβολή'].push(prosklisi);
      } else if (prosklisi.status === 'Υπό Ωρίμανση') {
        groups['Υπό Ωρίμανση'].push(prosklisi);
      } else if (prosklisi.status === 'Υποβληθέν ΤΔΠ') {
        groups['Ολοκληρωμένες Προσκλήσεις'].push(prosklisi);
      } else {
        groups['Άλλες'].push(prosklisi);
      }
    });

    // Φιλτράρισμα κενών ομάδων και διατήρηση σειράς
    return Object.entries(groups).filter(([_, proskliseis]) => proskliseis.length > 0);
  };

  // Συνάρτηση για χρώματα ομάδων
  const getGroupColors = (groupName) => {
    switch(groupName) {
      case 'Ολοκληρωμένες Προσκλήσεις':
        return {
          groupColor: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)',
          borderColor: '#7986cb',
          shadowColor: 'rgba(121, 134, 203, 0.25)',
          titleColor: '#283593',
          icon: '✅'
        };
      case 'Υπό Υποβολή':
        return {
          groupColor: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
          borderColor: '#2196f3',
          shadowColor: 'rgba(33, 150, 243, 0.25)',
          titleColor: '#0d47a1',
          icon: '📤'
        };
      case 'Υπό Ωρίμανση':
        return {
          groupColor: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
          borderColor: '#bdbdbd',
          shadowColor: 'rgba(189, 189, 189, 0.2)',
          titleColor: '#424242',
          icon: '⏳'
        };
      case 'Υποβληθέν':
        return {
          groupColor: 'linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)',
          borderColor: '#4caf50',
          shadowColor: 'rgba(76, 175, 80, 0.25)',
          titleColor: '#1b5e20',
          icon: '📨'
        };
      case 'Υποβληθέν ΤΔΠ':
        return {
          groupColor: 'linear-gradient(135deg, #a5d6a7 0%, #81c784 100%)',
          borderColor: '#66bb6a',
          shadowColor: 'rgba(102, 187, 106, 0.3)',
          titleColor: '#2e7d32',
          icon: '📬'
        };
      default:
        return {
          groupColor: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
          borderColor: '#9e9e9e',
          shadowColor: 'rgba(158, 158, 158, 0.2)',
          titleColor: '#424242',
          icon: '📋'
        };
    }
  };

  const handleAdvancedFilterChange = (field, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculate statistics
  const getStatistics = () => {
    const total = proskliseis.length;
    const filtered = filteredProskliseis.length;
    const withModifications = proskliseis.filter(p => 
      prosklisiModifications[p.prosklisiId] && prosklisiModifications[p.prosklisiId].length > 0
    ).length;
    return { total, filtered, withModifications };
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>📢 Διαχείριση Προσκλήσεων</ModalTitle>
          <CloseButton onClick={handleClose}>✖</CloseButton>
        </ModalHeader>

        <ModalContent>
          <HeaderActions>
            {userRole === 'ADMIN' && (
              <NewProsklisisButton onClick={() => {
                setEditingProsklisi(null); // Καθαρισμός για νέα πρόσκληση
                setIsFormOpen(true);
              }}>
                ✨ Εισαγωγή Νέας Πρόσκλησης
              </NewProsklisisButton>
            )}
            <ExportButton onClick={() => setIsExportDialogOpen(true)}>
              📊 Εξαγωγή σε Excel
            </ExportButton>
          </HeaderActions>

          <SearchAndFiltersContainer>
            <SearchTitle>
              🔍 Αναζήτηση & Φίλτρα Προσκλήσεων
            </SearchTitle>

            <StatsContainer>
              {(() => {
                const stats = getStatistics();
                return (
                  <>
                    <StatCard color="#667eea">
                      <StatIcon>📋</StatIcon>
                      <div>
                        <StatNumber>{stats.total}</StatNumber>
                        <StatText>Σύνολο</StatText>
                      </div>
                    </StatCard>
                    <StatCard color="#28a745">
                      <StatIcon>👁️</StatIcon>
                      <div>
                        <StatNumber>{stats.filtered}</StatNumber>
                        <StatText>Εμφανιζόμενα</StatText>
                      </div>
                    </StatCard>
                    <StatCard color="#ffc107">
                      <StatIcon>⚡</StatIcon>
                      <div>
                        <StatNumber>{stats.withModifications}</StatNumber>
                        <StatText>Με Τροποποιήσεις</StatText>
                      </div>
                    </StatCard>
                  </>
                );
              })()}
            </StatsContainer>

            <QuickSearchContainer>
              <SearchInput
                type="text"
                placeholder="🔍 Αναζήτηση προσκλήσεων (τίτλος, άξονας, πηγή χρηματοδότησης, κωδικός)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FilterSelect
                value={quickSearchStatus}
                onChange={(e) => setQuickSearchStatus(e.target.value)}
              >
                <option value="">Όλες οι Καταστάσεις</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </FilterSelect>
              <AdvancedFiltersToggle 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? '🔼 Κρύψε Φίλτρα' : '🔽 Προηγμένα Φίλτρα'}
              </AdvancedFiltersToggle>
            </QuickSearchContainer>

            <AdvancedFiltersContainer show={showAdvancedFilters}>
              <div>
                <FilterLabel>Άξονας/Δράση</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Άξονας..."
                  value={advancedFilters.axis}
                  onChange={(e) => handleAdvancedFilterChange('axis', e.target.value)}
                />
              </div>
              <div>
                <FilterLabel>Πηγή Χρηματοδότησης</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="Πηγή..."
                  value={advancedFilters.fundingSource}
                  onChange={(e) => handleAdvancedFilterChange('fundingSource', e.target.value)}
                />
              </div>
              <div>
                <FilterLabel>Κατάσταση</FilterLabel>
                <FilterSelect
                  value={advancedFilters.status}
                  onChange={(e) => handleAdvancedFilterChange('status', e.target.value)}
                >
                  <option value="">Όλες</option>
                  {getUniqueStatuses().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </FilterSelect>
              </div>
              <div>
                <FilterLabel>Ελάχιστο Προϋπολογισμό (€)</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="π.χ. 100000"
                  value={advancedFilters.minBudget}
                  onChange={(e) => handleAdvancedFilterChange('minBudget', e.target.value)}
                />
              </div>
              <div>
                <FilterLabel>Μέγιστο Προϋπολογισμό (€)</FilterLabel>
                <FilterInput
                  type="text"
                  placeholder="π.χ. 500000"
                  value={advancedFilters.maxBudget}
                  onChange={(e) => handleAdvancedFilterChange('maxBudget', e.target.value)}
                />
              </div>
              <div>
                <FilterLabel>Από Ημερομηνία Λήξης</FilterLabel>
                <FilterInput
                  type="date"
                  value={advancedFilters.dateFrom}
                  onChange={(e) => handleAdvancedFilterChange('dateFrom', e.target.value)}
                />
              </div>
              <div>
                <FilterLabel>Έως Ημερομηνία Λήξης</FilterLabel>
                <FilterInput
                  type="date"
                  value={advancedFilters.dateTo}
                  onChange={(e) => handleAdvancedFilterChange('dateTo', e.target.value)}
                />
              </div>
              <ClearFiltersButton onClick={handleClearFilters}>
                🗑️ Καθαρισμός Όλων των Φίλτρων
              </ClearFiltersButton>
            </AdvancedFiltersContainer>
          </SearchAndFiltersContainer>

          {loading ? (
            <LoadingMessage>
              Φόρτωση προσκλήσεων...
            </LoadingMessage>
          ) : filteredProskliseis.length === 0 ? (
            <NoDataMessage>
              {searchTerm ? 'Δεν βρέθηκαν προσκλήσεις που να ταιριάζουν στην αναζήτηση.' : 'Δεν υπάρχουν προσκλήσεις.'}
              {userRole === 'ADMIN' && !searchTerm && (
                <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  Πατήστε "Εισαγωγή Νέας Πρόσκλησης" για να προσθέσετε την πρώτη πρόσκληση.
                </div>
              )}
            </NoDataMessage>
          ) : (
            <ProsklisisList>
              {groupProskliseisByStatus().map(([groupName, groupProskliseis]) => {
                const colors = getGroupColors(groupName);
                return (
                  <ProskliseiGroup
                    key={groupName}
                    groupColor={colors.groupColor}
                    borderColor={colors.borderColor}
                    shadowColor={colors.shadowColor}
                  >
                    <GroupTitle
                      titleColor={colors.titleColor}
                      icon={colors.icon}
                    >
                      {groupName} ({groupProskliseis.length})
                    </GroupTitle>
                    <GroupProskliseis>
                      {groupProskliseis.map(prosklisi => (
                        <ProsklisisCard 
                          key={prosklisi.prosklisiId} 
                          status={prosklisi.status}
                          isLocked={prosklisiLocks[prosklisi.prosklisiId]}
                        >
                  <LockIndicator isLocked={prosklisiLocks[prosklisi.prosklisiId]}>
                    {prosklisiLocks[prosklisi.prosklisiId] ? '🔒' : '🔓'}
                  </LockIndicator>
                  <ProsklisisTitle>{prosklisi.title}</ProsklisisTitle>
                  
                  <ProsklisisDetails>
                    <DetailItem>
                      <DetailLabel>🎯 Άξονας/Δράση</DetailLabel>
                      <DetailValue>{prosklisi.axis || '-'}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>🔢 Κωδικός & Α/Α ΟΠΣ</DetailLabel>
                      <DetailValue>{prosklisi.code || '-'}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>📅 Λήξη Υποβολής</DetailLabel>
                      <DetailValue>{formatDate(prosklisi.deadline)}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>💵 Εύρος Προϋπολογισμού</DetailLabel>
                      <DetailValue>{prosklisi.budgetRange || '-'}</DetailValue>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>📊 Κατάσταση</DetailLabel>
                      <DetailValue>
                        <StatusBadge status={prosklisi.status}>{prosklisi.status}</StatusBadge>
                      </DetailValue>
                    </DetailItem>
                    <FundingSourceItem>
                      <FundingSourceLabel>💰 Πηγή Χρηματοδότησης</FundingSourceLabel>
                      <FundingSourceText>{prosklisi.fundingSource || '-'}</FundingSourceText>
                    </FundingSourceItem>
                  </ProsklisisDetails>

                  {/* Modifications */}
                  {prosklisiModifications[prosklisi.prosklisiId] && prosklisiModifications[prosklisi.prosklisiId].length > 0 && (
                    <ModificationsSection>
                      <ModificationsContainer>
                        {prosklisiModifications[prosklisi.prosklisiId].map((modification, index) => (
                          <ModificationCard key={modification.modificationId || index}>
                            <ModificationNumberBadge>{index + 1}</ModificationNumberBadge>
                            
                            <ModificationHeader>
                              <ModificationTitle>
                                Τροποποίηση #{index + 1}
                              </ModificationTitle>
                              <ModificationDate>
                                {modification.modificationDocumentDate
                                  ? formatDate(modification.modificationDocumentDate)
                                  : formatDate(modification.createdAt)}
                              </ModificationDate>
                            </ModificationHeader>
                            
                            {modification.modificationDescription && (
                              <ModificationDescription>
                                {modification.modificationDescription}
                              </ModificationDescription>
                            )}
                            
                            {modification.changes && Object.keys(modification.changes).length > 0 && (
                              <ChangesSection>
                                <ChangesTitle>Αλλαγές που έγιναν</ChangesTitle>
                                <ChangesList>
                                  {Object.entries(modification.changes).map(([field, change]) => (
                                    <ChangeItem key={field}>
                                      <strong>{getFieldLabel(field)}</strong>
                                      <div style={{ marginTop: '0.4rem', paddingLeft: '0.5rem' }}>
                                        <span style={{ color: '#d32f2f', textDecoration: 'line-through', marginRight: '0.5rem' }}>
                                          {change.original || '(κενό)'}
                                        </span>
                                        <span style={{ fontSize: '1.2rem', margin: '0 0.5rem', color: '#ff9800' }}>→</span>
                                        <span style={{ color: '#2e7d32', fontWeight: '600' }}>
                                          {change.current || '(κενό)'}
                                        </span>
                                      </div>
                                    </ChangeItem>
                                  ))}
                                </ChangesList>
                              </ChangesSection>
                            )}
                            
                            {modification.modificationPDF && (
                              <div style={{ marginTop: '1rem' }}>
                                <button
                                  onClick={() => handleViewModificationPDF(prosklisi.prosklisiId, modification.modificationId)}
                                  style={{
                                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1.2rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 8px rgba(255, 152, 0, 0.3)';
                                  }}
                                >
                                  📄 Προβολή PDF Τροποποίησης
                                </button>
                              </div>
                            )}
                            
                            {userRole === 'ADMIN' && (
                              <ModificationActions>
                                <ModificationButton
                                  variant="edit"
                                  onClick={() => handleEditModification(modification, prosklisi.prosklisiId)}
                                >
                                  ✏️ Επεξεργασία
                                </ModificationButton>
                                <ModificationButton
                                  variant="delete"
                                  onClick={() => handleDeleteModification(prosklisi.prosklisiId, modification.modificationId)}
                                >
                                  🗑️ Διαγραφή
                                </ModificationButton>
                              </ModificationActions>
                            )}
                          </ModificationCard>
                        ))}
                      </ModificationsContainer>
                    </ModificationsSection>
                  )}

                  <ActionButtons>
                    <ActionButton primary onClick={() => handleViewFiles(prosklisi.prosklisiId)}>
                      📁 Αρχεία Πρόσκλησης
                    </ActionButton>
                    {userRole === 'ADMIN' && (
                      <>
                        <ActionButton edit onClick={() => handleEditProsklisi(prosklisi)}>
                          ✏️ Επεξεργασία
                        </ActionButton>
                        <ActionButton delete onClick={() => handleDeleteProsklisi(prosklisi.prosklisiId)}>
                          🗑️ Διαγραφή
                        </ActionButton>
                      </>
                    )}
                  </ActionButtons>
                        </ProsklisisCard>
                      ))}
                    </GroupProskliseis>
                  </ProskliseiGroup>
                );
              })}
            </ProsklisisList>
          )}
        </ModalContent>
      </ModalContainer>

      {/* Prosklisi Form Modal */}
      {isFormOpen && (
        <ProsklisisForm
          isOpen={isFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης πρόσκλησης
            if (editingProsklisi && editingProsklisi.prosklisiId) {
              await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingProsklisi.prosklisiId);
              // Άμεση ενημέρωση του UI
              setProsklisiLocks(prev => ({
                ...prev,
                [editingProsklisi.prosklisiId]: false
              }));
            }
            setIsFormOpen(false);
            setEditingProsklisi(null);
            // Ανανέωση για να ενημερωθεί το lock status
            await loadProskliseis();
          }}
          onSave={handleSaveProsklisi}
          onSaveModification={handleSaveModification}
          editingProsklisi={editingProsklisi}
        />
      )}

      {/* File Manager Modal */}
      <ProsklisisFileManager
        isOpen={fileManagerOpen.isOpen}
        onClose={() => setFileManagerOpen({ isOpen: false, prosklisiId: null, prosklisiTitle: '' })}
        prosklisiId={fileManagerOpen.prosklisiId}
        prosklisiTitle={fileManagerOpen.prosklisiTitle}
        userRole={userRole}
        onGroupFiles={handleGroupProsklisiFiles}
      />

      {/* Modification Edit Modal */}
      {isModificationFormOpen && editingModification && (
        <ProsklisiModificationForm
          isOpen={isModificationFormOpen}
          onClose={async () => {
            // Ξεκλείδωμα της συγκεκριμένης πρόσκλησης
            if (editingModification && editingModification.prosklisiId) {
              await ipcRenderer.invoke('remove-entity-lock', 'proskliseis', editingModification.prosklisiId);
              // Άμεση ενημέρωση του UI
              setProsklisiLocks(prev => ({
                ...prev,
                [editingModification.prosklisiId]: false
              }));
            }
            setIsModificationFormOpen(false);
            setEditingModification(null);
            // Ανανέωση των proskliseis για να ενημερωθεί το lock status
            await loadProskliseis();
          }}
          onSave={handleSaveModificationEdit}
          originalProsklisi={editingModification}
          isEditMode={true}
        />
      )}

      {/* Export Dialog */}
      <ProsklisisExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        proskliseis={filteredProskliseis}
        totalProskliseis={proskliseis.length}
      />
    </ModalOverlay>
  );
}

export default ProsklisisManager;
