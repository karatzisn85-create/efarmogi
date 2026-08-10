import React from 'react';
import { GEOM, SLIDE_W, SLIDE_H, rgbaOf, coverScrimCss } from '../utils/apologismosSlideDesign';
import { coverImageStyle } from '../utils/apologismosAppearance';

/**
 * Απόδοση μίας διαφάνειας απολογισμού στον καμβά αναφοράς 960×540.
 * Ίδια γεωμετρία και τυπογραφία με το PDF και τις διαφάνειες PowerPoint.
 */

const PHOTO_PHASE_LABELS = {
  before: 'Πριν',
  during: 'Κατά τη διάρκεια',
  after: 'Μετά',
};

function phaseLabel(phase) {
  return PHOTO_PHASE_LABELS[phase] || phase;
}

/**
 * Κεφαλαία με ελληνικούς κανόνες (χωρίς τόνους) — ίδιο αποτέλεσμα με το
 * έγγραφο και τις διαφάνειες, όπου η μετατροπή γίνεται επίσης στον κώδικα.
 */
function upperEl(text) {
  return String(text ?? '').toLocaleUpperCase('el-GR');
}

function Eyebrow({ children, color, size, spacing = '0.14em' }) {
  if (!children) return null;
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: spacing,
        color,
      }}
    >
      {upperEl(children)}
    </div>
  );
}

function Rule({ color, width = GEOM.headerRuleW, height = GEOM.headerRuleH, top = 0 }) {
  return (
    <div style={{ width, height, background: color, borderRadius: height, marginTop: top }} />
  );
}

