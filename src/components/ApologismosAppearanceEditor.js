import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  PALETTES,
  COVER_LAYOUTS,
  TEXT_SCALES,
  FOOTER_MODES,
  MAYOR_MESSAGE_TITLE,
  MAYOR_NAME_MAX,
  MAYOR_TEXT_MAX,
  normalizeAppearance,
  resolveOrganizationTitle,
  coverImageWarnings,
  coverImageStyle,
  getCoverLayout,
  coverImagesBySlot,
  resolveDesign,
} from '../utils/apologismosAppearance';
import { SLIDE_W, SLIDE_H, buildFooter } from '../utils/apologismosSlideDesign';
import ApologismosSlideView from './ApologismosSlideView';

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
const TextArea = styled.textarea`
  width: 100%; min-height: 110px; padding: 8px 10px; border-radius: 8px;
  border: 1px solid #cbd5e1; font-size: 0.95rem; resize: vertical;
  font-family: inherit; line-height: 1.45;
`;
const Warn = styled.div`
  margin-top: 8px; padding: 8px 10px; border-radius: 8px;
  background: #fff7ed; color: #9a3412; font-size: 0.85rem;
`;
const PreviewWrap = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
`;
const MiniFrame = styled.div`
  position: relative; overflow: hidden; border-radius: 10px;
  border: 1px solid #e2e8f0; background: #0f172a;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14);
`;
const MiniInner = styled.div`
  position: absolute; left: 0; top: 0; transform-origin: top left;
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

const MINI_WIDTH = 420;

/** Πεδία εμφάνισης που αποθηκεύονται — ένα σημείο αλήθειας για κάθε patch. */
function patchOf(a) {
  return {
    paletteId: a.paletteId,
    coverLayoutId: a.coverLayoutId,
    subtitle: a.subtitle,
    coverImages: a.coverImages,
    motionEnabled: a.motionEnabled === true,
    motionStyle: a.motionStyle || 'fade',
    textScale: a.textScale,
    footerMode: a.footerMode,
    sectionDividers: a.sectionDividers !== false,
    coverStats: a.coverStats !== false,
    showMunicipalityLogo: a.showMunicipalityLogo === true,
    mayorMessage: a.mayorMessage || {
      enabled: false,
      mayorName: '',
      text: '',
      photo: null,
    },
  };
}

/** Προεπισκόπηση πραγματικής διαφάνειας, σμικρυμένη από τον καμβά 960×540. */
function MiniSlide({ slide, design, footer, mediaMap, coverImages, branding }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(MINI_WIDTH / SLIDE_W);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(Math.min(MINI_WIDTH, w) / SLIDE_W);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: MINI_WIDTH }}>
      <MiniFrame style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
        <MiniInner style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}>
          <ApologismosSlideView
            slide={slide}
            design={design}
            footer={footer}
            mediaUrls={mediaMap}
            coverImages={coverImages}
            branding={branding}
          />
        </MiniInner>
      </MiniFrame>
    </div>
  );
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  return Number(raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.'));
}

