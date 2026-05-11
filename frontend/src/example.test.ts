import { describe, it, expect } from 'vitest';

describe('frontend basic test', () => {
  it('should pass basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const text = 'code review system';
    expect(text.toUpperCase()).toBe('CODE REVIEW SYSTEM');
    expect(text.includes('review')).toBe(true);
  });
});
