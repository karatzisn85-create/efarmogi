import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  PALETTES,
  COVER_LAYOUTS,
  normalizeAppearance,
  resolveOrganizationTitle,
  coverImageWarnings,
  coverImageStyle,
  getCoverLayout,
  coverImagesBySlot,
} from '../utils/apologismosAppearance';

const ipcRenderer = window.electronAPI;

const Back = styled.div`
  position: fixed; inset: 0; z-index: 1300;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
`;
const Box = styled.div`
  width: min(980px, 100%);
  max-height: min(92vh, 860px);
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  padding: 22px 24px 20px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
`;
const Title = styled.h2`
  margin: 0 0 4px; font-size: 1.25rem; color: #0f172a;
`;
const Sub = styled.p`
  margin: 0 0 16px; color: #64748b; font-size: 0.92rem;
`;
const StepLabel = styled.div`
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: #64748b; margin: 14px 0 8px;
`;
const Grid = styled.div`
  display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
`;
const Chip = styled.button`
  text-align: left; border-radius: 12px; padding: 12px;
  border: 2px solid ${(p) => (p.$on ? p.$accent || '#2563eb' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#f8fafc' : '#fff')};
  cursor: pointer;
  box-shadow: ${(p) => (p.$on ? `0 0 0 1px ${p.$accent || '#2563eb'}33` : 'none')};
`;
const ChipTitle = styled.div`font-weight: 700; color: #0f172a; font-size: 0.95rem;`;
const ChipDesc = styled.div`color: #64748b; font-size: 0.8rem; margin-top: 4px;`;
const SwatchRow = styled.div`display: flex; gap: 4px; margin-top: 8px;`;
const Swatch = styled.span`
  width: 18px; height: 18px; border-radius: 4px;
  background: ${(p) => p.$c}; border: 1px solid rgba(15,23,42,0.12);
`;
const Field = styled.label`
  display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;
`;
const Input = styled.input`
  width: 100%; padding: 8px 10px; border-radius: 8px;
  border: 1px solid #cbd5e1; font-size: 0.95rem;
`;
const Warn = styled.div`
  margin-top: 8px; padding: 8px 10px; border-radius: 8px;
  background: #fff7ed; color: #9a3412; font-size: 0.85rem;
`;
const PreviewWrap = styled.div`
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-top: 14px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;
const CoverPreview = styled.div`
  position: relative; height: 220px; border-radius: 12px; overflow: hidden;
  border: 1px solid #e2e8f0; background: ${(p) => p.$bg || '#1e293b'};
`;
const PageSample = styled.div`
  border-radius: 12px; border: 1px solid #e2e8f0; padding: 12px;
  background: ${(p) => p.$bg || '#f8fafc'}; color: ${(p) => p.$text || '#0f172a'};
`;
const Kpi = styled.div`
  margin-top: 10px; padding: 10px 12px; border-radius: 10px;
  background: ${(p) => p.$accent || '#2563eb'}; color: ${(p) => p.$accentText || '#fff'};
  font-weight: 800; font-size: 1.1rem;
`;
const SlotRow = styled.div`display: flex; flex-direction: column; gap: 10px; margin-top: 8px;`;
const SlotCard = styled.div`
  border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; background: #f8fafc;
`;
const FocusBox = styled.div`
  position: relative; height: 140px; border-radius: 10px; overflow: hidden;
  background: #e2e8f0 center/cover no-repeat; cursor: grab;
  border: 1px solid #cbd5e1;
  &:active { cursor: grabbing; }
`;
const Actions = styled.div`
  display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; flex-wrap: wrap;
`;
const Btn = styled.button`
  padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1;
  background: #fff; cursor: pointer; font-weight: 600;
`;
const Primary = styled(Btn)`
  background: #1d4ed8; color: #fff; border-color: #1d4ed8;
`;
const Ghost = styled(Btn)`background: #f1f5f9;`;
const ReadOnly = styled.div`
  font-size: 0.9rem; color: #475569; line-height: 1.45;
  padding: 8px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
`;

function coverLayerStyle(img, url, theme) {
  if (!img?.relativePath || !url) {
    return { background: theme.darkBand || '#1e293b' };
  }
  return coverImageStyle(img, url);
}

