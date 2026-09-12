import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { getEntityLinkedNotes } from './LinkedNoteSticker';
import { formatProposalStatusValue } from '../utils/orimanthiHelpers';
import {
  getEffectiveProsklisiDeadline,
  getOriginalProsklisiDeadline,
  getLatestProsklisiModificationDate,
  getProsklisiDeadlineChipMeta,
  normalizeLinkedOrimanthiProposals,
  normalizeLinkedProjects,
  formatProsklisiChangeValue,
  sortModificationsChronologically,
} from '../utils/prosklisiDeadlineUtils';
import { getProsklisiDiavgeiaEntry } from '../utils/prosklisiDiavgeiaRegistry';

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 1.15rem;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
  overscroll-behavior: contain;
`;

const Modal = styled.div`
  background: #ffffff;
  border-radius: 18px;
  width: min(calc(100% - 0.5rem), 1080px);
  max-height: min(92%, 860px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.20),
    0 24px 56px -16px rgba(15, 23, 42, 0.32),
    0 8px 24px rgba(79, 70, 229, 0.10);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: white;
  padding: 0.8rem 1.2rem 0.75rem;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProjectTitleSmall = styled.div`
  font-size: 0.68rem;
  opacity: 0.88;
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
`;

const SubjectTitle = styled.h2`
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const HeaderBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.35rem;
`;

const HeaderMetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.16);
  border: none;
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }
`;

const ModalBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem 1.15rem;
  background: #fafbff;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.45) transparent;
`;

const ModalBodyInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const HeroStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 0.55rem;
`;

const HeroChip = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid ${(p) => p.$border || 'rgba(148, 163, 184, 0.22)'};
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
`;

const HeroChipLabel = styled.div`
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-bottom: 0.3rem;
`;

const HeroChipValue = styled.div`
  font-size: ${(p) => (p.$large ? '1.05rem' : '0.88rem')};
  font-weight: ${(p) => (p.$strong ? 800 : 600)};
  color: ${(p) => p.$color || '#0f172a'};
  line-height: 1.35;
  word-break: break-word;
`;

const DetailSectionCard = styled.section`
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 2px 14px rgba(15, 23, 42, 0.05);
  overflow: hidden;
`;

const DetailSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(135deg, ${(p) => p.$accent}14 0%, rgba(255,255,255,0.6) 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  border-left: 4px solid ${(p) => p.$accent};

  .section-icon {
    font-size: 1rem;
    line-height: 1;
  }
`;

const DetailSectionTitle = styled.h3`
  margin: 0;
  font-size: 0.86rem;
  font-weight: 800;
  color: ${(p) => p.$accent};
  letter-spacing: 0.03em;
`;

const DetailSectionBody = styled.div`
  padding: 0.95rem 1rem 1.05rem;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.55rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
`;

const FieldFull = styled(Field)`
  grid-column: 1 / -1;
`;

const FieldLabel = styled.span`
  font-size: 0.66rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const FieldValue = styled.span`
  font-size: 0.9rem;
  color: #0f172a;
  font-weight: 500;
  word-break: break-word;
  line-height: 1.45;
  white-space: pre-wrap;
`;

const EmptyValue = styled.span`
  color: #cbd5e1;
  font-style: italic;
  font-size: 0.88rem;
`;

const LinkBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: #4338ca;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
  word-break: break-word;

  &:hover {
    text-decoration: underline;
  }
`;

const ModBlock = styled.div`
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #f8fafc;
  margin-bottom: 0.55rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ModTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 800;
  color: #4338ca;
  margin-bottom: 0.45rem;
`;

const ChangeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.45rem;
  font-size: 0.82rem;
  padding: 0.2rem 0;
`;

const ChangeFieldLabel = styled.span`
  font-weight: 700;
  color: #64748b;
  min-width: 7rem;
`;

const FileChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.15rem 0.35rem 0.15rem 0;
  padding: 0.22rem 0.5rem;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #c7d2fe;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: #e0e7ff;
  }
