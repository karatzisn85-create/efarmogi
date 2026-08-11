import React from 'react';
import { Text } from '@react-pdf/renderer';
import { COLORS, PAGE_MARGIN_H, CONTINUATION_HEADER_H } from './ReportStyles';

/**
 * Λιτή κεφαλίδα σε κάθε σελίδα από τη 2η και μετά.
 * Η 1η σελίδα μένει ως έχει — το κείμενο εμφανίζεται μόνο όταν pageNumber > 1.
 */
export default function ReportContinuationHeader({ exportDate, subtitle }) {
  const dateLabel = exportDate || '';
  const sub = subtitle ? String(subtitle).trim() : '';

  return (
    <>
      <Text
        fixed
        style={{
          position: 'absolute',
          top: 8,
          left: PAGE_MARGIN_H,
          right: PAGE_MARGIN_H + 90,
          fontSize: 7,
          fontFamily: 'DejaVu',
          fontWeight: 'bold',
          color: COLORS.accent,
        }}
        render={({ pageNumber }) => {
          if (pageNumber <= 1) return '';
          return sub ? `ERGOHUB  ·  ${sub}` : 'ERGOHUB';
        }}
      />
      <Text
        fixed
        style={{
          position: 'absolute',
          top: 8,
          right: PAGE_MARGIN_H,
          fontSize: 6.5,
          color: COLORS.muted,
        }}
        render={({ pageNumber }) => (pageNumber > 1 ? `Εξαγωγή: ${dateLabel}` : '')}
      />
      <Text
        fixed
        style={{
          position: 'absolute',
          top: CONTINUATION_HEADER_H - 2,
          left: PAGE_MARGIN_H,
          right: PAGE_MARGIN_H,
          fontSize: 1,
          color: COLORS.hairline,
          borderBottom: `1px solid ${COLORS.hairline}`,
          paddingBottom: 0,
        }}
        render={({ pageNumber }) => (pageNumber > 1 ? ' ' : '')}
      />
    </>
  );
}
