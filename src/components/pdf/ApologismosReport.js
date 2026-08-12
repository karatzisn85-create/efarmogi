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
  fitTitleFontSize,
  softBreakLongWords,
  resolveProjectHeaderNarrativeLines,
} from '../../utils/apologismosSlideDesign';
import { resolveTocLayout, splitTocColumns } from '../../utils/apologismosTocLayout';

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

function MunicipalityBrand({ branding, variant = 'content' }) {
  const url = branding?.logoDataUrl;
  if (!branding?.showLogo || !url) return null;
  if (variant === 'cover') {
    return (
      <>
        <View
          style={{
            position: 'absolute',
            left: Math.round(SLIDE_W * 0.29),
            top: Math.round(SLIDE_H * 0.22),
            width: Math.round(SLIDE_W * 0.42),
            height: Math.round(SLIDE_H * 0.42),
          }}
        >
          <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.07 }} />
        </View>
        <View
          style={{
            position: 'absolute',
            top: 28,
            right: 36,
            height: 58,
            width: 120,
          }}
        >
          <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.92 }} />
        </View>
      </>
    );
  }
  if (variant === 'backdrop') {
    return (
      <View
        style={{
          position: 'absolute',
          right: -40,
          top: Math.round(SLIDE_H / 2 - 210),
          width: 420,
          height: 420,
        }}
      >
        <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.085 }} />
      </View>
    );
  }
  if (variant === 'content') {
    return (
      <View
        style={{
          position: 'absolute',
          top: 22,
          right: GEOM.marginX,
          height: 36,
          width: 96,
        }}
      >
        <Image src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.22 }} />
      </View>
    );
  }
  return null;
}

function StatStrip({ stats, design, onDark = false, gap = 30 }) {
  const { type, colors } = design;
  if (!stats?.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{
            paddingLeft: 11,
            marginRight: i === stats.length - 1 ? 0 : gap,
            borderLeftWidth: 3,
            borderLeftColor: colors.accent,
            borderLeftStyle: 'solid',
            flexDirection: 'column',
          }}
        >
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.statLabel,
              fontWeight: 'bold',
              letterSpacing: 1,
              lineHeight: 1.25,
              color: onDark ? colors.darkMuted : colors.muted,
              marginBottom: 4,
            }}
          >
            {String(s.label).toLocaleUpperCase('el-GR')}
          </Text>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.statValue,
              fontWeight: 'bold',
              lineHeight: 1.25,
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
  const valueSize = (k) => (k.big
    ? type.kpiValueHero
    : (items.length > 2 ? type.kpiValue - 2 : type.kpiValue));
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
              fontSize: valueSize(k),
              fontWeight: 'bold',
              color: k.tone === 'accent' ? colors.accentText : colors.darkText,
            }}
          >
            {k.value}
          </Text>
          {k.note ? (
            <Text
              style={{
                fontFamily: FONT,
                fontSize: Math.max(9, type.caption - 1),
                fontWeight: 'bold',
                marginTop: 8,
                color: k.tone === 'accent' ? colors.accentText : colors.darkText,
                opacity: 0.9,
              }}
            >
              {k.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SlideFooter({ design, footerBase, onDark = false }) {
  const { type, colors } = design;
  if (!footerBase) return null;
  const muted = onDark ? colors.darkMuted : colors.muted;
  const creditColor = onDark ? rgbaOf(colors.darkText, 0.42) : rgbaOf(colors.text, 0.38);
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
        alignItems: 'flex-end',
        height: GEOM.footerTextH + 11,
      }}
    >
      <Text
        style={{
          fontFamily: FONT,
          fontSize: type.footer,
          fontWeight: 500,
          letterSpacing: 0.2,
          color: muted,
          maxWidth: SLIDE_W * 0.55,
        }}
      >
        {footerBase.left || ' '}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {footerBase.credit ? (
          <Text
            style={{
              fontFamily: FONT,
              fontSize: Math.max(9, type.footer - 0.5),
              fontWeight: 500,
              letterSpacing: 0.3,
              color: creditColor,
              marginRight: 14,
            }}
          >
            {footerBase.credit}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: FONT,
            fontSize: type.footer,
            fontWeight: 'bold',
            color: muted,
          }}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
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
        <MunicipalityBrand branding={model?.branding} variant="cover" />
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
      <MunicipalityBrand branding={model?.branding} variant="cover" />
    </Page>
  );
}