function CoverLivePreview({ appearance, theme, orgTitle, periodLabel, mediaMap }) {
  const a = normalizeAppearance(appearance);
  const layout = getCoverLayout(a.coverLayoutId);
  const imgs = coverImagesBySlot(a);
  const url0 = imgs[0] ? mediaMap[imgs[0].relativePath] : null;
  const url1 = imgs[1] ? mediaMap[imgs[1].relativePath] : null;

  const titleBar = (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 16px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
        color: '#fff',
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.9 }}>{orgTitle || 'Οργανισμός'}</div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Απολογισμός τεχνικού έργου</div>
      <div style={{ fontSize: 12, opacity: 0.92 }}>{periodLabel}</div>
      {a.subtitle ? <div style={{ fontSize: 11, marginTop: 2 }}>{a.subtitle}</div> : null}
    </div>
  );

  if (layout.id === 'hero_split') {
    return (
      <CoverPreview $bg={theme.darkBand}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, ...coverLayerStyle(imgs[0], url0, theme) }} />
          <div style={{ flex: 1, ...coverLayerStyle(imgs[1], url1, theme) }} />
        </div>
        {titleBar}
      </CoverPreview>
    );
  }
  if (layout.id === 'hero_side') {
    return (
      <CoverPreview $bg={theme.darkBand}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1.15, ...coverLayerStyle(imgs[0], url0, theme) }} />
          <div
            style={{
              flex: 1,
              background: theme.darkBand,
              color: theme.darkText,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.9 }}>{orgTitle || 'Οργανισμός'}</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 6 }}>Απολογισμός τεχνικού έργου</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{periodLabel}</div>
            {a.subtitle ? <div style={{ fontSize: 11, marginTop: 8, opacity: 0.9 }}>{a.subtitle}</div> : null}
          </div>
        </div>
      </CoverPreview>
    );
  }
  return (
    <CoverPreview $bg={theme.darkBand}>
      <div style={{ position: 'absolute', inset: 0, ...coverLayerStyle(imgs[0], url0, theme) }} />
      {titleBar}
    </CoverPreview>
  );
}

