import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

// ── Styled components ───────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const Modal = styled.div`
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%);
  border-radius: 20px;
  padding: 36px 40px;
  width: 720px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  position: relative;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  flex-shrink: 0;
`;

const Title = styled.h2`
  color: #f0f9ff;
  margin: 0;
  font-size: 22px;
  font-weight: 700;
`;

const TitleIcon = styled.span`
  font-size: 26px;
`;

const InfoBox = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 14px 18px;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 20px;
  flex-shrink: 0;

  strong {
    color: #7dd3fc;
  }
`;

const SectionLabel = styled.div`
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
  flex-shrink: 0;
`;

const SelectionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-shrink: 0;
`;

const SelectionCount = styled.span`
  color: #7dd3fc;
  font-size: 13px;
  font-weight: 600;
`;

const ToggleLinks = styled.div`
  display: flex;
  gap: 12px;
`;

const ToggleLink = styled.button`
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: #93c5fd;
  }
`;

const SubprojectList = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 0;
  min-height: 120px;
  max-height: 340px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const SubprojectItem = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const Checkbox = styled.input`
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: #3b82f6;
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

const SubprojectInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SubprojectTitle = styled.div`
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SubprojectMeta = styled.div`
  color: #64748b;
  font-size: 11px;
  margin-top: 2px;
`;

const StatusBadge = styled.span`
  display: inline-block;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 8px;
  white-space: nowrap;
`;

const DimosUidBox = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
  flex-shrink: 0;
`;

const DimosUidLabel = styled.div`
  color: #fca5a5;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const DimosUidInput = styled.input`
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(0, 0, 0, 0.3);
  color: #f1f5f9;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  &::placeholder {
    color: #64748b;
  }
`;

const DimosUidHint = styled.div`
  color: #94a3b8;
  font-size: 11px;
  margin-top: 6px;
`;

const ProgressContainer = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 18px;
  margin-top: 16px;
  flex-shrink: 0;
`;

const ProgressText = styled.div`
  color: #cbd5e1;
  font-size: 14px;
  text-align: center;
  margin-bottom: 10px;
`;

const ProgressBar = styled.div`
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  overflow: hidden;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #3b82f6, #06b6d4, #3b82f6);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

const ResultBox = styled.div`
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 10px;
  padding: 16px 18px;
  margin-top: 16px;
  flex-shrink: 0;
`;

const ResultTitle = styled.div`
  color: #86efac;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
`;

const ResultLink = styled.a`
  display: block;
  color: #60a5fa;
  font-size: 12px;
  word-break: break-all;
  text-decoration: none;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  padding: 8px 10px;
  font-family: monospace;
  margin-bottom: 8px;

  &:hover {
    text-decoration: underline;
  }
`;

const CopyLinkButton = styled.button`
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(59, 130, 246, 0.35);
  }
`;

const ResultMeta = styled.div`
  color: #94a3b8;
  font-size: 12px;
  margin-top: 8px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-shrink: 0;
`;

const BaseButton = styled.button`
  flex: 1;
  padding: 13px 24px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none !important;
  }
`;

const ExportButton = styled(BaseButton)`
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.55);
  }
`;

const CancelButton = styled(BaseButton)`
  background: rgba(100, 116, 139, 0.25);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.35);

  &:hover:not(:disabled) {
    background: rgba(100, 116, 139, 0.4);
    color: #cbd5e1;
  }
`;

const EmptyState = styled.div`
  padding: 32px;
  text-align: center;
  color: #475569;
  font-size: 14px;
