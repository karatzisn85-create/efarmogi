import React from 'react';
import { GEOM, SLIDE_W, SLIDE_H, rgbaOf, mixHex, coverScrimCss } from '../utils/apologismosSlideDesign';
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
              fontSize: k.big ? type.kpiValueHero : (items.length > 2 ? type.kpiValue - 2 : type.kpiValue),
              fontWeight: 800,
              lineHeight: 1.08,
            }}
          >
            {k.value}
          </div>
          {k.note ? (
            <div
              style={{
                marginTop: 8,
                fontSize: Math.max(10, type.caption - 1),
                fontWeight: 600,
                lineHeight: 1.3,
                opacity: 0.88,
              }}
            >
              {k.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Πίνακας αποτελεσμάτων — κάρτες με χρώμα παλέτας και καθαρό χαρακτήρα. */
function MetricsBoard({ rows, design }) {
  const { type, colors } = design;
  const list = Array.isArray(rows) ? rows.filter((r) => r && (r.label || r.value)) : [];
  if (!list.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', color: colors.muted, fontSize: type.body }}>
        Δεν έχουν συμπληρωθεί αποτελέσματα
      </div>
    );
  }

  const cols = list.length === 1 ? 1 : 2;
  const rowCount = Math.ceil(list.length / cols);
  const cardMinH = Math.max(72, Math.min(110, Math.floor((GEOM.contentBottom - GEOM.contentTop - 52) / rowCount) - 12));

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 12,
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(145deg, ${colors.accent} 0%, ${mixHex(colors.accent, colors.darkBand, 0.35)} 100%)`,
            boxShadow: `0 6px 16px ${rgbaOf(colors.accent, 0.28)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.accentText,
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '-0.02em',
          }}
        >
          {list.length}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: type.caption,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: colors.accent,
            }}
          >
            ΑΠΟΤΕΛΕΣΜΑΤΑ
          </div>
          <div style={{ fontSize: type.caption, color: colors.muted, marginTop: 2, fontWeight: 600 }}>
            Μετρήσιμα μεγέθη του έργου
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            height: 3,
            flex: 1,
            maxWidth: 160,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${colors.accent} 0%, ${rgbaOf(colors.accent, 0.08)} 100%)`,
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols === 1 ? '1fr' : '1fr 1fr',
          gap: 14,
          alignContent: 'center',
          minHeight: 0,
        }}
      >
        {list.map((m, i) => {
          const featured = i % 2 === 0;
          return (
            <div
              key={`${m.label}-${i}`}
              style={{
                position: 'relative',
                minHeight: cardMinH,
                borderRadius: 14,
                padding: '14px 16px 14px 18px',
                background: featured
                  ? `linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.surface} 72%)`
                  : colors.surface,
                border: `1px solid ${featured ? rgbaOf(colors.accent, 0.28) : colors.panelBorder}`,
                boxShadow: featured
                  ? `0 10px 22px ${rgbaOf(colors.accent, 0.12)}, 0 2px 6px ${rgbaOf(colors.text, 0.04)}`
                  : `0 4px 12px ${rgbaOf(colors.text, 0.05)}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 5,
                  background: featured
                    ? `linear-gradient(180deg, ${colors.accent} 0%, ${mixHex(colors.accent, colors.darkBand, 0.35)} 100%)`
                    : colors.accent,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: -18,
                  top: -18,
                  width: 64,
                  height: 64,
                  borderRadius: 64,
                  background: rgbaOf(colors.accent, featured ? 0.1 : 0.05),
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    fontSize: type.caption,
                    fontWeight: 800,
                    letterSpacing: '0.11em',
                    color: colors.muted,
                    lineHeight: 1.25,
                    maxWidth: '72%',
                  }}
                >
                  {upperEl(m.label)}
                </div>
                <div
                  style={{
                    minWidth: 22,
                    height: 22,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: rgbaOf(colors.accent, 0.12),
                    color: colors.accent,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: list.length <= 2 ? type.kpiValue : type.statValue + 2,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: featured ? colors.accent : colors.text,
                  letterSpacing: '-0.02em',
                  position: 'relative',
                }}
              >
                {m.value}
              </div>
            </div>
          );
        })}
      </div>
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
        {slide.sectionIndex || ''}
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
        <Eyebrow color={rgbaOf(colors.darkText, 0.72)} size={type.eyebrow}>
          {slide.sectionIndex && slide.sectionTotal
            ? `Κατηγορία ${slide.sectionIndex} από ${slide.sectionTotal}`
            : 'Κατηγορία έργων'}
        </Eyebrow>
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

