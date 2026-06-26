/**
 * @jest-environment node
 */
import {
  inferImplementationFormFromChainResult,
  prepareFormForInferredImplementationForm,
} from './khmdhsImplementationFormInference';

describe('khmdhsImplementationFormInference', () => {
  test('linear chain → Μια Σύμβαση', () => {
    const chainRes = {
      success: true,
      chainMeta: {
        hasParallelContracts: false,
        parallelContracts: ['25SYMV001'],
      },
    };
    expect(inferImplementationFormFromChainResult(chainRes)).toBe('Μια Σύμβαση');
  });

  test('2+ SYMV στην αλυσίδα → null (αναμένεται SymvChainPlanner)', () => {
    const chainRes = {
      success: true,
      contract: { adam: '25SYMV002' },
      chainMeta: {
        seedAdam: '25SYMV002',
        hasParallelContracts: true,
        parallelContracts: ['25SYMV001', '25SYMV002', '25SYMV003'],
      },
    };
    expect(inferImplementationFormFromChainResult(chainRes)).toBeNull();

    const { form, inferredForm } = prepareFormForInferredImplementationForm(
      { implementationForm: '', contracts: [] },
      chainRes,
      { contractIndex: -1 }
    );
    expect(inferredForm).toBeNull();
    expect(form.implementationForm).toBe('');
    expect(form.contracts).toHaveLength(0);
  });

  test('upgrades Μια → Πολλές only when single SYMV in chain meta', () => {
    const chainRes = {
      success: true,
      contract: { adam: 'A' },
      chainMeta: { hasParallelContracts: true, parallelContracts: ['A'], seedAdam: 'A' },
    };
    const twoParallel = {
      success: true,
      contract: { adam: 'A' },
      chainMeta: {
        hasParallelContracts: true,
        parallelContracts: ['A', 'B'],
        contractSnapshotsByAdam: {
          A: { title: 'Σύμβαση Α', referenceNumber: 'A' },
          B: { title: 'Σύμβαση Β', referenceNumber: 'B' },
        },
      },
    };
    expect(inferImplementationFormFromChainResult(twoParallel)).toBeNull();

    const { inferredForm, form } = prepareFormForInferredImplementationForm(
      { implementationForm: 'Μια Σύμβαση', contracts: [] },
      twoParallel
    );
    expect(inferredForm).toBeNull();
    expect(form.implementationForm).toBe('Μια Σύμβαση');
  });

  test('does not downgrade Πολλές → Μια automatically', () => {
    const chainRes = {
      success: true,
      chainMeta: { hasParallelContracts: false, parallelContracts: ['A'] },
    };
    const { inferredForm } = prepareFormForInferredImplementationForm(
      { implementationForm: 'Πολλές Συμβάσεις', contracts: [{ khmdhsAdam: 'A' }] },
      chainRes
    );
    expect(inferredForm).toBeNull();
  });

  test('user-selected branch → Μια Σύμβαση despite parallel siblings', () => {
    const chainRes = {
      success: true,
      contract: { adam: '25SYMV002' },
      chainMeta: {
        seedAdam: '25SYMV002',
        hasParallelContracts: true,
        parallelContracts: ['25SYMV001', '25SYMV002'],
      },
    };
    expect(inferImplementationFormFromChainResult(chainRes, { userSelectedBranch: true }))
      .toBe('Μια Σύμβαση');

    const { inferredForm, form } = prepareFormForInferredImplementationForm(
      { implementationForm: '', contracts: [] },
      chainRes,
      { contractIndex: -1, userSelectedBranch: true }
    );
    expect(inferredForm).toBe('Μια Σύμβαση');
    expect(form.implementationForm).toBe('Μια Σύμβαση');
    expect(form.contracts).toHaveLength(0);
  });

  test('skips parallel bootstrap when symv plan already on form', () => {
    const chainRes = {
      success: true,
      chainMeta: {
        parallelContracts: ['A', 'B', 'C'],
        contractSnapshotsByAdam: {
          A: { title: 'A' },
          B: { title: 'B' },
          C: { title: 'C' },
        },
      },
    };
    const { form } = prepareFormForInferredImplementationForm(
      {
        implementationForm: 'Μια Σύμβαση',
        khmdhsSymvChainPlan: { items: [{ adam: 'A', role: 'main' }] },
        contracts: [],
      },
      chainRes
    );
    expect(form.contracts).toHaveLength(0);
    expect(form.implementationForm).toBe('Μια Σύμβαση');
  });
});
