/**
 * Μαζική ανανέωση ΚΗΜΔΗΣ: κράτα τον υπολογιστή ξύπνιο και, στο τέλος, σβήσε τον.
 * Τα ορίσματα του shutdown.exe είναι σταθερά — όχι κείμενο από τον renderer.
 * Οι ίδιοι αριθμοί υπάρχουν και στο src/utils/khmdhsIdleShutdownPlan.js.
 */

const path = require('path');

const KHMDHS_IDLE_SHUTDOWN_DELAY_SEC = 60;
const KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC = 75;
const KHMDHS_IDLE_SHUTDOWN_COMMENT =
  'ERGOHUB: η μαζική ανανέωση ΚΗΜΔΗΣ ολοκληρώθηκε';
const SHUTDOWN_EXE_TIMEOUT_MS = 8000;

function sanitizeComment(text) {
  return String(text || KHMDHS_IDLE_SHUTDOWN_COMMENT)
    .replace(/[\r\n"]/g, ' ')
    .trim()
    .slice(0, 200);
}

function clampDelaySec(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(600, Math.round(n)));
}

function resolveShutdownExe(platform, env = process.env) {
  if (platform !== 'win32') return 'shutdown.exe';
  const root = env.SystemRoot || env.WINDIR || 'C:\\Windows';
  return path.join(root, 'System32', 'shutdown.exe');
}

function buildShutdownArgv(delaySec, comment) {
  const t = clampDelaySec(delaySec, KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC);
  return ['/s', '/t', String(t), '/f', '/c', sanitizeComment(comment)];
}

function runShutdownExe(spawnFn, command, args) {
  return new Promise((resolve) => {
    let settled = false;
    let child = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { child?.kill(); } catch { /* ignore */ }
      finish({ ok: false, error: 'timeout' });
    }, SHUTDOWN_EXE_TIMEOUT_MS);

    try {
      child = spawnFn(command, args, { windowsHide: true, stdio: 'ignore' });
    } catch (err) {
      finish({ ok: false, error: err?.message || String(err) });
      return;
    }
    if (!child || typeof child.on !== 'function') {
      finish({ ok: false, error: 'spawn failed' });
      return;
    }
    child.on('error', (err) => {
      finish({ ok: false, error: err?.message || String(err) });
    });
    child.on('exit', (code) => {
      finish({ ok: code === 0, code });
    });
  });
}

