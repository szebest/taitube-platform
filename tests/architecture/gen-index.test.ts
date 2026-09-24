import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import GithubSlugger from 'github-slugger';
import { markdownDocument, parseMarkdown } from './markdown';
import { ROOT, read } from './repo-files';

const GEN_INDEX = join(ROOT, 'docs/tickets/gen-index.py');

function genIndex(args: string[], input?: string) {
  const run = spawnSync('python3', [GEN_INDEX, ...args], { encoding: 'utf8', input });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

const EDGE_CASES = [
  '# ADR-24 — Result-typed errors',
  '## 5. Domain Model & Database Schema',
  '## `video_events` and `ErrorCode`',
  '## Notes',
  '## Notes',
  '### 13.3 KEDA (Redis, Prometheus) / fallback?',
  '#### Ünïcode: naïve café',
  '```sh',
  '# a comment, not a heading',
  '```',
].join('\n');

function slugsOf(text: string): string[] {
  const slugger = new GithubSlugger();
  return parseMarkdown(text).headings.map((heading) => slugger.slug(heading.text));
}

interface TicketFixture {
  number: string;
  status: string;
  blockedBy: string;
}

function ticketText({ number, status, blockedBy }: TicketFixture): string {
  return [
    `# ${number}: Ticket ${number}`,
    '',
    '| Field | Value |',
    '|---|---|',
    '| Phase | 1 — Fixture |',
    '| Size | S |',
    `| Blocked by | ${blockedBy} |`,
    '| Blocks | — |',
    '',
    `**Status:** ${status}`,
    '',
  ].join('\n');
}

/** An index directory with empty specs beside it, so the fixture never reads the real SDD. */
function ticketsDirectory(tickets: readonly TicketFixture[]): string {
  const docs = mkdtempSync(join(tmpdir(), 'gen-index-'));
  const dir = join(docs, 'tickets');
  mkdirSync(dir);
  writeFileSync(join(docs, 'SDD.md'), '# SDD\n');
  writeFileSync(join(docs, 'PRD.md'), '# PRD\n');
  writeFileSync(join(dir, '_footer.md'), '');
  for (const ticket of tickets) {
    writeFileSync(join(dir, `${ticket.number}-ticket.md`), ticketText(ticket));
  }
  return dir;
}

function frontierLines(dir: string): string[] {
  const readme = readFileSync(join(dir, 'README.md'), 'utf8');
  const section = readme.slice(readme.indexOf('## Frontier'), readme.indexOf('## How to work'));
  return section.split('\n').filter((line) => line.startsWith('- '));
}

describe('architecture: gen-index', () => {
  it('holds the index current, every status in the vocabulary and every spec anchor real', () => {
    const run = genIndex(['--check']);

    expect(run.output).toMatch(/^ok: /);
    expect(run.status).toBe(0);
  });

  it.each([
    ['SDD', 'docs/SDD.md'],
    ['PRD', 'docs/PRD.md'],
  ])('slugs every %s heading the way github-slugger does', (_name, file) => {
    const slugger = new GithubSlugger();
    const expected = markdownDocument(file).headings.map((heading) => slugger.slug(heading.text));

    expect(genIndex(['--anchors'], read(file)).output.trim().split('\n')).toEqual(expected);
  });

  it('agrees with github-slugger on dashes, ampersands, code, repeats, unicode and fences', () => {
    const expected = slugsOf(EDGE_CASES);

    expect(expected).toContain('adr-24--result-typed-errors');
    expect(expected).toContain('notes-1');
    expect(genIndex(['--anchors'], EDGE_CASES).output.trim().split('\n')).toEqual(expected);
  });

  it('refuses a status outside the vocabulary', () => {
    const dir = ticketsDirectory([{ number: '01', status: 'ready-for-agent', blockedBy: 'None' }]);

    const run = genIndex(['--dir', dir]);
    rmSync(join(dir, '..'), { recursive: true });

    expect(run.status).toBe(1);
    expect(run.output).toContain('01-ticket.md: unknown status `ready-for-agent`');
  });

  it('moves the frontier when a status changes', () => {
    const dir = ticketsDirectory([
      { number: '01', status: 'in-progress', blockedBy: 'None' },
      { number: '02', status: 'ready', blockedBy: '01 — Ticket 01' },
    ]);

    genIndex(['--dir', dir]);
    const whileOpen = frontierLines(dir);
    writeFileSync(
      join(dir, '01-ticket.md'),
      ticketText({ number: '01', status: 'done', blockedBy: 'None' })
    );
    genIndex(['--dir', dir]);
    const afterDone = frontierLines(dir);
    rmSync(join(dir, '..'), { recursive: true });

    expect(whileOpen).toEqual(['- none: every ticket is done, in progress or behind a blocker']);
    expect(afterDone).toEqual(['- [02: Ticket 02](02-ticket.md)']);
  });
});
