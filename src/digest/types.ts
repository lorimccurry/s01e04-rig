// A single line in a night's run log (runs/<night>.jsonl).
export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per distinct job, aggregated from every line for that job in a night's run log.
export type DigestRow = {
  job: string; // job name, e.g. "lane/sync"
  owner: string | null; // owner of the chronologically last line for this job
  runs: number; // count of lines seen for this job
  retries: number; // count of lines with status "retry" for this job
  lastStatus: JobStatus; // status of the chronologically last line
  lastError: string | null; // error of the chronologically last line, null if it had none
  firstAt: string; // earliest `at` timestamp, original offset preserved as-is
  lastAt: string; // latest `at` timestamp, original offset preserved as-is
};

// Result of reading one night's run log: the aggregated rows plus how many lines
// failed to parse (and were skipped rather than thrown).
export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
};

// Reads runs/<night>.jsonl under `runsDir` and aggregates it into one row per distinct
// job. A line that fails to parse is skipped, never thrown, and counted in `badLines`.
// Implemented in `./reader.ts`.
export type ReadNight = (runsDir: string, night: string) => NightDigest;
