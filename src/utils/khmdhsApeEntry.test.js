/**
 * @jest-environment node
 */
import {
  applyContractApeFields,
  applyApeEntryToProject,
  applyPlannerApeItemsToForm,
  APE_RELATED_FILES_GROUP_TITLE,
  buildApeEntryTargetFromChainKind,
  findContractApeEntryBySourceAdam,
  buildDefaultApeFileGroupTitle,
  buildApeRelatedFilesGroupTitle,
  resolveApeContractArrayIndex,
  buildDefaultApeFileName,
  clearApeEntryFromProject,
  hasContractApe,
  hasApeEntryData,
  shouldShowApeSubCard,
  mergeApeFileIntoFileGroups,
  pickedApeFileNameFromPath,
  readContractApeFields,
  readApeFileRef,
  formatApeAmountDisplay,
  getApeKhmdhsReferenceAmountLabel,
  getLatestContractApeAmount,
  getTotalApeAmountGross,
  isLatestContractApeEntry,
  listContractApeEntries,
  syncPreservedContractApeAmount,
  hasRealStoredContractApe,
  stripPhantomContractApeFromForm,
  shouldPromptApeAmountInterpretation,
  resolveApeTotalFromInterpretation,
  isApeEntryModalDirty,
  buildApeEntryModalSnapshot,
  apeDocumentDateFromKhmdhsPreview,
  apeDocumentDateFromDiavgeiaPreview,
  sanitizeLegacyApeCommentsPollution,
} from './khmdhsApeEntry';
import { isPhaseADirty, pickPhaseASnapshot, serializePhaseASnapshot } from './projectFormPhases';