function StatStrip({ stats, design, onDark = false, gap = 30 }) {
  const { type, colors } = design;
  if (!stats?.length) return null;
  const labelColor = onDark ? colors.darkMuted : colors.muted;
  const valueColor = onDark ? colors.darkText : colors.text;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap }}>
      {stats.map((s) => (
        <div key={s.label} style={{ paddingLeft: 11, borderLeft: `3px solid ${colors.accent}` }}>
          <div
            style={{
              fontSize: type.statLabel,
              fontWeight: 700,
              letterSpacing: '0.09em',
              color: labelColor,
              marginBottom: 3,
            }}
          >
            {upperEl(s.label)}
          </div>
          <div style={{ fontSize: type.statValue, fontWeight: 700, color: valueColor, lineHeight: 1.1 }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCards({ items, design, height = GEOM.kpiH }) {
  const { type, colors } = design;
  return (
    <div style={{ display: 'flex', gap: GEOM.gutter }}>
      {items.map((k) => (
        <div
          key={k.label}
          style={{
            flex: 1,
            height,
            borderRadius: GEOM.cardRadius,
            padding: GEOM.kpiPad,
            background: k.tone === 'accent' ? colors.accent : colors.cardDark,
            color: k.tone === 'accent' ? colors.accentText : colors.darkText,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: type.kpiLabel,
              fontWeight: 700,
              letterSpacing: '0.08em',
              opacity: 0.85,
              marginBottom: 8,
            }}
          >
            {upperEl(k.label)}
          </div>
          <div
            style={{
              fontSize: k.big ? type.kpiValueHero : type.kpiValue,
              fontWeight: 800,
              lineHeight: 1.08,
            }}
          >
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlideFooter({ footer, design, onDark = false }) {
  const { type, colors } = design;
  if (!footer) return null;
  const color = onDark ? colors.darkMuted : colors.muted;
  const line = onDark ? colors.darkHairline : colors.hairline;
  return (
    <div
      style={{
        marginTop: GEOM.footerRuleY - GEOM.contentBottom,
        paddingTop: 10,
        borderTop: `1px solid ${line}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: type.footer,
          letterSpacing: '0.06em',
          color,
          height: GEOM.footerTextH,
        }}
      >
        <span style={{ fontWeight: 600 }}>{upperEl(footer.left)}</span>
        <span style={{ fontWeight: 700 }}>{footer.right}</span>
      </div>
    </div>
  );
}

function PhotoFrame({ url, design, caption, flex = 1 }) {
  const { type, colors } = design;
  return (
    <div style={{ flex, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {caption ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 8,
            fontSize: type.caption,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: colors.muted,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 6, background: colors.accent }} />
          {upperEl(caption)}
        </div>
      ) : null}
      <div
        style={{
          flex: 1,
          borderRadius: GEOM.cardRadius,
          border: `1px solid ${colors.photoFrame}`,
          background: url
            ? `center/cover no-repeat url("${url}")`
            : colors.photoPlaceholder,
        }}
      />
    </div>
  );
}

function CoverMeta({ slide, design, onDark, align = 'bottom' }) {
  const { type, colors } = design;
  const textColor = colors.darkText;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Rule color={colors.accent} width={GEOM.coverRuleW} height={5} />
      <div style={{ height: 18 }} />
      <Eyebrow color={rgbaOf(textColor, 0.82)} size={type.eyebrow}>
        {slide.organizationTitle}
      </Eyebrow>
      <div
        style={{
          fontSize: type.titleHero,
          fontWeight: 800,
          lineHeight: 1.1,
          color: textColor,
          marginTop: 12,
          maxWidth: align === 'side' ? '100%' : 720,
        }}
      >
        {slide.title}
      </div>
      <div
        style={{
          fontSize: type.subtitle,
          color: rgbaOf(textColor, 0.9),
          marginTop: 12,
          fontWeight: 500,
        }}
      >
        {slide.periodLabel}
      </div>
      {slide.subtitle ? (
        <div
          style={{
            fontSize: type.body,
            color: rgbaOf(textColor, 0.78),
            marginTop: 6,
            maxWidth: align === 'side' ? '100%' : 640,
          }}
        >
          {slide.subtitle}
        </div>
      ) : null}
      {design.coverStats && slide.stats?.length ? (
        <>
          <div style={{ height: 20 }} />
          <StatStrip stats={slide.stats} design={design} onDark={onDark} gap={26} />
        </>
      ) : null}
    </div>
  );
}

function CoverSlide({ slide, design, images, mediaUrls }) {
  const { colors } = design;
  const layer = (img) => {
    const url = img?.relativePath ? mediaUrls[img.relativePath] : null;
    if (!img?.relativePath || !url) return { background: colors.darkBand };
    return coverImageStyle(img, url);
  };

  if (slide.cover?.layoutId === 'hero_side') {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: colors.darkBand }}>
        <div style={{ width: '52%', ...layer(images[0]) }} />
        <div
          style={{
            flex: 1,
            padding: `${GEOM.coverPadY}px ${GEOM.coverPadX}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: colors.darkBand,
          }}
        >
          <CoverMeta slide={slide} design={design} onDark align="side" />
        </div>
      </div>
    );
  }

  const isSplit = slide.cover?.layoutId === 'hero_split';
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: colors.darkBand }}>
      {isSplit ? (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, ...layer(images[0]) }} />
          <div style={{ width: 3, background: colors.accent }} />
          <div style={{ flex: 1, ...layer(images[1]) }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, ...layer(images[0]) }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: coverScrimCss(colors.darkBand) }} />
      <div
        style={{
          position: 'absolute',
          left: GEOM.coverPadX,
          right: GEOM.coverPadX,
          bottom: GEOM.coverPadY,
        }}
      >
        <CoverMeta slide={slide} design={design} onDark />
      </div>
    </div>
  );
}

function CategorySlide({ slide, design, footer }) {
  const { type, colors } = design;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: colors.darkBand,
        padding: `${GEOM.marginTop}px ${GEOM.marginX}px 0`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: GEOM.marginX,
          top: 54,
          fontSize: 210,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: colors.darkGhost,
          userSelect: 'none',
        }}
      >
        {slide.count}
      </div>
      <div
        style={{
          height: GEOM.contentBottom - GEOM.marginTop,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Rule color={colors.accent} width={GEOM.coverRuleW} height={5} />
        <div style={{ height: 18 }} />
        <Eyebrow color={rgbaOf(colors.darkText, 0.72)} size={type.eyebrow}>Κατηγορία έργων</Eyebrow>
        <div
          style={{
            fontSize: type.titleSection,
            fontWeight: 800,
            color: colors.darkText,
            lineHeight: 1.14,
            marginTop: 12,
            marginBottom: 28,
            maxWidth: 700,
          }}
        >
          {slide.title}
        </div>
        <KpiCards
          design={design}
          items={[
            { label: 'Έργα', value: String(slide.count), tone: 'accent', big: true },
            { label: 'Εγκεκριμένα', value: slide.totalApprovedText, tone: 'dark' },
            { label: 'Συμβάσεις', value: slide.totalContractText, tone: 'dark' },
          ]}
        />
      </div>
      <SlideFooter footer={footer} design={design} onDark />
    </div>
  );
}

function ProjectContent({ slide, design, mediaUrls }) {
  const { type, colors } = design;
  const page = slide.page || {};
  const display = slide.entry?.display || {};

  if (page.type === 'primary_photos' || page.type === 'primary') {
    const entries = Object.entries(page.primary || {}).filter(([, rel]) => rel);
    if (!entries.length) return null;
    return (
      <div style={{ display: 'flex', gap: GEOM.gutter, height: '100%' }}>
        {entries.map(([phase, rel]) => (
          <PhotoFrame
            key={phase}
            url={mediaUrls[rel]}
            design={design}
            caption={phaseLabel(phase)}
          />
        ))}
      </div>
    );
  }

  if (page.type === 'gallery') {
    const items = page.items || [];
    return (
      <div style={{ display: 'flex', gap: GEOM.gutter, height: '100%' }}>
        {items.map((item, i) => (
          <PhotoFrame
            key={i}
            url={mediaUrls[item.photo]}
            design={design}
            caption={item.phaseLabel || phaseLabel(item.phase)}
          />
        ))}
      </div>
    );
  }

  if (page.type === 'map') {
    const url = page.mapSnapshot ? mediaUrls[page.mapSnapshot] : null;
    if (url) {
      return (
        <div
          style={{
            height: '100%',
            borderRadius: GEOM.cardRadius,
            border: `1px solid ${colors.panelBorder}`,
            background: `center/contain no-repeat url("${url}") ${colors.panel}`,
          }}
        />
      );
    }
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(page.mapPoints || []).map((p, i) => (
          <div key={i} style={{ fontSize: type.body, color: colors.text }}>
            {i + 1}. {p.label || `Σημείο ${i + 1}`} — {p.lat}, {p.lng}
          </div>
        ))}
      </div>
    );
  }

  if (page.type === 'metrics') {
    const rows = page.metrics || [];
    return (
      <div style={{ display: 'flex', gap: 40, height: '100%', alignItems: 'center' }}>
        {[0, 1].map((col) => {
          const half = Math.ceil(rows.length / 2);
          const slice = col === 0 ? rows.slice(0, half) : rows.slice(half);
          if (!slice.length) return null;
          return (
            <div key={col} style={{ flex: 1 }}>
              {slice.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 16,
                    padding: '11px 0',
                    borderBottom: `1px solid ${colors.hairline}`,
                  }}
                >
                  <span style={{ fontSize: type.body, color: colors.muted }}>{m.label}</span>
                  <span style={{ fontSize: type.statValue, fontWeight: 700, color: colors.text }}>{m.value}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  if (page.type === 'amounts') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ width: '100%' }}>
          <KpiCards
            design={design}
            height={128}
            items={[
              { label: 'Εγκεκριμένο ποσό', value: slide.approvedText, tone: 'accent' },
              { label: 'Συμβατικό ποσό', value: slide.contractText, tone: 'dark' },
            ]}
          />
        </div>
      </div>
    );
  }

  const narrative = page.narrative || display.narrative || '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <div style={{ paddingLeft: 20, borderLeft: `4px solid ${colors.accent}` }}>
        <div
          style={{
            fontSize: type.narrative,
            fontWeight: 600,
            lineHeight: 1.5,
            color: colors.text,
            maxWidth: 760,
          }}
        >
          {narrative}
        </div>
      </div>
    </div>
  );
}

