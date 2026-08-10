/**
 * @jest-environment node
 */
const {
  suggestCategoryFromObjective,
  suggestCategoryFromEpActions,
  extractObjectiveCode,
} = require('../../public/apologismosEpSuggest');

describe('apologismosEpSuggest', () => {
  test('extractObjectiveCode από τίτλο ή κωδικό', () => {
    expect(extractObjectiveCode('1.3.1')).toBe('1.3.1');
    expect(extractObjectiveCode('1.3.1 Αναβάθμιση οδικού')).toBe('1.3.1');
  });

  test('γνωστοί ειδικοί στόχοι → σωστή κατηγορία', () => {
    expect(suggestCategoryFromObjective('1.3.1')).toBe('roads');
    expect(suggestCategoryFromObjective('1.2.2')).toBe('regeneration');
    expect(suggestCategoryFromObjective('1.3.3')).toBe('water');
    expect(suggestCategoryFromObjective('1.3.6')).toBe('sewerage');
    expect(suggestCategoryFromObjective('1.3.5')).toBe('waste');
    expect(suggestCategoryFromObjective('1.1.1')).toBe('environment');
    expect(suggestCategoryFromObjective('2.4.1')).toBe('buildings');
  });

  test('άγνωστος κωδικός → null', () => {
    expect(suggestCategoryFromObjective('9.9.9')).toBe(null);
    expect(suggestCategoryFromObjective('')).toBe(null);
  });

  test('suggest από λίστα δράσεων ΕΠ', () => {
    expect(
      suggestCategoryFromEpActions([{ objectiveCode: '1.3.2 Αναβάθμιση' }])
    ).toBe('mobility');
    expect(suggestCategoryFromEpActions([])).toBe(null);
  });
});
