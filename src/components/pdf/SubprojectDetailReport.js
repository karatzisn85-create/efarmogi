import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { S, COLORS, formatDate, formatAmount, statusColor, CONTINUATION_HEADER_H, PAGE_MARGIN_TOP, nowFormatted } from './ReportStyles';
import ReportHeader from './ReportHeader';
import ReportFooter from './ReportFooter';
import ReportContinuationHeader from './ReportContinuationHeader';

/** Ονόματα σταδίων αλυσίδας — χωρίς εσωτερικούς κωδικούς (REQ, COMMIT κ.λπ.) */
const CHAIN_STAGE_NAMES = {
  req: 'Πρωτογενές αίτημα',
  commit: 'Απόφαση ανάληψης υποχρέωσης',
  proc: 'Προκήρυξη / Πρόσκληση',
  awrd: 'Ανάθεση',
  symv: 'Σύμβαση',
  supp: 'Συμπληρωματική σύμβαση',
  ape: 'ΑΠΕ',
  pay: 'Εντάλματα πληρωμής',
};

function formatReportAleCodes(basic) {
  const codes = (basic?.aleCodes || []).filter((c) => c && String(c).trim());
  return codes.length ? codes.join(' · ') : '';
}

function commitStageName(index, total) {
  if (total <= 1) return CHAIN_STAGE_NAMES.commit;
  return `${CHAIN_STAGE_NAMES.commit} (${index + 1}/${total})`;
}