/** Δεύτερη διαφάνεια — αυτόματα περιεχόμενα ανά κατηγορία απολογισμού. */
function TocSlide({ slide, design, footer }) {
  const { type, colors } = design;
  const toc = slide.toc || {};
  const items = toc.items || [];
  const preface = toc.preface || [];
  // Από 6+ κατηγορίες: συμπαγής λίστα· από 7+ ακόμα πιο πυκνή, ώστε να χωρούν όλες.
  const listCount = items.length + (preface.length ? 1 : 0);
  const compact = listCount >= 6;
  const dense = listCount >= 7;
  const gap = dense ? 2 : compact ? 3 : 5;
  const badge = dense ? 20 : compact ? 24 : 28;
  const titleSize = compact ? type.title : type.titleSection;
  const nameSize = dense ? type.caption + 1 : compact ? type.body - 0.5 : type.body;
  const pageSize = dense ? type.body : compact ? type.statValue - 1 : type.statValue;
  const rowMaxH = dense ? 34 : compact ? 38 : 52;

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: -50,
          width: 180,
          height: 180,
          borderRadius: 180,
          background: rgbaOf(colors.accent, 0.07),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: `linear-gradient(180deg, ${colors.accent} 0%, ${mixHex(colors.accent, colors.darkBand, 0.4)} 100%)`,
        }}
      />

      <div style={{ flexShrink: 0, paddingLeft: 12, position: 'relative' }}>
        <Eyebrow color={colors.accent} size={type.eyebrow}>Οδηγός παρουσίασης</Eyebrow>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            color: colors.text,
            marginTop: compact ? 4 : 8,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {toc.title || 'Περιεχόμενα'}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: compact ? 6 : 10,
            flexWrap: 'wrap',
          }}
        >
          {toc.periodLabel ? (
            <div style={{ fontSize: type.caption, color: colors.muted, fontWeight: 600 }}>
              {toc.periodLabel}
            </div>
          ) : null}
          {[
            { label: 'Κατηγορίες', value: String(toc.categoryCount ?? items.length) },
            { label: 'Παρεμβάσεις', value: String(toc.projectCount ?? 0) },
            { label: 'Εγκεκριμένα', value: toc.totalApprovedText || '—' },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                padding: compact ? '4px 9px' : '6px 11px',
                borderRadius: 999,
                background: colors.accentSoft,
                border: `1px solid ${rgbaOf(colors.accent, 0.22)}`,
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: colors.muted,
                }}
              >
                {upperEl(chip.label)}
              </span>
              <span style={{ fontSize: compact ? type.caption + 1 : type.body, fontWeight: 800, color: colors.accent }}>
                {chip.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          marginTop: compact ? 8 : 12,
          marginBottom: 0,
          paddingLeft: 12,
          display: 'flex',
          flexDirection: 'column',
          gap,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {preface.map((pf, pi) => (
          <div
            key={`preface-${pi}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr 88px 56px',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              minHeight: compact ? 32 : 40,
              maxHeight: compact ? 38 : 44,
              padding: compact ? '0 8px' : '0 10px',
              borderRadius: compact ? 9 : 12,
              background: `linear-gradient(90deg, ${colors.accentSoft} 0%, ${colors.surface} 90%)`,
              border: `1px solid ${rgbaOf(colors.accent, 0.28)}`,
            }}
          >
            <div
              style={{
                width: badge,
                height: badge,
                borderRadius: dense ? 7 : 9,
                background: colors.accent,
                color: colors.accentText,
                fontWeight: 800,
                fontSize: dense ? 10 : 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              —
            </div>
            <div
              style={{
                fontSize: nameSize,
                fontWeight: 700,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pf.label}
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: colors.muted, fontWeight: 600 }}>
              —
            </div>
            <div
              style={{
                textAlign: 'right',
                fontSize: pageSize,
                fontWeight: 800,
                color: colors.accent,
              }}
            >
              {pf.startPage}
            </div>
          </div>
        ))}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '34px 1fr 88px 56px',
            gap: 6,
            padding: '0 8px 2px',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: colors.muted,
            flexShrink: 0,
          }}
        >
          <span />
          <span>ΚΑΤΗΓΟΡΙΑ</span>
          <span style={{ textAlign: 'right' }}>ΠΑΡΕΜΒΑΣΕΙΣ</span>
          <span style={{ textAlign: 'right' }}>ΣΕΛ.</span>
        </div>
        {items.map((it, i) => {
          const featured = i % 2 === 0;
          return (
            <div
              key={it.categoryId || i}
              style={{
                display: 'grid',
                gridTemplateColumns: '34px 1fr 88px 56px',
                alignItems: 'center',
                gap: 6,
                flex: '1 1 0',
                minHeight: 0,
                maxHeight: rowMaxH,
                padding: compact ? '0 8px' : '0 10px',
                borderRadius: compact ? 9 : 12,
                background: featured
                  ? `linear-gradient(90deg, ${colors.accentSoft} 0%, ${colors.surface} 85%)`
                  : colors.panel,
                border: `1px solid ${featured ? rgbaOf(colors.accent, 0.2) : colors.panelBorder}`,
                boxShadow: featured && !compact ? `0 3px 10px ${rgbaOf(colors.accent, 0.08)}` : 'none',
              }}
            >
              <div
                style={{
                  width: badge,
                  height: badge,
                  borderRadius: dense ? 7 : 9,
                  background: featured ? colors.accent : rgbaOf(colors.accent, 0.14),
                  color: featured ? colors.accentText : colors.accent,
                  fontWeight: 800,
                  fontSize: dense ? 10 : 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {String(it.index).padStart(2, '0')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: nameSize,
                    fontWeight: 700,
                    color: colors.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.15,
                  }}
                >
                  {it.label}
                </div>
                {!compact && it.totalApprovedText ? (
                  <div style={{ fontSize: 10.5, color: colors.muted, marginTop: 2, fontWeight: 600 }}>
                    Εγκεκριμένα {it.totalApprovedText}
                  </div>
                ) : null}
                {compact && it.totalApprovedText ? (
                  <div
                    style={{
                      fontSize: 9.5,
                      color: colors.muted,
                      marginTop: 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {it.totalApprovedText}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: nameSize,
                  fontWeight: 800,
                  color: colors.text,
                }}
              >
                {it.count}
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: pageSize,
                  fontWeight: 800,
                  color: colors.accent,
                  letterSpacing: '-0.02em',
                }}
              >
                {it.startPage}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0 }}>
        <SlideFooter footer={footer} design={design} />
      </div>
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
    return <MetricsBoard rows={page.metrics || []} design={design} />;
  }

  if (page.type === 'amounts') {
    const showFinal = !!(page.showFinalContractAmount || display.showFinalContractAmount);
    const amountItems = [
      { label: 'Εγκεκριμένο ποσό', value: slide.approvedText, tone: 'accent' },
      { label: 'Συμβατικό ποσό', value: slide.contractText, tone: 'dark' },
    ];
    if (showFinal) {
      amountItems.push({
        label: page.finalContractAmountShortLabel || display.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
        value: slide.finalContractText || '—',
        tone: 'dark',
        note: 'Διαμορφωθέν μετά από αναθεωρήσεις',
      });
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 14 }}>
        <KpiCards
          design={design}
          height={showFinal ? 148 : 128}
          items={amountItems}
        />
        {showFinal ? (
          <div style={{ fontSize: type.caption, color: colors.muted, fontWeight: 600, lineHeight: 1.45, maxWidth: 920 }}>
            {page.finalContractAmountExplanation
              || display.finalContractAmountExplanation
              || 'Πρόκειται για το τελικό ποσό της σύμβασης όπως διαμορφώθηκε μετά από αναθεωρήσεις (ΑΠΕ).'}
          </div>
        ) : null}
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
                ...(display.showFinalContractAmount
                  ? [{
                    label: display.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
                    value: slide.finalContractText || '—',
                  }]
                  : []),
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

function MayorSlide({ slide, design, footer, mediaUrls }) {
  const { type, colors } = design;
  const mm = slide.mayorMessage || {};
  const photo = mm.photo;
  const mediaUrl = photo?.relativePath ? mediaUrls[photo.relativePath] : null;
  const body = String(mm.text || '').trim()
    || 'Το κείμενο του Δημάρχου θα εμφανιστεί εδώ.';
  const name = String(mm.mayorName || '').trim();

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: `linear-gradient(180deg, ${colors.accent} 0%, ${mixHex(colors.accent, colors.darkBand, 0.4)} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -60,
          bottom: 40,
          width: 220,
          height: 220,
          borderRadius: 220,
          background: rgbaOf(colors.accent, 0.06),
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 28,
          paddingLeft: 16,
          paddingRight: 8,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            width: 250,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 220,
              height: 280,
              borderRadius: 16,
              overflow: 'hidden',
              position: 'relative',
              background: colors.panel,
              border: `1px solid ${colors.panelBorder}`,
              boxShadow: `0 14px 36px ${rgbaOf(colors.darkBand, 0.16)}`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 5,
                background: colors.accent,
                zIndex: 1,
              }}
            />
            <div
              style={{
                width: '100%',
                height: '100%',
                ...(mediaUrl
                  ? coverImageStyle(photo, mediaUrl)
                  : {
                      background: `linear-gradient(160deg, ${colors.accentSoft} 0%, ${colors.panel} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.muted,
                      fontSize: type.caption,
                      fontWeight: 600,
                      padding: 16,
                      textAlign: 'center',
                    }),
              }}
            >
              {!mediaUrl ? 'Φωτογραφία Δημάρχου' : null}
            </div>
          </div>
          <div style={{ marginTop: 14, textAlign: 'center', maxWidth: 230 }}>
            {name ? (
              <div
                style={{
                  fontSize: type.body,
                  fontWeight: 800,
                  color: colors.text,
                  lineHeight: 1.2,
                }}
              >
                {name}
              </div>
            ) : null}
            <div
              style={{
                marginTop: name ? 4 : 0,
                fontSize: type.caption,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: colors.accent,
              }}
            >
              ΔΗΜΑΡΧΟΣ
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingBottom: 8,
          }}
        >
          <Eyebrow color={colors.accent} size={type.eyebrow}>Οδηγός παρουσίασης</Eyebrow>
          <div
            style={{
              fontSize: type.titleSection,
              fontWeight: 800,
              color: colors.text,
              marginTop: 8,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {mm.title || 'Μήνυμα Δημάρχου'}
          </div>
          <Rule color={colors.accent} width={56} height={4} top={12} />
          <div
            style={{
              marginTop: 18,
              position: 'relative',
              paddingLeft: 8,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: -4,
                top: -18,
                fontSize: 64,
                lineHeight: 1,
                fontWeight: 700,
                color: rgbaOf(colors.accent, 0.22),
                fontFamily: 'Georgia, "Times New Roman", serif',
                pointerEvents: 'none',
              }}
            >
              “
            </div>
            <div
              style={{
                fontSize: type.body + 1.5,
                lineHeight: 1.55,
                color: colors.text,
                fontWeight: 500,
                whiteSpace: 'pre-wrap',
                maxHeight: 280,
                overflow: 'hidden',
              }}
            >
              {body}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <SlideFooter footer={footer} design={design} />
      </div>
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
      {slide.type === 'toc' && (
        <TocSlide slide={slide} design={design} footer={footer} />
      )}
      {slide.type === 'mayor' && (
        <MayorSlide slide={slide} design={design} footer={footer} mediaUrls={mediaUrls} />
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
