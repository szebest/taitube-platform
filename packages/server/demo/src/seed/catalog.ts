import type { NonEmpty } from './rng';

export interface CategoryEntry {
  slug: string;
  name: string;
  description: string;
  hue: number;
  subjects: NonEmpty<string>;
  tags: NonEmpty<string>;
}

export const CATEGORIES: NonEmpty<CategoryEntry> = [
  {
    slug: 'music',
    name: 'Music',
    description: 'Sessions, covers and sound design',
    hue: 280,
    subjects: [
      'a late night synth jam',
      'a lo-fi beat',
      'an acoustic cover',
      'a drum loop',
      'a piano improvisation',
    ],
    tags: ['music', 'live', 'beats', 'studio', 'acoustic'],
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    description: 'Playthroughs, speedruns and reviews',
    hue: 140,
    subjects: [
      'a retro platformer',
      'a boss fight',
      'a speedrun route',
      'a puzzle game',
      'an indie roguelike',
    ],
    tags: ['gaming', 'speedrun', 'retro', 'indie', 'walkthrough'],
  },
  {
    slug: 'education',
    name: 'Education',
    description: 'Lessons that fit in a coffee break',
    hue: 210,
    subjects: [
      'how tides work',
      'the history of maps',
      'basic statistics',
      'how bridges stand',
      'learning a language',
    ],
    tags: ['learn', 'explained', 'lesson', 'history', 'howto'],
  },
  {
    slug: 'science',
    name: 'Science',
    description: 'Experiments and explanations',
    hue: 190,
    subjects: [
      'a kitchen chemistry trick',
      'the night sky',
      'a pendulum experiment',
      'how magnets behave',
      'tiny ecosystems',
    ],
    tags: ['science', 'experiment', 'space', 'physics', 'nature'],
  },
  {
    slug: 'travel',
    name: 'Travel',
    description: 'Places, routes and slow trips',
    hue: 30,
    subjects: [
      'a coastal train ride',
      'a mountain village',
      'a night market',
      'a city at sunrise',
      'a forest trail',
    ],
    tags: ['travel', 'trip', 'city', 'hiking', 'scenery'],
  },
  {
    slug: 'cooking',
    name: 'Cooking',
    description: 'Recipes from real kitchens',
    hue: 15,
    subjects: [
      'a ten minute noodle dish',
      'sourdough from scratch',
      'a weeknight curry',
      'street style tacos',
      'a lazy brunch',
    ],
    tags: ['cooking', 'recipe', 'food', 'kitchen', 'quick'],
  },
  {
    slug: 'sports',
    name: 'Sports',
    description: 'Training, matches and highlights',
    hue: 100,
    subjects: [
      'a trail run',
      'a skate session',
      'a pickup match',
      'a climbing route',
      'a morning swim',
    ],
    tags: ['sports', 'training', 'highlights', 'outdoors', 'fitness'],
  },
  {
    slug: 'comedy',
    name: 'Comedy',
    description: 'Sketches and bad ideas',
    hue: 330,
    subjects: [
      'an office sketch',
      'a very long pause',
      'a bad idea',
      'a podcast gone wrong',
      'a dramatic reading',
    ],
    tags: ['comedy', 'sketch', 'funny', 'skit', 'parody'],
  },
  {
    slug: 'technology',
    name: 'Technology',
    description: 'Gadgets, tools and build logs',
    hue: 240,
    subjects: [
      'a small home server',
      'a keyboard build',
      'a terminal setup',
      'a tiny robot',
      'a retro console mod',
    ],
    tags: ['tech', 'build', 'tools', 'diy', 'hardware'],
  },
];

export const TITLE_TEMPLATES: NonEmpty<string> = [
  'Watching {subject}',
  '{subject}, start to finish',
  'A closer look at {subject}',
  '{subject} in under a minute',
  'Everything about {subject}',
  'Why I keep coming back to {subject}',
  '{subject}: the full session',
  'My take on {subject}',
];

export const DESCRIPTION_TEMPLATES: NonEmpty<string> = [
  'A generated demo clip about {subject}. Nothing here is real footage: it is a test pattern and a tone, made so the pipeline has something to chew on.',
  'Part of the demo world: {subject}, as a synthetic clip. Open the player, scrub the timeline, try the quality menu.',
  'Seeded sample about {subject}. The picture is a generated pattern, the sound is a sine wave.',
];

export const CHANNEL_ADJECTIVES: NonEmpty<string> = [
  'Northern',
  'Quiet',
  'Paper',
  'Velvet',
  'Copper',
  'Midnight',
  'Little',
  'Orbit',
  'Garden',
  'Pocket',
  'Neon',
  'Harbor',
];

export const CHANNEL_NOUNS: NonEmpty<string> = [
  'Lanterns',
  'Studio',
  'Workshop',
  'Collective',
  'Signal',
  'Atlas',
  'Kitchen',
  'Club',
  'Journal',
  'Lab',
  'Works',
  'Archive',
];

export const BIO_TEMPLATES: NonEmpty<string> = [
  'Short videos about {topic}. New uploads whenever the render finishes.',
  'Everything {topic}, made by people who should be sleeping.',
  'A small channel about {topic}. Comments welcome, spoilers tolerated.',
];

export const FAN_FIRST_NAMES: NonEmpty<string> = [
  'ada',
  'bruno',
  'chloe',
  'dario',
  'elif',
  'farid',
  'greta',
  'hugo',
  'iris',
  'jonas',
  'kaito',
  'lena',
  'milo',
  'nora',
  'omar',
  'petra',
  'quinn',
  'rafa',
  'sana',
  'theo',
];

export const COMMENT_TEXTS: NonEmpty<string> = [
  'Great video, thanks for sharing this.',
  'The editing on this one is really clean.',
  'Came here from the recommendations and stayed for the whole thing.',
  'Can you do a longer version of this?',
  'Subscribed. More of this please.',
  'Watched it twice already.',
  'This is exactly what I was looking for.',
  'Underrated channel, honestly.',
  'The audio is a bit quiet on my end but the content is great.',
  'Showed this to my friends and they loved it.',
  'Not sure I agree with the ending, but fair.',
  'Perfect length.',
  'I learned something new today.',
  'The colours in this are lovely.',
  'Please make a part two.',
  'Saving this for later.',
];

export const REPLY_TEXTS: NonEmpty<string> = [
  'Thanks, glad it helped.',
  'Agreed!',
  'Working on it, stay tuned.',
  'Same here.',
  'Good point, I will cover it next time.',
];

export const REPORT_NOTES: NonEmpty<string> = [
  'Looks like an advert to me.',
  'This comment is off topic.',
  'Please have a look at this one.',
];

export const SEARCH_QUERIES: NonEmpty<string> = [
  'lo-fi beats',
  'speedrun',
  'sourdough',
  'night sky',
  'train ride',
  'keyboard build',
  'climbing',
  'sketch comedy',
  'how tides work',
  'street tacos',
];

export const PLAYLIST_TITLES: NonEmpty<string> = [
  'Favourites',
  'Weekend watching',
  'To rewatch',
  'Calm picks',
  'Learn something',
  'Background noise',
];
