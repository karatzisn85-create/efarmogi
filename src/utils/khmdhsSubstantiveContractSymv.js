/**
 * Αναγνώριση πρακτικών SYMV που δεν είναι πραγματικές συμβάσεις — sync με public/khmdhsParallelContracts.js
 */

const RE_NON_CONTRACT_SYMV_TITLE = /διακήρυξη|διακηρυξη|προκήρυξη|προκηρυξη|απόφαση|αποφαση|δημοτικη\s*επιτροπ|δημοτική\s*επιτροπ|έγκριση\s+πρακτικ|εγκριση\s+πρακτικ|πρακτικ[οα]?\s+διαγωνισμ/i;

export function isSubstantiveContractSymvSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return true;
  const title = String(snapshot.title || '').trim();
  if (!title) return true;
  if (RE_NON_CONTRACT_SYMV_TITLE.test(title)) return false;
  return true;
}

export function nonContractSymvReason(snapshot) {
  if (!snapshot || isSubstantiveContractSymvSnapshot(snapshot)) return '';
  const title = String(snapshot.title || '').trim().toUpperCase();
  if (/διακήρυξη|διακηρυξη/.test(title)) return 'Διακήρυξη (όχι σύμβαση)';
  if (/προκήρυξη|προκηρυξη/.test(title)) return 'Προκήρυξη (όχι σύμβαση)';
  if (/απόφαση|αποφαση|επιτροπ|πρακτικ/.test(title)) return 'Απόφαση / πρακτικό (όχι σύμβαση)';
  return 'Δεν φαίνεται σύμβαση από τον τίτλο ΚΗΜΔΗΣ';
}
