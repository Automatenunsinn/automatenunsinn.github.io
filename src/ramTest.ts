// CMP.L (A4),D0; BNE.S +6; MOVE.L D1,(A4); CMP.L (A4),D1.
// Match the verification instructions, independent of ROM/RAM addresses.
export const PATCH_DATA_RAM_TEST_PATTERN = new Uint8Array([0xb0, 0x94, 0x66, 6, 0x28, 0x81, 0xb2, 0x94]);
// Compare each register with itself so the original success branches are taken.
export const PATCH_DATA_RAM_TEST_VALUE = new Uint8Array([0xb0, 0x80, 0x66, 6, 0x28, 0x81, 0xb2, 0x81]);
// MOVE.L D1,(A5); MOVE.L D0,(A4); CMP.L (A5),D1; BNE.W.
const aliasPattern = [0x2a, 0x81, 0x28, 0x80, 0xb2, 0x95, 0x66, 0];
const aliasSecond = [0x2a, 0xc1, 0xb0, 0x9c, 0x66, 0];

export function patchRamTest(source: Uint8Array, result: Uint8Array): boolean {
    if (source.length !== result.length) return false;
    const matches = (offset: number, pattern: ArrayLike<number>): boolean =>
        offset + pattern.length <= source.length &&
        Array.from(pattern).every((value, index) => source[offset + index] === value);
    const tests: number[] = [];
    const aliases: number[] = [];
    for (let offset = 0; offset < source.length; offset += 2) {
        if (matches(offset, PATCH_DATA_RAM_TEST_PATTERN)) tests.push(offset);
        if (matches(offset, aliasPattern) && matches(offset + 10, aliasSecond) && offset + 18 <= source.length) {
            // Both BNE.W instructions must lead to the same forward error handler.
            const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
            const first = view.getInt16(offset + 8);
            const second = view.getInt16(offset + 16);
            if (first > 10 && first === second + 8) aliases.push(offset);
        }
    }
    if (tests.length === 0) return false;
    for (const offset of tests) result.set(PATCH_DATA_RAM_TEST_VALUE, offset);
    for (const offset of aliases) {
        // Retain both reads and their address-register postincrements.
        result.set([0x4e, 0x71, 0x4e, 0x71], offset + 6);
        result.set([0x4e, 0x71, 0x4e, 0x71], offset + 14);
    }
    return true;
}