`;

// ── Component ────────────────────────────────────────────────────────────────

function PortalExport({ isOpen, onClose, projects = [], currentUser, appConfig = {}, onDimosUidSaved }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dimosUid, setDimosUid] = useState(appConfig.portalDimosUid || '');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null); // { dropboxLink, count, exportedAt }
  const [copied, setCopied] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState(null);

  // Sorted list: published first, then alphabetically by project+subproject title
  const sortedProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return [...projects].sort((a, b) => {
      const titleA = `${a.projectTitle || ''} ${a.subprojectTitle || ''}`.toLowerCase();
      const titleB = `${b.projectTitle || ''} ${b.subprojectTitle || ''}`.toLowerCase();
      return titleA.localeCompare(titleB, 'el');
    });
  }, [projects]);

  // Load saved selections on open
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setProgress('');
      setIsExporting(false);
      setCopied(false);
      return;
    }

    setDimosUid(appConfig.portalDimosUid || '');

    ipcRenderer.invoke('load-portal-published').then((res) => {
      if (res?.success && res.data) {
        const ids = Array.isArray(res.data.subprojectIds) ? res.data.subprojectIds : [];
        setSelectedIds(new Set(ids));
        setLastExportInfo({
          lastExportedAt: res.data.lastExportedAt || null,
          lastDropboxLink: res.data.lastDropboxLink || null
        });
      }
    }).catch(() => {});
  }, [isOpen, appConfig.portalDimosUid]);

  const handleToggle = useCallback((subprojectId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subprojectId)) {
        next.delete(subprojectId);
      } else {
        next.add(subprojectId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(sortedProjects.map(p => p.subprojectId)));
  }, [sortedProjects]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExport = async () => {
    const uid = dimosUid.trim();
    if (!uid) {
      // Focus the input
      document.getElementById('portal-dimos-uid-input')?.focus();
      return;
    }
    if (selectedIds.size === 0) return;

    try {
      setIsExporting(true);
      setResult(null);
      setProgress('Προετοιμασία δεδομένων...');

      const res = await ipcRenderer.invoke('export-portal-data', {
        selectedSubprojectIds: Array.from(selectedIds),
        actingUsername: currentUser?.username,
        dimosUid: uid
      });

      if (!res?.success) {
        throw new Error(res?.error || 'Άγνωστο σφάλμα κατά την εξαγωγή.');
      }

      setResult({
        dropboxLink: res.dropboxLink,
        count: res.count,
        exportedAt: new Date().toLocaleString('el-GR')
      });
      setProgress('');

      // Ενημέρωση parent αν το dimosUid ήταν νέο
      if (!appConfig.portalDimosUid && onDimosUidSaved) {
        onDimosUidSaved(uid);
      }
    } catch (err) {
      setProgress('');
      alert(`❌ Σφάλμα κατά την εξαγωγή:\n\n${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    if (!result?.dropboxLink) return;
    navigator.clipboard.writeText(result.dropboxLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  const needsDimosUid = !appConfig.portalDimosUid;
  const canExport = selectedIds.size > 0 && dimosUid.trim() !== '' && !isExporting;

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget && !isExporting) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <TitleIcon>🌐</TitleIcon>
          <Title>Εξαγωγή για Πύλη Διαφάνειας</Title>
        </Header>

        <InfoBox>
          <strong>Δήμος:</strong> {appConfig.organizationName || '—'} &nbsp;|&nbsp;
          <strong>Τελευταία εξαγωγή:</strong>{' '}
          {lastExportInfo?.lastExportedAt
            ? new Date(lastExportInfo.lastExportedAt).toLocaleString('el-GR')
            : 'Δεν έχει γίνει εξαγωγή'}
          <br />
          Επιλέξτε τα υποέργα που θέλετε να δημοσιευτούν στην Πύλη Διαφάνειας.
          Η εξαγωγή ανεβάζει αυτόματα το αρχείο{' '}
          <strong>erga.json</strong> στο Dropbox.
        </InfoBox>

        {needsDimosUid && (
          <DimosUidBox>
            <DimosUidLabel>⚠️ Απαιτείται ρύθμιση: Αναγνωριστικό Δήμου (slug)</DimosUidLabel>
            <DimosUidInput
              id="portal-dimos-uid-input"
              type="text"
              value={dimosUid}
              onChange={(e) => setDimosUid(e.target.value)}
              placeholder="π.χ. archanes-asterousion"
              disabled={isExporting}
            />
            <DimosUidHint>
              Λατινικοί χαρακτήρες και παύλες, π.χ. <em>archanes-asterousion</em>.
              Θα αποθηκευτεί στις ρυθμίσεις μετά την πρώτη εξαγωγή.
            </DimosUidHint>
          </DimosUidBox>
        )}

        {!needsDimosUid && (
          <InfoBox style={{ marginBottom: 12, padding: '10px 14px' }}>
            <strong>Dropbox path:</strong>{' '}
            <code style={{ color: '#7dd3fc', fontSize: 12 }}>
              /portal/{dimosUid}/erga.json
            </code>
          </InfoBox>
        )}

        <SelectionBar>
          <SectionLabel style={{ margin: 0 }}>
            Υποέργα ({selectedIds.size} / {sortedProjects.length} επιλεγμένα)
          </SectionLabel>
          <ToggleLinks>
            <ToggleLink onClick={handleSelectAll} disabled={isExporting}>
              Επιλογή όλων
            </ToggleLink>
            <ToggleLink onClick={handleDeselectAll} disabled={isExporting}>
              Αποεπιλογή όλων
            </ToggleLink>
          </ToggleLinks>
        </SelectionBar>

        <SubprojectList>
          {sortedProjects.length === 0 ? (
            <EmptyState>Δεν υπάρχουν υποέργα.</EmptyState>
          ) : (
            sortedProjects.map((p) => (
              <SubprojectItem key={p.subprojectId}>
                <Checkbox
                  type="checkbox"
                  checked={selectedIds.has(p.subprojectId)}
                  onChange={() => handleToggle(p.subprojectId)}
                  disabled={isExporting}
                />
                <SubprojectInfo>
                  <SubprojectTitle title={p.subprojectTitle}>
                    {p.subprojectTitle}
                    <StatusBadge>{p.projectStatus || 'Χωρίς κατάσταση'}</StatusBadge>
                  </SubprojectTitle>
                  <SubprojectMeta>
                    {p.projectTitle}{p.fundingSource ? ` · ${p.fundingSource}` : ''}
                    {p.projectType ? ` · ${p.projectType}` : ''}
                  </SubprojectMeta>
                </SubprojectInfo>
              </SubprojectItem>
            ))
          )}
        </SubprojectList>

        {isExporting && (
          <ProgressContainer>
            <ProgressText>{progress || 'Ανέβασμα στο Dropbox...'}</ProgressText>
            <ProgressBar />
          </ProgressContainer>
        )}

        {result && !isExporting && (
          <ResultBox>
            <ResultTitle>
              ✅ Επιτυχής εξαγωγή — {result.count} υποέργα δημοσιεύθηκαν
            </ResultTitle>
            <ResultLink href={result.dropboxLink} target="_blank" rel="noopener noreferrer">
              {result.dropboxLink}
            </ResultLink>
            <CopyLinkButton onClick={handleCopyLink}>
              {copied ? '✓ Αντιγράφηκε!' : '📋 Αντιγραφή link'}
            </CopyLinkButton>
            <ResultMeta>
              Βάλτε αυτό το link στο <strong>config.json</strong> της πύλης ({result.exportedAt})
            </ResultMeta>
          </ResultBox>
        )}

        <ButtonGroup>
          <CancelButton onClick={onClose} disabled={isExporting}>
            {result ? 'Κλείσιμο' : 'Ακύρωση'}
          </CancelButton>
          {!result && (
            <ExportButton onClick={handleExport} disabled={!canExport}>
              {isExporting ? '⏳ Ανέβασμα...' : `🌐 Εξαγωγή & Ανέβασμα (${selectedIds.size})`}
            </ExportButton>
          )}
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
}

export default PortalExport;
