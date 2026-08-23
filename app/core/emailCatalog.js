/**
 * Email και ειδοποιήσεις: ποιος ανοίγει ρυθμίσεις / κέντρο / ιστορικό,
 * αποθήκευση SMTP χωρίς αποκάλυψη κωδικού, απόφαση αποστολής χώρου.
 * Χωρίς εγγραφή στον δίσκο και χωρίς πραγματικό SMTP.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEmailCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function showEmailSettingsButton(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canSaveEmailConfig(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canTestEmailConfig(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function canOpenNotificationCenter(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  }

  function canOpenEmailHistory(userRole) {
    return canOpenNotificationCenter(userRole);
  }

  function normalizeGmailUser(raw) {
    var u = String(raw || '').trim().toLowerCase();
    if (!u) return '';
    if (u.indexOf('@') === -1) u += '@gmail.com';
    return u;
  }

  function isEmailConfigured(config) {
    var g = (config && config.gmail) || {};
    return !!(g.user && (g.appPasswordSet || g.appPassword));
  }

  function sanitizeEmailConfigForClient(config) {
    var g = (config && config.gmail) || {};
    return {
      gmail: {
        user: g.user || '',
        fromName: g.fromName || 'ergoHub',
        appPasswordSet: !!(g.appPassword || g.appPasswordSet)
      }
    };
  }

  function evaluateSaveEmailConfig(input) {
    var opts = input || {};
    if (!canSaveEmailConfig(opts.role)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα αποθήκευσης ρυθμίσεων email.' };
    }
    var user = normalizeGmailUser(opts.gmailUser);
    if (!user) {
      return { ok: false, error: 'Εισάγετε Gmail διεύθυνση (π.χ. ergohubapp@gmail.com)' };
    }
    if (user.slice(-10) !== '@gmail.com') {
      return { ok: false, error: 'Χρησιμοποιήστε διεύθυνση @gmail.com' };
    }
    if (!opts.appPassword && !opts.appPasswordSet) {
      return { ok: false, error: 'Απαιτείται App Password' };
    }
    return { ok: true, gmailUser: user };
  }

  function evaluateTestEmail(input) {
    var opts = input || {};
    if (!canTestEmailConfig(opts.role)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα δοκιμαστικής αποστολής.' };
    }
    if (!isEmailConfigured(opts.config)) {
      return { ok: false, error: 'Δεν έχουν οριστεί ρυθμίσεις email' };
    }
    return {
      ok: true,
      simulated: true,
      message: 'Η δοκιμαστική αποστολή προσομοιώθηκε. Δεν στάλθηκε πραγματικό μήνυμα.'
    };
  }

  function showWorkspaceEmailToggle(input) {
    var opts = input || {};
    return !!(opts.isAssigner && isEmailConfigured(opts.config));
  }

  function evaluateWorkspaceCreatedEmail(input) {
    var opts = input || {};
    if (!isEmailConfigured(opts.config)) {
      return { send: false, reason: 'not-configured' };
    }
    if (opts.emailEnabled === false) {
      return { send: false, reason: 'workspace-off' };
    }
    return { send: true };
  }

  function evaluateCalendarReminderRecipients(input) {
    var opts = input || {};
    if (opts.calendarRemindersEnabled === false) return [];
    return (opts.users || []).filter(function (u) {
      if (!u || u.active === false || u.approved === false) return false;
      var prefs = u.notificationPreferences || {};
      if (prefs.calendarEmail === false) return false;
      return u.role === 'ADMIN' || u.role === 'SUPERADMIN' || u.role === 'ENGINEER';
    });
  }

  function evaluateAepoReminderRecipients(input) {
    var opts = input || {};
    return (opts.users || []).filter(function (u) {
      if (!u || u.active === false || u.approved === false) return false;
      var prefs = u.notificationPreferences || {};
      if (prefs.aepoEmail === false) return false;
      return u.role === 'ADMIN' || u.role === 'SUPERADMIN';
    });
  }

  return {
    showEmailSettingsButton: showEmailSettingsButton,
    canSaveEmailConfig: canSaveEmailConfig,
    canTestEmailConfig: canTestEmailConfig,
    canOpenNotificationCenter: canOpenNotificationCenter,
    canOpenEmailHistory: canOpenEmailHistory,
    normalizeGmailUser: normalizeGmailUser,
    isEmailConfigured: isEmailConfigured,
    sanitizeEmailConfigForClient: sanitizeEmailConfigForClient,
    evaluateSaveEmailConfig: evaluateSaveEmailConfig,
    evaluateTestEmail: evaluateTestEmail,
    showWorkspaceEmailToggle: showWorkspaceEmailToggle,
    evaluateWorkspaceCreatedEmail: evaluateWorkspaceCreatedEmail,
    evaluateCalendarReminderRecipients: evaluateCalendarReminderRecipients,
    evaluateAepoReminderRecipients: evaluateAepoReminderRecipients
  };
});