function formatEuro(value) {
  const n = parseAmount(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Σύνοψη πραγματικών δεδομένων για τις προεπισκοπήσεις. */
function previewTotals(report) {
  const ready = (report?.cards || []).filter((c) => c.ready === true);
  const sum = (key) => ready.reduce((acc, c) => {
    const n = parseAmount(c[key]);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
  return {
    projectCount: ready.length,
    totalApproved: sum('approvedAmount'),
    totalContract: sum('contractAmount'),
    sample: ready[0] || null,
  };
}

/**
 * Διαφάνεια δείγματος όπως θα παραχθεί πραγματικά (όχι ψεύτικο «μόνο κείμενο»
 * πάνω σε κάρτα φωτογραφιών — αυτό μπέρδευε την προεπισκόπηση).
 */
function buildPreviewProjectSlide(sample) {
  const primaryViz = sample?.primaryViz || 'simple_card';
  const isSimple = primaryViz === 'simple_card';
  const isEconomy = primaryViz === 'economy_phases';
  const narrative = String(sample?.narrative || '').trim();
  const title = sample?.title || 'Τίτλος έργου';
  const area = sample?.area || '';
  const approvedText = formatEuro(sample?.approvedAmount ?? 1250000);
  const contractText = formatEuro(sample?.contractAmount ?? 1080000);

  let page;
  if (isSimple) {
    page = {
      type: 'simple',
      narrative: narrative || 'Σύντομη περιγραφή του έργου, όπως θα εμφανιστεί στη διαφάνεια.',
    };
  } else if (isEconomy) {
    page = {
      type: 'amounts',
      approvedAmount: sample?.approvedAmount,
      contractAmount: sample?.contractAmount,
    };
  } else if (primaryViz === 'metrics_table') {
    page = {
      type: 'metrics',
      metrics: (sample?.metrics || []).slice(0, 4).length
        ? (sample.metrics || []).slice(0, 4)
        : [
          { label: 'Δείκτης Α', value: '—' },
          { label: 'Δείκτης Β', value: '—' },
        ],
    };
  } else {
    // Φωτογραφίες / χάρτης: στο σώμα μένουν τα οπτικά· το κείμενο μόνο στην κεφαλίδα.
    page = { type: 'primary_photos', primary: { after: null } };
  }

  return {
    type: 'project',
    pageIndex: 0,
    sectionLabel: 'Οδοποιία και υποδομές',
    approvedText,
    contractText,
    page,
    entry: {
      display: {
        title,
        area,
        narrative,
        // Ίδιοι κανόνες με την πραγματική παρουσίαση
        showHeaderAmounts: !isEconomy,
        showHeaderNarrative: !isSimple && !!narrative,
      },
    },
  };
}

function FocusZoomSlot({
  index,
  image,
  mediaUrl,
  onPick,
  onChangeFocusZoom,
  onClear,
  label,
  zoomId,
}) {
  const dragging = useRef(null);
  const id = zoomId || `zoom-${index}`;

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
        <strong>{label || `Φωτογραφία ${index + 1}`}</strong>
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
        <Field htmlFor={id}>Μεγέθυνση ({(image?.zoom || 1).toFixed(2)}×)</Field>
        <input
          id={id}
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
  const [brandingPreview, setBrandingPreview] = useState(null);
  const snapshotRef = useRef(null);
  const pendingCoverRelsRef = useRef([]);

  useEffect(() => {
    if (!open) return;
    const a = normalizeAppearance(report?.appearance);
    setDraft(a);
    snapshotRef.current = a;
    pendingCoverRelsRef.current = [];
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- μόνο στο άνοιγμα

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-municipal-units-config');
        if (cancelled) return;
        if (res?.success && res.logoDataUrl) {
          setBrandingPreview({ showLogo: true, logoDataUrl: res.logoDataUrl });
        } else {
          setBrandingPreview(null);
        }
      } catch (_) {
        if (!cancelled) setBrandingPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const orgTitle = useMemo(() => resolveOrganizationTitle(appConfig || {}), [appConfig]);
  const theme = useMemo(
    () => PALETTES.find((p) => p.id === draft.paletteId)?.tokens || PALETTES[1].tokens,
    [draft.paletteId]
  );
  const layout = useMemo(() => getCoverLayout(draft.coverLayoutId), [draft.coverLayoutId]);
  const warnings = useMemo(() => coverImageWarnings(draft), [draft]);
  const design = useMemo(() => resolveDesign(draft), [draft]);
  const totals = useMemo(() => previewTotals(report), [report]);

  const refreshMedia = useCallback(async (appearance) => {
    const rels = (appearance?.coverImages || []).map((i) => i.relativePath).filter(Boolean);
    const mayorRel = appearance?.mayorMessage?.photo?.relativePath;
    if (mayorRel) rels.push(mayorRel);
    if (!rels.length) {
      setMediaMap({});
      return;
    }
    const res = await ipcRenderer.invoke('apologismos-resolve-media-map', {
      actingUsername: username,
      relativePaths: [...new Set(rels)],
      asDataUrl: true,
      variant: 'preview',
    });
    setMediaMap(res?.mediaMap || {});
  }, [username]);

  useEffect(() => {
    if (!open) return;
    refreshMedia(draft);
  }, [open, draft.coverImages, draft.mayorMessage?.photo?.relativePath, refreshMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  const appearanceDirty = useMemo(() => {
    if (!open || !snapshotRef.current) return false;
    return JSON.stringify(patchOf(draft)) !== JSON.stringify(patchOf(snapshotRef.current));
  }, [open, draft]);

  if (!open) return null;

  const applyLocal = (patch) => {
    setDraft((prev) => normalizeAppearance({ ...prev, ...patch }));
  };

  const discardPendingCoversAndClose = async () => {
    if (closing || saving) return;
    setClosing(true);
    try {
      // Επαναφορά αποθηκευμένης εμφάνισης + καθάρισμα προσωρινών αρχείων εξωφύλλου.
      if (snapshotRef.current && (appearanceDirty || pendingCoverRelsRef.current.length)) {
        const res = await ipcRenderer.invoke('apologismos-update-appearance', {
          actingUsername: username,
          periodId,
          patch: patchOf(snapshotRef.current),
        });
        if (res?.success) onSaved?.(res);
        else if (pendingCoverRelsRef.current.length) {
          showToast(res?.error || 'Δεν καθαρίστηκαν προσωρινές φωτογραφίες εξωφύλλου', 'error');
        }
      }
      pendingCoverRelsRef.current = [];
      onClose();
    } finally {
      setClosing(false);
    }
  };

  const handleClose = async () => {
    if (closing || saving) return;
    if (appearanceDirty || pendingCoverRelsRef.current.length) {
      const ok = window.confirm(
        'Υπάρχουν μη αποθηκευμένες αλλαγές εμφάνισης. Να κλείσετε χωρίς αποθήκευση;'
      );
      if (!ok) return;
    }
    await discardPendingCoversAndClose();
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
    const saved = await ipcRenderer.invoke('apologismos-save-cover-image', {
      actingUsername: username,
      periodId,
      sourcePath: pick.filePaths[0],
      slotIndex,
      commitToReport: false,
      kind: 'cover',
    });
    if (!saved?.success) {
      showToast(saved?.error || 'Αποτυχία αποθήκευσης φωτογραφίας', 'error');
      return;
    }
    const slots = coverImagesBySlot(draft);
    const prev = slots[slotIndex];
    slots[slotIndex] = {
      relativePath: saved.relativePath,
      focusX: prev?.focusX ?? 0.5,
      focusY: prev?.focusY ?? 0.5,
      zoom: prev?.zoom ?? 1,
      slot: slotIndex,
    };
    if (saved.relativePath) {
      pendingCoverRelsRef.current = [
        ...pendingCoverRelsRef.current.filter((r) => r !== prev?.relativePath),
        saved.relativePath,
      ];
    }
    applyLocal({ coverImages: slots.filter(Boolean) });
    showToast('Η φωτογραφία προστέθηκε στο πρόχειρο. Πατήστε «Αποθήκευση» για οριστικοποίηση.', 'info');
  };

  const patchMayor = (patch) => {
    setDraft((prev) => normalizeAppearance({
      ...prev,
      mayorMessage: {
        ...(prev.mayorMessage || { enabled: false, mayorName: '', text: '', photo: null }),
        ...patch,
      },
    }));
  };

  const pickMayorImage = async () => {
    const pick = await ipcRenderer.invoke('apologismos-select-cover-images', {
      actingUsername: username,
      multi: false,
    });
    if (!pick?.success || pick.canceled || !pick.filePaths?.[0]) return;
    const saved = await ipcRenderer.invoke('apologismos-save-cover-image', {
      actingUsername: username,
      periodId,
      sourcePath: pick.filePaths[0],
      commitToReport: false,
      kind: 'mayor',
    });
    if (!saved?.success) {
      showToast(saved?.error || 'Αποτυχία αποθήκευσης φωτογραφίας Δημάρχου', 'error');
      return;
    }
    setDraft((prev) => {
      const prevPhoto = prev.mayorMessage?.photo;
      if (saved.relativePath) {
        pendingCoverRelsRef.current = [
          ...pendingCoverRelsRef.current.filter((r) => r !== prevPhoto?.relativePath),
          saved.relativePath,
        ];
      }
      return normalizeAppearance({
        ...prev,
        mayorMessage: {
          ...(prev.mayorMessage || { enabled: false, mayorName: '', text: '', photo: null }),
          photo: {
            relativePath: saved.relativePath,
            focusX: prevPhoto?.focusX ?? 0.5,
            focusY: prevPhoto?.focusY ?? 0.4,
            zoom: prevPhoto?.zoom ?? 1,
          },
        },
      });
    });
    showToast('Η φωτογραφία Δημάρχου προστέθηκε στο πρόχειρο. Πατήστε «Αποθήκευση» για οριστικοποίηση.', 'info');
  };

  const onChangeMayorFocusZoom = (_index, patch) => {
    setDraft((prev) => {
      const prevPhoto = prev.mayorMessage?.photo;
      if (!prevPhoto?.relativePath) return prev;
      return normalizeAppearance({
        ...prev,
        mayorMessage: {
          ...(prev.mayorMessage || { enabled: false, mayorName: '', text: '', photo: null }),
          photo: { ...prevPhoto, ...patch },
        },
      });
    });
  };

  const clearMayorPhoto = () => {
    patchMayor({ photo: null });
  };

  const save = async () => {
    const mm = draft.mayorMessage || {};
    if (mm.enabled === true) {
      if (!String(mm.text || '').trim()) {
        showToast('Για τη σελίδα Δημάρχου χρειάζεται σύντομο κείμενο.', 'error');
        return;
      }
      if (!mm.photo?.relativePath) {
        showToast('Για τη σελίδα Δημάρχου χρειάζεται φωτογραφία.', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await ipcRenderer.invoke('apologismos-update-appearance', {
        actingUsername: username,
        periodId,
        patch: patchOf(draft),
      });
      if (!res?.success) {
        showToast(res?.error || 'Αποτυχία αποθήκευσης εμφάνισης', 'error');
        return;
      }
      onSaved?.(res);
      pendingCoverRelsRef.current = [];
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

        <StepLabel>4. Μέγεθος κειμένου στις διαφάνειες</StepLabel>
        <Grid>
          {TEXT_SCALES.map((s) => (
            <Chip
              key={s.id}
              type="button"
              $on={draft.textScale === s.id}
              $accent={theme.accent}
              onClick={() => applyLocal({ textScale: s.id })}
            >
              <ChipTitle>{s.label}</ChipTitle>
              <ChipDesc>{s.description}</ChipDesc>
            </Chip>
          ))}
        </Grid>

        <StepLabel>5. Υποσέλιδο διαφανειών</StepLabel>
        <Grid>
          {FOOTER_MODES.map((f) => (
            <Chip
              key={f.id}
              type="button"
              $on={draft.footerMode === f.id}
              $accent={theme.accent}
              onClick={() => applyLocal({ footerMode: f.id })}
            >
              <ChipTitle>{f.label}</ChipTitle>
              <ChipDesc>{f.description}</ChipDesc>
            </Chip>
          ))}
        </Grid>

        <StepLabel>6. Δομή παρουσίασης</StepLabel>
        <Grid>
          <Chip
            type="button"
            $on={draft.sectionDividers !== false}
            $accent={theme.accent}
            onClick={() => applyLocal({ sectionDividers: draft.sectionDividers === false })}
          >
            <ChipTitle>Διαφάνεια ανά κατηγορία</ChipTitle>
            <ChipDesc>
              Εισαγωγική διαφάνεια με το πλήθος και τα ποσά κάθε κατηγορίας έργων.
            </ChipDesc>
          </Chip>
          <Chip
            type="button"
            $on={draft.coverStats !== false}
            $accent={theme.accent}
            onClick={() => applyLocal({ coverStats: draft.coverStats === false })}
          >
            <ChipTitle>Σύνολα στο εξώφυλλο</ChipTitle>
            <ChipDesc>
              Πλήθος έργων, εγκεκριμένα ποσά και συμβάσεις κάτω από τον τίτλο.
            </ChipDesc>
          </Chip>
          <Chip
            type="button"
            $on={draft.showMunicipalityLogo === true}
            $accent={theme.accent}
            onClick={() => applyLocal({ showMunicipalityLogo: draft.showMunicipalityLogo !== true })}
          >
            <ChipTitle>Λογότυπο δήμου στις διαφάνειες</ChipTitle>
            <ChipDesc>
              {brandingPreview?.logoDataUrl
                ? 'Τοποθετεί διακριτικά το λογότυπο από τις Δημοτικές Ενότητες (εξώφυλλο και υδατογράφημα).'
                : 'Πρώτα προσθέστε λογότυπο στις ρυθμίσεις Δημοτικών Ενοτήτων· μετά ενεργοποιήστε το εδώ.'}
            </ChipDesc>
          </Chip>
        </Grid>

        <StepLabel>7. Μήνυμα Δημάρχου</StepLabel>
        <Chip
          type="button"
          $on={draft.mayorMessage?.enabled === true}
          $accent={theme.accent}
          onClick={() => patchMayor({ enabled: draft.mayorMessage?.enabled !== true })}
          style={{ width: '100%', maxWidth: 640 }}
        >
          <ChipTitle>Σελίδα μηνύματος μετά τα Περιεχόμενα</ChipTitle>
          <ChipDesc>
            Προσθέτει τη σελίδα 3 με σύντομο λόγο και φωτογραφία Δημάρχου· εμφανίζεται αυτόματα στα Περιεχόμενα.
          </ChipDesc>
        </Chip>
        {draft.mayorMessage?.enabled === true ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <Field htmlFor="mayor-name">Όνομα Δημάρχου (προαιρετικά)</Field>
              <Input
                id="mayor-name"
                value={draft.mayorMessage?.mayorName || ''}
                maxLength={MAYOR_NAME_MAX}
                placeholder="π.χ. Γιάννης Παπαδόπουλος"
                onChange={(e) => patchMayor({ mayorName: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <Field htmlFor="mayor-text">
                Σύντομο κείμενο ({String(draft.mayorMessage?.text || '').length}/{MAYOR_TEXT_MAX})
              </Field>
              <TextArea
                id="mayor-text"
                value={draft.mayorMessage?.text || ''}
                maxLength={MAYOR_TEXT_MAX}
                placeholder="Λίγες προτάσεις για τον απολογισμό της δημοτικής περιόδου…"
                onChange={(e) => patchMayor({ text: e.target.value })}
              />
            </div>
            <FocusZoomSlot
              index={0}
              label="Φωτογραφία Δημάρχου"
              zoomId="mayor-zoom"
              image={draft.mayorMessage?.photo}
              mediaUrl={
                draft.mayorMessage?.photo?.relativePath
                  ? mediaMap[draft.mayorMessage.photo.relativePath]
                  : null
              }
              onPick={() => pickMayorImage()}
              onChangeFocusZoom={onChangeMayorFocusZoom}
              onClear={clearMayorPhoto}
            />
            <div style={{ marginTop: 14, maxWidth: MINI_WIDTH + 20 }}>
              <StepLabel style={{ marginTop: 0 }}>Προεπισκόπηση σελίδας Δημάρχου</StepLabel>
              <MiniSlide
                design={design}
                mediaMap={mediaMap}
                footer={buildFooter({
                  design,
                  organizationTitle: orgTitle,
                  periodLabel,
                  index: 2,
                  total: Math.max(4, totals.projectCount + 3),
                })}
                slide={{
                  type: 'mayor',
                  mayorMessage: {
                    enabled: true,
                    title: MAYOR_MESSAGE_TITLE,
                    mayorName: draft.mayorMessage?.mayorName || '',
                    text: draft.mayorMessage?.text || 'Το κείμενο του Δημάρχου θα εμφανιστεί εδώ.',
                    photo: draft.mayorMessage?.photo || null,
                  },
                }}
              />
            </div>
          </div>
        ) : null}

        <PreviewWrap>
          <div>
            <StepLabel style={{ marginTop: 0 }}>Προεπισκόπηση εξωφύλλου</StepLabel>
            <MiniSlide
              design={design}
              mediaMap={mediaMap}
              coverImages={coverImagesBySlot(draft)}
              branding={draft.showMunicipalityLogo ? brandingPreview : null}
              slide={{
                type: 'cover',
                cover: { layoutId: draft.coverLayoutId },
                title: 'Απολογισμός τεχνικού έργου',
                organizationTitle: orgTitle || 'Οργανισμός',
                periodLabel,
                subtitle: draft.subtitle || '',
                stats: [
                  { label: 'Έργα', value: String(totals.projectCount) },
                  { label: 'Εγκεκριμένα', value: formatEuro(totals.totalApproved) },
                  { label: 'Συμβάσεις', value: formatEuro(totals.totalContract) },
                ],
              }}
            />
          </div>
          <div>
            <StepLabel style={{ marginTop: 0 }}>Προεπισκόπηση διαφάνειας έργου</StepLabel>
            <MiniSlide
              design={design}
              mediaMap={mediaMap}
              branding={draft.showMunicipalityLogo ? brandingPreview : null}
              footer={buildFooter({
                design,
                organizationTitle: orgTitle,
                periodLabel,
                index: 3,
                total: Math.max(4, totals.projectCount + 2),
              })}
              slide={buildPreviewProjectSlide(totals.sample)}
            />
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
