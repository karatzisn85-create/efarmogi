/**
 * Κοινή λογική φίλτρων χρέωσης (main process). Συγχρονισμένη με src/utils/supervisorChargeDisplay.js
 */

function isTruthyFlag(v) {
  return v === true || v === 1 || v === 'true' || v === '1';
}

function isFalsyFlag(v) {
  return v === false || v === 0 || v === 'false' || v === '0';
}

function isOutsideChargeMode(project, ids, freeP, freePart) {
  const raw = project && project.supervisorChargeOutsideEngineers;
  if (isTruthyFlag(raw)) return true;
  if (isFalsyFlag(raw)) return false;
  return !!(freeP || freePart) && ids.length === 0;
}

function engineerChargeFilterKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return lower.startsWith('user:') ? lower : `user:${lower}`;
}

function freeChargeFilterKey(text) {
  const t = String(text || '').trim().toLowerCase();
  return t ? `free:${t}` : '';
}

function resolveChargeLabel(raw, catalog) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const sLower = s.toLowerCase();
  const bareUsername = sLower.replace(/^user:/i, '');
  const match =
    (Array.isArray(catalog) ? catalog : []).find((e) => {
      if (!e) return false;
      const id = String(e.id || '').trim().toLowerCase();
      if (id && id === sLower) return true;
      const uname = String(e.username || '').trim().toLowerCase();
      return uname && (uname === bareUsername || `user:${uname}` === sLower);
    }) || null;
  if (match) return String(match.fullName || match.username || '').trim() || s;
  if (/^user:/i.test(s)) return bareUsername;
  return s;
}

function getProjectChargeFilterKeys(project) {
  if (!project) return [];
  const keys = new Set();
  const ids = Array.isArray(project.supervisorEngineerIds)
    ? project.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const freeP = String(project.supervisorChargeFreePrimary || '').trim();
  const freePart = String(project.supervisorChargeFreeParticipants || '').trim();
  const outsideMode = isOutsideChargeMode(project, ids, freeP, freePart);

  ids.forEach((id) => {
    const k = engineerChargeFilterKey(id);
    if (k) keys.add(k);
  });

  if (outsideMode || ids.length === 0) {
    const fp = freeChargeFilterKey(freeP);
    if (fp) keys.add(fp);
  }

  if (freePart) {
    freePart
      .split(/\n|·/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part) => {
        const pk = freeChargeFilterKey(part);
        if (pk) keys.add(pk);
      });
  }

  return [...keys];
}

function collectChargeFilterOptions(projects, catalog) {
  const byValue = new Map();
  const list = Array.isArray(projects) ? projects : [];
  const cat = Array.isArray(catalog) ? catalog : [];

  const add = (value, label) => {
    const v = String(value || '').trim();
    const lbl = String(label || '').trim();
    if (!v || !lbl) return;
    if (!byValue.has(v)) byValue.set(v, lbl);
  };

  list.forEach((project) => {
    const ids = Array.isArray(project.supervisorEngineerIds)
      ? project.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const freeP = String(project.supervisorChargeFreePrimary || '').trim();
    const freePart = String(project.supervisorChargeFreeParticipants || '').trim();

    ids.forEach((id) => {
      add(engineerChargeFilterKey(id), resolveChargeLabel(id, cat) || id);
    });

    if (freeP) add(freeChargeFilterKey(freeP), freeP);

    if (freePart) {
      freePart
        .split(/\n|·/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((part) => add(freeChargeFilterKey(part), part));
    }
  });

  return [...byValue.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'el', { sensitivity: 'base' }));
}

function buildEngineerVisibilityContext(username, assignedSupervisors = []) {
  const uname = String(username || '').trim().toLowerCase();
  const engineerIds = uname ? [`user:${uname}`] : [];
  const chargeFilterKeys = engineerIds.map((id) => engineerChargeFilterKey(id)).filter(Boolean);
  (Array.isArray(assignedSupervisors) ? assignedSupervisors : []).forEach((label) => {
    const fk = freeChargeFilterKey(label);
    if (fk) chargeFilterKeys.push(fk);
  });
  return {
    engineerIds,
    chargeFilterKeys: [...new Set(chargeFilterKeys)],
  };
}

function projectVisibleToEngineerContext(project, engineerContext) {
  const ctx =
    engineerContext && typeof engineerContext === 'object' && !Array.isArray(engineerContext)
      ? engineerContext
      : { engineerIds: [], chargeFilterKeys: [] };

  const keys = new Set();
  (Array.isArray(ctx.chargeFilterKeys) ? ctx.chargeFilterKeys : []).forEach((k) => {
    const n = String(k || '').trim().toLowerCase();
    if (n) keys.add(n);
  });
  (Array.isArray(ctx.engineerIds) ? ctx.engineerIds : []).forEach((id) => {
    const k = engineerChargeFilterKey(id);
    if (k) keys.add(k);
  });
  if (keys.size === 0) return false;

  const projectKeys = getProjectChargeFilterKeys(project);
  return projectKeys.some((pk) => keys.has(String(pk || '').trim().toLowerCase()));
}

module.exports = {
  collectChargeFilterOptions,
  getProjectChargeFilterKeys,
  engineerChargeFilterKey,
  resolveChargeLabel,
  buildEngineerVisibilityContext,
  projectVisibleToEngineerContext,
};
