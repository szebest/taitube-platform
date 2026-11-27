export type Clock = () => number;

export const realClock: Clock = () => Date.now();
