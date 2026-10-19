import { patchTimekeeper, readTimekeeper } from '../src/tk';

describe('Timekeeper clock editor', () => {
    it('reads the stored clock including seconds and ignores the STOP flag', () => {
        const image = patchTimekeeper(new Uint8Array(0x2000), '2024-02-29T23:58:47');
        image[0x1FF9] |= 0x80;
        expect(readTimekeeper(image)).toBe('2024-02-29T23:58:47');
    });

    it.each([[0x1FFE, 0x13], [0x1FFD, 0x30], [0x1FFF, 0x2A], [0x1FFB, 0x24], [0x1FFA, 0x60], [0x1FF9, 0x60]])('rejects invalid clock register %i = %i', (offset, value) => {
        const image = patchTimekeeper(new Uint8Array(0x2000), '2024-02-29T23:58:47');
        image[offset] = value;
        expect(readTimekeeper(image)).toBeNull();
    });

    it('writes the BCD clock registers and keeps calibration while clearing latch and stop flags', () => {
        const image = new Uint8Array(0x2000).fill(0xFF);
        const result = patchTimekeeper(image, '2024-02-29T23:58:47');
        expect(Array.from(result.slice(0x1FF8))).toEqual([
            0x3F, 0x47, 0x58, 0x23, 0x05, 0x29, 0x02, 0x24
        ]);
        expect(result.slice(0, 0x1FF8)).toEqual(image.slice(0, 0x1FF8));
        expect(image.every(byte => byte === 0xFF)).toBe(true);
    });

    it.each([0, 0x1FFF, 0x2001])('rejects image size %i', size => {
        expect(() => patchTimekeeper(new Uint8Array(size), '2024-02-29T23:58:47')).toThrow('8192');
    });

    it.each(['', '1999-12-31T23:59', '2100-01-01T00:00', '2023-02-29T00:00', '2024-01-01T24:00', '2024-01-01T00:60', '2024-01-01T00:00:60'])('rejects invalid clock %s', value => {
        expect(() => patchTimekeeper(new Uint8Array(0x2000), value)).toThrow();
    });
});
