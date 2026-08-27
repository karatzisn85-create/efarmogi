/**
 * @jest-environment node
 */
import {
  SYMV_CHAIN_ROLE,
  collectSymvChainDocuments,
  buildDefaultSymvChainPlan,
  validateSymvChainPlan,
  mergeExistingSymvPlanOntoChain,
  resolveReusableSymvChainPlan,
  inferDefaultSymvRole,
  symvPlanMatchesChain,
  mergeStitchChainResForSymvPlan,
  resolveReusablePlanForKhmdhsRefresh,
  needsSymvPlannerAfterKhmdhsRefresh,
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

  it('preserves prior skip roles when chain gains a new SYMV', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
        { adam: '22SYMV011327633', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '22SYMV011308661', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '24SYMV015482244', role: SYMV_CHAIN_ROLE.SUPPLEMENTARY, date: '2024-09-19', amount: '74.155,85' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const extendedChain = {
      ...pezonChainRes,
      contractChainHistory: [
        ...pezonChainRes.contractChainHistory,
        { adam: '25SYMV099999999', label: 'Ορθή επανάληψη παράτασης' },
      ],
      chainMeta: {
        ...pezonChainRes.chainMeta,
        contractSnapshotsByAdam: {
          ...pezonChainRes.chainMeta.contractSnapshotsByAdam,
          '25SYMV099999999': {
            title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΠΑΡΑΤΑΣΗΣ',
            referenceNumber: '25SYMV099999999',
            contractSignedDate: '2025-01-10',
          },
        },
      },
    };
    expect(symvPlanMatchesChain(existingPlan, extendedChain)).toBe(false);
    const merged = mergeExistingSymvPlanOntoChain(existingPlan, extendedChain);
    const byAdam = Object.fromEntries(merged.items.map((i) => [i.adam, i.role]));
    expect(byAdam['22SYMV011327633']).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(byAdam['22SYMV011308661']).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(byAdam['22SYMV011799800']).toBe(SYMV_CHAIN_ROLE.MAIN);
    expect(byAdam['24SYMV015482244']).toBe(SYMV_CHAIN_ROLE.SUPPLEMENTARY);
    expect(byAdam['25SYMV099999999']).toBe(SYMV_CHAIN_ROLE.EXTENSION);
  });

  it('reuses merged plan when only auto-skipped new docs appear', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
        { adam: '22SYMV011327633', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '22SYMV011308661', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '24SYMV015482244', role: SYMV_CHAIN_ROLE.SUPPLEMENTARY, date: '2024-09-19', amount: '74.155,85' },
      ],
    };
    const withSkippedRepublication = {
      ...pezonChainRes,
      contractChainHistory: [
        ...pezonChainRes.contractChainHistory,
        { adam: '25SYMV088888888', label: 'Ορθή επανάληψη' },
      ],
      chainMeta: {
        ...pezonChainRes.chainMeta,
        contractSnapshotsByAdam: {
          ...pezonChainRes.chainMeta.contractSnapshotsByAdam,
          '25SYMV088888888': {
            title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΑΠΟΦΑΣΗΣ',
            referenceNumber: '25SYMV088888888',
          },
        },
      },
    };
    const reusable = resolveReusableSymvChainPlan(existingPlan, withSkippedRepublication);
    expect(reusable).not.toBeNull();
    expect(reusable.items.find((i) => i.adam === '22SYMV011327633')?.role).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(reusable.items.find((i) => i.adam === '25SYMV088888888')?.role).toBe(SYMV_CHAIN_ROLE.SKIP);
  });

  it('infers republication+extension as extension, not supplementary', () => {
    expect(inferDefaultSymvRole({
      adam: '25SYMV1',
      title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΠΑΡΑΤΑΣΗΣ ΠΡΟΘΕΣΜΙΑΣ',
      historyLabel: '',
    }, pezonChainRes)).toBe(SYMV_CHAIN_ROLE.EXTENSION);
  });

  it('merges SYMV docs from all stitch segments for plan reuse', () => {
    const primary = {
      success: true,
      contract: { adam: '22SYMV011799800' },
      contractChainHistory: [{ adam: '22SYMV011799800', isRoot: true }],
      chainMeta: {
        contractSnapshotsByAdam: {
          '22SYMV011799800': { title: 'ΚΥΡΙΑ', referenceNumber: '22SYMV011799800' },
        },
        parallelContractCandidates: ['22SYMV011799800'],
      },
    };
    const secondary = {
      success: true,
      chainRes: {
        success: true,
        contractChainHistory: [
          { adam: '25SYMV088888888', label: 'Ορθή επανάληψη' },
          { adam: '25SYMV077777777', label: 'Συμπληρωματική σύμβαση' },
        ],
        chainMeta: {
          contractSnapshotsByAdam: {
            '25SYMV088888888': { title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ', referenceNumber: '25SYMV088888888' },
            '25SYMV077777777': {
              title: 'ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ',
              referenceNumber: '25SYMV077777777',
              contractSignedDate: '2025-02-01',
              contractBudget: 1000,
            },
          },
          parallelContractCandidates: ['25SYMV088888888', '25SYMV077777777'],
        },
      },
    };
    const combined = mergeStitchChainResForSymvPlan(primary, [
      { success: true, chainRes: primary, seedAdam: 'A' },
      secondary,
    ]);
    const docs = collectSymvChainDocuments(combined);
    expect(docs.map((d) => d.adam).sort()).toEqual([
      '22SYMV011799800',
      '25SYMV077777777',
      '25SYMV088888888',
    ]);
    // Νέα συμπληρωματική απαιτεί απόφαση — δεν επαναχρησιμοποιείται αυτόματα.
    expect(resolveReusableSymvChainPlan({
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN },
      ],
    }, combined)).toBeNull();
  });

  it('refresh after stitch does not re-ask for a contract already on the card', () => {
    const existingPlan = {
      items: [
        { adam: '24SYMV015890933', role: SYMV_CHAIN_ROLE.MAIN, date: '2025-01-15', amount: '10000' },
        { adam: '25SYMV016155296', role: SYMV_CHAIN_ROLE.PARALLEL, date: '2025-02-15', amount: '2313,20' },
        { adam: '24SYMV999999999', role: SYMV_CHAIN_ROLE.SKIP },
      ],
    };
    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsAdam: '',
      contracts: [
        { khmdhsAdam: '25SYMV016948065' },
        { khmdhsAdam: '24SYMV015890933' },
        { khmdhsAdam: '25SYMV016155296' },
      ],
    };
    const combined = {
      success: true,
      contract: { adam: '24SYMV015890933', snapshot: { referenceNumber: '24SYMV015890933' } },
      contractChainHistory: [
        { adam: '24SYMV015890933', isRoot: true },
        { adam: '25SYMV016155296' },
        { adam: '24SYMV999999999' },
        { adam: '25SYMV016948065' },
      ],
      chainMeta: {
        contractSnapshotsByAdam: {
          '24SYMV015890933': { referenceNumber: '24SYMV015890933', contractSignedDate: '2025-01-15' },
          '25SYMV016155296': { referenceNumber: '25SYMV016155296', contractSignedDate: '2025-02-15' },
          '24SYMV999999999': { referenceNumber: '24SYMV999999999', title: 'ΑΛΛΟ ΤΜΗΜΑ' },
          '25SYMV016948065': { referenceNumber: '25SYMV016948065', contractSignedDate: '2025-06-01' },
        },
        parallelContractCandidates: [
          '24SYMV015890933',
          '25SYMV016155296',
          '24SYMV999999999',
          '25SYMV016948065',
        ],
      },
    };
    const reusable = resolveReusableSymvChainPlan(existingPlan, combined, { form });
    expect(reusable).not.toBeNull();
    expect(needsSymvPlannerAfterKhmdhsRefresh(existingPlan, {
      success: true,
      usesStitchPlan: true,
      chainRes: combined,
      stitchResults: [
        { success: true, seedAdam: '25REQ016832258', chainRes: combined },
      ],
    }, { form })).toBe(false);
  });

  it('card refresh does not re-ask when only auto-skipped docs appear', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
        { adam: '22SYMV011327633', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '22SYMV011308661', role: SYMV_CHAIN_ROLE.SKIP },
        { adam: '24SYMV015482244', role: SYMV_CHAIN_ROLE.SUPPLEMENTARY, date: '2024-09-19', amount: '74.155,85' },
      ],
    };
    const refreshRes = {
      success: true,
      usesStitchPlan: false,
      chainRes: {
        ...pezonChainRes,
        contractChainHistory: [
          ...pezonChainRes.contractChainHistory,
          { adam: '25SYMV088888888', label: 'Ορθή επανάληψη' },
        ],
        chainMeta: {
          ...pezonChainRes.chainMeta,
          contractSnapshotsByAdam: {
            ...pezonChainRes.chainMeta.contractSnapshotsByAdam,
            '25SYMV088888888': {
              title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΑΠΟΦΑΣΗΣ',
              referenceNumber: '25SYMV088888888',
            },
          },
        },
      },
    };
    expect(symvPlanMatchesChain(existingPlan, refreshRes.chainRes)).toBe(false);
    const reusable = resolveReusablePlanForKhmdhsRefresh(existingPlan, refreshRes);
    expect(reusable).not.toBeNull();
    expect(reusable.items.find((i) => i.adam === '22SYMV011327633')?.role).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(reusable.items.find((i) => i.adam === '25SYMV088888888')?.role).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(needsSymvPlannerAfterKhmdhsRefresh(existingPlan, refreshRes)).toBe(false);
  });

  it('card refresh still asks when a new real contract appears', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
      ],
    };
    const refreshRes = {
      success: true,
      usesStitchPlan: false,
      chainRes: {
        ...pezonChainRes,
        contractChainHistory: [
          ...pezonChainRes.contractChainHistory,
          { adam: '25SYMV077777777', label: 'Συμπληρωματική σύμβαση' },
        ],
        chainMeta: {
          ...pezonChainRes.chainMeta,
          contractSnapshotsByAdam: {
            ...pezonChainRes.chainMeta.contractSnapshotsByAdam,
            '25SYMV077777777': {
              title: 'ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ',
              referenceNumber: '25SYMV077777777',
            },
          },
        },
      },
    };
    expect(resolveReusablePlanForKhmdhsRefresh(existingPlan, refreshRes)).toBeNull();
    expect(needsSymvPlannerAfterKhmdhsRefresh(existingPlan, refreshRes)).toBe(true);
  });

  it('card refresh reuses plan when stitch adds only auto-skipped docs', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
      ],
    };
    const primary = {
      success: true,
      contract: { adam: '22SYMV011799800' },
      contractChainHistory: [{ adam: '22SYMV011799800', isRoot: true }],
      chainMeta: {
        contractSnapshotsByAdam: {
          '22SYMV011799800': { title: 'ΚΥΡΙΑ', referenceNumber: '22SYMV011799800' },
        },
        parallelContractCandidates: ['22SYMV011799800'],
      },
    };
    const refreshRes = {
      success: true,
      usesStitchPlan: true,
      chainRes: primary,
      stitchResults: [
        { success: true, chainRes: primary, seedAdam: 'A' },
        {
          success: true,
          seedAdam: 'B',
          chainRes: {
            success: true,
            contractChainHistory: [
              { adam: '25SYMV088888888', label: 'Ορθή επανάληψη' },
            ],
            chainMeta: {
              contractSnapshotsByAdam: {
                '25SYMV088888888': {
                  title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΑΠΟΦΑΣΗΣ',
                  referenceNumber: '25SYMV088888888',
                },
              },
            },
          },
        },
      ],
    };
    const reusable = resolveReusablePlanForKhmdhsRefresh(existingPlan, refreshRes);
    expect(reusable).not.toBeNull();
    expect(reusable.items.find((i) => i.adam === '25SYMV088888888')?.role).toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(needsSymvPlannerAfterKhmdhsRefresh(existingPlan, refreshRes)).toBe(false);
  });
});
