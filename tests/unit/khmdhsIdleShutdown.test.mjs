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
