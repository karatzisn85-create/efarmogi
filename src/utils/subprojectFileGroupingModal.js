/**
 * Modal ομαδοποίησης αρχείων κατά το ανέβασμα από λεπτομέρειες υποέργου.
 * @returns {Promise<false|null|{ action: 'new', title: string }|{ action: 'existing', groupId: string }>}
 *   false = χωρίς ομαδοποίηση (συνέχεια ανεβάσματος)
 *   null = πλήρης ακύρωση (Esc, Ακύρωση, κλικ έξω)
 */
import { safeAlert } from './safeDialogs';

export function showSubprojectFileGroupingModal(fileCount, existingGroups = []) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    `;

    const existingGroupsOptions = existingGroups.length > 0
      ? existingGroups.map((group) => `<option value="${group.id}">${group.title}</option>`).join('')
      : '';

    modalContent.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
        📁 Ομαδοποίηση Αρχείων
      </h3>
      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
        Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;
      </p>
      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <button id="newGroupBtn" type="button" style="
          padding: 0.8rem 1.5rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">🆕 Νέα Ομάδα</button>
        ${existingGroups.length > 0 ? `
        <button id="existingGroupBtn" type="button" style="
          padding: 0.8rem 1.5rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">📂 Προσθήκη σε Υπάρχουσα Ομάδα</button>
        ` : ''}
        <button id="noGroupBtn" type="button" style="
          padding: 0.8rem 1.5rem;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">📄 Χωρίς Ομαδοποίηση</button>
        <button id="abortUploadBtn" type="button" style="
          padding: 0.8rem 1.5rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">✕ Ακύρωση ανεβάσματος</button>
      </div>
      <div id="newGroupSection" style="display: none;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
          Τίτλος νέας ομάδας:
        </label>
        <input
          type="text"
          id="newGroupTitle"
          placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
          style="
            width: 100%;
            padding: 0.8rem;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            margin-bottom: 1rem;
            box-sizing: border-box;
          "
        />
        <div style="display: flex; gap: 1rem;">
          <button id="confirmNewBtn" type="button" style="
            flex: 1;
            padding: 0.8rem 1.5rem;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
          ">Επιβεβαίωση</button>
          <button id="cancelNewBtn" type="button" style="
            flex: 1;
            padding: 0.8rem 1.5rem;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
          ">Ακύρωση</button>
        </div>
      </div>
      <div id="existingGroupSection" style="display: none;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
          Επιλέξτε υπάρχουσα ομάδα:
        </label>
        <select
          id="existingGroupSelect"
          style="
            width: 100%;
            padding: 0.8rem;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            margin-bottom: 1rem;
            box-sizing: border-box;
          "
        >
          <option value="">-- Επιλέξτε ομάδα --</option>
          ${existingGroupsOptions}
        </select>
        <div style="display: flex; gap: 1rem;">
          <button id="confirmExistingBtn" type="button" style="
            flex: 1;
            padding: 0.8rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
          ">Επιβεβαίωση</button>
          <button id="cancelExistingBtn" type="button" style="
            flex: 1;
            padding: 0.8rem 1.5rem;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
          ">Ακύρωση</button>
        </div>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const newGroupBtn = modalContent.querySelector('#newGroupBtn');
    const existingGroupBtn = modalContent.querySelector('#existingGroupBtn');
    const noGroupBtn = modalContent.querySelector('#noGroupBtn');
    const newGroupSection = modalContent.querySelector('#newGroupSection');
    const existingGroupSection = modalContent.querySelector('#existingGroupSection');
    const newGroupTitle = modalContent.querySelector('#newGroupTitle');
    const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
    const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
    const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
    const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
    const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');
    const abortUploadBtn = modalContent.querySelector('#abortUploadBtn');

    let handleKeyDown;
    const cleanup = (result) => {
      if (modal.parentNode === document.body) {
        document.body.removeChild(modal);
      }
      if (handleKeyDown) {
        document.removeEventListener('keydown', handleKeyDown);
      }
      resolve(result);
    };

    const showMainOptions = () => {
      newGroupBtn.style.display = '';
      if (existingGroupBtn) existingGroupBtn.style.display = '';
      noGroupBtn.style.display = '';
      if (abortUploadBtn) abortUploadBtn.style.display = '';
      newGroupSection.style.display = 'none';
      existingGroupSection.style.display = 'none';
      newGroupTitle.value = '';
      if (existingGroupSelect) existingGroupSelect.value = '';
    };

    newGroupBtn.addEventListener('click', () => {
      newGroupBtn.style.display = 'none';
      if (existingGroupBtn) existingGroupBtn.style.display = 'none';
      noGroupBtn.style.display = 'none';
      if (abortUploadBtn) abortUploadBtn.style.display = 'none';
      newGroupSection.style.display = 'block';
      newGroupTitle.focus();
    });

    if (existingGroupBtn) {
      existingGroupBtn.addEventListener('click', () => {
        newGroupBtn.style.display = 'none';
        existingGroupBtn.style.display = 'none';
        noGroupBtn.style.display = 'none';
        if (abortUploadBtn) abortUploadBtn.style.display = 'none';
        existingGroupSection.style.display = 'block';
      });
    }

    noGroupBtn.addEventListener('click', () => cleanup(false));
    if (abortUploadBtn) {
      abortUploadBtn.addEventListener('click', () => cleanup(null));
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup(null);
      }
    });
    modalContent.addEventListener('click', (e) => e.stopPropagation());

    confirmNewBtn.addEventListener('click', () => {
      const title = newGroupTitle.value.trim();
      if (title) {
        cleanup({ action: 'new', title });
      } else {
        safeAlert('Παρακαλώ εισάγετε τίτλο ομάδας');
      }
    });

    cancelNewBtn.addEventListener('click', () => showMainOptions());

    confirmExistingBtn.addEventListener('click', () => {
      const selectedGroupId = existingGroupSelect.value;
      if (selectedGroupId) {
        cleanup({ action: 'existing', groupId: selectedGroupId });
      } else {
        safeAlert('Παρακαλώ επιλέξτε ομάδα');
      }
    });

    cancelExistingBtn.addEventListener('click', () => showMainOptions());

    handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  });
}
