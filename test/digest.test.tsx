import { describe, expect, it } from 'vitest';
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