function createKhmdhsIdleShutdown({
  powerSaveBlocker,
  spawn,
  platform,
  env,
  logger,
  getMainWindow,
  onFallbackQuit,
} = {}) {
  let sleepBlockerId = null;
  let batchAwakeIds = [];
  let armed = false;
  let shutdownScheduled = false;
  let tickTimer = null;
  let remainingSec = 0;
  let fallbackQuit = false;

  const log = (msg, extra) => {
    try { logger?.info?.('KhmdhsIdleShutdown', extra ? `${msg} ${extra}` : msg); } catch { /* ignore */ }
  };

  const broadcast = (channel, payload) => {
    try {
      const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    } catch { /* το παράθυρο μπορεί να έχει κλείσει */ }
  };

  const stopTicks = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  const stopSleepBlock = () => {
    if (sleepBlockerId == null) return;
    try {
      if (powerSaveBlocker && powerSaveBlocker.isStarted(sleepBlockerId)) {
        powerSaveBlocker.stop(sleepBlockerId);
      }
    } catch { /* ignore */ }
    sleepBlockerId = null;
  };

  const startSleepBlock = () => {
    if (sleepBlockerId != null) return;
    if (!powerSaveBlocker || typeof powerSaveBlocker.start !== 'function') return;
    try {
      sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    } catch (err) {
      log('sleep-block failed', err?.message);
      sleepBlockerId = null;
    }
  };

  const startBatchAwake = () => {
    if (batchAwakeIds.length) return { success: true, held: true };
    if (!powerSaveBlocker || typeof powerSaveBlocker.start !== 'function') {
      return { success: true, held: false };
    }
    const ids = [];
    ['prevent-app-suspension', 'prevent-display-sleep'].forEach((type) => {
      try {
        ids.push(powerSaveBlocker.start(type));
      } catch (err) {
        log('batch-awake failed', `${type} ${err?.message || ''}`);
      }
    });
    batchAwakeIds = ids;
    log('batch awake held');
    return { success: true, held: ids.length > 0 };
  };

  const stopBatchAwake = () => {
    if (!batchAwakeIds.length) return { success: true };
    batchAwakeIds.forEach((id) => {
      try {
        if (powerSaveBlocker && powerSaveBlocker.isStarted(id)) {
          powerSaveBlocker.stop(id);
        }
      } catch { /* ignore */ }
    });
    batchAwakeIds = [];
    log('batch awake released');
    return { success: true };
  };

  const startTicks = (delaySec) => {
    stopTicks();
    remainingSec = delaySec;
    broadcast('khmdhs-idle-shutdown-tick', {
      remainingSec,
      shutdownScheduled,
      fallbackQuit,
    });
    tickTimer = setInterval(() => {
      remainingSec = Math.max(0, remainingSec - 1);
      broadcast('khmdhs-idle-shutdown-tick', {
        remainingSec,
        shutdownScheduled,
        fallbackQuit,
      });
      if (remainingSec <= 0) {
        stopTicks();
        if (fallbackQuit && typeof onFallbackQuit === 'function') {
          try { onFallbackQuit(); } catch { /* ignore */ }
        }
      }
    }, 1000);
  };

  const exe = resolveShutdownExe(platform, env);

  return {
    isArmed() { return armed; },
    isBatchAwakeHeld() { return batchAwakeIds.length > 0; },
    holdBatchAwake() { return startBatchAwake(); },
    releaseBatchAwake() { return stopBatchAwake(); },
    /** Ακύρωση από το Χ του παραθύρου μόνο όσο μετράει ο χρήστης — όχι όταν κλείνουν τα Windows. */
    isShutdownPending() {
      return remainingSec > 0 && (shutdownScheduled || fallbackQuit);
    },
    /** Μην εμποδίζεις το before-quit: τα Windows εκτελούν ήδη το σβήσιμο. */
    shouldAllowSystemQuit() { return shutdownScheduled; },

    arm() {
      armed = true;
      shutdownScheduled = false;
      fallbackQuit = false;
      remainingSec = 0;
      stopTicks();
      startSleepBlock();
      log('armed');
      return { success: true, armed: true };
    },

    async disarm() {
      stopTicks();
      remainingSec = 0;
      const hadSchedule = shutdownScheduled;
      shutdownScheduled = false;
      fallbackQuit = false;
      armed = false;
      stopSleepBlock();
      if (hadSchedule && platform === 'win32' && typeof spawn === 'function') {
        await runShutdownExe(spawn, exe, ['/a']);
      }
      broadcast('khmdhs-idle-shutdown-aborted', { ok: true });
      log('disarmed');
      return { success: true };
    },

    async commit({ delaySec, osDelaySec } = {}) {
      if (!armed) {
        return { success: false, error: 'Δεν έχει ζητηθεί σβήσιμο μετά την ανανέωση' };
      }
      const uiT = clampDelaySec(delaySec, KHMDHS_IDLE_SHUTDOWN_DELAY_SEC);
      const osT = clampDelaySec(osDelaySec, KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC);

      let osOk = false;
      if (platform === 'win32' && typeof spawn === 'function') {
        const result = await runShutdownExe(
          spawn,
          exe,
          buildShutdownArgv(osT, KHMDHS_IDLE_SHUTDOWN_COMMENT)
        );
        osOk = !!result.ok;
        if (!osOk) log('shutdown.exe failed', result.error || `code ${result.code}`);
      }

      shutdownScheduled = osOk;
      fallbackQuit = !osOk;
      startTicks(uiT);
      log(osOk ? 'shutdown scheduled' : 'fallback quit');
      return {
        success: true,
        delaySec: uiT,
        osDelaySec: osT,
        shutdownScheduled: osOk,
        fallbackQuit: !osOk,
      };
    },
  };
}

module.exports = {
  KHMDHS_IDLE_SHUTDOWN_DELAY_SEC,
  KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC,
  createKhmdhsIdleShutdown,
  buildShutdownArgv,
  resolveShutdownExe,
};
