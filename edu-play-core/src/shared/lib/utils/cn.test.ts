import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins string args with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('flattens nested arrays', () => {
    expect(cn('a', ['b', ['c', 'd']], 'e')).toBe('a b c d e');
  });

  it('collapses surrounding whitespace per token', () => {
    expect(cn('  a  ', 'b ')).toBe('a b');
  });
});
