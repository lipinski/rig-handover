// Plan morning-digest § 1. The contract section 2 builds against.
export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null when runs/<night>.jsonl does not exist.
export type ReadNight = (runsDir: string, night: string) => Night | null;
