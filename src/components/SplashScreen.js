import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import ergohubLogo from '../assets/ergohub-logo.svg';

const BOOT_PHASES = [
  'Προετοιμασία του μητρώου της τεχνικής υπηρεσίας',
  'Επαλήθευση δικαιωμάτων πρόσβασης',
  'Ανάκτηση του φακέλου δεδομένων του Δήμου',
  'Σύνθεση χαρτοφυλακίου έργων και προμηθειών',
  'Ολοκλήρωση ασφαλούς σύνδεσης στο αρχείο',
];

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const textFade = keyframes`
  0% { opacity: 0.35; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0.35; }
`;

const slide = keyframes`
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
`;

const SplashContainer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #0b1220;
  animation: ${fadeIn} 0.35s ease-out;
`;

const Crest = styled.div`
  width: min(92vw, 440px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const AppIcon = styled.img`
  width: 88px;
  height: 88px;
  border-radius: 20px;
  margin-bottom: 1.35rem;
  object-fit: cover;
  border: 1px solid rgba(201, 162, 39, 0.35);
`;

const OrgLine = styled.p`
  margin: 0 0 0.85rem;
  color: #c9a227;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const AppTitle = styled.h1`
  margin: 0;
  color: #f8fafc;
  font-size: 2rem;
  font-weight: 650;
  letter-spacing: 0.12em;
`;

const AppSubtitle = styled.p`
  margin: 0.55rem 0 0;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.02em;
`;

const Rule = styled.div`
  width: 56px;
  height: 1px;
  margin: 1.35rem 0 1.15rem;
  background: #c9a227;
`;

const LoadingText = styled.p`
  margin: 0;
  color: #f1f5f9;
  font-size: 1.05rem;
  font-weight: 500;
`;

const ProgressTrack = styled.div`
  width: min(78vw, 320px);
  height: 2px;
  margin-top: 1.35rem;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.22);
`;

const ProgressFill = styled.div`
  height: 100%;
  background: #c9a227;
  width: ${(p) => (p.$indeterminate ? '38%' : `${p.$progress || 0}%`)};
  animation: ${(p) => (p.$indeterminate ? slide : 'none')} 1.6s ease-in-out infinite;
  transition: ${(p) => (p.$indeterminate ? 'none' : 'width 0.35s ease')};
`;

const StatusText = styled.p`
  margin: 1rem 0 0;
  min-height: 1.35rem;
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.84rem;
  animation: ${textFade} 1.55s ease-in-out infinite;
`;

function SplashScreen({
  isLoading = true,
  progress = null,
  statusText,
  loadingText = 'Ενεργοποίηση της πλατφόρμας',
  organizationName = '',
}) {
  const [phase, setPhase] = useState(0);
  const rotate = statusText == null || statusText === '';

  useEffect(() => {
    if (!isLoading || !rotate) return undefined;
    const id = setInterval(() => {
      setPhase((prev) => (prev + 1) % BOOT_PHASES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [isLoading, rotate]);

  if (!isLoading) return null;

  const org = String(organizationName || '').trim();
  const shownStatus = rotate ? BOOT_PHASES[phase] : statusText;
  const indeterminate = progress == null;

  return (
    <SplashContainer role="status" aria-live="polite" aria-busy="true">
      <Crest>
        <AppIcon src={ergohubLogo} alt="" />
        {org ? <OrgLine>{org}</OrgLine> : null}
        <AppTitle>ERGOHUB</AppTitle>
        <AppSubtitle>Πλατφόρμα διαχείρισης έργων και προμηθειών</AppSubtitle>
        <Rule />
        <LoadingText>{loadingText}</LoadingText>
        <ProgressTrack>
          <ProgressFill $indeterminate={indeterminate} $progress={progress} />
        </ProgressTrack>
        <StatusText>{shownStatus}</StatusText>
      </Crest>
    </SplashContainer>
  );
}

export default SplashScreen;
