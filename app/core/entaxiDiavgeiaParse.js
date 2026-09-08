/**
 * Ανάγνωση απόφασης ένταξης από θέμα Διαύγειας και κείμενο PDF (πρότυπο ΟΠΣ-ΕΠΑ).
 * Δεν μαντεύει ημερομηνίες από τον κανόνα 18/20 μηνών.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEntaxiDiavgeiaParse = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizePdfText(text) {
    return String(text || '')
      .replace(/\|/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeSubject(subject) {
    return String(subject || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseGreekDateToIso(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
    var greek = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
    if (!greek) return '';
    var dd = greek[1].padStart(2, '0');
    var mm = greek[2].padStart(2, '0');
    var yyyy = greek[3].length === 2 ? ('20' + greek[3]) : greek[3];
    var month = Number(mm);
    var day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return yyyy + '-' + mm + '-' + dd;
  }

  function subjectLooksLikeEntaxiModification(subject) {
    return /τροποπο[ίι]ηση/i.test(String(subject || ''));
  }

  function extractOpsCodeFromText(text) {
    var s = normalizePdfText(text);
    var mis = s.match(/Πράξης\s*\/\s*MIS\s*\(\s*ΟΠΣ\s*\)\s*:?\s*(\d{6,8})/iu);
    if (mis) return mis[1];
    var coded = s.match(/Κωδικ(?:ός|ό)\s+ΟΠΣ[:\s]*(\d{6,8})/iu);
    if (coded) return coded[1];
    var header = s.match(/Κωδικός\s+ΟΠΣ\s*:?\s*(\d{6,8})/iu);
    return header ? header[1] : '';
  }

  function extractProjectTitleFromSubject(subject) {
    var s = normalizeSubject(subject);
    var m = s.match(/Πράξης\s*[«"]([^»"]+)[»"]/iu);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function extractProgrammeFromSubject(subject) {
    var s = normalizeSubject(subject);
    var m = s.match(/(?:^|[\s,·])στο\s*[«"]([^»"]+)[»"]/iu);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function cutBeforeDecisionBody(text) {
    var s = String(text || '');
    var stop = s.search(/\s+(?:ΑΠΟΦΑΣΗ|Έχοντας\s+υπόψη)(?=\s|$)/iu);
    return (stop > 0 ? s.slice(0, stop) : s).trim();
  }

  function extractModificationDescriptionFromSubject(subject) {
    var s = normalizeSubject(subject);
    if (!s || !subjectLooksLikeEntaxiModification(s)) return '';
    return cutBeforeDecisionBody(s);
  }

  function parseEntaxiSubject(subject) {
    var clean = normalizeSubject(subject);
    return {
      kind: subjectLooksLikeEntaxiModification(clean) ? 'modification' : 'new',
      subject: clean,
      projectTitle: extractProjectTitleFromSubject(clean),
      opsCode: extractOpsCodeFromText(clean),
      programme: extractProgrammeFromSubject(clean),
      modificationDescription: extractModificationDescriptionFromSubject(clean)
    };
  }

  function extractAxisFromText(normalized) {
    var m = normalized.match(/Άξονα\s+Προτεραιότητας\s*[«"]([^»"]+)[»"]/iu);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function extractBeneficiaryFromText(normalized) {
    var m = normalized.match(
      /(?:2|3)\.?\s*Δικαιούχος\s*:\s*(.+?)(?=\s*(?:3|4)\.?\s*Κωδικός\s+Δικαιούχου|\s*Κωδικός\s+Δικαιούχου|\s*(?:4|5)\.?\s*Φυσικό)/iu
    );
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function extractAmountFromText(normalized) {
    var patterns = [
      /ΣΥΝΟΛΙΚΗ\s+ΔΗΜΟΣΙΑ\s+ΔΑΠΑΝΗ[^0-9]{0,80}(\d{1,3}(?:\.\d{3})*,\d{2})/iu,
      /ΣΥΝΟΛΙΚΟ\s+ΚΟΣΤΟΣ\s+ΠΡΑΞΗΣ[^0-9]{0,24}(\d{1,3}(?:\.\d{3})*,\d{2})/iu
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var m = normalized.match(patterns[i]);
      if (m && m[1] && m[1] !== '0,00') return m[1];
    }
    return '';
  }

  function documentSaysNoObligationDeadline(normalized) {
    return /δεν\s+υπάρχει\s+προθεσμία\s+ανάληψης\s+υποχρέωσης/iu.test(normalized);
  }

  function extractLegalCommitmentDeadline(normalized) {
    var patterns = [
      /ανάληψη\s+της\s+νομικής\s+δέσμευσης[\s\S]{0,160}?(?:έως|μέχρι)\.?\s*(?:τις\s+|την\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu,
      /προθεσμία\s+ανάληψης\s+(?:της\s+)?(?:νομικής\s+δέσμευσης|υποχρέωσης)[\s\S]{0,160}?(?:έως|μέχρι)\.?\s*(?:τις\s+|την\s+)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var m = normalized.match(patterns[i]);
      if (m) return parseGreekDateToIso(m[1]);
    }
    return '';
  }

  function extractOpsScheduleDate(normalized, kind) {
    var word = kind === 'end' ? 'λήξης' : 'έναρξης';
    var m = normalized.match(
      new RegExp(
        'ημερομηνία\\s+' + word + '\\s+της\\s+Πράξης\\s+ορίζεται\\s+η\\s+'
        + '(\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{2,4})',
        'iu'
      )
    );
    return m ? parseGreekDateToIso(String(m[1]).replace(/\s+/g, '')) : '';
  }

  function extractStartDate(normalized) {
    return extractOpsScheduleDate(normalized, 'start');
  }

  function extractEndDate(normalized) {
    return extractOpsScheduleDate(normalized, 'end');
  }

  function extractDocumentDateFromHeader(normalized) {
    var m = normalized.match(/[Α-ΩΆ-Ώ]{3,},\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/u);
    return m ? parseGreekDateToIso(m[1]) : '';
  }

  function extractSubjectFromPdfText(normalized) {
    var m = normalized.match(/ΘΕΜΑ\s*:\s*(.+)/iu);
    if (!m) return '';
    var after = m[1];
    var stop = after.search(
      /\s+(?:ΑΠΟΦΑΣΗ|Ο\s+ΠΕΡΙΦΕΡΕΙΑΡΧΗΣ|Έχοντας\s+υπόψη|στον\s+Άξονα\s+Προτεραιότητας|\d+\.\s*Η\s+ημερομηνία\s+έναρξης|ΚΑΤΑΝΟΜΗ\s+ΚΟΣΤΟΥΣ)(?=\s|$)/iu
    );
    var body = (stop >= 0 ? after.slice(0, stop) : after).replace(/\s+/g, ' ').trim();
    if (stop < 0) {
      if (!/^(?:Ένταξη|Τροποποίηση)/iu.test(body)) return '';
      if (body.length > 450) body = body.slice(0, 450).trim();
    }
    return body;
  }

  function parseEntaxiPdfText(pdfText) {
    var normalized = normalizePdfText(pdfText);
    if (!normalized) {
      return {
        opsCode: '',
        beneficiary: '',
        axis: '',
        startDate: '',
        endDate: '',
        legalCommitmentDeadline: '',
        noObligationDeadline: false,
        initialAmount: '',
        documentDate: '',
        subject: '',
        foundAny: false
      };
    }
    var parsed = {
      opsCode: extractOpsCodeFromText(normalized),
      beneficiary: extractBeneficiaryFromText(normalized),
      axis: extractAxisFromText(normalized),
      startDate: extractStartDate(normalized),
      endDate: extractEndDate(normalized),
      legalCommitmentDeadline: extractLegalCommitmentDeadline(normalized),
      noObligationDeadline: documentSaysNoObligationDeadline(normalized),
      initialAmount: extractAmountFromText(normalized),
      documentDate: extractDocumentDateFromHeader(normalized),
      subject: extractSubjectFromPdfText(normalized)
    };
    parsed.foundAny = !!(
      parsed.opsCode
      || parsed.legalCommitmentDeadline
      || parsed.initialAmount
      || parsed.startDate
      || parsed.endDate
      || parsed.beneficiary
      || parsed.noObligationDeadline
      || parsed.subject
    );
    return parsed;
  }

  function firstFilled() {
    for (var i = 0; i < arguments.length; i += 1) {
      var v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  }

  function parseEntaxiDiavgeiaDocument(input) {
    var src = input || {};
    var fromCard = parseEntaxiSubject(src.subject);
    var fromPdf = parseEntaxiPdfText(src.pdfText);
    var fromPdfSubject = parseEntaxiSubject(fromPdf.subject || '');
    var chosen = fromPdf.subject ? fromPdfSubject : fromCard;
    var subjectOps = fromCard.opsCode || '';
    var pdfOps = fromPdf.opsCode || fromPdfSubject.opsCode || '';
    var opsMismatch = !!(subjectOps && pdfOps && subjectOps !== pdfOps);
    var subjectMismatch = !!(fromCard.subject && fromPdf.subject && fromCard.subject !== fromPdf.subject);
    var legalCommitmentStatus = fromPdf.legalCommitmentDeadline
      ? 'found'
      : (fromPdf.noObligationDeadline ? 'explicitly_absent' : (fromPdf.foundAny ? 'missing' : 'unread'));
    return {
      kind: chosen.kind,
      subject: firstFilled(fromPdf.subject, fromCard.subject),
      cardSubject: fromCard.subject,
      pdfSubject: fromPdf.subject || '',
      subjectMismatch: subjectMismatch,
      projectTitle: chosen.projectTitle,
      programme: chosen.programme,
      modificationDescription: firstFilled(
        extractModificationDescriptionFromSubject(fromPdf.subject),
        extractModificationDescriptionFromSubject(fromCard.subject)
      ),
      opsCode: firstFilled(fromPdf.opsCode, fromCard.opsCode),
      subjectOpsCode: subjectOps,
      pdfOpsCode: pdfOps,
      opsMismatch: opsMismatch,
      beneficiary: fromPdf.beneficiary,
      axis: fromPdf.axis,
      startDate: fromPdf.startDate,
      endDate: fromPdf.endDate,
      legalCommitmentDeadline: fromPdf.legalCommitmentDeadline,
      legalCommitmentStatus: legalCommitmentStatus,
      noObligationDeadline: !!fromPdf.noObligationDeadline,
      initialAmount: fromPdf.initialAmount,
      documentDate: fromPdf.documentDate,
      pdfFoundAny: fromPdf.foundAny
    };
  }

  function modificationSortKey(mod) {
    var iso = parseGreekDateToIso((mod && (mod.date || mod.documentDate)) || '');
    if (iso) return iso;
    var created = String((mod && mod.createdAt) || '');
    return parseGreekDateToIso(created) || created;
  }

  function getEffectiveEntaxiFieldDate(entaxi, fieldName) {
    if (!entaxi) return '';
    var deadline = parseGreekDateToIso(entaxi[fieldName] || '');
    var mods = Array.isArray(entaxi.modifications) ? entaxi.modifications.slice() : [];
    mods.sort(function (a, b) {
      return modificationSortKey(a).localeCompare(modificationSortKey(b));
    });
    for (var i = 0; i < mods.length; i += 1) {
      var next = parseGreekDateToIso(mods[i] && mods[i][fieldName]);
      if (next) deadline = next;
    }
    return deadline;
  }

  function getEffectiveEntaxiNodeDeadline(entaxi) {
    return getEffectiveEntaxiFieldDate(entaxi, 'legalCommitmentDeadline');
  }

  function getEffectiveEntaxiEndDate(entaxi) {
    return getEffectiveEntaxiFieldDate(entaxi, 'endDate');
  }

  return {
    normalizePdfText: normalizePdfText,
    parseGreekDateToIso: parseGreekDateToIso,
    subjectLooksLikeEntaxiModification: subjectLooksLikeEntaxiModification,
    extractOpsCodeFromText: extractOpsCodeFromText,
    extractProjectTitleFromSubject: extractProjectTitleFromSubject,
    extractProgrammeFromSubject: extractProgrammeFromSubject,
    extractSubjectFromPdfText: extractSubjectFromPdfText,
    extractModificationDescriptionFromSubject: extractModificationDescriptionFromSubject,
    parseEntaxiSubject: parseEntaxiSubject,
    parseEntaxiPdfText: parseEntaxiPdfText,
    parseEntaxiDiavgeiaDocument: parseEntaxiDiavgeiaDocument,
    documentSaysNoObligationDeadline: documentSaysNoObligationDeadline,
    getEffectiveEntaxiNodeDeadline: getEffectiveEntaxiNodeDeadline,
    getEffectiveEntaxiEndDate: getEffectiveEntaxiEndDate
  };
});
