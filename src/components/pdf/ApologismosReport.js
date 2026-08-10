import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
// Side-effect: εγγραφή DejaVu για ελληνικά
import './ReportStyles';
import {
  GEOM,
  SLIDE_W,
  SLIDE_H,
  rgbaOf,
  resolveSlideDesign,
  coverScrimBands,
  buildFooter,
} from '../../utils/apologismosSlideDesign';

/**
 * Έγγραφο απολογισμού — ίδια γεωμετρία και τυπογραφία με την παρουσίαση
 * οθόνης και τις διαφάνειες (καμβάς 960×540, 1 μονάδα = 1 pt).
 */

const PAGE_SIZE = { width: SLIDE_W, height: SLIDE_H };
const FONT = 'DejaVu';

const PHOTO_PHASE_LABELS = {
  before: 'Πριν',
  during: 'Κατά τη διάρκεια',
  after: 'Μετά',
};
const phaseLabel = (phase) => PHOTO_PHASE_LABELS[phase] || phase;

function formatEuro(value) {
  if (value == null || value === '') return '—';
  let n;
  if (typeof value === 'number') {
    n = value;
  } else {
    const raw = String(value).trim();
    if (!raw) return '—';
    n = Number(raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.'));
  }
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function Eyebrow({ children, color, size, style }) {
  if (!children) return null;
  return (
    <Text
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 'bold',
        letterSpacing: 1.4,
        color,
        ...style,
      }}
    >
      {String(children).toLocaleUpperCase('el-GR')}
    </Text>
  );
}

function Rule({ color, width = GEOM.headerRuleW, height = GEOM.headerRuleH, style }) {
  return <View style={{ width, height, backgroundColor: color, borderRadius: height, ...style }} />;
}

