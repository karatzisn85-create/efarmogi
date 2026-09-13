/**
 * @jest-environment node
 */
const match = require('../../app/core/entaxiAcceptanceMatch');
const {
  buildProjectDraftFromEntaxi,
  buildEntaxiLinkAfterProjectCreate,
  entaxiHasStoredAcceptance,
} = require('./entaxiProjectDraft');

describe('entaxiProjectDraft', () => {
  it('προσυμπληρώνει τίτλο, ΟΠΣ και ποσό από την ένταξη', () => {
    const draft = buildProjectDraftFromEntaxi({
      entaxiId: 'ent-1',
      subject: 'Ένταξη της Πράξης «ΑΝΑΒΑΘΜΙΣΗ ΠΡΑΣΙΝΟΥ» με Κωδικό ΟΠΣ 5225036',
      opsCode: '5225036',
      initialAmount: '10.000,00',
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
    }, match);
    expect(draft.projectTitle).toMatch(/ΑΝΑΒΑΘΜΙΣΗ ΠΡΑΣΙΝΟΥ/i);
    expect(draft.subprojectTitle).toBe(draft.projectTitle);
    expect(draft.misPraxhsCode).toBe('5225036');
    expect(draft.approvedAmount).toBe('10.000,00');
    expect(draft.comments).toContain('624ΙΩΨΜ-Ζ12');
    expect(draft.sourceEntaxiId).toBe('ent-1');
  });

  it('αναγνωρίζει αποθηκευμένη αποδοχή από ΑΔΑ ή αρχείο', () => {
    expect(entaxiHasStoredAcceptance({})).toBe(false);
    expect(entaxiHasStoredAcceptance({ diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12' })).toBe(true);
    expect(entaxiHasStoredAcceptance({ approvalPDFs: ['Αποδοχή.pdf'] })).toBe(true);
  });

  it('χτίζει σύνδεση ένταξης με το νέο υποέργο', () => {
    const snap = buildEntaxiLinkAfterProjectCreate(
      { entaxiId: 'ent-1' },
      { projectId: 'p1', projectTitle: 'Αναβάθμιση πρασίνου', subprojectId: 's1' }
    );
    expect(snap.subprojectIds).toEqual(['s1']);
    expect(snap.linkedProjects[0].projectTitle).toBe('Αναβάθμιση πρασίνου');
  });
});
