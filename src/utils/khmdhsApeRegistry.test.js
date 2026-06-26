/**
 * @jest-environment node
 */
import {
  APE_REGISTRY_STAGE,
  buildApeRegistryLinkKey,
  buildDiavgeiaApeRegistryEntry,
  mergeApeIntoDocumentRegistry,
  removeApeFromDocumentRegistry,
} from './khmdhsApeRegistry';

describe('khmdhsApeRegistry', () => {
  const target = { kind: 'contract', arrayIndex: 0, title: 'Σύμβαση 1' };

  test('buildApeRegistryLinkKey', () => {
    expect(buildApeRegistryLinkKey(target)).toBe('ape:contract:0');
  });

  test('buildDiavgeiaApeRegistryEntry', () => {
    const entry = buildDiavgeiaApeRegistryEntry(
      { ada: 'ΡΩΕΚΩΨΜ-Σ0Υ', subject: 'ΑΠΕ', organization: 'Δήμος' },
      { linkKey: 'ape:contract:0', roleLabel: 'ΑΠΕ — Σύμβαση 1' }
    );
    expect(entry).toMatchObject({
      adam: 'ΡΩΕΚΩΨΜ-Σ0Υ',
      type: 'DIAV',
      stage: APE_REGISTRY_STAGE,
      source: 'diavgeia',
      amount: '',
      apeLinkKey: 'ape:contract:0',
    });
    expect(entry.openUrl).toContain('diavgeia.gov.gr');
  });

  test('mergeApeIntoDocumentRegistry με ΑΔΑ μόνο', () => {
    const project = { khmdhsDocumentRegistry: [] };
    const patch = mergeApeIntoDocumentRegistry(project, target, {
      targetTitle: 'Σύμβαση 1',
      diavgeiaAda: 'ΡΩΕΚΩΨΜ-Σ0Υ',
    });
    expect(patch.khmdhsDocumentRegistry).toHaveLength(1);
    expect(patch.khmdhsDocumentRegistry[0].source).toBe('diavgeia');
  });

  test('removeApeFromDocumentRegistry', () => {
    const project = {
      khmdhsDocumentRegistry: [
        { id: '1', apeLinkKey: 'ape:contract:0', stage: APE_REGISTRY_STAGE },
        { id: '2', apeLinkKey: 'ape:contract:1', stage: APE_REGISTRY_STAGE },
      ],
    };
    const patch = removeApeFromDocumentRegistry(project, target);
    expect(patch.khmdhsDocumentRegistry).toHaveLength(1);
    expect(patch.khmdhsDocumentRegistry[0].id).toBe('2');
  });
});
