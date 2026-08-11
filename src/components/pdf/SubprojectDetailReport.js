import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  S, COLORS, formatDate, formatAmount, statusColor,
  CONTINUATION_HEADER_H, PAGE_MARGIN_TOP, nowFormatted,
} from './ReportStyles';
import ReportFooter from './ReportFooter';
import ReportContinuationHeader from './ReportContinuationHeader';
import logoUrl from '../../assets/ergohub-logo.png';

// ── Text helpers ──────────────────────────────────────────────────────────────

const GREEK_ACCENTS = /[\u0300-\u036f]/g;

/** Κεφαλαία ελληνικά χωρίς τόνους (για τίτλους ενοτήτων) */
function toUpperGreekNoAccents(value) {
  if (value == null || value === '') return '';
  return String(value)
    .normalize('NFD')
    .replace(GREEK_ACCENTS, '')
    .toUpperCase();
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

function formatReportAleCodes(basic) {
  const codes = (basic?.aleCodes || []).filter((c) => c && String(c).trim());
  return codes.length ? codes.join(' · ') : '';
}

function countEgkriseis(egkriseis, egkrisiLinks) {
  return (egkriseis?.length || 0) + (egkrisiLinks?.length || 0);
}

function v(val) {
  return (val == null || val === '') ? '—' : pdfText(String(val));
}

function truncatePdfText(text, maxLen) {
  const s = pdfText(text);
  if (!s || s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}...`;
}

/** Ημερομηνία εμφάνισης — ISO / DD-MM / ήδη μορφοποιημένη */
function displayDate(value) {
  if (value == null || value === '' || value === '—') return '—';
  return formatDate(value);
}

function shortTitle(title, maxLen = 48) {
  const s = pdfText(title);
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}...`;
}

// ── KHMDHS chain helpers ─────────────────────────────────────────────────────

const CHAIN_HORIZ_MAX = 6;
const CHAIN_COMPACT_THRESHOLD = 10;
const CHAIN_DENSE_THRESHOLD = 16;

const STAGE_SHORT_LABELS = {
  req: 'Αίτημα',
  commit: 'Ανάληψη',
  proc: 'Πρόκληση',
  awrd: 'Ανάθεση',
  symv: 'Σύμβαση',
  supp: 'Συμπλ.',
  ape: 'ΑΠΕ',
  pay: 'Πληρωμές',
};

/** Χρώματα σταδίων — μόνο για την αλυσίδα ΚΗΜΔΗΣ */
const STAGE_THEME = {
  req:    { color: COLORS.amber,  light: COLORS.amberLight,  mid: COLORS.amberMid  },
  commit: { color: COLORS.violet, light: COLORS.violetLight, mid: COLORS.violetMid },
  proc:   { color: COLORS.accent, light: COLORS.accentLight, mid: COLORS.accentMid },
  awrd:   { color: COLORS.purple, light: COLORS.purpleLight, mid: COLORS.purpleMid },
  symv:   { color: COLORS.rose,   light: COLORS.roseLight,   mid: COLORS.roseMid   },
  pay:    { color: COLORS.slate,  light: COLORS.slateLight,  mid: COLORS.slateMid  },
  ape:    { color: COLORS.teal,   light: COLORS.tealLight,   mid: COLORS.tealMid   },
  supp:   { color: COLORS.green,  light: COLORS.greenLight,  mid: COLORS.greenMid  },
};

function stageTheme(themeKey) {
  return STAGE_THEME[themeKey] || STAGE_THEME.proc;
}

function chainDisplayMode(stageCount) {
  if (stageCount <= CHAIN_HORIZ_MAX) return 'featured';
  if (stageCount <= CHAIN_COMPACT_THRESHOLD) return 'standard';
  if (stageCount <= CHAIN_DENSE_THRESHOLD) return 'compact';
  return 'dense';
}

function stageShortLabel(item) {
  return STAGE_SHORT_LABELS[item?.type] || String(item?.stageName || 'Στάδιο').split(' ')[0];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function horizNodesPerRow(stageCount) {
  if (stageCount <= 4) return stageCount;
  if (stageCount <= 6) return 3;
  return 4;
}

function miniMapNodesPerRow(stageCount) {
  if (stageCount <= 12) return stageCount;
  if (stageCount <= 20) return 10;
  return 12;
}

function topStageField(item) {
  const fields = (item?.fields || []).filter((f) => f && f.value);
  return fields[0] || null;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const D = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 6 },

  // ── Cover ──────────────────────────────────────────────────────────────────
  coverPage: {
    fontFamily: 'DejaVu',
    backgroundColor: COLORS.pageBg,
    paddingTop: 48,
    paddingBottom: 54,
    paddingHorizontal: 48,
  },
  coverTopRule: {
    height: 3,
    backgroundColor: COLORS.accent,
    marginBottom: 28,
  },
  coverBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  coverLogo: { width: 52, height: 52, objectFit: 'contain' },
  coverBrandCenter: { flex: 1, paddingHorizontal: 14 },
  coverBrandMark: {
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 2.2,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  coverOrg: {
    fontSize: 11,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    textAlign: 'right',
    lineHeight: 1.35,
  },
  coverDept: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: 'right',
    marginTop: 3,
  },
  coverDocLabel: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  coverProjectLabel: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  coverTitle: {
    fontSize: 17,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
    marginBottom: 16,
  },
  coverBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 28,
  },
  coverBadge: {
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  coverMoneyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  coverMoneyCell: {
    width: '47%',
    borderTop: `2px solid ${COLORS.accent}`,
    backgroundColor: COLORS.rowAlt,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  coverMoneyLabel: {
    fontSize: 7.5,
    color: COLORS.muted,
    letterSpacing: 0.6,
    marginBottom: 4,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
  },
  coverMoneyVal: {
    fontSize: 13,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  coverSpacer: { flexGrow: 1, minHeight: 24 },
  coverMetaBlock: {
    borderTop: `1px solid ${COLORS.hairline}`,
    paddingTop: 14,
  },
  coverMetaLine: {
    fontSize: 8.5,
    color: COLORS.mid,
    marginBottom: 4,
    lineHeight: 1.45,
  },
  coverPortal: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.greenLight,
    color: COLORS.green,
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
  },

  // ── Content page header strip ──────────────────────────────────────────────
  contentIntro: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom: `1.5px solid ${COLORS.accent}`,
  },
  contentIntroLabel: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  contentIntroTitle: {
    fontSize: 12,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
    marginBottom: 6,
  },
  contentIntroMeta: {
    fontSize: 7.5,
    color: COLORS.muted,
    lineHeight: 1.4,
  },

  // ── Section (μονοχρωματικό) ────────────────────────────────────────────────
  section: {
    marginBottom: 14,
    width: '100%',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    marginBottom: 8,
    borderBottom: `1.5px solid ${COLORS.accent}`,
  },
  sectionHeadBar: {
    width: 3,
    height: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  sectionHeadText: {
    fontSize: 9.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 0.6,
    flex: 1,
  },
  sectionHeadExtra: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
  },
  sectionBody: {
    paddingLeft: 2,
  },

  // ── Field list (σταθερή στήλη ετικετών — εύκολο σκανάρισμα) ───────────────
  fieldList: {
    borderTop: `1px solid ${COLORS.hairline}`,
    borderLeft: `1px solid ${COLORS.hairline}`,
    borderRight: `1px solid ${COLORS.hairline}`,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottom: `1px solid ${COLORS.hairline}`,
    minHeight: 18,
  },
  fieldRowAlt: {
    backgroundColor: COLORS.rowAlt,
  },
  fieldLabel: {
    width: 128,
    fontSize: 7.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingVertical: 6,
    paddingHorizontal: 8,
    lineHeight: 1.4,
    borderRight: `1px solid ${COLORS.hairline}`,
  },
  fieldValueBox: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 9,
    justifyContent: 'center',
  },
  fieldValue: {
    fontSize: 8.5,
    color: COLORS.dark,
    lineHeight: 1.45,
  },

  // ── Fact / money cards (ίσα κελιά, ετικέτα πάνω – τιμή κάτω) ───────────────
  factCardsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  factCard: {
    flex: 1,
    backgroundColor: COLORS.rowAlt,
    border: `1px solid ${COLORS.hairline}`,
    borderTop: `2px solid ${COLORS.accent}`,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 42,
  },
  factCardLabel: {
    fontSize: 6.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    letterSpacing: 0.4,
    marginBottom: 4,
    lineHeight: 1.3,
  },
  factCardValue: {
    fontSize: 9,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
  },
  factCardValueSm: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    lineHeight: 1.35,
  },

  groupLabel: {
    fontSize: 7,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 5,
  },

  statusBadge: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },

  // ── Entity / sub-block ─────────────────────────────────────────────────────
  entityBlock: {
    marginTop: 8,
    marginBottom: 6,
    paddingLeft: 10,
    paddingBottom: 4,
    borderLeft: `2.5px solid ${COLORS.accentMid}`,
  },
  entityTitle: {
    fontSize: 8.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottom: `1px solid ${COLORS.hairline}`,
    lineHeight: 1.4,
  },
  entityRow: {
    flexDirection: 'row',
    paddingVertical: 3.5,
    borderBottom: `1px solid ${COLORS.hairline}`,
    alignItems: 'flex-start',
  },
  entityLabel: {
    width: '30%',
    fontSize: 7.5,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingRight: 8,
    lineHeight: 1.45,
  },
  entityValue: {
    flex: 1,
    fontSize: 8.5,
    color: COLORS.dark,
    lineHeight: 1.5,
  },

  modBlock: {
    marginTop: 6,
    marginLeft: 4,
    borderLeft: `2px solid ${COLORS.hairline}`,
    paddingLeft: 8,
    paddingBottom: 2,
  },
  modTitle: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.muted,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  modRow: { flexDirection: 'row', paddingVertical: 2.5 },
  modLabel: {
    width: '35%',
    fontSize: 7,
    color: COLORS.muted,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    paddingRight: 4,
  },
  modValue: { flex: 1, fontSize: 7.5, color: COLORS.dark, lineHeight: 1.35 },

  // ── Payments strip ─────────────────────────────────────────────────────────
  paymentFigures: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${COLORS.hairline}`,
  },
  paymentTitle: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 0.4,
    marginBottom: 7,
  },

  // ── KHMDHS chain ───────────────────────────────────────────────────────────
  chainRailIntro: {
    fontSize: 7.5,
    color: COLORS.muted,
    lineHeight: 1.45,
    marginBottom: 10,
  },
  chainHorizBlock: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: COLORS.rowAlt,
    border: `1px solid ${COLORS.hairline}`,
  },
  chainHorizRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 8,
  },
  chainHorizNode: {
    alignItems: 'center',
    width: 76,
    paddingHorizontal: 2,
  },
  chainHorizCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  chainHorizCircleNum: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  chainHorizLabel: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.35,
    color: COLORS.dark,
  },
  chainHorizDate: {
    fontSize: 6,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 1.3,
  },
  chainHorizConnector: {
    width: 14,
    height: 2,
    marginTop: 11,
    backgroundColor: COLORS.hairline,
  },
  chainMiniMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  chainMiniDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainMiniDotSm: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chainMiniDotNum: {
    fontSize: 6,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: '#fff',
  },
  chainMiniConnector: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.hairline,
  },
  chainMiniConnectorSm: { width: 5 },
  chainVertRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 2,
  },
  chainVertGutter: {
    width: 18,
    alignItems: 'center',
    marginRight: 8,
  },
  chainVertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: COLORS.pageBg,
  },
  chainVertDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chainVertLine: {
    width: 2,
    flex: 1,
    minHeight: 10,
    marginTop: 2,
    marginBottom: 2,
  },
  chainVertContent: {
    flex: 1,
    paddingBottom: 8,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  chainVertContentLast: {
    borderBottom: 'none',
    paddingBottom: 2,
  },
  chainVertStage: {
    fontSize: 8.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    lineHeight: 1.4,
    marginBottom: 2,
  },
  chainVertStageSm: { fontSize: 7.5 },
  chainVertTitle: {
    fontSize: 8,
    color: COLORS.dark,
    lineHeight: 1.45,
    marginBottom: 2,
  },
  chainVertMeta: {
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  chainVertField: {
    fontSize: 7.5,
    color: COLORS.mid,
    lineHeight: 1.4,
    marginTop: 1,
  },
  chainDenseNote: {
    fontSize: 7,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Warnings ───────────────────────────────────────────────────────────────
  warnSection: {
    marginBottom: 14,
    border: `1px solid ${COLORS.warnBorder}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  warnHead: {
    backgroundColor: COLORS.warnBg,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottom: `1px solid ${COLORS.warnBorder}`,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnHeadText: {
    fontSize: 9,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.warn,
    letterSpacing: 0.4,
  },
  warnBody: { paddingHorizontal: 10, paddingVertical: 8 },
  warnBox: {
    borderLeft: `3px solid ${COLORS.warnBorder}`,
    backgroundColor: COLORS.warnBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  warnText: { fontSize: 8, color: COLORS.warn, lineHeight: 1.45 },

  // ── Misc ───────────────────────────────────────────────────────────────────
  fileGroup: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  fileGroupTitle: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.mid,
    marginBottom: 4,
  },
  fileItem: {
    fontSize: 8,
    color: COLORS.dark,
    paddingVertical: 2.5,
    paddingLeft: 6,
    lineHeight: 1.5,
  },
  groupTitle: {
    fontSize: 8,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.mid,
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  proseBlock: {
    fontSize: 8.5,
    color: COLORS.dark,
    lineHeight: 1.5,
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: COLORS.rowAlt,
    borderRadius: 3,
    border: `1px solid ${COLORS.hairline}`,
  },
});

