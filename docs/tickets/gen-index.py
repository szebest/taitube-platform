#!/usr/bin/env python3
"""Regenerate README.md (status board, dependency graph, lanes) and the `Blocks` rows from each ticket's `Blocked by` row.
Usage: python3 docs/tickets/gen-index.py   (run from repo root or this folder). Also validates PRD/SDD anchors used by tickets."""
import re, os, glob, collections, sys
here=os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
def anchor(h):
    a=h.strip().lower(); a=re.sub(r'[^\w\s-]','',a); return re.sub(r'\s+','-',a)
anchors={f:{anchor(m.group(2)) for m in re.finditer(r'^(#{1,3}) (.+)$', open('../'+f, encoding='utf-8').read(), re.M)} for f in ['SDD.md','PRD.md']}
T={}
for f in sorted(glob.glob('[0-9][0-9]-*.md')):
    s=open(f, encoding='utf-8').read(); n=int(f[:2])
    title=re.search(r'^# \d\d: (.+)$', s, re.M).group(1)
    phase=re.search(r'\| Phase \| (.+?) \|', s).group(1)
    size=re.search(r'\| Size \| (.+?) \|', s).group(1)
    bb=re.search(r'\| Blocked by \| (.+?) \|', s).group(1)
    deps=[] if bb.startswith('None') else [int(x) for x in re.findall(r'\b(\d\d)\b', bb)]
    status=re.search(r'\*\*Status:\*\* ([\w-]+)', s).group(1)
    T[n]=dict(file=f,title=title,phase=phase,size=size,deps=deps,text=s,status=status)
bad=[(t['file'],m.group(0)) for t in T.values() for m in re.finditer(r'\]\((\.\./(SDD|PRD)\.md)#([^)]+)\)', t['text']) if m.group(3) not in anchors[m.group(2)+'.md']]
if bad: print("BAD ANCHORS:", *bad, sep='\n  '); sys.exit(1)
blocks=collections.defaultdict(list)
for n,t in T.items():
    for d in t['deps']:
        assert d in T and d<n, f"ticket {n:02d} depends on {d:02d}: blockers must have lower numbers"
        blocks[d].append(n)
level={}
for n in sorted(T): level[n]=0 if not T[n]['deps'] else 1+max(level[d] for d in T[n]['deps'])
def short(t):
    s=re.sub(r'[*`]','',t); s=re.split(r' — |: | \(|, | with | and |; ', s)[0]; return s if len(s)<=42 else s[:40]+'…'
for n,t in T.items():
    b=', '.join(f"{x:02d}" for x in sorted(blocks[n])) or '—'
    s=re.sub(r'\| Blocks \| .*? \|', f'| Blocks | {b} |', t['text'], count=1)
    if s!=t['text']: open(t['file'],'w', encoding='utf-8').write(s)
def done(n): return T[n]['status']=='done'
def board_status(n):
    st=T[n]['status']
    if st in ('done','in-progress'): return st
    if n==34 and not all(done(d) for d in T[n]['deps']): return 'blocked'
    if T[n]['status']=='blocked-by-date': return 'blocked-by-date'
    return 'ready' if all(done(d) for d in T[n]['deps']) else 'blocked'
