import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { normalizeSearchText } from '../utils/searchUtils';

export function getEntityLinkedNotes(linkedNotesMap, entityId) {
  if (!entityId || !linkedNotesMap) return [];
  const list = linkedNotesMap[entityId];
  return Array.isArray(list) ? list : [];
}

function dedupeNoteLinks(links) {
  const seen = new Set();
  return (links || []).filter((l) => {
    if (!l?.noteId || seen.has(l.noteId)) return false;
    seen.add(l.noteId);
    return true;
  });
}

function pdfNamesMatch(a, b) {
  const na = normalizeSearchText(a || '');
  const nb = normalizeSearchText(b || '');
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

function collectEgkrisiLinksFromNotes(notes, linkedNotesMap, { subprojectTitle, pdfFileName } = {}) {
  const normSub = normalizeSearchText(subprojectTitle);
  const normPdf = normalizeSearchText(pdfFileName);
  const merged = [];

  for (const note of notes || []) {
    for (const ent of note.linkedEntities || []) {
      if (ent.type !== 'egkrisi' || !ent.id) continue;
      const links = getEntityLinkedNotes(linkedNotesMap, ent.id);
      if (!links.length) continue;
      const entNorm = normalizeSearchText(ent.title || '');
      const subOk = !normSub || entNorm.includes(normSub);
      const pdfOk = !normPdf || entNorm.includes(normPdf) || pdfNamesMatch(ent.title, pdfFileName);
      if (subOk && pdfOk) merged.push(...links);
    }
  }
  return merged;
}

/** Συσχετισμένες σημειώσεις για υποέργο στο panel εγκρίσεων */
export function getLinkedNotesForCreditSubproject(projects, projectTitle, subprojectTitle, linkedNotesMap, notes = []) {
  const normSub = normalizeSearchText(subprojectTitle);
  const normProj = normalizeSearchText(projectTitle);
  const merged = [];

  for (const p of projects || []) {
    if (normSub && normSub !== normalizeSearchText(p.subprojectTitle)) continue;
    if (normProj && normProj !== normalizeSearchText(p.projectTitle)) continue;
    for (const eg of p.egkriseisDialthesisPistosis || []) {
      merged.push(...getEntityLinkedNotes(linkedNotesMap, eg.id));
    }
    if (p.subprojectId) {
      merged.push(...getEntityLinkedNotes(linkedNotesMap, p.subprojectId));
    }
  }

  merged.push(...collectEgkrisiLinksFromNotes(notes, linkedNotesMap, { subprojectTitle }));
  return dedupeNoteLinks(merged);
}

/** Συσχετισμένες σημειώσεις για PDF έγκρισης */
export function getLinkedNotesForCreditPdf(projects, projectTitle, subprojectTitle, pdfFileName, linkedNotesMap, notes = []) {
  const normSub = normalizeSearchText(subprojectTitle);
  const normProj = normalizeSearchText(projectTitle);
  const merged = [];

  for (const p of projects || []) {
    if (normSub && normSub !== normalizeSearchText(p.subprojectTitle)) continue;
    if (normProj && normProj !== normalizeSearchText(p.projectTitle)) continue;
    for (const eg of p.egkriseisDialthesisPistosis || []) {
      if (pdfNamesMatch(eg.fileName, pdfFileName)) {
        merged.push(...getEntityLinkedNotes(linkedNotesMap, eg.id));
      }
    }
  }

  merged.push(...collectEgkrisiLinksFromNotes(notes, linkedNotesMap, { subprojectTitle, pdfFileName }));
  return dedupeNoteLinks(merged);
}

const stickerFloat = keyframes`
  0%, 100% {
    transform: rotate(var(--sticker-rotate, -5deg)) translateY(0);
  }
  50% {
    transform: rotate(calc(var(--sticker-rotate, -5deg) + 3deg)) translateY(-3px);
  }
`;

const stickerGlow = keyframes`
  0%, 100% {
    box-shadow:
      0 5px 16px rgba(161, 98, 7, 0.28),
      0 2px 4px rgba(15, 23, 42, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.65);
  }
  50% {
    box-shadow:
      0 8px 22px rgba(250, 204, 21, 0.45),
      0 4px 10px rgba(161, 98, 7, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
`;

const PLACEMENT_STYLES = {
  'top-left': css`
    --sticker-rotate: -7deg;
    top: -11px;
    left: 10px;
    right: auto;
    bottom: auto;
  `,
  'top-right': css`
    --sticker-rotate: 7deg;
    top: -11px;
    right: 8px;
    left: auto;
    bottom: auto;
  `,
  inline: css`
    --sticker-rotate: -4deg;
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    bottom: auto;
    flex-shrink: 0;
  `,
  'bottom-right': css`
    --sticker-rotate: 5deg;
    bottom: -11px;
    right: 12px;
    top: auto;
    left: auto;
  `,
};

const StickerBtn = styled.button`
  position: ${(p) => (p.$placement === 'inline' ? 'relative' : 'absolute')};
  z-index: 26;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 32px;
  min-height: 32px;
  padding: 4px 8px;
  border: none;
  border-radius: 2px 12px 12px 12px;
  background: linear-gradient(148deg, #fef9c3 0%, #fde68a 42%, #facc15 100%);
  color: #78350f;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  transform: rotate(var(--sticker-rotate, -5deg));
  animation: ${stickerFloat} 2.6s ease-in-out infinite, ${stickerGlow} 2.2s ease-in-out infinite;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 11px;
    height: 11px;
    background: linear-gradient(225deg, rgba(120, 53, 15, 0.12) 0%, transparent 55%);
    border-radius: 0 12px 0 0;
    pointer-events: none;
  }

  ${(p) => PLACEMENT_STYLES[p.$placement] || PLACEMENT_STYLES['top-left']}

  &:hover {
    animation: none;
    transform: rotate(calc(var(--sticker-rotate, -5deg) + 2deg)) scale(1.1);
    box-shadow:
      0 10px 26px rgba(161, 98, 7, 0.42),
      0 4px 12px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.85);
    z-index: 30;
  }

  &:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }
`;

const NoteIcon = styled.span`
  font-size: 1.05rem;
  line-height: 1;
`;

const Count = styled.span`
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(120, 53, 15, 0.18);
  color: #78350f;
  font-size: 0.62rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

function LinkedNoteSticker({ links, onOpenNote, placement = 'top-left', corner }) {
  if (!links?.length) return null;

  const resolvedPlacement = corner === 'top-right' ? 'top-right' : (placement || corner || 'top-left');

  const first = links[0];
  const title =
    links.length > 1
      ? `${links.length} συσχετισμένες σημειώσεις — ${first.noteTitle || ''}`
      : `Σημείωση: ${first.noteTitle || 'Χωρίς τίτλο'}`;

  return (
    <StickerBtn
      type="button"
      title={title}
      aria-label={title}
      $placement={resolvedPlacement}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpenNote && first?.noteId) onOpenNote(first.noteId);
      }}
    >
      <NoteIcon aria-hidden>📝</NoteIcon>
      {links.length > 1 && <Count>{links.length}</Count>}
    </StickerBtn>
  );
}

export default LinkedNoteSticker;
