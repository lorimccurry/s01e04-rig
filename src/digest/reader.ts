import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, NightDigest, ReadNight } from './types.js';

// Shape of one parsed line in runs/<night>.jsonl.
type RunLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

function isRunLine(value: unknown): value is RunLine {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.at === 'string' &&
    typeof v.job === 'string' &&
    (v.status === 'ok' || v.status === 'retry' || v.status === 'fail') &&
    (v.owner === null || typeof v.owner === 'string') &&
    (v.error === undefined || typeof v.error === 'string')
  );
}

// Reads runs/<night>.jsonl under `runsDir` into one DigestRow per distinct job. Lines
// that fail to parse (or don't match the expected shape) are skipped, never thrown,
// and counted in `badLines`.
export const readNight: ReadNight = (runsDir: string, night: string): NightDigest => {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  const rows = new Map<string, DigestRow>();
  // Parsed `at` instant per job, tracked alongside `rows` to resolve first/last
  // chronologically even if a job's lines appear out of order in the file.
  const firstMs = new Map<string, number>();
  const lastMs = new Map<string, number>();
  let badLines = 0;

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!isRunLine(parsed)) {
      badLines++;
      continue;
    }

    const at = Date.parse(parsed.at);
    const existing = rows.get(parsed.job);

    if (!existing) {
      rows.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      firstMs.set(parsed.job, at);
      lastMs.set(parsed.job, at);
      continue;
    }

    existing.runs++;
    if (parsed.status === 'retry') existing.retries++;

    if (at < (firstMs.get(parsed.job) ?? at)) {
      existing.firstAt = parsed.at;
      firstMs.set(parsed.job, at);
    }
    if (at >= (lastMs.get(parsed.job) ?? at)) {
      existing.lastAt = parsed.at;
      existing.lastStatus = parsed.status;
      existing.lastError = parsed.error ?? null;
      existing.owner = parsed.owner;
      lastMs.set(parsed.job, at);
    }
  }

  return { rows: Array.from(rows.values()), badLines };
};
