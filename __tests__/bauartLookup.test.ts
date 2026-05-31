import { lookupMachineName } from '../src/utils/bauartLookup';
import { bauartMap } from '../src/bauartMap';

describe('lookupMachineName', () => {
    beforeEach(() => {
        for (const key of Object.keys(bauartMap)) delete bauartMap[key];
    });

    test('returns empty string for values shorter than 3 characters', () => {
        bauartMap['12'] = 'Should not match';
        expect(lookupMachineName('12')).toBe('');
    });

    test('uses a 4-char prefix when the first digit is 4 or less', () => {
        bauartMap['1234'] = 'Game A';
        expect(lookupMachineName('1234567')).toBe('Game A');
    });

    test('uses a 3-char prefix when the first digit is greater than 4', () => {
        bauartMap['512'] = 'Game B';
        expect(lookupMachineName('5123456')).toBe('Game B');
    });

    test('boundary: first digit exactly 4 uses a 4-char prefix', () => {
        bauartMap['4123'] = 'Game C';
        expect(lookupMachineName('4123456')).toBe('Game C');
    });

    test('boundary: first digit exactly 5 uses a 3-char prefix', () => {
        bauartMap['512'] = 'Game D';
        expect(lookupMachineName('5129999')).toBe('Game D');
    });

    test('returns empty string when no mapping exists for the prefix', () => {
        expect(lookupMachineName('0123456')).toBe('');
    });
});
