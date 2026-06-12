/**
 * epProgramStats.js — Υπολογισμός στατιστικών Επιχειρησιακού Προγράμματος.
 */

function sumBudgetYears(budgetYears = {}) {
  return Object.values(budgetYears).reduce((s, v) => s + (Number(v) || 0), 0);
}

function buildLookupMaps(program) {
  const axisMap = {};
  const measureMap = {};
  const objectiveMap = {};
  for (const a of program.axes || []) axisMap[a.code] = a.title;
  for (const m of program.measures || []) measureMap[m.code] = m.title;
  for (const o of program.objectives || []) objectiveMap[o.code] = o.title;
  return { axisMap, measureMap, objectiveMap };
}

function aggregateByKey(actions, keyFn, budgetYears) {
  const map = new Map();
  for (const a of actions) {
    const key = keyFn(a) || '—';
    if (!map.has(key)) {
      map.set(key, { label: key, count: 0, total: 0, newCount: 0, continuingCount: 0, byYear: {} });
    }
    const entry = map.get(key);
    entry.count += 1;
    entry.total += Number(a.total) || sumBudgetYears(a.budgetYears);
    if (a.isNew) entry.newCount += 1;
    else entry.continuingCount += 1;
    for (const y of budgetYears) {
      entry.byYear[y] = (entry.byYear[y] || 0) + (Number((a.budgetYears || {})[y]) || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function aggregateByFunding(actions, budgetYears) {
  const fundingMap = new Map();
  for (const a of actions) {
    const sources = (a.fundingSources || []).filter(s => s && String(s).trim());
    const list = sources.length ? sources : ['—'];
    const portion = list.length > 1 ? (Number(a.total) || 0) / list.length : (Number(a.total) || 0);
    for (const src of list) {
      if (!fundingMap.has(src)) {
        fundingMap.set(src, { label: src, count: 0, total: 0, newCount: 0, continuingCount: 0, byYear: {} });
      }
      const e = fundingMap.get(src);
      e.count += 1;
      e.total += portion;
      if (a.isNew) e.newCount += 1;
      else e.continuingCount += 1;
      for (const y of budgetYears) {
        const yv = list.length > 1
          ? (Number((a.budgetYears || {})[y]) || 0) / list.length
          : (Number((a.budgetYears || {})[y]) || 0);
        e.byYear[y] = (e.byYear[y] || 0) + yv;
      }
    }
  }
  return Array.from(fundingMap.values()).sort((a, b) => b.total - a.total);
}

/**
 * Υπολογίζει πλήρη στατιστικά για ένα πρόγραμμα ΕΠ.
 */
function computeEpProgramStatistics(program) {
  if (!program) return null;

  const actions = program.actions || [];
  const budgetYears = program.budgetYears || [];
  const { axisMap, measureMap } = buildLookupMaps(program);

  const totalBudget = actions.reduce((s, a) => s + (Number(a.total) || 0), 0);
  const newCount = actions.filter(a => a.isNew).length;
  const continuingCount = actions.length - newCount;
  const linkedCount = actions.filter(a => (a.linkedSubprojectIds || []).length > 0).length;

  const budgetByYear = {};
  for (const y of budgetYears) {
    budgetByYear[y] = actions.reduce((s, a) => s + (Number((a.budgetYears || {})[y]) || 0), 0);
  }

  const byType = aggregateByKey(actions, a => a.actionType || '—', budgetYears);
  const byPriority = aggregateByKey(actions, a => a.priority || '—', budgetYears);
  const byLocation = aggregateByKey(actions, a => a.location || '—', budgetYears);
  const byResponsible = aggregateByKey(actions, a => a.responsibleService || '—', budgetYears);
  const byAxis = aggregateByKey(actions, a => axisMap[a.axisCode] || `Άξονας ${a.axisCode || '—'}`, budgetYears);
  const byMeasure = aggregateByKey(actions, a => {
    const m = (program.measures || []).find(x => x.code === a.measureCode);
    return m?.title || a.measureCode || '—';
  }, budgetYears);
  const byFunding = aggregateByFunding(actions, budgetYears);

  const topByBudget = [...actions]
    .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
    .slice(0, 15)
    .map(a => ({
      aa: a.aa,
      title: a.title,
      total: Number(a.total) || 0,
      actionType: a.actionType,
      isNew: a.isNew,
      axisCode: a.axisCode,
      measureCode: a.measureCode
    }));

  return {
    program: {
      id: program.id,
      title: program.title,
      startYear: program.startYear,
      endYear: program.endYear,
      isActive: program.isActive,
      importedAt: program.importedAt,
      importedBy: program.importedBy
    },
    budgetYears,
    summary: {
      actionCount: actions.length,
      axesCount: (program.axes || []).length,
      measuresCount: (program.measures || []).length,
      objectivesCount: (program.objectives || []).length,
      totalBudget,
      avgBudget: actions.length ? totalBudget / actions.length : 0,
      newCount,
      continuingCount,
      linkedCount,
      unlinkedCount: actions.length - linkedCount,
      budgetByYear
    },
    byAxis,
    byMeasure,
    byType,
    byFunding,
    byLocation,
    byPriority,
    byResponsible,
    topByBudget
  };
}

// ─── Κατάσταση υποέργων → ομάδα υλοποίησης ──────────────────────────────────
const STATUS_IMPL_GROUP = {
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': 'completed',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ': 'completed',
  'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': 'executing',
  'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': 'contracting',
  'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': 'maturing',
  'ΑΠΕΝΤΑΓΜΕΝΟ': 'abandoned',
};

const IMPL_GROUP_LABELS = {
  completed:   { label: 'Ολοκληρωμένα',                  order: 1, color: '059669' },
  executing:   { label: 'Εκτελούμενα - Συμβασιοποιημένα', order: 2, color: '2563eb' },
  contracting: { label: 'Σε διαδ. σύναψης σύμβασης',      order: 3, color: 'ea580c' },
  maturing:    { label: 'Υπό βραχυπρόθεσμη ωρίμανση',     order: 4, color: 'ca8a04' },
  other:       { label: 'Λοιπά',                           order: 5, color: '64748b' },
  abandoned:   { label: 'Απενταγμένα',                     order: 6, color: '94a3b8' },
};

/**
 * Υπολογίζει στατιστικά υλοποίησης ΕΠ βάσει κατάστασης συσχετισμένων υποέργων.
 * @param {object} program - Το πρόγραμμα ΕΠ
 * @param {object[]} subprojects - Πίνακας υποέργων από loadAllProjects()
 */
function computeEpImplementationStats(program, subprojects) {
  if (!program || !Array.isArray(subprojects)) return null;

  const actions = program.actions || [];
  const totalActions = actions.length;

  // Χτίζουμε map subprojectId → projectStatus για γρήγορη αναζήτηση
  const statusMap = {};
  for (const sp of subprojects) {
    if (sp.subprojectId) {
      statusMap[sp.subprojectId] = sp.projectStatus || null;
    }
  }

  // Δράσεις με τουλάχιστον μία σύνδεση
  const linkedActions = actions.filter(a => (a.linkedSubprojectIds || []).length > 0);
  const linkedCount = linkedActions.length;
  const unlinkedCount = totalActions - linkedCount;
  const linkedBudget = linkedActions.reduce((s, a) => s + (Number(a.total) || 0), 0);
  const totalBudget = actions.reduce((s, a) => s + (Number(a.total) || 0), 0);

  // Κατανομή ανά ομάδα: για κάθε δράση παίρνουμε την "καλύτερη" κατάσταση υποέργου
  const groupCounts = {};
  const groupBudgets = {};
  const groupActions = {};
  for (const key of Object.keys(IMPL_GROUP_LABELS)) {
    groupCounts[key] = 0;
    groupBudgets[key] = 0;
    groupActions[key] = [];
  }

  for (const a of linkedActions) {
    // Βρίσκουμε το "καλύτερο" status μεταξύ όλων των συνδεδεμένων υποέργων
    let bestGroup = 'other';
    let bestOrder = 99;
    for (const sid of (a.linkedSubprojectIds || [])) {
      const st = statusMap[sid];
      if (st === 'ΑΠΕΝΤΑΓΜΕΝΟ') continue;
      const grp = STATUS_IMPL_GROUP[st] || 'other';
      const ord = IMPL_GROUP_LABELS[grp]?.order || 5;
      if (ord < bestOrder) { bestOrder = ord; bestGroup = grp; }
    }
    groupCounts[bestGroup] = (groupCounts[bestGroup] || 0) + 1;
    groupBudgets[bestGroup] = (groupBudgets[bestGroup] || 0) + (Number(a.total) || 0);
    groupActions[bestGroup].push({ aa: a.aa, title: a.title, total: Number(a.total) || 0 });
  }

  // Ποσοστό υλοποίησης = δράσεις που συνδέονται με ολοκληρωμένα ή εκτελούμενα / σύνολο δράσεων
  const activeCount = (groupCounts.completed || 0) + (groupCounts.executing || 0) + (groupCounts.contracting || 0);
  const completedCount = groupCounts.completed || 0;
  const implementationRate = totalActions > 0 ? Math.round((activeCount / totalActions) * 100) : 0;
  const completionRate = totalActions > 0 ? Math.round((completedCount / totalActions) * 100) : 0;
  const linkageRate = totalActions > 0 ? Math.round((linkedCount / totalActions) * 100) : 0;

  // Ομάδες για UI πίνακα
  const byImplGroup = Object.keys(IMPL_GROUP_LABELS)
    .filter(k => groupCounts[k] > 0)
    .map(k => ({
      key: k,
      label: IMPL_GROUP_LABELS[k].label,
      color: IMPL_GROUP_LABELS[k].color,
      order: IMPL_GROUP_LABELS[k].order,
      count: groupCounts[k],
      budget: groupBudgets[k],
      pct: linkedCount > 0 ? Math.round((groupCounts[k] / linkedCount) * 100) : 0,
      pctOfTotal: totalActions > 0 ? Math.round((groupCounts[k] / totalActions) * 100) : 0,
    }))
    .sort((a, b) => a.order - b.order);

  return {
    totalActions,
    linkedCount,
    unlinkedCount,
    linkedBudget,
    totalBudget,
    linkageRate,
    activeCount,
    completedCount,
    implementationRate,
    completionRate,
    byImplGroup,
    hasLinkedData: linkedCount > 0,
  };
}

module.exports = {
  computeEpProgramStatistics,
  computeEpImplementationStats,
  aggregateByKey,
  sumBudgetYears
};