function ProjectSlide({ slide, design, footer, mediaUrls }) {
  const { type, colors } = design;
  const display = slide.entry?.display || {};
  const isFirstPage = slide.pageIndex === 0;
  const showStats = isFirstPage && display.showHeaderAmounts !== false;
  const showNarrative = isFirstPage && display.showHeaderNarrative !== false && !!display.narrative;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: colors.surface,
        padding: `${GEOM.marginTop}px ${GEOM.marginX}px 0`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: GEOM.contentTop - GEOM.marginTop,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Eyebrow color={colors.muted} size={type.eyebrow}>
            {slide.sectionLabel}
          </Eyebrow>
        </div>
        <div
          style={{
            fontSize: type.title,
            fontWeight: 700,
            lineHeight: 1.18,
            color: colors.text,
            marginTop: 8,
            flexShrink: 1,
            minHeight: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {display.title || slide.entry?.card?.title}
        </div>
        {showNarrative ? (
          <div
            style={{
              fontSize: type.body,
              lineHeight: 1.35,
              color: colors.text,
              marginTop: 8,
              flexShrink: 0,
              maxHeight: type.body * 1.35 * (showStats ? 2 : 3) + 2,
              display: '-webkit-box',
              WebkitLineClamp: showStats ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {display.narrative}
          </div>
        ) : null}
        <div style={{ marginTop: 'auto', paddingBottom: 12, flexShrink: 0 }}>
          {showStats ? (
            <StatStrip
              design={design}
              stats={[
                { label: 'Εγκεκριμένο', value: slide.approvedText },
                { label: 'Συμβατικό', value: slide.contractText },
                ...(display.area ? [{ label: 'Περιοχή', value: display.area }] : []),
              ]}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {display.area ? (
                <div style={{ fontSize: type.body, color: colors.muted }}>{display.area}</div>
              ) : null}
              {slide.page?.role === 'secondary' ? (
                <Eyebrow color={colors.muted} size={type.caption} spacing="0.09em">
                  {slide.page.vizLabel || slide.page.vizId}
                </Eyebrow>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: GEOM.contentBottom - GEOM.contentTop, minHeight: 0 }}>
        <ProjectContent slide={slide} design={design} mediaUrls={mediaUrls} />
      </div>

      <SlideFooter footer={footer} design={design} />
    </div>
  );
}

export default function ApologismosSlideView({ slide, design, footer, mediaUrls = {}, coverImages = [] }) {
  if (!slide || !design) return null;
  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: design.colors.surface,
        color: design.colors.text,
        fontFamily: 'Segoe UI, Arial, sans-serif',
      }}
    >
      {slide.type === 'cover' && (
        <CoverSlide slide={slide} design={design} images={coverImages} mediaUrls={mediaUrls} />
      )}
      {slide.type === 'category' && (
        <CategorySlide slide={slide} design={design} footer={footer} />
      )}
      {slide.type === 'project' && (
        <ProjectSlide slide={slide} design={design} footer={footer} mediaUrls={mediaUrls} />
      )}
    </div>
  );
}
