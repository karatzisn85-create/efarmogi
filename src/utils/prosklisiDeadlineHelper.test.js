/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getEffectiveProsklisiDeadline,
  applyEffectiveDeadlineToProsklisi,
} = require('../../public/prosklisiDeadlineHelper');

describe('prosklisiDeadlineHelper (main)', () => {
  test('applies modification deadline over stale root', () => {
    const effective = getEffectiveProsklisiDeadline(
      { deadline: '2019-10-31' },
      [{
        modificationDocumentDate: '2025-10-01',
        changes: {
          deadline: { original: '2019-10-31', current: '2025-12-31' },
        },
      }]
    );
    expect(effective).toBe('2025-12-31');
  });

  test('persist:false ενημερώνει τη μνήμη χωρίς εγγραφή στο δίσκο (hot path φόρτωσης)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-prosk-'));
    const dataPath = path.join(dir, 'data.json');
    const modsPath = path.join(dir, 'modifications.json');
    const stored = {
      id: 'p1',
      title: 'Πρόσκληση',
      deadline: '2019-10-31',
    };
    fs.writeFileSync(dataPath, JSON.stringify(stored), 'utf8');
    fs.writeFileSync(modsPath, JSON.stringify([{
      modificationDocumentDate: '2025-10-01',
      changes: { deadline: { original: '2019-10-31', current: '2025-12-31' } },
    }]), 'utf8');

    const viewed = applyEffectiveDeadlineToProsklisi(stored, dir, { persist: false });
    expect(viewed.deadline).toBe('2025-12-31');
    expect(viewed.modifications).toBeUndefined();
    const onDisk = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    expect(onDisk.deadline).toBe('2019-10-31');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('persist:true γράφει την ισχύουσα προθεσμία όταν ζητηθεί ρητά', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-prosk-'));
    const dataPath = path.join(dir, 'data.json');
    const modsPath = path.join(dir, 'modifications.json');
    const stored = {
      id: 'p1',
      title: 'Πρόσκληση',
      deadline: '2019-10-31',
    };
    fs.writeFileSync(dataPath, JSON.stringify(stored), 'utf8');
    fs.writeFileSync(modsPath, JSON.stringify([{
      modificationDocumentDate: '2025-10-01',
      changes: { deadline: { original: '2019-10-31', current: '2025-12-31' } },
    }]), 'utf8');

    applyEffectiveDeadlineToProsklisi(stored, dir, { persist: true });
    const onDisk = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    expect(onDisk.deadline).toBe('2025-12-31');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('includeModifications επιστρέφει τις τροποποιήσεις χωρίς να τις γράφει στο data.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-prosk-'));
    const dataPath = path.join(dir, 'data.json');
    const modsPath = path.join(dir, 'modifications.json');
    const stored = {
      id: 'p1',
      title: 'Πρόσκληση',
      deadline: '2019-10-31',
    };
    const mods = [{
      modificationDocumentDate: '2025-10-01',
      changes: { deadline: { original: '2019-10-31', current: '2025-12-31' } },
    }];
    fs.writeFileSync(dataPath, JSON.stringify(stored), 'utf8');
    fs.writeFileSync(modsPath, JSON.stringify(mods), 'utf8');

    const viewed = applyEffectiveDeadlineToProsklisi(stored, dir, {
      persist: true,
      includeModifications: true,
    });
    expect(viewed.deadline).toBe('2025-12-31');
    expect(viewed.modifications).toEqual(mods);
    const onDisk = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    expect(onDisk.deadline).toBe('2025-12-31');
    expect(onDisk.modifications).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
