/**
 * @jest-environment node
 */
import {
  applyCatalogCatchUp,
  catalogWhenDiskUnreadable,
  finishCatalogCatchUp,
  knownMissingFromFullLoad,
  planCatalogCatchUp,
  readForIndexAbsence,
} from './subprojectCatalogSync';

describe('planCatalogCatchUp', () => {
  const known = [
    { projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Παλιό' },
  ];

  test('νέο υποέργο στο ευρετήριο ζητά μόνο αυτό', () => {
    const plan = planCatalogCatchUp(known, [
      { projectId: 'p1', subprojectId: 's1', mtimeMs: 1 },
      { projectId: 'p2', subprojectId: 's2', mtimeMs: 2 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.missing).toEqual([{ projectId: 'p2', subprojectId: 's2' }]);
    expect(plan.removedIds).toEqual([]);
  });

  test('άδειο ευρετήριο με υπάρχουσα λίστα δεν σβήνει τα υποέργα', () => {
    const plan = planCatalogCatchUp(known, []);
    expect(plan.ok).toBe(false);
    expect(plan.removedIds).toEqual([]);
  });

  test('υποέργο που έφυγε από γεμάτο ευρετήριο σημειώνεται για αφαίρεση', () => {
    const plan = planCatalogCatchUp(
      [
        ...known,
        { projectId: 'p9', subprojectId: 's9', subprojectTitle: 'Φεύγει' },
      ],
      [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 1 }]
    );
    expect(plan.ok).toBe(true);
    expect(plan.removedIds).toEqual(['s9']);
    expect(plan.missing).toEqual([]);
  });

  test('χωρίς ευρετήριο δεν μαντεύει — ο καλών κάνει πλήρη φόρτωση', () => {
    const plan = planCatalogCatchUp(known, null);
    expect(plan.ok).toBe(false);
  });

  test('αλλαγμένος τίτλος στο ευρετήριο ξαναδιαβάζει μόνο αυτό το υποέργο', () => {
    const plan = planCatalogCatchUp(
      known,
      [
        { projectId: 'p1', subprojectId: 's1', mtimeMs: 8000 },
        { projectId: 'p2', subprojectId: 's2', mtimeMs: 1000 },
      ],
      [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 1000 }]
    );
    expect(plan.ok).toBe(true);
    expect(plan.changed).toEqual([{ projectId: 'p1', subprojectId: 's1' }]);
    expect(plan.missing).toEqual([{ projectId: 'p2', subprojectId: 's2' }]);
  });

  test('μικρή διαφορά ώρας δεν θεωρείται αλλαγή', () => {
    const plan = planCatalogCatchUp(
      known,
      [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 2000 }],
      [{ projectId: 'p1', subprojectId: 's1', mtimeMs: 1000 }]
    );
    expect(plan.changed).toEqual([]);
  });
});

describe('finishCatalogCatchUp', () => {
  const known = [
    { projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Μένει' },
    { projectId: 'p9', subprojectId: 's9', subprojectTitle: 'Αμφίβολο' },
  ];
  const plan = planCatalogCatchUp(known, [
    { projectId: 'p1', subprojectId: 's1' },
    { projectId: 'p2', subprojectId: 's2' },
  ]);

  test('κρατά υποέργο που λείπει από το ευρετήριο αλλά υπάρχει στον φάκελο', () => {
    const done = finishCatalogCatchUp(known, plan, {
      s2: { project: { projectId: 'p2', subprojectId: 's2', subprojectTitle: 'Νέο' } },
      s9: { project: known[1] },
    });
    expect(done.ok).toBe(true);
    expect(done.projects.map((p) => p.subprojectId)).toEqual(['s1', 's9', 's2']);
  });

  test('βγάζει υποέργο μόνο όταν λείπει και από τον φάκελο', () => {
    const done = finishCatalogCatchUp(known, plan, {
      s2: { missing: true },
      s9: { missing: true },
    });
    expect(done.projects.map((p) => p.subprojectId)).toEqual(['s1']);
  });

  test('σφάλμα ανάγνωσης δεν μαντεύει τη λίστα', () => {
    const done = finishCatalogCatchUp(known, plan, {
      s2: { error: true },
      s9: { missing: true },
    });
    expect(done.ok).toBe(false);
  });
});

describe('readForIndexAbsence', () => {
  test('αρχείο που υπάρχει μένει στη λίστα', () => {
    expect(readForIndexAbsence({ success: true, reachable: true, exists: true }).missing).toBeUndefined();
  });

  test('αρχείο που λείπει βγαίνει από τη λίστα', () => {
    expect(readForIndexAbsence({ success: true, reachable: true, exists: false }).missing).toBe(true);
  });

  test('άπιαστος φάκελος δεν το δηλώνει διαγραμμένο', () => {
    expect(readForIndexAbsence({ success: true, reachable: false, exists: false }).missing).toBeUndefined();
  });
});

describe('πλήρης ανάγνωση', () => {
  const known = [
    { projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Ήρθε' },
    { projectId: 'p1', subprojectId: 's9', subprojectTitle: 'Έλειπε από το ευρετήριο' },
  ];

  test('άπιαστος φάκελος κρατά τη λίστα της αρχικής', () => {
    expect(catalogWhenDiskUnreadable(known)).toEqual(known);
    expect(catalogWhenDiskUnreadable(null)).toEqual([]);
  });

  test('σημειώνει μόνο όσα η αρχική δείχνει και η πλήρης λίστα δεν έφερε', () => {
    const loaded = [{ projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Ήρθε' }];
    expect(knownMissingFromFullLoad(known, loaded).map((p) => p.subprojectId)).toEqual(['s9']);
  });
});

describe('applyCatalogCatchUp', () => {
  test('αντικαθιστά τον παλιό τίτλο όταν το αρχείο άλλαξε', () => {
    const done = finishCatalogCatchUp(
      [{ projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Παλιός' }],
      {
        ok: true,
        missing: [],
        removedIds: [],
        changed: [{ projectId: 'p1', subprojectId: 's1' }],
      },
      {
        s1: { project: { projectId: 'p1', subprojectId: 's1', subprojectTitle: 'Νέος' } },
      }
    );
    expect(done.ok).toBe(true);
    expect(done.projects[0].subprojectTitle).toBe('Νέος');
  });

  test('προσθέτει το νέο και βγάζει το διαγραμμένο', () => {
    const next = applyCatalogCatchUp(
      [
        { subprojectId: 's1', subprojectTitle: 'Μένει' },
        { subprojectId: 's2', subprojectTitle: 'Φεύγει' },
      ],
      {
        loaded: [{ subprojectId: 's3', subprojectTitle: 'Νέο' }],
        removedIds: ['s2'],
      }
    );
    expect(next.map((p) => p.subprojectId)).toEqual(['s1', 's3']);
  });
});