function CategoryPage({ section, design, footerBase, sectionIndex, sectionTotal, mediaMap = {} }) {
  const { type, colors } = design;
  const heroUrl = section.heroPhoto ? mediaMap[section.heroPhoto] : null;
  return (
    <Page
      size={PAGE_SIZE}
      wrap={false}
      style={{ backgroundColor: colors.darkBand }}
    >
      {/* Ίδιο μοτίβο με το εξώφυλλο: Image μόνο μέσα σε absolute View, χωρίς padding στη Page. */}
      {heroUrl ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
          <Image src={heroUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
      ) : null}
      {heroUrl ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            backgroundColor: rgbaOf(colors.darkBand, 0.72),
          }}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          right: GEOM.marginX,
          top: 54,
          width: 220,
          height: 220,
          alignItems: 'flex-end',
        }}
      >
        <Text
          style={{
            fontFamily: FONT,
            fontSize: 210,
            fontWeight: 'bold',
            lineHeight: 1,
            color: colors.darkGhost,
          }}
        >
          {String(sectionIndex || '')}
        </Text>
      </View>
      <View
        style={{
          paddingTop: GEOM.marginTop,
          paddingHorizontal: GEOM.marginX,
          height: SLIDE_H,
        }}
      >
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
      </View>
    </Page>
  );
}

