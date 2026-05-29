import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const ipcRenderer = window.electronAPI;

// ── Greek → Latin slug generator ────────────────────────────────────────────
const GREEK_MAP = {
  'α':'a','ά':'a','β':'v','γ':'g','δ':'d','ε':'e','έ':'e',
  'ζ':'z','η':'i','ή':'i','θ':'th','ι':'i','ί':'i','ϊ':'i','ΐ':'i',
  'κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','ό':'o',
  'π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','ύ':'y','ϋ':'y','ΰ':'y',
  'φ':'f','χ':'ch','ψ':'ps','ω':'o','ώ':'o',
};

function greekToSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split('')
    .map(ch => GREEK_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')   // κάθε μη-latin → παύλα
    .replace(/^-+|-+$/g, '')        // αφαίρεση παύλων αρχής/τέλους
    .replace(/-{2,}/g, '-');        // διπλές παύλες → μία
}

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
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-radius: 20px;
  padding: 36px 40px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 3px; }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
`;

const Title = styled.h2`
  color: #f0f9ff;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionLabel = styled.div`
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
`;

const ToggleInfo = styled.div``;

const ToggleTitle = styled.div`
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
`;

const ToggleDesc = styled.div`
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
`;

const Toggle = styled.button`
  flex-shrink: 0;
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  background: ${({ $on }) => $on ? 'linear-gradient(135deg, #2563eb, #0ea5e9)' : 'rgba(100,116,139,0.4)'};

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${({ $on }) => $on ? '27px' : '3px'};
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    transition: left 0.25s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.3);
  color: #f1f5f9;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
  }

  &::placeholder { color: #475569; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const HintText = styled.div`
  color: #64748b;
  font-size: 11px;
  margin-top: 5px;
  line-height: 1.5;
`;

const InfoCard = styled.div`
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
`;

const InfoCardTitle = styled.div`
  color: #86efac;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
`;

const InfoCardLink = styled.a`
  display: block;
  color: #60a5fa;
  font-size: 11px;
  word-break: break-all;
  text-decoration: none;
  font-family: monospace;
  background: rgba(0,0,0,0.2);
  border-radius: 5px;
  padding: 6px 8px;
  margin-bottom: 6px;

  &:hover { text-decoration: underline; }
`;

const InfoCardMeta = styled.div`
  color: #64748b;
  font-size: 11px;
`;

const NoExportCard = styled.div`
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  color: #64748b;
  font-size: 13px;
  text-align: center;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 4px 0 24px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

const BaseButton = styled.button`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const SaveButton = styled(BaseButton)`
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: white;
  box-shadow: 0 3px 10px rgba(37,99,235,0.35);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 16px rgba(37,99,235,0.5);
  }
`;

const CancelButton = styled(BaseButton)`
  background: rgba(100,116,139,0.2);
  color: #94a3b8;
  border: 1px solid rgba(100,116,139,0.3);

  &:hover:not(:disabled) {
    background: rgba(100,116,139,0.35);
    color: #cbd5e1;
  }
`;

const StatusMsg = styled.div`
  color: ${({ $error }) => $error ? '#f87171' : '#86efac'};
  font-size: 13px;
  text-align: center;
  margin-bottom: 12px;
  min-height: 20px;
