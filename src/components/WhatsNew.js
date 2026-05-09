import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const ipcRenderer = window.electronAPI;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50000;
  animation: ${fadeIn} 0.3s;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  padding: 36px 40px;
  max-width: 460px;
  width: 90%;
  text-align: center;
`;

const Version = styled.div`
  font-size: 42px;
  font-weight: 900;
  color: #1a2a3a;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  color: #333;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px;
`;

const CloseBtn = styled.button`
  background: linear-gradient(135deg, #1a2a3a, #2c3e50);
  color: white;
  border: none;
  padding: 12px 40px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
  &:hover { opacity: 0.9; }
`;

const WhatsNew = () => {
  const [show, setShow] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    const unsub = ipcRenderer.on('update-installed', (info) => {
      setVersion(info.to || '');
      setShow(true);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  if (!show) return null;

  return (
    <Overlay onClick={() => setShow(false)}>
      <Card onClick={e => e.stopPropagation()}>
        <Version>v{version}</Version>
        <Title>Η εφαρμογή ενημερώθηκε επιτυχώς!</Title>
        <CloseBtn onClick={() => setShow(false)}>Συνέχεια</CloseBtn>
      </Card>
    </Overlay>
  );
};

export default WhatsNew;
