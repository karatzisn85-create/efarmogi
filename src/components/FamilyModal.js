import { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

const APPS = [
  {
    id: 'ydro-vlaves',
    name: 'ΥδροΒλάβες',
    summary: 'Βλάβες δικτύων ύδρευσης, άρδευσης και αποχέτευσης.',
    about: 'Καταγράφει τη βλάβη από την αναφορά ως την αποκατάσταση: το σημείο στον χάρτη, τα υλικά, τις φωτογραφίες και την πορεία. Αφορά το δίκτυο και τις υποδομές του δήμου.',
  },
  {
    id: 'ydrometer',
    name: 'ΥδροMeter Pro',
    summary: 'Υδρόμετρα ύδρευσης και άρδευσης, αιτήσεις και καταμέτρηση.',
    about: 'Κρατά το μητρώο των υδρομέτρων, τις αιτήσεις νέας παροχής και τη δουλειά του συνεργείου στην καταμέτρηση.',
  },
  {
    id: 'ergohub',
    name: 'ERGOHUB',
    summary: 'Έργα και διαδικασίες της τεχνικής υπηρεσίας.',
    about: 'Παρακολουθεί τα έργα του δήμου, τις αναθέσεις και την πορεία τους μέσα στην τεχνική υπηρεσία.',
  },
  {
    id: 'periousia',
    name: 'Δημοτική Περιουσία',
    summary: 'Κτίρια και ακίνητη περιουσία του δήμου.',
    about: 'Κρατά την εικόνα των δημοτικών κτιρίων και της ακίνητης περιουσίας.',
  },
];

const fade = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const rise = keyframes`
  from { transform: translateY(8px); }
  to { transform: none; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, .55);
  animation: ${fade} .16s ease;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Card = styled.div`
  width: min(680px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  overflow: auto;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
  animation: ${rise} .22s cubic-bezier(.16, 1, .3, 1);
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 22px 22px 8px;
  h2 { margin: 0; color: #1e3a8a; font-size: 1.35rem; letter-spacing: -.02em; }
`;

const Close = styled.button`
  flex-shrink: 0;
  border: none;
  background: #f1f5f9;
  color: #334155;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  &:hover { background: #e2e8f0; }
`;

const Body = styled.div`padding: 8px 22px 22px;`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  @media (max-width: 620px) { grid-template-columns: 1fr; }
`;

const AppButton = styled.button`
  text-align: left;
  border: 1px solid ${(p) => (p.$here ? '#bfdbfe' : '#e2e8f0')};
  background: ${(p) => (p.$here ? '#f8fbff' : 'white')};
  border-radius: 14px;
  padding: 14px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  &:hover { border-color: #93c5fd; background: #f8fbff; }
  strong { display: block; color: #0f172a; font-size: 1rem; margin-bottom: 4px; }
  span { display: block; color: #64748b; font-size: .86rem; line-height: 1.4; }
`;

const Here = styled.em`
  display: inline-block;
  margin-top: 8px;
  font-style: normal;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .02em;
  color: #1e3a8a;
  background: #dbeafe;
  border-radius: 999px;
  padding: 3px 8px;
`;

const Back = styled.button`
  border: none;
  background: none;
  color: #1e3a8a;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  margin-bottom: 12px;
  &:hover { text-decoration: underline; }
`;

const DetailTitle = styled.h3`
  margin: 0 0 8px;
  color: #0f172a;
  font-size: 1.35rem;
`;

const DetailText = styled.p`
  margin: 0 0 10px;
  color: #334155;
  line-height: 1.5;
`;

const Note = styled.p`
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #475569;
  line-height: 1.45;
`;

export default function FamilyModal({ onClose, hereId = 'ergohub' }) {
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const app = APPS.find((item) => item.id === picked);

  return (
    <Overlay role="presentation" onClick={onClose}>
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-title"
        data-testid="family-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <Head>
          <div>
            <h2 id="family-title">Δημοδομή</h2>
          </div>
          <Close type="button" aria-label="Κλείσιμο" data-testid="family-close" onClick={onClose}>×</Close>
        </Head>
        <Body>
          {app ? (
            <div data-testid="family-detail">
              <Back type="button" data-testid="family-back" onClick={() => setPicked(null)}>Όλες οι εφαρμογές</Back>
              <DetailTitle>{app.name}</DetailTitle>
              <DetailText>{app.summary}</DetailText>
              <DetailText>{app.about}</DetailText>
              <Note>
                {app.id === hereId
                  ? 'Αυτή η εφαρμογή είναι ανοιχτή.'
                  : 'Ανοίγει από το δικό της εικονίδιο.'}
              </Note>
            </div>
          ) : (
            <Grid>
              {APPS.map((item) => (
                <AppButton
                  key={item.id}
                  type="button"
                  $here={item.id === hereId}
                  data-testid={`family-${item.id}`}
                  onClick={() => setPicked(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.summary}</span>
                  {item.id === hereId && <Here>Ανοιχτή τώρα</Here>}
                </AppButton>
              ))}
            </Grid>
          )}
        </Body>
      </Card>
    </Overlay>
  );
}