L=["# Tickets — video-pipeline\n",
"Tracer-bullet tickets generated from [`PRD.md`](../PRD.md) and [`SDD.md`](../SDD.md) following the `to-tickets` method (Matt Pocock's skills library): each ticket is a **vertical slice** that is demoable on its own and sized for one fresh agent context window; numbering is **dependency order** (blockers always have lower numbers), not priority. Each ticket's `Blocked by` row is authoritative; the `Blocks` rows, the status board, the graph and the lanes below are generated from it by `python3 docs/tickets/gen-index.py` (which also validates every PRD/SDD anchor the tickets link to). Change a ticket's `**Status:**` line and re-run to update the board.\n",
"## How to work a ticket (humans and agents)\n",
"""1. Pick any ticket whose blockers are all `done` (the **frontier**). Prefer the lowest number in the current phase; parallel work is fine across lanes. **Frontier Priority Policy:** Tickets 79 and 80 take strict precedence over Phase 5 frontend tickets (36+). Complete operational hardening (Ticket 79) and developer experience / test pipeline acceleration (Ticket 80) before picking up frontend feature tickets.
2. Read the ticket, then **only** the PRD/SDD sections it links. Do not read the whole SDD — the links are the context budget.
3. Create a branch `ticket/NN-slug`. Implement the *whole* slice: schema → code → tests → docs. Keep `.env.example`, `packages/job-contracts` and the SDD in sync if you touch them (the drift tests will tell you).
4. Every acceptance criterion becomes a test or a recorded demo (screenshot/GIF/result table in the PR).
5. PR checklist & Definition of Done:
   - All AC ticked with verifiable evidence.
   - Tests green under Node **and** Bun where the worker or shared packages are involved.
   - **Green CI in Definition of Done (Strict Barrier):** All CI workflow checks (`lint-typecheck`, `unit`, `unit-bun`, `integration`, `e2e-smoke`) MUST pass green on GitHub Actions before any ticket is marked `done` or merged. A PR or review may be prepared, but reviewers (or the implementing agent) MUST raise a blocking issue if any CI check fails, and strictly forbid merging or finishing any ticket with failing CI checks.
   - **Optimal Execution & Zero-Waste Efficiency in DoD:** All workflows, Docker builds, CI steps, test suites, and local setup scripts MUST be optimized for speed, minimal resource consumption, and rapid feedback loops (Docker Buildx layer caching, sub-second linting, incremental typechecks, ultra-short test fixtures). Never introduce un-cached heavy operations or regressions in cycle time.
   - No new external runtime dependency (local-first, SDD P9 / PRD G11).
   - **Documentation, Architecture & README in DoD:** `README.md`, `ARCHITECTURE.md`, and `docs/SDD.md` (and relevant ADRs) MUST be updated if any feature, command, boundary, contract, workspace package, schema, or architecture decision is added or changed. Keep `README.md` accurate, professional, human-written, and continuously improved.
   - Ticket `**Status:**` set to `done`, `python3 docs/tickets/gen-index.py` re-run, and changes synced to GitHub Issues / Project board via CI or `pnpm sync:tickets`.
6. Found a decision the ticket doesn't cover? Don't guess silently: pick the option most consistent with the SDD ADRs, write it into the ticket's *Open questions* as "Decided: …", and flag it in the PR.

**Sizes:** S ≈ half a session · M ≈ one session · L ≈ one long session (still one context window if you follow the links only).
""",
"## Status board\n",
"| # | Ticket | Phase | Size | Blocked by | Blocks | Status |\n|---|---|---|---|---|---|---|"]
for n in sorted(T):
    t=T[n]; d=', '.join(f"{x:02d}" for x in t['deps']) or '—'; b=', '.join(f"{x:02d}" for x in sorted(blocks[n])) or '—'
    L.append(f"| {n:02d} | [{re.sub(r'[*]','',t['title'])}]({t['file']}) | {t['phase'].split(' —')[0]} | {t['size']} | {d} | {b} | {board_status(n)} |")
L.append("\n> Board statuses derive from each ticket's `**Status:**` line: `ready` = all blockers done (the frontier) · `blocked` · `in-progress` · `done` · `blocked-by-date` (34 waits for Node 26 LTS on 2026-10-28).\n")
L.append("## Dependency graph\n\n```mermaid\nflowchart LR")
phases=collections.OrderedDict()
for n in sorted(T): phases.setdefault(T[n]['phase'].split(' (')[0],[]).append(n)
for ph,ns in phases.items():
    pid=re.sub(r"\W+","_",ph)
    L.append(f'    subgraph {pid}["{ph}"]')
    for n in ns: L.append(f'        T{n:02d}["{n:02d} {short(T[n]["title"])}"]')
    L.append('    end')
for n in sorted(T):
    for d in T[n]['deps']: L.append(f'    T{d:02d} --> T{n:02d}')
L.append("```\n\n## Parallel lanes (frontier levels)\n\nTickets in the same level have all their blockers in earlier levels, so they can run in parallel once the previous level is done — the schedule for several agents working at once.\n")
byl=collections.defaultdict(list)
for n,l in level.items(): byl[l].append(n)
L.append("| Level | Tickets (can run in parallel) |\n|---|---|")
for l in sorted(byl): L.append(f"| {l} | "+' · '.join(f"[{n:02d}]({T[n]['file']}) {short(T[n]['title'])}" for n in sorted(byl[l]))+" |")
L.append(open('_footer.md', encoding='utf-8').read())
open('README.md','w', encoding='utf-8').write('\n'.join(L))
print(f"ok: {len(T)} tickets, {len(byl)} levels, anchors valid")
