/**
 * @jest-environment node
 */

jest.mock('../../public/safeWrite', () => {
  const fs = require('fs');
  const path = require('path');
  return {
    safeWriteJSON: (filePath, data) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    },
    safeWriteJSONAsync: async (filePath, data) => {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    },
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
