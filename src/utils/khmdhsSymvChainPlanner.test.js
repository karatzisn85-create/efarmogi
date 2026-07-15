/**
 * @jest-environment node
 */
import {
  SYMV_CHAIN_ROLE,
  collectSymvChainDocuments,
  buildDefaultSymvChainPlan,
  validateSymvChainPlan,
} from './khmdhsSymvChainPlanner';
import { applySymvChainPlanToForm, buildContractChainHistoryFromSymvPlan } from './khmdhsSymvChainApply';

describe('khmdhsSymvChainPlanner', () => {
  const pezonChainRes = {
    success: true,
    contract: {
      adam: '22SYMV011799800',
      roleLabel: 'Αρχική σύμβαση',
      snapshot: { title: 'ΔΙΑΚΗΡΥΞΗ ΓΙΑ ΤΟ ΕΡΓΟ', referenceNumber: '22SYMV011799800' },
    },
    contractChainHistory: [
      { adam: '22SYMV011799800', isRoot: true, label: 'Αρχική σύμβαση' },
      { adam: '22SYMV011327633', label: 'Σύμβαση 2' },
      { adam: '22SYMV011308661', label: 'Σύμβαση 3' },
      { adam: '24SYMV015482244', label: 'Συμπληρωματική σύμβαση' },
    ],
    chainMeta: {
      contractRootAdam: '22SYMV011799800',
      parallelContractCandidates: [
        '24SYMV015482244',
        '22SYMV011799800',
        '22SYMV011327633',
        '22SYMV011308661',
      ],
      parallelContracts: ['22SYMV011327633', '22SYMV011308661', '24SYMV015482244'],
      contractSnapshotsByAdam: {
        '22SYMV011799800': { title: 'ΔΙΑΚΗΡΥΞΗ ΓΙΑ ΤΟ ΕΡΓΟ', referenceNumber: '22SYMV011799800', contractSignedDate: '2022-06-01' },
        '22SYMV011327633': { title: 'ΑΠΟΦΑΣΗ ΔΗΜΟΤΙΚΗΣ ΕΠΙΤΡΟΠΗΣ', referenceNumber: '22SYMV011327633' },
        '22SYMV011308661': { title: 'ΑΠΟΦΑΣΗ ΔΗΜΟΤΙΚΗΣ ΕΠΙΤΡΟΠΗΣ', referenceNumber: '22SYMV011308661' },
        '24SYMV015482244': { title: 'ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ', referenceNumber: '24SYMV015482244', contractSignedDate: '2024-09-19', contractBudget: 74155.85 },
      },
    },
    request: { adam: '21REQ009553549', snapshot: { referenceNumber: '21REQ009553549', title: 'Αίτημα' }, fetchedAt: '2026-01-01' },
    notice: {
      adam: '22PROC010072052',
      snapshot: { referenceNumber: '22PROC010072052', title: 'Δημοσίευση' },
      fetchedAt: '2026-01-01',
      mappedAssignmentProcedure: 'Διαγωνισμός',
    },
    auction: {
      adam: '22AWRD011136485',
      snapshot: { referenceNumber: '22AWRD011136485', organization: 'Ανάδοχος' },
      fetchedAt: '2026-01-01',
    },
    commitmentDecisions: [
      { adam: '21REQ018475848', snapshot: { referenceNumber: '21REQ018475848', title: 'Ανάληψη' } },
    ],
    payments: [{ adam: '26PAY019290000', snapshot: { referenceNumber: '26PAY019290000' }, amountGross: 2400 }],
    dataQualityReport: { items: [], hasActionRequired: false },
  };

  it('collects all SYMV documents from chain', () => {
    const docs = collectSymvChainDocuments(pezonChainRes);
    expect(docs.length).toBe(4);
    expect(docs.map((d) => d.adam).sort()).toEqual([
      '22SYMV011308661',
      '22SYMV011327633',
      '22SYMV011799800',
      '24SYMV015482244',
    ]);
  });

  it('defaults root to main and non-contract siblings to intermediate', () => {
    const plan = buildDefaultSymvChainPlan(pezonChainRes);
    const byAdam = Object.fromEntries(plan.items.map((i) => [i.adam, i.role]));
    expect(byAdam['22SYMV011799800']).toBe(SYMV_CHAIN_ROLE.MAIN);
    expect(byAdam['22SYMV011327633']).toBe(SYMV_CHAIN_ROLE.INTERMEDIATE);
    expect(byAdam['22SYMV011308661']).toBe(SYMV_CHAIN_ROLE.INTERMEDIATE);
    expect(byAdam['24SYMV015482244']).toBe(SYMV_CHAIN_ROLE.SUPPLEMENTARY);
  });

  it('applies user plan as single contract + supplementary', () => {
    const plan = buildDefaultSymvChainPlan(pezonChainRes);
    // Προεπιλογή έχει ενδιάμεσους χωρίς ημερομηνία — ορίζουμε για έγκυρη εφαρμογή
    plan.items = plan.items.map((item) => (
      item.role === SYMV_CHAIN_ROLE.INTERMEDIATE && !item.date
        ? { ...item, date: '2022-07-01' }
        : item
    ));
    const { form } = applySymvChainPlanToForm(
      { implementationForm: 'Μια Σύμβαση', projectStatus: 'Σε εκτέλεση' },
      pezonChainRes,
      plan,
      { seedAdam: '21REQ009553549' }
    );
    expect(form.implementationForm).toBe('Μια Σύμβαση');
    expect(form.khmdhsAdam).toBe('22SYMV011799800');
    expect(form.supplementaryContracts).toHaveLength(1);
    expect(form.supplementaryContracts[0].khmdhsAdam).toBe('24SYMV015482244');
    expect(form.khmdhsContractChainHistory.map((h) => h.adam)).toEqual([
      '22SYMV011799800',
      '22SYMV011327633',
      '22SYMV011308661',
      '24SYMV015482244',
    ]);
    expect(form.khmdhsRequestAdam).toBe('21REQ009553549');
    expect(form.khmdhsNoticeAdam).toBe('22PROC010072052');
    expect(form.khmdhsAwardAdam).toBe('22AWRD011136485');
    expect(form.khmdhsPayments).toHaveLength(1);
    expect(form.khmdhsCommitmentDecisions).toHaveLength(1);
  });

  it('validates at least one main or parallel', () => {
    expect(validateSymvChainPlan({ items: [{ adam: 'A', role: SYMV_CHAIN_ROLE.SKIP }] }).ok).toBe(false);
    expect(validateSymvChainPlan({
      items: [
        { adam: 'A', role: SYMV_CHAIN_ROLE.MAIN },
        { adam: 'B', role: SYMV_CHAIN_ROLE.SUPPLEMENTARY },
      ],
    }).ok).toBe(true);
  });

  it('places intermediate links in chain history sorted by document date', () => {
    const plan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
        { adam: '22SYMV011327633', role: SYMV_CHAIN_ROLE.INTERMEDIATE, date: '2022-08-15', label: 'Απόφαση Δ.Σ.' },
        { adam: '24SYMV015482244', role: SYMV_CHAIN_ROLE.SUPPLEMENTARY, date: '2024-09-19', amount: '74.155,85' },
        { adam: '22SYMV011308661', role: SYMV_CHAIN_ROLE.SKIP },
      ],
    };
    const history = buildContractChainHistoryFromSymvPlan(pezonChainRes, plan);
    expect(history.map((h) => h.adam)).toEqual([
      '22SYMV011799800',
      '22SYMV011327633',
      '24SYMV015482244',
    ]);
    expect(history[1].label).toBe('Απόφαση Δ.Σ.');
    expect(history[1].kind).toBe('other');
  });
});
