#!/usr/bin/env python3
"""Regenerate README.md (frontier, status board, dependency graph, lanes) and each ticket's `Blocks` row
from its `Blocked by` row, and check every PRD/SDD anchor the tickets link to.

    python3 docs/tickets/gen-index.py              write README.md and the Blocks rows
    python3 docs/tickets/gen-index.py --check      write nothing; exit 1 when anything would change
    python3 docs/tickets/gen-index.py --anchors F  print `F<TAB>anchor` for every heading of each file F

`--dir` points it at another tickets directory (its specs are read from `<dir>/..`)."""
import argparse
import collections
import glob
import os
import re
import sys

STATUSES = ('ready', 'blocked', 'in-progress', 'done', 'blocked-by-date')
SPEC_FILES = ('SDD.md', 'PRD.md')


class TicketError(Exception):
    pass


def github_slug(heading, taken):
    """GitHub's heading anchor, as `github-slugger` computes it: lowercase, drop everything but
    letters, digits, `_`, `-` and spaces, turn each space into `-`, and number a repeat `-1`, `-2`.
    An em dash between spaces therefore leaves two hyphens."""
    base = re.sub(r'[^\w\- ]', '', heading.strip().lower()).replace(' ', '-')
    slug = base
    repeat = 0
    while slug in taken:
        repeat += 1
        slug = f'{base}-{repeat}'
    taken.add(slug)
    return slug


def heading_anchors(text):
    """Anchors in document order. A `#` line inside a fenced block is code, not a heading."""
    taken = set()
    anchors = []
    fenced = False
    for line in text.splitlines():
        if line.startswith('```'):
            fenced = not fenced
            continue
        heading = re.match(r'#{1,6} (.+)$', line)
        if heading and not fenced:
            anchors.append(github_slug(heading.group(1), taken))
    return anchors


def field(text, name, file):
    row = re.search(rf'^\| {name} \| (.+?) \|$', text, re.M)
    if row is None:
        raise TicketError(f'{file}: no `{name}` row')
    return row.group(1)


def status_of(text, file):
    line = re.search(r'^\*\*Status:\*\* (\S+)$', text, re.M)
    if line is None:
        raise TicketError(f'{file}: no `**Status:**` line')
    status = line.group(1)
    if status not in STATUSES:
        raise TicketError(f'{file}: unknown status `{status}`, expected one of {", ".join(STATUSES)}')
    return status


def read_ticket(file):
    text = open(file, encoding='utf-8').read()
    title = re.search(r'^# \d\d: (.+)$', text, re.M)
    if title is None:
        raise TicketError(f'{file}: no `# NN: title` heading')
    blocked_by = field(text, 'Blocked by', file)
    deps = [] if blocked_by.startswith('None') else [int(n) for n in re.findall(r'\b(\d\d)\b', blocked_by)]
    return {
        'file': file,
        'title': title.group(1),
        'phase': field(text, 'Phase', file),
        'size': field(text, 'Size', file),
        'deps': deps,
        'status': status_of(text, file),
        'text': text,
    }


def read_tickets():
    tickets = {}
    for file in sorted(glob.glob('[0-9][0-9]-*.md')):
        tickets[int(file[:2])] = read_ticket(file)
    return tickets


def broken_anchors(tickets):
    anchors = {name: set(heading_anchors(open(f'../{name}', encoding='utf-8').read())) for name in SPEC_FILES}
    broken = []
    for ticket in tickets.values():
        for link in re.finditer(r'\]\(\.\./((?:SDD|PRD)\.md)#([^)]+)\)', ticket['text']):
            if link.group(2) not in anchors[link.group(1)]:
                broken.append(f"{ticket['file']}: {link.group(0)}")
    return broken


def blocks_of(tickets):
    blocks = collections.defaultdict(list)
    for number, ticket in tickets.items():
        for dep in ticket['deps']:
            if dep not in tickets:
                raise TicketError(f'ticket {number:02d} depends on {dep:02d}, which does not exist')
            blocks[dep].append(number)
    return blocks


def levels_of(tickets):
    """A ticket's level is one past its deepest blocker. A foundation ticket added late carries a higher
    number than the tickets it blocks, so the walk follows the edges, not the numbers."""
    level = {}
    walking = []

    def visit(number):
        if number in level:
            return level[number]
        if number in walking:
            cycle = walking[walking.index(number):] + [number]
            raise TicketError('dependency cycle: ' + ' -> '.join(f'{n:02d}' for n in cycle))
        walking.append(number)
        deps = tickets[number]['deps']
        level[number] = 1 + max(visit(dep) for dep in deps) if deps else 0
        walking.pop()
        return level[number]

    for number in sorted(tickets):
        visit(number)
    return level


