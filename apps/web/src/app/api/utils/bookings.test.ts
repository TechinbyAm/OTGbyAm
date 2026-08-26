import { describe, it, expect } from 'vitest';
import { summarizeResults, type InsertResult } from './bookings';

describe('summarizeResults', () => {
  it('counts added vs duplicate results separately, by type', () => {
    const results: InsertResult[] = [
      { type: 'stay', status: 'added' },
      { type: 'transportation', status: 'added' },
      { type: 'ticket', status: 'duplicate' },
      { type: 'ticket', status: 'duplicate' },
    ];

    expect(summarizeResults(results)).toEqual({
      count: 2,
      types: ['stay', 'transportation'],
      duplicateCount: 2,
      duplicateTypes: ['ticket', 'ticket'],
    });
  });

  it('returns all-zero shape for an empty result set, not undefined/null', () => {
    expect(summarizeResults([])).toEqual({
      count: 0,
      types: [],
      duplicateCount: 0,
      duplicateTypes: [],
    });
  });

  it('excludes empty-status results from both added and duplicate counts', () => {
    const results: InsertResult[] = [
      { type: 'activity', status: 'empty' },
      { type: 'stay', status: 'added' },
    ];

    const summary = summarizeResults(results);
    expect(summary.count).toBe(1);
    expect(summary.duplicateCount).toBe(0);
  });
});
