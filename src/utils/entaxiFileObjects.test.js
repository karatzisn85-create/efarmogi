/**
 * @jest-environment node
 */
import { collectEntaxiApprovalFileNames, toExistingEntaxiFileObjects } from './entaxiFileObjects';

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

  test('συγκεντρώνει όλα τα αρχεία αποδοχής μαζί με το παλιό μεμονωμένο', () => {
    expect(collectEntaxiApprovalFileNames({
      approvalPDF: 'παλιό.pdf',
      approvalPDFs: ['νέο.docx', { fileName: 'άλλο.xlsx' }],
    })).toEqual(['παλιό.pdf', 'νέο.docx', 'άλλο.xlsx']);
  });

  test('άδειος ή άκυρος κατάλογος δίνει κενό πίνακα', () => {
    expect(toExistingEntaxiFileObjects(undefined)).toEqual([]);
    expect(toExistingEntaxiFileObjects(null)).toEqual([]);
    expect(toExistingEntaxiFileObjects([])).toEqual([]);
  });
});