def board_status(tickets, number):
    """The stored status for work in hand; otherwise what the blockers allow."""
    status = tickets[number]['status']
    if status in ('done', 'in-progress'):
        return status
    if not all(tickets[dep]['status'] == 'done' for dep in tickets[number]['deps']):
        return 'blocked'
    if status == 'blocked-by-date':
        return 'blocked-by-date'
    return 'ready'


def frontier_of(tickets):
    return [number for number in sorted(tickets) if board_status(tickets, number) == 'ready']


def short(title):
    plain = re.sub(r'[*`]', '', title)
    plain = re.split(r' — |: | \(|, | with | and |; ', plain)[0]
    return plain if len(plain) <= 42 else plain[:40] + '…'


def two_digits(numbers):
    return ', '.join(f'{number:02d}' for number in numbers) or '—'


def with_blocks_row(ticket, blocks):
    return re.sub(r'\| Blocks \| .*? \|', f'| Blocks | {two_digits(sorted(blocks))} |', ticket['text'], count=1)


HEADER = """# Tickets — video-pipeline

Tracer-bullet tickets generated from [`PRD.md`](../PRD.md) and [`SDD.md`](../SDD.md) following the `to-tickets` method (Matt Pocock's skills library): each ticket is a **vertical slice** that is demoable on its own and sized for one fresh agent context window; numbering is **dependency order** (blockers have lower numbers), not priority, with one exception: a foundation ticket added after the tickets that build on it keeps the next free number and blocks them anyway, so the graph may point from a higher number to a lower one but never in a cycle. Each ticket's `Blocked by` row is authoritative; the `Blocks` rows, the frontier, the status board, the graph and the lanes below are generated from it by `python3 docs/tickets/gen-index.py` (which also validates every PRD/SDD anchor the tickets link to). Change a ticket's `**Status:**` line and re-run to update the board.
"""

HOW_TO = """## How to work a ticket (humans and agents)

1. Pick a ticket from the [frontier](#frontier). Prefer the lowest number in the current phase; parallel work is fine across lanes.
2. Read the ticket, then **only** the PRD/SDD sections it links. Do not read the whole SDD — the links are the context budget.
3. Create a branch `ticket/NN-slug`. Implement the *whole* slice: schema → code → tests → docs. Keep `.env.example`, `packages/job-contracts` and the SDD in sync if you touch them (the drift tests will tell you).
4. Every acceptance criterion becomes a test or a recorded demo (screenshot/GIF/result table in the PR).
5. PR checklist & Definition of Done:
   - All AC ticked with verifiable evidence.
   - Tests green under Node **and** Bun where the worker or shared packages are involved.
   - **Branch Protection, PR-Only Merges with Required Approval & Green CI in DoD:** Direct push to `main` is blocked. All changes must be made on `ticket/NN-slug`, opened as a GitHub Pull Request, reviewed with comments on the PR, and merged only after receiving at least one required review approval and all CI workflow checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) pass green on GitHub Actions.
   - **Persistent Agent Loop:** Implementor and reviewer agents remain active throughout the PR review-fix loop to evaluate feedback, push fixes or reply with rationale, and verify until approved.
   - **Optimal Execution & Zero-Waste Efficiency in DoD:** All workflows, Docker builds, CI steps, test suites, and local setup scripts MUST be optimized for speed, minimal resource consumption, and rapid feedback loops (Docker Buildx layer caching, sub-second linting, incremental typechecks, ultra-short test fixtures). Never introduce un-cached heavy operations or regressions in cycle time.
   - No new external runtime dependency (local-first, SDD P9 / PRD G11).
   - **Documentation, Architecture & README in DoD:** `README.md`, `ARCHITECTURE.md`, and `docs/SDD.md` (and relevant ADRs) MUST be updated if any feature, command, boundary, contract, workspace package, schema, or architecture decision is added or changed. Keep `README.md` accurate, professional, human-written, and continuously improved.
   - Ticket `**Status:**` set to `done`, `python3 docs/tickets/gen-index.py` re-run, and changes synced to GitHub Issues / Project board via CI or `pnpm sync:tickets`.
6. Found a decision the ticket doesn't cover? Don't guess silently: pick the option most consistent with the SDD ADRs, write it into the ticket's *Open questions* as "Decided: …", and flag it in the PR.

**Sizes:** S ≈ half a session · M ≈ one session · L ≈ one long session (still one context window if you follow the links only).
"""


