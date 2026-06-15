import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';

const C = {
  indigo: '#6366f1',
  indigoLight: '#eef2ff',
  amber: '#d97706',
  rose: '#dc2626',
  slate700: '#334155',
  slate500: '#64748b',
  slate200: '#e2e8f0',
  white: '#ffffff',
};

const Widget = styled.div`
  margin-bottom: 1rem;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  background: linear-gradient(135deg, ${C.indigoLight} 0%, ${C.white} 100%);
  padding: 0.85rem 1rem;
`;

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
`;

const WidgetTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 800;
  color: ${C.slate700};
`;

const WidgetSub = styled.div`
  font-size: 0.75rem;
  color: ${C.slate500};
`;

const AlertList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const AlertItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  background: ${C.white};
  border: 1px solid ${C.slate200};
`;

const AlertTitle = styled.span`
  font-weight: 600;
  color: ${C.slate700};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AlertDays = styled.span`
  flex-shrink: 0;
  font-weight: 700;
  color: ${(p) => (p.$urgent ? C.rose : p.$soon ? C.amber : C.indigo)};
`;

function formatDaysLabel(daysLeft) {
  if (daysLeft === 0) return 'Σήμερα';
  if (daysLeft === 1) return '1 ημέρα';
  return `${daysLeft} ημέρες`;
}

export default function OrimanthiAepoWidget({ onOpenOrimanthi }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await window.electronAPI.invoke('get-orimanthi-aepo-alerts', { limit: 5, maxDays: 90 });
      if (res.success) setAlerts(res.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadAlerts]);

  if (loading || alerts.length === 0) return null;

  return (
    <Widget>
      <WidgetHeader>
        <div>
          <WidgetTitle>🔔 ΑΕΠΟ — λήξη εντός 90 ημερών</WidgetTitle>
          <WidgetSub>Ωρίμανση έργων · {alerts.length} {alerts.length === 1 ? 'ενεργό' : 'ενεργά'}</WidgetSub>
        </div>
        {onOpenOrimanthi && (
          <button
            type="button"
            onClick={onOpenOrimanthi}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '0.35rem 0.65rem',
              background: C.indigo,
              color: C.white,
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Άνοιγμα Ωρίμανσης
          </button>
        )}
      </WidgetHeader>
      <AlertList>
        {alerts.map((row) => (
          <AlertItem key={row.id}>
            <AlertTitle title={row.title}>{row.title}</AlertTitle>
            <AlertDays $urgent={row.daysLeft <= 30} $soon={row.daysLeft > 30 && row.daysLeft <= 60}>
              {formatDaysLabel(row.daysLeft)}
            </AlertDays>
          </AlertItem>
        ))}
      </AlertList>
    </Widget>
  );
}
