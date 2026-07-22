/**
 * @jest-environment node
 */
import {
  getUniqueProjectIds,
  fetchProjectLockMap,
  applyLockMapToProjects,
  sortProjectsForDisplay,
} from './dashboardProjectLocks';

describe('getUniqueProjectIds', () => {
  test('αφαιρεί διπλότυπα και άδειες τιμές', () => {
    const projects = [
      { projectId: 'A' },
      { projectId: 'B' },
      { projectId: 'A' },
      { projectId: '' },
      { projectId: null },
    ];
    expect(getUniqueProjectIds(projects)).toEqual(['A', 'B']);
  });

  test('επιστρέφει άδειο array για άδεια/κενή είσοδο', () => {
    expect(getUniqueProjectIds([])).toEqual([]);
    expect(getUniqueProjectIds(undefined)).toEqual([]);
  });
});

describe('fetchProjectLockMap', () => {
  const projects = [{ projectId: 'A' }, { projectId: 'B' }];

  test('χρησιμοποιεί το bulk IPC channel όταν είναι διαθέσιμο (ένα invoke, όχι N)', async () => {
    const invoke = jest.fn().mockResolvedValue({
      success: true,
      locks: {
        A: { locked: true, lockedBy: 'user1' },
        B: { locked: false, lockedBy: '' },
      },
    });
    const ipcRenderer = { invoke };

    const map = await fetchProjectLockMap(ipcRenderer, projects);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('check-projects-locks-bulk', ['A', 'B']);
    expect(map.get('A')).toEqual({ isLocked: true, lockedBy: 'user1' });
    expect(map.get('B')).toEqual({ isLocked: false, lockedBy: '' });
  });

  test('κάνει fallback σε N ξεχωριστά invoke όταν το bulk channel αποτύχει', async () => {
    const invoke = jest.fn((channel, arg) => {
      if (channel === 'check-projects-locks-bulk') {
        return Promise.reject(new Error('channel not allowed'));
      }
      if (channel === 'check-project-lock') {
        return Promise.resolve(
          arg === 'A' ? { locked: true, lockedBy: 'user1' } : { locked: false }
        );
      }
      return Promise.reject(new Error('unexpected channel'));
    });
    const ipcRenderer = { invoke };

    const map = await fetchProjectLockMap(ipcRenderer, projects);

    expect(invoke).toHaveBeenCalledWith('check-projects-locks-bulk', ['A', 'B']);
    expect(invoke).toHaveBeenCalledWith('check-project-lock', 'A');
    expect(invoke).toHaveBeenCalledWith('check-project-lock', 'B');
    expect(map.get('A')).toEqual({ isLocked: true, lockedBy: 'user1' });
    expect(map.get('B')).toEqual({ isLocked: false, lockedBy: '' });
  });

  test('κάνει fallback όταν το bulk channel επιστρέφει success:false', async () => {
    const invoke = jest.fn((channel, arg) => {
      if (channel === 'check-projects-locks-bulk') {
        return Promise.resolve({ success: false });
      }
      return Promise.resolve({ locked: false });
    });
    const ipcRenderer = { invoke };

    const map = await fetchProjectLockMap(ipcRenderer, projects);

    expect(invoke).toHaveBeenCalledWith('check-project-lock', 'A');
    expect(invoke).toHaveBeenCalledWith('check-project-lock', 'B');
    expect(map.size).toBe(2);
  });

  test('επιστρέφει άδειο Map χωρίς IPC κλήσεις αν δεν υπάρχουν έργα', async () => {
    const invoke = jest.fn();
    const map = await fetchProjectLockMap({ invoke }, []);
    expect(invoke).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });
});

describe('applyLockMapToProjects', () => {
  test('ενημερώνει μόνο τα έργα που άλλαξαν', () => {
    const projects = [
      { projectId: 'A', subprojectId: 'a1', isLocked: false, lockedBy: '' },
      { projectId: 'B', subprojectId: 'b1', isLocked: false, lockedBy: '' },
    ];
    const lockMap = new Map([
      ['A', { isLocked: true, lockedBy: 'user1' }],
      ['B', { isLocked: false, lockedBy: '' }],
    ]);
    const updated = applyLockMapToProjects(projects, lockMap);
    expect(updated[0]).toEqual({ projectId: 'A', subprojectId: 'a1', isLocked: true, lockedBy: 'user1' });
    // Χωρίς αλλαγή → ίδια αναφορά αντικειμένου (όχι νέο object) για να μη σπάει το memo
    expect(updated[1]).toBe(projects[1]);
  });
});

describe('sortProjectsForDisplay', () => {
  test('ταξινομεί κατά τίτλο έργου και υποέργου (ελληνικά, χωρίς διάκριση πεζών/κεφαλαίων)', () => {
    const projects = [
      { projectTitle: 'Βήτα', subprojectTitle: 'Β1' },
      { projectTitle: 'Άλφα', subprojectTitle: 'Α2' },
      { projectTitle: 'Άλφα', subprojectTitle: 'Α1' },
    ];
    const sorted = sortProjectsForDisplay(projects);
    expect(sorted.map((p) => p.subprojectTitle)).toEqual(['Α1', 'Α2', 'Β1']);
  });
});
