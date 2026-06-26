/**
 * @jest-environment node
 */
import {
  buildProjectFormFingerprint,
  hasUnsavedProjectFormChanges,
  projectFormHasDraftContent,
} from './projectFormUnsaved';

describe('projectFormUnsaved', () => {
  const emptyNew = {
    projectTitle: '',
    subprojectTitle: '',
    implementationForm: '',
    kaCode: '',
    noKaCode: false,
    projectStatus: '',
    remainingAmountYear: '2026',
    aleCodes: [],
    supervisorEngineerIds: [],
    supervisorChargeOutsideEngineers: false,
    contracts: [],
    supplementaryContracts: [],
    fileGroups: [],
    khmdhsPayments: [],
  };

  test('empty new project has no draft', () => {
    expect(projectFormHasDraftContent(emptyNew, [])).toBe(false);
  });

  test('new project with title is draft', () => {
    expect(projectFormHasDraftContent({ ...emptyNew, subprojectTitle: 'Δοκιμή' }, [])).toBe(true);
  });

  test('new project with pending files is draft', () => {
    expect(projectFormHasDraftContent(emptyNew, [{ name: 'a.pdf' }])).toBe(true);
  });

  test('edit unchanged has no unsaved changes', () => {
    const form = { ...emptyNew, subprojectTitle: 'Έργο', projectId: 'p1', subprojectId: 's1' };
    const fp = buildProjectFormFingerprint(form);
    expect(hasUnsavedProjectFormChanges({
      formData: form,
      savedFingerprint: fp,
      isNewProject: false,
    })).toBe(false);
  });

  test('edit with change is unsaved', () => {
    const saved = { ...emptyNew, subprojectTitle: 'Έργο', subprojectId: 's1' };
    const fp = buildProjectFormFingerprint(saved);
    const current = { ...saved, comments: 'νέο σχόλιο' };
    expect(hasUnsavedProjectFormChanges({
      formData: current,
      savedFingerprint: fp,
      isNewProject: false,
    })).toBe(true);
  });

  test('phase B reset flag forces unsaved', () => {
    expect(hasUnsavedProjectFormChanges({
      formData: emptyNew,
      savedFingerprint: buildProjectFormFingerprint(emptyNew),
      phaseBResetUnsaved: true,
      isNewProject: false,
    })).toBe(true);
  });
});
