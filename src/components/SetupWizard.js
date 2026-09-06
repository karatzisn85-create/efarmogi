import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';

const ipcRenderer = window.electronAPI;

// ─── Animations ──────────────────────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const floatIn = keyframes`
  from { opacity: 0; transform: scale(0.93); }
  to   { opacity: 1; transform: scale(1); }
`;
const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(44, 62, 80, 0.4); }
  50%       { box-shadow: 0 0 0 12px rgba(44, 62, 80, 0); }
`;

// ─── Overlay & Shell ─────────────────────────────────────────────────────────
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: linear-gradient(145deg, #0f172a 0%, #1e3a5f 45%, #1a2a3a 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 24px 16px;
  box-sizing: border-box;
  overflow: hidden;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 20px;
  padding: 40px 44px;
  max-width: 640px;
  width: 100%;
  max-height: calc(100vh - 48px);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.45);
  animation: ${floatIn} 0.4s ease-out;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
`;

// Κυλιόμενο σώμα — κρατάει την κάρτα εντός οθόνης χωρίς να κόβει περιεχόμενο
const CardScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  margin-right: -4px;
  -webkit-overflow-scrolling: touch;

  /* Διακριτική μπάρα κύλισης */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
`;

// ─── Welcome Screen ───────────────────────────────────────────────────────────
const WelcomeWrap = styled.div`
  text-align: center;
  animation: ${fadeUp} 0.5s ease-out;
`;

const WelcomeIcon = styled.div`
  font-size: 68px;
  margin-bottom: 4px;
  line-height: 1;
`;

const WelcomeBrand = styled.h1`
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #1a2a3a;
  margin: 0 0 6px;
`;

const WelcomeTagline = styled.p`
  font-size: 15px;
  color: #64748b;
  margin: 0 0 32px;
  font-style: italic;
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 36px;
  text-align: left;
`;

const FeatureRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
`;

const FeatureIcon = styled.span`
  font-size: 22px;
  flex-shrink: 0;
  margin-top: 1px;
`;

const FeatureText = styled.div``;

const FeatureTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
`;

const FeatureSub = styled.div`
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
`;

const StartButton = styled.button`
  width: 100%;
  padding: 16px 32px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  background: linear-gradient(135deg, #1a2a3a 0%, #2c3e50 100%);
  color: white;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  animation: ${pulse} 2.5s ease-in-out infinite;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(44, 62, 80, 0.45);
    animation: none;
  }
`;

// ─── Step Header ─────────────────────────────────────────────────────────────
const LogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
`;

const LogoBrand = styled.span`
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #1a2a3a;
`;

const StepBadge = styled.span`
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 28px;
`;

const StepDot = styled.div`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${p => p.$active ? '#1a2a3a' : p.$done ? '#4caf50' : '#e2e8f0'};
  transition: all 0.3s;
  ${p => p.$active && css`transform: scale(1.25);`}
`;

const StepTitle = styled.h2`
  color: #1a2a3a;
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 6px;
`;

const StepDesc = styled.p`
  color: #64748b;
  font-size: 13px;
  margin: 0 0 24px;
  line-height: 1.5;
`;

// ─── Form elements ────────────────────────────────────────────────────────────
const FieldGroup = styled.div`
  margin-bottom: 18px;
`;

const Label = styled.label`
  display: block;
  color: #374151;
  font-size: 13.5px;
  font-weight: 700;
  margin-bottom: 6px;
