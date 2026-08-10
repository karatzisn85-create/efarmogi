/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureDirs,
  loadPeriods,
  loadReport,
  addFromSubproject,
  addLegacyCard,
  syncAmounts,
  dismissBadge,
  removeCard,
  enrichReportWithReadiness,
  APOLOGISMOS_FOLDER,
} = require('../../public/apologismosService');
const { buildPresentationModel } = require('../../public/apologismosPresentation');

function tempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eh-apolog-'));
}

describe('apologismosService — persistence & flow', () => {
  let dataDir;
  beforeEach(() => {
    dataDir = tempDataDir();
  });
  afterEach(() => {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('ensureDirs + default period 2024-2028', () => {
    ensureDirs(dataDir);
    expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER))).toBe(true);
    const periods = loadPeriods(dataDir);
    expect(periods.some((p) => p.startYear === 2024 && p.endYear === 2028)).toBe(true);
  });

  test('add linked + reject duplicate + sync badge + dismiss + remove', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const sub = {
      subprojectId: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      subprojectTitle: 'Δοκιμαστικό έργο',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      approvedAmount: '100.000,00',
      contractAmount: '90.000,00',
    };
    const added = addFromSubproject(dataDir, { periodId, subproject: sub, epActions: [{ objectiveCode: '1.3.1' }] });
    expect(added.success).toBe(true);
    expect(added.card.suggestedCategoryId).toBe('roads');

    const dup = addFromSubproject(dataDir, { periodId, subproject: sub, epActions: [] });
    expect(dup.success).toBe(false);

    const synced = syncAmounts(dataDir, {
      periodId,
      subprojectById: {
        [sub.subprojectId]: { ...sub, approvedAmount: '120.000,00' },
      },
    });
    expect(synced.changed).toBe(true);
    const card = synced.report.cards[0];
    expect(card.amountChangedBadge).toBe(true);
    expect(card.approvedAmount).toBe('120.000,00');

    const dismissed = dismissBadge(dataDir, { periodId, cardId: card.id });
    expect(dismissed.card.amountChangedBadge).toBe(false);

    const removed = removeCard(dataDir, { periodId, cardId: card.id });
    expect(removed.success).toBe(true);
    expect(removed.report.cards).toHaveLength(0);
  });

  test('legacy εκτός περιόδου απορρίπτεται· εντός προστίθεται χωρίς subprojectId', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const bad = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Παλιό',
        area: 'Αρχάνες',
        completionYear: 2019,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    expect(bad.success).toBe(false);

    const ok = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Παλιό 2025',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    expect(ok.success).toBe(true);
    expect(ok.card.source).toBe('legacy');
    expect(ok.card.subprojectId).toBe(null);
  });

  test('loadReport επιστρέφει enriched readiness', () => {
    const periods = loadPeriods(dataDir);
    const loaded = loadReport(dataDir, periods[0].id);
    expect(loaded.success).toBe(true);
    const enriched = enrichReportWithReadiness(loaded.report);
    expect(Array.isArray(enriched.cards)).toBe(true);
  });

  test('presentation model για εξαγωγή PDF/PPTX έχει ενότητες και ποσά', () => {
    const period = { id: '2024-2028', startYear: 2024, endYear: 2028, label: '2024–2028' };
    const report = {
      cards: [{
        id: 'c1',
        source: 'linked',
        title: 'Έργο',
        categoryId: 'roads',
        narrative: 'Κείμενο.',
        approvedAmount: '1000',
        contractAmount: '900',
        primaryViz: 'simple_card',
        photos: {},
      }],
    };
    const model = buildPresentationModel(report, period);
    expect(model.totals.projectCount).toBe(1);
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].cards[0].display.title).toBe('Έργο');
    expect(model.sections[0].totalApproved).toBe(1000);
  });
});
