import { encodeExpiryDate, patchExpiryDate, readExpiryDate } from '../src/st25';

describe('ST25 timekeeper images', () => {
    it('reads the Calypso dump layout and leaves the bytes surrounding the expiry unchanged', () => {
        const image = new Uint8Array(0x2000);
        // Original Calypso bytes at 0x1FDC: expiry starts after the two FF bytes.
        image.set([0xFF, 0xFF, 0xF8, 0xA4, 0x1D, 0x10, 0x07, 0x5B, 0xE2, 0xEF, 0x5A], 0x1FDC);
        expect(readExpiryDate(image)).toBe('20330430');
        expect(patchExpiryDate(image, '20330430')).toEqual(image);
        const patched = patchExpiryDate(image, '20330501');
        expect(readExpiryDate(patched)).toBe('20330501');
        expect(patched.slice(0, 0x1FDE)).toEqual(image.slice(0, 0x1FDE));
        expect(patched.slice(0x1FE6)).toEqual(image.slice(0x1FE6));
    });

    it.each([0x1FF8, 0x2000])('decodes the literal F8 A4 1D 10 07 5B E2 EF sequence in a %i-byte dump', size => {
        const image = new Uint8Array(size);
        image.set([0xF8, 0xA4, 0x1D, 0x10, 0x07, 0x5B, 0xE2, 0xEF], 0x1FDE);
        expect(readExpiryDate(image)).toBe('20330430');
    });

    it.each(['20330430', '20240229', '20330101'])('reads expiry %s from complete and truncated dumps', value => {
        for (const size of [0x1FF8, 0x2000]) {
            const image = patchExpiryDate(new Uint8Array(size), value);
            expect(readExpiryDate(image)).toBe(value);
            image[0x1FE2] ^= 1;
            expect(readExpiryDate(image)).toBeNull();
        }
    });

    it('rejects invalid encoded dates even when the complement matches', () => {
        const image = new Uint8Array(0x2000);
        new DataView(image.buffer).setUint32(0x1FDE, 31022024 * 9 - 65, true);
        for (let i = 0; i < 4; i++) image[0x1FE2 + i] = image[0x1FDE + i] ^ 0xFF;
        expect(readExpiryDate(image)).toBeNull();
    });

    it('encodes the supplied April 30, 2033 example with its complement', () => {
        expect(Array.from(encodeExpiryDate('20330430'))).toEqual([
            0xF8, 0xA4, 0x1D, 0x10, 0x07, 0x5B, 0xE2, 0xEF
        ]);
    });

    it('patches only the expiry bytes when no clock change is requested', () => {
        const image = new Uint8Array(0x2000).fill(0xA5);
        const result = patchExpiryDate(image, '20330430');
        expect(result.length).toBe(0x2000);
        expect(result.slice(0, 0x1FDE)).toEqual(image.slice(0, 0x1FDE));
        expect(result.slice(0x1FE6)).toEqual(image.slice(0x1FE6));
        expect(result.slice(0x1FDE, 0x1FE6)).toEqual(encodeExpiryDate('20330430'));
        expect(image.every(byte => byte === 0xA5)).toBe(true);
    });

    it.each([0x1FF8, 0x1FF9, 0x1FFA, 0x1FFB, 0x1FFC, 0x1FFD, 0x1FFE, 0x1FFF])('patches a truncated image of size %i without padding', size => {
        const image = new Uint8Array(size).fill(0xA5);
        const result = patchExpiryDate(image, '20330430');
        expect(result.length).toBe(size);
        expect(result.slice(0x1FDE, 0x1FE6)).toEqual(encodeExpiryDate('20330430'));
        expect(result.slice(0, 0x1FDE)).toEqual(image.slice(0, 0x1FDE));
        expect(result.slice(0x1FE6)).toEqual(image.slice(0x1FE6));
        expect(image.every(byte => byte === 0xA5)).toBe(true);
    });

    it.each([0, 0x1FE6, 0x1FF7, 0x2001])('rejects image size %i', size => {
        expect(() => patchExpiryDate(new Uint8Array(size), '20330430')).toThrow('8192');
    });

    it.each(['20230229', '20330431', '20331301', '20330001', '20330430x', '30042033'])('rejects invalid expiry %s', value => {
        expect(() => encodeExpiryDate(value)).toThrow();
    });

});
