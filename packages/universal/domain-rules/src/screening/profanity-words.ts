/** Lower-case whole words per language; a word only counts as itself, never inside another word. */
export const PROFANITY_WORDS: Readonly<Record<string, readonly string[]>> = {
  en: [
    'fuck',
    'fucking',
    'fucker',
    'motherfucker',
    'shit',
    'bullshit',
    'bitch',
    'asshole',
    'bastard',
    'cunt',
    'dickhead',
  ],
  pl: [
    'kurwa',
    'kurwy',
    'chuj',
    'chuje',
    'pierdolić',
    'pierdolone',
    'jebać',
    'jebany',
    'skurwysyn',
    'dupek',
  ],
};

export const FALLBACK_PROFANITY_LANGUAGE = 'en';
