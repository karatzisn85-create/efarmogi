/**
 * Απολογισμός δημοτικής περιόδου: ποιος τον ανοίγει, περίοδος,
 * ένταξη ολοκληρωμένων / παλαιότερων, αναζήτηση και ετοιμότητα.
 * Χωρίς ανάγνωση δίσκου ή φωτογραφίες.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubApologismosCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ELIGIBLE_STATUSES = ['ΟΛΟΚΛΗΡΩΜΕΝΟ', 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ'];
  var CATEGORY_IDS = [
    'roads', 'mobility', 'regeneration', 'water', 'sewerage',
    'waste', 'environment', 'buildings', 'other'
  ];

  function showApologismosButton(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canManageApologismos(user) {
    return !!(user && showApologismosButton(user.role));
  }

  function filterYearInput(raw) {
    return String(raw == null ? '' : raw).replace(/\D/g, '').slice(0, 4);
  }

  function evaluateApologismosPeriod(startYear, endYear) {
    var start = Number(filterYearInput(startYear));
    var end = Number(filterYearInput(endYear));
    if (!start || !end) {
      return { ok: false, error: 'Απαιτείται έτος έναρξης και λήξης' };
    }
    if (start < 1990 || end > 2100 || start > end) {
      return { ok: false, error: 'Μη έγκυρα έτη περιόδου' };
    }
    return {
      ok: true,
      startYear: start,
      endYear: end,
      id: start + '-' + end,
      label: 'Δημοτική περίοδος ' + start + '–' + end
    };
  }

  function createDefaultPeriod() {
    return {
      id: '2024-2028',
      startYear: 2024,
      endYear: 2028,
      label: 'Δημοτική περίοδος 2024–2028',
      isCurrent: true
    };
  }

  function yearBelongsToPeriod(year, period) {
    var y = Number(year);
    if (!Number.isFinite(y) || !period) return false;
    var start = Number(period.startYear);
    var end = Number(period.endYear);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return y >= start && y <= end;
  }

  function isEligibleSubprojectStatus(status) {
    return ELIGIBLE_STATUSES.indexOf(String(status || '').trim()) !== -1;
  }

  function listEligibleSubprojects(subprojects, existingCards) {
    var taken = {};
    (existingCards || []).forEach(function (c) {
      if (c && c.source === 'linked' && c.subprojectId) taken[c.subprojectId] = true;
    });
    return (subprojects || []).filter(function (s) {
      return s && isEligibleSubprojectStatus(s.projectStatus) && !taken[s.subprojectId];
    });
  }

  function canAddLinkedSubproject(subproject, existingCards) {
    if (!subproject) return { ok: false, error: 'Δεν βρέθηκε υποέργο' };
    if (!isEligibleSubprojectStatus(subproject.projectStatus)) {
      return {
        ok: false,
        error: 'Μόνο ολοκληρωμένα ή ολοκληρωμένα και αποπληρωμένα υποέργα μπορούν να ενταχθούν'
      };
    }
    if (!subproject.subprojectId) {
      return { ok: false, error: 'Λείπει αναγνωριστικό υποέργου' };
    }
    var dup = (existingCards || []).some(function (c) {
      return c && c.source === 'linked' && c.subprojectId === subproject.subprojectId;
    });
    if (dup) return { ok: false, error: 'Το υποέργο υπάρχει ήδη στον απολογισμό' };
    return { ok: true };
  }

  function parseAmountNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return NaN;
    var n = Number(raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function validateLegacyCardInput(input, period) {
    var errors = [];
    var title = String((input && input.title) || '').trim();
    if (!title) errors.push('Απαιτείται τίτλος');
    var area = String((input && input.area) || '').trim();
    if (!area) errors.push('Απαιτείται περιοχή');
    var year = Number(input && input.completionYear);
    if (!Number.isFinite(year) || year < 1990 || year > 2100) {
      errors.push('Απαιτείται έγκυρο έτος ολοκλήρωσης');
    } else if (period && !yearBelongsToPeriod(year, period)) {
      errors.push(
        'Το έτος ολοκλήρωσης ' + year + ' δεν ανήκει στη δημοτική περίοδο '
          + period.startYear + '–' + period.endYear
      );
    }
    var approved = parseAmountNumber(input && input.approvedAmount);
    if (!Number.isFinite(approved) || approved < 0) {
      errors.push('Απαιτείται έγκυρο εγκεκριμένο ποσό');
    }
    var contract = parseAmountNumber(input && input.contractAmount);
    if (!Number.isFinite(contract) || contract < 0) {
      errors.push('Απαιτείται έγκυρο συμβατικό ποσό');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      normalized: {
        title: title,
        area: area,
        completionYear: year,
        approvedAmount: input && input.approvedAmount,
        contractAmount: input && input.contractAmount
      }
    };
  }

  function mapSubprojectToCardFields(subproject) {
    if (!subproject) return null;
    return {
      source: 'linked',
      subprojectId: subproject.subprojectId || null,
      projectId: subproject.projectId || null,
      title: String(subproject.subprojectTitle || subproject.projectTitle || '').trim(),
      projectTitle: String(subproject.projectTitle || '').trim(),
      approvedAmount: subproject.approvedAmount || '',
      contractAmount: subproject.contractAmount || '',
      projectStatus: subproject.projectStatus || '',
      area: String(subproject.municipalUnit || subproject.location || '').trim()
    };
  }

  function getCardReadiness(card) {
    var errors = [];
    if (!card || typeof card !== 'object') {
      return { ready: false, errors: ['Μη έγκυρη κάρτα'] };
    }
    if (CATEGORY_IDS.indexOf(card.categoryId) === -1) {
      errors.push('Απαιτείται κατηγορία απολογισμού');
    }
    if (!String(card.narrative || '').trim()) {
      errors.push('Το σύντομο κείμενο είναι υποχρεωτικό');
    }
    var approved = parseAmountNumber(card.approvedAmount);
    if (!Number.isFinite(approved) || approved < 0) {
      errors.push('Απαιτείται έγκυρο εγκεκριμένο ποσό');
    }
    var contract = parseAmountNumber(card.contractAmount);
    if (!Number.isFinite(contract) || contract < 0) {
      errors.push('Απαιτείται έγκυρο συμβατικό ποσό');
    }
    if (!String(card.title || '').trim()) errors.push('Απαιτείται τίτλος');
    if (!card.primaryViz) errors.push('Απαιτείται κύριος τρόπος οπτικοποίησης');
    if (card.source === 'legacy') {
      if (!String(card.area || '').trim()) errors.push('Απαιτείται περιοχή');
      var year = Number(card.completionYear);
      if (!Number.isFinite(year) || year < 1990 || year > 2100) {
        errors.push('Απαιτείται έτος ολοκλήρωσης');
      }
    }
    return { ready: errors.length === 0, errors: errors };
  }

  function withReadiness(card) {
    var r = getCardReadiness(card);
    return Object.assign({}, card, { ready: r.ready, readinessErrors: r.errors });
  }

  function normalizeSearchTerm(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('el-GR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ς/g, 'σ');
  }

  function filterApologismosCards(cards, filters) {
    var opts = filters || {};
    var term = normalizeSearchTerm(opts.search);
    var status = opts.status || 'all';
    return (cards || []).filter(function (card) {
      var ready = card && (card.ready === true || (card.ready == null && getCardReadiness(card).ready));
      if (status === 'ready' && !ready) return false;
      if (status === 'pending' && ready) return false;
      if (!term) return true;
      var haystack = normalizeSearchTerm([
        card && card.title,
        card && card.projectTitle,
        card && card.area
      ].join(' '));
      return haystack.indexOf(term) !== -1;
    });
  }

  function canStartPresentation(cards) {
    return (cards || []).some(function (c) {
      return c && (c.ready === true || getCardReadiness(c).ready);
    });
  }

  function evaluateCardRemove(cardId) {
    if (!cardId) return { ok: false, error: 'Απαιτείται κάρτα' };
    return { ok: true };
  }

  function completeAsSimpleCard(card, extras) {
    var extra = extras || {};
    return withReadiness(Object.assign({}, card, {
      categoryId: extra.categoryId || card.categoryId || 'buildings',
      narrative: extra.narrative || card.narrative || 'Ολοκληρώθηκε η αίθουσα και αποδόθηκε στην κοινότητα.',
      primaryViz: 'simple_card',
      approvedAmount: extra.approvedAmount || card.approvedAmount || '80.000,00',
      contractAmount: extra.contractAmount || card.contractAmount || '75.000,00'
    }));
  }

  return {
    ELIGIBLE_STATUSES: ELIGIBLE_STATUSES,
    showApologismosButton: showApologismosButton,
    canManageApologismos: canManageApologismos,
    filterYearInput: filterYearInput,
    evaluateApologismosPeriod: evaluateApologismosPeriod,
    createDefaultPeriod: createDefaultPeriod,
    yearBelongsToPeriod: yearBelongsToPeriod,
    isEligibleSubprojectStatus: isEligibleSubprojectStatus,
    listEligibleSubprojects: listEligibleSubprojects,
    canAddLinkedSubproject: canAddLinkedSubproject,
    validateLegacyCardInput: validateLegacyCardInput,
    mapSubprojectToCardFields: mapSubprojectToCardFields,
    getCardReadiness: getCardReadiness,
    withReadiness: withReadiness,
    filterApologismosCards: filterApologismosCards,
    canStartPresentation: canStartPresentation,
    evaluateCardRemove: evaluateCardRemove,
    completeAsSimpleCard: completeAsSimpleCard
  };
});
