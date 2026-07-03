import React, { useMemo } from 'react';
import styled from 'styled-components';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import { listContractExtensionEntries } from '../utils/khmdhsManualContractExtension';
import { formatDateEl } from '../utils/dateFormat';

const LinkBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(180, 83, 9, 0.35);
  background: #fffbeb;
  color: #92400e;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: #fef3c7;
  }
`;

async function openExternalUrl(url) {
  const u = String(url || '').trim();
  if (!u || !window.electronAPI?.invoke) return;
  try {
    await window.electronAPI.invoke('open-external-url', { url: u });
  } catch {
    /* ignore */
  }
}

/**
 * Λεπτομέρειες χειροκίνητης παράτασης λήξης σύμβασης για υποκάρτα μετά τη σύμβαση.
 *
 * @param {{
 *   project: object,
 *   arrayIndex: number,
 *   entryId: string,
 *   parentTitle?: string,
 *   variant?: 'detail'|'card',
 *   defaultExpanded?: boolean,
 * }} props
 */
export default function KhmdhsManualExtensionDisplay({
  project,
  arrayIndex = 0,
  entryId,
  parentTitle = '',
  variant = 'detail',
  defaultExpanded = false,
}) {
  const entry = useMemo(() => {
    const entries = listContractExtensionEntries(project, arrayIndex);
    return entries.find((e) => e.id === entryId) || null;
  }, [project, arrayIndex, entryId]);

  const groups = useMemo(() => {
    if (!entry) return [];
    const out = [];
    const dateRows = [];
    if (entry.newEndDate) {
      dateRows.push({
        label: 'Νέα ημερομηνία λήξης',
        value: formatDateEl(entry.newEndDate, ''),
        highlight: true,
      });
    }
    if (entry.documentDate) {
      dateRows.push({
        label: 'Ημερομηνία εγγράφου',
        value: formatDateEl(entry.documentDate, ''),
      });
    }
    if (dateRows.length) {
      out.push({ id: 'dates', title: 'Ημερομηνίες', icon: '🗓️', rows: dateRows });
    }

    if (entry.diavgeiaAda) {
      out.push({
        id: 'sources',
        title: 'Πηγές / αναφορές',
        icon: '🔗',
        rows: [{ label: 'ΑΔΑ Διαύγειας', value: entry.diavgeiaAda, badge: true }],
      });
    }

    if (entry.comments) {
      out.push({
        id: 'comments',
        title: 'Σχόλια',
        icon: '📝',
        rows: [{ label: 'Κείμενο', value: entry.comments, fullWidth: true }],
      });
    }

    if (entry.fileName) {
      const fileRows = [
        { label: 'Όνομα αρχείου', value: entry.fileName, highlight: true, fullWidth: true },
      ];
      if (entry.fileGroupTitle) {
        fileRows.push({ label: 'Ομάδα αρχείων', value: entry.fileGroupTitle });
      }
      out.push({ id: 'file', title: 'Αρχείο υποέργου', icon: '📎', rows: fileRows });
    }

    return out;
  }, [entry]);

  if (!entry) return null;

  const summaryChips = [];
  if (entry.newEndDate) {
    summaryChips.push({ label: 'Νέα λήξη', value: formatDateEl(entry.newEndDate, ''), strong: true, highlight: true });
  }
  if (entry.diavgeiaAda) {
    summaryChips.push({ label: 'ΑΔΑ', value: entry.diavgeiaAda });
  }
  if (entry.fileName) {
    summaryChips.push({ label: 'Αρχείο', value: entry.fileName });
  }

  const title = parentTitle ? `Παράταση — ${parentTitle}` : 'Παράταση σύμβασης';

  return (
    <>
      <KhmdhsPanelDisplay
        themeKey="ext"
        title={`⏱ ${title}`}
        adam={entry.diavgeiaAda}
        subtitle={parentTitle ? `Σχετίζεται με: ${parentTitle}` : undefined}
        groups={groups}
        summaryChips={summaryChips}
        variant={variant}
        defaultExpanded={defaultExpanded}
      />
      {entry.diavgeiaAda ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <LinkBtn
            type="button"
            onClick={() => openExternalUrl(
              `https://diavgeia.gov.gr/doc/${encodeURIComponent(entry.diavgeiaAda)}`
            )}
          >
            Άνοιγμα στη Διαύγεια
          </LinkBtn>
        </div>
      ) : null}
    </>
  );
}
