/**
 * @jest-environment node
 */
import {
  proposalPersistFingerprint,
  syncPersistedSnapshotFileGroups,
} from './orimanthiHelpers';

describe('syncPersistedSnapshotFileGroups', () => {
  const base = {
    id: 'p1',
    title: 'Οδός Κεντρική',
    status: 'maturing',
    actionResponsible: 'Μαρία',
    notes: '',
    fileGroups: [{ id: 'g1', files: [] }],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('μετά από ανέβασμα αρχείων το έργο δεν φαίνεται μη αποθηκευμένο', () => {
    const persisted = { ...base };
    const afterUpload = {
      ...base,
      fileGroups: [{ id: 'g1', files: [{ name: 'άδεια.pdf' }] }],
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(proposalPersistFingerprint(persisted)).not.toBe(proposalPersistFingerprint(afterUpload));
    const synced = syncPersistedSnapshotFileGroups(persisted, afterUpload);
    expect(proposalPersistFingerprint(synced)).toBe(proposalPersistFingerprint(afterUpload));
  });

  it('κρατά μη αποθηκευμένο τίτλο — δεν θεωρεί αποθηκευμένη την πληκτρολόγηση', () => {
    const persisted = { ...base };
    const localEdits = {
      ...base,
      title: 'Νέος τίτλος',
      fileGroups: [{ id: 'g1', files: [{ name: 'άδεια.pdf' }] }],
    };
    const synced = syncPersistedSnapshotFileGroups(persisted, localEdits);
    expect(proposalPersistFingerprint(synced)).not.toBe(proposalPersistFingerprint(localEdits));
    expect(synced.title).toBe('Οδός Κεντρική');
  });
});