`;

const FileChipStatic = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.15rem 0.35rem 0.15rem 0;
  padding: 0.22rem 0.5rem;
  border-radius: 8px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 600;
`;

const EmptyHint = styled.div`
  color: #64748b;
  font-size: 0.82rem;
  font-style: italic;
`;

const DetailFooter = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.45rem 0.9rem 0.55rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: #f8fafc;
  flex-shrink: 0;
`;

const FooterBtn = styled.button`
  padding: 0.48rem 1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
`;

const FooterCloseBtn = styled(FooterBtn)`
  background: #fff;
  color: #64748b;
  border: 1px solid rgba(148, 163, 184, 0.35);

  &:hover {
    background: #f8fafc;
    color: #1e293b;
  }
`;

const FooterFilesBtn = styled(FooterBtn)`
  background: #fff;
  color: #4338ca;
  border: 1px solid rgba(99, 102, 241, 0.35);

  &:hover {
    background: #eef2ff;
  }
`;

const FooterGhostBtn = styled(FooterBtn)`
  background: #fff;
  color: #334155;
  border: 1px solid rgba(148, 163, 184, 0.35);

  &:hover:not(:disabled) {
    background: #f1f5f9;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ACCENTS = {
  basic: '#6366f1',
  dates: '#059669',
  codes: '#0ea5e9',
  links: '#8b5cf6',
  mods: '#4338ca',
  notes: '#64748b',
};

function SectionBlock({ icon, title, accent, children, testId }) {
  return (
    <DetailSectionCard data-testid={testId}>
      <DetailSectionHeader $accent={accent || ACCENTS.basic}>
        <span className="section-icon" aria-hidden>{icon}</span>
        <DetailSectionTitle $accent={accent || ACCENTS.basic}>{title}</DetailSectionTitle>
      </DetailSectionHeader>
      <DetailSectionBody>{children}</DetailSectionBody>
    </DetailSectionCard>
  );
}

function val(text) {
  const s = String(text || '').trim();
  return s ? s : null;
}

function formatChangeValue(field, value, formatDate) {
  return formatProsklisiChangeValue(field, value, (raw) => formatDetailDate(formatDate, raw) || '');
}

function getFieldLabel(field) {
  const labels = {
    fundingSource: 'Πηγή Χρηματοδότησης',
    deadline: 'Ημ. Λήξης',
    title: 'Τίτλος',
    axis: 'Άξονας',
    code: 'Κωδικός',
    budgetRange: 'Εύρος Π/Υ',
    status: 'Κατάσταση',
  };
  return labels[field] || field;
}

function getModificationDiavgeiaEntry(mod) {
  if (mod?.diavgeiaDocument) return mod.diavgeiaDocument;
  if (mod?.diavgeiaMeta?.ada) {
    return { ada: mod.diavgeiaMeta.ada, title: mod.diavgeiaMeta.title || '' };
  }
  if (mod?.diavgeiaAda) return { ada: mod.diavgeiaAda };
  return null;
}

function urgencyBorder(urgency) {
  if (urgency === 'expired') return 'rgba(220, 38, 38, 0.28)';
  if (urgency === 'urgent') return 'rgba(234, 88, 12, 0.32)';
  if (urgency === 'soon') return 'rgba(202, 138, 4, 0.32)';
  if (urgency === 'ok') return 'rgba(16, 185, 129, 0.3)';
  return 'rgba(148, 163, 184, 0.22)';
}

function urgencyColor(urgency) {
  if (urgency === 'expired') return '#b91c1c';
  if (urgency === 'urgent') return '#c2410c';
  if (urgency === 'soon') return '#a16207';
  if (urgency === 'ok') return '#059669';
  return '#0f172a';
}

function formatDetailDate(formatDate, value) {
  if (value == null || String(value).trim() === '' || String(value).trim() === '-') return '';
  if (typeof formatDate !== 'function') return String(value);
  const out = formatDate(value);
  if (!out || out === '-') return '';
  return out;
}