`;

const RequiredMark = styled.span`
  color: #ef4444;
  margin-left: 3px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: 2px solid ${p => p.$error ? '#ef4444' : p.$ok ? '#22c55e' : '#e2e8f0'};
  border-radius: 9px;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: ${p => p.$ok ? '#f0fdf4' : 'white'};
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: ${p => p.$error ? '#ef4444' : '#2c3e50'};
  }
  &::placeholder { color: #cbd5e1; }
  &:disabled { opacity: 0.55; cursor: not-allowed; background: #f8fafc; }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 9px;
  font-size: 15px;
  font-family: inherit;
  background: white;
  color: #1e293b;
  cursor: pointer;
  box-sizing: border-box;
  &:focus { border-color: #2c3e50; outline: none; }
`;

const HintText = styled.div`
  font-size: 12px;
  color: #94a3b8;
  margin-top: 5px;
  line-height: 1.4;
`;

const ErrorText = styled.div`
  font-size: 12px;
  color: #ef4444;
  margin-top: 5px;
  font-weight: 600;
`;

// ─── Password strength indicator ──────────────────────────────────────────────
const StrengthBar = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 6px;
`;

const StrengthSegment = styled.div`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: ${p => {
    if (!p.$filled) return '#e2e8f0';
    if (p.$level === 0) return '#ef4444';
    if (p.$level === 1) return '#f97316';
    return '#22c55e';
  }};
  transition: background 0.3s;
`;

const StrengthLabel = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.$level === 2 ? '#16a34a' : p.$level === 1 ? '#ea580c' : '#dc2626'};
  margin-left: 6px;
`;

function getPasswordStrength(pass) {
  if (!pass) return { level: -1, label: '' };
  const hasLetter = /[a-zA-Zα-ωΑ-Ωά-ώΆ-Ώ]/.test(pass);
  const long = pass.length >= 8;
  if (!long) return { level: 0, label: 'Πολύ αδύναμος' };
  if (!hasLetter) return { level: 1, label: 'Χρειάζεται γράμμα' };
  return { level: 2, label: 'Αποδεκτός' };
}

// ─── Path / Info boxes ────────────────────────────────────────────────────────
const PathDisplay = styled.div`
  background: #f8fafc;
  border: 2px solid ${p => p.$ok ? '#22c55e' : '#e2e8f0'};
  border-radius: 9px;
  padding: 14px 16px;
  margin: 10px 0;
  font-family: 'Consolas', monospace;
  font-size: 12.5px;
  color: #334155;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Banner = styled.div`
  border-radius: 9px;
  padding: 12px 16px;
  margin: 12px 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1.5px solid;
  ${p => p.$variant === 'green' && css`
    background: #f0fdf4;
    border-color: #86efac;
  `}
  ${p => p.$variant === 'orange' && css`
    background: #fff7ed;
    border-color: #fdba74;
  `}
  ${p => p.$variant === 'blue' && css`
    background: #eff6ff;
    border-color: #93c5fd;
  `}
`;

const BannerIcon = styled.span`font-size: 20px; flex-shrink: 0;`;
const BannerBody = styled.div`
  font-size: 13px;
  line-height: 1.5;
  strong {
    display: block;
    font-size: 13.5px;
    margin-bottom: 2px;
  }
`;

// ─── Email info card ──────────────────────────────────────────────────────────
const EmailInfoCard = styled.div`
  background: #eff6ff;
  border: 1.5px solid #93c5fd;
  border-radius: 9px;
  padding: 12px 14px;
  margin-bottom: 18px;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
  display: flex;
  gap: 10px;
  align-items: flex-start;
`;

// ─── Buttons ──────────────────────────────────────────────────────────────────
const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 28px;
  justify-content: flex-end;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: linear-gradient(to top, #ffffff 65%, rgba(255, 255, 255, 0));
  padding-top: 18px;
  padding-bottom: 2px;
`;

const Btn = styled.button`
  padding: 11px 26px;
  border-radius: 9px;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.14); }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;

const PrimaryBtn = styled(Btn)`
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  min-width: 130px;
`;

const SecondaryBtn = styled(Btn)`
  background: #f1f5f9;
  color: #374151;
  border: 1.5px solid #e2e8f0;
`;

// ─── Component ────────────────────────────────────────────────────────────────
// Steps: 0=Welcome, 1=Folder, 2=Org, 3=Superadmin
const STEPS_WITH_SUPERADMIN = 3; // steps 1-3

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  // Folder step
  const [detectedPath, setDetectedPath] = useState('');
  const [customPath, setCustomPath]     = useState('');
  const [useCustom, setUseCustom]       = useState(false);
  const [folderInfo, setFolderInfo]     = useState({ hasUsers: false, hasProjects: false, projectCount: 0 });
  const [skipSuperadmin, setSkipSuperadmin] = useState(false);

  // Org step
  const [orgType, setOrgType]       = useState('Δήμος');
  const [orgName, setOrgName]       = useState('');
  const [department, setDepartment] = useState('Τεχνική Υπηρεσία');
  const [skipOrg, setSkipOrg]       = useState(false);

  // Superadmin step
  const [adminUser, setAdminUser]               = useState('superadmin');
  const [adminFullName, setAdminFullName]       = useState('');
  const [adminEmail, setAdminEmail]             = useState('');
  const [adminPass, setAdminPass]               = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');
  const [saving, setSaving]                     = useState(false);
  const [finishError, setFinishError]           = useState('');

  // Θέση αποθήκευσης αντιγράφων ασφαλείας (προαιρετική — μόνο κατά τη νέα εγκατάσταση)
  const [backupLocation, setBackupLocation]     = useState('');

  const handleBrowseBackup = async () => {
    const selected = await ipcRenderer.invoke('select-backup-folder');
    if (selected) setBackupLocation(selected);
  };

  // Εφαρμόζει org config (από app-config ή org-config.json του dataDir)
  const applyOrgConfig = (cfg) => {
    if (!cfg) return false;
    const hasOrg = !!(cfg.organizationName || cfg.organizationFullName);
    if (hasOrg) {
      if (cfg.organizationType) setOrgType(cfg.organizationType);
      if (cfg.organizationName)  setOrgName(cfg.organizationName);
      if (cfg.department)        setDepartment(cfg.department || 'Τεχνική Υπηρεσία');
    }
    return hasOrg;
  };

  const evaluateSkips = (info, appHasOrg) => {
    const hasOrg = appHasOrg || applyOrgConfig(info.orgConfig);
    setSkipSuperadmin(info.hasUsers);
    // Παραλείπουμε τα στοιχεία Οργανισμού αν το folder έχει users ΚΑΙ το org name είναι ήδη γνωστό
    setSkipOrg(info.hasUsers && hasOrg);
  };

  useEffect(() => {
    async function detect() {
      // Ελέγχουμε αν το app-config έχει ήδη org στοιχεία (reinstall ίδιο μηχάνημα)
      const appCfg = await ipcRenderer.invoke('get-app-config');
      const appHasOrg = applyOrgConfig(appCfg);

      const dir = await ipcRenderer.invoke('get-data-dir');
      setDetectedPath(dir || '');
      if (dir) {
        const info = await ipcRenderer.invoke('check-folder-has-config', dir);
        setFolderInfo(info);
        evaluateSkips(info, appHasOrg);
      }
    }
    detect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activePath = useCustom ? customPath : detectedPath;
  // Υπολογισμός dots ανάλογα με τα βήματα που παραμένουν
  const totalDots = 1 + (skipOrg ? 0 : 1) + (skipSuperadmin ? 0 : 1);
  // Dot index: step 1 → 0, step 2 → 1 ή skip, step 3 → τελευταίο
  const dotIndex = skipOrg && step >= 3 ? 1 : step - 1;

  const handleBrowse = async () => {
    const selected = await ipcRenderer.invoke('select-data-folder');
    if (selected) {
      setCustomPath(selected);
      setUseCustom(true);
      const appCfg = await ipcRenderer.invoke('get-app-config');
      const appHasOrg = !!(appCfg.organizationName || appCfg.organizationFullName);
      if (appHasOrg) applyOrgConfig(appCfg);
      const info = await ipcRenderer.invoke('check-folder-has-config', selected);
      setFolderInfo(info);
      evaluateSkips(info, appHasOrg);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setFinishError('');
    const fullOrgName = orgName.trim()
      ? `${orgType} ${orgName.trim()}`.trim()
      : orgType;

    const configPayload = {
      dataDir: activePath,
      organizationType: orgType,
      organizationName: orgName.trim(),
      organizationFullName: fullOrgName,
      department: department.trim(),
    };

    try {
      // 1. Αποθήκευση dataDir + org (χωρίς relaunch) ώστε το create-user να γράψει στον σωστό φάκελο
      await ipcRenderer.invoke('save-app-config', configPayload);

      // 2. Δημιουργία SUPERADMIN πριν το setupCompleted — αλλιώς το relaunch έσβηνε τη διαδικασία
      if (!skipSuperadmin) {
        const userRes = await ipcRenderer.invoke('create-user', {
          username: adminUser.trim(),
          password: adminPass,
          role: 'SUPERADMIN',
          fullName: adminFullName.trim() || adminUser.trim(),
          email: adminEmail.trim(),
        });
        if (!userRes?.success) {
          setFinishError(userRes?.error || 'Αποτυχία δημιουργίας λογαριασμού Υπερδιαχειριστή.');
          setSaving(false);
          return;
        }

        // 2β. Προαιρετική θέση αποθήκευσης αντιγράφων ασφαλείας (γνωστή μόνο στον Υπερδιαχειριστή)
        if (backupLocation.trim()) {
          try {
            await ipcRenderer.invoke('save-backup-location', {
              actingUsername: adminUser.trim(),
              location: backupLocation.trim(),
            });
          } catch (_e) { /* μη κρίσιμο για την ολοκλήρωση */ }
        }
      }

      // 3. Ολοκλήρωση ρύθμισης → relaunch
      await ipcRenderer.invoke('save-app-config', { ...configPayload, setupCompleted: true });
    } catch (err) {
      setFinishError(err?.message || 'Σφάλμα κατά την αποθήκευση ρυθμίσεων.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onComplete();
  };

  // ── Validation ──
  const canFolder = !!activePath;
  const canOrg    = orgName.trim().length > 0;
  const passStrength    = getPasswordStrength(adminPass);
  const passwordsMatch  = adminPass === adminPassConfirm;
  const emailValid      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
  const canFinish =
    adminUser.trim().length > 0 &&
    adminFullName.trim().length > 0 &&
    emailValid &&
    passStrength.level === 2 &&
    passwordsMatch;

  return (
    <Overlay>
      <Card>
        <CardScroll>

        {/* ══════════════════════════════════════════════════════
            STEP 0 — WELCOME
        ══════════════════════════════════════════════════════ */}
        {step === 0 && (
          <WelcomeWrap>
            <WelcomeIcon>🏛️</WelcomeIcon>
            <WelcomeBrand>ERGOHUB</WelcomeBrand>
            <WelcomeTagline>Πληροφοριακό Σύστημα Διαχείρισης Έργων & Προμηθειών</WelcomeTagline>

            <FeatureList>
              <FeatureRow>
                <FeatureIcon>📁</FeatureIcon>
                <FeatureText>
                  <FeatureTitle>Διαχείριση Έργων & Υποέργων</FeatureTitle>
                  <FeatureSub>Παρακολούθηση εντάξεων, προσκλήσεων, συμβάσεων και εγκρίσεων πίστωσης.</FeatureSub>
                </FeatureText>
              </FeatureRow>
              <FeatureRow>
                <FeatureIcon>👥</FeatureIcon>
                <FeatureText>
                  <FeatureTitle>Πολλαπλοί Ρόλοι & Χρήστες</FeatureTitle>
                  <FeatureSub>SUPERADMIN, ADMIN, Μηχανικοί και Χρήστες — με διαβαθμισμένα δικαιώματα.</FeatureSub>
                </FeatureText>
              </FeatureRow>
              <FeatureRow>
                <FeatureIcon>📊</FeatureIcon>
                <FeatureText>
                  <FeatureTitle>Εκθέσεις & Εξαγωγές</FeatureTitle>
                  <FeatureSub>Excel, PDF, Τεχνικό Πρόγραμμα, Επιχειρησιακό Πρόγραμμα και Πύλη Διαφάνειας.</FeatureSub>
                </FeatureText>
              </FeatureRow>
            </FeatureList>

            <StartButton data-testid="setup-start" onClick={() => setStep(1)}>
              Ξεκινήστε τη Ρύθμιση →
            </StartButton>
          </WelcomeWrap>
        )}

        {/* ══════════════════════════════════════════════════════
            STEPS 1-3
        ══════════════════════════════════════════════════════ */}
        {step >= 1 && (
          <>
            <LogoRow>
              <span style={{ fontSize: 20 }}>🏛️</span>
              <LogoBrand>ERGOHUB</LogoBrand>
              <StepBadge>Βήμα {dotIndex + 1} / {totalDots}</StepBadge>
            </LogoRow>

            <StepIndicator>
              {Array.from({ length: totalDots }, (_, i) => (
                <StepDot key={i} $active={dotIndex === i} $done={dotIndex > i} />
              ))}
            </StepIndicator>

            {/* ── Βήμα 1: Φάκελος ── */}
            {step === 1 && (
              <>
                <StepTitle>Φάκελος Δεδομένων</StepTitle>
                <StepDesc>
                  Ορίστε τον φάκελο όπου θα αποθηκεύονται τα δεδομένα.
                  Αν χρησιμοποιείτε κοινόχρηστο δίσκο (π.χ. Z:\), επιλέξτε τον αντίστοιχο.
                </StepDesc>

                {detectedPath && !useCustom && (
                  <PathDisplay $ok>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 2, color: '#166534' }}>Εντοπίστηκε αυτόματα:</div>
                      {detectedPath}
                    </div>
                  </PathDisplay>
                )}
                {useCustom && customPath && (
                  <PathDisplay $ok>
                    <span style={{ fontSize: 18 }}>📁</span>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Επιλέχθηκε:</div>
                      {customPath}
                    </div>
                  </PathDisplay>
                )}
                {!detectedPath && !customPath && (
                  <PathDisplay>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>Δεν εντοπίστηκε φάκελος. Επιλέξτε χειροκίνητα.</div>
                  </PathDisplay>
                )}

                {folderInfo.hasUsers && (
                  <Banner $variant="green">
                    <BannerIcon>✅</BannerIcon>
                    <BannerBody style={{ color: '#166534' }}>
                      <strong>Βρέθηκαν υπάρχουσες ρυθμίσεις!</strong>
                      Ο φάκελος περιέχει λογαριασμούς χρηστών
                      {folderInfo.hasProjects && ` και ${folderInfo.projectCount} έργ${folderInfo.projectCount === 1 ? 'ο' : 'α'}`}.
                      Η δημιουργία Υπερδιαχειριστή θα παραληφθεί.
                    </BannerBody>
                  </Banner>
                )}
                {activePath && !folderInfo.hasUsers && (
                  <Banner $variant="orange">
                    <BannerIcon>📂</BannerIcon>
                    <BannerBody style={{ color: '#9a3412' }}>
                      <strong>Νέος φάκελος χωρίς ρυθμίσεις</strong>
                      Θα δημιουργήσετε λογαριασμό Υπερδιαχειριστή στο τελευταίο βήμα.
                    </BannerBody>
                  </Banner>
                )}

                {skipOrg && (
                  <Banner $variant="blue">
                    <BannerIcon>ℹ️</BannerIcon>
                    <BannerBody style={{ color: '#1e3a8a' }}>
                      <strong>Στοιχεία Οργανισμού: {orgName || '—'}</strong>
                      Τα στοιχεία βρέθηκαν αυτόματα και δεν χρειάζεται επαναεισαγωγή.
                    </BannerBody>
                  </Banner>
                )}

                <ButtonRow>
                  <SecondaryBtn onClick={handleBrowse}>
                    {activePath ? 'Αλλαγή φακέλου...' : 'Επιλογή φακέλου...'}
                  </SecondaryBtn>
                  {useCustom && detectedPath && (
                    <SecondaryBtn onClick={async () => {
                      setUseCustom(false);
                      const appCfg = await ipcRenderer.invoke('get-app-config');
                      const appHasOrg = !!(appCfg.organizationName || appCfg.organizationFullName);
                      if (appHasOrg) applyOrgConfig(appCfg);
                      const info = await ipcRenderer.invoke('check-folder-has-config', detectedPath);
                      setFolderInfo(info);
                      evaluateSkips(info, appHasOrg);
                    }}>
                      Επαναφορά
                    </SecondaryBtn>
                  )}
                  <PrimaryBtn
                    data-testid="setup-folder-next"
                    onClick={() => {
                      if (skipOrg && skipSuperadmin) handleFinish();
                      else if (skipOrg) setStep(3);
                      else setStep(2);
                    }}
                    disabled={!canFolder || (skipOrg && skipSuperadmin && saving)}
                  >
                    {skipOrg && skipSuperadmin
                      ? (saving ? 'Αποθήκευση...' : 'Ολοκλήρωση')
                      : 'Επόμενο'}
                  </PrimaryBtn>
                </ButtonRow>
                {finishError && <ErrorText style={{ marginTop: 12 }}>{finishError}</ErrorText>}
              </>
            )}

            {/* ── Βήμα 2: Οργανισμός ── */}
            {step === 2 && (
              <>
                <StepTitle>Στοιχεία Οργανισμού</StepTitle>
                <StepDesc>
                  Τα στοιχεία αυτά εμφανίζονται σε όλες τις αναφορές και εξαγωγές της εφαρμογής.
                </StepDesc>

                <FieldGroup>
                  <Label>Τύπος Φορέα</Label>
                  <Select value={orgType} onChange={e => setOrgType(e.target.value)}>
                    <option value="Δήμος">Δήμος</option>
                    <option value="Περιφέρεια">Περιφέρεια</option>
                    <option value="Περιφερειακή Ενότητα">Περιφερειακή Ενότητα</option>
                    <option value="Οργανισμός">Οργανισμός</option>
                    <option value="ΔΕΥΑ">ΔΕΥΑ</option>
                    <option value="">Άλλο (μόνο όνομα)</option>
                  </Select>
                </FieldGroup>

                <FieldGroup>
                  <Label>
                    Ονομασία {orgType || 'Φορέα'}
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-org-name"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder={orgType === 'Δήμος' ? 'π.χ. Αρχανών Αστερουσίων' : 'π.χ. Κρήτης'}
                    autoFocus
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label>Τμήμα / Διεύθυνση</Label>
                  <Input
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="π.χ. Τεχνική Υπηρεσία"
                  />
                </FieldGroup>

                {finishError && <ErrorText style={{ marginBottom: 12 }}>{finishError}</ErrorText>}

                <ButtonRow>
                  <SecondaryBtn onClick={() => setStep(1)}>Πίσω</SecondaryBtn>
                  <PrimaryBtn
                    data-testid="setup-org-next"
                    onClick={() => { skipSuperadmin ? handleFinish() : setStep(3); }}
                    disabled={!canOrg || (skipSuperadmin && saving)}
                  >
                    {skipSuperadmin ? (saving ? 'Αποθήκευση...' : 'Ολοκλήρωση') : 'Επόμενο'}
                  </PrimaryBtn>
                </ButtonRow>
              </>
            )}

            {/* ── Βήμα 3: Υπερδιαχειριστής ── */}
            {step === 3 && !skipSuperadmin && !skipOrg && (
              <>
                <StepTitle>Λογαριασμός Υπερδιαχειριστή</StepTitle>
                <StepDesc>
                  Ο Υπερδιαχειριστής έχει πλήρη πρόσβαση στην εφαρμογή και δημιουργεί όλους τους υπόλοιπους χρήστες.
                </StepDesc>

                <FieldGroup>
                  <Label>
                    Όνομα χρήστη (username)
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-admin-username"
                    value={adminUser}
                    onChange={e => setAdminUser(e.target.value)}
                    placeholder="π.χ. superadmin"
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label>
                    Ονοματεπώνυμο
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-admin-fullname"
                    value={adminFullName}
                    onChange={e => setAdminFullName(e.target.value)}
                    placeholder="π.χ. Νίκος Παπαδόπουλος"
                  />
                </FieldGroup>

                {/* Email with explanation */}
                <EmailInfoCard>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📧</span>
                  <div>
                    <strong style={{ display: 'block', marginBottom: 4, color: '#1e40af' }}>Γιατί χρειάζεται το email;</strong>
                    Χρησιμοποιείται για αποστολή ειδοποιήσεων ανάθεσης εργασιών, ενημερώσεων
                    κατάστασης και επαναφοράς κωδικού. Μπορείτε να το αλλάξετε αργότερα από τη Διαχείριση Χρηστών.
                  </div>
                </EmailInfoCard>
                <FieldGroup>
                  <Label>
                    Email Υπερδιαχειριστή
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="π.χ. admin@dimos.gr"
                    $error={adminEmail.length > 0 && !emailValid}
                    $ok={emailValid}
                  />
                  {adminEmail.length > 0 && !emailValid && (
                    <ErrorText>Εισάγετε έγκυρη διεύθυνση email.</ErrorText>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label>
                    Κωδικός πρόσβασης
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-admin-password"
                    type="password"
                    value={adminPass}
                    onChange={e => setAdminPass(e.target.value)}
                    placeholder="Τουλάχιστον 6 χαρακτήρες με ένα γράμμα"
                    $error={adminPass.length > 0 && passStrength.level < 2}
                    $ok={passStrength.level === 2}
                  />
                  {adminPass.length > 0 && (
                    <>
                      <StrengthBar>
                        {[0, 1, 2].map(i => (
                          <StrengthSegment
                            key={i}
                            $filled={passStrength.level >= i}
                            $level={passStrength.level}
                          />
                        ))}
                        <StrengthLabel $level={passStrength.level}>{passStrength.label}</StrengthLabel>
                      </StrengthBar>
                      {passStrength.level === 0 && (
                        <ErrorText>Απαιτούνται τουλάχιστον 8 χαρακτήρες.</ErrorText>
                      )}
                      {passStrength.level === 1 && (
                        <ErrorText>Ο κωδικός πρέπει να περιέχει τουλάχιστον ένα γράμμα.</ErrorText>
                      )}
                    </>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <Label>
                    Επιβεβαίωση κωδικού
                    <RequiredMark>*</RequiredMark>
                  </Label>
                  <Input
                    data-testid="setup-admin-password-confirm"
                    type="password"
                    value={adminPassConfirm}
                    onChange={e => setAdminPassConfirm(e.target.value)}
                    placeholder="Επαναλάβετε τον κωδικό"
                    $error={adminPassConfirm.length > 0 && !passwordsMatch}
                    $ok={adminPassConfirm.length > 0 && passwordsMatch && passStrength.level === 2}
                  />
                  {adminPassConfirm.length > 0 && !passwordsMatch && (
                    <ErrorText>Οι κωδικοί δεν ταιριάζουν.</ErrorText>
                  )}
                </FieldGroup>

                <EmailInfoCard style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🛡️</span>
                  <div>
                    <strong style={{ display: 'block', marginBottom: 4, color: '#166534' }}>Θέση αποθήκευσης αντιγράφων ασφαλείας (προαιρετικό)</strong>
                    Μπορείτε να ορίσετε έναν ξεχωριστό φάκελο (π.χ. σε εξωτερικό ή δικτυακό δίσκο)
                    για την αποθήκευση των αντιγράφων ασφαλείας. Η διαδρομή θα είναι ορατή μόνο σε εσάς.
                    Αν δεν επιλέξετε, θα χρησιμοποιηθεί ο προεπιλεγμένος φάκελος δεδομένων.
                  </div>
                </EmailInfoCard>
                <FieldGroup>
                  {backupLocation ? (
                    <PathDisplay $ok>
                      <span style={{ fontSize: 18 }}>📁</span>
                      <div style={{ wordBreak: 'break-all' }}>{backupLocation}</div>
                    </PathDisplay>
                  ) : (
                    <PathDisplay>
                      <span style={{ fontSize: 18 }}>💾</span>
                      <div>Προεπιλεγμένη θέση (εντός του φακέλου δεδομένων).</div>
                    </PathDisplay>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <SecondaryBtn type="button" data-testid="setup-browse-backup" onClick={handleBrowseBackup}>
                      {backupLocation ? 'Αλλαγή φακέλου…' : 'Επιλογή φακέλου…'}
                    </SecondaryBtn>
                    {backupLocation && (
                      <SecondaryBtn type="button" onClick={() => setBackupLocation('')}>
                        Προεπιλογή
                      </SecondaryBtn>
                    )}
                  </div>
                </FieldGroup>

                {finishError && <ErrorText style={{ marginBottom: 12 }}>{finishError}</ErrorText>}

                <ButtonRow>
                  <SecondaryBtn onClick={() => setStep(2)}>Πίσω</SecondaryBtn>
                  <PrimaryBtn data-testid="setup-finish" onClick={handleFinish} disabled={!canFinish || saving}>
                    {saving ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
                  </PrimaryBtn>
                </ButtonRow>
              </>
            )}
          </>
        )}

        </CardScroll>
      </Card>
    </Overlay>
  );
};

export default SetupWizard;