function TocPage({ toc, design, footerBase, branding = null }) {
  const { type, colors } = design;
  const items = toc?.items || [];
  const preface = toc?.preface || [];
  const layout = resolveTocLayout(toc);
  const { compact, dense, twoColumn } = layout;
  const rowH = dense ? 26 : compact ? 30 : 40;
  const rowGap = dense ? 2 : compact ? 3 : 5;
  const badge = dense ? 18 : compact ? 22 : 26;
  const titleSize = compact ? type.title : type.titleSection;
  const nameSize = dense ? 11 : compact ? type.body - 0.5 : type.body;
  const [colA, colB] = twoColumn ? splitTocColumns(items) : [items, []];
  return (
    <Page
      size={PAGE_SIZE}
      style={{
        backgroundColor: colors.surface,
        paddingTop: GEOM.marginTop,
        paddingHorizontal: GEOM.marginX,
        flexDirection: 'column',
      }}
    >
      <MunicipalityBrand branding={branding} variant="backdrop" />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: colors.accent,
        }}
      />
      <View style={{ paddingLeft: 12, flexShrink: 0 }}>
        <Eyebrow color={colors.accent} size={type.eyebrow}>Οδηγός παρουσίασης</Eyebrow>
        <Text
          style={{
            fontFamily: FONT,
            fontSize: titleSize,
            fontWeight: 'bold',
            color: colors.text,
            marginTop: compact ? 4 : 8,
          }}
        >
          {toc?.title || 'Περιεχόμενα'}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: compact ? 6 : 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {toc?.periodLabel ? (
            <Text
              style={{
                fontFamily: FONT, fontSize: type.caption, color: colors.muted, marginRight: 10,
              }}
            >
              {toc.periodLabel}
            </Text>
          ) : null}
          {[
            { label: 'Κατηγορίες', value: String(toc?.categoryCount ?? items.length) },
            { label: 'Παρεμβάσεις', value: String(toc?.projectCount ?? 0) },
            { label: 'Εγκεκριμένα', value: formatEuro(toc?.totalApproved) },
          ].map((chip, i) => (
            <View
              key={chip.label}
              style={{
                paddingVertical: compact ? 4 : 5,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: colors.accentSoft,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: colors.accent,
                marginRight: i === 2 ? 0 : 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: 8,
                  fontWeight: 'bold',
                  letterSpacing: 0.7,
                  color: colors.muted,
                  marginRight: 5,
                }}
              >
                {String(chip.label).toLocaleUpperCase('el-GR')}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: compact ? type.caption + 1 : type.body,
                  fontWeight: 'bold',
                  color: colors.accent,
                }}
              >
                {chip.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: compact ? 8 : 12, paddingLeft: 12, flexGrow: 1 }}>
        {preface.map((pf, pi) => (
          <View
            key={`preface-${pi}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: rowH + 2,
              marginBottom: rowGap + 2,
              paddingHorizontal: 6,
              borderRadius: 8,
              backgroundColor: colors.accentSoft,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: colors.accent,
            }}
          >
            <View
              style={{
                width: badge,
                height: badge,
                borderRadius: 7,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Text style={{ fontFamily: FONT, fontSize: 9, fontWeight: 'bold', color: colors.accentText }}>
                —
              </Text>
            </View>
            <Text
              style={{ fontFamily: FONT, fontSize: nameSize, fontWeight: 'bold', color: colors.text, flex: 1 }}
              maxLines={1}
            >
              {pf.label}
            </Text>
            <Text
              style={{
                fontFamily: FONT, fontSize: 9, color: colors.muted, width: 78, textAlign: 'right',
              }}
            >
              —
            </Text>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: compact ? type.body : type.statValue,
                fontWeight: 'bold',
                color: colors.accent,
                width: 42,
                textAlign: 'right',
              }}
            >
              {String(pf.startPage)}
            </Text>
          </View>
        ))}
        {twoColumn ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[colA, colB].map((col, colIdx) => (
              <View key={colIdx} style={{ flex: 1 }}>
                {col.map((it, i) => {
                  const globalIndex = colIdx === 0 ? i : colA.length + i;
                  const featured = globalIndex % 2 === 0;
                  return (
                    <View
                      key={it.categoryId || `${colIdx}-${i}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: Math.max(24, rowH - 2),
                        marginBottom: i === col.length - 1 ? 0 : Math.max(1, rowGap - 1),
                        paddingHorizontal: 5,
                        borderRadius: 7,
                        backgroundColor: featured ? colors.accentSoft : colors.panel,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: featured ? colors.accent : colors.panelBorder,
                      }}
                    >
                      <View
                        style={{
                          width: Math.max(16, badge - 2),
                          height: Math.max(16, badge - 2),
                          borderRadius: 6,
                          backgroundColor: featured ? colors.accent : colors.surface,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 6,
                        }}
                      >
                        <Text style={{ fontFamily: FONT, fontSize: 9, fontWeight: 'bold', color: featured ? colors.accentText : colors.accent }}>
                          {String(it.index).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text
                        style={{ fontFamily: FONT, fontSize: Math.max(10, nameSize - 0.5), fontWeight: 'bold', color: colors.text, flex: 1 }}
                        maxLines={1}
                      >
                        {it.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONT,
                          fontSize: compact ? type.body : type.statValue,
                          fontWeight: 'bold',
                          color: colors.accent,
                          width: 36,
                          textAlign: 'right',
                        }}
                      >
                        {String(it.startPage)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <>
        <View style={{ flexDirection: 'row', marginBottom: 3, paddingHorizontal: 6 }}>
          <Text style={{ fontFamily: FONT, fontSize: 8, fontWeight: 'bold', color: colors.muted, width: 30 }} />
          <Text style={{ fontFamily: FONT, fontSize: 8, fontWeight: 'bold', color: colors.muted, flex: 1 }}>
            ΚΑΤΗΓΟΡΙΑ
          </Text>
          <Text
            style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 'bold', color: colors.muted, width: 78, textAlign: 'right',
            }}
          >
            ΠΑΡΕΜΒΑΣΕΙΣ
          </Text>
          <Text
            style={{
              fontFamily: FONT, fontSize: 8, fontWeight: 'bold', color: colors.muted, width: 42, textAlign: 'right',
            }}
          >
            ΣΕΛ.
          </Text>
        </View>
        {items.map((it, i) => {
          const featured = i % 2 === 0;
          return (
            <View
              key={it.categoryId || i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: rowH,
                marginBottom: i === items.length - 1 ? 0 : rowGap,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: featured ? colors.accentSoft : colors.panel,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: featured ? colors.accent : colors.panelBorder,
              }}
            >
              <View
                style={{
                  width: badge,
                  height: badge,
                  borderRadius: 7,
                  backgroundColor: featured ? colors.accent : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT,
                    fontSize: dense ? 9 : 10,
                    fontWeight: 'bold',
                    color: featured ? colors.accentText : colors.accent,
                  }}
                >
                  {String(it.index).padStart(2, '0')}
                </Text>
              </View>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text
                  style={{ fontFamily: FONT, fontSize: nameSize, fontWeight: 'bold', color: colors.text }}
                  maxLines={1}
                >
                  {it.label}
                </Text>
                <Text style={{ fontFamily: FONT, fontSize: compact ? 8 : 9, color: colors.muted, marginTop: 1 }}>
                  {compact ? formatEuro(it.totalApproved) : `Εγκεκριμένα ${formatEuro(it.totalApproved)}`}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: FONT, fontSize: nameSize, fontWeight: 'bold', color: colors.text,
                  width: 78, textAlign: 'right',
                }}
              >
                {String(it.count)}
              </Text>
              <Text
                style={{
                  fontFamily: FONT,
                  fontSize: compact ? type.body : type.statValue,
                  fontWeight: 'bold',
                  color: colors.accent,
                  width: 42,
                  textAlign: 'right',
                }}
              >
                {String(it.startPage)}
              </Text>
            </View>
          );
        })}
          </>
        )}
      </View>
      <SlideFooter design={design} footerBase={footerBase} />
    </Page>
  );
}