/** DejaVu δεν υποστηρίζει emoji — αφαίρεση για καθαρή εμφάνιση στο PDF */
function pdfText(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    .replace(/[\u2600-\u27BF]/gu, '')
    .replace(/…/g, '...')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function countEgkriseis(egkriseis, egkrisiLinks) {
  return (egkriseis?.length || 0) + (egkrisiLinks?.length || 0);
}

// ── Per-section theme palette (color, lightBg, midBorder) ────────────────────
const THEME = {
  identity:   { color: COLORS.accent,  light: COLORS.accentLight,  mid: COLORS.accentMid  },
  codes:      { color: COLORS.sky,     light: COLORS.skyLight,     mid: COLORS.skyMid     },
  funding:    { color: COLORS.green,   light: COLORS.greenLight,   mid: COLORS.greenMid   },
  procedure:  { color: COLORS.teal,    light: COLORS.tealLight,    mid: COLORS.tealMid    },
  req:        { color: COLORS.amber,   light: COLORS.amberLight,   mid: COLORS.amberMid   },
  commit:     { color: COLORS.violet,  light: COLORS.violetLight,  mid: COLORS.violetMid  },
  proc:       { color: COLORS.accent,  light: COLORS.accentLight,  mid: COLORS.accentMid  },
  awrd:       { color: COLORS.purple,  light: COLORS.purpleLight,  mid: COLORS.purpleMid  },
  symv:       { color: COLORS.rose,    light: COLORS.roseLight,    mid: COLORS.roseMid    },
  pay:        { color: COLORS.slate,   light: COLORS.slateLight,   mid: COLORS.slateMid   },
  entaxeis:   { color: COLORS.teal,    light: COLORS.tealLight,    mid: COLORS.tealMid    },
  proskliseis:{ color: COLORS.sky,     light: COLORS.skyLight,     mid: COLORS.skyMid     },
  egkriseis:  { color: COLORS.amber,   light: COLORS.amberLight,   mid: COLORS.amberMid   },
  ep:         { color: COLORS.accent,  light: COLORS.accentLight,  mid: COLORS.accentMid  },
  files:      { color: COLORS.slate,   light: COLORS.slateLight,   mid: COLORS.slateMid   },
  notes:      { color: COLORS.muted,   light: COLORS.rowAlt,       mid: COLORS.hairline   },
  warn:       { color: COLORS.warn,    light: COLORS.warnBg,       mid: COLORS.warnBorder },
};

const D = StyleSheet.create({
  content: { paddingTop: 2, paddingBottom: 4 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    borderLeft: `4px solid ${COLORS.accent}`,
    borderTop: `1px solid ${COLORS.accentMid}`,
    borderRight: `1px solid ${COLORS.accentMid}`,
    borderBottom: `1px solid ${COLORS.accentMid}`,
    borderRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 10,
    backgroundColor: COLORS.accentLight,
  },
  heroLabel: {
    fontSize: 6.5,
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  heroTitle: {
    fontSize: 13,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
    marginBottom: 6,
  },
  heroBadgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 5 },
  heroBadge: {
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  heroAmountsRow: { flexDirection: 'row', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  heroAmountCell: {
    borderLeft: `2px solid ${COLORS.accentMid}`,
    paddingLeft: 7,
  },
  heroAmountLabel: { fontSize: 6, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  heroAmountVal:   { fontSize: 10, fontFamily: 'DejaVu', fontWeight: 'bold', color: COLORS.dark },
  heroMeta:   { fontSize: 6.5, color: COLORS.light, marginTop: 5 },

  // ── Stats row ─────────────────────────────────────────────────────────────
  statsRow:   { flexDirection: 'row', gap: 6, marginBottom: 11 },
  miniStat: {
    flex: 1,
    border: `1px solid ${COLORS.hairline}`,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 7,
    alignItems: 'center',
  },
  miniStatVal: { fontSize: 13, fontFamily: 'DejaVu', fontWeight: 'bold', color: COLORS.dark },
  miniStatLbl: { fontSize: 6, color: COLORS.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    marginBottom: 10,
    border: `1px solid ${COLORS.hairline}`,
    borderRadius: 4,
    width: '100%',
  },
  sectionHead: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeadDot: { width: 6, height: 6, borderRadius: 3 },
  sectionHeadText: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flex: 1,
  },
  sectionBody: { paddingHorizontal: 10, paddingVertical: 8 },

  // ── KV grid ───────────────────────────────────────────────────────────────
  kvGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  kvRow:     { width: '50%', flexDirection: 'row', paddingVertical: 4, borderBottom: `1px solid ${COLORS.hairline}`, alignItems: 'flex-start' },
  kvRowFull: { width: '100%', flexDirection: 'row', paddingVertical: 4, borderBottom: `1px solid ${COLORS.hairline}`, alignItems: 'flex-start' },
  kvLabel:   { width: '38%', fontSize: 7, color: COLORS.muted, fontFamily: 'DejaVu', fontWeight: 'bold', paddingRight: 8, lineHeight: 1.45 },
  kvValue:   { flex: 1, fontSize: 7.5, color: COLORS.dark, lineHeight: 1.55 },

  // ── Entity / sub-block ────────────────────────────────────────────────────
  entityBlock: {
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 8,
    paddingBottom: 4,
  },
  entityTitle: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.mid,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  entityRow:    { flexDirection: 'row', paddingVertical: 3.5, borderBottom: `1px solid ${COLORS.hairline}`, alignItems: 'flex-start' },
  entityLabel:  { width: '30%', fontSize: 7, color: COLORS.muted, fontFamily: 'DejaVu', fontWeight: 'bold', paddingRight: 8, lineHeight: 1.45 },
  entityValue:  { flex: 1, fontSize: 7.5, color: COLORS.dark, lineHeight: 1.55 },

  // ── Modification block (nested) ───────────────────────────────────────────
  modBlock: {
    marginTop: 5,
    marginLeft: 4,
    borderLeft: `2px solid ${COLORS.hairline}`,
    paddingLeft: 7,
    paddingBottom: 2,
  },
  modTitle: {
    fontSize: 7, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: COLORS.muted, marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  modRow:   { flexDirection: 'row', paddingVertical: 2 },
  modLabel: { width: '35%', fontSize: 6.5, color: COLORS.muted, fontFamily: 'DejaVu', fontWeight: 'bold', paddingRight: 4 },
  modValue: { flex: 1, fontSize: 7, color: COLORS.dark, lineHeight: 1.3 },

  // ── KHMDHS chain stage ────────────────────────────────────────────────────
  chainStage: {
    marginBottom: 7,
    borderRadius: 3,
    overflow: 'hidden',
  },
  chainStageHead: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chainStageHeadTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  chainStageName: {
    fontSize: 7,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    flex: 1,
  },
  chainStageLabel: {
    fontSize: 6,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    letterSpacing: 0.3,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 2,
  },
  chainStageTitle: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    lineHeight: 1.55,
    marginTop: 4,
    marginBottom: 2,
  },
  chainStageAdam: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    letterSpacing: 0.3,
    flexShrink: 0,
    maxWidth: '42%',
    textAlign: 'right',
  },
  chainStageBody: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 7,
  },
  chainRow: {
    flexDirection: 'row',
    paddingVertical: 3.5,
    borderBottom: `1px solid ${COLORS.hairline}`,
    alignItems: 'flex-start',
  },
  chainLabel: {
    width: '32%',
    fontSize: 6.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingRight: 6,
    lineHeight: 1.45,
  },
  chainValue: { flex: 1, fontSize: 7, color: COLORS.dark, lineHeight: 1.5 },
  chainSummary: {
    marginBottom: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 3,
    backgroundColor: COLORS.accentLight,
    border: `1px solid ${COLORS.accentMid}`,
  },
  chainSummaryTitle: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  paymentPanel: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 3,
    backgroundColor: COLORS.greenLight,
    border: `1px solid ${COLORS.greenMid}`,
  },
  paymentPanelTitle: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.green,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.hairline,
    borderRadius: 4,
    marginTop: 5,
    marginBottom: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    backgroundColor: COLORS.green,
    borderRadius: 4,
  },
  gapItem: {
    fontSize: 7.5,
    lineHeight: 1.5,
    paddingVertical: 2.5,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  timelineCompactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  timelineCompactDate: {
    width: '17%',
    fontSize: 6.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  timelineCompactStage: {
    width: '30%',
    fontSize: 6.5,
    color: COLORS.accent,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    lineHeight: 1.4,
    paddingRight: 4,
  },
  timelineCompactBody: {
    flex: 1,
    fontSize: 7,
    color: COLORS.dark,
    lineHeight: 1.45,
  },
  execBlock: {
    border: `1px solid ${COLORS.accentMid}`,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 9,
    backgroundColor: COLORS.accentLight,
  },
  execTitle: {
    fontSize: 12,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
    marginBottom: 4,
  },
  execSubtitle: {
    fontSize: 7,
    color: COLORS.muted,
    marginBottom: 6,
  },
  fileIndex: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.slate,
    width: 16,
  },

  // ── Pay table ─────────────────────────────────────────────────────────────
  payHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: `1px solid ${COLORS.slateMid}`,
  },
  payHeaderCell: {
    fontSize: 6.5, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: COLORS.slate, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  payRow:  { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6, borderBottom: `1px solid ${COLORS.hairline}` },
  payCell: { fontSize: 7, color: COLORS.dark },
  payTotalRow: {
    flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6,
    backgroundColor: COLORS.slateLight, borderTop: `1px solid ${COLORS.slateMid}`,
  },

  // ── Warnings ──────────────────────────────────────────────────────────────
  warnBox: {
    border: `1px solid ${COLORS.warnBorder}`,
    backgroundColor: COLORS.warnBg,
    borderLeft: `3px solid ${COLORS.warnBorder}`,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  warnText: { fontSize: 7.5, color: COLORS.warn, lineHeight: 1.45 },

  // ── Misc ──────────────────────────────────────────────────────────────────
  emptyNote: { fontSize: 7.5, color: COLORS.light, fontStyle: 'italic', paddingVertical: 4 },
  fileGroup: { marginBottom: 7, paddingBottom: 4, borderBottom: `1px solid ${COLORS.hairline}` },
  fileGroupTitle: { fontSize: 7.5, fontFamily: 'DejaVu', fontWeight: 'bold', color: COLORS.mid, marginBottom: 4 },
  fileItem: { fontSize: 7, color: COLORS.dark, paddingVertical: 2.5, paddingLeft: 6, lineHeight: 1.55 },
  groupTitle: {
    fontSize: 7, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: COLORS.mid, marginTop: 5, marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  proseBlock: {
    fontSize: 7.5, color: COLORS.dark, lineHeight: 1.5,
    marginTop: 4, paddingVertical: 5, paddingHorizontal: 7,
    backgroundColor: COLORS.rowAlt, borderRadius: 3,
    border: `1px solid ${COLORS.hairline}`,
  },
  cancelledBadge: {
    fontSize: 6.5, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: '#b91c1c', backgroundColor: '#fff1f2',
    borderRadius: 2, paddingVertical: 1, paddingHorizontal: 4,
    alignSelf: 'flex-start', marginTop: 2,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function v(val) { return (val == null || val === '') ? '—' : pdfText(String(val)); }

function normalizeChainText(text) {
  return pdfText(text).replace(/\s+/g, ' ').trim().toUpperCase();
}

function buildChainContext(khmdhsChain, basic) {
  const rawTitles = [];
  const rawOrgs = [];
  if (khmdhsChain?.req?.title) rawTitles.push(khmdhsChain.req.title);
  (khmdhsChain?.commit || []).forEach((d) => {
    if (d.title) rawTitles.push(d.title);
  });
  if (khmdhsChain?.awrd?.title) rawTitles.push(khmdhsChain.awrd.title);
  if (khmdhsChain?.req?.organization) rawOrgs.push(khmdhsChain.req.organization);
  (khmdhsChain?.commit || []).forEach((d) => {
    if (d.organization) rawOrgs.push(d.organization);
  });
  if (khmdhsChain?.awrd?.organization) rawOrgs.push(khmdhsChain.awrd.organization);

  const uniqueTitles = [...new Set(rawTitles.map(normalizeChainText).filter(Boolean))];
  const uniqueOrgs = [...new Set(rawOrgs.map(normalizeChainText).filter(Boolean))];

  const contractor = basic?.khmdhsContractSnapshot?.anadoxosName
    || khmdhsChain?.awrd?.contractor
    || '';
  const contractorVat = basic?.khmdhsContractSnapshot?.anadoxosVat
    || khmdhsChain?.awrd?.contractorVat
    || '';

  return {
    commonTitle: uniqueTitles.length === 1 ? rawTitles[0] : '',
    commonOrganization: uniqueOrgs.length === 1 ? rawOrgs[0] : '',
    contractor,
    contractorVat,
  };
}

function shouldShowChainOrganization(org, commonOrganization) {
  if (!org) return false;
  if (!commonOrganization) return true;
  return normalizeChainText(org) !== normalizeChainText(commonOrganization);
}

/** Key-value pair in a 2-column grid */
function Kv({ label, value, full }) {
  return (
    <View style={full ? D.kvRowFull : D.kvRow} wrap>
      <Text style={D.kvLabel}>{label}</Text>
      <Text style={D.kvValue} wrap>{v(value)}</Text>
    </View>
  );
}

/** Key-value inside entity block */
function EKv({ label, value }) {
  return (
    <View style={D.entityRow} wrap>
      <Text style={D.entityLabel}>{label}</Text>
      <Text style={D.entityValue} wrap>{v(value)}</Text>
    </View>
  );
}

/** Key-value inside modification block */
function MKv({ label, value }) {
  return (
    <View style={D.modRow} wrap>
      <Text style={D.modLabel}>{label}</Text>
      <Text style={D.modValue} wrap>{v(value)}</Text>
    </View>
  );
}

/** Key-value inside KHMDHS chain stage */
function CKv({ label, value }) {
  return (
    <View style={D.chainRow} wrap>
      <Text style={D.chainLabel}>{label}</Text>
      <Text style={D.chainValue} wrap>{v(value)}</Text>
    </View>
  );
}

/**
 * Generic section with colored header.
 * @param {string} themeKey - key in THEME object
 */
function Section({ title, themeKey = 'identity', children, extra }) {
  const t = THEME[themeKey] || THEME.identity;
  return (
    <View style={D.section} wrap minPresenceAhead={24}>
      <View style={[D.sectionHead, { backgroundColor: t.light, borderBottom: `1px solid ${t.mid}` }]} wrap={false}>
        <View style={[D.sectionHeadDot, { backgroundColor: t.color }]} />
        <Text style={[D.sectionHeadText, { color: t.color }]}>{title}</Text>
        {extra ? <Text style={{ fontSize: 7, color: t.color }}>{extra}</Text> : null}
      </View>
      <View style={D.sectionBody}>{children}</View>
    </View>
  );
}

/** Mini stat card with colored top border */
function MiniStat({ value, label, color }) {
  return (
    <View style={[D.miniStat, { borderTop: `2px solid ${color || COLORS.accent}` }]}>
      <Text style={[D.miniStatVal, { color: color || COLORS.dark }]}>{value}</Text>
      <Text style={D.miniStatLbl}>{label}</Text>
    </View>
  );
}

// ── KHMDHS chain stage component ─────────────────────────────────────────────

function ChainStage({ stageName, title, adam, colour, light, mid, children, cancelled, hideTitle }) {
  const showTitle = !hideTitle && title && title !== stageName;
  return (
    <View style={[D.chainStage, { border: `1px solid ${mid}`, borderLeft: `3px solid ${colour}` }]} wrap>
      <View style={[D.chainStageHead, { backgroundColor: light }]}>
        <View style={D.chainStageHeadTop}>
          <Text style={[D.chainStageName, { color: colour }]}>{stageName}</Text>
          {adam ? <Text style={[D.chainStageAdam, { color: colour }]} wrap>{adam}</Text> : null}
        </View>
        {showTitle ? (
          <Text style={[D.chainStageTitle, { color: cancelled ? '#b91c1c' : COLORS.dark }]} wrap>
            {pdfText(title)}{cancelled ? '  [ΑΚΥΡΩΜΕΝΟ]' : ''}
          </Text>
        ) : cancelled ? (
          <Text style={[D.chainStageTitle, { color: '#b91c1c' }]}>[ΑΚΥΡΩΜΕΝΟ]</Text>
        ) : null}
      </View>
      <View style={D.chainStageBody}>{children}</View>
    </View>
  );
}

function themeColors(themeKey) {
  const t = THEME[themeKey] || THEME.proc;
  return { color: t.color, light: t.light, mid: t.mid };
}

function PaymentSummaryPanel({ paymentSummary }) {
  if (!paymentSummary?.hasContract && !paymentSummary?.hasPayments) return null;
  const pct = paymentSummary.percentPaid ?? 0;
  return (
    <View style={D.paymentPanel} wrap>
      <Text style={D.paymentPanelTitle}>Σύνοψη πληρωμών έναντι σύμβασης</Text>
      <CKv label="Ποσό σύμβασης" value={paymentSummary.contractAmountLabel} />
      <CKv label="Πληρωμένο" value={paymentSummary.paidAmountLabel} />
      <CKv label="Υπόλοιπο" value={paymentSummary.remainingLabel} />
      <CKv label="Πρόοδος" value={paymentSummary.percentPaidLabel} />
      {paymentSummary.percentPaid != null ? (
        <View style={D.progressTrack}>
          <View style={[D.progressFill, { width: `${Math.max(4, Math.min(100, pct))}%` }]} />
        </View>
      ) : null}
      <CKv label="Εντάλματα" value={String(paymentSummary.paymentCount || 0)} />
    </View>
  );
}

function CompletenessSection({ gaps }) {
  if (!gaps?.length) return null;
  return (
    <Section title={`Δείκτης πληρότητας (${gaps.length})`} themeKey="warn">
      {gaps.map((g, i) => (
        <Text
          key={i}
          style={[D.gapItem, { color: g.level === 'warn' ? COLORS.warn : COLORS.muted }]}
          wrap
        >
          {g.level === 'warn' ? '[!] ' : '· '}{pdfText(g.text)}
        </Text>
      ))}
    </Section>
  );
}

function ChronologicalTimelineSection({ timeline, title, compact = false }) {
  if (!timeline?.length) return null;
  return (
    <Section title={title || `Χρονολογική αλυσίδα ΚΗΜΔΗΣ (${timeline.length})`} themeKey="proc">
      {timeline.map((item, i) => (
        <View key={`${item.type}-${i}-${item.adam || ''}`} style={D.timelineCompactRow} wrap>
          <Text style={D.timelineCompactDate}>{item.dateLabel}</Text>
          <Text style={D.timelineCompactStage}>{item.stageName}</Text>
          <Text style={D.timelineCompactBody} wrap>
            {item.adam ? `${item.adam}` : ''}
            {item.adam && (item.title || (item.fields || []).length) ? ' · ' : ''}
            {!compact && item.title ? `${pdfText(item.title)}` : ''}
            {!compact && item.title && (item.fields || []).length ? ' · ' : ''}
            {(item.fields || []).map((f) => f.value).filter(Boolean).join(' · ')}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function ExecutiveSummaryPage({ summary, completenessGaps, paymentSummary, appConfig }) {
  if (!summary) return null;
  const sc = statusColor(summary.projectStatus);
  return (
    <Page size="A4" style={[S.page, { paddingTop: PAGE_MARGIN_TOP + CONTINUATION_HEADER_H }]} wrap>
      <ReportContinuationHeader exportDate={nowFormatted()} />
      <View style={{ marginTop: -CONTINUATION_HEADER_H }}>
        <ReportHeader appConfig={appConfig} reportTitle="ΣΥΝΟΨΗ ΥΠΟΕΡΓΟΥ" />
      </View>
      <View style={D.content}>
        <View style={D.execBlock}>
          <Text style={D.execSubtitle}>Πράξη: {pdfText(summary.projectTitle)}</Text>
          <Text style={D.execTitle}>{pdfText(summary.subprojectTitle)}</Text>
          <View style={D.heroBadgesRow}>
            {summary.projectStatus ? (
              <Text style={[D.heroBadge, { backgroundColor: sc.bg, color: sc.text }]}>
                {pdfText(summary.projectStatus)}
              </Text>
            ) : null}
            {summary.characterization ? (
              <Text style={[D.heroBadge, { backgroundColor: COLORS.amberLight, color: COLORS.amber }]}>
                {pdfText(summary.characterization)}
              </Text>
            ) : null}
            {summary.projectType ? (
              <Text style={[D.heroBadge, { backgroundColor: COLORS.skyLight, color: COLORS.sky }]}>
                {pdfText(summary.projectType)}
              </Text>
            ) : null}
          </View>
        </View>

        <Section title="Επισκόπηση" themeKey="identity">
          <View style={D.kvGrid}>
            <Kv label="Χρηματοδότηση" value={summary.fundingSource} full />
            <Kv label="Εγκεκριμένο" value={summary.approvedAmount ? formatAmount(summary.approvedAmount) : ''} />
            <Kv label="Προϋπολογισμός" value={summary.projectBudget ? formatAmount(summary.projectBudget) : ''} />
            <Kv label="Σύμβαση" value={summary.contractAmountLabel} />
            <Kv label="Πληρωμένο" value={summary.paidAmountLabel} />
            <Kv label="Υπόλοιπο" value={summary.remainingLabel} />
            <Kv label="Πρόοδος πληρωμών" value={summary.percentPaidLabel} />
            {summary.contractor ? (
              <Kv
                label="Ανάδοχος"
                value={summary.contractorVat ? `${summary.contractor} (ΑΦΜ ${summary.contractorVat})` : summary.contractor}
                full
              />
            ) : null}
            {summary.supervisor ? <Kv label="Επιβλέπων" value={summary.supervisor} full /> : null}
            {summary.assistants ? <Kv label="Βοηθούν στην επίβλεψη" value={summary.assistants} full /> : null}
            {summary.khmdhsAdam ? <Kv label="ΑΔΑΜ σύμβασης" value={summary.khmdhsAdam} /> : null}
            {summary.aleCodes ? <Kv label="Α.Λ.Ε." value={summary.aleCodes} full /> : null}
          </View>
          {paymentSummary?.percentPaid != null ? (
            <View style={[D.progressTrack, { marginTop: 6 }]}>
              <View style={[D.progressFill, { width: `${Math.max(4, Math.min(100, paymentSummary.percentPaid))}%` }]} />
            </View>
          ) : null}
        </Section>

        <PaymentSummaryPanel paymentSummary={paymentSummary} />

        <View style={D.statsRow}>
          {(summary.counts?.files || 0) > 0 ? (
            <MiniStat value={summary.counts.files} label="Αρχεία" color={COLORS.slate} />
          ) : null}
          {(summary.counts?.entaxeis || 0) > 0 ? (
            <MiniStat value={summary.counts.entaxeis} label="Εντάξεις" color={COLORS.teal} />
          ) : null}
          {(summary.counts?.khmdhsStages || 0) > 0 ? (
            <MiniStat value={summary.counts.khmdhsStages} label="Στάδια ΚΗΜΔΗΣ" color={COLORS.accent} />
          ) : null}
          {(summary.paymentCount || 0) > 0 ? (
            <MiniStat value={summary.paymentCount} label="Εντάλματα" color={COLORS.green} />
          ) : null}
        </View>

        <CompletenessSection gaps={completenessGaps} />
        <ChronologicalTimelineSection
          timeline={summary.timelinePreview}
          title={`Χρονολόγιο ΚΗΜΔΗΣ (πρώτα ${summary.timelinePreview?.length || 0})`}
          compact
        />
      </View>
      <ReportFooter />
    </Page>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

function BasicInfoSection({ basic, isPublishedToPortal }) {
  const sc = statusColor(basic.projectStatus);
  return (
    <Section title="Ταυτότητα & Κατάσταση Υποέργου" themeKey="identity">
      <View style={D.kvGrid}>
        <Kv label="Πράξη"               value={basic.projectTitle} full />
        <Kv label="Μορφή Υλοποίησης"    value={basic.implementationForm} />
        <Kv label="Είδος"               value={basic.projectType} />
        <View style={D.kvRow} wrap={false}>
          <Text style={D.kvLabel}>Κατάσταση</Text>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {basic.projectStatus ? (
              <Text style={[D.kvValue, {
                backgroundColor: sc.bg, color: sc.text,
                paddingVertical: 1, paddingHorizontal: 4,
                borderRadius: 3, alignSelf: 'flex-start',
                fontFamily: 'DejaVu', fontWeight: 'bold',
              }]}>{pdfText(basic.projectStatus)}</Text>
            ) : <Text style={D.kvValue}>—</Text>}
          </View>
        </View>
        {basic.characterization ? <Kv label="Χαρακτηρισμός"   value={basic.characterization} /> : null}
        {basic.displayChargePrimary      ? <Kv label="Επιβλέπων"               value={basic.displayChargePrimary}      full /> : null}
        {basic.displayChargeParticipants ? <Kv label="Βοηθούν στην επίβλεψη" value={basic.displayChargeParticipants} full /> : null}
        {basic.createdAt  ? <Kv label="Δημιουργία"      value={formatDate(basic.createdAt)} /> : null}
        {basic.updatedAt  ? <Kv label="Τελ. Ενημέρωση"  value={formatDate(basic.updatedAt)} /> : null}
        {isPublishedToPortal ? <Kv label="Πύλη Διαφάνειας" value="Δημοσιευμένο" /> : null}
      </View>
    </Section>
  );
}

function CodesSection({ basic }) {
  const aleDisplay = formatReportAleCodes(basic);
  const hasAle = !!aleDisplay;
  const hasMis = !!(basic.misPraxhsName && basic.misPraxhsCode);
  if (!hasAle && !hasMis) return null;
  return (
    <Section title="Κωδικοί & Αναφορές" themeKey="codes">
      <View style={D.kvGrid}>
        {hasAle ? (
          <Kv
            label={basic.aleCodes?.length > 1 ? 'Κωδικοί Α.Λ.Ε.' : 'Κωδικός Α.Λ.Ε.'}
            value={aleDisplay}
            full
          />
        ) : null}
        {hasMis ? (
          <Kv label={basic.misPraxhsName} value={basic.misPraxhsCode} full />
        ) : null}
      </View>
    </Section>
  );
}

function FundingSection({ basic }) {
  return (
    <Section title="Χρηματοδότηση & Ποσά" themeKey="funding">
      <View style={D.kvGrid}>
        <Kv label="Πηγή Χρηματοδότησης"  value={basic.fundingSource} full />
        {basic.fundingDetails
          ? <Kv label="Εξειδίκευση"      value={basic.fundingDetails} full />
          : null}
        <Kv label="Εγκεκριμένο Ποσό"    value={basic.approvedAmount ? formatAmount(basic.approvedAmount) : ''} />
        <Kv label="Προϋπολογισμός"       value={basic.projectBudget  ? formatAmount(basic.projectBudget)  : ''} />
        {basic.totalContractAmount > 0 ? (
          <Kv label="Σύνολο Συμβάσεων"
              value={basic.totalContractAmount.toLocaleString('el-GR', { minimumFractionDigits: 2 }) + ' €'}
              full />
        ) : null}
      </View>
    </Section>
  );
}

function AssignmentSection({ basic }) {
  if (!basic.assignmentProcedure && !basic.contractProcessStartDate) return null;
  return (
    <Section title="Διαδικασία Ανάθεσης" themeKey="procedure">
      <View style={D.kvGrid}>
        {basic.assignmentProcedure ? (
          <Kv
            label="Διαδικασία"
            value={basic.assignmentFromKhmdhs
              ? `${basic.assignmentProcedure} (από ΚΗΜΔΗΣ · ${basic.khmdhsNotice?.adam || '—'})`
              : basic.assignmentProcedure}
            full
          />
        ) : null}
        {basic.contractProcessStartDate
          ? <Kv label="Έναρξη Διαδικασίας" value={formatDate(basic.contractProcessStartDate)} />
          : null}
      </View>
    </Section>
  );
}

function RemainingSection({ basic }) {
  const hasAny = basic.remainingAmount || (basic.aleRemainingAmounts || []).some(Boolean);
  if (!hasAny) return null;
  return (
    <Section title={`Υπόλοιπα Έτους${basic.remainingAmountYear ? ' ' + basic.remainingAmountYear : ''}`} themeKey="funding">
      <View style={D.kvGrid}>
        {basic.aleCodes?.length > 1 && basic.aleRemainingAmounts?.length > 0
          ? basic.aleCodes.map((code, i) => (
              <Kv key={code || i} label={code || `Α.Λ.Ε. ${i+1}`}
                  value={basic.aleRemainingAmounts[i] ? formatAmount(basic.aleRemainingAmounts[i]) : ''} />
            ))
          : <Kv label="Ποσό Υπολοίπων" value={basic.remainingAmount ? formatAmount(basic.remainingAmount) : ''} />}
        {basic.remainingAmount && basic.aleCodes?.length > 1
          ? <Kv label="Σύνολο" value={formatAmount(basic.remainingAmount)} />
          : null}
        {basic.remainingAmountComments
          ? <Kv label="Σχόλια" value={basic.remainingAmountComments} full />
          : null}
      </View>
    </Section>
  );
}

function ContractSection({ basic, skipKhmdhsContractBlock }) {
  const hasMain = basic.isMultipleContracts
    ? (basic.contracts || []).length > 0
    : (basic.contractDate || basic.contractAmount || basic.khmdhsAdam);
  const hasSupp = basic.hasSupplementaryContracts && (basic.supplementaryContracts || []).length > 0;
  if (!hasMain && !hasSupp) return null;
  const showKhmdhsBlock = !skipKhmdhsContractBlock && (basic.khmdhsAdam || basic.khmdhsContractSnapshot);
  return (
    <Section title="Στοιχεία Σύμβασης" themeKey="symv">
      {!basic.isMultipleContracts ? (
        <View wrap>
          <View style={D.kvGrid}>
            <Kv label="Ημερομηνία Σύμβασης" value={formatDate(basic.contractDate)} />
            <Kv label="Ποσό Σύμβασης"       value={basic.contractAmount ? formatAmount(basic.contractAmount) : ''} />
            {basic.apeAmount   ? <Kv label="ΑΠΕ + Συμπλ." value={formatAmount(basic.apeAmount)} /> : null}
            {basic.apeComments ? <Kv label="Σχόλια ΑΠΕ"   value={basic.apeComments} full /> : null}
          </View>
          {showKhmdhsBlock && (
            <View style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.roseMid}` }]} wrap>
              <Text style={D.entityTitle}>ΚΗΜΔΗΣ — Σύμβαση</Text>
              {basic.khmdhsAdam ? <EKv label="ΑΔΑΜ" value={basic.khmdhsAdam} /> : null}
              {basic.khmdhsContractSnapshot?.anadoxosName ? <EKv label="Ανάδοχος" value={basic.khmdhsContractSnapshot.anadoxosName} /> : null}
              {basic.khmdhsContractSnapshot?.anadoxosVat ? <EKv label="ΑΦΜ" value={basic.khmdhsContractSnapshot.anadoxosVat} /> : null}
              {basic.khmdhsContractSnapshot?.assigningAuthority ? <EKv label="Αναθέτουσα" value={basic.khmdhsContractSnapshot.assigningAuthority} full /> : null}
              {basic.khmdhsContractFetchedAt ? <EKv label="Τελ. Λήψη" value={formatDate(basic.khmdhsContractFetchedAt)} /> : null}
            </View>
          )}
        </View>
      ) : (basic.contracts || []).map((c, i) => (
        <View key={i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.roseMid}` }]} wrap>
          <Text style={D.entityTitle}>Σύμβαση {i + 1}</Text>
          <EKv label="Ημερομηνία"    value={formatDate(c.date)} />
          <EKv label="Ποσό"          value={c.amount ? formatAmount(c.amount) : ''} />
          {c.apeAmount   ? <EKv label="ΑΠΕ + Συμπλ." value={formatAmount(c.apeAmount)} /> : null}
          {c.comments    ? <EKv label="Σχόλια"        value={c.comments} full /> : null}
          {c.khmdhsAdam  ? <EKv label="ΑΔΑΜ ΚΗΜΔΗΣ"  value={c.khmdhsAdam} /> : null}
          {c.khmdhsAnadoxos ? <EKv label="Ανάδοχος"  value={c.khmdhsAnadoxos} /> : null}
          {c.khmdhsVat   ? <EKv label="ΑΦΜ"          value={c.khmdhsVat} /> : null}
          {c.khmdhsAuthority ? <EKv label="Αναθέτουσα" value={c.khmdhsAuthority} full /> : null}
          {c.khmdhsFetchedAt ? <EKv label="Τελ. Λήψη" value={formatDate(c.khmdhsFetchedAt)} /> : null}
        </View>
      ))}
      {(basic.supplementaryContracts || []).map((c, i) => (
        <View key={`s-${i}`} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.greenMid}` }]} wrap>
          <Text style={[D.entityTitle, { color: COLORS.green }]}>Συμπληρωματική Σύμβαση {i + 1}</Text>
          <EKv label="Ημερομηνία" value={formatDate(c.date)} />
          <EKv label="Ποσό"       value={c.amount ? formatAmount(c.amount) : ''} />
          {c.comments ? <EKv label="Σχόλια" value={c.comments} /> : null}
        </View>
      ))}
    </Section>
  );
}

/** Αλυσίδα ΚΗΜΔΗΣ — χρονολογική ροή */
function KhmdhsChainSection({ khmdhsChain, khmdhsNotice, basic, chronologicalTimeline, paymentSummary }) {
  if (!chronologicalTimeline?.length && !khmdhsChain?.pay) return null;

  const chainCtx = buildChainContext(khmdhsChain, basic);
  const hideRepeatedTitle = !!chainCtx.commonTitle;
  const detailStages = (chronologicalTimeline || []).filter((item) => item.type !== 'pay');

  return (
    <Section title="Αλυσίδα ΚΗΜΔΗΣ" themeKey="proc">
      {(chainCtx.commonTitle || chainCtx.commonOrganization || chainCtx.contractor) ? (
        <View style={D.chainSummary} wrap>
          <Text style={D.chainSummaryTitle}>Σύνοψη αλυσίδας</Text>
          {chainCtx.commonTitle ? <CKv label="Αντικείμενο" value={chainCtx.commonTitle} /> : null}
          {chainCtx.commonOrganization ? <CKv label="Αναθέτουσα" value={chainCtx.commonOrganization} /> : null}
          {chainCtx.contractor ? (
            <CKv
              label="Ανάδοχος"
              value={chainCtx.contractorVat
                ? `${chainCtx.contractor} (ΑΦΜ ${chainCtx.contractorVat})`
                : chainCtx.contractor}
            />
          ) : null}
        </View>
      ) : null}

      <PaymentSummaryPanel paymentSummary={paymentSummary} />

      {detailStages.length > 0 ? (
        <Text style={[D.groupTitle, { color: COLORS.accent, marginBottom: 6 }]}>
          {`Χρονολογική ροή (${detailStages.length} στάδια)`}
        </Text>
      ) : null}

      {detailStages.map((item, i) => {
        const tc = themeColors(item.themeKey);
        const showTitle = item.title && !(hideRepeatedTitle && normalizeChainText(item.title) === normalizeChainText(chainCtx.commonTitle));
        return (
          <ChainStage
            key={`${item.type}-${i}-${item.adam || ''}`}
            stageName={item.stageName}
            title={showTitle ? item.title : ''}
            adam={item.adam}
            colour={tc.color}
            light={tc.light}
            mid={tc.mid}
            cancelled={item.cancelled}
          >
            {item.dateLabel && item.dateLabel !== '—' ? <CKv label="Ημερομηνία" value={item.dateLabel} /> : null}
            {(item.fields || []).map((f, fi) => (
              <CKv key={fi} label={f.label} value={f.value} />
            ))}
          </ChainStage>
        );
      })}

      {khmdhsChain?.pay ? (
        <ChainStage
          stageName={CHAIN_STAGE_NAMES.pay}
          title=""
          adam={khmdhsChain.pay.count ? `${khmdhsChain.pay.count} εντάλματα` : ''}
          colour={COLORS.slate}
          light={COLORS.slateLight}
          mid={COLORS.slateMid}
        >
          <View style={D.payHeader} wrap={false}>
            <Text style={[D.payHeaderCell, { flex: 2 }]}>ΑΔΑΜ</Text>
            <Text style={[D.payHeaderCell, { flex: 3 }]}>Τίτλος</Text>
            <Text style={[D.payHeaderCell, { flex: 1.5 }]}>Ποσό</Text>
            <Text style={[D.payHeaderCell, { flex: 1.5 }]}>Ημερομηνία</Text>
          </View>
          {(khmdhsChain.pay.entries || []).map((e, i) => (
            <View key={i} style={[D.payRow, i % 2 === 1 ? { backgroundColor: COLORS.rowAlt } : {}]} wrap>
              <Text style={[D.payCell, { flex: 2, fontFamily: 'DejaVu', fontWeight: e.cancelled ? 'normal' : 'bold', color: e.cancelled ? COLORS.light : COLORS.dark, fontSize: 6.5 }]}>
                {e.adam || '—'}
              </Text>
              <Text style={[D.payCell, { flex: 3, color: e.cancelled ? COLORS.light : COLORS.dark, lineHeight: 1.5 }]} wrap>
                {pdfText(e.title) || '—'}{e.cancelled ? ' [ακυρωμένο]' : ''}
              </Text>
              <Text style={[D.payCell, { flex: 1.5, color: COLORS.green, fontFamily: 'DejaVu', fontWeight: 'bold' }]}>
                {e.amount || '—'}
              </Text>
              <Text style={[D.payCell, { flex: 1.5 }]}>{e.signedDate || '—'}</Text>
            </View>
          ))}
          {khmdhsChain.pay.count > 0 ? (
            <View style={D.payTotalRow} wrap={false}>
              <Text style={{ fontSize: 7, color: COLORS.slate, flex: 1, fontFamily: 'DejaVu', fontWeight: 'bold' }}>
                {`Σύνολο ${khmdhsChain.pay.count} εντάλματα`}
              </Text>
              <Text style={{ fontSize: 7, color: COLORS.green, fontFamily: 'DejaVu', fontWeight: 'bold' }}>
                {khmdhsChain.pay.displayTotalGross != null
                  ? `${khmdhsChain.pay.displayTotalGross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                  : khmdhsChain.pay.countableTotalGross != null
                    ? `${khmdhsChain.pay.countableTotalGross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                    : khmdhsChain.pay.totalGross != null
                      ? `${khmdhsChain.pay.totalGross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                      : '—'}
              </Text>
            </View>
          ) : null}
        </ChainStage>
      ) : null}
    </Section>
  );
}

function EntaxeisSection({ entaxeis }) {
  if (!entaxeis?.length) return null;
  return (
    <Section title={`Συνδεδεμένες Εντάξεις (${entaxeis.length})`} themeKey="entaxeis">
      {entaxeis.map((e, i) => (
          <View key={e.entaxiId || i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.tealMid}` }]} wrap>
            <Text style={D.entityTitle}>
              Ένταξη {i+1}{e.fundingAuthority ? ' — ' + e.fundingAuthority : ''}
            </Text>
            <EKv label="Ημερομηνία"   value={formatDate(e.documentDate)} />
            <EKv label="Αρχικό Ποσό"  value={e.initialAmount ? formatAmount(e.initialAmount) : ''} />
            <EKv label="Τρέχον Ποσό"  value={e.currentAmount ? formatAmount(e.currentAmount) : ''} />
            {e.subject  ? <EKv label="Θέμα"    value={e.subject} /> : null}
            {e.comments ? <EKv label="Σχόλια"  value={e.comments} /> : null}
            {(e.entaxiPDFs || []).length > 0
              ? <EKv label="Αρχεία Ένταξης"  value={e.entaxiPDFs.join(', ')} /> : null}
            {(e.approvalPDFs || []).length > 0
              ? <EKv label="Αρχεία Έγκρισης" value={e.approvalPDFs.join(', ')} /> : null}
            {(e.modifications || []).length > 0 && (
              <>
                {e.modifications.map((m) => (
                  <View key={m.index} style={D.modBlock} wrap>
                    <Text style={D.modTitle}>Τροποποίηση #{m.index}</Text>
                    {m.date        ? <MKv label="Ημερομηνία"  value={formatDate(m.date)} /> : null}
                    {m.amount      ? <MKv label="Ποσό"        value={formatAmount(m.amount)} /> : null}
                    {m.description ? <MKv label="Περιγραφή"   value={m.description} /> : null}
                  </View>
                ))}
              </>
            )}
          </View>
        ))}
    </Section>
  );
}

function ProskliseisSection({ proskliseis }) {
  if (!proskliseis?.length) return null;
  return (
    <Section title={`Συνδεδεμένες Προσκλήσεις (${proskliseis.length})`} themeKey="proskliseis">
      {proskliseis.map((p, i) => (
          <View key={p.prosklisiId || i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.skyMid}` }]} wrap>
            <Text style={D.entityTitle}>{p.title || `Πρόσκληση ${i+1}`}</Text>
            {p.axis         ? <EKv label="Άξονας"         value={p.axis} /> : null}
            {p.code         ? <EKv label="Κωδικός"        value={p.code} /> : null}
            {p.fundingSource? <EKv label="Πηγή Χρηματ."   value={p.fundingSource} /> : null}
            {p.budgetRange  ? <EKv label="Εύρος Π/Υ"      value={p.budgetRange} /> : null}
            {p.status       ? <EKv label="Κατάσταση"      value={p.status} /> : null}
            {p.deadline     ? <EKv label="Ημ. Λήξης"      value={formatDate(p.deadline)} /> : null}
            {p.comments     ? <EKv label="Σχόλια"         value={p.comments} /> : null}
            {(p.modifications || []).length > 0 && (
              <>
                {p.modifications.map((m) => (
                  <View key={m.index} style={D.modBlock} wrap>
                    <Text style={D.modTitle}>Τροποποίηση #{m.index}</Text>
                    {m.date        ? <MKv label="Ημερομηνία"  value={formatDate(m.date)} /> : null}
                    {m.title       ? <MKv label="Τίτλος"      value={m.title} /> : null}
                    {m.status      ? <MKv label="Κατάσταση"   value={m.status} /> : null}
                    {m.budgetRange ? <MKv label="Εύρος Π/Υ"   value={m.budgetRange} /> : null}
                    {m.notes       ? <MKv label="Σημειώσεις"  value={m.notes} /> : null}
                  </View>
                ))}
              </>
            )}
          </View>
        ))}
    </Section>
  );
}

function EpSection({ epActions }) {
  if (!epActions?.length) return null;
  return (
    <Section title={`Επιχειρησιακό Πρόγραμμα (${epActions.length})`} themeKey="ep">
      {epActions.map((a, i) => (
        <View key={i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.accentMid}` }]} wrap>
          <Text style={D.entityTitle}>Δραση #{a.aa || '—'}: {pdfText(a.title)}</Text>
          {(a.axisCode || a.measureCode || a.objectiveCode)
            ? <EKv label="Ιεραρχία" value={[a.axisCode, a.measureCode, a.objectiveCode].filter(Boolean).join(' > ')} />
            : null}
          {a.actionType  ? <EKv label="Τύπος"        value={a.actionType} /> : null}
          {a.location    ? <EKv label="Χωροθέτηση"   value={a.location} /> : null}
          {a.programTitle? <EKv label="Πρόγραμμα"    value={a.programTitle} full /> : null}
          {a.priority    ? <EKv label="Προτεραιότητα" value={String(a.priority)} /> : null}
          {a.total != null && a.total !== 0
            ? <EKv label="Προϋπολογισμός" value={Number(a.total).toLocaleString('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} />
            : null}
          {a.isNew != null ? <EKv label="Χαρακτηρισμός" value={a.isNew ? 'Νεα δραση' : 'Συνεχιζόμενη'} /> : null}
        </View>
      ))}
    </Section>
  );
}

function EgkriseisSection({ egkriseis, egkrisiLinks }) {
  const total = countEgkriseis(egkriseis, egkrisiLinks);
  if (total === 0) return null;
  return (
    <Section title={`Εγκρίσεις Διάθεσης Πίστωσης (${total})`} themeKey="egkriseis">
      {(egkriseis || []).map((eg, i) => (
        <View key={eg.id || `eg-${i}`} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.amberMid}` }]} wrap>
          <Text style={D.entityTitle}>
            {eg.type || 'Έγκριση'} {i + 1}{eg.fileName ? ` — ${eg.fileName}` : ''}
          </Text>
          {eg.date            ? <EKv label="Ημερομηνία"   value={formatDate(eg.date)} /> : null}
          {eg.subprojectTitle ? <EKv label="Υποέργο"      value={eg.subprojectTitle} full /> : null}
          {eg.notes           ? <EKv label="Σημειώσεις"   value={eg.notes} full /> : null}
        </View>
      ))}
      {(egkrisiLinks || []).map((l, i) => (
        <View key={`link-${i}`} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.amberMid}` }]} wrap>
          <Text style={D.entityTitle}>
            Συνδεδεμένη έγκριση {(egkriseis?.length || 0) + i + 1}
          </Text>
          <EKv label="Τίτλος" value={l.egkrisiTitle || '—'} full />
          {l.autoLinked ? <EKv label="Τύπος" value="Αυτόματη συσχέτιση" /> : null}
        </View>
      ))}
    </Section>
  );
}

function MeletaiSection({ meleti }) {
  if (!meleti) return null;
  return (
    <Section title="Συνδεδεμένη Μελέτη" themeKey="procedure">
      <View style={D.kvGrid}>
        {meleti.studyNumber ? <Kv label="Αριθμός Μελέτης" value={meleti.studyNumber} /> : null}
        {meleti.title       ? <Kv label="Τίτλος"          value={meleti.title} full /> : null}
        {meleti.category    ? <Kv label="Κατηγορία"       value={meleti.category} /> : null}
        {meleti.assignedTo  ? <Kv label="Ανατέθηκε σε"    value={meleti.assignedTo} /> : null}
        {meleti.fileCount > 0 ? <Kv label="Αρχεία μελέτης" value={String(meleti.fileCount)} /> : null}
        {meleti.updatedAt   ? <Kv label="Τελ. Ενημέρωση"  value={formatDate(meleti.updatedAt)} /> : null}
      </View>
      {meleti.notes ? (
        <View style={{ marginTop: 5 }}>
          <Text style={D.groupTitle}>Σημειώσεις μελέτης</Text>
          <Text style={D.proseBlock} wrap>{pdfText(meleti.notes)}</Text>
        </View>
      ) : null}
      {(meleti.fileGroups || []).map((g, gi) => (
        <View key={gi} style={D.fileGroup} wrap>
          <Text style={D.fileGroupTitle}>{g.label}</Text>
          {(g.files || []).map((f, fi) => (
            <Text key={fi} style={D.fileItem} wrap>- {f}</Text>
          ))}
        </View>
      ))}
    </Section>
  );
}

function fileEntryLabel(entry) {
  if (entry == null) return '';
  return typeof entry === 'string' ? entry : (entry.name || '');
}

function fileEntryIndex(entry, fallback) {
  if (entry != null && typeof entry === 'object' && entry.index != null) return entry.index;
  return fallback;
}

function FilesSection({ files }) {
  if (!files?.totalCount) return null;
  return (
    <Section title={`Αρχεία Υποέργου (${files.totalCount})`} themeKey="files">
      {(files.groups || []).map((group, gi) => (
        <View key={gi} style={D.fileGroup} wrap>
          <Text style={D.fileGroupTitle}>
            {group.categoryNumber ? `${group.categoryNumber}. ` : ''}Κατηγορία: {group.title}
          </Text>
          {(group.files || []).map((f, fi) => (
            <View key={fi} style={{ flexDirection: 'row', alignItems: 'flex-start' }} wrap>
              <Text style={D.fileIndex}>{fileEntryIndex(f, fi + 1)}.</Text>
              <Text style={[D.fileItem, { flex: 1, paddingLeft: 2 }]} wrap>{fileEntryLabel(f)}</Text>
            </View>
          ))}
        </View>
      ))}
      {(files.ungrouped || []).length > 0 && (
        <View style={D.fileGroup} wrap>
          <Text style={D.fileGroupTitle}>Χωρίς Κατηγορία</Text>
          {files.ungrouped.map((f, fi) => (
            <View key={fi} style={{ flexDirection: 'row', alignItems: 'flex-start' }} wrap>
              <Text style={D.fileIndex}>{fileEntryIndex(f, fi + 1)}.</Text>
              <Text style={[D.fileItem, { flex: 1, paddingLeft: 2 }]} wrap>{fileEntryLabel(f)}</Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function NotesSection({ linkedNotes, comments, eisigitiki }) {
  if (!linkedNotes?.length && !comments && !eisigitiki) return null;
  return (
    <Section title="Σημειώσεις & Κείμενα" themeKey="notes">
      {comments ? (
        <View style={{ marginBottom: 5 }}>
          <Text style={D.groupTitle}>Σχόλια Υποέργου</Text>
          <Text style={D.proseBlock} wrap>{pdfText(comments)}</Text>
        </View>
      ) : null}
      {eisigitiki ? (
        <View style={{ marginBottom: 5 }}>
          <Text style={D.groupTitle}>Αναφορά από πρόγραμμα Οικονομικής</Text>
          <Text style={D.proseBlock} wrap>{pdfText(eisigitiki)}</Text>
        </View>
      ) : null}
      {(linkedNotes || []).map((n, i) => (
        <View key={i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.hairline}` }]} wrap>
          <Text style={D.entityTitle}>Σημείωση: {pdfText(n.title)}</Text>
          {n.updatedAt ? <EKv label="Ενημέρωση" value={formatDate(n.updatedAt)} /> : null}
          {n.content ? <Text style={D.proseBlock} wrap>{pdfText(n.content)}</Text> : null}
        </View>
      ))}
    </Section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubprojectDetailReport({ data, appConfig, appVersion }) {
  const {
    basic, khmdhsChain, files, entaxeis, proskliseis, egkriseis, egkrisiLinks,
    epActions, linkedNotes, complianceWarnings, meleti, meta,
    executiveSummary, paymentSummary, chronologicalTimeline, completenessGaps,
  } = data;

  const egkrisiTotal = countEgkriseis(egkriseis, egkrisiLinks);
  const sc = statusColor(basic.projectStatus);
  const hasKhmdhsChainSymv = !!(khmdhsChain && (
    (!basic.isMultipleContracts && basic.khmdhsAdam)
    || (basic.isMultipleContracts && (basic.contracts || []).some((c) => c.khmdhsAdam))
  ));

  return (
    <Document
      title={`ERGOHUB — ${basic.subprojectTitle}`}
      author="ERGOHUB"
      subject="Αναφορά Υποέργου"
    >
      <ExecutiveSummaryPage
        summary={executiveSummary}
        completenessGaps={completenessGaps}
        paymentSummary={paymentSummary}
        appConfig={appConfig}
      />
      <Page
        size="A4"
        style={[S.page, { paddingTop: PAGE_MARGIN_TOP + CONTINUATION_HEADER_H }]}
        wrap
      >
        <ReportContinuationHeader exportDate={nowFormatted()} />
        <View style={{ marginTop: -CONTINUATION_HEADER_H }}>
          <ReportHeader appConfig={appConfig} reportTitle="ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ" />
        </View>

        <View style={D.content}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={D.hero}>
            <Text style={D.heroLabel}>Πράξη: {pdfText(basic.projectTitle)}</Text>
            <Text style={D.heroTitle}>{pdfText(basic.subprojectTitle)}</Text>

            <View style={D.heroBadgesRow}>
              {basic.projectStatus ? (
                <Text style={[D.heroBadge, { backgroundColor: sc.bg, color: sc.text }]}>
                  {pdfText(basic.projectStatus)}
                </Text>
              ) : null}
              {basic.projectType ? (
                <Text style={[D.heroBadge, { backgroundColor: COLORS.skyLight, color: COLORS.sky }]}>
                  {pdfText(basic.projectType)}
                </Text>
              ) : null}
              {basic.implementationForm ? (
                <Text style={[D.heroBadge, { backgroundColor: COLORS.slateLight, color: COLORS.slate }]}>
                  {pdfText(basic.implementationForm)}
                </Text>
              ) : null}
            </View>

            {(basic.projectBudget || basic.approvedAmount || basic.totalContractAmount > 0 || formatReportAleCodes(basic)) && (
              <View style={D.heroAmountsRow}>
                {basic.approvedAmount ? (
                  <View style={D.heroAmountCell}>
                    <Text style={D.heroAmountLabel}>Εγκεκριμένο ποσό</Text>
                    <Text style={[D.heroAmountVal, { color: COLORS.green }]}>{formatAmount(basic.approvedAmount)}</Text>
                  </View>
                ) : null}
                {basic.projectBudget ? (
                  <View style={D.heroAmountCell}>
                    <Text style={D.heroAmountLabel}>Προϋπολογισμός</Text>
                    <Text style={D.heroAmountVal}>{formatAmount(basic.projectBudget)}</Text>
                  </View>
                ) : null}
                {basic.totalContractAmount > 0 ? (
                  <View style={D.heroAmountCell}>
                    <Text style={D.heroAmountLabel}>Σύνολο συμβάσεων</Text>
                    <Text style={[D.heroAmountVal, { color: COLORS.accent }]}>
                      {basic.totalContractAmount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </Text>
                  </View>
                ) : null}
                {formatReportAleCodes(basic) ? (
                  <View style={D.heroAmountCell}>
                    <Text style={D.heroAmountLabel}>
                      {basic.aleCodes?.length > 1 ? 'Κωδικοί Α.Λ.Ε.' : 'Κωδικός Α.Λ.Ε.'}
                    </Text>
                    <Text style={[D.heroAmountVal, { fontSize: 8 }]}>{formatReportAleCodes(basic)}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {(basic.displayChargePrimary || basic.displayChargeParticipants) && (
              <View style={{ marginTop: 5 }}>
                {basic.displayChargePrimary ? (
                  <Text style={D.heroMeta}>Επιβλέπων: {pdfText(basic.displayChargePrimary)}</Text>
                ) : null}
                {basic.displayChargeParticipants ? (
                  <Text style={[D.heroMeta, { marginTop: basic.displayChargePrimary ? 2 : 0 }]}>
                    Βοηθούν στην επίβλεψη: {pdfText(basic.displayChargeParticipants)}
                  </Text>
                ) : null}
              </View>
            )}

            <Text style={D.heroMeta}>
              ERGOHUB{appVersion ? ` v${appVersion}` : ''}
              {meta?.subprojectId ? ` · ID: ${meta.subprojectId.slice(0, 8)}...` : ''}
            </Text>
          </View>

          {/* ── Mini stats ──────────────────────────────────────── */}
          <View style={D.statsRow}>
            {(files.totalCount || 0) > 0 && (
              <MiniStat value={files.totalCount} label="Αρχεία" color={COLORS.slate} />
            )}
            {entaxeis.length > 0 && (
              <MiniStat value={entaxeis.length} label="Εντάξεις" color={COLORS.teal} />
            )}
            {proskliseis.length > 0 && (
              <MiniStat value={proskliseis.length} label="Προσκλήσεις" color={COLORS.sky} />
            )}
            {egkrisiTotal > 0 && (
              <MiniStat value={egkrisiTotal} label="Εγκρίσεις" color={COLORS.amber} />
            )}
            {(epActions?.length || 0) > 0 && (
              <MiniStat value={epActions.length} label="Δράσεις ΕΠ" color={COLORS.accent} />
            )}
            {khmdhsChain?.pay?.count > 0 && (
              <MiniStat value={khmdhsChain.pay.count} label="Εντάλματα" color={COLORS.green} />
            )}
          </View>

          {/* ── Compliance warnings ──────────────────────────────── */}
          {(complianceWarnings || []).length > 0 && (
            <View style={[D.section, { borderColor: COLORS.warnBorder }]} wrap>
              <View style={[D.sectionHead, { backgroundColor: COLORS.warnBg, borderBottom: `1px solid ${COLORS.warnBorder}` }]} wrap={false}>
                <View style={[D.sectionHeadDot, { backgroundColor: COLORS.warn }]} />
                <Text style={[D.sectionHeadText, { color: COLORS.warn }]}>Προειδοποίηση Συμμόρφωσης</Text>
              </View>
              <View style={D.sectionBody}>
                {complianceWarnings.map((w, i) => (
                  <View key={i} style={D.warnBox}>
                    <Text style={D.warnText}>{pdfText(w)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Sections ─────────────────────────────────────────── */}
          <BasicInfoSection basic={basic} isPublishedToPortal={meta?.isPublishedToPortal} />
          <CodesSection basic={basic} />
          <FundingSection basic={basic} />
          <AssignmentSection basic={basic} />
          <RemainingSection basic={basic} />
          <ContractSection basic={basic} skipKhmdhsContractBlock={hasKhmdhsChainSymv} />

          <KhmdhsChainSection
            khmdhsChain={khmdhsChain}
            khmdhsNotice={basic.khmdhsNotice}
            basic={basic}
            chronologicalTimeline={chronologicalTimeline}
            paymentSummary={paymentSummary}
          />

          <EntaxeisSection entaxeis={entaxeis} />
          <ProskliseisSection proskliseis={proskliseis} />
          <EgkriseisSection egkriseis={egkriseis} egkrisiLinks={egkrisiLinks} />
          <EpSection epActions={epActions} />
          <MeletaiSection meleti={meleti} />
          <FilesSection files={files} />
          <NotesSection linkedNotes={linkedNotes} comments={basic.comments} eisigitiki={basic.eisigitikiEkthesi} />

        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
