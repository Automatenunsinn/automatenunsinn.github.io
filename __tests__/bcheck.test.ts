import { calculateChecksum, findChecksumOffset, preserveChecksum } from '../src/bcheck';

describe('ROM checksum preservation', () => {
    it('derives the field from the level-7 vector', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, 0x4c82, false);
        expect(findChecksumOffset(rom)).toBe(0x4c94);
    });

    it('keeps the original checksum after edits', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, 0x100, false);
        new DataView(rom.buffer).setUint32(0x112, 0x12345678, false);
        const before = calculateChecksum(rom, 0x112, 0x80000);
        rom[0x200] ^= 0xff;
        expect(preserveChecksum(rom)).toBe(true);
        expect(calculateChecksum(rom, 0x112, 0x80000)).toBe(before);
        expect(new DataView(rom.buffer).getUint32(0x112, false)).toBe(0x12345678);
    });
});
