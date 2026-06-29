import { describe, expect, it } from 'vitest';
import { stripTrailingSlashes } from '../src/support/url';

describe('stripTrailingSlashes', () => {
  it('removes one or more trailing slashes', () => {
    expect(stripTrailingSlashes('https://example.cv/dfe')).toBe('https://example.cv/dfe');
    expect(stripTrailingSlashes('https://example.cv/dfe/')).toBe('https://example.cv/dfe');
    expect(stripTrailingSlashes('https://example.cv/dfe/////')).toBe('https://example.cv/dfe');
  });

  it('handles empty and all-slash inputs without backtracking', () => {
    expect(stripTrailingSlashes('')).toBe('');
    expect(stripTrailingSlashes('/'.repeat(100000))).toBe('');
  });
});
