/**
 * @jest-environment node
 */
import {
  applyExtensionEntryToProject,
  clearExtensionEntryFromProject,
  listContractExtensionEntries,
  getLatestContractExtensionEntry,
  hasContractExtensionEntries,
  isLatestContractExtensionEntry,
  buildDefaultExtensionFileName,
  readExtensionFileRef,
  buildExtensionModalSnapshot,
  isExtensionModalDirty,
  mergeManualExtensionIntoDocumentRegistry,
  removeManualExtensionFromDocumentRegistry,
  buildManualExtensionRegistryLinkKey,
} from './khmdhsManualContractExtension';

describe('khmdhsManualContractExtension', () => {
  test('applyExtensionEntryToProject δημιουργεί νέα καταχώριση σε Μια Σύμβαση', () => {
    const project = { implementationForm: 'Μια Σύμβαση', contractEndDate: '2025-08-14', fileGroups: [] };
    const next = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      {
        newEndDate: '2026-02-28',
        documentDate: '2025-12-01',
        comments: 'Απόφαση Δημάρχου αρ. 123/2025',
      }
    );
    const entries = listContractExtensionEntries(next, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].newEndDate).toBe('2026-02-28');
    expect(entries[0].documentDate).toBe('2025-12-01');
    expect(entries[0].comments).toBe('Απόφαση Δημάρχου αρ. 123/2025');
    expect(hasContractExtensionEntries(next, 0)).toBe(true);
  });

  test('applyExtensionEntryToProject με αρχείο το προσθέτει στα fileGroups', () => {
    const project = { implementationForm: 'Μια Σύμβαση', fileGroups: [] };
    const next = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      {
        newEndDate: '2026-02-28',
        documentDate: '2025-12-01',
        comments: '',
        file: { sourcePath: 'C:/tmp/apofasi.pdf', fileName: 'apofasi.pdf' },
      }
    );
    const entries = listContractExtensionEntries(next, 0);
    expect(entries[0].fileName).toBe('apofasi.pdf');
    expect(entries[0].fileGroupId).toBeTruthy();
    const group = next.fileGroups.find((g) => g.id === entries[0].fileGroupId);
    expect(group).toBeTruthy();
    expect(group.files.some((f) => (f.name || f) === 'apofasi.pdf')).toBe(true);

    const fileRef = readExtensionFileRef(next, { arrayIndex: 0, entryId: entries[0].id });
    expect(fileRef.fileName).toBe('apofasi.pdf');
  });

  test('πολλαπλές καταχωρίσεις ταξινομούνται κατά ημερομηνία εγγράφου', () => {
    let project = { implementationForm: 'Μια Σύμβαση', fileGroups: [] };
    project = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      { newEndDate: '2026-06-30', documentDate: '2026-03-01', comments: 'Δεύτερη παράταση' }
    );
    project = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      { newEndDate: '2026-02-28', documentDate: '2025-12-01', comments: 'Πρώτη παράταση' }
    );
    const entries = listContractExtensionEntries(project, 0);
    expect(entries).toHaveLength(2);
    expect(entries[0].comments).toBe('Πρώτη παράταση');
    expect(entries[1].comments).toBe('Δεύτερη παράταση');
    const latest = getLatestContractExtensionEntry(project, 0);
    expect(latest.comments).toBe('Δεύτερη παράταση');
    expect(isLatestContractExtensionEntry(project, 0, latest.id)).toBe(true);
    expect(isLatestContractExtensionEntry(project, 0, entries[0].id)).toBe(false);
  });

  test('επεξεργασία υπάρχουσας καταχώρισης μέσω entryId', () => {
    let project = { implementationForm: 'Μια Σύμβαση', fileGroups: [] };
    project = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      { newEndDate: '2026-02-28', documentDate: '2025-12-01', comments: 'Αρχικό' }
    );
    const entryId = getLatestContractExtensionEntry(project, 0).id;
    project = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId, title: 'Σύμβαση' },
      { newEndDate: '2026-03-31', documentDate: '2025-12-01', comments: 'Ενημερωμένο' }
    );
    const entries = listContractExtensionEntries(project, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0].newEndDate).toBe('2026-03-31');
    expect(entries[0].comments).toBe('Ενημερωμένο');
  });

  test('λειτουργεί ανά σύμβαση σε Πολλές Συμβάσεις', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { date: '2024-01-01', amount: '10.000,00' },
        { date: '2024-02-01', amount: '20.000,00' },
      ],
      fileGroups: [],
    };
    const next = applyExtensionEntryToProject(
      project,
      { arrayIndex: 1, entryId: null, title: 'Σύμβαση 2' },
      { newEndDate: '2027-01-01', documentDate: '2026-06-01', comments: '' }
    );
    expect(listContractExtensionEntries(next, 0)).toHaveLength(0);
    expect(listContractExtensionEntries(next, 1)).toHaveLength(1);
    expect(next.contracts[1].contractExtensions[0].newEndDate).toBe('2027-01-01');
  });

  test('clearExtensionEntryFromProject αφαιρεί συγκεκριμένη καταχώριση και το αρχείο της', () => {
    let project = { implementationForm: 'Μια Σύμβαση', fileGroups: [] };
    project = applyExtensionEntryToProject(
      project,
      { arrayIndex: 0, entryId: null, title: 'Σύμβαση' },
      {
        newEndDate: '2026-02-28',
        documentDate: '2025-12-01',
        file: { sourcePath: 'C:/tmp/apofasi.pdf', fileName: 'apofasi.pdf' },
      }
    );
    const entryId = getLatestContractExtensionEntry(project, 0).id;
    project = { ...project, ...clearExtensionEntryFromProject(project, { arrayIndex: 0, entryId }) };
    expect(hasContractExtensionEntries(project, 0)).toBe(false);
    expect((project.fileGroups || []).every((g) => !(g.files || []).some((f) => (f.name || f) === 'apofasi.pdf'))).toBe(true);
  });

  test('buildDefaultExtensionFileName χρησιμοποιεί τίτλο στόχου και κατάληξη πηγής', () => {
    const name = buildDefaultExtensionFileName('Σύμβαση 1', 'C:/tmp/decision.PDF');
    expect(name).toMatch(/Παράταση/);
    expect(name.toLowerCase().endsWith('.pdf')).toBe(true);
  });

  test('isExtensionModalDirty συγκρίνει snapshots σωστά', () => {
    const baseline = buildExtensionModalSnapshot({ newEndDate: '2026-01-01', comments: '' });
    expect(isExtensionModalDirty({ newEndDate: '2026-01-01', comments: '' }, baseline)).toBe(false);
    expect(isExtensionModalDirty({ newEndDate: '2026-01-02', comments: '' }, baseline)).toBe(true);
  });

  test('mergeManualExtensionIntoDocumentRegistry / removeManualExtensionFromDocumentRegistry', () => {
    const target = { arrayIndex: 0, entryId: 'ext-1' };
    const project = { khmdhsDocumentRegistry: [] };
    const withRegistry = {
      ...project,
      ...mergeManualExtensionIntoDocumentRegistry(project, target, {
        targetTitle: 'Σύμβαση',
        diavgeiaPreview: { ada: 'ΨΨΨ1-ΑΒΓ', subject: 'Απόφαση παράτασης' },
      }),
    };
    const linkKey = buildManualExtensionRegistryLinkKey(target);
    expect(withRegistry.khmdhsDocumentRegistry.some((e) => e.apeLinkKey === linkKey)).toBe(true);
    expect(withRegistry.khmdhsDocumentRegistry.some((e) => e.stage === 'EXT')).toBe(true);

    const cleared = {
      ...withRegistry,
      ...removeManualExtensionFromDocumentRegistry(withRegistry, target),
    };
    expect(cleared.khmdhsDocumentRegistry.some((e) => e.apeLinkKey === linkKey)).toBe(false);
  });
});
