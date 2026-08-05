/**
 * @jest-environment node
 */
import {
  ELECTRON_UPGRADE_RISK_AREAS,
  ELECTRON_UPGRADE_PHASES,
  ELECTRON_UPGRADE_SEVERITY,
  getSmokeRequiredRiskAreas,
  getCriticalRiskAreas,
  CURRENT_ELECTRON_MAJOR,
} from './electronUpgradeRiskAreas';

describe('electronUpgradeRiskAreas — E1 χάρτης κινδύνου', () => {
  test('υπάρχουν κρίσιμες περιοχές που απαιτούν smoke', () => {
    const critical = getCriticalRiskAreas();
    expect(critical.length).toBeGreaterThanOrEqual(5);
    expect(critical.every((a) => a.smokeRequired)).toBe(true);
  });

  test('το smoke set καλύπτει boot, login, λίστα, αποθήκευση, διαλόγους, ΚΗΜΔΗΣ, PDF', () => {
    const ids = getSmokeRequiredRiskAreas().map((a) => a.id);
    for (const required of [
      'app-boot',
      'login',
      'project-list',
      'save-lock',
      'native-dialogs',
      'khmdhs-fetch',
      'pdf-view',
    ]) {
      expect(ids).toContain(required);
    }
  });

  test('φάσεις αναβάθμισης ξεκινούν από το τρέχον major και δεν είναι άλμα', () => {
    expect(CURRENT_ELECTRON_MAJOR).toBe(25);
    expect(ELECTRON_UPGRADE_PHASES[0].from).toBe(25);
    expect(ELECTRON_UPGRADE_PHASES[0].to).toBe(28);
    expect(ELECTRON_UPGRADE_PHASES.length).toBeGreaterThanOrEqual(3);
  });

  test('κάθε περιοχή έχει id, severity, title, why', () => {
    const severities = new Set(Object.values(ELECTRON_UPGRADE_SEVERITY));
    for (const area of ELECTRON_UPGRADE_RISK_AREAS) {
      expect(area.id).toBeTruthy();
      expect(severities.has(area.severity)).toBe(true);
      expect(area.title.length).toBeGreaterThan(3);
      expect(area.why.length).toBeGreaterThan(3);
    }
  });
});
