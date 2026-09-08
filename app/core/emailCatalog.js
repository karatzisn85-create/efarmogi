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

  function userHasUsableEmail(user) {
    var email = user && user.email ? String(user.email).trim() : '';
    return email.indexOf('@') !== -1;
  }

  function getWorkspaceRecipientEmails(task, allUsers, options) {
    var opts = options || {};
    var exclude = {};
    (opts.excludeUsernames || []).forEach(function (x) {
      exclude[String(x || '').toLowerCase()] = true;
    });
    var names = opts.onlyUsernames
      ? (opts.onlyUsernames || [])
      : [task && task.createdBy].concat((task && task.assignees) || []);
    var emails = [];
    var seen = {};
    (names || []).forEach(function (username) {
      var key = String(username || '').toLowerCase();
      if (!key || exclude[key]) return;
      var user = (allUsers || []).find(function (u) {
        return u && String(u.username || '').toLowerCase() === key;
      });
      if (!userHasUsableEmail(user)) return;
      var email = String(user.email).trim();
      var ek = email.toLowerCase();
      if (seen[ek]) return;
      seen[ek] = true;
      emails.push(email);
    });
    return emails;
  }

  function evaluateWorkspaceCreatedEmail(input) {
    var opts = input || {};
    if (!isEmailConfigured(opts.config)) {
      return { send: false, reason: 'not-configured' };
    }
    if (opts.emailEnabled !== true) {
      return { send: false, reason: 'workspace-off' };
    }
    return { send: true };
  }

  function planWorkspaceCreatedEmail(input) {
    var opts = input || {};
    var gate = evaluateWorkspaceCreatedEmail(opts);
    if (!gate.send) return gate;
    var exclude = opts.excludeUsernames;
    if (!exclude || !exclude.length) {
      exclude = opts.task && opts.task.createdBy ? [opts.task.createdBy] : [];
    }
    var recipients = getWorkspaceRecipientEmails(opts.task || {}, opts.users || [], {
      excludeUsernames: exclude,
      onlyUsernames: opts.onlyUsernames
    });
    if (!recipients.length) {
      return { send: false, reason: 'no-recipients', recipients: [] };
    }
    return { send: true, recipients: recipients };
  }

  function workspaceEmailUserMessage(result, kind) {
    var k = kind || 'created';
    var savedWord = k === 'invite' ? 'Οι συνάδελφοι προστέθηκαν' : 'Ο χώρος αποθηκεύτηκε';
    if (!result) return null;
    if (result.skipped) {
      var reason = String(result.reason || '');
      if (/ανενεργές|workspace-off/i.test(reason)) {
        return { type: 'info', text: savedWord + ' χωρίς αποστολή email (οι ειδοποιήσεις είναι κλειστές).' };
      }
      if (/ρυθμιστεί|not-configured/i.test(reason)) {
        return { type: 'warning', text: savedWord + ', αλλά το email του συστήματος δεν είναι ρυθμισμένο.' };
      }
      if (/παραληπτ|no-recipients/i.test(reason)) {
        return {
          type: 'warning',
          text: savedWord + ', αλλά κανείς από τους συναδέλφους δεν έχει email στο προφίλ του.'
        };
      }
      if (/Rate limit/i.test(reason)) return null;
      return { type: 'warning', text: savedWord + '. Το email δεν στάλθηκε.' };
    }
    if (result.success) {
      var n = typeof result.sentCount === 'number' ? result.sentCount : (result.sentTo || []).length;
      if (n <= 1) return { type: 'success', text: 'Στάλθηκε email στον συνάδελφο.' };
      return { type: 'success', text: 'Στάλθηκε email σε ' + n + ' συναδέλφους.' };
    }
    var err = String(result.error || '').trim();
    var fail = savedWord + ', αλλά η αποστολή email απέτυχε.';
    if (/διαβαστεί|DECRYPT/i.test(err)) {
      return {
        type: 'warning',
        text: fail + ' Ξαναεισάγετε τον κωδικό στις ρυθμίσεις email.'
      };
    }
    return { type: 'warning', text: fail };
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
    userHasUsableEmail: userHasUsableEmail,
    getWorkspaceRecipientEmails: getWorkspaceRecipientEmails,
    evaluateWorkspaceCreatedEmail: evaluateWorkspaceCreatedEmail,
    planWorkspaceCreatedEmail: planWorkspaceCreatedEmail,
    workspaceEmailUserMessage: workspaceEmailUserMessage,
    evaluateCalendarReminderRecipients: evaluateCalendarReminderRecipients,
    evaluateAepoReminderRecipients: evaluateAepoReminderRecipients
  };
});
