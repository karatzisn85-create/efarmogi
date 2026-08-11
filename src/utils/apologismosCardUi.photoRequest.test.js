/**
 * @jest-environment node
 */

import {
  getPhotoRequestUiState,
  cardHasAllRequiredPhotos,
  PHOTO_REQUEST_REMINDER_DAYS,
} from './apologismosCardUi';

const VIZ = [
  { id: 'before_after', photoPhases: ['before', 'after'] },
  { id: 'simple_card', photoPhases: [] },
];

describe('photo request UI state', () => {
  test('χωρίς φωτο-viz → none', () => {
    expect(getPhotoRequestUiState({
      source: 'linked',
      primaryViz: 'simple_card',
    }, VIZ).status).toBe('none');
  });

  test('idle όταν δεν έχει σταλεί αίτημα', () => {
    expect(getPhotoRequestUiState({
      source: 'linked',
      primaryViz: 'before_after',
      photos: { before: [], after: [] },
    }, VIZ).status).toBe('idle');
  });

  test('awaiting μετά από αίτημα χωρίς φωτογραφίες', () => {
    const state = getPhotoRequestUiState({
      source: 'linked',
      primaryViz: 'before_after',
      photos: { before: [], after: [] },
      photoRequestLast: { sentAt: new Date().toISOString() },
    }, VIZ);
    expect(state.status).toBe('awaiting');
    expect(state.label).toMatch(/Αναμονή/);
  });

  test('ready όταν υπάρχουν φωτογραφίες στις απαιτούμενες φάσεις', () => {
    expect(cardHasAllRequiredPhotos({
      primaryViz: 'before_after',
      photos: { before: [{ id: '1' }], after: [{ id: '2' }] },
    }, VIZ)).toBe(true);
    const state = getPhotoRequestUiState({
      source: 'linked',
      primaryViz: 'before_after',
      photos: { before: [{ id: '1' }], after: [{ id: '2' }] },
      photoRequestLast: { sentAt: new Date().toISOString() },
    }, VIZ);
    expect(state.status).toBe('ready');
  });

  test('reminder μετά από πολλές ημέρες χωρίς φωτογραφίες', () => {
    const old = new Date(Date.now() - (PHOTO_REQUEST_REMINDER_DAYS + 2) * 86400000).toISOString();
    const state = getPhotoRequestUiState({
      source: 'linked',
      primaryViz: 'before_after',
      photos: { before: [], after: [] },
      photoRequestLast: { sentAt: old },
    }, VIZ);
    expect(state.status).toBe('reminder');
    expect(state.daysSince).toBeGreaterThanOrEqual(PHOTO_REQUEST_REMINDER_DAYS);
  });
});
