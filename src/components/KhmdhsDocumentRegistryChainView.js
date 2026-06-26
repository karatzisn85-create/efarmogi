import React, { useMemo } from 'react';
import styled from 'styled-components';
import { openKhmdhsActOnline } from '../utils/openKhmdhsActOnline';
import {
  annotateRegistryLinkLabels,
  registryEntryIsAlreadyRecorded,
} from '../utils/khmdhsDocumentRegistry';
import { useToast } from './ToastProvider';

const ChainShell = styled.div`
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 0.55rem 0.6rem;
`;

const ChainHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ChainTitle = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  color: #4338ca;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const ChainCount = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  color: #64748b;
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  position: relative;
  padding-left: 0.55rem;

  &::before {
    content: '';
    position: absolute;
    left: 0.15rem;
    top: 0.35rem;
    bottom: 0.35rem;
    width: 2px;
    background: linear-gradient(180deg, #6366f1, #10b981, #d97706);
    border-radius: 999px;
    opacity: 0.35;
  }
`;

const NodeRow = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$selectable ? 'auto 1fr auto' : '1fr auto')};
  align-items: center;
  gap: 0.5rem;
  padding: 0.32rem 0.4rem 0.32rem 0.5rem;
  border-radius: 7px;
  background: #fff;
  border: 1px solid ${(p) => (p.$active ? '#c7d2fe' : 'transparent')};
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: -0.42rem;
    top: 50%;
    transform: translateY(-50%);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6366f1;
    box-shadow: 0 0 0 2px #fff;
  }

  &:hover {
    border-color: #c7d2fe;
    background: #fafbff;
  }
`;

const LinkLabel = styled.span`
  font-size: 0.76rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
`;

const ViewBtn = styled.button`
  flex-shrink: 0;
  border: 1px solid #6366f1;
  background: #fff;
  color: #4338ca;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 0.22rem 0.48rem;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;

  &:hover {
    background: #eef2ff;
  }
`;

function KhmdhsDocumentRegistryChainView({
  entries = [],
  selectable = false,
  selected,
  onToggle,
  existing = [],
  showHeader = true,
  headerTitle = 'Αλυσίδα ΚΗΜΔΗΣ',
}) {
  const { showToast } = useToast();
  const labeled = useMemo(() => annotateRegistryLinkLabels(entries), [entries]);

  if (!labeled.length) return null;

  return (
    <ChainShell>
      {showHeader ? (
        <ChainHeader>
          <ChainTitle>{headerTitle}</ChainTitle>
          <ChainCount>{labeled.length} κρίκ{labeled.length === 1 ? 'ος' : 'οι'}</ChainCount>
        </ChainHeader>
      ) : null}

      <Timeline>
        {labeled.map((entry) => {
          const checked = selectable ? selected?.has(entry.adam) : false;
          const already = registryEntryIsAlreadyRecorded(entry, existing);
          const label = entry.linkLabel || entry.stageLabel;

          return (
            <NodeRow key={entry.id || entry.adam} $selectable={selectable} $active={checked}>
              {selectable ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle?.(entry.adam)}
                  aria-label={`Επιλογή ${label}`}
                />
              ) : null}
              <LinkLabel title={[label, entry.adam].filter(Boolean).join(' · ')}>
                {label}
              </LinkLabel>
              <ViewBtn
                type="button"
                onClick={async () => {
                  if (entry.source === 'diavgeia' && entry.openUrl) {
                    const res = await window.electronAPI.invoke('open-external-url', { url: entry.openUrl });
                    if (res?.success === false && res?.error) showToast(res.error, 'error');
                    return;
                  }
                  const res = await openKhmdhsActOnline(entry.adam, { label });
                  if (res?.success === false && res?.error) {
                    showToast(res.error, 'error');
                  }
                }}
                title="Προβολή εγγράφου στον browser"
              >
                Προβολή
              </ViewBtn>
            </NodeRow>
          );
        })}
      </Timeline>
    </ChainShell>
  );
}

export default KhmdhsDocumentRegistryChainView;
