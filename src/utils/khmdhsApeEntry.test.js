/**
 * @jest-environment node
 */
import {
  applyContractApeFields,
  applyApeEntryToProject,
  buildDefaultApeFileGroupTitle,
  buildDefaultApeFileName,
  clearApeEntryFromProject,
  hasContractApe,
  hasApeEntryData,
  shouldShowApeSubCard,
  mergeApeFileIntoFileGroups,
  readContractApeFields,
  readApeFileRef,
  formatApeAmountDisplay,
  getApeKhmdhsReferenceAmountLabel,
  getLatestContractApeAmount,
  listContractApeEntries,
} from './khmdhsApeEntry';

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
    expect(patch.contracts[1].comments).toBe('δοκιμή');
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
    expect(readContractApeFields({ ...project, ...patch }, 0).apeAmount).toBe('52.000,00');
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
    expect(buildDefaultApeFileGroupTitle('Σύμβαση 1')).toBe('Σύμβαση 1');
    expect(buildDefaultApeFileName('Σύμβαση 1', 'C:/docs/ape.PDF')).toBe('ΑΠΕ — Σύμβαση 1.pdf');
  });

  test('mergeApeFileIntoFileGroups — νέα ομάδα', () => {
    const { fileGroups, groupId } = mergeApeFileIntoFileGroups([], {
      groupTitle: 'Σύμβαση 1',
      fileName: 'ΑΠΕ — Σύμβαση 1.pdf',
      sourcePath: 'C:/tmp/ape.pdf',
    });
    expect(fileGroups).toHaveLength(1);
    expect(fileGroups[0].title).toBe('Σύμβαση 1');
    expect(fileGroups[0].files[0]).toEqual({
      path: 'C:/tmp/ape.pdf',
      name: 'ΑΠΕ — Σύμβαση 1.pdf',
    });
    expect(groupId).toBeTruthy();
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
});
