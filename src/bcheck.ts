export const CHECKSUM_VECTOR_OFFSET = 0x7c;
export const CHECKSUM_VECTOR_ADDEND = 0x12;
export const SUPPORTED_ROM_SIZES = [0x80000, 0x100000];

function readUint32BE(bytes: Uint8Array, offset: number): number {
    return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function findChecksumOffset(rom: Uint8Array): number {
    const target = readUint32BE(rom, CHECKSUM_VECTOR_OFFSET);
    const offset = target + CHECKSUM_VECTOR_ADDEND;
    if (offset + 4 > rom.length || (offset & 1) !== 0) throw new RangeError("Invalid checksum vector");
    return offset;
}

export function calculateChecksum(rom: Uint8Array, checksumOffset: number, checksumSize: number): number {
    if (checksumSize > rom.length || (checksumSize & 1) !== 0 || checksumOffset < 0 || checksumOffset + 4 > checksumSize) {
        throw new RangeError("Invalid checksum range");
    }
    let sum = 0;
    for (let offset = 0; offset < checksumSize; offset += 2) {
        if (offset === checksumOffset) { offset += 4; continue; }
        sum = (sum + ((rom[offset] << 8) | rom[offset + 1])) >>> 0;
    }
    return sum;
}

export function preserveChecksum(rom: Uint8Array): boolean {
    if (SUPPORTED_ROM_SIZES.indexOf(rom.length) < 0) return false;
    const checksumSize = rom.length;
    let checksumOffset: number;
    try { checksumOffset = findChecksumOffset(rom); } catch (_) { return false; }
    const last = rom.length - 4;
    const original = calculateChecksum(rom, checksumOffset, checksumSize);
    rom.fill(0, checksumOffset, checksumOffset + 4);
    rom.fill(0, last);
    const base = calculateChecksum(rom, checksumOffset, checksumSize);
    const compensation = (original - base) >>> 0;
    new DataView(rom.buffer, rom.byteOffset, rom.byteLength).setUint32(last, compensation, false);
    return last + 4 <= checksumSize;
}
