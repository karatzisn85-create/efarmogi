/**
 * Modal ομαδοποίησης αρχείων κατά το ανέβασμα.
 * @returns {Promise<false|null|{ action: 'new', title: string }|{ action: 'existing', groupId: string }|{ action: 'subgroup', parentId: string, title: string }>}
 *   false = χωρίς ομαδοποίηση (συνέχεια ανεβάσματος)
 *   null = πλήρης ακύρωση (Esc, Ακύρωση, κλικ έξω)
 */
import { safeAlert } from './safeDialogs';
import prosklisiFileGroups from '../../app/core/prosklisiFileGroups';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupOptionsHtml(flatGroups) {
  return (flatGroups || [])
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label || group.title)}</option>`)
    .join('');
}

export function showSubprojectFileGroupingModal(fileCount, existingGroups = [], options = {}) {
  const allowSubgroups = !!options.allowSubgroups;
  const allowSkip = options.allowSkip !== false;
  const cancelLabel = options.cancelLabel || '✕ Ακύρωση ανεβάσματος';
  const heading = options.heading || '📁 Ομαδοποίηση Αρχείων';
  const intro = options.intro || `Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;`;
  const flatGroups = prosklisiFileGroups.flattenGroups(existingGroups);

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

    const existingGroupsOptions = groupOptionsHtml(flatGroups);

    modalContent.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
        ${escapeHtml(heading)}
      </h3>
      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
        ${escapeHtml(intro)}
      </p>
      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <button id="newGroupBtn" type="button" data-testid="file-choice-new" style="
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
        ${flatGroups.length > 0 ? `
        <button id="existingGroupBtn" type="button" data-testid="file-choice-existing" style="
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
        ${allowSubgroups && flatGroups.length > 0 ? `
        <button id="newSubgroupBtn" type="button" data-testid="file-choice-subgroup" style="
          padding: 0.8rem 1.5rem;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">📁 Νέα Υποομάδα μέσα σε ομάδα</button>
        ` : ''}
        ${allowSkip ? `
        <button id="noGroupBtn" type="button" data-testid="file-choice-none" style="
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
        ` : ''}
        <button id="abortUploadBtn" type="button" data-testid="file-choice-cancel" style="
          padding: 0.8rem 1.5rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          text-align: left;
        ">${escapeHtml(cancelLabel)}</button>
      </div>
      <div id="newGroupSection" style="display: none;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
          Τίτλος νέας ομάδας:
        </label>
        <input
          type="text"
          id="newGroupTitle"
          data-testid="file-new-title"
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
          <button id="confirmNewBtn" type="button" data-testid="file-confirm-new" style="
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
          data-testid="file-existing-select"
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
          <button id="confirmExistingBtn" type="button" data-testid="file-confirm-existing" style="
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
      <div id="newSubgroupSection" style="display: none;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
          Ομάδα στην οποία θα μπει η υποομάδα:
        </label>
        <select
          id="parentGroupSelect"
          data-testid="file-subgroup-parent"
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
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
          Τίτλος νέας υποομάδας:
        </label>
        <input
          type="text"
          id="newSubgroupTitle"
          data-testid="file-subgroup-title"
          placeholder="π.χ. Φορολογικά, Τοπογραφικά"
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
          <button id="confirmSubgroupBtn" type="button" data-testid="file-confirm-subgroup" style="
            flex: 1;
            padding: 0.8rem 1.5rem;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
          ">Επιβεβαίωση</button>
          <button id="cancelSubgroupBtn" type="button" style="
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
    const newSubgroupBtn = modalContent.querySelector('#newSubgroupBtn');
    const noGroupBtn = modalContent.querySelector('#noGroupBtn');
    const newGroupSection = modalContent.querySelector('#newGroupSection');
    const existingGroupSection = modalContent.querySelector('#existingGroupSection');
    const newSubgroupSection = modalContent.querySelector('#newSubgroupSection');
    const newGroupTitle = modalContent.querySelector('#newGroupTitle');
    const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
    const parentGroupSelect = modalContent.querySelector('#parentGroupSelect');
    const newSubgroupTitle = modalContent.querySelector('#newSubgroupTitle');
    const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
    const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
    const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
    const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');
    const confirmSubgroupBtn = modalContent.querySelector('#confirmSubgroupBtn');
    const cancelSubgroupBtn = modalContent.querySelector('#cancelSubgroupBtn');
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

    const hideChoiceButtons = () => {
      newGroupBtn.style.display = 'none';
      if (existingGroupBtn) existingGroupBtn.style.display = 'none';
      if (newSubgroupBtn) newSubgroupBtn.style.display = 'none';
      if (noGroupBtn) noGroupBtn.style.display = 'none';
      if (abortUploadBtn) abortUploadBtn.style.display = 'none';
    };

    const showMainOptions = () => {
      newGroupBtn.style.display = '';
      if (existingGroupBtn) existingGroupBtn.style.display = '';
      if (newSubgroupBtn) newSubgroupBtn.style.display = '';
      if (noGroupBtn) noGroupBtn.style.display = '';
      if (abortUploadBtn) abortUploadBtn.style.display = '';
      newGroupSection.style.display = 'none';
      existingGroupSection.style.display = 'none';
      if (newSubgroupSection) newSubgroupSection.style.display = 'none';
      newGroupTitle.value = '';
      if (existingGroupSelect) existingGroupSelect.value = '';
      if (parentGroupSelect) parentGroupSelect.value = '';
      if (newSubgroupTitle) newSubgroupTitle.value = '';
    };

    newGroupBtn.addEventListener('click', () => {
      hideChoiceButtons();
      newGroupSection.style.display = 'block';
      newGroupTitle.focus();
    });

    if (existingGroupBtn) {
      existingGroupBtn.addEventListener('click', () => {
        hideChoiceButtons();
        existingGroupSection.style.display = 'block';
      });
    }

    if (newSubgroupBtn) {
      newSubgroupBtn.addEventListener('click', () => {
        hideChoiceButtons();
        newSubgroupSection.style.display = 'block';
      });
    }

    if (noGroupBtn) {
      noGroupBtn.addEventListener('click', () => cleanup(false));
    }
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

    if (confirmExistingBtn) {
      confirmExistingBtn.addEventListener('click', () => {
        const selectedGroupId = existingGroupSelect.value;
        if (selectedGroupId) {
          cleanup({ action: 'existing', groupId: selectedGroupId });
        } else {
          safeAlert('Παρακαλώ επιλέξτε ομάδα');
        }
      });
    }

    if (cancelExistingBtn) {
      cancelExistingBtn.addEventListener('click', () => showMainOptions());
    }

    if (confirmSubgroupBtn) {
      confirmSubgroupBtn.addEventListener('click', () => {
        const parentId = parentGroupSelect.value;
        const title = newSubgroupTitle.value.trim();
        if (!parentId) {
          safeAlert('Παρακαλώ επιλέξτε ομάδα');
          return;
        }
        if (!title) {
          safeAlert('Παρακαλώ εισάγετε τίτλο υποομάδας');
          return;
        }
        cleanup({ action: 'subgroup', parentId, title });
      });
    }

    if (cancelSubgroupBtn) {
      cancelSubgroupBtn.addEventListener('click', () => showMainOptions());
    }

    handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  });
}
