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
  jsonFileBelongsToSubproject,
  MTIME_TOLERANCE_MS,
  MISSING_CHECK_TTL_MS,
  writeProjectsIndex,
  clearMissingProjectsCheckCache,
  canSkipMissingProjectsCheck,
  rememberMissingCheckOk,
} = require('../../public/projectsIndex');

const PROJECT_A = 'aaaaaaaa-1111-4111-a111-111111111111';
const SUB_1 = 'bbbbbbbb-2222-4222-a222-222222222222';
const PROJECT_B = 'cccccccc-3333-4333-a333-333333333333';
const SUB_9 = 'dddddddd-4444-4444-a444-444444444444';

function writeSubproject(root, projectId, subprojectId, data) {
  const dir = path.join(root, projectId, subprojectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data), 'utf8');
}

describe('projectsIndex', () => {
  let dataDir;

  beforeEach(() => {
    clearMissingProjectsCheckCache();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-idx-'));
    writeSubproject(dataDir, PROJECT_A, SUB_1, {
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    });
  });

  afterEach(() => {
    global.__ehWriteInterceptor = null;
    clearMissingProjectsCheckCache();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('rebuild + load via index', () => {
    const projects = [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
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
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    upsertProjectsIndexEntry(dataDir, {
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1β',
    });
    expect(readProjectsIndex(dataDir).entries[0].subprojectTitle).toBe('Υποέργο 1β');
    removeProjectsIndexEntry(dataDir, SUB_1);
    expect(readProjectsIndex(dataDir).entries).toHaveLength(0);
  });

  test('missing file forces null (fallback to scan)', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    fs.unlinkSync(path.join(dataDir, PROJECT_A, SUB_1, 'data.json'));
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
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);

    // Προσομοίωση άλλου υπολογιστή που γράφει την ίδια στιγμή και «πατάει» τη νέα εγγραφή.
    let clobbered = false;
    const sub2 = 'eeeeeeee-5555-4555-a555-555555555555';
    global.__ehWriteInterceptor = (filePath, data, write) => {
      if (clobbered || !filePath.endsWith('projects_index.json')) return false;
      clobbered = true;
      write(filePath, { ...data, entries: data.entries.filter((e) => e.subprojectId !== sub2) });
      return true;
    };

    writeSubproject(dataDir, PROJECT_A, sub2, { subprojectId: sub2 });

    const ok = upsertProjectsIndexEntry(dataDir, {
      projectId: PROJECT_A,
      subprojectId: sub2,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 2',
    });

    expect(ok).toBe(true);
    expect(clobbered).toBe(true);
    const ids = readProjectsIndex(dataDir).entries.map((e) => e.subprojectId);
    expect(ids).toContain(sub2);
    expect(ids).toContain(SUB_1);
  });

  test('χωρίς ευρετήριο, η αποθήκευση δεν φτιάχνει ευρετήριο με μία εγγραφή', () => {
    invalidateProjectsIndex(dataDir);
    upsertProjectsIndexEntry(dataDir, {
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    });
    // Αν γραφόταν, η επόμενη φόρτωση θα επέστρεφε ΜΟΝΟ αυτό το υποέργο.
    expect(readProjectsIndex(dataDir)).toBeNull();
  });

  test('ελλιπές ευρετήριο (λείπει ολόκληρο έργο UUID) επιβάλλει πλήρη σάρωση', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    writeSubproject(dataDir, PROJECT_B, SUB_9, {
      projectId: PROJECT_B,
      subprojectId: SUB_9,
      projectTitle: 'Έργο Β',
      subprojectTitle: 'Υποέργο 9',
    });

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
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    const brokenId = 'ffffffff-6666-4666-a666-666666666666';
    const brokenSub = '99999999-7777-4777-a777-777777777777';
    writeSubproject(dataDir, brokenId, brokenSub, { projectId: brokenId });

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded).toHaveLength(1);
  });

  test('φάκελος σκουπιδιών (μη UUID) δεν επιβάλλει πλήρη σάρωση', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    writeSubproject(dataDir, 'tmp-nas-junk', 'sub-x', {
      projectId: 'tmp-nas-junk',
      subprojectId: 'sub-x',
      projectTitle: 'Ψεύτικο',
      subprojectTitle: 'Ψεύτικο υποέργο',
    });

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded).toHaveLength(1);
  });

  test('μικρή διαφορά mtime (SMB) δεν ακυρώνει το ευρετήριο', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    const index = readProjectsIndex(dataDir);
    index.entries[0].mtimeMs = index.entries[0].mtimeMs - Math.floor(MTIME_TOLERANCE_MS / 2);
    writeProjectsIndex(dataDir, index);

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded).toHaveLength(1);
  });

  test('μεγάλη διαφορά mtime επιβάλλει πλήρη σάρωση', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    const index = readProjectsIndex(dataDir);
    index.entries[0].mtimeMs = index.entries[0].mtimeMs - (MTIME_TOLERANCE_MS + 5000);
    writeProjectsIndex(dataDir, index);

    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(loaded).toBeNull();
  });

  test('δεν μένει κλείδωμα ευρετηρίου μετά την ενημέρωση', () => {
    upsertProjectsIndexEntry(dataDir, {
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    });
    expect(fs.existsSync(path.join(dataDir, 'projects_index.lock'))).toBe(false);
  });

  test('findIndexedSubprojectPath + invalidate', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    expect(findIndexedSubprojectPath(dataDir, SUB_1)).toContain('data.json');
    invalidateProjectsIndex(dataDir);
    expect(readProjectsIndex(dataDir)).toBeNull();
  });

  test('jsonFileBelongsToSubproject απορρίπτει αρχείο άλλου υποέργου', () => {
    writeSubproject(dataDir, PROJECT_B, SUB_9, {
      projectId: PROJECT_B,
      subprojectId: SUB_9,
      projectTitle: 'Έργο Β',
      subprojectTitle: 'Υποέργο 9',
    });
    const own = path.join(dataDir, PROJECT_A, SUB_1, 'data.json');
    const other = path.join(dataDir, PROJECT_B, SUB_9, 'data.json');
    expect(jsonFileBelongsToSubproject(own, SUB_1)).toBe(true);
    expect(jsonFileBelongsToSubproject(other, SUB_1)).toBe(false);
  });

  test('αρνητικός έλεγχος ελλείψεων μπαίνει σε TTL — αποφεύγει επαναλαμβανόμενο readdir', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    const loaded = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(loaded)).toBe(true);
    expect(canSkipMissingProjectsCheck(dataDir)).toBe(true);
    expect(MISSING_CHECK_TTL_MS).toBeGreaterThanOrEqual(15000);
  });

  test('μέσα στο TTL νέο έργο δίσκου χωρίς ενημέρωση ευρετηρίου δεν φαίνεται μέχρι clear/λήξη', () => {
    rebuildProjectsIndex(dataDir, [{
      projectId: PROJECT_A,
      subprojectId: SUB_1,
      projectTitle: 'Έργο Α',
      subprojectTitle: 'Υποέργο 1',
    }]);
    loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    writeSubproject(dataDir, PROJECT_B, SUB_9, {
      projectId: PROJECT_B,
      subprojectId: SUB_9,
      projectTitle: 'Έργο Β',
      subprojectTitle: 'Υποέργο 9',
    });
    // Μέσα στο TTL: χρησιμοποιεί ευρετήριο χωρίς έλεγχο ελλείψεων
    const withinTtl = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(Array.isArray(withinTtl)).toBe(true);
    expect(withinTtl).toHaveLength(1);

    clearMissingProjectsCheckCache(dataDir);
    const afterClear = loadProjectsViaIndex(dataDir, {
      skipRoot: new Set(),
      normalizeProjectTypeField: () => {},
      isProjectLocked: () => ({ locked: false }),
      loggedSubprojectIdMismatches: new Set(),
    });
    expect(afterClear).toBeNull();
  });

  test('λήξη TTL ξαναεπιτρέπει έλεγχο ελλείψεων', () => {
    rememberMissingCheckOk(dataDir, Date.now() - MISSING_CHECK_TTL_MS - 1000);
    expect(canSkipMissingProjectsCheck(dataDir)).toBe(false);
  });

  test('invalidate μηδενίζει το TTL cache ελλείψεων', () => {
    rememberMissingCheckOk(dataDir);
    expect(canSkipMissingProjectsCheck(dataDir)).toBe(true);
    invalidateProjectsIndex(dataDir);
    expect(canSkipMissingProjectsCheck(dataDir)).toBe(false);
  });
});
