import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useToast } from './ToastProvider';
import { buildEntaxiDetailReportPayload } from '../utils/entaxiDetailReportData';
import { exportEntaxiDetailReport } from '../utils/entaxiDetailReportExport';
import { openEntaxiDiavgeiaDocument } from '../utils/entaxiDiavgeiaRegistry';
import { getEntityLinkedNotes } from './LinkedNoteSticker';

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

const HeaderEditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.38rem 0.85rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.97);
  color: #4338ca;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);

  &:hover:not(:disabled) {
    background: #fff;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
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

const FileChip = styled.span`
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
  codes: '#0ea5e9',
  dates: '#059669',
  links: '#8b5cf6',
  mods: '#4338ca',
  files: '#6366f1',
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

function EntaxiDetailModal({
  entaxi,
  onClose,
  onEdit,
  onNewModification,
  onOpenFiles,
  onOpenProsklisi,
  onOpenNote,
  canManageWorkflow = false,
  isLocked = false,
  proskliseis = [],
  linkedNotesMap = {},
  notes = [],
  appConfig = {},
  appVersion = '',
  organizationName = '',
  blockEscape = false,
}) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || exporting || blockEscape) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, exporting, blockEscape]);

  const prosklisiTitle = useMemo(() => {
    if (!entaxi?.prosklisiId) return '';
    const found = (proskliseis || []).find((p) => p.prosklisiId === entaxi.prosklisiId);
    return found?.title || '';
  }, [entaxi, proskliseis]);

  const linkedNoteRefs = useMemo(
    () => getEntityLinkedNotes(linkedNotesMap, entaxi?.entaxiId),
    [linkedNotesMap, entaxi?.entaxiId]
  );

  const linkedNotes = useMemo(() => linkedNoteRefs.map((ref) => {
    const note = (notes || []).find((n) => n.id === ref.noteId);
    return {
      noteId: ref.noteId,
      title: note?.title || ref.noteTitle || 'Σημείωση',
      content: note?.content || '',
      updatedAt: note?.updatedAt || note?.createdAt || '',
    };
  }), [linkedNoteRefs, notes]);

  const data = useMemo(
    () => buildEntaxiDetailReportPayload({
      entaxi,
      prosklisiTitle,
      linkedNotes,
      appVersion,
      organizationName,
    }),
    [entaxi, prosklisiTitle, linkedNotes, appVersion, organizationName]
  );

  if (!entaxi) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEntaxiDetailReport({
        entaxi,
        proskliseis,
        linkedNotesMap,
        notes,
        appConfig,
        appVersion,
        organizationName,
        showToast,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleOpenAda = (entryOrMeta) => {
    void openEntaxiDiavgeiaDocument(entryOrMeta, { showToast });
  };

  return (
    <Overlay
      data-testid="ent-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Modal onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ent-detail-title">
        <ModalHeader>
          <HeaderLeft>
            <ProjectTitleSmall>
              {data.unlinked ? 'Ένταξη χωρίς συσχέτιση με έργο' : (data.projectTitle || 'Ένταξη')}
            </ProjectTitleSmall>
            <SubjectTitle id="ent-detail-title" data-testid="ent-detail-subject">
              {data.subject || 'Χωρίς θέμα'}
            </SubjectTitle>
            <HeaderBadges>
              {data.documentDate ? <HeaderMetaBadge>Έγγραφο {data.documentDate}</HeaderMetaBadge> : null}
              {data.opsCode ? <HeaderMetaBadge data-testid="ent-detail-ops">ΟΠΣ {data.opsCode}</HeaderMetaBadge> : null}
              {data.diavgeiaAda ? <HeaderMetaBadge data-testid="ent-detail-ada">ΑΔΑ {data.diavgeiaAda}</HeaderMetaBadge> : null}
            </HeaderBadges>
          </HeaderLeft>
          <HeaderActions>
            <HeaderEditBtn
              type="button"
              data-testid="ent-detail-report"
              disabled={exporting}
              onClick={handleExport}
              title="Αναφορά ένταξης σε PDF"
            >
              {exporting ? 'Δημιουργία…' : 'Αναφορά ένταξης'}
            </HeaderEditBtn>
            <CloseButton type="button" onClick={onClose} title="Κλείσιμο" aria-label="Κλείσιμο">×</CloseButton>
          </HeaderActions>
        </ModalHeader>

        <ModalBody>
          <ModalBodyInner>
            <HeroStrip>
              <HeroChip $border="rgba(16, 185, 129, 0.3)">
                <HeroChipLabel>Τρέχον σύνολο</HeroChipLabel>
                <HeroChipValue $strong $large $color="#059669" data-testid="ent-detail-current-amount">
                  {data.currentAmountLabel || <EmptyValue>—</EmptyValue>}
                </HeroChipValue>
              </HeroChip>
              <HeroChip>
                <HeroChipLabel>Αρχικό ποσό</HeroChipLabel>
                <HeroChipValue>{data.initialAmountLabel || <EmptyValue>—</EmptyValue>}</HeroChipValue>
              </HeroChip>
              {data.amountDeltaLabel ? (
                <HeroChip $border={data.amountDeltaNegative ? 'rgba(220, 38, 38, 0.28)' : 'rgba(99, 102, 241, 0.28)'}>
                  <HeroChipLabel>Μεταβολή</HeroChipLabel>
                  <HeroChipValue $strong $color={data.amountDeltaNegative ? '#b91c1c' : '#4338ca'}>
                    {data.amountDeltaLabel}
                  </HeroChipValue>
                </HeroChip>
              ) : null}
              <HeroChip>
                <HeroChipLabel>Τροποποιήσεις</HeroChipLabel>
                <HeroChipValue $strong data-testid="ent-detail-mod-count">
                  {data.modificationsCount}
                </HeroChipValue>
              </HeroChip>
            </HeroStrip>

            <SectionBlock icon="📋" title="Βασικά στοιχεία" accent={ACCENTS.basic}>
              <FieldGrid>
                <Field>
                  <FieldLabel>Φορέας χρηματοδότησης</FieldLabel>
                  <FieldValue>{val(data.fundingAuthority) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Δικαιούχος</FieldLabel>
                  <FieldValue>{val(data.beneficiary) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Ημερομηνία εγγράφου</FieldLabel>
                  <FieldValue>{val(data.documentDate) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                {data.comments ? (
                  <FieldFull>
                    <FieldLabel>Σχόλια</FieldLabel>
                    <FieldValue>{data.comments}</FieldValue>
                  </FieldFull>
                ) : null}
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="🔢" title="Κωδικοί και Διαύγεια" accent={ACCENTS.codes}>
              <FieldGrid>
                <Field>
                  <FieldLabel>Κωδικός ΟΠΣ</FieldLabel>
                  <FieldValue>{val(data.opsCode) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>ΑΔΑ Διαύγειας</FieldLabel>
                  <FieldValue>
                    {data.diavgeiaAda ? (
                      <LinkBtn type="button" onClick={() => handleOpenAda({ ada: data.diavgeiaAda })}>
                        {data.diavgeiaAda}
                      </LinkBtn>
                    ) : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="📅" title="Χρονοδιάγραμμα" accent={ACCENTS.dates}>
              <FieldGrid>
                <Field>
                  <FieldLabel>Έναρξη πράξης</FieldLabel>
                  <FieldValue>{val(data.startDate) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Λήξη πράξης</FieldLabel>
                  <FieldValue data-testid="ent-detail-end-date">
                    {val(data.endDate) || <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Προθεσμία ΝοΔε</FieldLabel>
                  <FieldValue>{val(data.legalCommitmentDeadline) || <EmptyValue>—</EmptyValue>}</FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="🔗" title="Συσχετίσεις" accent={ACCENTS.links}>
              <FieldGrid>
                <Field>
                  <FieldLabel>Έργα</FieldLabel>
                  <FieldValue data-testid="ent-detail-projects">
                    {data.unlinked
                      ? <EmptyValue>Χωρίς συσχέτιση με έργο</EmptyValue>
                      : (val(data.projectTitle) || <EmptyValue>—</EmptyValue>)}
                  </FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Συνδεδεμένα υποέργα</FieldLabel>
                  <FieldValue data-testid="ent-detail-sub-count">{data.subprojectCount || 0}</FieldValue>
                </Field>
                <Field>
                  <FieldLabel>Πρόσκληση</FieldLabel>
                  <FieldValue>
                    {data.prosklisiTitle && onOpenProsklisi ? (
                      <LinkBtn type="button" onClick={() => onOpenProsklisi(entaxi.prosklisiId)}>
                        {data.prosklisiTitle}
                      </LinkBtn>
                    ) : (val(data.prosklisiTitle) || <EmptyValue>—</EmptyValue>)}
                  </FieldValue>
                </Field>
              </FieldGrid>
            </SectionBlock>

            <SectionBlock icon="📑" title="Τροποποιήσεις" accent={ACCENTS.mods} testId="ent-detail-mods">
              {data.modifications.length === 0 ? (
                <EmptyHint>Δεν υπάρχουν τροποποιήσεις για αυτή την ένταξη.</EmptyHint>
              ) : (
                data.modifications.map((mod) => (
                  <ModBlock key={mod.index} data-testid={`ent-detail-mod-${mod.index}`}>
                    <ModTitle>
                      {mod.index}η τροποποίηση{mod.date ? ` — ${mod.date}` : ''}
                    </ModTitle>
                    <FieldGrid>
                      {mod.comments ? (
                        <FieldFull>
                          <FieldLabel>Σχόλια</FieldLabel>
                          <FieldValue>{mod.comments}</FieldValue>
                        </FieldFull>
                      ) : null}
                      {mod.changeAmount ? (
                        <Field>
                          <FieldLabel>Νέο σύνολο</FieldLabel>
                          <FieldValue>{mod.amountLabel}</FieldValue>
                        </Field>
                      ) : null}
                      {mod.deltaLabel ? (
                        <Field>
                          <FieldLabel>Μεταβολή</FieldLabel>
                          <FieldValue>{mod.deltaLabel}</FieldValue>
                        </Field>
                      ) : null}
                      {mod.ada ? (
                        <Field>
                          <FieldLabel>ΑΔΑ</FieldLabel>
                          <FieldValue>
                            <LinkBtn type="button" onClick={() => handleOpenAda({ ada: mod.ada })}>
                              {mod.ada}
                            </LinkBtn>
                          </FieldValue>
                        </Field>
                      ) : null}
                      {mod.endDate ? (
                        <Field>
                          <FieldLabel>Νέα λήξη πράξης</FieldLabel>
                          <FieldValue>{mod.endDate}</FieldValue>
                        </Field>
                      ) : null}
                      {mod.legalCommitmentDeadline ? (
                        <Field>
                          <FieldLabel>Νέα προθεσμία ΝοΔε</FieldLabel>
                          <FieldValue>{mod.legalCommitmentDeadline}</FieldValue>
                        </Field>
                      ) : null}
                    </FieldGrid>
                    {mod.files.length > 0 ? (
                      <div style={{ marginTop: '0.45rem' }}>
                        {mod.files.map((f) => (
                          <FileChip key={`${f.kind}-${f.name}`}>{f.kind}: {f.name}</FileChip>
                        ))}
                      </div>
                    ) : null}
                  </ModBlock>
                ))
              )}
            </SectionBlock>

            <SectionBlock icon="📁" title="Αρχεία" accent={ACCENTS.files}>
              <FieldGrid>
                <FieldFull>
                  <FieldLabel>Αρχεία ένταξης</FieldLabel>
                  <FieldValue>
                    {(data.files.entaxi || []).length
                      ? data.files.entaxi.map((name) => <FileChip key={name}>{name}</FileChip>)
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </FieldFull>
                <FieldFull>
                  <FieldLabel>Αποδοχή χρηματοδότησης</FieldLabel>
                  <FieldValue>
                    {(data.files.approval || []).length
                      ? data.files.approval.map((name) => <FileChip key={name}>{name}</FileChip>)
                      : <EmptyValue>—</EmptyValue>}
                  </FieldValue>
                </FieldFull>
              </FieldGrid>
            </SectionBlock>

            {data.notes.length > 0 ? (
              <SectionBlock icon="📝" title="Συνδεδεμένες σημειώσεις" accent={ACCENTS.notes}>
                {data.notes.map((note, i) => (
                  <ModBlock key={note.title + i}>
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

            {(data.createdAt || data.updatedAt) ? (
              <SectionBlock icon="🕒" title="Καταχώρηση" accent={ACCENTS.notes}>
                <FieldGrid>
                  <Field>
                    <FieldLabel>Δημιουργία</FieldLabel>
                    <FieldValue>{val(data.createdAt) || <EmptyValue>—</EmptyValue>}</FieldValue>
                  </Field>
                  <Field>
                    <FieldLabel>Ενημέρωση</FieldLabel>
                    <FieldValue>{val(data.updatedAt) || <EmptyValue>—</EmptyValue>}</FieldValue>
                  </Field>
                </FieldGrid>
              </SectionBlock>
            ) : null}
          </ModalBodyInner>
        </ModalBody>

        <DetailFooter>
          <FooterCloseBtn type="button" data-testid="ent-detail-close" onClick={onClose}>Κλείσιμο</FooterCloseBtn>
          <FooterFilesBtn type="button" onClick={() => onOpenFiles?.(entaxi)}>Αρχεία</FooterFilesBtn>
          {canManageWorkflow ? (
            <>
              <FooterGhostBtn type="button" disabled={isLocked} onClick={() => onEdit?.(entaxi)}>
                Επεξεργασία
              </FooterGhostBtn>
              <FooterGhostBtn type="button" disabled={isLocked} onClick={() => onNewModification?.(entaxi)}>
                Νέα τροποποίηση
              </FooterGhostBtn>
            </>
          ) : null}
        </DetailFooter>
      </Modal>
    </Overlay>
  );
}

export default EntaxiDetailModal;
