/**
 * Πότε η αποθήκευση ζητά αποστολή ενημέρωσης χρέωσης.
 * Όχι στη μόνη αποθήκευση Φάσης Α — ώστε το μήνυμα να φύγει με τα στοιχεία της Φάσης Β.
 */
export function shouldRequestChargeGreetingOnSave({
  checkboxOn,
  firstChargeEligible,
  outsideCatalog,
  hasCatalogEngineer,
  phaseASaveOnly,
} = {}) {
  return checkboxOn === true
    && firstChargeEligible === true
    && outsideCatalog !== true
    && hasCatalogEngineer === true
    && phaseASaveOnly !== true;
}