`;

// ── Ορισμός πεδίων εξαγωγής ─────────────────────────────────────────────────
const EXPORT_FIELD_DEFS = [
  { key: 'xrimatodotisi',       label: 'Πηγή Χρηματοδότησης',    desc: 'π.χ. ΕΣΠΑ 2021-2027, Αντώνης Τρίτσης' },
  { key: 'proupologismos',      label: 'Προϋπολογισμός',          desc: 'Συνολικό κόστος έργου' },
  { key: 'approvedAmount',      label: 'Εγκεκριμένο Ποσό',        desc: 'Εγκεκριμένη χρηματοδότηση βάσει απόφασης' },
  { key: 'symvasiPoso',         label: 'Ποσό Σύμβασης',           desc: 'Αξία υπογεγραμμένης σύμβασης' },
  { key: 'anadochos',           label: 'Ανάδοχος',                desc: 'Εργολάβος/Προμηθευτής (από ΚΗΜΔΗΣ)' },
  { key: 'hmerominia_enarksis', label: 'Ημερομηνία Έναρξης',      desc: 'Ημερομηνία υπογραφής σύμβασης' },
  { key: 'adam',                label: 'ΑΔΑΜ Σύμβασης',           desc: 'Εμφανίζεται μόνο για εκτελούμενα/ολοκληρωμένα (ΚΗΜΔΗΣ)' },
  { key: 'mis',                 label: 'Κωδικός ΜΙΣ',             desc: 'MIS κωδικός πράξης (ΕΣΠΑ)' },
  { key: 'kategoria',           label: 'Κατηγορία Έργου',         desc: 'π.χ. ΕΡΓΟ, ΜΕΛΕΤΗ, ΠΡΟΜΗΘΕΙΑ' },
];

const DEFAULT_EXPORT_FIELDS = Object.fromEntries(EXPORT_FIELD_DEFS.map(f => [f.key, true]));

// ── Component ────────────────────────────────────────────────────────────────

function PortalSettingsModal({ isOpen, onClose, appConfig = {}, onConfigSaved }) {
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [dimosUid, setDimosUid] = useState('');
  const [exportFields, setExportFields] = useState(DEFAULT_EXPORT_FIELDS);
  const [mergeCompleted, setMergeCompleted] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStatusMsg('');
      setSaving(false);
      return;
    }

    setPortalEnabled(appConfig.portalEnabled === true);
    setMergeCompleted(appConfig.portalMergeCompleted === true);

    const savedUid = appConfig.portalDimosUid || '';
    if (savedUid) {
      setDimosUid(savedUid);
    } else {
      const orgName = appConfig.organizationName || appConfig.organizationFullName || '';
      setDimosUid(greekToSlug(orgName));
    }

    // Φόρτωση ρυθμίσεων πεδίων (merge με defaults για backward compat)
    setExportFields({ ...DEFAULT_EXPORT_FIELDS, ...(appConfig.portalExportFields || {}) });

    ipcRenderer.invoke('load-portal-published').then((res) => {
      if (res?.success && res.data?.lastExportedAt) {
        setLastExport(res.data);
      } else {
        setLastExport(null);
      }
    }).catch(() => setLastExport(null));
  }, [isOpen, appConfig.portalEnabled, appConfig.portalDimosUid, appConfig.portalExportFields, appConfig.portalMergeCompleted]);

  const handleSave = async () => {
    const uid = dimosUid.trim();
    if (portalEnabled && !uid) {
      setStatusError(true);
      setStatusMsg('Το αναγνωριστικό Δήμου (slug) είναι υποχρεωτικό για την ενεργοποίηση.');
      return;
    }

    setSaving(true);
    setStatusMsg('');

    try {
      await ipcRenderer.invoke('save-app-config', {
        portalEnabled,
        portalDimosUid: uid,
        portalExportFields: exportFields,
        portalMergeCompleted: mergeCompleted,
      });

      setStatusError(false);
      setStatusMsg('✓ Οι ρυθμίσεις αποθηκεύτηκαν.');

      if (onConfigSaved) {
        onConfigSaved({ portalEnabled, portalDimosUid: uid, portalExportFields: exportFields, portalMergeCompleted: mergeCompleted });
      }
    } catch (e) {
      setStatusError(true);
      setStatusMsg(`Σφάλμα αποθήκευσης: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <Title>Ρυθμίσεις Πύλης Διαφάνειας</Title>
        </Header>

        <Section>
          <SectionLabel>Κατάσταση Υπηρεσίας</SectionLabel>
          <ToggleRow>
            <ToggleInfo>
              <ToggleTitle>
                Πύλη Διαφάνειας{' '}
                <span style={{ color: portalEnabled ? '#86efac' : '#ef4444', fontSize: 12 }}>
                  ({portalEnabled ? 'ΕΝΕΡΓΗ' : 'ΑΝΕΝΕΡΓΗ'})
                </span>
              </ToggleTitle>
              <ToggleDesc>
                {portalEnabled
                  ? 'Η δυνατότητα εξαγωγής & δημοσίευσης στην Πύλη είναι ενεργή για ADMIN/SUPERADMIN.'
                  : 'Όταν απενεργοποιηθεί, κρύβεται το κουμπί εξαγωγής και τα badges από τις κάρτες.'}
              </ToggleDesc>
            </ToggleInfo>
            <Toggle $on={portalEnabled} onClick={() => setPortalEnabled(v => !v)} disabled={saving} />
          </ToggleRow>
        </Section>

        <Divider />

        <Section>
          <SectionLabel>Στοιχεία Δήμου</SectionLabel>
          <FormGroup>
            <Label>Αναγνωριστικό Δήμου (slug) *</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                type="text"
                value={dimosUid}
                onChange={(e) => setDimosUid(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="π.χ. archanes-asterousion"
                disabled={saving}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => {
                  const orgName = appConfig.organizationName || appConfig.organizationFullName || '';
                  const generated = greekToSlug(orgName);
                  if (generated) setDimosUid(generated);
                }}
                disabled={saving}
                title="Αυτόματος υπολογισμός από το όνομα του Δήμου"
                style={{
                  flexShrink: 0,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.07)',
                  color: '#94a3b8',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🔄 Αυτόματα
              </button>
            </div>
            <HintText>
              Δημιουργήθηκε αυτόματα από το όνομα Δήμου — μπορείτε να το τροποποιήσετε.{' '}
              Διαδρομή Dropbox:{' '}
              <code style={{ color: '#7dd3fc' }}>/portal/{dimosUid || '<slug>'}/erga.json</code>
            </HintText>
          </FormGroup>
        </Section>

        <Divider />

        <Section>
          <SectionLabel>Πεδία που εμφανίζονται στην Πύλη</SectionLabel>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
            Τα πεδία <strong style={{ color: '#94a3b8' }}>Τίτλος</strong> και <strong style={{ color: '#94a3b8' }}>Κατάσταση</strong> εξάγονται πάντα. Τα υπόλοιπα είναι προαιρετικά.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXPORT_FIELD_DEFS.map(({ key, label, desc }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: exportFields[key] ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${exportFields[key] ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  transition: 'all 0.2s',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
                onClick={() => !saving && setExportFields(prev => ({ ...prev, [key]: !prev[key] }))}
              >
                <div>
                  <div style={{ color: exportFields[key] ? '#e2e8f0' : '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ color: '#475569', fontSize: 11 }}>{desc}</div>
                </div>
                <Toggle
                  $on={exportFields[key]}
                  onClick={(e) => { e.stopPropagation(); if (!saving) setExportFields(prev => ({ ...prev, [key]: !prev[key] })); }}
                  disabled={saving}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        <Section>
          <SectionLabel>Επιλογές Εμφάνισης</SectionLabel>
          <ToggleRow>
            <ToggleInfo>
              <ToggleTitle>Συγχώνευση Ολοκληρωμένων</ToggleTitle>
              <ToggleDesc>
                {mergeCompleted
                  ? 'Τα «ΟΛΟΚΛΗΡΩΜΕΝΟ» και «ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ» εξάγονται ως «ΟΛΟΚΛΗΡΩΜΕΝΟ» — η πύλη τα εμφανίζει κάτω από μία κατηγορία.'
                  : 'Κάθε κατάσταση εξάγεται όπως είναι — η πύλη τα εμφανίζει ξεχωριστά.'}
              </ToggleDesc>
            </ToggleInfo>
            <Toggle $on={mergeCompleted} onClick={() => setMergeCompleted(v => !v)} disabled={saving} />
          </ToggleRow>
        </Section>

        <Divider />

        <Section>
          <SectionLabel>Τελευταία Εξαγωγή</SectionLabel>
          {lastExport ? (
            <InfoCard>
              <InfoCardTitle>✅ Το αρχείο erga.json είναι δημοσιευμένο</InfoCardTitle>
              {lastExport.lastDropboxLink && (
                <InfoCardLink href={lastExport.lastDropboxLink} target="_blank" rel="noopener noreferrer">
                  {lastExport.lastDropboxLink}
                </InfoCardLink>
              )}
              <InfoCardMeta>
                {lastExport.lastExportedAt && (
                  <>Τελευταία ενημέρωση: {new Date(lastExport.lastExportedAt).toLocaleString('el-GR')}</>
                )}
                {Array.isArray(lastExport.subprojectIds) && (
                  <> · {lastExport.subprojectIds.length} υποέργα</>
                )}
              </InfoCardMeta>
            </InfoCard>
          ) : (
            <NoExportCard>
              Δεν έχει γίνει εξαγωγή ακόμα.
            </NoExportCard>
          )}
        </Section>

        {statusMsg && (
          <StatusMsg $error={statusError}>{statusMsg}</StatusMsg>
        )}

        <ButtonGroup>
          <CancelButton onClick={onClose} disabled={saving}>Κλείσιμο</CancelButton>
          <SaveButton onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Αποθήκευση...' : '💾 Αποθήκευση'}
          </SaveButton>
        </ButtonGroup>
      </Modal>
    </Overlay>
  );
}

export default PortalSettingsModal;
