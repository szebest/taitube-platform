export type Persona = 'creator' | 'viewer';

type SeededVideo = { id: string; title: string };

export type Stack = {
  apiUrl: string;
  personas: Record<Persona, string>;
  videos: { watchable: SeededVideo; canvas: SeededVideo; draft: SeededVideo };
};
