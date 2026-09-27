import { describe, expect, it } from 'vitest';
import { canTransition } from '../src/domain/document.js';

describe('canTransition', () => {
  it.each([
    ['pending', 'approved'],
    ['pending', 'rejected'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['approved', 'approved'],
    ['approved', 'pending'],
    ['rejected', 'pending'],
    ['pending', 'pending'],
  ] as const)('forbids %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