// ── Primitives ───────────────────────────────────────────────────────────────

/** Μία σταθερή γραμμή: ετικέτα αριστερά (σταθερό πλάτος) · τιμή δεξιά */
function FieldRow({ label, value, children, alt }) {
  return (
    <View style={[D.fieldRow, alt ? D.fieldRowAlt : null]} wrap>
      <Text style={D.fieldLabel}>{label}</Text>
      <View style={D.fieldValueBox}>
        {children || <Text style={D.fieldValue} wrap>{v(value)}</Text>}
      </View>
    </View>
  );
}

function isMeaningfulPdfValue(value) {
  const s = String(value ?? '').trim();
  return !!s && s !== '—';
}

function FieldList({ children }) {
  const list = React.Children.toArray(children).filter(Boolean);
  if (!list.length) return null;
  return <View style={D.fieldList}>{list}</View>;
}

function GroupLabel({ children }) {
  return <Text style={D.groupLabel}>{toUpperGreekNoAccents(children)}</Text>;
}

/**
 * Ίσα κελιά σε σειρά — ετικέτα πάνω, τιμή κάτω.
 * Αποφεύγει το «σπασμένο» δίστηλο πλέγμα.
 */
function FactCards({ items }) {
  const list = (items || []).filter((it) => it && (it.children || isMeaningfulPdfValue(it.value)));
  if (!list.length) return null;
  return (
    <View style={D.factCardsRow} wrap={false}>
      {list.map((it) => (
        <View key={it.label} style={D.factCard} wrap={false}>
          <Text style={D.factCardLabel}>{toUpperGreekNoAccents(it.label)}</Text>
          {it.children || (
            <Text
              style={String(it.value || '').length > 28 ? D.factCardValueSm : D.factCardValue}
              wrap
            >
              {v(it.value)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function EKv({ label, value }) {
  return (
    <View style={D.entityRow} wrap>
      <Text style={D.entityLabel}>{label}</Text>
      <Text style={D.entityValue} wrap>{v(value)}</Text>
    </View>
  );
}

function MKv({ label, value }) {
  return (
    <View style={D.modRow} wrap>
      <Text style={D.modLabel}>{label}</Text>
      <Text style={D.modValue} wrap>{v(value)}</Text>
    </View>
  );
}

function Section({ title, children, extra }) {
  return (
    <View style={D.section} wrap minPresenceAhead={36}>
      <View style={D.sectionHead} wrap={false}>
        <View style={D.sectionHeadBar} />
        <Text style={D.sectionHeadText}>{toUpperGreekNoAccents(title)}</Text>
        {extra ? <Text style={D.sectionHeadExtra}>{extra}</Text> : null}
      </View>
      <View style={D.sectionBody}>{children}</View>
    </View>
  );
}

function StatusBadge({ status }) {
  if (!status) return <Text style={D.fieldValue}>—</Text>;
  const sc = statusColor(status);
  return (
    <Text style={[D.statusBadge, { backgroundColor: sc.bg, color: sc.text }]}>
      {pdfText(status)}
    </Text>
  );
}

/** Χωρίζει λίστα στοιχείων σε ομάδες των `size` για σειρές καρτών */
function chunkFacts(items, size = 3) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// ── Cover page ───────────────────────────────────────────────────────────────

function CoverPage({ basic, paymentSummary, appConfig, isPublishedToPortal, exportDate }) {
  const orgName = appConfig?.organizationFullName || appConfig?.organizationName || 'ERGOHUB';
  const dept = appConfig?.department || '';
  const sc = statusColor(basic.projectStatus);

  const moneyCells = [];
  if (basic.approvedAmount) {
    moneyCells.push({ label: 'ΕΓΚΕΚΡΙΜΕΝΟ', value: formatAmount(basic.approvedAmount) });
  }
  if (basic.projectBudget) {
    moneyCells.push({ label: 'ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ', value: formatAmount(basic.projectBudget) });
  }
  // Αρχικό ποσό σύμβασης / άθροισμα — ΟΧΙ το διαμορφωθέν μετά ΑΠΕ
  const isMultiContracts = !!basic.isMultipleContracts;
  const originalContractAmt = isMultiContracts
    ? (basic.totalContractAmount > 0
      ? formatAmount(basic.totalContractAmount)
      : (basic.contractAmount ? formatAmount(basic.contractAmount) : ''))
    : (basic.contractAmount
      ? formatAmount(basic.contractAmount)
      : (basic.totalContractAmount > 0 ? formatAmount(basic.totalContractAmount) : ''));
  const contractCoverLabel = isMultiContracts ? 'ΑΘΡΟΙΣΜΑ ΣΥΜΒΑΣΕΩΝ' : 'ΠΟΣΟ ΣΥΜΒΑΣΗΣ';
  if (isMeaningfulPdfValue(originalContractAmt)) {
    moneyCells.push({ label: contractCoverLabel, value: originalContractAmt });
  }
  // Τελικός ΑΠΕ — ξεχωριστό κελί όταν υπάρχει αναθεώρηση
  if (basic.hasFinalContractAmountAfterApe && isMeaningfulPdfValue(basic.finalContractAmountAfterApe)) {
    moneyCells.push({
      label: 'ΤΕΛΙΚΟΣ ΑΠΕ',
      value: formatAmount(basic.finalContractAmountAfterApe),
    });
  }
  if (paymentSummary?.hasPayments && isMeaningfulPdfValue(paymentSummary.paidAmountLabel)) {
    moneyCells.push({ label: 'ΠΛΗΡΩΜΕΝΟ', value: paymentSummary.paidAmountLabel });
  }

  // Προτεραιότητα στο εξώφυλλο: εγκεκριμένο · ποσό/άθροισμα · τελικός ΑΠΕ · πληρωμένο
  // (ο προϋπολογισμός παραχωρεί θέση όταν υπάρχουν ΑΠΕ + πληρωμές)
  const preferredCoverOrder = [
    'ΕΓΚΕΚΡΙΜΕΝΟ',
    'ΠΟΣΟ ΣΥΜΒΑΣΗΣ',
    'ΑΘΡΟΙΣΜΑ ΣΥΜΒΑΣΕΩΝ',
    'ΤΕΛΙΚΟΣ ΑΠΕ',
    'ΠΛΗΡΩΜΕΝΟ',
    'ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ',
  ];
  const orderedMoneyCells = preferredCoverOrder
    .map((label) => moneyCells.find((c) => c.label === label))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Page size="A4" style={[D.coverPage, { flexDirection: 'column' }]}>
      <View style={D.coverTopRule} />

      <View style={D.coverBrandRow}>
        <Image src={logoUrl} style={D.coverLogo} cache={false} />
        <View style={D.coverBrandCenter}>
          <Text style={D.coverBrandMark}>ERGOHUB</Text>
        </View>
        <View>
          <Text style={D.coverOrg}>{orgName}</Text>
          {dept ? <Text style={D.coverDept}>{dept}</Text> : null}
        </View>
      </View>

      <Text style={D.coverDocLabel}>{toUpperGreekNoAccents('Αναφορά Υποέργου')}</Text>

      {basic.projectTitle ? (
        <Text style={D.coverProjectLabel} wrap>
          Πράξη: {pdfText(basic.projectTitle)}
        </Text>
      ) : null}

      <Text style={D.coverTitle} wrap>{pdfText(basic.subprojectTitle)}</Text>

      <View style={D.coverBadgesRow}>
        {basic.projectStatus ? (
          <Text style={[D.coverBadge, { backgroundColor: sc.bg, color: sc.text }]}>
            {pdfText(basic.projectStatus)}
          </Text>
        ) : null}
        {basic.projectType ? (
          <Text style={[D.coverBadge, { backgroundColor: COLORS.skyLight, color: COLORS.sky }]}>
            {pdfText(basic.projectType)}
          </Text>
        ) : null}
        {basic.characterization ? (
          <Text style={[D.coverBadge, { backgroundColor: COLORS.amberLight, color: COLORS.amber }]}>
            {pdfText(basic.characterization)}
          </Text>
        ) : null}
        {basic.implementationForm ? (
          <Text style={[D.coverBadge, { backgroundColor: COLORS.rowAlt, color: COLORS.mid }]}>
            {pdfText(basic.implementationForm)}
          </Text>
        ) : null}
      </View>

      {orderedMoneyCells.length > 0 ? (
        <View style={D.coverMoneyRow}>
          {orderedMoneyCells.map((cell) => (
            <View key={cell.label} style={D.coverMoneyCell} wrap={false}>
              <Text style={D.coverMoneyLabel}>{cell.label}</Text>
              <Text style={D.coverMoneyVal}>{cell.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={D.coverSpacer} />

      <View style={D.coverMetaBlock}>
        <Text style={D.coverMetaLine}>Ημερομηνία έκδοσης: {exportDate}</Text>
        {basic.fundingSource ? (
          <Text style={D.coverMetaLine} wrap>
            Χρηματοδότηση: {pdfText(basic.fundingSource)}
          </Text>
        ) : null}
        {basic.displayChargePrimary ? (
          <Text style={D.coverMetaLine} wrap>
            Επιβλέπων: {pdfText(basic.displayChargePrimary)}
          </Text>
        ) : null}
        {isPublishedToPortal ? (
          <Text style={D.coverPortal}>Δημοσιευμένο στην Πύλη Διαφάνειας</Text>
        ) : null}
      </View>

      <ReportFooter />
    </Page>
  );
}

// ── Chain UI ─────────────────────────────────────────────────────────────────

function ChainHorizRow({ stages, startIndex }) {
  return (
    <View style={D.chainHorizRow} wrap={false}>
      {stages.map((item, i) => {
        const theme = stageTheme(item.themeKey);
        const globalIndex = startIndex + i;
        const isLastInRow = i === stages.length - 1;
        const dateDisp = displayDate(item.dateLabel);
        return (
          <React.Fragment key={`${item.type}-${globalIndex}-${item.adam || ''}`}>
            <View style={D.chainHorizNode}>
              <View style={[D.chainHorizCircle, { borderColor: theme.color, backgroundColor: theme.light }]}>
                <Text style={[D.chainHorizCircleNum, { color: theme.color }]}>{globalIndex + 1}</Text>
              </View>
              <Text style={[D.chainHorizLabel, { color: theme.color }]} wrap>
                {stageShortLabel(item)}
              </Text>
              {dateDisp !== '—' ? (
                <Text style={D.chainHorizDate} wrap>{dateDisp}</Text>
              ) : null}
            </View>
            {!isLastInRow ? (
              <View style={[D.chainHorizConnector, { backgroundColor: theme.mid }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function ChainHorizOverview({ stages }) {
  const perRow = horizNodesPerRow(stages.length);
  const rows = chunkArray(stages, perRow);
  return (
    <View style={D.chainHorizBlock} wrap>
      {rows.map((row, ri) => (
        <ChainHorizRow key={`horiz-${ri}`} stages={row} startIndex={ri * perRow} />
      ))}
    </View>
  );
}

function ChainMiniMap({ stages }) {
  const perRow = miniMapNodesPerRow(stages.length);
  const rows = chunkArray(stages, perRow);
  const dense = stages.length > CHAIN_COMPACT_THRESHOLD;
  return (
    <View style={{ marginBottom: 10 }} wrap>
      {rows.map((row, ri) => (
        <View key={`mini-${ri}`} style={D.chainMiniMapRow} wrap>
          {row.map((item, i) => {
            const theme = stageTheme(item.themeKey);
            const globalIndex = ri * perRow + i;
            const isLast = globalIndex === stages.length - 1;
            return (
              <React.Fragment key={`${item.type}-${globalIndex}`}>
                <View style={[
                  D.chainMiniDot,
                  dense ? D.chainMiniDotSm : {},
                  { backgroundColor: item.cancelled ? COLORS.warn : theme.color },
                ]}>
                  <Text style={[D.chainMiniDotNum, dense ? { fontSize: 5 } : {}]}>{globalIndex + 1}</Text>
                </View>
                {!isLast ? (
                  <View style={[D.chainMiniConnector, dense ? D.chainMiniConnectorSm : {}]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ChainRailNode({ item, index, isLast, mode }) {
  const theme = stageTheme(item.themeKey);
  const compact = mode === 'compact' || mode === 'dense';
  const field = topStageField(item);
  const dateDisp = displayDate(item.dateLabel);
  const metaParts = [
    dateDisp !== '—' ? dateDisp : null,
    item.adam || null,
  ].filter(Boolean);

  return (
    <View style={D.chainVertRow} wrap minPresenceAhead={compact ? 22 : 32}>
      <View style={D.chainVertGutter}>
        <View style={[
          D.chainVertDot,
          compact ? D.chainVertDotSm : {},
          {
            borderColor: item.cancelled ? COLORS.warn : theme.color,
            backgroundColor: item.cancelled ? COLORS.warnBg : theme.light,
          },
        ]} />
        {!isLast ? (
          <View style={[D.chainVertLine, { backgroundColor: theme.mid }]} />
        ) : null}
      </View>
      <View style={[D.chainVertContent, isLast ? D.chainVertContentLast : {}]}>
        <Text style={[
          D.chainVertStage,
          compact ? D.chainVertStageSm : {},
          { color: item.cancelled ? COLORS.warn : theme.color },
        ]} wrap>
          {index + 1}. {item.stageName}{item.cancelled ? ' [ακυρωμένο]' : ''}
        </Text>
        {!compact && item.title ? (
          <Text style={D.chainVertTitle} wrap>{truncatePdfText(item.title, 140)}</Text>
        ) : null}
        {metaParts.length > 0 ? (
          <Text style={D.chainVertMeta} wrap>{metaParts.join(' · ')}</Text>
        ) : null}
        {!compact && field ? (
          <Text style={D.chainVertField} wrap>
            {field.label}: {truncatePdfText(field.value, 80)}
          </Text>
        ) : null}
        {compact && field ? (
          <Text style={D.chainVertField} wrap>{truncatePdfText(field.value, 60)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function KhmdhsChainRailSection({ timeline }) {
  const stages = (timeline || []).filter(Boolean);
  if (!stages.length) return null;

  const mode = chainDisplayMode(stages.length);
  const showHoriz = mode === 'featured';
  const showMiniMap = mode === 'dense' || (mode === 'compact' && stages.length > CHAIN_HORIZ_MAX);

  return (
    <Section title={`Αλυσίδα ΚΗΜΔΗΣ · ${stages.length} κρίκοι`}>
      <Text style={D.chainRailIntro} wrap>
        {mode === 'featured'
          ? 'Η πορεία της διαδικασίας από το πρώτο έως το τελευταίο στάδιο στο ΚΗΜΔΗΣ.'
          : mode === 'dense'
            ? `Συνολικά ${stages.length} στάδια — συνοπτική χάρτηση και αναλυτική λίστα.`
            : `Χρονολογική αλυσίδα ${stages.length} σταδίων.`}
      </Text>

      {showHoriz ? <ChainHorizOverview stages={stages} /> : null}
      {showMiniMap ? <ChainMiniMap stages={stages} /> : null}

      {stages.map((item, i) => (
        <ChainRailNode
          key={`${item.type}-${i}-${item.adam || ''}`}
          item={item}
          index={i}
          isLast={i === stages.length - 1}
          mode={mode}
        />
      ))}

      {mode === 'dense' ? (
        <Text style={D.chainDenseNote} wrap>
          Για εκτενείς αλυσίδες εμφανίζονται συνοπτικά τα βασικά στοιχεία κάθε κρίκου.
        </Text>
      ) : null}
    </Section>
  );
}

// ── Content sections ─────────────────────────────────────────────────────────

function pdfAmountLabelsMatch(a, b) {
  const digits = (x) => String(x || '').replace(/[^\d,]/g, '');
  const da = digits(a);
  const db = digits(b);
  return !!da && da === db;
}

/** Πληρωμές — κάρτες σε σειρά, χωρίς κενό δεξιά / διπλό ποσό σύμβασης */
function PaymentFiguresBlock({ paymentSummary, hideContractAmount, contractAmountCaption }) {
  if (!paymentSummary?.hasContract && !paymentSummary?.hasPayments) return null;
  const cards = [];
  if (!hideContractAmount && isMeaningfulPdfValue(paymentSummary.contractAmountLabel)) {
    cards.push({
      label: contractAmountCaption
        || (paymentSummary.usesFinalApeReference ? 'Τελικό ποσό (μετά ΑΠΕ)' : 'Ποσό σύμβασης'),
      value: paymentSummary.contractAmountLabel,
    });
  }
  if (paymentSummary.hasPayments && isMeaningfulPdfValue(paymentSummary.paidAmountLabel)) {
    cards.push({ label: 'Πληρωμένο', value: paymentSummary.paidAmountLabel });
  }
  if (paymentSummary.hasContract && isMeaningfulPdfValue(paymentSummary.remainingLabel)) {
    cards.push({ label: 'Υπόλοιπο σύμβασης', value: paymentSummary.remainingLabel });
  }
  if (paymentSummary.paymentCount > 0) {
    cards.push({ label: 'Εντάλματα', value: String(paymentSummary.paymentCount) });
  }
  if (!cards.length) return null;

  return (
    <View style={D.paymentFigures} wrap>
      <Text style={D.paymentTitle}>{toUpperGreekNoAccents('Στοιχεία πληρωμών')}</Text>
      {chunkFacts(cards, 4).map((row, i) => (
        <FactCards key={`pay-${i}`} items={row} />
      ))}
    </View>
  );
}

function OverviewSection({ basic, isPublishedToPortal }) {
  const aleDisplay = formatReportAleCodes(basic);
  const hasMis = !!(basic.misPraxhsName && basic.misPraxhsCode);
  const hasRemaining = basic.remainingAmount || (basic.aleRemainingAmounts || []).some(Boolean);

  const identityCards = [
    basic.implementationForm ? { label: 'Μορφή', value: basic.implementationForm } : null,
    basic.projectType ? { label: 'Είδος', value: basic.projectType } : null,
    basic.projectStatus
      ? { label: 'Κατάσταση', value: basic.projectStatus, children: <StatusBadge status={basic.projectStatus} /> }
      : null,
    basic.characterization ? { label: 'Χαρακτηρισμός', value: basic.characterization } : null,
  ].filter(Boolean);

  const amountCards = [
    basic.approvedAmount
      ? { label: 'Εγκεκριμένο', value: formatAmount(basic.approvedAmount) }
      : null,
    basic.projectBudget
      ? { label: 'Προϋπολογισμός', value: formatAmount(basic.projectBudget) }
      : null,
    hasRemaining
      ? {
        label: `Υπόλοιπα${basic.remainingAmountYear ? ` ${basic.remainingAmountYear}` : ''}`,
        value: basic.remainingAmount ? formatAmount(basic.remainingAmount) : '—',
      }
      : null,
  ].filter(Boolean);

  let rowAlt = false;
  const nextAlt = () => {
    const a = rowAlt;
    rowAlt = !rowAlt;
    return a;
  };

  return (
    <Section title="Στοιχεία Υποέργου">
      <GroupLabel>Ταυτότητα</GroupLabel>
      <FieldList>
        <FieldRow label="Πράξη" value={basic.projectTitle} alt={nextAlt()} />
      </FieldList>
      {identityCards.length > 0 ? (
        chunkFacts(identityCards, 4).map((row, i) => (
          <FactCards key={`id-${i}`} items={row} />
        ))
      ) : null}

      <GroupLabel>Χρηματοδότηση</GroupLabel>
      <FieldList>
        <FieldRow label="Χρηματοδότηση" value={basic.fundingSource} alt={false} />
        {basic.fundingDetails
          ? <FieldRow label="Εξειδίκευση" value={basic.fundingDetails} alt />
          : null}
        {aleDisplay
          ? (
            <FieldRow
              label={basic.aleCodes?.length > 1 ? 'Κωδικοί Α.Λ.Ε.' : 'Κωδικός Α.Λ.Ε.'}
              value={aleDisplay}
              alt={!basic.fundingDetails}
            />
          )
          : null}
        {hasMis
          ? <FieldRow label={basic.misPraxhsName || 'MIS'} value={basic.misPraxhsCode} alt={!!aleDisplay} />
          : null}
      </FieldList>

      {amountCards.length > 0 ? (
        <>
          <GroupLabel>Ποσά</GroupLabel>
          <FactCards items={amountCards} />
        </>
      ) : null}

      <GroupLabel>Υπεύθυνοι & διαδικασία</GroupLabel>
      <FieldList>
        {basic.displayChargePrimary
          ? <FieldRow label="Επιβλέπων" value={basic.displayChargePrimary} alt={false} />
          : null}
        {basic.displayChargeParticipants
          ? <FieldRow label="Βοηθούν στην επίβλεψη" value={basic.displayChargeParticipants} alt />
          : null}
        {basic.assignmentProcedure
          ? (
            <FieldRow
              label="Διαδικασία ανάθεσης"
              value={basic.assignmentFromKhmdhs
                ? `${basic.assignmentProcedure} (ΚΗΜΔΗΣ)`
                : basic.assignmentProcedure}
              alt={!basic.displayChargeParticipants}
            />
          )
          : null}
        {isPublishedToPortal
          ? <FieldRow label="Πύλη Διαφάνειας" value="Δημοσιευμένο" alt />
          : null}
        {basic.updatedAt
          ? <FieldRow label="Τελευταία ενημέρωση" value={displayDate(basic.updatedAt)} alt={!isPublishedToPortal} />
          : null}
      </FieldList>
    </Section>
  );
}

function ContractPaymentsSection({ basic, paymentSummary, skipKhmdhsContractBlock }) {
  const hasMain = basic.isMultipleContracts
    ? (basic.contracts || []).length > 0
    : (basic.contractDate || basic.contractAmount || basic.khmdhsAdam);
  const hasSupp = (basic.supplementaryStageEntries || []).length > 0
    || (basic.hasSupplementaryContracts && (basic.supplementaryContracts || []).length > 0);
  const hasPayments = paymentSummary?.hasContract || paymentSummary?.hasPayments;
  if (!hasMain && !hasSupp && !hasPayments) return null;

  const suppEntries = (basic.supplementaryStageEntries || []).length
    ? basic.supplementaryStageEntries
    : (basic.supplementaryContracts || []).map((c, i) => ({
      title: `Συμπληρωματική ${i + 1}`,
      date: c.date,
      amount: c.amount,
      amountLabel: 'Ποσό',
      adam: c.khmdhsAdam || '',
      isExtension: false,
    }));

  const contractor = basic.khmdhsContractSnapshot?.anadoxosName
    || basic.contracts?.[0]?.khmdhsAnadoxos
    || '';
  const contractorVat = basic.khmdhsContractSnapshot?.anadoxosVat
    || basic.contracts?.[0]?.khmdhsVat
    || '';

  const showedMainContractAmount = !basic.isMultipleContracts && !!basic.contractAmount;
  const mainContractAmountLabel = showedMainContractAmount
    ? formatAmount(basic.contractAmount)
    : '';
  // Απόκρυψη μόνο όταν το ποσό στις πληρωμές είναι το ίδιο με αυτό που ήδη φαίνεται
  // (όχι όταν το συνολικό με συμπληρωματικές διαφέρει από το κύριο ποσό).
  const hideContractInPayments = showedMainContractAmount
    && isMeaningfulPdfValue(paymentSummary?.contractAmountLabel)
    && pdfAmountLabelsMatch(mainContractAmountLabel, paymentSummary.contractAmountLabel);

  const contractCards = !basic.isMultipleContracts
    ? [
      basic.contractDate
        ? { label: 'Ημερομηνία', value: displayDate(basic.contractDate) }
        : null,
      basic.contractAmount
        ? { label: 'Ποσό σύμβασης', value: formatAmount(basic.contractAmount) }
        : null,
      basic.apeAmount
        ? { label: 'ΑΠΕ (τελευταίο)', value: formatAmount(basic.apeAmount) }
        : null,
      basic.hasFinalContractAmountAfterApe && basic.finalContractAmountAfterApe
        ? {
          label: 'Τελικό μετά ΑΠΕ',
          value: formatAmount(basic.finalContractAmountAfterApe),
        }
        : null,
      basic.khmdhsAdam && !skipKhmdhsContractBlock
        ? { label: 'ΑΔΑΜ', value: basic.khmdhsAdam }
        : null,
    ].filter(Boolean)
    : [];

  return (
    <Section title="Σύμβαση & Εκτέλεση">
      {!basic.isMultipleContracts ? (
        <>
          {contractCards.length > 0
            ? chunkFacts(contractCards, 4).map((row, i) => (
              <FactCards key={`ctr-${i}`} items={row} />
            ))
            : null}
          {basic.hasFinalContractAmountAfterApe ? (
            <FieldList>
              <FieldRow
                label="Τελικό ποσό"
                value={
                  `${formatAmount(basic.finalContractAmountAfterApe)}`
                  + (basic.finalContractApeDate ? ` · ΑΠΕ ${displayDate(basic.finalContractApeDate)}` : '')
                }
              />
              <FieldRow
                label="Επεξήγηση"
                value={basic.finalContractAfterApeExplanation
                  || 'Τελικό διαμορφωθέν ποσό σύμβασης βάσει του πιο πρόσφατου ΑΠΕ.'}
              />
            </FieldList>
          ) : null}
          {contractor ? (
            <FieldList>
              <FieldRow
                label="Ανάδοχος"
                value={contractorVat ? `${contractor} (ΑΦΜ ${contractorVat})` : contractor}
              />
            </FieldList>
          ) : null}
        </>
      ) : (
        (basic.contracts || []).map((c, i) => (
          <View key={i} style={D.entityBlock} wrap>
            <Text style={D.entityTitle}>Σύμβαση {i + 1}</Text>
            <EKv label="Ημερομηνία" value={displayDate(c.date)} />
            <EKv label="Ποσό" value={c.amount ? formatAmount(c.amount) : ''} />
            {c.apeAmount ? <EKv label="ΑΠΕ (τελευταίο)" value={formatAmount(c.apeAmount)} /> : null}
            {c.khmdhsAdam ? <EKv label="ΑΔΑΜ" value={c.khmdhsAdam} /> : null}
            {c.khmdhsAnadoxos ? <EKv label="Ανάδοχος" value={c.khmdhsAnadoxos} /> : null}
          </View>
        ))
      )}
      {basic.isMultipleContracts && basic.hasFinalContractAmountAfterApe ? (
        <FieldList>
          <FieldRow
            label="Τελικό ποσό"
            value={
              `${formatAmount(basic.finalContractAmountAfterApe)}`
              + (basic.finalContractApeDate ? ` · τελευταίο ΑΠΕ ${displayDate(basic.finalContractApeDate)}` : '')
            }
          />
          <FieldRow
            label="Επεξήγηση"
            value={basic.finalContractAfterApeExplanation
              || 'Τελικό διαμορφωθέν ποσό συμβάσεων βάσει των πιο πρόσφατων ΑΠΕ.'}
          />
        </FieldList>
      ) : null}
      {(suppEntries || []).map((entry, i) => (
        <View
          key={`s-${entry.adam || i}`}
          style={[D.entityBlock, {
            borderLeft: `2.5px solid ${entry.isExtension ? COLORS.purpleMid : COLORS.greenMid}`,
          }]}
          wrap
        >
          <Text style={[D.entityTitle, { color: entry.isExtension ? COLORS.purple : COLORS.green }]}>
            {entry.title || `Συμπληρωματική ${i + 1}`}
          </Text>
          {entry.adam ? <EKv label="ΑΔΑΜ" value={entry.adam} /> : null}
          <EKv
            label={entry.isExtension ? 'Καταληκτική ημερομηνία' : 'Ημερομηνία'}
            value={displayDate(entry.date)}
          />
          {entry.amount ? (
            <EKv label={entry.amountLabel || 'Ποσό'} value={formatAmount(entry.amount)} />
          ) : null}
          {entry.contractor ? <EKv label="Ανάδοχος" value={entry.contractor} /> : null}
        </View>
      ))}
      <PaymentFiguresBlock
        paymentSummary={paymentSummary}
        hideContractAmount={hideContractInPayments}
        contractAmountCaption={
          showedMainContractAmount && !hideContractInPayments
            ? (basic.hasFinalContractAmountAfterApe
              ? 'Τελικό ποσό (μετά ΑΠΕ)'
              : 'Συνολικό ποσό σύμβασης')
            : undefined
        }
      />
    </Section>
  );
}

function EntaxeisSection({ entaxeis }) {
  if (!entaxeis?.length) return null;
  return (
    <Section title={`Συνδεδεμένες Εντάξεις (${entaxeis.length})`}>
      {entaxeis.map((e, i) => (
        <View key={e.entaxiId || i} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>
            Ένταξη {i + 1}{e.fundingAuthority ? ` — ${e.fundingAuthority}` : ''}
          </Text>
          <EKv label="Ημερομηνία" value={displayDate(e.documentDate)} />
          <EKv label="Αρχικό Ποσό" value={e.initialAmount ? formatAmount(e.initialAmount) : ''} />
          <EKv label="Τρέχον Ποσό" value={e.currentAmount ? formatAmount(e.currentAmount) : ''} />
          {e.subject ? <EKv label="Θέμα" value={e.subject} /> : null}
          {e.comments ? <EKv label="Σχόλια" value={e.comments} /> : null}
          {(e.entaxiPDFs || []).length > 0
            ? <EKv label="Αρχεία Ένταξης" value={e.entaxiPDFs.join(', ')} /> : null}
          {(e.approvalPDFs || []).length > 0
            ? <EKv label="Αρχεία Έγκρισης" value={e.approvalPDFs.join(', ')} /> : null}
          {(e.modifications || []).length > 0 && (
            <>
              {e.modifications.map((m) => (
                <View key={m.index} style={D.modBlock} wrap>
                  <Text style={D.modTitle}>Τροποποίηση #{m.index}</Text>
                  {m.date ? <MKv label="Ημερομηνία" value={displayDate(m.date)} /> : null}
                  {m.amount ? <MKv label="Ποσό" value={formatAmount(m.amount)} /> : null}
                  {m.description ? <MKv label="Περιγραφή" value={m.description} /> : null}
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
    <Section title={`Συνδεδεμένες Προσκλήσεις (${proskliseis.length})`}>
      {proskliseis.map((p, i) => (
        <View key={p.prosklisiId || i} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>{p.title || `Πρόσκληση ${i + 1}`}</Text>
          {p.axis ? <EKv label="Άξονας" value={p.axis} /> : null}
          {p.code ? <EKv label="Κωδικός" value={p.code} /> : null}
          {p.fundingSource ? <EKv label="Πηγή Χρηματ." value={p.fundingSource} /> : null}
          {p.budgetRange ? <EKv label="Εύρος Π/Υ" value={p.budgetRange} /> : null}
          {p.status ? <EKv label="Κατάσταση" value={p.status} /> : null}
          {p.deadline ? <EKv label="Ημ. Λήξης" value={displayDate(p.deadline)} /> : null}
          {p.comments ? <EKv label="Σχόλια" value={p.comments} /> : null}
          {(p.modifications || []).length > 0 && (
            <>
              {p.modifications.map((m) => (
                <View key={m.index} style={D.modBlock} wrap>
                  <Text style={D.modTitle}>Τροποποίηση #{m.index}</Text>
                  {m.date ? <MKv label="Ημερομηνία" value={displayDate(m.date)} /> : null}
                  {m.title ? <MKv label="Τίτλος" value={m.title} /> : null}
                  {m.status ? <MKv label="Κατάσταση" value={m.status} /> : null}
                  {m.budgetRange ? <MKv label="Εύρος Π/Υ" value={m.budgetRange} /> : null}
                  {m.notes ? <MKv label="Σημειώσεις" value={m.notes} /> : null}
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
    <Section title={`Επιχειρησιακό Πρόγραμμα (${epActions.length})`}>
      {epActions.map((a, i) => (
        <View key={i} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>Δράση #{a.aa || '—'}: {pdfText(a.title)}</Text>
          {(a.axisCode || a.measureCode || a.objectiveCode)
            ? <EKv label="Ιεραρχία" value={[a.axisCode, a.measureCode, a.objectiveCode].filter(Boolean).join(' > ')} />
            : null}
          {a.actionType ? <EKv label="Τύπος" value={a.actionType} /> : null}
          {a.location ? <EKv label="Χωροθέτηση" value={a.location} /> : null}
          {a.programTitle ? <EKv label="Πρόγραμμα" value={a.programTitle} /> : null}
          {a.priority ? <EKv label="Προτεραιότητα" value={String(a.priority)} /> : null}
          {a.total != null && a.total !== 0
            ? (
              <EKv
                label="Προϋπολογισμός"
                value={Number(a.total).toLocaleString('el-GR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}
              />
            )
            : null}
          {a.isNew != null
            ? <EKv label="Χαρακτηρισμός" value={a.isNew ? 'Νέα δράση' : 'Συνεχιζόμενη'} />
            : null}
        </View>
      ))}
    </Section>
  );
}

function EgkriseisSection({ egkriseis, egkrisiLinks }) {
  const total = countEgkriseis(egkriseis, egkrisiLinks);
  if (total === 0) return null;
  return (
    <Section title={`Εγκρίσεις Διάθεσης Πίστωσης (${total})`}>
      {(egkriseis || []).map((eg, i) => (
        <View key={eg.id || `eg-${i}`} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>
            {eg.type || 'Έγκριση'} {i + 1}{eg.fileName ? ` — ${eg.fileName}` : ''}
          </Text>
          {eg.date ? <EKv label="Ημερομηνία" value={displayDate(eg.date)} /> : null}
          {eg.subprojectTitle ? <EKv label="Υποέργο" value={eg.subprojectTitle} /> : null}
          {eg.notes ? <EKv label="Σημειώσεις" value={eg.notes} /> : null}
        </View>
      ))}
      {(egkrisiLinks || []).map((l, i) => (
        <View key={`link-${i}`} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>
            Συνδεδεμένη έγκριση {(egkriseis?.length || 0) + i + 1}
          </Text>
          <EKv label="Τίτλος" value={l.egkrisiTitle || '—'} />
          {l.autoLinked ? <EKv label="Τύπος" value="Αυτόματη συσχέτιση" /> : null}
        </View>
      ))}
    </Section>
  );
}

function MeletaiSection({ meleti }) {
  if (!meleti) return null;
  const topCards = [
    meleti.studyNumber ? { label: 'Αριθμός μελέτης', value: meleti.studyNumber } : null,
    meleti.category ? { label: 'Κατηγορία', value: meleti.category } : null,
    meleti.fileCount > 0 ? { label: 'Αρχεία', value: String(meleti.fileCount) } : null,
    meleti.updatedAt ? { label: 'Τελ. ενημέρωση', value: displayDate(meleti.updatedAt) } : null,
  ].filter(Boolean);

  return (
    <Section title="Συνδεδεμένη Μελέτη">
      {topCards.length > 0
        ? chunkFacts(topCards, 4).map((row, i) => (
          <FactCards key={`mel-${i}`} items={row} />
        ))
        : null}
      <FieldList>
        {meleti.title ? <FieldRow label="Τίτλος" value={meleti.title} /> : null}
        {meleti.assignedTo
          ? <FieldRow label="Ανατέθηκε σε" value={meleti.assignedTo} alt={!!meleti.title} />
          : null}
      </FieldList>
      {meleti.notes ? (
        <View style={{ marginTop: 6 }}>
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

function NotesSection({ linkedNotes, comments, eisigitiki }) {
  if (!linkedNotes?.length && !comments && !eisigitiki) return null;
  return (
    <Section title="Σημειώσεις & Κείμενα">
      {comments ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={D.groupTitle}>Σχόλια Υποέργου</Text>
          <Text style={D.proseBlock} wrap>{pdfText(comments)}</Text>
        </View>
      ) : null}
      {eisigitiki ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={D.groupTitle}>Αναφορά από πρόγραμμα Οικονομικής</Text>
          <Text style={D.proseBlock} wrap>{pdfText(eisigitiki)}</Text>
        </View>
      ) : null}
      {(linkedNotes || []).map((n, i) => (
        <View key={i} style={D.entityBlock} wrap>
          <Text style={D.entityTitle}>Σημείωση: {pdfText(n.title)}</Text>
          {n.updatedAt ? <EKv label="Ενημέρωση" value={displayDate(n.updatedAt)} /> : null}
          {n.content ? <Text style={D.proseBlock} wrap>{pdfText(n.content)}</Text> : null}
        </View>
      ))}
    </Section>
  );
}

function ComplianceWarnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <View style={D.warnSection} wrap>
      <View style={D.warnHead} wrap={false}>
        <Text style={D.warnHeadText}>{toUpperGreekNoAccents('Σημείωση συμμόρφωσης')}</Text>
      </View>
      <View style={D.warnBody}>
        {warnings.map((w, i) => (
          <View key={i} style={D.warnBox}>
            <Text style={D.warnText}>{pdfText(w)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SubprojectDetailReport({ data, appConfig }) {
  const {
    basic, entaxeis, proskliseis, egkriseis, egkrisiLinks,
    epActions, linkedNotes, complianceWarnings, meleti, meta,
    paymentSummary, chronologicalTimeline,
  } = data;

  const exportDate = nowFormatted();
  const hideAdamInContractSection = basic.isMultipleContracts
    ? (basic.contracts || []).some((c) => c.khmdhsAdam)
    : !!basic.khmdhsAdam;

  const contSubtitle = shortTitle(basic.subprojectTitle, 52);

  return (
    <Document
      title={`ERGOHUB — ${basic.subprojectTitle}`}
      author="ERGOHUB"
      subject="Αναφορά Υποέργου"
    >
      <CoverPage
        basic={basic}
        paymentSummary={paymentSummary}
        appConfig={appConfig}
        isPublishedToPortal={meta?.isPublishedToPortal}
        exportDate={exportDate}
      />

      <Page
        size="A4"
        style={[S.page, { paddingTop: PAGE_MARGIN_TOP + CONTINUATION_HEADER_H }]}
        wrap
      >
        <ReportContinuationHeader exportDate={exportDate} subtitle={contSubtitle} />

        <View style={D.content}>
          <View style={D.contentIntro} wrap={false}>
            <Text style={D.contentIntroLabel}>
              {toUpperGreekNoAccents('Αναφορά Υποέργου')}
            </Text>
            <Text style={D.contentIntroTitle} wrap>{pdfText(basic.subprojectTitle)}</Text>
            <Text style={D.contentIntroMeta} wrap>
              {[
                basic.projectTitle ? `Πράξη: ${pdfText(basic.projectTitle)}` : null,
                basic.projectStatus ? pdfText(basic.projectStatus) : null,
              ].filter(Boolean).join('  ·  ')}
            </Text>
          </View>

          <ComplianceWarnings warnings={complianceWarnings} />
          <OverviewSection basic={basic} isPublishedToPortal={meta?.isPublishedToPortal} />
          <ContractPaymentsSection
            basic={basic}
            paymentSummary={paymentSummary}
            skipKhmdhsContractBlock={hideAdamInContractSection}
          />
          <KhmdhsChainRailSection timeline={chronologicalTimeline} />
          <EntaxeisSection entaxeis={entaxeis} />
          <ProskliseisSection proskliseis={proskliseis} />
          <EgkriseisSection egkriseis={egkriseis} egkrisiLinks={egkrisiLinks} />
          <EpSection epActions={epActions} />
          <MeletaiSection meleti={meleti} />
          <NotesSection
            linkedNotes={linkedNotes}
            comments={basic.comments}
            eisigitiki={basic.eisigitikiEkthesi}
          />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
