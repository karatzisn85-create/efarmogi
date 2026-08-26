/**
 * @jest-environment node
 */
import {
  mergeOneSubprojectIntoList,
  removeSubprojectFromList,
  diffProjectsIndexEntries,
  collectIndexReloadTargets,
  subprojectTitlesChanged,
  runWithConcurrency,
  shouldWarnRemoteSubprojectSave,
} from './mergeLoadedSubproject';

describe('mergeOneSubprojectIntoList', () => {
  test('προσθέτει νέο υποέργο', () => {
    const { projects, action, needsSort } = mergeOneSubprojectIntoList(
      [{ subprojectId: 'a', projectTitle: 'Α', subprojectTitle: '1' }],
      { subprojectId: 'b', projectTitle: 'Β', subprojectTitle: '2' }
    );
    expect(action).toBe('add');
    expect(needsSort).toBe(true);
    expect(projects).toHaveLength(2);
    expect(projects[1].subprojectId).toBe('b');
  });

  test('αντικαθιστά υπάρχον και κρατά flags συνδέσεων', () => {
    const prev = [{
      subprojectId: 'a',
      projectTitle: 'Α',
      subprojectTitle: '1',
      hasEgkrisiLink: true,
      hasEntaxiLink: true,
      contractAmount: '10',
    }];
    const { projects, action, needsSort } = mergeOneSubprojectIntoList(prev, {
      subprojectId: 'a',
      projectTitle: 'Α',
      subprojectTitle: '1',
      contractAmount: '20',
    });
    expect(action).toBe('update');
    expect(needsSort).toBe(false);
    expect(projects[0].contractAmount).toBe('20');
    expect(projects[0].hasEgkrisiLink).toBe(true);
    expect(projects[0].hasEntaxiLink).toBe(true);
  });

  test('δεν κρατά παλιό lockedBy όταν το υποέργο ξεκλειδώθηκε', () => {
    const prev = [{
      subprojectId: 'a',
      projectTitle: 'Α',
      subprojectTitle: '1',
      isLocked: true,
      lockedBy: 'Γιάννης',
    }];
    const { projects } = mergeOneSubprojectIntoList(prev, {
      subprojectId: 'a',
      projectTitle: 'Α',
      subprojectTitle: '1',
      isLocked: false,
      lockedBy: '',
      contractAmount: '99',
    });
    expect(projects[0].isLocked).toBe(false);
    expect(projects[0].lockedBy).toBe('');
    expect(projects[0].contractAmount).toBe('99');
  });

  test('αναταξινόμηση μόνο όταν αλλάζει τίτλος', () => {
    const prev = [{ subprojectId: 'a', projectTitle: 'Α', subprojectTitle: 'Παλιό' }];
    const { needsSort } = mergeOneSubprojectIntoList(prev, {
      subprojectId: 'a',
      projectTitle: 'Α',
      subprojectTitle: 'Νέο',
    });
    expect(needsSort).toBe(true);
    expect(subprojectTitlesChanged(prev[0], { projectTitle: 'Α', subprojectTitle: 'Νέο' })).toBe(true);
  });
});

describe('removeSubprojectFromList', () => {
  test('αφαιρεί με βάση subprojectId', () => {
    const { projects, changed } = removeSubprojectFromList(
      [{ subprojectId: 'a' }, { subprojectId: 'b' }],
      'a'
    );
    expect(changed).toBe(true);
    expect(projects.map((p) => p.subprojectId)).toEqual(['b']);
  });
});

describe('diffProjectsIndexEntries', () => {
  test('εντοπίζει νέα, αλλαγμένα και διαγραμμένα', () => {
    const prev = [
      { projectId: 'p1', subprojectId: 's1', mtimeMs: 1000 },
      { projectId: 'p1', subprojectId: 's2', mtimeMs: 1000 },
    ];
    const next = [
      { projectId: 'p1', subprojectId: 's1', mtimeMs: 8000 },
      { projectId: 'p2', subprojectId: 's3', mtimeMs: 1000 },
    ];
    const diff = diffProjectsIndexEntries(prev, next);
    expect(diff.added.map((e) => e.subprojectId)).toEqual(['s3']);
    expect(diff.changed.map((e) => e.subprojectId)).toEqual(['s1']);
    expect(diff.removed.map((e) => e.subprojectId)).toEqual(['s2']);
  });

  test('αγνοεί μικρή διαφορά mtime (ανοχή κοινόχρηστου φακέλου)', () => {
    const prev = [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 1000 }];
    const next = [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 1500 }];
    const diff = diffProjectsIndexEntries(prev, next);
    expect(diff.changed).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
  });
});

describe('collectIndexReloadTargets', () => {
  test('ενώνει added+changed χωρίς διπλότυπα', () => {
    const targets = collectIndexReloadTargets({
      added: [{ projectId: 'p', subprojectId: 's1' }],
      changed: [{ projectId: 'p', subprojectId: 's1' }, { projectId: 'p', subprojectId: 's2' }],
    });
    expect(targets).toEqual([
      { projectId: 'p', subprojectId: 's1' },
      { projectId: 'p', subprojectId: 's2' },
    ]);
  });
});

describe('shouldWarnRemoteSubprojectSave', () => {
  test('ίδια έκδοση → καμία ειδοποίηση', () => {
    expect(shouldWarnRemoteSubprojectSave({
      previousUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedSubprojectId: 'a',
    })).toBe(false);
  });

  test('άλλη έκδοση χωρίς δική μας αποθήκευση → ειδοποίηση', () => {
    expect(shouldWarnRemoteSubprojectSave({
      previousUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedUpdatedAt: '2026-01-01T11:00:00.000Z',
      loadedSubprojectId: 'a',
    })).toBe(true);
  });

  test('η νέα έκδοση είναι η δική μας αποθήκευση → καμία ειδοποίηση', () => {
    expect(shouldWarnRemoteSubprojectSave({
      previousUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedUpdatedAt: '2026-01-01T11:00:00.000Z',
      loadedSubprojectId: 'a',
      recentLocalSave: { subprojectId: 'a', updatedAt: '2026-01-01T11:00:00.000Z' },
    })).toBe(false);
  });

  test('άλλο υποέργο αποθηκεύτηκε τοπικά → εξακολουθεί η ειδοποίηση', () => {
    expect(shouldWarnRemoteSubprojectSave({
      previousUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedUpdatedAt: '2026-01-01T11:00:00.000Z',
      loadedSubprojectId: 'a',
      recentLocalSave: { subprojectId: 'b', updatedAt: '2026-01-01T11:00:00.000Z' },
    })).toBe(true);
  });

  test('μέσα στο παράθυρο της δικής μας αποθήκευσης → καμία ειδοποίηση', () => {
    expect(shouldWarnRemoteSubprojectSave({
      previousUpdatedAt: '2026-01-01T10:00:00.000Z',
      loadedUpdatedAt: '2026-01-01T11:00:00.000Z',
      loadedSubprojectId: 'a',
      recentLocalSave: { subprojectId: 'a', updatedAt: 'other', until: 2000 },
      now: 1000,
    })).toBe(false);
  });
});

describe('runWithConcurrency', () => {
  test('διατηρεί σειρά και περιορίζει ταυτόχρονα', async () => {
    let live = 0;
    let maxLive = 0;
    const out = await runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, 15));
      live -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40]);
    expect(maxLive).toBeLessThanOrEqual(2);
  });
});
