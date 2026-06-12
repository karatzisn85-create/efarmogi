import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { useToast } from './ToastProvider';

// ΔΕΝ υπάρχουν static imports από @react-pdf/renderer εδώ.
// Όλα γίνονται dynamic import() όταν ο χρήστης ανοίγει το modal.

const ipcRenderer = window.electronAPI;

// ── Styled Components ─────────────────────────────────────────────────────────

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const slideUp = keyframes`from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; }`;
const spin = keyframes`to { transform: rotate(360deg); }`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.18s ease;
`;

const Modal = styled.div`
  background: #0f172a;
  width: calc(100vw - 48px);
  max-width: 1200px;
  height: calc(100vh - 48px);
  max-height: 900px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${slideUp} 0.22s ease;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.65);
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid #334155;
  padding: 1rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  color: #f8fafc;
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  flex: 1;
`;

const HeaderBadge = styled.span`
  background: #6366f1;
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  &:hover { background: rgba(255, 255, 255, 0.16); color: #f1f5f9; }
`;

const TabBar = styled.div`
  display: flex;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  padding: 0 1rem;
  gap: 2px;
  flex-shrink: 0;
`;

const Tab = styled.button`
  background: ${p => p.$active ? '#6366f1' : 'transparent'};
  color: ${p => p.$active ? '#fff' : '#94a3b8'};
  border: none;
  padding: 0.65rem 1.1rem;
  font-size: 0.82rem;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  position: relative;
  top: 1px;
  &:hover:not(:disabled) {
    background: ${p => p.$active ? '#6366f1' : 'rgba(99, 102, 241, 0.12)'};
    color: ${p => p.$active ? '#fff' : '#c7d2fe'};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PreviewArea = styled.div`
  flex: 1;
  background: #334155;
  position: relative;
  min-height: 0;
`;

const PreviewIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  display: block;
`;

const CenterBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const Spinner = styled.div`
  width: 44px;
  height: 44px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const FooterBar = styled.div`
  background: #1e293b;
  border-top: 1px solid #334155;
  padding: 0.7rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
`;

const InfoText = styled.span`
  font-size: 0.75rem;
  color: #64748b;
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: white;
  border: none;
  padding: 0.55rem 1.4rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity 0.15s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

// ── Config ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'subprojects',  icon: '🗂️',  label: 'Υποέργα' },
  { id: 'entaxeis',     icon: '📋',  label: 'Εντάξεις' },
  { id: 'proskliseis',  icon: '📢',  label: 'Προσκλήσεις' },
  { id: 'egkriseis',    icon: '✅',  label: 'Εγκρίσεις' },
];

const TAB_NAMES = {
  subprojects: 'Αναφορά Υποέργων',
  entaxeis: 'Αναφορά Εντάξεων',
  proskliseis: 'Αναφορά Προσκλήσεων',
  egkriseis: 'Αναφορά Εγκρίσεων Διάθεσης Πίστωσης',
};

// ── Helper: load egkriseis flat ───────────────────────────────────────────────

async function loadFlatEgkriseis(projects) {
  const flat = [];
  const projectMap = {};
  for (const p of projects) {
    if (p.projectId && p.projectTitle) projectMap[p.projectId] = p.projectTitle;
  }
  for (const [projectId, projectTitle] of Object.entries(projectMap)) {
    try {
      const result = await ipcRenderer.invoke('load-project-egkriseis', projectId);
      if (result.success && result.egkriseis) {
        for (const sub of result.egkriseis) {
          for (const eg of (sub.egkriseis || [])) {
            flat.push({
              id: eg.id,
              projectTitle,
              subprojectTitle: sub.subprojectTitle,
              kaCode: sub.kaCode,
              date: eg.date,
              fileName: eg.fileName,
              type: eg.type,
              notes: eg.notes,
            });
          }
        }
      }
    } catch (_) { /* skip */ }
  }
  flat.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
  return flat;
}

// ── PDF generation (fully dynamic, no static imports) ────────────────────────

async function buildReportElement(tab, { projects, entaxeis, proskliseis, egkriseisFlat, appConfig }) {
  const { createElement } = await import('react');

  if (tab === 'subprojects') {
    const { default: SubprojectsReport } = await import('./pdf/SubprojectsReport');
    return createElement(SubprojectsReport, { projects, appConfig });
  }
  if (tab === 'entaxeis') {
    const { default: EntaxeisReport } = await import('./pdf/EntaxeisReport');
    return createElement(EntaxeisReport, { entaxeis, appConfig });
  }
  if (tab === 'proskliseis') {
    const { default: ProskliseisReport } = await import('./pdf/ProskliseisReport');
    return createElement(ProskliseisReport, { proskliseis, appConfig });
  }
  // egkriseis
  const { default: EgkriseisReport } = await import('./pdf/EgkriseisReport');
  return createElement(EgkriseisReport, { egkriseis: egkriseisFlat || [], appConfig });
}

async function generateBlobUrl(tab, data) {
  const reportEl = await buildReportElement(tab, data);
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(reportEl).toBlob();
  return URL.createObjectURL(blob);
}

// ── ReportsModal ──────────────────────────────────────────────────────────────

export default function ReportsModal({ projects = [], entaxeis = [], proskliseis = [], appConfig = {}, onClose, initialTab = 'subprojects' }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [blobUrl, setBlobUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [egkriseisFlat, setEgkriseisFlat] = useState(null);
  const [egkriseisLoading, setEgkriseisLoading] = useState(false);
  const blobUrlRef = useRef(null);

  // Revoke old blob URLs to prevent memory leaks
  const revokeOld = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Load egkriseis data when that tab is active
  useEffect(() => {
    if (activeTab === 'egkriseis' && egkriseisFlat === null && !egkriseisLoading) {
      setEgkriseisLoading(true);
      loadFlatEgkriseis(projects)
        .then(flat => setEgkriseisFlat(flat))
        .catch(() => setEgkriseisFlat([]))
        .finally(() => setEgkriseisLoading(false));
    }
  }, [activeTab, egkriseisFlat, egkriseisLoading, projects]);

  // Generate preview blob whenever tab or data changes
  useEffect(() => {
    // For egkriseis tab, wait until data is loaded
    if (activeTab === 'egkriseis' && egkriseisFlat === null) return;
    if (activeTab === 'egkriseis' && egkriseisLoading) return;

    let cancelled = false;
    setGenerating(true);
    setBlobUrl(null);
    revokeOld();

    const data = { projects, entaxeis, proskliseis, egkriseisFlat, appConfig };
    generateBlobUrl(activeTab, data)
      .then(url => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('PDF preview error:', err);
          showToast('Σφάλμα κατά τη δημιουργία προεπισκόπησης', 'error');
        }
      })
      .finally(() => { if (!cancelled) setGenerating(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, egkriseisFlat]);

  // Revoke on unmount
  useEffect(() => () => revokeOld(), [revokeOld]);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const data = { projects, entaxeis, proskliseis, egkriseisFlat, appConfig };
      const reportEl = await buildReportElement(activeTab, data);
      const { pdf } = await import('@react-pdf/renderer');
      const blob = await pdf(reportEl).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const defaultName = `ERGOHUB_${TAB_NAMES[activeTab].replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

      const result = await ipcRenderer.invoke('save-pdf-file', {
        buffer: Array.from(new Uint8Array(arrayBuffer)),
        defaultName,
      });

      if (result?.canceled) return;
      if (result?.success) {
        showToast('Το PDF αποθηκεύτηκε επιτυχώς!', 'success');
      } else {
        showToast('Σφάλμα κατά την αποθήκευση', 'error');
      }
    } catch (err) {
      console.error('PDF save error:', err);
      showToast('Σφάλμα κατά τη δημιουργία PDF', 'error');
    } finally {
      setSaving(false);
    }
  }, [activeTab, projects, entaxeis, proskliseis, egkriseisFlat, appConfig, showToast]);

  const isLoading = generating || (activeTab === 'egkriseis' && egkriseisLoading);

  const modal = (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal>
        <ModalHeader>
          <span style={{ fontSize: '1.3rem' }}>📊</span>
          <HeaderTitle>Αναφορές ERGOHUB</HeaderTitle>
          <HeaderBadge>PDF</HeaderBadge>
          <CloseButton onClick={onClose} title="Κλείσιμο (Esc)">✕</CloseButton>
        </ModalHeader>

        <TabBar>
          {TABS.map(t => (
            <Tab
              key={t.id}
              $active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              disabled={isLoading && activeTab !== t.id}
            >
              {t.icon} {t.label}
            </Tab>
          ))}
        </TabBar>

        <PreviewArea>
          {isLoading ? (
            <CenterBox>
              <Spinner />
              <span>
                {activeTab === 'egkriseis' && egkriseisLoading
                  ? 'Φόρτωση εγκρίσεων…'
                  : 'Δημιουργία προεπισκόπησης…'}
              </span>
            </CenterBox>
          ) : blobUrl ? (
            <PreviewIframe src={blobUrl} title={TAB_NAMES[activeTab]} />
          ) : (
            <CenterBox>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <span>Αδυναμία δημιουργίας προεπισκόπησης</span>
            </CenterBox>
          )}
        </PreviewArea>

        <FooterBar>
          <InfoText>{TAB_NAMES[activeTab]} — προεπισκόπηση PDF</InfoText>
          <SaveButton onClick={handleSave} disabled={saving || isLoading}>
            {saving ? '⏳ Αποθήκευση…' : '💾 Αποθήκευση PDF'}
          </SaveButton>
        </FooterBar>
      </Modal>
    </Overlay>
  );

  return createPortal(modal, document.body);
}
