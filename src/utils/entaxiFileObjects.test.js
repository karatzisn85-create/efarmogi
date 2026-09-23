/**
 * @jest-environment node
 */
import {
  collectEntaxiApprovalFileNames,
  partitionEntaxiViewerFiles,
  toExistingEntaxiFileObjects,
} from './entaxiFileObjects';

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

  test('μετονομασμένο αρχείο αποδοχής μένει ορατό όταν η ένταξη έχει και τα δύο είδη αρχείων', () => {
    const oldName = 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf';
    const newName = 'Αποδοχή ανανεωμένη.pdf';
    const stale = partitionEntaxiViewerFiles(
      ['απόφαση-ένταξης.pdf', newName],
      { entaxiPDFs: ['απόφαση-ένταξης.pdf'], approvalPDFs: [oldName] }
    );
    expect(stale.entaxiFiles).toEqual(['απόφαση-ένταξης.pdf']);
    expect(stale.approvalFiles).toEqual([newName]);

    const fresh = partitionEntaxiViewerFiles(
      ['απόφαση-ένταξης.pdf', newName],
      { entaxiPDFs: ['απόφαση-ένταξης.pdf'], approvalPDFs: [newName] }
    );
    expect(fresh.approvalFiles).toEqual([newName]);
    expect(fresh.entaxiFiles).toEqual(['απόφαση-ένταξης.pdf']);
  });

  test('άδειος ή άκυρος κατάλογος δίνει κενό πίνακα', () => {
    expect(toExistingEntaxiFileObjects(undefined)).toEqual([]);
    expect(toExistingEntaxiFileObjects(null)).toEqual([]);
    expect(toExistingEntaxiFileObjects([])).toEqual([]);
  });
});
