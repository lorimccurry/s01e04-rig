import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lastBeat, type Beat } from './heartbeat.js';

// Per-night counts of each job's final status that night (one count per distinct job,
// not raw line counts).
export type NightSummary = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Nights on disk a night at a time always have their file present (nightsOnDisk only lists
// files that exist), so readNight won't throw ENOENT here.
function summarizeNight(runsDir: string, night: string): NightSummary {
  const { rows } = readNight(runsDir, night);
  const summary: NightSummary = { night, ok: 0, retry: 0, fail: 0 };
  for (const row of rows) summary[row.lastStatus]++;
  return summary;
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => summarizeNight(config.runsDir, night)),
  };
}
