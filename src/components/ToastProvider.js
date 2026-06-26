import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

const ToastContext = createContext(null);

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

// Μόνο accent — το σκούρο φόντο παραμένει σταθερό για αντίθεση με λευκό κείμενο.
// Τα ημιδιαφανή gradients αντικαθιστούσαν το background και έκαναν το toast
// σχεδόν αόρατο πάνω σε ανοιχτόχρωμες σελίδες (π.χ. Υποδείγματα Εγγράφων).
const typeStyles = {
  success: css`
    border-left: 4px solid #4caf50;
  `,
  error: css`
    border-left: 4px solid #f44336;
  `,
  warning: css`
    border-left: 4px solid #ff9800;
  `,
  info: css`
    border-left: 4px solid #667eea;
  `,
};

const typeIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const iconColors = {
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  info: '#667eea',
};

const ToastContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100010;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  pointer-events: none;
`;

const ToastItem = styled.div`
  min-width: 300px;
  max-width: 480px;
  padding: 14px 18px;
  border-radius: 10px;
  background: rgba(22, 27, 40, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  pointer-events: auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  animation: ${({ $leaving }) => ($leaving ? slideOut : slideIn)} 0.3s ease forwards;
  ${({ $type }) => typeStyles[$type] || typeStyles.info}
`;

const IconCircle = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  color: #fff;
  background: ${({ $type }) => iconColors[$type] || iconColors.info};
`;

const ToastBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const ToastMessage = styled.p`
  margin: 0;
  color: #f5f7fb;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.85);
  }
`;

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback(
    (message, type = 'info') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);

      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
        delete timersRef.current[id];
      }, 4000);

      return id;
    },
    [removeToast]
  );

  const handleClose = useCallback(
    (id) => {
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
      removeToast(id);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} $type={toast.type} $leaving={toast.leaving}>
            <IconCircle $type={toast.type}>{typeIcons[toast.type]}</IconCircle>
            <ToastBody>
              <ToastMessage>{toast.message}</ToastMessage>
            </ToastBody>
            <CloseButton onClick={() => handleClose(toast.id)}>✕</CloseButton>
          </ToastItem>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
