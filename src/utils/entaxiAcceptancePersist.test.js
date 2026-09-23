/**
 * @jest-environment node
 */
const persist = require('../../app/core/entaxiAcceptancePersist');

describe('entaxiAcceptancePersist', () => {
  it('κρατά ΑΔΑ και μεταδεδομένα αποδοχής όταν η φόρμα δεν τα στέλνει', () => {
    const saved = persist.preserveAcceptanceFields({
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget' },
      diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12' }],
      subject: 'Παλιό',
    }, {
      subject: 'Νέο θέμα',
    });
    expect(saved.subject).toBe('Νέο θέμα');
    expect(saved.diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');
    expect(saved.diavgeiaAcceptanceMeta.role).toBe('council_budget');
    expect(saved.diavgeiaAcceptanceMetas).toHaveLength(1);
  });

  it('δεν αντικαθιστά νέα τιμή που έστειλε η αποθήκευση από Διαύγεια', () => {
    const saved = persist.preserveAcceptanceFields({
      diavgeiaAcceptanceAda: 'ΠΑΛΙΟ',
    }, {
      diavgeiaAcceptanceAda: 'ΝΕΟ-ΑΔΑ',
    });
    expect(saved.diavgeiaAcceptanceAda).toBe('ΝΕΟ-ΑΔΑ');
  });

  it('βγάζει διαγραμμένο αρχείο από τη λίστα αποδοχής', () => {
    expect(persist.dropFileNameFromList(
      ['Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf', 'σημείωμα.txt'],
      'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf'
    )).toEqual(['σημείωμα.txt']);
  });

  it('καθαρίζει ΑΔΑ αποδοχής όταν φύγουν όλα τα αρχεία', () => {
    const synced = persist.syncAcceptanceAfterApprovalFiles({
      approvalPDFs: [],
      approvalPDF: '',
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget' },
      diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget' }],
    });
    expect(synced.diavgeiaAcceptanceAda).toBe('');
    expect(synced.diavgeiaAcceptanceMeta).toBe(null);
    expect(synced.diavgeiaAcceptanceMetas).toEqual([]);
  });

  it('κρατά την Επιτροπή ως κύρια αποδοχή όταν διαγραφεί το Δ.Σ.', () => {
    const synced = persist.syncAcceptanceAfterApprovalFiles({
      approvalPDFs: ['Αποδοχή Επιτροπής — Διαύγεια 6ΞΧΜΩΨΜ-ΚΟΟ.pdf'],
      approvalPDF: 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf',
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget' },
      diavgeiaAcceptanceMetas: [
        { ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget', pdfFileName: 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf' },
        { ada: '6ΞΧΜΩΨΜ-ΚΟΟ', role: 'committee_accept', pdfFileName: 'Αποδοχή Επιτροπής — Διαύγεια 6ΞΧΜΩΨΜ-ΚΟΟ.pdf' },
      ],
    });
    expect(synced.diavgeiaAcceptanceAda).toBe('6ΞΧΜΩΨΜ-ΚΟΟ');
    expect(synced.diavgeiaAcceptanceMeta.role).toBe('committee_accept');
    expect(synced.diavgeiaAcceptanceMetas).toHaveLength(1);
    expect(synced.approvalPDF).toBe('Αποδοχή Επιτροπής — Διαύγεια 6ΞΧΜΩΨΜ-ΚΟΟ.pdf');
  });

  it('προσθέτει αποδοχή τροποποίησης χωρίς να πειράζει την αποδοχή της ένταξης', () => {
    const merged = persist.mergeAttachedAcceptance({
      modificationId: 'mod-1',
      comments: 'Αύξηση',
    }, [{
      pdfFileName: 'Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf',
      meta: { ada: 'Ψ1ΘΟΩΨΜ-ΧΨΓ', role: 'council_budget' },
    }]);
    expect(merged.approvalPDFs).toEqual(['Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf']);
    expect(merged.diavgeiaAcceptanceAda).toBe('Ψ1ΘΟΩΨΜ-ΧΨΓ');
    expect(merged.comments).toBe('Αύξηση');
  });

  it('βγάζει αρχείο αποδοχής τροποποίησης και καθαρίζει τον ΑΔΑ', () => {
    const { changed, record } = persist.removeApprovalFileFromRecord({
      approvalPDFs: ['Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf'],
      approvalPDF: 'Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf',
      diavgeiaAcceptanceAda: 'Ψ1ΘΟΩΨΜ-ΧΨΓ',
      diavgeiaAcceptanceMeta: { ada: 'Ψ1ΘΟΩΨΜ-ΧΨΓ', pdfFileName: 'Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf' },
      diavgeiaAcceptanceMetas: [{ ada: 'Ψ1ΘΟΩΨΜ-ΧΨΓ', pdfFileName: 'Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf' }],
    }, 'Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf');
    expect(changed).toBe(true);
    expect(record.diavgeiaAcceptanceAda).toBe('');
    expect(persist.recordHasStoredAcceptance(record)).toBe(false);
  });

  it('μετονομασία αποδοχής από Διαύγεια κρατά τον ΑΔΑ στο νέο όνομα', () => {
    const oldName = 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf';
    const newName = 'Αποδοχή ανανεωμένη.pdf';
    const data = {
      entaxiPDFs: ['απόφαση-ένταξης.pdf'],
      approvalPDFs: [oldName],
      approvalPDF: oldName,
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget', pdfFileName: oldName },
      diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', role: 'council_budget', pdfFileName: oldName }],
      modifications: [{
        modificationId: 'mod-1',
        approvalPDFs: [oldName],
        diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', pdfFileName: oldName },
      }],
    };
    persist.renameAcceptanceFileRefs(data, oldName, newName);
    expect(data.approvalPDFs).toEqual([newName]);
    expect(data.approvalPDF).toBe(newName);
    expect(data.entaxiPDFs).toEqual(['απόφαση-ένταξης.pdf']);
    expect(data.diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');
    expect(data.diavgeiaAcceptanceMeta.pdfFileName).toBe(newName);
    expect(data.diavgeiaAcceptanceMetas[0].pdfFileName).toBe(newName);
    expect(data.modifications[0].approvalPDFs).toEqual([oldName]);
    expect(data.modifications[0].diavgeiaAcceptanceMeta.pdfFileName).toBe(oldName);
    const synced = persist.syncAcceptanceAfterApprovalFiles(data);
    expect(synced.diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');
    expect(synced.diavgeiaAcceptanceMetas).toHaveLength(1);
  });

  it('διαγραφή αρχείου της ένταξης δεν πειράζει αποδοχή τροποποίησης με το ίδιο όνομα', () => {
    const name = 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf';
    const data = {
      approvalPDFs: [name],
      approvalPDF: name,
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name },
      diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name }],
      modifications: [{
        approvalPDFs: [name],
        approvalPDF: name,
        diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
        diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name },
        diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name }],
      }],
    };
    persist.unlinkEntaxiFileRecord(data, name, { scope: 'root' });
    expect(data.approvalPDFs).toEqual([]);
    expect(data.diavgeiaAcceptanceAda).toBe('');
    expect(data.modifications[0].approvalPDFs).toEqual([name]);
    expect(data.modifications[0].diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');

    const again = {
      approvalPDFs: [name],
      approvalPDF: name,
      diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
      diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name },
      diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name }],
      modifications: [{
        approvalPDFs: [name],
        approvalPDF: name,
        modificationPDF: name,
        diavgeiaAcceptanceAda: '624ΙΩΨΜ-Ζ12',
        diavgeiaAcceptanceMeta: { ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name },
        diavgeiaAcceptanceMetas: [{ ada: '624ΙΩΨΜ-Ζ12', pdfFileName: name }],
      }],
    };
    persist.unlinkEntaxiFileRecord(again, name, { scope: 'modification', modIndex: 0 });
    expect(again.approvalPDFs).toEqual([name]);
    expect(again.diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');
    expect(again.modifications[0].approvalPDFs).toEqual([]);
    expect(again.modifications[0].modificationPDF).toBe(null);
    expect(again.modifications[0].diavgeiaAcceptanceAda).toBe('');
  });
});
