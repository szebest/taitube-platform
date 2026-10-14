# High-impact decisions

The procedures behind SKILL.md section 1. Read before a decision it calls high-impact, and
whenever an instruction, ticket, spec or plan looks wrong or short-sighted.

## Is it high-impact?

Yes when it sets any of these (a one-way door):

- a contract or public API shape: a request or response, an event payload, a package
  export, a shared component's props
- data that outlives the release: a persisted key or column, a migration, a config or
  environment key, a metric or event name, a feature flag
- placement across packages, apps or tiers, or a new dependency
- a pattern others will copy: a shared helper, a provider, a registry, a folder convention
- behaviour a user, tester or data consumer notices
- what the next tickets on the surface build on, or anything costly to undo after merge

Everything else is routine: decide, and record why in the plan when there is one.

## Look ahead

1. Read the parent epic and its open children, sibling tickets, the plan's follow-ups and
   the docs that set direction.
2. List the next two or three known additions to this surface.
3. For two or three options ask: does each next addition extend it or rewrite it? What
   debt does it leave and which ticket pays it? What breaks if a requirement shifts? Can
   it be undone after merge?
4. Pick the option the next tickets extend over the one fastest today. A shortcut is fine
   only when it is cheap to remove, named, and its removal has a ticket.

## Question the inputs

1. List the decisions the input makes: each name and what it means, each field and where
   its value comes from, placement, contract use, behaviour someone sees.
2. Check each against the code (grep the name: does it exist, mean that, live there?), the
   contracts (generated types, schemas, payloads) and the roadmap (Look ahead).
3. Wrong, short-sighted or worse than an alternative: ask (below) before building on it.
   Right: follow it without comment.
4. A rule applied for an effect: check its premise in this code, measure when cheap, and
   put the verdict with its evidence in the reply. A premise that does not hold means the
   rule is not applied.
5. A decision the user already made on the same facts is never re-argued; only a new fact
   reopens it.

## Ask well

- One message, before the code.
- The decision in one line, then two or three options, each with pros and cons including
  its future cost and its blast radius, then your recommendation and why. About ten lines;
  print code-shape alternatives as fenced code.
- Never ask about routine choices or what the request already answers.

## After the user decides

Record the decision and its reason in the plan, the design doc's decision log, or the PR
body when there is neither, so the next ticket builds on it instead of re-litigating it.
