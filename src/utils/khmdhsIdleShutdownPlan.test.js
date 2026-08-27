/**
 * @jest-environment node
 */
import {
  KHMDHS_IDLE_SHUTDOWN_DELAY_SEC,
  KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC,
  KHMDHS_IDLE_SHUTDOWN_COMMENT,
  buildKhmdhsIdleShutdownAbortArgv,
  buildKhmdhsIdleShutdownArgv,
  clampKhmdhsIdleShutdownDelaySec,
  sanitizeKhmdhsIdleShutdownComment,
  shouldCommitKhmdhsIdleShutdown,
} from './khmdhsIdleShutdownPlan';

describe('khmdhsIdleShutdownPlan', () => {
  test('η ένδειξη είναι ένα λεπτό και τα Windows παίρνουν λίγο περισσότερο', () => {
    expect(KHMDHS_IDLE_SHUTDOWN_DELAY_SEC).toBe(60);
    expect(KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC).toBe(75);
    expect(KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC).toBeGreaterThan(KHMDHS_IDLE_SHUTDOWN_DELAY_SEC);
  });

  test('σβήνει μόνο μετά από πέρασμα που ζητήθηκε φεύγοντας', () => {
    expect(shouldCommitKhmdhsIdleShutdown({
      shutdownAfter: true,
      isRetry: false,
      cancelled: false,
    })).toBe(true);
  });

  test('ακύρωση ή επανάληψη δεν σβήνουν τον υπολογιστή', () => {
    expect(shouldCommitKhmdhsIdleShutdown({
      shutdownAfter: true,
      cancelled: true,
    })).toBe(false);
    expect(shouldCommitKhmdhsIdleShutdown({
      shutdownAfter: true,
      isRetry: true,
    })).toBe(false);
    expect(shouldCommitKhmdhsIdleShutdown({
      shutdownAfter: false,
    })).toBe(false);
  });

  test('τα ορίσματα shutdown.exe είναι σταθερά, χωρίς κέλυφος', () => {
    const args = buildKhmdhsIdleShutdownArgv(KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC, KHMDHS_IDLE_SHUTDOWN_COMMENT);
    expect(args[0]).toBe('/s');
    expect(args[1]).toBe('/t');
    expect(args[2]).toBe(String(KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC));
    expect(args[3]).toBe('/f');
    expect(args[4]).toBe('/c');
    expect(args[5]).toContain('ERGOHUB');
    expect(args[5]).not.toMatch(/[\r\n"]/);
    expect(buildKhmdhsIdleShutdownAbortArgv()).toEqual(['/a']);
  });

  test('καθυστέρηση εκτός ορίων κόβεται', () => {
    expect(clampKhmdhsIdleShutdownDelaySec(0)).toBe(1);
    expect(clampKhmdhsIdleShutdownDelaySec(9999)).toBe(600);
    expect(clampKhmdhsIdleShutdownDelaySec('x')).toBe(60);
  });

  test('το σχόλιο δεν σπάει τη γραμμή εντολών', () => {
    expect(sanitizeKhmdhsIdleShutdownComment('α"β\nγ')).toBe('α β γ');
  });
});