function FocusZoomSlot({
  index,
  image,
  mediaUrl,
  onPick,
  onChangeFocusZoom,
  onClear,
}) {
  const dragging = useRef(null);

  const onPointerDown = (e) => {
    if (!image?.relativePath) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragging.current = { rect };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onChangeFocusZoom(index, { focusX: x, focusY: y });
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const { rect } = dragging.current;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onChangeFocusZoom(index, { focusX: x, focusY: y });
  };
  const onPointerUp = () => { dragging.current = null; };

  return (
    <SlotCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong>Φωτογραφία {index + 1}</strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <Ghost type="button" onClick={() => onPick(index)}>Επιλογή…</Ghost>
          {image?.relativePath && (
            <Ghost type="button" onClick={() => onClear(index)}>Αφαίρεση</Ghost>
          )}
        </div>
      </div>
      <FocusBox
        style={image?.relativePath && mediaUrl ? coverImageStyle(image, mediaUrl) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Σύρετε για πλαίσιο κάλυψης"
      />
      <div style={{ marginTop: 8 }}>
        <Field htmlFor={`zoom-${index}`}>Μεγέθυνση ({(image?.zoom || 1).toFixed(2)}×)</Field>
        <input
          id={`zoom-${index}`}
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={image?.zoom || 1}
          disabled={!image?.relativePath}
          onChange={(e) => onChangeFocusZoom(index, { zoom: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>
    </SlotCard>
  );
}

export default function ApologismosAppearanceEditor({
  open,
  onClose,
  username,
  periodId,
  period,
  report,
  appConfig,
  showToast,
  onSaved,
}) {
  const [draft, setDraft] = useState(() => normalizeAppearance(report?.appearance));
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mediaMap, setMediaMap] = useState({});
  const snapshotRef = useRef(null);
  const autoPersistedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const a = normalizeAppearance(report?.appearance);
    setDraft(a);
    snapshotRef.current = a;
    autoPersistedRef.current = false;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- μόνο στο άνοιγμα

  const orgTitle = useMemo(() => resolveOrganizationTitle(appConfig || {}), [appConfig]);
  const theme = useMemo(
    () => PALETTES.find((p) => p.id === draft.paletteId)?.tokens || PALETTES[1].tokens,
    [draft.paletteId]
  );
  const layout = useMemo(() => getCoverLayout(draft.coverLayoutId), [draft.coverLayoutId]);
  const warnings = useMemo(() => coverImageWarnings(draft), [draft]);

  const refreshMedia = useCallback(async (appearance) => {
    const rels = (appearance?.coverImages || []).map((i) => i.relativePath).filter(Boolean);
    if (!rels.length) {
      setMediaMap({});
      return;
    }
    const res = await ipcRenderer.invoke('apologismos-resolve-media-map', {
      actingUsername: username,
      relativePaths: rels,
      asDataUrl: true,
    });
    setMediaMap(res?.mediaMap || {});
  }, [username]);

  useEffect(() => {
    if (!open) return;
    refreshMedia(draft);
  }, [open, draft.coverImages, refreshMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const applyLocal = (patch) => {
    setDraft((prev) => normalizeAppearance({ ...prev, ...patch }));
  };

  const handleClose = async () => {
    if (closing || saving) return;
    if (autoPersistedRef.current && snapshotRef.current) {
      setClosing(true);
      try {
        const snap = snapshotRef.current;
        const res = await ipcRenderer.invoke('apologismos-update-appearance', {
          actingUsername: username,
          periodId,
          patch: {
            paletteId: snap.paletteId,
            coverLayoutId: snap.coverLayoutId,
            subtitle: snap.subtitle,
            coverImages: snap.coverImages,
            motionEnabled: snap.motionEnabled === true,
            motionStyle: snap.motionStyle || 'fade',
          },
        });
        if (res?.success) onSaved?.(res);
        else showToast(res?.error || 'Δεν ήταν δυνατή η αναίρεση αλλαγών εμφάνισης', 'error');
      } finally {
        setClosing(false);
      }
    }
    onClose();
  };

  const onChangeFocusZoom = (index, patch) => {
    const slots = coverImagesBySlot(draft);
    if (!slots[index]?.relativePath) return;
    slots[index] = { ...slots[index], ...patch, slot: index };
    applyLocal({ coverImages: slots.filter(Boolean) });
  };

  const clearSlot = (index) => {
    const slots = coverImagesBySlot(draft);
    slots[index] = null;
    applyLocal({ coverImages: slots.filter(Boolean) });
  };

  const pickImage = async (slotIndex) => {
    const pick = await ipcRenderer.invoke('apologismos-select-cover-images', {
      actingUsername: username,
      multi: false,
    });
    if (!pick?.success || pick.canceled || !pick.filePaths?.[0]) return;
    // Αποθήκευση τρέχουσας παλέτας/μορφής ώστε η φωτό να μην γράψει πάνω σε παλιό draft.
    const persistDraft = await ipcRenderer.invoke('apologismos-update-appearance', {
      actingUsername: username,
      periodId,
      patch: {
        paletteId: draft.paletteId,
        coverLayoutId: draft.coverLayoutId,
        subtitle: draft.subtitle,
        coverImages: draft.coverImages,
        motionEnabled: draft.motionEnabled === true,
        motionStyle: draft.motionStyle || 'fade',
      },
    });
    if (!persistDraft?.success) {
      showToast(persistDraft?.error || 'Αποτυχία αποθήκευσης εμφάνισης', 'error');
      return;
    }
    const saved = await ipcRenderer.invoke('apologismos-save-cover-image', {
      actingUsername: username,
      periodId,
      sourcePath: pick.filePaths[0],
      slotIndex,
    });
    if (!saved?.success) {
      showToast(saved?.error || 'Αποτυχία αποθήκευσης φωτογραφίας', 'error');
      onSaved?.(persistDraft);
      return;
    }
    onSaved?.(saved);
    setDraft(normalizeAppearance(saved.appearance || saved.report?.appearance));
    autoPersistedRef.current = true;
    showToast('Η φωτογραφία εξωφύλλου αποθηκεύτηκε', 'success');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('apologismos-update-appearance', {
        actingUsername: username,
        periodId,
        patch: {
          paletteId: draft.paletteId,
          coverLayoutId: draft.coverLayoutId,
          subtitle: draft.subtitle,
          coverImages: draft.coverImages,
          motionEnabled: draft.motionEnabled === true,
          motionStyle: draft.motionStyle || 'fade',
        },
        patch: {
          paletteId: draft.paletteId,
          coverLayoutId: draft.coverLayoutId,
          subtitle: draft.subtitle,
          coverImages: draft.coverImages,
          motionEnabled: draft.motionEnabled === true,
          motionStyle: draft.motionStyle || 'fade',
        },
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία αποθήκευσης εμφάνισης', 'error');
        return;
      }
      onSaved?.(res);
      autoPersistedRef.current = false;
      snapshotRef.current = normalizeAppearance(res.appearance || res.report?.appearance);
      showToast('Η εμφάνιση αποθηκεύτηκε', 'success');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const periodLabel = period?.label || (period
    ? `Δημοτική περίοδος ${period.startYear}–${period.endYear}`
    : '');

  return (
    <Back onClick={handleClose}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Title>Εμφάνιση απολογισμού</Title>
        <Sub>Ίδια παλέτα και εξώφυλλο σε παρουσίαση οθόνης, έγγραφο και διαφάνειες.</Sub>

        <StepLabel>Κίνηση παρουσίασης</StepLabel>
        <Chip
          type="button"
          $on={draft.motionEnabled === true}
          $accent="#334155"
          onClick={() => applyLocal({ motionEnabled: !draft.motionEnabled, motionStyle: 'fade' })}
          style={{ width: '100%', maxWidth: 520 }}
        >
          <ChipTitle>Ήρεμη μετάβαση διαφανειών</ChipTitle>
          <ChipDesc>
            Διακριτικό ξεθώριασμα μεταξύ διαφανειών — στην παρουσίαση εντός εφαρμογής και στο εξαγόμενο αρχείο διαφανειών.
          </ChipDesc>
        </Chip>

        <StepLabel>1. Παλέτα χρωμάτων</StepLabel>
        <Grid>
          {PALETTES.map((p) => (
            <Chip
              key={p.id}
              type="button"
              $on={draft.paletteId === p.id}
              $accent={p.tokens.accent}
              onClick={() => applyLocal({ paletteId: p.id })}
            >
              <ChipTitle>{p.label}</ChipTitle>
              <ChipDesc>{p.description}</ChipDesc>
              <SwatchRow>
                <Swatch $c={p.tokens.darkBand} />
                <Swatch $c={p.tokens.accent} />
                <Swatch $c={p.tokens.surface} />
                <Swatch $c={p.tokens.bg} />
              </SwatchRow>
            </Chip>
          ))}
        </Grid>

        <StepLabel>2. Μορφή εξωφύλλου</StepLabel>
        <Grid>
          {COVER_LAYOUTS.map((l) => (
            <Chip
              key={l.id}
              type="button"
              $on={draft.coverLayoutId === l.id}
              onClick={() => {
                const kept = coverImagesBySlot(draft)
                  .filter(Boolean)
                  .slice(0, l.imageSlots)
                  .map((img, i) => ({ ...img, slot: i }));
                applyLocal({ coverLayoutId: l.id, coverImages: kept });
              }}
            >
              <ChipTitle>{l.label}</ChipTitle>
              <ChipDesc>{l.description}</ChipDesc>
            </Chip>
          ))}
        </Grid>

        <StepLabel>Κείμενα εξωφύλλου</StepLabel>
        <ReadOnly>
          <div><strong>Οργανισμός:</strong> {orgTitle || '— (ορίστε το στις ρυθμίσεις)'}</div>
          <div><strong>Τίτλος:</strong> Απολογισμός τεχνικού έργου</div>
          <div><strong>Περίοδος:</strong> {periodLabel || '—'}</div>
        </ReadOnly>
        <div style={{ marginTop: 10 }}>
          <Field htmlFor="appear-subtitle">Υπότιτλος (προαιρετικά)</Field>
          <Input
            id="appear-subtitle"
            value={draft.subtitle || ''}
            maxLength={120}
            placeholder="π.χ. Έργα που άλλαξαν την καθημερινότητα"
            onChange={(e) => applyLocal({ subtitle: e.target.value })}
          />
        </div>

        <StepLabel>3. Φωτογραφίες εξωφύλλου</StepLabel>
        <SlotRow>
          {Array.from({ length: layout.imageSlots }).map((_, i) => {
            const slotImg = coverImagesBySlot(draft)[i];
            return (
              <FocusZoomSlot
                key={i}
                index={i}
                image={slotImg}
                mediaUrl={slotImg ? mediaMap[slotImg.relativePath] : null}
                onPick={pickImage}
                onChangeFocusZoom={onChangeFocusZoom}
                onClear={clearSlot}
              />
            );
          })}
        </SlotRow>
        {warnings.map((w) => <Warn key={w}>{w}</Warn>)}

        <PreviewWrap>
          <div>
            <StepLabel style={{ marginTop: 0 }}>Προεπισκόπηση εξωφύλλου</StepLabel>
            <CoverLivePreview
              appearance={draft}
              theme={theme}
              orgTitle={orgTitle}
              periodLabel={periodLabel}
              mediaMap={mediaMap}
            />
          </div>
          <div>
            <StepLabel style={{ marginTop: 0 }}>Δείγμα σελίδας ποσών</StepLabel>
            <PageSample $bg={theme.bg} $text={theme.text}>
              <div style={{ fontSize: 12, color: theme.muted }}>Κατηγορία · Έργο</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>Τίτλος έργου</div>
              <Kpi $accent={theme.accent} $accentText={theme.accentText}>
                1.250.000,00 €
              </Kpi>
              <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>Εγκεκριμένο ποσό</div>
            </PageSample>
          </div>
        </PreviewWrap>

        <Actions>
          <Ghost type="button" disabled={saving || closing} onClick={handleClose}>Άκυρο</Ghost>
          <Primary type="button" disabled={saving || closing} onClick={save}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση εμφάνισης'}
          </Primary>
        </Actions>
      </Box>
    </Back>
  );
}
