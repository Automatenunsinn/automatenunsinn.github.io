/**
 * Tests for the EPROM Patcher functionality
 */

import { convertDate, PATCH_DATA_CHECKSUM_PATTERN, PATCH_DATA_DATE_PATTERN, PATCH_DATA_FIXED } from '../src/bpatcher';

describe('EPROM Patcher', () => {
    describe('convertDate', () => {
        it('should convert valid date to BCD format', () => {
            const result = convertDate('20251227');
            expect(result).toEqual(new Uint8Array([0x27, 0x12, 0x25, 0x00]));
        });

        it('should handle edge cases', () => {
            const result = convertDate('invalid');
            expect(result).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
        });

        it('should convert current date', () => {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const result = convertDate(today);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(4);
        });

        it('should handle single digit day and month correctly', () => {
            const result = convertDate('20250105');
            expect(result).toEqual(new Uint8Array([0x05, 0x01, 0x25, 0x00]));
        });

        it('should handle leap year date', () => {
            const result = convertDate('20240229');
            expect(result).toEqual(new Uint8Array([0x29, 0x02, 0x24, 0x00]));
        });
    });

    describe('pattern constants', () => {
        it('should have valid pattern constants', () => {
            // Test that patterns are defined and have expected lengths
            expect(PATCH_DATA_CHECKSUM_PATTERN).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_CHECKSUM_PATTERN.length).toBe(4);
            
            expect(PATCH_DATA_DATE_PATTERN).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_DATE_PATTERN.length).toBe(12);
            
            expect(PATCH_DATA_FIXED).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_FIXED.length).toBe(40);
        });
    });
});