import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { S, COLORS, formatDate, formatAmount, statusColor, CONTINUATION_HEADER_H, PAGE_MARGIN_TOP, nowFormatted } from './ReportStyles';
import ReportHeader from './ReportHeader';
import ReportFooter from './ReportFooter';
import ReportContinuationHeader from './ReportContinuationHeader';

function formatReportAleCodes(basic) {
  const codes = (basic?.aleCodes || []).filter((c) => c && String(c).trim());
  return codes.length ? codes.join(' · ') : '';
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

function stageTheme(themeKey) {
  return THEME[themeKey] || THEME.proc;
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

function truncatePdfText(text, maxLen) {
  const s = pdfText(text);
  if (!s || s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function topStageField(item) {
  const fields = (item?.fields || []).filter((f) => f && f.value);
  return fields[0] || null;
}

function ChainHorizRow({ stages, startIndex }) {
  return (
    <View style={D.chainHorizRow} wrap={false}>
      {stages.map((item, i) => {
        const theme = stageTheme(item.themeKey);
        const globalIndex = startIndex + i;
        const isLastInRow = i === stages.length - 1;
        return (
          <React.Fragment key={`${item.type}-${globalIndex}-${item.adam || ''}`}>
            <View style={D.chainHorizNode}>
              <View style={[D.chainHorizCircle, { borderColor: theme.color, backgroundColor: theme.light }]}>
                <Text style={[D.chainHorizCircleNum, { color: theme.color }]}>{globalIndex + 1}</Text>
              </View>
              <Text style={[D.chainHorizLabel, { color: theme.color }]} wrap>
                {stageShortLabel(item)}
              </Text>
              {item.dateLabel && item.dateLabel !== '—' ? (
                <Text style={D.chainHorizDate} wrap>{item.dateLabel}</Text>
              ) : null}
            </View>
            {!isLastInRow ? <View style={[D.chainHorizConnector, { backgroundColor: theme.mid }]} /> : null}
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
    <View style={{ marginBottom: 8 }} wrap>
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
                  <Text style={[D.chainMiniDotNum, dense ? { fontSize: 4.5 } : {}]}>{globalIndex + 1}</Text>
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
  const metaParts = [
    item.dateLabel && item.dateLabel !== '—' ? item.dateLabel : null,
    item.adam || null,
  ].filter(Boolean);

  return (
    <View style={D.chainVertRow} wrap minPresenceAhead={compact ? 18 : 28}>
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
    <Section title={`Αλυσίδα ΚΗΜΔΗΣ · ${stages.length} κρίκοι`} themeKey="proc">
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
  paymentFigures: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: `1px solid ${COLORS.hairline}`,
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

  // ── KHMDHS chain rail ─────────────────────────────────────────────────────
  chainRailIntro: {
    fontSize: 6.5,
    color: COLORS.muted,
    lineHeight: 1.45,
    marginBottom: 8,
  },
  chainHorizBlock: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: COLORS.rowAlt,
    border: `1px solid ${COLORS.hairline}`,
  },
  chainHorizRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 6,
  },
  chainHorizNode: {
    alignItems: 'center',
    width: 72,
    paddingHorizontal: 2,
  },
  chainHorizCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  chainHorizCircleNum: {
    fontSize: 7,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  chainHorizLabel: {
    fontSize: 5.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.35,
    color: COLORS.dark,
  },
  chainHorizDate: {
    fontSize: 5,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 1,
    lineHeight: 1.3,
  },
  chainHorizConnector: {
    width: 14,
    height: 2,
    marginTop: 10,
    backgroundColor: COLORS.hairline,
  },
  chainMiniMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  chainMiniDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainMiniDotSm: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  chainMiniDotNum: {
    fontSize: 5.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: '#fff',
  },
  chainMiniConnector: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.hairline,
  },
  chainMiniConnectorSm: {
    width: 5,
  },
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
    minHeight: 12,
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
    fontSize: 7.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    lineHeight: 1.4,
    marginBottom: 2,
  },
  chainVertStageSm: {
    fontSize: 6.5,
  },
  chainVertTitle: {
    fontSize: 7,
    color: COLORS.dark,
    lineHeight: 1.45,
    marginBottom: 2,
  },
  chainVertMeta: {
    fontSize: 6.5,
    fontFamily: 'DejaVu',
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  chainVertField: {
    fontSize: 6.5,
    color: COLORS.mid,
    lineHeight: 1.4,
    marginTop: 1,
  },
  chainDenseNote: {
    fontSize: 6,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
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

/** Στοιχεία πληρωμών — κείμενο μόνο, χωρίς γραφικά */
function PaymentFiguresBlock({ paymentSummary }) {
  if (!paymentSummary?.hasContract && !paymentSummary?.hasPayments) return null;
  return (
    <View style={D.paymentFigures} wrap>
      <Kv label="Ποσό σύμβασης" value={paymentSummary.contractAmountLabel} />
      <Kv label="Πληρωμένο" value={paymentSummary.paidAmountLabel} />
      <Kv label="Υπόλοιπο σύμβασης" value={paymentSummary.remainingLabel} />
      {paymentSummary.paymentCount > 0 ? (
        <Kv label="Εντάλματα πληρωμής" value={String(paymentSummary.paymentCount)} />
      ) : null}
    </View>
  );
}

/** Ενότητα 1 — ταυτότητα, χρηματοδότηση, υπεύθυνοι */
function OverviewSection({ basic, isPublishedToPortal }) {
  const sc = statusColor(basic.projectStatus);
  const aleDisplay = formatReportAleCodes(basic);
  const hasMis = !!(basic.misPraxhsName && basic.misPraxhsCode);
  const hasRemaining = basic.remainingAmount || (basic.aleRemainingAmounts || []).some(Boolean);

  return (
    <Section title="Στοιχεία Υποέργου" themeKey="identity">
      <View style={D.kvGrid}>
        <Kv label="Πράξη" value={basic.projectTitle} full />
        <Kv label="Μορφή" value={basic.implementationForm} />
        <Kv label="Είδος" value={basic.projectType} />
        <View style={D.kvRow} wrap>
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
        {basic.characterization ? <Kv label="Χαρακτηρισμός" value={basic.characterization} /> : null}
        <Kv label="Χρηματοδότηση" value={basic.fundingSource} full />
        {basic.fundingDetails ? <Kv label="Εξειδίκευση" value={basic.fundingDetails} full /> : null}
        <Kv label="Εγκεκριμένο" value={basic.approvedAmount ? formatAmount(basic.approvedAmount) : ''} />
        <Kv label="Προϋπολογισμός" value={basic.projectBudget ? formatAmount(basic.projectBudget) : ''} />
        {aleDisplay ? (
          <Kv
            label={basic.aleCodes?.length > 1 ? 'Κωδικοί Α.Λ.Ε.' : 'Κωδικός Α.Λ.Ε.'}
            value={aleDisplay}
            full
          />
        ) : null}
        {hasMis ? <Kv label={basic.misPraxhsName} value={basic.misPraxhsCode} full /> : null}
        {basic.displayChargePrimary ? <Kv label="Επιβλέπων" value={basic.displayChargePrimary} full /> : null}
        {basic.displayChargeParticipants ? (
          <Kv label="Βοηθούν στην επίβλεψη" value={basic.displayChargeParticipants} full />
        ) : null}
        {basic.assignmentProcedure ? (
          <Kv
            label="Διαδικασία ανάθεσης"
            value={basic.assignmentFromKhmdhs
              ? `${basic.assignmentProcedure} (ΚΗΜΔΗΣ)`
              : basic.assignmentProcedure}
            full
          />
        ) : null}
        {hasRemaining ? (
          <Kv
            label={`Υπόλοιπα${basic.remainingAmountYear ? ` ${basic.remainingAmountYear}` : ''}`}
            value={basic.remainingAmount ? formatAmount(basic.remainingAmount) : ''}
          />
        ) : null}
        {isPublishedToPortal ? <Kv label="Πύλη Διαφάνειας" value="Δημοσιευμένο" /> : null}
        {basic.updatedAt ? <Kv label="Τελευταία ενημέρωση" value={formatDate(basic.updatedAt)} /> : null}
      </View>
    </Section>
  );
}

/** Ενότητα 2 — σύμβαση, ανάδοχος, πληρωμές */
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

  return (
    <Section title="Σύμβαση & Εκτέλεση" themeKey="symv">
      {!basic.isMultipleContracts ? (
        <View style={D.kvGrid} wrap>
          <Kv label="Ημερομηνία σύμβασης" value={formatDate(basic.contractDate)} />
          <Kv label="Ποσό σύμβασης" value={basic.contractAmount ? formatAmount(basic.contractAmount) : ''} />
          {basic.apeAmount ? <Kv label="ΑΠΕ" value={formatAmount(basic.apeAmount)} /> : null}
          {basic.khmdhsAdam && !skipKhmdhsContractBlock ? <Kv label="ΑΔΑΜ" value={basic.khmdhsAdam} /> : null}
          {contractor ? (
            <Kv
              label="Ανάδοχος"
              value={contractorVat ? `${contractor} (ΑΦΜ ${contractorVat})` : contractor}
              full
            />
          ) : null}
        </View>
      ) : (
        (basic.contracts || []).map((c, i) => (
          <View key={i} style={[D.entityBlock, { borderLeft: `2px solid ${COLORS.roseMid}` }]} wrap>
            <Text style={D.entityTitle}>Σύμβαση {i + 1}</Text>
            <EKv label="Ημερομηνία" value={formatDate(c.date)} />
            <EKv label="Ποσό" value={c.amount ? formatAmount(c.amount) : ''} />
            {c.apeAmount ? <EKv label="ΑΠΕ" value={formatAmount(c.apeAmount)} /> : null}
            {c.khmdhsAdam ? <EKv label="ΑΔΑΜ" value={c.khmdhsAdam} /> : null}
            {c.khmdhsAnadoxos ? <EKv label="Ανάδοχος" value={c.khmdhsAnadoxos} /> : null}
          </View>
        ))
      )}
      {(suppEntries || []).map((entry, i) => (
        <View
          key={`s-${entry.adam || i}`}
          style={[D.entityBlock, {
            borderLeft: `2px solid ${entry.isExtension ? COLORS.purpleMid : COLORS.greenMid}`,
          }]}
          wrap
        >
          <Text style={[D.entityTitle, { color: entry.isExtension ? COLORS.purple : COLORS.green }]}>
            {entry.title || `Συμπληρωματική ${i + 1}`}
          </Text>
          {entry.adam ? <EKv label="ΑΔΑΜ" value={entry.adam} /> : null}
          <EKv label={entry.isExtension ? 'Καταληκτική ημερομηνία' : 'Ημερομηνία'} value={formatDate(entry.date)} />
          {entry.amount ? (
            <EKv label={entry.amountLabel || 'Ποσό'} value={formatAmount(entry.amount)} />
          ) : null}
          {entry.contractor ? <EKv label="Ανάδοχος" value={entry.contractor} /> : null}
        </View>
      ))}
      <PaymentFiguresBlock paymentSummary={paymentSummary} />
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

export default function SubprojectDetailReport({ data, appConfig }) {
  const {
    basic, entaxeis, proskliseis, egkriseis, egkrisiLinks,
    epActions, linkedNotes, complianceWarnings, meleti, meta,
    paymentSummary, chronologicalTimeline,
  } = data;

  const sc = statusColor(basic.projectStatus);
  const hideAdamInContractSection = basic.isMultipleContracts
    ? (basic.contracts || []).some((c) => c.khmdhsAdam)
    : !!basic.khmdhsAdam;

  return (
    <Document
      title={`ERGOHUB — ${basic.subprojectTitle}`}
      author="ERGOHUB"
      subject="Αναφορά Υποέργου"
    >
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
              {basic.characterization ? (
                <Text style={[D.heroBadge, { backgroundColor: COLORS.amberLight, color: COLORS.amber }]}>
                  {pdfText(basic.characterization)}
                </Text>
              ) : null}
            </View>
          </View>

          {(complianceWarnings || []).length > 0 && (
            <View style={[D.section, { borderColor: COLORS.warnBorder }]} wrap>
              <View style={[D.sectionHead, { backgroundColor: COLORS.warnBg, borderBottom: `1px solid ${COLORS.warnBorder}` }]} wrap={false}>
                <View style={[D.sectionHeadDot, { backgroundColor: COLORS.warn }]} />
                <Text style={[D.sectionHeadText, { color: COLORS.warn }]}>Σημείωση συμμόρφωσης</Text>
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
          <NotesSection linkedNotes={linkedNotes} comments={basic.comments} eisigitiki={basic.eisigitikiEkthesi} />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
