import { describe, it, expect } from 'vitest';
import { Daypart } from '../enums.js';
import {
  classifyDaypart, parseDateSafe, clamp,
  normalizeArray, zScore, iqr, roundTo,
  isSufficientData, getPeriodDates, formatDateISO
} from '../utils.js';

describe('classifyDaypart', () => {
  it('returns null for null/undefined', () => {
    expect(classifyDaypart(null)).toBeNull();
    expect(classifyDaypart(undefined)).toBeNull();
  });

  it('classifies LATE_NIGHT (0-4)', () => {
    expect(classifyDaypart(0)).toBe(Daypart.LATE_NIGHT);
    expect(classifyDaypart(2)).toBe(Daypart.LATE_NIGHT);
    expect(classifyDaypart(4)).toBe(Daypart.LATE_NIGHT);
  });

  it('classifies DAWN (5-6)', () => {
    expect(classifyDaypart(5)).toBe(Daypart.DAWN);
    expect(classifyDaypart(6)).toBe(Daypart.DAWN);
  });

  it('classifies MORNING (7-11)', () => {
    expect(classifyDaypart(7)).toBe(Daypart.MORNING);
    expect(classifyDaypart(9)).toBe(Daypart.MORNING);
    expect(classifyDaypart(11)).toBe(Daypart.MORNING);
  });

  it('classifies AFTERNOON (12-16)', () => {
    expect(classifyDaypart(12)).toBe(Daypart.AFTERNOON);
    expect(classifyDaypart(14)).toBe(Daypart.AFTERNOON);
    expect(classifyDaypart(16)).toBe(Daypart.AFTERNOON);
  });

  it('classifies EVENING (17-20)', () => {
    expect(classifyDaypart(17)).toBe(Daypart.EVENING);
    expect(classifyDaypart(19)).toBe(Daypart.EVENING);
    expect(classifyDaypart(20)).toBe(Daypart.EVENING);
  });

  it('classifies NIGHT (21-23)', () => {
    expect(classifyDaypart(21)).toBe(Daypart.NIGHT);
    expect(classifyDaypart(22)).toBe(Daypart.NIGHT);
    expect(classifyDaypart(23)).toBe(Daypart.NIGHT);
  });

  it('handles string hour input', () => {
    expect(classifyDaypart('14')).toBe(Daypart.AFTERNOON);
    expect(classifyDaypart('6')).toBe(Daypart.DAWN);
  });
});

describe('parseDateSafe', () => {
  it('parses valid date strings', () => {
    const d = parseDateSafe('2024-01-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseDateSafe(null)).toBeNull();
    expect(parseDateSafe(undefined)).toBeNull();
    expect(parseDateSafe('')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(parseDateSafe('not-a-date')).toBeNull();
    expect(parseDateSafe('2024-13-01')).toBeNull();
  });

  it('parses ISO date strings', () => {
    const d = parseDateSafe('2024-06-15T10:30:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2024);
  });
});

describe('clamp', () => {
  it('returns value within bounds', () => {
    expect(clamp(50)).toBe(50);
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps to minimum', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(5, 10, 100)).toBe(10);
  });

  it('clamps to maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(50, 0, 30)).toBe(30);
  });

  it('uses default bounds 0-100', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(200)).toBe(100);
  });
});

describe('normalizeArray', () => {
  it('normalizes values to 0-1 range', () => {
    expect(normalizeArray([10, 20, 30])).toEqual([0, 0.5, 1]);
  });

  it('returns 0.5 for all values when all equal', () => {
    expect(normalizeArray([5, 5, 5])).toEqual([0.5, 0.5, 0.5]);
  });

  it('works with single value', () => {
    expect(normalizeArray([42])).toEqual([0.5]);
  });

  it('handles negative values', () => {
    const result = normalizeArray([-10, 0, 10]);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0.5);
    expect(result[2]).toBe(1);
  });
});

