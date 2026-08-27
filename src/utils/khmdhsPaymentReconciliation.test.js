/**
 * @jest-environment node
 */
import { filterUnrelatedPayments } from './khmdhsPaymentReconciliation';

describe('filterUnrelatedPayments', () => {
  test('κόβει εντάλματα ξένης σύμβασης', () => {
    const project = {
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsRequestAdam: '25REQ016832258',
    };
    const kept = filterUnrelatedPayments([
      { adam: '25PAY1', snapshot: { contractRefNo: '25SYMV016948065' } },
      { adam: '24PAYX', snapshot: { contractRefNo: '24SYMV999999999' } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(['25PAY1']);
  });

  test('κρατά ένταλμα του δεύτερου συνδεδεμένου πρωτογενούς χωρίς σύμβαση', () => {
    const project = {
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsAdamChainMeta: {
        linkedAdams: { requests: ['24REQ015252599'] },
        requestSnapshotsByAdam: {
          '24REQ015252599': { referenceNumber: '24REQ015252599' },
        },
      },
    };
    const kept = filterUnrelatedPayments([
      { adam: '24PAY10', snapshot: { requestRefNo: '24REQ015252599' } },
      { adam: '23PAYX', snapshot: { requestRefNo: '23REQ000000001' } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(['24PAY10']);
  });

  test('δεν κόβει ένταλμα δεύτερου αιτήματος επειδή η ημ/νία είναι πριν τη σύμβαση', () => {
    const project = {
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsRequestAdam: '25REQ016832258',
      contractDate: '2025-06-01',
      khmdhsAdamChainMeta: {
        linkedAdams: { requests: ['24REQ015252599'] },
        requestSnapshotsByAdam: {
          '24REQ015252599': { referenceNumber: '24REQ015252599' },
        },
      },
    };
    const kept = filterUnrelatedPayments([
      { adam: '24PAY10', snapshot: { requestRefNo: '24REQ015252599', issueDate: '2024-03-01' } },
      { adam: '23PAYX', snapshot: { requestRefNo: '23REQ000000001', issueDate: '2024-03-01' } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(['24PAY10']);
  });

  test('κόβει εντάλματα τμημάτων που αποκλείστηκαν στην κατανομή ακόμα κι αν μένουν στο ιστορικό', () => {
    const project = {
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsContractChainHistory: [
        { adam: '25SYMV016948065' },
        { adam: '24SYMV999999999' },
      ],
      khmdhsSymvChainPlan: {
        items: [
          { adam: '25SYMV016948065', role: 'main' },
          { adam: '24SYMV999999999', role: 'skip' },
        ],
      },
    };
    const kept = filterUnrelatedPayments([
      { adam: '25PAY1', snapshot: { contractRefNo: '25SYMV016948065' } },
      { adam: '24PAYX', snapshot: { contractRefNo: '24SYMV999999999' } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(['25PAY1']);
  });

  test('κρατά ένταλμα γνωστής παράλληλης σύμβασης ακόμα κι αν η ημ/νία είναι πριν την πρώτη γραμμή', () => {
    const project = {
      contractDate: '2025-06-01',
      khmdhsRequestAdam: '25REQ016832258',
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        {
          khmdhsAdam: '25SYMV016948065',
          date: '2025-06-01',
          khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
        },
        {
          khmdhsAdam: '24SYMV015890933',
          date: '2025-01-15',
          khmdhsContractSnapshot: { referenceNumber: '24SYMV015890933' },
        },
      ],
    };
    const kept = filterUnrelatedPayments([
      { adam: '24PAY10', snapshot: { contractRefNo: '24SYMV015890933', issueDate: '2024-03-01' } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(['24PAY10']);
  });
});
