import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { S } from './ReportStyles';

export default function ReportFooter() {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerLeft}>ERGOHUB</Text>
      <Text style={S.footerCenter}>ergohubapp@gmail.com</Text>
      <Text
        style={S.footerRight}
        render={({ pageNumber, totalPages }) => `Σελίδα ${pageNumber} από ${totalPages}`}
      />
    </View>
  );
}
