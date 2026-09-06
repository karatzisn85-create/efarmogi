'use strict';

const fs = require('fs');
const path = require('path');

const GREEK_DICT_FILENAME = 'el-GR-3-0.bdic';
const GREEK_LANG_CODES = ['el-GR', 'el'];

let lastEnableResult = null;
let dictionaryReady = false;

function resolveBundledGreekDictionary(roots) {
  const dirs = Array.isArray(roots) ? roots : [];
  for (const dir of dirs) {
    if (!dir) continue;
    const fp = path.join(dir, GREEK_DICT_FILENAME);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

function defaultDictionarySearchRoots() {
  return [
    path.join(__dirname, 'dictionaries'),
    process.resourcesPath ? path.join(process.resourcesPath, 'dictionaries') : '',
  ];
}

function installBundledGreekDictionary(userDataPath, bundledPath) {
  const src = bundledPath || resolveBundledGreekDictionary(defaultDictionarySearchRoots());
  if (!userDataPath || !src || !fs.existsSync(src)) {
    return { ok: false, error: 'Δεν βρέθηκε το ελληνικό λεξικό' };
  }
  const dir = path.join(userDataPath, 'Dictionaries');
  fs.mkdirSync(dir, { recursive: true });
  const srcSize = fs.statSync(src).size;
  ['el-GR-3-0.bdic', 'el-GR.bdic'].forEach((name) => {
    const target = path.join(dir, name);
    if (!fs.existsSync(target) || fs.statSync(target).size !== srcSize) {
      fs.copyFileSync(src, target);
    }
  });
  return { ok: true, dest: path.join(dir, GREEK_DICT_FILENAME) };
}

function pickGreekSpellLanguage(available) {
  const list = Array.isArray(available) ? available : [];
  for (const code of GREEK_LANG_CODES) {
    if (list.includes(code)) return code;
  }
  return 'el-GR';
}

function getGreekSpellcheckStatus(session, userDataPath) {
  const dest = userDataPath ? path.join(userDataPath, 'Dictionaries', GREEK_DICT_FILENAME) : '';
  return {
    enabled: session && typeof session.isSpellCheckerEnabled === 'function'
      ? session.isSpellCheckerEnabled()
      : null,
    languages: session && typeof session.getSpellCheckerLanguages === 'function'
      ? session.getSpellCheckerLanguages()
      : [],
    available: session ? (session.availableSpellCheckerLanguages || []) : [],
    dictExists: dest ? fs.existsSync(dest) : false,
    dictionaryReady,
    lastEnable: lastEnableResult,
  };
}

function enableGreekSpellcheck(session, opts) {
  const options = opts || {};
  if (!session) {
    lastEnableResult = { ok: false, error: 'Λείπει session' };
    return lastEnableResult;
  }
  if (typeof session.on === 'function') {
    session.on('spellcheck-dictionary-initialized', (_event, info) => {
      const code = String((info && info.languageCode) || '');
      if (code.toLowerCase().startsWith('el')) dictionaryReady = true;
    });
  }
  const installed = installBundledGreekDictionary(options.userDataPath, options.bundledPath);
  try {
    if (typeof session.setSpellCheckerEnabled === 'function') {
      session.setSpellCheckerEnabled(true);
    }
    const available = session.availableSpellCheckerLanguages || [];
    const lang = pickGreekSpellLanguage(available);
    session.setSpellCheckerLanguages([lang]);
    lastEnableResult = { ok: true, language: lang, dictionary: installed };
    return lastEnableResult;
  } catch (e) {
    lastEnableResult = { ok: false, error: e.message, dictionary: installed };
    return lastEnableResult;
  }
}

module.exports = {
  GREEK_DICT_FILENAME,
  resolveBundledGreekDictionary,
  installBundledGreekDictionary,
  pickGreekSpellLanguage,
  enableGreekSpellcheck,
  getGreekSpellcheckStatus,
};
