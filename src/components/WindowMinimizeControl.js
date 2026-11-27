import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { _confirmNo } from '../utils/confirmModal';
import { _savePdfDialogPause, _savePdfDialogResume } from '../utils/savePdfDialog';
import { _fileConflictPause, _fileConflictResume } from '../utils/fileConflictDialog';

const Slot = styled.span`
  visibility: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 0.85rem;
  border-radius: 10px;
  border: 1.5px solid transparent;
  font-size: 0.78rem;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  pointer-events: none;
`;

const Btn = styled.button`
  position: fixed;
  z-index: 210000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 0.85rem;
  border-radius: 10px;
  border: 1.5px solid #c7d2fe;
  background: #ffffff;
  color: #4338ca;
  font-size: 0.78rem;
  font-weight: 700;
  font-family: inherit;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.28);
  white-space: nowrap;

  &:hover {
    background: #eef2ff;
    border-color: #818cf8;
  }
`;

function dismissOpenConfirm() {
  if (document.querySelector('[data-testid="confirm-yes"]')) {
    _confirmNo();
  }
}

export default function WindowMinimizeControl({ testId, onClick, owner }) {
  const slotRef = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    _savePdfDialogResume(owner);
    _fileConflictResume(owner);
  }, [owner]);

  useLayoutEffect(() => {
    let raf = 0;
    let alive = true;
    const place = () => {
      const el = slotRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setBox((prev) => {
        if (
          prev
          && Math.abs(prev.top - rect.top) < 0.5
          && Math.abs(prev.left - rect.left) < 0.5
        ) return prev;
        return { top: rect.top, left: rect.left };
      });
    };
    const tick = () => {
      if (!alive) return;
      place();
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <Slot ref={slotRef} aria-hidden="true">Σύμπτυξη</Slot>
      {box ? createPortal(
        <Btn
          type="button"
          data-testid={testId}
          style={{ top: `${box.top}px`, left: `${box.left}px` }}
          onClick={() => {
            if (onClick?.() === false) return;
            dismissOpenConfirm();
            _savePdfDialogPause(owner);
            _fileConflictPause(owner);
          }}
        >
          Σύμπτυξη
        </Btn>,
        document.body
      ) : null}
    </>
  );
}
