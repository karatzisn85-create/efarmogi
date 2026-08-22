import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const portal = require('../../app/core/portalCatalog.js');

test('κουμπί πύλης: διαχειριστές και μηχανικός, όχι απλός χρήστης', () => {
  assert.equal(portal.showPortalButton('ADMIN'), true);
  assert.equal(portal.showPortalButton('SUPERADMIN'), true);
  assert.equal(portal.showPortalButton('ENGINEER'), true);
  assert.equal(portal.showPortalButton('USER'), false);
  assert.equal(portal.showPortalSettingsButton('SUPERADMIN'), true);
  assert.equal(portal.showPortalSettingsButton('ADMIN'), false);
  assert.equal(portal.canTogglePortalOnCard('ADMIN'), true);
  assert.equal(portal.canTogglePortalOnCard('ENGINEER'), false);
});

test('χώρος πύλης: υπερδιαχειριστής πάντα· οι άλλοι μόνο αν είναι ενεργή', () => {
  assert.equal(portal.canSeePortalWorkspace('SUPERADMIN', false), true);
  assert.equal(portal.canSeePortalWorkspace('ADMIN', false), false);
  assert.equal(portal.canSeePortalWorkspace('ADMIN', true), true);
  assert.equal(portal.canSeePortalWorkspace('ENGINEER', true), true);
  assert.equal(portal.isEngineerPortalReadOnly('ENGINEER'), true);
  assert.equal(portal.isPortalConfigured({ portalEnabled: true, portalDimosUid: 'dimos1' }), true);
  assert.equal(portal.isPortalConfigured({ portalEnabled: true, portalDimosUid: '' }), false);
});

test('εξαγωγή: ρόλος, αναγνωριστικό, τουλάχιστον ένα υποέργο', () => {
  assert.equal(portal.evaluatePortalExportAccess({ role: 'ENGINEER' }).ok, false);
  assert.equal(portal.evaluatePortalExportAccess({ role: 'ADMIN' }).ok, true);
  assert.match(portal.evaluatePortalExport({ role: 'ADMIN', selectedCount: 1, dimosUid: '' }).error, /αναγνωριστικό Δήμου/);
  assert.match(portal.evaluatePortalExport({ role: 'ADMIN', selectedCount: 0, dimosUid: 'x' }).error, /τουλάχιστον ένα/);
  assert.equal(portal.evaluatePortalExport({ role: 'ADMIN', selectedCount: 1, dimosUid: 'x' }).ok, true);
  assert.equal(portal.canCommitPortalExport({ role: 'ADMIN', selectedCount: 1, dimosUid: 'x', exporting: true }), false);
});

test('ρυθμίσεις: ενεργή πύλη χωρίς slug απορρίπτεται', () => {
  assert.equal(portal.evaluatePortalSettings({ portalEnabled: true, dimosUid: '' }).ok, false);
  assert.equal(portal.evaluatePortalSettings({ portalEnabled: false, dimosUid: '' }).ok, true);
  assert.equal(portal.evaluatePortalSettings({ portalEnabled: true, dimosUid: 'archanes' }).ok, true);
});

test('εξαγωγή κόβει απενταγμένα· αναζήτηση χωρίς ΚΑ', () => {
  const rows = [
    { subprojectId: 'a', projectTitle: 'Οδικό', subprojectTitle: 'Γέφυρα', kaCode: 'ΚΑ-100', projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ' },
    { subprojectId: 'b', projectTitle: 'Άλλο', subprojectTitle: 'Μελέτη', kaCode: 'ΚΑ-500', projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ' },
  ];
  assert.deepEqual(
    portal.selectProjectsForPortalExport(rows, ['a', 'b']).map((p) => p.subprojectId),
    ['a']
  );
  const byTitle = portal.filterPortalHubProjects(rows, { search: 'Γέφυρα' });
  assert.deepEqual(byTitle.map((p) => p.subprojectId), ['a']);
  const byKa = portal.filterPortalHubProjects(rows, { search: 'ΚΑ-100' });
  assert.equal(byKa.length, 0);
});

test('δημόσιο αρχείο: ΑΔΑΜ μόνο σε σύμβαση· αποπληρωμένο γίνεται ολοκληρωμένο αν ζητηθεί', () => {
  const ripening = portal.buildErgonEntry({
    subprojectId: 'x',
    subprojectTitle: 'Γέφυρα',
    projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
    khmdhsAdam: '24SYMV1',
    projectBudget: '120.000,00',
  });
  assert.equal(ripening.adam, undefined);
  assert.equal(ripening.proupologismos, 120000);
  const running = portal.buildErgonEntry({
    subprojectId: 'y',
    subprojectTitle: 'Δεξαμενή',
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    khmdhsAdam: '24SYMV2',
  });
  assert.equal(running.adam, '24SYMV2');
  const paid = portal.buildErgonEntry({
    subprojectId: 'z',
    subprojectTitle: 'Αίθουσα',
    projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
  }, portal.PORTAL_EXPORT_FIELDS_DEFAULT, true);
  assert.equal(paid.katastasi, 'ΟΛΟΚΛΗΡΩΜΕΝΟ');
});

test('παλιά εγγραφή: χωρίς lastExportedIds αλλά με ημερομηνία = ήδη δημοσιευμένα', () => {
  const rec = portal.normalizePortalPublishedRecord({
    subprojectIds: ['a', 'b'],
    lastExportedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(rec.selectedIds, ['a', 'b']);
  assert.deepEqual(rec.lastExportedIds, ['a', 'b']);
  assert.equal(rec.inferredLastExported, true);
  const fresh = portal.normalizePortalPublishedRecord({ subprojectIds: ['a'] });
  assert.deepEqual(fresh.lastExportedIds, []);
});

test('κάρτα: σήμανση δεν σημαίνει δημόσιο· εξαίρεση δεν το κατεβάζει αμέσως', () => {
  const queued = portal.resolvePortalCardStatus({ selectedForNext: true, lastExported: false });
  assert.equal(queued.kind, 'queued-only');
  assert.match(queued.title, /Σημειωμένο/);
  assert.equal(queued.liveOnPortal, false);
  assert.equal(queued.button, 'Εξαίρεση');
  const live = portal.resolvePortalCardStatus({ selectedForNext: true, lastExported: true });
  assert.equal(live.kind, 'queued-and-live');
  const leaving = portal.resolvePortalCardStatus({ selectedForNext: false, lastExported: true });
  assert.equal(leaving.kind, 'live-pending-removal');
  assert.match(leaving.title, /Ακόμα δημόσιο/);
  assert.equal(leaving.button, 'Επαναφορά');
  const off = portal.resolvePortalCardStatus({});
  assert.equal(off.kind, 'off');
  assert.equal(off.button, 'Συμπερίληψη');
});

test('προεπισκόπηση διαβάζει ελληνικό ποσό, όχι Number()', () => {
  const preview = portal.previewPortalSelection([
    { subprojectId: 'a', projectBudget: '120.000,00' },
  ], ['a']);
  assert.equal(preview.count, 1);
  assert.equal(preview.totalBudget, 120000);
});
