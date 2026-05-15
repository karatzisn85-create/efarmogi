/**
 * Εμφάνιση χρέωσης υποέργου (κατάλογος / εκτός μηχανικών).
 * Το `user:username` είναι εσωτερικό id μηχανικού από λογαριασμό (βλ. electron).
 */

function findEngineerInCatalog(raw, catalog) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const cat = Array.isArray(catalog) ? catalog : [];
  const sLower = s.toLowerCase();
  const bareUsername = sLower.replace(/^user:/i, '');
  return (
    cat.find((e) => {
      if (!e) return false;
      const id = String(e.id || '').trim().toLowerCase();
      if (id && id === sLower) return true;
      const uname = String(e.username || '').trim().toLowerCase();
      return uname && (uname === bareUsername || `user:${uname}` === sLower);
    }) || null
  );
}

export function resolveChargeDisplay(raw, catalog) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const match = findEngineerInCatalog(s, catalog);
  if (match) {
    const n = String(match.fullName || '').trim();
    if (n) return n;
    const uname = String(match.username || '').trim();
    if (uname) return uname;
  }
  if (/^user:/i.test(s)) {
    const tail = s.replace(/^user:/i, '').trim();
    if (!tail) return s;
    return tail
      .split(/[._-]+/)
      .filter(Boolean)
      .map((w) => (w ? w.charAt(0).toLocaleUpperCase('el-GR') + w.slice(1).toLocaleLowerCase('el-GR') : ''))
      .filter(Boolean)
      .join(' ');
  }
  return s;
}

function isTruthyFlag(v) {
  return v === true || v === 1 || v === 'true' || v === '1';
}

function isFalsyFlag(v) {
  return v === false || v === 0 || v === 'false' || v === '0';
}

/** Χρέωση εκτός καταλόγου μηχανικών (checkbox ή παλιό ελεύθερο κείμενο χωρίς ids). */
function isOutsideChargeMode(project, ids, freeP, freePart) {
  const raw = project && project.supervisorChargeOutsideEngineers;
  if (isTruthyFlag(raw)) return true;
  if (isFalsyFlag(raw)) return false;
  return !!(freeP || freePart) && ids.length === 0;
}

/** Ίδια λογική με ProjectCard για «Χρεωμένο σε» / «Συμμετέχουν». */
export function getProjectChargeDisplay(project, engineerCatalog = []) {
  if (!project) {
    return { displayChargePrimary: '', displayChargeParticipants: '' };
  }
  const ids = Array.isArray(project.supervisorEngineerIds)
    ? project.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const cat = engineerCatalog || [];
  const primaryCatalog = ids[0] ? resolveChargeDisplay(ids[0], cat) : '';
  const auxCatalog = ids
    .slice(1)
    .map((id) => resolveChargeDisplay(id, cat))
    .filter(Boolean)
    .join(' · ');
  const freeP = String(project.supervisorChargeFreePrimary || '').trim();
  const freePart = String(project.supervisorChargeFreeParticipants || '').trim();
  const outsideMode = isOutsideChargeMode(project, ids, freeP, freePart);
  const displayFreeP = resolveChargeDisplay(freeP, cat) || freeP;
  const displayFreePart = resolveChargeDisplay(freePart, cat) || freePart;

  if (outsideMode) {
    return {
      displayChargePrimary: displayFreeP,
      displayChargeParticipants: displayFreePart
    };
  }

  if (ids.length > 0) {
    return {
      displayChargePrimary: primaryCatalog || displayFreeP,
      displayChargeParticipants: auxCatalog || displayFreePart
    };
  }

  return {
    displayChargePrimary: displayFreeP,
    displayChargeParticipants: displayFreePart
  };
}

/** Σταθερό κλειδί φίλτρου για μηχανικό καταλόγου */
export function engineerChargeFilterKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return lower.startsWith('user:') ? lower : `user:${lower}`;
}

/** Σταθερό κλειδί φίλτρου για ελεύθερη χρέωση (εκτός καταλόγου) */
export function freeChargeFilterKey(text) {
  const t = String(text || '').trim().toLowerCase();
  return t ? `free:${t}` : '';
}

/** Όλα τα κλειδιά χρέωσης ενός υποέργου (για φίλτρα / αντιστοίχιση) */
export function getProjectChargeFilterKeys(project) {
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

export function projectMatchesChargeFilters(project, selectedKeys) {
  if (!selectedKeys || selectedKeys.length === 0) return true;
  const selected = new Set(selectedKeys.map((k) => String(k || '').trim().toLowerCase()));
  return getProjectChargeFilterKeys(project).some((k) => selected.has(k.toLowerCase()));
}

/** Επιλογές φίλτρου «Χρεωμένο σε» από όλα τα υποέργη */
export function collectChargeFilterOptions(projects, catalog = []) {
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
      add(engineerChargeFilterKey(id), resolveChargeDisplay(id, cat) || id);
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

export function getProjectChargeSearchText(project, catalog = []) {
  const { displayChargePrimary, displayChargeParticipants } = getProjectChargeDisplay(project, catalog);
  return [displayChargePrimary, displayChargeParticipants].filter(Boolean).join(' ');
}

/**
 * Ορατότητα υποέργου για λογαριασμό μηχανικού — μόνο πραγματική χρέωση (όχι μερικό όνομα/username).
 * @param {object} project
 * @param {{ engineerIds?: string[], chargeFilterKeys?: string[] }} engineerContext
 */
export function projectVisibleToAssignedEngineer(project, engineerContext, _catalog = []) {
  const ctx =
    engineerContext && typeof engineerContext === 'object' && !Array.isArray(engineerContext)
      ? engineerContext
      : { engineerIds: [] };

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

/** Κατασκευή context ορατότητας από τρέχοντα χρήστη ENGINEER. */
export function buildEngineerVisibilityContext(currentUser, extraAssignedLabels = []) {
  const username = String(currentUser?.username || '').trim();
  const engineerIds = username ? [`user:${username.toLowerCase()}`] : [];
  const chargeFilterKeys = engineerIds.map((id) => engineerChargeFilterKey(id)).filter(Boolean);

  (Array.isArray(extraAssignedLabels) ? extraAssignedLabels : []).forEach((label) => {
    const fk = freeChargeFilterKey(label);
    if (fk) chargeFilterKeys.push(fk);
  });

  return {
    engineerIds,
    chargeFilterKeys: [...new Set(chargeFilterKeys)]
  };
}
