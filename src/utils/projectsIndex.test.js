/**
 * @jest-environment node
 */

jest.mock('../../public/safeWrite', () => {
  const fs = require('fs');
  const path = require('path');
  const write = (filePath, data) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  };
  return {
    // Το άγκιστρο επιτρέπει να προσομοιώσουμε άλλον υπολογιστή που γράφει την ίδια στιγμή.
    safeWriteJSON: (filePath, data) => {
      const hook = global.__ehWriteInterceptor;
      if (typeof hook === 'function' && hook(filePath, data, write)) return;
      write(filePath, data);
    },
    safeWriteJSONAsync: async (filePath, data) => write(filePath, data),
  };
});

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  rebuildProjectsIndex,
  readProjectsIndex,
  upsertProjectsIndexEntry,
  removeProjectsIndexEntry,
  invalidateProjectsIndex,
  loadProjectsViaIndex,
  findIndexedSubprojectPath,
} = require('../../public/projectsIndex');

describe('projectsIndex', () => {
  let dataDir;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-idx-'));
    const p1 = path.join(dataDir, 'proj-a', 'sub-1');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, 'data.json'),
      JSON.stringify({
        projectId: 'proj-a',
        subprojectId: 'sub-1',
        projectTitle: 'Έργο Α',
        subprojectTitle: 'Υποέργο 1',
      }),
      'utf8'
    );
  });

  afterEach(() => {
    global.__ehWriteInterceptor = null;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('rebuild + load via index', () => {
    const projects = [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }];
    expect(rebuildProjectsIndex(dataDir, projects)).toBe(true);
    const index = readProjectsIndex(dataDir);
    expect(index.entries).toHaveLength(1);

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(loaded).toHaveLength(1);
    expect(loaded[0].subprojectTitle).toBe('Υποέργο 1');
  });

  test('upsert and remove entry', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    upsertProjectsIndexEntry(dataDir, {
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1β',
    });
    expect(readProjectsIndex(dataDir).entries[0].subprojectTitle).toBe('Υποέργο 1β');
    removeProjectsIndexEntry(dataDir, 'sub-1');
    expect(readProjectsIndex(dataDir).entries).toHaveLength(0);
  });

  test('missing file forces null (fallback to scan)', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    fs.unlinkSync(path.join(dataDir, 'proj-a', 'sub-1', 'data.json'));
    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(loaded).toBeNull();
  });

  test('η ταυτόχρονη εγγραφή δεν χάνει εγγραφή — η ενημέρωση επιβεβαιώνεται', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);

    // Προσομοίωση άλλου υπολογιστή που γράφει την ίδια στιγμή και «πατάει» τη νέα εγγραφή.
    let clobbered = false;
    global.__ehWriteInterceptor = (filePath, data, write) => {
      if (clobbered || !filePath.endsWith('projects_index.json')) return false;
      clobbered = true;
      write(filePath, { ...data, entries: data.entries.filter((e) => e.subprojectId !== 'sub-2') });
      return true;
    };

    const p2 = path.join(dataDir, 'proj-a', 'sub-2');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, 'data.json'), JSON.stringify({ subprojectId: 'sub-2' }), 'utf8');

    const ok = upsertProjectsIndexEntry(dataDir, {
      projectId: 'proj-a',
      subprojectId: 'sub-2',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 2',
    });

    expect(ok).toBe(true);
    expect(clobbered).toBe(true);
    const ids = readProjectsIndex(dataDir).entries.map((e) => e.subprojectId);
    expect(ids).toContain('sub-2');
    expect(ids).toContain('sub-1');
  });

  test('χωρίς ευρετήριο, η αποθήκευση δεν φτιάχνει ευρετήριο με μία εγγραφή', () => {
    invalidateProjectsIndex(dataDir);
    upsertProjectsIndexEntry(dataDir, {
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    });
    // Αν γραφόταν, η επόμενη φόρτωση θα επέστρεφε ΜΟΝΟ αυτό το υποέργο.
    expect(readProjectsIndex(dataDir)).toBeNull();
  });

  test('ελλιπές ευρετήριο (λείπει ολόκληρο έργο) επιβάλλει πλήρη σάρωση', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    // Δεύτερο έργο στον δίσκο που δεν πρόλαβε να μπει στο ευρετήριο.
    const other = path.join(dataDir, 'proj-b', 'sub-9');
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, 'data.json'), JSON.stringify({
      projectId: 'proj-b',
      subprojectId: 'sub-9',
      projectTitle: 'Έργο Β',
      subprojectTitle: 'Υποέργο 9',
    }), 'utf8');

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(loaded).toBeNull();
  });

  test('χαλασμένο υποέργο εκτός ευρετηρίου δεν επιβάλλει πλήρη σάρωση', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    const broken = path.join(dataDir, 'proj-x', 'sub-x');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'data.json'), JSON.stringify({ projectId: 'proj-x' }), 'utf8');

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded).toHaveLength(1);
  });

  test('δεν μένει κλείδωμα ευρετηρίου μετά την ενημέρωση', () => {
    upsertProjectsIndexEntry(dataDir, {
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    });
    expect(fs.existsSync(path.join(dataDir, 'projects_index.lock'))).toBe(false);
  });

  test('findIndexedSubprojectPath + invalidate', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: 'proj-a',
      subprojectId: 'sub-1',
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    expect(findIndexedSubprojectPath(dataDir, 'sub-1')).toContain('data.json');
    invalidateProjectsIndex(dataDir);
    expect(readProjectsIndex(dataDir)).toBeNull();
  });
});
