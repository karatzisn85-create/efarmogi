/**
 * Εξαγωγή κωδικού, εύρους Π/Υ και λήξης υποβολής από θέμα / κείμενο PDF πρόσκλησης.
 * Χωρίς δίκτυο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubProsklisiDiavgeiaPdf = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function collapseText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function toIsoDate(day, month, year) {
    var d = String(day || '').padStart(2, '0');
    var m = String(month || '').padStart(2, '0');
    var y = String(year || '');
    if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return '';
    var mm = Number(m);
    var dd = Number(d);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
    return y + '-' + m + '-' + d;
  }

  function extractInvitationCodeFromSubject(subject) {
    var n = collapseText(subject);
    var underscored = n.match(/ΠΡΟΣΚΛΗΣΗ\s+([A-ZΑ-Ω]{2,12}_\d{1,6})/i);
    if (underscored) return underscored[1].toUpperCase();
    return '';
  }

  function extractInvitationCodeFromText(text) {
    var n = collapseText(text);
    var labeled = n.match(/Κωδικός Πρόσκλησης[:\s]+([A-ZΑ-Ω0-9][A-ZΑ-Ω0-9_.\-]{1,24})/i);
    if (labeled) return labeled[1].replace(/[.,;:]+$/, '');
    return extractInvitationCodeFromSubject(n);
  }

  function extractBudgetRangeFromText(text) {
    var n = collapseText(text);
    var min = n.match(/ελάχιστος προϋπολογισμός[^0-9€]{0,90}?([\d.]{3,18},\d{2})\s*€/i);
    if (!min) return '';
    var minLabel = min[1] + '€';
    var maxBlock = n.match(/μέγιστος προϋπολογισμός[\s\S]{0,120}/i);
    if (maxBlock) {
      var block = maxBlock[0];
      if (/δεν\s*αφορά|δεν\s*ορίζεται/i.test(block)) {
        return 'από ' + minLabel;
      }
      var max = block.match(/([\d.]{3,18},\d{2})\s*€/);
      if (max) return minLabel + ' – ' + max[1] + '€';
    }
    return minLabel;
  }

  function extractSubmissionDeadlineFromText(text) {
    var n = collapseText(text);
    var exclusive = n.match(
      /έως,?\s*αποκλειστικά,?\s*την\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s*\(\s*ημερομηνία λήξης υποβολής/i
    );
    if (exclusive) return toIsoDate(exclusive[1], exclusive[2], exclusive[3]);
    var fromTo = n.match(
      /από την\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,120}?έως,?\s*αποκλειστικά,?\s*την\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i
    );
    if (fromTo) return toIsoDate(fromTo[1], fromTo[2], fromTo[3]);
    return '';
  }

  function extractProsklisiFieldsFromPdfText(text) {
    var fields = {};
    var code = extractInvitationCodeFromText(text);
    if (code) fields.code = code;
    var budget = extractBudgetRangeFromText(text);
    if (budget) fields.budgetRange = budget;
    var deadline = extractSubmissionDeadlineFromText(text);
    if (deadline) fields.deadline = deadline;
    return fields;
  }

  function mergeProsklisiExtractedFields(baseFields, extraFields) {
    var out = baseFields && typeof baseFields === 'object' ? Object.assign({}, baseFields) : {};
    var extra = extraFields && typeof extraFields === 'object' ? extraFields : {};
    ['code', 'budgetRange', 'deadline'].forEach(function (key) {
      if (!out[key] && extra[key]) out[key] = extra[key];
    });
    return out;
  }

  return {
    collapseText: collapseText,
    extractInvitationCodeFromSubject: extractInvitationCodeFromSubject,
    extractInvitationCodeFromText: extractInvitationCodeFromText,
    extractBudgetRangeFromText: extractBudgetRangeFromText,
    extractSubmissionDeadlineFromText: extractSubmissionDeadlineFromText,
    extractProsklisiFieldsFromPdfText: extractProsklisiFieldsFromPdfText,
    mergeProsklisiExtractedFields: mergeProsklisiExtractedFields
  };
});
