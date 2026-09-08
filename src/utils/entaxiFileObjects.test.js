/**
 * @jest-environment node
 */
import { toExistingEntaxiFileObjects } from './entaxiFileObjects';

describe('toExistingEntaxiFileObjects', () => {
  test('κρατά ονόματα αρχείων από συμβολοσειρές και αντικείμενα', () => {
    expect(toExistingEntaxiFileObjects([
      'απόφαση.pdf',
      { fileName: 'έγκριση.pdf' },
      { name: 'άλλο.docx' },
      '',
      null,
    ])).toEqual([
      { fileName: 'απόφαση.pdf', originalName: 'απόφαση.pdf', isExisting: true },
      { fileName: 'έγκριση.pdf', originalName: 'έγκριση.pdf', isExisting: true },
      { fileName: 'άλλο.docx', originalName: 'άλλο.docx', isExisting: true },
    ]);
  });

  test('άδειος ή άκυρος κατάλογος δίνει κενό πίνακα', () => {
    expect(toExistingEntaxiFileObjects(undefined)).toEqual([]);
    expect(toExistingEntaxiFileObjects(null)).toEqual([]);
    expect(toExistingEntaxiFileObjects([])).toEqual([]);
  });
});
