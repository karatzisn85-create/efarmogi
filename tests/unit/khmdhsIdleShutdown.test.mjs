import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { createKhmdhsIdleShutdown } = require('../../public/khmdhsIdleShutdown.js');

test('η μαζική ανανέωση κρατά τον υπολογιστή ξύπνιο και τον αφήνει στο τέλος', () => {
  const started = [];
  const stopped = [];
  const powerSaveBlocker = {
    start(type) {
      const id = started.length + 1;
      started.push({ id, type });
      return id;
    },
    isStarted(id) { return started.some((s) => s.id === id) && !stopped.includes(id); },
    stop(id) { stopped.push(id); },
  };
  const svc = createKhmdhsIdleShutdown({ powerSaveBlocker, platform: 'win32' });
  svc.holdBatchAwake();
  assert.equal(svc.isBatchAwakeHeld(), true);
  assert.ok(started.some((s) => s.type === 'prevent-app-suspension'));
  svc.holdBatchAwake();
  assert.equal(started.length, 2);
  svc.releaseBatchAwake();
  assert.equal(svc.isBatchAwakeHeld(), false);
  assert.equal(stopped.length, 2);
});

test('στους αυτόματους ελέγχους δεν καλείται shutdown.exe', async () => {
  let spawned = 0;
  const spawn = () => {
    spawned += 1;
    return { on() {} };
  };
  const svc = createKhmdhsIdleShutdown({
    platform: 'win32',
    spawn,
    skipOsShutdown: true,
  });
  svc.arm();
  const result = await svc.commit({ delaySec: 2, osDelaySec: 3 });
  assert.equal(result.success, true);
  assert.equal(result.shutdownScheduled, false);
  assert.equal(spawned, 0);
  await svc.disarm();
});
