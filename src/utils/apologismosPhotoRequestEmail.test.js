/**
 * @jest-environment node
 */

const {
  resolveSupervisorContact,
  photoPhasesForCard,
  formatPhotoPhasesPhrase,
  formatPhotoPhasesRequestLines,
  buildPhotoRequestEmailContent,
} = require('../../public/apologismosPhotoRequestEmail');

describe('apologismosPhotoRequestEmail', () => {
  test('resolveSupervisorContact από user: id με email', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: ['user:maria'] },
      [{ username: 'maria', fullName: 'Μαρία Παπα', email: 'maria@example.com' }]
    );
    expect(contact).toEqual({
      displayName: 'Μαρία Παπα',
      email: 'maria@example.com',
      username: 'maria',
    });
  });

  test('resolveSupervisorContact χωρίς email', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: ['user:nikos'] },
      [{ username: 'nikos', fullName: 'Νίκος', email: '' }]
    );
    expect(contact.displayName).toBe('Νίκος');
    expect(contact.email).toBe('');
  });

  test('resolveSupervisorContact ελεύθερο όνομα', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: [], supervisorChargeFreePrimary: 'Εξωτερικός επιβλέπων' },
      []
    );
    expect(contact).toEqual({
      displayName: 'Εξωτερικός επιβλέπων',
      email: '',
      username: '',
    });
  });

  test('resolveSupervisorContact χρησιμοποιεί μόνο τον κύριο, όχι συμμετέχοντα', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: ['user:missing', 'user:nikos'] },
      [{ username: 'nikos', fullName: 'Νίκος', email: 'nikos@example.com' }]
    );
    expect(contact).toBeNull();
  });

  test('resolveSupervisorContact κύριος λείπει → ελεύθερο όνομα, όχι συμμετέχων', () => {
    const contact = resolveSupervisorContact(
      {
        supervisorEngineerIds: ['user:missing', 'user:nikos'],
        supervisorChargeFreePrimary: 'Εξωτερικός',
      },
      [{ username: 'nikos', fullName: 'Νίκος', email: 'nikos@example.com' }]
    );
    expect(contact).toEqual({
      displayName: 'Εξωτερικός',
      email: '',
      username: '',
    });
  });

  test('photoPhasesForCard από τρόπους προβολής', () => {
    expect(photoPhasesForCard({
      primaryViz: 'before_after',
      secondaryViz: '',
    })).toEqual(['before', 'after']);
    expect(photoPhasesForCard({
      primaryViz: 'before_during_after',
    })).toEqual(['before', 'during', 'after']);
    expect(photoPhasesForCard({
      primaryViz: 'map_path',
    })).toEqual([]);
  });

  test('formatPhotoPhasesPhrase', () => {
    expect(formatPhotoPhasesPhrase(['before', 'after'])).toBe('«Πριν» και «Μετά»');
    expect(formatPhotoPhasesPhrase(['before', 'during', 'after']))
      .toBe('«Πριν», «Κατά τη διάρκεια» και «Μετά»');
  });

  test('formatPhotoPhasesRequestLines ζητά έως 3 φωτογραφίες ανά φάση', () => {
    const two = formatPhotoPhasesRequestLines(['before', 'after']);
    expect(two.maxPerPhase).toBe(3);
    expect(two.summary).toMatch(/Πριν/);
    expect(two.summary).toMatch(/Μετά/);
    expect(two.bullets).toEqual([
      'Φάση «Πριν»: έως 3 φωτογραφίες',
      'Φάση «Μετά»: έως 3 φωτογραφίες',
    ]);

    const three = formatPhotoPhasesRequestLines(['before', 'during', 'after']);
    expect(three.bullets).toHaveLength(3);
    expect(three.bullets[1]).toMatch(/Κατά τη διάρκεια/);
    expect(three.bullets.every((b) => /έως 3 φωτογραφίες/.test(b))).toBe(true);
  });

  test('buildPhotoRequestEmailContent περιέχει περίοδο, φάσεις και ERGOHUB', () => {
    const mail = buildPhotoRequestEmailContent({
      supervisorDisplayName: 'Μαρία Παπα',
      periodLabel: '2024–2028',
      projectTitle: 'Πράξη δοκιμής',
      subprojectTitle: 'Υποέργο Α',
      phases: ['before', 'after'],
      optionalDeadline: '20/08/2026',
      optionalNote: 'Παρακαλώ καθαρή λήψη.',
      senderDisplayName: 'Διαχειριστής',
      senderOrg: 'Δήμος Δοκιμής',
    });
    expect(mail.subject).toMatch(/Απολογισμό Τεχνικού Έργου/);
    expect(mail.subject).toMatch(/2024–2028/);
    expect(mail.html).toMatch(/Απολογισμού Τεχνικού Έργου/);
    expect(mail.html).toMatch(/Υποέργο Α/);
    expect(mail.html).toMatch(/Πριν/);
    expect(mail.html).toMatch(/Μετά/);
    expect(mail.html).toMatch(/έως 3 φωτογραφίες ανά φάση/);
    expect(mail.html).toMatch(/Φάση «Πριν»: έως 3 φωτογραφίες/);
    expect(mail.html).toMatch(/20\/08\/2026/);
    expect(mail.html).toMatch(/Παρακαλώ καθαρή λήψη/);
    expect(mail.html).toMatch(/ERGOHUB/);
    expect(mail.html).toMatch(/συνημμένα/);
    expect(mail.textBody).toMatch(/Μαρία Παπα/);
    expect(mail.textBody).toMatch(/έως 3 φωτογραφίες ανά φάση/);
  });

  test('buildPhotoRequestEmailContent πριν/κατά/μετά', () => {
    const mail = buildPhotoRequestEmailContent({
      supervisorDisplayName: 'Νίκος',
      periodLabel: '2024–2028',
      subprojectTitle: 'Υποέργο Β',
      phases: ['before', 'during', 'after'],
    });
    expect(mail.html).toMatch(/Κατά τη διάρκεια/);
    expect(mail.html).toMatch(/Φάση «Κατά τη διάρκεια»: έως 3 φωτογραφίες/);
    expect(mail.textBody).toMatch(/έως 3 φωτογραφίες/);
  });
});
