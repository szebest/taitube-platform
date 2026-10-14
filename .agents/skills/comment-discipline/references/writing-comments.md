# Working the two questions

Examples for the two questions in `SKILL.md`. Read when an Earned case applies and you are
deciding the wording.

## Question 1: what wrong change does it prevent?

The code already says what it does and how. The one thing it cannot say is why it is
written this way instead of the obvious way.

```ts
// BAD - restates the code
// increment the retry counter
retries += 1;

// GOOD - why, one line, not guessable
// The payment provider rounds half-up; matching it stops totals drifting a cent.
amount = roundHalfUp(amount);
```

Trim rather than explain:

```ts
// BAD (four lines of history)
// We need to check the cache first here because the downstream service has a
// rate limit of 100 requests per minute and during peak traffic we were seeing
// a lot of 429 errors, so this was added to reduce the number of calls.

// GOOD
// Cache first: upstream rate-limits at 100 rpm and returns 429 at peak.
```

## Question 2: is it still doing work in six months?

- **Does it say something the code does not?** If answering needs memory of the change,
  the branch or the conversation, delete it.
- **Would you trust it?** A comment you would have to double-check before believing is
  worse than none.
- **Would you write it again from scratch**, reading the final code with no memory of how
  it got there?

```ts
// DIES - true only while you remember the option you rejected
// Using a Map here because the array lookup was too slow.
const byId = new Map(items.map((item) => [item.id, item]));

// SURVIVES - names the twin, so the next editor can check it
// Must match the max upload size in the reverse proxy config.
const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
```

```ts
// DIES - "weird" is a memory, not a fact
// The fixture looks weird but it is correct.
const order = makeOrder([{ sku: 'x', qty: 0 }]);

// SURVIVES - says what is odd and why it must stay
// qty 0 is legal while a draft is restored; the row survives for undo.
const order = makeOrder([{ sku: 'x', qty: 0 }]);
```

## Never explain the diff

A comment describes the code as it is now; readers only ever see the current version. This
matters most when revising code you added earlier in the same task: that version never
existed for anyone else, so explaining why it changed explains a difference from nothing.

The rare survivor is a constraint that outlives the change, written as a present-tense
fact:

```ts
// BAD - history
// Changed from recursion because it was blowing the stack.

// GOOD - a constraint someone would plausibly undo
// Iterative: recursion overflows on deep trees.
```

## No process residue

Never mention or hint at the conversation, the user, the prompt, the review, the agent,
plans, specs, requirements, phases or steps, tickets used as the explanation, when or by
whom the code changed, or your own reasoning. A comment must make sense without following
a link. A stable public reference (an RFC, a CVE, an upstream issue, vendor docs) may
follow the explanation as evidence.

## Form

- One line above the code; trailing only for very short annotations.
- Plain present-tense statements: no hedging, no apology, no banners.
- `TODO` or `FIXME` only when the action is clear on its own.
- A file commented in a style you dislike: match it, and tell the user about the mismatch
  instead of reformatting it.
