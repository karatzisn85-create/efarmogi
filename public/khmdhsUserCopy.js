/**
 * Κοινές φράσεις για μηνύματα προς τον χρήστη.
 * Διαχωρισμός: έγγραφο/PDF στον φάκελο ≠ ηλεκτρονική καταχώριση στο ΚΗΜΔΗΣ.
 */

/** Σύντομη υπενθύμιση — για λεζάντες ή bullets */
const ELECTRONIC_VS_PAPER_SHORT =
  'Αφορά τα ηλεκτρονικά δεδομένα του ΚΗΜΔΗΣ, όχι το έντυπο ή το PDF που μπορεί να έχετε εσείς.';

/** Πλήρης εξήγηση για κενά πεδία σε σύμβαση */
const CONTRACT_AMOUNT_GAP_INTRO =
  'Η υπογεγραμμένη σύμβαση στον φάκελό σας πιθανότατα έχει ποσό. Στην ηλεκτρονική καταχώριση της σύμβασης στο ΚΗΜΔΗΣ, όμως, το πεδίο ποσού είναι κενό ή λείπει.';

function khmdhsElectronicGap(fieldWhat) {
  return `Στην ηλεκτρονική καταχώριση στο ΚΗΜΔΗΣ λείπει ${fieldWhat} — το έγγραφό σας μπορεί να το έχει κανονικά.`;
}

function contractAmountFallbackMessage(sourcePhrase) {
  const src = sourcePhrase ? ` ${sourcePhrase}` : ' από συνδεδεμένη πράξη της ίδιας υπόθεσης';
  return `${CONTRACT_AMOUNT_GAP_INTRO} Προτάθηκε ποσό${src} (με ΦΠΑ 24%). Συγκρίνετε με τα έγγραφά σας πριν αποθηκεύσετε.`;
}

function contractAmountSplitContractsMessage(linkedCount, awardAmountFormatted) {
  const n = Number(linkedCount) || 0;
  const countPhrase = n > 1 ? `${n} ξεχωριστές συμβάσεις` : 'πολλές συμβάσεις';
  const awardPhrase = awardAmountFormatted
    ? ` Το συνολικό ποσό της ανάθεσης (${awardAmountFormatted} €) αφορά όλη την υπόθεση, όχι κάθε σύμβαση ξεχωριστά.`
    : '';
  return `${CONTRACT_AMOUNT_GAP_INTRO} Στην ίδια υπόθεση εμφανίζονται ${countPhrase} στο ΚΗΜΔΗΣ — δεν μπορούμε να προτείνουμε αυτόματα ποσό από την ανάθεση.${awardPhrase} Ανοίξτε το PDF της συγκεκριμένης σύμβασης και συμπληρώστε το ποσό χειροκίνητα.`;
}

function contractAmountFallbackWarning(amountFormatted, sourcePhrase) {
  const src = sourcePhrase ? ` ${sourcePhrase}` : '';
  return `${CONTRACT_AMOUNT_GAP_INTRO} Προτάθηκε ${amountFormatted} €${src}. Ελέγξτε με την υπογεγραμμένη σύμβαση.`;
}

function contractAmountFallbackTitle() {
  return 'Λείπει ποσό στην ηλεκτρονική καταχώριση σύμβασης';
}

function incompleteKhmdhsFieldsIntro() {
  return 'Η ανάκτηση ολοκληρώθηκε, αλλά στα ηλεκτρονικά δεδομένα του ΚΗΜΔΗΣ λείπουν ή χρειάζονται έλεγχο ορισμένα πεδία. Μπορεί να τα έχετε ήδη στα έγγραφά σας.';
}

function orphanSymvSeedTitle() {
  return 'Η σύμβαση δεν συνδέεται ηλεκτρονικά με άλλα στάδια';
}

function orphanSymvSeedExplanation() {
  return 'Ο κωδικός που δώσατε ανήκει σε σύμβαση που στο ΚΗΜΔΗΣ εμφανίζεται μόνη της — χωρίς ηλεκτρονικά συνδεδεμένο αίτημα, δημοσίευση ή ανάθεση. Συχνά πρόκειται για συμπληρωματική ή απευθείας ανάθεση που δεν «δέθηκε» με την αρχική αλυσίδα.';
}

function followUpCommitmentNoSupplementaryTitle() {
  return 'Βρέθηκε έγκριση συμπληρωματικής εργασίας — χωρίς ηλεκτρονική σύμβαση';
}

function followUpCommitmentNoSupplementaryExplanation() {
  return 'Στο ΚΗΜΔΗΣ εμφανίζεται εγκεκριμένο αίτημα που προέρχεται από το πρωτογενές, αλλά δεν υπάρχει ηλεκτρονικά συνδεδεμένη σύμβαση γι’ αυτή την πρόσθετη εργασία. Αν έχει υπογραφεί ξεχωριστή συμπληρωματική σύμβαση, δώστε τον κωδικό της παρακάτω — δεν θα χαθούν τα υπόλοιπα στοιχεία της αλυσίδας.';
}

function parallelContractsTitle() {
  return 'Πολλές ανεξάρτητες συμβάσεις στην ίδια υπόθεση';
}

function parallelContractsExplanation(siblingCount) {
  const n = Number(siblingCount) || 0;
  const phrase = n > 1 ? `${n} ξεχωριστές συμβάσεις` : 'πολλές συμβάσεις';
  return `Στην ίδια υπόθεση στο ΚΗΜΔΗΣ εμφανίζονται ${phrase} που δεν είναι τροποποιήσεις μεταξύ τους — συνήθως αφορούν διαφορετικούς αναδόχους ή χωριστά αντικείμενα. Δώστε τον ΑΔΑΜ της σύμβασης που σας ενδιαφέρει, ή χρησιμοποιήστε «Πολλές Συμβάσεις» στο υποέργο.`;
}

module.exports = {
  ELECTRONIC_VS_PAPER_SHORT,
  CONTRACT_AMOUNT_GAP_INTRO,
  khmdhsElectronicGap,
  contractAmountFallbackMessage,
  contractAmountFallbackWarning,
  contractAmountSplitContractsMessage,
  contractAmountFallbackTitle,
  incompleteKhmdhsFieldsIntro,
  orphanSymvSeedTitle,
  orphanSymvSeedExplanation,
  followUpCommitmentNoSupplementaryTitle,
  followUpCommitmentNoSupplementaryExplanation,
  parallelContractsTitle,
  parallelContractsExplanation,
};
