export type MemberMuteScope = 'chat' | 'voice';

export type MemberMuteDuration = '10m' | '1h' | 'party';

export interface MemberMenuRole {
  id: string;
  name: string;
  key: string | null;
  position: number;
  assigned: boolean;
}
