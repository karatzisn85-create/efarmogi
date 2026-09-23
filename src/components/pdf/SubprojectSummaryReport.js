import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  COLORS, formatDate, formatAmount, statusColor, nowFormatted,
} from './ReportStyles';
import ReportFooter from './ReportFooter';
import ReportContinuationHeader from './ReportContinuationHeader';
import logoUrl from '../../assets/ergohub-logo.png';

const GREEK_ACCENTS = /[\u0300-\u036f]/g;

function toUpperGreekNoAccents(value) {
  if (value == null || value === '') return '';
  return String(value).normalize('NFD').replace(GREEK_ACCENTS, '').toUpperCase();
}

function pdfText(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    .replace(/[\u2600-\u27BF]/gu, '')
    .replace(/…/g, '...')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function clip(value, maxLen) {
  const s = pdfText(value);
  if (!s || s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}...`;
}

function filled(value) {
  const s = String(value ?? '').trim();
  return !!s && s !== '—';
}

function displayDate(value) {
  if (!filled(value)) return '';
  const formatted = formatDate(value);
  return formatted === '—' ? '' : formatted;
}

function money(value) {
  if (!filled(value)) return '';
  return formatAmount(value);
}

const STAGE_COLOR = {
  req: COLORS.amber,
  commit: COLORS.violet,
  proc: COLORS.accent,
  awrd: COLORS.purple,
  symv: COLORS.rose,
  pay: COLORS.slate,
  ape: COLORS.teal,
  supp: COLORS.green,
};

const S = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    backgroundColor: COLORS.pageBg,
    paddingTop: 28,
    paddingBottom: 42,
    paddingHorizontal: 32,
  },
  topRule: {
    height: 3,
    backgroundColor: COLORS.accent,
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: { width: 26, height: 26, objectFit: 'contain', marginRight: 8 },
  brandMark: {
    fontSize: 8,
    color: COLORS.accent,
    letterSpacing: 1.4,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  brandKind: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 1,
  },
  brandRight: { marginLeft: 'auto', alignItems: 'flex-end', maxWidth: 220 },
  org: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    textAlign: 'right',
  },
  dept: { fontSize: 6.5, color: COLORS.muted, textAlign: 'right', marginTop: 1 },
  date: { fontSize: 6.5, color: COLORS.muted, textAlign: 'right', marginTop: 2 },
  projectLine: { fontSize: 7, color: COLORS.muted, marginBottom: 2, lineHeight: 1.3 },
  title: {
    fontSize: 12,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.3,
    marginBottom: 5,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  badge: {
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  moneyRow: { flexDirection: 'row', gap: 5, marginBottom: 4 },
  moneyCell: {
    flex: 1,
    borderTop: `2px solid ${COLORS.accent}`,
    backgroundColor: COLORS.rowAlt,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  moneyLabel: {
    fontSize: 6,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  moneyVal: {
    fontSize: 8.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  extraMoney: { fontSize: 7, color: COLORS.mid, marginBottom: 6, lineHeight: 1.35 },
  section: { marginTop: 7, marginBottom: 1 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 2,
    marginBottom: 3,
    borderBottomWidth: 1.25,
    borderBottomStyle: 'solid',
  },
  sectionBar: { width: 3, height: 9, borderRadius: 1 },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    letterSpacing: 0.45,
  },
  grid: {
    borderTop: `1px solid ${COLORS.hairline}`,
    borderLeft: `1px solid ${COLORS.hairline}`,
    borderRight: `1px solid ${COLORS.hairline}`,
  },
  gridRow: { flexDirection: 'row', borderBottom: `1px solid ${COLORS.hairline}` },
  gridRowAlt: { backgroundColor: COLORS.rowAlt },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'flex-start' },
  cellFull: { width: '100%', flexDirection: 'row', alignItems: 'flex-start' },
  cellLabel: {
    width: 78,
    fontSize: 6.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingVertical: 2.5,
    paddingHorizontal: 5,
  },
  cellValue: {
    flex: 1,
    fontSize: 7.5,
    color: COLORS.dark,
    paddingVertical: 2.5,
    paddingRight: 5,
    lineHeight: 1.3,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
    paddingLeft: 5,
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
  },
  lineText: { flex: 1, fontSize: 7.5, color: COLORS.dark, lineHeight: 1.3 },
  prose: {
    fontSize: 7.5,
    color: COLORS.dark,
    lineHeight: 1.35,
    backgroundColor: COLORS.rowAlt,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 3,
  },
  proseLabel: {
    fontSize: 6.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    marginBottom: 1,
  },
  warn: {
    marginTop: 7,
    backgroundColor: COLORS.warnBg,
    borderLeft: `2.5px solid ${COLORS.warnBorder}`,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  warnTitle: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.warn,
    marginBottom: 2,
  },
  warnText: { fontSize: 7.5, color: COLORS.warn, lineHeight: 1.3, marginBottom: 1 },
});

function Section({ title, color, children }) {
  const tone = color || COLORS.accent;
  return (
    <View style={S.section} wrap>
      <View style={[S.sectionHead, { borderBottomColor: tone }]} wrap={false}>
        <View style={[S.sectionBar, { backgroundColor: tone }]} />
        <Text style={[S.sectionTitle, { color: tone }]}>{toUpperGreekNoAccents(title)}</Text>
      </View>
      {children}
    </View>
  );
}

function Grid({ rows }) {
  const list = (rows || []).filter((row) => row && row.length);
  if (!list.length) return null;
  return (
    <View style={S.grid}>
      {list.map((row, i) => (
        <View key={`r-${i}`} style={[S.gridRow, i % 2 === 1 ? S.gridRowAlt : null]} wrap={false}>
          {row.map((cell) => (
            <View key={cell.label} style={cell.full ? S.cellFull : S.cell}>
              <Text style={S.cellLabel}>{cell.label}</Text>
              <Text style={S.cellValue} wrap>{pdfText(cell.value)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function pair(items) {
  const filledItems = (items || []).filter((it) => it && filled(it.value));
  const rows = [];
  for (let i = 0; i < filledItems.length; i += 2) {
    const left = filledItems[i];
    const right = filledItems[i + 1];
    rows.push(right ? [left, right] : [{ ...left, full: true }]);
  }
  return rows;
}

function Line({ color, text }) {
  if (!filled(text)) return null;
  return (
    <View style={[S.line, { borderLeftColor: color || COLORS.accentMid }]} wrap={false}>
      <Text style={S.lineText} wrap>{pdfText(text)}</Text>
    </View>
  );
}

function joinBits(bits) {
  return bits.map((b) => pdfText(b)).filter(filled).join('  ·  ');
}

function chainExtraValues(item) {
  const ranked = (item?.fields || [])
    .filter((field) => filled(field?.value))
    .map((field) => {
      const label = String(field.label || '');
      let rank = 1;
      if (/ποσ|π\/υ|απε|σύνολο|αξία|προθεσμ/i.test(label)) rank = 3;
      else if (/ανάδοχ/i.test(label)) rank = 2;
      else if (/τελ\.?\s*λήψη|^αδαμ$/i.test(label)) rank = -1;
      return { value: clip(field.value, 42), rank };
    })
    .filter((field) => field.rank >= 0 && filled(field.value));
  ranked.sort((a, b) => b.rank - a.rank);
  const seen = new Set();
  const out = [];
  ranked.forEach((field) => {
    if (out.length >= 2 || seen.has(field.value)) return;
    if (item?.adam && field.value === pdfText(item.adam)) return;
    seen.add(field.value);
    out.push(field.value);
  });
  return out;
}

function chainLine(item) {
  return joinBits([
    item?.stageName,
    displayDate(item?.dateLabel),
    item?.adam,
    ...chainExtraValues(item),
    item?.cancelled ? 'ακυρώθηκε' : '',
  ]);
}

function contractLine(prefix, row) {
  return joinBits([
    prefix,
    displayDate(row?.date),
    money(row?.amount),
    row?.apeAmount ? `ΑΠΕ ${money(row.apeAmount)}` : '',
    row?.khmdhsAnadoxos || row?.contractor,
    row?.khmdhsAdam || row?.adam ? `ΑΔΑΜ ${row.khmdhsAdam || row.adam}` : '',
  ]);
}

function moneyCells(basic, paymentSummary) {
  const cells = [];
  if (filled(basic.approvedAmount)) {
    cells.push({ label: 'ΕΓΚΕΚΡΙΜΕΝΟ', value: money(basic.approvedAmount) });
  }
  const isMulti = !!basic.isMultipleContracts;
  const contractRaw = isMulti
    ? (basic.totalContractAmount > 0 ? basic.totalContractAmount : basic.contractAmount)
    : (basic.contractAmount || (basic.totalContractAmount > 0 ? basic.totalContractAmount : ''));
  if (filled(contractRaw) || (typeof contractRaw === 'number' && contractRaw > 0)) {
    cells.push({
      label: isMulti ? 'ΑΘΡΟΙΣΜΑ ΣΥΜΒΑΣΕΩΝ' : 'ΠΟΣΟ ΣΥΜΒΑΣΗΣ',
      value: money(contractRaw),
    });
  }
  if (basic.hasFinalContractAmountAfterApe && filled(basic.finalContractAmountAfterApe)) {
    cells.push({ label: 'ΤΕΛΙΚΟΣ ΑΠΕ', value: money(basic.finalContractAmountAfterApe) });
  }
  if (paymentSummary?.hasPayments && filled(paymentSummary.paidAmountLabel)) {
    cells.push({ label: 'ΠΛΗΡΩΜΕΝΟ', value: paymentSummary.paidAmountLabel });
  }
  if (filled(basic.projectBudget)) {
    cells.push({ label: 'ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ', value: money(basic.projectBudget) });
  }
  if (filled(basic.remainingAmount)) {
    cells.push({
      label: basic.remainingAmountYear ? `ΥΠΟΛΟΙΠΑ ${basic.remainingAmountYear}` : 'ΥΠΟΛΟΙΠΑ',
      value: money(basic.remainingAmount),
    });
  }
  const shown = cells.slice(0, 4);
  const extra = cells.slice(4);
  return { shown, extra };
}

function aleDisplay(basic) {
  const codes = (basic?.aleCodes || []).map((c) => String(c || '').trim()).filter(Boolean);
  return codes.join(' · ');
}

export default function SubprojectSummaryReport({ data, appConfig }) {
  const {
    basic = {},
    entaxeis = [],
    proskliseis = [],
    egkriseis = [],
    egkrisiLinks = [],
    linkedNotes = [],
    complianceWarnings = [],
    meleti = null,
    paymentSummary = null,
    chronologicalTimeline = [],
  } = data || {};

  const exportDate = nowFormatted();
  const orgName = appConfig?.organizationFullName || appConfig?.organizationName || 'ERGOHUB';
  const dept = appConfig?.department || '';
  const sc = statusColor(basic.projectStatus || '');
  const { shown, extra } = moneyCells(basic, paymentSummary);
  const stages = (chronologicalTimeline || []).filter(Boolean);

  const identity = pair([
    basic.kaCode ? { label: 'Κωδικός ΚΑ', value: basic.kaCode } : null,
    basic.fundingSource ? { label: 'Χρηματοδότηση', value: basic.fundingSource } : null,
    basic.fundingDetails ? { label: 'Εξειδίκευση', value: basic.fundingDetails } : null,
    aleDisplay(basic) ? { label: 'Α.Λ.Ε.', value: aleDisplay(basic) } : null,
    basic.misPraxhsCode
      ? { label: basic.misPraxhsName || 'MIS', value: basic.misPraxhsCode }
      : null,
    basic.displayChargePrimary ? { label: 'Επιβλέπων', value: basic.displayChargePrimary } : null,
    basic.displayChargeParticipants ? { label: 'Βοηθούν', value: basic.displayChargeParticipants } : null,
    basic.assignmentProcedure
      ? {
        label: 'Ανάθεση',
        value: basic.assignmentFromKhmdhs
          ? `${basic.assignmentProcedure} (ΚΗΜΔΗΣ)`
          : basic.assignmentProcedure,
      }
      : null,
    basic.contractProcessStartDate
      ? { label: 'Έναρξη διαδικ.', value: displayDate(basic.contractProcessStartDate) }
      : null,
    basic.updatedAt ? { label: 'Ενημέρωση', value: displayDate(basic.updatedAt) } : null,
  ]);

  const singleContract = !basic.isMultipleContracts && (
    basic.contractDate || basic.contractAmount || basic.khmdhsAdam
    || basic.khmdhsContractSnapshot?.anadoxosName
  );
  const contractor = basic.khmdhsContractSnapshot?.anadoxosName
    || basic.contracts?.[0]?.khmdhsAnadoxos
    || '';
  const suppEntries = (basic.supplementaryStageEntries || []).length
    ? basic.supplementaryStageEntries
    : (basic.supplementaryContracts || []);

  const paymentBits = joinBits([
    paymentSummary?.hasPayments && filled(paymentSummary.paidAmountLabel)
      ? `Πληρωμένο ${paymentSummary.paidAmountLabel}`
      : '',
    paymentSummary?.hasContract && filled(paymentSummary.remainingLabel)
      ? `Υπόλοιπο σύμβασης ${paymentSummary.remainingLabel}`
      : '',
    paymentSummary?.paymentCount > 0 ? `${paymentSummary.paymentCount} εντάλματα` : '',
  ]);

  const badges = [
    basic.projectStatus ? { text: basic.projectStatus, bg: sc.bg, color: sc.text } : null,
    basic.projectType ? { text: basic.projectType, bg: COLORS.skyLight, color: COLORS.sky } : null,
    basic.characterization ? { text: basic.characterization, bg: COLORS.amberLight, color: COLORS.amber } : null,
    basic.implementationForm ? { text: basic.implementationForm, bg: COLORS.rowAlt, color: COLORS.mid } : null,
  ].filter(Boolean);

  const hasContractBlock = singleContract
    || (basic.contracts || []).length > 0
    || suppEntries.length > 0
    || filled(paymentBits)
    || (basic.hasFinalContractAmountAfterApe && filled(basic.finalContractAmountAfterApe));

  return (
    <Document
      title={`ERGOHUB — Συνοπτική — ${basic.subprojectTitle || ''}`}
      author="ERGOHUB"
      subject="Συνοπτική αναφορά υποέργου"
    >
      <Page size="A4" style={S.page} wrap>
        <ReportContinuationHeader
          exportDate={exportDate}
          subtitle={clip(basic.subprojectTitle, 52)}
        />
        <View style={S.topRule} />
        <View style={S.brandRow} wrap={false}>
          <Image src={logoUrl} style={S.logo} cache={false} />
          <View>
            <Text style={S.brandMark}>ERGOHUB</Text>
            <Text style={S.brandKind}>{toUpperGreekNoAccents('Συνοπτική αναφορά υποέργου')}</Text>
          </View>
          <View style={S.brandRight}>
            <Text style={S.org}>{pdfText(orgName)}</Text>
            {dept ? <Text style={S.dept}>{pdfText(dept)}</Text> : null}
            <Text style={S.date}>{exportDate}</Text>
          </View>
        </View>

        {basic.projectTitle ? (
          <Text style={S.projectLine} wrap>Πράξη: {pdfText(basic.projectTitle)}</Text>
        ) : null}
        <Text style={S.title} wrap>{pdfText(basic.subprojectTitle) || 'Υποέργο'}</Text>

        {badges.length ? (
          <View style={S.badges}>
            {badges.map((b) => (
              <Text key={b.text} style={[S.badge, { backgroundColor: b.bg, color: b.color }]}>
                {pdfText(b.text)}
              </Text>
            ))}
          </View>
        ) : null}

        {shown.length ? (
          <View style={S.moneyRow} wrap={false}>
            {shown.map((cell) => (
              <View key={cell.label} style={S.moneyCell}>
                <Text style={S.moneyLabel}>{cell.label}</Text>
                <Text style={S.moneyVal}>{cell.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {extra.length ? (
          <Text style={S.extraMoney} wrap>
            {extra.map((cell) => `${cell.label}: ${cell.value}`).join('   ·   ')}
          </Text>
        ) : null}

        {identity.length ? (
          <Section title="Στοιχεία υποέργου" color={COLORS.accent}>
            <Grid rows={identity} />
          </Section>
        ) : null}

        {hasContractBlock ? (
          <Section title="Σύμβαση και εκτέλεση" color={COLORS.green}>
            {singleContract ? (
              <Line
                color={COLORS.greenMid}
                text={joinBits([
                  displayDate(basic.contractDate),
                  money(basic.contractAmount),
                  basic.apeAmount ? `ΑΠΕ ${money(basic.apeAmount)}` : '',
                  basic.hasFinalContractAmountAfterApe
                    ? `Τελικό ${money(basic.finalContractAmountAfterApe)}${basic.finalContractApeDate ? ` (${displayDate(basic.finalContractApeDate)})` : ''}`
                    : '',
                  contractor,
                  basic.khmdhsAdam ? `ΑΔΑΜ ${basic.khmdhsAdam}` : '',
                ])}
              />
            ) : null}
            {(basic.isMultipleContracts ? basic.contracts || [] : []).map((c, i) => (
              <Line key={`c-${i}`} color={COLORS.greenMid} text={contractLine(`Σύμβαση ${i + 1}`, c)} />
            ))}
            {basic.isMultipleContracts && basic.hasFinalContractAmountAfterApe ? (
              <Line
                color={COLORS.teal}
                text={joinBits([
                  'Τελικό μετά ΑΠΕ',
                  money(basic.finalContractAmountAfterApe),
                  displayDate(basic.finalContractApeDate),
                ])}
              />
            ) : null}
            {suppEntries.map((entry, i) => (
              <Line
                key={`s-${entry.adam || i}`}
                color={entry.isExtension ? COLORS.purple : COLORS.green}
                text={contractLine(entry.title || `Συμπληρωματική ${i + 1}`, entry)}
              />
            ))}
            {filled(paymentBits) ? <Line color={COLORS.slateMid} text={paymentBits} /> : null}
          </Section>
        ) : null}

        {stages.length ? (
          <Section title={`Πορεία ΚΗΜΔΗΣ · ${stages.length}`} color={COLORS.amber}>
            {stages.map((item, i) => (
              <Line
                key={`${item.type || 'st'}-${i}`}
                color={STAGE_COLOR[item.themeKey] || COLORS.amber}
                text={chainLine(item)}
              />
            ))}
          </Section>
        ) : null}

        {entaxeis.length ? (
          <Section title={`Εντάξεις · ${entaxeis.length}`} color={COLORS.sky}>
            {entaxeis.map((e, i) => (
              <Line
                key={e.entaxiId || i}
                color={COLORS.skyMid}
                text={joinBits([
                  e.fundingAuthority || `Ένταξη ${i + 1}`,
                  displayDate(e.documentDate),
                  e.currentAmount ? money(e.currentAmount) : money(e.initialAmount),
                  (e.modifications || []).length
                    ? `${e.modifications.length} τροποποιήσεις`
                    : '',
                  clip(e.subject, 70),
                ])}
              />
            ))}
          </Section>
        ) : null}

        {proskliseis.length ? (
          <Section title={`Προσκλήσεις · ${proskliseis.length}`} color={COLORS.violet}>
            {proskliseis.map((p, i) => (
              <Line
                key={p.prosklisiId || i}
                color={COLORS.violetMid}
                text={joinBits([
                  p.title || `Πρόσκληση ${i + 1}`,
                  p.status,
                  p.deadline ? `λήξη ${displayDate(p.deadline)}` : '',
                  p.code,
                  (p.modifications || []).length ? `${p.modifications.length} τροποποιήσεις` : '',
                ])}
              />
            ))}
          </Section>
        ) : null}

        {(egkriseis.length || egkrisiLinks.length) ? (
          <Section
            title={`Εγκρίσεις πίστωσης · ${egkriseis.length + egkrisiLinks.length}`}
            color={COLORS.teal}
          >
            {egkriseis.map((eg, i) => (
              <Line
                key={eg.id || `eg-${i}`}
                color={COLORS.tealMid}
                text={joinBits([
                  eg.type || 'Έγκριση',
                  displayDate(eg.date),
                  clip(eg.fileName, 48),
                ])}
              />
            ))}
            {egkrisiLinks.map((l, i) => (
              <Line
                key={`lnk-${i}`}
                color={COLORS.tealMid}
                text={joinBits([l.egkrisiTitle || 'Συνδεδεμένη έγκριση', l.autoLinked ? 'αυτόματη' : ''])}
              />
            ))}
          </Section>
        ) : null}

        {meleti ? (
          <Section title="Μελέτη" color={COLORS.purple}>
            <Line
              color={COLORS.purpleMid}
              text={joinBits([
                meleti.studyNumber ? `Αρ. ${meleti.studyNumber}` : '',
                meleti.category,
                meleti.title,
                meleti.assignedTo,
                meleti.fileCount > 0 ? `${meleti.fileCount} αρχεία` : '',
              ])}
            />
          </Section>
        ) : null}

        {(basic.comments || basic.eisigitikiEkthesi || linkedNotes.length) ? (
          <Section title="Σημειώσεις" color={COLORS.slate}>
            {basic.comments ? (
              <View wrap>
                <Text style={S.proseLabel}>Σχόλια υποέργου</Text>
                <Text style={S.prose} wrap>{pdfText(basic.comments)}</Text>
              </View>
            ) : null}
            {basic.eisigitikiEkthesi ? (
              <View wrap>
                <Text style={S.proseLabel}>Αναφορά από πρόγραμμα Οικονομικής</Text>
                <Text style={S.prose} wrap>{pdfText(basic.eisigitikiEkthesi)}</Text>
              </View>
            ) : null}
            {linkedNotes.map((n, i) => (
              <View key={`n-${i}`} wrap>
                <Text style={S.proseLabel}>
                  {joinBits([n.title || 'Σημείωση', displayDate(n.updatedAt)])}
                </Text>
                {filled(n.content) ? (
                  <Text style={S.prose} wrap>{pdfText(n.content)}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {complianceWarnings.length ? (
          <View style={S.warn} wrap>
            <Text style={S.warnTitle}>{toUpperGreekNoAccents('Σημείωση συμμόρφωσης')}</Text>
            {complianceWarnings.map((w, i) => (
              <Text key={`w-${i}`} style={S.warnText} wrap>{pdfText(w)}</Text>
            ))}
          </View>
        ) : null}

        <ReportFooter />
      </Page>
    </Document>
  );
}
