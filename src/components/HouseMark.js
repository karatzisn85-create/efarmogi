import { useState } from 'react';
import styled from 'styled-components';
import FamilyModal from './FamilyModal';

const Line = styled.div`
  margin: ${(p) => (p.$layout === 'bar' ? '0 0 4px' : '0')};
  text-align: ${(p) => (p.$layout === 'bar' ? 'left' : p.$layout === 'footer' ? 'right' : 'center')};
  font-size: ${(p) => (p.$layout === 'plate' ? '.84rem' : '.78rem')};
  font-weight: 500;
  line-height: 1.35;
  color: ${(p) => (p.$tone === 'dark' ? 'rgba(224, 242, 254, .78)' : '#64748b')};
`;

const NameButton = styled.button`
  display: inline;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 700;
  color: ${(p) => (p.$tone === 'dark' ? '#f8fafc' : '#1e3a8a')};
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: ${(p) => (p.$tone === 'dark' ? 'rgba(248,250,252,.45)' : 'rgba(30,58,138,.35)')};
  &:hover { text-decoration-color: currentColor; }
`;

export default function HouseMark({ tone = 'dark', layout = 'plate', hereId = 'ergohub' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Line $tone={tone} $layout={layout}>
        Μία από τις εφαρμογές της{' '}
        <NameButton type="button" $tone={tone} data-testid="house-mark" onClick={() => setOpen(true)}>
          Δημοδομής
        </NameButton>
      </Line>
      {open && <FamilyModal hereId={hereId} onClose={() => setOpen(false)} />}
    </>
  );
}
