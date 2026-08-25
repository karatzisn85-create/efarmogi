/**
 * Μητρώο αναδόχων: ταυτότητα, εγγυητικές, παραλαβές / χρόνος εγγύησης,
 * δικαιώματα, ραντάρ λήξεων, συγχώνευση με προφίλ ΚΗΜΔΗΣ.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubContractorRegistry = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GUARANTEE_TYPES = [
    'συμμετοχής',
    'καλής εκτέλεσης',
    'προκαταβολής',
    'καλής λειτουργίας'
  ];

  var GUARANTEE_STATUSES = [
    'ενεργή',
    'επιστράφηκε',
    'καταπέσει',
    'ανανεώθηκε'
  ];

  var STATUS_ACTIVE = 'ενεργή';
  var STATUS_IN_EXECUTION = 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ';
  var DEFAULT_WARN_DAYS = 30;
  var DEFAULT_URGENT_DAYS = 7;
  var ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function showContractorRegistryButton(_userRole) {
    return true;
  }

  function canViewContractorRegistry(role) {
    return role === 'SUPERADMIN' || role === 'ADMIN' || role === 'ENGINEER' || role === 'USER';
  }

  function canManageContractorRegistry(role) {
    return role === 'SUPERADMIN' || role === 'ADMIN';
  }

  function isContractorRegistryReadOnly(role) {
    return role === 'USER';
  }

  function canEditGuarantees(role) {
    return role === 'SUPERADMIN' || role === 'ADMIN' || role === 'ENGINEER';
  }

  function canEditAcceptances(role) {
    return canEditGuarantees(role);
  }

  function idSetHas(ids, value) {
    var sid = String(value || '').trim();
    if (!sid) return false;
    if (ids && typeof ids.has === 'function') return ids.has(sid);
    return (ids || []).indexOf(sid) !== -1;
  }

  function canEditForSubproject(input) {
    var opts = input || {};
    var role = opts.role;
    if (role === 'SUPERADMIN' || role === 'ADMIN') return true;
    if (role !== 'ENGINEER') return false;
    return idSetHas(opts.visibleSubprojectIds, opts.subprojectId);
  }

  function normalizeVatDigits(vat) {
    return String(vat == null ? '' : vat).replace(/\D/g, '');
  }

  function foldSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeContractorDisplayName(name) {
    return foldSearchText(name)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/\./g, '');
  }

  /**
   * Ίδιο κλειδί με τα προφίλ ΚΗΜΔΗΣ: vat:ψηφία, αλλιώς name:ΕΠΩΝΥΜΙΑ.
   */
  function contractorIdentityKey(input) {
    var vatDigits = normalizeVatDigits(input && input.vat);
    if (vatDigits) return 'vat:' + vatDigits;
    var name = String((input && input.name) || '').trim();
    return name ? 'name:' + name.toUpperCase() : '';
  }

  function contractorPendingLockId(input) {
    var key = contractorIdentityKey(input);
    if (!key) return '';
    var safe = String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safe) return '';
    return ('new_' + safe).slice(0, 160);
  }

  function parseIsoDate(iso) {
    var s = String(iso || '').trim();
    var m = ISO_DATE_RE.exec(s);
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function toDateKey(iso) {
    var dt = parseIsoDate(iso);
    if (!dt) return '';
    var m = String(dt.getMonth() + 1);
    var d = String(dt.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return dt.getFullYear() + '-' + m + '-' + d;
  }

  function daysUntilDate(isoDate, todayIso) {
    var target = parseIsoDate(isoDate);
    if (!target) return null;
    var today = todayIso ? parseIsoDate(todayIso) : new Date();
    if (!today) return null;
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (24 * 60 * 60 * 1000));
  }

  function urgencyFromDaysLeft(daysLeft, opts) {
    var warnDays = (opts && opts.warnDays != null) ? opts.warnDays : DEFAULT_WARN_DAYS;
    var urgentDays = (opts && opts.urgentDays != null) ? opts.urgentDays : DEFAULT_URGENT_DAYS;
    if (daysLeft == null) return 'normal';
    if (daysLeft < 0) return 'past';
    if (daysLeft <= urgentDays) return 'urgent';
    if (daysLeft <= warnDays) return 'soon';
    return 'normal';
  }

  function parseAmount(raw) {
    if (raw == null || raw === '') return { ok: true, value: null };
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || raw < 0) {
        return { ok: false, error: 'Το ποσό δεν μπορεί να είναι αρνητικό' };
      }
      return { ok: true, value: raw };
    }
    var s = String(raw).trim().replace(/[^\d,.-]/g, '');
    if (!s) return { ok: true, value: null };
    var hasComma = s.indexOf(',') >= 0;
    var hasDot = s.indexOf('.') >= 0;
    var normalized;
    if (hasComma && hasDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = s.replace(',', '.');
    } else if (hasDot) {
      var parts = s.split('.');
      var frac = parts.length === 2 ? parts[1] : '';
      if (parts.length === 2 && frac.length <= 2) normalized = s;
      else normalized = s.replace(/\./g, '');
    } else {
      normalized = s;
    }
    var n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'Μη έγκυρο ποσό εγγυητικής' };
    }
    return { ok: true, value: n };
  }

  function createEmptyGuarantee(partial) {
    var src = partial || {};
    return {
      id: String(src.id || ''),
      type: src.type || 'καλής εκτέλεσης',
      amount: src.amount == null || src.amount === '' ? null : src.amount,
      bank: String(src.bank || ''),
      letterNumber: String(src.letterNumber || ''),
      issuedOn: String(src.issuedOn || ''),
      expiresOn: String(src.expiresOn || ''),
      subprojectId: String(src.subprojectId || ''),
      projectId: String(src.projectId || ''),
      status: src.status || STATUS_ACTIVE,
      notes: String(src.notes || ''),
      createdAt: String(src.createdAt || ''),
      updatedAt: String(src.updatedAt || '')
    };
  }

  function createEmptyAcceptance(partial) {
    var src = partial || {};
    return {
      id: String(src.id || ''),
      subprojectId: String(src.subprojectId || ''),
      projectId: String(src.projectId || ''),
      provisionalDate: String(src.provisionalDate || ''),
      finalDate: String(src.finalDate || ''),
      warrantyEndsOn: String(src.warrantyEndsOn || ''),
      notes: String(src.notes || ''),
      createdAt: String(src.createdAt || ''),
      updatedAt: String(src.updatedAt || '')
    };
  }

  function createEmptyContractorRecord(partial) {
    var src = partial || {};
    var name = String(src.name || '').trim();
    var vat = String(src.vat || '').trim();
    var identityKey = String(src.identityKey || '') || contractorIdentityKey({ name: name, vat: vat });
    return {
      id: String(src.id || ''),
      identityKey: identityKey,
      name: name,
      vat: vat,
      phone: String(src.phone || ''),
      email: String(src.email || ''),
      notes: String(src.notes || ''),
      guarantees: Array.isArray(src.guarantees) ? src.guarantees.slice() : [],
      acceptances: Array.isArray(src.acceptances) ? src.acceptances.slice() : [],
      createdAt: String(src.createdAt || ''),
      updatedAt: String(src.updatedAt || '')
    };
  }

  function evaluateContractorIdentity(draft) {
    var src = draft || {};
    var name = String(src.name || '').trim();
    var vat = String(src.vat || '').trim();
    var vatDigits = normalizeVatDigits(vat);
    if (!name && !vatDigits) {
      return { ok: false, field: 'name', error: 'Απαιτείται επωνυμία ή ΑΦΜ αναδόχου' };
    }
    var email = String(src.email || '').trim();
    if (email && email.indexOf('@') < 1) {
      return { ok: false, field: 'email', error: 'Μη έγκυρο email' };
    }
    return {
      ok: true,
      name: name,
      vat: vat,
      vatDigits: vatDigits,
      identityKey: contractorIdentityKey({ name: name, vat: vat }),
      email: email,
      phone: String(src.phone || '').trim()
    };
  }

  function evaluateGuarantee(draft) {
    var src = draft || {};
    var type = String(src.type || '').trim();
    if (GUARANTEE_TYPES.indexOf(type) === -1) {
      return { ok: false, field: 'type', error: 'Επιλέξτε είδος εγγυητικής' };
    }
    var status = String(src.status || '').trim();
    if (GUARANTEE_STATUSES.indexOf(status) === -1) {
      return { ok: false, field: 'status', error: 'Επιλέξτε κατάσταση εγγυητικής' };
    }
    var amountRes = parseAmount(src.amount);
    if (!amountRes.ok) {
      return { ok: false, field: 'amount', error: amountRes.error };
    }
    var issuedOn = String(src.issuedOn || '').trim();
    if (issuedOn && !parseIsoDate(issuedOn)) {
      return { ok: false, field: 'issuedOn', error: 'Μη έγκυρη ημερομηνία έκδοσης' };
    }
    var expiresOn = String(src.expiresOn || '').trim();
    if (expiresOn && !parseIsoDate(expiresOn)) {
      return { ok: false, field: 'expiresOn', error: 'Μη έγκυρη ημερομηνία λήξης' };
    }
    if (status === STATUS_ACTIVE && !expiresOn) {
      return { ok: false, field: 'expiresOn', error: 'Η ενεργή εγγυητική χρειάζεται ημερομηνία λήξης' };
    }
    if (issuedOn && expiresOn && parseIsoDate(expiresOn) < parseIsoDate(issuedOn)) {
      return { ok: false, field: 'expiresOn', error: 'Η λήξη δεν μπορεί να είναι πριν την έκδοση' };
    }
    var subprojectId = String(src.subprojectId || '').trim();
    if (!subprojectId) {
      return { ok: false, field: 'subprojectId', error: 'Απαιτείται σύνδεση με υποέργο' };
    }
    return {
      ok: true,
      guarantee: createEmptyGuarantee({
        id: src.id,
        type: type,
        amount: amountRes.value,
        bank: String(src.bank || '').trim(),
        letterNumber: String(src.letterNumber || '').trim(),
        issuedOn: issuedOn,
        expiresOn: expiresOn,
        subprojectId: subprojectId,
        projectId: String(src.projectId || '').trim(),
        status: status,
        notes: String(src.notes || '').trim(),
        createdAt: src.createdAt,
        updatedAt: src.updatedAt
      })
    };
  }

  function evaluateAcceptance(draft) {
    var src = draft || {};
    var subprojectId = String(src.subprojectId || '').trim();
    if (!subprojectId) {
      return { ok: false, field: 'subprojectId', error: 'Απαιτείται σύνδεση με υποέργο' };
    }
    var provisionalDate = String(src.provisionalDate || '').trim();
    var finalDate = String(src.finalDate || '').trim();
    var warrantyEndsOn = String(src.warrantyEndsOn || '').trim();
    if (provisionalDate && !parseIsoDate(provisionalDate)) {
      return { ok: false, field: 'provisionalDate', error: 'Μη έγκυρη ημερομηνία προσωρινής παραλαβής' };
    }
    if (finalDate && !parseIsoDate(finalDate)) {
      return { ok: false, field: 'finalDate', error: 'Μη έγκυρη ημερομηνία οριστικής παραλαβής' };
    }
    if (warrantyEndsOn && !parseIsoDate(warrantyEndsOn)) {
      return { ok: false, field: 'warrantyEndsOn', error: 'Μη έγκυρη ημερομηνία λήξης εγγύησης' };
    }
    if (provisionalDate && finalDate && parseIsoDate(finalDate) < parseIsoDate(provisionalDate)) {
      return { ok: false, field: 'finalDate', error: 'Η οριστική παραλαβή δεν μπορεί να είναι πριν την προσωρινή' };
    }
    if (finalDate && warrantyEndsOn && parseIsoDate(warrantyEndsOn) < parseIsoDate(finalDate)) {
      return { ok: false, field: 'warrantyEndsOn', error: 'Η λήξη εγγύησης δεν μπορεί να είναι πριν την οριστική παραλαβή' };
    }
    if (provisionalDate && warrantyEndsOn && !finalDate && parseIsoDate(warrantyEndsOn) < parseIsoDate(provisionalDate)) {
      return { ok: false, field: 'warrantyEndsOn', error: 'Η λήξη εγγύησης δεν μπορεί να είναι πριν την προσωρινή παραλαβή' };
    }
    if (!provisionalDate && !finalDate && !warrantyEndsOn) {
      return {
        ok: false,
        field: 'provisionalDate',
        error: 'Καταχωρίστε τουλάχιστον μία ημερομηνία παραλαβής ή λήξης εγγύησης'
      };
    }
    return {
      ok: true,
      acceptance: createEmptyAcceptance({
        id: src.id,
        subprojectId: subprojectId,
        projectId: String(src.projectId || '').trim(),
        provisionalDate: provisionalDate,
        finalDate: finalDate,
        warrantyEndsOn: warrantyEndsOn,
        notes: String(src.notes || '').trim(),
        createdAt: src.createdAt,
        updatedAt: src.updatedAt
      })
    };
  }

  function recordsMatchProfile(record, profile) {
    if (!record || !profile) return false;
    if (record.identityKey && profile.key && record.identityKey === profile.key) return true;
    var recVat = normalizeVatDigits(record.vat);
    var profVat = normalizeVatDigits(profile.vat);
    if (recVat && profVat) return recVat === profVat;
    var recName = normalizeContractorDisplayName(record.name);
    var profName = normalizeContractorDisplayName(profile.name);
    if (recName && profName && recName === profName) return true;
    return false;
  }

  function compareRegistryRecords(a, b) {
    var ua = String((a && a.updatedAt) || '');
    var ub = String((b && b.updatedAt) || '');
    if (ua !== ub) return ua < ub ? 1 : -1;
    var ga = ((a && a.guarantees) || []).length + ((a && a.acceptances) || []).length;
    var gb = ((b && b.guarantees) || []).length + ((b && b.acceptances) || []).length;
    if (ga !== gb) return gb - ga;
    return String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
  }

  function findRecordForProfile(profile, records) {
    var matches = [];
    var list = records || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (recordsMatchProfile(list[i], profile)) matches.push(list[i]);
    }
    if (!matches.length) return null;
    matches.sort(compareRegistryRecords);
    return matches[0];
  }

  function overlayRegistryOnProfiles(profiles, records) {
    return (profiles || []).map(function (profile) {
      var rec = findRecordForProfile(profile, records);
      var out = Object.assign({}, profile);
      out.phone = rec && rec.phone ? rec.phone : '';
      out.email = rec && rec.email ? rec.email : '';
      out.registryNotes = rec && rec.notes ? rec.notes : '';
      out.guarantees = rec && rec.guarantees ? rec.guarantees : [];
      out.acceptances = rec && rec.acceptances ? rec.acceptances : [];
      out.registryId = rec && rec.id ? rec.id : null;
      out.updatedAt = rec && rec.updatedAt ? rec.updatedAt : '';
      out.createdAt = rec && rec.createdAt ? rec.createdAt : '';
      out.identityKey = (rec && rec.identityKey) || profile.key || '';
      return out;
    });
  }

  function listOrphanRegistryRecords(profiles, records) {
    var used = {};
    (profiles || []).forEach(function (profile) {
      var rec = findRecordForProfile(profile, records);
      if (rec && rec.id) used[String(rec.id)] = true;
    });
    return (records || []).filter(function (rec) {
      if (!rec || (rec.id && used[String(rec.id)])) return false;
      return true;
    });
  }

  function recordMatchesAnyProfile(record, profiles) {
    return (profiles || []).some(function (profile) {
      return recordsMatchProfile(record, profile);
    });
  }

  function rowTouchesVisibleSubproject(row, visibleSubprojectIds) {
    var i;
    var assignments = (row && row.assignments) || [];
    for (i = 0; i < assignments.length; i++) {
      if (idSetHas(visibleSubprojectIds, assignments[i] && assignments[i].subprojectId)) return true;
    }
    var guarantees = (row && row.guarantees) || [];
    for (i = 0; i < guarantees.length; i++) {
      if (idSetHas(visibleSubprojectIds, guarantees[i] && guarantees[i].subprojectId)) return true;
    }
    var acceptances = (row && row.acceptances) || [];
    for (i = 0; i < acceptances.length; i++) {
      if (idSetHas(visibleSubprojectIds, acceptances[i] && acceptances[i].subprojectId)) return true;
    }
    return false;
  }

  function engineerMayAccessRecord(record, input) {
    var opts = input || {};
    return rowTouchesVisibleSubproject({
      guarantees: (record && record.guarantees) || [],
      acceptances: (record && record.acceptances) || [],
      assignments: opts.assignments || (record && record.assignments) || []
    }, opts.visibleSubprojectIds);
  }

  function filterHubForViewer(rows, input) {
    var opts = input || {};
    var role = opts.role;
    if (role !== 'ENGINEER') return rows || [];
    return (rows || []).filter(function (row) {
      return rowTouchesVisibleSubproject(row, opts.visibleSubprojectIds);
    });
  }

  function filterLinkedItemsForViewer(list, input) {
    var opts = input || {};
    if (opts.role !== 'ENGINEER') return list || [];
    return (list || []).filter(function (item) {
      return idSetHas(opts.visibleSubprojectIds, item && item.subprojectId);
    });
  }

  function collectIdentityKeysFromSubproject(project) {
    var keys = [];
    var seen = {};
    function addFrom(name, vat) {
      var k = contractorIdentityKey({ name: name, vat: vat });
      if (!k || seen[k]) return;
      seen[k] = true;
      keys.push(k);
    }
    function addSnapshot(snap) {
      if (!snap || typeof snap !== 'object') return;
      addFrom(snap.anadoxosName, snap.anadoxosVat);
    }
    addSnapshot(project && project.khmdhsContractSnapshot);
    var contracts = (project && project.contracts) || [];
    var i;
    for (i = 0; i < contracts.length; i++) {
      var c = contracts[i];
      if (!c) continue;
      addSnapshot(c.khmdhsContractSnapshot);
      addFrom(c.anadoxosName, c.anadoxosAfm || c.anadoxosVat);
    }
    return keys;
  }

  function recordIdentityKey(record) {
    return String((record && record.identityKey) || '') || contractorIdentityKey(record || {});
  }

  function recordVisibleToEngineer(record, input) {
    var opts = input || {};
    if (engineerMayAccessRecord(record, opts)) return true;
    return idSetHas(opts.identityKeys, recordIdentityKey(record));
  }

  function redactRecordForViewer(record, input) {
    var opts = input || {};
    if (!record) return record;
    if (opts.role !== 'ENGINEER') return record;
    var copy = createEmptyContractorRecord(record);
    copy.guarantees = filterLinkedItemsForViewer(copy.guarantees, opts);
    copy.acceptances = filterLinkedItemsForViewer(copy.acceptances, opts);
    return copy;
  }

  function filterRecordsForViewer(records, input) {
    var opts = input || {};
    if (opts.role !== 'ENGINEER') return records || [];
    return (records || []).filter(function (rec) {
      return recordVisibleToEngineer(rec, opts);
    }).map(function (rec) {
      return redactRecordForViewer(rec, opts);
    });
  }

  function canEditContactField(existingValue, role) {
    if (role === 'SUPERADMIN' || role === 'ADMIN') return true;
    if (role !== 'ENGINEER') return false;
    return !String(existingValue == null ? '' : existingValue).trim();
  }

  function parseContractorSearch(row, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var parts = [
      row && row.name,
      row && row.vat,
      row && row.phone,
      row && row.email,
      row && row.registryNotes,
      row && row.notes
    ];
    var i;
    var guarantees = (row && row.guarantees) || [];
    for (i = 0; i < guarantees.length; i++) {
      parts.push(guarantees[i] && guarantees[i].letterNumber);
      parts.push(guarantees[i] && guarantees[i].bank);
    }
    return foldSearchText(parts.join(' ')).indexOf(foldSearchText(q)) !== -1;
  }

  function countActiveGuarantees(row) {
    return ((row && row.guarantees) || []).filter(function (g) {
      return g && g.status === STATUS_ACTIVE;
    }).length;
  }

  function buildRadarItem(kind, row, extra) {
    var daysLeft = extra.daysLeft;
    var urgency = extra.urgency;
    return {
      kind: kind,
      recordId: row && (row.registryId || row.id) || '',
      rowKey: hubRowKey(row),
      identityKey: (row && (row.identityKey || row.key)) || '',
      contractorName: (row && row.name) || '',
      subprojectId: extra.subprojectId || '',
      dateIso: extra.dateIso || '',
      daysLeft: daysLeft,
      urgency: urgency,
      label: extra.label || '',
      guaranteeId: extra.guaranteeId || '',
      acceptanceId: extra.acceptanceId || ''
    };
  }

  function maybeRadarFromDate(kind, row, dateIso, extra, opts) {
    var daysLeft = daysUntilDate(dateIso, opts && opts.todayIso);
    if (daysLeft == null) return null;
    var urgency = urgencyFromDaysLeft(daysLeft, opts);
    var warnDays = (opts && opts.warnDays != null) ? opts.warnDays : DEFAULT_WARN_DAYS;
    if (urgency === 'normal') return null;
    if (opts && opts.recentPastOnly && daysLeft < -warnDays) return null;
    return buildRadarItem(kind, row, Object.assign({
      dateIso: toDateKey(dateIso),
      daysLeft: daysLeft,
      urgency: urgency
    }, extra));
  }

  function listGuaranteeRadarItems(rows, opts) {
    var items = [];
    var pastLimited = Object.assign({}, opts, { recentPastOnly: true });
    (rows || []).forEach(function (row) {
      ((row && row.guarantees) || []).forEach(function (g) {
        if (!g || g.status !== STATUS_ACTIVE) return;
        var item = maybeRadarFromDate('guarantee', row, g.expiresOn, {
          subprojectId: g.subprojectId || '',
          guaranteeId: g.id || '',
          label: 'Εγγυητική ' + (g.type || '') + ' λήγει'
        }, pastLimited);
        if (item) items.push(item);
      });
    });
    return items;
  }

  function listAcceptanceRadarItems(rows, opts) {
    var items = [];
    var recentPast = Object.assign({}, opts, { recentPastOnly: true });
    (rows || []).forEach(function (row) {
      ((row && row.acceptances) || []).forEach(function (acc) {
        if (!acc) return;
        var provisional = maybeRadarFromDate('provisional_acceptance', row, acc.provisionalDate, {
          subprojectId: acc.subprojectId || '',
          acceptanceId: acc.id || '',
          label: 'Προσωρινή παραλαβή'
        }, recentPast);
        if (provisional) items.push(provisional);
        var finalItem = maybeRadarFromDate('final_acceptance', row, acc.finalDate, {
          subprojectId: acc.subprojectId || '',
          acceptanceId: acc.id || '',
          label: 'Οριστική παραλαβή'
        }, recentPast);
        if (finalItem) items.push(finalItem);
        var warranty = maybeRadarFromDate('warranty', row, acc.warrantyEndsOn, {
          subprojectId: acc.subprojectId || '',
          acceptanceId: acc.id || '',
          label: 'Λήξη χρόνου εγγύησης'
        }, recentPast);
        if (warranty) items.push(warranty);
      });
    });
    return items;
  }

  function listContractorRadarItems(rows, opts) {
    return listGuaranteeRadarItems(rows, opts).concat(listAcceptanceRadarItems(rows, opts));
  }

  function listAllGuaranteeExpiryItems(rows) {
    var items = [];
    (rows || []).forEach(function (row) {
      ((row && row.guarantees) || []).forEach(function (g) {
        if (!g || g.status !== STATUS_ACTIVE || !g.expiresOn) return;
        var dateIso = toDateKey(g.expiresOn);
        if (!dateIso) return;
        var dl = daysUntilDate(dateIso);
        items.push(buildRadarItem('guarantee_expiry', row, {
          dateIso: dateIso,
          daysLeft: dl,
          urgency: urgencyFromDaysLeft(dl),
          subprojectId: g.subprojectId || '',
          guaranteeId: g.id || '',
          label: (g.type || 'Εγγυητική') + ' — ' + ((row && row.name) || 'Ανάδοχος')
        }));
      });
    });
    return items;
  }

  function filterRadarItemsForViewer(items, input) {
    var opts = input || {};
    var role = opts.role;
    if (role === 'USER') return [];
    if (role !== 'ENGINEER') return items || [];
    return (items || []).filter(function (item) {
      return idSetHas(opts.visibleSubprojectIds, item && item.subprojectId);
    });
  }

  function filterContractorHub(rows, filters) {
    var opts = filters || {};
    return (rows || []).filter(function (row) {
      if (!parseContractorSearch(row, opts.search)) return false;
      if (opts.quickFilter === 'active_guarantee' && countActiveGuarantees(row) === 0) return false;
      if (opts.quickFilter === 'expiring') {
        var radar = listContractorRadarItems([row], {
          todayIso: opts.todayIso,
          warnDays: opts.warnDays
        });
        if (!radar.length) return false;
      }
      return true;
    });
  }

  function collectRecordSubprojectIds(record) {
    var seen = {};
    var ids = [];
    function add(sid) {
      var id = String(sid || '').trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    var i;
    var guarantees = (record && record.guarantees) || [];
    for (i = 0; i < guarantees.length; i++) add(guarantees[i] && guarantees[i].subprojectId);
    var acceptances = (record && record.acceptances) || [];
    for (i = 0; i < acceptances.length; i++) add(acceptances[i] && acceptances[i].subprojectId);
    var assignments = (record && record.assignments) || [];
    for (i = 0; i < assignments.length; i++) add(assignments[i] && assignments[i].subprojectId);
    return ids;
  }

  function assignmentIsActive(assignment) {
    return !!(assignment && assignment.projectStatus === STATUS_IN_EXECUTION);
  }

  function countActiveAssignments(row) {
    return ((row && row.assignments) || []).filter(assignmentIsActive).length;
  }

  function hubRowKey(row) {
    if (!row) return '';
    return String(row.registryId || row.id || row.key || row.identityKey || '');
  }

  function buildContractorHubRows(profiles, records) {
    var overlaid = overlayRegistryOnProfiles(profiles, records);
    var orphans = listOrphanRegistryRecords(profiles, records).map(function (rec) {
      return {
        key: rec.identityKey,
        identityKey: rec.identityKey,
        name: rec.name,
        vat: rec.vat,
        count: 0,
        amount: 0,
        assignments: [],
        phone: rec.phone || '',
        email: rec.email || '',
        registryNotes: rec.notes || '',
        notes: rec.notes || '',
        guarantees: rec.guarantees || [],
        acceptances: rec.acceptances || [],
        registryId: rec.id || null,
        updatedAt: rec.updatedAt || '',
        createdAt: rec.createdAt || '',
        orphan: true,
        duplicate: recordMatchesAnyProfile(rec, profiles)
      };
    });
    return overlaid.concat(orphans).sort(function (a, b) {
      var na = foldSearchText(a && a.name);
      var nb = foldSearchText(b && b.name);
      if (na !== nb) return na < nb ? -1 : 1;
      return String((a && a.vat) || '').localeCompare(String((b && b.vat) || ''));
    });
  }

  function evaluateRecordPayload(record) {
    var ident = evaluateContractorIdentity(record);
    if (!ident.ok) return ident;
    var guarantees = [];
    var srcG = (record && record.guarantees) || [];
    var i;
    for (i = 0; i < srcG.length; i++) {
      var g = evaluateGuarantee(srcG[i]);
      if (!g.ok) return g;
      guarantees.push(g.guarantee);
    }
    var acceptances = [];
    var srcA = (record && record.acceptances) || [];
    for (i = 0; i < srcA.length; i++) {
      var a = evaluateAcceptance(srcA[i]);
      if (!a.ok) return a;
      acceptances.push(a.acceptance);
    }
    return {
      ok: true,
      record: createEmptyContractorRecord({
        id: record && record.id,
        identityKey: ident.identityKey,
        name: ident.name,
        vat: ident.vat,
        phone: ident.phone,
        email: ident.email,
        notes: record && record.notes,
        guarantees: guarantees,
        acceptances: acceptances,
        createdAt: record && record.createdAt,
        updatedAt: record && record.updatedAt
      })
    };
  }

  function mergeEngineerRecordSave(existing, incoming, visibleSubprojectIds) {
    var src = incoming || {};
    var base = existing ? existing : createEmptyContractorRecord(src);
    function keepForeign(list) {
      return (list || []).filter(function (item) {
        return item && !idSetHas(visibleSubprojectIds, item.subprojectId);
      });
    }
    function takeOwn(list) {
      return (list || []).filter(function (item) {
        return item && idSetHas(visibleSubprojectIds, item.subprojectId);
      });
    }
    var foreignGuarantees = existing ? keepForeign(existing.guarantees) : [];
    var foreignAcceptances = existing ? keepForeign(existing.acceptances) : [];
    function keepContact(prev, next) {
      if (String(prev || '').trim()) return prev;
      return next != null ? next : prev;
    }
    return createEmptyContractorRecord({
      id: base.id || src.id,
      identityKey: existing ? existing.identityKey : (src.identityKey || base.identityKey),
      name: existing ? existing.name : (src.name != null && String(src.name).trim() ? src.name : base.name),
      vat: existing ? existing.vat : (src.vat != null && String(src.vat).trim() ? src.vat : base.vat),
      phone: keepContact(existing ? existing.phone : '', src.phone != null ? src.phone : base.phone),
      email: keepContact(existing ? existing.email : '', src.email != null ? src.email : base.email),
      notes: keepContact(existing ? existing.notes : '', src.notes != null ? src.notes : base.notes),
      guarantees: foreignGuarantees.concat(takeOwn(src.guarantees)),
      acceptances: foreignAcceptances.concat(takeOwn(src.acceptances)),
      createdAt: base.createdAt,
      updatedAt: base.updatedAt
    });
  }

  function upsertGuaranteeInList(list, guarantee) {
    var next = (list || []).slice();
    var id = String((guarantee && guarantee.id) || '');
    var i;
    if (id) {
      for (i = 0; i < next.length; i++) {
        if (next[i] && String(next[i].id || '') === id) {
          next[i] = guarantee;
          return next;
        }
      }
    }
    next.push(guarantee);
    return next;
  }

  function removeGuaranteeFromList(list, guaranteeId) {
    var id = String(guaranteeId || '');
    return (list || []).filter(function (g) {
      return !g || String(g.id || '') !== id;
    });
  }

  function sortGuarantees(list) {
    return (list || []).slice().sort(function (a, b) {
      var aActive = a && a.status === STATUS_ACTIVE ? 0 : 1;
      var bActive = b && b.status === STATUS_ACTIVE ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return String((a && a.expiresOn) || '').localeCompare(String((b && b.expiresOn) || ''));
    });
  }

  function guaranteeIsEditable(guarantee, input) {
    var opts = input || {};
    if (opts.role === 'USER') return false;
    return canEditForSubproject({
      role: opts.role,
      visibleSubprojectIds: opts.visibleSubprojectIds,
      subprojectId: guarantee && guarantee.subprojectId
    });
  }

  function subprojectChoicesFromAssignments(assignments) {
    var seen = {};
    var out = [];
    (assignments || []).forEach(function (a) {
      var id = String((a && a.subprojectId) || '').trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      var title = String((a && (a.subprojectTitle || a.projectTitle)) || '').trim() || id;
      out.push({
        subprojectId: id,
        projectId: String((a && a.projectId) || ''),
        label: title
      });
    });
    return out;
  }

  function filterSubprojectChoicesForViewer(choices, input) {
    var opts = input || {};
    if (opts.role !== 'ENGINEER') return choices || [];
    return (choices || []).filter(function (c) {
      return idSetHas(opts.visibleSubprojectIds, c && c.subprojectId);
    });
  }

  function guaranteesFingerprint(list) {
    return (list || []).map(function (g) {
      if (!g) return '';
      return [
        g.id, g.type, g.status, g.amount, g.bank, g.letterNumber,
        g.issuedOn, g.expiresOn, g.subprojectId, g.notes
      ].join('|');
    }).join('\n');
  }

  function upsertAcceptanceInList(list, acceptance) {
    var next = (list || []).slice();
    var id = String((acceptance && acceptance.id) || '');
    var subId = String((acceptance && acceptance.subprojectId) || '');
    var i;
    if (id) {
      for (i = 0; i < next.length; i++) {
        if (next[i] && String(next[i].id || '') === id) {
          next[i] = acceptance;
          return next;
        }
      }
    }
    if (subId) {
      for (i = 0; i < next.length; i++) {
        if (next[i] && String(next[i].subprojectId || '') === subId) {
          var keptId = String((next[i] && next[i].id) || '');
          next[i] = keptId && !id
            ? Object.assign({}, acceptance, { id: keptId, createdAt: next[i].createdAt || acceptance.createdAt })
            : acceptance;
          return next;
        }
      }
    }
    next.push(acceptance);
    return next;
  }

  function removeAcceptanceFromList(list, acceptanceId) {
    var id = String(acceptanceId || '');
    return (list || []).filter(function (a) {
      return !a || String(a.id || '') !== id;
    });
  }

  function sortAcceptances(list) {
    return (list || []).slice().sort(function (a, b) {
      var aKey = (a && (a.warrantyEndsOn || a.finalDate || a.provisionalDate)) || '9999';
      var bKey = (b && (b.warrantyEndsOn || b.finalDate || b.provisionalDate)) || '9999';
      return String(aKey).localeCompare(String(bKey));
    });
  }

  function acceptanceIsEditable(acceptance, input) {
    return guaranteeIsEditable(acceptance, input);
  }

  function subprojectChoicesWithoutAcceptance(choices, acceptances) {
    var taken = {};
    (acceptances || []).forEach(function (a) {
      var id = String((a && a.subprojectId) || '');
      if (id) taken[id] = true;
    });
    return (choices || []).filter(function (c) {
      return c && !taken[String(c.subprojectId || '')];
    });
  }

  function acceptancesFingerprint(list) {
    return (list || []).map(function (a) {
      if (!a) return '';
      return [
        a.id, a.subprojectId, a.provisionalDate, a.finalDate, a.warrantyEndsOn, a.notes
      ].join('|');
    }).join('\n');
  }

  return {
    GUARANTEE_TYPES: GUARANTEE_TYPES,
    GUARANTEE_STATUSES: GUARANTEE_STATUSES,
    STATUS_ACTIVE: STATUS_ACTIVE,
    STATUS_IN_EXECUTION: STATUS_IN_EXECUTION,
    DEFAULT_WARN_DAYS: DEFAULT_WARN_DAYS,
    DEFAULT_URGENT_DAYS: DEFAULT_URGENT_DAYS,
    showContractorRegistryButton: showContractorRegistryButton,
    canViewContractorRegistry: canViewContractorRegistry,
    canManageContractorRegistry: canManageContractorRegistry,
    isContractorRegistryReadOnly: isContractorRegistryReadOnly,
    canEditGuarantees: canEditGuarantees,
    canEditAcceptances: canEditAcceptances,
    canEditForSubproject: canEditForSubproject,
    canEditContactField: canEditContactField,
    normalizeVatDigits: normalizeVatDigits,
    foldSearchText: foldSearchText,
    normalizeContractorDisplayName: normalizeContractorDisplayName,
    contractorIdentityKey: contractorIdentityKey,
    contractorPendingLockId: contractorPendingLockId,
    parseIsoDate: parseIsoDate,
    toDateKey: toDateKey,
    daysUntilDate: daysUntilDate,
    urgencyFromDaysLeft: urgencyFromDaysLeft,
    parseAmount: parseAmount,
    createEmptyGuarantee: createEmptyGuarantee,
    createEmptyAcceptance: createEmptyAcceptance,
    createEmptyContractorRecord: createEmptyContractorRecord,
    evaluateContractorIdentity: evaluateContractorIdentity,
    evaluateGuarantee: evaluateGuarantee,
    evaluateAcceptance: evaluateAcceptance,
    recordsMatchProfile: recordsMatchProfile,
    findRecordForProfile: findRecordForProfile,
    overlayRegistryOnProfiles: overlayRegistryOnProfiles,
    listOrphanRegistryRecords: listOrphanRegistryRecords,
    filterHubForViewer: filterHubForViewer,
    filterLinkedItemsForViewer: filterLinkedItemsForViewer,
    filterRecordsForViewer: filterRecordsForViewer,
    redactRecordForViewer: redactRecordForViewer,
    recordVisibleToEngineer: recordVisibleToEngineer,
    collectIdentityKeysFromSubproject: collectIdentityKeysFromSubproject,
    parseContractorSearch: parseContractorSearch,
    countActiveGuarantees: countActiveGuarantees,
    listGuaranteeRadarItems: listGuaranteeRadarItems,
    listAcceptanceRadarItems: listAcceptanceRadarItems,
    listContractorRadarItems: listContractorRadarItems,
    listAllGuaranteeExpiryItems: listAllGuaranteeExpiryItems,
    filterRadarItemsForViewer: filterRadarItemsForViewer,
    filterContractorHub: filterContractorHub,
    recordTouchesVisibleSubproject: rowTouchesVisibleSubproject,
    engineerMayAccessRecord: engineerMayAccessRecord,
    collectRecordSubprojectIds: collectRecordSubprojectIds,
    assignmentIsActive: assignmentIsActive,
    countActiveAssignments: countActiveAssignments,
    hubRowKey: hubRowKey,
    buildContractorHubRows: buildContractorHubRows,
    evaluateRecordPayload: evaluateRecordPayload,
    mergeEngineerRecordSave: mergeEngineerRecordSave,
    upsertGuaranteeInList: upsertGuaranteeInList,
    removeGuaranteeFromList: removeGuaranteeFromList,
    sortGuarantees: sortGuarantees,
    guaranteeIsEditable: guaranteeIsEditable,
    subprojectChoicesFromAssignments: subprojectChoicesFromAssignments,
    filterSubprojectChoicesForViewer: filterSubprojectChoicesForViewer,
    guaranteesFingerprint: guaranteesFingerprint,
    upsertAcceptanceInList: upsertAcceptanceInList,
    removeAcceptanceFromList: removeAcceptanceFromList,
    sortAcceptances: sortAcceptances,
    acceptanceIsEditable: acceptanceIsEditable,
    subprojectChoicesWithoutAcceptance: subprojectChoicesWithoutAcceptance,
    acceptancesFingerprint: acceptancesFingerprint
  };
});
