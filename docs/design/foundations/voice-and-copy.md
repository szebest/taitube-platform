# Voice and copy

Taitube speaks like a curator, not a marketer: warm, plain, and specific. It is the voice behind the principles
in [README section 1](../README.md#1-who-taitube-is), especially "Say why". All copy comes from the message
catalogue (`@vp/messages`); numbers and dates go through `@vp/intl-react`.

## The voice

| Is | Is not |
|---|---|
| Warm: talks to one person | Chatty, jokey, or pleased with itself |
| Plain: short words, one idea per sentence | Jargon, product slang, acronyms |
| A curator: has a taste and gives a reason | A marketer: no superlatives, urgency or hype |
| Specific: names the video, the channel, the number | Vague ("Something went wrong") |
| Calm when things fail | Apologetic or alarmed |

Test: could a quiet friend who works at a film club have said it? If it sounds like an ad or a system log,
rewrite it.

## UI copy rules

| Rule | Do | Don't |
|---|---|---|
| Sentence case everywhere | "Add to queue" | "Add To Queue", "ADD TO QUEUE" (the `overline` uppercases by style, not in the string) |
| Verbs on buttons, the object when it helps | "Save", "Upload a video", "Switch to Nocturne" | "OK", "Submit", "Yes" |
| No exclamation marks | "Saved to Watch later" | "Saved!" |
| Errors say what happened and how to fix it | "We could not upload this file. Check that it is an MP4 or MOV under 4 GB, then try again." | "Upload failed. Error 500." |
| Say what still works when offline | "You are offline. Your queue and downloads still work." | "No connection" |
| Empty states: one line and one action | "Nothing here yet. Videos you save for later will wait here." [Browse Home] | A paragraph and three links |
| Confirmations name the thing | "Delete 'Lisbon at night'?" with "Delete" and "Keep it" | "Are you sure?" with "Yes" and "No" |
| One name per thing | "Queue" everywhere | "Queue", "Up next" and "Playlist" for the same list |
| Second person, no "we" for the product's feelings | "You have 3 new videos" | "We are excited to share" |
| Never blame the viewer | "That link has expired" | "You entered an invalid link" |

Status: a warning sentence says what to do, and sits beside its icon ([color.md](color.md)). Live is the word
"Live", and a premiere "Premieres Friday at 8 pm".

## Settings vocabulary

The appearance settings ([ticket 72](../../tickets/72-frontend-settings-customization-system.md)) speak in a
fixed set of words, so the same choice is never described two ways.

| Where | Words | Notes |
|---|---|---|
| The first option of every token-set row | "Theme default" with the theme's own value in brackets: "Theme default (Round)", "Theme default (Hairline)" | never "Auto", "Default" alone or "Recommended" |
| A row the viewer has overridden | a "Changed" badge, and a reset on that row | "Reset" on the row, not "Undo" or "Clear"; "Changed" is a state, so no verb |
| The page-level reset | "Reset all to the theme's defaults" | the button names the thing it resets |
| The link to the advanced page | "Fine-tune the look" | sentence case, no ellipsis, no "Advanced settings" or "Customise" |
| The simple density control | "Density" with "Comfortable" and "Compact" | writes spacing and sizing together; the advanced page names the two sets |
| A theme or mode choice | the theme's name ("Sand", "Nocturne"); "Dark", "Light", "OLED", "System" | the glossary: Theme, mode |
| A token group, as a row label | plain nouns: "Font", "Font size", "Spacing", "Control size", "Corners", "Borders", "Shadows", "Glow", "Motion" | the group keys (`typography`, `sizing`, `radius`, `ambient`) never appear in the UI |
| An implementation, as a choice | the word the viewer sees in the preview: "Figtree", "Geist", "System font"; "Compact", "Comfortable", "Airy"; "Sharp", "Soft", "Round"; "Flat", "Soft", "Deep"; "Off", "Subtle", "Cinematic"; "Standard", "Calm", "Reduced" | one word each, capitalised as a name, no description in the label |
| Font size steps | "Small", "Default", "Large", "Extra large" | |
| A live preview | no caption beyond the group's label | the preview is the explanation |

Rules: say what a choice does in the preview rather than in a sentence about it; never make the viewer feel they
chose wrongly ("Theme default" is a legitimate choice, not a missing one); a reset names its scope, either the
row or "all". Whatever the setting, the label states the choice, not the mechanism ("Reduced motion", not
"Opacity-only transitions").

## Editorial lines

The editorial serif (`editorial`, [typography.md](typography.md)) carries these. They are the product's
curated voice, so each is written for a person.

| Line | Length and form |
|---|---|
| Pick of the day note | one to two sentences, 15 to 40 words (about 220 characters), no hashtags, no "you will love". States what is worth watching and why: "A single take through Lisbon's night trams, shot on a camcorder older than most of its viewers." Visible window beside it: "Picked today, 14 h left" |
| Shelf heading | the reason, not a category: "From channels you subscribe to", "Because you watched Lisbon at night", "New from Marta Reis Films" |
| Reason label on a card (shelves only) | under 40 characters, one line: "Because you watched Porto", "New from a channel you subscribe to", "Part of a series you started", "Back by request" |
| Curator line under a shelf | optional, one sentence, no full stop needed |
| Channel About | a manifesto in the creator's own words; Taitube writes only the empty prompt: "Tell newcomers what you make and why." |
| Empty state line | the one line above the action, in the serif |

Reason patterns: "Because you watched X" (X is the title, truncated at 28 characters), "New from a channel you
subscribe to", "Popular this week in Y" (Y is a category). Never "Recommended for you": it says nothing.
Never imply you know more than you do ("We think you are into...").

## Numbers, dates and time

All through `@vp/intl-react` (`Intl` under the hood, [formatting-and-i18n](../../standards/formatting-and-i18n.md)),
never string concatenation or a hand-rolled abbreviation.

| Thing | Format | Example |
|---|---|---|
| View and subscriber counts | compact notation, locale-aware | "412K views", "284K subscribers" |
| Exact counts (comments, queue) | grouped integer | "1,284 comments", "3 / 12" |
| Duration | `mm:ss`, `h:mm:ss` over an hour, in the mono style | "18:42", "1:02:07" |
| Relative date | relative time up to a few weeks, then an absolute date | "2 days ago", "12 Mar 2026" |
| Time left | hours then minutes | "14 h left" |
| Percent | integer, no space rule of its own | "62% watched" |
| Plurals | catalogue plural rules, never "(s)" | "1 comment", "2 comments" |

A message never contains a formatted number as literal text; it takes the formatted value as a parameter.

## Glossary

One term for each product thing, used in the UI, the docs and the tickets.

| Term | Means | Do not call it |
|---|---|---|
| Pick of the day | the one video chosen per day, with a note and a window | Featured, Recommended |
| Shelf | a horizontal row of cards under a reason heading | Carousel, rail (rail is the side navigation) |
| Reason label | the line saying why a card is here | Tag, badge |
| Continue watching | partly watched videos with progress | Resume, Recently watched |
| Queue | the viewer's own ordered list of what plays next | Up next, Playlist (a playlist is saved and named) |
| More like this | labelled suggestions below the queue | Related |
| Liner notes | the description card: stats, notes, chapters | Description box |
| Start here | the shelf a creator sets for newcomers: their pinned videos once ticket 96 (featured videos) ships, and the channel's most-viewed uploads until then and for channels that pin none | Featured, Trailer |
| Shorts | vertical videos, 9:16 | Reels, Clips |
| Clip | a short excerpt cut from a longer video | Short |
| Subscribe, Subscribed | the action of following a channel and its state | Follow, Following |
| Subscribers | the count of people subscribed | Followers |
| Subscriptions | the feed of videos from subscribed channels (the rail and tab bar item) | Following |
| Live | currently broadcasting; the word is also the badge | Streaming |
| Premiere | a scheduled first showing | Event |
| Now playing bar | the bar that keeps a video playing on every page | Miniplayer |
| Command palette | search that also runs actions, `/` or `Cmd K` | Search bar (the field only opens it) |
| Watch later | the saved-for-later list | Favourites |
| Studio | the creator app | Dashboard, Creator hub |
| Theme, mode | Sand or Nocturne; dark, light or OLED | Skin, colour scheme |
| Theme default | the implementation a theme starts each setting on, shown first in every row | Auto, Recommended |
| Fine-tune the look | the advanced appearance page, one row per token set | Advanced settings, Customise |
| Density | the simple control writing spacing and sizing together: Comfortable or Compact | Spacing, Size, Layout |

The API and the domain keep `subscription` as their term, and the UI now uses the same word, so there is no
label to map.

## Do and don't

| Do | Don't |
|---|---|
| Write the string in the catalogue with a key | Hard-code copy in a component |
| Give the reason before the click | Hide why something is recommended |
| Use the glossary term in tickets and code names | Invent a synonym per surface |
| Keep an error to what and how to fix | Show a code or a stack trace |
