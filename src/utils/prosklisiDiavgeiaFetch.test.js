/**
 * @jest-environment node
 */
import {
  extractAxisFromSubject,
  extractModificationDescriptionFromSubject,
  mapDiavgeiaDecisionToProsklisiFields,
  subjectLooksLikeModification,
  buildFundingSourceFromDecision,
} from './prosklisiDiavgeiaFetch';

describe('prosklisiDiavgeiaFetch', () => {
  const sampleDecision = {
    ada: '6Θ1Δ465ΧΘ7-Π5Κ',
    protocolNumber: '4719',
    subject:
      'ΠΡΟΣΚΛΗΣΗ VI ΓΙΑ ΤΗΝ ΥΠΟΒΟΛΗ ΑΙΤΗΣΕΩΝ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ ΣΤΟ ΠΡΟΓΡΑΜΜΑ «ΦΙΛΟΔΗΜΟΣ ΙI» '
      + 'ΣΤΟΝ ΑΞΟΝΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ : «Τοπική ανάπτυξη και προστασία του περιβάλλοντος» '
      + 'ΜΕ ΤΙΤΛΟ: «Σύνταξη Masterplan».',
    issueDate: '2019-01-24',
    organization: 'ΥΠΟΥΡΓΕΙΟ ΕΣΩΤΕΡΙΚΩΝ',
    documentUrl: 'https://diavgeia.gov.gr/doc/6Θ1Δ465ΧΘ7-Π5Κ',
  };

  it('extracts axis from subject', () => {
    expect(extractAxisFromSubject(sampleDecision.subject)).toBe(
      'Τοπική ανάπτυξη και προστασία του περιβάλλοντος',
    );
  });

  it('detects modification subjects', () => {
    expect(subjectLooksLikeModification('1η ΤΡΟΠΟΠΟΙΗΣΗ ΠΡΟΣΚΛΗΣΗΣ VI')).toBe(true);
    expect(subjectLooksLikeModification('ΠΡΟΣΚΛΗΣΗ VI')).toBe(false);
  });

  it('maps new prosklisi fields', () => {
    const { fields, autoFilledKeys, preview } = mapDiavgeiaDecisionToProsklisiFields(sampleDecision, 'new');
    expect(preview.ada).toBe('6Θ1Δ465ΧΘ7-Π5Κ');
    expect(fields.code).toBeUndefined();
    expect(fields.axis).toContain('Τοπική ανάπτυξη');
    expect(fields.fundingSource).toBe('ΥΠΟΥΡΓΕΙΟ ΕΣΩΤΕΡΙΚΩΝ');
    expect(autoFilledKeys).toContain('title');
    expect(autoFilledKeys).not.toContain('code');
    expect(fields.modificationDocumentDate).toBeUndefined();
  });

  it('uses issuing organization as funding source', () => {
    const ministry = {
      ada: '6Θ1Δ465ΧΘ7-Π5Κ',
      organization: 'ΥΠΟΥΡΓΕΙΟ ΕΣΩΤΕΡΙΚΩΝ',
      issueDate: '2019-01-24',
    };
    expect(buildFundingSourceFromDecision(ministry)).toBe('ΥΠΟΥΡΓΕΙΟ ΕΣΩΤΕΡΙΚΩΝ');

    const greenFund = {
      ada: '615Μ46Ψ844-Ι5Ι',
      organization: 'ΠΡΑΣΙΝΟ ΤΑΜΕΙΟ',
      organizationSupervisor: 'ΥΠΟΥΡΓΕΙΟ ΠΕΡΙΒΑΛΛΟΝΤΟΣ ΚΑΙ ΕΝΕΡΓΕΙΑΣ',
      issueDate: '2025-07-15',
    };
    expect(buildFundingSourceFromDecision(greenFund)).toBe(
      'ΥΠΟΥΡΓΕΙΟ ΠΕΡΙΒΑΛΛΟΝΤΟΣ ΚΑΙ ΕΝΕΡΓΕΙΑΣ\nΠΡΑΣΙΝΟ ΤΑΜΕΙΟ',
    );
    const { fields } = mapDiavgeiaDecisionToProsklisiFields(greenFund, 'new');
    expect(fields.fundingSource).toBe(
      'ΥΠΟΥΡΓΕΙΟ ΠΕΡΙΒΑΛΛΟΝΤΟΣ ΚΑΙ ΕΝΕΡΓΕΙΑΣ\nΠΡΑΣΙΝΟ ΤΑΜΕΙΟ',
    );
    expect(fields.code).toBeUndefined();
  });

  it('maps modification fields', () => {
    const modDecision = {
      ...sampleDecision,
      ada: 'Ω7ΕΖ465ΧΘ7-1ΝΕ',
      subject: '1η ΤΡΟΠΟΠΟΙΗΣΗ ΠΡΟΣΚΛΗΣΗΣ VI ΓΙΑ ΤΗΝ ΥΠΟΒΟΛΗ ΑΙΤΗΣΕΩΝ',
      issueDate: '2019-05-09',
    };
    const { fields, autoFilledKeys } = mapDiavgeiaDecisionToProsklisiFields(modDecision, 'modification');
    expect(fields.modificationDocumentDate).toBe('2019-05-09');
    expect(fields.modificationDescription).toMatch(/ΤΡΟΠΟΠΟΙΗΣΗ/);
    expect(autoFilledKeys).toContain('modificationDocumentDate');
    expect(extractModificationDescriptionFromSubject(modDecision.subject)).toMatch(/1η ΤΡΟΠΟΠΟΙΗΣΗ/);
    // Τα πεδία της πρόσκλησης ΔΕΝ αλλάζουν στη φόρμα τροποποίησης
    expect(fields.title).toBeUndefined();
    expect(fields.code).toBeUndefined();
    expect(fields.axis).toBeUndefined();
    expect(fields.fundingSource).toBeUndefined();
  });
});