describe('zScore', () => {
  it('calculates z-score for normal distribution', () => {
    const values = [10, 20, 30, 40, 50];
    const mean = 30;
    const std = Math.sqrt((400 + 100 + 0 + 100 + 400) / 4);
    expect(zScore(values, mean)).toBeCloseTo(0, 1);
    expect(zScore(values, 50)).toBeCloseTo((50 - mean) / std, 1);
  });

  it('returns 0 for fewer than 2 values', () => {
    expect(zScore([1], 1)).toBe(0);
    expect(zScore([], 1)).toBe(0);
  });

  it('returns 0 when std is 0', () => {
    expect(zScore([5, 5, 5], 5)).toBe(0);
  });

  it('gives positive z-score for above-mean values', () => {
    expect(zScore([1, 2, 3, 4, 5], 5)).toBeGreaterThan(0);
  });

  it('gives negative z-score for below-mean values', () => {
    expect(zScore([1, 2, 3, 4, 5], 1)).toBeLessThan(0);
  });
});

describe('iqr', () => {
  it('calculates IQR for various arrays', () => {
    const result = iqr([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.q1).toBe(3);
    expect(result.q3).toBe(7);
    expect(result.iqr).toBe(4);
  });

  it('handles even-length arrays', () => {
    const result = iqr([10, 20, 30, 40]);
    expect(result.q1).toBe(20);
    expect(result.q3).toBe(40);
    expect(result.iqr).toBe(20);
  });

  it('handles odd-length arrays', () => {
    const result = iqr([1, 3, 5, 7, 9]);
    expect(result.q1).toBe(3);
    expect(result.q3).toBe(7);
    expect(result.iqr).toBe(4);
  });

  it('sorts values before calculating', () => {
    const result = iqr([9, 1, 7, 3, 5]);
    expect(result.q1).toBe(3);
    expect(result.q3).toBe(7);
    expect(result.iqr).toBe(4);
  });

  it('handles small arrays', () => {
    const result = iqr([1, 2, 3]);
    expect(result.q1).toBe(1);
    expect(result.q3).toBe(3);
    expect(result.iqr).toBe(2);
  });
});

describe('roundTo', () => {
  it('rounds to specified decimal places', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(3.14159, 0)).toBe(3);
    expect(roundTo(3.14159, 4)).toBe(3.1416);
  });

  it('defaults to 2 decimal places', () => {
    expect(roundTo(1.2345)).toBe(1.23);
    expect(roundTo(1.9999)).toBe(2);
  });
});

describe('isSufficientData', () => {
  it('returns true when count meets threshold', () => {
    expect(isSufficientData(5)).toBe(true);
    expect(isSufficientData(10)).toBe(true);
  });

  it('returns false when count is below threshold', () => {
    expect(isSufficientData(4)).toBe(false);
    expect(isSufficientData(0)).toBe(false);
  });

  it('uses custom threshold', () => {
    expect(isSufficientData(10, 10)).toBe(true);
    expect(isSufficientData(9, 10)).toBe(false);
  });
});

describe('getPeriodDates', () => {
  it('returns default 1-year period when no dates given', () => {
    const { start, end } = getPeriodDates(null, null);
    expect(end).toBeInstanceOf(Date);
    expect(start).toBeInstanceOf(Date);
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBeCloseTo(365 * 24 * 60 * 60 * 1000, -3);
  });

  it('uses provided dates', () => {
    const { start, end } = getPeriodDates('2024-01-01', '2024-12-31');
    expect(start.getFullYear()).toBe(2024);
    expect(start.getMonth()).toBe(0);
    expect(end.getFullYear()).toBe(2024);
    expect(end.getMonth()).toBe(11);
  });
});

describe('formatDateISO', () => {
  it('formats Date objects as ISO date string', () => {
    expect(formatDateISO(new Date('2024-01-15'))).toBe('2024-01-15');
  });

  it('formats date strings', () => {
    expect(formatDateISO('2024-06-15T10:30:00Z')).toBe('2024-06-15');
  });

  it('returns null for null/undefined', () => {
    expect(formatDateISO(null)).toBeNull();
    expect(formatDateISO(undefined)).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(formatDateISO('not-a-date')).toBeNull();
  });
});
