export type Role = 'submitter' | 'reviewer';

export interface User {
  id: string;
  name: string;
  role: Role;
}
