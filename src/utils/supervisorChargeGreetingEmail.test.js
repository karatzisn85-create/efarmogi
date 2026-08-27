/**
 * @jest-environment node
 */

const {
  catalogChargeEntries,
  planFirstCatalogChargeGreeting,
  shouldSendChargeGreetingEmail,
  buildChargeGreetingEmailContent,
  resolveChargeGreetingReplyTo,
  notifyFirstSupervisorCharge,
} = require('../../public/supervisorChargeGreetingEmail');

const users = [
  { username: 'maria', fullName: 'Μαρία Παπαδοπούλου', email: 'maria@example.com', role: 'ENGINEER', active: true },
  { username: 'nikos', fullName: 'Νίκος Γεωργίου', email: 'nikos@example.com', role: 'ENGINEER', active: true },
  { username: 'elena', fullName: 'Ελένη Αντωνίου', email: '', role: 'ENGINEER', active: true },
  { username: 'boss', fullName: 'Υπερδιαχειριστής', email: 'boss@example.com', role: 'SUPERADMIN', active: true },
];

const chargedProject = {
  projectTitle: 'Ανάπλαση πλατείας',
  subprojectTitle: 'Κατεδαφίσεις ΔΕ Ν. Καζαντζάκη',
  kaCode: '30.7336.0001',
  projectStatus: 'Εκτελούμενο',
  implementationForm: 'Δημόσιο έργο',
  contractAmount: '18.600,00',
  contractDate: '2025-03-12',
  khmdhsAdam: '25SYMV016948065',
  khmdhsContractSnapshot: { anadoxosName: 'Τεχνική ΑΕ' },
  supervisorEngineerIds: ['user:maria', 'user:nikos'],
};

describe('shouldSendChargeGreetingEmail', () => {
  test('χωρίς κουτάκι → καμία αποστολή, ακόμη και σε πρώτη χρέωση', () => {
    const plan = shouldSendChargeGreetingEmail(false, {}, chargedProject);
    expect(plan.notify).toBe(false);
    expect(plan.recipients).toEqual([]);
  });

  test('με κουτάκι και πρώτη χρέωση → αποστολή', () => {
    const plan = shouldSendChargeGreetingEmail(true, { supervisorEngineerIds: [] }, chargedProject);
    expect(plan.notify).toBe(true);
    expect(plan.recipients).toHaveLength(2);
  });

  test('με κουτάκι στέλνει και αν είχε ήδη χρέωση (επανάληψη στην ίδια συνεδρία)', () => {
    const plan = shouldSendChargeGreetingEmail(
      true,
      { supervisorEngineerIds: ['user:maria'] },
      chargedProject
    );
    expect(plan.notify).toBe(true);
    expect(plan.recipients).toHaveLength(2);
  });

  test('με κουτάκι αλλά χωρίς μηχανικό καταλόγου → καμία αποστολή', () => {
    const plan = shouldSendChargeGreetingEmail(true, {}, { supervisorEngineerIds: [] });
    expect(plan.notify).toBe(false);
  });
});

describe('planFirstCatalogChargeGreeting', () => {
  test('νέο υποέργο με χρέωση καταλόγου → ενημέρωση κύριου και βοηθού', () => {
    const plan = planFirstCatalogChargeGreeting({}, chargedProject);
    expect(plan.notify).toBe(true);
    expect(plan.recipients).toEqual([
      { username: 'maria', role: 'primary' },
      { username: 'nikos', role: 'assistant' },
    ]);
  });

  test('υπάρχον αχρέωτο που παίρνει πρώτη χρέωση → ενημέρωση', () => {
    const plan = planFirstCatalogChargeGreeting(
      { supervisorEngineerIds: [] },
      { supervisorEngineerIds: ['user:maria'] }
    );
    expect(plan.notify).toBe(true);
    expect(plan.recipients).toEqual([{ username: 'maria', role: 'primary' }]);
  });

  test('υπάρχουσα χρέωση καταλόγου → καμία ενημέρωση, ούτε με νέο βοηθό', () => {
    const plan = planFirstCatalogChargeGreeting(
      { supervisorEngineerIds: ['user:maria'] },
      { supervisorEngineerIds: ['user:maria', 'user:nikos'] }
    );
    expect(plan.notify).toBe(false);
    expect(plan.recipients).toEqual([]);
  });

  test('ελεύθερη χρέωση χωρίς λογαριασμό → καμία ενημέρωση', () => {
    const plan = planFirstCatalogChargeGreeting(
      { supervisorEngineerIds: [] },
      {
        supervisorEngineerIds: [],
        supervisorChargeFreePrimary: 'Εξωτερικός επιβλέπων',
      }
    );
    expect(plan.notify).toBe(false);
  });

  test('αφαίρεση χρέωσης → καμία ενημέρωση', () => {
    const plan = planFirstCatalogChargeGreeting(
      { supervisorEngineerIds: ['user:maria'] },
      { supervisorEngineerIds: [] }
    );
    expect(plan.notify).toBe(false);
  });
});

