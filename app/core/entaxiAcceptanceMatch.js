/**
 * Αντιστοίχιση ένταξης με υποψήφια αποδοχή χρηματοδότησης / τροποποίηση
 * προϋπολογισμού Δ.Σ. από θέματα Διαύγειας. Χωρίς δίκτυο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEntaxiAcceptanceMatch = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STOP_WORDS = {
    του: true,
    της: true,
    των: true,
    τον: true,
    την: true,
    το: true,
    τα: true,
    στο: true,
    στη: true,
    στον: true,
    στους: true,
    στις: true,
    και: true,
    για: true,
    απο: true,
    με: true,
    σε: true,
    ως: true,
    η: true,
    ο: true,
    οι: true,
    μια: true,
    ενα: true,
    ενος: true,
    δημου: true,
    εργου: true,
    πραξης: true,
    υποεργου: true,
    υποεργων: true,
    αποφαση: true,
    αποφασης: true,
    δημοτικου: true,
    συμβουλιου: true,
    επιτροπης: true,
    οικονομικου: true,
    ετους: true,
    εκτελεση: true,
    χρηματοδοτουμενου: true,
    τροποποιηση: true,
    προϋπολογισμου: true,
    αποδοχη: true,
    χρηματοδοτησης: true,
    μεταβολης: true,
    ενταξη: true,
    κωδικο: true,
    κωδικος: true
  };

  function normalizeAda(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  function normalizeGreek(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ς/g, 'σ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9α-ω\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractQuotedTitle(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/[«"]([^»"]{6,})[»"]/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function extractOpsCode(text) {
    var m = String(text || '').match(/(\d{6,8})/);
    return m ? m[1] : '';
  }

  function significantTokens(text) {
    var raw = normalizeGreek(text).split(' ').filter(function (w) {
      return w.length >= 4 && !STOP_WORDS[w] && !/^\d+$/.test(w);
    });
    var seen = {};
    var out = [];
    raw.forEach(function (w) {
      if (seen[w]) return;
      seen[w] = true;
      out.push(w);
    });
    return out;
  }

  function extractEntaxiTitle(entaxi) {
    var e = entaxi || {};
    var fromSubject = extractQuotedTitle(e.subject);
    if (fromSubject) return fromSubject;
    var fromProject = String(e.projectTitle || '').trim();
    if (fromProject) return fromProject;
    return String(e.subject || '').replace(/\s+/g, ' ').trim();
  }

  function classifyAcceptanceSubject(subject, mode) {
    var n = normalizeGreek(subject);
    if (!n) return '';
    var forModification = mode === 'modification';
    if (/αποδοχη\s+(μεταβολησ\s+)?χρηματοδοτησησ/.test(n)) return 'committee_accept';
    if (/αποδοχη\s+τησ\s+πραξησ\s+χρηματοδοτησησ/.test(n)) return 'committee_accept';
    if (/αποδοχη\s+μεταβολησ(\s+\S+){0,3}\s+χρηματοδοτησησ/.test(n)) return 'committee_accept';
    if (forModification && /αποδοχη(\s+τησ)?\s+τροποποιησησ(\s+πραξησ)?/.test(n)) {
      return 'committee_accept';
    }
    if (/τροποποιηση\s+προ[υϋ]πολογισμ/.test(n) && /χρηματοδοτουμεν/.test(n)) {
      return 'council_budget';
    }
    if (/τροποποιηση\s+προ[υϋ]πολογισμ/.test(n) && /εκτελεση/.test(n) && /εργου/.test(n)) {
      return 'council_budget';
    }
    if (forModification && /τροποποιηση\s+προ[υϋ]πολογισμ/.test(n)
      && /(εκτελεση|υλοποιηση)/.test(n)
      && /(εργου|πραξησ)/.test(n)) {
      return 'council_budget';
    }
    return '';
  }

  function roleLabel(role, mode) {
    if (role === 'council_budget') return 'Απόφαση Δ.Σ. (προϋπολογισμός / ΑΛΕ)';
    if (role === 'committee_accept') {
      return mode === 'modification'
        ? 'Αποδοχή τροποποίησης (Επιτροπή)'
        : 'Αποδοχή χρηματοδότησης (Επιτροπή)';
    }
    return '';
  }

  function titleOverlapScore(entaxiTitle, decisionSubject) {
    var left = significantTokens(entaxiTitle);
    var right = significantTokens(extractQuotedTitle(decisionSubject) || decisionSubject);
    if (!left.length || !right.length) return 0;
    var rightSet = {};
    right.forEach(function (w) { rightSet[w] = true; });
    var hits = 0;
    left.forEach(function (w) {
      if (rightSet[w]) hits += 1;
    });
    return hits / Math.max(left.length, 1);
  }

  function isoDate(value) {
    var s = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return '';
  }

  function scoreAcceptanceCandidate(entaxi, decision, options) {
    var e = entaxi || {};
    var d = decision || {};
    var opts = options && typeof options === 'object' ? options : {};
    var mode = opts.mode === 'modification' ? 'modification' : 'entaxi';
    var subject = String(d.subject || '').trim();
    var reasons = [];
    var score = 0;
    var role = classifyAcceptanceSubject(subject, mode);
    var ops = String(e.opsCode || extractOpsCode(e.subject) || '').trim();
    var decisionOps = extractOpsCode(subject);
    var title = extractEntaxiTitle(e);

    if (ops && (subject.indexOf(ops) !== -1 || decisionOps === ops)) {
      score += 48;
      reasons.push('Ίδιος κωδικός ΟΠΣ');
    }

    if (role === 'council_budget') {
      score += 34;
      reasons.push(roleLabel(role, mode));
    } else if (role === 'committee_accept') {
      score += 26;
      reasons.push(roleLabel(role, mode));
    }

    var overlap = titleOverlapScore(title, subject);
    if (overlap >= 0.34) {
      score += Math.round(overlap * 24);
      reasons.push('Παρόμοιος τίτλος έργου');
    }

    var fromDate = isoDate(opts.fromDate) || isoDate(e.documentDate || e.createdAt);
    var issueDate = isoDate(d.issueDate || d.publishDate);
    if (fromDate && issueDate) {
      if (issueDate >= fromDate) {
        score += 6;
      } else {
        score -= 18;
        reasons.push(mode === 'modification'
          ? 'Ημερομηνία πριν την τροποποίηση'
          : 'Ημερομηνία πριν την ένταξη');
      }
    }

    var keep = !!role && (score >= 36 || (ops && subject.indexOf(ops) !== -1));
    if (!keep && ops && role && score >= 30) keep = true;
    if (!keep && overlap >= 0.5 && role && score >= 32) keep = true;
    if (mode === 'modification' && fromDate && issueDate && issueDate < fromDate) {
      keep = false;
    }

    return {
      ada: normalizeAda(d.ada),
      subject: subject,
      issueDate: issueDate,
      protocolNumber: String(d.protocolNumber || '').trim(),
      organization: String(d.organization || '').trim(),
      documentUrl: String(d.documentUrl || '').trim(),
      role: role,
      roleLabel: roleLabel(role, mode),
      score: score,
      reasons: reasons,
      keep: keep
    };
  }

  function rankAcceptanceCandidates(entaxi, decisions, options) {
    var list = Array.isArray(decisions) ? decisions : [];
    var ranked = list.map(function (d) {
      return scoreAcceptanceCandidate(entaxi, d, options);
    }).filter(function (row) {
      return row.keep && row.ada;
    });
    ranked.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.issueDate || '').localeCompare(String(a.issueDate || ''));
    });
    var seen = {};
    return ranked.filter(function (row) {
      if (seen[row.ada]) return false;
      seen[row.ada] = true;
      return true;
    });
  }

  function buildSearchPhrases(entaxi) {
    var e = entaxi || {};
    var phrases = [];
    var ops = String(e.opsCode || extractOpsCode(e.subject) || '').trim();
    if (ops) phrases.push(ops);
    var title = extractEntaxiTitle(e);
    var tokens = significantTokens(title).slice(0, 3);
    if (tokens.length >= 2) {
      phrases.push(tokens.slice(0, 2).join(' ').toUpperCase());
    } else if (tokens.length === 1 && tokens[0].length >= 6) {
      phrases.push(tokens[0].toUpperCase());
    }
    var seen = {};
    return phrases.filter(function (p) {
      var key = normalizeGreek(p);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  return {
    normalizeAda: normalizeAda,
    normalizeGreek: normalizeGreek,
    extractQuotedTitle: extractQuotedTitle,
    extractEntaxiTitle: extractEntaxiTitle,
    classifyAcceptanceSubject: classifyAcceptanceSubject,
    roleLabel: roleLabel,
    scoreAcceptanceCandidate: scoreAcceptanceCandidate,
    rankAcceptanceCandidates: rankAcceptanceCandidates,
    buildSearchPhrases: buildSearchPhrases
  };
});
