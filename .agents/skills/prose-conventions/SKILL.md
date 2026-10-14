---
name: prose-conventions
description: >-
  Voice and review threshold for prose published under the maintainer's name. Use
  before drafting a PR title or body, a review comment, a reply on a PR or issue, or any
  draft shown to the user. Not for code comments (comment-discipline) or commit messages
  (git-and-pr-conventions).
---

# Prose conventions

Anything published under the maintainer's name reads like a person, not an assistant: a
generic assistant voice is a defect.

## The voice

Short, concrete, no ceremony. Open on the point in first person; no preamble. Name the
function or file you mean, stop. A code block replaces a paragraph whenever it can.

| Surface | Length |
| --- | --- |
| review comment | one sentence, or one fenced block |
| PR body | as short as the change allows (`git-and-pr-conventions`, PR body) |

A draft three times longer than its row is wrong before you read a word of it.

### The five moves

1. **Show the code instead of describing it**: one bare fenced block, the smallest that
   makes the point, little or no narration.
2. **Name the example to copy**, never the pattern in the abstract: `check <hook name>
   as an example`. A precedent names the PR (`like in #123`), never "like in the previous
   PRs".
3. **An opinion goes out as a question or a stated preference**, and says so when it is
   only one.
4. **Sweep the whole file**: one comment on the first instance, `fix in the whole file`,
   never one comment per instance.
5. **A refusal is one line with the reason.**

**Argument mode**: a design or a contract at stake gets one dense first-person paragraph,
the reasoning inline in parentheses, no headings or bullets, ending on the concrete next
step, never an offer to help.

**Typography**: parentheses carry the aside and may run long. Match the register of the
thread.

**Answering a review of the author's work**: a correct finding is fixed and answered with
what changed in one line; a wrong one gets the reason and the evidence; the author's own
wrong pushback is corrected in one factual sentence. Replies go in the inline thread, never
as a new top-level comment.

## Never: a hard gate

- **No em dash, no curly quote, no arrow glyph.** An aside takes ` - `; arrows are ASCII
  `->`, and a chain of states is written as one: `queued -> processing -> ready`.
- **No praise opener, hedge preamble, closing offer or recap**: "Nice catch", "Great
  work", "Good point", "Thanks for the PR", "That said", "It's worth noting", "Let me know
  if", "Hope that helps", "Feel free to", "Happy to", "In summary", "Overall".
- No heading or bullet list inside a review comment, no emoji, and no AI credit anywhere.

## Reviewing someone else's PR

Zero findings is the expected outcome, not a failed review: a clean PR gets an approval
with no body, or `looks good`. A review that does comment has three or four comments,
never a style sweep, and a repeated instance gets one comment on its first occurrence.

**Block on** wrong behaviour; a change that misses the point of its own ticket;
duplication that will spread; tests that test mocks or prove nothing; a pattern the repo
has already moved past; something the base branch removed coming back; a value
transformed at every site instead of one source of truth; accessibility missing entirely
from a new interactive surface.

**Say nothing about** naming, formatting, import order, file layout, a narrower type,
"consider extracting", missing docs, anything lint and CI already cover, or anything that
is only how you would have written it. A ticket's explicit ask beats house style.

Before posting, count: more than four findings on a normal PR means you are reviewing
style. Name each one's concrete failure (which input, which state, what the user sees); if
you cannot, delete it. A preference goes out as one line ending `up to you`, or not at
all.

## Every line must help its reader

Ask of every line: would the reader be worse off without it? No means cut it: the
workflow, what the ticket already says, a summary of the diff for someone reading the
diff, anything written to look thorough. Concrete input and output pairs stay even when
the description already has them.

**Links**: every ticket, PR or document is a labelled markdown link, `[#123](url)` or
`[the upload spec](url)`, never a bare key or a naked URL. Never link into source lines to
back up a reply, and never blame: explain why the behaviour is what it is.

## Showing a draft to the user

- Wrap each draft in a fenced block, labelled above with its anchor (`path:line`, PR
  number). No commentary between drafts; one short line of what changed after them.
- No draft for something a permission dialog will show the user anyway: the dialog is the
  ask.

## Before you send

1. **Refetch anything that exists remotely** (a PR body, a comment) right before composing:
   the author may have edited it since; every write is a full replace. Keep what you did
   not write, images included. Build the edit from the live copy, diff live against new,
   and fetch again after the write.
2. Read the exact bytes: strip any AI credit a template or tool added, and grep for an em
   dash, a curly quote and an arrow glyph.
3. Does what you tell someone to use exist on the default branch? If it only lands in
   another PR, say so.
4. Cut every sentence that does not change what the reader does.