def frontier_section(tickets):
    lines = ['## Frontier\n', "Every ticket whose blockers are all `done` and which nobody has started, computed from the `**Status:**` lines.\n"]
    frontier = frontier_of(tickets)
    for number in frontier:
        lines.append(f"- [{number:02d}: {re.sub(r'[*]', '', tickets[number]['title'])}]({tickets[number]['file']})")
    if not frontier:
        lines.append('- none: every ticket is done, in progress or behind a blocker')
    return lines


def readme(tickets, blocks, footer):
    lines = [HEADER, *frontier_section(tickets), '', HOW_TO, '## Status board\n']
    lines.append('| # | Ticket | Phase | Size | Blocked by | Blocks | Status |\n|---|---|---|---|---|---|---|')
    for number in sorted(tickets):
        ticket = tickets[number]
        title = re.sub(r'[*]', '', ticket['title'])
        phase = ticket['phase'].split(' —')[0]
        lines.append(
            f"| {number:02d} | [{title}]({ticket['file']}) | {phase} | {ticket['size']} | "
            f"{two_digits(ticket['deps'])} | {two_digits(sorted(blocks[number]))} | {board_status(tickets, number)} |"
        )
    lines.append(
        "\n> Board statuses derive from each ticket's `**Status:**` line and its blockers: `ready` = all blockers "
        'done (the frontier) · `blocked` · `in-progress` · `done` · `blocked-by-date` (blockers done, waiting for '
        'a date the ticket names).\n'
    )
    lines.append('## Dependency graph\n\n```mermaid\nflowchart LR')
    phases = collections.OrderedDict()
    for number in sorted(tickets):
        phases.setdefault(tickets[number]['phase'].split(' (')[0], []).append(number)
    for phase, numbers in phases.items():
        phase_id = re.sub(r'\W+', '_', phase)
        lines.append(f'    subgraph {phase_id}["{phase}"]')
        for number in numbers:
            lines.append(f'        T{number:02d}["{number:02d} {short(tickets[number]["title"])}"]')
        lines.append('    end')
    for number in sorted(tickets):
        for dep in tickets[number]['deps']:
            lines.append(f'    T{dep:02d} --> T{number:02d}')
    lines.append(
        '```\n\n## Parallel lanes (frontier levels)\n\nTickets in the same level have all their blockers in earlier '
        'levels, so they can run in parallel once the previous level is done — the schedule for several agents '
        'working at once.\n'
    )
    by_level = collections.defaultdict(list)
    for number, level in levels_of(tickets).items():
        by_level[level].append(number)
    lines.append('| Level | Tickets (can run in parallel) |\n|---|---|')
    for level in sorted(by_level):
        lanes = ' · '.join(f"[{n:02d}]({tickets[n]['file']}) {short(tickets[n]['title'])}" for n in sorted(by_level[level]))
        lines.append(f'| {level} | {lanes} |')
    lines.append(footer)
    return '\n'.join(lines), len(by_level)


def planned_writes(tickets):
    blocks = blocks_of(tickets)
    writes = {}
    for number, ticket in tickets.items():
        updated = with_blocks_row(ticket, blocks[number])
        if updated != ticket['text']:
            writes[ticket['file']] = updated
    index, level_count = readme(tickets, blocks, open('_footer.md', encoding='utf-8').read())
    if not os.path.exists('README.md') or open('README.md', encoding='utf-8').read() != index:
        writes['README.md'] = index
    return writes, level_count


def generate(check):
    tickets = read_tickets()
    broken = broken_anchors(tickets)
    if broken:
        raise TicketError('broken anchors:\n  ' + '\n  '.join(broken))
    writes, level_count = planned_writes(tickets)
    if check:
        if writes:
            raise TicketError('out of date, run python3 docs/tickets/gen-index.py: ' + ', '.join(sorted(writes)))
    else:
        for file, text in writes.items():
            open(file, 'w', encoding='utf-8').write(text)
    frontier = two_digits(frontier_of(tickets))
    print(f'ok: {len(tickets)} tickets, {level_count} levels, anchors valid, frontier {frontier}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--anchors', nargs='+', metavar='FILE')
    parser.add_argument('--dir', default=os.path.dirname(os.path.abspath(__file__)))
    args = parser.parse_args()
    if args.anchors:
        for file in args.anchors:
            for anchor in heading_anchors(open(file, encoding='utf-8').read()):
                print(f'{file}\t{anchor}')
        return
    os.chdir(args.dir)
    try:
        generate(args.check)
    except TicketError as error:
        print(error, file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
