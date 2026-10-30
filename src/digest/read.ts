import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  if (o.owner !== null && o.owner !== undefined && typeof o.owner !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : undefined,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || !existsSync(file)) return null;
  return summarize(night, readFileSync(file, 'utf8'));
};

export function summarize(night: string, text: string): Night {
  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const l = parseLine(raw);
    if (!l) {
      badLines++;
      continue;
    }
    counts[l.status]++;
    const r = rows.get(l.job);
    if (!r) {
      rows.set(l.job, {
        job: l.job,
        owner: l.owner,
        runs: 1,
        retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status,
        lastError: l.error ?? null,
        firstAt: l.at,
        lastAt: l.at,
      });
      continue;
    }
    r.runs++;
    if (l.status === 'retry') r.retries++;
    if (l.owner !== null) r.owner = l.owner;
    // Lines are in time order; keep the offset as logged.
    r.lastStatus = l.status;
    if (l.error) r.lastError = l.error;
    r.lastAt = l.at;
  }
  return { night, rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines, counts };
}