describe('khmdhsApeEntry', () => {
  test('applyContractApeFields σε πολλές συμβάσεις', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { amount: '100.000,00', apeAmount: '', comments: '' },
        { amount: '200.000,00', apeAmount: '', comments: '' },
      ],
    };
    const patch = applyContractApeFields(project, 1, {
      apeAmount: '215500,5',
      comments: 'δοκιμή',
    });
    expect(patch.contracts[1].apeAmount).toBe('215.500,50');
    expect(patch.contracts[1].apeComments).toBe('δοκιμή');
    expect(patch.contracts[1].comments).toBe('');
    expect(hasContractApe({ ...project, ...patch }, 1)).toBe(true);
  });

  test('applyContractApeFields σε μία σύμβαση', () => {
    const project = { implementationForm: 'Μια Σύμβαση', contractAmount: '50.000,00' };
    const patch = applyContractApeFields(project, 0, {
      apeAmount: '52000',
      comments: 'ΑΠΕ 2025',
    });
    expect(patch.apeAmount).toBe('52.000,00');
    expect(patch.apeComments).toBe('ΑΠΕ 2025');
    expect(patch.comments).toBeUndefined();
    expect(readContractApeFields({ ...project, ...patch }, 0).apeAmount).toBe('52.000,00');
  });

  test('σχόλια ΑΠΕ δεν αντιγράφονται στα γενικά σχόλια υποέργου', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '50.000,00',
      comments: 'γενικό σχόλιο υποέργου',
    };
    const patch = applyContractApeFields(project, 0, {
      apeAmount: '52.000,00',
      comments: 'μόνο για τον ΑΠΕ',
    });
    const merged = { ...project, ...patch };
    expect(merged.apeComments).toBe('μόνο για τον ΑΠΕ');
    expect(merged.comments).toBe('γενικό σχόλιο υποέργου');
  });

  test('formatApeAmountDisplay', () => {
    expect(formatApeAmountDisplay('256680')).toBe('256.680,00');
  });

  test('getApeKhmdhsReferenceAmountLabel', () => {
    expect(getApeKhmdhsReferenceAmountLabel({ kind: 'contract', parentTitle: 'Αρχική σύμβαση' }))
      .toBe('Ποσό αρχικής σύμβασης');
    expect(getApeKhmdhsReferenceAmountLabel({ kind: 'contract', parentTitle: 'Σύμβαση 2' }))
      .toBe('Ποσό σύμβασης');
    expect(getApeKhmdhsReferenceAmountLabel({ kind: 'supplementary', parentTitle: 'Συμπληρωματική 1' }))
      .toBe('Ποσό συμπληρωματικής (ΚΗΜΔΗΣ)');
  });

  test('buildDefaultApeFileName και group title', () => {
    expect(buildDefaultApeFileGroupTitle('Σύμβαση 1')).toBe(APE_RELATED_FILES_GROUP_TITLE);
    expect(buildDefaultApeFileGroupTitle('Αρχική σύμβαση')).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ');
    expect(buildDefaultApeFileName('Σύμβαση 1', 'C:/docs/ape.PDF')).toBe('ΑΠΕ — Σύμβαση 1.pdf');
  });

  test('mergeApeFileIntoFileGroups — νέα ομάδα', () => {
    const { fileGroups, groupId } = mergeApeFileIntoFileGroups([], {
      groupTitle: APE_RELATED_FILES_GROUP_TITLE,
      fileName: 'ΑΠΕ — Σύμβαση 1.pdf',
      sourcePath: 'C:/tmp/ape.pdf',
    });
    expect(fileGroups).toHaveLength(1);
    expect(fileGroups[0].title).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ');
    expect(fileGroups[0].files[0]).toEqual({
      path: 'C:/tmp/ape.pdf',
      name: 'ΑΠΕ — Σύμβαση 1.pdf',
    });
    expect(groupId).toBeTruthy();
  });

  test('pickedApeFileNameFromPath κρατά το αρχικό όνομα', () => {
    expect(pickedApeFileNameFromPath('C:/tmp/Βοηθητικό ΑΠΕ.pdf')).toBe('Βοηθητικό ΑΠΕ.pdf');
  });

  test('mergeApeFileIntoFileGroups — βοηθητικό δίπλα στο υπάρχον, χωρίς να το σβήσει', () => {
    const existing = [{
      id: 'g1',
      title: 'Σύμβαση 1',
      files: [{ name: 'ΑΠΕ — Σύμβαση 1.pdf' }],
    }];
    const { fileGroups } = mergeApeFileIntoFileGroups(existing, {
      groupId: 'g1',
      groupTitle: 'Σύμβαση 1',
      extraFiles: [{
        sourcePath: 'C:/tmp/βοηθητικό.pdf',
        fileName: 'βοηθητικό.pdf',
      }],
    });
    expect(fileGroups[0].files.map((f) => f.name)).toEqual([
      'ΑΠΕ — Σύμβαση 1.pdf',
      'βοηθητικό.pdf',
    ]);
    expect(fileGroups[0].files[1].path).toBe('C:/tmp/βοηθητικό.pdf');
  });

  test('mergeApeFileIntoFileGroups — ίδιο όνομα βοηθητικού παίρνει μοναδικό επίθημα', () => {
    const existing = [{
      id: 'g1',
      title: 'Σύμβαση 1',
      files: [{ name: 'ΑΠΕ.pdf' }],
    }];
    const { fileGroups } = mergeApeFileIntoFileGroups(existing, {
      groupId: 'g1',
      extraFiles: [{ sourcePath: 'C:/tmp/other.pdf', fileName: 'ΑΠΕ.pdf' }],
    });
    expect(fileGroups[0].files.map((f) => f.name)).toEqual(['ΑΠΕ.pdf', 'ΑΠΕ (1).pdf']);
  });

  test('applyApeEntryToProject προσθέτει extra αρχείο στην ομάδα ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      fileGroups: [{
        id: 'g1',
        title: 'ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ',
        files: [{ name: 'ΑΠΕ — Σύμβαση.pdf' }],
      }],
      apeFileName: 'ΑΠΕ — Σύμβαση.pdf',
      apeFileGroupId: 'g1',
      apeFileGroupTitle: 'ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ',
    };
    const next = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση' },
      {
        apeAmount: '110000',
        file: {
          extraFiles: [{
            sourcePath: 'C:/tmp/βοηθητικό.pdf',
            fileName: 'βοηθητικό.pdf',
          }],
        },
      }
    );
    const related = next.fileGroups.find((g) => g.title === APE_RELATED_FILES_GROUP_TITLE);
    expect(related).toBeTruthy();
    expect(related.files.map((f) => (typeof f === 'string' ? f : f.name))).toEqual(['βοηθητικό.pdf']);
    expect(next.fileGroups.find((g) => g.id === 'g1').files.map((f) => f.name)).toEqual(['ΑΠΕ — Σύμβαση.pdf']);
    expect(next.apeFileGroupId).toBe('g1');
    expect(next.apeFileGroupTitle).toBe('ΑΡΧΙΚΗ ΣΥΜΒΑΣΗ');
  });

  test('δεύτερο χειροκίνητο αρχείο ΑΠΕ μπαίνει στην ίδια ομάδα', () => {
    let project = {
      implementationForm: 'Μια Σύμβαση',
      fileGroups: [],
    };
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση' },
      {
        apeAmount: '20000',
        file: {
          sourcePath: 'C:/tmp/a.pdf',
          fileName: 'ένα.pdf',
        },
      }
    );
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση' },
      {
        apeAmount: '20000',
        file: {
          extraFiles: [{ sourcePath: 'C:/tmp/b.pdf', fileName: 'δύο.pdf' }],
        },
      }
    );
    const related = project.fileGroups.filter((g) => g.title === APE_RELATED_FILES_GROUP_TITLE);
    expect(related).toHaveLength(1);
    expect(related[0].files.map((f) => f.name)).toEqual(['ένα.pdf', 'δύο.pdf']);
  });

  test('applyApeEntryToProject με αρχείο', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [{ amount: '100.000,00' }],
      fileGroups: [],
    };
    const next = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση 1' },
      {
        apeAmount: '110000',
        comments: 'με αρχείο',
        file: {
          sourcePath: 'C:/tmp/ape.pdf',
          fileName: 'ΑΠΕ Σύμβαση 1.pdf',
          groupTitle: 'Σύμβαση 1',
        },
      }
    );
    expect(next.contracts[0].apeAmount).toBe('110.000,00');
    expect(readApeFileRef(next, { kind: 'contract', arrayIndex: 0 }).fileName).toBe('ΑΠΕ Σύμβαση 1.pdf');
    expect(next.fileGroups[0].title).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 1');
    expect(next.fileGroups[0].files).toHaveLength(1);
  });

  test('applyContractApeFields αποθηκεύει ΑΔΑ Διαύγειας', () => {
    const project = { implementationForm: 'Μια Σύμβαση', contractAmount: '50.000,00' };
    const patch = applyContractApeFields(project, 0, {
      apeAmount: '52000',
      diavgeiaAda: 'ρωεκωψμ-σ0υ',
    });
    expect(patch.apeDiavgeiaAda).toBe('ΡΩΕΚΩΨΜ-Σ0Υ');
    expect(readContractApeFields({ ...project, ...patch }, 0).diavgeiaAda).toBe('ΡΩΕΚΩΨΜ-Σ0Υ');
  });

  test('hasApeEntryData — ΑΔΑ Διαύγειας χωρίς ποσό', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      apeDiavgeiaAda: 'ΡΩΕΚΩΨΜ-Σ0Υ',
    };
    expect(hasApeEntryData(project, { kind: 'contract', arrayIndex: 0 })).toBe(true);
  });

  test('shouldShowApeSubCard — όχι σε παράταση ακόμα κι αν υπάρχουν δεδομένα', () => {
    const project = {
      supplementaryContracts: [{
        date: '2025-01-01',
        amount: '0',
        apeAmount: '1000',
        apeDiavgeiaAda: 'ΑΒΓ-123',
      }],
    };
    const entry = { label: 'Παράταση', isExtension: true, displayTitle: 'Παράταση' };
    expect(shouldShowApeSubCard(
      project,
      { kind: 'supplementary', arrayIndex: 0 },
      entry
    )).toBe(false);
  });

  test('clearApeEntryFromProject αφαιρεί αρχείο', () => {
    const project = applyApeEntryToProject(
      {
        implementationForm: 'Μια Σύμβαση',
        fileGroups: [],
      },
      { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση' },
      {
        apeAmount: '50000',
        file: {
          sourcePath: 'C:/tmp/ape.pdf',
          fileName: 'ΑΠΕ.pdf',
          groupTitle: 'Σύμβαση',
        },
      }
    );
    const cleared = { ...project, ...clearApeEntryFromProject(project, { kind: 'contract', arrayIndex: 0 }) };
    expect(cleared.apeAmount).toBe('');
    expect(readApeFileRef(cleared, { kind: 'contract', arrayIndex: 0 }).fileName).toBe('');
    expect(cleared.fileGroups).toHaveLength(0);
  });

  test('πολλαπλές καταχωρήσεις ΑΠΕ — ταξινόμηση και τελευταίο ποσό', () => {
    let project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '1.191.178,29',
      fileGroups: [],
    };
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση', entryId: null },
      { apeAmount: '1416302.98', documentDate: '2024-03-28', comments: 'ΑΠΕ 1' }
    );
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση', entryId: null },
      { apeAmount: '1600000', documentDate: '2025-06-01', comments: 'ΑΠΕ 2' }
    );
    const entries = listContractApeEntries(project, 0);
    expect(entries).toHaveLength(2);
    expect(entries[0].documentDate).toBe('2024-03-28');
    expect(entries[1].documentDate).toBe('2025-06-01');
    expect(getLatestContractApeAmount(project, 0)).toBe('1.600.000,00');
    expect(isLatestContractApeEntry(project, 0, entries[0].id)).toBe(false);
    expect(isLatestContractApeEntry(project, 0, entries[1].id)).toBe(true);
  });

  test('πλακίδιο ΑΠΕ διαβάζει ελληνικές χιλιάδες — όχι parseFloat που κόβει το 399.959,77 σε 399,96', () => {
    const greek = '399.959,77';
    expect(parseFloat(String(greek).replace(',', '.'))).toBeCloseTo(399.959, 3);
    const project = {
      implementationForm: 'Μια Σύμβαση',
      apeAmount: greek,
      apeEntries: [{
        id: 'ape-1',
        documentDate: '2025-10-27',
        apeAmount: greek,
      }],
    };
    expect(getTotalApeAmountGross(project)).toBeCloseTo(399959.77, 2);
  });

  test('όχι φανταστικός ΑΠΕ από γενικά σχόλια ή ετικέτα συμπληρωματικής', () => {
    const singleContract = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '332.101,10',
      comments: 'σημείωση σύμβασης',
    };
    expect(listContractApeEntries(singleContract, 0)).toHaveLength(0);
    expect(shouldShowApeSubCard(singleContract, { kind: 'contract', arrayIndex: 0 })).toBe(false);

    const multiContract = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [{ amount: '100.000,00', comments: 'γενικό σχόλιο' }],
    };
    expect(listContractApeEntries(multiContract, 0)).toHaveLength(0);

    const supplementaryLabelOnly = {
      supplementaryContracts: [{
        date: '2024-12-22',
        amount: '50.000,00',
        comments: 'Συμπληρωματική σύμβαση',
      }],
    };
    const suppEntry = { label: 'Συμπληρωματική σύμβαση', isExtension: false };
    expect(shouldShowApeSubCard(
      supplementaryLabelOnly,
      { kind: 'supplementary', arrayIndex: 0 },
      suppEntry
    )).toBe(false);
    expect(hasApeEntryData(supplementaryLabelOnly, { kind: 'supplementary', arrayIndex: 0 })).toBe(false);

    const extensionLabelOnly = {
      supplementaryContracts: [{
        date: '2025-01-01',
        amount: '0',
        comments: 'Παράταση',
      }],
    };
    const extEntry = { label: 'Παράταση', isExtension: true };
    expect(shouldShowApeSubCard(
      extensionLabelOnly,
      { kind: 'supplementary', arrayIndex: 0 },
      extEntry
    )).toBe(false);
  });

  test('διαγραφή συγκεκριμένης καταχώρισης ΑΠΕ', () => {
    let project = applyApeEntryToProject(
      { implementationForm: 'Μια Σύμβαση', contractAmount: '100.000,00', fileGroups: [] },
      { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση', entryId: null },
      { apeAmount: '110000', documentDate: '2024-01-01' }
    );
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση', entryId: null },
      { apeAmount: '120000', documentDate: '2025-01-01' }
    );
    const removeId = listContractApeEntries(project, 0)[0].id;
    project = { ...project, ...clearApeEntryFromProject(project, { kind: 'contract', arrayIndex: 0, entryId: removeId }) };
    expect(listContractApeEntries(project, 0)).toHaveLength(1);
    expect(getLatestContractApeAmount(project, 0)).toBe('120.000,00');
  });

  test('shouldPromptApeAmountInterpretation όταν το ποσό είναι μικρότερο της σύμβασης', () => {
    expect(shouldPromptApeAmountInterpretation('50.000,00', '236.290,21')).toBe(true);
    expect(shouldPromptApeAmountInterpretation('236.290,21', '236.290,21')).toBe(false);
    expect(shouldPromptApeAmountInterpretation('300.000,00', '236.290,21')).toBe(false);
  });

  test('resolveApeTotalFromInterpretation — συνολικό ή διαφορά', () => {
    expect(resolveApeTotalFromInterpretation('50.000,00', '236.290,21', 'total'))
      .toBe('50.000,00');
    expect(resolveApeTotalFromInterpretation('50.000,00', '236.290,21', 'delta'))
      .toBe('286.290,21');
    // Σύμβαση σε μορφή με τελεία (από API) — όχι 100× λάθος στο άθροισμα
    expect(resolveApeTotalFromInterpretation('62.286,89', '236290.21', 'delta'))
      .toBe('298.577,10');
    expect(resolveApeTotalFromInterpretation('62.286,89', '23.629.021,00', 'delta', 236290.21))
      .toBe('298.577,10');
  });

  test('isApeEntryModalDirty ανιχνεύει αλλαγές', () => {
    const baseline = buildApeEntryModalSnapshot({ apeAmount: '', comments: '' });
    expect(isApeEntryModalDirty({ apeAmount: '10.000,00', comments: '' }, baseline)).toBe(true);
    expect(isApeEntryModalDirty({ apeAmount: '', comments: '' }, baseline)).toBe(false);
  });

  test('apeDocumentDateFromKhmdhsPreview και Diavgeia', () => {
    expect(apeDocumentDateFromKhmdhsPreview({ signedDate: '2024-05-15' })).toBe('2024-05-15');
    expect(apeDocumentDateFromKhmdhsPreview({ signedDateDisplay: '15/05/2024' })).toBe('2024-05-15');
    expect(apeDocumentDateFromDiavgeiaPreview({ issueDate: '2025-10-27' })).toBe('2025-10-27');
    expect(apeDocumentDateFromDiavgeiaPreview({ issueDateDisplay: '27/10/2025' })).toBe('2025-10-27');
  });

  test('legacy apeAmount συμπληρώνει apeEntries χωρίς ποσό (μετά ανάκτηση)', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '494.855,49',
      apeAmount: '554.600,51',
      apeEntries: [{
        id: 'ape-1',
        documentDate: '2020-10-09',
        apeAmount: '',
        apeSourceAdam: '20SYMV007453715',
        apeDiavgeiaAda: 'ΩΝΙΝΝ-Ψ7Ψ',
      }],
    };
    const entries = listContractApeEntries(project, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].apeAmount).toBe('554.600,51');
    expect(readContractApeFields(project, 0, entries[0].id).apeAmount).toBe('554.600,51');
  });

  test('δεν εμφανίζεται ΑΠΕ όταν το ποσό ισούται με σύμβαση χωρίς μεταδεδομένα', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '37.076,00',
      apeAmount: '37.076,00',
      apeEntries: [{ id: 'ghost', apeAmount: '' }],
    };
    expect(hasRealStoredContractApe(project, 0)).toBe(false);
    expect(listContractApeEntries(project, 0)).toHaveLength(0);
    const cleaned = stripPhantomContractApeFromForm(project);
    expect(cleaned.apeEntries).toEqual([]);
    expect(cleaned.apeAmount).toBe('');
  });

  test('syncPreservedContractApeAmount γράφει ποσό σε κενή καταχώριση ΑΠΕ', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '494.855,49',
      apeAmount: '554.600,51',
      apeEntries: [{
        id: 'ape-1',
        apeAmount: '',
        apeFileName: 'ΑΠΕ.pdf',
      }],
    };
    const patch = syncPreservedContractApeAmount(project, 0, '554.600,51', project);
    expect(patch.apeEntries?.[0]?.apeAmount).toBe('554.600,51');
    expect(patch.apeAmount).toBe('554.600,51');
  });

  test('applyContractApeFields δεν διπλασιάζει καταχώριση όταν υπάρχει ήδη legacy apeAmount', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '37.080,50',
      contractDate: '2025-01-07',
      apeAmount: '0,00',
      apeEntries: [],
    };
    const patch = applyContractApeFields(project, 0, {
      apeAmount: '0,00',
      documentDate: '2025-01-08',
    });
    expect(patch.apeEntries).toHaveLength(1);
    expect(patch.apeEntries[0].apeAmount).toBe('0,00');
  });

  test('μηδενικό ΑΠΕ χωρίς μεταδεδομένα δεν θεωρείται πραγματικό', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '37.080,50',
      apeAmount: '0,00',
      apeDocumentDate: '2025-01-08',
      apeEntries: [{ id: 'stale', documentDate: '2025-01-08', apeAmount: '' }],
    };
    expect(hasRealStoredContractApe(project, 0)).toBe(false);
    expect(listContractApeEntries(project, 0)).toHaveLength(0);
  });

  test('sanitizeLegacyApeCommentsPollution καθαρίζει διπλότυπα σχόλια ΑΠΕ', () => {
    const cleaned = sanitizeLegacyApeCommentsPollution({
      implementationForm: 'Μια Σύμβαση',
      comments: 'σημείωση ΑΠΕ',
      apeComments: 'σημείωση ΑΠΕ',
    });
    expect(cleaned.comments).toBe('');
    expect(cleaned.apeComments).toBe('σημείωση ΑΠΕ');
  });

  test('καταχώριση ΑΠΕ δεν σημειώνει τη Φάση Α ως αλλαγμένη', () => {
    const baseForm = {
      projectTitle: 'Έργο',
      subprojectTitle: 'Υποέργο',
      implementationForm: 'Μια Σύμβαση',
      kaCode: '',
      noKaCode: false,
      eisigitikiEkthesi: '',
      aleCodes: [],
      misPraxhsName: '',
      misPraxhsCode: '',
      projectType: 'ΥΠΟΔΟΜΕΣ',
      fundingSource: 'Ίδιοι Πόροι',
      fundingDetails: '',
      coFinanced: false,
      fundingSources: [],
      approvedAmount: '100.000,00',
      remainingAmount: '',
      remainingAmountYear: '2026',
      remainingAmountComments: '',
      aleRemainingAmounts: [],
      comments: '',
      supervisorEngineerIds: [],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: '',
      projectStatus: 'Σε εξέλιξη',
      contractAmount: '100.000,00',
    };
    const baseline = serializePhaseASnapshot(pickPhaseASnapshot(baseForm));
    const patch = applyContractApeFields(baseForm, 0, {
      apeAmount: '110.000,00',
      comments: 'σχόλιο μόνο για ΑΠΕ',
    });
    const merged = { ...baseForm, ...patch };
    expect(isPhaseADirty(merged, baseline)).toBe(false);
    expect(merged.comments).toBe('');
    expect(merged.apeComments).toBe('σχόλιο μόνο για ΑΠΕ');
  });

  test('κατανομή SYMV ως ΑΠΕ γράφει ποσό και ΑΔΑΜ στην κάρτα', () => {
    const form = applyPlannerApeItemsToForm(
      { implementationForm: 'Μια Σύμβαση', contractAmount: '19.592,75', apeEntries: [] },
      [{ adam: '26SYMV019774530', role: 'ape', date: '2026-09-14', amount: '20.000,00' }],
      {
        chainMeta: {
          contractSnapshotsByAdam: {
            '26SYMV019774530': { title: 'ΣΥΝΤΗΡΗΣΗ Ι.Ν. ΑΓΙΟΥ ΜΑΜΑ ΣΤΗ ΜΟΥΡΝΙΑ' },
          },
        },
      }
    );
    expect(form.apeSourceAdam).toBe('26SYMV019774530');
    expect(String(form.apeAmount || '')).toMatch(/20\.000/);
    expect(form.apeDocumentDate).toBe('2026-09-14');
    expect(shouldShowApeSubCard(form, { kind: 'contract', arrayIndex: 0 })).toBe(true);
    expect(listContractApeEntries(form, 0)[0].apeSourceAdam).toBe('26SYMV019774530');
  });

  test('στόχος ΑΠΕ από χαρακτηρισμό προσυμπληρώνει ΑΔΑΜ και ποσό', () => {
    const project = { contractAmount: '100.000,00', apeEntries: [] };
    const target = buildApeEntryTargetFromChainKind(project, {
      chainAdam: '25symvape000001',
      title: 'Ανακεφαλαιωτικός Πίνακας Εργασιών',
      contractAmountDisplay: '112.000,00',
      contractDateIso: '2025-06-01',
      contractIndex: 0,
    });
    expect(target.kind).toBe('contract');
    expect(target.entryId).toBeNull();
    expect(target.prefillSourceAdam).toBe('25SYMVAPE000001');
    expect(target.prefillApeAmount).toBe('112.000,00');
    expect(target.prefillDocumentDate).toBe('2025-06-01');
  });

  test('ίδιος ΑΔΑΜ ΑΠΕ ανοίγει την υπάρχουσα καταχώριση', () => {
    const project = applyContractApeFields(
      { contractAmount: '100.000,00' },
      0,
      { apeAmount: '112.000,00', sourceAdam: '25SYMVAPE000001', documentDate: '2025-06-01' }
    );
    const existing = findContractApeEntryBySourceAdam(project, 0, '25SYMVAPE000001');
    expect(existing).toBeTruthy();
    const target = buildApeEntryTargetFromChainKind(project, {
      chainAdam: '25SYMVAPE000001',
      title: 'ΑΠΕ',
    });
    expect(target.entryId).toBe(existing.id);
    expect(target.prefillApeAmount).toBe('');
  });

  test('φάκελος χειροκίνητων αρχείων ΑΠΕ ανά σύμβαση', () => {
    expect(buildApeRelatedFilesGroupTitle(
      { kind: 'contract', arrayIndex: 0, title: 'Αρχική σύμβαση' },
      { implementationForm: 'Μια Σύμβαση' }
    )).toBe(APE_RELATED_FILES_GROUP_TITLE);

    expect(buildApeRelatedFilesGroupTitle(
      { kind: 'contract', arrayIndex: 1, title: 'Σύμβαση 2' },
      { implementationForm: 'Πολλές Συμβάσεις', contracts: [{}, {}] }
    )).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 2');

    expect(buildApeRelatedFilesGroupTitle(
      { kind: 'contract', arrayIndex: 1, title: 'Ανακεφαλαιωτικός Πίνακας Εργασιών' },
      { implementationForm: 'Πολλές Συμβάσεις', contracts: [{}, {}] }
    )).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 2');

    expect(buildApeRelatedFilesGroupTitle(
      { kind: 'supplementary', arrayIndex: 0, title: 'Συμπληρωματική 1' },
      { implementationForm: 'Μια Σύμβαση' }
    )).toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Συμπληρωματική 1');
  });

  test('χειροκίνητα αρχεία ΑΠΕ δύο συμβάσεων δεν ανακατεύονται', () => {
    let project = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { khmdhsAdam: '24SYMV000000001', amount: '100.000,00' },
        { khmdhsAdam: '24SYMV000000002', amount: '80.000,00' },
      ],
      fileGroups: [],
    };
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση 1' },
      {
        apeAmount: '110000',
        file: { sourcePath: 'C:/tmp/a.pdf', fileName: 'βοηθητικό-1.pdf' },
      }
    );
    project = applyApeEntryToProject(
      project,
      { kind: 'contract', arrayIndex: 1, title: 'Σύμβαση 2' },
      {
        apeAmount: '90000',
        file: { sourcePath: 'C:/tmp/b.pdf', fileName: 'βοηθητικό-2.pdf' },
      }
    );
    const g1 = project.fileGroups.find((g) => g.title === 'ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 1');
    const g2 = project.fileGroups.find((g) => g.title === 'ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 2');
    expect(g1.files.map((f) => f.name)).toEqual(['βοηθητικό-1.pdf']);
    expect(g2.files.map((f) => f.name)).toEqual(['βοηθητικό-2.pdf']);
    expect(readApeFileRef(project, { kind: 'contract', arrayIndex: 0 }).groupTitle)
      .toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 1');
    expect(readApeFileRef(project, { kind: 'contract', arrayIndex: 1 }).groupTitle)
      .toBe('ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ — Σύμβαση 2');
  });

  test('κατανομή δύο ΑΠΕ τους δένει στην αντίστοιχη σύμβαση', () => {
    const form = applyPlannerApeItemsToForm(
      {
        implementationForm: 'Πολλές Συμβάσεις',
        contracts: [
          { khmdhsAdam: '24SYMVMAIN00001', amount: '100.000,00', apeEntries: [] },
          { khmdhsAdam: '24SYMVPAR000002', amount: '80.000,00', apeEntries: [] },
        ],
        khmdhsSymvChainPlan: {
          items: [
            { adam: '24SYMVMAIN00001', role: 'main' },
            { adam: '24SYMVAPE000001', role: 'ape', date: '2026-01-10', amount: '110.000,00' },
            { adam: '24SYMVPAR000002', role: 'parallel' },
            { adam: '24SYMVAPE000002', role: 'ape', date: '2026-02-10', amount: '90.000,00' },
          ],
        },
      },
      [
        { adam: '24SYMVAPE000001', role: 'ape', date: '2026-01-10', amount: '110.000,00' },
        { adam: '24SYMVAPE000002', role: 'ape', date: '2026-02-10', amount: '90.000,00' },
      ]
    );
    expect(resolveApeContractArrayIndex(form, '24SYMVAPE000001')).toBe(0);
    expect(resolveApeContractArrayIndex(form, '24SYMVAPE000002')).toBe(1);
    expect(listContractApeEntries(form, 0)[0].apeSourceAdam).toBe('24SYMVAPE000001');
    expect(listContractApeEntries(form, 1)[0].apeSourceAdam).toBe('24SYMVAPE000002');
    expect(String(listContractApeEntries(form, 0)[0].apeAmount || '')).toMatch(/110/);
    expect(String(listContractApeEntries(form, 1)[0].apeAmount || '')).toMatch(/90/);
  });
});
