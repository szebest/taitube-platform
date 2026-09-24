import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import GithubSlugger from 'github-slugger';
import { parseMarkdown } from '../architecture/markdown';
import { ROOT, read } from '../architecture/repo-files';

const GEN_INDEX = join(ROOT, 'docs/tickets/gen-index.py');

interface Run {
  status: number | null;
  output: string;
}

/** Asynchronous, so the runs below overlap: each one is mostly Python starting up. */
function genIndex(args: string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn('python3', [GEN_INDEX, ...args]);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('close', (status) => resolve({ status, output }));
  });
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

const EDGE_CASES_FILE = join(mkdtempSync(join(tmpdir(), 'gen-index-')), 'edge-cases.md');

const SLUGGED = [
  { file: join(ROOT, 'docs/SDD.md'), text: () => read('docs/SDD.md') },
  { file: join(ROOT, 'docs/PRD.md'), text: () => read('docs/PRD.md') },
  { file: EDGE_CASES_FILE, text: () => EDGE_CASES },
];

async function frontierAcrossAStatusChange(): Promise<{
  whileOpen: string[];
  afterDone: string[];
}> {
  const dir = ticketsDirectory([
    { number: '01', status: 'in-progress', blockedBy: 'None' },
    { number: '02', status: 'ready', blockedBy: '01 — Ticket 01' },
  ]);
  await genIndex(['--dir', dir]);
  const whileOpen = frontierLines(dir);
  writeFileSync(
    join(dir, '01-ticket.md'),
    ticketText({ number: '01', status: 'done', blockedBy: 'None' })
  );
  await genIndex(['--dir', dir]);
  const afterDone = frontierLines(dir);
  rmSync(join(dir, '..'), { recursive: true });
  return { whileOpen, afterDone };
}

async function refusedStatus(): Promise<Run> {
  const dir = ticketsDirectory([{ number: '01', status: 'ready-for-agent', blockedBy: 'None' }]);
  const run = await genIndex(['--dir', dir]);
  rmSync(join(dir, '..'), { recursive: true });
  return run;
}

describe('architecture: gen-index', () => {
  let check: Run;
  let anchors: Run;
  let refusal: Run;
  let frontier: { whileOpen: string[]; afterDone: string[] };

  beforeAll(async () => {
    writeFileSync(EDGE_CASES_FILE, EDGE_CASES);
    [check, anchors, refusal, frontier] = await Promise.all([
      genIndex(['--check']),
      genIndex(['--anchors', ...SLUGGED.map(({ file }) => file)]),
      refusedStatus(),
      frontierAcrossAStatusChange(),
    ]);
    rmSync(dirname(EDGE_CASES_FILE), { recursive: true });
  });

  it('holds the index current, every status in the vocabulary and every spec anchor real', () => {
    expect(check.output).toMatch(/^ok: /);
    expect(check.status).toBe(0);
  });

  it('slugs every SDD and PRD heading, and the edge cases, the way github-slugger does', () => {
    const expected = SLUGGED.flatMap(({ file, text }) =>
      slugsOf(text()).map((anchor) => `${file}\t${anchor}`)
    );

    expect(slugsOf(EDGE_CASES)).toContain('adr-24--result-typed-errors');
    expect(slugsOf(EDGE_CASES)).toContain('notes-1');
    expect(anchors.output.trim().split('\n')).toEqual(expected);
  });

  it('refuses a status outside the vocabulary', () => {
    expect(refusal.status).toBe(1);
    expect(refusal.output).toContain('01-ticket.md: unknown status `ready-for-agent`');
  });

  it('moves the frontier when a status changes', () => {
    expect(frontier.whileOpen).toEqual([
      '- none: every ticket is done, in progress or behind a blocker',
    ]);
    expect(frontier.afterDone).toEqual(['- [02: Ticket 02](02-ticket.md)']);
  });
});
