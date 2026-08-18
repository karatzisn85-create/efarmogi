/**
 * Πότε η ενημέρωση ERGOHUB είναι υποχρεωτική.
 * Δεν μπλοκάρει όταν δεν ξέρουμε την τελευταία έκδοση (χωρίς δίκτυο).
 */

const MANDATORY_PATCH_LAG = 3;

const MANDATORY_UPDATE_WRITE_ERROR =
  'Η έκδοση της εφαρμογής είναι παλιά. Εγκαταστήστε την ενημέρωση για να αποθηκεύσετε στα κοινά δεδομένα. Μέχρι τότε μπορείτε να βλέπετε τα έργα, όχι να τα αλλάζετε.';

function parseVersionParts(version) {
  const clean = String(version || '').trim().replace(/^v/i, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10));
  return {
    major: Number.isFinite(parts[0]) ? parts[0] : 0,
    minor: Number.isFinite(parts[1]) ? parts[1] : 0,
    patch: Number.isFinite(parts[2]) ? parts[2] : 0,
  };
}

function isNewerVersion(latest, current) {
  const l = parseVersionParts(latest);
  const c = parseVersionParts(current);
  if (l.major !== c.major) return l.major > c.major;
  if (l.minor !== c.minor) return l.minor > c.minor;
  return l.patch > c.patch;
}

/** Διαφορά patch στην ίδια γραμμή 1.4.x. Άλλη major/minor → μεγάλο άλμα. */
function patchLag(currentVersion, latestVersion) {
  if (!isNewerVersion(latestVersion, currentVersion)) return 0;
  const c = parseVersionParts(currentVersion);
  const l = parseVersionParts(latestVersion);
  if (l.major !== c.major || l.minor !== c.minor) return Number.POSITIVE_INFINITY;
  return l.patch - c.patch;
}

/**
 * @param {string} currentVersion
 * @param {string} latestVersion
 * @param {boolean} [flaggedMandatory] από το version.json στο Dropbox
 */
function isUpdateMandatory(currentVersion, latestVersion, flaggedMandatory = false) {
  if (flaggedMandatory) {
    return isNewerVersion(latestVersion, currentVersion);
  }
  if (!currentVersion || !latestVersion) return false;
  return patchLag(currentVersion, latestVersion) >= MANDATORY_PATCH_LAG;
}

function enrichUpdateCheckResult(updateInfo, currentVersion) {
  if (!updateInfo || updateInfo.error || !updateInfo.available) {
    return updateInfo;
  }
  const latest = updateInfo.version;
  const flaggedMandatory = !!updateInfo.mandatory;
  const lag = patchLag(currentVersion, latest);
  return {
    ...updateInfo,
    flaggedMandatory,
    patchLag: Number.isFinite(lag) ? lag : null,
    mandatory: isUpdateMandatory(currentVersion, latest, flaggedMandatory),
  };
}

module.exports = {
  MANDATORY_PATCH_LAG,
  MANDATORY_UPDATE_WRITE_ERROR,
  parseVersionParts,
  isNewerVersion,
  patchLag,
  isUpdateMandatory,
  enrichUpdateCheckResult,
};
