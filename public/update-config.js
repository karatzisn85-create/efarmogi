/**
 * ERGOHUB - Dropbox Auto-Update Configuration
 */

const VERSION_JSON_URL = 'https://www.dropbox.com/scl/fi/m4vwvkrleksetnbxu5lwm/version.json?rlkey=gsauoyjibr5w7nokezq7isy68&dl=1';

const UPDATE_CONFIG = {
  VERSION_JSON_URL,
  CHECK_TIMEOUT: 10000,
  DOWNLOAD_TIMEOUT: 300000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
  CHECK_ON_STARTUP: true,
  CHECK_INTERVAL: 3600000,
  STARTUP_CHECK_DELAY_MIN: 3000,
  STARTUP_CHECK_DELAY_MAX: 15000,
  AUTO_DOWNLOAD: true,
  PROMPT_FOR_INSTALL: true,
  SILENT_FAIL: true,
  ALLOWED_ROLES: ['SUPERADMIN', 'ADMIN', 'USER'],
  USE_DOWNLOADS_FOLDER: true,
  TEMP_FOLDER: 'ergohub-updates',
  INSTALLER_NAME: 'ergohub-update.exe',
  DISK_SPACE_BUFFER: 1.2
};

module.exports = { UPDATE_CONFIG };
