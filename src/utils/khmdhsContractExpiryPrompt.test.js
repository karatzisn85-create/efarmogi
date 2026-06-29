/**

 * @jest-environment node

 */

import { PROJECT_STATUS_CONTRACT_PROCESS } from '../data/formOptions';

import { PROJECT_STATUS_EXECUTED } from './khmdhsAdamGuidance';

import { formatDateEl } from './dateFormat';

import {

  evaluateKhmdhsContractExpiryPrompt,

  KHMDHS_COMPLETED_STATUS_SUGGESTION,

  buildKhmdhsContractExpiryPromptMessage,

} from './khmdhsContractExpiryPrompt';



function daysAgo(n) {

  const d = new Date();

  d.setDate(d.getDate() - n);

  return d.toISOString().slice(0, 10);

}



function daysAhead(n) {

  const d = new Date();

  d.setDate(d.getDate() + n);

  return d.toISOString().slice(0, 10);

}



describe('evaluateKhmdhsContractExpiryPrompt', () => {

  test('προτείνει ολοκλήρωση όταν η λήξη έχει περάσει', () => {

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: daysAgo(10),

      khmdhsAdam: '24SYMV015347394',

      khmdhsContractSnapshot: { endDate: daysAgo(10) },

    };

    const prompt = evaluateKhmdhsContractExpiryPrompt(form);

    expect(prompt?.suggestedStatus).toBe(KHMDHS_COMPLETED_STATUS_SUGGESTION);

    expect(prompt?.daysPast).toBeGreaterThanOrEqual(10);

  });



  test('προτείνει ολοκλήρωση με ημερομηνία DD/MM/YYYY', () => {

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: formatDateEl(daysAgo(15)),

      khmdhsAdam: '24SYMV015347394',

    };

    const prompt = evaluateKhmdhsContractExpiryPrompt(form);

    expect(prompt?.suggestedStatus).toBe(KHMDHS_COMPLETED_STATUS_SUGGESTION);

    expect(prompt?.daysPast).toBeGreaterThanOrEqual(15);

  });



  test('προτείνει ολοκλήρωση με παράταση στην αλυσίδα', () => {

    const end = daysAgo(5);

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '50.000,00',

      contractEndDate: end,

      khmdhsAdam: '24SYMV000000001',

      khmdhsContractChainHistory: [

        { adam: '24SYMV000000001', isRoot: true, order: 0, endDate: daysAgo(60), kind: 'contract' },

        { adam: '25SYMV000000002', order: 1, endDate: end, kind: 'extension' },

      ],

    };

    const prompt = evaluateKhmdhsContractExpiryPrompt(form);

    expect(prompt).not.toBeNull();

    expect(prompt.hasExtension).toBe(true);

  });



  test('όχι πρόταση αν η λήξη είναι στο μέλλον', () => {

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: daysAhead(30),

      khmdhsAdam: '24SYMV015347394',

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form)).toBeNull();

  });



  test('όχι πρόταση σε ήδη ολοκληρωμένο', () => {

    const form = {

      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: daysAgo(10),

      khmdhsAdam: '24SYMV015347394',

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form)).toBeNull();

  });



  test('όχι πρόταση σε ολοκληρωμένο και αποπληρωμένο', () => {

    const form = {

      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: daysAgo(10),

      khmdhsAdam: '24SYMV015347394',

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form)).toBeNull();

  });



  test('όχι πρόταση αν η κατάσταση πριν την ανάκτηση ήταν ολοκληρωμένη', () => {

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '100.000,00',

      contractEndDate: daysAgo(10),

      khmdhsAdam: '24SYMV015347394',

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form, {

      statusBeforeKhmdhsRefresh: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',

    })).toBeNull();

  });



  test('όχι πρόταση όταν τα εντάλματα καλύπτουν πλήρως το πληρωτέο', () => {

    const end = daysAgo(5);

    const form = {

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '73.656,00',

      contractEndDate: end,

      khmdhsAdam: '24SYMV015347394',

      khmdhsPayments: [

        {

          adam: '24PAY000000001',

          snapshot: {

            referenceNumber: '24PAY000000001',

            organization: 'ΔΗΜΟΣ Α',

            totalCostWithVAT: 73656,

          },

        },

      ],

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form)).toBeNull();

  });



  test('επιτρέπεται σε διαδικασία σύμβασης με υπογεγραμμένη σύμβαση', () => {

    const form = {

      projectStatus: PROJECT_STATUS_CONTRACT_PROCESS,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '80.000,00',

      contractEndDate: daysAgo(3),

      khmdhsAdam: '24SYMV015347394',

    };

    expect(evaluateKhmdhsContractExpiryPrompt(form)?.suggestedStatus)

      .toBe(KHMDHS_COMPLETED_STATUS_SUGGESTION);

  });



  test('μήνυμα περιλαμβάνει ημερομηνία και πρόταση', () => {

    const prompt = evaluateKhmdhsContractExpiryPrompt({

      projectStatus: PROJECT_STATUS_EXECUTED,

      implementationForm: 'Μια Σύμβαση',

      contractAmount: '10.000,00',

      contractEndDate: daysAgo(1),

      khmdhsAdam: '24SYMV015347394',

    });

    const msg = buildKhmdhsContractExpiryPromptMessage(prompt);

    expect(msg).toMatch(/Ολοκληρωμένο/);

    expect(msg).toMatch(/πριν/);

  });

});

