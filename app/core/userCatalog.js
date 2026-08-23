/**
 * Διαχείριση χρηστών: ορατότητα οθόνης, νέα εγγραφή, έγκριση, διαγραφή.
 * Ίδιες αποφάσεις με τη φόρμα και την αποθήκευση.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubUserCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MIN_PASSWORD_LENGTH = 8;
  var VALID_ROLES = ['SUPERADMIN', 'ADMIN', 'USER', 'ENGINEER'];
  var SELF_REGISTER_ROLES = ['ADMIN', 'USER'];
  var FORM_CREATE_ROLES = ['USER', 'ADMIN', 'ENGINEER'];

  function showUserManagementButton(userRole) {
    return userRole === 'SUPERADMIN';
  }

  function usernameExists(users, username) {
    var needle = String(username || '').trim().toLowerCase();
    if (!needle) return false;
    return (users || []).some(function (u) {
      return String((u && u.username) || '').toLowerCase() === needle;
    });
  }

  function validatePasswordLength(password, options) {
    var opts = options || {};
    var p = String(password || '');
    if (p.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: opts.editing
          ? 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον ' + MIN_PASSWORD_LENGTH + ' χαρακτήρες'
          : 'Ο κωδικός πρέπει να έχει τουλάχιστον ' + MIN_PASSWORD_LENGTH + ' χαρακτήρες'
      };
    }
    return { ok: true };
  }

  function collectCreateUserRequiredErrors(formData, options) {
    var fd = formData || {};
    var isEdit = !!(options && options.isEdit);
    var errors = {};
    if (!isEdit && !String(fd.username || '').trim()) {
      errors.username = 'Εισάγετε όνομα χρήστη';
    }
    if (isEdit) {
      if (fd.password && String(fd.password).length < MIN_PASSWORD_LENGTH) {
        errors.password = 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον ' + MIN_PASSWORD_LENGTH + ' χαρακτήρες';
      }
    } else if (!fd.password || String(fd.password).length < MIN_PASSWORD_LENGTH) {
      errors.password = 'Ο κωδικός πρέπει να έχει τουλάχιστον ' + MIN_PASSWORD_LENGTH + ' χαρακτήρες';
    }
    return errors;
  }

  function firstCreateUserError(errors) {
    var e = errors || {};
    return e.username || e.password || '';
  }

  function newUserStartsApproved(role) {
    return role === 'SUPERADMIN';
  }

  function evaluateCreateUser(input) {
    var opts = input || {};
    var noUsersYet = !!opts.noUsersYet;
    if (!noUsersYet && !opts.actorIsSuperAdmin) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χρηστών' };
    }
    var formErrors = collectCreateUserRequiredErrors({
      username: opts.username,
      password: opts.password
    }, { isEdit: false });
    var first = firstCreateUserError(formErrors);
    if (first) return { ok: false, error: first };
    if (usernameExists(opts.users, opts.username)) {
      return { ok: false, error: 'Το όνομα χρήστη υπάρχει ήδη' };
    }
    if (VALID_ROLES.indexOf(opts.role) === -1) {
      return { ok: false, error: 'Μη έγκυρος ρόλος' };
    }
    if (noUsersYet && opts.role !== 'SUPERADMIN') {
      return { ok: false, error: 'Ο πρώτος λογαριασμός πρέπει να είναι Υπερδιαχειριστής' };
    }
    return { ok: true };
  }

  function sanitizeLoginUser(user) {
    if (!user) return null;
    return {
      username: user.username,
      role: user.role,
      fullName: user.fullName || user.username,
      assignedSupervisors: Array.isArray(user.assignedSupervisors) ? user.assignedSupervisors : []
    };
  }

  function evaluateAuthenticate(input) {
    var opts = input || {};
    var needle = String(opts.username || '').trim().toLowerCase();
    var password = opts.password;
    var list = opts.users || [];
    var verify = typeof opts.verifyPassword === 'function'
      ? opts.verifyPassword
      : function (plain, hash) { return String(plain || '') === String(hash || ''); };
    var found = null;
    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      if (!u) continue;
      if (String(u.username || '').toLowerCase() !== needle) continue;
      if (u.active === false) continue;
      if (!verify(password, u.passwordHash)) continue;
      found = u;
      break;
    }
    if (!found) {
      return { ok: false, success: false, error: 'Λάθος όνομα χρήστη ή κωδικός' };
    }
    if (found.approved === false) {
      return {
        ok: false,
        success: false,
        error: 'Ο λογαριασμός σας αναμένει έγκριση από τον διαχειριστή'
      };
    }
    return { ok: true, success: true, user: sanitizeLoginUser(found) };
  }

  function evaluateRegisterUser(input) {
    var opts = input || {};
    if (usernameExists(opts.users, opts.username)) {
      return { ok: false, error: 'Το όνομα χρήστη υπάρχει ήδη' };
    }
    if (SELF_REGISTER_ROLES.indexOf(opts.role) === -1) {
      return { ok: false, error: 'Μη έγκυρος ρόλος' };
    }
    var policy = validatePasswordLength(opts.password);
    if (!policy.ok) return policy;
    return { ok: true };
  }

  function evaluateDeleteUser(input) {
    var opts = input || {};
    if (!opts.actorIsSuperAdmin) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα διαγραφής χρηστών' };
    }
    if (!opts.target) {
      return { ok: false, error: 'Χρήστης δεν βρέθηκε' };
    }
    var superadmins = (opts.users || []).filter(function (u) {
      return u && u.role === 'SUPERADMIN' && u.active !== false;
    });
    if (opts.target.role === 'SUPERADMIN' && superadmins.length <= 1) {
      return { ok: false, error: 'Δεν μπορεί να διαγραφεί ο τελευταίος SUPERADMIN' };
    }
    return { ok: true };
  }

  function showUserEditAction(target) {
    return !!(target && target.role !== 'SUPERADMIN');
  }

  function showUserDeleteAction(currentUsername, target) {
    if (!target) return false;
    return target.username !== currentUsername && target.role !== 'SUPERADMIN';
  }

  function partitionUsersByApproval(users) {
    var pending = [];
    var approved = [];
    (users || []).forEach(function (u) {
      if (!u.approved) pending.push(u);
      else approved.push(u);
    });
    return { pending: pending, approved: approved };
  }

  function approveUserInList(users, username) {
    var needle = String(username || '').toLowerCase();
    return (users || []).map(function (u) {
      if (String((u && u.username) || '').toLowerCase() !== needle) return u;
      var next = {};
      Object.keys(u).forEach(function (k) { next[k] = u[k]; });
      next.approved = true;
      return next;
    });
  }

  function removeUserFromList(users, username) {
    var needle = String(username || '').toLowerCase();
    return (users || []).filter(function (u) {
      return String((u && u.username) || '').toLowerCase() !== needle;
    });
  }

  return {
    MIN_PASSWORD_LENGTH: MIN_PASSWORD_LENGTH,
    VALID_ROLES: VALID_ROLES,
    SELF_REGISTER_ROLES: SELF_REGISTER_ROLES,
    FORM_CREATE_ROLES: FORM_CREATE_ROLES,
    showUserManagementButton: showUserManagementButton,
    usernameExists: usernameExists,
    validatePasswordLength: validatePasswordLength,
    collectCreateUserRequiredErrors: collectCreateUserRequiredErrors,
    firstCreateUserError: firstCreateUserError,
    newUserStartsApproved: newUserStartsApproved,
    evaluateCreateUser: evaluateCreateUser,
    evaluateAuthenticate: evaluateAuthenticate,
    sanitizeLoginUser: sanitizeLoginUser,
    evaluateRegisterUser: evaluateRegisterUser,
    evaluateDeleteUser: evaluateDeleteUser,
    showUserEditAction: showUserEditAction,
    showUserDeleteAction: showUserDeleteAction,
    partitionUsersByApproval: partitionUsersByApproval,
    approveUserInList: approveUserInList,
    removeUserFromList: removeUserFromList
  };
});
