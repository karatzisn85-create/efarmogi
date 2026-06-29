import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { S, nowFormatted } from './ReportStyles';
import logoUrl from '../../assets/ergohub-logo.png';

export default function ReportHeader({ appConfig, reportTitle }) {
  const orgName = appConfig?.organizationFullName || appConfig?.organizationName || 'ΕΡΓΟHUB';
  const dept = appConfig?.department || '';
  const now = nowFormatted();

  return (
    <>
      <View style={S.headerBlock}>
        <Image src={logoUrl} style={S.headerLogo} cache={false} />
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>ERGOHUB</Text>
        </View>
        <View style={S.headerRight}>
          <Text style={S.headerOrgName}>{orgName}</Text>
          {dept ? <Text style={S.headerDept}>{dept}</Text> : null}
        </View>
      </View>
      <View style={S.reportTitleBar}>
        <Text style={S.reportTitle}>{reportTitle}</Text>
        <Text style={S.reportDate}>Ημ/νία εκτύπωσης: {now}</Text>
      </View>
    </>
  );
}
