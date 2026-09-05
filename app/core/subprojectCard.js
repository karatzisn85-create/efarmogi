/**
 * Κοινή λογική κάρτας υποέργου: χρέωση, εμφάνιση, αποθήκευση ταυτότητας, αναζήτηση.
 * Την καλούν η φόρμα, η αποθήκευση στον δίσκο, ο κατάλογος και το harness E2E.
 * Χωρίς Node APIs — φορτώνεται και στον browser.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSubprojectCard = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isTruthyFlag(v) {
    return v === true || v === 1 || v === 'true' || v === '1';
  }

  function isFalsyFlag(v) {
    return v === false || v === 0 || v === 'false' || v === '0';
  }

  function engineerChargeFilterKey(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    return lower.indexOf('user:') === 0 ? lower : 'user:' + lower;
  }

  function freeChargeFilterKey(text) {
    var t = String(text || '').trim().toLowerCase();
    return t ? 'free:' + t : '';
  }

  function findEngineerInCatalog(raw, catalog) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var cat = Array.isArray(catalog) ? catalog : [];
    var key = engineerChargeFilterKey(s);
    if (!key) return null;
    for (var i = 0; i < cat.length; i += 1) {
      var e = cat[i];
      if (!e) continue;
      var idKey = engineerChargeFilterKey(e.id);
      if (idKey && idKey === key) return e;
      var userKey = engineerChargeFilterKey(e.username);
      if (userKey && userKey === key) return e;
    }
    return null;
  }

  function resolveChargeDisplay(raw, catalog) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var match = findEngineerInCatalog(s, catalog);
    if (match) {
      var n = String(match.fullName || '').trim();
      if (n) return n;
      var uname = String(match.username || '').trim();
      if (uname) return uname;
    }
    if (/^user:/i.test(s)) {
      var tail = s.replace(/^user:/i, '').trim();
      if (!tail) return s;
      return tail
        .split(/[._-]+/)
        .filter(Boolean)
        .map(function (w) {
          return w
            ? w.charAt(0).toLocaleUpperCase('el-GR') + w.slice(1).toLocaleLowerCase('el-GR')
            : '';
        })
        .filter(Boolean)
        .join(' ');
    }
    return s;
  }

  function isOutsideChargeMode(project, ids, freeP, freePart) {
    var raw = project && project.supervisorChargeOutsideEngineers;
    if (isTruthyFlag(raw)) return true;
    if (isFalsyFlag(raw)) return false;
    return !!(freeP || freePart) && ids.length === 0;
  }

  function getProjectChargeDisplay(project, engineerCatalog) {
    if (!project) {
      return { displayChargePrimary: '', displayChargeParticipants: '' };
    }
    var ids = Array.isArray(project.supervisorEngineerIds)
      ? project.supervisorEngineerIds.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
      : [];
    var cat = engineerCatalog || [];
    var primaryCatalog = ids[0] ? resolveChargeDisplay(ids[0], cat) : '';
    var auxCatalog = ids
      .slice(1)
      .map(function (id) { return resolveChargeDisplay(id, cat); })
      .filter(Boolean)
      .join(' · ');
    var freeP = String(project.supervisorChargeFreePrimary || '').trim();
    var freePart = String(project.supervisorChargeFreeParticipants || '').trim();
    var outsideMode = isOutsideChargeMode(project, ids, freeP, freePart);
    var displayFreeP = resolveChargeDisplay(freeP, cat) || freeP;
    var displayFreePart = resolveChargeDisplay(freePart, cat) || freePart;

    if (outsideMode) {
      return {
        displayChargePrimary: displayFreeP || primaryCatalog,
        displayChargeParticipants: displayFreePart || auxCatalog
      };
    }
    if (ids.length > 0) {
      return {
        displayChargePrimary: primaryCatalog || displayFreeP,
        displayChargeParticipants: auxCatalog || displayFreePart
      };
    }
    if (displayFreeP || displayFreePart) {
      return {
        displayChargePrimary: displayFreeP,
        displayChargeParticipants: displayFreePart
      };
    }
    var legacySupervisor = String(project.supervisor || '').trim();
    if (legacySupervisor) {
      return { displayChargePrimary: legacySupervisor, displayChargeParticipants: '' };
    }
    return { displayChargePrimary: '', displayChargeParticipants: '' };
  }

  function hasProjectChargeDisplay(project, engineerCatalog) {
    var d = getProjectChargeDisplay(project, engineerCatalog);
    return !!(d.displayChargePrimary || d.displayChargeParticipants);
  }

  function getProjectChargeFilterKeys(project) {
    if (!project) return [];
    var keys = {};
    var ids = Array.isArray(project.supervisorEngineerIds)
      ? project.supervisorEngineerIds.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
      : [];
    var freeP = String(project.supervisorChargeFreePrimary || '').trim();
    var freePart = String(project.supervisorChargeFreeParticipants || '').trim();
    var outsideMode = isOutsideChargeMode(project, ids, freeP, freePart);

    ids.forEach(function (id) {
      var k = engineerChargeFilterKey(id);
      if (k) keys[k] = true;
    });
    if (outsideMode || ids.length === 0) {
      var fp = freeChargeFilterKey(freeP);
      if (fp) keys[fp] = true;
    }
    if (freePart) {
      freePart.split(/\n|·/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (part) {
        var pk = freeChargeFilterKey(part);
        if (pk) keys[pk] = true;
      });
    }
    return Object.keys(keys);
  }

  function projectMatchesChargeFilters(project, selectedKeys) {
    if (!selectedKeys || selectedKeys.length === 0) return true;
    var selected = {};
    selectedKeys.forEach(function (k) {
      var n = String(k || '').trim().toLowerCase();
      if (n) selected[n] = true;
    });
    return getProjectChargeFilterKeys(project).some(function (k) {
      return selected[String(k || '').toLowerCase()];
    });
  }

  function collectChargeFilterOptions(projects, catalog) {
    var byValue = {};
    var list = Array.isArray(projects) ? projects : [];
    var cat = Array.isArray(catalog) ? catalog : [];
    function add(value, label) {
      var v = String(value || '').trim();
      var lbl = String(label || '').trim();
      if (!v || !lbl || byValue[v]) return;
      byValue[v] = lbl;
    }
    list.forEach(function (project) {
      var ids = Array.isArray(project.supervisorEngineerIds)
        ? project.supervisorEngineerIds.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
        : [];
      var freeP = String(project.supervisorChargeFreePrimary || '').trim();
      var freePart = String(project.supervisorChargeFreeParticipants || '').trim();
      ids.forEach(function (id) {
        add(engineerChargeFilterKey(id), resolveChargeDisplay(id, cat) || id);
      });
      if (freeP) add(freeChargeFilterKey(freeP), freeP);
      if (freePart) {
        freePart.split(/\n|·/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (part) {
          add(freeChargeFilterKey(part), part);
        });
      }
    });
    return Object.keys(byValue)
      .map(function (value) { return { value: value, label: byValue[value] }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label, 'el', { sensitivity: 'base' }); });
  }

  function getProjectChargeSearchText(project, catalog) {
    var d = getProjectChargeDisplay(project, catalog);
    return [d.displayChargePrimary, d.displayChargeParticipants].filter(Boolean).join(' ');
  }

  function projectVisibleToAssignedEngineer(project, engineerContext) {
    var ctx = engineerContext && typeof engineerContext === 'object' && !Array.isArray(engineerContext)
      ? engineerContext
      : { engineerIds: [] };
    var keys = {};
    (Array.isArray(ctx.chargeFilterKeys) ? ctx.chargeFilterKeys : []).forEach(function (k) {
      var n = String(k || '').trim().toLowerCase();
      if (n) keys[n] = true;
    });
    (Array.isArray(ctx.engineerIds) ? ctx.engineerIds : []).forEach(function (id) {
      var k = engineerChargeFilterKey(id);
      if (k) keys[k] = true;
    });
    if (Object.keys(keys).length === 0) return false;
    return getProjectChargeFilterKeys(project).some(function (pk) {
      return keys[String(pk || '').trim().toLowerCase()];
    });
  }

  function buildEngineerVisibilityContext(currentUser, extraAssignedLabels) {
    var username = String((currentUser && currentUser.username) || '').trim();
    var engineerIds = username ? ['user:' + username.toLowerCase()] : [];
    var chargeFilterKeys = engineerIds.map(engineerChargeFilterKey).filter(Boolean);
    (Array.isArray(extraAssignedLabels) ? extraAssignedLabels : []).forEach(function (label) {
      var fk = freeChargeFilterKey(label);
      if (fk) chargeFilterKeys.push(fk);
    });
    var uniq = [];
    var seen = {};
    chargeFilterKeys.forEach(function (k) {
      if (!seen[k]) {
        seen[k] = true;
        uniq.push(k);
      }
    });
    return { engineerIds: engineerIds, chargeFilterKeys: uniq };
  }

  function mergeSupervisorEngineerIds(primaryId, auxiliaryIds) {
    var p = String(primaryId || '').trim();
    var aux = Array.isArray(auxiliaryIds) ? auxiliaryIds : [];
    var seen = {};
    var out = [];
    if (p) {
      out.push(p);
      seen[p] = true;
    }
    aux.forEach(function (id) {
      var s = String(id || '').trim();
      if (s && !seen[s]) {
        seen[s] = true;
        out.push(s);
      }
    });
    return out;
  }

  function normalizeSupervisorEngineerIdList(ids) {
    if (!Array.isArray(ids)) return [];
    var seen = {};
    var out = [];
    ids.forEach(function (x) {
      var k = engineerChargeFilterKey(x);
      if (k && !seen[k]) {
        seen[k] = true;
        out.push(k);
      }
    });
    return out;
  }

  /**
   * Άνοιγμα φόρμας: ίδια απόφαση με την παραγωγή για inside/outside.
   * Το παλιό πεδίο supervisor δεν μεταφέρεται στη φόρμα (η φόρμα το πετάει).
   */
  function loadChargeFieldsFromProject(project) {
    var supervisorEngineerIds = Array.isArray(project && project.supervisorEngineerIds)
      ? project.supervisorEngineerIds.map(function (x) { return String(x || '').trim(); }).filter(Boolean)
      : [];
    var fp0 = project && project.supervisorChargeFreePrimary != null
      ? String(project.supervisorChargeFreePrimary)
      : '';
    var fpart0 = project && project.supervisorChargeFreeParticipants != null
      ? String(project.supervisorChargeFreeParticipants)
      : '';
    var hadLegacyFree = !!(fp0.trim() || fpart0.trim());
    var explicitOutside = project && project.supervisorChargeOutsideEngineers === true;
    var explicitInside = project && project.supervisorChargeOutsideEngineers === false;
    var supervisorChargeOutsideEngineers =
      explicitOutside || (!explicitInside && hadLegacyFree && supervisorEngineerIds.length === 0);
    var mergedFree = [fp0.trim(), fpart0.trim()].filter(Boolean).join('\n');
    return {
      supervisorEngineerIds: supervisorEngineerIds,
      supervisorChargeOutsideEngineers: supervisorChargeOutsideEngineers,
      supervisorChargeFreePrimary: supervisorChargeOutsideEngineers ? (mergedFree || fp0) : fp0,
      supervisorChargeFreeParticipants: supervisorChargeOutsideEngineers ? '' : fpart0
    };
  }

  function applyOutsideChargeToggle(prev, on) {
    var next = Object.assign({}, prev, { supervisorChargeOutsideEngineers: !!on });
    if (on) {
      next.supervisorEngineerIds = [];
    } else {
      next.supervisorChargeFreePrimary = '';
      next.supervisorChargeFreeParticipants = '';
    }
    return next;
  }

  function normalizeChargeFromForm(input) {
    var src = input || {};
    var outside = Boolean(src.supervisorChargeOutsideEngineers);
    var ids = [];
    if (!outside) {
      var rawEng = Array.isArray(src.supervisorEngineerIds) ? src.supervisorEngineerIds : [];
      ids = mergeSupervisorEngineerIds(rawEng[0], rawEng.slice(1));
    }
    var freeP = String(src.supervisorChargeFreePrimary || '').trim();
    var freePart = String(src.supervisorChargeFreeParticipants || '').trim();
    if (freeP && ids.length === 0) outside = true;
    if (outside) {
      freePart = '';
    } else {
      freeP = '';
      freePart = '';
    }
    return {
      supervisorEngineerIds: outside ? [] : ids,
      supervisorChargeOutsideEngineers: outside,
      supervisorChargeFreePrimary: freeP,
      supervisorChargeFreeParticipants: freePart
    };
  }

  function applyChargeRulesOnPersist(data) {
    var chargeFreeText = String((data && data.supervisorChargeFreePrimary) || '').trim();
    var chargeEngIds = Array.isArray(data && data.supervisorEngineerIds)
      ? data.supervisorEngineerIds.filter(function (x) { return String(x || '').trim(); })
      : [];
    if (chargeEngIds.length > 0) {
      data.supervisorChargeOutsideEngineers = false;
    } else if (chargeFreeText) {
      data.supervisorChargeOutsideEngineers = true;
      data.supervisorChargeFreePrimary = chargeFreeText;
      data.supervisorEngineerIds = [];
    }
    return data;
  }

  function stripLegacySupervisorField(obj) {
    if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, 'supervisor')) {
      delete obj.supervisor;
    }
    return obj;
  }

  function normalizeProjectTypeField(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.projectType === 'ΥΠΗΡΕΣΙΑ') {
      obj.projectType = 'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ';
    }
    return obj;
  }

  function hasPersistedCharge(data) {
    var ids = Array.isArray(data && data.supervisorEngineerIds)
      ? data.supervisorEngineerIds.filter(function (x) { return String(x || '').trim(); })
      : [];
    var free = String((data && data.supervisorChargeFreePrimary) || '').trim();
    return ids.length > 0 || !!free;
  }

  /**
   * Παλιά εγγραφή μόνο με supervisor: η φόρμα το πετάει και η αποθήκευση το έσβηνε.
   * Αν δεν υπάρχει νέα χρέωση, κρατάμε το όνομα ως ελεύθερη χρέωση.
   */
  function migrateLegacySupervisorIfNeeded(data, existing) {
    var legacy = String(
      (data && data.supervisor) || (existing && existing.supervisor) || ''
    ).trim();
    if (!legacy || hasPersistedCharge(data)) return data;
    data.supervisorChargeFreePrimary = legacy;
    data.supervisorChargeOutsideEngineers = true;
    data.supervisorEngineerIds = [];
    return data;
  }

  function sanitizeSubprojectForPersist(incoming, existing, opts) {
    var options = opts || {};
    var nowIso = options.nowIso || new Date().toISOString();
    var prev = existing && typeof existing === 'object' ? existing : {};
    var src = incoming && typeof incoming === 'object' ? incoming : {};
    var extra = options.extra && typeof options.extra === 'object' ? options.extra : {};

    var data = Object.assign({}, src, extra);
    data.projectId = options.projectId != null ? options.projectId : src.projectId;
    data.subprojectId = options.subprojectId != null ? options.subprojectId : src.subprojectId;
    data.createdAt = prev.createdAt || src.createdAt || nowIso;
    data.updatedAt = nowIso;

    if (options.fileGroups) data.fileGroups = options.fileGroups;
    if (Object.prototype.hasOwnProperty.call(options, 'egkriseisDialthesisPistosis')) {
      data.egkriseisDialthesisPistosis = options.egkriseisDialthesisPistosis;
    }

    data.supervisorEngineerIds = Array.isArray(src.supervisorEngineerIds)
      ? normalizeSupervisorEngineerIdList(src.supervisorEngineerIds)
      : normalizeSupervisorEngineerIdList(prev.supervisorEngineerIds);

    migrateLegacySupervisorIfNeeded(data, prev);
    applyChargeRulesOnPersist(data);
    stripLegacySupervisorField(data);
    normalizeProjectTypeField(data);
    delete data.__sendChargeGreetingEmail;
    delete data.__expectedUpdatedAt;
    return data;
  }

  function normalizeSearchText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/ά/g, 'α')
      .replace(/έ/g, 'ε')
      .replace(/ή/g, 'η')
      .replace(/ί/g, 'ι')
      .replace(/ό/g, 'ο')
      .replace(/ύ/g, 'υ')
      .replace(/ώ/g, 'ω')
      .replace(/ΐ/g, 'ι')
      .replace(/ΰ/g, 'υ')
      .replace(/Ά/g, 'α')
      .replace(/Έ/g, 'ε')
      .replace(/Ή/g, 'η')
      .replace(/Ί/g, 'ι')
      .replace(/Ό/g, 'ο')
      .replace(/Ύ/g, 'υ')
      .replace(/Ώ/g, 'ω');
  }

  function containsSearchTerm(text, searchTerm) {
    if (!text || !searchTerm) return false;
    return normalizeSearchText(String(text)).indexOf(normalizeSearchText(String(searchTerm))) !== -1;
  }

  /**
   * Γρήγορη αναζήτηση καταλόγου: τρέχων τίτλος, υποέργο, ΚΑ, ΑΛΕ, κείμενο χρέωσης + extra.
   * Δεν ψάχνει παλιούς τίτλους.
   */
  function subprojectMatchesQuickSearch(project, term, options) {
    var q = String(term || '').trim();
    if (!q) return true;
    var p = project || {};
    var catalog = (options && options.catalog) || [];
    var extraTexts = (options && options.extraTexts) || [];
    var aleCodesMatch = (p.aleCodes && Array.isArray(p.aleCodes)
      && p.aleCodes.some(function (code) { return containsSearchTerm(code, q); }))
      || containsSearchTerm(p.aleCode, q);
    if (containsSearchTerm(p.projectTitle, q)) return true;
    if (containsSearchTerm(p.subprojectTitle, q)) return true;
    if (containsSearchTerm(p.kaCode, q)) return true;
    if (aleCodesMatch) return true;
    if (containsSearchTerm(getProjectChargeSearchText(p, catalog), q)) return true;
    for (var i = 0; i < extraTexts.length; i += 1) {
      if (containsSearchTerm(extraTexts[i], q)) return true;
    }
    return false;
  }

  function filterProjectsForRole(projects, role, currentUser, extraAssignedLabels) {
    var list = Array.isArray(projects) ? projects : [];
    if (role !== 'ENGINEER') return list.slice();
    var ctx = buildEngineerVisibilityContext(currentUser, extraAssignedLabels);
    return list.filter(function (p) { return projectVisibleToAssignedEngineer(p, ctx); });
  }

  /** Φόρμα κάρτας υποέργου: μόνο διαχειριστές. Ο μηχανικός δεν επεξεργάζεται — ούτε χρεωμένο. */
  function canEditSubprojectCard(role) {
    var r = String(role || '').toUpperCase();
    return r === 'ADMIN' || r === 'SUPERADMIN';
  }

  /**
   * Άνοιγμα από σημείωση (ή άλλο σύνδεσμο) χωρίς χρέωση: ανάγνωση μόνο.
   * Δεν μπαίνει στον κατάλογο του μηχανικού.
   */
  function isSharedReadOnlySubprojectView(role, project, engineerContext) {
    if (String(role || '').toUpperCase() !== 'ENGINEER') return false;
    return !projectVisibleToAssignedEngineer(project, engineerContext);
  }

  /**
   * Αρχεία υποέργου (προσθήκη/διαγραφή): διαχειριστές πάντα· μηχανικός μόνο αν του έχει χρεωθεί.
   * Κοινοποίηση με σημείωση δεν ανοίγει πίσω πόρτα αλλαγής αρχείων.
   */
  function canMutateSubprojectFiles(role, project, engineerContext) {
    var r = String(role || '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPERADMIN') return true;
    if (r !== 'ENGINEER') return false;
    return projectVisibleToAssignedEngineer(project, engineerContext);
  }

  /**
   * Επιλογές καρφιτσώματος σημείωσης: μηχανικός βλέπει μόνο χρεωμένα έργα/υποέργα.
   * Εντάξεις, προσκλήσεις, εγκρίσεις, μελέτες μένουν όλες (ίδια εικόνα με τον κατάλογο-viewer).
   */
  function filterNoteLinkEntitiesForRole(entities, role, allowedProjectIds, allowedSubprojectIds) {
    var list = Array.isArray(entities) ? entities : [];
    if (String(role || '').toUpperCase() !== 'ENGINEER') return list.slice();
    var proj = {};
    var sub = {};
    (Array.isArray(allowedProjectIds) ? allowedProjectIds : []).forEach(function (id) {
      var k = String(id || '').trim();
      if (k) proj[k] = true;
    });
    (Array.isArray(allowedSubprojectIds) ? allowedSubprojectIds : []).forEach(function (id) {
      var k = String(id || '').trim();
      if (k) sub[k] = true;
    });
    return list.filter(function (e) {
      if (!e) return false;
      if (e.type === 'project') return !!proj[String(e.id || '').trim()];
      if (e.type === 'subproject') return !!sub[String(e.id || '').trim()];
      return true;
    });
  }

  return {
    engineerChargeFilterKey: engineerChargeFilterKey,
    freeChargeFilterKey: freeChargeFilterKey,
    resolveChargeDisplay: resolveChargeDisplay,
    getProjectChargeDisplay: getProjectChargeDisplay,
    hasProjectChargeDisplay: hasProjectChargeDisplay,
    getProjectChargeFilterKeys: getProjectChargeFilterKeys,
    projectMatchesChargeFilters: projectMatchesChargeFilters,
    collectChargeFilterOptions: collectChargeFilterOptions,
    getProjectChargeSearchText: getProjectChargeSearchText,
    projectVisibleToAssignedEngineer: projectVisibleToAssignedEngineer,
    buildEngineerVisibilityContext: buildEngineerVisibilityContext,
    mergeSupervisorEngineerIds: mergeSupervisorEngineerIds,
    normalizeSupervisorEngineerIdList: normalizeSupervisorEngineerIdList,
    loadChargeFieldsFromProject: loadChargeFieldsFromProject,
    applyOutsideChargeToggle: applyOutsideChargeToggle,
    normalizeChargeFromForm: normalizeChargeFromForm,
    applyChargeRulesOnPersist: applyChargeRulesOnPersist,
    stripLegacySupervisorField: stripLegacySupervisorField,
    normalizeProjectTypeField: normalizeProjectTypeField,
    migrateLegacySupervisorIfNeeded: migrateLegacySupervisorIfNeeded,
    sanitizeSubprojectForPersist: sanitizeSubprojectForPersist,
    normalizeSearchText: normalizeSearchText,
    containsSearchTerm: containsSearchTerm,
    subprojectMatchesQuickSearch: subprojectMatchesQuickSearch,
    filterProjectsForRole: filterProjectsForRole,
    canEditSubprojectCard: canEditSubprojectCard,
    isSharedReadOnlySubprojectView: isSharedReadOnlySubprojectView,
    canMutateSubprojectFiles: canMutateSubprojectFiles,
    filterNoteLinkEntitiesForRole: filterNoteLinkEntitiesForRole
  };
});
