import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest json', () => {
  it('returns the night digest sorted by job, with bad lines counted', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('answers 404 for a night with no run log', async () => {
    const res = await createApp(config).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe('digest page', () => {
  it('renders the night sorted by job, with flagged rows and bad-line-tolerant data', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');

    const jobOrder = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];
    for (const job of jobOrder) expect(html).toContain(job);

    const indices = jobOrder.map((job) => html.indexOf(job));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    // fixtures/refresh (3 retries) and notes/backup (fail) are flagged; lane/sync is not.
    expect(html).toMatch(/<tr class="warn"><td>fixtures\/refresh/);
    expect(html).toMatch(/<tr class="warn"><td>notes\/backup/);
    expect(html).toMatch(/<tr><td>lane\/sync/);

    // digest/render has a null owner, rendered as —.
    expect(html).toContain('—');
  });

  it('404s for a night with no run log', async () => {
    const res = await createApp(config).request('/digest/1999-01-01');
    expect(res.status).toBe(404);
  });
});

describe('digest edge cases', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('returns an empty-but-ok digest for a night with no run lines', async () => {
    writeFileSync(join(runsDir, '2026-11-01.jsonl'), '');
    const edgeConfig = { ...config, runsDir };

    const jsonRes = await createApp(edgeConfig).request('/api/digest/2026-11-01');
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);

    const pageRes = await createApp(edgeConfig).request('/digest/2026-11-01');
    expect(pageRes.status).toBe(200);
    const html = await pageRes.text();
    expect(html).toContain('nothing ran');
  });

  it('tolerates a malformed line, counting it without throwing', async () => {
    const lines = [
      '{"at":"2026-11-01T10:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      'not valid json at all',
      '{"at":"2026-11-01T11:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
    ];
    writeFileSync(join(runsDir, '2026-11-02.jsonl'), lines.join('\n'));
    const edgeConfig = { ...config, runsDir };

    const jsonRes = await createApp(edgeConfig).request('/api/digest/2026-11-02');
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].job).toBe('lane/sync');
    expect(body.rows[0].runs).toBe(2);

    const pageRes = await createApp(edgeConfig).request('/digest/2026-11-02');
    expect(pageRes.status).toBe(200);
    const html = await pageRes.text();
    expect(html).toContain('lane/sync');
  });
});
