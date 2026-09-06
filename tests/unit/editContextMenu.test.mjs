import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  buildEditContextMenuTemplate,
} = require('../../public/editContextMenu.js');

function labels(template) {
  return (template || []).filter((row) => row.label).map((row) => row.label);
}

test('χωρίς επιλογή και χωρίς πεδίο δεν εμφανίζεται μενού', () => {
  assert.deepEqual(buildEditContextMenuTemplate({}), []);
  assert.deepEqual(buildEditContextMenuTemplate({ isEditable: false, selectionText: '' }), []);
});

test('σε πεδίο κειμένου: αποκοπή, αντιγραφή, επικόλληση, επιλογή όλων', () => {
  const template = buildEditContextMenuTemplate({
    isEditable: true,
    editFlags: {
      canUndo: true,
      canRedo: false,
      canCut: true,
      canCopy: true,
      canPaste: true,
      canDelete: true,
      canSelectAll: true,
    },
  });
  assert.deepEqual(labels(template), [
    'Αναίρεση',
    'Επανάληψη',
    'Αποκοπή',
    'Αντιγραφή',
    'Επικόλληση',
    'Διαγραφή',
    'Επιλογή όλων',
  ]);
  assert.equal(template.find((row) => row.role === 'redo').enabled, false);
  assert.equal(template.find((row) => row.role === 'paste').enabled, true);
});

test('σε επιλεγμένο κείμενο ανάγνωσης: μόνο αντιγραφή', () => {
  const template = buildEditContextMenuTemplate({
    isEditable: false,
    selectionText: 'Γέφυρα Αγίου Σύλλα',
    editFlags: { canCopy: true, canSelectAll: true, canPaste: false },
  });
  assert.deepEqual(labels(template), ['Αντιγραφή', 'Επιλογή όλων']);
  assert.equal(template.some((row) => row.role === 'paste'), false);
  assert.equal(template.some((row) => row.role === 'cut'), false);
});

test('σε ορθογραφικό λάθος εμφανίζει προτάσεις και προσθήκη στο λεξικό', () => {
  const template = buildEditContextMenuTemplate({
    isEditable: true,
    misspelledWord: 'γεφυραα',
    dictionarySuggestions: ['γέφυρα', 'γέφυρας'],
    editFlags: { canCopy: true, canPaste: true, canSelectAll: true },
  });
  assert.deepEqual(labels(template).slice(0, 3), ['γέφυρα', 'γέφυρας', 'Προσθήκη στο λεξικό']);
  assert.ok(labels(template).includes('Αντιγραφή'));
});