describe('catalogChargeEntries', () => {
  test('αγνοεί ελεύθερα ονόματα χωρίς user: prefix', () => {
    expect(catalogChargeEntries({
      supervisorEngineerIds: ['Εξωτερικός Σύμβουλος', 'user:maria'],
    })).toEqual([{ username: 'maria', role: 'assistant' }]);
  });
});

describe('buildChargeGreetingEmailContent', () => {
  const team = { primaryName: 'Μαρία Παπαδοπούλου', assistantNames: ['Νίκος Γεωργίου'] };

  test('επίσημο κείμενο με στοιχεία υποέργου και εμφάνιση στον λογαριασμό — κύριος', () => {
    const mail = buildChargeGreetingEmailContent({
      recipientDisplayName: 'Μαρία Παπαδοπούλου',
      recipientRole: 'primary',
      project: chargedProject,
      team,
      actorDisplayName: 'Υπερδιαχειριστής',
    });
    expect(mail.subject).toBe('Χρέωση επίβλεψης — Κατεδαφίσεις ΔΕ Ν. Καζαντζάκη');
    expect(mail.textBody).toMatch(/Αγαπητέ\/ή κ\. Μαρία Παπαδοπούλου/);
    expect(mail.textBody).toMatch(/Σας χρεώθηκε η επίβλεψη του παρακάτω υποέργου, με ρόλο Κύριος επιβλέπων/);
    expect(mail.textBody).not.toMatch(/Δεν είστε ο επιβλέπων/);
    expect(mail.textBody).toMatch(/Πράξη: Ανάπλαση πλατείας/);
    expect(mail.textBody).toMatch(/Υποέργο: Κατεδαφίσεις ΔΕ Ν\. Καζαντζάκη/);
    expect(mail.textBody).toMatch(/Κ\.Α\.: 30\.7336\.0001/);
    expect(mail.textBody).toMatch(/Κατάσταση: Εκτελούμενο/);
    expect(mail.textBody).toMatch(/Μορφή υλοποίησης: Δημόσιο έργο/);
    expect(mail.textBody).toMatch(/Ποσό σύμβασης: 18\.600,00 €/);
    expect(mail.textBody).toMatch(/Ημ\. σύμβασης: 12\/03\/2025/);
    expect(mail.textBody).toMatch(/Ανάδοχος: Τεχνική ΑΕ/);
    expect(mail.textBody).toMatch(/ΑΔΑΜ σύμβασης: 25SYMV016948065/);
    expect(mail.textBody).toMatch(/Κύριος επιβλέπων: Μαρία Παπαδοπούλου/);
    expect(mail.textBody).toMatch(/Βοηθός μηχανικός: Νίκος Γεωργίου/);
    expect(mail.textBody).toMatch(/Καταχώριση από: Υπερδιαχειριστής/);
    expect(mail.textBody).toMatch(/εμφανίζεται πλέον στον λογαριασμό σας στην εφαρμογή ERGOHUB/);
    expect(mail.html).toMatch(/Κύριος επιβλέπων/);
    expect(mail.html).toMatch(/εμφανίζεται πλέον στον λογαριασμό σας/);
  });

  test('ξεχωριστό μήνυμα στον βοηθό: δεν είναι επιβλέπων, συμμετοχή σε διαδικασία', () => {
    const mail = buildChargeGreetingEmailContent({
      recipientDisplayName: 'Νίκος Γεωργίου',
      recipientRole: 'assistant',
      project: chargedProject,
      team,
      actorDisplayName: 'Υπερδιαχειριστής',
    });
    expect(mail.subject).toBe('Συμμετοχή σε υποέργο — Κατεδαφίσεις ΔΕ Ν. Καζαντζάκη');
    expect(mail.textBody).toMatch(/Αγαπητέ\/ή κ\. Νίκος Γεωργίου/);
    expect(mail.textBody).toMatch(/χαρακτηρισμό «Βοηθός μηχανικός»/);
    expect(mail.textBody).toMatch(/Δεν είστε ο επιβλέπων ή η επιβλέπουσα του υποέργου/);
    expect(mail.textBody).toMatch(/συμμετοχής σας σε διαδικασία που το αφορά/);
    expect(mail.textBody).not.toMatch(/Σας χρεώθηκε η επίβλεψη/);
    expect(mail.textBody).toMatch(/Κύριος επιβλέπων: Μαρία Παπαδοπούλου/);
    expect(mail.textBody).toMatch(/Υποέργο: Κατεδαφίσεις ΔΕ Ν\. Καζαντζάκη/);
    expect(mail.textBody).toMatch(/εμφανίζεται πλέον στον λογαριασμό σας/);
    expect(mail.html).toMatch(/Σαφής επισήμανση/);
    expect(mail.html).toMatch(/Δεν είστε ο επιβλέπων ή η επιβλέπουσα/);
  });

  test('παραλείπει κενά στοιχεία υποέργου', () => {
    const mail = buildChargeGreetingEmailContent({
      recipientDisplayName: 'Μαρία Παπαδοπούλου',
      recipientRole: 'primary',
      project: { subprojectTitle: 'Μόνο τίτλος', supervisorEngineerIds: ['user:maria'] },
      team: { primaryName: 'Μαρία Παπαδοπούλου', assistantNames: [] },
    });
    expect(mail.textBody).not.toMatch(/Κ\.Α\.:/);
    expect(mail.textBody).not.toMatch(/Ανάδοχος:/);
    expect(mail.textBody).not.toMatch(/Ποσό σύμβασης:/);
    expect(mail.textBody).toMatch(/Υποέργο: Μόνο τίτλος/);
  });

  test('δεν εμφανίζει την αναθέτουσα αρχή ως ανάδοχο', () => {
    const mail = buildChargeGreetingEmailContent({
      recipientDisplayName: 'Μαρία Παπαδοπούλου',
      recipientRole: 'primary',
      project: {
        subprojectTitle: 'Έργο',
        khmdhsContractSnapshot: { organization: 'Δήμος Αρχανών-Αστερούσιων' },
      },
      team: { primaryName: 'Μαρία Παπαδοπούλου', assistantNames: [] },
    });
    expect(mail.textBody).not.toMatch(/Ανάδοχος:/);
  });

  test('δεν εμφανίζει ΑΔΑΜ αιτήματος ως ΑΔΑΜ σύμβασης', () => {
    const mail = buildChargeGreetingEmailContent({
      recipientDisplayName: 'Μαρία Παπαδοπούλου',
      recipientRole: 'primary',
      project: { subprojectTitle: 'Έργο', khmdhsAdam: '25REQ016832258' },
      team: { primaryName: 'Μαρία Παπαδοπούλου', assistantNames: [] },
    });
    expect(mail.textBody).not.toMatch(/ΑΔΑΜ σύμβασης:/);
  });
});

