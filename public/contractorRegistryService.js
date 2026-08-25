/**
 * contractorRegistryService.js — Μητρώο αναδόχων (καρτέλες, εγγυητικές, παραλαβές)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const catalog = require('../app/core/contractorRegistry');

const CONTRACTOR_REGISTRY_DIR_NAME = 'ΜΗΤΡΩΟ ΑΝΑΔΟΧΩΝ';
const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createContractorRegistryService({ dataDir }) {
  function getRootDir() {
    return path.join(dataDir, CONTRACTOR_REGISTRY_DIR_NAME);
  }

  function ensureRootDir() {
    const dir = getRootDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getRecordDir(recordId) {
    return path.join(ensureRootDir(), recordId);
  }

  function getDataPath(recordId) {
    return path.join(getRecordDir(recordId), 'data.json');
  }

  function assertValidRecordId(recordId) {
    const id = String(recordId || '').trim();
    if (!RECORD_ID_RE.test(id)) {
      return { ok: false, error: 'Μη έγκυρο αναγνωριστικό καρτέλας αναδόχου' };
    }
    const resolved = path.resolve(getRecordDir(id));
    const root = path.resolve(getRootDir());
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return { ok: false, error: 'Μη επιτρεπτό path' };
    }
    return { ok: true, id };
  }

  function loadRecord(recordId) {
    const check = assertValidRecordId(recordId);
    if (!check.ok) return null;
    const dataPath = getDataPath(check.id);
    if (!fs.existsSync(dataPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (!raw || typeof raw !== 'object') return null;
      return catalog.createEmptyContractorRecord({ ...raw, id: check.id, identityKey: '' });
    } catch {
      return null;
    }
  }

  function listRecords() {
    const rootDir = ensureRootDir();
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const list = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const rec = loadRecord(entry.name);
      if (rec) list.push(rec);
    }
    list.sort((a, b) => {
      const na = catalog.foldSearchText(a.name || '');
      const nb = catalog.foldSearchText(b.name || '');
      if (na !== nb) return na.localeCompare(nb, 'el');
      return (a.vat || '').localeCompare(b.vat || '');
    });
    return list;
  }

  function findByIdentityKey(identityKey, exceptId = null) {
    const key = String(identityKey || '').trim();
    if (!key) return null;
    return listRecords().find((r) => r.identityKey === key && r.id !== exceptId) || null;
  }

  function saveRecord(payload, options = {}) {
    const incoming = payload || {};
    const existingId = String(incoming.id || '').trim();
    const existing = existingId ? loadRecord(existingId) : null;

    if (existingId && !existing) {
      const idCheck = assertValidRecordId(existingId);
      if (!idCheck.ok) return { success: false, error: idCheck.error };
    }

    let draft = incoming;
    if (options.role === 'ENGINEER') {
      draft = catalog.mergeEngineerRecordSave(existing, incoming, options.visibleSubprojectIds);
    }

    if (existing && options.expectedUpdatedAt && existing.updatedAt !== options.expectedUpdatedAt) {
      return {
        success: false,
        conflict: true,
        error: 'Η καρτέλα τροποποιήθηκε από άλλη ενέργεια. Φορτώστε ξανά και επαναλάβετε.',
        record: existing,
      };
    }

    const evaluated = catalog.evaluateRecordPayload(draft);
    if (!evaluated.ok) {
      return { success: false, error: evaluated.error, field: evaluated.field };
    }

    if (options.role === 'ENGINEER' && !existing) {
      const probe = Object.assign({}, evaluated.record, {
        assignments: options.assignments || [],
      });
      if (!catalog.recordTouchesVisibleSubproject(probe, options.visibleSubprojectIds)) {
        return {
          success: false,
          error: 'Συνδέστε εγγυητική ή παραλαβή σε χρεωμένο υποέργο',
        };
      }
    }

    const now = new Date().toISOString();
    const id = existing ? existing.id : (RECORD_ID_RE.test(existingId) ? existingId : uuidv4());
    const toSave = catalog.createEmptyContractorRecord({
      ...evaluated.record,
      id,
      guarantees: (evaluated.record.guarantees || []).map((g) => ({
        ...g,
        id: RECORD_ID_RE.test(g.id) ? g.id : uuidv4(),
        createdAt: g.createdAt || now,
        updatedAt: now,
      })),
      acceptances: (evaluated.record.acceptances || []).map((a) => ({
        ...a,
        id: RECORD_ID_RE.test(a.id) ? a.id : uuidv4(),
        createdAt: a.createdAt || now,
        updatedAt: now,
      })),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });

    const dup = findByIdentityKey(toSave.identityKey, id);
    if (dup) {
      return {
        success: false,
        duplicate: true,
        error: `Υπάρχει ήδη καρτέλα για αυτόν τον ανάδοχο (${dup.name || dup.vat || dup.id})`,
        existingId: dup.id,
      };
    }

    const dir = getRecordDir(id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    safeWriteJSON(getDataPath(id), toSave);
    const saved = loadRecord(id);
    return { success: true, isNew: !existing, record: saved };
  }

  function deleteRecord(recordId) {
    const check = assertValidRecordId(recordId);
    if (!check.ok) return { success: false, error: check.error };
    const rec = loadRecord(check.id);
    if (!rec) return { success: false, error: 'Η καρτέλα αναδόχου δεν βρέθηκε' };
    const dir = getRecordDir(check.id);
    fs.rmSync(dir, { recursive: true, force: true });
    return { success: true, record: rec };
  }

  return {
    CONTRACTOR_REGISTRY_DIR_NAME,
    listRecords,
    loadRecord,
    saveRecord,
    deleteRecord,
    findByIdentityKey,
  };
}

module.exports = {
  CONTRACTOR_REGISTRY_DIR_NAME,
  createContractorRegistryService,
};
