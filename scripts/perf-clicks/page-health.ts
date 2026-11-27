export interface Shift {
  value: number;
  source: string;
}

interface Interaction {
  type: string;
  target: string;
  duration: number;
}

export interface PageHealth {
  cls: number;
  shifts: Shift[];
  longTasks: { count: number; ms: number };
  interactions: Interaction[];
}
