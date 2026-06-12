import React, { useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.94) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const checkPop = keyframes`
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  padding: 1.25rem;
  animation: ${fadeIn} 0.2s ease;
`;

const Card = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 20px;
  max-width: 520px;
  width: 100%;
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.2),
    0 0 0 1px rgba(99, 102, 241, 0.08);
  animation: ${popIn} 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const Hero = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%);
  padding: 1.75rem 1.75rem 1.35rem;
  text-align: center;
  color: white;
`;

const CheckCircle = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 0.85rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  animation: ${checkPop} 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
`;

const HeroTitle = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const HeroSub = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  opacity: 0.9;
  font-weight: 500;
`;

const Body = styled.div`
  padding: 1.35rem 1.5rem 1.25rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin-bottom: 1.1rem;
`;

const StatCard = styled.div`
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.7rem 0.5rem;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.25rem;
  font-weight: 800;
  color: #4338ca;
  line-height: 1.2;
`;

const StatLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.35px;
  margin-top: 0.2rem;
`;

const FileBlock = styled.div`
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.85rem 1rem;
`;

const FileLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 0.35rem;
`;

const FilePath = styled.div`
  font-size: 0.8rem;
  color: #334155;
  line-height: 1.45;
  word-break: break-all;
  font-family: 'Consolas', 'Segoe UI', monospace;
`;

const FileName = styled.span`
  font-weight: 700;
  color: #1e293b;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0 1.5rem 1.35rem;
`;

const Btn = styled.button`
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  border: ${p => p.$primary ? 'none' : '1.5px solid #e2e8f0'};
  background: ${p => {
    if (p.$primary) return 'linear-gradient(135deg, #6366f1, #4f46e5)';
    if (p.$secondary) return '#ffffff';
    return '#f8fafc';
  }};
  color: ${p => (p.$primary ? '#ffffff' : '#475569')};
  box-shadow: ${p => (p.$primary ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none')};

  &:hover {
    opacity: 0.92;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

function splitFilePath(fullPath) {
  if (!fullPath) return { dir: '', name: '' };
  const norm = fullPath.replace(/\//g, '\\');
  const idx = norm.lastIndexOf('\\');
  if (idx < 0) return { dir: '', name: fullPath };
  return { dir: norm.slice(0, idx + 1), name: norm.slice(idx + 1) };
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   filePath?: string,
 *   actionCount?: number,
 *   sheetCount?: number,
 *   exportedAt?: string,
 *   title?: string,
 *   subtitle?: string,
 *   actionLabel?: string,
 *   sheetLabel?: string,
 * }} props
 */
export default function ExportSuccessModal({
  isOpen,
  onClose,
  filePath = '',
  actionCount,
  sheetCount,
  exportedAt = '',
  title = 'Η εξαγωγή ολοκληρώθηκε!',
  subtitle = 'Το αρχείο Excel αποθηκεύτηκε στον υπολογιστή σας.',
  actionLabel = 'Δράσεις',
  sheetLabel = 'Φύλλα',
}) {
  const handleKey = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose();
  }, [isOpen, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!isOpen) return null;

  const { dir, name } = splitFilePath(filePath);

  const openFile = async () => {
    if (!filePath) return;
    try {
      const res = await ipcRenderer.invoke('open-exported-file', { filePath });
      if (!res?.success) {
        console.warn(res?.error);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const revealInFolder = async () => {
    if (!filePath) return;
    try {
      await ipcRenderer.invoke('open-exported-file', { filePath, revealInFolder: true });
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Hero>
          <CheckCircle aria-hidden>✓</CheckCircle>
          <HeroTitle>{title}</HeroTitle>
          <HeroSub>{subtitle}</HeroSub>
        </Hero>

        <Body>
          <StatsGrid>
            <StatCard>
              <StatValue>{actionCount ?? '—'}</StatValue>
              <StatLabel>{actionLabel}</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{sheetCount ?? '—'}</StatValue>
              <StatLabel>{sheetLabel}</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue style={{ fontSize: '0.72rem', paddingTop: '0.35rem', lineHeight: 1.3 }}>
                {exportedAt || '—'}
              </StatValue>
              <StatLabel>Εξαγωγή</StatLabel>
            </StatCard>
          </StatsGrid>

          {filePath && (
            <FileBlock>
              <FileLabel>📁 Αρχείο</FileLabel>
              <FilePath>
                {dir && <span>{dir}</span>}
                <FileName>{name}</FileName>
              </FilePath>
            </FileBlock>
          )}
        </Body>

        <Actions>
          <Btn type="button" $secondary onClick={revealInFolder} disabled={!filePath}>
            📂 Φάκελος
          </Btn>
          <Btn type="button" onClick={openFile} disabled={!filePath}>
            📊 Άνοιγμα αρχείου
          </Btn>
          <Btn type="button" $primary onClick={onClose}>
            OK
          </Btn>
        </Actions>
      </Card>
    </Overlay>
  );
}
