/**
 * @jest-environment node
 */

const {
  resolveSupervisorContact,
  resolveSuperAdminReplyTo,
  formatReplyToHeader,
  photoPhasesForCard,
  formatPhotoPhasesPhrase,
  formatPhotoPhasesRequestLines,
  buildPhotoRequestEmailContent,
} = require('../../public/apologismosPhotoRequestEmail');

describe('apologismosPhotoRequestEmail', () => {
  test('resolveSupervisorContact από USER (viewer) με email — για αίτημα φωτογραφιών', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: ['user:viewer1'] },
      [{ username: 'viewer1', role: 'USER', fullName: 'Θεατής Έργου', email: 'viewer@example.com' }]
    );
    expect(contact).toEqual({
      displayName: 'Θεατής Έργου',
      email: 'viewer@example.com',
      username: 'viewer1',
    });
  });

  test('resolveSupervisorContact από ADMIN με email', () => {
    const contact = resolveSupervisorContact(
      { supervisorEngineerIds: ['user:admin1'] },
      [{ username: 'admin1', role: 'ADMIN', fullName: 'Διαχειριστής Α', email: 'admin@example.com' }]
    );
    expect(contact.email).toBe('admin@example.com');
    expect(contact.displayName).toBe('Διαχειριστής Α');
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
    expect(mail.subject).toMatch(/Αίτημα φωτογραφιών/);
    expect(mail.subject).toMatch(/Υποέργο Α/);
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
    expect(mail.html).toMatch(/θα φτάσει στον\/στην/);
    expect(mail.html).toMatch(/Διαχειριστής/);
    expect(mail.html).toMatch(/#1e3a5f/);
    expect(mail.textBody).toMatch(/Μαρία Παπα/);
    expect(mail.textBody).toMatch(/έως 3 φωτογραφίες ανά φάση/);
    expect(mail.textBody).toMatch(/θα φτάσει στον\/στην Διαχειριστής/);
  });

  test('θέμα email περιέχει τίτλο υποέργου για εύκολη αναζήτηση', () => {
    const mail = buildPhotoRequestEmailContent({
      supervisorDisplayName: 'Ναυσικά',
      periodLabel: 'Δημοτική περίοδος 2024–2028',
      subprojectTitle: 'ΒΕΛΤΙΩΣΗ ΑΓΡΟΤΙΚΟΥ ΔΡΟΜΟΥ ΠΕΡΙΟΧΗΣ ΜΠΟΤΖΗ',
      phases: ['before', 'after'],
    });
    expect(mail.subject).toBe(
      'Αίτημα φωτογραφιών — ΒΕΛΤΙΩΣΗ ΑΓΡΟΤΙΚΟΥ ΔΡΟΜΟΥ ΠΕΡΙΟΧΗΣ ΜΠΟΤΖΗ'
    );
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
    expect(mail.textBody).toMatch(/υπεύθυνο του αιτήματος/);
  });

  test('resolveSuperAdminReplyTo προτεραιότητα στον acting SUPERADMIN', () => {
    const users = [
      { username: 'other', role: 'SUPERADMIN', email: 'other@example.com', fullName: 'Άλλος', active: true },
      { username: 'boss', role: 'SUPERADMIN', email: 'boss@example.com', fullName: 'Κύριος', active: true },
      { username: 'eng', role: 'ENGINEER', email: 'eng@example.com', fullName: 'Μηχανικός', active: true },
    ];
    expect(resolveSuperAdminReplyTo(users, 'boss')).toEqual({
      email: 'boss@example.com',
      displayName: 'Κύριος',
    });
  });

  test('resolveSuperAdminReplyTo fallback στον πρώτο ενεργό SUPERADMIN με email', () => {
    const users = [
      { username: 'noMail', role: 'SUPERADMIN', email: '', fullName: 'Χωρίς', active: true },
      { username: 'inactive', role: 'SUPERADMIN', email: 'old@example.com', fullName: 'Παλιός', active: false },
      { username: 'admin', role: 'ADMIN', email: 'admin@example.com', fullName: 'Admin', active: true },
      { username: 'sa2', role: 'SUPERADMIN', email: 'sa2@example.com', fullName: 'Δεύτερος', active: true },
    ];
    expect(resolveSuperAdminReplyTo(users, 'noMail')).toEqual({
      email: 'sa2@example.com',
      displayName: 'Δεύτερος',
    });
    expect(resolveSuperAdminReplyTo(users, 'missing')).toEqual({
      email: 'sa2@example.com',
      displayName: 'Δεύτερος',
    });
  });

  test('όνομα στο κείμενο πρέπει να ταιριάζει με Reply-To σε fallback', () => {
    const users = [
      { username: 'noMail', role: 'SUPERADMIN', email: '', fullName: 'Χωρίς Email', active: true },
      { username: 'sa2', role: 'SUPERADMIN', email: 'sa2@example.com', fullName: 'Δεύτερος', active: true },
    ];
    const reply = resolveSuperAdminReplyTo(users, 'noMail');
    const mail = buildPhotoRequestEmailContent({
      supervisorDisplayName: 'Επιβλέπων',
      periodLabel: '2024–2028',
      subprojectTitle: 'Υποέργο',
      phases: ['before', 'after'],
      senderDisplayName: reply.displayName,
    });
    expect(mail.textBody).toMatch(/θα φτάσει στον\/στην Δεύτερος/);
    expect(mail.textBody).not.toMatch(/Χωρίς Email/);
  });

  test('resolveSuperAdminReplyTo χωρίς email → null', () => {
    expect(resolveSuperAdminReplyTo([
      { username: 'sa', role: 'SUPERADMIN', email: 'όχι-email', fullName: 'Χ', active: true },
    ], 'sa')).toBeNull();
    expect(resolveSuperAdminReplyTo([], 'sa')).toBeNull();
  });

  test('formatReplyToHeader', () => {
    expect(formatReplyToHeader({ email: 'a@b.com', displayName: 'Άννα' })).toBe('"Άννα" <a@b.com>');
    expect(formatReplyToHeader({ email: 'a@b.com' })).toBe('a@b.com');
    expect(formatReplyToHeader({ email: '' })).toBe('');
  });
});
