const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
let logFile = null;
let currentLevel = LOG_LEVELS.INFO;

function initLogger(logDir) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    logFile = path.join(logDir, `ergohub-${date}.log`);
  } catch (_e) { /* fallback to console only */ }
}

function write(level, tag, message, extra) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] [${tag}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}`;

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);

  if (logFile) {
    try { fs.appendFileSync(logFile, line + '\n'); } catch (_) {}
  }
}

const logger = {
  init: initLogger,
  error: (tag, msg, extra) => write('ERROR', tag, msg, extra),
  warn: (tag, msg, extra) => write('WARN', tag, msg, extra),
  info: (tag, msg, extra) => write('INFO', tag, msg, extra),
  debug: (tag, msg, extra) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) write('DEBUG', tag, msg, extra);
  },
  setLevel: (level) => { currentLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO; }
};

module.exports = { logger };
