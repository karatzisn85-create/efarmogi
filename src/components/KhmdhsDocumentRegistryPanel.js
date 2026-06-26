import React, { useMemo } from 'react';
import styled from 'styled-components';
import KhmdhsDocumentRegistryChainView from './KhmdhsDocumentRegistryChainView';
import { annotateRegistryLinkLabels } from '../utils/khmdhsDocumentRegistry';

const Wrap = styled.div`
  margin-bottom: 0.85rem;
`;

function KhmdhsDocumentRegistryPanel({ entries = [], headerTitle = 'Αλυσίδα ΚΗΜΔΗΣ' }) {
  const sorted = useMemo(() => annotateRegistryLinkLabels(entries), [entries]);
  if (!sorted.length) return null;

  return (
    <Wrap>
      <KhmdhsDocumentRegistryChainView
        entries={sorted}
        showHeader
        compactHeader={false}
        headerTitle={headerTitle}
      />
    </Wrap>
  );
}

export default KhmdhsDocumentRegistryPanel;
