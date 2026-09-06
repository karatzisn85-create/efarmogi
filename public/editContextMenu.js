'use strict';

let lastBuiltTemplate = null;

function hasTextSelection(params) {
  return Boolean(params && String(params.selectionText || '').length);
}

function menuItem(role, label, enabled) {
  return {
    role,
    label,
    enabled: enabled !== false,
  };
}

function buildSpellcheckMenuItems(params, actions) {
  const misspelled = String((params && params.misspelledWord) || '').trim();
  if (!misspelled) return [];
  const suggestions = Array.isArray(params.dictionarySuggestions)
    ? params.dictionarySuggestions.filter(Boolean).slice(0, 5)
    : [];
  const act = actions || {};
  const items = suggestions.map((word) => ({
    label: word,
    click: typeof act.replaceMisspelling === 'function'
      ? () => act.replaceMisspelling(word)
      : undefined,
  }));
  if (!items.length) {
    items.push({ label: 'Δεν υπάρχουν προτάσεις', enabled: false });
  }
  items.push({
    label: 'Προσθήκη στο λεξικό',
    click: typeof act.addToDictionary === 'function'
      ? () => act.addToDictionary(misspelled)
      : undefined,
  });
  items.push({ type: 'separator' });
  return items;
}

function buildEditContextMenuTemplate(params, actions) {
  const p = params || {};
  const flags = p.editFlags || {};
  const editable = p.isEditable === true;
  const selected = hasTextSelection(p);
  const spellItems = editable ? buildSpellcheckMenuItems(p, actions) : [];
  if (!editable && !selected && !spellItems.length) return [];

  if (editable) {
    return spellItems.concat([
      menuItem('undo', 'Αναίρεση', flags.canUndo),
      menuItem('redo', 'Επανάληψη', flags.canRedo),
      { type: 'separator' },
      menuItem('cut', 'Αποκοπή', flags.canCut),
      menuItem('copy', 'Αντιγραφή', flags.canCopy),
      menuItem('paste', 'Επικόλληση', flags.canPaste),
      menuItem('delete', 'Διαγραφή', flags.canDelete),
      { type: 'separator' },
      menuItem('selectAll', 'Επιλογή όλων', flags.canSelectAll),
    ]);
  }

  return [
    menuItem('copy', 'Αντιγραφή', flags.canCopy),
    { type: 'separator' },
    menuItem('selectAll', 'Επιλογή όλων', flags.canSelectAll),
  ];
}

function getLastBuiltEditMenu() {
  return lastBuiltTemplate;
}

function attachEditContextMenu(win, deps) {
  const Menu = deps && deps.Menu;
  if (!win || !win.webContents || !Menu) return;
  const popup = !(deps && deps.popup === false);
  win.webContents.on('context-menu', (_event, params) => {
    const template = buildEditContextMenuTemplate(params, {
      replaceMisspelling: (word) => win.webContents.replaceMisspelling(word),
      addToDictionary: (word) => win.webContents.session.addWordToSpellCheckerDictionary(word),
    });
    lastBuiltTemplate = template.map((row) => ({
      type: row.type,
      role: row.role,
      label: row.label,
      enabled: row.enabled,
    }));
    if (typeof (deps && deps.onBuilt) === 'function') deps.onBuilt(lastBuiltTemplate);
    if (!popup || !template.length) return;
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}

module.exports = {
  buildSpellcheckMenuItems,
  buildEditContextMenuTemplate,
  attachEditContextMenu,
  getLastBuiltEditMenu,
};
