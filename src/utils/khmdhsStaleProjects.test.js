/**
 * @jest-environment node
 */
import { listKhmdhsStaleProjects } from './khmdhsStaleProjects';

describe('listKhmdhsStaleProjects', () => {
  const oldRefresh = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const freshRefresh = new Date().toISOString();

  test('μετρά υποέργο με παλιά ανάκτηση και αγνοεί το φρέσκο και το κλειστό', () => {
    const stale = listKhmdhsStaleProjects([
      {
        subprojectId: 'old',
        projectTitle: 'Έργο',
        subprojectTitle: 'Παλιό',
        khmdhsAdam: '24SYMV000000001',
        khmdhsChainLastRefreshedAt: oldRefresh,
      },
      {
        subprojectId: 'fresh',
        projectTitle: 'Έργο',
        subprojectTitle: 'Φρέσκο',
        khmdhsAdam: '24SYMV000000002',
        khmdhsChainLastRefreshedAt: freshRefresh,
      },
      {
        subprojectId: 'closed',
        projectTitle: 'Έργο',
        subprojectTitle: 'Κλειστό',
        projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
        khmdhsAdam: '24SYMV000000003',
        khmdhsChainLastRefreshedAt: oldRefresh,
      },
      {
        subprojectId: 'noseed',
        projectTitle: 'Έργο',
        subprojectTitle: 'Χωρίς κωδικό',
      },
    ], 30);

    expect(stale.map((row) => row.id)).toEqual(['old']);
  });
});
