export interface CategoryResource {
  readonly id?: string;
  readonly slug?: string;
}

export type AdminAction = 'category:manage' | 'analytics:view_all' | 'admin:access';
