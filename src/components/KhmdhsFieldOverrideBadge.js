import React from 'react';
import styled from 'styled-components';

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 0.4rem;
  padding: 0.1rem 0.42rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #1d4ed8;
  background: #dbeafe;
  border: 1px solid rgba(59, 130, 246, 0.4);
  vertical-align: middle;
`;

/** Μικρή ένδειξη ότι η τιμή πεδίου τροποποιήθηκε χειροκίνητα. */
export default function KhmdhsFieldOverrideBadge({ title = 'Τροποποιήθηκε από εσάς — προστατεύεται σε νέα ανάκτηση' }) {
  return (
    <Badge title={title}>
      δική σας τιμή
    </Badge>
  );
}