function sortModificationsForDetail(list) {
  return sortModificationsChronologically(list);
}

function ProsklisiDetailModal({
  prosklisi,
  modifications = [],
  relatedEntaxeis = [],
  onClose,
  onEdit,
  onNewModification,
  onOpenFiles,
  onOpenRelatedEntaxi,
  onOpenLinkedProject,
  onOpenLinkedOrimanthi,
  onOpenDiavgeia,
  onViewModificationPDF,
  onEditModification,
  onDeleteModification,
  onOpenNote,
  canManageWorkflow = false,
  isLocked = false,
  linkedNotesMap = {},
  notes = [],
  formatDate,
  blockEscape = false,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || blockEscape) return;
      if (document.querySelector('[data-testid="confirm-yes"]')) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, blockEscape]);

  const linkedNoteRefs = useMemo(
    () => getEntityLinkedNotes(linkedNotesMap, prosklisi?.prosklisiId),
    [linkedNotesMap, prosklisi?.prosklisiId]
  );

  const linkedNotes = useMemo(() => linkedNoteRefs.map((ref) => {
    const note = (notes || []).find((n) => n.id === ref.noteId);
    return {
      noteId: ref.noteId,
      title: note?.title || ref.noteTitle || 'Σημείωση',
      content: note?.content || '',
    };
  }), [linkedNoteRefs, notes]);

  if (!prosklisi) return null;

  const mods = sortModificationsForDetail(Array.isArray(modifications) ? modifications : []);
  const originalDeadline = getOriginalProsklisiDeadline(prosklisi, mods);
  const effectiveDeadline = getEffectiveProsklisiDeadline(prosklisi, mods);
  const lastModDate = getLatestProsklisiModificationDate(mods);
  const deadlineChip = getProsklisiDeadlineChipMeta(effectiveDeadline, formatDate);
  const deadlineChanged = val(originalDeadline) && val(originalDeadline) !== val(effectiveDeadline);
  const effectiveDeadlineLabel = formatDetailDate(formatDate, effectiveDeadline);
  const originalDeadlineLabel = formatDetailDate(formatDate, originalDeadline);
  const lastModDateLabel = formatDetailDate(formatDate, lastModDate);
  const diavgeiaEntry = getProsklisiDiavgeiaEntry(prosklisi, mods);
  const linkedProjects = normalizeLinkedProjects(prosklisi.linkedProjects);
  const orimanthiLinks = normalizeLinkedOrimanthiProposals(prosklisi.linkedOrimanthiProposals);

  return (
    <Overlay
      data-testid="psk-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Modal onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="psk-detail-title">
        <ModalHeader>
          <HeaderLeft>
            <ProjectTitleSmall>Πρόσκληση</ProjectTitleSmall>
            <SubjectTitle id="psk-detail-title" data-testid="psk-detail-title">
              {prosklisi.title || 'Χωρίς τίτλο'}
            </SubjectTitle>
            <HeaderBadges>
              {prosklisi.status ? <HeaderMetaBadge data-testid="psk-detail-status">{prosklisi.status}</HeaderMetaBadge> : null}
              {prosklisi.code ? <HeaderMetaBadge data-testid="psk-detail-code">{prosklisi.code}</HeaderMetaBadge> : null}
              {diavgeiaEntry?.ada ? (
                <HeaderMetaBadge data-testid="psk-detail-ada">ΑΔΑ {diavgeiaEntry.ada}</HeaderMetaBadge>
              ) : null}
            </HeaderBadges>
          </HeaderLeft>
          <HeaderActions>
            <CloseButton type="button" onClick={onClose} title="Κλείσιμο" aria-label="Κλείσιμο">×</CloseButton>
          </HeaderActions>
        </ModalHeader>

        <ModalBody>
          <ModalBodyInner>
            <HeroStrip>
              <HeroChip $border={urgencyBorder(deadlineChip?.urgency)}>
                <HeroChipLabel>Ισχύουσα λήξη</HeroChipLabel>
                <HeroChipValue
                  $strong
                  $color={urgencyColor(deadlineChip?.urgency)}
                  data-testid="psk-detail-deadline"
                >
                  {effectiveDeadlineLabel || <EmptyValue>—</EmptyValue>}
                </HeroChipValue>
              </HeroChip>
              {deadlineChanged ? (
                <HeroChip>
                  <HeroChipLabel>Αρχική λήξη</HeroChipLabel>
                  <HeroChipValue data-testid="psk-detail-original-deadline">
                    {originalDeadlineLabel}
                  </HeroChipValue>
                </HeroChip>
              ) : null}
              <HeroChip>
                <HeroChipLabel>Τροποποιήσεις</HeroChipLabel>
                <HeroChipValue $strong data-testid="psk-detail-mod-count">{mods.length}</HeroChipValue>
              </HeroChip>
              <HeroChip>
                <HeroChipLabel>Συσχετίσεις</HeroChipLabel>
                <HeroChipValue>
                  {linkedProjects.length} έργα · {orimanthiLinks.length} ωρίμανση · {relatedEntaxeis.length} εντάξεις
                </HeroChipValue>
              </HeroChip>
            </HeroStrip>

            <SectionBlock icon="📋" title="Βασικά στοιχεία" accent={ACCENTS.basic}>
              <FieldGrid>
                <FieldFull>
                  <FieldLabel>Άξονας / Δράση</FieldLabel>
                  <FieldValue data-testid="psk-detail-axis">
                    {val(prosklisi.axis) || <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </FieldFull>
                <Field>
                  <FieldLabel>Πηγή χρηματοδότησης</FieldLabel>
                  <FieldValue>{val(prosklisi.fundingSource) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Κωδικός & Α/Α ΟΠΣ</FieldLabel>
                  <FieldValue>{val(prosklisi.code) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Εύρος προϋπολογισμού</FieldLabel>
                  <FieldValue>{val(prosklisi.budgetRange) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Κατάσταση</FieldLabel>
                  <FieldValue>{val(prosklisi.status) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="📅" title="Προθεσμίες" accent={ACCENTS.dates}>
              <FieldGrid>
                <Field>
                  <FieldLabel>Ισχύουσα λήξη υποβολής</FieldLabel>
                  <FieldValue>{effectiveDeadlineLabel || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Αρχική λήξη</FieldLabel>
                  <FieldValue>{originalDeadlineLabel || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Τελευταία τροποποίηση</FieldLabel>
                  <FieldValue>{lastModDateLabel || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="🔢" title="Διαύγεια" accent={ACCENTS.codes}>
              <FieldGrid>
                <Field>
                  <FieldLabel>ΑΔΑ Διαύγειας</FieldLabel>
                  <FieldValue>
                    {diavgeiaEntry?.ada ? (
                      <LinkBtn type="button" onClick={() => onOpenDiavgeia?.(diavgeiaEntry)}>
                        {diavgeiaEntry.ada}
                      </LinkBtn>
                    ) : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="🔗" title="Συσχετίσεις" accent={ACCENTS.links} testId="psk-detail-links">
              <FieldGrid>
                <FieldFull>
                  <FieldLabel>Έργα χαρτοφυλακίου</FieldLabel>
                  <FieldValue data-testid="psk-detail-projects">
                    {linkedProjects.length
                      ? linkedProjects.map((row) => (
                        onOpenLinkedProject ? (
                          <FileChip
                            key={row.id}
                            type="button"
                            data-testid={`psk-detail-project-${row.id}`}
                            onClick={() => onOpenLinkedProject(row)}
                          >
                            {row.title || '(Χωρίς τίτλο)'}
                          </FileChip>
                        ) : (
                          <FileChipStatic key={row.id}>{row.title || '(Χωρίς τίτλο)'}</FileChipStatic>
                        )
                      ))
                      : <EmptyValue>Χωρίς συσχέτιση με έργο</EmptyValue>}
                  </FieldValue>
                </FieldFull>
                <FieldFull>
                  <FieldLabel>Έργα ωρίμανσης</FieldLabel>
                  <FieldValue data-testid="psk-detail-orimanthi">
                    {orimanthiLinks.length
                      ? orimanthiLinks.map((row) => {
                        const label = [
                          row.title || '(Χωρίς τίτλο)',
                          row.projectCategory,
                          row.municipalUnit,
                          row.status && formatProposalStatusValue(row.status) !== '(κενό)'
                            ? formatProposalStatusValue(row.status)
                            : '',
                        ].filter(Boolean).join(' · ');
                        return onOpenLinkedOrimanthi ? (
                          <FileChip
                            key={row.id}
                            type="button"
                            data-testid={`psk-detail-orimanthi-${row.id}`}
                            onClick={() => onOpenLinkedOrimanthi(row)}
                          >
                            {label}
                          </FileChip>
                        ) : (
                          <FileChipStatic key={row.id} data-testid={`psk-detail-orimanthi-${row.id}`}>
                            {label}
                          </FileChipStatic>
                        );
                      })
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </FieldFull>
                <FieldFull>
                  <FieldLabel>Σχετικές εντάξεις</FieldLabel>
                  <FieldValue data-testid="psk-detail-entaxeis">
                    {relatedEntaxeis.length
                      ? relatedEntaxeis.map((entaxi) => {
                        const label = entaxi.subject || entaxi.projectTitle || 'Ένταξη';
                        return onOpenRelatedEntaxi ? (
                          <FileChip
                            key={entaxi.entaxiId}
                            type="button"
                            data-testid={`psk-detail-entaxi-${entaxi.entaxiId}`}
                            onClick={() => onOpenRelatedEntaxi(entaxi)}
                          >
                            {label}
                          </FileChip>
                        ) : (
                          <FileChipStatic key={entaxi.entaxiId}>{label}</FileChipStatic>
                        );
                      })
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </FieldFull>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="📑" title="Τροποποιήσεις" accent={ACCENTS.mods} testId="psk-detail-mods">
              {mods.length === 0 ? (
                <EmptyHint>Δεν υπάρχουν επίσημες τροποποιήσεις για αυτή την πρόσκληση.</EmptyHint>
              ) : (
                mods.map((mod, index) => {
                  const changes = mod.changes && typeof mod.changes === 'object' ? Object.entries(mod.changes) : [];
                  const diavgeiaMod = getModificationDiavgeiaEntry(mod);
                  const modDate = formatDetailDate(formatDate, mod.modificationDocumentDate)
                    || formatDetailDate(formatDate, mod.createdAt);
                  const desc = val(mod.modificationDescription);
                  return (
                    <ModBlock key={mod.modificationId || index} data-testid={`psk-detail-mod-${index + 1}`}>
                      <ModTitle>
                        {index + 1}η τροποποίηση{modDate ? ` — ${modDate}` : ''}
                      </ModTitle>
                      <FieldGrid>
                        {desc ? (
                          <FieldFull>
                            <FieldLabel>Περιγραφή</FieldLabel>
                            <FieldValue>{desc}</FieldValue>
                          </FieldFull>
                        ) : null}
                        {diavgeiaMod?.ada ? (
                          <Field>
                            <FieldLabel>ΑΔΑ</FieldLabel>
                            <FieldValue>
                              <LinkBtn type="button" onClick={() => onOpenDiavgeia?.(diavgeiaMod)}>
                                {diavgeiaMod.ada}
                              </LinkBtn>
                            </FieldValue>
                          </Field>
                        ) : null}
                      </FieldGrid>
                      {changes.length > 0 ? (
                        <div style={{ marginTop: '0.45rem' }}>
                          {changes.map(([field, change]) => (
                            <ChangeRow key={field}>
                              <ChangeFieldLabel>{getFieldLabel(field)}</ChangeFieldLabel>
                              <span style={{ color: '#991b1b', textDecoration: 'line-through' }}>
                                {formatChangeValue(field, change?.original, formatDate)}
                              </span>
                              <span style={{ color: '#d97706' }}>→</span>
                              <span style={{ color: '#15803d', fontWeight: 700 }}>
                                {formatChangeValue(field, change?.current, formatDate)}
                              </span>
                            </ChangeRow>
                          ))}
                        </div>
                      ) : null}
                      {mod.modificationPDF ? (
                        <div style={{ marginTop: '0.45rem' }}>
                          <FileChip
                            type="button"
                            onClick={() => onViewModificationPDF?.(prosklisi.prosklisiId, mod.modificationId)}
                          >
                            Προβολή PDF τροποποίησης
                          </FileChip>
                        </div>
                      ) : null}
                      {canManageWorkflow ? (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem', flexWrap: 'wrap' }}>
                          <FooterGhostBtn
                            type="button"
                            disabled={isLocked}
                            onClick={() => onEditModification?.(mod, prosklisi.prosklisiId)}
                          >
                            Επεξεργασία τροποποίησης
                          </FooterGhostBtn>
                          <FooterGhostBtn
                            type="button"
                            disabled={isLocked}
                            onClick={() => onDeleteModification?.(prosklisi.prosklisiId, mod.modificationId)}
                          >
                            Διαγραφή τροποποίησης
                          </FooterGhostBtn>
                        </div>
                      ) : null}
                    </ModBlock>
                  );
                })
              )}
            </SectionBlock>

            {linkedNotes.length > 0 ? (
              <SectionBlock icon="📝" title="Συνδεδεμένες σημειώσεις" accent={ACCENTS.notes}>
                {linkedNotes.map((note, i) => (
                  <ModBlock key={note.noteId || note.title + i}>
                    <ModTitle>
                      {onOpenNote && linkedNoteRefs[i]?.noteId ? (
                        <LinkBtn type="button" onClick={() => onOpenNote(linkedNoteRefs[i])}>
                          {note.title}
                        </LinkBtn>
                      ) : note.title}
                    </ModTitle>
                    {note.content ? <FieldValue>{note.content}</FieldValue> : null}
                  </ModBlock>
                ))}
              </SectionBlock>
            ) : null}

            {(prosklisi.createdAt || prosklisi.updatedAt) ? (
              <SectionBlock icon="🕒" title="Καταχώρηση" accent={ACCENTS.notes}>
                <FieldGrid>
                  <Field>
                    <FieldLabel>Δημιουργία</FieldLabel>
                    <FieldValue>{formatDetailDate(formatDate, prosklisi.createdAt) || <EmptyValue>—</EmptyValue>}</FieldValue>
                  </Field>
                  <Field>
                    <FieldLabel>Ενημέρωση</FieldLabel>
                    <FieldValue>{formatDetailDate(formatDate, prosklisi.updatedAt) || <EmptyValue>—</EmptyValue>}</FieldValue>
                  </Field>
                </FieldGrid>
              </SectionBlock>
            ) : null}
          </ModalBodyInner>
        </ModalBody>

        <DetailFooter>
          <FooterCloseBtn type="button" data-testid="psk-detail-close" onClick={onClose}>Κλείσιμο</FooterCloseBtn>
          <FooterFilesBtn type="button" onClick={() => onOpenFiles?.(prosklisi)}>Αρχεία</FooterFilesBtn>
          {canManageWorkflow ? (
            <>
              <FooterGhostBtn type="button" disabled={isLocked} onClick={() => onEdit?.(prosklisi)}>
                Επεξεργασία
              </FooterGhostBtn>
              <FooterGhostBtn type="button" disabled={isLocked} onClick={() => onNewModification?.(prosklisi)}>
                Επίσημη τροποποίηση
              </FooterGhostBtn>
            </>
          ) : null}
        </DetailFooter>
      </Modal>
    </Overlay>
  );
}

export default ProsklisiDetailModal;
