import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-01-02.jsonl'),
    [
      '{"at":"2026-01-02T01:00:00+01:00","job":"b/job","status":"retry","owner":"ann","error":"busy"}',
      'not json',
      '{"at":"2026-01-02T01:01:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
      '{"at":"2026-01-02T01:02:00+01:00","job":"b/job","status":"ok","owner":"ann"}',
    ].join('\n'),
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

describe('digest routes', () => {
  it('page and JSON answer 200 and agree on jobs and order', async () => {
    const page = await app.request('/digest/2026-01-02');
    const json = await app.request('/api/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const html = await page.text();
    const body = (await json.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
  });

  it('a night with a bad line still renders and counts it', async () => {
    const html = await (await app.request('/digest/2026-01-02')).text();
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('—');
    expect(((await (await app.request('/api/digest/2026-01-02')).json()) as { badLines: number }).badLines).toBe(1);
  });

  it('a night with no file is 404 on both', async () => {
    expect((await app.request('/digest/2026-01-03')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-03')).status).toBe(404);
  });

  it('an empty night renders "nothing ran"', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
    expect(((await (await app.request('/api/digest/2026-01-01')).json()) as { rows: unknown[] }).rows).toEqual([]);
  });
});
