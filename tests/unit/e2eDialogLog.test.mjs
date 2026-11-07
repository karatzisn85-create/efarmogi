import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

test('ο έλεγχος καταγράφει το άνοιγμα διαλόγου αρχείου χωρίς να ανοίξει το παράθυρο των Windows', async () => {
  process.env.ERGOHUB_E2E = '1';
  const e2e = require('../../public/e2eMode');
  const dialog = {
    async showOpenDialog() {
      throw new Error('δεν έπρεπε να ανοίξει το πραγματικό παράθυρο');
    },
    async showSaveDialog() {
      throw new Error('δεν έπρεπε να ανοίξει το πραγματικό παράθυρο αποθήκευσης');
    },
  };
  e2e.installE2EDialogHooks(dialog);
  e2e.queueE2EOpenFiles(['C:\\δοκιμη\\φωτο.png']);
  const opened = await dialog.showOpenDialog({
    title: 'Επιλογή φωτογραφιών απολογισμού',
    properties: ['openFile', 'multiSelections'],
  });
  assert.equal(opened.canceled, false);
  assert.deepEqual(opened.filePaths, ['C:\\δοκιμη\\φωτο.png']);
  e2e.queueE2ESavePath('C:\\δοκιμη\\απολογισμος.pptx');
  const saved = await dialog.showSaveDialog({ title: 'Αποθήκευση παρουσίασης διαφανειών' });
  assert.equal(saved.canceled, false);
  assert.equal(saved.filePath, 'C:\\δοκιμη\\απολογισμος.pptx');
  const calls = e2e.takeE2EDialogLog();
  assert.equal(calls.some((row) => row.kind === 'open' && row.title === 'Επιλογή φωτογραφιών απολογισμού'), true);
  assert.equal(calls.some((row) => row.kind === 'save' && /διαφανειών/.test(row.title)), true);
  e2e.captureE2EMail({ to: 'dokimi@example.com', subject: 'Δοκιμή', html: '<p>γειά</p>' });
  const mail = e2e.takeE2EMailOutbox();
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, 'dokimi@example.com');
  assert.equal(mail[0].subject, 'Δοκιμή');
});
