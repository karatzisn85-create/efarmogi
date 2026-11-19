import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { COLORS } from './ReportStyles';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: 'DejaVu',
    fontSize: 10,
    color: COLORS.dark,
  },
  band: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#e0e7ff',
    fontSize: 9,
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    paddingVertical: 6,
  },
  rowAlt: {
    backgroundColor: COLORS.rowAlt,
  },
  label: {
    width: 150,
    color: COLORS.muted,
    fontSize: 9,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
});

export default function FolderRecordPdf({ title = '', subtitle = '', rows = [] }) {
  const list = (rows || []).filter((row) => row && String(row.value || '').trim());
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          <Text style={styles.title}>{title || 'Καταγραφή'}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {list.map((row, index) => (
          <View key={`${row.label}-${index}`} style={[styles.row, index % 2 ? styles.rowAlt : null]}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{String(row.value)}</Text>
          </View>
        ))}
        {!list.length ? <Text style={styles.value}>Δεν καταγράφηκαν πρόσθετα στοιχεία.</Text> : null}
      </Page>
    </Document>
  );
}
