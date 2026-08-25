/**
 * SubprojectSiteDiaryModal — το ημερολόγιο εργοταξίου ενός υποέργου, σαν παράθυρο
 * πάνω από τη λίστα των έργων. Ανοίγει από την κάρτα του υποέργου, ώστε ο χρήστης
 * να μη μεταφέρεται στην ευρεία σελίδα του ημερολογίου.
 */
import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import SiteDiaryPanel from './SiteDiaryPanel';
import { C, HEADER_GRADIENT, HEADER_STRIPE, BODY_GRADIENT } from '../utils/siteDiaryTheme';

const SCROLL_HOLDER = 'subproject-site-diary';

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 1.25rem;
  overflow: hidden;
`;

const Modal = styled.div`
  background: ${C.white};
  border-radius: 16px;
  width: 100%;
  max-width: 980px;
  height: calc(100vh - 2.5rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(8, 145, 178, 0.22), 0 4px 20px rgba(0, 0, 0, 0.12);
  animation: ${slideIn} 0.26s cubic-bezier(0.16, 1, 0.3, 1);
`;

const Header = styled.div`
  background: ${HEADER_GRADIENT};
  padding: 1.1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(8, 145, 178, 0.25);

  &::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: ${HEADER_STRIPE};
    opacity: 0.85;
  }
  &::after {
    content: '';
    position: absolute;
    top: -40%; right: -5%;
    width: 220px; height: 220px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  z-index: 1;
`;

const HeaderIcon = styled.span`
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.2);
  width: 46px; height: 46px;
  border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
`;

const HeaderText = styled.div`
  min-width: 0;
`;

const HeaderH = styled.h2`
  color: ${C.white};
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

const HeaderSub = styled.div`
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 620px;
`;

const CloseBtn = styled.button`
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 36px; height: 36px;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  z-index: 1;
  &:hover { background: rgba(255, 255, 255, 0.22); color: ${C.white}; }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: ${BODY_GRADIENT};
`;

function SubprojectSiteDiaryModal({
  subprojectId,
  projectTitle,
  subprojectTitle,
  currentUser,
  userRole,
  onClose,
  onCountChange,
}) {
  useEffect(() => {
    lockBodyScroll(SCROLL_HOLDER);
    return () => unlockBodyScroll(SCROLL_HOLDER);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <HeaderTitle>
            <HeaderIcon>🏗️</HeaderIcon>
            <HeaderText>
              <HeaderH>Ημερολόγιο Εργοταξίου</HeaderH>
              <HeaderSub>{subprojectTitle || 'Υποέργο'}</HeaderSub>
            </HeaderText>
          </HeaderTitle>
          <CloseBtn type="button" onClick={onClose} title="Κλείσιμο">✕</CloseBtn>
        </Header>
        <Body>
          <SiteDiaryPanel
            subprojectId={subprojectId}
            fallbackMeta={{ projectTitle, subprojectTitle }}
            currentUser={currentUser}
            userRole={userRole}
            embedded
            onCountChange={onCountChange}
          />
        </Body>
      </Modal>
    </Overlay>
  );
}

export default SubprojectSiteDiaryModal;
