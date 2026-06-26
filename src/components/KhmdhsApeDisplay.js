import React, { useMemo } from 'react';
import styled from 'styled-components';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  formatApeAmountDisplay,
  getApeKhmdhsReferenceAmountLabel,
  readApeFileRef,
  readContractApeFields,
  readSupplementaryApeFields,
} from '../utils/khmdhsApeEntry';
import { buildKhmdhsOpenUrl } from '../utils/khmdhsPortalLinks';

const LinkBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(13, 148, 136, 0.35);
  background: #ecfdf5;
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: #d1fae5;
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
 * Λεπτομέρειες καταχωρημένου ΑΠΕ για υποκάρτα μετά τη σύμβαση.
 *
 * @param {{
 *   project: object,
 *   target: { kind: 'contract'|'supplementary', arrayIndex: number },
 *   parentTitle?: string,
 *   variant?: 'detail'|'card',
 *   defaultExpanded?: boolean,
 * }} props
 */
export default function KhmdhsApeDisplay({
  project,
  target,
  parentTitle = '',
  variant = 'detail',
  defaultExpanded = false,
}) {
  const kind = target?.kind || 'contract';
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;

  const fields = useMemo(
    () => (kind === 'supplementary'
      ? readSupplementaryApeFields(project, arrayIndex)
      : readContractApeFields(project, arrayIndex, entryId)),
    [project, kind, arrayIndex, entryId]
  );

  const fileRef = useMemo(
    () => readApeFileRef(project, { kind, arrayIndex, entryId }),
    [project, kind, arrayIndex, entryId]
  );

  const groups = useMemo(() => {
    const out = [];
    const khmdhsFmt = formatApeAmountDisplay(fields.khmdhsAmount);
    const apeFmt = formatApeAmountDisplay(fields.apeAmount);
    const amountRows = [];
    if (fields.documentDate) {
      amountRows.push({
        label: 'Ημερομηνία εγγράφου',
        value: new Date(`${fields.documentDate}T12:00:00`).toLocaleDateString('el-GR'),
      });
    }
    if (khmdhsFmt) {
      amountRows.push({
        label: getApeKhmdhsReferenceAmountLabel({ kind, parentTitle }),
        value: `${khmdhsFmt} €`,
      });
    }
    if (apeFmt) {
      amountRows.push({
        label: 'Τελικό διαμορφωθέν (ΑΠΕ, με ΦΠΑ)',
        value: `${apeFmt} €`,
        highlight: true,
      });
    }
    if (amountRows.length) {
      out.push({ id: 'amounts', title: 'Ποσά', icon: '💰', rows: amountRows });
    }

    const sourceRows = [];
    if (fields.sourceAdam) {
      sourceRows.push({ label: 'ΑΔΑΜ ΚΗΜΔΗΣ', value: fields.sourceAdam, badge: true });
    }
    if (fields.diavgeiaAda) {
      sourceRows.push({ label: 'ΑΔΑ Διαύγειας', value: fields.diavgeiaAda, badge: true });
    }
    if (sourceRows.length) {
      out.push({ id: 'sources', title: 'Πηγές / αναφορές', icon: '🔗', rows: sourceRows });
    }

    if (fields.comments) {
      out.push({
        id: 'comments',
        title: 'Σχόλια',
        icon: '📝',
        rows: [{ label: 'Κείμενο', value: fields.comments, fullWidth: true }],
      });
    }

    if (fileRef.fileName) {
      const fileRows = [
        { label: 'Όνομα αρχείου', value: fileRef.fileName, highlight: true, fullWidth: true },
      ];
      if (fileRef.groupTitle) {
        fileRows.push({ label: 'Ομάδα αρχείων', value: fileRef.groupTitle });
      }
      out.push({ id: 'file', title: 'Αρχείο υποέργου', icon: '📎', rows: fileRows });
    }

    return out;
  }, [fields, fileRef]);

  const summaryChips = [];
  const apeFmt = formatApeAmountDisplay(fields.apeAmount);
  if (apeFmt) {
    summaryChips.push({ label: 'ΑΠΕ', value: `${apeFmt} €`, strong: true, highlight: true });
  }
  if (fields.diavgeiaAda) {
    summaryChips.push({ label: 'ΑΔΑ', value: fields.diavgeiaAda });
  }
  if (fields.sourceAdam) {
    summaryChips.push({ label: 'ΑΔΑΜ', value: fields.sourceAdam });
  }
  if (fileRef.fileName) {
    summaryChips.push({ label: 'Αρχείο', value: fileRef.fileName });
  }

  const title = parentTitle ? `ΑΠΕ — ${parentTitle}` : 'ΑΠΕ';
  const adaChip = fields.diavgeiaAda || fields.sourceAdam || '';

  return (
    <>
      <KhmdhsPanelDisplay
        themeKey="ape"
        title={`📑 ${title}`}
        adam={adaChip}
        subtitle={parentTitle ? `Σχετίζεται με: ${parentTitle}` : undefined}
        groups={groups}
        summaryChips={summaryChips}
        variant={variant}
        defaultExpanded={defaultExpanded}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
        {fields.diavgeiaAda ? (
          <LinkBtn
            type="button"
            onClick={() => openExternalUrl(
              `https://diavgeia.gov.gr/doc/${encodeURIComponent(fields.diavgeiaAda)}`
            )}
          >
            Άνοιγμα στη Διαύγεια
          </LinkBtn>
        ) : null}
        {fields.sourceAdam ? (
          <LinkBtn
            type="button"
            onClick={() => openExternalUrl(buildKhmdhsOpenUrl(fields.sourceAdam))}
          >
            Άνοιγμα στο ΚΗΜΔΗΣ
          </LinkBtn>
        ) : null}
      </div>
    </>
  );
}
