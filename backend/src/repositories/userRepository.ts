import type { User } from '../domain/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
}

/** Fixed set of demo users; stands in for a real identity provider. */
export const SEED_USERS: readonly User[] = [
  { id: 'alice', name: 'Alice (Submitter)', role: 'submitter' },
  { id: 'bob', name: 'Bob (Submitter)', role: 'submitter' },
  { id: 'rita', name: 'Rita (Reviewer)', role: 'reviewer' },
];

export class InMemoryUserRepository implements UserRepository {
  private readonly users: Map<string, User>;

  constructor(users: readonly User[] = SEED_USERS) {
    this.users = new Map(users.map((u) => [u.id, u]));
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async list(): Promise<User[]> {
    return [...this.users.values()];
  }
}
