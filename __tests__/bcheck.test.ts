import { calculateChecksum, findChecksumOffset, preserveChecksum } from '../src/bcheck';

describe('ROM checksum preservation', () => {
    // Independent reference: sum every big-endian word outside the field.
    function wordSum(rom: Uint8Array, field: number): number {
        const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
        let sum = 0;
        for (let i = 0; i < rom.length; i += 2) {
            if (i !== field && i !== field + 2) sum += view.getUint16(i, false);
        }
        return sum >>> 0;
    }

    it('includes the word immediately after the four-byte checksum field', () => {
        const rom = new Uint8Array([0x12, 0x34, 0xaa, 0xbb, 0xcc, 0xdd, 0x56, 0x78]);
        expect(calculateChecksum(rom, 2, rom.length)).toBe(0x68ac);
    });

    it.each([0x80000, 0x100000])('preserves an independent word sum after editing the word following the field (%s bytes)', size => {
        const rom = new Uint8Array(size).fill(0xff);
        const view = new DataView(rom.buffer);
        view.setUint32(0x7c, 0x100, false);
        rom.fill(0, size - 4);
        const before = wordSum(rom, 0x112);
        calculateChecksum(rom, 0x112, size);
        view.setUint16(0x116, 0x1234, false);
        expect(preserveChecksum(rom)).toBe(true);
        expect(wordSum(rom, 0x112)).toBe(before);
    });

    it('retains carries above 16 bits', () => {
        const rom = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0]);
        expect(calculateChecksum(rom, 4, rom.length)).toBe(0x1fffe);
    });

    it('compensates a difference of exactly 0x10000', () => {
        const rom = new Uint8Array(0x80000);
        const view = new DataView(rom.buffer);
        view.setUint32(0x7c, 0x100, false);
        view.setUint32(rom.length - 4, 0x0000fffd, false);
        const target = wordSum(rom, 0x112) + 0x10000;
        expect(preserveChecksum(rom, target)).toBe(true);
        expect(wordSum(rom, 0x112)).toBe(target);
    });

    it.each([0x80000, 0x100000])('uses all 64 compensation bytes (%s bytes)', size => {
        const rom = new Uint8Array(size);
        new DataView(rom.buffer).setUint32(0x7c, 0x100, false);
        const prefix = rom.slice(0, size - 64);
        const target = wordSum(rom, 0x112) + 0x1fffe0;
        expect(preserveChecksum(rom, target)).toBe(true);
        expect(wordSum(rom, 0x112)).toBe(target);
        expect(rom.slice(size - 64)).toEqual(new Uint8Array(64).fill(0xff));
        expect(rom.slice(0, size - 64)).toEqual(prefix);
    });

    it('rejects a checksum field overlapping the compensation bytes', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, rom.length - 66 - 0x12, false);
        const before = new Uint8Array(rom);
        expect(preserveChecksum(rom, 0)).toBe(false);
        expect(rom).toEqual(before);
    });

    it('rejects compensation that cannot fit without modifying the ROM', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, 0x100, false);
        const before = new Uint8Array(rom);
        expect(preserveChecksum(rom, wordSum(rom, 0x112) + 0x1fffe1)).toBe(false);
        expect(rom).toEqual(before);
    });

    it('derives the field from the level-7 vector', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, 0x4c82, false);
        expect(findChecksumOffset(rom)).toBe(0x4c94);
    });

    it('keeps the original checksum after edits', () => {
        const rom = new Uint8Array(0x80000);
        new DataView(rom.buffer).setUint32(0x7c, 0x100, false);
        new DataView(rom.buffer).setUint32(0x112, 0x12345678, false);
        rom.fill(0xff, rom.length - 4);
        const before = calculateChecksum(rom, 0x112, 0x80000);
        rom[0x200] ^= 0xff;
        expect(preserveChecksum(rom)).toBe(true);
        expect(calculateChecksum(rom, 0x112, 0x80000)).toBe(before);
        expect(new DataView(rom.buffer).getUint32(0x112, false)).toBe(0x12345678);
    });
});
