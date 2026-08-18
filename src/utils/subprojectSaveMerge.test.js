/**
 * @jest-environment node
 */
const {
  mergeFileGroupsForSave,
  mergeEgkriseisForSave,
} = require('../../public/subprojectSaveMerge');

describe('mergeFileGroupsForSave — F1 διαγραμμένο αρχείο', () => {
  const disk = new Set(['αδειο.pdf', 'νεο.pdf']);
  const exists = (name) => disk.has(name);

  test('διαγραμμένο αρχείο της φόρμας δεν επανέρχεται', () => {
    const existing = [{
      id: 'g1',
      title: 'Άδειες',
      files: ['αδειο.pdf'],
    }];
    const incoming = [{
      id: 'g1',
      title: 'Άδειες',
      files: ['αδειο.pdf', 'σβησμενο.pdf'],
    }];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged).toHaveLength(1);
    expect(merged[0].files.map((f) => (typeof f === 'string' ? f : f.name))).toEqual(['αδειο.pdf']);
  });

  test('νέο ανέβασμα που υπάρχει στον φάκελο μπαίνει στην ομάδα', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const incoming = [{
      id: 'g1',
      title: 'Άδειες',
      files: ['αδειο.pdf', { name: 'νεο.pdf' }],
    }];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged[0].files).toEqual(['αδειο.pdf', { name: 'νεο.pdf' }]);
  });

  test('αρχείο που πρόσθεσε άλλος στον δίσκο μένει', () => {
    const existing = [{
      id: 'g1',
      title: 'Άδειες',
      files: ['αδειο.pdf', 'νεο.pdf'],
    }];
    const incoming = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged[0].files).toEqual(['αδειο.pdf', 'νεο.pdf']);
  });

  test('νέα ομάδα μόνο με διαγραμμένα αρχεία δεν δημιουργείται', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const incoming = [
      { id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] },
      { id: 'g-stale', title: 'Παλιά', files: ['σβησμενο.pdf'] },
    ];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged.map((g) => g.id)).toEqual(['g1']);
  });

  test('κενή φόρμα κρατά ό,τι υπάρχει στον δίσκο', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    expect(mergeFileGroupsForSave(existing, [], exists)).toEqual(existing);
    expect(mergeFileGroupsForSave(existing, null, exists)).toEqual(existing);
  });
});

describe('mergeFileGroupsForSave — νέο αρχείο από επεξεργασία κάρτας', () => {
  const disk = new Set(['αδειο.pdf']);
  const liveSources = new Set(['C:\\Users\\me\\Desktop\\συμβαση.pdf']);
  const exists = (name, file) => {
    if (disk.has(name)) return true;
    const src = typeof file === 'string' ? file : (file && (file.path || file.filePath));
    return !!(src && liveSources.has(src));
  };

  test('νέο αρχείο με πλήρη διαδρομή μπαίνει πριν την αντιγραφή στον φάκελο', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const incoming = [{
      id: 'g1',
      title: 'Άδειες',
      files: [
        'αδειο.pdf',
        { name: 'συμβαση.pdf', path: 'C:\\Users\\me\\Desktop\\συμβαση.pdf' },
      ],
    }];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged[0].files).toEqual([
      'αδειο.pdf',
      { name: 'συμβαση.pdf', path: 'C:\\Users\\me\\Desktop\\συμβαση.pdf' },
    ]);
  });

  test('νέα ομάδα μόνο με αρχείο από την φόρμα δημιουργείται', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const incoming = [
      { id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] },
      {
        id: 'g-new',
        title: 'Σύμβαση',
        files: [{ name: 'συμβαση.pdf', path: 'C:\\Users\\me\\Desktop\\συμβαση.pdf' }],
      },
    ];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged.map((g) => g.id)).toEqual(['g1', 'g-new']);
    expect(merged[1].files).toHaveLength(1);
  });

  test('διαγραμμένο με σκέτο όνομα (χωρίς διαδρομή) δεν επανέρχεται', () => {
    const existing = [{ id: 'g1', title: 'Άδειες', files: ['αδειο.pdf'] }];
    const incoming = [{
      id: 'g1',
      title: 'Άδειες',
      files: ['αδειο.pdf', { name: 'σβησμενο.pdf' }],
    }];
    const merged = mergeFileGroupsForSave(existing, incoming, exists);
    expect(merged[0].files).toEqual(['αδειο.pdf']);
  });
});

describe('mergeEgkriseisForSave — F2 τελευταία έγκριση', () => {
  test('κενός πίνακας στον δίσκο δεν γεμίζει από παλιά φόρμα', () => {
    const staleForm = [{ id: 'e1', fileName: 'egkrisi.pdf' }];
    expect(mergeEgkriseisForSave([], staleForm)).toEqual([]);
  });

  test('υπάρχουσες εγκρίσεις στον δίσκο δεν τις πατάει η φόρμα', () => {
    const onDisk = [{ id: 'e2', fileName: 'νεα.pdf' }];
    const staleForm = [{ id: 'e1', fileName: 'παλια.pdf' }];
    expect(mergeEgkriseisForSave(onDisk, staleForm)).toEqual(onDisk);
  });

  test('πρώτη αποθήκευση νέου υποέργου: δεν υπάρχει πίνακας → παίρνουμε τη φόρμα', () => {
    const fromForm = [{ id: 'e1', fileName: 'πρωτη.pdf' }];
    expect(mergeEgkriseisForSave(undefined, fromForm)).toEqual(fromForm);
    expect(mergeEgkriseisForSave(undefined, undefined)).toEqual([]);
  });
});
