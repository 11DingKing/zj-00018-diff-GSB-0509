import { describe, it, expect } from 'vitest';

const VOTE_MAP: Record<string, string> = {
  V2_POS: '+2',
  V1_POS: '+1',
  V0: '0',
  V1_NEG: '-1',
  V2_NEG: '-2',
};

const VOTE_CLASS_MAP: Record<string, string> = {
  V2_POS: 'vote-positive-2',
  V1_POS: 'vote-positive-1',
  V0: 'vote-zero',
  V1_NEG: 'vote-negative-1',
  V2_NEG: 'vote-negative-2',
};

describe('Vote display helpers', () => {
  it('maps all vote values to labels', () => {
    expect(VOTE_MAP['V2_POS']).toBe('+2');
    expect(VOTE_MAP['V1_POS']).toBe('+1');
    expect(VOTE_MAP['V0']).toBe('0');
    expect(VOTE_MAP['V1_NEG']).toBe('-1');
    expect(VOTE_MAP['V2_NEG']).toBe('-2');
  });

  it('maps all vote values to CSS classes', () => {
    expect(VOTE_CLASS_MAP['V2_POS']).toBe('vote-positive-2');
    expect(VOTE_CLASS_MAP['V1_POS']).toBe('vote-positive-1');
    expect(VOTE_CLASS_MAP['V0']).toBe('vote-zero');
    expect(VOTE_CLASS_MAP['V1_NEG']).toBe('vote-negative-1');
    expect(VOTE_CLASS_MAP['V2_NEG']).toBe('vote-negative-2');
  });

  it('handles unknown vote values with fallback', () => {
    expect(VOTE_MAP['UNKNOWN'] || '0').toBe('0');
    expect(VOTE_CLASS_MAP['UNKNOWN'] || 'vote-zero').toBe('vote-zero');
  });
});
