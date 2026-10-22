/**
 * @jest-environment node
 */
import {
  collectEntaxiApprovalFileNames,
  collectEntaxiDecisionFileNames,
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

  test('το ίδιο αρχείο αποδοχής δεν εμφανίζεται δύο φορές', () => {
    expect(collectEntaxiApprovalFileNames({
      approvalPDFs: [
        'ΔΗΜΟΤΙΚΗ ΕΠΙΤΡΟΠΗ - ΑΠΟΔΟΧΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ.pdf',
        'ΔΗΜΟΤΙΚΗ ΕΠΙΤΡΟΠΗ - ΑΠΟΔΟΧΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ.pdf',
      ],
    })).toEqual(['ΔΗΜΟΤΙΚΗ ΕΠΙΤΡΟΠΗ - ΑΠΟΔΟΧΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ.pdf']);
  });

  test('το έγγραφο ένταξης από τη Διαύγεια δεν μπαίνει στην αποδοχή', () => {
    const ada = '6ΚΒ04653ΠΓ-2Λ6';
    const decision = `Ένταξη — Διαύγεια ${ada}.pdf`;
    const bare = `${ada}.pdf`;
    const entaxi = {
      diavgeiaAda: ada,
      entaxiPDFs: [decision],
      approvalPDFs: [],
    };
    const shown = partitionEntaxiViewerFiles([bare, decision], entaxi);
    expect(shown.entaxiFiles).toEqual([decision, bare]);
    expect(shown.approvalFiles).toEqual([]);

    const taggedByMistake = partitionEntaxiViewerFiles([bare, decision], {
      ...entaxi,
      approvalPDFs: [decision],
    });
    expect(taggedByMistake.entaxiFiles).toEqual([decision, bare]);
    expect(taggedByMistake.approvalFiles).toEqual([]);
  });

  test('παλιό μεμονωμένο αρχείο απόφασης μένει στη λίστα της ένταξης', () => {
    expect(collectEntaxiDecisionFileNames({
      entaxiPDF: '6Γ3Θ7ΛΚ-ΚΤΘ.pdf',
      entaxiPDFs: [],
    })).toEqual(['6Γ3Θ7ΛΚ-ΚΤΘ.pdf']);
  });

  test('αρχείο που δεν έχει χαρακτηριστεί αποδοχή δεν εμφανίζεται ως αποδοχή', () => {
    const shown = partitionEntaxiViewerFiles(
      ['Ένταξη — Διαύγεια 92ΘΕ7ΛΚ-ΚΓΞ.pdf', '63-2025.pdf'],
      {
        diavgeiaAda: '92ΘΕ7ΛΚ-ΚΓΞ',
        entaxiPDFs: ['Ένταξη — Διαύγεια 92ΘΕ7ΛΚ-ΚΓΞ.pdf'],
        approvalPDFs: [],
      }
    );
    expect(shown.entaxiFiles).toEqual(['Ένταξη — Διαύγεια 92ΘΕ7ΛΚ-ΚΓΞ.pdf', '63-2025.pdf']);
    expect(shown.approvalFiles).toEqual([]);
  });

  test('άδειος ή άκυρος κατάλογος δίνει κενό πίνακα', () => {
    expect(toExistingEntaxiFileObjects(undefined)).toEqual([]);
    expect(toExistingEntaxiFileObjects(null)).toEqual([]);
    expect(toExistingEntaxiFileObjects([])).toEqual([]);
  });
});