function StatStrip({ stats, design, onDark = false, gap = 30 }) {
  const { type, colors } = design;
  if (!stats?.length) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{
            paddingLeft: 11,
            marginRight: i === stats.length - 1 ? 0 : gap,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            borderLeftStyle: 'solid',
          }}
        >
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.statLabel,
              fontWeight: 'bold',
              letterSpacing: 1,
              color: onDark ? colors.darkMuted : colors.muted,
              marginBottom: 3,
            }}
          >
            {String(s.label).toLocaleUpperCase('el-GR')}
          </Text>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.statValue,
              fontWeight: 'bold',
              color: onDark ? colors.darkText : colors.text,
            }}
          >
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function KpiCards({ items, design, height = GEOM.kpiH }) {
  const { type, colors } = design;
  return (
    <View style={{ flexDirection: 'row' }}>
      {items.map((k, i) => (
        <View
          key={k.label}
          style={{
            flex: 1,
            height,
            marginRight: i === items.length - 1 ? 0 : GEOM.gutter,
            borderRadius: GEOM.cardRadius,
            padding: GEOM.kpiPad,
            justifyContent: 'center',
            backgroundColor: k.tone === 'accent' ? colors.accent : colors.cardDark,
          }}
        >
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.kpiLabel,
              fontWeight: 'bold',
              letterSpacing: 1.1,
              marginBottom: 8,
              color: k.tone === 'accent' ? colors.accentText : colors.darkText,
            }}
          >
            {String(k.label).toLocaleUpperCase('el-GR')}
          </Text>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: k.big ? type.kpiValueHero : type.kpiValue,
              fontWeight: 'bold',
              color: k.tone === 'accent' ? colors.accentText : colors.darkText,
            }}
          >
            {k.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SlideFooter({ design, footerBase, onDark = false }) {
  const { type, colors } = design;
  if (!footerBase) return null;
  return (
    <View
      style={{
        marginTop: GEOM.footerRuleY - GEOM.contentBottom,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: onDark ? colors.darkHairline : colors.hairline,
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: GEOM.footerTextH + 11,
      }}
    >
      <Text
        style={{
          fontFamily: FONT,
          fontSize: type.footer,
          letterSpacing: 0.8,
          color: onDark ? colors.darkMuted : colors.muted,
        }}
      >
        {String(footerBase.left || '').toLocaleUpperCase('el-GR')}
      </Text>
      <Text
        style={{
          fontFamily: FONT,
          fontSize: type.footer,
          fontWeight: 'bold',
          color: onDark ? colors.darkMuted : colors.muted,
        }}
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function PhotoFrame({ src, caption, design, isLast }) {
  const { type, colors } = design;
  return (
    <View style={{ flex: 1, marginRight: isLast ? 0 : GEOM.gutter }}>
      {caption ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View
            style={{
              width: 6, height: 6, borderRadius: 3, marginRight: 7,
              backgroundColor: colors.accent,
            }}
          />
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.caption,
              fontWeight: 'bold',
              letterSpacing: 1,
              color: colors.muted,
            }}
          >
            {String(caption).toLocaleUpperCase('el-GR')}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          flex: 1,
          borderRadius: GEOM.cardRadius,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: colors.photoFrame,
          backgroundColor: colors.photoPlaceholder,
          overflow: 'hidden',
        }}
      >
        {src ? <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      </View>
    </View>
  );
}

function CoverMeta({ model, design, align = 'bottom' }) {
  const { type, colors } = design;
  const cover = model?.cover || {};
  const totals = model?.totals || {};
  const white = colors.darkText;
  return (
    <View>
      <Rule color={colors.accent} width={GEOM.coverRuleW} height={5} style={{ marginBottom: 18 }} />
      <Eyebrow color={rgbaOf(white, 0.82)} size={type.eyebrow}>
        {cover.organizationTitle}
      </Eyebrow>
      <Text
        style={{
          fontFamily: FONT,
          fontSize: type.titleHero,
          fontWeight: 'bold',
          color: white,
          marginTop: 12,
          lineHeight: 1.1,
          maxWidth: align === 'side' ? '100%' : 720,
        }}
      >
        {cover.reportTitle || 'Απολογισμός τεχνικού έργου'}
      </Text>
      <Text
        style={{
          fontFamily: FONT,
          fontSize: type.subtitle,
          color: rgbaOf(white, 0.9),
          marginTop: 12,
        }}
      >
        {cover.periodLabel || model?.period?.label || ''}
      </Text>
      {cover.subtitle ? (
        <Text
          style={{
            fontFamily: FONT,
            fontSize: type.body,
            color: rgbaOf(white, 0.78),
            marginTop: 6,
            maxWidth: align === 'side' ? '100%' : 640,
          }}
        >
          {cover.subtitle}
        </Text>
      ) : null}
      {design.coverStats ? (
        <View style={{ marginTop: 20 }}>
          <StatStrip
            design={design}
            onDark
            gap={26}
            stats={[
              { label: 'Έργα', value: String(totals.projectCount ?? 0) },
              { label: 'Εγκεκριμένα', value: formatEuro(totals.totalApproved) },
              { label: 'Συμβάσεις', value: formatEuro(totals.totalContract) },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function CoverPage({ model, design, mediaMap }) {
  const { colors } = design;
  const cover = model?.cover || {};
  const resolve = (img) => {
    if (!img) return null;
    if (img.framedDataUrl) return img.framedDataUrl;
    return (img.relativePath && mediaMap?.[img.relativePath]) || null;
  };
  const imgs = cover.images || [];
  const src0 = resolve(imgs[0]);
  const src1 = resolve(imgs[1]);
  const layoutId = cover.layoutId || 'hero_single';

  if (layoutId === 'hero_side') {
    return (
      <Page size={PAGE_SIZE} style={{ backgroundColor: colors.darkBand, flexDirection: 'row' }}>
        <View style={{ width: '52%', height: '100%', backgroundColor: colors.cardDark }}>
          {src0 ? <Image src={src0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        </View>
        <View
          style={{
            flex: 1,
            paddingHorizontal: GEOM.coverPadX,
            paddingVertical: GEOM.coverPadY,
            justifyContent: 'center',
          }}
        >
          <CoverMeta model={model} design={design} align="side" />
        </View>
      </Page>
    );
  }

  return (
    <Page size={PAGE_SIZE} style={{ backgroundColor: colors.darkBand }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', flexDirection: 'row' }}>
        {layoutId === 'hero_split' ? (
          <>
            <View style={{ flex: 1, height: '100%' }}>
              {src0 ? <Image src={src0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </View>
            <View style={{ width: 3, height: '100%', backgroundColor: colors.accent }} />
            <View style={{ flex: 1, height: '100%' }}>
              {src1 ? <Image src={src1} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </View>
          </>
        ) : (
          <View style={{ flex: 1, height: '100%' }}>
            {src0 ? <Image src={src0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </View>
        )}
      </View>
      {coverScrimBands().map((band, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: band.y,
            height: band.height,
            backgroundColor: rgbaOf(colors.darkBand, band.alpha),
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: GEOM.coverPadX,
          right: GEOM.coverPadX,
          bottom: GEOM.coverPadY,
        }}
      >
        <CoverMeta model={model} design={design} />
      </View>
    </Page>
  );
}

function CategoryPage({ section, design, footerBase, sectionIndex, sectionTotal }) {
  const { type, colors } = design;
  return (
    <Page
      size={PAGE_SIZE}
      style={{
        backgroundColor: colors.darkBand,
        paddingTop: GEOM.marginTop,
        paddingHorizontal: GEOM.marginX,
        flexDirection: 'column',
      }}
    >
      <Text
        style={{
          position: 'absolute',
          right: GEOM.marginX,
          top: 54,
          fontFamily: FONT,
          fontSize: 210,
          fontWeight: 'bold',
          color: colors.darkGhost,
        }}
      >
        {String(sectionIndex || '')}
      </Text>
      <View style={{ height: GEOM.contentBottom - GEOM.marginTop, justifyContent: 'center' }}>
        <Rule color={colors.accent} width={GEOM.coverRuleW} height={5} style={{ marginBottom: 18 }} />
        <Eyebrow color={rgbaOf(colors.darkText, 0.72)} size={type.eyebrow}>
          {sectionIndex && sectionTotal
            ? `Κατηγορία ${sectionIndex} από ${sectionTotal}`
            : 'Κατηγορία έργων'}
        </Eyebrow>
        <Text
          style={{
            fontFamily: FONT,
            fontSize: type.titleSection,
            fontWeight: 'bold',
            color: colors.darkText,
            marginTop: 12,
            marginBottom: 28,
            maxWidth: 700,
            lineHeight: 1.14,
          }}
        >
          {section.label}
        </Text>
        <KpiCards
          design={design}
          items={[
            { label: 'Έργα', value: String(section.count), tone: 'accent', big: true },
            { label: 'Εγκεκριμένα', value: formatEuro(section.totalApproved), tone: 'dark' },
            { label: 'Συμβάσεις', value: formatEuro(section.totalContract), tone: 'dark' },
          ]}
        />
      </View>
      <SlideFooter design={design} footerBase={footerBase} onDark />
    </Page>
  );
}

function ProjectContent({ page, display, design, mediaMap }) {
  const { type, colors } = design;
  const resolve = (rel) => (rel && mediaMap?.[rel]) || null;

  if (page.type === 'primary_photos' || page.type === 'primary') {
    const entries = Object.entries(page.primary || {}).filter(([, rel]) => rel);
    if (!entries.length) return null;
    return (
      <View style={{ flexDirection: 'row', height: '100%' }}>
        {entries.map(([phase, rel], i) => (
          <PhotoFrame
            key={phase}
            src={resolve(rel)}
            caption={phaseLabel(phase)}
            design={design}
            isLast={i === entries.length - 1}
          />
        ))}
      </View>
    );
  }

  if (page.type === 'gallery') {
    const items = page.items || [];
    return (
      <View style={{ flexDirection: 'row', height: '100%' }}>
        {items.map((item, i) => (
          <PhotoFrame
            key={i}
            src={resolve(item.photo)}
            caption={item.phaseLabel || phaseLabel(item.phase)}
            design={design}
            isLast={i === items.length - 1}
          />
        ))}
      </View>
    );
  }

  if (page.type === 'map') {
    const src = resolve(page.mapSnapshot);
    if (src) {
      return (
        <View
          style={{
            height: '100%',
            borderRadius: GEOM.cardRadius,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.panelBorder,
            backgroundColor: colors.panel,
            overflow: 'hidden',
          }}
        >
          <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </View>
      );
    }
    return (
      <View>
        {(page.mapPoints || []).map((p, i) => (
          <Text key={i} style={{ fontFamily: FONT, fontSize: type.body, color: colors.text, marginBottom: 4 }}>
            {i + 1}. {p.label || `Σημείο ${i + 1}`} — {p.lat}, {p.lng}
          </Text>
        ))}
      </View>
    );
  }

  if (page.type === 'metrics') {
    const rows = page.metrics || [];
    const half = Math.ceil(rows.length / 2);
    const columns = [rows.slice(0, half), rows.slice(half)].filter((c) => c.length);
    return (
      <View style={{ flexDirection: 'row', height: '100%', alignItems: 'center' }}>
        {columns.map((col, ci) => (
          <View key={ci} style={{ flex: 1, marginRight: ci === columns.length - 1 ? 0 : 40 }}>
            {col.map((m, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid',
                  borderBottomColor: colors.hairline,
                }}
              >
                <Text style={{ fontFamily: FONT, fontSize: type.body, color: colors.muted }}>{m.label}</Text>
                <Text style={{ fontFamily: FONT, fontSize: type.statValue, fontWeight: 'bold', color: colors.text }}>
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (page.type === 'amounts') {
    return (
      <View style={{ height: '100%', justifyContent: 'center' }}>
        <KpiCards
          design={design}
          height={128}
          items={[
            { label: 'Εγκεκριμένο ποσό', value: formatEuro(page.approvedAmount), tone: 'accent' },
            { label: 'Συμβατικό ποσό', value: formatEuro(page.contractAmount), tone: 'dark' },
          ]}
        />
      </View>
    );
  }

  const narrative = page.narrative || display.narrative || '';
  return (
    <View style={{ height: '100%', justifyContent: 'center' }}>
      <View style={{ paddingLeft: 20, borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: colors.accent }}>
        <Text
          style={{
            fontFamily: FONT,
            fontSize: type.narrative,
            fontWeight: 'bold',
            lineHeight: 1.5,
            color: colors.text,
            maxWidth: 760,
          }}
        >
          {narrative}
        </Text>
      </View>
    </View>
  );
}

function ProjectPages({ entry, sectionLabel, design, mediaMap, footerBase }) {
  const { type, colors } = design;
  const { display, contentPages } = entry;
  const pages = contentPages?.length ? contentPages : [{ type: 'simple', role: 'primary' }];

  return pages.map((page, pageIndex) => {
    const isFirst = pageIndex === 0;
    const showStats = isFirst && display.showHeaderAmounts !== false;
    const showNarrative = isFirst && display.showHeaderNarrative !== false && !!display.narrative;
    return (
      <Page
        key={`${entry.card.id}-${pageIndex}`}
        size={PAGE_SIZE}
        style={{
          backgroundColor: colors.surface,
          paddingTop: GEOM.marginTop,
          paddingHorizontal: GEOM.marginX,
          flexDirection: 'column',
        }}
      >
        <View style={{ height: GEOM.contentTop - GEOM.marginTop, overflow: 'hidden' }}>
          <Eyebrow color={colors.muted} size={type.eyebrow}>{sectionLabel}</Eyebrow>
          <Text
            maxLines={2}
            style={{
              fontFamily: FONT,
              fontSize: type.title,
              fontWeight: 'bold',
              color: colors.text,
              marginTop: 8,
              lineHeight: 1.18,
            }}
          >
            {display.title}
          </Text>
          {showNarrative ? (
            <Text
              maxLines={showStats ? 2 : 3}
              style={{
                fontFamily: FONT,
                fontSize: type.body,
                color: colors.text,
                marginTop: 8,
                lineHeight: 1.35,
              }}
            >
              {display.narrative}
            </Text>
          ) : null}
          <View style={{ marginTop: 'auto', paddingBottom: 12 }}>
            {showStats ? (
              <StatStrip
                design={design}
                stats={[
                  { label: 'Εγκεκριμένο', value: formatEuro(display.approvedAmount) },
                  { label: 'Συμβατικό', value: formatEuro(display.contractAmount) },
                  ...(display.area ? [{ label: 'Περιοχή', value: display.area }] : []),
                ]}
              />
            ) : (
              <View>
                {display.area ? (
                  <Text style={{ fontFamily: FONT, fontSize: type.body, color: colors.muted }}>{display.area}</Text>
                ) : null}
                {page.role === 'secondary' ? (
                  <Eyebrow color={colors.muted} size={type.caption} style={{ marginTop: 6 }}>
                    {page.vizLabel || page.vizId}
                  </Eyebrow>
                ) : null}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: GEOM.contentBottom - GEOM.contentTop }}>
          <ProjectContent page={page} display={display} design={design} mediaMap={mediaMap} />
        </View>

        <SlideFooter design={design} footerBase={footerBase} />
      </Page>
    );
  });
}

export default function ApologismosReport({ model, mediaMap = {} }) {
  const design = model?.design || resolveSlideDesign(model?.appearance || {}, model?.theme || {});
  const footerBase = buildFooter({
    design,
    organizationTitle: model?.cover?.organizationTitle,
    periodLabel: model?.cover?.periodLabel || model?.period?.label,
  });

  return (
    <Document>
      <CoverPage model={model} design={design} mediaMap={mediaMap} />
      {(model?.sections || []).map((section, sectionIdx) => (
        <React.Fragment key={section.categoryId}>
          {design.sectionDividers ? (
            <CategoryPage
              section={section}
              design={design}
              footerBase={footerBase}
              sectionIndex={sectionIdx + 1}
              sectionTotal={(model?.sections || []).length}
            />
          ) : null}
          {section.cards.flatMap((entry) =>
            ProjectPages({
              entry,
              sectionLabel: section.label,
              design,
              mediaMap,
              footerBase,
            })
          )}
        </React.Fragment>
      ))}
    </Document>
  );
}
