import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { isIncompleteConfirmationLine } from '../utils/khmdhsRefreshFindings';
import { splitKhmdhsRegistryChangeLines } from '../utils/khmdhsChainRefresh';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
`;

const Dialog = styled.div`
  background: #fff;
  border-radius: 14px;
  width: min(560px, 100%);
  max-height: min(85vh, 720px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  min-height: 0;
`;

const Header = styled.div`
  padding: 1rem 1.2rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0 0 0.35rem;
  font-size: 1rem;
  color: #0f172a;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.45;
`;

const Body = styled.div`
  padding: 1rem 1.2rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const List = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  color: #334155;
  font-size: 0.84rem;
  line-height: 1.55;
`;

const RegistryBlock = styled.div`
  margin-top: 0.55rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  overflow: hidden;
`;

const RegistryToggle = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.65rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  &:hover { background: #f1f5f9; }
`;

const RegistryList = styled.ul`
  margin: 0;
  padding: 0 0.8rem 0.7rem 1.8rem;
  color: #475569;
  font-size: 0.76rem;
  line-height: 1.5;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.2rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Btn = styled.button`
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
`;

const CancelBtn = styled(Btn)`
  background: #e2e8f0;
  color: #475569;
`;

const ConfirmBtn = styled(Btn)`
  background: linear-gradient(135deg, #4338ca, #6366f1);
  color: #fff;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default function KhmdhsChainRefreshDialog({
  isOpen,
  onClose,
  onConfirm,
  saving = false,
  seedLabel,
  seedAdam,
  changeLines = [],
}) {
  const [showAllRegistry, setShowAllRegistry] = useState(false);
  const { other, registry, removed = [] } = useMemo(
    () => splitKhmdhsRegistryChangeLines(changeLines),
    [changeLines]
  );

  if (!isOpen) return null;

  const registryPreviewLimit = 5;
  const registryVisible = showAllRegistry ? registry : registry.slice(0, registryPreviewLimit);
  const hasMoreRegistry = registry.length > registryPreviewLimit;
  const removedVisible = showAllRegistry ? removed : removed.slice(0, registryPreviewLimit);
  const hasMoreRemoved = removed.length > registryPreviewLimit;

  return (
    <Overlay onClick={onClose}>
      <Dialog onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <Header>
          <Title>Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ</Title>
          <Sub>
            Ανάκτηση από {seedLabel || 'αλυσίδα'} · ΑΔΑΜ <strong>{seedAdam}</strong>
          </Sub>
        </Header>
        <Body>
          <Sub style={{ marginBottom: '0.65rem', color: '#475569' }}>Αλλαγές που θα εφαρμοστούν:</Sub>
          {other.length > 0 && (
            <List>
              {other.map((line, i) => (
                <li
                  key={`o-${i}`}
                  style={
                    String(line).startsWith('⚠️')
                      ? { color: '#b45309', fontWeight: 700 }
                      : String(line).startsWith('ℹ️')
                        ? { color: '#92400e' }
                        : isIncompleteConfirmationLine(line)
                          ? { color: '#3730a3', fontWeight: 600 }
                          : undefined
                  }
                >
                  {line}
                </li>
              ))}
            </List>
          )}

          {registry.length > 0 && (
            <RegistryBlock>
              <RegistryToggle
                type="button"
                onClick={() => hasMoreRegistry && setShowAllRegistry((v) => !v)}
                style={{ cursor: hasMoreRegistry ? 'pointer' : 'default' }}
              >
                <span>
                  📁 {registry.length} νέ{registry.length === 1 ? 'ο έγγραφο' : 'α έγγραφα'} θα καταγραφούν στα Αρχεία Υποέργου
                </span>
                {hasMoreRegistry && <span>{showAllRegistry ? '▲' : '▼'}</span>}
              </RegistryToggle>
              <RegistryList>
                {registryVisible.map((line, i) => (
                  <li key={`r-${i}`}>{line}</li>
                ))}
                {!showAllRegistry && hasMoreRegistry && (
                  <li style={{ listStyle: 'none', marginLeft: '-1rem', color: '#64748b', fontWeight: 600 }}>
                    …και άλλα {registry.length - registryPreviewLimit}. Κλικ επάνω για πλήρη λίστα.
                  </li>
                )}
              </RegistryList>
            </RegistryBlock>
          )}

          {removed.length > 0 && (
            <RegistryBlock>
              <RegistryToggle
                type="button"
                onClick={() => hasMoreRemoved && setShowAllRegistry((v) => !v)}
                style={{ cursor: hasMoreRemoved ? 'pointer' : 'default' }}
              >
                <span>
                  {removed.length} έγγραφ{removed.length === 1 ? 'ο' : 'α'} θα αφαιρεθ
                  {removed.length === 1 ? 'εί' : 'ούν'} από τα Αρχεία Υποέργου
                  {' '}(δεν ανήκουν σε αυτή την αλυσίδα)
                </span>
                {hasMoreRemoved && <span>{showAllRegistry ? '▲' : '▼'}</span>}
              </RegistryToggle>
              <RegistryList>
                {removedVisible.map((line, i) => (
                  <li key={`rm-${i}`}>{line}</li>
                ))}
                {!showAllRegistry && hasMoreRemoved && (
                  <li style={{ listStyle: 'none', marginLeft: '-1rem', color: '#64748b', fontWeight: 600 }}>
                    …και άλλα {removed.length - registryPreviewLimit}. Κλικ επάνω για πλήρη λίστα.
                  </li>
                )}
              </RegistryList>
            </RegistryBlock>
          )}

          {!other.length && !registry.length && !removed.length && (
            <Sub>Δεν εντοπίστηκαν ουσιώδεις διαφορές.</Sub>
          )}
        </Body>
        <Footer>
          <CancelBtn type="button" onClick={onClose} disabled={saving}>Άκυρο</CancelBtn>
          <ConfirmBtn type="button" onClick={onConfirm} disabled={saving}>
            {saving ? 'Αποθήκευση…' : 'Εφαρμογή & αποθήκευση'}
          </ConfirmBtn>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