describe('resolveChargeGreetingReplyTo', () => {
  test('προτιμά το email του ενεργούντος', () => {
    expect(resolveChargeGreetingReplyTo(users, users[3])).toEqual({
      email: 'boss@example.com',
      displayName: 'Υπερδιαχειριστής',
    });
  });

  test('χωρίς email ενεργούντος → SUPERADMIN', () => {
    expect(resolveChargeGreetingReplyTo(users, { username: 'admin', email: '', role: 'ADMIN' })).toEqual({
      email: 'boss@example.com',
      displayName: 'Υπερδιαχειριστής',
    });
  });
});

describe('notifyFirstSupervisorCharge', () => {
  test('στέλνει σε κύριο και βοηθό, ίδια ομάδα, χωρίς αναδρομικά', async () => {
    const sent = [];
    const result = await notifyFirstSupervisorCharge({
      previousProject: { supervisorEngineerIds: [] },
      nextProject: chargedProject,
      users,
      actor: users[3],
      dataDir: '/tmp',
      sendFn: async (payload) => {
        sent.push(payload);
        return { success: true };
      },
    });
    expect(result.attempted).toBe(true);
    expect(result.sentNames).toEqual(['Μαρία Παπαδοπούλου', 'Νίκος Γεωργίου']);
    expect(sent).toHaveLength(2);
    expect(sent[0].subject).toMatch(/^Χρέωση επίβλεψης/);
    expect(sent[0].textBody).toMatch(/Κύριος επιβλέπων/);
    expect(sent[0].textBody).not.toMatch(/Δεν είστε ο επιβλέπων/);
    expect(sent[1].subject).toMatch(/^Συμμετοχή σε υποέργο/);
    expect(sent[1].textBody).toMatch(/Δεν είστε ο επιβλέπων ή η επιβλέπουσα/);
    expect(sent[1].textBody).not.toMatch(/Σας χρεώθηκε η επίβλεψη/);
    expect(sent[0].replyTo).toEqual({
      email: 'boss@example.com',
      displayName: 'Υπερδιαχειριστής',
    });
  });

  test('με ρητό αίτημα στέλνει και σε υποέργο που είχε ήδη χρέωση', async () => {
    const sendFn = jest.fn(async () => ({ success: true }));
    const result = await notifyFirstSupervisorCharge({
      previousProject: { supervisorEngineerIds: ['user:maria'] },
      nextProject: chargedProject,
      users,
      sendFn,
    });
    expect(result.attempted).toBe(true);
    expect(sendFn).toHaveBeenCalled();
  });

  test('χωρίς μηχανικό καταλόγου δεν στέλνει', async () => {
    const sendFn = jest.fn();
    const result = await notifyFirstSupervisorCharge({
      previousProject: {},
      nextProject: { supervisorEngineerIds: [] },
      users,
      sendFn,
    });
    expect(result.attempted).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  test('παραλείπει λογαριασμό χωρίς email', async () => {
    const sent = [];
    const result = await notifyFirstSupervisorCharge({
      previousProject: {},
      nextProject: { ...chargedProject, supervisorEngineerIds: ['user:elena'] },
      users,
      sendFn: async (payload) => {
        sent.push(payload);
        return { success: true };
      },
    });
    expect(result.attempted).toBe(true);
    expect(result.sentNames).toEqual([]);
    expect(result.skippedNoEmailNames).toEqual(['Ελένη Αντωνίου']);
    expect(sent).toHaveLength(0);
  });
});