function MayorPage({ mayorMessage, design, footerBase, mediaMap, branding = null }) {
  const { type, colors } = design;
  const mm = mayorMessage || {};
  const photo = mm.photo;
  const src = photo?.framedDataUrl
    || (photo?.relativePath && mediaMap?.[photo.relativePath])
    || null;
  const body = softBreakLongWords(String(mm.text || '').trim() || '—', 20);
  const name = String(mm.mayorName || '').trim();
  const photoColW = 250;
  const gap = 28;
  const textColW = SLIDE_W - GEOM.marginX * 2 - 16 - photoColW - gap - 8;

  return (
    <Page
      size={PAGE_SIZE}
      wrap={false}
      style={{
        backgroundColor: colors.surface,
        paddingTop: GEOM.marginTop,
        paddingHorizontal: GEOM.marginX,
        flexDirection: 'column',
      }}
    >
      <MunicipalityBrand branding={branding} variant="backdrop" />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          backgroundColor: colors.accent,
        }}
      />
      <View
        style={{
          flexGrow: 1,
          flexDirection: 'row',
          paddingLeft: 16,
          alignItems: 'center',
        }}
      >
        <View style={{ width: photoColW, alignItems: 'center', marginRight: gap }}>
          <View
            style={{
              width: 220,
              height: 280,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.panel,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: colors.panelBorder,
              position: 'relative',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 5,
                backgroundColor: colors.accent,
                zIndex: 1,
              }}
            />
            {src ? (
              <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                <Text style={{ fontFamily: FONT, fontSize: type.caption, color: colors.muted, textAlign: 'center' }}>
                  Φωτογραφία Δημάρχου
                </Text>
              </View>
            )}
          </View>
          {name ? (
            <Text
              style={{
                fontFamily: FONT,
                fontSize: type.body,
                fontWeight: 'bold',
                color: colors.text,
                marginTop: 12,
                textAlign: 'center',
                maxWidth: 230,
              }}
            >
              {name}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.caption,
              fontWeight: 'bold',
              letterSpacing: 1.2,
              color: colors.accent,
              marginTop: name ? 4 : 12,
              textAlign: 'center',
            }}
          >
            ΔΗΜΑΡΧΟΣ
          </Text>
        </View>

        <View style={{ width: textColW, justifyContent: 'center', paddingRight: 8 }}>
          <Eyebrow color={colors.accent} size={type.eyebrow}>Οδηγός παρουσίασης</Eyebrow>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.titleSection,
              fontWeight: 'bold',
              color: colors.text,
              marginTop: 8,
            }}
          >
            {mm.title || 'Μήνυμα Δημάρχου'}
          </Text>
          <Rule color={colors.accent} width={56} height={4} style={{ marginTop: 12 }} />
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.body + 1.5,
              color: colors.text,
              marginTop: 18,
              lineHeight: 1.55,
              width: textColW,
              maxWidth: textColW,
            }}
            maxLines={12}
          >
            {body}
          </Text>
        </View>
      </View>
      <SlideFooter design={design} footerBase={footerBase} />
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
    const rows = (page.metrics || []).filter((r) => r && (r.label || r.value));
    const cols = rows.length === 1 ? 1 : 2;
    return (
      <View style={{ height: '100%', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Text style={{ fontFamily: FONT, fontSize: 12, fontWeight: 'bold', color: colors.accentText }}>
              {rows.length}
            </Text>
          </View>
          <View>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: type.caption,
                fontWeight: 'bold',
                letterSpacing: 1.2,
                color: colors.accent,
              }}
            >
              ΑΠΟΤΕΛΕΣΜΑΤΑ
            </Text>
            <Text style={{ fontFamily: FONT, fontSize: type.caption, color: colors.muted, marginTop: 2 }}>
              Μετρήσιμα μεγέθη του έργου
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {rows.map((m, i) => {
            const featured = i % 2 === 0;
            const isLastInRow = cols === 1 || i % 2 === 1 || i === rows.length - 1;
            return (
              <View
                key={i}
                style={{
                  width: cols === 1 ? '100%' : '48%',
                  marginRight: isLastInRow || cols === 1 ? 0 : '4%',
                  marginBottom: 10,
                  minHeight: rows.length <= 2 ? 88 : 72,
                  borderRadius: 12,
                  backgroundColor: featured ? colors.accentSoft : colors.surface,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: featured ? colors.accent : colors.panelBorder,
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingLeft: 16,
                  paddingRight: 12,
                  justifyContent: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text
                    style={{
                      fontFamily: FONT,
                      fontSize: type.caption,
                      fontWeight: 'bold',
                      letterSpacing: 1,
                      color: colors.muted,
                      maxWidth: '78%',
                    }}
                  >
                    {String(m.label || '').toLocaleUpperCase('el-GR')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT,
                      fontSize: 9,
                      fontWeight: 'bold',
                      color: colors.accent,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FONT,
                    fontSize: rows.length <= 2 ? type.kpiValue : type.statValue + 1,
                    fontWeight: 'bold',
                    color: featured ? colors.accent : colors.text,
                    marginTop: 6,
                  }}
                >
                  {m.value}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (page.type === 'amounts') {
    const showFinal = !!page.showFinalContractAmount;
    const items = [
      { label: 'Εγκεκριμένο ποσό', value: formatEuro(page.approvedAmount), tone: 'accent' },
      { label: 'Συμβατικό ποσό', value: formatEuro(page.contractAmount), tone: 'dark' },
    ];
    if (showFinal) {
      items.push({
        label: page.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
        value: formatEuro(page.finalContractAmountAfterApe),
        tone: 'dark',
        note: 'Διαμορφωθέν μετά από αναθεωρήσεις',
      });
    }
    return (
      <View style={{ height: '100%', justifyContent: 'center' }}>
        <KpiCards design={design} height={showFinal ? 148 : 128} items={items} />
        {showFinal ? (
          <Text
            style={{
              fontFamily: FONT,
              fontSize: type.caption,
              color: colors.muted,
              fontWeight: 'bold',
              marginTop: 12,
              lineHeight: 1.45,
              maxWidth: 920,
            }}
          >
            {page.finalContractAmountExplanation
              || 'Πρόκειται για το τελικό ποσό της σύμβασης όπως διαμορφώθηκε μετά από αναθεωρήσεις (ΑΠΕ).'}
          </Text>
        ) : null}
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

function ProjectPages({ entry, sectionLabel, design, mediaMap, footerBase, branding = null }) {
  const { type, colors } = design;
  const { display, contentPages } = entry;
  const pages = contentPages?.length ? contentPages : [{ type: 'simple', role: 'primary' }];
  const headerH = GEOM.contentTop - GEOM.marginTop;
  const hasImpact = !!String(display.impactLine || '').trim();
  /** Χώρος για ποσά κάτω στην κεφαλίδα — το react-pdf δεν στηρίζει αξιόπιστα marginTop:auto. */
  const metaReserve = Math.max(GEOM.statH, Math.ceil(type.statLabel * 1.25 + 4 + type.statValue * 1.25)) + 14;
  const titleMaxW = SLIDE_W - GEOM.marginX * 2;
  const titleSize = fitTitleFontSize(display.title || '', {
    maxWidth: titleMaxW,
    maxSize: type.title,
    minSize: Math.max(14, type.title - 12),
    maxLines: 2,
  });

  return pages.map((page, pageIndex) => {
    const isFirst = pageIndex === 0;
    const showStats = isFirst && display.showHeaderAmounts !== false;
    const showNarrative = isFirst && display.showHeaderNarrative !== false && !!display.narrative;
    const needsMeta = showStats || !!display.area || page.role === 'secondary';
    const topBandH = Math.max(48, headerH - (needsMeta ? metaReserve : 8));
    const narrativeLines = resolveProjectHeaderNarrativeLines({
      type,
      hasImpact,
      showStats,
      titleSize,
    });
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
        <MunicipalityBrand branding={branding} variant="content" />
        <View style={{ height: headerH, position: 'relative' }}>
          <View style={{ height: topBandH, overflow: 'hidden' }}>
            <Eyebrow color={colors.muted} size={type.eyebrow}>{sectionLabel}</Eyebrow>
            <Text
              maxLines={2}
              style={{
                fontFamily: FONT,
                fontSize: titleSize,
                fontWeight: 'bold',
                color: colors.text,
                marginTop: 8,
                lineHeight: 1.25,
                minHeight: Math.ceil(titleSize * 1.25 * 2),
              }}
            >
              {display.title}
            </Text>
            {hasImpact ? (
              <Text
                maxLines={1}
                style={{
                  fontFamily: FONT,
                  fontSize: type.subtitle,
                  fontWeight: 'bold',
                  color: colors.accent,
                  marginTop: 6,
                  lineHeight: 1.3,
                  maxHeight: Math.ceil(type.subtitle * 1.3),
                }}
              >
                {display.impactLine}
              </Text>
            ) : null}
            {showNarrative && narrativeLines > 0 ? (
              <Text
                maxLines={narrativeLines}
                style={{
                  fontFamily: FONT,
                  fontSize: type.body,
                  color: colors.text,
                  marginTop: 8,
                  lineHeight: 1.35,
                  maxHeight: Math.ceil(type.body * 1.35 * narrativeLines),
                }}
              >
                {display.narrative}
              </Text>
            ) : null}
          </View>
          {needsMeta ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 12,
              }}
            >
              {showStats ? (
                <StatStrip
                  design={design}
                  stats={[
                    { label: 'Εγκεκριμένο', value: formatEuro(display.approvedAmount) },
                    { label: 'Συμβατικό', value: formatEuro(display.contractAmount) },
                    ...(display.showFinalContractAmount
                      ? [{
                        label: display.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
                        value: formatEuro(display.finalContractAmountAfterApe),
                      }]
                      : []),
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
          ) : null}
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
  const branding = model?.branding || null;
  const footerBase = buildFooter({
    design,
    organizationTitle: model?.cover?.organizationTitle,
    periodLabel: model?.cover?.periodLabel || model?.period?.label,
  });

  return (
    <Document>
      <CoverPage model={model} design={design} mediaMap={mediaMap} />
      {model?.toc?.items?.length ? (
        <TocPage toc={model.toc} design={design} footerBase={footerBase} branding={branding} />
      ) : null}
      {model?.mayorMessage?.enabled ? (
        <MayorPage
          mayorMessage={model.mayorMessage}
          design={design}
          footerBase={footerBase}
          mediaMap={mediaMap}
          branding={branding}
        />
      ) : null}
      {(model?.sections || []).map((section, sectionIdx) => (
        <React.Fragment key={section.categoryId}>
          {design.sectionDividers ? (
            <CategoryPage
              section={section}
              design={design}
              footerBase={footerBase}
              sectionIndex={sectionIdx + 1}
              sectionTotal={(model?.sections || []).length}
              mediaMap={mediaMap}
            />
          ) : null}
          {section.cards.flatMap((entry) =>
            ProjectPages({
              entry,
              sectionLabel: section.label,
              design,
              mediaMap,
              footerBase,
              branding,
            })
          )}
        </React.Fragment>
      ))}
    </Document>
  );
}
