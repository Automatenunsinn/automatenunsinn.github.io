/** @jest-environment jsdom */

import { parseDate } from '../src/xcfunctions';

describe('parseDate', () => {
  it('should return null for invalid input', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('12345')).toBeNull();
    expect(parseDate('1234567')).toBeNull();
    expect(parseDate('abcdef')).toBeNull();
    expect(parseDate('12a456')).toBeNull();
  });

  it('should parse YYMMDD format', () => {
    expect(parseDate('240101')).toEqual(new Date(2024, 0, 1));
    expect(parseDate('991231')).toEqual(new Date(1999, 11, 31));
  });

  it('should parse YYDDMM format when YYMMDD is invalid', () => {
    expect(parseDate('241301')).toEqual(new Date(2024, 0, 13));
    expect(parseDate('240229')).toEqual(new Date(2024, 1, 29));
  });

  it('should return null for invalid dates', () => {
    expect(parseDate('230229')).toBeNull();
    expect(parseDate('241332')).toBeNull();
  });
});