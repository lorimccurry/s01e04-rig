import { describe, expect, it } from 'vitest';
import { readNight } from '../../src/digest/reader.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into one row per distinct job, skipping the bad line', () => {
    const { rows, badLines } = readNight('runs', '2026-10-28');

    expect(rows.map((r) => r.job).sort()).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(badLines).toBe(1);

    const digestRender = rows.find((r) => r.job === 'digest/render');
    expect(digestRender?.owner).toBeNull();

    const fixturesRefresh = rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixturesRefresh?.retries).toBeGreaterThan(0);
    expect(fixturesRefresh?.retries).toBe(3);
    expect(fixturesRefresh?.lastStatus).toBe('ok');
    expect(fixturesRefresh?.lastError).toBeNull();

    const laneSync = rows.find((r) => r.job === 'lane/sync');
    expect(laneSync?.runs).toBe(8);
    expect(laneSync?.retries).toBe(1);
    expect(laneSync?.lastStatus).toBe('ok');
    expect(laneSync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(laneSync?.lastAt).toBe('2026-10-29T05:00:04+01:00');

    const notesBackup = rows.find((r) => r.job === 'notes/backup');
    expect(notesBackup?.lastStatus).toBe('fail');
    expect(notesBackup?.lastError).toBe('quota exceeded');
  });
});
